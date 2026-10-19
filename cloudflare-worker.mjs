// Generated account policy release: game-features-2026-10-19-v1
// Regenerated with site indexes so policy-only releases also refresh the hosting build.
import {interactivePageMarkup} from './systems/community/interactive-page.mjs';
import {isInteractive} from './systems/community/interactive-package.mjs';
import {storyPageMarkup} from './systems/content/page-layout.mjs';
import {fileContentPath} from './systems/community/publishing-identity.mjs';
import {contentPath,contentAddress} from './systems/community/content-address.mjs';
import {contentMetadata} from './systems/community/content-metadata.mjs';
import {isProductionAuthConfig,PRODUCTION_ACCOUNT_ORIGIN,PRODUCTION_AUTH_URL} from './account/auth-settings.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderReadingMetadata(html,story,image){
 const m=contentMetadata(story,image);
 const head=`<title>${escape(m.title)}</title><meta name="description" content="${escape(m.description)}"><meta name="robots" content="index, follow"><link rel="canonical" href="${escape(m.canonical)}">`+
 Object.entries({'og:type':'article','og:title':m.title,'og:description':m.description,'og:url':m.canonical,'og:image':m.image}).map(([property,content])=>`<meta property="${property}" content="${escape(content)}">`).join('')+
 Object.entries({'twitter:card':'summary_large_image','twitter:title':m.title,'twitter:description':m.description,'twitter:image':m.image}).map(([name,content])=>`<meta name="${name}" content="${escape(content)}">`).join('')+
 `<script type="application/ld+json" data-community-schema>${JSON.stringify(m.structured).replace(/</g,'\\u003c')}</script>`;
 return html.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+name="(?:description|robots)"[^>]*>/gi,'').replace(/<link\s+rel="canonical"[^>]*>/gi,'').replace('</head>',()=>head+'</head>');
}

