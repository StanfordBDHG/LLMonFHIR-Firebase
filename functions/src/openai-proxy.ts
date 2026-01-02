import { genkit, z } from "genkit/beta";
import { onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { openAI } from "@genkit-ai/compat-oai/openai";
import type { Response } from "express";

// OpenAI API Types
interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

// Genkit Types
interface GenkitMessage {
  role: "user" | "model";
  content: Array<{ text: string }>;
}

interface GenkitInterrupt {
  toolRequest?: {
    id?: string;
    ref?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
}

// Internal Types
interface ToolCallState {
  id?: string;
  type?: string;
  function: {
    name?: string;
    arguments?: string;
  };
}

interface StreamContext {
  completionId: string;
  created: number;
  modelName: string;
  toolCallsMap: Map<number, ToolCallState>;
  finishReason: string | null;
}

const openAIApiKey = defineSecret("OPENAI_API_KEY");

const ai = genkit({
  plugins: [openAI()],
});

const getResourcesInterrupt = ai.defineInterrupt({
  name: "get_resources",
  description: "Retrieves FHIR health resources based on resource types.",
  inputSchema: z.object({
    resourceTypes: z.array(z.string()),
    query: z.string().optional(),
  }),
  outputSchema: z.object({
    resources: z.array(z.any()),
    count: z.number(),
  }),
});

const extractSystemPrompt = (messages: OpenAIMessage[]): string | undefined =>
  messages.find((m) => m.role === "system")?.content ?? undefined;

const formatToolResult = (content: string | null): string => {
  try {
    const data = typeof content === "string" ? JSON.parse(content) : content;
    return JSON.stringify(data, null, 2);
  } catch {
    return content ?? "";
  }
};

const extractContent = (
  content: string | null | Array<{ text: string }>
): string => (Array.isArray(content) ? content[0]?.text ?? "" : content ?? "");

const mergeToolResultsIntoMessage = (
  userMsg: OpenAIMessage,
  toolResults: OpenAIMessage[]
): OpenAIMessage => {
  const originalContent = extractContent(
    userMsg.content as string | null | Array<{ text: string }>
  );
  const toolResultsText = toolResults
    .map((tr) => formatToolResult(tr.content))
    .join("\n\n");
  return {
    ...userMsg,
    content: `${originalContent}\n\n[Tool Results]:\n${toolResultsText}`,
  };
};

const findLastIndex = <T>(
  arr: T[],
  predicate: (item: T) => boolean
): number => {
  const reversed = [...arr].reverse();
  const index = reversed.findIndex(predicate);
  return index === -1 ? -1 : arr.length - 1 - index;
};

const processMessages = (messages: OpenAIMessage[]): OpenAIMessage[] =>
  messages.reduce<OpenAIMessage[]>((acc, msg, idx, arr) => {
    // Skip system and tool messages (handled separately)
    if (msg.role === "system" || msg.role === "tool") return acc;

    // Handle assistant messages with tool_calls - merge results into previous user message
    if (msg.role === "assistant" && msg.tool_calls?.length) {
      const toolResults = arr
        .slice(idx + 1)
        .filter((m): m is OpenAIMessage => m.role === "tool");

      const lastUserIdx = findLastIndex(acc, (m) => m.role === "user");
      if (lastUserIdx >= 0 && toolResults.length > 0) {
        acc[lastUserIdx] = mergeToolResultsIntoMessage(
          acc[lastUserIdx],
          toolResults
        );
      }
      return acc;
    }

    return [...acc, msg];
  }, []);

const toGenkitMessage = (msg: OpenAIMessage): GenkitMessage => ({
  role: msg.role === "assistant" ? "model" : "user",
  content: [
    {
      text: extractContent(
        msg.content as string | null | Array<{ text: string }>
      ),
    },
  ],
});

const convertToGenkitMessages = (messages: OpenAIMessage[]): GenkitMessage[] =>
  messages
    .filter(
      (m): m is OpenAIMessage => m.role === "user" || m.role === "assistant"
    )
    .map(toGenkitMessage);

const createStreamChunk = (
  ctx: StreamContext,
  delta: OpenAIStreamChunk["choices"][0]["delta"],
  finishReason: string | null = null
): OpenAIStreamChunk => ({
  id: ctx.completionId,
  object: "chat.completion.chunk",
  created: ctx.created,
  model: ctx.modelName,
  choices: [{ index: 0, delta, finish_reason: finishReason }],
});

const sendChunk = (res: Response, chunk: OpenAIStreamChunk): void => {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
};

const generateToolCallId = (): string =>
  `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

const parseInterrupt = (interrupt: GenkitInterrupt) => {
  const toolRequest = interrupt.toolRequest ?? {};
  return {
    id: toolRequest.id ?? toolRequest.ref ?? generateToolCallId(),
    name: toolRequest.name ?? "get_resources",
    args: JSON.stringify(toolRequest.input ?? {}),
  };
};

const streamToolCall = (
  res: Response,
  ctx: StreamContext,
  idx: number,
  toolCallId: string,
  functionName: string,
  functionArgs: string
): void => {
  if (!ctx.toolCallsMap.has(idx)) {
    ctx.toolCallsMap.set(idx, { function: {} });
  }
  const toolCall = ctx.toolCallsMap.get(idx)!;

  // Send id chunk
  if (!toolCall.id) {
    toolCall.id = toolCallId;
    toolCall.type = "function";
    sendChunk(
      res,
      createStreamChunk(ctx, {
        role: "assistant",
        content: null,
        tool_calls: [{ index: idx, id: toolCallId, type: "function" }],
      })
    );
  }

  // Send function name chunk
  if (!toolCall.function.name) {
    toolCall.function.name = functionName;
    sendChunk(
      res,
      createStreamChunk(ctx, {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            index: idx,
            id: toolCallId,
            type: "function",
            function: { name: functionName },
          },
        ],
      })
    );
  }

  // Send function arguments chunk
  if (!toolCall.function.arguments) {
    toolCall.function.arguments = functionArgs;
    sendChunk(
      res,
      createStreamChunk(ctx, {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            index: idx,
            id: toolCallId,
            type: "function",
            function: { arguments: functionArgs },
          },
        ],
      })
    );
  }
};

const streamToolCalls = (
  res: Response,
  ctx: StreamContext,
  interrupts: GenkitInterrupt[]
): void => {
  interrupts.forEach((interrupt, idx) => {
    const { id, name, args } = parseInterrupt(interrupt);
    streamToolCall(res, ctx, idx, id, name, args);
  });
};

const sendTextChunk = (
  res: Response,
  ctx: StreamContext,
  content: string
): void => {
  sendChunk(res, createStreamChunk(ctx, { role: "assistant", content }));
};

const sendFinalChunk = (res: Response, ctx: StreamContext): void => {
  const hasToolCalls = ctx.toolCallsMap.size > 0;
  const delta = hasToolCalls
    ? { role: "assistant", content: null, tool_calls: [] }
    : {};
  const finishReason =
    ctx.finishReason ?? (hasToolCalls ? "tool_calls" : "stop");

  sendChunk(res, createStreamChunk(ctx, delta, finishReason));
  res.write("data: [DONE]\n\n");
};

const chatFlow = ai.defineFlow(
  {
    name: "chatFlow",
    inputSchema: z.object({
      model: z.string().optional(),
      messages: z.array(z.any()).optional(),
      prompt: z.string().optional(),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    const modelName = input.model ?? "gpt-4o-mini";
    const inputMessages = input.messages as OpenAIMessage[] | undefined;

    const systemPrompt = inputMessages
      ? extractSystemPrompt(inputMessages)
      : undefined;
    const messages: GenkitMessage[] = inputMessages
      ? convertToGenkitMessages(processMessages(inputMessages))
      : input.prompt
      ? [{ role: "user", content: [{ text: input.prompt }] }]
      : (() => {
          throw new Error("Either messages or prompt must be provided");
        })();

    const generateOptions = {
      model: openAI.model(modelName),
      messages,
      tools: [getResourcesInterrupt],
      config: { temperature: 1 },
      ...(systemPrompt && { system: systemPrompt }),
    };

    return ai.generateStream(generateOptions);
  }
);

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

const handleStreamError = (res: Response, error: Error): void => {
  if (!res.headersSent || res.writable) {
    res.write(
      `data: ${JSON.stringify({
        error: {
          message: error.message || "Streaming error",
          type: "stream_error",
        },
      })}\n\n`
    );
    res.write("data: [DONE]\n\n");
  }
  res.end();
};

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
      const { model, messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      const modelName = model ?? "gpt-4o-mini";
      const { stream, response: responsePromise } = await chatFlow({
        model: modelName,
        messages,
      });

      setupStreamingHeaders(res);

      const ctx: StreamContext = {
        completionId: `chatcmpl-${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        modelName,
        toolCallsMap: new Map(),
        finishReason: null,
      };

      try {
        // Process stream chunks
        for await (const chunk of stream) {
          const chunkData = chunk as {
            text?: string;
            interrupts?: GenkitInterrupt[];
            finishReason?: string;
          };

          // Handle text content
          if (chunkData.text) {
            sendTextChunk(res, ctx, chunkData.text);
          }

          // Handle tool calls from stream
          if (chunkData.interrupts?.length) {
            streamToolCalls(res, ctx, chunkData.interrupts);
          }

          // Track finish reason
          if (chunkData.finishReason) {
            ctx.finishReason =
              chunkData.finishReason === "interrupted" ? "tool_calls" : "stop";
          }
        }

        // Check final response for interrupts (may not appear in stream)
        if (responsePromise) {
          const finalResponse = (await responsePromise) as {
            interrupts?: GenkitInterrupt[];
            finishReason?: string;
          };

          if (finalResponse.interrupts?.length && ctx.toolCallsMap.size === 0) {
            streamToolCalls(res, ctx, finalResponse.interrupts);
            ctx.finishReason =
              finalResponse.finishReason === "interrupted"
                ? "tool_calls"
                : "stop";
          }
        }

        sendFinalChunk(res, ctx);
        res.end();
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        handleStreamError(res, streamError as Error);
      }
    } catch (error) {
      console.error("Error in chat endpoint:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            message: (error as Error).message || "Internal server error",
            type: "server_error",
          },
        });
      }
    }
  }
);
