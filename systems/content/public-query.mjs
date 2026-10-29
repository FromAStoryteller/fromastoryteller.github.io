import {publicStoryCard} from '../community/public-story-catalog.mjs';
export const remoteDiscovery=()=>typeof location!=='undefined'&&location.origin==='https://fromastoryteller.com';
import {parseDiscoveryQuery} from './public-query-options.mjs';
export {parseDiscoveryQuery};
export async function queryPublicContent(options={}, {signal,fetcher=fetch}={}){
 const params=new URLSearchParams();for(const [key,value]of Object.entries(options))if(value!==''&&value!==undefined&&value!==null)params.set(key,String(value));parseDiscoveryQuery(params);
 const response=await fetcher('/api/public/browse?'+params,{credentials:'omit',cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Published content could not load. Please try again.');const data=await response.json();
 if(!Array.isArray(data.items)||data.items.length>24||!Number.isInteger(data.total)||data.total<0||data.next_cursor&&(!Number.isInteger(data.next_cursor.offset)||data.next_cursor.offset<1||data.next_cursor.offset>50000))throw Error('Published content could not be read.');
 const convert=rows=>rows.map(row=>publicStoryCard(row,'https://vzdicnufhidelaoeqbza.supabase.co/functions/v1/fas-story-image')).filter(Boolean);
 return {...data,items:convert(data.items),featured:convert(data.featured??[]),facet_items:Array.isArray(data.facet_items)?data.facet_items:[]};
}
