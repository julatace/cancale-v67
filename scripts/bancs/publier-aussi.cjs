// ════════════════════════════════════════════════════════════════════════════
//  « PUBLIER AUSSI SUR… » DE BOUT EN BOUT (21 nov., ext. 5.424 — `publieraussi`)
//        node scripts/bancs/publier-aussi.cjs [--src background.js] [--depot vrm-depot-aussi.js] [--prouve]
//
//  Julien (choix n° 45) : une annonce Vinted publiée aussi sur Leboncoin et Vestiaire en un geste, « parfait et
//  irréprochable ». Le VRAI background.js (scripts/_fond-vm.cjs : fausse base à état, faux stockage) mène de VRAIS
//  onglets Chromium : un FAUX leboncoin.fr de dépôt en étapes et un FAUX vestiairecollective.com de dépôt, où tourne
//  le VRAI vrm-depot-aussi.js (monde isolé simulé : `chrome.runtime` relié au fond du vm). Tout est INVENTÉ (le dépôt
//  du code est public) :
//   N1  cas nominal, les DEUX sites : aperçu ✓ partout, puis UN lancement ⇒ une annonce sur chaque site, champs
//       tapés LETTRE À LETTRE, photos déposées une à une, « Publier » cliqué UNE fois, l'annonce créée retenue par
//       SON identifiant avec le N° (`lbc_publiees`, `vc_listings.liens`), lien « Voir sur… », frise complète
//   I1  50 annonces au MÊME titre : la 31e ⇒ SA description (« Réf. VRM-{N°31} »), SES photos, SON N° (jamais une voisine)
//   C1  catégorie Vinted inconnue (ambiguë) ⇒ « à choisir », RIEN ne part (aucun onglet ouvert)
//   T1  taille « US 9 » (aucune conversion exacte) ⇒ « à choisir », RIEN ne part ; choisie (43) ⇒ prête
//   R1  la page change la pointure choisie (relue différente) ⇒ ARRÊT avant « Publier », écart nommé, 0 publication
//   D1  double clic (deux lancements) ⇒ UNE publication ; relancé ensuite ⇒ « déjà publiée », rien ne repart
//   A1  l'onglet de travail est sur un AUTRE compte ⇒ rien n'est tapé, rien n'est publié, place rendue
//   V1  vérification VISIBLE sur la page ⇒ arrêt, 0 publication
//   S1  le bouton « Publier » a changé de nom ⇒ arrêt AVANT, nommé, 0 publication
//   P1  prix : +10 % sur Leboncoin (à l'euro supérieur), jamais sous le prix mini (sinon « à choisir »)
//  `--prouve` : chaque règle réaffaiblie (vrm-depot-aussi.js, background.js) doit rougir le banc.
//  Captures : SHOTS=dossier (390 px puis 1512 px).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const racine = path.join(__dirname, '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F_SRC = arg('--src', path.join(racine, 'vinted-sync-extension/background.js'));
const F_DEPOT = arg('--depot', path.join(racine, 'vinted-sync-extension/vrm-depot-aussi.js'));
const SEUL = (() => { const i = process.argv.indexOf('--seul'); return i > 0 ? process.argv[i + 1].split(',') : null; })();

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['toutDunCoup', 'depot', "    for (const ch of [...String(texte)]) {", "    for (const ch of [String(texte)]) {"],
    ['sansRelecture', 'src', "    const jr = GARDES_APP.relireFormulaire(attendu, lus);\n    if (!jr.ok)", "    const jr = { ok: true };\n    if (!jr.ok)"],
    ['sansJugementPage', 'src', "      if (!j0.ok) { await rendre(); return arret('relecture', { ecarts: j0.ecarts }); }", ''],
    ['sansCompteOnglet', 'src', "    if (vu !== compte) { await rendre(); return arret('autre-compte'); }", ''],
    ['sansCaptcha', 'depot', "        if (r.width >= 120 && r.height >= 60 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) return true;", ''],
    ['sansNoteAvant', 'src', "    if (fx[k]) { await rendre(); return arret('deja', { raison: 'déjà notée sur ce site : rien ne repart' }); }", ''],
    ['deuxLancements', 'src', "  if (_aussiEnVol) return { accepte: false, code: 'en-cours', raison: 'Une publication est déjà en train de partir : attends-la.' };", ''],
    ['publierDevine', 'depot', "    if (l.length !== 1) return { ok: false, clique: false, erreur: l.length ? 'champ-ambigu' : 'bouton-absent', element: 'Publier' };", "    if (!l.length) { const b = [...document.querySelectorAll('button')].filter(utile).pop(); if (b) l.push(b); }"],
    ['aChoisirIgnore', 'src', "    if (!a.pret) return { accepte: false, code: 'a-choisir',", "    if (false) return { accepte: false, code: 'a-choisir',"],
    ['optionApprochee', 'depot', "      const opts = Array.from(ctrl.options).filter((o) => norm(o.textContent) === v);", "      const opts = Array.from(ctrl.options).filter((o) => norm(o.textContent).startsWith(v.slice(0, 1))).slice(0, 1);"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-aussi-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const f = cle === 'src' ? F_SRC : F_DEPOT;
    const txt = fs.readFileSync(f, 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(f));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier, '--' + (cle === 'src' ? 'depot' : 'src'), cle === 'src' ? F_DEPOT : F_SRC];
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 1500000, env: Object.assign({}, process.env, { SHOTS: '' }) });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir le banc' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

