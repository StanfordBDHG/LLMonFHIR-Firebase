//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {HttpsError, onCall} from "firebase-functions/https";
import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import {retrieveRAGContext} from "../rag/retriever";
import {serviceAccount} from "../utils/firebase";
import {openAIAPIKey} from "../utils/genkit";

type ChatBody =
  | ChatCompletionCreateParamsStreaming
  | ChatCompletionCreateParamsNonStreaming;

// Function to inject RAG context into the messages array
function injectRAGContext(
  messages: ChatCompletionMessageParam[],
  ragContext: string,
) {
  if (!ragContext || ragContext.trim() === "") {
    return messages;
  }

  if (messages.at(messages.length - 1)?.role !== "user") {
    // If the last message isn't from the user, we won't inject RAG context
    console.warn(
      "[RAG] Last message is not from user, skipping RAG context injection",
    );
    return messages;
  }

  const ragSystemMessage: ChatCompletionMessageParam = {
    role: "system",
    content: `[Retrieved Context from Knowledge Base]:\n${ragContext}`,
  };

  const result = [...messages.slice(0, -1), ragSystemMessage, ...messages.slice(-1)];
  console.log("[RAG]: Conversation start");
  console.log(
    result.map((message) => `[RAG: ${message.role}] "${message.content?.slice(0, 100)}..."`).join("\n")
  );
  console.log("[RAG]: Conversation end");
  return result;
}

// Joins together text parts only
const normalizeMessageContent = (
  content?: ChatCompletionMessageParam["content"],
): string => {
  if (typeof content === "string") {
    return content;
  }

  if (!content) {
    return "";
  }

  // Keep only text parts
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (typeof part === "object" && part !== null && "text" in part) {
        return typeof part.text === "string" ? part.text : "";
      }

      return "";
    })
    .filter(Boolean)
    .join(" ");
};

export const chat = onCall(
  {secrets: [openAIAPIKey], serviceAccount: serviceAccount},
  async (req, res): Promise<string> => {
    if (!req.auth?.token) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const apiKey = openAIAPIKey.value();
      if (!apiKey) {
        console.error("Server error: OPENAI_API_KEY not configured");
        throw new HttpsError("internal", "OPENAI_API_KEY not configured");
      }

      const openai = new OpenAI({apiKey});

      // Expects OpenAI streaming or non-streaming request
      const chatBody = JSON.parse(req.data) as ChatBody;

      // Parse ragEnabled query parameter (default: true)
      // Note: This is for testing purposes
      const ragEnabled = req.rawRequest.query.ragEnabled !== "false";
      console.log(`[RAG] RAG enabled: ${ragEnabled}`);

      // RAG: Retrieve context for the last user message
      let ragContext = "";
      try {
        const chatHistory = chatBody.messages
          .map((m) => `  > [${m.role}] "${normalizeMessageContent(m.content)}..."`)
          .join("\n");
        console.log(`[RAG] Received ${chatBody.messages.length} messages:\n${chatHistory}`);
        if (ragEnabled) {
          const initialMessageLength = chatBody.messages.length;
          const query =
            [...chatBody.messages]
              .reverse()
              .slice(0, 3)
              .map((message) => `[${message.role}]: "${normalizeMessageContent(message.content)}"`)
              .join("\n\n");

          if (query) {
            console.log(
              `[RAG] Retrieving context for user message: "${query}..."`,
            );
            ragContext = await retrieveRAGContext({
              query,
              studyId: "spineai",
            });
            if (ragContext && ragContext.trim()) {
              console.log(
                `[RAG] Retrieved context length: ${ragContext.length}`,
              );
              chatBody.messages = injectRAGContext(
                chatBody.messages,
                ragContext,
              );
              console.log(
                `[RAG] Messages count changed from ${initialMessageLength} to ${chatBody.messages.length}`,
              );
            } else {
              console.log("[RAG] No relevant context found");
            }
          }
        }
      } catch (ragError) {
        console.error("[RAG] Error retrieving context:", ragError);
        // Continue without RAG context if there's an error
      }

      if (chatBody?.stream) {
        // Set streaming headers

        // Emit RAG context metadata first if available
        if (process.env.OUTPUT_RAG_CONTEXT && ragContext && ragContext.trim()) {
          const ragMetadata = {
            type: "rag_context",
            context: ragContext,
            contextLength: ragContext.length,
            enabled: ragEnabled,
          };
          await res?.sendChunk(`data: ${JSON.stringify(ragMetadata)}\n\n`);
        }

        const stream = await openai.chat.completions.create(chatBody);
        for await (const chunk of stream) {
          await res?.sendChunk(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        return "data: [DONE]\n\n";
      }

      const response = await openai.chat.completions.create(chatBody);

      // Add RAG context metadata to non-streaming response
      const responseWithRAG = {
        ...response,
        _ragContext:
          ragContext && ragContext.trim() ?
            {
              context: ragContext,
              contextLength: ragContext.length,
              enabled: ragEnabled,
            } :
            null,
      };

      return JSON.stringify(responseWithRAG);
    } catch (error: unknown) {
      console.error("Error in chat endpoint:", error);

      const isOpenAIError = error instanceof OpenAI.APIError;
      const apiError = isOpenAIError ? error : null;
      const openAIError = apiError?.error;
      const fallbackMessage =
        error instanceof Error ? error.message : "Internal server error";
      const payload = isOpenAIError ?
        {
          error: {
            message:
                openAIError?.message ?? apiError?.message ?? "OpenAI error",
            type: openAIError?.type ?? "openai_error",
            code: openAIError?.code ?? null,
            param: openAIError?.param ?? null,
          },
        } :
        {error: {message: fallbackMessage, type: "server_error"}};

      const streamMessage =
          error instanceof Error ? error.message : "Streaming error";
      const streamPayload = isOpenAIError ?
        payload :
        {error: {message: streamMessage, type: "stream_error"}};
      return `data: ${JSON.stringify(streamPayload)}\n\ndata: [DONE]\n\n`;
    }
  },
);
