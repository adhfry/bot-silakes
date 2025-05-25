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
  sendTestDataNew,
} from "./lib/firebase/test-rtdb.mjs";
import { startNotificationListener } from "./lib/firebase/listener.mjs";
import { sendChatWA } from "./lib/whatsapp/sender.mjs";
import { db } from "./lib/firebase/firebase.mjs";
import {
  notifyAdmin,
  notifyUserConfirmByWeb,
} from "./lib/api/NotifyAdminController.mjs";

dotenv.config(); // ⬅️ Muat variabel dari .env ke dalam process.env

const app = express();
const PORT = process.env.PORT || 3001;

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
  await sendTestDataNew();
  return apiRes(res, {
    status: "success",
    message: "Data uji coba berhasil dikirim ke RTDB",
    statusCode: 200,
  });
});

/**
 * Route untuk menjalankan bot
 */

app.post("/api/bot/wa/notify-admin", async (req, res) => {
  // res memiliki idSurat, message
  if (!req.body) {
    return apiRes(res, {
      status: "error",
      message: "Missing data to transfer",
      statusCode: 400,
    });
  }

  const { idSurat, message } = req.body;
  if (!idSurat || !message) {
    return apiRes(res, {
      status: "error",
      message: "Missing Arguments",
      statusCode: 400,
    });
  }
  console.log(">> [API] notifyAdmin", { idSurat, message });
  const result = await notifyAdmin(idSurat, message);
  console.log("Hasil :", result);
  if (!result) {
    return apiRes(res, {
      status: "error",
      message: "Gagal mengirim pesan ke admin",
      statusCode: 500,
    });
  }

  return apiRes(res, {
    status: "success",
    message: "Pesan berhasil dikirim ke admin",
    data: result,
    statusCode: 200,
  });
});

app.post("/api/bot/wa/notify-confirm", async (req, res) => {
  // res memiliki idSurat, message
  if (!req.body) {
    return apiRes(res, {
      status: "error",
      message: "Missing data to transfer",
      statusCode: 400,
    });
  }

  const { idSurat, typeConfirm } = req.body;
  if (!idSurat || !typeConfirm) {
    return apiRes(res, {
      status: "error",
      message: "Missing Arguments",
      statusCode: 400,
    });
  }
  console.log(">> [API] notifyAdmin", { idSurat, typeConfirm });
  const result = await notifyUserConfirmByWeb(idSurat, typeConfirm);
  console.log("Hasil :", result);
  if (!result) {
    return apiRes(res, {
      status: "error",
      message: "Gagal mengirim pesan ke admin",
      statusCode: 500,
    });
  }

  return apiRes(res, {
    status: "success",
    message: "Pesan berhasil dikirim ke admin",
    data: result,
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
      let refDb =
        process.env.APP_ENV !== "local"
          ? `notifikasi/${key}`
          : `notifikasi_dev/${key}`;
      console.log("➡️ Ref DB:", refDb);
      // Tunggu 5 detik sebelum menghapus node
      setTimeout(() => {
        db.ref(refDb)
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
