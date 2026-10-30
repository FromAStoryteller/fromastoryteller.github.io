import {loadAccountAuthConfig} from '../../account/auth-settings.mjs';

const types={'brick-blitz':'game','rally-clash':'game','countdown':'tool','genre-randomizer':'tool'};

// Only warm the bundled game after the public lookup selects it. Replacement
// packages never download the old game libraries. Preloading does not execute.
function warmGame(slug){
 const bundle={'rally-clash':'/games/rally-clash/game.js','brick-blitz':'/games/brick-blitz/game.js'}[slug];
 for(const [rel,href]of [['preload','/assets/vendor/p5-1.9.0.min.js'],['preload','/assets/vendor/p5.sound-1.9.0.min.js'],['modulepreload',bundle]]){
  const link=document.createElement('link');link.rel=rel;link.href=href;if(rel==='preload')link.as='script';link.fetchPriority='low';document.head.append(link);
 }
}
const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Player dependency could not load.'));document.head.append(s);});
export async function mountLegacyPage(slug,loadOriginal){
 const type=types[slug];
 if(!type)return;const host=document.querySelector('.'+type+'-shell-main');if(!host)return;
 let envelope;try{const config=await loadAccountAuthConfig(location.origin);if(config){const r=await fetch(config.url+'/rest/v1/rpc/fas_public_file_player',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({file_slug:slug})});if(!r.ok)throw Error('Player service unavailable');envelope=await r.json();}}catch(error){console.warn('Using the bundled player because updated files could not be checked.',error);}
 if(envelope?.package){const {mountPlayer,validatePackage}=await import('./interactive-package.mjs');const p=validatePackage(envelope.package);mountPlayer(host,p,{title:document.title,type});return;}
 if(type==='game'){warmGame(slug);await loadScript('/assets/vendor/p5-1.9.0.min.js');await loadScript('/assets/vendor/p5.sound-1.9.0.min.js');await loadOriginal();new window.p5();}else await loadOriginal();
}
