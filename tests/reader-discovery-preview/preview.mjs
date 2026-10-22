import {mountStoryDiscovery} from '../../systems/content/story-discovery.mjs';
import {selectFeatured} from '../../systems/content/featured-selection.mjs';
import {renderContentGrid,initFeaturedRotator} from '../../systems/content/content-system.js';
import {storyPageMarkup} from '../../systems/content/page-layout.mjs';
import {initStoryAuthorPanels} from '../../systems/community/story-author-panel.mjs';
import {mountFollowingPage} from '../../systems/community/following-page.mjs';
import {initViewerActions} from '../../systems/community/viewer-actions.mjs';
import {initNavigationLabels} from '../../systems/core/navigation-labels.mjs';
const a='aa000000-0000-4000-8000-000000000001',b='aa000000-0000-4000-8000-000000000002';
const profile={public_id:a,display_name:'Mara Vale',welcome_line:'Stories for wandering minds.',bio:'A fictional writer for this preview.',stories:[]};
const item=(id,title,type,author,date,minutes,genre)=>({id,title,type,category:({story:'stories',blog:'blog',game:'games'})[type],status:'published',draft:false,author,authorDisplay:author===a?'Mara Vale':'Zia Moon',datePublished:date,readingMinutes:minutes,genres:[genre],url:'/stories/'+id+'/',image:{src:'/assets/images/covers/tea-at-the-summit.jpg',alt:'Mountain'},card:{title,description:'A fictional publication used to verify discovery and account states.',image:'/assets/images/covers/tea-at-the-summit.jpg',imageAlt:'Mountain'}});
const items=[item('latest-story','A Quiet Summit','story',a,'2026-10-21',4,'fantasy'),item('older-story','The Long Road','story',a,'2026-10-19',22,'fantasy'),item('other-story','City of Tomorrow','story',b,'2026-10-20',8,'science-fiction'),item('latest-blog','Behind the Mountain','blog',a,'2026-10-22',3,'creative-process')];
const state=new Map(),subscribers=new Set();let following=true;
const value=key=>{if(!state.has(key))state.set(key,{id:key,key,saved:false,experienced:key==='/stories/latest-story/',loved:false});return state.get(key);};
const account={imageBase:'',subscribe(fn){subscribers.add(fn);return ()=>subscribers.delete(fn);},client:{rpc:async(name,args)=>{
 if(name==='fas_my_viewer_actions')return {data:args.content_keys.map(key=>({...value(key)}))};
 if(name==='fas_set_viewer_action'){const next=value(args.content_key);next[args.action_key]=args.enabled;return {data:{...next}};}
 if(name==='fas_my_following')return {data:{items:following?[profile]:[],next_cursor:null}};
 if(name==='fas_my_storyteller_follow')return {data:{available:true,can_follow:true,following}};
 if(name==='fas_set_storyteller_follow'){following=args.enabled;return {data:{following}};}
 throw Error('Unexpected fixture request');
}}};
const connect=async()=>account;
mountStoryDiscovery(document.querySelector('#discovery'),items.filter(x=>x.type==='story'),rows=>renderContentGrid('#preview-grid',rows,'No matching stories.'));
initFeaturedRotator('#preview-featured',selectFeatured(items.filter(x=>x.author===a),{perType:true}),'Featured work by Mara Vale');
document.querySelector('#story').innerHTML=storyPageMarkup({id:'latest-story',content_type:'story',title:'A Quiet Summit',body:'A short fictional story for the preview. The reader reaches the summit and begins another journey.',published_at:'2026-10-21',author:{public_id:a,display_name:'Mara Vale'}});
initStoryAuthorPanels({connect,request:async()=>({data:profile})});
initViewerActions({connect,window:new Proxy(window,{get(target,key){if(key==='location')return {pathname:'/stories/latest-story/',search:''};const result=Reflect.get(target,key);return typeof result==='function'?result.bind(target):result;}})});
await mountFollowingPage(document.querySelector('#following'),{connect,loadContent:async()=>items});
initNavigationLabels();
document.querySelector('#end-session').addEventListener('click',()=>{for(const fn of [...subscribers])fn();});
