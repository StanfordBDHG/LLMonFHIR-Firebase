//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {Document} from "genkit";
import {ai, ragRetriever} from "../utils/genkit";

export const RAG_RETRIEVAL_K = 5;

const formatDoc = (doc: Document): string => {
  const metadata = doc.metadata;

  const source = metadata?.sourceFile ?? "Unknown";
  const chunk = metadata?.chunkIndex ?? "?";
  const docContent = doc.content
    .map((part) => part?.text ?? "")
    .filter(Boolean)
    .join("\n");

  return `[Document: ${source} | Chunk ${chunk}]\n${docContent}`;
};

export async function retrieveRAGContext(options: { query: string, studyId: string }): Promise<string> {
  try {
    const docs = await ai.retrieve({
      retriever: ragRetriever(options.studyId),
      query: options.query,
      options: {
        limit: RAG_RETRIEVAL_K,
      },
    });

    if (docs.length === 0) {
      return "";
    }

    const ragContext = docs.map(formatDoc).join("\n\n---\n\n");

    console.log(
      `RAG: Retrieved ${docs.length} chunks, context length: ${ragContext.length}`,
    );

    return ragContext;
  } catch (error) {
    console.error("RAG retrieval error:", error);
    return "";
  }
}
