import pkg from "whatsapp-web.js";
import { sendChatWA, sendChatWAMedia } from "../whatsapp/sender.mjs";
const { MessageMedia } = pkg;

/**
 * Kontrak eksternal dipakai produli (WhatsappReminderChannel.php): POST
 * /send/chat-message/:apikey, body {phone, message, link_image}. Beda dari
 * SendMediaPatientController.mjs (idSurat -> unduh PDF dari SiLAKES) -- di sini link_image
 * sudah berupa URL gambar siap pakai, bukan perlu di-generate.
 */
export async function sendChatMessage(phone, message, linkImage) {
  if (!linkImage) {
    return sendChatWA(phone, message);
  }

  try {
    const media = await MessageMedia.fromUrl(linkImage, { unsafeMime: true });
    return await sendChatWAMedia(phone, message, media);
  } catch (error) {
    console.error("❌ Gagal mengunduh/mengirim link_image, kirim teks saja:", error.message);
    // Gambar gagal diambil/dikirim BUKAN alasan pesan tidak sampai sama sekali -- fallback ke
    // teks biasa supaya reminder tetap sampai ke penerima.
    return sendChatWA(phone, message);
  }
}
