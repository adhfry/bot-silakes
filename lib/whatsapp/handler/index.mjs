import { replyChatWA } from "../sender.mjs";
import { handleSaran } from "./saran.mjs";
import { handleSetuju } from "./setuju.mjs";
import { handleDaftarPatient } from "./daftarPatient.mjs";
import { handleKonfirmasiDaftar } from "./konfirmasiDaftarPatient.mjs";
import { handleEditDataPatient } from "./editDataPatient.mjs";
import {
  handleTesNarkoba,
  handleKonfirmasiDaftarPemeriksaanNarkoba,
  handlePemeriksaanSebelumnyaNarkoba,
} from "./tesNarkoba.mjs";
import {
  handleKonfirmasiDaftarPemeriksaanSuketSehat,
  handlePemeriksaanSebelumnyaSuketSehat,
  handleTesSuketSehat,
} from "./tesSuketSehat.mjs";

/**
 * Router handler utama
 * @param {import('whatsapp-web.js').Message} message
 */
export async function handleIncomingMessage(message) {
  const text = message.body.trim();
  const lowerText = text.toLowerCase();
  console.log({
    text,
    lowerText,
  });

  // untuk internal labkesda
  if (lowerText.startsWith("#ai setuju")) {
    return await handleSetuju(message);
  } else if (lowerText.toLowerCase().startsWith("#ai daftar")) {
    return await handleDaftarPatient(message);
  }

  if (lowerText.startsWith("#ai tes narkoba")) {
    return await handleTesNarkoba(message);
  } else if (lowerText.startsWith("#ai tes suket sehat")) {
    return await handleTesSuketSehat(message);
  } else if (lowerText.startsWith("#ai berikan saran")) {
    return await handleSaran(message);
  } else {
    // Jika tidak ada perintah yang cocok, balas pesan “perintah tidak dikenal”
    return await replyChatWA(
      message,
      "❌ Perintah tidak dikenal.\nSilakan gunakan:\n" +
        "- #ai tes narkoba (Narkoba 7 Parameter)\n" +
        "- #ai tes suket sehat (Surat Ket. Sehat)\n" +
        "- #ai berikan saran\n",
    );
  }
}

export async function handlePreviewMessage(message) {
  const text = message.body.trim();
  const lowerText = text.toLowerCase();
  console.log({
    text,
    lowerText,
  });

  if (
    lowerText.startsWith("#preview ktp edit") ||
    lowerText.startsWith("#preview ktp")
  ) {
    return await handleEditDataPatient(message);
  }
}

/**
 * Untuk menghandle reply pesan
 *
 * @param {import("whatsapp-web.js").Message} message
 * @returns
 */
export async function handleReplyChatMessage(message) {
  const text = message.body.trim();
  const lowerText = text.toLowerCase();
  const quotedText = await message.getQuotedMessage();
  if (quotedText.type !== "chat" || !quotedText.fromMe) return;
  const lowerQuotedText = quotedText.body.toLowerCase();
  console.log({
    quotedText,
    lowerQuotedText,
    text,
    lowerText,
  });

  //untuk reply pesan
  if (
    ["y", "ya", "iya", "iyaa"].includes(lowerText) &&
    (lowerQuotedText.startsWith("#preview ktp") ||
      lowerQuotedText.startsWith("#preview ktp edit"))
  ) {
    return await handleKonfirmasiDaftar(message);
  }
  if (
    ["y", "ya", "iya", "iyaa"].includes(lowerText) &&
    lowerQuotedText &&
    lowerQuotedText.includes(
      "apakah hari ini anda ingin melakukan pemeriksaan *narkoba 7 parameter*",
    )
  ) {
    return await handleKonfirmasiDaftarPemeriksaanNarkoba(message);
  }
  if (
    lowerQuotedText.startsWith("⚠️ anda memiliki pemeriksaan") &&
    lowerQuotedText.includes("lanjutkan pemeriksaan saat ini (narkoba)")
  ) {
    console.log("kesini");
    return await handlePemeriksaanSebelumnyaNarkoba(message);
  }

  if (
    ["y", "ya", "iya", "iyaa"].includes(lowerText) &&
    (lowerQuotedText.includes(
      "apakah hari ini anda ingin melakukan pemeriksaan *surat keterangan sehat*",
    ) ||
      lowerQuotedText.includes(
        "Apakah hari ini Anda ingin melakukan pemeriksaan *Surat Keterangan Sehat*",
      ))
  ) {
    return await handleKonfirmasiDaftarPemeriksaanSuketSehat(message);
  }
  // Cukup tambahkan `lowerQuotedText &&` di awal
  if (
    lowerQuotedText.startsWith("⚠️ anda memiliki pemeriksaan") &&
    lowerQuotedText.includes("lanjutkan pemeriksaan saat ini (suket sehat)")
  ) {
    console.log("kesini");
    return await handlePemeriksaanSebelumnyaSuketSehat(message);
  }
}
