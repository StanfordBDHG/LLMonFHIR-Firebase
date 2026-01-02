import React, { useState } from "react";
import OpenAI from "openai";

// Get your Firebase region and function URL
const FIREBASE_FUNCTION_URL =
  import.meta.env.MODE === "production"
    ? "https://us-central1-som-rit-phi-lit-ai-dev.cloudfunctions.net/chat"
    : "http://localhost:5001/som-rit-phi-lit-ai-dev/us-central1/chat";

// Custom fetch function that intercepts OpenAI SDK requests and routes to Firebase function
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

// Initialize OpenAI client with custom fetch to route through Firebase function
const openai = new OpenAI({
  apiKey: "dummy",
  dangerouslyAllowBrowser: true,
  fetch: customFetch,
});

// System prompt for the LLMonFHIR agent
const SYSTEM_PROMPT = `You are the LLMonFHIR agent tasked with helping users understand their current health, recent procedures and conditions, and any questions they have while accessing their FHIR health records for additional context.\n\nYou should directly communicate with the user and use the information from the health records to add context to the user's questions and conversation.\n\nThroughout the conversation with the user, you MUST use the "get_resources" tool call to obtain the FHIR health resources necessary to answer the user's question correctly. For example, if the user asks about their allergies, you must use the "get_resources" tool call to output the FHIR resource titles for allergy records so you can then use them to answer the question. Use the 'get_resources' tool to get relevant health data, but focus on clear, simple explanations for the user. Leave out any technical details like JSON, FHIR resources, and other implementation details of the underlying data resources.\nUse this information to determine the best possible FHIR resource for each question. Try to keep the equested resources to a reasonable minimum to answer the user questions or to fulfill your task.\nFor example, if the user asks about their recent hospital visits, it would be recommended to request all recent DocumentReference and DiagnosticReport FHIR resources to obtain the relevant clinical notes, discharge reports, diagnostic reports, and other related FHIR resources.\n\nInterpret the resources by explaining the data relevant to the user's health. Please do NOT mention any medications unless the user explicitly asks about medications.\nTry to be proactive and query for more information if you are missing any context instead of asking the user for specific information. Try to avoid too many follow-up questions.\n\nThere is a special emphasis on documents such as clinical notes, progress reports, and, most importantly, discharge reports that you should focus on. Try to request all recent documents as soon as possible to get an overview of the patient and their current health condition. \nUse simple language. Keep responses in the user's language and the present tense.\n\nEnsure to leave out sensitive numbers like SSN, passport number, and telephone number.\n\nExplain the relevant medical context in a language understandable by a user who is not a medical professional and aim to respond to the user at a 5th-grade reading level.  When possible, use words with 1 or 2 syllables. When feasible, use less than 11 words per sentence. Keep responses clear and easy to read. Use non-technical language. Do not compromise the quality or accuracy of the information. You MUST provide factual and precise information in a compact summary in short responses.\n\nWrite like you are talking to a friend. Be kind and acknowledge the complexity of the user's experience. Use common, simple language. For example:\n1. Instead of Cyanosis, say Blue skin\n2. Instead of Ischemia, say Lack of blood flow\n3. Instead of Metabolic syndrome, say Health problems linked to weight and sugar levels\n4. Instead of Immunocompromised, say Weak immune system\n5. Instead of Autoimmune disease, say the Immune system attacking the Body\n6. Instead of Cerebrovascular accident (CVA), say Stroke\n7. Instead of Neuropathy, say Nerve damage\n8. Instead of Cognitive impairment, say Memory or thinking problems\n9. Instead of Tinnitus, say Ringing in the ears\n10. Instead of Osteoporosis, say Weak bones\n11. Instead of Ligament tear, say Torn tissue in a joint\n12. Instead of Chronic obstructive pulmonary disease (COPD), say Lung disease that makes breathing hard\n13. Instead of Pulmonary embolism, say Blood clot in the lung\n14. Instead of Aspiration, say Breathing in food or liquid by mistake\n15. Instead of Malignant tumor, say Cancer\n16. Instead of Benign tumor, say Non-cancerous lump\n17. Instead of Lesion, say Wound or sore\n18. Instead of Abscess, say Pocket of pus\n19. Instead of Aneurysm, say Bulging blood vessel\n20. Instead of Aphasia, say Trouble speaking or understanding words\n21. Instead of Atrophy, say Muscle shrinkage\n22. Instead of Biopsy, say Tissue test\n23. Instead of Cataract, say Cloudy eye lens\n24. Instead of Cellulitis, say Skin infection\n25. Instead of Cholecystitis, say Gallbladder infection\n26. Instead of Cirrhosis, say Liver damage\n27. Instead of Deep vein thrombosis (DVT), say Blood clot in a deep vein\n28. Instead of Dementia, say Memory loss disease\n29. Instead of Dysmenorrhea, say Painful periods\n30. Instead of Eczema, say Itchy skin rash\n31. Instead of Embolism, say Blocked blood vessel\n32. Instead of Encephalitis, say Brain swelling\n33. Instead of Epistaxis, say Nosebleed\n34. Instead of Fibromyalgia, say Long-term muscle pain\n35. Instead of Glaucoma, say Eye disease that damages the vision\n36. Instead of Hemoptysis, say Coughing up blood\n37. Instead of Hernia, say Bulging tissue through a weak spot\n38. Instead of Insulin resistance, say Body not using sugar well\n39. Instead of Lymphedema, say Swelling due to fluid buildup\n40. Instead of Meningitis, say Brain and spine infection\n41. Instead of Metastasis, say Cancer spreading\n42. Instead of Neoplasm, say New lump or growth\n43. Instead of Neuroma, say Nerve tumor\n44. Instead of Ophthalmology, say Eye doctor's specialty\n45. Instead of Orthopnea, say Trouble breathing when lying down\n46. Instead of Pericarditis, say Swelling around the heart\n47. Instead of Photophobia, say Eye sensitivity to light\n48. Instead of Pleurisy, say Lung lining swelling\n49. Instead of Septicemia, say Serious blood infection\n50. Instead of Strabismus, say Crossed eyes\n\nDo not introduce yourself at the beginning, and immediately return a summary of the user based on the FHIR patient resources. \nStart with an initial compact summary of their health information based on recent encounters, document references (clinical notes, discharge summaries), and any other relevant information you can access. Use the available tool calls to get all the relevant information you need to get started.\nThe initial compact summary should be compact (no bullet points but rather a holistic summary of all the information), empathetic to the user about their current health situation, and less than four sentences long.\nAdd a new paragraph after the initial summary and ask the user if they have any questions or where you can help them.`;

