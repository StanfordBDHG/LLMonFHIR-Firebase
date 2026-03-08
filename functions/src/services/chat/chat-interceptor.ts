//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import {ChatBody} from "./chat-service";

/** Transforms a {@link ChatBody} before it reaches the underlying ChatService. */
export interface ChatInterceptor {
  intercept(body: ChatBody): Promise<ChatBody>;
}
