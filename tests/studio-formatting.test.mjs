import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,plainDocument,documentText,refreshParagraphLayout} from '../systems/community/manuscript.mjs';
import {validateStory,publicationIssues} from '../systems/community/studio-service.mjs';
import {validateSocialLinks,GENRES} from '../systems/community/studio-catalog.mjs';
import {contentMetadata} from '../systems/community/content-metadata.mjs';
const draft={warning_reviewed:true,title:'A new piece',summary:'A description for readers.',body:'A paragraph.',genres:['fantasy'],tags:[],cover_asset_id:'81000000-0000-0000-0000-000000000001'};
test('manuscripts preserve supported emphasis, headings, quotes and scene breaks without accepting HTML',()=>{
 const doc=validateDocument({version:1,blocks:[{type:'paragraph',runs:[{text:'First',bold:true},{text:' words',italic:true}]},{type:'scene'},{type:'quote',text:'After the scene'}]});
 assert.equal(documentText(doc),'First words\n\n***\n\nAfter the scene');assert.equal(plainDocument('Before\n\n***\n\nAfter').blocks[1].type,'scene');
 for(const block of [{type:'html',text:'<script>'},{type:'paragraph',html:'<script>'},{type:'paragraph',runs:[{text:'Link',href:'javascript:alert(1)'}]}])assert.throws(()=>validateDocument({version:1,blocks:[block]}));
});
test('at most three catalog genres are accepted; custom tags are independent and bounded',()=>{
 assert.equal(validateStory({...draft,genres:['fantasy','dark-fantasy','horror'],tags:'Custom tag, Folklore'}).genres.length,3);
 assert.throws(()=>validateStory({...draft,genres:['fantasy','dark-fantasy','horror','mystery']}));assert.throws(()=>validateStory({...draft,genres:['not-in-catalog']}));assert.throws(()=>validateStory({...draft,genres:['fantasy','fantasy']}));
 assert.equal(new Set(GENRES.map(g=>g.id)).size,GENRES.length);
});
test('publication requires a real selected, verified 16:9 cover and complete metadata; drafts remain incomplete',()=>{
 assert.doesNotThrow(()=>validateStory({title:'An unfinished idea'}));assert.ok(publicationIssues(draft).includes('Choose a cover image'));
 const asset={id:draft.cover_asset_id,alt_text:'A landscape',pixel_width:1600,pixel_height:900,approved_at:'2026-10-17'};assert.deepEqual(publicationIssues(draft,[asset]),[]);
 assert.ok(publicationIssues(draft,[{...asset,pixel_height:1000}]).includes('Use a verified 16:9 cover'));assert.deepEqual(publicationIssues(draft,[{...asset,approved_at:null}]),[]);
});
test('social links reject script URLs, credential URLs, mismatched platforms and duplicates',()=>{
 assert.equal(validateSocialLinks([{platform:'instagram',url:'https://www.instagram.com/writer/'}]).length,1);
 for(const links of [[{platform:'website',url:'javascript:alert(1)'}],[{platform:'instagram',url:'https://example.com/'}],[{platform:'website',url:'https://user:secret@example.com/'}],[{platform:'website',url:'https://127.0.0.1/'}],[{platform:'x',url:'https://x.com/a'},{platform:'x',url:'https://x.com/b'}]])assert.throws(()=>validateSocialLinks(links));
});
test('SEO and social metadata derive from content without manual keyword or date fields',()=>{
 const result=contentMetadata({...draft,slug:'a-new-piece',content_type:'blog',language:'en',published_at:'2026-10-17',updated_at:'2026-10-17',author:{display_name:'A writer',public_id:'public-key'}},'https://example.com/cover.jpg');
 assert.equal(result.structured['@type'],'BlogPosting');assert.equal(result.canonical,'https://fromastoryteller.com/blog/a-new-piece/');assert.equal(result.structured.author.name,'A writer');assert.equal(result.structured.articleSection[0],'Fantasy');assert.equal(result.description,draft.summary);
});

test('standard paragraphs indent only after another nonempty paragraph, including live browser DIVs',()=>{const elements=[['P','Opening'],['P','Next paragraph'],['P',''],['P','After space'],['HR',''],['P','After scene'],['H2','Heading'],['P','After heading'],['DIV','Browser paragraph'],['DIV',''],['DIV','After blank browser paragraph']].map(([tagName,textContent])=>({tagName,textContent,dataset:{}}));refreshParagraphLayout({children:elements});assert.deepEqual(elements.map(e=>e.dataset.indent),['false','true','false','false','false','false','false','false','true','false','false']);});

test('public socials use only the five launch platforms and hide old website links',async()=>{const {SOCIAL_PLATFORMS,publicSocialLinks}=await import('../systems/community/studio-catalog.mjs');assert.deepEqual(SOCIAL_PLATFORMS.map(p=>p[0]),['instagram','facebook','tiktok','youtube','x']);assert.deepEqual(publicSocialLinks([{platform:'website',url:'https://example.com/'},{platform:'bluesky',url:'https://bsky.app/profile/fixture'},{platform:'instagram',url:'https://instagram.com/fixture'},{platform:'instagram',url:'https://instagram.com/duplicate'},{platform:'youtube',url:'https://evil.invalid/'}]),[{platform:'instagram',url:'https://instagram.com/fixture'}]);assert.throws(()=>validateSocialLinks([{platform:'website',url:'https://example.com/'}]));});

test('TikTok profile-path handles are accepted while authority credentials stay blocked',()=>{assert.deepEqual(validateSocialLinks([{platform:'tiktok',url:'https://www.tiktok.com/@fictional-writer'}]),[{platform:'tiktok',url:'https://www.tiktok.com/@fictional-writer'}]);assert.throws(()=>validateSocialLinks([{platform:'tiktok',url:'https://user:password@tiktok.com/@fictional-writer'}]));});
