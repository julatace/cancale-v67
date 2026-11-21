#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « QUE L'EXTENSION CAPTE LES ANNONCES ET LES MESSAGES VESTIAIRE ET
//  LEBONCOIN PARFAITEMENT » (1er nov., extension 5.299)
// ════════════════════════════════════════════════════════════════════════════
//  Le VRAI `vc-inject.js` (monde de la page, fetch/XHR enveloppés), le VRAI
//  relais `vc.js`, le VRAI `background.js` (`_fond-vm.cjs`, base à état) et les
//  VRAIES fonctions de l'écran Vestiaire de `src/App.jsx`. Chaque contrôle est un
//  cas où la capture RATAIT ou se TROMPAIT sur la 5.296 :
//   C1 une réponse d'ERREUR (401) n'est pas une liste ; une réponse au FORMAT
//      INCONNU n'est pas « aucune annonce » : ni fraîcheur, ni total, rien vidé,
//      sa forme gardée ; une page XHR en `responseType = 'json'` est lue ;
//   C2 changer de compte DANS le même onglet : la liste du compte B, rendue
//      avant son `/users/me`, n'est pas rangée sous A et n'efface pas les
//      annonces de A ; compte pas su ⇒ une liste entière ne retire pas les
//      annonces rangées sous un compte ;
//   C3 une liste en PLUSIEURS pages, lue en entier, fait foi (une annonce
//      supprimée en sort) ; un total qui change en route ne décide rien ;
//   C4 la fiche se lit au plus près : le titre n'est pas la marque, la photo
//      n'est pas l'avatar du vendeur ;
//   C5 un émoji coupé en deux par une borne de longueur ne fait plus refuser la
//      ligne par la base (jsonb refuse un « surrogate » seul) ;
//   C6 les non-lus Vestiaire sont rangés PAR COMPTE (et l'app les additionne) ;
//   C7 répondre : la page refuse d'envoyer si son compte n'est pas celui que le
//      fond attend (rien ne part) ;
//   C8 Leboncoin : le compteur de messagerie et les comptes liés arrivés dans la
//      même seconde sont TOUS LES DEUX rangés (plus de réécriture perdue) ;
//   C9 l'app : une annonce plus vue depuis 24 h sous une lecture fraîche est
//      « à confirmer », pas « en ligne ».
//  `--src`/`--inject`/`--relais`/`--app` : une autre copie (preuve sur le code
//  d'avant, §6.1). `--prouve` : chaque règle réaffaiblie doit faire rougir.
//  Données INVENTÉES uniquement (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
  app: arg('--app', path.join(racine, 'src/App.jsx')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['erreurLue', 'inject', 'if (DE_VC(url) && res.status >= 200 && res.status < 300 && /json/i', 'if (DE_VC(url) && /json/i'],
    ['inconnuVide', 'inject', "if (!listeConnue(obj, arr)) { post({ kind: 'vcannonces'", "if (false) { post({ kind: 'vcannonces'"],
    ['inconnuDate', 'src', "if (Array.isArray(patch.inconnu) && !(Array.isArray(patch.items) && patch.items.length)) {", 'if (false) {'],
    ['xhrJson', 'inject', "t = this.responseType === 'json' ? (this.response == null ? null : JSON.stringify(this.response)) :", 't ='],
    ['compteOnglet', 'src', 'return onglet && page && onglet === page ? onglet : \'\';', 'return onglet;'],
    ['compteInconnuEfface', 'src', "const autreCompteVc = (ligne, lecture) => !!(ligne && (!lecture || ligne !== lecture));", "const autreCompteVc = (ligne, lecture) => !!(ligne && lecture && ligne !== lecture);"],
    ['sansPages', 'inject', "return l.ids.size === total ? [...l.ids] : null;", 'return null;'],
    ['totalBouge', 'inject', "const cle = tete + req + '|' + total + '|' + moiId;", "const cle = tete + req + '|' + moiId;"],
    ['ficheProfonde', 'inject', "if (PAS_ACHETEUR.test(k) || PAS_FICHE.test(k)) continue;\n          if (!out.titre", "if (PAS_ACHETEUR.test(k)) continue;\n          if (!out.titre"],
    ['avatar', 'inject', "if (PAS_ACHETEUR.test(k) || PAS_FICHE.test(k)) continue; suivant.push([x[k], prof + 1, sousPhoto || CLE_PHOTO.test(k)]);", "if (PAS_ACHETEUR.test(k)) continue; suivant.push([x[k], prof + 1, sousPhoto || CLE_PHOTO.test(k)]);"],
    ['emojiPage', 'inject', "t = t.slice(0, n); return /[\\ud800-\\udbff]$/.test(t) ? t.slice(0, -1) : t; };", 't = t.slice(0, n); return t; };'],
    ['emojiFond', 'src', "apercu: dernier ? coupeVc(dernier.t, 160) : ''", "apercu: dernier ? String(dernier.t).slice(0, 160) : ''"],
    ['compteurGlobal', 'src', "if (compteM) data.compteurs = Object.assign({}, cur.compteurs || {}, { [compteM]: { messages: n, at: iso } });", ''],
    ['envoiAutreCompte', 'inject', "if (d.compte !== undefined && (!moiId || String(d.compte) !== moiId)) return fin(", "if (false) return fin("],
    ['lbcSansFile', 'src', "const run = _lbcMessagesChaine.then(() => storeLbcMessagesUneFois(patch), () => storeLbcMessagesUneFois(patch));", 'const run = storeLbcMessagesUneFois(patch);'],
    ['appEnLigne', 'app', "if (isFinite(vu) && isFinite(lu) && lu - vu > 24 * 3600e3", 'if (false'],
    ['appSomme', 'app', "if (par.length) return { n: par.reduce((t, c) => t + c.messages, 0)", "if (false) return { n: 0"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-vc-lbc-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 180000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => JSON.parse(JSON.stringify(x));
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
// Une chaîne mal formée (moitié d'émoji seule) : ce que jsonb refuse.
const MAL_FORME = /[\ud800-\udbff](?![\udc00-\udfff])|(?:^|[^\ud800-\udbff])[\udc00-\udfff]/;
const malForme = (x) => { let bad = false; const v = (y) => { if (bad) return; if (typeof y === 'string') { if (MAL_FORME.test(y)) bad = true; } else if (y && typeof y === 'object') for (const k of Object.keys(y)) { if (MAL_FORME.test(k)) bad = true; v(y[k]); } }; v(x); return bad; };

// ── Le VRAI vc-inject.js dans une page vestiairecollective.com ──────────────
function pageVc() {
  const INJ = fs.readFileSync(F.inject, 'utf8');
  const posts = [], ecoutes = [], appels = [];
  const routes = {};   // url → { status, body, ctype }
  const win = {
    postMessage: (m) => { if (m && m.__tag === 'CANCALE_VC_ORDRE') { for (const f of ecoutes.slice()) f({ source: win, data: copie(m) }); return; } posts.push(copie(m)); },
    fetch: async (u, init) => {
      appels.push({ u: String(u), methode: (init && init.method) || 'GET' });
      const r = routes[String(u)] || { status: 200, body: '{}' };
      const texte = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: () => r.ctype || 'application/json' }, clone() { return this; }, text: async () => texte, arrayBuffer: async () => (r.octets ? r.octets.buffer.slice(r.octets.byteOffset, r.octets.byteOffset + r.octets.byteLength) : new ArrayBuffer(0)) };
    },
    addEventListener: (t, f) => { if (t === 'message') ecoutes.push(f); },
  };
  win.top = win; win.self = win;
  // Un XMLHttpRequest minimal : `responseType`, `response`, `responseText`, `load`.
  class FauxXhr {
    open(m, u) { this.m = m; this.u = u; this.ecoutes = []; }
    setRequestHeader() {}
    addEventListener(t, f) { if (t === 'load') this.ecoutes.push(f); }
    getResponseHeader() { return 'application/json'; }
    send() {
      const r = routes[String(this.u)] || { status: 200, body: {} };
      this.status = r.status;
      const obj = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
      setTimeout(() => {
        Object.defineProperty(this, 'responseText', { get: () => { if (this.responseType && this.responseType !== 'text') throw new Error('InvalidStateError'); return JSON.stringify(obj); }, configurable: true });
        this.response = this.responseType === 'json' ? obj : JSON.stringify(obj);
        for (const f of this.ecoutes) f.call(this);
      }, 0);
    }
  }
  win.XMLHttpRequest = FauxXhr;
  const ctx = { window: win, XMLHttpRequest: FauxXhr, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null },
    location: { origin: ORIGINE, hostname: 'fr.vestiairecollective.com', pathname: '/members/profile/', href: ORIGINE + '/members/profile/' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent, btoa: (x) => Buffer.from(x, 'latin1').toString('base64'), Uint8Array, ArrayBuffer, String };
  vm.createContext(ctx); vm.runInContext(INJ, ctx, { filename: 'vc-inject.js' });
  const charge = async (url, corps, status = 200) => { routes[url] = { status, body: corps }; const n = posts.length; await win.fetch(url); await attendre(15); return posts.slice(n); };
  const xhr = async (url, corps, type) => { routes[url] = { status: 200, body: corps }; const n = posts.length; const x = new win.XMLHttpRequest(); x.open('GET', url); x.responseType = type; x.send(); await attendre(20); return posts.slice(n); };
  const ordre = (d) => new Promise((res) => { const n = posts.length; win.postMessage(Object.assign({ __tag: 'CANCALE_VC_ORDRE', kind: 'repondre' }, d)); setTimeout(() => res(posts.slice(n)), 30); });
  const route = async (url, r) => { routes[url] = r; const n = posts.length; await win.fetch(url); await attendre(15); return posts.slice(n); };
  return { charge, xhr, ordre, posts, appels, routes, route };
}
// Le VRAI relais vc.js : ce qu'il transmet au fond.
function relais() {
  const RELAIS = fs.readFileSync(F.relais, 'utf8');
  const envois = []; let ecoute = null;
  const win = { addEventListener: (t, f) => { if (t === 'message') ecoute = f; }, postMessage() {} };
  win.top = win;
  const ctx = { window: win, self: {}, chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { envois.push(copie(m)); if (cb) cb(); }, lastError: null, onMessage: { addListener() {} } } }, location: { href: ORIGINE + '/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set };
  vm.createContext(ctx); vm.runInContext(RELAIS, ctx, { filename: 'vc.js' });
  return (d) => { const n = envois.length; if (ecoute) ecoute({ source: win, data: d }); return envois.slice(n); };
}
const senderVc = (tab) => ({ tab: { id: tab, url: ORIGINE + '/members/profile/' }, frameId: 0, url: ORIGINE + '/members/profile/' });
// La base qui refuse un « surrogate » seul, comme jsonb (Postgres).
function fondStrict(opts) {
  const f = faireFond(opts);
  const vrai = f.ctx.fetch; f.refus = 0;
  f.ctx.fetch = async (u, o) => {
    if (/\/rest\/v1\//.test(String(u)) && o && o.method === 'POST') { let rows = null; try { rows = JSON.parse(o.body || '[]'); } catch (_) {} if (rows && malForme(rows)) { f.refus++; return { ok: false, status: 400, json: async () => ({ code: '22P02', message: 'invalid input syntax for type json' }), text: async () => '{"code":"22P02"}', headers: { get: () => 'application/json' } }; } }
    return vrai(u, o);
  };
  return f;
}

async function c1() {
  const p = pageVc();
  const erreur = await p.charge(`${API}/users/me/product-listings?offset=0&limit=50`, { errors: [{ status: '401', title: 'Unauthorized' }] }, 401);
  dit(!erreur.some((x) => x.kind === 'vcannonces'), 'C1 · une réponse 401 de Vestiaire n’est pas une liste d’annonces (rien ne part)', JSON.stringify(erreur.map((x) => x.kind)));
  const inc = await p.charge(`${API}/users/me/product-listings?offset=0&limit=48`, { results: { products: [{ uuid: 'abc', label: 'Paire' }] }, paging: { total: 1 } });
  const a = inc.find((x) => x.kind === 'vcannonces');
  dit(a && Array.isArray(a.inconnu) && a.inconnu.length > 0 && a.total == null, 'C1 · une réponse au format INCONNU part comme « format inconnu » avec sa forme, pas comme une liste vide', JSON.stringify(a));
  const vide = await p.charge(`${API}/users/me/product-listings?offset=0&limit=49`, { meta: { count: 0, offset: 0 }, data: [] });
  const v = vide.find((x) => x.kind === 'vcannonces');
  dit(v && !v.inconnu && v.total === 0, 'C1 · une liste VIDE de la forme connue reste une liste vide (total 0)', JSON.stringify(v));
  const xj = await p.xhr(`${API}/users/me/product-listings?offset=0&limit=47`, { meta: { count: 1, offset: 0 }, data: [{ id: 'P70', name: 'Samba', status: 'on_sale' }] }, 'json');
  const x = xj.find((y) => y.kind === 'vcannonces');
  dit(x && x.items && x.items.length === 1 && x.items[0].id === 'P70', 'C1 · une requête XHR en `responseType = json` est lue', JSON.stringify(xj.map((y) => y.kind)));
  // Le fond : un « format inconnu » ne date rien et ne vide rien.
  const f = faireFond({ src: F.src, lignes: { vc_listings: { items: { A1: { titre: 'Connue', vuAt: '2026-10-30T10:00:00Z' } }, liens: {}, capturedAt: '2026-10-30T10:00:00Z', complet: true, total: 1 } } });
  const r = relais();
  const msgs = r(a || { __tag: 'CANCALE_VC', kind: 'vcannonces', items: [], offset: 0, total: null, lus: 0, forme: [], inconnu: ['results.products[].uuid:string'] });
  const m = msgs.find((y) => y.action === 'vcAnnonces');
  await f.envoyer(m, senderVc(5));
  const l = f.lignes.vc_listings;
  dit(l.capturedAt === '2026-10-30T10:00:00Z' && l.complet === true && l.total === 1 && l.items.A1, 'C1 · le fond : un format inconnu ne pose ni fraîcheur, ni total, ni liste vidée', JSON.stringify({ at: l.capturedAt, complet: l.complet, total: l.total, n: Object.keys(l.items).length }));
  dit(Array.isArray(l.formeInconnue) && l.formeInconnue.length > 0, 'C1 · … et la forme inconnue est gardée pour viser juste', JSON.stringify(l.formeInconnue));
  const cap = (f.store.vrmVcCapte || {}).annonces;
  dit(cap && cap.inconnu === true && cap.n === 0, 'C1 · la carte de l’extension saura dire « forme pas encore lue » (pas « lues »)', JSON.stringify(cap));
}

async function c2() {
  // L'onglet 21 a lu /users/me du compte A ; il passe sur le compte B (la page
  // neuve rend « Mes articles » AVANT son /users/me).
  const f = faireFond({ src: F.src, lignes: { vc_listings: { items: { A1: { titre: 'Annonce de A', compte: 'compteA', vuAt: '2026-10-31T10:00:00Z' }, A2: { titre: 'Autre de A', compte: 'compteA', vuAt: '2026-10-31T10:00:00Z' } }, liens: {} } } });
  await f.ctx.noterSessionVc('compteA', 21, []);
  const liste = { from: 'cancale-vc', action: 'vcAnnonces', items: [{ id: 'B1', titre: 'Annonce de B', statut: 'on_sale' }], offset: 0, total: 1, lus: 1, forme: [] };
  await f.envoyer(Object.assign({}, liste, { moi: '' }), senderVc(21));
  const it = f.lignes.vc_listings.items;
  dit(it.A1 && it.A2, 'C2 · la liste ENTIÈRE du compte B, rendue avant son /users/me, n’efface pas les annonces du compte A', Object.keys(it).join(','));
  dit(it.B1 && it.B1.compte !== 'compteA', 'C2 · … et n’est pas rangée sous le compte A (pas su ⇒ aucun compte)', JSON.stringify(it.B1));
  // La page dit B, l'onglet dit encore A (le /users/me de B pas encore rangé) ⇒ pas su.
  await f.envoyer(Object.assign({}, liste, { items: [{ id: 'B2', titre: 'B deux' }], moi: 'compteB' }), senderVc(21));
  dit(f.lignes.vc_listings.items.B2 && f.lignes.vc_listings.items.B2.compte === '' && f.lignes.vc_listings.items.A1, 'C2 · page et onglet en désaccord : aucun compte posé, rien effacé', JSON.stringify(f.lignes.vc_listings.items.B2));
  // Puis /users/me de B : la page et l'onglet disent B ⇒ la ligne porte B.
  await f.ctx.noterSessionVc('compteB', 21, []);
  await f.envoyer(Object.assign({}, liste, { items: [{ id: 'B3', titre: 'B trois' }], moi: 'compteB' }), senderVc(21));
  dit(f.lignes.vc_listings.items.B3 && f.lignes.vc_listings.items.B3.compte === 'compteB' && f.lignes.vc_listings.items.A1, 'C2 · page et onglet d’accord : la ligne porte le compte, les annonces de A restent', JSON.stringify(f.lignes.vc_listings.items.B3));
  // Ventes « à expédier » : compte pas su ⇒ une vente rangée sous un compte reste à expédier.
  const g = faireFond({ src: F.src, lignes: { vc_ventes: { ventes: { VA: { productId: 'A1', aExpedier: true, compte: 'compteA', sources: ['a-expedier'] } }, lectures: {} } } });
  await g.envoyer({ from: 'cancale-vc', action: 'vcVentes', source: 'a-expedier', ventes: [{ id: 'VB', productId: 'B1', etat: 'to_ship' }], offset: 0, total: 1, lus: 1, forme: [], moi: '' }, senderVc(23));
  dit(g.lignes.vc_ventes.ventes.VA.aExpedier === true, 'C2 · « à expédier » lue sans compte su ne retire pas « à expédier » à la vente du compte A (un colis caché est un colis perdu)', JSON.stringify(g.lignes.vc_ventes.ventes.VA));
}

async function c3() {
  const p = pageVc();
  const u0 = `${API}/users/me/product-listings?offset=0&limit=2`, u2 = `${API}/users/me/product-listings?offset=2&limit=2`;
  const a = (await p.charge(u0, { meta: { count: 3, offset: 0 }, data: [{ id: 'P1', name: 'Un' }, { id: 'P2', name: 'Deux' }] })).find((x) => x.kind === 'vcannonces');
  const b = (await p.charge(u2, { meta: { count: 3, offset: 2 }, data: [{ id: 'P3', name: 'Trois' }] })).find((x) => x.kind === 'vcannonces');
  dit(a && !a.complet && b && Array.isArray(b.complet) && b.complet.length === 3, 'C3 · deux pages lues jusqu’au total ⇒ la liste est ENTIÈRE (ses 3 identifiants partent)', JSON.stringify({ a: a && a.complet, b: b && b.complet }));
  // Un total qui change entre deux pages ne décide rien.
  const q = pageVc();
  await q.charge(u0, { meta: { count: 3, offset: 0 }, data: [{ id: 'P1' }, { id: 'P2' }] });
  const c = (await q.charge(u2, { meta: { count: 2, offset: 2 }, data: [{ id: 'P3' }] })).find((x) => x.kind === 'vcannonces');
  dit(c && !c.complet, 'C3 · un total qui change entre deux pages (une annonce partie en route) ne fait rien foi', JSON.stringify(c && c.complet));
  // La liste bouge entre deux pages (P1 vendue, P3 et P4 publiées) : les identifiants
  // lus finissent par « faire le compte » du nouveau total sans être la liste.
  const s = pageVc();
  await s.charge(`${API}/users/me/product-listings?offset=0&limit=1`, { meta: { count: 2, offset: 0 }, data: [{ id: 'P1' }] });
  await s.charge(`${API}/users/me/product-listings?offset=1&limit=1`, { meta: { count: 3, offset: 1 }, data: [{ id: 'P3' }] });
  const e = (await s.charge(`${API}/users/me/product-listings?offset=2&limit=1`, { meta: { count: 3, offset: 2 }, data: [{ id: 'P2' }] })).find((x) => x.kind === 'vcannonces');
  dit(e && !e.complet, 'C3 · des pages lues sous deux totaux différents ne se cumulent pas (P4 manquerait, P1 vendue resterait)', JSON.stringify(e && e.complet));
  // Le fond : l'annonce supprimée sort, les pages lues restent.
  const f = faireFond({ src: F.src, lignes: { vc_listings: { items: { OLD: { titre: 'Supprimée sur Vestiaire', statut: 'on_sale', compte: 'compteA' } }, liens: {} } } });
  await f.ctx.noterSessionVc('compteA', 30, []);
  const r = relais();
  for (const d of [a, b]) { if (!d) continue; const m = r(Object.assign({}, d, { moi: 'compteA' })).find((y) => y.action === 'vcAnnonces'); await f.envoyer(m, senderVc(30)); }
  const it = f.lignes.vc_listings.items;
  dit(!it.OLD && it.P1 && it.P2 && it.P3 && f.lignes.vc_listings.complet === true, 'C3 · le fond : la liste lue en entier sur deux pages retire l’annonce supprimée et garde les trois', JSON.stringify({ ids: Object.keys(it), complet: f.lignes.vc_listings.complet }));
}

async function c4() {
  const p = pageVc();
  const d = (await p.charge(`${API}/users/me/product-listings?offset=0&limit=10`, { meta: { count: 2, offset: 0 }, data: [
    { id: 'P5', brand: { name: 'Nike', logo: 'https://images.vestiairecollective.com/brands/nike.png' }, seller: { picture: 'https://images.vestiairecollective.com/avatar/u77.jpg', firstname: 'NePasLire' }, name: 'Dunk Low Panda', status: 'on_sale', pictures: [{ path: 'https://images.vestiairecollective.com/produit/P5-1.jpg' }], price: { cents: 12000, currency: 'EUR' } },
    { id: 'P6', seller: { name: 'NePasLire' }, product: { name: 'Air Force 1' } },
  ] })).find((x) => x.kind === 'vcannonces');
  const x = d && d.items && d.items[0];
  const x6 = d && d.items && d.items[1];
  dit(x && x.titre === 'Dunk Low Panda', 'C4 · le titre est celui de l’annonce, pas le nom de la marque lu plus bas', JSON.stringify(x && x.titre));
  dit(x6 && x6.titre === 'Air Force 1', 'C4 · sans titre au premier niveau, le titre n’est jamais le nom du vendeur', JSON.stringify(x6 && x6.titre));
  dit(x && /produit\/P5-1\.jpg$/.test(x.photo || ''), 'C4 · la photo est celle de l’annonce, pas l’avatar du vendeur ni le logo de la marque', JSON.stringify(x && x.photo));
  dit(d && !JSON.stringify(d).includes('NePasLire'), 'C4 · rien du vendeur ne part');
}

async function c5() {
  const p = pageVc();
  const long = 'a'.repeat(159) + '😀 et la suite du message';
  const l = (await p.charge(`${API}/conversations`, { meta: { count: 1, offset: 0 }, data: [{ id: 'C900', lastMessage: { body: long }, unread: true }] })).find((x) => x.kind === 'vcmessages');
  dit(l && l.conversations && l.conversations[0] && !malForme(l.conversations[0].apercu) && l.conversations[0].apercu.length >= 159, 'C5 · l’aperçu coupé à 160 ne coupe pas l’émoji en deux', JSON.stringify(l && l.conversations && l.conversations[0] && l.conversations[0].apercu.slice(-3)));
  const t = (await p.charge(`${API}/users/me/product-listings?offset=0&limit=5`, { meta: { count: 1, offset: 0 }, data: [{ id: 'P6', name: 'b'.repeat(119) + '👟 édition limitée' }] })).find((x) => x.kind === 'vcannonces');
  dit(t && t.items[0] && !malForme(t.items[0].titre), 'C5 · le titre coupé à 120 ne coupe pas l’émoji en deux', JSON.stringify(t && t.items[0] && t.items[0].titre.slice(-3)));
  // Le fond : un fil dont le dernier message a un émoji à la 160ᵉ place.
  const f = fondStrict({ src: F.src, lignes: {} });
  await f.ctx.noterSessionVc('compteA', 40, []);
  await f.envoyer({ from: 'cancale-vc', action: 'vcFil', conv: 'C901', messages: [{ id: 'M1', t: long, deMoi: false, at: '2026-11-01T08:00:00.000Z' }], lus: 1, moi: 'compteA' }, senderVc(40));
  const fil = f.lignes.vc_fil_C901;
  dit(fil && fil.n === 1 && !malForme(fil) && f.refus === 0, 'C5 · le fond : le fil est RANGÉ (la base ne refuse pas la ligne pour une moitié d’émoji)', JSON.stringify({ rangé: !!fil, refus: f.refus }));
}

async function c6() {
  const f = faireFond({ src: F.src, lignes: {} });
  await f.ctx.noterSessionVc('compteA', 50, []);
  await f.ctx.noterSessionVc('compteB', 51, []);
  await f.envoyer({ from: 'cancale-vc', action: 'vcCompteur', messages: 3, moi: 'compteA' }, senderVc(50));
  await f.envoyer({ from: 'cancale-vc', action: 'vcCompteur', messages: 1, moi: 'compteB' }, senderVc(51));
  const m = f.lignes.vc_messages || {};
  dit(m.compteurs && m.compteurs.compteA && m.compteurs.compteA.messages === 3 && m.compteurs.compteB && m.compteurs.compteB.messages === 1, 'C6 · les non-lus sont rangés PAR COMPTE (3 sur A, 1 sur B) — plus seulement ceux du dernier onglet', JSON.stringify({ compteur: m.compteur, compteurs: m.compteurs }));
  const vc = f.store.vrmVcCapte || {};
  dit(vc.nonlus && vc.nonlus.n === 1 && !vc.messages, 'C6 · la carte compte les non-lus À PART des conversations (plus « Messages : lues » pour un simple compteur)', JSON.stringify(vc));
  const app = fonctionsApp();
  const nl = app && app.nonLusVestiaire ? app.nonLusVestiaire(m.compteur, m.compteurs) : null;
  dit(nl && nl.n === 4 && nl.comptes === 2, 'C6 · l’app additionne les non-lus de chaque compte (4 sur 2 comptes)', JSON.stringify(nl));
}

async function c7() {
  const p = pageVc();
  await p.charge(`${API}/users/me`, { data: { id: 'compteB', type: 'user' } });
  const recette = { methode: 'POST', hote: 'apiv2.vestiairecollective.com', rejouable: true, modele: '/conversations/{conv}/messages', recherche: '', cleTexte: ['content'], fixes: [], entetes: [] };
  const n0 = p.appels.length;
  const r = await p.ordre({ jeton: 'jeton-banc-0001', conv: 'C777', texte: 'Bonjour', recette, compte: 'compteA' });
  const fin = r.find((x) => x.kind === 'vcenvoiresultat');
  dit(fin && fin.statut === 0 && fin.erreur === 'autre-compte' && p.appels.length === n0, 'C7 · la page est sur le compte B, le fond veut parler pour A : rien ne part, c’est dit', JSON.stringify({ fin, envois: p.appels.length - n0 }));
}

async function c8() {
  const f = faireFond({ src: F.src, lignes: { lbc_messages: { compteurs: {}, comptes: {} } } });
  await Promise.all([
    f.ctx.storeLbcMessages({ compteur: { userId: '8442bbbb-0000-4000-8000-0000000000bb', unread: 2 } }),
    f.ctx.storeLbcMessages({ comptes: [{ id: 'faf3ffff-0000-4000-8000-0000000000ff', name: 'Compte pro inventé', pro: true }] }),
  ]);
  const l = f.lignes.lbc_messages || {};
  dit(l.compteurs && l.compteurs['8442bbbb-0000-4000-8000-0000000000bb'] && l.compteurs['8442bbbb-0000-4000-8000-0000000000bb'].unread === 2 && l.comptes && l.comptes['faf3ffff-0000-4000-8000-0000000000ff'], 'C8 · Leboncoin : compteur et comptes liés arrivés ensemble sont TOUS LES DEUX rangés', JSON.stringify(l));
}

// Les VRAIES fonctions de l'écran Vestiaire, extraites de src/App.jsx.
let _app;
function fonctionsApp() {
  if (_app !== undefined) return _app;
  try {
    const src = fs.readFileSync(F.app, 'utf8');
    // (1er nov.) Les familles et la règle d'état vivent dans api/_lib/vestiaire-regle.js
    // (un propriétaire pour l'app et le serveur) : chargées ici avec l'écran.
    let i = src.indexOf('const VC_ANNONCE_ETATS'); if (i < 0) i = src.indexOf('// (1er nov.) Les familles (`VC_ANNONCE_ETATS`)');
    const j = src.indexOf('function PhotoVc(');
    if (i < 0 || j < i) { _app = null; return _app; }
    const ctx = { Date, Math, isFinite, Number, String, Object, Array };
    vm.createContext(ctx);
    let regle = '';
    try { regle = fs.readFileSync(path.join(__dirname, '..', 'api', '_lib', 'vestiaire-regle.js'), 'utf8').replace(/^import .*$/mg, '').replace(/^export /mg, '') + '\nconst cleNum = (v) => String(v == null ? "" : v).trim().toUpperCase();\nconst joursAvant = () => null;\n'; } catch (_) {}
    vm.runInContext((/const VC_ANNONCE_ETATS/.test(src.slice(i, j)) ? '' : regle) + src.slice(i, j) + '\n;this.etatAnnonceVc = etatAnnonceVc; this.nonLusVestiaire = typeof nonLusVestiaire === "function" ? nonLusVestiaire : null;', ctx);
    _app = ctx;
  } catch (e) { _app = null; }
  return _app;
}
// C10 (2 nov., 5.314) — LA FORME RÉELLE de « Mes articles » chez Julien (noms de
// clés relevés par la 5.299 dans `vc_listings.formeInconnue`, valeurs INVENTÉES) :
// chaque élément est une enveloppe `{ type, [type]: { product: {...} } }`, sans id
// au premier niveau. Sur la 5.313 toute la liste tombait en « forme inconnue ».
async function c10() {
  const p = pageVc();
  const env = (id, type, titre, sous, cents) => ({ type, [type]: { product: { id, headline: titre, subHeadline: sous, picturePath: `${id}-1_2.jpg`, price: { formatted: 'x', cents, currency: 'EUR' }, sellerEarnings: { formatted: 'x', cents: cents - 1500, currency: 'EUR' }, path: '/x.shtml', segment: 'x' }, listingDate: '2026-10-30T10:00:00Z', negotiationsSummary: { totalNegotiationsCount: 0, ongoingNegotiationsCount: 0, pendingSellerActionCount: 0 }, singleNegotiationId: null, hasPriceDropRecommendation: false } });
  const d = (await p.charge(`${API}/users/me/product-listings?offset=0&limit=20`, { meta: { limit: 20, offset: 0, count: 2 }, data: [env(60001, 'published', 'Nike', 'Baskets Dunk Low', 12000), env(60002, 'published', 'Adidas', 'Baskets Samba', 9000)] })).find((x) => x.kind === 'vcannonces');
  const it = (d && d.items) || [];
  dit(d && !d.inconnu && it.length === 2, 'C10 · la forme réelle (enveloppe « published ») est LUE : deux annonces, pas une forme inconnue', JSON.stringify(d && { n: it.length, inconnu: !!d.inconnu }));
  dit(it[0] && it[0].id === '60001' && it[1] && it[1].id === '60002', 'C10 · chaque annonce a l’identifiant de SON produit', JSON.stringify(it.map((x) => x.id)));
  dit(it[0] && it[0].titre === 'Nike Baskets Dunk Low' && it[0].prix && it[0].prix.valeur === 120 && it[0].statut === 'published', 'C10 · titre (headline + subHeadline), prix 120 €, état « published »', JSON.stringify(it[0] && { t: it[0].titre, p: it[0].prix, s: it[0].statut }));
  dit(d && d.complet && d.complet.length === 2, 'C10 · la liste lue en entier fait foi', JSON.stringify(d && d.complet));
  dit(it[0] && it[0].photo === 'https://images.vestiairecollective.com/produit/60001-1_2.jpg', 'C10 · (5.316) la photo : le nom de fichier de Vestiaire sur SON serveur d’images', JSON.stringify(it[0] && it[0].photo));
}
// C11 (2 nov., 5.315 → 6 nov., 5.323) — LA CAPTURE BRUTE EST COUPÉE (sa décision :
// « coupe la capture Vestiaire »). Une réponse de Vestiaire pleine de données
// d'acheteur, un PDF de bordereau : RIEN ne part de la page en entier (ni
// `vcbrut`, ni `vcpdf`), le relais ne relaie rien, et un vieux message
// `vcBrut`/`vcPdf` arrivé au fond n'écrit AUCUNE ligne. Les lecteurs par
// fonction (annonces, ventes…) continuent de lire leur liste blanche de champs.
async function c11() {
  const p = pageVc();
  const vente = { meta: { count: 1 }, data: [{ id: 'S1', product: { id: 70001, name: 'Paire' }, buyer: { firstname: 'Acheteur', email: 'acheteur@exemple.test' }, shipping: { label: { url: 'https://x/label.pdf' } }, access_token: 'SECRET-JETON', payout: { cents: 9000 } }] };
  const tout1 = await p.charge(`${API}/users/me/sales?offset=0&limit=20&token=abc`, vente);
  const octets = Buffer.from('%PDF-1.4\n bordereau de banc\n%%EOF');
  const tout4 = await p.route('https://etiquettes.exemple.test/label/S1.pdf', { status: 200, ctype: 'application/pdf', body: '', octets });
  const sorties = [...tout1, ...tout4];
  dit(!sorties.some((x) => x.kind === 'vcbrut' || x.kind === 'vcpdf'), 'C11 · (5.323) plus aucune réponse ENTIÈRE ni aucun PDF ne quitte la page', JSON.stringify(sorties.map((x) => x.kind)));
  dit(!JSON.stringify(sorties).includes('acheteur@exemple.test') && !JSON.stringify(sorties).includes('SECRET-JETON'), 'C11 · ni l’e-mail de l’acheteur, ni un jeton, dans quoi que ce soit qui sort', '');
  // Un VIEUX relais (ou une page) qui enverrait encore la capture : le fond n'écrit rien.
  const f = faireFond({ src: F.src, lignes: {} });
  await f.ctx.noterSessionVc('compteA', 30, []);
  const r = relais();
  const relaye = r({ __tag: 'CANCALE_VC', kind: 'vcbrut', url: 'fr.vestiairecollective.com/api/x', methode: 'GET', statut: 200, sorte: 'api', texte: JSON.stringify(vente), page: '/', moi: 'compteA' });
  dit(!relaye.some((y) => y.action === 'vcBrut' || y.action === 'vcPdf'), 'C11 · le relais ne relaie plus `vcbrut`', JSON.stringify(relaye.map((y) => y.action)));
  const n0 = Object.keys(f.lignes).length;
  await f.envoyer({ from: 'cancale-vc', action: 'vcBrut', url: 'fr.vestiairecollective.com/api/x', methode: 'GET', statut: 200, sorte: 'api', page: '/', texte: JSON.stringify(vente), moi: 'compteA' }, senderVc(30));
  await f.envoyer({ from: 'cancale-vc', action: 'vcPdf', url: 'x', statut: 200, page: '/', b64: octets.toString('base64'), moi: 'compteA' }, senderVc(30));
  const brut = Object.keys(f.lignes).filter((k) => /^vc_(brut|pdf)_/.test(k));
  dit(!brut.length && Object.keys(f.lignes).length === n0, 'C11 · un vieux message `vcBrut`/`vcPdf` au fond n’écrit AUCUNE ligne (`vc_brut_*`, `vc_pdf_*`)', JSON.stringify(brut));
}
// C12 (2 nov., 5.316) — TA VENTE VESTIAIRE COMPLÈTE, sur la forme RÉELLE relevée
// le 2 nov. (`ots/sales`, `contents/timeline/seller` ; valeurs inventées) : titre,
// photo, ce que Vestiaire verse (« 203,23 € »), transporteur, suivi, et le
// BORDEREAU PDF rapatrié de son adresse signée.
async function c12() {
  const p = pageVc();
  const vente = { data: { products: [{ action: { type: 'timeline', title: 'Expédiez maintenant', context: { url: '' }, message: 'x' }, ezlink: '70001.shtml', status: 'ACTION_NEEDED', imageUrl: '70001-1_2.jpg', sellerId: '1', soldDate: '2026-11-02 14:17:41', brandName: 'Gucci', productId: '70001', externalRef: '', productName: 'Cabas en cuir', sellerPrice: '209,52 €', currencyRate: '1.0000', productPrice: '209,52 €', sellerEarning: '1 203,23 €', isDirectShipping: true, orderConfirmationDate: '2026-11-02 14:17:40' }] }, meta: { count: 1, limit: 20, offset: 1 } };
  const v = (await p.charge(`${API}/ots/sales?status=ACTION_NEEDED&isoCountry=FR`, vente)).find((x) => x.kind === 'vcventes');
  const x = v && v.ventes && v.ventes[0];
  dit(x && x.id === '70001' && x.titre === 'Gucci Cabas en cuir' && x.photo === 'https://images.vestiairecollective.com/produit/70001-1_2.jpg', 'C12 · la vente : titre (marque + nom) et photo de Vestiaire', JSON.stringify(x && { id: x.id, t: x.titre, p: x.photo }));
  dit(x && x.montant && x.montant.valeur === 1203.23 && x.montant.devise === 'EUR' && x.montant.cle === 'sellerEarning', 'C12 · ce que Vestiaire te verse : « 1 203,23 € » lu au centime, sous sa clé', JSON.stringify(x && x.montant));
  const tl = { data: { steps: { sellerShipment: { status: 'pending', shipmentDetails: { labelUrl: null, labelType: 'printable_label', shipByDate: '9 novembre 2026', chosenCarrier: { carrierName: 'Chronopost' }, trackingNumber: 'XW000000001JF', shippingLabelUrl: 'https://vc-prod-tms-s3-01.s3.eu-west-1.amazonaws.com/shipment_documents/x/70001.pdf?X-Amz-Signature=abc' } }, sellerPayment: { status: 'upcoming' } }, header: { date: '24 novembre 2026' }, status: 'shipmentInProgress' } };
  const t = (await p.charge(`${API}/contents/timeline/seller?product=70001&version=3`, tl)).find((y) => y.kind === 'vctimeline');
  dit(t && t.transporteur === 'Chronopost' && t.suivi === 'XW000000001JF' && /amazonaws\.com\/shipment_documents\/x\/70001\.pdf/.test(t.bordereau) && t.paiementEstime === '24 novembre 2026', 'C12 · le suivi : Chronopost, n° de suivi, adresse du bordereau, paiement estimé', JSON.stringify(t && { tr: t.transporteur, s: t.suivi, p: t.paiementEstime }));
  const f = faireFond({ src: F.src, lignes: {} });
  const vrai = f.ctx.fetch;
  f.ctx.fetch = async (u, o) => (/amazonaws\.com/.test(String(u)) ? { ok: true, status: 200, arrayBuffer: async () => { const b = Buffer.from('%PDF-1.4\n bordereau Chronopost de banc ' + 'x'.repeat(200) + '\n%%EOF'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, headers: { get: () => 'application/pdf' } } : vrai(u, o));
  await f.ctx.noterSessionVc('compteA', 30, []);
  const r = relais();
  for (const d of [v, t]) { const msg = r(Object.assign({}, d, { moi: 'compteA' })).find((y) => y.action === 'vcVentes' || y.action === 'vcTimeline'); if (msg) await f.envoyer(msg, senderVc(30)); }
  const ve = f.lignes.vc_ventes && f.lignes.vc_ventes.ventes && f.lignes.vc_ventes.ventes['70001'];
  const lab = f.lignes.vc_label_70001;
  dit(ve && ve.titre === 'Gucci Cabas en cuir' && ve.photo && ve.transporteur === 'Chronopost' && ve.suivi === 'XW000000001JF' && ve.bordereau && ve.bordereau.id === 'vc_label_70001', 'C12 · le fond range la vente complète, reliée à son bordereau', JSON.stringify(ve && { t: ve.titre, tr: ve.transporteur, b: ve.bordereau }));
  dit(lab && Buffer.from(lab.b64, 'base64').slice(0, 5).toString() === '%PDF-' && lab.suivi === 'XW000000001JF', 'C12 · le bordereau PDF est rangé (vc_label_…)', String(!!lab));
}
async function c9() {
  const app = fonctionsApp();
  const lu = new Date().toISOString(), vieux = new Date(Date.now() - 3 * 86400e3).toISOString(), frais = new Date(Date.now() - 3600e3).toISOString();
  const e1 = app && app.etatAnnonceVc({ statut: 'on_sale', vuAt: vieux }, false, lu);
  const e2 = app && app.etatAnnonceVc({ statut: 'on_sale', vuAt: frais }, false, lu);
  const e3 = app && app.etatAnnonceVc({ statut: 'sold', vuAt: vieux }, false, lu);
  dit(e1 && e1.etat === 'a-confirmer', 'C9 · l’app : une annonce plus vue depuis 3 j sous une lecture fraîche est « à confirmer », pas « en ligne »', JSON.stringify(e1));
  dit(e2 && e2.etat === 'en-ligne' && e3 && e3.etat === 'vendue', 'C9 · … vue il y a 1 h reste « en ligne » ; « vendue » reste « vendue »', JSON.stringify({ e2, e3 }));
}

(async () => {
  for (const [nom, f] of [['C1', c1], ['C2', c2], ['C3', c3], ['C4', c4], ['C5', c5], ['C6', c6], ['C7', c7], ['C8', c8], ['C9', c9], ['C10', c10], ['C11', c11], ['C12', c12]]) {
    try { await f(); } catch (e) { dit(false, `${nom} : l’audit a tourné jusqu’au bout`, String((e && e.stack) || e).slice(0, 300)); }
  }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ capture Vestiaire et Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
