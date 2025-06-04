import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import {
  handleIncomingMessage,
  handlePreviewMessage,
  handleReplyChatMessage,
} from "./handler/index.mjs";

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "silakes-bot", // ID klien untuk menyimpan sesi
  }), // simpan sesi di folder .wwebjs_auth
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("📱 Scan QR code berikut:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp siap digunakan!");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Gagal autentikasi:", msg);
});

client.on("disconnected", (reason) => {
  console.log("⚠️ WhatsApp terputus:", reason);
});

client.on("message", async (message) => {
  //untuk reply pesan
  if (message.hasQuotedMsg) {
    const quoted = await message.getQuotedMessage();
    // khusus yang di reply === chat
    if (quoted.type === "chat") {
      await handleReplyChatMessage(message);
    }
  }

  // untuk pesan with #ai
  if (message.body?.startsWith("#ai")) {
    console.log("📩 Pesan #ai diterima:", message.body);
    await handleIncomingMessage(message);
  }
  // untuk pesan with #preview
  if (message.body?.startsWith("#preview")) {
    console.log("📩 Pesan #preview diterima:", message.body);
    await handlePreviewMessage(message);
  }
});

client.initialize();

export { client };
