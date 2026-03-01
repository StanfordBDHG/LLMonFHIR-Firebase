import {Chunk} from "./chunk";
import {FileChunkingStrategy} from "./chunking-strategy";
import {TextChunker} from "./extraction/text-chunker";

/**
 * Chains a {@link FileChunkingStrategy} with a {@link TextChunker} for
 * multi-stage chunking.
 *
 * The first stage produces coarse chunks (e.g., from file-level extraction
 * that already segments by page or section), and the second stage refines
 * each chunk further (e.g., sliding-window splitting).
 */
export class MultiStageChunkingStrategy implements FileChunkingStrategy {
  constructor(
    private readonly first: FileChunkingStrategy,
    private readonly second: TextChunker,
  ) {}

  async chunkFile(filePath: string): Promise<Chunk[]> {
    const coarseChunks = await this.first.chunkFile(filePath);
    return coarseChunks.flatMap((chunk) =>
      this.second.chunk(chunk.text).map((text) => ({text})),
    );
  }
}
