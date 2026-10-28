# sinta-voice

SINTA menelepon pegawai untuk mengingatkan rapat (Gemini Live lewat LiveKit).

- Dipanggil SiLAKES (`SintaCallService`, perintah `sinta:meeting-calls` tiap menit) lewat `POST http://127.0.0.1:4310/calls`.
- Hanya mendengarkan 127.0.0.1. Kunci Gemini ikut di permintaan dan hanya disimpan di memori selama panggilan, tidak ada berkas rahasia.
- Hasil dan transkrip dilaporkan ke `POST /api/sinta/voice/callback` dengan token sekali pakai milik panggilan itu.
- Telepon hanya berjalan bila "Telepon pengingat rapat" diluncurkan di Dashboard SINTA (`calls_released`).

## Pasang di VPS

```
cd /var/www/bot.silakes/sinta-voice   # folder repo bot-silakes
npm install --omit=dev
pm2 start index.mjs --name sinta-voice
pm2 save
```

Variabel opsional: `SINTA_VOICE_PORT` (bawaan 4310), `SINTA_VOICE_GAIN` (penguat suara SINTA dengan pembatas lembut, bawaan 2.6), `SINTA_VOICE_DEBUG=1` (log pesan Gemini).

Cek: `curl -s http://127.0.0.1:4310/health`.
