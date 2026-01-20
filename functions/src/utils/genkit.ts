//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {genkit} from "genkit";
import {openAI} from "@genkit-ai/compat-oai/openai";
import {defineFirestoreRetriever} from "@genkit-ai/firebase";
import {firestore} from "./firebase";

const embedder = openAI.embedder("text-embedding-3-large");
const VECTOR_STORE_NAME = "rag-chunks";

export const ai = genkit({
  plugins: [
    openAI(),
  ],
});

export const ragRetriever = defineFirestoreRetriever(ai, {
  name: VECTOR_STORE_NAME,
  firestore: firestore,
  collection: "documents",
  contentField: "text",
  vectorField: "embedding",
  embedder,
  distanceMeasure: "COSINE",
});
