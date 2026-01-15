# RAG Integration with OpenAI Proxy

This Firebase Functions implementation combines the OpenAI proxy with Genkit RAG capabilities to provide context-aware chat responses.

## Architecture

```
Client App → Firebase Functions (/chat) → OpenAI API
                              ↑
                              │
                        RAG Retrieval
                              │
                    Vector Store (dev-local)
                              │
                PDF Indexer (via Storage Trigger)
```

## Features

### 1. Enhanced OpenAI Proxy (`/chat`)
- **Interface**: Maintains the same OpenAI-compatible API from the original proxy
- **RAG Integration**: Automatically retrieves relevant context before forwarding to OpenAI
- **Automatic Augmentation**: Injects RAG context into the system prompt
- **Transparent**: No changes needed to client code

### 2. PDF Indexing (`/storage-trigger`)
- **Trigger**: Automatically processes PDF files uploaded to Firebase Storage
- **Extraction**: Uses `unpdf` to extract text content
- **Chunking**: Splits text into overlapping chunks (2000 chars, 100 overlap)
- **Embedding**: Creates embeddings using OpenAI `text-embedding-3-large`
- **Storage**: Stores in dev-local vector store for development

### 3. RAG Components
- **Retriever**: Finds top 5 most relevant chunks for a query
- **Chunker**: Intelligently splits text at sentence/word boundaries
- **Utils**: Text cleaning and message processing helpers

## Usage

### Deploy the Functions
```bash
firebase deploy --only functions
```

### Set Up API Key
```bash
firebase functions:secrets:set OPENAI_API_KEY
```

### Index Documents
Upload PDF files to Firebase Storage:
```bash
gsutil cp your-document.pdf gs://your-project.appspot.com/
```

### Chat with RAG
Use your existing chat client - RAG augmentation is automatic:
```javascript
// No changes needed - same OpenAI API format
const response = await fetch('/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'What information do you have about medical procedures?' }
    ],
    stream: true
  })
});
```

## RAG Configuration

Current settings (configurable in code):
- **Retrieval**: Top 5 chunks (RAG_K = 5)
- **Chunk Size**: 2000 characters
- **Chunk Overlap**: 100 characters
- **Embedding Model**: `text-embedding-3-large` (3072 dimensions)
- **Vector Store**: Dev-local (file-based for development)

## File Structure

```
functions/src/
├── index.ts              # Entry point - exports chat and storage trigger
├── openai-proxy.ts       # Enhanced OpenAI proxy with RAG integration
├── storage-trigger.ts    # PDF indexing via Cloud Storage events
├── ai.ts                 # Genkit configuration and vector store setup
├── rag/
│   ├── indexer.ts        # PDF text extraction and indexing
│   ├── retriever.ts      # RAG context retrieval
│   ├── chunker.ts        # Text splitting with overlap
│   └── utils.ts          # Text cleaning and helpers
└── test-rag.ts           # Component testing utilities
```

## Dependencies

### Core RAG Stack
- `genkit` - AI framework
- `@genkit-ai/compat-oai` - OpenAI integration
- `@genkit-ai/dev-local-vectorstore` - Local vector store
- `unpdf` - PDF text extraction

### Development Tools
- `genkit-cli` - Genkit development UI
- `tsx` - TypeScript execution

## Development

### Local Development
```bash
# Start Genkit Dev UI
npm run genkit:start

# Start Firebase Emulators
npm run serve
```

### Testing Components
```bash
npx tsx src/test-rag.ts
```

## Production Considerations

For production deployment, consider:
1. **Vector Store**: Replace dev-local with Firestore Vector Search or Pinecone
2. **Bucket**: Update the bucket name in `storage-trigger.ts`
3. **Security**: Ensure proper IAM roles for storage and function execution
4. **Cost**: Monitor embedding API usage and storage costs
5. **Scaling**: Set appropriate function memory/timeout limits

## Monitoring

Check function logs:
```bash
firebase functions:log
```

Key log prefixes:
- `[RAG]` - RAG retrieval and indexing operations
- `[PDF]` - PDF processing operations  
- `[STORAGE]` - Storage trigger operations

## Troubleshooting

### Common Issues
1. **Missing OPENAI_API_KEY**: Set Firebase secret
2. **Vector Store Errors**: Check dev-local directory permissions
3. **PDF Processing**: Verify PDF format and content-type
4. **CORS**: Ensure client URL is whitelisted if needed

### Debug Mode
Add console.log statements in:
- `retrieveRagContext()` - See retrieval results
- `openai-proxy.ts` - View RAG augmentation in action
- `storage-trigger.ts` - Monitor PDF indexing process