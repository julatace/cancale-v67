#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE L'EXTENSION 5.429 (21 nov., choix de Julien — points 61 à 64)
//
//  Exécute le VRAI vinted-sync-extension/background.js dans un `vm` (scripts/_fond-vm.cjs : fausse base à état,
//  faux Vinted qui compte chaque requête, fausse page de dépôt qui envoie ce que la vraie page enverrait) et les
//  VRAIES règles de l'app (src/depot/regles.js, src/boostPeriode.js). Rien de réel : fiches et photos inventées.
//
//   D  Brouillons préparés : « Déposer N » (deux fiches, mode brouillon) ⇒ une fiche à la fois, chacune UN brouillon
//      par le formulaire, la couverture envoyée en 1re, l'ordre relu, le N° de la fiche LIÉ à l'identifiant rendu, la
//      frise datée sur chaque preuve ; jamais deux dépôts d'une fiche (relancer, fiche reliée par l'app, N° réservé par
//      une annonce qui porte la fiche) ; « Publier » refusé au lancement quand un champ manque (nommé) ; ordre faux ⇒
//      brouillon rangé, arrêt AVANT « Publier » ; tout bon ⇒ la mise en ligne (« Ajouter ») ; un arrêt de compte
//      (pas d'onglet) arrête le lot.
//   O  L'ordre des photos (règle pure) : couverture en 1re, ordre gardé ; relu par identité (nom ↔ identifiant) ;
//      « pas su » ne vaut jamais « bon ».
//   M  Descriptions types : le modèle le plus précis (modèle > marque > défaut), jamais tiré du titre ; une variable
//      sans valeur reste écrite et BLOQUE le dépôt ; la pointure EU jamais convertie.
//   B  Boost rentable ou pas : verdict honnête — sous le seuil de données, « pas assez de données » (jamais un verdict) ;
//      vente prouvée pendant le boost ⇒ « a servi » ; les semblables boostées sur les mêmes jours ne comptent pas ;
//      le relevé journalier rangé par l'extension (une lecture ratée n'écrit rien ; pas plus d'une écriture / 6 h).
//
//  `--prouve` : chaque garde réaffaiblie (copie mutée) ⇒ rouge, et l'arbre d'avant (origin/main) ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const R = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SRC_BG = arg('--src') || path.join(R, 'vinted-sync-extension', 'background.js');
const SRC_REGLES = arg('--regles') || path.join(R, 'src', 'depot', 'regles.js');
const SRC_BOOST = arg('--boost') || path.join(R, 'src', 'boostPeriode.js');
const SILENCE = !!process.env.SILENCE;
let ok = 0, ko = 0;
const dit = (c, msg, det) => { if (c) { ok++; if (!SILENCE) console.log('✅ ' + msg); } else { ko++; if (!SILENCE) console.log('❌ ' + msg + (det !== undefined ? '  → ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : '')); } };
const nowISO = () => new Date().toISOString();
const b64 = (s) => Buffer.from('JPEGBANC' + s).toString('base64');
const jpeg = (s) => 'data:image/jpeg;base64,' + b64(s);
const CATALOGUE = { catalogs: [{ id: 5, title: 'Hommes', catalogs: [{ id: 6, title: 'Chaussures', catalogs: [{ id: 1242, title: 'Baskets' }] }] }] };
const GRILLE = { status: 200, body: { attributes: [
  { code: 'size', configuration: { options: [{ id: 56, title: '42' }, { id: 57, title: '43' }] } },
  { code: 'condition', configuration: { options: [{ id: 2, title: 'Très bon état' }, { id: 3, title: 'Bon état' }] } },
] } };
const COULEURS = { status: 200, body: { colors: [{ id: 1, title: 'Noir' }, { id: 12, title: 'Blanc' }, { id: 3, title: 'Gris' }] } };
const RECETTE = JSON.stringify({ item: { id: 9101, catalog_id: 1242, brand_id: 53, brand: 'Nike', color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }], package_size_id: 1 } });
const FICHE = (id, numero, o = {}) => ({ id, numero, titre: `Nike Air Max 90 blanches N°${numero}`, description: `Très bon état, portées deux fois.\n\nN°${numero}`, prix: 65, marque: 'Nike', modele: 'Air Max 90',
  taille: '42', etat: 'Très bon état', couleur: 'Blanc', categorie: 'Hommes > Chaussures > Baskets', colis: 'petit', creeAt: nowISO(),
  depot: { photos: [`sp${numero}a`, `sp${numero}b`, `sp${numero}c`], couverture: `sp${numero}c`, prepareeAt: nowISO() }, ...o });
const STUDIO = (numero) => ({ numero, photos: ['a', 'b', 'c'].map((k) => ({ id: `sp${numero}${k}`, img: jpeg(numero + k), at: nowISO() })) });
const SENDER = { tab: { id: 7, url: 'https://www.vinted.fr/member/111' } };

function monter({ src = SRC_BG, fiches, extra = null, page = null, onglets, lectureKO } = {}) {
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '12' } }, vrm_fiches_neuves: fiches || { f41: FICHE('f41', '41'), f42: FICHE('f42', '42') } },
    vinted_catalogue: { corps: JSON.stringify(CATALOGUE) }, vrm_vinted_modele: { '9101': { corps: RECETTE, uid: '111', at: nowISO() } }, panel_num_reserves: { attente: {}, items: {} },
    studio_photos_41: STUDIO('41'), studio_photos_42: STUDIO('42') };
  if (extra) Object.assign(lignes, extra);
  let n = 500, d = 88000;
  const o = { src, lignes, connecte: '111', lectureKO: lectureKO || (() => false), vinted: (e) => {
    if (e.methode === 'GET' && /\/api\/v2\/item_upload\/colors$/.test(e.chemin)) return COULEURS;
    if (e.methode === 'POST' && /\/api\/v2\/item_upload\/attributes$/.test(e.chemin)) return GRILLE;
    if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: 200, body: { id: ++n } };
    if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: 200, body: { draft: { id: ++d } } };
    const g = /\/api\/v2\/item_upload\/items\/(\d+)$/.exec(e.chemin);
    if (e.methode === 'GET' && g) return { status: 200, body: { item: { id: Number(g[1]), title: 'Nike Air Max 90 blanches', price: { amount: '65.0' }, description: 'Très bon état, portées deux fois.', catalog_id: 1242, brand_id: 53, brand: 'Nike', color_ids: [12], package_size_id: 1, item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], photos: [{ id: 501 }, { id: 502 }, { id: 503 }], is_draft: true } } };
    if (e.methode === 'POST' && /\/completion$/.test(e.chemin)) { const m = /drafts\/(\d+)\/completion/.exec(e.chemin); return { status: 200, body: { item: { id: Number(m[1]) } } }; }
    return { status: 404, body: {} };
  } };
  if (onglets) o.onglets = onglets;
  const f = faireFond(o);
  if (page) f.ctx.__vrmPage = page;
  return f;
}
const LECTURE = /\/item_upload\/(colors|attributes)$/;
const gestes = (j) => j.vinted.filter((v) => !LECTURE.test(v.chemin) && v.methode !== 'GET');
const seq = (j) => gestes(j).map((v) => /photos$/.test(v.chemin) ? 'P' : /drafts\/?$/.test(v.chemin) ? 'B' : /completion$/.test(v.chemin) ? 'M' : /delete$/.test(v.chemin) ? 'S' : '?').join('');
const lot = (f) => (f.store.vrmDepotLot || null);
async function tourner(f, n = 3000) { for (let i = 0; i < n; i++) { const l = lot(f); if (!l || l.etat !== 'cours') break; const r = await f.ctx.depotTick(Date.now() + 1e10); if (r && r.etat === 'en-vol') await new Promise((ok) => setTimeout(ok, 5)); } return lot(f); }

