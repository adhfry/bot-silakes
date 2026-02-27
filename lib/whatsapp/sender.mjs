import { delay, randomDelay } from "../helper/delay.mjs";
import { client } from "./client.mjs";

const footer =
  "\n\n> *UPTD. Laboratorium Kesehatan Daerah Kabupaten Sumenep*\n> _SiLAKES Bot v2_";

/**
 * Mengirim pesan ke nomor WhatsApp
 */
export async function sendChatWA(to, message) {
  try {
    if (!client.info) {
      throw new Error("Client WhatsApp belum siap!");
    }
    await delay(randomDelay());
    const number = to.includes("@c.us") ? to : `${to}@c.us`;
    const chat = await client.sendMessage(number, message + footer);
    console.log("✅ Pesan berhasil dikirim ke:", to);
    return chat;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan:", error.message);
    return null;
  }
}

/**
 * Mengirim pesan ke id grup WhatsApp
 */
export async function sendGroupChatWA(groupId, message) {
  try {
    if (!client.info) {
      throw new Error("Client WhatsApp belum siap!");
    }
    const chat = await client.sendMessage(groupId, message + footer);
    console.log("✅ Pesan berhasil dikirim ke grup:", groupId);
    return chat;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan ke grup:", error.message);
    return null;
  }
}

/**
 * Mengirim pesan ke nomor WhatsApp dengan media
 */
export async function sendChatWAMedia(to, message, media) {
  try {
    if (!client.info) {
      throw new Error("Client WhatsApp belum siap!");
    }
    const msg = message + footer;
    const number = to.includes("@c.us") ? to : `${to}@c.us`;
    const chat = await client.sendMessage(number, media, {
      caption: msg,
    });
    console.log("✅ Pesan media berhasil dikirim ke:", to);
    return chat;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan media:", error.message);
    return null;
  }
}

/**
 * Reply chat wa
 */
export async function replyChatWA(msgHandler, message) {
  try {
    if (!client.info) {
      throw new Error("Client WhatsApp belum siap!");
    }
    const msg = message + footer;
    const chat = await msgHandler.reply(msg);
    console.log("✅ Pesan reply berhasil dikirim ke:", msgHandler.from);
    return chat;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan reply:", error.message);
    return null;
  }
}
