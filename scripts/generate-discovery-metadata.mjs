// Companion to claiming file-backed content: only public card taxonomy/settings.
import {readFileSync,writeFileSync} from 'node:fs';
const items=JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url),'utf8')).map(item=>({url:item.url,subtype:item.subtype,genres:item.genres,tags:[...new Set([...(item.tags??[]),...(item.card?.tags??[])])],readingMinutes:item.readingMinutes,gameFeatures:item.gameFeatures,image:item.image?.src,imageAlt:item.image?.alt,imageWidth:item.image?.width,imageHeight:item.image?.height}));
const sql="update private.file_content f set discovery=entry-'url' from jsonb_array_elements($metadata$"+JSON.stringify(items)+"$metadata$::jsonb) entry where f.url=entry->>'url';\n";
writeFileSync(new URL('../supabase/ops/file-discovery-metadata.sql',import.meta.url),sql);
if(process.argv.includes('--seed-migration')){const file=new URL('../supabase/migrations/20261029053033_public_discovery_queries.sql',import.meta.url),text=readFileSync(file,'utf8');writeFileSync(file,text.includes('-- FILE_DISCOVERY_SEED')?text.replace('-- FILE_DISCOVERY_SEED',sql):text.replace(/update private.file_content f set discovery=entry-'url'[^\n]*;\n/,sql));}
