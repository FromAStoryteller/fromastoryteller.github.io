export const derivativeWidths=[480,800,1200,1600,2400];
// Run once in the contributor's browser, never in a page-view Edge isolate.
export async function createCoverDerivatives(file,focus,{decode=globalThis.createImageBitmap,document=globalThis.document}={}){
 if(!decode||!document)return [];
 const image=await decode(file);
 try{
  let width=image.width,height=image.height;if(width/height>16/9)width=Math.floor(height*16/9);else height=Math.floor(width*9/16);
  const crop={width,height,x:Math.floor((image.width-width)*focus.x),y:Math.floor((image.height-height)*focus.y)};
  const master=crop.width>=3200&&crop.height>=1800?3200:crop.width>=2400&&crop.height>=1350?2400:1600;
  const variants=[];
  for(const width of derivativeWidths.filter(w=>w<master)){
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=width*9/16;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,width,width*9/16);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
   if(blob?.type==='image/jpeg'&&blob.size<=1048576)variants.push({width,blob});
   canvas.width=canvas.height=1;
  }
  return variants;
 }finally{image.close?.();}
}
