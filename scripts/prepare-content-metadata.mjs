// One-time reviewed migration of repository content to Studio metadata v1.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {GENRES,CONTENT_WARNINGS} from '../systems/community/studio-catalog.mjs';
const review={
'onto-the-stage':[['literary-fiction','contemporary-fiction'],[]],
'moon-hoc-meeting':[['science-fiction','humour'],['violence']],
 'the-deal':[['horror','dark-fantasy','supernatural'],['death-grief']],
'a-place-left-behind':[['literary-fiction','contemporary-fiction'],['death-grief']],
 'the-labyrinth':[['fantasy','dark-fantasy','adventure'],['violence','death-grief']],
'sunset-at-the-lighthouse':[['fantasy','romance'],[]],
'crypt-of-the-blood-jewel':[['fantasy','adventure','dark-fantasy'],['violence']],
'date-night-jigsaw':[['horror','mystery','psychological-thriller'],['violence','death-grief']],
 'tea-at-the-summit':[['literary-fiction','adventure'],['death-grief']],
'michaels-choice':[['literary-fiction','contemporary-fiction'],['violence','abuse','death-grief','self-harm','substance-use']],
'brick-blitz':[['arcade'],[]], 'rally-clash':[['arcade'],[]],
'genre-randomizer':[['writing-tool','creative-tool'],[]],'countdown':[['productivity'],[]]
};
const instructions={
'brick-blitz':'Use the on-screen menu to start, pause or restart. Move the paddle with the arrow keys, mouse or touch; keep the ball in play and clear the bricks. Sound is optional.',
'rally-clash':'Use the on-screen menu to start, pause or restart. Move your paddle with the arrow keys, mouse or touch. Return the ball against the computer; first to five points wins. Sound is optional.',
'genre-randomizer':'Select Generate genre to choose a writing prompt. Generate again for another genre; no account or saved data is required.',
'countdown':'Set the hours, minutes and seconds, then choose Start. Pause, resume or reset using the controls. The optional alarm sounds when the countdown finishes. Keep this tab open; background tabs may delay alerts.'
};
mkdirSync('assets/images/covers',{recursive:true});const browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.setContent('<html><body></body></html>');
try{for(const url of JSON.parse(readFileSync('content/content-index.json','utf8'))){const f=url.slice(1),m=JSON.parse(readFileSync(f,'utf8')),r=review[m.slug];if(!r)throw Error('Unreviewed '+m.slug);m.metadataVersion=1;m.genres=r[0];m.warningIds=r[1];m.warningReviewed=true;m.contentWarning=r[1].map(id=>CONTENT_WARNINGS.find(w=>w.id===id).label).join('; ');m.language='en';m.tags=m.taxonomy.tags;m.metadata=instructions[m.slug]?{instructions:instructions[m.slug]}:{};m.taxonomy.genres=m.genres.map(id=>GENRES.find(g=>g.id===id).label);m.dateModified='2026-10-19';
 const source=m.image.originalSrc??m.image.src;const data=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=1600;c.height=900;const scale=Math.max(1600/image.naturalWidth,900/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;c.getContext('2d').drawImage(image,(1600-width)/2,(900-height)/2,width,height);return c.toDataURL('image/jpeg',.9).split(',')[1];},'data:image/'+(source.endsWith('.png')?'png':'jpeg')+';base64,'+readFileSync('.'+source).toString('base64'));
 const cover='/assets/images/covers/'+m.slug+'.jpg';writeFileSync('.'+cover,Buffer.from(data,'base64'));m.image={...m.image,src:cover,originalSrc:source,width:1600,height:900};m.card.image=m.openGraph.image=m.twitter.image=cover;writeFileSync(f,JSON.stringify(m,null,2)+'\n');}
}finally{await browser.close();}console.log('Reviewed all 14 content records and generated 16:9 covers; originals preserved.');
