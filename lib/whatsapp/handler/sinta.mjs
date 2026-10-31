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

const url = () => `${process.env.LARAVEL_API_BASE_URL}/sinta/chat`;
const headers = () => ({ "X-API-Key": process.env.INTERNAL_API_KEY || "" });

const TRIGGER = /(^|[\s,.;:!?("'])[@/.]?sinta\b/i;
const SINTA_MARK = "SiLAKES Intelligence for Notifications";

// Jendela lanjutan per nomor: usulan menunggu YA/BATAL (15 menit, sama dengan
// masa berlaku usulan di SiLAKES) atau SINTA baru saja bertanya (5 menit).
const WINDOW_MS = { confirm: 15 * 60 * 1000, answer: 5 * 60 * 1000 };
const open = new Map();

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

/** Mengembalikan true bila pesan ini ditangani SINTA (alur lain tidak perlu memprosesnya). */
export async function handleSintaMessage(message) {
  const from = message.from || "";
  if (from.endsWith("@g.us") || from === "status@broadcast" || message.type !== "chat") return false;
  const text = (message.body || "").trim();
  if (!text || text.startsWith("#")) return false;

  const quoted = await quotedSinta(message);
  const win = open.get(from);
  const inWindow = win && win.until > Date.now();
  if (!callsSinta(text) && !quoted && !inWindow) return false;

  const chat = await message.getChat().catch(() => null);
  const typing = setInterval(() => chat?.sendStateTyping().catch(() => {}), 20000);
  chat?.sendStateTyping().catch(() => {});

  let data = null;
  try {
    const res = await axios.post(url(), { phone: await phoneOf(from), text, quoted }, { headers: headers(), timeout: 150000 });
    data = res.data?.data || null;
  } catch (error) {
    console.error("❌ SINTA WhatsApp gagal:", error.response?.status || error.message);
    data = { reply: "Maaf, SINTA sedang tidak bisa dihubungi. Coba lagi sebentar lagi ya.", awaiting: null };
  } finally {
    clearInterval(typing);
    chat?.clearState().catch(() => {});
  }

  if (data?.awaiting && WINDOW_MS[data.awaiting]) {
    open.set(from, { until: Date.now() + WINDOW_MS[data.awaiting] });
  } else {
    open.delete(from);
  }
  if (!data?.reply) return true;

  await enqueueInteractive(() => message.reply(data.reply + SINTA_FOOTER)).catch((error) => {
    console.error("❌ Gagal mengirim balasan SINTA:", error.message || error);
  });
  return true;
}
