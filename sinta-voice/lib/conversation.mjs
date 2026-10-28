// Percakapan telepon SINTA dengan Gemini Live (audio asli). Tidak tahu apa pun
// soal LiveKit: menerima potongan PCM16 16 kHz dari pegawai lewat push(), dan
// mengeluarkan PCM16 24 kHz suara SINTA lewat onAudio(). Hasil percakapan
// dicatat lewat alat catat_hasil; akhiri_panggilan menutup telepon.
import { GoogleGenAI, Modality, Type } from "@google/genai";

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "catat_hasil",
        description: "Catat jawaban pegawai tentang kehadiran rapat. Panggil sekali, setelah jawabannya jelas.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            hasil: { type: Type.STRING, enum: ["hadir", "tidak_hadir", "izin", "tidak_jelas"] },
            alasan: { type: Type.STRING, description: "Alasan dengan kata-kata pegawai, singkat." },
            jenis_izin: { type: Type.STRING, enum: ["Sakit", "Izin", "Cuti"] },
            subjenis: { type: Type.STRING, description: "Sakit, Kepentingan Pribadi, Kepentingan Keluarga, atau jenis cuti." },
            izin_dikonfirmasi: { type: Type.BOOLEAN, description: "True hanya bila pegawai sudah menyetujui ringkasan izin yang kamu bacakan." },
          },
          required: ["hasil"],
        },
      },
      {
        name: "akhiri_panggilan",
        description: "Tutup telepon setelah kamu selesai berpamitan.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
    ],
  },
];

/**
 * @param {{key: string, model: string, voice: string, instruction: string, maxSeconds: number,
 *   onAudio: (pcm: Int16Array) => void, onInterrupted: () => void, log?: (m: string) => void}} o
 */
export async function startConversation(o) {
  const log = o.log || (() => {});
  const ai = new GoogleGenAI({ apiKey: o.key });
  const transcript = [];
  let result = null;
  let ending = false;
  let closed = false;
  let limit = null;
  const afterPlayout = o.onTurnDone || ((cb) => cb());
  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));

  const add = (role, text) => {
    if (!text) return;
    const last = transcript[transcript.length - 1];
    if (last && last.role === role) last.text += text;
    else transcript.push({ role, text });
  };

  const finish = (why) => {
    if (closed) return;
    closed = true;
    clearTimeout(limit);
    try {
      session.close();
    } catch {
      // sudah tertutup
    }
    log(`percakapan selesai: ${why}`);
    resolveDone({ result, transcript: transcript.map((t) => ({ ...t, text: t.text.trim() })).filter((t) => t.text), why });
  };

  const session = await ai.live.connect({
    model: o.model,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: o.voice || "Kore" } }, languageCode: "id-ID" },
      systemInstruction: o.instruction,
      tools: TOOLS,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: {
      onmessage: (m) => {
        if (process.env.SINTA_VOICE_DEBUG && !m.serverContent) log(`pesan: ${JSON.stringify(m).slice(0, 400)}`);
        const sc = m.serverContent;
        if (sc) {
          for (const p of sc.modelTurn?.parts || []) {
            if (p.inlineData?.data) {
              const buf = Buffer.from(p.inlineData.data, "base64");
              o.onAudio(new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2)));
            }
          }
          if (sc.interrupted) o.onInterrupted();
          add("pegawai", sc.inputTranscription?.text);
          add("sinta", sc.outputTranscription?.text);
          // Pamit sudah diucapkan dan alat akhiri_panggilan sudah dipanggil.
          if (sc.turnComplete && ending) afterPlayout(() => finish("akhiri_panggilan"));
        }
        for (const fc of m.toolCall?.functionCalls || []) {
          log(`alat ${fc.name} ${JSON.stringify(fc.args || {})}`);
          if (fc.name === "catat_hasil") result = { ...(fc.args || {}) };
          if (fc.name === "akhiri_panggilan") ending = true;
          session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { ok: true } }] });
          // Model kadang menutup tanpa giliran bicara lagi: tutup setelah jeda singkat.
          if (fc.name === "akhiri_panggilan") setTimeout(() => afterPlayout(() => finish("akhiri_panggilan")), 6000);
        }
      },
      onerror: (e) => {
        log(`galat Gemini: ${e?.message || e?.error?.message || e}`);
        finish("galat");
      },
      onclose: (e) => {
        if (!closed) log(`Gemini menutup sesi: ${e?.reason || e?.code || ""}`);
        finish("ditutup");
      },
    },
  });

  limit = setTimeout(() => finish("batas waktu"), (o.maxSeconds || 300) * 1000);
  // SINTA bicara lebih dulu.
  session.sendClientContent({ turns: [{ role: "user", parts: [{ text: "(Telepon sudah diangkat. Mulai bicara sekarang dengan salam pembuka.)" }] }], turnComplete: true });

  return {
    /** Potongan suara pegawai, PCM16 mono 16 kHz. */
    push(pcm16) {
      if (closed) return;
      const b = Buffer.from(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
      session.sendRealtimeInput({ audio: { data: b.toString("base64"), mimeType: "audio/pcm;rate=16000" } });
    },
    /** Pegawai menutup telepon. */
    hangup: () => finish("pegawai menutup"),
    done,
  };
}
