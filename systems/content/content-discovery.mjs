import {storyGenres} from './story-discovery.mjs';
import {newestPublished,contributorKey} from './featured-selection.mjs';

const label=value=>String(value).replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
const tags=item=>[...new Set([...(item.tags??[]),...(item.taxonomy?.tags??[]),...(item.card?.tags??[])])];
export function discoveryPlaceholder(items,{category=''}={}){
 const scope=items.filter(i=>!category||i.category===category),fields=[];
 if(!category)fields.push('Content type');
 if(scope.some(i=>i.subtype&&!['story','blog','game','tool','video','short-story'].includes(i.subtype)))fields.push(category==='tools'?'Tool type':category==='games'?'Game type':'Format');
 if(scope.some(i=>storyGenres(i).length)||category==='stories')fields.push(category==='tools'?'Purpose':'Genre');
 if(['stories','blog'].includes(category))fields.push('Reading length');
 if(category==='games'&&scope.some(i=>i.gameFeatures))fields.push('Players','Progress');
 if(['tools','videos','gallery','blog'].includes(category)&&scope.some(i=>tags(i).length))fields.push('Topic');
 fields.push(category==='stories'?'Sort stories':'Sort content');
 return '<form class="story-discovery" aria-label="Find content" aria-busy="true">'+fields.map(title=>'<label>'+title+'<select disabled aria-label="'+title+'"><option>Loading…</option></select></label>').join('')+'<button class="content-filter" type="button" disabled>Reset filters</button></form><p class="story-discovery-status" role="status">Loading published content.</p>';
}
export function discoverContent(items,state={},followed=new Set()) {
 const rows=newestPublished(items.filter(item=>(!state.category||item.category===state.category)&&(!state.subtype||item.subtype===state.subtype)&&(!state.genre||storyGenres(item).includes(state.genre))&&(!state.tag||tags(item).includes(state.tag))&&(!state.players||(state.players==='single'?item.gameFeatures?.multiplayer==='off':['casual','realtime'].includes(item.gameFeatures?.multiplayer)))&&(!state.saves||item.gameFeatures?.saves===true)&&(!state.length||(['stories','blog'].includes(item.category)&&((state.length==='quick'&&item.readingMinutes>0&&item.readingMinutes<5)||(state.length==='medium'&&item.readingMinutes>=5&&item.readingMinutes<=15)||(state.length==='long'&&item.readingMinutes>15))))));
 if(state.sort==='oldest')rows.reverse();
 if(state.sort==='title')rows.sort((a,b)=>a.title.localeCompare(b.title));
 if(['shortest','longest'].includes(state.sort))rows.sort((a,b)=>{const x=Number(a.readingMinutes)||0,y=Number(b.readingMinutes)||0;return !x||!y?!x-!y:state.sort==='shortest'?x-y:y-x;});
 // Stable partition keeps the chosen sort within each group.
 return followed.size?[...rows.filter(item=>followed.has(contributorKey(item))),...rows.filter(item=>!followed.has(contributorKey(item)))]:rows;
}

