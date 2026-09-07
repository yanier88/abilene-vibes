// A session proves authentication, never authorization to moderate.
export async function verifiedAdminSession(client, session) {
  if (!client || !session) return null;
  const { data, error } = await client.rpc('is_service_admin');
  return !error && data === true ? session : null;
}
