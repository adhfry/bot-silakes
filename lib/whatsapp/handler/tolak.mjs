import { filterPhone } from "../../../utils/formatPhoneNumber.mjs";
import { tolakPemeriksaan } from "../../api/ConfirmController.mjs";
import { replyChatWA } from "../sender.mjs";

// handleTolak
export async function handleTolak(message) {
  const parts = message.body.trim().split(" ");
  const idSurat = parts[2];
  console.log(parts);

  if (!idSurat) {
    return await replyChatWA(
      message,
      `❌ *Format tidak valid*

Gunakan : ` +
        "```#ai tolak {id}```" +
        `

ID biasanya diberikan secara otomatis saat terdapat hasil pemeriksaan baru atau ketika hasil pemeriksaan telah diperbarui.`
    );
  }
  await replyChatWA(
    message,
    `> ⏳ _*Proses Menolak Surat Hasil Lab dengan ID ${idSurat} sedang berjalan...*_`
  );

  const result = await tolakPemeriksaan(idSurat, filterPhone(message.from));

  if (result.status === "success") {
    return await replyChatWA(message, "> ✅ _*Proses Menolak Selesai*_");
  } else {
    return await replyChatWA(
      message,
      "> ❌ _*Proses Menolak Gagal*_" +
        `
     
     _${result.message}_`
    );
  }
}
