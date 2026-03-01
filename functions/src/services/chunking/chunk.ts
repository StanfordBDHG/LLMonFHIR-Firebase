/** A text chunk extracted from a document. */
export interface Chunk {
  text: string;
  metadata?: Record<string, unknown>;
}
