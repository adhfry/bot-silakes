// lib/firebase/listener.mjs
import { db } from "./firebase.mjs";
import dotenv from "dotenv";

dotenv.config();

let notificationListener = null;
let refVar = process.env.APP_ENV !== "local" ? "notifikasi" : "notifikasi_dev";

/**
 * Jalankan listener untuk node 'notifikasi' hanya satu kali.
 * @param {Function} callback - Fungsi yang dipanggil ketika data baru ditambahkan.
 */
export function startNotificationListener(callback) {
  const ref = db.ref(refVar);
  console.log("🔔 Memulai listener RTDB untuk notifikasi...");
  console.log("→ APP_ENV : " + refVar);

  // Hentikan listener lama jika sudah ada
  if (notificationListener) {
    ref.off("child_added", notificationListener);
  }

  notificationListener = (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;

    console.log("📥 Notifikasi baru masuk:", key, data);

    if (callback) {
      callback(data, key);
    }
  };

  ref.on("child_added", notificationListener);
}

/**
 * Hentikan listener RTDB untuk notifikasi
 */
export function stopNotificationListener() {
  const ref = db.ref(refVar);

  if (notificationListener) {
    ref.off("child_added", notificationListener);
    console.log("🛑 Listener RTDB notifikasi dihentikan");
    notificationListener = null;
  }
}
