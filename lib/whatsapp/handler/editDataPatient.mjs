import {
  formatPhone,
  formatPhoneKey,
} from "../../../utils/formatPhoneNumber.mjs";
import { replyChatWA } from "../sender.mjs";
import {
  addPendingKTPbyAdmin,
  getPendingKTPbyAdmin,
} from "../utils/pendingKTPStoreAdmin.mjs";

export async function handleEditDataPatient(msg) {
  try {
    const text = msg.body.trim();
    const lowerText = text.toLowerCase();
    const contentMatch = lowerText.match(/---([\s\S]*?)---/);
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
      dataObjRaw[key.trim().toLowerCase()] = vals
        .join(":")
        .trim()
        .toUpperCase();
    }
    console.log("raw ", dataObjRaw);
    const pending = await getPendingKTPbyAdmin(
      formatPhoneKey(dataObjRaw["no_hp"])
    );
    if (!pending) {
      return await replyChatWA(
        msg,
        "> ❌ Reply Tidak Valid\n\nData KTP tersebut tidak tersimpan di data pending\n\nSilahkan foto ulang ktp pasien"
      );
    }
    // susun preview
    let preview = "#preview ktp\n\n---\n";
    for (const [k, v] of Object.entries(dataObjRaw)) {
      if (k === "diinput_oleh") {
        continue;
      }
      preview += `${k.toUpperCase()}:${v.toUpperCase()}\n`;
    }
    preview +=
      "---\n\nApakah data di atas sudah benar? Ketik `iya` atau `ya` untuk setuju sembari _reply_ pesan berisi data yang sudah benar, atau jika ada kesalahan silahkan salin pesan ini kemudian tambahkan edit pada `#preview ktp` menjadi `#preview ktp edit`, lalu edit bagian yang salah dan kirim kepada saya.";
    const userPhone = msg.from.replace("@c.us", "");
    await addPendingKTPbyAdmin(formatPhoneKey(dataObjRaw["no_hp"]), {
      ...dataObjRaw,
      diinput_oleh: userPhone,
    });
    return await replyChatWA(msg, preview);
  } catch (error) {
    console.error(error);
    return await replyChatWA(msg, "Terjadi Kesalahan...");
  }
}
