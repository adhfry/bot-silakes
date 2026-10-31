// lib/api/outreach.mjs
//
// Pesan ajakan Prolanis CFD dari SiLAKES (kind:'outreach' di antrean):
// laporan "sudah terkirim" dan jawaban pasien (polling atau teks SUDAH/BELUM/
// BERHENTI) dikirim balik ke SiLAKES. Header X-API-Key memakai INTERNAL_API_KEY
// yang sama dengan yang SiLAKES pakai untuk memanggil bot (lihat
// VerifyBotCallback di SiLAKES), jadi tidak ada kunci baru.
import axios from "axios";
import { client } from "../whatsapp/client.mjs";
import { enqueueInteractive } from "../queue/index.mjs";
import { SINTA_FOOTER } from "../whatsapp/footer.mjs";
import { delay } from "../helper/delay.mjs";

const base = () => `${process.env.LARAVEL_API_BASE_URL}/outreach`;
const headers = () => ({ "X-API-Key": process.env.INTERNAL_API_KEY || "" });

// Kata kunci jawaban: pesan pendek saja, supaya obrolan biasa tidak terbaca
// sebagai jawaban. Penentuan akhirnya tetap di SiLAKES (parseReply).
const REPLY_WORDS = /\b(sudah|sdh|udah|udh|sudh|suda|belum|blm|blum|belom|blom|berhenti|stop|henti)\b/i;

export function looksLikeOutreachReply(text) {
  const t = (text || "").trim();
  return t.length > 0 && t.length <= 40 && !t.startsWith("#") && REPLY_WORDS.test(t);
}

async function post(path, payload, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const { data } = await axios.post(`${base()}${path}`, payload, { headers: headers(), timeout: 10000 });
      return data;
    } catch (error) {
      const status = error.response?.status;
      console.error(`⚠️ Laporan outreach ${path} gagal (percobaan ${i}/${attempts}):`, status || error.message);
      // 4xx = ditolak (kunci salah / data tidak valid), tidak ada gunanya diulang.
      if (status && status < 500) return null;
      if (i < attempts) await delay(2000 * i);
    }
  }
  return null;
}

/** Dipanggil worker setelah teks + polling terkirim, atau gagal permanen. */
export function reportOutreachSent(item, result) {
  if (!item.ref) return;
  post("/sent", {
    ref: Number(item.ref),
    status: result.ok ? "sent" : "failed",
    message_id: result.messageId || null,
    poll_message_id: result.pollMessageId || null,
    chat_id: result.chatId || null,
    error: result.error || null,
  }).catch(() => {});
}

/** "628xxx@c.us" -> "628xxx"; "xxx@lid" dicoba dipetakan ke nomor HP. */
export async function phoneOf(waId) {
  if (!waId) return null;
  if (waId.endsWith("@c.us")) return waId.replace(/\D+/g, "");
  if (waId.endsWith("@lid")) {
    try {
      const [hit] = await client.getContactLidAndPhone([waId]);
      if (hit?.pn) return hit.pn.replace(/\D+/g, "");
    } catch (error) {
      console.error("⚠️ Gagal memetakan LID ke nomor:", error.message || error);
    }
  }
  return null;
}

function sendAck(chatId, text) {
  if (!text) return;
  enqueueInteractive(() => client.sendMessage(chatId, text + SINTA_FOOTER)).catch((error) => {
    console.error("❌ Gagal mengirim balasan outreach:", error.message || error);
  });
}

/** Jawaban teks. Mengembalikan true kalau pesan ini memang jawaban ajakan Prolanis. */
export async function handleOutreachText(message) {
  if (message.from.endsWith("@g.us") || !looksLikeOutreachReply(message.body)) return false;

  let quotedId = null;
  if (message.hasQuotedMsg) {
    try {
      const quoted = await message.getQuotedMessage();
      if (quoted?.fromMe) quotedId = quoted.id?._serialized || null;
    } catch {
      // pesan kutipan bisa sudah terhapus; cocokkan lewat nomor saja
    }
  }

  const res = await post("/reply", {
    type: "text",
    from: message.from,
    phone: await phoneOf(message.from),
    quoted_message_id: quotedId,
    text: message.body,
  }, 2);

  const data = res?.data;
  if (!data?.matched) return false;
  sendAck(message.from, data.ack);
  return true;
}

/** Jawaban polling (event vote_update). */
export async function handleOutreachVote(vote) {
  try {
    const parent = vote.parentMessage;
    const parentId = parent?.id?._serialized || vote.parentMsgKey?._serialized;
    if (!parentId || !parent?.fromMe) return;
    const chatId = parent.id?.remote || vote.voter;
    const option = vote.selectedOptions?.[0]?.name || "";

    const res = await post("/reply", {
      type: "poll",
      from: vote.voter,
      phone: await phoneOf(vote.voter),
      parent_message_id: parentId,
      option,
    }, 2);

    const data = res?.data;
    if (data?.matched && data.ack) sendAck(typeof chatId === "string" ? chatId : chatId?._serialized, data.ack);
  } catch (error) {
    console.error("❌ Gagal memproses jawaban polling:", error.message || error);
  }
}
