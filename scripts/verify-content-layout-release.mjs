// Fixed-origin, read-only release verification. No credentials or fixture writes.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
if(process.argv.slice(2).join(' ')!=='--production-read-only')throw Error('Explicit read-only mode required');
const paths=['systems/community/storyteller-follow.mjs','systems/community/following-page.mjs','systems/community/audience-report.mjs','systems/community/studio-service.mjs','systems/community/account-navigation.mjs','account/following/index.html','account/return-path.mjs','account/navigation-shell.mjs','account/settings-controller.mjs','account/account-data-download.mjs','systems/community/profile-share.mjs','systems/community/manuscript.mjs','systems/community/profile-directory.mjs','systems/community/public-storyteller-page.mjs','systems/community/profile-page.mjs','systems/core/profile-sidebar.mjs','systems/core/header-account.mjs','systems/search/header-search.js','search/search.js','css/components.css','systems/content/page-layout.mjs','systems/community/public-profile.mjs','systems/community/studio-editor.mjs','stories/stories.css','css/manuscript.css','css/studio.css','games/rally-clash/game.js','games/brick-blitz/game.js'];
paths.push('systems/content/featured-selection.mjs','systems/content/story-discovery.mjs','systems/content/content-system.js','systems/community/story-author-panel.mjs','systems/community/viewer-actions.mjs','systems/community/public-story-catalog.mjs','systems/core/navigation-labels.mjs','systems/core/site-shell.js');
paths.push('systems/content/content-discovery.mjs','systems/community/home-following.mjs','systems/community/following-service.mjs','systems/community/viewer-history.mjs','account/history/index.html','account/compact-navigation.mjs');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const path of paths){
 const expected=digest(await readFile(new URL('../'+path,import.meta.url)));let matched=false;
 for(let attempt=0;attempt<18;attempt++){
  try{const r=await fetch('https://fromastoryteller.com/'+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.ok&&digest(Buffer.from(await r.arrayBuffer()))===expected){matched=true;break;}}catch{}
  if(attempt<17)await new Promise(resolve=>setTimeout(resolve,10000));
 }
 assert.ok(matched,'Deployment source mismatch: '+path);
}
await import('./test-fas-operational-readiness.mjs');
for(const [path,type] of [['/stories/the-deal/','story'],['/games/rally-clash/','game'],['/tools/countdown/','tool']]){
 const r=await fetch('https://fromastoryteller.com'+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);assert.ok((await r.text()).includes('data-content-layout="'+type+'"'));
}
const configResponse=await fetch('https://fromastoryteller.com/account/runtime-config.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(configResponse.status,200);const config=await configResponse.json();assert.equal(config.url,'https://vzdicnufhidelaoeqbza.supabase.co');
const publicRpc=async(name,args)=>{const response=await fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);return response.json();};
const directory=await publicRpc('fas_public_profile_catalog',{query_text:'',after_name:null,after_id:null});assert.ok(Array.isArray(directory.items)&&directory.items.length<=24);for(const person of directory.items){assert.match(person.public_id,/^[a-f0-9-]{36}$/i);assert.ok(!['id','owner_id','email','stories'].some(key=>key in person));}
if(directory.items.length){const person=directory.items[0],profile=await publicRpc('fas_public_profile',{profile_key:person.public_id,page_offset:0});assert.equal(profile.public_id,person.public_id);assert.equal(profile.display_name,person.display_name);assert.ok(Array.isArray(profile.stories));}
console.log('PASS deployed public storyteller discovery and profile lookup');
console.log('PASS exact production layout/manuscript sources, both independent game bundles and shared story/game/tool templates');

for(const name of ['fas_my_storyteller_follow','fas_set_storyteller_follow','fas_my_following','fas_my_follower_count','fas_my_following_data']){const args=name==='fas_my_storyteller_follow'?{target_key:directory.items[0]?.public_id??'00000000-0000-4000-8000-000000000000'}:name==='fas_set_storyteller_follow'?{target_key:'00000000-0000-4000-8000-000000000000',enabled:false}:{};const response=await fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});assert.ok([401,403].includes(response.status),'Anonymous follow endpoint must be denied: '+name);}
console.log('PASS deployed following sources and anonymous private list/count/write denials');