// Define tools for function calling (must match backend function definition)
const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_resources",
      description: "Retrieves FHIR health resources based on resource types.",
      parameters: {
        type: "object",
        properties: {
          resourceTypes: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of FHIR resource types to retrieve (e.g., 'AllergyIntolerance', 'Condition', 'Medication')",
          },
          query: {
            type: "string",
            description: "Optional query string to filter resources",
          },
        },
        required: ["resourceTypes"],
      },
    },
  },
];

// Mock tool execution function - returns hardcoded FHIR data
const executeToolCall = (toolCall: any): any => {
  const { name, arguments: argsStr } = toolCall.function;
  const args = JSON.parse(argsStr || "{}");

  if (name === "get_resources") {
    const { resourceTypes } = args;

    // Return mock FHIR resources based on resource types
    const mockResources: any[] = [];

    if (resourceTypes?.includes("AllergyIntolerance")) {
      mockResources.push(
        {
          resourceType: "AllergyIntolerance",
          id: "allergy-novalgin-001",
          clinicalStatus: {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                code: "active",
                display: "Active",
              },
            ],
          },
          verificationStatus: {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                code: "confirmed",
                display: "Confirmed",
              },
            ],
          },
          type: "allergy",
          category: ["medication"],
          criticality: "high",
          code: {
            coding: [
              {
                system: "http://www.nlm.nih.gov/research/umls/rxnorm",
                code: "C0024560",
                display: "Novalgin",
              },
            ],
            text: "Novalgin (Metamizole)",
          },
          patient: {
            reference: "Patient/example",
          },
          recordedDate: "2023-06-15",
          reaction: [
            {
              substance: {
                coding: [{ display: "Novalgin" }],
              },
              manifestation: [
                {
                  coding: [
                    {
                      system: "http://snomed.info/sct",
                      code: "271807003",
                      display: "Rash",
                    },
                  ],
                  text: "Skin rash",
                },
              ],
              severity: "severe",
            },
          ],
        },
        {
          resourceType: "AllergyIntolerance",
          id: "allergy-penicillin-001",
          clinicalStatus: {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                code: "active",
                display: "Active",
              },
            ],
          },
          verificationStatus: {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                code: "confirmed",
                display: "Confirmed",
              },
            ],
          },
          type: "allergy",
          category: ["medication"],
          criticality: "high",
          code: {
            coding: [
              {
                system: "http://www.nlm.nih.gov/research/umls/rxnorm",
                code: "C2899904",
                display: "Penicillin",
              },
            ],
            text: "Penicillin",
          },
          patient: {
            reference: "Patient/example",
          },
          recordedDate: "2022-03-10",
          reaction: [
            {
              substance: {
                coding: [{ display: "Penicillin" }],
              },
              manifestation: [
                {
                  coding: [
                    {
                      system: "http://snomed.info/sct",
                      code: "39579001",
                      display: "Anaphylaxis",
                    },
                  ],
                  text: "Anaphylactic reaction",
                },
              ],
              severity: "severe",
            },
          ],
        }
      );
    }

    // For other resource types, return basic mock structure
    resourceTypes?.forEach((type: string) => {
      if (type !== "AllergyIntolerance") {
        mockResources.push({
          resourceType: type,
          id: `mock-${type.toLowerCase()}-${Date.now()}`,
          status: "active",
          note: `Mock ${type} resource`,
        });
      }
    });

    return {
      resources: mockResources,
      count: mockResources.length,
    };
  }

  return { error: "Unknown tool" };
};

