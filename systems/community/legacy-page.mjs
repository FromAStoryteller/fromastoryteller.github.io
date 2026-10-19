import {loadAccountAuthConfig} from '../../account/auth-settings.mjs';
import {mountPlayer,validatePackage} from './interactive-package.mjs';

const types={'brick-blitz':'game','rally-clash':'game','countdown':'tool','genre-randomizer':'tool'};

const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Player dependency could not load.'));document.head.append(s);});
export async function mountLegacyPage(slug,loadOriginal){
 const type=types[slug];
 if(!type)return;const host=document.querySelector('.'+type+'-shell-main');if(!host)return;
 let envelope;try{const config=await loadAccountAuthConfig(location.origin);if(config){const r=await fetch(config.url+'/rest/v1/rpc/fas_public_file_player',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({file_slug:slug})});if(!r.ok)throw Error('Player service unavailable');envelope=await r.json();}}catch(error){console.warn('Using the bundled player because updated files could not be checked.',error);}
 if(envelope?.package){const p=validatePackage(envelope.package);mountPlayer(host,p,{title:document.title});return;}
 if(type==='game'){await loadScript('/assets/vendor/p5-1.9.0.min.js');await loadScript('/assets/vendor/p5.sound-1.9.0.min.js');await loadOriginal();new window.p5();}else await loadOriginal();
}
