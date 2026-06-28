"use client";

import { useEffect, useRef, useState } from "react";

interface Step {
  tool: string;
  args: Record<string, unknown>;
  result: any;
}
interface Turn {
  role: "user" | "assistant";
  content: string;
}
interface AgentResult {
  reply: string;
  trace: Step[];
  iterations: number;
  usage: { prompt_tokens: number; completion_tokens: number; cost_usd: number };
  mock: boolean;
}

const ICON: Record<string, string> = {
  search_hotel_info: "fa-solid fa-magnifying-glass",
  check_availability: "fa-solid fa-calendar-day",
  reserve_room: "fa-solid fa-bell-concierge",
  save_guest: "fa-solid fa-address-card",
};

const EXAMPLES = [
  "Do you have a room next Friday? And what's your cancellation policy?",
  "What are your room rates, and is breakfast included?",
  "Tell me about the spa, pool and dining. Are you pet-friendly?",
  "I'd like to reserve a room for Friday — I'm Jane Doe, jane@acme.com",
];

// Tiny, safe markdown: escape, then **bold** / _italic_ / newlines.
function md(text: string): { __html: string } {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = esc
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
  return { __html: html };
}

function summarize(tool: string, r: any): string {
  if (!r || typeof r !== "object") return String(r);
  if (tool === "search_hotel_info") {
    const rs = r.results || [];
    return rs.length ? `top hit: ${rs[0].source} (score ${rs[0].score})` : "no matching docs";
  }
  if (tool === "check_availability") {
    const s = r.slots || [];
    return `${s.length} night(s) open: ${s.slice(0, 3).map((x: any) => x.label).join(", ")}`;
  }
  if (tool === "reserve_room") {
    return r.status === "confirmed" ? `reserved ${r.slot_label} → #${r.confirmation}` : r.message;
  }
  if (tool === "save_guest") {
    return r.status === "saved" ? `saved guest #${r.guest_id} (${r.email})` : r.message;
  }
  return JSON.stringify(r);
}

export default function Home() {
  const [status, setStatus] = useState<{ mock: boolean; langfuse: boolean; model: string } | null>(null);
  const [chat, setChat] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"chat" | "crm">("chat");
  const [last, setLast] = useState<AgentResult | null>(null);
  const [allSteps, setAllSteps] = useState<Step[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ mock: true, langfuse: false, model: "gpt-4o-mini" }));
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo(0, scroller.current.scrollHeight);
  }, [chat, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    const history = chat;
    setChat([...history, { role: "user", content: message }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data: AgentResult & { error?: string } = await res.json();
      if (data.error) throw new Error(data.error);
      setChat((c) => [...c, { role: "assistant", content: data.reply }]);
      setLast(data);
      setAllSteps((s) => [...s, ...data.trace]);
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setChat([]);
    setLast(null);
    setAllSteps([]);
  }

  const reservations = allSteps.filter((s) => s.tool === "reserve_room" && s.result?.status === "confirmed");
  const guests = allSteps.filter((s) => s.tool === "save_guest" && s.result?.status === "saved");

  return (
    <div className="wrap">
      <div className="hero">
        <div className="eyebrow">Est. 1924 · On the Bay</div>
        <h1 className="brand">
          The Aurelia <span className="amp">Grand Hotel</span> &amp; Spa
        </h1>
        <div className="rule">
          <i className="fa-solid fa-gem" />
        </div>
        <p className="tagline">
          Your personal concierge — ask about rooms, rates, the spa &amp; dining, or reserve a room.
          This AI books, checks availability and follows up by calling real tools.
        </p>
        <div className="badges">
          {status && (
            <span className={`badge ${status.mock ? "mock" : "live"}`}>
              {status.mock ? "Demo mode (no API key)" : "Live · OpenAI"}
            </span>
          )}
          {status && <span className="badge">model: {status.model}</span>}
          {status && <span className="badge">{status.langfuse ? "Langfuse tracing on" : "Langfuse off"}</span>}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
          Concierge
        </button>
        <button className={`tab ${tab === "crm" ? "active" : ""}`} onClick={() => setTab("crm")}>
          Reservations ({reservations.length + guests.length})
        </button>
      </div>

      {tab === "chat" ? (
        <div className="grid">
          <div className="card chat">
            <div className="messages" ref={scroller}>
              {chat.length === 0 && (
                <div className="empty">Good day — how may I help with your stay at The Aurelia?</div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`msg ${m.role === "user" ? "user" : "bot"}`}>
                  <div className="bubble" dangerouslySetInnerHTML={md(m.content)} />
                </div>
              ))}
              {loading && (
                <div className="msg bot">
                  <div className="bubble typing">the concierge is checking…</div>
                </div>
              )}
            </div>
            <div className="composer">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Ask the concierge…"
                autoFocus
              />
              <button className="send" onClick={() => send(input)} disabled={loading}>
                Send
              </button>
              <button className="reset" onClick={reset}>
                Reset
              </button>
            </div>
            <div className="examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="chip" onClick={() => send(ex)} disabled={loading}>
                  {ex.length > 46 ? ex.slice(0, 44) + "…" : ex}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Concierge actions</h3>
            {last ? (
              <>
                <div className="kpis">
                  <span className="kpi">iterations: {last.iterations}</span>
                  <span className="kpi">prompt tok: {last.usage.prompt_tokens}</span>
                  <span className="kpi">completion tok: {last.usage.completion_tokens}</span>
                  <span className="kpi">cost: ${last.usage.cost_usd.toFixed(5)}</span>
                </div>
                {last.trace.length === 0 ? (
                  <div className="empty">No tools called — answered directly.</div>
                ) : (
                  last.trace.map((s, i) => (
                    <div className="tcard" key={i}>
                      <div className="ttool">
                        <span className="tnum">{i + 1}.</span>
                        <i className={ICON[s.tool] || "fa-solid fa-screwdriver-wrench"} /> {s.tool}
                      </div>
                      <div className="targs">
                        {Object.entries(s.args)
                          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                          .join(", ") || "—"}
                      </div>
                      <div className="tres">↳ {summarize(s.tool, s.result)}</div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div className="empty">Send a message to watch the concierge call its tools.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="crmhead"><i className="fa-solid fa-bell-concierge" />Reservations ({reservations.length})</div>
          {reservations.length === 0 ? (
            <div className="empty">— no reservations yet —</div>
          ) : (
            <table className="crm">
              <thead>
                <tr>
                  <th>confirmation</th>
                  <th>date</th>
                  <th>name</th>
                  <th>email</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((b, i) => (
                  <tr key={i}>
                    <td>{b.result.confirmation}</td>
                    <td>{b.result.slot_label}</td>
                    <td>{b.result.name}</td>
                    <td>{b.result.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="crmhead"><i className="fa-solid fa-address-card" />Guests ({guests.length})</div>
          {guests.length === 0 ? (
            <div className="empty">— no guests yet —</div>
          ) : (
            <table className="crm">
              <thead>
                <tr>
                  <th>#</th>
                  <th>name</th>
                  <th>email</th>
                  <th>notes</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((l, i) => (
                  <tr key={i}>
                    <td>{l.result.guest_id}</td>
                    <td>{l.result.name}</td>
                    <td>{l.result.email}</td>
                    <td>{String(l.args.notes || "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="footer">
        The Aurelia is a fictional demo hotel · Built with Next.js + OpenAI function calling · Runs in mock mode with no API key.
      </div>
    </div>
  );
}