const { faireFond } = require('../_fond-vm.cjs');
let ko = 0, okN = 0;
const dit = (ok, nom, det) => { if (ok) okN++; else ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 700)}`); };
const SHOTS = process.env.SHOTS || '';
const fait = (k) => !SEUL || SEUL.includes(k);
const UID = '111', MOI = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b', AUTRE = '9e9e9e9e-2222-4333-8444-955566667777', VC_MOI = '18273645', VC_AUTRE = '99887766';
const TITRE = 'Nike Air Max 90 blanche';
// 50 annonces INVENTÉES au même titre, même taille, même prix — chacune son identifiant, son N°, ses photos.
const IDS = Array.from({ length: 50 }, (_, i) => String(4100000100 + i * 13));
const NUMS = IDS.map((_, i) => String(300 + i));
const photo = (i, k) => `https://images1.vinted.net/t/banc/f800/${IDS[i]}-${k}.jpeg`;
// Un vrai JPEG de 1 × 1 (les octets que le site reçoit sont ceux-là).
const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

function base(o = {}) {
  const lignes = {};
  const fiches = {}, details = {};
  IDS.forEach((id, i) => {
    fiches[id] = { numero: NUMS[i], min: o.mini != null ? String(o.mini) : '45' };
    lignes[`coffre_${UID}_${id}`] = { id, uid: UID, title: TITRE, desc: '', brand: 'Nike', size: o.taille || '42', etat: 'Très bon état', catalogId: o.catalog || 1242, price: { amount: String(o.prix || '59.00'), currency_code: 'EUR' }, photos: [photo(i, 1), photo(i, 2), photo(i, 3)] };
    details[id] = { codes: { catalog_id: o.catalog || 1242 }, description: 'Portées deux fois, boîte d’origine.', couleur: 'Blanc', marque: 'Nike', taille: o.taille || '42', etat: 'Très bon état', photos: [photo(i, 1), photo(i, 2), photo(i, 3)] };
  });
  lignes.main = { vinted_annonce_numeros: fiches, vinted_buyprice_by_num: {} };
  lignes.vinted_item_details = details;
  lignes.lbc_publiees = { publiees: {} };
  lignes.lbc_listings = { items: {} };
  lignes.vc_listings = { items: {}, liens: {} };
  lignes.vc_catalogue = { deposit_brands: { corps: JSON.stringify({ data: [{ name: 'Nike', id: '14' }, { name: 'Adidas', id: '3' }] }) } };
  return lignes;
}

