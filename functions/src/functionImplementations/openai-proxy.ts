//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {onCall} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import {retrieveRAGContext} from "../rag/retriever";
import {serviceAccount} from "../utils/firebase";

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

  const ragSystemMessage: ChatCompletionMessageParam = {
    role: "system",
    content: `[Retrieved Context from Knowledge Base]:\n${ragContext}`,
  };

  // Check if there's already a system message
  const hasSystemMessage = messages.some((msg) => msg.role === "system");

  if (hasSystemMessage) {
    // Insert after the first system message
    const result = [...messages];
    const firstSystemIndex = result.findIndex((msg) => msg.role === "system");
    result.splice(firstSystemIndex + 1, 0, ragSystemMessage);
    return result;
  }

  // Insert at the beginning
  return [ragSystemMessage, ...messages];
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

const openAIAPIKey = defineSecret("OPENAI_API_KEY");

export const chat = onCall(
  {secrets: [openAIAPIKey], cors: true, serviceAccount: serviceAccount},
  async (req, res) => {
    try {
      const apiKey = openAIAPIKey.value();
      if (!apiKey) {
        console.error("Server error: OPENAI_API_KEY not configured");
        throw new Error("OPENAI_API_KEY not configured");
      }

      const openai = new OpenAI({apiKey});

      // Expects OpenAI streaming or non-streaming request
      const chatBody = JSON.parse(req.data) as ChatBody;

      // Parse ragEnabled query parameter (default: true)
      // Note: This is for testing purposes
      const ragEnabled = req.rawRequest.query.ragEnabled !== "false";
      console.log(`[RAG] RAG enabled: ${ragEnabled}`);

      // RAG: Retrieve context for the last user message
      let augmentedMessages = chatBody.messages;
      let ragContext = "";
      try {
        if (ragEnabled) {
          const lastUserMessage =
            [...chatBody.messages]
              .reverse()
              .filter((message) => message.role === "user")
              .map((message) => normalizeMessageContent(message.content))
              .find(Boolean) ?? "";

          if (lastUserMessage) {
            console.log(
              `[RAG] Retrieving context for user message: "${lastUserMessage.substring(0, 100)}..."`,
            );
            ragContext = await retrieveRAGContext({
              query: lastUserMessage,
              studyId: "spineai",
            });
            if (ragContext && ragContext.trim()) {
              console.log(
                `[RAG] Retrieved context length: ${ragContext.length}`,
              );
              augmentedMessages = injectRAGContext(
                chatBody.messages,
                ragContext,
              );
              console.log(
                `[RAG] Messages count changed from ${chatBody.messages.length} to ${augmentedMessages.length}`,
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

      // Update the body with augmented messages
      chatBody.messages = augmentedMessages;

      if (chatBody?.stream) {
        console.log("Starting streaming response...");
        // Set streaming headers

        // Emit RAG context metadata first if available
        if (process.env.OUTPUT_RAG_CONTEXT && ragContext && ragContext.trim()) {
          const ragMetadata = {
            type: "rag_context",
            context: ragContext,
            contextLength: ragContext.length,
            enabled: ragEnabled,
          };
          res?.sendChunk(`data: ${JSON.stringify(ragMetadata)}\n\n`);
        }

        const stream = await openai.chat.completions.create(chatBody);
        for await (const chunk of stream) {
          res?.sendChunk(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res?.sendChunk("data: [DONE]\n\n");
        return;
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

      // if (!res.headersSent) {
      //   const status = isOpenAIError ? error.status : 500;
      //   res.status(status).json(payload);
      //   return;
      // }

      const streamMessage =
          error instanceof Error ? error.message : "Streaming error";
        const streamPayload = isOpenAIError ?
          payload :
          {error: {message: streamMessage, type: "stream_error"}};
        return `data: ${JSON.stringify(streamPayload)}\n\ndata: [DONE]\n\n`;
    }
  },
);
