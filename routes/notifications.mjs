// routes/notifications.mjs
import { apiRes } from "../utils/apiRes.mjs";
import { formatPhone } from "../utils/formatPhoneNumber.mjs";
import { notifyAdmin, notifyUserConfirmByWeb } from "../lib/api/NotifyAdminController.mjs";
import { sendPDF } from "../lib/api/SendMediaPatientController.mjs";

export const descriptors = [
  {
    method: "post",
    path: "/api/bot/wa/notify-admin",
    description: "Notifikasi hasil pemeriksaan ke daftar admin",
    handler: async (req, res) => {
      const { message } = req.body || {};
      if (!message) {
        return apiRes(res, { status: "error", message: "Missing Arguments", statusCode: 400 });
      }
      const result = await notifyAdmin(message);
      if (!result) {
        return apiRes(res, { status: "error", message: "Gagal mengirim pesan ke admin", statusCode: 500 });
      }
      return apiRes(res, {
        status: "success",
        message: "Pesan berhasil dimasukkan ke antrean pengiriman ke admin",
        data: result,
        statusCode: 200,
      });
    },
  },
  {
    method: "post",
    path: "/api/bot/wa/notify-confirm",
    description: "Notifikasi konfirmasi approve/reject hasil pemeriksaan",
    handler: async (req, res) => {
      const { idSurat, typeConfirm } = req.body || {};
      if (!idSurat || !typeConfirm) {
        return apiRes(res, { status: "error", message: "Missing Arguments", statusCode: 400 });
      }
      const result = await notifyUserConfirmByWeb(idSurat, typeConfirm);
      if (!result) {
        return apiRes(res, { status: "error", message: "Gagal mengirim pesan ke admin", statusCode: 500 });
      }
      return apiRes(res, {
        status: "success",
        message: "Pesan berhasil dimasukkan ke antrean pengiriman",
        data: result,
        statusCode: 200,
      });
    },
  },
  {
    method: "post",
    path: "/api/bot/wa/send-chat",
    description: "Kirim PDF hasil pemeriksaan ke pasien",
    handler: async (req, res) => {
      const { to, message, idSurat } = req.body || {};
      if (!to || !message || !idSurat) {
        return apiRes(res, { status: "error", message: "Missing Arguments", statusCode: 400 });
      }
      const result = await sendPDF(formatPhone(to), message, idSurat);
      if (!result) {
        return apiRes(res, { status: "error", message: "Gagal mengirim pesan ke pasien", statusCode: 500 });
      }
      return apiRes(res, {
        status: "success",
        message: "PDF berhasil dimasukkan ke antrean pengiriman",
        data: result,
        statusCode: 200,
      });
    },
  },
];
