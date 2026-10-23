// Shared by the early navigation hint and verified account navigation.
export function compactAccountNavigation(nav,{current}={}) {
 const d=nav.ownerDocument,links=[...nav.children],selected=links.find(a=>a.getAttribute('aria-current')==='page');
 const details=d.createElement('details');details.className='account-navigation-menu';const summary=d.createElement('summary');summary.textContent='Your account';summary.className='account-secondary';
 const list=d.createElement('div');list.className='account-navigation-list';list.append(...links);details.append(summary,list);
 const context=d.createElement('span');context.className='account-navigation-context';context.textContent=selected?.textContent??'Your profile and library';
 nav.replaceChildren(context,details);nav.classList.add('account-navigation--compact');
 details.addEventListener('keydown',e=>{if(e.key==='Escape'){details.open=false;summary.focus();}});
 // Focus leaving the navigation also closes the disclosure, without global listeners.
 nav.addEventListener('focusout',()=>queueMicrotask(()=>{if(!nav.contains(d.activeElement))details.open=false;}));
 return nav;
}
