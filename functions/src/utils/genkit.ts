import { genkit } from "genkit";
import { openAI } from "@genkit-ai/compat-oai/openai";
import {
  devLocalVectorstore,
  devLocalIndexerRef,
  devLocalRetrieverRef,
} from "@genkit-ai/dev-local-vectorstore";

const embedder = openAI.embedder("text-embedding-3-large");
const VECTOR_STORE_NAME = "rag-chunks";

export const ai = genkit({
  plugins: [
    openAI(),
    // TODO change to Firestore, https://genkit.dev/docs/integrations/cloud-firestore/
    devLocalVectorstore([
      {
        indexName: VECTOR_STORE_NAME,
        embedder,
      },
    ]),
  ],
});

export const ragRetriever = devLocalRetrieverRef(VECTOR_STORE_NAME);
export const ragIndexer = devLocalIndexerRef(VECTOR_STORE_NAME);
