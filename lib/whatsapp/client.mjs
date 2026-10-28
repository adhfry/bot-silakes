import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import {
  handleIncomingMessage,
  handlePreviewMessage,
  handleReplyChatMessage,
} from "./handler/index.mjs";
import { delay, randomDelay } from "../helper/delay.mjs";
import {
  handleApproveChannel,
  handleInitNotificationChannel,
  handleSetDailyReminder,
} from "./handler/notificationChannel.mjs";
import { handleOutreachText, handleOutreachVote } from "../api/outreach.mjs";

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "silakes-bot", // ID klien untuk menyimpan sesi
  }), // simpan sesi di folder .wwebjs_auth
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // 45 detik ke atas dianggap macet untuk panggilan RUNTIME (kirim pesan dll). TAPI angka
    // ini berlaku untuk SEMUA panggilan protokol Puppeteer, termasuk yang dipakai internal
    // whatsapp-web.js saat initialize() (inject script, tunggu window.Store siap, sinkron
    // chat) -- proses itu bisa saja butuh lebih dari 45 detik terutama saat sesi belum
    // tersimpan (LocalAuth) atau mesin sedang lambat. Dinaikkan ke 120 detik supaya startup
    // tidak ikut kena watchdog timeout ini, sambil tetap jauh lebih cepat gagal dibanding
    // default Puppeteer (180 detik) untuk kasus Chrome benar-benar macet saat runtime.
    protocolTimeout: 120000,
  },
});

let isReady = false;
let consecutiveUnhealthyChecks = 0;
const MAX_UNHEALTHY_CHECKS = 3;
const HEALTHCHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 menit
const HEALTHCHECK_TIMEOUT_MS = 20000;
const STARTUP_READY_TIMEOUT_MS = 3 * 60 * 1000; // 3 menit

// Kalau event "ready" tidak pernah muncul setelah autentikasi (initialize() macet diam-diam
// saat sinkronisasi, atau reject tapi rejection-nya cuma ditelan oleh handler
// unhandledRejection di bawah), proses akan idle selamanya tanpa status jelas -- watchdog ini
// memastikan proses tetap dipaksa keluar supaya PM2/nodemon mencoba ulang dari awal.
// SENGAJA tidak diaktifkan sejak awal proses: pertama kali setup, pengguna perlu scan QR
// secara manual dan itu bisa lebih dari 3 menit -- itu bukan hang, jadi tidak boleh dianggap
// macet. Baru diaktifkan begitu "authenticated" (sesi diterima, baik dari scan baru maupun
// sesi tersimpan) dan direset tiap ada progres sinkronisasi ("loading_screen") sebagai heartbeat.
let startupReadyTimer = null;
function armStartupReadyTimer() {
  clearTimeout(startupReadyTimer);
  startupReadyTimer = setTimeout(() => {
    console.error(
      `❌ WhatsApp belum "ready" dalam ${STARTUP_READY_TIMEOUT_MS / 1000} detik sejak autentikasi/progres terakhir, restart proses...`
    );
    process.exit(1);
  }, STARTUP_READY_TIMEOUT_MS);
}

// Event "ready" TERBUKTI tidak selalu muncul walau client sudah fungsional -- pernah kejadian
// nyata: loading_screen mentok di 99%, event "ready" tidak pernah tercetak, tapi pesan WA
// tetap berhasil terkirim (client.info sudah terisi). Watchdog startup yang cuma menunggu
// event "ready" jadi salah paksa restart proses yang sebenarnya sehat. Jadi di sini
// kesiapan diputuskan dari BUKTI fungsional (client.info terisi), bukan cuma event -- dicek
// tiap POLL_READY_INTERVAL_MS sejak "authenticated" sebagai fallback kalau event tidak muncul.
const POLL_READY_INTERVAL_MS = 5000;
let pollReadyInterval = null;

function markReady(source) {
  if (isReady) return;
  isReady = true;
  consecutiveUnhealthyChecks = 0;
  clearTimeout(startupReadyTimer);
  clearInterval(pollReadyInterval);
  console.log(`✅ WhatsApp siap digunakan! (${source})`);
}

