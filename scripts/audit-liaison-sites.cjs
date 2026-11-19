// ════════════════════════════════════════════════════════════════════════════
//  « RELIER MES ANNONCES » — LA LIAISON GUIDÉE ENTRE VINTED ET LES AUTRES SITES (19 nov.)
//
//  Julien : « ça doit être irréprochable. Il ne peut pas y avoir d'erreur. » Ce lien décide quelle
//  annonce VRM dit de retirer ailleurs quand la paire est vendue, et sous quel N° elle est rangée.
//  Cet audit EXÉCUTE les règles (src/liaisonSites.js), les gestes (src/liaisonActions.js, avec des
//  lectures qui échouent et un écrivain qui note tout), la vraie règle « même photo »
//  (src/memePhoto.js, empreintes inventées), le vrai moteur des opérations (src/gesteAnnulable.js)
//  et les vraies `numeroExterne` / `prochainLibre` d'App.jsx. Aucune donnée réelle (dépôt public).
//
//   A  la taille : lue SÛRE (champ, « taille 42 ») ou « peut-être » (un nombre isolé) ; « Pegasus 40
//      43 » ⇒ pas lue ; l'écart de prix « fort » est épinglé (double ET 20 €) ;
//   B  la file : 50 paires au même titre / taille / photo proche ⇒ AUCUNE mise en avant, à égalité,
//      dans l'ordre de leurs N° ; un titre identique parmi 30 ⇒ PREMIÈRE de la liste (un ordre de
//      proposition, jamais un lien) ; « même photo · sûr » UNIQUE ⇒ en tête, mise
//      en avant, JAMAIS reliée par le calcul ; déjà reliée ⇒ jamais reproposée ; deux paires ⇒
//      aucune mise en avant ; lecture ratée ⇒ `lu: false` (pas su ≠ rien) ; les pistes « publiée par
//      VRM » jamais mises en avant ;
//   C  les gardes : deuxième lien sur la même annonce ⇒ refus ; tailles lues différentes ⇒ refus ;
//      taille « peut-être », prix fort, marque, référence écrite ≠ ⇒ UNE question ; une paire, une
//      annonce par site (sauf déclaration) ; N° double, sans N° ⇒ refus ; carte pas lue ⇒ rien ;
//   D  délier (et « Annuler ») rend EXACTEMENT l'état d'avant, sur les trois sites ;
//   E  le lot : seulement les « sûres » mises en avant, chacune rejugée après la précédente ;
//   F  les liens qui se contredisent sont LISTÉS (deux N°, deux annonces, taille, orphelin, prix),
//      jamais tranchés ; « garder » les fait taire ;
//   G  un N° d'avant la remise à zéro du 11 oct. désigne l'ANCIENNE paire (vraie `numeroExterne`) ;
//   H  les gestes : lecture ratée ⇒ rien d'écrit ; carte périmée ⇒ refus ; la relecture confirme ;
//      « pas sur Vinted » ne redonne jamais un N° servi (vraie `prochainLibre` : après le plus
//      haut, jamais un trou) ;
//   I  le câblage : relier n'est appelé que par un geste du parcours ; les règles n'écrivent rien ;
//   J  l'ARTICLE au centre, Vinted n'est pas le pivot : une annonce Leboncoin se relie à l'article
//      d'une annonce eBay (sans aucune annonce Vinted) ; deux N° en jeu ⇒ il est DEMANDÉ lequel est
//      écrit sur le carton, l'autre reste servi (« à barrer ») ; rien n'est tranché seul.
//  `--src chemin` : un autre arbre (rouge sur le code d'avant, §6.1).
//  `--mutation=<nom>|toutes` : réaffaiblit une garde ⇒ doit être ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const R = 'src/liaisonSites.js', A = 'src/liaisonActions.js';
const MUTATIONS = {
  // Les gardes de la règle.
  dejaReliee: [R, "  if (annonce.relie || cle(annonce.numero || '')) return { ok: false, refus: 'annonce-reliee', numero: cle(annonce.numero || '') };\n", ''],
  deuxiemeLien: [R, "  if (deja) return { refus: 'annonce-reliee', numero: cle(deja.numero || '') };\n  const j = jugerLien(", '  const j = jugerLien('],
  taille: [R, "  if (t.verdict === 'differentes') return { ok: false, refus: 'taille', tailleAnnonce: t.annonce, taillePaire: t.paire, numero: n };\n", ''],
  tailleDoute: [R, "  if (t.verdict === 'doute') doutes.push('taille');\n", ''],
  tailleTitre: [R, "  return vus.size === 1 ? { taille: [...vus][0], sure: false } : { taille: '', sure: false };", "  return vus.size >= 1 ? { taille: [...vus][0], sure: true } : { taille: '', sure: false };"],
  pairePrise: [R, "  if (prise && !(accepte && accepte.plusieurs)) return { ok: false, refus: 'paire-prise', autre: prise, numero: n, declarable: annonce.plateforme !== 'Vestiaire' };\n", ''],
  prix: [R, "  if (ecartPrixFort(annonce.prix, paire.prix)) doutes.push('prix');\n", ''],
  marque: [R, "  if (marquesDifferentes(annonce, paire, marqueDe)) doutes.push('marque');\n", ''],
  reference: [R, "  if (ecritAutre) doutes.push('reference');\n", ''],
  question: [R, '  if (doutes.length && !(accepte && accepte.doutes)) return {', '  if (false) return {'],
  numeroDouble: [R, "  if (douteux.has(n)) return { ok: false, refus: 'numero-double', numero: n };\n", ''],
  sansNumero: [R, "  if (!n) return { ok: false, refus: 'sans-numero' };\n", "  if (!n) return { ok: true, numero: '', doutes: [], plusieurs: false };\n"],
  pasSu: [R, "  const C = cartesLues(cartes);\n  if (!C) return { refus: 'pas-su' };\n  if (!annonce || annonce.id == null || !paire) return { refus: 'identite' };", "  const C = cartesLues(cartes) || { lbc: {}, ebay: {}, vc: {}, journal: {} };\n  if (!annonce || annonce.id == null || !paire) return { refus: 'identite' };"],
  // La file : jamais de mise en avant sur autre chose que « sûr », unique, sans doute.
  avantVerifier: [R, "    if (candidats.length === 1 && !ph.ambigu && candidats[0].niveau === 'sur') {", '    if (candidats.length >= 1) {'],
  avantDoute: [R, '      if (j.ok && !j.doutes.length && !j.plusieurs && !j.barre) avant = String(candidats[0].paire.id);', '      avant = String(candidats[0].paire.id);'],
  avantDeuxNumeros: [R, '      if (j.ok && !j.doutes.length && !j.plusieurs && !j.barre) avant = String(candidats[0].paire.id);', '      if ((j.ok || j.demander) && !(j.doutes || []).length && !j.plusieurs) avant = String(candidats[0].paire.id);'],
  ambiguSur: [R, "      for (const p of arr(x.paires)) { const paire = paireDe(p); if (paire && !cs.some((c) => c.paire === paire)) cs.push({ paire, niveau: 'verifier',", "      for (const p of arr(x.paires)) { const paire = paireDe(p); if (paire && !cs.some((c) => c.paire === paire)) cs.push({ paire, niveau: p.etat === 'sur' ? 'sur' : 'verifier',"],
  relieeDansFile: [R, "  const file = entrees.filter((e) => e.etat === 'aRelier').sort(ordre);", '  const file = entrees.slice().sort(ordre);'],
  passuFile: [R, '  if (!Array.isArray(autres) || !Array.isArray(paires)) return vide;\n', '  if (!Array.isArray(autres)) autres = [];\n  if (!Array.isArray(paires)) paires = [];\n'],
  pisteAvant: [R, "        candidats.push({ paire, niveau: 'verifier', raison: 'publiee', photoAutre: '', photoVinted: '', jugement });", "        candidats.push({ paire, niveau: 'verifier', raison: 'publiee', photoAutre: '', photoVinted: '', jugement }); if (!avant) avant = String(paire.id);"],
  pistesTrop: [R, '      if (libres.length && libres.length <= PISTES_MAX) for (const x of libres) {', '      if (libres.length) for (const x of libres) {'],
  ordreProximite: [R, '  out.sort((x, y) => x.rang - y.rang || y.proche - x.proche || ', '  out.sort((x, y) => x.rang - y.rang || '],
  ordrePhotoApres: [R, '  out.sort((x, y) => x.rang - y.rang || y.proche - x.proche || ', '  out.sort((x, y) => y.proche - x.proche || x.rang - y.rang || '],
  ordreNumeroTape: [R, "    const rang = exact ? 0 : c ? (c.niveau === 'sur' ? 1 : c.raison === 'publiee' ? 3 : 2) : 4;", "    const rang = c ? (c.niveau === 'sur' ? 1 : c.raison === 'publiee' ? 3 : 2) : 4;"],
  priseProposee: [R, '      if (!c && prises.has(k)) continue;\n', ''],
  // Le lot.
  lotPasSur: [R, "    if (!c || c.niveau !== 'sur') { restes.push({ cle: e && e.cle, refus: 'pas-sure' }); continue; }\n", "    if (!c) { const c2 = arr(e && e.candidats)[0]; if (c2) { const r2 = opsRelier({ annonce: e.annonce, paire: c2.paire, preuve: 'photo', cartes: C, autres: vus, numerosDouteux, cle, marqueDe, maintenant }); if (r2.ops) { ops.push(...r2.ops); faits.push({ cle: e.cle, numero: r2.numero }); } } continue; }\n"],
  lotSansRejuger: [R, '    vus = vus.map((x) => (x && cleAnnonce(x) === e.cle ? { ...x, relie: true, numero: r.numero } : x));\n', ''],
  // Délier.
  delierJournal: [R, "  if (lienJ) ops.push({ k: CLE_LIAISON, type: 'cle', id: cleJournal('lien', k), apres: undefined, avant: lienJ });\n", ''],
  delierEcrit: [R, "  if (!deja && !lienJ) return { refus: 'ecrit-sur-le-site' };\n", "  if (!deja && !lienJ) return { ops: [{ k: CLES_LIENS[annonce.plateforme], type: 'cle', id, apres: undefined, avant: undefined }], numero: '' };\n"],
  delierSonNumero: [R, "    const retour = annonce.plateforme === 'Leboncoin' && pr && cle(pr.numero || '') ? String(pr.numero).trim() : undefined;", '    const retour = undefined;'],
  // Les contradictions.
  deuxNumeros: [R, "    if (nums.length >= 2 && !vus.has('reference')) pousser(", '    if (false) pousser('],
  deuxAnnonces: [R, '    if (l.length < 2) continue;\n    const declarees', '    if (l.length < 3) continue;\n    const declarees'],
  orphelin: [R, '    if (!p) { if (connus && !connus.has(n) && !(lienJ && lienJ.article && !lienJ.vinted)) pousser(', '    if (!p) { if (false) pousser('],
  // L'article au centre : deux N° en jeu.
  deuxNSansDemander: [R, "    const g = cle((accepte && accepte.garder) || '');", "    const g = cle((accepte && accepte.garder) || n);"],
  garderVinted: [R, "    if (g === a && vintedDe(paire)) return { ok: false, refus: 'garder-vinted', numero: n, garder: a };\n", ''],
  articleSansVinted: [R, "    if (!a || a.id == null || !SITES_LIAISON.includes(a.plateforme) || a.enVente === false) continue;\n    const brut = String(a.numero || a.numeroSite || '').trim();", "    if (true) continue;\n    const brut = String(a.numero || a.numeroSite || '').trim();"],
  sonNumeroPasUnLien: [R, "    return pr && cle(pr.numero || '') === cle(v) ? null : { numero: String(v) };", '    return null;'],
  sansArticle: [R, "  const propre = !relie && !reunie && (sansArticle || (!!pr && pr.actif !== false));", "  const propre = !relie && !reunie && (!!pr && pr.actif !== false);"],
  // « Pas sur Vinted ».
  numeroServi: [R, "  if (n && servis && (servis instanceof Set ? servis.has(n) : arr(servis).map((x) => cle(x)).includes(n))) return { refus: 'numero-servi', numero: n };\n", ''],
  // La relecture.
  verifAutre: [R, "  return cle(entree.numero) === cle(attendu || '') ? 'verifie' : 'autre';", "  return 'verifie';"],
  // Les gestes.
  gestePasPret: [A, "  const cartes = () => (pret() ? { lbc: lireCarte(CLES_LIENS.Leboncoin), ebay: lireCarte(CLES_LIENS.eBay), vc: lireCarte(CLES_LIENS.Vestiaire), journal: lireCarte(CLE_LIAISON) } : { lbc: undefined, ebay: undefined, vc: undefined, journal: undefined });", "  const cartes = () => ({ lbc: lireCarte(CLES_LIENS.Leboncoin) || {}, ebay: lireCarte(CLES_LIENS.eBay) || {}, vc: lireCarte(CLES_LIENS.Vestiaire) || {}, journal: lireCarte(CLE_LIAISON) || {} });"],
  gesteSeul: [A, '      publier(etat);\n', "      publier(etat);\n      for (const e of res.file) if (e.avant) relier({ annonce: e.annonce, paire: e.candidats[0].paire, preuve: 'photo-sure' });\n"],
  gesteDuree: [A, 'export const DUREE_ANNULER_LIEN = 10000;', 'export const DUREE_ANNULER_LIEN = 1000;'],
  // Le câblage de l'app : un lien posé tout seul au chargement.
  appSeul: ['src/App.jsx', '    publierMemePhoto(etat);\n', "    publierMemePhoto(etat);\n    for (const p of res.propositions) if (p.etat === 'sur') liaisonVrm().then((L) => L.relier({ annonce: p.annonce, paire: { id: (p.vinted[0] || {}).id, numero: p.numero }, preuve: 'photo-sure' }));\n"],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : MUT.split(',');
  let rouges = 0;
  for (const nom of noms) {
    const [f, avant, apres] = MUTATIONS[nom] || [];
    if (!f) { console.log(`❓ mutation inconnue : ${nom}`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-liaison-'));
    for (const d of ['src', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true, filter: (s) => !/[\\/]bancs[\\/](fx|captures)/.test(s) });
    fs.mkdirSync(path.join(tmp, 'api'), { recursive: true }); fs.cpSync(path.join(RACINE, 'api', '_lib'), path.join(tmp, 'api', '_lib'), { recursive: true });
    const cible = path.join(tmp, f); const t = fs.readFileSync(cible, 'utf8');
    if (!t.includes(avant)) { console.log(`❓ ${nom} : texte introuvable`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(cible, t.replace(avant, apres));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'audit-liaison-sites.cjs'), '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0; if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' — ' + (r.stdout.split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 130) : ''}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${rouges}/${noms.length} mutations rouges`);
  process.exit(rouges === noms.length ? 0 : 1);
}

let ko = 0, n = 0;
const dit = (ok, nom, det) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || det == null ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 320)}`); };
// Égalité de VALEUR (l'ordre des clés d'un objet ne compte pas ; `undefined` = absent).
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' && !(v instanceof Set) ? Object.fromEntries(Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => [k, canon(v[k])])) : v);
const egal = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const tic = () => new Promise((ok) => setTimeout(ok, 15));
const cle = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const MARQUES = ['Nike', 'Adidas', 'New Balance', 'Asics', 'Salomon', 'Puma'];
const marqueDe = (t) => { const x = String(t || '').toLowerCase(); return MARQUES.find((m) => x.includes(m.toLowerCase())) || null; };

// Images inventées : un NOM ⇒ des pixels (les mêmes blocs que audit-meme-photo ; « ~texture » : une autre prise de vue).
function pixels(nom, w = 64, h = w) {
  const base = String(nom).replace(/~.*$/, '');
  let s = 0; for (const c of base) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const px = new Uint8ClampedArray(w * h * 4);
  const blocs = Array.from({ length: 64 }, () => Math.floor(r() * 255));
  const bruit = /~bruit/.test(nom), texture = /~texture/.test(nom);
  let g = 0; for (const c of String(nom)) g = (g * 33 + c.charCodeAt(0)) >>> 0;
  let t = 7;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = blocs[Math.floor((y * 8) / h) * 8 + Math.floor((x * 8) / w)];
    if (bruit) { t = (t * 1103515245 + 12345) >>> 0; v = Math.max(0, Math.min(255, v + ((t >>> 16) % 7) - 3)); }
    if (texture) { g = (g * 1103515245 + 12345) >>> 0; if (((x >> 2) + (y >> 2)) % 3 === 0) v = Math.max(0, Math.min(255, v + ((g >>> 16) % 61) - 30)); }
    const k = (y * w + x) * 4; px[k] = v; px[k + 1] = v; px[k + 2] = v; px[k + 3] = 255;
  }
  return px;
}

(async () => {
  let L, ACT, MP, EMP, FINE, GA;
  try {
    L = await import(path.join(RACINE, 'src', 'liaisonSites.js'));
    ACT = await import(path.join(RACINE, 'src', 'liaisonActions.js'));
    MP = await import(path.join(RACINE, 'src', 'memePhoto.js'));
    EMP = await import(path.join(RACINE, 'src', 'photoEmpreinte.js'));
    FINE = await import(path.join(RACINE, 'src', 'photoFine.js'));
    GA = await import(path.join(RACINE, 'src', 'gesteAnnulable.js'));
  } catch (e) { dit(false, '0 · les règles du parcours existent (src/liaisonSites.js, src/liaisonActions.js)', String(e && e.message).slice(0, 160)); console.log(`\n❌ audit-liaison-sites : ${ko} rouge(s) sur ${n}`); process.exit(1); }
  try {
    const H = (nom) => EMP.empreinteDepuisPixels(pixels(nom), 64, 64);
    const uV = (x) => `https://images1.vinted.net/t/${x}/f800/1.jpeg`;
    const uL = (x) => `https://img.leboncoin.fr/api/v1/lbcpb1/images/${x}.jpg`;
    const paire = (id, numero, o = {}) => ({ id: String(id), numero: String(numero), titre: 'Nike Air Max 90 blanche', taille: '42', prix: 60, marque: 'Nike', compte: '111', compteNom: 'compte_un', place: '', photo: uV('p' + id), ...o });
    const ann = (plateforme, id, o = {}) => ({ plateforme, id: String(id), compte: 'c1', compteNom: 'Compte A', titre: 'Nike Air Max 90 blanche taille 42', photo: uL('a' + id), lien: null, relie: false, numero: '', prix: 60, identites: [], enVente: true, ...o });
    const CARTES = () => ({ lbc: {}, ebay: {}, vc: {}, journal: {} });
    const sur = { s: 0.95, r: 0.9995, v: FINE.VERSION_FINE };

    // ── A · la taille, le prix ──
    const tl = (t, o) => L.tailleLue(t, o);
    dit(egal(tl('42,5', { champ: true }), { taille: '42.5', sure: true }) && egal(tl('L / 40 / 12', { champ: true }), { taille: 'L', sure: true }) && tl('6 ans / 116 cm', { champ: true }).taille === '' && tl('Taille unique', { champ: true }).taille === '',
      'A1 · un CHAMP : « 42,5 » ⇒ 42.5 sûre, « L / 40 / 12 » ⇒ L, « 6 ans / 116 cm » et « Taille unique » ⇒ pas lue', [tl('42,5', { champ: true }), tl('L / 40 / 12', { champ: true })]);
    dit(egal(tl('Air Max 90 taille 42,5'), { taille: '42.5', sure: true }) && egal(tl('Jordan 4 T.44'), { taille: '44', sure: true }) && egal(tl('NB 550 EU 43'), { taille: '43', sure: true }),
      'A2 · un TITRE avec « taille / T. / EU » ⇒ lue SÛRE', [tl('Air Max 90 taille 42,5'), tl('Jordan 4 T.44')]);
    dit(egal(tl('Nike Pegasus 40 noir'), { taille: '40', sure: false }) && tl('Nike Pegasus 40 43').taille === '' && tl('Air Max 97').taille === '' && tl('').taille === '',
      'A3 · un nombre isolé ⇒ « peut-être » (jamais sûre) ; deux nombres possibles (« Pegasus 40 43 ») ⇒ pas lue ; 97 ⇒ rien', [tl('Nike Pegasus 40 noir'), tl('Nike Pegasus 40 43')]);
    dit(L.PRIX_RAPPORT_FORT === 2 && L.PRIX_ECART_MIN === 20 && L.ecartPrixFort(40, 90) && !L.ecartPrixFort(39, 63) && !L.ecartPrixFort(5, 12) && !L.ecartPrixFort(null, 90) && !L.ecartPrixFort(60, 60),
      'A4 · écart de prix FORT = le double ET 20 € de plus (1,62 fois, mesuré sur un vrai lien, ne pose aucune question) ; prix pas lu ⇒ aucun doute', '');
    dit(L.marquesDifferentes({ titre: 'Adidas Samba' }, { marque: 'Nike', titre: 'x' }, marqueDe) && !L.marquesDifferentes({ titre: 'Nike SB Dunk' }, { marque: 'Nike SB', titre: 'x' }, marqueDe) && !L.marquesDifferentes({ titre: 'basket blanche' }, { marque: 'Nike' }, marqueDe),
      'A5 · marque lue des deux côtés et différente ⇒ doute ; « Nike SB » = « Nike » ; inconnue d’un côté ⇒ rien', '');

    // ── B · la file, avec la VRAIE règle « même photo » ──
    const monde = () => ({ vinted: [], ev: {}, autres: [], es: { Leboncoin: {}, eBay: {}, Vestiaire: {} }, paires: [], verifs: {} });
    const addV = (m, id, numero, photo, o = {}) => { m.vinted.push({ id: String(id), compte: '111', numero: String(numero), titre: o.titre || 'Nike Air Max 90 blanche', photo: uV(photo), lien: null }); (m.ev['111'] = m.ev['111'] || {})[id] = { [uV(photo)]: H(photo) }; if (numero) m.paires.push(paire(id, numero, { photo: uV(photo), ...o })); };
    const addA = (m, plateforme, id, photo, o = {}) => { m.autres.push(ann(plateforme, id, { photo: uL(photo), ...o })); if (photo) m.es[plateforme][id] = { [uL(photo)]: H(photo) }; };
    const mesurer = (m, site, idA, photoA, idV, photoV) => { m.verifs[FINE.cleCoupleFin(MP.SITE_COURT[site], String(idA), uL(photoA), '111', String(idV), uV(photoV))] = sur; };
    const calc = (m, o = {}) => {
      const mp = MP.propositionsMemePhoto({ vinted: m.vinted, autres: m.autres, empreintes: { vinted: m.ev, ...m.es }, refus: {}, numerosDouteux: o.douteux || null, cle, verifs: m.verifs });
      return L.construireLiaison({ autres: m.autres, paires: m.paires, memePhoto: mp, journal: o.journal || {}, numerosDouteux: o.douteux || null, numerosConnus: o.connus || null, cle, marqueDe, pistes: o.pistes || null });
    };

    { // B1 — 50 paires identiques, photos PROCHES (même modèle au même endroit), une annonce Leboncoin du même modèle.
      const m = monde();
      for (let i = 1; i <= 50; i++) addV(m, 3000 + i, i, 'studio-airmax~texture' + i);
      addA(m, 'Leboncoin', 9001, 'studio-airmax~texture999');
      const avant = JSON.stringify([m.autres, m.paires]);
      const r = calc(m);
      const e = r.parCle.get('Leboncoin:9001');
      dit(r.lu && e && e.etat === 'aRelier' && e.avant === null && e.candidats.every((c) => c.niveau !== 'sur') && e.candidats.length === 0,
        'B1 · 50 paires au même titre, même taille, photos proches ⇒ AUCUNE mise en avant, aucune candidate par ressemblance', { avant: e && e.avant, c: e && e.candidats.length });
      const tr0 = L.candidatesPour(e, r.articles, { autres: m.autres, cle });
      dit(tr0.length === 50 && tr0.every((c, i) => Number(c.paire.numero) === i + 1 && !c.niveau && c.proche === tr0[0].proche) && L.candidatesPour(e, r.articles, { taille: '42', autres: m.autres, cle }).length === 50,
        'B1 · les 50 sont à ÉGALITÉ (même taille, mêmes mots) : montrées dans l’ordre de leurs N°, aucune choisie pour lui — il choisit par N° / place', tr0.slice(0, 4).map((c) => [c.paire.numero, c.proche]));
      const un = L.candidatesPour(e, r.articles, { q: 'n°37', autres: m.autres, cle });
      dit(un.length === 1 && un[0].paire.numero === '37' && un[0].exact && L.candidatesPour(e, r.articles, { q: '37', autres: m.autres, cle })[0].paire.numero === '37', 'B1 · le N° tapé (« n°37 », « 37 ») trouve SON article en tête', un.map((c) => c.paire.numero));
      dit(JSON.stringify([m.autres, m.paires]) === avant && r.compteur.aRelier === 1 && r.compteur.surs === 0, 'B1 · le calcul n’a rien relié ni rien modifié (1 à relier, 0 sûre)', r.compteur);
    }
    { // B1 bis — la capture de Julien (19 nov.) : « Adidas Spezial vert taille 39,5 » sur Leboncoin, la paire Vinted au même titre était 3e.
      const titres = ['adidas handball spezial noir taille 35', 'salomon XT-6 gris taille 40', 'nike p-6000 gris et vert taille 40', 'adidas handball spezial marron taille 36', 'adidas handball spezial rose taille 36', 'new balance 530 beige taille 38'];
      const m = monde();
      for (let i = 0; i < 29; i++) addV(m, 4000 + i, 200 + i, 'v' + i, { titre: titres[i % titres.length] + (i >= titres.length ? ' ' + i : ''), taille: String(35 + (i % 9)), marque: '' });
      addV(m, 4100, 234, 'spezial-vert', { titre: 'adidas spezial vert taille 39,5', taille: '39,5', marque: 'adidas' });
      m.autres.push(ann('Leboncoin', 9100, { titre: 'Adidas Spezial vert taille 39,5', photo: uL('lbc-spezial'), prix: 70 }));
      const r = calc(m); const e = r.parCle.get('Leboncoin:9100');
      const l = L.candidatesPour(e, r.articles, { autres: m.autres, cle });
      dit(l.length === 30 && l[0].paire.numero === '234' && l[0].proche > l[1].proche && e.avant === null && e.candidats.length === 0 && r.compteur.surs === 0,
        'B1 · un titre et une taille identiques parmi 30 ⇒ PREMIÈRE de la liste (N°234) — un ordre de proposition : aucune mise en avant, rien de relié', { tete: l.slice(0, 3).map((c) => [c.paire.numero, c.proche]), avant: e.avant });
      dit(l.findIndex((c) => L.tailleDe(c.paire).taille === '39.5') === 0 && l.slice(-1)[0].proche < 0 || l.every((c, i) => i === 0 || c.proche <= l[i - 1].proche), 'B1 · … puis les autres, du plus proche au moins proche (une taille différente passe derrière)', l.slice(0, 5).map((c) => c.proche));
      // Une « même photo · sûr » d'un AUTRE titre reste devant la plus ressemblante ; le N° tapé devant tout.
      const m2 = monde(); addV(m2, 1, 10, 'photo-x', { titre: 'chaussure grise', taille: '' }); addV(m2, 2, 11, 'photo-y', { titre: 'Adidas Spezial vert taille 39,5', taille: '39,5' }); addV(m2, 3, 12, 'photo-z', { titre: 'autre', taille: '' });
      addA(m2, 'Leboncoin', 9101, 'photo-x~bruit', { titre: 'Adidas Spezial vert taille 39,5' }); mesurer(m2, 'Leboncoin', 9101, 'photo-x~bruit', 1, 'photo-x');
      const r2 = calc(m2); const e2 = r2.parCle.get('Leboncoin:9101');
      const l2 = L.candidatesPour(e2, r2.articles, { autres: m2.autres, cle }), l3 = L.candidatesPour(e2, r2.articles, { q: '12', autres: m2.autres, cle });
      // « 10 » tapé : N°10 d'abord — même si un autre article (« … 10 ans », même photo sûre) contient « 10 » dans son titre.
      const m3 = monde(); addV(m3, 1, 21, 'photo-x', { titre: 'chaussure grise édition 10 ans', taille: '' }); addV(m3, 2, 10, 'photo-y', { titre: 'autre', taille: '' });
      addA(m3, 'Leboncoin', 9102, 'photo-x~bruit', { titre: 'chaussure' }); mesurer(m3, 'Leboncoin', 9102, 'photo-x~bruit', 1, 'photo-x');
      const r3 = calc(m3); const l4 = L.candidatesPour(r3.parCle.get('Leboncoin:9102'), r3.articles, { q: '10', autres: m3.autres, cle });
      dit(l2[0].paire.numero === '10' && l2[0].niveau === 'sur' && l2[1].paire.numero === '11' && l3[0].paire.numero === '12' && l3[0].exact && egal(l4.map((c) => c.paire.numero), ['10', '21']), 'B1 · l’ordre : le N° tapé, puis « même photo · sûr », puis la plus proche par le titre et la taille', [l2.map((c) => c.paire.numero), l3.map((c) => c.paire.numero), l4.map((c) => c.paire.numero)]);
      // Un article qui a DÉJÀ une annonce sur ce site sort de la liste par défaut ; son N° tapé le retrouve.
      const m4 = monde(); addV(m4, 1, 10, 'a'); addV(m4, 2, 11, 'b'); m4.autres.push(ann('Leboncoin', 1, { relie: true, numero: '10', identites: [{ sorte: 'lien', numero: '10' }] }), ann('Leboncoin', 2));
      const r4 = calc(m4); const e4 = r4.parCle.get('Leboncoin:2');
      dit(egal(L.candidatesPour(e4, r4.articles, { autres: r4.autres, cle }).map((c) => c.paire.numero), ['11']) && L.candidatesPour(e4, r4.articles, { q: 'n10', autres: r4.autres, cle })[0].paire.numero === '10', 'B1 · un article qui a déjà une annonce sur ce site n’est pas proposé par défaut (son N° tapé le retrouve, le lien dira pourquoi)', '');
    }
    { // B2 — même photo sûre, unique.
      const m = monde();
      addV(m, 1001, 124, 'paire-124'); addV(m, 1002, 125, 'paire-125'); addV(m, 1003, 7, 'paire-7');
      addA(m, 'Leboncoin', 5002, 'autre-photo'); addA(m, 'Leboncoin', 5001, 'paire-124~bruit');
      mesurer(m, 'Leboncoin', 5001, 'paire-124~bruit', 1001, 'paire-124');
      const r = calc(m);
      const e = r.parCle.get('Leboncoin:5001');
      dit(e && e.avant === '1001' && e.candidats.length === 1 && e.candidats[0].niveau === 'sur' && e.candidats[0].paire.numero === '124' && r.file[0].cle === 'Leboncoin:5001' && r.compteur.surs === 1,
        'B2 · « même photo · sûr », UNIQUE ⇒ proposée en PREMIER (tête de file, mise en avant : N°124)', { avant: e && e.avant, tete: r.file[0] && r.file[0].cle });
      dit(e.etat === 'aRelier' && !e.annonce.relie && L.sursDuLot(r).length === 1, 'B2 · … et JAMAIS reliée par le calcul : elle reste « à relier » jusqu’à son toucher', e.etat);
      // sans la deuxième mesure : « à vérifier », pas de mise en avant.
      const m2 = monde(); addV(m2, 1001, 124, 'paire-124'); addA(m2, 'Leboncoin', 5001, 'paire-124~bruit');
      const e2 = calc(m2).parCle.get('Leboncoin:5001');
      dit(e2.candidats.length === 1 && e2.candidats[0].niveau === 'verifier' && e2.avant === null, 'B2 · une seule mesure (« à vérifier ») ⇒ montrée, JAMAIS mise en avant', { n: e2.candidats.length, avant: e2.avant });
      // sûr + un doute (prix du simple au triple) ⇒ pas de mise en avant.
      const m3 = monde(); addV(m3, 1001, 124, 'paire-124', { prix: 30 }); addA(m3, 'Leboncoin', 5001, 'paire-124~bruit', { prix: 95 }); mesurer(m3, 'Leboncoin', 5001, 'paire-124~bruit', 1001, 'paire-124');
      const e3 = calc(m3).parCle.get('Leboncoin:5001');
      dit(e3.candidats.length === 1 && e3.candidats[0].niveau === 'sur' && e3.avant === null && egal(e3.candidats[0].jugement.confirmer, ['prix']), 'B2 · « sûr » mais un vrai doute (prix du simple au triple) ⇒ plus de mise en avant, la question sera posée', e3.candidats[0].jugement);
    }
    { // B3 — déjà reliée : jamais reproposée.
      const m = monde(); addV(m, 1001, 124, 'paire-124');
      addA(m, 'Leboncoin', 5001, 'paire-124~bruit', { relie: true, numero: '124', identites: [{ sorte: 'lien', numero: '124' }] });
      mesurer(m, 'Leboncoin', 5001, 'paire-124~bruit', 1001, 'paire-124');
      const r = calc(m); const e = r.parCle.get('Leboncoin:5001');
      dit(e.etat === 'relie' && e.numero === '124' && e.candidats.length === 0 && e.avant === null && r.file.length === 0 && r.compteur.aRelier === 0, 'B3 · une annonce déjà reliée ⇒ jamais dans la file, aucune candidate', { etat: e.etat, file: r.file.length });
      // Même si la règle « même photo » la proposait encore (une lecture d'avant le lien) : rien n'est reproposé.
      const vieux = { lu: true, propositions: [{ id: 'Leboncoin:5001', annonce: m.autres[0], numero: '125', vinted: [{ id: '1002' }], etat: 'sur' }], ambigus: [] };
      m.paires.push(paire(1002, 125));
      const e2 = L.construireLiaison({ autres: m.autres, paires: m.paires, memePhoto: vieux, journal: {}, cle, marqueDe }).parCle.get('Leboncoin:5001');
      dit(e2.etat === 'relie' && e2.candidats.length === 0 && e2.avant === null, 'B3 · … même quand une proposition par photo PÉRIMÉE la désigne encore', { c: e2.candidats.length, avant: e2.avant });
    }
    { // B4 — la même photo sur deux paires : aucune mise en avant ; N° porté par deux paires : montrée, refusée.
      const m = monde(); addV(m, 1001, 124, 'boite'); addV(m, 1002, 125, 'boite~bruit'); addA(m, 'eBay', 2001, 'boite');
      mesurer(m, 'eBay', 2001, 'boite', 1001, 'boite');
      const e = calc(m).parCle.get('eBay:2001');
      dit(e.ambigu && e.candidats.length === 2 && e.candidats.every((c) => c.niveau === 'verifier') && e.avant === null, 'B4 · la même photo sur DEUX paires ⇒ les deux montrées « à vérifier », aucune mise en avant (même si l’une mesure « sûr »)', { n: e.candidats.length, niveaux: e.candidats.map((c) => c.niveau), avant: e.avant });
      const m2 = monde(); addV(m2, 1001, 124, 'paire-124'); addA(m2, 'Leboncoin', 5001, 'paire-124~bruit'); mesurer(m2, 'Leboncoin', 5001, 'paire-124~bruit', 1001, 'paire-124');
      const e2 = calc(m2, { douteux: new Set(['124']) }).parCle.get('Leboncoin:5001');
      dit(e2.avant === null && e2.candidats.length === 1 && e2.candidats[0].jugement.refus === 'numero-double', 'B4 · N° porté par deux paires présentes ⇒ jamais mise en avant, et le lien est refusé', e2.candidats.map((c) => c.jugement));
    }
    { // B5 — pas su ≠ rien.
      const r1 = L.construireLiaison({ autres: null, paires: [], cle }), r2 = L.construireLiaison({ autres: [], paires: null, cle });
      dit(!r1.lu && !r2.lu && L.compteurLiaison(r1) === null && L.compteurLiaison(r2) === null && L.etatLien(r1, 'Leboncoin', '1').etat === 'passu', 'B5 · annonces ou paires PAS LUES ⇒ `lu: false`, compteur `null` (jamais « 0 à relier »), état « pas su »', '');
      const m = monde(); addV(m, 1001, 124, 'paire-124'); addA(m, 'Vestiaire', 77, null, { enVente: null });
      const r3 = L.construireLiaison({ autres: m.autres, paires: m.paires, memePhoto: null, journal: {}, cle });
      dit(r3.lu && r3.file.length === 1 && r3.file[0].candidats.length === 0, 'B5 · photos pas lues, annonce « peut-être en ligne » ⇒ elle RESTE dans la file (pas su ≠ pas en ligne), sans candidate', r3.file.length);
    }
    { // B6 — « plus tard », « pas sur Vinted ».
      const m = monde(); addV(m, 1001, 124, 'paire-124'); addA(m, 'Leboncoin', 1, 'x1'); addA(m, 'Leboncoin', 2, 'x2'); addA(m, 'eBay', 3, 'x3');
      const r = calc(m, { journal: { 'tard:Leboncoin:1': '2026-11-19T10:00:00Z', 'propre:eBay:3': { at: '2026-11-19T10:00:00Z' } } });
      dit(r.file.map((e) => e.cle).join() === 'Leboncoin:2,Leboncoin:1' && r.parCle.get('eBay:3').etat === 'propre' && L.compteurLiaison(r).n === 1 && r.compteur.plusTard === 1,
        'B6 · « plus tard » passe en fin de file et sort du compteur d’entrée ; « pas sur Vinted » sort de la file', { file: r.file.map((e) => e.cle), c: L.compteurLiaison(r) });
    }
    { // B7 — les pistes « publiée par VRM sur ce site ».
      const m = monde(); for (let i = 1; i <= 9; i++) addV(m, 1000 + i, 100 + i, 'p' + i); addA(m, 'Vestiaire', 88, null);
      const e = calc(m, { pistes: { Vestiaire: ['101', '102', '103'] } }).parCle.get('Vestiaire:88');
      dit(e.candidats.length === 3 && e.candidats.every((c) => c.niveau === 'verifier' && c.raison === 'publiee') && e.avant === null, 'B7 · 3 paires publiées par VRM sur Vestiaire, annonce pas retrouvée ⇒ montrées « à vérifier », jamais mises en avant', { n: e.candidats.length, avant: e.avant });
      const e2 = calc(m, { pistes: { Vestiaire: ['101', '102', '103', '104', '105', '106', '107'] } }).parCle.get('Vestiaire:88');
      dit(L.PISTES_MAX === 6 && e2.candidats.length === 0, 'B7 · plus de 6 pistes ⇒ AUCUNE (une liste trop longue ne désigne personne)', e2.candidats.length);
    }

    // ── C · les gardes ──
    const P124 = paire(1001, 124), P125 = paire(1002, 125, { taille: '43' });
    const j = (a, p, o = {}) => L.jugerLien({ annonce: a, paire: p, autres: o.autres || [a], numerosDouteux: o.douteux || null, cle, marqueDe, accepte: o.accepte || {} });
    const rel = (a, p, o = {}) => L.opsRelier({ annonce: a, paire: p, preuve: o.preuve || 'recherche', cartes: o.cartes || CARTES(), autres: o.autres || [a], numerosDouteux: o.douteux || null, cle, marqueDe, accepte: o.accepte || {}, numeroVc: o.numeroVc || '', maintenant: '2026-11-19T10:00:00.000Z' });
    {
      const a = ann('Leboncoin', 5001);
      const r = rel(a, P124, { preuve: 'photo-sure' });
      dit(r.ops && r.ops.length === 2 && egal(r.ops[0], { k: 'vrm_lbc_liens', type: 'cle', id: '5001', apres: '124' }) && r.ops[1].k === 'vrm_liaison_sites' && r.ops[1].id === 'lien:Leboncoin:5001' && egal(r.ops[1].apres, { numero: '124', vinted: '1001', article: '1001', par: 'photo-sure', at: '2026-11-19T10:00:00.000Z' }),
        'C1 · Leboncoin : relier pose `vrm_lbc_liens[annonce] = N°` (l’identité que lit toute l’app) + la preuve et la date', r.ops);
      const apres = L.appliquerSurCartes(CARTES(), r.ops);
      const r2 = rel(a, P125, { cartes: apres, accepte: { doutes: true, plusieurs: true } });
      dit(r2.refus === 'annonce-reliee' && !r2.ops && r2.numero === '124', 'C1 · DEUXIÈME lien sur la même annonce (l’écran périmé la croit libre) ⇒ REFUSÉ sur les cartes courantes', r2);
      dit(j({ ...a, relie: true, numero: '124' }, P125).refus === 'annonce-reliee', 'C1 · une annonce reliée (lien, référence, SKU) ⇒ refus, quelle que soit la paire', '');
      const e = rel(ann('eBay', 2001), P124, { preuve: 'photo' });
      dit(e.ops && e.ops[0].k === 'vrm_ebay_liens' && e.ops[0].id === '2001' && e.ops[0].apres.pairId === '1001' && e.ops[0].apres.numero === '124' && e.ops[0].apres.par === 'photo' && Number.isFinite(e.ops[0].apres.at), 'C1 · eBay : `vrm_ebay_liens[itemId] = { pairId, numero, at, par }` (lu par `lienEbay`)', e.ops && e.ops[0]);
      const v0 = rel(ann('Vestiaire', 77, { numeroSite: '12' }), P124, { numeroVc: '12' });
      const v = rel(ann('Vestiaire', 77, { numeroSite: '12' }), P124, { numeroVc: '12', accepte: { garder: '124' } });
      dit(v0.demander === 'numero' && egal(v0.numeros, ['124', '12']) && !v0.ops && v.ops && v.ops[0].k === 'vrm_vc_liens' && v.ops[0].apres.numero === '124' && v.ops[0].apres.item === '1001' && v.ops[0].apres.de === '12' && v.ops[0].apres.ecrit === null && v.barre === '12',
        'C1 · Vestiaire : l’annonce porte déjà SON N°12 ⇒ il est DEMANDÉ lequel garder ; « N°124 » ⇒ la règle de `poserLienVc` (le N°12 « à barrer », jamais redonné)', [v0, v.ops && v.ops[0]]);
      const v2 = rel(ann('Vestiaire', 78), P124, { cartes: L.appliquerSurCartes(CARTES(), v.ops) });
      dit(v2.refus === 'paire-prise' && !v2.ops, 'C1 · Vestiaire : la paire Vinted déjà reliée à un AUTRE produit ⇒ refus (une liaison = un article)', v2);
    }
    {
      const a = ann('Leboncoin', 5001, { titre: 'Nike Air Max 90 taille 43' });
      const r = j(a, P124), w = rel(a, P124, { accepte: { doutes: true, plusieurs: true } });
      dit(r.refus === 'taille' && r.tailleAnnonce === '43' && r.taillePaire === '42' && w.refus === 'taille' && !w.ops, 'C2 · tailles LUES différentes des deux côtés (43 / 42) ⇒ REFUS expliqué, aucune confirmation ne le passe', [r, w.refus]);
      const b = ann('Leboncoin', 5002, { titre: 'Nike Pegasus 40 noir' });
      const rb = j(b, P124), wb = rel(b, P124), wb2 = rel(b, P124, { accepte: { doutes: true } });
      dit(egal(rb.confirmer, ['taille']) && !wb.ops && egal(wb.confirmer, ['taille']) && wb2.ops && egal(wb2.entree.doutes, ['taille']), 'C2 · taille « peut-être » (un nombre isolé du titre) différente ⇒ UNE question, pas un refus ; confirmée ⇒ le lien note le doute vu', [rb.confirmer, wb.confirmer]);
      dit(j(ann('Leboncoin', 5003, { titre: 'Nike Air Max 90' }), P124).ok === true && j(ann('Leboncoin', 5004), P124).ok === true && j(ann('Leboncoin', 5004), P124).doutes.length === 0, 'C2 · taille pas lue d’un côté, ou la même ⇒ SILENCE (aucune question)', '');
    }
    {
      const deja = ann('Leboncoin', 4000, { relie: true, numero: '124' });
      const a = ann('Leboncoin', 5001);
      const r = j(a, P124, { autres: [deja, a] });
      dit(r.refus === 'paire-prise' && r.autre.id === '4000' && r.declarable === true, 'C3 · une paire n’a qu’UNE annonce par site : N°124 a déjà une annonce Leboncoin ⇒ refus, l’autre annonce montrée', r.refus);
      const d = rel(a, P124, { autres: [deja, a], accepte: { plusieurs: true } });
      dit(d.ops && d.entree.plusieurs === true, 'C3 · déclaration explicite « la même paire en deux annonces » ⇒ relié, et le lien le NOTE', d.entree);
      dit(j(a, P124, { autres: [{ ...deja, enVente: false }, a] }).ok === true && j(a, P124, { autres: [{ ...deja, plateforme: 'eBay' }, a] }).ok === true, 'C3 · l’autre annonce n’est plus en vente, ou est sur un autre site ⇒ silence', '');
      dit(j(a, P124, { autres: [{ ...deja, enVente: null }, a] }).refus === 'paire-prise', 'C3 · « pas su si elle est en ligne » compte comme en ligne (pas su ≠ pas en ligne)', '');
    }
    {
      const px = j(ann('Leboncoin', 1, { prix: 150 }), P124), mq = j(ann('Leboncoin', 2, { titre: 'Adidas Samba taille 42' }), P124), rf = j(ann('eBay', 3, { identites: [{ sorte: 'reference', numero: '82' }] }), P124);
      dit(egal(px.confirmer, ['prix']) && egal(mq.confirmer, ['marque']) && egal(rf.confirmer, ['reference']) && rf.numeroEcrit === '82', 'C4 · écart de prix fort · marque différente · référence écrite sur le site qui dit un AUTRE N° ⇒ UNE question chacun', [px.confirmer, mq.confirmer, rf.confirmer]);
      dit(j(ann('eBay', 3, { identites: [{ sorte: 'reference', numero: '124' }] }), P124).ok === true, 'C4 · la référence écrite dit le MÊME N° ⇒ silence', '');
      const tous = j(ann('Leboncoin', 4, { prix: 150, titre: 'Adidas Samba 44' }), P124);
      dit(egal(tous.confirmer, ['taille', 'prix', 'marque']), 'C4 · plusieurs doutes ⇒ UNE seule question qui les porte tous', tous.confirmer);
      const ok = rel(ann('Leboncoin', 1, { prix: 150 }), P124, { accepte: { doutes: true } });
      dit(ok.ops && egal(ok.entree.doutes, ['prix']), 'C4 · confirmée ⇒ relié, le doute vu est noté sur le lien', ok.entree);
    }
    {
      for (const k of ['lbc', 'ebay', 'vc', 'journal']) { const c = CARTES(); c[k] = undefined; const r = rel(ann('Leboncoin', 5001), P124, { cartes: c }); if (r.refus !== 'pas-su' || r.ops) { dit(false, `C5 · carte « ${k} » PAS LUE ⇒ refus « pas su », rien à écrire`, r); } }
      const c2 = CARTES(); c2.lbc = null;
      dit(rel(ann('Leboncoin', 5001), P124, { cartes: c2 }).refus === 'pas-su' && L.opsDelier({ annonce: ann('Leboncoin', 1), cartes: c2 }).refus === 'pas-su' && L.opsPlusTard({ annonce: ann('Leboncoin', 1), cartes: { journal: undefined } }).refus === 'pas-su' && L.opsPropre({ annonce: ann('Leboncoin', 1), cartes: c2 }).refus === 'pas-su' && L.opsGarder({ contradiction: { id: 'x' }, cartes: {} }).refus === 'pas-su',
        'C5 · UNE carte de liens pas lue (lecture ratée) ⇒ relier, délier, plus tard, « pas sur Vinted », garder : RIEN n’est écrit', '');
      dit(j(ann('Leboncoin', 1), paire(9, '')).refus === 'sans-numero' && j(ann('Leboncoin', 1), P124, { douteux: new Set(['124']) }).refus === 'numero-double' && j(ann('Autre', 1), P124).refus === 'identite',
        'C6 · paire sans N° · N° porté par deux paires · site inconnu ⇒ refus', '');
    }

    // ── D · délier (et « Annuler ») rend l'état d'avant ──
    {
      const depart = { lbc: { 9: 'B12' }, ebay: { 8: { pairId: '5', numero: '3', at: 1, par: 'brouillon' } }, vc: { 6: { numero: '9', item: '70', de: '', at: 'x', ecrit: null } }, journal: { 'tard:Leboncoin:5001': '2026-11-18T10:00:00Z', 'garde:x': { at: 'y', choix: 'garder' } } };
      let tout = true; const det = [];
      for (const a of [ann('Leboncoin', 5001), ann('eBay', 2001), ann('Vestiaire', 77)]) {
        // (Vestiaire : l'annonce portait SON N°12 ; il garde le N°124 de l'article — le 12 est « à barrer ».)
        const r = a.plateforme === 'Vestiaire' ? rel({ ...a, numeroSite: '12' }, P124, { cartes: depart, numeroVc: '12', accepte: { garder: '124' } }) : rel(a, P124, { cartes: depart });
        const apres = L.appliquerSurCartes(depart, r.ops);
        // « Annuler » : l'inverse des opérations, par le VRAI moteur (src/gesteAnnulable.js).
        const nom = { vrm_lbc_liens: 'lbc', vrm_ebay_liens: 'ebay', vrm_vc_liens: 'vc', vrm_liaison_sites: 'journal' };
        const annule = { ...apres }; for (const k of GA.clesDe(r.ops)) annule[nom[k]] = GA.appliquerOps(apres[nom[k]], r.ops, 'avant', k);
        const moteur = { ...depart }; for (const k of GA.clesDe(r.ops)) moteur[nom[k]] = GA.appliquerOps(depart[nom[k]], r.ops, 'apres', k);
        const d = L.opsDelier({ annonce: { ...a, relie: true, numero: '124' }, cartes: apres, cle });
        if (a.plateforme === 'Vestiaire' && !(r.ops[0].apres.de === '12' && r.barre === '12')) { tout = false; det.push('Vestiaire : N° à barrer'); }
        const delie = d.ops ? L.appliquerSurCartes(apres, d.ops) : null;
        // « Plus tard » avait été noté avant le lien : le lien l'a retiré, délier ne le remet pas (il a traité l'annonce) ; « Annuler » le remet.
        const attenduDelie = { ...depart, journal: { ...depart.journal } }; if (a.plateforme === 'Leboncoin') delete attenduDelie.journal['tard:Leboncoin:5001'];
        const ok = egal(annule, depart) && egal(moteur, apres) && delie && egal(delie, attenduDelie) && !egal(apres, depart);
        if (!ok) { tout = false; det.push(a.plateforme); }
      }
      dit(tout, 'D1 · relier puis « Annuler » (l’inverse joué par le vrai moteur) rend EXACTEMENT les cartes d’avant ; relier puis « Délier » aussi — Leboncoin, eBay, Vestiaire ; les liens des autres annonces ne bougent pas', det);
      const ecrit = L.opsDelier({ annonce: ann('eBay', 2001, { relie: true, numero: '82', identites: [{ sorte: 'reference', numero: '82' }] }), cartes: CARTES(), cle });
      dit(ecrit.refus === 'ecrit-sur-le-site' && !ecrit.ops, 'D2 · une identité ÉCRITE sur le site (référence, SKU), sans lien posé dans VRM ⇒ rien à délier ici (refus dit), aucune écriture', ecrit);
    }

    // ── E · le lot « Relier les N sûres » ──
    {
      const m = monde();
      addV(m, 1001, 124, 'paire-124'); addV(m, 1002, 125, 'paire-125'); addV(m, 1003, 126, 'paire-126');
      addA(m, 'Leboncoin', 5001, 'paire-124~bruit'); mesurer(m, 'Leboncoin', 5001, 'paire-124~bruit', 1001, 'paire-124');
      addA(m, 'eBay', 2001, 'paire-125~bruit'); mesurer(m, 'eBay', 2001, 'paire-125~bruit', 1002, 'paire-125');
      addA(m, 'Leboncoin', 5003, 'paire-126~bruit');                       // une seule mesure : « à vérifier »
      const r = calc(m);
      const lot = L.sursDuLot(r);
      const o = L.opsRelierLot({ entrees: r.file, cartes: CARTES(), autres: m.autres, cle, marqueDe, maintenant: '2026-11-19T10:00:00.000Z' });
      dit(lot.length === 2 && o.faits.length === 2 && egal(o.faits.map((f) => f.cle).sort(), ['Leboncoin:5001', 'eBay:2001']) && o.restes.length === 1 && o.restes[0].refus === 'pas-sure' && o.ops.every((op) => op.k !== 'vrm_liaison_sites' || op.apres.par === 'photo-sure'),
        'E1 · le lot ne relie QUE les « sûres » mises en avant (2), jamais une « à vérifier » — même si on la lui passe', { faits: o.faits, restes: o.restes });
      // deux annonces Leboncoin « sûres » vers la MÊME paire : la seconde reste.
      const m2 = monde(); addV(m2, 1001, 124, 'paire-124');
      addA(m2, 'Leboncoin', 5001, 'paire-124~bruit'); mesurer(m2, 'Leboncoin', 5001, 'paire-124~bruit', 1001, 'paire-124');
      addA(m2, 'Leboncoin', 5002, 'paire-124~bruit'); mesurer(m2, 'Leboncoin', 5002, 'paire-124~bruit', 1001, 'paire-124');
      const r2 = calc(m2); const o2 = L.opsRelierLot({ entrees: r2.file, cartes: CARTES(), autres: m2.autres, cle, marqueDe });
      dit(o2.faits.length === 1 && o2.restes.length === 1 && o2.restes[0].refus === 'paire-prise', 'E2 · deux annonces du même site vers la MÊME paire dans un lot ⇒ une seule reliée, l’autre reste dans la file (rejugée après la première)', { faits: o2.faits.length, restes: o2.restes });
      dit(L.opsRelierLot({ entrees: r.file, cartes: { ...CARTES(), ebay: undefined }, autres: m.autres, cle }).ops.length === 0, 'E3 · une carte pas lue ⇒ le lot n’écrit RIEN', '');
    }

    // ── F · les liens qui se contredisent ──
    {
      const paires = [paire(1001, 124), paire(1002, 125, { taille: '44' }), paire(1003, 126, { prix: 20 })];
      const autres = [
        ann('eBay', 1, { relie: true, numero: '124', identites: [{ sorte: 'lien', numero: '124' }, { sorte: 'reference', numero: '125' }] }),      // deux N°
        ann('Leboncoin', 2, { relie: true, numero: '126', identites: [{ sorte: 'lien', numero: '126' }], prix: 20 }),
        ann('Leboncoin', 3, { relie: true, numero: '126', identites: [{ sorte: 'reference', numero: '126' }], prix: 20 }),                         // deux annonces, N°126
        ann('Leboncoin', 4, { relie: true, numero: '125', identites: [{ sorte: 'lien', numero: '125' }], titre: 'Nike Air Max taille 42' }),       // taille 42 / 44
        ann('Leboncoin', 5, { relie: true, numero: '900', identites: [{ sorte: 'lien', numero: '900' }] }),                                         // orphelin
        ann('Vestiaire', 6, { relie: false, numero: '', identites: [{ sorte: 'vrm', numero: '31' }] }),                                              // son N° à elle : rien
        ann('eBay', 7, { relie: true, numero: '124', identites: [{ sorte: 'lien', numero: '124' }], prix: 200 }),                                    // prix fort (et 2e annonce eBay N°124)
      ];
      const connus = new Set(['124', '125', '126']);
      const c = L.contradictions({ autres, paires, journal: {}, numerosConnus: connus, cle, marqueDe });
      const types = c.map((x) => x.type + ':' + x.annonces.map((a) => a.id).join('+'));
      dit(egal(types, ['deux-numeros:1', 'deux-annonces:2+3', 'deux-annonces:1+7', 'taille:4', 'orphelin:5', 'prix:7']), 'F1 · deux N° sur une annonce · deux annonces sous un N° · taille · N° que personne ne porte · prix fort : chaque cas LISTÉ, avec les deux côtés', types);
      dit(c[0].paires.length === 2 && c[0].paires[0].numero === '124' && c[0].paires[1].numero === '125' && c[1].annonces.length === 2, 'F1 · le cas « deux N° » porte LES DEUX paires, le cas « deux annonces » LES DEUX annonces', '');
      const avant = JSON.stringify(autres);
      const r = L.construireLiaison({ autres, paires, journal: {}, numerosConnus: connus, cle, marqueDe });
      dit(JSON.stringify(autres) === avant && r.parCle.get('eBay:1').etat === 'aVerifier' && r.parCle.get('eBay:1').numero === '124' && r.compteur.contradictions === 6 && r.file.length === 1,
        'F2 · RIEN n’est tranché : les annonces gardent leur lien, marquées « à vérifier » ; elles ne reviennent pas dans la file', { etat: r.parCle.get('eBay:1').etat, file: r.file.length });
      const g = L.opsGarder({ contradiction: c[0], cartes: CARTES(), maintenant: 't' });
      const c2 = L.contradictions({ autres, paires, journal: L.appliquerSurCartes(CARTES(), g.ops).journal, numerosConnus: connus, cle, marqueDe });
      dit(c2.length === 5 && !c2.some((x) => x.id === c[0].id), 'F3 · « Garder celui-ci » (SON geste) ⇒ ce cas ne revient plus, les autres restent', c2.length);
      const decl = L.contradictions({ autres, paires, journal: { 'lien:Leboncoin:3': { numero: '126', plusieurs: true } }, numerosConnus: connus, cle, marqueDe });
      dit(!decl.some((x) => x.type === 'deux-annonces' && x.plateforme === 'Leboncoin'), 'F3 · deux annonces DÉCLARÉES « la même paire » ⇒ pas une contradiction', '');
      dit(L.contradictions({ autres: [autres[4]], paires, journal: {}, numerosConnus: null, cle }).length === 0, 'F4 · N° des fiches PAS LUS ⇒ « orphelin » n’est jamais dit (pas su ≠ personne)', '');
    }

    // ── G · un N° d'avant la remise à zéro désigne l'ANCIENNE paire (la vraie règle d'App.jsx) ──
    {
      const { sourceApp } = require(path.join(RACINE, 'scripts', '_source-app.cjs'));
      const app = sourceApp(RACINE);
      const tranche = (debut, fin) => { const i = app.indexOf(debut); const k = i < 0 ? -1 : app.indexOf(fin, i); return i < 0 || k < 0 ? '' : app.slice(i, k + fin.length); };
      const code = [tranche('const cleNum = (v) => {', '\n};'), tranche('const marqueurNumerotation = ', '\n'), tranche('const archiveNumeros = ', '\n'), tranche('const coupureNumerotation = ', '\n'), tranche('const traductionAnnonce = (carte, id, k) => {', '\n};'), tranche('const numeroExterne = (k, id, liste, dateMs) => {', '\n};'), tranche('const prochainLibre = (prisInt, prisCles, pref) => {', '\n};')];
      dit(code.every(Boolean), 'G0 · les vraies `numeroExterne`, `traductionAnnonce`, `prochainLibre` d’App.jsx se lisent', code.map((x) => x.length));
      const marqueur = { version: 3, archive: 'B', coupure: '2026-10-09T00:00:00.000Z', lbcAnnonces: { 7001: { 230: 'B230' } }, ebayAnnonces: { 8001: { 553: '1' } } };
      const V = new Function('load', code.join('\n') + '\nreturn { cleNum, numeroExterne, prochainLibre };')((k, d) => (k === 'vrm_numerotation' ? marqueur : d));
      const vieux = V.numeroExterne('230', '7001', 'lbcAnnonces'), neuf = V.numeroExterne('230', '7999', 'lbcAnnonces'), ebay = V.numeroExterne('553', '8001', 'ebayAnnonces');
      dit(vieux === 'B230' && neuf === '230' && ebay === '1', 'G1 · « 230 » écrit sur une annonce d’AVANT la coupure ⇒ B230 (l’ancienne paire) ; sur une annonce d’après ⇒ 230 ; « VRM-553 » provisoire ⇒ 1', [vieux, neuf, ebay]);
      // L'app passe cette identité au parcours : l'annonce d'avant est reliée à B230, jamais à la nouvelle 230.
      const paires = [paire(1001, '230'), paire(900, 'B230', { titre: 'Asics Gel Lyte', marque: 'Asics', taille: '44' })];
      const a = ann('Leboncoin', 7001, { relie: true, numero: vieux, identites: [{ sorte: 'reference', numero: vieux }], titre: 'Asics Gel Lyte taille 44' });
      const r = L.construireLiaison({ autres: [a], paires, journal: {}, numerosConnus: new Set(['230', 'B230']), cle: V.cleNum, marqueDe });
      const e = r.parCle.get('Leboncoin:7001');
      dit(e.etat === 'relie' && e.numero === 'B230' && r.file.length === 0 && r.contradictions.length === 0 && L.jugerLien({ annonce: a, paire: paires[0], autres: [a], cle: V.cleNum }).refus === 'annonce-reliee',
        'G2 · le parcours la montre reliée à B230 ; la relier à la NOUVELLE 230 est refusé ; elle ne prend pas la place « Leboncoin » de la 230', { etat: e.etat, numero: e.numero });
      dit(L.numerosPris([a], 'Leboncoin', V.cleNum).has('B230') && !L.numerosPris([a], 'Leboncoin', V.cleNum).has('230') && L.jugerLien({ annonce: ann('Leboncoin', 7003), paire: L.articlesDe({ paires, autres: [a], cle: V.cleNum })[0], autres: [a], cle: V.cleNum, marqueDe }).ok === true, 'G2 · la nouvelle 230 reste libre pour SA propre annonce Leboncoin', '');
      // Le lien posé garde le N° de la fiche TEL QUEL (B230 reste B230).
      const w = L.opsRelier({ annonce: ann('Leboncoin', 7002, { titre: 'Asics Gel Lyte taille 44' }), paire: L.articlesDe({ paires, cle: V.cleNum })[1], preuve: 'recherche', cartes: CARTES(), autres: [], cle: V.cleNum, marqueDe });
      dit(w.ops && w.ops[0].apres === 'B230', 'G3 · relier à une paire d’archive pose SON N° tel quel (« B230 », jamais « 230 »)', w.ops && w.ops[0].apres);

      // ── H · les gestes (src/liaisonActions.js), avec des lectures qui échouent ──
      const fabrique = (o = {}) => {
        const stock = { vrm_lbc_liens: {}, vrm_ebay_liens: {}, vrm_vc_liens: {}, vrm_liaison_sites: {}, ...(o.stock || {}) };
        const journalGestes = [];
        let etat = null;
        const m = o.monde || (() => { const x = monde(); addV(x, 1001, 124, 'paire-124'); addA(x, 'Leboncoin', 5001, 'paire-124~bruit'); mesurer(x, 'Leboncoin', 5001, 'paire-124~bruit', 1001, 'paire-124'); return x; })();
        const lireAutres = () => m.autres.map((a) => { const l = a.plateforme === 'Leboncoin' ? stock.vrm_lbc_liens[a.id] : null; return l ? { ...a, relie: true, numero: cle(o.relu || l), identites: [{ sorte: 'lien', numero: cle(o.relu || l) }, ...(a.identites || [])] } : a; });
        const deps = {
          pret: () => o.pret !== false, proprio: () => 'u1',
          lireCarte: (k) => (o.illisible === k ? undefined : stock[k]),
          // Le VRAI moteur d'écriture : tout lire d'abord (une lecture ratée ⇒ rien), puis poser les sous-valeurs.
          geste: (texte, ops, apres, options) => { journalGestes.push({ texte, ops, options }); GA.ecrireOps({ ops, sens: 'apres', lire: (k) => (o.illisibleEcriture === k ? undefined : stock[k]), ecrire: (k, v) => { stock[k] = v; return { ok: true }; } }); if (apres) apres('apres'); },
          memePhoto: async () => { const autres = lireAutres(); return { ...MP.propositionsMemePhoto({ vinted: m.vinted, autres, empreintes: { vinted: m.ev, ...m.es }, refus: {}, cle, verifs: m.verifs }), autres, illisibles: [] }; },
          annoncesAutres: async () => ({ autres: lireAutres(), illisibles: [] }),
          pairesVinted: async () => (o.vintedKO ? { paires: null } : { paires: m.paires, toutesLues: true }),
          pistes: async () => null, douteux: () => new Set(), numerosConnus: () => null, numeroVcDe: () => '',
          donnerNumero: async () => o.numero || { refus: 'sans-numero' }, refuserPhoto: () => {},
          cleNum: cle, marqueDe, tr: (k, p) => k + (p ? JSON.stringify(p) : ''), publier: (x) => { etat = x; }, lire: () => etat,
        };
        return { act: ACT.creerLiaison(deps), stock, gestes: journalGestes, lire: () => etat, m };
      };
      {
        const f = fabrique(); const e0 = await f.act.charger(true);
        dit(e0 && e0.lu && e0.file.length === 1 && e0.file[0].avant === '1001' && f.gestes.length === 0 && egal(f.stock.vrm_lbc_liens, {}) && e0.compteurEntree.n === 1,
          'H1 · charger : la « sûre » est en tête, mise en avant — et RIEN n’est relié, aucun geste lancé', { gestes: f.gestes.length, liens: f.stock.vrm_lbc_liens });
        const en = e0.file[0];
        const r = f.act.relier({ annonce: en.annonce, paire: en.candidats[0].paire, preuve: 'photo-sure' }); await tic();
        dit(r.ok && r.numero === '124' && f.gestes.length === 1 && f.gestes[0].options.duree === 10000 && ACT.DUREE_ANNULER_LIEN === 10000 && f.stock.vrm_lbc_liens['5001'] === '124' && f.stock.vrm_liaison_sites['lien:Leboncoin:5001'].par === 'photo-sure',
          'H2 · SON toucher ⇒ UN geste (annulable 10 s), le lien et sa preuve écrits par le moteur', { n: f.gestes.length, d: f.gestes[0] && f.gestes[0].options });
        const v = await f.act.verifier({ cle: 'Leboncoin:5001', numero: '124' });
        dit(v === 'verifie' && f.lire().parCle.get('Leboncoin:5001').etat === 'relie' && f.lire().file.length === 0, 'H3 · après le lien, l’annonce est RELUE : elle désigne N°124 ⇒ « vérifié », la file est vide', v);
        const r2 = f.act.relier({ annonce: en.annonce, paire: paire(1002, 125), preuve: 'recherche', accepte: { doutes: true, plusieurs: true } });
        dit(r2.refus === 'annonce-reliee' && f.gestes.length === 1 && f.stock.vrm_lbc_liens['5001'] === '124', 'H4 · une carte PÉRIMÉE à l’écran (l’annonce paraît libre) ⇒ deuxième lien refusé, aucun geste, le premier lien intact', r2);
        const d = f.act.delier({ annonce: f.lire().parCle.get('Leboncoin:5001').annonce }); await tic();
        dit(d.ok && egal(f.stock.vrm_lbc_liens, {}) && egal(f.stock.vrm_liaison_sites, {}) && f.gestes.length === 2, 'H5 · « Délier » ⇒ les cartes reviennent à l’état d’avant (vides)', f.stock);
      }
      {
        const f = fabrique({ relu: '999' }); const e0 = await f.act.charger(true); const en = e0.file[0];
        f.act.relier({ annonce: en.annonce, paire: en.candidats[0].paire, preuve: 'photo-sure' });
        dit((await f.act.verifier({ cle: 'Leboncoin:5001', numero: '124' })) === 'autre', 'H3 · la relecture désigne un AUTRE N° ⇒ « autre » (jamais « vérifié »)', '');
      }
      for (const k of ['vrm_lbc_liens', 'vrm_ebay_liens', 'vrm_vc_liens', 'vrm_liaison_sites']) {
        const f = fabrique({ illisible: k }); const e0 = await f.act.charger(true); const en = e0 && e0.file[0];
        const r = en ? f.act.relier({ annonce: en.annonce, paire: en.candidats[0].paire, preuve: 'photo-sure' }) : { refus: 'pas-su' };
        const lot = f.act.relierLot({ entrees: e0 ? e0.file : [] });
        if (!(r.refus === 'pas-su' && lot.refus === 'pas-su' && f.gestes.length === 0 && egal(f.stock.vrm_lbc_liens, {}) && egal(f.stock.vrm_liaison_sites, {}))) dit(false, `H6 · lecture ratée de ${k} ⇒ RIEN d’écrit`, { r, gestes: f.gestes.length });
        if (k === 'vrm_liaison_sites' && !(e0 && e0.compteurEntree === null)) dit(false, 'H6 · journal pas lu ⇒ le compteur d’entrée est « pas su » (null)', e0 && e0.compteurEntree);
      }
      dit(true, 'H6 · lecture ratée d’UNE des quatre cartes ⇒ relier et le lot refusent (« pas su »), aucun geste, rien d’écrit ; journal pas lu ⇒ compteur « pas su »', '');
      {
        const f = fabrique({ pret: false });
        dit((await f.act.charger(true)) === null && f.act.relier({ annonce: ann('Leboncoin', 5001), paire: P124 }).refus === 'pas-su' && f.gestes.length === 0, 'H7 · avant l’arrivée du nuage ⇒ rien ne se calcule, rien ne se relie', '');
        // Le moteur lui-même : la lecture rate AU MOMENT d'écrire ⇒ aucune des clés n'est écrite.
        const f2 = fabrique({ illisibleEcriture: 'vrm_liaison_sites' }); const e2 = await f2.act.charger(true);
        f2.act.relier({ annonce: e2.file[0].annonce, paire: e2.file[0].candidats[0].paire, preuve: 'photo-sure' });
        await new Promise((ok) => setTimeout(ok, 20));
        dit(egal(f2.stock.vrm_lbc_liens, {}) && egal(f2.stock.vrm_liaison_sites, {}), 'H7 · la lecture rate AU MOMENT d’écrire (une des deux clés) ⇒ le moteur n’écrit AUCUNE des deux (jamais un lien à moitié)', f2.stock);
        const f3 = fabrique({ vintedKO: true }); const e3 = await f3.act.charger(true);
        dit(e3 && e3.lu === false && e3.compteurEntree === null, 'H7 · annonces Vinted pas lues ⇒ `lu: false`, compteur « pas su »', e3 && e3.lu);
      }
      { // « Elle n'est pas sur Vinted » : SON N°, par la vraie `prochainLibre`.
        const servis = [1, 2, 3, 7, 'B230', 52];
        const pris = new Set(), prisK = new Set(); for (const x of servis) { const c = V.cleNum(x); prisK.add(c); if (/^\d+$/.test(c)) pris.add(Number(c)); }
        const avant = new Set(prisK);
        const neufN = V.prochainLibre(pris, prisK, '');
        dit(neufN === '53' && !avant.has(neufN), 'H8 · la règle des numéros (vraie `prochainLibre`) : après le plus haut (53), JAMAIS dans un trou (4, 5, 6…), jamais un N° d’archive', neufN);
        const f = fabrique({ numero: { numero: neufN, servis: avant }, monde: (() => { const x = monde(); addV(x, 1001, 124, 'p'); addA(x, 'Leboncoin', 6001, 'q'); return x; })() });
        const e0 = await f.act.charger(true);
        const r = await f.act.propre({ annonce: e0.file[0].annonce }); await tic();
        const e1 = await f.act.charger(true); const x1 = e1.parCle.get('Leboncoin:6001');
        dit(r.ok && r.numero === '53' && f.stock.vrm_lbc_liens['6001'] === '53' && f.stock.vrm_liaison_sites['propre:Leboncoin:6001'].numero === '53' && x1.etat === 'propre' && x1.numero === '53' && e1.file.length === 0 && e1.articles.some((p) => p.numero === '53' && p.origine === 'Leboncoin'),
          'H8 · « Elle n’est que sur ce site » (Leboncoin) ⇒ SON N° neuf, rangé comme son identité ; elle sort de la file et devient un ARTICLE (N°53)', { etat: x1.etat, n: x1.numero });
        const r1b = await f.act.propre({ annonce: x1.annonce }); await tic();
        dit(r1b.refus === 'identite' || (r1b.ok && f.stock.vrm_lbc_liens['6001'] === '53'), 'H8 · redemandé ⇒ jamais un DEUXIÈME N° pour la même annonce', r1b);
        const f2 = fabrique({ numero: { numero: '7', servis: avant }, monde: f.m.autres.length ? (() => { const x = monde(); addV(x, 1001, 124, 'p'); addA(x, 'Leboncoin', 6001, 'q'); return x; })() : null });
        const e2 = await f2.act.charger(true); const r2 = await f2.act.propre({ annonce: e2.file[0].annonce });
        dit(r2.refus === 'numero-servi' && f2.gestes.length === 0 && egal(f2.stock.vrm_lbc_liens, {}), 'H8 · un N° DÉJÀ SERVI (7) ne se redonne JAMAIS : refus, rien d’écrit', r2);
        const f3 = fabrique({ monde: (() => { const x = monde(); addV(x, 1001, 124, 'p'); addA(x, 'eBay', 6002, 'q'); return x; })() });
        const e3 = await f3.act.charger(true); const r3 = await f3.act.propre({ annonce: e3.file[0].annonce }); await tic();
        dit(r3.ok && !r3.numero && egal(f3.stock.vrm_ebay_liens, {}) && !!f3.stock.vrm_liaison_sites['propre:eBay:6002'], 'H8 · eBay : notée « que sur eBay », aucun N° inventé ici, aucun lien posé', f3.stock);
      }

      // ── J · l'ARTICLE au centre : Vinted n'est pas le pivot ──
      {
        // Un vendeur SANS Vinted : une annonce eBay porte son N°9 (son identité), une annonce Leboncoin n'a rien.
        const eb = ann('eBay', 2001, { relie: true, numero: '9', identites: [{ sorte: 'reference', numero: '9' }], titre: 'Asics Gel Lyte taille 44' });
        const lb = ann('Leboncoin', 5001, { titre: 'Asics Gel Lyte taille 44' });
        const r = L.construireLiaison({ autres: [eb, lb], paires: [], journal: {}, cle, marqueDe });
        const art = r.articles.find((p) => p.numero === '9');
        const e = r.parCle.get('Leboncoin:5001');
        const l = L.candidatesPour(e, r.articles, { autres: r.autres, cle });
        dit(r.lu && r.articles.length === 1 && art.origine === 'eBay' && art.vinted === '' && r.file.length === 1 && l.length === 1 && l[0].paire === art,
          'J1 · aucune annonce Vinted : l’annonce eBay N°9 EST un article, proposé à l’annonce Leboncoin (les annonces se relient entre elles)', { articles: r.articles.length, l: l.length });
        const w = L.opsRelier({ annonce: lb, paire: art, preuve: 'recherche', cartes: CARTES(), autres: r.autres, cle, marqueDe, maintenant: 't' });
        dit(w.ops && egal(w.ops[0], { k: 'vrm_lbc_liens', type: 'cle', id: '5001', apres: '9' }) && w.ops[1].apres.vinted === '' && w.ops[1].apres.article === 'eBay:2001', 'J1 · Leboncoin → article d’eBay : `vrm_lbc_liens[annonce] = 9`, aucune annonce Vinted en jeu', w.ops);
        // L'autre sens : l'annonce eBay sans N° vers l'article d'une annonce Leboncoin.
        const lb2 = ann('Leboncoin', 5002, { relie: true, numero: '14', identites: [{ sorte: 'reference', numero: '14' }] }), eb2 = ann('eBay', 2002);
        const r2 = L.construireLiaison({ autres: [lb2, eb2], paires: [], journal: {}, cle, marqueDe });
        const w2 = L.opsRelier({ annonce: eb2, paire: r2.articles[0], preuve: 'recherche', cartes: CARTES(), autres: r2.autres, cle, marqueDe, maintenant: '2026-11-19T10:00:00.000Z' });
        dit(w2.ops && w2.ops[0].k === 'vrm_ebay_liens' && w2.ops[0].apres.numero === '14' && w2.ops[0].apres.article === true && !('pairId' in w2.ops[0].apres), 'J1 · eBay → article de Leboncoin : `{ numero, article: true }` (sans fiche Vinted inventée)', w2.ops && w2.ops[0]);
        const vc2 = ann('Vestiaire', 88);
        const w3 = L.opsRelier({ annonce: vc2, paire: r2.articles[0], preuve: 'recherche', cartes: CARTES(), autres: [lb2, vc2], cle, marqueDe, maintenant: 't' });
        dit(w3.ops && w3.ops[0].k === 'vrm_vc_liens' && w3.ops[0].apres.numero === '14' && w3.ops[0].apres.item === '', 'J1 · Vestiaire → article de Leboncoin : la carte Vestiaire, sans `item` Vinted', w3.ops && w3.ops[0]);
      }
      {
        // DEUX N° en jeu, sans Vinted : Leboncoin porte SON N°5, eBay porte SON N°9 — le même article.
        const lb = ann('Leboncoin', 5001, { numeroSite: '5', identites: [{ sorte: 'vrm', numero: '5' }] }), eb = ann('eBay', 2001, { numeroSite: '9', identites: [{ sorte: 'vrm', numero: '9' }] });
        const journal = {};
        const r = L.construireLiaison({ autres: [lb, eb], paires: [], journal, cle, marqueDe });
        const art9 = r.articles.find((p) => p.numero === '9'), art5 = r.articles.find((p) => p.numero === '5');
        const q = L.opsRelier({ annonce: lb, paire: art9, preuve: 'recherche', cartes: CARTES(), autres: r.autres, cle, marqueDe });
        dit(r.file.length === 2 && q.demander === 'numero' && egal(q.numeros, ['9', '5']) && !q.ops && L.opsRelier({ annonce: lb, paire: art9, cartes: CARTES(), autres: r.autres, cle, accepte: { garder: '77' } }).demander === 'numero',
          'J2 · deux articles déjà numérotés sont le même (N°5 et N°9) ⇒ le lien DEMANDE lequel est écrit sur le carton ; rien n’est écrit, aucun N° choisi pour lui (ni un troisième)', q);
        const k9 = L.opsRelier({ annonce: lb, paire: art9, preuve: 'recherche', cartes: CARTES(), autres: r.autres, cle, marqueDe, accepte: { garder: '9' }, maintenant: 't' });
        dit(k9.ops && k9.numero === '9' && k9.barre === '5' && egal(k9.ops[0], { k: 'vrm_lbc_liens', type: 'cle', id: '5001', apres: '9' }) && k9.entree.de === '5', 'J2 · « N°9 » ⇒ l’annonce Leboncoin porte le 9 ; le 5 est noté « à barrer » (jamais redonné)', k9.ops);
        const k5 = L.opsRelier({ annonce: lb, paire: art9, preuve: 'recherche', cartes: CARTES(), autres: r.autres, cle, marqueDe, accepte: { garder: '5' }, maintenant: '2026-11-19T10:00:00.000Z' });
        const apres = k5.ops ? L.appliquerSurCartes(CARTES(), k5.ops) : null;
        dit(k5.ops && k5.numero === '5' && k5.barre === '9' && apres.ebay['2001'].numero === '5' && apres.ebay['2001'].article === true && apres.lbc['5001'] === undefined && apres.journal['lien:eBay:2001'].de === '9' && apres.journal['lien:Leboncoin:5001'].numero === '5',
          'J2 · « N°5 » ⇒ c’est l’annonce eBay qui prend le 5 ; l’annonce Leboncoin garde le sien ; le 9 est « à barrer »', apres);
        const r5 = L.construireLiaison({ autres: [lb, { ...eb, relie: true, numero: '5', numeroSite: '9' }], paires: [], journal: apres.journal, cle, marqueDe });
        dit(r5.file.length === 0 && r5.parCle.get('Leboncoin:5001').etat === 'relie' && r5.parCle.get('Leboncoin:5001').numero === '5' && L.verifierLien({ entree: r5.parCle.get('Leboncoin:5001'), attendu: '5', cle }) === 'verifie', 'J2 · relu : les deux annonces sont reliées sous le N°5, la file est vide', r5.file.length);
        // Avec une annonce Vinted : garder le N° de l'annonce Vestiaire demanderait de renuméroter la fiche Vinted.
        const vc = ann('Vestiaire', 77, { numeroSite: '12' });
        const gv = L.opsRelier({ annonce: vc, paire: P124, cartes: CARTES(), autres: [vc], cle, marqueDe, accepte: { garder: '12' }, numeroVc: '12' });
        dit(gv.refus === 'garder-vinted' && !gv.ops, 'J3 · garder le N° de l’annonce quand l’article a une annonce Vinted ⇒ refus expliqué (le N° d’une fiche Vinted se change sur sa fiche : prix d’achat et case y sont attachés), rien d’écrit', gv);
        // La même photo « sûre », mais deux N° en jeu ⇒ jamais mise en avant (la question d'abord).
        const m = monde(); addV(m, 1001, 124, 'paire-124'); addA(m, 'Vestiaire', 77, 'paire-124~bruit', { numeroSite: '12', enVente: true }); mesurer(m, 'Vestiaire', 77, 'paire-124~bruit', 1001, 'paire-124');
        const e = calc(m).parCle.get('Vestiaire:77');
        dit(e.candidats.length === 1 && e.candidats[0].niveau === 'sur' && e.avant === null && e.candidats[0].jugement.demander === 'numero', 'J3 · « même photo · sûr » avec deux N° en jeu ⇒ pas de mise en avant, pas dans le lot : la question d’abord', { avant: e.avant, j: e.candidats[0].jugement });
      }
      {
        // Une annonce Leboncoin qui porte SON N° (« que sur ce site ») : pas « reliée », et reliable plus tard.
        const journal = { 'propre:Leboncoin:6001': { at: 't', numero: '53' } };
        const lb = ann('Leboncoin', 6001, { relie: true, numero: '53', identites: [{ sorte: 'lien', numero: '53' }] });
        const cartes = { lbc: { 6001: '53' }, ebay: {}, vc: {}, journal };
        const r = L.construireLiaison({ autres: [lb], paires: [P124], journal, cle, marqueDe });
        const e = r.parCle.get('Leboncoin:6001');
        const q = L.opsRelier({ annonce: lb, paire: r.articles[0], cartes, autres: r.autres, cle, marqueDe });
        const w = L.opsRelier({ annonce: lb, paire: r.articles[0], cartes, autres: r.autres, cle, marqueDe, accepte: { garder: '124' }, maintenant: 't2' });
        const apres = w.ops ? L.appliquerSurCartes(cartes, w.ops) : null;
        dit(e.etat === 'propre' && e.numero === '53' && q.demander === 'numero' && w.ops && apres.lbc['6001'] === '124' && apres.journal['propre:Leboncoin:6001'].actif === false && apres.journal['propre:Leboncoin:6001'].numero === '53',
          'J4 · son N°53 (« que sur ce site ») n’est PAS un lien : la relier à N°124 pose la question des deux N°, puis écrit le 124 (le 53 reste noté)', { etat: e.etat, q, apres });
        const d = L.opsDelier({ annonce: { ...lb, numero: '124' }, cartes: apres, cle });
        const retour = d.ops ? L.appliquerSurCartes(apres, d.ops) : null;
        dit(d.ops && retour.lbc['6001'] === '53' && retour.journal['lien:Leboncoin:6001'] === undefined, 'J4 · délier lui REND son N°53 (jamais une annonce sans N°, jamais un N° neuf)', retour);
        dit(L.opsPropre({ annonce: lb, numero: '54', cartes, servis: new Set(), cle }).refus === 'identite', 'J4 · elle a déjà SON N° : « que sur ce site » ne lui en donne jamais un deuxième', '');
      }
      {
        // L'ancien écran Leboncoin disait « pas d'article à relier » (reliée, sans N°) : ni « reliée » à un N° fantôme, ni reproposée.
        const lb = ann('Leboncoin', 6101, { relie: true, numero: '' });
        const r = L.construireLiaison({ autres: [lb, ann('Leboncoin', 6102)], paires: [P124], journal: {}, cle, marqueDe });
        const e = r.parCle.get('Leboncoin:6101');
        dit(e && e.etat === 'propre' && !r.file.some((x) => x.cle === 'Leboncoin:6101') && r.file.some((x) => x.cle === 'Leboncoin:6102'),
          'J5 · une annonce dite « pas d’article à relier » par l’ancien écran ⇒ « que sur ce site », hors de la file (jamais « reliée » sans N°)', e && { etat: e.etat, file: r.file.map((x) => x.cle) });
      }

      // ── I · le câblage ──
      const sansC = (t) => t.replace(/^\s*\/\/.*$/gm, '');
      const regles = sansC(fs.readFileSync(path.join(RACINE, 'src', 'liaisonSites.js'), 'utf8')), gestes = sansC(fs.readFileSync(path.join(RACINE, 'src', 'liaisonActions.js'), 'utf8')), etatS = sansC(fs.readFileSync(path.join(RACINE, 'src', 'liaisonEtat.js'), 'utf8'));
      dit(!/\bsave\(|withOwner|fetch\(|localStorage|chrome\.|document\.|window\./.test(regles) && !/\bsave\(|withOwner|fetch\(|localStorage|chrome\.|document\.|window\./.test(gestes), 'I1 · les règles et les gestes n’accèdent ni à la base, ni au stockage, ni au navigateur (tout passe par `deps`)', '');
      dit(L.CLE_LIAISON === 'vrm_liaison_sites' && /export const CLE_LIAISON = 'vrm_liaison_sites'/.test(etatS) && /^\s*'vrm_liaison_sites',/m.test(app), 'I2 · la clé du parcours est la même partout et elle est SYNCHRONISÉE (SYNC_KEYS)', '');
      const corpsCharger = gestes.slice(gestes.indexOf('async function charger('), gestes.indexOf('const relire ='));
      dit(corpsCharger.length > 200 && !/relier\(|geste\(|jouer\(|ops[A-Z]/.test(corpsCharger), 'I3 · le calcul (`charger`) ne relie rien et ne lance aucun geste', '');
      const appS = sansC(app);
      const nRelier = (appS.match(/\.relier\(|\.relierLot\(|\.remplacer\(/g) || []).length;
      const actions = (appS.match(/const ACTIONS_LIAISON = \{[\s\S]*?\n\};/) || [''])[0];
      dit(/relier: \(x\) => liaisonVrm\(\)\.then\(\(L\) => L\.relier\(x\)\)/.test(actions) && nRelier === 3 && (appS.match(/ACTIONS_LIAISON/g) || []).length === 2 && /actions=\{ACTIONS_LIAISON\}/.test(appS),
        'I4 · dans l’app, relier n’est appelé que par les actions passées au parcours (`actions={ACTIONS_LIAISON}`) : SON toucher', { nRelier, refs: (appS.match(/ACTIONS_LIAISON/g) || []).length });
      const chargeMP = appS.slice(appS.indexOf('async function chargerMemePhoto('), appS.indexOf('async function chargerMemePhoto(') + 4000).split('\nif (typeof window')[0];
      dit(chargeMP.length > 500 && !/liaisonVrm|relier|gesteVrm|vrm_lbc_liens|LIENS_EBAY/.test(chargeMP), 'I5 · le calcul « même photo » ne relie toujours rien', '');
      dit(/duree: (?:duree \|\| )?\(deux && deux\.duree\) \|\| /.test(appS) && /\(g\.duree \|\| dureePilule\)/.test(sansC(fs.readFileSync(path.join(RACINE, 'src', 'gesteAnnulable.js'), 'utf8'))), 'I6 · la pilule « Annuler » d’un lien tient la durée demandée (10 s)', '');
    }
  } catch (e) { dit(false, 'l’audit a planté', (e && e.stack) || e); }
  console.log(`\n${ko ? '❌' : '✅'} audit-liaison-sites : ${ko ? ko + ' rouge(s) sur ' + n : n + ' contrôles verts'}`);
  process.exit(ko ? 1 : 0);
})();
