#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 040 (temps réel) sur un Postgres JETABLE
//  node scripts/audit-temps-reel-sql.cjs            (l'audit)
//  node scripts/audit-temps-reel-sql.cjs --prouve   (chaque mutation doit le rougir)
//  Le schéma `realtime` de Supabase est imité au plus juste (`messages`, `send`,
//  `topic()` lu dans `realtime.topic`, comme chez Supabase) ; `auth.uid()` lit
//  le jeton. Aucune donnée réelle : des lignes inventées, dans une base jetable.
//   1. une écriture d'app_data diffuse UN message sur `vrm-lignes:<owner>`, qui ne
//      porte QUE l'id et la version (jamais `data`, jamais un PDF) ;
//   2. une ligne sans propriétaire ne diffuse rien ;
//   3. une diffusion en panne n'empêche JAMAIS l'écriture ;
//   4. un connecté ne lit QUE son sujet (ni celui d'un autre, ni anonyme) ;
//   5. l'essai annulé porte le MÊME corps que la migration et ne laisse rien.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MIG = path.join(RACINE, 'supabase/migrations/040-temps-reel.sql');
const ESSAI = path.join(RACINE, 'scripts/temps-reel-sql/essai-annule.sql');
const VERIF = path.join(RACINE, 'scripts/temps-reel-sql/verifier.sql');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const MUTATION = arg('mutation');
const MUTATIONS = {
  'data-diffusee': (s) => s.replace("'id', new.id,", "'id', new.id, 'data', new.data,"),
  'sans-exception': (s) => s.replace(/  exception when others then\n    null;[^\n]*\n/, ''),
  'regle-ouverte': (s) => s.replace("and (select realtime.topic()) = 'vrm-lignes:' || (select auth.uid())::text", ''),
};

