import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources";


export type ChatBody =
  | ChatCompletionCreateParamsStreaming
  | ChatCompletionCreateParamsNonStreaming;

/** Callback invoked for each chunk during a streaming response. */
export type OnChunk = (data: string) => void;

export interface ChatService {
  /**
   * Processes a chat completion request.
   *
   * - Streaming (`body.stream === true`): sends chunks via `onChunk`
   *   and returns `undefined`.
   * - Non-streaming: returns the response as a JSON string.
   */
  chatNonStreaming(body: ChatCompletionCreateParamsNonStreaming): Promise<string | undefined>;

  chatStreaming(body: ChatCompletionCreateParamsStreaming, onChunk: OnChunk): Promise<void>;
}
