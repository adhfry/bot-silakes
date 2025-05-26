import axios from "axios";
import dotenv from "dotenv";
import { formatPhone } from "../../utils/formatPhoneNumber.mjs";
dotenv.config();
const { APP_ENV, LARAVEL_API_BASE_URL } = process.env;

export async function setujuPemeriksaan(idSurat, admPhone) {
  try {
    const res = await axios.post(
      LARAVEL_API_BASE_URL + "/setuju/pemeriksaan/" + idSurat,
      {
        key: "kesehatanNo1",
        admPhone,
      }
    );
    if (!res || res.data.status !== "success") {
      console.log("Kesalahan Saat menyetujui : ", res.data.message);
      return {
        status: "error",
        message: error.response.data.message || "Proses Gagal",
      };
    }
    console.log(res.data);
    return {
      status: "success",
      message: "",
    };
  } catch (error) {
    console.error("Gagal Menyetujui : ", error.response.data.message);
    return {
      status: "error",
      message: error.response.data.message || "Proses Gagal",
    };
  }
}
export async function tolakPemeriksaan(idSurat, admPhone) {
  try {
    const res = await axios.post(
      LARAVEL_API_BASE_URL + "/tolak/pemeriksaan/" + idSurat,
      {
        key: "kesehatanNo1",
        admPhone,
      }
    );
    if (!res || res.data.status !== "success") {
      console.log("Kesalahan Saat Menolak : ", res.data.message);
      return {
        status: "error",
        message: error.response.data.message || "Proses Gagal",
      };
    }
    return {
      status: "success",
      message: "",
    };
  } catch (error) {
    console.error("Gagal Menolak : ", error.response.data.message);
    return {
      status: "error",
      message: error.response.data.message || "Proses Gagal",
    };
  }
}
