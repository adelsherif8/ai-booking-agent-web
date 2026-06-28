// The four concierge tools the agent can call: implementations, OpenAI JSON
// schemas, and the dispatch map. Each takes plain args (parsed from the model's
// JSON) and returns a JSON-serializable result fed back into the loop.
import OpenAI from "openai";

import { addGuest, claimSlot, openSlots, slotWeekday } from "@/lib/db";
import { search } from "@/lib/kb";

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thurs: 4, thursday: 4, fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
const WD_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function search_hotel_info({ query }: { query?: string }) {
  if (!query || !query.trim()) return { results: [], note: "empty query" };
  return search(query, 3);
}

export function check_availability({ date }: { date?: string }) {
  const slots = openSlots(14);
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
  return { date_label: (date || "").trim() || "the coming nights", slots: slots.slice(0, 4) };
}

export function reserve_room({ slot, name, email }: { slot?: string; name?: string; email?: string }) {
  if (!slot || !name || !email) {
    return { status: "error", message: "a date, name and email are all required to reserve." };
  }
  return claimSlot(slot, name, email);
}

export function save_guest({ name, email, notes }: { name?: string; email?: string; notes?: string }) {
  if (!email) return { status: "error", message: "email is required to save a guest." };
  return addGuest(name || "Unknown", email, notes || "");
}

export const DISPATCH: Record<string, (args: any) => any> = {
  search_hotel_info,
  check_availability,
  reserve_room,
  save_guest,
};

export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_hotel_info",
      description:
        "Search the hotel knowledge base (rooms & rates, amenities, spa, dining, parking, pets, check-in/out, cancellation & refund policy, location) and return cited snippets. Use this for ANY factual question about the hotel, then answer citing the source.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The guest's question or topic." } },
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
        "Return available room nights (check-in dates). Pass the guest's requested day in natural language (e.g. 'next Friday') if they gave one.",
      parameters: {
        type: "object",
        properties: { date: { type: "string", description: "Requested arrival day, free text. Optional." } },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reserve_room",
      description:
        "Reserve a room for a specific available date. Only call this once you have a date from check_availability AND the guest's name and email.",
      parameters: {
        type: "object",
        properties: {
          slot: { type: "string", description: "Date id from check_availability (YYYY-MM-DD)." },
          name: { type: "string", description: "Guest's full name." },
          email: { type: "string", description: "Guest's email address." },
        },
        required: ["slot", "name", "email"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_guest",
      description:
        "Save a guest contact to the CRM. Call this whenever you have a name and email, even if they did not reserve, so the team can follow up.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Guest's name." },
          email: { type: "string", description: "Guest's email address." },
          notes: { type: "string", description: "Context: what they asked for." },
        },
        required: ["name", "email"],
        additionalProperties: false,
      },
    },
  },
];
