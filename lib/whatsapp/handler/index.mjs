import { handleKesimpulan } from "./kesimpulan.mjs";
import { handleSaran } from "./saran.mjs";
import { handleSetuju } from "./setuju.mjs";
import { handleTolak } from "./tolak.mjs";
import { handleScanKTP } from "./scanKTP.mjs";
import { handleKonfirmasiKTP } from "./konfirmasiKTP.mjs";
import { handleDaftarPatient } from "./daftarPatient.mjs";
import { handleKonfirmasiDaftar } from "./konfirmasiDaftarPatient.mjs";
import { handleEditDataPatient } from "./editDataPatient.mjs";
import { handleEditDataScanKTP } from "./editDataScanKTP.mjs";
import { handleDaftarPemeriksaan } from "./daftarPemeriksaan.mjs";

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
  } else if (lowerText.startsWith("#ai tolak")) {
    return await handleTolak(message);
  } else if (lowerText.toLowerCase().startsWith("#ai daftar")) {
    return await handleDaftarPatient(message);
  }

  if (lowerText.startsWith("#ai scan ktp")) {
    return await handleScanKTP(message);
  } else if (lowerText.startsWith("#ai konfirmasi ktp")) {
    return await handleKonfirmasiKTP(message);
  } else if (lowerText.startsWith("#ai tes narkoba")) {
    return await handleDaftarPemeriksaan(message);
  } else if (lowerText.startsWith("#ai berikan kesimpulan")) {
    return await handleKesimpulan(message);
  } else if (lowerText.startsWith("#ai berikan saran")) {
    return await handleSaran(message);
  } else {
    // Jika tidak ada perintah yang cocok, balas pesan “perintah tidak dikenal”
    return await message.reply(
      "❌ Perintah tidak dikenal.\nSilakan gunakan:\n" +
        "- #ai scan ktp, [noHp] (kirim foto KTP)\n" +
        "- #ai tes narkoba (Narkoba 7 Parameter)\n" +
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

export async function handleEditData(message) {
  const text = message.body.trim();
  const lowerText = text.toLowerCase();
  console.log({
    text,
    lowerText,
  });

  if (
    text.startsWith("> 📝 *Data KTP Anda") ||
    lowerText.startsWith("> 📝 Data KTP Anda")
  ) {
    return handleEditDataScanKTP(message);
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
