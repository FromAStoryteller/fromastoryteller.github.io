// Off-screen and hidden images have no network URL until they approach the viewport.
export function activateImage(image){
 image.removeAttribute('aria-hidden');
 const picture=image.closest('picture');
 for(const source of picture?.querySelectorAll('source[data-fas-srcset]')??[]){source.srcset=source.dataset.fasSrcset;delete source.dataset.fasSrcset;}
 if(image.dataset.fasSrcset){image.srcset=image.dataset.fasSrcset;delete image.dataset.fasSrcset;}
 if(image.dataset.fasSrc){image.src=image.dataset.fasSrc;delete image.dataset.fasSrc;}
}
export function observeImages(root){
 root._fasImageObserver?.disconnect();
 const images=[...root.querySelectorAll('img[data-fas-src]')];
 const w=root.ownerDocument.defaultView;
 if(!w.IntersectionObserver){images.forEach(activateImage);return;}
 const observer=new w.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){activateImage(entry.target);observer.unobserve(entry.target);}},{rootMargin:'160px 0px'});
 images.forEach(image=>observer.observe(image));root._fasImageObserver=observer;
 if(!root._fasImageCleanup){root._fasImageCleanup=true;w.addEventListener('pagehide',()=>root._fasImageObserver?.disconnect(),{once:true});}
}
export function whenVisible(element,load){
 if(!element)return;
 const w=element.ownerDocument.defaultView;
 if(!w.IntersectionObserver)return load();
 return new Promise((resolve,reject)=>{const observer=new w.IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();Promise.resolve().then(load).then(resolve,reject);}},{rootMargin:'160px 0px'});observer.observe(element);w.addEventListener('pagehide',()=>{observer.disconnect();resolve();},{once:true});});
}
