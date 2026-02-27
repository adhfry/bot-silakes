import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// process.env.LARAVEL_API_BASE_URL
const apiClient = axios.create({
  baseURL: process.env.LARAVEL_API_BASE_URL,
  timeout: 5000,
});

export async function getApi(url, params = {}) {
  try {
    const response = await apiClient.get(url, { params });

    console.log("[GET] API Response:", response.data);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch API: ${error.message}`);
  }
}

export async function postApi(url, data = {}) {
  try {
    const response = await apiClient.post(url, data);

    console.log("[POST] API Response:", response.data);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to post API: ${error.message}`);
  }
}
