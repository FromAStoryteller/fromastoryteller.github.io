const clean=value=>String(value??'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const family=value=>{const v=clean(value);if(/fantasy|fairy-tale|magical-realism/.test(v))return 'fantasy';if(/science-fiction|sci-fi|cyberpunk|dystopian|space-opera|time-travel|artificial-intelligence/.test(v))return 'science-fiction';if(/horror|supernatural|gothic|occult/.test(v))return 'horror';if(/mystery|thriller|crime|suspense/.test(v))return 'mystery';return v;};
const genres=item=>[...(item.genres??[]),...(item.taxonomy?.genres??[])].map(family).filter(Boolean);
export function relatedContent(items,current,{limit=6}={}){
 if(!current)return [];
 const type=current.type??current.content_type,category=current.category,own=new Set(genres(current));
 return items.filter(item=>item.status==='published'&&!item.draft&&item.id!==current.id&&item.url!==current.url)
 .map(item=>({item,sameType:type?(item.type??item.content_type)===type:item.category===category,match:genres(item).some(g=>own.has(g))?1:0})).sort((a,b)=>Number(b.sameType)-Number(a.sameType)||(a.sameType&&b.sameType?b.match-a.match:0)||(Date.parse(b.item.datePublished??b.item.published_at)||0)-(Date.parse(a.item.datePublished??a.item.published_at)||0)||String(a.item.id).localeCompare(String(b.item.id))).slice(0,limit).map(x=>x.item);
}
