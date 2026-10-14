const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'Surrogate-Control': 'no-store',
  'Vary': 'Authorization, Origin',
  'X-Content-Type-Options': 'nosniff',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imagePath = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/;
export function makeImageHandler({ base, anonKey, serviceKey }, fetcher = fetch) {
  const reply = (status, message) => new Response(message, { status, headers });
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return reply(405, 'GET required');
    const id = new URL(request.url).searchParams.get('asset_id') ?? '';
    if (!uuid.test(id)) return reply(400, 'Valid asset ID required');
    if (!base || !anonKey || !serviceKey) return reply(503, 'Image service unavailable');
    // PostgREST verifies caller JWTs and enforces story_assets RLS. Anonymous
    // readers use the anon role. Editable metadata and caller paths are ignored.
    const authorization = request.headers.get('Authorization') || `Bearer ${anonKey}`;
    const visibleAsset = async () => {
      const response = await fetcher(`${base}/rest/v1/story_assets?id=eq.${id}&select=object_path`, {
        headers: { apikey: anonKey, Authorization: authorization },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return null;
      const rows = await response.json();
      return rows.length === 1 && imagePath.test(rows[0].object_path) ? rows[0].object_path : null;
    };
    try {
      const path = await visibleAsset();
      if (!path) return reply(404, 'Image unavailable');
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      // Privileged fetch occurs only after caller-scoped RLS grants visibility.
      // It never returns a Storage URL or signed token to the caller.
      const upstream = await fetcher(`${base}/storage/v1/object/authenticated/fas-story-images/${encoded}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      if (!upstream.ok) return reply(404, 'Image unavailable');
      const type = (upstream.headers.get('Content-Type') ?? '').split(';')[0];
      if (!['image/png','image/jpeg','image/webp'].includes(type)) return reply(502, 'Unsupported image');
      if (Number(upstream.headers.get('Content-Length')) > 5242880) return reply(502, 'Image too large');
      const bytes = await upstream.arrayBuffer();
      if (bytes.byteLength > 5242880) return reply(502, 'Image too large');
      // Recheck after buffering: a moderation/approval change during the Storage
      // fetch must not send bytes to a caller who just lost permission.
      if (await visibleAsset() !== path) return reply(404, 'Image unavailable');
      return new Response(bytes, { status: 200, headers: { ...headers, 'Content-Type': type } });
    } catch { return reply(503, 'Image service unavailable'); }
  };
}
