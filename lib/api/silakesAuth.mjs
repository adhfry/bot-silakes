// lib/api/silakesAuth.mjs
//
// Setiap panggilan bot ke API SiLAKES (LARAVEL_API_BASE_URL, grup /api/bot/v1)
// membawa X-API-Key = INTERNAL_API_KEY. Sebelumnya grup itu terbuka tanpa kunci
// (data pasien, PDF hasil lab, kirim pesan grup) -- temuan audit 23 Nov 2026;
// SiLAKES kini mewajibkan kunci ini (middleware bot.callback).
//
// Kunci HANYA ditempelkan ke permintaan yang tujuannya server SiLAKES itu,
// tidak ke layanan lain (Gemini, OpenAI, unduhan media) yang memakai axios yang sama.
import axios from "axios";

function silakesOrigin() {
  try {
    return new URL(process.env.LARAVEL_API_BASE_URL || "").origin;
  } catch {
    return "";
  }
}

export function withSilakesKey(config) {
  const origin = silakesOrigin();
  const key = process.env.INTERNAL_API_KEY;
  if (!origin || !key) return config;
  let target = "";
  try {
    target = new URL(config.url || "", config.baseURL || undefined).origin;
  } catch {
    target = "";
  }
  if (target === origin) {
    if (config.headers && typeof config.headers.set === "function") {
      config.headers.set("X-API-Key", key);
    } else {
      config.headers = { ...(config.headers || {}), "X-API-Key": key };
    }
  }
  return config;
}

let installed = false;
/** Pasang sekali pada axios bawaan (dipakai sebagian besar modul bot). */
export function installSilakesAuth() {
  if (installed) return;
  installed = true;
  axios.interceptors.request.use(withSilakesKey);
}

installSilakesAuth();
