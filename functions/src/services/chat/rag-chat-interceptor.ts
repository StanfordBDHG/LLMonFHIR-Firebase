//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {ChatCompletionMessageParam} from "openai/resources/chat/completions";
import {ChatInterceptor} from "./chat-interceptor";
import {ChatBody} from "./chat-service";
import {ContextStore, RetrievedDocument} from "../context/context-store";

const RAG_RETRIEVAL_LIMIT = 5;

/**
 * Intercepts chat requests to inject relevant RAG context from a
 * {@link ContextStore}.
 *
 * Extracts the last user message, queries the store for related documents,
 * and inserts a system message with the retrieved context. Failures are
 * logged and silently ignored so the chat can proceed without context.
 */
export class RAGChatInterceptor implements ChatInterceptor {
  constructor(private readonly contextStore: ContextStore) {}

  async intercept(body: ChatBody): Promise<ChatBody> {
    try {
      const query = extractLastUserMessage(body.messages);
      if (!query) return body;

      const docs = await this.contextStore.retrieve(query, RAG_RETRIEVAL_LIMIT);
      const ragContext = formatDocuments(docs);

      if (!ragContext) {
        console.log("[RAG] No relevant context found");
        return body;
      }

      console.log(
        `[RAG] Retrieved context (${ragContext.length} chars, ${docs.length} docs)`,
      );

      return {...body, messages: injectContext(body.messages, ragContext)};
    } catch (error) {
      console.error("[RAG] Error retrieving context:", error);
      return body;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractLastUserMessage(
  messages: ChatCompletionMessageParam[],
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return normalizeContent(messages[i].content);
    }
  }
  return undefined;
}

function normalizeContent(
  content?: ChatCompletionMessageParam["content"],
): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (typeof part === "object" && part !== null && "text" in part) {
        return typeof part.text === "string" ? part.text : "";
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function formatDocuments(docs: RetrievedDocument[]): string {
  if (docs.length === 0) return "";
  return docs
    .map((doc) => {
      const source = doc.metadata?.sourceFile ?? "Unknown";
      const chunk = doc.metadata?.chunkIndex ?? "?";
      return `[Document: ${source} | Chunk ${chunk}]\n${doc.text}`;
    })
    .join("\n\n---\n\n");
}

function injectContext(
  messages: ChatCompletionMessageParam[],
  ragContext: string,
): ChatCompletionMessageParam[] {
  const contextMessage: ChatCompletionMessageParam = {
    role: "system",
    content: `[Retrieved Context from Knowledge Base]:\n${ragContext}`,
  };
  const result = [...messages];
  const firstSystemIdx = result.findIndex((m) => m.role === "system");
  if (firstSystemIdx >= 0) {
    result.splice(firstSystemIdx + 1, 0, contextMessage);
  } else {
    result.unshift(contextMessage);
  }
  return result;
}
