// lib/queue/worker.mjs
//
// Satu-satunya tempat yang benar-benar memanggil client.sendMessage()/reply().
// Single-flight: tidak pernah dua pengiriman berjalan bersamaan ke Puppeteer
// (whatsapp-web.js tidak menjamin aman untuk client.sendMessage() konkuren).
//
// Dua jalur:
//  - interactive: balasan percakapan langsung (replyChatWA) -- in-memory,
//    TIDAK persisten (balasan ke pesan yang sudah menit-menitan lalu memang
//    sudah tidak relevan lagi kalau proses restart), diproses SEGERA supaya
//    percakapan tetap responsif.
//  - notification: pengiriman proaktif (notifikasi admin, hasil lab, reminder,
//    dll) -- persisten (lib/queue/store.mjs), diberi jeda acak + simulasi
//    mengetik supaya polanya manusiawi, dengan retry/backoff kalau gagal.
//
// Urutan loop PENTING: jalur interactive dicek di SETIAP iterasi, termasuk
// menyela jeda (delay) yang sedang berjalan untuk item notification -- supaya
// balasan live paling lama menunggu satu pengiriman yang sedang di tengah
// jalan (hitungan detik), BUKAN ikut menunggu jeda 5-20 detik milik jalur
// notification.
import { EventEmitter } from "node:events";
import pkg from "whatsapp-web.js";
import { client } from "../whatsapp/client.mjs";
import { WA_FOOTER } from "../whatsapp/footer.mjs";
import * as store from "./store.mjs";
import { reportOutreachSent } from "../api/outreach.mjs";

const { MessageMedia, Poll } = pkg;

const NOTIFY_DELAY_MIN_MS = Number(process.env.NOTIFY_DELAY_MIN_MS || 5000);
const NOTIFY_DELAY_MAX_MS = Number(process.env.NOTIFY_DELAY_MAX_MS || 20000);
// Lane 'priority' (OTP & pesan transaksional 1-ke-1): jeda jauh lebih pendek
// dari lane 'bulk', TAPI tidak nol -- tetap ada variasi kecil supaya tidak
// terlihat instan-beruntun sempurna (pola robotik justru lebih gampang
// terdeteksi daripada jeda manusiawi yang pendek).
const NOTIFY_PRIORITY_DELAY_MIN_MS = Number(process.env.NOTIFY_PRIORITY_DELAY_MIN_MS || 1000);
const NOTIFY_PRIORITY_DELAY_MAX_MS = Number(process.env.NOTIFY_PRIORITY_DELAY_MAX_MS || 3000);
const NOTIFY_RATE_LIMIT_PER_MINUTE = Number(
  process.env.NOTIFY_RATE_LIMIT_PER_MINUTE || 6,
);
const LOOP_IDLE_MS = 1000;
// Backoff bertahap: 30dtk, 2mnt, 10mnt, 30mnt, 1jam (dipakai berurutan sesuai
// nomor percobaan ke berapa, percobaan terakhir dipakai berulang kalau
// maxAttempts diset lebih besar dari panjang array ini).
const BACKOFF_MS = [30_000, 120_000, 600_000, 1_800_000, 3_600_000];

