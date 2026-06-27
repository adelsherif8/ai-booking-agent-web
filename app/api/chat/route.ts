import { NextRequest, NextResponse } from "next/server";

import { ChatTurn, runAgent } from "@/lib/agent";
import { flushTracing, LANGFUSE_ON, MOCK, MODEL } from "@/lib/llm";

// Node runtime (OpenAI SDK + in-memory state); never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ mock: MOCK, langfuse: LANGFUSE_ON, model: MODEL });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: unknown = body?.message;
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "A non-empty 'message' is required." }, { status: 400 });
    }
    const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];
    const result = await runAgent(message, history);
    await flushTracing();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "agent error" }, { status: 500 });
  }
}
