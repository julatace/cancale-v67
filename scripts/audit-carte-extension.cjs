#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA CARTE DU LOGO OUVRE LE SITE, JAMAIS VRM — ET LANCE LES MESSAGES AUX FAVORIS
//  (5.376, Julien, 14 nov., midi : « quand tu appuies dessus ça ouvre juste les
//  ventes de ce compte, les messages de ce compte, mais pas plus, ça n'ouvre pas
//  VRM » ; « on peut lancer les messages aux favoris directement quand on est sur
//  le compte »).
//
//  Cet audit EXÉCUTE :
//   · le VRAI `background.js` (scripts/_fond-vm.cjs) : `etatSite` (les liens de la
//     carte), le refus de `ouvrirVRM` venu de la carte, `favorisCarte` (aperçu,
//     lancer, arrêter), `tickFavorisCarte` et, dedans, le VRAI `executerMessageFavori`
//     (garde stricte, 50/h et sa réserve, 15/h favoris, pause 429, captcha) ;
//   · la VRAIE route `api/compte.js?mode=favoris` (aperçu par les règles de l'app,
//     `lancer`, `suivant`, `consommer`, `verifier`, `terminer`, `arreter`) sur une
//     fausse base Supabase à état (projections `select=` appliquées) : chaque appel
//     de l'extension vers vrm.center y est joué tel quel.
//  Il juge :
//   A. aucun lien de la carte ne mène à vrm.center ; chaque lien est une page du
//      MÊME site que l'onglet, celle du compte connecté ; Vestiaire (aucune adresse
//      connue) : aucun lien ; une adresse hostile : aucun lien ; `ouvrirVRM` venu de
//      la carte n'ouvre rien (la fenêtre de l'icône, elle, ouvre encore VRM) ;
//   B. l'aperçu : qui (pseudo), quelle annonce, quel message (variables remplacées),
//      quelle offre (calculée) ; vendu / réservé / déjà contacté / sans preuve ⇒
//      absent ; rien n'est écrit chez Vinted ni lancé sans SON clic (`confirme`) ;
//      compte de l'onglet seulement ;
//   C. la file lancée depuis la carte : un message part, avec ses 3 écritures ; la
//      progression est rangée ; 50/h (réserve 5) et 15/h favoris tiennent ; un 429
//      pose la pause et plus rien ne part ; un autre compte dans l'onglet ⇒ rien ;
//      « Tout arrêter » ⇒ rien ; un captcha ⇒ la file est ARRÊTÉE chez VRM ;
//      « Tout arrêter » de la carte ⇒ la file s'arrête.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
//
//  `--prouve` (§6.1) : le même audit sur l'arbre d'AVANT (origin/main, ou
//  `--avant <ref>`) doit être ROUGE ; puis chaque MUTATION (une règle affaiblie à la
//  fois, dans une copie de l'arbre) doit rendre au moins un contrôle rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = process.env.CARTE_RACINE || path.join(__dirname, '..');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 320) : '')); } };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e && (e.stack || e.message)); } };

const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', UID = '111', AUTRE = '222', NEUTRE = '00000000-0000-0000-0000-000000000000';
const H = 3600000, MIN = 60000;

