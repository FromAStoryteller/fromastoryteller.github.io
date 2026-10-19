import {genreLabel} from '../community/studio-catalog.mjs';
import {normalizeGameFeatures} from './game-features.mjs';
import {plainDocument,validateDocument} from '../community/manuscript.mjs';
import {readingTimeFromHtml} from '../reading/reading-time.mjs';
export const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const contentLayouts=Object.freeze({
 story:{collection:'/stories/',label:'Stories',end:'The End',className:'story'},
 blog:{collection:'/blog/',label:'Blog',end:'',className:'story'},
 game:{collection:'/games/',label:'Games',end:'',className:'game'},
 tool:{collection:'/tools/',label:'Tools',end:'',className:'tool'},
 video:{collection:'/videos/',label:'Videos',end:'',className:'video'}
});
function safeImage(value,{preview=false}={}){
 try{const u=new URL(value,'https://fromastoryteller.com');return ((u.protocol==='https:'||u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname))&&!u.username&&!u.password)||preview&&u.protocol==='blob:'?escapeText(value):'';}catch{return '';}
}
function authorMarkup(author={},file=false){
 const id=/^[0-9a-f-]{36}$/i.test(author.public_id??'')?author.public_id:null;
 const text='By '+escapeText(author.display_name||'Storyteller');
 const byline=id?'<a href="/storytellers/?author='+id+'">'+text+'</a>':text;
 return '<span class="'+(file?'file-publishing-author':'story-author')+'"'+(file?' data-file-publishing':'')+'>'+byline+'</span>';
}
export function socialMarkup(links=[]){
 const valid=links.flatMap(link=>{try{const u=new URL(link.url);if(u.protocol!=='https:'||u.username||u.password)return [];return ['<a href="'+escapeText(u.href)+'" target="_blank" rel="me noopener noreferrer">'+escapeText(link.platform==='website'?'Website':link.platform)+'</a>'];}catch{return [];}});
 return valid.length?'<nav class="storyteller-socials" aria-label="Author social links">'+valid.join('')+'</nav>':'';
}
export function manuscriptMarkup(value,options={}){
 const doc=validateDocument(value),scene=['space','dots','diamond','rule'].includes(options.scene_style)?options.scene_style:'space';
 let previous=null;
 const html=doc.blocks.map(block=>{
  if(block.type==='scene'){previous=block;return '<hr data-scene="true" aria-label="Scene break">';}
  const tag={paragraph:'p',heading:'h2',quote:'blockquote'}[block.type];
  const runs=block.runs??[{text:block.text}];
  const text=runs.map(run=>{let t=escapeText(run.text);if(run.italic)t='<em>'+t+'</em>';if(run.bold)t='<strong>'+t+'</strong>';return t;}).join('');
  const filled=runs.some(run=>run.text.trim());
  const indent=block.type==='paragraph'&&filled&&previous?.type==='paragraph'&&(previous.runs??[{text:previous.text}]).some(run=>run.text.trim());
  previous=block;
  return '<'+tag+(tag==='p'?' data-indent="'+!!indent+'"':'')+'>'+(text||'<br>')+'</'+tag+'>';
 }).join('');
 return {html,attributes:'data-scene-style="'+scene+'" data-drop-caps="'+(options.drop_caps===true)+'" data-paragraph-style="indented"'};
}
// trustedBody is exclusively repository-authored markup, never contributor HTML.
// Contributor text is always rendered from the validated manuscript model.
export function storyPageMarkup(item,{trustedBody,preview=false}={}){
 const type=item.content_type??'story',layout=contentLayouts[type];
 if(!layout||!['story','blog'].includes(type))throw Error('An editorial content type is required');
 const manuscript=trustedBody===undefined?manuscriptMarkup(item.body_document??plainDocument(item.body),item):null;
 const body=manuscript?.html??trustedBody;
 const image=safeImage(item.image??'',{preview}),title=escapeText(item.title);
 const date=new Date(item.published_at??'');
 const dateMarkup=Number.isFinite(date.valueOf())?'<time class="story-date" datetime="'+escapeText(item.published_at)+'">'+escapeText(new Intl.DateTimeFormat('en-NZ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date))+'</time>':'';
 const minutes=readingTimeFromHtml(body).minutes;
 const labels=(item.genres??[]).filter(x=>typeof x==='string'&&x.trim());
 return '<article class="story-page" data-content-layout="'+type+'"'+(item.id?' data-current-content-id="'+escapeText(item.id)+'"':'')+'>'+
 '<a href="'+layout.collection+'" class="story-back-link"><span aria-hidden="true">←</span><span>Back to '+layout.label+'</span></a>'+
 '<header class="story-header"><div class="story-hero image-overlay'+(image?'':' story-hero--no-image')+'">'+
 (image?'<figure class="story-feature-image image-overlay__media"><img src="'+image+'" alt="'+escapeText(item.image_alt)+'" width="1600" height="900"></figure>':'')+
 '<div class="story-hero-copy image-overlay__content"><p class="story-category">'+layout.label+(item.subtype_label?' / '+escapeText(item.subtype_label):'')+'</p><h1'+(preview?' id="ss-preview-title"':'')+'>'+title+'</h1></div></div>'+
 '<div class="story-meta">'+authorMarkup(item.author,item.source_kind==='file')+'<span data-story-reading-time><i class="fa-solid fa-clock" aria-hidden="true"></i>'+minutes+' min read</span>'+dateMarkup+'</div></header>'+
 ((labels.length||item.content_warning)?'<div class="story-details">'+
 (labels.length?contentBadgesMarkup(item):'')+
 (item.content_warning?'<p class="story-warning"><strong>Content warning:</strong> '+escapeText(item.content_warning)+'</p>':'')+'</div>':'')+
 '<section class="story-content'+(manuscript?' fas-manuscript':'')+'" aria-label="Manuscript"'+(manuscript?' '+manuscript.attributes:'')+'>'+body+'</section>'+
 '<footer class="story-footer"><div class="story-end-mark" aria-hidden="true">✦</div>'+
 (layout.end?'<p class="story-end-text">'+layout.end+'</p>':'')+socialMarkup(item.author?.social_links)+'<!--author-socials-->'+
 '<a href="'+layout.collection+'" class="story-return-link">Browse All '+layout.label+'</a></footer></article>';
}
// Type-specific platform wrapper. Interactive implementations remain opaque slots.
export function interactiveHeaderMarkup(item){
 const type=item.content_type,layout=contentLayouts[type];
 if(!['game','tool','video'].includes(type))throw Error('An interactive content type is required');
 return '<section class="'+layout.className+'-hero" data-content-layout="'+type+'"><p class="'+layout.className+'-eyebrow">'+layout.label+(item.subtype_label?' / '+escapeText(item.subtype_label):'')+'</p><h1>'+escapeText(item.title)+'</h1>'+authorMarkup(item.author,true)+
 (item.tagline?'<p class="'+layout.className+'-tagline">'+escapeText(item.tagline)+'</p>':'')+'<p class="'+layout.className+'-intro">'+escapeText(item.summary)+'</p>'+contentPageDetailsMarkup(item)+'</section>';
}

export function contentPageDetailsMarkup(item){
 return contentBadgesMarkup(item)+(item.content_warning?'<p class="story-warning"><strong>Content warning:</strong> '+escapeText(item.content_warning)+'</p>':'');
}

export function contentBadgesMarkup(item){
 const mode=normalizeGameFeatures(item.gameFeatures??item.game_features);
 const labels=[...new Set((item.genres??item.taxonomy?.genres??[]).filter(x=>typeof x==='string'&&x.trim()).map(genreLabel)),...(item.content_type==='game'?[mode?.multiplayer&&mode.multiplayer!=='off'?'Multiplayer':'Single player']:[])];
 return labels.length?'<p class="content-page-details'+(['story','blog'].includes(item.content_type??'story')?' story-taxonomy':'')+'" aria-label="Content details">'+labels.map(label=>'<span class="content-detail-badge">'+escapeText(label)+'</span>').join('')+'</p>':'';
}
