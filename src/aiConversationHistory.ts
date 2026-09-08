import type { AiConversation } from "./types";

export function removeEmptyAiConversations(conversations: AiConversation[], preserveId = "") {
  return conversations.filter((conversation) => conversation.id === preserveId || conversation.messages.length > 0);
}
