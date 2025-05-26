import { sendChatWA } from "../sender.mjs";

export async function handleSaran(message) {
  const parts = message.body.trim().split(" ");
  //   const idSurat = parts[2];
  const idSurat = 2;

  if (!idSurat) {
    return await sendChatWA(
      message.from,
      "❌ Format salah. Gunakan: #ai setuju {id}"
    );
  }

  //   const result = await updateStatusVerifikasi(idSurat, true);
  const result = {
    success: true,
    message: "Verifikasi berhasil.",
  };
  await sendChatWA(
    message.from,
    result.success
      ? "✅ Hasil telah disetujui."
      : "❌ Gagal memproses verifikasi."
  );
}
