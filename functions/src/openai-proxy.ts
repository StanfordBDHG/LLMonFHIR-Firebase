import { onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import type { Response } from "express";
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";

const openAIApiKey = defineSecret("OPENAI_API_KEY");

const setupStreamingHeaders = (res: Response): void => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
};

const handleOptionsRequest = (res: Response): void => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).send("");
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasMessagesArray(
  body: unknown
): body is { messages: unknown[] } & Record<string, unknown> {
  return isObject(body) && Array.isArray(body.messages);
}

export const chat = onRequest(
  { secrets: [openAIApiKey], cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      handleOptionsRequest(res);
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "OPENAI_API_KEY not configured" });
        return;
      }

      const openai = new OpenAI({ apiKey });

      const body:
        | ChatCompletionCreateParamsStreaming
        | ChatCompletionCreateParamsNonStreaming = req.body;

      if (!hasMessagesArray(body)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      if (body?.stream) {
        setupStreamingHeaders(res);

        const stream = await openai.chat.completions.create(
          body as ChatCompletionCreateParamsStreaming // should be safe since we checked for stream flag
        );
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const response = await openai.chat.completions.create(
        body as ChatCompletionCreateParamsNonStreaming // should be safe since we checked for stream flag
      );
      res.json(response);
    } catch (error: unknown) {
      console.error("Error in chat endpoint:", error);

      if (!res.headersSent) {
        // The OpenAI SDK throws OpenAI.APIError (and subclasses).
        // We can narrow it structurally without relying on axios fields.
        if (isObject(error) && typeof error.status === "number") {
          res
            .status(error.status)
            .json(
              "error" in error
                ? (error as any).error
                : { error: (error as any).message }
            );
        } else {
          const message =
            error instanceof Error ? error.message : "Internal server error";
          res.status(500).json({
            error: { message, type: "server_error" },
          });
        }
        return;
      }

      if (res.writable) {
        const message =
          error instanceof Error ? error.message : "Streaming error";
        res.write(
          `data: ${JSON.stringify({
            error: { message, type: "stream_error" },
          })}\n\n`
        );
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }
  }
);
