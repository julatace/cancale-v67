#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES RESTES DE LA REVUE SERVEUR QUI DEMANDAIENT LA BASE (11 nov.)
//  node scripts/audit-serveur-migrations.cjs            (l'audit)
//  node scripts/audit-serveur-migrations.cjs --prouve   (chaque mutation doit le rougir)
//  Récit : docs/passation/2026-11-11-serveur-migrations.md.
//  P. La migration 042 dans un Postgres JETABLE (rôles, RLS et auth.uid() imités) :
//     P0 l'essai annulé porte le corps exact de la migration, passe, ne laisse rien ;
//        la vérification dit ok après application ;
//     P1 M50 `vrm_vinted_relier` : deux vendeurs qui relient le MÊME compte Vinted
//        en même temps (deux sessions psql réelles) ⇒ un seul relié, l'autre
//        `deja_relie`, rien d'écrasé ; un vendeur n'appelle pas la fonction ;
//     P2 M72 la VRAIE route `routeCommandes` exécutée contre la base (ses deux
//        fonctions servies par psql, au nom du vendeur, RLS) : la ligne écrite est
//        IDENTIQUE à celle du chemin d'avant (même fusion) pour quatre envois ;
//        aucune lecture de la liste entière ; un autre vendeur ne lit ni n'écrit
//        rien ; une version périmée n'écrit rien ; une position fausse arrête tout.
//  J. Le JavaScript sur une fausse base :
//     J1 M50 la route : `deja_relie` de la base, ou 23505 de la 023 ⇒ 409 « déjà
//        relié », litige noté, aucun compte rangé ; 404 (042 pas passée) ⇒ comme avant ;
//     J2 H18 deux webhooks Stripe simultanés, l'ANCIEN écrit en dernier ⇒ le plus
//        récent reste (PATCH conditionnel sur evenement_ts + maj) ;
//     J3 M82 la file des favoris ne lit plus aucune capture en `select=data` ;
//     J4 H28 eBay, devancé 4 fois de suite : 2 lectures entières au lieu de 6.
//  (H14, le bail du cron : scripts/audit-cron-lots.cjs L4, exécuté sur le vrai cron.)
//  Données inventées, aucune donnée réelle.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const MIG = path.join(R, 'supabase/migrations/042-ecritures-atomiques.sql');
const ESSAI = path.join(R, 'scripts/serveur-migrations-sql/essai-annule.sql');
const VERIF = path.join(R, 'scripts/serveur-migrations-sql/verifier.sql');

const M = {
  // SQL
  'relier sans verrou': [['supabase/migrations/042-ecritures-atomiques.sql', "  perform pg_advisory_xact_lock(hashtextextended('vrm_vinted_relier:' || v_id, 0));\n", '']],
  'relier ouvert aux vendeurs': [['supabase/migrations/042-ecritures-atomiques.sql', 'revoke all on function public.vrm_vinted_relier(uuid, jsonb) from public, anon, authenticated;', '']],
  'lire sans les commandes de la fenêtre': [['supabase/migrations/042-ecritures-atomiques.sql', "where o.v->>'transaction_id' = any(p_tx)", 'where false']],
  'écrire sans condition de version': [['supabase/migrations/042-ecritures-atomiques.sql', "     and (a.data->>'rev') is not distinct from p_rev\n     and (a.data->>'capturedAt') is not distinct from p_cap\n   limit 1", '   limit 1'], ['supabase/migrations/042-ecritures-atomiques.sql', "     and (a.data->>'rev') is not distinct from p_rev\n     and (a.data->>'capturedAt') is not distinct from p_cap;", ';']],
  'écrire une liste trouée': [['supabase/migrations/042-ecritures-atomiques.sql', "  if v_trou then raise exception 'vrm_commandes_ordre'; end if;\n", '']],
  // JS
  'route : déjà relié ignoré': [['api/vinted-connect.js', "if (ecrit === 'deja_relie') {", 'if (false) {']],
  'route : 23505 = échec': [['api/vinted-connect.js', "return /23505/.test(t) ? 'deja_relie' : 'echec';", "return 'echec';"]],
  'statut sans condition': [['api/compte.js', 'export const conditionStatut = (avant) => ', "export const conditionStatut = (avant) => 'evenement_ts=not.is.null' || "]],
  'favoris en select=data': [['api/_lib/favoris.js', '&id=in.(${lourdes.join(\',\')})&select=${SEL_FAVORIS}`', '&id=in.(${lourdes.join(\',\')})&select=id,owner,data`']],
  'eBay relit tout': [['api/_lib/ebay.js', 'let v = await lireRev();', 'let v = undefined;'], ['api/_lib/ebay.js', 'const PLEINES_MAX = 3;', 'const PLEINES_MAX = 6;']],
  'commandes : liste entière': [['api/_lib/commandes-leger.js', 'let squelette = true;', 'let squelette = false;']],
};

