// lib/api/checkNik.mjs

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/**
 * Memanggil endpoint Laravel: /api/cek-nik/registered/{nik}
 *
 * Return: true jika terdaftar, false jika belum
 */
export async function checkNikRegistered(nik) {
  try {
    const url = `${process.env.LARAVEL_API_BASE_URL}/cek-nik/registered/${nik}`;
    const res = await axios.get(url);
    console.log("Hasil res : ", res);
    console.log("Hasil cek nik : ", res.data.data.registered);
    // Anggap respons { registered: true/false }
    return res.data.data.registered === true;
  } catch (err) {
    console.error("❌ Error checkNikRegistered:", err.message);
    throw err;
  }
}
