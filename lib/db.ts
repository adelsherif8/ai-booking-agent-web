// In-memory "CRM" + fake calendar. On Vercel's serverless runtime this state is
// per-instance and resets on cold start — fine for a demo. The UI also rebuilds
// the bookings/leads view from the tool-call trace, so nothing is lost visually.
// A real deployment swaps this for a database + calendar API; the tool contracts
// in lib/tools.ts do not change.

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SLOT_HOURS = [10, 13, 15];

export interface Slot {
  id: string;
  label: string;
}

interface Booking {
  confirmation: string;
  slot_id: string;
  name: string;
  email: string;
}
interface Lead {
  id: number;
  name: string;
  email: string;
  notes: string;
}

const taken = new Set<string>();
const bookings: Booking[] = [];
const leads: Lead[] = [];
let leadSeq = 0;

let SLOTS: Slot[] | null = null;

function fmt(d: Date, h: number): { id: string; label: string } {
  const id = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:00`;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const label = `${WEEKDAY[d.getDay()]} ${MONTH[d.getMonth()]} ${d.getDate()}, ${h12}:00 ${ampm}`;
  return { id, label };
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function allSlots(): Slot[] {
  if (SLOTS) return SLOTS;
  // Fixed anchor so the seeded calendar is reproducible.
  const d = new Date(2026, 5, 28); // 2026-06-28
  const out: Slot[] = [];
  let added = 0;
  while (added < 10) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
    for (const h of SLOT_HOURS) out.push(fmt(d, h));
    added++;
  }
  SLOTS = out;
  return out;
}

export function openSlots(limit = 12): Slot[] {
  return allSlots()
    .filter((s) => !taken.has(s.id))
    .slice(0, limit);
}

export function slotWeekday(slotId: string): number {
  // slotId = YYYY-MM-DDTHH:00
  const [y, m, day] = slotId.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).getDay();
}

export function claimSlot(slot: string, name: string, email: string) {
  const found = allSlots().find((s) => s.id === slot);
  if (!found) return { status: "error", message: `Unknown slot ${slot}.` };
  if (taken.has(slot)) return { status: "error", message: `Slot ${found.label} is already booked.` };
  taken.add(slot);
  let h = 0;
  const key = slot + email;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
  const confirmation = `LUM-${String(h).padStart(5, "0")}`;
  bookings.push({ confirmation, slot_id: slot, name, email });
  return {
    status: "confirmed",
    confirmation,
    slot_id: slot,
    slot_label: found.label,
    name,
    email,
  };
}

export function addLead(name: string, email: string, notes: string) {
  leadSeq += 1;
  leads.push({ id: leadSeq, name, email, notes });
  return { status: "saved", lead_id: leadSeq, name, email };
}
