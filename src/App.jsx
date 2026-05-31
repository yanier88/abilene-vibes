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
  "terms",
  "privacy",
  "admin",
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

const promoteCategories = [
  { label: "Food trucks", icon: "foodTruck" },
  { label: "Restaurants", icon: "restaurant" },
  { label: "Clubs & Bars", icon: "bars" },
  { label: "Barber Shop", icon: "barber" },
  { label: "Hotels", icon: "hotels" },
  { label: "Others", icon: "others" },
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
    note: "Monthly subscription. Auto-renews until canceled.",
  },
  {
    name: "Premium",
    price: "$59",
    cadence: "per month",
    note: "Monthly subscription. Auto-renews until canceled.",
  },
];

const legalSections = {
  terms: {
    eyebrow: "Legal",
    title: "Terms of Use",
    intro:
      "These terms explain how businesses and visitors may use Abilene Vibes. They are a practical starting point and should be reviewed by a lawyer before heavy commercial launch.",
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
          "Free, Featured, and Premium placements may be reviewed, edited, approved, rejected, paused, or removed to keep listings accurate, lawful, and appropriate for the app.",
      },
      {
        title: "Monthly billing and cancellation",
        copy:
          "Featured and Premium plans are monthly subscriptions. The customer is charged every month automatically until the subscription is canceled. Businesses may contact Abilene Vibes for billing or cancellation help.",
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
          "If payments are processed through Stripe, Square, or another payment provider, payment details are handled by that provider and are subject to their own terms and privacy policy.",
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
  { label: "Local Marketplace", icon: "sales" },
  { label: "Groceries", icon: "groceries" },
  { label: "Jobs & Hiring", icon: "jobs" },
  { label: "Rentals", icon: "rents" },
  { label: "Dealers", icon: "dealers" },
  { label: "Insurance Companies", icon: "insurance" },
  { label: "Barber Shops", icon: "barber" },
  { label: "Health", icon: "health" },
  { label: "Schools", icon: "schools" },
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

const categorySectionMap = {
  "Food trucks": "eats",
  Restaurants: "eats",
  "Clubs & Bars": "nightlife",
  Hotels: "hotels",
  "Hotels & Rents": "hotels",
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
  const imageViewerPhotoRef = useRef(null);
  const pageRef = useRef(page);
  const previousPageRef = useRef(page);

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

    supabase
      .from("business_reviews")
      .select("id,created_at,business_id,business_name,reviewer_name,rating,comment")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error || !data) {
          return;
        }

        const nextReviews = data.reduce((groups, review) => {
          groups[review.business_id] = [...(groups[review.business_id] ?? []), review];
          return groups;
        }, {});

        setApprovedReviews(nextReviews);
      });

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
        if (error || !data) {
          setLocalNewsItems([]);
          return;
        }

        setLocalNewsItems(data);
      });

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
  }, [visitorKey]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase
      .from("business_submissions")
      .select("id,business_name,category,phone,address,social,description,image_data,plan,payment_status,placement_source,placement_expires_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          const approvedBusinesses = data.map(businessSubmissionToBusiness);

          setBusinesses(approvedBusinesses);
        }
      });

    supabase
      .from("hidden_static_items")
      .select("item_key,item_type")
      .then(({ data, error }) => {
        if (!error && data) {
          setHiddenStaticItems(data.filter((item) => item.item_type !== "deleted").map((item) => item.item_key));
          setDeletedStaticItems(data.filter((item) => item.item_type === "deleted").map((item) => item.item_key));
        }
      });

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
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAdminSession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const navigateTo = useCallback((nextPage, options = {}) => {
    pageRef.current = nextPage;
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
      const currentPage = pageRef.current;

      if (imageViewerPhotoRef.current) {
        setImageViewerPhoto(null);
        return;
      }

      if (currentPage === "home") {
        CapacitorApp.exitApp();
        return;
      }

      if (currentPage === "lobby") {
        navigateTo("home");
        return;
      }

      if (currentPage === "news") {
        pageRef.current = "more";
        navigateTo("more", { replace: true });
        return;
      }

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
    const business = {
      id: submissionId,
      name: formData.get("businessName").trim(),
      contactName: formData.get("contactName").trim(),
      contactEmail: formData.get("contactEmail").trim(),
      category: selectedCategory,
      phone: formData.get("phone").trim(),
      social: formData.get("social").trim(),
      address: formData.get("address").trim(),
      description: formData.get("description").trim(),
      image: imageData,
      plan: selectedPlan,
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
      });

      if (error) {
        setSubmissionStatus("error");
        return;
      }

      setSubmissionStatus("saved");
    } else {
      setSubmissionStatus("local");
      setBusinesses((currentBusinesses) => [business, ...currentBusinesses]);
    }

    setBusinessSubmitted(true);

    if (isSupabaseSubmission && paidPlanNames.has(selectedPlan)) {
      setSubmissionStatus("checkout");
      const returnUrl = window.location.origin.startsWith("https://") ? window.location.origin : "";
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          submissionId,
          plan: selectedPlan,
          businessName: business.name,
          contactEmail: business.contactEmail,
          returnUrl,
        },
      });

      if (data?.url) {
        openCheckoutUrl(data.url);
        return;
      }

      setSubmissionStatus(error?.message?.includes("APP_PUBLIC_URL") ? "checkout-config" : "checkout-error");
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
      hiddenEventResult.error
    ) {
      setAdminStatus("error");
      return;
    }

    setPendingGalleryPhotos(galleryResult.data ?? []);
    setPublishedGalleryPhotos(publishedGalleryResult.data ?? []);
    setPendingBusinesses(businessResult.data ?? []);
    setPublishedBusinesses(publishedBusinessResult.data ?? []);
    setBusinesses((publishedBusinessResult.data ?? []).map(businessSubmissionToBusiness));
    setHiddenBusinesses(hiddenBusinessResult.data ?? []);
    setHiddenStaticItems((hiddenStaticResult.data ?? []).filter((item) => item.item_type !== "deleted").map((item) => item.item_key));
    setDeletedStaticItems((hiddenStaticResult.data ?? []).filter((item) => item.item_type === "deleted").map((item) => item.item_key));
    setPendingReviews(reviewResult.data ?? []);
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
  const lobbyClickReports = itemReports.filter((report) => report.itemType === "Lobby");
  const serviceClickReports = itemReports.filter((report) => report.itemType !== "Lobby");
  const lobbyCarouselLength = lobbyFeaturedBusinesses.length + 1;
  const normalizedLobbyCarouselIndex = lobbyCarouselIndex % lobbyCarouselLength;
  const isLobbyAboutSlide = normalizedLobbyCarouselIndex === 0 || !lobbyFeaturedBusinesses.length;
  const lobbyCarouselBusiness = isLobbyAboutSlide ? null : lobbyFeaturedBusinesses[normalizedLobbyCarouselIndex - 1];
  const spotlightBusiness = premiumBusinesses[premiumCarouselIndex % Math.max(premiumBusinesses.length, 1)] ?? paidBusinesses[0];
  const spotlightEvent = allEvents[0] ?? events[0];
  const [spotlightEventDate, spotlightEventTime = ""] = spotlightEvent.date.split(" - ");
  const openUpcomingHighlight = async () => {
    if (!spotlightBusiness) {
      await trackLobbySectionClick("upcoming-highlight", "Upcoming Highlight");
      navigateTo("events");
      return;
    }

    await trackPublicItemClick("service", `lobby-highlight-${spotlightBusiness.id}`, `Lobby: Highlight ${spotlightBusiness.name}`);
    navigateTo(categorySectionMap[spotlightBusiness.category] ?? "directory");
  };
  const categoryBusinessesFor = (section) =>
    paidBusinesses.filter((business) => categorySectionMap[business.category] === section);
  const directoryBusinesses = [...allBusinesses].sort(
    (a, b) => (planRank[a.plan ?? "Free"] ?? 99) - (planRank[b.plan ?? "Free"] ?? 99),
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
    if (premiumBusinesses.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setPremiumCarouselIndex((currentIndex) => (currentIndex + 1) % premiumBusinesses.length);
    }, premiumPromotionRotationMs);

    return () => window.clearInterval(timer);
  }, [premiumBusinesses.length]);

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
            className={`lobby-about${lobbyCarouselBusiness ? " is-featured" : ""}`}
            type="button"
            onClick={async () => {
              if (lobbyCarouselBusiness) {
                await trackPublicItemClick("service", `lobby-featured-${lobbyCarouselBusiness.id}`, `Lobby: Featured ${lobbyCarouselBusiness.name}`);
                navigateTo(categorySectionMap[lobbyCarouselBusiness.category] ?? "directory");
              }
            }}
            aria-label={lobbyCarouselBusiness ? `Featured business ${lobbyCarouselBusiness.name}` : "About Abilene Vibes"}
          >
            {lobbyCarouselBusiness ? (
              <>
                <img className="lobby-about-thumb" src={businessDisplayImage(lobbyCarouselBusiness)} alt="" />
                <span>Featured local</span>
                <strong>{lobbyCarouselBusiness.name}</strong>
                <p>{lobbyCarouselBusiness.category}</p>
                {lobbyCarouselBusiness.phone && <p>{lobbyCarouselBusiness.phone}</p>}
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
            {spotlightBusiness ? (
              <>
                <img src={businessDisplayImage(spotlightBusiness)} alt="" />
                <div>
                  <span>Upcoming Highlight</span>
                  <strong>{spotlightBusiness.name}</strong>
                  <p>{spotlightBusiness.category}</p>
                  <p>{spotlightBusiness.phone}</p>
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
              <p className="legal-disclaimer">
                {selectedPlan} is a monthly subscription. You will be charged {selectedPlan === "Featured" ? "$19" : "$59"} today
                and automatically every month until the subscription is canceled. Contact {contactEmail} for billing or
                cancellation help.
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
                {business.plan && business.plan !== "Free" && <span className="plan-badge">{business.plan}</span>}
                <h2>{business.name}</h2>
                {business.description && <p>{business.description}</p>}

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
                </div>

                {paymentBusinesses.length ? (
                  <div className="admin-grid">
                    {paymentBusinesses.map((business) => (
                      <article className="admin-card" key={`payment-${business.id}`}>
                        <span className={`event-type payment-status payment-${business.payment_status}`}>
                          {business.payment_status}
                        </span>
                        <h3>{business.business_name}</h3>
                        <p>{business.plan} plan</p>
                        <p>Status: {business.status}</p>
                        {business.contact_email && <p>Email: {business.contact_email}</p>}
                        <p>{new Date(business.created_at).toLocaleDateString()}</p>
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
                    ))}
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
