import test from "node:test";
import assert from "node:assert/strict";
import { AiGatewayError, callAiGateway, gatewayErrorMessage, reasoningParameters, type AiProviderConfig } from "./gateway.ts";

const providers: AiProviderConfig[] = [
  { name: "deepseek", baseUrl: "https://primary.test/v1", apiKey: "primary", model: "deepseek-v4-flash", supportsReasoning: true },
  { name: "deepseek", baseUrl: "https://backup.test/v1", apiKey: "backup", model: "deepseek-v4-pro", supportsReasoning: true },
];

test("maps reasoning modes to each provider protocol", () => {
  const deepseek = providers[0];
  assert.deepEqual(reasoningParameters(deepseek, "instant"), { thinking: { type: "disabled" } });
  assert.deepEqual(reasoningParameters(deepseek, "high"), { thinking: { type: "enabled" }, reasoning_effort: "high" });
  assert.deepEqual(reasoningParameters(deepseek, "xhigh"), { thinking: { type: "enabled" }, reasoning_effort: "max" });
  const anthropic: AiProviderConfig = { name: "anthropic", baseUrl: "https://api.anthropic.com/v1", apiKey: "key", model: "claude-opus-4-8", supportsReasoning: true };
  assert.deepEqual(reasoningParameters(anthropic, "instant"), {});
  assert.deepEqual(reasoningParameters(anthropic, "high", 2_400), { thinking: { type: "enabled", budget_tokens: 2_399 } });
  assert.deepEqual(reasoningParameters(anthropic, "high", 600), {});
  const zhipu: AiProviderConfig = { name: "zhipu", baseUrl: "https://open.bigmodel.cn/api/paas/v4", apiKey: "key", model: "glm-5.2", supportsReasoning: true };
  assert.deepEqual(reasoningParameters(zhipu, "instant"), { thinking: { type: "disabled" } });
  assert.deepEqual(reasoningParameters(zhipu, "xhigh"), { thinking: { type: "enabled" }, reasoning_effort: "max" });
  const qwen: AiProviderConfig = { name: "qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: "key", model: "qwen3.8-max", supportsReasoning: true };
  assert.deepEqual(reasoningParameters(qwen, "instant"), { enable_thinking: false });
  assert.deepEqual(reasoningParameters(qwen, "high"), { enable_thinking: true });
});

test("uses the Anthropic messages protocol", async () => {
  let requestedUrl = "";
  let requestedHeaders: HeadersInit | undefined;
  let requestedBody: Record<string, unknown> | undefined;
  const result = await callAiGateway({
    providers: [{ name: "anthropic", baseUrl: "https://api.anthropic.com/v1", apiKey: "secret", model: "claude-opus-4-8", supportsReasoning: true }],
    messages: [{ role: "system", content: "You are concise." }, { role: "user", content: "hello" }],
    maxTokens: 1_200,
    fetchImpl: async (url, init) => {
      requestedUrl = String(url);
      requestedHeaders = init?.headers;
      requestedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ content: [{ type: "text", text: "anthropic ok" }] });
    },
  });
  assert.equal(result.content, "anthropic ok");
  assert.equal(requestedUrl, "https://api.anthropic.com/v1/messages");
  assert.equal(new Headers(requestedHeaders).get("x-api-key"), "secret");
  assert.equal(new Headers(requestedHeaders).get("authorization"), null);
  assert.equal(requestedBody?.system, "You are concise.");
  assert.deepEqual(requestedBody?.messages, [{ role: "user", content: "hello" }]);
});

test("returns the primary provider response without a backup call", async () => {
  let calls = 0;
  const result = await callAiGateway({
    providers,
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ choices: [{ message: { content: "primary ok" } }] });
    },
  });
  assert.equal(result.provider, "deepseek");
  assert.equal(calls, 1);
});

test("accepts a full chat completions endpoint without appending it twice", async () => {
  let requestedUrl = "";
  await callAiGateway({
    providers: [{ ...providers[0], baseUrl: "https://primary.test/v1/chat/completions" }],
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return Response.json({ choices: [{ message: { content: "ok" } }] });
    },
  });
  assert.equal(requestedUrl, "https://primary.test/v1/chat/completions");
});

