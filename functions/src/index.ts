//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {chat} from "./functions/chat";
import {onPDFUploaded} from "./functions/on-pdf-uploaded";
import {onDocumentDeleted} from "./functions/on-document-deleted";
import {initializeApp} from "firebase-admin/app";

setGlobalOptions({maxInstances: 10});

initializeApp();

export {chat, onPDFUploaded, onDocumentDeleted};
