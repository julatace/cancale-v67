// ════════════════════════════════════════════════════════════════════════════
//  LES MODIFICATIONS D'ANNONCES JOUÉES PAR LE VRAI background.js (21 nov., ext. 5.423 — `modifavantapres`)
//
//  Partagé par scripts/audit-modif-avant-apres.cjs (les règles) et scripts/bancs/modif-avant-apres.cjs (l'écran) :
//  le VRAI service worker dans un vm (scripts/_fond-vm.cjs), une FAUSSE page vinted.fr (aucun vrai Vinted), données
//  inventées (dépôt public). Chaque scénario rend la SUITE des états que l'écran plein lit (`vrmActionEnCours`, un
//  instantané à chaque écriture) et, pour chacun, le journal des preuves RÉELLEMENT obtenues à ce moment-là :
//    · republier : `coffre` ⇐ la ligne coffre écrite dans la base ; `brouillon` ⇐ la page a rendu le brouillon (réponse
//      OK) ; `supprimee` ⇐ la page a rendu la suppression (OK) ; `enligne` ⇐ la page a rendu « Ajouter » (OK) ;
//    · baisse : `lu` ⇐ Vinted a servi la lecture de l'annonce ; `tape` + `enregistre` ⇐ Vinted a reçu l'enregistrement
//      de la page (OK pour `enregistre`) ; `verifie` ⇐ Vinted a servi la RELECTURE, au nouveau prix ;
//    · masquer : `lu` ⇐ l'annonce est dans le dressing rangé ; `enregistre` ⇐ Vinted a répondu OK ; `verifie` ⇐ idem, relu.
//  `preuvesSansFait(snaps)` : toute étape datée dans un instantané sans le fait qui la prouve À CE MOMENT ⇒ une faute.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { faireFond } = require('./_fond-vm.cjs');

const UID = '111';
const copie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const nowISO = () => new Date().toISOString();
const PHOTO = (n) => `https://images1.vinted.net/t/banc/${n}.webp`;
const MODELE_R = JSON.stringify({ item: { id: 9101, title: 'Basket test 42', description: 'Très bon état, boîte', price: '60.0', currency: 'EUR', catalog_id: 1234, brand_id: 53, brand: 'Marque test', color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], package_size_id: 1, assigned_photos: [{ id: 1 }] } });
const CATALOGUE = JSON.stringify({ catalogs: [{ id: 1, title: 'Hommes', catalogs: [{ id: 1234, title: 'Baskets test' }] }] });
const PHOTOS_R = ['https://images1.vinted.net/t/01_0121e_testAAAA0001/f800/1.jpeg', 'https://images1.vinted.net/t/02_02248_testBBBB0002/f800/2.jpeg'];
// Le dressing RANGÉ du compte (ce que l'écran affiche comme « avant ») : titres, prix, photo, mise en ligne.
const J = 86400000;
const DRESSING = [
  { id: 9101, title: 'Basket test 42 cuir blanc', price: { amount: '60.0', currency_code: 'EUR' }, photo: { url: PHOTO('a1') }, created_at_ts: Math.round((Date.now() - 12 * J) / 1000) },
  { id: 91010001, title: 'Nike Air Max 90 blanches 42', price: { amount: '60.0', currency_code: 'EUR' }, photo: { url: PHOTO('p1') }, created_at_ts: Math.round((Date.now() - 9 * J) / 1000) },
  { id: 91010002, title: 'Adidas Samba OG noires 40', price: { amount: '75.0', currency_code: 'EUR' }, photo: { url: PHOTO('p2') }, created_at_ts: Math.round((Date.now() - 21 * J) / 1000) },
  { id: 91010003, title: 'New Balance 550 crème 41', price: { amount: '48.0', currency_code: 'EUR' }, photo: { url: PHOTO('p3') }, created_at_ts: Math.round((Date.now() - 30 * J) / 1000) },
  { id: 91020001, title: 'Puma Suede bleues 43', price: { amount: '39.0', currency_code: 'EUR' }, photo: { url: PHOTO('m1') }, created_at_ts: Math.round((Date.now() - 5 * J) / 1000) },
];
const NUMS = { '9101': { numero: '41', accountId: UID }, '91010001': { numero: '120', accountId: UID }, '91010002': { numero: '121', accountId: UID }, '91010003': { numero: '122', accountId: UID }, '91020001': { numero: '130', accountId: UID } };
function baseLignes() {
  return { main: { capturedAt: nowISO(), vinted_annonce_numeros: copie(NUMS) }, vinted_listing_dates: {}, [`harvest_${UID}_listings`]: { capturedAt: nowISO(), payload: { items: copie(DRESSING) } }, vinted_item_details: {}, vinted_catalogue: { corps: CATALOGUE } };
}
// Les instantanés : chaque écriture de l'état de l'écran, avec les faits prouvés À CE MOMENT (copiés).
function brancherInstantanes(f, faits) {
  const snaps = [];
  const orig = f.ctx.poserAction;
  f.ctx.poserAction = async (a) => { const r = await orig(a); snaps.push({ a: copie(f.store.vrmActionEnCours), faits: copie(faits), coffre: !!(f.lignes[`coffre_${UID}_9101`] && f.lignes[`coffre_${UID}_9101`].versBrouillon) }); return r; };
  return snaps;
}