export function mountContentDiscovery(host,items,onChange,{category='',window:w=window,followed=new Set(),remote=false}={}) {
 const d=host.ownerDocument,params=new URL(w.location.href).searchParams,state=Object.fromEntries(['category','subtype','genre','tag','players','saves','length','sort'].map(k=>[k,params.get(k)??(k==='sort'?'newest':'')]));
 if(category)state.category=category;
 const form=d.createElement('form');form.className='story-discovery';form.setAttribute('aria-label','Find content');
 const status=d.createElement('p');status.className='story-discovery-status';status.setAttribute('role','status');host.replaceChildren(form,status);
 let controls={},reset;
 function build(){
  const active=category||state.category,scope=items.filter(i=>!active||i.category===active),choices={};
  const unique=values=>[...new Set(values.filter(Boolean))].sort().map(v=>[v,label(v)]);
  if(!category)choices.category=['Content type',[['','All content types'],...unique(items.map(i=>i.category))]];
  const subtypes=unique(scope.map(i=>i.subtype).filter(v=>!['story','blog','game','tool','video','short-story'].includes(v)));
  if(subtypes.length)choices.subtype=[active==='tools'?'Tool type':active==='games'?'Game type':'Format',[['','All formats'],...subtypes]];
  const genres=[...new Set(scope.flatMap(storyGenres))].sort();
  if(genres.length||active==='stories')choices.genre=[active==='tools'?'Purpose':'Genre',[['','All '+(active==='tools'?'purposes':'genres')],...genres.map(v=>[v,v])]];
  if(['stories','blog'].includes(active))choices.length=['Reading length',[['','Any reading length'],['quick','Under 5 minutes'],['medium','5-15 minutes'],['long','Over 15 minutes']]];
  if(active==='games'&&scope.some(i=>i.gameFeatures)){
   choices.players=['Players',[['','Any player mode'],['single','Single player'],['multi','Multiplayer']]];
   choices.saves=['Progress',[['','Any progress options'],['yes','Account saves']]];
  }
  if(['tools','videos','gallery','blog'].includes(active)){
   const values=[...new Set(scope.flatMap(tags))].sort();if(values.length)choices.tag=['Topic',[['','All topics'],...values.map(v=>[v,v])]];
  }
  choices.sort=[active==='stories'?'Sort stories':'Sort content',[['newest','Newest first'],['oldest','Oldest first'],...(['stories','blog'].includes(active)?[['shortest','Shortest first'],['longest','Longest first']]:[]),['title','Title A-Z']]];
  controls={};form.replaceChildren();
  for(const [key,[title,options]]of Object.entries(choices)){
   if(!options.some(([v])=>v===state[key]))state[key]=options[0][0];
   const field=d.createElement('label');field.textContent=title;const select=d.createElement('select');select.name=key;select.setAttribute('aria-label',title);
   for(const [value,text]of options){const option=d.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=state[key];field.append(select);form.append(field);controls[key]=select;
  }
  for(const key of Object.keys(state))if(!choices[key]&&key!=='category')state[key]='';
  reset=d.createElement('button');reset.type='button';reset.className='content-filter';reset.textContent='Reset filters';reset.addEventListener('click',()=>{for(const key of Object.keys(state))state[key]=key==='sort'?'newest':'';if(category)state.category=category;build();update();});form.append(reset);
 }
 function update(save=true){
  if(save){const url=new URL(w.location.href);for(const [key,value]of Object.entries(state)){if(value&&!(key==='sort'&&value==='newest')&&!(key==='category'&&category))url.searchParams.set(key,value);else url.searchParams.delete(key);}w.history.replaceState(w.history.state,'',url);}
  const rows=remote?[]:discoverContent(items,state,followed);if(!remote)status.textContent=`${rows.length} ${category==='stories'?(rows.length===1?'story':'stories'):(rows.length===1?'piece':'pieces')}${rows.length!==items.length?' of '+items.length:''}.`;
  reset.disabled=!Object.entries(state).some(([key,value])=>key==='sort'?value&&value!=='newest':key==='category'&&category?false:Boolean(value));onChange(rows,{...state});
 }
 form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('change',e=>{const key=e.target.name;if(!controls[key])return;state[key]=e.target.value;if(key==='category'){for(const field of ['subtype','genre','tag','players','saves','length'])state[field]='';build();controls.category?.focus();}update();});
 const pop=()=>{const query=new URL(w.location.href).searchParams;for(const key of Object.keys(state))state[key]=query.get(key)??(key==='sort'?'newest':'');if(category)state.category=category;build();update(false);};w.addEventListener('popstate',pop);w.addEventListener('pagehide',event=>{if(!event.persisted)w.removeEventListener('popstate',pop);});
 build();update(false);return {setItems(next){items=next;build();update(false);},setStatus(text){status.textContent=text;},setFollowed(ids){if(ids.size===followed.size&&[...ids].every(id=>followed.has(id)))return;followed=ids;update(false);},dispose(){w.removeEventListener('popstate',pop);}};
}
