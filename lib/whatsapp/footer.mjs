// lib/whatsapp/footer.mjs -- dipakai worker.mjs (jalur notification) dan
// sender.mjs (jalur interactive) supaya teks footer tidak dobel didefinisikan.
export const WA_FOOTER =
  "\n\n> *UPTD. Laboratorium Kesehatan Daerah Kabupaten Sumenep*\n> _SiLAKES Bot v2_";

// Pesan yang disusun dan dikirim SINTA (SiLAKES Intelligence for Notifications,
// Tasks & Automation), mis. ajakan Prolanis CFD dan balasan otomatisnya, diberi
// watermark SINTA, bukan SiLAKES Bot.
export const SINTA_FOOTER =
  "\n\n> *SINTA* · _SiLAKES Intelligence for Notifications, Tasks & Automation_\n> _UPTD. Laboratorium Kesehatan Daerah Kabupaten Sumenep_";
