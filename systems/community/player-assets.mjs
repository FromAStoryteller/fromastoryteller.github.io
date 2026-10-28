// Used identically in the sandbox and exported projects. No host/network access.
function installAssets(embedded,names){
 const available=new Set(names),images=new Map();
 function canonical(value){const name=String(value).replace(/^\.\//,'').replace(/^assets\//,'');if(!available.has(name))throw Error('Missing asset: '+name+'. Check the exact path and filename case in your uploaded assets.');return name;}
 function asset(value){const name=canonical(value);return embedded?window.__fasAssets[name]:'assets/'+name.split('/').map(encodeURIComponent).join('/');}
 function image(value){const name=canonical(value);if(!/\.(png|jpe?g|webp|gif)$/i.test(name))return Promise.reject(Error('Choose an image asset: '+name));if(!images.has(name)){const pending=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{images.delete(name);reject(Error('Image could not load: '+name));};img.src=asset(name);});images.set(name,pending);}return images.get(name);}
 window.FAS=Object.freeze({...window.FAS,asset,image,preloadImages:async names=>Object.fromEntries(await Promise.all(names.map(async name=>[name,await image(name)])))});
}
export function assetRuntimeCode(embedded=false,names=[]){return '('+installAssets.toString()+')('+embedded+','+JSON.stringify(names).replace(/</g,'\\u003c')+');';}
