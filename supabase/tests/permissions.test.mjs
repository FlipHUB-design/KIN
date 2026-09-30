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
try { await db.exec(fs.readFileSync(new URL("../migrations/0001_kin_schema.sql", import.meta.url), "utf8")); } catch (e) { console.log("MIGRATION ERROR:", e.message, e.position); process.exit(1); }
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
