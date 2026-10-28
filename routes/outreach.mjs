// routes/outreach.mjs -- ajakan Prolanis CFD dari SiLAKES (OutreachPacer).
// SiLAKES sendiri yang mengatur jam kirim dan jeda antar pesan; di sini pesan
// cukup masuk antrean lane 'bulk' seperti notifikasi lain.
import { apiRes } from "../utils/apiRes.mjs";
import { enqueueNotification } from "../lib/queue/index.mjs";

export const descriptors = [
  {
    method: "post",
    path: "/v1/api/wa/send-outreach",
    description: "Ajakan Prolanis: teks + polling SUDAH/BELUM, laporan balik ke SiLAKES",
    handler: async (req, res) => {
      const { to, message, poll, ref } = req.body || {};
      const options = Array.isArray(poll?.options) ? poll.options.map(String).slice(0, 12) : [];
      if (!to || !message || !ref || !poll?.question || options.length < 2) {
        return apiRes(res, { status: "error", message: "Missing 'to', 'message', 'poll' atau 'ref'", statusCode: 400 });
      }
      const queued = await enqueueNotification({
        kind: "outreach",
        to: String(to).replace(/\D+/g, ""),
        message,
        poll: { question: String(poll.question).slice(0, 255), options },
        ref: String(ref),
        lane: "bulk",
      });
      if (!queued) {
        return apiRes(res, { status: "error", message: "Gagal memasukkan pesan ke antrean", statusCode: 500 });
      }
      return apiRes(res, { status: "success", message: "Ajakan masuk antrean pengiriman", statusCode: 200 });
    },
  },
];
