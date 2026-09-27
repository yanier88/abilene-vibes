export const MARKETPLACE_METADATA = 'id,created_at,expires_at,sold_at,deleted_at,title,price,category,location,contact,description,status,owner_user_id,moderation_status,moderation_reason,moderation_score,moderation_flags,moderation_input_types,moderation_model,moderated_at,reviewed_by_admin,reviewed_at,reviewed_by';
export const MARKETPLACE_PAGE_SIZE = 12;
export function marketplacePage(rows, requested) {
  const pages = Math.max(1, Math.ceil(rows.length / MARKETPLACE_PAGE_SIZE));
  const page = Math.min(Math.max(0, requested), pages - 1);
  return { page, pages, rows: rows.slice(page * MARKETPLACE_PAGE_SIZE, (page + 1) * MARKETPLACE_PAGE_SIZE) };
}
export async function readMarketplaceImages(client, ids) {
  if (ids.length === 0) return { ok: true, images: {} };
  if (ids.length > MARKETPLACE_PAGE_SIZE) return { ok: false, images: {} };
  try {
    const { data, error } = await client.from('marketplace_listings').select('id,image_data').in('id', ids);
    if (error) return { ok: false, images: {} };
    const images = Object.fromEntries((data ?? []).filter(row => ids.includes(row.id)).map(row => [row.id, row.image_data ?? '']));
    return { ok: ids.every(id => Object.hasOwn(images, id)), images };
  } catch { return { ok: false, images: {} }; }
}