if (process.argv.includes('--prouve')) {
  let ok = 0; const noms = Object.keys(M);
  for (const nom of noms) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-042-'));
    for (const x of ['api', 'src', 'package.json', 'supabase', 'scripts/serveur-migrations-sql']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    let ancre = true;
    for (const [f, de, vers] of M[nom]) {
      const p = path.join(t, f), src = fs.readFileSync(p, 'utf8');
      if (!src.includes(de)) { ancre = false; console.log(`❌ mutation « ${nom} » : ancre introuvable dans ${f}`); break; }
      fs.writeFileSync(p, src.replace(de, vers));
      // Une mutation du SQL vaut aussi pour l'essai annulé (même corps) : seuls les contrôles de COMPORTEMENT peuvent la voir.
      if (/042-ecritures-atomiques\.sql$/.test(f)) { const e = path.join(t, 'scripts/serveur-migrations-sql/essai-annule.sql'); fs.writeFileSync(e, fs.readFileSync(e, 'utf8').replace(de, vers)); }
    }
    if (ancre) {
      const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 300000 });
      const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
      const tombe = r.status !== 0 && rouges > 0 && !/NON exécuté/.test(r.stdout);
      if (tombe) ok++;
      console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    }
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(`\n${ok === noms.length ? '✅' : '❌'} ${ok}/${noms.length} mutations attrapées`);
  process.exit(ok === noms.length ? 0 : 1);
}

let verts = 0, rouges = 0;
const juge = (ok, nom, d = '') => { if (ok) verts++; else rouges++; console.log(`${ok ? '✅' : '❌'} ${nom}${d ? ' — ' + String(d).slice(0, 300) : ''}`); };
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const SESSION_A = 'e30.' + Buffer.from(JSON.stringify({ sub: A })).toString('base64url') + '.sig';
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const resFaux = () => ({ code: 200, corps: undefined, setHeader() {}, status(c) { this.code = c; return this; }, json(j) { this.corps = j; return this; }, send(j) { this.corps = j; return this; }, end() { return this; } });

