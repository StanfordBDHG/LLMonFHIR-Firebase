import {defineSecret} from "firebase-functions/params";

export const Secrets = {
  OPENAI_API_KEY: defineSecret("OPENAI_API_KEY"),
  DOCUMENT_AI_PROCESSOR_ID: defineSecret("DOCUMENT_AI_PROCESSOR_ID"),
  DOCUMENT_AI_LOCATION: defineSecret("DOCUMENT_AI_LOCATION"),
};

export const SERVICE_ACCOUNT = `cloud-function-sa@${process.env.GCLOUD_PROJECT}.iam.gserviceaccount.com`;

export const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT}.firebasestorage.app`;
