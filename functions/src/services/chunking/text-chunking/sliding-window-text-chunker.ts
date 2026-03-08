//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {TextChunker} from "./text-chunker";

/** Splits text into overlapping fixed-size windows. */
export class SlidingWindowTextChunker implements TextChunker {
  constructor(
    private readonly maxLength: number = 2200,
    private readonly overlap: number = 200,
  ) {
    if (maxLength <= overlap) {
      throw new Error("maxLength must be greater than overlap");
    }
  }

  chunk(text: string): string[] {
    const step = this.maxLength - this.overlap;
    const count = Math.ceil(text.length / step);
    return Array.from({length: count}, (_, i) => i * step)
      .map((start) =>
        text
          .substring(start, Math.min(start + this.maxLength, text.length))
          .trim(),
      )
      .filter(Boolean);
  }
}
