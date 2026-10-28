import assert from 'node:assert/strict';
const origin='https://fromastoryteller.com';
export async function verifyCacheRelease(){
 const get=path=>fetch(origin+path,{cache:'no-store',signal:AbortSignal.timeout(20000)});
 const releaseResponse=await get('/content/build-release.json');assert.equal(releaseResponse.status,200);const {release}=await releaseResponse.json();assert.match(release,/^[0-9a-f]{24}$/);assert.match(releaseResponse.headers.get('cache-control'),/no-store/);
 const home=await get('/');assert.equal(home.status,200);const html=await home.text();assert.ok(html.includes('/_assets/'+release+'/systems/core/site-shell.js'));
 for(const path of ['css/foundations.css','systems/content/content-system.js','content/catalogue.json']){
  const r=await get('/_assets/'+release+'/'+path);assert.equal(r.status,200,path);assert.match(r.headers.get('cache-control'),/max-age=31536000/);assert.match(r.headers.get('cache-control'),/immutable/);await r.body?.cancel();
 }
 for(const path of ['/api/public/stories','/api/public/files','/stories/tea-at-the-summit/']){
  const states=[];for(let i=0;i<2;i++){const r=await get(path);assert.equal(r.status,200,path);assert.match(r.headers.get('cache-control'),/no-store/);const state=r.headers.get('x-fas-public-cache');assert.match(state,/^(HIT|MISS)$/);states.push(state);await r.arrayBuffer();}
  console.log('PASS live public cache '+path+': '+states.join(' → '));
 }
 const invalid=await get('/api/public/stories?after_id=invalid');assert.equal(invalid.status,400);
 console.log('PASS live versioned immutable assets, public catalogue and story cache, fresh browser responses; release '+release);
}
if(process.argv.slice(2).join(' ')==='--production-read-only')await verifyCacheRelease();
