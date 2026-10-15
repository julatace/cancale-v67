// ════════════════════════════════════════════════════════════════════════════
//  « J'AI PUBLIÉ UNE PAIRE SUR VINTED ET 2 MIN APRÈS J'AI VOULU LA METTRE SUR
//  eBAY, VRM N'A PAS CAPTÉ LES PHOTOS » — Julien, 15 octobre.
//
//  MESURÉ sur sa base (lecture seule) : une annonce neuve n'a, dans le dressing
//  (`harvest_{uid}_listings`), que sa COUVERTURE (`photo`, un objet) et le
//  nombre réel (`nPhotos`). Le jeu complet n'arrive que par le fond
//  (`capterPhotosAnnonces` : compte connecté seulement, budget de lecture) ou la
//  page ouverte. Et le fond passait APRÈS les annonces déjà complètes à qui ne
//  manque que la fiche de codes (`fiche_codes_absents` 253 sur 253 : elles
//  repassent toutes les 6 h).
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et on COMPTE ce qui part
//  chez Vinted :
//   1. la commande « photos » de l'app lit CETTE annonce tout de suite (une
//      page, dans la file), range le jeu complet et prévient l'app ;
//   2. rien n'est lu si toutes ses photos sont déjà là ; une annonce qui n'en a
//      qu'une partie est lue (la règle de Leboncoin ne lisait que si AUCUNE) ;
//   3. les gardes : pas de compte Vinted dans Chrome, pause demandée par Vinted,
//      budget du clic épuisé ⇒ RIEN ne part, et la raison est rendue ;
//   4. « pas su » : la base ne répond pas sur les photos captées ⇒ rien ne part,
//      rien n'est écrit, la commande le dit ;
//   5. un double clic ne lit qu'une fois ;
//   6. la fiche de codes déjà rangée n'est plus effacée par une relecture ;
//   7. le fond lit D'ABORD l'annonce à qui il manque des photos.
//  Données inventées. Usage : node scripts/audit-photos-clic-ebay.cjs [--src f]
//  `--mutation <nom>` réaffaiblit la correction dans une copie (§6.1) :
//    toujours-lire · lbc-seulement · sans-garde · sans-tri · efface-codes
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

let SRC = cheminSource();
const iMut = process.argv.indexOf('--mutation');
if (iMut > 0) {
  const nom = process.argv[iMut + 1];
  let s = fs.readFileSync(SRC, 'utf8');
  const remplace = (a, b) => { if (!s.includes(a)) { console.log(`❌ mutation ${nom} : motif introuvable`); process.exit(2); } s = s.replace(a, b); };
  if (nom === 'toujours-lire') remplace("if (!manque) return { etat: 'deja'", "if (false) return { etat: 'deja'");
  else if (nom === 'lbc-seulement') remplace('const manque = Number.isFinite(v) && v > 0 ? a < Math.min(20, v) : a === 0;', 'const manque = a === 0;');
  else if (nom === 'sans-garde') remplace('const stop = await gardeStricte(uid, acc, { lecture: true });\n    if (stop) return { accepte: false, code: stop.code, raison: stop.error };\n    await majCmd(jobId', 'const stop = null;\n    await majCmd(jobId');
  else if (nom === 'sans-tri') remplace('.sort((x, y) => ((y.manque > 0) - (x.manque > 0)) || (y.manque - x.manque) ||', '.sort((x, y) =>');
  else if (nom === 'efface-codes') remplace('cur[key] = Object.assign({}, prev, {', 'cur[key] = Object.assign({}, {');
  else { console.log('mutation inconnue : ' + nom); process.exit(2); }
  const f = path.join(os.tmpdir(), `bg-mut-${nom}-${process.pid}.js`);
  fs.writeFileSync(f, s); SRC = f;
  console.log(`(mutation « ${nom} » appliquée)`);
}

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '111';
const img = (id, i) => `https://images1.vinted.net/t/x/f800/${id}_${i}.jpeg?s=abc`;
// La page publique de l'annonce : ses photos vivent dans `__NEXT_DATA__` (forme mesurée).
const page = (id, n) => '<!doctype html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { item: {
  id: Number(id), description: 'Neuve, jamais portée', photos: Array.from({ length: n }, (_, i) => ({ id: i, full_size_url: img(id, i) })) } } } }) + '</script>';
