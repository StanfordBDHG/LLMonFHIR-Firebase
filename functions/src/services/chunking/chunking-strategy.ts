import {Chunk} from "./chunk";

/**
 * A file-level chunking strategy that processes a file and produces chunks.
 *
 * Implementations may handle file reading and chunking in a single step,
 * or compose a {@link TextExtractor} with a {@link TextChunker}.
 */
export interface FileChunkingStrategy {
  chunkFile(filePath: string): Promise<Chunk[]>;
}
