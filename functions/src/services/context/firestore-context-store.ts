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
      metadata: doc.metadata ?? {},
    }));
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
