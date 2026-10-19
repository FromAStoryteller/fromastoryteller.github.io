import { zipFiles } from './archive.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imagePath = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/;
const encoder = new TextEncoder();
class AccountError extends Error { constructor(message, status = 503) { super(message); this.status = status; } }
async function boundedBody(request) {
  const reader = request.body?.getReader(); if (!reader) throw new AccountError('JSON required.', 400);
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4096) { await reader.cancel(); throw new AccountError('Request too large.', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AccountError('Valid JSON required.', 400); }
}
const sha = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))].map(x => x.toString(16).padStart(2, '0')).join('');
function claims(token) { try { return JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/'))); } catch { return null; } }
export function makeLifecycleHandler({ base, anonKey, serviceKey, enabled = false, origin = 'http://127.0.0.1:55400' }, fetcher = fetch) {
  const common = { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Authorization, Origin', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...common, 'Content-Type': 'application/json' } });
  return async request => {
    if (!enabled || !base || !anonKey || !serviceKey) return json(404, { message: 'Account lifecycle is unavailable.' });
    if (request.headers.get('Origin') && request.headers.get('Origin') !== origin) return json(403, { message: 'Origin not allowed.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: common });
    if (request.method !== 'POST') return json(405, { message: 'POST required.' });
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, { message: 'JSON required.' });
    const token = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    if (!token) return json(401, { message: 'Sign in again to continue.' });
    const call = (path, method = 'GET', body, privileged = true) => fetcher(base + path, { method, headers: { apikey: privileged ? serviceKey : anonKey, Authorization: `Bearer ${privileged ? serviceKey : token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const rpc = async (name, body) => {
      const response = await call('/rest/v1/rpc/' + name, 'POST', body);
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        const known = { 'Account content requires background export': [413, 'Your content is too large for this download. Contact support for a complete export. Nothing was deleted.'], 'Active account session required': [401, 'Your session has ended. Please sign in again.'], 'Staff accounts require a separate reviewed process': [403, 'Staff accounts require a separate reviewed deletion process.'], 'Prior staff approvals require review': [409, 'This account has prior staff approvals that need review before deletion.'], 'Fresh deletion confirmation required': [409, 'Your deletion confirmation expired. Confirm your password again.'], 'Account is closing': [409, 'Account removal has started. Finish deletion or contact support.'] }[detail.message];
        if (known) throw new AccountError(known[1], known[0]);
        throw new AccountError('Account service request failed. Please try again.');
      }
      const result = await response.text();
      return result ? JSON.parse(result) : null;
    };
    try {
      const body = await boundedBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { message: 'JSON object required.' });
      if (body.action === 'deletion-status') {
        if (!uuid.test(body.userId ?? '') || !/^[a-f0-9]{64}$/.test(body.confirmationToken ?? '')) return json(400, { message: 'A deletion receipt is required.' });
        const state = await rpc('fas_account_deletion_status', { target_user: body.userId, confirmation_hash: await sha(body.confirmationToken) });
        return json(200, { state });
      }
      // Only use JWT fields after Auth has verified the bearer token. Never trust metadata.
      const identity = await call('/auth/v1/user', 'GET', undefined, false);
      if (!identity.ok) return json(401, { message: 'Sign in again to continue.' });
      const user = await identity.json(); const session = claims(token)?.session_id;
      if (!uuid.test(user.id ?? '') || !uuid.test(session ?? '') || !user.email || user.is_anonymous || !user.email_confirmed_at) return json(401, { message: 'A verified account is required.' });
      const args = { target_user: user.id, target_session: session };
      if (['export','prepare-delete'].includes(body.action) && !await rpc('fas_claim_account_action', { ...args, requested_action: body.action })) return json(429, { message: 'Too many account requests. Wait a few minutes, then try again.' });
      if (body.action === 'export') {
        const first = await rpc('fas_account_snapshot', args); const data = first.data;
        if (!(data.file_players??[]).length && !(data.game_saves??[]).length && !(data.game_participation??[]).length && !data.stories.length && !data.assets.length && !data.objects.length && !['member', 'admin'].includes(data.role)) return json(403, { message: 'There is no owned Community content to download. You can download your personal account data in settings.' });
        if (data.objects.length > 500 || data.stories.length > 300) return json(413, { message: 'Your content is too large for this download. Contact support for a complete export. Nothing was deleted.' });
        let total = 0;
        const files = [];
        const addJson = (name, value) => { const bytes = encoder.encode(JSON.stringify(value, null, 2) + '\n'); total += bytes.length; if (total > 32 * 1024 * 1024) throw new AccountError('Your content is too large for this download. Contact support for a complete export. Nothing was deleted.', 413); files.push({ name, bytes }); };
        const addText = (name, text) => { const bytes = encoder.encode(text); total += bytes.length; if (total > 32 * 1024 * 1024) throw new AccountError('Your content is too large for this download. Contact support for a complete export. Nothing was deleted.', 413); files.push({ name, bytes }); };
        addText('README.txt', 'From A Storyteller — your contributor content\n\nOpen the .txt files in stories to read your stories. Original image files are in images.\nThe metadata folder contains JSON files for software, with story IDs, image associations and account details.\nStory text is preserved as entered; any formatting markup remains visible.\nOnly your owned Community content is included. Unlinked static content, other players’ private data and room codes are excluded. Private saves and your room state are in metadata/game-saves.json and metadata/game-participation.json.\nEdits to owned existing game/tool players are in metadata/file-players.json. Download the working ZIP from Studio to edit and re-upload them.\nKeep this archive private and check it opens before deleting anything.\n');
        addJson('metadata/account.json', { id: user.id, email: user.email, created_at: user.created_at, profile: data.profile, role: data.role });
        for (const story of data.stories) {
          const name = /^[a-z0-9-]+$/.test(story.slug ?? '') ? story.slug + '-' + story.id : story.id;
          addText(`stories/${name}.txt`, `${story.title}\n\nStatus: ${story.status}\nStory ID: ${story.id}\n\n${story.summary || ''}\n\n${story.body || ''}\n`);
          addJson(`metadata/stories/${story.id}.json`, story);
        }
        addJson('metadata/file-players.json',data.file_players??[]);
        addJson('metadata/game-saves.json',data.game_saves??[]);
        addJson('metadata/game-participation.json',data.game_participation??[]);
        addJson('metadata/story-images.json', data.assets);
        const paths = new Set(data.objects.map(o => o.path));
        if (data.assets.some(a => !paths.has(a.object_path)) || (data.profile?.image_path && !paths.has(data.profile.image_path))) return json(409, { message: 'A stored image is unavailable. The export was not completed; nothing was deleted.' });
        for (const item of data.objects) {
          if (!imagePath.test(item.path) || !item.path.startsWith(user.id + '/')) throw new Error('Invalid owned path');
          const response = await call('/storage/v1/object/authenticated/fas-story-images/' + item.path);
          if (!response.ok) return json(409, { message: 'An original image could not be exported. Nothing was deleted.' });
          if (Number(response.headers.get('Content-Length')) > 5242880) throw new Error('Oversize original');
          const bytes = new Uint8Array(await response.arrayBuffer()); total += bytes.length;
          if (bytes.length > 5242880 || total > 32 * 1024 * 1024) return json(413, { message: 'Your content is too large for this download. Contact support for a complete export. Nothing was deleted.' });
          files.push({ name: 'images/' + item.path, bytes });
        }
        const second = await rpc('fas_account_snapshot', args);
        if (first.fingerprint !== second.fingerprint) return json(409, { message: 'Your content changed while exporting. Please try again.' });
        addJson('metadata/manifest.json', { format: 'fas-owned-content-v3', exported_at: new Date().toISOString(), stories: data.stories.length, images: data.objects.length, scope: 'Account-owned FAS Community content, executable packages, private game saves, your own transient room state, image metadata and stored uploaded crops. Existing static games/stories not linked to this account are not included. Other players’ private data and room codes are excluded.', files: files.map(f => f.name) });
        return new Response(zipFiles(files), { status: 200, headers: { ...common, 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="from-a-storyteller-content.zip"' } });
      }
      if (body.action === 'prepare-delete') {
        if (typeof body.password !== 'string' || !body.password || body.password.length > 1024) return json(400, { message: 'Enter your current password.' });
        const response = await call('/auth/v1/token?grant_type=password', 'POST', { email: user.email, password: body.password }, false);
        body.password = '';
        if (!response.ok) return json(response.status === 429 ? 429 : 403, { message: 'We couldn’t confirm your password. Check it and try again, or wait if you have made several attempts.' });
        const reauthenticated = await response.json();
        if (reauthenticated.user?.id !== user.id) return json(403, { message: 'Account confirmation failed.' });
        // The temporary reauthentication session is never returned or persisted.
        await fetcher(base + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${reauthenticated.access_token}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
        const confirmationToken = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
        const summary = await rpc('fas_prepare_account_deletion', { ...args, confirmation_hash: await sha(confirmationToken) });
        return json(200, { userId: user.id, confirmationToken, summary, expiresIn: 300 });
      }
      if (body.action === 'confirm-delete') {
        if (body.confirmation !== 'DELETE' || body.exportAcknowledged !== true || !/^[a-f0-9]{64}$/.test(body.confirmationToken ?? '')) return json(400, { message: 'Confirm the export choice, type DELETE and confirm the account deletion.' });
        const job = await rpc('fas_begin_account_deletion', { ...args, confirmation_hash: await sha(body.confirmationToken) });
        for (const path of job.object_paths) if (!imagePath.test(path) || !path.startsWith(user.id + '/')) throw new Error('Invalid deletion manifest');
        for (let offset = 0; offset < job.object_paths.length; offset += 100) {
          const removed = await call('/storage/v1/object/fas-story-images', 'DELETE', { prefixes: job.object_paths.slice(offset, offset + 100) });
          if (!removed.ok) return json(503, { message: 'Content removal has started but file cleanup is unfinished. Keep this account available and retry confirmation; do not create new content.' });
          await rpc('fas_ack_account_files', { target_user: user.id, removed_paths: job.object_paths.slice(offset, offset + 100) });
        }
        // GoTrue removes sessions as well as the Auth identity. The closing-account
        // gates block protected writes even while an issued access JWT has time left.
        const removed = await call('/auth/v1/admin/users/' + user.id, 'DELETE');
        if (!removed.ok) return json(503, { message: 'Content removal has started but account cleanup is unfinished. Please retry confirmation or contact support.' });
        await rpc('fas_finish_account_deletion', { target_user: user.id });
        return json(200, { state: 'deleted', message: 'Your account and its owned Community content were deleted. Restricted backups expire within 30 days under the site’s backup process.' });
      }
      return json(400, { message: 'Choose a supported account action.' });
    } catch (error) { return json(error instanceof AccountError ? error.status : 503, { message: error instanceof AccountError ? error.message : 'Account export or deletion could not be completed. Please try again or contact support.' }); }
  };
}
