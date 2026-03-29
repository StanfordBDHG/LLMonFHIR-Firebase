//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {genkit} from "genkit";
import openAI from "@genkit-ai/compat-oai/openai";
import OpenAI from "openai";
import {ChatService, ModelOverrides} from "./chat/chat-service";
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

export type LLMService = "openAI" | "gemini";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GEMINI_MODEL_OVERRIDES: ModelOverrides = {
  "gpt-4o": "gemini-2.5-flash-preview-05-20",
  "gpt-4o-mini": "gemini-2.0-flash",
  default: "gemini-2.0-flash",
};

export interface ServiceOptions {
  studyId: string;
  openAIApiKey: string;
  geminiApiKey?: string;
  service?: LLMService;
}

function createAI(openAIApiKey: string) {
  return genkit({plugins: [openAI({apiKey: openAIApiKey})]});
}

function createLLMClient(options: ServiceOptions): { client: OpenAI; modelOverrides?: ModelOverrides } {
  if (options.service === "gemini") {
    if (!options.geminiApiKey) {
      throw new Error("Gemini API key is required when service is 'gemini'");
    }
    return {
      client: new OpenAI({apiKey: options.geminiApiKey, baseURL: GEMINI_BASE_URL}),
      modelOverrides: GEMINI_MODEL_OVERRIDES,
    };
  }
  return {client: new OpenAI({apiKey: options.openAIApiKey})};
}

export function createContextStore(studyId: string): ContextStore {
  return new FirestoreContextStore(studyId, genkit({plugins: []}));
}

export function createChatService(options: ServiceOptions): ChatService {
  const ai = createAI(options.openAIApiKey);
  const contextStore = new FirestoreContextStore(options.studyId, ai);
  const {client, modelOverrides} = createLLMClient(options);
  return new ChatService(
    client,
    [new RAGChatInterceptor(contextStore)],
    modelOverrides,
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
