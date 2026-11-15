#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « CHACUN SES DONNÉES » DE LA BASE — fonctions RPC et RLS (15 nov. 2026)
//  node scripts/audit-securite-base.cjs              (le contrôle)
//  node scripts/audit-securite-base.cjs --prouve     (chaque règle réaffaiblie doit
//                                                      faire passer l'audit au ROUGE)
//  node scripts/audit-securite-base.cjs --mutation=nom
//  node scripts/audit-securite-base.cjs --empreintes (imprime les empreintes des fonctions)
//
//  Récit : docs/passation/2026-11-15-securite-base.md.
//
//  Un Postgres JETABLE (jamais Supabase) rebâtit la production avec les VRAIES
//  migrations du dépôt, dans l'ordre où elles y sont passées
//  (scripts/agent-sql/supabase-min.sql + 005, 006, 007, 008, 018, 019, 020, 021,
//  025, 027, 041, 042), puis :
//
//   1. LE CODE EST CELUI DE LA PRODUCTION : l'empreinte (md5 de
//      pg_get_functiondef) de chaque fonction exposée et de ses aides est
//      comparée à celle relevée en production le 15 nov. (lecture seule) ; les
//      politiques d'app_data et de vinted_accounts aussi. Sinon on teste une
//      fiction : rouge.
//   2. LE CATALOGUE : toute fonction SECURITY DEFINER appelable par
//      `authenticated` doit être dans la liste REVUE (une nouvelle ⇒ rouge tant
//      qu'elle n'est pas relue et ajoutée ici), avoir `search_path` fixé à '',
//      aucun SQL dynamique (EXECUTE) ; aucune n'est appelable par `anon` ;
//      toute SECURITY DEFINER du schéma a son search_path fixé.
//   3. LES SCÉNARIOS, joués comme PostgREST les joue (`set role authenticated`
//      + `request.jwt.claims`) avec cinq comptes INVENTÉS : A et B (abonnés, en
//      relation), C (abonné, intrus), E (abonnement expiré), P (propriétaire).
//      C essaie chaque fonction sur ce qui appartient à A ou B : fil, blocage,
//      signalement, code et sortie de groupe, classement de groupe, validation,
//      retrait, aperçu, partage, « ce que voit » d'une adhésion, lecture des
//      commandes d'un autre (042)… rien ne lui est rendu, rien n'est changé.
//      Aucun résultat rendu à X ne contient l'identifiant de compte ni l'e-mail
//      d'un autre ; le nombre de ventes d'un vendeur n'apparaît que là où il a
//      consenti (classement public s'il s'y inscrit, groupe s'il y entre) ;
//      les textes ont leur plafond ; E (expiré) n'a rien ; anon n'appelle rien.
//   4. LA RLS d'app_data et de vinted_accounts : une matrice d'accès (A, B, C,
//      E expiré, anon, identité absente × lire, insérer, modifier, effacer,
//      changer de propriétaire, chez soi et chez autrui) jouée AVANT et APRÈS
//      la 036 (une permissive par table) puis la 045 : identique ; E lit ses
//      lignes et n'écrit pas ; une permissive par table ensuite.
//
//  Aucune donnée réelle : les identités, e-mails et ventes sont inventés.
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const M = (f) => path.join(RACINE, 'supabase/migrations', f);
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const ORDRE_PROD = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql', '008-detourage.sql',
  '018-communaute.sql', '019-communaute-discord-classement.sql', '020-communaute-groupes.sql',
  '021-confidentialite-boutiques.sql', '025-communaute-accompagnement.sql', '027-abonnement-apercu-et-parrainage.sql',
  '041-usage-par-vendeur.sql', '042-ecritures-atomiques.sql'];
const M036 = M('036-politiques-uniques.sql'), M045 = M('045-securite-durcissement.sql');

// Des identités INVENTÉES (aucune n'existe en production).
const U = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b',
  C: 'cccccccc-0000-4000-8000-00000000000c', E: 'eeeeeeee-0000-4000-8000-00000000000e', P: 'ffffffff-0000-4000-8000-00000000000f' };
const MAIL = (k) => `vendeur-${k.toLowerCase()}@essai.invalid`;

// ── Les fonctions REVUES le 15 nov. (code de production relu une à une) ──────
// Ajouter une fonction ici = l'avoir relue (doc §1) ET ajouté ses scénarios.
const REVUES = ['vrm_acces', 'vrm_acces_ok',
  'vrm_accomp_apercu', 'vrm_accomp_ce_que_voit', 'vrm_accomp_code', 'vrm_accomp_creer', 'vrm_accomp_decider',
  'vrm_accomp_demander', 'vrm_accomp_fermer', 'vrm_accomp_lire', 'vrm_accomp_partage', 'vrm_accomp_publier',
  'vrm_accomp_quitter', 'vrm_accomp_retirer',
  'vrm_communaute_bloquer', 'vrm_communaute_carte', 'vrm_communaute_classement', 'vrm_communaute_classement_groupe',
  'vrm_communaute_classement_inscrire', 'vrm_communaute_conversations', 'vrm_communaute_discord', 'vrm_communaute_ecrire',
  'vrm_communaute_fil', 'vrm_communaute_groupe_code', 'vrm_communaute_groupe_creer', 'vrm_communaute_groupe_quitter',
  'vrm_communaute_groupe_rejoindre', 'vrm_communaute_quitter', 'vrm_communaute_rejoindre', 'vrm_communaute_signalements',
  'vrm_communaute_signaler'];
