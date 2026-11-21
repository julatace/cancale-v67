// ════════════════════════════════════════════════════════════════════════════
//  SA DESCRIPTION, TELLE QU'IL L'ENREGISTRE SUR VINTED, EST GARDÉE (22 octobre)
//
//  MESURÉ chez Julien (lecture seule) : sur ses 49 annonces en ligne, 4 seulement
//  ont leur description dans `vinted_item_details` (la ligne que lisent les files
//  Leboncoin / eBay, l'app et le coffre), aucune n'a sa catégorie ni ses couleurs
//  (`fiche_codes_absents` = 804 : la page lue ne les livre jamais). Or quand il
//  MODIFIE une annonce, la page envoie `PUT /api/v2/item_upload/items/{id}` avec
//  `{ item: { id, description, catalog_id, brand_id, color_ids,
//  item_attributes… } }` — mesuré sur 6 modifications : l'`id` du corps est
//  toujours celui de l'adresse. L'extension voyait passer ce corps et le jetait.
//
//  On EXÉCUTE le vrai `inject.js` dans un faux monde de page (fetch ET XHR), puis
//  le vrai `background.js` (`_fond-vm.cjs`) :
//   1. la page ne transmet la fiche qu'après un 2xx de VINTED, avec l'identifiant
//      de l'ADRESSE (modification) ou de la RÉPONSE (publication) ;
//   2. le fond la range dans `vinted_item_details[id]` : la description et les
//      codes (catégorie, marque, couleurs, taille, état), rien d'autre ;
//   3. un texte rempli n'est JAMAIS remplacé par du vide ; un corps dont l'`id`
//      contredit l'adresse ne range RIEN (§5 : l'identité, jamais un titre) ;
//   4. base illisible : rien n'est écrit, la fiche attend dans
//      `chrome.storage.local`, et part quand la base revient ;
//   5. la file Leboncoin part avec SA description.
//  §6.1 : réaffaiblie (vide qui remplace, contradiction ignorée, statut ignoré),
//  chaque règle fait rougir son contrôle.
//  Données inventées. Usage : node scripts/audit-fiche-modif.cjs
//    [--src background.js] [--inject inject.js]   (la preuve sur le code d'avant)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
const iInj = process.argv.indexOf('--inject');
const INJECT = iInj > 0 ? path.resolve(process.argv[iInj + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'inject.js');
const TEXTE = fs.readFileSync(SRC, 'utf8'), TEXTE_INJ = fs.readFileSync(INJECT, 'utf8');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const ID = '10900000001', ID2 = '10900000002', NOUVEAU = '10900000077';
const TEXTE_A_LUI = 'Nike Air Max 90 portées trois fois, semelle impeccable. Envoi en boîte.';
// La FORME mesurée du corps envoyé par Vinted (valeurs inventées).
const corps = (id, o = {}) => JSON.stringify({ item: Object.assign({
  id: id == null ? null : Number(id), currency: 'EUR', temp_uuid: 'tmp-uuid-banc', title: 'Nike Air Max 90 taille 42', description: TEXTE_A_LUI,
  brand_id: 53, brand: 'Nike', catalog_id: 1242, isbn: null, is_unisex: false, measurement_length: null, measurement_width: null,
  package_size_id: 2, shipment_prices: { domestic: null, international: null }, color_ids: [12, 3],
  assigned_photos: [{ id: 555001, orientation: 0 }], price: 55, manufacturer: null, manufacturer_labelling: null, ai_photo: null,
  item_attributes: [{ code: 'size', ids: [789] }, { code: 'condition', ids: [2] }],
}, o), parcel: null, push_up: false, upload_session_id: 'session-banc' });

// ── 1. inject.js dans un faux monde de page ─────────────────────────────────
function page(repondre, src = INJECT) {
  const posts = [];
  class FauxXHR {
    constructor() { this.ecoutes = {}; this.status = 0; this.responseText = ''; }
    open(m, u) { this.m = m; this.u = u; }
    setRequestHeader() {}
    addEventListener(t, fn) { (this.ecoutes[t] = this.ecoutes[t] || []).push(fn); }
    getResponseHeader() { return 'application/json'; }
    send() { const r = repondre(String(this.u), this.m); setTimeout(() => { this.status = r.status; this.responseText = JSON.stringify(r.body || {}); for (const fn of this.ecoutes.load || []) fn.call(this); }, 1); }
  }
  const g = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, Headers: class {}, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/items/' + ID + '/edit' },
    document: { hidden: true, addEventListener() {} },          // onglet caché : la moisson de la page ne part pas
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener() {},
    postMessage(data) { posts.push(data); },
    XMLHttpRequest: FauxXHR,
    fetch: async (url, init) => {
      const r = repondre(String(url), (init && init.method) || 'GET');
      const t = JSON.stringify(r.body || {});
      return { ok: r.status < 400, status: r.status, headers: { get: () => 'application/json' }, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
    },
  };
  g.window = g; g.self = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(fs.readFileSync(src, 'utf8'), g, { filename: 'inject.js' });
  return { g, posts, fiches: () => posts.filter((m) => m && m.kind === 'fiche') };
}
const repondreVinted = (statut = 200) => (u, m) => {
  if (/item_upload\/items\/?$/.test(u) && /POST/i.test(m)) return { status: statut, body: { item: { id: Number(NOUVEAU), title: 'x' } } };
  if (/item_upload\/items\/\d+/.test(u)) return { status: statut, body: { item: { id: Number(ID) } } };
  return { status: 200, body: {} };
};
async function pageFetch(url, methode, body, statut = 200, src) {
  const p = page(repondreVinted(statut), src);
  await vm.runInContext(`window.fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(methode)}, body: ${JSON.stringify(body)} })`, p.g);
  await attendre(20);
  return p;
}

// ── 2. le fond ───────────────────────────────────────────────────────────────
function fond(src = SRC, { details = {}, lectureKO = () => false, store = {}, connecte = '111' } = {}) {
  return faireFond({ src, connecte, lectureKO, store, lignes: {
    panel_num_reserves: { attente: { 19: { at: new Date().toISOString(), uid: '111' } }, items: {} },
    vinted_item_details: details,
    main: { vinted_annonce_numeros: { [ID]: { numero: '18', mp: { lbc: true } } }, vinted_accounts_hidden: [], vinted_accounts: [{ vinted_user_id: '111' }] },
    vrm_blocked_accounts: { uids: [] },
    harvest_111_listings: { uid: '111', capturedAt: new Date().toISOString(), payload: { items: [
      { id: Number(ID), title: 'Nike Air Max 90 taille 42', brand: 'Nike', size: '42', status: 'Très bon état', price: { amount: '55.0', currency_code: 'EUR' }, nPhotos: 3, is_closed: false, is_hidden: false, is_draft: false } ] } },
  } });
}
const VUE = (id, statut, c) => ({ from: 'cancale-content', kind: 'fiche', itemId: id, status: statut, via: 'modif', corps: c, domain: 'www.vinted.fr' });
const PHOTOS = [0, 1, 2].map((i) => `https://images1.vinted.net/t/p${ID}_${i}/f800/${i}.jpg`);
const COPIES = [];
function muter(texte, motif, rempl, nom) {
  if (!texte.includes(motif)) return null;
  const p = path.join(os.tmpdir(), `fiche-mut-${process.pid}-${COPIES.length}-${nom}`);
  fs.writeFileSync(p, texte.split(motif).join(rempl)); COPIES.push(p); return p;
}

// Les scénarios rendent ce qu'ils mesurent.
async function scenarioRangement(src) {
  const f = fond(src, { details: { [ID]: { description: '', photos: PHOTOS, couleur: 'Blanc', pageAt: '2026-10-01T10:00:00Z' } } });
  // Tout passe par le VRAI routage des messages de la page (un code qui ne connaît pas
  // la fiche l'ignore : les contrôles rougissent, l'audit ne meurt pas).
  const vue = async (id, st, c) => { await f.envoyer(VUE(id, st, c), { url: 'https://www.vinted.fr/items/' + id + '/edit', tab: { id: 7 } }); await attendre(40); };
  await vue(ID, 200, corps(ID));
  const d1 = JSON.parse(JSON.stringify((f.lignes.vinted_item_details || {})[ID] || {}));
  // Il réenregistre l'annonce SANS description (champ vidé par erreur) et change de catégorie.
  await vue(ID, 200, corps(ID, { description: '   ', catalog_id: 1243, color_ids: [] }));
  const d2 = JSON.parse(JSON.stringify((f.lignes.vinted_item_details || {})[ID] || {}));
  // Un corps qui porte l'identifiant d'une AUTRE annonce que l'adresse.
  await vue(ID2, 200, corps(ID, { description: 'TEXTE D’UNE AUTRE ANNONCE' }));
  const d3 = (f.lignes.vinted_item_details || {})[ID2] || null;
  // Une modification REFUSÉE par Vinted.
  await vue(ID2, 403, corps(ID2, { description: 'refusée' }));
  const d4 = (f.lignes.vinted_item_details || {})[ID2] || null;
  // La file Leboncoin, construite par le vrai `buildLbcData`.
  let lbc = null; try { lbc = await f.ctx.buildLbcData(); } catch (_) {}
  const ad = lbc && (lbc.queue || []).find((a) => String(a.id) === ID);
  // L'annonce dont il a enregistré la fiche (photos complètes) n'est plus relue par la page pour ses codes.
  let pagesRelues = null;
  try { f.store.vrmLecturesDues = { 111: Object.fromEntries(['versement', 'releve', 'retrait', 'preuve', 'enligne'].map((k) => [k, { reste: 0, at: Date.now() }])) }; await f.ctx.capterPhotosAnnonces('111'); pagesRelues = f.j.vinted.filter((x) => /^\/items\//.test(x.chemin)).length; } catch (_) {}
  return { d1, d2, d3, d4, ad, pagesRelues, diags: f.j.diags };
}
async function scenarioBaseKO(src) {
  let ko2 = true;
  const f = fond(src, { lectureKO: (u) => ko2 && /vinted_item_details/.test(u) });
  await f.envoyer(VUE(ID, 200, corps(ID)), { url: 'https://www.vinted.fr/items/' + ID + '/edit', tab: { id: 7 } }); await attendre(40);
  const ecritAvant = f.j.posts.filter((ids) => ids.includes('vinted_item_details')).length;
  const attente = (f.store.vrmFichesAttente || []).length;
  ko2 = false;
  // Le rangement automatique attend 10 min après un échec (sinon la ligne entière
  // redescendrait chaque minute) : on avance l'horloge du service worker.
  f.ctx.__horloge = { t: Date.now() + 11 * 60e3 };
  vm.runInContext('Date.now = function () { return globalThis.__horloge.t; };', f.ctx);
  await f.ctx.tickPhotos();                                   // le tour d'alarme suivant
  const d = (f.lignes.vinted_item_details || {})[ID] || {};
  return { ecritAvant, attente, desc: d.description, attenteApres: (f.store.vrmFichesAttente || []).length };
}

// ── 23 oct. (revue) : le message « fiche » se FORGE (n'importe quel script de la page
//    peut le poster, sans aucune requête chez Vinted). Le fond juge l'ONGLET qui l'envoie.
const FORGE = 'Paye-moi hors plateforme : virement au 06 00 00 00 00, -20 %';
async function scenarioForge(src, { sender, via = 'modif', store = {}, connecte = '111', avant = null } = {}) {
  const f = fond(src, { details: { [ID]: { description: TEXTE_A_LUI, photos: PHOTOS, codes: { catalog_id: 1242 }, pageAt: new Date().toISOString() } }, store, connecte });
  if (avant) await avant(f);
  await f.envoyer({ from: 'cancale-content', kind: 'fiche', itemId: ID, status: 200, via, corps: JSON.stringify({ item: { description: FORGE } }), domain: 'www.vinted.fr' }, sender);
  await attendre(60);
  const d = (f.lignes.vinted_item_details || {})[ID] || {};
  let lbc = null; try { lbc = await f.ctx.buildLbcData(); } catch (_) {}
  const ad = lbc && (lbc.queue || []).find((a) => String(a.id) === ID);
  return { desc: d.description, file: ad ? ad.description : null, diags: f.j.diags.filter((x) => /fiche|compte/.test(x)) };
}
// Une vraie publication : la page a d'abord vu le 2xx de Vinted (`publication`), dans
// l'onglet qui portait la réservation de numéro, puis la fiche de CETTE annonce.
async function scenarioPublication(src, { reservation = true, ongletFiche = 7 } = {}) {
  const store = reservation ? { vrmNumResaOnglets: { 7: { numero: '19', at: Date.now(), uid: '111' } } } : {};
  const f = fond(src, { store });
  await f.envoyer({ from: 'cancale-content', kind: 'publication', itemId: NOUVEAU, status: 200, domain: 'www.vinted.fr' }, { url: 'https://www.vinted.fr/items/new', tab: { id: 7, url: 'https://www.vinted.fr/items/new' } });
  await f.envoyer({ from: 'cancale-content', kind: 'fiche', itemId: NOUVEAU, status: 200, via: 'publication', corps: corps(null), domain: 'www.vinted.fr' }, { url: 'https://www.vinted.fr/items/new', tab: { id: ongletFiche, url: 'https://www.vinted.fr/items/new' } });
  await attendre(80);
  return { d: (f.lignes.vinted_item_details || {})[NOUVEAU] || null, diags: f.j.diags.filter((x) => /fiche|publication/.test(x)) };
}

(async () => {
  console.log('── 1. la page transmet SA fiche, après un 2xx de Vinted, sous l’identifiant de l’adresse');
  await essaie('page', async () => {
    const a = await pageFetch('/api/v2/item_upload/items/' + ID, 'PUT', corps(ID));
    const fa = a.fiches();
    dit(fa.length === 1 && fa[0].itemId === ID && fa[0].status === 200 && /trois fois/.test(fa[0].corps || ''), 'modification acceptée (PUT 200) : la fiche part avec l’identifiant de l’ADRESSE', JSON.stringify(fa.map((m) => ({ id: m.itemId, st: m.status, via: m.via }))));
    const b = await pageFetch('/api/v2/item_upload/items/' + ID, 'PUT', corps(ID), 403);
    dit(b.fiches().length === 0, 'modification REFUSÉE par Vinted (403) : rien ne part', `${b.fiches().length}`);
    const c = await pageFetch('https://autre-site.example/api/v2/item_upload/items/' + ID, 'PUT', corps(ID));
    dit(c.fiches().length === 0, 'la même adresse sur un autre site : rien ne part', `${c.fiches().length}`);
    const d = await pageFetch('/api/v2/item_upload/items', 'POST', corps(null));
    const fd = d.fiches();
    dit(fd.length === 1 && fd[0].itemId === NOUVEAU && fd[0].via === 'publication', 'publication acceptée (POST 200) : la fiche part sous l’identifiant que Vinted vient de RENDRE', JSON.stringify(fd.map((m) => m.itemId)));
    const e = await pageFetch('/api/v2/item_upload/drafts/' + ID, 'PUT', corps(ID));
    dit(e.fiches().length === 0, 'un brouillon n’est pas une annonce : rien ne part', `${e.fiches().length}`);
    // XHR : la même règle.
    const x = page(repondreVinted(200));
    vm.runInContext(`(function(){ const r = new XMLHttpRequest(); r.open('PUT', '/api/v2/item_upload/items/${ID}'); r.send(${JSON.stringify(corps(ID))}); })()`, x.g);
    await attendre(30);
    dit(x.fiches().length === 1 && x.fiches()[0].itemId === ID, 'par XMLHttpRequest aussi', `${x.fiches().length}`);
  });

  console.log('── 2-3. le fond la range : description et codes, jamais du vide, jamais une autre annonce');
  await essaie('fond', async () => {
    const r = await scenarioRangement(SRC);
    dit(r.d1.description === TEXTE_A_LUI, 'sa description est rangée dans vinted_item_details[id]', JSON.stringify(r.d1.description));
    const c = r.d1.codes || {};
    dit(c.catalog_id === 1242 && c.brand_id === 53 && JSON.stringify(c.color_ids) === '[12,3]' && (c.item_attributes || []).some((a) => a.code === 'size' && a.ids[0] === 789) && (c.item_attributes || []).some((a) => a.code === 'condition'),
      'avec la catégorie, la marque, les couleurs, la taille et l’état (les codes Vinted)', JSON.stringify(c));
    dit((r.d1.photos || []).length === 3 && r.d1.couleur === 'Blanc' && r.d1.pageAt === '2026-10-01T10:00:00Z', 'ce qui était déjà là reste (photos, couleur affichée, date de lecture)', JSON.stringify({ n: (r.d1.photos || []).length, c: r.d1.couleur }));
    const brut = JSON.stringify(r.d1);
    dit(!/assigned_photos|shipment_prices|upload_session|session-banc|tmp-uuid|555001/.test(brut), 'rien d’autre du corps (ni photos envoyées, ni frais de port, ni session de dépôt)', brut.slice(0, 160));
    dit(r.d2.description === TEXTE_A_LUI, 'réenregistrée avec une description VIDE : sa description reste', JSON.stringify(r.d2.description));
    dit(r.d2.codes && r.d2.codes.catalog_id === 1243 && JSON.stringify(r.d2.codes.color_ids) === '[12,3]', 'une catégorie changée est prise, des couleurs vides ne remplacent rien', JSON.stringify(r.d2.codes));
    dit(r.d3 === null && r.diags.includes('fiche_modif_id_contredit'), 'un corps dont l’identifiant contredit l’adresse : RIEN n’est rangé (et c’est noté)', JSON.stringify(r.d3));
    dit(r.d4 === null, 'une modification refusée par Vinted (403) : rien n’est rangé', JSON.stringify(r.d4));
    dit(!!r.ad && r.ad.description.includes(TEXTE_A_LUI), 'la file Leboncoin (vrai buildLbcData) part avec SA description', r.ad ? JSON.stringify(r.ad.description.slice(0, 120)) : 'pas dans la file');
    dit(r.pagesRelues === 0, 'et son annonce (photos complètes, fiche enregistrée) n’est plus relue par la page pour ses codes : une requête Vinted de moins', `${r.pagesRelues} page(s)`);
  });

  console.log('── 3 bis. un message forgé par la page ne range rien (revue du 23 oct.)');
  await essaie('forgé', async () => {
    const r = await scenarioForge(SRC, { sender: { url: 'https://www.vinted.fr/catalog', tab: { id: 9, url: 'https://www.vinted.fr/catalog' } } });
    dit(r.desc === TEXTE_A_LUI && r.file && !r.file.includes('hors plateforme') && r.diags.includes('fiche_onglet_refuse'), 'message forgé depuis /catalog (aucune requête chez Vinted) : sa description reste, la file Leboncoin ne le porte pas, c’est noté', JSON.stringify({ desc: r.desc, diags: r.diags }));
    const a = await scenarioForge(SRC, { sender: { url: 'https://www.vinted.fr/items/10900000555/edit', tab: { id: 9, url: 'https://www.vinted.fr/items/10900000555/edit' } } });
    dit(a.desc === TEXTE_A_LUI, 'depuis la page d’édition d’une AUTRE annonce : rien', JSON.stringify(a));
    const p = await scenarioForge(SRC, { via: 'publication', sender: { url: 'https://www.vinted.fr/items/new', tab: { id: 9, url: 'https://www.vinted.fr/items/new' } } });
    dit(p.desc === TEXTE_A_LUI, 'se disant « publication », sans publication vue dans cet onglet : rien', JSON.stringify(p));
    const sansVia = await scenarioForge(SRC, { via: null, sender: { url: 'https://www.vinted.fr/items/' + ID + '/edit', tab: { id: 7 } } });
    dit(sansVia.desc === TEXTE_A_LUI, 'sans provenance (ni modification, ni publication) : rien', JSON.stringify(sansVia));
    const nav = await scenarioForge(SRC, { sender: { url: 'https://www.vinted.fr/member/123', tab: { id: 7, url: 'https://www.vinted.fr/member/123' } },
      avant: async (f) => { f.ongletMaj(7, { url: 'https://www.vinted.fr/items/' + ID + '/edit' }, { id: 7, url: 'https://www.vinted.fr/items/' + ID + '/edit' }); await attendre(20); } });
    dit(nav.desc === FORGE, 'l’autre sens : il a ouvert CETTE annonce en édition dans l’onglet, puis la page a changé d’adresse — sa fiche est rangée', JSON.stringify(nav.desc));
    const pub = await scenarioPublication(SRC);
    dit(pub.d && pub.d.description === TEXTE_A_LUI, 'l’autre sens : la fiche d’une vraie publication (réservation de cet onglet liée à cette annonce) est rangée', JSON.stringify(pub));
    const pubAutre = await scenarioPublication(SRC, { ongletFiche: 8 });
    dit(!pubAutre.d, 'la fiche de cette publication venue d’un AUTRE onglet : rien', JSON.stringify(pubAutre));
  });

  console.log('── 3 ter. un compte qu’il a refusé (« Non, ignorer ce compte ») ne range rien');
  await essaie('compte refusé', async () => {
    const bon = { url: 'https://www.vinted.fr/items/' + ID + '/edit', tab: { id: 7, url: 'https://www.vinted.fr/items/' + ID + '/edit' } };
    const r = await scenarioForge(SRC, { sender: bon, store: { vrmChoixComptes: { 111: { choix: 'non', login: 'x', at: Date.now() } } } });
    dit(r.desc === TEXTE_A_LUI && r.diags.includes('fiche_compte_non_capte'), 'compte du cookie refusé dans ce Chrome : la fiche n’est pas rangée, et c’est noté', JSON.stringify(r));
    const s = await scenarioForge(SRC, { sender: bon, avant: async (f) => { f.lignes.vrm_blocked_accounts = { uids: ['111'] }; } });
    dit(s.desc === TEXTE_A_LUI, 'compte supprimé définitivement : rien non plus', JSON.stringify(s.desc));
    const pasSu = await scenarioForge(SRC, { sender: bon, connecte: null });
    dit(pasSu.desc === FORGE, 'l’autre sens : compte du cookie illisible — comme les autres portes, on capte (« pas répondu »)', JSON.stringify(pasSu.desc));
  });

  console.log('── 4. base illisible : rien n’est écrit, rien n’est perdu');
  await essaie('base KO', async () => {
    const r = await scenarioBaseKO(SRC);
    dit(r.ecritAvant === 0 && r.attente === 1, 'la ligne ne se lit pas : aucune écriture, la fiche attend dans chrome.storage.local', JSON.stringify(r));
    dit(r.desc === TEXTE_A_LUI && r.attenteApres === 0, 'la base revenue, le tour suivant la range', JSON.stringify(r));
  });

  console.log('── 5. §6.1 — chaque règle, réaffaiblie, fait rougir son contrôle');
  const MUT = [
    { nom: 'le vide remplace le texte', texte: TEXTE, motif: "if (desc) out.description = desc; else if (typeof out.description !== 'string') out.description = '';", rempl: 'out.description = desc;', fichier: 'bg',
      mord: async (s) => { const r = await scenarioRangement(s); return r.d2.description !== TEXTE_A_LUI; } },
    { nom: 'la contradiction d’identifiant ignorée', texte: TEXTE, motif: "if (it.id != null && String(it.id) !== String(id)) return { contredit: true };", rempl: '', fichier: 'bg',
      mord: async (s) => { const r = await scenarioRangement(s); return r.d3 !== null; } },
    { nom: 'le statut de Vinted ignoré (page)', texte: TEXTE_INJ, motif: "      if (String(method || '').toUpperCase() !== 'PUT') return;\n      const st = Number(status);\n      if (!(st >= 200 && st < 300)) return;", rempl: "      if (String(method || '').toUpperCase() !== 'PUT') return;\n      const st = Number(status);", fichier: 'inj',
      mord: async (s) => { const b = await pageFetch('/api/v2/item_upload/items/' + ID, 'PUT', corps(ID), 403, s); return b.fiches().length > 0; } },
    { nom: 'écriture malgré une lecture ratée', texte: TEXTE, motif: "if (rr === null) return rate('fiches_lecture_ratee');", rempl: "if (rr === null) rr = [];", fichier: 'bg',
      mord: async (s) => { const r = await scenarioBaseKO(s); return r.ecritAvant > 0; } },
  ];
  MUT.push(
    { nom: 'l’onglet émetteur ignoré', texte: TEXTE, motif: '    ficheDeLaPage(msg, sender, domain);', rempl: '    noterFicheVinted(msg.itemId, msg.status, msg.corps, domain);', fichier: 'bg',
      mord: async (s) => { const r = await scenarioForge(s, { sender: { url: 'https://www.vinted.fr/catalog', tab: { id: 9, url: 'https://www.vinted.fr/catalog' } } }); return r.desc !== TEXTE_A_LUI; } },
    { nom: 'la publication acceptée sans réservation liée', texte: TEXTE, motif: "      if (!(await ongletFicheVu(PUBLIS_ONGLETS, tabId, id))) { noterDiag('fiche_onglet_refuse'); return false; }", rempl: '', fichier: 'bg',
      mord: async (s) => { const r = await scenarioForge(s, { via: 'publication', sender: { url: 'https://www.vinted.fr/items/new', tab: { id: 9, url: 'https://www.vinted.fr/items/new' } } }); return r.desc !== TEXTE_A_LUI; } },
    { nom: 'le compte refusé ignoré', texte: TEXTE, motif: "  if (uid && await compteNonCapte(uid)) { noterDiag('fiche_compte_non_capte'); return false; }", rempl: '', fichier: 'bg',
      mord: async (s) => { const r = await scenarioForge(s, { sender: { url: 'https://www.vinted.fr/items/' + ID + '/edit', tab: { id: 7 } }, store: { vrmChoixComptes: { 111: { choix: 'non', login: 'x', at: Date.now() } } } }); return r.desc !== TEXTE_A_LUI; } },
  );
  for (const m of MUT) {
    await essaie(`mutation ${m.nom}`, async () => {
      let t = m.texte;
      // `rr` est déclaré `const` : la mutation « écrit quand même » a besoin d'un `let`.
      if (m.nom.startsWith('écriture')) t = t.replace("const rr = await sbGet('app_data?id=eq.vinted_item_details&select=data');\n    if (rr === null) return rate(", "let rr = await sbGet('app_data?id=eq.vinted_item_details&select=data');\n    if (rr === null) return rate(");
      const p = muter(t, m.motif, m.rempl, m.fichier);
      if (!p) { dit(false, `mutation « ${m.nom} » : motif introuvable — l’audit ne prouve plus rien`); return; }
      dit(await m.mord(p), `réaffaibli (${m.nom}) : le contrôle rougit`);
    });
  }

  for (const p of COPIES) { try { fs.unlinkSync(p); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} fiche enregistrée sur Vinted : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
