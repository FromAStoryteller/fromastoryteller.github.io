import {getAllPublishedContent} from './content-system.js';
import {remoteDiscovery,queryPublicContent} from './public-query.mjs';
const navigationContent=async options=>remoteDiscovery()?(await queryPublicContent({limit:1})).facet_items.map(item=>({...item,status:'published',draft:false})):getAllPublishedContent(options);
const mounted=new WeakMap();
export async function initContentNavigation({document:d=document,load=navigationContent}={}) {
 // Older public pages and immutable policy snapshots can carry the earlier shell.
 for(const link of d.querySelectorAll('.sidebar-item[href]')){const category=link.getAttribute('href')?.match(/^\/(blog|games|stories|tools|videos|gallery)\/$/)?.[1];if(category&&!link.dataset.contentCategory){link.dataset.contentCategory=category;if(['blog','videos','gallery'].includes(category))link.hidden=true;}}
 if(!d.querySelector('[data-content-category="gallery"]')){const video=d.querySelector('[data-content-category="videos"]');if(video){const a=d.createElement('a'),icon=d.createElement('i'),text=d.createElement('span');a.href='/gallery/';a.className='sidebar-item';a.dataset.contentCategory='gallery';a.hidden=true;a.title='Gallery';a.setAttribute('aria-label','Gallery');icon.className='fa-solid fa-images';icon.setAttribute('aria-hidden','true');text.textContent='Gallery';a.append(icon,text);video.before(a);}}
 const links=[...d.querySelectorAll('[data-content-category]')];if(!links.length)return;
 mounted.get(d)?.();let generation=0;
 async function update(refresh=false){const token=++generation;try{const items=await load({refresh}),available=new Set(items.filter(item=>item.status==='published'&&!item.draft).map(item=>item.category));
  if(token===generation)for(const link of links)link.hidden=!available.has(link.dataset.contentCategory);
 }catch{ /* Retain the generated published-file navigation when services fail. */ }}
 const changed=()=>void update(true);d.addEventListener('fas:publication-changed',changed);mounted.set(d,()=>{generation++;d.removeEventListener('fas:publication-changed',changed);});await update();
}
