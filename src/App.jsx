import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const appAsset = (path) => `${import.meta.env.BASE_URL}${path}`;

const mapSearchUrl = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const telUrl = (phone) => `tel:${phone.replace(/\D/g, "")}`;

const stripePaymentLinks = {
  Featured: import.meta.env.VITE_STRIPE_FEATURED_LINK ?? "",
  Premium: import.meta.env.VITE_STRIPE_PREMIUM_LINK ?? "",
};

const contactEmail = "abilenevibes@gmail.com";

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
  const hashPage = window.location.hash.replace("#", "").split("/")[0];
  const queryPage = new URLSearchParams(window.location.search).get("page");

  if (validPages.has(hashPage)) {
    return hashPage;
  }

  return validPages.has(queryPage) ? queryPage : "home";
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
    title: "Pine Street",
    image: appAsset("ded1242b-9c25-4b2b-b16d-5b36ffe01e51.jpg"),
  },
  {
    title: "Condley Downtown",
    image: appAsset("94190f7b-27db-4b0f-b85e-84b6da72fbf2.jpg"),
  },
  {
    title: "Grain Theory Block Party",
    image: appAsset("64d46fa8-3f51-4bce-ae95-07f74746d75b.jpg"),
  },
  {
    title: "Texas & Pacific Marker",
    image: appAsset("77c9ff59-9fba-479d-94f7-14de54433b15.jpg"),
  },
  {
    title: "Downtown Brick Walk",
    image: appAsset("64dc2bcf-e858-42d9-a881-12d069e4b919.jpg"),
  },
  {
    title: "Paramount Marquee",
    image: appAsset("1fd1ea2a-acb5-47b2-81dc-6e9fd898f418.jpg"),
  },
  {
    title: "Grain Theory Patio",
    image: appAsset("522c6f5e-6918-4dd3-8874-3eaaa75430a2.jpg"),
  },
  {
    title: "Grain Theory Corner",
    image: appAsset("9e98df0d-dc19-429c-8205-675ba9cff023.jpg"),
  },
  {
    title: "Downtown Abilene",
    image: appAsset("227005f7-a560-45d7-bea9-557e2cee61f3.jpg"),
  },
  {
    title: "Cypress Street",
    image: appAsset("95547aea-c652-48bc-bff2-3f9f645236e3.jpg"),
  },
  {
    title: "Abilene Mural",
    image: appAsset("553b9d8e-d087-4267-a0dc-d475fd25f231.jpg"),
  },
  {
    title: "The Grace",
    image: appAsset("45cbacf8-d03a-4d23-ba5d-0f59509c79c6.jpg"),
  },
  {
    title: "Abilene Banner",
    image: appAsset("bd916012-2fb5-4dd1-b854-77a3b801bcd4.jpg"),
  },
  {
    title: "Downtown Nights",
    image: appAsset("nightlife-station.jpg"),
  },
  {
    title: "Paramount Theatre",
    image: appAsset("nightlife-paramount.jpg"),
  },
  {
    title: "Movie Night",
    image: appAsset("nightlife-cinemark.jpg"),
  },
  {
    title: "Cocktail Hour",
    image: appAsset("nightlife-suite.jpg"),
  },
];

const promoteCategories = [
  { label: "Food trucks", icon: "foodTruck" },
  { label: "Restaurants", icon: "restaurant" },
  { label: "Clubs & Bars", icon: "bars" },
  { label: "Barber Shop", icon: "barber" },
  { label: "Hotels & Rents", icon: "hotels" },
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
    note: "Photos, buttons, and category placement",
  },
  {
    name: "Premium",
    price: "$59",
    cadence: "per month",
    note: "Top placement, gallery feature, and lobby spotlight",
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
    label: "Hotels & Rents",
    description: "Find hotels and rentals in Abilene.",
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
  address: business.address ?? "",
  social: business.social ?? "",
  description: business.description ?? "",
  plan: business.plan,
});

