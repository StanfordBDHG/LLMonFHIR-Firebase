import {genkit} from "genkit";
import openAI from "@genkit-ai/compat-oai/openai";
import {ServiceFactory} from "./service-factory";
import {ChatService} from "../chat/chat-service";
import {OpenAIChatService} from "../chat/openai-chat-service";
import {InterceptedChatService} from "../chat/intercepted-chat-service";
import {RAGChatInterceptor} from "../chat/rag-chat-interceptor";
import {FileChunkingStrategy} from "../chunking/chunking-strategy";
import {ComposedChunkingStrategy} from "../chunking/composed-chunking-strategy";
import {PdfTextExtractor} from "../chunking/pdf-text-extractor";
import {SlidingWindowTextChunker} from "../chunking/sliding-window-text-chunker";
import {ContextStore} from "../context/context-store";
import {FirestoreContextStore} from "../context/firestore-context-store";
import {EmbeddingService} from "../embedding/embedding-service";
import {GenkitEmbeddingService} from "../embedding/genkit-embedding-service";
import {IndexingService} from "../indexing/indexing-service";
import {DefaultIndexingService} from "../indexing/default-indexing-service";

export interface ServiceFactoryOptions {
  studyId: string;
  openAiApiKey: string;
}

export class DefaultServiceFactory implements ServiceFactory {
  readonly chatService: ChatService;
  readonly indexingService: IndexingService;
  readonly contextStore: ContextStore;
  readonly embeddingService: EmbeddingService;
  readonly chunkingStrategy: FileChunkingStrategy;

  constructor(options: ServiceFactoryOptions) {
    const ai = genkit({
      plugins: [openAI({apiKey: options.openAiApiKey})],
    });

    // Context store (Firestore-backed vector store)
    this.contextStore = new FirestoreContextStore(options.studyId, ai);

    // Embedding service
    this.embeddingService = new GenkitEmbeddingService(ai);

    // Chunking: PDF text extraction → sliding-window text chunking
    this.chunkingStrategy = new ComposedChunkingStrategy(
      new PdfTextExtractor(),
      new SlidingWindowTextChunker(),
    );

    // Indexing pipeline: chunk → embed → store
    this.indexingService = new DefaultIndexingService(
      this.chunkingStrategy,
      this.embeddingService,
      this.contextStore,
    );

    // Chat: OpenAI with RAG context injection
    this.chatService = new InterceptedChatService(
      new OpenAIChatService(options.openAiApiKey),
      [new RAGChatInterceptor(this.contextStore)],
    );
  }
}