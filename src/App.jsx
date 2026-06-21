import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const appAsset = (path) => `${import.meta.env.BASE_URL}${path}`;

const mapSearchUrl = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const telUrl = (phone) => `tel:${phone.replace(/\D/g, "")}`;

const paidPlanNames = new Set(["Featured", "Premium"]);

const lobbyAboutRotationMs = 2000;
const featuredPromotionRotationMs = 3000;
const premiumPromotionRotationMs = 5000;

const contactEmail = "abilenevibes@gmail.com";

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

const events = [
  {
    title: "Live Music Friday",
    place: "The Paramount Theatre",
    date: "May 29, 2026 - 8:00 PM",
    type: "Live music",
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Neon Nights",
    place: "The Station Lounge",
    date: "May 29, 2026 - 10:00 PM",
    type: "Nightlife",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Taco & Tequila Fest",
    place: "Frontier Texas! Courtyard",
    date: "May 30, 2026 - 5:00 PM",
    type: "Food & drinks",
    image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Country Night",
    place: "Potosi Live",
    date: "May 31, 2026 - 9:00 PM",
    type: "Country",
    image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Art & Food Market",
    place: "Downtown Abilene",
    date: "June 1, 2026 - 4:00 PM",
    type: "Family",
    image: "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=800&q=80",
  },
];

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

const eventSubmissionToEvent = (event) => ({
  id: event.id,
  title: event.title,
  place: event.place,
  date: formatEventDisplayDate(event.event_date, event.event_time),
  type: event.event_type,
  image: event.image_data || event.image_url || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80",
});

const calendarDays = [
  {
    day: "Sat",
    date: "May 23",
    title: "College Nights",
    time: "9:00 PM",
    place: "Guitars and Cadillacs",
  },
  {
    day: "Sun",
    date: "May 24",
    title: "Family Market",
    time: "4:00 PM",
    place: "Downtown Abilene",
  },
  {
    day: "Mon",
    date: "May 25",
    title: "Downtown Open Mic",
    time: "7:00 PM",
    place: "Grain Theory",
  },
  {
    day: "Tue",
    date: "May 26",
    title: "Taco Tuesday",
    time: "5:00 PM",
    place: "Downtown Abilene",
  },
  {
    day: "Wed",
    date: "May 27",
    title: "Trivia Night",
    time: "7:30 PM",
    place: "The Station Lounge",
  },
  {
    day: "Fri",
    date: "May 29",
    title: "Live Music Friday",
    time: "8:00 PM",
    place: "The Paramount Theatre",
  },
  {
    day: "Sat",
    date: "May 30",
    title: "Taco & Tequila Fest",
    time: "5:00 PM",
    place: "Frontier Texas! Courtyard",
  },
];

const shoppingPlaces = [
  {
    title: "Mall of Abilene",
    type: "Mall",
    place: "4310 Buffalo Gap Rd, Abilene, TX",
    note: "A familiar stop for fashion, gifts, snacks, and easy indoor shopping.",
    website: "https://www.mallofabilene.com/",
    image: "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Downtown Abilene Shops",
    type: "Local shops",
    place: "Downtown Abilene, TX",
    note: "Walkable boutiques, gifts, art, books, and small local favorites near restaurants and events.",
    website: "https://www.google.com/maps/search/downtown+Abilene+TX+shopping",
    image: appAsset("227005f7-a560-45d7-bea9-557e2cee61f3.jpg"),
  },
  {
    title: "Boutiques & Gifts",
    type: "Style finds",
    place: "Abilene, TX boutiques",
    note: "Find outfits, accessories, gifts, and local finds for a night out or weekend plans.",
    website: "https://www.google.com/maps/search/boutiques+in+Abilene+TX",
    image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Antiques & Vintage",
    type: "Treasure hunt",
    place: "Abilene, TX antique stores",
    note: "Browse vintage pieces, home decor, collectibles, and one-of-a-kind local finds.",
    website: "https://www.google.com/maps/search/antique+stores+in+Abilene+TX",
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Ross Dress for Less",
    type: "Discount fashion",
    place: "3449 Catclaw Dr, Abilene, TX 79606",
    note: "Popular stop for clothing, shoes, home finds, and name-brand deals.",
    website: "https://www.rossstores.com/",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Burlington",
    type: "Discount retail",
    place: "3526 S Clack St, Abilene, TX 79606",
    note: "Shop clothes, shoes, baby items, home goods, gifts, and everyday deals.",
    website: "https://stores.burlington.com/tx/abilene/",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Academy Sports + Outdoors",
    type: "Sports & outdoors",
    place: "3518 S Clack St, Abilene, TX 79606",
    note: "Gear for sports, outdoors, fitness, hunting, fishing, shoes, and family recreation.",
    website: "https://www.academy.com/storelocator/texas/abilene/store-0070",
    image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Target",
    type: "Everyday shopping",
    place: "3710 Ridgemont Dr, Abilene, TX 79606",
    note: "A go-to for clothing, beauty, home, tech, groceries, gifts, and quick pickup runs.",
    website: "https://www.target.com/sl/abilene/219",
    image: "https://images.unsplash.com/photo-1556742031-c6961e8560b0?auto=format&fit=crop&w=900&q=80",
  },
];

const nightlifePlaces = [
  {
    name: "Guitars and Cadillacs",
    kind: "Dance hall",
    phone: "(325) 692-8077",
    address: "3881 Vine St, Abilene, TX 79602",
    website: "http://guitars-cadillacs.com",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "The Ugly Lime",
    kind: "Bar",
    phone: "(325) 695-8185",
    address: "4109 S Danville Dr, Abilene, TX 79605",
    website: "https://www.instagram.com/theuglylimebar/",
    image: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Mi Gente Club",
    kind: "Club",
    phone: "(325) 675-9776",
    address: "157 Burger St, Abilene, TX 79603",
    website: "https://www.google.com/search?q=Mi+Gente+Club+Abilene+TX",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "The Station",
    kind: "Lounge",
    phone: "(325) 437-1336",
    address: "618 S Pioneer Dr, Abilene, TX 79605",
    website: "https://www.google.com/search?q=The+Station+Abilene+TX+lounge",
    image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Club Rodeo",
    kind: "Dance hall",
    phone: "(325) 692-8077",
    address: "3881 Vine St, Abilene, TX 79602",
    website: "http://guitars-cadillacs.com",
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Suite",
    kind: "Club",
    phone: "(325) 698-1234",
    address: "4250 Ridgemont Dr, Abilene, TX 79606",
    website: "https://www.mcmelegantesuites.com/",
    image: "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Paramount Theatre",
    kind: "Theatre",
    phone: "(325) 676-9620",
    address: "352 Cypress St, Abilene, TX 79601",
    website: "https://www.paramountabilene.com/",
    image: "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Cinemark",
    kind: "Cinema",
    phone: "(325) 670-0097",
    address: "672 E Overland Trl, Abilene, TX 79601",
    website: "https://www.cinemark.com/theatres/tx-abilene/cinemark-abilene-and-xd",
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=85",
  },
];

const eatsPlaces = [
  {
    name: "Grain Theory",
    kind: "Brewpub",
    note: "Craft beer, burgers, and a strong downtown patio mood.",
    phone: "(325) 513-6628",
    address: "202 Pine St Ste 201, Abilene, TX 79601",
    menuUrl: "https://www.graintheory.beer/",
    image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "The Beehive",
    kind: "Steakhouse",
    note: "Classic Abilene dinner spot for date night or a slower evening.",
    phone: "(325) 675-0600",
    address: "442 Cedar St, Abilene, TX 79601",
    menuUrl: "https://www.beehivesaloon.com/",
    image: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vagabond Pizza",
    kind: "Pizza",
    note: "Easy slices, late conversations, and a casual downtown stop.",
    phone: "(325) 268-4321",
    address: "1056 N 2nd St, Abilene, TX 79601",
    menuUrl: "https://www.vagabondpizza.com/",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Front Porch Coffee",
    kind: "Coffee",
    note: "A low-key daytime reset before the night starts moving.",
    phone: "(325) 400-0288",
    address: "702 N 2nd St, Abilene, TX 79601",
    menuUrl: "https://order.toasttab.com/online/the-front-porch-coffee",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Galveston Seafood Company",
    kind: "Seafood",
    note: "Coastal plates, fried favorites, and seafood baskets for a casual Abilene dinner.",
    phone: "(325) 232-6580",
    address: "818 E Hwy 80, Abilene, TX 79601",
    menuUrl: "https://www.galvestonseafoodcompany.com/",
    image: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Bonzai Japanese Steak House",
    kind: "Japanese",
    note: "Hibachi, sushi, and a fun dinner pick when the table wants a little show.",
    phone: "(325) 692-2333",
    address: "1802 S Clack St, Abilene, TX 79605",
    menuUrl: "https://www.allmenus.com/tx/abilene/328920-bonzai-japanese-steakhouse/menu/",
    image: "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Abuelo's Mexican Restaurant",
    kind: "Mexican",
    note: "A polished Mexican dinner spot for enchiladas, fajitas, margaritas, and groups.",
    phone: "(325) 692-4776",
    address: "4782 S 14th St, Abilene, TX 79605",
    menuUrl: "https://www.abuelos.com/restaurants/abilene/",
    image: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Miguel's Mex Tex Cafe",
    kind: "Mex-Tex",
    note: "A local favorite for Mexican comfort plates, casual lunches, and family dinners.",
    phone: "(325) 698-8100",
    address: "3001 S Danville Dr, Abilene, TX 79605",
    menuUrl: "https://www.allmenus.com/tx/abilene/749188-miguels-mex-tex-cafe/menu/",
    image: "https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Texas Roadhouse",
    kind: "Steakhouse",
    note: "Big steaks, rolls, ribs, and a reliable crowd-pleaser for dinner with family or friends.",
    phone: "(325) 691-0509",
    address: "1381 S Danville Dr, Abilene, TX 79605",
    menuUrl: "https://www.texasroadhouse.com/locations/texas/abilene",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Golden Corral",
    kind: "Buffet",
    note: "A family buffet option when everyone wants something different on one easy stop.",
    phone: "(325) 692-4592",
    address: "4357 S Danville Dr, Abilene, TX 79605",
    menuUrl: "https://www.goldencorral.com/locations/location-detail/978/golden-corral-south-danville-drive/",
    image: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80",
  },
];

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
  } catch {}
  return [raw]; // legacy single-photo string
};

