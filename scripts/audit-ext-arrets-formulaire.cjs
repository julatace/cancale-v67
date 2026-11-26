#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA REPUBLICATION PAR LE FORMULAIRE S'ARRÊTE PROPREMENT QUAND L'ONGLET CHANGE SOUS ELLE
//  (22 nov., audit complet de l'extension)
//
//  `audit-comme-bleam` juge déjà : captcha (R10), élément introuvable (R11), suppression incertaine (R13), autre compte
//  AU DÉPART (R15), « Tout arrêter » (R16), 429 au brouillon (R17). Il manquait ce qui change PENDANT le remplissage :
//    A1  l'onglet passe sur un AUTRE compte au milieu des champs ⇒ le champ suivant n'est pas saisi, aucun brouillon,
//        aucune suppression, l'ancienne annonce intacte, les places rendues, la raison dite ;
//    A2  la session Vinted EXPIRE au milieu (plus aucun compte connecté) ⇒ pareil ;
//    A3  un 403 au brouillon ⇒ la pause de Vinted est posée, l'ancienne n'est pas touchée, rien n'est supprimé ;
//    A4  un 403 à la SUPPRESSION ⇒ jamais de mise en ligne (jamais deux en ligne), pause posée ;
//    A5  la page a navigué ailleurs (l'étape répond « hors-vinted ») ⇒ arrêt, rien d'irréversible.
//  Le VRAI background.js (scripts/_fond-vm.cjs) ; la page est le faux formulaire de `audit-comme-bleam` (la même interface
//  que vrm-formulaire.js, jugé lui-même par scripts/bancs/repub-formulaire.cjs). Données inventées.
//  `--bg <background.js>` : une autre copie ; `--mutation nom` ; `--prouve` (chaque garde retirée ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const argBg = (() => { const i = process.argv.indexOf('--bg'); return i > 0 ? process.argv[i + 1] : ''; })();
let BG = argBg ? path.resolve(argBg) : path.join(RACINE, 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  // Le compte de l'onglet n'est plus revérifié entre deux champs.
  'sans-garde-entre-champs': ["  const g = await gardeStricte(uid, acc, { lecture: true }); if (g) return { code: g.code, raison: g.error };\n  { const fr = await lireFreinRepub(uid);", "  { const fr = await lireFreinRepub(uid);"],
};
const argMut = (() => { const a = process.argv.find((x) => x.startsWith('--mutation=')); return a ? a.slice(11) : ''; })();
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`);
    if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
if (argMut) {
  const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
  const s = fs.readFileSync(BG, 'utf8');
  if (!s.includes(M[0])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
  BG = path.join(os.tmpdir(), `bg-arrets-formulaire-${argMut}-${process.pid}.js`);
  fs.writeFileSync(BG, s.split(M[0]).join(M[1]));
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };
const nowISO = () => new Date().toISOString();
const UID = '111';
const MODELE = JSON.stringify({ item: { id: 9101, title: 'Basket test 42', description: 'Très bon état, boîte', price: '60.0', currency: 'EUR', catalog_id: 1234, brand_id: 53, brand: 'Marque test', color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], package_size_id: 1, assigned_photos: [{ id: 1 }] } });
const PHOTOS = ['https://images1.vinted.net/t/01_0121e_testAAAA0001/f800/1.jpeg', 'https://images1.vinted.net/t/02_02248_testBBBB0002/f800/2.jpeg'];
const CATALOGUE = JSON.stringify({ catalogs: [{ id: 1, title: 'Hommes', catalogs: [{ id: 1234, title: 'Baskets test' }] }] });

// Le faux formulaire (celui de audit-comme-bleam) : `o.page(etape, d, f)` peut remplacer une réponse.
function monterRepub(o = {}) {
  const v = { ancienne: 'en-ligne', brouillon: null };
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '41' } } }, vinted_item_details: {}, vrm_vinted_modele: { '9101': { corps: MODELE, at: nowISO(), uid: UID } }, vinted_catalogue: { corps: CATALOGUE } };
  lignes.coffre_111_9101 = { id: '9101', uid: UID, title: 'Basket test 42', price: 60, desc: 'Très bon état, boîte', photos: PHOTOS };
  const f = faireFond({ src: BG, lignes, connecte: UID, store: { __commeBleamDefaut: true }, cdn: () => ({ status: 200 }),
    vinted: (e) => {
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin)) return v.ancienne === 'en-ligne' ? { status: 200, body: { item: { id: 9101, is_draft: false } } } : { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/88001$/.test(e.chemin)) return { status: 200, body: { item: { id: 88001, is_draft: v.brouillon !== 'en-ligne', photos: [{ id: 701 }, { id: 702 }] } } };
      return { status: 404, body: {} };
    } });
  f.v = v; f.pas = []; f.saisis = {};
  f.ctx.__vrmPausesVues = [];
  f.ctx.__vrmFormulaire = async (etape, d) => {
    f.pas.push({ etape, quoi: d && d.quoi });
    if (o.page) { const x = await o.page(etape, d, f); if (x !== undefined) return x; }
    if (etape === 'ouvrirVente') return { ok: true, chemin: '/items/new' };
    if (etape === 'photos') return { ok: true, n: d.photos.length };
    if (etape === 'champ') { f.saisis[d.quoi] = d; return { ok: true }; }
    if (etape === 'brouillon') {
      const s = f.saisis;
      const draft = { id: null, title: s.titre && s.titre.valeur, description: s.description && s.description.valeur, price: s.prix && String(s.prix.valeur), catalog_id: s.categorie && s.categorie.id, brand_id: s.marque && s.marque.id, color_ids: s.couleurs && s.couleurs.ids, package_size_id: s.colis && s.colis.id, item_attributes: [{ code: 'size', ids: [s.taille && s.taille.id] }, { code: 'condition', ids: [s.etat && s.etat.id] }], assigned_photos: [{ id: 701 }, { id: 702 }] };
      v.brouillon = 'brouillon';
      return { ok: true, rep: { status: 200, ok: true, json: { draft: { id: 88001 } }, corps: JSON.stringify({ draft }) } };
    }
    if (etape === 'supprimer') { v.ancienne = 'partie'; return { ok: true, rep: { status: 200, ok: true, json: { code: 0 } } }; }
    if (etape === 'formulairePret') return { ok: true };
    if (etape === 'publier') { v.brouillon = 'en-ligne'; return { ok: true, rep: { status: 200, ok: true, json: { item: { id: 88001 } } } }; }
    if (etape === 'reponse') return { ok: false, code: 'sans-reponse' };
    return { ok: false, code: 'etape' };
  };
  return f;
}
const recreer = (f) => f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: UID, id: '9101', num: '41', prix: 54, titre: 'Basket test 42', confirme: true }).catch((e) => ({ erreur: String(e && e.stack || e) }));
const noms = (f) => f.pas.map((p) => (p.etape === 'champ' ? p.quoi : p.etape));
const places = (f) => ((f.store.vrmActions || {})[UID] || []).filter((t) => Date.now() - Number(t) < 3600000).length;
const compteDevient = (f, uid) => { f.ctx.activeAccountId = async () => uid; f.ctx.activeUidForDomain = async () => uid; f.ctx.compteConnecte = async () => uid; };

(async () => {
  // Le témoin : sans rien changer, la séquence va au bout (le banc ne juge pas un montage cassé).
  { const f = monterRepub(); const r = await recreer(f);
    dit(r && r.etape === 'fait' && noms(f).includes('publier') && f.v.ancienne === 'partie' && f.v.brouillon === 'en-ligne', 'témoin : sans incident, la paire est republiée (brouillon, suppression, mise en ligne)', JSON.stringify(r).slice(0, 300) + ' ' + noms(f).join('>')); }

  // A1 — un AUTRE compte dans l'onglet au milieu des champs.
  { const f = monterRepub({ page: (e, d, ff) => { if (e === 'champ' && d.quoi === 'description') compteDevient(ff, '222'); return undefined; } });
    const r = await recreer(f); const s = noms(f);
    dit(r && r.accepte === false && !s.includes('brouillon') && !s.includes('supprimer') && !s.includes('publier') && s.indexOf('marque') < 0 && f.v.ancienne === 'en-ligne' && f.v.brouillon === null,
      'A1 autre compte dans l’onglet pendant le remplissage ⇒ le champ suivant n’est pas saisi, aucun brouillon, aucune suppression', JSON.stringify({ r, s }));
    dit(r && String(r.raison || r.error || '').length > 10 && places(f) === 0, 'A1 la raison est dite, les places sont rendues', JSON.stringify({ raison: r && (r.raison || r.error), p: places(f) })); }

  // A2 — la session Vinted expire au milieu (plus aucun compte connecté).
  { const f = monterRepub({ page: (e, d, ff) => { if (e === 'champ' && d.quoi === 'description') compteDevient(ff, null); return undefined; } });
    const r = await recreer(f); const s = noms(f);
    dit(r && r.accepte === false && !s.includes('brouillon') && !s.includes('supprimer') && !s.includes('publier') && f.v.ancienne === 'en-ligne' && places(f) === 0,
      'A2 session Vinted expirée pendant le remplissage ⇒ arrêt, aucun brouillon, l’ancienne intacte, places rendues', JSON.stringify({ r, s }));
    dit(r && String(r.raison || r.error || '').length > 10, 'A2 la raison est dite', JSON.stringify(r)); }

  // A3 — 403 au brouillon : la pause est posée, rien n'est supprimé.
  { const f = monterRepub({ page: (e) => (e === 'brouillon' ? { ok: true, rep: { status: 403, ok: false, json: {} } } : undefined) });
    const r = await recreer(f); const s = noms(f); const pause = f.store.vrmPauseVinted;
    dit(r && r.etape !== 'fait' && !s.includes('supprimer') && !s.includes('publier') && f.v.ancienne === 'en-ligne' && pause && Number(pause.jusqua || pause.until || pause.fin || 0) > Date.now(),
      'A3 403 au brouillon ⇒ pause de Vinted posée, l’ancienne n’est pas touchée', JSON.stringify({ r, pause, s })); }

  // A4 — 403 à la suppression : jamais de mise en ligne.
  { const f = monterRepub({ page: (e) => (e === 'supprimer' ? { ok: true, rep: { status: 403, ok: false, json: {} } } : undefined) });
    const r = await recreer(f); const s = noms(f); const pause = f.store.vrmPauseVinted;
    dit(r && r.etape !== 'fait' && !s.includes('publier') && f.v.brouillon !== 'en-ligne' && pause && Number(pause.jusqua || pause.until || pause.fin || 0) > Date.now(),
      'A4 403 à la suppression ⇒ aucune mise en ligne (jamais deux en ligne), pause posée', JSON.stringify({ r, pause, s })); }

  // A5 — la page a quitté Vinted pendant un champ.
  { const f = monterRepub({ page: (e, d) => (e === 'champ' && d.quoi === 'marque' ? { ok: false, code: 'hors-vinted' } : undefined) });
    const r = await recreer(f); const s = noms(f);
    dit(r && r.etape !== 'fait' && !s.includes('brouillon') && !s.includes('supprimer') && f.v.ancienne === 'en-ligne' && places(f) === 0,
      'A5 la page a quitté Vinted pendant un champ ⇒ arrêt, aucun brouillon, l’ancienne intacte, places rendues', JSON.stringify({ r, s })); }

  console.log(`\n${ko ? '❌' : '✅'} arrêts de la republication par le formulaire : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
