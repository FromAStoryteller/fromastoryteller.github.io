import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGameFeatures,gameFeatureLabels,gameFeatureMarkup} from '../systems/content/game-features.mjs';
import {normalizeContentMeta,createCardMarkup,createFeaturedPanelMarkup,searchPublishedContent} from '../systems/content/content-system.js';
import {interactiveHeaderMarkup} from '../systems/content/page-layout.mjs';
import {publicStoryCard} from '../systems/community/public-story-catalog.mjs';
test('page details use one verified player-mode badge and do not invent capabilities for missing data',()=>{
 assert.deepEqual(gameFeatureLabels({saves:false,multiplayer:'off'}),['Single player']);for(const multiplayer of ['casual','realtime'])assert.deepEqual(gameFeatureLabels({saves:true,multiplayer}),['Multiplayer','Account saves']);
 for(const value of [null,{},'<script>',{saves:'true',multiplayer:'off'},{saves:true,multiplayer:'<script>'}]){assert.equal(normalizeGameFeatures(value),null);assert.equal(gameFeatureMarkup(value),'');}
 const item=normalizeContentMeta({id:'fixture',type:'game',category:'games',title:'Test game',card:{title:'Test game'},gameFeatures:{saves:true,multiplayer:'casual'}});for(const render of [createCardMarkup,createFeaturedPanelMarkup]){const html=render(item);assert.ok(!html.includes('content-game-features'));assert.ok(!html.includes('Account saves'));}const header=interactiveHeaderMarkup({...item,content_type:'game',genres:['arcade']});assert.match(header,/Multiplayer/);assert.ok(!header.includes('Account saves'));assert.match(header,/Arcade/);assert.equal(searchPublishedContent([item],'multiplayer').length,1);
 const story=normalizeContentMeta({...item,type:'story',category:'stories'});assert.equal(story.gameFeatures,null);assert.ok(!createCardMarkup(story).includes('content-game-features'));
});
test('community cards retain public game flags without retaining executable or private data',()=>{
 const row={id:'81000000-0000-0000-0000-000000000001',author:{public_id:'81000000-0000-0000-0000-000000000002',display_name:'Writer'},status:'published',slug:'fixture',title:'Fixture',summary:'A public game',content_type:'game',published_at:'2026-10-19T00:00:00Z',game_features:{saves:true,multiplayer:'realtime'},executable_package:{js:'private-source'},author_id:'private-account'};const card=publicStoryCard(row,'https://example.invalid');assert.deepEqual(card.gameFeatures,row.game_features);assert.ok(!JSON.stringify(card).includes('private-'));
});
