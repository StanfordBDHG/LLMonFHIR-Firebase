//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import pkg from "@stanfordspezi/spezi-web-configurations";
const { getEslintReactConfig } = pkg;

export default [
  ...getEslintReactConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    ignores: ["dist", "*.config.js", "*.config.ts", ".prettierrc.js"],
  },
];
