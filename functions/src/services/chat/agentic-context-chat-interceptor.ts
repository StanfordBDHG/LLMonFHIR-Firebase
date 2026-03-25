//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import OpenAI from "openai";
import {ChatCompletionMessageParam} from "openai/resources/chat/completions";
import {ChatInterceptor} from "./chat-interceptor";
import {ChatBody} from "./chat-service";
import {ContextStore, RetrievedDocument} from "../context/context-store";

const RAG_RETRIEVAL_LIMIT = 10;

const RETRIEVE_CONTEXT_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "retrieve_context",
    description:
      "Retrieve relevant context from the knowledge base using a search query.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant context.",
        },
      },
      required: ["query"],
    },
  },
};

/**
 * Intercepts chat requests by first running an internal non-streaming LLM call
 * to determine an optimal RAG query, then injecting the retrieved context as a
 * system message before the last user message.
 *
 * Unlike {@link RAGChatInterceptor} which uses the last user message verbatim,
 * this interceptor lets the model reformulate the query from the full
 * conversation history for higher-quality retrieval.
 *
 * Failures at any step are logged and silently ignored so the chat can proceed
 * without context.
 */
export class AgenticContextChatInterceptor implements ChatInterceptor {
  private readonly openai: OpenAI;

  constructor(
    apiKey: string,
    private readonly contextStore: ContextStore,
  ) {
    this.openai = new OpenAI({apiKey});
  }

  async intercept(body: ChatBody): Promise<ChatBody> {
    try {
      const lastMessage = body.messages.at(-1);
      if (lastMessage?.role !== "user") {
        console.warn(
          "[AgenticRAG] Last message is not from user, skipping context injection",
        );
        return body;
      }

      const query = await this.determineQuery(body);
      if (!query) return body;

      console.log(`[AgenticRAG] Using query: "${query}"`);

      const docs = await this.contextStore.retrieve(query, RAG_RETRIEVAL_LIMIT);
      const ragContext = this.formatDocuments(docs);

      if (!ragContext) {
        console.log("[AgenticRAG] No relevant context found");
        return body;
      }

      console.log(
        `[AgenticRAG] Retrieved context (${ragContext.length} chars, ${docs.length} docs)`,
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
      console.error("[AgenticRAG] Error during context injection:", error);
      return body;
    }
  }

  private async determineQuery(body: ChatBody): Promise<string | null> {
    const messages = this.buildInternalMessages(body.messages);

    const response = await this.openai.chat.completions.create({
      model: body.model,
      messages,
      tools: [RETRIEVE_CONTEXT_TOOL],
      tool_choice: {type: "function", function: {name: "retrieve_context"}},
      stream: false,
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.find(
      (tc) => tc.type === "function" && tc.function.name === "retrieve_context",
    );

    if (!toolCall || toolCall.type !== "function") {
      console.warn("[AgenticRAG] No retrieve_context tool call in response");
      return null;
    }

    const args = JSON.parse(toolCall.function.arguments) as {query?: string};
    return args.query ?? null;
  }

  private buildInternalMessages(
    messages: ChatCompletionMessageParam[],
  ): ChatCompletionMessageParam[] {
    const firstSystemIndex = messages.findIndex((m) => m.role === "system");
    const originalSystemContent =
      firstSystemIndex >= 0
        ? this.extractTextContent(messages[firstSystemIndex].content)
        : null;

    const adaptedSystemPrompt = [
      "You are a context retrieval assistant. Based on the conversation, determine what information needs to be looked up in the knowledge base to answer the user's last message.",
      "Call the `retrieve_context` function with a concise and specific search query that will retrieve the most relevant context.",
      ...(originalSystemContent
        ? ["", "Original system instructions:", originalSystemContent]
        : []),
    ].join("\n");

    const adaptedSystemMessage: ChatCompletionMessageParam = {
      role: "system",
      content: adaptedSystemPrompt,
    };

    // Replace the first system message (or prepend one), keep remaining non-tool messages
    const nonSystemMessages = messages.filter(
      (m, i) => !(m.role === "system" && i === firstSystemIndex),
    );

    return [adaptedSystemMessage, ...nonSystemMessages];
  }

  private extractTextContent(
    content: ChatCompletionMessageParam["content"],
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