const planRank = {
  Premium: 0,
  Featured: 1,
  Free: 2,
};

const categorySectionMap = {
  "Food trucks": "eats",
  Restaurants: "eats",
  "Clubs & Bars": "nightlife",
  "Hotels & Rents": "hotels",
};

const businessImageForCategory = (category) => {
  if (category === "Clubs & Bars") {
    return appAsset("nightlife-station.jpg");
  }

  if (category === "Hotels & Rents") {
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
  const [approvedGalleryPhotos, setApprovedGalleryPhotos] = useState([]);
  const [gallerySubmissionStatus, setGallerySubmissionStatus] = useState("");
  const [gallerySubmissionError, setGallerySubmissionError] = useState("");
  const [adminSession, setAdminSession] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminStatus, setAdminStatus] = useState("");
  const [pendingGalleryPhotos, setPendingGalleryPhotos] = useState([]);
  const [publishedGalleryPhotos, setPublishedGalleryPhotos] = useState([]);
  const [pendingBusinesses, setPendingBusinesses] = useState([]);
  const [publishedBusinesses, setPublishedBusinesses] = useState([]);
  const [hiddenBusinesses, setHiddenBusinesses] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [businessReports, setBusinessReports] = useState([]);
  const adminShortcutRef = useRef({ count: 0, timer: null });

  useEffect(() => {
    const splashTimer = window.setTimeout(() => {
      setIsStarting(false);
    }, 3000);

    return () => {
      window.clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => () => {
    if (adminShortcutRef.current.timer) {
      window.clearTimeout(adminShortcutRef.current.timer);
    }
  }, []);

  useEffect(() => {
    window.history.replaceState({ page: pageFromLocation() }, "", window.location.href);

    const syncPageFromUrl = () => {
      setPage(pageFromLocation());
      window.scrollTo(0, 0);
    };

    window.addEventListener("popstate", syncPageFromUrl);

    return () => {
      window.removeEventListener("popstate", syncPageFromUrl);
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
  }, [visitorKey]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase
      .from("business_submissions")
      .select("id,business_name,category,phone,address,social,description,plan")
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
      .select("item_key")
      .then(({ data, error }) => {
        if (!error && data) {
          setHiddenStaticItems(data.map((item) => item.item_key));
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

  const navigateTo = (nextPage, options = {}) => {
    setPage(nextPage);

    if (options.replace) {
      window.history.replaceState({ page: nextPage }, "", urlForPage(nextPage));
    } else {
      window.history.pushState({ page: nextPage }, "", urlForPage(nextPage));
    }

    window.scrollTo(0, 0);
  };

  const backToLobby = () => {
    navigateTo("lobby", { replace: true });
  };

  const openAdminShortcut = () => {
    if (adminShortcutRef.current.timer) {
      window.clearTimeout(adminShortcutRef.current.timer);
    }

    adminShortcutRef.current.count += 1;

    if (adminShortcutRef.current.count >= 10) {
      adminShortcutRef.current.count = 0;
      navigateTo("admin");
      return;
    }

    adminShortcutRef.current.timer = window.setTimeout(() => {
      adminShortcutRef.current.count = 0;
    }, 1800);
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
    const business = {
      id: `${Date.now()}-${formData.get("businessName")}`,
      name: formData.get("businessName").trim(),
      category: selectedCategory,
      phone: formData.get("phone").trim(),
      social: formData.get("social").trim(),
      address: formData.get("address").trim(),
      description: formData.get("description").trim(),
      plan: selectedPlan,
    };

    setSubmissionStatus("saving");

    const isSupabaseSubmission = Boolean(supabase);

    if (isSupabaseSubmission) {
      const { error } = await supabase.from("business_submissions").insert({
        business_name: business.name,
        contact_name: formData.get("contactName").trim(),
        category: business.category,
        plan: business.plan,
        phone: business.phone,
        address: business.address,
        social: business.social,
        description: business.description,
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

    const paymentLink = stripePaymentLinks[selectedPlan];
    if (paymentLink) {
      window.open(paymentLink, "_blank", "noopener,noreferrer");
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

    const { error } = await supabase.from("business_reviews").insert({
      business_id: business.id,
      business_name: business.name,
      reviewer_name: formData.get("reviewerName").trim(),
      rating,
      comment: formData.get("comment").trim(),
      status: "pending",
    });

    if (error) {
      setReviewSubmissionStatus((currentStatus) => ({ ...currentStatus, [business.id]: "error" }));
      return;
    }

    form.reset();
    setReviewSubmissionStatus((currentStatus) => ({ ...currentStatus, [business.id]: "saved" }));
  };

  const trackBusinessInteraction = (business, actionType) => {
    if (!supabase) {
      return;
    }

    supabase.from("business_interactions").insert({
      business_id: business.id,
      business_name: business.name,
      action_type: actionType,
    });
  };

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
        .select("id,created_at,business_name,contact_name,category,plan,phone,address,social,description,payment_status,status")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_submissions")
        .select("id,created_at,business_name,contact_name,category,plan,phone,address,social,description,payment_status,status")
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_submissions")
        .select("id,created_at,business_name,contact_name,category,plan,phone,address,social,description,payment_status,status")
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
        .select("created_at,item_type,item_key")
        .eq("item_type", "business"),
      supabase
        .from("business_reviews")
        .select("created_at,business_id,rating,status")
        .eq("status", "approved"),
      supabase
        .from("business_interactions")
        .select("created_at,business_id,business_name,action_type"),
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
      interactionResult.error
    ) {
      setAdminStatus("error");
      return;
    }

    setPendingGalleryPhotos(galleryResult.data ?? []);
    setPublishedGalleryPhotos(publishedGalleryResult.data ?? []);
    setPendingBusinesses(businessResult.data ?? []);
    setPublishedBusinesses(publishedBusinessResult.data ?? []);
    setHiddenBusinesses(hiddenBusinessResult.data ?? []);
    setHiddenStaticItems((hiddenStaticResult.data ?? []).map((item) => item.item_key));
    setPendingReviews(reviewResult.data ?? []);

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
      .forEach((like) => {
        ensureReport(like.item_key).likes += 1;
      });

    (approvedReviewResult.data ?? [])
      .filter((review) => new Date(review.created_at) >= monthStart)
      .forEach((review) => {
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
    setBusinessReports([]);
    setAdminStatus("");
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

  const hiddenStaticItemSet = new Set(hiddenStaticItems);
  const visibleInitialBusinesses = initialBusinesses.filter((business) => !hiddenStaticItemSet.has(`business:${business.id}`));
  const hiddenInitialBusinesses = initialBusinesses.filter((business) => hiddenStaticItemSet.has(`business:${business.id}`));
  const allBusinesses = [...businesses, ...visibleInitialBusinesses];
  const paidBusinesses = [...allBusinesses]
    .filter((business) => business.plan && business.plan !== "Free")
    .sort((a, b) => (planRank[a.plan] ?? 99) - (planRank[b.plan] ?? 99));
  const spotlightBusiness = paidBusinesses.find((business) => business.plan === "Premium") ?? paidBusinesses[0];
  const spotlightEvent = events[0];
  const [spotlightEventDate, spotlightEventTime = ""] = spotlightEvent.date.split(" - ");
  const openUpcomingHighlight = () => {
    if (!spotlightBusiness) {
      navigateTo("events");
      return;
    }

    if (spotlightBusiness.social) {
      window.open(visitUrl(spotlightBusiness.social), "_blank", "noopener,noreferrer");
      return;
    }

    if (spotlightBusiness.address) {
      window.open(
        mapSearchUrl(`${spotlightBusiness.name}, ${spotlightBusiness.address}`),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    navigateTo(categorySectionMap[spotlightBusiness.category] ?? "directory");
  };
  const categoryBusinessesFor = (section) =>
    paidBusinesses.filter((business) => categorySectionMap[business.category] === section);
  const directoryBusinesses = [...allBusinesses].sort(
    (a, b) => (planRank[a.plan ?? "Free"] ?? 99) - (planRank[b.plan ?? "Free"] ?? 99),
  );
  const galleryPhotos = [...approvedGalleryPhotos, ...galleryShots];
  const likeCountFor = (itemType, itemKey) => likeCounts[`${itemType}:${itemKey}`] ?? 0;
  const isLiked = (itemType, itemKey) => likedItems.includes(`${itemType}:${itemKey}`);
  const reviewStatusText = {
    error: "Sorry, the review could not be sent.",
    "missing-config": "Reviews are not connected yet.",
    saved: "Thanks. Your review was sent for approval.",
    saving: "Sending review...",
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
      {splashOverlay}
    </>
  );

  if (page === "lobby") {
    return withSplash(
      <main className="app photo-page">
        <section
          className="photo-feature lobby-v2"
          style={{ "--lobby-bg": `url("${appAsset("lobby-bg.png")}")` }}
          aria-label="Abilene Vibes lobby"
        >
          <button className="lobby-title-badge" type="button" onClick={openAdminShortcut} aria-label="Lobby">
            <span>Lobby</span>
          </button>

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

          <article className="lobby-about" aria-label="About Abilene Vibes">
            <span>About the app</span>
            <p>
              Abilene Vibes is your local guide to events, nightlife, eats, shopping, family plans, stays, and
              businesses around Abilene.
            </p>
          </article>

          <nav className="lobby-action-list" aria-label="Abilene Vibes sections">
            {lobbyActions.map((action) => (
              <button
                className={`lobby-action-card is-${action.tone}${action.page === "events" ? " is-priority" : ""}`}
                key={action.page}
                type="button"
                onClick={() => navigateTo(action.page)}
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

          <button className="lobby-highlight" type="button" onClick={openUpcomingHighlight} aria-label="Upcoming highlight">
            {spotlightBusiness ? (
              <>
                <img src={businessImageForCategory(spotlightBusiness.category)} alt="" />
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
            <button className="lobby-bottom-home" type="button" onClick={() => navigateTo("home")}>
              <span aria-hidden="true">⌂</span>
              Home
            </button>
            <button className="lobby-bottom-promote" type="button" onClick={() => navigateTo("promote")}>
              Promote your business
            </button>
          </div>
        </section>
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
            {events.map((event) => (
              <article className="event-card" key={`${event.title}-${event.date}`}>
                <img className="event-image" src={event.image} alt="" loading="lazy" />

                <div className="event-copy">
                  <span className="event-type">{event.type}</span>
                  <h2>{event.title}</h2>
                  <p className="event-detail">{event.place}</p>
                  <p className="event-detail">{event.date}</p>
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
                  src={businessImageForCategory(business.category)}
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
                <img
                  className="eats-image"
                  src={businessImageForCategory(business.category)}
                  alt=""
                  loading="lazy"
                />

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
                <img className="eats-image" src={place.image} alt="" loading="lazy" />

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
            <h1 id="hotels-title">Hotels & Rents</h1>
            <p className="events-intro">Find places to stay near events, food, family stops, and downtown plans.</p>
          </section>

          <section className="event-list" aria-label="Hotels and rentals">
            {categoryBusinessesFor("hotels").map((business) => (
              <article className="event-card paid-placement-card" key={business.id}>
                <img
                  className="event-image"
                  src={businessImageForCategory(business.category)}
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
                  <img src={shot.image} alt="" loading="lazy" />
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

          <form className="business-form" onSubmit={handleBusinessSubmit}>
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
                <span>Address</span>
                <input name="address" type="text" placeholder="Street address or area" />
              </label>

              <label className="form-field">
                <span>Instagram or website</span>
                <input name="social" type="text" placeholder="@business or website" />
              </label>
            </div>

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

            {businessSubmitted && (
              <p className="form-success">
                {submissionStatus === "saved"
                  ? "Thanks. Your request was saved for review."
                  : submissionStatus === "local"
                    ? "Thanks. Your request was added locally. Connect Supabase to save it permanently."
                    : selectedPlan === "Free"
                  ? "Thanks. Your business is now visible in the local directory."
                  : stripePaymentLinks[selectedPlan]
                    ? "Thanks. Your payment page opened in a new tab. We will review your listing after payment."
                    : "Thanks. Your paid plan request was saved. Add your Stripe payment link to activate checkout."}
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
                <span className="event-type">{business.category}</span>
                {business.plan && business.plan !== "Free" && <span className="plan-badge">{business.plan}</span>}
                <h2>{business.name}</h2>
                {business.description && <p>{business.description}</p>}

                <div className="directory-actions">
                  {business.phone && (
                    <a
                      className="directory-link"
                      href={`tel:${business.phone.replace(/\D/g, "")}`}
                      onClick={() => trackBusinessInteraction(business, "calls")}
                    >
                      Call
                    </a>
                  )}

                  {business.address && (
                    <a
                      className="directory-link"
                      href={mapSearchUrl(`${business.name}, ${business.address}`)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackBusinessInteraction(business, "directions")}
                    >
                      Directions
                    </a>
                  )}

                  {business.social && (
                    <a
                      className="directory-link"
                      href={visitUrl(business.social)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackBusinessInteraction(business, "visits")}
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

              <section className="admin-section" aria-labelledby="admin-gallery-title">
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

              <section className="admin-section" aria-labelledby="admin-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Pending</p>
                  <h2 id="admin-business-title">Businesses</h2>
                </div>

                {pendingBusinesses.length ? (
                  <div className="admin-grid">
                    {pendingBusinesses.map((business) => (
                      <article className="admin-card" key={business.id}>
                        <span className="event-type">{business.plan} - {business.payment_status}</span>
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
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
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No pending businesses.</p>
                )}
              </section>

              <section className="admin-section" aria-labelledby="admin-review-title">
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

              <section className="admin-section" aria-labelledby="admin-report-title">
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

              <section className="admin-section" aria-labelledby="admin-published-gallery-title">
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

              <section className="admin-section" aria-labelledby="admin-published-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Published</p>
                  <h2 id="admin-published-business-title">Businesses</h2>
                </div>

                {publishedBusinesses.length ? (
                  <div className="admin-grid">
                    {publishedBusinesses.map((business) => (
                      <article className="admin-card" key={business.id}>
                        <span className="event-type">{business.plan} - {business.payment_status}</span>
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => unpublishBusiness(business.id)}
                          >
                            Unpublish
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No published businesses yet.</p>
                )}
              </section>

              <section className="admin-section" aria-labelledby="admin-hidden-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Hidden</p>
                  <h2 id="admin-hidden-business-title">Businesses</h2>
                </div>

                {hiddenBusinesses.length ? (
                  <div className="admin-grid">
                    {hiddenBusinesses.map((business) => (
                      <article className="admin-card" key={business.id}>
                        <span className="event-type">{business.plan} - {business.payment_status}</span>
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          <button
                            className="directory-link"
                            type="button"
                            onClick={() => restoreBusiness(business)}
                          >
                            Restore
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="legal-disclaimer">No hidden published businesses.</p>
                )}
              </section>

              <section className="admin-section" aria-labelledby="admin-built-in-business-title">
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
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
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
            src={appAsset("3110a91c-36c2-4c99-b245-e5856062f992.jpg")}
            alt=""
          />
          <button className="home-hero-button" onClick={() => navigateTo("lobby")} aria-label="Explore Abilene" />
        </div>
      </section>
    </main>,
  );
}

export default App;
