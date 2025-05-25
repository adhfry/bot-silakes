import { sendChatWA } from "../sender.mjs";

/**
 * Handler untuk "#ai berikan kesimpulan"
 */
export async function handleKesimpulan(message) {
  const from = message.from;
  //   const hasilPemeriksaan = await ambilDataHasilPemeriksaan(from); // kamu buat sendiri
  const hasilPemeriksaan = {
    id: "12345",
    nama: "John Doe",
    pemeriksaan: "Pemeriksaan darah lengkap",
    hasil: "Normal",
    tanggal: "2023-10-01",
    waktu: "10:00",
    catatan: "Tidak ada keluhan",
    kesimpulan: "Hasil pemeriksaan darah lengkap normal.",
  };

  if (!hasilPemeriksaan) {
    return await message.reply("❌ Data hasil pemeriksaan tidak ditemukan.");
  }

  //   const kesimpulan = await getKesimpulanFromAI(hasilPemeriksaan);
  const kesimpulan = hasilPemeriksaan.kesimpulan; // Simulasi kesimpulan dari AI
  await sendChatWA(from, `📝 Kesimpulan hasil pemeriksaan:\n${kesimpulan}`);
}