// ── LE FAUX LEBONCOIN : un dépôt en étapes (inventé) ──
const STYLE = `<style>body{font:15px/1.4 system-ui;margin:0;padding:64px 16px 16px;max-width:760px}label{display:block;margin:10px 0 4px}input,textarea,select{font:inherit;min-height:40px;width:100%;box-sizing:border-box}button{min-height:44px;padding:0 16px;margin:6px 6px 0 0;font:inherit}
.carte{display:inline-block}[role=listbox]{border:1px solid #888;background:#fff;max-height:200px;overflow:auto}[role=option]{padding:8px}.vig{width:48px;height:48px;object-fit:cover;margin:2px;border:1px solid #ccc}</style>`;
function pageLbc(o) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${STYLE}</head><body>
<h1>Déposer une annonce</h1><div id="etape"></div>
${o.captcha ? '<iframe src="https://geo.captcha-delivery.com/captcha/?x=1" style="position:fixed;top:80px;left:10px;width:400px;height:300px;border:1px solid #888"></iframe>' : ''}
<script>
window.__frappes = 0; document.addEventListener('input', () => { window.__frappes++; }, true);
window.__publications = 0;
const S = { titre: '', cat: '', rub: '', univers: '', type: '', marque: '', pointure: '', etat: '', couleur: '', photos: 0, description: '', prix: '' };
let n = 0;
const E = document.getElementById('etape');
const opt = (l, v) => '<option value="">—</option>' + l.map((x) => '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>').join('');
const etapes = [
  () => '<label for="t">Titre de l’annonce</label><input id="t" name="subject" value="">',
  () => S.rub !== 'Mode' ? '<p>Catégorie</p><button type="button" class="carte" role="radio" aria-checked="false" data-rub="Mode">Mode</button><button type="button" class="carte" role="radio" aria-checked="false" data-rub="Maison">Maison</button>'
     : '<p>Catégorie</p><button type="button" class="carte" role="radio" aria-checked="' + (S.cat === 'Chaussures') + '" data-cat="Chaussures">Chaussures</button><button type="button" class="carte" role="radio" aria-checked="' + (S.cat === 'Vêtements') + '" data-cat="Vêtements">Vêtements</button>',
  () => '<div role="radiogroup" aria-label="Univers">' + ['Homme', 'Femme', 'Enfant'].map((u) => '<label><input type="radio" name="u" value="' + u + '"' + (S.univers === u ? ' checked' : '') + '> ' + u + '</label>').join('') + '</div>'
     + '<label for="ty">Type de chaussures</label><select id="ty">' + opt(['Baskets & Sneakers', 'Mocassins', 'Bottes'], S.type) + '</select>'
     + '<label id="lm">Marque</label><button type="button" role="combobox" aria-labelledby="lm" aria-haspopup="listbox" id="cm">' + (S.marque || 'Choisir') + '</button><div id="lst"></div>'
     + '<label for="po">Pointure</label><select id="po">' + opt(Array.from({ length: 31 }, (_, i) => { const p = 35 + i / 2; return String(p).replace('.5', ',5'); }), S.pointure) + '</select>'
     + '<label for="et">État</label><select id="et">' + opt(['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'État satisfaisant'], S.etat) + '</select>'
     + '<label for="co">Couleur</label><select id="co">' + opt(['Blanc', 'Noir', 'Gris / Anthracite'], S.couleur) + '</select>',
  () => '<label for="ph">Photos</label><input id="ph" type="file" accept="image/*" multiple><div id="vigs">' + Array.from({ length: S.photos }, () => '<img class="vig" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">').join('') + '</div>',
  () => '<label for="d">Description</label><textarea id="d" rows="6"></textarea>',
  () => '<label for="p">Prix</label><input id="p" name="price" inputmode="numeric">',
  () => '<label for="loc">Localisation</label><input id="loc" required value="69001 Lyon"><label><input type="checkbox" name="urgent"> Logo urgent 2,99 €</label><button type="button" id="pub">${o.renomme ? 'Envoyer' : 'Publier mon annonce'}</button>',
];
function dessiner() {
  E.innerHTML = etapes[n]() + (n < etapes.length - 1 ? '<div><button type="button" id="suiv">Continuer</button></div>' : '');
  const t = document.getElementById('t'); if (t) t.addEventListener('input', () => { S.titre = t.value; });
  const d = document.getElementById('d'); if (d) d.addEventListener('input', () => { S.description = d.value; });
  const p = document.getElementById('p'); if (p) p.addEventListener('input', () => { S.prix = p.value; });
  for (const [id, k] of [['ty', 'type'], ['et', 'etat'], ['co', 'couleur']]) { const s = document.getElementById(id); if (s) s.addEventListener('change', () => { S[k] = s.value; }); }
  const po = document.getElementById('po'); if (po) po.addEventListener('change', () => { S.pointure = ${o.pointureFausse ? "'43'" : 'po.value'}; ${o.pointureFausse ? "po.value = '43';" : ''} });
  document.querySelectorAll('input[name=u]').forEach((r) => r.addEventListener('change', () => { S.univers = r.value; }));
  const ph = document.getElementById('ph'); if (ph) ph.addEventListener('change', () => { const k = ph.files.length; if (!k) return; S.photos += k; window.__fichiers = (window.__fichiers || []).concat([...ph.files].map((f) => f.name)); ph.value = ''; const v = document.getElementById('vigs'); for (let i = 0; i < k; i++) { const im = document.createElement('img'); im.className = 'vig'; im.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; v.appendChild(im); } });
  const cm = document.getElementById('cm'); if (cm) cm.addEventListener('click', () => { const l = document.getElementById('lst'); l.innerHTML = '<div role="listbox"><input aria-label="Rechercher une marque">' + ['Adidas', 'New Balance', 'Nike', 'Nike ACG', 'Puma'].map((m) => '<div role="option">' + m + '</div>').join('') + '</div>';
    l.querySelectorAll('[role=option]').forEach((x) => x.addEventListener('click', () => { S.marque = x.textContent; cm.textContent = S.marque; l.innerHTML = ''; })); });
  E.querySelectorAll('[data-rub]').forEach((b) => b.addEventListener('click', () => { S.rub = b.dataset.rub; dessiner(); }));
  E.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { S.cat = b.dataset.cat; dessiner(); }));
  const s = document.getElementById('suiv'); if (s) s.addEventListener('click', () => { n++; dessiner(); });
  const pub = document.getElementById('pub'); if (pub) pub.addEventListener('click', () => { window.__publications++; window.__annonce = JSON.parse(JSON.stringify(S)); E.innerHTML = '<p>Merci ! Votre annonce est en cours de validation.</p>'; if (window.__vrmCreee) window.__vrmCreee(String(2999000100 + Math.floor(Math.random() * 99))); });
}
dessiner();
</script></body></html>`;
}
// ── LE FAUX VESTIAIRE : un dépôt sur une page (inventé) ──
function pageVc(o) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${STYLE}</head><body>
<h1>Vendre un article</h1>
<label for="ph">Photos</label><input id="ph" type="file" accept="image/*" multiple><div id="vigs"></div>
<label for="ti">Titre</label><input id="ti" value="Baskets blanches">
<label for="de">Description</label><textarea id="de" rows="5"></textarea>
<p>Catégorie</p><div id="cat"></div>
<label id="lmq">Marque</label><button type="button" role="combobox" aria-labelledby="lmq" aria-haspopup="listbox" id="mq">Choisir</button><div id="lmqs"></div>
<label for="ta">Taille</label><select id="ta"><option value="">—</option>${['41', '41,5', '42', '42,5', '43'].map((x) => `<option>${x}</option>`).join('')}</select>
<label for="et">État</label><select id="et"><option value="">—</option>${['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant'].map((x) => `<option>${x}</option>`).join('')}</select>
<label for="pr">Prix</label><input id="pr" inputmode="decimal">
<button type="button" id="pub">Mettre en vente</button>
<script>
window.__frappes = 0; document.addEventListener('input', () => { window.__frappes++; }, true);
window.__publications = 0; window.__photos = 0;
const C = { u: '', c: '', s: '' };
function cats() { const el = document.getElementById('cat');
  const niv = !C.u ? ['Mode femme', 'Mode homme'] : !C.c ? ['Chaussures', 'Vêtements'] : ['Baskets', 'Bottes & Boots', 'Mocassins'];
  const choisi = !C.u ? '' : !C.c ? '' : C.s;
  el.innerHTML = (C.u ? '<button type="button" role="radio" aria-checked="true">' + C.u + '</button>' : '') + (C.c ? '<button type="button" role="radio" aria-checked="true">' + C.c + '</button>' : '') + niv.map((x) => '<button type="button" role="radio" aria-checked="' + (x === choisi) + '" data-n="' + x + '">' + x + '</button>').join('');
  el.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.n; if (!C.u) C.u = v; else if (!C.c) C.c = v; else C.s = v; cats(); })); }
cats();
document.getElementById('ph').addEventListener('change', (e) => { const f = e.target; window.__photos += f.files.length; window.__fichiers = (window.__fichiers || []).concat([...f.files].map((x) => x.name)); for (let i = 0; i < f.files.length; i++) { const im = document.createElement('img'); im.className = 'vig'; im.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; document.getElementById('vigs').appendChild(im); } f.value = ''; });
document.getElementById('mq').addEventListener('click', () => { const l = document.getElementById('lmqs'); l.innerHTML = '<div role="listbox">' + ['Adidas', 'Nike', 'Puma'].map((m) => '<div role="option">' + m + '</div>').join('') + '</div>';
  l.querySelectorAll('[role=option]').forEach((x) => x.addEventListener('click', () => { document.getElementById('mq').textContent = x.textContent; l.innerHTML = ''; })); });
document.getElementById('pub').addEventListener('click', () => { window.__publications++; window.__annonce = { titre: document.getElementById('ti').value, description: document.getElementById('de').value, prix: document.getElementById('pr').value, cat: C, marque: document.getElementById('mq').textContent, taille: document.getElementById('ta').value, etat: document.getElementById('et').value, photos: window.__photos };
  document.body.innerHTML = '<p>Merci ! Ton article est soumis à vérification.</p>'; if (window.__vrmVcCree) window.__vrmVcCree('48' + String(Math.floor(Math.random() * 900000) + 100000)); });
</script></body></html>`;
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require(path.join(racine, 'node_modules', 'playwright'))); }
const DEPOT = fs.readFileSync(F_DEPOT, 'utf8');
// Le monde isolé simulé : `chrome.runtime` relié au fond (vm) par une fonction exposée.
const CHROME = `window.chrome = { runtime: { id: 'x', lastError: null,
  sendMessage: (m, cb) => { window.__versFond(JSON.stringify(m)).then((r) => { if (typeof cb === 'function') cb(r ? JSON.parse(r) : undefined); }); },
  onMessage: { addListener: (f) => { (window.__ecoutes = window.__ecoutes || []).push(f); } } } };
window.__ordre = (msg) => new Promise((res) => { let rendu = false; for (const f of (window.__ecoutes || [])) { const r = f(msg, { id: 'x' }, (x) => { rendu = true; res(x); }); if (r === true) return; } if (!rendu) res(undefined); });`;

