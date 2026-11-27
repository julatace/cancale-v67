require('./_reglages-compat.cjs');   // Paramètres en catégories : la catégorie d'une rangée touchée avant elle
// ════════════════════════════════════════════════════════════════════════════
//  « TOUT VA BIEN ? » — CE QUI TOURNE, MORCEAU PAR MORCEAU (27 nov., lot tout-va-bien)
//  Partie A — LA RÈGLE (src/toutVaBienSondes.js), exécutée telle quelle :
//    A1 le serveur : pas de réponse ⇒ « — » (ni vert ni alerte), base en panne ⇒ le geste, base ok ⇒ vert ;
//    A2 les e-mails : réception pas lue ⇒ « — » ; relevé de plus de 20 min ⇒ le geste ; chaîne en panne ⇒ le geste ;
//    A3 la dernière capture : appareils pas lus ⇒ « — » ; plus de 24 h ⇒ le geste ; 6 min ⇒ vert ;
//    A4 la file des favoris : UN compte pas lu ⇒ « — » (jamais « vert ») ; incertains ⇒ le geste ; en cours ⇒ vert ;
//    A5 un site : compte à relire ⇒ le geste ; à jour ⇒ vert ; site pas lu ⇒ « — » ;
//    A6 l'extension : en lecture ⇒ rien affirmé ; muette ⇒ « — » ; à jour ⇒ vert ; pas branchée ⇒ le geste ;
//    A7 chaque rangée bloquée tient en 8 mots (sa phrase), en français, et porte un « Pourquoi ? ».
//    À chaque passage (`--prouve` les force, BANC_SANS_MUTATIONS=1 les saute) : quatre mutations de la règle (un « pas su » rendu vert, un compte pas lu oublié, la borne
//    des 24 h retirée, une réception pas lue rendue verte) ⇒ la partie A doit ROUGIR à chacune.
//  Partie B — LA VRAIE APP (`dist`), une fausse base (projection `select=`), données INVENTÉES (dépôt public),
//    une extension simulée (le pont `__vmr`, branchée, à la version attendue) :
//    « vert » : chaque morceau vert, le résumé « Tout va bien » ;
//    « bloque » : serveur muet ⇒ « — » et sa raison ; e-mails, capture, favoris, un compte ⇒ leur phrase et
//    LEUR geste ; « Pourquoi ? » déplie le détail ; toucher la file des favoris mène à Favoris ; la ligne
//    « second_compte pas relu depuis 30 heures » d'Aujourd'hui (src/connexions/EcranConnexions.jsx) mène à « Tout va bien ? ».
//    À 390 et 1512 px, clair et sombre : captures dans BANC_CAPTURES (défaut scripts/bancs/captures/), à REGARDER.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
// Les mutations tournent à chaque passage (quelques millisecondes) ; `BANC_SANS_MUTATIONS=1` les saute.
const PROUVE = process.argv.includes('--prouve') || process.env.BANC_SANS_MUTATIONS !== '1';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };

