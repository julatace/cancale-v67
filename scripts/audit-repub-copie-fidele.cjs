// ════════════════════════════════════════════════════════════════════════════
//  REPUBLIER = COPIER-COLLER L'ANNONCE EN LIGNE, SAUF LES PHOTOS (20 nov., ext. 5.410 — `repubfidele`)
//
//  Julien : « normalement, vu que c'est déjà en ligne, c'est juste du copier-coller sauf les photos ».
//  Mesuré (vraie base, lecture seule, 20 nov.) : 9 brouillons créés par VRM, 8 bâtis SANS le corps du
//  formulaire de l'annonce d'origine (7 champs repris, isbn / mesures / fabricant forcés à null) ; les
//  63 corps du formulaire « Modifier » de Vinted rangés chez lui : 13 portent une matière, 34 deux couleurs.
//
//  On EXÉCUTE le vrai background.js (scripts/_fond-vm.cjs) contre un faux Vinted de la forme de Vinted
//  (`GET item_upload/items/{id}` = le formulaire de l'annonce ; données inventées, dépôt public) :
//    F1  le brouillon envoyé = l'annonce d'origine, CHAMP PAR CHAMP (hors photos ; titre et prix de l'atelier)
//    F2  une recette rangée plus ancienne ne gagne jamais sur ce que Vinted sert maintenant
//    F3  les photos sont celles du coffre, renvoyées (jamais celles de l'ancienne)
//    F4  la mise en ligne garde chaque champ (et reprend ce que Vinted a rangé dans le brouillon)
//    F5  la trace dit les NOMS des champs copiés, écartés (inconnus de VRM) et différents — jamais une valeur
//    F6  l'ordre reste coffre → brouillon → suppression → mise en ligne
//  `--prouve` : rouge sur origin/main ET par mutation (un champ oublié, recette non posée, relecture ignorée).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const argSrc = (() => { const i = process.argv.indexOf('--bg'); return i > 0 ? process.argv[i + 1] : process.env.BG_SRC || ''; })();
const BG = argSrc || path.join(RACINE, 'vinted-sync-extension', 'background.js');
let ok = 0, ko = 0; const rouges = [];
const dit = (c, msg, det) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + msg); } else { ko++; rouges.push(msg); if (!process.env.SILENCE) console.log('❌ ' + msg + (det ? '  → ' + det : '')); } };
const nowISO = () => new Date().toISOString();
const PHOTOS = ['https://images1.vinted.net/t/01_0121e_testAAAA0001/f800/1.jpeg', 'https://images1.vinted.net/t/02_02248_testBBBB0002/f800/2.jpeg'];
// Le formulaire de l'annonce EN LIGNE, de la forme que sert Vinted (clés mesurées sur ses 63 corps).
const ORIGINE = () => ({ id: 9101, title: 'Basket test 42', description: 'Très bon état, boîte, lacets neufs', price: { amount: '60.0', currency_code: 'EUR' }, currency: 'EUR',
  catalog_id: 2050, brand_id: 53, brand: 'Marque test', color_ids: [1, 12], item_attributes: [{ code: 'size', ids: [791] }, { code: 'condition', ids: [2] }, { code: 'material', ids: [44] }],
  package_size_id: 2, is_unisex: true, isbn: null, imei: null, measurement_length: 30, measurement_width: 20, manufacturer: 'Fabricant test', manufacturer_labelling: 'Étiquette test',
  shipment_prices: { domestic: null, international: null }, video_game_rating_id: null, ai_photo: false, is_draft: false, zz_champ_neuf: 'inconnu',
  photos: [{ id: 3001, url: 'https://images1.vinted.net/t/zz/f800/ancienne.jpeg' }] });
const CHAMPS = ['description', 'currency', 'catalog_id', 'brand_id', 'brand', 'color_ids', 'item_attributes', 'package_size_id', 'is_unisex', 'isbn', 'imei', 'measurement_length', 'measurement_width', 'manufacturer', 'manufacturer_labelling', 'shipment_prices', 'video_game_rating_id'];
// Une recette rangée PLUS ANCIENNE (avant qu'il change la taille et ajoute la matière).
const MODELE_ANCIEN = JSON.stringify({ item: { id: 9101, title: 'Basket test 42', description: 'Très bon état, boîte, lacets neufs', price: '60.0', currency: 'EUR', catalog_id: 2050, brand_id: 53, brand: 'Marque test', color_ids: [1], item_attributes: [{ code: 'size', ids: [790] }, { code: 'condition', ids: [3] }], package_size_id: 1, isbn: null, measurement_length: null, measurement_width: null, manufacturer: null, manufacturer_labelling: null, assigned_photos: [{ id: 1 }] } });

