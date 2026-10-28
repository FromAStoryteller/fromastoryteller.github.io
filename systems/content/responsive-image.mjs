import {imageVariants} from './image-variants.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function responsiveImage(src,alt='',{featured=false,sizes=featured?'(max-width: 64rem) 100vw, 1152px':'(max-width: 40rem) 100vw, (max-width: 64rem) 50vw, 384px',width=1600,height=900,deferred=false}={}){
 if(deferred){const html=responsiveImage(src,alt,{featured,sizes,width,height});return html.replace('<img ','<img aria-hidden="true" ').replace(/\bsrc=/g,'data-fas-src=').replace(/\bsrcset=/g,'data-fas-srcset=')+'<noscript>'+html.replace('<img ','<img style="position:absolute;inset:0" ')+'</noscript>';}
 const variants=imageVariants[src];
 const attributes=' alt="'+escape(alt)+'" width="'+width+'" height="'+height+'" decoding="async"'+(featured?' fetchpriority="high"':' loading="lazy"');
 if(variants){const sets=format=>variants[format].map(x=>escape(x.src)+' '+x.width+'w').join(', ');return '<picture><source type="image/avif" srcset="'+sets('avif')+'" sizes="'+escape(sizes)+'"><source type="image/webp" srcset="'+sets('webp')+'" sizes="'+escape(sizes)+'"><img src="'+escape(src)+'"'+attributes+'></picture>';}
 // The image gateway keeps caller-scoped visibility checks on every variant.
 try{const url=new URL(src);if(/^https:\/\/(?:vzdicnufhidelaoeqbza|oqmmvjjycpyxvxipcyli)\.supabase\.co$/.test(url.origin)&&url.pathname==='/functions/v1/fas-story-image'){
  const base=url.hostname==='vzdicnufhidelaoeqbza.supabase.co'?new URL('/api/public/image','https://fromastoryteller.com'):url;
  if(base!==url)base.searchParams.set('asset_id',url.searchParams.get('asset_id'));
  const set=[480,800,1200,1600,2400,3200].filter(w=>w<=width).map(w=>{const next=new URL(base);next.searchParams.set('width',String(w));return escape(next.href)+' '+w+'w';}).join(', ');
  return '<img src="'+escape(base===url?src:base.pathname+base.search)+'" srcset="'+set+'" sizes="'+escape(sizes)+'"'+attributes+'>';
 }}catch{}
 return '<img src="'+escape(src)+'"'+attributes+'>';
}
