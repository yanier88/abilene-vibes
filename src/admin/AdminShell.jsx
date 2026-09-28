// Admin-only shell extracted from the current validated Admin view.
import './AdminBase.css';
import { AdminReports } from './AdminReports.jsx';
import AdminMarketplacePage from "../components/AdminMarketplacePage.jsx";
import { MARKETPLACE_METADATA } from "../components/adminMarketplace.mjs";
import { settleAdminReads } from "../auth/adminModuleReads.mjs";
import AdminCardMedia from "../components/AdminCardMedia.jsx";
import PasswordField from "../components/PasswordField.jsx";
import { adminDate, adminBadgeText } from "../components/adminPresentation.mjs";
import AdminWorkspace from "../components/AdminWorkspace.jsx";
import { adminCounters } from "../components/adminDashboard.mjs";
import { moderateAndReload } from "../auth/adminModeration.mjs";
import AdminOwnershipClaims from "../components/AdminOwnershipClaims.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { createAdminWebSession } from "../auth/adminWebSession.mjs";
import { EventFields } from "../components/EventFields.jsx";
const appAsset = path => `${import.meta.env.BASE_URL}${path}`;
const formatPaymentAmount = (amount, currency = "usd") => {
  const value = Number(amount ?? 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase()
  }).format(value);
};
const cleanEnvValue = (value, variableName) => {
  const assignmentPrefix = `${variableName}=`;
  let cleanValue = String(value ?? "").trim().replace(/^["']|["']$/g, "");
  if (cleanValue.startsWith(assignmentPrefix)) {
    cleanValue = cleanValue.slice(assignmentPrefix.length).trim();
  }
  return cleanValue;
};
const normalizeSupabaseUrl = value => {
  const cleanValue = cleanEnvValue(value, "VITE_SUPABASE_URL").replace(/^Value\s*/i, "").replace(/^https\/\//, "https://");
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
  const anonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY").match(/sb_publishable_\S+/)?.[0] ?? cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return null;
  }
  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch {
    return null;
  }
};
const supabase = createSupabaseClient();
const events = [];
const staticEventKey = event => `event:${event.title}-${event.date}`;
const eventMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const formatEventDate = value => {
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
const eventDateInputValue = value => {
  const cleanValue = String(value ?? "").trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanValue)) {
    return cleanValue;
  }
  const displayParts = cleanValue.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!displayParts) {
    return cleanValue;
  }
  const monthIndex = eventMonthNames.findIndex(monthName => monthName.toLowerCase() === displayParts[1].toLowerCase());
  if (monthIndex === -1) {
    return cleanValue;
  }
  return `${displayParts[3]}-${String(monthIndex + 1).padStart(2, "0")}-${String(Number(displayParts[2])).padStart(2, "0")}`;
};
const formatEventTime = value => {
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
const localDateInputValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const abileneMinuteValue = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).map(part => [part.type, part.value]));
  return Number(`${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`);
};
const publicEventEndValue = event => {
  const endDate = event.end_date || event.endDate || event.event_date || event.eventDate;
  const endTime = event.end_time || event.endTime || event.event_time || event.eventTime;
  const dateParts = String(endDate ?? "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const timeParts = formatEventTime(endTime).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!dateParts || !timeParts) {
    return null;
  }
  const hour = Number(timeParts[1]) % 12 + (timeParts[3] === "PM" ? 12 : 0);
  return Number(`${dateParts[1]}${dateParts[2].padStart(2, "0")}${dateParts[3].padStart(2, "0")}${String(hour).padStart(2, "0")}${timeParts[2]}`);
};
const isPublicEventActive = event => {
  const eventEndValue = publicEventEndValue(event);
  if (eventEndValue === null) {
    return true;
  }
  return eventEndValue > abileneMinuteValue();
};
const eventSubmissionToEvent = event => ({
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
  image: event.image_data || event.image_url || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80"
});
const galleryShots = [{
  id: "pine-street",
  title: "Pine Street",
  image: appAsset("ded1242b-9c25-4b2b-b16d-5b36ffe01e51.jpg")
}, {
  id: "condley-downtown",
  title: "Condley Downtown",
  image: appAsset("94190f7b-27db-4b0f-b85e-84b6da72fbf2.jpg")
}, {
  id: "grain-theory-block-party",
  title: "Grain Theory Block Party",
  image: appAsset("64d46fa8-3f51-4bce-ae95-07f74746d75b.jpg")
}, {
  id: "texas-pacific-marker",
  title: "Texas & Pacific Marker",
  image: appAsset("77c9ff59-9fba-479d-94f7-14de54433b15.jpg")
}, {
  id: "downtown-brick-walk",
  title: "Downtown Brick Walk",
  image: appAsset("64dc2bcf-e858-42d9-a881-12d069e4b919.jpg")
}, {
  id: "paramount-marquee",
  title: "Paramount Marquee",
  image: appAsset("1fd1ea2a-acb5-47b2-81dc-6e9fd898f418.jpg")
}, {
  id: "grain-theory-patio",
  title: "Grain Theory Patio",
  image: appAsset("522c6f5e-6918-4dd3-8874-3eaaa75430a2.jpg")
}, {
  id: "grain-theory-corner",
  title: "Grain Theory Corner",
  image: appAsset("9e98df0d-dc19-429c-8205-675ba9cff023.jpg")
}, {
  id: "downtown-abilene",
  title: "Downtown Abilene",
  image: appAsset("227005f7-a560-45d7-bea9-557e2cee61f3.jpg")
}, {
  id: "cypress-street",
  title: "Cypress Street",
  image: appAsset("95547aea-c652-48bc-bff2-3f9f645236e3.jpg")
}, {
  id: "abilene-mural",
  title: "Abilene Mural",
  image: appAsset("553b9d8e-d087-4267-a0dc-d475fd25f231.jpg")
}, {
  id: "the-grace",
  title: "The Grace",
  image: appAsset("45cbacf8-d03a-4d23-ba5d-0f59509c79c6.jpg")
}, {
  id: "abilene-banner",
  title: "Abilene Banner",
  image: appAsset("bd916012-2fb5-4dd1-b854-77a3b801bcd4.jpg")
}, {
  id: "downtown-nights",
  title: "Downtown Nights",
  image: appAsset("nightlife-station.jpg")
}, {
  id: "paramount-theatre",
  title: "Paramount Theatre",
  image: appAsset("nightlife-paramount.jpg")
}, {
  id: "movie-night",
  title: "Movie Night",
  image: appAsset("nightlife-cinemark.jpg")
}, {
  id: "cocktail-hour",
  title: "Cocktail Hour",
  image: appAsset("nightlife-suite.jpg")
}];
const staticGalleryKey = photo => `gallery:${photo.id}`;
const marketplaceCategories = [{
  label: "Vehicles",
  icon: "🚗"
}, {
  label: "Electronics",
  icon: "📱"
}, {
  label: "Furniture",
  icon: "🛋️"
}, {
  label: "Tools",
  icon: "🛠️"
}, {
  label: "Clothing",
  icon: "👕"
}, {
  label: "Gaming",
  icon: "🎮"
}, {
  label: "Pets",
  icon: "🐶"
}, {
  label: "Home & Garden",
  icon: "🏠"
}, {
  label: "Local Businesses",
  icon: "🏪"
}];

// Archived seed data only; live Marketplace renders Supabase listings.
// eslint-disable-next-line no-unused-vars

// ── End Rent & Housing constants ──────────────────────────────

