// Only post-authorization data reads belong here. Never use for identity/role checks.
export async function settleAdminReads(reads) {
  const results = await Promise.allSettled(reads);
  return results.map(result => result.status === 'fulfilled' && result.value && !result.value.error
    ? { data: result.value.data ?? [], error: false }
    : { data: [], error: true });
}
