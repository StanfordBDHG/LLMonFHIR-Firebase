#!/bin/bash
#
# This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
#
# SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
#
# SPDX-License-Identifier: MIT
#

echo "🚀 Emulating RAG-enhanced OpenAI Proxy Deployment"
echo "=============================================="

# Check if we can build
echo ""
echo "🔨 Building functions..."
cd functions
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

# Check for required environment variables
echo ""
echo "🔍 Checking environment setup..."
if [ -f ".secret.local" ]; then
    echo "✅ .secret.local file found"
else
    echo "⚠️  No .secret.local file found - you'll need to configure OPENAI_API_KEY in Firebase secrets"
fi

cd ..
firebase emulators:start