//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {HttpsError, onCall} from "firebase-functions/https";
import OpenAI from "openai";
import {Secrets, SERVICE_ACCOUNT} from "../env";
import {getServiceFactory} from "../services/factory/get-service-factory";
import {ChatBody} from "../services/chat/chat-service";

export const chat = onCall(
  {secrets: [Secrets.OPENAI_API_KEY], serviceAccount: SERVICE_ACCOUNT},
  async (req, res) => {
    if (!req.auth?.token) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const chatBody = JSON.parse(req.data) as ChatBody;

    try {
      const factory = getServiceFactory({
        studyId: "spineai",
        openAiApiKey: Secrets.OPENAI_API_KEY.value(),
      });

      return await factory.chatService.chat(
        chatBody,
        res ? (chunk) => res.sendChunk(chunk) : undefined,
      );
    } catch (error: unknown) {
      console.error("Error in chat endpoint:", error);
      return formatErrorResponse(error, chatBody.stream ?? false);
    }
  },
);

// ── Error formatting ────────────────────────────────────────────────────────

function formatErrorResponse(error: unknown, isStreaming: boolean): string {
  const isOpenAIError = error instanceof OpenAI.APIError;
  const apiError = isOpenAIError ? error : undefined;
  const openAIError = isOpenAIError ? apiError?.error : undefined;
  const fallbackMessage =
    error instanceof Error ? error.message : "Internal server error";

  const payload = isOpenAIError
    ? {
        error: {
          message:
            openAIError?.message ?? apiError?.message ?? "OpenAI error",
          type: openAIError?.type ?? "openai_error",
          code: openAIError?.code ?? null,
          param: openAIError?.param ?? null,
        },
      }
    : {error: {message: fallbackMessage, type: "server_error"}};

  if (isStreaming) {
    return `data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`;
  }
  return JSON.stringify(payload);
}
