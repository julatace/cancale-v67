require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE DÉPÔT D'UNE FICHE PRÉPARÉE, PHOTOS DANS LE BON ORDRE » (21 nov., ext. 5.429 — `ordrephotos`)
//
//  Une FAUSSE page de dépôt vinted.fr (jamais le vrai Vinted) : le champ de photos, le formulaire (titre, description,
//  catégorie, marque, taille, couleurs, colis, état, prix) et « Sauvegarder le brouillon ». Comme une vraie page, elle
//  TÉLÉVERSE chaque fichier en multipart (FormData, le fichier sous son nom) — les réponses reviennent dans le DÉSORDRE
//  (délais tirés) — puis range ses photos dans son brouillon. Le VRAI vinted-sync-extension/vrm-formulaire.js est injecté
//  et mené étape par étape ; l'ordre est relu par la VRAIE règle (src/depot/regles.js `ordreRelu`).
//    P1  « photos » rend, pour chaque fichier, son nom et l'identifiant que Vinted a rendu (lus sur la requête de la PAGE)
//    P2  réponses dans le désordre, page qui garde l'ordre des fichiers ⇒ ordre relu « ok », couverture en 1re
//    P3  page qui range ses photos dans l'ordre d'ARRIVÉE ⇒ « faux », la position nommée
//    P4  page qui réencode les fichiers (noms perdus) ⇒ « pas su », jamais « ok »
//    P5  le colis préparé est choisi dans le formulaire ; le brouillon porte les champs de la fiche
//    P6  aucune requête n'est envoyée par VRM lui-même (seule la page envoie)
//  `--mutation nom` / `--prouve` : vrm-formulaire.js réaffaibli ⇒ rouge.  SHOTS=dossier : captures.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const EXT = path.join(__dirname, '..', '..', 'vinted-sync-extension');
const SHOTS = process.env.SHOTS || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const FORM_SRC = arg('--form') || path.join(EXT, 'vrm-formulaire.js');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + m); } else { ko++; if (!process.env.SILENCE) console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };

