import axios from "axios";
import { formatPhoneKey } from "../../../utils/formatPhoneNumber.mjs";
import { LARAVEL_API_BASE_URL } from "../../api/config.mjs";
import { replyChatWA } from "../sender.mjs";
import {
  getPendingKTPbyAdmin,
  removePendingKTPbyAdmin,
} from "../utils/pendingKTPStoreAdmin.mjs";

export async function handleKonfirmasiDaftar(msg) {
  if (!msg.hasQuotedMsg) return;
  const quoted = await msg.getQuotedMessage();
  if (quoted.type !== "chat" || !quoted.fromMe) return;
  const lowerQuotedText = quoted.body.toLowerCase();
  if (
    !(
      lowerQuotedText.startsWith("#preview ktp") ||
      lowerQuotedText.startsWith("#preview ktp edit")
    )
  ) {
    return;
  }
  const contentMatch = lowerQuotedText.match(/---([\s\S]*?)---/);
  if (!contentMatch) {
    console.log("❌ Tidak ditemukan data dalam batas ---");
    return;
  }
  const dataSection = contentMatch[1].trim(); // Potongan isi antara --- ---
  // Ubah to objek
  const lines = dataSection.split("\n");
  const dataObjRaw = {};
  for (const line of lines) {
    const [key, ...vals] = line.split(":");
    dataObjRaw[key.trim().toLowerCase()] = vals.join(":").trim();
  }
  const pending = await getPendingKTPbyAdmin(
    formatPhoneKey(dataObjRaw["no_hp"])
  );
  if (!pending) {
    return await replyChatWA(
      msg,
      "> ❌ Reply Tidak Valid\n\nData KTP tersebut tidak tersimpan di data pending\n\nSilahkan foto ulang ktp pasien"
    );
  }
  const [day, month, year] = pending.tanggal_lahir.split("-");
  const formattedTglLahir = `${year}-${month}-${day}`;
  const payload = {
    nik: pending.nik,
    name: pending.nama,
    tempat_lahir: pending.tempat_lahir,
    tgl_lahir: formattedTglLahir,
    gender: pending.jenis_kelamin.toUpperCase() === "LAKI-LAKI" ? "L" : "P",
    alamat: pending.alamat,
    rt_rw: pending.rt_rw,
    kel_desa: pending.kel_desa,
    kecamatan: pending.kecamatan,
    agama: pending.agama,
    status_perkawinan: pending.status_perkawinan,
    pekerjaan: pending.pekerjaan,
    jabatan: pending.jabatan == "-" ? "" : pending.jabatan ?? "",
    pangkat: pending.pangkat == "-" ? "" : pending.pangkat ?? "",
    phone: pending.no_hp ?? pending.nohp,
  };
  console.log(payload);
  try {
    const res = await axios.post(
      `${LARAVEL_API_BASE_URL}/save/patient/by/${pending.diinput_oleh}`,
      payload
    );
    if (res.data.status === "success") {
      await removePendingKTPbyAdmin(formatPhoneKey(dataObjRaw["no_hp"]));
      return await replyChatWA(
        msg,
        "> ✅ Pendaftaran Pasien Berhasil\n\nData Pasien berikut telah tersimpan di *Database*" +
          `

        NIK: ${payload.nik}
        Nama: ${payload.name}
        ` +
          "\nTerima kasih."
      );
    } else {
      return await replyChatWA(
        msg,
        `> ❌ Pendaftaran Pasien Gagal\n\n Pesan Kesalahan : ${res.data.message}`
      );
    }
  } catch (e) {
    if (e.response?.data?.message == "Unauthenticated") {
      return await replyChatWA(
        msg,
        "> ❌ Terjadi kesalahan\n\nTidak dapat menyimpan data Pasien, Anda tidak memiliki akses untuk menyimpan data pasien."
      );
    }
    console.error(e);
    return await replyChatWA(
      msg,
      "> ❌ Terjadi kesalahan\n\nTidak dapat menyimpan data Pasien, coba lagi nanti."
    );
  }
}
