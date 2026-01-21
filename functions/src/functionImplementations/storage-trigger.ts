//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {onObjectFinalized} from "firebase-functions/v2/storage";
import {unlink} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {serviceAccount, storage} from "../utils/firebase";
import {indexPDF} from "../rag/indexer";

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET || "som-rit-phi-lit-ai-dev.firebasestorage.app";

export const onPDFUploaded = onObjectFinalized(
  {
    bucket: STORAGE_BUCKET,
    region: "us-central1",
    serviceAccount: serviceAccount,
  },
  async (event) => {
    const filePathMatch = event.data.name.match(/studies\/(?<studyId>[^/]+)\/rag_files\/(?<fileName>[^/]+\.pdf)/);
    const studyId = filePathMatch?.groups?.studyId;
    const fileName = filePathMatch?.groups?.fileName;

    if (!filePathMatch || !studyId || !fileName) {
      console.log(`[STORAGE] No file path match for: ${event.data.name}`);
      return;
    }

    if (event.data.contentType !== "application/pdf") {
      console.log(
        `[STORAGE] Skipping non-PDF file: ${event.data.name} (${event.data.contentType})`,
      );
      return;
    }

    const filePath = event.data.name;
    console.log(`[STORAGE] Processing PDF ${fileName} for study ${studyId}`);

    let tempFilePath;
    try {
      const bucket = storage.bucket();
      const file = bucket.file(filePath);

      // Download file to temporary location
      tempFilePath = join(tmpdir(), `pdf-${Date.now()}.pdf`);
      console.log(`[STORAGE] Downloading to: ${tempFilePath}`);

      await file.download({destination: tempFilePath});

      // Extract and index the PDF
      const result = await indexPDF({
        filePath: tempFilePath,
        fileName: filePath,
        studyId,
      });

      console.log(`[STORAGE] Completed processing: ${filePath}`, result);
    } catch (error) {
      console.error(`[STORAGE] Error processing ${filePath}:`, error);
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        await unlink(tempFilePath);
      }
    }
  },
);
