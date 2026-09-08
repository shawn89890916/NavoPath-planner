import { describe, expect, it } from "vitest";
import type { AiConversation } from "./types";
import { removeEmptyAiConversations } from "./aiConversationHistory";

const conversation = (id: string, messageCount: number): AiConversation => ({
  id,
  title: "新对话",
  messages: Array.from({ length: messageCount }, (_, index) => ({
    id: `message-${index}`,
    role: "user",
    content: "hello",
    createdAt: "2026-09-08T00:00:00.000Z",
  })),
  createdAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
});

describe("AI conversation history", () => {
  it("removes conversations with no messages", () => {
    expect(removeEmptyAiConversations([
      conversation("empty", 0),
      conversation("used", 1),
    ]).map((item) => item.id)).toEqual(["used"]);
  });

  it("can preserve the active empty draft while pruning older ones", () => {
    expect(removeEmptyAiConversations([
      conversation("active", 0),
      conversation("old-empty", 0),
      conversation("used", 1),
    ], "active").map((item) => item.id)).toEqual(["active", "used"]);
  });
});
