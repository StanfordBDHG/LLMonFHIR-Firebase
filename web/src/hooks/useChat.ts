//
// This source file is part of the Stanford Biodesign Digital Health LLMonFHIR- Firebase open-source project
//
// SPDX-FileCopyrightText: 2026 Stanford University and the project authors (see CONTRIBUTORS.md)
//
// SPDX-License-Identifier: MIT
//

import { useMemo, useState } from "react";
import OpenAI from "openai";
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

export interface RagContextInfo {
  context: string;
  contextLength: number;
  enabled: boolean;
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ChatCompletionMessageToolCall[];
  tool_call_id?: string;
}

// API URL configuration
const FIREBASE_FUNCTION_URL =
  import.meta.env.MODE === "production"
    ? "https://us-central1-som-rit-phi-lit-ai-dev.cloudfunctions.net/chat"
    : "http://localhost:5001/som-rit-phi-lit-ai-dev/us-central1/chat";

const getApiUrl = (ragEnabled: boolean) => {
  return ragEnabled
    ? FIREBASE_FUNCTION_URL
    : `${FIREBASE_FUNCTION_URL}?ragEnabled=false`;
};

const createOpenAIClient = (ragEnabled: boolean) => {
  const customFetch = async (
    url: string | Request | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const urlString = typeof url === "string" ? url : url.toString();
    if (urlString.includes("/v1/chat/completions")) {
      return fetch(getApiUrl(ragEnabled), init);
    }
    return fetch(url, init);
  };

  return new OpenAI({
    apiKey: "dummy",
    dangerouslyAllowBrowser: true,
    fetch: customFetch,
  });
};

// Mock responses for FHIR resource tool calls
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

const SYSTEM_PROMPT = `You are an LLM-powered health assistant for patients. You help patients understand their health records, medical history, and answer health-related questions based on their FHIR data.

When a user asks about their health information, use the get_resources tool to retrieve the relevant FHIR resources. Then, explain the information in simple, patient-friendly language.

Be empathetic, clear, and helpful. If you don't have enough information to answer a question, say so honestly.`;

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
            description: "Pass in one or more identifiers that you want to access.",
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
          },
        },
        required: ["resourceCategories"],
      },
    },
  },
];

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
  history: Message[]
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
        tool_call_id: m.tool_call_id ?? "",
      });
    }
  }

  return api;
};

interface UseChatOptions {
  ragEnabled?: boolean;
}

interface ToolCallAccumulated {
  index: number;
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export function useChat(options: UseChatOptions = {}) {
  const { ragEnabled = true } = options;

  const openai = useMemo(() => createOpenAIClient(ragEnabled), [ragEnabled]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [ragContext, setRagContext] = useState<RagContextInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reset = () => {
    setMessages([]);
    setCurrentResponse("");
    setRagContext(null);
    setIsLoading(false);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);
    setCurrentResponse("");
    setRagContext(null);

    const userQuery = content;

    let currentMessages: Message[] = [
      ...messages,
      { role: "user", content: userQuery },
    ];
    setMessages(currentMessages);

    let responseText = "";
    let responseIndex = currentMessages.length;

    while (true) {
      try {
        const stream = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: buildMessagesForAPI(currentMessages),
          tools,
          stream: true,
          temperature: 0,
        });

        let finishReason: string | null = null;
        const toolCallsByIndex = new Map<number, ToolCallAccumulated>();

        for await (const chunk of stream) {
          if ("type" in chunk && chunk.type === "rag_context") {
            setRagContext(chunk as unknown as RagContextInfo);
            continue;
          }

          const typedChunk = chunk as ChatCompletionChunk;
          const choice = typedChunk.choices?.[0];
          if (!choice) continue;

          if (choice.delta?.content) {
            responseText += choice.delta.content;
            setCurrentResponse(responseText);
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

          if (toolCalls.length > 0 || finishReason === "tool_calls") {
          setCurrentResponse("");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: responseText,
              tool_calls: toolCalls as ChatCompletionMessageToolCall[],
            },
          ]);


          const toolResults: Message[] = toolCalls.map((tc) => {
            const result = executeToolCall({
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            });
            return {
              tool_call_id: tc.id,
              role: "tool" as const,
              content: result,
            };
          });

          currentMessages = [
            ...currentMessages,
            {
              role: "assistant",
              content: responseText,
              tool_calls: toolCalls as ChatCompletionMessageToolCall[],
            },
            ...toolResults,
          ];
          setMessages(currentMessages);

          responseIndex = currentMessages.length;
          responseText = "";
          setCurrentResponse("");
          continue;
        }

        currentMessages = [
          ...currentMessages,
          { role: "assistant", content: responseText },
        ];
        setCurrentResponse("");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: responseText },
        ]);
        break;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to get response";

        setMessages((prev) => {
          const updated = [...prev];
          updated[responseIndex] = {
            role: "assistant",
            content: `Error: ${message}`,
          };
          return updated;
        });
        break;
      }
    }

    setIsLoading(false);
    setCurrentResponse("");
  };

  return {
    messages,
    setMessages,
    currentResponse,
    ragContext,
    isLoading,
    sendMessage,
    reset,
  };
}
