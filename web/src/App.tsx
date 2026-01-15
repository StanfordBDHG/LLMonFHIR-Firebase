import React, { useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { useChat } from "./hooks/useChat";

export function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Two separate chat instances for comparison
  const ragChat = useChat({ ragEnabled: true });
  const noRagChat = useChat({ ragEnabled: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col">
      <div className="w-full max-w-screen-2xl mx-auto flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            LLMonFHIR RAG Comparison
          </h1>
          <p className="text-gray-600">
            Compare responses with and without Retrieval-Augmented Generation
          </p>
        </div>

        {/* Split View */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 flex-1 min-h-0"
        >
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
        <div className="bg-white rounded-lg shadow p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your health records..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading..." : "Ask"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Clear
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
