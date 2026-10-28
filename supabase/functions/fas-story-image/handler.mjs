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
export function makeImageHandler({ base, anonKey, serviceKey, kind='cover',transform }, fetcher = fetch) {
  const reply = (status, message) => new Response(message, { status, headers });
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return reply(405, 'GET required');
    const params=new URL(request.url).searchParams;
    const width=params.has('width')?Number(params.get('width')):null;
    if(width!==null&&(![480,800,1200,1600,2400,3200].includes(width)||kind!=='cover'))return reply(400,'Unsupported image width');
    const id = params.get('asset_id') ?? '';
    if (!uuid.test(id)) return reply(400, 'Valid asset ID required');
    if (!base || !anonKey || !serviceKey) return reply(503, 'Image service unavailable');
    // PostgREST verifies caller JWTs and enforces story_assets RLS. Anonymous
    // readers use the anon role. Editable metadata and caller paths are ignored.
    const authorization = request.headers.get('Authorization') || `Bearer ${anonKey}`;
    let availableWidths=[];
    const visibleAsset = async () => {
      const response = await fetcher(kind==='profile'?`${base}/rest/v1/rpc/fas_visible_profile_image?asset_key=${id}`:`${base}/rest/v1/story_assets?id=eq.${id}&select=object_path,derivative_widths`, {
        headers: { apikey: anonKey, Authorization: authorization },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return null;
      const rows = await response.json();
      if(kind==='profile'){
        if(rows!==true)return null;
        const resolved=await fetcher(`${base}/rest/v1/rpc/fas_profile_image_path?asset_key=${id}`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
        if(!resolved.ok)return null;const path=await resolved.json();return typeof path==='string'&&imagePath.test(path)?path:null;
      }
      availableWidths=rows.length===1&&Array.isArray(rows[0].derivative_widths)?rows[0].derivative_widths:[];
      return rows.length === 1 && imagePath.test(rows[0].object_path) ? rows[0].object_path : null;
    };
    try {
      const path = await visibleAsset();
      if (!path) return reply(404, 'Image unavailable');
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      // Privileged fetch occurs only after caller-scoped RLS grants visibility.
      // It never returns a Storage URL or signed token to the caller.
      let variant='master';
      const getObject=async objectPath=>fetcher(`${base}/storage/v1/object/authenticated/fas-story-images/${objectPath}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      let upstream;
      if(kind==='cover'&&width!==null&&availableWidths.includes(width)&&[480,800,1200,1600,2400].includes(width)&&encoded.endsWith('.jpg')){
        upstream=await getObject(encoded.replace(/\.jpg$/,'-'+width+'.jpg')).catch(()=>null);
        if(upstream?.ok)variant=String(width);
      }
      if(!upstream?.ok)upstream=await getObject(encoded);
      if (!upstream.ok) return reply(404, 'Image unavailable');
      const type = (upstream.headers.get('Content-Type') ?? '').split(';')[0];
      if (!['image/png','image/jpeg','image/webp'].includes(type)) return reply(502, 'Unsupported image');
      if (Number(upstream.headers.get('Content-Length')) > 5242880) return reply(502, 'Image too large');
      const bytes = await upstream.arrayBuffer();
      if (bytes.byteLength > 5242880) return reply(502, 'Image too large');
      let result=bytes,outputType=type;
      if(width!==null&&transform){result=await transform(new Uint8Array(bytes),width);outputType='image/jpeg';}
      // Recheck after resizing and buffering: a moderation/approval change during the Storage
      // fetch must not send bytes to a caller who just lost permission.
      if (await visibleAsset() !== path) return reply(404, 'Image unavailable');
      return new Response(result, { status: 200, headers: { ...headers, 'Content-Type': outputType,'X-FAS-Image-Variant':variant } });
    } catch { return reply(503, 'Image service unavailable'); }
  };
}
