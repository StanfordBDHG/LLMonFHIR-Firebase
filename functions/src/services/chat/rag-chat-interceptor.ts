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

const RAG_RETRIEVAL_LIMIT = 10;

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
      const query = this.extractQuery(body);
      if (!query) return body;

      const docs = await this.contextStore.retrieve(query, RAG_RETRIEVAL_LIMIT);
      const ragContext = this.formatDocuments(docs);

      if (!ragContext) {
        console.log("[RAG] No relevant context found");
        return body;
      }

      console.log(
        `[RAG] Retrieved context (${ragContext.length} chars, ${docs.length} docs)`,
      );

      const ragMessage: ChatCompletionMessageParam = {
        role: "system",
        content: `[Retrieved Context from Knowledge Base]:\n${ragContext}`,
      };

      const newMessages = [
        ...body.messages.slice(0, -1),
        ragMessage,
        ...body.messages.slice(-1),
      ];
      return {...body, messages: newMessages};
    } catch (error) {
      console.error("[RAG] Error retrieving context:", error);
      return body;
    }
  }

  private extractQuery(body: ChatBody): string | null {
    const lastMessage = body.messages.at(body.messages.length - 1);
    if (lastMessage?.role !== "user") {
      // If the last message isn't from the user, we won't inject RAG context
      console.warn(
        "[RAG] Last message is not from user, skipping RAG context injection",
      );
      return null;
    }

    return this.normalizeContent(lastMessage.content);
  }

  private normalizeContent(
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

  private formatDocuments(docs: RetrievedDocument[]): string {
    if (docs.length === 0) return "";
    return docs
      .map((doc) => `[Document: ${doc.file} | Chunk ${doc.chunkId}]\n${doc.text}`)
      .join("\n\n---\n\n");
  }
}
