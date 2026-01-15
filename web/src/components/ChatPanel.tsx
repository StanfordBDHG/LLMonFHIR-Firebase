import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import type { Message, RagContextInfo } from "../hooks/useChat";

interface ChatPanelProps {
  title: string;
  ragEnabled: boolean;
  messages: Message[];
  ragContext: RagContextInfo | null;
  isLoading: boolean;
  currentResponse: string;
}

const markdownComponents = {
  h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
    <h1 className="text-base font-semibold mb-2" {...props} />
  ),
  h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h2 className="text-sm font-semibold mb-2" {...props} />
  ),
  h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
    <h3 className="text-sm font-semibold mb-2" {...props} />
  ),
  p: (props: React.ComponentPropsWithoutRef<"p">) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="list-disc pl-5 mb-2" {...props} />
  ),
  ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
    <ol className="list-decimal pl-5 mb-2" {...props} />
  ),
  li: (props: React.ComponentPropsWithoutRef<"li">) => (
    <li className="mb-1" {...props} />
  ),
  blockquote: (props: React.ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="border-l-4 border-gray-300 pl-3 italic text-gray-700 mb-2"
      {...props}
    />
  ),
  code: ({
    inline,
    ...props
  }: React.ComponentPropsWithoutRef<"code"> & { inline?: boolean }) => (
    <code
      className={
        inline
          ? "bg-gray-100 text-gray-800 px-1 rounded text-xs"
          : "text-gray-900 text-xs"
      }
      {...props}
    />
  ),
  pre: (props: React.ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="bg-gray-100 text-gray-900 text-xs p-2 rounded overflow-x-auto mb-2"
      {...props}
    />
  ),
};

function FormattedMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm whitespace-pre-wrap">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatPanel({
  title,
  ragEnabled,
  messages,
  ragContext,
  isLoading,
  currentResponse,
}: ChatPanelProps) {
  return (
    <div
      className={`border rounded-lg p-4 flex flex-col h-full ${
        ragEnabled
          ? "border-green-200 bg-green-50/10"
          : "border-gray-200 bg-gray-50/10"
      }`}
    >
      {/* Header */}
      <div className="border-b pb-2 mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div
          className={`text-sm px-2 py-1 rounded inline-block ${
            ragEnabled
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {ragEnabled ? "RAG Enabled" : "RAG Disabled"}
        </div>
      </div>

      {/* RAG Context */}
      {ragContext && ragContext.context && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
          <div className="font-semibold text-sm text-yellow-800 mb-2">
            Retrieved Context ({ragContext.contextLength} chars):
          </div>
          <div className="text-sm text-gray-700 max-h-32 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-xs">
              {ragContext.context}
            </pre>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-3 space-y-3 min-h-0">
        {messages.map((message, index) => {
          if (
            message.role === "assistant" &&
            message.tool_calls?.length &&
            !message.content
          ) {
            return null;
          }

          return (
            <div
              key={index}
              className={`p-3 rounded ${
                message.role === "user"
                  ? "bg-blue-100 text-blue-900 ml-8"
                  : message.role === "system"
                    ? "bg-gray-100 text-gray-900 text-xs italic"
                    : message.role === "tool"
                      ? "bg-yellow-100 text-yellow-900 mr-8 text-xs"
                      : "bg-green-100 text-green-900 mr-8"
              }`}
            >
              <div className="font-semibold text-sm mb-1 capitalize">
                {message.role}
                {message.role === "tool" && message.tool_call_id && (
                  <span className="text-gray-500 font-normal">
                    {" "}
                    ({message.tool_call_id})
                  </span>
                )}
              </div>
              <div className="text-sm">
                {message.role === "tool" ? (
                  <pre className="whitespace-pre-wrap text-xs bg-yellow-50 p-2 rounded">
                    {message.content}
                  </pre>
                ) : (
                  <FormattedMarkdown content={message.content} />
                )}
              </div>
            </div>
          );
        })}

        {/* Current streaming response */}
        {currentResponse && (
          <div className="bg-green-100 text-green-900 p-3 rounded mr-8">
            <div className="font-semibold text-sm mb-1">Assistant</div>
            <FormattedMarkdown content={currentResponse} />
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && !currentResponse && (
        <div className="text-center text-gray-500 py-2">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-r-2 border-gray-900"></div>
          <span className="ml-2">Thinking...</span>
        </div>
      )}
    </div>
  );
}
