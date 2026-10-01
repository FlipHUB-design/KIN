// Checks that the database permission rules keep each family's data private and each role in its lane.
// Runs against an in-memory Postgres (PGlite) with small stand-ins for Supabase's auth and storage.
// Run with: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
const stub = `
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
`;
await db.exec(stub);
try {
  for (const f of ["0001_kin_schema.sql", "0002_letters_playbooks_costs.sql", "0003_children_coparenting.sql"]) await db.exec(fs.readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"));
} catch (e) { console.log("MIGRATION ERROR:", e.message); process.exit(1); }
await db.exec(`grant usage on schema public, auth, storage to authenticated, anon;
grant all on all tables in schema public to authenticated; grant all on all sequences in schema public to authenticated;
grant all on storage.objects to authenticated; grant execute on all functions in schema auth to authenticated, anon;`);
const U = { sarah:'00000000-0000-0000-0000-00000000000a', anthony:'00000000-0000-0000-0000-00000000000b', helen:'00000000-0000-0000-0000-00000000000c', lucy:'00000000-0000-0000-0000-00000000000d', eve:'00000000-0000-0000-0000-00000000000e' };
for (const [n,id] of Object.entries(U)) await db.query(`insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)`, [id, n+'@x.test', {display_name:n}]);
async function as(user, sql, params=[]) {
  await db.exec(`set role authenticated; select set_config('request.uid','${user}',false);`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role;`); }
}
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1};
const circle = (await as(U.sarah, `select create_circle('Margaret Hale','Mum','Daughter') as id`)).rows[0].id;
// invitations
const inv = async (role, rel) => (await as(U.sarah, `insert into invitations (circle_id,name,role,relationship,invited_by) values ($1,'x',$2,$3,$4) returning token`, [circle, role, rel, U.sarah])).rows[0].token;
await as(U.anthony, `select accept_invitation($1)`, [await inv('family','Son')]);
await as(U.helen, `select accept_invitation($1)`, [await inv('helper','Cleaner')]);
await as(U.lucy, `select accept_invitation($1)`, [await inv('contributor','Granddaughter')]);
let reuse=false; try { await as(U.eve, `select accept_invitation((select token from invitations where name='x' limit 1))`); reuse=true } catch {}
ok(!reuse, "used invitation cannot be reused (and outsider can't read tokens)");
ok((await as(U.eve, `select * from care_circles`)).rows.length===0, "outsider sees no circles");
ok((await as(U.eve, `select * from memberships`)).rows.length===0, "outsider sees no memberships");
// tasks
await as(U.sarah, `insert into tasks (circle_id,title,created_by,private) values ($1,'Council letter',$2,true)`, [circle,U.sarah]);
await as(U.sarah, `insert into tasks (circle_id,title,created_by) values ($1,'Shopping',$2)`, [circle,U.sarah]);
await as(U.sarah, `insert into tasks (circle_id,title,created_by,assignee,status,due_date,recurrence) values ($1,'Cleaning',$2,$3,'accepted','2026-10-02','weekly')`, [circle,U.sarah,U.helen]);
ok((await as(U.anthony, `select * from tasks`)).rows.length===3, "family sees all 3 tasks");
ok((await as(U.lucy, `select title from tasks`)).rows.map(r=>r.title).sort().join()==='Shopping', "contributor sees only shared open task");
ok((await as(U.helen, `select title from tasks`)).rows.map(r=>r.title).join()==='Cleaning', "helper sees only own task");
ok((await as(U.eve, `select * from tasks`)).rows.length===0, "outsider sees no tasks");
const upd = await as(U.helen, `update tasks set title='hacked' where title='Shopping' returning id`);
ok(upd.rows.length===0, "helper cannot edit others' tasks");
let lucyPriv=true; try { await as(U.lucy, `insert into tasks (circle_id,title,created_by,private) values ($1,'x',$2,true)`, [circle,U.lucy]) } catch { lucyPriv=false }
ok(!lucyPriv, "contributor cannot create private tasks");
const helenTask = (await as(U.helen, `select id from tasks`)).rows[0].id;
await as(U.helen, `select complete_task($1)`, [helenTask]);
ok((await as(U.helen, `select due_date::text from tasks where status='accepted'`)).rows[0]?.due_date==='2026-10-09', "completing a weekly task creates next week's");
const shop = (await as(U.sarah, `select id from tasks where title='Shopping'`)).rows[0].id;
let hclaim=true; try { await as(U.helen, `select claim_task($1)`, [shop]) } catch { hclaim=false }
ok(!hclaim, "helper cannot claim family tasks");
await as(U.lucy, `select claim_task($1)`, [shop]);
let aclaim=true; try { await as(U.anthony, `select claim_task($1)`, [shop]) } catch { aclaim=false }
ok(!aclaim, "can't claim a task someone else has taken");
// appointments / person details
await as(U.sarah, `insert into appointments (circle_id,title,date,created_by,notes) values ($1,'Hospital','2026-10-01',$2,'n')`, [circle,U.sarah]);
ok((await as(U.helen, `select * from appointments`)).rows.length===0, "helper cannot see appointments");
ok((await as(U.lucy, `select * from appointments`)).rows.length===1, "contributor sees appointments");
ok((await as(U.helen, `select * from person_profiles`)).rows.length===0, "helper cannot see personal profile");
ok((await as(U.lucy, `select * from emergency_info`)).rows.length===0, "contributor cannot see emergency medical info");
ok((await as(U.helen, `select * from visit_info`)).rows.length===1, "helper sees address and access info");
ok((await as(U.helen, `select * from activity`)).rows.every(r=>r.actor===U.helen), "helper sees only own activity");
// membership changes
const r1 = await as(U.anthony, `update memberships set role='admin' where user_id=$1 returning *`, [U.anthony]);
ok(r1.rows.length===0, "family member cannot promote themselves");
await as(U.sarah, `update memberships set status='paused' where user_id=$1 and circle_id=$2`, [U.anthony, circle]);
ok((await as(U.anthony, `select * from tasks`)).rows.length===0, "paused member loses access");
// documents
await as(U.sarah, `insert into documents (circle_id,name,storage_path,access,uploaded_by) values ($1,'LPA',$2,'admins',$3)`, [circle, circle+'/a.pdf', U.sarah]);
await db.exec(`insert into storage.objects (bucket_id,name) values ('documents','${circle}/a.pdf')`);
await as(U.sarah, `update memberships set status='active' where user_id=$1`, [U.anthony]);
ok((await as(U.anthony, `select * from documents`)).rows.length===0, "family cannot see admin-only document");
ok((await as(U.anthony, `select * from storage.objects`)).rows.length===0, "family cannot download admin-only file");
ok((await as(U.sarah, `select * from storage.objects`)).rows.length===1, "admin can read the file");
let up=true; try { await as(U.helen, `insert into storage.objects (bucket_id,name) values ('documents',$1)`, [circle+'/evil.pdf']) } catch { up=false }
ok(!up, "helper cannot upload documents");
let logf=true; try { await as(U.eve, `select log_activity($1,'x',null)`, [circle]) } catch { logf=false }
ok(!logf, "log_activity can't be called directly");

// shared costs and letters
await as(U.sarah, `insert into expenses (circle_id,description,amount_pence,paid_by,split_between,created_by) values ($1,'Shopping',6400,$2,$3,$2)`, [circle, U.sarah, [U.sarah, U.anthony]]);
ok((await as(U.anthony, `select * from expenses`)).rows.length===1, "family sees shared costs");
ok((await as(U.lucy, `select * from expenses`)).rows.length===0, "contributor cannot see shared costs");
ok((await as(U.helen, `select * from expenses`)).rows.length===0, "helper cannot see shared costs");
let outsiderSplit=true; try { await as(U.sarah, `insert into expenses (circle_id,description,amount_pence,paid_by,split_between,created_by) values ($1,'x',100,$2,$3,$2)`, [circle, U.sarah, [U.eve]]) } catch { outsiderSplit=false }
ok(!outsiderSplit, "can't split a cost with someone outside the family");
let lucyExp=true; try { await as(U.lucy, `insert into expenses (circle_id,description,amount_pence,paid_by,split_between,created_by) values ($1,'x',100,$2,$3,$2)`, [circle, U.lucy, [U.lucy]]) } catch { lucyExp=false }
ok(!lucyExp, "contributor cannot add shared costs");
await as(U.sarah, `insert into letter_scans (circle_id,result,created_by) values ($1,'{}',$2)`, [circle, U.sarah]);
ok((await as(U.helen, `select * from letter_scans`)).rows.length===0, "helper cannot see scanned letters");
ok((await as(U.anthony, `select * from letter_scans`)).rows.length===1, "family sees scanned letters");

// ---------------------------------------------------------------- children and co-parenting
const K = { leah:'00000000-0000-0000-0000-0000000000a1', dan:'00000000-0000-0000-0000-0000000000a2', ruby:'00000000-0000-0000-0000-0000000000a3', kelly:'00000000-0000-0000-0000-0000000000a4', jean:'00000000-0000-0000-0000-0000000000a5' };
for (const [n,id] of Object.entries(K)) await db.query(`insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)`, [id, n+'@x.test', {display_name:n}]);
const fam = (await as(K.leah, `select create_circle('Ruby and Alfie','the children','Mum','children') as id`)).rows[0].id;
const kinv = async (role) => (await as(K.leah, `insert into invitations (circle_id,name,role,relationship,invited_by) values ($1,'x',$2,'x',$3) returning token`, [fam, role, K.leah])).rows[0].token;
await as(K.dan, `select accept_invitation($1)`, [await kinv('admin')]);
await as(K.ruby, `select accept_invitation($1)`, [await kinv('supported')]);
await as(K.kelly, `select accept_invitation($1)`, [await kinv('helper')]);
await as(K.jean, `select accept_invitation($1)`, [await kinv('contributor')]);
const [mum, dad] = (await as(K.leah, `insert into households (circle_id,name,colour) values ($1,'Mum''s','plum'),($1,'Dad''s','blue') returning id`, [fam])).rows.map(r=>r.id);
const ruby = (await as(K.leah, `insert into children (circle_id,first_name,user_id) values ($1,'Ruby',$2) returning id`, [fam, K.ruby])).rows[0].id;
const alfie = (await as(K.leah, `insert into children (circle_id,first_name) values ($1,'Alfie') returning id`, [fam])).rows[0].id;
await as(K.leah, `insert into schedule_patterns (circle_id,anchor,days) values ($1,'2026-09-28',$2)`, [fam, [mum,mum,dad,dad,mum,mum,mum, mum,mum,dad,dad,dad,dad,dad]]);
const n1 = (await as(K.kelly, `select household_id from nights($1,'2026-09-30','2026-09-30')`, [fam])).rows[0]?.household_id;
ok(n1 === dad, "childminder can see where the children sleep (Wednesday at Dad's)");
ok((await as(K.kelly, `select * from children`)).rows.length===2, "childminder sees the children's details");
ok((await as(U.eve, `select * from nights($1,'2026-09-30','2026-10-02')`, [fam])).rows.length===0, "outsider can't see the schedule");
ok((await as(K.kelly, `select * from schedule_patterns`)).rows.length===0, "childminder can't read the parents' pattern settings");
const req = (await as(K.dan, `insert into schedule_changes (circle_id,start_date,end_date,household_id,reason,requested_by) values ($1,'2026-10-03','2026-10-04',$2,'Work trip',$3) returning id`, [fam, dad, K.dan])).rows[0].id;
ok((await as(K.kelly, `select * from schedule_changes`)).rows.length===0, "childminder can't read swap requests or their reasons");
ok((await as(K.ruby, `select * from schedule_changes`)).rows.length===0, "young person can't read swap requests");
let selfAccept=true; try { await as(K.dan, `select respond_schedule_change($1,true,null)`, [req]) } catch { selfAccept=false }
ok(!selfAccept, "a parent can't approve their own swap request");
let grandAccept=true; try { await as(K.jean, `select respond_schedule_change($1,true,null)`, [req]) } catch { grandAccept=false }
ok(!grandAccept, "grandparent can't answer swap requests");
await as(K.leah, `select respond_schedule_change($1,true,'Fine')`, [req]);
ok((await as(K.ruby, `select household_id from nights($1,'2026-10-03','2026-10-03')`, [fam])).rows[0].household_id===dad, "an agreed swap changes where the children sleep");
await as(K.leah, `insert into appointments (circle_id,title,date,created_by,private) values ($1,'Mediation session','2026-10-05',$2,true)`, [fam, K.leah]);
await as(K.leah, `insert into appointments (circle_id,title,date,created_by,child_ids,share_with_helpers) values ($1,'INSET day','2026-10-09',$2,$3,true)`, [fam, K.leah, [alfie]]);
await as(K.leah, `insert into appointments (circle_id,title,date,created_by) values ($1,'Parents evening','2026-10-12',$2)`, [fam, K.leah]);
ok((await as(K.ruby, `select title from appointments order by title`)).rows.map(r=>r.title).join()==='INSET day,Parents evening', "young person doesn't see parents-only appointments");
ok((await as(K.kelly, `select title from appointments`)).rows.map(r=>r.title).join()==='INSET day', "childminder sees only events shared with them");
await as(K.leah, `insert into tasks (circle_id,title,created_by,child_ids) values ($1,'Ruby: revise for test',$2,$3)`, [fam, K.leah, [ruby]]);
await as(K.leah, `insert into tasks (circle_id,title,created_by,child_ids) values ($1,'Alfie: trip form',$2,$3)`, [fam, K.leah, [alfie]]);
await as(K.leah, `insert into tasks (circle_id,title,created_by,private,child_ids) values ($1,'Ruby: secret birthday present',$2,true,$3)`, [fam, K.leah, [ruby]]);
ok((await as(K.ruby, `select title from tasks`)).rows.map(r=>r.title).join()==='Ruby: revise for test', "young person sees only their own non-private tasks");
ok((await as(K.ruby, `select * from documents`)).rows.length===0 && (await as(K.ruby, `select * from activity where actor <> $1`, [K.ruby])).rows.length===0, "young person can't see documents or the family timeline");
await as(K.leah, `insert into expenses (circle_id,description,amount_pence,paid_by,split_between,created_by,status) values ($1,'School shoes',4500,$2,$3,$2,'pending')`, [fam, K.leah, [K.leah, K.dan]]);
const exp = (await as(K.dan, `select id from expenses`)).rows[0].id;
ok((await as(K.ruby, `select * from expenses`)).rows.length===0, "young person can't see money");
let selfApprove=true; try { await as(K.leah, `select respond_expense($1,true,null)`, [exp]) } catch { selfApprove=false }
ok(!selfApprove, "you can't approve your own cost");
await as(K.dan, `select respond_expense($1,true,null)`, [exp]);
ok((await as(K.leah, `select status from expenses`)).rows[0].status==='approved', "the other parent can approve a cost");
await as(K.dan, `insert into agreements (circle_id,title,proposed_by,share) values ($1,'Bedtime 8pm on school nights',$2,true)`, [fam, K.dan]);
await as(K.dan, `insert into agreements (circle_id,title,proposed_by,share) values ($1,'Phone until 9pm',$2,true)`, [fam, K.dan]);
const ag = (await as(K.leah, `select id from agreements where title like 'Bedtime%'`)).rows[0].id;
await as(K.leah, `select respond_agreement($1,true,null)`, [ag]);
ok((await as(K.kelly, `select title from agreements`)).rows.map(r=>r.title).join()==='Bedtime 8pm on school nights', "childminder sees only agreed, shared rules");
let kellyItem=true; try { await as(K.kelly, `insert into child_items (circle_id,name) values ($1,'x')`, [fam]) } catch { kellyItem=false }
ok(!kellyItem, "childminder can't change family records");
const careStill = (await as(U.helen, `select title from tasks`)).rows;
ok(careStill.length>0 && careStill.every(r=>r.title==='Cleaning'), "care circle permissions unchanged by children's update");
