// Company knowledge base, embedded as data so it bundles cleanly on Vercel
// (no filesystem reads at runtime). Each doc is split into paragraph chunks by
// the retriever in lib/kb.ts.

export interface KbDoc {
  source: string; // human label + slug, used as the citation
  title: string; // heading words are searchable (the word "hours" lives here)
  body: string; // paragraphs separated by blank lines
}

export const KB_DOCS: KbDoc[] = [
  {
    source: "Refund Policy (refund-policy)",
    title: "Refund and Cancellation Policy",
    body: `We offer a 14-day money-back guarantee on all consultation packages. If you are not satisfied within 14 days of your first session, email billing@luminastudio.example for a full refund — no questions asked.

Cancellations made more than 24 hours before a booked consultation are free and fully refundable. Cancellations made within 24 hours of the appointment are charged a 50% late-cancellation fee. No-shows are charged in full.

Refunds are processed back to the original payment method within 5–7 business days. Project work that has already been delivered is non-refundable.`,
  },
  {
    source: "Hours and Location (hours-and-location)",
    title: "Hours and Location",
    body: `Lumina Studio is open Monday to Friday, 9:00 AM – 6:00 PM, and Saturday 10:00 AM – 2:00 PM. We are closed on Sundays and public holidays.

Our office is at 220 Market Street, Suite 5, San Francisco, CA. Consultations can be held in person at the office or remotely over video call — let us know your preference when you book.

The fastest way to reach a human is hello@luminastudio.example. We typically reply within one business day.`,
  },
  {
    source: "Services and Pricing (services-and-pricing)",
    title: "Services and Pricing",
    body: `Lumina Studio helps small businesses with brand design, web design, and AI automation consulting.

A discovery consultation is a 45-minute session to scope your project. The consultation costs $120, fully credited toward any project you book with us.

A brand identity package — logo, color system, and brand guidelines — starts at $2,500. Website design and build starts at $4,000, typically 3–5 weeks. AI automation consulting (workflow automation, chatbots, internal tooling) is billed at $150/hour or fixed-bid per project.

We accept all major credit cards and bank transfer. A 50% deposit is required to start project work, with the balance due on delivery.`,
  },
  {
    source: "About (about)",
    title: "About Lumina Studio",
    body: `Lumina Studio is a small design and automation studio founded in 2021. We work with founders and small teams who want a polished brand and modern, automated operations without hiring a full in-house team.

Every engagement starts with a discovery consultation so we understand your goals before proposing scope. We work with clients worldwide and run most projects remotely.`,
  },
];
