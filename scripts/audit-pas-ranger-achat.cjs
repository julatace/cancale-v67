#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — ON RANGE UN ARTICLE, PAS UN ACHAT (15 nov. 2026)
//  Julien, sur la capture du centre de notifications : « Enlève ça, on range une
//  ANNONCE, pas un achat » — chaque achat arrivé y portait « Première case libre :
//  Meuble · rangée 1, colonne 1 · [Ranger] Déjà rangé », la MÊME case pour tous.
//  Récit : docs/passation/2026-11-15-pas-ranger-achat.md.
//
//  EXÉCUTE la vraie règle (src/ouRanger.js), sur des données INVENTÉES (dépôt public) :
//    R · une case par ARTICLE   `casesProposees` : deux articles à ranger ne reçoivent JAMAIS la même
//                               case ; jamais une case prise ; meuble empilé respecté ; « pas su » ⇒ rien
//    N · aucun achat             plus aucune fonction ne fabrique une notification « à ranger » par achat
//  et LIT le code (commentaires retirés) :
//    A · App.jsx                 « J'ai retiré » (colis, commande, en série, au comptoir) n'ouvre ni ne
//                                propose rien ; Ma journée n'a plus « N achats à ranger » ; la cloche ne
//                                calcule plus rien sur les achats ; le rattrapage du pool reste monté
//    C · src/CentreNotifs.jsx    plus de bloc « À ranger », la pastille ne compte que le journal
//    S · src/ecrans/Stock.jsx    « Ranger » d'un article vise SA case proposée (`caseProposeeDe`)
//
//  `--prouve` (§6.1) : (1) les mêmes contrôles sur l'arbre de départ (`--avant <ref>`, défaut
//  origin/claude/project-review-nsk5su) : rouges ; (2) des MUTATIONS, une à la fois, sur une copie : chacune rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const { sourceAppCode } = require('./_source-app.cjs');
const RACINE = path.join(__dirname, '..');

const sansCommentaires = (t) => String(t || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const lire = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } };
// Le corps d'une déclaration (`const nom = …` ou `function nom(`) jusqu'à la fin de sa ligne / son bloc.
const corpsFn = (src, debut) => { const i = src.indexOf(debut); if (i < 0) return null; const j = src.indexOf('\n}\n', i); return j > i ? src.slice(i, j) : null; };
const corpsDe = (src, debut) => { const i = src.indexOf(debut); if (i < 0) return null; const j = src.indexOf('\n  };', i); const k = src.indexOf('\n', i); const fin = src.slice(i, k).trim().endsWith('{') && j > i ? j : k; return src.slice(i, fin); };

