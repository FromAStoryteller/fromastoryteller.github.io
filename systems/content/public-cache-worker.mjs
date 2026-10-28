import {isProductionAuthConfig,PRODUCTION_ACCOUNT_ORIGIN,PRODUCTION_AUTH_URL} from '../../account/auth-settings.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API='/api/public/';
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const unavailable=()=>new Response('Published content is temporarily unavailable.',{status:503,headers:noStore});
const exposed=(response,state,head=false)=>{
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-FAS-Public-Cache',state);headers.delete('Age');
 return new Response(head?null:response.body,{status:response.status,headers});
};
export function publicCatalogRequest(url){
 if(!url.pathname.startsWith(API))return null;
 if(url.pathname===API+'image'){
  const keys=[...url.searchParams.keys()],id=url.searchParams.get('asset_id'),width=Number(url.searchParams.get('width')??1600);
  if(keys.some(k=>!['asset_id','width'].includes(k))||new Set(keys).size!==keys.length||!UUID.test(id??'')||![480,800,1200,1600,2400,3200].includes(width))throw Error('Invalid public image');
  return {image:true,id,width};
 }
 if(url.pathname===API+'files'&&!url.search)return {rpc:'fas_public_file_catalog',args:{}};
 if(url.pathname!==API+'stories')throw Error('Unknown public endpoint');
 const keys=[...url.searchParams.keys()];
 if(keys.some(k=>!['before_time','after_id'].includes(k))||new Set(keys).size!==keys.length)throw Error('Invalid cursor');
 const before=url.searchParams.get('before_time'),after=url.searchParams.get('after_id');
 if((before===null)!==(after===null)||before!==null&&(!/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(before)||!Number.isFinite(Date.parse(before))||!UUID.test(after)))throw Error('Invalid cursor');
 return {rpc:'fas_public_story_catalog',args:{before_time:before,after_id:after}};
}
// Validate the public revision on EVERY hit. No TTL window can serve content
// after a committed withdrawal, role removal or account closure. Failure closes
// access rather than serving a stale cached manuscript. No reader credentials
// ever reach the anonymous RPCs or become part of shared responses.
export async function publicContentResponse(request,env,render,{fetcher=fetch,cache=globalThis.caches?.default}={}){
 const url=new URL(request.url);let catalog;
 try{catalog=publicCatalogRequest(url);}catch{return new Response('Invalid public request.',{status:400,headers:noStore});}
 if(!['GET','HEAD'].includes(request.method))return catalog?new Response(null,{status:405,headers:{...noStore,Allow:'GET, HEAD'}}):render(request,env,fetcher);
 if(url.origin!==PRODUCTION_ACCOUNT_ORIGIN)return catalog?new Response(null,{status:404,headers:noStore}):render(request,env,fetcher);
 const reading=url.pathname==='/read/'||/^\/(stories|blog|games|tools|videos)\/[a-z0-9-]+\/?$/.test(url.pathname);
 if(!catalog&&!reading)return render(request,env,fetcher);
 try{
  const configResponse=await env.ASSETS.fetch(new Request(new URL('/account/runtime-config.json',url)));
  if(!configResponse.ok)return catalog?unavailable():render(request,env,fetcher);
  const config=await configResponse.json();if(!isProductionAuthConfig(config))return catalog?unavailable():render(request,env,fetcher);
  const rpc=(name,args)=>fetcher(PRODUCTION_AUTH_URL+'/rest/v1/rpc/'+name,{method:'POST',credentials:'omit',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(5000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const [revisionResult,releaseResult]=await Promise.all([rpc('fas_public_content_revision',{}),env.ASSETS.fetch(new Request(new URL('/content/build-release.json',url)))]);
  if(!revisionResult.ok)throw Error('Revision unavailable');const revision=await revisionResult.json();if(!UUID.test(revision))throw Error('Invalid revision');
  const release=releaseResult.ok?(await releaseResult.json()).release:null;
  // A build namespace prevents HTML from an older deployment surviving a release.
  const useCache=cache&&/^[0-9a-f]{24}$/.test(release??'')&&!request.headers.has('Range');
  const keyUrl=new URL('/__fas-public-cache/'+release+'/'+revision+url.pathname,url);keyUrl.search=url.search;
  const key=new Request(keyUrl,{method:'GET'});
  if(useCache){try{const hit=await cache.match(key);if(hit)return exposed(hit,'HIT',request.method==='HEAD');}catch{/* A cache outage still permits a fresh public read. */}}
  const anonymous=new Request(url,{method:'GET'});
  let response=catalog?.image?await fetcher(PRODUCTION_AUTH_URL+'/functions/v1/fas-story-image?asset_id='+catalog.id+'&width='+catalog.width,{method:'GET',credentials:'omit',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'x-region':'ap-southeast-2'}}):catalog?await rpc(catalog.rpc,catalog.args):await render(anonymous,env,fetcher);
  if(catalog?.image){
   if(!response.ok)return new Response('Image unavailable.',{status:response.status===404?404:503,headers:noStore});
   if(response.headers.get('Content-Type')?.split(';')[0]!=='image/jpeg')return unavailable();
  }else if(catalog){if(!response.ok)return unavailable();const data=await response.json();response=Response.json(data,{headers:noStore});}
  if(useCache&&response.status===200&&!response.headers.has('Set-Cookie')){
   const stored=response.clone(),headers=new Headers(stored.headers);headers.set('Cache-Control','public, max-age=60');for(const name of ['CDN-Cache-Control','Cloudflare-CDN-Cache-Control','Surrogate-Control','Vary'])headers.delete(name);
   // Await the write so HEAD requests and cache failures cannot outlive this task.
   try{await cache.put(key,new Response(stored.body,{status:200,headers}));}catch{/* Cache writes must never fail a successful public page. */}
  }
  return exposed(response,'MISS',request.method==='HEAD');
 }catch{return unavailable();}
}
