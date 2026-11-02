// Tambalan whatsapp-web.js 1.34.7: sejak WhatsApp Web September 2026 data
// media membawa field privat __x_id. Saat disebar ke pesan keluar, field itu
// menimpa ID pesan sehingga SEMUA kiriman lampiran gagal dengan
// "Data passed to getter must include an id property (it's how we memoize)".
// Perbaikan mengikuti usulan upstream (wwebjs/whatsapp-web.js PR #201923,
// issue #201922): buang __x_id dari data media sebelum disebar, dan pastikan
// ID pesan keluar tetap kunci pesan baru. Dijalankan otomatis setelah
// npm install (postinstall) dan aman dijalankan berulang.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "node_modules/whatsapp-web.js/src/util/Injected/Utils.js");
const MARK = "/* silakes-patch: media __x_id */";

if (!existsSync(file)) {
  console.log("patch-wwebjs: whatsapp-web.js belum terpasang, dilewati.");
  process.exit(0);
}
let src = readFileSync(file, "utf8");
if (src.includes(MARK)) {
  console.log("patch-wwebjs: sudah terpasang.");
  process.exit(0);
}
const anchor = "            mediaOptions.isViewOnce = options.isViewOnce;\n";
const end = "            ...extraOptions,\n        };\n";
if (!src.includes(anchor) || !src.includes(end)) {
  console.error("patch-wwebjs: pola tidak ditemukan (versi whatsapp-web.js berubah?). Periksa kiriman lampiran.");
  process.exit(0);
}
src = src.replace(anchor, `${anchor}            ${MARK}\n            delete mediaOptions.__x_id;\n`);
src = src.replace(end, `${end}        message.id = newMsgKey;\n        delete message.__x_id;\n`);
writeFileSync(file, src);
console.log("patch-wwebjs: tambalan media terpasang.");
