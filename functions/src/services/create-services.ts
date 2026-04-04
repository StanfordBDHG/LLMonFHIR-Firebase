//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import openAI from "@genkit-ai/compat-oai/openai";
import { genkit } from "genkit";
import { AgenticContextChatInterceptor } from "./chat/agentic-context-chat-interceptor.js";
import { ChatService } from "./chat/chat-service.js";
import { ComposedChunkingStrategy } from "./chunking/composed-chunking-strategy.js";
import { SlidingWindowTextChunker } from "./chunking/text-chunking/sliding-window-text-chunker.js";
import { DispatchingTextExtractor } from "./chunking/text-extraction/dispatching-text-extractor.js";
import { PDFTextExtractor } from "./chunking/text-extraction/pdf-text-extractor.js";
import { PlainTextExtractor } from "./chunking/text-extraction/plain-text-extractor.js";
import { type ContextStore } from "./context/context-store.js";
import { FirestoreContextStore } from "./context/firestore-context-store.js";
import { GenkitEmbeddingService } from "./embedding/genkit-embedding-service.js";
import { DefaultIndexingService } from "./indexing/default-indexing-service.js";
import { type IndexingService } from "./indexing/indexing-service.js";

export interface ServiceOptions {
  studyId: string;
  openAIApiKey: string;
  ragEnabled?: boolean;
}

const createAI = (openAIApiKey: string) =>
  genkit({ plugins: [openAI({ apiKey: openAIApiKey })] });

export const createContextStore = (studyId: string): ContextStore =>
  new FirestoreContextStore(studyId, genkit({ plugins: [] }));

export const createChatService = (options: ServiceOptions): ChatService => {
  if (!options.ragEnabled) {
    return new ChatService(options.openAIApiKey, []);
  }
  const ai = createAI(options.openAIApiKey);
  const contextStore = new FirestoreContextStore(options.studyId, ai);
  return new ChatService(options.openAIApiKey, [
    new AgenticContextChatInterceptor(options.openAIApiKey, contextStore),
  ]);
};

export const createIndexingService = (
  options: ServiceOptions,
): IndexingService => {
  const ai = createAI(options.openAIApiKey);
  const contextStore = new FirestoreContextStore(options.studyId, ai);
  const embeddingService = new GenkitEmbeddingService(ai);
  const plainTextExtractor = new PlainTextExtractor();
  const chunkingStrategy = new ComposedChunkingStrategy(
    new DispatchingTextExtractor({
      ".pdf": new PDFTextExtractor(),
      ".txt": plainTextExtractor,
      ".md": plainTextExtractor,
    }),
    new SlidingWindowTextChunker(),
  );
  return new DefaultIndexingService(
    chunkingStrategy,
    embeddingService,
    contextStore,
  );
};
