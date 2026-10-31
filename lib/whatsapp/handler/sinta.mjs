// lib/whatsapp/handler/sinta.mjs
//
// Obrolan SINTA lewat WhatsApp, khusus pegawai Labkesda. Bot hanya
// meneruskan pesan PRIBADI yang memanggil SINTA ("sinta", "@sinta",
// "/sinta", ".sinta", huruf besar/kecil bebas, di awal atau di tengah
// kalimat), balasan (kutipan) atas pesan SINTA, atau pesan lanjutan saat
// SINTA sedang menunggu jawaban (YA/BATAL untuk usulan, atau jawaban atas
// pertanyaannya). Verifikasi nomor pegawai, aturan akses, dan jawaban
// semuanya di SiLAKES (POST bot/v1/sinta/chat).
import axios from "axios";
import { enqueueInteractive } from "../../queue/index.mjs";
import { SINTA_FOOTER } from "../footer.mjs";
import { phoneOf } from "../../api/outreach.mjs";
import { exitIfBrowserGone } from "../client.mjs";
import { delay, randomDelay } from "../../helper/delay.mjs";
import { startTyping, typeBeforeSend } from "../typing.mjs";

const url = () => `${process.env.LARAVEL_API_BASE_URL}/sinta/chat`;
const headers = () => ({ "X-API-Key": process.env.INTERNAL_API_KEY || "" });

const TRIGGER = /(^|[\s,.;:!?("'])[@/.]?sinta\b/i;
const SINTA_MARK = "SiLAKES Intelligence for Notifications";

// Sesi percakapan per nomor: setelah SINTA menjawab, pesan lanjutan tanpa kata
// "sinta" tetap dilayani selama 5 menit (15 menit bila usulan menunggu YA/BATAL,
// sama dengan masa berlakunya di SiLAKES); tiap pesan baru memperpanjang sesi.
// Bila sesi habis, SINTA mengirim pesan penutup lalu keluar dari percakapan.
const SESSION_MS = { confirm: 15 * 60 * 1000, default: 5 * 60 * 1000 };
const open = new Map();

const LEAVE_TEXT =
  "Terima kasih telah menghubungi SINTA. Karena tidak ada pesan lanjutan, SINTA mengakhiri sesi percakapan ini.\n\n" +
  "Apabila Bapak/Ibu memerlukan bantuan kembali, silakan kirim pesan dengan menyertakan kata *SINTA*, " +
  "misalnya: _\"SINTA, tolong tampilkan jadwal saya besok.\"_";
const LEAVE_PENDING = "\n\nUsulan tindakan yang belum dikonfirmasi tidak dijalankan.";

function openSession(from, chat, awaiting) {
  clearTimeout(open.get(from)?.timer);
  const ms = awaiting === "confirm" ? SESSION_MS.confirm : SESSION_MS.default;
  const timer = setTimeout(() => {
    open.delete(from);
    const text = LEAVE_TEXT + (awaiting === "confirm" ? LEAVE_PENDING : "");
    enqueueInteractive(async () => {
      await typeBeforeSend(chat, text);
      return chat.sendMessage(text + SINTA_FOOTER);
    }).then(() => console.log(`👋 SINTA mengakhiri sesi dengan ${from}`)).catch((error) => {
      console.error("❌ Gagal mengirim pesan penutup SINTA:", error.message || error);
      exitIfBrowserGone(error);
    });
  }, ms);
  open.set(from, { until: Date.now() + ms, timer });
}

export function callsSinta(text) {
  return TRIGGER.test(text || "");
}

function stripFooter(text) {
  const i = text.indexOf("\n\n> *SINTA*");
  return (i >= 0 ? text.slice(0, i) : text).trim();
}

/** Pesan SINTA yang dikutip pegawai (null bila yang dikutip bukan pesan SINTA). */
async function quotedSinta(message) {
  if (!message.hasQuotedMsg) return null;
  try {
    const q = await message.getQuotedMessage();
    if (q?.fromMe && (q.body || "").includes(SINTA_MARK)) return stripFooter(q.body);
  } catch {
    // pesan kutipan bisa sudah terhapus
  }
  return null;
}

/**
 * Pesan ini untuk SINTA? Pesan pribadi berisi teks yang memanggil SINTA,
 * mengutip pesan SINTA, atau datang selama sesi percakapan SINTA masih terbuka.
 * Hasil pemeriksaan disimpan di message.sinta untuk handleSintaMessage().
 */
export async function isForSinta(message) {
  const from = message.from || "";
  if (from.endsWith("@g.us") || from === "status@broadcast" || message.type !== "chat") return false;
  const text = (message.body || "").trim();
  if (!text || text.startsWith("#")) return false;

  const quoted = await quotedSinta(message);
  const win = open.get(from);
  const inWindow = Boolean(win && win.until > Date.now());
  if (!callsSinta(text) && !quoted && !inWindow) return false;
  message.sinta = { text, quoted, inWindow };
  return true;
}

/**
 * Alur balasan seperti orang: jeda 3-5 detik lalu pesan dibaca, "sedang
 * mengetik" selama SiLAKES menyiapkan jawaban dan diteruskan sampai sesuai
 * panjang jawaban (typingDelay), lalu dikirim.
 */
export async function handleSintaMessage(message) {
  if (!message.sinta && !(await isForSinta(message))) return false;
  const { text, quoted, inWindow } = message.sinta;
  const from = message.from;
  console.log(`📩 Pesan SINTA dari ${from}${quoted ? " (membalas SINTA)" : inWindow ? " (lanjutan)" : ""}`);

  // Jawaban disiapkan sejak pesan masuk; jeda dan mengetik berjalan bersamaan.
  const answer = axios.post(url(), { phone: await phoneOf(from), text, quoted }, { headers: headers(), timeout: 150000 })
    .then((res) => res.data?.data || null)
    .catch((error) => {
      console.error("❌ SINTA WhatsApp gagal:", error.response?.status || error.message);
      return { reply: "Maaf, SINTA sedang tidak bisa dihubungi. Coba lagi sebentar lagi ya.", awaiting: null };
    });

  await delay(randomDelay(3000, 5000));
  const chat = await message.getChat().catch((error) => {
    exitIfBrowserGone(error);
    return null;
  });
  await chat?.sendSeen().catch(() => {});
  const typingFrom = Date.now();
  await startTyping(chat);
  // Status mengetik WhatsApp padam sendiri sekitar 25 detik: dinyalakan ulang.
  const typing = setInterval(() => startTyping(chat), 20000);

  let data;
  try {
    data = await answer;
    console.log(`🤖 SINTA menjawab ${from}: ${data?.outcome || "-"}${data?.awaiting ? `, menunggu ${data.awaiting}` : ""}`);
  } finally {
    clearInterval(typing);
  }
  // Mengetik diteruskan sampai sesuai panjang jawaban (dikurangi waktu menunggu jawaban).
  if (data?.reply) await typeBeforeSend(chat, data.reply, { pause: null, already: Date.now() - typingFrom });

  // Nomor yang tidak dikenali SiLAKES tidak dibukakan sesi.
  if (data?.outcome && data.outcome !== "tidak_dikenal" && chat) {
    openSession(from, chat, data.awaiting);
  } else {
    clearTimeout(open.get(from)?.timer);
    open.delete(from);
  }
  if (!data?.reply) {
    await chat?.clearState().catch(() => {});
    return true;
  }

  await enqueueInteractive(() => message.reply(data.reply + SINTA_FOOTER)).catch((error) => {
    console.error("❌ Gagal mengirim balasan SINTA:", error.message || error);
    exitIfBrowserGone(error);
  });
  return true;
}
