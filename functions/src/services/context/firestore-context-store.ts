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
      metadataFields: ["file", "chunkId"],
    });
  }

  async retrieve(query: string, limit: number): Promise<RetrievedDocument[]> {
    const docs = await this.ai.retrieve({
      retriever: this.retriever,
      query,
      options: {limit},
    });

    return docs.map((doc) => ({
      text: doc.content
        .map((p) => p?.text ?? "")
        .filter(Boolean)
        .join("\n"),
      file: doc.metadata?.file ?? "Unknown",
      chunkId: doc.metadata?.chunkId ?? -1,
    }));
  }

  async store(filename: string, chunks: ChunkEmbedding[]): Promise<void> {
    const deleted = await this.deleteChunksByFilename(filename);
    console.log(
      `[ContextStore] Replacing ${deleted} existing chunks for ${filename}`,
    );

    console.log(
      `[ContextStore] Storing ${chunks.length} new chunks for ${filename}`,
    );
    const bulkWriter = this.firestore.bulkWriter();
    const collection = this.firestore.collection(this.collectionName);
    chunks.forEach((chunk, index) =>
      bulkWriter.create(collection.doc(), {
        text: chunk.text,
        embedding: FieldValue.vector(chunk.embedding ?? []),
        file: filename,
        chunkId: index,
      }),
    );
    await bulkWriter.close();
  }

  async delete(filename: string): Promise<void> {
    const deleted = await this.deleteChunksByFilename(filename);
    console.log(`[ContextStore] Deleted ${deleted} chunks for ${filename}`);
  }

  private async deleteChunksByFilename(filename: string): Promise<number> {
    const snapshot = await this.firestore
      .collection(this.collectionName)
      .where("file", "==", filename)
      .get();

    const bulkWriter = this.firestore.bulkWriter();
    snapshot.docs.forEach((doc) => bulkWriter.delete(doc.ref));
    await bulkWriter.close();
    return snapshot.size;
  }
}
