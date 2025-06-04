// lib/whatsapp/utils/pendingKTPStore.mjs

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Utility untuk mengakses file data.json di /lib/whatsapp/data.json
 */
const DATA_PATH = path.resolve(process.cwd(), "lib/whatsapp/data.json");

/**
 * Baca seluruh konten data.json dan parse jadi object
 */
async function readAll() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    // Jika file belum ada atau error parse, kembalikan objek kosong
    return {};
  }
}

/**
 * Tulis object lengkap ke data.json
 */
async function writeAll(obj) {
  const content = JSON.stringify(obj, null, 2);
  await fs.writeFile(DATA_PATH, content, "utf-8");
}

export async function addPendingKTP(userId, dataObj) {
  const all = await readAll();
  all[userId] = dataObj;
  await writeAll(all);
}

export async function getPendingKTP(userId) {
  const all = await readAll();
  return all[userId] || null;
}

export async function removePendingKTP(userId) {
  const all = await readAll();
  if (all[userId]) {
    delete all[userId];
    await writeAll(all);
  }
}
