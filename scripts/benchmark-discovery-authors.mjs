// Local, in-memory PostgreSQL only. No network or Supabase credentials.
import assert from 'node:assert/strict';
import {discoveryDatabase,publicQuery,optimization,rollback} from './discovery-author-fixture.mjs';
const db=await discoveryDatabase();
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
try{
 for(const [pieces,authors]of [[1000,10],[5000,100]]){
  await db.exec(`truncate public.stories cascade;
   insert into auth.users(id,email,email_confirmed_at)
    select md5('discovery-benchmark-'||i)::uuid,'benchmark-'||i||'@example.invalid',now() from generate_series(1,${authors})i on conflict do nothing;
   insert into public.user_roles(user_id,role)
    select md5('discovery-benchmark-'||i)::uuid,'member' from generate_series(1,${authors})i on conflict do nothing;
   -- Skip write-side audit/version work while seeding this disposable benchmark.
   -- Production queries, constraints, generated columns and permissions are real.
   alter table public.stories disable trigger user;
   insert into public.stories(author_id,slug,title,summary,body,status,published_at,genres,tags)
    select md5('discovery-benchmark-'||(1+(i%${authors})))::uuid,'benchmark-'||i,'Benchmark story '||i,
     'Public summary',repeat('word ',1000),'published',now()-i*interval '1 minute',array['fantasy'],array['benchmark']
    from generate_series(1,${pieces})i;
   alter table public.stories enable trigger user;analyze public.stories;`);
  for(const options of [{limit:24},{q:'Benchmark story 999',limit:24},{genre:'Fantasy',limit:24},{related:'/stories/benchmark-1/',limit:6},{offset:pieces-24,limit:24}]){
   const outputs=[],medians=[];
   for(const sql of [rollback,optimization]){
    await db.exec(sql);await publicQuery(db,options); // Warm the plan first.
    const times=[];
    for(let repeat=0;repeat<3;repeat++){
     const start=performance.now(),output=await publicQuery(db,options);
     times.push(performance.now()-start);outputs.push(output);
    }
    medians.push(median(times));
   }
   for(const output of outputs)assert.deepEqual(output,outputs[0]);
   console.log(JSON.stringify({pieces,authors,options,beforeMs:Math.round(medians[0]),afterMs:Math.round(medians[1]),improvementPercent:Math.round(100*(1-medians[1]/medians[0])),identicalOutput:true}));
  }
 }
}finally{await db.close();}
