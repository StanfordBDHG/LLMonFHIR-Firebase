import {DocumentProcessorServiceClient} from "@google-cloud/documentai";
import {readFile} from "node:fs/promises";
import {TextExtractor} from "./text-extractor";

export interface DocumentAITextExtractorOptions {
  projectId: string;
  location: string;
  processorId: string;
}

/**
 * Extracts text from documents using Google Document AI.
 *
 * Requires a Document AI processor (e.g. OCR or Layout Parser)
 * to be provisioned in the Google Cloud project.
 */
export class DocumentAITextExtractor implements TextExtractor {
  private readonly processorName: string;
  private readonly client: DocumentProcessorServiceClient;

  constructor(options: DocumentAITextExtractorOptions) {
    this.client = new DocumentProcessorServiceClient({
      apiEndpoint: `${options.location}-documentai.googleapis.com`,
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