if (process.argv.includes('--prouve')) {
  let ok = 0; const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌ /gm) || []).length;
    const bon = r.status !== 0 && rouges > 0 && !/NON exécuté/.test(r.stdout);
    if (bon) ok++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? rouges + ' contrôle(s) au rouge' : 'RESTE VERTE'}`);
  }
  console.log(`\n${ok}/${noms.length} mutations attrapées.`);
  process.exit(ok === noms.length ? 0 : 1);
}

function trouverBin() {
  const avec = (d) => d && ['initdb', 'pg_ctl', 'postgres', 'psql'].every((x) => fs.existsSync(path.join(d, x)));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  try { const v = fs.readdirSync('/usr/lib/postgresql').filter((x) => avec(path.join('/usr/lib/postgresql', x, 'bin'))).sort((a, b) => Number(b) - Number(a)); if (v.length) return path.join('/usr/lib/postgresql', v[0], 'bin'); } catch (_) {}
  return null;
}
const BIN = trouverBin();
if (!BIN) { console.log('❌ Postgres introuvable — audit NON exécuté (PG_BIN=/chemin/bin).'); process.exit(1); }
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
let UIDG = null;
if (ROOT) { try { UIDG = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString().trim()) }; } catch (_) { console.log('❌ root sans utilisateur « postgres » — audit NON exécuté.'); process.exit(1); } }
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-temps-reel-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(54432 + (process.pid % 2000));
const srv = (cmd, a) => spawnSync(path.join(BIN, cmd), a, { encoding: 'utf8', ...(UIDG || {}) });
let demarre = false;
const arreter = () => { if (demarre) { srv('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} };
process.on('exit', arreter);
{
  const r = srv('initdb', ['-D', DIR + '/data', '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  if (r.status !== 0) { console.log('❌ initdb — audit NON exécuté : ' + (r.stderr || r.stdout).slice(0, 300)); process.exit(1); }
  const s = srv('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c timezone=UTC`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) { console.log('❌ Postgres ne démarre pas — audit NON exécuté.'); process.exit(1); }
  demarre = true;
}
const run = (sql, role = 'supabase_admin') => {
  const r = spawnSync(path.join(BIN, 'psql'), ['-h', DIR, '-p', PORT, '-U', role, '-d', 'postgres', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const Q = (sql, role) => { const r = run(sql, role); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
let verts = 0, rouges = 0;
const juge = (ok, nom, d = '') => { if (ok) verts++; else rouges++; console.log(`${ok ? '✅' : '❌'} ${nom}${d ? ' — ' + d : ''}`); };

// Le décor : rôles, auth.uid(), realtime (messages, send, topic) et app_data (meta par déclencheur, comme la 004).
const DECOR = `
create role anon nologin; create role authenticated nologin; create role postgres login;
create schema auth; create schema realtime;
grant usage on schema auth, realtime to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
create table realtime.messages (id bigserial primary key, topic text not null, extension text not null, payload jsonb, event text, private boolean, inserted_at timestamptz default now());
alter table realtime.messages enable row level security;
grant select on realtime.messages to authenticated;
create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $$
begin
  if current_setting('banc.panne', true) = 'oui' then raise exception 'banc : diffusion en panne'; end if;
  insert into realtime.messages(topic, extension, payload, event, private) values (topic, 'broadcast', payload, event, private);
end $$;
create table public.app_data (id text primary key, owner uuid, data jsonb, meta jsonb, updated_at timestamptz default now());
create function public.vrm_meta_trigger() returns trigger language plpgsql as $$
begin new.meta := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(new.data) as e(k, v) where jsonb_typeof(v) in ('string','number','boolean') and length(v::text) <= 600); return new; end $$;
create trigger vrm_meta_maj before insert or update of data, id on public.app_data for each row execute function public.vrm_meta_trigger();
`;
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222';
const comme = (u, topic) => `set role authenticated; set "request.jwt.claims" = '{"sub":"${u}","role":"authenticated"}'; set "realtime.topic" = '${topic}';\n`;

try {
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);
  Q(DECOR);
  let sql = fs.readFileSync(MIG, 'utf8');
  if (MUTATION) { if (!MUTATIONS[MUTATION]) { console.log('❌ mutation inconnue — audit NON exécuté'); process.exit(1); } const m = MUTATIONS[MUTATION](sql); if (m === sql) { console.log('❌ ancre de mutation introuvable — audit NON exécuté'); process.exit(1); } sql = m; }

  // 5a. L'essai annulé : même corps, et rien ne reste.
  const corps = (t) => (/^begin;\n([\s\S]*?)\n(?:commit;|select realtime\.send\('\{"id":"essai"\})/m.exec(t.replace(/\r/g, '')) || [])[1] || null;
  const essai = fs.readFileSync(ESSAI, 'utf8');
  juge(!!corps(essai) && corps(essai).trim() === corps(fs.readFileSync(MIG, 'utf8')).trim(), "5. l'essai annulé porte le corps exact de la migration");
  const e = run(essai);
  const lignesEssai = e.out.split('\n').filter(Boolean);
  let rap = null; try { rap = JSON.parse(lignesEssai.find((l) => l.startsWith('{'))); } catch (_) {}
  juge(e.ok && rap && rap.trig === 1 && rap.pol === 1 && rap.msg === 1, "5. l'essai annulé passe (déclencheur, règle, diffusion)", e.ok ? JSON.stringify(rap) : e.err.slice(0, 200));
  juge(e.ok && lignesEssai[lignesEssai.length - 1] === '0|0', "5. après l'essai, rien ne reste", lignesEssai[lignesEssai.length - 1]);

  Q(sql);
  const v = Q(fs.readFileSync(VERIF, 'utf8'));
  juge(/^t\|/.test(v), '0. la vérification dit ok après application', v);

  // 1. Une écriture ⇒ un message, l'id et la version seulement.
  const gros = 'x'.repeat(200000);
  Q(`insert into public.app_data(id, owner, data, updated_at) values ('harvest_42_orders_sold', '${U1}', jsonb_build_object('capturedAt','2026-11-11T12:00:00.000Z','rev',3,'payload', jsonb_build_object('pdfB64','${gros}')), '2026-11-11T12:00:01Z')`);
  const m1 = Q(`select topic || '|' || payload::text from realtime.messages order by id`).split('\n').filter(Boolean);
  juge(m1.length === 1 && m1[0].startsWith(`vrm-lignes:${U1}|`), '1. une écriture ⇒ un message sur le sujet du propriétaire', `${m1.length} message(s)`);
  const p1 = m1[0] ? JSON.parse(m1[0].slice(m1[0].indexOf('|') + 1)) : {};
  const cles = Object.keys(p1).sort().join(',');
  juge(cles === 'cap,id,owner,pg,rev,sup,updated_at', '1. le message ne porte QUE l’id et la version', cles);
  juge(!m1.some((x) => x.includes('pdfB64') || x.length > 1000), '1. jamais `data` ni un PDF dans le message', `${m1[0] ? m1[0].length : 0} car.`);
  juge(p1.rev === '3' && p1.cap === '2026-11-11T12:00:00.000Z' && p1.id === 'harvest_42_orders_sold', '1. la version lue est celle de `meta`', JSON.stringify({ rev: p1.rev, cap: p1.cap }));
  Q(`update public.app_data set data = data || '{"rev":4}' where id = 'harvest_42_orders_sold'`);
  juge(Number(Q(`select count(*) from realtime.messages`)) === 2, '1. une mise à jour ⇒ un message de plus');

  // 2. Sans propriétaire ⇒ rien.
  Q(`insert into public.app_data(id, owner, data) values ('ligne_sans_owner', null, '{"rev":1}')`);
  juge(Number(Q(`select count(*) from realtime.messages`)) === 2, '2. une ligne sans propriétaire ne diffuse rien');

  // 3. Diffusion en panne ⇒ l'écriture passe quand même.
  const r3 = run(`set banc.panne = 'oui'; insert into public.app_data(id, owner, data) values ('harvest_42_listings', '${U1}', '{"rev":1}'); select count(*) from public.app_data where id = 'harvest_42_listings';`);
  juge(r3.ok && r3.out.split('\n').pop() === '1', '3. diffusion en panne : l’écriture passe toujours', r3.ok ? '' : r3.err.slice(0, 160));

  // 4. Chacun son sujet.
  Q(`insert into public.app_data(id, owner, data) values ('harvest_77_orders_sold', '${U2}', '{"rev":1}')`);
  const vu = (u, topic) => run(comme(u, topic) + "select count(*) from realtime.messages where topic = current_setting('realtime.topic');");
  const a = vu(U1, `vrm-lignes:${U1}`), b = vu(U1, `vrm-lignes:${U2}`), c = vu(U2, `vrm-lignes:${U2}`);
  juge(a.ok && Number(a.out) === 2, '4. le vendeur lit SON sujet', a.ok ? a.out : a.err.slice(0, 160));
  juge(b.ok && Number(b.out) === 0, '4. il ne lit PAS le sujet d’un autre', b.ok ? b.out : b.err.slice(0, 160));
  juge(c.ok && Number(c.out) === 1, '4. l’autre lit le sien, seulement', c.ok ? c.out : c.err.slice(0, 160));
  const an = run(`set role anon; set "realtime.topic" = 'vrm-lignes:${U1}'; select count(*) from realtime.messages where topic = current_setting('realtime.topic');`);
  juge(!an.ok || Number(an.out) === 0, '4. un anonyme ne lit rien');
} catch (e) { juge(false, 'audit interrompu', String(e.message || e).slice(0, 300)); }
console.log(`\n${verts} vert(s), ${rouges} rouge(s).`);
process.exit(rouges ? 1 : 0);
