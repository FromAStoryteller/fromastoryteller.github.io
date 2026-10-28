import {normalizeGameFeatures} from '../content/game-features.mjs';
import {loadAccountAuthConfig} from '../../account/auth-settings.mjs';
import {contentPath} from './content-address.mjs';
import {isPublicId,publicCoverUrl} from './profiles.mjs';
export function publicStoryCard(row,imageBase){
 if(row?.status!=='published'||!isPublicId(row.id)||!isPublicId(row.author?.public_id)||!['story','blog','game','tool'].includes(row.content_type)||typeof row.title!=='string'||typeof row.summary!=='string'||!Number.isFinite(Date.parse(row.published_at)))return null;
 const url=contentPath(row);if(!url)return null;
 const image=publicCoverUrl(row.cover,imageBase),category=({story:'stories',blog:'blog',game:'games',tool:'tools'})[row.content_type],tags=Array.isArray(row.tags)?row.tags.filter(t=>typeof t==='string'):[];
 return {id:row.id,type:row.content_type,category,subtype:row.content_type,status:'published',draft:false,featured:false,pinned:false,title:row.title,shortTitle:row.title,description:row.summary,excerpt:row.summary,url,slug:row.slug,datePublished:row.published_at,dateModified:row.updated_at,author:row.author.public_id,authorDisplay:row.author.display_name,gameFeatures:row.content_type==='game'?normalizeGameFeatures(row.game_features):null,readingMinutes:Number(row.reading_minutes)||1,
 genres:Array.isArray(row.genres)?row.genres:[],image:{src:image,alt:row.cover?.alt||'',width:row.cover?.width||1600,height:row.cover?.height||900},card:{title:row.title,description:row.summary,image,imageAlt:row.cover?.alt||'',icon:row.content_type==='game'?'fa-solid fa-gamepad':row.content_type==='tool'?'fa-solid fa-feather-pointed':'fa-solid fa-book-open',tags},taxonomy:{genres:Array.isArray(row.genres)?row.genres:[]}};
}
export function createPublicStoryPager({origin=typeof location==='undefined'?null:location.origin,fetcher=fetch,loadConfig=loadAccountAuthConfig,initialPage}={}){
 if(!origin)return {done:true,next:async()=>[]};
 const edge=origin==='https://fromastoryteller.com'&&typeof location!=='undefined'&&location.origin===origin&&fetcher===globalThis.fetch&&loadConfig===loadAccountAuthConfig;
 let configured;const configFor=()=>configured??=(edge?Promise.resolve({url:origin}):loadConfig(origin));
 let finished=false,pending;
 const seen=new Set(),cursors=new Set();let cursor=null;
 const pager={get done(){return finished;},next(){return pending??=(read().finally(()=>{pending=null;}));}};
 async function read(){
  if(finished)return [];
  const config=await configFor();if(!config){finished=true;return [];}
  const endpoint=config.url+'/rest/v1/rpc/fas_public_story_catalog',imageBase=(edge?'https://vzdicnufhidelaoeqbza.supabase.co':config.url)+'/functions/v1/fas-story-image';
  const query=new URLSearchParams();if(cursor){query.set('before_time',cursor.published_at);query.set('after_id',cursor.id);}
  const response=initialPage?{ok:true,json:async()=>initialPage}:await fetcher(edge?'/api/public/stories'+(query.size?'?'+query:''):endpoint,{method:edge?'GET':'POST',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers:edge?{}:{apikey:config.key,'Content-Type':'application/json'},body:edge?undefined:JSON.stringify({before_time:cursor?.published_at??null,after_id:cursor?.id??null})});
  if(!response.ok)throw new Error('Published stories could not be loaded.');
  const page=await response.json();if(!Array.isArray(page?.items)||page.items.length>60)throw new Error('Published stories could not be read.');
  const next=page.next_cursor;if(next){const key=JSON.stringify(next);if(!isPublicId(next.id)||!Number.isFinite(Date.parse(next.published_at))||cursors.has(key))throw new Error('Published story pagination could not continue.');cursors.add(key);}
  const batch=[];
  for(const row of page.items){const card=publicStoryCard(row,imageBase);if(card&&!seen.has(card.id)){seen.add(card.id);batch.push(card);}}
  cursor=next;finished=!cursor;initialPage=null;return batch;
 }
 return pager;
}
export async function publicStoryCatalog(options){const pager=createPublicStoryPager(options),items=[];while(!pager.done)items.push(...await pager.next());return items;}
