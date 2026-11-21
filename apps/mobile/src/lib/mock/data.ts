import type { Attraction, FlightOffer, GeoSuggestion, Stay, Trip } from '@wayfinder/shared';

export const AIRPORTS: GeoSuggestion[] = [
  { code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' },
  { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris' },
  { code: 'ORY', name: 'Orly Airport', city: 'Paris' },
  { code: 'LHR', name: 'Heathrow Airport', city: 'London' },
  { code: 'LGW', name: 'Gatwick Airport', city: 'London' },
  { code: 'FCO', name: 'Leonardo da Vinci Airport', city: 'Rome' },
  { code: 'JFK', name: 'John F. Kennedy Airport', city: 'New York' },
  { code: 'ATH', name: 'Athens International Airport', city: 'Athens' },
];

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const TEMPLATES = [
  { airline: 'El Al', flight: 'LY 325', depart: 8 * 60 + 15, duration: 310, stops: 0, price: 226, group: 'best' },
  { airline: 'Air France', flight: 'AF 1621', depart: 11 * 60 + 40, duration: 315, stops: 0, price: 248, group: 'best' },
  { airline: 'Wizz Air', flight: 'W6 3401', depart: 6 * 60 + 5, duration: 320, stops: 0, price: 189, group: 'best' },
  { airline: 'Aegean', flight: 'A3 903', depart: 13 * 60 + 25, duration: 485, stops: 1, price: 171, group: 'other' },
  { airline: 'Lufthansa', flight: 'LH 689', depart: 16 * 60 + 50, duration: 540, stops: 1, price: 205, group: 'other' },
  { airline: 'Turkish Airlines', flight: 'TK 789', depart: 20 * 60 + 10, duration: 610, stops: 1, price: 163, group: 'other' },
] as const;

export const buildFlights = (from: string, to: string, date: string, adults: number): FlightOffer[] =>
  TEMPLATES.map((t, i) => {
    const arrive = t.depart + t.duration;
    return {
      id: `${from}-${to}-${date}-${i}`,
      group: t.group,
      price: t.price * adults,
      currency: 'USD',
      airline: t.airline,
      totalDurationMin: t.duration,
      stops: t.stops,
      legs: [
        { fromCode: from, toCode: to, departTime: `${date} ${hhmm(t.depart)}`, arriveTime: `${date} ${hhmm(arrive)}`, airline: t.airline, flightNumber: t.flight, durationMin: t.duration },
      ],
      layovers: t.stops ? [{ code: 'ATH', name: 'Athens International Airport', durationMin: 120 }] : [],
      emissions: { grams: 250_000 + i * 12_000, typicalGrams: 309_000, diffPercent: -19 + i * 5 },
      handoffUrl: `https://example.com/mock-handoff?offer=${i}`,
    };
  });

const RAW_STAYS = [
  { id: 's1', name: 'Hotel Eden', rating: 8.9, ratingLabel: 'Excellent', distance: '1.2 km from centre', pricePerNight: 540, currency: 'ILS', mapX: 30, mapY: 35, amenities: ['Wi-Fi', 'Breakfast', 'Pool'], dealUrl: 'https://example.com/mock-stay?id=s1' },
  { id: 's2', name: 'Casa Rossa', rating: 8.4, ratingLabel: 'Very good', distance: '0.4 km from centre', pricePerNight: 610, currency: 'ILS', mapX: 55, mapY: 50, amenities: ['Wi-Fi', 'Free cancellation'], dealUrl: 'https://example.com/mock-stay?id=s2' },
  { id: 's3', name: 'Harbour View Suites', rating: 9.2, ratingLabel: 'Superb', distance: '2.0 km from centre', pricePerNight: 780, currency: 'ILS', mapX: 72, mapY: 28, amenities: ['Wi-Fi', 'Pool', 'Gym', 'Breakfast'], dealUrl: 'https://example.com/mock-stay?id=s3' },
  { id: 's4', name: 'Urban Nest Hostel', rating: 7.8, ratingLabel: 'Good', distance: '0.8 km from centre', pricePerNight: 190, currency: 'ILS', mapX: 40, mapY: 68, amenities: ['Wi-Fi'], dealUrl: 'https://example.com/mock-stay?id=s4' },
  { id: 's5', name: 'Grand Plaza', rating: 8.7, ratingLabel: 'Excellent', distance: '0.1 km from centre', pricePerNight: 920, currency: 'ILS', mapX: 62, mapY: 72, amenities: ['Wi-Fi', 'Spa', 'Gym', 'Free cancellation'], dealUrl: 'https://example.com/mock-stay?id=s5' },
];

// Rome-ish coordinates derived from the placeholder map position; the other new fields use plausible defaults.
export const STAYS: Stay[] = RAW_STAYS.map((s) => ({
  type: 'hotel',
  stars: 4,
  reviewCount: 900,
  totalPrice: s.pricePerNight * 4,
  thumbnail: null,
  deal: null,
  lat: 41.85 + s.mapY / 500,
  lng: 12.4 + s.mapX / 500,
  ...s,
}));

export const ATTRACTIONS: Attraction[] = [
  { id: 'a1', name: 'Colosseum', category: 'Landmark', rating: 4.7, reviews: '12k', blurb: 'Ancient amphitheatre in the heart of Rome. Book a timed entry to skip the line.', hours: 'Daily 08:30-19:00' },
  { id: 'a2', name: 'Vatican Museums', category: 'Museum', rating: 4.6, reviews: '28k', blurb: 'Home of the Sistine Chapel and one of the largest art collections in the world.', hours: 'Mon-Sat 09:00-18:00' },
  { id: 'a3', name: 'Trevi Fountain', category: 'Landmark', rating: 4.8, reviews: '41k', blurb: 'The famous baroque fountain. Visit early or late to avoid the crowds.', hours: 'Always open' },
  { id: 'a4', name: 'Trastevere Food Tour', category: 'Tour', rating: 4.9, reviews: '3k', blurb: 'Three hours of tastings through Rome\'s most charming neighbourhood.', hours: 'Daily 17:00' },
  { id: 'a5', name: 'Da Enzo al 29', category: 'Restaurant', rating: 4.5, reviews: '9k', blurb: 'Classic Roman trattoria known for carbonara and cacio e pepe.', hours: 'Tue-Sun 12:30-23:00' },
];

export const TRIPS: Trip[] = [
  {
    id: 't1', name: 'Rome getaway', dates: '12 Dec - 15 Dec', itemCount: 5,
    days: [
      { label: 'Day 1', stops: [{ time: '09:00', title: 'Colosseum', meta: 'Landmark · 2h · Timed entry' }, { time: '13:00', title: 'Da Enzo al 29', meta: 'Restaurant · 1h 30m' }, { time: '16:00', title: 'Trevi Fountain', meta: 'Landmark · 45m' }] },
      { label: 'Day 2', stops: [{ time: '09:30', title: 'Vatican Museums', meta: 'Museum · 3h' }, { time: '17:00', title: 'Trastevere Food Tour', meta: 'Tour · 3h' }] },
      { label: 'Day 3', stops: [] },
    ],
  },
  { id: 't2', name: 'Paris weekend', dates: '4 Mar - 7 Mar', itemCount: 2, days: [{ label: 'Day 1', stops: [{ time: '10:00', title: 'Louvre', meta: 'Museum · 3h' }] }] },
];
