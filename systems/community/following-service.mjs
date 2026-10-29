import {isPublicId} from './profiles.mjs';
// Homepage membership needs no bios, images, names, timestamps or page cursors.
export async function loadFollowedIds(client,{isEnded=()=>false}={}) {
 if(isEnded())return new Set();
 const r=await client.rpc('fas_my_following_ids',{});
 if(isEnded())return new Set();
 if(r.error||!Array.isArray(r.data)||r.data.length>5000||r.data.some(id=>!isPublicId(id)))throw Error('Following could not be loaded.');
 return new Set(r.data.map(id=>id.toLowerCase()));
}
export async function loadFollowedStorytellers(client,{isEnded=()=>false}={}) {
 const people=new Map(),cursors=new Set();let cursor=null;
 do {
  const r=await client.rpc('fas_my_following',{after_name:cursor?.name??null,after_id:cursor?.id??null});
  if(isEnded())return [];
  const page=r.data,next=page?.next_cursor;
  if(r.error||!Array.isArray(page?.items)||page.items.length>24||page.items.some(p=>!isPublicId(p.public_id)||typeof p.display_name!=='string')||next&&(!isPublicId(next.id)||typeof next.name!=='string'||cursors.has(JSON.stringify(next))))throw Error('Following could not be loaded.');
  for(const p of page.items)people.set(p.public_id,p);
  cursor=next;if(cursor)cursors.add(JSON.stringify(cursor));
 }while(cursor);
 return [...people.values()];
}
