// Knowledge base for The Aurelia Grand Hotel & Spa, embedded as data so it
// bundles cleanly on Vercel. Each doc is split into paragraph chunks by the
// retriever in lib/kb.ts.

export interface KbDoc {
  source: string; // citation label
  title: string; // heading words are searchable
  body: string; // paragraphs separated by blank lines
}

export const KB_DOCS: KbDoc[] = [
  {
    source: "Rooms & Rates",
    title: "Rooms and Rates",
    body: `The Aurelia offers 180 rooms and suites overlooking the bay. The Deluxe King starts at $280 per night, the Executive Suite at $450 per night, and the Aurelia Penthouse Suite at $900 per night.

Every rate includes breakfast for two at Lumière, welcome champagne, and full access to the rooftop infinity pool and spa. Rates are quoted per room, per night, and exclude 12% city tax.

Children under 12 stay free in a parent's room. An extra bed can be added to most rooms for $60 per night on request.`,
  },
  {
    source: "Reservations & Cancellation Policy",
    title: "Reservations Cancellation and Refund Policy",
    body: `Check-in is from 3:00 PM and check-out is by 11:00 AM. Early check-in and late check-out can be arranged with the concierge, subject to availability.

A deposit equal to the first night is taken at the time of booking. Reservations may be cancelled free of charge up to 48 hours before arrival for a full refund of the deposit.

Cancellations within 48 hours of arrival, or no-shows, are charged for the first night. Refunds are returned to the original payment method within 5–7 business days.`,
  },
  {
    source: "Amenities & Dining",
    title: "Amenities Spa Pool and Dining",
    body: `Guests enjoy a rooftop infinity pool, the two-floor Aurelia Spa, a 24-hour fitness center, and complimentary high-speed Wi-Fi throughout the hotel.

Lumière, our Michelin-starred restaurant, serves breakfast, lunch, and dinner from 6:30 AM to 10:30 PM. The rooftop Sky Bar is open from 4:00 PM until late.

Valet parking is $45 per night. The hotel is pet-friendly for dogs under 15kg, with a $50 per-stay cleaning fee. A 24-hour concierge can arrange spa treatments, dining, and tickets.`,
  },
  {
    source: "Location & Getting Here",
    title: "Location and Getting Here",
    body: `The Aurelia Grand Hotel & Spa is at 1 Marine Parade, on the waterfront overlooking the bay, a five-minute walk from the old town and the marina.

We are 20 minutes from the international airport. A complimentary chauffeured airport shuttle runs on the hour; private transfers can be booked through the concierge.

For reservations and enquiries, email reservations@aurelia-hotel.example or call the front desk, staffed 24 hours a day.`,
  },
  {
    source: "About The Aurelia",
    title: "About The Aurelia Grand Hotel",
    body: `The Aurelia is a five-star landmark that has welcomed guests on the bay since 1924. Restored in 2019, it blends its original Art Deco grandeur with modern comfort.

From the marble lobby to the rooftop pool, every detail is designed for a memorable stay. Our concierge team is here around the clock to make your visit effortless.`,
  },
];
