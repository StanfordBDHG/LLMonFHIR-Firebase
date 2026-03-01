export interface IndexResult {
  success: boolean;
  chunksIndexed: number;
  error?: string;
}

export interface IndexingService {
  index(filePath: string, fileName: string): Promise<IndexResult>;
}
