import {contentPath} from './content-address.mjs';
import {genreLabel} from './studio-catalog.mjs';
export function contentMetadata(story,imageUrl=''){
 const canonical='https://fromastoryteller.com'+contentPath(story);
 const description=story.summary.trim().replace(/\s+/g,' ').slice(0,160);
 return {title:`${story.title} | From A Storyteller`,description,canonical,language:story.language??'en',image:imageUrl,
  structured:{'@context':'https://schema.org','@type':story.content_type==='blog'?'BlogPosting':'Article',headline:story.title,description,url:canonical,
   inLanguage:story.language??'en',datePublished:story.published_at,dateModified:story.updated_at,
   author:{'@type':story.author?.kind==='organization'?'Organization':'Person',name:story.author?.display_name??'Storyteller',url:`https://fromastoryteller.com/storytellers/?author=${encodeURIComponent(story.author?.public_id??'')}`},
   publisher:{'@type':'Organization',name:'From A Storyteller',url:'https://fromastoryteller.com/'},
   articleSection:(story.genres??[]).map(genreLabel),keywords:(story.tags??[]).join(', '),...(imageUrl?{image:imageUrl}:{})}};
}
export function applyContentMetadata(document,metadata){
 document.title=metadata.title;document.documentElement.lang=metadata.language;
 const set=(selector,tag,attributes)=>{let element=document.head.querySelector(selector);if(!element){element=document.createElement(tag);document.head.append(element);}for(const [key,value]of Object.entries(attributes))element.setAttribute(key,value);};
 set('meta[name="description"]','meta',{name:'description',content:metadata.description});
 // The server-rendered route controls crawler indexing. The static fallback
 // remains noindex until the production server route is installed.
 set('link[rel="canonical"]','link',{rel:'canonical',href:metadata.canonical});
 for(const [property,content]of Object.entries({'og:type':'article','og:title':metadata.title,'og:description':metadata.description,'og:url':metadata.canonical,...(metadata.image?{'og:image':metadata.image}:{})}))set(`meta[property="${property}"]`,'meta',{property,content});
 for(const [name,content]of Object.entries({'twitter:card':'summary_large_image','twitter:title':metadata.title,'twitter:description':metadata.description,...(metadata.image?{'twitter:image':metadata.image}:{})}))set(`meta[name="${name}"]`,'meta',{name,content});
 let json=document.head.querySelector('script[data-community-schema]');if(!json){json=document.createElement('script');json.type='application/ld+json';json.setAttribute('data-community-schema','');document.head.append(json);}json.textContent=JSON.stringify(metadata.structured).replace(/</g,'\\u003c');
}
