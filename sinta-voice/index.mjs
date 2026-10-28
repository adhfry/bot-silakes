// sinta-voice: SINTA menelepon pegawai untuk mengingatkan rapat.
//
// SiLAKES (SintaCallService) memanggil POST /calls saat jadwal telepon tiba:
// layanan ini masuk ke ruang LiveKit sebagai "SINTA", menunggu pegawai
// mengangkat di MATRIX, lalu menyambungkan suaranya dengan Gemini Live.
// Selesai: hasil + transkrip dilaporkan ke callback_url dengan token sekali
// pakai milik panggilan itu. Hanya mendengarkan 127.0.0.1; kunci Gemini ikut
// di permintaan dan hanya disimpan di memori selama panggilan.
import http from "node:http";
import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";
import { startConversation } from "./lib/conversation.mjs";

const PORT = Number(process.env.SINTA_VOICE_PORT || 4310);
const HOST = "127.0.0.1";
const MAX_CONCURRENT = 3;
// Suara SINTA dikeraskan dengan pembatas lembut (tanh): bagian pelan naik
// sekitar 2,6x, puncak tidak pecah. 1 = suara asli.
const OUTPUT_GAIN = Number(process.env.SINTA_VOICE_GAIN || 2.6);
const OUT_RATE = 24000;
const FRAME = OUT_RATE / 100; // 10 ms

const active = new Map(); // call_id -> { hangup }
const log = (id, m) => console.log(`[${new Date().toISOString()}] #${id} ${m}`);

const NORM = 32767 / Math.tanh(OUTPUT_GAIN);
function amplify(pcm) {
  if (OUTPUT_GAIN <= 1) return pcm;
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = Math.round(NORM * Math.tanh((OUTPUT_GAIN * pcm[i]) / 32767));
  return out;
}

