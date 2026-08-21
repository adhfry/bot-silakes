// routes/produli.mjs
//
// Kontrak khusus PRODULI (WhatsappReminderChannel.php, "kontrak API sudah fix
// dari user"): POST /send/chat-message/:apikey, body {phone, message,
// link_image}. API key di PATH PARAM (bukan header X-API-Key seperti route
// lain) -- SENGAJA TIDAK diubah bentuknya, dan TIDAK pakai middleware
// requireApiKey (auth:false di descriptor) karena skema autentikasinya sendiri
// sudah beda dan dicek manual di handler ini.
import { apiRes } from "../utils/apiRes.mjs";
import { formatPhone } from "../utils/formatPhoneNumber.mjs";
import { sendChatMessage } from "../lib/api/SendChatMessageController.mjs";

export const descriptors = [
  {
    method: "post",
    path: "/send/chat-message/:apikey",
    auth: false,
    description: "[Kontrak PRODULI] Kirim pesan reminder (API key di path param)",
    handler: async (req, res) => {
      const { apikey } = req.params;
      if (!process.env.BOT_WA_API_KEY || apikey !== process.env.BOT_WA_API_KEY) {
        return apiRes(res, { status: "error", message: "API key tidak valid", statusCode: 401 });
      }

      const { phone, message, link_image } = req.body || {};
      if (!phone || !message) {
        return apiRes(res, { status: "error", message: "Missing 'phone' or 'message'", statusCode: 400 });
      }

      const result = await sendChatMessage(formatPhone(phone), message, link_image);
      if (!result) {
        return apiRes(res, { status: "error", message: "Gagal mengirim pesan", statusCode: 500 });
      }
      return apiRes(res, { status: "success", message: "Pesan berhasil dimasukkan ke antrean pengiriman", statusCode: 200 });
    },
  },
];
