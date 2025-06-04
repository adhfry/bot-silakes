import { formatPhone } from "../../../utils/formatPhoneNumber.mjs";
import { checkNikRegistered } from "../../api/checkNik.mjs";
import { checkUserPhone, RANK_MAP } from "../../api/config.mjs";
import { callGeminiOCR } from "../../api/geminiOCR.mjs";
import { replyChatWA } from "../sender.mjs";
import { addPendingKTPbyAdmin } from "../utils/pendingKTPStoreAdmin.mjs";

export async function handleDaftarPatient(msg) {
  try {
    const { from, body } = msg;
    const text = body.trim();
    // cek client
    const userPhone = from.replace("@c.us", "");
    const allowed = await checkUserPhone(userPhone);
    if (!allowed) return; // ignore non-internal
    const args = text
      .substring(10)
      .split(",")
      .map((s) => s.trim());
    if (args.length < 3) {
      return await replyChatWA(
        msg,
        "> ❌ Format Salah.\n\nGunakan:\n`#ai daftar nohp, jabatan, pangkat`\n(bersamaan dengan foto KTP)\n\nContoh:\n`#ai daftar 628123456789, Guru, ii.a`"
      );
    }
    const [nohpRaw, jabatanRaw, pangkatRaw] = args;
    const no_hp = nohpRaw;
    if (!no_hp.match(/^(08|628)[0-9]+$/)) {
      return await replyChatWA(
        msg,
        "❌ Nomor HP tidak valid. Mulai dengan 08 atau 628"
      );
    }
    const jabatan = jabatanRaw === "-" ? "" : jabatanRaw;
    const pangkatCode = pangkatRaw.toLowerCase();
    const pangkat = pangkatCode === "-" ? "" : RANK_MAP[pangkatCode] || "";
    if (!msg.hasMedia) {
      return await replyChatWA(
        msg,
        "❌ Kirim foto KTP bersamaan dengan perintah #ai daftar nohp, jabatan, pangkat"
      );
    }
    await replyChatWA(msg, "⏳ Memproses foto KTP...");
    const media = await msg.downloadMedia().catch(() => null);
    if (!media || !media.data || !media.mimetype.startsWith("image")) {
      return await replyChatWA(
        msg,
        "❌ File bukan gambar KTP. Silakan kirim ulang foto KTP yang jelas."
      );
    }

    // tes OCR KTP
    const ocrResult = await callGeminiOCR(media.data).catch(() => "");
    if (!ocrResult || ocrResult.trim() === "INVALID_IMAGE") {
      return await replyChatWA(
        msg,
        "> ❌ Gagal membaca KTP.\n\nPastikan foto KTP jelas dan tidak blur. Silakan kirim ulang foto KTP yang jelas bersama perintah :\n`#ai daftar nohp, jabatan, pangkat`."
      );
    }
    const lines = ocrResult
      .split(/[\r\n|;]/)
      .map((s) => s.trim())
      .filter((s) => s.includes(":"));
    const dataObj = {};
    for (const line of lines) {
      const [key, ...vals] = line.split(":");
      dataObj[key.toLowerCase()] = vals.join(":").trim();
    }
    const nik = dataObj["nik"];
    if (!nik) {
      return await replyChatWA(
        msg,
        "> ❌ NIK tidak terdeteksi.\n\nCoba ulang dengan KTP yang jelas."
      );
    }
    const already = await checkNikRegistered(nik);
    if (already) {
      return await replyChatWA(
        msg,
        "> ❗ Pasien dengan NIK ini sudah terdaftar sebelumnya.\n\nSilakan kirim ulang foto KTP pasien yang belum terdaftar dengan jelas bersama perintah :\n`#ai daftar nohp, jabatan, pangkat`."
      );
    }
    console.log({
      nohpRaw,
      jabatanRaw,
      pangkatRaw,
      no_hp,
      jabatan,
      pangkat,
      nik,
      dataObj,
    });
    await replyChatWA(msg, "> ⏳ _*Proses Menyimpan Data Pending*_ ");
    // 6. simpan KTP ke pending dan preview
    await addPendingKTPbyAdmin(formatPhone(no_hp) + "@c.us", {
      ...dataObj,
      no_hp,
      jabatan,
      pangkat,
      diinput_oleh: userPhone,
    });
    await replyChatWA(msg, "> ✅ _*Proses Menyimpan Selesai*_ ");
    // susun preview
    let preview = "#preview ktp\n\n---\n";
    for (const [k, v] of Object.entries(dataObj))
      preview += `${k.toUpperCase()}:${v}\n`;
    preview += `NO_HP:${no_hp}\nJABATAN:${jabatan}\nPANGKAT:${pangkat}\n---\n\n`;
    preview +=
      "Apakah data di atas sudah benar? Ketik `iya` atau `ya` untuk setuju sembari _reply_ pesan berisi data yang sudah benar, atau jika ada kesalahan silahkan salin pesan ini kemudian tambahkan edit pada `#preview ktp` menjadi `#preview ktp edit`, lalu edit bagian yang salah dan kirim kepada saya.";
    return await replyChatWA(msg, preview);
  } catch (error) {
    console.error("Terjadi kesalahan saat memproses data : ", error);
  }
}
