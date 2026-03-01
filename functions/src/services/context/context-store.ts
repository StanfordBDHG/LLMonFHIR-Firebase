/** A document retrieved from the context store. */
export interface RetrievedDocument {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface ChunkEmbedding {
  text: string;
  embedding: number[] | null;
}

export interface ContextStore {
  retrieve(query: string, limit: number): Promise<RetrievedDocument[]>;
  store(filename: string, chunks: ChunkEmbedding[]): Promise<void>;
}
