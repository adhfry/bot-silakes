import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const { APP_ENV, LARAVEL_API_BASE_URL } = process.env;
import { getInfoSuratPemeriksaan } from "../../api/config.mjs";

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
