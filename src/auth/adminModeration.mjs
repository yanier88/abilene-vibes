// Only the authorized loader updates visible rows; failed writes keep the queue.
export async function moderateAndReload(mutate, reload) {
  const result = await mutate();
  if (result?.error) throw new Error('Could not save moderation.');
  await reload();
}
