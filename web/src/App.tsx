import React, { useState } from "react";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

// UI display types (your app types)
interface ToolCallDisplay {
  index: number;
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolResultDisplay {
  tool_call_id: string;
  role: "tool";
  content: string;
}

interface ResponseDisplay {
  type: "text" | "tool_call";
  content: string;
  toolCalls?: ToolCallDisplay[];
  toolResults?: ToolResultDisplay[];
}

const FIREBASE_FUNCTION_URL =
  import.meta.env.MODE === "production"
    ? "https://us-central1-som-rit-phi-lit-ai-dev.cloudfunctions.net/chat"
    : "http://localhost:5001/som-rit-phi-lit-ai-dev/us-central1/chat";

const customFetch = async (
  url: string | Request | URL,
  init?: RequestInit
): Promise<Response> => {
  const urlString = typeof url === "string" ? url : url.toString();
  if (urlString.includes("/v1/chat/completions")) {
    return fetch(FIREBASE_FUNCTION_URL, init);
  }
  return fetch(url, init);
};

const openai = new OpenAI({
  apiKey: "dummy",
  dangerouslyAllowBrowser: true,
  fetch: customFetch,
});

const SYSTEM_PROMPT = `...your long system prompt...`;

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_resources",
      description:
        "Call this function to request the relevant FHIR health records based on the user's question and conversation context using their FHIR resource identifiers.",
      parameters: {
        type: "object",
        properties: {
          resourceCategories: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "Procedure-Appendectomy-05-25-2014",
                "Observation-ThyroxineT4-09-04-2014",
                "Observation-TSH-09-04-2014",
                "Procedure-ACLrepair-06-09-2021",
                "Observation-Totalcholesterol-10-18-2023",
                "Observation-BloodGlucose-10-18-2023",
                "Procedure-UltrasoundAbdomen-10-18-2023",
                "Observation-CBCpanelBloodbyAutomatedcount-10-18-2023",
                "Observation-RespiratoryRate-10-18-2023",
                "Observation-BPbloodpressure-10-18-2023",
                "Observation-Weight-10-18-2023",
                "Observation-Height-10-18-2023",
                "Observation-LDLcholesterol-10-18-2023",
                "Observation-CholesterolHDL-02-18-2024",
                "Observation-Triglycerides-02-18-2024",
                "Observation-BMIbodymassindex-02-18-2024",
                "Observation-Temperature-02-18-2024",
                "Observation-Pulse-02-18-2024",
              ],
            },
            description:
              "Pass in one or more identifiers that you want to access.",
          },
        },
        required: ["resourceCategories"],
      },
    },
  },
];

