// handleSetuju
export async function handleSetuju(message) {
  const parts = message.body.trim().split(" ");
  //   const idSurat = parts[2];
  const idSurat = 2;

  if (!idSurat) {
    return await message.reply("❌ Format salah. Gunakan: #ai setuju {id}");
  }

  //   const result = await updateStatusVerifikasi(idSurat, true);
  const result = {
    success: true,
    message: "Verifikasi berhasil.",
  };
  await message.reply(
    result.success
      ? "✅ Hasil telah disetujui."
      : "❌ Gagal memproses verifikasi."
  );
}
