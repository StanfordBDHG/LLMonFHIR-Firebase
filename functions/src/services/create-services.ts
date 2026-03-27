//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {genkit} from "genkit";
import openAI from "@genkit-ai/compat-oai/openai";
import {ChatService} from "./chat/chat-service";
import {RAGChatInterceptor} from "./chat/rag-chat-interceptor";
import {ComposedChunkingStrategy} from "./chunking/composed-chunking-strategy";
import {DispatchingTextExtractor} from "./chunking/text-extraction/dispatching-text-extractor";
import {PDFTextExtractor} from "./chunking/text-extraction/pdf-text-extractor";
import {PlainTextExtractor} from "./chunking/text-extraction/plain-text-extractor";
import {ContextStore} from "./context/context-store";
import {FirestoreContextStore} from "./context/firestore-context-store";
import {GenkitEmbeddingService} from "./embedding/genkit-embedding-service";
import {IndexingService} from "./indexing/indexing-service";
import {DefaultIndexingService} from "./indexing/default-indexing-service";
import {SlidingWindowTextChunker} from "./chunking/text-chunking/sliding-window-text-chunker";

export interface ServiceOptions {
  studyId: string;
  openAIApiKey: string;
  ragEnabled?: boolean;
}

function createAI(openAIApiKey: string) {
  return genkit({plugins: [openAI({apiKey: openAIApiKey})]});
}

export function createContextStore(studyId: string): ContextStore {
  return new FirestoreContextStore(studyId, genkit({plugins: []}));
}

export function createChatService(options: ServiceOptions): ChatService {
  if (!options.ragEnabled) {
    return new ChatService(options.openAIApiKey, []);
  }
  const ai = createAI(options.openAIApiKey);
  const contextStore = new FirestoreContextStore(options.studyId, ai);
  return new ChatService(
    options.openAIApiKey,
    [new RAGChatInterceptor(contextStore)],
  );
}

export function createIndexingService(options: ServiceOptions): IndexingService {
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
}
