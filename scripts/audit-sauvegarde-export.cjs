#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// L'EXPORT QUOTIDIEN ET SA RESTAURATION — node scripts/audit-sauvegarde-export.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (12 nov., agent2-fiabilite-prod) Tout se joue sur un Postgres JETABLE monté dans
// un dossier temporaire (comme scripts/sauvegarde/essai-local.sh), avec des
// données INVENTÉES. Jamais la vraie base.
//   R  la VRAIE route api/ship-reminders.js?moment=sauvegarde : PostgREST est
//      traduit en SQL sur la base « source » (même forme : select, filtres
//      `not.like`, `order`, `Range`), Storage est un faux seau en mémoire qui
//      parle comme Supabase (seau, dépôt, liste, retrait). Un fichier par vendeur.
//   X  la RESTAURATION : scripts/sauvegarde/restaurer-export.mjs remet chaque
//      fichier dans une base « restauree » VIDE ; puis on compare les DEUX bases
//      ligne à ligne (md5 du jsonb) : tout ce qui n'est pas écarté exprès est là,
//      identique ; ce qui est écarté (captures, PDF, lourdes) est nommé.
//   G  les garde-fous : jetons Vinted absents du fichier · lecture ratée ⇒ rien
//      pour ce vendeur, relancé ⇒ seul lui · liste vide ⇒ rien · seau public ⇒
//      rien · manifeste illisible ⇒ rien · mauvaise clé / fichier modifié ⇒
//      refusé · rétention 14 j mais jamais sous 7 jours complets · cible de
//      restauration distante ⇒ refusée · familles lourdes écartées DANS la requête.
// `--prouve` : chaque mutation de la règle doit rendre cet audit ROUGE.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const MODULE = 'api/_lib/sauvegarde-quotidienne.js';

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['lecture ratée prise pour vide', MODULE, 'const brutes = await lire(requeteLignes(owner));', 'const brutes = (await lire(requeteLignes(owner))) || [];'],
    ['jetons Vinted demandés à la base', MODULE, "export const COLONNES_COMPTES = ['id',", "export const COLONNES_COMPTES = ['access_token', 'refresh_token', 'id',"],
    ['jetons Vinted gardés', MODULE, "for (const k of ['access_token', 'refresh_token', 'csrf_token']) if (c && k in c) delete c[k];", 'void 0;'],
    ['PDF copié', MODULE, "if (texte.includes('JVBERi0')) { ecartees.push({ id: r.id, raison: 'pdf', octets: texte.length }); continue; }", ''],
    ['liste vide écrite', MODULE, "if (!lignes.length) return { fait: false, vide: true,", "if (false) return { fait: false, vide: true,"],
    ['seau public accepté', MODULE, "if (seau === false) return { fait: false, raison: 'le seau « sauvegardes » est PUBLIC : rien écrit' };", ''],
    ['purge sans jours complets', MODULE, 'if (complets < JOURS_COMPLETS_MINI) return', 'if (false) return'],
    ['familles lourdes lues', MODULE, "const filtres = FAMILLES_ECARTEES.map((p) => `&id=not.like.${encodeURIComponent(p)}*`).join('');", "const filtres = '';"],
    ['manifeste illisible écrasé', MODULE, "if (brut === undefined) return { fait: false, raison: 'manifeste du jour illisible : rien écrit' };", ''],
    ['restauration vers une cible distante', 'scripts/sauvegarde/restaurer-export.mjs', "if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hote))", 'if (false)'],
    ['restauration sans comparer', 'scripts/sauvegarde/restaurer-export.mjs', 'if (manque.length || differe.length || empreinte(memes) !== c.empreinte) {', 'if (false) {'],
    ['la route ne range plus rien', 'api/ship-reminders.js', "  if (moment === 'sauvegarde') {", "  if (moment === 'sauvegarde-desactivee') {"],
  ];
  let rouges = 0;
  for (const [nom, rel, avant, apres] of MUTS) {
    const f = path.join(R, rel);
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 300000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' && d != null ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.stack) || e).slice(0, 800)); } };
const imp = (rel) => import('file://' + path.join(R, rel));

// ── le Postgres jetable ──────────────────────────────────────────────────────
const PG_BIN = process.env.PG_BIN || (() => { try { return fs.readdirSync('/usr/lib/postgresql').sort((a, b) => Number(b) - Number(a)).map((v) => `/usr/lib/postgresql/${v}/bin`)[0]; } catch (_) { return ''; } })();
const B = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-audit-export-'));
const ROOT = process.getuid && process.getuid() === 0;
const SOUS = (cmd, args) => (ROOT ? ['runuser', ['-u', 'postgres', '--', cmd, ...args]] : [cmd, args]);
const PORT = 20000 + Math.floor(Math.random() * 20000);
const U = `postgresql://banc@127.0.0.1:${PORT}`;
const psql = (base, sql) => {
  const r = spawnSync(path.join(PG_BIN, 'psql'), [`${U}/${base}`, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('psql : ' + (r.stderr || '').slice(0, 500));
  return r.stdout;
};
const psqlF = (base, f) => { const r = spawnSync(path.join(PG_BIN, 'psql'), [`${U}/${base}`, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('psql -f : ' + (r.stderr || '').slice(0, 500)); };
function demarrer() {
  if (!PG_BIN || !fs.existsSync(path.join(PG_BIN, 'initdb'))) throw new Error('outils PostgreSQL introuvables (PG_BIN)');
  fs.mkdirSync(path.join(B, 'pg')); fs.mkdirSync(path.join(B, 'sock'));
  if (ROOT) { spawnSync('chown', ['postgres', path.join(B, 'pg'), path.join(B, 'sock')]); fs.chmodSync(B, 0o755); }
  let [c, a] = SOUS(path.join(PG_BIN, 'initdb'), ['-D', path.join(B, 'pg'), '-U', 'banc', '--auth=trust']);
  let r = spawnSync(c, a, { encoding: 'utf8' }); if (r.status !== 0) throw new Error('initdb : ' + r.stderr);
  [c, a] = SOUS(path.join(PG_BIN, 'pg_ctl'), ['-D', path.join(B, 'pg'), '-o', `-p ${PORT} -k ${path.join(B, 'sock')} -c listen_addresses=127.0.0.1`, '-l', path.join(B, 'pg', 'serveur.log'), '-w', 'start']);
  r = spawnSync(c, a, { encoding: 'utf8' }); if (r.status !== 0) throw new Error('pg_ctl : ' + r.stderr);
}
function arreter() {
  try { const [c, a] = SOUS(path.join(PG_BIN, 'pg_ctl'), ['-D', path.join(B, 'pg'), '-m', 'immediate', 'stop']); spawnSync(c, a); } catch (_) {}
  try { fs.rmSync(B, { recursive: true, force: true }); } catch (_) {}
}

// ── des données INVENTÉES ────────────────────────────────────────────────────
const A = '11111111-1111-4111-8111-111111111111';
const BV = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';   // un vendeur sans aucune ligne gardée
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const JETONS = ['jeton-acces-invente-AAAA', 'jeton-rafraichir-invente-BBBB', 'csrf-invente-CCCC'];
const PDF = 'JVBERi0xLjQK' + 'A'.repeat(4000);
const graine = () => `
alter table public.vinted_accounts add column if not exists domain text, add column if not exists anon_id text,
  add column if not exists access_token text, add column if not exists refresh_token text, add column if not exists csrf_token text,
  add column if not exists created_at timestamptz default now();
insert into auth.users(id) values ('${A}'), ('${BV}'), ('${C}');
insert into public.app_data(owner, id, data) select '${A}', 'coffre_' || g, jsonb_build_object('n', g, 'prix', jsonb_build_object('amount', (g * 1.5)::text), 'texte', 'Paire inventée « ' || g || ' » é') from generate_series(1, 640) g;
insert into public.app_data(owner, id, data) select '${BV}', 'email_inconnu_' || g, jsonb_build_object('sujet', 'Sujet inventé ' || g, 'corps', repeat('x', 300)) from generate_series(1, 230) g;
insert into public.app_data(owner, id, data) select o, 'harvest_99_orders_sold_' || g, jsonb_build_object('payload', jsonb_build_object('items', jsonb_build_array(g))) from generate_series(1, 50) g, (values ('${A}'::uuid), ('${BV}'::uuid), ('${C}'::uuid)) v(o);
insert into public.app_data(owner, id, data) values
  ('${A}', 'main', '{"vinted_used_numeros":[1,2,3,"B125"],"fiches":[{"n":1,"prix":31}],"vide":null,"bool":true,"nb":1.50}'),
  ('${BV}', 'main', '{"fiches":[]}'),
  ('${A}', 'vrm_numerotation', '{"v":2}'),
  ('${A}', 'restore_0', '{"at":"2026-11-12"}'),
  ('${A}', 'email_bord_1', '{"pdf":"${PDF}"}'),
  ('${A}', 'email_invoice_1', '{"pdf":"${PDF}"}'),
  ('${BV}', 'email_inconnu_pdf', '{"piece":"${PDF}"}'),
  ('${BV}', 'vrm_gros', jsonb_build_object('t', repeat('z', 1600000))),
  ('${A}', 'lbc_catalogue', jsonb_build_object('t', repeat('c', 2000))),
  ('${NEUTRE}', 'email_inconnu_quarantaine_1', '{"sujet":"Réclamable"}'),
  ('${NEUTRE}', 'statut_sondes', '{"v":1}');
insert into public.vinted_accounts(vinted_user_id, login, owner, access_token, refresh_token, csrf_token) values
  ('900001', 'compte_invente_a', '${A}', '${JETONS[0]}', '${JETONS[1]}', '${JETONS[2]}'),
  ('900002', 'compte_invente_b', '${BV}', '${JETONS[0]}', '${JETONS[1]}', '${JETONS[2]}'),
  ('900003', 'compte_invente_c', '${C}', '${JETONS[0]}', null, null);
`;

// ── un PostgREST minuscule, traduit en SQL sur la base « source » ────────────
const lectures = [];
let panneLecture = null;   // (url) => true : cette lecture répond 500
function postgrest(url, entetes) {
  const u = new URL(url);
  const table = u.pathname.split('/').pop();
  if (!['app_data', 'vinted_accounts'].includes(table)) return { status: 200, body: [] };
  lectures.push(decodeURIComponent(u.search));
  if (panneLecture && panneLecture(decodeURIComponent(u.search), table)) return { status: 500, body: { message: 'panne inventée' } };
  const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";
  const cols = (u.searchParams.get('select') || '*').split(',').map((c) => c.trim()).filter((c) => /^[a-z_]+$/.test(c));
  const ou = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    if (!/^[a-z_]+$/.test(k)) continue;
    if (v.startsWith('eq.')) ou.push(`${k}::text = ${q(v.slice(3))}`);
    else if (v.startsWith('not.like.')) ou.push(`${k}::text not like ${q(v.slice(9).replace(/\*/g, '%'))}`);
    else if (v.startsWith('like.')) ou.push(`${k}::text like ${q(v.slice(5).replace(/\*/g, '%'))}`);
  }
  const ordre = (u.searchParams.get('order') || '').split(',').filter(Boolean).map((o) => { const [c, s] = o.split('.'); return `${c} ${s === 'desc' ? 'desc' : 'asc'}`; });
  const rg = /^(\d+)-(\d+)$/.exec(String(entetes.range || entetes.Range || ''));
  const lim = rg ? ` offset ${rg[1]} limit ${Number(rg[2]) - Number(rg[1]) + 1}` : '';
  const sql = `select coalesce(json_agg(t), '[]') from (select ${cols.join(', ')} from public.${table}${ou.length ? ' where ' + ou.join(' and ') : ''}${ordre.length ? ' order by ' + ordre.join(', ') : ''}${lim}) t`;
  return { status: 200, body: JSON.parse(psql('source', sql) || '[]') };
}

// ── un faux Supabase Storage (en mémoire), à la forme de l'API ───────────────
function fauxStockage() {
  const s = { seaux: {}, objets: new Map(), journal: [], panneListe: false };
  s.repondre = (url, o) => {
    const u = new URL(url); const p = decodeURIComponent(u.pathname.replace(/^\/storage\/v1/, '')); const m = (o.method || 'GET').toUpperCase();
    s.journal.push(m + ' ' + p);
    const json = (b, st = 200) => new Response(JSON.stringify(b), { status: st, headers: { 'content-type': 'application/json' } });
    let x;
    if ((x = /^\/bucket\/([^/]+)$/.exec(p)) && m === 'GET') return s.seaux[x[1]] ? json(s.seaux[x[1]]) : json({ statusCode: '404', error: 'Bucket not found' }, 404);
    if (p === '/bucket' && m === 'POST') { const b = JSON.parse(o.body); if (s.seaux[b.id]) return json({ error: 'Duplicate' }, 409); s.seaux[b.id] = { id: b.id, name: b.name, public: !!b.public }; return json({ name: b.id }); }
    if ((x = /^\/object\/list\/([^/]+)$/.exec(p)) && m === 'POST') {
      if (s.panneListe) return json({ message: 'panne' }, 500);
      const pre = String(JSON.parse(o.body).prefix || '').replace(/\/+$/, '');
      const noms = new Set();
      for (const k of s.objets.keys()) {
        if (!k.startsWith(x[1] + '/')) continue;
        const nom = k.slice(x[1].length + 1);
        if (!pre) noms.add(nom.split('/')[0]);
        else if (nom.startsWith(pre + '/')) noms.add(nom.slice(pre.length + 1).split('/')[0]);
      }
      return json([...noms].sort().map((name) => ({ name, id: null })));
    }
    if ((x = /^\/object\/([^/]+)$/.exec(p)) && m === 'DELETE') { for (const q of JSON.parse(o.body).prefixes) s.objets.delete(x[1] + '/' + q); return json([]); }
    if ((x = /^\/object\/([^/]+)\/(.+)$/.exec(p))) {
      if (!s.seaux[x[1]]) return json({ error: 'Bucket not found' }, 404);
      const cle = x[1] + '/' + x[2];
      if (m === 'POST') { s.objets.set(cle, Buffer.from(o.body)); return json({ Key: cle }); }
      if (m === 'GET') return s.objets.has(cle) ? new Response(s.objets.get(cle), { status: 200 }) : json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 400);
    }
    return json({ error: 'route inconnue ' + m + ' ' + p }, 404);
  };
  return s;
}

const SECRET = 'cle-de-service-de-banc-inventee-0123456789';
const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

(async () => {
  try {
    demarrer();
    const SCH = path.join(R, 'scripts/sauvegarde');
    psql('postgres', 'create database source'); psql('postgres', 'create database restauree');
    for (const base of ['source', 'restauree']) { psqlF(base, path.join(SCH, 'stub-supabase.sql')); psqlF(base, path.join(SCH, 'schema-exemple.sql')); }
    psql('restauree', 'alter table public.vinted_accounts add column if not exists domain text, add column if not exists anon_id text, add column if not exists created_at timestamptz default now()');
    const g = path.join(B, 'graine.sql'); fs.writeFileSync(g, graine()); psqlF('source', g);
  } catch (e) { dit(false, 'Postgres jetable monté', String(e.message || e)); arreter(); console.log(`\n${ok} OK, ${ko} KO`); process.exit(1); }

  process.env.SUPABASE_URL = 'https://banc.invalid';
  process.env.SUPABASE_SERVICE_KEY = SECRET;
  process.env.CRON_SECRET = 'cle-banc-cron';
  delete process.env.SAUVEGARDE_CLE;
  const ST = fauxStockage();
  globalThis.fetch = async (url, o = {}) => {
    const s = String(url);
    if (s.includes('/storage/v1/')) return ST.repondre(s, o);
    if (s.includes('/rest/v1/')) { const h = Object.fromEntries(Object.entries(o.headers || {}).map(([k, v]) => [k.toLowerCase(), v])); const r = postgrest(s, h); return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } }); }
    return new Response('{}', { status: 404 });
  };

  let M, SR;
  await essaie('le module se charge', async () => { M = await imp(MODULE); SR = await imp('api/ship-reminders.js'); });
  if (!M || !SR) { arreter(); console.log(`\n${ok} OK, ${ko} KO`); process.exit(1); }
  const appel = async () => { const res = faireRes(); await SR.default({ method: 'GET', query: { moment: 'sauvegarde' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res); return res; };
  const jour = M.jourParis(Date.now());
  const fichiers = () => [...ST.objets.keys()].filter((k) => k.startsWith('sauvegardes/' + jour + '/') && !k.endsWith('manifeste.vrms'));

  // ── R. la vraie route ─────────────────────────────────────────────────────
  console.log('── R. la route ?moment=sauvegarde (Postgres jetable, faux seau)');
  await essaie('R', async () => {
    panneLecture = (q) => q.includes(`owner=eq.${BV}`) && q.includes('select=id,data');
    const r1 = await appel();
    dit(r1.code === 503 && r1.corps && r1.corps.echecs === 1 && r1.corps.copies >= 1, 'R1 lecture ratée pour un vendeur : 503, les autres copiés, lui compté en échec', r1.corps);
    dit(!ST.objets.has(`sauvegardes/${jour}/${BV}.vrms`), 'R1 lecture ratée ⇒ AUCUN fichier pour ce vendeur');
    dit(ST.seaux.sauvegardes && ST.seaux.sauvegardes.public === false, 'R1 le seau « sauvegardes » est créé PRIVÉ');
    const avant = lectures.length;
    panneLecture = null;
    const r2 = await appel();
    const relues = lectures.slice(avant).filter((q) => q.includes('select=id,data'));
    dit(r2.code === 200 && r2.corps.ok === true && r2.corps.complet === true, 'R2 relancé : 200, jour complet', r2.corps);
    dit(relues.length === 1 && relues[0].includes(`owner=eq.${BV}`), 'R2 relancé : SEUL le vendeur manquant est relu', relues);
    const r3 = await appel();
    dit(r3.code === 200 && lectures.slice(avant).filter((q) => q.includes('select=id,data')).length === 1, 'R3 relancé encore : rien n’est relu (déjà fait)');
    const noms = fichiers().map((k) => k.split('/').pop()).sort();
    dit(JSON.stringify(noms) === JSON.stringify([`${NEUTRE}.vrms`, `${A}.vrms`, `${BV}.vrms`].sort()), 'R4 un fichier par vendeur (et la quarantaine du neutre) ; le vendeur sans ligne gardée n’en a pas', noms);
    dit(r2.corps.vides === 1 || r1.corps.vides === 1, 'R4 le vendeur sans ligne gardée est compté « vide », pas copié', { r1: r1.corps.vides, r2: r2.corps.vides });
    const lourdes = lectures.filter((q) => q.includes('select=id,data'));
    dit(lourdes.length && lourdes.every((q) => q.includes('id=not.like.harvest_*') && q.includes('id=not.like.email_bord*') && q.includes('id=not.like.email_invoice*')), 'R5 les familles lourdes sont écartées DANS la requête (jamais lues)', lourdes[0]);
    dit(!JSON.stringify(r2.corps).includes('Paire inventée') && !JSON.stringify(r2.corps).includes(JETONS[0]), 'R6 la réponse ne porte que des nombres');
    // Rien en clair dans le seau.
    const tout = Buffer.concat([...ST.objets.values()]).toString('latin1');
    dit(!tout.includes('Paire inventée') && !tout.includes('compte_invente') && !tout.includes(JETONS[0]), 'R7 rien en clair dans le seau (chiffré)');
  });

  // ── X. la restauration, prouvée ───────────────────────────────────────────
  console.log('── X. restaurer chaque fichier dans une base VIDE, puis comparer les deux bases');
  await essaie('X', async () => {
    const script = path.join(R, 'scripts/sauvegarde/restaurer-export.mjs');
    const run = (fichier, env = {}, args = []) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, FICHIER: fichier, CLE: SECRET, CIBLE_URL: `${U}/restauree`, PSQL: path.join(PG_BIN, 'psql'), ...env } });
    const sortis = [];
    for (const k of fichiers()) { const f = path.join(B, k.split('/').pop()); fs.writeFileSync(f, ST.objets.get(k)); const r = run(f); sortis.push(r); }
    dit(sortis.length === 3 && sortis.every((r) => r.status === 0 && /empreinte identique/.test(r.stdout)), 'X1 chaque fichier se restaure, empreinte identique', sortis.map((r) => r.stdout + r.stderr).join(' | '));
    // La comparaison indépendante, en SQL : la source privée de ce qui est écarté EXPRÈS.
    // Égalité de VALEUR (un nombre 1.50 du jsonb revient 1.5 : même valeur ; une chaîne « 1.50 » reste « 1.50 »).
    const garde = "id not like 'harvest\\_%' and id not like 'email\\_bord%' and id not like 'email\\_invoice%' and id not like 'lbc\\_catalogue%' and position('JVBERi0' in data::text) = 0 and octet_length(data::text) <= 1500000";
    const lignesDe = (base, o, filtre) => JSON.parse(psql(base, `select coalesce(json_agg(json_build_object('id', id, 'data', data) order by id), '[]') from public.app_data where owner = '${o}'${filtre ? ' and ' + filtre : ''}`) || '[]');
    const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
    for (const o of [A, BV, NEUTRE]) {
      const src = lignesDe('source', o, garde), res = lignesDe('restauree', o);
      const s1 = JSON.stringify(canon(src)), s2 = JSON.stringify(canon(res));
      const manque = src.filter((l) => !res.some((r) => r.id === l.id)).map((l) => l.id);
      dit(src.length > 0 && s1 === s2, `X2 vendeur ${o.slice(0, 8)} : ${src.length} lignes, TOUTES là et identiques`, { manque, n: [src.length, res.length] });
    }
    // Une mutation de la base restaurée DOIT se voir (le contrôle peut échouer).
    const avantMut = JSON.stringify(canon(lignesDe('restauree', A)));
    psql('restauree', `delete from public.app_data where owner = '${A}' and id = 'coffre_77'`);
    dit(JSON.stringify(canon(lignesDe('restauree', A))) !== avantMut, 'X2 témoin : une ligne retirée de la base restaurée se voit');
    const exclues = psql('restauree', "select count(*) from public.app_data where id like 'harvest\\_%' or id like 'email\\_bord%' or id = 'vrm_gros' or id = 'email_inconnu_pdf'").trim();
    dit(exclues === '0', 'X3 captures, PDF et lignes lourdes ne sont PAS restaurés (écartés exprès)');
    const liste = run(path.join(B, `${BV}.vrms`), {}, ['--liste']);
    dit(liste.status === 0 && /2 ligne\(s\) écartée\(s\)/.test(liste.stdout) && /1 pdf/.test(liste.stdout) && /1 lourde/.test(liste.stdout), 'X4 ce qui est écarté est NOMMÉ (1 pdf, 1 lourde), jamais tu', liste.stdout);
    const comptes = psql('restauree', 'select string_agg(vinted_user_id, \',\' order by vinted_user_id) from public.vinted_accounts').trim();
    dit(comptes === '900001,900002', 'X5 les comptes Vinted reviennent (sans jeton)', comptes);
    // Garde-fous du script.
    const loin = run(path.join(B, `${A}.vrms`), { CIBLE_URL: 'postgresql://postgres:x@db.lgonxzrzjcqthjtbdpzo.supabase.co:5432/postgres' });
    dit(loin.status === 1 && /supabase/.test(loin.stderr), 'X6 cible Supabase refusée avant toute connexion', loin.stderr);
    const ailleurs = run(path.join(B, `${A}.vrms`), { CIBLE_URL: 'postgresql://banc@10.0.0.9:5432/x' });
    dit(ailleurs.status === 1 && /pas cet ordinateur/.test(ailleurs.stderr), 'X6 cible sur une autre machine refusée', ailleurs.stderr);
    const mauvaise = run(path.join(B, `${A}.vrms`), { CLE: 'mauvaise-cle-inventee-0000000000' });
    dit(mauvaise.status === 1 && /déchiffrement refusé/.test(mauvaise.stderr), 'X7 mauvaise clé ⇒ refusé', mauvaise.stderr);
    const abime = Buffer.from(fs.readFileSync(path.join(B, `${A}.vrms`))); abime[abime.length - 5] ^= 0xff; fs.writeFileSync(path.join(B, 'abime.vrms'), abime);
    const ra = run(path.join(B, 'abime.vrms'));
    dit(ra.status === 1, 'X7 fichier modifié d’un octet ⇒ refusé', ra.stderr);
    // Une ligne déjà là et DIFFÉRENTE dans la cible : rien n'est écrasé, l'écart est dit.
    psql('restauree', `update public.app_data set data = '{"change":true}' where owner = '${A}' and id = 'main'`);
    const ecart = run(path.join(B, `${A}.vrms`));
    dit(ecart.status === 1 && /1 différente/.test(ecart.stderr), 'X8 une ligne différente déjà là : PAS écrasée, l’écart est dit (code 1)', ecart.stderr);
  });

  // ── G. les garde-fous de la règle ─────────────────────────────────────────
  console.log('── G. les garde-fous');
  await essaie('G', async () => {
    const cle = { source: 'cle-service', secret: SECRET };
    const fichierA = ST.objets.get(`sauvegardes/${jour}/${A}.vrms`);
    const c = M.dechiffrer(fichierA, SECRET);
    dit(c.comptes.length === 1 && !JSON.stringify(c).includes(JETONS[0]) && !JSON.stringify(c).includes(JETONS[1]) && !JSON.stringify(c).includes(JETONS[2]), 'G1 aucun jeton Vinted dans le fichier', c.comptes);
    dit(!c.lignes.some((l) => l.id.startsWith('harvest_') || l.id === 'email_bord_1' || l.id === 'email_invoice_1' || l.id === 'lbc_catalogue'), 'G2 ni capture, ni PDF, ni catalogue dans le fichier');
    const lecComptes = lectures.filter((q) => q.startsWith('?owner=') && q.includes('vinted_user_id'));
    dit(lecComptes.length && lecComptes.every((q) => !/token/.test(q)), 'G1 les jetons ne sont même pas DEMANDÉS à la base', lecComptes[0]);
    // Second rideau : une lecture qui rendrait quand même un jeton ne le copie pas.
    const fuite = await M.copieVendeur({ owner: A, jour, lire: async (q) => (q.startsWith('vinted_accounts') ? [{ id: 1, vinted_user_id: '9', access_token: JETONS[0], refresh_token: JETONS[1], csrf_token: JETONS[2] }] : [{ id: 'main', data: {} }]) });
    dit(fuite.fait && !JSON.stringify(fuite.copie).includes('jeton-') && !JSON.stringify(fuite.copie).includes('csrf-'), 'G1 un jeton rendu quand même par la base n’est pas copié', fuite.copie && fuite.copie.comptes);
    dit(M.sourceDuFichier(fichierA) === 'cle-service' && !fichierA.toString('latin1').includes(SECRET), 'G3 le fichier dit QUELLE clé (jamais la clé)');
    // Mémoire : un stockage sans réseau pour les cas suivants.
    const memoire = (o = {}) => { const m = new Map(); return { m, assurerSeau: async () => (o.seau === undefined ? true : o.seau), deposer: async (k, b) => { if (o.depot === false) return false; m.set(k, b); return true; }, prendre: async (k) => (o.prendre ? o.prendre(k) : m.has(k) ? m.get(k) : null), lister: async (p) => { if (o.liste === null) return null; const s = new Set(); for (const k of m.keys()) { if (!p) s.add(k.split('/')[0]); else if (k.startsWith(p + '/')) s.add(k.slice(p.length + 1)); } return [...s].sort(); }, retirer: async (ks) => { for (const k of ks) m.delete(k); return true; } }; };
    const lireOk = async (q) => (q.startsWith('vinted_accounts') ? [] : [{ id: 'main', data: { a: 1 } }]);
    const pub = memoire({ seau: false });
    const rp = await M.passageSauvegarde({ owners: [A], lire: lireOk, stockage: pub, cle });
    dit(!rp.fait && /PUBLIC/.test(rp.raison) && pub.m.size === 0, 'G4 seau public ⇒ rien écrit', rp);
    const illisible = memoire({ prendre: () => undefined });
    const ri = await M.passageSauvegarde({ owners: [A], lire: lireOk, stockage: illisible, cle });
    dit(!ri.fait && illisible.m.size === 0, 'G5 manifeste du jour illisible ⇒ rien écrit (jamais écrasé)', ri);
    const rn = await M.passageSauvegarde({ owners: null, lire: lireOk, stockage: memoire(), cle });
    dit(!rn.fait && /pas sus/.test(rn.raison), 'G6 vendeurs pas sus ⇒ rien', rn);
    const rk = await M.passageSauvegarde({ owners: [A], lire: lireOk, stockage: memoire(), cle: null });
    dit(!rk.fait, 'G7 aucune clé ⇒ rien', rk);
    const vide = memoire();
    const rv = await M.passageSauvegarde({ owners: [A], lire: async () => [], stockage: vide, cle });
    dit(rv.vides >= 1 && ![...vide.m.keys()].some((k) => k.endsWith(A + '.vrms')), 'G8 une liste vide n’est jamais une réponse : rien écrit pour ce vendeur', rv);
    // Rétention : 20 jours complets ⇒ les plus vieux que 14 j partent.
    const T = Date.parse('2026-11-30T12:00:00Z');
    const ret = memoire();
    for (let i = 0; i < 20; i++) { const j = M.jourParis(T - i * 86400e3); ret.m.set(M.cheminManifeste(j), M.chiffrer({ jour: j, complet: true }, cle)); ret.m.set(M.cheminVendeur(j, A), Buffer.from('x')); }
    const pr = await M.purger({ stockage: ret, cle, jour: M.jourParis(T) });
    const restants = [...new Set([...ret.m.keys()].map((k) => k.split('/')[0]))].sort();
    dit(pr.fait && restants.length === 15 && restants[0] === '2026-11-16', 'G9 rétention : 14 jours gardés (+ le jour même), les plus vieux retirés', { pr, premier: restants[0], n: restants.length });
    // Une panne longue : seulement 3 jours complets récents ⇒ rien retiré.
    const panne = memoire();
    for (let i = 0; i < 20; i++) { const j = M.jourParis(T - i * 86400e3); panne.m.set(M.cheminManifeste(j), M.chiffrer({ jour: j, complet: i < 3 || i > 14 }, cle)); panne.m.set(M.cheminVendeur(j, A), Buffer.from('x')); }
    const pp = await M.purger({ stockage: panne, cle, jour: M.jourParis(T) });
    dit(pp.retires === 0 && [...new Set([...panne.m.keys()].map((k) => k.split('/')[0]))].length === 20, 'G10 moins de 7 jours complets récents ⇒ AUCUN vieux jour retiré (une panne ne vide jamais tout)', pp);
    const lnull = memoire({ liste: null });
    const pl = await M.purger({ stockage: lnull, cle, jour: '2026-11-30' });
    dit(!pl.fait, 'G11 liste illisible ⇒ rien retiré', pl);
    // Clé dédiée prioritaire, courte refusée.
    dit(M.sourceCle({ SAUVEGARDE_CLE: 'x'.repeat(24), SUPABASE_SERVICE_KEY: 's' }).source === 'cle-dediee' && M.sourceCle({ SAUVEGARDE_CLE: 'court', SUPABASE_SERVICE_KEY: 's' }).source === 'cle-service' && M.sourceCle({}) === null, 'G12 SAUVEGARDE_CLE (20 caractères ou plus) prioritaire, sinon la clé de service, sinon rien');
  });

  arreter();
  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); arreter(); process.exit(1); });
