import {FileChunkingStrategy} from "../chunking/chunking-strategy";
import {ContextStore} from "../context/context-store";
import {EmbeddingService} from "../embedding/embedding-service";
import {IndexingService, IndexResult} from "./indexing-service";

/** Default indexing pipeline: chunk → embed → store. */
export class DefaultIndexingService implements IndexingService {
  constructor(
    private readonly chunkingStrategy: FileChunkingStrategy,
    private readonly embeddingService: EmbeddingService,
    private readonly contextStore: ContextStore,
  ) {}

  async index(filePath: string, fileName: string): Promise<IndexResult> {
    try {
      const chunks = await this.chunkingStrategy.chunkFile(filePath);
      console.log(
        `[Indexing] Created ${chunks.length} chunks from ${fileName}`,
      );

      const embeddings = await this.embeddingService.embedBatch(
        chunks.map((c) => c.text),
      );

      await this.contextStore.store(
        fileName,
        chunks.map((chunk, i) => ({
          text: chunk.text,
          embedding: embeddings[i],
        })),
      );

      return {success: true, chunksIndexed: chunks.length};
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[Indexing] Error indexing ${fileName}:`, error);
      return {success: false, chunksIndexed: 0, error};
    }
  }
}
