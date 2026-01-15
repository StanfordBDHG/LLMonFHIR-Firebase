import { onObjectFinalized } from "firebase-functions/v2/storage";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { storage } from "../utils/firebase";
import { indexPDF } from "../rag/indexer";

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET || "som-rit-phi-lit-ai-dev.firebasestorage.app";

export const onPDFUploaded = onObjectFinalized(
  {
    bucket: STORAGE_BUCKET,
    region: "us-central1",
  },
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    const isPDFFile =
      filePath.endsWith(".pdf") && contentType === "application/pdf";
    const isRelevantFilePath = filePath.startsWith("rag_files/");

    if (!filePath || !(isRelevantFilePath && isPDFFile)) {
      console.log(
        `[STORAGE] Skipping file outside rag_files or non-PDF: ${filePath ?? "Unknown"}`,
      );
      return;
    }

    console.log(`[STORAGE] Processing PDF: ${filePath}`);

    let tempFilePath;
    try {
      const bucket = storage.bucket();
      const file = bucket.file(filePath);

      // Download file to temporary location
      tempFilePath = join(tmpdir(), `pdf-${Date.now()}.pdf`);
      console.log(`[STORAGE] Downloading to: ${tempFilePath}`);

      await file.download({ destination: tempFilePath });

      // Extract and index the PDF
      const result = await indexPDF({
        filePath: tempFilePath,
        fileName: filePath,
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
