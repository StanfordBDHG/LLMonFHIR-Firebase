//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import { HttpsError, onCall } from "firebase-functions/https";
import OpenAI from "openai";
import { Secrets, SERVICE_ACCOUNT } from "../env.js";
import { type ChatBody } from "../services/chat/chat-service.js";
import { createChatService } from "../services/create-services.js";

export const chat = onCall(
  {
    secrets: [Secrets.OPENAI_API_KEY],
    serviceAccount: SERVICE_ACCOUNT,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (req, res): Promise<string | undefined> => {
    if (!req.auth?.token) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const ragEnabled = req.rawRequest.query.ragEnabled === "true";

    const studyId = req.rawRequest.query.studyId;
    if (typeof studyId !== "string" || !studyId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing or invalid studyId query parameter",
      );
    }

    const chatBody = JSON.parse(req.data as string) as ChatBody;
    try {
      const chatService = createChatService({
        studyId,
        openAIApiKey: Secrets.OPENAI_API_KEY.value(),
        ragEnabled,
      });

      if (chatBody.stream && req.acceptsStreaming) {
        if (res === undefined) {
          throw new HttpsError(
            "internal",
            "Streaming responses are not supported in this environment",
          );
        }
        await chatService.chatStreaming(chatBody, (chunk) =>
          res.sendChunk(chunk),
        );
        return;
      } else {
        return await chatService.chatNonStreaming({
          ...chatBody,
          stream: false,
        });
      }
    } catch (error: unknown) {
      console.error("Error in chat endpoint:", error);
      return formatErrorResponse(error, chatBody.stream ?? false);
    }
  },
);

// ── Error formatting ────────────────────────────────────────────────────────

const formatErrorResponse = (error: unknown, isStreaming: boolean): string => {
  if (!(error instanceof OpenAI.APIError)) {
    const fallbackMessage =
      error instanceof Error ? error.message : "Internal server error";
    const payload = {
      error: { message: fallbackMessage, type: "server_error" },
    };
    if (isStreaming) {
      return `data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`;
    }
    return JSON.stringify(payload);
  }

  const openAIError = error.error as
    | { message?: string; type?: string; code?: string; param?: string }
    | undefined;
  const payload = {
    error: {
      message: openAIError?.message ?? error.message,
      type: openAIError?.type ?? "openai_error",
      code: openAIError?.code ?? null,
      param: openAIError?.param ?? null,
    },
  };

  if (isStreaming) {
    return `data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`;
  }
  return JSON.stringify(payload);
};
