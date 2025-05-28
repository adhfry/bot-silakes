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
    console.log("✅ PDF berhasil diunduh:", fileName);
    console.log("Buffer PDF:", buffer);
    if (!buffer) {
      console.error("❌ Gagal mengunduh PDF");
      return false;
    }
    const media = new MessageMedia(
      "application/pdf",
      buffer.toString("base64"),
      fileName
    );
    await sendChatWAMedia(to, message, media);
    return true;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan ke admin:", error.message);
    return false;
  }
}
