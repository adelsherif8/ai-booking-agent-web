// The agent loop — this IS the tool-calling skill.
//   model decides which tool(s) to call -> we execute them -> feed results back
//   -> repeat until it answers in natural language (capped at MAX_ITERS).
import type OpenAI from "openai";

import { complete, LlmMessage, MOCK, mockComplete, Usage } from "@/lib/llm";
import { DISPATCH } from "@/lib/tools";

const MAX_ITERS = 6;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Step {
  tool: string;
  args: Record<string, unknown>;
  result: any;
}

export interface AgentResult {
  reply: string;
  trace: Step[];
  iterations: number;
  usage: Usage;
  mock: boolean;
}

const SYSTEM = `You are the AI front desk for Lumina Studio, a design & AI-automation studio. You can answer questions and take real actions by calling tools.
Rules:
1. For ANY factual question (services, pricing, hours, location, refund or cancellation policy), call search_knowledge_base first and answer using the returned snippet, citing its source. Never invent policy or prices.
2. To schedule, call check_availability, then book_appointment — but only after you have the person's name AND email. If you don't have them, ask.
3. Whenever you learn a name and email, call log_lead so the team can follow up, even if no booking happens.
4. You may call several tools in one turn. Be concise, friendly, and concrete.`;

function execute(name: string, rawArgs: string): { args: Record<string, unknown>; result: any } {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { args: {}, result: { status: "error", message: `arguments were not valid JSON: ${rawArgs}` } };
  }
  const fn = DISPATCH[name];
  if (!fn) return { args, result: { status: "error", message: `unknown tool ${name}` } };
  try {
    return { args, result: fn(args) };
  } catch (e) {
    return { args, result: { status: "error", message: `${name} failed: ${(e as Error).message}` } };
  }
}

export async function runAgent(userMessage: string, history: ChatTurn[] = []): Promise<AgentResult> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];
  const allUserText = [...history.filter((h) => h.role === "user").map((h) => h.content), userMessage].join(" ");

  const trace: Step[] = [];
  const resultsByName: Record<string, any> = {};
  const usage: Usage = { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 };
  let iterations = 0;

  for (let i = 1; i <= MAX_ITERS; i++) {
    iterations = i;
    const { message, usage: u } = MOCK
      ? mockComplete(allUserText, resultsByName)
      : await complete(messages);
    usage.prompt_tokens += u.prompt_tokens;
    usage.completion_tokens += u.completion_tokens;
    usage.cost_usd += u.cost_usd;

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const reply = (message.content || "").trim() || "Sorry, I couldn't put together a reply — could you rephrase?";
      return { reply, trace, iterations, usage, mock: MOCK };
    }

    if (!MOCK) messages.push(message as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    for (const call of toolCalls) {
      const name = call.function.name;
      const { args, result } = execute(name, call.function.arguments);
      trace.push({ tool: name, args, result });
      resultsByName[name] = result;
      if (!MOCK) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
  }

  return {
    reply: "I've gathered what I can but hit my action limit for this turn. Could you confirm the details so I can finish up?",
    trace,
    iterations,
    usage,
    mock: MOCK,
  };
}
