//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

// Initialize Firebase
initializeApp();

// Export storage instance for use across the app
export const auth = getAuth();
export const storage = getStorage();
export const firestore = getFirestore();

export const serviceAccount = `cloud-function-sa@${process.env.GCLOUD_PROJECT}.iam.gserviceaccount.com`;