const PAGE = ({ arrivee = false, reencode = false } = {}) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vinted (banc dépôt)</title>
<style>body{margin:0;font:15px/1.4 system-ui,sans-serif}main{padding:16px;display:grid;gap:10px;max-width:640px}label{display:grid;gap:4px}.dd{display:none}.dd.on{display:block}#vig{display:flex;gap:6px}#vig img{width:60px;height:80px;object-fit:cover;background:#ddd}</style></head><body>
<main id="m"><h2>Vends ton article</h2><div id="vig"></div>
<input type="file" multiple data-testid="add-photos-input">
<label>Titre<input id="title"></label><label>Description<textarea id="description"></textarea></label>
<label>Catégorie<input id="category" readonly></label><div class="dd" id="dd-cat" data-testid="catalog-select-dropdown-content"><input id="catalog-search-input"><div id="cat-res"></div></div>
<label>Marque<input id="brand" readonly></label><div class="dd" id="dd-brand"><input id="brand-search-input"><div id="brand-res"></div></div>
<label>Taille<input id="size" readonly></label><div class="dd" id="dd-size"><div data-testid="size-group-7-grid-option-56">42</div></div>
<label>Couleur<input id="color" readonly></label><div class="dd" id="dd-color"><div data-testid="filter-grid-option-12">Blanc</div></div>
<label><input type="radio" name="p" id="package_type_selector_1">Petit</label><label><input type="radio" name="p" id="package_type_selector_2">Moyen</label>
<label>État<input id="condition" readonly></label><div class="dd" id="dd-cond"><div id="condition-2">Très bon état</div></div>
<label>Prix<input id="price"></label>
<button data-testid="upload-form-save-draft-button">Sauvegarder le brouillon</button></main>
<script>
(() => {
  const R = window.__requetes = []; const etat = window.__etat = { couleurs: [], photos: [] };
  const q = (s) => document.querySelector(s);
  // Comme la vraie page : un envoi multipart PAR fichier ; l'ordre du brouillon = l'ordre des FICHIERS (index),
  // sauf la variante « arrivee » (l'ordre d'arrivée des réponses) ; « reencode » : le fichier part sous le nom « blob ».
  q('[data-testid=add-photos-input]').addEventListener('change', (e) => {
    const fs = [...e.target.files];
    fs.forEach((f, i) => {
      const fd = new FormData(); fd.append('photo[type]', 'item'); fd.append('photo[file]', ${reencode ? "new Blob([f], { type: f.type }), 'blob'" : 'f, f.name'});
      R.push({ u: '/api/v2/photos', i });
      fetch('/api/v2/photos?d=' + ((fs.length - i) * 120), { method: 'POST', body: fd }).then((r) => r.json()).then((j) => {
        ${arrivee ? 'etat.photos.push(j.id);' : 'etat.photos[i] = j.id;'}
        const im = document.createElement('img'); im.alt = f.name; q('#vig').appendChild(im);
      });
    });
  });
  for (const id of ['title', 'description', 'price']) q('#' + id).addEventListener('input', (e) => { etat[id] = e.target.value; });
  const ouvre = (inp, dd) => q(inp).addEventListener('click', () => q(dd).classList.add('on'));
  ouvre('#category', '#dd-cat'); ouvre('#brand', '#dd-brand'); ouvre('#size', '#dd-size'); ouvre('#color', '#dd-color'); ouvre('#condition', '#dd-cond');
  q('#catalog-search-input').addEventListener('input', (e) => { q('#cat-res').innerHTML = /bask/i.test(e.target.value) ? '<div data-testid="catalog-select-dropdown-row-1242">Baskets</div>' : ''; });
  q('#cat-res').addEventListener('click', (e) => { const id = Number((e.target.getAttribute('data-testid') || '').split('-').pop()); if (id) { etat.catalog_id = id; q('#category').value = e.target.textContent; q('#dd-cat').classList.remove('on'); } });
  q('#brand-search-input').addEventListener('input', (e) => { q('#brand-res').innerHTML = /nike/i.test(e.target.value) ? '<div data-testid="brand-row-53">Nike</div>' : ''; });
  q('#brand-res').addEventListener('click', (e) => { etat.brand_id = Number((e.target.getAttribute('data-testid') || '').split('-').pop()); q('#brand').value = e.target.textContent; });
  q('#dd-size').addEventListener('click', (e) => { etat.size_id = Number((e.target.getAttribute('data-testid') || '').split('-').pop()); });
  q('#dd-color').addEventListener('click', (e) => { const id = Number((e.target.getAttribute('data-testid') || '').split('-').pop()); if (id) etat.couleurs.push(id); });
  q('#package_type_selector_1').addEventListener('click', () => { etat.package_size_id = 1; });
  q('#package_type_selector_2').addEventListener('click', () => { etat.package_size_id = 2; });
  q('#dd-cond').addEventListener('click', (e) => { etat.status_id = Number((e.target.id || '').split('-').pop()); });
  q('[data-testid=upload-form-save-draft-button]').addEventListener('click', () => {
    const draft = { id: null, title: etat.title, description: etat.description, price: String(etat.price || '').replace(',', '.'), catalog_id: etat.catalog_id, brand_id: etat.brand_id, color_ids: etat.couleurs, package_size_id: etat.package_size_id, item_attributes: [{ code: 'size', ids: etat.size_id ? [etat.size_id] : [] }, { code: 'condition', ids: etat.status_id ? [etat.status_id] : [] }], assigned_photos: etat.photos.filter(Boolean).map((id) => ({ id })) };
    window.__brouillon = draft; R.push({ u: '/api/v2/item_upload/drafts' });
    fetch('/api/v2/item_upload/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draft }) }).then((r) => r.json());
  });
})();
</script></body></html>`;

async function ouvrir(b, o = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  let id = 500; const vu = [];
  await pg.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (/^\/api\/v2\/photos$/.test(u.pathname)) { const n = ++id; vu.push({ id: n, corps: (r.request().postData() || '').slice(0, 400) }); await new Promise((ok2) => setTimeout(ok2, Number(u.searchParams.get('d')) || 0)); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: n }) }); }
    if (/^\/api\/v2\/item_upload\/drafts$/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ draft: { id: 88001 } }) });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(o) });
  });
  await pg.goto('https://www.vinted.fr/items/new');
  return { ctx, pg, errs, vu };
}
async function etape(pg, e, d) {
  await pg.addScriptTag({ content: fs.readFileSync(FORM_SRC, 'utf8') });
  return pg.evaluate(([e2, d2]) => globalThis.__vrmFormulaire(e2, d2), [e, d || {}]);
}
// La couverture (photo « c » de SON étoile) est envoyée en 1re : photo-1.jpg = c, photo-2.jpg = a, photo-3.jpg = b.
const PHOTOS = ['c', 'a', 'b'].map((k, i) => ({ b64: Buffer.from('JPEGBANC' + k).toString('base64'), type: 'image/jpeg', nom: `photo-${i + 1}.jpg` }));
const CHAMPS = [['categorie', { id: 1242, nom: 'Baskets', recherche: 'Baskets' }], ['titre', { valeur: 'Nike Air Max 90 N°41' }], ['description', { valeur: 'Très bon état.\n\nN°41' }], ['marque', { id: 53, nom: 'Nike' }], ['taille', { id: 56 }], ['couleurs', { ids: [12] }], ['colis', { id: 1 }], ['etat', { id: 2 }], ['prix', { valeur: 65 }]];
async function deposer(b, o, M) {
  const { ctx, pg, errs, vu } = await ouvrir(b, o);
  const rp = await etape(pg, 'photos', { photos: PHOTOS });
  const res = []; for (const [quoi, d] of CHAMPS) res.push(await etape(pg, 'champ', Object.assign({ quoi }, d)));
  const rb = await etape(pg, 'brouillon', { cle: 'bf41' });
  let corps = null; try { corps = JSON.parse(rb.rep.corps); } catch (_) {}
  const d = corps && corps.draft;
  const ordre = M.ordreRelu(PHOTOS.map((p) => p.nom), rp.envoyes || null, d ? d.assigned_photos : null);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `depot-${o.arrivee ? 'arrivee' : o.reencode ? 'reencode' : 'ok'}-1280.png`) });
  const R = await pg.evaluate(() => window.__requetes.length);
  await ctx.close();
  return { rp, res, rb, d, ordre, errs, vu, R };
}
async function banc() {
  const M = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'depot', 'regles.js')).href);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    { const x = await deposer(b, {}, M);
      const env = x.rp.envoyes || [];
      dit(x.rp.ok && env.length === 3 && env.every((e) => /^photo-\d\.jpg$/.test(e.nom) && /^\d+$/.test(e.id)) && new Set(env.map((e) => e.nom)).size === 3, 'P1 « photos » rend chaque fichier (son nom, lu sur la requête multipart de la PAGE) ↔ l’identifiant rendu par Vinted', JSON.stringify(x.rp));
      const c1 = (env.find((e) => e.nom === 'photo-1.jpg') || {}).id;
      dit(x.ordre.etat === 'ok' && x.d && String(x.d.assigned_photos[0].id) === String(c1), 'P2 réponses dans le désordre, page qui garde l’ordre des fichiers ⇒ ordre relu « ok », la couverture (photo-1) en 1re', JSON.stringify({ ordre: x.ordre, env, a: x.d && x.d.assigned_photos }));
      dit(x.res.every((r) => r.ok) && x.d.package_size_id === 1 && x.d.catalog_id === 1242 && x.d.brand_id === 53 && JSON.stringify(x.d.color_ids) === '[12]' && x.d.price === '65', 'P5 le colis préparé (petit) et les champs de la fiche sont posés dans le formulaire, le brouillon les porte', JSON.stringify(x.d));
      dit(x.R === 4 && x.vu.length === 3, 'P6 seule la page envoie : 3 téléversements + 1 brouillon (VRM n’envoie rien lui-même)', `${x.R} ${x.vu.length}`);
      dit(!x.errs.length, 'P7 aucune erreur de page', x.errs.join(' | ')); }
    { const x = await deposer(b, { arrivee: true }, M);
      dit(x.ordre.etat === 'faux' && x.ordre.premier === 1, 'P3 page qui range ses photos dans l’ordre d’ARRIVÉE ⇒ « faux », la couverture (position 1) nommée', JSON.stringify(x.ordre)); }
    { const x = await deposer(b, { reencode: true }, M);
      dit(x.ordre.etat === 'pas-su', 'P4 fichiers réencodés par la page (noms perdus) ⇒ « pas su », jamais « ok »', JSON.stringify({ o: x.ordre, e: x.rp.envoyes })); }
  } finally { await b.close(); }
}
const MUTATIONS = [
  ['sans-noms', "    try { if (!b || typeof FormData === 'undefined' || !(b instanceof FormData)) return null;", "    try { return null;"],
  ['noms-inventes', "nom: e.fichiers && e.fichiers.length === 1 ? e.fichiers[0] : '',", "nom: 'photo-' + (rep.indexOf(e) + 1) + '.jpg',"],
];
(async () => {
  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(FORM_SRC, 'utf8'); let bien = true;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'depot-banc-'));
    for (const [nom, de, vers] of MUTATIONS) {
      if (!src.includes(de)) { console.log('❌ mutation ' + nom + ' : motif introuvable'); bien = false; continue; }
      const p = path.join(tmp, nom + '.js'); fs.writeFileSync(p, src.replace(de, vers));
      const r = cp.spawnSync(process.execPath, [__filename, '--form', p], { env: { ...process.env, SILENCE: '1', SHOTS: '' }, encoding: 'utf8', timeout: 600000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    }
    process.exit(bien ? 0 : 1);
  }
  await banc();
  console.log(`\n${ko ? '❌' : '✅'} banc depot-vinted : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
