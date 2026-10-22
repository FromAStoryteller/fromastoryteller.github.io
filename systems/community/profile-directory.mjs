import {loadAccountAuthConfig} from '../../account/auth-settings.mjs';
import {isPublicId,publicProfileUrl} from './profiles.mjs';
import {profileImageUrl} from './profile-image-service.mjs';
export async function publicProfileRequest(name,args,{origin=globalThis.location?.origin,fetcher=fetch,signal}={}){
 const config=await loadAccountAuthConfig(origin);if(!config)throw Error('Storytellers are temporarily unavailable.');
 const response=await fetcher(config.url+'/rest/v1/rpc/'+name,{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(args)});
 if(!response.ok)throw Error('Storytellers could not be loaded. Please try again.');
 return {data:await response.json(),imageBase:config.url+'/functions/v1/fas-story-image'};
}
export async function findPublicProfiles(query='',cursor=null,options={}){
 const result=await publicProfileRequest('fas_public_profile_catalog',{query_text:query.trim().slice(0,100),after_name:cursor?.name??null,after_id:cursor?.id??null},options);
 if(!Array.isArray(result.data?.items)||result.data.items.length>24||result.data.next_cursor&&(!isPublicId(result.data.next_cursor.id)||typeof result.data.next_cursor.name!=='string'))throw Error('Storyteller results could not be read.');
 return {...result,data:{...result.data,items:result.data.items.filter(p=>isPublicId(p.public_id)&&typeof p.display_name==='string')}};
}
export function renderProfileCards(host,profiles,{imageBase,append=false}={}){
 const d=host.ownerDocument;if(!append)host.replaceChildren();host.classList.add('storyteller-directory-grid');
 for(const profile of profiles){if(!isPublicId(profile.public_id)||typeof profile.display_name!=='string')continue;
  const a=d.createElement('a');a.className='storyteller-directory-card';a.href=publicProfileUrl(profile.public_id);
  const monogram=d.createElement('span');monogram.className='storyteller-directory-avatar';monogram.setAttribute('aria-hidden','true');monogram.textContent=profile.display_name.trim().split(/\s+/).slice(0,2).map(s=>Array.from(s)[0]).join('').toUpperCase();a.append(monogram);
  const src=profileImageUrl(profile.image,imageBase);if(src){const image=d.createElement('img');image.src=src;image.alt='';image.loading='lazy';image.width=image.height=64;monogram.replaceChildren(image);image.addEventListener('error',()=>image.replaceWith(d.createTextNode(profile.display_name.slice(0,1).toUpperCase())),{once:true});}
  const name=d.createElement('h3');name.textContent=profile.display_name;a.append(name);
  const text=profile.welcome_line||profile.bio;if(text){const p=d.createElement('p');p.textContent=Array.from(text).slice(0,180).join('')+(Array.from(text).length>180?'…':'');a.append(p);}
  const action=d.createElement('span');action.className='storyteller-directory-action';action.textContent='View profile';a.append(action);host.append(a);
 }
}
export async function initProfileDirectory(root,{find=findPublicProfiles,window:w=window}={}){
 const d=root.ownerDocument,node=(tag,text)=>{const n=d.createElement(tag);if(text)n.textContent=text;return n;};
 root.replaceChildren(node('h1','Storytellers'),node('p','Meet the contributors behind the stories, games and other work.'));
 const form=node('form');form.className='storyteller-directory-search';form.setAttribute('role','search');const label=node('label','Find a storyteller');label.htmlFor='storyteller-query';const input=node('input');input.type='search';input.id=label.htmlFor;input.maxLength=100;input.placeholder='Name, interests or about me';input.value=new URL(w.location.href).searchParams.get('q')?.slice(0,100)||'';const submit=node('button','Search');submit.type='submit';submit.className='content-filter';form.append(label,input,submit);
 const status=node('p');status.setAttribute('role','status');const grid=node('div');grid.className='storyteller-directory-grid';const more=node('button','More storytellers');more.type='button';more.className='content-filter';more.hidden=true;const retry=node('button','Try again');retry.type='button';retry.className='content-filter';retry.hidden=true;root.append(form,status,grid,more,retry);
 let cursor=null,generation=0,disposed=false,timer,loadedQuery='',lastFailedAppend=false;const seen=new Set();
 async function load(append=false){const token=++generation,query=input.value.trim();lastFailedAppend=append;more.disabled=true;retry.hidden=true;status.textContent='Loading storytellers.';
  if(!append){cursor=null;seen.clear();grid.replaceChildren();more.hidden=true;const url=new URL(w.location.href);query?url.searchParams.set('q',query):url.searchParams.delete('q');w.history.replaceState(w.history.state,'',url);loadedQuery=query;}
  try{const result=await find(query,append?cursor:null);if(disposed||token!==generation)return;const key=JSON.stringify(result.data.next_cursor);if(result.data.next_cursor&&seen.has(key))throw Error('Storyteller results could not continue.');seen.add(key);renderProfileCards(grid,result.data.items,{imageBase:result.imageBase,append});cursor=result.data.next_cursor;more.hidden=!cursor;status.textContent=grid.children.length?'Showing '+grid.children.length+(grid.children.length===1?' storyteller':' storytellers')+', A–Z.':query?'No storytellers match this search. Try another name or interest.':'No storytellers are listed yet.';
  }catch(error){if(!disposed&&token===generation){status.textContent=error.message;retry.hidden=false;}}
  finally{if(!disposed&&token===generation)more.disabled=false;}
 }
 form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);void load();});input.addEventListener('input',()=>{clearTimeout(timer);generation++;more.hidden=true;retry.hidden=true;timer=setTimeout(()=>void load(),250);});more.addEventListener('click',()=>void load(input.value.trim()===loadedQuery));retry.addEventListener('click',()=>void load(lastFailedAppend&&input.value.trim()===loadedQuery));w.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;generation++;clearTimeout(timer);}},{once:true});await load();
}
