//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
