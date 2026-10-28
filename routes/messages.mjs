// routes/messages.mjs
import { apiRes } from "../utils/apiRes.mjs";
import pkg from "whatsapp-web.js";
import { sendChatWA, sendGroupChatWA, sendGroupChatWAMedia } from "../lib/whatsapp/sender.mjs";

const { MessageMedia } = pkg;

export const descriptors = [
  {
    method: "post",
    path: "/v1/api/wa/send-chat-message",
    description: "Kirim pesan teks umum ke satu nomor",
    handler: async (req, res) => {
      const { to, message, lane } = req.body || {};
      if (!to || !message) {
        return apiRes(res, { status: "error", message: "Missing 'to' or 'message'", statusCode: 400 });
      }
      const result = await sendChatWA(to, message, { lane });
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
    description: "Kirim pesan ke grup; media_url (opsional) = lampiran, pesan jadi keterangannya",
    handler: async (req, res) => {
      const { to, message, lane, media_url: mediaUrl, media_filename: mediaFilename } = req.body || {};
      if (!to || !message) {
        return apiRes(res, { status: "error", message: "Missing 'to' or 'message'", statusCode: 400 });
      }
      let result = null;
      if (mediaUrl) {
        try {
          const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true, filename: mediaFilename });
          if (mediaFilename) media.filename = mediaFilename;
          result = await sendGroupChatWAMedia(to, message, media, { lane });
        } catch (error) {
          // Lampiran gagal diunduh: pesan teks tetap sampai ke grup.
          console.error("❌ Gagal mengunduh lampiran grup, kirim teks saja:", error.message);
        }
      }
      result = result || (await sendGroupChatWA(to, message, { lane }));
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
