import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import {
  handleEditData,
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

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "silakes-bot", // ID klien untuk menyimpan sesi
  }), // simpan sesi di folder .wwebjs_auth
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // Default Puppeteer (~180 detik) bikin panggilan API menggantung lama sekali begitu
    // Chrome macet -- lebih baik gagal cepat lalu watchdog di bawah yang me-restart proses
    // penuh, daripada tiap percobaan kirim menunggu 3 menit (temuan analisis produksi: 37x
    // "Runtime.callFunctionOn timed out" tercatat di log dalam waktu singkat).
    protocolTimeout: 45000,
  },
});

let isReady = false;
let consecutiveUnhealthyChecks = 0;
const MAX_UNHEALTHY_CHECKS = 3;
const HEALTHCHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 menit
const HEALTHCHECK_TIMEOUT_MS = 20000;

client.on("qr", (qr) => {
  console.log("📱 Scan QR code berikut:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  isReady = true;
  consecutiveUnhealthyChecks = 0;
  console.log("✅ WhatsApp siap digunakan!");
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
  // simulasi "typing..."
  await message.getChat().then((chat) => chat.sendStateTyping());

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
  // untuk pesan edit data ktp dari pasien
  if (message.body?.startsWith("> 📝 *Data KTP Anda")) {
    console.log("📩 Pesan > 📝 Data KTP diterima:", message.body);
    await handleEditData(message);
  }
  // untuk pesan with #preview
  if (message.body?.startsWith("#preview")) {
    console.log("📩 Pesan #preview diterima:", message.body);
    await handlePreviewMessage(message);
  }
});

client.initialize();

export { client };
