#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LOT AV — CE QUE TU AS RÉELLEMENT REVENDU CE MODÈLE
//         node scripts/audit-revente-modele.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/reventeModele.js (avec `modeleSur` et `beneficePaire`, les vraies
// règles) sur un relevé INVENTÉ (le dépôt est public), et lit dans les écrans :
//   R. ses ventes du relevé de Ventes (`vrm_stats_ventes`, finalisées = prouvées) ;
//      le modèle par `modeleSur` (une ressemblance, jamais une identité) ; prix
//      médian, bénéfice médian par `beneficePaire` avec sa couverture (prix
//      d'achat pas saisi ⇒ hors médiane, compté), délai médian ; moins de 3
//      ventes ⇒ « pas assez » ; relevé pas lu ⇒ « pas lu », jamais 0 ; les plus
//      récentes ; une vente illisible écartée et comptée ;
//   P. aucune phrase ne conseille un prix (refusé le 11 oct.) ;
//   E. les écrans : saisie hors plateforme, « Prix d'achat à compléter », menu
//      ⋯ d'un achat Vinted ⇒ feuille ; aucun geste, aucune écriture.
// `--mutation=…` réaffaiblit une règle dans une copie de src/ : rouge exigé.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'min-1': ['export const MIN_VENTES_MODELE = 3;', 'export const MIN_VENTES_MODELE = 1;'],
  'modele-ignore': ['if (!mv || mv.cle !== m.cle) continue;', 'if (!mv) continue;'],
  'achat-zero': ['buyPrice: montantTexte(l.achat)', "buyPrice: montantTexte(l.achat) ?? '0'"],
  'frais-ignores': ['fees: montantTexte(l.frais)', 'fees: null'],
  'pas-lu-zero': ["if (!Array.isArray(releve)) return { etat: 'pasLu', modele: m };", 'if (!Array.isArray(releve)) releve = [];'],
  'illisible-zero': ['const vente = montantTexte(eur);', "const vente = montantTexte(eur) ?? '0.00';"],
  'tri-ancien': ['lignes.sort((a, b) => b.ts - a.ts', 'lignes.sort((a, b) => a.ts - b.ts'],
  'delai-negatif': ['&& l.ts >= Number(e)) jours', ') jours'],
  'conseil': ['`Revendu ${euroCourt(r.prixMedian)} en médiane, sur ${r.n} ventes`', '`Prix conseillé : ${euroCourt(r.prixMedian)}, sur ${r.n} ventes`'],
  'ecran-sans-feuille': ["setReventeVue({ titre: String(o.title||'') })", "setReventeVue(null)", 'App.jsx'],
  'ecran-saisie-tue': ['{titreForm.trim().length >= 3 && <ReventeModele', '{false && <ReventeModele', 'ecrans/Achats.jsx'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'revente-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const c = MUTS[MUT][2] || 'reventeModele.js';
  const f = path.join(d, 'src', c); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const lire = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  const M = await import(url('reventeModele.js'));
  const B = await import(url('beneficePaire.js'));
  const T0 = Date.parse('2026-11-10T12:00:00Z'), J = 86400e3;
  // Une ligne du relevé : [plateforme, compte, id, ts, vente €, achat €|null, frais €|null, titre, N°, versement]
  const L = (i, titre, eur, achat = null, frais = 0, o = {}) => [o.pl || 'Vinted', o.compte || 'shop_a', 'tx' + i, T0 - i * J, eur, achat, frais, titre, '', ''];
  const dunk = (i, eur, achat, frais) => L(i, 'Nike Dunk Low Panda taille 42', eur, achat, frais);

  console.log('\n── R. La règle');
  const cinquante = []; for (let i = 1; i <= 50; i++) cinquante.push(dunk(i, 100 + i, 50, 2));
  const gele = JSON.stringify(cinquante);
  const r50 = M.reventeDuModele({ cible: { titre: 'Nike Dunk Low noir blanc 43' }, releve: cinquante });
  dit(r50.etat === 'ok' && r50.n === 10 && r50.total === 50 && r50.modele.nom === 'Nike Dunk', 'R1 50 ventes du même modèle ⇒ les 10 dernières, « sur 10 » (50 en tout)', JSON.stringify({ e: r50.etat, n: r50.n, t: r50.total }));
  dit(r50.ventes.map((v) => v.id).join() === 'tx1,tx2,tx3,tx4,tx5,tx6,tx7,tx8,tx9,tx10', 'R2 les plus récentes d’abord');
  dit(r50.prixMedian === 105.5 && r50.benefMedian === 53.5 && r50.nBenef === 10, 'R3 prix médian 105,50 € ; bénéfice médian 53,50 € (vente − achat − frais)', JSON.stringify([r50.prixMedian, r50.benefMedian]));
  dit(JSON.stringify(cinquante) === gele && !r50.ventes.some((v) => 'numero' in v || 'lie' in v || 'buyFromId' in v), 'R4 rien n’est écrit ni relié (le relevé est intact)');
  const deux = [dunk(1, 90, 40), dunk(2, 95, 40), L(3, 'Nike Air Force 1 blanche', 80, 30), L(4, 'Adidas Samba noire', 70, 30)];
  const rp = M.reventeDuModele({ cible: { titre: 'Nike Dunk Low' }, releve: deux });
  dit(rp.etat === 'peu' && rp.n === 2 && M.phraseRevente(rp) === 'Pas assez de ventes de ce modèle (2)', 'R5 moins de 3 ventes ⇒ « Pas assez de ventes de ce modèle (2) »', JSON.stringify(rp));
  dit(M.reventeDuModele({ cible: { titre: 'Nike Dunk Low' }, releve: [...deux, dunk(5, 99, 40)] }).etat === 'ok', 'R6 trois ventes ⇒ les chiffres');
  dit(M.reventeDuModele({ cible: { titre: 'Nike Air Max 1 rouge' }, releve: [L(1, 'Nike Air Max 90', 1), L(2, 'Nike Air Max 90', 1), L(3, 'Nike Air Max 90', 1)] }).etat === 'peu', 'R7 un autre modèle (Air Max 90 ≠ Air Max 1) ne compte pas');
  const ri = M.reventeDuModele({ cible: { titre: 'Chaussures blanches 42' }, releve: cinquante });
  dit(ri.etat === 'inconnu' && M.phraseRevente(ri) === '', 'R8 modèle pas reconnu ⇒ rien n’est dit (mieux vaut rien qu’un faux)');
  const rl = M.reventeDuModele({ cible: { titre: 'Nike Dunk Low' }, releve: null });
  dit(rl.etat === 'pasLu' && rl.n == null && /pas encore lues/.test(M.phraseRevente(rl)), 'R9 relevé pas lu ⇒ « pas lu », jamais 0 vente', JSON.stringify(rl));
  const mix = [dunk(1, 100, null), dunk(2, 120, 60, 5), dunk(3, 90, 30, 0), dunk(4, null, 20), dunk(5, 'abc', 20)];
  const rm = M.reventeDuModele({ cible: { titre: 'Dunk Low Nike' }, releve: mix });
  const b2 = B.beneficePaire('120.00', { buyPrice: '60.00', fees: '5.00' }).benefice, b3 = B.beneficePaire('90.00', { buyPrice: '30.00', fees: '0.00' }).benefice;
  dit(rm.etat === 'ok' && rm.n === 3 && rm.ecartees === 2, 'R10 deux ventes au montant illisible : écartées et comptées, jamais à 0 €', JSON.stringify({ n: rm.n, e: rm.ecartees }));
  dit(rm.nBenef === 2 && rm.benefMedian === (b2 + b3) / 2 && rm.ventes[0].benefice === null, 'R11 prix d’achat pas saisi ⇒ hors de la médiane du bénéfice, « sur 2 des 3 » (règle `beneficePaire`)', JSON.stringify([rm.nBenef, rm.benefMedian]));
  const rsans = M.reventeDuModele({ cible: { titre: 'Nike Dunk' }, releve: [dunk(1, 100, null), dunk(2, 100, null), dunk(3, 100, '')] });
  dit(rsans.benefMedian === null && rsans.nBenef === 0, 'R12 aucun prix d’achat saisi ⇒ bénéfice « — », jamais 0');
  const enLigne = (r) => ({ tx1: T0 - 1 * J - 4 * J, tx2: T0 - 2 * J - 10 * J, tx3: T0 + 5 * J }[r[2]] ?? null);
  const rd = M.reventeDuModele({ cible: { titre: 'Nike Dunk' }, releve: [dunk(1, 100, 50), dunk(2, 100, 50), dunk(3, 100, 50)], enLigneDe: enLigne });
  dit(rd.delaiMedian === 7 && rd.nDelai === 2 && rd.delaiLu, 'R13 délai médian de la mise en ligne à la vente (7 j sur 2) ; une mise en ligne après la vente ignorée', JSON.stringify([rd.delaiMedian, rd.nDelai]));
  const ru = M.reventeDuModele({ cible: { titre: 'Nike Dunk' }, releve: cinquante, enLigneDe: () => undefined });
  dit(ru.delaiMedian === null && ru.delaiLu === false, 'R14 mises en ligne pas encore lues ⇒ délai « en cours », jamais 0');
  dit(M.reventeDuModele({ cible: { titre: '550 blanche', marque: 'New Balance' }, releve: [L(1, '550 blanche', 90), L(2, 'New Balance 550', 90), L(3, '550 grise', 90)] }).etat === 'peu' && M.reventeDuModele({ cible: { titre: 'New Balance 550' }, releve: cinquante }).etat === 'inconnu', 'R15 un « 550 » sans marque n’est pas une New Balance (règle `modeleSur`)');
  const RV = sansCommentaires(lire('reventeModele.js'));
  dit(/from '\.\/ceQuiRapporte\.js'/.test(RV) && /modeleSur\(/.test(RV) && /beneficePaire\(/.test(RV) && !/const modeleSur|function beneficePaire/.test(RV), 'R16 une seule règle : `modeleSur` et `beneficePaire` importés, pas recopiés');
  dit(!/localStorage|fetch\(|save\(|load\(/.test(RV), 'R17 le module ne lit ni n’écrit rien');

  console.log('\n── P. Le passé, jamais un conseil');
  const phrases = [r50, rp, rl, rm, rsans].map((x) => M.phraseRevente(x)).join(' | ');
  const RJ = sansCommentaires(lire('ReventeModele.jsx'));
  const textesJSX = (RJ.match(/>[^<>{}]+</g) || []).join(' ') + ' ' + (RJ.match(/'[^']*'|`[^`]*`/g) || []).join(' ');
  dit(!/prix conseill|conseill[eé]|vends?[- ]l|mets?[- ]l|devrais|recommand/i.test(phrases) && !/prix conseill|conseill[eé]|devrais|recommand/i.test(textesJSX), 'P1 aucune phrase ne dit à quel prix vendre (prix conseillé refusé le 11 oct.)', phrases);
  dit(phrases.split(' | ').every((p) => p.split(/\s+/).filter(Boolean).length <= 12), 'P2 phrases de 12 mots au plus');

  console.log('\n── E. Les écrans');
  dit(!/onClick|fetch\(|save\(|<button|Bouton/.test(RJ) && /<details/.test(RJ), 'E1 aucune action ni écriture : toucher déplie, c’est tout');
  dit(!/C\.warn|C\.red|C\.danger|#D70015|#FF3B30/.test(RJ), 'E2 aucune couleur d’alerte (une information)');
  const AC = sansCommentaires(fs.readFileSync(path.join(SRC, 'ecrans', 'Achats.jsx'), 'utf8'));
  dit(/\{(?:!enLot && )?titreForm\.trim\(\)\.length >= 3 && <ReventeModele C=\{C\} cible=\{\{ titre: titreForm \}\} lireReleve=\{lireReleveVentes\}/.test(AC), 'E3 saisie d’un achat hors plateforme : à côté de « Tu as déjà N paires »');
  const A = sansCommentaires(fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8'));
  dit(/<ReventeModele C=\{C\} cible=\{\{ titre: r\.titre\|\|'', marque: r\.marque\|\|'' \}\} lireReleve=\{lireReleveVentes\}/.test(A), 'E4 « Prix d’achat à compléter » : sous « déjà N »');
  dit(/data-achat-revente=\{tid\}[^\n]*setReventeVue\(\{ titre: String\(o\.title\|\|''\) \}\)/.test(A) && /\{reventeVue && <SheetShell[^\n]*/.test(A) && /<ReventeModele ouvert C=\{C\} cible=\{\{ titre: reventeVue\.titre \}\}/.test(A), 'E5 fiche d’un achat Vinted : ⋯ « Revendu combien ? » ⇒ la feuille, dépliée');
  dit(/const lireReleveVentes = \(\) => \{ try \{ const v = load\('vrm_stats_ventes', null\)/.test(A) && /estFinalisee: \(o\) => classifyOrderStatus\(o\.status\) === 'completed'/.test(A), 'E6 la source : le relevé `vrm_stats_ventes`, ventes FINALISÉES (prouvées)');

  console.log(`\n${ko ? '❌' : '✅'} audit-revente-modele : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
