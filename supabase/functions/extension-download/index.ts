import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.107.0";
import { downloadExtension } from "./download.ts";
import { pinnedHttpRequest } from "./pinned-http.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return errorResponse("Authentication required", 401);
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    // Verify the JWT against Auth; a decoded claim alone is insufficient.
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return errorResponse("Authentication required", 401);
    if (Number(req.headers.get("content-length")) > 16_384) return errorResponse("Request too large", 413);
    const reader = req.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); return errorResponse("Request too large", 413); }
      chunks.push(value);
    }
    const bodyBytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bodyBytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder().decode(bodyBytes));
    const bytes = await downloadExtension(body.url, {
      fetchPinned: (url, address, signal) => pinnedHttpRequest(url, address, signal, {
        connect: (hostname) => Deno.connect({ hostname, port: 443 }),
        startTls: (connection, hostname) => Deno.startTls(connection as Deno.Conn, { hostname }),
      }),
      resolve: async (host) => {
        const results = await Promise.allSettled([Deno.resolveDns(host, "A"), Deno.resolveDns(host, "AAAA")]);
        return results.flatMap((result, index) => result.status === "fulfilled" ? result.value.map((address) => ({ address, family: index === 0 ? 4 : 6 })) : []);
      },
    });
    return new Response(bytes, { headers: { ...cors, "Content-Type": "application/octet-stream", "Content-Length": String(bytes.length) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Do not echo upstream URLs, signed URL query strings or TLS error internals.
    const safe = /(?:exceeds 20 MB|redirect limit|timed out|Private extension|public HTTPS|Only HTTPS|Credentials must|Local calendar|IP-address calendar|Invalid extension URL)/i.test(message)
      ? "Extension download blocked: use a public HTTPS source under 20 MB without embedded credentials."
      : "Extension download failed";
    return errorResponse(safe, 400);
  }
});
