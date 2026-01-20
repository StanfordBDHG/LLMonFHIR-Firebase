//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

type ChunkOptions = {
  maxLength?: number;
  overlap?: number;
};

type Chunk = { text: string };

export const createChunksFromText = (
  text: string,
  options: ChunkOptions = {},
): Chunk[] => {
  const maxLength = options.maxLength ?? 2200;
  const overlap = options.overlap ?? 200;

  const stepSize = maxLength - overlap;
  if (stepSize <= 0) {
    throw new Error("maxLength must be greater than overlap");
  }

  const numberOfSteps = Math.ceil(text.length / stepSize);

  // creating an array of [0, stepSize, 2*stepSize, ...]
  return Array.from({length: numberOfSteps}, (_, i) => i * stepSize)
    .map((startIndex) => {
      const endIndex = Math.min(startIndex + maxLength, text.length);
      return text.substring(startIndex, endIndex);
    })
    .map((chunk) => chunk.trim())
    .filter(Boolean) // remove empty strings
    .map((chunk) => ({text: chunk}));
};
