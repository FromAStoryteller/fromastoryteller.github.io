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
// The worker never forwards a reader session or uses a privileged key. Only the
// allowlisted published projection can populate crawler-visible metadata.
export async function readingResponse(request,env,fetcher=fetch){
 const url=new URL(request.url);
 if(!['GET','HEAD'].includes(request.method)||url.origin!==PRODUCTION_ACCOUNT_ORIGIN||url.pathname!=='/read/')return env.ASSETS.fetch(request);
 const response=await env.ASSETS.fetch(new Request(url.href));
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow');
 const fallbackBody=request.method==='HEAD'?null:response.clone().body;
 const fallback=status=>new Response(fallbackBody,{status:status??response.status,headers});
 const slug=url.searchParams.get('story');if(!slug||!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)||url.searchParams.getAll('story').length!==1)return fallback(404);
 try{
  const configResponse=await env.ASSETS.fetch(new Request(new URL('/account/runtime-config.json',url)));
  if(!configResponse.ok)return fallback();const config=await configResponse.json();if(!isProductionAuthConfig(config))return fallback();
  const result=await fetcher(PRODUCTION_AUTH_URL+'/rest/v1/rpc/fas_public_story',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({story_slug:slug})});
  if(!result.ok)return fallback(503);const story=await result.json();if(!story)return fallback(404);
  const image=story.cover?.asset_id?PRODUCTION_AUTH_URL+'/functions/v1/fas-story-image?asset_id='+encodeURIComponent(story.cover.asset_id):'';
  const html=renderReadingMetadata(await response.text(),story,image);headers.delete('Content-Length');headers.delete('ETag');headers.set('X-Robots-Tag','index, follow');
  return new Response(request.method==='HEAD'?null:html,{status:200,headers});
 }catch{return fallback(503);}
}
export default {fetch:(request,env)=>readingResponse(request,env)};
