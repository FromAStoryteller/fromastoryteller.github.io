import {imageVariants} from './image-variants.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function responsiveImage(src,alt='',{featured=false,sizes=featured?'(max-width: 64rem) 100vw, 1152px':'(max-width: 40rem) 100vw, (max-width: 64rem) 50vw, 384px',width=1600,height=900}={}){
 const variants=imageVariants[src];
 const attributes=' alt="'+escape(alt)+'" width="'+width+'" height="'+height+'" decoding="async"'+(featured?' fetchpriority="high"':' loading="lazy"');
 if(variants){const sets=format=>variants[format].map(x=>escape(x.src)+' '+x.width+'w').join(', ');return '<picture><source type="image/avif" srcset="'+sets('avif')+'" sizes="'+escape(sizes)+'"><source type="image/webp" srcset="'+sets('webp')+'" sizes="'+escape(sizes)+'"><img src="'+escape(src)+'"'+attributes+'></picture>';}
 // The image gateway keeps caller-scoped visibility checks on every variant.
 try{const url=new URL(src);if(/^https:\/\/(?:vzdicnufhidelaoeqbza|oqmmvjjycpyxvxipcyli)\.supabase\.co$/.test(url.origin)&&url.pathname==='/functions/v1/fas-story-image'){
  const set=[480,800,1200,1600].map(w=>{const next=new URL(url);next.searchParams.set('width',String(w));return escape(next.href)+' '+w+'w';}).join(', ');
  return '<img src="'+escape(src)+'" srcset="'+set+'" sizes="'+escape(sizes)+'"'+attributes+'>';
 }}catch{}
 return '<img src="'+escape(src)+'"'+attributes+'>';
}
