// One anonymous navigation request, consumed once by the normal discovery module.
// No persistent cache, account data or response survives a restored navigation.
(()=>{
 if(location.origin!=='https://fromastoryteller.com')return;
 const path=location.pathname.replace(/index\.html$/,''),categories={stories:'stories',games:'games',tools:'tools',blog:'blog',videos:'videos',gallery:'gallery'};
 const section=path.split('/')[1],search=path==='/search/';
 if(path!=='/'&&!search&&!(categories[section]&&path==='/'+section+'/'))return;
 const input=Object.fromEntries(new URL(location.href).searchParams),values={};
 if(search){const q=(input.q||'').trim();if(!q)return;values.q=q;values.limit=24;}
 else{for(const key of ['category','subtype','genre','tag','players','saves','length','sort'])if(input[key])values[key]=input[key];if(categories[section])values.category=categories[section];}
 values.offset=0;
 const params=new URLSearchParams(values),canonical=new URLSearchParams(params);canonical.sort();
 const key=Symbol.for('fas.public-discovery'),controller=new AbortController();
 const promise=fetch('/api/public/browse?'+params,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
 promise.catch(()=>{}); // The consumer handles errors; early navigation cannot create an unhandled rejection.
 const pending={key:canonical.toString(),controller,promise};globalThis[key]=pending;
 addEventListener('pagehide',()=>{controller.abort();if(globalThis[key]===pending)delete globalThis[key];},{once:true});
})();
