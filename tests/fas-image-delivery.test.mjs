import test from 'node:test';
import assert from 'node:assert/strict';
import { makeImageHandler } from '../supabase/functions/fas-story-image/handler.mjs';
const id='11111111-1111-1111-1111-111111111111';
const path=`${id}/${id}/222.png`;
const config={base:'https://project.invalid',anonKey:'fixture-anon',serviceKey:'fixture-service'};
const query=new Request(`https://image.invalid/?asset_id=${id}`,{headers:{Authorization:'Bearer fixture-user'}});
test('invisible/invalid caller never reaches privileged Storage fetch',async()=>{
  let calls=0;
  const handler=makeImageHandler(config,async(url,options)=>{
    calls++; assert.ok(url.includes('/rest/v1/'));
    assert.equal(options.headers.Authorization,'Bearer fixture-user');
    assert.equal(options.headers.apikey,'fixture-anon');
    return new Response('[]');
  });
  const response=await handler(query);
  assert.equal(response.status,404); assert.equal(calls,1);
  assert.match(response.headers.get('cache-control'),/no-store/);
});
test('archival during upstream fetch prevents bytes being released',async()=>{
  let checks=0;
  const handler=makeImageHandler(config,async(url)=>{
    if(url.includes('/rest/v1/'))return new Response(JSON.stringify(++checks===1?[{object_path:path}]:[]));
    return new Response('secret image',{headers:{'Content-Type':'image/png'}});
  });
  const response=await handler(query); assert.equal(response.status,404);
  assert.ok(!(await response.text()).includes('secret image'));
});
test('permitted bytes have no-store headers and no upstream URL/token',async()=>{
  const handler=makeImageHandler(config,async(url)=>url.includes('/rest/v1/')
    ?new Response(JSON.stringify([{object_path:path}]))
    :new Response('image bytes',{headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=3600'}}));
  const response=await handler(query); assert.equal(response.status,200);
  for(const name of ['cache-control','cdn-cache-control','cloudflare-cdn-cache-control'])assert.match(response.headers.get(name),/no-store/);
  assert.equal(response.headers.get('location'),null);
  assert.equal(await response.text(),'image bytes');
});
test('caller cannot supply a Storage path, URL or arbitrary method',async()=>{
  const handler=makeImageHandler(config,()=>{throw new Error('must not fetch');});
  assert.equal((await handler(new Request('https://image.invalid/?asset_id=https://evil.invalid'))).status,400);
  assert.equal((await handler(new Request(`https://image.invalid/?asset_id=${id}`,{method:'POST'}))).status,405);
});

test('responsive images validate widths and recheck permission after transformation',async()=>{
 let checks=0,transforms=0;
 const handler=makeImageHandler({...config,transform:async(bytes,width)=>{transforms++;assert.equal(width,480);assert.equal(new TextDecoder().decode(bytes),'source');return new TextEncoder().encode('small image');}},async url=>url.includes('/rest/v1/')?Response.json(++checks===1?[{object_path:path}]:[]):new Response('source',{headers:{'Content-Type':'image/png'}}));
 const invalid=await handler(new Request(`https://image.invalid/?asset_id=${id}&width=9999`));assert.equal(invalid.status,400);assert.equal(checks,0);
 const response=await handler(new Request(`https://image.invalid/?asset_id=${id}&width=480`));assert.equal(response.status,404);assert.equal(transforms,1);assert.ok(!(await response.text()).includes('small image'));
});

// The emergency delivery path must support existing responsive URLs without a codec.
test('master delivery preserves exact bytes for concurrent responsive URLs',async()=>{
 const bytes=new Uint8Array([255,216,255,224,1,2,3,255,217]);let checks=0;
 const handler=makeImageHandler(config,async url=>url.includes('/rest/v1/')?(checks++,Response.json([{object_path:path}])):new Response(bytes,{headers:{'Content-Type':'image/jpeg'}}));
 const responses=await Promise.all([480,800,1200,1600,2400,3200].map(width=>handler(new Request(`https://image.invalid/?asset_id=${id}&width=${width}`))));
 for(const response of responses){assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);assert.match(response.headers.get('Cache-Control'),/no-store/);}
 assert.equal(checks,12);
});

test('stored derivatives require current asset visibility and safely fall back to the unchanged master',async()=>{
 for(const available of [true,false])for(const missing of [true,false]){
  let checks=0;const gets=[];const assetPath=path.replace('.png','.jpg');
  const handler=makeImageHandler(config,async url=>{if(url.includes('/rest/v1/')){checks++;return Response.json([{object_path:assetPath,derivative_widths:available?[480]:[]}]);}gets.push(url);return url.endsWith('-480.jpg')?new Response('small',{status:missing?404:200,headers:{'Content-Type':'image/jpeg'}}):new Response('master',{headers:{'Content-Type':'image/jpeg'}});});
  const response=await handler(new Request(`https://image.invalid/?asset_id=${id}&width=480`));assert.equal(response.status,200);assert.equal(await response.text(),available&&!missing?'small':'master');assert.equal(checks,2);assert.equal(gets.length,available&&missing?2:1);assert.equal(response.headers.get('X-FAS-Image-Variant'),available&&!missing?'480':'master');
 }
 let checks=0;const handler=makeImageHandler(config,async url=>url.includes('/rest/v1/')?Response.json(++checks===1?[{object_path:path.replace('.png','.jpg'),derivative_widths:[480]}]:[]):new Response('small',{headers:{'Content-Type':'image/jpeg'}}));assert.equal((await handler(new Request(`https://image.invalid/?asset_id=${id}&width=480`))).status,404);
});
