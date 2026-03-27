//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {readFile} from "node:fs/promises";
import {TextExtractor} from "./text-extractor";

/** Extracts text from plain-text files (e.g. .txt, .md, .rtf). */
export class PlainTextExtractor implements TextExtractor {
  async extract(filePath: string): Promise<string[]> {
    const content = await readFile(filePath, "utf-8");
    return [this.clean(content)];
  }

  private clean(raw: string): string {
    return raw
      .normalize("NFKC")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
