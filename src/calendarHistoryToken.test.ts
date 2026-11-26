import { describe, expect, it } from "vitest";
import { createHistoryToken, parseHistoryToken, verifyHistoryToken } from "../mcp-worker/src/calendarHistoryToken";

describe("history-only calendar capability", () => {
  const id = "a0b1c2d3-1234-4321-9876-123456789abc";
  const digest = "a".repeat(64);
  const secret = "test-service-secret";

  it("derives a stable, scoped token without exposing the original digest", async () => {
    const token = await createHistoryToken(id, digest, secret);
    expect(token).toBe(await createHistoryToken(id, digest, secret));
    expect(parseHistoryToken(token)?.id).toBe(id);
    expect(token).not.toContain(digest);
    expect(await verifyHistoryToken(token, digest, secret)).toBe(true);
  });

  it("rejects tampering, revoked/replaced credentials, and wrong signing keys", async () => {
    const token = await createHistoryToken(id, digest, secret);
    expect(await verifyHistoryToken(token.replace(id, "b" + id.slice(1)), digest, secret)).toBe(false);
    expect(await verifyHistoryToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"), digest, secret)).toBe(false);
    expect(await verifyHistoryToken(token, "b".repeat(64), secret)).toBe(false);
    expect(await verifyHistoryToken(token, digest, "different-key")).toBe(false);
    expect(await verifyHistoryToken("nvc_" + digest, digest, secret)).toBe(false);
  });
});
