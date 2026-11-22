// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU 15 NOV. — L'ATELIER « ACHAT ARRIVÉ → EN LIGNE », L'HISTORIQUE COMPLET,
//  LA NOTE À CÔTÉ DU FIL, LA TAILLE DU TEXTE. Il EXÉCUTE les règles, sur des données
//  INVENTÉES (le dépôt est public). Lecture seule. Récit : docs/passation/2026-11-15-atelier-arrivee.md
//
//  A · l'atelier (src/atelierArrivee.js) :
//      A1 le prix PAYÉ, par l'IDENTITÉ de l'achat (son n° de transaction) : 50 achats au même
//         titre et au même prix ⇒ chacun SON prix, jamais celui d'un autre ; sans n° ⇒ rien ;
//         un lot ⇒ rien (jamais divisé) ; remboursé ⇒ rien ; autre devise ⇒ rien ; prix pas lu ⇒ rien ;
//         le reçu juste (« Payé sur Vinted ») passe avant l'article seul ;
//      A2 l'écriture du prix : sur SON N° seulement, jamais par-dessus un prix posé, vide ou
//         illisible ⇒ rien ;
//      A3 où en est une paire : les six étapes, la reprise (la 1re ni faite ni passée), les preuves
//         (studio, prix posé, fiche enregistrée, en ligne) ; sans N° ⇒ tout attend le N° ;
//      A4 les fiches d'un achat : par SON n° de transaction, ou par les N° rendus — jamais le titre ;
//      A5 la fiche pré-remplie : ce que l'ACHAT dit ; le prix de vente JAMAIS pré-rempli (§3) ;
//         une couleur seulement si le titre en nomme une ;
//      A6 « Enregistrer la fiche » : liste blanche, prix de vente relu, illisible ⇒ rien ;
//      A7 Ma journée : les paires à finir (30 jours, pas retirées, pas finies) ;
//      A9 la case de l'ARTICLE (après son N°) : une case libre différente pour chaque article ;
//      A8 les branchements : « Donner ce N° » appelé SANS prix ni case, l'atelier sur l'événement de « Ranger cet
//         achat », chaque écriture par `gesteVrm`, la note (dictée) dans l'atelier.
//  H · l'historique complet (src/paireHistoire/ligneDeTemps.js sur la VRAIE chaîne
//      `toutSurLeNumero` → `histoireArticle`) : 50 paires IDENTIQUES ⇒ chaque ligne de temps
//      n'a que SES offres (et leur état lu), SES masquages, SES retours ; le vendeur d'un achat
//      relié seulement ; une republication dit « même N° » ; masquages pas lus ⇒ nommés.
//  N · la note à côté de la conversation (par l'identité de la paire du fil).
//  T · la taille du texte (src/tailleTexte.js) : quatre tailles, appareil × choix borné à 1,6,
//      branchée dans `applyZoom` et dans Paramètres.
//
//  `--src <dossier>` : les règles d'un autre arbre (le code d'avant : il doit rougir).
//  `--prouve` : chaque MUTATION (une règle réaffaiblie) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const iS = process.argv.indexOf('--src');
const RACINE = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
let ko = 0, ok = 0;
const dit = (c, nom, det) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${nom}${c || det === undefined ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500)}`); };
const imp = (rel) => import(pathToFileURL(path.join(RACINE, 'src', rel)).href);
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ── LES MUTATIONS (--prouve) : [fichier, avant, après, ce qui doit rougir] ───────
const MUTATIONS = [
  ['src/atelierArrivee.js', "if (!txOk(tx)) return null;                                  // aucun achat relié par identité ⇒ rien", "", 'A1 : un prix proposé sans achat relié'],
  ['src/atelierArrivee.js', "if (e.lot || (Number(e.n) || 0) > 1) return null;            // un lot ne se divise jamais tout seul", "", 'A1 : le prix d’un lot proposé à un article'],
  ['src/atelierArrivee.js', "&& str(p.tx) === tx && (p.source === 'recu' || p.source === 'achat')", "&& (p.source === 'recu' || p.source === 'achat')", 'A1 : le reçu d’un AUTRE achat'],
  ['src/atelierArrivee.js', "if (couts[num] != null && str(couts[num]) !== '') return { ok: false, raison: 'deja' };", "", 'A2 : un prix posé réécrit'],
  ['src/atelierArrivee.js', "prix: f.prix != null && Number.isFinite(Number(f.prix)) ? String(f.prix).replace('.', ',') : '',", "prix: String(e.prix || ''),", 'A5 : un prix de vente pré-rempli (refusé §3)'],
  ['src/atelierArrivee.js', "couleur: str(f.couleur) || (coul.length === 1 ? str(coul[0]) : ''),", "couleur: str(f.couleur) || str(coul[0] || ''),", 'A5 : une couleur choisie parmi deux'],
  ['src/atelierArrivee.js', "&& ((txOk(t) && f.achat && str(f.achat.tx) === t) || voulus.has(k(f.numero))))", "&& (str(f.titre) === str(tx) || (txOk(t) && f.achat && str(f.achat.tx) === t) || voulus.has(k(f.numero)) || true))", 'A4 : les fiches d’un autre achat'],
  ['src/atelierArrivee.js', "else if (marque('photos')) out.push({ cle: 'photos', etat: marque('photos'), ...(photos === null ? { raison: 'passu' } : {}) });", "", 'A3 : « Plus tard » des photos oublié (pas de reprise juste)'],
  ['src/atelierArrivee.js', "if (!Number.isFinite(t) || maintenant - t > ATELIER_JOURS * JOUR) continue;", "if (!Number.isFinite(t)) continue;", 'A7 : une paire rangée il y a 3 mois rappelée'],
  ['src/AtelierArrivee.jsx', "r = await coque.ranger(entree, lignes.map((l) => ({ ...l, prix: '', case: null })));", "r = await coque.ranger(entree, lignes.map((l) => ({ ...l, case: l.case })));", 'A8 : « Donner ce N° » écrit un prix ou une case (l’achat rangé, pas l’article)'],
  ['src/atelierArrivee.js', "if (slots[c] || f.case) return { ok: false, raison: 'deja' };", "", 'A9 : un article rangé deux fois (deux cases)'],
  ['src/atelierArrivee.js', "const ok = caseChoisie({ meubles, slots, m: place.meubleId, i: Number(place.i) });", "const mm = meubles.find((x) => x && String(x.id) === String(place.meubleId)); const ok = mm ? { meubleId: mm.id, i: Number(place.i) } : null;", 'A9 : une case prise donnée à un autre article'],
  ['src/atelierArrivee.js', "out.push({ cle: 'case', etat: !range ? 'afaire' : fiche.case ? 'fait' : (marque('case') === 'passe' ? 'passe' : 'afaire'), ...(range ? {} : { raison: 'sansNumero' }) });", "out.push({ cle: 'case', etat: fiche && fiche.case ? 'fait' : 'afaire' });", 'A3 : la case proposée avant le N° (sur l’achat)'],
  ['src/paireHistoire/ligneDeTemps.js', "if (!m || !idsM.has(str(m.a))) continue;", "if (!m) continue;", 'H2 : les masquages d’une AUTRE annonce'],
  ['src/paireHistoire/ligneDeTemps.js', "if (x.moderation === null && idsM.size) pasSu.push('moderation');", "if (false) pasSu.push('moderation');", 'H3 : masquages pas lus, pas nommés'],
  ['src/histoireArticle.js', "...(bid && fiche && fiche.buyFrom && str(fiche.buyFrom.seller) && String(fiche.buyFromId) === bid ? { vendeur: str(fiche.buyFrom.seller).slice(0, 60) } : {})", "...(fiche && fiche.buyFrom && str(fiche.buyFrom.seller) ? { vendeur: str(fiche.buyFrom.seller).slice(0, 60) } : {})", 'H4 : un vendeur pris sur une autre fiche'],
  ['src/paireHistoire/ligneDeTemps.js', "statut: ['acceptee', 'refusee', 'attente', 'terminee'].includes(e.statut) ? e.statut : ''", "statut: 'acceptee'", 'H1 : une offre dite acceptée sans l’avoir lu'],
  ['src/tailleTexte.js', "return Math.min(ECHELLE_MAX, Math.max(1, e));", "return Math.max(1, e);", 'T1 : une échelle sans borne (la mise en page casse)'],
  ['src/App.jsx', "const g = echelleTotale(echelleTexte(), lireTailleTexte()); marquerGrandTexte(g);", "const g = echelleTexte(); marquerGrandTexte(g);", 'T2 : le choix de Paramètres jamais appliqué'],
];

function prouver() {
  let rouges = 0;
  for (const [f, a, b, quoi] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-mut-'));
    fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
    try { fs.symlinkSync(path.join(RACINE, 'package.json'), path.join(tmp, 'package.json')); } catch (_) {}
    const p = path.join(tmp, f);
    const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(a)) { console.log(`❌ mutation introuvable (${f}) : ${quoi}`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, s.replace(a, b));
    const r = spawnSync(process.execPath, [__filename, '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${quoi} » ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' (' + (r.stdout.split('\n').filter((l) => l.startsWith('❌')).slice(0, 2).join(' | ').slice(0, 220)) + ')' : ''}`);
    if (rouge) rouges++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const tous = rouges === MUTATIONS.length;
  console.log(`\n${tous ? '✅ --prouve : les ' + MUTATIONS.length + ' mutations rougissent' : '❌ --prouve : ' + (MUTATIONS.length - rouges) + ' mutation(s) ne rougissent pas'}`);
  process.exit(tous ? 0 : 1);
}
if (PROUVE) prouver();

