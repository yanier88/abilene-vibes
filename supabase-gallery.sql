alter table public.gallery_submissions
add column if not exists owner_user_id text;

drop function if exists public.owner_delete_gallery_photo(uuid, text);

create or replace function public.owner_delete_gallery_photo(
  photo_id uuid,
  owner_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.gallery_submissions
  where id = photo_id
    and owner_user_id = owner_id
    and owner_id is not null
    and length(owner_id) > 0;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

grant execute on function public.owner_delete_gallery_photo(uuid, text) to anon, authenticated;
