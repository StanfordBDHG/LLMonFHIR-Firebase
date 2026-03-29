//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {Chunk} from "./chunk";
import {FileChunkingStrategy} from "./chunking-strategy";
import {TextChunker} from "./text-chunking/text-chunker";
import {TextExtractor} from "./text-extraction/text-extractor";

/**
 * Composes a {@link TextExtractor} with a {@link TextChunker} to form a
 * {@link FileChunkingStrategy}.
 *
 * The extractor converts a file into text segments, and the chunker splits
 * each segment into smaller chunks.
 */
export class ComposedChunkingStrategy implements FileChunkingStrategy {
  constructor(
    private readonly extractor: TextExtractor,
    private readonly chunker: TextChunker,
  ) {}

  async chunkFile(filePath: string): Promise<Chunk[]> {
    const segments = await this.extractor.extract(filePath);
    return segments.flatMap((segment) =>
      this.chunker.chunk(segment).map((text) => ({text})),
    );
  }
}
