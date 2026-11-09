// scripts/tests/vinted-accounts-preuve.test.mjs — défaut #5 (revue sécurité du 9 nov.)
// ────────────────────────────────────────────────────────────────────────────
// La migration 029 EXÉCUTÉE sur un vrai Postgres local (initdb du système, une
// grappe jetable), avec la forme Supabase utile : rôles anon / authenticated /
// service_role, `auth.uid()` lu dans `request.jwt.claims`, RLS de 001 + 021,
// puis le vrai fichier `supabase/migrations/029-vinted-accounts-preuve.sql`.
//   · authenticated : ligne NEUVE refusée (42501 vrm_vinted_preuve) ; upsert
//     PostgREST d'une ligne existante accepté (jetons renouvelés) ; PATCH de
//     jetons/login accepté ; changer vinted_user_id / owner refusé ; DELETE ok ;
//   · service_role : crée la ligne neuve ;
//   · l'ESSAI écrit dans l'en-tête du fichier dit « ESSAI OK » et ne garde rien ;
//   · le retour arrière (`disable trigger`) rend l'ancien comportement.
// Sans Postgres sur la machine, la partie exécutée est SAUTÉE (dit), la
// partie statique tourne toujours.
// `--prouve` (variable PROUVE=1) : le fichier est réaffaibli de 4 façons, chaque
// mutation doit faire ÉCHOUER un cas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '../..');
const FICHIER = path.join(RACINE, 'supabase/migrations/029-vinted-accounts-preuve.sql');
const SQL029 = fs.readFileSync(FICHIER, 'utf8');
const sansCom = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

test('029 : la forme du déclencheur (statique)', () => {
  const s = sansCom(SQL029);
  assert.match(s, /before\s+insert\s+or\s+update\s+on\s+public\.vinted_accounts/i);
  assert.match(s, /current_user\s+not\s+in\s*\(\s*'authenticated'\s*,\s*'anon'\s*\)/i);
  assert.match(s, /errcode\s*=\s*'42501'/i);
  assert.match(s, /vrm_vinted_preuve/);
  assert.match(s, /new\.owner\s+is\s+distinct\s+from\s+old\.owner/i);
  assert.match(s, /new\.vinted_user_id\s+is\s+distinct\s+from\s+old\.vinted_user_id/i);
  assert.doesNotMatch(s, /security\s+definer/i, 'le déclencheur doit lire sous la RLS du vendeur');
  assert.match(s, /set\s+search_path\s*=\s*''/i);
  assert.doesNotMatch(s, /\bdrop\b|\bdelete\s+from\b|\btruncate\b/i, 'aucun DROP/DELETE dans la partie appliquée');
  // L'essai et le retour arrière sont écrits dans le fichier.
  assert.match(SQL029, /ESSAI OK/);
  assert.match(SQL029, /disable trigger vrm_vinted_accounts_preuve/);
});

// ── Grappe Postgres jetable ─────────────────────────────────────────────────
function binPg() {
  const bases = ['/usr/lib/postgresql'];
  for (const b of bases) {
    if (!fs.existsSync(b)) continue;
    for (const v of fs.readdirSync(b).sort().reverse()) {
      const d = path.join(b, v, 'bin');
      if (fs.existsSync(path.join(d, 'initdb')) && fs.existsSync(path.join(d, 'pg_ctl'))) return d;
    }
  }
  return null;
}
const BIN = binPg();
const RACINE_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

