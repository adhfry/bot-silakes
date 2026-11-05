// lib/whatsapp/jaspelPrivacy.mjs
//
// Chat tentang jaspel (rapor & nominal, pengajuan ke admin, jaspel dibayarkan,
// pengumuman pencairan, balasan SINTA soal jaspel) tetap DIKIRIM, lalu langsung
// "hapus untuk saya" di akun bot supaya nominal jaspel pegawai tidak tertinggal
// di HP/WhatsApp Web bot (keputusan pemilik sistem 2026-11-06). Penerima tetap
// melihat pesannya; ini BUKAN "hapus untuk semua".
//
// - Pesan bot: dihapus beberapa detik setelah sampai di server WhatsApp (ack >= 1),
//   karena menghapus pesan yang belum terkirim bisa membatalkan pengirimannya.
// - Pesan masuk: dihapus setelah jeda, supaya SINTA sempat membalas sambil mengutipnya.
// - Sapu bersih: saat bot siap, chat yang sudah ada diperiksa sekali.
// Semua penghapusan lewat worker (single-flight) tanpa menyela jeda notifikasi.
import { enqueueQuiet } from "../queue/index.mjs";
import { findMessages, deleteMessageById, activeChatIds } from "./pageMessages.mjs";

const JASPEL_RE = /jaspel|jasa\s+pelayanan|remunerasi/i;
const OWN_AFTER_ACK_MS = 3_000;
const OWN_FALLBACK_MS = 10 * 60_000;
const INCOMING_DELAY_MS = 6 * 60_000; // jawaban SINTA bisa butuh ~2,5 menit + mengetik
const SWEEP_START_DELAY_MS = Number(process.env.JASPEL_SWEEP_DELAY_MS || 10 * 60_000);
const SWEEP_DAYS = Number(process.env.JASPEL_SWEEP_DAYS || 150);
const SWEEP_LOADS_PER_CHAT = Number(process.env.JASPEL_SWEEP_LOADS || 15);

export function isJaspelText(text) {
  return JASPEL_RE.test(String(text || ""));
}

/** Isi pesan atau pesan yang dikutipnya (balasan SINTA mengutip pertanyaan jaspel). */
export function isJaspelMessage(msg) {
  return isJaspelText(msg?.body) || isJaspelText(msg?._data?.quotedMsg?.body) || isJaspelText(msg?._data?.caption);
}

const handled = new Set();
const waitingAck = new Map(); // id pesan bot -> { msg, timer }

function idOf(msg) {
  return msg?.id?._serialized || null;
}

function removeForMe(msg, why) {
  const id = idOf(msg);
  if (!id || handled.has(id)) return;
  handled.add(id);
  if (handled.size > 5000) handled.delete(handled.values().next().value);
  run(id, why);
}

function removeById(id, why) {
  if (!id || handled.has(id)) return;
  handled.add(id);
  run(id, why);
}

function run(id, why) {
  enqueueQuiet(() => deleteMessageById(id, false))
    .then(() => console.log(`🧹 Pesan jaspel dihapus untuk bot (${why})`))
    .catch((error) => {
      handled.delete(id);
      console.warn(`⚠️ Gagal menghapus pesan jaspel (${why}):`, error.message || error);
    });
}

function scheduleOwn(msg) {
  const id = idOf(msg);
  if (!id || handled.has(id) || waitingAck.has(id)) return;
  if ((msg.ack ?? 0) >= 1) {
    setTimeout(() => removeForMe(msg, "terkirim"), OWN_AFTER_ACK_MS);
    return;
  }
  const timer = setTimeout(() => {
    waitingAck.delete(id);
    removeForMe(msg, "batas tunggu");
  }, OWN_FALLBACK_MS);
  waitingAck.set(id, { msg, timer });
}

async function sweep() {
  const sinceSec = Math.floor(Date.now() / 1000) - SWEEP_DAYS * 86400;
  let chatIds = [];
  try {
    chatIds = await enqueueQuiet(() => activeChatIds(sinceSec));
  } catch (error) {
    console.warn("⚠️ Sapu chat jaspel: gagal membaca daftar chat:", error.message || error);
    return;
  }
  let total = 0;
  const errors = [];
  // Per chat (bukan sekaligus) supaya antrean kirim tidak tertahan lama.
  for (const chatId of chatIds) {
    try {
      const found = await enqueueQuiet(() => findMessages({ regex: JASPEL_RE.source, sinceSec, maxLoads: SWEEP_LOADS_PER_CHAT, chatIds: [chatId] }));
      errors.push(...found.errors);
      for (const id of found.ids) removeById(id, "sapu bersih");
      total += found.ids.length;
    } catch (error) {
      errors.push(error.message || String(error));
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`🧹 Sapu chat jaspel: ${chatIds.length} chat diperiksa, ${total} pesan jaspel diantrekan untuk dihapus.${errors.length ? ` Galat (${errors.length}): ${errors.slice(0, 3).join("; ")}` : ""}`);
}

let installed = false;
export function installJaspelPrivacy(client) {
  if (installed) return;
  installed = true;

  client.on("message_create", (msg) => {
    if (!isJaspelMessage(msg)) return;
    if (msg.fromMe) scheduleOwn(msg);
    else setTimeout(() => removeForMe(msg, "pesan masuk"), INCOMING_DELAY_MS);
  });

  client.on("message_ack", (msg, ack) => {
    const id = idOf(msg);
    const entry = id && waitingAck.get(id);
    if (!entry || ack < 1) return;
    clearTimeout(entry.timer);
    waitingAck.delete(id);
    setTimeout(() => removeForMe(entry.msg, "terkirim"), OWN_AFTER_ACK_MS);
  });

}

/** Dipanggil worker dengan pesan yang baru dikirim (jalan juga saat event message_create tidak terdengar). */
export function trackSentMessage(msg, text) {
  if (msg && typeof msg === "object" && msg.id && (isJaspelText(text) || isJaspelMessage(msg))) scheduleOwn(msg);
}

let swept = false;
/** Sapu bersih sekali per proses, beberapa saat setelah WhatsApp siap. */
export function startJaspelSweep(client) {
  if (swept) return;
  swept = true;
  setTimeout(() => sweep(), SWEEP_START_DELAY_MS);
}
