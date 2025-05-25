// lib/whatsapp/handler/utils.mjs
export function parseCommand(message) {
  const content = message.body.trim();
  if (!content.startsWith("#")) return null;

  const [prefix, ...args] = content.slice(1).split(" ");
  return { prefix, args: args.join(" ") };
}
