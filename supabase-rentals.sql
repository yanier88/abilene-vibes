-- ============================================================
-- Abilene Vibes — Rent & Housing Phase 1
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

create table if not exists public.rental_listings (

  -- Core identifiers
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null    default now(),
  expires_at      timestamptz,

  -- Classification
  -- Values: 'Apartment' | 'House' | 'Room' | 'Commercial' | 'For Sale' | 'Short-Term'
  title           text        not null,
  property_type   text        not null    default 'Apartment',

  -- Pricing — long-term
  price           text,                   -- e.g. "$900/mo", "$1,200/mo"
  deposit         text,                   -- e.g. "$500", "First & Last"

  -- Pricing — short-term only (null for long-term listings)
  price_per_night text,                   -- e.g. "$85/night"
  price_per_week  text,                   -- e.g. "$500/wk"

  -- Availability — short-term only
  available_from  date,
  available_to    date,
  max_guests      text,                   -- e.g. "4 guests"
  house_rules     text,
  pets_allowed    boolean     not null    default false,

  -- Physical details (shared across types)
  address         text        not null    default 'Abilene, TX',
  bedrooms        text,                   -- "Studio" | "1BR" | "2BR" | "3BR" | "4BR+" | "N/A"
  bathrooms       text,                   -- "1" | "1.5" | "2" | "2.5" | "3+"

  -- Description and contact
  description     text,
  phone           text,
  email           text,
  external_url    text,                   -- optional link (Airbnb, Zillow, Realtor.com, etc.)

  -- Listing metadata
  duration        text        not null    default '30 Days',
  plan            text        not null    default 'free',
  -- Values: 'approved' | 'rented' | 'sold' | 'expired' | 'hidden'
  status          text        not null    default 'approved',

  -- Photos (array of base64 data URLs, compressed via optimizeGalleryImage)
  image_data      text[]      not null    default '{}'

);

-- ── Row Level Security ───────────────────────────────────────

alter table public.rental_listings enable row level security;

-- ── Grants ──────────────────────────────────────────────────

grant usage  on schema public             to anon, authenticated;
grant select on public.rental_listings    to anon;
grant insert on public.rental_listings    to anon;
grant select, insert, update, delete
              on public.rental_listings    to authenticated;
grant select, insert, update, delete
              on public.rental_listings    to service_role;

-- ── Policies ────────────────────────────────────────────────

-- Public can read approved, non-expired listings
drop policy if exists "Public read rentals" on public.rental_listings;
create policy "Public read rentals"
on public.rental_listings
for select
to anon
using (
  status = 'approved'
  and (expires_at is null or expires_at > now())
);

-- Anyone can post a listing (free plan, goes live immediately)
drop policy if exists "Public insert rentals" on public.rental_listings;
create policy "Public insert rentals"
on public.rental_listings
for insert
to anon
with check (
  plan   = 'free'
  and status = 'approved'
  and length(title)   > 0
  and length(address) > 0
);

-- Authenticated (admin) can do everything
drop policy if exists "Admin manage rentals" on public.rental_listings;
create policy "Admin manage rentals"
on public.rental_listings
for all
to authenticated
using (true)
with check (true);

-- ── Realtime ─────────────────────────────────────────────────
-- Enable realtime for this table in Supabase Dashboard:
-- Database → Replication → Tables → enable rental_listings
-- Or run:
-- alter publication supabase_realtime add table public.rental_listings;