const MOCK_RESPONSES: Record<string, string> = {
  "Procedure-Appendectomy-05-25-2014":
    "This is the summary of the requested Procedure-Appendectomy-05-25-2014:\n\nAppendectomy Procedure\nPatient underwent an appendectomy on May 25, 2014. The procedure was completed successfully with no complications. Recovery was uneventful.",
  "Observation-ThyroxineT4-09-04-2014":
    "This is the summary of the requested Observation-ThyroxineT4-09-04-2014:\n\nThyroxine (T4) Lab Result\nThyroxine (T4) level was 1.2 ng/dL, within the normal range of 0.8 to 1.8 ng/dL as of September 4, 2014.",
  "Observation-TSH-09-04-2014":
    "This is the summary of the requested Observation-TSH-09-04-2014:\n\nTSH Lab Result\nThyroid Stimulating Hormone (TSH) level was 2.5 mIU/L, within the normal range of 0.4 to 4.0 mIU/L as of September 4, 2014.",
  "Procedure-ACLrepair-06-09-2021":
    "This is the summary of the requested Procedure-ACLrepair-06-09-2021:\n\nACL Repair Procedure\nCandace Salinas underwent a completed ACL repair procedure on June 9, 2021.",
  "Observation-Totalcholesterol-10-18-2023":
    "This is the summary of the requested Observation-Totalcholesterol-10-18-2023:\n\nCholesterol Test Result\nTotal cholesterol level is 184 mg/dL, within the normal range of 120 to 220 mg/dL, as of October 18, 2023.",
  "Observation-BloodGlucose-10-18-2023":
    "This is the summary of the requested Observation-BloodGlucose-10-18-2023:\n\nBlood Glucose Observation\nBlood glucose level measured at 60 mg/dL, which is below the normal reference range of 61-100 mg/dL, as of October 18, 2023.",
  "Procedure-UltrasoundAbdomen-10-18-2023":
    "This is the summary of the requested Procedure-UltrasoundAbdomen-10-18-2023:\n\nUltrasound Abdomen Procedure\nCompleted ultrasound scan of the lower abdomen performed on 2023-10-18 by Dr. Altick Kelly, a gynecologist.",
  "Observation-CBCpanelBloodbyAutomatedcount-10-18-2023":
    "This is the summary of the requested Observation-CBCpanelBloodbyAutomatedcount-10-18-2023:\n\nCBC Panel Results\nCBC panel shows leukocytes at 111 (10*3/uL), erythrocytes at 222 (10*6/uL), platelets at 333 (10*3/uL), and hemoglobin at 444 g/dL, within the reference range of 400 to 500 g/dL.",
  "Observation-RespiratoryRate-10-18-2023":
    "This is the summary of the requested Observation-RespiratoryRate-10-18-2023:\n\nRespiratory Rate Observation\nRespiratory rate recorded as 22 breaths per minute on October 18, 2023, during encounter 129837645.",
  "Observation-BPbloodpressure-10-18-2023":
    "This is the summary of the requested Observation-BPbloodpressure-10-18-2023:\n\nBlood Pressure Observation\nBlood pressure recorded as 110/70 mmHg on October 18, 2023, during encounter 129837645.",
  "Observation-Weight-10-18-2023":
    "This is the summary of the requested Observation-Weight-10-18-2023:\n\nWeight Observation\nPatient's weight recorded as 155 lbs on October 18, 2023.",
  "Observation-Height-10-18-2023":
    "This is the summary of the requested Observation-Height-10-18-2023:\n\nHeight Observation\nHeight recorded as 164 cm on October 18, 2023.",
  "Observation-LDLcholesterol-10-18-2023":
    "This is the summary of the requested Observation-LDLcholesterol-10-18-2023:\n\nLDL Cholesterol Test Result\nLDL cholesterol level is 113.3 mg/dL, within the normal range of 50 to 178 mg/dL, as of October 18, 2023.",
  "Observation-CholesterolHDL-02-18-2024":
    "This is the summary of the requested Observation-CholesterolHDL-02-18-2024:\n\nCholesterol HDL Test Result\nHDL cholesterol level is 95.5 mg/dL, which is above the normal range of 35 to 59 mg/dL. Test status is final as of February 18, 2024.",
  "Observation-Triglycerides-02-18-2024":
    "This is the summary of the requested Observation-Triglycerides-02-18-2024:\n\nTriglycerides Lab Result\nTriglycerides level is 86 mg/dL, within the normal range of 10 to 250 mg/dL, as of February 18, 2024.",
  "Observation-BMIbodymassindex-02-18-2024":
    "This is the summary of the requested Observation-BMIbodymassindex-02-18-2024:\n\nBMI Observation\nYour BMI is 26.2 kg/m^2 as of February 18, 2024.",
  "Observation-Temperature-02-18-2024":
    "This is the summary of the requested Observation-Temperature-02-18-2024:\n\nTemperature Observation\nThe patient's temperature was recorded as 37.6°C on February 18, 2024, during an encounter. The observation status is final.",
  "Observation-Pulse-02-18-2024":
    "This is the summary of the requested Observation-Pulse-02-18-2024:\n\nPulse Observation\nPulse rate recorded as 77 beats per minute on February 18, 2024.",
};

const executeToolCall = (toolCall: {
  function: { name: string; arguments: string };
}): string => {
  const { name, arguments: argsStr } = toolCall.function;
  const args = JSON.parse(argsStr || "{}");

  if (name === "get_resources") {
    const { resourceCategories } = args as { resourceCategories?: unknown };
    if (!Array.isArray(resourceCategories)) return "No resources requested.";

    return (resourceCategories as string[])
      .map(
        (category) =>
          MOCK_RESPONSES[category] || `No data available for ${category}`
      )
      .join("\n\n");
  }

  return "Unknown tool";
};

const buildMessagesForAPI = (
  history: ChatCompletionMessageParam[]
): ChatCompletionMessageParam[] => {
  const api: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  for (const m of history) {
    if (m.role === "system") continue;

    if (m.role === "user") {
      api.push({ role: "user", content: m.content ?? "" });
      continue;
    }

    if (m.role === "assistant") {
      // If assistant contains tool calls, content must be null
      if (m.tool_calls && m.tool_calls.length > 0) {
        api.push({
          role: "assistant",
          content: null,
          tool_calls: m.tool_calls,
        });
      } else {
        api.push({ role: "assistant", content: m.content ?? "" });
      }
      continue;
    }

    if (m.role === "tool") {
      api.push({
        role: "tool",
        content: m.content ?? "",
        tool_call_id: (m as any).tool_call_id ?? "",
      });
    }
  }

  return api;
};

