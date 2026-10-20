// Per-history-entry navigation state only: no saved choices or account data.
const KEY='fas-browse-v1';
export function createBrowseHistory(snapshot=()=>({}),{window:w=window,document:d=w.document}={}) {
  const path=()=>w.location.pathname+w.location.search;
  let saved;try{const value=w.history.state?.[KEY];if(value?.path===path()&&Number.isFinite(value.y)&&value.y>=0)saved=value;}catch{}
  let ready=false,interacted=false,disposed=false;
  const interact=()=>{interacted=true;};
  function remember(){
    if(!ready||disposed)return;
    try{const value=snapshot(),state={path:path(),y:Math.max(0,w.scrollY)};
      if(typeof value.filter==='string'&&value.filter.length<=120)state.filter=value.filter;
      if(Number.isInteger(value.pages)&&value.pages>0)state.pages=Math.min(50,value.pages);
      w.history.replaceState({...w.history.state,[KEY]:state},'');
    }catch{}
  }
  const click=event=>{if(event.target.closest?.('a[href]'))remember();};
  for(const name of ['pointerdown','touchstart','wheel','keydown'])d.addEventListener(name,interact,{passive:true});
  d.addEventListener('click',click,true);w.addEventListener('pagehide',remember);
  return {state:saved,remember,restore(){ready=true;if(!saved)return;const target=saved;
    w.requestAnimationFrame(()=>w.requestAnimationFrame(()=>{if(!disposed&&!interacted&&target.path===path())w.scrollTo({top:target.y,behavior:'instant'});}));
  },clear(){saved=null;ready=false;try{const state={...w.history.state};delete state[KEY];w.history.replaceState(state,'');}catch{};},dispose(){disposed=true;
    for(const name of ['pointerdown','touchstart','wheel','keydown'])d.removeEventListener(name,interact);
    d.removeEventListener('click',click,true);w.removeEventListener('pagehide',remember);
  }};
}
