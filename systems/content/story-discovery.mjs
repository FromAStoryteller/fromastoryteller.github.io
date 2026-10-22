import {genreLabel} from '../community/studio-catalog.mjs';
import {newestPublished} from './featured-selection.mjs';

export const storyGenres = item => [...new Set((item.genres?.length?item.genres:item.taxonomy?.genres??[]).map(genreLabel))];
export function discoverStories(items,{genre='',length='',sort='newest'}={}) {
  const result=items.filter(item => (!genre || storyGenres(item).includes(genre)) && (!length ||
    (length==='quick' && item.readingMinutes>0 && item.readingMinutes<5) ||
    (length==='medium' && item.readingMinutes>=5 && item.readingMinutes<=15) ||
    (length==='long' && item.readingMinutes>15)));
  const newest=newestPublished(result);
  if(sort==='oldest')return newest.reverse();
  if(sort==='title')return newest.sort((a,b)=>a.title.localeCompare(b.title));
  if(sort==='shortest'||sort==='longest')return newest.sort((a,b)=>{
    const left=Number(a.readingMinutes)||0,right=Number(b.readingMinutes)||0;
    if(!left||!right)return !left-!right;
    return sort==='shortest'?left-right:right-left;
  });
  return newest;
}
export function mountStoryDiscovery(host,items,onChange,{window:w=window}={}) {
  const d=host.ownerDocument,form=d.createElement('form'),params=new URL(w.location.href).searchParams;
  form.className='story-discovery';form.setAttribute('aria-label','Find a story');
  const controls={};
  const choices={genre:[['','All genres'],...[...new Set(items.flatMap(storyGenres))].sort().map(g=>[g,g])],length:[['','Any reading length'],['quick','Under 5 minutes'],['medium','5–15 minutes'],['long','Over 15 minutes']],sort:[['newest','Newest first'],['oldest','Oldest first'],['shortest','Shortest first'],['longest','Longest first'],['title','Title A–Z']]};
  for(const [key,title]of [['genre','Genre'],['length','Reading length'],['sort','Sort stories']]){
    const label=d.createElement('label');label.textContent=title;const select=d.createElement('select');select.name=key;
    for(const [value,text]of choices[key]){const option=d.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    if(choices[key].some(([value])=>value===params.get(key)))select.value=params.get(key);
    controls[key]=select;label.append(select);form.append(label);
  }
  const clear=d.createElement('button');clear.type='button';clear.className='content-filter';clear.textContent='Reset filters';form.append(clear);
  const status=d.createElement('p');status.className='story-discovery-status';status.setAttribute('role','status');
  function update(save=true){const state=Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value]));
    if(save){const url=new URL(w.location.href);for(const [key,value]of Object.entries(state)){if(value&&!(key==='sort'&&value==='newest'))url.searchParams.set(key,value);else url.searchParams.delete(key);}w.history.replaceState(w.history.state,'',url);}
    const result=discoverStories(items,state);status.textContent=`${result.length} ${result.length===1?'story':'stories'}${result.length!==items.length?' of '+items.length:''}.`;clear.disabled=!state.genre&&!state.length&&state.sort==='newest';onChange(result);
  }
  form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('change',()=>update());clear.addEventListener('click',()=>{controls.genre.value='';controls.length.value='';controls.sort.value='newest';update();});
  host.replaceChildren(form,status);update(false);
}
