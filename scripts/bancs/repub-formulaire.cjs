require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE FORMULAIRE DE VINTED REMPLI PAR VRM » (20 nov., ext. 5.410.3 — `repubformulaire`)
//
//  Une FAUSSE page vinted.fr (jamais le vrai Vinted) qui reproduit les data-testid / id du
//  formulaire relevés le 20 nov. (« Vends tes articles », champ de photos, titre, description,
//  catégorie + recherche, marque, taille en grille, couleurs, colis, état, prix, « Sauvegarder le
//  brouillon », « Supprimer » + sa confirmation, « Ajouter »). La page envoie ELLE-MÊME ses
//  requêtes (photos, brouillon, suppression, mise en ligne), comme Vinted. Le VRAI
//  vinted-sync-extension/vrm-formulaire.js y est injecté et mené étape par étape, comme le fait
//  le service worker. Avec les VRAIS vrm-ui.js / vrm-mots.js / vrm-action.js : l'écran plein.
//    B1  l'ordre exact des requêtes de la page : photos → brouillon → suppression → mise en ligne
//    B2  chaque champ saisi caractère par caractère (un `input` par lettre), les valeurs justes
//    B3  le brouillon envoyé par la page porte exactement la fiche (catégorie, taille, état…)
//    B4  captcha affiché ⇒ l'étape s'arrête (`captcha`), rien n'est saisi ni envoyé
//    B5  un élément absent (Vinted a changé sa page) ⇒ `selecteur` + son nom, rien d'envoyé
//    B6  la confirmation de suppression : jamais « Annuler »
//    B7  pendant TOUT le travail, l'écran plein : un VRAI clic et de VRAIES touches de
//        l'utilisateur sont retenus (rien n'atteint Vinted), les gestes de VRM passent
//    B8  les clics de VRM sont des clics fabriqués, rien n'est maquillé (`isTrusted: false`)
//  `--mutation nom` : une copie de vrm-formulaire.js réaffaiblie ⇒ rouge ; `--prouve` : toutes.
//  SHOTS=dossier : captures.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const EXT = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const SHOTS = process.env.SHOTS || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const FORM_SRC = arg('--form') || path.join(EXT, 'vrm-formulaire.js');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + m); } else { ko++; if (!process.env.SILENCE) console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };

