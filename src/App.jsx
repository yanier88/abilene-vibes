import { useEffect, useState } from "react";
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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      })
    : null;

const validPages = new Set([
  "home",
  "lobby",
  "events",
  "calendar",
  "nightlife",
  "eats",
  "family",
  "hotels",
  "gallery",
  "promote",
  "directory",
  "terms",
  "privacy",
]);

const pageFromLocation = () => {
  const hashPage = window.location.hash.replace("#", "").split("/")[0];

  return validPages.has(hashPage) ? hashPage : "home";
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

const nightlifePlaces = [
  {
    name: "Guitars and Cadillacs",
    kind: "Dance hall",
    phone: "(325) 692-8077",
    address: "3881 Vine St, Abilene, TX 79602",
    website: "http://guitars-cadillacs.com",
    image: appAsset("nightlife-guitars.jpg"),
  },
  {
    name: "The Ugly Lime",
    kind: "Bar",
    phone: "(325) 695-8185",
    address: "4109 S Danville Dr, Abilene, TX 79605",
    website: "https://www.instagram.com/theuglylimebar/",
    image: appAsset("nightlife-ugly-lime.jpg"),
  },
  {
    name: "Mi Gente Club",
    kind: "Club",
    phone: "(325) 675-9776",
    address: "157 Burger St, Abilene, TX 79603",
    website: "https://www.google.com/search?q=Mi+Gente+Club+Abilene+TX",
    image: appAsset("nightlife-suite.jpg"),
  },
  {
    name: "The Station",
    kind: "Lounge",
    phone: "(325) 437-1336",
    address: "618 S Pioneer Dr, Abilene, TX 79605",
    website: "https://www.google.com/search?q=The+Station+Abilene+TX+lounge",
    image: appAsset("nightlife-station.jpg"),
  },
  {
    name: "Club Rodeo",
    kind: "Dance hall",
    phone: "(325) 692-8077",
    address: "3881 Vine St, Abilene, TX 79602",
    website: "http://guitars-cadillacs.com",
    image: appAsset("nightlife-guitars.jpg"),
  },
  {
    name: "Suite",
    kind: "Club",
    phone: "(325) 698-1234",
    address: "4250 Ridgemont Dr, Abilene, TX 79606",
    website: "https://www.mcmelegantesuites.com/",
    image: appAsset("nightlife-suite.jpg"),
  },
  {
    name: "Paramount Theatre",
    kind: "Theatre",
    phone: "(325) 676-9620",
    address: "352 Cypress St, Abilene, TX 79601",
    website: "https://www.paramountabilene.com/",
    image: appAsset("nightlife-paramount.jpg"),
  },
  {
    name: "Cinemark",
    kind: "Cinema",
    phone: "(325) 670-0097",
    address: "672 E Overland Trl, Abilene, TX 79601",
    website: "https://www.cinemark.com/theatres/tx-abilene/cinemark-abilene-and-xd",
    image: appAsset("nightlife-cinemark.jpg"),
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
    page: "calendar",
    label: "Calendar",
    description: "See what's happening this week.",
    icon: "▦",
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
  const [page, setPage] = useState("home");
  const [isStarting, setIsStarting] = useState(true);
  const [weather, setWeather] = useState({ temp: 72, isDay: false, label: "Abilene, TX" });
  const [selectedCategory, setSelectedCategory] = useState(promoteCategories[0].label);
  const [selectedPlan, setSelectedPlan] = useState(promotePlans[0].name);
  const [businessSubmitted, setBusinessSubmitted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [businesses, setBusinesses] = useState(initialBusinesses);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => {
      setIsStarting(false);
    }, 3000);

    return () => {
      window.clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    window.history.replaceState({ page: "home" }, "", urlForPage("home"));

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

  const handleRequiredInvalid = (event) => {
    event.currentTarget.setCustomValidity("Please complete this field.");
  };

  const handleRequiredInput = (event) => {
    event.currentTarget.setCustomValidity("");
  };

  const handleBusinessSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
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

    if (supabase) {
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
    }

    setBusinesses((currentBusinesses) => [business, ...currentBusinesses]);
    setBusinessSubmitted(true);

    const paymentLink = stripePaymentLinks[selectedPlan];
    if (paymentLink) {
      window.open(paymentLink, "_blank", "noopener,noreferrer");
    }

    event.currentTarget.reset();
  };

  const paidBusinesses = [...businesses]
    .filter((business) => business.plan && business.plan !== "Free")
    .sort((a, b) => (planRank[a.plan] ?? 99) - (planRank[b.plan] ?? 99));
  const spotlightBusiness = paidBusinesses.find((business) => business.plan === "Premium") ?? paidBusinesses[0];
  const categoryBusinessesFor = (section) =>
    paidBusinesses.filter((business) => categorySectionMap[business.category] === section);
  const directoryBusinesses = [...businesses].sort(
    (a, b) => (planRank[a.plan ?? "Free"] ?? 99) - (planRank[b.plan ?? "Free"] ?? 99),
  );

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

          <nav className="lobby-action-list" aria-label="Abilene Vibes sections">
            {lobbyActions.map((action) => (
              <button
                className={`lobby-action-card is-${action.tone}`}
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

          <article className="lobby-highlight" aria-label="Upcoming highlight">
            {spotlightBusiness ? (
              <>
                <img src={businessImageForCategory(spotlightBusiness.category)} alt="" />
                <div>
                  <span>{spotlightBusiness.plan} Spotlight</span>
                  <strong>{spotlightBusiness.name}</strong>
                  <p>{spotlightBusiness.category}</p>
                  <p>{spotlightBusiness.phone}</p>
                </div>
              </>
            ) : (
              <>
                <img src={events[0].image} alt="" />
                <div>
                  <span>Upcoming Highlight</span>
                  <strong>Live Music Friday</strong>
                  <p>The Paramount Theatre</p>
                  <p>8:00 PM</p>
                </div>
              </>
            )}
          </article>

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
            <p className="events-intro">Curated photos selected by Abilene Vibes.</p>
          </section>

          <section className="gallery-grid" aria-label="Abilene Vibes gallery">
            {galleryShots.map((shot) => (
              <figure className="gallery-card" key={shot.title}>
                <img src={shot.image} alt="" loading="lazy" />
                <figcaption>{shot.title}</figcaption>
              </figure>
            ))}
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
                    <a className="directory-link" href={`tel:${business.phone.replace(/\D/g, "")}`}>
                      Call
                    </a>
                  )}

                  {business.address && (
                    <a
                      className="directory-link"
                      href={mapSearchUrl(`${business.name}, ${business.address}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Directions
                    </a>
                  )}

                  {business.social && (
                    <a className="directory-link" href={visitUrl(business.social)} target="_blank" rel="noreferrer">
                      Visit
                    </a>
                  )}
                </div>
              </article>
            ))}
          </section>
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
      <section
        className="home-hero"
        style={{ "--home-hero-image": `url("${appAsset("home-new-hd.png")}")` }}
        aria-label="Abilene Vibes"
      >
        <div className="home-cta">
          <button className="primary-button" onClick={() => navigateTo("lobby")}>
            Explore Abilene
          </button>
        </div>
      </section>
    </main>,
  );
}

export default App;
