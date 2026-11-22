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
  'marque-sans-choix': ['src/relierGlisser.js', "const pour = (x) => !!(k && tresProbables && Array.isArray(tresProbables[x.tx]) && tresProbables[x.tx].some((p) => p && p.niveau === 'tres-probable' && String(p.key) === k));", "const pour = (x) => !!(tresProbables && Array.isArray(tresProbables[x.tx]) && tresProbables[x.tx].some((p) => p && p.niveau === 'tres-probable'));"],
  'marque-autre-cible': ['src/relierGlisser.js', "p.niveau === 'tres-probable' && String(p.key) === k)", "p.niveau === 'tres-probable')"],
  'relies-melanges': ['src/relierGlisser.js', "tousAchatsLibresDetail({ achats, liens }).pris.map(", "tousAchatsLibresDetail({ achats, liens }).liste.map("],
  'filtre-cibles-inerte': ['src/relierGlisser.js', "filtre === 'annonce' || filtre === 'vente' ? cs.filter((c) => c && c.genre === filtre) : cs;", "cs;"],
  'badge-sans-choix': ['src/RelierGlisser.jsx', '{x.pour && !flottante ? <span className="vrm-rg-propose"', '{x.propose && !flottante ? <span className="vrm-rg-propose"'],
  'cherche-un-mot': ['src/relierGlisser.js', "return liste.filter((x) => { const foin = foinAchat(x.a, aides); return mots.every((m) => foin.includes(m)); });", "return liste.filter((x) => { const foin = foinAchat(x.a, aides); return mots.some((m) => foin.includes(m)); });"],
  'cherche-cibles-inerte': ['src/relierGlisser.js', "return cs.filter((c) => { const f = foin(c); return mots.every((m) => f.includes(m)); });", "return cs;"],
  'annuler-perd': ['src/relierGlisser.js', "avant: { buyPrice: f.buyPrice, buyFromId: f.buyFromId, buyFrom: f.buyFrom } });", "avant: {} });"],
  'sans-identite': ['src/relierGlisser.js', "  if (!cible || !w || w.buyFromId == null || String(w.buyFromId) === '') return [];", "  if (!cible || !w) return [];"],
  'vibre-partout': ['src/relierGlisser.js', "  try { if (nav && typeof nav.vibrate === 'function') return nav.vibrate(ms) !== false; } catch (_) {}\n  return false;", '  return true;'],
  'app-cibles-reliees': ['src/App.jsx', '    for (const x of (fileAchat || [])) { const f = x.fiche || numeros[x.id] || {};', "    for (const x of (listings.items || []).map((it) => ({ id: it.id, item: it, ts: it.createdTs }))) { const f = numeros[x.id] || {};"],
  'app-sans-annuler': ['src/App.jsx', "    gesteVrm(res.texte, ops,", "    vueDesOps(ops, { vinted_annonce_numeros: setNumeros, vinted_sale_overrides: setSaleOv })('apres'); (() => {})(res.texte, ops,"],
  'app-sans-recu': ['src/App.jsx', "cle: String(a.transaction_id || ''), faire: () => ouvrirRecuRelie(a, num) },", "cle: '', faire: () => {} },"],
  'app-une-ligne': ['src/App.jsx', "faire: () => ouvrirRecuRelie(a, num) }, { titre: res.titre, sous: res.sous });", "faire: () => ouvrirRecuRelie(a, num) });"],
  'pilule-coupe': ['src/pilule-annuler.css', ".vrm-pil.is-resultat .vrm-pil-sous { white-space: normal; text-overflow: clip;", ".vrm-pil.is-resultat .vrm-pil-sous { white-space: nowrap; text-overflow: ellipsis;"],
  'geste-sans-sous': ['src/gesteAnnulable.js', "titre: g.titre || '', sous: g.sous || '',", ""],
  'app-feuille-bulle': ['src/App.jsx', "    const ok = confirmerLiaison(a, cible._saleTx ?", "    const ok = false && confirmerLiaison(a, cible._saleTx ?"],
  'benefice-sans-frais': ['src/relierGlisser.js', "  const r = typeof ligne === 'function' ? ligne(prix, entree || {}) : null;", "  const r = typeof ligne === 'function' ? ligne(prix, { buyPrice: (entree || {}).buyPrice, fraisComplets: true }) : null;"],
  'ligne-sans-benef': ['src/App.jsx', "benefSu: lb.benefice!=null && st!=='cancelled' ? texteBenefice(lb) : '',", "benefSu: '',"],
  'toucher-cible-rien': ['src/RelierGlisser.jsx', "if (choisi) relierIci(c); else setCibleChoisie(", "if (false) relierIci(c); else setCibleChoisie("],
  'toucher-sans-bandeau': ['src/RelierGlisser.jsx', "      {mode ? (\n        <div className=\"vrm-rg-choisi\"", "      {false ? (\n        <div className=\"vrm-rg-choisi\""],
  'menu-sans-relier': ['src/App.jsx', "onClick={()=>{ close(); ouvrirGlisser({ achat: String(o.transaction_id) }); }}", "onClick={()=>{ close(); }}"],
  'pilule-sans-action': ['src/PiluleAnnuler.jsx', "{v && v.action ? <button", "{false && v.action ? <button"],
  'ecran-defile-pendant': ['src/RelierGlisser.jsx', "if (appui.current && appui.current.phase === 'leve' && e.cancelable) e.preventDefault();", 'void e;'],
  'tri-ancien-dabord': ['src/relierGlisser.js', "|| (q.d || 0) - (p.d || 0) ||", "|| (p.d || 0) - (q.d || 0) ||"],
  'recus-tous': ['src/relierGlisser.js', "return liste.filter((x) => { try { return recuDe(x && x.a ? x.a : x) === true; } catch (_) { return false; } });", "return liste.filter((x) => { try { return recuDe(x && x.a ? x.a : x) !== false; } catch (_) { return true; } });"],
  'facette-contient': ['src/relierGlisser.js', "return normFacette(k, v) === normFacette(k, choix[k]); }));", "return normFacette(k, v).includes(normFacette(k, choix[k])); }));"],
  'ventes-bornees': ['src/App.jsx', "glisserOuvert ? vendusSansAchat(-Infinity)", "glisserOuvert ? vendusSansAchat(Date.now() - 365 * 86400e3)"],
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
  // (19 nov., Julien) « Très probable » seulement pour la vente / l'annonce CHOISIE ; filtres « Déjà reliés » et « En ligne · Vendues ».
  const TP = { 4: [{ key: 'a:10', niveau: 'tres-probable' }], 5: [{ key: 'a:99', niveau: 'tres-probable' }], 1: [{ key: 'v:77', niveau: 'possible' }] };
  const M0 = typeof G.marquerPour === 'function' ? G.marquerPour(L.achats, TP, '') : null;
  dit(Array.isArray(M0) && M0.length === (L.achats || []).length && M0.every((x) => !x.pour), 'L7 rien de choisi ⇒ AUCUN achat marqué « très probable »', JSON.stringify(M0 && M0.filter((x) => x.pour).map((x) => x.tx)));
  const M1 = typeof G.marquerPour === 'function' ? G.marquerPour(L.achats, TP, 'a:10') : null;
  dit(Array.isArray(M1) && M1[0] && M1[0].tx === '4' && M1[0].pour && M1.filter((x) => x.pour).length === 1, 'L8 l’annonce a:10 choisie ⇒ SON achat très probable marqué, en tête, et lui seul', JSON.stringify(M1 && M1.map((x) => [x.tx, x.pour])));
  const M2 = typeof G.marquerPour === 'function' ? G.marquerPour(L.achats, TP, 'v:77') : null;
  dit(Array.isArray(M2) && M2.every((x) => !x.pour), 'L9 la vente v:77 choisie ⇒ ni l’achat d’une AUTRE cible ni un simple « possible » n’est marqué', JSON.stringify(M2 && M2.filter((x) => x.pour).map((x) => x.tx)));
  const RL = typeof G.achatsRelies === 'function' ? G.achatsRelies({ achats: A, liens: new Map([['2', 1]]) }) : null;
  dit(Array.isArray(RL) && RL.length === 1 && RL[0].tx === '2' && RL[0].relie === true, 'L10 « Déjà reliés » : l’achat relié, lui seul (ni libre, ni remboursé, ni en retour)', JSON.stringify(RL && RL.map((x) => x.tx)));
  dit(typeof G.achatsRelies === 'function' && G.achatsRelies({ achats: undefined }) === undefined && G.achatsRelies({ achats: null }) === null, 'L11 achats en cours ⇒ undefined ; pas su ⇒ null');
  const NC = typeof G.compterCibles === 'function' ? G.compterCibles(cibles) : null;
  dit(NC && NC.toutes === 2 && NC.annonce === 1 && NC.vente === 1, 'L12 les cibles comptées : toutes, en ligne, vendues', JSON.stringify(NC));
  const FC = typeof G.filtrerCibles === 'function' ? [G.filtrerCibles(cibles, 'annonce'), G.filtrerCibles(cibles, 'vente'), G.filtrerCibles(cibles, 'toutes')] : null;
  dit(FC && FC[0].length === 1 && FC[0][0].key === 'a:10' && FC[1].length === 1 && FC[1][0].key === 'v:77' && FC[2].length === 2, 'L13 le filtre « En ligne » ne garde que les annonces, « Vendues » que les ventes', JSON.stringify(FC && FC.map((l) => l.map((c) => c.key))));
  // La recherche (19 nov.) : chaque mot doit être dans la ligne.
  const LA = (L.achats || []);
  const CA = typeof G.chercherAchats === 'function' ? [G.chercherAchats(LA, 'samba 40'), G.chercherAchats(LA, 'samba 42'), G.chercherAchats(LA, ''), G.chercherAchats(LA, 'ASICS')] : null;
  dit(CA && CA[0].length === 1 && CA[0][0].tx === '4' && CA[1].length === 0 && CA[2].length === LA.length && CA[3].length === 1 && CA[3][0].tx === '5', 'L16 recherche des achats : « samba 40 » ⇒ cet achat seul ; « samba 42 » ⇒ rien (TOUS les mots) ; vide ⇒ tout ; sans la casse', JSON.stringify(CA && CA.map((l) => l.map((x) => x.tx))));
  const CC = typeof G.chercherCibles === 'function' ? [G.chercherCibles(cibles, '215'), G.chercherCibles(cibles, 'n°215'), G.chercherCibles(cibles, 'dunk noir'), G.chercherCibles(cibles, 'vendue'), G.chercherCibles(cibles, 'dunk 40'), G.chercherCibles(cibles, '')] : null;
  dit(CC && CC[0].length === 1 && CC[0][0].key === 'a:10' && CC[1].length === 1 && CC[2].length === 1 && CC[2][0].key === 'v:77' && CC[3].length === 1 && CC[3][0].key === 'v:77' && CC[4].length === 0 && CC[5].length === 2, 'L17 recherche des ventes et annonces : par N°, « n°215 », mots du titre, « vendue » ; tous les mots exigés', JSON.stringify(CC && CC.map((l) => l.map((c) => c.key))));
  { const src = fs.readFileSync(path.join(SRC, 'RelierGlisser.jsx'), 'utf8');
    dit(/\{x\.pour && !flottante \? <span className="vrm-rg-propose"/.test(src) && !/\{x\.propose && !flottante/.test(src), 'L14 (écran) la marque « Très probable » dépend de la cible CHOISIE (`pour`), plus de `propose`');
    dit(/data-glisser-filtre-achats=/.test(src) && /data-glisser-filtre-cibles=/.test(src), 'L15 (écran) les deux filtres sont rendus');
    dit(/data-glisser-cherche="achats"/.test(src) && /data-glisser-cherche="cibles"/.test(src), 'L18 (écran) une recherche par liste'); }
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
  const tA = (k, v) => ({ 'liaison.relieBenef': 'Achat relié · Bénéfice {benef}', 'liaison.relieAffiche': 'Achat relié · Bénéfice {benef} au prix affiché', 'liaison.relieTitre': 'Achat relié', 'liaison.relieSous': 'Bénéfice {benef}', 'liaison.relieSousAffiche': 'Bénéfice {benef} au prix affiché' }[k] || k).replace('{benef}', v && v.benef);
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

  // (16 nov., reprise) La pilule montre le bénéfice EN ENTIER : « Achat relié » en titre, le bénéfice sur la ligne du dessous,
  // qui passe à la ligne au lieu d'être coupé (une seule ligne coupait « Bénéfice au plus… » au téléphone ET à l'ordinateur).
  {
    const r = BL ? ap({ genre: 'annonce', prix: 70, entree: { buyPrice: '40' } }) : {};
    dit(r.titre === 'Achat relié' && /^Bénéfice .+ au prix affiché$/.test(nb(r.sous || '')), 'R10 le résultat en deux morceaux : « Achat relié » + « Bénéfice … au prix affiché »', JSON.stringify(r));
    const g = GA.creerGestes({ minuterie: () => 0, arreter: () => {} });
    g.lancer({ texte: 'x · y', titre: 'x', sous: 'y', cles: [], vue: () => {}, ecrire: async () => ({ ok: true }) });
    const v = ((g.etat ? g.etat() : g.instantane ? g.instantane() : {}) || {}).visible || {};
    dit(v.titre === 'x' && v.sous === 'y', 'R11 le geste porte titre et ligne du dessous jusqu’à la pilule', JSON.stringify(v));
    dit(/enregistre: \(v\) => \(\{ titre: v\.titre \|\| v\.texte, sous: v\.sous/.test(pil) && /faire: \(\) => ouvrirRecuRelie\(a, num\) \}, \{ titre: res\.titre, sous: res\.sous \}\)/.test(app), 'R12 la pilule affiche titre + bénéfice, et la liaison les lui passe');
    const css = (() => { try { return fs.readFileSync(path.join(SRC, 'pilule-annuler.css'), 'utf8'); } catch (_) { return ''; } })();
    const regle = (css.match(/\.vrm-pil\.is-resultat \.vrm-pil-sous \{([^}]*)\}/) || [])[1] || '';
    dit(/white-space: normal/.test(regle) && !/line-clamp|nowrap|ellipsis/.test(regle), 'R13 la ligne du bénéfice passe à la ligne, jamais coupée (ni « … », ni nombre de lignes borné)', regle);
  }
  dit(/benefSu: lb\.benefice!=null && st!=='cancelled' \? texteBenefice\(lb\) : ''/.test(app), 'R9 la LIGNE de la vente reliée montre son bénéfice, discret à côté du prix (la règle de la ligne)');

  let ecran = ''; try { ecran = sans(fs.readFileSync(path.join(SRC, 'RelierGlisser.jsx'), 'utf8')); } catch (_) {}
  // ── T · relier en TOUCHANT (17 nov., Julien : « je dois rester appuyé sur l'achat ») ──
  dit(/onClick=\{\(\) => toucherAchat\(x\)\}/.test(ecran) && /onClick=\{\(\) => toucherCible\(c\)\}/.test(ecran) && /const toucherCible = \(c\) => \{[^\n]*if \(choisi\) relierIci\(c\);/.test(ecran), 'T1 un toucher choisit l’achat, un toucher sur la vente / l’annonce pose la question (aucun appui long)');
  dit(/\{mode \? \(\s*<div className="vrm-rg-choisi" data-glisser-choisi=/.test(ecran) && /data-glisser-changer=""/.test(ecran), 'T2 le choix reste visible tout du long (bandeau fixe « Achat choisi … · Changer »)');
  dit(/const toucherAchat = \(x\) => \{[^\n]*const c = cibleChoisie \? parCle\.get\(cibleChoisie\) : null; if \(c\) \{ setConfirme/.test(ecran), 'T3 dans l’autre sens : la vente / l’annonce choisie d’abord, puis l’achat');
  // (21 nov., lot relier-code) Le menu ouvre la feuille inverse (« Relier à une vente / une annonce », LierArticleGrille), qui porte
  // elle-même « Glisser » vers ce mode Relier, l'achat déjà choisi.
  dit((/data-achat-relier=\{tid\}[^\n]*onClick=\{\(\)=>\{ close\(\); ouvrirGlisser\(\{ achat: String\(o\.transaction_id\) \}\); \}\}/.test(app))
    || (/data-achat-relier=\{tid\}[^\n]*onClick=\{\(\)=>\{ close\(\); setRelierDepuis\(\{ tx: String\(o\.transaction_id\) \}\); \}\}/.test(app)
      && /data-glisser-ouvrir="depuis"[^\n]*ouvrirGlisser\(\{ achat: tx \}\)/.test(app)), 'T4 le menu « ⋯ » d’un achat (et sa fiche) propose « Relier à une vente / annonce »');

  // ── S · le branchement ──
  dit(/const ciblesGlisser = useMemo\(\(\) => \{[\s\S]{0,700}?for \(const x of \(fileAchat \|\| \[\]\)\)[\s\S]{0,2400}?for \(const x of \((?:fileVendusTous \|\| )?fileVendus \|\| \[\]\)\)/.test(app), 'S1 les cibles : les annonces et les ventes SANS achat relié (fileAchat, fileVendus)');
  dit(/const relierGlisse = async[\s\S]{0,200}?ecritureRelierAchat\(a\)[\s\S]{0,700}?confirmerLiaison\(/.test(app) && /const confirmerLiaison = [\s\S]{0,1500}?opsRelierGlisse\([\s\S]{0,1800}?gesteVrm\(res\.texte, ops,/.test(app), 'S2 l’écriture de « Relier » (un lot demande son prix), par identité, en geste annulable 5 s');
  dit(['feuille', 'annonces', 'achats'].every((k) => app.includes(`data-glisser-ouvrir="${k}"`)), 'S3 trois entrées : la feuille « Relier », Annonces → Sans achat relié, Achats');
  dit(/addEventListener\('touchmove', bloque, \{ passive: false \}\)/.test(ecran) && /appui\.current\.phase === 'leve' && e\.cancelable\) e\.preventDefault\(\)/.test(ecran), 'S4 le doigt ne défile plus SEULEMENT une fois l’achat levé');
  dit(/data-glisser-ici=/.test(ecran) && /aria-pressed=\{choisi === x\.tx\}/.test(ecran), 'S5 l’alternative clavier / lecteur d’écran : choisir l’achat, puis « Relier ici »');
  dit(/if \(x && c\) setConfirme\(\{ a: x\.a, cible: c \}\);[^\n]*\n\s*return;\s*\/\/|if \(x && c\) setConfirme\(\{ a: x\.a, cible: c \}\);/.test(ecran) && !/onRelier\(x\.a/.test(ecran), 'S6 lâcher ne relie jamais : il POSE la question (« Oui » relie)');
  // ── F · (20 nov., Julien) le plus récent d'abord, seuls les achats reçus, plateforme · marque · taille, toutes les paires ──
  {
    const l = [{ k: 'a', d: '2026-10-01' }, { k: 'b', d: null }, { k: 'c', d: '2026-11-15' }, { k: 'd', d: 1760000000 }];
    dit((G.plusRecentDabord(l, (x) => x.d) || []).map((x) => x.k).join('') === 'cadb', 'F1 du plus récent au plus ancien (secondes ou ISO), une ligne sans date À LA FIN', JSON.stringify((G.plusRecentDabord(l, (x) => x.d) || []).map((x) => x.k)));
    const xs = [{ a: { t: 'recu' } }, { a: { t: 'route' } }, { a: { t: 'relais' } }, { a: { t: '?' } }];
    const recus = G.seulementRecus(xs, (a) => (a.t === 'recu' ? true : a.t === '?' ? null : false)) || [];
    dit(recus.length === 1 && recus[0].a.t === 'recu', 'F2 seuls les achats REÇUS : en route, au point relais et « pas su » écartés');
    const C = [{ site: 'vinted', marque: 'Nike', taille: '42' }, { site: 'leboncoin', marque: 'Nike SB', taille: '42,5' }, { site: 'vinted', marque: 'Adidas', taille: '42' }];
    const lire = { site: (c) => c.site, marque: (c) => c.marque, taille: (c) => c.taille };
    const f = G.filtrerFacettes(C, { marque: 'nike' }, lire) || [];
    dit(f.length === 1 && f[0].marque === 'Nike', 'F3 une marque choisie : exactement elle (« Nike » ne prend pas « Nike SB »)');
    dit((G.filtrerFacettes(C, { taille: '42' }, lire) || []).length === 2 && (G.filtrerFacettes(C, { site: 'leboncoin' }, lire) || []).length === 1, 'F4 taille « 42 » ne prend pas « 42,5 » ; plateforme exacte');
    const fac = G.facettesDe(C, lire);
    dit(fac.site.map((x) => x.cle).join(',') === 'vinted,leboncoin' && fac.site[0].n === 2 && JSON.stringify(G.choixValides({ marque: 'puma', site: 'vinted' }, fac)) === '{"site":"vinted"}', 'F5 les choix présents avec leur nombre ; un choix gardé qui n’existe plus tombe');
    const ecr = (() => { try { return sans(fs.readFileSync(path.join(SRC, 'RelierGlisser.jsx'), 'utf8')); } catch (_) { return ''; } })();
    dit(/seulementRecus\(l\.achats, recuDe\)/.test(ecr) && (/recuDe=\{\(a\)=>achatStage\(a, trackForBuy\(a\)\)\.step === 4\}/.test(app) || /recuDe=\{\(a\)=>chezMoiDe\(a\)\.chez\}/.test(app)), 'F6 l’écran ne garde que les achats « Arrivé » (étape de l’app ; depuis le 21 nov., « chez moi » : src/achatChezMoi.js)');
    dit(/const fileVendusTous = useMemo\(\(\) => \(glisserOuvert \? vendusSansAchat\(-Infinity\)/.test(app) && /fileAchatHorsLigne/.test(app) && /articlesSitesGlisser/.test(app), 'F7 toutes les paires : ventes sans borne, masquées / à confirmer, autres sites');
  }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
