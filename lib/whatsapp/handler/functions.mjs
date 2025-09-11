export function getTimeNow() {
  const options = {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "long", // 'long' akan menghasilkan nama bulan lengkap (e.g., "September")
    day: "2-digit", // '2-digit' akan menghasilkan '03' bukan '3'
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Menggunakan format 24 jam
  };

  // Buat objek formatter dengan lokal 'id-ID' dan opsi di atas
  const formatter = new Intl.DateTimeFormat("id-ID", options);

  // Dapatkan bagian-bagian tanggal dalam zona waktu yang benar
  const parts = formatter.formatToParts(new Date());

  // Ubah array 'parts' menjadi objek agar lebih mudah diakses
  const dateParts = {};
  parts.forEach((part) => {
    dateParts[part.type] = part.value;
  });

  // Susun string sesuai format yang diinginkan
  const formattedTime = `${dateParts.day} ${dateParts.month} ${dateParts.year} Pukul ${dateParts.hour}:${dateParts.minute}:${dateParts.second} WIB`;
  return formattedTime;
}
