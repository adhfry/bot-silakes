// lib/whatsapp/jaspelPrivacy.mjs
//
// Chat tentang jaspel (rapor & nominal, pengajuan ke admin, jaspel dibayarkan,
// pengumuman pencairan, balasan SINTA soal jaspel) tetap DIKIRIM, lalu langsung
// "hapus untuk saya" di akun bot supaya nominal jaspel pegawai tidak tertinggal
// di HP/WhatsApp Web bot (keputusan pemilik sistem 2026-11-06). Penerima tetap
// melihat pesannya; ini BUKAN "hapus untuk semua".
//
// - Pesan bot: dihapus beberapa detik setelah sampai di server WhatsApp (ack >= 1),
//   karena menghapus pesan yang belum terkirim bisa membatalkan pengirimannya.
// - Pesan masuk: dihapus setelah jeda, supaya SINTA sempat membalas sambil mengutipnya.
// - Sapu bersih: saat bot siap, chat yang sudah ada diperiksa sekali.
// Semua penghapusan lewat worker (single-flight) tanpa menyela jeda notifikasi.
import { enqueueQuiet } from "../queue/index.mjs";
import { findMessages, deleteMessageById, activeChatIds } from "./pageMessages.mjs";

const JASPEL_RE = /jaspel|jasa\s+pelayanan|remunerasi/i;
const OWN_AFTER_ACK_MS = 800;
const OWN_FALLBACK_MS = 10 * 60_000;
const INCOMING_DELAY_MS = 6 * 60_000; // jawaban SINTA bisa butuh ~2,5 menit + mengetik
const SWEEP_START_DELAY_MS = Number(process.env.JASPEL_SWEEP_DELAY_MS || 60_000);
const SWEEP_DAYS = Number(process.env.JASPEL_SWEEP_DAYS || 150);
const SWEEP_LOADS_PER_CHAT = Number(process.env.JASPEL_SWEEP_LOADS || 15);

export function isJaspelText(text) {
  return JASPEL_RE.test(String(text || ""));
}

/** Isi pesan atau pesan yang dikutipnya (balasan SINTA mengutip pertanyaan jaspel). */
export function isJaspelMessage(msg) {
  return isJaspelText(msg?.body) || isJaspelText(msg?._data?.quotedMsg?.body) || isJaspelText(msg?._data?.caption);
}

const handled = new Set();
const ACK_RETRY_MS = 1_500;
const ACK_MAX_TRIES = Math.ceil(OWN_FALLBACK_MS / ACK_RETRY_MS);

/**
 * ID pesan berbentuk "true_<chat>_<id>". Di WA Web sekarang (chat LID) _serialized
 * sering kosong, jadi disusun dari bagiannya.
 */
function idOf(msg) {
  const id = msg?.id;
  if (!id) return null;
  if (id._serialized) return id._serialized;
  const remote = typeof id.remote === "string" ? id.remote : id.remote?._serialized || (id.remote ? String(id.remote) : null);
  if (!remote || !id.id) return null;
  return `${id.fromMe ? "true" : "false"}_${remote}_${id.id}${id.participant ? `_${typeof id.participant === "string" ? id.participant : id.participant._serialized}` : ""}`;
}

function removeForMe(msg, why, requireAck = false) {
  removeById(idOf(msg), why, requireAck);
}

function removeById(id, why, requireAck = false) {
  if (!id || handled.has(id)) return;
  handled.add(id);
  if (handled.size > 5000) handled.delete(handled.values().next().value);
  run(id, why, requireAck, 1);
}

// Pesan bot dihapus setelah WhatsApp memastikan sampai di server (ack >= 1):
// menghapus pesan yang belum terkirim bisa membatalkan pengirimannya.
function run(id, why, requireAck, attempt) {
  // Pesan bot yang baru terkirim (requireAck) didahulukan; sapu bersih tetap di belakang.
  enqueueQuiet(() => deleteMessageById(id, false, { requireAck: requireAck && attempt < ACK_MAX_TRIES }), { urgent: requireAck })
    .then(() => console.log(`🧹 Pesan jaspel dihapus untuk bot (${why})`))
    .catch((error) => {
      if (error?.message?.includes("BELUM_TERKIRIM")) {
        setTimeout(() => run(id, why, requireAck, attempt + 1), ACK_RETRY_MS);
        return;
      }
      handled.delete(id);
      console.warn(`⚠️ Gagal menghapus pesan jaspel (${why}):`, error.message || error);
    });
}

function scheduleOwn(msg) {
  setTimeout(() => removeForMe(msg, "terkirim", true), OWN_AFTER_ACK_MS);
}

export async function sweepJaspel() {
  const sinceSec = Math.floor(Date.now() / 1000) - SWEEP_DAYS * 86400;
  let chatIds = [];
  try {
    chatIds = await enqueueQuiet(() => activeChatIds(sinceSec));
  } catch (error) {
    console.warn("⚠️ Sapu chat jaspel: gagal membaca daftar chat:", error.message || error);
    return { chats: 0, found: 0, errors: [error.message || String(error)] };
  }
  let total = 0;
  const errors = [];
  // Per chat (bukan sekaligus) supaya antrean kirim tidak tertahan lama.
  for (const chatId of chatIds) {
    try {
      const found = await enqueueQuiet(() => findMessages({ regex: JASPEL_RE.source, sinceSec, maxLoads: SWEEP_LOADS_PER_CHAT, chatIds: [chatId] }));
      errors.push(...found.errors);
      for (const id of found.ids) removeById(id, "sapu bersih");
      total += found.ids.length;
    } catch (error) {
      errors.push(error.message || String(error));
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`🧹 Sapu chat jaspel: ${chatIds.length} chat diperiksa, ${total} pesan jaspel diantrekan untuk dihapus.${errors.length ? ` Galat (${errors.length}): ${errors.slice(0, 3).join("; ")}` : ""}`);
  return { chats: chatIds.length, found: total, errors: errors.slice(0, 5) };
}

let installed = false;
export function installJaspelPrivacy(client) {
  if (installed) return;
  installed = true;

  client.on("message_create", (msg) => {
    if (!isJaspelMessage(msg)) return;
    if (msg.fromMe) scheduleOwn(msg);
    else setTimeout(() => removeForMe(msg, "pesan masuk"), INCOMING_DELAY_MS);
  });


}

/** Dipanggil worker dengan pesan yang baru dikirim (jalan juga saat event message_create tidak terdengar). */
export function trackSentMessage(msg, text) {
  if (msg && typeof msg === "object" && msg.id && (isJaspelText(text) || isJaspelMessage(msg))) scheduleOwn(msg);
}

let swept = false;
/** Sapu bersih sekali per proses, beberapa saat setelah WhatsApp siap. */
export function startJaspelSweep(client) {
  if (swept) return;
  swept = true;
  setTimeout(() => sweepJaspel(), SWEEP_START_DELAY_MS);
}
