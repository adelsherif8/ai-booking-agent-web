// LLM access layer. Real mode talks to OpenAI (optionally wrapped by Langfuse
// so every generation is traced); mock mode is a deterministic brain that
// decides which tools to call, so the app runs with NO key for local dev.
import OpenAI from "openai";

import { TOOLS } from "@/lib/tools";

export const MOCK = !process.env.OPENAI_API_KEY;
export const LANGFUSE_ON = !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LlmMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
}

function costUsd(model: string, p: number, c: number): number {
  const pr = PRICING[model];
  if (!pr) return 0;
  return (p / 1_000_000) * pr.input + (c / 1_000_000) * pr.output;
}

// --------------------------------------------------------------------------
// Real OpenAI client (lazily created, optionally Langfuse-wrapped)
// --------------------------------------------------------------------------
let _client: any = null;
let _wrapped = false;

function getClient(): any {
  if (_client) return _client;
  const base = new OpenAI();
  if (LANGFUSE_ON) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { observeOpenAI } = require("langfuse");
      _client = observeOpenAI(base, { generationName: "agent-llm" });
      _wrapped = true;
    } catch {
      _client = base;
    }
  } else {
    _client = base;
  }
  return _client;
}

export async function flushTracing(): Promise<void> {
  if (_wrapped && _client?.flushAsync) {
    try {
      await _client.flushAsync();
    } catch {
      /* tracing is best-effort */
    }
  }
}

export async function complete(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<{ message: LlmMessage; usage: Usage }> {
  const resp = await getClient().chat.completions.create({
    model: MODEL,
    messages,
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.2,
  });
  const message = resp.choices[0].message as unknown as LlmMessage;
  const u = resp.usage;
  return {
    message,
    usage: {
      prompt_tokens: u?.prompt_tokens ?? 0,
      completion_tokens: u?.completion_tokens ?? 0,
      cost_usd: costUsd(MODEL, u?.prompt_tokens ?? 0, u?.completion_tokens ?? 0),
    },
  };
}

// --------------------------------------------------------------------------
// MOCK brain — mirrors the real tool-calling decisions, offline & deterministic
// --------------------------------------------------------------------------
const KB_KEYWORDS = [
  "refund", "policy", "cancel", "hour", "open", "close", "price", "cost",
  "rate", "pricing", "location", "address", "where", "amenit", "spa", "pool",
  "gym", "wifi", "wi-fi", "parking", "valet", "pet", "dog", "breakfast",
  "dining", "restaurant", "bar", "airport", "shuttle", "check-in", "check in",
  "checkout", "check-out", "check out", "deposit", "tax", "how much", "room",
];
const BOOK_KEYWORDS = [
  "book", "reserve", "reservation", "stay", "available", "availability",
  "vacancy", "vacancies", "nights", "a room for", "check in on", "arrive",
];
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const NAME_RE = /(?:i'?m|my name is|this is|i am|name'?s)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
const DATE_RE =
  /(next\s+\w+|this\s+\w+|tomorrow|today|mon|tue|wed|thu|fri|sat|sun|\d{4}-\d{2}-\d{2}|\b\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i;
const MOCK_USAGE: Usage = { prompt_tokens: 220, completion_tokens: 40, cost_usd: 0 };

let _mockSeq = 0;
function mkCall(name: string, args: Record<string, unknown>): ToolCall {
  _mockSeq += 1;
  return { id: `call_mock_${_mockSeq}`, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

export function mockComplete(
  userText: string,
  results: Record<string, any>
): { message: LlmMessage; usage: Usage } {
  const lower = userText.toLowerCase();
  const wantsInfo = KB_KEYWORDS.some((k) => lower.includes(k));
  // Booking intent: an explicit verb, OR mentioning a room/stay together with a
  // date (e.g. "do you have a room next Friday?").
  const mentionsRoom = /\b(room|rooms|stay|night|suite)\b/.test(lower);
  const wantsBooking =
    BOOK_KEYWORDS.some((k) => lower.includes(k)) || (mentionsRoom && DATE_RE.test(userText));

  // Step 1: nothing gathered yet -> fan out the read-only tools.
  if (Object.keys(results).length === 0) {
    const calls: ToolCall[] = [];
    if (wantsInfo || !wantsBooking) {
      calls.push(mkCall("search_hotel_info", { query: userText.trim().slice(0, 200) }));
    }
    if (wantsBooking) {
      const m = DATE_RE.exec(userText);
      calls.push(mkCall("check_availability", { date: m ? m[0] : "this week" }));
    }
    return { message: { role: "assistant", content: null, tool_calls: calls }, usage: MOCK_USAGE };
  }

  // Step 2: act, ask, or finalize.
  const emailM = userText.match(EMAIL_RE);
  const email = emailM ? emailM[0] : null;
  const nameM = userText.match(NAME_RE);
  let name = nameM ? nameM[1] : null;
  if (name) {
    name = name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).join(" ") || null;
  }

  const avail = results["check_availability"];
  const booked = "reserve_room" in results;

  if (wantsBooking && avail && avail.slots?.length && email && !booked) {
    const slot = avail.slots[0].id;
    const calls = [
      mkCall("reserve_room", { slot, name: name || "Guest", email }),
      mkCall("save_guest", {
        name: name || "Guest",
        email,
        notes: `Reserved ${slot}. Asked: ${userText.trim().slice(0, 120)}`,
      }),
    ];
    return { message: { role: "assistant", content: null, tool_calls: calls }, usage: MOCK_USAGE };
  }

  return {
    message: { role: "assistant", content: composeAnswer(results, wantsBooking, email) },
    usage: MOCK_USAGE,
  };
}

function composeAnswer(results: Record<string, any>, wantsBooking: boolean, email: string | null): string {
  const parts: string[] = [];

  const kb = results["search_hotel_info"];
  if (kb && kb.results?.length) {
    const top = kb.results[0];
    parts.push(`${top.text}\n\n_— Source: ${top.source}_`);
  }

  const book = results["reserve_room"];
  if (book && book.status === "confirmed") {
    parts.push(
      `Your room is reserved for **${book.slot_label}**. A confirmation was sent to ${book.email} (reservation #${book.confirmation}). We look forward to welcoming you to The Aurelia.`
    );
  } else if (wantsBooking && !email) {
    const avail = results["check_availability"] || {};
    const slots = avail.slots || [];
    if (slots.length) {
      const listed = slots.slice(0, 4).map((s: any) => `- ${s.label}`).join("\n");
      parts.push(
        `We have availability ${avail.date_label || "soon"}:\n${listed}\n\nTo confirm your reservation, may I have your **name and email**?`
      );
    }
  }

  return parts.length
    ? parts.join("\n\n")
    : "I can help with rooms & rates, amenities, dining, our cancellation policy, and reserving a room. How may I assist you?";
}
