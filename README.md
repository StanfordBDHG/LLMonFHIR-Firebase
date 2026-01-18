# LLMonFHIR Firebase Backend

Firebase Functions backend for LLMonFHIR with a RAG-enabled OpenAI-compatible `/chat` endpoint and a lightweight web client for comparison testing.

## Quickstart

### Backend (emulators)

> **Note**  
> functions/.secret.local must contain a valid OPENAI_API_KEY

```bash
cd functions
npm install
cd ..
sh run-emulator.sh
```

This installs backend dependencies, builds functions, and starts Firebase emulators. Ensure the `OPENAI_API_KEY` secret is configured in your Firebase project before deploying.

### Web client (optional)

```bash
cd web
npm install
npm run dev
```

The web UI compares responses with RAG enabled and disabled using mock FHIR tool results.

## Architecture

```
Realtime chat path for LLMonFHIR / web client
  → OpenAI-compatible Firebase Function `/chat`
      (drop-in replacement for OpenAI `/v1/chat/completions`)
      (client keeps the same request body; only the URL changes)
      → Retrieve top-k chunks (Genkit retriever)
          → Vector store (dev-local)
      → Augment system prompt
  ← Streamed response (+ optional RAG metadata)

Document ingestion path for Firebase Storage `rag_files/*.pdf`
  → `onPDFUploaded` trigger
      → PDF text extraction
      → Chunk + embed
      → Index into vector store
```

## Core Components

### OpenAI-compatible chat proxy
- File: `functions/src/functionImplementations/openai-proxy.ts`
- Firebase Function name: `chat`
- Endpoint: `https://<region>-<project>.cloudfunctions.net/chat`
- Drop-in OpenAI `/v1/chat/completions` replacement: keep the same request body and only change the URL
- Supports streaming and non-streaming OpenAI chat requests
- Injects retrieved RAG context into the system prompt
- Toggle RAG off for debugging: `?ragEnabled=false`

### PDF indexing via storage trigger
- File: `functions/src/functionImplementations/storage-trigger.ts`
- Trigger: new PDF uploaded under `rag_files/` in Storage
- Extracts text, cleans and chunks it, and embeds content into the vector store

### RAG pipeline internals
- Chunking: `functions/src/rag/chunker.ts` 
- Indexing: `functions/src/rag/indexer.ts`
- Retrieval: `functions/src/rag/retriever.ts` (top 5 chunks)
- Genkit config: `functions/src/utils/genkit.ts`

## Backend Setup

### Install and build

```bash
cd functions
npm install
npm run build
```

### Emulators

```bash
sh run-emulator.sh
```

### Deploy

```bash
firebase deploy --only functions
```

### Configure secrets

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

## API Usage

### Request (OpenAI-compatible)

```bash
curl -X POST "https://<firebase-functions-url>/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      { "role": "user", "content": "Summarize the latest lab results." }
    ],
    "stream": true
  }'
```

### Streaming response (RAG metadata)

When RAG is enabled and context is found, the stream includes a metadata event before the usual OpenAI deltas:

```json
{
  "type": "rag_context",
  "context": "[Document: ...]",
  "contextLength": 1234,
  "enabled": true
}
```

### Non-streaming response (RAG metadata)

The non-streaming response includes `_ragContext`:

```json
{
  "id": "...",
  "choices": [ ... ],
  "_ragContext": {
    "context": "[Document: ...]",
    "contextLength": 1234,
    "enabled": true
  }
}
```

## Web Client

The `/web` directory contains a minimal React app that compares responses with RAG enabled and disabled. It routes OpenAI SDK calls to the Firebase Functions `/chat` endpoint and uses mock FHIR tool outputs to simulate data retrieval.

## Limitations and Next Steps

- The RAG vector store uses `@genkit-ai/dev-local-vectorstore` for development only.
- For production, replace it with a persistent vector store such as Firestore Vector Search: https://genkit.dev/docs/integrations/cloud-firestore/