const marketplaceListingKey = l => l.id ?? `starter:${l.title}:${l.price}`;
const isMarketplaceToday = dateStr => {
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const formatMarketplacePosted = dateStr => {
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
// Parse image_data: plain string = 1-photo (legacy), JSON array string = multi-photo.
const parseListingImages = raw => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter(Boolean);
  } catch {
    // Legacy rows store a single data URL instead of a JSON array.
  }
  return [raw]; // legacy single-photo string
};
const getMarketplaceModerationStatus = listing => {
  const status = String(listing?.moderation_status ?? listing?.moderationStatus ?? "approved").trim().toLowerCase();
  return status === "needs_review" ? "pending" : status;
};
const mapListingFromDb = row => {
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
    image: imgs[0] || null,
    // first photo — backward compat for all existing code
    images: imgs,
    // all photos
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
    icon: marketplaceCategories.find(c => c.label === row.category)?.icon ?? "📦"
  };
};
const adminTabs = [{
  id: "reports",
  label: "Content Reports"
}, {
  id: "events",
  label: "Events"
}, {
  id: "gallery",
  label: "Gallery"
}, {
  id: "businesses",
  label: "Businesses"
}, {
  id: "claims",
  label: "Ownership Claims"
}, {
  id: "payments",
  label: "Payments"
}, {
  id: "reviews",
  label: "Reviews"
}, {
  id: "jobs",
  label: "Jobs & Hiring"
}, {
  id: "marketplace",
  label: "Marketplace"
}, {
  id: "rentals",
  label: "Rent & Housing"
}, {
  id: "analytics",
  label: "Analytics"
}];
const initialBusinesses = [{
  id: "grain-theory",
  name: "Grain Theory",
  category: "Restaurants",
  phone: "(325) 704-2500",
  social: "graintheory.com",
  description: "Downtown brewpub with food, drinks, and a strong patio crowd."
}, {
  id: "guitars-cadillacs",
  name: "Guitars and Cadillacs",
  category: "Clubs & Bars",
  phone: "(325) 672-2960",
  social: "@guitarsabilene",
  description: "Country nights, dancing, and weekend energy in Abilene."
}];
const businessSubmissionToBusiness = business => ({
  id: business.id,
  name: business.business_name,
  category: business.category,
  phone: business.phone,
  contactName: business.contact_name ?? "",
  contactEmail: business.contact_email ?? "",
  latitude: business.latitude,
  longitude: business.longitude,
  address: business.address ?? "",
  social: business.social ?? "",
  description: business.description ?? "",
  image: business.image_data ?? "",
  plan: business.plan,
  paymentStatus: business.payment_status ?? "",
  placementSource: business.placement_source ?? "paid",
  placementExpiresAt: business.placement_expires_at ?? "",
  advertiser_user_id: business.advertiser_user_id ?? null,
  ownerUserId: business.owner_user_id ?? "",
  owner_user_id: business.owner_user_id ?? ""
});
const activePaidPaymentStatuses = new Set(["paid", "cancel_pending"]);
const businessPlacementExpiresAt = business => business.placementExpiresAt ?? business.placement_expires_at ?? "";
const hasActiveBusinessPromotion = business => {
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
const businessPromotionStatus = business => {
  const paymentStatus = business.payment_status ?? business.paymentStatus ?? "";
  const expiresAt = businessPlacementExpiresAt(business);
  if (hasActiveBusinessPromotion(business)) {
    return paymentStatus === "cancel_pending" ? "Canceling - active until expiration" : (business.placement_source ?? business.placementSource) === "comp" ? "Active Admin Promo / COMP" : "Active paid promotion";
  }
  if (business.plan === "Free") {
    return "Normal directory listing";
  }
  if (paymentStatus === "canceled") {
    return "Canceled - directory only";
  }
  if (paymentStatus === "expired" || expiresAt && new Date(expiresAt) <= new Date()) {
    return "Expired - directory only";
  }
  if (business.placement_source === "comp") {
    return expiresAt && new Date(expiresAt) <= new Date() ? "Free promo expired" : "Free promo";
  }
  return "Not active";
};
const readFileAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => resolve(reader.result));
  reader.addEventListener("error", () => reject(reader.error));
  reader.readAsDataURL(file);
});
const loadImageFromFile = file => new Promise((resolve, reject) => {
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
const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => {
    if (blob) {
      resolve(blob);
      return;
    }
    reject(new Error("Image could not be compressed"));
  }, "image/jpeg", quality);
});
const optimizeGalleryImage = async file => {
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
function AdminShell({client = supabase} = {}) {
  const supabase = client;
  const [businessesRaw, setBusinesses] = useState([]);
  const [hiddenStaticItems, setHiddenStaticItems] = useState([]);

  const [likeCounts, setLikeCounts] = useState({});
  const [approvedEventsRaw, setApprovedEvents] = useState([]);
  const [eventSubmissionStatus, setEventSubmissionStatus] = useState("");
  const eventSubmissionInFlightRef = useRef(false);
  const [approvedGalleryPhotosRaw, setApprovedGalleryPhotos] = useState([]);
  const adminWebController = useRef(null);
  const adminLoginInFlight = useRef(false);
  const [adminAuthState, setAdminAuthState] = useState("AUTHENTICATING");
  const [adminSession, setAdminSession] = useState(null); // Only set after server authorization.
  const adminSessionRef = useRef(null); // keeps current value without triggering Realtime re-sub
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminStatus, setAdminStatus] = useState("");
  const [adminModuleErrors, setAdminModuleErrors] = useState([]);
  const [adminRefreshing, setAdminRefreshing] = useState(false);
  const [ugcReview, setUgcReview] = useState("");
  const [ugcReportedReview, setUgcReportedReview] = useState(null);
  const [adminTab, setAdminTab] = useState("dashboard");
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
  const [pendingClaims, setPendingClaims] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [publishedEvents, setPublishedEvents] = useState([]);
  const [hiddenEvents, setHiddenEvents] = useState([]);
  const [deletedStaticItems, setDeletedStaticItems] = useState([]);
  const [businessReports, setBusinessReports] = useState([]);
  const [itemReports, setItemReports] = useState([]);
  const [marketplaceListingsRaw, setMarketplaceListings] = useState([]);
  const [selectedListingRaw, setSelectedListing] = useState(null);
  const [ownerUserId, setOwnerUserId] = useState("");
  const effectiveOwnerId = ownerUserId;
  const [editingListing, setEditingListing] = useState(null);
  const [deletingListing, setDeletingListing] = useState(null);
  const [editDeleteStatus, setEditDeleteStatus] = useState("");
  const [marketplaceAdminStatusFilter, setMarketplaceAdminStatusFilter] = useState("pending");
  const [marketplaceActionKey, setMarketplaceActionKey] = useState("");
  // current photo index in detail view
  const [editListingPhotos, setEditListingPhotos] = useState([]); // existing photo data URLs in edit modal

  const selectedListing = selectedListingRaw;
  const loadEventsPublic = useCallback(() => {
    if (!supabase) return;
    const today = localDateInputValue();
    supabase.from("event_submissions").select("id,title,place,description,map_url,website_url,ticket_url,event_date,end_date,event_time,end_time,event_type,image_url,image_data,status").eq("status", "approved").or(`end_date.gte.${today},and(end_date.is.null,event_date.gte.${today})`).order("event_date", {
      ascending: true
    }).then(({
      data,
      error
    }) => {
      if (!error && data) {
        setApprovedEvents(data.filter(isPublicEventActive).map(eventSubmissionToEvent));
      }
    });
  }, []);
  const loadMarketplacePublic = useCallback(() => {
    return;
  }, []);

  // Keep adminSessionRef in sync so Realtime callbacks always see the latest value

  // Preserve live Admin invalidation without mounting public/mobile subscribers.
  useEffect(() => {
    if (!adminSession || !supabase?.channel) return;
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void adminWebController.current?.refreshAfterMutation(); }, 100);
    };
    const channel = supabase.channel('admin-workspace-content');
    for (const table of ['business_submissions','event_submissions','gallery_submissions','business_reviews','job_listings','rental_listings','marketplace_listings','business_ownership_claims','payment_records','hidden_static_items']) {
      channel.on('postgres_changes', {event:'*',schema:'public',table}, refresh);
    }
    channel.subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [adminSession, supabase]);

  const backToLobby = () => window.location.assign('https://abilenevibes.com');
  const paidOrPromoBusinesses = [...pendingBusinesses, ...publishedBusinesses, ...hiddenBusinesses].filter(business => business.plan && business.plan !== "Free").sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
  const paymentBusinesses = paidOrPromoBusinesses.filter(business => business.placement_source !== "comp");
  const promoBusinesses = paidOrPromoBusinesses.filter(business => business.placement_source === "comp");
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
  const paymentFinancialSummary = paymentRecords.reduce((summary, record) => ({
    gross: summary.gross + Number(record.gross_amount ?? 0),
    fees: summary.fees + Number(record.stripe_fee ?? 0),
    net: summary.net + Number(record.net_amount ?? 0)
  }), {
    gross: 0,
    fees: 0,
    net: 0
  });
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
        payments: 0
      };
    }
    earnings[businessId].gross += Number(record.gross_amount ?? 0);
    earnings[businessId].fees += Number(record.stripe_fee ?? 0);
    earnings[businessId].net += Number(record.net_amount ?? 0);
    earnings[businessId].payments += 1;
    return earnings;
  }, {})).sort((left, right) => right.net - left.net);
  const paymentSummary = paymentBusinesses.reduce((summary, business) => {
    const status = business.payment_status ?? "pending";
    summary.total += 1;
    summary[status] = (summary[status] ?? 0) + 1;
    if (activePaidPaymentStatuses.has(status)) {
      summary.activePaid += 1;
    }
    return summary;
  }, {
    total: 0,
    activePaid: 0
  });
  const adminEventWrite = (action, id, fields = {}) => supabase.rpc("admin_write_event", {
    p_action: action,
    p_event: id,
    p_fields: fields
  });
  const handleEventSubmit = async event => {
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
    const {
      error
    } = await adminEventWrite("create", null, {
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
      status: "approved"
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
  async function loadAdminData(sessionOverride = adminSession, showRefreshSuccess = false, afterMutation = false) {
    if (!showRefreshSuccess) return adminWebController.current?.refreshAfterMutation();
    return adminWebController.current?.refresh();
  }
  async function performAdminDataLoad(sessionOverride = adminSession, showRefreshSuccess = false, isCurrent = () => true) {
    if (!supabase || !sessionOverride) {
      return;
    }
    setAdminStatus("loading");
    const [galleryResult, publishedGalleryResult, businessResult, publishedBusinessResult, hiddenBusinessResult, hiddenStaticResult, reviewResult, likeResult, approvedReviewResult, interactionResult, publishedEventResult, hiddenEventResult, jobListingsResult, adminMarketplaceResult, adminRentalResult, paymentRecordsResult, pendingEventsResult, pendingClaimsResult, itemInteractionResult] = await settleAdminReads([supabase.from("gallery_submissions").select("id,created_at,contributor_name,title,image_data,status,owner_user_id").eq("status", "pending").order("created_at", {
      ascending: false
    }), supabase.from("gallery_submissions").select("id,created_at,contributor_name,title,image_data,status,owner_user_id").eq("status", "approved").order("created_at", {
      ascending: false
    }), supabase.from("business_submissions").select("id,created_at,business_name,contact_name,contact_email,category,plan,phone,address,social,description,image_data,payment_status,placement_source,placement_expires_at,stripe_subscription_id,status").eq("status", "pending").order("created_at", {
      ascending: false
    }), supabase.from("business_submissions").select("id,created_at,business_name,contact_name,contact_email,category,plan,phone,address,social,description,image_data,payment_status,placement_source,placement_expires_at,stripe_subscription_id,status").eq("status", "approved").order("created_at", {
      ascending: false
    }), supabase.from("business_submissions").select("id,created_at,business_name,contact_name,contact_email,category,plan,phone,address,social,description,image_data,payment_status,placement_source,placement_expires_at,stripe_subscription_id,status").eq("status", "hidden").order("created_at", {
      ascending: false
    }), supabase.from("hidden_static_items").select("item_key,item_type,title").order("created_at", {
      ascending: false
    }), supabase.from("business_reviews").select("id,created_at,business_id,business_name,reviewer_name,rating,comment,status").eq("status", "pending").order("created_at", {
      ascending: false
    }), supabase.from("public_likes").select("created_at,item_type,item_key"), supabase.from("business_reviews").select("created_at,business_id,rating,status").eq("status", "approved"), supabase.from("business_interactions").select("created_at,business_id,business_name,action_type"), supabase.from("event_submissions").select("id,created_at,title,place,description,map_url,website_url,ticket_url,event_date,end_date,event_time,end_time,event_type,image_url,image_data,status").eq("status", "approved").order("event_date", {
      ascending: true
    }), supabase.from("event_submissions").select("id,created_at,title,place,description,map_url,website_url,ticket_url,event_date,end_date,event_time,end_time,event_type,image_url,image_data,status").eq("status", "hidden").order("event_date", {
      ascending: true
    }), supabase.rpc("admin_list_job_listings"), supabase.from("marketplace_listings").select(MARKETPLACE_METADATA).order("created_at", {
      ascending: false
    }), supabase.rpc("admin_list_rental_listings"), supabase.from("payment_records").select("id,created_at,business_submission_id,stripe_session_id,stripe_payment_intent_id,stripe_charge_id,stripe_balance_transaction_id,currency,gross_amount,stripe_fee,net_amount,paid_at,status").order("paid_at", {
      ascending: false
    }), supabase.from("event_submissions").select("*").eq("status", "pending").order("created_at", {
      ascending: true
    }), supabase.from("business_ownership_claims").select("id,business_id,claimant,evidence,created_at").eq("status", "pending").order("created_at"), supabase.from("public_item_interactions").select("created_at,item_type,item_key,item_name,action_type")]);
    if (!isCurrent()) return false;
    setAdminModuleErrors([['Gallery pending', galleryResult], ['Gallery published', publishedGalleryResult], ['Businesses pending', businessResult], ['Businesses published', publishedBusinessResult], ['Businesses hidden', hiddenBusinessResult], ['Hidden items', hiddenStaticResult], ['Reviews pending', reviewResult], ['Analytics likes', likeResult], ['Analytics reviews', approvedReviewResult], ['Analytics business activity', interactionResult], ['Events published', publishedEventResult], ['Events hidden', hiddenEventResult], ['Jobs & Hiring', jobListingsResult], ['Marketplace', adminMarketplaceResult], ['Rent & Housing', adminRentalResult], ['Payments', paymentRecordsResult], ['Events pending', pendingEventsResult], ['Ownership Claims', pendingClaimsResult], ['Analytics item activity', itemInteractionResult]].filter(([, result]) => result.error).map(([label]) => label));
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
          visits: 0
        });
      }
      return reportsByBusiness.get(businessId);
    };
    [...(publishedBusinessResult.data ?? []), ...initialBusinesses].forEach(business => {
      ensureReport(business.id, business.business_name ?? business.name);
    });
    (likeResult.data ?? []).filter(like => new Date(like.created_at) >= monthStart).filter(like => like.item_type === "business").forEach(like => {
      ensureReport(like.item_key).likes += 1;
    });
    (approvedReviewResult.data ?? []).forEach(review => {
      const report = ensureReport(review.business_id);
      report.reviews += 1;
      report.ratingTotal += Number(review.rating);
    });
    (interactionResult.data ?? []).filter(interaction => new Date(interaction.created_at) >= monthStart).forEach(interaction => {
      const report = ensureReport(interaction.business_id, interaction.business_name);
      report[interaction.action_type] = (report[interaction.action_type] ?? 0) + 1;
    });
    const nextBusinessReports = [...reportsByBusiness.values()].map(report => ({
      ...report,
      averageRating: report.reviews ? (report.ratingTotal / report.reviews).toFixed(1) : "No reviews"
    })).sort((a, b) => b.likes + b.reviews + b.calls + b.directions + b.visits - (a.likes + a.reviews + a.calls + a.directions + a.visits));
    let nextItemReports = null;
    if (!itemInteractionResult.error) {
      const itemReportsByKey = new Map();
      (itemInteractionResult.data ?? []).filter(interaction => new Date(interaction.created_at) >= monthStart).forEach(interaction => {
        const reportKey = `${interaction.item_type}:${interaction.item_key}`;
        const isLobbyClick = String(interaction.item_key ?? "").startsWith("lobby-") || /^Lobby:\s*/i.test(interaction.item_name ?? "");
        const itemName = isLobbyClick ? interaction.item_name.replace(/^Lobby:\s*/i, "") : interaction.item_name;
        if (!itemReportsByKey.has(reportKey)) {
          itemReportsByKey.set(reportKey, {
            itemKey: reportKey,
            itemName,
            itemType: isLobbyClick ? "Lobby" : interaction.item_type,
            clicks: 0
          });
        }
        itemReportsByKey.get(reportKey).clicks += 1;
      });
      nextItemReports = [...itemReportsByKey.values()].sort((a, b) => b.clicks - a.clicks);
    }
    if (!adminRentalResult.error) setAdminRentalListings(adminRentalResult.data ?? []);
    if (!paymentRecordsResult.error) setPaymentRecords(paymentRecordsResult.data ?? []);
    if (!galleryResult.error) setPendingGalleryPhotos(galleryResult.data ?? []);
    if (!publishedGalleryResult.error) setPublishedGalleryPhotos(publishedGalleryResult.data ?? []);
    if (!businessResult.error) setPendingBusinesses(businessResult.data ?? []);
    if (!publishedBusinessResult.error) setPublishedBusinesses(publishedBusinessResult.data ?? []);
    if (!publishedBusinessResult.error) setBusinesses((publishedBusinessResult.data ?? []).map(businessSubmissionToBusiness));
    if (!hiddenBusinessResult.error) setHiddenBusinesses(hiddenBusinessResult.data ?? []);
    if (!hiddenStaticResult.error) setHiddenStaticItems((hiddenStaticResult.data ?? []).filter(item => item.item_type !== "deleted").map(item => item.item_key));
    if (!hiddenStaticResult.error) setDeletedStaticItems((hiddenStaticResult.data ?? []).filter(item => item.item_type === "deleted").map(item => item.item_key));
    if (!reviewResult.error) setPendingReviews(reviewResult.data ?? []);
    if (!jobListingsResult.error) setAdminJobListings(jobListingsResult.data ?? []);
    if (!adminMarketplaceResult.error) setAdminMarketplaceListings((adminMarketplaceResult.data ?? []).map(mapListingFromDb));
    if (!pendingClaimsResult.error) setPendingClaims(pendingClaimsResult.data ?? []);
    if (!pendingEventsResult.error) setPendingEvents(pendingEventsResult.data ?? []);
    if (!publishedEventResult.error) setPublishedEvents(publishedEventResult.data ?? []);
    if (!hiddenEventResult.error) setHiddenEvents(hiddenEventResult.data ?? []);
    if (!likeResult.error) setLikeCounts((likeResult.data ?? []).reduce((counts, like) => {
      const key = `${like.item_type}:${like.item_key}`;
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}));

    // Derived reports require every input; retain the previous report if any input failed.
    if (![publishedBusinessResult, likeResult, approvedReviewResult, interactionResult].some(result => result.error)) {
      setBusinessReports(nextBusinessReports);
    }
    if (nextItemReports) setItemReports(nextItemReports);
    setAdminStatus(showRefreshSuccess ? "refreshed" : "ready");
    return true;
  }
  async function loadAdminJobs(sessionOverride = adminSession) {
    return adminWebController.current?.refreshAfterMutation();
  }
  async function loadAdminRentals(sessionOverride = adminSession) {
    return adminWebController.current?.refreshAfterMutation();
  }
  async function loadAdminEvents(sessionOverride = adminSession) {
    return adminWebController.current?.refreshAfterMutation();
  }
  async function loadAdminBusinesses(sessionOverride = adminSession, showRefreshSuccess = false) {
    return adminWebController.current?.refreshAfterMutation();
  }
  async function loadAdminGallery(sessionOverride = adminSession) {
    return adminWebController.current?.refreshAfterMutation();
  }
  const handleAdminLogin = async event => {
    event.preventDefault();
    if (!supabase) {
      setAdminStatus("missing-config");
      return;
    }
    {
      if (adminLoginInFlight.current || !adminEmail.trim() || !adminPassword) return;
      const controller = adminWebController.current;
      if (!controller) return;
      adminLoginInFlight.current = true;
      setAdminStatus("signing-in");
      try {
        await controller.login({
          email: adminEmail.trim(),
          password: adminPassword
        });
        if (adminSessionRef.current) setAdminPassword("");
      } finally {
        adminLoginInFlight.current = false;
        setAdminStatus(status => status === "signing-in" ? "" : status);
      }
      return;
    }
  };
  const handleAdminLogout = async () => {
    {
      await adminWebController.current?.logout();
      return;
    }
  };
  const moderateItem = async (table, id, status) => {
    if (!supabase || !adminSession) {
      return;
    }
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.from(table).update({
        status
      }).eq("id", id);
      if (error) {
        setAdminStatus("error");
        return;
      }
      await loadAdminData();
    } catch {
      setAdminStatus("error");
    }
  };
  const moderateBusiness = async (business, status) => {
    if (!supabase || !adminSession) {
      return;
    }
    const action = status === "approved" ? "approve" : "reject";
    setAdminBusinessActionKey(`${business.id}:${action}`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.from("business_submissions").update({
        status
      }).eq("id", business.id);
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
  const moderateGalleryPhoto = async (photo, status) => {
    if (!supabase || !adminSession) {
      return;
    }
    const action = status === "approved" ? "approve" : "reject";
    setAdminGalleryActionKey(`${photo.id}:${action}`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.from("gallery_submissions").update({
        status
      }).eq("id", photo.id);
      if (error) {
        setAdminStatus("error");
        return;
      }
      await loadAdminGallery();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminGalleryActionKey("");
    }
  };
  const handleApproveJob = async job => {
    const plan = String(job?.plan ?? "free").toLowerCase();
    const paymentStatus = String(job?.payment_status ?? "").toLowerCase();
    const canApprove = plan === "free" && paymentStatus === "not_required" || (plan === "featured" || plan === "premium") && paymentStatus === "paid";
    if (!canApprove) {
      setAdminStatus("job-payment-incomplete");
      return;
    }
    await setJobPaymentPlan(job, plan, "approved", paymentStatus, job.expires_at ?? null);
  };
  const deleteGalleryPhoto = async id => {
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
      const {
        error
      } = await supabase.from("gallery_submissions").delete().eq("id", id);
      if (error) {
        setAdminStatus("error");
        return;
      }
      setApprovedGalleryPhotos(currentPhotos => currentPhotos.filter(photo => photo.id !== id));
      await loadAdminGallery();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminGalleryActionKey("");
    }
  };
  const handleDeleteJob = async id => {
    if (!supabase || !adminSession) return;
    if (!window.confirm("Permanently delete this job listing?")) return;
    setAdminJobActionKey(`${id}:delete`);
    setAdminStatus("saving");
    try {
      const {
        data,
        error
      } = await supabase.rpc("admin_delete_job_listing", {
        listing_id: id
      });
      if (error || data !== true) {
        setAdminStatus("error");
        return;
      }
      await loadAdminData();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminJobActionKey("");
    }
  };
  const handleSaveJob = async () => {
    if (!supabase || !adminSession || !editingJob) return;
    const plan = String(editingJob.plan ?? "free").toLowerCase();
    const paymentStatus = String(editingJob.payment_status ?? "").toLowerCase();
    const savingAsApproved = editingJob.status === "approved";
    const canApprove = plan === "free" && paymentStatus === "not_required" || (plan === "featured" || plan === "premium") && paymentStatus === "paid";
    if (savingAsApproved && !canApprove) {
      setAdminStatus("job-payment-incomplete");
      return;
    }
    setAdminStatus("saving");
    try {
      const {
        data,
        error
      } = await supabase.rpc("admin_update_job_listing", {
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
        new_expires_at: editingJob.expires_at ?? null
      });
      if (error || data !== true) {
        setAdminStatus("job-save-error");
        return;
      }
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
    const cleanPaymentStatus = ["not_required", "pending", "checkout_started", "paid", "failed", "expired", "canceled"].includes(paymentStatus) ? paymentStatus : "not_required";
    const actionKey = actionSuffix || `status:${cleanStatus}`;
    setAdminJobActionKey(`${job.id}:${actionKey}`);
    setAdminStatus("saving");
    try {
      const {
        data,
        error
      } = await supabase.rpc("admin_set_job_payment_plan", {
        listing_id: job.id,
        new_plan: cleanPlan,
        new_status: cleanStatus,
        new_payment_status: cleanPaymentStatus,
        new_expires_at: expiresAt,
        new_placement_source: placementSource,
        new_placement_expires_at: placementExpiresAt
      });
      if (error || data !== true) {
        setAdminStatus("error");
        return;
      }
      await loadAdminData();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminJobActionKey("");
    }
  };
  const setPaidJobPlacement = async (job, plan) => {
    if (!supabase || !adminSession) return;
    const cleanPlan = plan === "premium" ? "premium" : plan === "featured" ? "featured" : "free";
    const planLabel = cleanPlan.charAt(0).toUpperCase() + cleanPlan.slice(1);
    if (!window.confirm(`Set "${job.title}" to ${planLabel} paid plan?`)) return;
    await setJobPaymentPlan(job, cleanPlan, cleanPlan === "free" ? job.status : "approved", cleanPlan === "free" ? "not_required" : "paid", cleanPlan === "free" ? null : job.expires_at ?? null);
  };
  const compJobPlacement = async (job, plan) => {
    if (!supabase || !adminSession) return;
    const cleanPlan = plan === "premium" ? "premium" : "featured";
    const days = window.prompt("Promo duration in days", "30");
    if (days === null) return;
    const durationDays = Math.max(1, Number.parseInt(days, 10) || 30);
    const promoExpiresAt = new Date();
    promoExpiresAt.setDate(promoExpiresAt.getDate() + durationDays);
    await setJobPaymentPlan(job, cleanPlan, "approved", "not_required", job.expires_at ?? null, "comp", promoExpiresAt.toISOString());
  };
  const clearCompJobPlacement = async job => {
    if (!supabase || !adminSession) return;
    if (!window.confirm(`End free promo for "${job.title}"?`)) return;
    await setJobPaymentPlan(job, "free", job.status ?? "approved", "not_required", null, "free", null);
  };
  const handleDeleteRental = async id => {
    if (!supabase || !adminSession) return;
    if (!window.confirm("Permanently delete this rental listing?")) return;
    setAdminRentalActionKey(`${id}:delete`);
    setAdminStatus("saving");
    try {
      const {
        data,
        error
      } = await supabase.rpc("admin_delete_rental_listing", {
        listing_id: id
      });
      if (error || data !== true) {
        setAdminStatus("error");
        return;
      }
      await loadAdminRentals();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminRentalActionKey("");
    }
  };
  const adminRentalRpcPayload = (r, overrides = {}) => {
    const rental = {
      ...r,
      ...overrides
    };
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
      new_price: isSTR ? null : rental.price || null,
      new_deposit: isSTR ? null : rental.deposit || null,
      new_price_per_night: isSTR ? rental.price_per_night || null : null,
      new_price_per_week: isSTR ? rental.price_per_week || null : null,
      new_available_from: isSTR ? rental.available_from || null : null,
      new_available_to: isSTR ? rental.available_to || null : null,
      new_max_guests: isSTR ? rental.max_guests || null : null,
      new_house_rules: isSTR ? rental.house_rules || null : null,
      new_bedrooms: isSTR ? null : rental.bedrooms || null,
      new_bathrooms: isSTR ? null : rental.bathrooms || null
    };
  };
  const handleToggleRentalStatus = async r => {
    const nextStatus = r.status === "hidden" ? "approved" : "hidden";
    await handleSetRentalStatus(r, nextStatus);
  };
  const handleSetRentalStatus = async (r, nextStatus) => {
    await handleSetRentalPaymentPlan(r, r.plan ?? "free", nextStatus, r.payment_status ?? "not_required", `status:${nextStatus}`);
  };
  const canApproveRental = r => {
    const plan = String(r?.plan ?? "free").toLowerCase();
    const paymentStatus = String(r?.payment_status ?? "").toLowerCase();
    const placementSource = String(r?.placement_source ?? "").toLowerCase();
    return plan === "free" && paymentStatus === "not_required" || (plan === "featured" || plan === "premium") && placementSource === "comp" && paymentStatus === "not_required" || (plan === "featured" || plan === "premium") && paymentStatus === "paid";
  };
  const handleSetRentalPaymentPlan = async (r, nextPlan, nextStatus, nextPaymentStatus, actionSuffix = "", nextPlacementSource = r?.placement_source ?? null, nextPlacementExpiresAt = r?.placement_expires_at ?? null) => {
    if (!supabase || !adminSession) return;
    const cleanPlan = nextPlan === "premium" ? "premium" : nextPlan === "featured" ? "featured" : "free";
    const cleanStatus = ["pending", "approved", "hidden", "rejected"].includes(nextStatus) ? nextStatus : "pending";
    const cleanPaymentStatus = ["not_required", "pending", "checkout_started", "paid", "failed", "expired", "cancel_pending", "canceled"].includes(nextPaymentStatus) ? nextPaymentStatus : "not_required";
    const actionKey = actionSuffix || `plan:${cleanPlan}:${cleanPaymentStatus}`;
    setAdminRentalActionKey(`${r.id}:${actionKey}`);
    setAdminStatus("saving");
    try {
      const {
        data,
        error
      } = await supabase.rpc("admin_set_rental_payment_plan", {
        listing_id: r.id,
        new_plan: cleanPlan,
        new_status: cleanStatus,
        new_payment_status: cleanPaymentStatus,
        new_placement_source: nextPlacementSource,
        new_placement_expires_at: nextPlacementExpiresAt
      });
      if (error || data !== true) {
        setAdminStatus("error");
        return;
      }
      await loadAdminRentals();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminRentalActionKey("");
    }
  };
  const handleApproveRental = async r => {
    if (!canApproveRental(r)) {
      setAdminStatus("rental-payment-incomplete");
      return;
    }
    await handleSetRentalPaymentPlan(r, r.plan ?? "free", "approved", r.payment_status ?? "not_required", "status:approved");
  };
  const setRentalFreePlan = async r => {
    if (!window.confirm(`Set "${r.title}" to Free plan?`)) return;
    await handleSetRentalPaymentPlan(r, "free", r.status ?? "pending", "not_required", "plan:free", null, null);
  };
  const compRentalPlacement = async (r, plan) => {
    const cleanPlan = plan === "premium" ? "premium" : "featured";
    await handleSetRentalPaymentPlan(r, cleanPlan, "approved", "not_required", `promo:${cleanPlan}`, "comp", null);
  };
  const clearCompRentalPlacement = async r => {
    if (!window.confirm(`End free promo for "${r.title}"?`)) return;
    await handleSetRentalPaymentPlan(r, "free", r.status ?? "approved", "not_required", "promo:end", null, null);
  };
  const cancelRentalSubscription = async r => {
    if (!supabase || !adminSession) {
      return;
    }
    if (!r.stripe_subscription_id) {
      window.alert("This rental does not have a Stripe subscription ID saved yet.");
      return;
    }
    const cancelAtPeriodEnd = window.confirm(`Cancel "${r.title}" at the end of the paid billing period?\n\nChoose OK to let the customer keep the current paid month. Choose Cancel for immediate cancellation.`);
    const shouldContinue = cancelAtPeriodEnd ? true : window.confirm(`Cancel "${r.title}" immediately? This may end paid placement right away.`);
    if (!shouldContinue) {
      return;
    }
    setAdminRentalActionKey(`${r.id}:cancel-subscription`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.functions.invoke("cancel-subscription", {
        body: {
          listingType: "rental",
          rentalId: r.id,
          cancelAtPeriodEnd
        }
      });
      if (error) {
        setAdminStatus("error");
        window.alert(error.message ?? "Could not cancel this subscription.");
        return;
      }
      await loadAdminRentals();
    } catch {
      setAdminStatus("error");
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
      const {
        data,
        error
      } = await supabase.rpc("admin_update_rental_listing", adminRentalRpcPayload(editingRental));
      if (error || data !== true) {
        setAdminStatus("error");
        return;
      }
      const refreshed = await loadAdminRentals();
      if (refreshed === false) return;
      setEditingRental(null);
      setEditRentalPage(false);
    } catch {
      setAdminStatus("error");
    }
  };
  const deleteBusiness = async id => {
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
      const {
        error
      } = await supabase.from("business_submissions").delete().eq("id", id);
      if (error) {
        setAdminStatus("error");
        return;
      }
      setBusinesses(currentBusinesses => currentBusinesses.filter(business => business.id !== id));
      await loadAdminBusinesses();
    } catch {
      setAdminStatus("error");
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
    const {
      error
    } = await supabase.from("business_submissions").delete().eq("id", id);
    if (error) {
      setAdminStatus("error");
      setAdminBusinessActionKey("");
      return;
    }
    setBusinesses(currentBusinesses => currentBusinesses.filter(business => business.id !== id));
    setDeletingAdminBusiness(null);
    await loadAdminBusinesses();
    setAdminBusinessActionKey("");
  };
  const editBusiness = async business => {
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
    const placementUpdates = cleanPlan === "Free" ? {
      placement_source: "paid",
      placement_expires_at: null,
      payment_status: "not_required"
    } : {};
    setAdminBusinessActionKey(`${business.id}:edit`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.from("business_submissions").update({
        business_name: businessName.trim() || business.business_name,
        category: category.trim() || business.category,
        phone: phone.trim() || business.phone,
        address: address.trim(),
        social: social.trim(),
        description: description.trim(),
        plan: cleanPlan,
        ...placementUpdates
      }).eq("id", business.id);
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
      const {
        error
      } = await supabase.from("business_submissions").update({
        image_data: imageData
      }).eq("id", businessId);
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
    const plan = selectedPromoPlan || window.prompt("Free promo plan: Featured or Premium", business.plan === "Premium" ? "Premium" : "Featured");
    if (plan === null) return;
    const days = selectedPromoPlan ? "30" : window.prompt("Promo duration in days", "30");
    if (days === null) return;
    const cleanPlan = plan.trim() === "Premium" ? "Premium" : "Featured";
    const durationDays = Math.max(1, Number.parseInt(days, 10) || 30);
    setAdminBusinessActionKey(`${business.id}:${cleanPlan === "Premium" ? "comp-premium" : "comp-featured"}`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.rpc("grant_admin_comp", {
        p_business: business.id,
        p_plan: cleanPlan.toLowerCase(),
        p_days: durationDays,
        p_key: crypto.randomUUID()
      });
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
      const {
        error
      } = await supabase.from("business_submissions").update({
        plan: cleanPlan,
        status: cleanPlan === "Free" ? business.status : "approved",
        payment_status: cleanPlan === "Free" ? "not_required" : "paid",
        placement_source: "paid",
        placement_expires_at: null
      }).eq("id", business.id);
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
  const cancelBusinessSubscription = async business => {
    if (!supabase || !adminSession) {
      return;
    }
    if (!business.stripe_subscription_id) {
      window.alert("This business does not have a Stripe subscription ID saved yet.");
      return;
    }
    const cancelAtPeriodEnd = window.confirm(`Cancel "${business.business_name}" at the end of the paid billing period?\n\nChoose OK to let the customer keep the current paid month. Choose Cancel for immediate cancellation.`);
    const shouldContinue = cancelAtPeriodEnd ? true : window.confirm(`Cancel "${business.business_name}" immediately? This may end paid placement right away.`);
    if (!shouldContinue) {
      return;
    }
    setAdminBusinessActionKey(`${business.id}:cancel-subscription`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.functions.invoke("cancel-subscription", {
        body: {
          submissionId: business.id,
          cancelAtPeriodEnd
        }
      });
      if (error) {
        setAdminStatus("error");
        window.alert(error.message ?? "Could not cancel this subscription.");
        return;
      }
      await loadAdminData(undefined, true, true);
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminBusinessActionKey("");
    }
  };
  const clearCompBusinessPlacement = async business => {
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
      const {
        data: grants,
        error: grantError
      } = await supabase.from("admin_comp_authority").select("id").eq("business_id", business.id).eq("status", "active");
      if (grantError || !grants || grants.length > 1) {
        setAdminStatus("error");
        return; // Fail closed; no local fallback writes.
      }
      const {
        error
      } = await supabase.rpc("revoke_admin_comp", {
        p_business: business.id,
        p_grant: grants[0]?.id ?? null
      });
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
  const deleteEvent = async id => {
    if (!supabase || !adminSession) {
      return;
    }
    const shouldDelete = window.confirm("Permanently delete this event from Abilene Vibes?");
    if (!shouldDelete) {
      return;
    }
    setAdminStatus("saving");
    const {
      error
    } = await adminEventWrite("delete", id);
    if (error) {
      setAdminStatus("error");
      return;
    }
    await loadAdminEvents();
    loadEventsPublic();
  };
  const unpublishBusiness = async id => {
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
      const {
        error
      } = await supabase.from("business_submissions").update({
        status: "hidden"
      }).eq("id", id);
      if (error) {
        setAdminStatus("error");
        return;
      }
      setBusinesses(currentBusinesses => currentBusinesses.filter(business => business.id !== id));
      await loadAdminBusinesses();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminBusinessActionKey("");
    }
  };
  const restoreBusiness = async business => {
    if (!supabase || !adminSession) {
      return;
    }
    setAdminBusinessActionKey(`${business.id}:restore`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.from("business_submissions").update({
        status: "approved"
      }).eq("id", business.id);
      if (error) {
        setAdminStatus("error");
        return;
      }
      setBusinesses(currentBusinesses => [businessSubmissionToBusiness(business), ...currentBusinesses]);
      await loadAdminBusinesses();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminBusinessActionKey("");
    }
  };
  const hideStaticBusiness = async business => {
    if (!supabase || !adminSession) {
      return;
    }
    setAdminStatus("saving");
    const itemKey = `business:${business.id}`;
    const {
      error
    } = await supabase.from("hidden_static_items").insert({
      item_key: itemKey,
      item_type: "business",
      title: business.name
    });
    if (error) {
      setAdminStatus("error");
      return;
    }
    setHiddenStaticItems(currentItems => [...new Set([...currentItems, itemKey])]);
    await loadAdminData();
  };
  const restoreStaticBusiness = async business => {
    if (!supabase || !adminSession) {
      return;
    }
    setAdminStatus("saving");
    const itemKey = `business:${business.id}`;
    const {
      error
    } = await supabase.from("hidden_static_items").delete().eq("item_key", itemKey);
    if (error) {
      setAdminStatus("error");
      return;
    }
    setHiddenStaticItems(currentItems => currentItems.filter(item => item !== itemKey));
    await loadAdminData();
  };
  const unpublishEvent = async id => {
    if (!supabase || !adminSession) {
      return;
    }
    setAdminStatus("saving");
    const {
      error
    } = await adminEventWrite("hide", id);
    if (error) {
      setAdminStatus("error");
      return;
    }
    await loadAdminEvents();
    loadEventsPublic();
  };
  const restoreEvent = async id => {
    if (!supabase || !adminSession) {
      return;
    }
    setAdminStatus("saving");
    const {
      error
    } = await adminEventWrite("restore", id);
    if (error) {
      setAdminStatus("error");
      return;
    }
    await loadAdminEvents();
    loadEventsPublic();
  };
  const editEvent = async event => {
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
    const {
      error
    } = await adminEventWrite("edit", event.id, {
      title: title.trim(),
      place: place.trim(),
      description: description.trim(),
      map_url: eventAddress.trim(),
      website_url: websiteUrl.trim(),
      ticket_url: ticketUrl.trim(),
      event_date: eventDate.trim(),
      end_date: endDate.trim() || null,
      event_time: formatEventTime(eventTime),
      end_time: formatEventTime(endTime)
    });
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
      const {
        error
      } = await adminEventWrite("edit", eventId, {
        image_data: imageData,
        image_url: ""
      });
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
    const {
      error: eventError
    } = await adminEventWrite("create", null, {
      title: overrides.title ?? event.title,
      place: overrides.place ?? event.place,
      event_date: eventDateInputValue(overrides.event_date ?? eventDate),
      event_time: formatEventTime(overrides.event_time ?? eventTime),
      event_type: overrides.event_type ?? event.type,
      image_url: imageData ? "" : event.image,
      image_data: imageData,
      status: "approved"
    });
    if (eventError) {
      setAdminStatus("error");
      return false;
    }
    const itemKey = staticEventKey(event);
    const {
      error: hideError
    } = await supabase.from("hidden_static_items").insert({
      item_key: itemKey,
      item_type: "event",
      title: event.title
    });
    if (hideError) {
      setAdminStatus("error");
      return false;
    }
    setHiddenStaticItems(currentItems => [...new Set([...currentItems, itemKey])]);
    return true;
  };
  const editStaticEvent = async event => {
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
      event_time: formatEventTime(eventTime)
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
      const wasCreated = await createEditableEventFromStatic(event, {
        image_data: imageData
      });
      if (wasCreated) {
        await loadAdminData();
      }
    } catch {
      setAdminStatus("error");
    }
  };
  const hideStaticEvent = async event => {
    if (!supabase || !adminSession) {
      return;
    }
    setAdminStatus("saving");
    const itemKey = staticEventKey(event);
    const {
      error
    } = await supabase.from("hidden_static_items").insert({
      item_key: itemKey,
      item_type: "event",
      title: event.title
    });
    if (error) {
      setAdminStatus("error");
      return;
    }
    setHiddenStaticItems(currentItems => [...new Set([...currentItems, itemKey])]);
    await loadAdminData();
  };
  const restoreStaticEvent = async event => {
    if (!supabase || !adminSession) {
      return;
    }
    setAdminStatus("saving");
    const itemKey = staticEventKey(event);
    const {
      error
    } = await supabase.from("hidden_static_items").delete().eq("item_key", itemKey);
    if (error) {
      setAdminStatus("error");
      return;
    }
    setHiddenStaticItems(currentItems => currentItems.filter(item => item !== itemKey));
    await loadAdminData();
  };
  const hideStaticGalleryPhoto = async photo => {
    if (!supabase || !adminSession) {
      return;
    }
    const itemKey = staticGalleryKey(photo);
    setAdminGalleryActionKey(`${itemKey}:hide`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.from("hidden_static_items").insert({
        item_key: itemKey,
        item_type: "gallery",
        title: photo.title
      });
      if (error) {
        setAdminStatus("error");
        return;
      }
      setHiddenStaticItems(currentItems => [...new Set([...currentItems, itemKey])]);
      await loadAdminData();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminGalleryActionKey("");
    }
  };
  const restoreStaticGalleryPhoto = async photo => {
    if (!supabase || !adminSession) {
      return;
    }
    const itemKey = staticGalleryKey(photo);
    setAdminGalleryActionKey(`${itemKey}:restore`);
    setAdminStatus("saving");
    try {
      const {
        error
      } = await supabase.from("hidden_static_items").delete().eq("item_key", itemKey);
      if (error) {
        setAdminStatus("error");
        return;
      }
      setHiddenStaticItems(currentItems => currentItems.filter(item => item !== itemKey));
      await loadAdminData();
    } catch {
      setAdminStatus("error");
    } finally {
      setAdminGalleryActionKey("");
    }
  };
  const deleteStaticGalleryPhoto = async photo => {
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
      const {
        error
      } = await supabase.from("hidden_static_items").upsert({
        item_key: itemKey,
        item_type: "deleted",
        title: photo.title
      });
      if (error) {
        setAdminStatus("error");
        return;
      }
      setHiddenStaticItems(currentItems => currentItems.filter(item => item !== itemKey));
      setDeletedStaticItems(currentItems => [...new Set([...currentItems, itemKey])]);
      await loadAdminData();
    } catch {
      setAdminStatus("error");
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
    const {
      error
    } = await supabase.from("hidden_static_items").upsert({
      item_key: itemKey,
      item_type: "deleted",
      title
    });
    if (error) {
      setAdminStatus("error");
      return;
    }
    setHiddenStaticItems(currentItems => currentItems.filter(item => item !== itemKey));
    setDeletedStaticItems(currentItems => [...new Set([...currentItems, itemKey])]);
    await loadAdminData();
  };
  const hiddenStaticItemSet = new Set(hiddenStaticItems);

  // ── Marketplace computed ──────────────────────────────────

  const adminMarketplaceCounts = adminMarketplaceListings.reduce((acc, listing) => {
    const status = listing.status ?? "active";
    const moderationStatus = getMarketplaceModerationStatus(listing);
    acc.all += 1;
    acc[status] = (acc[status] ?? 0) + 1;
    acc[moderationStatus] = (acc[moderationStatus] ?? 0) + 1;
    return acc;
  }, {
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    active: 0,
    hidden: 0,
    sold: 0
  });
  const adminMarketplaceVisibleListings = useMemo(() => adminMarketplaceListings.filter(listing => {
    const status = listing.status ?? "active";
    const moderationStatus = getMarketplaceModerationStatus(listing);
    if (status === "deleted") return false;
    if (marketplaceAdminStatusFilter === "all") return true;
    if (["pending", "approved", "rejected"].includes(marketplaceAdminStatusFilter)) {
      return moderationStatus === marketplaceAdminStatusFilter;
    }
    return status === marketplaceAdminStatusFilter;
  }), [adminMarketplaceListings, marketplaceAdminStatusFilter]);
  const marketplaceAdminDisplayStatus = listing => {
    const status = String(listing?.status ?? "active").trim().toLowerCase();
    const moderationStatus = getMarketplaceModerationStatus(listing);
    if (moderationStatus === "pending") return "pending";
    if (moderationStatus === "rejected") return "rejected";
    return status;
  };
  const isListingOwner = () => false;
  const openOwnerEditListing = (e, l) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditListingPhotos(l.images ?? (l.image ? [l.image] : []));
    setEditingListing({
      ...l
    });
  };
  const setListingStatus = async (l, newStatus) => {
    const canAct = !!adminSession || isListingOwner(l);
    if (!supabase || !canAct) return;
    const actionKey = `${l.id ?? marketplaceListingKey(l)}:${newStatus}`;
    setMarketplaceActionKey(actionKey);
    if (newStatus === "deleted" && l.isStarterListing) {
      setAdminStatus("saving");
      const {
        error
      } = await supabase.from("hidden_static_items").upsert({
        item_key: marketplaceListingKey(l),
        item_type: "deleted",
        title: l.title
      });
      if (error) {
        setAdminStatus("error");
        setMarketplaceActionKey("");
        return;
      }
      setHiddenStaticItems(items => [...new Set([...items, marketplaceListingKey(l)])]);
      setDeletingListing(null);
      await loadAdminData();
      setMarketplaceActionKey("");
      return;
    }
    const ts = new Date().toISOString();
    const update = {
      status: newStatus
    };
    if (newStatus === "sold") update.sold_at = ts;
    if (newStatus === "active") update.sold_at = null;
    if (newStatus === "deleted") update.deleted_at = ts;
    setAdminStatus("saving");
    if (newStatus === "deleted" && adminSession) {
      const {
        data,
        error
      } = await supabase.rpc("admin_delete_marketplace_listing", {
        listing_id: l.id
      });
      if (error || data !== true) {
        setAdminStatus("error");
        setMarketplaceActionKey("");
        return;
      }
      setMarketplaceListings(items => items.filter(i => i.id !== l.id));
      if (selectedListing?.id === l.id) setSelectedListing(null);
      setDeletingListing(null);
      await loadAdminData();
      setMarketplaceActionKey("");
      return;
    }
    const {
      data,
      error
    } = adminSession ? await supabase.from("marketplace_listings").update(update).eq("id", l.id) : await supabase.rpc("owner_set_marketplace_listing_status", {
      listing_id: l.id,
      owner_id: effectiveOwnerId,
      new_status: newStatus
    });
    if (error || !adminSession && data !== true) {
      setAdminStatus("error");
      setMarketplaceActionKey("");
      return;
    }
    if (selectedListing?.id === l.id) setSelectedListing(prev => prev ? {
      ...prev,
      ...update
    } : null);
    setMarketplaceListings(items => items.map(i => i.id === l.id ? {
      ...i,
      status: newStatus,
      ownerUserId: update.owner_user_id ?? i.ownerUserId,
      soldAt: Object.prototype.hasOwnProperty.call(update, "sold_at") ? update.sold_at : i.soldAt,
      deletedAt: update.deleted_at ?? i.deletedAt
    } : i));
    if (newStatus === "deleted") setDeletingListing(null);
    if (adminSession) await loadAdminData();
    setMarketplaceActionKey("");
  };
  const setMarketplaceModerationStatus = async (listing, moderationStatus) => {
    if (!supabase || !adminSession || !listing?.id) return;
    const actionKey = `${listing.id}:moderation:${moderationStatus}`;
    setMarketplaceActionKey(actionKey);
    setAdminStatus("saving");
    try {
      const update = {
        moderation_status: moderationStatus,
        reviewed_by_admin: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminSession.user?.email ?? adminSession.user?.id ?? adminEmail ?? "admin"
      };
      const {
        error
      } = await supabase.from("marketplace_listings").update(update).eq("id", listing.id);
      if (error) {
        setAdminStatus("error");
        setMarketplaceActionKey("");
        return;
      }
      setMarketplaceListings(items => items.map(item => item.id === listing.id ? {
        ...item,
        ...update,
        moderationStatus
      } : item));
      if (selectedListing?.id === listing.id) {
        setSelectedListing(prev => prev ? {
          ...prev,
          ...update,
          moderationStatus
        } : null);
      }
      await loadMarketplacePublic();
      if ((await loadAdminData()) === false) return;
      setAdminStatus(moderationStatus === "approved" ? "marketplace-approved" : "marketplace-rejected");
    } catch {
      setAdminStatus("error");
    } finally {
      setMarketplaceActionKey("");
    }
  };
  const handleEditListingSubmit = async e => {
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
      description: data.get("description").trim()
    };
    if (adminSession) {
      const cleanStatus = ["active", "sold", "expired", "hidden", "deleted"].includes(editingListing.status) ? editingListing.status : "active";
      update.status = cleanStatus;
      if (cleanStatus === "sold" && !editingListing.soldAt) update.sold_at = new Date().toISOString();
      if (cleanStatus === "active") update.sold_at = null;
      if (cleanStatus === "deleted" && !editingListing.deletedAt) update.deleted_at = new Date().toISOString();
    }
    setEditDeleteStatus("saving");
    try {
      // Combine kept existing photos with newly added photos.
      const newFiles = data.getAll("newPhotos").filter(f => f && f.size > 0);
      const newCompressed = await Promise.all(newFiles.map(f => optimizeGalleryImage(f)));
      const allPhotos = [...editListingPhotos, ...newCompressed].slice(0, 5);
      update.image_data = allPhotos.length === 0 ? "" : JSON.stringify(allPhotos);
      const {
        data: result,
        error
      } = adminSession ? await supabase.from("marketplace_listings").update(update).eq("id", editingListing.id) : await supabase.rpc("owner_update_marketplace_listing", {
        listing_id: editingListing.id,
        owner_id: effectiveOwnerId,
        new_title: update.title,
        new_price: update.price,
        new_category: update.category,
        new_location: update.location,
        new_contact: update.contact,
        new_description: update.description,
        new_image_data: update.image_data
      });
      if (error || !adminSession && result !== true) {
        setEditDeleteStatus("error");
        return;
      }
      const newImgs = parseListingImages(update.image_data);
      setMarketplaceListings(items => items.map(i => i.id === editingListing.id ? {
        ...i,
        ...update,
        ownerUserId: update.owner_user_id ?? i.ownerUserId,
        image: newImgs[0] ?? null,
        images: newImgs
      } : i));
      setSelectedListing(prev => prev?.id === editingListing.id ? {
        ...prev,
        ...update,
        ownerUserId: update.owner_user_id ?? prev.ownerUserId,
        image: newImgs[0] ?? null,
        images: newImgs
      } : prev);
      setEditDeleteStatus("");
      setEditingListing(null);
      if (adminSession) await loadAdminData();
    } catch {
      setEditDeleteStatus("error");
    }
  };
  const filteredAdminRentalListings = adminRentalListings.filter(r => adminRentalStatusFilter === "all" || (r.status ?? "approved") === adminRentalStatusFilter);
  // ── End jobs computed ──────────────────────────────────────
  const deletedStaticItemSet = new Set(deletedStaticItems);
  const visibleInitialBusinesses = initialBusinesses.filter(business => !deletedStaticItemSet.has(`business:${business.id}`) && !hiddenStaticItemSet.has(`business:${business.id}`));
  const hiddenInitialBusinesses = initialBusinesses.filter(business => !deletedStaticItemSet.has(`business:${business.id}`) && hiddenStaticItemSet.has(`business:${business.id}`));
  const visibleStaticEvents = events.filter(event => !deletedStaticItemSet.has(staticEventKey(event)) && !hiddenStaticItemSet.has(staticEventKey(event)));
  const hiddenStaticEvents = events.filter(event => !deletedStaticItemSet.has(staticEventKey(event)) && hiddenStaticItemSet.has(staticEventKey(event)));
  const visibleStaticGalleryPhotos = galleryShots.filter(photo => !deletedStaticItemSet.has(staticGalleryKey(photo)) && !hiddenStaticItemSet.has(staticGalleryKey(photo)));
  const hiddenStaticGalleryPhotos = galleryShots.filter(photo => !deletedStaticItemSet.has(staticGalleryKey(photo)) && hiddenStaticItemSet.has(staticGalleryKey(photo)));
  const lobbyClickReports = itemReports.filter(report => report.itemType === "Lobby");
  const serviceClickReports = itemReports.filter(report => report.itemType !== "Lobby");
  const likeCountFor = (itemType, itemKey) => likeCounts[`${itemType}:${itemKey}`] ?? 0;
  const renderAdminBusinessDeleteModal = () => deletingAdminBusiness ? <div className="admin-modal-backdrop" role="presentation">
        <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-business-delete-title">
          <div className="admin-modal-heading">
            <p className="eyebrow">Admin Business</p>
            <h2 id="admin-business-delete-title">Delete Business?</h2>
          </div>
          <p>Permanently delete this business from Abilene Vibes?</p>
          <p>{deletingAdminBusiness.business_name}</p>
          <div className="admin-modal-actions">
            <button className="directory-link danger-link" type="button" onClick={confirmDeleteAdminBusiness} disabled={adminBusinessActionKey.startsWith(`${deletingAdminBusiness.id}:`)}>
              {adminBusinessActionKey === `${deletingAdminBusiness.id}:delete` ? "Deleting..." : "Confirm Delete"}
            </button>
            <button className="directory-link" type="button" onClick={() => setDeletingAdminBusiness(null)} disabled={adminBusinessActionKey.startsWith(`${deletingAdminBusiness.id}:`)}>
              Cancel
            </button>
          </div>
          {adminStatus === "error" && <p className="form-error">Could not delete this business.</p>}
        </section>
      </div> : null;
  const renderBusinessPlanButtons = (business, options = {}) => {
    const isBusinessAction = action => adminBusinessActionKey === `${business.id}:${action}`;
    const isBusinessBusy = adminBusinessActionKey.startsWith(`${business.id}:`);
    return <>
        {<div className="aw-promotion-meta"><strong data-plan={String(business.plan || "free").toLowerCase()}>{business.plan || "Free"}</strong><span>{business.placement_source === "comp" ? "Admin Promo / COMP" : ["paid", "cancel_pending"].includes(business.payment_status) ? "Paid" : "No paid promotion"}</span>{business.placement_expires_at && <time dateTime={business.placement_expires_at}>Expires {adminDate(business.placement_expires_at)}</time>}</div>}
        {(options.showEdit !== false || options.showCategoryPhoto) && <div className="admin-business-action-group">
            <span className="admin-business-action-label">Edit</span>
            <div className="admin-business-action-buttons">
              {options.showEdit !== false && <button className="directory-link" type="button" onClick={() => editBusiness(business)} disabled={isBusinessBusy}>
                  {isBusinessAction("edit") ? "Updating..." : "Edit"}
                </button>}
              {options.showCategoryPhoto && <label className="directory-link file-action">
                  {isBusinessAction("photo") ? "Uploading..." : "Change Photo"}
                  <input type="file" accept="image/*" disabled={isBusinessBusy} onChange={inputEvent => {
              changeBusinessPhoto(business.id, inputEvent.target.files?.[0]);
              inputEvent.target.value = "";
            }} />
                </label>}
            </div>
          </div>}
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
            {business.placement_source === "comp" && <button className="directory-link danger-link" type="button" onClick={() => clearCompBusinessPlacement(business)} disabled={isBusinessBusy}>
                {isBusinessAction("end-promo") ? "Updating..." : "End Promo"}
              </button>}
            {business.placement_source !== "comp" && business.plan !== "Free" && business.payment_status !== "not_required" && business.stripe_subscription_id && ["paid", "cancel_pending"].includes(business.payment_status) && <button className="directory-link danger-link" type="button" onClick={() => cancelBusinessSubscription(business)} disabled={isBusinessBusy}>
                {isBusinessAction("cancel-subscription") ? "Cancelling..." : "Cancel Subscription"}
              </button>}
          </div>
        </div>
      </>;
  };
  async function reviewUgcContent(module, id) {
    setUgcReview(id);
    setUgcReportedReview(null);
    if (module === "review") {
      const {
        data,
        error
      } = await supabase.from("business_reviews").select("id,business_id,business_name,reviewer_name,rating,comment,status").eq("id", id).maybeSingle();
      if (!error && data) setUgcReportedReview(data);
    }
    setAdminTab({
      business: "businesses",
      job: "jobs",
      rental: "rentals",
      event: "events",
      marketplace: "marketplace",
      gallery: "gallery",
      review: "reviews"
    }[module]);
  }
  const withSplash = content => content;
  useEffect(() => {
    if (!supabase) return;
    const controller = createAdminWebSession(supabase, {
      onState: (state, session) => {
        setAdminAuthState(state);
        if (state === 'DATA_ERROR') setAdminStatus('error');
        setAdminSession(session);
        setOwnerUserId(session?.user?.id ?? "");
        adminSessionRef.current = session;
      },
      onLoading: setAdminRefreshing,
      load: (session, refresh, isCurrent) => performAdminDataLoad(session, refresh, isCurrent)
    });
    adminWebController.current = controller;
    const {
      data
    } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') controller.apply(null);else window.setTimeout(() => void controller.restore(), 0);
    });
    void controller.restore();
    return () => {
      controller.dispose();
      data.subscription.unsubscribe();
    };
  }, []);
  if (true && adminSession && editRentalPage && editingRental) {
    const isSTR = editingRental.property_type === "Short-Term";
    return withSplash(<main className="app admin-page">
        <div className="admin-shell">
          <button className="back-button" onClick={() => {
          setEditRentalPage(false);
          setEditingRental(null);
          setAdminStatus("");
        }}>
            ← Back to Rentals
          </button>
          <section className="admin-header" aria-labelledby="edit-rental-title">
            <p className="eyebrow">Admin · Rent &amp; Housing</p>
            <h1 id="edit-rental-title">Edit Rental Listing</h1>
          </section>
          <section className="admin-section" style={{
          display: "grid",
          gap: "14px"
        }}>
            {[{
            label: "Title",
            field: "title"
          }, {
            label: "Address",
            field: "address"
          }, {
            label: "Contact Person",
            field: "contact_person"
          }, {
            label: "Phone",
            field: "phone"
          }, {
            label: "Email",
            field: "email"
          }, {
            label: "Website URL",
            field: "external_url"
          }].map(({
            label,
            field
          }) => <label className="form-field" key={field}>
                <span>{label}</span>
                <input type="text" className="business-input" value={editingRental[field] ?? ""} onChange={e => setEditingRental(prev => ({
              ...prev,
              [field]: e.target.value
            }))} />
              </label>)}
            <label className="form-field">
              <span>Property Type</span>
              <select className="business-input" value={editingRental.property_type ?? "Apartment"} onChange={e => setEditingRental(prev => ({
              ...prev,
              property_type: e.target.value
            }))}>
                {["Apartment", "House", "Room", "Commercial", "For Sale", "Short-Term"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            {isSTR ? <>
                {[{
              label: "Price/Night ($)",
              field: "price_per_night"
            }, {
              label: "Price/Week ($)",
              field: "price_per_week"
            }, {
              label: "Max Guests",
              field: "max_guests"
            }, {
              label: "Available From",
              field: "available_from"
            }, {
              label: "Available To",
              field: "available_to"
            }].map(({
              label,
              field
            }) => <label className="form-field" key={field}>
                    <span>{label}</span>
                    <input type="text" className="business-input" value={editingRental[field] ?? ""} onChange={e => setEditingRental(prev => ({
                ...prev,
                [field]: e.target.value
              }))} />
                  </label>)}
                <label className="form-field">
                  <span>House Rules</span>
                  <textarea className="business-input" rows={3} value={editingRental.house_rules ?? ""} onChange={e => setEditingRental(prev => ({
                ...prev,
                house_rules: e.target.value
              }))} />
                </label>
              </> : <>
                {[{
              label: "Rent/Price ($)",
              field: "price"
            }, {
              label: "Deposit ($)",
              field: "deposit"
            }, {
              label: "Bedrooms",
              field: "bedrooms"
            }, {
              label: "Bathrooms",
              field: "bathrooms"
            }].map(({
              label,
              field
            }) => <label className="form-field" key={field}>
                    <span>{label}</span>
                    <input type="text" className="business-input" value={editingRental[field] ?? ""} onChange={e => setEditingRental(prev => ({
                ...prev,
                [field]: e.target.value
              }))} />
                  </label>)}
              </>}
            <label className="form-field">
              <span>Description</span>
              <textarea className="business-input" rows={5} value={editingRental.description ?? ""} onChange={e => setEditingRental(prev => ({
              ...prev,
              description: e.target.value
            }))} />
            </label>
            <label className="form-field" style={{
            flexDirection: "row",
            alignItems: "center",
            gap: "10px"
          }}>
              <input type="checkbox" checked={editingRental.pets_allowed ?? false} onChange={e => setEditingRental(prev => ({
              ...prev,
              pets_allowed: e.target.checked
            }))} style={{
              width: "18px",
              height: "18px"
            }} />
              <span>Pets Allowed</span>
            </label>
            <label className="form-field">
              <span>Duration</span>
              <select className="business-input" value={editingRental.duration ?? "30"} onChange={e => setEditingRental(prev => ({
              ...prev,
              duration: e.target.value
            }))}>
                {["7", "14", "30", "60", "90"].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Plan</span>
              <select className="business-input" value={editingRental.plan ?? "free"} onChange={e => setEditingRental(prev => ({
              ...prev,
              plan: e.target.value
            }))}>
                <option value="free">free</option>
                <option value="featured">featured</option>
                <option value="premium">premium</option>
              </select>
            </label>
            <label className="form-field">
              <span>Status</span>
              <select className="business-input" value={editingRental.status ?? "approved"} onChange={e => setEditingRental(prev => ({
              ...prev,
              status: e.target.value
            }))}>
                <option value="approved">approved</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
                <option value="hidden">hidden</option>
              </select>
            </label>
            <div className="form-field">
              <span>Photos</span>
              <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "6px"
            }}>
                {(editingRental.image_data ?? []).map((src, idx) => <div key={idx} style={{
                position: "relative"
              }}>
                    <img src={src} alt={`Photo ${idx + 1}`} style={{
                  width: "90px",
                  height: "70px",
                  objectFit: "cover",
                  borderRadius: "8px"
                }} />
                    <button type="button" onClick={() => setEditingRental(prev => ({
                  ...prev,
                  image_data: (prev.image_data ?? []).filter((_, i) => i !== idx)
                }))} style={{
                  position: "absolute",
                  top: "2px",
                  right: "2px",
                  background: "rgba(0,0,0,0.7)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  cursor: "pointer",
                  fontSize: "12px",
                  lineHeight: "20px",
                  padding: 0
                }} aria-label="Remove photo">✕</button>
                  </div>)}
              </div>
              {(editingRental.image_data ?? []).length < 8 && <input type="file" accept="image/*" multiple style={{
              marginTop: "8px"
            }} onChange={async e => {
              const files = Array.from(e.target.files ?? []);
              const remaining = 8 - (editingRental.image_data ?? []).length;
              const toAdd = files.slice(0, remaining);
              for (const file of toAdd) {
                try {
                  const compressed = await optimizeGalleryImage(file);
                  const reader = new FileReader();
                  reader.onload = ev => setEditingRental(prev => {
                    const current = prev.image_data ?? [];
                    return current.length < 8 ? {
                      ...prev,
                      image_data: [...current, ev.target.result]
                    } : prev;
                  });
                  reader.readAsDataURL(compressed);
                } catch {
                  const reader = new FileReader();
                  reader.onload = ev => setEditingRental(prev => {
                    const current = prev.image_data ?? [];
                    return current.length < 8 ? {
                      ...prev,
                      image_data: [...current, ev.target.result]
                    } : prev;
                  });
                  reader.readAsDataURL(file);
                }
              }
              e.target.value = "";
            }} />}
            </div>
            {adminStatus === "error" && <p className="form-error">Could not save. Try again.</p>}
            {adminStatus === "rental-payment-incomplete" && <p className="form-error">Payment is not completed yet.</p>}
            <div className="admin-rental-edit-actions" style={{
            marginTop: "8px"
          }}>
              <button className="admin-rental-edit-button" type="button" onClick={handleSaveRental} disabled={adminStatus === "saving"}>
                {adminStatus === "saving" ? "SAVING..." : "Save Changes"}
              </button>
              <button className="admin-rental-edit-button" type="button" onClick={() => {
              setEditRentalPage(false);
              setEditingRental(null);
              setAdminStatus("");
            }}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      </main>);
  }
  if (true && adminSession && editJobPage && editingJob) {
    return withSplash(<main className="app admin-page">
        <div className="admin-shell">
          <button className="back-button" onClick={() => {
          setEditJobPage(false);
          setEditingJob(null);
          setAdminStatus("");
        }}>
            ← Back to Jobs
          </button>
          <section className="admin-header" aria-labelledby="edit-job-title">
            <p className="eyebrow">Admin · Jobs &amp; Hiring</p>
            <h1 id="edit-job-title">Edit Job Listing</h1>
          </section>
          <section className="admin-section" style={{
          display: "grid",
          gap: "14px"
        }}>
            {[{
            label: "Title",
            field: "title"
          }, {
            label: "Company",
            field: "company"
          }, {
            label: "Category",
            field: "category"
          }, {
            label: "Job Type",
            field: "job_type"
          }, {
            label: "Pay",
            field: "pay_label"
          }, {
            label: "Location",
            field: "location"
          }, {
            label: "Phone",
            field: "phone"
          }, {
            label: "Email",
            field: "email"
          }, {
            label: "App Method",
            field: "app_method"
          }, {
            label: "Apply Website URL",
            field: "apply_url"
          }, {
            label: "Duration",
            field: "duration"
          }].map(({
            label,
            field
          }) => <label className="form-field" key={field}>
                <span>{label}</span>
                <input type="text" className="business-input" value={editingJob[field] ?? ""} onChange={e => setEditingJob(prev => ({
              ...prev,
              [field]: e.target.value
            }))} />
              </label>)}
            <label className="form-field">
              <span>Plan</span>
              <select className="business-input" value={editingJob.plan ?? "free"} onChange={e => setEditingJob(prev => ({
              ...prev,
              plan: e.target.value
            }))}>
                <option value="free">free</option>
                <option value="featured">featured</option>
                <option value="premium">premium</option>
              </select>
            </label>
            <label className="form-field">
              <span>Status</span>
              <select className="business-input" value={editingJob.status ?? "approved"} onChange={e => setEditingJob(prev => ({
              ...prev,
              status: e.target.value
            }))}>
                <option value="approved">approved</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
                <option value="hidden">hidden</option>
              </select>
            </label>
            <label className="form-field">
              <span>Description</span>
              <textarea className="business-input" rows={5} value={editingJob.description ?? ""} onChange={e => setEditingJob(prev => ({
              ...prev,
              description: e.target.value
            }))} />
            </label>
            <label className="form-field">
              <span>Requirements</span>
              <textarea className="business-input" rows={4} value={editingJob.requirements ?? ""} onChange={e => setEditingJob(prev => ({
              ...prev,
              requirements: e.target.value
            }))} />
            </label>
            <label className="form-field">
              <span>Job photo (replace)</span>
              <input type="file" accept="image/*" onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const compressed = await optimizeGalleryImage(file);
                setEditingJob(prev => ({
                  ...prev,
                  image_data: compressed
                }));
              } catch {
                const r = new FileReader();
                r.onload = ev => setEditingJob(prev => ({
                  ...prev,
                  image_data: ev.target.result
                }));
                r.readAsDataURL(file);
              }
            }} />
              {editingJob.image_data && <img src={editingJob.image_data} alt="Job photo" style={{
              maxWidth: "180px",
              marginTop: "8px",
              borderRadius: "8px"
            }} />}
            </label>
            <label className="form-field">
              <span>Company logo (replace)</span>
              <input type="file" accept="image/*" onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const compressed = await optimizeGalleryImage(file);
                setEditingJob(prev => ({
                  ...prev,
                  logo_data: compressed
                }));
              } catch {
                const r = new FileReader();
                r.onload = ev => setEditingJob(prev => ({
                  ...prev,
                  logo_data: ev.target.result
                }));
                r.readAsDataURL(file);
              }
            }} />
              {editingJob.logo_data && <img src={editingJob.logo_data} alt="Company logo" style={{
              maxWidth: "120px",
              marginTop: "8px",
              borderRadius: "8px"
            }} />}
            </label>
            {(adminStatus === "error" || adminStatus === "job-save-error") && <p className="form-error">Could not save. Try again.</p>}
            {adminStatus === "job-refresh-error" && <p className="form-error">Job saved, but the Jobs list could not refresh. Please refresh Jobs.</p>}
            {adminStatus === "job-payment-incomplete" && <p className="form-error">Payment is not completed yet.</p>}
            <div className="admin-job-edit-actions">
              <button className="admin-job-edit-button" type="button" onClick={handleSaveJob} disabled={adminStatus === "saving"}>
                {adminStatus === "saving" ? "SAVING..." : "Save Changes"}
              </button>
              <button className="admin-job-edit-button" type="button" onClick={() => {
              setEditJobPage(false);
              setEditingJob(null);
              setAdminStatus("");
            }}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      </main>);
  }
  return <main className={`app admin-page ${"admin-web-dashboard"}`}>
        <div className="admin-shell">
          <AdminWorkspace enabled={true} authorized={Boolean(supabase && adminSession)} tabs={adminTabs} selected={adminTab} onSelect={setAdminTab} status={adminStatus} refreshing={adminRefreshing} counts={adminCounters({
        pendingEvents,
        pendingBusinesses,
        pendingClaims,
        pendingGalleryPhotos,
        pendingReviews,
        adminMarketplaceListings,
        adminJobListings,
        adminRentalListings
      })} summaries={[{
        label: "Published businesses",
        value: publishedBusinesses.length,
        module: "businesses"
      }, {
        label: "Active business promotions",
        value: publishedBusinesses.filter(hasActiveBusinessPromotion).length,
        module: "businesses"
      }, {
        label: "Published events",
        value: publishedEvents.length,
        module: "events"
      }]} onRefresh={() => loadAdminData(adminSession, true)} onLogout={handleAdminLogout} onBack={backToLobby}>
          {false}

          {!supabase && <p className="form-error">Connect Supabase before using the admin panel.</p>}

          {adminAuthState === "AUTHENTICATING" && <p role="status">Validating admin access...</p>}
          {adminAuthState === "ACCESS_DENIED" && <p role="alert">Access denied. This account is not an authorized administrator.</p>}
          {adminAuthState === "LOGIN_ERROR" && <p role="alert">Sign-in failed. Check your email and password.</p>}
          {adminAuthState === "NETWORK_ERROR" && <p role="alert">Unable to validate access or load data. Please retry.</p>}
          {["NETWORK_ERROR", "ACCESS_DENIED"].includes(adminAuthState) && <button type="button" onClick={() => adminWebController.current?.restore()}>Retry access</button>}

          {supabase && !adminSession && <form className="business-form admin-login" onSubmit={handleAdminLogin}>
              <div className="business-form-heading">
                <p className="eyebrow">Owner login</p>
                <h2>Abilene Vibes</h2>
                <p>Private Admin · Sign in</p>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Email</span>
                  <input type="email" value={adminEmail} disabled={adminStatus === "signing-in"} onChange={event => setAdminEmail(event.target.value)} placeholder="you@example.com" required />
                </label>

                <PasswordField autoComplete="current-password" disabled={adminStatus === "signing-in"} inputProps={{
              value: adminPassword,
              onChange: event => setAdminPassword(event.target.value),
              placeholder: "Password",
              minLength: undefined
            }} />
              </div>

              {adminStatus === "login-error" && <p className="form-error">Login failed. Check your email and password.</p>}
              {adminStatus === "missing-config" && <p className="form-error">Supabase is not connected.</p>}

              <button className="primary-button subscribe-button" type="submit" disabled={adminStatus === "signing-in" || !adminPassword}>
                {adminStatus === "signing-in" ? "Signing in..." : "Sign In"}
              </button>
            </form>}

          {supabase && adminSession && <>
              {renderAdminBusinessDeleteModal()}
              {false}

              {adminStatus === "error" && <p className="form-error">Could not refresh or save admin data. Please try again.</p>}
              {adminModuleErrors.length > 0 && <p className="form-error" role="status">Could not refresh: {adminModuleErrors.join(", ")}. Previous data, if available, is retained. Use Refresh to retry.</p>}
              {false}
              {false}
              {adminStatus === "saving" && <p className="form-success">Saving...</p>}

              {false}

              <div className={`admin-panel-view admin-panel-view-${adminTab}`}>
              {ugcReview && adminTab !== "reports" && <aside className="ugc-review-reference">Reported content: {ugcReview}. Check this reference using the existing moderation controls. <button type="button" onClick={() => {
                setUgcReportedReview(null);
                setAdminTab("reports");
              }}>Back to Content Reports</button></aside>}
              {adminTab === "reports" && <AdminReports client={supabase} onReview={reviewUgcContent} />}
              <section className="admin-section admin-tab-events" id="admin-events" aria-labelledby="admin-event-form-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Events</p>
                  <h2 id="admin-event-form-title">Add Event</h2>
                </div>

                <form className="gallery-form" onSubmit={handleEventSubmit}>
                  <EventFields />
                  <button className="primary-button subscribe-button" type="submit" disabled={eventSubmissionStatus === "saving"}>
                    {eventSubmissionStatus === "saving" ? "Saving..." : "Publish Event"}
                  </button>

                  {eventSubmissionStatus && eventSubmissionStatus !== "saving" && <p className={eventSubmissionStatus === "saved" ? "form-success" : "form-error"}>
                      {eventSubmissionStatus === "saved" ? "Event published." : eventSubmissionStatus === "missing-config" ? "Supabase is not connected." : "Could not save event."}
                    </p>}
                </form>
              </section>

              <AdminOwnershipClaims claims={pendingClaims} businesses={publishedBusinesses} busy={adminStatus === "saving"} onReview={async (claim, status) => {
              const note = window.prompt("Record verification performed / reason (minimum 10 characters). Do not include secrets.");
              if (!note || note.trim().length < 10) return;
              setAdminStatus("saving");
              try {
                await moderateAndReload(() => supabase.rpc("review_business_claim", {
                  p_claim: claim.id,
                  p_status: status,
                  p_note: note
                }), () => loadAdminData(adminSession, false, true));
              } catch {
                setAdminStatus("error");
              }
            }} />

              <section className="admin-section admin-tab-events" aria-label="Pending business events">
                <h2>Pending Events</h2>
                {pendingEvents.map(event => <article className="admin-card" key={event.id} data-ugc-content={event.id} data-ugc-highlight={ugcReview === event.id}>
                  <h3>{event.title}</h3>
                  <p>Business: {[...publishedBusinesses, ...pendingBusinesses, ...hiddenBusinesses].find(b => b.id === event.business_id)?.business_name || "Business unavailable"}</p>
                  <p>{event.place}</p><p>{event.description}</p>
                  <p>{event.event_date} {event.event_time} — {event.end_date || event.event_date} {event.end_time || event.event_time}</p>
                  {event.image_data && <img src={event.image_data} alt="" />}
                  {["approved", "rejected"].map(status => <button type="button" key={status} disabled={adminStatus === "saving"} onClick={async () => {
                  setAdminStatus("saving");
                  try {
                    await moderateAndReload(() => supabase.rpc("moderate_premium_event", {
                      p_event: event.id,
                      p_status: status
                    }), () => loadAdminData(adminSession, false, true));
                    await loadEventsPublic();
                  } catch {
                    setAdminStatus("error");
                  }
                }}>{status === "approved" ? "Approve" : "Reject"}</button>)}
                </article>)}
                {!pendingEvents.length && <p>No pending events.</p>}
              </section>

              <section className="admin-section admin-tab-events" aria-labelledby="admin-published-event-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Published</p>
                  <h2 id="admin-published-event-title">Events</h2>
                </div>

                {publishedEvents.length ? <div className="admin-grid">
                    {publishedEvents.map(event => <article className="admin-card" key={event.id} data-ugc-content={event.id} data-ugc-highlight={ugcReview === event.id}>
                        <img src={event.image_data || event.image_url || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80"} alt="" />
                        <span className="event-type">{event.event_type}</span>
                        {!isPublicEventActive(event) && <span className="event-type" style={{
                    background: "rgba(255, 55, 55, 0.18)",
                    borderColor: "rgba(255, 75, 75, 0.85)",
                    color: "#ffd7d7"
                  }}>
                            EXPIRED
                          </span>}
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
                            <input type="file" accept="image/*" onChange={inputEvent => {
                        changeEventPhoto(event.id, inputEvent.target.files?.[0]);
                        inputEvent.target.value = "";
                      }} />
                          </label>
                          <button className="directory-link" type="button" onClick={() => unpublishEvent(event.id)}>
                            Hide
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteEvent(event.id)}>
                            Delete
                          </button>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No published admin events yet.</p>}
              </section>

              <section className="admin-section admin-tab-events" aria-labelledby="admin-hidden-event-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Hidden</p>
                  <h2 id="admin-hidden-event-title">Events</h2>
                </div>

                {hiddenEvents.length || visibleStaticEvents.length || hiddenStaticEvents.length ? <div className="admin-grid">
                    {hiddenEvents.map(event => <article className="admin-card" key={event.id} data-ugc-content={event.id} data-ugc-highlight={ugcReview === event.id}>
                        <span className="event-type">Hidden</span>
                        {!isPublicEventActive(event) && <span className="event-type" style={{
                    background: "rgba(255, 55, 55, 0.18)",
                    borderColor: "rgba(255, 75, 75, 0.85)",
                    color: "#ffd7d7"
                  }}>
                            EXPIRED
                          </span>}
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
                            <input type="file" accept="image/*" onChange={inputEvent => {
                        changeEventPhoto(event.id, inputEvent.target.files?.[0]);
                        inputEvent.target.value = "";
                      }} />
                          </label>
                          <button className="directory-link" type="button" onClick={() => restoreEvent(event.id)}>
                            Restore
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteEvent(event.id)}>
                            Delete
                          </button>
                        </div>
                      </article>)}
                    {visibleStaticEvents.map(event => <article className="admin-card" key={staticEventKey(event)}>
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
                            <input type="file" accept="image/*" onChange={inputEvent => {
                        changeStaticEventPhoto(event, inputEvent.target.files?.[0]);
                        inputEvent.target.value = "";
                      }} />
                          </label>
                          <button className="directory-link" type="button" onClick={() => hideStaticEvent(event)}>
                            Hide
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteStaticItem(staticEventKey(event), event.title)}>
                            Delete
                          </button>
                        </div>
                      </article>)}
                    {hiddenStaticEvents.map(event => <article className="admin-card" key={staticEventKey(event)}>
                        <span className="event-type">Starter hidden</span>
                        <h3>{event.title}</h3>
                        <p>{event.place}</p>
                        <p>{event.date}</p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => restoreStaticEvent(event)}>
                            Restore
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteStaticItem(staticEventKey(event), event.title)}>
                            Delete
                          </button>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No events to manage.</p>}
              </section>
              <section className="admin-section admin-tab-gallery" id="admin-photos" aria-labelledby="admin-gallery-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Pending</p>
                  <h2 id="admin-gallery-title">Gallery Photos</h2>
                </div>

                {pendingGalleryPhotos.length ? <div className="admin-grid">
                    {pendingGalleryPhotos.map(photo => <article className="admin-card" key={photo.id} data-ugc-content={photo.id} data-ugc-highlight={ugcReview === photo.id}>
                        <img src={photo.image_data} alt="" />
                        <span className="event-type">{new Date(photo.created_at).toLocaleDateString()}</span>
                        <h3>{photo.title}</h3>
                        <p>By {photo.contributor_name}</p>
                        <p className="admin-metric">Likes: <strong>{likeCountFor("photo", photo.id)}</strong></p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => moderateGalleryPhoto(photo, "approved")} disabled={adminGalleryActionKey.startsWith(`${photo.id}:`)}>
                            {adminGalleryActionKey === `${photo.id}:approve` ? "Approving..." : "Approve"}
                          </button>
                          <button className="directory-link" type="button" onClick={() => moderateGalleryPhoto(photo, "rejected")} disabled={adminGalleryActionKey.startsWith(`${photo.id}:`)}>
                            {adminGalleryActionKey === `${photo.id}:reject` ? "Rejecting..." : "Reject"}
                          </button>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No pending gallery photos.</p>}
              </section>

              <section className="admin-section admin-tab-businesses" id="admin-businesses" aria-labelledby="admin-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Pending</p>
                  <h2 id="admin-business-title">Businesses</h2>
                </div>

                {pendingBusinesses.length ? <div className="admin-grid">
                    {pendingBusinesses.map(business => <article className="admin-card" key={business.id} data-ugc-content={business.id} data-ugc-highlight={ugcReview === business.id}>
                        <span className="event-type" data-plan={String(business.plan || "free").toLowerCase()}>{business.plan} - {business.payment_status}</span>
                        {business.placement_source === "comp" && <span className="event-type">Comp promo</span>}
                        {business.placement_expires_at && <p>Promo expires: {new Date(business.placement_expires_at).toLocaleDateString()}</p>}
                        {business.image_data && <img src={business.image_data} alt="" />}
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        {business.contact_email && <p>Email: {business.contact_email}</p>}
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          {renderBusinessPlanButtons(business, {
                      showCategoryPhoto: true
                    })}
                          <div className="admin-business-action-group">
                            <span className="admin-business-action-label">Publishing</span>
                            <div className="admin-business-action-buttons">
                              <button className="directory-link" type="button" onClick={() => moderateBusiness(business, "approved")} disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                {adminBusinessActionKey === `${business.id}:approve` ? "Approving..." : "Approve"}
                              </button>
                              <button className="directory-link" type="button" onClick={() => moderateBusiness(business, "rejected")} disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                {adminBusinessActionKey === `${business.id}:reject` ? "Rejecting..." : "Reject"}
                              </button>
                              <button className="directory-link danger-link" type="button" onClick={() => {
                          setDeletingAdminBusiness({
                            ...business
                          });
                          setAdminStatus("");
                        }} disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                {adminBusinessActionKey === `${business.id}:delete` ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No pending businesses.</p>}
              </section>

              <section className="admin-section admin-tab-reviews" id="admin-reviews" aria-labelledby="admin-review-title">
                <div className="business-form-heading">
                  <p className="eyebrow">{ugcReportedReview ? "Pending / Reported" : "Pending"}</p>
                  <h2 id="admin-review-title">Reviews</h2>
                </div>

                {pendingReviews.length || ugcReportedReview ? <div className="admin-grid">
                    {[...pendingReviews, ...(ugcReportedReview && !pendingReviews.some(r => r.id === ugcReportedReview.id) ? [ugcReportedReview] : [])].map(review => <article className="admin-card" key={review.id} data-ugc-content={review.id} data-ugc-highlight={ugcReview === review.id}>
                        <span className="event-type">{review.rating} stars</span>
                        <h3>{review.business_name}</h3>
                        <p>By {review.reviewer_name}</p>
                        <p>{review.comment}</p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => moderateItem("business_reviews", review.id, "approved")}>
                            Approve
                          </button>
                          <button className="directory-link" type="button" onClick={() => moderateItem("business_reviews", review.id, "rejected")}>
                            Reject
                          </button>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No pending reviews.</p>}
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

                {paymentRecords.length ? <>
                    <h3>Earnings by Business</h3>
                    <div className="admin-grid">
                      {paymentEarningsByBusiness.map(businessEarnings => <article className="admin-card" key={`payment-earnings-${businessEarnings.id}`}>
                          <h3>{businessEarnings.name}</h3>
                          <p>Gross: {formatPaymentAmount(businessEarnings.gross, businessEarnings.currency)}</p>
                          <p>Stripe Fees: {formatPaymentAmount(businessEarnings.fees, businessEarnings.currency)}</p>
                          <p>Net Earned: {formatPaymentAmount(businessEarnings.net, businessEarnings.currency)}</p>
                          <p>Payments: {businessEarnings.payments}</p>
                        </article>)}
                    </div>

                    <div className="admin-grid">
                      {paymentRecords.map(record => {
                    const business = paymentBusinessesById[record.business_submission_id];
                    return <article className="admin-card" key={`payment-record-${record.id}`}>
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
                          </article>;
                  })}
                    </div>
                  </> : <p className="legal-disclaimer">No payment details available yet.</p>}

                {paymentBusinesses.length ? <div className="admin-grid">
                    {paymentBusinesses.map(business => {
                  const paymentRecord = paymentRecordsByBusiness[business.id];
                  const expirationDate = business.placement_expires_at ? new Date(business.placement_expires_at).toLocaleDateString() : "Not set";
                  const promotionStatus = businessPromotionStatus(business);
                  return <article className="admin-card" key={`payment-${business.id}`}>
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
                          {paymentRecord ? <>
                              <p>Gross Amount: {formatPaymentAmount(paymentRecord.gross_amount, paymentRecord.currency)}</p>
                              <p>Stripe Fee: {formatPaymentAmount(paymentRecord.stripe_fee, paymentRecord.currency)}</p>
                              <p>Net Amount: {formatPaymentAmount(paymentRecord.net_amount, paymentRecord.currency)}</p>
                              <p>Payment Date: {paymentRecord.paid_at ? new Date(paymentRecord.paid_at).toLocaleDateString() : "Not available"}</p>
                            </> : <p>Payment amounts: not recorded yet</p>}
                          <div className="directory-actions">
                            {renderBusinessPlanButtons(business)}
                            <div className="admin-business-action-group">
                              <span className="admin-business-action-label">Publishing</span>
                              <div className="admin-business-action-buttons">
                                <button className="directory-link" type="button" onClick={() => moderateBusiness(business, "approved")} disabled={business.status === "approved" || adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                  {adminBusinessActionKey === `${business.id}:approve` ? "Approving..." : "Approve"}
                                </button>
                                <button className="directory-link danger-link" type="button" onClick={() => deleteBusiness(business.id)} disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                  {adminBusinessActionKey === `${business.id}:delete` ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>;
                })}
                  </div> : <p className="legal-disclaimer">No paid plan activity yet.</p>}

                {promoBusinesses.length ? <>
                    <div className="business-form-heading">
                      <p className="eyebrow">Limited time</p>
                      <h2>Free Promos</h2>
                    </div>
                    <div className="admin-grid">
                      {promoBusinesses.map(business => <article className="admin-card" key={`promo-${business.id}`}>
                          <span className="event-type payment-status payment-comp">Comp promo</span>
                          <h3>{business.business_name}</h3>
                          <p>{business.plan} plan</p>
                          <p>Status: {business.status}</p>
                          {business.contact_email && <p>Email: {business.contact_email}</p>}
                          {business.placement_expires_at && <p>Expires: {new Date(business.placement_expires_at).toLocaleDateString()}</p>}
                          <div className="directory-actions">
                            {renderBusinessPlanButtons(business)}
                          </div>
                        </article>)}
                    </div>
                  </> : null}
              </section>

              {/* ── Jobs & Hiring admin section ── */}
              <section className="admin-section admin-tab-jobs" id="admin-jobs" aria-labelledby="admin-jobs-title">
                <div className="business-form-heading">
                  <p className="eyebrow">All listings</p>
                  <h2 id="admin-jobs-title">Jobs &amp; Hiring</h2>
                </div>
                {adminStatus === "job-payment-incomplete" && <p className="form-error">Payment is not completed yet.</p>}

                {adminJobListings.length ? <div className="admin-grid">
                    {adminJobListings.map(job => {
                  const jobPlan = String(job.plan ?? "free").toLowerCase();
                  const jobPaymentStatus = String(job.payment_status ?? "unknown").toLowerCase();
                  const isJobCompPromo = ["featured", "premium"].includes(jobPlan) && jobPaymentStatus === "not_required";
                  const approvingJob = adminJobActionKey === `${job.id}:status:approved`;
                  const deletingJob = adminJobActionKey === `${job.id}:delete`;
                  const isJobBusy = adminJobActionKey.startsWith(`${job.id}:`);
                  return <article className="admin-card" key={job.id} data-ugc-content={job.id} data-ugc-highlight={ugcReview === job.id}>
                        {<AdminCardMedia src={job.image_data} />}
                        <div className="aw-badges">
                          {[job.plan || "free", job.status || "pending", job.payment_status || "unknown"].map((value, index) => <span key={index} className="aw-badge" data-status={String(value).toLowerCase()} data-plan={index === 0 ? String(value).toLowerCase() : undefined}>{adminBadgeText(value)}</span>)}
                          {isJobCompPromo && <span className="aw-badge" data-status="comp">Admin Promo / COMP</span>}
                        </div>
                        <h3>{job.title}</h3>
                        <p>{job.company}</p>
                        {job.category && <p>Category: {job.category}</p>}
                        {job.job_type && <p>Type: {job.job_type}</p>}
                        {job.pay_label && <p>Pay: {job.pay_label}</p>}
                        {job.location && <p>Location: {job.location}</p>}
                        {job.contact_person && <p>Contact Person: {job.contact_person}</p>}
                        {job.phone && <p>Phone: {job.phone}</p>}
                        {job.email && <p>Email: {job.email}</p>}
                        {job.app_method && <p>Apply via: {job.app_method}</p>}
                        {job.duration && <p>Duration: {job.duration}</p>}
                        {job.description && <p style={{
                      fontSize: "0.85em",
                      opacity: 0.8
                    }}>{job.description.slice(0, 120)}{job.description.length > 120 ? "…" : ""}</p>}
                        <p style={{
                      fontSize: "0.8em",
                      opacity: 0.6
                    }}>
                          Posted: {adminDate(job.created_at)}
                          {job.expires_at ? ` · Expires: ${adminDate(job.expires_at)}` : ""}
                        </p>
                        <div className="directory-actions">
                          {job.status === "pending" && <>
                              <button className="directory-link" type="button" onClick={() => handleApproveJob(job)} disabled={isJobBusy}>
                                {approvingJob ? "APPROVING..." : "Approve"}
                              </button>
                              <button className="directory-link" type="button" onClick={() => setJobPaymentPlan(job, job.plan ?? "free", "rejected", job.payment_status ?? "not_required", job.expires_at ?? null)} disabled={isJobBusy}>
                                Reject
                              </button>
                            </>}
                          {job.status === "approved" && <button className="directory-link" type="button" onClick={() => setJobPaymentPlan(job, job.plan ?? "free", "hidden", job.payment_status ?? "not_required", job.expires_at ?? null)} disabled={isJobBusy}>
                              Hide / Unpublish
                            </button>}
                          {(job.status === "hidden" || job.status === "rejected") && <button className="directory-link" type="button" onClick={() => handleApproveJob(job)} disabled={isJobBusy}>
                              {approvingJob ? "APPROVING..." : "Show / Restore"}
                            </button>}
                          <button className="directory-link" type="button" onClick={() => {
                        setEditingJob({
                          ...job
                        });
                        setEditJobPage(true);
                      }} disabled={isJobBusy}>
                            Edit
                          </button>
                          <button className="directory-link" type="button" onClick={() => setPaidJobPlacement(job, "free")} disabled={isJobBusy || jobPlan === "free" && jobPaymentStatus === "not_required"}>
                            Plan Free
                          </button>
                          <button className="directory-link" type="button" onClick={() => compJobPlacement(job, "featured")} disabled={isJobBusy || jobPlan === "featured" && jobPaymentStatus === "not_required"}>
                            Free Promo Featured
                          </button>
                          <button className="directory-link" type="button" onClick={() => compJobPlacement(job, "premium")} disabled={isJobBusy || jobPlan === "premium" && jobPaymentStatus === "not_required"}>
                            Free Promo Premium
                          </button>
                          {isJobCompPromo && <button className="directory-link danger-link" type="button" onClick={() => clearCompJobPlacement(job)} disabled={isJobBusy}>
                              End Promo
                            </button>}
                          <button className="directory-link danger-link" type="button" onClick={() => handleDeleteJob(job.id)} disabled={isJobBusy}>
                            {deletingJob ? "DELETING..." : "Delete"}
                          </button>
                        </div>
                      </article>;
                })}
                  </div> : <p className="legal-disclaimer">No job listings yet.</p>}
              </section>

              {/* ── Marketplace admin section ── */}
              <section className="admin-section admin-tab-marketplace" id="admin-marketplace" aria-labelledby="admin-marketplace-title">
                <div className="business-form-heading">
                  <p className="eyebrow">All listings</p>
                  <h2 id="admin-marketplace-title">Marketplace</h2>
                </div>
                <div className="jobs-filter-bar marketplace-admin-filter-bar" aria-label="Marketplace status filters">
                  {[["all", "All"], ["pending", "Pending"], ["active", "Active"], ["hidden", "Hidden"], ["sold", "Sold"]].map(([value, label]) => <button key={value} type="button" className={marketplaceAdminStatusFilter === value ? "is-active" : ""} onClick={() => setMarketplaceAdminStatusFilter(value)}>
                      {label} ({adminMarketplaceCounts[value] ?? 0})
                    </button>)}
                </div>
                {marketplaceAdminStatusFilter === "pending" && <div className="business-form-heading">
                    <p className="eyebrow">Manual review</p>
                    <h2>Pending</h2>
                  </div>}
                {adminStatus === "marketplace-approved" && <p className="form-success">Marketplace listing approved and now eligible for public display.</p>}
                {adminStatus === "marketplace-rejected" && <p className="form-success">Marketplace listing rejected and kept out of public Marketplace.</p>}

                {/* Edit modal (reuses editingListing + handleEditListingSubmit) */}
                {editingListing && adminSession && <div className="admin-modal-backdrop">
                    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-marketplace-edit-title">
                      <div className="business-form-heading">
                        <p className="eyebrow">Edit</p>
                        <h2 id="admin-marketplace-edit-title">Marketplace Listing</h2>
                      </div>
                      <form onSubmit={handleEditListingSubmit}>
                        <div className="form-grid">
                          {[{
                        label: "Title",
                        name: "title",
                        defaultValue: editingListing.title ?? ""
                      }, {
                        label: "Price",
                        name: "price",
                        defaultValue: editingListing.price ?? ""
                      }, {
                        label: "Location",
                        name: "location",
                        defaultValue: editingListing.location ?? ""
                      }, {
                        label: "Contact",
                        name: "contact",
                        defaultValue: editingListing.contact ?? ""
                      }].map(({
                        label,
                        name,
                        defaultValue
                      }) => <label className="form-field" key={name}>
                              <span>{label}</span>
                              <input type="text" name={name} defaultValue={defaultValue} />
                            </label>)}
                          <label className="form-field">
                            <span>Category</span>
                            <select name="category" defaultValue={editingListing.category ?? ""}>
                              {marketplaceCategories.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                            </select>
                          </label>
                          <label className="form-field">
                            <span>Status</span>
                            <select value={editingListing.status ?? "active"} onChange={e => setEditingListing(prev => ({
                          ...prev,
                          status: e.target.value
                        }))} name="_status_ui">
                              {["active", "sold", "expired", "hidden", "deleted"].map(s => <option key={s} value={s}>{s}</option>)}
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
                          <button className="directory-link marketplace-admin-action" type="submit" disabled={editDeleteStatus === "saving"}>
                            {editDeleteStatus === "saving" ? "Saving…" : "Save Changes"}
                          </button>
                          {editingListing.status !== editingListing._origStatus && <button className="directory-link marketplace-admin-action" type="button" onClick={() => setListingStatus(editingListing, editingListing.status)} disabled={editDeleteStatus === "saving" || Boolean(marketplaceActionKey)}>
                              {marketplaceActionKey ? "Updating..." : "Change Status Only"}
                            </button>}
                          <button className="directory-link marketplace-admin-action" type="button" onClick={() => setEditingListing(null)} disabled={editDeleteStatus === "saving" || Boolean(marketplaceActionKey)}>
                            Cancel
                          </button>
                        </div>
                        {editDeleteStatus === "error" && <p className="form-error">Error saving. Try again.</p>}
                      </form>
                    </section>
                  </div>}

                <AdminMarketplacePage listings={adminMarketplaceVisibleListings} active={adminTab === "marketplace" && Boolean(adminSession)} client={supabase} enabled={true}>
                  {(pageListings, imagesReady) => <>
                {pageListings.length ? <div className="admin-grid">
                    {pageListings.map(listing => <article className="admin-card" key={listing.id} data-ugc-content={listing.id} data-ugc-highlight={ugcReview === listing.id}>
                        {parseListingImages(listing.image_data)[0] && <img key={parseListingImages(listing.image_data)[0]} src={parseListingImages(listing.image_data)[0]} alt={listing.title} loading="lazy" onError={event => {
                        event.currentTarget.style.display = "none";
                      }} style={{
                        width: "100%",
                        maxHeight: "140px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        marginBottom: "8px"
                      }} />}
                        <span data-status={marketplaceAdminDisplayStatus(listing)} className={`event-type marketplace-admin-status marketplace-status-${marketplaceAdminDisplayStatus(listing)}`}>
                          {marketplaceAdminDisplayStatus(listing).toUpperCase()}
                        </span>
                        <h3>{listing.title}</h3>
                        {listing.price && <p>Price: {listing.price}</p>}
                        {listing.category && <p>Category: {listing.category}</p>}
                        {listing.location && <p>Location: {listing.location}</p>}
                        {listing.contact && <p>Contact: {listing.contact}</p>}
                        {listing.owner_user_id && <p style={{
                        fontSize: "0.8em",
                        opacity: 0.6
                      }}>Owner: {listing.owner_user_id}</p>}
                        <p style={{
                        fontSize: "0.8em",
                        opacity: 0.75
                      }}>
                          Moderation Status: <strong>{getMarketplaceModerationStatus(listing)}</strong>
                        </p>
                        {(listing.moderation_reason || listing.moderationReason) && <p style={{
                        fontSize: "0.8em",
                        opacity: 0.75
                      }}>
                            Moderation Reason: {listing.moderation_reason ?? listing.moderationReason}
                          </p>}
                        {listing.moderation_score !== null && listing.moderation_score !== undefined && <p style={{
                        fontSize: "0.8em",
                        opacity: 0.75
                      }}>Moderation Score: {listing.moderation_score}</p>}
                        {(listing.moderation_model || listing.moderationModel) && <p style={{
                        fontSize: "0.8em",
                        opacity: 0.75
                      }}>
                            Moderation Model: {listing.moderation_model ?? listing.moderationModel}
                          </p>}
                        {listing.description && <p style={{
                        fontSize: "0.85em",
                        opacity: 0.8
                      }}>
                            {listing.description.slice(0, 120)}{listing.description.length > 120 ? "…" : ""}
                          </p>}
                        <p style={{
                        fontSize: "0.8em",
                        opacity: 0.6
                      }}>
                          Posted: {new Date(listing.created_at).toLocaleDateString()}
                          {listing.expires_at ? ` · Expires: ${new Date(listing.expires_at).toLocaleDateString()}` : ""}
                          {listing.sold_at ? ` · Sold: ${new Date(listing.sold_at).toLocaleDateString()}` : ""}
                        </p>
                        <div className="directory-actions marketplace-admin-actions">
                          {getMarketplaceModerationStatus(listing) === "pending" && <>
                              <button className="directory-link marketplace-admin-action" type="button" onClick={() => setMarketplaceModerationStatus(listing, "approved")} disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}>
                                {marketplaceActionKey === `${listing.id}:moderation:approved` ? "APPROVING..." : "Approve"}
                              </button>
                              <button className="directory-link marketplace-admin-action" type="button" onClick={() => setMarketplaceModerationStatus(listing, "rejected")} disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}>
                                {marketplaceActionKey === `${listing.id}:moderation:rejected` ? "REJECTING..." : "Reject"}
                              </button>
                            </>}
                          <button className="directory-link marketplace-admin-action" type="button" onClick={e => openOwnerEditListing(e, {
                          ...mapListingFromDb(listing),
                          _origStatus: listing.status
                        })} disabled={Boolean(marketplaceActionKey) || !imagesReady(listing)}>
                            Edit
                          </button>
                          {listing.status !== "sold" ? <button className="directory-link marketplace-admin-action" type="button" onClick={() => setListingStatus(mapListingFromDb(listing), "sold")} disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}>
                              {marketplaceActionKey === `${listing.id}:sold` ? "Updating..." : "Mark Sold"}
                            </button> : <button className="directory-link marketplace-admin-action" type="button" onClick={() => setListingStatus(mapListingFromDb(listing), "active")} disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}>
                              {marketplaceActionKey === `${listing.id}:active` ? "Updating..." : "Mark Available"}
                            </button>}
                          {listing.status === "hidden" ? <button className="directory-link marketplace-admin-action" type="button" onClick={() => setListingStatus(mapListingFromDb(listing), "active")} disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}>
                              {marketplaceActionKey === `${listing.id}:active` ? "Updating..." : "Show"}
                            </button> : listing.status === "active" ? <button className="directory-link marketplace-admin-action" type="button" onClick={() => setListingStatus(mapListingFromDb(listing), "hidden")} disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}>
                              {marketplaceActionKey === `${listing.id}:hidden` ? "Updating..." : "Hide"}
                            </button> : null}
                          <button className="directory-link danger-link marketplace-admin-action" type="button" onClick={() => setListingStatus(mapListingFromDb(listing), "deleted")} disabled={marketplaceActionKey.startsWith(`${listing.id}:`)}>
                            {marketplaceActionKey === `${listing.id}:deleted` ? "Updating..." : "Delete"}
                          </button>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No marketplace listings for this filter.</p>}
                  </>}
                </AdminMarketplacePage>
              </section>

              <section className="admin-section admin-tab-rentals" aria-labelledby="admin-rentals-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Rent &amp; Housing</p>
                  <h2 id="admin-rentals-title">Rental Listings</h2>
                </div>
                <div className="jobs-filter-bar" aria-label="Rental status filters">
                  {[["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["hidden", "Hidden"], ["rejected", "Rejected"]].map(([value, label]) => <button key={value} className={`jobs-filter-chip${adminRentalStatusFilter === value ? " is-active" : ""}`} type="button" onClick={() => setAdminRentalStatusFilter(value)} aria-pressed={adminRentalStatusFilter === value}>
                      {label}
                    </button>)}
                </div>
                {adminStatus === "rental-payment-incomplete" && <p className="form-error">Payment is not completed yet.</p>}
                {filteredAdminRentalListings.length > 0 ? <div className="admin-cards-grid">
                    {filteredAdminRentalListings.map(r => {
                  const rentalStatus = r.status ?? "approved";
                  const rentalPlan = String(r.plan ?? "free").toLowerCase();
                  const rentalPaymentStatus = String(r.payment_status ?? "unknown").toLowerCase();
                  const requestedRentalPlan = r.requested_plan ? String(r.requested_plan).charAt(0).toUpperCase() + String(r.requested_plan).slice(1).toLowerCase() : "";
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
                  const canCancelRentalSubscription = r.stripe_subscription_id && rentalPlacementSource === "stripe" && ["paid", "checkout_started", "cancel_pending"].includes(rentalPaymentStatus);
                  return <article key={r.id} className="admin-card">
                        {r.image_data?.[0] && <img src={r.image_data[0]} alt={r.title} className="admin-card-img" />}
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
                          {requestedRentalPlan && <p className="admin-card-meta">
                              Requested plan: <strong>{requestedRentalPlan}</strong>
                            </p>}
                          {rentalStatus === "pending" && <p className="admin-card-meta">
                              Description:<br />{r.description}
                            </p>}
                          <p className="admin-card-meta">
                            Posted: {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                            {r.expires_at ? ` · Expires: ${new Date(r.expires_at).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                        <div className="directory-actions">
                          {rentalStatus === "pending" && <>
                              <button className="directory-link" type="button" onClick={() => handleApproveRental(r)} disabled={isRentalBusy}>
                                {approvingRental ? "Approving..." : "Approve"}
                              </button>
                              <button className="directory-link" type="button" onClick={() => handleSetRentalStatus(r, "rejected")} disabled={isRentalBusy}>
                                {rejectingRental ? "Updating..." : "Reject"}
                              </button>
                            </>}
                          {rentalStatus === "approved" && <button className="directory-link" type="button" onClick={() => handleToggleRentalStatus(r)} disabled={isRentalBusy}>
                              {hidingRental ? "Updating..." : "Hide / Unpublish"}
                            </button>}
                          {(rentalStatus === "hidden" || rentalStatus === "rejected") && <button className="directory-link" type="button" onClick={() => handleApproveRental(r)} disabled={isRentalBusy}>
                              {approvingRental ? "Approving..." : "Show / Restore"}
                            </button>}
                          <button className="directory-link" type="button" onClick={() => {
                        setEditingRental({
                          ...r
                        });
                        setEditRentalPage(true);
                        setAdminStatus("");
                      }}>
                            Edit
                          </button>
                          <button className="directory-link" type="button" onClick={() => setRentalFreePlan(r)} disabled={isRentalBusy || rentalPlan === "free" && rentalPaymentStatus === "not_required" && !r.placement_source && !r.placement_expires_at}>
                            {settingFreeRental ? "Updating..." : "Plan Free"}
                          </button>
                          <button className="directory-link" type="button" onClick={() => compRentalPlacement(r, "featured")} disabled={isRentalBusy || rentalPlan === "featured" && rentalPlacementSource === "comp"}>
                            {settingPromoFeaturedRental ? "Updating..." : "Free Promo Featured"}
                          </button>
                          <button className="directory-link" type="button" onClick={() => compRentalPlacement(r, "premium")} disabled={isRentalBusy || rentalPlan === "premium" && rentalPlacementSource === "comp"}>
                            {settingPromoPremiumRental ? "Updating..." : "Free Promo Premium"}
                          </button>
                          {isRentalCompPromo && <button className="directory-link danger-link" type="button" onClick={() => clearCompRentalPlacement(r)} disabled={isRentalBusy}>
                              {endingPromoRental ? "Updating..." : "End Promo"}
                            </button>}
                          {canCancelRentalSubscription && <button className="directory-link danger-link" type="button" onClick={() => cancelRentalSubscription(r)} disabled={isRentalBusy}>
                              {cancelingRentalSubscription ? "Cancelling..." : "Cancel Subscription"}
                            </button>}
                          <button className="directory-link danger-link" type="button" onClick={() => handleDeleteRental(r.id)} disabled={isRentalBusy}>
                            {deletingRental ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </article>;
                })}
                  </div> : <p className="legal-disclaimer">No rental listings found.</p>}
              </section>

              <section className="admin-section admin-tab-analytics" id="admin-analytics" aria-labelledby="admin-report-title">
                <div className="business-form-heading">
                  <p className="eyebrow">This month</p>
                  <h2 id="admin-report-title">Business Report</h2>
                </div>

                {businessReports.length ? <div className="admin-grid">
                    {businessReports.map(report => <article className="admin-card" key={report.businessId}>
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
                      </article>)}
                  </div> : <p className="legal-disclaimer">No business activity this month yet.</p>}
              </section>

              <section className="admin-section admin-tab-analytics" aria-labelledby="admin-click-report-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Most clicked</p>
                  <h2 id="admin-click-report-title">Top Clicks</h2>
                </div>

                {itemReports.length ? <div className="click-report-columns">
                    {[{
                  title: "Lobby",
                  reports: lobbyClickReports
                }, {
                  title: "Service",
                  reports: serviceClickReports
                }].map(group => <div className="click-report-column" key={group.title}>
                        <div className="click-report-column-heading">
                          <span className="event-type">{group.title}</span>
                          <strong>{group.reports.reduce((total, report) => total + report.clicks, 0)}</strong>
                        </div>

                        {group.reports.length ? <div className="click-report-list">
                            {group.reports.slice(0, 8).map(report => <article className="click-report-card" key={report.itemKey}>
                                <h3>{report.itemName}</h3>
                                <span>Clicks <strong>{report.clicks}</strong></span>
                              </article>)}
                          </div> : <p className="legal-disclaimer">No clicks yet.</p>}
                      </div>)}
                  </div> : <p className="legal-disclaimer">No click activity this month yet.</p>}
              </section>

              <section className="admin-section admin-tab-gallery" aria-labelledby="admin-published-gallery-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Published</p>
                  <h2 id="admin-published-gallery-title">Gallery Photos</h2>
                </div>

                {publishedGalleryPhotos.length ? <div className="admin-grid">
                    {publishedGalleryPhotos.map(photo => <article className="admin-card" key={photo.id} data-ugc-content={photo.id} data-ugc-highlight={ugcReview === photo.id}>
                        <img src={photo.image_data} alt="" />
                        <span className="event-type">{new Date(photo.created_at).toLocaleDateString()}</span>
                        <h3>{photo.title}</h3>
                        <p>By {photo.contributor_name}</p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => deleteGalleryPhoto(photo.id)} disabled={adminGalleryActionKey.startsWith(`${photo.id}:`)}>
                            {adminGalleryActionKey === `${photo.id}:delete` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No published gallery uploads yet.</p>}
              </section>

              <section className="admin-section admin-tab-gallery" aria-labelledby="admin-starter-gallery-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Built in</p>
                  <h2 id="admin-starter-gallery-title">Starter Gallery Photos</h2>
                </div>

                {visibleStaticGalleryPhotos.length || hiddenStaticGalleryPhotos.length ? <div className="admin-grid">
                    {visibleStaticGalleryPhotos.map(photo => <article className="admin-card" key={photo.id} data-ugc-content={photo.id} data-ugc-highlight={ugcReview === photo.id}>
                        <img src={photo.image} alt="" />
                        <span className="event-type">Visible</span>
                        <h3>{photo.title}</h3>
                        <p className="admin-metric">Likes: <strong>{likeCountFor("photo", photo.id)}</strong></p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => hideStaticGalleryPhoto(photo)} disabled={adminGalleryActionKey.startsWith(`${staticGalleryKey(photo)}:`)}>
                            {adminGalleryActionKey === `${staticGalleryKey(photo)}:hide` ? "Hiding..." : "Hide"}
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteStaticGalleryPhoto(photo)} disabled={adminGalleryActionKey.startsWith(`${staticGalleryKey(photo)}:`)}>
                            {adminGalleryActionKey === `${staticGalleryKey(photo)}:delete` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </article>)}
                    {hiddenStaticGalleryPhotos.map(photo => <article className="admin-card" key={photo.id} data-ugc-content={photo.id} data-ugc-highlight={ugcReview === photo.id}>
                        <img src={photo.image} alt="" />
                        <span className="event-type">Hidden</span>
                        <h3>{photo.title}</h3>
                        <p className="admin-metric">Likes: <strong>{likeCountFor("photo", photo.id)}</strong></p>
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => restoreStaticGalleryPhoto(photo)} disabled={adminGalleryActionKey.startsWith(`${staticGalleryKey(photo)}:`)}>
                            {adminGalleryActionKey === `${staticGalleryKey(photo)}:restore` ? "Restoring..." : "Restore"}
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteStaticGalleryPhoto(photo)} disabled={adminGalleryActionKey.startsWith(`${staticGalleryKey(photo)}:`)}>
                            {adminGalleryActionKey === `${staticGalleryKey(photo)}:delete` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No starter gallery photos.</p>}
              </section>

              <section className="admin-section admin-tab-businesses" aria-labelledby="admin-published-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Published</p>
                  <h2 id="admin-published-business-title">Businesses</h2>
                </div>

                {publishedBusinesses.length ? <div className="admin-grid">
                    {publishedBusinesses.map(business => <article className="admin-card" key={business.id} data-ugc-content={business.id} data-ugc-highlight={ugcReview === business.id}>
                        <span className="event-type" data-plan={String(business.plan || "free").toLowerCase()}>{business.plan} - {business.payment_status}</span>
                        {business.placement_source === "comp" && <span className="event-type">Comp promo</span>}
                        {business.placement_expires_at && <p>Promo expires: {new Date(business.placement_expires_at).toLocaleDateString()}</p>}
                        {business.image_data && <img src={business.image_data} alt="" />}
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        {business.contact_email && <p>Email: {business.contact_email}</p>}
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          {renderBusinessPlanButtons(business, {
                      showCategoryPhoto: true
                    })}
                          <div className="admin-business-action-group">
                            <span className="admin-business-action-label">Publishing</span>
                            <div className="admin-business-action-buttons">
                              <button className="directory-link" type="button" onClick={() => unpublishBusiness(business.id)} disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                {adminBusinessActionKey === `${business.id}:hide` ? "Hiding..." : "Unpublish"}
                              </button>
                              <button className="directory-link danger-link" type="button" onClick={() => {
                          setDeletingAdminBusiness({
                            ...business
                          });
                          setAdminStatus("");
                        }} disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                {adminBusinessActionKey === `${business.id}:delete` ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No published businesses yet.</p>}
              </section>

              <section className="admin-section admin-tab-businesses" aria-labelledby="admin-hidden-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Hidden</p>
                  <h2 id="admin-hidden-business-title">Businesses</h2>
                </div>

                {hiddenBusinesses.length ? <div className="admin-grid">
                    {hiddenBusinesses.map(business => <article className="admin-card" key={business.id} data-ugc-content={business.id} data-ugc-highlight={ugcReview === business.id}>
                        <span className="event-type" data-plan={String(business.plan || "free").toLowerCase()}>{business.plan} - {business.payment_status}</span>
                        {business.placement_source === "comp" && <span className="event-type">Comp promo</span>}
                        {business.placement_expires_at && <p>Promo expires: {new Date(business.placement_expires_at).toLocaleDateString()}</p>}
                        {business.image_data && <img src={business.image_data} alt="" />}
                        <h3>{business.business_name}</h3>
                        <p>{business.category}</p>
                        <p>Contact: {business.contact_name}</p>
                        {business.contact_email && <p>Email: {business.contact_email}</p>}
                        <p>{business.phone}</p>
                        {business.address && <p>{business.address}</p>}
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          {renderBusinessPlanButtons(business, {
                      showCategoryPhoto: true
                    })}
                          <div className="admin-business-action-group">
                            <span className="admin-business-action-label">Publishing</span>
                            <div className="admin-business-action-buttons">
                              <button className="directory-link" type="button" onClick={() => restoreBusiness(business)} disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                {adminBusinessActionKey === `${business.id}:restore` ? "Restoring..." : "Restore"}
                              </button>
                              <button className="directory-link danger-link" type="button" onClick={() => {
                          setDeletingAdminBusiness({
                            ...business
                          });
                          setAdminStatus("");
                        }} disabled={adminBusinessActionKey.startsWith(`${business.id}:`)}>
                                {adminBusinessActionKey === `${business.id}:delete` ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No hidden published businesses.</p>}
              </section>

              <section className="admin-section admin-tab-businesses" aria-labelledby="admin-built-in-business-title">
                <div className="business-form-heading">
                  <p className="eyebrow">Built in</p>
                  <h2 id="admin-built-in-business-title">Starter Businesses</h2>
                </div>

                {visibleInitialBusinesses.length ? <div className="admin-grid">
                    {visibleInitialBusinesses.map(business => <article className="admin-card" key={business.id} data-ugc-content={business.id} data-ugc-highlight={ugcReview === business.id}>
                        <span className="event-type">Visible</span>
                        <h3>{business.name}</h3>
                        <p>{business.category}</p>
                        <p>{business.phone}</p>
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => hideStaticBusiness(business)}>
                            Hide
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteStaticItem(`business:${business.id}`, business.name)}>
                            Delete
                          </button>
                        </div>
                      </article>)}
                  </div> : <p className="legal-disclaimer">No visible starter businesses.</p>}

                {hiddenInitialBusinesses.length ? <div className="admin-grid">
                    {hiddenInitialBusinesses.map(business => <article className="admin-card" key={business.id} data-ugc-content={business.id} data-ugc-highlight={ugcReview === business.id}>
                        <span className="event-type">Hidden</span>
                        <h3>{business.name}</h3>
                        <p>{business.category}</p>
                        <p>{business.phone}</p>
                        {business.description && <p>{business.description}</p>}
                        <div className="directory-actions">
                          <button className="directory-link" type="button" onClick={() => restoreStaticBusiness(business)}>
                            Restore
                          </button>
                          <button className="directory-link danger-link" type="button" onClick={() => deleteStaticItem(`business:${business.id}`, business.name)}>
                            Delete
                          </button>
                        </div>
                      </article>)}
                  </div> : null}
              </section>
              </div>
            </>}
          </AdminWorkspace>
        </div>
      </main>;
}
export default AdminShell;
