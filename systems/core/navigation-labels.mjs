// A visible, keyboard-accessible label for the compact icon rail.
export function initNavigationLabels({document:d=document,window:w=window}={}) {
 const sidebar=d.querySelector('.sidebar');if(!sidebar)return;
 const tooltip=d.createElement('div');tooltip.className='sidebar-label-tooltip';tooltip.setAttribute('aria-hidden','true');tooltip.hidden=true;d.body.append(tooltip);
 let active=null,dismissed=null;
 function hide(){active=null;tooltip.hidden=true;}
 function show(link){if(!link||link===dismissed||sidebar.classList.contains('is-expanded')||w.matchMedia('(max-width: 64rem)').matches)return hide();
  active=link;tooltip.textContent=link.getAttribute('aria-label')||link.textContent.trim();tooltip.hidden=false;
  const rect=link.getBoundingClientRect();tooltip.style.left=(rect.right+10)+'px';tooltip.style.top=Math.max(8,Math.min(w.innerHeight-tooltip.offsetHeight-8,rect.top+(rect.height-tooltip.offsetHeight)/2))+'px';
 }
 function enter(event){const link=event.target.closest('.sidebar-item');if(link){if(link!==dismissed)dismissed=null;show(link);}}
 function leave(event){if(!event.target.closest('.sidebar-item')?.contains(event.relatedTarget)){dismissed=null;hide();}}
 sidebar.addEventListener('mouseover',enter);sidebar.addEventListener('focusin',enter);sidebar.addEventListener('mouseout',leave);sidebar.addEventListener('focusout',leave);
 d.addEventListener('keydown',event=>{if(event.key==='Escape'){dismissed=active;hide();}});d.addEventListener('fas-shell-open',hide);w.addEventListener('resize',hide);w.addEventListener('scroll',hide,{passive:true});sidebar.addEventListener('scroll',hide,{passive:true});
 w.addEventListener('pagehide',()=>tooltip.remove(),{once:true});
}
