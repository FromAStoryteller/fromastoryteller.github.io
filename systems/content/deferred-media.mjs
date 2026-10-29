// One viewport observer also watches cards added later by profiles, collections and search.
export function activateImage(image){
 image.removeAttribute('aria-hidden');
 const picture=image.closest('picture');
 for(const source of picture?.querySelectorAll('source[data-fas-srcset]')??[]){source.srcset=source.dataset.fasSrcset;delete source.dataset.fasSrcset;}
 if(image.dataset.fasSrcset){image.srcset=image.dataset.fasSrcset;delete image.dataset.fasSrcset;}
 if(image.dataset.fasSrc){image.src=image.dataset.fasSrc;delete image.dataset.fasSrc;}
}
export function observeImages(root){
 const d=root.ownerDocument,w=d.defaultView,body=d.body??root;
 if(body._fasMediaController){body._fasMediaController.scan(root);return;}
 let ended=false;
 const observer=w.IntersectionObserver?new w.IntersectionObserver(entries=>{if(ended)return;for(const entry of entries)if(entry.isIntersecting){activateImage(entry.target);observer.unobserve(entry.target);}},{rootMargin:'160px 0px'}):null;
 const scan=node=>{
  if(ended||!node.isConnected||node.ownerDocument!==d)return;
  const images=[...(node.matches?.('img[data-fas-src]')?[node]:[]),...node.querySelectorAll?.('img[data-fas-src]')??[]];
  for(const image of images)if(observer)observer.observe(image);else activateImage(image);
 };
 const forget=node=>{for(const image of [...(node.matches?.('img')?[node]:[]),...node.querySelectorAll?.('img')??[]])observer?.unobserve(image);};
 const changes=new w.MutationObserver(records=>{if(ended)return;for(const record of records)for(const node of record.removedNodes)forget(node);for(const record of records)for(const node of record.addedNodes)scan(node);});
 changes.observe(body,{childList:true,subtree:true});
 body._fasMediaController={scan,dispose(){ended=true;observer?.disconnect();changes.disconnect();body._fasMediaController=null;}};
 if(!body._fasMediaLifecycle){body._fasMediaLifecycle=true;w.addEventListener('pagehide',()=>body._fasMediaController?.dispose());w.addEventListener('pageshow',event=>{if(event.persisted)observeImages(body);});}
 scan(root);
}
export function whenVisible(element,load){
 if(!element)return;
 const w=element.ownerDocument.defaultView;
 if(!w.IntersectionObserver)return load();
 return new Promise((resolve,reject)=>{let started=false;const clean=()=>{observer.disconnect();w.removeEventListener('pagehide',leave);w.removeEventListener('pageshow',resume);};const observer=new w.IntersectionObserver(entries=>{if(!started&&entries.some(e=>e.isIntersecting)){started=true;clean();Promise.resolve().then(load).then(resolve,reject);}},{rootMargin:'160px 0px'});const leave=event=>{observer.disconnect();if(!event.persisted){clean();resolve();}};const resume=event=>{if(event.persisted&&!started)observer.observe(element);};observer.observe(element);w.addEventListener('pagehide',leave);w.addEventListener('pageshow',resume);});
}
