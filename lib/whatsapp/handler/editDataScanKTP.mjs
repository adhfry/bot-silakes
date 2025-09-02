import {
  formatPhone,
  formatPhoneKey,
} from "../../../utils/formatPhoneNumber.mjs";
import { replyChatWA } from "../sender.mjs";
import {
  addPendingKTP,
  getPendingKTP,
  removePendingKTP,
} from "../utils/pendingKTPStore.mjs";

export async function handleEditDataScanKTP(msg) {
  try {
    const text = msg.body.trim();
    console.log(text);
    // Ambil bagian data sebelum "👉"
    const match = text.match(/•[\s\S]*?(?=👉)/);
    console.log(match);
    if (!match) {
      return await replyChatWA(
        msg,
        "❌ Format data tidak valid. Pastikan Anda menyalin pesan data sebelumnya dan hanya mengubah datanya."
      );
    }

    const pending = await getPendingKTP(msg.from);
    if (!pending) {
      return await replyChatWA(
        msg,
        "> ❌ Data Tidak Valid\n\nData KTP tersebut tidak tersimpan di data pending\n\nSilahkan foto ulang ktp anda"
      );
    }
    const dataSection = match[0];

    // Split per baris dan ambil yang memiliki format key: value
    const lines = dataSection
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("•") && line.includes(":"));

    const newData = {};

    for (const line of lines) {
      const cleanLine = line.replace(/^•\s*/, "");
      const [key, ...vals] = cleanLine.split(":");
      newData[key.trim().toLowerCase()] = vals.join(":").trim().toUpperCase();
    }

    // Validasi minimal data harus punya NIK dan NAMA
    if (!newData["nik"] || !newData["nama"]) {
      return await replyChatWA(
        msg,
        "❌ Data tidak valid. Pastikan NIK dan NAMA ada."
      );
    }

    // Ambil userId (dari WA sender)
    const userId = msg.from;

    // Simpan ulang data yang sudah diperbarui
    await addPendingKTP(userId, newData);

    // Kirim kembali konfirmasi
    let konfirmMsg = "> 📝 *Data KTP Anda (Update)*:\n\n";
    for (const [k, v] of Object.entries(newData)) {
      konfirmMsg += `• ${k.toUpperCase()}: ${v}\n`;
    }
    konfirmMsg +=
      "\n👉 *Apakah data di atas sudah benar?*\n" +
      "- Jika *BELUM* benar, salin pesan ini, edit datanya dan berikan lagi kepada saya.\n" +
      "- Jika *SUDAH* benar, ketik `#ai konfirmasi ktp " +
      newData["nik"] +
      "`";

    return await replyChatWA(msg, konfirmMsg);
  } catch (error) {
    console.error(error);
    return await replyChatWA(msg, "❌ Terjadi kesalahan saat memproses data.");
  }
}
