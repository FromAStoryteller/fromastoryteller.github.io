// Only repository-authored wrappers are transformed here.
function closeElement(html,start,tag){const open=html.indexOf('>',start)+1,re=new RegExp('<\\/?'+tag+'\\b[^>]*>','g');re.lastIndex=open;let depth=1,m;while((m=re.exec(html))){depth+=m[0].startsWith('</')?-1:1;if(!depth)return {start,open,end:re.lastIndex,close:m.index};}throw Error('Unclosed '+tag);}
export function playerSlot(html,type){const start=html.indexOf('<div class="'+type+'-shell-main">');if(start<0)throw Error('Missing player slot');const range=closeElement(html,start,'div');return html.slice(start,range.end);}
function tidy(html,type){const slot=playerSlot(html,type);return html.replace(slot,'<!--fas-player-slot-->').replace(/[ \t]+$/gm,'').replace('<!--fas-player-slot-->',()=>slot);}
export function relocatePlayerInformation(html,type){
 if(html.includes('data-content-information'))return tidy(html,type);
 let panels='';const collect=source=>{let offset=0,start;while((start=source.indexOf('<div class="info-card">',offset))>=0){const range=closeElement(source,start,'div'),inner=source.slice(range.open,range.close);panels+='<details class="content-information-panel">'+inner.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/,(_,attrs,title)=>'<summary><h2'+attrs+'>'+title+'</h2></summary>')+'</details>';offset=range.end;}};
 const aside=new RegExp('<aside class="'+type+'-shell-sidebar"[^>]*>([\\s\\S]*?)<\\/aside>');html=html.replace(aside,(_all,inner)=>{collect(inner);return '';});
 const about=new RegExp('<section class="'+type+'-about-section"[^>]*>([\\s\\S]*?)<\\/section>');html=html.replace(about,(_all,inner)=>{collect(inner);return '';});
 const start=html.indexOf('<section class="'+type+'-play-section"');if(start<0||!panels)return html;const range=closeElement(html,start,'section');return tidy(html.slice(0,range.end)+'<section class="content-information" data-content-information aria-label="'+(type==='game'?'Game':'Tool')+' information">'+panels+'</section>'+html.slice(range.end),type);
}
