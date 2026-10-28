// lib/queue/store.mjs
//
// Penyimpanan antrean notifikasi WA (jalur "notification" saja -- jalur
// "interactive"/balasan live TIDAK persisten, lihat worker.mjs). File JSON
// biasa dengan atomic write (tulis ke .tmp lalu rename), BUKAN better-sqlite3:
// volume pengiriman di sini kecil (puluhan-ratusan pesan/hari, satu penulis
// satu pembaca -- worker tunggal by design), jadi tidak perlu native module
// (risiko build/prebuild antar versi Node) untuk sesuatu yang cukup diselesaikan
// file JSON + rename atomic.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const STORE_PATH = path.resolve(
  process.cwd(),
  process.env.QUEUE_STORE_PATH || "./data/queue.json",
);

// Item 'done' disimpan singkat (cuma untuk /queue/status), 'failed' disimpan
// lebih lama supaya masih bisa diaudit kenapa gagal permanen.
const RETENTION_DONE_MS = 24 * 60 * 60 * 1000; // 1 hari
const RETENTION_FAILED_MS = 14 * 24 * 60 * 60 * 1000; // 14 hari

/** @type {Array<object>} */
let items = [];
let loaded = false;

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function persist() {
  ensureDir();
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(items, null, 2), "utf-8");
  // rename dalam filesystem yang sama = atomic -- proses yang crash di
  // tengah write tidak pernah meninggalkan queue.json setengah tertulis/rusak.
  fs.renameSync(tmpPath, STORE_PATH);
}

function pruneOld() {
  const now = Date.now();
  const before = items.length;
  items = items.filter((item) => {
    if (item.status === "done") {
      return now - new Date(item.sentAt || item.createdAt).getTime() < RETENTION_DONE_MS;
    }
    if (item.status === "failed") {
      return now - new Date(item.createdAt).getTime() < RETENTION_FAILED_MS;
    }
    return true; // pending/processing selalu disimpan
  });
  return items.length !== before;
}

/**
 * Load sekali saat worker start. Item yang masih 'processing' berarti proses
 * sebelumnya crash di tengah pengiriman -- direset ke 'pending' supaya tidak
 * hilang selamanya (konsekuensi yang disadari: dalam kasus langka pesan itu
 * sebenarnya SUDAH terkirim tepat sebelum crash, jadi bisa terkirim dobel --
 * acceptable untuk skala/volume tool internal ini, WhatsApp sendiri juga
 * bukan exactly-once).
 */
export function initStore() {
  if (loaded) return;
  loaded = true;
  ensureDir();
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      items = raw.trim() ? JSON.parse(raw) : [];
    } catch (error) {
      console.error(
        `❌ Gagal baca ${STORE_PATH}, mulai dengan antrean kosong:`,
        error.message,
      );
      items = [];
    }
  }
  let resetCount = 0;
  for (const item of items) {
    if (item.status === "processing") {
      item.status = "pending";
      resetCount++;
    }
  }
  if (resetCount > 0) {
    console.warn(
      `⚠️ ${resetCount} item antrean masih 'processing' dari sesi sebelumnya (kemungkinan crash), dikembalikan ke 'pending'.`,
    );
  }
  if (pruneOld() || resetCount > 0) persist();
}

/**
 * @param {object} draft - {kind, to, message, media?, lane?}
 * @returns {object} item lengkap yang sudah tersimpan (persisten)
 */
export function addItem(draft) {
  const item = {
    id: crypto.randomUUID(),
    kind: draft.kind, // 'text' | 'media' | 'group' | 'outreach'
    to: draft.to,
    message: draft.message,
    media: draft.media || null, // {base64, mimetype, filename} untuk kind:'media'
    group: draft.group === true, // kind:'media' ke grup (mis. surat undangan rapat)
    // kind:'outreach' (ajakan Prolanis dari SiLAKES): teks lalu polling
    // {question, options}; ref = id pesan di SiLAKES untuk laporan balik.
    poll: draft.poll || null,
    ref: draft.ref || null,
    // 'priority' = pesan transaksional 1-ke-1 (OTP, dst) -- jeda jauh lebih
    // pendek. 'bulk' (default, backward-compatible utk SEMUA pemanggil lama
    // yang tidak mengirim field ini) = reminder/broadcast massal, jeda penuh
    // anti-banned. Lihat notifyDelayMs() & urutan di nextPending() (worker.mjs).
    lane: draft.lane === "priority" ? "priority" : "bulk",
    status: "pending",
    attempts: 0,
    maxAttempts: Number(process.env.NOTIFY_MAX_ATTEMPTS || 5),
    createdAt: new Date().toISOString(),
    nextAttemptAt: new Date().toISOString(),
    sentAt: null,
    lastError: null,
  };
  items.push(item);
  persist();
  return item;
}

export function updateItem(id, patch) {
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  persist();
  return item;
}

/**
 * Item pending paling tua yang sudah lewat nextAttemptAt-nya -- lane
 * 'priority' SELALU didahulukan dari 'bulk' (baru di antara sesama lane yang
 * sama diurutkan FIFO by createdAt), supaya pesan transaksional 1-ke-1 tidak
 * ikut mengantre di belakang broadcast massal.
 */
export function nextPending() {
  const now = Date.now();
  const eligible = items.filter(
    (i) => i.status === "pending" && new Date(i.nextAttemptAt).getTime() <= now,
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    if (a.lane !== b.lane) return a.lane === "priority" ? -1 : 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
  return eligible[0];
}

export function summary() {
  const counts = { pending: 0, processing: 0, done: 0, failed: 0 };
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;
  const recentFailed = items
    .filter((i) => i.status === "failed")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .map((i) => ({
      id: i.id,
      to: i.to,
      kind: i.kind,
      lane: i.lane,
      attempts: i.attempts,
      lastError: i.lastError,
      createdAt: i.createdAt,
    }));
  return { counts, recentFailed };
}
