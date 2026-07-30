//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {createFirebaseSpanExporter} from "@agentpond/firebase";
import {OpenAIInstrumentation} from "@arizeai/openinference-instrumentation-openai";
import {initializeApp} from "firebase-admin/app";
import {NodeSDK} from "@opentelemetry/sdk-node";

initializeApp();

try {
  const openAIInstrumentation = new OpenAIInstrumentation({
    traceConfig: {
      hideInputs: true,
      hideOutputs: true,
    },
  });

  const telemetry = new NodeSDK({
    traceExporter: createFirebaseSpanExporter(),
    instrumentations: [openAIInstrumentation],
  });

  telemetry.start();
} catch (error) {
  console.error("Failed to initialize OpenTelemetry tracing:", error);
}

const functions = await import("./index.js");

export const chat = functions.chat;
export const onPDFUploaded = functions.onPDFUploaded;
export const onDocumentDeleted = functions.onDocumentDeleted;
