// routes/messages.mjs
import { apiRes } from "../utils/apiRes.mjs";
import { sendChatWA, sendGroupChatWA } from "../lib/whatsapp/sender.mjs";

export const descriptors = [
  {
    method: "post",
    path: "/v1/api/wa/send-chat-message",
    description: "Kirim pesan teks umum ke satu nomor",
    handler: async (req, res) => {
      const { to, message } = req.body || {};
      if (!to || !message) {
        return apiRes(res, { status: "error", message: "Missing 'to' or 'message'", statusCode: 400 });
      }
      const result = await sendChatWA(to, message);
      if (!result) {
        return apiRes(res, { status: "error", message: "Gagal mengirim pesan ke nomor tujuan", statusCode: 500 });
      }
      return apiRes(res, {
        status: "success",
        message: "Pesan berhasil dimasukkan ke antrean pengiriman",
        statusCode: 200,
      });
    },
  },
  {
    method: "post",
    path: "/v1/api/wa/send-chat-group-message",
    description: "Kirim pesan teks umum ke grup",
    handler: async (req, res) => {
      const { to, message } = req.body || {};
      if (!to || !message) {
        return apiRes(res, { status: "error", message: "Missing 'to' or 'message'", statusCode: 400 });
      }
      const result = await sendGroupChatWA(to, message);
      if (!result) {
        return apiRes(res, { status: "error", message: "Gagal mengirim pesan ke grup tujuan", statusCode: 500 });
      }
      return apiRes(res, {
        status: "success",
        message: "Pesan berhasil dimasukkan ke antrean pengiriman",
        statusCode: 200,
      });
    },
  },
];
