// lib/whatsapp/revoke.mjs
//
// Tarik pesan bot yang sudah terkirim: cari pesan milik bot (fromMe) di chat
// tujuan yang memuat SEMUA kata kunci, lalu hapus untuk semua (atau untuk bot
// saja). "Hapus untuk semua" hanya bisa dalam batas waktu WhatsApp (~2 hari).
import { client } from "./client.mjs";
import { enqueueQuiet } from "../queue/index.mjs";

export function chatIdOf(to) {
  const raw = String(to || "");
  if (raw.includes("@")) return raw;
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return `${digits}@c.us`;
}

/**
 * @param {{to: string[], contains: string[], everyone?: boolean, limit?: number, sinceMinutes?: number}} opts
 */
export async function revokeMessages({ to, contains, everyone = true, limit = 60, sinceMinutes = 2880 }) {
  const needles = (contains || []).map((s) => String(s).toLowerCase()).filter(Boolean);
  if (!needles.length) throw new Error("contains wajib diisi");
  const since = Date.now() / 1000 - sinceMinutes * 60;
  const results = [];
  for (const target of to || []) {
    const chatId = chatIdOf(target);
    try {
      const chat = await client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit, fromMe: true });
      const hits = messages.filter((m) => m.fromMe && m.timestamp >= since
        && needles.every((n) => String(m.body || "").toLowerCase().includes(n)));
      for (const m of hits) await enqueueQuiet(() => m.delete(everyone));
      results.push({ to: chatId, revoked: hits.length });
      console.log(`↩️ Tarik pesan (${everyone ? "untuk semua" : "untuk bot"}) di ${chatId}: ${hits.length} pesan`);
    } catch (error) {
      results.push({ to: chatId, revoked: 0, error: error.message || String(error) });
      console.warn(`⚠️ Tarik pesan di ${chatId} gagal:`, error.message || error);
    }
  }
  return results;
}
