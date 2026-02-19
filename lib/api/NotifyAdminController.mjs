import pkg from "whatsapp-web.js";
import { downloadPDF } from "./config.mjs";
import { fetchDaftarAdmin } from "./config.mjs";
import { sendChatWAMedia, sendChatWA } from "../whatsapp/sender.mjs";
import { client } from "../whatsapp/client.mjs";
import { formatPhone } from "../../utils/formatPhoneNumber.mjs";
import { getInfoSuratPemeriksaan } from "./config.mjs";
import { delay, randomDelay } from "../helper/delay.mjs";
const { MessageMedia } = pkg;

export async function notifyAdmin(message) {
  try {
    // 2. Ambil daftar admin
    const daftarAdmin = await fetchDaftarAdmin();
    for (const nomor of daftarAdmin) {
      // 3. Kirim pesan ke admin
      const chat = await client.getChatById(
        nomor.includes("@c.us") ? nomor : `${nomor}@c.us`,
      );
      if (!chat) {
        console.error(`❌ Gagal mendapatkan chat untuk ${nomor}`);
        continue;
      }
      await delay(randomDelay());
      // simulasi "typing..."
      await message.getChat().then((chat) => chat.sendStateTyping());

      const typingDelay = Math.min(15000, message.body.length * 120);
      await delay(typingDelay);
      await sendChatWA(nomor, message);
    }
    return true;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan ke admin:", error.message);
    return false;
  }
}

// pesan konfirmasi otomatis

