import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const appAsset = (path) => `${import.meta.env.BASE_URL}${path}`;

const mapSearchUrl = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const paidPlanNames = new Set(["Featured", "Premium"]);

const lobbyAboutRotationMs = 2000;
const featuredPromotionRotationMs = 3000;
const premiumPromotionRotationMs = 5000;
const abileneWeatherLabel = "Abilene, TX";
const abileneWeatherStation = "KABI";
const abileneWeatherRefreshMs = 10 * 60 * 1000;
const abileneWeatherMaxAgeMs = 2 * 60 * 60 * 1000;
const abileneWeatherObservationUrl =
  `https://api.weather.gov/stations/${abileneWeatherStation}/observations/latest?require_qc=false`;

const contactEmail = "abilenevibes@gmail.com";

const getAbileneIsDay = () => {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );

  return hour >= 7 && hour < 20;
};

const formatPaymentAmount = (amount, currency = "usd") => {
  const value = Number(amount ?? 0) / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
  }).format(value);
};

const openCheckoutUrl = (url) => {
  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    window.location.assign(url);
  }
};

const cleanEnvValue = (value, variableName) => {
  const assignmentPrefix = `${variableName}=`;
  let cleanValue = String(value ?? "").trim().replace(/^["']|["']$/g, "");

  if (cleanValue.startsWith(assignmentPrefix)) {
    cleanValue = cleanValue.slice(assignmentPrefix.length).trim();
  }

  return cleanValue;
};

const normalizeSupabaseUrl = (value) => {
  const cleanValue = cleanEnvValue(value, "VITE_SUPABASE_URL")
    .replace(/^Value\s*/i, "")
    .replace(/^https\/\//, "https://");
  const urlCandidate = cleanValue.match(/https?:\/\/\S+/)?.[0] ?? cleanValue;

  try {
    const url = new URL(urlCandidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
};

const createSupabaseClient = () => {
  const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
  const anonKey =
    cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY").match(/sb_publishable_\S+/)?.[0] ??
    cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    return null;
  }

  try {
    return createClient(url, anonKey, {
      auth: { persistSession: false },
    });
  } catch {
    return null;
  }
};

const supabase = createSupabaseClient();

const validPages = new Set([
  "home",
  "lobby",
  "events",
  "more",
  "news",
  "calendar",
  "shopping",
  "nightlife",
  "eats",
  "family",
  "hotels",
  "gallery",
  "promote",
  "directory",
  "groceries",
  "dealers",
  "barbers",
  "insurance",
  "health",
  "schools",
  "terms",
  "privacy",
  "admin",
  "rentals",
  "rental-detail",
  "post-rental",
]);

const pageFromLocation = () => {
  const hashPage = window.location.hash.replace("#", "").split("?")[0].split("/")[0];
  const queryPage = new URLSearchParams(window.location.search).get("page");

  if (validPages.has(hashPage)) {
    return hashPage;
  }

  return validPages.has(queryPage) ? queryPage : "home";
};

const checkoutResultFromLocation = () => {
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(hashQuery || window.location.search).get("checkout") ?? "";
};

const urlForPage = (nextPage) => {
  if (nextPage === "home") {
    return `${window.location.pathname}${window.location.search}`;
  }

  return `#${nextPage}`;
};

const events = [];

const staticEventKey = (event) => `event:${event.title}-${event.date}`;

const eventMonthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatEventDate = (value) => {
  const cleanValue = String(value ?? "").trim();
  const dateParts = cleanValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!dateParts) {
    return cleanValue;
  }

  const monthIndex = Number(dateParts[2]) - 1;
  const day = Number(dateParts[3]);

  if (!eventMonthNames[monthIndex] || !day) {
    return cleanValue;
  }

  return `${eventMonthNames[monthIndex]} ${day}, ${dateParts[1]}`;
};

const eventDateInputValue = (value) => {
  const cleanValue = String(value ?? "").trim();

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanValue)) {
    return cleanValue;
  }

  const displayParts = cleanValue.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);

  if (!displayParts) {
    return cleanValue;
  }

  const monthIndex = eventMonthNames.findIndex((monthName) => monthName.toLowerCase() === displayParts[1].toLowerCase());

  if (monthIndex === -1) {
    return cleanValue;
  }

  return `${displayParts[3]}-${String(monthIndex + 1).padStart(2, "0")}-${String(Number(displayParts[2])).padStart(2, "0")}`;
};

const formatEventTime = (value) => {
  const cleanValue = String(value ?? "").trim();
  const timeParts = cleanValue.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);

  if (!timeParts) {
    return cleanValue;
  }

  return `${Number(timeParts[1])}:${timeParts[2] ?? "00"} ${timeParts[3].toUpperCase()}M`;
};

const formatEventDisplayDate = (date, time) => {
  const formattedDate = formatEventDate(date);
  const formattedTime = formatEventTime(time);

  return formattedTime ? `${formattedDate} - ${formattedTime}` : formattedDate;
};

const formatEventScheduleLine = (date, time) => {
  const formattedDate = formatEventDate(date);
  const formattedTime = formatEventTime(time);

  return formattedTime ? `${formattedDate} - ${formattedTime}` : formattedDate;
};

const localDateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const abileneMinuteValue = (date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );

  return Number(`${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`);
};

const publicEventEndValue = (event) => {
  const endDate = event.end_date || event.endDate || event.event_date || event.eventDate;
  const endTime = event.end_time || event.endTime || event.event_time || event.eventTime;
  const dateParts = String(endDate ?? "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const timeParts = formatEventTime(endTime).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (!dateParts || !timeParts) {
    return null;
  }

  const hour = (Number(timeParts[1]) % 12) + (timeParts[3] === "PM" ? 12 : 0);

  return Number(
    `${dateParts[1]}${dateParts[2].padStart(2, "0")}${dateParts[3].padStart(2, "0")}${String(hour).padStart(2, "0")}${timeParts[2]}`,
  );
};

const isPublicEventActive = (event) => {
  const eventEndValue = publicEventEndValue(event);

  if (eventEndValue === null) {
    return true;
  }

  return eventEndValue > abileneMinuteValue();
};

const eventSubmissionToEvent = (event) => ({
  id: event.id,
  title: event.title,
  place: event.place,
  description: event.description || "",
  eventAddress: event.map_url || "",
  websiteUrl: event.website_url || "",
  ticketUrl: event.ticket_url || "",
  startsLabel: formatEventScheduleLine(event.event_date, event.event_time),
  endsLabel: formatEventScheduleLine(event.end_date || event.event_date, event.end_time || event.event_time),
  timeLabel: formatEventTime(event.event_time),
  date: formatEventDisplayDate(event.event_date, event.event_time),
  eventDate: event.event_date,
  eventTime: event.event_time,
  endDate: event.end_date,
  endTime: event.end_time,
  type: event.event_type,
  image: event.image_data || event.image_url || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80",
});

const calendarDays = [];

const galleryShots = [
  {
    id: "pine-street",
    title: "Pine Street",
    image: appAsset("ded1242b-9c25-4b2b-b16d-5b36ffe01e51.jpg"),
  },
  {
    id: "condley-downtown",
    title: "Condley Downtown",
    image: appAsset("94190f7b-27db-4b0f-b85e-84b6da72fbf2.jpg"),
  },
  {
    id: "grain-theory-block-party",
    title: "Grain Theory Block Party",
    image: appAsset("64d46fa8-3f51-4bce-ae95-07f74746d75b.jpg"),
  },
  {
    id: "texas-pacific-marker",
    title: "Texas & Pacific Marker",
    image: appAsset("77c9ff59-9fba-479d-94f7-14de54433b15.jpg"),
  },
  {
    id: "downtown-brick-walk",
    title: "Downtown Brick Walk",
    image: appAsset("64dc2bcf-e858-42d9-a881-12d069e4b919.jpg"),
  },
  {
    id: "paramount-marquee",
    title: "Paramount Marquee",
    image: appAsset("1fd1ea2a-acb5-47b2-81dc-6e9fd898f418.jpg"),
  },
  {
    id: "grain-theory-patio",
    title: "Grain Theory Patio",
    image: appAsset("522c6f5e-6918-4dd3-8874-3eaaa75430a2.jpg"),
  },
  {
    id: "grain-theory-corner",
    title: "Grain Theory Corner",
    image: appAsset("9e98df0d-dc19-429c-8205-675ba9cff023.jpg"),
  },
  {
    id: "downtown-abilene",
    title: "Downtown Abilene",
    image: appAsset("227005f7-a560-45d7-bea9-557e2cee61f3.jpg"),
  },
  {
    id: "cypress-street",
    title: "Cypress Street",
    image: appAsset("95547aea-c652-48bc-bff2-3f9f645236e3.jpg"),
  },
  {
    id: "abilene-mural",
    title: "Abilene Mural",
    image: appAsset("553b9d8e-d087-4267-a0dc-d475fd25f231.jpg"),
  },
  {
    id: "the-grace",
    title: "The Grace",
    image: appAsset("45cbacf8-d03a-4d23-ba5d-0f59509c79c6.jpg"),
  },
  {
    id: "abilene-banner",
    title: "Abilene Banner",
    image: appAsset("bd916012-2fb5-4dd1-b854-77a3b801bcd4.jpg"),
  },
  {
    id: "downtown-nights",
    title: "Downtown Nights",
    image: appAsset("nightlife-station.jpg"),
  },
  {
    id: "paramount-theatre",
    title: "Paramount Theatre",
    image: appAsset("nightlife-paramount.jpg"),
  },
  {
    id: "movie-night",
    title: "Movie Night",
    image: appAsset("nightlife-cinemark.jpg"),
  },
  {
    id: "cocktail-hour",
    title: "Cocktail Hour",
    image: appAsset("nightlife-suite.jpg"),
  },
];

const staticGalleryKey = (photo) => `gallery:${photo.id}`;
const marketplaceCategories = [
  { label: "Vehicles", icon: "🚗" },
  { label: "Electronics", icon: "📱" },
  { label: "Furniture", icon: "🛋️" },
  { label: "Tools", icon: "🛠️" },
  { label: "Clothing", icon: "👕" },
  { label: "Gaming", icon: "🎮" },
  { label: "Pets", icon: "🐶" },
  { label: "Home & Garden", icon: "🏠" },
  { label: "Local Businesses", icon: "🏪" },
];

// Archived seed data only; live Marketplace renders Supabase listings.
// eslint-disable-next-line no-unused-vars
const marketplaceStarterListings = [
  {
    title: 'Samsung TV 65"',
    price: "$350",
    category: "Electronics",
    location: "Abilene, TX",
    posted: "Posted 2 hours ago",
    tag: "Featured",
    image: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=1200&q=85",
    description: "Large smart TV in good condition.",
    contact: "(325) 555-0135",
    icon: "📺",
  },
  {
    title: "Milwaukee Drill Set",
    price: "$120",
    category: "Tools",
    location: "Abilene, TX",
    posted: "Posted today",
    tag: "Deal",
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=85",
    description: "Cordless drill set with case and bits.",
    contact: "(325) 555-0120",
    icon: "🛠️",
  },
  {
    title: "Toyota Camry Wheels",
    price: "$280",
    category: "Vehicles",
    location: "Abilene, TX",
    posted: "Posted today",
    tag: "New Today",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85",
    description: "Set of wheels ready for pickup.",
    contact: "(325) 555-0280",
    icon: "🚗",
  },
  {
    title: "Sectional Sofa",
    price: "$425",
    category: "Furniture",
    location: "South Abilene",
    posted: "Posted yesterday",
    tag: "Near Me",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=85",
    description: "Clean sectional sofa, comfortable and roomy.",
    contact: "(325) 555-0425",
    icon: "🛋️",
  },
  {
    title: "Nintendo Switch Bundle",
    price: "$210",
    category: "Gaming",
    location: "Abilene, TX",
    posted: "Posted today",
    tag: "Featured",
    image: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&w=1200&q=85",
    description: "Console bundle with games and accessories.",
    contact: "(325) 555-0210",
    icon: "🎮",
  },
  {
    title: "Moving Boxes",
    price: "$25",
    category: "Home & Garden",
    location: "Abilene, TX",
    posted: "Posted 4 hours ago",
    tag: "New Today",
    image: "https://images.unsplash.com/photo-1600518464441-9306b57e4e9d?auto=format&fit=crop&w=1200&q=85",
    description: "Stack of boxes for moving or storage.",
    contact: "(325) 555-0025",
    icon: "📦",
  },
  {
    title: "Weekend Lawn Mowing",
    price: "$45",
    category: "Local Businesses",
    location: "Abilene, TX",
    posted: "Posted today",
    tag: "Near Me",
    image: "https://images.unsplash.com/photo-1592420114272-8e29d45c1c26?auto=format&fit=crop&w=1200&q=85",
    description: "Local lawn mowing openings this weekend.",
    contact: "(325) 555-0045",
    icon: "🏪",
  },
  {
    title: "Mobile Barber Openings",
    price: "$30",
    category: "Local Businesses",
    location: "North Abilene",
    posted: "Posted 3 hours ago",
    tag: "Featured",
    image: "https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=1200&q=85",
    description: "Mobile barber appointments available.",
    contact: "(325) 555-0030",
    icon: "💈",
  },
];


const jobsCategories = [
  "Restaurant & Food", "Construction", "Cleaning", "Retail",
  "Driving & Delivery", "Health Care", "Office/Admin",
  "Manufacturing", "Warehouse", "Customer Service", "Skilled Trades", "Other",
];
const jobsFilters = ["New Today", "Full Time", "Part Time", "No Experience"];
const jobsCategoryIcon = (cat) => {
  const icons = {
    "Restaurant & Food": "🍔", Construction: "🏗️", Cleaning: "🧹", Retail: "🛒",
    "Driving & Delivery": "🚚", "Health Care": "🏥", "Office/Admin": "💻",
    Manufacturing: "⚙️", Warehouse: "📦", "Customer Service": "🎧",
    "Skilled Trades": "🔨", Other: "💼",
  };
  return icons[cat] ?? "💼";
};
const jobsFilterIcon = (f) => {
  const icons = { "New Today": "🆕 ", "Full Time": "💼 ", "Part Time": "⏰ ", "No Experience": "🧰 " };
  return icons[f] ?? "";
};
const jobsListingKey = (j) => j.id ?? `${j.title}:${j.company}`;

// ── Rent & Housing constants ──────────────────────────────────
const rentalTypes = ["Apartment", "House", "Room", "Commercial", "For Sale", "Short-Term"];
const rentalTypeIcon = (t) => ({
  Apartment: "🏢", House: "🏠", Room: "🛏️",
  Commercial: "🏪", "For Sale": "🏡", "Short-Term": "🌴",
}[t] ?? "🏘️");
const rentalFilters = ["New Today", "Pet Friendly", "Short-Term", "For Sale"];
const rentalFilterIcon = (f) => ({
  "New Today": "🆕 ", "Pet Friendly": "🐾 ", "Short-Term": "🌴 ", "For Sale": "🏡 ",
}[f] ?? "");
// ── End Rent & Housing constants ──────────────────────────────

const marketplaceListingKey = (l) => l.id ?? `starter:${l.title}:${l.price}`;
const marketplaceContactHref = (contact) => `tel:${contact.replace(/\D/g, "")}`;
const isMarketplaceToday = (dateStr) => {
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const formatMarketplacePosted = (dateStr) => {
  if (!dateStr) return "Posted today";
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (hours < 1) return "Posted just now";
  if (hours < 24) return `Posted ${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Posted 1 week ago";
  if (weeks < 5) return `Posted ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `Posted ${months} month${months === 1 ? "" : "s"} ago`;
};
const formatJobPosted = (dateStr) => {
  if (!dateStr) return "Posted Today";
  const d = new Date(dateStr);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Posted Today";
  if (days === 1) return "Posted Yesterday";
  return `Posted ${days} days ago`;
};
const formatMarketplaceExpiry = (dateStr) => {
  if (!dateStr) return "Current paid period end";
  const d = typeof dateStr === "number" ? new Date(dateStr * 1000) : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Current paid period end";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};
// Parse image_data: plain string = 1-photo (legacy), JSON array string = multi-photo.
const parseListingImages = (raw) => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter(Boolean);
  } catch {
    // Legacy rows store a single data URL instead of a JSON array.
  }
  return [raw]; // legacy single-photo string
};

const marketplaceRuleModel = "local-rules-v1";
const marketplaceModerationPatterns = {
  review: [
    {
      flag: "gift_cards",
      reason: "Listing mentions gift card payment.",
      score: 0.78,
      patterns: [/\bgift\s*cards?\b/, /\btarjetas?\s+de\s+regalo\b/, /\bpayment\s+by\s+gift\s+cards?\s+only\b/, /\bgiftcards?only\b/],
    },
    {
      flag: "crypto_payment",
      reason: "Listing mentions crypto-only or crypto-style payment.",
      score: 0.76,
      patterns: [/\bcrypto\b/, /\bbitcoin\b/, /\bbtc\b/, /\bethereum\b/, /\beth\b/, /\busdt\b/, /\btether\b/, /\bcriptomonedas?\b/, /\bsolo\s+crypto\b/, /\bbitcoinonly\b/],
    },
    {
      flag: "risky_payment",
      reason: "Listing mentions a risky payment method.",
      score: 0.72,
      patterns: [
        /\bwire\s*transfer\b/, /\btransferencia\s+bancaria\b/, /\bwestern\s+union\b/, /\bmoney\s*gram\b/, /\bmoneygram\b/,
        /\bzelle\s*only\b/, /\bsolo\s+zelle\b/, /\bcash\s*app\s*only\b/, /\bcashapp\s*only\b/, /\bsolo\s+cashapp\b/,
        /\bvenmo\s*only\b/, /\bsolo\s+venmo\b/, /\bpay\s+before\s+pickup\b/, /\bpaga\s+antes\s+de\s+recoger\b/,
      ],
    },
    {
      flag: "deposit_request",
      reason: "Listing asks for a deposit before purchase.",
      score: 0.66,
      patterns: [/\bdeposit\s*only\b/, /\bdeposit\s+required\b/, /\bpay\s+deposit\b/, /\bholding\s+fee\b/, /\bnon\s*refundable\s+deposit\b/, /\bsolo\s+deposito\b/, /\bdeposito\s+obligatorio\b/],
    },
    {
      flag: "external_contact",
      reason: "Listing contains suspicious external contact patterns.",
      score: 0.64,
      patterns: [
        /https?:\/\/\S+/, /\bwww\.[^\s]+\.[a-z]{2,}\b/, /\b[a-z0-9.-]+\.(?:com|net|org|info|biz|xyz|top|shop|click|link)\b/,
        /\bwa\.me\//, /\bt\.me\//, /\btelegram\b/, /\bwhats\s*app\s*only\b/, /\bwhatsapp\s*only\b/,
        /\bcontact\s+me\s+on\s+telegram\b/, /\bmessage\s+me\s+on\s+telegram\b/, /\bsolo\s+telegram\b/, /\bsolo\s+whatsapp\b/,
      ],
    },
    {
      flag: "spam_patterns",
      reason: "Listing contains spam-like text patterns.",
      score: 0.6,
      patterns: [/\bclick\s+here\b/, /\bact\s+now\b/, /\blimited\s+time\s+only\b/, /\bmake\s+money\s+fast\b/, /\bwork\s+from\s+home\s+guaranteed\b/, /\b100%\s+guaranteed\b/, /\bno\s+risk\b/, /\bdinero\s+rapido\b/, /\bgana\s+dinero\b/],
    },
    {
      flag: "offensive_language",
      reason: "Listing contains offensive or threatening language.",
      score: 0.7,
      patterns: [/\bfuck(?:ing)?\b/, /\bshit\b/, /\bbitch\b/, /\basshole\b/, /\bidiot\b/, /\bstupid\b/, /\bputa\b/, /\bputo\b/, /\bpendej[oa]s?\b/, /\bcabron(?:es)?\b/, /\bmaricon(?:es)?\b/, /\bkill\s+you\b/, /\bi\s+will\s+hurt\b/, /\bte\s+voy\s+a\s+matar\b/, /\bamenaza\b/],
    },
  ],
  reject: [
    {
      flag: "restricted_marketplace_item",
      reason: "This item or service is not allowed on Abilene Vibes Marketplace.",
      score: 0.96,
      patterns: [
        /\balcohol(?:ic)?\b/, /\balcohol\s+and\s+drugs?\b/, /\bbeer(?:s)?\b/, /\bwine(?:s)?\b/, /\bliquor\b/,
        /\bvodka\b/, /\bwhisk(?:e)?y\b/, /\brum\b/, /\btequila\b/, /\bgin\b/, /\bchampagne\b/,
        /\bbrandy\b/, /\bcognac\b/, /\bmarijuana\b/, /\bcannabis\b/, /\bweed\b/, /\bthc\b/,
        /\bcocaine\b/, /\bheroin\b/, /\bmeth\b/, /\bmethamphetamine\b/, /\bfentanyl\b/, /\blsd\b/,
        /\becstasy\b/, /\bmdma\b/, /\bdrugs?\b/, /\bsex\b/, /\bsexual\b/, /\bporn\b/, /\bpornography\b/,
        /\bescort\b/, /\bescort\s+service\b/, /\bprostitut(?:e|ion)\b/, /\bonly\s*fans\b/, /\bonlyfans\b/,
        /\badult\b/, /\bgun\b/, /\bfirearm\b/, /\brifle\b/, /\bshotgun\b/, /\bpistol\b/, /\brevolver\b/,
        /\bassault\s+rifle\b/, /\bar\s*-?\s*15\b/, /\bak\s*-?\s*47\b/, /\bammunition\b/, /\bammo\b/,
        /\bbullet\b/, /\bsilencer\b/, /\bfake\s+id\b/, /\bfake\s+driver\s+license\b/,
        /\bfake\s+passport\b/, /\bfake\s+documents\b/, /\bcounterfeit\s+money\b/,
        /\bcounterfeit\s+bills\b/, /\bstolen\s+credit\s+card\b/,
      ],
    },
    {
      flag: "sexual_services",
      reason: "Listing appears to include sexual services or explicit adult content.",
      score: 0.95,
      patterns: [
        /\bprostitut(?:e|ion|a|as|o|os)\b/, /\bescort(?:s)?\b/, /\bsexual\s+services?\b/, /\bservicios?\s+sexuales?\b/,
        /\bporn(?:o|ography)?\b/, /\bpornografia\b/, /\bsex\s*videos?\b/, /\bvideo\s+sexual\b/, /\bnudes?\b/, /\bdesnud[oa]s?\b/,
        /\bsexo\s+explicito\b/, /\bexplicit\s+sex\b/, /\bwebcam\s+sexual\b/, /\bonly\s*fans\b/, /\bonlyfans\b/,
        /\bcontent\s+for\s+adults\b/, /\badult\s+content\b/, /\bxxx\b/, /\banal\b/, /\boral\b/, /\bfetish\b/, /\bfetiche\b/,
        /\bsugar\s+dadd(?:y|ies)\b/, /\bsugar\s+bab(?:y|ies)\b/, /\berotic(?:a|o)?\b/, /\bmasaje\s+sexual\b/,
      ],
    },
    {
      flag: "illegal_drugs",
      reason: "Listing appears to offer illegal drugs.",
      score: 0.96,
      patterns: [
        /\bcocaine(?:\s+for\s+sale)?\b/, /\bcocaina\b/, /\bmeth\b/, /\bmetanfetamina\b/, /\bheroin\b/, /\bheroina\b/,
        /\bfentanyl\b/, /\bfentanilo\b/, /\bcrack\b/, /\becstasy\b/, /\bextasis\b/, /\blsd\b/, /\bmdma\b/,
        /\boxycodone\b/, /\boxi(?:codona)?\b/, /\bxanax\b/, /\billegal\s+drugs?\b/, /\bdrogas?\s+ilegales?\b/,
        /\bweed\s+for\s+sale\b/, /\bmarijuana\s+for\s+sale\b/, /\bmarihuana\s+en\s+venta\b/, /\bvendo\s+(?:weed|marihuana|marijuana)\b/,
        /\bdrug\s+dealer\b/, /\bdealer\s+de\s+drogas\b/,
      ],
    },
    {
      flag: "weapons",
      reason: "Listing appears to offer weapons or ammunition.",
      score: 0.94,
      patterns: [
        /\bgun\s+for\s+sale\b/, /\bfirearm\s+for\s+sale\b/, /\bhand\s*gun\b/, /\bhandgun\b/, /\bpistol\s+for\s+sale\b/,
        /\brifle\s+for\s+sale\b/, /\bassault\s+rifle\b/, /\bar\s*-?\s*15\b/, /\bak\s*-?\s*47\b/, /\bammunition\b/, /\bammo\b/,
        /\bsilencer\b/, /\bsuppressor\b/, /\bghost\s+gun\b/, /\bvendo\s+(?:pistola|rifle|arma)\b/, /\barmas?\s+de\s+fuego\b/,
      ],
    },
    {
      flag: "illegal_documents",
      reason: "Listing appears to offer illegal documents or identity material.",
      score: 0.94,
      patterns: [
        /\bfake\s+id\b/, /\bid\s+falsa\b/, /\bfake\s+passport\b/, /\bpasaporte\s+falso\b/,
        /\bfake\s+driver'?s?\s+licenses?\b/, /\blicencia\s+falsa\b/, /\bssn\b/, /\bsocial\s+security\s+number\b/,
        /\bnumero\s+de\s+seguro\s+social\b/, /\bstolen\s+identity\b/,
        /\bidentidad\s+robada\b/,
      ],
    },
    {
      flag: "stolen_goods",
      reason: "Listing appears to offer stolen goods.",
      score: 0.9,
      patterns: [/\bstolen\b/, /\bstolen\s+iphone\b/, /\bstolen\s+tv\b/, /\bhot\s+merchandise\b/, /\bmercancia\s+robada\b/, /\bproducto\s+robado\b/, /\brobad[oa]s?\b/],
    },
  ],
};

const normalizeMarketplaceModerationText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[-_./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const evaluateMarketplaceModeration = (payload, imageCount = 0) => {
  const rawText = [
    payload.title,
    payload.price,
    payload.category,
    payload.location,
    payload.contact,
    payload.description,
  ].filter(Boolean).join(" ");
  const text = normalizeMarketplaceModerationText(rawText);
  const compactText = text.replace(/\s+/g, "");
  const hits = [];

  const addPatternHits = (rules, severity) => {
    rules.forEach((rule) => {
      if (rule.patterns.some((pattern) => pattern.test(text) || pattern.test(compactText))) {
        hits.push({ flag: rule.flag, reason: rule.reason, score: rule.score, severity });
      }
    });
  };

  addPatternHits(marketplaceModerationPatterns.reject, "reject");
  addPatternHits(marketplaceModerationPatterns.review, "review");

  const images = parseListingImages(payload.image_data);
  if (images.length !== imageCount || String(payload.image_data ?? "").length > 7_500_000) {
    hits.push({ flag: "image_review", reason: "Listing photos need manual review because image metadata looked unusual.", score: 0.52, severity: "review" });
  }

  const urlCount = (rawText.match(/https?:\/\/|www\.|(?:^|\s)[a-z0-9.-]+\.(?:com|net|org|info|biz|xyz|top|shop|click|link)(?:\s|$)/gi) ?? []).length;
  if (urlCount >= 2) {
    hits.push({ flag: "multiple_urls", reason: "Listing contains multiple links and needs manual review.", score: 0.68, severity: "review" });
  }
  if (/[!?]{4,}/.test(rawText) || /([a-z0-9])\1{9,}/i.test(rawText)) {
    hits.push({ flag: "spam_formatting", reason: "Listing uses spam-like repeated characters or punctuation.", score: 0.58, severity: "review" });
  }
  const repeatedWords = text.match(/\b(\w{4,})\b(?:\s+\1\b){3,}/);
  if (repeatedWords) {
    hits.push({ flag: "repeated_text", reason: "Listing contains repeated text that looks like spam.", score: 0.62, severity: "review" });
  }

  const reviewHit = hits.find((hit) => hit.severity === "review");
  const moderationStatus = "pending";
  const moderationReason =
    reviewHit?.reason ||
    "Marketplace listing is waiting for manual admin approval.";
  const moderationScore = hits.reduce((max, hit) => Math.max(max, hit.score), 0);

  return {
    moderation_status: moderationStatus,
    moderation_reason: moderationReason,
    moderation_score: Number(moderationScore.toFixed(4)),
    moderation_flags: { local_rules: hits },
    moderation_input_types: { text: true, image: imageCount > 0 },
    moderation_model: marketplaceRuleModel,
    moderated_at: new Date().toISOString(),
  };
};

const getMarketplaceModerationStatus = (listing) => {
  const status = String(listing?.moderation_status ?? listing?.moderationStatus ?? "approved").trim().toLowerCase();
  return status === "needs_review" ? "pending" : status;
};

const mapListingFromDb = (row) => {
  const imgs = parseListingImages(row.image_data);
  return {
    id: row.id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    sold_at: row.sold_at,
    deleted_at: row.deleted_at,
    title: row.title,
    price: row.price,
    category: row.category,
    location: row.location,
    contact: row.contact,
    description: row.description,
    image_data: row.image_data,
    image: imgs[0] || null,   // first photo — backward compat for all existing code
    images: imgs,             // all photos
    status: row.status,
    moderation_status: row.moderation_status ?? row.moderationStatus ?? "approved",
    moderation_reason: row.moderation_reason ?? row.moderationReason ?? "",
    moderation_score: row.moderation_score ?? row.moderationScore ?? null,
    moderation_flags: row.moderation_flags ?? row.moderationFlags ?? {},
    moderation_input_types: row.moderation_input_types ?? row.moderationInputTypes ?? null,
    moderation_model: row.moderation_model ?? row.moderationModel ?? "",
    moderated_at: row.moderated_at ?? row.moderatedAt ?? null,
    reviewed_by_admin: row.reviewed_by_admin ?? row.reviewedByAdmin ?? false,
    reviewed_at: row.reviewed_at ?? row.reviewedAt ?? null,
    reviewed_by: row.reviewed_by ?? row.reviewedBy ?? "",
    moderationStatus: row.moderation_status ?? row.moderationStatus ?? "approved",
    moderationReason: row.moderation_reason ?? row.moderationReason ?? "",
    moderationScore: row.moderation_score ?? row.moderationScore ?? null,
    moderationFlags: row.moderation_flags ?? row.moderationFlags ?? {},
    moderationInputTypes: row.moderation_input_types ?? row.moderationInputTypes ?? null,
    moderationModel: row.moderation_model ?? row.moderationModel ?? "",
    moderatedAt: row.moderated_at ?? row.moderatedAt ?? null,
    reviewedByAdmin: row.reviewed_by_admin ?? row.reviewedByAdmin ?? false,
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? null,
    reviewedBy: row.reviewed_by ?? row.reviewedBy ?? "",
    owner_user_id: row.owner_user_id,
    ownerUserId: row.owner_user_id,
    expiresAt: row.expires_at,
    soldAt: row.sold_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    posted: formatMarketplacePosted(row.created_at),
    tag: isMarketplaceToday(row.created_at) ? "New Today" : "Near Me",
    icon: marketplaceCategories.find((c) => c.label === row.category)?.icon ?? "📦",
  };
};

const promoteCategories = [
  { label: "Food trucks", icon: "foodTruck" },
  { label: "Restaurants", icon: "restaurant" },
  { label: "Clubs & Bars", icon: "bars" },
  { label: "Barber Shop", icon: "barber" },
  { label: "Sports & Fitness", icon: "fitness" },
  { label: "Rentals", icon: "rentals" },
  { label: "Groceries", icon: "groceries" },
  { label: "Shopping", icon: "shopping" },
  { label: "Family & Kids", icon: "family" },
  { label: "Dealers", icon: "dealers" },
  { label: "Insurance", icon: "insurance" },
  { label: "Health", icon: "health" },
  { label: "Schools", icon: "schools" },
  { label: "Others", icon: "others" },
  { label: "Jobs & Hiring", icon: "jobsHiring" },
];

const promotePlans = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    note: "Basic directory listing",
  },
  {
    name: "Featured",
    price: "$19",
    cadence: "per month",
    note: "Monthly subscription. $19 today, then auto-renews until canceled.",
  },
  {
    name: "Premium",
    price: "$59",
    cadence: "per month",
    note: "Monthly subscription. $59 today, then auto-renews until canceled.",
  },
];

const legalSections = {
  terms: {
    eyebrow: "Legal",
    title: "Terms of Use",
    intro:
      "Effective Date: July 2026\n\nWelcome to Abilene Vibes, operated by Abilene Labs.\n\nThese Terms of Use apply to all users, visitors, businesses, advertisers, contributors, listing submitters, and anyone who accesses or uses Abilene Vibes.\n\nBy using Abilene Vibes, submitting content, publishing a listing, or purchasing a Featured or Premium placement, you agree to these Terms of Use.",
    items: [
      {
        title: "Free Use of the App",
        copy:
          "Abilene Vibes can be explored for free.\n\nYou are not required to create an account to browse local businesses, events, marketplace listings, jobs, rentals, gallery photos, and other public content.\n\nSome features, such as submitting content, managing listings, saving items, interacting with content, or purchasing paid placements, may require additional information.",
      },
      {
        title: "Submitted Content",
        copy:
          "When you submit content to Abilene Vibes, you are responsible for making sure it is accurate, lawful, appropriate, and that you have the right to submit it.\n\nSubmitted content may include business listings, marketplace listings, job posts, rental listings, gallery photos, reviews, logos, images, descriptions, prices, contact information, links, and other details.",
      },
      {
        title: "Permission to Use Submitted Content",
        copy:
          "By submitting content, you give Abilene Vibes permission to display, store, edit for formatting, publish, promote, and share that content in connection with the app.\n\nThis may include use inside Abilene Vibes, related websites, social media, promotional materials, local advertising, and other Abilene Vibes channels.",
      },
      {
        title: "Photos, Logos, and Images",
        copy:
          "You may only submit photos, logos, images, or media that you own or have permission to use.\n\nYou are responsible for any rights, permissions, copyrights, trademarks, privacy rights, or publicity rights related to the media you submit.",
      },
      {
        title: "Business Listings",
        copy:
          "Business submitters are responsible for providing accurate business names, categories, descriptions, addresses, phone numbers, websites, social links, photos, logos, and contact information.\n\nAbilene Vibes may approve, reject, edit, hide, pause, or remove business listings to keep the app accurate, lawful, and appropriate.\n\nBusiness names, trademarks, logos, and brand assets belong to their respective owners. Abilene Vibes is an independent local guide unless a business is clearly marked as a sponsor, advertiser, or partner.",
      },
      {
        title: "Featured and Premium Placements",
        copy:
          "Featured and Premium placements are paid promotional placements that improve visibility inside Abilene Vibes.\n\nFeatured currently costs $19 per month.\n\nPremium currently costs $59 per month.\n\nPayment does not guarantee immediate publication. Paid listings may still require Admin review before appearing publicly.\n\nPaid placement does not guarantee sales, visits, calls, rankings, customer interest, applications, rentals, purchases, or any specific result.",
      },
      {
        title: "Subscriptions and Payments",
        copy:
          "Featured and Premium placements are monthly subscriptions processed through Stripe.\n\nBy purchasing a paid placement, you authorize Abilene Vibes and Stripe to charge the selected amount today and automatically each month until the subscription is canceled.\n\nStripe may process payments under its own terms and policies. Abilene Vibes does not store full credit card numbers.",
      },
      {
        title: "Cancellations",
        copy:
          "You may request cancellation of a paid subscription by contacting Abilene Vibes or through available Admin support.\n\nCancellation stops future renewals.\n\nIf a subscription is canceled at the end of the billing period, the paid placement may remain active until the current paid period expires. Immediate cancellation may remove the paid placement sooner.",
      },
      {
        title: "Refunds",
        copy:
          "Payments for the current billing period are not automatically refunded after purchase.\n\nRefund requests may be considered on a case-by-case basis by contacting Abilene Vibes. Stripe or other payment provider policies may also apply.",
      },
      {
        title: "Marketplace Listings",
        copy:
          "Marketplace submitters are responsible for the accuracy, legality, price, condition, ownership, contact information, and availability of items they post.\n\nAbilene Vibes only provides the platform for marketplace listings and communication between users.\n\nAbilene Vibes is not a party to transactions between buyers and sellers.\n\nUsers are responsible for communicating safely, following applicable laws, verifying items, and making their own decisions before buying, selling, meeting, or exchanging payment.",
      },
      {
        title: "Jobs",
        copy:
          "Job posters are responsible for accurate job titles, company information, pay details, requirements, contact information, application methods, and legal compliance.\n\nAbilene Vibes only provides the platform where employers and applicants may connect.\n\nAbilene Vibes does not guarantee employment, applicants, hiring results, job availability, pay accuracy, workplace conditions, employer behavior, or applicant behavior.",
      },
      {
        title: "Rentals",
        copy:
          "Rental posters are responsible for accurate property details, pricing, availability, permissions, contact information, photos, descriptions, and compliance with applicable laws.\n\nAbilene Vibes is not a party to rental agreements.\n\nAbilene Vibes does not guarantee rental availability, property condition, lease terms, sale terms, pricing, safety, landlord behavior, tenant behavior, or transaction outcomes.",
      },
      {
        title: "Gallery Photos",
        copy:
          "Gallery contributors may submit photos for review. Only submit photos that you own or have permission to share.\n\nAbilene Vibes may approve, reject, edit, hide, or remove gallery submissions.",
      },
      {
        title: "Reviews, Likes, and Favorites",
        copy:
          "Users may be able to like, save, favorite, rate, or review content.\n\nReviews and public feedback should be honest, relevant, and respectful.\n\nAbilene Vibes may moderate, hide, or remove reviews or interactions that appear abusive, fake, misleading, unlawful, spammy, or inappropriate.",
      },
      {
        title: "Events",
        copy:
          "Events shown in Abilene Vibes may be entered, selected, or published by Admin.\n\nEvent information may change. Users should verify dates, times, locations, prices, ticket details, age restrictions, safety information, and other details with the event organizer or official source.\n\nAbilene Vibes does not guarantee that event information is complete, current, or error-free.",
      },
      {
        title: "Prohibited Content",
        copy:
          "You may not submit content that is:\n\n- Illegal, fraudulent, misleading, or deceptive.\n- Hateful, threatening, harassing, abusive, or discriminatory.\n- Sexually explicit or inappropriate for a general local audience.\n- Violent, dangerous, or encouraging harm.\n- Spam, scams, malware, or attempts to manipulate the app.\n- Infringing on copyrights, trademarks, privacy rights, publicity rights, or other rights.\n- False, impersonating another person or business, or submitted without permission.\n- Promoting illegal goods, stolen items, prohibited services, or unsafe activity.",
      },
      {
        title: "Moderation Rights",
        copy:
          "Abilene Vibes may review, approve, reject, edit, hide, pause, restore, or remove any submitted content at any time.\n\nThis includes businesses, marketplace listings, jobs, rentals, gallery photos, reviews, events, comments, images, links, and promotional placements.\n\nAbilene Vibes may also remove content to comply with law, protect users, prevent abuse, respond to owner requests, correct errors, or maintain app quality.",
      },
      {
        title: "External Links and Services",
        copy:
          "Abilene Vibes may link to business websites, social media pages, Google Maps or other map services, job application links, rental links, ticket links, and other external services.\n\nExternal services are not controlled by Abilene Vibes. Users access them at their own discretion, and those services may have their own terms, privacy policies, fees, and risks.",
      },
      {
        title: "No Professional Advice",
        copy:
          "Abilene Vibes is a local discovery and information app. Content in the app is provided for general informational purposes only.\n\nUsers should independently verify important details before making purchases, applying for jobs, renting property, attending events, contacting businesses, or relying on any listing.",
      },
      {
        title: "Limitation of Responsibility",
        copy:
          "Abilene Vibes is not responsible for the actions, products, services, listings, claims, prices, availability, communications, payments, meetings, safety, or behavior of third-party businesses, sellers, buyers, employers, landlords, tenants, event organizers, contributors, or users.\n\nAbilene Vibes does not guarantee that all content is accurate, current, complete, available, or suitable for any particular purpose.",
      },
      {
        title: "Updates, Corrections, and Removal Requests",
        copy:
          "To request a correction, update, removal, or review of content, contact:\n\nabilenevibes@gmail.com\n\nPlease include enough information to identify the listing, post, review, photo, event, business, job, rental, or marketplace item.",
      },
      {
        title: "Changes to These Terms",
        copy:
          "Abilene Vibes may update these Terms of Use as the app grows, features change, service providers change, or legal requirements change.\n\nContinued use of Abilene Vibes after updated Terms of Use are posted means you accept the updated terms.",
      },
      {
        title: "Contact",
        copy:
          "For questions, listing updates, removals, billing questions, permission concerns, or reports of inappropriate content, contact:\n\nabilenevibes@gmail.com\n\nThese Terms of Use are governed by the applicable laws of the United States and the State of Texas.\n\nThis document should be reviewed by a licensed attorney before a large-scale commercial launch.",
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    intro:
      "Effective Date: July 2026\n\nAbilene Vibes, operated by Abilene Labs, is a local guide for discovering businesses, events, rentals, jobs, marketplace listings, photos, and community content in Abilene.\n\nYou can browse Abilene Vibes for free. You are not required to create an account to explore the app.",
    items: [
      {
        title: "Information We Collect",
        copy:
          "Abilene Vibes mainly collects information when someone chooses to submit content, publish a listing, contact us, interact with content, or purchase a Featured or Premium placement.\n\nDepending on the feature used, submitted information may include:\n\n- Business name, category, description, address, phone number, email, website, social link, contact name, photos, logos, and plan selection.\n- Marketplace item title, price, category, location, contact information, description, and photos.\n- Job listing title, company, category, job type, pay information, location, contact person, phone, email, application method, description, requirements, images, and logos.\n- Rental listing title, property type, address, price, deposit, availability, bedrooms, bathrooms, description, contact information, external links, and photos.\n- Gallery photos, photo titles, contributor names, and related submitted details.\n- Reviews, ratings, likes, saved/favorite items, and basic interaction activity when those features are used.\n- Payment-related identifiers from Stripe, such as customer IDs, subscription IDs, checkout session IDs, payment status, plan type, and billing status.\n\nAbilene Vibes does not store full credit card numbers in the app database.",
      },
      {
        title: "How We Use Information",
        copy:
          "We use submitted information to:\n\n- Display approved businesses, marketplace listings, jobs, rentals, gallery photos, reviews, and local content.\n- Review, moderate, approve, reject, edit, hide, or remove submitted content.\n- Contact submitters about their listings, updates, corrections, payments, or removal requests.\n- Manage Free, Featured, and Premium placements.\n- Process and track paid promotions.\n- Improve the app, prevent abuse, and understand how people interact with local content.\n- Provide business activity information, such as calls, directions, visits, likes, reviews, or other engagement, when available.",
      },
      {
        title: "Public Information",
        copy:
          "Some information submitted to Abilene Vibes may become public after approval.\n\nPublic information may include:\n\n- Business names, categories, descriptions, addresses, phone numbers, websites, social links, photos, and logos.\n- Marketplace listing details, photos, prices, and contact information.\n- Job listing details, company names, pay information, locations, contact details, and application information.\n- Rental listing details, prices, addresses or areas, photos, contact details, and external links.\n- Gallery photos, titles, and contributor names.\n- Reviews, ratings, and other public interaction content.\n\nPlease do not submit private or sensitive information that you do not want shown publicly.",
      },
      {
        title: "Photos, Logos, and Images",
        copy:
          "When you submit photos, logos, images, or other media, you confirm that you have the rights and permission needed to share them.\n\nSubmitted media may be displayed inside Abilene Vibes and may also be used in related Abilene Vibes websites, social media, promotional material, or local advertising connected to the app.",
      },
      {
        title: "Payments and Stripe",
        copy:
          "Featured and Premium placements are processed through Stripe.\n\nStripe may collect and process payment information according to its own privacy policy and terms. Abilene Vibes may store payment status, plan type, Stripe customer identifiers, subscription identifiers, checkout session identifiers, and related billing status needed to manage paid placements and cancellations.\n\nAbilene Vibes does not store full card numbers.",
      },
      {
        title: "Supabase",
        copy:
          "Abilene Vibes uses Supabase for app data, database features, storage, authentication where needed, and related backend services.\n\nInformation submitted through the app may be stored in Supabase, including listings, photos, reviews, likes, saved items, payment status, and other app content.",
      },
      {
        title: "Maps, Directions, and External Links",
        copy:
          "Some parts of Abilene Vibes may open Google Maps, map search, directions, business websites, social media pages, job application links, rental links, ticket links, and other external services.\n\nExternal services are not controlled by Abilene Vibes. Their own privacy policies and terms may apply.",
      },
      {
        title: "Events",
        copy:
          "Events shown in Abilene Vibes may be selected, entered, or published by Admin. Event details may change. Users should verify times, locations, ticket information, age restrictions, and other details with the event organizer or official source.",
      },
      {
        title: "Likes, Favorites, Reviews, and Interactions",
        copy:
          "Abilene Vibes may save likes, favorites, saved items, reviews, ratings, calls, direction clicks, website visits, and other basic interaction activity when those features are used.\n\nThis information may be used to improve the app, show engagement, support moderation, or provide activity reports to listing owners or Admin.",
      },
      {
        title: "No Sale of Personal Information",
        copy:
          "Abilene Vibes does not sell personal information.\n\nWe may use trusted service providers, such as Stripe and Supabase, to operate the app, process payments, store content, and provide app functionality.",
      },
      {
        title: "Corrections, Updates, and Removal Requests",
        copy:
          "You may request correction, update, or removal of content you submitted by contacting:\n\nabilenevibes@gmail.com\n\nPlease include enough detail for us to identify the listing, photo, review, job, rental, marketplace item, or other content.\n\nWe may need to verify that the request comes from the submitter, owner, authorized representative, or another person with a valid reason to request the change.",
      },
      {
        title: "Children and Sensitive Information",
        copy:
          "Abilene Vibes is intended as a local information and discovery app. Users should not submit sensitive personal information, private documents, financial details, medical information, government IDs, or information about children unless they have the legal right and clear reason to do so.",
      },
      {
        title: "Content Moderation",
        copy:
          "Abilene Vibes may review, approve, edit, reject, hide, or remove submitted content to keep the app useful, accurate, lawful, and appropriate for the community.",
      },
      {
        title: "Changes to this Privacy Policy",
        copy:
          "Abilene Vibes may update this Privacy Policy as the app grows, features change, service providers change, or legal requirements change.\n\nWhen a material change is made, the Effective Date will be updated to reflect the new version. Continued use of Abilene Vibes after an updated Privacy Policy is posted means the updated policy applies to your use of the app.",
      },
      {
        title: "Contact",
        copy:
          "For privacy questions, corrections, removals, or data-related requests, contact:\n\nabilenevibes@gmail.com\n\nThis Privacy Policy is governed by the applicable laws of the United States and the State of Texas.\n\nThis document should be reviewed by a licensed attorney before a large-scale commercial launch.",
      },
    ],
  },
};

const lobbyActions = [
  {
    page: "events",
    label: "Events",
    description: "Discover the best events in Abilene.",
    icon: "♪",
    tone: "pink",
  },
  {
    page: "shopping",
    label: "Shopping",
    description: "Explore the best shops and local favorites.",
    icon: "shopping",
    tone: "purple",
  },
  {
    page: "nightlife",
    label: "Nightlife",
    description: "Explore the hottest spots in the city.",
    icon: "nightlife",
    tone: "pink",
  },
  {
    page: "eats",
    label: "Eats",
    description: "Find food and drinks around town.",
    icon: "♨",
    tone: "cyan",
  },
  {
    page: "family",
    label: "Family & Kids",
    description: "Fun activities for the whole family.",
    icon: "family",
    tone: "purple",
  },
  {
    page: "hotels",
    label: "Sports & Fitness",
    description: "Find gyms, training, sports, and fitness spots in Abilene.",
    icon: "fitness",
    tone: "purple",
  },
  {
    page: "gallery",
    label: "Gallery",
    description: "View photos from events and nightlife.",
    icon: "gallery",
    tone: "cyan",
  },
  {
    page: "directory",
    label: "Directory",
    description: "Find local businesses and services in Abilene.",
    icon: "directory",
    tone: "pink",
  },
];

const moreServices = [
  { label: "Local News", icon: "news", page: "news" },
  { label: "Local Marketplace", icon: "sales", page: "marketplace" },
  { label: "Groceries", icon: "groceries", page: "groceries" },
  { label: "Jobs & Hiring", icon: "jobs", page: "jobs" },
  { label: "Rentals", icon: "rents", page: "rentals" },
  { label: "Dealers", icon: "dealers", page: "dealers" },
  { label: "Insurance Companies", icon: "insurance", page: "insurance" },
  { label: "Barber Shops", icon: "barber", page: "barbers" },
  { label: "Health", icon: "health", page: "health" },
  { label: "Schools", icon: "schools", page: "schools" },
];

const verifiedNewsSources = [
  {
    name: "City of Abilene News",
    url: "https://www.abilenetx.gov/rss.aspx",
    note: "Official city updates and public notices.",
  },
  {
    name: "KACU Local News",
    url: "https://www.kacu.org/local-news",
    note: "Local reporting for Abilene and the Big Country.",
  },
  {
    name: "Big Country Homepage",
    url: "https://www.bigcountryhomepage.com/news/abilene-news/",
    note: "Regional local news from KTAB/KRBC.",
  },
  {
    name: "KTXS",
    url: "https://ktxs.com/news/local",
    note: "Local news, weather, and public safety coverage.",
  },
];

const localNewsCategories = [
  { label: "All", description: "Everything fresh" },
  { label: "Fires", description: "Fire and emergency updates" },
  { label: "Arrests", description: "Public safety reports" },
  { label: "New Spots", description: "Openings and local business buzz" },
  { label: "Sports", description: "Local scores and matchups" },
  { label: "Campus", description: "ACU, HSU, McMurry and local colleges" },
  { label: "Flying Bison", description: "Professional baseball updates" },
];

const adminTabs = [
  { id: "events", label: "Events" },
  { id: "gallery", label: "Gallery" },
  { id: "businesses", label: "Businesses" },
  { id: "payments", label: "Payments" },
  { id: "reviews", label: "Reviews" },
  { id: "jobs", label: "Jobs & Hiring" },
  { id: "marketplace", label: "Marketplace" },
  { id: "rentals", label: "Rent & Housing" },
  { id: "analytics", label: "Analytics" },
];

const initialBusinesses = [
  {
    id: "grain-theory",
    name: "Grain Theory",
    category: "Restaurants",
    phone: "(325) 704-2500",
    social: "graintheory.com",
    description: "Downtown brewpub with food, drinks, and a strong patio crowd.",
  },
  {
    id: "guitars-cadillacs",
    name: "Guitars and Cadillacs",
    category: "Clubs & Bars",
    phone: "(325) 672-2960",
    social: "@guitarsabilene",
    description: "Country nights, dancing, and weekend energy in Abilene.",
  },
];

const businessSubmissionToBusiness = (business) => ({
  id: business.id,
  name: business.business_name,
  category: business.category,
  phone: business.phone,
  contactName: business.contact_name ?? "",
  contactEmail: business.contact_email ?? "",
  address: business.address ?? "",
  social: business.social ?? "",
  description: business.description ?? "",
  image: business.image_data ?? "",
  plan: business.plan,
  paymentStatus: business.payment_status ?? "",
  placementSource: business.placement_source ?? "paid",
  placementExpiresAt: business.placement_expires_at ?? "",
  ownerUserId: business.owner_user_id ?? "",
  owner_user_id: business.owner_user_id ?? "",
});

const planRank = {
  Premium: 0,
  Featured: 1,
  Free: 2,
};

const activePaidPaymentStatuses = new Set(["paid", "cancel_pending"]);

const businessPlacementExpiresAt = (business) => business.placementExpiresAt ?? business.placement_expires_at ?? "";

const hasActiveBusinessPromotion = (business) => {
  const plan = business.plan ?? "";
  const paymentStatus = business.paymentStatus ?? business.payment_status ?? "";
  const placementSource = business.placementSource ?? business.placement_source ?? "";
  const expiresAt = businessPlacementExpiresAt(business);

  if (!["Featured", "Premium"].includes(plan)) {
    return false;
  }

  if (placementSource !== "comp" && !activePaidPaymentStatuses.has(paymentStatus)) {
    return false;
  }

  return !expiresAt || new Date(expiresAt) > new Date();
};

const businessDisplayPlan = (business) => {
  if (!business.plan) {
    return "";
  }

  return business.plan === "Free" || hasActiveBusinessPromotion(business) ? business.plan : "Free";
};

const businessPromotionStatus = (business) => {
  const paymentStatus = business.payment_status ?? business.paymentStatus ?? "";
  const expiresAt = businessPlacementExpiresAt(business);

  if (hasActiveBusinessPromotion(business)) {
    return paymentStatus === "cancel_pending" ? "Canceling - active until expiration" : "Active paid promotion";
  }

  if (business.plan === "Free") {
    return "Normal directory listing";
  }

  if (paymentStatus === "canceled") {
    return "Canceled - directory only";
  }

  if (paymentStatus === "expired" || (expiresAt && new Date(expiresAt) <= new Date())) {
    return "Expired - directory only";
  }

  if (business.placement_source === "comp") {
    return expiresAt && new Date(expiresAt) <= new Date() ? "Free promo expired" : "Free promo";
  }

  return "Not active";
};

const businessServiceSections = {
  groceries: {
    page: "groceries",
    title: "Groceries",
    eyebrow: "Local essentials",
    intro: "Find grocery stores and food markets shared through Abilene Vibes.",
    ariaLabel: "Abilene grocery businesses",
    addButton: "Add Grocery Store",
    closeButton: "Close Grocery Form",
    formTitle: "Add Grocery Store",
    namePlaceholder: "Grocery store name",
    descriptionPlaceholder: "Tell people what they can find here.",
    category: "Groceries",
    categories: ["Groceries", "Grocery"],
    emptyMessage: "No grocery listings yet.",
    savedName: "grocery store",
  },
  shopping: {
    page: "shopping",
    title: "Shopping",
    eyebrow: "Local finds",
    intro: "Find shops, boutiques, gifts, and local favorites shared through Abilene Vibes.",
    ariaLabel: "Abilene shopping businesses",
    addButton: "Add Shopping Business",
    closeButton: "Close Shopping Form",
    formTitle: "Add Shopping Business",
    namePlaceholder: "Shopping business name",
    descriptionPlaceholder: "Tell people what they can find here.",
    category: "Shopping",
    categories: ["Shopping"],
    emptyMessage: "No shopping listings yet.",
    savedName: "shopping business",
  },
  nightlife: {
    page: "nightlife",
    title: "Nightlife",
    eyebrow: "After dark",
    intro: "Find clubs, bars, lounges, and nightlife businesses shared through Abilene Vibes.",
    ariaLabel: "Abilene nightlife businesses",
    addButton: "Add Nightlife Business",
    closeButton: "Close Nightlife Form",
    formTitle: "Add Nightlife Business",
    namePlaceholder: "Nightlife business name",
    descriptionPlaceholder: "Tell people what they can find here.",
    category: "Clubs & Bars",
    categories: ["Clubs & Bars"],
    emptyMessage: "No nightlife listings yet.",
    savedName: "nightlife business",
  },
  eats: {
    page: "eats",
    title: "Eats",
    eyebrow: "Food before the fun",
    intro: "Find restaurants and food trucks shared through Abilene Vibes.",
    ariaLabel: "Abilene restaurants and food trucks",
    addButton: "Add Eats Business",
    closeButton: "Close Eats Form",
    formTitle: "Add Eats Business",
    namePlaceholder: "Restaurant or food truck name",
    descriptionPlaceholder: "Tell people what they can find here.",
    category: "Restaurants",
    categories: ["Restaurants", "Food trucks", "Food Trucks"],
    emptyMessage: "No Eats listings yet.",
    savedName: "Eats business",
  },
  family: {
    page: "family",
    title: "Family & Kids",
    eyebrow: "Family fun",
    intro: "Find family entertainment, kids activities, birthday spots, parks, and local places for all ages.",
    ariaLabel: "Abilene family and kids businesses",
    addButton: "Add Family & Kids Business",
    closeButton: "Close Family & Kids Form",
    formTitle: "Add Family & Kids Business",
    namePlaceholder: "Family or kids business name",
    descriptionPlaceholder: "Tell families about activities, parties, ages, and what to expect.",
    category: "Family & Kids",
    categories: ["Family & Kids", "Family", "Kids", "Children Activities"],
    emptyMessage: "No Family & Kids listings yet.",
    savedName: "Family & Kids business",
  },
  hotels: {
    page: "hotels",
    title: "Sports & Fitness",
    eyebrow: "Move local",
    intro: "Find gyms, training, sports, and fitness spots in Abilene.",
    ariaLabel: "Abilene sports and fitness businesses",
    addButton: "Add Sports & Fitness Business",
    closeButton: "Close Sports & Fitness Form",
    formTitle: "Add Sports & Fitness Business",
    namePlaceholder: "Sports or fitness business name",
    descriptionPlaceholder: "Tell people about training, classes, sports, facilities, and what to expect.",
    category: "Sports & Fitness",
    categories: [
      "Sports & Fitness",
      "Gym",
      "Fitness Center",
      "CrossFit",
      "Yoga",
      "Pilates",
      "Boxing",
      "Martial Arts",
      "Soccer Academy",
      "Basketball Training",
      "Baseball Training",
      "Tennis Club",
      "Swimming Pools",
      "Dance Studio",
      "Personal Trainer",
    ],
    emptyMessage: "No Sports & Fitness listings yet.",
    savedName: "Sports & Fitness business",
  },
  dealers: {
    page: "dealers",
    title: "Dealers",
    eyebrow: "Local auto",
    intro: "Find local dealers shared through Abilene Vibes.",
    ariaLabel: "Abilene dealer businesses",
    addButton: "Add Dealer",
    closeButton: "Close Dealer Form",
    formTitle: "Add Dealer",
    namePlaceholder: "Dealer name",
    descriptionPlaceholder: "Tell people what vehicles or services they can find here.",
    category: "Dealer",
    categories: ["Dealer", "Dealers", "Car Dealer", "Auto Dealer"],
    emptyMessage: "No dealer listings yet.",
    savedName: "dealer",
  },
  barbers: {
    page: "barbers",
    title: "Barber Shop",
    eyebrow: "Local grooming",
    intro: "Find barber shops shared through Abilene Vibes.",
    ariaLabel: "Abilene barber shop businesses",
    addButton: "Add Barber Shop",
    closeButton: "Close Barber Form",
    formTitle: "Add Barber Shop",
    namePlaceholder: "Barber shop name",
    descriptionPlaceholder: "Tell people about cuts, appointments, and services.",
    category: "Barber Shop",
    categories: ["Barber", "Barber Shop", "Barbershop"],
    emptyMessage: "No barber shop listings yet.",
    savedName: "barber shop",
  },
  insurance: {
    page: "insurance",
    title: "Insurance",
    eyebrow: "Local coverage",
    intro: "Find insurance businesses shared through Abilene Vibes.",
    ariaLabel: "Abilene insurance businesses",
    addButton: "Add Insurance Company",
    closeButton: "Close Insurance Form",
    formTitle: "Add Insurance Company",
    namePlaceholder: "Insurance company name",
    descriptionPlaceholder: "Tell people about coverage, specialties, and services.",
    category: "Insurance",
    categories: ["Insurance", "Insurance Companies"],
    emptyMessage: "No insurance listings yet.",
    savedName: "insurance company",
  },
  health: {
    page: "health",
    title: "Health",
    eyebrow: "Local care",
    intro: "Find health and medical businesses shared through Abilene Vibes.",
    ariaLabel: "Abilene health businesses",
    addButton: "Add Health Listing",
    closeButton: "Close Health Form",
    formTitle: "Add Health Listing",
    namePlaceholder: "Health business name",
    descriptionPlaceholder: "Tell people about care, specialties, and services.",
    category: "Health",
    categories: ["Health", "Hospital", "Medical", "Clinic", "Dentist"],
    emptyMessage: "No health listings yet.",
    savedName: "health listing",
  },
  schools: {
    page: "schools",
    title: "Schools",
    eyebrow: "Local learning",
    intro: "Find schools and education listings shared through Abilene Vibes.",
    ariaLabel: "Abilene school businesses",
    addButton: "Add School",
    closeButton: "Close School Form",
    formTitle: "Add School",
    namePlaceholder: "School name",
    descriptionPlaceholder: "Tell people about programs, grades, or campus services.",
    category: "Schools",
    categories: ["School", "Schools", "College", "University"],
    emptyMessage: "No school listings yet.",
    savedName: "school",
  },
};

const businessServicePages = Object.keys(businessServiceSections);

const servicePageForBusinessCategory = (category) => {
  const normalizedCategory = String(category ?? "").trim().toLowerCase();
  const section = Object.values(businessServiceSections).find((config) =>
    config.categories.some((option) => option.toLowerCase() === normalizedCategory),
  );

  return section?.page ?? "";
};

const categorySectionMap = {
  "Food trucks": "eats",
  Restaurants: "eats",
  "Clubs & Bars": "nightlife",
  Barber: "barbers",
  "Barber Shop": "barbers",
  Barbershop: "barbers",
  "Sports & Fitness": "hotels",
  Gym: "hotels",
  "Fitness Center": "hotels",
  CrossFit: "hotels",
  Yoga: "hotels",
  Pilates: "hotels",
  Boxing: "hotels",
  "Martial Arts": "hotels",
  "Soccer Academy": "hotels",
  "Basketball Training": "hotels",
  "Baseball Training": "hotels",
  "Tennis Club": "hotels",
  "Swimming Pools": "hotels",
  "Dance Studio": "hotels",
  "Personal Trainer": "hotels",
  Rentals: "rentals",
  Groceries: "groceries",
  Grocery: "groceries",
  Shopping: "shopping",
  "Family & Kids": "family",
  Family: "family",
  Kids: "family",
  "Children Activities": "family",
  Dealer: "dealers",
  Dealers: "dealers",
  "Car Dealer": "dealers",
  "Auto Dealer": "dealers",
  Insurance: "insurance",
  "Insurance Companies": "insurance",
  Health: "health",
  Hospital: "health",
  Medical: "health",
  Clinic: "health",
  Dentist: "health",
  School: "schools",
  Schools: "schools",
  College: "schools",
  University: "schools",
  Others: "directory",
};

const businessImageForCategory = (category) => {
  if (category === "Clubs & Bars") {
    return appAsset("nightlife-station.jpg");
  }

  if (
    category === "Sports & Fitness" ||
    category === "Gym" ||
    category === "Fitness Center" ||
    category === "CrossFit" ||
    category === "Yoga" ||
    category === "Pilates" ||
    category === "Boxing" ||
    category === "Martial Arts" ||
    category === "Soccer Academy" ||
    category === "Basketball Training" ||
    category === "Baseball Training" ||
    category === "Tennis Club" ||
    category === "Swimming Pools" ||
    category === "Dance Studio" ||
    category === "Personal Trainer"
  ) {
    return appAsset("sports&fitness-bg.jpg");
  }

  if (category === "Food trucks" || category === "Restaurants") {
    return "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=900&q=80";
  }

  return appAsset("abilene-vibes-icon.png");
};

const visitUrl = (value) => {
  if (!value) {
    return "";
  }

  if (value.startsWith("@")) {
    return `https://instagram.com/${value.slice(1)}`;
  }

  return value.startsWith("http") ? value : `https://${value}`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not load"));
    });
    image.src = objectUrl;
  });

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Image could not be compressed"));
      },
      "image/jpeg",
      quality,
    );
  });

const optimizeGalleryImage = async (file) => {
  const maxStoredSize = 3 * 1024 * 1024;
  const maxDimension = 1800;
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.9, 0.84, 0.78, 0.72]) {
    const blob = await canvasToBlob(canvas, quality);

    if (blob.size <= maxStoredSize) {
      return readFileAsDataUrl(blob);
    }
  }

  throw new Error("Compressed image is too large");
};

function LobbyActionIcon({ icon }) {
  if (icon === "nightlife") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M15 12h34L34 32v15l10 5H20l10-5V32L15 12Z" />
        <path d="M19 18h26" />
        <path d="M34 12c4-6 10-7 18-4" />
        <path d="M34 12c1-7 6-10 14-10" />
      </svg>
    );
  }

  if (icon === "shopping") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M16 24h32l4 30H12l4-30Z" />
        <path d="M24 24v-6c0-5 4-9 8-9s8 4 8 9v6" />
        <path d="M24 34v1" />
        <path d="M40 34v1" />
      </svg>
    );
  }

  if (icon === "family") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="24" cy="15" r="7" />
        <path d="M13 57V39c0-8 5-14 11-14s11 6 11 14v18" />
        <circle cx="44" cy="25" r="5" />
        <path d="M35 57V43c0-7 4-12 9-12s9 5 9 12v14" />
      </svg>
    );
  }

  if (icon === "fitness") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 36h8V24H8v12Z" />
        <path d="M48 36h8V24h-8v12Z" />
        <path d="M16 40h8V20h-8v20Z" />
        <path d="M40 40h8V20h-8v20Z" />
        <path d="M24 30h16" />
      </svg>
    );
  }

  if (icon === "gallery") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 22h12l4-7h12l4 7h12v28H10V22Z" />
        <circle cx="32" cy="36" r="10" />
        <path d="M46 28h3" />
      </svg>
    );
  }

  if (icon === "directory") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M15 10h30c4 0 7 3 7 7v37H22c-4 0-7-3-7-7V10Z" />
        <path d="M22 10v44" />
        <rect x="31" y="31" width="13" height="12" rx="2" />
        <path d="M34 31v-4c0-3 2-5 4-5s4 2 4 5v4" />
      </svg>
    );
  }

  return <span aria-hidden="true">{icon}</span>;
}

function RentalBedroomIcon() {
  return (
    <svg className="rental-amenity-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11V6.5A2.5 2.5 0 0 1 6.5 4h4A2.5 2.5 0 0 1 13 6.5V11" />
      <path d="M4 11h16a2 2 0 0 1 2 2v5" />
      <path d="M2 18h20" />
      <path d="M4 18v2" />
      <path d="M20 18v2" />
      <path d="M13 8h4.5A2.5 2.5 0 0 1 20 10.5V11" />
    </svg>
  );
}

function RentalBathroomIcon() {
  return (
    <svg className="rental-amenity-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 11h16v1.5a5.5 5.5 0 0 1-5.5 5.5h-5A5.5 5.5 0 0 1 5 12.5V11Z" />
      <path d="M7 11V5.8A2.8 2.8 0 0 1 9.8 3H11" />
      <path d="M10 6h4" />
      <path d="M8 18l-1 2" />
      <path d="M18 18l1 2" />
    </svg>
  );
}

function ServiceIcon({ icon }) {
  if (icon === "news") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M14 14h30v38H14V14Z" />
        <path d="M44 22h6v30c0 3-2 5-5 5H19" />
        <path d="M21 24h16M21 32h16M21 40h10" />
      </svg>
    );
  }

  if (icon === "sales") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M12 18h40l-4 28H18L12 18Z" />
        <path d="M22 18c0-6 4-10 10-10s10 4 10 10" />
        <path d="M24 34h16" />
      </svg>
    );
  }

  if (icon === "groceries") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M16 24h36l-5 24H21l-5-24Z" />
        <path d="M22 24l8-12M46 24 34 12" />
        <path d="M25 34h18" />
      </svg>
    );
  }

  if (icon === "jobs") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M12 22h40v28H12V22Z" />
        <path d="M24 22v-6h16v6" />
        <path d="M12 32h40M29 32h6" />
      </svg>
    );
  }

  if (icon === "rents") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 32 32 14l22 18" />
        <path d="M16 30v24h32V30" />
        <path d="M26 54V40h12v14" />
      </svg>
    );
  }

  if (icon === "dealers") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M12 38h40l-5-14H17l-5 14Z" />
        <circle cx="22" cy="43" r="5" />
        <circle cx="42" cy="43" r="5" />
        <path d="M20 24l4-8h16l4 8" />
      </svg>
    );
  }

  if (icon === "insurance") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 10 14 18v14c0 12 7 21 18 26 11-5 18-14 18-26V18L32 10Z" />
        <path d="M24 33h16M32 25v16" />
      </svg>
    );
  }

  if (icon === "barber") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="21" cy="18" r="7" />
        <circle cx="21" cy="46" r="7" />
        <path d="M27 23l25 27M27 41l25-27" />
      </svg>
    );
  }

  if (icon === "health") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 54S13 43 13 27c0-8 5-13 12-13 4 0 7 2 7 5 0-3 3-5 7-5 7 0 12 5 12 13 0 16-19 27-19 27Z" />
        <path d="M24 32h16M32 24v16" />
      </svg>
    );
  }

  if (icon === "schools") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 26 32 14l24 12-24 12L8 26Z" />
        <path d="M18 32v12c7 6 21 6 28 0V32" />
        <path d="M56 26v17" />
      </svg>
    );
  }

  return null;
}

function PromoteCategoryIcon({ icon }) {
  if (icon === "foodTruck") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 22h30v24H8V22Z" />
        <path d="M38 30h10l8 8v8H38V30Z" />
        <path d="M15 22v-6h18v6" />
        <circle cx="20" cy="48" r="5" />
        <circle cx="48" cy="48" r="5" />
      </svg>
    );
  }

  if (icon === "restaurant") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M20 10v44" />
        <path d="M13 10v16c0 4 3 7 7 7s7-3 7-7V10" />
        <path d="M44 10c6 4 8 11 8 19 0 7-3 12-8 14v11" />
      </svg>
    );
  }

  if (icon === "bars") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M16 12h32L34 31v16l9 5H21l9-5V31L16 12Z" />
        <path d="M20 18h24" />
        <path d="M42 12c4-5 8-6 14-4" />
      </svg>
    );
  }

  if (icon === "barber") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="21" cy="18" r="7" />
        <circle cx="21" cy="46" r="7" />
        <path d="M27 23l25 27" />
        <path d="M27 41l25-27" />
      </svg>
    );
  }

  if (icon === "fitness") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 36h8V24H8v12Z" />
        <path d="M48 36h8V24h-8v12Z" />
        <path d="M16 40h8V20h-8v20Z" />
        <path d="M40 40h8V20h-8v20Z" />
        <path d="M24 30h16" />
      </svg>
    );
  }

  if (icon === "rentals") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="10" y="24" width="44" height="28" rx="2" />
        <path d="M18 24V16a14 14 0 0 1 28 0v8" />
        <path d="M26 38a6 6 0 1 0 12 0 6 6 0 0 0-12 0Z" />
        <path d="M32 35v-5" />
      </svg>
    );
  }

  if (icon === "groceries") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 12h8l6 28h22l6-20H20" />
        <circle cx="28" cy="50" r="4" />
        <circle cx="44" cy="50" r="4" />
      </svg>
    );
  }

  if (icon === "shopping") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M16 24h32l4 30H12l4-30Z" />
        <path d="M24 24v-6c0-5 4-9 8-9s8 4 8 9v6" />
        <path d="M24 34v1" />
        <path d="M40 34v1" />
      </svg>
    );
  }

  if (icon === "family") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="24" cy="15" r="7" />
        <path d="M13 57V39c0-8 5-14 11-14s11 6 11 14v18" />
        <circle cx="44" cy="25" r="5" />
        <path d="M35 57V43c0-7 4-12 9-12s9 5 9 12v14" />
      </svg>
    );
  }

  if (icon === "dealers") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="6" y="28" width="52" height="16" rx="3" />
        <path d="M12 28l6-14h28l6 14" />
        <circle cx="18" cy="46" r="6" />
        <circle cx="46" cy="46" r="6" />
        <path d="M24 46h20" />
      </svg>
    );
  }

  if (icon === "insurance") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 10l20 8v14c0 12-9 20-20 22C12 52 12 44 12 32V18l20-8Z" />
        <path d="M22 32l7 7 13-13" />
      </svg>
    );
  }

  if (icon === "health") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 52C18 44 8 36 8 24a12 12 0 0 1 24 0 12 12 0 0 1 24 0c0 12-10 20-24 28Z" />
        <path d="M22 24h20M32 14v20" />
      </svg>
    );
  }

  if (icon === "schools") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 10l28 14-28 14L4 24l28-14Z" />
        <path d="M16 31v14c0 4 7 8 16 8s16-4 16-8V31" />
        <path d="M56 24v14" />
        <circle cx="56" cy="40" r="3" />
      </svg>
    );
  }

  if (icon === "jobsHiring") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="18" y="26" width="28" height="22" rx="3" />
        <path d="M24 26v-5a8 8 0 0 1 16 0v5" />
        <path d="M32 34v6" />
        <path d="M28 37h8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="18" cy="32" r="5" />
      <circle cx="32" cy="32" r="5" />
      <circle cx="46" cy="32" r="5" />
    </svg>
  );
}

const distanceBetweenPointers = (firstPointer, secondPointer) => Math.hypot(
  firstPointer.clientX - secondPointer.clientX,
  firstPointer.clientY - secondPointer.clientY,
);

const midpointBetweenPointers = (firstPointer, secondPointer) => ({
  x: (firstPointer.clientX + secondPointer.clientX) / 2,
  y: (firstPointer.clientY + secondPointer.clientY) / 2,
});

function ImageViewer({ photo, onClose }) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  useEffect(() => {
    if (!photo) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, photo]);

  if (!photo) {
    return null;
  }

  const clampScale = (scale) => Math.min(4, Math.max(1, scale));

  const updatePointer = (event) => {
    pointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePointer(event);
    const pointers = Array.from(pointersRef.current.values());

    if (pointers.length === 1) {
      gestureRef.current = { type: "pan", pointer: pointers[0], transform };
    }

    if (pointers.length >= 2) {
      const midpoint = midpointBetweenPointers(pointers[0], pointers[1]);
      gestureRef.current = {
        type: "pinch",
        distance: distanceBetweenPointers(pointers[0], pointers[1]),
        midpoint,
        transform,
      };
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    updatePointer(event);
    const pointers = Array.from(pointersRef.current.values());
    const gesture = gestureRef.current;

    if (!gesture) {
      return;
    }

    if (pointers.length >= 2 && gesture.type === "pinch") {
      const midpoint = midpointBetweenPointers(pointers[0], pointers[1]);
      const distance = distanceBetweenPointers(pointers[0], pointers[1]);
      const nextScale = clampScale(gesture.transform.scale * (distance / Math.max(gesture.distance, 1)));

      setTransform({
        scale: nextScale,
        x: gesture.transform.x + midpoint.x - gesture.midpoint.x,
        y: gesture.transform.y + midpoint.y - gesture.midpoint.y,
      });
      return;
    }

    if (pointers.length === 1 && gesture.type === "pan") {
      const pointer = pointers[0];
      setTransform((currentTransform) => ({
        scale: currentTransform.scale,
        x: currentTransform.scale > 1 ? gesture.transform.x + pointer.clientX - gesture.pointer.clientX : 0,
        y: currentTransform.scale > 1 ? gesture.transform.y + pointer.clientY - gesture.pointer.clientY : 0,
      }));
    }
  };

  const handlePointerEnd = (event) => {
    pointersRef.current.delete(event.pointerId);
    const pointers = Array.from(pointersRef.current.values());

    if (pointers.length === 1) {
      gestureRef.current = { type: "pan", pointer: pointers[0], transform };
      return;
    }

    gestureRef.current = null;
  };

  const handleWheel = (event) => {
    event.preventDefault();
    setTransform((currentTransform) => {
      const nextScale = clampScale(currentTransform.scale + (event.deltaY < 0 ? 0.25 : -0.25));

      return {
        scale: nextScale,
        x: nextScale === 1 ? 0 : currentTransform.x,
        y: nextScale === 1 ? 0 : currentTransform.y,
      };
    });
  };

  const toggleZoom = () => {
    setTransform((currentTransform) => (
      currentTransform.scale > 1
        ? { scale: 1, x: 0, y: 0 }
        : { scale: 2.4, x: 0, y: 0 }
    ));
  };

  return (
    <div className="image-viewer" role="dialog" aria-modal="true" aria-label={photo.title || "Photo preview"}>
      <button className="image-viewer-close" type="button" onClick={onClose}>
        Close
      </button>
      <div
        className="image-viewer-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        onDoubleClick={toggleZoom}
      >
        <img
          src={photo.src}
          alt={photo.title || ""}
          draggable="false"
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          }}
        />
      </div>
      <p>{photo.title || "Photo"}</p>
    </div>
  );
}

function App() {
  const [page, setPage] = useState(pageFromLocation);
  const [isStarting, setIsStarting] = useState(true);
  const [weather, setWeather] = useState({
    temp: null,
    isDay: getAbileneIsDay(),
    label: abileneWeatherLabel,
    status: "loading",
    observedAt: null,
  });
  const [selectedCategory, setSelectedCategory] = useState(promoteCategories[0].label);
  const [selectedPlan, setSelectedPlan] = useState(promotePlans[0].name);
  const [showGroceryForm, setShowGroceryForm] = useState(false);
  const [openBusinessServiceFormPage, setOpenBusinessServiceFormPage] = useState("");
  const [selectedSportsFitnessSubcategory, setSelectedSportsFitnessSubcategory] = useState("");
  const [businessSubmitted, setBusinessSubmitted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [editingOwnerBusiness, setEditingOwnerBusiness] = useState(null);
  const [deletingOwnerBusiness, setDeletingOwnerBusiness] = useState(null);
  const [ownerBusinessStatus, setOwnerBusinessStatus] = useState("");
  const [hiddenStaticItems, setHiddenStaticItems] = useState([]);
  const [visitorKey] = useState(() => {
    const storageKey = "abilene-vibes-visitor";
    let storedVisitorKey = window.localStorage.getItem(storageKey);

    if (!storedVisitorKey) {
      storedVisitorKey = crypto.randomUUID();
      window.localStorage.setItem(storageKey, storedVisitorKey);
    }

    return storedVisitorKey;
  });
  const [likeCounts, setLikeCounts] = useState({});
  const [likedItems, setLikedItems] = useState([]);
  const [approvedReviews, setApprovedReviews] = useState({});
  const [reviewSubmissionStatus, setReviewSubmissionStatus] = useState({});
  const [approvedEvents, setApprovedEvents] = useState([]);
  const [eventSubmissionStatus, setEventSubmissionStatus] = useState("");
  const eventSubmissionInFlightRef = useRef(false);
  const [approvedGalleryPhotos, setApprovedGalleryPhotos] = useState([]);
  const [gallerySubmissionStatus, setGallerySubmissionStatus] = useState("");
  const [gallerySubmissionError, setGallerySubmissionError] = useState("");
  const [galleryOwnerDeleteStatus, setGalleryOwnerDeleteStatus] = useState("");
  const [adminSession, setAdminSession] = useState(null);
  const adminSessionRef = useRef(null); // keeps current value without triggering Realtime re-sub
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminStatus, setAdminStatus] = useState("");
  const [adminTab, setAdminTab] = useState("events");
  const [adminBusinessActionKey, setAdminBusinessActionKey] = useState("");
  const [deletingAdminBusiness, setDeletingAdminBusiness] = useState(null);
  const [adminGalleryActionKey, setAdminGalleryActionKey] = useState("");
  const [pendingGalleryPhotos, setPendingGalleryPhotos] = useState([]);
  const [publishedGalleryPhotos, setPublishedGalleryPhotos] = useState([]);
  const [pendingBusinesses, setPendingBusinesses] = useState([]);
  const [publishedBusinesses, setPublishedBusinesses] = useState([]);
  const [hiddenBusinesses, setHiddenBusinesses] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [adminJobListings, setAdminJobListings] = useState([]);
  const [adminJobActionKey, setAdminJobActionKey] = useState("");
  const [adminMarketplaceListings, setAdminMarketplaceListings] = useState([]);
  const [adminRentalListings, setAdminRentalListings] = useState([]);
  const [adminRentalStatusFilter, setAdminRentalStatusFilter] = useState("all");
  const [adminRentalActionKey, setAdminRentalActionKey] = useState("");
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [editingJob, setEditingJob] = useState(null);
  const [editJobPage, setEditJobPage] = useState(false);
  const [editingRental, setEditingRental] = useState(null);
  const [editRentalPage, setEditRentalPage] = useState(false);
  const [publishedEvents, setPublishedEvents] = useState([]);
  const [hiddenEvents, setHiddenEvents] = useState([]);
  const [deletedStaticItems, setDeletedStaticItems] = useState([]);
  const [localNewsItems, setLocalNewsItems] = useState([]);
  const [selectedNewsCategory, setSelectedNewsCategory] = useState("All");
  const [checkoutNotice, setCheckoutNotice] = useState(checkoutResultFromLocation);
  const [lobbyCarouselIndex, setLobbyCarouselIndex] = useState(0);
  const [premiumCarouselIndex, setPremiumCarouselIndex] = useState(0);
  const [businessReports, setBusinessReports] = useState([]);
  const [itemReports, setItemReports] = useState([]);
  const [imageViewerPhoto, setImageViewerPhoto] = useState(null);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState("All");
  const [myListingTab, setMyListingTab] = useState("Active");
  const [sellItemStatus, setSellItemStatus] = useState("");
  const [sellDuration, setSellDuration] = useState("30");
  const [ownerUserId, setOwnerUserId] = useState("");
  const effectiveOwnerId = ownerUserId || visitorKey;
  const [editingListing, setEditingListing] = useState(null);
  const [deletingListing, setDeletingListing] = useState(null);
  const [editDeleteStatus, setEditDeleteStatus] = useState("");
  const [marketplaceAdminStatusFilter, setMarketplaceAdminStatusFilter] = useState("pending");
  const [marketplaceActionKey, setMarketplaceActionKey] = useState("");
  const [sellItemPhotos, setSellItemPhotos] = useState([]);       // [{file, preview}] for sell form
  const [listingGalleryIndex, setListingGalleryIndex] = useState(0); // current photo index in detail view
  const [editListingPhotos, setEditListingPhotos] = useState([]); // existing photo data URLs in edit modal
  const [jobsSearch, setJobsSearch] = useState("");
  const [jobsFilter, setJobsFilter] = useState("All");
  const [jobsCategoryFilter, setJobsCategoryFilter] = useState("All");
  const [selectedJob, setSelectedJob] = useState(null);
  const [postJobForm, setPostJobForm] = useState({
    title: "", company: "", category: "", jobType: "", payMin: "", payMax: "",
    location: "Abilene, TX", contactPerson: "", phone: "", email: "", description: "", requirements: "",
    image: null, logo: null, appMethod: "Phone", duration: "30 Days", applyUrl: "", plan: "Free",
  });
  const [postJobImagePreview, setPostJobImagePreview] = useState(null);
  const [postJobLogoPreview, setPostJobLogoPreview] = useState(null);
  const [postJobStep, setPostJobStep] = useState("form"); // "form" | "preview" | "plan"
  const [postJobError, setPostJobError] = useState(null);
  const [postJobPublishing, setPostJobPublishing] = useState(false);
  const [postedJobs, setPostedJobs] = useState([]);
  const [editingOwnerJob, setEditingOwnerJob] = useState(null);
  const [deletingOwnerJob, setDeletingOwnerJob] = useState(null);
  const [ownerJobStatus, setOwnerJobStatus] = useState("");
  const [savedJobs, setSavedJobs] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem("av_saved_jobs") ?? "[]"); }
    catch { return []; }
  });
  const [savedMarketListings, setSavedMarketListings] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem("av_saved_market") ?? "[]"); }
    catch { return []; }
  });
  const [jobsShowSaved, setJobsShowSaved] = useState(false);

  // ── Rent & Housing state ──────────────────────────────────
  const [rentalListings, setRentalListings] = useState([]);
  const [rentalsSearch, setRentalsSearch] = useState("");
  const rentalSearchInputRef = useRef(null);
  const [rentalsTypeFilter, setRentalsTypeFilter] = useState("All");
  const [rentalsFilter, setRentalsFilter] = useState("All");
  const [selectedRental, setSelectedRental] = useState(null);
  const [savedRentals, setSavedRentals] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem("av_saved_rentals") ?? "[]"); }
    catch { return []; }
  });
  const [rentalsShowSaved, setRentalsShowSaved] = useState(false);
  const [postRentalForm, setPostRentalForm] = useState({
    title: "", propertyType: "Apartment", price: "", deposit: "",
    pricePerNight: "", pricePerWeek: "",
    availableFrom: "", availableTo: "", maxGuests: "", houseRules: "", petsAllowed: false,
    address: "Abilene, TX", bedrooms: "", bathrooms: "",
    description: "", contactPerson: "", phone: "", email: "", externalUrl: "",
    duration: "30 Days", plan: "Free",
  });
  const [postRentalStep, setPostRentalStep] = useState("form"); // "form" | "preview"
  const [postRentalPhotos, setPostRentalPhotos] = useState([]); // [{file, preview}]
  const [postRentalError, setPostRentalError] = useState(null);
  const [postRentalPublishing, setPostRentalPublishing] = useState(false);
  const [editingOwnerRental, setEditingOwnerRental] = useState(null);
  const [deletingOwnerRental, setDeletingOwnerRental] = useState(null);
  const [ownerRentalStatus, setOwnerRentalStatus] = useState("");
  // ── End Rent & Housing state ──────────────────────────────
  const [rentalGalleryIdx, setRentalGalleryIdx] = useState(0);
  const rentalGalleryRef = useRef(null);

  const imageViewerPhotoRef = useRef(null);
  const gallerySwipeTouchRef = useRef(null); // tracks touchstart X for marketplace-item swipe
  // Single ref that always mirrors current React state for the backButton handler.
  // Updated after every relevant render — handler reads .current directly, no stale closures.
  const backHandlerStateRef = useRef({
    page,
    imageViewerPhoto: null,
    postJobStep: "form",
    postRentalStep: "form",
    showGroceryForm: false,
    openBusinessServiceFormPage: "",
    selectedSportsFitnessSubcategory: "",
  });
  const pageRef = useRef(page);
  const previousPageRef = useRef(page);
  const directoryReturnRef = useRef("lobby"); // tracks where directory was opened from
  const legalReturnRef = useRef("lobby"); // tracks where Terms/Privacy were opened from
  // Tracks page for the Capacitor backButton handler ONLY — not updated by popstate/URL sync
  // so that browser history.back() firing popstate before backButton doesn't corrupt it.
  const backButtonPageRef = useRef(page);
  // Boolean flag: true ONLY while the user is viewing a marketplace listing detail.
  // Set by openListing(), cleared by Back or the UI "Back to Marketplace" button.
  // Immune to all popstate/URL/pageRef race conditions.
  const inListingDetailRef = useRef(false);

  useEffect(() => {
    if (page === "sell-item" && previousPageRef.current !== "sell-item") {
      setSellItemStatus("");
    }

    if (previousPageRef.current === "news" && page === "lobby") {
      pageRef.current = "more";
      previousPageRef.current = "more";
      window.history.replaceState({ page: "more" }, "", urlForPage("more"));
      setPage("more");
      return;
    }

    previousPageRef.current = page;
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    imageViewerPhotoRef.current = imageViewerPhoto;
  }, [imageViewerPhoto]);

  // Keep backHandlerStateRef in sync after every relevant render.
  useEffect(() => {
    backHandlerStateRef.current = {
      page,
      imageViewerPhoto,
      postJobStep,
      postRentalStep,
      showGroceryForm,
      openBusinessServiceFormPage,
      selectedSportsFitnessSubcategory,
    };
  }, [
    page,
    imageViewerPhoto,
    postJobStep,
    postRentalStep,
    showGroceryForm,
    openBusinessServiceFormPage,
    selectedSportsFitnessSubcategory,
  ]);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => {
      setIsStarting(false);
    }, 3000);

    return () => {
      window.clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    window.history.replaceState({ page: pageFromLocation() }, "", window.location.href);

    const syncPageFromUrl = () => {
      const nextPage = pageFromLocation();

      if (pageRef.current === "news" && nextPage !== "more") {
        window.history.replaceState({ page: "more" }, "", urlForPage("more"));
        pageRef.current = "more";
        setPage("more");
        setCheckoutNotice(checkoutResultFromLocation());
        window.scrollTo(0, 0);
        return;
      }

      pageRef.current = nextPage;
      setPage(nextPage);
      setCheckoutNotice(checkoutResultFromLocation());
      window.scrollTo(0, 0);
    };

    window.addEventListener("popstate", syncPageFromUrl);
    window.addEventListener("hashchange", syncPageFromUrl);

    return () => {
      window.removeEventListener("popstate", syncPageFromUrl);
      window.removeEventListener("hashchange", syncPageFromUrl);
    };
  }, []);


  // ── Public data loaders (called by useEffect + Realtime subscriptions) ────

  const loadJobsPublic = useCallback(() => {
    if (!supabase) return;
    supabase
      .from("job_listings")
      .select("id,created_at,title,company,category,job_type,pay_label,location,contact_person,phone,email,description,requirements,app_method,apply_url,duration,plan,payment_status,image_data,logo_data,expires_at,placement_expires_at,owner_user_id")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          const now = Date.now();
          const isExpired = (value) => {
            if (!value) return false;
            const time = Date.parse(value);
            return Number.isFinite(time) && time <= now;
          };
          setPostedJobs(
            data.filter((row) => {
              const plan = String(row.plan ?? "free").toLowerCase();
              const paymentStatus = String(row.payment_status ?? "").toLowerCase();
              const isPaidPlan = plan === "featured" || plan === "premium";
              if (isPaidPlan && paymentStatus === "pending") return false;
              if (isExpired(row.expires_at)) return false;
              if (isPaidPlan && isExpired(row.placement_expires_at)) return false;
              return true;
            }).map((row) => ({
              id: row.id,
              created_at: row.created_at,
              expires_at: row.expires_at,
              title: row.title,
              company: row.company,
              pay: row.pay_label || "Pay not specified",
              location: row.location,
              type: row.job_type,
              schedule: "",
              category: row.category,
              posted: formatJobPosted(row.created_at),
              tag: row.plan === "free" ? "New Today" : row.plan === "featured" ? "Featured" : "Premium",
              filters: [row.job_type, "New Today"],
              image: row.image_data,
              description: row.description,
              requirements: row.requirements,
              contactPerson: row.contact_person,
              contact: row.phone,
              email: row.email,
              appMethod: row.app_method,
              applyUrl: row.apply_url,
              duration: row.duration,
              plan: row.plan,
              owner_user_id: row.owner_user_id,
              ownerUserId: row.owner_user_id,
            })),
          );
        }
      });
  }, []);

  const loadRentalsPublic = useCallback(() => {
    if (!supabase) return;
    const baseSelect = "id,created_at,expires_at,title,property_type,price,deposit,price_per_night,price_per_week,available_from,available_to,max_guests,house_rules,pets_allowed,address,contact_person,bedrooms,bathrooms,description,phone,email,external_url,duration,plan,status,payment_status,placement_source,placement_expires_at,image_data";
    const queryRentals = (selectFields) =>
      supabase
        .from("rental_listings")
        .select(selectFields)
        .eq("status", "approved")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });

    queryRentals(`${baseSelect},owner_user_id`).then(({ data, error }) => {
      if (!error && data) {
        setRentalListings(data);
        return;
      }
      if (error?.code !== "42703") return;
      queryRentals(baseSelect).then(({ data: fallbackData, error: fallbackError }) => {
        if (!fallbackError && fallbackData) setRentalListings(fallbackData);
      });
    });
  }, []);

  const loadBusinessesPublic = useCallback(() => {
    if (!supabase) return;
    const baseSelect = "id,business_name,category,contact_name,contact_email,phone,address,social,description,image_data,plan,payment_status,placement_source,placement_expires_at";
    const queryBusinesses = (selectFields) =>
      supabase
        .from("business_submissions")
        .select(selectFields)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

    queryBusinesses(`${baseSelect},owner_user_id`).then(({ data, error }) => {
      if (!error && data) {
        setBusinesses(data.map(businessSubmissionToBusiness));
        return;
      }
      if (error?.code !== "42703") return;
      queryBusinesses(baseSelect).then(({ data: fallbackData, error: fallbackError }) => {
        if (!fallbackError && fallbackData) setBusinesses(fallbackData.map(businessSubmissionToBusiness));
      });
    });
  }, []);

  const loadGalleryPublic = useCallback(() => {
    if (!supabase) return;
    supabase
      .from("gallery_submissions")
      .select("id,title,image_data,owner_user_id")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setApprovedGalleryPhotos(
            data.map((photo) => ({
              id: photo.id,
              title: photo.title,
              image: photo.image_data,
              owner_user_id: photo.owner_user_id ?? "",
            })),
          );
        }
      });
  }, []);

  const loadEventsPublic = useCallback(() => {
    if (!supabase) return;
    const today = localDateInputValue();
    supabase
      .from("event_submissions")
      .select("id,title,place,description,map_url,website_url,ticket_url,event_date,end_date,event_time,end_time,event_type,image_url,image_data,status")
      .eq("status", "approved")
      .or(`end_date.gte.${today},and(end_date.is.null,event_date.gte.${today})`)
      .order("event_date", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setApprovedEvents(data.filter(isPublicEventActive).map(eventSubmissionToEvent));
        }
      });
  }, []);

  useEffect(() => {
    if (!approvedEvents.length) {
      return;
    }

    let intervalId;
    const pruneExpiredEvents = () => {
      setApprovedEvents((currentEvents) => {
        const activeEvents = currentEvents.filter(isPublicEventActive);
        return activeEvents.length === currentEvents.length ? currentEvents : activeEvents;
      });
    };
    const now = new Date();
    const delayToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    const timeoutId = window.setTimeout(() => {
      pruneExpiredEvents();
      intervalId = window.setInterval(pruneExpiredEvents, 60000);
    }, delayToNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [approvedEvents]);

  const loadNewsPublic = useCallback(() => {
    if (!supabase) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    supabase
      .from("local_news_items")
      .select("id,title,summary,image_url,source_name,source_url,original_url,published_at,news_category,mood_label,verification_status")
      .eq("status", "approved")
      .gte("published_at", weekStart.toISOString())
      .order("published_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error || !data) { setLocalNewsItems([]); return; }
        setLocalNewsItems(data);
      });
  }, []);

  const loadReviewsPublic = useCallback(() => {
    if (!supabase) return;
    supabase
      .from("business_reviews")
      .select("id,created_at,business_id,business_name,reviewer_name,rating,comment")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error || !data) return;
        const nextReviews = data.reduce((groups, review) => {
          groups[review.business_id] = [...(groups[review.business_id] ?? []), review];
          return groups;
        }, {});
        setApprovedReviews(nextReviews);
      });
  }, []);

  const loadMarketplacePublic = useCallback(() => {
    if (!supabase) return;
    supabase.rpc("expire_marketplace_listings").then(() => {
      supabase
        .rpc("list_marketplace_listings", { owner_id: "" })
        .then(({ data, error }) => {
          if (!error && data) {
            setMarketplaceListings(data.map(mapListingFromDb));
            return;
          }

          const nowIso = new Date().toISOString();
          supabase
            .from("marketplace_listings")
            .select("id,created_at,expires_at,sold_at,deleted_at,title,price,category,location,contact,description,image_data,status,owner_user_id,moderation_status")
            .eq("status", "active")
            .eq("moderation_status", "approved")
            .is("deleted_at", null)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order("created_at", { ascending: false })
            .then(({ data: fallbackData, error: fallbackError }) => {
              if (!fallbackError && fallbackData) setMarketplaceListings(fallbackData.map(mapListingFromDb));
            });
        });
    });
  }, []);

  // Keep adminSessionRef in sync so Realtime callbacks always see the latest value
  useEffect(() => { adminSessionRef.current = adminSession; }, [adminSession]);

  // Refs so the popstate listener can read current modal state without stale closure
  const editingJobRef = useRef(null);
  const editingListingRef = useRef(null);
  useEffect(() => { editingJobRef.current = editingJob; }, [editingJob]);
  useEffect(() => { editingListingRef.current = editingListing; }, [editingListing]);
  // Admin back-button trap for mobile browsers (Android physical back button).
  // When the admin is logged in, keep one "sentinel" entry above the real history so
  // pressing Back pops that entry (triggering popstate) instead of leaving the page.
  // The listener closes any open modal and immediately repushes the sentinel.
  useEffect(() => {
    if (!adminSession) return;
    history.pushState({ adminModal: true }, '');
    const onPopState = () => {
      if (editingJobRef.current) {
        setEditingJob(null);
        setEditJobPage(false);
      } else if (editingListingRef.current) {
        setEditingListing(null);
      }
      // Repush sentinel so the next back press is also intercepted
      history.pushState({ adminModal: true }, '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [adminSession]);

  useEffect(() => {
    let isMounted = true;

    const loadAbileneWeather = async () => {
      setWeather({
        temp: null,
        isDay: getAbileneIsDay(),
        label: abileneWeatherLabel,
        status: "loading",
        observedAt: null,
      });

      try {
        const response = await fetch(abileneWeatherObservationUrl, {
          headers: { Accept: "application/geo+json" },
        });

        if (!response.ok) {
          throw new Error("Weather unavailable");
        }

        const data = await response.json();
        const temperatureCelsius = data.properties?.temperature?.value;
        const observedAt = data.properties?.timestamp ?? null;

        if (typeof temperatureCelsius !== "number") {
          throw new Error("Weather temperature unavailable");
        }

        if (!observedAt || Date.now() - new Date(observedAt).getTime() > abileneWeatherMaxAgeMs) {
          throw new Error("Weather observation is stale");
        }

        const iconUrl = data.properties?.icon ?? "";
        const isDay = iconUrl.includes("/day/")
          ? true
          : iconUrl.includes("/night/")
            ? false
            : getAbileneIsDay();
        const temp = Math.round((temperatureCelsius * 9) / 5 + 32);

        if (isMounted) {
          setWeather({ temp, isDay, label: abileneWeatherLabel, status: "ready", observedAt });
        }
      } catch (err) {
        console.warn("[Weather] Could not load live Abilene temperature:", err);
        if (isMounted) {
          setWeather({
            temp: null,
            isDay: getAbileneIsDay(),
            label: abileneWeatherLabel,
            status: "error",
            observedAt: null,
          });
        }
      }
    };

    loadAbileneWeather();
    const weatherRefresh = window.setInterval(loadAbileneWeather, abileneWeatherRefreshMs);

    return () => {
      isMounted = false;
      window.clearInterval(weatherRefresh);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !visitorKey) {
      return;
    }

    supabase
      .from("public_likes")
      .select("item_type,item_key,visitor_key")
      .then(({ data, error }) => {
        if (error || !data) {
          return;
        }

        const nextLikeCounts = data.reduce((counts, like) => {
          const key = `${like.item_type}:${like.item_key}`;
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        }, {});

        setLikeCounts(nextLikeCounts);
        setLikedItems(
          data
            .filter((like) => like.visitor_key === visitorKey)
            .map((like) => `${like.item_type}:${like.item_key}`),
        );
      });

    loadReviewsPublic();
    loadNewsPublic();
    loadEventsPublic();
  }, [visitorKey, loadReviewsPublic, loadNewsPublic, loadEventsPublic]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    loadBusinessesPublic();
    loadGalleryPublic();
    loadMarketplacePublic();
    loadJobsPublic();
    loadRentalsPublic();

    supabase
      .from("hidden_static_items")
      .select("item_key,item_type")
      .then(({ data, error }) => {
        if (!error && data) {
          setHiddenStaticItems(data.filter((item) => item.item_type !== "deleted").map((item) => item.item_key));
          setDeletedStaticItems(data.filter((item) => item.item_type === "deleted").map((item) => item.item_key));
        }
      });
  }, [loadBusinessesPublic, loadGalleryPublic, loadMarketplacePublic, loadJobsPublic, loadRentalsPublic]);

  // ── Persist saved jobs across sessions ──────────────────────────────────
  useEffect(() => {
    try { window.localStorage.setItem("av_saved_jobs", JSON.stringify(savedJobs)); }
    catch { /* ignore */ }
  }, [savedJobs]);

  // ── Persist saved market listings across sessions ────────────────────────
  useEffect(() => {
    try { window.localStorage.setItem("av_saved_market", JSON.stringify(savedMarketListings)); }
    catch { /* ignore */ }
  }, [savedMarketListings]);

  // ── Persist saved rentals across sessions ────────────────────────────────
  useEffect(() => {
    try { window.localStorage.setItem("av_saved_rentals", JSON.stringify(savedRentals)); }
    catch { /* ignore */ }
  }, [savedRentals]);

  // ── Supabase Realtime: auto-refresh on any table change ─────────────────
  // adminSession intentionally excluded from deps — use adminSessionRef.current
  // so auth state changes never tear down and rebuild the channels.
  useEffect(() => {
    if (!supabase) return;

    // Reads the ref — always current, never stale, never causes re-sub
    const reloadAdmin = () => {
      if (adminSessionRef.current) loadAdminData(adminSessionRef.current);
    };
    const reloadAdminJobs = () => {
      if (adminSessionRef.current) loadAdminJobs(adminSessionRef.current);
    };
    const reloadAdminBusinesses = () => {
      if (adminSessionRef.current) loadAdminBusinesses(adminSessionRef.current);
    };
    const reloadAdminGallery = () => {
      if (adminSessionRef.current) loadAdminGallery(adminSessionRef.current);
    };
    const reloadAdminRentals = () => {
      if (adminSessionRef.current) loadAdminRentals(adminSessionRef.current);
    };

    const mkChannel = (name, table, handler) =>
      supabase
        .channel(name)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          handler();
        })
        .subscribe((_status, err) => {
          if (err) {
            console.error(`[Realtime] ${name} error:`, err);
          }
        });

    const channels = [
      mkChannel("rt-job_listings",         "job_listings",         () => { loadJobsPublic();       reloadAdminJobs(); }),
      mkChannel("rt-rental_listings",      "rental_listings",      () => { loadRentalsPublic();    reloadAdminRentals(); }),
      mkChannel("rt-business_submissions",  "business_submissions",  () => { loadBusinessesPublic(); reloadAdminBusinesses(); }),
      mkChannel("rt-gallery_submissions",   "gallery_submissions",   () => { loadGalleryPublic();    reloadAdminGallery(); }),
      mkChannel("rt-event_submissions",     "event_submissions",     () => { loadEventsPublic();     reloadAdmin(); }),
      mkChannel("rt-business_reviews",      "business_reviews",      () => { loadReviewsPublic();    reloadAdmin(); }),
      mkChannel("rt-marketplace_listings",  "marketplace_listings",  () => { loadMarketplacePublic(); }),
      mkChannel("rt-local_news_items",      "local_news_items",      () => { loadNewsPublic(); }),
    ];

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, loadJobsPublic, loadRentalsPublic, loadBusinessesPublic, loadGalleryPublic, loadEventsPublic, loadReviewsPublic, loadMarketplacePublic, loadNewsPublic]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAdminSession(data.session);
      setOwnerUserId(data.session?.user?.id ?? "");
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminSession(session);
      setOwnerUserId(session?.user?.id ?? "");
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const navigateTo = useCallback((nextPage, options = {}) => {
    pageRef.current = nextPage;
    backButtonPageRef.current = nextPage; // intentional nav only — immune to popstate race
    setPage(nextPage);

    if (options.replace) {
      window.history.replaceState({ page: nextPage }, "", urlForPage(nextPage));
    } else {
      window.history.pushState({ page: nextPage }, "", urlForPage(nextPage));
    }

    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let backButtonListener;

    CapacitorApp.addListener("backButton", () => {
      // Read exclusively from backHandlerStateRef — always reflects latest React state,
      // immune to stale closures, popstate races, and indirect ref timing issues.
      const {
        page: currentPage,
        imageViewerPhoto: currentPhoto,
        postJobStep: currentPostJobStep,
        showGroceryForm: currentShowGroceryForm,
        openBusinessServiceFormPage: currentOpenBusinessServiceFormPage,
        selectedSportsFitnessSubcategory: currentSportsFitnessSubcategory,
      } = backHandlerStateRef.current;

      // 1. Zoom overlay — close it, stay on current page.
      if (currentPhoto) {
        setImageViewerPhoto(null);
        return;
      }

      // 2. Home screen — exit app.
      if (currentPage === "home") {
        CapacitorApp.exitApp();
        return;
      }

      // 3. Lobby — go home.
      if (currentPage === "lobby") {
        navigateTo("home");
        return;
      }

      // 4. Marketplace detail — always back to marketplace list.
      if (currentPage === "marketplace-item") {
        navigateTo("marketplace", { replace: true });
        return;
      }

      // 5. Sell item form — back to marketplace list.
      if (currentPage === "sell-item") {
        navigateTo("marketplace", { replace: true });
        return;
      }

      // 6. Top-level tabs — back to Service page.
      if (currentPage === "groceries" && currentShowGroceryForm) {
        setShowGroceryForm(false);
        setBusinessSubmitted(false);
        setSubmissionStatus("");
        return;
      }

      if (businessServicePages.includes(currentPage) && currentOpenBusinessServiceFormPage === currentPage) {
        if (currentPage === "hotels" && currentSportsFitnessSubcategory) {
          setSelectedSportsFitnessSubcategory("");
          setBusinessSubmitted(false);
          setSubmissionStatus("");
          return;
        }

        setOpenBusinessServiceFormPage("");
        if (currentPage === "hotels") {
          setSelectedSportsFitnessSubcategory("");
        }
        setBusinessSubmitted(false);
        setSubmissionStatus("");
        return;
      }

      if (currentPage === "family") {
        navigateTo("lobby", { replace: true });
        return;
      }

      if (currentPage === "shopping" || currentPage === "nightlife" || currentPage === "eats" || currentPage === "hotels") {
        navigateTo("lobby", { replace: true });
        return;
      }

      if (
        currentPage === "news" ||
        currentPage === "marketplace" ||
        (businessServicePages.includes(currentPage) && currentPage !== "family" && currentPage !== "hotels") ||
        currentPage === "jobs" ||
        currentPage === "rentals"
      ) {
        navigateTo("more", { replace: true });
        return;
      }

      // 7. Post-job wizard — step back or exit to jobs.
      if (currentPage === "post-job") {
        if (currentPostJobStep === "plan") { setPostJobStep("preview"); }
        else if (currentPostJobStep === "preview") { setPostJobStep("form"); }
        else { navigateTo("jobs", { replace: true }); }
        return;
      }

      // 8. Job detail — back to jobs.
      if (currentPage === "job-detail") {
        navigateTo("jobs", { replace: true });
        return;
      }

      // 8b. Rental detail — back to rentals.
      if (currentPage === "rental-detail") {
        navigateTo("rentals", { replace: true });
        return;
      }
      // 8c. post-rental: preview → form; form → rentals.
      if (currentPage === "post-rental") {
        if (backHandlerStateRef.current.postRentalStep === "preview") {
          setPostRentalStep("form");
        } else {
          navigateTo("rentals", { replace: true });
        }
        return;
      }

      // 9. Directory — return to wherever it was opened from.
      if (currentPage === "directory") {
        const ret = directoryReturnRef.current;
        directoryReturnRef.current = "lobby";
        navigateTo(ret, { replace: true });
        return;
      }

      if (currentPage === "terms" || currentPage === "privacy") {
        const ret = legalReturnRef.current || "lobby";
        legalReturnRef.current = "lobby";
        navigateTo(ret, { replace: true });
        return;
      }

      // Default — back to lobby.
      navigateTo("lobby", { replace: true });
    }).then((listener) => {
      backButtonListener = listener;
    });

    return () => {
      backButtonListener?.remove();
    };
  }, [navigateTo]);

  const backToLobby = () => {
    navigateTo("lobby", { replace: true });
  };

  const backFromLegal = () => {
    const ret = legalReturnRef.current || "lobby";
    legalReturnRef.current = "lobby";
    navigateTo(ret, { replace: true });
  };

  const handleRequiredInvalid = (event) => {
    event.currentTarget.setCustomValidity("Please complete this field.");
  };

  const handleRequiredInput = (event) => {
    event.currentTarget.setCustomValidity("");
  };

  const handleBusinessSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const requiredFields = ["businessName", "contactName", "contactEmail", "phone"];
    const isMissingRequiredField = requiredFields.some((fieldName) => !String(formData.get(fieldName) ?? "").trim());

    if (isMissingRequiredField || formData.get("contentRights") !== "on") {
      setBusinessSubmitted(true);
      setSubmissionStatus("validation-error");
      return;
    }

    const imageFile = formData.get("businessImage");
    const imageData = imageFile && imageFile.size ? await optimizeGalleryImage(imageFile) : "";
    const submissionId = crypto.randomUUID();
    const submissionCategory = String(formData.get("categoryOverride") || selectedCategory);
    const submissionPlan = String(formData.get("planOverride") || selectedPlan);
    const businessServicePage = servicePageForBusinessCategory(submissionCategory);
    const isBusinessServiceSubmission = Boolean(businessServicePage);
    const business = {
      id: submissionId,
      name: formData.get("businessName").trim(),
      contactName: formData.get("contactName").trim(),
      contactEmail: formData.get("contactEmail").trim(),
      category: submissionCategory,
      phone: formData.get("phone").trim(),
      social: formData.get("social").trim(),
      address: formData.get("address").trim(),
      description: formData.get("description").trim(),
      image: imageData,
      plan: submissionPlan,
    };

    setSubmissionStatus("saving");

    const isSupabaseSubmission = Boolean(supabase);

    if (isSupabaseSubmission) {
      const { error } = await supabase.from("business_submissions").insert({
        id: submissionId,
        business_name: business.name,
        contact_name: business.contactName,
        contact_email: business.contactEmail,
        category: business.category,
        plan: business.plan,
        phone: business.phone,
        address: business.address,
        social: business.social,
        description: business.description,
        image_data: imageData,
        content_rights_confirmed: formData.get("contentRights") === "on",
        status: "pending",
        payment_status: business.plan === "Free" ? "not_required" : "pending",
        placement_source: "paid",
        owner_user_id: effectiveOwnerId,
      });

      if (error) {
        console.error("Business submission failed", error);
        setSubmissionStatus("error");
        return;
      }

      setSubmissionStatus("saved");
    } else {
      setSubmissionStatus("local");
      setBusinesses((currentBusinesses) => [business, ...currentBusinesses]);
    }

    setBusinessSubmitted(true);

    if (isSupabaseSubmission && paidPlanNames.has(submissionPlan)) {
      setSubmissionStatus("checkout");
      const returnUrl = window.location.origin.startsWith("https://") ? window.location.origin : "";
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          submissionId,
          plan: submissionPlan,
          businessName: business.name,
          contactEmail: business.contactEmail,
          returnUrl,
        },
      });

      if (data?.url) {
        openCheckoutUrl(data.url);
        if (isBusinessServiceSubmission) {
          form.reset();
          if (businessServicePage === "groceries") {
            setShowGroceryForm(false);
          }
          setOpenBusinessServiceFormPage("");
          setBusinessSubmitted(false);
          setSubmissionStatus("");
        }
        return;
      }

      if (error) {
        console.error("Checkout session failed", error);
      }
      setSubmissionStatus(error?.message?.includes("APP_PUBLIC_URL") ? "checkout-config" : "checkout-error");
      return;
    }

    if (isBusinessServiceSubmission) {
      form.reset();
      if (businessServicePage === "groceries") {
        setShowGroceryForm(false);
      }
      setOpenBusinessServiceFormPage("");
      setBusinessSubmitted(false);
      setSubmissionStatus("");
      if (isSupabaseSubmission) {
        loadBusinessesPublic();
      }
      return;
    }

    form.reset();
  };

  const handleGallerySubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setGallerySubmissionStatus("saving");
    setGallerySubmissionError("");

    if (!supabase) {
      setGallerySubmissionStatus("missing-config");
      return;
    }

    const formData = new FormData(form);
    const file = formData.get("photo");

    if (!file || !file.size) {
      setGallerySubmissionStatus("error");
      setGallerySubmissionError("No photo file was selected.");
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
      setGallerySubmissionStatus("file-error");
      return;
    }

    try {
      const imageData = await optimizeGalleryImage(file);
      const galleryPayload = {
        contributor_name: formData.get("contributorName").trim(),
        title: formData.get("title").trim(),
        image_data: imageData,
        owner_user_id: effectiveOwnerId,
        content_rights_confirmed: formData.get("contentRights") === "on",
        status: "pending",
      };
      const isOwnerSchemaCacheError = (error) =>
        error?.code === "PGRST204" &&
        `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase().includes("owner_user_id");
      let { error } = await supabase.from("gallery_submissions").insert(galleryPayload);

      if (isOwnerSchemaCacheError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        ({ error } = await supabase.from("gallery_submissions").insert(galleryPayload));
      }

      if (error) {
        setGallerySubmissionStatus("error");
        setGallerySubmissionError(`${error.code ?? "Upload error"}: ${error.message}`);
        return;
      }

      form.reset();
      setGallerySubmissionError("");
      setGallerySubmissionStatus("saved");
    } catch (error) {
      setGallerySubmissionStatus("error");
      setGallerySubmissionError(error instanceof Error ? error.message : "The image could not be processed.");
    }
  };

  const isGalleryPhotoOwner = (photo) => !!(photo?.owner_user_id && photo.owner_user_id === effectiveOwnerId);

  const handleOwnerGalleryDelete = async (photo) => {
    if (!supabase || !isGalleryPhotoOwner(photo)) {
      return;
    }

    if (!window.confirm("Delete this photo from Abilene Vibes Gallery?")) {
      return;
    }

    setGalleryOwnerDeleteStatus(`${photo.id}:deleting`);
    const { data, error } = await supabase.rpc("owner_delete_gallery_photo", {
      photo_id: photo.id,
      owner_id: effectiveOwnerId,
    });

    if (error || data !== true) {
      setGalleryOwnerDeleteStatus(`${photo.id}:error`);
      return;
    }

    setApprovedGalleryPhotos((photos) => photos.filter((item) => item.id !== photo.id));
    setGalleryOwnerDeleteStatus("");
  };

  const handleLike = async (itemType, itemKey) => {
    if (!supabase || !visitorKey) {
      return;
    }

    const likeKey = `${itemType}:${itemKey}`;

    if (likedItems.includes(likeKey)) {
      return;
    }

    setLikedItems((currentItems) => [...currentItems, likeKey]);
    setLikeCounts((currentCounts) => ({
      ...currentCounts,
      [likeKey]: (currentCounts[likeKey] ?? 0) + 1,
    }));

    const { error } = await supabase.from("public_likes").insert({
      item_type: itemType,
      item_key: itemKey,
      visitor_key: visitorKey,
    });

    if (error) {
      setLikedItems((currentItems) => currentItems.filter((item) => item !== likeKey));
      setLikeCounts((currentCounts) => ({
        ...currentCounts,
        [likeKey]: Math.max((currentCounts[likeKey] ?? 1) - 1, 0),
      }));
    }
  };

  const trackPublicItemClick = async (itemType, itemKey, itemName) => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("public_item_interactions").insert({
      item_type: itemType,
      item_key: itemKey,
      item_name: itemName,
      action_type: "click",
    });

    if (error) {
      console.warn("Abilene Vibes click tracking failed", error);
    }
  };

  const trackLobbySectionClick = (itemKey, itemName) =>
    trackPublicItemClick("service", `lobby-${itemKey}`, `Lobby: ${itemName}`);

  const navigateWithLobbyClick = async (itemKey, itemName, nextPage) => {
    await trackLobbySectionClick(itemKey, itemName);
    navigateTo(nextPage);
  };

  const paidOrPromoBusinesses = [...pendingBusinesses, ...publishedBusinesses, ...hiddenBusinesses]
    .filter((business) => business.plan && business.plan !== "Free")
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

  const paymentBusinesses = paidOrPromoBusinesses.filter((business) => business.placement_source !== "comp");
  const promoBusinesses = paidOrPromoBusinesses.filter((business) => business.placement_source === "comp");
  const paymentBusinessesById = paymentBusinesses.reduce((businessesById, business) => {
    businessesById[business.id] = business;
    return businessesById;
  }, {});
  const paymentRecordsByBusiness = paymentRecords.reduce((records, record) => {
    if (!record.business_submission_id) {
      return records;
    }

    const current = records[record.business_submission_id];
    const currentTime = current?.paid_at ? new Date(current.paid_at).getTime() : 0;
    const recordTime = record.paid_at ? new Date(record.paid_at).getTime() : 0;

    if (!current || recordTime >= currentTime) {
      records[record.business_submission_id] = record;
    }

    return records;
  }, {});
  const paymentFinancialSummary = paymentRecords.reduce(
    (summary, record) => ({
      gross: summary.gross + Number(record.gross_amount ?? 0),
      fees: summary.fees + Number(record.stripe_fee ?? 0),
      net: summary.net + Number(record.net_amount ?? 0),
    }),
    { gross: 0, fees: 0, net: 0 },
  );
  const paymentSummaryCurrency = paymentRecords[0]?.currency ?? "usd";
  const paymentEarningsByBusiness = Object.values(paymentRecords.reduce((earnings, record) => {
    const businessId = record.business_submission_id ?? record.stripe_payment_intent_id ?? record.id;
    const business = paymentBusinessesById[record.business_submission_id];

    if (!earnings[businessId]) {
      earnings[businessId] = {
        id: businessId,
        name: business?.business_name ?? (record.business_submission_id ? `Business ${record.business_submission_id}` : "Stripe payment"),
        currency: record.currency ?? "usd",
        gross: 0,
        fees: 0,
        net: 0,
        payments: 0,
      };
    }

    earnings[businessId].gross += Number(record.gross_amount ?? 0);
    earnings[businessId].fees += Number(record.stripe_fee ?? 0);
    earnings[businessId].net += Number(record.net_amount ?? 0);
    earnings[businessId].payments += 1;

    return earnings;
  }, {})).sort((left, right) => right.net - left.net);

  const paymentSummary = paymentBusinesses.reduce(
    (summary, business) => {
      const status = business.payment_status ?? "pending";
      summary.total += 1;
      summary[status] = (summary[status] ?? 0) + 1;
      if (activePaidPaymentStatuses.has(status)) {
        summary.activePaid += 1;
      }
      return summary;
    },
    { total: 0, activePaid: 0 },
  );

  const handleReviewSubmit = async (event, business) => {
    event.preventDefault();

    if (!supabase) {
      setReviewSubmissionStatus((currentStatus) => ({ ...currentStatus, [business.id]: "missing-config" }));
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const rating = Number(formData.get("rating"));

    setReviewSubmissionStatus((currentStatus) => ({ ...currentStatus, [business.id]: "saving" }));

    const { error } = await supabase
      .from("business_reviews")
      .insert(
        {
          business_id: business.id,
          business_name: business.name,
          reviewer_name: formData.get("reviewerName").trim(),
          rating,
          comment: formData.get("comment").trim(),
          status: "pending",
        },
        { returning: "minimal" },
      );

    if (error) {
      setReviewSubmissionStatus((currentStatus) => ({ ...currentStatus, [business.id]: "error" }));
      return;
    }

    form.reset();
    setReviewSubmissionStatus((currentStatus) => ({ ...currentStatus, [business.id]: "saved" }));
  };

  const handleEventSubmit = async (event) => {
    event.preventDefault();

    if (eventSubmissionInFlightRef.current) {
      return;
    }
    eventSubmissionInFlightRef.current = true;

    if (!supabase || !adminSession) {
      setEventSubmissionStatus("missing-config");
      eventSubmissionInFlightRef.current = false;
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setEventSubmissionStatus("saving");
    const imageFile = formData.get("eventImage");
    const imageData = imageFile && imageFile.size ? await optimizeGalleryImage(imageFile) : "";

    const { error } = await supabase.from("event_submissions").insert({
      title: formData.get("title").trim(),
      place: formData.get("place").trim(),
      description: formData.get("description").trim(),
      map_url: formData.get("eventAddress").trim(),
      website_url: formData.get("websiteUrl").trim(),
      ticket_url: formData.get("ticketUrl").trim(),
      event_date: formData.get("eventDate"),
      end_date: formData.get("endDate") || null,
      event_time: formatEventTime(formData.get("eventTime")),
      end_time: formatEventTime(formData.get("endTime")),
      event_type: "Event",
      image_data: imageData,
      status: "approved",
    });

    if (error) {
      setEventSubmissionStatus("error");
      eventSubmissionInFlightRef.current = false;
      return;
    }

    form.reset();
    setEventSubmissionStatus("saved");
    await loadAdminEvents(adminSession);
    loadEventsPublic();
    eventSubmissionInFlightRef.current = false;
  };

  const trackBusinessInteraction = async (business, actionType) => {
    if (!supabase) {
      return;
    }

    await supabase.from("business_interactions").insert({
      business_id: business.id,
      business_name: business.name,
      action_type: actionType,
    });
  };

  const openTrackedBusinessLink = async (event, business, actionType, url, target = "_self") => {
    event.preventDefault();
    await trackBusinessInteraction(business, actionType);

    if (target === "_blank") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.assign(url);
  };

  const businessDisplayImage = (business) => business.image || business.image_data || businessImageForCategory(business.category);

  async function loadAdminData(sessionOverride = adminSession, showRefreshSuccess = false) {
    if (!supabase || !sessionOverride) {
      return;
    }

    setAdminStatus("loading");

    const [
      galleryResult,
      publishedGalleryResult,
      businessResult,
      publishedBusinessResult,
      hiddenBusinessResult,
      hiddenStaticResult,
      reviewResult,
      likeResult,
      approvedReviewResult,
      interactionResult,
      publishedEventResult,
      hiddenEventResult,
      jobListingsResult,
      adminMarketplaceResult,
      adminRentalResult,
      paymentRecordsResult,
    ] = await Promise.all([
      supabase
        .from("gallery_submissions")
        .select("id,created_at,contributor_name,title,image_data,status,owner_user_id")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("gallery_submissions")
        .select("id,created_at,contributor_name,title,image_data,status,owner_user_id")
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_submissions")
        .select("id,created_at,business_name,contact_name,contact_email,category,plan,phone,address,social,description,image_data,payment_status,placement_source,placement_expires_at,stripe_subscription_id,status")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_submissions")
        .select("id,created_at,business_name,contact_name,contact_email,category,plan,phone,address,social,description,image_data,payment_status,placement_source,placement_expires_at,stripe_subscription_id,status")
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_submissions")
        .select("id,created_at,business_name,contact_name,contact_email,category,plan,phone,address,social,description,image_data,payment_status,placement_source,placement_expires_at,stripe_subscription_id,status")
        .eq("status", "hidden")
        .order("created_at", { ascending: false }),
      supabase
        .from("hidden_static_items")
        .select("item_key,item_type,title")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_reviews")
        .select("id,created_at,business_id,business_name,reviewer_name,rating,comment,status")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("public_likes")
        .select("created_at,item_type,item_key"),
      supabase
        .from("business_reviews")
        .select("created_at,business_id,rating,status")
        .eq("status", "approved"),
      supabase
        .from("business_interactions")
        .select("created_at,business_id,business_name,action_type"),
      supabase
        .from("event_submissions")
        .select("id,created_at,title,place,description,map_url,website_url,ticket_url,event_date,end_date,event_time,end_time,event_type,image_url,image_data,status")
        .eq("status", "approved")
        .order("event_date", { ascending: true }),
      supabase
        .from("event_submissions")
        .select("id,created_at,title,place,description,map_url,website_url,ticket_url,event_date,end_date,event_time,end_time,event_type,image_url,image_data,status")
        .eq("status", "hidden")
        .order("event_date", { ascending: true }),
      supabase.rpc("admin_list_job_listings"),
      supabase
        .from("marketplace_listings")
        .select("id,created_at,expires_at,sold_at,deleted_at,title,price,category,location,contact,description,image_data,status,owner_user_id,moderation_status,moderation_reason,moderation_score,moderation_flags,moderation_input_types,moderation_model,moderated_at,reviewed_by_admin,reviewed_at,reviewed_by")
        .order("created_at", { ascending: false }),
      supabase.rpc("admin_list_rental_listings"),
      supabase
        .from("payment_records")
        .select("id,created_at,business_submission_id,stripe_session_id,stripe_payment_intent_id,stripe_charge_id,stripe_balance_transaction_id,currency,gross_amount,stripe_fee,net_amount,paid_at,status")
        .order("paid_at", { ascending: false }),
    ]);

    if (
      galleryResult.error ||
      publishedGalleryResult.error ||
      businessResult.error ||
      publishedBusinessResult.error ||
      hiddenBusinessResult.error ||
      hiddenStaticResult.error ||
      reviewResult.error ||
      likeResult.error ||
      approvedReviewResult.error ||
      interactionResult.error ||
      publishedEventResult.error ||
      hiddenEventResult.error ||
      jobListingsResult.error ||
      adminMarketplaceResult.error
    ) {
      setAdminStatus("error");
      return;
    }
    // rental_listings may not exist yet — fail gracefully without blocking other admin data
    setAdminRentalListings(adminRentalResult.error ? [] : (adminRentalResult.data ?? []));
    setPaymentRecords(paymentRecordsResult.error ? [] : (paymentRecordsResult.data ?? []));

    setPendingGalleryPhotos(galleryResult.data ?? []);
    setPublishedGalleryPhotos(publishedGalleryResult.data ?? []);
    setPendingBusinesses(businessResult.data ?? []);
    setPublishedBusinesses(publishedBusinessResult.data ?? []);
    setBusinesses((publishedBusinessResult.data ?? []).map(businessSubmissionToBusiness));
    setHiddenBusinesses(hiddenBusinessResult.data ?? []);
    setHiddenStaticItems((hiddenStaticResult.data ?? []).filter((item) => item.item_type !== "deleted").map((item) => item.item_key));
    setDeletedStaticItems((hiddenStaticResult.data ?? []).filter((item) => item.item_type === "deleted").map((item) => item.item_key));
    setPendingReviews(reviewResult.data ?? []);
    setAdminJobListings(jobListingsResult.data ?? []);
    setAdminMarketplaceListings((adminMarketplaceResult.data ?? []).map(mapListingFromDb));
    setPublishedEvents(publishedEventResult.data ?? []);
    setHiddenEvents(hiddenEventResult.data ?? []);
    setLikeCounts(
      (likeResult.data ?? []).reduce((counts, like) => {
        const key = `${like.item_type}:${like.item_key}`;
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    );

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const reportsByBusiness = new Map();
    const ensureReport = (businessId, businessName = businessId) => {
      if (!reportsByBusiness.has(businessId)) {
        reportsByBusiness.set(businessId, {
          businessId,
          businessName,
          calls: 0,
          directions: 0,
          likes: 0,
          reviews: 0,
          ratingTotal: 0,
          visits: 0,
        });
      }

      return reportsByBusiness.get(businessId);
    };

    [...(publishedBusinessResult.data ?? []), ...initialBusinesses].forEach((business) => {
      ensureReport(business.id, business.business_name ?? business.name);
    });

    (likeResult.data ?? [])
      .filter((like) => new Date(like.created_at) >= monthStart)
      .filter((like) => like.item_type === "business")
      .forEach((like) => {
        ensureReport(like.item_key).likes += 1;
      });

    (approvedReviewResult.data ?? []).forEach((review) => {
        const report = ensureReport(review.business_id);
        report.reviews += 1;
        report.ratingTotal += Number(review.rating);
      });

    (interactionResult.data ?? [])
      .filter((interaction) => new Date(interaction.created_at) >= monthStart)
      .forEach((interaction) => {
        const report = ensureReport(interaction.business_id, interaction.business_name);
        report[interaction.action_type] = (report[interaction.action_type] ?? 0) + 1;
      });

    setBusinessReports(
      [...reportsByBusiness.values()]
        .map((report) => ({
          ...report,
          averageRating: report.reviews ? (report.ratingTotal / report.reviews).toFixed(1) : "No reviews",
        }))
        .sort((a, b) => b.likes + b.reviews + b.calls + b.directions + b.visits - (a.likes + a.reviews + a.calls + a.directions + a.visits)),
    );

    const itemInteractionResult = await supabase
      .from("public_item_interactions")
      .select("created_at,item_type,item_key,item_name,action_type");

    if (!itemInteractionResult.error) {
      const itemReportsByKey = new Map();

      (itemInteractionResult.data ?? [])
        .filter((interaction) => new Date(interaction.created_at) >= monthStart)
        .forEach((interaction) => {
          const reportKey = `${interaction.item_type}:${interaction.item_key}`;
          const isLobbyClick =
            String(interaction.item_key ?? "").startsWith("lobby-") || /^Lobby:\s*/i.test(interaction.item_name ?? "");
          const itemName = isLobbyClick ? interaction.item_name.replace(/^Lobby:\s*/i, "") : interaction.item_name;

          if (!itemReportsByKey.has(reportKey)) {
            itemReportsByKey.set(reportKey, {
              itemKey: reportKey,
              itemName,
              itemType: isLobbyClick ? "Lobby" : interaction.item_type,
              clicks: 0,
            });
          }

          itemReportsByKey.get(reportKey).clicks += 1;
        });

      setItemReports([...itemReportsByKey.values()].sort((a, b) => b.clicks - a.clicks));
    }

    setAdminStatus(showRefreshSuccess ? "refreshed" : "ready");
  }

  async function loadAdminJobs(sessionOverride = adminSession) {
    if (!supabase || !sessionOverride) {
      return;
    }

    const jobListingsResult = await supabase.rpc("admin_list_job_listings");

    if (jobListingsResult.error) {
      setAdminStatus("job-refresh-error");
      return false;
    }

    setAdminJobListings(jobListingsResult.data ?? []);
    setAdminStatus("ready");
    return true;
  }

  async function loadAdminRentals(sessionOverride = adminSession) {
    if (!supabase || !sessionOverride) {
      return;
    }

    const adminRentalResult = await supabase.rpc("admin_list_rental_listings");

    if (adminRentalResult.error) {
      setAdminStatus("error");
      return false;
    }

    setAdminRentalListings(adminRentalResult.data ?? []);
    setAdminStatus("ready");
    return true;
  }

  async function loadAdminEvents(sessionOverride = adminSession) {
    if (!supabase || !sessionOverride) {
      return;
    }

    const eventFields =
      "id,created_at,title,place,description,map_url,website_url,ticket_url,event_date,end_date,event_time,end_time,event_type,image_url,image_data,status";
    const [publishedEventResult, hiddenEventResult] = await Promise.all([
      supabase
        .from("event_submissions")
        .select(eventFields)
        .eq("status", "approved")
        .order("event_date", { ascending: true }),
      supabase
        .from("event_submissions")
        .select(eventFields)
        .eq("status", "hidden")
        .order("event_date", { ascending: true }),
    ]);

    if (publishedEventResult.error || hiddenEventResult.error) {
      setAdminStatus("error");
      return;
    }

    setPublishedEvents(publishedEventResult.data ?? []);
    setHiddenEvents(hiddenEventResult.data ?? []);
    setAdminStatus("ready");
  }

  async function loadAdminBusinesses(sessionOverride = adminSession, showRefreshSuccess = false) {
    if (!supabase || !sessionOverride) {
      return;
    }

    const businessFields =
      "id,created_at,business_name,contact_name,contact_email,category,plan,phone,address,social,description,image_data,payment_status,placement_source,placement_expires_at,stripe_subscription_id,status,owner_user_id";
    const [pendingBusinessResult, publishedBusinessResult, hiddenBusinessResult] = await Promise.all([
      supabase
        .from("business_submissions")
        .select(businessFields)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_submissions")
        .select(businessFields)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_submissions")
        .select(businessFields)
        .eq("status", "hidden")
        .order("created_at", { ascending: false }),
    ]);

    if (pendingBusinessResult.error || publishedBusinessResult.error || hiddenBusinessResult.error) {
      setAdminStatus("error");
      return;
    }

    setPendingBusinesses(pendingBusinessResult.data ?? []);
    setPublishedBusinesses(publishedBusinessResult.data ?? []);
    setHiddenBusinesses(hiddenBusinessResult.data ?? []);
    setBusinesses((publishedBusinessResult.data ?? []).map(businessSubmissionToBusiness));
    setAdminStatus(showRefreshSuccess ? "refreshed" : "ready");
  }

  async function loadAdminGallery(sessionOverride = adminSession) {
    if (!supabase || !sessionOverride) {
      return;
    }

    const galleryFields = "id,created_at,contributor_name,title,image_data,status,owner_user_id";
    const [pendingGalleryResult, publishedGalleryResult] = await Promise.all([
      supabase
        .from("gallery_submissions")
        .select(galleryFields)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("gallery_submissions")
        .select(galleryFields)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
    ]);

    if (pendingGalleryResult.error || publishedGalleryResult.error) {
      setAdminStatus("error");
      return;
    }

    setPendingGalleryPhotos(pendingGalleryResult.data ?? []);
    setPublishedGalleryPhotos(publishedGalleryResult.data ?? []);
    setApprovedGalleryPhotos(
      (publishedGalleryResult.data ?? []).map((photo) => ({
        id: photo.id,
        title: photo.title,
        image: photo.image_data,
        owner_user_id: photo.owner_user_id ?? "",
      })),
    );
    setAdminStatus("ready");
  }

  const handleAdminLogin = async (event) => {
    event.preventDefault();

    if (!supabase) {
      setAdminStatus("missing-config");
      return;
    }

    setAdminStatus("signing-in");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim(),
      password: adminPassword,
    });

    if (error) {
      setAdminStatus("login-error");
      return;
    }

    setAdminSession(data.session);
    setAdminPassword("");
    setAdminStatus("ready");
    await loadAdminData(data.session);
  };

  const handleAdminLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setAdminSession(null);
    setPendingGalleryPhotos([]);
    setPublishedGalleryPhotos([]);
    setPendingBusinesses([]);
    setPublishedBusinesses([]);
    setHiddenBusinesses([]);
    setPendingReviews([]);
    setPublishedEvents([]);
    setHiddenEvents([]);
    setDeletedStaticItems([]);
    setBusinessReports([]);
    setItemReports([]);
    setPaymentRecords([]);
    setAdminStatus("");
    setAdminTab("events");
  };

  const moderateItem = async (table, id, status) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from(table).update({ status }).eq("id", id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    await loadAdminData();
  };

  const moderateBusiness = async (business, status) => {
    if (!supabase || !adminSession) {
      return;
    }

    const action = status === "approved" ? "approve" : "reject";
    setAdminBusinessActionKey(`${business.id}:${action}`);
    setAdminStatus("saving");
    try {
      const { error } = await supabase.from("business_submissions").update({ status }).eq("id", business.id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      await loadAdminBusinesses();
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const moderateGalleryPhoto = async (photo, status) => {
    if (!supabase || !adminSession) {
      return;
    }

    const action = status === "approved" ? "approve" : "reject";
    setAdminGalleryActionKey(`${photo.id}:${action}`);
    setAdminStatus("saving");
    try {
      const { error } = await supabase.from("gallery_submissions").update({ status }).eq("id", photo.id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      await loadAdminGallery();
    } finally {
      setAdminGalleryActionKey("");
    }
  };

  const handleApproveJob = async (job) => {
    const plan = String(job?.plan ?? "free").toLowerCase();
    const paymentStatus = String(job?.payment_status ?? "").toLowerCase();
    const canApprove =
      (plan === "free" && paymentStatus === "not_required") ||
      ((plan === "featured" || plan === "premium") && paymentStatus === "paid");

    if (!canApprove) {
      setAdminStatus("job-payment-incomplete");
      return;
    }

    await setJobPaymentPlan(job, plan, "approved", paymentStatus, job.expires_at ?? null);
  };

  const deleteGalleryPhoto = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldDelete = window.confirm("Delete this gallery photo from Abilene Vibes?");

    if (!shouldDelete) {
      return;
    }

    setAdminGalleryActionKey(`${id}:delete`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.from("gallery_submissions").delete().eq("id", id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      setApprovedGalleryPhotos((currentPhotos) => currentPhotos.filter((photo) => photo.id !== id));
      await loadAdminGallery();
    } finally {
      setAdminGalleryActionKey("");
    }
  };

  const handleDeleteJob = async (id) => {
    if (!supabase || !adminSession) return;
    if (!window.confirm("Permanently delete this job listing?")) return;
    setAdminJobActionKey(`${id}:delete`);
    setAdminStatus("saving");
    try {
      const { data, error } = await supabase.rpc("admin_delete_job_listing", { listing_id: id });
      if (error || data !== true) { setAdminStatus("error"); return; }
      await loadAdminData();
    } finally {
      setAdminJobActionKey("");
    }
  };

  const handleSaveJob = async () => {
    if (!supabase || !adminSession || !editingJob) return;
    const plan = String(editingJob.plan ?? "free").toLowerCase();
    const paymentStatus = String(editingJob.payment_status ?? "").toLowerCase();
    const savingAsApproved = editingJob.status === "approved";
    const canApprove =
      (plan === "free" && paymentStatus === "not_required") ||
      ((plan === "featured" || plan === "premium") && paymentStatus === "paid");

    if (savingAsApproved && !canApprove) {
      setAdminStatus("job-payment-incomplete");
      return;
    }

    setAdminStatus("saving");
    try {
      const { data, error } = await supabase.rpc("admin_update_job_listing", {
        listing_id: editingJob.id,
        new_title: editingJob.title,
        new_company: editingJob.company,
        new_category: editingJob.category,
        new_job_type: editingJob.job_type,
        new_pay_label: editingJob.pay_label,
        new_location: editingJob.location,
        new_phone: editingJob.phone,
        new_email: editingJob.email,
        new_description: editingJob.description,
        new_requirements: editingJob.requirements,
        new_app_method: editingJob.app_method,
        new_apply_url: editingJob.apply_url || null,
        new_duration: editingJob.duration,
        new_plan: editingJob.plan,
        new_status: editingJob.status,
        new_image_data: editingJob.image_data ?? null,
        new_logo_data: editingJob.logo_data ?? null,
        new_expires_at: editingJob.expires_at ?? null,
      });
      if (error || data !== true) { setAdminStatus("job-save-error"); return; }
      const refreshed = await loadAdminJobs();
      if (refreshed === false) return;
      setEditingJob(null);
      setEditJobPage(false);
    } catch {
      setAdminStatus("job-save-error");
    }
  };

  const setJobPaymentPlan = async (job, plan, status, paymentStatus, expiresAt = null, placementSource = null, placementExpiresAt = null, actionSuffix = "") => {
    if (!supabase || !adminSession) return;
    const cleanPlan = plan === "premium" ? "premium" : plan === "featured" ? "featured" : "free";
    const cleanStatus = ["pending", "approved", "hidden", "rejected"].includes(status) ? status : "pending";
    const cleanPaymentStatus = [
      "not_required",
      "pending",
      "checkout_started",
      "paid",
      "failed",
      "expired",
      "canceled",
    ].includes(paymentStatus) ? paymentStatus : "not_required";
    const actionKey = actionSuffix || `status:${cleanStatus}`;
    setAdminJobActionKey(`${job.id}:${actionKey}`);
    setAdminStatus("saving");
    try {
      const { data, error } = await supabase.rpc("admin_set_job_payment_plan", {
        listing_id: job.id,
        new_plan: cleanPlan,
        new_status: cleanStatus,
        new_payment_status: cleanPaymentStatus,
        new_expires_at: expiresAt,
        new_placement_source: placementSource,
        new_placement_expires_at: placementExpiresAt,
      });
      if (error || data !== true) { setAdminStatus("error"); return; }
      await loadAdminData();
    } finally {
      setAdminJobActionKey("");
    }
  };

  const setPaidJobPlacement = async (job, plan) => {
    if (!supabase || !adminSession) return;
    const cleanPlan = plan === "premium" ? "premium" : plan === "featured" ? "featured" : "free";
    const planLabel = cleanPlan.charAt(0).toUpperCase() + cleanPlan.slice(1);
    if (!window.confirm(`Set "${job.title}" to ${planLabel} paid plan?`)) return;

    await setJobPaymentPlan(
      job,
      cleanPlan,
      cleanPlan === "free" ? job.status : "approved",
      cleanPlan === "free" ? "not_required" : "paid",
      cleanPlan === "free" ? null : (job.expires_at ?? null),
    );
  };

  const compJobPlacement = async (job, plan) => {
    if (!supabase || !adminSession) return;
    const cleanPlan = plan === "premium" ? "premium" : "featured";
    const days = window.prompt("Promo duration in days", "30");
    if (days === null) return;
    const durationDays = Math.max(1, Number.parseInt(days, 10) || 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await setJobPaymentPlan(job, cleanPlan, "approved", "not_required", expiresAt.toISOString(), "comp", expiresAt.toISOString());
  };

  const clearCompJobPlacement = async (job) => {
    if (!supabase || !adminSession) return;
    if (!window.confirm(`End free promo for "${job.title}"?`)) return;

    await setJobPaymentPlan(job, "free", job.status ?? "approved", "not_required", null, "free", null);
  };

  const handleDeleteRental = async (id) => {
    if (!supabase || !adminSession) return;
    if (!window.confirm("Permanently delete this rental listing?")) return;
    setAdminRentalActionKey(`${id}:delete`);
    setAdminStatus("saving");
    try {
      const { data, error } = await supabase.rpc("admin_delete_rental_listing", {
        listing_id: id,
      });
      if (error || data !== true) { setAdminStatus("error"); return; }
      await loadAdminRentals();
    } finally {
      setAdminRentalActionKey("");
    }
  };

  const adminRentalRpcPayload = (r, overrides = {}) => {
    const rental = { ...r, ...overrides };
    const isSTR = rental.property_type === "Short-Term";

    return {
      listing_id: rental.id,
      new_title: rental.title,
      new_property_type: rental.property_type,
      new_address: rental.address,
      new_contact_person: rental.contact_person || null,
      new_description: rental.description || null,
      new_phone: rental.phone || null,
      new_email: rental.email || null,
      new_external_url: rental.external_url || null,
      new_duration: rental.duration || null,
      new_plan: rental.plan || null,
      new_status: rental.status || "approved",
      new_pets_allowed: rental.pets_allowed ?? false,
      new_image_data: rental.image_data ?? [],
      new_price: isSTR ? null : (rental.price || null),
      new_deposit: isSTR ? null : (rental.deposit || null),
      new_price_per_night: isSTR ? (rental.price_per_night || null) : null,
      new_price_per_week: isSTR ? (rental.price_per_week || null) : null,
      new_available_from: isSTR ? (rental.available_from || null) : null,
      new_available_to: isSTR ? (rental.available_to || null) : null,
      new_max_guests: isSTR ? (rental.max_guests || null) : null,
      new_house_rules: isSTR ? (rental.house_rules || null) : null,
      new_bedrooms: isSTR ? null : (rental.bedrooms || null),
      new_bathrooms: isSTR ? null : (rental.bathrooms || null),
    };
  };

  const handleToggleRentalStatus = async (r) => {
    const nextStatus = r.status === "hidden" ? "approved" : "hidden";
    await handleSetRentalStatus(r, nextStatus);
  };

  const handleSetRentalStatus = async (r, nextStatus) => {
    await handleSetRentalPaymentPlan(
      r,
      r.plan ?? "free",
      nextStatus,
      r.payment_status ?? "not_required",
      `status:${nextStatus}`,
    );
  };

  const canApproveRental = (r) => {
    const plan = String(r?.plan ?? "free").toLowerCase();
    const paymentStatus = String(r?.payment_status ?? "").toLowerCase();
    const placementSource = String(r?.placement_source ?? "").toLowerCase();
    return (
      (plan === "free" && paymentStatus === "not_required") ||
      ((plan === "featured" || plan === "premium") && placementSource === "comp" && paymentStatus === "not_required") ||
      ((plan === "featured" || plan === "premium") && paymentStatus === "paid")
    );
  };

  const handleSetRentalPaymentPlan = async (
    r,
    nextPlan,
    nextStatus,
    nextPaymentStatus,
    actionSuffix = "",
    nextPlacementSource = r?.placement_source ?? null,
    nextPlacementExpiresAt = r?.placement_expires_at ?? null,
  ) => {
    if (!supabase || !adminSession) return;
    const cleanPlan = nextPlan === "premium" ? "premium" : nextPlan === "featured" ? "featured" : "free";
    const cleanStatus = ["pending", "approved", "hidden", "rejected"].includes(nextStatus) ? nextStatus : "pending";
    const cleanPaymentStatus = [
      "not_required",
      "pending",
      "checkout_started",
      "paid",
      "failed",
      "expired",
      "cancel_pending",
      "canceled",
    ].includes(nextPaymentStatus) ? nextPaymentStatus : "not_required";
    const actionKey = actionSuffix || `plan:${cleanPlan}:${cleanPaymentStatus}`;

    setAdminRentalActionKey(`${r.id}:${actionKey}`);
    setAdminStatus("saving");
    try {
      const { data, error } = await supabase.rpc("admin_set_rental_payment_plan", {
        listing_id: r.id,
        new_plan: cleanPlan,
        new_status: cleanStatus,
        new_payment_status: cleanPaymentStatus,
        new_placement_source: nextPlacementSource,
        new_placement_expires_at: nextPlacementExpiresAt,
      });
      if (error || data !== true) { setAdminStatus("error"); return; }
      await loadAdminRentals();
    } finally {
      setAdminRentalActionKey("");
    }
  };

  const handleApproveRental = async (r) => {
    if (!canApproveRental(r)) {
      setAdminStatus("rental-payment-incomplete");
      return;
    }

    await handleSetRentalPaymentPlan(r, r.plan ?? "free", "approved", r.payment_status ?? "not_required", "status:approved");
  };

  const setRentalFreePlan = async (r) => {
    if (!window.confirm(`Set "${r.title}" to Free plan?`)) return;

    await handleSetRentalPaymentPlan(
      r,
      "free",
      r.status ?? "pending",
      "not_required",
      "plan:free",
      null,
      null,
    );
  };

  const compRentalPlacement = async (r, plan) => {
    const cleanPlan = plan === "premium" ? "premium" : "featured";
    await handleSetRentalPaymentPlan(r, cleanPlan, "approved", "not_required", `promo:${cleanPlan}`, "comp", null);
  };

  const clearCompRentalPlacement = async (r) => {
    if (!window.confirm(`End free promo for "${r.title}"?`)) return;
    await handleSetRentalPaymentPlan(r, "free", r.status ?? "approved", "not_required", "promo:end", null, null);
  };

  const cancelRentalSubscription = async (r) => {
    if (!supabase || !adminSession) {
      return;
    }

    if (!r.stripe_subscription_id) {
      window.alert("This rental does not have a Stripe subscription ID saved yet.");
      return;
    }

    const cancelAtPeriodEnd = window.confirm(
      `Cancel "${r.title}" at the end of the paid billing period?\n\nChoose OK to let the customer keep the current paid month. Choose Cancel for immediate cancellation.`,
    );

    const shouldContinue = cancelAtPeriodEnd
      ? true
      : window.confirm(`Cancel "${r.title}" immediately? This may end paid placement right away.`);

    if (!shouldContinue) {
      return;
    }

    setAdminRentalActionKey(`${r.id}:cancel-subscription`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.functions.invoke("cancel-subscription", {
        body: {
          listingType: "rental",
          rentalId: r.id,
          cancelAtPeriodEnd,
        },
      });

      if (error) {
        setAdminStatus("error");
        window.alert(error.message ?? "Could not cancel this subscription.");
        return;
      }

      await loadAdminRentals();
    } finally {
      setAdminRentalActionKey("");
    }
  };

  const handleSaveRental = async () => {
    if (!supabase || !adminSession || !editingRental) return;
    if (editingRental.status === "approved" && !canApproveRental(editingRental)) {
      setAdminStatus("rental-payment-incomplete");
      return;
    }

    setAdminStatus("saving");
    try {
      const { data, error } = await supabase.rpc("admin_update_rental_listing", adminRentalRpcPayload(editingRental));
      if (error || data !== true) { setAdminStatus("error"); return; }
      const refreshed = await loadAdminRentals();
      if (refreshed === false) return;
      setEditingRental(null);
      setEditRentalPage(false);
    } catch {
      setAdminStatus("error");
    }
  };

  const deleteBusiness = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldDelete = window.confirm("Permanently delete this business from Abilene Vibes?");

    if (!shouldDelete) {
      return;
    }

    setAdminBusinessActionKey(`${id}:delete`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.from("business_submissions").delete().eq("id", id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      setBusinesses((currentBusinesses) => currentBusinesses.filter((business) => business.id !== id));
      await loadAdminBusinesses();
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const confirmDeleteAdminBusiness = async () => {
    if (!supabase || !adminSession || !deletingAdminBusiness) {
      return;
    }

    const id = deletingAdminBusiness.id;
    setAdminBusinessActionKey(`${id}:delete`);
    setAdminStatus("saving");

    const { error } = await supabase.from("business_submissions").delete().eq("id", id);

    if (error) {
      setAdminStatus("error");
      setAdminBusinessActionKey("");
      return;
    }

    setBusinesses((currentBusinesses) => currentBusinesses.filter((business) => business.id !== id));
    setDeletingAdminBusiness(null);
    await loadAdminBusinesses();
    setAdminBusinessActionKey("");
  };

  const editBusiness = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    const businessName = window.prompt("Business name", business.business_name);
    if (businessName === null) return;

    const category = window.prompt("Category", business.category);
    if (category === null) return;

    const phone = window.prompt("Phone", business.phone ?? "");
    if (phone === null) return;

    const address = window.prompt("Address", business.address ?? "");
    if (address === null) return;

    const social = window.prompt("Website, Instagram, or Facebook", business.social ?? "");
    if (social === null) return;

    const description = window.prompt("Description", business.description ?? "");
    if (description === null) return;

    const plan = window.prompt("Plan: Free, Featured, or Premium", business.plan || "Free");
    if (plan === null) return;

    const normalizedPlan = plan.trim();
    const cleanPlan = ["Free", "Featured", "Premium"].includes(normalizedPlan) ? normalizedPlan : business.plan || "Free";
    const placementUpdates =
      cleanPlan === "Free"
        ? { placement_source: "paid", placement_expires_at: null, payment_status: "not_required" }
        : {};

    setAdminBusinessActionKey(`${business.id}:edit`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase
        .from("business_submissions")
        .update({
          business_name: businessName.trim() || business.business_name,
          category: category.trim() || business.category,
          phone: phone.trim() || business.phone,
          address: address.trim(),
          social: social.trim(),
          description: description.trim(),
          plan: cleanPlan,
          ...placementUpdates,
        })
        .eq("id", business.id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      await loadAdminBusinesses();
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const changeBusinessPhoto = async (businessId, file) => {
    if (!supabase || !adminSession || !file || !file.size) {
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
      setAdminStatus("error");
      return;
    }

    setAdminBusinessActionKey(`${businessId}:photo`);
    setAdminStatus("saving");

    try {
      const imageData = await optimizeGalleryImage(file);
      const { error } = await supabase.from("business_submissions").update({ image_data: imageData }).eq("id", businessId);

      if (error) {
        setAdminStatus("error");
        return;
      }

      await loadAdminBusinesses();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const compBusinessPlacement = async (business, selectedPromoPlan = "") => {
    if (!supabase || !adminSession) {
      return;
    }

    const plan =
      selectedPromoPlan ||
      window.prompt("Free promo plan: Featured or Premium", business.plan === "Premium" ? "Premium" : "Featured");
    if (plan === null) return;

    const days = selectedPromoPlan ? "30" : window.prompt("Promo duration in days", "30");
    if (days === null) return;

    const cleanPlan = plan.trim() === "Premium" ? "Premium" : "Featured";
    const durationDays = Math.max(1, Number.parseInt(days, 10) || 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    setAdminBusinessActionKey(`${business.id}:${cleanPlan === "Premium" ? "comp-premium" : "comp-featured"}`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase
        .from("business_submissions")
        .update({
          plan: cleanPlan,
          status: "approved",
          payment_status: "not_required",
          placement_source: "comp",
          placement_expires_at: expiresAt.toISOString(),
        })
        .eq("id", business.id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      await loadAdminBusinesses();
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const setPaidBusinessPlacement = async (business, plan) => {
    if (!supabase || !adminSession) {
      return;
    }

    const cleanPlan = plan === "Premium" ? "Premium" : plan === "Featured" ? "Featured" : "Free";
    const shouldUpdate = window.confirm(`Set "${business.business_name}" to ${cleanPlan} paid plan?`);

    if (!shouldUpdate) {
      return;
    }

    const action = cleanPlan === "Free" ? "plan-free" : cleanPlan === "Premium" ? "paid-premium" : "paid-featured";
    setAdminBusinessActionKey(`${business.id}:${action}`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase
        .from("business_submissions")
        .update({
          plan: cleanPlan,
          status: cleanPlan === "Free" ? business.status : "approved",
          payment_status: cleanPlan === "Free" ? "not_required" : "paid",
          placement_source: "paid",
          placement_expires_at: null,
        })
        .eq("id", business.id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      await loadAdminBusinesses();
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const cancelBusinessSubscription = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    if (!business.stripe_subscription_id) {
      window.alert("This business does not have a Stripe subscription ID saved yet.");
      return;
    }

    const cancelAtPeriodEnd = window.confirm(
      `Cancel "${business.business_name}" at the end of the paid billing period?\n\nChoose OK to let the customer keep the current paid month. Choose Cancel for immediate cancellation.`,
    );

    const shouldContinue = cancelAtPeriodEnd
      ? true
      : window.confirm(`Cancel "${business.business_name}" immediately? This may end paid placement right away.`);

    if (!shouldContinue) {
      return;
    }

    setAdminBusinessActionKey(`${business.id}:cancel-subscription`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.functions.invoke("cancel-subscription", {
        body: {
          submissionId: business.id,
          cancelAtPeriodEnd,
        },
      });

      if (error) {
        setAdminStatus("error");
        window.alert(error.message ?? "Could not cancel this subscription.");
        return;
      }

      await loadAdminData(undefined, true);
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const clearCompBusinessPlacement = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldClear = window.confirm(`Remove free promo placement from "${business.business_name}"?`);

    if (!shouldClear) {
      return;
    }

    setAdminBusinessActionKey(`${business.id}:end-promo`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase
        .from("business_submissions")
        .update({
          plan: "Free",
          placement_source: "paid",
          placement_expires_at: null,
        })
        .eq("id", business.id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      await loadAdminBusinesses();
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const deleteEvent = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldDelete = window.confirm("Permanently delete this event from Abilene Vibes?");

    if (!shouldDelete) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("event_submissions").delete().eq("id", id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    await loadAdminEvents();
    loadEventsPublic();
  };

  const unpublishBusiness = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldUnpublish = window.confirm("Remove this business from the public app?");

    if (!shouldUnpublish) {
      return;
    }

    setAdminBusinessActionKey(`${id}:hide`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.from("business_submissions").update({ status: "hidden" }).eq("id", id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      setBusinesses((currentBusinesses) => currentBusinesses.filter((business) => business.id !== id));
      await loadAdminBusinesses();
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const restoreBusiness = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminBusinessActionKey(`${business.id}:restore`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.from("business_submissions").update({ status: "approved" }).eq("id", business.id);

      if (error) {
        setAdminStatus("error");
        return;
      }

      setBusinesses((currentBusinesses) => [businessSubmissionToBusiness(business), ...currentBusinesses]);
      await loadAdminBusinesses();
    } finally {
      setAdminBusinessActionKey("");
    }
  };

  const hideStaticBusiness = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const itemKey = `business:${business.id}`;
    const { error } = await supabase.from("hidden_static_items").insert({
      item_key: itemKey,
      item_type: "business",
      title: business.name,
    });

    if (error) {
      setAdminStatus("error");
      return;
    }

    setHiddenStaticItems((currentItems) => [...new Set([...currentItems, itemKey])]);
    await loadAdminData();
  };

  const restoreStaticBusiness = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const itemKey = `business:${business.id}`;
    const { error } = await supabase.from("hidden_static_items").delete().eq("item_key", itemKey);

    if (error) {
      setAdminStatus("error");
      return;
    }

    setHiddenStaticItems((currentItems) => currentItems.filter((item) => item !== itemKey));
    await loadAdminData();
  };

  const unpublishEvent = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("event_submissions").update({ status: "hidden" }).eq("id", id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    await loadAdminEvents();
    loadEventsPublic();
  };

  const restoreEvent = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("event_submissions").update({ status: "approved" }).eq("id", id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    await loadAdminEvents();
    loadEventsPublic();
  };

  const editEvent = async (event) => {
    if (!supabase || !adminSession) {
      return;
    }

    const title = window.prompt("Event title", event.title);
    if (title === null) return;

    const place = window.prompt("Event place", event.place);
    if (place === null) return;

    const description = window.prompt("Event description", event.description ?? "");
    if (description === null) return;

    const eventAddress = window.prompt("Event address", event.map_url ?? "");
    if (eventAddress === null) return;

    const websiteUrl = window.prompt("Event website URL", event.website_url ?? "");
    if (websiteUrl === null) return;

    const ticketUrl = window.prompt("Event ticket URL", event.ticket_url ?? "");
    if (ticketUrl === null) return;

    const eventDate = window.prompt("Start date (YYYY-MM-DD)", event.event_date);
    if (eventDate === null) return;

    const endDate = window.prompt("End date (YYYY-MM-DD, optional)", event.end_date ?? "");
    if (endDate === null) return;

    const eventTime = window.prompt("Start time", event.event_time);
    if (eventTime === null) return;

    const endTime = window.prompt("End time", event.end_time ?? event.event_time ?? "");
    if (endTime === null) return;

    setAdminStatus("saving");
    const { error } = await supabase
      .from("event_submissions")
      .update({
        title: title.trim(),
        place: place.trim(),
        description: description.trim(),
        map_url: eventAddress.trim(),
        website_url: websiteUrl.trim(),
        ticket_url: ticketUrl.trim(),
        event_date: eventDate.trim(),
        end_date: endDate.trim() || null,
        event_time: formatEventTime(eventTime),
        end_time: formatEventTime(endTime),
      })
      .eq("id", event.id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    await loadAdminEvents();
    loadEventsPublic();
  };

  const changeEventPhoto = async (eventId, file) => {
    if (!supabase || !adminSession || !file || !file.size) {
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
      setAdminStatus("error");
      return;
    }

    setAdminStatus("saving");

    try {
      const imageData = await optimizeGalleryImage(file);
      const { error } = await supabase
        .from("event_submissions")
        .update({
          image_data: imageData,
          image_url: "",
        })
        .eq("id", eventId);

      if (error) {
        setAdminStatus("error");
        return;
      }

      await loadAdminEvents();
      loadEventsPublic();
    } catch {
      setAdminStatus("error");
    }
  };

  const createEditableEventFromStatic = async (event, overrides = {}) => {
    if (!supabase || !adminSession) {
      return false;
    }

    const [eventDate, eventTime = ""] = event.date.split(" - ");
    const imageData = overrides.image_data ?? "";
    const { error: eventError } = await supabase.from("event_submissions").insert({
      title: overrides.title ?? event.title,
      place: overrides.place ?? event.place,
      event_date: eventDateInputValue(overrides.event_date ?? eventDate),
      event_time: formatEventTime(overrides.event_time ?? eventTime),
      event_type: overrides.event_type ?? event.type,
      image_url: imageData ? "" : event.image,
      image_data: imageData,
      status: "approved",
    });

    if (eventError) {
      setAdminStatus("error");
      return false;
    }

    const itemKey = staticEventKey(event);
    const { error: hideError } = await supabase.from("hidden_static_items").insert({
      item_key: itemKey,
      item_type: "event",
      title: event.title,
    });

    if (hideError) {
      setAdminStatus("error");
      return false;
    }

    setHiddenStaticItems((currentItems) => [...new Set([...currentItems, itemKey])]);
    return true;
  };

  const editStaticEvent = async (event) => {
    if (!supabase || !adminSession) {
      return;
    }

    const [defaultDate, defaultTime = ""] = event.date.split(" - ");
    const title = window.prompt("Event title", event.title);
    if (title === null) return;

    const place = window.prompt("Event place", event.place);
    if (place === null) return;

    const eventDate = window.prompt("Event date (YYYY-MM-DD)", eventDateInputValue(defaultDate));
    if (eventDate === null) return;

    const eventTime = window.prompt("Event time", defaultTime);
    if (eventTime === null) return;

    setAdminStatus("saving");
    const wasCreated = await createEditableEventFromStatic(event, {
      title: title.trim(),
      place: place.trim(),
      event_date: eventDate.trim(),
      event_time: formatEventTime(eventTime),
    });

    if (wasCreated) {
      await loadAdminData();
    }
  };

  const changeStaticEventPhoto = async (event, file) => {
    if (!supabase || !adminSession || !file || !file.size) {
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
      setAdminStatus("error");
      return;
    }

    setAdminStatus("saving");

    try {
      const imageData = await optimizeGalleryImage(file);
      const wasCreated = await createEditableEventFromStatic(event, { image_data: imageData });

      if (wasCreated) {
        await loadAdminData();
      }
    } catch {
      setAdminStatus("error");
    }
  };

  const hideStaticEvent = async (event) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const itemKey = staticEventKey(event);
    const { error } = await supabase.from("hidden_static_items").insert({
      item_key: itemKey,
      item_type: "event",
      title: event.title,
    });

    if (error) {
      setAdminStatus("error");
      return;
    }

    setHiddenStaticItems((currentItems) => [...new Set([...currentItems, itemKey])]);
    await loadAdminData();
  };

  const restoreStaticEvent = async (event) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const itemKey = staticEventKey(event);
    const { error } = await supabase.from("hidden_static_items").delete().eq("item_key", itemKey);

    if (error) {
      setAdminStatus("error");
      return;
    }

    setHiddenStaticItems((currentItems) => currentItems.filter((item) => item !== itemKey));
    await loadAdminData();
  };

  const hideStaticGalleryPhoto = async (photo) => {
    if (!supabase || !adminSession) {
      return;
    }

    const itemKey = staticGalleryKey(photo);
    setAdminGalleryActionKey(`${itemKey}:hide`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.from("hidden_static_items").insert({
        item_key: itemKey,
        item_type: "gallery",
        title: photo.title,
      });

      if (error) {
        setAdminStatus("error");
        return;
      }

      setHiddenStaticItems((currentItems) => [...new Set([...currentItems, itemKey])]);
      await loadAdminData();
    } finally {
      setAdminGalleryActionKey("");
    }
  };

  const restoreStaticGalleryPhoto = async (photo) => {
    if (!supabase || !adminSession) {
      return;
    }

    const itemKey = staticGalleryKey(photo);
    setAdminGalleryActionKey(`${itemKey}:restore`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.from("hidden_static_items").delete().eq("item_key", itemKey);

      if (error) {
        setAdminStatus("error");
        return;
      }

      setHiddenStaticItems((currentItems) => currentItems.filter((item) => item !== itemKey));
      await loadAdminData();
    } finally {
      setAdminGalleryActionKey("");
    }
  };

  const deleteStaticGalleryPhoto = async (photo) => {
    if (!supabase || !adminSession) {
      return;
    }

    const itemKey = staticGalleryKey(photo);
    const shouldDelete = window.confirm(`Permanently remove "${photo.title}" from the app?`);

    if (!shouldDelete) {
      return;
    }

    setAdminGalleryActionKey(`${itemKey}:delete`);
    setAdminStatus("saving");

    try {
      const { error } = await supabase.from("hidden_static_items").upsert({
        item_key: itemKey,
        item_type: "deleted",
        title: photo.title,
      });

      if (error) {
        setAdminStatus("error");
        return;
      }

      setHiddenStaticItems((currentItems) => currentItems.filter((item) => item !== itemKey));
      setDeletedStaticItems((currentItems) => [...new Set([...currentItems, itemKey])]);
      await loadAdminData();
    } finally {
      setAdminGalleryActionKey("");
    }
  };

  const deleteStaticItem = async (itemKey, title) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldDelete = window.confirm(`Permanently remove "${title}" from the app?`);

    if (!shouldDelete) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("hidden_static_items").upsert({
      item_key: itemKey,
      item_type: "deleted",
      title,
    });

    if (error) {
      setAdminStatus("error");
      return;
    }

    setHiddenStaticItems((currentItems) => currentItems.filter((item) => item !== itemKey));
    setDeletedStaticItems((currentItems) => [...new Set([...currentItems, itemKey])]);
    await loadAdminData();
  };

  const hiddenStaticItemSet = new Set(hiddenStaticItems);

  // ── Marketplace computed ──────────────────────────────────
  const allMarketplaceListings = [
    ...marketplaceListings,
    // starter listings removed — only real Supabase listings shown
  ];
  const activeMarketplaceListings = allMarketplaceListings.filter(
    (l) =>
      (l.status ?? "active") === "active" &&
      getMarketplaceModerationStatus(l) === "approved" &&
      (!l.expiresAt || new Date(l.expiresAt) > new Date()),
  );
  const filteredMarketplaceListings = activeMarketplaceListings.filter((l) => {
    const matchesFilter = marketplaceFilter === "All" || l.category === marketplaceFilter || l.tag === marketplaceFilter;
    const searchText = `${l.title} ${l.category} ${l.price} ${l.description ?? ""}`.toLowerCase();
    return matchesFilter && searchText.includes(marketplaceSearch.trim().toLowerCase());
  });
  const marketplaceCategoryCounts = activeMarketplaceListings.reduce((acc, l) => {
    acc[l.tag] = (acc[l.tag] ?? 0) + 1;
    acc[l.category] = (acc[l.category] ?? 0) + 1;
    acc.All = (acc.All ?? 0) + 1;
    return acc;
  }, { All: 0 });
  const adminMarketplaceCounts = adminMarketplaceListings.reduce(
    (acc, listing) => {
      const status = listing.status ?? "active";
      const moderationStatus = getMarketplaceModerationStatus(listing);
      acc.all += 1;
      acc[status] = (acc[status] ?? 0) + 1;
      acc[moderationStatus] = (acc[moderationStatus] ?? 0) + 1;
      return acc;
    },
    { all: 0, pending: 0, approved: 0, rejected: 0, active: 0, hidden: 0, sold: 0 },
  );
  const adminMarketplaceVisibleListings = adminMarketplaceListings.filter((listing) => {
    const status = listing.status ?? "active";
    const moderationStatus = getMarketplaceModerationStatus(listing);
    if (status === "deleted") return false;
    if (marketplaceAdminStatusFilter === "all") return true;
    if (["pending", "approved", "rejected"].includes(marketplaceAdminStatusFilter)) {
      return moderationStatus === marketplaceAdminStatusFilter;
    }
    return status === marketplaceAdminStatusFilter;
  });
  const marketplaceAdminDisplayStatus = (listing) => {
    const status = String(listing?.status ?? "active").trim().toLowerCase();
    const moderationStatus = getMarketplaceModerationStatus(listing);
    if (moderationStatus === "pending") return "pending";
    if (moderationStatus === "rejected") return "rejected";
    return status;
  };
  const isListingOwner = (l) => !!(l.ownerUserId && l.ownerUserId === effectiveOwnerId);
  const myMarketplaceListings = marketplaceListings.filter((l) => isListingOwner(l));
  const myFilteredListings = myMarketplaceListings.filter((l) =>
    myListingTab === "Active"
      ? l.status === "active" && (!l.expiresAt || new Date(l.expiresAt) > new Date())
      : myListingTab === "Sold"
      ? l.status === "sold"
      : myListingTab === "Expired"
      ? l.status === "expired"
      : ["hidden", "deleted"].includes(l.status),
  );

  const openListing = (l) => {
    setListingGalleryIndex(0);
    setSelectedListing(l);
    inListingDetailRef.current = true;
    navigateTo("marketplace-item");
  };

  const handleMarkSold = (e, l) => {
    e?.preventDefault();
    e?.stopPropagation();
    setListingStatus(l, "sold");
  };

  const handleDeleteListing = (e, l) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDeletingListing({ ...l });
  };

  const openOwnerEditListing = (e, l) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditListingPhotos(l.images ?? (l.image ? [l.image] : []));
    setEditingListing({ ...l });
  };

  const setListingStatus = async (l, newStatus) => {
    const canAct = !!adminSession || isListingOwner(l);
    if (!supabase || !canAct) return;
    const actionKey = `${l.id ?? marketplaceListingKey(l)}:${newStatus}`;
    setMarketplaceActionKey(actionKey);

    if (newStatus === "deleted" && l.isStarterListing) {
      setAdminStatus("saving");
      const { error } = await supabase.from("hidden_static_items").upsert({
        item_key: marketplaceListingKey(l),
        item_type: "deleted",
        title: l.title,
      });
      if (error) { setAdminStatus("error"); setMarketplaceActionKey(""); return; }
      setHiddenStaticItems((items) => [...new Set([...items, marketplaceListingKey(l)])]);
      setDeletingListing(null);
      await loadAdminData();
      setMarketplaceActionKey("");
      return;
    }

    const ts = new Date().toISOString();
    const update = { status: newStatus };
    if (newStatus === "sold") update.sold_at = ts;
    if (newStatus === "active") update.sold_at = null;
    if (newStatus === "deleted") update.deleted_at = ts;

    setAdminStatus("saving");

    if (newStatus === "deleted" && adminSession) {
      const { data, error } = await supabase.rpc("admin_delete_marketplace_listing", {
        listing_id: l.id,
      });
      if (error || data !== true) { setAdminStatus("error"); setMarketplaceActionKey(""); return; }
      setMarketplaceListings((items) => items.filter((i) => i.id !== l.id));
      if (selectedListing?.id === l.id) setSelectedListing(null);
      setDeletingListing(null);
      await loadAdminData();
      setMarketplaceActionKey("");
      return;
    }

    const { data, error } = adminSession
      ? await supabase.from("marketplace_listings").update(update).eq("id", l.id)
      : await supabase.rpc("owner_set_marketplace_listing_status", {
          listing_id: l.id,
          owner_id: effectiveOwnerId,
          new_status: newStatus,
        });

    if (error || (!adminSession && data !== true)) { setAdminStatus("error"); setMarketplaceActionKey(""); return; }

    if (selectedListing?.id === l.id) setSelectedListing((prev) => (prev ? { ...prev, ...update } : null));
    setMarketplaceListings((items) =>
      items.map((i) =>
        i.id === l.id
          ? {
              ...i,
              status: newStatus,
              ownerUserId: update.owner_user_id ?? i.ownerUserId,
              soldAt: Object.prototype.hasOwnProperty.call(update, "sold_at") ? update.sold_at : i.soldAt,
              deletedAt: update.deleted_at ?? i.deletedAt,
            }
          : i,
      ),
    );
    if (newStatus === "deleted") setDeletingListing(null);
    if (adminSession) await loadAdminData();
    setMarketplaceActionKey("");
  };

  const setMarketplaceModerationStatus = async (listing, moderationStatus) => {
    if (!supabase || !adminSession || !listing?.id) return;
    const actionKey = `${listing.id}:moderation:${moderationStatus}`;
    setMarketplaceActionKey(actionKey);
    setAdminStatus("saving");

    const update = {
      moderation_status: moderationStatus,
      reviewed_by_admin: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminSession.user?.email ?? adminSession.user?.id ?? adminEmail ?? "admin",
    };

    const { error } = await supabase
      .from("marketplace_listings")
      .update(update)
      .eq("id", listing.id);

    if (error) {
      setAdminStatus("error");
      setMarketplaceActionKey("");
      return;
    }

    setMarketplaceListings((items) =>
      items.map((item) => (item.id === listing.id ? { ...item, ...update, moderationStatus } : item)),
    );
    if (selectedListing?.id === listing.id) {
      setSelectedListing((prev) => (prev ? { ...prev, ...update, moderationStatus } : null));
    }
    await loadMarketplacePublic();
    await loadAdminData();
    setAdminStatus(moderationStatus === "approved" ? "marketplace-approved" : "marketplace-rejected");
    setMarketplaceActionKey("");
  };

  const confirmDeleteListing = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!deletingListing) return;
    await setListingStatus(deletingListing, "deleted");
  };

  const handleEditListingSubmit = async (e) => {
    e.preventDefault();
    if (!supabase || !editingListing || !(adminSession || isListingOwner(editingListing))) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const update = {
      title: data.get("title").trim(),
      price: data.get("price").trim(),
      category: data.get("category"),
      location: data.get("location").trim(),
      contact: data.get("contact").trim(),
      description: data.get("description").trim(),
    };
    if (adminSession) {
      const cleanStatus = ["active", "sold", "expired", "hidden", "deleted"].includes(editingListing.status)
        ? editingListing.status
        : "active";
      update.status = cleanStatus;
      if (cleanStatus === "sold" && !editingListing.soldAt) update.sold_at = new Date().toISOString();
      if (cleanStatus === "active") update.sold_at = null;
      if (cleanStatus === "deleted" && !editingListing.deletedAt) update.deleted_at = new Date().toISOString();
    }
    setEditDeleteStatus("saving");
    try {
      // Combine kept existing photos with newly added photos.
      const newFiles = data.getAll("newPhotos").filter((f) => f && f.size > 0);
      const newCompressed = await Promise.all(newFiles.map((f) => optimizeGalleryImage(f)));
      const allPhotos = [...editListingPhotos, ...newCompressed].slice(0, 5);
      update.image_data = allPhotos.length === 0 ? "" : JSON.stringify(allPhotos);

      const { data: result, error } = adminSession
        ? await supabase.from("marketplace_listings").update(update).eq("id", editingListing.id)
        : await supabase.rpc("owner_update_marketplace_listing", {
            listing_id: editingListing.id,
            owner_id: effectiveOwnerId,
            new_title: update.title,
            new_price: update.price,
            new_category: update.category,
            new_location: update.location,
            new_contact: update.contact,
            new_description: update.description,
            new_image_data: update.image_data,
          });
      if (error || (!adminSession && result !== true)) { setEditDeleteStatus("error"); return; }
      const newImgs = parseListingImages(update.image_data);
      setMarketplaceListings((items) =>
        items.map((i) =>
          i.id === editingListing.id
            ? { ...i, ...update, ownerUserId: update.owner_user_id ?? i.ownerUserId, image: newImgs[0] ?? null, images: newImgs }
            : i,
        ),
      );
      setSelectedListing((prev) =>
        prev?.id === editingListing.id
          ? { ...prev, ...update, ownerUserId: update.owner_user_id ?? prev.ownerUserId, image: newImgs[0] ?? null, images: newImgs }
          : prev,
      );
      setEditDeleteStatus("");
      setEditingListing(null);
      if (adminSession) await loadAdminData();
    } catch {
      setEditDeleteStatus("error");
    }
  };

  const handleSellItemSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setSellItemStatus("saving");
    if (!supabase) { setSellItemStatus("missing-config"); return; }
    // ── Limit checks (bypass for admin) ──────────────────────
    if (!adminSession) {
    const myActiveListings = marketplaceListings.filter(
      (l) => isListingOwner(l) && l.status === "active" && (!l.expiresAt || new Date(l.expiresAt) > new Date()),
    );
    if (myActiveListings.length >= 10) { setSellItemStatus("limit-active"); return; }
    // Use local date string so it matches the user's timezone (not UTC)
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    let postedTodayCount = marketplaceListings.filter((l) => {
      if (!isListingOwner(l) || !l.createdAt) return false;
      const created = new Date(l.createdAt);
      const localCreated = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
      return localCreated === localToday;
    }).length;
    const localDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const localDayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const { data: ownerDailyCount, error: ownerDailyCountError } = await supabase.rpc("count_owner_marketplace_listings_between", {
      owner_id: effectiveOwnerId,
      starts_at: localDayStart,
      ends_at: localDayEnd,
    });
    if (ownerDailyCountError) { setSellItemStatus("error"); return; }
    if (Number.isFinite(Number(ownerDailyCount))) {
      postedTodayCount = Number(ownerDailyCount);
    }
    if (postedTodayCount >= 2) { setSellItemStatus("limit-daily"); return; }
    } // end !adminSession limit checks
    // ── Compute expiry ────────────────────────────────────────
    const durationDays = Number(sellDuration) || 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    try {
      // sellItemPhotos holds pre-compressed base64 strings (set during onChange).
      // Save as JSON array; parseListingImages handles old single-string rows on load.
      const imageData = sellItemPhotos.length === 0 ? "" : JSON.stringify(sellItemPhotos);
      const payload = {
        title: data.get("title").trim(),
        price: data.get("price").trim(),
        category: data.get("category"),
        location: data.get("location").trim(),
        contact: data.get("contact").trim(),
        description: data.get("description").trim(),
        image_data: imageData,
        owner_user_id: effectiveOwnerId,
        expires_at: expiresAt,
      };
      const moderationResult = evaluateMarketplaceModeration(payload, sellItemPhotos.length);
      if (moderationResult.moderation_flags?.local_rules?.some((hit) => hit.flag === "restricted_marketplace_item")) {
        setSellItemStatus("restricted-rejected");
        return;
      }
      const { error } = await supabase
        .from("marketplace_listings")
        .insert({
          ...payload,
          status: "active",
          moderation_status: moderationResult.moderation_status,
          moderation_reason: moderationResult.moderation_reason,
          moderation_score: moderationResult.moderation_score,
          moderation_flags: moderationResult.moderation_flags,
          moderation_input_types: moderationResult.moderation_input_types,
          moderation_model: moderationResult.moderation_model,
          moderated_at: moderationResult.moderated_at,
        });
      if (error) { setSellItemStatus("error"); return; }

      if (moderationResult.moderation_status === "rejected") {
        setSellItemStatus("moderation-rejected");
        setSellItemPhotos([]);
        form.reset();
        return;
      }

      if (moderationResult.moderation_status === "needs_review") {
        await loadMarketplacePublic();
        setSellItemStatus("moderation-review");
        setSellItemPhotos([]);
        form.reset();
        return;
      }

      await loadMarketplacePublic();
      setMarketplaceSearch("");
      setMarketplaceFilter("All");
      setSellItemStatus("moderation-review");
      setSellItemPhotos([]);
      form.reset();
    } catch {
      setSellItemStatus("error");
    }
  };
  // ── End marketplace computed ──────────────────────────────

  // ── Jobs computed ─────────────────────────────────────────
  const isJobOwner = (j) => {
    const ownerId = j?.owner_user_id ?? j?.ownerUserId ?? "";
    return !!(ownerId && (ownerId === effectiveOwnerId || ownerId === visitorKey));
  };

  const jobOwnerRequestId = (j) => {
    const ownerId = j?.owner_user_id ?? j?.ownerUserId ?? "";
    return ownerId === visitorKey ? visitorKey : effectiveOwnerId;
  };

  const mergeJobUpdate = (id, update) => {
    setPostedJobs((items) => items.map((item) => (item.id === id ? { ...item, ...update } : item)));
    setSelectedJob((prev) => (prev?.id === id ? { ...prev, ...update } : prev));
  };

  const handleOwnerJobEditSubmit = async (e) => {
    e.preventDefault();
    if (!supabase || !editingOwnerJob || !isJobOwner(editingOwnerJob)) return;
    const form = new FormData(e.currentTarget);
    const update = {
      title: form.get("title").trim(),
      company: form.get("company").trim(),
      category: form.get("category").trim(),
      job_type: form.get("job_type").trim(),
      pay_label: form.get("pay_label").trim() || null,
      location: form.get("location").trim(),
      contact_person: form.get("contact_person").trim() || null,
      phone: form.get("phone").trim() || null,
      email: form.get("email").trim() || null,
      description: form.get("description").trim(),
      requirements: form.get("requirements").trim() || null,
      app_method: form.get("app_method").trim() || "Phone",
      apply_url: form.get("apply_url").trim() || null,
    };
    setOwnerJobStatus("saving");
    const { data, error } = await supabase.rpc("owner_update_job_listing", {
      listing_id: editingOwnerJob.id,
      owner_id: jobOwnerRequestId(editingOwnerJob),
      new_title: update.title,
      new_company: update.company,
      new_category: update.category,
      new_job_type: update.job_type,
      new_pay_label: update.pay_label,
      new_location: update.location,
      new_contact_person: update.contact_person,
      new_phone: update.phone,
      new_email: update.email,
      new_description: update.description,
      new_requirements: update.requirements,
      new_app_method: update.app_method,
      new_apply_url: update.apply_url,
    });
    if (error || data !== true) {
      setOwnerJobStatus("error");
      return;
    }
    mergeJobUpdate(editingOwnerJob.id, {
      title: update.title,
      company: update.company,
      category: update.category,
      type: update.job_type,
      pay: update.pay_label || "Pay not specified",
      location: update.location,
      contactPerson: update.contact_person,
      contact: update.phone,
      email: update.email,
      description: update.description,
      requirements: update.requirements,
      appMethod: update.app_method,
      applyUrl: update.apply_url,
    });
    setEditingOwnerJob(null);
    setOwnerJobStatus("");
  };

  const confirmDeleteOwnerJob = async () => {
    if (!supabase || !deletingOwnerJob || !isJobOwner(deletingOwnerJob)) return;
    setOwnerJobStatus("saving");
    const { data, error } = await supabase.rpc("owner_delete_job_listing", {
      listing_id: deletingOwnerJob.id,
      owner_id: jobOwnerRequestId(deletingOwnerJob),
    });
    if (error || data !== true) {
      setOwnerJobStatus("error");
      return;
    }
    setPostedJobs((items) => items.filter((item) => item.id !== deletingOwnerJob.id));
    if (selectedJob?.id === deletingOwnerJob.id) {
      setSelectedJob(null);
      navigateTo("jobs");
    }
    setDeletingOwnerJob(null);
    setOwnerJobStatus("");
  };

  const isRentalOwner = (r) => !!(r?.owner_user_id && r.owner_user_id === effectiveOwnerId);

  const mergeRentalUpdate = (id, update) => {
    setRentalListings((items) => items.map((item) => (item.id === id ? { ...item, ...update } : item)));
    setSelectedRental((prev) => (prev?.id === id ? { ...prev, ...update } : prev));
  };

  const handleOwnerRentalEditSubmit = async (e) => {
    e.preventDefault();
    if (!supabase || !editingOwnerRental || !isRentalOwner(editingOwnerRental)) return;
    const form = new FormData(e.currentTarget);
    const isSTR = form.get("property_type") === "Short-Term";
    const update = {
      title: form.get("title").trim(),
      property_type: form.get("property_type"),
      address: form.get("address").trim(),
      description: form.get("description").trim() || null,
      phone: form.get("phone").trim() || null,
      email: form.get("email").trim() || null,
      external_url: form.get("external_url").trim() || null,
      price: isSTR ? null : form.get("price").trim() || null,
      deposit: isSTR ? null : form.get("deposit").trim() || null,
      price_per_night: isSTR ? form.get("price_per_night").trim() || null : null,
      price_per_week: isSTR ? form.get("price_per_week").trim() || null : null,
      available_from: isSTR ? form.get("available_from") || null : null,
      available_to: isSTR ? form.get("available_to") || null : null,
      max_guests: isSTR ? form.get("max_guests").trim() || null : null,
      house_rules: isSTR ? form.get("house_rules").trim() || null : null,
      pets_allowed: form.get("pets_allowed") === "on",
      bedrooms: isSTR ? null : form.get("bedrooms") || null,
      bathrooms: isSTR ? null : form.get("bathrooms") || null,
    };
    setOwnerRentalStatus("saving");
    const { data, error } = await supabase.rpc("owner_update_rental_listing", {
      listing_id: editingOwnerRental.id,
      owner_id: effectiveOwnerId,
      new_title: update.title,
      new_property_type: update.property_type,
      new_address: update.address,
      new_description: update.description,
      new_phone: update.phone,
      new_email: update.email,
      new_external_url: update.external_url,
      new_price: update.price,
      new_deposit: update.deposit,
      new_price_per_night: update.price_per_night,
      new_price_per_week: update.price_per_week,
      new_available_from: update.available_from,
      new_available_to: update.available_to,
      new_max_guests: update.max_guests,
      new_house_rules: update.house_rules,
      new_pets_allowed: update.pets_allowed,
      new_bedrooms: update.bedrooms,
      new_bathrooms: update.bathrooms,
    });
    if (error || data !== true) {
      setOwnerRentalStatus("error");
      return;
    }
    mergeRentalUpdate(editingOwnerRental.id, update);
    setEditingOwnerRental(null);
    setOwnerRentalStatus("");
  };

  const confirmDeleteOwnerRental = async () => {
    if (!supabase || !deletingOwnerRental || !isRentalOwner(deletingOwnerRental)) return;
    setOwnerRentalStatus("saving");
    const { data, error } = await supabase.rpc("owner_delete_rental_listing", {
      listing_id: deletingOwnerRental.id,
      owner_id: effectiveOwnerId,
    });
    if (error || data !== true) {
      setOwnerRentalStatus("error");
      return;
    }
    setRentalListings((items) => items.filter((item) => item.id !== deletingOwnerRental.id));
    if (selectedRental?.id === deletingOwnerRental.id) {
      setSelectedRental(null);
      navigateTo("rentals");
    }
    setDeletingOwnerRental(null);
    setOwnerRentalStatus("");
  };

  const rentalPlacementExpiresAt = (rental) => rental?.placement_expires_at ?? rental?.placementExpiresAt ?? "";

  const hasActiveRentalPromotion = (rental) => {
    const plan = String(rental?.plan ?? "free").toLowerCase();
    const paymentStatus = String(rental?.payment_status ?? rental?.paymentStatus ?? "").toLowerCase();
    const placementSource = String(rental?.placement_source ?? rental?.placementSource ?? "").toLowerCase();
    const expiresAt = rentalPlacementExpiresAt(rental);

    if (!["featured", "premium"].includes(plan)) {
      return false;
    }

    if (placementSource === "comp") {
      return !expiresAt || new Date(expiresAt) > new Date();
    }

    if (placementSource !== "stripe" || !activePaidPaymentStatuses.has(paymentStatus)) {
      return false;
    }

    return !!expiresAt && new Date(expiresAt) > new Date();
  };

  const rentalPromotionRank = (rental) => {
    if (!hasActiveRentalPromotion(rental)) {
      return 2;
    }

    return String(rental?.plan ?? "free").toLowerCase() === "premium" ? 0 : 1;
  };

  const jobPlanOrder = { premium: 0, featured: 1, free: 2 };
  const allJobListings = [
    ...postedJobs.map((j) => ({ ...j, tag: j.plan === "free" ? "New Today" : j.plan === "featured" ? "Featured" : "Premium", filters: [j.type, "New Today"] })),
  ].sort((a, b) => (jobPlanOrder[a.plan] ?? 2) - (jobPlanOrder[b.plan] ?? 2));
  const filteredJobListings = (jobsShowSaved ? allJobListings.filter((j) => savedJobs.includes(j.id)) : allJobListings).filter((j) => {
    const matchesCategory = jobsCategoryFilter === "All" || j.category === jobsCategoryFilter;
    const matchesFilter = jobsFilter === "All" || j.tag === jobsFilter || (j.filters ?? []).includes(jobsFilter);
    const text = `${j.title} ${j.company} ${j.category} ${j.type} ${j.pay} ${j.description}`.toLowerCase();
    return matchesCategory && matchesFilter && text.includes(jobsSearch.trim().toLowerCase());
  });
  const jobsCategoryCounts = allJobListings.reduce((acc, j) => {
    acc[j.category] = (acc[j.category] ?? 0) + 1;
    (j.filters ?? []).forEach((f) => { acc[f] = (acc[f] ?? 0) + 1; });
    return acc;
  }, {});
  const filteredAdminRentalListings = adminRentalListings.filter((r) => (
    adminRentalStatusFilter === "all" || (r.status ?? "approved") === adminRentalStatusFilter
  ));
  // ── End jobs computed ──────────────────────────────────────
  const deletedStaticItemSet = new Set(deletedStaticItems);
  const visibleInitialBusinesses = initialBusinesses.filter(
    (business) => !deletedStaticItemSet.has(`business:${business.id}`) && !hiddenStaticItemSet.has(`business:${business.id}`),
  );
  const hiddenInitialBusinesses = initialBusinesses.filter(
    (business) => !deletedStaticItemSet.has(`business:${business.id}`) && hiddenStaticItemSet.has(`business:${business.id}`),
  );
  const visibleStaticEvents = events.filter(
    (event) => !deletedStaticItemSet.has(staticEventKey(event)) && !hiddenStaticItemSet.has(staticEventKey(event)),
  );
  const hiddenStaticEvents = events.filter(
    (event) => !deletedStaticItemSet.has(staticEventKey(event)) && hiddenStaticItemSet.has(staticEventKey(event)),
  );
  const visibleStaticGalleryPhotos = galleryShots.filter(
    (photo) => !deletedStaticItemSet.has(staticGalleryKey(photo)) && !hiddenStaticItemSet.has(staticGalleryKey(photo)),
  );
  const hiddenStaticGalleryPhotos = galleryShots.filter(
    (photo) => !deletedStaticItemSet.has(staticGalleryKey(photo)) && hiddenStaticItemSet.has(staticGalleryKey(photo)),
  );
  const allEvents = [...approvedEvents, ...visibleStaticEvents];
  const allBusinesses = [...businesses, ...visibleInitialBusinesses];
  const paidBusinesses = [...allBusinesses]
    .filter(hasActiveBusinessPromotion)
    .sort((a, b) => (planRank[a.plan] ?? 99) - (planRank[b.plan] ?? 99));
  const premiumBusinesses = paidBusinesses.filter((business) => business.plan === "Premium");
  const lobbyFeaturedBusinesses = paidBusinesses.filter((business) => business.plan === "Featured");
  const jobLobbyImage = (job) => job.image || appAsset("jobs-bg.png");
  const toBusinessLobbyItem = (business) => ({
    type: "business",
    source: "business_submissions",
    id: business.id,
    title: business.name,
    name: business.name,
    category: business.category,
    categoryLabel: business.category,
    phone: business.phone,
    image: businessDisplayImage(business),
    business,
  });
  const toJobLobbyItem = (job) => ({
    type: "job",
    source: "job_listings",
    id: job.id,
    title: job.title,
    name: job.title,
    subtitle: job.company,
    company: job.company,
    category: "Jobs & Hiring",
    categoryLabel: "Jobs & Hiring",
    plan: job.plan,
    image: jobLobbyImage(job),
    pay: job.pay,
    location: job.location,
    job,
  });
  const toRentalLobbyItem = (rental) => {
    const photos = Array.isArray(rental.image_data) ? rental.image_data.filter(Boolean) : [];
    const isShortTermRental = rental.property_type === "Short-Term";
    const priceLabel = isShortTermRental
      ? [rental.price_per_night && `${rental.price_per_night}/night`, rental.price_per_week && `${rental.price_per_week}/week`].filter(Boolean).join(" - ")
      : rental.price;

    return {
      type: "rental",
      source: "rental_listings",
      id: rental.id,
      title: rental.title,
      name: rental.title,
      subtitle: rental.address,
      category: "Rent & Housing",
      categoryLabel: "Rent & Housing",
      plan: String(rental.plan ?? "free").toLowerCase(),
      image: photos[0] || appAsset("rentals-bg.png"),
      price: priceLabel,
      location: rental.address,
      rental,
    };
  };
  const lobbyFeaturedItems = [
    ...lobbyFeaturedBusinesses.map(toBusinessLobbyItem),
    ...allJobListings.filter((job) => job.plan === "featured").map(toJobLobbyItem),
    ...rentalListings
      .filter((rental) => hasActiveRentalPromotion(rental) && String(rental.plan ?? "free").toLowerCase() === "featured")
      .map(toRentalLobbyItem),
  ];
  const premiumLobbyItems = [
    ...premiumBusinesses.map(toBusinessLobbyItem),
    ...allJobListings.filter((job) => job.plan === "premium").map(toJobLobbyItem),
    ...rentalListings
      .filter((rental) => hasActiveRentalPromotion(rental) && String(rental.plan ?? "free").toLowerCase() === "premium")
      .map(toRentalLobbyItem),
  ];
  const lobbyClickReports = itemReports.filter((report) => report.itemType === "Lobby");
  const serviceClickReports = itemReports.filter((report) => report.itemType !== "Lobby");
  const lobbyCarouselLength = lobbyFeaturedItems.length + 1;
  const normalizedLobbyCarouselIndex = lobbyCarouselIndex % lobbyCarouselLength;
  const isLobbyAboutSlide = normalizedLobbyCarouselIndex === 0 || !lobbyFeaturedItems.length;
  const lobbyCarouselItem = isLobbyAboutSlide ? null : lobbyFeaturedItems[normalizedLobbyCarouselIndex - 1];
  const spotlightItem =
    premiumLobbyItems[premiumCarouselIndex % Math.max(premiumLobbyItems.length, 1)] ??
    paidBusinesses.map(toBusinessLobbyItem)[0];
  const openLobbyPromotionItem = async (item, placement) => {
    if (!item) {
      await trackLobbySectionClick("upcoming-highlight", "Upcoming Highlight");
      return;
    }

    if (item.type === "job") {
      await trackPublicItemClick("service", `lobby-${placement}-job-${item.id}`, `Lobby: ${placement} Job ${item.title}`);
      setSelectedJob(item.job);
      navigateTo("job-detail");
      return;
    }

    if (item.type === "rental") {
      await trackPublicItemClick("service", `lobby-${placement}-rental-${item.id}`, `Lobby: ${placement} Rental ${item.title}`);
      setSelectedRental(item.rental);
      setRentalGalleryIdx(0);
      navigateTo("rental-detail");
      return;
    }

    if (item.type === "business" || item.business) {
      await trackPublicItemClick("service", `lobby-${placement}-${item.id}`, `Lobby: ${placement} ${item.name}`);
      setSelectedBusinessId(item.business?.id ?? item.id ?? "");
      const dest1 = categorySectionMap[item.business?.category] ?? "directory";
      if (dest1 === "directory") directoryReturnRef.current = "lobby";
      navigateTo(dest1);
    }
  };
  const openUpcomingHighlight = async () => {
    await openLobbyPromotionItem(spotlightItem, "highlight");
  };
  const prioritizeSelectedBusiness = (items) =>
    [...items].sort((a, b) => {
      if (selectedBusinessId) {
        if (a.id === selectedBusinessId) return -1;
        if (b.id === selectedBusinessId) return 1;
      }

      return (planRank[businessDisplayPlan(a) || "Free"] ?? 99) - (planRank[businessDisplayPlan(b) || "Free"] ?? 99);
    });
  const directoryBusinesses = prioritizeSelectedBusiness(allBusinesses);
  const businessServiceBusinessesByPage = Object.fromEntries(
    Object.entries(businessServiceSections).map(([sectionPage, section]) => [
      sectionPage,
      prioritizeSelectedBusiness(
        businesses.filter((business) =>
          section.categories.some(
            (category) => category.toLowerCase() === String(business.category ?? "").trim().toLowerCase(),
          ),
        ),
      ),
    ]),
  );
  const galleryPhotos = [...approvedGalleryPhotos, ...visibleStaticGalleryPhotos];
  const filteredLocalNewsItems =
    selectedNewsCategory === "All"
      ? localNewsItems
      : localNewsItems.filter((story) => (story.news_category ?? "Local Buzz") === selectedNewsCategory);
  const likeCountFor = (itemType, itemKey) => likeCounts[`${itemType}:${itemKey}`] ?? 0;
  const isLiked = (itemType, itemKey) => likedItems.includes(`${itemType}:${itemKey}`);
  const reviewStatusText = {
    error: "Sorry, the review could not be sent.",
    "missing-config": "Reviews are not connected yet.",
    saved: "Thanks. Your review was sent for approval.",
    saving: "Sending review...",
  };

  useEffect(() => {
    if (lobbyCarouselLength <= 1) {
      return;
    }

    const delay = isLobbyAboutSlide ? lobbyAboutRotationMs : featuredPromotionRotationMs;
    const timer = window.setTimeout(() => {
      setLobbyCarouselIndex((currentIndex) => (currentIndex + 1) % lobbyCarouselLength);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isLobbyAboutSlide, lobbyCarouselLength, lobbyCarouselIndex]);

  useEffect(() => {
    if (premiumLobbyItems.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setPremiumCarouselIndex((currentIndex) => (currentIndex + 1) % premiumLobbyItems.length);
    }, premiumPromotionRotationMs);

    return () => window.clearInterval(timer);
  }, [premiumLobbyItems.length]);

  const openImageViewer = (src, title) => {
    if (!src) {
      return;
    }

    setImageViewerPhoto({ src, title });
  };

  const renderLikeButton = (itemType, itemKey) => (
    <button
      className={`like-button${isLiked(itemType, itemKey) ? " is-liked" : ""}`}
      type="button"
      onClick={() => handleLike(itemType, itemKey)}
      disabled={isLiked(itemType, itemKey)}
    >
      {isLiked(itemType, itemKey) ? "Liked" : "Like"} · {likeCountFor(itemType, itemKey)}
    </button>
  );

  const isEditableBusiness = (business) =>
    !!business?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(business.id));

  const isBusinessOwner = (business) =>
    !!(business?.owner_user_id && business.owner_user_id === effectiveOwnerId);

  const canManageBusiness = (business) => isEditableBusiness(business) && (!!adminSession || isBusinessOwner(business));

  const mergeOwnerBusinessUpdate = (businessId, update) => {
    setBusinesses((items) => items.map((item) => (item.id === businessId ? { ...item, ...update } : item)));
  };

  const handleOwnerBusinessEditSubmit = async (event) => {
    event.preventDefault();
    if (!supabase || !editingOwnerBusiness || !canManageBusiness(editingOwnerBusiness)) return;

    const data = new FormData(event.currentTarget);
    const imageFile = data.get("businessImage");
    const update = {
      name: data.get("businessName").trim(),
      contactName: data.get("contactName").trim(),
      contactEmail: data.get("contactEmail").trim(),
      phone: data.get("phone").trim(),
      address: data.get("address").trim(),
      social: data.get("social").trim(),
      description: data.get("description").trim(),
    };

    setOwnerBusinessStatus("saving");

    try {
      const nextImage = imageFile && imageFile.size ? await optimizeGalleryImage(imageFile) : editingOwnerBusiness.image;
      const { data: result, error } = await supabase.rpc("owner_update_business_submission", {
        p_business_id: editingOwnerBusiness.id,
        p_owner_id: effectiveOwnerId,
        p_business_name: update.name,
        p_contact_name: update.contactName,
        p_contact_email: update.contactEmail,
        p_phone: update.phone,
        p_address: update.address,
        p_social: update.social,
        p_description: update.description,
        p_image_data: nextImage,
      });

      if (error || result !== true) {
        setOwnerBusinessStatus("error");
        return;
      }

      mergeOwnerBusinessUpdate(editingOwnerBusiness.id, { ...update, image: nextImage });
      setEditingOwnerBusiness(null);
      setOwnerBusinessStatus("");
    } catch {
      setOwnerBusinessStatus("error");
    }
  };

  const confirmHideOwnerBusiness = async () => {
    if (!supabase || !deletingOwnerBusiness || !canManageBusiness(deletingOwnerBusiness)) return;

    setOwnerBusinessStatus("saving");
    const { data: result, error } = await supabase.rpc("owner_hide_business_submission", {
      p_business_id: deletingOwnerBusiness.id,
      p_owner_id: effectiveOwnerId,
    });

    if (error || result !== true) {
      setOwnerBusinessStatus("error");
      return;
    }

    setBusinesses((items) => items.filter((item) => item.id !== deletingOwnerBusiness.id));
    setDeletingOwnerBusiness(null);
    setOwnerBusinessStatus("");
  };

  const renderOwnerBusinessActions = (business) =>
    canManageBusiness(business) ? (
      <>
        <button className="directory-link" type="button" onClick={() => { setEditingOwnerBusiness({ ...business }); setOwnerBusinessStatus(""); }}>
          Edit
        </button>
        <button className="directory-link danger-link" type="button" onClick={() => { setDeletingOwnerBusiness({ ...business }); setOwnerBusinessStatus(""); }}>
          Delete
        </button>
      </>
    ) : null;

  const renderOwnerBusinessModals = () => (
    <>
      {editingOwnerBusiness && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="owner-business-edit-title">
            <div className="admin-modal-heading">
              <p className="eyebrow">Business</p>
              <h2 id="owner-business-edit-title">Edit Business</h2>
            </div>
            <form className="gallery-form" onSubmit={handleOwnerBusinessEditSubmit}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Business Name</span>
                  <input name="businessName" type="text" defaultValue={editingOwnerBusiness.name ?? ""} required />
                </label>
                <label className="form-field">
                  <span>Contact Name</span>
                  <input name="contactName" type="text" defaultValue={editingOwnerBusiness.contactName ?? ""} required />
                </label>
                <label className="form-field">
                  <span>Contact Email</span>
                  <input name="contactEmail" type="email" defaultValue={editingOwnerBusiness.contactEmail ?? ""} required />
                </label>
                <label className="form-field">
                  <span>Phone</span>
                  <input name="phone" type="tel" defaultValue={editingOwnerBusiness.phone ?? ""} required />
                </label>
                <label className="form-field">
                  <span>Address</span>
                  <input name="address" type="text" defaultValue={editingOwnerBusiness.address ?? ""} />
                </label>
                <label className="form-field">
                  <span>Social / Website</span>
                  <input name="social" type="text" defaultValue={editingOwnerBusiness.social ?? ""} />
                </label>
                <label className="form-field form-field-wide">
                  <span>Business Photo</span>
                  <input name="businessImage" type="file" accept="image/*" />
                </label>
              </div>
              <label className="form-field">
                <span>Description</span>
                <textarea name="description" rows="4" defaultValue={editingOwnerBusiness.description ?? ""} />
              </label>
              <div className="admin-modal-actions">
                <button className="primary-button admin-modal-primary" type="submit" disabled={ownerBusinessStatus === "saving"}>
                  {ownerBusinessStatus === "saving" ? "Saving..." : "Save Changes"}
                </button>
                <button className="directory-link" type="button" onClick={() => { setEditingOwnerBusiness(null); setOwnerBusinessStatus(""); }}>
                  Go Back
                </button>
              </div>
              {ownerBusinessStatus === "error" && <p className="form-error">Could not save this business.</p>}
            </form>
          </section>
        </div>
      )}
      {deletingOwnerBusiness && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="owner-business-delete-title">
            <div className="admin-modal-heading">
              <p className="eyebrow">Business</p>
              <h2 id="owner-business-delete-title">Delete Business?</h2>
            </div>
            <p>Hide this business from Abilene Vibes?</p>
            <p>{deletingOwnerBusiness.name}</p>
            <div className="admin-modal-actions">
              <button className="directory-link danger-link" type="button" onClick={confirmHideOwnerBusiness} disabled={ownerBusinessStatus === "saving"}>
                {ownerBusinessStatus === "saving" ? "Deleting..." : "Delete"}
              </button>
              <button className="directory-link" type="button" onClick={() => { setDeletingOwnerBusiness(null); setOwnerBusinessStatus(""); }}>
                Go Back
              </button>
            </div>
            {ownerBusinessStatus === "error" && <p className="form-error">Could not delete this business.</p>}
          </section>
        </div>
      )}
    </>
  );

  const renderAdminBusinessDeleteModal = () => (
    deletingAdminBusiness ? (
      <div className="admin-modal-backdrop" role="presentation">
        <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-business-delete-title">
          <div className="admin-modal-heading">
            <p className="eyebrow">Admin Business</p>
            <h2 id="admin-business-delete-title">Delete Business?</h2>
          </div>
          <p>Permanently delete this business from Abilene Vibes?</p>
          <p>{deletingAdminBusiness.business_name}</p>
          <div className="admin-modal-actions">
            <button
              className="directory-link danger-link"
              type="button"
              onClick={confirmDeleteAdminBusiness}
              disabled={adminBusinessActionKey.startsWith(`${deletingAdminBusiness.id}:`)}
            >
              {adminBusinessActionKey === `${deletingAdminBusiness.id}:delete` ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              className="directory-link"
              type="button"
              onClick={() => setDeletingAdminBusiness(null)}
              disabled={adminBusinessActionKey.startsWith(`${deletingAdminBusiness.id}:`)}
            >
              Cancel
            </button>
          </div>
          {adminStatus === "error" && <p className="form-error">Could not delete this business.</p>}
        </section>
      </div>
    ) : null
  );

  const renderBusinessPlanButtons = (business, options = {}) => {
    const isBusinessAction = (action) => adminBusinessActionKey === `${business.id}:${action}`;
    const isBusinessBusy = adminBusinessActionKey.startsWith(`${business.id}:`);

    return (
      <>
        {(options.showEdit !== false || options.showCategoryPhoto) && (
          <div className="admin-business-action-group">
            <span className="admin-business-action-label">Edit</span>
            <div className="admin-business-action-buttons">
              {options.showEdit !== false && (
                <button className="directory-link" type="button" onClick={() => editBusiness(business)} disabled={isBusinessBusy}>
                  {isBusinessAction("edit") ? "Updating..." : "Edit"}
                </button>
              )}
              {options.showCategoryPhoto && (
                <label className="directory-link file-action">
                  {isBusinessAction("photo") ? "Uploading..." : "Change Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isBusinessBusy}
                    onChange={(inputEvent) => {
                      changeBusinessPhoto(business.id, inputEvent.target.files?.[0]);
                      inputEvent.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )}
        <div className="admin-business-action-group">
          <span className="admin-business-action-label">Promotion</span>
          <div className="admin-business-action-buttons">
            <button className="directory-link" type="button" onClick={() => setPaidBusinessPlacement(business, "Free")} disabled={isBusinessBusy}>
              {isBusinessAction("plan-free") ? "Updating..." : "Plan Free"}
            </button>
            <button className="directory-link" type="button" onClick={() => compBusinessPlacement(business, "Featured")} disabled={isBusinessBusy}>
              {isBusinessAction("comp-featured") ? "Updating..." : "Free Promo Featured"}
            </button>
            <button className="directory-link" type="button" onClick={() => compBusinessPlacement(business, "Premium")} disabled={isBusinessBusy}>
              {isBusinessAction("comp-premium") ? "Updating..." : "Free Promo Premium"}
            </button>
            {business.placement_source === "comp" && (
              <button className="directory-link danger-link" type="button" onClick={() => clearCompBusinessPlacement(business)} disabled={isBusinessBusy}>
                {isBusinessAction("end-promo") ? "Updating..." : "End Promo"}
              </button>
            )}
            {business.placement_source !== "comp" &&
              business.plan !== "Free" &&
              business.payment_status !== "not_required" &&
              business.stripe_subscription_id &&
              ["paid", "cancel_pending"].includes(business.payment_status) && (
              <button className="directory-link danger-link" type="button" onClick={() => cancelBusinessSubscription(business)} disabled={isBusinessBusy}>
                {isBusinessAction("cancel-subscription") ? "Cancelling..." : "Cancel Subscription"}
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderBusinessReviews = (business) => {
    const reviews = approvedReviews[business.id] ?? [];
    const reviewStatus = reviewSubmissionStatus[business.id];

    return (
      <div className="review-panel">
        <div className="review-summary">
          <strong>
            {reviews.length
              ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}`
              : "No reviews yet"}
          </strong>
        </div>

        {reviews.slice(0, 2).map((review) => (
          <blockquote className="review-card" key={review.id}>
            <strong>{review.rating} stars · {review.reviewer_name}</strong>
            <p>{review.comment}</p>
          </blockquote>
        ))}

        <form className="review-form" onSubmit={(event) => handleReviewSubmit(event, business)}>
          <div className="review-form-row">
            <input name="reviewerName" type="text" placeholder="Your name" required />
            <select name="rating" defaultValue="5" required>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </div>
          <textarea name="comment" placeholder="Write a short review" rows="3" required />
          <button className="directory-link" type="submit" disabled={reviewStatus === "saving"}>
            {reviewStatus === "saving" ? "Sending..." : "Submit Review"}
          </button>
          {reviewStatus && (
            <p className={reviewStatus === "saved" ? "form-success compact-status" : "form-error compact-status"}>
              {reviewStatusText[reviewStatus]}
            </p>
          )}
        </form>
      </div>
    );
  };

  const splashOverlay = isStarting && (
    <div className="splash-page" aria-label="Opening Abilene Vibes">
      <div className="splash-mark" aria-hidden="true">
        <img src={appAsset("icon-512.png")} alt="" />
      </div>
      <div className="splash-loader" aria-hidden="true" />
    </div>
  );

  const withSplash = (content) => (
    <>
      {content}
      {imageViewerPhoto && (
        <ImageViewer
          key={`${imageViewerPhoto.src}-${imageViewerPhoto.title}`}
          photo={imageViewerPhoto}
          onClose={() => setImageViewerPhoto(null)}
        />
      )}
      {splashOverlay}
    </>
  );

  if (page === "lobby") {
    return withSplash(
      <main className="app photo-page">
        <section
          className="photo-feature lobby-v2"
          style={{ "--lobby-bg": `url("${appAsset("lobby-correcta.jpg")}")` }}
          aria-label="Abilene Vibes lobby"
        >
          <div className="lobby-title-badge" aria-label="Lobby">
            <span>Lobby</span>
          </div>

          <button className="weather-widget" type="button" aria-label={`Weather in ${weather.label}`}>
            <span className="weather-icon">{weather.isDay ? "☀" : "☾"}</span>
            <span className="weather-thermometer" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a5 5 0 1 1-4 0Z" />
                <path d="M12 6v10" />
              </svg>
            </span>
            <span className="weather-copy">
              <strong>{weather.temp === null ? "--" : weather.temp}°</strong>
              <span>
                {weather.status === "loading"
                  ? "Loading..."
                  : weather.status === "error" && weather.temp === null
                    ? "Weather unavailable"
                    : weather.label}
              </span>
            </span>
          </button>

          <button
            className={`lobby-about${lobbyCarouselItem ? " is-featured" : ""}`}
            type="button"
            onClick={async () => {
              if (lobbyCarouselItem) {
                await openLobbyPromotionItem(lobbyCarouselItem, "featured");
              }
            }}
            aria-label={lobbyCarouselItem ? `Featured ${lobbyCarouselItem.categoryLabel} ${lobbyCarouselItem.name}` : "About Abilene Vibes"}
          >
            {lobbyCarouselItem ? (
              <>
                <img className="lobby-about-thumb" src={lobbyCarouselItem.image} alt="" />
                <span>Featured local</span>
                <strong>{lobbyCarouselItem.name}</strong>
                <p>{lobbyCarouselItem.categoryLabel}</p>
                {lobbyCarouselItem.type === "job" && lobbyCarouselItem.company && <p>{lobbyCarouselItem.company}</p>}
                {lobbyCarouselItem.type === "rental" && lobbyCarouselItem.location && <p>{lobbyCarouselItem.location}</p>}
                {lobbyCarouselItem.type === "business" && lobbyCarouselItem.phone && <p>{lobbyCarouselItem.phone}</p>}
              </>
            ) : (
              <>
                <span>About the app</span>
                <p>
                  Abilene Vibes is your local guide to events, nightlife, eats, shopping, family plans, stays, and
                  businesses around Abilene.
                </p>
              </>
            )}
          </button>

          <nav className="lobby-action-list" aria-label="Abilene Vibes sections">
            {lobbyActions.map((action) => (
              <button
                className={`lobby-action-card is-${action.tone}${action.page === "events" ? " is-priority" : ""}`}
                key={action.page}
                type="button"
                onClick={() => navigateWithLobbyClick(action.page, action.label, action.page)}
              >
                <span className="lobby-action-icon" aria-hidden="true">
                  <LobbyActionIcon icon={action.icon} />
                </span>
                <span className="lobby-action-copy">
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </span>
                <span className="lobby-action-arrow" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </nav>

          <button
            className="lobby-more-button"
            type="button"
            onClick={() => navigateWithLobbyClick("more", "More", "more")}
          >
            More <span className="lobby-more-arrows" aria-hidden="true">≫</span>
          </button>

          <button className="lobby-highlight" type="button" onClick={openUpcomingHighlight} aria-label="Upcoming highlight">
            {spotlightItem ? (
              <>
                <img src={spotlightItem.image} alt="" />
                <div>
                  <span>Upcoming Highlight</span>
                  <strong>{spotlightItem.name}</strong>
                  <p>{spotlightItem.categoryLabel}</p>
                  <p>
                    {spotlightItem.type === "job"
                      ? (spotlightItem.pay || spotlightItem.location)
                      : spotlightItem.type === "rental"
                        ? (spotlightItem.price || spotlightItem.location)
                        : spotlightItem.phone}
                  </p>
                </div>
              </>
            ) : (
              <>
                <img src={appAsset("lobby-correcta.jpg")} alt="" />
                <div>
                  <span>Upcoming Highlight</span>
                  <strong>Upcoming local highlights will appear here soon.</strong>
                  <p>Check back soon for local highlights.</p>
                </div>
              </>
            )}
          </button>

          <div className="lobby-bottom-actions">
            <button
              className="lobby-bottom-home"
              type="button"
              onClick={() => navigateWithLobbyClick("home", "Home", "home")}
            >
              <span aria-hidden="true">⌂</span>
              Home
            </button>
            <button
              className="lobby-bottom-promote"
              type="button"
              onClick={() => navigateWithLobbyClick("promote", "Promote your business", "promote")}
            >
              Promote your business
            </button>
          </div>
        </section>
      </main>,
    );
  }

  if (page === "more") {
    return withSplash(
      <main className="app more-page">
        <div className="more-screen" style={{ "--services-bg": `url("${appAsset("services-bg.jpg")}")` }}>
          <button className="more-back-button" type="button" onClick={backToLobby}>
            Back
          </button>

          <section className="more-header" aria-labelledby="more-title">
            <p>Services</p>
            <h1 id="more-title">More in Abilene</h1>
          </section>

          <section className="more-service-grid" aria-label="More Abilene services">
            {moreServices.map((service) => (
              <button
                className="more-service-button"
                type="button"
                key={service.label}
                onClick={() => {
                  trackPublicItemClick("service", service.icon, service.label);
                  if (service.page) {
                    if (service.page === "directory") directoryReturnRef.current = "more";
                    navigateTo(service.page);
                  }
                }}
              >
                <span className="more-service-icon" aria-hidden="true">
                  <ServiceIcon icon={service.icon} />
                </span>
                <span>{service.label}</span>
              </button>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  if (page === "news") {
    const leadNewsStory = filteredLocalNewsItems.find((story) => story.image_url) ?? filteredLocalNewsItems[0];
    const newsListStories = leadNewsStory
      ? filteredLocalNewsItems.filter((story) => story.id !== leadNewsStory.id)
      : filteredLocalNewsItems;
    const newsTickerStories = localNewsItems.slice(0, 6);

    return withSplash(
      <main className="app events-page news-page">
        <div className="events-shell">
          <button className="back-button" onClick={() => navigateTo("more")}>
            Back to services
          </button>

          <section className="events-header" aria-labelledby="news-title">
            <p className="eyebrow">Live weekly pulse</p>
            <h1 id="news-title">Local News</h1>
            <p className="events-intro">
              Fires, arrests, openings, campus sports, and Flying Bison updates from trusted sources in the last 7 days.
            </p>
          </section>

          {localNewsItems.length ? (
            <section className="news-ticker" aria-label="Latest Abilene updates">
              <span>Live feed</span>
              <div>
                <p>
                  {newsTickerStories.map((story) => `${story.news_category ?? "Local Buzz"}: ${story.title}`).join("   •   ")}
                </p>
              </div>
            </section>
          ) : null}

          <section className="news-filter-strip" aria-label="Local news categories">
            {localNewsCategories.map((category) => (
              <button
                className={selectedNewsCategory === category.label ? "is-active" : ""}
                type="button"
                key={category.label}
                onClick={() => setSelectedNewsCategory(category.label)}
              >
                <strong>{category.label}</strong>
                <span>{category.description}</span>
              </button>
            ))}
          </section>

          {localNewsItems.length ? (
            <>
              {leadNewsStory && (
                <article
                  className={`news-lead-card news-tone-${(leadNewsStory.news_category ?? "Local Buzz").toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {leadNewsStory.image_url && <img src={leadNewsStory.image_url} alt="" />}
                  <div>
                    <span className="news-live-dot">Updated this week</span>
                    <h2>{leadNewsStory.title}</h2>
                    <p>{leadNewsStory.summary}</p>
                    <a
                      className="place-link"
                      href={leadNewsStory.original_url ?? leadNewsStory.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read original
                    </a>
                  </div>
                </article>
              )}

            <section className="event-list news-grid" aria-label="Local news this week">
              {newsListStories.map((story) => (
                <article
                  className={`event-card news-card news-tone-${(story.news_category ?? "Local Buzz").toLowerCase().replace(/\s+/g, "-")}`}
                  key={story.id}
                >
                  {story.image_url && <img className="news-image" src={story.image_url} alt="" loading="lazy" />}
                  <div className="event-copy">
                    <div className="news-card-topline">
                      <span className="event-type">{story.news_category ?? "Local Buzz"}</span>
                      <span className="news-mood">{story.mood_label ?? "Fresh"}</span>
                    </div>
                    <h2>{story.title}</h2>
                    <p className="event-detail">{story.summary}</p>
                    <p className="event-detail">
                      {story.source_name} · {new Date(story.published_at).toLocaleDateString()} · {story.verification_status ?? "verified"}
                    </p>
                    <div className="place-actions">
                      <a
                        className="place-link"
                        href={story.original_url ?? story.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read original
                      </a>
                    </div>
                  </div>
                </article>
              ))}
              {!filteredLocalNewsItems.length && (
                <article className="event-card news-card">
                  <div className="event-copy">
                    <span className="event-type">{selectedNewsCategory}</span>
                    <h2>No fresh stories in this lane yet</h2>
                    <p className="event-detail">
                      The feed updates every hour and only shows stories from the last 7 days.
                    </p>
                  </div>
                </article>
              )}
            </section>
            </>
          ) : (
            <section className="event-list" aria-label="Verified local news sources">
              {verifiedNewsSources.map((source) => (
                <article className="event-card news-card" key={source.name}>
                  <div className="event-copy">
                    <span className="event-type">Source ready</span>
                    <h2>{source.name}</h2>
                    <p className="event-detail">{source.note}</p>
                    <div className="place-actions">
                      <a className="place-link" href={source.url} target="_blank" rel="noreferrer">
                        Open source
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </main>,
    );
  }

  if (page === "events") {
    return withSplash(
      <main className="app events-page official-events-page">
        <div className="events-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="events-header" aria-labelledby="events-title">
            <p className="eyebrow">This week in town</p>
            <h1 id="events-title">Events in Abilene</h1>
            <p className="events-intro">
              A bright, quick-scan lineup for music, food, nightlife, and easy weekend plans.
            </p>
          </section>

          <section className="event-list" aria-label="Featured Abilene events">
            {allEvents.length === 0 && (
              <div className="events-empty-state">
                <h2>No events scheduled right now.</h2>
                <p>Check back soon for new events happening around Abilene.</p>
              </div>
            )}
            {allEvents.map((event) => (
              <article className="event-card" key={event.id ?? `${event.title}-${event.date}`}>
                <img className="event-image" src={event.image} alt="" loading="lazy" />

                <div className="event-copy">
                  <h2>{event.title}</h2>
                  <p className="event-detail">Starts: {event.startsLabel}</p>
                  <p className="event-detail">Ends: {event.endsLabel}</p>
                  <p className="event-detail">{event.place}</p>
                  {event.description && <p className="event-description">{event.description}</p>}
                  <div className="place-actions">
                    <a
                      className="place-link"
                      href={mapSearchUrl(event.eventAddress || `${event.place}, Abilene TX`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get Directions
                    </a>
                    {event.websiteUrl && (
                      <a className="place-link" href={event.websiteUrl} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    )}
                    {event.ticketUrl && (
                      <a className="place-link" href={event.ticketUrl} target="_blank" rel="noreferrer">
                        Tickets
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  if (page === "calendar") {
    return withSplash(
      <main className="app calendar-page">
        <div className="calendar-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="calendar-header" aria-labelledby="calendar-title">
            <p className="eyebrow">Plan the week</p>
            <h1 id="calendar-title">Calendar</h1>
          </section>

          <section className="calendar-list" aria-label="Abilene Vibes calendar">
            {calendarDays.length === 0 && (
              <p className="events-intro">Upcoming local highlights will appear here soon.</p>
            )}
            {calendarDays.map((item) => (
              <article className="calendar-card" key={`${item.date}-${item.title}`}>
                <div className="calendar-date">
                  <span>{item.day}</span>
                  <strong>{item.date}</strong>
                </div>

                <div className="calendar-copy">
                  <h2>{item.title}</h2>
                  <p>{item.place}</p>
                  <p>{item.time}</p>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  if (page === "gallery") {
    return withSplash(
      <main className="app gallery-page">
        <div className="gallery-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="gallery-header" aria-labelledby="gallery-title">
            <p className="eyebrow">City snapshots</p>
            <h1 id="gallery-title">Gallery</h1>
            <p className="events-intro">Curated photos selected by Abilene Vibes, with community submissions reviewed before publishing.</p>
          </section>

          <section className="gallery-submit" aria-labelledby="gallery-submit-title">
            <div className="business-form-heading">
              <p className="eyebrow">Share a photo</p>
              <h2 id="gallery-submit-title">Submit to the gallery</h2>
            </div>

            <form className="gallery-form" onSubmit={handleGallerySubmit}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Your name</span>
                  <input
                    name="contributorName"
                    type="text"
                    placeholder="Name or business"
                    required
                    onInvalid={handleRequiredInvalid}
                    onInput={handleRequiredInput}
                  />
                </label>

                <label className="form-field">
                  <span>Photo title</span>
                  <input
                    name="title"
                    type="text"
                    placeholder="Downtown night, family day, etc."
                    required
                    onInvalid={handleRequiredInvalid}
                    onInput={handleRequiredInput}
                  />
                </label>

                <label className="form-field form-field-wide">
                  <span>Photo</span>
                  <input
                    name="photo"
                    type="file"
                    accept="image/*"
                    required
                    onInvalid={handleRequiredInvalid}
                    onInput={handleRequiredInput}
                  />
                </label>
              </div>

              <label className="legal-consent">
                <input
                  name="contentRights"
                  type="checkbox"
                  required
                  onInvalid={handleRequiredInvalid}
                  onInput={handleRequiredInput}
                />
                <span>
                  I confirm I have permission to submit this photo and authorize Abilene Vibes to review and publish it.
                </span>
              </label>

              <button className="primary-button subscribe-button" type="submit" disabled={gallerySubmissionStatus === "saving"}>
                {gallerySubmissionStatus === "saving" ? "Sending..." : "Submit Photo"}
              </button>

              {gallerySubmissionStatus && gallerySubmissionStatus !== "saving" && (
                <p className={gallerySubmissionStatus === "saved" ? "form-success" : "form-error"}>
                  {gallerySubmissionStatus === "saved"
                    ? "Thanks. Your photo was sent for approval."
                    : gallerySubmissionStatus === "missing-config"
                      ? "Connect Supabase to receive gallery submissions for approval."
                      : gallerySubmissionStatus === "file-error"
                        ? "Please upload an image under 15 MB."
                        : "Sorry, the photo could not be submitted. Please try again."}
                  {gallerySubmissionError && (
                    <>
                      <br />
                      {gallerySubmissionError}
                    </>
                  )}
                </p>
              )}
            </form>
          </section>

          <section className="gallery-grid" aria-label="Abilene Vibes gallery">
            {galleryPhotos.map((shot, index) => {
              const photoKey = shot.id ?? `static-${index}-${shot.title}`;

              return (
                <figure className="gallery-card" key={`${shot.title}-${index}`}>
                  <button
                    className="image-open-button gallery-image-button"
                    type="button"
                    onClick={() => openImageViewer(shot.image, shot.title)}
                    aria-label={`Open ${shot.title} photo`}
                  >
                    <img src={shot.image} alt="" loading="lazy" />
                  </button>
                  <figcaption className="gallery-card-body">
                    <span>{shot.title}</span>
                    <div className="gallery-card-actions">
                      {renderLikeButton("photo", photoKey)}
                      {isGalleryPhotoOwner(shot) && (
                        <button
                          className="directory-link danger-link"
                          type="button"
                          onClick={() => handleOwnerGalleryDelete(shot)}
                          disabled={galleryOwnerDeleteStatus === `${shot.id}:deleting`}
                        >
                          {galleryOwnerDeleteStatus === `${shot.id}:deleting` ? "Deleting..." : "Delete Photo"}
                        </button>
                      )}
                    </div>
                  </figcaption>
                  {galleryOwnerDeleteStatus === `${shot.id}:error` && (
                    <p className="form-error">Could not delete this photo.</p>
                  )}
                </figure>
              );
            })}
          </section>
        </div>
      </main>,
    );
  }

  if (page === "promote") {
    return withSplash(
      <main className="app promote-page">
        <div className="promote-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="promote-header" aria-labelledby="promote-title">
            <p className="eyebrow">Local spotlight</p>
            <h1 id="promote-title">Promote your business</h1>
            <p className="events-intro">
              Choose the category that fits your business and get in front of the Abilene crowd.
            </p>
          </section>

          <section className="promote-grid" aria-label="Business promotion categories">
            {promoteCategories.map((category) => (
              <button
                className={`promote-card${selectedCategory === category.label ? " is-selected" : ""}`}
                key={category.label}
                type="button"
                onClick={() => {
                  setSelectedCategory(category.label);
                  setBusinessSubmitted(false);
                  setSubmissionStatus("");
                }}
                aria-pressed={selectedCategory === category.label}
              >
                <PromoteCategoryIcon icon={category.icon} />
                <span>{category.label}</span>
              </button>
            ))}
          </section>

          <section className="plan-grid" aria-label="Business promotion plans">
            {promotePlans.map((plan) => (
              <button
                className={`plan-card${selectedPlan === plan.name ? " is-selected" : ""}`}
                key={plan.name}
                type="button"
                onClick={() => {
                  setSelectedPlan(plan.name);
                  setBusinessSubmitted(false);
                  setSubmissionStatus("");
                }}
                aria-pressed={selectedPlan === plan.name}
              >
                <span className="plan-name">{plan.name}</span>
                <strong>{plan.price}</strong>
                <span className="plan-cadence">{plan.cadence}</span>
                <span className="plan-note">{plan.note}</span>
              </button>
            ))}
          </section>

          <form className="business-form" onSubmit={handleBusinessSubmit} noValidate>
            <div className="business-form-heading">
              <p className="eyebrow">{selectedPlan} plan</p>
              <h2>{selectedCategory}</h2>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Business name</span>
                <input
                  name="businessName"
                  type="text"
                  placeholder="Your business name"
                  required
                  onInvalid={handleRequiredInvalid}
                  onInput={handleRequiredInput}
                />
              </label>

              <label className="form-field">
                <span>Contact name</span>
                <input
                  name="contactName"
                  type="text"
                  placeholder="Who should we contact?"
                  required
                  onInvalid={handleRequiredInvalid}
                  onInput={handleRequiredInput}
                />
              </label>

              <label className="form-field">
                <span>Phone</span>
                <input
                  name="phone"
                  type="tel"
                  placeholder="(325) 555-0100"
                  required
                  onInvalid={handleRequiredInvalid}
                  onInput={handleRequiredInput}
                />
              </label>

              <label className="form-field">
                <span>Email for receipt</span>
                <input
                  name="contactEmail"
                  type="email"
                  placeholder="owner@example.com"
                  required
                  onInvalid={handleRequiredInvalid}
                  onInput={handleRequiredInput}
                />
              </label>

              <label className="form-field">
                <span>Address</span>
                <input name="address" type="text" placeholder="Street address or area" />
              </label>

              <label className="form-field">
                <span>Instagram or website</span>
                <input name="social" type="text" placeholder="@business or website" />
              </label>
            </div>

            <label className="form-field form-field-wide">
              <span>Business photo</span>
              <input name="businessImage" type="file" accept="image/*" />
            </label>

            <label className="form-field form-field-wide">
              <span>Short description</span>
              <textarea name="description" placeholder="Tell people what makes your spot worth visiting." rows="4" />
            </label>

            <label className="legal-consent">
              <input
                name="contentRights"
                type="checkbox"
                required
                onInvalid={handleRequiredInvalid}
                onInput={handleRequiredInput}
              />
              <span>
                I confirm I have permission to submit this business information and any content I provide, and I
                authorize Abilene Vibes to display it in the app, website, social media, and promotional materials.
              </span>
            </label>

            <p className="legal-disclaimer">
              Business names, logos, and trademarks belong to their respective owners. Abilene Vibes is an independent
              local guide unless a listing is clearly marked as a sponsor or partner. Contact {contactEmail} for
              updates or removals.
            </p>

            {paidPlanNames.has(selectedPlan) && (
              <p className="legal-disclaimer billing-disclaimer">
                {selectedPlan} is a monthly subscription. By continuing to checkout, you authorize Abilene Vibes and
                Stripe to charge {selectedPlan === "Featured" ? "$19" : "$59"} today and automatically every month
                until the subscription is canceled. Payment starts the review process; the paid placement goes live
                after admin approval. Cancellation stops future renewals, and current-period payments are not
                automatically refunded. Contact {contactEmail} for billing or cancellation help.
              </p>
            )}

            {businessSubmitted && (
              <p className="form-success">
                {submissionStatus === "saved"
                  ? paidPlanNames.has(selectedPlan)
                    ? "Thanks. Your request was saved. Opening secure checkout..."
                    : "Thanks. Your request was saved for review."
                  : submissionStatus === "local"
                    ? "Thanks. Your request was added locally. Connect Supabase to save it permanently."
                    : submissionStatus === "validation-error"
                      ? "Please complete business name, contact name, email, phone, and the permission checkbox."
                    : submissionStatus === "checkout"
                      ? "Opening secure checkout..."
                      : submissionStatus === "checkout-link"
                        ? "Thanks. Your payment page opened in a new tab. We will review your listing after payment."
                        : submissionStatus === "checkout-config"
                          ? "Your request was saved, but Stripe needs APP_PUBLIC_URL before checkout can open."
                          : submissionStatus === "checkout-error"
                            ? "Your request was saved, but checkout could not open. Please contact us to finish payment."
                    : selectedPlan === "Free"
                  ? "Thanks. Your business is now visible in the local directory."
                    : "Thanks. Your paid plan request was saved. Secure checkout will open for payment."}
              </p>
            )}

            {submissionStatus === "error" && (
              <p className="form-error">
                We could not save your request. Please try again or email {contactEmail}.
              </p>
            )}

            <button className="primary-button subscribe-button" type="submit" disabled={submissionStatus === "saving"}>
              {submissionStatus === "saving"
                ? "Saving..."
                : selectedPlan === "Free"
                  ? "List My Business Free"
                  : `Continue to ${selectedPlan} Checkout`}
            </button>

            <div className="legal-links" aria-label="Legal links">
              <button
                type="button"
                onClick={() => {
                  legalReturnRef.current = "promote";
                  navigateTo("terms");
                }}
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => {
                  legalReturnRef.current = "promote";
                  navigateTo("privacy");
                }}
              >
                Privacy
              </button>
            </div>
          </form>
        </div>
      </main>,
    );
  }

  if (page === "marketplace") {
    return withSplash(
      <main className="app marketplace-page" style={{ "--marketplace-bg": `url("${appAsset("marketplace-neon-bg.png")}")` }}>
        <div className="marketplace-fixed-bg" aria-hidden="true" />
        <div className="marketplace-shell">
          <button className="back-button" onClick={() => navigateTo("more")}>
            Back to services
          </button>
          <section className="marketplace-hero" aria-labelledby="marketplace-title">
            <p className="eyebrow">Buy &amp; sell local</p>
            <h1 id="marketplace-title">Marketplace</h1>
            <div className="marketplace-search">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                value={marketplaceSearch}
                onChange={(e) => setMarketplaceSearch(e.target.value)}
                placeholder="Search Marketplace"
                aria-label="Search Marketplace"
              />
            </div>
            <button
              className="marketplace-top-sell-button"
              type="button"
              onClick={() => {
                setSellItemStatus("");
                navigateTo("sell-item");
              }}
            >
              <span aria-hidden="true">●</span>
              Sell Item
            </button>
            <div className="marketplace-filter-row marketplace-action-row" aria-label="Marketplace quick actions">
              {["Featured", "New Today", "Deal", "Near Me"].map((f) => (
                <button
                  key={f}
                  className={marketplaceFilter === f ? "is-active" : ""}
                  type="button"
                  onClick={() => setMarketplaceFilter(marketplaceFilter === f ? "All" : f)}
                >
                  {f === "Featured" && "🔥 "}
                  {f === "New Today" && "🆕 "}
                  {f === "Deal" && "💰 "}
                  {f === "Near Me" && "📍 "}
                  {f} ({marketplaceCategoryCounts[f] ?? 0})
                </button>
              ))}
            </div>
          </section>
          <section className="marketplace-section" aria-labelledby="marketplace-category-title">
            <div className="marketplace-section-heading">
              <h2 id="marketplace-category-title">Categories</h2>
              <div className="marketplace-category-actions">
                <button
                  className="marketplace-category-sell-button"
                  type="button"
                  onClick={() => {
                    setSellItemStatus("");
                    navigateTo("sell-item");
                  }}
                >
                  <span aria-hidden="true">+</span>
                  Sell Item
                </button>
                <button type="button" onClick={() => setMarketplaceFilter("All")}>All</button>
              </div>
            </div>
            <div className="marketplace-category-grid">
              {marketplaceCategories.map((cat) => (
                <button
                  key={cat.label}
                  className={marketplaceFilter === cat.label ? "is-active" : ""}
                  type="button"
                  onClick={() => setMarketplaceFilter(cat.label)}
                >
                  <span aria-hidden="true">{cat.icon}</span>
                  {cat.label} ({marketplaceCategoryCounts[cat.label] ?? 0})
                </button>
              ))}
            </div>
          </section>
          <section className="marketplace-section" aria-labelledby="marketplace-listing-title">
            <div className="marketplace-section-heading">
              <h2 id="marketplace-listing-title">New Today ({marketplaceCategoryCounts["New Today"] ?? 0})</h2>
              <span>{filteredMarketplaceListings.length} shown</span>
            </div>
            <div className="marketplace-listing-grid">
              {filteredMarketplaceListings.map((l) => (
                <article key={marketplaceListingKey(l)} className="marketplace-card">
                  <button className="marketplace-card-open" type="button" onClick={() => openListing(l)}>
                    <div className="marketplace-photo marketplace-feed-photo">
                      {l.image ? <img className="marketplace-feed-image" src={l.image} alt="" /> : <span>{l.icon}</span>}
                      <span className="event-type marketplace-card-tag">
                        {l.tag === "New Today" && "New"}
                        {l.tag === "Featured" && "Featured"}
                        {l.tag === "Deal" && "Deal"}
                        {l.tag === "Near Me" && "Near Me"}
                      </span>
                    </div>
                    <div className="marketplace-card-copy">
                      <span className="event-type marketplace-tag">
                        {l.tag === "New Today" && "🆕 New"}
                        {l.tag === "Featured" && "🔥 Featured"}
                        {l.tag === "Deal" && "💰 Deal"}
                        {l.tag === "Near Me" && "📍 Near Me"}
                      </span>
                      <h3>{l.title} <strong>{l.price}</strong></h3>
                      {l.description && <p className="marketplace-description">{l.description}</p>}
                      <p className="marketplace-meta">
                        <span>{l.location}</span>
                        <span>{l.posted}</span>
                      </p>
                      {l.contact && <p className="marketplace-contact">Phone: {l.contact}</p>}
                    </div>
                  </button>
                  {(() => {
                    const mKey = marketplaceListingKey(l);
                    const isSavedM = savedMarketListings.includes(mKey);
                    return (
                      <button
                        className={`marketplace-like-button${isSavedM ? " is-liked" : ""}`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSavedMarketListings((prev) => isSavedM ? prev.filter((k) => k !== mKey) : [...prev, mKey]); }}
                        aria-label={isSavedM ? `Unsave ${l.title}` : `Save ${l.title}`}
                      >
                        {isSavedM ? "♥" : "♡"}
                      </button>
                    );
                  })()}
                  {isListingOwner(l) ? (
                    <div className="marketplace-owner-actions">
                      {[
                        ["Edit", "directory-link marketplace-owner-edit", openOwnerEditListing],
                        ["Mark as Sold", "directory-link", handleMarkSold],
                        ["Delete", "directory-link danger-link", handleDeleteListing],
                      ].map(([label, className, handler]) => (
                        <button
                          key={`${marketplaceListingKey(l)}-${label}`}
                          className={className}
                          type="button"
                          onClick={(e) => handler(e, l)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    l.contact && (
                      <a className="directory-link marketplace-contact-seller" href={marketplaceContactHref(l.contact)}>
                        Contact Seller
                      </a>
                    )
                  )}
                </article>
              ))}
            </div>
          </section>
          <section className="marketplace-section my-marketplace-section" aria-labelledby="my-marketplace-title" style={{ borderTop: "2px solid #ff00cc55", paddingTop: 18, marginTop: 24 }}>
            <div className="marketplace-section-heading" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <h2 id="my-marketplace-title" style={{ display: "flex", alignItems: "center", gap: 10, color: "#ff00cc", textShadow: "0 0 16px #ff00cc99" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 34, height: 34, borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 35%, #00eaffcc, #0077ffaa)",
                    boxShadow: "0 0 10px #00d4ff99, 0 0 22px #00d4ff44, inset 0 1px 2px #ffffff44",
                    border: "1.5px solid #00d4ffbb", flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="8" r="4" fill="#ffffff" opacity="0.95"/>
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
                    </svg>
                  </span>
                  My Listings
                </h2>
                <span>{myFilteredListings.length} shown</span>
              </div>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#00d4ff", letterSpacing: "0.04em", textShadow: "0 0 8px #00d4ff66" }}>Your posted items</p>
            </div>
            <div className="marketplace-filter-row my-marketplace-tabs" aria-label="My listing status filters">
              {["Active", "Sold", "Expired", "Hidden / Deleted"].map((tab) => (
                <button
                  key={tab}
                  className={myListingTab === tab ? "is-active" : ""}
                  type="button"
                  onClick={() => setMyListingTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            {myMarketplaceListings.length ? (
              <div className="admin-grid my-marketplace-grid">
                {myFilteredListings.map((l) => (
                  <article key={`mine-${marketplaceListingKey(l)}`} className="admin-card my-marketplace-card">
                    {l.image && <img src={l.image} alt="" />}
                    <span className={`event-type marketplace-admin-status marketplace-status-${l.status}`}>
                      {l.status.toUpperCase()}
                    </span>
                    <h3>{l.title}</h3>
                    <p>{l.price} · {l.category}</p>
                    <p>{l.location}</p>
                    {l.expiresAt && <p>Expires: {formatMarketplaceExpiry(l.expiresAt)}</p>}
                    <div className="directory-actions">
                      {l.status !== "deleted" && (
                        <button className="directory-link" type="button" onClick={(e) => openOwnerEditListing(e, l)}>
                          Edit
                        </button>
                      )}
                      {l.status === "active" && (
                        <button className="directory-link" type="button" onClick={(e) => handleMarkSold(e, l)}>
                          Mark as Sold
                        </button>
                      )}
                      {l.status !== "deleted" && (
                        <button className="directory-link danger-link" type="button" onClick={(e) => handleDeleteListing(e, l)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <section className="checkout-result-card service-empty-card">
                <p className="eyebrow">Owner tools</p>
                <h2>No listings from this device yet.</h2>
                <p>Items you post will appear here so you can mark them as sold or delete them.</p>
              </section>
            )}
          </section>
          {editingListing && (
            <div className="admin-modal-backdrop" role="presentation">
              <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="marketplace-owner-edit-title">
                <div className="admin-modal-heading">
                  <p className="eyebrow">Marketplace</p>
                  <h2 id="marketplace-owner-edit-title">Edit Listing</h2>
                </div>
                <form className="gallery-form" onSubmit={handleEditListingSubmit}>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Title</span>
                      <input name="title" type="text" defaultValue={editingListing.title} required />
                    </label>
                    <label className="form-field">
                      <span>Price</span>
                      <input name="price" type="text" defaultValue={editingListing.price} required />
                    </label>
                    <label className="form-field">
                      <span>Category</span>
                      <select name="category" defaultValue={editingListing.category} required>
                        {marketplaceCategories.map((cat) => (
                          <option key={cat.label} value={cat.label}>{cat.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Location</span>
                      <input name="location" type="text" defaultValue={editingListing.location} required />
                    </label>
                    <label className="form-field">
                      <span>Contact</span>
                      <input name="contact" type="text" defaultValue={editingListing.contact} required />
                    </label>
                    {/* Current photos with delete buttons */}
                    {editListingPhotos.length > 0 && (
                      <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                        <span>Current photos</span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                          {editListingPhotos.map((src, i) => (
                            <div key={i} style={{ position: "relative" }}>
                              <img
                                src={src}
                                alt=""
                                style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, border: "2px solid #ff00cc61" }}
                              />
                              <button
                                type="button"
                                aria-label="Remove photo"
                                style={{
                                  position: "absolute", top: -6, right: -6,
                                  width: 20, height: 20, borderRadius: "50%",
                                  background: "#ff00cc", color: "#fff", border: "none",
                                  fontSize: 11, cursor: "pointer", lineHeight: 1,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                                onClick={() => setEditListingPhotos((prev) => prev.filter((_, j) => j !== i))}
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Add new photos (up to 5 total) */}
                    {editListingPhotos.length < 5 && (
                      <label className="form-field" style={{ gridColumn: "1 / -1" }}>
                        <span>Add photos ({5 - editListingPhotos.length} remaining)</span>
                        <input name="newPhotos" type="file" accept="image/*" multiple />
                      </label>
                    )}
                  </div>
                  <label className="form-field">
                    <span>Description</span>
                    <textarea name="description" rows="4" defaultValue={editingListing.description} required />
                  </label>
                  <div className="admin-modal-actions">
                    <button className="primary-button admin-modal-primary" type="submit" disabled={editDeleteStatus === "saving"}>
                      {editDeleteStatus === "saving" ? "Saving..." : "Save Changes"}
                    </button>
                    <button className="directory-link" type="button" onClick={() => setEditingListing(null)}>
                      Go Back
                    </button>
                  </div>
                  {editDeleteStatus === "error" && <p className="form-error">Could not save listing.</p>}
                </form>
              </section>
            </div>
          )}
          {deletingListing && (
            <div className="admin-modal-backdrop" role="presentation">
              <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="marketplace-owner-delete-title">
                <div className="admin-modal-heading">
                  <p className="eyebrow">Marketplace</p>
                  <h2 id="marketplace-owner-delete-title">Delete Listing?</h2>
                </div>
                <p>Are you sure you want to delete this listing? It will no longer appear in Marketplace.</p>
                <p>{deletingListing.title}</p>
                <div className="admin-modal-actions">
                  <button
                    className="directory-link danger-link"
                    type="button"
                    onClick={confirmDeleteListing}
                    disabled={editDeleteStatus === "saving"}
                  >
                    {editDeleteStatus === "saving" ? "Deleting..." : "Delete Listing"}
                  </button>
                  <button className="directory-link" type="button" onClick={() => setDeletingListing(null)}>
                    Go Back
                  </button>
                </div>
                {editDeleteStatus === "error" && <p className="form-error">Could not delete listing.</p>}
              </section>
            </div>
          )}
        </div>
      </main>,
    );
  }

  if (page === "marketplace-item") {
    const listing = selectedListing;
    return withSplash(
      listing ? (
        <main className="app marketplace-page" style={{ "--marketplace-bg": `url("${appAsset("marketplace-neon-bg.png")}")` }}>
          <div className="marketplace-fixed-bg" aria-hidden="true" />
          <div className="marketplace-shell">
            <button className="back-button" onClick={() => { inListingDetailRef.current = false; navigateTo("marketplace"); }}>
              Back to Marketplace
            </button>
            <article className="marketplace-detail-card">
              {/* ── Photo gallery ── */}
              {(() => {
                const imgs = listing.images?.length ? listing.images : (listing.image ? [listing.image] : []);
                const idx = Math.min(listingGalleryIndex, imgs.length - 1);
                if (imgs.length === 0) {
                  return (
                    <div className="marketplace-detail-photo">
                      <span aria-hidden="true">{listing.icon}</span>
                    </div>
                  );
                }
                return (
                  <div style={{ position: "relative", width: "100%" }}>
                    <div
                      style={{ overflow: "hidden", borderRadius: 20, width: "100%" }}
                      onTouchStart={(ev) => { gallerySwipeTouchRef.current = ev.touches[0].clientX; }}
                      onTouchEnd={(ev) => {
                        if (gallerySwipeTouchRef.current === null) return;
                        const dx = ev.changedTouches[0].clientX - gallerySwipeTouchRef.current;
                        gallerySwipeTouchRef.current = null;
                        if (Math.abs(dx) < 40) return;
                        if (dx < 0 && idx < imgs.length - 1) setListingGalleryIndex(idx + 1);
                        if (dx > 0 && idx > 0) setListingGalleryIndex(idx - 1);
                      }}
                    >
                      <button
                        className="marketplace-detail-photo"
                        type="button"
                        onClick={() => setImageViewerPhoto({ src: imgs[idx], title: listing.title })}
                        aria-label={`Open ${listing.title} photo ${idx + 1}`}
                        style={{ width: "100%" }}
                      >
                        <img src={imgs[idx]} alt="" style={{ objectFit: "contain", background: "#ffffff08" }} />
                      </button>
                    </div>
                    {/* Dot indicators */}
                    {imgs.length > 1 && (
                      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
                        {imgs.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={`Photo ${i + 1}`}
                            onClick={() => setListingGalleryIndex(i)}
                            style={{
                              width: 8, height: 8, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                              background: i === idx ? "#ff00cc" : "#ffffff55",
                              boxShadow: i === idx ? "0 0 6px #ff00cc" : "none",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="marketplace-detail-copy">
                <span className="event-type marketplace-tag">
                  {listing.tag === "New Today" && "🆕 New"}
                  {listing.tag === "Featured" && "🔥 Featured"}
                  {listing.tag === "Deal" && "💰 Deal"}
                  {listing.tag === "Near Me" && "📍 Near Me"}
                </span>
                <h1>{listing.title} <strong>{listing.price}</strong></h1>
                {listing.description && <p className="marketplace-detail-description">{listing.description}</p>}
                {listing.location && <p>{listing.location}</p>}
                <button
                  type="button"
                  onClick={() => {
                    const query = listing.location || (listing.title + ", Abilene TX");
                    window.open(mapSearchUrl(query), "_system");
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#00d4ff22", border: "2px solid #00d4ff",
                    borderRadius: 10, color: "#31f1ff", fontWeight: 700,
                    fontSize: "1rem", padding: "12px 16px", cursor: "pointer",
                    width: "100%", textAlign: "left", marginTop: 8,
                  }}
                >
                  📍 Get Directions
                </button>
                {(() => {
                  const mKey = marketplaceListingKey(listing);
                  const isSavedM = savedMarketListings.includes(mKey);
                  return (
                    <button
                      type="button"
                      onClick={() => setSavedMarketListings((prev) => isSavedM ? prev.filter((k) => k !== mKey) : [...prev, mKey])}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: isSavedM ? "#ff00cc22" : "#ffffff11",
                        border: `2px solid ${isSavedM ? "#ff00cc" : "#ffffff44"}`,
                        borderRadius: 10, color: isSavedM ? "#ff00cc" : "#ffffff99",
                        fontWeight: 700, fontSize: "1rem", padding: "12px 16px",
                        cursor: "pointer", width: "100%", textAlign: "left", marginTop: 8,
                      }}
                    >
                      {isSavedM ? "♥ Saved" : "♡ Save"}
                    </button>
                  );
                })()}
                <p>{listing.posted}</p>
                {listing.contact && <p>Contact: {listing.contact}</p>}
                {listing.image && (
                  <p className="marketplace-zoom-note">
                    Tap the photo to zoom{(listing.images?.length ?? 1) > 1 ? " · Swipe to see more" : ""}.
                  </p>
                )}
              </div>
            </article>
          </div>
        </main>
      ) : (
        <main className="app marketplace-page" style={{ "--marketplace-bg": `url("${appAsset("marketplace-neon-bg.png")}")` }}>
          <div className="marketplace-fixed-bg" aria-hidden="true" />
          <div className="marketplace-shell">
            <button className="back-button" onClick={() => navigateTo("marketplace")}>
              Back to Marketplace
            </button>
            <section className="checkout-result-card">
              <p className="eyebrow">Marketplace</p>
              <h1>Open a listing again</h1>
              <p>Select an item from Marketplace to view its full details.</p>
            </section>
          </div>
        </main>
      ),
    );
  }

  if (page === "sell-item") {
    return withSplash(
      <main className="app marketplace-page" style={{ "--marketplace-bg": `url("${appAsset("marketplace-neon-bg.png")}")` }}>
        <div className="marketplace-fixed-bg" aria-hidden="true" />
        <div className="marketplace-shell">
          <button className="back-button" onClick={() => navigateTo("marketplace")}>
            Back to Marketplace
          </button>
          <section className="marketplace-hero sell-item-hero" aria-labelledby="sell-item-title">
            <p className="eyebrow">Marketplace</p>
            <h1 id="sell-item-title">Sell Item</h1>
            <p className="events-intro">Post something for Abilene buyers to discover.</p>
          </section>
          <form className="business-form sell-item-form" onSubmit={handleSellItemSubmit}>
            <div className="form-grid">
              <label className="form-field">
                <span>Item title</span>
                <input name="title" type="text" placeholder='Samsung TV 65"' required />
              </label>
              <label className="form-field">
                <span>Price</span>
                <input name="price" type="text" placeholder="$350" required />
              </label>
              <label className="form-field">
                <span>Category</span>
                <select name="category" required defaultValue="">
                  <option value="" disabled>Choose category</option>
                  {marketplaceCategories.map((cat) => (
                    <option key={cat.label} value={cat.label}>{cat.label}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Location</span>
                <input name="location" type="text" placeholder="Abilene, TX" required />
              </label>
              <label className="form-field">
                <span>Contact</span>
                <input name="contact" type="text" placeholder="Phone, email, or social" required />
              </label>
              <label className="form-field" style={{ gridColumn: "1 / -1" }}>
                <span>Photos ({sellItemPhotos.length}/5 added{sellItemPhotos.length >= 5 ? " — limit reached" : ""})</span>
                <input
                  name="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={sellItemPhotos.length >= 5}
                  onChange={async (ev) => {
                    const files = Array.from(ev.target.files ?? []);
                    ev.target.value = ""; // reset so same files can be re-selected
                    const remaining = 5 - sellItemPhotos.length;
                    if (remaining <= 0 || files.length === 0) return;
                    if (files.length > remaining) {
                      setSellItemStatus("photo-limit");
                    }
                    const toAdd = files.slice(0, remaining);
                    // Compress immediately so preview = final stored data; lets user remove before submit.
                    const compressed = await Promise.all(toAdd.map((f) => optimizeGalleryImage(f)));
                    setSellItemPhotos((prev) => [...prev, ...compressed]);
                  }}
                />
              </label>
              {sellItemPhotos.length > 0 && (
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {sellItemPhotos.map((dataUrl, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img
                        src={dataUrl}
                        alt=""
                        style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, border: "2px solid #ff00cc61" }}
                      />
                      <button
                        type="button"
                        aria-label="Remove photo"
                        style={{
                          position: "absolute", top: -6, right: -6,
                          width: 20, height: 20, borderRadius: "50%",
                          background: "#ff00cc", color: "#fff", border: "none",
                          fontSize: 12, cursor: "pointer", lineHeight: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        onClick={() => setSellItemPhotos((prev) => prev.filter((_, j) => j !== i))}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label className="form-field">
              <span>Description</span>
              <textarea name="description" placeholder="Condition, details, pickup notes" rows="4" required />
            </label>
            <label className="form-field">
              <span>Listing duration</span>
              <select
                value={sellDuration}
                onChange={(e) => setSellDuration(e.target.value)}
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
              </select>
            </label>
            <button className="marketplace-sell-button sell-item-submit" type="submit">
              <span aria-hidden="true">●</span>
              {sellItemStatus === "saving" ? "Posting..." : "Post Item"}
            </button>
            {sellItemStatus === "saved" && (
              <p className="form-success compact-status">Item submitted for approval.</p>
            )}
            {sellItemStatus === "moderation-review" && (
              <p className="form-success compact-status">Your listing was submitted for review and will appear after approval.</p>
            )}
            {sellItemStatus === "moderation-rejected" && (
              <p className="form-error compact-status">This listing could not be published because it appears to violate Marketplace rules.</p>
            )}
            {sellItemStatus === "restricted-rejected" && (
              <p className="form-error compact-status">This item or service is not allowed on Abilene Vibes Marketplace.</p>
            )}
            {sellItemStatus === "missing-config" && (
              <p className="form-error compact-status">Marketplace publishing is not connected yet.</p>
            )}
            {sellItemStatus === "file-error" && (
              <p className="form-error compact-status">Please upload a valid image under 15 MB.</p>
            )}
            {sellItemStatus === "photo-limit" && (
              <p className="form-error compact-status">Maximum 5 photos allowed. Only the first ones were added.</p>
            )}
            {sellItemStatus === "limit-active" && (
              <p className="form-error compact-status">You have reached the limit of 10 active listings. Mark some as Sold or delete them to post new ones.</p>
            )}
            {sellItemStatus === "limit-daily" && (
              <p className="form-error compact-status">You can only post 2 listings per day. Come back tomorrow to post more.</p>
            )}
            {sellItemStatus === "error" && (
              <p className="form-error compact-status">Sorry, the item could not be posted. Please try again.</p>
            )}
          </form>
        </div>
      </main>,
    );
  }

  if (page === "job-detail" && selectedJob) {
    const j = selectedJob;
    const phoneHref = j.contact ? `tel:${j.contact.replace(/\D/g, "")}` : null;
    const emailHref = j.email ? `mailto:${j.email}` : null;
    const postedDate = j.created_at ? new Date(j.created_at).toLocaleDateString() : "";
    const expiresDate = j.expires_at ? new Date(j.expires_at).toLocaleDateString() : "";
    return withSplash(
      <main className="app jobs-page job-detail-page">
        <div className="jobs-neon-bg" aria-hidden="true" />
        <div className="marketplace-shell jobs-shell job-detail-shell">
          <button
            className="back-button"
            onClick={() => { setSelectedJob(null); navigateTo("jobs"); }}
          >
            Back to Jobs
          </button>

          <div className="job-detail-hero-img">
            {j.image
              ? <img src={j.image} alt="" loading="lazy" />
              : <div className="post-job-image-placeholder"><span aria-hidden="true">💼</span></div>
            }
          </div>

          <section className="job-detail-header" aria-labelledby="job-detail-title">
            <p className="eyebrow">{j.category}</p>
            <h1 id="job-detail-title">{j.title}</h1>
            <p className="job-detail-company">{j.company}</p>
            <dl className="job-detail-meta">
              <div className="job-detail-meta-item">
                <dt>💵</dt><dd>{j.pay}</dd>
              </div>
              <div className="job-detail-meta-item">
                <dt>📍</dt><dd>{j.location}</dd>
              </div>
              <div className="job-detail-meta-item">
                <dt>💼</dt><dd>{j.type}</dd>
              </div>
              {j.schedule && (
                <div className="job-detail-meta-item">
                  <dt>🗓</dt><dd>{j.schedule}</dd>
                </div>
              )}
              <div className="job-detail-meta-item">
                <dt>
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 10h18" />
                  </svg>
                </dt><dd>{postedDate ? `Posted ${postedDate}` : j.posted}{expiresDate ? ` · Expires ${expiresDate}` : ""}</dd>
              </div>
            </dl>
          </section>

          <section className="job-detail-section" aria-labelledby="jd-desc">
            <h2 id="jd-desc" className="job-detail-section-title">About the Role</h2>
            <p className="job-detail-body">{j.description}</p>
          </section>

          {j.requirements && (
            <section className="job-detail-section" aria-labelledby="jd-req">
              <h2 id="jd-req" className="job-detail-section-title">Requirements</h2>
              <p className="job-detail-body">{j.requirements}</p>
            </section>
          )}

          <section className="job-detail-section job-detail-contact-section" aria-labelledby="jd-contact">
            <h2 id="jd-contact" className="job-detail-section-title">Contact</h2>
            {j.contactPerson && (
              <p className="job-detail-contact-line">
                Contact: {j.contactPerson}
              </p>
            )}
            {j.contact && (
              <p className="job-detail-contact-line">
                <span aria-hidden="true">📞</span> {j.contact}
              </p>
            )}
            {j.email && (
              <p className="job-detail-contact-line">
                <span aria-hidden="true">✉</span> {j.email}
              </p>
            )}
          </section>

          <div className="job-detail-actions">
            {phoneHref && (
              <a className="jobs-post-button job-detail-call-btn" href={phoneHref}>
                <span aria-hidden="true">📞</span>
                Call Employer
              </a>
            )}
            {emailHref && (
              <a className="directory-link jobs-apply-button job-detail-email-btn" href={emailHref}>
                <span aria-hidden="true">✉</span>
                Email Employer
              </a>
            )}
            {j.applyUrl && (
              <a className="directory-link jobs-apply-button" href={j.applyUrl} target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">🌐</span>
                Apply on Website
              </a>
            )}
            {j.location && (
              <a
                className="directory-link jobs-apply-button job-detail-map-btn"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.location)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span aria-hidden="true">📍</span>
                View Location
              </a>
            )}
          </div>
          <div className="job-detail-save-row">
            {(() => { const isSaved = savedJobs.includes(j.id); return (
              <button
                type="button"
                className={`jobs-detail-save-btn${isSaved ? " is-saved" : ""}`}
                onClick={() => setSavedJobs((prev) => isSaved ? prev.filter((id) => id !== j.id) : [...prev, j.id])}
              >
                {isSaved ? "♥ Saved" : "♡ Save Job"}
              </button>
            ); })()}
          </div>
          {isJobOwner(j) && (
            <div className="rental-owner-actions">
              <button
                className="directory-link"
                type="button"
                onClick={() => { setEditingOwnerJob({ ...j }); setOwnerJobStatus(""); }}
              >
                Edit Job
              </button>
              <button
                className="directory-link danger-link"
                type="button"
                onClick={() => { setDeletingOwnerJob({ ...j }); setOwnerJobStatus(""); }}
              >
                Delete Job
              </button>
            </div>
          )}
          {editingOwnerJob && (
            <div className="admin-modal-backdrop" role="presentation">
              <section className="admin-modal rental-owner-modal" role="dialog" aria-modal="true" aria-labelledby="owner-job-edit-title">
                <div className="admin-modal-heading">
                  <p className="eyebrow">Jobs &amp; Hiring</p>
                  <h2 id="owner-job-edit-title">Edit Job</h2>
                </div>
                <form className="gallery-form" onSubmit={handleOwnerJobEditSubmit}>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Title</span>
                      <input name="title" type="text" defaultValue={editingOwnerJob.title ?? ""} required />
                    </label>
                    <label className="form-field">
                      <span>Company</span>
                      <input name="company" type="text" defaultValue={editingOwnerJob.company ?? ""} required />
                    </label>
                    <label className="form-field">
                      <span>Category</span>
                      <input name="category" type="text" defaultValue={editingOwnerJob.category ?? ""} required />
                    </label>
                    <label className="form-field">
                      <span>Job Type</span>
                      <select name="job_type" defaultValue={editingOwnerJob.type ?? "Full Time"} required>
                        {["Full Time", "Part Time", "Temporary", "Contract"].map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Pay</span>
                      <input name="pay_label" type="text" defaultValue={editingOwnerJob.pay === "Pay not specified" ? "" : (editingOwnerJob.pay ?? "")} />
                    </label>
                    <label className="form-field">
                      <span>Location</span>
                      <input name="location" type="text" defaultValue={editingOwnerJob.location ?? ""} required />
                    </label>
                    <label className="form-field">
                      <span>Contact Person</span>
                      <input name="contact_person" type="text" defaultValue={editingOwnerJob.contactPerson ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Phone</span>
                      <input name="phone" type="tel" defaultValue={editingOwnerJob.contact ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Email</span>
                      <input name="email" type="email" defaultValue={editingOwnerJob.email ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Apply Via</span>
                      <select name="app_method" defaultValue={editingOwnerJob.appMethod ?? "Phone"}>
                        {["Phone", "Email", "Website", "In Person"].map((method) => <option key={method} value={method}>{method}</option>)}
                      </select>
                    </label>
                    <label className="form-field form-field-full">
                      <span>Application Website URL</span>
                      <input name="apply_url" type="url" defaultValue={editingOwnerJob.applyUrl ?? ""} />
                    </label>
                  </div>
                  <label className="form-field">
                    <span>Description</span>
                    <textarea name="description" rows="4" defaultValue={editingOwnerJob.description ?? ""} required />
                  </label>
                  <label className="form-field">
                    <span>Requirements</span>
                    <textarea name="requirements" rows="3" defaultValue={editingOwnerJob.requirements ?? ""} />
                  </label>
                  <div className="admin-modal-actions">
                    <button className="primary-button admin-modal-primary" type="submit" disabled={ownerJobStatus === "saving"}>
                      {ownerJobStatus === "saving" ? "Saving..." : "Save Changes"}
                    </button>
                    <button className="directory-link" type="button" onClick={() => { setEditingOwnerJob(null); setOwnerJobStatus(""); }}>
                      Go Back
                    </button>
                  </div>
                  {ownerJobStatus === "error" && <p className="form-error">Could not save this job.</p>}
                </form>
              </section>
            </div>
          )}
          {deletingOwnerJob && (
            <div className="admin-modal-backdrop" role="presentation">
              <section className="admin-modal rental-owner-modal" role="dialog" aria-modal="true" aria-labelledby="owner-job-delete-title">
                <div className="admin-modal-heading">
                  <p className="eyebrow">Jobs &amp; Hiring</p>
                  <h2 id="owner-job-delete-title">Delete Job?</h2>
                </div>
                <p>This will hide the job from Jobs &amp; Hiring.</p>
                <p>{deletingOwnerJob.title}</p>
                <div className="admin-modal-actions">
                  <button className="directory-link danger-link" type="button" onClick={confirmDeleteOwnerJob} disabled={ownerJobStatus === "saving"}>
                    {ownerJobStatus === "saving" ? "Deleting..." : "Delete Job"}
                  </button>
                  <button className="directory-link" type="button" onClick={() => { setDeletingOwnerJob(null); setOwnerJobStatus(""); }}>
                    Go Back
                  </button>
                </div>
                {ownerJobStatus === "error" && <p className="form-error">Could not delete this job.</p>}
              </section>
            </div>
          )}
        </div>
      </main>,
    );
  }

  if (page === "post-job") {
    const jobTypeOptions = ["Full Time", "Part Time", "Temporary", "Contract"];
    const appMethodOptions = ["Phone", "Email", "Website", "In Person"];
    const durationOptions = ["30 Days", "60 Days", "90 Days"];
    const selectedPostJobPlan = postJobForm.plan || "Free";
    const handlePostJobField = (field, value) =>
      setPostJobForm((prev) => ({ ...prev, [field]: value }));
    const handlePostJobImage = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      setPostJobForm((prev) => ({ ...prev, image: file }));
      try {
        const compressed = await optimizeGalleryImage(file);
        setPostJobImagePreview(compressed);
      } catch {
        const r = new FileReader(); r.onload = (ev) => setPostJobImagePreview(ev.target.result); r.readAsDataURL(file);
      }
    };
    const handlePostJobLogo = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      setPostJobForm((prev) => ({ ...prev, logo: file }));
      try {
        const compressed = await optimizeGalleryImage(file);
        setPostJobLogoPreview(compressed);
      } catch {
        const r = new FileReader(); r.onload = (ev) => setPostJobLogoPreview(ev.target.result); r.readAsDataURL(file);
      }
    };
    const payLabel = [postJobForm.payMin, postJobForm.payMax].filter(Boolean).join(" – ") || "Pay not specified";
    const previewData = {
      title: postJobForm.title || "Job Title",
      company: postJobForm.company || "Company Name",
      pay: payLabel,
      location: postJobForm.location || "Abilene, TX",
      type: postJobForm.jobType || "Full Time",
      description: postJobForm.description || "Job description will appear here.",
    };
    const handlePostFree = async () => {
      setPostJobError(null);
      setPostJobPublishing(true);
      try {
        if (supabase) {
          const durationDays = { "30 Days": 30, "60 Days": 60, "90 Days": 90 }[postJobForm.duration] ?? 30;
          const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

          const { error } = await supabase
            .from("job_listings")
            .insert({
              title: postJobForm.title,
              company: postJobForm.company,
              category: postJobForm.category || "Other",
              job_type: postJobForm.jobType || "Full Time",
              pay_label: payLabel,
              location: postJobForm.location || "Abilene, TX",
              contact_person: postJobForm.contactPerson || null,
              phone: postJobForm.phone,
              email: postJobForm.email,
              description: postJobForm.description,
              requirements: postJobForm.requirements,
              app_method: postJobForm.appMethod || "Phone",
              apply_url: postJobForm.applyUrl || null,
              duration: postJobForm.duration || "30 Days",
              plan: "free",
              status: "pending",
              payment_status: "not_required",
              owner_user_id: effectiveOwnerId,
              placement_source: "free",
              image_data: postJobImagePreview,
              logo_data: postJobLogoPreview,
              expires_at: expiresAt,
            });

          if (error) {
            console.error("[Jobs] Supabase insert error:", error.message);
            setPostJobError("Could not save this job for review. Please try again.");
            return;
          }
        } else {
          // No Supabase configured — local-only fallback
          setPostJobError("Connection unavailable. Check your internet and try again.");
          return;
        }

        setPostJobForm({ title: "", company: "", category: "", jobType: "", payMin: "", payMax: "", location: "Abilene, TX", contactPerson: "", phone: "", email: "", description: "", requirements: "", image: null, logo: null, appMethod: "Phone", duration: "30 Days", applyUrl: "", plan: "Free" });
        setPostJobImagePreview(null); setPostJobLogoPreview(null);
        setPostJobStep("form");
        setPostJobError(null);
        navigateTo("jobs");
      } catch (err) {
        console.error("[Jobs] Unexpected error publishing free job:", err);
        setPostJobError(err?.message || "Error al publicar. Verifica tu conexión e intenta de nuevo.");
      } finally {
        setPostJobPublishing(false);
      }
    };

    const handlePostFeatured = async () => {
      setPostJobError(null);
      setPostJobPublishing(true);
      try {
        const durationDays = { "30 Days": 30, "60 Days": 60, "90 Days": 90 }[postJobForm.duration] ?? 30;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        if (supabase) {
          const returnUrl = window.location.origin.startsWith("https://") ? window.location.origin : "";
          const jobPayload = {
            title: postJobForm.title,
            company: postJobForm.company,
            category: postJobForm.category || "Other",
            job_type: postJobForm.jobType || "Full Time",
            pay_label: payLabel,
            location: postJobForm.location || "Abilene, TX",
            contact_person: postJobForm.contactPerson || null,
            phone: postJobForm.phone,
            email: postJobForm.email,
            description: postJobForm.description,
            requirements: postJobForm.requirements,
            app_method: postJobForm.appMethod || "Phone",
            apply_url: postJobForm.applyUrl || null,
            duration: postJobForm.duration || "30 Days",
            image_data: postJobImagePreview,
            logo_data: postJobLogoPreview,
            expires_at: expiresAt,
            owner_user_id: effectiveOwnerId,
          };
          const checkoutPayload = {
            listingType: "job",
            action: "create_and_checkout",
            plan: "Featured",
            jobPayload,
            businessName: postJobForm.company,
            contactEmail: postJobForm.email,
            returnUrl,
          };
          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout-session", {
            body: checkoutPayload,
          });

          if (checkoutData?.url) {
            openCheckoutUrl(checkoutData.url);
          } else {
            if (checkoutError) {
              console.error("[Jobs] Checkout session failed (featured):", checkoutError);
            }
            setPostJobError("Your job was saved, but checkout could not open. Please contact us to finish payment.");
            return;
          }
        } else {
          setPostJobError("Connection unavailable. Check your internet and try again.");
          return;
        }
        setPostJobForm({ title: "", company: "", category: "", jobType: "", payMin: "", payMax: "", location: "Abilene, TX", contactPerson: "", phone: "", email: "", description: "", requirements: "", image: null, logo: null, appMethod: "Phone", duration: "30 Days", applyUrl: "", plan: "Free" });
        setPostJobImagePreview(null); setPostJobLogoPreview(null);
        setPostJobStep("form");
        setPostJobError(null);
        navigateTo("jobs");
      } catch (err) {
        console.error("[Jobs] Unexpected error publishing featured job:", err);
        setPostJobError(err?.message || "Error al publicar. Verifica tu conexiÃ³n e intenta de nuevo.");
      } finally {
        setPostJobPublishing(false);
      }
    };

    const handlePostPremium = async () => {
      setPostJobError(null);
      setPostJobPublishing(true);
      try {
        const durationDays = { "30 Days": 30, "60 Days": 60, "90 Days": 90 }[postJobForm.duration] ?? 30;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        if (supabase) {
          const returnUrl = window.location.origin.startsWith("https://") ? window.location.origin : "";
          const jobPayload = {
            title: postJobForm.title,
            company: postJobForm.company,
            category: postJobForm.category || "Other",
            job_type: postJobForm.jobType || "Full Time",
            pay_label: payLabel,
            location: postJobForm.location || "Abilene, TX",
            contact_person: postJobForm.contactPerson || null,
            phone: postJobForm.phone,
            email: postJobForm.email,
            description: postJobForm.description,
            requirements: postJobForm.requirements,
            app_method: postJobForm.appMethod || "Phone",
            apply_url: postJobForm.applyUrl || null,
            duration: postJobForm.duration || "30 Days",
            image_data: postJobImagePreview,
            logo_data: postJobLogoPreview,
            expires_at: expiresAt,
            owner_user_id: effectiveOwnerId,
          };
          const checkoutPayload = {
            listingType: "job",
            action: "create_and_checkout",
            plan: "Premium",
            jobPayload,
            businessName: postJobForm.company,
            contactEmail: postJobForm.email,
            returnUrl,
          };
          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout-session", {
            body: checkoutPayload,
          });

          if (checkoutData?.url) {
            openCheckoutUrl(checkoutData.url);
          } else {
            if (checkoutError) {
              console.error("[Jobs] Checkout session failed (premium):", checkoutError);
            }
            setPostJobError("Your job was saved, but checkout could not open. Please contact us to finish payment.");
            return;
          }
        } else {
          setPostJobError("Connection unavailable. Check your internet and try again.");
          return;
        }
        setPostJobForm({ title: "", company: "", category: "", jobType: "", payMin: "", payMax: "", location: "Abilene, TX", contactPerson: "", phone: "", email: "", description: "", requirements: "", image: null, logo: null, appMethod: "Phone", duration: "30 Days", applyUrl: "", plan: "Free" });
        setPostJobImagePreview(null); setPostJobLogoPreview(null);
        setPostJobStep("form");
        setPostJobError(null);
        navigateTo("jobs");
      } catch (err) {
        console.error("[Jobs] Unexpected error publishing premium job:", err);
        setPostJobError(err?.message || "Error al publicar. Verifica tu conexion e intenta de nuevo.");
      } finally {
        setPostJobPublishing(false);
      }
    };

    const handlePostSelectedPlan = () => {
      if (selectedPostJobPlan === "Premium") {
        handlePostPremium();
        return;
      }
      if (selectedPostJobPlan === "Featured") {
        handlePostFeatured();
        return;
      }
      handlePostFree();
    };

    return withSplash(
      <main className="app jobs-page post-job-page" style={{ "--jobs-bg": `url("${appAsset("jobs-bg.png")}")` }}>
        <div className="jobs-neon-bg" aria-hidden="true" />
        <div className="marketplace-shell jobs-shell post-job-shell">
          <button className="back-button" onClick={() => { if (postJobStep === "plan") { setPostJobStep("preview"); } else if (postJobStep === "preview") { setPostJobStep("form"); } else { navigateTo("jobs"); } }}>
            {postJobStep === "plan" ? "← Back to Preview" : postJobStep === "preview" ? "← Back to Form" : "Back to Jobs"}
          </button>

          {/* ── PLAN SELECTION ── */}
          {postJobStep === "plan" && (
            <div className="post-job-plan-wrap">
              <section className="marketplace-hero jobs-hero" aria-labelledby="plan-title">
                <p className="eyebrow">Choose a Plan</p>
                <h1 id="plan-title">How would you like to list?</h1>
                <p className="events-intro">Pick a plan that fits your hiring needs.</p>
              </section>
              <div className="post-job-plans">
                {/* FREE */}
                <div className={`post-job-plan-card post-job-plan-free${selectedPostJobPlan === "Free" ? " is-selected" : ""}`}>
                  <p className="plan-badge plan-badge-free">FREE</p>
                  <p className="plan-price">$0</p>
                  <p className="plan-duration">{postJobForm.duration}</p>
                  <ul className="plan-features">
                    <li>Standard listing in Jobs &amp; Hiring</li>
                    <li>Visible to all job seekers</li>
                    <li className="plan-feature-no">Not featured</li>
                  </ul>
                  <button className="plan-btn plan-btn-free" type="button" onClick={handlePostFree} disabled={postJobPublishing}>
                    {postJobPublishing ? "Publishing…" : "Post Free"}
                  </button>
                  {postJobError && <p className="post-job-error" role="alert">{postJobError}</p>}
                </div>
                {/* FEATURED */}
                <div className={`post-job-plan-card post-job-plan-featured${selectedPostJobPlan === "Featured" ? " is-selected" : ""}`}>
                  <p className="plan-badge plan-badge-featured">FEATURED</p>
                  <p className="plan-price">$19</p>
                  <p className="plan-duration">{postJobForm.duration}</p>
                  <ul className="plan-features">
                    <li>⭐ Featured badge</li>
                    <li>Higher placement in results</li>
                    <li>More visibility to job seekers</li>
                  </ul>
                  <button className="plan-btn plan-btn-featured" type="button" onClick={handlePostFeatured} disabled={postJobPublishing}>
                    {postJobPublishing ? "Publishing…" : "Post Featured"}
                  </button>
                  {postJobError && <p className="post-job-error" role="alert">{postJobError}</p>}
                </div>
                {/* PREMIUM */}
                <div className={`post-job-plan-card post-job-plan-premium${selectedPostJobPlan === "Premium" ? " is-selected" : ""}`}>
                  <p className="plan-badge plan-badge-premium">PREMIUM</p>
                  <p className="plan-price">$59</p>
                  <p className="plan-duration">{postJobForm.duration}</p>
                  <ul className="plan-features">
                    <li>🏆 Premium badge</li>
                    <li>Highest placement</li>
                    <li>Maximum visibility</li>
                  </ul>
                  <button className="plan-btn plan-btn-premium" type="button" onClick={handlePostPremium} disabled={postJobPublishing}>
                    {postJobPublishing ? "Publishing…" : "Post Premium"}
                  </button>
                  {postJobError && <p className="post-job-error" role="alert">{postJobError}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {postJobStep === "preview" && (
            <div className="post-job-preview-wrap">
              <section className="marketplace-hero jobs-hero" aria-labelledby="preview-title">
                <p className="eyebrow">Preview</p>
                <h1 id="preview-title">Your Job Listing</h1>
                <p className="events-intro">This is how your post will appear to job seekers.</p>
              </section>
              <article className="marketplace-card jobs-card post-job-preview-card">
                <div className="marketplace-photo jobs-photo">
                  {postJobImagePreview
                    ? <img src={postJobImagePreview} alt="" />
                    : <div className="post-job-image-placeholder"><span aria-hidden="true">💼</span></div>
                  }
                  <span className="event-type marketplace-card-tag jobs-card-tag">New Today</span>
                </div>
                <div className="marketplace-card-copy jobs-card-copy">
                  {postJobLogoPreview && <img src={postJobLogoPreview} alt="Company logo" className="post-job-logo-thumb-preview" />}
                  <h3>{previewData.title} <strong>{previewData.pay}</strong></h3>
                  <p className="jobs-company">{previewData.company}</p>
                  <p className="marketplace-meta jobs-meta">
                    <span>{previewData.location}</span>
                    <span>{previewData.type}</span>
                    <span>Posted Today</span>
                  </p>
                  <p className="marketplace-description">{previewData.description}</p>
                  {postJobForm.requirements && <p className="post-job-requirements"><strong>Requirements:</strong> {postJobForm.requirements}</p>}
                  {postJobForm.appMethod && <p className="marketplace-meta jobs-meta"><span>Apply via: {postJobForm.appMethod}</span></p>}
                  {postJobForm.email && <p className="marketplace-meta jobs-meta"><span>✉ {postJobForm.email}</span></p>}
                  {postJobForm.phone && <p className="marketplace-meta jobs-meta"><span>📞 {postJobForm.phone}</span></p>}
                </div>
              </article>
              <div className="post-job-preview-actions">
                <button className="back-button" type="button" onClick={() => setPostJobStep("form")}>← Edit Listing</button>
                <button className="jobs-post-button post-job-promote-btn" type="button" onClick={handlePostSelectedPlan} disabled={postJobPublishing}>
                  <span aria-hidden="true">🚀</span> {postJobPublishing ? "Publishing..." : "Publish / Continue"}
                </button>
              </div>
              <p className="post-job-promote-note">Selected plan: {selectedPostJobPlan}. Free saves for review; Featured and Premium continue to checkout.</p>
            </div>
          )}

          {/* ── FORM ── */}
          {postJobStep === "form" && (
            <>
              <section className="marketplace-hero jobs-hero" aria-labelledby="post-job-title">
                <p className="eyebrow">For employers</p>
                <h1 id="post-job-title">Post a Job</h1>
                <p className="events-intro">Choose a plan, fill in the details, then preview and publish.</p>
              </section>
              <section className="plan-grid" aria-label="Job listing plans">
                {promotePlans.map((plan) => (
                  <button
                    className={`plan-card${selectedPostJobPlan === plan.name ? " is-selected" : ""}`}
                    key={plan.name}
                    type="button"
                    onClick={() => handlePostJobField("plan", plan.name)}
                    aria-pressed={selectedPostJobPlan === plan.name}
                  >
                    <span className="plan-name">{plan.name}</span>
                    <strong>{plan.price}</strong>
                    <span className="plan-cadence">{plan.cadence}</span>
                    <span className="plan-note">{plan.note}</span>
                  </button>
                ))}
              </section>
              <form className="business-form post-job-form"
                onSubmit={(e) => { e.preventDefault(); setPostJobStep("preview"); window.scrollTo(0, 0); }}>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Job title <span className="form-required" aria-hidden="true">*</span></span>
                    <input type="text" value={postJobForm.title}
                      onChange={(e) => handlePostJobField("title", e.target.value)}
                      placeholder="e.g. Delivery Driver" required />
                  </label>
                  <label className="form-field">
                    <span>Company / Business name <span className="form-required" aria-hidden="true">*</span></span>
                    <input type="text" value={postJobForm.company}
                      onChange={(e) => handlePostJobField("company", e.target.value)}
                      placeholder="e.g. Abilene Delivery Co." required />
                  </label>
                  <label className="form-field">
                    <span>Job category <span className="form-required" aria-hidden="true">*</span></span>
                    <select value={postJobForm.category}
                      onChange={(e) => handlePostJobField("category", e.target.value)} required>
                      <option value="" disabled>Choose category</option>
                      {jobsCategories.map((cat) => <option key={cat} value={cat}>{jobsCategoryIcon(cat)} {cat}</option>)}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Job type <span className="form-required" aria-hidden="true">*</span></span>
                    <select value={postJobForm.jobType}
                      onChange={(e) => handlePostJobField("jobType", e.target.value)} required>
                      <option value="" disabled>Choose type</option>
                      {jobTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Pay minimum</span>
                    <input type="text" value={postJobForm.payMin}
                      onChange={(e) => handlePostJobField("payMin", e.target.value)} placeholder="e.g. $16/hr" />
                  </label>
                  <label className="form-field">
                    <span>Pay maximum</span>
                    <input type="text" value={postJobForm.payMax}
                      onChange={(e) => handlePostJobField("payMax", e.target.value)} placeholder="e.g. $20/hr" />
                  </label>
                  <label className="form-field">
                    <span>Location <span className="form-required" aria-hidden="true">*</span></span>
                    <input type="text" value={postJobForm.location}
                      onChange={(e) => handlePostJobField("location", e.target.value)}
                      placeholder="Abilene, TX" required />
                  </label>
                  <label className="form-field">
                    <span>Application method</span>
                    <select value={postJobForm.appMethod}
                      onChange={(e) => handlePostJobField("appMethod", e.target.value)}>
                      {appMethodOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  {postJobForm.appMethod === "Website" && (
                    <label className="form-field form-field-full">
                      <span>Application website URL</span>
                      <input type="url" value={postJobForm.applyUrl}
                        onChange={(e) => handlePostJobField("applyUrl", e.target.value)}
                        placeholder="https://yourcompany.com/apply" />
                    </label>
                  )}
                  <label className="form-field">
                    <span>Contact Person</span>
                    <input type="text" value={postJobForm.contactPerson}
                      onChange={(e) => handlePostJobField("contactPerson", e.target.value)}
                      placeholder="e.g. Hiring Manager" />
                  </label>
                  <label className="form-field">
                    <span>Contact phone</span>
                    <input type="tel" value={postJobForm.phone}
                      onChange={(e) => handlePostJobField("phone", e.target.value)}
                      placeholder="(325) 555-0000" />
                  </label>
                  <label className="form-field">
                    <span>Contact email</span>
                    <input type="email" value={postJobForm.email}
                      onChange={(e) => handlePostJobField("email", e.target.value)}
                      placeholder="hiring@yourbusiness.com" />
                  </label>
                  <label className="form-field post-job-full">
                    <span>Listing duration</span>
                    <div className="post-job-duration-row">
                      {durationOptions.map((d) => (
                        <button key={d} type="button"
                          className={`post-job-duration-btn${postJobForm.duration === d ? " is-active" : ""}`}
                          onClick={() => handlePostJobField("duration", d)}>{d}</button>
                      ))}
                    </div>
                  </label>
                </div>
                <label className="form-field">
                  <span>Job description <span className="form-required" aria-hidden="true">*</span></span>
                  <textarea value={postJobForm.description}
                    onChange={(e) => handlePostJobField("description", e.target.value)}
                    placeholder="Describe the role, daily duties, work environment..." rows="5" required />
                </label>
                <label className="form-field">
                  <span>Requirements</span>
                  <textarea value={postJobForm.requirements}
                    onChange={(e) => handlePostJobField("requirements", e.target.value)}
                    placeholder="Experience, skills, license, certifications..." rows="3" />
                </label>
                <div className="post-job-media-row">
                  <label className="form-field post-job-media-field">
                    <span>Job photo (optional)</span>
                    <input type="file" accept="image/*" onChange={handlePostJobImage} />
                    {postJobImagePreview && (
                      <div className="post-job-img-thumb-wrap">
                        <img src={postJobImagePreview} alt="Preview" className="post-job-img-thumb" />
                        <button type="button" className="post-job-img-remove"
                          onClick={() => { setPostJobForm((p) => ({ ...p, image: null })); setPostJobImagePreview(null); }}>
                          ✕ Remove
                        </button>
                      </div>
                    )}
                  </label>
                  <label className="form-field post-job-media-field">
                    <span>Company logo (optional)</span>
                    <input type="file" accept="image/*" onChange={handlePostJobLogo} />
                    {postJobLogoPreview && (
                      <div className="post-job-img-thumb-wrap">
                        <img src={postJobLogoPreview} alt="Logo preview" className="post-job-img-thumb post-job-logo-thumb" />
                        <button type="button" className="post-job-img-remove"
                          onClick={() => { setPostJobForm((p) => ({ ...p, logo: null })); setPostJobLogoPreview(null); }}>
                          ✕ Remove
                        </button>
                      </div>
                    )}
                  </label>
                </div>
                <div className="post-job-form-actions">
                  <button className="jobs-post-button post-job-preview-btn" type="submit">
                    <span aria-hidden="true">👁</span> Preview Job
                  </button>
                </div>
                <p className="post-job-form-note">After preview, your selected plan will be used to publish or continue to checkout.</p>
              </form>
            </>
          )}
        </div>
      </main>,
    );
  }


  // ── RENT & HOUSING ────────────────────────────────────────────────────────
  if (page === "rentals") {
    const isShortTerm = (r) => r.property_type === "Short-Term";

    const filteredRentals = (rentalsShowSaved
      ? rentalListings.filter((r) => savedRentals.includes(r.id))
      : rentalListings
    ).filter((r) => {
      const matchesType = rentalsTypeFilter === "All" || r.property_type === rentalsTypeFilter;
      const matchesFilter =
        rentalsFilter === "All" ||
        (rentalsFilter === "New Today" && formatJobPosted(r.created_at) === "Posted Today") ||
        (rentalsFilter === "Pet Friendly" && r.pets_allowed) ||
        (rentalsFilter === "Short-Term" && isShortTerm(r)) ||
        (rentalsFilter === "For Sale" && r.property_type === "For Sale");
      const text = `${r.title} ${r.address} ${r.description ?? ""} ${r.property_type}`.toLowerCase();
      return matchesType && matchesFilter && text.includes(rentalsSearch.trim().toLowerCase());
    }).sort((a, b) => {
      const planDiff = rentalPromotionRank(a) - rentalPromotionRank(b);
      if (planDiff !== 0) return planDiff;
      return new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0);
    });

    const rentalTypeCounts = rentalListings.reduce((acc, r) => {
      acc[r.property_type] = (acc[r.property_type] ?? 0) + 1;
      return acc;
    }, {});

    return withSplash(
      <main className="app jobs-page rentals-page" style={{ "--rentals-bg": `url("${appAsset("rentals-bg.png")}")` }}>
        <div className="jobs-neon-bg rentals-neon-bg" aria-hidden="true" />
        <div className="marketplace-shell jobs-shell rentals-shell">
          <button className="back-button" onClick={() => navigateTo("more")}>
            Back to services
          </button>

          <section className="marketplace-hero jobs-hero" aria-labelledby="rentals-title">
            <p className="eyebrow">Abilene, TX</p>
            <h1 id="rentals-title">Rent &amp; Housing</h1>
            <p className="events-intro">Find apartments, houses, rooms, commercial spaces, homes for sale, and short-term stays.</p>
            <div className={`marketplace-search jobs-search${rentalsSearch ? " has-clear" : ""}`}>
              <span aria-hidden="true">⌕</span>
              <input
                ref={rentalSearchInputRef}
                type="search"
                value={rentalsSearch}
                onChange={(e) => setRentalsSearch(e.target.value)}
                placeholder="Search by address, type, description..."
                aria-label="Search rentals"
              />
              {rentalsSearch && (
                <button
                  className="rentals-search-clear"
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setRentalsSearch("");
                    rentalSearchInputRef.current?.focus();
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
            <button
              className="jobs-post-button"
              type="button"
              onClick={() => navigateTo("post-rental")}
            >
              <span aria-hidden="true">+</span>
              Post a Listing
            </button>
            <div className="marketplace-filter-row jobs-filter-row" aria-label="Rentals quick filters">
              {rentalFilters.map((f) => (
                <button
                  key={f}
                  className={rentalsFilter === f ? "is-active" : ""}
                  type="button"
                  onClick={() => { setRentalsFilter(rentalsFilter === f ? "All" : f); setRentalsTypeFilter("All"); }}
                >
                  {rentalFilterIcon(f)}{f}
                </button>
              ))}
              <button
                type="button"
                className={rentalsFilter === "All" && rentalsTypeFilter === "All" ? "is-active" : ""}
                onClick={() => { setRentalsFilter("All"); setRentalsTypeFilter("All"); }}
              >
                All
              </button>
            </div>
          </section>

          <section className="marketplace-section jobs-section" aria-labelledby="rental-types-title">
            <div className="marketplace-section-heading">
              <h2 id="rental-types-title">Property Types</h2>
              <button type="button" onClick={() => { setRentalsTypeFilter("All"); setRentalsFilter("All"); }}>All</button>
            </div>
            <div className="marketplace-category-grid jobs-category-grid">
              {rentalTypes.map((t) => (
                <button
                  key={t}
                  className={rentalsTypeFilter === t ? "is-active" : ""}
                  type="button"
                  onClick={() => { setRentalsTypeFilter(rentalsTypeFilter === t ? "All" : t); setRentalsFilter("All"); }}
                >
                  <span aria-hidden="true">{rentalTypeIcon(t)}</span>
                  {t} ({rentalTypeCounts[t] ?? 0})
                </button>
              ))}
            </div>
          </section>

          <section className="marketplace-section jobs-section" aria-labelledby="rentals-list-title">
            <div className="marketplace-section-heading">
              <h2 id="rentals-list-title">
                {rentalsShowSaved
                  ? `Saved Listings (${filteredRentals.length})`
                  : `Available Listings (${filteredRentals.length} shown)`}
              </h2>
              <button
                type="button"
                className={`jobs-saved-toggle${rentalsShowSaved ? " is-active" : ""}`}
                onClick={() => setRentalsShowSaved((v) => !v)}
                aria-pressed={rentalsShowSaved}
              >
                {rentalsShowSaved ? "♥ Saved" : "♡ Saved"}
              </button>
            </div>

            <div className="marketplace-listing-grid jobs-listing-grid">
              {filteredRentals.length === 0 && (
                <p className="jobs-empty">
                  {rentalsShowSaved
                    ? "No saved listings yet. Tap ♡ on any listing to save it."
                    : rentalListings.length === 0
                      ? "No listings yet. Be the first to post!"
                      : "No listings match your search."}
                </p>
              )}
              {filteredRentals.map((r) => {
                const isSaved = savedRentals.includes(r.id);
                const rPhotos = Array.isArray(r.image_data) ? r.image_data.filter(Boolean) : [];
                const photo = rPhotos[0] ?? null;
                const isSTR = isShortTerm(r);
                const rentalPlan = String(r.plan ?? "free").toLowerCase();
                const hasRentalPromotion = hasActiveRentalPromotion(r);
                const isFeaturedRental = hasRentalPromotion && rentalPlan === "featured";
                const isPremiumRental = hasRentalPromotion && rentalPlan === "premium";
                const isFreeRental = !isFeaturedRental && !isPremiumRental;
                const rentalBadgeClass = isPremiumRental
                  ? " plan-badge plan-badge-premium jobs-tag-premium"
                  : isFeaturedRental
                    ? " plan-badge plan-badge-featured jobs-tag-featured"
                    : "";
                return (
                  <article
                    key={r.id}
                    className={`jobs-listing-card${isSTR ? " rental-str-card" : ""}`}
                    onClick={() => { setSelectedRental(r); setRentalGalleryIdx(0); navigateTo("rental-detail"); }}
                  >
                    {photo && (
                      <div className="jobs-listing-img-wrap">
                        <img src={photo} alt={r.title} className="jobs-listing-img" />
                        {rPhotos.length > 1 && (
                          <span className="rental-photo-count">📷 {rPhotos.length}</span>
                        )}
                      </div>
                    )}
                    <div className="jobs-listing-body">
                      <div className="jobs-listing-top">
                        <span className={`jobs-listing-tag${isSTR ? " rental-str-tag" : ""}`}>
                          {rentalTypeIcon(r.property_type)} {r.property_type}
                        </span>
                        {(isFeaturedRental || isPremiumRental) && (
                          <span
                            className={`jobs-listing-tag${rentalBadgeClass}`}
                            style={{
                              width: "78px",
                              minWidth: "78px",
                              height: "24px",
                              padding: "3px 10px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxSizing: "border-box",
                              fontSize: ".62rem",
                              letterSpacing: ".12em",
                              borderRadius: "999px",
                            }}
                          >
                            {isPremiumRental ? "Premium" : "Featured"}
                          </span>
                        )}
                        {isFreeRental && (
                          <span
                            className="jobs-listing-tag plan-badge plan-badge-free"
                            style={{
                              width: "78px",
                              minWidth: "78px",
                              height: "24px",
                              padding: "3px 10px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxSizing: "border-box",
                              fontSize: ".62rem",
                              letterSpacing: ".12em",
                              borderRadius: "999px",
                              background: "linear-gradient(135deg, rgba(226,232,240,0.95), rgba(148,163,184,0.88))",
                              borderColor: "rgba(148,163,184,0.75)",
                              color: "#1f2937",
                            }}
                          >
                            FREE
                          </span>
                        )}
                        <button
                          className={`jobs-save-btn${isSaved ? " is-saved" : ""}`}
                          type="button"
                          aria-label={isSaved ? "Unsave listing" : "Save listing"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSavedRentals((prev) =>
                              isSaved ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                            );
                          }}
                        >
                          {isSaved ? "♥" : "♡"}
                        </button>
                      </div>
                      <h3 className="jobs-listing-title">{r.title}</h3>
                      <p className="jobs-listing-company">
                        {isSTR
                          ? (r.price_per_night ? `${r.price_per_night}/night` : "Price on request")
                          : (r.price || "Price on request")}
                      </p>
                      <p className="jobs-listing-meta">
                        📍 {r.address}
                        {r.bedrooms ? ` · ${r.bedrooms}` : ""}
                        {r.bathrooms ? ` · ${r.bathrooms} ba` : ""}
                        {isSTR && r.max_guests ? ` · ${r.max_guests}` : ""}
                        {r.pets_allowed ? " · 🐾" : ""}
                      </p>
                      <p className="jobs-listing-posted">{formatJobPosted(r.created_at)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>,
    );
  }

  if (page === "rental-detail" && selectedRental) {
    const r = selectedRental;
    const isSTR = r.property_type === "Short-Term";
    const photos = Array.isArray(r.image_data) ? r.image_data.filter(Boolean) : [];
    return withSplash(
      <main className="app jobs-page rentals-page rental-detail-page">
        <div className="marketplace-shell jobs-shell rentals-shell">
          <button className="back-button" onClick={() => navigateTo("rentals")}>
            ← Back to Rentals
          </button>
          {photos.length > 0 && (
            <div
              className="rental-detail-gallery"
              ref={rentalGalleryRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const firstItem = el.firstChild;
                if (!firstItem) return;
                const pitch = firstItem.offsetWidth + 10;
                setRentalGalleryIdx(Math.min(photos.length - 1, Math.round(el.scrollLeft / pitch)));
              }}
            >
              {photos.map((src, i) => (
                <div key={i} className="rental-detail-gallery-item">
                  <img src={src} alt={`${r.title} · foto ${i + 1}`} className="rental-detail-gallery-img" />
                </div>
              ))}
            </div>
          )}
          {photos.length > 1 && (
            <div className="rental-gallery-dots">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Foto ${i + 1}`}
                  className={`rental-gallery-dot${i === rentalGalleryIdx ? " is-active" : ""}`}
                  onClick={() => {
                    const el = rentalGalleryRef.current;
                    if (!el || !el.firstChild) return;
                    const pitch = el.firstChild.offsetWidth + 10;
                    el.scrollTo({ left: i * pitch, behavior: "smooth" });
                  }}
                />
              ))}
            </div>
          )}
          <section className="job-detail-section">
            <span className="jobs-listing-tag">{rentalTypeIcon(r.property_type)} {r.property_type}</span>
            <h1 className="job-detail-title">{r.title}</h1>
            <p className="job-detail-pay">
              {isSTR
                ? [r.price_per_night && `${r.price_per_night}/night`, r.price_per_week && `${r.price_per_week}/week`].filter(Boolean).join(" · ") || "Price on request"
                : r.price || "Price on request"}
            </p>
            {!isSTR && r.deposit && <p className="job-detail-meta">Deposit: {r.deposit}</p>}
            {(r.bedrooms || r.bathrooms) && (
              <p className="job-detail-meta rental-amenities-line">
                {r.bedrooms && (
                  <span className="rental-amenity">
                    <RentalBedroomIcon />
                    <span>{r.bedrooms}</span>
                  </span>
                )}
                {r.bedrooms && r.bathrooms && <span className="rental-amenity-divider">·</span>}
                {r.bathrooms && (
                  <span className="rental-amenity">
                    <RentalBathroomIcon />
                    <span>{r.bathrooms} BA</span>
                  </span>
                )}
              </p>
            )}
            {r.pets_allowed && <p className="job-detail-meta">🐾 Pets allowed</p>}
            {isSTR && (
              <div className="rental-str-details">
                {r.max_guests && <p className="job-detail-meta">👥 Max guests: {r.max_guests}</p>}
                {(r.available_from || r.available_to) && (
                  <p className="job-detail-meta">
                    📅 Available: {r.available_from ?? "anytime"}{r.available_to ? ` – ${r.available_to}` : ""}
                  </p>
                )}
                {r.house_rules && (
                  <div className="job-detail-block">
                    <h3>House Rules</h3>
                    <p>{r.house_rules}</p>
                  </div>
                )}
              </div>
            )}
            {r.description && (
              <div className="job-detail-block">
                <h3>Description</h3>
                <p>{r.description}</p>
              </div>
            )}
            {r.contact_person && <p className="job-detail-meta">Contact: {r.contact_person}</p>}
            <div className="job-detail-apply-row rental-detail-main-actions">
              {r.phone && (
                <a className="jobs-post-button job-detail-apply-btn" href={`tel:${r.phone.replace(/\D/g, "")}`}>
                  📞 Call
                </a>
              )}
              {r.email && (
                <a className="jobs-post-button job-detail-apply-btn" href={`mailto:${r.email}`}>
                  ✉️ Email
                </a>
              )}
              {r.address && (
                <a
                  className="jobs-post-button job-detail-apply-btn"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📍 Directions
                </a>
              )}
              {r.external_url && (
                <a className="jobs-post-button job-detail-apply-btn" href={r.external_url} target="_blank" rel="noopener noreferrer">
                  🔗 View Listing
                </a>
              )}
            </div>
            {isRentalOwner(r) && (
              <div className="rental-owner-actions">
                <button
                  className="directory-link"
                  type="button"
                  onClick={() => { setEditingOwnerRental({ ...r }); setOwnerRentalStatus(""); }}
                >
                  Edit Listing
                </button>
                <button
                  className="directory-link danger-link"
                  type="button"
                  onClick={() => { setDeletingOwnerRental({ ...r }); setOwnerRentalStatus(""); }}
                >
                  Delete
                </button>
              </div>
            )}
            <p className="jobs-listing-posted" style={{ marginTop: "16px" }}>
              {formatJobPosted(r.created_at)}
              {r.expires_at ? ` · Expires ${new Date(r.expires_at).toLocaleDateString()}` : ""}
            </p>
          </section>
          {editingOwnerRental && (
            <div className="admin-modal-backdrop" role="presentation">
              <section className="admin-modal rental-owner-modal" role="dialog" aria-modal="true" aria-labelledby="owner-rental-edit-title">
                <div className="admin-modal-heading">
                  <p className="eyebrow">Rent &amp; Housing</p>
                  <h2 id="owner-rental-edit-title">Edit Listing</h2>
                </div>
                <form className="gallery-form" onSubmit={handleOwnerRentalEditSubmit}>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Title</span>
                      <input name="title" type="text" defaultValue={editingOwnerRental.title ?? ""} required />
                    </label>
                    <label className="form-field">
                      <span>Property Type</span>
                      <select name="property_type" defaultValue={editingOwnerRental.property_type ?? "Apartment"} required>
                        {rentalTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Address</span>
                      <input name="address" type="text" defaultValue={editingOwnerRental.address ?? ""} required />
                    </label>
                    <label className="form-field">
                      <span>Rent/Price</span>
                      <input name="price" type="text" defaultValue={editingOwnerRental.price ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Deposit</span>
                      <input name="deposit" type="text" defaultValue={editingOwnerRental.deposit ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Price/Night</span>
                      <input name="price_per_night" type="text" defaultValue={editingOwnerRental.price_per_night ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Price/Week</span>
                      <input name="price_per_week" type="text" defaultValue={editingOwnerRental.price_per_week ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Available From</span>
                      <input name="available_from" type="date" defaultValue={editingOwnerRental.available_from ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Available To</span>
                      <input name="available_to" type="date" defaultValue={editingOwnerRental.available_to ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Max Guests</span>
                      <input name="max_guests" type="text" defaultValue={editingOwnerRental.max_guests ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Bedrooms</span>
                      <select name="bedrooms" defaultValue={editingOwnerRental.bedrooms ?? ""}>
                        {["", "Studio", "1BR", "2BR", "3BR", "4BR+", "N/A"].map((value) => <option key={value || "empty"} value={value}>{value || "Select"}</option>)}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Bathrooms</span>
                      <select name="bathrooms" defaultValue={editingOwnerRental.bathrooms ?? ""}>
                        {["", "1", "1.5", "2", "2.5", "3+"].map((value) => <option key={value || "empty"} value={value}>{value || "Select"}</option>)}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Phone</span>
                      <input name="phone" type="tel" defaultValue={editingOwnerRental.phone ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>Email</span>
                      <input name="email" type="email" defaultValue={editingOwnerRental.email ?? ""} />
                    </label>
                    <label className="form-field">
                      <span>View Listing URL</span>
                      <input name="external_url" type="url" defaultValue={editingOwnerRental.external_url ?? ""} />
                    </label>
                    <label className="form-field rental-owner-check">
                      <input name="pets_allowed" type="checkbox" defaultChecked={editingOwnerRental.pets_allowed ?? false} />
                      <span>Pets allowed</span>
                    </label>
                  </div>
                  <label className="form-field">
                    <span>Description</span>
                    <textarea name="description" rows="4" defaultValue={editingOwnerRental.description ?? ""} />
                  </label>
                  <label className="form-field">
                    <span>House Rules</span>
                    <textarea name="house_rules" rows="3" defaultValue={editingOwnerRental.house_rules ?? ""} />
                  </label>
                  <div className="admin-modal-actions">
                    <button className="primary-button admin-modal-primary" type="submit" disabled={ownerRentalStatus === "saving"}>
                      {ownerRentalStatus === "saving" ? "Saving..." : "Save Changes"}
                    </button>
                    <button className="directory-link" type="button" onClick={() => { setEditingOwnerRental(null); setOwnerRentalStatus(""); }}>
                      Go Back
                    </button>
                  </div>
                  {ownerRentalStatus === "error" && <p className="form-error">Could not save. Make sure the owner-control SQL has been applied.</p>}
                </form>
              </section>
            </div>
          )}
          {deletingOwnerRental && (
            <div className="admin-modal-backdrop" role="presentation">
              <section className="admin-modal rental-owner-modal" role="dialog" aria-modal="true" aria-labelledby="owner-rental-delete-title">
                <div className="admin-modal-heading">
                  <p className="eyebrow">Rent &amp; Housing</p>
                  <h2 id="owner-rental-delete-title">Delete Listing?</h2>
                </div>
                <p>Delete this rental listing from Rent &amp; Housing?</p>
                <p>{deletingOwnerRental.title}</p>
                <div className="admin-modal-actions">
                  <button className="directory-link danger-link" type="button" onClick={confirmDeleteOwnerRental} disabled={ownerRentalStatus === "saving"}>
                    {ownerRentalStatus === "saving" ? "Deleting..." : "Delete Listing"}
                  </button>
                  <button className="directory-link" type="button" onClick={() => { setDeletingOwnerRental(null); setOwnerRentalStatus(""); }}>
                    Go Back
                  </button>
                </div>
                {ownerRentalStatus === "error" && <p className="form-error">Could not delete. Make sure the owner-control SQL has been applied.</p>}
              </section>
            </div>
          )}
        </div>
      </main>,
    );
  }

  if (page === "post-rental") {
    const isShortTerm = postRentalForm.propertyType === "Short-Term";
    const isForSale   = postRentalForm.propertyType === "For Sale";
    const isCommercial = postRentalForm.propertyType === "Commercial";
    const hasRooms    = ["Apartment","House","Room","For Sale"].includes(postRentalForm.propertyType);
    const maxPhotos   = isShortTerm ? 8 : 5;

    const handleRentalField = (field, value) =>
      setPostRentalForm((prev) => ({ ...prev, [field]: value }));

    const optimizeRentalImage = async (file) => {
      const maxStoredSize = 450 * 1024;
      const maxDimension = 1200;
      const image = await loadImageFromFile(file);
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      let smallestBlob = null;
      for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5, 0.44]) {
        const blob = await canvasToBlob(canvas, quality);
        smallestBlob = blob;
        if (blob.size <= maxStoredSize) {
          return readFileAsDataUrl(blob);
        }
      }

      return readFileAsDataUrl(smallestBlob);
    };

    const handleRentalPhotosAdd = async (files) => {
      const remaining = maxPhotos - postRentalPhotos.length;
      const toAdd = Array.from(files).slice(0, remaining);
      for (const file of toAdd) {
        try {
          const preview = await optimizeRentalImage(file);
          setPostRentalPhotos((prev) =>
            prev.length < maxPhotos ? [...prev, { preview }] : prev
          );
        } catch (e) {
          console.error("[Rentals] Photo compression error:", e);
          setPostRentalError("One photo could not be prepared. Try a smaller image.");
        }
      }
    };

    const handleRentalPhotoRemove = (idx) =>
      setPostRentalPhotos((prev) => prev.filter((_, i) => i !== idx));

    const validateRental = () => {
      if (!postRentalForm.title.trim())   return "Title is required.";
      if (!postRentalForm.address.trim()) return "Address is required.";
      if (isShortTerm) {
        if (!postRentalForm.pricePerNight.trim() && !postRentalForm.pricePerWeek.trim())
          return "Enter a price per night or per week.";
      } else {
        if (!postRentalForm.price.trim()) return "Price is required.";
      }
      if (!postRentalForm.phone.trim() && !postRentalForm.email.trim())
        return "Enter at least a phone number or email.";
      return null;
    };

    const handlePublishRental = async () => {
      if (!supabase) { setPostRentalError("Connection unavailable. Check your internet and try again."); return; }
      const err = validateRental();
      if (err) { setPostRentalError(err); return; }
      setPostRentalError(null);
      setPostRentalPublishing(true);
      try {
        const durationDays = { "30 Days": 30, "60 Days": 60, "90 Days": 90 }[postRentalForm.duration] ?? 30;
        const expires_at   = new Date(Date.now() + durationDays * 86400000).toISOString();
        const image_data   = postRentalPhotos.map((p) => p.preview);
        const requestedPlan = String(postRentalForm.plan || "Free").toLowerCase();
        const description = postRentalForm.description.trim();
        const record = {
          title:         postRentalForm.title.trim(),
          property_type: postRentalForm.propertyType,
          address:       postRentalForm.address.trim(),
          description:   description || null,
          contact_person: postRentalForm.contactPerson.trim() || null,
          phone:         postRentalForm.phone.trim()        || null,
          email:         postRentalForm.email.trim()        || null,
          external_url:  postRentalForm.externalUrl.trim()  || null,
          duration:      postRentalForm.duration,
          plan:          "free",
          status:        "pending",
          payment_status: "not_required",
          requested_plan: requestedPlan,
          expires_at,
          image_data,
          pets_allowed:  postRentalForm.petsAllowed,
          owner_user_id: effectiveOwnerId,
        };
        if (isShortTerm) {
          record.price_per_night = postRentalForm.pricePerNight.trim() || null;
          record.price_per_week  = postRentalForm.pricePerWeek.trim()  || null;
          record.available_from  = postRentalForm.availableFrom        || null;
          record.available_to    = postRentalForm.availableTo          || null;
          record.max_guests      = postRentalForm.maxGuests.trim()     || null;
          record.house_rules     = postRentalForm.houseRules.trim()    || null;
        } else {
          record.price   = postRentalForm.price.trim()   || null;
          if (!isForSale && !isCommercial)
            record.deposit = postRentalForm.deposit.trim() || null;
          if (hasRooms) {
            record.bedrooms   = postRentalForm.bedrooms   || null;
            record.bathrooms  = postRentalForm.bathrooms  || null;
          }
        }
        if (requestedPlan !== "free") {
          const checkoutPlan = requestedPlan === "premium" ? "Premium" : "Featured";
          const rentalPayload = { ...record };
          delete rentalPayload.plan;
          delete rentalPayload.status;
          delete rentalPayload.payment_status;
          delete rentalPayload.requested_plan;
          delete rentalPayload.expires_at;
          const returnUrl = window.location.origin.startsWith("https://") ? window.location.origin : "";
          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout-session", {
            body: {
              listingType: "rental",
              action: "create_and_checkout",
              plan: checkoutPlan,
              rentalPayload,
              businessName: record.title,
              contactEmail: record.email,
              returnUrl,
            },
          });

          if (checkoutData?.url) {
            openCheckoutUrl(checkoutData.url);
          } else {
            if (checkoutError) {
              console.error("[Rentals] Checkout session failed:", checkoutError);
            }
            setPostRentalError("Your rental was saved, but checkout could not open. Please contact us to finish payment.");
            return;
          }
        } else {
          let { error } = await supabase.from("rental_listings").insert([record], { returning: "minimal" });
          if (error?.code === "PGRST204" || error?.code === "42703") {
            const recordWithoutOwner = { ...record };
            delete recordWithoutOwner.owner_user_id;
            ({ error } = await supabase.from("rental_listings").insert([recordWithoutOwner], { returning: "minimal" }));
          }
          if (error) throw error;
        }
        setPostRentalForm({
          title:"", propertyType:"Apartment", price:"", deposit:"",
          pricePerNight:"", pricePerWeek:"",
          availableFrom:"", availableTo:"", maxGuests:"", houseRules:"", petsAllowed:false,
          address:"Abilene, TX", bedrooms:"", bathrooms:"",
          description:"", contactPerson:"", phone:"", email:"", externalUrl:"",
          duration:"30 Days", plan:"Free",
        });
        setPostRentalPhotos([]);
        setPostRentalStep("form");
        setPostRentalError(null);
        loadRentalsPublic();
        navigateTo("rentals");
      } catch (e) {
        console.error("[Rentals] Publish Listing error:", e);
        setPostRentalError(e?.message ?? "Failed to publish. Try again.");
      } finally {
        setPostRentalPublishing(false);
      }
    };

    // ── PREVIEW STEP ─────────────────────────────────────────
    if (postRentalStep === "preview") {
      return withSplash(
        <main className="app jobs-page rentals-page post-rental-page" style={{ "--rentals-bg": `url("${appAsset("rentals-bg.png")}")` }}>
          <div className="jobs-neon-bg rentals-neon-bg" aria-hidden="true" />
          <div className="marketplace-shell jobs-shell rentals-shell" style={{ paddingBottom:100 }}>
            <button className="back-button" onClick={() => setPostRentalStep("form")}>← Edit</button>
            <section className="marketplace-hero jobs-hero">
              <p className="eyebrow">Preview your listing</p>
              <h1>{postRentalForm.title || "Untitled"}</h1>
              <p className="events-intro">{postRentalForm.propertyType} · {postRentalForm.address}</p>
            </section>

            {postRentalPhotos.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", padding:"0 16px 16px" }}>
                {postRentalPhotos.map((p, i) => (
                  <img key={i} src={p.preview} alt="" style={{ width:90, height:70, objectFit:"cover", borderRadius:8 }} />
                ))}
              </div>
            )}

            <div style={{ padding:"0 16px" }}>
              {isShortTerm ? (
                <>
                  {postRentalForm.pricePerNight && <p><strong>Per Night:</strong> {postRentalForm.pricePerNight}</p>}
                  {postRentalForm.pricePerWeek  && <p><strong>Per Week:</strong> {postRentalForm.pricePerWeek}</p>}
                  {postRentalForm.availableFrom  && (
                    <p><strong>Available:</strong> {postRentalForm.availableFrom} – {postRentalForm.availableTo}</p>
                  )}
                  {postRentalForm.maxGuests  && <p><strong>Max Guests:</strong> {postRentalForm.maxGuests}</p>}
                  {postRentalForm.houseRules && <p><strong>House Rules:</strong> {postRentalForm.houseRules}</p>}
                  <p><strong>Pets:</strong> {postRentalForm.petsAllowed ? "Allowed ✅" : "Not allowed"}</p>
                </>
              ) : (
                <>
                  {postRentalForm.price   && <p><strong>{isForSale ? "Asking Price" : "Rent"}:</strong> {postRentalForm.price}</p>}
                  {postRentalForm.deposit && <p><strong>Deposit:</strong> {postRentalForm.deposit}</p>}
                  {postRentalForm.bedrooms  && <p><strong>Bedrooms:</strong> {postRentalForm.bedrooms}</p>}
                  {postRentalForm.bathrooms && <p><strong>Bathrooms:</strong> {postRentalForm.bathrooms}</p>}
                  <p><strong>Pets:</strong> {postRentalForm.petsAllowed ? "Allowed ✅" : "Not allowed"}</p>
                </>
              )}
              {postRentalForm.description  && <p><strong>Description:</strong> {postRentalForm.description}</p>}
              {postRentalForm.contactPerson && <p><strong>Contact:</strong> {postRentalForm.contactPerson}</p>}
              {postRentalForm.phone        && <p><strong>Phone:</strong> {postRentalForm.phone}</p>}
              {postRentalForm.email        && <p><strong>Email:</strong> {postRentalForm.email}</p>}
              {postRentalForm.externalUrl  && <p><strong>Link:</strong> {postRentalForm.externalUrl}</p>}
              <p><strong>Duration:</strong> {postRentalForm.duration}</p>
              <p><strong>Plan:</strong> {postRentalForm.plan || "Free"}</p>
            </div>

            {postRentalError && (
              <p className="post-job-error" style={{ padding:"0 16px" }}>{postRentalError}</p>
            )}

            <div className="post-job-sticky-footer">
              <button
                className="post-job-submit-btn"
                onClick={handlePublishRental}
                disabled={postRentalPublishing}
              >
                {postRentalPublishing ? "Publishing…" : "✅ Publish Listing"}
              </button>
            </div>
          </div>
        </main>,
      );
    }

    // ── FORM STEP ────────────────────────────────────────────
    return withSplash(
      <main className="app jobs-page rentals-page post-rental-page" style={{ "--rentals-bg": `url("${appAsset("rentals-bg.png")}")` }}>
        <div className="jobs-neon-bg rentals-neon-bg" aria-hidden="true" />
        <div className="marketplace-shell jobs-shell rentals-shell" style={{ paddingBottom:100 }}>
          <button className="back-button" onClick={() => navigateTo("rentals")}>← Back to Rentals</button>
          <section className="marketplace-hero jobs-hero">
            <p className="eyebrow">List your property</p>
            <h1>Post a Rental</h1>
          </section>

          <section className="plan-grid" aria-label="Rental listing plans">
            {promotePlans.map((plan) => (
              <button
                className={`plan-card${postRentalForm.plan === plan.name ? " is-selected" : ""}`}
                key={plan.name}
                type="button"
                onClick={() => handleRentalField("plan", plan.name)}
                aria-pressed={postRentalForm.plan === plan.name}
              >
                <span className="plan-name">{plan.name}</span>
                <strong>{plan.price}</strong>
                <span className="plan-cadence">{plan.cadence}</span>
                <span className="plan-note">{plan.note}</span>
              </button>
            ))}
          </section>

          <form
            className="post-job-form"
            onSubmit={(e) => {
              e.preventDefault();
              const err = validateRental();
              if (err) { setPostRentalError(err); return; }
              setPostRentalError(null);
              setPostRentalStep("preview");
            }}
          >
            {/* Property Type */}
            <div className="post-job-field">
              <label className="post-job-label">Property Type *</label>
              <div className="jobs-filter-bar" style={{ flexWrap:"wrap", gap:8, marginTop:4 }}>
                {rentalTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`jobs-filter-chip${postRentalForm.propertyType === t ? " is-active" : ""}`}
                    onClick={() => handleRentalField("propertyType", t)}
                  >
                    {rentalTypeIcon(t)} {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="post-job-field">
              <label className="post-job-label">Listing Title *</label>
              <input
                className="post-job-input"
                placeholder={isShortTerm ? "Cozy Guest Suite Near Downtown" : "2BR Apartment Available Now"}
                value={postRentalForm.title}
                onChange={(e) => handleRentalField("title", e.target.value)}
              />
            </div>

            {/* Address */}
            <div className="post-job-field">
              <label className="post-job-label">Address / Neighborhood *</label>
              <input
                className="post-job-input"
                placeholder="Abilene, TX"
                value={postRentalForm.address}
                onChange={(e) => handleRentalField("address", e.target.value)}
              />
            </div>

            {/* SHORT-TERM fields */}
            {isShortTerm && (
              <>
                <div className="post-job-field">
                  <label className="post-job-label">Price Per Night *</label>
                  <input
                    className="post-job-input"
                    placeholder="e.g. $85/night"
                    value={postRentalForm.pricePerNight}
                    onChange={(e) => handleRentalField("pricePerNight", e.target.value)}
                  />
                </div>
                <div className="post-job-field">
                  <label className="post-job-label">Price Per Week</label>
                  <input
                    className="post-job-input"
                    placeholder="e.g. $450/wk"
                    value={postRentalForm.pricePerWeek}
                    onChange={(e) => handleRentalField("pricePerWeek", e.target.value)}
                  />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div className="post-job-field">
                    <label className="post-job-label">Available From</label>
                    <input
                      type="date"
                      className="post-job-input"
                      value={postRentalForm.availableFrom}
                      onChange={(e) => handleRentalField("availableFrom", e.target.value)}
                    />
                  </div>
                  <div className="post-job-field">
                    <label className="post-job-label">Available To</label>
                    <input
                      type="date"
                      className="post-job-input"
                      value={postRentalForm.availableTo}
                      onChange={(e) => handleRentalField("availableTo", e.target.value)}
                    />
                  </div>
                </div>
                <div className="post-job-field">
                  <label className="post-job-label">Max Guests</label>
                  <input
                    className="post-job-input"
                    placeholder="e.g. 4 guests"
                    value={postRentalForm.maxGuests}
                    onChange={(e) => handleRentalField("maxGuests", e.target.value)}
                  />
                </div>
                <div className="post-job-field">
                  <label className="post-job-label">House Rules</label>
                  <textarea
                    className="post-job-textarea"
                    placeholder="No smoking, quiet after 10pm…"
                    rows={3}
                    value={postRentalForm.houseRules}
                    onChange={(e) => handleRentalField("houseRules", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* LONG-TERM pricing */}
            {!isShortTerm && (
              <>
                <div className="post-job-field">
                  <label className="post-job-label">{isForSale ? "Asking Price *" : "Monthly Rent *"}</label>
                  <input
                    className="post-job-input"
                    placeholder={isForSale ? "e.g. $185,000" : "e.g. $900/mo"}
                    value={postRentalForm.price}
                    onChange={(e) => handleRentalField("price", e.target.value)}
                  />
                </div>
                {!isForSale && !isCommercial && (
                  <div className="post-job-field">
                    <label className="post-job-label">Deposit</label>
                    <input
                      className="post-job-input"
                      placeholder="e.g. $500 or First & Last"
                      value={postRentalForm.deposit}
                      onChange={(e) => handleRentalField("deposit", e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {/* Bedrooms / Bathrooms */}
            {hasRooms && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div className="post-job-field">
                  <label className="post-job-label">Bedrooms</label>
                  <select
                    className="post-job-input"
                    value={postRentalForm.bedrooms}
                    onChange={(e) => handleRentalField("bedrooms", e.target.value)}
                  >
                    <option value="">—</option>
                    {["Studio","1BR","2BR","3BR","4BR+"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="post-job-field">
                  <label className="post-job-label">Bathrooms</label>
                  <select
                    className="post-job-input"
                    value={postRentalForm.bathrooms}
                    onChange={(e) => handleRentalField("bathrooms", e.target.value)}
                  >
                    <option value="">—</option>
                    {["1","1.5","2","2.5","3+"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Pets */}
            {(hasRooms || isShortTerm) && (
              <div className="post-job-field" style={{ display:"flex", alignItems:"center", gap:10 }}>
                <input
                  id="pr-pets"
                  type="checkbox"
                  checked={postRentalForm.petsAllowed}
                  onChange={(e) => handleRentalField("petsAllowed", e.target.checked)}
                  style={{ width:18, height:18 }}
                />
                <label htmlFor="pr-pets" className="post-job-label" style={{ margin:0 }}>
                  🐾 Pets Allowed
                </label>
              </div>
            )}

            {/* Description */}
            <div className="post-job-field">
              <label className="post-job-label">Description</label>
              <textarea
                className="post-job-textarea"
                placeholder="Describe the property, features, nearby landmarks…"
                rows={4}
                value={postRentalForm.description}
                onChange={(e) => handleRentalField("description", e.target.value)}
              />
            </div>

            {/* Photos */}
            <div className="post-job-field">
              <label className="post-job-label">
                Photos ({postRentalPhotos.length}/{maxPhotos})
              </label>
              {postRentalPhotos.length < maxPhotos && (
                <label className="post-job-image-btn" style={{ cursor:"pointer" }}>
                  📷 Add Photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display:"none" }}
                    onChange={(e) => handleRentalPhotosAdd(e.target.files)}
                  />
                </label>
              )}
              {postRentalPhotos.length > 0 && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:8 }}>
                  {postRentalPhotos.map((p, i) => (
                    <div key={i} style={{ position:"relative" }}>
                      <img
                        src={p.preview}
                        alt=""
                        style={{ width:80, height:64, objectFit:"cover", borderRadius:8 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRentalPhotoRemove(i)}
                        style={{
                          position:"absolute", top:-6, right:-6,
                          background:"#ff4444", color:"#fff", border:"none",
                          borderRadius:"50%", width:20, height:20,
                          fontSize:12, cursor:"pointer", lineHeight:"20px",
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contact */}
            <div className="post-job-field">
              <label className="post-job-label">Contact Person</label>
              <input
                type="text"
                className="post-job-input"
                placeholder="e.g. Property Manager"
                value={postRentalForm.contactPerson}
                onChange={(e) => handleRentalField("contactPerson", e.target.value)}
              />
            </div>
            <div className="post-job-field">
              <label className="post-job-label">Phone</label>
              <input
                type="tel"
                className="post-job-input"
                placeholder="(325) 555-0000"
                value={postRentalForm.phone}
                onChange={(e) => handleRentalField("phone", e.target.value)}
              />
            </div>
            <div className="post-job-field">
              <label className="post-job-label">Email</label>
              <input
                type="email"
                className="post-job-input"
                placeholder="you@example.com"
                value={postRentalForm.email}
                onChange={(e) => handleRentalField("email", e.target.value)}
              />
            </div>
            <div className="post-job-field">
              <label className="post-job-label">External Link</label>
              <input
                type="url"
                className="post-job-input"
                placeholder="Zillow, Realtor.com, Airbnb listing URL…"
                value={postRentalForm.externalUrl}
                onChange={(e) => handleRentalField("externalUrl", e.target.value)}
              />
            </div>

            {/* Duration */}
            <div className="post-job-field">
              <label className="post-job-label">Listing Duration</label>
              <div className="jobs-filter-bar" style={{ gap:8, marginTop:4 }}>
                {["30 Days","60 Days","90 Days"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`jobs-filter-chip${postRentalForm.duration === d ? " is-active" : ""}`}
                    onClick={() => handleRentalField("duration", d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {postRentalError && (
              <p className="post-job-error">{postRentalError}</p>
            )}

            <button type="submit" className="post-job-submit-btn" style={{ marginTop:16 }}>
              Preview Listing →
            </button>
          </form>
        </div>
      </main>,
    );
  }
  // ── END RENT & HOUSING ─────────────────────────────────────────────────────

  if (page === "jobs") {
    return withSplash(
      <main className="app jobs-page" style={{ "--jobs-bg": `url("${appAsset("jobs-bg.png")}")` }}>
        <div className="jobs-neon-bg" aria-hidden="true" />
        <div className="marketplace-shell jobs-shell">
          <button className="back-button" onClick={() => navigateTo("more")}>
            Back to services
          </button>
          <section className="marketplace-hero jobs-hero" aria-labelledby="jobs-title">
            <p className="eyebrow">Work local</p>
            <h1 id="jobs-title">Jobs &amp; Hiring</h1>
            <p className="events-intro">Find local jobs or post that your business is hiring.</p>
            <div className="marketplace-search jobs-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={jobsSearch}
                onChange={(e) => setJobsSearch(e.target.value)}
                placeholder="Search jobs, companies, skills..."
                aria-label="Search jobs, companies, skills"
              />
            </div>
            <button
              className="jobs-post-button"
              type="button"
              onClick={() => navigateTo("post-job")}
            >
              <span aria-hidden="true">+</span>
              Post a Job / We&apos;re Hiring
            </button>
            <div className="marketplace-filter-row jobs-filter-row" aria-label="Jobs quick filters">
              {jobsFilters.map((f) => (
                <button
                  key={f}
                  className={jobsFilter === f ? "is-active" : ""}
                  type="button"
                  onClick={() => { setJobsFilter(jobsFilter === f ? "All" : f); setJobsCategoryFilter("All"); }}
                >
                  {jobsFilterIcon(f)}{f} ({jobsCategoryCounts[f] ?? 0})
                </button>
              ))}
              <button type="button" className={jobsFilter === "All" && jobsCategoryFilter === "All" ? "is-active" : ""} onClick={() => { setJobsFilter("All"); setJobsCategoryFilter("All"); }}>All</button>
            </div>
          </section>
          <section className="marketplace-section jobs-section" aria-labelledby="job-category-title">
            <div className="marketplace-section-heading">
              <h2 id="job-category-title">Job Categories</h2>
              <button type="button" onClick={() => { setJobsFilter("All"); setJobsCategoryFilter("All"); }}>All</button>
            </div>
            <div className="marketplace-category-grid jobs-category-grid">
              {jobsCategories.map((cat) => (
                <button
                  key={cat}
                  className={jobsCategoryFilter === cat ? "is-active" : ""}
                  type="button"
                  onClick={() => { setJobsCategoryFilter(jobsCategoryFilter === cat ? "All" : cat); setJobsFilter("All"); }}
                >
                  <span aria-hidden="true">{jobsCategoryIcon(cat)}</span>
                  {cat} ({jobsCategoryCounts[cat] ?? 0})
                </button>
              ))}
            </div>
          </section>
          <section className="marketplace-section jobs-section" aria-labelledby="new-jobs-title">
            <div className="marketplace-section-heading">
              <h2 id="new-jobs-title">{jobsShowSaved ? `Saved Jobs (${filteredJobListings.length})` : `Find a Job (${filteredJobListings.length} shown)`}</h2>
              <button type="button"
                className={`jobs-saved-toggle${jobsShowSaved ? " is-active" : ""}`}
                onClick={() => setJobsShowSaved((v) => !v)}
                aria-pressed={jobsShowSaved}>
                {jobsShowSaved ? "♥ Saved" : "♡ Saved"}
              </button>
            </div>
            <div className="marketplace-listing-grid jobs-listing-grid">
              {filteredJobListings.length === 0 && (
                <p className="jobs-empty">{jobsShowSaved ? "No saved jobs yet. Tap ♡ on any listing to save it." : "No jobs match your search."}</p>
              )}
              {filteredJobListings.map((j) => {
                const isSaved = savedJobs.includes(j.id);
                const jobTier = String(j.tag || j.plan || "").toLowerCase();
                const isFeatured = jobTier === "featured";
                const isPremium = jobTier === "premium";
                const jobBadgeClass = isPremium
                  ? " plan-badge plan-badge-premium jobs-tag-premium"
                  : isFeatured
                    ? " plan-badge plan-badge-featured jobs-tag-featured"
                    : "";
                return (
                  <article key={jobsListingKey(j)} className={`marketplace-card jobs-card${isFeatured ? " jobs-card-featured" : ""}${isPremium ? " jobs-card-premium" : ""}`}>
                    <div className="marketplace-photo jobs-photo">
                      {j.image
                        ? <img src={j.image} alt="" loading="lazy" />
                        : <div className="post-job-image-placeholder"><span aria-hidden="true">💼</span></div>
                      }
                      <span className={`event-type marketplace-card-tag jobs-card-tag${jobBadgeClass}`}>{j.tag}</span>
                      <button
                        className={`jobs-heart-btn${isSaved ? " is-saved" : ""}`}
                        type="button"
                        aria-label={isSaved ? "Unsave job" : "Save job"}
                        onClick={(e) => { e.stopPropagation(); setSavedJobs((prev) => isSaved ? prev.filter((id) => id !== j.id) : [...prev, j.id]); }}
                      >{isSaved ? "♥" : "♡"}</button>
                    </div>
                    <div className="marketplace-card-copy jobs-card-copy">
                      <h3>{j.title} <strong>{j.pay}</strong></h3>
                      <p className="jobs-company">{j.company}</p>
                      <p className="marketplace-meta jobs-meta">
                        <span>{j.location}</span>
                        <span>{j.type}</span>
                        <span>{j.posted}</span>
                      </p>
                      <p className="marketplace-description">{j.description}</p>
                      <div className="jobs-card-actions">
                        <button className="directory-link jobs-apply-button" type="button"
                          onClick={() => { setSelectedJob(j); navigateTo("job-detail"); }}>
                          View &amp; Apply
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="marketplace-section jobs-section">
            <div className="marketplace-section-heading">
              <h2>Post a Job / We&apos;re Hiring</h2>
            </div>
            <section className="checkout-result-card service-empty-card">
              <p className="eyebrow">For businesses</p>
              <h2>Promote your open positions</h2>
              <p>List your business in Abilene Vibes and reach local job seekers today.</p>
              <button
                className="jobs-post-button"
                type="button"
                style={{ marginTop: "12px" }}
                onClick={() => navigateTo("post-job")}
              >
                <span aria-hidden="true">+</span>
                Get Listed
              </button>
            </section>
          </section>
        </div>
      </main>,
    );
  }

  if (page === "directory") {
    return withSplash(
      <main className="app directory-page">
        <div className="directory-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="directory-header" aria-labelledby="directory-title">
            <p className="eyebrow">Local guide</p>
            <h1 id="directory-title">Business Directory</h1>
            <p className="events-intro">Explore Abilene businesses shared through Abilene Vibes.</p>
          </section>

          {checkoutNotice === "success" && (
            <section className="checkout-result-card is-success" aria-labelledby="checkout-success-title">
              <p className="eyebrow">Payment received</p>
              <h2 id="checkout-success-title">Thanks for promoting your business.</h2>
              <p>
                Your payment was received and your listing is waiting for Abilene Vibes admin review. Once approved, it
                will appear in the paid promotion spots for the current billing period.
              </p>
              <div className="checkout-steps" aria-label="What happens next">
                <span>1. Payment confirmed</span>
                <span>2. Admin review</span>
                <span>3. Listing goes live</span>
              </div>
              <div className="checkout-result-actions">
                <button className="directory-link" type="button" onClick={backToLobby}>
                  Back to Lobby
                </button>
                <button className="directory-link" type="button" onClick={() => navigateTo("promote")}>
                  Promote Another
                </button>
              </div>
            </section>
          )}

          {checkoutNotice === "cancelled" && (
            <section className="checkout-result-card is-cancelled" aria-labelledby="checkout-cancelled-title">
              <p className="eyebrow">Checkout cancelled</p>
              <h2 id="checkout-cancelled-title">Your request was saved.</h2>
              <p>
                The paid placement is not active yet because checkout was cancelled. You can submit again when you are
                ready to finish payment.
              </p>
              <div className="checkout-result-actions">
                <button className="directory-link" type="button" onClick={() => navigateTo("promote")}>
                  Try Again
                </button>
              </div>
            </section>
          )}

          <button className="directory-add-button" type="button" onClick={() => navigateTo("promote")}>
            Add your business
          </button>

          <p className="legal-disclaimer">
            Business names and trademarks belong to their respective owners. Listings are informational unless clearly
            marked as paid, sponsored, or partnered placements.
          </p>

          <section className="directory-grid" aria-label="Abilene business directory">
            {directoryBusinesses.map((business) => (
              <article className="directory-card" key={business.id}>
                <button
                  className="image-open-button directory-image-button"
                  type="button"
                  onClick={() => openImageViewer(businessDisplayImage(business), business.name)}
                  aria-label={`Open ${business.name} photo`}
                >
                  <img
                    className="directory-image"
                    src={businessDisplayImage(business)}
                    alt=""
                    loading="lazy"
                  />
                </button>
                <span className="event-type">{business.category}</span>
                {businessDisplayPlan(business) && (
                  <span className={`plan-badge plan-badge-${businessDisplayPlan(business).toLowerCase()}`}>
                    {businessDisplayPlan(business)}
                  </span>
                )}
                <h2>{business.name}</h2>
                {business.description && <p>{business.description}</p>}
                {business.contactName && <p>Contact: {business.contactName}</p>}
                {business.contactEmail && <p>Email: {business.contactEmail}</p>}
                {business.address && <p>{business.address}</p>}
                {business.phone && <p>{business.phone}</p>}

                <div className="directory-actions">
                  {business.phone && (
                    <a
                      className="directory-link"
                      href={`tel:${business.phone.replace(/\D/g, "")}`}
                      onClick={(event) =>
                        openTrackedBusinessLink(event, business, "calls", `tel:${business.phone.replace(/\D/g, "")}`)
                      }
                    >
                      Call
                    </a>
                  )}

                  <a
                    className="directory-link"
                    href={mapSearchUrl(`${business.name}, ${business.address || "Abilene TX"}`)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) =>
                      openTrackedBusinessLink(
                        event,
                        business,
                        "directions",
                        mapSearchUrl(`${business.name}, ${business.address || "Abilene TX"}`),
                        "_blank",
                      )
                    }
                  >
                    Directions
                  </a>

                  {business.social && (
                    <a
                      className="directory-link"
                      href={visitUrl(business.social)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) =>
                        openTrackedBusinessLink(event, business, "visits", visitUrl(business.social), "_blank")
                      }
                    >
                      Website
                    </a>
                  )}
                  {renderOwnerBusinessActions(business)}
                </div>

                {renderLikeButton("business", business.id)}
                {renderBusinessReviews(business)}
              </article>
            ))}
          </section>
          {renderOwnerBusinessModals()}
        </div>
      </main>,
    );
  }

  if (businessServiceSections[page]) {
    const serviceSection = businessServiceSections[page];
    const serviceBusinesses = businessServiceBusinessesByPage[page] ?? [];
    const isSportsFitnessPage = page === "hotels";
    const sportsFitnessSubcategories = isSportsFitnessPage ? serviceSection.categories.slice(1) : [];
    const showServiceForm = page === "groceries" ? showGroceryForm : openBusinessServiceFormPage === page;
    const setServiceFormOpen = (isOpen) => {
      if (page === "groceries") {
        setShowGroceryForm(isOpen);
      } else {
        setOpenBusinessServiceFormPage(isOpen ? page : "");
      }
      if (!isOpen && isSportsFitnessPage) {
        setSelectedSportsFitnessSubcategory("");
      }
    };

    return withSplash(
      <main
        className={`app directory-page${page === "groceries" ? " groceries-page" : ""}${page === "shopping" ? " shopping-page" : ""}${page === "nightlife" ? " nightlife-page" : ""}${page === "eats" ? " eats-page" : ""}${page === "family" ? " family-page" : ""}${page === "hotels" ? " sports-fitness-page" : ""}${page === "dealers" ? " dealers-page" : ""}${page === "barbers" ? " barbers-page" : ""}${page === "insurance" ? " insurance-page" : ""}${page === "health" ? " health-page" : ""}${page === "schools" ? " schools-page" : ""}`}
        style={
          page === "groceries"
            ? { "--groceries-bg": `url("${appAsset("groceries-bg.png")}")` }
            : page === "shopping"
              ? { "--shopping-bg": `url("${appAsset("shopping-bg.jpg")}")` }
              : page === "nightlife"
                ? { "--nightlife-bg": `url("${appAsset("nightlife-bg.jpg")}")` }
                : page === "eats"
                  ? { "--eats-bg": `url("${appAsset("eats-bg.jpg")}")` }
                  : page === "family"
                    ? { "--family-bg": `url("${appAsset("family&kids-bg.jpg")}")` }
                    : page === "hotels"
                      ? { "--sports-fitness-bg": `url("${appAsset("sports&fitness-bg.jpg")}")` }
                      : page === "dealers"
                        ? { "--dealers-bg": `url("${appAsset("dealers-bg.png")}")` }
                        : page === "barbers"
                          ? { "--barbers-bg": `url("${appAsset("barbers-bg.png")}")` }
                          : page === "insurance"
                            ? { "--insurance-bg": `url("${appAsset("insurance-bg.png")}")` }
                            : page === "health"
                              ? { "--health-bg": `url("${appAsset("health-bg.png")}")` }
                              : page === "schools"
                                ? { "--schools-bg": `url("${appAsset("schools-bg.png")}")` }
                                : undefined
        }
      >
        <div className="directory-shell">
          <button className="back-button" onClick={page === "shopping" || page === "nightlife" || page === "eats" || page === "family" || page === "hotels" ? backToLobby : () => navigateTo("more")}>
            Back
          </button>

          <section className="directory-header" aria-labelledby={`${serviceSection.page}-title`}>
            <p className="eyebrow">{serviceSection.eyebrow}</p>
            <h1 id={`${serviceSection.page}-title`}>{serviceSection.title}</h1>
            <p className="events-intro">{serviceSection.intro}</p>
          </section>

          <button
            className="primary-button subscribe-button"
            type="button"
            onClick={() => {
              const willOpen = !showServiceForm;
              setSelectedCategory(serviceSection.category);
              if (willOpen) {
                setSelectedPlan(promotePlans[0].name);
                if (isSportsFitnessPage) {
                  setSelectedSportsFitnessSubcategory("");
                }
              }
              setBusinessSubmitted(false);
              setSubmissionStatus("");
              setServiceFormOpen(willOpen);
            }}
          >
            {showServiceForm ? serviceSection.closeButton : serviceSection.addButton}
          </button>

          {showServiceForm && (
            <>
              {isSportsFitnessPage && !selectedSportsFitnessSubcategory && (
                <section className="business-form service-subcategory-picker" aria-label="Choose a Sports & Fitness subcategory">
                  <div className="business-form-heading">
                    <p className="eyebrow">Choose category</p>
                    <h2>Sports & Fitness type</h2>
                  </div>
                  <div className="service-subcategory-grid">
                    {sportsFitnessSubcategories.map((subcategory) => (
                      <button
                        key={subcategory}
                        type="button"
                        onClick={() => {
                          setSelectedSportsFitnessSubcategory(subcategory);
                          setSelectedCategory(subcategory);
                          setSelectedPlan(promotePlans[0].name);
                          setBusinessSubmitted(false);
                          setSubmissionStatus("");
                        }}
                      >
                        {subcategory}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {(!isSportsFitnessPage || selectedSportsFitnessSubcategory) && (
                <>
              <section className="plan-grid" aria-label={`${serviceSection.title} plans`}>
                {promotePlans.map((plan) => (
                  <button
                    className={`plan-card${selectedPlan === plan.name ? " is-selected" : ""}`}
                    key={plan.name}
                    type="button"
                    onClick={() => {
                      setSelectedPlan(plan.name);
                      setBusinessSubmitted(false);
                      setSubmissionStatus("");
                    }}
                    aria-pressed={selectedPlan === plan.name}
                  >
                    <span className="plan-name">{plan.name}</span>
                    <strong>{plan.price}</strong>
                    <span className="plan-cadence">{plan.cadence}</span>
                    <span className="plan-note">{plan.note}</span>
                  </button>
                ))}
              </section>

              <form className="business-form" onSubmit={handleBusinessSubmit} noValidate>
                <input
                  type="hidden"
                  name="categoryOverride"
                  value={isSportsFitnessPage ? selectedSportsFitnessSubcategory : serviceSection.category}
                />
                <input type="hidden" name="planOverride" value={selectedPlan} />

                <div className="business-form-heading">
                  <p className="eyebrow">{selectedPlan} plan</p>
                  <h2>{isSportsFitnessPage ? selectedSportsFitnessSubcategory : serviceSection.formTitle}</h2>
                </div>

                <div className="form-grid">
                  <label className="form-field">
                    <span>Business name</span>
                    <input
                      name="businessName"
                      type="text"
                      placeholder={serviceSection.namePlaceholder}
                      required
                      onInvalid={handleRequiredInvalid}
                      onInput={handleRequiredInput}
                    />
                  </label>

                  <label className="form-field">
                    <span>Contact name</span>
                    <input
                      name="contactName"
                      type="text"
                      placeholder="Who should we contact?"
                      required
                      onInvalid={handleRequiredInvalid}
                      onInput={handleRequiredInput}
                    />
                  </label>

                  <label className="form-field">
                    <span>Email</span>
                    <input
                      name="contactEmail"
                      type="email"
                      placeholder="owner@example.com"
                      required
                      onInvalid={handleRequiredInvalid}
                      onInput={handleRequiredInput}
                    />
                  </label>

                  <label className="form-field">
                    <span>Phone</span>
                    <input
                      name="phone"
                      type="tel"
                      placeholder="(325) 555-0100"
                      required
                      onInvalid={handleRequiredInvalid}
                      onInput={handleRequiredInput}
                    />
                  </label>

                  <label className="form-field">
                    <span>Address</span>
                    <input name="address" type="text" placeholder="Street address or area" />
                  </label>

                  <label className="form-field">
                    <span>Website</span>
                    <input name="social" type="text" placeholder="Website or social link" />
                  </label>
                </div>

                <label className="form-field form-field-wide">
                  <span>Image/photo</span>
                  <input name="businessImage" type="file" accept="image/*" />
                </label>

                <label className="form-field form-field-wide">
                  <span>Description</span>
                  <textarea name="description" placeholder={serviceSection.descriptionPlaceholder} rows="4" />
                </label>

                <label className="legal-consent">
                  <input
                    name="contentRights"
                    type="checkbox"
                    required
                    onInvalid={handleRequiredInvalid}
                    onInput={handleRequiredInput}
                  />
                  <span>
                    I confirm I have permission to submit this business information and any content I provide, and I
                    authorize Abilene Vibes to display it in the app, website, social media, and promotional materials.
                  </span>
                </label>

                <p className="legal-disclaimer">
                  {serviceSection.title} submissions are saved for review and appear here after approval. Contact {contactEmail} for
                  updates or removals.
                </p>

                {paidPlanNames.has(selectedPlan) && (
                  <p className="legal-disclaimer billing-disclaimer">
                    {selectedPlan} is a monthly subscription. By continuing to checkout, you authorize Abilene Vibes
                    and Stripe to charge {selectedPlan === "Featured" ? "$19" : "$59"} today and automatically every
                    month until the subscription is canceled. Payment starts the review process; the paid placement
                    goes live after admin approval.
                  </p>
                )}

                {businessSubmitted && (
                  <p className="form-success">
                    {submissionStatus === "saved"
                      ? paidPlanNames.has(selectedPlan)
                        ? `Thanks. Your ${serviceSection.savedName} was saved. Opening secure checkout...`
                        : `Thanks. Your ${serviceSection.savedName} was saved for review.`
                      : submissionStatus === "local"
                        ? `Thanks. Your ${serviceSection.savedName} was added locally. Connect Supabase to save it permanently.`
                        : submissionStatus === "validation-error"
                          ? "Please complete business name, contact name, email, phone, and the permission checkbox."
                          : submissionStatus === "checkout"
                            ? "Opening secure checkout..."
                            : submissionStatus === "checkout-link"
                              ? "Thanks. Your payment page opened in a new tab. We will review your listing after payment."
                              : submissionStatus === "checkout-config"
                                ? "Your request was saved, but Stripe needs APP_PUBLIC_URL before checkout can open."
                                : submissionStatus === "checkout-error"
                                  ? "Your request was saved, but checkout could not open. Please contact us to finish payment."
                                  : selectedPlan === "Free"
                                    ? `Thanks. Your ${serviceSection.savedName} was saved for review.`
                                    : "Thanks. Your paid plan request was saved. Secure checkout will open for payment."}
                  </p>
                )}

                {submissionStatus === "error" && (
                  <p className="form-error">
                    We could not save your {serviceSection.savedName}. Please try again or email {contactEmail}.
                  </p>
                )}

                <button className="primary-button subscribe-button" type="submit" disabled={submissionStatus === "saving"}>
                  {submissionStatus === "saving"
                    ? "Saving..."
                    : selectedPlan === "Free"
                      ? serviceSection.addButton.replace("Add", "Post")
                      : `Continue to ${selectedPlan} Checkout`}
                </button>
              </form>
                </>
              )}
            </>
          )}

          {serviceBusinesses.length ? (
            <section className="directory-grid" aria-label={serviceSection.ariaLabel}>
              {serviceBusinesses.map((business) => (
                <article className="directory-card" key={business.id}>
                  <button
                    className="image-open-button directory-image-button"
                    type="button"
                    onClick={() => openImageViewer(businessDisplayImage(business), business.name)}
                    aria-label={`Open ${business.name} photo`}
                  >
                    <img
                      className="directory-image"
                      src={businessDisplayImage(business)}
                      alt=""
                      loading="lazy"
                    />
                  </button>
                  <span className="event-type">{business.category}</span>
                  {businessDisplayPlan(business) && (
                    <span className={`plan-badge plan-badge-${businessDisplayPlan(business).toLowerCase()}`}>
                      {businessDisplayPlan(business)}
                    </span>
                  )}
                  <h2>{business.name}</h2>
                  {business.description && <p>{business.description}</p>}
                  {business.contactName && <p>Contact: {business.contactName}</p>}
                  {business.contactEmail && <p>Email: {business.contactEmail}</p>}
                  {business.address && <p>{business.address}</p>}
                  {business.phone && <p>{business.phone}</p>}

                  <div className="directory-actions">
                    {business.phone && (
                      <a
                        className="directory-link"
                        href={`tel:${business.phone.replace(/\D/g, "")}`}
                        onClick={(event) =>
                          openTrackedBusinessLink(event, business, "calls", `tel:${business.phone.replace(/\D/g, "")}`)
                        }
                      >
                        Call
                      </a>
                    )}
                    <a
                      className="directory-link"
                      href={mapSearchUrl(`${business.name}, ${business.address || "Abilene TX"}`)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) =>
                        openTrackedBusinessLink(
                          event,
                          business,
                          "directions",
                          mapSearchUrl(`${business.name}, ${business.address || "Abilene TX"}`),
                          "_blank",
                        )
                      }
                    >
                      Directions
                    </a>
                    {business.social && (
                      <a
                        className="directory-link"
                        href={visitUrl(business.social)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) =>
                          openTrackedBusinessLink(event, business, "visits", visitUrl(business.social), "_blank")
                        }
                      >
                        Website
                      </a>
                    )}
                    {renderOwnerBusinessActions(business)}
                  </div>

                  {renderLikeButton("business", business.id)}
                  {renderBusinessReviews(business)}
                </article>
              ))}
            </section>
          ) : (
            <p className="legal-disclaimer">{serviceSection.emptyMessage}</p>
          )}
          {renderOwnerBusinessModals()}
        </div>
      </main>,
    );
  }

  if (page === "admin" && editRentalPage && editingRental) {
    const isSTR = editingRental.property_type === "Short-Term";
    return withSplash(
      <main className="app admin-page">
        <div className="admin-shell">
          <button className="back-button" onClick={() => { setEditRentalPage(false); setEditingRental(null); setAdminStatus(""); }}>
            ← Back to Rentals
          </button>
          <section className="admin-header" aria-labelledby="edit-rental-title">
            <p className="eyebrow">Admin · Rent &amp; Housing</p>
            <h1 id="edit-rental-title">Edit Rental Listing</h1>
          </section>
          <section className="admin-section" style={{ display: "grid", gap: "14px" }}>
            {[
              { label: "Title",        field: "title" },
              { label: "Address",      field: "address" },
              { label: "Contact Person", field: "contact_person" },
              { label: "Phone",        field: "phone" },
              { label: "Email",        field: "email" },
              { label: "Website URL",  field: "external_url" },
            ].map(({ label, field }) => (
              <label className="form-field" key={field}>
                <span>{label}</span>
                <input
                  type="text"
                  className="business-input"
                  value={editingRental[field] ?? ""}
                  onChange={(e) => setEditingRental((prev) => ({ ...prev, [field]: e.target.value }))}
                />
              </label>
            ))}
            <label className="form-field">
              <span>Property Type</span>
              <select
                className="business-input"
                value={editingRental.property_type ?? "Apartment"}
                onChange={(e) => setEditingRental((prev) => ({ ...prev, property_type: e.target.value }))}
              >
                {["Apartment","House","Room","Commercial","For Sale","Short-Term"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            {isSTR ? (
              <>
                {[
                  { label: "Price/Night ($)", field: "price_per_night" },
                  { label: "Price/Week ($)",  field: "price_per_week" },
                  { label: "Max Guests",      field: "max_guests" },
                  { label: "Available From",  field: "available_from" },
                  { label: "Available To",    field: "available_to" },
                ].map(({ label, field }) => (
                  <label className="form-field" key={field}>
                    <span>{label}</span>
                    <input
                      type="text"
                      className="business-input"
                      value={editingRental[field] ?? ""}
                      onChange={(e) => setEditingRental((prev) => ({ ...prev, [field]: e.target.value }))}
                    />
                  </label>
                ))}
                <label className="form-field">
                  <span>House Rules</span>
                  <textarea
                    className="business-input"
                    rows={3}
                    value={editingRental.house_rules ?? ""}
                    onChange={(e) => setEditingRental((prev) => ({ ...prev, house_rules: e.target.value }))}
                  />
                </label>
              </>
            ) : (
              <>
                {[
                  { label: "Rent/Price ($)", field: "price" },
                  { label: "Deposit ($)",    field: "deposit" },
                  { label: "Bedrooms",       field: "bedrooms" },
                  { label: "Bathrooms",      field: "bathrooms" },
                ].map(({ label, field }) => (
                  <label className="form-field" key={field}>
                    <span>{label}</span>
                    <input
                      type="text"
                      className="business-input"
                      value={editingRental[field] ?? ""}
                      onChange={(e) => setEditingRental((prev) => ({ ...prev, [field]: e.target.value }))}
                    />
                  </label>
                ))}
              </>
            )}
            <label className="form-field">
              <span>Description</span>
              <textarea
                className="business-input"
                rows={5}
                value={editingRental.description ?? ""}
                onChange={(e) => setEditingRental((prev) => ({ ...prev, description: e.target.value }))}
              />
            </label>
            <label className="form-field" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                checked={editingRental.pets_allowed ?? false}
                onChange={(e) => setEditingRental((prev) => ({ ...prev, pets_allowed: e.target.checked }))}
                style={{ width: "18px", height: "18px" }}
              />
              <span>Pets Allowed</span>
            </label>
            <label className="form-field">
              <span>Duration</span>
              <select
                className="business-input"
                value={editingRental.duration ?? "30"}
                onChange={(e) => setEditingRental((prev) => ({ ...prev, duration: e.target.value }))}
              >
                {["7","14","30","60","90"].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Plan</span>
              <select
                className="business-input"
                value={editingRental.plan ?? "free"}
                onChange={(e) => setEditingRental((prev) => ({ ...prev, plan: e.target.value }))}
              >
                <option value="free">free</option>
                <option value="featured">featured</option>
                <option value="premium">premium</option>
              </select>
            </label>
            <label className="form-field">
              <span>Status</span>
              <select
                className="business-input"
                value={editingRental.status ?? "approved"}
                onChange={(e) => setEditingRental((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="approved">approved</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
                <option value="hidden">hidden</option>
              </select>
            </label>
            <div className="form-field">
              <span>Photos</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                {(editingRental.image_data ?? []).map((src, idx) => (
                  <div key={idx} style={{ position: "relative" }}>
                    <img src={src} alt={`Photo ${idx + 1}`} style={{ width: "90px", height: "70px", objectFit: "cover", borderRadius: "8px" }} />
                    <button
                      type="button"
                      onClick={() => setEditingRental((prev) => ({ ...prev, image_data: (prev.image_data ?? []).filter((_, i) => i !== idx) }))}
                      style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", fontSize: "12px", lineHeight: "20px", padding: 0 }}
                      aria-label="Remove photo"
                    >✕</button>
                  </div>
                ))}
              </div>
              {(editingRental.image_data ?? []).length < 8 && (
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ marginTop: "8px" }}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    const remaining = 8 - (editingRental.image_data ?? []).length;
                    const toAdd = files.slice(0, remaining);
                    for (const file of toAdd) {
                      try {
                        const compressed = await optimizeGalleryImage(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => setEditingRental((prev) => {
                          const current = prev.image_data ?? [];
                          return current.length < 8 ? { ...prev, image_data: [...current, ev.target.result] } : prev;
                        });
                        reader.readAsDataURL(compressed);
                      } catch {
                        const reader = new FileReader();
                        reader.onload = (ev) => setEditingRental((prev) => {
                          const current = prev.image_data ?? [];
                          return current.length < 8 ? { ...prev, image_data: [...current, ev.target.result] } : prev;
                        });
                        reader.readAsDataURL(file);
                      }
                    }
                    e.target.value = "";
                  }}
                />
              )}
            </div>
            {adminStatus === "error" && (
              <p className="form-error">Could not save. Try again.</p>
            )}
            {adminStatus === "rental-payment-incomplete" && (
              <p className="form-error">Payment is not completed yet.</p>
            )}
            <div className="admin-rental-edit-actions" style={{ marginTop: "8px" }}>
              <button
                className="admin-rental-edit-button"
                type="button"
                onClick={handleSaveRental}
                disabled={adminStatus === "saving"}
              >
                {adminStatus === "saving" ? "SAVING..." : "Save Changes"}
              </button>
              <button
                className="admin-rental-edit-button"
                type="button"
                onClick={() => { setEditRentalPage(false); setEditingRental(null); setAdminStatus(""); }}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (page === "admin" && editJobPage && editingJob) {
    return withSplash(
      <main className="app admin-page">
        <div className="admin-shell">
          <button className="back-button" onClick={() => { setEditJobPage(false); setEditingJob(null); setAdminStatus(""); }}>
            ← Back to Jobs
          </button>
          <section className="admin-header" aria-labelledby="edit-job-title">
            <p className="eyebrow">Admin · Jobs &amp; Hiring</p>
            <h1 id="edit-job-title">Edit Job Listing</h1>
          </section>
          <section className="admin-section" style={{ display: "grid", gap: "14px" }}>
            {[
              { label: "Title",             field: "title" },
              { label: "Company",           field: "company" },
              { label: "Category",          field: "category" },
              { label: "Job Type",          field: "job_type" },
              { label: "Pay",               field: "pay_label" },
              { label: "Location",          field: "location" },
              { label: "Phone",             field: "phone" },
              { label: "Email",             field: "email" },
              { label: "App Method",        field: "app_method" },
              { label: "Apply Website URL", field: "apply_url" },
              { label: "Duration",          field: "duration" },
            ].map(({ label, field }) => (
              <label className="form-field" key={field}>
                <span>{label}</span>
                <input
                  type="text"
                  className="business-input"
                  value={editingJob[field] ?? ""}
                  onChange={(e) => setEditingJob((prev) => ({ ...prev, [field]: e.target.value }))}
                />
              </label>
            ))}
            <label className="form-field">
              <span>Plan</span>
              <select
                className="business-input"
                value={editingJob.plan ?? "free"}
                onChange={(e) => setEditingJob((prev) => ({ ...prev, plan: e.target.value }))}
              >
                <option value="free">free</option>
                <option value="featured">featured</option>
                <option value="premium">premium</option>
              </select>
            </label>
            <label className="form-field">
              <span>Status</span>
              <select
                className="business-input"
                value={editingJob.status ?? "approved"}
                onChange={(e) => setEditingJob((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="approved">approved</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
                <option value="hidden">hidden</option>
              </select>
            </label>
            <label className="form-field">
              <span>Description</span>
              <textarea
                className="business-input"
                rows={5}
                value={editingJob.description ?? ""}
                onChange={(e) => setEditingJob((prev) => ({ ...prev, description: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Requirements</span>
              <textarea
                className="business-input"
                rows={4}
                value={editingJob.requirements ?? ""}
                onChange={(e) => setEditingJob((prev) => ({ ...prev, requirements: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Job photo (replace)</span>
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try {
                  const compressed = await optimizeGalleryImage(file);
                  setEditingJob((prev) => ({ ...prev, image_data: compressed }));
                } catch {
                  const r = new FileReader(); r.onload = (ev) => setEditingJob((prev) => ({ ...prev, image_data: ev.target.result })); r.readAsDataURL(file);
                }
              }} />
              {editingJob.image_data && <img src={editingJob.image_data} alt="Job photo" style={{ maxWidth: "180px", marginTop: "8px", borderRadius: "8px" }} />}
            </label>
            <label className="form-field">
              <span>Company logo (replace)</span>
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try {
                  const compressed = await optimizeGalleryImage(file);
                  setEditingJob((prev) => ({ ...prev, logo_data: compressed }));
                } catch {
                  const r = new FileReader(); r.onload = (ev) => setEditingJob((prev) => ({ ...prev, logo_data: ev.target.result })); r.readAsDataURL(file);
                }
              }} />
              {editingJob.logo_data && <img src={editingJob.logo_data} alt="Company logo" style={{ maxWidth: "120px", marginTop: "8px", borderRadius: "8px" }} />}
            </label>
            {(adminStatus === "error" || adminStatus === "job-save-error") && (
              <p className="form-error">Could not save. Try again.</p>
            )}
            {adminStatus === "job-refresh-error" && (
              <p className="form-error">Job saved, but the Jobs list could not refresh. Please refresh Jobs.</p>
            )}
            {adminStatus === "job-payment-incomplete" && (
              <p className="form-error">Payment is not completed yet.</p>
            )}
            <div className="admin-job-edit-actions">
              <button
                className="admin-job-edit-button"
                type="button"
                onClick={handleSaveJob}
                disabled={adminStatus === "saving"}
              >
                {adminStatus === "saving" ? "SAVING..." : "Save Changes"}
              </button>
              <button
                className="admin-job-edit-button"
                type="button"
                onClick={() => { setEditJobPage(false); setEditingJob(null); setAdminStatus(""); }}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (page === "admin") {
    return withSplash(
      <main className="app admin-page">
        <div className="admin-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="admin-header" aria-labelledby="admin-title">
            <p className="eyebrow">Private</p>
            <h1 id="admin-title">Admin Panel</h1>
            <p className="events-intro">Review submitted photos and businesses before they appear in Abilene Vibes.</p>
          </section>

          {!supabase && (
            <p className="form-error">Connect Supabase before using the admin panel.</p>
          )}

          {supabase && !adminSession && (
            <form className="business-form admin-login" onSubmit={handleAdminLogin}>
              <div className="business-form-heading">
                <p className="eyebrow">Owner login</p>
                <h2>Sign in</h2>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    placeholder="Password"
                    required
                  />
                </label>
              </div>

              {adminStatus === "login-error" && <p className="form-error">Login failed. Check your email and password.</p>}
              {adminStatus === "missing-config" && <p className="form-error">Supabase is not connected.</p>}

              <button className="primary-button subscribe-button" type="submit" disabled={adminStatus === "signing-in"}>
                {adminStatus === "signing-in" ? "Signing in..." : "Open Admin"}
              </button>
            </form>
          )}

          {supabase && adminSession && (
            <>
              {renderAdminBusinessDeleteModal()}
              <div className="admin-toolbar">
                <button
                  className="directory-link"
                  type="button"
                  onClick={() => loadAdminData(adminSession, true)}
                  disabled={adminStatus === "loading"}
                >
                  {adminStatus === "loading" ? "Refreshing..." : "Refresh"}
                </button>
                <button className="directory-link" type="button" onClick={handleAdminLogout}>
                  Sign out
                </button>
              </div>

              {adminStatus === "error" && <p className="form-error">Could not update admin data. Check Supabase policies.</p>}
              {adminStatus === "loading" && <p className="form-success">Refreshing admin data...</p>}
              {adminStatus === "refreshed" && <p className="form-success">Admin data updated.</p>}
              {adminStatus === "saving" && <p className="form-success">Saving...</p>}

              <nav className="admin-tabs" aria-label="Admin categories">
                {adminTabs.map((tab) => (
                  <button
                    className={adminTab === tab.id ? "is-active" : ""}
                    type="button"
                    key={tab.id}
                    onClick={() => setAdminTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className={`admin-panel-view admin-panel-view-${adminTab}`}>
              <section className="admin-section admin-tab-events" id="admin-events" aria-labelledby="admin-event-form-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Events</p>
                  <h2 id="admin-event-form-title">Add Event</h2>
                </div>

                <form className="gallery-form" onSubmit={handleEventSubmit}>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Title</span>
                      <input name="title" type="text" placeholder="Live music, market, party..." required />
                    </label>
                    <label className="form-field">
                      <span>Place</span>
                      <input name="place" type="text" placeholder="Venue or area" required />
                    </label>
                    <label className="form-field form-field-full">
                      <span>Description</span>
                      <textarea name="description" rows={3} placeholder="What should people know about this event?" required />
                    </label>
                    <label className="form-field form-field-full">
                      <span>Event Address</span>
                      <input name="eventAddress" type="text" placeholder="202 Pine St #201, Abilene, TX 79601" required />
                    </label>
                    <label className="form-field form-field-full">
                      <span>Website URL</span>
                      <input name="websiteUrl" type="url" placeholder="Optional event website link" />
                    </label>
                    <label className="form-field form-field-full">
                      <span>Ticket URL</span>
                      <input name="ticketUrl" type="url" placeholder="Optional ticket link" />
                    </label>
                    <label className="form-field">
                      <span>Start Date</span>
                      <input name="eventDate" type="date" required />
                    </label>
                    <label className="form-field">
                      <span>End Date</span>
                      <input name="endDate" type="date" />
                    </label>
                    <label className="form-field">
                      <span>Start Time</span>
                      <input name="eventTime" type="text" placeholder="8:00 PM" required />
                    </label>
                    <label className="form-field">
                      <span>End Time</span>
                      <input name="endTime" type="text" placeholder="2:00 AM" />
                    </label>
                    <label className="form-field">
                      <span>Photo</span>
                      <input name="eventImage" type="file" accept="image/*" />
                    </label>
                  </div>

                  <button className="primary-button subscribe-button" type="submit" disabled={eventSubmissionStatus === "saving"}>
                    {eventSubmissionStatus === "saving" ? "Saving..." : "Publish Event"}
                  </button>

                  {eventSubmissionStatus && eventSubmissionStatus !== "saving" && (
                    <p className={eventSubmissionStatus === "saved" ? "form-success" : "form-error"}>
                      {eventSubmissionStatus === "saved"
                        ? "Event published."
                        : eventSubmissionStatus === "missing-config"
                          ? "Supabase is not connected."
                          : "Could not save event."}
                    </p>
                  )}
                </form>
              </section>

              <section className="admin-section admin-tab-events" aria-labelledby="admin-published-event-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Published</p>
                  <h2 id="admin-published-event-title">Events</h2>
                </div>

                {publishedEvents.length ? (
                  <div className="admin-grid">
                    {publishedEvents.map((event) => (
                      <article className="admin-card" key={event.id}>
                        <img
                          src={
                            event.image_data ||
                            event.image_url ||
                            "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80"
                          }
                          alt=""
                        />
                        <span className="event-type">{event.event_type}</span>
                        {!isPublicEventActive(event) && (
                          <span
                            className="event-type"
                            style={{
                              background: "rgba(255, 55, 55, 0.18)",
                              borderColor: "rgba(255, 75, 75, 0.85)",
                              color: "#ffd7d7",
                            }}
                          >
                            EXPIRED
                          </span>
                        )}
                        <h3>{event.title}</h3>
                        <p>{event.place}</p>
                        <p>Starts: {formatEventScheduleLine(event.event_date, event.event_time)}</p>
                        <p>Ends: {formatEventScheduleLine(event.end_date || event.event_date, event.end_time || event.event_time)}</p>
                        <div className="directory-actions admin-rental-actions">
                          <button className="directory-link" type="button" onClick={() => editEvent(event)}>
                            Edit
                          </button>
                          <label className="directory-link file-action">
                            Change Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(inputEvent) => {
                                changeEventPhoto(event.id, inputEvent.target.files?.[0]);
                                inputEvent.target.value = "";
                              }}
                            />
                          </label>
                          <button className="directory-link" type="button" onClick={() => unpublishEvent(event.id)}>
                            Hide
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteEvent(event.id)}>
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No published admin events yet.</p>
                )}
              </section>

              <section className="admin-section admin-tab-events" aria-labelledby="admin-hidden-event-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Hidden</p>
                  <h2 id="admin-hidden-event-title">Events</h2>
                </div>

                {hiddenEvents.length || visibleStaticEvents.length || hiddenStaticEvents.length ? (
                  <div className="admin-grid">
                    {hiddenEvents.map((event) => (
                      <article className="admin-card" key={event.id}>
                        <span className="event-type">Hidden</span>
                        {!isPublicEventActive(event) && (
                          <span
                            className="event-type"
                            style={{
                              background: "rgba(255, 55, 55, 0.18)",
                              borderColor: "rgba(255, 75, 75, 0.85)",
                              color: "#ffd7d7",
                            }}
                          >
                            EXPIRED
                          </span>
                        )}
                        <h3>{event.title}</h3>
                        <p>{event.place}</p>
                        <p>Starts: {formatEventScheduleLine(event.event_date, event.event_time)}</p>
                        <p>Ends: {formatEventScheduleLine(event.end_date || event.event_date, event.end_time || event.event_time)}</p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => editEvent(event)}>
                            Edit
                          </button>
                          <label className="directory-link file-action">
                            Change Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(inputEvent) => {
                                changeEventPhoto(event.id, inputEvent.target.files?.[0]);
                                inputEvent.target.value = "";
                              }}
                            />
                          </label>
                          <button className="directory-link" type="button" onClick={() => restoreEvent(event.id)}>
                            Restore
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteEvent(event.id)}>
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                    {visibleStaticEvents.map((event) => (
                      <article className="admin-card" key={staticEventKey(event)}>
                        <span className="event-type">Starter visible</span>
                        <h3>{event.title}</h3>
                        <p>{event.place}</p>
                        <p>{event.date}</p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => editStaticEvent(event)}>
                            Edit
                          </button>
                          <label className="directory-link file-action">
                            Change Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(inputEvent) => {
                                changeStaticEventPhoto(event, inputEvent.target.files?.[0]);
                                inputEvent.target.value = "";
                              }}
                            />
                          </label>
                          <button className="directory-link" type="button" onClick={() => hideStaticEvent(event)}>
                            Hide
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteStaticItem(staticEventKey(event), event.title)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                    {hiddenStaticEvents.map((event) => (
                      <article className="admin-card" key={staticEventKey(event)}>
                        <span className="event-type">Starter hidden</span>
                        <h3>{event.title}</h3>
                        <p>{event.place}</p>
                        <p>{event.date}</p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => restoreStaticEvent(event)}>
                            Restore
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteStaticItem(staticEventKey(event), event.title)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No events to manage.</p>
                )}
              </section>
              <section className="admin-section admin-tab-gallery" id="admin-photos" aria-labelledby="admin-gallery-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Pending</p>
                  <h2 id="admin-gallery-title">Gallery Photos</h2>
                </div>

                {pendingGalleryPhotos.length ? (
                  <div className="admin-grid">
                    {pendingGalleryPhotos.map((photo) => (
                      <article className="admin-card" key={photo.id}>
                        <img src={photo.image_data} alt="" />
                        <span className="event-type">{new Date(photo.created_at).toLocaleDateString()}</span>
                        <h3>{photo.title}</h3>
                        <p>By {photo.contributor_name}</p>
                        <p className="admin-metric">Likes: <strong>{likeCountFor("photo", photo.id)}</strong></p>
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => moderateGalleryPhoto(photo, "approved")}
                            disabled={adminGalleryActionKey.startsWith(`${photo.id}:`)}
                          >
                            {adminGalleryActionKey === `${photo.id}:approve` ? "Approving..." : "Approve"}
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => moderateGalleryPhoto(photo, "rejected")}
                            disabled={adminGalleryActionKey.startsWith(`${photo.id}:`)}
                          >
                            {adminGalleryActionKey === `${photo.id}:reject` ? "Rejecting..." : "Reject"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No pending gallery photos.</p>
                )}
              </section>

              <section className="admin-section admin-tab-businesses" id="admin-businesses" aria-labelledby="admin-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Pending</p>
                  <h2 id="admin-business-title">Businesses</h2>
                </div>

                {pendingBusinesses.length ? (
                  <div className="admin-grid">
                    {pendingBusinesses.map((business) => (
                      <article className="admin-card" key={business.id}>
                        <span className="event-type">{business.plan} - {business.payment_status}</span>
                        {business.placement_source === "comp" && <span className="event-type">Comp promo</span>}
                        {business.placement_expires_at && (
                          <p>Promo expires: {new Date(business.placement_expires_at).toLocaleDateString()}</p>
                        )}
                        {business.image_data && <img src={business.image_data} alt="" />}
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        {business.contact_email && <p>Email: {business.contact_email}</p>}
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          {renderBusinessPlanButtons(business, { showCategoryPhoto: true })}
                          <div className="admin-business-action-group">
                            <span className="admin-business-action-label">Publishing</span>
                            <div className="admin-business-action-buttons">
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => moderateBusiness(business, "approved")}
                                disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}
                              >
                                {adminBusinessActionKey === `${business.id}:approve` ? "Approving..." : "Approve"}
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => moderateBusiness(business, "rejected")}
                                disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}
                              >
                                {adminBusinessActionKey === `${business.id}:reject` ? "Rejecting..." : "Reject"}
                              </button>
                              <button
                                className="directory-link danger-link"
                                type="button"
                                onClick={() => { setDeletingAdminBusiness({ ...business }); setAdminStatus(""); }}
                                disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}
                              >
                                {adminBusinessActionKey === `${business.id}:delete` ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No pending businesses.</p>
                )}
              </section>

              <section className="admin-section admin-tab-reviews" id="admin-reviews" aria-labelledby="admin-review-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Pending</p>
                  <h2 id="admin-review-title">Reviews</h2>
                </div>

                {pendingReviews.length ? (
                  <div className="admin-grid">
                    {pendingReviews.map((review) => (
                      <article className="admin-card" key={review.id}>
                        <span className="event-type">{review.rating} stars</span>
                        <h3>{review.business_name}</h3>
                        <p>By {review.reviewer_name}</p>
                        <p>{review.comment}</p>
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => moderateItem("business_reviews", review.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => moderateItem("business_reviews", review.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No pending reviews.</p>
                )}
              </section>

              <section className="admin-section admin-tab-payments" id="admin-payments" aria-labelledby="admin-payment-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Stripe</p>
                  <h2 id="admin-payment-title">Payments</h2>
                </div>

                <div className="payment-summary-grid">
                  <span>Total <strong>{paymentSummary.total}</strong></span>
                  <span>Paid <strong>{paymentSummary.activePaid ?? 0}</strong></span>
                  <span>Checkout <strong>{paymentSummary.checkout_started ?? 0}</strong></span>
                  <span>Pending <strong>{paymentSummary.pending ?? 0}</strong></span>
                  <span>Canceling <strong>{paymentSummary.cancel_pending ?? 0}</strong></span>
                  <span>Free promos <strong>{promoBusinesses.length}</strong></span>
                  <span>Total Net Earned <strong>{formatPaymentAmount(paymentFinancialSummary.net, paymentSummaryCurrency)}</strong></span>
                  <span>Total Gross <strong>{formatPaymentAmount(paymentFinancialSummary.gross, paymentSummaryCurrency)}</strong></span>
                  <span>Total Stripe Fees <strong>{formatPaymentAmount(paymentFinancialSummary.fees, paymentSummaryCurrency)}</strong></span>
                </div>

                {paymentRecords.length ? (
                  <>
                    <h3>Earnings by Business</h3>
                    <div className="admin-grid">
                      {paymentEarningsByBusiness.map((businessEarnings) => (
                        <article className="admin-card" key={`payment-earnings-${businessEarnings.id}`}>
                          <h3>{businessEarnings.name}</h3>
                          <p>Gross: {formatPaymentAmount(businessEarnings.gross, businessEarnings.currency)}</p>
                          <p>Stripe Fees: {formatPaymentAmount(businessEarnings.fees, businessEarnings.currency)}</p>
                          <p>Net Earned: {formatPaymentAmount(businessEarnings.net, businessEarnings.currency)}</p>
                          <p>Payments: {businessEarnings.payments}</p>
                        </article>
                      ))}
                    </div>

                    <div className="admin-grid">
                      {paymentRecords.map((record) => {
                        const business = paymentBusinessesById[record.business_submission_id];

                        return (
                          <article className="admin-card" key={`payment-record-${record.id}`}>
                            <span className={`event-type payment-status payment-${record.status ?? "paid"}`}>
                              {record.status ?? "paid"}
                            </span>
                            <h3>{business?.business_name ?? "Stripe payment"}</h3>
                            {business?.plan && <p>{business.plan} plan</p>}
                            <p>Gross Amount: {formatPaymentAmount(record.gross_amount, record.currency)}</p>
                            <p>Stripe Fee: {formatPaymentAmount(record.stripe_fee, record.currency)}</p>
                            <p>Net Amount: {formatPaymentAmount(record.net_amount, record.currency)}</p>
                            <p>Currency: {(record.currency ?? "usd").toUpperCase()}</p>
                            <p>Payment Date: {record.paid_at ? new Date(record.paid_at).toLocaleDateString() : "Not available"}</p>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="legal-disclaimer">No payment details available yet.</p>
                )}

                {paymentBusinesses.length ? (
                  <div className="admin-grid">
                    {paymentBusinesses.map((business) => {
                      const paymentRecord = paymentRecordsByBusiness[business.id];
                      const expirationDate = business.placement_expires_at
                        ? new Date(business.placement_expires_at).toLocaleDateString()
                        : "Not set";
                      const promotionStatus = businessPromotionStatus(business);

                      return (
                        <article className="admin-card" key={`payment-${business.id}`}>
                          <span className={`event-type payment-status payment-${business.payment_status}`}>
                            {business.payment_status}
                          </span>
                          <h3>{business.business_name}</h3>
                          <p>Plan: {business.plan}</p>
                          <p>Payment Status: {business.payment_status}</p>
                          <p>Promotion Status: {promotionStatus}</p>
                          <p>Expiration Date: {expirationDate}</p>
                          <p>Status: {business.status}</p>
                          {business.contact_email && <p>Email: {business.contact_email}</p>}
                          <p>{new Date(business.created_at).toLocaleDateString()}</p>
                          {paymentRecord ? (
                            <>
                              <p>Gross Amount: {formatPaymentAmount(paymentRecord.gross_amount, paymentRecord.currency)}</p>
                              <p>Stripe Fee: {formatPaymentAmount(paymentRecord.stripe_fee, paymentRecord.currency)}</p>
                              <p>Net Amount: {formatPaymentAmount(paymentRecord.net_amount, paymentRecord.currency)}</p>
                              <p>Payment Date: {paymentRecord.paid_at ? new Date(paymentRecord.paid_at).toLocaleDateString() : "Not available"}</p>
                            </>
                          ) : (
                            <p>Payment amounts: not recorded yet</p>
                          )}
                          <div className="directory-actions">
                            {renderBusinessPlanButtons(business)}
                            <div className="admin-business-action-group">
                              <span className="admin-business-action-label">Publishing</span>
                              <div className="admin-business-action-buttons">
                                <button
                                  className="directory-link"
                                  type="button"
                                  onClick={() => moderateBusiness(business, "approved")}
                                  disabled={business.status === "approved" || adminBusinessActionKey.startsWith(`${business.id}:`)}
                                >
                                  {adminBusinessActionKey === `${business.id}:approve` ? "Approving..." : "Approve"}
                                </button>
                                <button
                                  className="directory-link danger-link"
                                  type="button"
                                  onClick={() => deleteBusiness(business.id)}
                                  disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}
                                >
                                  {adminBusinessActionKey === `${business.id}:delete` ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No paid plan activity yet.</p>
                )}

                {promoBusinesses.length ? (
                  <>
                    <div className="business-form-heading">
                      <p className="eyebrow">Limited time</p>
                      <h2>Free Promos</h2>
                    </div>
                    <div className="admin-grid">
                      {promoBusinesses.map((business) => (
                        <article className="admin-card" key={`promo-${business.id}`}>
                          <span className="event-type payment-status payment-comp">Comp promo</span>
                          <h3>{business.business_name}</h3>
                          <p>{business.plan} plan</p>
                          <p>Status: {business.status}</p>
                          {business.contact_email && <p>Email: {business.contact_email}</p>}
                          {business.placement_expires_at && (
                            <p>Expires: {new Date(business.placement_expires_at).toLocaleDateString()}</p>
                          )}
                          <div className="directory-actions">
                            {renderBusinessPlanButtons(business)}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </section>

              {/* ── Jobs & Hiring admin section ── */}
              <section className="admin-section admin-tab-jobs" id="admin-jobs" aria-labelledby="admin-jobs-title">
                <div className="business-form-heading">
                  <p className="eyebrow">All listings</p>
                  <h2 id="admin-jobs-title">Jobs &amp; Hiring</h2>
                </div>
                {adminStatus === "job-payment-incomplete" && (
                  <p className="form-error">Payment is not completed yet.</p>
                )}

                {adminJobListings.length ? (
                  <div className="admin-grid">
                    {adminJobListings.map((job) => {
                      const jobPlan = String(job.plan ?? "free").toLowerCase();
                      const jobPaymentStatus = String(job.payment_status ?? "unknown").toLowerCase();
                      const isJobCompPromo = ["featured", "premium"].includes(jobPlan) && jobPaymentStatus === "not_required";
                      const approvingJob = adminJobActionKey === `${job.id}:status:approved`;
                      const deletingJob = adminJobActionKey === `${job.id}:delete`;
                      const isJobBusy = adminJobActionKey.startsWith(`${job.id}:`);

                      return (
                      <article className="admin-card" key={job.id}>
                        <span className="event-type">{job.plan} — {job.status}</span>
                        <span className={`event-type payment-status payment-${job.payment_status ?? "unknown"}`}>
                          Payment: {job.payment_status ?? "unknown"}
                        </span>
                        {isJobCompPromo && <span className="event-type payment-status payment-comp">Comp promo</span>}
                        <h3>{job.title}</h3>
                        <p>{job.company}</p>
                        <p>
                          Status: {job.status ?? "pending"} · Plan: {job.plan ?? "free"} · Payment: {job.payment_status ?? "unknown"}
                        </p>
                        {job.category && <p>Category: {job.category}</p>}
                        {job.job_type && <p>Type: {job.job_type}</p>}
                        {job.pay_label && <p>Pay: {job.pay_label}</p>}
                        {job.location && <p>Location: {job.location}</p>}
                        {job.contact_person && <p>Contact Person: {job.contact_person}</p>}
                        {job.phone && <p>Phone: {job.phone}</p>}
                        {job.email && <p>Email: {job.email}</p>}
                        {job.app_method && <p>Apply via: {job.app_method}</p>}
                        {job.duration && <p>Duration: {job.duration}</p>}
                        <p style={{ fontWeight: 900, color: "#fbbf24", margin: "10px 0 6px" }}>
                          Payment: {job.payment_status ?? "unknown"}
                        </p>
                        {job.description && <p style={{ fontSize: "0.85em", opacity: 0.8 }}>{job.description.slice(0, 120)}{job.description.length > 120 ? "…" : ""}</p>}
                        <p style={{ fontSize: "0.8em", opacity: 0.6 }}>
                          Posted: {new Date(job.created_at).toLocaleDateString()}
                          {job.expires_at ? ` · Expires: ${new Date(job.expires_at).toLocaleDateString()}` : ""}
                        </p>
                        <div className="directory-actions">
                          {job.status === "pending" && (
                            <>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleApproveJob(job)}
                                disabled={isJobBusy}
                              >
                                {approvingJob ? "APPROVING..." : "Approve"}
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => setJobPaymentPlan(job, job.plan ?? "free", "rejected", job.payment_status ?? "not_required", job.expires_at ?? null)}
                                disabled={isJobBusy}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {job.status === "approved" && (
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => setJobPaymentPlan(job, job.plan ?? "free", "hidden", job.payment_status ?? "not_required", job.expires_at ?? null)}
                              disabled={isJobBusy}
                            >
                              Hide / Unpublish
                            </button>
                          )}
                          {(job.status === "hidden" || job.status === "rejected") && (
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => handleApproveJob(job)}
                              disabled={isJobBusy}
                            >
                              {approvingJob ? "APPROVING..." : "Show / Restore"}
                            </button>
                          )}
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => { setEditingJob({ ...job }); setEditJobPage(true); }}
                            disabled={isJobBusy}
                          >
                            Edit
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => setPaidJobPlacement(job, "free")}
                            disabled={isJobBusy || (jobPlan === "free" && jobPaymentStatus === "not_required")}
                          >
                            Plan Free
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => compJobPlacement(job, "featured")}
                            disabled={isJobBusy || (jobPlan === "featured" && jobPaymentStatus === "not_required")}
                          >
                            Free Promo Featured
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => compJobPlacement(job, "premium")}
                            disabled={isJobBusy || (jobPlan === "premium" && jobPaymentStatus === "not_required")}
                          >
                            Free Promo Premium
                          </button>
                          {isJobCompPromo && (
                            <button
                              className="directory-link danger-link"
                              type="button"
                              onClick={() => clearCompJobPlacement(job)}
                              disabled={isJobBusy}
                            >
                              End Promo
                            </button>
                          )}
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => handleDeleteJob(job.id)}
                            disabled={isJobBusy}
                          >
                            {deletingJob ? "DELETING..." : "Delete"}
                          </button>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No job listings yet.</p>
                )}
              </section>

              {/* ── Marketplace admin section ── */}
              <section className="admin-section admin-tab-marketplace" id="admin-marketplace" aria-labelledby="admin-marketplace-title">
                <div className="business-form-heading">
                  <p className="eyebrow">All listings</p>
                  <h2 id="admin-marketplace-title">Marketplace</h2>
                </div>
                <div className="jobs-filter-bar marketplace-admin-filter-bar" aria-label="Marketplace status filters">
                  {[
                    ["all", "All"],
                    ["pending", "Pending"],
                    ["active", "Active"],
                    ["hidden", "Hidden"],
                    ["sold", "Sold"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={marketplaceAdminStatusFilter === value ? "is-active" : ""}
                      onClick={() => setMarketplaceAdminStatusFilter(value)}
                    >
                      {label} ({adminMarketplaceCounts[value] ?? 0})
                    </button>
                  ))}
                </div>
                {marketplaceAdminStatusFilter === "pending" && (
                  <div className="business-form-heading">
                    <p className="eyebrow">Manual review</p>
                    <h2>Pending</h2>
                  </div>
                )}
                {adminStatus === "marketplace-approved" && (
                  <p className="form-success">Marketplace listing approved and now eligible for public display.</p>
                )}
                {adminStatus === "marketplace-rejected" && (
                  <p className="form-success">Marketplace listing rejected and kept out of public Marketplace.</p>
                )}

                {/* Edit modal (reuses editingListing + handleEditListingSubmit) */}
                {editingListing && adminSession && (
                  <div className="admin-modal-backdrop">
                    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-marketplace-edit-title">
                      <div className="business-form-heading">
                        <p className="eyebrow">Edit</p>
                        <h2 id="admin-marketplace-edit-title">Marketplace Listing</h2>
                      </div>
                      <form onSubmit={handleEditListingSubmit}>
                        <div className="form-grid">
                          {[
                            { label: "Title",       name: "title",       defaultValue: editingListing.title ?? "" },
                            { label: "Price",       name: "price",       defaultValue: editingListing.price ?? "" },
                            { label: "Location",    name: "location",    defaultValue: editingListing.location ?? "" },
                            { label: "Contact",     name: "contact",     defaultValue: editingListing.contact ?? "" },
                          ].map(({ label, name, defaultValue }) => (
                            <label className="form-field" key={name}>
                              <span>{label}</span>
                              <input type="text" name={name} defaultValue={defaultValue} />
                            </label>
                          ))}
                          <label className="form-field">
                            <span>Category</span>
                            <select name="category" defaultValue={editingListing.category ?? ""}>
                              {marketplaceCategories.map((c) => (
                                <option key={c.label} value={c.label}>{c.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="form-field">
                            <span>Status</span>
                            <select
                              value={editingListing.status ?? "active"}
                              onChange={(e) => setEditingListing((prev) => ({ ...prev, status: e.target.value }))}
                              name="_status_ui"
                            >
                              {["active", "sold", "expired", "hidden", "deleted"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                          <label className="form-field form-field-full">
                            <span>Description</span>
                            <textarea rows={4} name="description" defaultValue={editingListing.description ?? ""} />
                          </label>
                          <label className="form-field form-field-full">
                            <span>Add photos ({5 - editListingPhotos.length} remaining)</span>
                            <input type="file" name="newPhotos" accept="image/*" multiple disabled={editListingPhotos.length >= 5} />
                          </label>
                        </div>
                        <div className="directory-actions marketplace-admin-modal-actions">
                          <button
                            className="directory-link marketplace-admin-action"
                            type="submit"
                            disabled={editDeleteStatus === "saving"}
                          >
                            {editDeleteStatus === "saving" ? "Saving…" : "Save Changes"}
                          </button>
                          {editingListing.status !== editingListing._origStatus && (
                            <button
                              className="directory-link marketplace-admin-action"
                              type="button"
                              onClick={() => setListingStatus(editingListing, editingListing.status)}
                              disabled={editDeleteStatus === "saving" || Boolean(marketplaceActionKey)}
                            >
                              {marketplaceActionKey ? "Updating..." : "Change Status Only"}
                            </button>
                          )}
                          <button
                            className="directory-link marketplace-admin-action"
                            type="button"
                            onClick={() => setEditingListing(null)}
                            disabled={editDeleteStatus === "saving" || Boolean(marketplaceActionKey)}
                          >
                            Cancel
                          </button>
                        </div>
                        {editDeleteStatus === "error" && <p className="form-error">Error saving. Try again.</p>}
                      </form>
                    </section>
                  </div>
                )}

                {adminMarketplaceVisibleListings.length ? (
                  <div className="admin-grid">
                    {adminMarketplaceVisibleListings.map((listing) => (
                      <article className="admin-card" key={listing.id}>
                        {parseListingImages(listing.image_data)[0] && (
                          <img
                            src={parseListingImages(listing.image_data)[0]}
                            alt={listing.title}
                            style={{ width: "100%", maxHeight: "140px", objectFit: "cover", borderRadius: "8px", marginBottom: "8px" }}
                          />
                        )}
                        <span className={`event-type marketplace-admin-status marketplace-status-${marketplaceAdminDisplayStatus(listing)}`}>
                          {marketplaceAdminDisplayStatus(listing).toUpperCase()}
                        </span>
                        <h3>{listing.title}</h3>
                        {listing.price && <p>Price: {listing.price}</p>}
                        {listing.category && <p>Category: {listing.category}</p>}
                        {listing.location && <p>Location: {listing.location}</p>}
                        {listing.contact && <p>Contact: {listing.contact}</p>}
                        {listing.owner_user_id && <p style={{ fontSize: "0.8em", opacity: 0.6 }}>Owner: {listing.owner_user_id}</p>}
                        <p style={{ fontSize: "0.8em", opacity: 0.75 }}>
                          Moderation Status: <strong>{getMarketplaceModerationStatus(listing)}</strong>
                        </p>
                        {(listing.moderation_reason || listing.moderationReason) && (
                          <p style={{ fontSize: "0.8em", opacity: 0.75 }}>
                            Moderation Reason: {listing.moderation_reason ?? listing.moderationReason}
                          </p>
                        )}
                        {(listing.moderation_score !== null && listing.moderation_score !== undefined) && (
                          <p style={{ fontSize: "0.8em", opacity: 0.75 }}>Moderation Score: {listing.moderation_score}</p>
                        )}
                        {(listing.moderation_model || listing.moderationModel) && (
                          <p style={{ fontSize: "0.8em", opacity: 0.75 }}>
                            Moderation Model: {listing.moderation_model ?? listing.moderationModel}
                          </p>
                        )}
                        {listing.description && (
                          <p style={{ fontSize: "0.85em", opacity: 0.8 }}>
                            {listing.description.slice(0, 120)}{listing.description.length > 120 ? "…" : ""}
                          </p>
                        )}
                        <p style={{ fontSize: "0.8em", opacity: 0.6 }}>
                          Posted: {new Date(listing.created_at).toLocaleDateString()}
                          {listing.expires_at ? ` · Expires: ${new Date(listing.expires_at).toLocaleDateString()}` : ""}
                          {listing.sold_at ? ` · Sold: ${new Date(listing.sold_at).toLocaleDateString()}` : ""}
                        </p>
                        <div className="directory-actions marketplace-admin-actions">
                          {getMarketplaceModerationStatus(listing) === "pending" && (
                            <>
                              <button
                                className="directory-link marketplace-admin-action"
                                type="button"
                                onClick={() => setMarketplaceModerationStatus(listing, "approved")}
                                disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}
                              >
                                {marketplaceActionKey === `${listing.id}:moderation:approved` ? "APPROVING..." : "Approve"}
                              </button>
                              <button
                                className="directory-link marketplace-admin-action"
                                type="button"
                                onClick={() => setMarketplaceModerationStatus(listing, "rejected")}
                                disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}
                              >
                                {marketplaceActionKey === `${listing.id}:moderation:rejected` ? "REJECTING..." : "Reject"}
                              </button>
                            </>
                          )}
                          <button
                            className="directory-link marketplace-admin-action"
                            type="button"
                            onClick={(e) => openOwnerEditListing(e, { ...mapListingFromDb(listing), _origStatus: listing.status })}
                            disabled={Boolean(marketplaceActionKey)}
                          >
                            Edit
                          </button>
                          {listing.status !== "sold" ? (
                            <button
                              className="directory-link marketplace-admin-action"
                              type="button"
                              onClick={() => setListingStatus(mapListingFromDb(listing), "sold")}
                              disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}
                            >
                              {marketplaceActionKey === `${listing.id}:sold` ? "Updating..." : "Mark Sold"}
                            </button>
                          ) : (
                            <button
                              className="directory-link marketplace-admin-action"
                              type="button"
                              onClick={() => setListingStatus(mapListingFromDb(listing), "active")}
                              disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}
                            >
                              {marketplaceActionKey === `${listing.id}:active` ? "Updating..." : "Mark Available"}
                            </button>
                          )}
                          {listing.status === "hidden" ? (
                            <button
                              className="directory-link marketplace-admin-action"
                              type="button"
                              onClick={() => setListingStatus(mapListingFromDb(listing), "active")}
                              disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}
                            >
                              {marketplaceActionKey === `${listing.id}:active` ? "Updating..." : "Show"}
                            </button>
                          ) : listing.status === "active" ? (
                            <button
                              className="directory-link marketplace-admin-action"
                              type="button"
                              onClick={() => setListingStatus(mapListingFromDb(listing), "hidden")}
                              disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}
                            >
                              {marketplaceActionKey === `${listing.id}:hidden` ? "Updating..." : "Hide"}
                            </button>
                          ) : null}
                          <button
                            className="directory-link danger-link marketplace-admin-action"
                            type="button"
                            onClick={() => setListingStatus(mapListingFromDb(listing), "deleted")}
                            disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}
                          >
                            {marketplaceActionKey === `${listing.id}:deleted` ? "Updating..." : "Delete"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No marketplace listings for this filter.</p>
                )}
              </section>

              <section className="admin-section admin-tab-rentals" aria-labelledby="admin-rentals-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Rent &amp; Housing</p>
                  <h2 id="admin-rentals-title">Rental Listings</h2>
                </div>
                <div className="jobs-filter-bar" aria-label="Rental status filters">
                  {[
                    ["all", "All"],
                    ["pending", "Pending"],
                    ["approved", "Approved"],
                    ["hidden", "Hidden"],
                    ["rejected", "Rejected"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`jobs-filter-chip${adminRentalStatusFilter === value ? " is-active" : ""}`}
                      type="button"
                      onClick={() => setAdminRentalStatusFilter(value)}
                      aria-pressed={adminRentalStatusFilter === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {adminStatus === "rental-payment-incomplete" && (
                  <p className="form-error">Payment is not completed yet.</p>
                )}
                {filteredAdminRentalListings.length > 0 ? (
                  <div className="admin-cards-grid">
                    {filteredAdminRentalListings.map((r) => {
                      const rentalStatus = r.status ?? "approved";
                      const rentalPlan = String(r.plan ?? "free").toLowerCase();
                      const rentalPaymentStatus = String(r.payment_status ?? "unknown").toLowerCase();
                      const requestedRentalPlan = r.requested_plan
                        ? String(r.requested_plan).charAt(0).toUpperCase() + String(r.requested_plan).slice(1).toLowerCase()
                        : "";
                      const rentalPlacementSource = String(r.placement_source ?? "").toLowerCase();
                      const isRentalCompPromo = ["featured", "premium"].includes(rentalPlan) && rentalPlacementSource === "comp";
                      const approvingRental = adminRentalActionKey === `${r.id}:status:approved`;
                      const rejectingRental = adminRentalActionKey === `${r.id}:status:rejected`;
                      const hidingRental = adminRentalActionKey === `${r.id}:status:hidden`;
                      const settingFreeRental = adminRentalActionKey === `${r.id}:plan:free`;
                      const settingPromoFeaturedRental = adminRentalActionKey === `${r.id}:promo:featured`;
                      const settingPromoPremiumRental = adminRentalActionKey === `${r.id}:promo:premium`;
                      const endingPromoRental = adminRentalActionKey === `${r.id}:promo:end`;
                      const cancelingRentalSubscription = adminRentalActionKey === `${r.id}:cancel-subscription`;
                      const deletingRental = adminRentalActionKey === `${r.id}:delete`;
                      const isRentalBusy = adminRentalActionKey.startsWith(`${r.id}:`);
                      const canCancelRentalSubscription =
                        r.stripe_subscription_id &&
                        rentalPlacementSource === "stripe" &&
                        ["paid", "checkout_started", "cancel_pending"].includes(rentalPaymentStatus);

                      return (
                      <article key={r.id} className="admin-card">
                        {r.image_data?.[0] && (
                          <img src={r.image_data[0]} alt={r.title} className="admin-card-img" />
                        )}
                        <div className="admin-card-body">
                          <p className="admin-card-type">{r.property_type ?? "Rental"}</p>
                          <p className="admin-card-title">{r.title}</p>
                          <p className="admin-card-meta">{r.address}</p>
                          {r.contact_person && <p className="admin-card-meta">Contact Person: {r.contact_person}</p>}
                          {r.price && <p className="admin-card-meta">${r.price}/mo</p>}
                          {r.price_per_night && <p className="admin-card-meta">${r.price_per_night}/night</p>}
                          <p className="admin-card-meta">
                            Status: <strong>{rentalStatus}</strong> - Plan: <strong>{rentalPlan}</strong> - Payment: <strong>{r.payment_status ?? "unknown"}</strong>
                          </p>
                          {isRentalCompPromo && <span className="event-type payment-status payment-comp">Comp promo</span>}
                          {requestedRentalPlan && (
                            <p className="admin-card-meta">
                              Requested plan: <strong>{requestedRentalPlan}</strong>
                            </p>
                          )}
                          {rentalStatus === "pending" && (
                            <p className="admin-card-meta">
                              Description:<br />{r.description}
                            </p>
                          )}
                          <p className="admin-card-meta">
                            Posted: {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                            {r.expires_at ? ` · Expires: ${new Date(r.expires_at).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                        <div className="directory-actions">
                          {rentalStatus === "pending" && (
                            <>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleApproveRental(r)}
                                disabled={isRentalBusy}
                              >
                                {approvingRental ? "Approving..." : "Approve"}
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleSetRentalStatus(r, "rejected")}
                                disabled={isRentalBusy}
                              >
                                {rejectingRental ? "Updating..." : "Reject"}
                              </button>
                            </>
                          )}
                          {rentalStatus === "approved" && (
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => handleToggleRentalStatus(r)}
                              disabled={isRentalBusy}
                            >
                              {hidingRental ? "Updating..." : "Hide / Unpublish"}
                            </button>
                          )}
                          {(rentalStatus === "hidden" || rentalStatus === "rejected") && (
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => handleApproveRental(r)}
                              disabled={isRentalBusy}
                            >
                              {approvingRental ? "Approving..." : "Show / Restore"}
                            </button>
                          )}
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => { setEditingRental({ ...r }); setEditRentalPage(true); setAdminStatus(""); }}
                          >
                            Edit
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => setRentalFreePlan(r)}
                            disabled={isRentalBusy || (rentalPlan === "free" && rentalPaymentStatus === "not_required" && !r.placement_source && !r.placement_expires_at)}
                          >
                            {settingFreeRental ? "Updating..." : "Plan Free"}
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => compRentalPlacement(r, "featured")}
                            disabled={isRentalBusy || (rentalPlan === "featured" && rentalPlacementSource === "comp")}
                          >
                            {settingPromoFeaturedRental ? "Updating..." : "Free Promo Featured"}
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => compRentalPlacement(r, "premium")}
                            disabled={isRentalBusy || (rentalPlan === "premium" && rentalPlacementSource === "comp")}
                          >
                            {settingPromoPremiumRental ? "Updating..." : "Free Promo Premium"}
                          </button>
                          {isRentalCompPromo && (
                            <button
                              className="directory-link danger-link"
                              type="button"
                              onClick={() => clearCompRentalPlacement(r)}
                              disabled={isRentalBusy}
                            >
                              {endingPromoRental ? "Updating..." : "End Promo"}
                            </button>
                          )}
                          {canCancelRentalSubscription && (
                            <button
                              className="directory-link danger-link"
                              type="button"
                              onClick={() => cancelRentalSubscription(r)}
                              disabled={isRentalBusy}
                            >
                              {cancelingRentalSubscription ? "Cancelling..." : "Cancel Subscription"}
                            </button>
                          )}
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => handleDeleteRental(r.id)}
                            disabled={isRentalBusy}
                          >
                            {deletingRental ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No rental listings found.</p>
                )}
              </section>

              <section className="admin-section admin-tab-analytics" id="admin-analytics" aria-labelledby="admin-report-title">
                <div className="business-form-heading">
                  <p className="eyebrow">This month</p>
                  <h2 id="admin-report-title">Business Report</h2>
                </div>

                {businessReports.length ? (
                  <div className="admin-grid">
                    {businessReports.map((report) => (
                      <article className="admin-card" key={report.businessId}>
                        <span className="event-type">Monthly insights</span>
                        <h3>{report.businessName}</h3>
                        <div className="report-grid">
                          <span>Likes <strong>{report.likes}</strong></span>
                          <span>Reviews <strong>{report.reviews}</strong></span>
                          <span>Rating <strong>{report.averageRating}</strong></span>
                          <span>Calls <strong>{report.calls}</strong></span>
                          <span>Directions <strong>{report.directions}</strong></span>
                          <span>Visits <strong>{report.visits}</strong></span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No business activity this month yet.</p>
                )}
              </section>

              <section className="admin-section admin-tab-analytics" aria-labelledby="admin-click-report-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Most clicked</p>
                  <h2 id="admin-click-report-title">Top Clicks</h2>
                </div>

                {itemReports.length ? (
                  <div className="click-report-columns">
                    {[
                      { title: "Lobby", reports: lobbyClickReports },
                      { title: "Service", reports: serviceClickReports },
                    ].map((group) => (
                      <div className="click-report-column" key={group.title}>
                        <div className="click-report-column-heading">
                          <span className="event-type">{group.title}</span>
                          <strong>{group.reports.reduce((total, report) => total + report.clicks, 0)}</strong>
                        </div>

                        {group.reports.length ? (
                          <div className="click-report-list">
                            {group.reports.slice(0, 8).map((report) => (
                              <article className="click-report-card" key={report.itemKey}>
                                <h3>{report.itemName}</h3>
                                <span>Clicks <strong>{report.clicks}</strong></span>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="legal-disclaimer">No clicks yet.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No click activity this month yet.</p>
                )}
              </section>

              <section className="admin-section admin-tab-gallery" aria-labelledby="admin-published-gallery-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Published</p>
                  <h2 id="admin-published-gallery-title">Gallery Photos</h2>
                </div>

                {publishedGalleryPhotos.length ? (
                  <div className="admin-grid">
                    {publishedGalleryPhotos.map((photo) => (
                      <article className="admin-card" key={photo.id}>
                        <img src={photo.image_data} alt="" />
                        <span className="event-type">{new Date(photo.created_at).toLocaleDateString()}</span>
                        <h3>{photo.title}</h3>
                        <p>By {photo.contributor_name}</p>
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => deleteGalleryPhoto(photo.id)}
                            disabled={adminGalleryActionKey.startsWith(`${photo.id}:`)}
                          >
                            {adminGalleryActionKey === `${photo.id}:delete` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No published gallery uploads yet.</p>
                )}
              </section>

              <section className="admin-section admin-tab-gallery" aria-labelledby="admin-starter-gallery-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Built in</p>
                  <h2 id="admin-starter-gallery-title">Starter Gallery Photos</h2>
                </div>

                {visibleStaticGalleryPhotos.length || hiddenStaticGalleryPhotos.length ? (
                  <div className="admin-grid">
                    {visibleStaticGalleryPhotos.map((photo) => (
                      <article className="admin-card" key={photo.id}>
                        <img src={photo.image} alt="" />
                        <span className="event-type">Visible</span>
                        <h3>{photo.title}</h3>
                        <p className="admin-metric">Likes: <strong>{likeCountFor("photo", photo.id)}</strong></p>
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => hideStaticGalleryPhoto(photo)}
                            disabled={adminGalleryActionKey.startsWith(`${staticGalleryKey(photo)}:`)}
                          >
                            {adminGalleryActionKey === `${staticGalleryKey(photo)}:hide` ? "Hiding..." : "Hide"}
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteStaticGalleryPhoto(photo)}
                            disabled={adminGalleryActionKey.startsWith(`${staticGalleryKey(photo)}:`)}
                          >
                            {adminGalleryActionKey === `${staticGalleryKey(photo)}:delete` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </article>
                    ))}
                    {hiddenStaticGalleryPhotos.map((photo) => (
                      <article className="admin-card" key={photo.id}>
                        <img src={photo.image} alt="" />
                        <span className="event-type">Hidden</span>
                        <h3>{photo.title}</h3>
                        <p className="admin-metric">Likes: <strong>{likeCountFor("photo", photo.id)}</strong></p>
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => restoreStaticGalleryPhoto(photo)}
                            disabled={adminGalleryActionKey.startsWith(`${staticGalleryKey(photo)}:`)}
                          >
                            {adminGalleryActionKey === `${staticGalleryKey(photo)}:restore` ? "Restoring..." : "Restore"}
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteStaticGalleryPhoto(photo)}
                            disabled={adminGalleryActionKey.startsWith(`${staticGalleryKey(photo)}:`)}
                          >
                            {adminGalleryActionKey === `${staticGalleryKey(photo)}:delete` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No starter gallery photos.</p>
                )}
              </section>

              <section className="admin-section admin-tab-businesses" aria-labelledby="admin-published-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Published</p>
                  <h2 id="admin-published-business-title">Businesses</h2>
                </div>

                {publishedBusinesses.length ? (
                  <div className="admin-grid">
                    {publishedBusinesses.map((business) => (
                      <article className="admin-card" key={business.id}>
                        <span className="event-type">{business.plan} - {business.payment_status}</span>
                        {business.placement_source === "comp" && <span className="event-type">Comp promo</span>}
                        {business.placement_expires_at && (
                          <p>Promo expires: {new Date(business.placement_expires_at).toLocaleDateString()}</p>
                        )}
                        {business.image_data && <img src={business.image_data} alt="" />}
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        {business.contact_email && <p>Email: {business.contact_email}</p>}
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          {renderBusinessPlanButtons(business, { showCategoryPhoto: true })}
                          <div className="admin-business-action-group">
                            <span className="admin-business-action-label">Publishing</span>
                            <div className="admin-business-action-buttons">
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => unpublishBusiness(business.id)}
                                disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}
                              >
                                {adminBusinessActionKey === `${business.id}:hide` ? "Hiding..." : "Unpublish"}
                              </button>
                              <button
                                className="directory-link danger-link"
                                type="button"
                                onClick={() => { setDeletingAdminBusiness({ ...business }); setAdminStatus(""); }}
                                disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}
                              >
                                {adminBusinessActionKey === `${business.id}:delete` ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No published businesses yet.</p>
                )}
              </section>

              <section className="admin-section admin-tab-businesses" aria-labelledby="admin-hidden-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Hidden</p>
                  <h2 id="admin-hidden-business-title">Businesses</h2>
                </div>

                {hiddenBusinesses.length ? (
                  <div className="admin-grid">
                    {hiddenBusinesses.map((business) => (
                      <article className="admin-card" key={business.id}>
                        <span className="event-type">{business.plan} - {business.payment_status}</span>
                        {business.placement_source === "comp" && <span className="event-type">Comp promo</span>}
                        {business.placement_expires_at && (
                          <p>Promo expires: {new Date(business.placement_expires_at).toLocaleDateString()}</p>
                        )}
                        {business.image_data && <img src={business.image_data} alt="" />}
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        {business.contact_email && <p>Email: {business.contact_email}</p>}
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          {renderBusinessPlanButtons(business, { showCategoryPhoto: true })}
                          <div className="admin-business-action-group">
                            <span className="admin-business-action-label">Publishing</span>
                            <div className="admin-business-action-buttons">
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => restoreBusiness(business)}
                                disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}
                              >
                                {adminBusinessActionKey === `${business.id}:restore` ? "Restoring..." : "Restore"}
                              </button>
                              <button
                                className="directory-link danger-link"
                                type="button"
                                onClick={() => { setDeletingAdminBusiness({ ...business }); setAdminStatus(""); }}
                                disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}
                              >
                                {adminBusinessActionKey === `${business.id}:delete` ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No hidden published businesses.</p>
                )}
              </section>

              <section className="admin-section admin-tab-businesses" aria-labelledby="admin-built-in-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Built in</p>
                  <h2 id="admin-built-in-business-title">Starter Businesses</h2>
                </div>

                {visibleInitialBusinesses.length ? (
                  <div className="admin-grid">
                    {visibleInitialBusinesses.map((business) => (
                      <article className="admin-card" key={business.id}>
                        <span className="event-type">Visible</span>
                        <h3>{business.name}</h3>
                        <p>{business.category}</p>
                        <p>{business.phone}</p>
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => hideStaticBusiness(business)}
                          >
                            Hide
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteStaticItem(`business:${business.id}`, business.name)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No visible starter businesses.</p>
                )}

                {hiddenInitialBusinesses.length ? (
                  <div className="admin-grid">
                    {hiddenInitialBusinesses.map((business) => (
                      <article className="admin-card" key={business.id}>
                        <span className="event-type">Hidden</span>
                        <h3>{business.name}</h3>
                        <p>{business.category}</p>
                        <p>{business.phone}</p>
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => restoreStaticBusiness(business)}
                          >
                            Restore
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteStaticItem(`business:${business.id}`, business.name)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
              </div>
            </>
          )}
        </div>
      </main>,
    );
  }

  if (page === "terms" || page === "privacy") {
    const legalPage = legalSections[page];

    return withSplash(
      <main className="app legal-page">
        <div className="legal-shell">
          <button className="back-button" onClick={backFromLegal}>
            ← Back
          </button>

          <section className="legal-header" aria-labelledby={`${page}-title`}>
            <p className="eyebrow">{legalPage.eyebrow}</p>
            <h1 id={`${page}-title`}>{legalPage.title}</h1>
            <p className="events-intro">{legalPage.intro}</p>
          </section>

          <section className="legal-list" aria-label={legalPage.title}>
            {legalPage.items.map((item) => (
              <article className="legal-card" key={item.title}>
                <h2>{item.title}</h2>
                <p>{item.copy}</p>
              </article>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  return withSplash(
    <main className="app home-page">
      <section className="home-hero" aria-label="Abilene Vibes">
        <div className="home-hero-frame">
          <img
            className="home-hero-image"
            src={appAsset("home-correcta.jpg")}
            alt=""
          />
          <button className="home-hero-button" onClick={() => navigateTo("lobby")} aria-label="Explore Abilene" />
        </div>
      </section>
    </main>,
  );
}

export default App;
