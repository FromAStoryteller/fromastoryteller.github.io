// Original imported covers only. Asset IDs identify immutable originals; replacement uploads use new IDs.
// blobSha locks each repository source to its reviewed bytes. Revalidate visual equivalence before updating.
export const importedCoverImages={
  "b6d352ac-4b97-ce9c-2bb9-37604236da6d": {
    "src": "/assets/images/covers/onto-the-stage.jpg",
    "blobSha": "6a2d92b9d2618e97724e4a569c305e36b1eb6947"
  },
  "1bcc3be4-1f85-0cd9-d053-9f50e85dd60f": {
    "src": "/assets/images/covers/moon-hoc-meeting.jpg",
    "blobSha": "615aca9efa904e6a2f608cb6e0fd2250fe3b9e15"
  },
  "f1e0a05f-60c9-0626-6299-f053f0956f21": {
    "src": "/assets/images/covers/the-deal.jpg",
    "blobSha": "d48678e3cf2cce15a526e6aa7a149822ed27ec0e"
  },
  "9c43429c-59fe-ddad-f292-5ddf3b78dc44": {
    "src": "/assets/images/covers/a-place-left-behind.jpg",
    "blobSha": "1e7d91b573b3d44b0c42e275742e9fd2ac38473b"
  },
  "25df8964-1ee8-a857-dbba-0d3bbff0ec5a": {
    "src": "/assets/images/covers/the-labyrinth.jpg",
    "blobSha": "80d2dc4d1217acc676b5160581ad7d9ce9d20feb"
  },
  "41723534-5f16-9a17-d9ef-a0609d80fc21": {
    "src": "/assets/images/covers/sunset-at-the-lighthouse.jpg",
    "blobSha": "851773f442debb76bb852a9b8505f28d7b8d4dde"
  },
  "262306c0-af71-b848-8132-a282ddc4ddc6": {
    "src": "/assets/images/covers/crypt-of-the-blood-jewel.jpg",
    "blobSha": "43593fbdd146fff6e4e05b8e42d4b864e7c6e91e"
  },
  "58792751-bcf4-e3b3-6557-a860b966bb86": {
    "src": "/assets/images/covers/date-night-jigsaw.jpg",
    "blobSha": "b584596d4f2acb0389bc7c03390d21590c7824ae"
  },
  "d212ecc5-d565-bf75-de74-7b6f17626706": {
    "src": "/assets/images/covers/tea-at-the-summit.jpg",
    "blobSha": "e0f6a9077d0dc901546647332192c54bfbd44a83"
  },
  "05cbe008-99d6-edd3-5357-1c8e0fb9e19d": {
    "src": "/assets/images/covers/michaels-choice.jpg",
    "blobSha": "e9faf251a0cbf47bbf70d5374f4ee7539219ccc3"
  }
};
import {normalizeGameFeatures} from '../content/game-features.mjs';
import {loadAccountAuthConfig} from '../../account/auth-settings.mjs';
import {contentPath} from './content-address.mjs';
import {isPublicId,publicCoverUrl} from './profiles.mjs';
export function publicStoryCard(row,imageBase){
 if(row?.status!=='published'||!isPublicId(row.id)||!isPublicId(row.author?.public_id)||!['story','blog','game','tool'].includes(row.content_type)||typeof row.title!=='string'||typeof row.summary!=='string'||!Number.isFinite(Date.parse(row.published_at)))return null;
 const url=contentPath(row);if(!url)return null;
 const liveImage=publicCoverUrl(row.cover,imageBase),original=liveImage&&imageBase==='https://vzdicnufhidelaoeqbza.supabase.co/functions/v1/fas-story-image'?importedCoverImages[row.cover.asset_id]:null;
 const image=original?.src||liveImage||(typeof row.preview_image==='string'&&row.preview_image.startsWith('/assets/')?row.preview_image:''),category=({story:'stories',blog:'blog',game:'games',tool:'tools'})[row.content_type],tags=Array.isArray(row.tags)?row.tags.filter(t=>typeof t==='string'):[];
 return {id:row.id,type:row.content_type,category,subtype:row.subtype||row.content_type,status:'published',draft:false,featured:false,pinned:false,title:row.title,shortTitle:row.title,description:row.summary,excerpt:row.summary,url,slug:row.slug,datePublished:row.published_at,dateModified:row.updated_at,author:row.author.public_id,authorDisplay:row.author.display_name,gameFeatures:row.content_type==='game'?normalizeGameFeatures(row.game_features):null,readingMinutes:Number(row.reading_minutes)||(['story','blog'].includes(row.content_type)?1:0),
 genres:Array.isArray(row.genres)?row.genres:[],image:{src:image,alt:row.cover?.alt||row.preview_alt||'',width:original?1600:row.cover?.width||row.preview_width||1600,height:original?900:row.cover?.height||row.preview_height||900},card:{title:row.title,description:row.summary,image,imageAlt:row.cover?.alt||row.preview_alt||'',icon:row.content_type==='game'?'fa-solid fa-gamepad':row.content_type==='tool'?'fa-solid fa-feather-pointed':'fa-solid fa-book-open',tags},taxonomy:{genres:Array.isArray(row.genres)?row.genres:[]}};
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