interface Message {
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

interface ResponseItem {
  type: "text" | "tool_call";
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
}

// Helper function to build messages array with system prompt
const buildMessagesForAPI = (messages: Message[]) => {
  const apiMessages: any[] = [
    { role: "system" as const, content: SYSTEM_PROMPT },
  ];

  messages.forEach((m) => {
    if (m.role === "user") {
      apiMessages.push({ role: "user" as const, content: m.content || "" });
    } else if (m.role === "assistant") {
      const msg: any = {
        role: "assistant" as const,
      };
      // If assistant has tool_calls, content should be null
      if (m.tool_calls && m.tool_calls.length > 0) {
        msg.content = null;
        msg.tool_calls = m.tool_calls;
      } else {
        msg.content = m.content;
      }
      apiMessages.push(msg);
    } else if (m.role === "tool") {
      // Tool messages should only have role, content, and tool_call_id (no name)
      apiMessages.push({
        role: "tool" as const,
        content: m.content || "",
        tool_call_id: m.tool_call_id || "",
      });
    }
  });

  return apiMessages;
};

export function App() {
  const [query, setQuery] = useState("");
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    const userQuery = query;
    setQuery("");

    // Add user message to history
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userQuery },
    ];
    setMessages(newMessages);

    try {
      // First turn - send to server with streaming
      const streamResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: buildMessagesForAPI(newMessages),
        tools: tools,
        stream: true,
      });

      // Stream the response and collect data
      let firstResponseText = "";
      let toolCalls: any[] = [];
      let finishReason: string | null = null;

      // Create a response item for streaming
      let responseIndex: number;
      setResponses((prev) => {
        responseIndex = prev.length;
        return [...prev, { type: "text" as const, content: "" }];
      });

      for await (const chunk of streamResponse) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        // Handle text content from delta
        const content = choice.delta?.content || "";
        if (content) {
          firstResponseText += content;
          setResponses((prev) => {
            const updated = [...prev];
            updated[responseIndex] = {
              ...updated[responseIndex],
              content: firstResponseText,
            };
            return updated;
          });
        }

        // Check for tool calls in delta (streaming format)
        if (choice.delta?.tool_calls) {
          choice.delta.tool_calls.forEach((tc: any) => {
            const existingIndex = toolCalls.findIndex(
              (t: any) => t.index === tc.index
            );
            if (existingIndex >= 0) {
              // Append to existing tool call
              if (tc.function?.name) {
                toolCalls[existingIndex].function.name = tc.function.name;
              }
              if (tc.function?.arguments) {
                toolCalls[existingIndex].function.arguments =
                  (toolCalls[existingIndex].function.arguments || "") +
                  tc.function.arguments;
              }
              if (tc.id) {
                toolCalls[existingIndex].id = tc.id;
              }
            } else {
              // New tool call
              toolCalls.push({
                index: tc.index,
                id: tc.id,
                type: tc.type || "function",
                function: {
                  name: tc.function?.name || "",
                  arguments: tc.function?.arguments || "",
                },
              });
            }
          });
        }

        // Debug: log chunk structure when tool calls or finish reason appear
        if (choice.delta?.tool_calls || choice.finish_reason) {
          console.log("Chunk with tool calls or finish:", {
            delta: choice.delta,
            finish_reason: choice.finish_reason,
          });
        }

        // Check finish reason
        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }

      console.log("After streaming:", {
        toolCalls,
        finishReason,
        firstResponseText,
      });

      // Check if there are tool calls
      if (toolCalls.length > 0 || finishReason === "tool_calls") {
        console.log(
          "Tool calls detected, executing and sending second request"
        );
        // Execute tool calls locally
        const toolResults = toolCalls.map((toolCall: any) => {
          let args = {};
          try {
            args = toolCall.function.arguments
              ? JSON.parse(toolCall.function.arguments)
              : {};
          } catch (e) {
            args = {};
          }
          const result = executeToolCall({
            function: {
              name: toolCall.function.name,
              arguments: JSON.stringify(args),
            },
          });
          return {
            tool_call_id: toolCall.id,
            role: "tool" as const,
            content: JSON.stringify(result),
          };
        });

        // Update the existing response to show tool calls instead of adding a new one
        setResponses((prev) => {
          const updated = [...prev];
          updated[responseIndex] = {
            type: "tool_call",
            content: firstResponseText,
            toolCalls: toolCalls,
            toolResults: toolResults,
          };
          return updated;
        });

        // Add assistant message with tool calls to history
        // When assistant has tool_calls, content should be null
        // Remove 'index' field from tool_calls (only used during streaming, not in final message format)
        const assistantMessage: Message = {
          role: "assistant",
          content: toolCalls.length > 0 ? null : firstResponseText,
          tool_calls: toolCalls.map((tc: any) => ({
            id: tc.id,
            type: tc.type || "function",
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        };
        const updatedMessages: Message[] = [...newMessages, assistantMessage];

        // Add tool results to history (no name field for tool messages)
        toolResults.forEach((result: any) => {
          updatedMessages.push({
            role: "tool",
            content: result.content,
            tool_call_id: result.tool_call_id,
          });
        });

        setMessages(updatedMessages);

        console.log("Sending second request with messages:", updatedMessages);

        // Second turn - send tool results back to server with streaming
        const secondStreamResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: buildMessagesForAPI(updatedMessages),
          tools: tools,
          stream: true,
        });

        // Stream the final response
        let finalResponse = "";
        let finalResponseIndex: number;
        setResponses((prev) => {
          finalResponseIndex = prev.length;
          return [...prev, { type: "text" as const, content: "" }];
        });

        for await (const chunk of secondStreamResponse) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            finalResponse += content;
            setResponses((prev) => {
              const updated = [...prev];
              updated[finalResponseIndex] = {
                ...updated[finalResponseIndex],
                content: finalResponse,
              };
              return updated;
            });
          }
        }

        // Add final assistant message to history
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: finalResponse },
        ]);
      } else {
        // No tool calls - display response directly
        setResponses((prev) => [
          ...prev,
          { type: "text", content: firstResponseText },
        ]);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: firstResponseText },
        ]);
      }
    } catch (error) {
      console.error("Error:", error);
      setResponses((prev) => [
        ...prev,
        {
          type: "text",
          content: `Error: ${
            error instanceof Error ? error.message : "Failed to get response"
          }`,
        },
      ]);
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
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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
                  {response.toolCalls?.map((tc, tcIndex) => (
                    <div
                      key={tcIndex}
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
