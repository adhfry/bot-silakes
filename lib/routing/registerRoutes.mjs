// lib/routing/registerRoutes.mjs
//
// Registry route EKSPLISIT -- BUKAN introspeksi internal Express
// (`express-list-endpoints` dikonfirmasi rusak di Express 5, balikin array
// kosong: lihat issue AlbertoFdzM/express-list-endpoints#99. Manual-walk
// `app.router.stack` juga tidak dipakai sebagai sumber utama karena
// maintainer Express sendiri bilang field internal begitu gampang berubah
// antar versi). Tiap file di routes/*.mjs mengekspor daftar deskriptor
// {method, path, auth, description, handler} lewat fungsi ini -- SEKALIGUS
// jadi sumber data bin/route-list.mjs (baca `registry`, tanpa perlu boot
// Puppeteer/Chrome sama sekali).
import { requireApiKey } from "../middleware/auth.mjs";

/** @type {Array<{method:string, path:string, auth:boolean, description:string}>} */
export const registry = [];

/**
 * @param {import('express').Express} app
 * @param {Array<{method:string, path:string, auth?:boolean, description:string, handler:Function}>} descriptors
 */
export function mountRoutes(app, descriptors) {
  for (const d of descriptors) {
    const auth = d.auth !== false; // default: butuh auth, kecuali eksplisit auth:false
    const middlewares = auth ? [requireApiKey] : [];
    app[d.method.toLowerCase()](d.path, ...middlewares, d.handler);
    registry.push({
      method: d.method.toUpperCase(),
      path: d.path,
      auth,
      description: d.description || "",
    });
  }
}
