// handleTolak
export async function handleTolak(message) {
  const parts = message.body.trim().split(" ");
  //   const idSurat = parts[2];
  const idSurat = 2;

  if (!idSurat) {
    return await message.reply("❌ Format salah. Gunakan: #ai tolak {id}");
  }

  //   const result = await updateStatusVerifikasi(idSurat, false);
  const result = {
    success: true,
    message: "Verifikasi berhasil.",
  };
  await message.reply(
    result.success
      ? "✅ Hasil telah ditolak."
      : "❌ Gagal memproses verifikasi."
  );
}
