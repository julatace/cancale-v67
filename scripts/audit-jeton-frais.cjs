// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : AUCUNE REQUÊTE NE PART AVEC UN JETON DÉJÀ EXPIRÉ (14 nov., fiabilité prod)
//         node scripts/audit-jeton-frais.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré (journaux de la base, 12 → 14 nov., hors bancs) : 100 à 150 lectures
// refusées 401 « token is expired » par jour depuis vrm.center, par rafales au
// réveil (39 dans la même seconde, iPhone) ; les routes /api/ relisaient la même
// session expirée (GET /auth/v1/user 403). `sbAuth` lançait le renouvellement
// mais rendait l'ANCIEN jeton à la requête qui partait. Cet audit EXÉCUTE le vrai
// src/jetonFrais.js sur un faux `fetch` qui répond comme PostgREST (401 sur un
// jeton expiré) et un faux renouvellement PARTAGÉ (un seul en vol, comme
// `authRefresh`), puis vérifie que App.jsx le pose sur la page.
// `--prouve` : chaque mutation réaffaiblit la règle ; l'audit doit devenir rouge.
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const JF = path.join(R, 'src', 'jetonFrais.js');
const APP = path.join(R, 'src', 'App.jsx');

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['le jeton expiré part sans attendre', JF, '    if (s.refresh_token && !(Number(s.expires_at) > maintenant() + marge)) {', '    if (false) {'],
    ['plus de marge (expire dans 5 s : part quand même)', JF, 'maintenant() + marge', 'maintenant()'],
    ['le jeton neuf n’est pas posé', JF, '{ envoye = avecJeton(init, s2.access_token); jetonEnvoye = s2.access_token; }', '{ jetonEnvoye = s2.access_token; }'],
    ['pas de relance sur un 401 de la base', JF, '    return fetchOrig(input, avecJeton(envoye, s3.access_token));\n', '    return r;\n'],
    ['relance aussi les routes /api/', JF, '    if (!base_ || !r ||', '    if (!r ||'],
    ['relance un flux (corps non rejouable)', JF, ' || !corpsRejouable(envoye) ||', ' ||'],
    ['relance avec le même jeton', JF, ' || s3.access_token === jetonEnvoye) return r;', ') return r;'],
    ['renouvellement non borné (attend pour toujours)', JF, "const borne = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((ok) => setTimeout(() => ok(null), ms))]);", 'const borne = (p) => Promise.resolve(p).catch(() => null);'],
    ['touche une requête qui ne porte pas CE jeton', JF, " || lireEntete(init, 'authorization') !== `Bearer ${tok}`) return fetchOrig(input, init);", ') return fetchOrig(input, init);'],
    ['App.jsx ne le pose plus', APP, "installerJetonFrais({ session: () => AUTH.session, rafraichir: (o) => authRefresh(o), base: SUPABASE_URL });\n", ''],
  ];
  let rouges = 0;
  const origines = new Map();
  const remettre = () => { for (const [f, t] of origines) fs.writeFileSync(f, t); };
  process.on('exit', remettre);
  for (const [nom, f, avant, apres] of MUTS) {
    const src = origines.get(f) || fs.readFileSync(f, 'utf8');
    origines.set(f, src);
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : le motif n'existe plus`); rouges = -999; continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 120000 });
      const rouge = r.status !== 0;
      if (rouge) rouges++;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  remettre();
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ko = 0, fini = false;
process.on('exit', (c) => { if (!fini && c === 0) { console.log('❌ l’audit s’est arrêté avant la fin (une promesse jamais tenue)'); process.exitCode = 1; } });
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const BASE = 'https://base-de-banc.supabase.co';
const ORIGINE = 'https://vrm.exemple';

// Un monde : une horloge, une session, un faux PostgREST, un faux renouvellement partagé.
function monde({ expire = true, renouv = 'ok', revoque = false } = {}) {
  let t = 1_800_000_000_000;
  const m = { envois: [], renouvellements: 0, enVol: null, valides: new Set(), session: null };
  m.session = { access_token: 'jeton-vieux', refresh_token: 'r1', expires_at: expire ? t - 60_000 : t + 3_600_000 };
  if (!expire && !revoque) m.valides.add('jeton-vieux');
  m.maintenant = () => t;
  m.rafraichir = () => {
    if (m.enVol) return m.enVol;
    m.renouvellements++;
    m.enVol = new Promise((ok) => setTimeout(() => {
      m.enVol = null;
      if (renouv === 'ok') { const n = 'jeton-neuf-' + m.renouvellements; m.valides.add(n); m.session = { access_token: n, refresh_token: 'r' + (m.renouvellements + 1), expires_at: t + 3_600_000 }; return ok(true); }
      if (renouv === 'meme') return ok(true);   // « renouvelé » mais la même session (un autre onglet, adoptée)
      if (renouv === 'jamais') return;          // le verrou d'un autre onglet ne rend jamais la main
      ok(renouv === 'refus' ? false : null);
    }, 20));
    return m.enVol;
  };
  m.fetch = async (input, init) => {
    const h = (init && init.headers) || {};
    const auth = typeof h.get === 'function' ? h.get('authorization') : (h.Authorization || h.authorization || '');
    const tok = String(auth || '').replace(/^Bearer /, '');
    m.envois.push({ url: String(input), tok, methode: (init && init.method) || 'GET', range: typeof h.get === 'function' ? h.get('range') : (h.Range || null), apikey: typeof h.get === 'function' ? h.get('apikey') : (h.apikey || null) });
    const ok = m.valides.has(tok) || tok === 'cle-publique';
    return { ok, status: ok ? 200 : 401, json: async () => (ok ? [] : { message: 'JWT expired' }) };
  };
  return m;
}

(async () => {
  const J = await import(require('url').pathToFileURL(JF).href);
  const envelopper = (m, o = {}) => J.creerJetonFrais(m.fetch, Object.assign({ session: () => m.session, rafraichir: m.rafraichir, base: BASE, origine: ORIGINE, maintenant: m.maintenant }, o));
  const H = (tok, x) => Object.assign({ apikey: 'cle-publique', Authorization: `Bearer ${tok}` }, x || {});

  // J1. Un jeton expiré : la lecture ATTEND le renouvellement et part avec le jeton neuf.
  {
    const m = monde();
    const f = envelopper(m);
    const r = await f(`${BASE}/rest/v1/app_data?id=eq.main&select=rev:data->>rev`, { headers: H('jeton-vieux') });
    dit(r.status === 200 && m.envois.length === 1 && m.envois[0].tok === 'jeton-neuf-1', 'J1 jeton expiré : la lecture attend le renouvellement et part avec le jeton NEUF (aucun 401)', JSON.stringify(m.envois));
  }
  // J2. Le réveil : 39 lectures ensemble ⇒ UN renouvellement, 39 lectures au jeton neuf.
  {
    const m = monde();
    const f = envelopper(m);
    const rs = await Promise.all(Array.from({ length: 39 }, (_, i) => f(`${BASE}/rest/v1/app_data?id=eq.harvest_${i}_txn_1&select=id`, { headers: H('jeton-vieux', { Range: '0-999' }) })));
    dit(m.renouvellements === 1, 'J2 réveil (39 lectures dans la même seconde) : un SEUL renouvellement', m.renouvellements);
    dit(rs.every((r) => r.status === 200) && m.envois.length === 39 && m.envois.every((e) => e.tok === 'jeton-neuf-1'), 'J2 les 39 lectures partent au jeton neuf, aucune refusée', JSON.stringify(m.envois.filter((e) => e.tok !== 'jeton-neuf-1').slice(0, 3)));
    dit(m.envois.every((e) => e.range === '0-999' && e.apikey === 'cle-publique'), 'J2 les autres en-têtes (Range, apikey) sont gardés', JSON.stringify(m.envois[0]));
  }
  // J3. Renouvellement « pas su » (réseau) : la requête part telle quelle, sa réponse est rendue (jamais inventée).
  {
    const m = monde({ renouv: 'reseau' });
    const f = envelopper(m);
    const r = await f(`${BASE}/rest/v1/app_data?id=eq.main&select=data`, { headers: H('jeton-vieux') });
    dit(r.status === 401 && m.envois.length === 1 && m.envois[0].tok === 'jeton-vieux', 'J3 renouvellement pas su : la requête part une fois, le 401 est rendu tel quel (« pas su », jamais une réponse inventée)', JSON.stringify(m.envois));
  }
  // J4. Le verrou d'un autre onglet ne rend jamais la main : la requête part au bout de 8 s au plus.
  {
    const m = monde({ renouv: 'jamais' });
    const f = envelopper(m, { attente: 60 });
    const t0 = Date.now();
    const r = await Promise.race([f(`${BASE}/rest/v1/app_data?id=eq.main&select=data`, { headers: H('jeton-vieux') }), new Promise((ok) => setTimeout(() => ok(null), 2000))]);
    dit(r && m.envois.length === 1 && Date.now() - t0 < 2000, 'J4 un renouvellement qui ne répond jamais n’arrête pas la requête (attente bornée)', Date.now() - t0);
    dit(J.ATTENTE_MAX_MS <= 8000, 'J4 la borne est de 8 s au plus', J.ATTENTE_MAX_MS);
  }
  // J5. Un jeton qu'on croyait bon, refusé 401 par la base : UN renouvellement, UNE relance au jeton neuf.
  {
    const m = monde({ expire: false, revoque: true });
    const f = envelopper(m);
    const corps = JSON.stringify({ data: { rev: 2 } });
    const r = await f(`${BASE}/rest/v1/app_data?id=eq.main&data->>rev=eq.1&select=id`, { method: 'PATCH', headers: H('jeton-vieux', { 'Content-Type': 'application/json' }), body: corps });
    dit(r.status === 200 && m.envois.length === 2 && m.envois[0].tok === 'jeton-vieux' && m.envois[1].tok === 'jeton-neuf-1' && m.renouvellements === 1, 'J5 401 de la base sur un jeton « bon » : un renouvellement, UNE relance au jeton neuf (PostgREST n’a rien exécuté)', JSON.stringify(m.envois));
  }
  // J6. Renouvelé mais même jeton (session adoptée identique) : pas de relance en boucle.
  {
    const m = monde({ expire: false, revoque: true, renouv: 'meme' });
    const f = envelopper(m);
    const r = await f(`${BASE}/rest/v1/app_data?select=id`, { headers: H('jeton-vieux') });
    dit(r.status === 401 && m.envois.length === 1, 'J6 renouvellement qui rend le même jeton : aucune relance (une fois, jamais en boucle)', JSON.stringify(m.envois));
  }
  // J7. Les routes /api/ : jeton expiré ⇒ attendu et remplacé ; un 401 n'y est JAMAIS relancé ici.
  {
    const m = monde();
    const f = envelopper(m);
    const r = await f('/api/compte?mode=sante', { headers: { Authorization: 'Bearer jeton-vieux' } });
    dit(m.envois.length === 1 && m.envois[0].tok === 'jeton-neuf-1' && r.status === 200, 'J7 /api/ (chemin relatif) : la session neuve part, pas l’expirée', JSON.stringify(m.envois));
    const m2 = monde({ expire: false, revoque: true });
    const f2 = envelopper(m2);
    const r2 = await f2(`${ORIGINE}/api/push`, { method: 'POST', headers: { Authorization: 'Bearer jeton-vieux' }, body: '{}' });
    dit(r2.status === 401 && m2.envois.length === 1, 'J7 un 401 d’une route /api/ n’est jamais relancé (la route a pu agir)', JSON.stringify(m2.envois));
  }
  // J8. Ce qui ne porte pas CE jeton passe sans être touché : clé publique, autre hôte, Request, flux.
  {
    const m = monde();
    const f = envelopper(m);
    await f(`${BASE}/rest/v1/app_data?select=owner&limit=1`, { headers: { apikey: 'cle-publique', Authorization: 'Bearer cle-publique' } });
    await f('https://www.vinted.fr/api/v2/users/1', { headers: H('jeton-vieux') });
    await f(`${BASE}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: 'cle-publique' }, body: '{}' });
    dit(m.renouvellements === 0 && m.envois.map((e) => e.tok).join(',') === 'cle-publique,jeton-vieux,', 'J8 clé publique, un autre site, le renouvellement lui-même : rien d’attendu, rien de changé', JSON.stringify(m.envois));
    const m2 = monde({ expire: false, revoque: true });
    const f2 = envelopper(m2);
    const flux = { getReader() {} };
    await f2(`${BASE}/rest/v1/app_data`, { method: 'POST', headers: H('jeton-vieux'), body: flux });
    dit(m2.envois.length === 1, 'J8 un corps en flux (non rejouable) n’est jamais relancé', JSON.stringify(m2.envois));
  }
  // J9. Un jeton qui expire dans 5 s part déjà avec le neuf (marge de 10 s).
  {
    const m = monde({ expire: false });
    m.session.expires_at = m.maintenant() + 5000;
    const f = envelopper(m);
    await f(`${BASE}/rest/v1/app_data?select=id`, { headers: H('jeton-vieux') });
    dit(m.envois.length === 1 && m.envois[0].tok === 'jeton-neuf-1', 'J9 un jeton qui expire dans 5 s : renouvelé avant de partir', JSON.stringify(m.envois));
    const m2 = monde({ expire: false });
    const f2 = envelopper(m2);
    await f2(`${BASE}/rest/v1/app_data?select=id`, { headers: H('jeton-vieux') });
    dit(m2.renouvellements === 0 && m2.envois[0].tok === 'jeton-vieux', 'J9 un jeton valable une heure : aucun renouvellement, aucune attente', JSON.stringify(m2.envois));
  }
  // J10. Les en-têtes en Headers et l'original intact.
  {
    const m = monde();
    const f = envelopper(m);
    const init = { headers: { apikey: 'cle-publique', Authorization: 'Bearer jeton-vieux' } };
    await f(`${BASE}/rest/v1/app_data?select=id`, init);
    dit(init.headers.Authorization === 'Bearer jeton-vieux', 'J10 l’objet d’en-têtes de l’appelant n’est pas modifié (une copie part)');
  }
  // J11. App.jsx le pose, une fois, avec SA session et SON renouvellement partagé.
  {
    const app = fs.readFileSync(APP, 'utf8').replace(/\/\/[^\n]*/g, '');
    const n = (app.match(/installerJetonFrais\(\{ session: \(\) => AUTH\.session, rafraichir: \(o\) => authRefresh\(o\), base: SUPABASE_URL \}\);/g) || []).length;
    dit(n === 1 && /import \{ installerJetonFrais \} from '\.\/jetonFrais\.js';/.test(app), 'J11 App.jsx pose la règle une fois (session de l’app, `authRefresh` partagé, la base)', n);
    const iAuth = app.indexOf('const authRefresh = (opt) =>');
    const iPose = app.indexOf('installerJetonFrais({');
    dit(iAuth > 0 && iPose > iAuth, 'J11 posée APRÈS `authRefresh` (jamais lu avant sa déclaration, §4.6)', `${iAuth} ${iPose}`);
  }
  fini = true;
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ aucune requête ne part avec un jeton déjà expiré');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
