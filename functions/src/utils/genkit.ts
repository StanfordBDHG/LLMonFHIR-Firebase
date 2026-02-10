//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {genkit, RetrieverAction} from "genkit";
import {openAI} from "@genkit-ai/compat-oai/openai";
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {firestore} from "./firebase";
import {FieldValue} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";

export const openAIAPIKey = defineSecret("OPENAI_API_KEY");
export const embedder = openAI.embedder("text-embedding-3-small");
const VECTOR_STORE_NAME = "rag-chunks";

export const ai = () => genkit({
  plugins: [
    openAI({apiKey: openAIAPIKey.value()}),
  ],
});

function collectionForStudy(studyId: string) {
  return `studies/${studyId}/embeddings`;
}

export function ragRetriever(studyId: string): RetrieverAction {
  return defineFirestoreRetriever(ai(), {
    name: VECTOR_STORE_NAME,
    firestore: firestore,
    collection: collectionForStudy(studyId),
    contentField: "text",
    vectorField: "embedding",
    embedder,
    distanceMeasure: "COSINE",
  });
}

export interface ChunkEmbedding {
  text: string;
  embedding: number[] | null;
}

export async function ragIndex(options: { studyId: string, filename: string, chunks: ChunkEmbedding[] }) {
  const collection = collectionForStudy(options.studyId);

  const existingDocs = await firestore.collection(collection).where("file", "==", options.filename).get();
  console.log(`RAG Indexing: Deleting ${existingDocs.size} existing documents for file ${options.filename}`);
  await Promise.all(
    existingDocs.docs.map((doc) => doc.ref.delete())
  );

  console.log(`RAG Indexing: Indexing ${options.chunks.length} new chunks for file ${options.filename}`);
  await Promise.all(options.chunks.map(async (chunk, index) => {
    await firestore.collection(collection).add({
      "text": chunk.text,
      "embedding": FieldValue.vector(chunk.embedding ?? undefined),
      "file": options.filename,
      "chunkId": index,
    });
  }));
}