function monter(o = {}) {
  const v = { ancienne: 'en-ligne', brouillon: 'brouillon', nPhotos: 500 };
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '41' } } }, vinted_item_details: {}, vrm_vinted_modele: o.modele ? { '9101': { corps: MODELE_ANCIEN, at: nowISO(), uid: '111' } } : {} };
  lignes.coffre_111_9101 = { id: '9101', uid: '111', title: 'Basket test 42', price: 60, desc: 'Très bon état, boîte, lacets neufs', photos: PHOTOS };
  const fond = faireFond({ src: o.src || BG, lignes, connecte: '111', store: {}, cdn: () => ({ status: 200 }),
    vinted: (e) => {
      if (e.methode === 'GET' && /\/item_upload\/(colors)$/.test(e.chemin)) return { status: 404, body: {} };
      if (e.methode === 'POST' && /\/item_upload\/attributes$/.test(e.chemin)) return { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin)) return v.ancienne === 'en-ligne' ? { status: 200, body: { item: (o.simple || (fond && fond.ctx && fond.ctx.__origine)) ? SIMPLE() : ORIGINE() } } : { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/88001$/.test(e.chemin)) {
        // Le brouillon tel que Vinted l'a RANGÉ (il a normalisé une mesure : 30 → 31).
        const d = { ...JSON.parse(fond.dernierBrouillon || '{}'), id: 88001, is_draft: v.brouillon !== 'en-ligne', photos: [{ id: 701, orientation: 0 }, { id: 702, orientation: 0 }] };
        delete d.assigned_photos; if (o.normalise) d.measurement_length = 31;
        return { status: 200, body: { item: d } };
      }
      if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: 200, body: { id: ++v.nPhotos } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) { try { fond.dernierBrouillon = JSON.stringify(JSON.parse(e.corps).draft); } catch (_) {} return { status: 200, body: { draft: { id: 88001 } } }; }
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/\d+\/completion$/.test(e.chemin)) { v.brouillon = 'en-ligne'; return { status: 200, body: { item: { id: 88001 } } }; }
      if (e.methode === 'POST' && /\/api\/v2\/items\/9101\/delete$/.test(e.chemin)) { v.ancienne = 'partie'; return { status: 200, body: {} }; }
      return { status: 404, body: {} };
    } });
  return fond;
}
const LECT = /\/item_upload\/(colors|attributes)$/;
const seq = (j) => j.vinted.filter((x) => !LECT.test(x.chemin)).map((x) => x.methode === 'GET' && /items\/9101$/.test(x.chemin) ? 'A' : x.methode === 'GET' && /items\/88001$/.test(x.chemin) ? 'L' : /photos$/.test(x.chemin) ? 'P' : /completion$/.test(x.chemin) ? 'M' : /drafts\/?$/.test(x.chemin) ? 'B' : /delete$/.test(x.chemin) ? 'S' : '?').join('');
const corpsDe = (f, re) => { const e = f.j.vinted.filter((x) => x.methode === 'POST' && re.test(x.chemin)).pop(); try { return e ? JSON.parse(e.corps) : null; } catch (_) { return null; } };
const recreer = (f) => f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', num: '41', prix: 60, titre: 'Basket test 42', viaBrouillon: true, differer: true, confirme: true }).catch((e) => ({ erreur: String(e && e.message) }));
const echeance = (f) => { const a = f.store.vrmRepubAttente || {}; for (const k of Object.keys(a)) a[k].du = 0; };
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ecartsChamps = (d, o) => CHAMPS.filter((k) => !egal(d && d[k], o[k]));

