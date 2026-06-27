# 🛎️ AI Booking Agent — Tool-Calling Front Desk (Next.js)

An LLM agent that **reads an inbound message and takes actions by calling
tools** — not just chatting. It answers questions from a company knowledge base
(with citations) *and* checks a calendar, books appointments, and writes leads
to a CRM, deciding for itself which tools to call. Built as a **Next.js app with
the agent loop in a serverless API route**, so it deploys to Vercel.

> **Demo**
> **User:** "Can I book a consultation next Tuesday? Also, what's your refund policy?"
> → `search_knowledge_base` + `check_availability` → cites the 14-day policy, lists Tuesday's slots, asks for name + email.
> **User:** "I'm Jane Doe, jane@acme.com"
> → `book_appointment` + `log_lead` → "✅ Booked Tue Jun 30, 10:00 AM (#LUM-01567)."

## What it demonstrates

Tool calling · autonomous agents · function-calling JSON schemas · RAG-as-a-tool ·
an agent loop with an iteration cap + argument validation · full-stack TypeScript ·
serverless deploy. Optional Langfuse tracing.

## The agent loop (the whole idea)

```
model decides which tool(s) to call ─► we execute them ─► feed results back ─► repeat
                                                                    └► until it answers (cap 6)
```

Lives in [`lib/agent.ts`](lib/agent.ts), called from the API route
[`app/api/chat/route.ts`](app/api/chat/route.ts). The model can request several
tools in one turn; each result is fed back as a `tool` message until it produces
a final reply.

## The 4 tools

| Tool | What it does |
| --- | --- |
| `search_knowledge_base(query)` | Lexical retrieval over company docs → ranked, **cited** snippet ([`lib/kb.ts`](lib/kb.ts)) |
| `check_availability(date)` | Open calendar slots, optionally filtered to a weekday |
| `book_appointment(slot, name, email)` | Claims a slot + returns a confirmation |
| `log_lead(name, email, notes)` | Writes the contact to the in-memory CRM |

Schemas + dispatch live in [`lib/tools.ts`](lib/tools.ts).

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

**Runs with no API key** in deterministic **MOCK mode** — same agent loop, an
offline brain decides the tool calls — so you can clone and demo it instantly.
For real tool-calling, add a key:

```bash
cp .env.example .env.local
# OPENAI_API_KEY=sk-...                  -> real gpt-4o-mini tool-calling
# LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET  -> optional, traces every tool call
```

## Deploy to Vercel

This is a standard Next.js app — push to GitHub and import in Vercel, or:

```bash
vercel --prod
```

Then add `OPENAI_API_KEY` in **Vercel → Project → Settings → Environment
Variables** for live mode. Without it, the deployed app still works in mock mode.

## Architecture

```
app/
├── page.tsx              # React chat UI + tool-trace panel + CRM tab
├── layout.tsx
├── globals.css
└── api/chat/route.ts     # POST -> runAgent(); GET -> {mock, langfuse, model}
lib/
├── agent.ts              # the tool-calling loop
├── llm.ts                # OpenAI client / optional Langfuse / offline mock brain
├── tools.ts              # 4 tool fns + JSON schemas + dispatch
├── kb.ts                 # retrieval (concept-coverage scoring, cited)
└── db.ts                 # in-memory calendar + CRM (ephemeral on serverless)
data/kb.ts                # the company docs the agent answers from
```

**Note on state:** the calendar/CRM is in-memory, so on Vercel's serverless
runtime it resets on cold start. The UI rebuilds the bookings/leads view from the
tool-call trace, so the demo stays coherent. Swap `lib/db.ts` for a real database
+ calendar API and the tool contracts don't change.