export function App() {
  const [query, setQuery] = useState("");
  const [responses, setResponses] = useState<ResponseDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatCompletionMessageParam[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    const userQuery = query;
    setQuery("");

    let currentMessages: ChatCompletionMessageParam[] = [
      ...messages,
      { role: "user", content: userQuery },
    ];

    const responseIndex = responses.length;
    setResponses((prev) => [...prev, { type: "text", content: "" }]);

    while (true) {
      try {
        const stream = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: buildMessagesForAPI(currentMessages),
          tools,
          stream: true,
          temperature: 0,
        });

        let accumulatedText = "";
        let finishReason: string | null = null;

        // tool calls get streamed as deltas with an index
        const toolCallsByIndex = new Map<number, ToolCallDisplay>();

        for await (const chunk of stream) {
          const choice = chunk.choices?.[0];
          if (!choice) continue;

          if (choice.delta?.content) {
            accumulatedText += choice.delta.content;
            setResponses((prev) => {
              const updated = [...prev];
              updated[responseIndex] = {
                ...updated[responseIndex],
                content: accumulatedText,
              };
              return updated;
            });
          }

          const deltas = choice.delta?.tool_calls;
          if (deltas) {
            for (const tc of deltas) {
              const idx = tc.index ?? 0;
              const existing = toolCallsByIndex.get(idx) ?? {
                index: idx,
                id: "",
                type: "function" as const,
                function: { name: "", arguments: "" },
              };

              if (tc.id) existing.id = tc.id;
              if (tc.type) existing.type = "function";
              if (tc.function?.name) existing.function.name = tc.function.name;
              if (tc.function?.arguments) {
                existing.function.arguments += tc.function.arguments;
              }

              toolCallsByIndex.set(idx, existing);
            }
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
        }

        const toolCalls = [...toolCallsByIndex.values()].sort(
          (a, b) => a.index - b.index
        );

        // If tool calls happened, execute tools and continue loop
        if (toolCalls.length > 0 || finishReason === "tool_calls") {
          setResponses((prev) => {
            const updated = [...prev];
            updated[responseIndex] = {
              type: "tool_call",
              content: accumulatedText,
              toolCalls,
            };
            return updated;
          });

          // Convert display tool calls to OpenAI message tool calls (no index needed here)
          const assistantWithTools: ChatCompletionAssistantMessageParam = {
            role: "assistant",
            content: null,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          };

          currentMessages = [...currentMessages, assistantWithTools];

          const toolResults: ToolResultDisplay[] = toolCalls.map((tc) => {
            const result = executeToolCall({
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            });
            return { tool_call_id: tc.id, role: "tool", content: result };
          });

          setResponses((prev) => {
            const updated = [...prev];
            updated[responseIndex] = { ...updated[responseIndex], toolResults };
            return updated;
          });

          for (const tr of toolResults) {
            const toolMsg: ChatCompletionMessageParam = {
              role: "tool",
              tool_call_id: tr.tool_call_id,
              content: tr.content,
            } as any; // union type sometimes needs help depending on TS config
            currentMessages.push(toolMsg);
          }

          setMessages(currentMessages);
          continue;
        }

        // No tool calls; assistant answered
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulatedText },
        ]);
        break;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to get response";

        setResponses((prev) => {
          const updated = [...prev];
          updated[responseIndex] = {
            type: "text",
            content: `Error: ${message}`,
          };
          return updated;
        });
        break;
      }
    }

    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">LLMonFHIR Assistant</h1>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about your health records..."
            className="flex-1 px-4 py-2 border rounded"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Loading..." : "Ask"}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {responses.map((response, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-lg">
            {response.type === "tool_call" ? (
              <div>
                <div className="mb-2">
                  <h3 className="font-semibold text-sm text-gray-600">
                    Tool Call Requested:
                  </h3>
                  {response.toolCalls?.map((tc) => (
                    <div
                      key={tc.index}
                      className="mt-2 p-2 bg-yellow-50 rounded"
                    >
                      <div className="text-sm">
                        <strong>Function:</strong> {tc.function.name}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        <strong>Arguments:</strong> {tc.function.arguments}
                      </div>
                    </div>
                  ))}
                </div>

                {response.toolResults && (
                  <div className="mt-2">
                    <h3 className="font-semibold text-sm text-gray-600">
                      Tool Results (Mock Data):
                    </h3>
                    {response.toolResults.map((tr, trIndex) => (
                      <div
                        key={trIndex}
                        className="mt-2 p-2 bg-green-50 rounded text-xs"
                      >
                        <pre className="whitespace-pre-wrap">{tr.content}</pre>
                      </div>
                    ))}
                  </div>
                )}

                {response.content && (
                  <div className="mt-2 text-sm text-gray-600">
                    {response.content}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="font-semibold mb-2">Response:</h3>
                <p className="whitespace-pre-wrap">{response.content}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
