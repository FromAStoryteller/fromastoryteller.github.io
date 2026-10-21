import test from 'node:test';
import assert from 'node:assert/strict';
import {sortSeriesParts,seriesPartLabel,seriesPartState} from '../systems/community/series-editor.mjs';
test('series choices place drafts before nearest scheduled pieces and latest releases',()=>{
 const row=(key,status,dates)=>({key,title:key,status,...dates});
 const rows=[row('old','published',{published_at:'2026-01-01',updated_at:'2026-12-01'}),row('later','draft',{scheduled_at:'2026-12-03'}),row('draft-old','draft',{updated_at:'2026-01-01'}),row('new','published',{published_at:'2026-10-21'}),row('sooner','draft',{scheduled_at:'2026-12-01'}),row('draft-new','draft',{updated_at:'2026-10-21'})];
 assert.deepEqual(sortSeriesParts(rows).map(r=>r.key),['draft-new','draft-old','sooner','later','new','old']);
 assert.equal(rows[0].key,'old','sorting does not mutate the loaded catalogue');
 assert.equal(seriesPartState(rows[1]),'scheduled');
 assert.match(seriesPartLabel(rows[1]),/later — Scheduled for.*2026/);
 assert.match(seriesPartLabel(rows[2]),/Draft · updated.*2026/);
 assert.match(seriesPartLabel(rows[0]),/Published.*2026/);
 assert.equal(seriesPartLabel(row('undated','draft',{})),'undated — Draft');
});
