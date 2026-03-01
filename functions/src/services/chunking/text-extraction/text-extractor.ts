/**
 * Extracts text content from a file.
 *
 * Returns an array of text segments — for example, one per page
 * or a single merged segment depending on the implementation.
 */
export interface TextExtractor {
  extract(filePath: string): Promise<string[]>;
}
