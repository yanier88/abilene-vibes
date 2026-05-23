create table if not exists public.business_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_name text not null,
  contact_name text not null,
  category text not null,
  plan text not null default 'Free',
  phone text not null,
  address text,
  social text,
  description text,
  content_rights_confirmed boolean not null default false,
  status text not null default 'pending',
  payment_status text not null default 'pending'
);

alter table public.business_submissions enable row level security;

drop policy if exists "Allow public business submissions" on public.business_submissions;
create policy "Allow public business submissions"
on public.business_submissions
for insert
to anon
with check (
  content_rights_confirmed = true
  and status = 'pending'
  and payment_status in ('not_required', 'pending')
);
