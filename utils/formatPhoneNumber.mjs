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

/**
 * Konversi nomor HP ke format internasional: dari 08... jadi 628...
 * Jika sudah 628..., tidak diubah.
 * Kemudian ditambah @c.us
 * @param {string} phone - Nomor HP
 * @returns {string}
 */
export function formatPhoneKey(phone) {
  if (!phone) return "";
  if (phone.startsWith("62")) return phone + "@c.us";
  return phone.replace(/^0/, "62") + "@c.us";
}

/**
 * Menghapus semua karakter non-digit dari string.
 *
 * @param {string} rawPhone  Nomor telepon raw, misal "628123456789@c.us"
 * @return {string}          Hanya digit, misal "628123456789"
 */
export function filterPhone(rawPhone) {
  if (typeof rawPhone !== "string") {
    throw new TypeError("Parameter harus string");
  }
  // \D mencocokkan karakter non-digit; g = global
  return rawPhone.replace(/\D+/g, "");
}
