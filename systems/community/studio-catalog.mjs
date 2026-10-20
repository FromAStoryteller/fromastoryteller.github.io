// Stable IDs are stored; labels can evolve without changing saved work.
export const GENRE_GROUPS = {
  Games:['Arcade','Action','Puzzle','Strategy','Simulation'],
  Tools:['Creative tool','Writing tool','Productivity'],
  Fantasy: ['Fantasy','High fantasy','Low fantasy','Dark fantasy','Urban fantasy','Fairy tale','Magical realism'],
  'Science fiction': ['Science fiction','Cyberpunk','Dystopian','Artificial intelligence','Time travel','Space opera'],
  'Mystery & suspense': ['Mystery','Crime','Thriller','Psychological thriller','Cosy mystery'],
  'Horror & supernatural': ['Horror','Gothic','Supernatural','Cosmic horror'],
  'People & history': ['Literary fiction','Contemporary fiction','Historical fiction','Romance','Adventure','Humour','Young adult','Children’s fiction'],
  'Blog & nonfiction': ['Writing craft','Behind the story','Personal essay','Creative process','Books & reading','Worldbuilding','Site news'],
};
export const genreKey = label => label.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const GENRES = Object.entries(GENRE_GROUPS).flatMap(([parent,labels])=>labels.map(label=>({id:genreKey(label),label,parent})));
export const genreLabel = id => GENRES.find(row=>row.id===id)?.label ?? id;
export const SUGGESTED_TAGS = ['Atmospheric','Found family','Folklore','Friendship','Hope','Loss','Magic','Memory','Mystery','Nature','Quiet moments','Robots','Survival','Technology','Writing advice','Worldbuilding'];
export const CONTENT_TYPES = [
 {id:'story',label:'Story',enabled:true,metadata_version:1,required_fields:['title','summary','body','genres','cover','warnings'],metadata_fields:[],genre_ids:GENRES.filter(g=>g.parent!=='Blog & nonfiction').map(g=>g.id)},
 {id:'blog',label:'Blog post',enabled:true,metadata_version:1,required_fields:['title','summary','body','genres','cover','warnings'],metadata_fields:[],genre_ids:GENRES.map(g=>g.id)},
 ...['game','tool'].map(id=>({id,label:id[0].toUpperCase()+id.slice(1),enabled:true,metadata_version:1,required_fields:['title','summary','genres','cover','warnings'],metadata_fields:[{key:'instructions',label:'Controls and instructions',type:'text',required:true,max_length:2000}],genre_ids:GENRES.filter(g=>['Games','Tools','Blog & nonfiction'].includes(g.parent)).map(g=>g.id)})),{id:'video',label:'Video',enabled:false,metadata_version:1,required_fields:[],metadata_fields:[],genre_ids:[]}];
export const CONTENT_WARNINGS = ['Violence','Graphic violence / gore','Death or grief','Abuse','Sexual content','Strong language','Self-harm or suicide themes','Discrimination','Substance use','Flashing lights'].map((label,i)=>({id:['violence','graphic-violence','death-grief','abuse','sexual-content','strong-language','self-harm','discrimination','substance-use','flashing-lights'][i],label,active:true}));
export function metadataIssues(input,type){
 const issues=[];
 for(const f of type?.metadata_fields??[]){const value=input.metadata?.[f.key];if(f.required&&(value==null||value===''))issues.push('Add '+f.label);else if(value!=null&&value!==''&&((f.type==='integer'&&(!Number.isInteger(value)||value<(f.min??-2147483648)||value>(f.max??2147483647)))||(f.type==='select'&&!f.options.includes(value))||(f.type==='text'&&(typeof value!=='string'||value.length>(f.max_length??1000)))))issues.push('Check '+f.label);}
 return issues;
}
export const SCENE_STYLES = [{id:'space',label:'Space only (no ornament)'},{id:'dots',label:'Three dots'},{id:'diamond',label:'Diamond'},{id:'rule',label:'Fine rule'}];
export const SOCIAL_PLATFORMS = [
 ['instagram','Instagram',['instagram.com']],['facebook','Facebook',['facebook.com']],
 ['tiktok','TikTok',['tiktok.com']],['youtube','YouTube',['youtube.com','youtu.be']],['x','X',['x.com','twitter.com']],
];
export const socialLabel=key=>SOCIAL_PLATFORMS.find(row=>row[0]===key)?.[1]??'';
export function publicSocialLinks(links=[]){
 const result=[],seen=new Set();for(const link of Array.isArray(links)?links:[]){try{const [safe]=validateSocialLinks([link]);if(!seen.has(safe.platform)){seen.add(safe.platform);result.push(safe);}}catch{}}return result;
}
export function validateSocialLinks(links) {
  if(!Array.isArray(links)||links.length>SOCIAL_PLATFORMS.length)throw new Error('Use one link for each supported social platform.');
  const seen=new Set();
  return links.map(link=>{
    const platform=SOCIAL_PLATFORMS.find(row=>row[0]===link?.platform);
    if(!platform||typeof link.url!=='string'||link.url.length>500||seen.has(link.platform))throw new Error('Use one valid link per platform.');
    let url;try{url=new URL(link.url);}catch{throw new Error('Enter a complete https:// link.');}
    const host=url.hostname.replace(/^www\./,'').toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||url.port||!host.includes('.')||/^(localhost|127\.|10\.|192\.168\.|\[)/.test(host)||platform[2]&&!platform[2].includes(host))throw new Error(`Use a valid HTTPS ${platform[1]} link.`);
    seen.add(link.platform);url.hash='';return {platform:link.platform,url:url.href};
  });
}
