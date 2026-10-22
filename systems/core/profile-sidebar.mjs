// Presentation only. Account destinations retain their own session checks.
export function syncProfileSidebar(access,{document:d=document}={}){
 const nav=d.querySelector('.sidebar-nav');if(!nav)return;
 const link=(label,href,icon)=>{const a=d.createElement('a');a.className='sidebar-item';a.href=href;a.title=label;a.setAttribute('aria-label',label);const i=d.createElement('i');i.className='fa-solid '+icon;i.setAttribute('aria-hidden','true');const span=d.createElement('span');span.textContent=label;a.append(i,span);if(d.defaultView.location.pathname===href)a.setAttribute('aria-current','page');return a;};
 if(!nav.querySelector('a[href="/storytellers/"]'))nav.querySelector('.sidebar-section')?.append(link('Storytellers','/storytellers/','fa-users'));
 let section=nav.querySelector('[data-viewer-library]');
 if(!section){section=d.createElement('section');section.className='sidebar-section sidebar-library';section.dataset.viewerLibrary='';section.setAttribute('aria-label','Your library');section.append(link('Favourites','/account/favourites/','fa-star'),link('Saved for later','/account/saved/','fa-bookmark'));nav.append(section);}
 section.hidden=!access;
}
