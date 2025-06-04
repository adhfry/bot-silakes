// lib/whatsapp/handler/konfirmasiKTP.mjs

import axios from "axios";
import { replyChatWA } from "../sender.mjs";
import { getPendingKTP, removePendingKTP } from "../utils/pendingKTPStore.mjs";
import dotenv from "dotenv";
import { checkNikRegistered } from "../../api/checkNik.mjs";
dotenv.config();

/**
 * Handler untuk "#ai konfirmasi ktp {nik}"
 */
export async function handleKonfirmasiKTP(message) {
  const from = message.from;
  const parts = message.body.trim().split(" ");
  const nik = parts[3]; // "#ai konfirmasi ktp {nik}"

  if (!nik) {
    return await replyChatWA(
      message,
      "❌ *Format tidak valid.*\nGunakan: `#ai konfirmasi ktp {nik}`"
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

  // Ambil dataObj dari data.json
  const dataObj = await getPendingKTP(from);
  if (!dataObj || dataObj.nik !== nik) {
    return await replyChatWA(
      message,
      "❌ *Tidak ada data KTP yang menunggu konfirmasi.*\n" +
        "Silakan scan ulang dengan `#ai scan ktp`."
    );
  }
  const [day, month, year] = dataObj.tanggal_lahir.split("-");
  const formattedTglLahir = `${year}-${month}-${day}`;

  // Bangun payload untuk dikirim ke API Laravel
  const payload = {
    nik: dataObj.nik,
    name: dataObj.nama,
    tempat_lahir: dataObj.tempat_lahir,
    tgl_lahir: formattedTglLahir,
    gender: dataObj.jenis_kelamin.toUpperCase() === "LAKI-LAKI" ? "L" : "P",
    alamat: dataObj.alamat,
    rt_rw: dataObj.rt_rw,
    kel_desa: dataObj.kel_desa,
    kecamatan: dataObj.kecamatan,
    agama: dataObj.agama,
    status_perkawinan: dataObj.status_perkawinan,
    pekerjaan: dataObj.pekerjaan,
    pangkat: dataObj.pangkat ?? "",
    jabatan: dataObj.jabatan ?? "",
    phone: from.replace("@c.us", ""),
  };

  try {
    console.log(payload);
    const res = await axios.post(
      `${process.env.LARAVEL_API_BASE_URL}/save/patient`,
      payload
    );
    console.log(res);
    if (res.data?.data && res.data?.status === "success") {
      // Hapus entry dari data.json
      await removePendingKTP(from);

      return await replyChatWA(
        message,
        "✅ *Data KTP Anda berhasil disimpan.*\n" +
          "Terima kasih telah mendaftar."
      );
    } else {
      const msg = res.data?.message || "Gagal menyimpan data.";
      return await replyChatWA(message, `❌ _${msg}_`);
    }
  } catch (err) {
    console.error("❌ Error menyimpan data KTP:", err.message);
    console.log(err);
    return await replyChatWA(
      message,
      "❌ *Terjadi kesalahan server saat menyimpan data.*\n" +
        "Silakan coba lagi nanti."
    );
  }
}
