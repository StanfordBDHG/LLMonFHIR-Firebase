import {ChatBody} from "./chat-service";

/** Transforms a {@link ChatBody} before it reaches the underlying ChatService. */
export interface ChatInterceptor {
  intercept(body: ChatBody): Promise<ChatBody>;
}
