import {loadAccountAuthConfig} from '../../account/auth-settings.mjs';
import {createCardMarkup} from './content-system.js';
import {publicCoverUrl} from '../community/profiles.mjs';
const safePath=value=>typeof value==='string'&&/^\/(stories|blog|games|tools|videos|gallery)\/[a-z0-9][a-z0-9-]{0,119}\/$/.test(value)?value:null;
export async function publicSeriesRequest(name,args,{origin=location.origin,fetcher=fetch}={}) {
 const config=await loadAccountAuthConfig(origin);if(!config)return null;
 const response=await fetcher(config.url+'/rest/v1/rpc/'+name,{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(args)});
 if(!response.ok)throw Error('Related work could not load. Please try again.');return {data:await response.json(),imageBase:config.url+'/functions/v1/fas-story-image'};
}
export function collectionHref(info){const query=new URLSearchParams({scope:info.scope,collection:info.collection_name});return '/collections/?'+query;}
export function renderSeriesLinks(host,info){
 host.replaceChildren();host.hidden=true;if(!info||!info.collection_name&&!info.series_name)return;
 const d=host.ownerDocument,node=(tag,text)=>{const n=d.createElement(tag);n.textContent=text;return n;};
 host.className='content-series-section';host.setAttribute('aria-label','Series and collection');
 if(info.series_name)host.append(node('h2',info.series_name));
 if(info.collection_name&&(/^[a-f0-9-]{36}$/i.test(info.scope??'')||info.scope==='fas')){const p=node('p','Collection: '),a=node('a',info.collection_name);a.href=collectionHref(info);p.append(a);host.append(p);}
 const nav=node('nav','');nav.setAttribute('aria-label','Series order');
 for(const [key,label]of [['previous','Previous in series'],['next','Next in series']]){const item=info[key];if(!safePath(item?.url))continue;const a=node('a','');a.className='content-series-link';a.href=item.url;a.append(node('span',label),node('strong',item.title));nav.append(a);}
 if(nav.children.length)host.append(nav);host.hidden=!host.children.length;
}
export function initContentSeries({document:d=document,window:w=window,request=publicSeriesRequest}={}) {
 if(/^\/(account|tests)\//.test(w.location.pathname))return;
 let queued=false,generation=0,lastPath='',lastHero,section;
 async function scan(){queued=false;const hero=d.querySelector('main .story-header,main .game-hero,main .tool-hero,main .video-hero');if(!hero)return;
  const path=safePath(hero.closest('[data-viewer-content-path]')?.dataset.viewerContentPath??w.location.pathname.replace(/index\.html$/,''));if(!path||path===lastPath&&hero===lastHero&&section?.isConnected)return;
  section?.remove();lastPath=path;lastHero=hero;const token=++generation;section=d.createElement('section');section.hidden=true;
  const root=hero.closest('[data-viewer-content-path],.story-page')??d.querySelector('main');
  const next=d.querySelector('main .content-next-section,main [data-related-content],main .related-content');if(next)next.before(section);else root.append(section);
  try{const result=await request('fas_public_content_series',{content_path:path});if(token!==generation||!hero.isConnected)return;renderSeriesLinks(section,result?.data);}catch{ /* Keep the optional section hidden without retrying on every DOM mutation. */ }
 }
 const observer=new w.MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(scan);}});observer.observe(d.querySelector('main')??d.body,{childList:true,subtree:true});void scan();
 w.addEventListener('pagehide',()=>{generation++;observer.disconnect();},{once:true});
}
export async function initCollectionPage(root,{request=publicSeriesRequest,window:w=window}={}) {
 const d=root.ownerDocument,params=new URLSearchParams(w.location.search),name=params.get('collection')??'',scope=params.get('scope')??'';
 const heading=d.createElement('h1');heading.textContent=name||'Collections';root.replaceChildren(heading);
 const status=d.createElement('p');status.setAttribute('role','status');root.append(status);
 if(!name||name.length>100||scope!=='fas'&&!/^[a-f0-9-]{36}$/i.test(scope)){status.textContent='Open a collection from one of its published pieces.';return;}
 const grid=d.createElement('div');grid.className='content-grid';root.append(grid);const retry=d.createElement('button');retry.type='button';retry.className='account-secondary';retry.textContent='Try again';retry.hidden=true;root.append(retry);
 let running=false;
 async function load(){if(running)return;running=true;retry.hidden=true;status.textContent='Loading published work…';let cursor=null;const seen=new Set(),items=new Map();
  try{do{const result=await request('fas_public_content_collection',{scope_key:scope,collection_title:name,page_after:cursor});if(!Array.isArray(result?.data?.items))throw Error('This collection could not load. Please try again.');for(const item of result.data.items)if(safePath(item.url))items.set(item.url,{...item,image:item.image??publicCoverUrl(item.cover,result.imageBase)});cursor=result.data.next_cursor;if(cursor&&seen.has(cursor))throw Error('This collection could not load. Please try again.');seen.add(cursor);}while(cursor);
   grid.innerHTML=[...items.values()].sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).map(item=>createCardMarkup({type:item.type,category:({story:'stories',game:'games',tool:'tools',video:'videos',gallery:'gallery'})[item.type]??item.type,url:item.url,title:item.title,card:{title:item.title,description:item.summary,image:item.image,imageAlt:item.image_alt??item.cover?.alt??''}})).join('');status.textContent=items.size?'':'No published work is available in this collection.';
  }catch(error){status.textContent=error.message;retry.hidden=false;}finally{running=false;}
 }
 retry.addEventListener('click',()=>void load());await load();
}
