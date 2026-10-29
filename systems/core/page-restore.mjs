// Preserve the document/shell on Back without exposing an old private view.
// Each mounted controller registers its own next restore after fresh connection.
export function onPageRestore(w,restore,{hide}={}){
 let waiting=false,scrollY=0;
 const clean=()=>{w.removeEventListener('pagehide',leave);w.removeEventListener('pageshow',show);};
 const leave=event=>{if(!event.persisted){clean();return;}waiting=true;scrollY=w.scrollY;if(hide)hide.hidden=true;};
 const show=event=>{if(!event.persisted||!waiting)return;clean();let interacted=false;const interaction=()=>{interacted=true;};for(const name of ['pointerdown','wheel','keydown'])w.addEventListener(name,interaction,{passive:true});Promise.resolve().then(restore).catch(()=>{if(hide){hide.replaceChildren();const p=hide.ownerDocument.createElement('p');p.textContent='This page could not be refreshed. Please reload to continue.';hide.append(p);}}).finally(()=>{if(hide)hide.hidden=false;for(const name of ['pointerdown','wheel','keydown'])w.removeEventListener(name,interaction);if(!interacted)w.requestAnimationFrame(()=>w.scrollTo({top:scrollY,behavior:'instant'}));});};
 w.addEventListener('pagehide',leave);w.addEventListener('pageshow',show);return clean;
}