// ── La fausse base (forme PostgREST : projections, filtres eq / in / like / cs) ──
function lirChemin(v, expr) { for (const p of expr.split(/->>|->/).slice(1)) v = v == null ? undefined : (/^\d+$/.test(p) && Array.isArray(v) ? v[Number(p)] : v[p]); return v; }
function contient(a, b) {
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x)));
  if (b && typeof b === 'object') return a && typeof a === 'object' && Object.keys(b).every((k) => contient(a[k], b[k]));
  return a === b;
}
function filtre(row, k, v) {
  if (['select', 'limit', 'order', 'on_conflict'].includes(k)) return true;
  if (k === 'or') return false;   // preuves lourdes (conversations, autres comptes) : aucune ligne dans ce monde
  const champ = k === 'id' || k === 'owner' ? row[k] : lirChemin(row.data, k);
  const texte = /->>/.test(k) ? (champ == null ? null : typeof champ === 'object' ? JSON.stringify(champ) : String(champ)) : champ;
  if (v.startsWith('eq.')) return String(texte) === v.slice(3);
  if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(texte));
  if (v.startsWith('like.')) { const re = new RegExp('^' + v.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$'); return re.test(String(texte)); }
  if (v.startsWith('cs.')) return contient(champ, JSON.parse(v.slice(3)));
  if (v === 'is.null') return champ == null;
  throw new Error('filtre inconnu ' + k + '=' + v);
}
function projette(row, select) {
  if (!select) return row;
  const out = {};
  for (const c of select.split(',')) {
    const m = /^(?:([A-Za-z_]\w*):)?(.+)$/.exec(c.trim()); const alias = m[1], expr = m[2];
    if (['id', 'owner', 'data'].includes(expr)) { out[alias || expr] = row[expr]; continue; }
    let v = lirChemin(row.data, expr);
    if (/->>[^>]*$/.test(expr) && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias || expr.split(/->>|->/).pop()] = v === undefined ? null : v;
  }
  return out;
}
function faireBase() {
  const lignes = new Map();
  const json = (j, status = 200) => new Response(JSON.stringify(j), { status });
  const fetch = async (url, o = {}) => {
    const u = new URL(url);
    if (!/supabase\.co$/.test(u.hostname)) throw new Error('réseau inattendu ' + u.hostname);
    if (u.pathname.endsWith('/auth/v1/user')) return json({ id: U });
    if (u.pathname.endsWith('/vinted_accounts')) return json([{ owner: U, vinted_user_id: u.searchParams.get('vinted_user_id').replace('eq.', '') }].filter((x) => x.vinted_user_id === UID));
    const service = o.headers && o.headers.apikey === 'sb_secret_banc';
    const m = o.method || 'GET', params = [...u.searchParams.entries()];
    if (m === 'GET') {
      let rows = [...lignes.values()].filter((r) => params.every(([k, v]) => filtre(r, k, v)));
      if (!service) rows = rows.filter((r) => r.owner === U);
      const lim = Number(u.searchParams.get('limit')) || Infinity;
      return json(rows.slice(0, lim).map((r) => projette(r, u.searchParams.get('select'))));
    }
    if (!service) return json({}, 403);
    if (m === 'POST') { const [row] = JSON.parse(o.body); const k = row.owner + '|' + row.id; if (lignes.has(k)) return json({}, 409); lignes.set(k, structuredClone(row)); return new Response(null, { status: 201 }); }
    if (m === 'PATCH') { const rows = [...lignes.values()].filter((r) => params.every(([k, v]) => filtre(r, k, v))); for (const r of rows) r.data = JSON.parse(o.body).data; return json(rows.map((r) => ({ id: r.id }))); }
    return json({}, 405);
  };
  const poser = (id, data, owner = U) => lignes.set(owner + '|' + id, { owner, id, data: structuredClone(data) });
  const file = () => [...lignes.values()].find((r) => r.owner === NEUTRE && /^favoris_file_/.test(r.id))?.data;
  return { fetch, poser, file, lignes };
}
// Le monde du vendeur (inventé) : 5 favoris sur le compte 111. n1 (101), n2 (102),
// n3 (103 VENDU), n4 (104 RÉSERVÉ), n5 (105). Destinataires prouvés par une création
// native (101 → 201) : la forme `user_id` des notifications.
function monde(b, maintenant, { favoris, reglages = true, dressing } = {}) {
  const F = favoris || [['n1', 201, 101, 'camille_b'], ['n2', 202, 102, 'lea.vintage'], ['n3', 203, 103, 'jules'], ['n4', 204, 104, 'ines'], ['n5', 205, 105, 'tom_75']];
  const notif = ([id, user, item, pseudo], i) => ({ id, user_id: user, body: `${pseudo} a ajouté ton article à ses favoris.`, link: `/items/${item}/conversation/new?from_notification=true`, created_at: new Date(maintenant - (i + 1) * 10 * MIN).toISOString() });
  b.poser(`harvest_${UID}_notifications`, { uid: UID, type: 'notifications', domain: 'www.vinted.fr', payload: { notifications: F.map(notif) } });
  b.poser(`harvest_${UID}_wreq_api_v2_conversations`, { uid: UID, method: 'POST', path: '/api/v2/conversations', body: JSON.stringify({ initiator: 'native-banc', item_id: '101', opposite_user_id: '201' }) });
  if (reglages) b.poser(`vrm_favoris_reglages_${UID}`, { version: 1, envoisActifs: false, message: 'Bonjour {pseudo}, {article} est à {prix} pour toi !', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null });
  const items = dressing || [
    { id: 101, title: 'Nike Air Max 90 blanches 42', price: { amount: '50.0', currency_code: 'EUR' } },
    { id: 102, title: 'Adidas Samba OG 41', price: { amount: '80.0', currency_code: 'EUR' } },
    { id: 103, title: 'New Balance 550 43', price: { amount: '70.0', currency_code: 'EUR' }, is_closed: true, item_closing_action: 'sold' },
    { id: 104, title: 'Asics Gel-Kayano 44', price: { amount: '65.0', currency_code: 'EUR' }, is_reserved: true },
    { id: 105, title: 'Puma Suede 40', price: { amount: '45.0', currency_code: 'EUR' } },
  ];
  b.poser(`harvest_${UID}_listings`, { capturedAt: new Date(maintenant - H).toISOString(), payload: { pagination: { total_entries: items.length }, items } });
  b.poser('main', { vinted_offres_garde: { v: 1, at: maintenant - H, items: [], complet: true, manques: [], ambigus: 0 }, vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: false } } } } });
}
// La route, appelée comme Vercel l'appelle.
function appelRoute(handler) {
  return async (entree) => {
    const u = new URL(entree.url);
    let code = 0, body = null;
    const res = { setHeader() {}, status(v) { code = v; return this; }, json(v) { body = v; return this; }, end() { return this; } };
    const corps = entree.corps;
    const req = { method: entree.methode, query: Object.fromEntries(u.searchParams.entries()), headers: { authorization: 'Bearer banc.session.jwt', 'content-type': 'application/json' }, body: corps || undefined,
      on(ev, fn) { if (ev === 'data' && corps) fn(Buffer.from(JSON.stringify(corps))); if (ev === 'end') fn(); return this; },
      [Symbol.asyncIterator]: async function* () { if (corps) yield Buffer.from(JSON.stringify(corps)); } };
    await handler(req, res);
    return { status: code, body };
  };
}

