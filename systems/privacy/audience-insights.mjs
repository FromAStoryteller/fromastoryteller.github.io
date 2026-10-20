import {readChoice} from './storage-choice.mjs';
export function trafficSource(referrer,origin){
 try{const url=new URL(referrer),host=url.hostname.toLowerCase();if(url.origin===origin)return 'internal';
  if(/(^|\.)(google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})|bing.com|duckduckgo.com|search.yahoo.com|ecosia.org|search.brave.com)$/.test(host))return 'search';
  if(/(^|\.)(facebook.com|instagram.com|t.co|twitter.com|x.com|youtube.com|youtu.be|tiktok.com|reddit.com|linkedin.com|pinterest.com|bsky.app|threads.net|threads.com|tumblr.com|mastodon.social)$/.test(host))return 'social';
  return 'other';
 }catch{return 'direct';}
}
export function initAudienceInsights({document:d=globalThis.document,window:w=globalThis.window,fetcher=globalThis.fetch,choice=readChoice}={}){
 if(!d||!w)return ()=>{};let disposed=false,busy=false,configPromise;const sent=new Set();
 const permitted=()=>choice()?.analytics===true&&w.navigator.globalPrivacyControl!==true&&w.navigator.doNotTrack!=='1'&&d.visibilityState==='visible';
 const target=()=>{const profile=d.querySelector('[data-profile-public-id]');if(profile)return {kind:'profile',id:profile.dataset.profilePublicId};const content=d.querySelector('[data-content-id]');return content?{kind:'content',id:content.dataset.contentId}:null;};
 async function collect(){
  const page=target();if(disposed||busy||!permitted()||!page||!/^[a-f0-9-]{36}$/i.test(page.id)||sent.has(page.kind+page.id))return;
  busy=true;
  try{
   configPromise??=fetcher(w.location.origin==='http://127.0.0.1:55410'?'/__fas/local-auth':'/account/runtime-config.json',{credentials:'omit',cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();});
   const config=await configPromise;
   const expected=w.location.origin==='https://fromastoryteller.com'?'https://vzdicnufhidelaoeqbza.supabase.co':w.location.origin==='http://127.0.0.1:55410'?'https://oqmmvjjycpyxvxipcyli.supabase.co':null;
   if(!expected||disposed||!permitted()||config.enabled===false||config.url!==expected||!config.key||JSON.stringify(target())!==JSON.stringify(page))return;
   // No cookies, account session, URL, referrer or persistent visitor ID is sent.
   sent.add(page.kind+page.id);
   await fetcher(expected+'/functions/v1/fas-page-view',{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({...page,consent:true,source:trafficSource(d.referrer,w.location.origin),device:w.innerWidth<768?'mobile':w.innerWidth<1024?'tablet':'desktop'}),signal:AbortSignal.timeout(5000)});
  }catch{configPromise=null;}finally{busy=false;}
 }
 const observer=new w.MutationObserver(()=>void collect());observer.observe(d.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-content-id','data-profile-public-id']});
 w.addEventListener('fas-storage-choice',collect);d.addEventListener('visibilitychange',collect);void collect();
 return ()=>{disposed=true;observer.disconnect();w.removeEventListener('fas-storage-choice',collect);d.removeEventListener('visibilitychange',collect);};
}