function grappe() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-pg029-'));
  const data = path.join(dir, 'data');
  const sock = dir;
  const port = String(54000 + Math.floor(Math.random() * 900));
  // Postgres refuse de tourner en root : on passe par l'utilisateur `postgres`.
  const commeQui = (cmd, args, opts = {}) => (RACINE_ROOT
    ? execFileSync('runuser', ['-u', 'postgres', '--', cmd, ...args], { stdio: 'pipe', ...opts })
    : execFileSync(cmd, args, { stdio: 'pipe', ...opts }));
  if (RACINE_ROOT) { fs.chmodSync(dir, 0o777); execFileSync('chown', ['postgres', dir]); }
  commeQui(path.join(BIN, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-sync']);
  commeQui(path.join(BIN, 'pg_ctl'), ['-D', data, '-o', `-k ${sock} -p ${port} -c listen_addresses= -c fsync=off`, '-w', 'start', '-l', path.join(dir, 'log')]);
  const psql = (sql, { role = null, claims = null, sansErreur = false } = {}) => {
    const avant = [];
    if (claims) avant.push(`select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false);`);
    if (role) avant.push(`set role ${role};`);
    const r = spawnSync('psql', ['-h', sock, '-p', port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A'], {
      input: avant.join('\n') + '\n' + sql, encoding: 'utf8',
    });
    if (r.status !== 0 && !sansErreur) throw Object.assign(new Error(r.stderr || 'psql'), { stderr: r.stderr, stdout: r.stdout });
    return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
  };
  const arreter = () => {
    try { commeQui(path.join(BIN, 'pg_ctl'), ['-D', data, '-m', 'immediate', 'stop']); } catch (_) {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  };
  return { psql, arreter };
}

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
const CLAIMS_A = { sub: A, role: 'authenticated' };

// La forme Supabase utile au déclencheur (001, 007, 021, 027 pour la restrictive
// d'abonnement : `vrm_acces_ok()` rendu vrai ici).
const SOCLE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
insert into auth.users values ('${A}'), ('${B}');
create table public.vinted_accounts (
  id bigserial primary key,
  vinted_user_id text,
  domain text, access_token text, refresh_token text, anon_id text, csrf_token text, login text,
  updated_at timestamptz default now(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade
);
create unique index vinted_accounts_owner_uid_idx on public.vinted_accounts(owner, vinted_user_id);
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.vinted_accounts to authenticated, service_role;
grant select on public.vinted_accounts to anon;
grant usage, select on sequence public.vinted_accounts_id_seq to authenticated, service_role;
create function public.vrm_acces_ok() returns boolean language sql stable as $$ select true $$;
grant execute on function public.vrm_acces_ok() to authenticated;
alter table public.vinted_accounts enable row level security;
create policy vrm_anon_ferme on public.vinted_accounts as restrictive for all to anon using (false) with check (false);
create policy vrm_proprietaire_permis on public.vinted_accounts as permissive for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy abonnement_requis on public.vinted_accounts as restrictive for all to authenticated
  using (true) with check ((select public.vrm_acces_ok()));
-- Le compte Vinted 111 est déjà relié chez A (avant la migration).
insert into public.vinted_accounts (owner, vinted_user_id, access_token, domain) values ('${A}', '111', 'jeton-vieux', 'www.vinted.fr');
`;

// Les écritures telles que PostgREST les envoie (upsert = INSERT … ON CONFLICT DO UPDATE).
const UPSERT = (uid, jeton) => `insert into public.vinted_accounts (vinted_user_id, domain, access_token, refresh_token, updated_at, owner)
  values ('${uid}', 'www.vinted.fr', '${jeton}', 'r', now(), '${A}')
  on conflict (owner, vinted_user_id) do update set vinted_user_id = excluded.vinted_user_id, domain = excluded.domain,
    access_token = excluded.access_token, refresh_token = excluded.refresh_token, updated_at = excluded.updated_at, owner = excluded.owner;`;

export function scenarios(sql029) {
  const g = grappe();
  const rouges = [];
  const ok = (cond, msg) => { if (!cond) rouges.push(msg); };
  try {
    g.psql(SOCLE);
    // Avant la 029 : une ligne neuve passe (compatibilité : rien ne change tant qu'il n'a pas appliqué).
    const avant = g.psql(UPSERT('222', 'x'), { role: 'authenticated', claims: CLAIMS_A, sansErreur: true });
    ok(avant.ok, 'avant la 029, l’upsert direct devrait passer (état d’aujourd’hui) : ' + avant.err);
    g.psql(`delete from public.vinted_accounts where vinted_user_id = '222';`);
    // L'ESSAI de l'en-tête, rejoué tel qu'écrit (corps du fichier entre begin/commit).
    const corps = (sql029.split(/\nbegin;\n/)[1] || '').split(/\ncommit;\s*$/)[0];
    ok(corps.length > 100, 'corps de la migration introuvable entre begin; et commit;');
    const essai = g.psql(`begin;\n${corps}\nselect set_config('request.jwt.claims', '{"sub":"${A}","role":"authenticated"}', true);
set local role authenticated;
do $e$ begin
  insert into public.vinted_accounts (owner, vinted_user_id) values ('${A}', '999999999999');
  raise exception 'ESSAI RATÉ : une ligne neuve est passée sans preuve';
exception when insufficient_privilege then
  if sqlerrm not like 'vrm_vinted_preuve%' then raise; end if;
  raise notice 'ESSAI OK : %', sqlerrm;
end $e$;
rollback;`, { sansErreur: true });
    ok(essai.ok && /ESSAI OK : vrm_vinted_preuve/.test(essai.err), 'l’essai de l’en-tête ne dit pas « ESSAI OK » : ' + essai.err);
    const resteTrig = g.psql(`select count(*) from pg_trigger where tgname = 'vrm_vinted_accounts_preuve';`).out;
    ok(resteTrig === '0', 'l’essai a laissé le déclencheur (rollback attendu)');

    // Application réelle du fichier.
    const app = g.psql(sql029, { sansErreur: true });
    ok(app.ok, 'la migration ne s’applique pas : ' + app.err);
    if (!app.ok) return rouges;
    const dir = (sql, o) => g.psql(sql, { role: 'authenticated', claims: CLAIMS_A, sansErreur: true, ...o });

    // 1. authenticated : ligne NEUVE refusée, avec le code que lit l'extension.
    const neuve = dir(UPSERT('333', 'jeton-squatteur'));
    ok(!neuve.ok && /vrm_vinted_preuve/.test(neuve.err), 'authenticated a créé une ligne neuve : ' + (neuve.err || 'acceptée'));
    const insertSimple = dir(`insert into public.vinted_accounts (vinted_user_id, access_token) values ('334', 'x');`);
    ok(!insertSimple.ok && /vrm_vinted_preuve/.test(insertSimple.err), 'INSERT simple neuf accepté');
    const sansId = dir(`insert into public.vinted_accounts (access_token) values ('x');`);
    ok(!sansId.ok && /vrm_vinted_preuve/.test(sansId.err), 'INSERT sans vinted_user_id accepté');
    const compte333 = g.psql(`select count(*) from public.vinted_accounts where vinted_user_id in ('333','334');`).out;
    ok(compte333 === '0', 'une ligne neuve a été écrite malgré le refus');

    // 2. upsert d'une ligne EXISTANTE (extension qui renouvelle les jetons) : accepté.
    const renouv = dir(UPSERT('111', 'jeton-neuf'));
    ok(renouv.ok, 'upsert d’une ligne existante refusé : ' + renouv.err);
    ok(g.psql(`select access_token from public.vinted_accounts where vinted_user_id = '111';`).out === 'jeton-neuf', 'jetons pas renouvelés');

    // 3. PATCH des autres colonnes : accepté.
    const patch = dir(`update public.vinted_accounts set login = 'shop_a', csrf_token = 'c', refresh_token = 'r2', updated_at = now() where vinted_user_id = '111';`);
    ok(patch.ok, 'PATCH login/jetons refusé : ' + patch.err);
    ok(g.psql(`select login from public.vinted_accounts where vinted_user_id = '111';`).out === 'shop_a', 'login pas écrit');

    // 4. Changer l'identité : refusé (vinted_user_id puis owner).
    const ident = dir(`update public.vinted_accounts set vinted_user_id = '444' where vinted_user_id = '111';`);
    ok(!ident.ok && /vrm_vinted_preuve/.test(ident.err), 'changer vinted_user_id accepté');
    const own = dir(`update public.vinted_accounts set owner = '${B}' where vinted_user_id = '111';`);
    ok(!own.ok && /vrm_vinted_preuve/.test(own.err), 'changer owner accepté');
    ok(g.psql(`select owner || ':' || vinted_user_id from public.vinted_accounts where access_token = 'jeton-neuf';`).out === `${A}:111`, 'identité de la ligne changée');

    // 5. anon : rien (RLS + déclencheur).
    const anon = g.psql(UPSERT('555', 'x'), { role: 'anon', sansErreur: true });
    ok(!anon.ok, 'anon a écrit');

    // 6. service_role (route serveur après preuve) : crée la ligne neuve.
    const service = g.psql(`insert into public.vinted_accounts (owner, vinted_user_id, access_token) values ('${A}', '333', 'jeton-prouve');`, { role: 'service_role', sansErreur: true });
    ok(service.ok, 'service_role refusé : ' + service.err);
    // …et ensuite l'extension renouvelle cette ligne en direct.
    const apres = dir(UPSERT('333', 'jeton-2'));
    ok(apres.ok, 'renouvellement après liaison serveur refusé : ' + apres.err);

    // 7. DELETE par le vendeur : permis.
    const del = dir(`delete from public.vinted_accounts where vinted_user_id = '333';`);
    ok(del.ok && g.psql(`select count(*) from public.vinted_accounts where vinted_user_id = '333';`).out === '0', 'DELETE refusé');

    // 8. Retour arrière écrit dans le fichier : l'ancien comportement revient.
    g.psql(`alter table public.vinted_accounts disable trigger vrm_vinted_accounts_preuve;`);
    const retour = dir(UPSERT('666', 'x'));
    ok(retour.ok, 'retour arrière : l’upsert direct ne repasse pas');
  } finally { g.arreter(); }
  return rouges;
}

const peutExecuter = !!BIN && (!RACINE_ROOT || spawnSync('runuser', ['-u', 'postgres', '--', 'true']).status === 0)
  && spawnSync('psql', ['--version']).status === 0;

test('029 exécutée sur Postgres : authenticated refusé, service accepté, autres colonnes ok', { skip: peutExecuter ? false : 'Postgres local absent (initdb/pg_ctl/psql)' }, () => {
  const rouges = scenarios(SQL029);
  assert.deepEqual(rouges, [], 'défauts :\n  ' + rouges.join('\n  '));
});

// Chaque affaiblissement du fichier doit faire rougir un cas.
const MUTATIONS = [
  ['refus de la ligne neuve retiré', (s) => s.replace(/raise exception using\s+errcode = '42501',\s+message = 'vrm_vinted_preuve: un compte/, "return new; raise exception using errcode = '42501', message = 'vrm_vinted_preuve: un compte")],
  ['UPDATE d’identité laissé passer', (s) => s.replace(/if new\.owner is distinct from old\.owner\s+or new\.vinted_user_id is distinct from old\.vinted_user_id then/, 'if false then')],
  ['upsert existant refusé (casse l’extension)', (s) => s.replace(/where v\.owner = new\.owner and v\.vinted_user_id = new\.vinted_user_id/, 'where false')],
  ['service_role borné aussi', (s) => s.replace(/if current_user not in \('authenticated', 'anon'\) then/, "if current_user not in ('authenticated', 'anon', 'service_role') then return new; end if; if false then")],
  ['déclencheur sur UPDATE seulement', (s) => s.replace(/before insert or update on/, 'before update on')],
];
test('--prouve : chaque mutation de la 029 est vue', { skip: peutExecuter && process.env.PROUVE === '1' ? false : 'PROUVE=1 et Postgres local requis' }, () => {
  for (const [nom, muter] of MUTATIONS) {
    const m = muter(SQL029);
    assert.notEqual(m, SQL029, `la mutation « ${nom} » ne s’applique à rien`);
    const rouges = scenarios(m);
    assert.ok(rouges.length > 0, `la mutation « ${nom} » n’a fait rougir aucun cas`);
  }
});
