//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {extractText, getDocumentProxy} from "unpdf";
import {readFile} from "node:fs/promises";
import {z} from "genkit";
import {ai, embedder, ragIndex} from "../utils/genkit";
import {createChunksFromText} from "./chunker";

const RAG_CHUNKING_CONFIG = {
  maxLength: 2200,
  overlap: 200,
};

export function cleanPDFText(rawText: string): string {
  return rawText
    .normalize("NFKC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/([a-zA-Z])-\s*\n\s*([a-zA-Z])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const indexPDF = ai().defineFlow(
  {
    name: "indexPDF",
    inputSchema: z.object({
      filePath: z.string().describe("PDF file path"),
      fileName: z.string().describe("PDF filename for metadata"),
      studyId: z.string().describe("Study ID for organizing embeddings"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      documentsIndexed: z.number(),
      error: z.string().optional(),
    }),
  },
  async ({filePath, fileName, studyId}) => {
    try {
      const buffer = await readFile(filePath);
      const pdf = await getDocumentProxy(new Uint8Array(buffer));

      const {totalPages, text} = await extractText(pdf, {mergePages: true});
      console.log(`Extracted ${totalPages} pages from PDF`);

      const cleanedText = cleanPDFText(text);
      console.log(`Cleaned text, length: ${cleanedText.length}`);

      const chunks = createChunksFromText(cleanedText, RAG_CHUNKING_CONFIG);
      console.log(`Created ${chunks.length} chunks`);

      const embeddedChunks = await Promise.all(chunks.map((chunk) => ai().embed({
        embedder: embedder,
        content: chunk.text,
      })));

      await ragIndex({
        studyId: studyId,
        filename: fileName,
        chunks: embeddedChunks.map((chunkEmbedding, index) => ({
          text: chunks[index].text,
          embedding: chunkEmbedding.at(0)?.embedding || [],
        })),
      });

      return {
        success: true,
        documentsIndexed: chunks.length,
      };
    } catch (err) {
      return {
        success: false,
        documentsIndexed: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);
