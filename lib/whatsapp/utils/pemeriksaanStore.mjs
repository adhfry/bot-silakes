import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const DATA_PATH = path.resolve(process.cwd(), "lib/whatsapp/pemeriksaan.json");

async function readAll() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

async function writeAll(obj) {
  const content = JSON.stringify(obj, null, 2);
  await fs.writeFile(DATA_PATH, content, "utf-8");
}

export async function addPemeriksaan(userId, dataObj) {
  const all = await readAll();
  all[userId] = dataObj;
  await writeAll(all);
}

export async function getPemeriksaan(userId) {
  const all = await readAll();
  return all[userId] || null;
}

export async function removePemeriksaan(userId) {
  const all = await readAll();
  if (all[userId]) {
    delete all[userId];
    await writeAll(all);
  }
}

export async function getAllPemeriksaan() {
  return await readAll();
}
