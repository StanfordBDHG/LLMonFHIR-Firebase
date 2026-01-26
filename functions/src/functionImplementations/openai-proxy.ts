//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {onRequest} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import {retrieveRAGContext} from "../rag/retriever";
import {auth, serviceAccount} from "../utils/firebase";

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

export const chat = onRequest(
  {secrets: [openAIAPIKey], cors: true, serviceAccount: serviceAccount},
  async (req, res) => {
    if (req.method !== "POST") {
      console.error("Called with non-POST method:", req.method);
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Extract the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Unauthorized: Missing or invalid Authorization header");
      res.status(401).json({error: "Unauthorized"});
      return;
    }

    try {
      const token = authHeader.split("Bearer ")[1];
      await auth.verifyIdToken(token, true);
    } catch (error) {
      console.error("Unauthorized: Failed to verify ID token", error);
      res.status(401).json({error: "Invalid token"});
      return;
    }

    try {
      const apiKey = openAIAPIKey.value();
      if (!apiKey) {
        console.error("Server error: OPENAI_API_KEY not configured");
        res.status(500).json({error: "OPENAI_API_KEY not configured"});
        return;
      }

      const openai = new OpenAI({apiKey});

      // Expects OpenAI streaming or non-streaming request
      const chatBody = req.body as ChatBody;

      // Parse ragEnabled query parameter (default: true)
      // Note: This is for testing purposes
      const ragEnabled = req.query.ragEnabled !== "false";
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
        // Set streaming headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Emit RAG context metadata first if available
        if (process.env.OUTPUT_RAG_CONTEXT && ragContext && ragContext.trim()) {
          const ragMetadata = {
            type: "rag_context",
            context: ragContext,
            contextLength: ragContext.length,
            enabled: ragEnabled,
          };
          res.write(`data: ${JSON.stringify(ragMetadata)}\n\n`);
        }

        const stream = await openai.chat.completions.create(chatBody);
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.write("data: [DONE]\n\n");
        res.end();
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

      res.json(responseWithRAG);
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

      if (!res.headersSent) {
        const status = isOpenAIError ? error.status : 500;
        res.status(status).json(payload);
        return;
      }

      if (res.writable) {
        const streamMessage =
          error instanceof Error ? error.message : "Streaming error";
        const streamPayload = isOpenAIError ?
          payload :
          {error: {message: streamMessage, type: "stream_error"}};
        res.write(`data: ${JSON.stringify(streamPayload)}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }
  },
);
