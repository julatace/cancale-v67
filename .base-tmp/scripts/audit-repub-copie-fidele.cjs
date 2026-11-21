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
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin)) return v.ancienne === 'en-ligne' ? { status: 200, body: { item: ORIGINE() } } : { status: 404, body: {} };
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

async function auditer() {
  const O = ORIGINE();
  // F1 / F3 / F5 / F6 — sans recette rangée (le cas de 8 brouillons sur 9)
  { const f = monter(); const r = await recreer(f);
    const b = corpsDe(f, /\/item_upload\/drafts\/?$/), d = b && b.draft;
    const ec = ecartsChamps(d, O);
    dit(d && !ec.length, "F1 — le brouillon envoyé = l'annonce en ligne, champ par champ (catégorie, marque, 2 couleurs, taille + état + MATIÈRE, colis, unisexe, mesures, fabricant, étiquetage, ISBN, IMEI, envoi)", `etape=${r.etape} ${r.raison || r.erreur || ''} écarts=${ec.map((k) => k + ':' + JSON.stringify(d && d[k]) + '≠' + JSON.stringify(O[k])).join(' ; ')}`);
    dit(d && d.title === 'Basket test 42' && String(d.price) === '60', "F1b — titre et prix : ceux de l'atelier (son choix)", d && `${d.title} ${d.price}`);
    const ph = d && Array.isArray(d.assigned_photos) ? d.assigned_photos.map((p) => p.id) : [];
    dit(ph.length === 2 && ph.every((x) => x > 500) && !ph.includes(3001), "F3 — les photos sont celles du coffre, renvoyées (jamais l'identifiant d'une photo de l'ancienne)", JSON.stringify(ph));
    dit(d && !('zz_champ_neuf' in d) && !('is_draft' in d) && !('photos' in d), "F5a — un champ que VRM ne connaît pas n'est jamais inventé dans le corps", d && Object.keys(d).join(','));
    const tr = (f.store.vrmTraceRepub || []).find((x) => x.quoi === 'brouillon');
    const fi = tr && tr.req && tr.req.fidele;
    dit(fi && fi.copies.includes('measurement_length') && fi.copies.includes('item_attributes') && egal(fi.ecartes, ['zz_champ_neuf']) && egal(fi.differents, []), "F5b — la trace dit les NOMS : champs copiés, écartés (zz_champ_neuf), différents (aucun)", JSON.stringify(fi));
    const brut = JSON.stringify(f.store.vrmTraceRepub || []);
    dit(!/Fabricant test|Étiquette test|Basket test|lacets/.test(brut), "F5c — aucune valeur dans la trace (ni fabricant, ni titre, ni description)", brut.slice(0, 200));
    echeance(f); try { await f.ctx.miseEnLigneTick(); } catch (_) {}
    const m = corpsDe(f, /\/completion$/), dm = m && m.draft;
    const ecm = ecartsChamps(dm, O);
    dit(dm && !ecm.length, "F4 — la mise en ligne garde chaque champ de l'origine", `écarts=${ecm.join(',')} seq=${seq(f.j)}`);
    const s = seq(f.j);
    dit(/^AP+BSLM$/.test(s), "F6 — l'ordre : lecture, photos, brouillon, PUIS suppression, puis mise en ligne (jamais inversé)", s); }
  // F2 — une recette rangée plus ancienne (autre taille, état, une couleur, sans matière ni mesures) ne gagne jamais
  { const f = monter({ modele: true }); const r = await recreer(f);
    const d = (corpsDe(f, /\/item_upload\/drafts\/?$/) || {}).draft;
    const ec = ecartsChamps(d, O);
    dit(d && !ec.length, "F2 — la recette rangée plus ancienne cède à ce que Vinted sert MAINTENANT (taille, état, matière, couleurs, colis, mesures)", `etape=${r.etape} ${r.raison || ''} écarts=${ec.join(',')}`); }
  // F4b — ce que Vinted a RANGÉ dans le brouillon (mesure normalisée) part à la mise en ligne
  { const f = monter({ normalise: true }); await recreer(f); echeance(f); try { await f.ctx.miseEnLigneTick(); } catch (_) {}
    const dm = (corpsDe(f, /\/completion$/) || {}).draft;
    dit(dm && dm.measurement_length === 31 && egal(dm.item_attributes, O.item_attributes), "F4b — la mise en ligne reprend le brouillon tel que Vinted l'a rangé (mesure 31), sans rien perdre", dm && JSON.stringify({ l: dm.measurement_length, a: dm.item_attributes })); }
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
  const mutations = [
    ['un champ oublié (mesures)', (s) => s.replace("'imei', 'measurement_length', 'measurement_width', ", "'imei', 'measurement_width', ")],
    ['un champ oublié (fabricant)', (s) => s.replace("'manufacturer', 'manufacturer_labelling', ", "'manufacturer_labelling', ")],
    ['recette jamais posée', (s) => s.replace('  if (recette && recette.recette) poserRecetteFidele(base, recette);\n', '')],
    ['recette pas transmise', (s) => s.split('codes: details.codes, vivant, recette, titre').join('codes: details.codes, vivant, titre')],
    ['relecture du brouillon ignorée', (s) => s.replace('    poserRecetteFidele(d, recetteFidele(it), true);\n', '')],
    ['envoi forcé (secours écrasé)', (s) => s.replace("shipment_prices: (recette && recette.recette && recette.recette.shipment_prices && typeof recette.recette.shipment_prices === 'object') ? { ...recette.recette.shipment_prices } : { domestic: null, international: null } };", "shipment_prices: { domestic: 0 } };")],
    ['ordre inversé (suppression avant brouillon)', (s) => s.replace("const rbV = await vintedPage(acc, 'POST', '/api/v2/item_upload/drafts', corpsBV, { timeoutMs: 60000 });", "await vintedPage(acc, 'POST', `/api/v2/items/${id}/delete`, null, { timeoutMs: 60000 }); const rbV = await vintedPage(acc, 'POST', '/api/v2/item_upload/drafts', corpsBV, { timeoutMs: 60000 });")],
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
