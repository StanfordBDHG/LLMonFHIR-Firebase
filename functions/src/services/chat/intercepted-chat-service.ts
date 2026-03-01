import {ChatInterceptor} from "./chat-interceptor";
import {ChatBody, ChatService, OnChunk} from "./chat-service";

/** Applies a chain of interceptors before delegating to an inner ChatService. */
export class InterceptedChatService implements ChatService {
  constructor(
    private readonly inner: ChatService,
    private readonly interceptors: ChatInterceptor[],
  ) {}

  async chat(body: ChatBody, onChunk?: OnChunk): Promise<string | undefined> {
    let current = body;
    for (const interceptor of this.interceptors) {
      current = await interceptor.intercept(current);
    }
    return this.inner.chat(current, onChunk);
  }
}
