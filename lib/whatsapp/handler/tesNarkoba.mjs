import { replyChatWA, sendChatWAMedia } from "../sender.mjs";
import axios from "axios";
import {
  getPemeriksaan,
  addPemeriksaan,
  removePemeriksaan,
} from "../utils/pemeriksaanStore.mjs";
import { checkNikRegisteredByPhone } from "../../api/checkNik.mjs";
import { getTimeNow } from "./functions.mjs";
import dotenv from "dotenv";
import { getPDFToImg } from "../utils/PDFBuffer.mjs";
import { sendMessageAll } from "../../phoenix/notificationPhx.mjs";
import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;

dotenv.config();

export async function handleTesNarkoba(message) {
  const from = message.from;
  const phone = from.replace("@c.us", "");

  // 1. Cek apakah user sudah terdaftar
  const registered = await checkNikRegisteredByPhone(phone);
  if (!registered) {
    return await replyChatWA(
      message,
      "❌ Nomor Anda belum terdaftar dalam sistem. Silakan melakukan pendaftaran terlebih dahulu.\n\nUntuk mendaftar, gunakan sintaks: `#ai scan ktp,<noHp>`\n\nContoh: `#ai scan ktp,08123456789` dan lampirkan foto KTP Anda sebagai media."
    );
  }

  // 2. Cek pemeriksaan pending
  const existing = await getPemeriksaan(from);
  if (existing) {
    return await replyChatWA(
      message,
      `⚠️ Anda memiliki pemeriksaan sebelumnya yang belum selesai.\n\n` +
        `1️⃣ Lanjutkan pemeriksaan saat ini \n` +
        `2️⃣ Lanjutkan pemeriksaan sebelumnya (${existing.layanan} | ${existing.time})\n\n` +
        `Reply Pesan ini dengan angka 1 atau 2.`
    );
  }

  // 3. Simpan pemeriksaan baru
  const waktu = getTimeNow();

  await addPemeriksaan(from, {
    no_hp: phone,
    layanan: "Narkoba 7 Parameter",
    status: "pending_konfirmasi",
    time: waktu,
  });

  await replyChatWA(
    message,
    `Apakah hari ini Anda ingin melakukan pemeriksaan *Narkoba 7 Parameter* seharga *Rp 200.000* pada ${waktu}?\n\n` +
      `Reply dengan: *Y/ YA / IYA*`
  );
}

/**
 * Handler ketika pasien diminta memilih 1 (pemeriksaan saat ini) atau 2 (sebelumnya)
 */
export async function handlePemeriksaanSebelumnya(msg) {
  const from = msg.from;
  const text = msg.body.trim();
  const lowerText = text.toLowerCase();
  const phone = from.replace("@c.us", "");

  // Ambil data pemeriksaan yang sedang pending
  const current = await getPemeriksaan(from);

  if (!current) {
    return await replyChatWA(
      msg,
      "❌ *Tidak ada proses pemeriksaan yang ditemukan.*\n" +
        "Silakan mulai dengan perintah `#ai tes narkoba`"
    );
  }
  const waktu = getTimeNow();
  switch (lowerText) {
    case "1":
    case "lanjutkan pemeriksaan saat ini":
      await removePemeriksaan(from);
      await addPemeriksaan(from, {
        no_hp: phone,
        layanan: "Narkoba 7 Parameter",
        status: "pending_konfirmasi",
        time: waktu,
      });

      await replyChatWA(
        msg,
        "✅ Pemeriksaan *saat ini* akan dilanjutkan.\n\n" +
          "Mohon konfirmasi kembali:\n" +
          `Apakah hari ini Anda ingin melakukan pemeriksaan *Narkoba 7 Parameter* seharga *Rp 200.000* pada ${waktu}?\n\n` +
          `Reply dengan: *Y / YA / IYA*`
      );
      break;

    case "2":
    case "lanjutkan pemeriksaan sebelumnya":
      await replyChatWA(
        msg,
        "✅ Pemeriksaan *sebelumnya* akan dilanjutkan.\n\n" +
          "Mohon konfirmasi kembali:\n" +
          `Apakah Anda ingin melakukan pemeriksaan *${current.layanan}* seharga *Rp 200.000* pada ${waktu}?\n\n` +
          `Reply dengan: *Y / YA / IYA*`
      );
      break;

    default:
      await replyChatWA(
        msg,
        "❌ Pilihan tidak valid.\n" +
          "Balas dengan angka *1* untuk melanjutkan pemeriksaan saat ini, atau *2* untuk pemeriksaan sebelumnya."
      );
      break;
  }
}

export async function handleKonfirmasiDaftarPemeriksaan(msg) {
  const from = msg.from;
  const text = msg.body.trim();
  const lowerText = text.toLowerCase();
  const phone = from.replace("@c.us", "");

  const current = await getPemeriksaan(from);

  await replyChatWA(msg, "⏳ Memproses pemeriksaan...");

  if (!current) {
    return await replyChatWA(
      msg,
      "❌ Tidak ada proses pemeriksaan yang ditemukan.\n\n" +
        "Silakan mulai dengan perintah:\n\n`#ai tes narkoba`."
    );
  }

  try {
    const response = await axios.post(
      `${process.env.LARAVEL_API_BASE_URL}/create-antrian`,
      {
        phone: current.no_hp,
        layanan: current.layanan,
      }
    );

    const data = response.data;

    if (data.error || data.data.registered == false) {
      return await replyChatWA(
        msg,
        `❌ Gagal membuat pemeriksaan: ${data.message || "Terjadi kesalahan."}`
      );
    }
    const suratId = data.data.surat_hasil_lab_id;
    console.log("Pemeriksaan berhasil dibuat:", data.data);

    const pdfImage = await getPDFToImg(suratId);

    const media = new MessageMedia(
      pdfImage.contentType,
      pdfImage.buffer.toString("base64"),
      pdfImage.fileName
    );

    await removePemeriksaan(from);
    sendMessageAll("Baru Saja Melakukan Self-Register Pemeriksaan", "Pasien");
    const caption =
      "> ✅ *Nomor Antrian Anda Berhasil Dibuat!*\n\n" +
      "📌 *Instruksi Penting:*\n" +
      "1️⃣ *Tunjukkan Kode QR* di kartu antrian ini staf administrasi di *Labkesda* untuk verifikasi.\n" +
      "2️⃣ *Siapkan Pembayaran* sesuai nominal pada kartu (tunai 💵 atau QRIS 📱).\n\n" +
      "🙏 Terima kasih telah menggunakan layanan kami!";
    return await sendChatWAMedia(from, caption, media);
  } catch (error) {
    console.error("Error:", error);
    let addMsg = "";

    const message = error?.response?.data?.message || "Terjadi kesalahan.";

    if (message === "Pasien sudah terdaftar untuk pemeriksaan hari ini.") {
      addMsg =
        "\n\nJika Anda ingin melakukan pemeriksaan lagi, silakan hubungi nomor Admin berikut\n\n+62 859-2143-1244\n(Admin Labkesda)";
      await removePemeriksaan(from);
    }

    return await replyChatWA(
      msg,
      `❌ Gagal membuat pemeriksaan: ${message} ${addMsg}`
    );
  }
}
