import {Genkit} from "genkit";
import openAI from "@genkit-ai/compat-oai/openai";
import {EmbeddingService} from "./embedding-service";

/** Embedding service backed by Genkit + OpenAI text-embedding-3-small. */
export class GenkitEmbeddingService implements EmbeddingService {
  private readonly embedder = openAI.embedder("text-embedding-3-small");

  constructor(private readonly ai: Genkit) {}

  async embed(text: string): Promise<number[]> {
    const result = await this.ai.embed({
      embedder: this.embedder,
      content: text,
    });
    return result.at(0)?.embedding ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const concurrency = 5;
    for (let i = 0; i < texts.length; i += concurrency) {
      const slice = texts.slice(i, i + concurrency);
      results.push(...await Promise.all(slice.map((t) => this.embed(t))));
    }
    return results;
  }
}
