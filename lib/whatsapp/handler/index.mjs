import { handleKesimpulan } from "./kesimpulan.mjs";
import { handleSaran } from "./saran.mjs";
import { handleSetuju } from "./setuju.mjs";
import { handleTolak } from "./tolak.mjs";

/**
 * Router handler utama
 * @param {import('whatsapp-web.js').Message} message
 */
export async function handleIncomingMessage(message) {
  const text = message.body.trim();

  if (text.startsWith("#ai berikan kesimpulan")) {
    return await handleKesimpulan(message);
  } else if (text.startsWith("#ai berikan saran")) {
    return await handleSaran(message);
  } else if (text.startsWith("#ai setuju")) {
    return await handleSetuju(message);
  } else if (text.startsWith("#ai tolak")) {
    return await handleTolak(message);
  } else {
    await message.reply(
      "❌ Perintah tidak dikenal.\nSilakan gunakan:\n- #ai berikan kesimpulan\n- #ai berikan saran\n- #ai setuju {id}\n- #ai tolak {id}"
    );
  }
}
