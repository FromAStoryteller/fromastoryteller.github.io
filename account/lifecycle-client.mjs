async function accessToken(local) {
  const renewed = await local.client.auth.refreshSession();
  if (renewed.error || !renewed.data?.session) throw new Error('Your session has ended. Please sign in again.');
  return renewed.data.session.access_token;
}
async function perform(local, body, token) {
  return fetch('http://127.0.0.1:55321/functions/v1/fas-account-lifecycle', {
    method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { apikey: local.client.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
async function responseError(response) {
  const result = await response.json().catch(() => ({}));
  throw new Error(typeof result.message === 'string' ? result.message : 'The account service is unavailable. Please try again.');
}
export async function downloadOwnedContent(local) {
  if (!local.lifecycleEnabled) throw new Error('Content export is not enabled here.');
  const response = await perform(local, { action: 'export' }, await accessToken(local));
  if (!response.ok) return responseError(response);
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) throw new Error('The export was not completed. Please try again.');
  return response.blob();
}
export async function prepareDeletion(local, password) {
  if (!local.lifecycleEnabled) throw new Error('Account deletion is not enabled here.');
  const response = await perform(local, { action: 'prepare-delete', password }, await accessToken(local));
  if (!response.ok) return responseError(response);
  return response.json();
}
export async function confirmDeletion(local, prepared) {
  if (!local.lifecycleEnabled) throw new Error('Account deletion is not enabled here.');
  let token;
  let failure;
  try {
    token = await accessToken(local);
    const response = await perform(local, { action: 'confirm-delete', confirmation: 'DELETE', exportAcknowledged: true, confirmationToken: prepared.confirmationToken }, token);
    if (response.ok && (await response.json()).state === 'deleted') return;
    if (!response.ok) await responseError(response);
    throw new Error('We couldn’t confirm deletion. Please check its status.');
  } catch (error) { failure = error; }
  // The identity may already be removed even when the final response was lost.
  try {
    const receipt = await perform(local, { action: 'deletion-status', userId: prepared.userId, confirmationToken: prepared.confirmationToken }, local.client.supabaseKey);
    if (receipt.ok) {
      const { state } = await receipt.json();
      if (state === 'complete') return;
      if (state === 'pending') prepared.started = true;
    }
  } catch { /* Keep the original error; never claim uncertain deletion succeeded. */ }
  throw failure;
}
