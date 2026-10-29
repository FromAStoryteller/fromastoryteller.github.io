import {queryPublicContent} from './public-query.mjs';
import {mountContentDiscovery,discoverContent} from './content-discovery.mjs';
import {mountHomeFollowing} from '../community/home-following.mjs';
import {onPageRestore} from '../core/page-restore.mjs';
import {createBrowseHistory} from './browse-state.mjs';

export async function mountRemoteDiscovery(config,{renderGrid,featured}){
 const {gridSelector,filtersSelector,featuredSelector,category='',featuredLabel='Featured Content',emptyMessage='Nothing to show yet.'}=config;
 const grid=document.querySelector(gridSelector),host=document.querySelector(filtersSelector);if(!grid||!host)return;
 const d=grid.ownerDocument,w=d.defaultView;let generation=0,controller,discovery,items=[],followed=new Set(),cursor=null,query={},currentPage,ended=false;
 const browsing=createBrowseHistory(()=>({pages:Math.max(1,Math.ceil(items.length/24))}));
 const more=d.createElement('button');more.type='button';more.className='account-secondary';more.textContent='Load more published content';more.hidden=true;grid.after(more);
 const paint=()=>{renderGrid(gridSelector,discoverContent(items,{},followed),emptyMessage,{initialCount:items.length});};
 if(!category)void mountHomeFollowing(grid,ids=>{followed=ids;if(currentPage){paint();featured(featuredSelector,discoverContent(currentPage.featured,{},followed),featuredLabel);}},{restore:false});
 async function load(state,append=false){
  const token=++generation;controller?.abort();controller=new AbortController();query={...state,...(category?{category}:{})};more.disabled=true;grid.setAttribute('aria-busy','true');discovery?.setStatus('Loading published content.');
  try{const page=await queryPublicContent({...query,offset:append?cursor?.offset??0:0},{signal:controller.signal});if(ended||token!==generation)return;
   const seen=new Set(append?items.map(i=>i.id):[]);items=[...(append?items:[]),...page.items.filter(i=>!seen.has(i.id))];cursor=page.next_cursor;currentPage=page;paint();more.hidden=!cursor;
   featured(featuredSelector,discoverContent(page.featured,{},followed),featuredLabel);
   discovery?.setStatus(items.length+' of '+page.total+' published pieces.');browsing.restore();
  }catch(error){if(ended||token!==generation||error.name==='AbortError')return;discovery?.setStatus(error.message);more.hidden=false;more.textContent='Try again';}
  finally{if(!ended&&token===generation){more.disabled=false;grid.setAttribute('aria-busy','false');}}
 }
 const initial=Object.fromEntries(new URL(w.location.href).searchParams);for(const key of Object.keys(initial))if(!['category','subtype','genre','tag','players','saves','length','sort'].includes(key))delete initial[key];if(category)initial.category=category;
 try{await load(initial);if(!currentPage)throw Error('Published content could not load. Please reload to try again.');for(let page=1;page<Math.min(50,browsing.state?.pages??1)&&cursor&&!ended;page++)await load(initial,true);
  let first=true;discovery=mountContentDiscovery(host,currentPage.facet_items,(_rows,state)=>{if(first){first=false;query=state;discovery?.setStatus(items.length+' of '+currentPage.total+' published pieces.');return;}void load(state);},{category,remote:true});discovery.setStatus(items.length+' of '+currentPage.total+' published pieces.');
 }catch(error){host.textContent=error.message;grid.replaceChildren();document.querySelector(featuredSelector)?.replaceChildren();}finally{delete d.documentElement.dataset.fasHomeStartup;}
 more.addEventListener('click',()=>{const append=Boolean(cursor)&&more.textContent!=='Try again';more.textContent='Load more published content';void load(query,append);});
 w.addEventListener('pagehide',()=>{ended=true;generation++;controller?.abort();discovery?.dispose();browsing.dispose();more.remove();},{once:true});
 onPageRestore(w,()=>mountRemoteDiscovery(config,{renderGrid,featured}),{hide:grid.closest('main')??grid});
}
