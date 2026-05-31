create table if not exists public.business_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_name text not null,
  contact_name text not null,
  category text not null,
  plan text not null default 'Free',
  phone text not null,
  contact_email text,
  address text,
  social text,
  description text,
  image_data text,
  content_rights_confirmed boolean not null default false,
  status text not null default 'pending',
  payment_status text not null default 'pending',
  placement_source text not null default 'paid',
  placement_expires_at timestamptz,
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  paid_at timestamptz
);

alter table public.business_submissions enable row level security;

alter table public.business_submissions
add column if not exists image_data text;

alter table public.business_submissions
add column if not exists contact_email text;

alter table public.business_submissions
add column if not exists stripe_session_id text;

alter table public.business_submissions
add column if not exists stripe_payment_intent_id text;

alter table public.business_submissions
add column if not exists stripe_customer_id text;

alter table public.business_submissions
add column if not exists stripe_subscription_id text;

alter table public.business_submissions
add column if not exists paid_at timestamptz;

alter table public.business_submissions
add column if not exists placement_source text not null default 'paid';

alter table public.business_submissions
add column if not exists placement_expires_at timestamptz;

grant usage on schema public to anon, authenticated;
grant insert, select on public.business_submissions to anon;
grant select, update, delete on public.business_submissions to authenticated;
grant select, insert, update, delete on public.business_submissions to service_role;

drop policy if exists "Allow public business submissions" on public.business_submissions;
create policy "Allow public business submissions"
on public.business_submissions
for insert
to public
with check (
  content_rights_confirmed = true
  and status = 'pending'
  and payment_status in ('not_required', 'pending')
  and plan in ('Free', 'Featured', 'Premium')
  and placement_source = 'paid'
);

drop policy if exists "Allow public approved business listings" on public.business_submissions;
create policy "Allow public approved business listings"
on public.business_submissions
for select
to anon
using (status = 'approved');

drop policy if exists "Allow authenticated business moderation" on public.business_submissions;
create policy "Allow authenticated business moderation"
on public.business_submissions
for all
to authenticated
using (true)
with check (true);

create table if not exists public.gallery_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contributor_name text not null,
  title text not null,
  image_data text not null,
  content_rights_confirmed boolean not null default false,
  status text not null default 'pending'
);

alter table public.gallery_submissions enable row level security;

grant insert, select on public.gallery_submissions to anon;
grant select, update, delete on public.gallery_submissions to authenticated;

drop policy if exists "Allow public gallery submissions" on public.gallery_submissions;
create policy "Allow public gallery submissions"
on public.gallery_submissions
for insert
to public
with check (
  content_rights_confirmed = true
  and status = 'pending'
);

drop policy if exists "Allow public approved gallery photos" on public.gallery_submissions;
create policy "Allow public approved gallery photos"
on public.gallery_submissions
for select
to anon
using (status = 'approved');

drop policy if exists "Allow authenticated gallery moderation" on public.gallery_submissions;
create policy "Allow authenticated gallery moderation"
on public.gallery_submissions
for all
to authenticated
using (true)
with check (true);

create table if not exists public.hidden_static_items (
  item_key text primary key,
  created_at timestamptz not null default now(),
  item_type text not null,
  title text not null
);

alter table public.hidden_static_items enable row level security;

grant select on public.hidden_static_items to anon;
grant select, insert, update, delete on public.hidden_static_items to authenticated;

drop policy if exists "Allow public hidden static reads" on public.hidden_static_items;
create policy "Allow public hidden static reads"
on public.hidden_static_items
for select
to anon
using (true);

drop policy if exists "Allow authenticated hidden static management" on public.hidden_static_items;
create policy "Allow authenticated hidden static management"
on public.hidden_static_items
for all
to authenticated
using (true)
with check (true);

create table if not exists public.public_likes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_type text not null,
  item_key text not null,
  visitor_key text not null,
  unique (item_type, item_key, visitor_key)
);

alter table public.public_likes enable row level security;

grant select, insert on public.public_likes to anon;
grant select, insert, delete on public.public_likes to authenticated;

drop policy if exists "Allow public like reads" on public.public_likes;
create policy "Allow public like reads"
on public.public_likes
for select
to anon
using (true);

drop policy if exists "Allow public likes" on public.public_likes;
create policy "Allow public likes"
on public.public_likes
for insert
to anon
with check (
  item_type in ('business', 'photo')
  and length(item_key) > 0
  and length(visitor_key) > 0
);

drop policy if exists "Allow authenticated like management" on public.public_likes;
create policy "Allow authenticated like management"
on public.public_likes
for all
to authenticated
using (true)
with check (true);

create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_id text not null,
  business_name text not null,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  status text not null default 'pending'
);

alter table public.business_reviews enable row level security;

grant insert, select on public.business_reviews to anon;
grant select, update, delete on public.business_reviews to authenticated;

