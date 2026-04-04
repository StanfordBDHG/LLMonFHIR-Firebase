//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import { type SyntheticEvent, useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { useChat } from "./hooks/useChat";

export const App = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Two separate chat instances for comparison
  const ragChat = useChat({ ragEnabled: true });
  const noRagChat = useChat({ ragEnabled: false });

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    const userQuery = query;
    setQuery("");

    // Send to both chat instances in parallel
    const ragPromise = ragChat.sendMessage(userQuery);
    const noRagPromise = noRagChat.sendMessage(userQuery);

    // Wait for both to complete
    await Promise.all([ragPromise, noRagPromise]);
    setLoading(false);
  };

  const handleReset = () => {
    ragChat.reset();
    noRagChat.reset();
    setQuery("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-4">
      <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            LLMonFHIR RAG Comparison
          </h1>
          <p className="text-gray-600">
            Compare responses with and without Retrieval-Augmented Generation
          </p>
        </div>

        {/* Split View */}
        <div className="mb-6 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          {/* RAG Enabled Panel */}
          <ChatPanel
            title="RAG Enabled"
            ragEnabled={true}
            messages={ragChat.messages}
            ragContext={ragChat.ragContext}
            isLoading={ragChat.isLoading}
            currentResponse={ragChat.currentResponse}
          />

          {/* RAG Disabled Panel */}
          <ChatPanel
            title="RAG Disabled"
            ragEnabled={false}
            messages={noRagChat.messages}
            ragContext={noRagChat.ragContext}
            isLoading={noRagChat.isLoading}
            currentResponse={noRagChat.currentResponse}
          />
        </div>

        {/* Input Form */}
        <div className="rounded-lg bg-white p-4 shadow">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(event) =>
                setQuery((event.target as HTMLInputElement).value)
              }
              placeholder="Ask about your health records..."
              className="flex-1 rounded border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Loading..." : "Ask"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
            >
              Clear
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
