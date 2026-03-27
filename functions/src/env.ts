//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {defineSecret} from "firebase-functions/params";

export const Secrets = {
  OPENAI_API_KEY: defineSecret("OPENAI_API_KEY"),
};

export const SERVICE_ACCOUNT = `cloud-function-sa@${process.env.GCLOUD_PROJECT}.iam.gserviceaccount.com`;

export const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT}.firebasestorage.app`;

export const STORAGE_REGION = process.env.STORAGE_REGION || "us-central1";

export const STORAGE_FILE_PATH_PATTERN =
  /studies\/(?<studyId>[^/]+)\/rag_files\/(?<fileName>[^/]+)$/;
