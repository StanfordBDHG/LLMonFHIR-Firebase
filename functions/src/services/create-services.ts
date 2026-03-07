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
import {OpenAIChatService} from "./chat/openai-chat-service";
import {InterceptedChatService} from "./chat/intercepted-chat-service";
import {RAGChatInterceptor} from "./chat/rag-chat-interceptor";
import {ComposedChunkingStrategy} from "./chunking/composed-chunking-strategy";
import {DocumentAITextExtractor} from "./chunking/text-extraction/document-ai-text-extractor";
import {StructureAwareTextChunker} from "./chunking/text-chunking/structure-aware-text-chunker";
import {FirestoreContextStore} from "./context/firestore-context-store";
import {GenkitEmbeddingService} from "./embedding/genkit-embedding-service";
import {IndexingService} from "./indexing/indexing-service";
import {DefaultIndexingService} from "./indexing/default-indexing-service";

export interface ServiceOptions {
  studyId: string;
  openAiApiKey: string;
}

export interface IndexingServiceOptions extends ServiceOptions {
  documentAI: {
    projectId: string;
    location: string;
    processorId: string;
  };
}

function createAI(openAiApiKey: string) {
  return genkit({plugins: [openAI({apiKey: openAiApiKey})]});
}

export function createChatService(options: ServiceOptions): ChatService {
  const ai = createAI(options.openAiApiKey);
  const contextStore = new FirestoreContextStore(options.studyId, ai);
  return new InterceptedChatService(
    new OpenAIChatService(options.openAiApiKey),
    [new RAGChatInterceptor(contextStore)],
  );
}

export function createIndexingService(options: IndexingServiceOptions): IndexingService {
  const ai = createAI(options.openAiApiKey);
  const contextStore = new FirestoreContextStore(options.studyId, ai);
  const embeddingService = new GenkitEmbeddingService(ai);
  const chunkingStrategy = new ComposedChunkingStrategy(
    new DocumentAITextExtractor(options.documentAI),
    new StructureAwareTextChunker(),
  );
  return new DefaultIndexingService(
    chunkingStrategy,
    embeddingService,
    contextStore,
  );
}