const vintedPages = (nParId) => (req) => {
  const m = /^\/items\/(\d+)$/.exec(req.chemin);
  if (m) return { status: 200, body: page(m[1], nParId[m[1]] || 0) };
  return { status: 404, body: {} };
};
const pagesLues = (j, id) => j.vinted.filter((r) => (id ? r.chemin === `/items/${id}` : /^\/items\/\d+$/.test(r.chemin)));
const attendreFin = async (store, jobId, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const c = store.vrmCmds && store.vrmCmds[jobId];
    if (c && c.etape && c.etape !== 'file') return c;
    await new Promise((r) => setTimeout(r, 15));
  }
  return (store.vrmCmds && store.vrmCmds[jobId]) || null;
};
const listing = (id, nPhotos) => ({ id, nPhotos, is_closed: false, is_hidden: false, title: 'Paire ' + id, photo: { url: img(id, 0) } });
const base = (items, details = {}) => ({
  [`harvest_${UID}_listings`]: { capturedAt: new Date().toISOString(), payload: { items } },
  vinted_item_details: details,
});
const cmd = (ctx, id, voulu) => ctx.executerCommande({ from: 'vmr-bridge', action: 'cmd', cmd: 'photos', id: String(id), voulu });

(async () => {
  console.log('── 1. la paire neuve (couverture seule) : lue tout de suite, jeu complet rangé');
  await essaie('neuve', async () => {
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)]), vinted: vintedPages({ 801: 14 }), connecte: UID });
    const r = await cmd(f.ctx, 801, 14);
    dit(!!(r && r.accepte && r.jobId === 'photos:801'), 'la commande « photos » est acceptée (accusé immédiat, suivi dans vrmCmds)', JSON.stringify(r));
    const fin = await attendreFin(f.store, 'photos:801');
    dit(pagesLues(f.j, 801).length === 1, 'UNE lecture de la page de CETTE annonce chez Vinted', `${pagesLues(f.j, 801).length} lecture(s)`);
    const det = (f.lignes.vinted_item_details || {})['801'] || {};
    dit(Array.isArray(det.photos) && det.photos.length === 14, 'ses 14 photos sont rangées dans vinted_item_details', `${(det.photos || []).length} rangée(s)`);
    dit(!!(fin && fin.etape === 'fait' && Number(fin.n) === 14), 'la commande finit « fait », avec le nombre rangé (14)', JSON.stringify(fin && { etape: fin.etape, n: fin.n, code: fin.code }));
    dit(f.j.evts.some((e) => e && e.type === 'maj' && e.quoi === 'photos' && String(e.id) === '801'), "l'app est prévenue (maj · photos · 801)");
    dit(f.j.vinted.every((r) => r.origine === 'fond') && f.j.maxEnVol <= 1, 'une requête à la fois, depuis le fond (page publique)', `max en vol ${f.j.maxEnVol}`);
  });

  console.log('── 2. déjà toutes là ⇒ rien ; une PARTIE seulement ⇒ lue');
  await essaie('deja', async () => {
    const d = { '801': { photos: Array.from({ length: 14 }, (_, i) => img(801, i)) } };
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)], d), vinted: vintedPages({ 801: 14 }), connecte: UID });
    const r = await cmd(f.ctx, 801, 14);
    const fin = await attendreFin(f.store, 'photos:801');
    dit(pagesLues(f.j).length === 0, 'aucune requête Vinted quand les 14 photos sont déjà captées', `${pagesLues(f.j).length} lecture(s)`);
    dit(!!(r && r.accepte && fin && fin.etape === 'fait' && fin.deja === true), 'la commande le dit (« fait », déjà là)', JSON.stringify(fin && { etape: fin.etape, deja: fin.deja }));
  });
  await essaie('partiel', async () => {
    const d = { '801': { photos: [img(801, 0)] } };   // la couverture seule, captée par la page
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)], d), vinted: vintedPages({ 801: 14 }), connecte: UID });
    await cmd(f.ctx, 801, 14);
    await attendreFin(f.store, 'photos:801');
    const det = (f.lignes.vinted_item_details || {})['801'] || {};
    dit(pagesLues(f.j, 801).length === 1 && (det.photos || []).length === 14, '1 photo captée sur 14 ⇒ la page est lue, les 14 sont rangées', `${pagesLues(f.j, 801).length} lecture(s), ${(det.photos || []).length} rangée(s)`);
  });
  await essaie('lbc inchange', async () => {
    // L'autre sens : la publication Leboncoin (sans `voulu`) garde SA règle —
    // une annonce qui a déjà des photos n'est pas relue (le fond complétera).
    const d = { '801': { photos: [img(801, 0)] } };
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)], d), vinted: vintedPages({ 801: 14 }), connecte: UID });
    await f.ctx.completerPhotosSiManque(UID, '801');
    dit(pagesLues(f.j).length === 0, 'sans nombre voulu (Leboncoin), une annonce qui a déjà une photo n\'est pas relue', `${pagesLues(f.j).length} lecture(s)`);
  });

  console.log('── 3. les gardes : rien ne part, la raison est rendue');
  await essaie('sans compte', async () => {
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)]), vinted: vintedPages({ 801: 14 }), connecte: null });
    const r = await cmd(f.ctx, 801, 14);
    await new Promise((res) => setTimeout(res, 60));
    dit(!!(r && r.accepte === false && r.code === 'vinted-absent' && r.raison), 'aucun compte Vinted dans ce Chrome ⇒ refus « vinted-absent », avec la raison', JSON.stringify(r));
    dit(pagesLues(f.j).length === 0, '… et aucune requête Vinted', `${pagesLues(f.j).length}`);
  });
  await essaie('pause', async () => {
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)]), vinted: vintedPages({ 801: 14 }), connecte: UID,
      store: { vrmPauseVinted: { jusqua: Date.now() + 20 * 60000, niveau: 1, statut: 429 } } });
    const r = await cmd(f.ctx, 801, 14);
    await new Promise((res) => setTimeout(res, 60));
    dit(!!(r && r.accepte === false && r.code === 'vinted-pause'), 'Vinted a demandé de ralentir ⇒ refus « vinted-pause »', JSON.stringify(r));
    dit(pagesLues(f.j).length === 0, '… et aucune requête Vinted pendant la pause', `${pagesLues(f.j).length}`);
  });
  await essaie('budget', async () => {
    const t = Date.now();
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)]), vinted: vintedPages({ 801: 14 }), connecte: UID,
      store: { vrmLectures: { [UID]: Array.from({ length: 20 }, () => t) } } });
    const r = await cmd(f.ctx, 801, 14);
    const fin = await attendreFin(f.store, 'photos:801');
    dit(pagesLues(f.j).length === 0, '20 lectures dans l\'heure ⇒ aucune requête Vinted (le plafond du clic tient)', `${pagesLues(f.j).length}`);
    dit(!!(r && r.accepte && fin && fin.etape === 'echec' && fin.code === 'trop-de-lectures' && fin.raison), '… et la commande finit « échec » avec la raison du budget', JSON.stringify(fin && { etape: fin.etape, code: fin.code }));
  });

  console.log('── 4. « pas su » : la base ne répond pas sur les photos captées');
  await essaie('pas su', async () => {
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)]), vinted: vintedPages({ 801: 14 }), connecte: UID,
      lectureKO: (u) => /vinted_item_details/.test(u) });
    await cmd(f.ctx, 801, 14);
    const fin = await attendreFin(f.store, 'photos:801');
    dit(pagesLues(f.j).length === 0 && !f.j.posts.some((ids) => ids.includes('vinted_item_details')), 'rien n\'est lu chez Vinted, rien n\'est écrit', `${pagesLues(f.j).length} lecture(s)`);
    dit(!!(fin && fin.etape === 'echec' && fin.code === 'lecture'), 'la commande dit « la base n\'a pas répondu » (code lecture), jamais « fait »', JSON.stringify(fin && { etape: fin.etape, code: fin.code }));
  });

  console.log('── 5. un double clic ne lit qu\'une fois');
  await essaie('double', async () => {
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)]), vinted: vintedPages({ 801: 14 }), connecte: UID });
    const [a, b] = await Promise.all([cmd(f.ctx, 801, 14), cmd(f.ctx, 801, 14)]);
    await attendreFin(f.store, 'photos:801');
    await new Promise((res) => setTimeout(res, 80));
    dit(pagesLues(f.j, 801).length === 1, 'deux commandes simultanées ⇒ UNE lecture chez Vinted', `${pagesLues(f.j, 801).length} lecture(s) — ${JSON.stringify([a && a.etape, b && b.etape])}`);
  });

  console.log('── 6. une relecture n\'efface plus la fiche de codes');
  await essaie('codes', async () => {
    const d = { '801': { photos: [img(801, 0)], codes: { catalog_id: 1242 }, photoIds: [7] } };
    const f = faireFond({ src: SRC, lignes: base([listing(801, 14)], d), vinted: vintedPages({ 801: 14 }), connecte: UID });
    // La lecture au clic elle-même (`completerPhotos`, partagée avec Leboncoin) :
    // elle existe des deux côtés, la preuve vaut donc sur le code d'avant aussi.
    const lu = await f.ctx.completerPhotos(UID, '801');
    const det = (f.lignes.vinted_item_details || {})['801'] || {};
    dit(lu === true && (det.photos || []).length === 14, 'la page est lue et ses 14 photos rangées', `rendu=${lu}, ${(det.photos || []).length} rangée(s)`);
    dit(!!(det.codes && det.codes.catalog_id === 1242 && Array.isArray(det.photoIds)), 'codes et identifiants de photos gardés après la relecture', JSON.stringify({ codes: det.codes || null, photoIds: det.photoIds || null }));
  });

  console.log('── 7. le fond lit d\'abord l\'annonce à qui il manque des photos');
  await essaie('tri', async () => {
    // Huit annonces DÉJÀ complètes mais sans fiche de codes (elles repassent
    // toutes les 6 h), avec plus de photos que la neuve ; la neuve n'a rien.
    const completes = Array.from({ length: 8 }, (_, i) => listing(900 + i, 17));
    const d = {}; for (const it of completes) d[String(it.id)] = { photos: Array.from({ length: 17 }, (_, k) => img(it.id, k)) };
    const items = [...completes, listing(801, 12)];
    const n = {}; for (const it of items) n[it.id] = it.nPhotos;
    const f = faireFond({ src: SRC, lignes: base(items, d), vinted: vintedPages(n), connecte: UID });
    await f.ctx.capterPhotosAnnonces(UID);
    const lues = pagesLues(f.j).map((r) => r.chemin.replace('/items/', ''));
    dit(lues.length > 0 && lues.length < items.length, 'le budget de fond ne lit pas tout d\'un coup (sinon l\'ordre ne compterait pas)', `${lues.length} lue(s) sur ${items.length}`);
    dit(lues[0] === '801', 'la paire neuve (0 photo captée sur 12) est lue EN PREMIER', `ordre : ${lues.join(', ') || 'aucune'}`);
    dit(f.j.evts.some((e) => e && e.type === 'maj' && e.quoi === 'photos'), "l'app est prévenue quand le fond a rangé des photos");
  });

  console.log(`\n${ko ? '❌ ' + ko + ' rouge(s)' : '✅ tout vert'} · ${ok} contrôle(s)`);
  process.exit(ko ? 1 : 0);
})();
