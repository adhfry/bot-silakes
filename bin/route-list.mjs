#!/usr/bin/env node
// bin/route-list.mjs -- ala `php artisan route:list`. Jalankan: npm run route:list
//
// Import app.mjs SAJA (bukan index.mjs) supaya TIDAK memicu boot WhatsApp
// client (Puppeteer/Chrome) cuma untuk mencetak daftar route -- lihat komentar
// di app.mjs & lib/whatsapp/client.mjs.
import dotenv from "dotenv";
dotenv.config();

import { registry } from "../app.mjs";

const rows = registry.map((r) => ({
  METHOD: r.method,
  PATH: r.path,
  AUTH: r.auth ? "yes" : "no",
  DESCRIPTION: r.description,
}));

const cols = ["METHOD", "PATH", "AUTH", "DESCRIPTION"];
const widths = Object.fromEntries(
  cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c]).length))]),
);

function printRow(values) {
  console.log(cols.map((c) => String(values[c]).padEnd(widths[c])).join("  "));
}

printRow(Object.fromEntries(cols.map((c) => [c, c])));
console.log(cols.map((c) => "-".repeat(widths[c])).join("  "));
for (const row of rows) printRow(row);

console.log(`\n${rows.length} route terdaftar.`);

// registry (lewat rantai import app.mjs) mendaftarkan beberapa listener/timer
// di modul lain (mis. watchdog client.mjs, walau initialize() tidak dipanggil)
// -- keluar eksplisit supaya proses CLI ini tidak menggantung.
process.exit(0);
