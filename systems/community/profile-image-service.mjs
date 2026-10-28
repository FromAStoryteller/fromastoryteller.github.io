import {isPublicId,publicCoverUrl} from './profiles.mjs';
export function profileImageUrl(image,imageBase){
 const cover=publicCoverUrl(image,imageBase);return cover?cover.replace('/fas-story-image?','/fas-profile-image?'):'';
}
export function createProfileImageService(client,{ownerId}={}){
 async function authorize(){
  const refreshed=client.auth.refreshSession?await client.auth.refreshSession():null;
  if(refreshed?.error)throw new Error('Sign in again before changing your image.');
  const r=await client.auth.getUser(),user=r.data?.user;
  if(r.error||!isPublicId(user?.id)||user.is_anonymous||ownerId&&ownerId!==user.id)throw new Error('Your session changed. Reopen your profile before changing its image.');
  ownerId=user.id;
 }
 const read=async()=>{await authorize();const r=await client.rpc('fas_my_profile_image');if(r.error||!r.data?.version)throw new Error('Your image could not be loaded. Reload before editing.');return r.data;};
 return {read,
  async upload(file,alt,crop,version){
   await authorize();
   if(!isPublicId(version)||!file||file.size>5242880||!['image/jpeg','image/png'].includes(file.type)||!alt.trim()||[...alt].length>500)throw new Error('Choose a JPEG or PNG up to 5 MiB and add a description.');
   const body=new FormData();body.set('image',file);body.set('alt',alt.trim());body.set('expected_version',version);body.set('focus_x',String(crop.x));body.set('focus_y',String(crop.y));
   const r=await client.functions.invoke('fas-profile-upload',{body,region:'ap-southeast-2'});
   if(r.error||!r.data?.asset?.version)throw new Error('The image was not confirmed. Reload its saved state before retrying. Your saved image stays safe.');
   return r.data.asset;
  },
  async change(version,alt,remove=false){
   await authorize();const r=await client.rpc('fas_change_profile_image',{expected_version:version,image_alt:alt,remove_image:remove});
   if(r.error||!r.data?.version)throw new Error('The image changed or your session expired. Reload its saved state before trying again.');return r.data;
  }
 };
}
