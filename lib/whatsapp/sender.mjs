// lib/whatsapp/sender.mjs
//
// Titik masuk TUNGGAL untuk semua pengiriman WA di seluruh codebase --
// signature & semantik Promise setiap fungsi di sini SENGAJA dipertahankan
// sama seperti sebelumnya (Promise<result|null>) supaya SEMUA pemanggil yang
// sudah ada (NotifyAdminController.mjs, config.mjs, SendMediaPatientController.mjs,
// SendChatMessageController.mjs, notificationChannel.mjs, handler/*, route HTTP
// di routes/*.mjs) TIDAK PERLU diubah sama sekali.
//
// Yang berubah di balik layar: sendChatWA/sendChatWAMedia/sendGroupChatWA
// sekarang cuma MEMASUKKAN pesan ke antrean notifikasi (lib/queue/) --
// pengiriman NYATA (dengan jeda manusiawi + simulasi mengetik + retry/backoff)
// dilakukan satu per satu oleh worker tunggal (lib/queue/worker.mjs), supaya
// tidak pernah ada dua pengiriman berjalan bersamaan (whatsapp-web.js tidak
// menjamin aman untuk itu) dan polanya tidak gampang dikenali sebagai bot.
//
// PERUBAHAN SEMANTIK YANG DISENGAJA: fungsi-fungsi ini sekarang resolve begitu
// pesan BERHASIL MASUK ANTREAN (nyaris instan), BUKAN begitu benar-benar
// terkirim -- ini yang memperbaiki masalah Http::timeout(3) di sisi Laravel
// (BotHelper::sendToBot()) yang sebelumnya bisa timeout diam-diam kalau satu
// request memicu banyak pengiriman berurutan. Kegagalan kirim SUNGGUHAN
// dicatat di log worker + bisa dicek lewat GET /queue/status, bukan
// disurfacekan sinkron ke pemanggil (sudah dicek: tidak ada logika bisnis di
// Laravel yang bercabang berdasar isi respons bot, semua fire-and-forget
// lewat Job queue).
//
// replyChatWA() (balasan percakapan live) TIDAK ikut berubah semantik --
// tetap resolve setelah benar-benar terkirim, lewat jalur "interactive" di
// worker yang diproses segera (tidak kena jeda manusiawi jalur notifikasi).
import { enqueueNotification, enqueueInteractive } from "../queue/index.mjs";
import { WA_FOOTER } from "./footer.mjs";

/**
 * Mengirim pesan teks ke nomor WhatsApp (masuk antrean notifikasi).
 * @param {string} to
 * @param {string} message
 * @param {{lane?: 'priority'|'bulk'}} [options] - lane 'priority' utk pesan
 *   transaksional 1-ke-1 (OTP dst, jeda jauh lebih pendek); default 'bulk'.
 */
export async function sendChatWA(to, message, options = {}) {
  return enqueueNotification({ kind: "text", to, message, lane: options.lane });
}

/**
 * Mengirim pesan ke id grup WhatsApp (masuk antrean notifikasi).
 */
export async function sendGroupChatWA(groupId, message, options = {}) {
  return enqueueNotification({ kind: "group", to: groupId, message, lane: options.lane });
}

/**
 * Mengirim pesan ke nomor WhatsApp dengan media (masuk antrean notifikasi).
 * @param {string} to
 * @param {string} message
 * @param {import('whatsapp-web.js').MessageMedia} media
 * @param {{lane?: 'priority'|'bulk'}} [options]
 */
export async function sendChatWAMedia(to, message, media, options = {}) {
  return enqueueNotification({
    kind: "media",
    to,
    message,
    media: {
      mimetype: media.mimetype,
      base64: media.data,
      filename: media.filename,
    },
    lane: options.lane,
  });
}

/**
 * Balas pesan masuk (jalur interaktif -- diproses segera, tidak lewat jeda
 * manusiawi jalur notifikasi, supaya percakapan tetap responsif).
 */
export async function replyChatWA(msgHandler, message) {
  return enqueueInteractive(async () => {
    const chat = await msgHandler.reply(message + WA_FOOTER);
    console.log("✅ Pesan reply berhasil dikirim ke:", msgHandler.from);
    return chat || true;
  }).catch((error) => {
    console.error("❌ Gagal mengirim pesan reply:", error.message || error);
    return null;
  });
}
