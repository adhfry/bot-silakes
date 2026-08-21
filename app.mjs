// app.mjs
//
// Express app + semua route, dipisah dari index.mjs SUPAYA bin/route-list.mjs
// bisa mengimpor file ini untuk mencetak daftar route TANPA ikut memicu boot
// WhatsApp client (Puppeteer/Chrome) -- lihat lib/whatsapp/client.mjs,
// client.initialize() sekarang dibungkus startWhatsAppClient() yang cuma
// dipanggil dari index.mjs.
import express from "express";
import { mountRoutes, registry } from "./lib/routing/registerRoutes.mjs";
import { descriptors as healthRoutes } from "./routes/health.mjs";
import { descriptors as notificationRoutes } from "./routes/notifications.mjs";
import { descriptors as messageRoutes } from "./routes/messages.mjs";
import { descriptors as produliRoutes } from "./routes/produli.mjs";
import { descriptors as queueStatusRoutes } from "./routes/queueStatus.mjs";

export const app = express();
app.use(express.json());

mountRoutes(app, [
  ...healthRoutes,
  ...notificationRoutes,
  ...messageRoutes,
  ...produliRoutes,
  ...queueStatusRoutes,
]);

export { registry };
