export const contentPath=(story)=>{if(!/^[a-z0-9][a-z0-9-]{0,119}$/.test(story?.slug??''))return null;return '/'+(story.content_type==='blog'?'blog':'stories')+'/'+story.slug+'/';};
export function contentAddress(pathname){const match=/^\/(stories|blog)\/([a-z0-9][a-z0-9-]{0,119})\/?$/.exec(pathname);return match?{slug:match[2],content_type:match[1]==='blog'?'blog':'story'}:null;}
