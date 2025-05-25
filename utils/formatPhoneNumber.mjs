/**
 * Konversi nomor HP ke format internasional: dari 08... jadi 628...
 * Jika sudah 628..., tidak diubah.
 * @param {string} phone - Nomor HP
 * @returns {string}
 */
export function formatPhone(phone) {
  if (!phone) return "";
  if (phone.startsWith("62")) return phone;
  return phone.replace(/^0/, "62");
}
