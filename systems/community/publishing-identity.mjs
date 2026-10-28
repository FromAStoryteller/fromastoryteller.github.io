import {loadAccountAuthConfig} from '../../account/auth-settings.mjs';
import {publicProfileUrl} from './profiles.mjs';
export const fileContentPath=value=>typeof value==='string'&&/^\/(stories|games|tools|blog|videos)\/[a-z0-9]+(-[a-z0-9]+)*\/$/.test(value)?value:null;
export function publishingName(identity,personalName,brand){return identity==='fas'?(brand?.display_name||'From A Storyteller'):personalName;}
let catalog;
export async function publicFileCatalog(){
 if(typeof location==='undefined')return [];
 return catalog??=(async()=>{try{
  const edge=location.origin==='https://fromastoryteller.com';
  const config=edge?{}:await loadAccountAuthConfig(location.origin);if(!config)return [];
  const response=await fetch(edge?'/api/public/files':config.url+'/rest/v1/rpc/fas_public_file_catalog',{method:edge?'GET':'POST',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000),headers:edge?{}:{apikey:config.key,'Content-Type':'application/json'},body:edge?undefined:'{}'});
  if(!response.ok)throw new Error();const rows=await response.json();return Array.isArray(rows)?rows.filter(r=>fileContentPath(r.url)&&(r.unavailable===true||publicProfileUrl(r.author?.public_id))):[];
 }catch{return [];}})();
}
