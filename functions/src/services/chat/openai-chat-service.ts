import OpenAI from "openai";
import {ChatBody, ChatService, OnChunk} from "./chat-service";

/** ChatService implementation backed by the OpenAI API. */
export class OpenAIChatService implements ChatService {
  private readonly openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({apiKey});
  }

  async chat(body: ChatBody, onChunk?: OnChunk): Promise<string | undefined> {
    if (body.stream) {
      if (!onChunk) {
        throw new Error("onChunk callback is required for streaming requests");
      }
      const stream = await this.openai.chat.completions.create(body);
      for await (const chunk of stream) {
        onChunk(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      onChunk("data: [DONE]\n\n");
      return undefined;
    }

    const response = await this.openai.chat.completions.create(body);
    return JSON.stringify(response);
  }
}
