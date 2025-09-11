import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
// import { convert } from "pdf-poppler";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  getInfoSuratPasien,
  getInfoSuratPemeriksaan,
} from "../../api/config.mjs";

const { APP_ENV, LARAVEL_API_BASE_URL } = process.env;

export async function getPDF(idSurat) {
  const dataSurat = await getInfoSuratPemeriksaan(idSurat);
  const url = `${LARAVEL_API_BASE_URL}/pemeriksaan/result/${idSurat}/download-pdf`;
  const res = await axios.get(url, { responseType: "arraybuffer" });

  if (res.status !== 200 || !res.data) {
    throw new Error(`Download PDF gagal, status: ${res.status}`);
  }
  return {
    buffer: Buffer.from(res.data, "binary"),
    contentType: res.headers["content-type"] || "application/pdf",
    fileName: `Hasil Pemeriksaan ${dataSurat.patient.name}.pdf`,
  };
}

export async function getDownloadAntrianPDF(idSurat) {
  const dataSurat = await getInfoSuratPasien(idSurat);
  const url = `${LARAVEL_API_BASE_URL}/download/${idSurat}/antrian-pdf`;
  const res = await axios.get(url, { responseType: "arraybuffer" });

  if (res.status !== 200 || !res.data) {
    throw new Error(`Download PDF gagal, status: ${res.status}`);
  }
  return {
    buffer: Buffer.from(res.data, "binary"),
    contentType: res.headers["content-type"] || "application/pdf",
    fileName: `Daftar Antrian ${dataSurat.patient.name}.pdf`,
  };
}
/**
 * Ambil PDF dari API lalu konversi ke gambar
 * @param {string} idSurat
 * @returns {Promise<{buffer: Buffer, contentType: string, fileName: string}>}
 */
export async function getPDFToImg(idSurat) {
  let tempPdfPath;
  try {
    const pdfData = await getDownloadAntrianPDF(idSurat);
    if (!pdfData || !pdfData.buffer) {
      throw new Error("❌ Gagal mendapatkan buffer PDF.");
    }

    // Simpan PDF sementara
    tempPdfPath = path.join(os.tmpdir(), `temp_pdf_${Date.now()}.pdf`);
    await fs.writeFile(tempPdfPath, pdfData.buffer);

    // Tentukan output
    const outputDir = os.tmpdir();
    const outputName = `img_${Date.now()}`;

    // Konversi PDF → PNG (halaman pertama)
    // await convert(tempPdfPath, {
    //   format: "png",
    //   out_dir: outputDir,
    //   out_prefix: outputName,
    //   page: 1, // hanya halaman pertama
    // });

    // Ambil hasil konversi
    const imgPath = path.join(outputDir, `${outputName}-1.png`);
    const imageBuffer = await fs.readFile(imgPath);

    return {
      buffer: imageBuffer,
      contentType: "image/png",
      fileName: pdfData.fileName.replace(/\.pdf$/, ".png"),
    };
  } catch (error) {
    console.error("Error getPDFToImg:", error.message);
    throw error;
  } finally {
    if (tempPdfPath) {
      try {
        await fs.unlink(tempPdfPath);
      } catch (_) {}
    }
  }
}
