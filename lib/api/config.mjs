import axios from "axios";
import dotenv from "dotenv";
import { sendChatWA } from "../whatsapp/sender.mjs";
import { formatPhone } from "../../utils/formatPhoneNumber.mjs";
dotenv.config();

export const { APP_ENV, LARAVEL_API_BASE_URL, GEMINI_API_KEY } = process.env;

const isLocal = APP_ENV === "local";
const isProduction = APP_ENV === "production";

/**
 * Fetch daftar nomor admin [] dari API
 */
export async function fetchDaftarAdmin() {
  try {
    const res = await axios.post(
      `${LARAVEL_API_BASE_URL}/get-all/admin-numbers`,
      {
        key: "kesehatanNo1",
      }
    );

    return (res.data.data || []).map((num) =>
      num.startsWith("08") ? "628" + num.slice(2) : num
    );
    // .map(num => num.includes('@c.us') ? num : `${num}@c.us`);
  } catch (error) {
    console.error("❌ Gagal mengambil daftar admin:", error.message);
    return [];
  }
}

/**
 * Get info tentang surat pemeriksaan
 */
export async function getInfoSuratPemeriksaan(idSurat) {
  const url = `${LARAVEL_API_BASE_URL}/get-info/hasil/${idSurat}`;
  console.log("URL Info Surat:", url);
  const { data } = await axios.post(url, {
    key: "kesehatanNo1",
  });
  console.log("Response Info Surat:", data.status, data.data);

  if (data.status !== "success" || !data.data) {
    throw new Error(`Gagal mendapatkan info surat, status: ${data.status}`);
  }
  if (data.data.length === 0) {
    throw new Error("Data surat tidak ditemukan");
  }
  return data.data;
}
/**
 * Download PDF Hasil Pemeriksaan to buffer
 */
export async function downloadPDF(resultId) {
  const dataSurat = await getInfoSuratPemeriksaan(resultId);
  const url = `${LARAVEL_API_BASE_URL}/pemeriksaan/${resultId}/download-pdf`;
  const res = await axios.get(url, { responseType: "arraybuffer" });

  if (res.status !== 200 || !res.data) {
    throw new Error(`Download PDF gagal, status: ${res.status}`);
  }

  // Format nomor (hanya jika tersedia)
  const atlmPhone = dataSurat.atlm?.phone
    ? formatPhone(dataSurat.atlm.phone)
    : null;
  const administrasiPhone = dataSurat.dibuat_oleh?.phone
    ? formatPhone(dataSurat.dibuat_oleh.phone)
    : null;
  const editorPhone = dataSurat.diedit_oleh?.phone
    ? formatPhone(dataSurat.diedit_oleh.phone)
    : null;

  // ================================
  // 1. Pesan untuk EDITOR jika ada edit
  // ================================
  if (dataSurat.diedit_oleh) {
    // Bangun pesan hanya jika diedit_oleh ada
    const pesanAdminEdit = `> ✅ *Berhasil Mengedit Hasil Pemeriksaan*

Anda baru saja mengedit hasil pemeriksaan berikut:

📄 *Data Pasien:*
• Nama: ${dataSurat.patient.name}
• NIK: ${dataSurat.patient.nik}
• No. Reg: ${dataSurat.patient.no_reg}

⏳ Silahkan Menunggu konfirmasi dari Admin.
Terima kasih 🙏`;

    const pesanAdminEditOther = `> ✅ *Hasil Pemeriksaan Anda Telah Diedit*

👨‍💼 *Editor:* ${dataSurat.diedit_oleh.name}

📄 *Data Pasien:*
• Nama: ${dataSurat.patient.name}
• NIK: ${dataSurat.patient.nik}
• No. Reg: ${dataSurat.patient.no_reg}

⏳ Silahkan Menunggu konfirmasi dari Admin.
Terima kasih 🙏`;

    // Jika editor sama dengan administrasi, kirim ke editor saja
    if (editorPhone && editorPhone == administrasiPhone) {
      await sendChatWA(administrasiPhone, pesanAdminEdit);
    }
    // Jika editor berbeda
    else if (editorPhone) {
      await sendChatWA(administrasiPhone, pesanAdminEditOther);
      await sendChatWA(editorPhone, pesanAdminEdit);
    }
  }

  // ================================
  // 2. Pesan untuk ADMINISTRASI (dibuat_oleh) bila bukan edit
  // ================================
  else if (dataSurat.dibuat_oleh) {
    const pesanAdmin = `> ✅ *Berhasil Menyimpan Hasil Pemeriksaan*

📄 *Data Pasien:*
• Nama: ${dataSurat.patient.name}
• NIK: ${dataSurat.patient.nik}
• No. Reg: ${dataSurat.patient.no_reg}

⏳ Silahkan Menunggu konfirmasi dari Admin.
Terima kasih 🙏`;

    if (administrasiPhone) {
      await sendChatWA(administrasiPhone, pesanAdmin);
    }
  }

  // ================================
  // 3. Pesan untuk ATLM
  // ================================
  if (dataSurat.atlm) {
    const pesanATLM = `> 📢 *Hasil Lab Telah Diinput oleh Administrasi*

👨‍💼 *Administrasi:* ${dataSurat.dibuat_oleh?.name || "-"}  

📄 *Data Pasien:*
• Nama: ${dataSurat.patient.name}
• NIK: ${dataSurat.patient.nik}
• No. Reg: ${dataSurat.patient.no_reg}

🙏 Terima kasih atas kerja samanya.`;

    if (atlmPhone) {
      await sendChatWA(atlmPhone, pesanATLM);
    }
  }
  return {
    buffer: Buffer.from(res.data, "binary"),
    contentType: res.headers["content-type"] || "application/pdf",
    fileName: `Hasil Pemeriksaan ${dataSurat.patient.name}.pdf`,
  };
}