// Empreintes relevées EN PRODUCTION le 15 nov. 2026 (md5(pg_get_functiondef), lecture seule).
const EMPREINTES_PROD = {
  vrm_acces: 'bb3be449be5c100ad988a976cd176dc4', vrm_acces_ok: 'e8cfc49fd6f0da4eba3359cde99c4ee9',
  vrm_acces_pour: 'e02c24b3a1e70dfc6230f0378f69d6e5', vrm_regle_acces: '9ef305153b6c8f6061af7935fe08cfb8',
  vrm_accomp_apercu: '53677dd9bc6998ce3212978ef0c302b4', vrm_accomp_ce_que_voit: 'e76cd00e70bde6dad77079388536b292',
  vrm_accomp_chiffres_ok: 'f9770802dd8b44507495b601c6800935', vrm_accomp_code: '88fbaac51565ba3f74b18fa55444a3ea',
  vrm_accomp_code_neuf: '030cf909a03baf89d1ffe9ecad7d70f2', vrm_accomp_creer: '26be76dd6f103e40f8d2794c8f83e6ea',
  vrm_accomp_decider: '77c4536e8fa5130e61bd3eda487d74fe', vrm_accomp_demander: '71ef9f38f35054c5f3d1e721aa9f23a3',
  vrm_accomp_detail_ok: '4397e9a282a595a36607b1028fe3bf4b', vrm_accomp_elaguer: '03450594ae6249b882fa65538f877486',
  vrm_accomp_fermer: '7baaa45c8dbdd4b5c1bf1d7da658b646', vrm_accomp_ligne_ok: 'a209668bc224567a12829116acfaefcd',
  vrm_accomp_lire: '831f062a74ce83ae755886008d57d40e', vrm_accomp_niveau: '47ee2dd59bcd4d8cec57f58aaf42334f',
  vrm_accomp_nom_ok: '6aadc5da9c4195e0042ae53975ff03f9', vrm_accomp_partage: '946a9ea3d3ecfc43eae3d80d1cc2a8c2',
  vrm_accomp_publier: '82da9080ae71db864adbf4a9de7c2163', vrm_accomp_quatre_ok: 'd1a1cc9fbad3e15db5a66f69c6d21019',
  vrm_accomp_quitter: '6e362ff4a2b5788ba2ada56441be496c', vrm_accomp_retirer: '2c7949b157f2f6f32eb9f61bea9706ac',
  vrm_accomp_vue: 'acc076b7a21f73379217c90c7984b02d',
  vrm_communaute_bloquer: 'b25a3fa2d2b74449d24b828c5a686f4d', vrm_communaute_carte: '65873a4e444b5c40d0cf87fc020fd7d2',
  vrm_communaute_classement: 'b7ca538ff712df7c384236693609a440', vrm_communaute_classement_calc: 'f5b45fdc0768603f5853ca2eadfc0fe2',
  vrm_communaute_classement_groupe: '217d8258f4fa00ea838183ed87c2e6f3', vrm_communaute_classement_inscrire: '6909a2632d93967e66477f4caf0ce8ec',
  vrm_communaute_code_lu: '8fb310e5d3f17935a2e7952e36be3bad', vrm_communaute_code_neuf: '381c8e91ec8f8285a34228bb40bf0d80',
  vrm_communaute_conversations: 'e47ec710d2262e2df69a417a7fb31d4d', vrm_communaute_discord: '5257132706f38ca2cf6fa365febbc568',
  vrm_communaute_ecrire: 'f1814fd9e444ab922e3fe863534b9aea', vrm_communaute_effacer: '24e3b428f3c30c904f7585c7ad5c71c8',
  vrm_communaute_fil: '6acdbe9950a2514567762ec35006f61a', vrm_communaute_groupe_code: '6be2e803cb06966df74d317a11f3439f',
  vrm_communaute_groupe_creer: '36c04beba0f886b912c3d8a665f90fa3', vrm_communaute_groupe_quitter: 'bbd2e9bccde5cd18bf757b39719cd634',
  vrm_communaute_groupe_rejoindre: '90ff0a0149ce3e21524b4b7cd418b1ae', vrm_communaute_quitter: 'a0e05d312e123dbf5119bd93f2d43675',
  vrm_communaute_rejoindre: '92100cf464466b5ada778d09a4605c92', vrm_communaute_signalements: '272c3ac7fff4e272356fdad9beefa11d',
  vrm_communaute_signaler: 'c3e26dc2c3f78fe838f7a44c6eea7adb', vrm_communaute_ts: '93d622d97e2efd577235f586409193ef',
};
// Politiques d'app_data et de vinted_accounts relevées EN PRODUCTION le 15 nov. (pg_policies).
const POLITIQUES_PROD = [
  'app_data|chacun ses lignes|PERMISSIVE|{authenticated}|ALL|(owner = ( SELECT auth.uid() AS uid))|(owner = ( SELECT auth.uid() AS uid))',
  'app_data|tout_insert|PERMISSIVE|{authenticated}|INSERT||(owner = ( SELECT auth.uid() AS uid))',
  'app_data|tout_select|PERMISSIVE|{authenticated}|SELECT|(owner = ( SELECT auth.uid() AS uid))|',
  'app_data|tout_update|PERMISSIVE|{authenticated}|UPDATE|(owner = ( SELECT auth.uid() AS uid))|(owner = ( SELECT auth.uid() AS uid))',
  'app_data|vrm_proprietaire_permis|PERMISSIVE|{authenticated}|ALL|(owner = ( SELECT auth.uid() AS uid))|(owner = ( SELECT auth.uid() AS uid))',
  'app_data|abonnement_requis|RESTRICTIVE|{authenticated}|ALL|true|( SELECT vrm_acces_ok() AS vrm_acces_ok)',
  'app_data|abonnement_requis_effacer|RESTRICTIVE|{authenticated}|DELETE|( SELECT vrm_acces_ok() AS vrm_acces_ok)|',
  'app_data|vrm_anon_ferme|RESTRICTIVE|{anon}|ALL|false|false',
  'app_data|vrm_insertion_privee|RESTRICTIVE|{authenticated}|INSERT||(owner = ( SELECT auth.uid() AS uid))',
  'app_data|vrm_lecture_privee|RESTRICTIVE|{authenticated}|SELECT|(owner = ( SELECT auth.uid() AS uid))|',
  'app_data|vrm_modification_privee|RESTRICTIVE|{authenticated}|UPDATE|(owner = ( SELECT auth.uid() AS uid))|(owner = ( SELECT auth.uid() AS uid))',
  'app_data|vrm_suppression_privee|RESTRICTIVE|{authenticated}|DELETE|(owner = ( SELECT auth.uid() AS uid))|',
  'vinted_accounts|chacun ses comptes|PERMISSIVE|{authenticated}|ALL|(owner = ( SELECT auth.uid() AS uid))|(owner = ( SELECT auth.uid() AS uid))',
  'vinted_accounts|vrm_proprietaire_permis|PERMISSIVE|{authenticated}|ALL|(owner = ( SELECT auth.uid() AS uid))|(owner = ( SELECT auth.uid() AS uid))',
  'vinted_accounts|abonnement_requis|RESTRICTIVE|{authenticated}|ALL|true|( SELECT vrm_acces_ok() AS vrm_acces_ok)',
  'vinted_accounts|abonnement_requis_effacer|RESTRICTIVE|{authenticated}|DELETE|( SELECT vrm_acces_ok() AS vrm_acces_ok)|',
  'vinted_accounts|vrm_anon_ferme|RESTRICTIVE|{anon}|ALL|false|false',
  'vinted_accounts|vrm_insertion_privee|RESTRICTIVE|{authenticated}|INSERT||(owner = ( SELECT auth.uid() AS uid))',
  'vinted_accounts|vrm_lecture_privee|RESTRICTIVE|{authenticated}|SELECT|(owner = ( SELECT auth.uid() AS uid))|',
  'vinted_accounts|vrm_modification_privee|RESTRICTIVE|{authenticated}|UPDATE|(owner = ( SELECT auth.uid() AS uid))|(owner = ( SELECT auth.uid() AS uid))',
  'vinted_accounts|vrm_suppression_privee|RESTRICTIVE|{authenticated}|DELETE|(owner = ( SELECT auth.uid() AS uid))|',
];

