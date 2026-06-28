// Lexical retrieval over the embedded company docs. Scored by how many distinct
// query concepts a chunk covers (term or synonym), with a title-relevance bonus
// to break ties and a small phrase bonus. Dependency-free and deterministic —
// swap for an embedding store and the search() contract is unchanged.
import { KB_DOCS } from "@/data/kb";

export interface KbResult {
  source: string;
  text: string;
  score: number;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "is", "are", "for", "in", "on",
  "what", "your", "you", "do", "does", "i", "we", "with", "can", "my", "me",
  "how", "it", "at", "be", "this", "that", "if",
]);

// Query-side synonyms: a question term is "covered" if the chunk has the term
// OR one of these. Bridges "where"/"how much" to "location"/"$120".
const SYNONYMS: Record<string, string[]> = {
  where: ["location", "address", "office"],
  located: ["location", "address", "office"],
  location: ["address", "office"],
  hour: ["open", "close", "time"],
  open: ["hour", "time"],
  much: ["cost", "price", "fee", "pricing"],
  cost: ["price", "fee", "pricing", "much"],
  price: ["cost", "fee", "pricing", "much"],
  pricing: ["cost", "price", "fee"],
  fee: ["cost", "price"],
  refund: ["money", "deposit", "back"],
  cancel: ["cancellation", "no-show", "refund"],
  room: ["rooms", "suite", "king", "deluxe", "penthouse"],
  rate: ["rates", "price", "cost", "night", "deposit"],
  stay: ["night", "check-in", "room"],
  parking: ["valet", "car"],
  pet: ["pets", "dog", "dogs"],
  pool: ["rooftop", "swim", "infinity"],
  spa: ["wellness", "treatment", "massage"],
  gym: ["fitness", "center"],
  wifi: ["wi-fi", "internet"],
  breakfast: ["dining", "lumiere", "restaurant"],
  dining: ["restaurant", "lumiere", "bar", "breakfast"],
  restaurant: ["dining", "lumiere", "bar"],
  airport: ["shuttle", "transfer", "transport"],
  shuttle: ["airport", "transfer"],
  checkin: ["check-in", "arrival"],
  checkout: ["check-out", "departure"],
  amenit: ["pool", "spa", "gym", "wifi"],
};

function norm(w: string): string {
  return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
}

function tokens(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  return words.filter((w) => !STOP.has(w)).map(norm);
}

interface Chunk {
  source: string;
  text: string;
  body: string[];
  terms: Set<string>;
  titleTerms: Set<string>;
}

let CHUNKS: Chunk[] | null = null;

function chunks(): Chunk[] {
  if (CHUNKS) return CHUNKS;
  const out: Chunk[] = [];
  for (const doc of KB_DOCS) {
    const titleTerms = new Set(tokens(doc.title));
    for (const para of doc.body.split(/\n\s*\n/)) {
      const text = para.trim();
      if (!text) continue;
      const body = tokens(text);
      out.push({
        source: doc.source,
        text,
        body,
        terms: new Set([...body, ...titleTerms]),
        titleTerms,
      });
    }
  }
  CHUNKS = out;
  return out;
}

function covers(term: string, terms: Set<string>): boolean {
  if (terms.has(term)) return true;
  return (SYNONYMS[term] || []).some((s) => terms.has(s));
}

export function search(query: string, k = 3): { query: string; results: KbResult[] } {
  const q = tokens(query);
  const qSet = new Set(q);
  if (qSet.size === 0) return { query, results: [] };

  const scored: { score: number; ch: Chunk }[] = [];
  for (const ch of chunks()) {
    let covered = 0;
    qSet.forEach((t) => {
      if (covers(t, ch.terms)) covered++;
    });
    if (!covered) continue;

    let score = covered / qSet.size;
    let titleCover = 0;
    qSet.forEach((t) => {
      if (covers(t, ch.titleTerms)) titleCover++;
    });
    score += (0.4 * titleCover) / qSet.size;

    const joined = ch.body.join(" ");
    for (let i = 0; i < q.length - 1; i++) {
      if (joined.includes(`${q[i]} ${q[i + 1]}`)) score += 0.3;
    }
    scored.push({ score, ch });
  }

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, k).map(({ score, ch }) => ({
    source: ch.source,
    text: ch.text,
    score: Math.round(score * 1000) / 1000,
  }));
  return { query, results };
}
