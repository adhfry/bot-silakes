import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
// import { convert } from "pdf-poppler";
import { fromPath } from "pdf2pic";
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
  let outputImagePath;
  try {
    const pdfData = await getDownloadAntrianPDF(idSurat);
    if (!pdfData || !pdfData.buffer) {
      throw new Error("❌ Gagal mendapatkan buffer PDF.");
    }

    // 1) Simpan PDF sementara
    tempPdfPath = path.join(os.tmpdir(), `temp_pdf_${Date.now()}.pdf`);
    await fs.writeFile(tempPdfPath, pdfData.buffer);

    // 2) Konfigurasi pdf2pic
    // opsi bisa disesuaikan: density (dpi), format, width/height, dsb.
    const outputName = `img_${Date.now()}`;
    const outputDir = os.tmpdir();

    const options = {
      density: 200, // DPI (lebih tinggi = lebih tajam, tapi lebih besar)
      saveFilename: outputName,
      savePath: outputDir,
      format: "png",
      width: 1024, // optional, jika ingin scale
      height: 0, // 0 = preserve aspect
    };

    // 3) Convert halaman pertama
    const storeAsImage = fromPath(tempPdfPath, options);
    // pemanggilan: storeAsImage(pageNumber)
    const convertResult = await storeAsImage(1);

    // pdf2pic kadang mengembalikan object atau array, jadi kita handle keduanya
    let resultObj = null;
    if (Array.isArray(convertResult) && convertResult.length > 0) {
      resultObj = convertResult[0];
    } else if (convertResult && typeof convertResult === "object") {
      resultObj = convertResult;
    }

    if (!resultObj || !resultObj.path) {
      throw new Error(
        "❌ Gagal konversi PDF ke gambar (tidak ada output path)."
      );
    }

    outputImagePath = resultObj.path; // file path hasil convert
    const imageBuffer = await fs.readFile(outputImagePath);

    // 4) Kembalikan hasil sebagai buffer
    return {
      buffer: imageBuffer,
      contentType: "image/png",
      fileName: pdfData.fileName
        ? pdfData.fileName.replace(/\.pdf$/i, ".png")
        : `${outputName}.png`,
    };
  } catch (error) {
    console.error("Error getPDFToImg:", error?.message || error);
    throw error;
  } finally {
    // 5) Cleanup file sementara (PDF + image)
    try {
      if (tempPdfPath) await fs.unlink(tempPdfPath).catch(() => {});
    } catch (_) {}
    try {
      if (typeof outputImagePath === "string")
        await fs.unlink(outputImagePath).catch(() => {});
    } catch (_) {}
  }
}
