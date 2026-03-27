//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {extname} from "node:path";
import {TextExtractor} from "./text-extractor";

/**
 * Selects a {@link TextExtractor} based on the file extension of the input
 * path, delegating extraction to the matching implementation.
 */
export class DispatchingTextExtractor implements TextExtractor {
  constructor(
    private readonly extractors: Record<string, TextExtractor>,
  ) {}

  async extract(filePath: string): Promise<string[]> {
    const ext = extname(filePath).toLowerCase();
    const extractor = this.extractors[ext];

    if (!extractor) {
      throw new Error(
        `No extractor registered for file extension "${ext}": ${filePath}`,
      );
    }

    return extractor.extract(filePath);
  }
}
