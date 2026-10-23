import {publishViewerChanges} from './viewer-sync.mjs';
// Optional account history, independent of analytics and completion choices.
export function recordRecentVisit(account,{window:w=window,document:d=document,isEnded=()=>false}={}) {
 let stopped=false,attempted=false;
 const path=w.location.pathname.replace(/index\.html$/,'');
 if(!/^\/(stories|blog|games|tools|videos)\/[a-z0-9][a-z0-9-]{0,119}\/$/.test(path)||!d.querySelector('main .story-header,main .game-hero,main .tool-hero,main .video-hero'))return ()=>{};
 async function record(){
  if(stopped||isEnded()||attempted||d.visibilityState==='hidden')return;
  attempted=true;
  try{
   const settings=await account.client.rpc('fas_my_activity_settings');
   if(stopped||isEnded()||settings.error||settings.data?.enabled!==true||!Number.isInteger(settings.data.version))return;
   const result=await account.client.rpc('fas_record_content_visit',{content_key:path,expected_version:settings.data.version});
   if(!stopped&&!isEnded()&&!result.error&&result.data===true)publishViewerChanges(w);
  }catch{/* History must not interrupt reading or silently retry a cleared visit. */}
 }
 d.addEventListener('visibilitychange',record);void record();
 return ()=>{stopped=true;d.removeEventListener('visibilitychange',record);};
}
