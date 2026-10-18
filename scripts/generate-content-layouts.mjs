import {readFileSync,writeFileSync} from 'node:fs';
import {storyPageMarkup,interactiveHeaderMarkup} from '../systems/content/page-layout.mjs';
import {storyBodyHtml} from '../systems/reading/reading-time.mjs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const index=JSON.parse(readFileSync(resolve(root,'content/content-index.json'),'utf8'));
for(const metaPath of index){
 const path=resolve(root,metaPath.slice(1)),meta=JSON.parse(readFileSync(path,'utf8'));
 const page=resolve(root,metaPath.slice(1).replace(/meta\.json$/,'index.html'));
 let html=readFileSync(page,'utf8');
 const item={id:meta.id,content_type:meta.type,title:meta.title,summary:meta.description??meta.excerpt??'',published_at:meta.datePublished,source_kind:'file',
  author:{public_id:meta.author,display_name:meta.authorDisplay},image:meta.image?.src,image_alt:meta.image?.alt,
  subtype_label:(meta.subtype??'').split('-').map(x=>x[0]?.toUpperCase()+x.slice(1)).join(' ')};
 if(['story','blog'].includes(meta.type)){
  const body=storyBodyHtml(html);if(body===null)throw Error('Missing legacy manuscript '+metaPath);
  const markup=storyPageMarkup(item,{trustedBody:body});
  const article=/<article\b[^>]*class="story-page"[^>]*>[\s\S]*?<\/article>/;
  if(!article.test(html))throw Error('Missing legacy story article '+metaPath);
  html=html.replace(article,()=>markup);
  if(!html.includes('/css/manuscript.css'))html=html.replace('</head>','<link rel="stylesheet" href="/css/manuscript.css">\n</head>');
 }else if(['game','tool','video'].includes(meta.type)){
  const kind=meta.type,pattern=new RegExp('<section class="'+kind+'-hero"[^>]*>[\\s\\S]*?<\\/section>');
  const old=html.match(pattern)?.[0];if(!old)throw Error('Missing interactive header '+metaPath);
  const tagline=old.match(new RegExp('<p class="'+kind+'-tagline">([\\s\\S]*?)<\\/p>'))?.[1]?.replace(/<[^>]*>/g,'').trim();
  html=html.replace(pattern,()=>interactiveHeaderMarkup({...item,tagline}));
 }
 if(html!==readFileSync(page,'utf8'))writeFileSync(page,html);
}
console.log('Generated type-specific content layouts; legacy manuscripts and interactive slots preserved.');
