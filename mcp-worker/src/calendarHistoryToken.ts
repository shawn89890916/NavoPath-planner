// A history capability is scoped to an active calendar subscription. The raw
// regular token is never recovered, stored again, or included in this link.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const HISTORY_TOKEN = new RegExp("^nvh_(" + UUID + ")_([0-9a-f]{64})$");
const encoder = new TextEncoder();

export function parseHistoryToken(value: string) {
  const match = HISTORY_TOKEN.exec(value);
  return match ? { id: match[1], signature: match[2] } : null;
}

async function historyKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function message(id: string, digest: string) {
  return encoder.encode("navopath:sp-history:v1:" + id + ":" + digest);
}

export async function createHistoryToken(id: string, digest: string, secret: string) {
  const bytes = await crypto.subtle.sign("HMAC", await historyKey(secret), message(id, digest));
  return "nvh_" + id + "_" + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyHistoryToken(token: string, digest: string, secret: string) {
  const parsed = parseHistoryToken(token);
  if (!parsed) return false;
  const signature = Uint8Array.from(parsed.signature.match(/../g)!, hex => parseInt(hex, 16));
  return crypto.subtle.verify("HMAC", await historyKey(secret), signature, message(parsed.id, digest));
}