async function partieD(MD) {
  // D1 — deux fiches, mode brouillon.
  { const f = monter();
    if (typeof f.ctx.depotLancer !== 'function') { dit(false, 'D1 « Déposer N » existe dans l’extension (depotLancer)', 'absente'); return; }
    const liste = await f.ctx.depotFichesCarte({}, SENDER);
    dit(liste.ok && liste.fiches.length === 2 && liste.fiches.every((x) => x.prepare && !x.manquePublier.length && x.nPhotos === 3) && !JSON.stringify(liste).includes('"fiche":'), 'D0 le panneau lit les fiches PRÉPARÉES (prêtes, 3 photos, rien ne manque), sans le corps des fiches', liste);
    const r0 = await f.ctx.depotLancer({ ids: ['f41', 'f42'], mode: 'brouillon' }, SENDER);
    dit(r0.ok === false && r0.code === 'confirmation' && gestes(f.j).length === 0, 'D1a sans SON toucher « Confirmer » : rien ne part', r0);
    const r = await f.ctx.depotLancer({ ids: ['f41', 'f42'], mode: 'brouillon', confirme: true }, SENDER);
    const l = await tourner(f);
    const fi = l && l.fiches;
    dit(r.ok && l.etat === 'finie' && fi.f41.etape === 'fait' && fi.f42.etape === 'fait' && seq(f.j) === 'PPPBPPPB', 'D1 deux fiches, une à la fois : 3 photos puis UN brouillon chacune, rien d’autre (ni mise en ligne, ni suppression)', { etat: l && l.etat, s: seq(f.j), fi });
    const pp = f.j.photosPage || [];
    dit(pp.length === 2 && pp[0][0] === b64('41c') && pp[0][1] === b64('41a') && pp[0][2] === b64('41b'), 'D2 la couverture (étoile : photo c) est déposée EN 1re, les autres gardent SON ordre (a, b)', pp);
    dit(fi.f41.ordre === 'ok' && fi.f41.preuves.ordre && fi.f41.preuves.photos && fi.f41.preuves.formulaire && fi.f41.preuves.brouillon && fi.f41.preuves.numero && !fi.f41.preuves.enLigne, 'D3 la frise : photos · formulaire · brouillon relu · ordre relu · N° — chacune datée sur SA preuve, « en ligne » NON (mode brouillon)', fi.f41);
    const it = (f.lignes.panel_num_reserves || {}).items || {};
    dit(it[fi.f41.draftId] && it[fi.f41.draftId].numero === '41' && it[fi.f41.draftId].fiche === 'f41' && it[fi.f42.draftId] && it[fi.f42.draftId].numero === '42' && fi.f41.draftId !== fi.f42.draftId, 'D4 le N° de CHAQUE fiche est LIÉ à l’identifiant que Vinted a rendu pour SON brouillon', it);
    const corps = gestes(f.j).filter((v) => /drafts\/?$/.test(v.chemin)).map((v) => JSON.parse(v.corps).draft);
    dit(corps[0].package_size_id === 1 && JSON.stringify(corps[0].color_ids) === '[12]' && corps[0].catalog_id === 1242 && corps[0].brand_id === 53, 'D5 le colis (petit ⇒ 1), la couleur, la catégorie et la marque préparés sont posés dans le formulaire', corps[0]);
    dit(Array.isArray(fi.f41.bilan) && fi.f41.bilan.length === 10 && fi.f41.bilan.every((b) => b.etat === 'ok') && fi.f41.bilan.find((b) => b.k === 'prix').apres === '65', 'D6 l’avant / après : chaque champ de la fiche contre ce que la page a relu (tous « pareil », prix relu 65)', fi.f41.bilan);
    // D7 jamais deux dépôts : relancer les mêmes fiches.
    const n0 = gestes(f.j).length;
    const r2 = await f.ctx.depotLancer({ ids: ['f41'], mode: 'brouillon', confirme: true }, SENDER);
    const r3 = await f.ctx.creerVintedFiche({ cmd: 'creerVintedFiche', uid: '111', confirme: true, fiche: MD.payloadDepot(FICHE('f41', '41'), STUDIO('41').photos) });
    dit(r2.ok === false && r2.code === 'pas-pretes' && /déjà déposée/.test(JSON.stringify(r2.pas)) && r3.accepte === false && r3.code === 'deja' && gestes(f.j).length === n0, 'D7 relancer une fiche déposée : refusé au lancement ET au formulaire (« déjà »), aucune requête', { r2, r3 });
  }
  // D8 jamais deux dépôts — par les AUTRES identités (une autre installation, l'app) : sans brouillon rangé ici.
  { const fiches = { f41: FICHE('f41', '41', { vinted: { draftId: '77001' } }) };
    const f = monter({ fiches });
    const r = await f.ctx.creerVintedFiche({ cmd: 'creerVintedFiche', uid: '111', confirme: true, fiche: MD.payloadDepot(fiches.f41, STUDIO('41').photos) });
    dit(r.accepte === false && r.code === 'deja' && r.draftId === '77001' && gestes(f.j).length === 0, 'D8 la fiche est déjà reliée par l’app (vinted.draftId) : rien ne part', r);
    const f2 = monter({ extra: { panel_num_reserves: { attente: {}, items: { '77002': { numero: '41', fiche: 'f41', uid: '111', at: nowISO() } } } } });
    const r2 = await f2.ctx.creerVintedFiche({ cmd: 'creerVintedFiche', uid: '111', confirme: true, fiche: MD.payloadDepot(FICHE('f41', '41'), STUDIO('41').photos) });
    dit(r2.accepte === false && r2.code === 'deja' && gestes(f2.j).length === 0, 'D8b une annonce Vinted porte déjà CETTE fiche (réservation du N°) : rien ne part', r2); }
  // D9 « Publier » : un champ manque ⇒ refusé au lancement, nommé ; en brouillon il part (le manque dit « à finir »).
  { const fiches = { f41: FICHE('f41', '41', { colis: '' }) };
    const f = monter({ fiches });
    const r = await f.ctx.depotLancer({ ids: ['f41'], mode: 'publier', confirme: true }, SENDER);
    dit(r.ok === false && r.code === 'pas-pretes' && /le colis/.test(JSON.stringify(r.pas)) && gestes(f.j).length === 0, 'D9 « Publier » avec le colis manquant : refusé AVANT tout geste, le champ nommé', r);
    const rb = await f.ctx.depotLancer({ ids: ['f41'], mode: 'brouillon', confirme: true }, SENDER); const l = await tourner(f);
    dit(rb.ok && l.fiches.f41.etape === 'fait' && (l.fiches.f41.aFinir || []).includes('la taille du colis') && l.fiches.f41.bilan.find((b) => b.k === 'colis').etat === 'a-finir', 'D9b en brouillon, la même fiche part ; le colis est dit « à finir sur Vinted »', l.fiches.f41); }
  // D10 « Publier » : l'ordre des photos relu FAUX ⇒ brouillon rangé, arrêt AVANT « Publier » (aucune mise en ligne).
  { const f = monter({ fiches: { f41: FICHE('f41', '41') }, page: { ordreMelange: true } });
    await f.ctx.depotLancer({ ids: ['f41'], mode: 'publier', confirme: true }, SENDER); const l = await tourner(f);
    const fi = l.fiches.f41;
    dit(fi.etape === 'brouillon-arret' && fi.ordre === 'faux' && /ordre des photos/.test(fi.raison || '') && !/M/.test(seq(f.j)) && /B$/.test(seq(f.j)), 'D10 « Publier » + ordre relu faux : le brouillon reste, VRM s’arrête AVANT « Publier » et le dit', { fi, s: seq(f.j) }); }
  // D11 « Publier », tout bon ⇒ « Ajouter » (la mise en ligne par la page), la frise va jusqu'à « En ligne ».
  { const f = monter({ fiches: { f41: FICHE('f41', '41') } });
    await f.ctx.depotLancer({ ids: ['f41'], mode: 'publier', confirme: true }, SENDER); const l = await tourner(f);
    const fi = l.fiches.f41;
    dit(fi.etape === 'fait' && fi.enLigne === true && fi.preuves.enLigne && seq(f.j) === 'PPPBM', 'D11 « Publier », rien ne manque : brouillon relu puis « Ajouter » (UNE mise en ligne), « En ligne » daté', { fi, s: seq(f.j) }); }
  // D12 la page n'a pas rendu les noms des fichiers : ordre « pas su » — jamais « bon », dit.
  { const f = monter({ fiches: { f41: FICHE('f41', '41') }, page: { sansNoms: true } });
    await f.ctx.depotLancer({ ids: ['f41'], mode: 'brouillon', confirme: true }, SENDER); const l = await tourner(f);
    dit(l.fiches.f41.ordre === 'pas-su' && !l.fiches.f41.preuves.ordre, 'D12 noms de fichiers absents : l’ordre est « pas relu » (aucune preuve posée), jamais « bon »', l.fiches.f41); }
  // D13 un arrêt de COMPTE arrête le lot (pas d'onglet vinted.fr : rien ne part, la 2e fiche n'est pas tentée).
  { const f = monter({ onglets: [] });
    const r = await f.ctx.depotLancer({ ids: ['f41', 'f42'], mode: 'brouillon', confirme: true }, SENDER); const l = await tourner(f);
    dit(r.ok && l.etat === 'arretee' && l.fiches.f42.etape === 'attente' && gestes(f.j).length === 0, 'D13 sans onglet vinted.fr : le lot s’arrête à la 1re fiche, la suivante n’est pas tentée, rien ne part', { l, n: gestes(f.j).length }); }
  // D14 la base ne répond pas pour les fiches : rien n'est proposé, rien ne part.
  { const f = monter({ lectureKO: (u) => /vinted_brouillon_/.test(u) });
    const l = await f.ctx.depotFichesCarte({}, SENDER); const r = await f.ctx.depotLancer({ ids: ['f41'], mode: 'brouillon', confirme: true }, SENDER);
    dit(l.ok === false && l.code === 'lecture' && r.ok === false && r.code === 'lecture' && gestes(f.j).length === 0, 'D14 lecture ratée : « pas su », rien n’est proposé ni envoyé', { l, r }); }
}

