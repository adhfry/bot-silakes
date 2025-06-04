// lib/api/geminiOCR.mjs

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Inisialisasi klien OpenAI (Generative Language API)
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

/**
 * Memproses gambar KTP (base64 tanpa header) dengan Gemini AI untuk OCR.
 *
 * - Mengirimkan gambar sebagai `image_url` (data URI).
 * - Memberi instruksi yang sangat ketat agar tidak halu, hanya mengeluarkan key:value.
 *
 * @param {string} base64Image – String base64 (tanpa “data:image/...;base64,” prefix)
 * @returns {Promise<string>} – Output teks dari Gemini, bisa “INVALID_IMAGE” atau daftar key:value.
 */
export async function callGeminiOCR(base64Image) {
  // Siapkan data URI lengkap, misal “data:image/jpeg;base64,…..”
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  // Buat payload `messages` sesuai dokumentasi Generative Language API
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Anda adalah sistem OCR untuk KTP Indonesia. Pertama, periksa apakah gambar berikut adalah KTP Indonesia yang valid dan jelas:\n${dataUri}\n\nJika gambar BUKAN KTP Indonesia atau tidak cukup jelas, balas persis: INVALID_IMAGE\n\nJika gambar valid, TULISKAN HANYA data berikut dalam format key:value satu entri per baris (no tambahan teks):\nnik:\nnama:\ntempat_lahir:\ntanggal_lahir:\njenis_kelamin:\nalamat:\nrt_rw:\nkel_desa:\nkecamatan:\nagama:\nstatus_perkawinan:\npekerjaan:\n(sertakan semua kunci persis seperti di atas; jika suatu nilai tidak terbaca, kosongkan setelah titik dua).`,
        },
        {
          type: "image_url",
          image_url: {
            url: dataUri,
          },
        },
      ],
    },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: messages,
    });

    // Ambil teks hasil (biasanya di choices[0].message.content)
    const textResult = response.choices?.[0]?.message?.content;

    return textResult || "";
  } catch (err) {
    console.error("❌ Error memanggil Gemini OCR:", err);
    return "";
  }
}
