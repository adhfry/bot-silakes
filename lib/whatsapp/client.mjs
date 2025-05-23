import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

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

client.initialize();

export { client };
