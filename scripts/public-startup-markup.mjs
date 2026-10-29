import {buildSync,transformSync} from 'esbuild';
// Parse real import declarations; strings containing example code are not imports.
export function publicStartupMarkup(file,html,{resolve,source,mapping,imports=new Map()}){
 if(file.startsWith('account/')||!file.endsWith('.html'))return html;
 const entries=[...html.matchAll(/<script\b([^>]*)>/gi)].flatMap(([,attrs])=>{
  if(!/\btype\s*=\s*["']module["']/i.test(attrs))return [];
  const src=attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  const target=src&&resolve(file,src);return target?[target]:[];
 });
 const selected=new Set(),seen=new Set();
 const visit=entry=>{
  if(seen.has(entry)||!source.has(entry)||!/\.(?:m?js)$/.test(entry))return;seen.add(entry);
  if(!imports.has(entry)){
   const built=buildSync({stdin:{contents:source.get(entry).toString(),loader:'js'},bundle:false,write:false,format:'esm',metafile:true,logLevel:'silent'});
   imports.set(entry,Object.values(built.metafile.outputs).flatMap(o=>o.imports).filter(i=>i.kind==='import-statement').flatMap(i=>{const target=resolve(entry,i.path);return target?[target]:[];}));
  }
  for(const dep of imports.get(entry))if(/\.(?:m?js)$/.test(dep)){selected.add(dep);visit(dep);}
 };
 for(const entry of entries)visit(entry);
 // This dynamic entry is always required by production browse pages.
 if((file==='index.html'||/^(?:stories|games|tools|blog|videos|gallery)\/index\.html$/.test(file))&&source.has('systems/content/remote-discovery.mjs')){selected.add('systems/content/remote-discovery.mjs');visit('systems/content/remote-discovery.mjs');}
 const tags=[...selected].sort().map(dep=>'<link rel="modulepreload" fetchpriority="low" href="'+mapping.get('/'+dep)+'">');
 if(source.has('systems/content/discovery-startup.js')&&(file==='index.html'||/^(?:stories|games|tools|blog|videos|gallery|search)\/index\.html$/.test(file)))tags.unshift('<script data-fas-discovery-startup>'+transformSync(source.get('systems/content/discovery-startup.js').toString(),{loader:'js',minify:true,legalComments:'none',target:'es2022'}).code.replace(/<\/script/gi,'<\\/script')+'</script>');
 return tags.length?html.replace('</head>',tags.join('\n')+'\n</head>'):html;
}
