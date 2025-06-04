import { handleKesimpulan } from "./kesimpulan.mjs";
import { handleSaran } from "./saran.mjs";
import { handleSetuju } from "./setuju.mjs";
import { handleTolak } from "./tolak.mjs";
import { handleScanKTP } from "./scanKTP.mjs";
import { handleKonfirmasiKTP } from "./konfirmasiKTP.mjs";
import { handleDaftarPatient } from "./daftarPatient.mjs";
import { handleKonfirmasiDaftar } from "./konfirmasiDaftarPatient.mjs";
import { handleEditDataPatient } from "./editDataPatient.mjs";

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
  if (text.startsWith("#ai setuju")) {
    return await handleSetuju(message);
  } else if (text.startsWith("#ai tolak")) {
    return await handleTolak(message);
  } else if (text.toLowerCase().startsWith("#ai daftar")) {
    return await handleDaftarPatient(message);
  }

  if (text.startsWith("#ai scan ktp")) {
    return await handleScanKTP(message);
  } else if (text.startsWith("#ai konfirmasi ktp")) {
    return await handleKonfirmasiKTP(message);
  } else if (text.startsWith("#ai berikan kesimpulan")) {
    return await handleKesimpulan(message);
  } else if (text.startsWith("#ai berikan saran")) {
    return await handleSaran(message);
  } else {
    // Jika tidak ada perintah yang cocok, balas pesan “perintah tidak dikenal”
    return await message.reply(
      "❌ Perintah tidak dikenal.\nSilakan gunakan:\n" +
        "- #ai scan ktp (kirim foto KTP)\n" +
        "- #ai berikan kesimpulan\n" +
        "- #ai berikan saran\n"
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

export async function handleReplyChatMessage(message) {
  const text = message.body.trim();
  const lowerText = text.toLowerCase();
  console.log({
    text,
    lowerText,
  });

  //untuk reply pesan
  if (lowerText === "ya" || lowerText === "iya" || lowerText === "y") {
    return await handleKonfirmasiDaftar(message);
  }
}
