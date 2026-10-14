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
