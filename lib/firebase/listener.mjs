// lib/firebase/listener.mjs
import { db } from "./firebase.mjs";

let notificationListener = null;

/**
 * Jalankan listener untuk node 'notifikasi' hanya satu kali.
 * @param {Function} callback - Fungsi yang dipanggil ketika data baru ditambahkan.
 */
export function startNotificationListener(callback) {
  const ref = db.ref("notifikasi");

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
  const ref = db.ref("notifikasi");

  if (notificationListener) {
    ref.off("child_added", notificationListener);
    console.log("🛑 Listener RTDB notifikasi dihentikan");
    notificationListener = null;
  }
}