async function report(job, body) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(job.callback_url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", "x-sinta-token": job.callback_token },
        body: JSON.stringify({ call_id: job.call_id, ...body }),
      });
      if (res.ok || res.status === 401 || res.status === 404) return;
      log(job.call_id, `laporan ditolak HTTP ${res.status}, coba lagi`);
    } catch (e) {
      log(job.call_id, `laporan gagal: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
}

async function handleCall(job) {
  const id = job.call_id;
  const room = new Room();
  let conv = null;
  let ended = false;
  let joinTimer = null;
  const userIdentity = `u${job.context?.user_id ?? ""}`;

  const end = async (body) => {
    if (ended) return;
    ended = true;
    clearTimeout(joinTimer);
    active.delete(id);
    await report(job, body);
    try {
      await room.disconnect();
    } catch {
      // sudah terputus
    }
    log(id, `selesai: ${body.status} ${body.outcome || ""}`);
  };

  active.set(id, {
    hangup: () => (conv ? conv.hangup() : end({ status: "no_join" })),
  });

  try {
    await room.connect(job.livekit_url, job.token, { autoSubscribe: true, dynacast: false });
  } catch (e) {
    log(id, `gagal masuk ruang: ${e.message}`);
    return end({ status: "no_join", note: "Layanan suara gagal masuk ruang." });
  }

  const source = new AudioSource(OUT_RATE, 1, 2000);
  const track = LocalAudioTrack.createAudioTrack("sinta", source);
  const options = new TrackPublishOptions();
  options.source = TrackSource.SOURCE_MICROPHONE;
  await room.localParticipant.publishTrack(track, options);

  // Antrean pemutaran: potongan 10 ms berurutan; disela pegawai = dikosongkan.
  let generation = 0;
  let chain = Promise.resolve();
  let pending = new Int16Array(0);
  const play = (pcm) => {
    const gen = generation;
    const all = new Int16Array(pending.length + pcm.length);
    all.set(pending);
    all.set(amplify(pcm), pending.length);
    const whole = all.length - (all.length % FRAME);
    pending = all.subarray(whole);
    for (let i = 0; i < whole; i += FRAME) {
      const chunk = all.slice(i, i + FRAME);
      chain = chain.then(() => (gen === generation ? source.captureFrame(new AudioFrame(chunk, OUT_RATE, 1, FRAME)) : null)).catch(() => {});
    }
  };
  const interrupt = () => {
    generation++;
    pending = new Int16Array(0);
    source.clearQueue();
  };
  const afterPlayout = (cb) => {
    chain = chain.then(() => source.waitForPlayout()).catch(() => {}).then(cb);
  };

  const begin = async (remoteTrack) => {
    if (conv || ended) return;
    clearTimeout(joinTimer);
    log(id, "pegawai tersambung, SINTA mulai bicara");
    try {
      conv = await startConversation({
        key: job.gemini_key,
        model: job.model || "gemini-3.8-live",
        voice: job.voice || "Kore",
        instruction: job.instruction,
        maxSeconds: job.max_seconds || 300,
        onAudio: play,
        onInterrupted: interrupt,
        onTurnDone: afterPlayout,
        log: (m) => log(id, m),
      });
    } catch (e) {
      log(id, `Gemini gagal tersambung: ${e.message}`);
      return end({ status: "ended", note: "SINTA gagal tersambung ke layanan suara." });
    }
    const stream = new AudioStream(remoteTrack, { sampleRate: 16000, numChannels: 1 });
    (async () => {
      try {
        for await (const frame of stream) {
          if (ended) break;
          conv.push(frame.data);
        }
      } catch (e) {
        log(id, `aliran suara pegawai terhenti: ${e.message}`);
      }
    })();
    const r = await conv.done;
    await end({
      status: "ended",
      outcome: r.result?.hasil || null,
      reason: r.result?.alasan || null,
      jenis_izin: r.result?.jenis_izin || null,
      subjenis: r.result?.subjenis || null,
      izin_dikonfirmasi: r.result?.izin_dikonfirmasi === true,
      transcript: r.transcript,
      ended_by: r.why,
    });
  };

  room
    .on(RoomEvent.TrackSubscribed, (t, _pub, participant) => {
      if (t.kind === TrackKind.KIND_AUDIO && participant.identity === userIdentity) begin(t);
    })
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (participant.identity === userIdentity) conv ? conv.hangup() : end({ status: "no_join" });
    })
    .on(RoomEvent.Disconnected, () => (conv ? conv.hangup() : end({ status: "no_join" })));

  // Pegawai sudah ada di ruang lebih dulu (mengangkat sebelum SINTA masuk).
  for (const p of room.remoteParticipants.values()) {
    if (p.identity !== userIdentity) continue;
    for (const pub of p.trackPublications.values()) {
      if (pub.track && pub.track.kind === TrackKind.KIND_AUDIO) begin(pub.track);
    }
  }
  // Tidak diangkat sampai dering habis.
  joinTimer = setTimeout(() => !conv && end({ status: "no_join" }), ((job.ring_seconds || 45) + 20) * 1000);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 256 * 1024) reject(new Error("terlalu besar"));
      else parts.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(parts).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const send = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, active: active.size });
      if (req.method === "POST" && req.url === "/calls") {
        const job = await readJson(req);
        const need = ["call_id", "room", "livekit_url", "token", "gemini_key", "instruction", "callback_url", "callback_token"];
        const missing = need.filter((k) => !job[k]);
        if (missing.length) return send(res, 422, { ok: false, missing });
        if (active.size >= MAX_CONCURRENT) return send(res, 429, { ok: false, message: "Sedang menelepon pegawai lain." });
        if (active.has(job.call_id)) return send(res, 409, { ok: false });
        handleCall(job).catch((e) => log(job.call_id, `galat: ${e.stack || e.message}`));
        return send(res, 202, { ok: true });
      }
      if (req.method === "POST" && req.url === "/calls/hangup") {
        const { call_id: id } = await readJson(req);
        active.get(id)?.hangup();
        return send(res, 200, { ok: true });
      }
      send(res, 404, { ok: false });
    } catch (e) {
      send(res, 400, { ok: false, message: e.message });
    }
  })
  .listen(PORT, HOST, () => console.log(`sinta-voice siap di http://${HOST}:${PORT}`));