// ── La fausse page : un seul document qui sait être « nouvelle annonce », « annonce », « brouillon ».
const PAGE = ({ sansTaille = false } = {}) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vinted (banc)</title>
<style>body{margin:0;font:15px/1.4 system-ui,sans-serif}header{height:56px;display:flex;align-items:center;gap:16px;padding:0 16px;border-bottom:1px solid #ddd}
main{padding:16px;display:grid;gap:10px;max-width:640px}label{display:grid;gap:4px}.dd{border:1px solid #ccc;padding:8px;display:none}.dd.on{display:block}
[role=dialog]{position:fixed;inset:30% 20%;background:#fff;border:1px solid #888;padding:16px}</style></head><body>
<header><b>Vinted banc</b><a href="#" data-testid="header-upload-item-button">Vends tes articles</a></header>
<main id="m"></main>
<script>
(() => {
  const J = window.__journal = [];        // ce que la PAGE a vu (événements de confiance compris)
  const R = window.__requetes = [];       // ce que la PAGE a envoyé, dans l'ordre
  const etat = window.__etat = { couleurs: [] };
  const note = (quoi, x) => J.push(Object.assign({ quoi, t: performance.now() }, x || {}));
  const post = (u, corps) => { R.push({ u, t: performance.now() }); return fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corps == null ? null : JSON.stringify(corps) }).then((r) => r.json()); };
  const m = document.getElementById('m');
  // Tout clic qui arrive à la page est noté, avec son isTrusted (un vrai clic de l'utilisateur ou un clic fabriqué).
  document.addEventListener('click', (e) => note('clic', { cible: e.target && (e.target.getAttribute('data-testid') || e.target.id || e.target.tagName), confiance: e.isTrusted }), true);
  document.addEventListener('keydown', (e) => note('touche', { k: e.key, confiance: e.isTrusted }), true);
  function nouvelle() {
    m.innerHTML = '<input type="file" multiple data-testid="add-photos-input">'
      + '<label>Titre<input id="title" data-testid="title--input"></label>'
      + '<label>Description<textarea id="description" data-testid="description--input"></textarea></label>'
      + '<label>Catégorie<input id="category" data-testid="catalog-select-dropdown-input" readonly></label>'
      + '<div class="dd" id="dd-cat" data-testid="catalog-select-dropdown-content"><input id="catalog-search-input"><div id="cat-res"></div></div>'
      + '<label>Marque<input id="brand" readonly></label><div class="dd" id="dd-brand"><input id="brand-search-input"><div id="brand-res"></div></div>'
      + ${sansTaille ? "''" : "'<label>Taille<input id=\"size\" data-testid=\"category-size-single-grid-input\" readonly></label><div class=\"dd\" id=\"dd-size\"><div data-testid=\"size-group-7-grid-option-55\">41</div><div data-testid=\"size-group-7-grid-option-56\">42</div></div>'"}
      + '<label>Couleur<input id="color" data-testid="color-select-dropdown-input" readonly></label><div class="dd" id="dd-color"><div data-testid="filter-grid-option-1">Noir</div><div data-testid="filter-grid-option-3">Gris</div></div>'
      + '<label><input type="radio" name="p" id="package_type_selector_1" data-testid="package_type_selector_1--input">Petit</label><label><input type="radio" name="p" id="package_type_selector_2">Moyen</label>'
      + '<label>État<input id="condition" data-testid="category-condition-single-list-input" readonly></label><div class="dd" id="dd-cond"><div id="condition-2" data-testid="condition-2">Très bon état</div><div id="condition-3" data-testid="condition-3">Bon état</div></div>'
      + '<label>Prix<input id="price" data-testid="price-input--input"></label>'
      + '<button data-testid="upload-form-save-draft-button">Sauvegarder le brouillon</button><button data-testid="upload-form-save-button">Ajouter</button>';
    const q = (s) => m.querySelector(s);
    q('[data-testid=add-photos-input]').addEventListener('change', (e) => { const fs = [...e.target.files]; note('photos', { n: fs.length, noms: fs.map((f) => f.name) }); fs.forEach((f) => post('/api/v2/photos', { nom: f.name, taille: f.size }).then((j) => { (etat.photos = etat.photos || []).push(j.id); })); });
    for (const id of ['title', 'description', 'price']) q('#' + id).addEventListener('input', (e) => { etat[id] = e.target.value; note('saisie', { id, confiance: e.isTrusted, n: e.target.value.length }); });
    const ouvre = (inp, dd) => q(inp).addEventListener('click', () => q(dd).classList.add('on'));
    ouvre('#category', '#dd-cat'); ouvre('#brand', '#dd-brand'); ${sansTaille ? '' : "ouvre('#size', '#dd-size');"} ouvre('#color', '#dd-color'); ouvre('#condition', '#dd-cond');
    q('#catalog-search-input').addEventListener('input', (e) => { q('#cat-res').innerHTML = /bask/i.test(e.target.value) ? '<div data-testid="catalog-select-dropdown-row-1234">Baskets test</div><div data-testid="catalog-select-dropdown-row-1235">Baskets test</div>' : ''; });
    q('#cat-res').addEventListener('click', (e) => { const t = e.target.getAttribute('data-testid') || ''; const id = Number(t.split('-').pop()); if (id) { etat.catalog_id = id; q('#category').value = e.target.textContent; q('#dd-cat').classList.remove('on'); note('choix', { champ: 'categorie', id }); } });
    q('#brand-search-input').addEventListener('input', (e) => { q('#brand-res').innerHTML = /marque/i.test(e.target.value) ? '<div data-testid="brand-row-53">Marque test</div>' : ''; });
    q('#brand-res').addEventListener('click', (e) => { etat.brand_id = Number((e.target.getAttribute('data-testid') || '').split('-').pop()); q('#brand').value = e.target.textContent; note('choix', { champ: 'marque', id: etat.brand_id }); });
    ${sansTaille ? '' : "q('#dd-size').addEventListener('click', (e) => { etat.size_id = Number((e.target.getAttribute('data-testid') || '').split('-').pop()); note('choix', { champ: 'taille', id: etat.size_id }); });"}
    q('#dd-color').addEventListener('click', (e) => { const id = Number((e.target.getAttribute('data-testid') || '').split('-').pop()); if (id) { etat.couleurs.push(id); note('choix', { champ: 'couleur', id }); } });
    q('#package_type_selector_1').addEventListener('click', () => { etat.package_size_id = 1; note('choix', { champ: 'colis', id: 1 }); });
    q('#dd-cond').addEventListener('click', (e) => { etat.status_id = Number((e.target.id || '').split('-').pop()); note('choix', { champ: 'etat', id: etat.status_id }); });
    q('[data-testid=upload-form-save-draft-button]').addEventListener('click', () => {
      const draft = { id: null, title: etat.title, description: etat.description, price: String(etat.price || '').replace(',', '.'), catalog_id: etat.catalog_id, brand_id: etat.brand_id, color_ids: etat.couleurs, package_size_id: etat.package_size_id, item_attributes: [{ code: 'size', ids: etat.size_id ? [etat.size_id] : [] }, { code: 'condition', ids: etat.status_id ? [etat.status_id] : [] }], assigned_photos: (etat.photos || []).map((id) => ({ id })) };
      window.__brouillon = draft;
      post('/api/v2/item_upload/drafts', { draft }).then(() => { note('navigue', { vers: '/member/111' }); history.pushState({}, '', '/member/111'); m.innerHTML = '<p>Ton dressing</p>'; });
    });
  }
  function annonce(id) {
    m.innerHTML = '<h1>Annonce ' + id + '</h1><button data-testid="item-delete-button">Supprimer</button>';
    m.querySelector('[data-testid=item-delete-button]').addEventListener('click', () => {
      const d = document.createElement('div'); d.setAttribute('role', 'dialog');
      d.innerHTML = '<p>Supprimer cet article ?</p><button data-testid="item-delete-modal-cancel">Annuler</button><button data-testid="item-delete-modal-confirm-button">Confirmer et supprimer</button>';
      document.body.appendChild(d);
      d.querySelector('[data-testid=item-delete-modal-cancel]').addEventListener('click', () => { note('annule'); d.remove(); });
      d.querySelector('[data-testid=item-delete-modal-confirm-button]').addEventListener('click', () => { d.remove(); post('/api/v2/items/' + id + '/delete', null).then(() => { history.pushState({}, '', '/member/111'); m.innerHTML = '<p>Ton dressing</p>'; }); });
    });
  }
  function brouillon(id) {
    m.innerHTML = '<input id="title" value="Basket test 42"><button data-testid="upload-form-save-button">Ajouter</button>';
    m.querySelector('[data-testid=upload-form-save-button]').addEventListener('click', () => post('/api/v2/item_upload/drafts/' + id + '/completion', { draft: { id } }).then(() => { history.pushState({}, '', '/member/111'); m.innerHTML = '<p>Ton dressing</p>'; }));
  }
  document.querySelector('[data-testid=header-upload-item-button]').addEventListener('click', (e) => { e.preventDefault(); history.pushState({}, '', '/items/new'); nouvelle(); });
  window.__aller = (p) => { history.pushState({}, '', p); const a = /^\\/items\\/(\\d+)$/.exec(p), b = /^\\/items\\/(\\d+)\\/edit$/.exec(p); if (p === '/items/new') nouvelle(); else if (b) brouillon(b[1]); else if (a) annonce(a[1]); };
  const p0 = location.pathname; if (p0 !== '/') window.__aller(p0);
})();
</script></body></html>`;

async function ouvrir(b, o = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  // Le banc lit l'écran plein : sa racine fermée est ouverte ICI seulement (la vraie reste fermée).
  await pg.addInitScript(() => { const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { return o.call(this, Object.assign({}, x, { mode: 'open' })); }; });
  let id = 800;
  await pg.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (/^\/api\/v2\/photos$/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: ++id }) });
    if (/^\/api\/v2\/item_upload\/drafts$/.test(u.pathname)) return r.fulfill({ status: o.statutBrouillon || 200, contentType: 'application/json', body: JSON.stringify({ draft: { id: 88001 } }) });
    if (/\/delete$/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":0}' });
    if (/\/completion$/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"item":{"id":88001}}' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(o) });
  });
  await pg.goto('https://www.vinted.fr/items/9101/edit');
  return { ctx, pg, errs };
}
// Le service worker, joué ici : il injecte le VRAI fichier puis appelle UNE étape.
async function etape(pg, e, d) {
  await pg.addScriptTag({ content: fs.readFileSync(FORM_SRC, 'utf8') });
  const t0 = Date.now();
  const r = await pg.evaluate(([e2, d2]) => globalThis.__vrmFormulaire(e2, d2), [e, d || {}]);
  return Object.assign({ ms: Date.now() - t0 }, r || {});
}
const PHOTOS = [1, 2].map((i) => ({ b64: Buffer.from('JPEGBANC' + i).toString('base64'), type: 'image/jpeg', nom: `photo-${i}.jpg` }));
const CHAMPS = [['categorie', { id: 1234, nom: 'Baskets test', recherche: 'Baskets test' }], ['titre', { valeur: 'Basket test 42' }], ['description', { valeur: 'Très bon état, boîte' }], ['marque', { id: 53, nom: 'Marque test' }], ['taille', { id: 56 }], ['couleurs', { ids: [1] }], ['colis', { id: 1 }], ['etat', { id: 2 }], ['prix', { valeur: 54 }]];
async function overlay(pg, actif = true) {
  await pg.evaluate((a) => {
    const ecoutes = []; window.__etatAction = a;
    window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, sendMessage: (msg, cb) => { const rep = msg.action === 'etat' && msg.from === 'vrm-action' ? { ok: true, action: window.__etatAction } : { ok: true }; setTimeout(() => cb && cb(rep), 0); } },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' }, storage: { local: { get: (k, cb) => { const v = { vrmActionEnCours: window.__etatAction }; if (cb) setTimeout(() => cb(v), 0); return Promise.resolve(v); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener: (f) => ecoutes.push(f) } } };
  }, actif ? { v: 1, actif: true, sorte: 'republier', uid: '111', debut: Date.now(), fait: 0, total: 1, enCours: true, quoi: '', item: { id: '9101', num: '41', titre: 'Basket test 42' }, repub: { id: '9101', fait: 0, du: null, photos: null }, formulaire: true, maj: Date.now() } : null);
  for (const f of ['vrm-ui.js', 'vrm-mots.js', 'vrm-action.js']) await pg.addScriptTag({ content: fs.readFileSync(path.join(EXT, f), 'utf8') });
  await pg.waitForTimeout(500);
}

async function banc() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // ── B1–B3, B6–B8 : la paire complète, sous l'écran plein
    { const { ctx, pg, errs } = await ouvrir(b);
      await overlay(pg, true);
      const plein = await pg.evaluate(() => { const h = document.getElementById('vrm-action'); return !!h && getComputedStyle(h).display !== 'none'; });
      const reduire = await pg.evaluate(() => { const h = document.getElementById('vrm-action'); const o = h && h.shadowRoot; return o ? { reduire: !!o.querySelector('[data-reduire]'), arreter: !!o.querySelector('[data-arreter]') } : null; });
      dit(plein && reduire && reduire.arreter && !reduire.reduire, 'B7a — l’écran plein est posé sur vinted.fr pendant le formulaire (le vrai vrm-action.js) : « Tout arrêter » seul, pas de « Réduire »', JSON.stringify({ plein, reduire }));
      const r0 = await etape(pg, 'ouvrirVente');
      dit(r0.ok && /\/items\/new$/.test(await pg.evaluate(() => location.pathname)), 'B1a — « Vends tes articles » ouvre le formulaire', JSON.stringify(r0));
      // Un VRAI clic de l'utilisateur sur le champ titre, et de VRAIES touches : retenus par l'écran plein.
      const box = await pg.locator('#title').boundingBox();
      await pg.mouse.click(box.x + 10, box.y + 5);
      await pg.keyboard.type('xyz');
      const r1 = await etape(pg, 'photos', { photos: PHOTOS });
      const res = [];
      for (const [quoi, d] of CHAMPS) res.push([quoi, await etape(pg, 'champ', Object.assign({ quoi }, d))]);
      // Encore un vrai clic, sur « Sauvegarder le brouillon » cette fois.
      const bb = await pg.locator('[data-testid=upload-form-save-draft-button]').boundingBox();
      await pg.mouse.click(bb.x + 5, bb.y + 5);
      await pg.waitForTimeout(200);
      const avantBrouillon = await pg.evaluate(() => window.__requetes.filter((x) => /drafts$/.test(x.u)).length);
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'formulaire-ecran-plein.png') });
      const rb = await etape(pg, 'brouillon', { cle: 'b9101' });
      await pg.evaluate(() => window.__aller('/items/9101'));
      const rs = await etape(pg, 'supprimer', { id: '9101', cle: 's9101' });
      await pg.evaluate(() => window.__aller('/items/88001/edit'));
      const rp0 = await etape(pg, 'formulairePret');
      const rp = await etape(pg, 'publier', { draftId: '88001', cle: 'p88001' });
      const J = await pg.evaluate(() => window.__journal), R = await pg.evaluate(() => window.__requetes.map((x) => x.u)), B = await pg.evaluate(() => window.__brouillon);
      const seq = R.map((u) => /photos$/.test(u) ? 'P' : /drafts$/.test(u) ? 'B' : /delete$/.test(u) ? 'S' : /completion$/.test(u) ? 'M' : '?').join('');
      dit(r1.ok && res.every(([, x]) => x.ok) && rb.ok && rs.ok && rp0.ok && rp.ok && seq === 'PPBSM', 'B1 — les requêtes de LA PAGE, dans l’ordre : 2 photos → brouillon → suppression → mise en ligne', `${seq} ${JSON.stringify({ r1, res: res.filter(([, x]) => !x.ok), rb: rb.code, rs: rs.code, rp: rp.code })}`);
      dit(rb.rep && rb.rep.status === 200 && /"draft"/.test(rb.rep.corps || '') && rb.rep.json.draft.id === 88001 && rs.rep && rs.rep.status === 200 && rp.rep && rp.rep.json.item.id === 88001, 'B1b — chaque geste rend la RÉPONSE de Vinted à la requête de la page (statut, identifiant, corps envoyé)', JSON.stringify({ rb: rb.rep && rb.rep.status, rs: rs.rep && rs.rep.status, rp: rp.rep && rp.rep.status }));
      const sT = J.filter((x) => x.quoi === 'saisie' && x.id === 'title');
      const nS = sT.map((x) => x.n).join(',');
      dit(nS === Array.from({ length: 'Basket test 42'.length + 1 }, (_, k) => k).join(','), 'B2 — le titre saisi caractère par caractère (vidé, puis un `input` par lettre : 0,1,2…14, setter natif)', nS);
      dit(B && B.title === 'Basket test 42' && B.description === 'Très bon état, boîte' && B.price === '54' && B.catalog_id === 1234 && B.brand_id === 53 && JSON.stringify(B.color_ids) === '[1]' && B.package_size_id === 1 && B.item_attributes[0].ids[0] === 56 && B.item_attributes[1].ids[0] === 2 && B.assigned_photos.length === 2, 'B3 — le brouillon envoyé par la page porte la fiche : catégorie (deux « Baskets test » de même nom : la bonne par son identifiant), marque, taille, couleur, colis, état, prix, 2 photos', JSON.stringify(B));
      dit(!J.some((x) => x.quoi === 'annule'), 'B6 — la confirmation de suppression : « Confirmer et supprimer », jamais « Annuler »', JSON.stringify(J.filter((x) => x.quoi === 'annule')));
      const surEcran = J.filter((x) => x.quoi === 'clic' && x.confiance === true && x.cible === 'vrm-action').length;
      const vraisClics = J.filter((x) => x.quoi === 'clic' && x.confiance === true && x.cible !== 'vrm-action'), vraiesTouches = J.filter((x) => x.quoi === 'touche' && x.confiance === true);
      const titreSali = J.some((x) => x.quoi === 'saisie' && x.id === 'title' && x.confiance === true);
      dit(surEcran === 2 && !vraisClics.length && !vraiesTouches.length && !titreSali && avantBrouillon === 0, 'B7 — pendant tout le travail, les 2 vrais clics de l’utilisateur tombent sur l’écran plein et ses vraies touches sont retenues : rien n’atteint Vinted (ni le titre, ni « Sauvegarder le brouillon »)', JSON.stringify({ surEcran, vraisClics, vraiesTouches, avantBrouillon }));
      const clicsVrm = J.filter((x) => x.quoi === 'clic' && x.cible !== 'vrm-action');
      dit(clicsVrm.length >= 10 && clicsVrm.every((x) => x.confiance === false), `B8 — les ${clicsVrm.length} clics de VRM sont des clics fabriqués (isTrusted: false), rien n’est maquillé`, JSON.stringify(clicsVrm.slice(0, 3)));
      dit(res.every(([, x]) => x.ms < 8000), 'B9 — chaque champ répond vite (< 8 s, saisie sans minuterie : l’onglet peut être en arrière-plan)', JSON.stringify(res.map(([q, x]) => q + ':' + x.ms)));
      dit(!errs.length, 'B10 — aucune erreur de page', errs.slice(0, 2).join(' | '));
      await ctx.close(); }
    // ── B4 : captcha
    { const { ctx, pg } = await ouvrir(b);
      await etape(pg, 'ouvrirVente');
      await pg.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://geo.captcha-delivery.com/captcha/?banc=1'; document.body.appendChild(f); });
      const r = await etape(pg, 'champ', { quoi: 'titre', valeur: 'Basket test 42' });
      const J = await pg.evaluate(() => window.__journal);
      dit(r.code === 'captcha' && !J.some((x) => x.quoi === 'saisie'), 'B4 — captcha affiché ⇒ l’étape s’arrête (captcha), rien n’est saisi', JSON.stringify(r));
      const rb = await etape(pg, 'brouillon', { cle: 'x' });
      dit(rb.code === 'captcha' && !(await pg.evaluate(() => window.__requetes.length)), 'B4b — et aucun brouillon ne part', JSON.stringify(rb));
      await ctx.close(); }
    // ── B5 : Vinted a changé sa page (plus de champ taille)
    { const { ctx, pg } = await ouvrir(b, { sansTaille: true });
      await etape(pg, 'ouvrirVente');
      const r = await pg.evaluate(async (src) => { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); const t0 = Date.now(); const x = await globalThis.__vrmFormulaire('champ', { quoi: 'taille', id: 56 }); return Object.assign({ ms: Date.now() - t0 }, x); }, fs.readFileSync(FORM_SRC, 'utf8'));
      dit(r.code === 'selecteur' && r.manque === 'taille' && !(await pg.evaluate(() => window.__requetes.length)), 'B5 — un élément absent ⇒ « selecteur » + son nom (taille), rien d’envoyé', JSON.stringify(r));
      await ctx.close(); }
  } finally { await b.close(); }
}
const MUTATIONS = [
  ['captcha-aveugle', "const captcha = () => { try { return !!document.querySelector(CAPTCHA); } catch (_) { return false; } };", 'const captcha = () => false;'],
  ['annuler', "!/cancel|annul|close/i.test(x.getAttribute('data-testid') || '')", 'true'],
  ['tout-dun-coup', "      v += ch; poser(v);", "      v = String(texte); poser(v);"],
  ['par-libelle', "    if (id != null && String(id) !== '') {", "    if (false) {"],
  ['reduire', "${a.formulaire ? '' : `<button", "${'' ? '' : `<button", 'vrm-action.js'],
  ['sans-bouclier', "for (const t of ['keydown', 'keypress', 'keyup', 'wheel', 'touchmove']) window.addEventListener(t, bouclier,", "for (const t of []) window.addEventListener(t, bouclier,", 'vrm-action.js'],
  ['voile-transparent', ".voile { position: fixed; inset: 0; pointer-events: auto;", ".voile { position: fixed; inset: 0; pointer-events: none;", 'vrm-action.js'],
];
(async () => {
  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(FORM_SRC, 'utf8'); let bien = true;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'form-banc-'));
    for (const [nom, de, vers, fichier] of MUTATIONS) {
      let args = [], env = {};
      if (fichier) {
        const dossier = path.join(tmp, nom); fs.mkdirSync(dossier);
        for (const f of fs.readdirSync(EXT)) if (/\.js$/.test(f)) fs.copyFileSync(path.join(EXT, f), path.join(dossier, f));
        const c = fs.readFileSync(path.join(dossier, fichier), 'utf8');
        if (!c.includes(de)) { console.log('❌ mutation ' + nom + ' : motif introuvable'); bien = false; continue; }
        fs.writeFileSync(path.join(dossier, fichier), c.replace(de, vers)); env = { BANC_EXT: dossier }; args = ['--form', FORM_SRC];
      } else {
        if (!src.includes(de)) { console.log('❌ mutation ' + nom + ' : motif introuvable'); bien = false; continue; }
        const p = path.join(tmp, nom + '.js'); fs.writeFileSync(p, src.replace(de, vers)); args = ['--form', p];
      }
      const r = cp.spawnSync(process.execPath, [__filename, ...args], { env: { ...process.env, ...env, SILENCE: '1', SHOTS: '' }, encoding: 'utf8', timeout: 600000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    }
    process.exit(bien ? 0 : 1);
  }
  await banc();
  console.log(`\n${ko ? '❌' : '✅'} banc repub-formulaire : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