async function controles(racine, silencieux) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, msg, d) => { if (c) ok++; else { ko++; rouges.push(msg); } if (!silencieux) console.log((c ? '✅ ' : '❌ ') + msg + (!c && d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 260) : '')); };
  const essai = (msg, f) => { try { const r = f(); dit(r === true, msg, r === true ? undefined : r); } catch (e) { dit(false, msg, e && e.message); } };

  let R = {}; try { R = await import(pathToFileURL(path.join(racine, 'src', 'ouRanger.js')).href + '?t=' + Date.now() + Math.random()); } catch (e) { R = { __erreur: String(e && e.message || e).slice(0, 160) }; }
  const cle = (m, i) => m + ':' + i;
  const cas = (r) => Object.values(r || {}).filter(Boolean).map((c) => cle(c.meubleId, c.i));

  // ── R : une case par article ──
  essai('R1 · `casesProposees` existe (src/ouRanger.js)', () => typeof R.casesProposees === 'function' || (R.__erreur || 'absente'));
  const P = typeof R.casesProposees === 'function' ? R.casesProposees : () => { throw new Error('casesProposees absente'); };
  const A = [{ id: 'mA', name: 'Meuble', cols: 3, rows: 2 }];
  essai('R2 · deux articles à ranger ⇒ deux cases DIFFÉRENTES ; le premier a la première libre', () => {
    const slots = { B900: { m: 'mA', i: 0 } };
    const r = P({ meubles: A, slots, cles: ['12', '13'] });
    const p = R.premiereCaseLibre({ meubles: A, slots });
    return (r && r['12'] && r['13'] && cle(r['12'].meubleId, r['12'].i) !== cle(r['13'].meubleId, r['13'].i) && r['12'].i === p.i) || r; });
  essai('R3 · 50 articles, 30 cases libres sur 3 meubles : 30 cases toutes différentes, aucune prise, les 20 autres sans case (dit, jamais inventé)', () => {
    const ms = [{ id: 'a', name: 'A', cols: 4, rows: 3 }, { id: 'b', name: 'B', cols: 5, rows: 2 }, { id: 'c', name: 'C', cols: 3, rows: 4 }];   // 12 + 10 + 12 = 34 cases
    const slots = { B1: { m: 'a', i: 0 }, B2: { m: 'b', i: 3 }, 7: { m: 'c', i: 5 }, 8: { m: 'c', i: 11 } };                                  // 4 prises ⇒ 30 libres
    const cles = Array.from({ length: 50 }, (_, k) => String(100 + k));
    const r = P({ meubles: ms, slots, cles });
    const l = cas(r); const prises = new Set(Object.values(slots).map((s) => cle(s.m, s.i)));
    const nuls = cles.filter((k) => r[k] === null).length;
    return (l.length === 30 && new Set(l).size === 30 && !l.some((x) => prises.has(x)) && nuls === 20) || { n: l.length, uniques: new Set(l).size, nuls }; });
  essai('R4 · meuble empilé : le fond d’abord, puis la case juste au-dessus (jamais une case dans le vide), jamais deux fois la même', () => {
    const r = P({ meubles: [{ id: 'p', name: 'Pile', cols: 1, rows: 3, gravite: true }], slots: {}, cles: ['1', '2', '3', '4'] });
    return (r && r['1'] && r['1'].i === 2 && r['2'] && r['2'].i === 1 && r['3'] && r['3'].i === 0 && r['4'] === null) || r; });
  essai('R5 · « pas su » (meubles ou cases pas lus) ⇒ rien proposé (null, pas « libre »)', () =>
    P({ meubles: null, slots: {}, cles: ['1'] }) === null && P({ meubles: A, slots: null, cles: ['1'] }) === null && P({ meubles: A, slots: {}, cles: null }) === null);
  essai('R6 · un article = une case : une clé en double ou vide ne prend pas une seconde case', () => {
    const r = P({ meubles: A, slots: {}, cles: ['5', '5', '', '6'] });
    return (Object.keys(r).sort().join() === '5,6' && new Set(cas(r)).size === 2) || r; });
  essai('R7 · aucun meuble ⇒ aucune case (jamais une case qui n’existe pas)', () => { const r = P({ meubles: [], slots: {}, cles: ['1'] }); return (r && r['1'] === null) || r; });

  // ── N : plus rien n'est fabriqué pour un achat ──
  essai('N1 · src/ouRanger.js ne fabrique plus de notification par achat (`achatsArrives`, `notifsOuRanger` retirées)', () =>
    (!R.__erreur && typeof R.achatsArrives !== 'function' && typeof R.notifsOuRanger !== 'function') || Object.keys(R).join());

  // ── A : App.jsx ──
  let APP = ''; try { APP = sansCommentaires(sourceAppCode(racine)); } catch (_) { APP = ''; }
  dit(APP.length > 100000, 'A0 · App.jsx (et ses écrans découpés) lu');
  // (15 nov., intégration avec claude/atelier-arrivee) Julien : « on range une ANNONCE, pas un achat ». L'atelier
  // d'arrivée peut s'ouvrir après « J'ai retiré », mais sur le N° de l'ARTICLE seulement : aucune case n'est calculée
  // pour un achat (`preparerNumero`), la feuille « Ranger cet achat » n'est plus montée ni importée, et la case vient
  // APRÈS, sur la fiche numérotée (src/atelierArrivee.js `caseProposee` ⇒ `casesProposees`).
  const ppr = ['proposerRangement(', 'ouvrirRangement(', 'apresRetrait(', "'vrm:ranger-achat'", '<RangerAchatCoque', "from './RangerAchat.jsx'", 'entreeRangementColis(', 'preparerRangement('].filter((x) => APP.includes(x));
  const prepN = corpsFn(APP, 'async function preparerNumero(');
  dit(!ppr.length && prepN != null && !/casesEnSerie\(|caseHabitude\(|premiereCase/.test(prepN), 'A1 · aucun chemin ne range un ACHAT : ni feuille « Ranger cet achat », ni case calculée pour un achat (le N° seulement)', ppr.join(', ') || prepN);
  const AT = sansCommentaires(lire(path.join(racine, 'src', 'atelierArrivee.js')));
  dit(/export function caseProposee\([\s\S]{0,700}casesProposees\(\{ meubles, slots: prises, cles: \[c\] \}\)/.test(AT), 'A1c · la case de l’atelier est celle du Stock (`casesProposees`), pour CET article (son N°)');
  const gestes = ['const markCollected = ', 'const markAllCollected = ', 'const markPickupDone = ', 'const markPickupDoneSerie = '].map((d) => [d, corpsDe(APP, d)]);
  const fautifs = gestes.filter(([, c]) => c == null || /rang|case/i.test(c)).map(([d, c]) => d + (c == null ? '(absent)' : ''));
  dit(!fautifs.length, 'A2 · « J’ai retiré » (colis, commande, en série) retire, et au plus note l’achat pour son N° : rien sur le rangement ni la case', fautifs.join(', '));
  dit(!/id:\s*'achats-a-ranger'/.test(APP) && !/ranger\.carte\.court/.test(APP), 'A3 · Ma journée n’a plus de ligne « N achats à ranger »');
  const coque = (() => { const i = APP.indexOf('function CentreNotifsCoque('); const j = APP.indexOf('\n}\n', i); return i >= 0 ? APP.slice(i, j) : ''; })();
  dit(coque && !/aRanger|enPlus|calculerOuRanger|notifsOuRanger|vrm_ranger_proposes|vrm_ranger_vus|achatsArrives/.test(coque) && !/function calculerOuRanger|achatsArrives\(|notifsOuRanger\(/.test(APP),
    'A4 · la cloche ne calcule plus rien sur les achats (aucune case proposée à un achat, aucune lecture des propositions gardées)');
  dit(/<RattrapageNumerosRanges\/>/.test(APP) && /function RattrapageNumerosRanges\(\)[\s\S]{0,200}reserverNumerosRanges/.test(APP), 'A5 · le rattrapage du pool (N° des fiches déjà rangées, append-only) reste monté');

  // ── C : la cloche ──
  const CN = sansCommentaires(lire(path.join(racine, 'src', 'CentreNotifs.jsx')));
  dit(CN.length > 1000 && !/data-centre-ranger/.test(CN) && !/aRanger|onRanger|onRangeFait/.test(CN), 'C1 · le centre de notifications n’a plus de bloc « À ranger » (ni « Ranger », ni « Déjà rangé »)');
  const bouton = (/export function BoutonCentreNotifs\(\{([^}]*)\}\)/.exec(CN) || [])[1];
  dit(bouton != null && !/enPlus/.test(bouton), 'C2 · la pastille de la cloche ne compte que le journal (plus de notifications locales ajoutées)', bouton);

  // ── S : le Stock ──
  const ST = sansCommentaires(lire(path.join(racine, 'src', 'ecrans', 'Stock.jsx')));
  dit(/casesProposees\(\{\s*meubles,\s*slots,\s*cles:/.test(ST) && /const libre = caseProposeeDe\(k\);/.test(ST) && !/premiereCaseMeubles\(/.test(ST),
    'S1 · « Ranger au stock » d’un article vise SA case proposée (une par article, `casesProposees`), plus la première case libre commune');
  dit(/data-fiche-case-proposee=\{c\.meubleId \+ ':' \+ c\.i\}/.test(ST) && /data-fiche-ranger-ici=/.test(ST) && /poser\(modal\.cle, c\.meubleId, c\.i\)/.test(ST),
    'S2 · la fiche d’un article sans case dit SA case proposée et la pose sur SON toucher (« Ranger ici »)');
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ['une case proposée ne compte pas comme prise (la même case à deux articles)', 'src/ouRanger.js', "    prises.add(pose.meubleId + ':' + pose.i);\n", ''],
  ['meuble empilé ignoré (une case dans le vide)', 'src/ouRanger.js', "      if (!fond && !prise((r + 1) * cols + c)) continue;\n", ''],
  ['« J’ai retiré » rouvre « Ranger cet achat »', 'src/App.jsx', 'try { apresRetraitAtelier(entreeArriveeColis(t)); } catch (_) {} return id; };', 'try { apresRetraitAtelier(entreeArriveeColis(t)); ouvrirRangement([entreeArriveeColis(t)]); } catch (_) {} return id; };'],
  ['le N° d’un achat arrivé lui calcule une case', 'src/App.jsx', "  return { ok: true, numeros, numeroEcrit: ecrit, pris: pris.cles, archive: archiveNumeros(), cleNum, cases: [],", "  const cs = casesEnSerie({ meubles: [], slots: {}, n }); return { ok: true, numeros, numeroEcrit: ecrit, pris: pris.cles, archive: archiveNumeros(), cleNum, cases: cs.cases || [],"],
  ['l’atelier reprend sa propre case (commune) au lieu de celle du Stock', 'src/atelierArrivee.js', "  const r = casesProposees({ meubles, slots: prises, cles: [c] });", "  const r = { [c]: null };"],
  ['Ma journée retrouve « N achats à ranger »', 'src/App.jsx', "jobs.push({ id: 'achats-a-numeroter',", "jobs.push({ id: 'achats-a-ranger',"],
  ['la pastille recompte les notifications locales', 'src/CentreNotifs.jsx', "export function BoutonCentreNotifs({ nonLues, onOuvrir, Icon, alerte", "export function BoutonCentreNotifs({ nonLues, onOuvrir, Icon, enPlus = 0, alerte"],
  ['le Stock reprend la première case libre commune', 'src/ecrans/Stock.jsx', '      const libre = caseProposeeDe(k);', '      const libre = premiereCaseMeubles({ meubles, slots });'],
];

const copieArbre = (src) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-ranger-'));
  fs.cpSync(path.join(src, 'src'), path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), '{"type":"module"}');
  return d;
};
const nettoyer = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} };

(async () => {
  const prouve = process.argv.includes('--prouve');
  console.log('— On range un article, pas un achat, sur ' + RACINE);
  const r = await controles(RACINE, false);
  console.log(`\n${r.ko ? '❌' : '✅'} audit-pas-ranger-achat : ${r.ok} vert(s), ${r.ko} rouge(s)`);
  if (!prouve) process.exit(r.ko ? 1 : 0);
  const ia = process.argv.indexOf('--avant'); const avant = ia > 0 ? process.argv[ia + 1] : 'origin/claude/project-review-nsk5su';
  const dAv = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-ranger-avant-'));
  cp.execSync(`git -C ${JSON.stringify(RACINE)} archive ${avant} src | tar -x -C ${JSON.stringify(dAv)}`);
  fs.writeFileSync(path.join(dAv, 'package.json'), '{"type":"module"}');
  const rav = await controles(dAv, true);
  nettoyer(dAv);
  console.log(`\n— Sur ${avant} : ${rav.ko} rouge(s) sur ${rav.ok + rav.ko} (attendu : des rouges) ${rav.ko ? '✅' : '❌'}`);
  for (const x of rav.rouges) console.log('   · ' + x);
  let tuees = 0;
  for (const [nom, fichier, de, vers] of MUTATIONS) {
    const d = copieArbre(RACINE); const p = path.join(d, fichier); const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(de)) { console.log(`❌ mutation introuvable : ${nom}`); nettoyer(d); continue; }
    fs.writeFileSync(p, t.replace(de, vers));
    const rm = await controles(d, true);
    nettoyer(d);
    if (rm.ko) tuees++;
    console.log(`${rm.ko ? '✅' : '❌'} mutation « ${nom} » : ${rm.ko} rouge(s)${rm.ko ? ' — ' + rm.rouges[0] : ''}`);
  }
  console.log(`\n${tuees === MUTATIONS.length && rav.ko ? '✅' : '❌'} preuve : ${tuees}/${MUTATIONS.length} mutations attrapées, ${rav.ko} rouge(s) sur le code d'avant`);
  process.exit(tuees === MUTATIONS.length && rav.ko && !r.ko ? 0 : 1);
})();
