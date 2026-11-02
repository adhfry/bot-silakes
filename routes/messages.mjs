// routes/messages.mjs
import { apiRes } from "../utils/apiRes.mjs";
import pkg from "whatsapp-web.js";
import { sendChatWA, sendChatWAMedia, sendGroupChatWA, sendGroupChatWAMedia } from "../lib/whatsapp/sender.mjs";

const { MessageMedia } = pkg;

/** Pesan + tautan unduhan lampiran (cadangan bila lampiran tidak bisa dikirim). */
export function withLink(message, url) {
  return `${message}\n\nSurat (PDF): ${url}`;
}

export const descriptors = [
  {
    method: "post",
    path: "/v1/api/wa/send-chat-message",
    description: "Kirim pesan ke satu nomor; media_url (opsional) = lampiran, pesan jadi keterangannya",
    handler: async (req, res) => {
      const { to, lane, media_url: mediaUrl, media_filename: mediaFilename, text_after: textAfter } = req.body || {};
      const message = req.body?.message || "";
      // Pesan boleh kosong bila ada lampiran (kirim berkas saja).
      if (!to || (!message && !mediaUrl)) {
        return apiRes(res, { status: "error", message: "Missing 'to' or 'message'", statusCode: 400 });
      }
      let result = null;
      if (mediaUrl) {
        try {
          const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true, filename: mediaFilename });
          if (mediaFilename) media.filename = mediaFilename;
          result = await sendChatWAMedia(to, message, media, { lane, link: mediaUrl, textAfter: textAfter === true });
        } catch (error) {
          // Lampiran gagal diunduh: teks + tautan tetap sampai.
          console.error("❌ Gagal mengunduh lampiran, kirim teks + tautan:", error.message);
          result = await sendChatWA(to, withLink(message, mediaUrl), { lane });
        }
      }
      result = result || (await sendChatWA(to, message, { lane }));
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
      const { to, lane, media_url: mediaUrl, media_filename: mediaFilename, text_after: textAfter } = req.body || {};
      const message = req.body?.message || "";
      if (!to || (!message && !mediaUrl)) {
        return apiRes(res, { status: "error", message: "Missing 'to' or 'message'", statusCode: 400 });
      }
      let result = null;
      if (mediaUrl) {
        try {
          const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true, filename: mediaFilename });
          if (mediaFilename) media.filename = mediaFilename;
          result = await sendGroupChatWAMedia(to, message, media, { lane, link: mediaUrl, textAfter: textAfter === true });
        } catch (error) {
          // Lampiran gagal diunduh: teks + tautan tetap sampai ke grup.
          console.error("❌ Gagal mengunduh lampiran grup, kirim teks + tautan:", error.message);
          result = await sendGroupChatWA(to, withLink(message, mediaUrl), { lane });
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