// ── 1. UNE REPUBLICATION (le formulaire, coffre → brouillon → suppression → en ligne) ─────────────────────────
//  `o.arreterApres` : une étape de la page après laquelle Julien touche « Tout arrêter » (l'écran).
async function jouerRepub(bg, o = {}) {
  const lignes = Object.assign(baseLignes(), { vrm_vinted_modele: { '9101': { corps: MODELE_R, at: nowISO(), uid: UID } } });
  lignes[`coffre_${UID}_9101`] = { id: '9101', uid: UID, title: 'Basket test 42 cuir blanc', price: 60, desc: 'Très bon état, boîte', photos: PHOTOS_R };
  const v = { ancienne: 'en-ligne', brouillon: null };
  const f = faireFond({ src: bg, lignes, connecte: UID, store: { __commeBleamDefaut: true }, cdn: () => ({ status: 200 }),
    vinted: (e) => {
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin)) return v.ancienne === 'en-ligne' ? { status: 200, body: { item: { id: 9101, is_draft: false } } } : { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/88001$/.test(e.chemin)) return { status: 200, body: { item: { id: 88001, is_draft: v.brouillon !== 'en-ligne', photos: [{ id: 701 }, { id: 702 }] } } };
      return { status: 404, body: {} };
    } });
  const faits = []; const saisis = {};
  const snaps = brancherInstantanes(f, faits);
  f.ctx.__vrmFormulaire = async (etape, d) => {
    let res;
    if (etape === 'ouvrirVente') res = { ok: true, chemin: '/items/new' };
    else if (etape === 'photos') res = { ok: true, n: d.photos.length };
    else if (etape === 'champ') { saisis[d.quoi] = d; res = { ok: true }; }
    else if (etape === 'brouillon') {
      const s = saisis;
      const draft = { id: null, title: s.titre && s.titre.valeur, description: s.description && s.description.valeur, price: s.prix && String(s.prix.valeur), catalog_id: s.categorie && s.categorie.id, brand_id: s.marque && s.marque.id, color_ids: s.couleurs && s.couleurs.ids, package_size_id: s.colis && s.colis.id, item_attributes: [{ code: 'size', ids: s.taille ? [s.taille.id] : [] }, { code: 'condition', ids: s.etat ? [s.etat.id] : [] }] };
      res = { ok: true, rep: { status: 200, ok: true, json: { draft: { id: 88001 } }, corps: JSON.stringify({ draft }) } };
    } else if (etape === 'supprimer') { v.ancienne = 'partie'; res = { ok: true, rep: { status: 200, ok: true, json: { code: 0 } } }; }
    else if (etape === 'formulairePret') res = { ok: true };
    else if (etape === 'publier') { v.brouillon = 'en-ligne'; res = { ok: true, rep: { status: 200, ok: true, json: { item: { id: 88001 } } } }; }
    else res = { ok: false, code: 'etape' };
    faits.push({ etape, ok: !!(res && res.ok && (!res.rep || res.rep.ok)) });
    if (o.arreterApres === etape) await f.ctx.arreterDepuisEcran({ tab: { id: 7, url: 'https://www.vinted.fr/' } });
    return res;
  };
  let r = null; try { r = await f.ctx.executerCommande({ cmd: 'recreerVinted', uid: UID, id: '9101', num: '41', confirme: true, total: o.total || 1, serie: 'atelier:1' }); } catch (e) { r = { erreur: String(e && e.stack || e) }; }
  await new Promise((ok) => setTimeout(ok, 20));
  return { f, r, snaps, final: copie(f.store.vrmActionEnCours), faits };
}

