// lib/whatsapp/revoke.mjs
//
// Tarik pesan bot yang sudah terkirim: pesan milik bot (fromMe) yang memuat
// SEMUA kata kunci (minimal 2 supaya tidak menarik terlalu banyak), dicari dari
// isinya di semua chat. "Hapus untuk semua" hanya bisa dalam batas waktu
// WhatsApp (~2 hari); everyone=false = hapus untuk bot saja.
import { enqueueQuiet } from "../queue/index.mjs";
import { findMessages, deleteMessageById } from "./pageMessages.mjs";

export async function revokeMessages({ contains, everyone = true, sinceMinutes = 2880 }) {
  const needles = (contains || []).map((s) => String(s).trim()).filter(Boolean);
  if (needles.length < 2) throw new Error("contains minimal 2 kata kunci");
  const sinceSec = Math.floor(Date.now() / 1000) - sinceMinutes * 60;
  const found = await enqueueQuiet(() => findMessages({ all: needles, sinceSec, fromMeOnly: true, maxLoads: 3 }));
  const results = [];
  for (const id of found.ids) {
    try {
      await enqueueQuiet(() => deleteMessageById(id, everyone));
      results.push({ id: id.replace(/\d{6}(\d{4})@/, "xxxxxx$1@"), ok: true });
    } catch (error) {
      results.push({ id: id.replace(/\d{6}(\d{4})@/, "xxxxxx$1@"), ok: false, error: error.message || String(error) });
    }
  }
  console.log(`↩️ Tarik pesan (${everyone ? "untuk semua" : "untuk bot"}): ${results.filter((r) => r.ok).length}/${found.ids.length} pesan, ${found.chats} chat diperiksa`);
  return { chats: found.chats, errors: found.errors, results };
}
