#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 043 — LE PROGRAMME PARTENAIRE (15 nov.)
//  node scripts/audit-partenaires-sql.cjs            (le contrôle)
//  node scripts/audit-partenaires-sql.cjs --prouve   (chaque règle réaffaiblie ⇒ ROUGE)
//
//  La migration (supabase/migrations/043-partenaires.sql) est EXÉCUTÉE pour de vrai,
//  sur un Postgres JETABLE qui imite la production (scripts/agent-sql/supabase-min.sql :
//  rôles, droits par défaut OUVERTS du schéma public, auth.uid()). Aucune donnée réelle,
//  aucune connexion à la vraie base. Les rôles sont joués comme PostgREST les joue.
//  Ce qu'il prouve : RLS activée ET forcée sur les cinq tables ; ni un visiteur, ni un
//  vendeur connecté, ni un PARTENAIRE qui a un compte VRM ne lit, n'écrit, ne modifie ou
//  ne supprime une ligne (la sienne comprise : il ne voit que les nombres de la route) ;
//  le serveur lit et écrit, sans pouvoir supprimer ; 300 centimes seulement ; une facture
//  = une commission ; un client = une par mois (une annulée ne bloque pas) ; due ≥ +14 j ;
//  « annulée » toujours avec sa raison ; le code en majuscules ; un jeton = un partenaire ;
//  aucune suppression dans le fichier ; il se rejoue.
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MIG = path.join(RACINE, 'supabase/migrations/043-partenaires.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const U = { A: '11111111-1111-4111-8111-111111111111', B: '22222222-2222-4222-8222-222222222222' };
const PA = 'aaaaaaaa-0000-4000-8000-00000000000a', PB = 'bbbbbbbb-0000-4000-8000-00000000000b';
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).replace(/\s*\n\s*/g, ' ').slice(0, 240) : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };
const remplace = (s, a, b, nom) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error('mutation ' + nom + ' : ancre introuvable (' + n + ')'); return s.split(a).join(b); };
const MUTATIONS = {
  'commissions-lisibles': { apres: 'alter table public.partenaire_commissions no force row level security; alter table public.partenaire_commissions disable row level security; grant select on public.partenaire_commissions to authenticated;' },
  'partenaires-ecrits': { apres: 'grant insert, update on public.partenaires to authenticated; create policy tout on public.partenaires for all to authenticated using (true) with check (true);' },
  'partenaire-lit-sa-ligne': { apres: 'grant select on public.partenaires to authenticated; create policy la_sienne on public.partenaires for select to authenticated using (compte = auth.uid() or true);' },
  'droits-par-defaut': { sql: (s) => remplace(s, 'from public, anon, authenticated, service_role;', 'from service_role;', 'dpd') },
  'montant-libre': { sql: (s) => remplace(s, 'check (montant_centimes = 300)', 'check (montant_centimes > 0)', 'ml') },
  'deux-par-mois': { sql: (s) => remplace(s, 'create unique index if not exists partenaire_commissions_un_par_mois\n  on public.partenaire_commissions (filleul, mois) where annulee_le is null;\n', '', 'dpm') },
  'due-immediate': { sql: (s) => remplace(s, "  check (due_le >= paye_le + interval '14 days'),\n", '', 'di') },
  'annulee-sans-raison': { sql: (s) => remplace(s, ',\n  check ((annulee_le is null) = (annulee_raison is null))', '', 'asr') },
  'rembourse-tout-vivant': { sql: (s) => remplace(s, "  check (rembourse_centimes < facture_centimes or annulee_le is not null),\n", '', 'rtv') },
  'signal-deux-fois': { sql: (s) => remplace(s, ',\n  primary key (cle, signal)', '', 'sdf') },
  'serveur-supprime': { apres: 'grant delete on public.partenaire_commissions to service_role;' },
};
if (args.includes('--prouve')) {
  let rouges = 0;
  for (const nom of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const n = (r.stdout.match(/^❌ /gm) || []).length;
    const saute = /NON exécuté|ancre introuvable/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && n > 0 && !saute;
    if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' rouge(s)' : saute ? 'non exécutée' : 'RESTE VERTE'}`);
    if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 1)) console.log('      ' + l.slice(0, 180));
  }
  console.log(`\n${rouges}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(rouges === Object.keys(MUTATIONS).length ? 0 : 1);
}

