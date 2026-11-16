#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — RELIER EN GLISSANT (16 nov., lot relier-glisser)
//        node scripts/audit-relier-glisser.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien : « faire comme quand on reste appuyé sur une app sur iPhone : ça vibre, et après tu places
// [l'achat] sur la vente ou l'annonce. Sinon une liste, ça peut être aussi simple. »
// EXÉCUTE src/relierGlisser.js (et src/gesteAnnulable.js pour « Annuler ») :
//   A  l'appui : un doigt qui bouge AVANT 400 ms défile (jamais un glisser) ; immobile 400 ms ⇒ levé ;
//      la souris glisse dès 6 px ;
//   D  le défilement au bord de la liste cible (haut ⇒ monte, bas ⇒ descend, milieu ⇒ rien) ;
//   L  les listes : seuls les achats LIBRES (ni reliés, ni annulés, ni en retour / litige), les « très
//      probables » d'abord, marqués seulement vers une cible présente ;
//   P  la phrase « Relier N°215 à cet achat de 24,63 € ? » ;
//   O  l'écriture : par l'IDENTITÉ de la ligne (fiche de l'annonce, sinon la vente), rien sans identité ;
//      « Annuler » rend exactement l'état d'avant (lien retiré) ;
//   V  la vibration seulement si `navigator.vibrate` existe (iPhone : non) ; aucun texte ne la promet ;
//   S  le branchement : cibles = « sans achat relié » seulement, l'écriture de « Relier » en geste annulable,
//      trois entrées (feuille, Annonces, Achats), le doigt ne défile plus une fois l'achat levé.
// Aucune donnée réelle. --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const MUTS = {
  'appui-sans-delai': ['src/relierGlisser.js', "      if (d > SEUIL_DEFILEMENT_PX) return evt.t - etat.t0 >= DELAI_APPUI_MS ? { ...etat, phase: 'leve' } : { phase: 'defile' };", "      if (d > SEUIL_DEFILEMENT_PX) return { ...etat, phase: 'leve' };"],
  'delai-court': ['src/relierGlisser.js', 'export const DELAI_APPUI_MS = 400;', 'export const DELAI_APPUI_MS = 0;'],
  'bord-dehors': ['src/relierGlisser.js', '  if (y < haut || y > bas) return 0;', '  if (y < haut - BORD_DEFILEMENT_PX || y > bas + BORD_DEFILEMENT_PX) return 0;'],
  'bord-inverse': ['src/relierGlisser.js', "  if (y < haut + BORD_DEFILEMENT_PX) return -Math.round(", "  if (y < haut + BORD_DEFILEMENT_PX) return Math.round("],
  'achats-tous': ['src/relierGlisser.js', '  const libres = tousAchatsLibres({ achats, liens });', '  const libres = achats.filter((a) => a && a.transaction_id != null);'],
  'propose-ailleurs': ['src/relierGlisser.js', "x.niveau === 'tres-probable' && cles.has(String(x.key))", "x.niveau === 'tres-probable'"],
  'annuler-perd': ['src/relierGlisser.js', "avant: { buyPrice: f.buyPrice, buyFromId: f.buyFromId, buyFrom: f.buyFrom } });", "avant: {} });"],
  'sans-identite': ['src/relierGlisser.js', "  if (!cible || !w || w.buyFromId == null || String(w.buyFromId) === '') return [];", "  if (!cible || !w) return [];"],
  'vibre-partout': ['src/relierGlisser.js', "  try { if (nav && typeof nav.vibrate === 'function') return nav.vibrate(ms) !== false; } catch (_) {}\n  return false;", '  return true;'],
  'app-cibles-reliees': ['src/App.jsx', '    for (const x of (fileAchat || [])) { const f = x.fiche || numeros[x.id] || {};', "    for (const x of (listings.items || []).map((it) => ({ id: it.id, item: it, ts: it.createdTs }))) { const f = numeros[x.id] || {};"],
  'app-sans-annuler': ['src/App.jsx', "    gesteVrm(res.texte, ops,", "    vueDesOps(ops, { vinted_annonce_numeros: setNumeros, vinted_sale_overrides: setSaleOv })('apres'); (() => {})(res.texte, ops,"],
  'app-sans-recu': ['src/App.jsx', "cle: String(a.transaction_id || ''), faire: () => ouvrirRecuRelie(a, num) });", "cle: '', faire: () => {} });"],
  'app-feuille-bulle': ['src/App.jsx', "    const ok = confirmerLiaison(a, cible._saleTx ?", "    const ok = false && confirmerLiaison(a, cible._saleTx ?"],
  'benefice-sans-frais': ['src/relierGlisser.js', "  const r = typeof ligne === 'function' ? ligne(prix, entree || {}) : null;", "  const r = typeof ligne === 'function' ? ligne(prix, { buyPrice: (entree || {}).buyPrice, fraisComplets: true }) : null;"],
  'pilule-sans-action': ['src/PiluleAnnuler.jsx', "{v && v.action ? <button", "{false && v.action ? <button"],
  'ecran-defile-pendant': ['src/RelierGlisser.jsx', "if (appui.current && appui.current.phase === 'leve' && e.cancelable) e.preventDefault();", 'void e;'],
  'ecran-bloque-toujours': ['src/RelierGlisser.jsx', "if (appui.current && appui.current.phase === 'leve' && e.cancelable) e.preventDefault();", 'if (e.cancelable) e.preventDefault();'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let RACINE = R;
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relier-glisser-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });   // (disque partagé : rien ne reste)
  for (const x of ['src', 'api']) fs.cpSync(path.join(R, x), path.join(d, x), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  try { fs.copyFileSync(path.join(R, 'package.json'), path.join(d, 'package.json')); } catch (_) {}
  const [f, ...paires] = MUTS[MUT];
  const p = path.join(d, f); let s = fs.readFileSync(p, 'utf8');
  for (let i = 0; i < paires.length; i += 2) { if (!s.includes(paires[i])) { console.log('motif introuvable : ' + MUT); process.exit(2); } s = s.replace(paires[i], paires[i + 1]); }
  fs.writeFileSync(p, s); RACINE = d;
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
const SRC = path.join(RACINE, 'src');
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const { sourceApp } = require('./_source-app.cjs');
const APP = sourceApp(RACINE);
const sans = (s) => s.replace(/\/\/[^\n]*/g, '');

(async () => {
  let G = null, H = null, GA = null, FR = null;
  try { G = await import(pathToFileURL(path.join(SRC, 'relierGlisser.js')).href); } catch (e) { dit(false, 'src/relierGlisser.js se charge', e.message.split('\n')[0]); }
  try { H = await import(pathToFileURL(path.join(SRC, 'achatsHorsRelier.js')).href); } catch (_) {}
  try { GA = await import(pathToFileURL(path.join(SRC, 'gesteAnnulable.js')).href); } catch (e) { dit(false, 'src/gesteAnnulable.js se charge', e.message.split('\n')[0]); }
  try { FR = (await import(pathToFileURL(path.join(SRC, 'i18n/langues/fr/liaison.js')).href)).default; } catch (_) { FR = {}; }
  if (!G || !GA) { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }

  // ── A · l'appui ──
  const t0 = 1000;
  const doigt = { phase: 'appui', x0: 100, y0: 300, t0, souris: false, tx: '1' };
  dit(G.appuiSuivant(doigt, { type: 'bouge', x: 100, y: 330, t: t0 + 120 }).phase === 'defile', 'A1 doigt qui file de 30 px en 120 ms ⇒ un DÉFILEMENT, jamais un glisser');
  dit(G.appuiSuivant(doigt, { type: 'bouge', x: 104, y: 303, t: t0 + 200 }).phase === 'appui', 'A2 un tremblement de 5 px ne compte pas (toujours l’appui)');
  dit(G.appuiSuivant(doigt, { type: 'temps', t: t0 + 399 }).phase === 'appui', 'A3 à 399 ms : pas encore levé');
  dit(G.appuiSuivant(doigt, { type: 'temps', t: t0 + G.DELAI_APPUI_MS }).phase === 'leve' && G.DELAI_APPUI_MS >= 300 && G.DELAI_APPUI_MS <= 600, `A4 immobile ${G.DELAI_APPUI_MS} ms ⇒ levé (appui long entre 300 et 600 ms)`);
  const souris = { ...doigt, souris: true };
  dit(G.appuiSuivant(souris, { type: 'bouge', x: 108, y: 300, t: t0 + 30 }).phase === 'leve', 'A5 à la souris : un glisser franc (≥ 6 px) démarre sans attendre');
  dit(G.appuiSuivant(souris, { type: 'bouge', x: 102, y: 300, t: t0 + 30 }).phase === 'appui', 'A6 …un clic qui bouge de 2 px reste un clic');
  // ── D · défilement au bord ──
  dit(G.vitesseBord(400, 100, 700) === 0, 'D1 au milieu de la liste : aucun défilement');
  dit(G.vitesseBord(110, 100, 700) < 0 && G.vitesseBord(690, 100, 700) > 0, 'D2 près du haut ⇒ monte, près du bas ⇒ descend');
  dit(Math.abs(G.vitesseBord(101, 100, 700)) > Math.abs(G.vitesseBord(150, 100, 700)), 'D3 plus près du bord ⇒ plus vite');
  dit(G.vitesseBord(10, 100, 700) === 0 && G.vitesseBord(NaN, 100, 700) === 0, 'D4 loin hors de la liste ou position inconnue ⇒ rien');
  dit(G.vitesseBord(95, 100, 700) === 0 && G.vitesseBord(705, 100, 700) === 0, 'D5 juste au-dessus (on y entre par le haut) ou au-dessous de la liste ⇒ rien');
  dit(G.ATTENTE_BORD_MS >= 200, 'D6 le doigt doit RESTER près du bord (≥ 200 ms) : le traverser ne fait rien défiler');

  // ── L · les listes ──
  const A = [
    { transaction_id: 1, title: 'Nike Dunk Low noir 42', date: '2026-10-01', status: 'Commande finalisée' },
    { transaction_id: 2, title: 'Nike Dunk Low noir 42', date: '2026-10-05', status: 'Commande finalisée' },          // déjà relié
    { transaction_id: 3, title: 'Nike Dunk Low noir 42', date: '2026-10-03', status: 'Remboursement effectué' },      // remboursé
    { transaction_id: 4, title: 'Adidas Samba 40', date: '2026-09-20', status: 'Commande finalisée' },                // très probable
    { transaction_id: 5, title: 'Asics Gel 44', date: '2026-10-10', status: 'Commande finalisée' },                   // très probable vers une cible absente
    { transaction_id: 6, title: 'Nike Dunk Low noir 42', date: '2026-10-07', status: 'Commande finalisée' },          // bordereau de retour (carte publiée)
  ];
  if (H) H.publierHorsRelier(new Map([['6', 'retour']]));
  const cibles = [{ key: 'a:10', genre: 'annonce', id: '10', titre: 'Adidas Samba 40', num: '215' }, { key: 'v:77', genre: 'vente', tx: '77', titre: 'Nike Dunk Low noir 42' }];
  const L = G.listesGlisser({ achats: A, liens: new Map([['2', 1]]), tresProbables: { 4: [{ key: 'a:10', niveau: 'tres-probable' }], 5: [{ key: 'a:99', niveau: 'tres-probable' }] }, cibles });
  const txs = (L.achats || []).map((x) => x.tx);
  dit(!txs.includes('2'), 'L1 un achat déjà relié n’est pas proposé', txs.join(','));
  dit(!txs.includes('3'), 'L2 un achat remboursé n’est pas proposé', txs.join(','));
  dit(!txs.includes('6'), 'L3 un achat en retour (carte publiée) n’est pas proposé', txs.join(','));
  dit(txs[0] === '4' && (L.achats[0] || {}).propose === 'a:10', 'L4 le « très probable » vient en tête, marqué vers SA cible', JSON.stringify(L.achats && L.achats[0] && { tx: L.achats[0].tx, p: L.achats[0].propose }));
  const x5 = (L.achats || []).find((x) => x.tx === '5');
  dit(x5 && x5.propose === '', 'L5 un « très probable » vers une cible absente n’est pas marqué', JSON.stringify(x5 && x5.propose));
  dit(G.listesGlisser({ achats: undefined, cibles }).achats === undefined && G.listesGlisser({ achats: null, cibles }).achats === null, 'L6 achats en cours ⇒ undefined ; pas su ⇒ null (jamais une liste vide)');
  if (H) H.publierHorsRelier(null);

  // ── P · la phrase ──
  const t = (k, v) => { let s = FR[k] || k; for (const [a, b] of Object.entries(v || {})) s = s.replace('{' + a + '}', b); return s; };
  const eur = (n) => `${n.toFixed(2).replace('.', ',')} €`;
  dit(G.phraseConfirmation({ cible: cibles[0], prix: 24.63 }, t, eur) === 'Relier N°215 à cet achat de 24,63 € ?', 'P1 « Relier N°215 à cet achat de 24,63 € ? »', G.phraseConfirmation({ cible: cibles[0], prix: 24.63 }, t, eur));
  dit(/« Nike Dunk Low noir 42 »/.test(G.phraseConfirmation({ cible: cibles[1], prix: 30 }, t, eur)), 'P2 sans N° : le titre de la vente entre guillemets');
  dit(/prix de cet article/.test(G.phraseConfirmation({ cible: cibles[0], lot: true }, t, eur)), 'P3 un lot : le prix de cet article sera demandé (jamais deviné)');

  // ── O · l'écriture et « Annuler » ──
  const w = { buyPrice: '24.63', buyFromId: '4', buyFrom: { title: 'Adidas Samba 40', price: 24.63 } };
  const fiches = { 10: { numero: '215', title: 'Adidas Samba 40', buyPrice: '' }, 11: { numero: '216', title: 'Autre' } };
  const prixParNum = { 216: '12' };
  const ops = G.opsRelierGlisse({ cible: cibles[0], w, fiches, prixParNum });
  const apres = GA.appliquerOps(fiches, ops, 'apres', 'vinted_annonce_numeros');
  dit(apres['10'].buyFromId === '4' && apres['10'].buyPrice === '24.63', 'O1 l’annonce N°215 porte le lien (son identifiant d’annonce)');
  dit(JSON.stringify(apres['11']) === JSON.stringify(fiches['11']), 'O2 aucune autre fiche ne bouge');
  const pn = GA.appliquerOps(prixParNum, ops, 'apres', 'vinted_buyprice_by_num');
  dit(pn['215'] === '24.63' && pn['216'] === '12', 'O3 le prix par N° suit (N°215 seulement)');
  const annule = GA.appliquerOps(apres, ops, 'avant', 'vinted_annonce_numeros');
  dit(!annule['10'].buyFromId && annule['10'].buyPrice === '' && !('buyFrom' in annule['10']), 'O4 « Annuler » ⇒ le lien est retiré (état d’avant exact)', JSON.stringify(annule['10']));
  dit(!('215' in GA.appliquerOps(pn, ops, 'avant', 'vinted_buyprice_by_num')), 'O5 « Annuler » retire aussi le prix posé par N°');
  const opsV = G.opsRelierGlisse({ cible: cibles[1], w: { ...w, buyFromId: '1' }, fiches, ventes: {} });
  const ventesApres = GA.appliquerOps({}, opsV, 'apres', 'vinted_sale_overrides');
  dit(opsV.length === 1 && ventesApres['77'] && ventesApres['77'].buyFromId === '1', 'O6 une vente sans fiche : le lien sur la vente (son n° de transaction)');
  dit(!('77' in GA.appliquerOps(ventesApres, opsV, 'avant', 'vinted_sale_overrides')), 'O7 …et « Annuler » l’en retire');
  const opsVF = G.opsRelierGlisse({ cible: { ...cibles[1], idf: '11' }, w, fiches });
  dit(opsVF[0] && opsVF[0].k === 'vinted_annonce_numeros' && opsVF[0].id === '11', 'O8 une vente dont l’annonce a une fiche : le lien sur la fiche');
  dit(!G.opsRelierGlisse({ cible: cibles[0], w: { buyPrice: '10' }, fiches }).length && !G.opsRelierGlisse({ cible: { genre: 'vente' }, w, fiches }).length, 'O9 sans identité (achat ou cible) ⇒ rien n’est écrit');

  // ── V · la vibration ──
  let vibre = 0;
  dit(G.vibrerSiPossible({}) === false, 'V1 Safari iOS (pas de navigator.vibrate) ⇒ aucune vibration demandée');
  dit(G.vibrerSiPossible({ vibrate: () => { vibre++; return true; } }) === true && vibre === 1, 'V2 Android / Chrome ⇒ une vibration courte');
  const textes = Object.entries(FR).filter(([k]) => /^glisser\./.test(k)).map(([, v]) => String(v)).join(' ');
  dit(textes.length > 50 && !/vibr/i.test(textes), 'V3 aucun texte de l’écran ne promet une vibration');

  const app = sans(APP);
  // ── R · le résultat d'une liaison : le bénéfice et le reçu (ajout de Julien) ──
  let BL = null; try { BL = await import(pathToFileURL(path.join(SRC, 'beneficeLigne.js')).href); } catch (_) {}
  const tA = (k, v) => ({ 'liaison.relieBenef': 'Achat relié · Bénéfice {benef}', 'liaison.relieAffiche': 'Achat relié · Bénéfice {benef} au prix affiché' }[k] || k).replace('{benef}', v.benef);
  const ap = (o) => (G.texteApresLiaison ? G.texteApresLiaison(o, tA, BL.beneficeLigneVente, BL.texteBenefice) : { texte: '' });
  const nb = (x) => String(x).replace(/\u00a0/g, ' ');
  dit(BL && nb(ap({ genre: 'vente', prix: '60.00', entree: { buyPrice: '37.43', fraisComplets: true } }).texte) === 'Achat relié · Bénéfice +22,57 €', 'R1 vente 60 € − achat 37,43 €, frais confirmés ⇒ « Achat relié · Bénéfice +22,57 € » (la règle de la ligne)', BL ? nb(ap({ genre: 'vente', prix: '60.00', entree: { buyPrice: '37.43', fraisComplets: true } }).texte) : 'beneficeLigne absent');
  dit(BL && nb(ap({ genre: 'vente', prix: '60.00', entree: { buyPrice: '37.43', commission: '3.00' } }).texte) === 'Achat relié · Bénéfice au plus +19,57 €', 'R2 frais pas confirmés ⇒ « au plus » (la règle), les frais connus déduits');
  dit(BL && nb(ap({ genre: 'vente', prix: null, entree: { buyPrice: '37.43' } }).texte) === 'Achat relié · Bénéfice —', 'R3 prix pas lu ⇒ « — » (jamais un 0)');
  dit(BL && /au prix affiché$/.test(nb(ap({ genre: 'annonce', prix: 70, entree: { buyPrice: '40' } }).texte)), 'R4 une annonce pas vendue : le bénéfice au prix affiché');
  const pil = (() => { try { return fs.readFileSync(path.join(SRC, 'PiluleAnnuler.jsx'), 'utf8'); } catch (_) { return ''; } })();
  dit(/\{v && v\.action \? <button[^>]*data-pilule-autre=/.test(pil), 'R5 la pilule offre le second geste (« Reçu »), à côté d’« Annuler »');
  {
    const g = GA.creerGestes({ minuterie: () => 0, arreter: () => {} }); let vu = null; g.abonner ? g.abonner((x) => { vu = x; }) : null;
    let fait = 0; const id = g.lancer({ texte: 'x', cles: [], vue: () => {}, ecrire: async () => ({ ok: true }), action: { libelle: 'Reçu', cle: '42', faire: () => { fait++; } } });
    const v = (g.instantane ? g.instantane() : vu || {}).visible || (vu && vu.visible) || null;
    dit(id && v && v.action && v.action.libelle === 'Reçu' && v.action.cle === '42', 'R6 le geste porte son action « Reçu » (n° de l’achat)', JSON.stringify(v && v.action));
  }
  dit(/const confirmerLiaison = [\s\S]{0,3000}?\{ libelle: [^,]+, cle: String\(a\.transaction_id \|\| ''\), faire: \(\) => ouvrirRecuRelie\(a, num\) \}/.test(app), 'R7 « Reçu » ouvre le reçu de CET achat (son n° de transaction)');
  dit(['const relierAchat = async', 'const relierAchatAnnonce = async', 'const relierAchatVente = async', 'const relierGlisse = async'].every((f) => new RegExp(f.replace(/[()]/g, '\\$&') + '[\\s\\S]{0,900}?(?:const ok = |if \\(!|\\|\\| !|return )confirmerLiaison\\(').test(app)) && !/accompagner\('achat\.relier'/.test(app), 'R8 feuille, propositions, ventes et glisser : la même confirmation (plus de bulle sur la liste)');

  // ── S · le branchement ──
  let ecran = ''; try { ecran = sans(fs.readFileSync(path.join(SRC, 'RelierGlisser.jsx'), 'utf8')); } catch (_) {}
  dit(/const ciblesGlisser = useMemo\(\(\) => \{[\s\S]{0,700}?for \(const x of \(fileAchat \|\| \[\]\)\)[\s\S]{0,900}?for \(const x of \(fileVendus \|\| \[\]\)\)/.test(app), 'S1 les cibles : les annonces et les ventes SANS achat relié (fileAchat, fileVendus)');
  dit(/const relierGlisse = async[\s\S]{0,200}?ecritureRelierAchat\(a\)[\s\S]{0,700}?confirmerLiaison\(/.test(app) && /const confirmerLiaison = [\s\S]{0,1500}?opsRelierGlisse\([\s\S]{0,1800}?gesteVrm\(res\.texte, ops,/.test(app), 'S2 l’écriture de « Relier » (un lot demande son prix), par identité, en geste annulable 5 s');
  dit(['feuille', 'annonces', 'achats'].every((k) => app.includes(`data-glisser-ouvrir="${k}"`)), 'S3 trois entrées : la feuille « Relier », Annonces → Sans achat relié, Achats');
  dit(/addEventListener\('touchmove', bloque, \{ passive: false \}\)/.test(ecran) && /appui\.current\.phase === 'leve' && e\.cancelable\) e\.preventDefault\(\)/.test(ecran), 'S4 le doigt ne défile plus SEULEMENT une fois l’achat levé');
  dit(/data-glisser-ici=/.test(ecran) && /aria-pressed=\{choisi === x\.tx\}/.test(ecran), 'S5 l’alternative clavier / lecteur d’écran : choisir l’achat, puis « Relier ici »');
  dit(/if \(x && c\) setConfirme\(\{ a: x\.a, cible: c \}\);[^\n]*\n\s*return;\s*\/\/|if \(x && c\) setConfirme\(\{ a: x\.a, cible: c \}\);/.test(ecran) && !/onRelier\(x\.a/.test(ecran), 'S6 lâcher ne relie jamais : il POSE la question (« Oui » relie)');
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
