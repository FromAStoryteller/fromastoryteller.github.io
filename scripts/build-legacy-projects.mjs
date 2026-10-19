// Deterministic compatibility projects: editable JS/CSS, fixed platform DOM,
// local audio, and the pinned p5 dependency. No authenticated files are exported.
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {build,transform} from 'esbuild';
import {defaultGameSettings} from '../systems/community/game-contract.mjs';
function portableWav(source){
 if(source.length<=1048576)return source;
 if(source.toString('ascii',0,4)!=='RIFF')throw Error('Unsupported audio');
 let format,data;for(let pos=12;pos+8<=source.length;){const id=source.toString('ascii',pos,pos+4),size=source.readUInt32LE(pos+4);if(id==='fmt ')format=source.subarray(pos+8,pos+8+size);if(id==='data')data=source.subarray(pos+8,pos+8+size);pos+=8+size+(size%2);}
 if(!format||!data||format.readUInt16LE(0)!==1||format.readUInt16LE(14)!==16)throw Error('Unsupported PCM audio');
 const channels=format.readUInt16LE(2),rate=format.readUInt32LE(4),frames=Math.floor(data.length/(channels*2)),target=12000,count=Math.floor(frames*target/rate),out=Buffer.alloc(44+count*2);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(target,24);out.writeUInt32LE(target*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(count*2,40);
 const sample=i=>{let n=0;for(let c=0;c<channels;c++)n+=data.readInt16LE((Math.min(frames-1,i)*channels+c)*2);return n/channels;};
 for(let i=0;i<count;i++){const p=i*rate/target,a=Math.floor(p),fraction=p-a;out.writeInt16LE(Math.round(sample(a)*(1-fraction)+sample(a+1)*fraction),44+i*2);}return out;
}
// Plain text prevents development servers from rewriting the export dependency.
writeFileSync('assets/vendor/p5-1.9.0.runtime.txt',readFileSync('assets/vendor/p5-1.9.0.min.js'));
const defs={};mkdirSync('content/legacy-projects',{recursive:true});
for(const slug of ['brick-blitz','rally-clash','countdown','genre-randomizer']){
 const type=['brick-blitz','rally-clash'].includes(slug)?'game':'tool',folder=(type==='game'?'games/':'tools/')+slug,html=readFileSync(folder+'/index.html','utf8');
 const opening='<div class="'+type+'-shell-main">',start=html.indexOf(opening),end=html.indexOf('<aside class="'+type+'-shell-sidebar"',start);if(start<0||end<0)throw Error('Missing legacy player slot '+slug);
 defs[slug]=html.slice(start,end).trim().replace(/<\/div>\s*$/,'');
 let js;if(type==='game'){const result=await build({entryPoints:['sources/games/'+slug+'.mjs'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',legalComments:'none'});js=result.outputFiles[0].text;}else js=readFileSync(folder+'/tool.js','utf8');
 const assets=[];for(const match of [...js.matchAll(/["'](\/assets\/sounds\/[^"']+\.wav)["']/g)]){const url=match[1],name=slug+'-'+url.split('/').pop();if(!assets.some(a=>a.name===name))assets.push({name,type:'audio/wav',data:portableWav(readFileSync('.'+url)).toString('base64')});js=js.replaceAll(JSON.stringify(url),'FAS.asset('+JSON.stringify(name)+')');}
 const cssFiles=['css/foundations.css',...(type==='game'?['games/games.css','games/shared/menu/menu.css']:slug==='countdown'?['tools/countdown/tool.css']:[])];
 let css=cssFiles.map(f=>readFileSync(f,'utf8')).join('\n').replace(/@font-face\s*\{[^}]*\}/g,'');
 css+='\n.tool-widget{padding:1.5rem;border:1px solid var(--colour-border-default);border-radius:1rem;background:var(--colour-surface);color:var(--colour-text-primary)}.tool-widget-result{padding:1rem;font-size:1.5rem;text-align:center;background:var(--colour-surface-raised)}.tool-widget-actions{display:flex;gap:1rem;justify-content:center}.tool-button{padding:.75rem 1rem;min-height:44px;border:1px solid var(--colour-accent-primary);border-radius:.5rem;background:var(--colour-button-primary-background);color:var(--colour-button-primary-text);font:inherit}.tool-widget-title{text-align:center}html,body{margin:0;height:100%;overflow:auto}#fas-canvas{display:none!important}#fas-root{display:block;height:100%}#fas-ui{width:100%;position:relative;inset:auto;pointer-events:auto;min-height:100%;height:100%}.game-shell-main,.game-shell-frame{height:100%;width:100%}.game-canvas{width:100%;aspect-ratio:16/9}.tool-shell-main{max-width:60rem;margin:auto;padding:1rem}.fa-play:before{content:"▶"}.fa-pause:before{content:"Ⅱ"}.fa-stop:before{content:"■"}.fa-rotate-left:before{content:"↶"}';
 css=(await transform(css,{loader:'css',minify:true})).code;
 const p={version:1,orientation:'landscape',template:slug,settings:defaultGameSettings(),js,css,assets};if(Buffer.byteLength(js)>262144||Buffer.byteLength(css)>65536||Buffer.byteLength(JSON.stringify(p))>4194304)throw Error('Legacy project exceeds uploader limits: '+slug+' js='+Buffer.byteLength(js)+' css='+Buffer.byteLength(css)+' total='+Buffer.byteLength(JSON.stringify(p)));writeFileSync('content/legacy-projects/'+slug+'.json',JSON.stringify(p)+'\n');
}
writeFileSync('systems/community/legacy-templates.mjs','// Generated trusted DOM templates. Never sourced from creator uploads.\nexport const legacyTemplates='+JSON.stringify(defs)+';\nexport const legacyLicense='+JSON.stringify(readFileSync('assets/vendor/p5-LICENSE.txt','utf8'))+';\n');
console.log('Built four editable legacy projects and fixed compatibility templates.');
