// The four tools the agent can call: implementations, OpenAI JSON schemas, and
// the dispatch map. Each takes plain args (parsed from the model's JSON) and
// returns a JSON-serializable result fed back into the loop.
import OpenAI from "openai";

import { addLead, claimSlot, openSlots, slotWeekday } from "@/lib/db";
import { search } from "@/lib/kb";

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thurs: 4, thursday: 4, fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
const WD_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function search_knowledge_base({ query }: { query?: string }) {
  if (!query || !query.trim()) return { results: [], note: "empty query" };
  return search(query, 3);
}

export function check_availability({ date }: { date?: string }) {
  const slots = openSlots(12);
  const lower = (date || "").toLowerCase();
  let wanted: number | null = null;
  for (const [word, day] of Object.entries(WEEKDAYS)) {
    if (lower.includes(word)) {
      wanted = day;
      break;
    }
  }
  if (wanted !== null) {
    const filt = slots.filter((s) => slotWeekday(s.id) === wanted);
    if (filt.length) {
      return { date_label: `this/next ${WD_FULL[wanted]}`, slots: filt.slice(0, 4) };
    }
  }
  return { date_label: (date || "").trim() || "the next few days", slots: slots.slice(0, 4) };
}

export function book_appointment({ slot, name, email }: { slot?: string; name?: string; email?: string }) {
  if (!slot || !name || !email) {
    return { status: "error", message: "slot, name and email are all required to book." };
  }
  return claimSlot(slot, name, email);
}

export function log_lead({ name, email, notes }: { name?: string; email?: string; notes?: string }) {
  if (!email) return { status: "error", message: "email is required to log a lead." };
  return addLead(name || "Unknown", email, notes || "");
}

export const DISPATCH: Record<string, (args: any) => any> = {
  search_knowledge_base,
  check_availability,
  book_appointment,
  log_lead,
};

export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description:
        "Search the company knowledge base (services, pricing, hours, location, refund/cancellation policy) and return cited snippets. Use this for ANY factual question about the business, then answer citing the source.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The user's question or topic." } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Return open consultation slots. Pass the user's requested day in natural language (e.g. 'next Tuesday') if they gave one.",
      parameters: {
        type: "object",
        properties: { date: { type: "string", description: "Requested day, free text. Optional." } },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Book a consultation into a specific open slot. Only call this once you have a slot id from check_availability AND the person's name and email.",
      parameters: {
        type: "object",
        properties: {
          slot: { type: "string", description: "Slot id from check_availability." },
          name: { type: "string", description: "Person's full name." },
          email: { type: "string", description: "Person's email address." },
        },
        required: ["slot", "name", "email"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_lead",
      description:
        "Save a contact to the CRM. Call this whenever you have a name and email, even if they did not book, so the business can follow up.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Person's name." },
          email: { type: "string", description: "Person's email address." },
          notes: { type: "string", description: "Context: what they asked for." },
        },
        required: ["name", "email"],
        additionalProperties: false,
      },
    },
  },
];
