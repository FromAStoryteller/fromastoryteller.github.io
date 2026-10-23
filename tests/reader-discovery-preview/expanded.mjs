import {mountContentDiscovery} from '../../systems/content/content-discovery.mjs';
import {renderContentGrid} from '../../systems/content/content-system.js';
import {mountHomeFollowing} from '../../systems/community/home-following.mjs';
import {mountViewerHistory} from '../../systems/community/viewer-history.mjs';
import {initStoryAuthorPanels} from '../../systems/community/story-author-panel.mjs';
import {accountNavigation} from '../../systems/community/account-navigation.mjs';
const a='aa000000-0000-4000-8000-000000000001',b='aa000000-0000-4000-8000-000000000002',profile={public_id:a,display_name:'Mara Vale',welcome_line:'Stories, games, and tools for curious minds.'};
const row=(id,type,author,date,extra={})=>({id,title:id,type,category:({story:'stories',game:'games',tool:'tools',blog:'blog',video:'videos'})[type],author,authorDisplay:author===a?'Mara Vale':'Zia Moon',datePublished:date,status:'published',draft:false,url:'/'+({story:'stories',game:'games',tool:'tools',blog:'blog',video:'videos'})[type]+'/'+id+'/',image:{},card:{title:id,description:'A fictional piece.',image:'',imageAlt:''},...extra});
const items=[row('Newest discovery','story',b,'2026-10-22',{genres:['fantasy'],readingMinutes:4}),row('Followed story','story',a,'2026-10-20',{genres:['fantasy'],readingMinutes:20}),row('Solo game','game',a,'2026-10-19',{subtype:'arcade',gameFeatures:{saves:true,multiplayer:'off'}}),row('Room game','game',b,'2026-10-21',{subtype:'sports',gameFeatures:{saves:false,multiplayer:'realtime'}}),row('Focus timer','tool',b,'2026-10-18',{genres:['productivity'],tags:['Focus'],subtype:'focus'}),row('Writing notes','blog',a,'2026-10-17',{genres:['creative-process'],tags:['Writing'],readingMinutes:6}),row('Mountain film','video',b,'2026-10-16',{tags:['Travel'],subtype:'short-film'})];
const completed=new Set([items[0].url,items[2].url]),subscribers=new Set();let following=true;
const account={imageBase:'',subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},client:{rpc:async(name,args)=>{
 if(name==='fas_my_viewer_actions')return {data:args.content_keys.map(key=>({key,experienced:completed.has(key)}))};
 if(name==='fas_my_following')return {data:{items:following?[profile]:[],next_cursor:null}};
 if(name==='fas_my_storyteller_follow')return {data:{available:true,can_follow:true,following}};
 if(name==='fas_set_storyteller_follow'){following=args.enabled;return {data:{following}};}
 throw Error('Unexpected fixture RPC '+name);
}}},connect=async()=>account;
const discovery=mountContentDiscovery(document.querySelector('#expanded-filters'),items,rows=>renderContentGrid('#expanded-grid',rows),{window});
await mountHomeFollowing(document.querySelector('#expanded-grid'),ids=>discovery.setFollowed(ids),{connect});
await mountViewerHistory(document.querySelector('#history'),{connect,loadContent:async()=>items});
initStoryAuthorPanels({connect,request:async()=>({data:profile})});
document.querySelector('#navigation').append(accountNavigation(document,{current:'profile',publicId:a,auth:{signOut:async()=>({error:null})}}));
document.querySelector('#end-expanded').addEventListener('click',()=>{for(const fn of [...subscribers])fn();});
