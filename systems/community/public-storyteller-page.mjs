import {isPublicId,publicProfileUrl} from './profiles.mjs';
import {renderPublicProfile} from './public-profile.mjs';
import {initProfileDirectory,publicProfileRequest} from './profile-directory.mjs';
export async function initPublicStorytellerPage(root,{request=publicProfileRequest,onRender=()=>{},window:w=window}={}){
 const d=root.ownerDocument,id=new URL(w.location.href).searchParams.get('author');
 if(!id){d.title='Storytellers | From A Storyteller';await initProfileDirectory(root,{window:w});return;}
 const back=()=>{const a=d.createElement('a');a.href='/storytellers/';a.className='storyteller-directory-back';a.textContent='Browse storytellers';return a;};
 let profile=null,disposed=false,loading=false;w.addEventListener('pagehide',event=>{if(!event.persisted)disposed=true;},{once:true});
 async function load(append=false){if(loading||disposed)return;loading=true;const more=root.querySelector('[data-profile-more]');if(more)more.disabled=true;
  try{const response=isPublicId(id)?await request('fas_public_profile',{profile_key:id,page_offset:append?profile.next_offset:0}):{data:null};if(disposed)return;const page=response.data;
   profile=append&&page?{...page,stories:[...profile.stories,...page.stories]}:page;
   renderPublicProfile(root,profile,{imageBase:response.imageBase});root.prepend(back());
   if(!profile){d.title='Storyteller unavailable | From A Storyteller';return;}
   d.title=profile.display_name+' | From A Storyteller';
   const description=(profile.welcome_line||profile.bio||'Published work by '+profile.display_name).slice(0,180);d.querySelector('meta[name="description"]')?.setAttribute('content',description);d.querySelector('link[rel="canonical"]')?.setAttribute('href','https://fromastoryteller.com'+publicProfileUrl(id));
   if(profile.next_offset!=null){const button=d.createElement('button');button.type='button';button.className='account-secondary';button.dataset.profileMore='';button.textContent='More work';button.addEventListener('click',()=>void load(true));root.append(button);if(append)button.focus({preventScroll:true});}
   void Promise.resolve(onRender(profile)).catch(()=>{});
  }catch(error){if(disposed)return;if(more){more.textContent='Could not load work. Try again';more.disabled=false;}else{root.replaceChildren(back());const h=d.createElement('h1');h.textContent='This storyteller could not be loaded';const p=d.createElement('p');p.setAttribute('role','status');p.textContent=error.message;const retry=d.createElement('button');retry.type='button';retry.className='content-filter';retry.textContent='Try again';retry.addEventListener('click',()=>void load());root.append(h,p,retry);}}
  finally{loading=false;}
 }
 await load();
}
