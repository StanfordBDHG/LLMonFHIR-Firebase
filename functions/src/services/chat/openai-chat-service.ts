//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import OpenAI from "openai";
import {ChatService, OnChunk} from "./chat-service";
import {ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming} from "openai/resources";

/** ChatService implementation backed by the OpenAI API. */
export class OpenAIChatService implements ChatService {
  private readonly openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({apiKey});
  }

  async chatNonStreaming(body: ChatCompletionCreateParamsNonStreaming): Promise<string | undefined> {
    const response = await this.openai.chat.completions.create(body);
    return JSON.stringify(response);
  }

  async chatStreaming(body: ChatCompletionCreateParamsStreaming, onChunk: OnChunk): Promise<void> {
    const stream = await this.openai.chat.completions.create(body);
    for await (const chunk of stream) {
      onChunk(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    onChunk("data: [DONE]\n\n");
  }
}
