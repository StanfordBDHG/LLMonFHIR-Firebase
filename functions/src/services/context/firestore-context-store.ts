//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {Genkit} from "genkit";
import {ChunkEmbedding, ContextStore, RetrievedDocument} from "./context-store";
import openAI from "@genkit-ai/compat-oai/openai";
import {FieldValue, Firestore, getFirestore} from "firebase-admin/firestore";
import {defineFirestoreRetriever} from "@genkit-ai/firebase";

export class FirestoreContextStore implements ContextStore {
  private readonly collectionName: string;
  private readonly retriever;

  constructor(
    studyId: string,
    private readonly ai: Genkit,
    embedder = openAI.embedder("text-embedding-3-small"),
    private readonly firestore: Firestore = getFirestore(),
  ) {
    this.collectionName = `studies/${studyId}/embeddings`;
    this.retriever = defineFirestoreRetriever(ai, {
      name: `rag-chunks-${studyId}`,
      firestore,
      collection: this.collectionName,
      contentField: "text",
      vectorField: "embedding",
      embedder,
      distanceMeasure: "COSINE",
      distanceResultField: "distance",
      metadataFields: ["file", "chunkId", "distance"],
    });
  }

  async retrieve(query: string, limit: number): Promise<RetrievedDocument[]> {
    const docs = await this.ai.retrieve({
      retriever: this.retriever,
      query,
      options: {limit},
    });

    return docs.map((doc) => {
      const distance = doc.metadata?.distance as number | undefined;
      const similarity = distance !== undefined ? 1 - distance : undefined;
      console.log(
        `[ContextStore] chunk ${doc.metadata?.file}#${doc.metadata?.chunkId}` +
          (similarity !== undefined ? ` similarity=${similarity.toFixed(3)}` : ""),
      );
      return {
        text: doc.content
          .map((p) => p?.text ?? "")
          .filter(Boolean)
          .join("\n"),
        file: doc.metadata?.file ?? "Unknown",
        chunkId: doc.metadata?.chunkId ?? -1,
      };
    });
  }

  async store(filename: string, chunks: ChunkEmbedding[]): Promise<void> {
    const existingDocs = await this.firestore
      .collection(this.collectionName)
      .where("file", "==", filename)
      .get();

    console.log(
      `[ContextStore] Replacing ${existingDocs.size} existing chunks for ${filename}`,
    );
    await Promise.all(existingDocs.docs.map((doc) => doc.ref.delete()));

    console.log(
      `[ContextStore] Storing ${chunks.length} new chunks for ${filename}`,
    );
    await Promise.all(
      chunks.map((chunk, index) =>
        this.firestore.collection(this.collectionName).add({
          text: chunk.text,
          embedding: FieldValue.vector(chunk.embedding ?? []),
          file: filename,
          chunkId: index,
        }),
      ),
    );
  }
}