function notifyDelayMs(lane) {
  const [min, max] = lane === "priority"
    ? [NOTIFY_PRIORITY_DELAY_MIN_MS, NOTIFY_PRIORITY_DELAY_MAX_MS]
    : [NOTIFY_DELAY_MIN_MS, NOTIFY_DELAY_MAX_MS];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------- Jalur interaktif (in-memory) ----------
const interactiveQueue = [];
const interactiveSignal = new EventEmitter();

/**
 * @param {() => Promise<any>} sendFn - closure yang benar-benar memanggil
 *   whatsapp-web.js (mis. msgHandler.reply(...)) saat dieksekusi worker.
 * @returns {Promise<any>} resolve/reject mengikuti hasil sendFn().
 */
export function enqueueInteractive(sendFn) {
  return new Promise((resolve, reject) => {
    interactiveQueue.push({ send: sendFn, resolve, reject });
    interactiveSignal.emit("push");
  });
}

async function processOneInteractive() {
  const job = interactiveQueue.shift();
  if (!job) return;
  try {
    const result = await job.send();
    job.resolve(result);
  } catch (error) {
    console.error("❌ Gagal proses item interaktif:", error.message || error);
    job.reject(error);
  }
}

// ---------- Jalur notifikasi (persisten) ----------
/**
 * @param {{kind:'text'|'media'|'group', to:string, message:string, media?:object}} draft
 * @returns {Promise<true|null>} true kalau berhasil MASUK ANTREAN (bukan
 *   berhasil TERKIRIM -- lihat catatan di sender.mjs soal perubahan semantik
 *   ini). null kalau gagal ditulis ke penyimpanan (mis. disk penuh).
 */
export async function enqueueNotification(draft) {
  try {
    store.addItem(draft);
    return true;
  } catch (error) {
    console.error("❌ Gagal memasukkan notifikasi ke antrean:", error.message || error);
    return null;
  }
}

export function getQueueStatus() {
  return store.summary();
}

// Delay yang bisa disela ('interrupted') begitu ada item interactive baru --
// dipakai untuk jeda manusiawi jalur notification supaya balasan live tidak
// ikut tertahan sampai 20 detik.
function interruptibleDelay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, ms);
    function onPush() {
      cleanup();
      resolve(true);
    }
    function cleanup() {
      clearTimeout(timer);
      interactiveSignal.off("push", onPush);
    }
    interactiveSignal.once("push", onPush);
  });
}

// Sliding window sederhana utk batas laju/menit (circuit breaker lonjakan,
// mis. banyak alert stok reagen sekaligus).
const sendTimestamps = [];
function rateLimitOk() {
  const now = Date.now();
  const windowStart = now - 60_000;
  while (sendTimestamps.length && sendTimestamps[0] < windowStart) {
    sendTimestamps.shift();
  }
  return sendTimestamps.length < NOTIFY_RATE_LIMIT_PER_MINUTE;
}
function recordSend() {
  sendTimestamps.push(Date.now());
}

/**
 * Pengiriman nyata (satu-satunya tempat yang panggil client.sendMessage()
 * untuk jalur notification). Pola defensif getChatById()+sendStateTyping()
 * DIPAKAI ULANG dari NotifyAdminController.mjs/client.mjs yang sudah terbukti
 * aman -- gagal indikator mengetik TIDAK BOLEH menggagalkan pengiriman asli.
 */
async function performRawSend(item) {
  const isGroup = item.kind === "group";
  const number = isGroup
    ? item.to
    : item.to.includes("@c.us")
      ? item.to
      : `${item.to}@c.us`;

  try {
    const chat = await client.getChatById(number);
    if (chat) await chat.sendStateTyping();
  } catch (error) {
    console.error("⚠️ Gagal set typing indicator (diabaikan):", error.message || error);
  }

  const fullMessage = item.message + WA_FOOTER;

  if (item.kind === "outreach") {
    return sendOutreach(item, number, fullMessage);
  }

  if (item.kind === "media") {
    const media = new MessageMedia(
      item.media.mimetype,
      item.media.base64,
      item.media.filename,
    );
    const result = await client.sendMessage(number, media, { caption: fullMessage });
    // client.sendMessage() bisa resolve undefined walau pesan SUDAH terkirim
    // (bug dikenal whatsapp-web.js) -- jangan andalkan truthy-ness result.
    return result || true;
  }

  const result = await client.sendMessage(number, fullMessage);
  return result || true;
}

/**
 * Ajakan Prolanis: teks dulu, lalu polling SUDAH/BELUM beberapa detik
 * kemudian (seperti orang yang menulis lalu menambahkan pilihan). Kalau
 * polling gagal setelah teks terkirim, item TETAP dianggap terkirim supaya
 * teks tidak terkirim dua kali saat dicoba ulang; pasien masih bisa
 * menjawab dengan mengetik SUDAH/BELUM.
 */
