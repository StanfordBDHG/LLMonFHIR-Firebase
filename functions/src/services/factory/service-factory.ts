import {ChatService} from "../chat/chat-service";
import {FileChunkingStrategy} from "../chunking/chunking-strategy";
import {ContextStore} from "../context/context-store";
import {EmbeddingService} from "../embedding/embedding-service";
import {IndexingService} from "../indexing/indexing-service";

export interface ServiceFactory {
  readonly chatService: ChatService;
  readonly indexingService: IndexingService;
  readonly contextStore: ContextStore;
  readonly embeddingService: EmbeddingService;
  readonly chunkingStrategy: FileChunkingStrategy;
}