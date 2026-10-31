// lib/whatsapp/typing.mjs
//
// Gerbang SEMUA pesan keluar bot: jeda singkat seperti orang membaca, lalu
// "sedang mengetik" selama sebanding panjang pesan yang AKAN dikirim
// (typingDelay: 120 ms per karakter, paling lama 15 detik, paling sebentar
// 1,5 detik), baru pesan dikirim. Dipakai worker (notifikasi, grup, media,
// ajakan Prolanis), replyChatWA, balasan Prolanis, dan SINTA.
import { delay, randomDelay, typingDelay } from "../helper/delay.mjs";

const MIN_TYPING_MS = 1500;

/**
 * @param {import('whatsapp-web.js').Chat|null} chat - null: jeda tetap dijalankan tanpa indikator
 * @param {string} text - pesan yang akan dikirim (tanpa footer)
 * @param {{pause?: [number, number]|null, already?: number}} [opts]
 *   pause: jeda sebelum mengetik (null = tanpa jeda, mis. jeda sudah dijalankan pemanggil);
 *   already: lama mengetik yang sudah berjalan (ms), dikurangkan dari durasi.
 */
export async function typeBeforeSend(chat, text, { pause = [1000, 2500], already = 0 } = {}) {
  if (pause) await delay(randomDelay(pause[0], pause[1]));
  const ms = Math.max(MIN_TYPING_MS, typingDelay(text)) - already;
  if (!chat) {
    if (ms > 0) await delay(ms);
    return;
  }
  await chat.sendStateTyping().catch(() => {});
  // Indikator mengetik WhatsApp padam sendiri sekitar 25 detik: dinyalakan ulang.
  const keep = setInterval(() => chat.sendStateTyping().catch(() => {}), 20000);
  try {
    if (ms > 0) await delay(ms);
  } finally {
    clearInterval(keep);
  }
}
