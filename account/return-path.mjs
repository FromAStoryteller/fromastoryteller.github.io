// Return only to known local pages. Only a public profile author query is allowed.
// Never forward credentials, arbitrary query strings,
// callbacks, absolute URLs or another authentication page.
export function safeReturnPath(value){
 if(typeof value!=='string'||value.length>180)return null;
 if(/^\/storytellers\/(?:\?author=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})?$/i.test(value))return value;
 return /^(?:\/|\/account\/(?:following|saved|favourites|games|studio|settings|profile|agreements|admin)\/|\/(?:games|tools|stories|blog)\/(?:[a-z0-9][a-z0-9-]{0,119}\/)?)$/.test(value)?value:null;
}
export function returnPathFromSearch(search=''){
 if(typeof search!=='string'||search.length>1024)return null;
 const params=new URLSearchParams(search);return params.getAll('next').length===1?safeReturnPath(params.get('next')):null;
}
export function signInHref(path){const next=safeReturnPath(path);return '/account/sign-in/'+(next?'?next='+encodeURIComponent(next):'');}