// ── PARTIE A : la règle ─────────────────────────────────────────────────────
const MIN = 60e3, H = 3600e3, T0 = Date.parse('2026-11-27T12:00:00Z');
async function partieA(fichier, fr, sortie = dit) {
  let S;
  try { S = await import(pathToFileURL(fichier).href + '?t=' + Math.random()); } catch (e) { sortie(false, 'A0 la règle src/toutVaBienSondes.js se charge', String(e.message || e).slice(0, 160)); return; }
  const q = (t) => 'Q' + t;
  const texte = (x) => { if (!x || !x.k) return ''; let v = fr[x.k]; if (v && typeof v === 'object') v = v.other; return String(v || '').replace(/\{(\w+)\}/g, (m, k) => String(x.v && x.v[k] != null ? x.v[k] : '')); };
  const mots = (s) => String(s || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const toutes = [];
  const garde = (s) => { if (s) toutes.push(s); return s; };
  // A1
  const s0 = garde(S.sondeServeur(null)), s1 = garde(S.sondeServeur({ ok: true, etat: { base: 'panne', notifications: 'ok' } })), s2 = garde(S.sondeServeur({ ok: true, etat: { base: 'ok', notifications: 'ok' } }));
  sortie(s0.etat === 'passu' && s0.valeur === '—' && s0.pourquoi.length > 0 && S.sondeServeur(undefined).etat === 'lecture', 'A1 serveur muet ⇒ « — » et sa raison (ni vert ni alerte) ; en cours ⇒ rien affirmé', JSON.stringify(s0));
  sortie(s1.etat === 'geste' && s1.geste && s1.geste.lien === '/statut' && s2.etat === 'ok' && S.sondeServeur({ ok: true, etat: { base: 'inconnu' } }).etat === 'passu', 'A1 base en panne ⇒ « Voir l’état » ; base ok ⇒ vert ; base inconnue ⇒ « — »');
  // A2
  const rec = (passeIlYa, dernier, etat = 'succes') => ({ ok: true, dernierEmail: dernier == null ? null : new Date(T0 - dernier).toISOString(), collecteur: { dernierPassage: new Date(T0 - passeIlYa).toISOString(), dernierSucces: new Date(T0 - passeIlYa).toISOString(), etat } });
  const e0 = garde(S.sondeEmails(null, { maintenant: T0, quand: q })), e1 = garde(S.sondeEmails(rec(2 * MIN, 30 * MIN), { maintenant: T0, quand: q })), e2 = garde(S.sondeEmails(rec(2 * H, 3 * H), { maintenant: T0, quand: q }));
  const e3 = garde(S.sondeEmails(rec(2 * MIN, 30 * MIN), { chaine: 'panne', maintenant: T0, quand: q })), e4 = garde(S.sondeEmails({ ok: true, collecteur: {} }, { maintenant: T0, quand: q }));
  sortie(e0.etat === 'passu' && e0.valeur === '—' && e4.etat === 'passu' && e4.valeur === '—', 'A2 réception pas lue, ou relevé sans état ⇒ « — » (jamais vert)', `${e0.etat}/${e4.etat}`);
  sortie(e1.etat === 'ok' && /Q/.test(JSON.stringify(e1.sous)) && e2.etat === 'geste' && e2.geste && e2.geste.aller === '?tab=emails' && e3.etat === 'geste', 'A2 relevé il y a 2 min ⇒ vert (dernier e-mail daté) ; il y a 2 h ⇒ le geste ; chaîne du serveur en panne ⇒ le geste', `${e1.etat}/${e2.etat}/${e3.etat}`);
  // A3
  const ap = (ilYa) => [{ nom: 'Chrome · Mac', at: T0 - ilYa, flux: { vinted: { okAt: T0 - ilYa } } }];
  const c0 = garde(S.sondeCapture(null, { maintenant: T0, quand: q })), c1 = garde(S.sondeCapture(ap(6 * MIN), { maintenant: T0, quand: q })), c2 = garde(S.sondeCapture(ap(30 * H), { maintenant: T0, quand: q }));
  sortie(c0.etat === 'passu' && c0.valeur === '—' && c1.etat === 'ok' && c2.etat === 'geste' && c2.geste && c2.geste.type === 'compte' && c2.geste.plateforme === 'vinted' && garde(S.sondeCapture([], { maintenant: T0 })).etat === 'neutre',
    'A3 capture : appareils pas lus ⇒ « — » ; 6 min ⇒ vert ; 30 h ⇒ « Ouvrir Vinted » ; aucune ⇒ neutre', `${c0.etat}/${c1.etat}/${c2.etat}`);
  // A4
  const carte = (o) => ({ active: false, attente: 0, incertains: 0, encours: 0, raison: '', ...o });
  const f0 = garde(S.sondeFavoris([{ uid: '1', nom: 'a', carte: carte({}) }, { uid: '2', nom: 'b', carte: null }], { quand: q }));
  const f1 = garde(S.sondeFavoris([{ uid: '1', nom: 'a', carte: carte({ incertains: 2 }) }, { uid: '2', nom: 'b', carte: null }], { quand: q }));
  const f2 = garde(S.sondeFavoris([{ uid: '1', nom: 'a', carte: carte({ active: true, attente: 3, prochain: T0 + MIN }) }], { quand: q }));
  const f3 = garde(S.sondeFavoris([{ uid: '1', nom: 'a', carte: carte({ attente: 4, raison: 'Pause' }) }], { quand: q }));
  sortie(f0.etat === 'passu' && f0.valeur === '—' && /b/.test(JSON.stringify(f0.pourquoi)) && garde(S.sondeFavoris(null)).etat === 'passu', 'A4 un compte dont la file n’a pas été lue ⇒ « — », le compte nommé (jamais « vert »)', JSON.stringify(f0).slice(0, 200));
  sortie(f1.etat === 'geste' && f1.geste.aller === '?tab=favoris' && f2.etat === 'ok' && f3.etat === 'geste' && S.sondeFavoris([]) === null, 'A4 incertains ⇒ « Voir » (Favoris) ; en cours ⇒ vert ; en pause avec des favoris en attente ⇒ le geste ; aucun compte ⇒ pas de rangée');
  // A5
  const l = (id, o) => ({ plateforme: 'vinted', id, nom: 'c' + id, etat: 'lu', quand: 'relu il y a 1 h', bloque: '', geste: false, ...o });
  const v0 = garde(S.sondeSite('vinted', { lignes: [l('1'), l('2', { etat: 'a-relire', geste: true, bloque: 'ouvre Vinted' })] })), v1 = garde(S.sondeSite('vinted', { lignes: [l('1'), l('2')] }));
  const v2 = garde(S.sondeSite('vinted', { lignes: [l('1')], passu: ['vinted'] })), v3 = garde(S.sondeSite('vinted', { lignes: [l('1')], pannes: [{ plateforme: 'vinted', id: '1', cause: 'réseau', geste: 'x' }] }));
  sortie(v0.etat === 'geste' && v0.geste.type === 'compte' && v1.etat === 'ok' && v2.etat === 'passu' && v2.valeur === '—' && v3.etat === 'geste' && v3.geste.type === 'panne' && S.sondeSite('ebay', { lignes: [l('1')] }) === null,
    'A5 site : à relire ⇒ « Ouvrir Vinted » ; à jour ⇒ vert ; pas lu ⇒ « — » ; envoi refusé ⇒ « Voir » ; aucun compte ⇒ pas de rangée', `${v0.etat}/${v1.etat}/${v2.etat}/${v3.etat}`);
  // A6
  const x0 = S.sondeExtension(undefined), x1 = garde(S.sondeExtension({ code: 'verif', ton: 'neutre' })), x2 = garde(S.sondeExtension({ code: 'ok', ton: 'ok', cle: 'ext.nav.ok', vars: { version: '5.455.2' } }, { contact: T0, quand: q, attendue: '5.455.2' }));
  const x3 = garde(S.sondeExtension({ code: 'vrm', ton: 'geste', cle: 'ext.nav.vrm', geste: 'brancher' }, { contact: null }));
  sortie(x0.etat === 'lecture' && x1.etat === 'passu' && x1.valeur === '—' && x2.etat === 'ok' && /Q/.test(JSON.stringify(x2.pourquoi)) && x3.etat === 'geste' && x3.valeur.k === 'tvb.g.brancher',
    'A6 extension : en lecture ⇒ rien affirmé ; pas encore répondu ⇒ « — » ; à jour ⇒ vert + dernier contact ; pas branchée ⇒ « Brancher »', `${x0.etat}/${x1.etat}/${x2.etat}/${x3.etat}`);
  // A7
  const bloques = toutes.filter((s) => s.etat === 'geste');
  const longs = bloques.filter((s) => mots(texte(s.sous)) > 8 || !texte(s.sous) || !s.valeur || !texte(s.valeur) || !(s.pourquoi && s.pourquoi.length && s.pourquoi.every((p) => fr[p.k] || /^ext\./.test(p.k))));
  sortie(bloques.length >= 8 && !longs.length, `A7 chaque rangée bloquée : une phrase de 8 mots au plus, LE geste, un « Pourquoi ? » (${bloques.length} jugées)`, longs.map((s) => `${s.cle}:${texte(s.sous)}`).join(' | '));
  const passu = toutes.filter((s) => s.etat === 'passu');
  sortie(passu.length >= 6 && passu.every((s) => s.valeur === '—' && texte(s.sous) && s.pourquoi.length && !s.geste), `A7 chaque « pas su » : « — », la raison en une phrase, aucun geste inventé (${passu.length} jugées)`);
  const cles = new Set(); for (const s of toutes) for (const x of [s.titre, s.sous, s.valeur, ...(s.pourquoi || [])]) if (x && x.k && !/^ext\./.test(x.k)) cles.add(x.k);
  const absentes = [...cles].filter((k) => fr[k] == null);
  sortie(!absentes.length, 'A7 chaque texte est une clé tr() présente en français', absentes.join(', '));
}
const MUTATIONS = [
  ['un serveur muet rendu vert', "return { ...base, etat: 'passu', sous: L('tvb.s.srv.passu')", "return { ...base, etat: 'ok', sous: L('tvb.s.srv.passu')"],
  ['un compte de favoris pas lu oublié', "  if (ratees.length) return { ...base, etat: 'passu', sous: L('tvb.s.fav.passu'), valeur: PASSU, pourquoi: manque };\n", ''],
  ['la borne des 24 h de la capture retirée', 'if (maintenant - best.at > CAPTURE_VIEILLE_MS)', 'if (false)'],
  ['une réception pas lue rendue verte', "if (!reception || typeof reception !== 'object') return { ...base, etat: 'passu'", "if (!reception || typeof reception !== 'object') return { ...base, etat: 'ok'"],
];

// ── PARTIE B : la vraie app ─────────────────────────────────────────────────
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 4397);
const CAPT = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
const ATTENDUE = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8')) || [])[1];
const iso = (ilYa) => new Date(Date.now() - ilYa).toISOString();
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'shop_test', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'second_compte', domain: 'www.vinted.fr', updated_at: iso(0) },
];
function base(scen) {
  const b = scen === 'bloque';
  const lu2 = b ? 30 * H : 2 * H, okAt = b ? 30 * H : 6 * MIN;
  return [
    { id: 'harvest_111_profile', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_111_listings', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_222_profile', data: { capturedAt: iso(lu2) } },
    { id: 'harvest_222_orders_sold', data: { capturedAt: iso(lu2) } },
    { id: 'panel_comptes_etat', data: { comptes: {} } },
    { id: 'lbc_accounts', data: { accounts: { 'lbc-account:abc123': { id: 'lbc-account:abc123', name: 'Boutique LBC', type: 'particulier', sessionAt: Date.now() - 3 * H } } } },
    { id: 'lbc_listings', data: { lectures: { abc123: { at: Date.now() - 3 * H } } } },
    { id: 'ext_appareil_0f1e2d3c4b5a6978', data: { v: 1, appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: ATTENDUE, code: ATTENDUE, at: iso(okAt), atMs: Date.now() - okAt,
      flux: { vinted: { okAt: Date.now() - okAt, koAt: null, refus: [] } }, vus: { vinted: { 111: Date.now() - okAt } } } },
    { id: 'panel_diag_capture', data: { ver: ATTENDUE, verCode: ATTENDUE, majAt: iso(okAt), n: {}, rates: {} } },
  ];
}
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = null; continue; }
    const texte = /->>[^>]*$/.test(src);
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};
// L'extension simulée : un pont `__vmr` branché, à la version attendue (le protocole de src/App.jsx, comme demarrage-parcours).
const PONT = (version) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (ev) => {
    const d = ev.data; if (ev.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: '', user_id: '', cloisonne: false } });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '', user_id: '' }, vinted: null, cmds: {} } });
  });
  setTimeout(() => post({ __vmr: 'ready', version }), 50);
  window.__aller = [];
  window.addEventListener('vrm:aller', (e) => { window.__aller.push(String(e.detail || '')); });
};

