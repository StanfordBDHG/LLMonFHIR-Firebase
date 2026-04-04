//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {DocumentProcessorServiceClient} from "@google-cloud/documentai";
import {readFile} from "node:fs/promises";
import {TextExtractor} from "./text-extractor";

export interface DocumentAITextExtractorOptions {
  projectId: string;
  location: string;
  processorId: string;
  /** Optional JSON service account key for authenticating to a different GCP project. */
  serviceAccountKey?: string;
}

/**
 * Extracts text from documents using Google Document AI.
 *
 * Requires a Document AI processor (e.g. OCR or Layout Parser)
 * to be provisioned in the Google Cloud project.
 *
 * When {@link DocumentAITextExtractorOptions.serviceAccountKey} is provided,
 * the client authenticates with those credentials — useful when the
 * processor lives in a different GCP project than the one hosting
 * Cloud Functions.
 */
export class DocumentAITextExtractor implements TextExtractor {
  private readonly processorName: string;
  private readonly client: DocumentProcessorServiceClient;

  constructor(options: DocumentAITextExtractorOptions) {
    const credentials = options.serviceAccountKey ?
      JSON.parse(options.serviceAccountKey) :
      undefined;

    this.client = new DocumentProcessorServiceClient({
      apiEndpoint: `${options.location}-documentai.googleapis.com`,
      ...(credentials && {credentials}),
    });
    this.processorName = [
      "projects",
      options.projectId,
      "locations",
      options.location,
      "processors",
      options.processorId,
    ].join("/");
  }

  async extract(filePath: string): Promise<string[]> {
    const content = await readFile(filePath);

    const [result] = await this.client.processDocument({
      name: this.processorName,
      rawDocument: {
        content: content.toString("base64"),
        mimeType: "application/pdf",
      },
    });

    const text = result.document?.text;
    if (!text) {
      return [];
    }
    return [text];
  }
}