// ⚠️ 5.414 (`toutinterface`, Julien, 21 nov. : « on ne fait plus les requêtes ») : la republication passe par le
//    FORMULAIRE de Vinted (seule méthode). Le formulaire rempli par VRM pose catégorie, titre, description, marque, taille,
//    état, couleurs, colis, unisexe, prix ; un champ qu'il ne sait pas (encore) poser (matière, mesures, fabricant, ISBN…)
//    ne se PERD jamais : la republication est refusée AVANT tout geste, le champ nommé.
//    G1  une annonce qui porte matière / mesures / fabricant ⇒ refusée avant tout geste, chaque champ nommé, rien n'est écrit
//    G2  une annonce aux seuls champs du formulaire ⇒ le brouillon envoyé par la PAGE = l'annonce, champ par champ
//    G3  une recette rangée plus ancienne ne gagne jamais sur ce que Vinted sert maintenant
//    G4  les photos sont celles du coffre (jamais l'identifiant d'une photo de l'ancienne)
//    G5  l'ordre : lecture, photos, brouillon, PUIS suppression, puis mise en ligne (tout par la page)
const SIMPLE = () => { const o = ORIGINE(); o.item_attributes = o.item_attributes.filter((a) => a.code !== 'material'); o.measurement_length = null; o.measurement_width = null; o.manufacturer = null; o.manufacturer_labelling = null; return o; };
const CHAMPS_F = ['catalog_id', 'brand_id', 'color_ids', 'package_size_id', 'is_unisex'];
const attrs = (d) => JSON.stringify([...((d && d.item_attributes) || [])].filter((a) => ['size', 'condition'].includes(a.code)).sort((x, y) => String(x.code).localeCompare(String(y.code))));
async function auditer() {
  // G1
  { const f = monter(); const r = await recreer(f);
    const ecr = f.j.vinted.filter((x) => x.methode !== 'GET');
    dit(r && r.accepte === false && r.code === 'champ-hors-formulaire' && ['la matière', 'des mesures', 'le fabricant'].every((n) => (r.champs || []).includes(n)) && !ecr.length && !(f.j.etapesPage || []).some((x) => x.etape !== 'etat'),
      "G1 — matière, mesures, fabricant (que le formulaire ne pose pas encore) : refusée AVANT tout geste, chaque champ nommé, rien n'est écrit", JSON.stringify({ code: r && r.code, champs: r && r.champs, ecr: ecr.length })); }
  // G2, G4, G5
  { const f = monter(); f.ctx.__origine = SIMPLE;
    const O = SIMPLE();
    const r = await (async () => { const v0 = f.lignes; void v0; return recreer(f); })();
    const b = corpsDe(f, /\/item_upload\/drafts\/?$/), d = b && b.draft;
    const ec = CHAMPS_F.filter((k) => !egal(d && d[k], O[k]));
    dit(d && !ec.length && attrs(d) === attrs(O) && d.description === O.description, "G2 — aux seuls champs du formulaire : le brouillon écrit par la PAGE = l'annonce (catégorie, marque, 2 couleurs, taille, état, colis, unisexe, description)", `etape=${r && r.etape} ${(r && (r.raison || r.erreur)) || ''} écarts=${ec.join(',')} ${attrs(d)}`);
    dit(d && d.title === 'Basket test 42' && String(d.price) === '60', "G2b — titre et prix : ceux de l'atelier (son choix)", d && `${d.title} ${d.price}`);
    const ph = d && Array.isArray(d.assigned_photos) ? d.assigned_photos.map((p) => p.id) : [];
    dit(ph.length === 2 && ph.every((x) => x > 500) && !ph.includes(3001), "G4 — les photos sont celles du coffre, déposées dans le formulaire (jamais l'identifiant d'une photo de l'ancienne)", JSON.stringify(ph));
    const s2 = seq(f.j);
    dit(/^AP+BSM$/.test(s2) && f.j.vinted.filter((x) => x.methode !== 'GET').every((x) => x.origine === 'page'), "G5 — l'ordre : lecture, photos, brouillon, PUIS suppression, puis mise en ligne (tout par la page)", s2); }
  // G3
  { const f = monter({ modele: true, simple: true }); const O = SIMPLE(); const r = await recreer(f);
    const d = (corpsDe(f, /\/item_upload\/drafts\/?$/) || {}).draft;
    const ec = CHAMPS_F.filter((k) => !egal(d && d[k], O[k]));
    dit(d && !ec.length && attrs(d) === attrs(O), "G3 — la recette rangée plus ancienne cède à ce que Vinted sert MAINTENANT (taille, état, couleurs, colis)", `etape=${r && r.etape} ${(r && r.raison) || ''} écarts=${ec.join(',')}`); }
}

function sh(c) { return cp.execSync(c, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }); }
function lancerSur(src) {
  try { sh(`SILENCE=1 node ${JSON.stringify(__filename)} --bg ${JSON.stringify(src)}`); return 'vert'; } catch (e) { return 'rouge'; }
}
async function prouver() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fidele-'));
  const base = fs.readFileSync(BG, 'utf8');
  const res = [];
  try { fs.writeFileSync(path.join(dir, 'main.js'), sh('git show origin/main:vinted-sync-extension/background.js')); res.push(['origin/main (avant)', lancerSur(path.join(dir, 'main.js'))]); } catch (e) { res.push(['origin/main', 'illisible']); }
  // 5.414 : les mutations du chemin par le formulaire (la méthode directe est retirée).
  const mutations = [
    ['champs hors formulaire ignorés', (s) => s.replace('  if (horsF.length) {', '  if (false) {')],
    ['unisexe oublié', (s) => s.replace("    ...(item && item.is_unisex === true ? [['unisexe', { valeur: true }]] : []),\n", '')],
    ['marque oubliée', (s) => s.replace("    ...(attendu.marque ? [['marque', { id: attendu.marqueId, nom: attendu.marque }]] : []),\n    ...(attendu.taille ? [['taille', { id: attendu.taille }]] : []),\n    ['couleurs'", "    ...(attendu.taille ? [['taille', { id: attendu.taille }]] : []),\n    ['couleurs'")],
  ];
  for (const [nom, f] of mutations) {
    const m = f(base);
    if (m === base) { res.push([nom, 'mutation non appliquée']); continue; }
    const p = path.join(dir, 'm.js'); fs.writeFileSync(p, m); res.push([nom, lancerSur(p)]);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  let bon = true;
  for (const [nom, r] of res) { const attendu = r === 'rouge'; if (!attendu) bon = false; console.log(`${attendu ? '✅' : '❌'} --prouve · ${nom} : ${r}`); }
  console.log(bon ? `✅ --prouve : ${res.length}/${res.length} rouges` : '❌ --prouve : une version affaiblie passe encore');
  process.exit(bon ? 0 : 1);
}
(async () => {
  if (process.argv.includes('--prouve')) return prouver();
  await auditer();
  console.log(`\n${ko ? '❌' : '✅'} audit-repub-copie-fidele : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