(async () => {
  let A, L, H, RN, NE, T;
  try {
    [A, L, H, RN, NE, T] = await Promise.all(['atelierArrivee.js', 'paireHistoire/ligneDeTemps.js', 'histoireArticle.js', 'rechercheNumero.js', 'numeroEcrit.js', 'tailleTexte.js'].map(imp));
  } catch (e) { dit(false, 'C0 · les règles de l’atelier, de l’historique et de la taille du texte existent', e.message); console.log(`\n❌ audit-atelier-arrivee : ${ko} rouge(s)`); process.exit(1); }
  const cleNum = NE.cleNumero;
  const J = 86400e3, T0 = Date.parse('2026-10-01T10:00:00Z');
  const isoJ = (j, h = 0) => new Date(T0 + j * J + h * 3600e3).toISOString();
  const TITRE = 'Nike Dunk Low Panda 42 noir';

  // ════════ A · L'ATELIER ════════════════════════════════════════════════════
  // A1 — 50 achats identiques : chacun SON prix, par SON n° de transaction.
  {
    const bad = [];
    for (let k = 1; k <= 50; k++) {
      const tx = String(8800000 + k);
      const e = { tx, titre: TITRE, prix: 40 + k, site: 'vinted' };
      const p = A.prixPayeArrivee(e);
      if (!p || p.tx !== tx || p.centimes !== (40 + k) * 100 || p.source !== 'achat') bad.push({ k, p });
    }
    dit(bad.length === 0, 'A1a · 50 achats au même titre : chacun SON prix payé, par SON n° de transaction', bad.slice(0, 3));
    const recu = A.prixPayeArrivee({ tx: '8800007', titre: TITRE, prix: 47, paye: { centimes: 5190, source: 'recu', detail: 'Article 47,00 € · Port 3,40 € · Frais 1,50 €', tx: '8800007' } });
    dit(!!recu && recu.centimes === 5190 && recu.source === 'recu' && recu.valeur === '51,90', 'A1b · le reçu juste de CET achat (« Payé sur Vinted ») passe avant l’article seul', recu);
    const autreRecu = A.prixPayeArrivee({ tx: '8800007', titre: TITRE, prix: 47, paye: { centimes: 9990, source: 'recu', detail: 'x', tx: '8800008' } });
    dit(!!autreRecu && autreRecu.centimes === 4700, 'A1c · le reçu d’un AUTRE achat n’est jamais pris (on retombe sur CET achat)', autreRecu);
    const refus = {
      sansTx: A.prixPayeArrivee({ tx: '', titre: TITRE, prix: 45 }),
      txTitre: A.prixPayeArrivee({ tx: TITRE, titre: TITRE, prix: 45 }),
      lot: A.prixPayeArrivee({ tx: '8800100', titre: 'Lot de 3 paires', prix: 90, lot: true, n: 3 }),
      lotN: A.prixPayeArrivee({ tx: '8800101', titre: TITRE, prix: 90, n: 3 }),
      rembourse: A.prixPayeArrivee({ tx: '8800102', titre: TITRE, prix: 45, statut: 'Remboursement effectué' }),
      devise: A.prixPayeArrivee({ tx: '8800103', titre: TITRE, prix: 45, devise: 'GBP' }),
      pasLu: A.prixPayeArrivee({ tx: '8800104', titre: TITRE, prix: null }),
    };
    dit(Object.values(refus).every((x) => x === null), 'A1d · sans n° de transaction, lot, remboursé, autre devise, prix pas lu ⇒ RIEN proposé (jamais deviné)', refus);
    dit(A.indicatifLot({ lot: true, n: 3, prix: 90 }) === '30' && A.indicatifLot({ prix: 90 }) === '', 'A1e · un lot : « ≈ 30 » en indication seulement (jamais écrit)');
  }
  // A2 — l'écriture du prix : SON N°, jamais par-dessus.
  {
    const fiches = { a1: { id: 'a1', numero: '13', origine: 'arrivee' }, a2: { id: 'a2', numero: '14', origine: 'arrivee', prixAchat: 30 } };
    const r = A.opsPrixAchat({ fiches, id: 'a1', couts: {}, texte: '41,9', source: 'recu' });
    const cles = r.ok ? r.ops.map((o) => `${o.k}:${o.id}`) : [];
    dit(r.ok && r.valeur === '41,90' && cles.join(',') === 'vinted_buyprice_by_num:13,vrm_fiches_neuves:a1' && r.ops[0].apres === '41,90' && r.ops[1].apres.prixAchat === 41.9,
      'A2a · « Garder 41,90 € » : le coût de SON N° (13) et sa fiche, rien d’autre', r);
    const deja = A.opsPrixAchat({ fiches, id: 'a1', couts: { 13: '35' }, texte: '41,90' });
    const dejaF = A.opsPrixAchat({ fiches, id: 'a2', couts: {}, texte: '41,90' });
    const vide = A.opsPrixAchat({ fiches, id: 'a1', couts: {}, texte: '  ' });
    const illisible = A.opsPrixAchat({ fiches, id: 'a1', couts: {}, texte: 'environ 40' });
    const pasLu = A.opsPrixAchat({ fiches: null, id: 'a1', couts: {}, texte: '40' });
    dit(!deja.ok && deja.raison === 'deja' && !dejaF.ok && dejaF.raison === 'deja' && !vide.ok && vide.raison === 'vide' && !illisible.ok && illisible.raison === 'illisible' && !pasLu.ok && pasLu.raison === 'lecture',
      'A2b · prix déjà posé (N° ou fiche), vide, illisible, données pas lues ⇒ AUCUNE écriture', { deja, dejaF, vide, illisible, pasLu });
  }
  // A3 — où en est une paire.
  {
    const e0 = A.etapesPaire({ fiche: null });
    dit(A.etapeReprise(e0) === 'numero' && e0.filter((e) => e.raison === 'sansNumero').length === 5, 'A3a · pas encore de N° : la reprise est le N° ; la CASE, les photos, le prix, la fiche, publier attendent le N° (on range un article, pas un achat)', e0);
    const f = { id: 'a1', numero: '13', origine: 'arrivee', case: { m: 'm1', i: 2 } };
    const e1 = A.etapesPaire({ fiche: f, photos: 0, cout: null, etatVinted: 'a-creer', marques: null });
    dit(A.etapeReprise(e1) === 'photos' && e1[0].etat === 'fait' && e1[1].etat === 'fait', 'A3b · rangée dans sa case : N° et case faits, reprise aux photos', e1);
    const e2 = A.etapesPaire({ fiche: { ...f, case: undefined }, photos: 2, cout: '41,90', etatVinted: 'a-creer', marques: { e: { case: 'passe', fiche: 'passe' } } });
    const e2b = A.etapesPaire({ fiche: { ...f, case: undefined }, photos: 0, cout: null, etatVinted: 'a-creer', marques: null });
    dit(e2b[0].etat === 'fait' && e2b[1].etat === 'afaire' && A.etapeReprise(e2b) === 'case', 'A3b2 · N° donné, pas de case : la reprise est la CASE de l’article', e2b);
    dit(e2[1].etat === 'passe' && e2[2].etat === 'fait' && e2[3].etat === 'fait' && e2[4].etat === 'passe' && A.etapeReprise(e2) === 'publier', 'A3c · case « Plus tard » = passée ; 2 photos du studio = fait ; prix posé = fait ; fiche « Plus tard » = passée ; reprise : publier', e2);
    const e3 = A.etapesPaire({ fiche: { ...f, completeAt: isoJ(1) }, photos: null, cout: '40', etatVinted: 'en-ligne', marques: { e: { photos: 'passe' } } });
    dit(A.etapeReprise(e3) === null && e3[2].etat === 'passe' && e3[2].raison === 'passu' && e3[5].etat === 'fait' && A.progression(e3).faites === 5, 'A3d · photos pas lues + « Plus tard » ⇒ passée (pas su dit) ; en ligne ⇒ publiée ; tout réglé ⇒ aucune reprise', e3);
    const e4 = A.etapesPaire({ fiche: f, photos: null, cout: null, etatVinted: 'a-creer', marques: null });
    dit(e4[2].etat === 'afaire' && e4[2].raison === 'passu', 'A3e · photos PAS LUES ne valent pas « faites » (pas su ≠ oui)', e4[2]);
  }
  // A4 — les fiches d'un achat : par identité.
  {
    const fiches = {};
    for (let k = 1; k <= 50; k++) fiches['f' + k] = { id: 'f' + k, numero: String(k), titre: TITRE, origine: 'arrivee', achat: { tx: String(8800000 + k) } };
    fiches.lot1 = { id: 'lot1', numero: '60', titre: '', origine: 'arrivee', achat: { tx: '8809999', ligne: 2, sur: 2 } };
    fiches.lot2 = { id: 'lot2', numero: '59', titre: '', origine: 'arrivee', achat: { tx: '8809999', ligne: 1, sur: 2 } };
    fiches.colis = { id: 'colis', numero: '61', titre: TITRE, origine: 'arrivee', achat: { tx: '' } };
    fiches.retiree = { id: 'retiree', numero: '62', titre: TITRE, origine: 'arrivee', achat: { tx: '8800007' }, retireeAt: isoJ(2) };
    const de7 = A.fichesDeLArrivee({ fiches, tx: '8800007', cleNum });
    const lot = A.fichesDeLArrivee({ fiches, tx: '8809999', cleNum });
    const colis = A.fichesDeLArrivee({ fiches, tx: '', numeros: ['061'], cleNum });
    const rien = A.fichesDeLArrivee({ fiches, tx: '', numeros: [], cleNum });
    dit(de7.length === 1 && de7[0].id === 'f7', 'A4a · 50 fiches au même titre : l’achat 8800007 n’a QUE sa fiche (N°7), la retirée exclue', de7.map((f) => f.id));
    dit(lot.map((f) => f.id).join(',') === 'lot2,lot1' && colis.length === 1 && colis[0].id === 'colis' && rien.length === 0, 'A4b · un lot dans l’ordre de ses lignes ; un colis sans achat par le N° rendu (« 061 » = 61) ; rien sans identité', { lot: lot.map((f) => f.id), colis: colis.map((f) => f.id), rien });
  }
  // A5 — la fiche pré-remplie de ce que l'achat dit.
  {
    const couleursDe = (t) => ['noir', 'blanc', 'rouge'].filter((c) => new RegExp('\\b' + c + '\\b').test(String(t).toLowerCase()));
    const marqueDe = (t) => (/nike/i.test(t) ? 'Nike' : '');
    const f1 = A.ficheDepuisAchat({ titre: TITRE, taille: '42', prix: 45 }, { id: 'a1', numero: '13' }, { marqueDe, couleursDe });
    const f2 = A.ficheDepuisAchat({ titre: 'Nike noir et blanc', taille: '43', prix: 45 }, { id: 'a1', numero: '13' }, { marqueDe, couleursDe });
    const f3 = A.ficheDepuisAchat({ titre: TITRE, taille: '42' }, { id: 'a1', numero: '13', titre: 'Mon titre', couleur: 'Gris', prix: 85 }, { marqueDe, couleursDe });
    dit(f1.titre === TITRE && f1.marque === 'Nike' && f1.taille === '42' && f1.couleur === 'noir' && f1.prix === '' && f1.categorie === '', 'A5a · titre, marque, taille, couleur de l’ACHAT ; prix de vente VIDE ; catégorie pas lue ⇒ vide', f1);
    dit(f2.couleur === '' && f3.titre === 'Mon titre' && f3.couleur === 'Gris' && f3.prix === '85', 'A5b · deux couleurs ⇒ vide (on ne choisit pas) ; ce qu’il a écrit sur la fiche passe avant', { f2, f3 });
  }
  // A6 — « Enregistrer la fiche ».
  {
    const fiches = { a1: { id: 'a1', numero: '13', origine: 'arrivee', titre: 'x' } };
    const r = A.opsFiche({ fiches, id: 'a1', champs: { titre: ' Dunk ', marque: 'Nike', prix: '85,5', numero: '999', achat: { tx: '1' }, couleur: 'Noir' }, maintenant: isoJ(3) });
    const ap = r.ok ? r.ops[0].apres : {};
    dit(r.ok && r.ops.length === 1 && r.ops[0].type === 'champs' && ap.titre === 'Dunk' && ap.prix === 85.5 && ap.completeAt === isoJ(3) && !('numero' in ap) && !('achat' in ap) && r.ops[0].avant.titre === 'x',
      'A6a · liste blanche (ni N°, ni achat), prix de vente relu, `completeAt`, l’avant gardé pour « Annuler »', r);
    const bad = A.opsFiche({ fiches, id: 'a1', champs: { prix: 'quatre-vingts' } });
    const ret = A.opsFiche({ fiches: { a1: { ...fiches.a1, retireeAt: isoJ(1) } }, id: 'a1', champs: { titre: 'y' } });
    dit(!bad.ok && bad.raison === 'prix' && !ret.ok && !A.opsFiche({ fiches: null, id: 'a1', champs: {} }).ok, 'A6b · prix de vente illisible, fiche retirée, données pas lues ⇒ RIEN', { bad, ret });
    const m = A.opMarque({ marques: { a1: { e: { photos: 'passe' }, at: isoJ(1) } }, id: 'a1', etape: 'prix', etat: 'passe', maintenant: isoJ(2) });
    dit(!!m && m.k === 'vrm_atelier_arrivee' && m.apres.e.photos === 'passe' && m.apres.e.prix === 'passe' && m.avant.e.prix === undefined && A.opMarque({ marques: {}, id: 'a1', etape: 'inconnue', etat: 'passe' }) === null,
      'A6c · « Plus tard » : SA mémoire par fiche, l’avant gardé ; une étape inconnue ⇒ rien', m);
  }
  // A9 — la case de L'ARTICLE (Julien : « on range une ANNONCE, pas un achat ») : jamais la même pour deux articles.
  {
    const meubles = [{ id: 'mA', name: 'Étagère A', cols: 3, rows: 2 }];
    const slots0 = { B230: { m: 'mA', i: 0 }, 7: { m: 'mA', i: 1 } };
    const fiches = {}; for (let k = 13; k <= 17; k++) fiches['f' + k] = { id: 'f' + k, numero: String(k), titre: TITRE, origine: 'arrivee', achat: { tx: '8809999', ligne: k - 12, sur: 5 } };
    let slots = { ...slots0 }; const donnees = []; let bad = '';
    for (let k = 13; k <= 17; k++) {
      const pr = A.caseProposee({ fiches, meubles, slots, cle: String(k) });
      if (!pr.su) { bad = 'pas su'; break; }
      if (!pr.case) { donnees.push(null); continue; }
      const r = A.opsCase({ fiches, id: 'f' + k, slots, meubles, place: pr.case, cleNum });
      if (!r.ok) { bad = `N°${k} refusé ${r.raison}`; break; }
      const op = r.ops.find((o) => o.k === 'vrm_slots');
      slots = { ...slots, [op.id]: op.apres }; fiches['f' + k] = { ...fiches['f' + k], case: op.apres };
      donnees.push(op.apres.m + ':' + op.apres.i);
    }
    const vus = donnees.filter(Boolean);
    dit(!bad && vus.length === 4 && new Set(vus).size === 4 && !vus.includes('mA:0') && !vus.includes('mA:1') && donnees[4] === null,
      'A9a · un lot de 5 articles : chacun SA case libre (4 cases libres ⇒ 4 différentes, la 5e « plus de case »), jamais une case prise', { bad, donnees });
    const pris = A.opsCase({ fiches: { g: { id: 'g', numero: '20', origine: 'arrivee' } }, id: 'g', slots, meubles, place: { meubleId: 'mA', i: 2 }, cleNum });
    const deux = A.opsCase({ fiches, id: 'f13', slots, meubles, place: { meubleId: 'mA', i: 5 }, cleNum });
    const sansN = A.opsCase({ fiches: { h: { id: 'h', numero: '', origine: 'arrivee' } }, id: 'h', slots: slots0, meubles, place: { meubleId: 'mA', i: 2 }, cleNum });
    dit(!pris.ok && pris.raison === 'case' && !deux.ok && deux.raison === 'deja' && !sansN.ok && sansN.raison === 'fiche', 'A9b · une case prise ⇒ refusée ; un article déjà rangé ⇒ refusé ; un achat SANS N° ne se range pas', { pris, deux, sansN });
    dit(A.caseProposee({ fiches, meubles: null, slots }).su === false && A.caseProposee({ fiches, meubles: [], slots: {} }).aucunMeuble === true, 'A9c · plan pas lu ⇒ « pas su » ; aucun meuble ⇒ dit');
  }

  // A7 — Ma journée : les paires à finir.
  {
    const now = T0 + 40 * J;
    const fiches = {
      recente: { id: 'recente', numero: '1', origine: 'arrivee', rangeAt: isoJ(38) },
      vieille: { id: 'vieille', numero: '2', origine: 'arrivee', rangeAt: isoJ(1) },
      finie: { id: 'finie', numero: '3', origine: 'arrivee', rangeAt: isoJ(38), completeAt: isoJ(39), case: { m: 'm', i: 1 } },
      retiree: { id: 'retiree', numero: '4', origine: 'arrivee', rangeAt: isoJ(38), retireeAt: isoJ(39) },
      dupliquee: { id: 'dupliquee', numero: '5', origine: 'dupliquer', rangeAt: isoJ(38) },
    };
    const l = A.pairesAFinir({ fiches, marques: { finie: { e: { photos: 'fait' } } }, couts: { 3: '40' }, etatVinted: (f) => (f.id === 'finie' ? 'en-ligne' : 'a-creer'), maintenant: now });
    dit(l.map((x) => x.fiche.id).join(',') === 'recente' && l[0].reprise === 'case', 'A7 · seulement la paire numérotée il y a 2 jours, pas finie (reprise : sa case) (ni la vieille, ni la finie, ni la retirée, ni une fiche « Dupliquer »)', l.map((x) => [x.fiche.id, x.reprise]));
  }
  // A8 — les branchements (code lu, commentaires retirés).
  {
    const ui = sansCommentaires(lire('src/AtelierArrivee.jsx'));
    const app = sansCommentaires(lire('src/App.jsx'));
    dit(/coque\.ranger\(entree, lignes\.map\(\(l\) => \(\{ \.\.\.l, prix: '', case: null \}\)\)\)/.test(ui) && /etape === 'case' && fiche \? <EtapeCase/.test(ui), 'A8a · « Donner ce N° » : le geste de « Ranger cet achat » SANS prix ni case ; la case se propose à l’ARTICLE (sa fiche), après son N°');
    // (15 nov., intégration avec claude/pas-ranger-achat) L'événement s'appelle `vrm:atelier-numeroter` : il ouvre l'atelier
    // sur le N° de l'article ; la feuille « Ranger cet achat » n'est plus montée (on range un article, pas un achat).
    dit(/window\.addEventListener\('vrm:atelier-numeroter', f\)/.test(app.slice(app.indexOf('function AtelierArriveeCoque'), app.indexOf('function AtelierArriveeCoque') + 3000)) && /<AtelierArriveeCoque\/>/.test(app) && !/<RangerAchatCoque\/>/.test(app)
      && /const markCollected = \(t\) => \{[^\n]*apresRetraitAtelier\(entreeArriveeColis\(t\)\)/.test(app),
      'A8b · « J’ai retiré » ouvre l’atelier sur le N° de l’article, une seule feuille');
    const bloc = app.slice(app.indexOf('function AtelierArriveeCoque'), app.indexOf('function AtelierArriveeCoque') + 7000)   // (20 nov., arrivee-scan) la coque porte aussi l'écran d'arrivée : fenêtre élargie;
    dit(/ecrireAtelier\(/.test(bloc) && /const ecrireAtelier = \(texte, ops, acc = ''\) => \{ gesteVrm\(/.test(app) && !/save\(['"]vrm_fiches_neuves/.test(bloc) && !/save\(['"]vinted_buyprice_by_num/.test(bloc),
      'A8c · chaque écriture de l’atelier passe par `gesteVrm` (annulable), jamais un `save` direct');
    dit(/Note=\{\(num\) => <NotePaireCoque numero=\{num\} variante="bloc" ajout dicter\/>\}/.test(bloc) && /Note\(fiche\.numero\)/.test(ui), 'A8d · la note (et sa dictée par le navigateur) dans l’atelier');
    dit(/entreeAvecPaye/.test(app) && /propositionPrixAchat\(\{ identite: \{ achat: o, par: 'lien' \}/.test(app), 'A8e · l’entrée porte le prix PAYÉ de CET achat (reçu par SON n° de transaction)');
  }

  // ════════ H · L'HISTORIQUE COMPLET ═════════════════════════════════════════
  {
    const N = 50, item = (k) => String(9100000 + k), tx = (k) => String(7100000 + k);
    const fiches = {}, coffres = {}, offres = [], moderation = [];
    for (let k = 1; k <= N; k++) {
      fiches[item(k)] = { numero: String(k), title: TITRE, price: '80', numberedAt: isoJ(k), auto: true, buyPrice: '40', taille: '42',
        // le vendeur d'un AUTRE achat sur chaque fiche, mais seule N°7 est reliée (buyFromId)
        buyFrom: { title: TITRE, seller: 'vendeur_' + k, date: isoJ(1) }, ...(k === 7 ? { buyFromId: '5557007' } : {}),
        ...(k === 9 ? { recreeAt: isoJ(20), recreeDe: '9109999' } : {}) };
      coffres[item(k)] = { firstSavedAt: isoJ(k + 2) };
      // chaque annonce reçoit SES offres : une acceptée (k pair) ou refusée (k impair), à SON prix
      offres.push({ item: item(k), at: isoJ(10 + k), prix: 60 + k, sens: 'recue', etat: k % 2 ? 'Offre refusée' : 'Offre acceptée', statut: k % 2 ? 'refusee' : 'acceptee' });
      offres.push({ item: item(k), at: isoJ(11 + k), prix: 70 + k, sens: 'faite', etat: '', statut: 'attente' });
      moderation.push({ s: 'masquee', a: item(k), t: T0 + (12 + k) * J, f: T0 + (13 + k) * J, compte: '1' });
    }
    moderation.push({ s: 'disparue', a: item(7), t: T0 + 60 * J, compte: '1' });
    const V7 = { transaction_id: tx(7), title: TITRE, price: { amount: '85', currency_code: 'EUR' }, status: 'Commande finalisée', date: isoJ(40) };
    const VS = { transaction_id: '7199999', title: TITRE, price: { amount: '85', currency_code: 'EUR' }, status: 'Commande finalisée', date: isoJ(41) };
    const D = { fiches, pool: Array.from({ length: N }, (_, i) => String(i + 1)), enLigne: new Set(Object.keys(fiches)), ventes: [V7, VS],
      txnItem: { [tx(7)]: item(7) }, saleOv: {}, bordereaux: [], imprimes: {}, postes: {}, ebayCommandes: [], ebayAnnonces: [], lbcVentes: [], plan: { items: [] } };
    const oRN = { cleNum, ouStock: () => null, expediee: () => true, aPoster: () => false, revenue: () => false, conflits: () => [] };
    const dH = { fiches, saleOv: {}, buyByNum: {}, stats: {}, versements: {}, nomCompte: () => 'boutique_test', coffres, offres, recus: new Set(), autresEnLigne: [], colisVente: {}, journalPrix: [], prixVinted: [], prixLus: null, sortieStock: null };
    const oH = { etapeVente: () => ({ label: 'Commande finalisée', step: 4 }), venteAnnulee: () => false, montantRecuEbay: () => ({ eur: null }), commandeEbayEngagee: () => true, lbcAnnulee: () => false, lbcFinalisee: () => false };
    const retours = { recus: { [tx(7)]: isoJ(50), '7199999': isoJ(51) }, remis: { [tx(7)]: { at: isoJ(52), num: '7' }, '7199999': { at: isoJ(53), num: '' } } };
    const lignes = {}; const bad = []; let err = '';
    try {
      for (let k = 1; k <= N; k++) {
        const rn = RN.toutSurLeNumero(String(k), D, oRN);
        const h = H.histoireArticle(rn, dH, oH);
        lignes[k] = L.ligneDeTemps(h, { crees: {}, studio: { dates: [] }, ids: (rn.annonces || []).map((a) => String(a.id)), txs: ((rn.ventes && rn.ventes.vinted) || []).map((v) => String(v._tx || '')), moderation, retours });
        const tous = [...lignes[k].evenements, ...lignes[k].sansDate];
        const off = tous.filter((e) => /^offre/.test(e.quoi));
        const mod = tous.filter((e) => ['masquee', 'visible', 'disparue'].includes(e.quoi));
        const ret = tous.filter((e) => ['retourRecu', 'remiseStock'].includes(e.quoi));
        if (off.length !== 2 || off.some((e) => e.id !== item(k))) bad.push(`N°${k} offres ${JSON.stringify(off.map((e) => e.id + ':' + e.montant))}`);
        const recue = off.find((e) => e.quoi === 'offreRecue'), faite = off.find((e) => e.quoi === 'offreFaite');
        if (!recue || recue.montant !== 60 + k || recue.statut !== (k % 2 ? 'refusee' : 'acceptee') || !faite || faite.statut !== 'attente') bad.push(`N°${k} état des offres ${JSON.stringify(off)}`);
        if (mod.some((e) => e.id !== item(k)) || mod.length !== (k === 7 ? 3 : 2)) bad.push(`N°${k} masquages ${JSON.stringify(mod.map((e) => e.quoi + ':' + e.id))}`);
        if (k === 7 ? !(ret.length === 2 && ret.every((e) => e.id === tx(7))) : ret.length) bad.push(`N°${k} retours ${JSON.stringify(ret)}`);
        const ach = tous.find((e) => e.quoi === 'achetee');
        if (k === 7 ? !(ach && ach.vendeur === 'vendeur_7') : (ach && ach.vendeur)) bad.push(`N°${k} vendeur ${ach && ach.vendeur}`);
      }
    } catch (e) { err = e.stack || String(e); }
    dit(!err && bad.length === 0, 'H1 · 50 paires identiques : chaque ligne de temps n’a que SES offres (et leur état LU), SES masquages, SES retours ; le vendeur seulement pour l’achat RELIÉ', err || bad.slice(0, 4));
    const l7 = lignes[7] || { evenements: [] };
    const ordre = l7.evenements;
    dit(ordre.length > 5 && ordre.every((e, i) => i === 0 || Date.parse(ordre[i - 1].at) <= Date.parse(e.at)) && ['offreRecue', 'offreFaite', 'masquee', 'visible', 'disparue', 'vendue', 'retourRecu', 'remiseStock'].every((q) => ordre.some((e) => e.quoi === q)),
      'H1b · N°7 : offres, masquée puis visible, disparue, vendue, retour reçu, remise en stock — datés, dans l’ordre', ordre.map((e) => e.quoi));
    const l9 = lignes[9] || { evenements: [] };
    dit(l9.evenements.some((e) => e.quoi === 'republiee' && e.memeNumero === true), 'H1c · une republication dit « même N° » (la paire garde son N°)', l9.evenements.filter((e) => e.quoi === 'republiee'));
    // H2 — rien de lu des masquages : nommé ; un masquage d'une annonce sans identifiant n'entre nulle part.
    const rn7 = RN.toutSurLeNumero('7', D, oRN), h7 = H.histoireArticle(rn7, dH, oH);
    const pasLu = L.ligneDeTemps(h7, { crees: {}, studio: { dates: [] }, ids: [item(7)], moderation: null });
    const sansIds = L.ligneDeTemps(h7, { crees: {}, studio: { dates: [] }, ids: [], moderation });
    dit(pasLu.pasSu.includes('moderation') && !pasLu.evenements.some((e) => e.quoi === 'masquee') && !sansIds.evenements.some((e) => e.quoi === 'masquee'), 'H2 · masquages pas lus ⇒ NOMMÉS ; sans identifiant d’annonce ⇒ aucun masquage', { pasSu: pasLu.pasSu });
    // H3 — une offre sans montant lisible n'est pas une ligne ; un état d'offre illisible ne se devine pas.
    const h7b = H.histoireArticle(rn7, { ...dH, offres: [{ item: item(7), at: isoJ(3), prix: 'NaN', sens: 'recue' }, { item: item(7), at: isoJ(4), prix: 66, sens: null, statut: 'bizarre' }] }, oH);
    const l7b = L.ligneDeTemps(h7b, { crees: {}, studio: { dates: [] } });
    const o7b = [...l7b.evenements, ...l7b.sansDate].filter((e) => /^offre/.test(e.quoi));
    dit(o7b.length === 1 && o7b[0].quoi === 'offre' && o7b[0].statut === '', 'H3 · offre sans montant ⇒ rien ; sens inconnu ⇒ « Offre » ; état illisible ⇒ rien dit', o7b);
    // H4 — l'état d'une offre se lit par `etatOffreVinted` (20 acceptée, 30 refusée), la date ISO aussi.
    const conv = { conversation: { transaction: { item_id: '9100007' }, messages: [
      { entity_type: 'offer_request_message', created_at_ts: '2026-10-05T10:00:00+02:00', entity: { price: { amount: '70' }, user_id: 2, status: 20 } },
      { entity_type: 'offer_request_message', created_at_ts: null, entity: { price: { amount: '65' }, user_id: 2, status: 30 } }] } };
    const od = H.offresDeConversation(conv, 1);
    dit(od.length === 2 && od[0].statut === 'acceptee' && od[0].at === '2026-10-05T08:00:00.000Z' && od[0].sens === 'recue' && od[1].statut === 'refusee' && od[1].at === null,
      'H4 · l’état LU (20 acceptée, 30 refusée), la date ISO de Vinted lue, une date absente reste absente (jamais 1970)', od);
  }

  // ════════ N · LA NOTE À CÔTÉ DE LA CONVERSATION ════════════════════════════
  {
    const app = sansCommentaires(lire('src/App.jsx'));
    // (22 nov.) 5.430 pose aussi la NOTE DE L'ACHETEUR (`data-fil-note`, NoteAcheteurApp) : on juge celle de la PAIRE.
    const i = (() => { let k = -1; while ((k = app.indexOf('data-fil-note=', k + 1)) > 0) if (/NotePaireCoque/.test(app.slice(k, k + 400))) return k; return app.indexOf('data-fil-note='); })();
    const bloc = i > 0 ? app.slice(i - 400, i + 400) : '';
    dit(/paireDeConv\(/.test(bloc) && /<NotePaireCoque numero=\{pc\.num\|\|''\} itemId=\{pc\.item!=null\?String\(pc\.item\):''\} variante="bloc"\/>/.test(bloc),
      'N1 · la note de la paire du fil, par SON identité (N°, sinon l’annonce de la transaction), lue par NotePaireCoque seulement');
    dit(!/<NotePaireCoque[^>]*ajout[^>]*\/>/.test(bloc), 'N2 · à côté du fil : une note existante se montre, rien à écrire par-dessus la conversation');
  }

  // ════════ T · LA TAILLE DU TEXTE ═══════════════════════════════════════════
  {
    const ids = T.TAILLES_TEXTE.map((t) => t.id).join(',');
    dit(ids === 'normal,grand,plusGrand,tresGrand' && T.echelleTotale(1, 'normal') === 1 && T.echelleTotale(1, 'tresGrand') === 1.36 && T.echelleTotale(1, 'inconnue') === 1,
      'T1a · quatre tailles ; Normal = 1, Très grand = 1,36, une valeur inconnue = Normal');
    dit(T.echelleTotale(1.3, 'tresGrand') === 1.6 && T.echelleTotale(1.1, 'grand') === 1.23 && T.echelleTotale(0.8, 'normal') === 1, 'T1b · l’appareil × le choix, au centième, borné entre 1 et 1,6');
    const st = { m: {}, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = String(v); }, removeItem(k) { delete this.m[k]; } };
    T.ecrireTailleTexte('plusGrand', st); const a = T.lireTailleTexte(st); T.ecrireTailleTexte('normal', st);
    dit(a === 'plusGrand' && T.lireTailleTexte(st) === 'normal' && !('vrm_taille_texte' in st.m), 'T1c · rangé sur CET appareil ; « Normal » efface la clé');
    const app = sansCommentaires(lire('src/App.jsx')), reg = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
    dit(/const g = echelleTotale\(echelleTexte\(\), lireTailleTexte\(\)\); marquerGrandTexte\(g\);/.test(app), 'T2 · `applyZoom` applique le choix (le même mécanisme que la Taille du texte de l’iPhone)');
    dit(/id:'taille-texte'/.test(reg) && /<TailleTexteSetting\/>/.test(reg) && /applyZoom\(readZoom\(\)\)/.test(reg.slice(reg.indexOf('function TailleTexteSetting'), reg.indexOf('function TailleTexteSetting') + 1500)),
      'T3 · Paramètres → Taille du texte : le choix s’applique tout de suite');
  }

  console.log(`\n${ko ? '❌' : '✅'} audit-atelier-arrivee : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
