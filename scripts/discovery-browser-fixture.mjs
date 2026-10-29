import {readFileSync} from 'node:fs';
import {discoverContent} from '../systems/content/content-discovery.mjs';
import {relatedContent} from '../systems/content/related-content.mjs';
import {selectFeatured} from '../systems/content/featured-selection.mjs';
import {searchPublishedContent} from '../systems/content/content-system.js';
export const fileCards=JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url),'utf8'));
export function discoveryFixture(items=fileCards,options={}){
 let rows=discoverContent(items,options);if(options.q)rows=searchPublishedContent(rows,options.q);if(options.related)rows=relatedContent(items,items.find(i=>i.url===options.related),{limit:24});
 const convert=item=>({id:/^[a-f0-9-]{36}$/i.test(item.id)?item.id:'aa100000-0000-4000-8000-'+String(items.indexOf(item)+1).padStart(12,'0'),slug:item.slug,title:item.title,summary:item.description,content_type:item.type,status:'published',published_at:item.datePublished,updated_at:item.dateModified,subtype:item.subtype,genres:item.genres??[],tags:item.tags??[],reading_minutes:item.readingMinutes??0,author:{public_id:item.author||'aa000000-0000-4000-8000-000000000003',display_name:item.authorDisplay??'Writer'},preview_image:item.image?.src,preview_alt:item.image?.alt,game_features:item.gameFeatures});
 const offset=Number(options.offset)||0,limit=Number(options.limit)||24;
 return {items:rows.slice(offset,offset+limit).map(convert),next_cursor:rows.length>offset+limit?{offset:offset+limit}:null,total:rows.length,facet_items:items,featured:selectFeatured(items.filter(i=>!options.category||i.category===options.category)).slice(0,24).map(convert)};
}
