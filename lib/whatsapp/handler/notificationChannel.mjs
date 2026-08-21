import { postApi, getApi } from "../../api/sendReq.mjs";
import { sendGroupChatWA, replyChatWA } from "../sender.mjs";

export async function handleInitNotificationChannel(message) {
  const chat = await message.getChat();

  if (!chat.isGroup) {
    await replyChatWA(message,
      `╭──────────────╮
│  ⚠️ INITIALIZATION   
│             FAILED            
╰──────────────╯

Perintah ini hanya dapat dijalankan dari *Grup WhatsApp*.

Silakan jalankan kembali dari grup resmi
yang akan digunakan sebagai kanal notifikasi SILAKES.`,
    );
    return;
  }

  const groupId = chat.id._serialized;
  const groupName = chat.name;
  const timestamp = new Date().toLocaleString("id-ID");

  await replyChatWA(message,
    `╭──────────────╮
│ 🏢 UPTD LABKESDA │
│ 🔐 SILAKES SYSTEM │
╰──────────────╯

📡 *CHANNEL IDENTIFICATION REPORT*

📛 Group Name  : ${groupName}
🆔 Group ID    :
\`${groupId}\`

🕒 Detected At : ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━━
Group ini terdeteksi sebagai kandidat
kanal distribusi notifikasi resmi SILAKES.

Notifikasi yang akan dikirim meliputi:
• Pemberitahuan Stok & Kedaluwarsa Reagen
• Monitoring & Kontrol Aset
• Informasi Operasional Laboratorium
• Notifikasi Sistem Penting

Untuk menyetujui dan menyimpan ID ini ke server pusat SILAKES, kirim perintah:

#APPROVE-CHANNEL

━━━━━━━━━━━━━━━━━━━━━━━
© ${new Date().getFullYear()} UPTD Labkesda Sumenep
━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  return;
}

export async function handleApproveChannel(message) {
  const chat = await message.getChat();

  if (!chat.isGroup) return;

  const groupId = chat.id._serialized;
  const groupName = chat.name;
  const timestamp = new Date().toLocaleString("id-ID");

  // TODO: kirim groupId ke Laravel API kamu disini
  try {
    await postApi("/settings/id-group-wa", {
      id_group_wa: groupId,
    });

    await replyChatWA(message,
      `╭──────────────╮
│ ✅ CHANNEL ACTIVE 
│   SILAKES READY   
╰──────────────╯

📡 *STATUS : OFFICIAL CHANNEL REGISTERED*

📛 Group Name  : ${groupName}
🆔 Group ID    :
\`${groupId}\`

🕒 Activated At : ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━━
_Grup ini telah resmi terdaftar_
_sebagai kanal distribusi notifikasi_
_SILAKES - Sistem Informasi Labkesda Sumenep._

Semua pemberitahuan penting terkait:
• Stok Reagen
• Kedaluwarsa
• Monitoring Aset
• Informasi Penting Sistem

akan dikirimkan melalui grup ini.

Terima kasih atas kerja samanya.

━━━━━━━━━━━━━━━━━━━━━━━
© ${new Date().getFullYear()} UPTD Labkesda Sumenep
━━━━━━━━━━━━━━━━━━━━━━━`,
    );

    await sendGroupChatWA(
      groupId,
      `╭──────────────╮
│ ⏰ DAILY REMINDER 
│   CONFIGURATION  
╰──────────────╯

Untuk mengaktifkan pengingat harian SILAKES,
silakan tentukan waktu pengiriman notifikasi.

Gunakan format 24 jam:

#SET-DAILY-REMINDER | HH:MM

Contoh:
#SET-DAILY-REMINDER | 21:05

Sistem akan mengirimkan notifikasi
setiap hari pada waktu yang ditentukan.`,
    );
    return;
  } catch (error) {
    return console.error("❌ Gagal mengirim ID grup ke API:", error.message);
  }
}

export async function handleSetDailyReminder(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  const body = message.body.trim();
  const parts = body.split("|");

  if (parts.length !== 2) {
    return replyChatWA(message,
      `╭──────────────╮
│ ⚠️ FORMAT ERROR 
╰──────────────╯

Gunakan format berikut:

#SET-DAILY-REMINDER | HH:MM

Contoh:
#SET-DAILY-REMINDER | 21:05`,
    );
  }

  const time = parts[1].trim();

  // Validasi format HH:MM
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (!timeRegex.test(time)) {
    return replyChatWA(message,
      `╭──────────────╮
│ ⚠️ INVALID TIME 
╰──────────────╯

Format waktu tidak valid.

Gunakan format 24 jam:
HH:MM

Contoh:
21:05`,
    );
  }

  try {
    await postApi("/settings/daily-reminder", {
      daily_reminder_time: time,
    });

    await replyChatWA(message,
      `╭──────────────╮
│ ✅ CONFIG SAVED 
│   SILAKES READY 
╰──────────────╯

⏰ Reminder Harian : ${time}

Pengingat otomatis akan dikirim
setiap hari pada pukul ${time}.

Konfigurasi dapat diubah kapan saja
dengan perintah yang sama.

© ${new Date().getFullYear()} UPTD Labkesda`,
    );
  } catch (err) {
    await replyChatWA(message,"Terjadi kesalahan saat menyimpan konfigurasi.");
  }
}
