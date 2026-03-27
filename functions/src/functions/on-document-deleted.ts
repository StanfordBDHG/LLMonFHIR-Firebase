//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {onObjectDeleted} from "firebase-functions/v2/storage";
import {SERVICE_ACCOUNT, STORAGE_BUCKET, STORAGE_FILE_PATH_PATTERN, STORAGE_REGION} from "../env";
import {createContextStore} from "../services/create-services";

export const onDocumentDeleted = onObjectDeleted(
  {
    bucket: STORAGE_BUCKET,
    region: STORAGE_REGION,
    serviceAccount: SERVICE_ACCOUNT,
  },
  async (event) => {
    const match = event.data.name.match(STORAGE_FILE_PATH_PATTERN);
    const studyId = match?.groups?.studyId;

    if (!match || !studyId) {
      console.log(`[Storage] Skipping unmatched path: ${event.data.name}`);
      return;
    }

    console.log(
      `[Storage] Removing embeddings for deleted file ${event.data.name}`,
    );

    try {
      const contextStore = createContextStore(studyId);
      await contextStore.delete(event.data.name);
      console.log(
        `[Storage] Embeddings removed for ${event.data.name}`,
      );
    } catch (error) {
      console.error(
        `[Storage] Error removing embeddings for ${event.data.name}:`,
        error,
      );
      throw error;
    }
  },
);