async function sendOutreach(item, number, fullMessage) {
  // Nomor pasien belum tentu punya WhatsApp. Mengirim ke nomor yang tidak
  // terdaftar juga pola yang dicurigai, jadi dicek dulu dan tidak diulang.
  const wid = await client.getNumberId(item.to);
  if (!wid) {
    const error = new Error("Nomor tidak terdaftar di WhatsApp");
    error.permanent = true;
    throw error;
  }
  number = wid._serialized || number;
  const sent = await client.sendMessage(number, fullMessage);
  const result = {
    ok: true,
    messageId: sent?.id?._serialized || null,
    chatId: sent?.id?.remote || number,
    pollMessageId: null,
  };
  if (item.poll?.question && Array.isArray(item.poll.options) && item.poll.options.length >= 2) {
    await new Promise((r) => setTimeout(r, 1800 + Math.floor(Math.random() * 1800)));
    try {
      const poll = new Poll(item.poll.question, item.poll.options, { allowMultipleAnswers: false });
      const pollMsg = await client.sendMessage(number, poll);
      result.pollMessageId = pollMsg?.id?._serialized || null;
    } catch (error) {
      console.error(`⚠️ Polling outreach ke ${item.to} gagal (teks sudah terkirim):`, error.message || error);
    }
  }
  return result;
}

let running = false;

async function loop() {
  while (running) {
    if (interactiveQueue.length > 0) {
      await processOneInteractive();
      continue;
    }

    const nextItem = store.nextPending();
    if (!nextItem || !rateLimitOk()) {
      await interruptibleDelay(LOOP_IDLE_MS);
      continue;
    }

    store.updateItem(nextItem.id, { status: "processing" });

    const interrupted = await interruptibleDelay(notifyDelayMs(nextItem.lane));
    if (interrupted) {
      // Balasan live masuk di tengah jeda -- kembalikan item ke pending
      // (tempat antreannya tidak hilang) dan proses interactive dulu.
      store.updateItem(nextItem.id, { status: "pending" });
      continue;
    }

    try {
      if (!client.info) throw new Error("Client WhatsApp belum siap!");
      recordSend();
      const sendResult = await performRawSend(nextItem);
      if (nextItem.kind === "outreach") reportOutreachSent(nextItem, sendResult);
      store.updateItem(nextItem.id, {
        status: "done",
        sentAt: new Date().toISOString(),
      });
      console.log(`✅ Notifikasi terkirim ke ${nextItem.to} (${nextItem.kind})`);
    } catch (error) {
      const attempts = error.permanent ? nextItem.maxAttempts : nextItem.attempts + 1;
      if (attempts >= nextItem.maxAttempts) {
        store.updateItem(nextItem.id, {
          status: "failed",
          attempts,
          lastError: error.message || String(error),
        });
        console.error(
          `❌ Notifikasi ke ${nextItem.to} gagal PERMANEN setelah ${attempts} percobaan:`,
          error.message || error,
        );
        if (nextItem.kind === "outreach") {
          reportOutreachSent(nextItem, { ok: false, error: error.message || String(error) });
        }
      } else {
        const backoffMs = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
        store.updateItem(nextItem.id, {
          status: "pending",
          attempts,
          lastError: error.message || String(error),
          nextAttemptAt: new Date(Date.now() + backoffMs).toISOString(),
        });
        console.warn(
          `⚠️ Gagal kirim ke ${nextItem.to} (percobaan ${attempts}/${nextItem.maxAttempts}), coba lagi dalam ${Math.round(backoffMs / 1000)}dtk:`,
          error.message || error,
        );
      }
    }
  }
}

export function startWorker() {
  if (running) return;
  running = true;
  store.initStore();
  loop().catch((error) => {
    console.error("❌ Worker antrean berhenti tak terduga:", error.message || error);
    running = false;
  });
}