async function partieO(M) {
  dit(JSON.stringify(M.ordrePhotos(['a', 'b', 'c'], 'c')) === '["c","a","b"]' && JSON.stringify(M.ordrePhotos(['a', 'b', 'a'], 'z')) === '["a","b"]', 'O1 la couverture passe en 1re, les autres gardent leur ordre (une étoile absente ne change rien)', M.ordrePhotos(['a', 'b', 'c'], 'c'));
  const st = [{ id: 'a', img: jpeg('a') }, { id: 'b', img: jpeg('b') }];
  const p = M.photosDepot({ depot: { photos: ['b', 'x'], couverture: 'b' } }, st);
  dit(p.erreur && !p.photos.length, 'O2 une photo de SON ordre absente du studio : erreur nommée, jamais une autre photo à sa place', p);
  const noms = ['photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg'];
  const env = [{ nom: 'photo-2.jpg', id: '502' }, { nom: 'photo-1.jpg', id: '501' }, { nom: 'photo-3.jpg', id: '503' }];
  dit(M.ordreRelu(noms, env, [{ id: 501 }, { id: 502 }, { id: 503 }]).etat === 'ok', 'O3 téléversées dans le désordre mais rangées dans le bon ordre ⇒ « ok » (par identité, pas par l’ordre d’arrivée)');
  const f = M.ordreRelu(noms, env, [{ id: 502 }, { id: 501 }, { id: 503 }]);
  dit(f.etat === 'faux' && f.premier === 1, 'O4 la couverture rangée en 2e ⇒ « faux », position 1 nommée', f);
  dit(M.ordreRelu(noms, [{ nom: '', id: '501' }, { nom: 'photo-2.jpg', id: '502' }, { nom: 'photo-3.jpg', id: '503' }], [{ id: 501 }, { id: 502 }, { id: 503 }]).etat === 'pas-su' && M.ordreRelu(noms, env, null).etat === 'pas-su' && M.ordreRelu(noms, null, [{ id: 501 }]).etat === 'pas-su', 'O5 un nom absent, ou le brouillon pas lu ⇒ « pas su » (jamais « ok »)');
  dit(M.ordreRelu(noms, env, [{ id: 501 }, { id: 502 }]).etat === 'faux', 'O6 une photo de moins dans le brouillon ⇒ « faux »');
}
async function partieM(M) {
  const modeles = [
    { id: 'd', portee: 'defaut', texte: 'Paire {marque} taille {taille}.', majAt: '2026-11-01' },
    { id: 'm', portee: 'marque', marque: 'nike', texte: 'Nike {modele} en {taille}, {etat}. {N°}', majAt: '2026-11-02' },
    { id: 'mm', portee: 'modele', marque: 'Nike', modele: 'Air Max 90', texte: 'Air Max 90 pointure {pointure_eu}. {N°}', majAt: '2026-11-03' },
    { id: 'a', portee: 'marque', marque: 'Adidas', texte: 'Adidas {taille}.', majAt: '2026-11-04' },
  ];
  const f = { numero: '41', marque: 'NIKE', modele: 'air max 90', taille: '42', etat: 'Très bon état', titre: 'Nike Dunk Low' };
  dit(M.choisirModele(modeles, f).modele.id === 'mm', 'M1 le modèle (même marque ET même modèle, casse mise à part) passe avant la marque et le défaut');
  dit(M.choisirModele(modeles, { ...f, modele: '', titre: 'Air Max 90' }).modele.id === 'm', 'M2 sans modèle écrit sur la fiche : la marque — jamais un modèle tiré du TITRE (même « Air Max 90 »)');
  dit(M.choisirModele(modeles, { ...f, marque: 'Asics', modele: '' }).modele.id === 'd' && M.choisirModele(modeles.filter((x) => x.portee !== 'defaut'), { marque: 'Asics' }).modele === null, 'M3 une autre marque : le défaut ; sans défaut, AUCUN modèle (rien d’inventé)');
  const deux = M.choisirModele([...modeles, { id: 'm2', portee: 'marque', marque: 'Nike', texte: 'Autre {marque}.', majAt: '2026-11-09' }], { ...f, modele: '' });
  dit(deux.modele.id === 'm2' && deux.egaux === 1, 'M4 deux modèles de même précision : le plus récemment modifié, et c’est dit (egaux)', deux);
  const r = M.remplirModele('Nike {modele} en {taille}, {etat}. {N°} {couleur} {foo}', { ...f, couleur: '' });
  dit(r.texte === 'Nike air max 90 en 42, Très bon état. N°41 {couleur} {foo}' && JSON.stringify(r.manques) === '["couleur"]' && JSON.stringify(r.inconnues) === '["foo"]', 'M5 les variables remplies ; une valeur absente RESTE écrite « {couleur} » et est nommée (rien d’inventé)', r);
  dit(M.pointureEu('42,5') === '42,5' && M.pointureEu('EU 43') === '43' && M.pointureEu('US 9') === '' && M.pointureEu('M') === '', 'M6 {pointure_eu} : seulement une pointure EU déjà écrite — jamais convertie d’une US');
  const mq = M.manquesDepot({ ...FICHE('x', '41'), description: 'Très bon état {taille_us}' }, 3, 'publier');
  dit(mq.manque.includes('description') && mq.variables.includes('taille_us'), 'M7 une description qui garde une variable sans valeur ⇒ « la description » MANQUE (le dépôt est bloqué)', mq);
  dit(M.modeleValide({ portee: 'modele', marque: 'Nike', texte: 'Texte assez long' }) === 'modele' && M.modeleValide({ portee: 'defaut', texte: 'Ok bon texte' }) === '', 'M8 un modèle « par modèle » sans modèle écrit est refusé à l’enregistrement');
}
async function partieB(B, srcBg) {
  const J = 86400000, t0 = Date.UTC(2026, 10, 1);
  const pt = (k, v, f, p) => `${B.jourDe(t0 + k * J)},${v},${f},${p}`;
  const serie = (pts) => B.lireSerie(pts.join(';'));
  // Une annonce : 10 j sans boost (2 vues/jour), puis 5 j boostée (10 vues/jour).
  const s1 = serie([...Array.from({ length: 10 }, (_, k) => pt(k, 2 * k, 0, 0)), ...Array.from({ length: 5 }, (_, k) => pt(10 + k, 18 + 10 * (k + 1), 1, 1)), pt(15, 70, 1, 0)]);
  const per = B.periodesBoost(s1);
  dit(per.length === 1 && per[0].jours === 5 && per[0].enCours === false, 'B1 la période d’un boost = les jours relevés « boostée » qui se suivent (5 j)', per);
  const v1 = B.verdictBoost({ serie: s1, periode: per[0], cout: null });
  dit(v1.verdict === 'a-servi' && v1.cout === null && v1.pendant.vuesJour > 2 * v1.avant.vuesJour, 'B2 vues/jour × 5 pendant le boost ⇒ « a servi », coût inconnu dit tel quel (null)', v1);
  // B3 pas assez de données : aucun relevé avant le boost (le boost a commencé avant la 5.429).
  const s3 = serie(Array.from({ length: 5 }, (_, k) => pt(k, 100 + 10 * k, 3, 1)));
  const v3 = B.verdictBoost({ serie: s3, periode: B.periodesBoost(s3)[0] });
  dit(v3.verdict === 'pas-assez' && v3.avant === null, 'B3 aucun relevé avant le boost ⇒ « pas assez de données », jamais un verdict', v3);
  // B3b un relevé la veille du boost mais rien d'assez ancien avant : « pas assez », même avec beaucoup de vues pendant.
  const s3b = serie([pt(3, 100, 0, 0), pt(4, 200, 2, 1), pt(5, 300, 3, 1), pt(6, 400, 4, 1)]);
  const v3b = B.verdictBoost({ serie: s3b, periode: B.periodesBoost(s3b)[0] });
  dit(v3b.verdict === 'pas-assez' && v3b.pendant && v3b.avant === null, 'B3b « pendant » mesuré mais pas « avant » (même durée) ⇒ « pas assez de données »', v3b);
  // B4 trop peu de vues (sous le seuil) ⇒ pas de verdict, même avec un rapport énorme.
  const s4 = serie([pt(0, 0, 0, 0), pt(3, 0, 0, 0), pt(4, 0, 0, 1), pt(5, 3, 0, 1), pt(6, 4, 0, 1)]);
  const v4 = B.verdictBoost({ serie: s4, periode: B.periodesBoost(s4)[0] });
  dit(v4.verdict === 'pas-assez' && /moins de 10 vues/.test(v4.raison), `B4 moins de ${B.SEUILS_BOOST.vuesMin} vues en tout ⇒ « pas assez de données » (sur N vues)`, v4);
  // B5 vente PROUVÉE pendant le boost ⇒ « a servi ».
  const v5 = B.verdictBoost({ serie: s3, periode: B.periodesBoost(s3)[0], venteAt: t0 + 2 * J + 3600000 });
  dit(v5.verdict === 'a-servi' && v5.vendue === true, 'B5 vendue pendant le boost (date de la vente prouvée) ⇒ « a servi »', v5);
  // B6 pas mieux qu'avant ⇒ « n'a pas servi » ; les semblables du compte (non boostées) au même rythme confirment.
  const plat = (dec) => serie(Array.from({ length: 16 }, (_, k) => pt(k, 3 * k + dec, 0, k >= 10 && k < 15 ? 1 : 0)));
  const s6 = plat(0);
  const sem = Array.from({ length: 6 }, (_, i) => serie(Array.from({ length: 16 }, (_, k) => pt(k, 3 * k + i, 0, 0))));
  const v6 = B.verdictBoost({ serie: s6, periode: B.periodesBoost(s6)[0], semblables: sem });
  dit(v6.verdict === 'pas-servi' && v6.semblables && v6.semblables.n === 6, 'B6 même rythme de vues qu’avant ET que 6 annonces semblables non boostées ⇒ « n’a pas servi »', v6);
  // B7 des « semblables » boostées sur les mêmes jours ne comptent pas (moins de 5 ⇒ pas de comparaison).
  const semB = Array.from({ length: 6 }, (_, i) => serie(Array.from({ length: 16 }, (_, k) => pt(k, 3 * k + i, 0, k === 12 ? 1 : 0))));
  const v7 = B.verdictBoost({ serie: s6, periode: B.periodesBoost(s6)[0], semblables: semB });
  dit(v7.semblables === null, 'B7 les annonces boostées aux mêmes dates ne sont pas des « semblables » (aucune comparaison inventée)', v7.semblables);
  // B8 le récap du mois : compte chaque boost, « au moins » si un compte n'a pas pu être lu, coût couvert « sur N ».
  const mois = B.boostsDuMois({ annonces: [{ id: '1', uid: '111', serie: s1, cout: 1.95 }, { id: '2', uid: '111', serie: s3 }], de: t0, a: t0 + 30 * J, illisibles: 1 });
  dit(mois.n.total === 2 && mois.n.servi === 1 && mois.n.pasAssez === 1 && mois.auMoins === true && mois.cout.avec === 1 && mois.cout.sur === 2 && mois.cout.connu === 1.95, 'B8 « Boosts du mois » : 2 boosts (1 a servi, 1 pas assez de données), « au moins » (un compte pas lu), coût connu sur 1 des 2', mois);
  // B9–B11 : le RELEVÉ de l'extension (vrai fond).
  { const f = monter({ src: srcBg });
    if (typeof f.ctx.noterSuiviAnnonces !== 'function') { dit(false, 'B9 le relevé journalier existe (noterSuiviAnnonces)', 'absent'); return; }
    const items = [{ id: 9101, view_count: 12, favourite_count: 2, promoted: true }, { id: 9102, view_count: 5, favourite_count: 0, promoted: false }, { id: 9103, view_count: 1 }];
    const r1 = await f.ctx.noterSuiviAnnonces('111', items);
    const d = (f.lignes.vinted_suivi_111 || {});
    const s = d.items || {};
    dit(r1 === 'ecrit' && /^\d{8},12,2,1$/.test(s.i9101) && /,5,0,0$/.test(s.i9102) && /,1,,$/.test(s.i9103) && d.boostes && d.boostes.i9101 && !d.boostes.i9102, 'B9 un point par annonce et par jour (vues, favoris, boost : 1 · 0 · vide = pas dit), les boostées listées à part', d);
    const r2 = await f.ctx.noterSuiviAnnonces('111', items.map((x) => ({ ...x, view_count: x.view_count + 1 })));
    dit(r2 === 'tot', 'B10 une 2e lecture dans les 6 h (aucun boost qui commence ou finit) : rien n’est réécrit', r2);
    const r3 = await f.ctx.noterSuiviAnnonces('111', items.map((x) => ({ ...x, promoted: false })));
    dit(r3 === 'ecrit' && /,0$/.test((f.lignes.vinted_suivi_111.items || {}).i9101) && (f.lignes.vinted_suivi_111.items.i9101.split(';').length === 1), 'B10b un boost qui FINIT est relevé tout de suite (le point du jour remplacé, jamais doublé)', f.lignes.vinted_suivi_111.items.i9101); }
  { const f = monter({ src: srcBg, lectureKO: (u) => /vinted_suivi_/.test(u) });
    const r = await f.ctx.noterSuiviAnnonces('111', [{ id: 9101, view_count: 12, favourite_count: 2, promoted: true }]);
    dit(r === 'lecture' && !f.lignes.vinted_suivi_111, 'B11 la ligne du relevé n’a pas pu être relue : RIEN n’est écrit (jamais une série qui repart de vide)', r); }
}