/**
 * Konfirmasi ke API Laravel Setuju/Tolak
 * @param {string} idSurat - ID surat pemeriksaan
 * @param {string} typeConfirm - "setuju" atau "tolak"
 */
export async function confirmSuratPemeriksaan(idSurat, typeConfirm) {
  const url = `${LARAVEL_API_BASE_URL}/pemeriksaan/confirm/surat/${idSurat}`;
  const { data } = await axios.post(url, {
    key: "kesehatanNo1",
    typeConfirm,
  });

  if (data.status !== "success") {
    throw new Error(`Konfirmasi gagal: ${data.message}`);
  }
  return data.data;
}

/**
 * Check phone number by user
 */
export async function checkUserPhone(phone) {
  const res = await axios.post(`${LARAVEL_API_BASE_URL}/cek-user/phone`, {
    phone,
    key: "kesehatanNo1",
  });
  return res.data.data.allowed; // expects { data: { allowed: true/false } }
}

export const RANK_MAP = {
  "i.a": "Juru Muda / I.a",
  "i.b": "Juru Muda Tk I / I.b",
  "i.c": "Juru / I.c",
  "i.d": "Juru Tk I / I.d",
  "ii.a": "Pengatur Muda / II.a",
  "ii.b": "Pengatur Muda Tk I / II.b",
  "ii.c": "Pengatur / II.c",
  "ii.d": "Pengatur Tk I / II.d",
  "iii.a": "Penata Muda / III.a",
  "iii.b": "Penata Muda Tk I / III.b",
  "iii.c": "Penata / III.c",
  "iii.d": "Penata Tk I / III.d",
  "iv.a": "Pembina / IV.a",
  "iv.b": "Pembina Tk I / IV.b",
  "iv.c": "Pembina Utama Muda / IV.c",
  "iv.d": "Pembina Madya / IV.d",
  "iv.e": "Pembina Utama / IV.e",
};
