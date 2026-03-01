import {extractText, getDocumentProxy} from "unpdf";
import {readFile} from "node:fs/promises";
import {TextExtractor} from "./text-extractor";

/** Extracts text from PDF files using unpdf. */
export class PdfTextExtractor implements TextExtractor {
  async extract(filePath: string): Promise<string[]> {
    const buffer = await readFile(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const {text} = await extractText(pdf, {mergePages: true});
    return [this.clean(text)];
  }

  private clean(raw: string): string {
    return raw
      .normalize("NFKC")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/([a-zA-Z])-\s*\n\s*([a-zA-Z])/g, "$1$2")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
