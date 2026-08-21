// routes/queueStatus.mjs -- endpoint debug baru untuk memantau antrean
// notifikasi (pending/processing/done/failed + error terakhir), pakai auth
// karena ini info operasional internal.
import { apiRes } from "../utils/apiRes.mjs";
import { getQueueStatus } from "../lib/queue/index.mjs";

export const descriptors = [
  {
    method: "get",
    path: "/queue/status",
    description: "Status antrean notifikasi (debug)",
    handler: (req, res) => {
      return apiRes(res, {
        status: "success",
        data: getQueueStatus(),
        statusCode: 200,
      });
    },
  },
];
