// lib/middleware/auth.mjs
//
// Sebelumnya HANYA /send/chat-message/:apikey (kontrak PRODULI, key di path
// param) yang punya autentikasi -- route lain (notify-admin, notify-confirm,
// send-chat, send-chat-message, send-chat-group-message) bisa dipanggil
// SIAPA SAJA yang tahu URL-nya (celah nyata: bisa disalahgunakan untuk
// memicu pola kirim yang justru bikin nomor WA di-banned). Middleware ini
// dipasang per-route lewat registry (lib/routing/registerRoutes.mjs), TIDAK
// menyentuh /send/chat-message/:apikey yang skemanya sengaja beda (path
// param, kontrak eksternal tetap).
import { apiRes } from "../../utils/apiRes.mjs";

export function requireApiKey(req, res, next) {
  const key = req.header("X-API-Key");
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
    return apiRes(res, {
      status: "error",
      message: "API key tidak valid",
      statusCode: 401,
    });
  }
  next();
}
