//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

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