const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');
const EMPREINTES = args.includes('--empreintes');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).replace(/\s*\n\s*/g, ' ').slice(0, 300) : '')); };

// Une fonction réécrite à partir de SON code en base (remplacement exact, une fois).
const affaiblir = (sig, avant, apres) => `do $m$ declare d text := pg_catalog.pg_get_functiondef('${sig}'::regprocedure); begin
  if pg_catalog.strpos(d, ${lit(avant)}) = 0 then raise exception 'mutation : ancre introuvable dans ${sig}'; end if;
  execute pg_catalog.replace(d, ${lit(avant)}, ${lit(apres)}); end $m$;`;
function lit(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

// Chaque règle, réaffaiblie : l'audit doit passer au ROUGE.
const MUTATIONS = {
  // Le fil d'une conversation lisible par qui n'en est pas.
  'fil-sans-membre': { avant036: affaiblir('public.vrm_communaute_fil(uuid)', 'where x.id = p_conv and (x.a = moi or x.b = moi)', 'where x.id = p_conv') },
  // Bloquer / signaler la conversation d'autrui.
  'signaler-sans-membre': { avant036: affaiblir('public.vrm_communaute_signaler(uuid, text)', 'where x.id = p_conv and (x.a = moi or x.b = moi)', 'where x.id = p_conv') },
  // « Ce que voit le créateur » d'une adhésion qui n'est pas la sienne.
  'voit-sans-adhesion': { avant036: affaiblir('public.vrm_accomp_ce_que_voit(uuid)', 'm.id = p_adhesion and m.owner = auth.uid() and', 'm.id = p_adhesion and') },
  // N'importe qui valide une demande d'accompagnement.
  'decider-sans-createur': { avant036: affaiblir('public.vrm_accomp_decider(uuid, boolean)', 'where y.id = p_membre and g.cree_par = moi and', 'where y.id = p_membre and') },
  // Le classement d'un groupe dont on n'est pas.
  'classement-groupe-sans-membre': { avant036: affaiblir('public.vrm_communaute_classement_groupe(text, uuid)', 'where m.groupe = p_groupe and p.owner = auth.uid() and', 'where m.groupe = p_groupe and') },
  // Le classement PUBLIC compte ceux qui ne s'y sont pas inscrits.
  'classement-sans-accord': { avant036: affaiblir('public.vrm_communaute_classement_calc(text, uuid)', 'then p.classement', 'then true') },
  // L'identifiant de compte d'un membre rendu au créateur.
  'owner-rendu': { avant036: affaiblir('public.vrm_accomp_vue(uuid)', "jsonb_build_object('id', m.id, 'nom', m.nom,", "jsonb_build_object('id', m.id, 'owner', m.owner, 'nom', m.nom,") },
  // Le plafond de longueur d'un message retiré.
  'message-sans-plafond': { avant036: affaiblir('public.vrm_communaute_ecrire(uuid, text)', "pg_catalog.char_length(t) > 500", "pg_catalog.char_length(t) > 500000") },
  // Les signalements lisibles par tous.
  'signalements-ouverts': { avant036: affaiblir('public.vrm_communaute_signalements()', "  select case when auth.uid() is null\n      or auth.uid()::text is distinct from (select r.valeur from public.vrm_reglages r where r.cle = 'proprietaire') then null", "  select case when auth.uid() is null then null") },
  // Une nouvelle SECURITY DEFINER exposée, non revue, qui lit les lignes d'un autre.
  'definer-non-revue': { avant036: `create function public.vrm_fuite(u uuid) returns bigint language sql stable security definer set search_path = '' as $f$ select pg_catalog.count(*) from public.app_data a where a.owner = u $f$;
    revoke all on function public.vrm_fuite(uuid) from public, anon; grant execute on function public.vrm_fuite(uuid) to authenticated;` },
  // search_path ouvert sur une fonction exposée.
  'search-path-ouvert': { avant036: `alter function public.vrm_communaute_carte() reset search_path;` },
  // Une fonction exposée appelable par anon.
  'anon-execute': { avant036: `grant execute on function public.vrm_communaute_carte() to anon;` },
  // 042 en SECURITY DEFINER : la RLS ne protège plus les commandes d'un autre.
  'commandes-definer': { avant036: `alter function public.vrm_commandes_lire(text, uuid, text[]) security definer;` },
  // La 036 retire AUSSI la permissive gardée : la matrice doit changer.
  '036-retire-tout': { apres036: `drop policy if exists vrm_proprietaire_permis on public.app_data;` },
  // Une restrictive de lecture retirée et une permissive trop large posée.
  'rls-trop-large': { apres036: `drop policy vrm_lecture_privee on public.app_data; create policy trop_large on public.app_data for select to authenticated using (true);` },
  // L'abonnement expiré écrit quand même.
  'expire-ecrit': { apres036: `alter policy abonnement_requis on public.app_data with check (true);` },
};

if (PROUVE) {
  const noms = Object.keys(MUTATIONS);
  let rouges = 0;
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const n = (r.stdout.match(/^❌ /gm) || []).length;
    const sautee = /NON exécuté|ancre introuvable/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && n > 0 && !sautee;
    if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'audit non exécuté ou ancre introuvable' : 'RESTE VERTE : le contrôle ne mord pas')}`);
    if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 2)) console.log('      ' + l.slice(0, 220));
  }
  console.log(`\n${rouges}/${noms.length} mutations attrapées.`);
  process.exit(rouges === noms.length ? 0 : 1);
}
if (MUTATION && !MUTATIONS[MUTATION]) { console.log('❌ mutation inconnue : ' + MUTATION); process.exit(1); }
const MUT = MUTATION ? MUTATIONS[MUTATION] : {};

// ── Le Postgres jetable ──────────────────────────────────────────────────────
function trouverBin() {
  const avec = (d) => d && ['initdb', 'pg_ctl', 'postgres', 'psql'].every((n) => fs.existsSync(path.join(d, n)));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  try { const v = fs.readdirSync('/usr/lib/postgresql').filter((x) => avec(path.join('/usr/lib/postgresql', x, 'bin'))).sort((a, b) => Number(b) - Number(a)); if (v.length) return path.join('/usr/lib/postgresql', v[0], 'bin'); } catch (_) {}
  try { const d = execFileSync('pg_config', ['--bindir'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (avec(d)) return d; } catch (_) {}
  return null;
}
const BIN = trouverBin();
if (!BIN) { console.log('❌ Postgres introuvable (initdb, pg_ctl, postgres, psql) — audit NON exécuté. Installe postgresql (16+), ou donne PG_BIN=/chemin/vers/bin.'); process.exit(1); }
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
let UIDG = null;
if (ROOT) {
  try { UIDG = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString().trim()) }; }
  catch (_) { console.log('❌ lancé en root sans utilisateur système « postgres » — audit NON exécuté.'); process.exit(1); }
}
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-securite-base-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(52000 + (process.pid % 3000));
const serveur = (cmd, a) => spawnSync(path.join(BIN, cmd), a, { encoding: 'utf8', ...(UIDG || {}) });
let demarre = false;
const arreter = () => { if (demarre) { serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} };
process.on('exit', arreter);
process.on('SIGINT', () => { arreter(); process.exit(1); });
process.on('SIGTERM', () => { arreter(); process.exit(1); });
{
  const r = serveur('initdb', ['-D', DIR + '/data', '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  if (r.status !== 0) { console.log('❌ initdb a échoué — audit NON exécuté : ' + (r.stderr || r.stdout).slice(0, 300)); process.exit(1); }
  const s = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c timezone=UTC`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) { console.log('❌ Postgres n\'a pas démarré — audit NON exécuté : ' + (s.stderr || s.stdout).slice(0, 300)); process.exit(1); }
  demarre = true;
}
const DB = 'essai';
const psql = (sql, role = 'postgres', db = DB) => {
  const r = spawnSync(path.join(BIN, 'psql'), ['-h', DIR, '-p', PORT, '-U', role, '-d', db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const Q = (sql, role) => { const r = psql(sql, role); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
const ADM = (sql) => Q(sql, 'supabase_admin');

// Un appel « comme PostgREST » : rôle + revendications du jeton, dans SA transaction.
const jeton = (k) => `set local role authenticated; set local "request.jwt.claims" = '${JSON.stringify({ sub: U[k], role: 'authenticated' })}';`;
const comme = (k) => k === 'anon' ? 'set local role anon;' : k === 'vide' ? `set local role authenticated; set local "request.jwt.claims" = '{"role":"authenticated"}';` : jeton(k);
const VUS = []; // tout ce qui a été rendu, par appelant : [qui, texte]
function rpc(k, appel) {
  const r = psql(`begin; ${comme(k)} select (${appel})::text; commit;`);
  const out = r.ok ? r.out.split('\n').pop() : 'REFUS:' + r.err.split('\n')[0];
  VUS.push([k, out]);
  return out;
}
const J = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };

let MATRICE_AVANT = null;
try {
  // 1. Le socle de production.
  for (const sql of [`do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login nosuperuser bypassrls inherit; end if; end $$;`, `create database ${DB} owner postgres;`]) {
    const r = psql(sql, 'supabase_admin', 'postgres'); if (!r.ok) throw new Error(r.err);
  }
  Q(fs.readFileSync(MIN, 'utf8'), 'supabase_admin');
  ADM(`alter table auth.users add column if not exists email text;
    -- storage (forme minimale, pour la 008) : le seau et la table des fichiers.
    create schema if not exists storage; grant usage on schema storage to postgres, anon, authenticated;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $f$ select pg_catalog.string_to_array(name, '/') $f$;
    alter table storage.buckets owner to postgres; alter table storage.objects owner to postgres;`);
  for (const f of ORDRE_PROD) {
    const r = psql(fs.readFileSync(M(f), 'utf8'));
    if (!r.ok) throw new Error(`migration ${f} refusée sur le socle : ${r.err.slice(0, 300)}`);
  }

  // 1 bis. --empreintes : imprimer et sortir.
  // Deux empreintes par fonction : le texte exact, et le texte sans ses lignes de
  // commentaire (la production a reçu certains corps sans commentaires, ex.
  // vrm_regle_acces collée par l'outil SQL — même code, autre texte).
  const empreintes = () => Object.fromEntries(Q(`select p.proname || '=' || pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) || ',' ||
       pg_catalog.md5(pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(p.oid), E'\\n[ \\t]*--[^\\n]*', '', 'g')) from pg_proc p
     where p.pronamespace = 'public'::regnamespace and (p.proname like 'vrm_acc%' or p.proname like 'vrm_communaute_%' or p.proname = 'vrm_regle_acces') order by 1`).split('\n').map((l) => l.split('=')));
  if (EMPREINTES) { console.log(JSON.stringify(empreintes(), null, 1)); process.exit(0); }

  // 2. Le code est celui de la production.
  {
    const ici = empreintes();
    const ecarts = Object.keys(EMPREINTES_PROD).filter((n) => !String(ici[n] || '').split(',').includes(EMPREINTES_PROD[n]));
    dit(ecarts.length === 0, `base jetable = production : les ${Object.keys(EMPREINTES_PROD).length} fonctions exposées et leurs aides ont l'empreinte relevée en production le 15 nov.`, ecarts.length ? 'écarts : ' + ecarts.join(', ') : '');
    const pol = Q(`select tablename||'|'||policyname||'|'||permissive||'|'||roles::text||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'')
      from pg_policies where schemaname='public' and tablename in ('app_data','vinted_accounts') order by tablename, permissive, policyname`).split('\n');
    const attendu = [...POLITIQUES_PROD].sort(), lu = [...pol].sort();
    const manque = attendu.filter((x) => !lu.includes(x)), trop = lu.filter((x) => !attendu.includes(x));
    dit(!manque.length && !trop.length, `base jetable = production : les ${attendu.length} politiques d'app_data et vinted_accounts sont celles relevées le 15 nov.`, [...manque.map((x) => 'manque ' + x), ...trop.map((x) => 'en trop ' + x)].join(' ; '));
  }

  // 3. Les identités inventées, l'abonnement OBLIGATOIRE (le cas qui ferme), E expiré.
  ADM(`insert into auth.users (id, email) values ${Object.entries(U).map(([k, u]) => `('${u}', '${MAIL(k)}')`).join(',')};
    update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire';
    update public.vrm_reglages set valeur = '${U.P}' where cle = 'proprietaire';
    insert into public.abonnements (owner, statut) values ('${U.A}', 'active'), ('${U.B}', 'active'), ('${U.C}', 'trialing'), ('${U.E}', 'canceled');`);
  // Les ventes (inventées) : A 2, B 3, C 5 ; datées de maintenant.
  const maintenant = new Date().toISOString();
  const ventes = (n, p) => JSON.stringify({ capturedAt: 1, rev: '1', payload: { my_orders: Array.from({ length: n }, (_, i) => ({ transaction_id: `${p}${i}`, date: maintenant, status: 'Commande finalisée' })) } });
  for (const [k, vid, n] of [['A', '800', 2], ['B', '900', 3], ['C', '700', 5], ['E', '600', 1]]) {
    ADM(`insert into public.vinted_accounts (owner, vinted_user_id, login) values ('${U[k]}', '${vid}', 'compte_${k.toLowerCase()}');
      insert into public.app_data (owner, id, data) values ('${U[k]}', 'main', '{"vinted_accounts_hidden":[]}'),
        ('${U[k]}', 'harvest_${vid}_orders_sold', '${ventes(n, k.toLowerCase() + 'tx')}');`);
  }

  if (MUT.avant036) Q(MUT.avant036);

  // 4. LE CATALOGUE des fonctions exposées.
  {
    const lignes = Q(`select p.proname || '|' || p.prosecdef || '|' || coalesce(pg_catalog.array_to_string(p.proconfig, ','), '') || '|' ||
        has_function_privilege('authenticated', p.oid, 'execute') || '|' || has_function_privilege('anon', p.oid, 'execute') || '|' ||
        (p.prolang = (select oid from pg_language where lanname = 'plpgsql') and p.prosrc ~* '(^|[^a-z_])execute[[:space:]]')
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' order by 1`).split('\n').map((l) => l.split('|'));
    const T = 'true';
    const exposeesDefiner = lignes.filter((l) => l[1] === T && l[3] === T).map((l) => l[0]);
    const nonRevues = exposeesDefiner.filter((n) => !REVUES.includes(n));
    dit(nonRevues.length === 0, `catalogue : chaque SECURITY DEFINER appelable par un vendeur connecté est dans la liste REVUE (${exposeesDefiner.length} exposées)`, nonRevues.length ? 'NON REVUES : ' + nonRevues.join(', ') : '');
    const absentes = REVUES.filter((n) => !exposeesDefiner.includes(n));
    dit(absentes.length === 0, 'catalogue : les 31 fonctions revues sont bien là, appelables (sinon l\'app ne marche plus)', absentes.join(', '));
    const anon = lignes.filter((l) => l[1] === T && l[4] === T).map((l) => l[0]);
    dit(anon.length === 0, 'catalogue : aucune SECURITY DEFINER n\'est appelable par anon (sans session)', anon.join(', '));
    const sp = lignes.filter((l) => l[1] === T && !/search_path=/.test(l[2])).map((l) => l[0]);
    dit(sp.length === 0, 'catalogue : chaque SECURITY DEFINER du schéma a son search_path fixé', sp.join(', '));
    const spVide = lignes.filter((l) => l[1] === T && l[3] === T && l[2] !== 'search_path=""').map((l) => l[0] + ' (' + l[2] + ')');
    dit(spVide.length === 0, 'catalogue : chaque SECURITY DEFINER exposée a search_path = \'\' (tout est écrit schéma.objet)', spVide.join(', '));
    const dyn = lignes.filter((l) => l[1] === T && l[3] === T && l[5] === T).map((l) => l[0]);
    dit(dyn.length === 0, 'catalogue : aucune SECURITY DEFINER exposée ne fait de SQL dynamique (EXECUTE)', dyn.join(', '));
    const tables = Q(`select c.relname || '|' || c.relrowsecurity || '|' ||
        (has_table_privilege('authenticated', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'update') or has_table_privilege('authenticated', c.oid, 'delete')) || '|' ||
        (select count(*) from pg_policies k where k.schemaname = 'public' and k.tablename = c.relname)
      from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and (c.relname like 'vrm_communaute_%' or c.relname like 'vrm_accomp_%' or c.relname in ('vrm_reglages', 'parrainages', 'parrainage_codes')) order by 1`).split('\n').map((l) => l.split('|'));
    const ouvertes = tables.filter((t) => t[1] !== T || t[2] === T).map((t) => t[0]);
    dit(tables.length >= 10 && ouvertes.length === 0, `tables sans politique (${tables.length} relues : communauté, accompagnement, réglages, parrainage) : RLS activée et AUCUN droit pour authenticated — on n'y entre que par les fonctions`, ouvertes.join(', '));
  }

  // 5. LES SCÉNARIOS — communauté.
  const pid = {};
  for (const k of ['A', 'B', 'C']) {
    const r = J(rpc(k, `public.vrm_communaute_rejoindre('Pseudo${k}', 'Ville${k}', 'FR', 48.8566, 2.3522)`));
    pid[k] = r && r.pid;
  }
  dit(pid.A && pid.B && pid.C, 'communauté : A, B, C rejoignent la carte');
  dit((J(rpc('E', `public.vrm_communaute_rejoindre('PseudoE', 'VilleE', 'FR', 45, 5)`)) || {}).raison === 'abonnement', 'communauté : E (abonnement expiré) ne peut pas rejoindre la carte');
  {
    const carte = J(rpc('C', 'public.vrm_communaute_carte()'));
    const pos = (carte && carte.profils || []).map((p) => [p.lat, p.lon]);
    dit(pos.length === 3 && pos.every(([la, lo]) => Math.abs(la * 20 - Math.round(la * 20)) < 1e-9 && Math.abs(lo * 20 - Math.round(lo * 20)) < 1e-9), 'carte : la position rendue n\'est jamais exacte (cellule de 0,05°)', JSON.stringify(pos));
  }
  const grp = J(rpc('A', `public.vrm_communaute_groupe_creer('Groupe essai')`)) || {};
  dit((J(rpc('B', `public.vrm_communaute_groupe_rejoindre('${grp.code}')`)) || {}).ok === true, 'groupe : A crée un groupe à code, B le rejoint');
  dit((J(rpc('C', `public.vrm_communaute_classement_groupe('annee', '${grp.id}')`)) || {}).erreur === 'groupe', 'groupe : C (pas membre) ne lit pas le classement du groupe');
  {
    const cl = J(rpc('B', `public.vrm_communaute_classement_groupe('annee', '${grp.id}')`)) || {};
    const v = Object.fromEntries((cl.lignes || []).map((l) => [l.pid, l.ventes]));
    dit(v[pid.A] === 2 && v[pid.B] === 3 && !(pid.C in v), 'groupe : B (membre) voit le nombre de ventes de A et B, jamais celui de C', JSON.stringify(v));
  }
  dit((J(rpc('C', `public.vrm_communaute_groupe_code('${grp.id}')`)) || {}).raison === 'pas-createur', 'groupe : C ne change pas le code du groupe de A');
  rpc('C', `public.vrm_communaute_groupe_quitter('${grp.id}')`);
  dit(Q(`select count(*) from public.vrm_communaute_membres where groupe = '${grp.id}' and quitte_le is null`) === '2', 'groupe : « quitter » appelé par C ne fait sortir personne');
  {
    const g0 = J(rpc('C', `public.vrm_communaute_classement('annee')`)) || {};
    dit(g0.acces === true && (g0.lignes || []).length === 0, 'classement public : personne inscrit ⇒ aucun nombre de ventes rendu', JSON.stringify(g0.lignes));
    rpc('A', 'public.vrm_communaute_classement_inscrire(true)');
    const g1 = J(rpc('C', `public.vrm_communaute_classement('annee')`)) || {};
    const v = Object.fromEntries((g1.lignes || []).map((l) => [l.pid, l.ventes]));
    dit(v[pid.A] === 2 && !(pid.B in v) && !(pid.C in v), 'classement public : seul A (inscrit) y figure ; B et C (pas inscrits) jamais', JSON.stringify(v));
  }
  const conv = (J(rpc('A', `public.vrm_communaute_ecrire('${pid.B}', 'Bonjour B, message privé')`)) || {}).conv;
  dit(!!conv, 'messages : A écrit à B');
  dit(rpc('C', `public.vrm_communaute_fil('${conv}')`) === '', 'messages : C ne lit pas le fil de A et B');
  dit(!rpc('C', 'public.vrm_communaute_conversations()').includes(conv), 'messages : la conversation de A et B n\'est pas dans la liste de C');
  dit(rpc('C', `public.vrm_communaute_bloquer('${conv}', true)`) === 'false' && Q('select count(*) from public.vrm_communaute_blocages') === '0', 'messages : C ne bloque rien au nom de la conversation de A et B');
  dit(rpc('C', `public.vrm_communaute_signaler('${conv}', 'faux')`) === 'false', 'messages : C ne signale pas la conversation de A et B (il n\'en lirait pas l\'extrait)');
  dit((J(rpc('B', `public.vrm_communaute_fil('${conv}')`)) || { messages: [] }).messages.some((m) => /message privé/.test(m.texte)), 'messages : B (destinataire) lit le fil');
  dit(rpc('B', `public.vrm_communaute_signaler('${conv}', '${'x'.repeat(5000)}')`) === 'true' && Q('select max(char_length(raison)) from public.vrm_communaute_signalements') === '300', 'messages : B signale ; la raison est bornée à 300 signes même par un appel direct');
  for (const k of ['A', 'B', 'C']) dit(rpc(k, 'public.vrm_communaute_signalements()') === '', `signalements : ${k} (pas propriétaire) ne les lit pas`);
  dit((J(rpc('P', 'public.vrm_communaute_signalements()')) || []).length === 1, 'signalements : le propriétaire les lit');
  dit((J(rpc('A', `public.vrm_communaute_ecrire('${pid.B}', '${'y'.repeat(501)}')`)) || {}).raison === 'texte', 'plafond : un message de 501 signes est refusé par la base (appel direct, sans le serveur)');
  dit((J(rpc('C', `public.vrm_communaute_rejoindre('${'p'.repeat(31)}', 'Ville', 'FR', 1, 1)`)) || {}).raison === 'pseudo', 'plafond : pseudo de 31 signes refusé');
  dit((J(rpc('C', `public.vrm_communaute_rejoindre('PseudoC', '${'v'.repeat(81)}', 'FR', 1, 1)`)) || {}).raison === 'ville', 'plafond : ville de 81 signes refusée');
  dit((J(rpc('C', `public.vrm_communaute_rejoindre('a@b.fr', 'Ville', 'FR', 1, 1)`)) || {}).raison === 'pseudo', 'plafond : un pseudo qui ressemble à un e-mail (@) est refusé');
  dit((J(rpc('A', `public.vrm_communaute_groupe_creer('${'g'.repeat(41)}')`)) || {}).raison === 'nom-groupe', 'plafond : nom de groupe de 41 signes refusé');
  dit((J(rpc('A', `public.vrm_communaute_discord('a'' or 1=1 --')`)) || {}).raison === 'discord', 'plafond : un pseudo Discord hors forme (apostrophe, espace) est refusé');

  // 6. LES SCÉNARIOS — accompagnement.
  const acc = J(rpc('A', `public.vrm_accomp_creer('Accompagnement essai', 'description', 'Coach A')`)) || {};
  dit(acc.ok === true && !!acc.code, 'accompagnement : A crée un groupe');
  const adh = (J(rpc('B', `public.vrm_accomp_demander('${acc.code}', 'Élève B', 'detail')`)) || {}).id;
  dit(!!adh, 'accompagnement : B demande à entrer en partageant le détail');
  dit(!rpc('C', `public.vrm_accomp_apercu('${acc.code}')`).includes('Élève B'), 'accompagnement : l\'aperçu par code (C) ne nomme aucun membre');
  dit((J(rpc('C', `public.vrm_accomp_decider('${adh}', true)`)) || {}).raison === 'pas-createur', 'accompagnement : C ne valide pas la demande de B');
  dit((J(rpc('C', `public.vrm_accomp_retirer('${adh}')`)) || {}).raison === 'pas-createur', 'accompagnement : C ne retire pas B');
  dit((J(rpc('C', `public.vrm_accomp_code('${acc.id}')`)) || {}).raison === 'pas-createur', 'accompagnement : C ne change pas le code de A');
  dit((J(rpc('C', `public.vrm_accomp_fermer('${acc.id}')`)) || {}).raison === 'pas-createur', 'accompagnement : C ne ferme pas le groupe de A');
  dit((J(rpc('C', `public.vrm_accomp_ce_que_voit('${adh}')`)) || {}).erreur === 'adhesion', 'accompagnement : C ne lit pas « ce que voit le créateur » de l\'adhésion de B');
  dit((J(rpc('C', `public.vrm_accomp_partage('${adh}', 'rien')`)) || {}).raison === 'adhesion' && (J(rpc('C', `public.vrm_accomp_quitter('${adh}')`)) || {}).raison === 'adhesion', 'accompagnement : C ne change pas le partage de B et ne le fait pas partir');
  const chiffres = JSON.stringify({ v: '1', ventes: true, achats: true, semaines: { '2026-W46': [3, 15000, 1, 4000] }, mois: { '2026-11': [3, 15000, 1, 4000] } });
  const detail = JSON.stringify({ v: '1', ventes: [[1, 'Paire secrète B', 'compte_b', 'vinted', 50]], achats: [] });
  dit((J(rpc('B', `public.vrm_accomp_publier('${chiffres}', '${detail}')`)) || {}).ok === true, 'accompagnement : B publie ses chiffres et son détail');
  dit(!rpc('A', 'public.vrm_accomp_lire()').includes('Paire secrète B'), 'accompagnement : tant que A n\'a pas validé, il ne voit rien de B');
  dit((J(rpc('A', `public.vrm_accomp_decider('${adh}', true)`)) || {}).statut === 'accepte', 'accompagnement : A valide B');
  dit(rpc('A', 'public.vrm_accomp_lire()').includes('Paire secrète B'), 'accompagnement : A (créateur) voit le détail que B partage');
  {
    const c = rpc('C', 'public.vrm_accomp_lire()');
    dit(!c.includes('Paire secrète B') && !c.includes(acc.id) && !c.includes('Élève B'), 'accompagnement : C ne voit ni le groupe de A ni rien de B');
  }
  rpc('B', `public.vrm_accomp_partage('${adh}', 'chiffres')`);
  dit(!rpc('A', 'public.vrm_accomp_lire()').includes('Paire secrète B') && Q(`select count(*) from public.vrm_accomp_partages where detail is not null`) === '0', 'accompagnement : B réduit à « chiffres » ⇒ A ne voit plus le détail, et il est effacé de la base');
  dit((J(rpc('B', `public.vrm_accomp_publier('${JSON.stringify({ v: '1', ventes: true, achats: true, semaines: {}, mois: {}, intrus: 'x'.repeat(10) })}', null)`)) || {}).raison === 'forme', 'plafond : une forme publiée inconnue n\'est pas rangée');
  dit((J(rpc('A', `public.vrm_accomp_creer('Nom', '${'d'.repeat(501)}', 'Coach A')`)) || {}).raison === 'description', 'plafond : description d\'accompagnement de 501 signes refusée');

  // 7. 042 : lire ou réécrire les commandes d'un autre (fonctions INVOKER sous RLS).
  dit(rpc('A', `public.vrm_commandes_lire('harvest_900_orders_sold', '${U.B}', array['btx0'])`) === '', '042 : A ne lit pas les commandes de B en passant le n° de B');
  {
    const avant = Q(`select md5(data::text) from public.app_data where owner = '${U.B}' and id = 'harvest_900_orders_sold'`);
    const r = rpc('A', `public.vrm_commandes_ecrire('harvest_900_orders_sold', '${U.B}', '1', '1', '[]', '{}', '{"payload":{}}')`);
    dit(r === '0' && Q(`select md5(data::text) from public.app_data where owner = '${U.B}' and id = 'harvest_900_orders_sold'`) === avant, '042 : A ne réécrit pas les commandes de B', r);
    dit(/"cap"/.test(rpc('A', `public.vrm_commandes_lire('harvest_800_orders_sold', '${U.A}', array['atx0'])`)), '042 : A lit ses propres commandes (le contrôle n\'est pas un refus aveugle)');
  }

  // 8. E (expiré) et anon.
  for (const f of ['public.vrm_communaute_carte()', 'public.vrm_accomp_lire()', `public.vrm_communaute_classement('annee')`]) dit((J(rpc('E', f)) || {}).acces === false, `abonnement expiré : ${f.replace('public.', '')} ⇒ « acces: false », rien d'autre`);
  {
    const sig = Q(`select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute') order by 1`).split('\n');
    const passent = sig.filter((s) => {
      const nul = s.replace(/^[^(]+\(/, '').replace(/\)$/, '').split(',').filter((x) => x.trim()).map((t) => `null::${t.trim()}`).join(', ');
      return !rpc('anon', `${s.replace(/\(.*$/, '')}(${nul})`).startsWith('REFUS:');
    });
    dit(sig.length >= 31 && passent.length === 0, `anon : chacune des ${sig.length} fonctions exposées refuse un appel sans session`, passent.join(', '));
  }

  // 9. Aucune réponse ne porte l'identifiant de compte ni l'e-mail d'UN AUTRE.
  {
    const fuites = [];
    for (const [k, out] of VUS) for (const [j, u] of Object.entries(U)) {
      if (j === k) continue;
      if (out.includes(u) || out.includes(MAIL(j))) fuites.push(`${k} a reçu ${j === 'P' ? 'le propriétaire' : j}`);
    }
    dit(fuites.length === 0, `aucune des ${VUS.length} réponses rendues ne contient l'identifiant de compte ni l'e-mail d'un autre`, [...new Set(fuites)].join(', '));
  }

  // 10. LA RLS : matrice avant / après la 036 puis la 045.
  const acteurs = ['A', 'B', 'C', 'E', 'anon', 'vide'];
  const op = (k, sql) => { const r = psql(`begin; ${comme(k)} ${sql}; rollback;`); return r.ok ? (r.out.split('\n').pop() || '∅') : 'REFUS'; };
  const matrice = () => {
    const l = [];
    for (const k of acteurs) {
      const moi = U[k] || U.A;
      for (const [cible, u] of [['soi', moi], ['A', U.A], ['B', U.B]]) {
        l.push([`app_data ${k}→${cible} lire`, op(k, `select string_agg(id, ',' order by id) from public.app_data where owner = '${u}'`)]);
        l.push([`app_data ${k}→${cible} insérer`, op(k, `with x as (insert into public.app_data (owner, id, data) values ('${u}', 'neuf', '{}') returning 1) select count(*) from x`)]);
        l.push([`app_data ${k}→${cible} modifier`, op(k, `with x as (update public.app_data set data = '{"m":1}' where owner = '${u}' returning 1) select count(*) from x`)]);
        l.push([`app_data ${k}→${cible} effacer`, op(k, `with x as (delete from public.app_data where owner = '${u}' returning 1) select count(*) from x`)]);
        l.push([`vinted_accounts ${k}→${cible} lire`, op(k, `select string_agg(vinted_user_id, ',' order by vinted_user_id) from public.vinted_accounts where owner = '${u}'`)]);
        l.push([`vinted_accounts ${k}→${cible} insérer`, op(k, `with x as (insert into public.vinted_accounts (owner, vinted_user_id) values ('${u}', '123') returning 1) select count(*) from x`)]);
        l.push([`vinted_accounts ${k}→${cible} modifier`, op(k, `with x as (update public.vinted_accounts set login = 'x' where owner = '${u}' returning 1) select count(*) from x`)]);
        l.push([`vinted_accounts ${k}→${cible} effacer`, op(k, `with x as (delete from public.vinted_accounts where owner = '${u}' returning 1) select count(*) from x`)]);
      }
      l.push([`app_data ${k} vers B`, op(k, `with x as (update public.app_data set owner = '${U.B}' where owner = '${moi}' returning 1) select count(*) from x`)]);
      l.push([`app_data ${k} tout lire`, op(k, `select count(*) from public.app_data`)]);
      l.push([`vinted_accounts ${k} tout lire`, op(k, `select count(*) from public.vinted_accounts`)]);
    }
    return l;
  };
  const v = (m, cle) => (m.find((x) => x[0] === cle) || [])[1];
  MATRICE_AVANT = matrice();
  {
    const m = MATRICE_AVANT;
    dit(v(m, 'app_data A→soi lire') === 'harvest_800_orders_sold,main' && v(m, 'app_data A→B lire') === '∅' && v(m, 'app_data A tout lire') === '2', 'RLS (production) : A lit ses lignes et aucune de B');
    dit(v(m, 'app_data A→B insérer') === 'REFUS' && v(m, 'app_data A→B modifier') === '0' && v(m, 'app_data A→B effacer') === '0' && v(m, 'app_data A vers B') === 'REFUS', 'RLS (production) : A n\'écrit, n\'efface ni ne donne rien chez B');
    dit(v(m, 'app_data E→soi lire') === 'harvest_600_orders_sold,main' && v(m, 'app_data E→soi modifier') === 'REFUS' && v(m, 'app_data E→soi insérer') === 'REFUS' && v(m, 'app_data E→soi effacer') === '0', 'RLS (production) : abonnement expiré ⇒ E lit ses lignes, n\'écrit ni n\'efface');
    dit(v(m, 'app_data anon tout lire') === '0' && v(m, 'app_data vide tout lire') === '0' && v(m, 'app_data anon→A insérer') === 'REFUS', 'RLS (production) : anon et jeton sans identité : rien');
    dit(v(m, 'vinted_accounts A→B lire') === '∅' && v(m, 'vinted_accounts C tout lire') === '1' && v(m, 'vinted_accounts A→B modifier') === '0', 'RLS (production) : vinted_accounts — chacun ses comptes');
  }
  const r036 = psql(fs.readFileSync(M036, 'utf8'));
  dit(r036.ok, 'la 036 passe sur l\'état exact de la production du 15 nov.', r036.ok ? '' : r036.err.slice(0, 300));
  const r045 = psql(fs.readFileSync(M045, 'utf8'));
  dit(r045.ok, 'la 045 passe', r045.ok ? '' : r045.err.slice(0, 300));
  if (MUT.apres036) Q(MUT.apres036);
  {
    const apres = matrice();
    const ecarts = MATRICE_AVANT.filter((l, i) => l[1] !== apres[i][1]).map((l, i) => `${l[0]} : ${l[1]} → ${apres[MATRICE_AVANT.indexOf(l)][1]}`);
    dit(ecarts.length === 0, `RLS : matrice IDENTIQUE avant et après 036 + 045 (${MATRICE_AVANT.length} accès comparés)`, ecarts.slice(0, 4).join(' ; '));
    const perm = Q(`select tablename || ':' || string_agg(policyname || '/' || cmd, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename in ('app_data', 'vinted_accounts') and permissive = 'PERMISSIVE' group by tablename order by 1`);
    dit(perm === 'app_data:vrm_proprietaire_permis/ALL\nvinted_accounts:vrm_proprietaire_permis/ALL', 'après la 036 : UNE permissive par table, pour toutes les actions', perm.replace(/\n/g, ' ; '));
    const r2 = psql(fs.readFileSync(M036, 'utf8') + fs.readFileSync(M045, 'utf8'));
    dit(r2.ok && JSON.stringify(matrice()) === JSON.stringify(apres), '036 et 045 rejouées une 2e fois : rien ne bouge');
    const d = Q(`select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'detourage_usage' and grantee = 'authenticated'`);
    dit(d === 'SELECT', '045 : detourage_usage — authenticated garde SELECT seul (plus de REFERENCES ni TRIGGER)', d);
    const s = Q(`select array_to_string(proconfig, ',') from pg_proc where proname = 'vrm_usage_vendeurs'`);
    dit(s === 'search_path=public, pg_temp', '045 : vrm_usage_vendeurs — search_path = public, pg_temp', s);
    const ici = empreintes();
    dit(MUTATION || Object.keys(EMPREINTES_PROD).every((n) => String(ici[n] || '').split(',').includes(EMPREINTES_PROD[n])), '045 ne change le corps d\'aucune fonction exposée');
  }
} catch (e) {
  dit(false, 'audit interrompu', String(e && e.message || e));
}
console.log(`\n${ok} vert(s), ${ko} rouge(s).${MUTATION ? ' (mutation « ' + MUTATION + ' »)' : ''}`);
process.exitCode = ko ? 1 : 0;