test("falls back immediately after a primary 403", async () => {
  const calls: string[] = [];
  const result = await callAiGateway({
    providers,
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    fetchImpl: async (url) => {
      calls.push(String(url));
      return calls.length === 1
        ? new Response("forbidden", { status: 403 })
        : Response.json({ choices: [{ message: { content: "ok" } }] });
    },
  });
  assert.equal(result.provider, "deepseek");
  assert.equal(result.content, "ok");
  assert.equal(calls.length, 2);
});

test("retries transient provider failures once and exposes a safe upstream detail", async () => {
  let calls = 0;
  const result = await callAiGateway({
    providers: providers.slice(0, 1),
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? Response.json({ error: { message: "temporary upstream failure" } }, { status: 503 })
        : Response.json({ choices: [{ message: { content: "recovered" } }] });
    },
  });
  assert.equal(result.content, "recovered");
  assert.equal(calls, 2);
});

test("preserves an actionable provider error without exposing credentials", async () => {
  await assert.rejects(
    callAiGateway({
      providers: providers.slice(0, 1),
      messages: [{ role: "user", content: "private task title" }],
      maxTokens: 100,
      fetchImpl: async () => Response.json({ error: { message: "model does not exist for sk-secret1234567890" } }, { status: 400 }),
    }),
    (error: unknown) => error instanceof AiGatewayError
      && error.code === "AI_PROVIDER"
      && error.attempts[0]?.detail?.includes("model does not exist") === true
      && !JSON.stringify(error).includes("sk-secret1234567890"),
  );
});

test("returns a structured error when both providers fail", async () => {
  await assert.rejects(
    callAiGateway({
      providers,
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 100,
      fetchImpl: async () => new Response("busy", { status: 429 }),
    }),
    (error: unknown) => error instanceof AiGatewayError && error.code === "AI_RATE_LIMIT" && error.retryable,
  );
});

test("reports insufficient provider balance as a quota error", async () => {
  await assert.rejects(
    callAiGateway({
      providers: providers.slice(0, 1),
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 100,
      fetchImpl: async () => new Response("insufficient balance", { status: 402 }),
    }),
    (error: unknown) => error instanceof AiGatewayError && error.code === "AI_RATE_LIMIT" && !error.retryable,
  );
});

test("caps each provider attempt with an abort signal", async () => {
  const startedAt = Date.now();
  await assert.rejects(callAiGateway({
    providers: providers.slice(0, 1),
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    perProviderTimeoutMs: 20,
    totalTimeoutMs: 30,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  }), (error: unknown) => error instanceof AiGatewayError && error.code === "AI_TIMEOUT");
  assert.ok(Date.now() - startedAt < 250);
});

test("falls back after a primary timeout within the total budget", async () => {
  const startedAt = Date.now();
  let calls = 0;
  const result = await callAiGateway({
    providers,
    messages: [{ role: "user", content: "private task title" }],
    maxTokens: 100,
    perProviderTimeoutMs: 20,
    totalTimeoutMs: 60,
    fetchImpl: (_url, init) => {
      calls += 1;
      if (calls === 2) return Promise.resolve(Response.json({ choices: [{ message: { content: "backup ok" } }] }));
      return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    },
  });
  assert.equal(result.provider, "deepseek");
  assert.ok(Date.now() - startedAt < 250);
});

test("structured errors do not include credentials or prompt content", async () => {
  const secretProviders = providers.map((provider) => ({ ...provider, apiKey: `secret-${provider.name}` }));
  try {
    await callAiGateway({
      providers: secretProviders,
      messages: [{ role: "user", content: "private task title" }],
      maxTokens: 100,
      fetchImpl: async () => new Response("bad", { status: 403 }),
    });
    assert.fail("expected gateway failure");
  } catch (error) {
    const serialized = JSON.stringify(error);
    assert.equal(serialized.includes("secret-"), false);
    assert.equal(serialized.includes("private task title"), false);
  }
});

test("explains provider failures with actionable configuration messages", () => {
  assert.match(gatewayErrorMessage("AI_AUTH"), /API Key/);
  assert.match(gatewayErrorMessage("AI_RATE_LIMIT"), /额度|频繁/);
  assert.match(gatewayErrorMessage("AI_PROVIDER"), /API 地址.*模型/);
});
