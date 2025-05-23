// index.mjs
import express from "express";
import dotenv from "dotenv";
import { apiRes } from "./utils/apiRes.mjs";
import {
  testWriteToRTDB,
  testReadFromRTDB,
  testDeleteFromRTDB,
  testReadFromRTDBWithCallback,
  testUpdateToRTDB,
  sendTestData,
} from "./lib/firebase/test-rtdb.mjs";
import { startNotificationListener } from "./lib/firebase/listener.mjs";
import { sendChatWA } from "./lib/whatsapp/sender.mjs";
import { db } from "./lib/firebase/firebase.mjs";

dotenv.config(); // ⬅️ Muat variabel dari .env ke dalam process.env

const app = express();
const PORT = process.env.PORT || 3000;

// middleware untuk parsing JSON
app.use(express.json());

// route contoh: health check
app.get("/", (req, res) => {
  res.json({ status: "OK", timestamp: Date.now() });
});

// route untuk kirim pesan WhatsApp (stub dulu)
app.post("/api/sendChatWA", async (req, res) => {
  if (!req.body) {
    return apiRes(res, {
      status: "error",
      message: "Missing data to transfer",
      statusCode: 400,
    });
  }

  const { to, message } = req.body;
  if (!to || !message) {
    return apiRes(res, {
      status: "error",
      message: "Missing 'to' or 'message'",
      statusCode: 400,
    });
  }

  // stub: log dulu ke console
  console.log(">> [API] sendChatWA", { to, message });

  // nanti kita ganti dengan: await sendChatWA(to, message);
  return apiRes(res, {
    status: "success",
    data: { to, message },
    message: "Pesan berhasil diproses",
    statusCode: 200,
  });
});

app.get("/test-rtdb/connect", async (req, res) => {
  try {
    await testWriteToRTDB();
    await testReadFromRTDB();
    await testUpdateToRTDB();
    await testDeleteFromRTDB();
    await testReadFromRTDBWithCallback();
    return apiRes(res, {
      status: "success",
      message: "Berhasil terhubung ke Firebase RTDB",
      statusCode: 200,
    });
  } catch (error) {
    console.error("Error connecting to Firebase RTDB:", error);
    return apiRes(res, {
      status: "error",
      message: "Gagal terhubung ke Firebase RTDB",
      statusCode: 500,
    });
  }
});

app.get("/test-rtdb/send-test-data", async (req, res) => {
  await sendTestData();
  return apiRes(res, {
    status: "success",
    message: "Data uji coba berhasil dikirim ke RTDB",
    statusCode: 200,
  });
});

startNotificationListener(async (data, key) => {
  console.log("🔔 Listener aktif: notifikasi dari RTDB:");
  console.log("➡️ ID:", key);
  console.log("➡️ Data:", data);

  if (data && data.to && data.message) {
    console.log("📱 Mengirim pesan ke:", data.to);
    console.log("💬 Pesan:", data.message);

    const result = await sendChatWA(data.to, data.message);

    if (result) {
      // Tunggu 5 detik sebelum menghapus node
      setTimeout(() => {
        db.ref(`notifikasi/${key}`)
          .remove()
          .then(() => {
            console.log(`🗑️ Notifikasi ${key} berhasil dihapus dari RTDB.`);
          })
          .catch((err) => {
            console.error(`❌ Gagal menghapus notifikasi ${key}:`, err.message);
          });
      }, 5000);
    } else {
      console.warn("⚠️ Gagal mengirim pesan, data tidak dihapus.");
    }
  } else {
    console.error("❌ Data tidak valid:", data);
  }
});

app.listen(PORT, () => {
  console.log(`→ Server Express berjalan di http://localhost:${PORT}`);
});