function trouverBin() {
  const avec = (d) => d && fs.existsSync(path.join(d, 'initdb')) && fs.existsSync(path.join(d, 'pg_ctl')) && fs.existsSync(path.join(d, 'postgres'));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  try { const v = fs.readdirSync('/usr/lib/postgresql').filter((x) => avec(path.join('/usr/lib/postgresql', x, 'bin'))).sort((a, b) => Number(b) - Number(a)); if (v.length) return path.join('/usr/lib/postgresql', v[0], 'bin'); } catch (_) {}
  try { const d = execFileSync('pg_config', ['--bindir'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (avec(d)) return d; } catch (_) {}
  return null;
}
const BIN = trouverBin();
const PSQL = BIN && fs.existsSync(path.join(BIN, 'psql')) ? path.join(BIN, 'psql') : null;
if (!BIN || !PSQL) { console.log('❌ Postgres introuvable — audit NON exécuté. Installe postgresql (16+), ou donne PG_BIN=/chemin/vers/bin.'); process.exit(1); }
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
let UIDG = null;
if (ROOT) {
  try { UIDG = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString().trim()) }; }
  catch (_) { console.log('❌ lancé en root sans utilisateur système « postgres » — audit NON exécuté.'); process.exit(1); }
}
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-partenaires-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(52432 + (process.pid % 3000));
const serveur = (cmd, a) => spawnSync(path.join(BIN, cmd), a, { encoding: 'utf8', ...(UIDG || {}) });
let demarre = false;
const arreter = () => { if (demarre) { serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} };
process.on('exit', arreter);
process.on('SIGINT', () => { arreter(); process.exit(1); });
{
  const r = serveur('initdb', ['-D', DIR + '/data', '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  if (r.status !== 0) { console.log('❌ initdb a échoué — audit NON exécuté : ' + (r.stderr || r.stdout).slice(0, 300)); process.exit(1); }
  const s = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c timezone=UTC`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) { console.log('❌ Postgres ne démarre pas — audit NON exécuté : ' + (s.stderr || s.stdout).slice(0, 300)); process.exit(1); }
  demarre = true;
}
let DB = 'postgres';
const run = (sql, o = {}) => {
  const r = spawnSync(PSQL, ['-h', DIR, '-p', PORT, '-U', o.role || 'postgres', '-d', o.db || DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const Q = (sql, o = {}) => { const r = run(sql, o); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
const ADM = (sql) => Q(sql, { role: 'supabase_admin' });
const comme = (u) => `set role authenticated; set "request.jwt.claims" = '{"sub":"${u}","role":"authenticated"}';\n`;
const ANON = `set role anon; set "request.jwt.claims" = '{"role":"anon"}';\n`;
const SERV = `set role service_role; set "request.jwt.claims" = '{"role":"service_role"}';\n`;
const TABLES = ['partenaires', 'partenaire_filleuls', 'partenaire_commissions', 'partenaire_annulations', 'partenaire_versements'];
const com = (o = {}) => `insert into public.partenaire_commissions (facture, partenaire, filleul, montant_centimes, facture_centimes, paye_le, mois, due_le${o.annulee ? ', annulee_le, annulee_raison' : ''})
  values ('${o.facture || 'in_a1'}', '${o.partenaire || PA}', '${o.filleul || U.B}', ${o.montant || 300}, 1699, '${o.paye || '2026-10-08T09:30:00Z'}', '${o.mois || '2026-10'}', '${o.due || '2026-10-22T09:30:00Z'}'${o.annulee ? `, '2026-10-10T00:00:00Z', ${o.raison === null ? 'null' : "'remboursement'"}` : ''});`;

(async () => {
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);
  let SQL = fs.readFileSync(MIG, 'utf8');
  const mut = MUTATION ? MUTATIONS[MUTATION] : null;
  if (MUTATION && !mut) { console.log('❌ mutation inconnue — audit NON exécuté'); process.exit(1); }
  try { if (mut && mut.sql) SQL = mut.sql(SQL); } catch (e) { console.log('❌ ' + e.message + ' — audit NON exécuté'); process.exit(1); }

  await essaie('le fichier', () => {
    const sansComm = fs.readFileSync(MIG, 'utf8').replace(/--[^\n]*/g, '');
    dit(!/\bdelete\b/i.test(sansComm) && !/\bdrop\b/i.test(sansComm) && !/\btruncate\b/i.test(sansComm), "la 043 ne contient AUCUNE suppression (elle se colle d'un bloc dans l'outil SQL)");
    dit(!/app_data|vinted_accounts|harvest_/i.test(sansComm), 'la 043 ne lit AUCUNE donnée de vendeur');
  });
  const socle = await essaie('socle', () => {
    Q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login nosuperuser bypassrls inherit; end if; end $$;\ncreate database socle owner postgres;`, { role: 'supabase_admin', db: 'postgres' });
    DB = 'socle';
    ADM(fs.readFileSync(MIN, 'utf8'));
    return true;
  });
  if (!socle) { console.log('\n❌ socle impossible — audit NON exécuté'); process.exit(1); }
  const installe = await essaie('installation', () => {
    const r = run(SQL);
    if (!r.ok) throw new Error(r.err);
    const r2 = run(SQL);
    dit(r2.ok, 'la migration se rejoue sans erreur', r2.err);
    if (mut && mut.apres) ADM(mut.apres);
    return true;
  });
  if (!installe) { console.log(`\n${ok} vert(s), ${ko} rouge(s).`); process.exit(1); }

  await essaie('le serveur range', () => {
    Q(SERV + `insert into public.partenaires (id, code, nom, contact, compte, jeton_empreinte) values ('${PA}', 'LEO', 'Leo', 'leo@exemple.test', '${U.A}', '${'a'.repeat(64)}'), ('${PB}', 'MAX', 'Max', null, null, '${'b'.repeat(64)}');`);
    Q(SERV + `insert into public.partenaire_filleuls (filleul, partenaire, code) values ('${U.B}', '${PA}', 'LEO');`);
    Q(SERV + com());
    Q(SERV + `insert into public.partenaire_versements (partenaire, mois, montant_centimes, verse_le) values ('${PB}', '2026-10', 900, '2026-11-15');`);
    Q(SERV + `insert into public.partenaire_annulations (cle, signal, raison) values ('pi_x1', 'litige', 'litige');`);
    // (16 nov.) Un remboursement partiel : une ligne par geste de Stripe, le même deux fois refusé.
    Q(SERV + `insert into public.partenaire_annulations (cle, signal, raison, centimes) values ('ch_x1', 're_1', 'remboursement', 100), ('ch_x1', 're_2', 'remboursement', 50);`);
    dit(Q(SERV + `select count(*) from public.partenaire_annulations where cle = 'ch_x1';`) === '2', 'deux remboursements partiels du même paiement : deux lignes (16 nov.)');
    dit(Q(SERV + 'select count(*) from public.partenaire_commissions;') === '1', 'la clé de service range une commission et la relit');
    dit(Q(SERV + `select count(*) from public.partenaires where jeton_empreinte = '${'a'.repeat(64)}';`) === '1' && Q(SERV + `select code from public.partenaires where jeton_empreinte = '${'a'.repeat(64)}';`) === 'LEO', 'un jeton désigne UN partenaire (le sien)');
    const del = run(SERV + `delete from public.partenaire_commissions where facture = 'in_a1';`);
    dit(!del.ok && /permission denied/i.test(del.err), 'même le serveur ne SUPPRIME pas une commission (annulée = marquée)', del.ok ? 'supprimée' : '');
  });

  await essaie('droits', () => {
    for (const t of TABLES) {
      dit(Q(`select relforcerowsecurity and relrowsecurity from pg_class where relname = '${t}' and relnamespace = 'public'::regnamespace`) === 't', `${t} : RLS activée et forcée`);
      for (const [qui, pre] of [['un visiteur (anon)', ANON], ['un vendeur connecté', comme(U.B)], ['le PARTENAIRE Leo (son compte VRM)', comme(U.A)]]) {
        const r = run(pre + `select count(*) from public.${t};`);
        dit(!r.ok || r.out === '0', `${qui} ne lit pas ${t}`, r.ok ? 'lu : ' + r.out : '');
      }
    }
    const ecr = [
      ['insérer un partenaire', `insert into public.partenaires (code, nom) values ('PIRATE', 'Pirate');`],
      ['se rattacher lui-même', `insert into public.partenaire_filleuls (filleul, partenaire, code) values ('${U.A}', '${PA}', 'LEO');`],
      ['se créer une commission', com({ facture: 'in_pirate', filleul: U.A, mois: '2026-11', paye: '2026-11-02T10:00:00Z', due: '2026-11-16T10:00:00Z' })],
      ['noter un versement', `insert into public.partenaire_versements (partenaire, mois, montant_centimes, verse_le) values ('${PA}', '2026-10', 100000, '2026-11-15');`],
      ['dé-annuler / changer un montant', `update public.partenaire_commissions set montant_centimes = 300, annulee_le = null;`],
      ['changer de code', `update public.partenaires set code = 'LEO2';`],
      ['effacer une commission', `delete from public.partenaire_commissions;`],
    ];
    for (const [quoi, sql] of ecr) {
      for (const [qui, pre] of [['un vendeur', comme(U.B)], ['le partenaire Leo', comme(U.A)], ['un visiteur', ANON]]) {
        const r = run(pre + sql + '\nselect 1;');
        dit(!r.ok, `${qui} ne peut pas ${quoi}`, r.ok ? 'passé' : '');
      }
    }
    dit(Q(SERV + 'select count(*) from public.partenaire_commissions;') === '1' && Q(SERV + 'select count(*) from public.partenaires;') === '2', 'après toutes ces tentatives, la base est intacte');
  });

  await essaie('contraintes', () => {
    const refus = (nom, sql, attendu) => { const r = run(SERV + sql); dit(!r.ok && (!attendu || attendu.test(r.err)), nom, r.ok ? 'accepté' : r.err.slice(0, 120)); };
    refus('une commission de 4,00 € est refusée (300 centimes seulement)', com({ facture: 'in_a2', montant: 400, mois: '2026-11', paye: '2026-11-08T09:30:00Z', due: '2026-11-22T09:30:00Z' }), /check/);
    refus('la même facture deux fois est refusée (un webhook rejoué)', com({ mois: '2026-12', paye: '2026-12-08T09:30:00Z', due: '2026-12-22T09:30:00Z' }), /duplicate|unique/);
    refus('un 2e paiement du même client le même mois est refusé', com({ facture: 'in_a3' }), /duplicate|unique/);
    refus('due avant 14 jours est refusée', com({ facture: 'in_a4', mois: '2026-11', paye: '2026-11-08T09:30:00Z', due: '2026-11-10T09:30:00Z' }), /check/);
    refus('« annulée » sans sa raison est refusée', com({ facture: 'in_a5', mois: '2026-09', paye: '2026-09-08T09:30:00Z', due: '2026-09-22T09:30:00Z', annulee: true, raison: null }), /check/);
    refus('le même geste de Stripe rangé deux fois est refusé (16 nov.)', `insert into public.partenaire_annulations (cle, signal, raison, centimes) values ('ch_x1', 're_1', 'remboursement', 100);`, /duplicate|unique/);
    refus('un signal sans forme connue est refusé (16 nov.)', `insert into public.partenaire_annulations (cle, signal, raison) values ('ch_x1', 'n importe quoi', 'remboursement');`, /check/);
    refus('un remboursement de toute la facture sans annulation est refusé (16 nov.)', `update public.partenaire_commissions set rembourse_centimes = 1699 where facture = 'in_a1';`, /check/);
    dit(run(SERV + `update public.partenaire_commissions set rembourse_centimes = 100 where facture = 'in_a1';`).ok, 'un remboursement partiel se range sur la commission (16 nov.)');
    refus('un code en minuscules est refusé', `insert into public.partenaires (code, nom) values ('leo', 'Leo bis');`, /check/);
    refus('un code déjà pris est refusé', `insert into public.partenaires (code, nom) values ('LEO', 'Leo bis');`, /duplicate|unique/);
    refus('un même jeton pour deux partenaires est refusé', `insert into public.partenaires (code, nom, jeton_empreinte) values ('ZED', 'Zed', '${'a'.repeat(64)}');`, /duplicate|unique/);
    refus('un compte rattaché deux fois est refusé', `insert into public.partenaire_filleuls (filleul, partenaire, code) values ('${U.B}', '${PB}', 'MAX');`, /duplicate|unique/);
    const r = run(SERV + `update public.partenaire_commissions set annulee_le = now(), annulee_raison = 'remboursement' where facture = 'in_a1';\n` + com({ facture: 'in_a6', paye: '2026-10-20T09:30:00Z', due: '2026-11-03T09:30:00Z' }));
    dit(r.ok, 'après une commission ANNULÉE, un vrai paiement du même mois est accepté', r.err);
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