async function scenario(b, scen, largeur, sombre) {
  const rows = base(scen);
  const nom = `${scen}-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  const ctx = await b.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_je_vends', JSON.stringify({ choix: 'sneakers', at: '2026-11-01T10:00:00Z', vu: 'banc' })); localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 })); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); { const t = new Date().toISOString(); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ extension: t, emails: t, vinted: t, premiere: t, configuration: t, at: Date.now() })); } localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, ATTENDUE);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u) && !/vinted_accounts/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  const lectures = { sante: 0, reception: 0, favoris: 0 };
  await pg.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    const j = (c, d) => r.fulfill({ status: c, contentType: 'application/json', body: JSON.stringify(d) });
    if (u.pathname === '/api/sante') { lectures.sante++; return scen === 'bloque' ? j(503, { ok: false }) : j(200, { ok: true, etat: { base: 'ok', emails: 'ok', notifications: 'ok', verifieA: iso(0) }, statut: null }); }
    if (u.pathname === '/api/email-rattacher' && u.searchParams.get('mode') === 'reception') {
      lectures.reception++;
      const passe = scen === 'bloque' ? 2 * H : 2 * MIN;
      return j(200, { ok: true, emails: [], adresses: [], dernierEmail: iso(scen === 'bloque' ? 3 * H : 30 * MIN), collecteur: { dernierSucces: iso(passe), dernierPassage: iso(passe), etat: 'succes' } });
    }
    if (u.pathname === '/api/compte' && u.searchParams.get('mode') === 'favoris' && r.request().method() === 'GET') {
      lectures.favoris++;
      const uid = u.searchParams.get('uid');
      if (scen === 'bloque' && uid === '222') return j(503, { message: 'La file n’a pas pu être confirmée.' });
      const carte = { active: false, total: 0, envoyes: 0, ignores: 0, attente: 0, encours: 0, incertains: scen === 'bloque' ? 2 : 0, refuses: 0, annules: 0, prochain: null, raison: '', raisons: {}, sautes: 0, pasEnvoyes: 0 };
      return j(200, { ok: true, uid, vue: { active: false, raison: '', prochain: null, jobs: [] }, carte, serveur: Date.now() });
    }
    return j(200, {});
  });

  // 1. (bloque) Aujourd'hui : la ligne « second_compte pas relu depuis 30 heures » mène à « Tout va bien ? ».
  if (scen === 'bloque') {
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    const ligne = pg.locator('[data-cnx-journee]');
    await ligne.first().waitFor({ timeout: 25000 }).catch(() => {});
    const t = (await ligne.count()) ? await ligne.first().innerText() : '';
    dit((await ligne.count()) === 1 && (await ligne.first().getAttribute('data-cnx-journee')) === 'relu' && /second_compte/.test(t), `${nom} : Aujourd'hui dit « second_compte pas relu depuis… »`, t);
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: path.join(CAPT, `tvb-sondes-journee-${nom}.png`) }).catch(() => {});
    const voir = pg.locator('[data-cnx-journee] [data-cnx-toutvabien]:visible');
    dit((await voir.count()) === 1, `${nom} : son « Voir » est la porte de « Tout va bien ? »`);
    if (await voir.count()) await voir.first().click({ timeout: 10000 }).catch(() => {});
    const arrive = await pg.waitForSelector('[data-tout-va-bien]', { state: 'visible', timeout: 25000 }).then(() => true).catch(() => false);
    dit(arrive, `${nom} : … et y mène (Paramètres → Tout va bien ?)`);
    if (!arrive) await pg.goto(`http://localhost:${PORT}/?tab=settings&reglage=toutvabien`, { waitUntil: 'domcontentloaded' });
  } else {
    await pg.goto(`http://localhost:${PORT}/?tab=settings&reglage=toutvabien`, { waitUntil: 'domcontentloaded' });
  }
  const vu = await pg.waitForSelector('[data-tout-va-bien]', { state: 'visible', timeout: 25000 }).then(() => true).catch(() => false);
  if (!vu) { await pg.locator('[data-sous-ouvrir="toutvabien"], [data-reglage-toutvabien]').first().click({ timeout: 15000 }).catch(() => {}); }
  // Toutes les sondes ont répondu (aucune rangée en lecture).
  const fini = await pg.waitForFunction(() => { const l = [...document.querySelectorAll('[data-tvb-sonde]')]; return l.length >= 5 && l.every((x) => x.getAttribute('data-tvb-sonde-etat') !== 'lecture'); }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  dit(fini, `${nom} : chaque sonde a répondu (aucune rangée « Je regarde… »)`);
  const sondes = await pg.$$eval('[data-tvb-sonde]', (l) => l.map((x) => ({ cle: x.getAttribute('data-tvb-sonde'), etat: x.getAttribute('data-tvb-sonde-etat'), geste: x.getAttribute('data-tvb-sonde-geste'),
    titre: (x.querySelector('.n-rangee-titre') || {}).textContent || '', sous: (x.querySelector('.n-rangee-sous-texte') || {}).textContent || '', valeur: (x.querySelector('.n-rangee-valeur') || {}).textContent || '',
    pourquoi: !!x.querySelector('[data-tvb-sonde-pourquoi]'), point: getComputedStyle(x.querySelector('.vrm-tvb-sonde-point')).backgroundColor })));
  const de = (c) => sondes.find((s) => s.cle === c) || {};
  const resume = ((await pg.locator('[data-tvb-resume]').first().innerText().catch(() => '')) || '').split('\n')[0].trim();
  const attendues = ['extension', 'site:vinted', 'site:leboncoin', 'emails', 'capture', 'favoris', 'serveur'];
  dit(attendues.every((c) => sondes.some((s) => s.cle === c)), `${nom} : une rangée par morceau (${attendues.join(', ')})`, sondes.map((s) => s.cle).join(','));
  const rgb = (c) => (/(\d+),\s*(\d+),\s*(\d+)/.exec(c) || []).slice(1).map(Number);
  const vert = (c) => { const [r, g, bb] = rgb(c); return g > r + 25 && g > bb; };
  const mots = (t) => String(t || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  if (scen === 'vert') {
    const pasVerts = sondes.filter((s) => s.etat !== 'ok');
    dit(!pasVerts.length, `${nom} : tout tourne ⇒ chaque rangée est verte`, pasVerts.map((s) => `${s.cle}=${s.etat}:${s.sous}`).join(' | '));
    dit(sondes.every((s) => vert(s.point)), `${nom} : le point de chaque rangée est VERT`, sondes.map((s) => s.point).join(' '));
    dit(/Version \d+\.\d+/.test(de('extension').sous) && /il y a|aujourd|à l’instant/.test(de('capture').sous) && /Dernier reçu/.test(de('emails').sous), `${nom} : version de l’extension, dernière capture et dernier e-mail sont dits`, `${de('extension').sous} | ${de('capture').sous} | ${de('emails').sous}`);
    dit(resume === 'Tout va bien', `${nom} : « Tout va bien »`, resume);
  } else {
    const srv = de('serveur');
    dit(srv.etat === 'passu' && srv.valeur.trim() === '—' && /Pas de réponse/.test(srv.sous) && !srv.geste && !vert(srv.point), `${nom} : serveur muet ⇒ « — » et « Pas de réponse », ni vert ni geste`, JSON.stringify(srv));
    for (const c of ['emails', 'capture', 'favoris', 'site:vinted']) {
      const s = de(c);
      dit(s.etat === 'geste' && s.geste && s.valeur.trim() && mots(s.sous) <= 8 && s.pourquoi && !vert(s.point), `${nom} : ${c} bloqué ⇒ une phrase de ≤ 8 mots, LE geste « ${s.valeur.trim()} », un « Pourquoi ? »`, JSON.stringify(s));
    }
    dit(!/Tout va bien/.test(resume) && /[4-9] choses à régler/.test(resume), `${nom} : le résumé compte ce qui est bloqué`, resume);
    // « Pourquoi ? » déplie le détail des e-mails.
    const pq = pg.locator('[data-tvb-sonde-pourquoi="emails"] summary');
    if (await pq.count()) { await pq.first().click().catch(() => {}); await pg.waitForTimeout(250); }
    const det = await pg.locator('[data-tvb-sonde-pourquoi="emails"]').innerText().catch(() => '');
    dit(/Dernier relevé de la boîte VRM/.test(det) && /Dernier e-mail rangé pour toi/.test(det), `${nom} : « Pourquoi ? » dit le dernier relevé et le dernier e-mail`, det.slice(0, 200));
    await pg.screenshot({ path: path.join(CAPT, `tvb-sondes-pourquoi-${nom}.png`), fullPage: false }).catch(() => {});
    const pqs = pg.locator('[data-tvb-sonde-pourquoi="serveur"] summary');
    if (await pqs.count()) { await pqs.first().click().catch(() => {}); await pg.waitForTimeout(200); }
    dit(/n’a pas répondu/.test(await pg.locator('[data-tvb-sonde-pourquoi="serveur"]').innerText().catch(() => '')), `${nom} : la raison du « — » du serveur est dite`);
  }
  const petites = await pg.evaluate(() => [...document.querySelectorAll('[data-tvb-sondes] button, [data-tvb-sondes] a, [data-tvb-sondes] summary')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5).map((e) => (e.className + ':' + e.textContent).slice(0, 50)));
  dit(!petites.length, `${nom} : cibles de 44 px`, petites.join(' | '));
  dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
  dit(lectures.sante >= 1 && lectures.reception >= 1 && lectures.favoris >= 2, `${nom} : les trois lectures sont faites (serveur, réception, file de chaque compte)`, JSON.stringify(lectures));
  await pg.evaluate(() => { const e = document.querySelector('[data-tvb-sondes]'); if (e) e.scrollIntoView({ block: 'start' }); });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(CAPT, `tvb-sondes-${nom}.png`) }).catch(() => {});
  if (scen === 'bloque') {
    // Toucher la file des favoris mène à Favoris (le geste de la rangée).
    await pg.evaluate(() => { window.__aller = []; });
    await pg.locator('[data-tvb-sonde="favoris"] .n-rangee-corps').first().click({ timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(400);
    const aller = await pg.evaluate(() => window.__aller.slice());
    dit(aller.includes('?tab=favoris'), `${nom} : toucher la file des favoris mène à Favoris`, JSON.stringify(aller));
  }
  dit(!errs.length, `${nom} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
  await ctx.close();
}

(async () => {
  const fr = (await import(pathToFileURL(path.join(RACINE, 'src', 'i18n', 'langues', 'fr', 'toutVaBienSondes.js')).href).catch(() => ({ default: {} }))).default;
  const frExt = (await import(pathToFileURL(path.join(RACINE, 'src', 'i18n', 'langues', 'fr', 'extension.js')).href).catch(() => ({ default: {} }))).default;
  const frDm = (await import(pathToFileURL(path.join(RACINE, 'src', 'i18n', 'langues', 'fr', 'demarrage.js')).href).catch(() => ({ default: {} }))).default;
  const FR = { ...frExt, ...frDm, ...fr };
  const module = path.join(RACINE, 'src', 'toutVaBienSondes.js');
  await partieA(module, FR);
  if (PROUVE) {
    const src = fs.readFileSync(module, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvb-mut-'));
    for (const [quoi, de, vers] of MUTATIONS) {
      if (!src.includes(de)) { dit(false, `mutation « ${quoi} » applicable`, 'texte introuvable'); continue; }
      const f = path.join(dir, `m${MUTATIONS.findIndex((m) => m[0] === quoi)}.mjs`);
      fs.writeFileSync(f, src.replace(de, vers));
      let rouges = 0; await partieA(f, FR, (c) => { if (!c) rouges++; });
      dit(rouges > 0, `mutation « ${quoi} » ⇒ la partie A rougit (${rouges} rouge(s))`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (process.env.BANC_SANS_APP === '1') return fin();
  fs.mkdirSync(CAPT, { recursive: true });
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
  const srv = http.createServer((q, r) => {
    let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(DIST, f);
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
  await new Promise((ok2, ko2) => { srv.on('error', ko2); srv.listen(PORT, ok2); }).catch((e) => { dit(false, `port ${PORT} libre`, e.code); });
  const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const liste = (process.env.SCENARIOS || 'vert,bloque').split(',');
    for (const scen of liste) for (const [l, s] of [[390, false], [1512, false], [390, true], [1512, true]]) {
      try { await scenario(b, scen, l, s); } catch (e) { dit(false, `${scen}-${l}-${s ? 'sombre' : 'clair'} s’exécute`, String(e.message || e).slice(0, 200)); }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  fin();
})();
function fin() {
  console.log(ko ? `\n❌ tout-va-bien-sondes : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ tout-va-bien-sondes : ${ok} verts`);
  process.exit(ko ? 1 : 0);
}