// ── Postgres jetable ────────────────────────────────────────────────────────
function trouverBin() {
  const avec = (d) => d && ['initdb', 'pg_ctl', 'postgres', 'psql'].every((x) => fs.existsSync(path.join(d, x)));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  try { const v = fs.readdirSync('/usr/lib/postgresql').filter((x) => avec(path.join('/usr/lib/postgresql', x, 'bin'))).sort((a, b) => Number(b) - Number(a)); if (v.length) return path.join('/usr/lib/postgresql', v[0], 'bin'); } catch (_) {}
  return null;
}
let PG = null;
function demarrerPg() {
  const BIN = trouverBin();
  if (!BIN) return 'Postgres introuvable (PG_BIN=/chemin/bin)';
  const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
  let UIDG = null;
  if (ROOT) { try { UIDG = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString().trim()) }; } catch (_) { return 'root sans utilisateur « postgres »'; } }
  const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-042-sql-'));
  if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
  const PORT = String(56432 + (process.pid % 2000));
  const srv = (cmd, a) => spawnSync(path.join(BIN, cmd), a, { encoding: 'utf8', ...(UIDG || {}) });
  const r = srv('initdb', ['-D', DIR + '/data', '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  if (r.status !== 0) return 'initdb : ' + (r.stderr || r.stdout).slice(0, 200);
  const s = srv('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c timezone=UTC`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) return 'Postgres ne démarre pas';
  PG = { BIN, DIR, PORT, srv };
  process.on('exit', () => { srv('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} });
  return null;
}
const psqlArgs = () => ['-h', PG.DIR, '-p', PG.PORT, '-U', 'supabase_admin', '-d', 'postgres', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'];
const run = (sql) => { const r = spawnSync(path.join(PG.BIN, 'psql'), psqlArgs(), { input: sql, encoding: 'utf8' }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const Q = (sql) => { const r = run(sql); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
const runAsync = (sql) => new Promise((ok) => { const p = spawn(path.join(PG.BIN, 'psql'), psqlArgs()); let out = '', err = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; }); p.on('close', (c) => ok({ ok: c === 0, out: out.trim(), err: err.trim() })); p.stdin.end(sql); });
const comme = (u) => `set role authenticated; set "request.jwt.claims" = '{"sub":"${u}","role":"authenticated"}';\n`;
const lit = (s) => '$vrm$' + String(s) + '$vrm$';

const DECOR = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
create table public.app_data (owner uuid not null, id text not null, data jsonb, updated_at timestamptz default now(), primary key (owner, id));
alter table public.app_data enable row level security;
create policy "chacun ses lignes" on public.app_data for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
grant select, insert, update, delete on public.app_data to authenticated, service_role;
create table public.vinted_accounts (id bigserial primary key, owner uuid not null, vinted_user_id text, access_token text, refresh_token text, domain text,
  updated_at timestamptz default now(), login text, anon_id text, csrf_token text, created_at timestamptz default now());
create unique index vinted_accounts_owner_uid_idx on public.vinted_accounts(owner, vinted_user_id);
alter table public.vinted_accounts enable row level security;
create policy "chacun ses lignes" on public.vinted_accounts for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
grant all on public.vinted_accounts to authenticated, service_role; grant usage on all sequences in schema public to authenticated, service_role;
`;

// Les commandes inventées : 60 ventes, un doublon de n°, une ligne sans n°, un `null`, un n° numérique.
const T = Date.parse('2026-11-11T12:00:00Z');
const vente = (i, extra = {}) => ({ transaction_id: String(9100000 + i), title: 'Paire ' + i, price: { amount: String(40 + i), currency_code: 'EUR' }, date: new Date(T - i * 3600e3).toISOString(), photo: { id: 700000 + i, url: `https://images.exemple.test/t/${700000 + i}/f800/photo.webp?s=${'a'.repeat(120)}`, dominant_color: '#C4B9A8' }, status: 'Commande finalisée', transaction_user_status: 'completed', ...extra });
function ligneDeBase() {
  const mo = Array.from({ length: 60 }, (_, i) => vente(i));
  mo.splice(30, 0, vente(5, { title: 'doublon du n° 5' }));
  mo.splice(40, 0, { title: 'sans n°' }, null);
  mo.push({ ...vente(99), transaction_id: 9100099 });
  return { type: 'orders_sold', uid: '1', domain: 'www.vinted.fr', capturedAt: new Date(T - 86400e3).toISOString(), payload: { pagination: { current_page: 1, per_page: 20, total_pages: 4 }, my_orders: mo },
    nItems: mo.length, resume: { n: mo.length, txns: ['9100003', '9100045'], at: T - 86400e3, dates: { 9100003: vente(3).date } }, rev: 7, envoi: 'leger' };
}

(async () => {
  const pgPanne = demarrerPg();
  // ════ P. la migration dans Postgres ════
  if (pgPanne) { console.log('❌ ' + pgPanne + ' — partie P NON exécutée'); rouges++; }
  else {
    console.log(`(Postgres jetable dans ${PG.DIR})\n`);
    Q(DECOR);
    const mig = lire(MIG), essai = lire(ESSAI), verif = lire(VERIF);
    const corps = (t) => (t && (/^begin;\n([\s\S]*?)\n(?:commit;|select json_build_object\()/m.exec(t.replace(/\r/g, '')) || [])[1]) || null;
    juge(!!mig && !!essai && corps(essai) != null && corps(essai).trim() === corps(mig).trim(), "P0 l'essai annulé porte le corps exact de la migration 042");
    let rap = null, lignesEssai = [];
    if (essai) { const e = run(essai); lignesEssai = e.out.split('\n').filter(Boolean); try { rap = JSON.parse(lignesEssai.find((l) => l.startsWith('{'))); } catch (_) {} if (!e.ok) console.log('   ' + e.err.slice(0, 300)); }
    juge(rap && rap.fn === 3 && rap.relier === 'invalide' && rap.lire === null && rap.ecrire === 0 && rap.service === true && rap.anon === false, "P0 l'essai annulé passe (3 fonctions, appels sans effet, droits)", JSON.stringify(rap));
    juge(lignesEssai[lignesEssai.length - 1] === '0', "P0 après l'essai, rien ne reste", lignesEssai[lignesEssai.length - 1]);
    let applique = false;
    if (mig) { const a = run(mig); applique = a.ok; if (!a.ok) console.log('   ' + a.err.slice(0, 300)); }
    juge(applique, 'P0 la migration 042 passe');
    const v = verif && applique ? run(verif) : { out: '' };
    juge(/^t\|/.test(v.out), 'P0 la vérification dit ok = true après application', v.out || v.err);

    if (applique) {
      // ── P1 : relier, deux vendeurs en même temps ──
      const ligne = (tok) => JSON.stringify({ vinted_user_id: '555', access_token: tok, refresh_token: 'r', domain: 'www.vinted.fr', login: 'shop_x' });
      const [s1, s2] = await Promise.all([
        runAsync(`set role service_role; begin; select public.vrm_vinted_relier('${A}', ${lit(ligne('jeton-A'))}::jsonb); select pg_sleep(0.8); commit;`),
        new Promise((ok) => setTimeout(ok, 250)).then(() => runAsync(`set role service_role; begin; select public.vrm_vinted_relier('${B}', ${lit(ligne('jeton-B'))}::jsonb); commit;`)),
      ]);
      const r1 = s1.out.split('\n')[0], r2 = s2.out.split('\n')[0];
      const rows = Q("select owner || ':' || access_token from public.vinted_accounts where vinted_user_id = '555' order by owner");
      juge(r1 === 'ok' && r2 === 'deja_relie' && rows === `${A}:jeton-A`, 'P1 M50 deux vendeurs relient le même compte EN MÊME TEMPS : un seul relié, le second « déjà relié », rien écrasé', `${r1} / ${r2} / ${rows.replace(/\n/g, ' | ')}${s1.err || s2.err ? ' · ' + (s1.err || s2.err).slice(0, 120) : ''}`);
      const r3 = Q(`set role service_role; select public.vrm_vinted_relier('${A}', ${lit(JSON.stringify({ vinted_user_id: '555', access_token: 'jeton-A2', refresh_token: 'r2', domain: 'www.vinted.fr' }))}::jsonb);`);
      const apres = Q("select access_token || '|' || coalesce(login, '-') from public.vinted_accounts where vinted_user_id = '555'");
      juge(r3 === 'ok' && apres === 'jeton-A2|shop_x', 'P1 le même vendeur renouvelle ses jetons ; un pseudo absent de l’envoi est gardé', `${r3} · ${apres}`);
      const r4 = run(`${comme(A)} select public.vrm_vinted_relier('${A}', ${lit(ligne('pirate'))}::jsonb);`);
      juge(!r4.ok && /permission denied/i.test(r4.err), 'P1 un vendeur (jeton de session) ne peut pas appeler vrm_vinted_relier', r4.ok ? r4.out : r4.err.slice(0, 120));

      // ── P2 : la vraie route des commandes, contre la base ──
      const ROW = 'harvest_1_orders_sold';
      const poser = (data) => Q(`delete from public.app_data where id = '${ROW}'; insert into public.app_data(owner, id, data) values ('${A}', '${ROW}', ${lit(JSON.stringify(data))}::jsonb);`);
      const lireLigne = () => JSON.parse(Q(`select data from public.app_data where id = '${ROW}' and owner = '${A}'`) || 'null');
      const { canonCommande, empreinteCommande } = await import(pathToFileURL(path.join(R, 'src/commandesFusion.js')).href);
      const CL = await import(pathToFileURL(path.join(R, 'api/_lib/commandes-leger.js')).href);
      let appels = [], rpcBrut = [];
      const sqlRpc = (nom, a) => {
        const lst = (v) => (v == null ? 'null' : lit(v));
        if (nom === 'vrm_commandes_lire') return `select public.vrm_commandes_lire(${lit(a.p_id)}, ${a.p_owner ? lit(a.p_owner) + '::uuid' : 'null'}, ${lit('{' + (a.p_tx || []).map((x) => '"' + x + '"').join(',') + '}')}::text[]);`;
        return `select public.vrm_commandes_ecrire(${lit(a.p_id)}, ${a.p_owner ? lit(a.p_owner) + '::uuid' : 'null'}, ${lst(a.p_rev)}, ${lst(a.p_cap)}, ${lit(JSON.stringify(a.p_ordre))}::jsonb, ${lit(JSON.stringify(a.p_commandes))}::jsonb, ${lit(JSON.stringify(a.p_data))}::jsonb);`;
      };
      globalThis.fetch = async (url, o = {}) => {
        const u = decodeURIComponent(String(url)), m = (o.method || 'GET').toUpperCase();
        appels.push({ m, u, corps: typeof o.body === 'string' ? o.body.length : 0 });
        if (/\/auth\/v1\/user/.test(u)) return rep({ id: A, email: 'a@exemple.test', email_confirmed_at: '2026-01-01' });
        if (/app_data\?select=owner&limit=1/.test(u)) return rep([{ owner: A }]);
        const rpc = /\/rest\/v1\/rpc\/(vrm_commandes_(?:lire|ecrire))$/.exec(u);
        if (rpc && m === 'POST') {
          const a = JSON.parse(o.body), r = run(comme(A) + sqlRpc(rpc[1], a));
          if (!r.ok) return rep({ message: r.err.slice(0, 200) }, 400);
          rpcBrut.push({ nom: rpc[1], octets: r.out.length });
          return rep(r.out === '' ? 'null' : r.out);
        }
        return rep({ message: 'non servi par le banc : ' + u }, 500);
      };
      const route = async (envoi) => { const res = resFaux(); await CL.routeCommandes({ method: 'POST', headers: { authorization: 'Bearer ' + SESSION_A }, body: envoi }, res, { maintenant: () => T }); return res; };
      // Le chemin d'avant, calculé sur la ligne ENTIÈRE (la même règle `appliquerEnvoi`).
      const attendu = (base, envoi) => {
        const avant = { cap: base.capturedAt, rev: String(base.rev), pagination: base.payload.pagination, my_orders: base.payload.my_orders, resume: base.resume };
        return CL.appliquerEnvoi(JSON.parse(JSON.stringify(avant)), envoi, T);
      };
      const fen = (liste) => liste.map((o) => `${o.transaction_id}:${empreinteCommande(o)}`).join(',');
      const base0 = ligneDeBase();
      const neuves = [vente(-1), vente(-2)].map((o) => ({ ...o, status: 'Envoie le colis', transaction_user_status: 'needs_action' }));
      const change = { ...base0.payload.my_orders[3], status: 'Retour initié' };
      const haut = [...neuves, ...base0.payload.my_orders.slice(0, 3), change, ...base0.payload.my_orders.slice(4, 20)];
      const scenarios = {
        'haut de liste (2 neuves, 1 changée, 16 reprises de la base)': { type: 'orders_sold', uid: '1', fenetre: fen(haut), commandes: [...neuves, change], ae: neuves.map((o) => o.transaction_id), pagination: { current_page: 1, per_page: 20, total_pages: 4 }, luA: T },
        'page profonde (une neuve en queue, une reprise)': { type: 'orders_sold', uid: '1', fenetre: fen([base0.payload.my_orders[45], vente(77)]), commandes: [vente(77)], ae: [], pagination: { current_page: 3, per_page: 20, total_pages: 4 }, luA: T },
        'empreinte inconnue ⇒ demandée (manquants), rien deviné': { type: 'orders_sold', uid: '1', fenetre: fen([vente(-3), base0.payload.my_orders[2]]).replace(/(9100002:)[0-9a-z]+/, '$1zz99'), commandes: [vente(-3)], ae: [], pagination: { current_page: 1, per_page: 20 }, luA: T },
        'lecture complète (tout remplacé)': { type: 'orders_sold', uid: '1', fenetre: fen(base0.payload.my_orders.filter((o) => o && o.transaction_id != null).slice(0, 10)), commandes: [], ae: [], complet: true, pagination: { current_page: 1, per_page: 100 }, luA: T },
      };
      for (const [nom, envoi] of Object.entries(scenarios)) {
        poser(ligneDeBase()); appels = []; rpcBrut = [];
        const att = attendu(ligneDeBase(), envoi);
        const res = await route(envoi);
        const ecrite = lireLigne();
        const memeLigne = att.ecrit && ecrite && canonCommande(ecrite) === canonCommande(att.data);
        const entiere = appels.some((a) => /my_orders/.test(a.u) && a.m === 'GET');
        juge(res.code === 200 && res.corps && res.corps.ecrit === true && memeLigne && !entiere && rpcBrut.length === 2,
          `P2 M72 ${nom} : la ligne écrite est celle du chemin d'avant, sans relire la liste entière`, `HTTP ${res.code} ${JSON.stringify(res.corps)} · identique=${memeLigne} · lecture entière=${entiere} · fonctions=${rpcBrut.map((x) => x.nom).join(',')}`);
        if (nom.startsWith('haut')) {
          const lu = rpcBrut.find((x) => x.nom === 'vrm_commandes_lire'), envoiEcrit = appels.find((a) => /vrm_commandes_ecrire/.test(a.u));
          const pleine = JSON.stringify(ligneDeBase()).length;
          juge(lu && lu.octets < pleine / 2 && envoiEcrit && envoiEcrit.corps < pleine / 2, `P2 M72 lu ${lu && lu.octets} o et écrit ${envoiEcrit && envoiEcrit.corps} o, contre ${pleine} o pour la ligne entière`);
        }
      }
      // RLS, version périmée, position fausse.
      poser(ligneDeBase());
      const parB = run(`${comme(B)} select coalesce(public.vrm_commandes_lire('${ROW}', null, '{9100001}')::text, 'RIEN'); select public.vrm_commandes_ecrire('${ROW}', null, '7', ${lit(ligneDeBase().capturedAt)}, '[0]'::jsonb, '{}'::jsonb, '{"payload":{}}'::jsonb);`);
      juge(parB.ok && parB.out === 'RIEN\n0' && canonCommande(lireLigne()) === canonCommande(ligneDeBase()), 'P2 un AUTRE vendeur ne lit ni n’écrit la ligne (RLS)', parB.out || parB.err);
      const perime = run(`${comme(A)} select public.vrm_commandes_ecrire('${ROW}', '${A}', '6', ${lit(ligneDeBase().capturedAt)}, '[0]'::jsonb, '{}'::jsonb, '{"payload":{}}'::jsonb);`);
      juge(perime.ok && perime.out === '0' && canonCommande(lireLigne()) === canonCommande(ligneDeBase()), 'P2 une version périmée (rev lu ≠ rev rangé) n’écrit rien', perime.out || perime.err);
      const trou = run(`${comme(A)} select public.vrm_commandes_ecrire('${ROW}', '${A}', '7', ${lit(ligneDeBase().capturedAt)}, '[0, 999]'::jsonb, '{}'::jsonb, '{"payload":{}}'::jsonb);`);
      juge(!trou.ok && /vrm_commandes_ordre/.test(trou.err) && canonCommande(lireLigne()) === canonCommande(ligneDeBase()), 'P2 une position qui ne désigne rien arrête tout (jamais une liste trouée)', trou.ok ? trou.out : trou.err.slice(0, 100));
    }
  }

  // ════ J. le JavaScript, fausse base ════
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';
  // ── J1 : la route vinted-connect ──
  const JETON = 'e30.' + Buffer.from(JSON.stringify({ account_id: 777, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig';
  const connect = async ({ rpc, upsert }) => {
    const ecrits = [];
    globalThis.fetch = async (url, o = {}) => {
      const u = String(url), m = o.method || 'GET';
      if (u.includes('/auth/v1/user')) return rep({ id: A, email: 'a@exemple.test', email_confirmed_at: '2026-01-01' });
      if (u.includes('/rpc/vrm_acces_pour')) return rep(true);
      if (u.includes('/rpc/vrm_vinted_relier')) return rpc();
      if (u.includes('/rest/v1/vinted_accounts') && m === 'GET') return rep([]);
      if (u.includes('/rest/v1/vinted_accounts')) { const r = upsert(); if (r.ok) ecrits.push('vinted_accounts'); return r; }
      if (u.includes('/rest/v1/app_data') && m === 'POST') { ecrits.push(/vrm_vinted_litige_/.test(o.body) ? 'litige' : 'app_data'); return rep('', 201); }
      if (u.includes('vinted.')) return rep({ user: { id: 9, login: 'shop_a' } });
      return rep({}, 200);
    };
    const { default: h } = await import(pathToFileURL(path.join(R, 'api/vinted-connect.js')).href);
    const res = resFaux();
    await h({ method: 'POST', query: {}, headers: { authorization: 'Bearer ' + SESSION_A, origin: 'chrome-extension://abcdefghijklmnop' }, body: { source: 'extension', accessToken: JETON, refreshToken: 'r', domain: 'www.vinted.fr' } }, res);
    return { res, ecrits };
  };
  const c1 = await connect({ rpc: () => rep('"deja_relie"'), upsert: () => rep('', 201) });
  juge(c1.res.code === 409 && c1.res.corps && c1.res.corps.raison === 'deja_relie' && c1.ecrits.join() === 'litige', 'J1 M50 la base dit « déjà relié » (course perdue) ⇒ 409, litige noté, aucun compte rangé', `HTTP ${c1.res.code} · ${c1.ecrits.join()}`);
  const c2 = await connect({ rpc: () => rep({ code: 'PGRST202' }, 404), upsert: () => rep({ code: '23505', message: 'duplicate key value violates unique constraint "vinted_accounts_vinted_user_id_global_idx"' }, 409) });
  juge(c2.res.code === 409 && c2.res.corps && c2.res.corps.raison === 'deja_relie' && c2.ecrits.join() === 'litige', 'J1 M50 sans la 042, l’unicité de la 023 (23505) ⇒ « déjà relié », plus « enregistrement impossible »', `HTTP ${c2.res.code} · ${JSON.stringify(c2.res.corps)}`);
  const c3 = await connect({ rpc: () => rep({ code: 'PGRST202' }, 404), upsert: () => rep('', 201) });
  juge(c3.res.code === 200 && c3.ecrits.includes('vinted_accounts'), 'J1 sans la 042 (404) : relié comme avant', `HTTP ${c3.res.code}`);
  const c4 = await connect({ rpc: () => rep('"ok"'), upsert: () => rep({}, 500) });
  juge(c4.res.code === 200 && !c4.ecrits.includes('vinted_accounts'), 'J1 avec la 042 : relié par la base seule (aucun upsert direct)', `HTTP ${c4.res.code}`);

  // ── J2 : H18, deux webhooks Stripe simultanés ──
  {
    let ligne = { owner: A, evenement_ts: 50, maj: '2026-11-01T00:00:00.000Z', statut: 'active', abonnement_stripe: 'sub_A', impaye_depuis: null };
    let lecturesEnAttente = [];
    const barriere = () => new Promise((ok) => { lecturesEnAttente.push(ok); if (lecturesEnAttente.length >= 2) { lecturesEnAttente.forEach((f) => f()); lecturesEnAttente = []; } else setTimeout(() => { lecturesEnAttente.forEach((f) => f()); lecturesEnAttente = []; }, 60); });
    const cond = (u) => [...u.matchAll(/[?&](evenement_ts|maj)=(eq\.[^&]*|is\.null)/g)].every(([, k, c]) => (c === 'is.null' ? ligne[k] == null : String(ligne[k]) === decodeURIComponent(c.slice(3))));
    const retard = (corps) => new Promise((ok) => setTimeout(ok, Number(corps.evenement_ts) === 100 ? 40 : 0));
    globalThis.fetch = async (url, o = {}) => {
      const u = String(url), m = o.method || 'GET';
      if (!u.includes('/rest/v1/abonnements')) return rep([]);
      if (m === 'GET') { const copie = { ...ligne }; await barriere(); return rep([copie]); }
      if (m === 'PATCH') { const c = JSON.parse(o.body); await retard(c); if (!cond(u)) return rep([]); ligne = { ...ligne, ...c }; return rep([{ owner: A }]); }
      if (m === 'POST') { const [c] = JSON.parse(o.body); await retard(c); ligne = { ...ligne, ...c }; return rep('', 201); }
      return rep({}, 405);
    };
    let ecrire = null;
    try { ecrire = (await import(pathToFileURL(path.join(R, 'api/compte.js')).href)).ecrireStatut; } catch (_) {}
    if (typeof ecrire !== 'function') juge(false, 'J2 H18 ecrireStatut introuvable (non exporté)');
    else {
      const [x, y] = await Promise.all([ecrire(A, { statut: 'incomplete', abonnement_stripe: 'sub_A' }, 100), ecrire(A, { statut: 'canceled', abonnement_stripe: 'sub_A' }, 200)]);
      juge(ligne.statut === 'canceled' && ligne.evenement_ts === 200 && x.ok && y.ok, 'J2 H18 deux webhooks simultanés, l’ANCIEN écrit en dernier : le plus récent reste', `${ligne.statut} @${ligne.evenement_ts} · ${JSON.stringify(x)} ${JSON.stringify(y)}`);
    }
  }

  // ── J3 : M82, la file des favoris sans select=data sur les captures ──
  {
    const lus = [];
    globalThis.fetch = async (url, o = {}) => {
      const u = decodeURIComponent(String(url)), m = o.method || 'GET';
      if (u.includes('/auth/v1/user')) return rep({ id: A, email: 'a@exemple.test' });
      if (u.includes('/rest/v1/vinted_accounts')) return rep([{ owner: A, vinted_user_id: '123' }]);
      if (u.includes('/rest/v1/app_data') && m === 'GET') { lus.push(u); return rep([]); }
      return rep([]);
    };
    const { routeFavoris } = await import(pathToFileURL(path.join(R, 'api/_lib/favoris.js')).href);
    const res = resFaux();
    await routeFavoris({ method: 'POST', query: { uid: '123', mode: 'favoris' }, headers: { authorization: 'Bearer ' + SESSION_A }, body: { action: 'lancer', selection: ['n1'], reglages: {} } }, res);
    const lourdes = lus.filter((u) => /harvest_/.test(u));
    const entieres = lourdes.filter((u) => /select=(id,owner,)?data(&|$)/.test(u));
    juge(lourdes.length >= 1 && entieres.length === 0 && lourdes.every((u) => /payload->notifications/.test(u)), 'J3 M82 « lancer » lit les captures PROJETÉES (jamais select=data)', lourdes.map((u) => u.split('select=')[1]).join(' | ').slice(0, 200));
    const src = lire(path.join(R, 'api/_lib/favoris.js')) || '';
    juge(!/harvest_[^\n]*select=id,owner,data/.test(src) && /lireLignesFavoris\(c=>lecture\(req,c\)/.test(src), 'J3 M82 le tour automatique et les autres comptes passent par la même lecture projetée');
  }

  // ── J4 : H28, eBay devancé 4 fois de suite ──
  {
    let d = { rev: 1, lourd: 'x'.repeat(5000) }, bousculades = 0, pleines = 0, versions = 0;
    globalThis.fetch = async (url, o = {}) => {
      const u = decodeURIComponent(String(url)), m = o.method || 'GET';
      if (m === 'GET') {
        // Un autre écrivain range JUSTE APRÈS chaque lecture, tant qu'il est en rafale.
        const r = /select=data(&|$)/.test(u) ? (pleines++, rep([{ data: d }])) : (versions++, rep([{ rev: String(d.rev) }]));
        if (bousculades > 0) { bousculades--; d = { ...d, rev: d.rev + 1 }; }
        return r;
      }
      if (m === 'PATCH') {
        if (bousculades === 0 && !d._premier) { d._premier = true; bousculades = 4; return rep([]); }   // la première écriture est devancée
        if (`eq.${d.rev}` !== (/data->>rev=([^&]+)/.exec(u) || [])[1]) return rep([]);
        d = JSON.parse(o.body).data; return rep([{ id: 'x' }]);
      }
      return rep('', 201);
    };
    const { modifierDonnee } = await import(pathToFileURL(path.join(R, 'api/_lib/ebay.js')).href);
    const r = await modifierDonnee('ebay_orders', A, (x) => ({ ...x, vu: true }));
    juge(r === true && d.vu === true && pleines <= 2 && versions >= 2, 'J4 H28 devancé, eBay relit la VERSION seule puis la ligne entière une fois', `écrit=${r} · lectures entières=${pleines} · versions=${versions}`);
  }

  console.log(`\n${rouges ? '❌' : '✅'} audit-serveur-migrations : ${verts} vert(s), ${rouges} rouge(s)`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