drop policy if exists "Allow public review submissions" on public.business_reviews;
create policy "Allow public review submissions"
on public.business_reviews
for insert
to public
with check (
  status = 'pending'
  and rating between 1 and 5
  and length(business_id) > 0
  and length(business_name) > 0
  and length(reviewer_name) > 0
  and length(comment) > 0
);

drop policy if exists "Allow public approved review reads" on public.business_reviews;
create policy "Allow public approved review reads"
on public.business_reviews
for select
to anon
using (status = 'approved');

drop policy if exists "Allow authenticated review moderation" on public.business_reviews;
create policy "Allow authenticated review moderation"
on public.business_reviews
for all
to authenticated
using (true)
with check (true);

create table if not exists public.business_interactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_id text not null,
  business_name text not null,
  action_type text not null
);

alter table public.business_interactions enable row level security;

grant insert on public.business_interactions to anon;
grant select, insert, delete on public.business_interactions to authenticated;

drop policy if exists "Allow public business interaction tracking" on public.business_interactions;
create policy "Allow public business interaction tracking"
on public.business_interactions
for insert
to anon
with check (
  action_type in ('calls', 'directions', 'visits')
  and length(business_id) > 0
  and length(business_name) > 0
);

drop policy if exists "Allow authenticated business interaction reads" on public.business_interactions;
create policy "Allow authenticated business interaction reads"
on public.business_interactions
for all
to authenticated
using (true)
with check (true);

create table if not exists public.public_item_interactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_type text not null,
  item_key text not null,
  item_name text not null,
  action_type text not null default 'click'
);

alter table public.public_item_interactions enable row level security;

grant insert on public.public_item_interactions to anon;
grant select, insert, delete on public.public_item_interactions to authenticated;

drop policy if exists "Allow public item interaction tracking" on public.public_item_interactions;
create policy "Allow public item interaction tracking"
on public.public_item_interactions
for insert
to anon
with check (
  action_type = 'click'
  and item_type in ('service', 'event', 'business', 'photo', 'section')
  and length(item_key) > 0
  and length(item_name) > 0
);

drop policy if exists "Allow authenticated item interaction reads" on public.public_item_interactions;
create policy "Allow authenticated item interaction reads"
on public.public_item_interactions
for all
to authenticated
using (true)
with check (true);

create table if not exists public.local_news_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  published_at timestamptz not null,
  title text not null,
  summary text not null,
  image_url text,
  source_name text not null,
  source_url text not null,
  original_url text not null unique,
  story_fingerprint text not null default '',
  news_category text not null default 'Local Buzz',
  mood_label text not null default 'Fresh',
  verification_status text not null default 'verified',
  status text not null default 'approved'
);

alter table public.local_news_items
add column if not exists news_category text not null default 'Local Buzz';

alter table public.local_news_items
add column if not exists mood_label text not null default 'Fresh';

alter table public.local_news_items
add column if not exists image_url text;

alter table public.local_news_items
add column if not exists story_fingerprint text not null default '';

update public.local_news_items
set story_fingerprint = left(regexp_replace(regexp_replace(lower(title), '&[#a-z0-9]+;', ' ', 'g'), '[^a-z0-9]+', ' ', 'g'), 140)
where story_fingerprint = '';

drop index if exists public.local_news_items_story_fingerprint_key;

create unique index if not exists local_news_items_story_fingerprint_key
on public.local_news_items (story_fingerprint);

alter table public.local_news_items enable row level security;

grant select on public.local_news_items to anon;
grant select, insert, update, delete on public.local_news_items to authenticated;
grant select, insert, update, delete on public.local_news_items to service_role;

drop policy if exists "Allow public approved local news reads" on public.local_news_items;
create policy "Allow public approved local news reads"
on public.local_news_items
for select
to anon
using (
  status = 'approved'
  and published_at >= now() - interval '7 days'
);

drop policy if exists "Allow authenticated local news management" on public.local_news_items;
create policy "Allow authenticated local news management"
on public.local_news_items
for all
to authenticated
using (true)
with check (
  verification_status in ('verified', 'needs_review')
  and status in ('approved', 'draft', 'rejected')
  and news_category in ('Fires', 'Arrests', 'New Spots', 'Sports', 'Campus', 'Flying Bison', 'Local Buzz')
  and length(title) > 0
  and length(summary) > 0
  and length(original_url) > 0
);

create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  place text not null,
  event_date date not null,
  event_time text not null,
  event_type text not null,
  image_url text,
  image_data text,
  status text not null default 'approved'
);

alter table public.event_submissions enable row level security;

grant select on public.event_submissions to anon;
grant select, insert, update, delete on public.event_submissions to authenticated;

drop policy if exists "Allow public approved event reads" on public.event_submissions;
create policy "Allow public approved event reads"
on public.event_submissions
for select
to anon
using (status = 'approved');

drop policy if exists "Allow authenticated event management" on public.event_submissions;
create policy "Allow authenticated event management"
on public.event_submissions
for all
to authenticated
using (true)
with check (true);
