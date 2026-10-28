// Read only the orientation tag. All source metadata is discarded when the
// corrected pixels are encoded; phone crop previews and saved pixels agree.
export function rasterOrientation(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 function tiff(start,end){
  if(start+8>end)return 1;const little=view.getUint16(start)===0x4949;
  if(!little&&view.getUint16(start)!==0x4d4d||view.getUint16(start+2,little)!==42)return 1;
  const offset=start+view.getUint32(start+4,little);if(offset+2>end)return 1;
  const count=Math.min(view.getUint16(offset,little),256);
  for(let i=0;i<count;i++){const p=offset+2+i*12;if(p+12>end)return 1;if(view.getUint16(p,little)===0x112&&view.getUint16(p+2,little)===3&&view.getUint32(p+4,little)===1){const value=view.getUint16(p+8,little);return value>=1&&value<=8?value:1;}}
  return 1;
 }
 try{
  if(bytes.length>4&&view.getUint16(0)===0xffd8){let p=2;while(p+4<=bytes.length){if(bytes[p++]!==255)return 1;while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===0xda||marker===0xd9)break;if(marker===1||marker>=0xd0&&marker<=0xd7)continue;const length=view.getUint16(p);if(length<2||p+length>bytes.length)return 1;if(marker===0xe1&&length>=8&&view.getUint32(p+2)===0x45786966&&view.getUint16(p+6)===0)return tiff(p+8,p+length);p+=length;}}
  if(bytes.length>8&&view.getUint32(0)===0x89504e47){let p=8;while(p+12<=bytes.length){const length=view.getUint32(p);if(p+12+length>bytes.length)return 1;if(view.getUint32(p+4)===0x65584966)return tiff(p+8,p+8+length);p+=length+12;}}
 }catch{}
 return 1;
}
export function orientImage(image,orientation,Image){
 if(orientation===1)return image;
 const w=image.width,h=image.height,result=new Image(orientation>=5?h:w,orientation>=5?w:h),from=image.bitmap,to=result.bitmap;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let dx=x,dy=y;
  if(orientation===2)dx=w-1-x;
  else if(orientation===3){dx=w-1-x;dy=h-1-y;}
  else if(orientation===4)dy=h-1-y;
  else if(orientation===5){dx=y;dy=x;}
  else if(orientation===6){dx=h-1-y;dy=x;}
  else if(orientation===7){dx=h-1-y;dy=w-1-x;}
  else if(orientation===8){dx=y;dy=w-1-x;}
  const a=(y*w+x)*4,b=(dy*result.width+dx)*4;to[b]=from[a];to[b+1]=from[a+1];to[b+2]=from[a+2];to[b+3]=from[a+3];
 }
 return result;
}
