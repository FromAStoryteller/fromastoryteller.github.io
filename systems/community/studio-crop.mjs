// Shared geometry keeps the visible crop and uploaded pixels identical.
const clamp=value=>Math.max(0,Math.min(100,value));
export function coverCrop(width,height,focusX=50,focusY=50){
 if(!(width>0&&height>0))throw new RangeError('Image dimensions must be positive.');
 const cropWidth=Math.min(width,height*16/9),cropHeight=cropWidth*9/16;
 return {x:(width-cropWidth)*clamp(focusX)/100,y:(height-cropHeight)*clamp(focusY)/100,width:cropWidth,height:cropHeight,travelX:Math.max(0,width-cropWidth),travelY:Math.max(0,height-cropHeight)};
}
export function moveCoverCrop(crop,focusX,focusY,deltaX,deltaY,displayWidth,displayHeight){
 return {x:clamp(focusX-(crop.travelX>0.01?deltaX*crop.width/displayWidth/crop.travelX*100:0)),y:clamp(focusY-(crop.travelY>0.01?deltaY*crop.height/displayHeight/crop.travelY*100:0))};
}