async function scenario(nav, o = {}) {
  const lignes = base(o);
  const store = { vrmLbcTransport: { 8: { source: 'prive', compte: 'lbc-account:' + MOI } }, vrmVcOnglets: { 9: { compte: VC_MOI } } };
  const onglets = [{ id: 7, url: 'https://www.vinted.fr/items/' + IDS[0], status: 'complete' }, { id: 8, url: 'https://www.leboncoin.fr/', status: 'complete' }, { id: 9, url: 'https://fr.vestiairecollective.com/', status: 'complete' }];
  const F = faireFond({ src: F_SRC, lignes, connecte: UID, store, onglets });
  // Le vrai temps dans le fond (le banc commun écrase les attentes à 2 ms : ici, un onglet réel répond en vrai temps).
  F.ctx.setTimeout = (fn, ms) => setTimeout(fn, Math.min(Number(ms) || 0, 120000));
  F.ctx.photosEnOctets = async (urls) => urls.map((u) => ({ url: u, b64: JPEG, type: 'image/jpeg', taille: 300 }));
  F.ctx.photosPourVestiaire = async (urls) => urls.map((u) => ({ url: u, b64: JPEG, type: 'image/jpeg', taille: 300, detoure: true }));
  const pages = new Map();
  const ctxNav = await nav.newContext({ viewport: o.vue || { width: 390, height: 844 }, hasTouch: !o.vue, isMobile: !o.vue });
  await ctxNav.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pageLbc(o) }));
  await ctxNav.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pageVc(o) }));
  await ctxNav.route(/captcha-delivery/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>vérification</body></html>' }));
  const ouverts = [];
  const C = F.ctx.chrome;
  C.tabs.create = async (opt = {}) => {
    const id = 100 + ouverts.length;
    const url = String(opt.url || '');
    const t = { id, url, status: 'complete', active: opt.active !== false, windowId: 1 };
    onglets.push(t); ouverts.push(t);
    const site = /leboncoin/.test(url) ? 'leboncoin' : 'vestiaire';
    if (site === 'leboncoin') F.store.vrmLbcTransport = Object.assign({}, F.store.vrmLbcTransport, { [id]: { source: 'prive', compte: 'lbc-account:' + (o.autreCompte ? AUTRE : MOI) } });
    else F.store.vrmVcOnglets = Object.assign({}, F.store.vrmVcOnglets, { [id]: { compte: o.autreCompte ? VC_AUTRE : VC_MOI } });
    const pg = await ctxNav.newPage();
    pages.set(id, pg);
    await pg.exposeFunction('__versFond', async (s) => { const m = JSON.parse(s); const r = await F.envoyer(m, { id: 'x', tab: { id, url } }); return r === undefined ? null : JSON.stringify(r); });
    await pg.exposeFunction('__vrmCreee', async (adId) => { await F.envoyer({ from: 'cancale-lbc', action: 'lbcCatalogue', url: 'https://api.leboncoin.fr/api/adsubmit/v2/classifieds', body: JSON.stringify({ status: 'created', ad_id: Number(adId) }) }, { id: 'x', tab: { id, url } }); });
    await pg.exposeFunction('__vrmVcCree', async (pid) => { await F.envoyer({ from: 'cancale-vcdepot', action: 'vcPublie', productId: String(pid) }, { id: 'x', tab: { id, url } }); });
    await pg.addInitScript({ content: CHROME });
    await pg.goto(url);
    await pg.evaluate(DEPOT);
    return Object.assign({}, t);
  };
  C.tabs.sendMessage = (id, m, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    if (process.env.BANC_DIRE) console.log('→', id, m.quoi, !!pages.get(id));
    const pg = pages.get(id);
    const p = pg ? pg.evaluate((mm) => window.__ordre(mm), m).catch((e) => { if (process.env.BANC_DIRE) console.log('ordre KO', m.quoi, String(e).slice(0, 300)); return undefined; }) : Promise.resolve(undefined);
    if (process.env.BANC_DIRE) p.then((r) => console.log('ordre', m.quoi, String(JSON.stringify(r)).slice(0, 300)));
    if (typeof cb === 'function') { p.then((r) => cb(r)); return undefined; }
    return p;
  };
  C.tabs.remove = async () => {};
  const vinted = { id: 'x', tab: { id: 7, url: 'https://www.vinted.fr/items/' + IDS[0] } };
  const apercu = (m) => F.envoyer(Object.assign({ from: 'vrm-badge', action: 'publierAussiApercu' }, m), vinted);
  const lancer = (m) => F.envoyer(Object.assign({ from: 'vrm-badge', action: 'publierAussiLancer', confirme: true }, m), vinted);
  const etat = () => F.envoyer({ from: 'vrm-badge', action: 'publierAussiEtat' }, vinted);
  const finJob = async (ms = 600000) => { for (const fin = Date.now() + ms; Date.now() < fin;) { const e = await etat(); if (e && e.job && e.job.etat === 'fini') return e.job; await new Promise((r) => setTimeout(r, 800)); } return null; };
  return { F, store: F.store, lignes, pages, ouverts, apercu, lancer, etat, finJob, fermer: () => ctxNav.close() };
}
const shot = async (pg, nom) => { if (!SHOTS || !pg) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true }).catch(() => {}); };
const publ = async (pg) => (pg ? pg.evaluate(() => ({ n: window.__publications || 0, a: window.__annonce || null, f: window.__frappes || 0, fichiers: window.__fichiers || [] })).catch(() => ({ n: -1 })) : { n: 0 });
const lsite = (ap, i, s) => ((ap.articles[i] || {}).sites || {})[s] || {};
const ligne = (ap, i, s, champ) => (lsite(ap, i, s).lignes || []).find((l) => l.champ === champ) || {};

