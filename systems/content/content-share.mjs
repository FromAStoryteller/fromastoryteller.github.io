// Sharing is available to guests and never includes account or tracking parameters.
export function initContentShare({window:w=window,document:d=w.document}={}) {
  if(/^\/(account|tests)\//.test(w.location.pathname))return;
  let queued=false;const timers=new Set();
  function scan(){queued=false;
    for(const hero of d.querySelectorAll('main .story-header,main .game-hero,main .tool-hero,main .video-hero')){
      const row=hero.nextElementSibling;if(!row?.matches('.viewer-content-actions')||row.querySelector('[data-copy-link]'))continue;
      const path=hero.closest('[data-viewer-content-path]')?.dataset.viewerContentPath??w.location.pathname.replace(/index\.html$/,'');
      if(!/^\/(stories|games|tools|blog|videos)\/[a-z0-9][a-z0-9-]{0,119}\/$/.test(path))continue;
      const url=new URL(path,w.location.origin).href,title=hero.querySelector('h1')?.textContent??'this piece';
      const button=d.createElement('button');button.type='button';button.className='viewer-action content-copy-link';button.dataset.copyLink='';
      button.setAttribute('aria-label','Copy link to '+title);button.title='Copy link';
      const icon=d.createElement('i');icon.className='fa-solid fa-link';icon.setAttribute('aria-hidden','true');
      const label=d.createElement('span');label.textContent='Copy link';button.append(icon,label);
      const status=d.createElement('span');status.className='visually-hidden';status.setAttribute('role','status');row.append(button,status);
      let fallback,resetTimer;
      button.addEventListener('click',async()=>{
        button.disabled=true;label.textContent='Copy link';status.textContent='';if(resetTimer){w.clearTimeout(resetTimer);timers.delete(resetTimer);}
        try{if(!w.navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await w.navigator.clipboard.writeText(url);if(!button.isConnected)return;
          fallback?.remove();fallback=null;label.textContent='Link copied';status.textContent='Link copied.';
          const timer=resetTimer=w.setTimeout(()=>{timers.delete(timer);label.textContent='Copy link';status.textContent='';},2500);timers.add(timer);
        }catch{if(!button.isConnected)return;
          if(!fallback){fallback=d.createElement('div');fallback.className='content-copy-fallback';
            const prompt=d.createElement('label');prompt.textContent='Copy this link';const input=d.createElement('input');input.type='text';input.readOnly=true;input.value=url;prompt.append(input);
            const close=d.createElement('button');close.type='button';close.className='viewer-action';close.textContent='Close';close.addEventListener('click',()=>{fallback.remove();fallback=null;button.focus({preventScroll:true});});
            fallback.append(prompt,close);row.append(fallback);
          }
          status.textContent='Select and copy the link below.';const input=fallback.querySelector('input');input.focus({preventScroll:true});input.select();
        }finally{button.disabled=false;}
      });
    }
  }
  const schedule=()=>{if(!queued){queued=true;queueMicrotask(scan);}};
  const observer=new w.MutationObserver(schedule);observer.observe(d.querySelector('main')??d.body,{childList:true,subtree:true});scan();
  w.addEventListener('pagehide',()=>{observer.disconnect();for(const timer of timers)w.clearTimeout(timer);timers.clear();},{once:true});
}
