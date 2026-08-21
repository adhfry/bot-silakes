// index.mjs -- proses yang benar-benar dijalankan systemd (bot-silakes.service).
// Tipis secara sengaja: app.mjs sudah berisi semua route (lihat komentar di
// sana soal kenapa dipisah). File ini yang boot WhatsApp client sungguhan,
// listener Firebase RTDB, socket Phoenix, worker antrean, dan server HTTP.
import dotenv from "dotenv";
dotenv.config();

import { app } from "./app.mjs";
import { startWhatsAppClient } from "./lib/whatsapp/client.mjs";
import { startWorker } from "./lib/queue/index.mjs";
import { startNotificationListener } from "./lib/firebase/listener.mjs";
import { sendChatWA } from "./lib/whatsapp/sender.mjs";
import { db } from "./lib/firebase/firebase.mjs";
import { socket } from "./lib/phoenix/connectSocket.mjs";

const PORT = process.env.PORT || 3001;

// Jalur notifikasi alternatif via Firebase RTDB (di luar route HTTP) --
// dipertahankan apa adanya dari index.mjs lama. CATATAN PERUBAHAN PERILAKU:
// sendChatWA() sekarang resolve begitu pesan MASUK ANTREAN (bukan begitu
// benar-benar terkirim, lihat sender.mjs), jadi node RTDB dihapus 5 detik
// setelah berhasil DIANTREKAN -- konsisten dengan perubahan semantik yang
// sama di semua jalur pengiriman lain, kegagalan kirim sungguhan tetap
// tercatat di log worker / GET /queue/status.
startNotificationListener(async (data, key) => {
  console.log("🔔 Listener aktif: notifikasi dari RTDB:", key, data);

  if (!data || !data.to || !data.message) {
    console.error("❌ Data tidak valid:", data);
    return;
  }

  console.log("📱 Mengirim pesan ke:", data.to);
  const result = await sendChatWA(data.to, data.message);

  if (result) {
    const refDb = process.env.APP_ENV !== "local" ? `notifikasi/${key}` : `notifikasi_dev/${key}`;
    setTimeout(() => {
      db.ref(refDb)
        .remove()
        .then(() => console.log(`🗑️ Notifikasi ${key} berhasil dihapus dari RTDB.`))
        .catch((err) => console.error(`❌ Gagal menghapus notifikasi ${key}:`, err.message));
    }, 5000);
  } else {
    console.warn("⚠️ Gagal memasukkan pesan ke antrean, data tidak dihapus.");
  }
});

socket.connect();
startWorker();
startWhatsAppClient();

app.listen(PORT, () => {
  console.log(`→ Server Express berjalan di http://localhost:${PORT}`);
});
