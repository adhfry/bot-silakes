// lib/whatsapp/pageMessages.mjs
//
// Cari & hapus pesan langsung di koleksi WA Web. client.getChats()/getChatById()
// whatsapp-web.js 1.34.7 gagal ("r") di WA Web sekarang (chat kini berkunci LID,
// bukan nomor), padahal kirim pesan tetap jalan. Jalur ini tidak butuh nomor:
// pesan dicari dari isinya di semua chat yang ada di WA Web.
import { client } from "./client.mjs";

/**
 * @param {{ all?: string[], regex?: string, sinceSec: number, fromMeOnly?: boolean, maxLoads?: number, chatIds?: string[] }} q
 *   all = semua kata harus ada (tanpa beda huruf besar/kecil); regex = pola (flag i).
 * @returns {Promise<{ids: string[], chats: number, errors: string[]}>}
 */
export async function findMessages(q) {
  return client.pupPage.evaluate(async (q) => {
    const C = window.require("WAWebCollections");
    let loader = null;
    try { loader = window.require("WAWebChatLoadMessages"); } catch (e) { /* tanpa muat pesan lama */ }
    const needles = (q.all || []).map((s) => String(s).toLowerCase());
    const re = q.regex ? new RegExp(q.regex, "i") : null;
    const text = (m) => String(m.body || m.caption || "");
    const match = (m) => {
      if (m.isNotification || m.type === "revoked") return false;
      if (q.fromMeOnly && !m.id?.fromMe) return false;
      if (m.t < q.sinceSec) return false;
      const body = text(m);
      const quoted = String(m.quotedMsg?.body || "");
      if (needles.length && !needles.every((n) => body.toLowerCase().includes(n))) return false;
      if (re && !re.test(body) && !re.test(quoted)) return false;
      return true;
    };
    const ids = new Set();
    const errors = [];
    const only = q.chatIds ? new Set(q.chatIds) : null;
    const chats = C.Chat.getModelsArray().filter((c) => (c.t || 0) >= q.sinceSec && (!only || only.has(c.id._serialized)));
    for (const chat of chats) {
      try {
        let msgs = chat.msgs.getModelsArray();
        for (let i = 0; loader && i < (q.maxLoads ?? 10); i++) {
          const oldest = msgs.length ? Math.min(...msgs.map((m) => m.t || 0)) : Infinity;
          if (oldest < q.sinceSec) break;
          const more = await loader.loadEarlierMsgs({ chat });
          if (!more || !more.length) break;
          msgs = [...more, ...msgs];
        }
        for (const m of msgs) if (match(m)) ids.add(m.id._serialized);
      } catch (e) {
        errors.push(`${chat.id?._serialized}: ${e?.message || e}`);
      }
    }
    return { ids: [...ids], chats: chats.length, errors: errors.slice(0, 5) };
  }, q);
}

/** Hapus satu pesan menurut ID (everyone = tarik untuk semua; false = hapus untuk bot saja). */
export async function deleteMessageById(id, everyone) {
  return client.pupPage.evaluate(async (id, everyone) => {
    const C = window.require("WAWebCollections");
    const msg = C.Msg.get(id) || (await C.Msg.getMessagesById([id]))?.messages?.[0];
    if (!msg) throw new Error("pesan tidak ditemukan");
    const chat = C.Chat.get(msg.id.remote) || (await C.Chat.find(msg.id.remote));
    const cap = window.require("WAWebMsgActionCapability");
    const { Cmd } = window.require("WAWebCmd");
    if (everyone) {
      if (!(cap.canSenderRevokeMsg(msg) || cap.canAdminRevokeMsg(msg))) throw new Error("tidak bisa ditarik untuk semua (lewat batas waktu?)");
      await Cmd.sendRevokeMsgs(chat, { list: [msg], type: "message" }, { clearMedia: true });
    } else {
      await Cmd.sendDeleteMsgs(chat, { list: [msg], type: "message" }, true);
    }
    return true;
  }, id, everyone);
}

/** ID chat yang aktif sejak sinceSec (urutan terbaru dulu). */
export async function activeChatIds(sinceSec) {
  return client.pupPage.evaluate((sinceSec) =>
    window.require("WAWebCollections").Chat.getModelsArray()
      .filter((c) => (c.t || 0) >= sinceSec)
      .sort((a, b) => (b.t || 0) - (a.t || 0))
      .map((c) => c.id._serialized), sinceSec);
}
