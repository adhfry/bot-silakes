import { client } from "./client.mjs";

/**
 * Mengirim pesan ke nomor WhatsApp
 * @param {string} to - Nomor tujuan, contoh: 6281234567890
 * @param {string} message - Isi pesan
 */
export async function sendChatWA(to, message) {
  try {
    if (!client.info) {
      throw new Error("Client WhatsApp belum siap!");
    }

    const number = to.includes("@c.us") ? to : `${to}@c.us`;
    const chat = await client.sendMessage(number, message);
    console.log("✅ Pesan berhasil dikirim ke:", to);
    return chat;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan:", error.message);
    return null;
  }
}