// ── 2. UN LOT DE PRIX (trois annonces du panneau, la file `cmd_prix_*` exécutée par `prixAttExecuter`) ─────────
//  Annonce 3 : Vinted refuse l'enregistrement (422) ⇒ elle s'arrête à « Enregistré », en ambre.
//  `o.relu` : une annonce dont la relecture montre un AUTRE prix (⇒ jamais « vérifié »).
async function jouerPrix(bg, o = {}) {
  const IDS = ['91010001', '91010002', '91010003'];
  const AVANT = { '91010001': 60, '91010002': 75, '91010003': 48 }, APRES = { '91010001': 54, '91010002': 67.5, '91010003': 43 };
  const lignes = baseLignes();
  lignes.vrm_vinted_modele = {};
  const prixV = Object.assign({}, AVANT); const nGet = {};
  for (const id of IDS) {
    lignes[`coffre_${UID}_${id}`] = { id, photos: ['a', 'b'] };
    lignes.vrm_vinted_modele[id] = { corps: JSON.stringify({ item: { id: Number(id), title: DRESSING.find((x) => String(x.id) === id).title, description: 'Très bon état', price: { amount: String(AVANT[id]) + '.0', currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 501, orientation: 0 }] } }), at: nowISO(), uid: UID };
  }
  const faits = [];
  const f = faireFond({ src: bg, lignes, connecte: UID, vinted: (e) => {
    const m = /\/api\/v2\/item_upload\/items\/(\d+)$/.exec(e.chemin); const id = m && m[1];
    if (!id || !IDS.includes(id)) return { status: 404, body: {} };
    const lu = (p) => ({ item: { id: Number(id), title: DRESSING.find((x) => String(x.id) === id).title, description: 'Très bon état', price: { amount: String(p), currency_code: 'EUR' }, photos: [{ id: 501 }] } });
    if (e.methode === 'GET') {
      nGet[id] = (nGet[id] || 0) + 1;
      const p = nGet[id] >= 2 && o.relu && o.relu[id] != null ? o.relu[id] : prixV[id];
      faits.push({ quoi: nGet[id] === 1 ? 'lu' : 'relu', id, prix: p });
      return { status: 200, body: lu(p) };
    }
    if (e.methode === 'PUT') {
      if (id === '91010003') { faits.push({ quoi: 'put', id, ok: false }); return { status: 422, body: { message: 'refus', code: 99 } }; }
      try { const b = JSON.parse(e.corps); const it = b.item || b; prixV[id] = Number(it.price && typeof it.price === 'object' ? it.price.amount : it.price); } catch (_) {}
      faits.push({ quoi: 'put', id, ok: true });
      return { status: 200, body: {} };
    }
    return { status: 404, body: {} };
  } });
  const snaps = brancherInstantanes(f, faits);
  const rs = [];
  const t = Date.now();
  for (const id of IDS) {
    const d = { v: 1, site: 'vinted', args: { uid: UID, id, prix: APRES[id], prixAvant: AVANT[id] }, confirme: true, demandeLe: t, source: 'panneau', num: NUMS[id].numero, lotN: IDS.length, lotSerie: 'prix:' + t };
    const c = f.ctx.prixAttCommande(d);
    let r = null; try { r = await f.ctx.prixAttExecuter(c, d.num, false, d); } catch (e) { r = { erreur: String(e && e.stack || e) }; }
    rs.push({ id, r });
  }
  await new Promise((ok) => setTimeout(ok, 20));
  return { f, rs, snaps, final: copie(f.store.vrmActionEnCours), faits, AVANT, APRES };
}

// ── La règle des preuves : une étape datée dans un instantané doit avoir SON fait, déjà là à ce moment. ──
function faitPour(sorte, cle, s, id) {
  const fs = s.faits || [];
  if (sorte === 'republier') {
    if (cle === 'coffre') return s.coffre === true;
    const etape = { brouillon: 'brouillon', supprimee: 'supprimer', enligne: 'publier' }[cle];
    return fs.some((x) => x.etape === etape && x.ok);
  }
  if (sorte === 'baisse') {
    if (cle === 'lu') return fs.some((x) => x.id === id && x.quoi === 'lu');
    if (cle === 'tape') return fs.some((x) => x.id === id && x.quoi === 'put');
    if (cle === 'enregistre') return fs.some((x) => x.id === id && x.quoi === 'put' && x.ok);
    if (cle === 'verifie') return fs.some((x) => x.id === id && x.quoi === 'relu');
  }
  return false;
}
function preuvesSansFait(snaps) {
  const fautes = [];
  for (const s of snaps) {
    const a = s.a; const m = a && a.modif;
    if (m) for (const k of Object.keys(m.preuves || {})) if (Number(m.preuves[k]) > 0 && !faitPour(m.sorte, k, s, String(m.id))) fautes.push(`${m.sorte}:${m.id}:${k}`);
    for (const b of (a && Array.isArray(a.bilan) ? a.bilan : [])) for (const k of Object.keys(b.preuves || {})) if (Number(b.preuves[k]) > 0 && !faitPour(b.sorte, k, s, String(b.id))) fautes.push(`bilan:${b.sorte}:${b.id}:${k}`);
  }
  return [...new Set(fautes)];
}
module.exports = { UID, DRESSING, NUMS, PHOTO, MODELE_R, jouerRepub, jouerPrix, preuvesSansFait, faitPour, copie };
