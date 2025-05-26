import WebSocket from "ws";
global.WebSocket = WebSocket;
import { Socket } from "phoenix";
import dotenv from "dotenv";

dotenv.config();

export const socket = new Socket(process.env.PHOENIX_SOCKET_URL, {
  transport: WebSocket,
  /* params */
});

socket.onOpen(() => {
  console.log("✅ WebSocket connected");
});

socket.onError((error) => {
  console.error("❌ WebSocket error:", error);
});

socket.onClose(() => {
  console.log("🛑 WebSocket closed");
});

const ROLES = ["all", "admin", "administrasi"];
export const channels = {};

ROLES.forEach((role) => {
  const topic = `notifications:${role}`;
  const chan = socket.channel(topic, {});
  chan
    .join()
    .receive("ok", () => console.log(`✅ Joined ${topic}`))
    .receive("error", (err) =>
      console.error(`❌ Failed to join ${topic}`, err)
    );
  channels[role] = chan;
});