export function renderFilePublishing(html,item){
 const author=item.author,profile='/storytellers/?author='+encodeURIComponent(author.public_id);
 html=html.replace(/<span class="file-publishing-author" data-file-publishing>[\s\S]*?<\/span>/,()=>'<span class="file-publishing-author" data-file-publishing><a href="'+escape(profile)+'">By '+escape(author.display_name)+'</a></span>');
 html=html.replace(/(<meta\s+name="author"\s+content=")[^"]*(")/gi,(_,a,b)=>a+escape(author.display_name)+b);
 const schemaAuthor={'@type':author.kind==='organization'?'Organization':'Person',name:author.display_name,url:'https://fromastoryteller.com'+profile};
 html=html.replace(/<script([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/gi,(full,attributes,text)=>{
  try{const data=JSON.parse(text);const visit=x=>{if(!x||typeof x!=='object')return;if(x.author)x.author=schemaAuthor;for(const v of Object.values(x))if(typeof v==='object')visit(v);};visit(data);return '<script'+attributes+'>'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>';}catch{return full;}
 });

 const canonical='https://fromastoryteller.com'+item.url;
 const schema={'@context':'https://schema.org','@type':item.content_type==='game'?'VideoGame':item.content_type==='tool'?'SoftwareApplication':item.content_type==='blog'?'BlogPosting':'Article',
  identifier:item.id,name:item.title,headline:item.title,description:item.summary,url:canonical,datePublished:item.published_at,dateModified:item.updated_at,
  author:schemaAuthor,publisher:{'@type':'Organization',name:'From A Storyteller',url:'https://fromastoryteller.com/'},
  ...(item.preview_image?{image:'https://fromastoryteller.com'+item.preview_image}:{})};
 const schemaScript='<script type="application/ld+json" data-file-schema>'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>';
 if(/<script type="application\/ld\+json" data-file-schema>[\s\S]*?<\/script>/.test(html))html=html.replace(/<script type="application\/ld\+json" data-file-schema>[\s\S]*?<\/script>/,()=>schemaScript);
 else html=html.replace('</head>',()=>schemaScript+'</head>');

 const social=(author.social_links??[]).filter(s=>{try{return new URL(s.url).protocol==='https:';}catch{return false;}}).map(s=>'<a href="'+escape(s.url)+'" target="_blank" rel="noopener noreferrer">'+escape(s.platform==='website'?'Website':s.platform)+'</a>').join(' ');
 if(social){const nav='<nav class="storyteller-socials file-publishing-socials" aria-label="Author social links">'+social+'</nav>';html=html.includes('<!--author-socials-->')?html.replace('<!--author-socials-->',()=>nav):html.replace('</main>',()=>nav+'</main>');}
 return html.replace('<body','<body data-content-id="'+escape(item.id)+'"');
}
export async function filePublishingResponse(request,env,response,fetcher=fetch){
 const html=await response.text();if(!html.includes('data-file-publishing')||new URL(request.url).origin!==PRODUCTION_ACCOUNT_ORIGIN)return new Response(request.method==='HEAD'?null:html,response);
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.delete('Content-Length');headers.delete('ETag');
 const unavailable=status=>{headers.set('X-Robots-Tag','noindex, nofollow');return new Response(request.method==='HEAD'?null:'This page is currently unavailable.',{status,headers});};
 try{
  const configResponse=await env.ASSETS.fetch(new Request(new URL('/account/runtime-config.json',request.url)));
  if(!configResponse.ok)return unavailable(503);const config=await configResponse.json();if(!isProductionAuthConfig(config))return unavailable(503);
  const result=await fetcher(PRODUCTION_AUTH_URL+'/rest/v1/rpc/fas_public_file_content',{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(5000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({content_path:new URL(request.url).pathname})});
  if(!result.ok)return unavailable(503);const item=await result.json();if(!item?.author)return unavailable(404);
  let rendered=renderFilePublishing(html,item);
  if(item.editorial_migrated){
   const story=item.editorial;if(!story||story.id!==item.id||!['story','blog'].includes(story.content_type))return unavailable(404);
   const image=story.cover?.asset_id?PRODUCTION_AUTH_URL+'/functions/v1/fas-story-image?asset_id='+encodeURIComponent(story.cover.asset_id):'';
   rendered=rendered.replace(/<article\b[^>]*class="story-page"[^>]*>[\s\S]*?<\/article>/,()=>storyPageMarkup({...story,image,image_alt:story.cover?.alt}));
   rendered=rendered.replace(/<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/gi,'').replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,'');
   rendered=renderReadingMetadata(rendered,story,image);
  }
  return new Response(request.method==='HEAD'?null:rendered,{status:response.status,headers});
 }catch{return unavailable(503);}
}

// The worker never forwards a reader session or uses a privileged key. Only the
// allowlisted published projection can populate crawler-visible metadata.
export async function readingResponse(request,env,fetcher=fetch){
 const url=new URL(request.url);
 const address=contentAddress(url.pathname),legacy=url.pathname==='/read/';
 if(!['GET','HEAD'].includes(request.method)||(!legacy&&!address))return env.ASSETS.fetch(request);
 // Existing file-backed stories retain their own pages and URLs.
 if(address){const staticPage=await env.ASSETS.fetch(new Request(request,{method:'GET'}));if(staticPage.status!==404)return staticPage.ok?filePublishingResponse(request,env,staticPage,fetcher):staticPage;}
 const shellUrl=new URL('/read/',url),response=await env.ASSETS.fetch(new Request(shellUrl));
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow');
 const fallbackBody=request.method==='HEAD'?null:response.clone().body;
 const fallback=status=>new Response(fallbackBody,{status:status??(address?404:response.status),headers});
 const slug=address?.slug??url.searchParams.get('story');
 if(!slug||!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)||legacy&&url.searchParams.getAll('story').length!==1)return fallback(404);
 if(url.origin!==PRODUCTION_ACCOUNT_ORIGIN)return fallback();
 try{
  const configResponse=await env.ASSETS.fetch(new Request(new URL('/account/runtime-config.json',url)));
  if(!configResponse.ok)return fallback();const config=await configResponse.json();if(!isProductionAuthConfig(config))return fallback();
  // Workers support manual/follow redirects; reject every 3xx via result.ok.
  const result=await fetcher(PRODUCTION_AUTH_URL+'/rest/v1/rpc/fas_public_story',{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(5000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({story_slug:slug})});
  if(!result.ok)return fallback(503);const story=await result.json();if(!story||address&&(story.content_type??'story')!==address.content_type)return fallback(404);
  const canonical=contentPath(story);if(!canonical)return fallback(404);
  if(legacy||url.pathname!==canonical){const destination=new URL(canonical,url);destination.search=url.search;destination.searchParams.delete('story');return new Response(null,{status:308,headers:{Location:destination.href,'Cache-Control':'no-store'}});}
  const image=story.cover?.asset_id?PRODUCTION_AUTH_URL+'/functions/v1/fas-story-image?asset_id='+encodeURIComponent(story.cover.asset_id):'';
  let html=renderReadingMetadata(await response.text(),story,image);html=html.replace(/<!--content-layout:start-->[\s\S]*?<!--content-layout:end-->/,()=>isInteractive(story.content_type)?interactivePageMarkup(story):storyPageMarkup({...story,image,image_alt:story.cover?.alt}));headers.delete('Content-Length');headers.delete('ETag');headers.set('X-Robots-Tag','index, follow');
  return new Response(request.method==='HEAD'?null:html,{status:200,headers});
 }catch{return fallback(503);}
}
export default {fetch:(request,env)=>readingResponse(request,env)};
