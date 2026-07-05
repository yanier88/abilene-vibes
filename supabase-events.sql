alter table public.event_submissions
  add column if not exists end_date date,
  add column if not exists end_time text,
  add column if not exists ticket_url text;
