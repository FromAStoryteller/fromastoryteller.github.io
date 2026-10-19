import {legacyTemplates} from './legacy-templates.mjs';
export const legacyTemplateNames=['brick-blitz','rally-clash','countdown','genre-randomizer'];
let library;
export async function loadLegacyLibrary(fetcher=fetch){return library??=(async()=>{const r=await fetcher('/assets/vendor/p5-1.9.0.runtime.txt');if(!r.ok)throw Error('The game compatibility runtime could not load. Try again.');return r.text();})().catch(e=>{library=null;throw e;});}
export function legacyRuntimeCode(template,{embedded=false,library=''}={}){
 if(!template)return '';const html=legacyTemplates[template];if(!html)throw Error('Unsupported player template.');
 const boot='document.getElementById("fas-canvas").hidden=true;document.getElementById("fas-ui").innerHTML='+JSON.stringify(html).replace(/</g,'\\u003c')+';window.fasOptionalStorageAllowed=()=>'+(!embedded)+';window.loadSound=(url)=>{const a=new Audio(url);a.preload="auto";return {isLoaded:()=>true,setVolume:v=>a.volume=Math.max(0,Math.min(1,v)),play:()=>{a.currentTime=0;void a.play().catch(()=>{});},stop:()=>{a.pause();a.currentTime=0;}};};window.userStartAudio=()=>Promise.resolve();';
 return boot+(['brick-blitz','rally-clash'].includes(template)?library:'');
}