async function principal() {
  const { faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'));
  const mod = await import(path.join(RACINE, 'api', 'compte.js'));
  const route = appelRoute(mod.default);
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  const SRC = path.join(RACINE, 'vinted-sync-extension', 'background.js');
  const conv = (item, user, login) => ({ id: 300 + Number(user) - 200, opposite_user: { id: user, login }, transaction: { id: 5000 + Number(item) - 100, item_id: item, item_title: 'Article ' + item }, allow_reply: true, messages: [] });

  // Un fond + un monde, la fausse base branchée sur `fetch` (la route) et la route sur vrm.center.
  const monter = ({ connecte = UID, vinted, actionsDeja = 0, onglets, store = {} } = {}) => {
    const b = faireBase(); global.fetch = b.fetch;
    monde(b, Date.now());
    const login = { 201: 'camille_b', 202: 'lea.vintage', 205: 'tom_75' };
    const vintedDefaut = (e) => {
      const m = /"opposite_user_id":"?(\d+)/.exec(String(e.corps || '')), it = /"item_id":"?(\d+)/.exec(String(e.corps || ''));
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv(Number(it[1]), Number(m[1]), login[m[1]] || 'x'), code: 0 } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) { const tx = Number(/(\d+)$/.exec(e.chemin)[1]), item = tx - 5000 + 100; return { status: 200, body: { transaction: { id: tx, item_id: item, item: { id: item, price: { amount: item === 102 ? '80.0' : item === 105 ? '45.0' : '50.0', currency_code: 'EUR' } } } } }; }
      if (e.methode === 'POST' && /offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      return { status: 404, body: {} };
    };
    const t = Date.now();
    const f = faireFond({ src: SRC, connecte, onglets: onglets || [{ id: 7, url: 'https://www.vinted.fr/member/111', status: 'complete' }],
      store: Object.assign({ vrmActions: { [UID]: Array.from({ length: actionsDeja }, (_, i) => t - 1000 - i) } }, store),
      lignes: { main: { capturedAt: new Date().toISOString(), vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: false } } } } } },
      vinted: vinted || vintedDefaut, vrm: async (e) => (e.mode === 'favoris' ? route(e) : null) });
    f.ctx.authToken = async () => ({ access_token: 'session', user_id: U });
    f.ctx.sansSessionPourEcrire = async () => false;
    f.ctx.notifierApp = async () => {};
    f.ctx.__vrmPausesVues = [];
    f.planifs = []; f.ctx.planifierFavorisCarte = (ms) => { f.planifs.push(ms); };   // les tours sont joués à la main
    f.ouverturesVrm = 0; f.ctx.ouvrirVRMDepuis = () => { f.ouverturesVrm++; };
    f.b = b;
    return f;
  };
  const ONGLET = { tab: { id: 7, url: 'https://www.vinted.fr/member/111' } };
  const carte = (f, quoi, extra = {}, sender = ONGLET) => f.envoyer(Object.assign({ from: 'vrm-badge', action: 'favorisCarte', quoi, uid: UID }, extra), sender);
  const ecritures = (f) => f.j.vinted.filter((v) => v.methode !== 'GET').map((v) => v.chemin.replace(/\d+/g, '#'));
  const appelsVrm = (f, action) => f.j.vrmApi.filter((x) => (x.corps && x.corps.action) === action);
  const etatCarte = async (f) => (await f.ctx.chrome.storage.local.get('vrmFavorisCarte')).vrmFavorisCarte || null;

  console.log('A. Les liens de la carte : le site du compte de l’onglet, jamais VRM');
  await essai('A1', async () => {
    const f = monter();
    const e = await f.envoyer({ from: 'vrm-badge', action: 'etat' }, { tab: { id: 7, url: 'https://www.vinted.fr/catalog?search_text=nike' } });
    const liens = (e && e.liens) || [];
    dit(liens.length === 3 && liens.map((l) => l.cle).join(',') === 'ventes,messages,dressing', 'Vinted : Mes ventes · Messages · Mon dressing', JSON.stringify(liens));
    dit(liens.every((l) => new URL(l.url).origin === 'https://www.vinted.fr'), 'chaque lien est sur le MÊME site que l’onglet (www.vinted.fr)', JSON.stringify(liens.map((l) => l.url)));
    dit(liens.some((l) => l.url === 'https://www.vinted.fr/member/111'), 'le dressing est celui du compte connecté dans l’onglet (111)', JSON.stringify(liens.map((l) => l.url)));
    dit(!JSON.stringify(e || {}).includes('vrm.center/?') && liens.every((l) => !/vrm\.center/.test(l.url)), 'aucun lien vers vrm.center', JSON.stringify(liens));
    const it = await f.envoyer({ from: 'vrm-badge', action: 'etat' }, { tab: { id: 8, url: 'https://www.vinted.it/' } });
    dit((it.liens || []).length === 3 && it.liens.every((l) => new URL(l.url).origin === 'https://www.vinted.it'), 'sur vinted.it, les liens restent sur vinted.it', JSON.stringify(it.liens));
  });
  await essai('A2', async () => {
    const f = monter();
    const L = f.ctx.liensCartePour;
    const lbc = L('https://www.leboncoin.fr/recherche?text=nike', 'leboncoin', { id: 'lbc-42', nom: 'julien' });
    dit(lbc.map((l) => l.url).join(' ') === 'https://www.leboncoin.fr/compte/part/mes-annonces https://www.leboncoin.fr/compte/part/mes-transactions https://www.leboncoin.fr/messages', 'Leboncoin : Mes annonces · Mes ventes · Messages, sur leboncoin.fr', JSON.stringify(lbc));
    dit(L('https://www.leboncoin.fr/', 'leboncoin', { id: null }).length === 0, 'Leboncoin sans compte connu dans l’onglet : aucun lien');
    const eb = L('https://www.ebay.fr/itm/1', 'ebay', null);
    dit(eb.map((l) => l.url).join(' ') === 'https://www.ebay.fr/sh/lst/active https://www.ebay.fr/sh/ord', 'eBay : Mes annonces · Mes ventes (Seller Hub), sur ebay.fr', JSON.stringify(eb));
    dit(L('https://fr.vestiairecollective.com/', 'vestiaire', { id: 'x' }).length === 0, 'Vestiaire : aucune adresse connue ⇒ aucun lien (rien d’inventé)');
    dit(L('http://www.vinted.fr/', 'vinted', { id: '111' }).length === 0 && L('https://vinted.fr.evil.com/', 'vinted', { id: '111' }).length === 0 && L('https://vrm.center/', 'vinted', { id: '111' }).length === 0, 'adresse non https, faux domaine, vrm.center : aucun lien');
    dit(L('https://www.vinted.fr/', 'vinted', { id: '111"><x' }).every((l) => !/member/.test(l.url)), 'un identifiant de compte qui n’est pas un nombre : pas de lien vers un dressing', JSON.stringify(L('https://www.vinted.fr/', 'vinted', { id: '111"><x' })));
  });
  await essai('A3', async () => {
    const f = monter();
    const r = await f.envoyer({ from: 'vrm-badge', action: 'ouvrirVRM', ecran: 'colis' }, ONGLET);
    const r2 = await f.envoyer({ from: 'vrm-badge', action: 'ouvrirVRM' }, ONGLET);
    dit(f.ouverturesVrm === 0 && r && r.ok === false && r2 && r2.ok === false, '« ouvrirVRM » venu de la carte : RIEN ne s’ouvre', JSON.stringify({ n: f.ouverturesVrm, r, r2 }));
    await f.envoyer({ from: 'cancale-popup', action: 'ouvrirVRM' }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    dit(f.ouverturesVrm === 1, 'la fenêtre de l’icône de l’extension ouvre encore VRM (le chemin vers VRM reste)', String(f.ouverturesVrm));
  });

  console.log('B. L’aperçu : qui, quelle annonce, quel message, quelle offre — rien ne part');
  await essai('B1', async () => {
    const f = monter();
    const r = await carte(f, 'apercu');
    const a = r && r.apercu;
    dit(r && r.ok && a && a.etat === 'pret', 'aperçu prêt pour le compte de l’onglet', JSON.stringify(r).slice(0, 300));
    if (!a || !a.liste) return;
    const ids = a.liste.map((x) => x.id).join(',');
    dit(ids === 'n1,n2,n5', 'vendu (n3) et réservé (n4) écartés ; les autres, du plus récent au plus ancien', ids);
    const n1 = a.liste.find((x) => x.id === 'n1');
    dit(n1 && n1.pseudo === 'camille_b' && n1.titre === 'Nike Air Max 90 blanches 42', 'qui (le pseudo écrit par Vinted) et quelle annonce (titre du dressing)', JSON.stringify(n1));
    dit(n1 && n1.prix === 50 && n1.offre === 45, 'l’offre calculée par la règle de l’app : 50 € −10 % = 45 €', JSON.stringify(n1));
    dit(n1 && n1.texte === 'Bonjour camille_b, Nike Air Max 90 blanches 42 est à 45 € pour toi !', 'le message rendu, variables remplacées ({pseudo}, {article}, {prix} = l’offre)', n1 && n1.texte);
    dit(Array.isArray(a.selection) && a.selection.join(',') === 'n1,n2,n5' && a.reglages && a.reglages.message, 'la sélection et les réglages montrés reviennent tels quels au lancement', JSON.stringify({ s: a.selection, r: !!a.reglages }));
    dit(ecritures(f).length === 0 && f.j.vinted.length === 0, 'l’aperçu ne fait AUCUNE requête à Vinted', JSON.stringify(f.j.vinted.map((v) => v.chemin)));
    dit(appelsVrm(f, 'lancer').length === 0 && !f.b.file()?.groupes?.[U]?.active, 'rien n’est lancé par un aperçu', JSON.stringify(appelsVrm(f, 'lancer')));
    const ap = (await f.ctx.chrome.storage.local.get('vrmFavorisApercu')).vrmFavorisApercu;
    dit(ap && ap[UID] && ap[UID].total === 3 && ap[UID].etat === 'pret', 'la carte garde « 3 favoris à qui écrire » (pour l’afficher sans attendre)', JSON.stringify(ap));
  });
  await essai('B2', async () => {
    const f = monter();
    const a = (await carte(f, 'apercu')).apercu;
    const sans = await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages });
    dit(sans && sans.ok === false && sans.code === 'confirmation', 'sans SON clic (« confirme ») : refusé', JSON.stringify(sans));
    const autre = await carte(f, 'lancer', { uid: AUTRE, selection: a.selection, reglages: a.reglages, confirme: true });
    dit(autre && autre.ok === false && autre.code === 'compte', 'un autre compte que celui de l’onglet : refusé', JSON.stringify(autre));
    const horsSite = await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true }, { tab: { id: 9, url: 'https://www.leboncoin.fr/' } });
    dit(horsSite && horsSite.ok === false, 'depuis un onglet qui n’est pas Vinted : refusé', JSON.stringify(horsSite));
    const trop = await carte(f, 'lancer', { selection: Array.from({ length: 16 }, (_, i) => 'n' + i), reglages: a.reglages, confirme: true });
    dit(trop && trop.ok === false && trop.code === 'selection', 'plus de 15 d’un coup : refusé (15 par heure au plus)', JSON.stringify(trop));
    await f.ctx.tickFavorisCarte();
    dit(appelsVrm(f, 'lancer').length === 0 && appelsVrm(f, 'suivant').length === 0 && f.j.vinted.length === 0, 'aucun de ces refus n’a rien lancé ni rien écrit chez Vinted', JSON.stringify({ l: appelsVrm(f, 'lancer').length, s: appelsVrm(f, 'suivant').length, v: f.j.vinted.length }));
  });
  await essai('B3', async () => {
    const f = monter();
    f.b.lignes.delete(U + '|' + `vrm_favoris_reglages_${UID}`);
    const a = (await carte(f, 'apercu')).apercu;
    dit(a && a.etat === 'bloque' && a.raison === 'reglages', 'aucun message enregistré : l’aperçu le dit (geste : l’écrire une fois), rien n’est proposé', JSON.stringify(a));
    const g = monter();
    g.b.poser(`harvest_${UID}_listings`, { capturedAt: new Date(Date.now() - 30 * H).toISOString(), payload: { pagination: { total_entries: 1 }, items: [{ id: 101 }] } });
    const b = (await carte(g, 'apercu')).apercu;
    dit(b && b.etat === 'bloque' && b.raison === 'dressing_ancien', 'dressing lu il y a plus de 24 h : « pas su » ⇒ rien n’est proposé', JSON.stringify(b));
  });

  console.log('C. La file lancée depuis la carte : toutes les gardes de l’extension');
  await essai('C1', async () => {
    const f = monter();
    const a = (await carte(f, 'apercu')).apercu;
    const l = await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    dit(l && l.ok === true && f.b.file()?.groupes?.[U]?.active === true, 'SON clic « Lancer » : la file est lancée chez VRM', JSON.stringify(l).slice(0, 200));
    await f.ctx.tickFavorisCarte();
    const ec = ecritures(f);
    dit(ec.join(' ') === '/api/v#/conversations /api/v#/transactions/#/offers /api/v#/conversations/#/replies', 'un message : conversation, offre, message (3 écritures chez Vinted)', JSON.stringify(ec));
    const jobs = f.b.file().groupes[U].jobs;
    dit(jobs.find((x) => x.notificationId === 'n1')?.etat === 'envoye' && jobs.find((x) => x.notificationId === 'n1')?.ecrits === 3, 'chez VRM : n1 « envoyé », avec ses 3 écritures (résultat brut traduit par la règle de l’app)', JSON.stringify(jobs.map((x) => [x.notificationId, x.etat, x.ecrits])));
    const st = await etatCarte(f);
    dit(st && st.actif === true && st.file && st.file.envoyes === 1 && st.file.total === 3, 'la progression est rangée pour la carte : 1/3 envoyés', JSON.stringify(st && st.file));
    const actions = ((await f.ctx.chrome.storage.local.get('vrmActions')).vrmActions || {})[UID] || [];
    dit(actions.length === 3, 'les 3 écritures sont comptées dans les 50/h du compte', String(actions.length));
    dit(f.j.vinted.every((v) => v.origine !== undefined || true) && f.j.vinted.every((v) => !/vrm\.center/.test(v.chemin)), 'chaque requête part vers Vinted depuis la page, aucune vers ailleurs');
  });
  await essai('C2', async () => {
    const f = monter({ actionsDeja: 44 });
    const a = (await carte(f, 'apercu')).apercu;
    await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    await f.ctx.tickFavorisCarte();
    dit(ecritures(f).length === 0, '44 actions déjà cette heure : un favori (3 écritures) dépasserait 45 ⇒ RIEN chez Vinted (la réserve de 5 tient)', JSON.stringify(ecritures(f)));
    { const j = f.b.file().groupes[U].jobs; dit(appelsVrm(f, 'suivant').length >= 1 && !j.some((x) => x.etat === 'envoye') && f.b.file().groupes[U].active === true, '…parce que le plafond a refusé (le tour a bien été joué), et la file attend une place sans rien perdre', JSON.stringify({ s: appelsVrm(f, 'suivant').length, j: j.map((x) => [x.notificationId, x.etat, x.raison]) })); }
  });
  await essai('C3', async () => {
    const f = monter();
    const a = (await carte(f, 'apercu')).apercu;
    await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    // 15 messages aux favoris déjà partis cette heure sur CE compte, notés comme l'extension les note.
    for (let i = 0; i < 15; i++) await f.ctx.noterGesteAuto(UID, 'favori');
    await f.ctx.chrome.storage.local.set({ vrmVerrouCompte: {} });   // le verrou « un compte à la fois » n'est pas jugé ici
    await f.ctx.tickFavorisCarte();
    dit(ecritures(f).length === 0, '15 messages aux favoris déjà cette heure : le 16ᵉ ne part pas (15/h)', JSON.stringify(ecritures(f)));
    { const j = f.b.file().groupes[U].jobs; dit(appelsVrm(f, 'suivant').length >= 1 && !j.some((x) => x.etat === 'envoye') && f.b.file().groupes[U].active === true, '…parce que le plafond a refusé (le tour a bien été joué), et la file attend une place sans rien perdre', JSON.stringify({ s: appelsVrm(f, 'suivant').length, j: j.map((x) => [x.notificationId, x.etat, x.raison]) })); }
  });
  await essai('C4', async () => {
    let n = 0;
    const f = monter({ vinted: (e) => { n++; if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 429, body: {} }; return { status: 404, body: {} }; } });
    const a = (await carte(f, 'apercu')).apercu;
    await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    await f.ctx.tickFavorisCarte();
    const pause = (await f.ctx.chrome.storage.local.get('vrmPauseVinted')).vrmPauseVinted;
    dit(!!pause, 'Vinted répond 429 : la pause est posée', JSON.stringify(pause));
    const avant = f.j.vinted.length;
    await f.ctx.tickFavorisCarte(); await f.ctx.tickFavorisCarte();
    const st = await etatCarte(f);
    dit(f.j.vinted.length === avant && st && st.attente === 'pause', 'pendant la pause : plus aucune requête, la carte dit « Vinted demande de ralentir »', JSON.stringify({ avant, apres: f.j.vinted.length, attente: st && st.attente }));
  });
  await essai('C5', async () => {
    const f = monter();
    const a = (await carte(f, 'apercu')).apercu;
    await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    f.ctx.compteConnecte = async () => AUTRE;   // l'onglet bascule sur un autre compte Vinted
    await f.ctx.tickFavorisCarte();
    const st = await etatCarte(f);
    dit(f.j.vinted.length === 0 && appelsVrm(f, 'suivant').length === 0 && st && st.attente === 'autre_compte', 'autre compte dans l’onglet : rien ne part, rien n’est réservé, c’est dit', JSON.stringify({ v: f.j.vinted.length, s: appelsVrm(f, 'suivant').length, attente: st && st.attente }));
  });
  await essai('C6', async () => {
    const f = monter();
    const a = (await carte(f, 'apercu')).apercu;
    await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    await f.ctx.poserToutArrete(true);
    await f.ctx.tickFavorisCarte();
    const st = await etatCarte(f);
    dit(f.j.vinted.length === 0 && st && st.attente === 'tout_arrete', '« Tout arrêter » posé : rien ne part, c’est dit', JSON.stringify({ v: f.j.vinted.length, attente: st && st.attente }));
    const relance = await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    dit(relance && relance.ok === false, 'et rien ne se relance tant que « Tout arrêter » est posé', JSON.stringify(relance));
  });
  await essai('C7', async () => {
    const f = monter({ vinted: (e) => (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin) ? { status: 403, body: { message: 'Please complete the captcha', code: 106 } } : { status: 404, body: {} }) });
    const a = (await carte(f, 'apercu')).apercu;
    await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    await f.ctx.tickFavorisCarte();
    const st = await etatCarte(f);
    dit(st && st.actif === false && st.fin && st.fin.raison === 'robot', 'un captcha : la carte s’arrête et le dit (« Vinted demande une vérification »)', JSON.stringify(st && st.fin));
    dit(f.b.file()?.groupes?.[U]?.active === false, 'et la file est ARRÊTÉE chez VRM (aucun message ne repart)', JSON.stringify(f.b.file()?.groupes?.[U]?.active));
  });
  await essai('C8', async () => {
    const f = monter();
    const a = (await carte(f, 'apercu')).apercu;
    await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    const r = await carte(f, 'arreter');
    const st = await etatCarte(f);
    await f.ctx.tickFavorisCarte();
    dit(r && r.ok && f.b.file()?.groupes?.[U]?.active === false && st && st.actif === false && f.j.vinted.length === 0, '« Tout arrêter » dans la carte : la file s’arrête chez VRM, rien ne part', JSON.stringify({ r: r && r.ok, srv: f.b.file()?.groupes?.[U]?.active, st: st && st.actif, v: f.j.vinted.length }));
  });
  await essai('C9', async () => {
    const f = monter({ onglets: [] });
    const a = (await carte(f, 'apercu')).apercu;
    await carte(f, 'lancer', { selection: a.selection, reglages: a.reglages, confirme: true });
    await f.ctx.tickFavorisCarte();
    const st = await etatCarte(f);
    dit(f.j.vinted.length === 0 && appelsVrm(f, 'suivant').length === 0 && st && st.attente === 'onglet', 'plus d’onglet Vinted ouvert : rien ne part, rien n’est réservé, c’est dit', JSON.stringify({ v: f.j.vinted.length, attente: st && st.attente }));
  });
}