(async () => {
  const nav = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] } : { args: ['--no-sandbox'] });
  try {
    // ── N1 + I1 : les DEUX sites, la 31e de 50 annonces au même titre ──
    if (fait('N1')) {
      const B = await scenario(nav, {});
      const ID = IDS[30], NUM = NUMS[30];
      const ap = await B.apercu({ ids: [ID], sites: ['leboncoin', 'vestiaire'], pct: { leboncoin: 0, vestiaire: 0 } });
      const lb = lsite(ap, 0, 'leboncoin'), vc = lsite(ap, 0, 'vestiaire');
      dit(ap && ap.ok && ap.pret === true && lb.etat === 'pret' && vc.etat === 'pret', 'N1 — l’aperçu : tout ✓ sur Leboncoin et Vestiaire, prêt', JSON.stringify(ap).slice(0, 900));
      dit(ligne(ap, 0, 'leboncoin', 'categorie').site === 'Mode › Chaussures' && ligne(ap, 0, 'leboncoin', 'taille').site === '42' && ligne(ap, 0, 'vestiaire', 'categorie').site === 'Mode homme › Chaussures › Baskets' && ligne(ap, 0, 'leboncoin', 'description').site.endsWith('Réf. VRM-' + NUM),
        'N1 — avant / après champ par champ : catégorie, pointure, Vestiaire › Baskets, « Réf. VRM-{N°} » dans la description', JSON.stringify(lb.lignes));
      dit(JSON.stringify(lb.photos) === JSON.stringify([photo(30, 1), photo(30, 2), photo(30, 3)]), 'I1 — 50 annonces au MÊME titre : les photos montrées sont celles de LA 31e, dans l’ordre du coffre', JSON.stringify(lb.photos));
      const r = await B.lancer({ ids: [ID], sites: ['leboncoin', 'vestiaire'], pct: { leboncoin: 0, vestiaire: 0 } });
      dit(r && r.accepte === true && r.jobId, 'N1 — « Publier sur 2 sites » : accepté', JSON.stringify(r));
      const job = await B.finJob();
      const a = job && job.articles[0];
      dit(!!a && a.sites.leboncoin.etat === 'publiee' && a.sites.vestiaire.etat === 'publiee', 'N1 — publiée sur les deux sites', JSON.stringify(job));
      const pL = await publ(B.pages.get(B.ouverts[0] && B.ouverts[0].id)), pV = await publ(B.pages.get(B.ouverts[1] && B.ouverts[1].id));
      dit(pL.n === 1 && pV.n === 1, 'N1 — « Publier » cliqué UNE fois sur chaque site', JSON.stringify({ l: pL.n, v: pV.n }));
      dit(!!pL.a && pL.a.titre === TITRE && pL.a.rub === 'Mode' && pL.a.cat === 'Chaussures' && pL.a.univers === 'Homme' && pL.a.type === 'Baskets & Sneakers' && pL.a.marque === 'Nike' && pL.a.pointure === '42' && pL.a.etat === 'Très bon état' && pL.a.couleur === 'Blanc' && pL.a.prix === '59' && pL.a.photos === 3,
        'N1 — Leboncoin : chaque champ posé tel que la feuille l’a montré (titre, Mode › Chaussures, Homme, Baskets & Sneakers, Nike, 42, état, couleur, 59 €, 3 photos)', JSON.stringify(pL.a));
      dit(!!pL.a && pL.a.description === 'Portées deux fois, boîte d’origine.\n\nRéf. VRM-' + NUM, 'I1 — la description porte la référence de LA 31e (« Réf. VRM-' + NUM + ' »), jamais une voisine', JSON.stringify(pL.a && pL.a.description));
      dit(pL.f >= (TITRE.length + 40) && pV.f >= TITRE.length, 'N1 — les textes tapés LETTRE À LETTRE (une frappe par caractère)', JSON.stringify({ l: pL.f, v: pV.f }));
      dit(pL.fichiers.length === 3 && pL.fichiers.every((n) => n.startsWith('VRM-' + NUM + '-')), 'N1 — 3 photos déposées une à une, au nom du N°', JSON.stringify(pL.fichiers));
      dit(!!pV.a && pV.a.titre === TITRE && pV.a.cat.u === 'Mode homme' && pV.a.cat.c === 'Chaussures' && pV.a.cat.s === 'Baskets' && pV.a.marque === 'Nike' && pV.a.taille === '42' && pV.a.prix === '59' && pV.a.photos === 3 && /Réf\. VRM-/.test(pV.a.description),
        'N1 — Vestiaire : le titre pré-rempli par le site REMPLACÉ, Mode homme › Chaussures › Baskets, Nike, 42, 59 €, 3 photos, la référence', JSON.stringify(pV.a));
      const pub = B.lignes.lbc_publiees.publiees;
      const ad = a && a.sites.leboncoin.id;
      dit(!!ad && pub[ad] && pub[ad].numero === NUM && pub[ad].source === ID, 'N1 — l’annonce Leboncoin créée retenue par SON identifiant, reliée au N° et à l’annonce Vinted (`lbc_publiees`)', JSON.stringify(pub));
      const pid = a && a.sites.vestiaire.id;
      dit(!!pid && B.lignes.vc_listings.liens[pid] === NUM, 'N1 — l’article Vestiaire créé relié au même N° (`vc_listings.liens`)', JSON.stringify(B.lignes.vc_listings.liens));
      dit(!!a && /^https:\/\/www\.leboncoin\.fr\/ad\/x\/\d+$/.test(a.sites.leboncoin.lien) && /vestiairecollective\.com\//.test(a.sites.vestiaire.lien), 'N1 — « Voir sur Leboncoin » / « Voir sur Vestiaire » : le lien de l’annonce créée', JSON.stringify(a && [a.sites.leboncoin.lien, a.sites.vestiaire.lien]));
      dit(!!a && a.sites.leboncoin.frise.every((x) => x.etat === 'fait') && a.sites.vestiaire.frise.every((x) => x.etat === 'fait'), 'N1 — la frise : chaque étape datée sur sa preuve (vérifié, onglet, compte, photos, champs, relu, publié, retenue)', JSON.stringify(a && a.sites.leboncoin.frise));
      const actions = B.store.vrmActions || {};
      dit((actions['lbc:' + MOI] || []).length === 1 && (actions['vc:' + VC_MOI] || []).length === 1, 'N1 — UNE action comptée sur chaque compte (plafond 50/h)', JSON.stringify(actions));
      // D1 (suite) : relancé ⇒ déjà publiée.
      const ap2 = await B.apercu({ ids: [ID], sites: ['leboncoin', 'vestiaire'] });
      const r2 = await B.lancer({ ids: [ID], sites: ['leboncoin', 'vestiaire'] });
      dit(lsite(ap2, 0, 'leboncoin').etat === 'deja' && lsite(ap2, 0, 'vestiaire').etat === 'deja' && r2 && r2.accepte === false && B.ouverts.length === 2, 'D1 — relancé après : « déjà publiée » sur chaque site (relu par identité), rien ne repart', JSON.stringify({ ap2: [lsite(ap2, 0, 'leboncoin').etat, lsite(ap2, 0, 'vestiaire').etat], r2 }));
      await shot(B.pages.get(B.ouverts[0].id), '390-leboncoin-publiee');
      await shot(B.pages.get(B.ouverts[1].id), '390-vestiaire-publiee');
      await B.fermer();
    }
    // ── C1 : catégorie inconnue (ambiguë) ⇒ à choisir, rien ne part ──
    if (fait('C1')) {
      const B = await scenario(nav, { catalog: 99999 });
      const ap = await B.apercu({ ids: [IDS[2]], sites: ['leboncoin', 'vestiaire'] });
      const c = ligne(ap, 0, 'leboncoin', 'categorie');
      dit(ap.ok && ap.pret === false && c.etat === 'a-choisir' && c.question && c.question.choix.length > 5, 'C1 — catégorie Vinted inconnue : « à choisir » (parmi les catégories), jamais devinée', JSON.stringify(c));
      const r = await B.lancer({ ids: [IDS[2]], sites: ['leboncoin', 'vestiaire'] });
      dit(r && r.accepte === false && r.code === 'a-choisir' && B.ouverts.length === 0, 'C1 — « Publier » avec un champ à choisir : RIEN ne part (aucun onglet ouvert)', JSON.stringify(r));
      await B.fermer();
    }
    // ── T1 : taille non convertible ──
    if (fait('T1')) {
      const B = await scenario(nav, { taille: 'US 9' });
      const ap = await B.apercu({ ids: [IDS[3]], sites: ['leboncoin'] });
      const t = ligne(ap, 0, 'leboncoin', 'taille');
      dit(ap.pret === false && t.etat === 'a-choisir' && t.vinted === 'US 9' && t.question && t.question.choix.includes('42,5') && !t.site, 'T1 — « US 9 » : aucune conversion exacte ⇒ « à choisir » parmi les pointures du site, rien de converti', JSON.stringify(t));
      const r = await B.lancer({ ids: [IDS[3]], sites: ['leboncoin'] });
      dit(r && r.accepte === false && B.ouverts.length === 0, 'T1 — rien ne part tant que la taille est à choisir', JSON.stringify(r));
      const ap2 = await B.apercu({ ids: [IDS[3]], sites: ['leboncoin'], reponses: { [IDS[3]]: { pointure: '43' } } });
      dit(ap2.pret === true && ligne(ap2, 0, 'leboncoin', 'taille').site === '43', 'T1 — SA pointure choisie (43) ⇒ prête', JSON.stringify(ligne(ap2, 0, 'leboncoin', 'taille')));
      await B.fermer();
    }
    // ── P1 : le prix ──
    if (fait('P1')) {
      const B = await scenario(nav, { prix: '59.50', mini: 62 });
      const ap = await B.apercu({ ids: [IDS[4]], sites: ['leboncoin'], pct: { leboncoin: 10 } });
      const p = ligne(ap, 0, 'leboncoin', 'prix');
      dit(p.etat === 'ok' && p.site === '66', 'P1 — +10 % sur Leboncoin : 59,50 € → 66 € (à l’euro supérieur)', JSON.stringify(p));
      const ap2 = await B.apercu({ ids: [IDS[4]], sites: ['leboncoin'], pct: { leboncoin: 0 } });
      const p2 = ligne(ap2, 0, 'leboncoin', 'prix');
      dit(p2.etat === 'a-choisir' && p2.raison === 'sous-plancher' && p2.plancher === 62 && ap2.pret === false, 'P1 — le même prix (60 €) serait sous le prix mini (62 €) : « à choisir », rien ne part', JSON.stringify(p2));
      await B.fermer();
    }
    // ── R1 : la page change la valeur choisie ⇒ arrêt avant « Publier » ──
    if (fait('R1')) {
      const B = await scenario(nav, { pointureFausse: true });
      await B.lancer({ ids: [IDS[5]], sites: ['leboncoin'] });
      const job = await B.finJob();
      const s = job && job.articles[0].sites.leboncoin;
      const pL = await publ(B.pages.get(B.ouverts[0] && B.ouverts[0].id));
      dit(!!s && s.etat === 'arrete' && s.code === 'relecture' && (s.ecarts || []).some((e) => e.champ === 'taille' && String(e.lu) === '43') && pL.n === 0, 'R1 — la pointure relue sur la page (43) n’est pas celle voulue (42) : ARRÊT avant « Publier », l’écart nommé, 0 publication', JSON.stringify({ s, n: pL.n }));
      dit(!(B.store.vrmAussiFaits || {})['leboncoin:' + NUMS[5]] && ((B.store.vrmActions || {})['lbc:' + MOI] || []).length === 0, 'R1 — rien n’est noté publié ; la place du plafond est rendue', JSON.stringify({ f: B.store.vrmAussiFaits, a: B.store.vrmActions }));
      await shot(B.pages.get(B.ouverts[0].id), '390-leboncoin-arret-relecture');
      await B.fermer();
    }
    // ── D1 : double clic ⇒ une seule publication ──
    if (fait('D1')) {
      const B = await scenario(nav, {});
      const [r1, r2] = await Promise.all([B.lancer({ ids: [IDS[6]], sites: ['leboncoin'] }), B.lancer({ ids: [IDS[6]], sites: ['leboncoin'] })]);
      const acc = [r1, r2].filter((r) => r && r.accepte).length;
      await B.finJob();
      const r3 = await B.lancer({ ids: [IDS[6]], sites: ['leboncoin'] });
      const pL = await publ(B.pages.get(B.ouverts[0] && B.ouverts[0].id));
      dit(acc === 1 && B.ouverts.length === 1 && pL.n === 1 && r3 && r3.accepte === false, 'D1 — deux lancements en même temps (double clic) : UN accepté, UN onglet, UNE publication ; relancé ⇒ refusé', JSON.stringify({ r1, r2, r3, ouverts: B.ouverts.length, n: pL.n }));
      await B.fermer();
    }
    // ── A1 : autre compte dans l'onglet de travail ──
    if (fait('A1')) {
      const B = await scenario(nav, { autreCompte: true });
      await B.lancer({ ids: [IDS[7]], sites: ['leboncoin'] });
      const job = await B.finJob();
      const s = job && job.articles[0].sites.leboncoin;
      const pL = await publ(B.pages.get(B.ouverts[0] && B.ouverts[0].id));
      dit(!!s && s.etat === 'arrete' && s.code === 'autre-compte' && pL.n === 0 && pL.f === 0, 'A1 — l’onglet de travail est sur un AUTRE compte : rien n’est tapé, rien n’est publié', JSON.stringify({ s, p: pL }));
      dit(((B.store.vrmActions || {})['lbc:' + MOI] || []).length === 0, 'A1 — la place du plafond est rendue', JSON.stringify(B.store.vrmActions));
      await B.fermer();
    }
    // ── V1 : vérification visible ──
    if (fait('V1')) {
      const B = await scenario(nav, { captcha: true });
      await B.lancer({ ids: [IDS[8]], sites: ['leboncoin'] });
      const job = await B.finJob();
      const s = job && job.articles[0].sites.leboncoin;
      const pL = await publ(B.pages.get(B.ouverts[0] && B.ouverts[0].id));
      dit(!!s && s.etat === 'arrete' && s.code === 'verification' && pL.n === 0 && pL.f === 0, 'V1 — une vérification VISIBLE : arrêt, rien tapé, 0 publication', JSON.stringify({ s, p: pL }));
      await shot(B.pages.get(B.ouverts[0].id), '390-leboncoin-verification');
      await B.fermer();
    }
    // ── S1 : le bouton « Publier » a changé ──
    if (fait('S1')) {
      const B = await scenario(nav, { renomme: true });
      await B.lancer({ ids: [IDS[9]], sites: ['leboncoin'] });
      const job = await B.finJob();
      const s = job && job.articles[0].sites.leboncoin;
      const pL = await publ(B.pages.get(B.ouverts[0] && B.ouverts[0].id));
      dit(!!s && s.etat === 'arrete' && /Publier/.test(s.raison) && pL.n === 0 && !(B.store.vrmAussiFaits || {})['leboncoin:' + NUMS[9]], 'S1 — « Publier » introuvable (renommé) : arrêt AVANT, nommé, 0 publication, rien de noté', JSON.stringify({ s, n: pL.n }));
      await B.fermer();
    }
    // ── Captures 1512 ──
    if (SHOTS && fait('N1')) {
      const B = await scenario(nav, { vue: { width: 1512, height: 900 } });
      await B.lancer({ ids: [IDS[11]], sites: ['leboncoin'] });
      await B.finJob();
      await shot(B.pages.get(B.ouverts[0].id), '1512-leboncoin-publiee');
      await B.fermer();
    }
  } catch (e) { ko++; console.log('❌ le banc a levé : ' + (e && e.stack || e)); }
  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} banc publier-aussi : ${okN} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
