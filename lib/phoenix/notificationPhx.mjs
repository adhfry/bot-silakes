// notifications.js
import { channels } from "./connectSocket.mjs";

/**
 * Push notifikasi ke semua client yang subscribe ke "notifications:all"
 *
 * @param {string} message  Isi notifikasinya
 * @param {string} dari     Siapa pengirim (misal nama user)
 */
export function sendMessageAll(message, dari) {
  const chan = channels["all"];
  if (!chan) {
    console.warn("Channel notifications:all belum tersedia");
    return;
  }

  chan
    .push("new_notification", {
      message,
      kepada: "all",
      dari,
    })
    .receive("ok", () => console.log("✅ Notification sent to all"))
    .receive("error", (err) =>
      console.error("❌ Failed to send notification:", err)
    );
}
