const {PGlite}=require('@electric-sql/pglite');const fs=require('fs');const assert=require('assert/strict');
(async()=>{const db=new PGlite();let count=0;
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`);
const root=require('path').resolve(__dirname,'..');const install=fs.readFileSync(root+'/Database/00_P126_Install.sql','utf8');await db.exec(install);await db.exec(install);count++;
const users=['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003'];for(const u of users)await db.query('INSERT INTO auth.users VALUES($1)',[u]);
async function call(i,action,d={}){await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[users[i]||'']);await db.exec('SET ROLE authenticated');try{return (await db.query('SELECT public."P126Action"($1,$2::jsonb) AS result',[action,JSON.stringify(d)])).rows[0].result;}finally{await db.exec('RESET ROLE');}}
async function ok(fn){await fn();count++;}async function fails(fn){await assert.rejects(fn);count++;}
for(let i=0;i<3;i++){await call(i,'bootstrap');await call(i,'profile',{name:['老師','學生甲','學生乙'][i],department:'經管',identity:i?'student':'teacher'});}
const slot={Day:1,Period:2,Kind:'course',Title:'秘密課名',Room:'秘密教室'};
await ok(()=>call(1,'save_timetable',{revision:0,slots:[slot],confirmed:true}));
await fails(()=>call(1,'save_timetable',{revision:0,slots:[],confirmed:true}));
await fails(()=>call(1,'save_timetable',{revision:1,slots:[slot,slot],confirmed:true}));
assert.equal((await call(1,'state')).slots.length,1);count++;
await fails(()=>call(1,'save_timetable',{revision:1,slots:[{...slot,Day:7}],confirmed:true}));
const g=(await call(0,'create_group',{name:'實驗室'})).group_id;
await fails(()=>call(1,'members',{group_id:g}));await fails(()=>call(0,'compare',{user_ids:[users[1]]}));await fails(()=>call(0,'compare',{user_ids:[null]}));
const code=(await call(0,'invite',{group_id:g})).code;await call(1,'join',{code});await call(1,'join',{code});
assert.equal((await call(0,'members',{group_id:g})).length,2);count++;
let cmp=await call(0,'compare',{user_ids:[users[0],users[1]]});assert.equal(cmp.find(x=>x.UserID===users[1]).Slots[0].Title,null);count++;
await call(1,'share',{group_id:g,share:true});cmp=await call(0,'compare',{user_ids:[users[1]]});assert.equal(cmp[0].Slots[0].Title,'秘密課名');count++;
await fails(()=>call(1,'set_role',{group_id:g,user_id:users[0],role:'admin'}));await fails(()=>call(1,'invite',{group_id:g}));
await call(0,'set_role',{group_id:g,user_id:users[1],role:'admin'});await call(1,'invite',{group_id:g});await fails(()=>call(2,'join',{code}));
const newcode=(await call(1,'invite',{group_id:g})).code;await call(2,'join',{code:newcode});
await fails(()=>call(1,'remove_member',{group_id:g,user_id:users[0]}));await fails(()=>call(1,'delete_group',{group_id:g}));
await call(0,'remove_member',{group_id:g,user_id:users[1]});await fails(()=>call(0,'compare',{user_ids:[users[1]]}));await fails(()=>call(1,'members',{group_id:g}));
assert.equal((await call(1,'state')).slots.length,1);count++;
await fails(()=>call(0,'leave',{group_id:g}));await call(0,'revoke_invites',{group_id:g});await fails(()=>call(1,'join',{code:newcode}));
await call(0,'delete_group',{group_id:g});assert.equal((await call(2,'state')).groups.length,0);count++;
await db.exec('SET ROLE authenticated');await fails(()=>db.query('SELECT * FROM public."TblP126BusySlot"'));await db.exec('RESET ROLE; SET ROLE anon');await fails(()=>db.query(`SELECT public."P126Action"('state')`));await db.exec('RESET ROLE');
await fails(()=>call(9,'bootstrap'));await fails(()=>call(0,'anything'));
await db.exec(fs.readFileSync(root+'/Database/90_P126_Permissions.sql','utf8'));const hc=await db.exec(fs.readFileSync(root+'/Database/99_P126_HealthCheck.sql','utf8'));assert(hc[0].rows.every(r=>r.exists&&r.rls&&r.rpc_only&&r.service_access&&r.policy_count===0));count++;
const compare=require(root+'/Website/compare.js');const confirmed={UserID:'a',ConfirmedAt:'now',Slots:[]},unknown={UserID:'b',ConfirmedAt:null,Slots:[]};assert.equal(compare.cell([confirmed,unknown],1,1).state,'unknown');assert.equal(compare.windows([confirmed,unknown],2).length,0);assert.equal(compare.windows([confirmed],2).length,66);assert.equal(compare.cell([{...confirmed,Slots:[slot]}],1,2).state,'busy');count+=4;
console.log(JSON.stringify({passed:count,engine:'PGlite PostgreSQL',note:'Auth schema simulated; live Supabase email/session not tested.'}));await db.close();})().catch(e=>{console.error(e);process.exit(1)});