client.on("qr", (qr) => {
  console.log("📱 Scan QR code berikut:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("🔐 WhatsApp terautentikasi, menyinkronkan sesi...");
  armStartupReadyTimer();
  clearInterval(pollReadyInterval);
  pollReadyInterval = setInterval(() => {
    if (client.info) markReady("terdeteksi via client.info, event ready tidak muncul");
  }, POLL_READY_INTERVAL_MS);
});

client.on("loading_screen", (percent, message) => {
  console.log(`⏳ Memuat WhatsApp Web: ${percent}% - ${message}`);
  armStartupReadyTimer();
});

client.on("ready", () => {
  markReady("event ready");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Gagal autentikasi:", msg);
});

// SEBELUMNYA cuma di-log, TIDAK ADA pemulihan otomatis -- WA bisa mati total sampai ada yang
// restart PM2 manual (keluhan user: harus restart pm2 bot-wa terus-menerus). Sesi Puppeteer
// yang sudah disconnect TIDAK bisa dipercaya untuk di-reinitialize di tempat (state Chrome bisa
// korup separuh) -- exit proses & biarkan PM2 (restart policy default: always) membuatkan sesi
// baru dari nol jauh lebih andal daripada mencoba reconnect manual di sini.
client.on("disconnected", (reason) => {
  console.log("⚠️ WhatsApp terputus:", reason, "-- restart proses untuk membuat sesi baru...");
  isReady = false;
  process.exit(1);
});

// Watchdog: kalau Chrome/Puppeteer macet TOTAL (beda dari WA disconnect biasa yang sudah
// ditangani event di atas) -- client.info bisa saja masih ada tapi panggilan apa pun ke Chrome
// hang selamanya, persis pola "Runtime.callFunctionOn timed out" di log produksi. Dicek berkala
// pakai operasi ringan (getState(), yang tetap lewat Puppeteer) dengan timeout ketat sendiri --
// kalau gagal beberapa kali berturut-turut, paksa keluar supaya PM2 membuatkan sesi baru.
setInterval(async () => {
  if (!isReady) return;
  try {
    await Promise.race([
      client.getState(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("watchdog timeout")), HEALTHCHECK_TIMEOUT_MS)
      ),
    ]);
    consecutiveUnhealthyChecks = 0;
  } catch (error) {
    consecutiveUnhealthyChecks++;
    console.error(
      `⚠️ Watchdog: pengecekan kesehatan WhatsApp gagal (${consecutiveUnhealthyChecks}/${MAX_UNHEALTHY_CHECKS}):`,
      error.message
    );
    if (consecutiveUnhealthyChecks >= MAX_UNHEALTHY_CHECKS) {
      console.error("❌ Watchdog: Chrome/Puppeteer dianggap macet total, restart proses...");
      process.exit(1);
    }
  }
}, HEALTHCHECK_INTERVAL_MS);

// Exception yang tidak tertangkap di mana pun bisa meninggalkan proses jadi "zombie" (masih
// hidup di mata PM2, tapi sudah tidak fungsional) -- log dulu supaya kelihatan di
// bot-wa-error.log, exit kalau benar-benar fatal (uncaughtException) supaya PM2 restart bersih.
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

client.on("message", async (message) => {
  if (message.fromMe) return;
  await delay(randomDelay());
  // simulasi "typing..." -- gagal (mis. getChatById error di beberapa tipe chat/status)
  // TIDAK BOLEH menghentikan proses pesan, jadi errornya ditelan di sini saja.
  try {
    const chat = await message.getChat();
    await chat.sendStateTyping();
  } catch (error) {
    console.error("⚠️ Gagal set typing indicator (diabaikan):", error.message || error);
  }

  const typingDelay = Math.min(15000, message.body.length * 120);
  await delay(typingDelay);

  // --------------------------------------------------------
  // FITUR BARU: Notify otomatis
  // --------------------------------------------------------
  if (message.body.toUpperCase() === "#INIT-NOTIFICATION-CHANNEL") {
    await handleInitNotificationChannel(message);
  }
  if (message.body.toUpperCase() === "#APPROVE-CHANNEL") {
    await handleApproveChannel(message);
  }
  if (message.body.toUpperCase().startsWith("#SET-DAILY-REMINDER")) {
    await handleSetDailyReminder(message);
  }

  // Jawaban ajakan Prolanis (SUDAH / BELUM / BERHENTI). Kalau memang jawaban,
  // berhenti di sini supaya tidak ikut diproses alur lain.
  if (await handleOutreachText(message).catch(() => false)) {
    return;
  }

  //untuk reply pesan
  if (message.hasQuotedMsg) {
    const quoted = await message.getQuotedMessage();
    // khusus yang di reply === chat
    if (quoted.type === "chat") {
      await handleReplyChatMessage(message);
    }
  }

  // untuk pesan with #ai
  if (message.body?.startsWith("#ai")) {
    console.log("📩 Pesan #ai diterima:", message.body);
    await handleIncomingMessage(message);
  }
  // untuk pesan with #preview
  if (message.body?.startsWith("#preview")) {
    console.log("📩 Pesan #preview diterima:", message.body);
    await handlePreviewMessage(message);
  }
});

// Jawaban polling ajakan Prolanis.
client.on("vote_update", (vote) => {
  handleOutreachVote(vote);
});

// initialize() TIDAK boleh dibiarkan tanpa .catch() -- kalau reject (mis. protocolTimeout
// saat startup), rejection-nya sebelumnya cuma tertelan diam-diam oleh handler
// unhandledRejection di atas dan proses nyangkut selamanya tanpa pernah "ready" ataupun
// restart. Sekarang gagal-nya jelas kelihatan di log dan proses langsung diakhiri supaya
// systemd (Restart=always) mencoba ulang dari awal.
//
// SENGAJA dibungkus fungsi, TIDAK dipanggil otomatis saat modul ini diimpor -- app.mjs
// (dipakai bin/route-list.mjs untuk introspeksi route) mengimpor rantai modul yang
// akhirnya sampai ke client.mjs ini juga, dan TIDAK BOLEH ikut membuka sesi
// Puppeteer/Chrome sungguhan cuma untuk mencetak daftar route. Hanya index.mjs (proses
// yang benar-benar dijalankan systemd) yang memanggil startWhatsAppClient().
let started = false;
export function startWhatsAppClient() {
  if (started) return;
  started = true;
  client.initialize().catch((error) => {
    console.error("❌ Gagal initialize WhatsApp client:", error.message || error);
    process.exit(1);
  });
}

export { client };
