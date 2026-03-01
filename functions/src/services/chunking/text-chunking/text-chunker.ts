/** Splits a text string into smaller chunks. */
export interface TextChunker {
  chunk(text: string): string[];
}
