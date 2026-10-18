import {createProfileImageService,profileImageUrl} from './profile-image-service.mjs';
import {moveCoverCrop} from './studio-crop.mjs';
export function squareCrop(width,height,x=50,y=50){
 const size=Math.min(width,height);return {x:(width-size)*x/100,y:(height-size)*y/100,width:size,height:size,travelX:width-size,travelY:height-size};
}
export function mountProfileImage(root,client,{ownerId,imageBase,contributor,getName=()=>'',service=createProfileImageService(client,{ownerId}),onImage=()=>{}}={}){
 const d=root.ownerDocument,w=d.defaultView;
 let image=null,source=null,file=null,sourceURL,displayURL,controller,disposed=false,busy=false,generation=0,drag;
 root.innerHTML=`<h3>Profile image</h3><p class="profile-muted">${contributor?'Shown on your public storyteller page.':'Only you can see your image while your account is a viewer.'} Optional. JPEG or PNG up to 5 MiB and 8 million pixels. Images are saved as a square crop (512 × 512); upload another shape and move it to fit.</p>
 <div class="profile-image-current"><img data-current hidden alt=""><span data-empty>No profile image</span></div>
 <fieldset disabled class="profile-image-fields"><legend class="visually-hidden">Profile image controls</legend>
 <div class="account-field"><label for="profile-image-file">Choose an image</label><input id="profile-image-file" type="file" accept="image/jpeg,image/png"></div>
 <div data-crop hidden><canvas width="320" height="320" aria-label="Square profile crop preview"></canvas><p>Drag to position the image, or use these sliders.</p>
 <label for="profile-image-x">Horizontal focus</label><input id="profile-image-x" type="range" min="0" max="100" value="50">
 <label for="profile-image-y">Vertical focus</label><input id="profile-image-y" type="range" min="0" max="100" value="50"></div>
 <div class="account-field"><label for="profile-image-alt">Image description</label><input id="profile-image-alt" maxlength="500"><p class="password-guidance">Describe the image for people using screen readers. A description based on your display name is filled in automatically; you can improve it.</p></div>
 <div class="profile-image-actions"><button type="button" class="account-submit" data-upload disabled>Save image &amp; crop</button><button type="button" class="account-secondary" data-alt disabled>Save description</button><button type="button" class="account-secondary" data-remove disabled>Remove image</button></div>
 </fieldset><p role="status" aria-live="polite" data-status>Loading image…</p><button type="button" class="account-secondary" data-reload>Reload saved image</button>`;
 const $=s=>root.querySelector(s),fieldset=$('fieldset'),status=$('[data-status]'),alt=$('#profile-image-alt'),x=$('#profile-image-x'),y=$('#profile-image-y'),canvas=$('canvas');
 function update(){fieldset.disabled=busy||!image;$('[data-upload]').disabled=busy||!file||!source||!image;$('[data-alt]').disabled=busy||!image?.asset_id;$('[data-remove]').disabled=busy||!image?.asset_id;$('[data-reload]').disabled=busy;}
 function reset(){generation++;source=null;file=null;drag=null;if(sourceURL)URL.revokeObjectURL(sourceURL);sourceURL=null;$('#profile-image-file').value='';$('[data-crop]').hidden=true;x.value=y.value='50';}
 function draw(){
  if(!source)return;const crop=squareCrop(source.naturalWidth,source.naturalHeight,+x.value,+y.value);
  canvas.getContext('2d').drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,320,320);
  x.disabled=crop.travelX<.01;y.disabled=crop.travelY<.01;$('[data-crop]').hidden=false;
 }
 async function display(){
  controller?.abort();controller=new AbortController();const active=controller;
  if(displayURL)URL.revokeObjectURL(displayURL);displayURL=null;$('[data-current]').hidden=true;$('[data-current]').removeAttribute('src');$('[data-empty]').hidden=false;
  onImage(null);
  const url=profileImageUrl(image,imageBase);if(!url)return;
  try{
   const session=await client.auth.getSession();if(disposed||active.signal.aborted)return;
   const r=await w.fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.any([active.signal,AbortSignal.timeout(15000)]),headers:{Authorization:'Bearer '+session.data?.session?.access_token}});
   if(!r.ok)throw new Error();const blob=await r.blob();if(!['image/jpeg','image/png'].includes(blob.type)||blob.size>5242880)throw new Error();
   if(disposed||active.signal.aborted)return;
   displayURL=URL.createObjectURL(blob);const img=$('[data-current]');img.src=displayURL;img.alt=image.alt;img.hidden=false;$('[data-empty]').hidden=true;onImage({url:displayURL,alt:image.alt});
  }catch{if(!disposed&&!active.signal.aborted)status.textContent='Your image is saved, but its preview is unavailable. Reload to try again.';}
 }
 async function load(){if(busy||disposed)return;busy=true;update();status.textContent='Loading image…';try{const saved=await service.read();if(disposed)return;reset();image=saved;alt.value=saved.alt||('Profile image for '+(getName().trim()||'Storyteller'));status.textContent='';await display();}catch(e){if(!disposed)status.textContent=e.message;}finally{busy=false;if(!disposed)update();}}
 async function act(action){
  if(busy||!image||disposed)return;
  if(action==='remove'&&!w.confirm('Remove your profile image? The saved crop will be permanently deleted.'))return;
  if(action!=='remove'&&!alt.value.trim()){status.textContent='Add an image description.';alt.focus();return;}
  busy=true;update();status.textContent='Saving image…';
  try{
   let saved;
   if(action==='upload'){
    const crop=squareCrop(source.naturalWidth,source.naturalHeight,+x.value,+y.value),out=d.createElement('canvas');out.width=out.height=512;
    out.getContext('2d').drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,512,512);
    const blob=await new Promise(resolve=>out.toBlob(resolve,'image/jpeg',.9));if(!blob)throw new Error('The crop could not be prepared.');
    saved=await service.upload(new File([blob],'profile.jpg',{type:'image/jpeg'}),alt.value,{x:.5,y:.5},image.version);
   }else saved=await service.change(image.version,alt.value,action==='remove');
   if(disposed)return;image=saved;reset();alt.value=saved.alt||('Profile image for '+(getName().trim()||'Storyteller'));status.textContent=action==='remove'?'Profile image removed. Stored bytes are queued for cleanup.':'Profile image saved.';await display();
  }catch(e){if(!disposed)status.textContent=e.message;}
  finally{busy=false;if(!disposed)update();}
 }
 $('#profile-image-file').addEventListener('change',()=>{
  const selected=$('#profile-image-file').files[0];reset();if(!selected){update();return;}
  if(selected.size>5242880||!['image/jpeg','image/png'].includes(selected.type)){status.textContent='Choose a JPEG or PNG up to 5 MiB.';update();return;}
  if(!image?.asset_id&&(!alt.value||alt.value==='Profile image for Storyteller'))alt.value='Profile image for '+(getName().trim()||'Storyteller');
  sourceURL=URL.createObjectURL(selected);const next=new w.Image(),stamp=generation;
  next.onload=()=>{if(disposed||stamp!==generation)return;if(next.naturalWidth*next.naturalHeight>8000000){status.textContent='Choose an image with at most 8 million pixels.';update();return;}source=next;file=selected;draw();update();status.textContent='Adjust the square crop, then save your image.';};
  next.onerror=()=>{if(!disposed&&stamp===generation){status.textContent='This image could not be opened.';update();}};next.src=sourceURL;
 });
 for(const control of [x,y])control.addEventListener('input',draw);
 canvas.addEventListener('pointerdown',event=>{if(!source||busy)return;const box=canvas.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,fx:+x.value,fy:+y.value,width:box.width,height:box.height,crop:squareCrop(source.naturalWidth,source.naturalHeight,+x.value,+y.value)};canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener('pointermove',event=>{if(!drag||busy||event.pointerId!==drag.id)return;const next=moveCoverCrop(drag.crop,drag.fx,drag.fy,event.clientX-drag.x,event.clientY-drag.y,drag.width,drag.height);x.value=String(next.x);y.value=String(next.y);draw();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
 $('[data-upload]').addEventListener('click',()=>void act('upload'));$('[data-alt]').addEventListener('click',()=>void act('alt'));$('[data-remove]').addEventListener('click',()=>void act('remove'));$('[data-reload]').addEventListener('click',()=>void load());
 void load();
 return ()=>{disposed=true;reset();controller?.abort();if(displayURL)URL.revokeObjectURL(displayURL);root.replaceChildren();};
}