const MUTATIONS = [
  ['bg', 'deja-reliee', "    if (dApp || dResa) { noterDiag('fiche_deja_reliee');", "    if (false) { noterDiag('fiche_deja_reliee');"],
  ['bg', 'publier-sans-ordre', "    if (!r.relu) bloque.push('le brouillon n’a pas pu être relu');", "    bloque.length = 0;"],
  ['bg', 'lancer-sans-manque', "    if (mq.length) pas.push({ id, numero: x.numero, raison: 'il manque '", "    if (false) pas.push({ id, numero: x.numero, raison: 'il manque '"],
  ['bg', 'suivi-lecture-ko', "  if (rows === null) { noterDiag('suivi_lecture_ratee'); return 'lecture'; }", "  if (rows === null) rows = [];"],
  ['regles', 'ordre-par-arrivee', "  for (let i = 0; i < attendu.length; i++) if (a[i] !== attendu[i]) return { etat: 'faux', premier: i + 1 };", ""],
  ['regles', 'pas-su-vaut-ok', "  if (!n.length || !e || !a) return { etat: 'pas-su', premier: 0 };", "  if (!n.length || !e || !a) return { etat: 'ok', premier: 0 };"],
  ['regles', 'couverture-ignoree', "  return c && l.includes(c) ? [c, ...l.filter((x) => x !== c)] : l;", "  return l;"],
  ['regles', 'modele-par-titre', "  const mq = plat(f.marque), md = plat(f.modele);", "  const mq = plat(f.marque), md = plat(f.modele || f.titre);"],
  ['regles', 'precision-ignoree', "  const max = Math.max(...notes.map(([r]) => r));", "  const max = Math.min(...notes.map(([r]) => r));"],
  ['regles', 'variable-inventee', "    if (!val[k]) { manques.add(k); return tout; }", "    if (!val[k]) { return ''; }"],
  ['boost', 'sans-seuil-vues', "  if (pendant.vues + avant.vues < SEUILS_BOOST.vuesMin) return", "  if (false) return"],
  ['boost', 'sans-avant', "  if (!pendant || !avant) return { ...out, raison:", "  if (!pendant) return { ...out, raison:"],
  ['boost', 'semblables-boostees', "    if (l.some((x) => x.p === 1 && x.t >= debut0 - n && x.t <= p.fin)) continue;", ""],
];
(async () => {
  if (process.argv.includes('--prouve')) {
    let bien = true;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a5429-'));
    const base = { bg: SRC_BG, regles: SRC_REGLES, boost: SRC_BOOST };
    for (const [quoi, nom, de, vers] of MUTATIONS) {
      const src = fs.readFileSync(base[quoi], 'utf8');
      if (!src.includes(de)) { console.log(`❌ mutation ${nom} : motif introuvable`); bien = false; continue; }
      const dossier = path.join(tmp, nom); fs.mkdirSync(dossier, { recursive: true });
      let p = path.join(dossier, path.basename(base[quoi]));
      if (quoi === 'regles') { fs.mkdirSync(path.join(dossier, 'depot'), { recursive: true }); p = path.join(dossier, 'depot', 'regles.js'); }
      fs.writeFileSync(p, src.replace(de, vers));
      let args = [quoi === 'bg' ? '--src' : quoi === 'regles' ? '--regles' : '--boost', p];
      // La règle mutée doit aussi être celle du fond (recopiée dans GARDES_APP) : le fond est refabriqué avec elle.
      if (quoi === 'regles') {
        const bgM = path.join(dossier, 'background.js');
        const esbuild = require('esbuild');
        const code = esbuild.buildSync({ stdin: { contents: `export { manquesDepot, photosDepot, payloadDepot, ordreRelu, ordrePhotos } from ${JSON.stringify(p)};`, resolveDir: dossier, loader: 'js' }, bundle: true, format: 'iife', globalName: '__depotMute', write: false, platform: 'neutral', target: 'es2020' }).outputFiles[0].text;
        const bg = fs.readFileSync(SRC_BG, 'utf8').replace('const GARDES_APP = __gardesApp;', `${code}\nconst GARDES_APP = Object.assign({}, __gardesApp, __depotMute);`);
        fs.writeFileSync(bgM, bg); args = args.concat(['--src', bgM]);
      }
      const r = cp.spawnSync(process.execPath, [__filename, ...args], { env: { ...process.env, SILENCE: '1' }, encoding: 'utf8', timeout: 600000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    }
    // L'arbre d'avant (origin/main) : ni le dépôt, ni l'ordre relu, ni le relevé.
    const avant = path.join(tmp, 'avant'); fs.mkdirSync(avant);
    const g = cp.spawnSync('sh', ['-c', `git -C "${R}" archive origin/main vinted-sync-extension/background.js | tar -x -C "${avant}"`], { encoding: 'utf8' });
    const bgA = path.join(avant, 'vinted-sync-extension', 'background.js');
    if (g.status === 0 && fs.existsSync(bgA)) {
      const r = cp.spawnSync(process.execPath, [__filename, '--src', bgA], { env: { ...process.env, SILENCE: '1' }, encoding: 'utf8', timeout: 600000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} arbre d’avant (origin/main) ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    } else { console.log('❌ arbre d’avant illisible (git archive origin/main)'); bien = false; }
    process.exit(bien ? 0 : 1);
  }
  const M = await import(pathToFileURL(SRC_REGLES).href + '?t=' + Date.now());
  const B = await import(pathToFileURL(SRC_BOOST).href + '?t=' + Date.now());
  await partieD(M);
  await partieO(M);
  await partieM(M);
  await partieB(B, SRC_BG);
  if (!SILENCE) console.log(`\n${ko ? '❌' : '✅'} audit-ext-5429 : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
