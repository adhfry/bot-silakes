import { filterPhone } from "../../../utils/formatPhoneNumber.mjs";
import { setujuPemeriksaan } from "../../api/ConfirmController.mjs";
import { sendMessageAll } from "../../phoenix/notificationPhx.mjs";
import { replyChatWA } from "../sender.mjs";

// handleSetuju
export async function handleSetuju(message) {
  const parts = message.body.trim().split(" ");
  const idSurat = parts[2];
  console.log(parts);

  if (!idSurat) {
    return await replyChatWA(
      message,
      `❌ *Format tidak valid*

Gunakan : ` +
        "```#ai setuju {id}```" +
        `

ID biasanya diberikan secara otomatis saat terdapat hasil pemeriksaan baru atau ketika hasil pemeriksaan telah diperbarui.`
    );
  }
  await replyChatWA(
    message,
    `> ⏳ _*Proses Menyetujui Surat Hasil Lab dengan ID ${idSurat} sedang berjalan...*_`
  );

  const result = await setujuPemeriksaan(idSurat, filterPhone(message.from));

  if (result.status === "success") {
    sendMessageAll("Baru Saja Menyetujui Hasil Pemeriksaan", "Admin");
    return await replyChatWA(message, "> ✅ _*Proses Menyetujui Selesai*_");
  } else {
    return await replyChatWA(
      message,
      "> ❌ _*Proses Menyetujui Gagal*_" +
        `
     
     _${result.message}_`
    );
  }
}
