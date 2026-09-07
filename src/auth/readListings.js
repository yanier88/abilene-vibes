// During rollout, old schemas may lack the new marker or even legacy owner fields.
export async function readWithIdentity(query, fields) {
  let result = await query(`${fields},advertiser_user_id`);
  const missingColumn = error => ['42703', 'PGRST204'].includes(error?.code);
  if (!missingColumn(result.error)) return result;
  result = await query(fields);
  if (!missingColumn(result.error)) return result;
  return query(fields.split(',').filter(field => field !== 'owner_user_id').join(','));
}
