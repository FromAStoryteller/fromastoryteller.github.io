// Return only to known local pages. Never forward credentials, query strings,
// callbacks, absolute URLs or another authentication page.
export function safeReturnPath(value){
 if(typeof value!=='string'||value.length>180)return null;
 return /^(?:\/|\/account\/(?:saved|favourites|games|studio|settings|profile|agreements|admin)\/|\/(?:games|tools|stories|blog)\/(?:[a-z0-9][a-z0-9-]{0,119}\/)?)$/.test(value)?value:null;
}
export function returnPathFromSearch(search=''){
 if(typeof search!=='string'||search.length>1024)return null;
 const params=new URLSearchParams(search);return params.getAll('next').length===1?safeReturnPath(params.get('next')):null;
}
export function signInHref(path){const next=safeReturnPath(path);return '/account/sign-in/'+(next?'?next='+encodeURIComponent(next):'');}
