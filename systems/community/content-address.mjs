const collections={story:'stories',blog:'blog',game:'games',tool:'tools'};
export const contentPath=story=>/^[a-z0-9][a-z0-9-]{0,119}$/.test(story?.slug??'')&&collections[story.content_type??'story']?'/'+collections[story.content_type??'story']+'/'+story.slug+'/':null;
export function contentAddress(pathname){const match=/^\/(stories|blog|games|tools)\/([a-z0-9][a-z0-9-]{0,119})\/?$/.exec(pathname);return match?{slug:match[2],content_type:Object.keys(collections).find(k=>collections[k]===match[1])}:null;}
