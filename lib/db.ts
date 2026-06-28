// In-memory reservation ledger + availability calendar. On Vercel's serverless
// runtime this state is per-instance and resets on cold start — fine for a demo.
// The UI also rebuilds the reservations view from the tool-call trace, so nothing
// is lost visually. Swap this for a real PMS/database; the tool contracts in
// lib/tools.ts do not change.

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface Slot {
  id: string; // YYYY-MM-DD (a check-in date / available night)
  label: string; // e.g. "Tue, Jun 30"
}

interface Reservation {
  confirmation: string;
  slot_id: string;
  name: string;
  email: string;
}
interface Guest {
  id: number;
  name: string;
  email: string;
  notes: string;
}

const taken = new Set<string>();
const reservations: Reservation[] = [];
const guests: Guest[] = [];
let guestSeq = 0;

let SLOTS: Slot[] | null = null;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function allSlots(): Slot[] {
  if (SLOTS) return SLOTS;
  // Fixed anchor so the seeded availability is reproducible.
  const d = new Date(2026, 5, 28); // 2026-06-28
  const out: Slot[] = [];
  for (let i = 0; i < 14; i++) {
    d.setDate(d.getDate() + 1); // hotels operate every day, weekends included
    const id = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const label = `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`;
    out.push({ id, label });
  }
  SLOTS = out;
  return out;
}

export function openSlots(limit = 14): Slot[] {
  return allSlots()
    .filter((s) => !taken.has(s.id))
    .slice(0, limit);
}

export function slotWeekday(slotId: string): number {
  const [y, m, day] = slotId.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).getDay();
}

export function claimSlot(slot: string, name: string, email: string) {
  const found = allSlots().find((s) => s.id === slot);
  if (!found) return { status: "error", message: `Unknown date ${slot}.` };
  if (taken.has(slot)) return { status: "error", message: `${found.label} is fully booked.` };
  taken.add(slot);
  let h = 0;
  const key = slot + email;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
  const confirmation = `AUR-${String(h).padStart(5, "0")}`;
  reservations.push({ confirmation, slot_id: slot, name, email });
  return {
    status: "confirmed",
    confirmation,
    slot_id: slot,
    slot_label: found.label,
    name,
    email,
  };
}

export function addGuest(name: string, email: string, notes: string) {
  guestSeq += 1;
  guests.push({ id: guestSeq, name, email, notes });
  return { status: "saved", guest_id: guestSeq, name, email };
}
