#!/bin/bash

echo "🚀 Testing RAG-enhanced OpenAI Proxy Deployment"
echo "=============================================="

# Check if we're on the correct branch
echo "📋 Current branch:"
git branch --show-current

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
if [ -f ".env" ]; then
    echo "✅ .env file found"
else
    echo "⚠️  No .env file found - you'll need to configure OPENAI_API_KEY in Firebase secrets"
fi

# Show file structure
echo ""
echo "📁 RAG file structure:"
find src -name "*.ts" | grep -E "(ai\.ts|rag|storage)" | sort

echo ""
echo "🎯 Next steps:"
echo "1. Deploy: firebase deploy --only functions"
echo "2. Set OPENAI_API_KEY secret: firebase functions:secrets:set OPENAI_API_KEY"
echo "3. Upload a PDF to Firebase Storage to test indexing"
echo "4. Test the chat endpoint - it should now augment responses with RAG context"