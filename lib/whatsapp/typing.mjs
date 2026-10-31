// lib/whatsapp/typing.mjs
//
// Gerbang SEMUA pesan keluar bot: jeda singkat seperti orang membaca, lalu
// "sedang mengetik" selama sebanding panjang pesan yang AKAN dikirim
// (typingDelay: 120 ms per karakter, paling lama 15 detik, paling sebentar
// 1,5 detik), baru pesan dikirim. Dipakai worker (notifikasi, grup, media,
// ajakan Prolanis), replyChatWA, balasan Prolanis, dan SINTA.
//
// Tujuan dipakai lewat ID-nya ("628xxx@c.us", "xxx@lid", "xxx@g.us"), bukan
// objek Chat: untuk akun berformat LID, message.getChat() dan
// client.getChatById() ditolak WA Web (galat "r", 31 Okt 2026) padahal
// mengirim pesan dan status mengetik lewat ID tetap bisa.
import { client } from "./client.mjs";
import { delay, randomDelay, typingDelay } from "../helper/delay.mjs";

const MIN_TYPING_MS = 1500;

/** "628xxx", "628xxx@c.us", "xxx@lid", atau objek Chat/Message -> ID chat. */
export function chatIdOf(target) {
  if (!target) return null;
  if (typeof target === "string") return target.includes("@") ? target : `${target}@c.us`;
  return target.id?._serialized || target.from || null;
}

/**
 * Nyalakan "sedang mengetik". WhatsApp hanya menampilkannya bila pengirim
 * berstatus online, sedangkan WA Web di Chrome tanpa layar dianggap tidak
 * aktif, jadi status online dinyalakan dulu setiap kali. Dipanggil langsung
 * dan ditunggu (Chat.sendStateTyping() tidak menunggu hasil di halaman,
 * jadi kegagalannya hilang).
 */
export async function startTyping(target) {
  const id = chatIdOf(target);
  if (!id) return;
  try {
    await client.sendPresenceAvailable();
    await client.pupPage.evaluate(async (chatId) => {
      await window.WWebJS.sendChatstate("typing", chatId);
    }, id);
  } catch (error) {
    console.error(`⚠️ Gagal menampilkan sedang mengetik ke ${id} (diabaikan):`, error?.message || error);
  }
}

/** Tandai pesan sudah dibaca (centang biru). */
export async function markSeen(target) {
  const id = chatIdOf(target);
  if (!id) return;
  await client.sendSeen(id).catch((error) => {
    console.error(`⚠️ Gagal menandai dibaca ${id} (diabaikan):`, error?.message || error);
  });
}

/**
 * @param {string|object|null} target - ID chat (atau Chat/Message); null: jeda tetap dijalankan tanpa indikator
 * @param {string} text - pesan yang akan dikirim (tanpa footer)
 * @param {{pause?: [number, number]|null, already?: number}} [opts]
 *   pause: jeda sebelum mengetik (null = tanpa jeda, mis. jeda sudah dijalankan pemanggil);
 *   already: lama mengetik yang sudah berjalan (ms), dikurangkan dari durasi.
 */
export async function typeBeforeSend(target, text, { pause = [1000, 2500], already = 0 } = {}) {
  if (pause) await delay(randomDelay(pause[0], pause[1]));
  const ms = Math.max(MIN_TYPING_MS, typingDelay(text)) - already;
  if (!chatIdOf(target)) {
    if (ms > 0) await delay(ms);
    return;
  }
  await startTyping(target);
  // Indikator mengetik WhatsApp padam sendiri sekitar 25 detik: dinyalakan ulang.
  const keep = setInterval(() => startTyping(target), 20000);
  try {
    if (ms > 0) await delay(ms);
  } finally {
    clearInterval(keep);
  }
}