const sendDisetujui = async (
  surat,
  atlmPhone,
  administrasiPhone,
  editorPhone,
) => {
  try {
    // ================================
    // 1. Pesan untuk EDITOR jika ada edit
    // ================================
    if (surat.diedit_oleh) {
      // Bangun pesan hanya jika diedit_oleh ada
      const pesanAdminEdit = `> ✅ *Hasil Pemeriksaan Disetujui*

Hasil Pemeriksaan yang telah anda edit telah disetujui oleh Admin.

📄 *Data Pasien:*
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🕵️‍♂️ Disetujui oleh Admin: ${surat.dikonfirmasi_oleh.name}
⌚ Waktu Disetujui: ${surat.tgl_konfirmasi}

Silahkan refresh kembali halaman antrian konfirmasi.

🎉 Terima kasih atas kerja samanya.
🙏 Semangat selalu dalam pelayanan 💪`;

      const pesanAdminEditOther = `> ✅ *Hasil Pemeriksaan Disetujui*

Hasil Pemeriksaan yang telah anda inputkan telah disetujui oleh Admin.

👨‍💼 *Editor:* ${surat.diedit_oleh.name}

📄 *Data Pasien:*
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🕵️‍♂️ Disetujui oleh Admin: ${surat.dikonfirmasi_oleh.name}
⌚ Waktu Disetujui: ${surat.tgl_konfirmasi}

Silahkan refresh kembali halaman antrian konfirmasi.

🎉 Terima kasih atas kerja samanya.
🙏 Semangat selalu dalam pelayanan 💪`;

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
    else if (surat.dibuat_oleh) {
      const pesanAdmin = `> ✅ *Hasil Pemeriksaan Disetujui*

Hasil Pemeriksaan yang telah anda inputkan telah disetujui oleh Admin.

📄 *Data Pasien:*
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🕵️‍♂️ Disetujui oleh Admin: ${surat.dikonfirmasi_oleh.name}
⌚ Waktu Disetujui: ${surat.tgl_konfirmasi}

Silahkan refresh kembali halaman antrian konfirmasi.

🎉 Terima kasih atas kerja samanya.
🙏 Semangat selalu dalam pelayanan 💪`;

      if (administrasiPhone) {
        await sendChatWA(administrasiPhone, pesanAdmin);
      }
    }

    // ================================
    // 3. Pesan untuk ATLM
    // ================================
    if (surat.atlm) {
      const pesanATLM = `> ✅ *Hasil Pemeriksaan Disetujui*

Hasil Pemeriksaan yang telah diinputkan oleh Administrasi telah disetujui oleh Admin.

👨‍💼 *Administrasi:* ${surat.dibuat_oleh?.name || "-"}  

📄 *Data Pasien:*
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🕵️‍♂️ Disetujui oleh Admin: ${surat.dikonfirmasi_oleh.name}
⌚ Waktu Disetujui: ${surat.tgl_konfirmasi}

🙏 Terima kasih atas ketelitian dan dedikasinya dalam pemeriksaan ini.
Semangat terus dalam memberikan pelayanan terbaik! 💪`;

      if (atlmPhone) {
        await sendChatWA(atlmPhone, pesanATLM);
      }
    }
    return true;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan disetujui:", error.message);
    return false;
  }
};
const sendDitolak = async (
  surat,
  atlmPhone,
  administrasiPhone,
  editorPhone,
) => {
  try {
    // ================================
    // 1. Pesan untuk EDITOR jika ada edit
    // ================================
    if (surat.diedit_oleh) {
      // Bangun pesan hanya jika diedit_oleh ada
      const pesanAdminEdit = `> ❌ *Hasil Pemeriksaan Ditolak*

Hasil Pemeriksaan yang telah anda edit telah ditolak oleh Admin.

📄 *Data Pasien:*
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🕵️‍♂️ Ditolak oleh Admin: ${surat.dikonfirmasi_oleh.name}
⌚ Waktu Ditolak: ${surat.tgl_konfirmasi}

🙏 Semangat selalu dalam pelayanan 💪`;

      const pesanAdminEditOther = `> ❌ *Hasil Pemeriksaan Ditolak*

Hasil Pemeriksaan yang telah anda inputkan telah ditolak oleh Admin.

👨‍💼 *Editor:* ${surat.diedit_oleh.name}

📄 *Data Pasien:*
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🕵️‍♂️ Ditolak oleh Admin: ${surat.dikonfirmasi_oleh.name}
⌚ Waktu Ditolak: ${surat.tgl_konfirmasi}

🙏 Semangat selalu dalam pelayanan 💪`;

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
    else if (surat.dibuat_oleh) {
      const pesanAdmin = `> ❌ *Hasil Pemeriksaan Ditolak*

Hasil Pemeriksaan yang telah anda inputkan telah ditolak oleh Admin.

📄 *Data Pasien:*
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🕵️‍♂️ Ditolak oleh Admin: ${surat.dikonfirmasi_oleh.name}
⌚ Waktu Ditolak: ${surat.tgl_konfirmasi}

🙏 Semangat selalu dalam pelayanan 💪`;

      if (administrasiPhone) {
        await sendChatWA(administrasiPhone, pesanAdmin);
      }
    }

    // ================================
    // 3. Pesan untuk ATLM
    // ================================
    if (surat.atlm) {
      const pesanATLM = `> ❌ *Hasil Pemeriksaan Ditolak*

Hasil Pemeriksaan yang telah diinputkan oleh Administrasi telah ditolak oleh Admin.

👨‍💼 *Administrasi:* ${surat.dibuat_oleh?.name || "-"}  

📄 *Data Pasien:*
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🕵️‍♂️ Ditolak oleh Admin: ${surat.dikonfirmasi_oleh.name}
⌚ Waktu Ditolak: ${surat.tgl_konfirmasi}

🙏 Semangat terus dalam memberikan pelayanan terbaik! 💪`;

      if (atlmPhone) {
        await sendChatWA(atlmPhone, pesanATLM);
      }
    }
    return true;
  } catch (error) {
    console.error("❌ Gagal mengirim pesan disetujui:", error.message);
    return false;
  }
};

export async function notifyUserConfirmByWeb(idSurat, typeConfirm) {
  try {
    // 1. ambil info surat
    const surat = await getInfoSuratPemeriksaan(idSurat);
    if (!surat || surat.length === 0) {
      console.error(" Data surat tidak ditemukan");
      return false;
    }
    // Format nomor (hanya jika tersedia)
    const atlmPhone = surat.atlm?.phone ? formatPhone(surat.atlm.phone) : null;
    const administrasiPhone = surat.dibuat_oleh?.phone
      ? formatPhone(surat.dibuat_oleh.phone)
      : null;
    const editorPhone = surat.diedit_oleh?.phone
      ? formatPhone(surat.diedit_oleh.phone)
      : null;
    const confirmPhone = surat.dikonfirmasi_oleh?.phone
      ? formatPhone(surat.dikonfirmasi_oleh.phone)
      : null;
    const isAcc = typeConfirm === "approved" ? true : false;

    console.log("✅ Data surat ditemukan:", surat);
    console.log("Tipe konfirmasi:", typeConfirm);
    const messageConfirmSelf = `> ${isAcc ? "✅" : "❌"} *Berhasil ${
      isAcc ? "Menyetujui" : "Menolak"
    } Pemeriksaan*

⌚ Waktu ${isAcc ? "Disetujui" : "Ditolak"}: ${surat.tgl_konfirmasi}

👨‍💼 *Administrasi:* ${surat.dibuat_oleh?.name || "-"}  
👨‍💼 *Editor:* ${surat.diedit_oleh?.name || "-"}

📄 *Data Pasien:*
• ID: ${surat.id}
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🎉 Terima kasih atas kerja samanya.
🙏 Semangat selalu dalam pelayanan 💪`;
    const messageConfirm = `> 📢 *[Info] Pemeriksaan Telah ${
      isAcc ? "Disetujui" : "Ditolak"
    }*

🕵️‍♂️ ${isAcc ? "Disetujui" : "Ditolak"} oleh Admin: ${
      surat.dikonfirmasi_oleh.name
    }
⌚ Waktu ${isAcc ? "Disetujui" : "Ditolak"}: ${surat.tgl_konfirmasi}

👨‍💼 *Administrasi:* ${surat.dibuat_oleh?.name || "-"}  
👨‍💼 *Editor:* ${surat.diedit_oleh?.name || "-"}

📄 *Data Pasien:*
• ID: ${surat.id}
• Nama: ${surat.patient.name}
• NIK: ${surat.patient.nik}
• No. Reg: ${surat.patient.no_reg}

🎉 Terima kasih atas kerja samanya.
🙏 Semangat selalu dalam pelayanan 💪`;
    const daftarAdmin = await fetchDaftarAdmin();
    for (const nomor of daftarAdmin) {
      // 3. Kirim pesan ke admin
      const chat = await client.getChatById(
        nomor.includes("@c.us") ? nomor : `${nomor}@c.us`,
      );
      if (!chat) {
        console.error(`❌ Gagal mendapatkan chat untuk ${nomor}`);
        continue;
      }
      if (nomor == confirmPhone) {
        await sendChatWA(nomor, messageConfirmSelf);
        continue;
      }
      await sendChatWA(nomor, messageConfirm);
    }
    if (surat.status_konfirmasi === "approved") {
      await sendDisetujui(surat, atlmPhone, administrasiPhone, editorPhone);
    } else if (surat.status_konfirmasi === "rejected") {
      await sendDitolak(surat, atlmPhone, administrasiPhone, editorPhone);
    }

    return true;
    // 2. notifikasi ke user
  } catch (error) {
    console.error("❌ Gagal mengirim notifikasi konfirmasi:", error.message);
    return false;
  }
}
