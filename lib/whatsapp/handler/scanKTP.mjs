// lib/whatsapp/handler/scanKTP.mjs

import axios from "axios";
import { replyChatWA } from "../sender.mjs";
import { callGeminiOCR } from "../../api/geminiOCR.mjs";
import { checkNikRegistered } from "../../api/checkNik.mjs";
import { addPendingKTP } from "../utils/pendingKTPStore.mjs";

/**
 * Handler untuk "#ai scan ktp"
 */
export async function handleScanKTP(message) {
  const from = message.from;
  const text = message.body.trim();

  // 1. Pastikan user mengirim media
  if (!message.hasMedia) {
    return await replyChatWA(
      message,
      "❌ *Anda belum mengirim foto KTP.*\n" +
        "Gunakan: `#ai scan ktp` diikuti dengan lampiran foto KTP."
    );
  }

  await replyChatWA(message, "⏳ _Memproses foto KTP Anda..._");

  // 2. Download media
  let media;
  try {
    media = await message.downloadMedia();
  } catch (err) {
    console.error("❌ Gagal download media:", err.message);
    return await replyChatWA(
      message,
      "❌ *Gagal mengambil foto KTP.* Mohon coba lagi."
    );
  }

  // 3. Pastikan tipe media adalah gambar
  if (!media || !media.data || !media.mimetype.startsWith("image")) {
    return await replyChatWA(
      message,
      "❌ *File yang dikirim bukan gambar KTP.* Silakan kirim ulang."
    );
  }

  // 4. Kirim ke Gemini OCR
  let ocrResult;
  try {
    const base64Image = media.data; // media.data sudah base64 tanpa header
    ocrResult = await callGeminiOCR(base64Image);
  } catch (err) {
    console.error("❌ Gagal memproses OCR:", err.message);
    return await replyChatWA(
      message,
      "❌ *Gagal membaca KTP.* Silakan coba lagi dengan gambar yang lebih jelas."
    );
  }

  // 5. Parse hasil OCR menjadi objek key:value
  const lines = ocrResult
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter((s) => s.includes(":"));

  const dataObj = {};
  for (const line of lines) {
    const [key, ...vals] = line.split(":");
    dataObj[key.trim().toLowerCase()] = vals.join(":").trim();
  }

  // 6. Validasi: Pastikan ada data inti
  const requiredKeys = [
    "nik",
    "nama",
    "tempat_lahir",
    "tanggal_lahir",
    "alamat",
  ];
  const missingKeys = requiredKeys.filter(
    (k) => !dataObj[k] || dataObj[k].length === 0
  );
  if (missingKeys.length > 0) {
    return await replyChatWA(
      message,
      "❌ *Data KTP tidak lengkap atau tidak valid.*\n" +
        "Pastikan KTP terlihat jelas dan coba scan ulang.\n" +
        "Jika tetap gagal, silakan kirim ulang foto KTP yang lebih jelas."
    );
  }

  const nik = dataObj["nik"];
  if (!nik.match(/^[0-9]{6,20}$/)) {
    // format NIK tidak layak, minimal angka
    return await replyChatWA(
      message,
      "❌ *NIK yang terdeteksi tidak valid.*\n" +
        "Pastikan KTP Anda dalam kondisi jelas dan coba scan ulang."
    );
  }

  // 7. Cek NIK di API Laravel
  let registered;
  try {
    registered = await checkNikRegistered(nik);
  } catch (err) {
    console.error("❌ Gagal cek NIK terdaftar:", err.message);
    await replyChatWA(
      message,
      "⚠️ Gagal memverifikasi data. Melanjutkan proses pendaftaran..."
    );
    registered = false;
  }

  if (registered) {
    return await replyChatWA(
      message,
      "❗ *Data KTP Anda sudah terdaftar.*\n" +
        "Jika ingin memperbarui data, silakan hubungi admin UPTD Labkesda.\n" +
        "Terima kasih."
    );
  }

  // 8. Simpan dataObj ke data.json (pendingKTP)
  await addPendingKTP(from, dataObj);

  // 8. Susun pesan konfirmasi data kepada user
  let konfirmMsg = "> 📝 *Data KTP Anda*:\n\n";
  for (const [k, v] of Object.entries(dataObj)) {
    konfirmMsg += `• ${k.toUpperCase()}: ${v}\n`;
  }
  konfirmMsg +=
    "\n👉 *Apakah data di atas sudah benar?*\n" +
    "- Jika **BELUM** benar, ketik `#ai scan ulang ktp` untuk ulang scan.\n" +
    "- Jika **SUDAH** benar, ketik `#ai konfirmasi ktp " +
    nik +
    "`";

  return await replyChatWA(message, konfirmMsg);
}
