import {ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming} from "openai/resources";
import {ChatInterceptor} from "./chat-interceptor";
import {ChatBody, ChatService, OnChunk} from "./chat-service";

/** Applies a chain of interceptors before delegating to an inner ChatService. */
export class InterceptedChatService implements ChatService {
  constructor(
    private readonly inner: ChatService,
    private readonly interceptors: ChatInterceptor[],
  ) {}

  async chatNonStreaming(body: ChatCompletionCreateParamsNonStreaming): Promise<string | undefined> {
    const updatedBody = await this.applyInterceptors(body);
    return this.inner.chatNonStreaming(updatedBody as ChatCompletionCreateParamsNonStreaming);
  }

  async chatStreaming(body: ChatCompletionCreateParamsStreaming, onChunk: OnChunk): Promise<void> {
    const updatedBody = await this.applyInterceptors(body);
    return this.inner.chatStreaming(updatedBody as ChatCompletionCreateParamsStreaming, onChunk);
  }

  private async applyInterceptors(body: ChatBody): Promise<ChatBody> {
    let current = body;
    for (const interceptor of this.interceptors) {
      current = await interceptor.intercept(current);
    }
    return current;
  }
}
