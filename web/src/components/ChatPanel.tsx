//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

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
    <h1 className="mb-2 text-base font-semibold" {...props} />
  ),
  h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mb-2 text-sm font-semibold" {...props} />
  ),
  h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mb-2 text-sm font-semibold" {...props} />
  ),
  p: (props: React.ComponentPropsWithoutRef<"p">) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-2 list-disc pl-5" {...props} />
  ),
  ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
    <ol className="mb-2 list-decimal pl-5" {...props} />
  ),
  li: (props: React.ComponentPropsWithoutRef<"li">) => (
    <li className="mb-1" {...props} />
  ),
  blockquote: (props: React.ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="mb-2 border-l-4 border-gray-300 pl-3 text-gray-700 italic"
      {...props}
    />
  ),
  code: ({
    inline,
    ...props
  }: React.ComponentPropsWithoutRef<"code"> & { inline?: boolean }) => (
    <code
      className={
        inline ?
          "rounded bg-gray-100 px-1 text-xs text-gray-800"
        : "text-xs text-gray-900"
      }
      {...props}
    />
  ),
  pre: (props: React.ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="mb-2 overflow-x-auto rounded bg-gray-100 p-2 text-xs text-gray-900"
      {...props}
    />
  ),
};

const FormattedMarkdown = ({ content }: { content: string }) => (
  <div className="text-sm whitespace-pre-wrap">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  </div>
);

export const ChatPanel = ({
  title,
  ragEnabled,
  messages,
  ragContext,
  isLoading,
  currentResponse,
}: ChatPanelProps) => (
  <div
    className={`flex h-full flex-col rounded-lg border p-4 ${
      ragEnabled ?
        "border-green-200 bg-green-50/10"
      : "border-gray-200 bg-gray-50/10"
    }`}
  >
    {/* Header */}
    <div className="mb-3 border-b pb-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div
        className={`inline-block rounded px-2 py-1 text-sm ${
          ragEnabled ?
            "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-800"
        }`}
      >
        {ragEnabled ? "RAG Enabled" : "RAG Disabled"}
      </div>
    </div>

    {/* RAG Context */}
    {ragContext?.context && (
      <div className="mb-3 rounded border border-yellow-200 bg-yellow-50 p-3">
        <div className="mb-2 text-sm font-semibold text-yellow-800">
          Retrieved Context ({ragContext.contextLength} chars):
        </div>
        <div className="max-h-32 overflow-y-auto text-sm text-gray-700">
          <pre className="text-xs whitespace-pre-wrap">
            {ragContext.context}
          </pre>
        </div>
      </div>
    )}

    {/* Messages */}
    <div className="mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
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
            className={`rounded p-3 ${
              message.role === "user" ? "ml-8 bg-blue-100 text-blue-900"
              : message.role === "system" ?
                "bg-gray-100 text-xs text-gray-900 italic"
              : message.role === "tool" ?
                "mr-8 bg-yellow-100 text-xs text-yellow-900"
              : "mr-8 bg-green-100 text-green-900"
            }`}
          >
            <div className="mb-1 text-sm font-semibold capitalize">
              {message.role}
              {message.role === "tool" && message.tool_call_id && (
                <span className="font-normal text-gray-500">
                  {" "}
                  ({message.tool_call_id})
                </span>
              )}
            </div>
            <div className="text-sm">
              {message.role === "tool" ?
                <pre className="rounded bg-yellow-50 p-2 text-xs whitespace-pre-wrap">
                  {message.content}
                </pre>
              : <FormattedMarkdown content={message.content} />}
            </div>
          </div>
        );
      })}

      {/* Current streaming response */}
      {currentResponse && (
        <div className="mr-8 rounded bg-green-100 p-3 text-green-900">
          <div className="mb-1 text-sm font-semibold">Assistant</div>
          <FormattedMarkdown content={currentResponse} />
        </div>
      )}
    </div>

    {/* Loading indicator */}
    {isLoading && !currentResponse && (
      <div className="py-2 text-center text-gray-500">
        <div className="inline-block h-4 w-4 animate-spin rounded-full border-r-2 border-b-2 border-gray-900"></div>
        <span className="ml-2">Thinking...</span>
      </div>
    )}
  </div>
);
