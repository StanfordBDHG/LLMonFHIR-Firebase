//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

/**
 * Extracts text content from a file.
 *
 * Returns an array of text segments — for example, one per page
 * or a single merged segment depending on the implementation.
 */
export interface TextExtractor {
  extract(filePath: string): Promise<string[]>;
}
