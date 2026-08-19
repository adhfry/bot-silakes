import pkg from "whatsapp-web.js";
import { getPDF } from "../whatsapp/utils/PDFBuffer.mjs";
import { sendChatWAMedia } from "../whatsapp/sender.mjs";
const { MessageMedia } = pkg;

export async function sendPDF(to, message, idSurat) {
  try {
    const result = await getPDF(idSurat);
    if (!result) {
      console.error("❌ Gagal mengunduh PDF");
      return false;
    }
    const { buffer, contentType, fileName } = result;
    console.log("✅ PDF berhasil diunduh:", fileName, `(${buffer?.length ?? 0} bytes)`);
    if (!buffer) {
      console.error("❌ Gagal mengunduh PDF");
      return false;
    }
    const media = new MessageMedia(
      "application/pdf",
      buffer.toString("base64"),
      fileName
    );
    // BUG SEBELUMNYA: hasil sendChatWAMedia() diabaikan, fungsi ini SELALU return true walau
    // pengirimannya gagal (mis. Puppeteer timeout) -- pemanggil (SiLAKES) mengira sukses,
    // job tidak pernah di-retry, PDF tidak pernah benar-benar sampai. sendChatWAMedia()
    // sendiri return null kalau gagal (lihat sender.mjs), jadi cukup diteruskan sebagai boolean.
    const chatResult = await sendChatWAMedia(to, message, media);
    return !!chatResult;
  } catch (error) {
    console.error("❌ Gagal mengirim PDF ke pasien:", error.message);
    return false;
  }
}
