//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import OpenAI from "openai";
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources";
import {ChatInterceptor} from "./chat-interceptor";


export type ChatBody =
  | ChatCompletionCreateParamsStreaming
  | ChatCompletionCreateParamsNonStreaming;

/** Callback invoked for each chunk during a streaming response. */
export type OnChunk = (data: string) => Promise<boolean>;

export class ChatService {
  private readonly openai: OpenAI;

  constructor(
    apiKey: string,
    private readonly interceptors: ChatInterceptor[],
  ) {
    this.openai = new OpenAI({apiKey});
  }

  async chatNonStreaming(body: ChatCompletionCreateParamsNonStreaming): Promise<string> {
    const updatedBody = await this.applyInterceptors(body);
    const response = await this.openai.chat.completions.create(updatedBody as ChatCompletionCreateParamsNonStreaming);
    return JSON.stringify(response);
  }

  async chatStreaming(body: ChatCompletionCreateParamsStreaming, onChunk: OnChunk): Promise<void> {
    const updatedBody = await this.applyInterceptors(body);
    const stream = await this.openai.chat.completions.create(updatedBody as ChatCompletionCreateParamsStreaming);
    for await (const chunk of stream) {
      const shouldContinue = await onChunk(`data: ${JSON.stringify(chunk)}\n\n`);
      if (!shouldContinue) {
        break;
      }
    }
    await onChunk("data: [DONE]\n\n");
  }

  private async applyInterceptors(body: ChatBody): Promise<ChatBody> {
    let current = body;
    for (const interceptor of this.interceptors) {
      current = await interceptor.intercept(current);
    }
    return current;
  }
}