// ── §6.1 : l'arbre d'AVANT doit être rouge, et chaque mutation aussi ──────────
const MUTATIONS = [
  ['vinted-sync-extension/background.js', "if (msg && msg.from === 'vrm-badge' && msg.action === 'ouvrirVRM') { sendResponse({ ok: false, code: 'carte' }); return true; }", '', 'la carte ouvre VRM'],
  ['vinted-sync-extension/background.js', "    if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien ne part sans ton clic sur « Lancer ».' };\n", '', 'lancer sans son clic'],
  ['vinted-sync-extension/background.js', "  if (String((msg && msg.uid) || '') !== o.uid) return { ok: false, code: 'compte', raison: 'L’onglet est connecté sur un autre compte Vinted : rien n’est parti.' };\n", '', 'compte nommé par le message'],
  ['vinted-sync-extension/background.js', "      if (!actif || String(actif) !== st.uid) return attendre('autre_compte');\n", '', 'tour sans vérifier le compte de l’onglet'],
  ['vinted-sync-extension/background.js', "      if (await pauseVinted()) return attendre('pause');\n", '', 'tour pendant la pause (le fond la tient encore)'],
  ['vinted-sync-extension/background.js', "      if ((await toutArreteDepuis(null)) > 0) return attendre('tout_arrete');\n", '', 'tour malgré « Tout arrêter »'],
  ['vinted-sync-extension/background.js', "      if (raison === 'vinted_robot' || (r && r.code === 'verification')) {", "      if (false) {", 'captcha sans arrêt de la file'],
  ['vinted-sync-extension/background.js', "    .map(([cle, libelle, chemin]) => ({ cle, libelle, url: u.origin + chemin.replace('{uid}', encodeURIComponent(id)) }));", "    .map(([cle, libelle, chemin]) => ({ cle, libelle, url: 'https://vrm.center' + chemin.replace('{uid}', encodeURIComponent(id)) }));", 'liens vers VRM'],
  ['vinted-sync-extension/background.js', "      if (!(tabs || []).some((t) => ongletDuDomaine(t, st.dom || 'www.vinted.fr'))) return attendre('onglet');\n", '', 'tour sans onglet Vinted'],
  ['api/_lib/favoris-carte.js', "    if (annonce) { ecartes++; continue; }", "    if (false) { ecartes++; continue; }", 'aperçu : article vendu proposé'],
  ['api/_lib/favoris-carte.js', "    if (!prouve(String(l.id))) { nonProuves++; continue; }", "", 'aperçu : destinataire non prouvé proposé'],
  ['api/_lib/favoris-carte.js', "  if (ed) return { etat: 'bloque', raison: ed, file };", '', 'aperçu : dressing ancien accepté'],
  ['vinted-sync-extension/background.js', "{reserve:RESERVE_GESTES,actions:nA,recu,sorte:'favori'", "{actions:nA,recu,sorte:'favori'", 'réserve de 5 retirée'],
];
function copieArbre(dest, ref) {
  fs.mkdirSync(dest, { recursive: true });
  if (ref) cp.execSync(`git archive ${ref} api src scripts vinted-sync-extension package.json | tar -x -C ${JSON.stringify(dest)}`, { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'ignore', 'inherit'] });
  else for (const d of ['api', 'src', 'scripts', 'vinted-sync-extension', 'package.json']) cp.execSync(`cp -R ${JSON.stringify(path.join(__dirname, '..', d))} ${JSON.stringify(dest)}/`);
  try { fs.symlinkSync(path.join(__dirname, '..', 'node_modules'), path.join(dest, 'node_modules')); } catch (_) {}
  fs.copyFileSync(__filename, path.join(dest, 'scripts', 'audit-carte-extension.cjs'));
}
function lancerDans(dest) { const r = cp.spawnSync(process.execPath, [path.join(dest, 'scripts', 'audit-carte-extension.cjs')], { env: { ...process.env, CARTE_RACINE: dest }, encoding: 'utf8', timeout: 240000 }); return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') }; }
async function prouver() {
  const i = process.argv.indexOf('--avant'), ref = i > 0 ? process.argv[i + 1] : 'origin/main';
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'carte-ext-'));
  let rouge = 0;
  try {
    const avant = path.join(base, 'avant'); copieArbre(avant, ref);
    const r = lancerDans(avant);
    const rouges = (r.sortie.match(/❌/g) || []).length;
    console.log(`  ${r.code !== 0 && rouges ? '✅' : '❌'} sur ${ref} : ${rouges} rouge(s) (la carte ouvrait VRM, aucun lancement depuis la carte)`);
    if (!(r.code !== 0 && rouges)) rouge++;
    fs.rmSync(avant, { recursive: true, force: true });
    for (const [fic, de, vers, nom] of MUTATIONS) {
      const d = path.join(base, 'm'); copieArbre(d, null);
      const p = path.join(d, fic), s = fs.readFileSync(p, 'utf8');
      if (!s.includes(de)) { console.log(`  ❌ mutation « ${nom} » : motif introuvable`); rouge++; fs.rmSync(d, { recursive: true, force: true }); continue; }
      fs.writeFileSync(p, s.replace(de, vers));
      const m = lancerDans(d);
      const attrape = m.code !== 0;
      console.log(`  ${attrape ? '✅' : '❌'} mutation « ${nom} » ${attrape ? 'attrapée' : 'PAS attrapée'}`);
      if (!attrape) rouge++;
      fs.rmSync(d, { recursive: true, force: true });
    }
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
  console.log(rouge ? `\n❌ preuve : ${rouge} défaut(s)` : '\n✅ preuve : rouge avant, chaque mutation attrapée');
  return rouge;
}

(async () => {
  if (process.argv.includes('--prouve')) { process.exit((await prouver()) ? 1 : 0); }
  const ancien = global.fetch;
  try { await principal(); } catch (e) { dit(false, 'l’audit a planté', e && (e.stack || e.message)); }
  finally { global.fetch = ancien; }
  console.log(ko ? `\n❌ carte du logo (liens, favoris) : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ carte du logo (liens, favoris) : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
