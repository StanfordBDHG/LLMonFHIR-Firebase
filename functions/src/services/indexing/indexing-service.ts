//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

export interface IndexResult {
  success: boolean;
  chunksIndexed: number;
  error?: string;
}

export interface IndexingService {
  index(filePath: string, fileName: string): Promise<IndexResult>;
}