const mapListingFromDb = (row) => {
  const imgs = parseListingImages(row.image_data);
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    category: row.category,
    location: row.location,
    contact: row.contact,
    description: row.description,
    image: imgs[0] || null,   // first photo — backward compat for all existing code
    images: imgs,             // all photos
    status: row.status,
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
  { label: "Hotels", icon: "hotels" },
  { label: "Rentals", icon: "rentals" },
  { label: "Groceries", icon: "groceries" },
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
      "These terms explain how businesses and visitors may use Abilene Vibes. By submitting a listing or purchasing a placement, you agree to these terms. They should be reviewed by a lawyer before large-scale commercial launch.",
    items: [
      {
        title: "Business submissions",
        copy:
          "When a business submits information, photos, logos, links, offers, or descriptions, the submitter confirms they have the rights and permission needed to share that content.",
      },
      {
        title: "Permission to display content",
        copy:
          "Submitted business content may be displayed in Abilene Vibes, related websites, social media posts, promotional material, and local advertising connected to the app.",
      },
      {
        title: "Business names and trademarks",
        copy:
          "Business names, trademarks, logos, and brand assets belong to their respective owners. Abilene Vibes is an independent local guide unless a business is clearly marked as a sponsor or partner.",
      },
      {
        title: "Listings and paid placements",
        copy:
          "Free, Featured, and Premium placements may be reviewed, edited, approved, rejected, paused, or removed to keep listings accurate, lawful, and appropriate for the app. Payment does not guarantee instant publication; paid placements can require admin approval before going live.",
      },
      {
        title: "Paid subscriptions",
        copy:
          "Featured and Premium plans are monthly subscriptions billed through Stripe. By purchasing a paid placement, the customer authorizes Abilene Vibes and Stripe to charge the selected plan amount today and automatically every month until the subscription is canceled.",
      },
      {
        title: "Cancellation",
        copy:
          "Cancellation stops future renewals. If a subscription is scheduled to cancel at the end of the billing period, the paid placement may remain active until the current paid month expires. Immediate cancellation may remove the paid placement sooner.",
      },
      {
        title: "Refunds",
        copy:
          "Payments for the current billing period are not automatically refunded after purchase. Refund requests may be reviewed case by case by contacting Abilene Vibes, and Stripe or payment provider policies may also apply.",
      },
      {
        title: "Contact",
        copy: `For listing updates, photo permissions, removals, or billing questions, contact ${contactEmail}.`,
      },
      {
        title: "No guarantee",
        copy:
          "Paid placement improves visibility inside Abilene Vibes, but it does not guarantee sales, visits, calls, rankings, or customer results.",
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    intro:
      "This policy explains the basic information Abilene Vibes may collect when someone submits a business or uses app features.",
    items: [
      {
        title: "Information collected",
        copy:
          "Business submissions may include business name, contact name, phone number, address, website, social handle, category, plan selection, and description.",
      },
      {
        title: "How information is used",
        copy:
          "Information is used to create listings, contact businesses about their submission, manage paid placement requests, improve local content, and keep the app useful.",
      },
      {
        title: "Public listing information",
        copy:
          "Business-facing information such as business name, category, phone, website, social link, address, and description may be shown publicly in the app.",
      },
      {
        title: "Payments",
        copy:
          "Payments are processed by Stripe or another payment provider. Abilene Vibes does not store full card numbers in the app database. The app may store billing status, plan type, customer identifiers, subscription identifiers, checkout session identifiers, and business contact details needed to manage paid listings and cancellations.",
      },
      {
        title: "Contact",
        copy: `Businesses may request listing updates, corrections, or removal by emailing ${contactEmail}.`,
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
    label: "Hotels",
    description: "Find hotels in Abilene.",
    icon: "hotels",
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

const familyPlaces = [
  {
    title: "Abilene Zoo",
    type: "Zoo",
    place: "2070 Zoo Ln, Abilene, TX",
    note: "A full family day with animals, walking paths, photos, and easy kid-friendly plans.",
    website: "https://abilenezoo.org/",
    image: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "PrimeTime Family Entertainment",
    type: "Arcade & games",
    place: "4541 Loop 322, Abilene, TX",
    note: "Bowling, arcade games, movies, food, and an easy indoor plan for every age.",
    website: "https://primetimeabilene.com/",
    image: "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Adventure Cove",
    type: "Water park",
    place: "2742 S 9th St, Abilene, TX",
    note: "A summer-friendly stop for slides, water play, and a full afternoon outside.",
    website: "https://www.abilenetx.gov/adventurecove",
    image: "https://images.unsplash.com/photo-1505731110654-99d7f7f8e39c?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Family Life Center",
    type: "Indoor activities",
    place: "Abilene, TX",
    note: "A useful indoor option for active family time, youth programs, and group activities.",
    website: "https://www.google.com/search?q=Family+Life+Center+Abilene+TX",
    image: "https://images.unsplash.com/photo-1526976668912-1a811878dd37?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Storybook Sculpture Trail",
    type: "Downtown walk",
    place: "Downtown Abilene, TX",
    note: "A relaxed walk through downtown with sculptures, photos, snacks, and easy stops nearby.",
    website: "https://www.google.com/search?q=Storybook+Sculpture+Trail+Abilene+TX",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  },
];

const hotelPlaces = [
  {
    title: "DoubleTree Downtown",
    type: "Downtown hotel",
    place: "500 Cypress St, Abilene, TX",
    note: "A polished stay by the convention center, museums, restaurants, and downtown events.",
    bookingUrl: "https://www.hilton.com/en/hotels/abidtdt-doubletree-abilene-downtown-convention-center/",
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "MCM Elegante Suites",
    type: "Suite hotel",
    place: "4250 Ridgemont Dr, Abilene, TX",
    note: "Roomy suite-style stays with extra space for families, longer visits, and event weekends.",
    bookingUrl: "https://www.mcmelegantesuites.com/",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Courtyard Abilene Northeast",
    type: "Modern hotel",
    place: "2141 Scottish Rd, Abilene, TX",
    note: "A clean, easy stay near ACU, restaurants, and northeast Abilene plans.",
    bookingUrl: "https://www.marriott.com/en-us/hotels/abine-courtyard-abilene-northeast/overview/",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "TownePlace Suites Northeast",
    type: "Extended stay",
    place: "2141 Scottish Rd, Abilene, TX",
    note: "A practical extended-stay option with more room for work trips and longer family visits.",
    bookingUrl: "https://www.marriott.com/en-us/hotels/abits-towneplace-suites-abilene-northeast/overview/",
    image: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Apartment Rentals",
    type: "Furnished stays",
    place: "Abilene, TX",
    note: "Search apartment-style stays for longer visits, visiting relatives, or flexible weekend plans.",
    bookingUrl: "https://www.airbnb.com/abilene-tx/stays/apartments",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Downtown Hotels",
    type: "Near events",
    place: "Downtown Abilene, TX",
    note: "Best for nightlife, Paramount Theatre plans, restaurants, and walkable weekend stops.",
    bookingUrl: "https://www.google.com/maps/search/hotels+near+downtown+Abilene+TX",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Short-Term Rentals",
    type: "Home stays",
    place: "Abilene, TX",
    note: "Great for families, groups, visiting relatives, and longer event weekends.",
    bookingUrl: "https://www.airbnb.com/s/Abilene--TX/homes",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Family-Friendly Stays",
    type: "Pool & comfort",
    place: "Abilene, TX",
    note: "Look for pools, breakfast, parking, and easy drives to the zoo and family stops.",
    bookingUrl: "https://www.google.com/maps/search/family+friendly+hotels+Abilene+TX",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Event Weekend Stays",
    type: "Quick booking",
    place: "Near Abilene venues",
    note: "Useful when you are coming in for concerts, sports, downtown events, or nightlife.",
    bookingUrl: "https://www.google.com/maps/search/hotels+near+Abilene+TX+events",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80",
  },
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
  contactEmail: business.contact_email ?? "",
  address: business.address ?? "",
  social: business.social ?? "",
  description: business.description ?? "",
  image: business.image_data ?? "",
  plan: business.plan,
  paymentStatus: business.payment_status ?? "",
  placementSource: business.placement_source ?? "paid",
  placementExpiresAt: business.placement_expires_at ?? "",
});

const planRank = {
  Premium: 0,
  Featured: 1,
  Free: 2,
};

const activePaidPaymentStatuses = new Set(["paid", "cancel_pending"]);

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
  Hotels: "hotels",
  "Hotels & Rents": "hotels",
  Rentals: "rentals",
  Groceries: "groceries",
  Grocery: "groceries",
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

  if (category === "Hotels" || category === "Hotels & Rents") {
    return "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80";
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

  if (icon === "hotels") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 58V30l16-12 16 12v28" />
        <path d="M17 58V42h14v16" />
        <path d="M38 58V10h17v48" />
        <path d="M43 18h5M43 28h5M43 38h5" />
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

  if (icon === "hotels") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 50V18h16c7 0 12 5 12 12v20" />
        <path d="M10 34h44v16" />
        <path d="M18 26h9" />
        <path d="M54 24v26" />
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
  const [weather, setWeather] = useState({ temp: 72, isDay: false, label: "Abilene, TX" });
  const [selectedCategory, setSelectedCategory] = useState(promoteCategories[0].label);
  const [selectedPlan, setSelectedPlan] = useState(promotePlans[0].name);
  const [showGroceryForm, setShowGroceryForm] = useState(false);
  const [openBusinessServiceFormPage, setOpenBusinessServiceFormPage] = useState("");
  const [businessSubmitted, setBusinessSubmitted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [businesses, setBusinesses] = useState([]);
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
  const [approvedGalleryPhotos, setApprovedGalleryPhotos] = useState([]);
  const [gallerySubmissionStatus, setGallerySubmissionStatus] = useState("");
  const [gallerySubmissionError, setGallerySubmissionError] = useState("");
  const [adminSession, setAdminSession] = useState(null);
  const adminSessionRef = useRef(null); // keeps current value without triggering Realtime re-sub
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminStatus, setAdminStatus] = useState("");
  const [adminTab, setAdminTab] = useState("events");
  const [pendingGalleryPhotos, setPendingGalleryPhotos] = useState([]);
  const [publishedGalleryPhotos, setPublishedGalleryPhotos] = useState([]);
  const [pendingBusinesses, setPendingBusinesses] = useState([]);
  const [publishedBusinesses, setPublishedBusinesses] = useState([]);
  const [hiddenBusinesses, setHiddenBusinesses] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [adminJobListings, setAdminJobListings] = useState([]);
  const [adminMarketplaceListings, setAdminMarketplaceListings] = useState([]);
  const [adminRentalListings, setAdminRentalListings] = useState([]);
  const [adminRentalStatusFilter, setAdminRentalStatusFilter] = useState("all");
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
  const [editingListing, setEditingListing] = useState(null);
  const [deletingListing, setDeletingListing] = useState(null);
  const [editDeleteStatus, setEditDeleteStatus] = useState("");
  const [marketplaceAdminStatusFilter, setMarketplaceAdminStatusFilter] = useState("all");
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
    location: "Abilene, TX", phone: "", email: "", description: "", requirements: "",
    image: null, logo: null, appMethod: "Phone", duration: "30 Days", applyUrl: "",
  });
  const [postJobPreview, setPostJobPreview] = useState(false);
  const [postJobImagePreview, setPostJobImagePreview] = useState(null);
  const [postJobLogoPreview, setPostJobLogoPreview] = useState(null);
  const [postJobStep, setPostJobStep] = useState("form"); // "form" | "preview" | "plan"
  const [postJobError, setPostJobError] = useState(null);
  const [postJobPublishing, setPostJobPublishing] = useState(false);
  const [postedJobs, setPostedJobs] = useState([]);
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
    description: "", phone: "", email: "", externalUrl: "",
    duration: "30 Days",
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
  });
  const pageRef = useRef(page);
  const previousPageRef = useRef(page);
  const directoryReturnRef = useRef("lobby"); // tracks where directory was opened from
  // Tracks page for the Capacitor backButton handler ONLY — not updated by popstate/URL sync
  // so that browser history.back() firing popstate before backButton doesn't corrupt it.
  const backButtonPageRef = useRef(page);
  // Boolean flag: true ONLY while the user is viewing a marketplace listing detail.
  // Set by openListing(), cleared by Back or the UI "Back to Marketplace" button.
  // Immune to all popstate/URL/pageRef race conditions.
  const inListingDetailRef = useRef(false);

  useEffect(() => {
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
    };
  }, [page, imageViewerPhoto, postJobStep, postRentalStep, showGroceryForm, openBusinessServiceFormPage]);

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
      .select("id,created_at,title,company,category,job_type,pay_label,location,phone,email,description,requirements,app_method,apply_url,duration,plan,image_data,logo_data,expires_at")
      .eq("status", "approved")
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setPostedJobs(
            data.map((row) => ({
              id: row.id,
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
              contact: row.phone,
              email: row.email,
              appMethod: row.app_method,
              applyUrl: row.apply_url,
              duration: row.duration,
              plan: row.plan,
            })),
          );
        }
      });
  }, [supabase]);

  const loadRentalsPublic = useCallback(() => {
    if (!supabase) return;
    const baseSelect = "id,created_at,expires_at,title,property_type,price,deposit,price_per_night,price_per_week,available_from,available_to,max_guests,house_rules,pets_allowed,address,bedrooms,bathrooms,description,phone,email,external_url,duration,plan,status,image_data";
    const queryRentals = (selectFields) =>
      supabase
        .from("rental_listings")
        .select(selectFields)
        .eq("status", "approved")
        .gte("expires_at", new Date().toISOString())
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
  }, [supabase]);

  const loadBusinessesPublic = useCallback(() => {
    if (!supabase) return;
    supabase
      .from("business_submissions")
      .select("id,business_name,category,phone,address,social,description,image_data,plan,payment_status,placement_source,placement_expires_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setBusinesses(data.map(businessSubmissionToBusiness));
        }
      });
  }, [supabase]);

  const loadGalleryPublic = useCallback(() => {
    if (!supabase) return;
    supabase
      .from("gallery_submissions")
      .select("id,title,image_data")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setApprovedGalleryPhotos(
            data.map((photo) => ({
              id: photo.id,
              title: photo.title,
              image: photo.image_data,
            })),
          );
        }
      });
  }, [supabase]);

  const loadEventsPublic = useCallback(() => {
    if (!supabase) return;
    supabase
      .from("event_submissions")
      .select("id,title,place,event_date,event_time,event_type,image_url,image_data,status")
      .eq("status", "approved")
      .order("event_date", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setApprovedEvents(data.map(eventSubmissionToEvent));
        }
      });
  }, [supabase]);

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
  }, [supabase]);

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
  }, [supabase]);

  const loadMarketplacePublic = useCallback(() => {
    if (!supabase) return;
    supabase.rpc("expire_marketplace_listings").then(() => {
      supabase
        .from("marketplace_listings")
        .select("id,created_at,expires_at,sold_at,deleted_at,title,price,category,location,contact,description,image_data,status,owner_user_id")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setMarketplaceListings(data.map(mapListingFromDb));
        });
    });
  }, [supabase]);

  // Keep adminSessionRef in sync so Realtime callbacks always see the latest value
  useEffect(() => { adminSessionRef.current = adminSession; }, [adminSession]);

  // Refs so the popstate listener can read current modal state without stale closure
  const editingJobRef = useRef(null);
  const editingListingRef = useRef(null);
  useEffect(() => { editingJobRef.current = editingJob; }, [editingJob]);
  useEffect(() => { editingListingRef.current = editingListing; }, [editingListing]);
  // Reset gallery slide index when a new listing is opened.
  useEffect(() => { setListingGalleryIndex(0); }, [selectedListing]);
  // Populate existing photos when edit modal opens.
  useEffect(() => {
    if (editingListing) setEditListingPhotos(editingListing.images ?? (editingListing.image ? [editingListing.image] : []));
  }, [editingListing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [adminSession]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const weatherUrl =
      "https://api.open-meteo.com/v1/forecast?latitude=32.4487&longitude=-99.7331&current=temperature_2m,is_day&temperature_unit=fahrenheit&timezone=America%2FChicago";

    fetch(weatherUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Weather unavailable");
        }

        return response.json();
      })
      .then((data) => {
        const temp = Math.round(data.current?.temperature_2m ?? 72);
        const isDay = data.current?.is_day === 1;

        setWeather({ temp, isDay, label: "Abilene, TX" });
      })
      .catch(() => {
        setWeather({ temp: 72, isDay: false, label: "Abilene, TX" });
      });
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

    console.log("[Realtime] Initializing subscriptions...");

    // Reads the ref — always current, never stale, never causes re-sub
    const reloadAdmin = () => {
      if (adminSessionRef.current) loadAdminData(adminSessionRef.current);
    };

    const mkChannel = (name, table, handler) =>
      supabase
        .channel(name)
        .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
          console.log(`[Realtime] ${table} change received:`, payload.eventType, payload);
          handler();
        })
        .subscribe((status, err) => {
          if (err) {
            console.error(`[Realtime] ${name} error:`, err);
          } else {
            console.log(`[Realtime] ${name} status:`, status);
          }
        });

    const channels = [
      mkChannel("rt-job_listings",         "job_listings",         () => { loadJobsPublic();       reloadAdmin(); }),
      mkChannel("rt-rental_listings",      "rental_listings",      () => { loadRentalsPublic();    reloadAdmin(); }),
      mkChannel("rt-business_submissions",  "business_submissions",  () => { loadBusinessesPublic(); reloadAdmin(); }),
      mkChannel("rt-gallery_submissions",   "gallery_submissions",   () => { loadGalleryPublic();    reloadAdmin(); }),
      mkChannel("rt-event_submissions",     "event_submissions",     () => { loadEventsPublic();     reloadAdmin(); }),
      mkChannel("rt-business_reviews",      "business_reviews",      () => { loadReviewsPublic();    reloadAdmin(); }),
      mkChannel("rt-marketplace_listings",  "marketplace_listings",  () => { loadMarketplacePublic(); }),
      mkChannel("rt-local_news_items",      "local_news_items",      () => { loadNewsPublic(); }),
    ];

    return () => {
      console.log("[Realtime] Cleaning up subscriptions.");
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
        setOpenBusinessServiceFormPage("");
        setBusinessSubmitted(false);
        setSubmissionStatus("");
        return;
      }

      if (
        currentPage === "news" ||
        currentPage === "marketplace" ||
        businessServicePages.includes(currentPage) ||
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
      const { error } = await supabase.from("gallery_submissions").insert({
        contributor_name: formData.get("contributorName").trim(),
        title: formData.get("title").trim(),
        image_data: imageData,
        content_rights_confirmed: formData.get("contentRights") === "on",
        status: "pending",
      });

      if (error) {
        setGallerySubmissionStatus("error");
        setGallerySubmissionError(`${error.code ?? "Upload error"}: ${error.message}`);
        return;
      }

      form.reset();
      setGallerySubmissionStatus("saved");
    } catch (error) {
      setGallerySubmissionStatus("error");
      setGallerySubmissionError(error instanceof Error ? error.message : "The image could not be processed.");
    }
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

    if (!supabase || !adminSession) {
      setEventSubmissionStatus("missing-config");
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
      event_date: formData.get("eventDate"),
      event_time: formatEventTime(formData.get("eventTime")),
      event_type: formData.get("eventType").trim(),
      image_data: imageData,
      status: "approved",
    });

    if (error) {
      setEventSubmissionStatus("error");
      return;
    }

    form.reset();
    setEventSubmissionStatus("saved");
    await loadAdminData(adminSession);
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

  const loadAdminData = async (sessionOverride = adminSession, showRefreshSuccess = false) => {
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
        .select("id,created_at,contributor_name,title,image_data,status")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("gallery_submissions")
        .select("id,created_at,contributor_name,title,image_data,status")
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
        .select("id,created_at,title,place,event_date,event_time,event_type,image_url,image_data,status")
        .eq("status", "approved")
        .order("event_date", { ascending: true }),
      supabase
        .from("event_submissions")
        .select("id,created_at,title,place,event_date,event_time,event_type,image_url,image_data,status")
        .eq("status", "hidden")
        .order("event_date", { ascending: true }),
      supabase
        .from("job_listings")
        .select("id,created_at,title,company,category,job_type,pay_label,location,phone,email,description,requirements,app_method,apply_url,duration,plan,status,image_data,logo_data,expires_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("marketplace_listings")
        .select("id,created_at,expires_at,sold_at,deleted_at,title,price,category,location,contact,description,image_data,status,owner_user_id")
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
    setAdminMarketplaceListings(adminMarketplaceResult.data ?? []);
    setPublishedEvents(publishedEventResult.data ?? []);
    setHiddenEvents(hiddenEventResult.data ?? []);
    setApprovedEvents((publishedEventResult.data ?? []).map(eventSubmissionToEvent));
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
  };

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

  const deleteGalleryPhoto = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldDelete = window.confirm("Delete this gallery photo from Abilene Vibes?");

    if (!shouldDelete) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("gallery_submissions").delete().eq("id", id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    setApprovedGalleryPhotos((currentPhotos) => currentPhotos.filter((photo) => photo.id !== id));
    await loadAdminData();
  };

  const handleDeleteJob = async (id) => {
    if (!supabase || !adminSession) return;
    if (!window.confirm("Permanently delete this job listing?")) return;
    setAdminStatus("saving");
    const { error } = await supabase.from("job_listings").delete().eq("id", id);
    if (error) { setAdminStatus("error"); return; }
    await loadAdminData();
  };

  const handleSaveJob = async () => {
    if (!supabase || !adminSession || !editingJob) return;
    setAdminStatus("saving");
    const { error } = await supabase
      .from("job_listings")
      .update({
        title: editingJob.title,
        company: editingJob.company,
        category: editingJob.category,
        job_type: editingJob.job_type,
        pay_label: editingJob.pay_label,
        location: editingJob.location,
        phone: editingJob.phone,
        email: editingJob.email,
        description: editingJob.description,
        requirements: editingJob.requirements,
        app_method: editingJob.app_method,
        apply_url: editingJob.apply_url || null,
        duration: editingJob.duration,
        plan: editingJob.plan,
        status: editingJob.status,
        image_data: editingJob.image_data ?? null,
        logo_data: editingJob.logo_data ?? null,
      })
      .eq("id", editingJob.id);
    if (error) { setAdminStatus("error"); return; }
    setAdminStatus("");
    setEditingJob(null);
    setEditJobPage(false);
    await loadAdminData();
  };

  const setJobPlan = async (job, plan) => {
    if (!supabase || !adminSession) return;
    const cleanPlan = plan === "premium" ? "premium" : plan === "featured" ? "featured" : "free";
    setAdminStatus("saving");
    const { error } = await supabase.from("job_listings").update({ plan: cleanPlan }).eq("id", job.id);
    if (error) { setAdminStatus("error"); return; }
    await loadAdminData();
  };

  const handleDeleteRental = async (id) => {
    if (!supabase || !adminSession) return;
    if (!window.confirm("Permanently delete this rental listing?")) return;
    setAdminStatus("saving");
    const { data, error } = await supabase.rpc("admin_delete_rental_listing", {
      listing_id: id,
    });
    if (error || data !== true) { setAdminStatus("error"); return; }
    await loadAdminData();
  };

  const adminRentalRpcPayload = (r, overrides = {}) => {
    const rental = { ...r, ...overrides };
    const isSTR = rental.property_type === "Short-Term";

    return {
      listing_id: rental.id,
      new_title: rental.title,
      new_property_type: rental.property_type,
      new_address: rental.address,
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
    if (!supabase || !adminSession) return;
    setAdminStatus("saving");
    const { data, error } = await supabase.rpc("admin_update_rental_listing", adminRentalRpcPayload(r, { status: nextStatus }));
    if (error || data !== true) { setAdminStatus("error"); return; }
    await loadAdminData();
  };

  const handleSetRentalPlan = async (r, nextPlan) => {
    if (!supabase || !adminSession) return;
    const cleanPlan = nextPlan === "premium" ? "premium" : nextPlan === "featured" ? "featured" : "free";
    setAdminStatus("saving");
    const { data, error } = await supabase.rpc("admin_update_rental_listing", adminRentalRpcPayload(r, { plan: cleanPlan }));
    if (error || data !== true) { setAdminStatus("error"); return; }
    await loadAdminData();
  };

  const handleSetRentalPromo = async (r, promoPlan) => {
    await handleSetRentalPlan(r, promoPlan);
  };

  const handleSaveRental = async () => {
    if (!supabase || !adminSession || !editingRental) return;
    setAdminStatus("saving");
    const { data, error } = await supabase.rpc("admin_update_rental_listing", adminRentalRpcPayload(editingRental));
    if (error || data !== true) { setAdminStatus("error"); return; }
    setAdminStatus("");
    setEditingRental(null);
    setEditRentalPage(false);
    await loadAdminData();
  };

  const deleteBusiness = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldDelete = window.confirm("Permanently delete this business from Abilene Vibes?");

    if (!shouldDelete) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("business_submissions").delete().eq("id", id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    setBusinesses((currentBusinesses) => currentBusinesses.filter((business) => business.id !== id));
    await loadAdminData();
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

    setAdminStatus("saving");
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

    await loadAdminData();
  };

  const applyBusinessCategoryPhoto = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldUpdate = window.confirm(`Use the default ${business.category || "category"} photo for "${business.business_name}"?`);

    if (!shouldUpdate) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("business_submissions").update({ image_data: null }).eq("id", business.id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    await loadAdminData();
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

    setAdminStatus("saving");
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

    await loadAdminData();
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

    setAdminStatus("saving");
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

    await loadAdminData();
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

    setAdminStatus("saving");
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
  };

  const clearCompBusinessPlacement = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldClear = window.confirm(`Remove free promo placement from "${business.business_name}"?`);

    if (!shouldClear) {
      return;
    }

    setAdminStatus("saving");
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

    await loadAdminData();
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

    await loadAdminData();
  };

  const unpublishBusiness = async (id) => {
    if (!supabase || !adminSession) {
      return;
    }

    const shouldUnpublish = window.confirm("Remove this business from the public app?");

    if (!shouldUnpublish) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("business_submissions").update({ status: "hidden" }).eq("id", id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    setBusinesses((currentBusinesses) => currentBusinesses.filter((business) => business.id !== id));
    await loadAdminData();
  };

  const restoreBusiness = async (business) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const { error } = await supabase.from("business_submissions").update({ status: "approved" }).eq("id", business.id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    setBusinesses((currentBusinesses) => [businessSubmissionToBusiness(business), ...currentBusinesses]);
    await loadAdminData();
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

    await loadAdminData();
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

    await loadAdminData();
  };

  const editEvent = async (event) => {
    if (!supabase || !adminSession) {
      return;
    }

    const title = window.prompt("Event title", event.title);
    if (title === null) return;

    const place = window.prompt("Event place", event.place);
    if (place === null) return;

    const eventDate = window.prompt("Event date (YYYY-MM-DD)", event.event_date);
    if (eventDate === null) return;

    const eventTime = window.prompt("Event time", event.event_time);
    if (eventTime === null) return;

    const eventType = window.prompt("Event type", event.event_type);
    if (eventType === null) return;

    setAdminStatus("saving");
    const { error } = await supabase
      .from("event_submissions")
      .update({
        title: title.trim(),
        place: place.trim(),
        event_date: eventDate.trim(),
        event_time: formatEventTime(eventTime),
        event_type: eventType.trim(),
      })
      .eq("id", event.id);

    if (error) {
      setAdminStatus("error");
      return;
    }

    await loadAdminData();
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

      await loadAdminData();
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

    const eventType = window.prompt("Event type", event.type);
    if (eventType === null) return;

    setAdminStatus("saving");
    const wasCreated = await createEditableEventFromStatic(event, {
      title: title.trim(),
      place: place.trim(),
      event_date: eventDate.trim(),
      event_time: formatEventTime(eventTime),
      event_type: eventType.trim(),
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

    setAdminStatus("saving");
    const itemKey = staticGalleryKey(photo);
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
  };

  const restoreStaticGalleryPhoto = async (photo) => {
    if (!supabase || !adminSession) {
      return;
    }

    setAdminStatus("saving");
    const itemKey = staticGalleryKey(photo);
    const { error } = await supabase.from("hidden_static_items").delete().eq("item_key", itemKey);

    if (error) {
      setAdminStatus("error");
      return;
    }

    setHiddenStaticItems((currentItems) => currentItems.filter((item) => item !== itemKey));
    await loadAdminData();
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
  const effectiveOwnerId = ownerUserId || visitorKey;
  const visibleStarterListings = marketplaceStarterListings.filter(
    (l) => !hiddenStaticItemSet.has(marketplaceListingKey(l)),
  );
  const allMarketplaceListings = [
    ...marketplaceListings,
    // starter listings removed — only real Supabase listings shown
  ];
  const activeMarketplaceListings = allMarketplaceListings.filter(
    (l) => (l.status ?? "active") === "active" && (!l.expiresAt || new Date(l.expiresAt) > new Date()),
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
  const adminMarketplaceRestorableStatuses = ["active", "hidden", "sold"];
  const adminMarketplaceCounts = adminMarketplaceListings.reduce(
    (acc, listing) => {
      const status = listing.status ?? "active";
      if (adminMarketplaceRestorableStatuses.includes(status)) {
        acc.all += 1;
        acc[status] = (acc[status] ?? 0) + 1;
      }
      return acc;
    },
    { all: 0, active: 0, hidden: 0, sold: 0 },
  );
  const adminMarketplaceVisibleListings = adminMarketplaceListings.filter((listing) => {
    const status = listing.status ?? "active";
    if (!adminMarketplaceRestorableStatuses.includes(status)) return false;
    return marketplaceAdminStatusFilter === "all" || status === marketplaceAdminStatusFilter;
  });
  const isStarterOrLegacyListing = (l) => !l.isStarterListing && (!l.ownerUserId || l.ownerUserId === "legacy-owner");
  const isListingOwner = (l) => !!(l.ownerUserId === effectiveOwnerId || isStarterOrLegacyListing(l));
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
    if (isStarterOrLegacyListing(l)) update.owner_user_id = effectiveOwnerId;
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
    if (isStarterOrLegacyListing(editingListing)) update.owner_user_id = effectiveOwnerId;
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
    const postedTodayCount = marketplaceListings.filter((l) => {
      if (!isListingOwner(l) || !l.createdAt) return false;
      const created = new Date(l.createdAt);
      const localCreated = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
      return localCreated === localToday;
    }).length;
    if (postedTodayCount >= 2) { setSellItemStatus("limit-daily"); return; }
    } // end !adminSession limit checks
    // ── Compute expiry ────────────────────────────────────────
    const durationDays = Number(sellDuration) || 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    try {
      // sellItemPhotos holds pre-compressed base64 strings (set during onChange).
      // Save as JSON array; parseListingImages handles old single-string rows on load.
      const imageData = sellItemPhotos.length === 0 ? "" : JSON.stringify(sellItemPhotos);
      const { data: row, error } = await supabase
        .from("marketplace_listings")
        .insert({
          title: data.get("title").trim(),
          price: data.get("price").trim(),
          category: data.get("category"),
          location: data.get("location").trim(),
          contact: data.get("contact").trim(),
          description: data.get("description").trim(),
          image_data: imageData,
          status: "active",
          owner_user_id: effectiveOwnerId,
          expires_at: expiresAt,
        })
        .select("id,created_at,expires_at,sold_at,deleted_at,title,price,category,location,contact,description,image_data,status,owner_user_id")
        .single();
      if (error) { setSellItemStatus("error"); return; }
      setMarketplaceListings((items) => [mapListingFromDb(row), ...items]);
      setMarketplaceSearch("");
      setMarketplaceFilter("All");
      setSellItemStatus("saved");
      setSellItemPhotos([]);
      form.reset();
      navigateTo("marketplace");
    } catch {
      setSellItemStatus("error");
    }
  };
  // ── End marketplace computed ──────────────────────────────

  // ── Jobs computed ─────────────────────────────────────────
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
    .filter((business) => business.plan && business.plan !== "Free")
    .filter((business) => {
      if (business.placementSource === "comp") {
        return true;
      }

      return activePaidPaymentStatuses.has(business.paymentStatus);
    })
    .filter((business) => !business.placementExpiresAt || new Date(business.placementExpiresAt) > new Date())
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
      .filter((rental) => String(rental.plan ?? "free").toLowerCase() === "featured")
      .map(toRentalLobbyItem),
  ];
  const premiumLobbyItems = [
    ...premiumBusinesses.map(toBusinessLobbyItem),
    ...allJobListings.filter((job) => job.plan === "premium").map(toJobLobbyItem),
    ...rentalListings
      .filter((rental) => String(rental.plan ?? "free").toLowerCase() === "premium")
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
  const spotlightEvent = allEvents[0] ?? events[0];
  const [spotlightEventDate, spotlightEventTime = ""] = spotlightEvent.date.split(" - ");
  const openLobbyPromotionItem = async (item, placement) => {
    if (!item) {
      await trackLobbySectionClick("upcoming-highlight", "Upcoming Highlight");
      navigateTo("events");
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

    await trackPublicItemClick("service", `lobby-${placement}-${item.id}`, `Lobby: ${placement} ${item.name}`);
    { const dest1 = categorySectionMap[item.business.category] ?? "directory"; if (dest1 === "directory") directoryReturnRef.current = "lobby"; navigateTo(dest1); }
  };
  const openUpcomingHighlight = async () => {
    await openLobbyPromotionItem(spotlightItem, "highlight");
  };
  const categoryBusinessesFor = (section) =>
    paidBusinesses.filter((business) => categorySectionMap[business.category] === section);
  const directoryBusinesses = [...allBusinesses].sort(
    (a, b) => (planRank[a.plan ?? "Free"] ?? 99) - (planRank[b.plan ?? "Free"] ?? 99),
  );
  const businessServiceBusinessesByPage = Object.fromEntries(
    Object.entries(businessServiceSections).map(([sectionPage, section]) => [
      sectionPage,
      businesses
        .filter((business) =>
          section.categories.some(
            (category) => category.toLowerCase() === String(business.category ?? "").trim().toLowerCase(),
          ),
        )
        .sort((a, b) => (planRank[a.plan ?? "Free"] ?? 99) - (planRank[b.plan ?? "Free"] ?? 99)),
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

  const renderBusinessPlanButtons = (business, options = {}) => (
    <>
      {options.showEdit !== false && (
        <button className="directory-link" type="button" onClick={() => editBusiness(business)}>
          Edit
        </button>
      )}
      {options.showCategoryPhoto && (
        <button className="directory-link" type="button" onClick={() => applyBusinessCategoryPhoto(business)}>
          Use Category Photo
        </button>
      )}
      <button className="directory-link" type="button" onClick={() => setPaidBusinessPlacement(business, "Free")}>
        Plan Free
      </button>
      <button className="directory-link" type="button" onClick={() => setPaidBusinessPlacement(business, "Featured")}>
        Paid Featured
      </button>
      <button className="directory-link" type="button" onClick={() => setPaidBusinessPlacement(business, "Premium")}>
        Paid Premium
      </button>
      <button className="directory-link" type="button" onClick={() => compBusinessPlacement(business, "Featured")}>
        Free Promo Featured
      </button>
      <button className="directory-link" type="button" onClick={() => compBusinessPlacement(business, "Premium")}>
        Free Promo Premium
      </button>
      {business.placement_source === "comp" && (
        <button className="directory-link danger-link" type="button" onClick={() => clearCompBusinessPlacement(business)}>
          End Promo
        </button>
      )}
      {business.placement_source !== "comp" &&
        business.stripe_subscription_id &&
        !["canceled", "cancel_pending"].includes(business.payment_status) && (
        <button className="directory-link danger-link" type="button" onClick={() => cancelBusinessSubscription(business)}>
          Cancel Subscription
        </button>
      )}
    </>
  );

  const renderBusinessReviews = (business) => {
    const reviews = approvedReviews[business.id] ?? [];
    const reviewStatus = reviewSubmissionStatus[business.id];
    const averageRating = reviews.length
      ? (reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length).toFixed(1)
      : null;

    return (
      <div className="review-panel">
        <div className="review-summary">
          <strong>{averageRating ? `${averageRating} stars` : "No reviews yet"}</strong>
          <span>{reviews.length} review{reviews.length === 1 ? "" : "s"}</span>
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
              <strong>{weather.temp}°</strong>
              <span>{weather.label}</span>
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
            More
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
                <img src={spotlightEvent.image} alt="" />
                <div>
                  <span>Upcoming Highlight</span>
                  <strong>{spotlightEvent.title}</strong>
                  <p>{spotlightEvent.place}</p>
                  <p>
                    {spotlightEventDate}
                    {spotlightEventTime && ` - ${spotlightEventTime}`}
                  </p>
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
      <main className="app events-page">
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
            {allEvents.map((event) => (
              <article className="event-card" key={event.id ?? `${event.title}-${event.date}`}>
                <img className="event-image" src={event.image} alt="" loading="lazy" />

                <div className="event-copy">
                  <span className="event-type">{event.type}</span>
                  <h2>{event.title}</h2>
                  <p className="event-detail">{event.place}</p>
                  <p className="event-detail">{event.date}</p>
                  <div className="place-actions">
                    <a
                      className="place-link"
                      href={mapSearchUrl(`${event.title}, ${event.place}, Abilene TX`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Directions
                    </a>
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

  if (page === "shopping") {
    return withSplash(
      <main className="app events-page">
        <div className="events-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="events-header" aria-labelledby="shopping-title">
            <p className="eyebrow">Local finds</p>
            <h1 id="shopping-title">Shopping</h1>
            <p className="events-intro">Explore shops, boutiques, gifts, and local favorites around Abilene.</p>
          </section>

          <section className="event-list" aria-label="Abilene shopping places">
            {shoppingPlaces.map((item) => (
              <article className="event-card" key={item.title}>
                <img className="event-image" src={item.image} alt="" loading="lazy" />

                <div className="event-content">
                  <span className="event-type">{item.type}</span>
                  <h2>{item.title}</h2>
                  <p className="event-detail">{item.note}</p>
                  <div className="place-actions">
                    <a
                      className="place-link"
                      href={mapSearchUrl(`${item.title}, ${item.place}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Directions
                    </a>
                    <a className="place-link" href={item.website} target="_blank" rel="noreferrer">
                      Visit
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  if (page === "nightlife") {
    return withSplash(
      <main className="app nightlife-page">
        <div className="nightlife-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="nightlife-header" aria-labelledby="nightlife-title">
            <p className="eyebrow">After dark</p>
            <h1 id="nightlife-title">Nightlife</h1>
          </section>

          <section className="nightlife-grid" aria-label="Abilene nightlife places">
            {categoryBusinessesFor("nightlife").map((business) => (
              <article className="nightlife-card paid-placement-card" key={business.id}>
                <img
                  className="nightlife-image"
                  src={businessDisplayImage(business)}
                  alt=""
                  loading="lazy"
                />
                <span className="event-type">{business.plan} local</span>
                <h2>{business.name}</h2>
                {business.description && <p className="paid-placement-note">{business.description}</p>}
                <div className="place-actions nightlife-actions">
                  {business.phone && (
                    <a className="place-link" href={telUrl(business.phone)}>
                      Call
                    </a>
                  )}
                  <a
                    className="place-link"
                    href={mapSearchUrl(`${business.name}, ${business.address || "Abilene TX"}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Directions
                  </a>
                  {business.social && (
                    <a className="place-link" href={visitUrl(business.social)} target="_blank" rel="noreferrer">
                      Visit
                    </a>
                  )}
                </div>
              </article>
            ))}
            {nightlifePlaces.map((place) => (
              <article className="nightlife-card" key={place.name}>
                {place.images ? (
                  <div className="nightlife-photo-pair" aria-hidden="true">
                    {place.images.map((image) => (
                      <img key={image} src={image} alt="" loading="lazy" />
                    ))}
                  </div>
                ) : (
                  <img className="nightlife-image" src={place.image} alt="" loading="lazy" />
                )}
                <span className="event-type">{place.kind}</span>
                <h2>{place.name}</h2>
                <div className="place-actions nightlife-actions">
                  <a className="place-link" href={telUrl(place.phone)}>
                    Call
                  </a>
                  <a
                    className="place-link"
                    href={mapSearchUrl(`${place.name}, ${place.address || "Abilene TX"}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Directions
                  </a>
                  <a className="place-link" href={place.website} target="_blank" rel="noreferrer">
                    Visit
                  </a>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  if (page === "eats") {
    return withSplash(
      <main className="app eats-page">
        <div className="eats-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="eats-header" aria-labelledby="eats-title">
            <p className="eyebrow">Food before the fun</p>
            <h1 id="eats-title">Eats</h1>
            <p className="events-intro">
              Quick picks for dinner, coffee, and downtown stops before the night opens up.
            </p>
          </section>

          <section className="eats-grid" aria-label="Abilene restaurants and coffee spots">
            {categoryBusinessesFor("eats").map((business) => (
              <article className="eats-card paid-placement-card" key={business.id}>
                <button
                  className="image-open-button"
                  type="button"
                  onClick={() => openImageViewer(businessDisplayImage(business), business.name)}
                  aria-label={`Open ${business.name} photo`}
                >
                  <img
                    className="eats-image"
                    src={businessDisplayImage(business)}
                    alt=""
                    loading="lazy"
                  />
                </button>

                <div className="eats-copy">
                  <span className="event-type">{business.plan} local</span>
                  <h2>{business.name}</h2>
                  {business.description && <p>{business.description}</p>}
                  <div className="place-actions">
                    {business.phone && (
                      <a className="place-link" href={telUrl(business.phone)}>
                        Call
                      </a>
                    )}
                    <a
                      className="place-link"
                      href={mapSearchUrl(`${business.name}, ${business.address || "Abilene TX"}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Directions
                    </a>
                    {business.social && (
                      <a className="place-link" href={visitUrl(business.social)} target="_blank" rel="noreferrer">
                        Visit
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {eatsPlaces.map((place) => (
              <article className="eats-card" key={place.name}>
                <button
                  className="image-open-button"
                  type="button"
                  onClick={() => openImageViewer(place.image, place.name)}
                  aria-label={`Open ${place.name} photo`}
                >
                  <img className="eats-image" src={place.image} alt="" loading="lazy" />
                </button>

                <div className="eats-copy">
                  <span className="event-type">{place.kind}</span>
                  <h2>{place.name}</h2>
                  <p>{place.note}</p>
                  <div className="place-actions">
                    <a className="place-link" href={telUrl(place.phone)}>
                      Call
                    </a>
                    <a
                      className="place-link"
                      href={mapSearchUrl(`${place.name}, ${place.address}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Directions
                    </a>
                    <a className="place-link" href={place.menuUrl} target="_blank" rel="noreferrer">
                      Menu
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  if (page === "family") {
    return withSplash(
      <main className="app events-page">
        <div className="events-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="events-header" aria-labelledby="family-title">
            <p className="eyebrow">For everyone</p>
            <h1 id="family-title">Family & Kids</h1>
            <p className="events-intro">Zoo days, water fun, games, and easy plans for the whole family.</p>
          </section>

          <section className="event-list" aria-label="Family and kids picks">
            {familyPlaces.map((item) => (
              <article className="event-card" key={item.title}>
                <img className="event-image" src={item.image} alt="" loading="lazy" />
                <div className="event-copy">
                  <span className="event-type">{item.type}</span>
                  <h2>{item.title}</h2>
                  <p className="event-detail">{item.place}</p>
                  <p className="event-detail">{item.note}</p>
                  <div className="place-actions">
                    <a
                      className="place-link"
                      href={mapSearchUrl(`${item.title}, ${item.place}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Directions
                    </a>
                    <a className="place-link" href={item.website} target="_blank" rel="noreferrer">
                      Visit
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  if (page === "hotels") {
    return withSplash(
      <main className="app events-page">
        <div className="events-shell">
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
          </button>

          <section className="events-header" aria-labelledby="hotels-title">
            <p className="eyebrow">Stay nearby</p>
            <h1 id="hotels-title">Hotels</h1>
            <p className="events-intro">Find hotels near events, food, family stops, and downtown plans.</p>
          </section>

          <section className="event-list" aria-label="Hotels">
            {categoryBusinessesFor("hotels").map((business) => (
              <article className="event-card paid-placement-card" key={business.id}>
                <img
                  className="event-image"
                  src={businessDisplayImage(business)}
                  alt=""
                  loading="lazy"
                />
                <div className="event-copy">
                  <span className="event-type">{business.plan} local</span>
                  <h2>{business.name}</h2>
                  {business.address && <p className="event-detail">{business.address}</p>}
                  {business.description && <p className="event-detail">{business.description}</p>}
                  <div className="place-actions">
                    <a
                      className="place-link"
                      href={mapSearchUrl(`${business.name}, ${business.address || "Abilene TX"}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Map
                    </a>
                    {business.social && (
                      <a className="place-link" href={visitUrl(business.social)} target="_blank" rel="noreferrer">
                        Visit
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {hotelPlaces.map((item) => (
              <article className="event-card" key={item.title}>
                <img className="event-image" src={item.image} alt="" loading="lazy" />
                <div className="event-copy">
                  <span className="event-type">{item.type}</span>
                  <h2>{item.title}</h2>
                  <p className="event-detail">{item.place}</p>
                  <p className="event-detail">{item.note}</p>
                  <div className="place-actions">
                    <a className="place-link" href={mapSearchUrl(item.place)} target="_blank" rel="noreferrer">
                      Map
                    </a>
                    <a className="place-link" href={item.bookingUrl} target="_blank" rel="noreferrer">
                      Search
                    </a>
                  </div>
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

              {gallerySubmissionStatus && (
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
                  <figcaption>{shot.title}</figcaption>
                  {renderLikeButton("photo", photoKey)}
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
              <button type="button" onClick={() => navigateTo("terms")}>
                Terms
              </button>
              <button type="button" onClick={() => navigateTo("privacy")}>
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
              onClick={() => navigateTo("sell-item")}
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
                  onClick={() => navigateTo("sell-item")}
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
                    <div className="marketplace-photo">
                      {l.image ? <img src={l.image} alt="" /> : <span>{l.icon}</span>}
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
                      <button className="directory-link" type="button" onClick={(e) => handleMarkSold(e, l)}>
                        Mark as Sold
                      </button>
                      <button className="directory-link danger-link" type="button" onClick={(e) => handleDeleteListing(e, l)}>
                        Delete
                      </button>
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
                        <button className="directory-link" type="button" onClick={() => setEditingListing({ ...l })}>
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
              <p className="form-success compact-status">Item posted. It is now visible in Marketplace.</p>
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
            <span className="event-type marketplace-card-tag jobs-card-tag job-detail-tag">{j.tag}</span>
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
                <dt>📅</dt><dd>{j.posted}</dd>
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
        </div>
      </main>,
    );
  }

  if (page === "post-job") {
    const jobTypeOptions = ["Full Time", "Part Time", "Temporary", "Contract"];
    const appMethodOptions = ["Phone", "Email", "Website", "In Person"];
    const durationOptions = ["30 Days", "60 Days", "90 Days"];
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

          const { data, error } = await supabase
            .from("job_listings")
            .insert({
              title: postJobForm.title,
              company: postJobForm.company,
              category: postJobForm.category || "Other",
              job_type: postJobForm.jobType || "Full Time",
              pay_label: payLabel,
              location: postJobForm.location || "Abilene, TX",
              phone: postJobForm.phone,
              email: postJobForm.email,
              description: postJobForm.description,
              requirements: postJobForm.requirements,
              app_method: postJobForm.appMethod || "Phone",
              apply_url: postJobForm.applyUrl || null,
              duration: postJobForm.duration || "30 Days",
              plan: "free",
              status: "pending",
              image_data: postJobImagePreview,
              logo_data: postJobLogoPreview,
              expires_at: expiresAt,
            });

          if (error) {
            console.error("[Jobs] Supabase insert error:", error.message);
            // Fall back to in-memory so the user still sees their post
            setPostJobError("Could not save this job for review. Please try again.");
            return;
          } else if (false && data) {
            const savedJob = {
              id: data.id,
              title: data.title,
              company: data.company,
              pay: data.pay_label || "Pay not specified",
              location: data.location,
              type: data.job_type,
              schedule: "",
              posted: "Posted Today",
              category: data.category,
              tag: "New Today",
              filters: [data.job_type, "New Today"],
              image: data.image_data,
              description: data.description,
              requirements: data.requirements,
              contact: data.phone,
              email: data.email,
              appMethod: data.app_method,
              applyUrl: data.apply_url,
              duration: data.duration,
              plan: data.plan,
            };
            if (data.status === "approved") {
              setPostedJobs((prev) => [savedJob, ...prev]);
            }
          } else if (false) {
            // insert succeeded but returned no row — use local fallback
            setPostJobError("Could not confirm this job was saved for review. Please try again.");
            return;
          }
        } else {
          // No Supabase configured — local-only fallback
          setPostJobError("Connection unavailable. Check your internet and try again.");
          return;
        }

        setPostJobForm({ title: "", company: "", category: "", jobType: "", payMin: "", payMax: "", location: "Abilene, TX", phone: "", email: "", description: "", requirements: "", image: null, logo: null, appMethod: "Phone", duration: "30 Days", applyUrl: "" });
        setPostJobImagePreview(null); setPostJobLogoPreview(null);
        setPostJobPreview(false); setPostJobStep("form");
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
          const { data, error } = await supabase
            .from("job_listings")
            .insert({
              title: postJobForm.title,
              company: postJobForm.company,
              category: postJobForm.category || "Other",
              job_type: postJobForm.jobType || "Full Time",
              pay_label: payLabel,
              location: postJobForm.location || "Abilene, TX",
              phone: postJobForm.phone,
              email: postJobForm.email,
              description: postJobForm.description,
              requirements: postJobForm.requirements,
              app_method: postJobForm.appMethod || "Phone",
              apply_url: postJobForm.applyUrl || null,
              duration: postJobForm.duration || "30 Days",
              plan: "featured",
              status: "pending",
              image_data: postJobImagePreview,
              logo_data: postJobLogoPreview,
              expires_at: expiresAt,
            });
          if (error) {
            console.error("[Jobs] Supabase insert error (featured):", error.message);
            setPostJobError("Could not save this job for review. Please try again.");
            return;
          } else if (false && data) {
            const savedJob = {
              id: data.id,
              title: data.title,
              company: data.company,
              pay: data.pay_label || payLabel,
              location: data.location,
              type: data.job_type,
              schedule: "",
              posted: "Posted Today",
              category: data.category,
              tag: "Featured",
              filters: [data.job_type, "New Today"],
              image: data.image_data,
              description: data.description,
              requirements: data.requirements,
              contact: data.phone,
              email: data.email,
              appMethod: data.app_method,
              applyUrl: data.apply_url,
              duration: data.duration,
              plan: "featured",
            };
            if (data.status === "approved") {
              setPostedJobs((prev) => [savedJob, ...prev]);
            }
          } else if (false) {
            setPostJobError("Could not confirm this job was saved for review. Please try again.");
            return;
          }
        } else {
          setPostJobError("Connection unavailable. Check your internet and try again.");
          return;
        }
        setPostJobForm({ title: "", company: "", category: "", jobType: "", payMin: "", payMax: "", location: "Abilene, TX", phone: "", email: "", description: "", requirements: "", image: null, logo: null, appMethod: "Phone", duration: "30 Days", applyUrl: "" });
        setPostJobImagePreview(null); setPostJobLogoPreview(null);
        setPostJobPreview(false); setPostJobStep("form");
        setPostJobError(null);
        navigateTo("jobs");
      } catch (err) {
        console.error("[Jobs] Unexpected error publishing featured job:", err);
        setPostJobError(err?.message || "Error al publicar. Verifica tu conexión e intenta de nuevo.");
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
          const { data, error } = await supabase
            .from("job_listings")
            .insert({
              title: postJobForm.title,
              company: postJobForm.company,
              category: postJobForm.category || "Other",
              job_type: postJobForm.jobType || "Full Time",
              pay_label: payLabel,
              location: postJobForm.location || "Abilene, TX",
              phone: postJobForm.phone,
              email: postJobForm.email,
              description: postJobForm.description,
              requirements: postJobForm.requirements,
              app_method: postJobForm.appMethod || "Phone",
              apply_url: postJobForm.applyUrl || null,
              duration: postJobForm.duration || "30 Days",
              plan: "premium",
              status: "pending",
              image_data: postJobImagePreview,
              logo_data: postJobLogoPreview,
              expires_at: expiresAt,
            });
          if (error) {
            console.error("[Jobs] Supabase insert error (premium):", error.message);
            setPostJobError("Could not save this job for review. Please try again.");
            return;
          } else if (false && data) {
            const savedJob = {
              id: data.id,
              title: data.title,
              company: data.company,
              pay: data.pay_label || payLabel,
              location: data.location,
              type: data.job_type,
              schedule: "",
              posted: "Posted Today",
              category: data.category,
              tag: "Premium",
              filters: [data.job_type, "New Today"],
              image: data.image_data,
              description: data.description,
              requirements: data.requirements,
              contact: data.phone,
              email: data.email,
              appMethod: data.app_method,
              applyUrl: data.apply_url,
              duration: data.duration,
              plan: "premium",
            };
            if (data.status === "approved") {
              setPostedJobs((prev) => [savedJob, ...prev]);
            }
          } else if (false) {
            setPostJobError("Could not confirm this job was saved for review. Please try again.");
            return;
          }
        } else {
          setPostJobError("Connection unavailable. Check your internet and try again.");
          return;
        }
        setPostJobForm({ title: "", company: "", category: "", jobType: "", payMin: "", payMax: "", location: "Abilene, TX", phone: "", email: "", description: "", requirements: "", image: null, logo: null, appMethod: "Phone", duration: "30 Days", applyUrl: "" });
        setPostJobImagePreview(null); setPostJobLogoPreview(null);
        setPostJobPreview(false); setPostJobStep("form");
        setPostJobError(null);
        navigateTo("jobs");
      } catch (err) {
        console.error("[Jobs] Unexpected error publishing premium job:", err);
        setPostJobError(err?.message || "Error al publicar. Verifica tu conexión e intenta de nuevo.");
      } finally {
        setPostJobPublishing(false);
      }
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
                <div className="post-job-plan-card post-job-plan-free">
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
                <div className="post-job-plan-card post-job-plan-featured">
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
                <div className="post-job-plan-card post-job-plan-premium">
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
                <button className="jobs-post-button post-job-promote-btn" type="button" onClick={() => setPostJobStep("plan")}>
                  <span aria-hidden="true">🚀</span> Choose Plan
                </button>
              </div>
              <p className="post-job-promote-note">Choose a plan on the next screen. Free posting goes live instantly.</p>
            </div>
          )}

          {/* ── FORM ── */}
          {postJobStep === "form" && (
            <>
              <section className="marketplace-hero jobs-hero" aria-labelledby="post-job-title">
                <p className="eyebrow">For employers</p>
                <h1 id="post-job-title">Post a Job</h1>
                <p className="events-intro">Fill in the details, preview, then choose a plan.</p>
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
                <p className="post-job-form-note">After preview you choose a plan. Free listings go live instantly.</p>
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
            <div className="marketplace-search jobs-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={rentalsSearch}
                onChange={(e) => setRentalsSearch(e.target.value)}
                placeholder="Search by address, type, description..."
                aria-label="Search rentals"
              />
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
            <p className="job-detail-meta">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address ?? "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rental-address-link"
              >📍 {r.address}</a>
            </p>
            {(r.bedrooms || r.bathrooms) && (
              <p className="job-detail-meta">
                {r.bedrooms ? `🛏️ ${r.bedrooms}` : ""}
                {r.bedrooms && r.bathrooms ? " · " : ""}
                {r.bathrooms ? `🚿 ${r.bathrooms} ba` : ""}
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
            <div className="job-detail-apply-row">
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

    const handleRentalPhotosAdd = async (files) => {
      const remaining = maxPhotos - postRentalPhotos.length;
      const toAdd = Array.from(files).slice(0, remaining);
      for (const file of toAdd) {
        try {
          const compressed = await optimizeGalleryImage(file);
          const reader = new FileReader();
          reader.onload = (e) =>
            setPostRentalPhotos((prev) =>
              prev.length < maxPhotos ? [...prev, { preview: e.target.result }] : prev
            );
          reader.readAsDataURL(compressed);
        } catch {
          const reader = new FileReader();
          reader.onload = (e) =>
            setPostRentalPhotos((prev) =>
              prev.length < maxPhotos ? [...prev, { preview: e.target.result }] : prev
            );
          reader.readAsDataURL(file);
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
        const record = {
          title:         postRentalForm.title.trim(),
          property_type: postRentalForm.propertyType,
          address:       postRentalForm.address.trim(),
          description:   postRentalForm.description.trim() || null,
          phone:         postRentalForm.phone.trim()        || null,
          email:         postRentalForm.email.trim()        || null,
          external_url:  postRentalForm.externalUrl.trim()  || null,
          duration:      postRentalForm.duration,
          plan:          "free",
          status:        "pending",
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
        let { error } = await supabase.from("rental_listings").insert([record]);
        if (error?.code === "PGRST204" || error?.code === "42703") {
          const recordWithoutOwner = { ...record };
          delete recordWithoutOwner.owner_user_id;
          ({ error } = await supabase.from("rental_listings").insert([recordWithoutOwner]));
        }
        if (error) throw error;
        setPostRentalForm({
          title:"", propertyType:"Apartment", price:"", deposit:"",
          pricePerNight:"", pricePerWeek:"",
          availableFrom:"", availableTo:"", maxGuests:"", houseRules:"", petsAllowed:false,
          address:"Abilene, TX", bedrooms:"", bathrooms:"",
          description:"", phone:"", email:"", externalUrl:"",
          duration:"30 Days",
        });
        setPostRentalPhotos([]);
        setPostRentalStep("form");
        setPostRentalError(null);
        loadRentalsPublic();
        navigateTo("rentals");
      } catch (e) {
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
              {postRentalForm.phone        && <p><strong>Phone:</strong> {postRentalForm.phone}</p>}
              {postRentalForm.email        && <p><strong>Email:</strong> {postRentalForm.email}</p>}
              {postRentalForm.externalUrl  && <p><strong>Link:</strong> {postRentalForm.externalUrl}</p>}
              <p><strong>Duration:</strong> {postRentalForm.duration}</p>
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
                const isFeatured = j.tag === "Featured" || j.plan === "featured";
                const isPremium = j.tag === "Premium" || j.plan === "premium";
                return (
                  <article key={jobsListingKey(j)} className={`marketplace-card jobs-card${isFeatured ? " jobs-card-featured" : ""}${isPremium ? " jobs-card-premium" : ""}`}>
                    <div className="marketplace-photo jobs-photo">
                      {j.image
                        ? <img src={j.image} alt="" loading="lazy" />
                        : <div className="post-job-image-placeholder"><span aria-hidden="true">💼</span></div>
                      }
                      <span className={`event-type marketplace-card-tag jobs-card-tag${isPremium ? " jobs-tag-premium" : isFeatured ? " jobs-tag-featured" : ""}`}>{j.tag}</span>
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
                {business.plan && (
                  <span className={`plan-badge plan-badge-${business.plan.toLowerCase()}`}>{business.plan}</span>
                )}
                <h2>{business.name}</h2>
                {business.description && <p>{business.description}</p>}
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
                      Visit
                    </a>
                  )}
                </div>

                {renderLikeButton("business", business.id)}
                {renderBusinessReviews(business)}
              </article>
            ))}
          </section>
        </div>
      </main>,
    );
  }

  if (businessServiceSections[page]) {
    const serviceSection = businessServiceSections[page];
    const serviceBusinesses = businessServiceBusinessesByPage[page] ?? [];
    const showServiceForm = page === "groceries" ? showGroceryForm : openBusinessServiceFormPage === page;
    const setServiceFormOpen = (isOpen) => {
      if (page === "groceries") {
        setShowGroceryForm(isOpen);
      } else {
        setOpenBusinessServiceFormPage(isOpen ? page : "");
      }
    };

    return withSplash(
      <main
        className={`app directory-page${page === "groceries" ? " groceries-page" : ""}${page === "dealers" ? " dealers-page" : ""}${page === "barbers" ? " barbers-page" : ""}${page === "insurance" ? " insurance-page" : ""}${page === "health" ? " health-page" : ""}${page === "schools" ? " schools-page" : ""}`}
        style={
          page === "groceries"
            ? { "--groceries-bg": `url("${appAsset("groceries-bg.png")}")` }
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
          <button className="back-button" onClick={() => navigateTo("more")}>
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
                <input type="hidden" name="categoryOverride" value={serviceSection.category} />
                <input type="hidden" name="planOverride" value={selectedPlan} />

                <div className="business-form-heading">
                  <p className="eyebrow">{selectedPlan} plan</p>
                  <h2>{serviceSection.formTitle}</h2>
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
                  {business.plan && (
                    <span className={`plan-badge plan-badge-${business.plan.toLowerCase()}`}>{business.plan}</span>
                  )}
                  <h2>{business.name}</h2>
                  {business.description && <p>{business.description}</p>}
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
                  </div>

                  {renderLikeButton("business", business.id)}
                  {renderBusinessReviews(business)}
                </article>
              ))}
            </section>
          ) : (
            <p className="legal-disclaimer">{serviceSection.emptyMessage}</p>
          )}
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
            <div className="admin-rental-edit-actions" style={{ marginTop: "8px" }}>
              <button
                className="admin-rental-edit-button"
                type="button"
                onClick={handleSaveRental}
                disabled={adminStatus === "saving"}
              >
                {adminStatus === "saving" ? "Saving…" : "Save Changes"}
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
            {adminStatus === "error" && (
              <p className="form-error">Could not save. Try again.</p>
            )}
            <div className="directory-actions" style={{ marginTop: "8px" }}>
              <button
                className="primary-button"
                type="button"
                onClick={handleSaveJob}
                disabled={adminStatus === "saving"}
              >
                {adminStatus === "saving" ? "Saving…" : "Save Changes"}
              </button>
              <button
                className="directory-link"
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
            <p style={{ color: "#ff0", fontWeight: 900, fontSize: "13px", letterSpacing: "0.1em", marginTop: "8px" }}>JOBS EDIT SCREEN FIX VERSION 1</p>
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
                    <label className="form-field">
                      <span>Date</span>
                      <input name="eventDate" type="date" required />
                    </label>
                    <label className="form-field">
                      <span>Time</span>
                      <input name="eventTime" type="text" placeholder="8:00 PM" required />
                    </label>
                    <label className="form-field">
                      <span>Type</span>
                      <input name="eventType" type="text" placeholder="Live music, Family, Food..." required />
                    </label>
                    <label className="form-field">
                      <span>Photo</span>
                      <input name="eventImage" type="file" accept="image/*" />
                    </label>
                  </div>

                  <button className="primary-button subscribe-button" type="submit" disabled={eventSubmissionStatus === "saving"}>
                    {eventSubmissionStatus === "saving" ? "Saving..." : "Publish Event"}
                  </button>

                  {eventSubmissionStatus && (
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
                        <h3>{event.title}</h3>
                        <p>{event.place}</p>
                        <p>{formatEventDisplayDate(event.event_date, event.event_time)}</p>
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
                        <h3>{event.title}</h3>
                        <p>{event.place}</p>
                        <p>{formatEventDisplayDate(event.event_date, event.event_time)}</p>
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
                            onClick={() => moderateItem("gallery_submissions", photo.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => moderateItem("gallery_submissions", photo.id, "rejected")}
                          >
                            Reject
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
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => moderateItem("business_submissions", business.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => moderateItem("business_submissions", business.id, "rejected")}
                          >
                            Reject
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteBusiness(business.id)}
                          >
                            Delete
                          </button>
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

                      return (
                        <article className="admin-card" key={`payment-${business.id}`}>
                          <span className={`event-type payment-status payment-${business.payment_status}`}>
                            {business.payment_status}
                          </span>
                          <h3>{business.business_name}</h3>
                          <p>{business.plan} plan</p>
                          <p>Status: {business.status}</p>
                          {business.contact_email && <p>Email: {business.contact_email}</p>}
                          <p>{new Date(business.created_at).toLocaleDateString()}</p>
                          {paymentRecord ? (
                            <>
                              <p>Gross Amount: {formatPaymentAmount(paymentRecord.gross_amount, paymentRecord.currency)}</p>
                              <p>Stripe Fee: {formatPaymentAmount(paymentRecord.stripe_fee, paymentRecord.currency)}</p>
                              <p>Net Amount: {formatPaymentAmount(paymentRecord.net_amount, paymentRecord.currency)}</p>
                              {paymentRecord.paid_at && <p>Paid: {new Date(paymentRecord.paid_at).toLocaleDateString()}</p>}
                            </>
                          ) : (
                            <p>Payment amounts: not recorded yet</p>
                          )}
                          <div className="directory-actions">
                            {renderBusinessPlanButtons(business)}
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => moderateItem("business_submissions", business.id, "approved")}
                              disabled={business.status === "approved"}
                            >
                              Approve
                            </button>
                            <button
                              className="directory-link danger-link"
                              type="button"
                              onClick={() => deleteBusiness(business.id)}
                            >
                              Delete
                            </button>
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

                {adminJobListings.length ? (
                  <div className="admin-grid">
                    {adminJobListings.map((job) => (
                      <article className="admin-card" key={job.id}>
                        <span className="event-type">{job.plan} — {job.status}</span>
                        <h3>{job.title}</h3>
                        <p>{job.company}</p>
                        {job.category && <p>Category: {job.category}</p>}
                        {job.job_type && <p>Type: {job.job_type}</p>}
                        {job.pay_label && <p>Pay: {job.pay_label}</p>}
                        {job.location && <p>Location: {job.location}</p>}
                        {job.phone && <p>Phone: {job.phone}</p>}
                        {job.email && <p>Email: {job.email}</p>}
                        {job.app_method && <p>Apply via: {job.app_method}</p>}
                        {job.duration && <p>Duration: {job.duration}</p>}
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
                                onClick={() => moderateItem("job_listings", job.id, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => moderateItem("job_listings", job.id, "rejected")}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {job.status === "approved" && (
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => moderateItem("job_listings", job.id, "hidden")}
                            >
                              Hide
                            </button>
                          )}
                          {(job.status === "hidden" || job.status === "rejected") && (
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => moderateItem("job_listings", job.id, "approved")}
                            >
                              Show / Restore
                            </button>
                          )}
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => { setEditingJob({ ...job }); setEditJobPage(true); }}
                          >
                            Edit
                          </button>
                          {job.status === "approved" && (
                            <>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => setJobPlan(job, "free")}
                                disabled={job.plan === "free"}
                              >
                                Plan Free
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => setJobPlan(job, "featured")}
                                disabled={job.plan === "featured"}
                              >
                                Plan Featured
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => setJobPlan(job, "premium")}
                                disabled={job.plan === "premium"}
                              >
                                Plan Premium
                              </button>
                            </>
                          )}
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => handleDeleteJob(job.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
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
                            <span>Replace photo (optional)</span>
                            <input type="file" name="photo" accept="image/*" />
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
                        {listing.image_data && (
                          <img
                            src={listing.image_data}
                            alt={listing.title}
                            style={{ width: "100%", maxHeight: "140px", objectFit: "cover", borderRadius: "8px", marginBottom: "8px" }}
                          />
                        )}
                        <span className={`event-type marketplace-admin-status marketplace-status-${listing.status}`}>
                          {listing.status}
                        </span>
                        <h3>{listing.title}</h3>
                        {listing.price && <p>Price: {listing.price}</p>}
                        {listing.category && <p>Category: {listing.category}</p>}
                        {listing.location && <p>Location: {listing.location}</p>}
                        {listing.contact && <p>Contact: {listing.contact}</p>}
                        {listing.owner_user_id && <p style={{ fontSize: "0.8em", opacity: 0.6 }}>Owner: {listing.owner_user_id}</p>}
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
                          <button
                            className="directory-link marketplace-admin-action"
                            type="button"
                            onClick={() => setEditingListing({ ...mapListingFromDb(listing), _origStatus: listing.status })}
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
                {filteredAdminRentalListings.length > 0 ? (
                  <div className="admin-cards-grid">
                    {filteredAdminRentalListings.map((r) => {
                      const rentalStatus = r.status ?? "approved";
                      const rentalPlan = String(r.plan ?? "free").toLowerCase();

                      return (
                      <article key={r.id} className="admin-card">
                        {r.image_data?.[0] && (
                          <img src={r.image_data[0]} alt={r.title} className="admin-card-img" />
                        )}
                        <div className="admin-card-body">
                          <p className="admin-card-type">{r.property_type ?? "Rental"}</p>
                          <p className="admin-card-title">{r.title}</p>
                          <p className="admin-card-meta">{r.address}</p>
                          {r.price && <p className="admin-card-meta">${r.price}/mo</p>}
                          {r.price_per_night && <p className="admin-card-meta">${r.price_per_night}/night</p>}
                          <p className="admin-card-meta">
                            Status: <strong>{rentalStatus}</strong> · Plan: <strong>{rentalPlan}</strong>
                          </p>
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
                                onClick={() => handleSetRentalStatus(r, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleSetRentalStatus(r, "rejected")}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {rentalStatus === "approved" && (
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => handleToggleRentalStatus(r)}
                            >
                              Hide
                            </button>
                          )}
                          {(rentalStatus === "hidden" || rentalStatus === "rejected") && (
                            <button
                              className="directory-link"
                              type="button"
                              onClick={() => handleSetRentalStatus(r, "approved")}
                            >
                              Show / Restore
                            </button>
                          )}
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => { setEditingRental({ ...r }); setEditRentalPage(true); setAdminStatus(""); }}
                          >
                            Edit
                          </button>
                          {rentalStatus === "approved" && (
                            <>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleSetRentalPlan(r, "free")}
                                disabled={rentalPlan === "free"}
                              >
                                Plan Free
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleSetRentalPlan(r, "featured")}
                                disabled={rentalPlan === "featured"}
                              >
                                Plan Featured
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleSetRentalPlan(r, "premium")}
                                disabled={rentalPlan === "premium"}
                              >
                                Plan Premium
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleSetRentalPromo(r, "featured")}
                                disabled={rentalPlan === "featured"}
                              >
                                Promo Featured Free
                              </button>
                              <button
                                className="directory-link"
                                type="button"
                                onClick={() => handleSetRentalPromo(r, "premium")}
                                disabled={rentalPlan === "premium"}
                              >
                                Promo Premium Free
                              </button>
                            </>
                          )}
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => handleDeleteRental(r.id)}
                          >
                            Delete
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
                          >
                            Delete
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
                          <button className="directory-link" type="button" onClick={() => hideStaticGalleryPhoto(photo)}>
                            Hide
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteStaticItem(staticGalleryKey(photo), photo.title)}
                          >
                            Delete
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
                          <button className="directory-link" type="button" onClick={() => restoreStaticGalleryPhoto(photo)}>
                            Restore
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteStaticItem(staticGalleryKey(photo), photo.title)}
                          >
                            Delete
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
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => unpublishBusiness(business.id)}
                          >
                            Unpublish
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteBusiness(business.id)}
                          >
                            Delete
                          </button>
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
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => restoreBusiness(business)}
                          >
                            Restore
                          </button>
                          <button
                            className="directory-link danger-link"
                            type="button"
                            onClick={() => deleteBusiness(business.id)}
                          >
                            Delete
                          </button>
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
          <button className="back-button" onClick={backToLobby}>
            Back to lobby
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
