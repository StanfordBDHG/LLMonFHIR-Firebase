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
import {randomUUID} from "node:crypto";
import {getStorage} from "firebase-admin/storage";
import {Secrets, SERVICE_ACCOUNT, STORAGE_BUCKET} from "../env";
import {createIndexingService} from "../services/create-services";

const FILE_PATH_PATTERN =
  /studies\/(?<studyId>[^/]+)\/rag_files\/(?<fileName>[^/]+\.pdf)/;

export const onPDFUploaded = onObjectFinalized(
  {
    bucket: STORAGE_BUCKET,
    region: "us-central1",
    secrets: [Secrets.OPENAI_API_KEY],
    serviceAccount: SERVICE_ACCOUNT,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (event) => {
    const match = event.data.name.match(FILE_PATH_PATTERN);
    const studyId = match?.groups?.studyId;
    const fileName = match?.groups?.fileName;

    if (!match || !studyId || !fileName) {
      console.log(`[Storage] Skipping unmatched path: ${event.data.name}`);
      return;
    }

    if (event.data.contentType !== "application/pdf") {
      console.log(
        `[Storage] Skipping non-PDF: ${event.data.name} (${event.data.contentType})`,
      );
      return;
    }

    console.log(`[Storage] Processing PDF ${fileName} for study ${studyId}`);

    let tempFilePath: string | undefined;
    try {
      const bucket = getStorage().bucket(event.data.bucket);
      tempFilePath = join(tmpdir(), `${randomUUID()}.pdf`);
      await bucket.file(event.data.name).download({destination: tempFilePath});

      const indexingService = createIndexingService({
        studyId,
        openAiApiKey: Secrets.OPENAI_API_KEY.value(),
      });

      const result = await indexingService.index(
        tempFilePath,
        event.data.name,
      );
      console.log(
        `[Storage] Indexing complete for ${event.data.name}:`,
        result,
      );
    } catch (error) {
      console.error(`[Storage] Error processing ${event.data.name}:`, error);
    } finally {
      if (tempFilePath) {
        await unlink(tempFilePath).catch(() => {
          return;
        });
      }
    }
  },
);
