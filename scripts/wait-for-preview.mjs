// Wait for the fixed local preview before browser checks navigate to it.
const origin='http://127.0.0.1:55410';
const deadline=Date.now()+30000;
let ready=false;
while(Date.now()<deadline){try{const response=await fetch(origin,{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
if(!ready)throw Error('Local preview did not become ready within 30 seconds. Inspect the Vite startup log.');
console.log('Local preview is ready.');
