#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : lot 36-27 (13 nov.) — PRÉVISION DU MOIS EN DÉBUT DE MOIS (point 36)
//         ET « TES COMPTES VINTED » (point 27).
//         node scripts/audit-comptes-vinted.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/previsionMois.js et src/comptesVinted.js sur des données INVENTÉES
// (dépôt public) et lit le branchement des écrans :
//   L. moins de 5 jours lus ce mois-ci : le rythme LISSÉ des 28 derniers jours,
//      dit « rythme des 4 dernières semaines », le bas jamais sous le déjà-vendu ;
//      moins de 14 jours d'historique ⇒ « pas encore su » ; à partir de 5 jours, la
//      règle d'avant inchangée ; pas lu ⇒ « — » ; un manque reste nommé ; la ligne
//      de Ma journée dit « estimation ».
//   T. le tableau : un compte sélectionné = une ligne, par son uid ; ventes et prix
//      moyen = le VENDU de la période (prix dès 3 ventes) ; jours pour vendre = la
//      MÉDIANE du relevé daté ; offres acceptées = acceptées ÷ reçues, « — » si les
//      conversations ne couvrent pas la période ; compte pas lu ⇒ « — », jamais 0 ;
//      un compte exclu n'apparaît pas ; 30 j / 90 j / année.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'lisse-absent': ['const L = lisse(', 'const L = null && lisse(', 'previsionMois.js'],
  'lisse-histoire': ['if (pleins < PREVISION_LISSE_MIN) return null;', 'if (false) return null;', 'previsionMois.js'],
  'lisse-plancher': ['bas: Math.max(rond(cumul, -1), rond(centreBrut - PREVISION_Z * sd)), haut: Math.max(centre,', 'bas: rond(centreBrut - PREVISION_Z * sd) - 200000, haut: Math.max(centre,', 'previsionMois.js'],
  'lisse-muet': ["P.mode === 'lisse' ? 'rythme des 4 dernières semaines' :", "false ? '' :", 'previsionMois.js'],
  'journee-sans-estimation': ['data-prev-estimation=""', 'data-x=""', 'ArgentPlus.jsx'],
  'prix-un': ['const prix = n >= MIN_DONNEES ?', 'const prix = n >= 1 ?', 'comptesVinted.js'],
  'paslu-zero': ['if (pasLus.has(g.nom) || pasLus.has(g.uid)) return', 'if (false) return', 'comptesVinted.js'],
  'offres-partiel': ['else if (o.partielOffres)', 'else if (false)', 'comptesVinted.js'],
  'delai-moyenne': ['else delai = D.mediane;', 'else delai = D.moyenne;', 'comptesVinted.js'],
  'periode-30': ['de: minuitLocal(maintenant, -(n - 1)), a };', 'de: minuitLocal(maintenant, -(n + 60)), a };', 'comptesVinted.js'],
  'uid-par-nom': ["const u = String(l.uid || ''); if (!u) continue;", "const u = String(l.compte || ''); if (!u) continue;", 'comptesVinted.js'],
  'ecran-absent': ['<ComptesVinted refCarte', '<div data-retire refCarte', 'ecrans/Stats.jsx'],
  'ecran-exclu': ["if (u && !ecarteStats(u)) out.set(u, { uid: u, nom: x.login || u });", "if (u) out.set(u, { uid: u, nom: x.login || u });", 'ecrans/Stats.jsx'],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'comptes-vinted-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const f = path.join(d, 'src', MUTS[MUT][2]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let P, T;
  try { P = await import(url('previsionMois.js')); } catch (e) { dit(false, 'src/previsionMois.js se charge', e.message); }
  try { T = await import(url('comptesVinted.js')); } catch (e) { dit(false, 'src/comptesVinted.js existe et se charge', e.message); }
  if (!P || !T) { console.log(`\n❌ audit-comptes-vinted : ${ok} verts, ${ko} rouge(s)`); process.exit(1); }
  const t = (m, j, h = 14) => new Date(2026, m, 1 + j, h).getTime();   // m : 9 = octobre, 10 = novembre

  console.log('\n── L. La prévision en début de mois (rythme lissé)');
  const oct = []; for (let j = 0; j < 31; j++) oct.push({ plateforme: 'Vinted', ts: t(9, j), eur: 100 });
  const debutNov = [...oct, { plateforme: 'Vinted', ts: t(10, 0), eur: 100 }, { plateforme: 'Vinted', ts: t(10, 1), eur: 100 }];
  const now3 = t(10, 2, 12);   // le 3 novembre à midi : 2 jours pleins lus
  const p1 = P.previsionMois({ vendu: debutNov, maintenant: now3 });
  const T1 = P.textePrevision(p1);
  dit(p1.etat === 'ok' && p1.mode === 'lisse' && p1.cumul === 20000, 'L1 3 novembre : une prévision (rythme lissé), 200 € déjà vendus', JSON.stringify({ e: p1.etat, m: p1.mode, c: p1.cumul }));
  dit(p1.centre >= 280000 && p1.centre <= 300000, 'L2 environ 100 €/jour sur 4 semaines ⇒ vers 2 800–3 000 € fin novembre', String(p1.centre));
  dit(p1.bas >= p1.cumul && p1.bas <= p1.centre && p1.haut >= p1.centre, 'L3 la fourchette encadre le centre, jamais sous le déjà-vendu', JSON.stringify({ b: p1.bas, h: p1.haut }));
  dit(/rythme des 4 dernières semaines/.test(T1.sous) && /^À ce rythme, novembre finira vers /.test(T1.ligne || ''), 'L4 la source du rythme est dite : « rythme des 4 dernières semaines »', JSON.stringify(T1));
  // Irrégulier : une grosse vente le 1er, presque rien avant ⇒ fourchette large, plancher = le déjà-vendu.
  const irr = [{ plateforme: 'Vinted', ts: t(8, 3), eur: 20 }, { plateforme: 'Vinted', ts: t(9, 10), eur: 50 }, { plateforme: 'Vinted', ts: t(9, 20), eur: 50 }, { plateforme: 'Vinted', ts: t(10, 0), eur: 1000 }];
  const pi = P.previsionMois({ vendu: irr, maintenant: now3 });
  dit(pi.mode === 'lisse' && pi.bas === 100000 && pi.haut > pi.centre, 'L3b jours irréguliers : fourchette large, le bas s’arrête au déjà-vendu (1 000 €)', JSON.stringify({ b: pi.bas, c: pi.centre, h: pi.haut }));
  const court = [{ plateforme: 'Vinted', ts: t(9, 25), eur: 100 }, { plateforme: 'Vinted', ts: t(10, 0), eur: 100 }];
  const p2 = P.previsionMois({ vendu: court, maintenant: now3 });
  dit(p2.etat === 'tot' && p2.centre == null && P.textePrevision(p2).grand === '—', 'L5 moins de 14 jours d’historique : « pas encore su », aucun chiffre', JSON.stringify({ e: p2.etat, c: p2.centre }));
  const vieux = [{ plateforme: 'Vinted', ts: t(7, 3), eur: 100 }];
  const p3 = P.previsionMois({ vendu: vieux, maintenant: now3 });
  dit(p3.etat === 'tot' && p3.centre == null, 'L6 rien vendu depuis 4 semaines : aucun rythme inventé', JSON.stringify({ e: p3.etat }));
  const nov18 = []; for (let j = 0; j < 18; j++) nov18.push({ plateforme: 'Vinted', ts: t(10, j), eur: 100 });
  const p4 = P.previsionMois({ vendu: [...oct, ...nov18], maintenant: t(10, 18, 0) + 1 });
  dit(p4.etat === 'ok' && !p4.mode && p4.centre === 300000 && /sur 18 jours lus/.test(P.textePrevision(p4).sous), 'L7 à partir de 5 jours : la règle d’avant, inchangée (sur 18 jours lus)', JSON.stringify({ m: p4.mode, c: p4.centre }));
  const pn = P.previsionMois({ vendu: null, maintenant: now3 }), pu = P.previsionMois({ vendu: undefined, maintenant: now3 });
  dit(pn.etat === 'passu' && pn.centre == null && pu.etat === 'encours', 'L8 ventes pas lues ⇒ « — » ; lecture en cours ⇒ « — »');
  const pm = P.previsionMois({ vendu: debutNov, manque: ['Leboncoin'], maintenant: now3 });
  dit(pm.mode === 'lisse' && pm.partiel && /Leboncoin pas lu/.test(P.textePrevision(pm).manque), 'L9 un site pas lu : la prévision lissée le NOMME', P.textePrevision(pm).manque);
  const rel = []; for (let i = 0; i < 10; i++) rel.push(['Vinted', 'a', String(i), t(9, 10 + i), 100, i < 9 ? 60 : null, 0, 'x']);
  const pb = P.previsionMois({ vendu: debutNov, releve: rel, maintenant: now3 });
  dit(pb.benef && pb.benef.etat === 'ok' && pb.benef.nConnu === 9, 'L10 bénéfice brut prévu sur la même fenêtre de 4 semaines (9 prix sur 10)', JSON.stringify(pb.benef));
  const ap = sansCommentaires(lire('ArgentPlus.jsx'));
  dit(/function PrevisionLigne[\s\S]*data-prev-estimation=""[\s\S]*?estimation/.test(ap), 'L11 la ligne de Ma journée dit « estimation »');
  dit(!/objectif|c’est sûr|garanti/i.test(ap + JSON.stringify(T1)), 'L12 jamais présenté comme un objectif ni comme sûr');

  console.log('\n── T. Tes comptes Vinted');
  const now = t(10, 12, 15);   // 13 novembre, 15 h
  const B30 = T.bornesComptes('j30', now), B90 = T.bornesComptes('j90', now), BA = T.bornesComptes('annee', now);
  dit(B30.de === new Date(2026, 9, 15).getTime() && B30.a === new Date(2026, 10, 14).getTime(), 'T1 30 j = du 15 oct. au 13 nov. inclus (minuits locaux)', `${new Date(B30.de)} → ${new Date(B30.a)}`);
  dit(B90.de === new Date(2026, 7, 16).getTime() && BA.de === new Date(2026, 0, 1).getTime(), 'T2 90 j et l’année (depuis le 1er janvier)');
  const L = (uid, compte, j, eur, m = 10) => ({ plateforme: 'Vinted', ts: t(m, j), eur, compte, uid, tx: `${uid}-${m}-${j}-${eur}` });
  const vendu = [
    L('1', 'shop_a', 1, 40), L('1', 'shop_a', 3, 60), L('1', 'shop_a', 5, 50), L('1', 'shop_a', 8, 50),   // 4 ventes, 200 €
    L('2', 'shop_b', 2, 90), L('2', 'shop_b', 6, 30),                                                     // 2 ventes
    L('2', 'shop_b', 2, 500, 6),                                                                          // juillet : hors 30 j et 90 j
    { plateforme: 'Leboncoin', ts: t(10, 4), eur: 70, compte: 'lbc', tx: 'l1' },                          // un autre site : pas ici
  ];
  // 50 ventes au MÊME titre sur deux comptes : l'identité est le compte (uid), jamais un titre.
  for (let i = 0; i < 50; i++) vendu.push({ ...L(i % 2 ? '1' : '2', i % 2 ? 'shop_a' : 'shop_b', 10, 10), titre: 'Nike Air Max 90 42' });
  const comptes = [{ uid: '1', nom: 'shop_a' }, { uid: '2', nom: 'shop_b' }, { uid: '4', nom: 'shop_d' }];
  const releve = [
    { plateforme: 'Vinted', compte: 'shop_a', ts: t(10, 1), enLigne: t(10, 0) },
    { plateforme: 'Vinted', compte: 'shop_a', ts: t(10, 3), enLigne: t(10, 1) },
    { plateforme: 'Vinted', compte: 'shop_a', ts: t(10, 8), enLigne: t(9, 9) },     // 30 j
    { plateforme: 'Vinted', compte: 'shop_b', ts: t(10, 2), enLigne: null },         // pas de date
  ];
  const offres = { offresLues: true, comptes: [
    { compte: '1', recues: 10, acceptees: 6, partielOffres: false, luJusqua: now },
    { compte: '2', recues: 4, acceptees: 1, partielOffres: true, luJusqua: t(9, 28) },
    { compte: '4', recues: 2, acceptees: 2, partielOffres: false, luJusqua: now },
  ] };
  const X = T.tableauComptesVinted({ comptes, vendu, releve, offres, de: B30.de, a: B30.a });
  const lg = (u) => X.lignes.find((l) => l.uid === u);
  dit(X.etat === 'lu' && X.lignes.length === 3 && X.lignes.map((l) => l.uid).join(',') === '1,2,4', 'T3 un compte = une ligne (3 comptes sélectionnés), classés par ventes', X.lignes.map((l) => `${l.uid}:${l.n}`).join(' '));
  dit(lg('1').n === 29 && lg('2').n === 27, 'T4 ventes : 4 + 25 au même titre pour shop_a, 2 + 25 pour shop_b (rien confondu)', `${lg('1').n} / ${lg('2').n}`);
  dit(!X.lignes.some((l) => l.uid === '3') && !X.lignes.some((l) => /lbc/.test(l.nom)), 'T5 un compte exclu, un autre site : absents');
  dit(lg('1').prix === Math.round((200 + 250) / 29 * 100) / 100, 'T6 prix moyen = vendu ÷ ventes, au centime', String(lg('1').prix));
  dit(lg('1').delai === 2, 'T7 jours pour vendre : la MÉDIANE (1, 2, 30 ⇒ 2), pas la moyenne', String(lg('1').delai));
  dit(lg('2').delai == null && lg('2').delaiRaison === 'sansdate', 'T8 vente sans date de mise en ligne ⇒ « — » et pourquoi', lg('2').delaiRaison);
  dit(lg('1').offres === 60, 'T9 offres acceptées : 6 sur 10 ⇒ 60 %', String(lg('1').offres));
  dit(lg('2').offres == null && lg('2').offresRaison === 'partiel' && lg('2').luJusqua === t(9, 28), 'T10 conversations lues seulement jusqu’au 29 oct. ⇒ « — », jusqu’à quand c’est lu', lg('2').offresRaison);
  dit(lg('4').n === 0 && lg('4').prix == null && lg('4').offres == null && lg('4').offresRaison === 'peu', 'T11 compte sélectionné sans vente : 0 vente, prix « — », 2 offres ⇒ pas assez');
  const X3 = T.tableauComptesVinted({ comptes: [{ uid: '1', nom: 'shop_a' }], vendu: [L('1', 'shop_a', 1, 40), L('1', 'shop_a', 2, 60)], de: B30.de, a: B30.a });
  dit(X3.lignes[0].prix == null && X3.lignes[0].prixRaison === 'peu', 'T12 moins de 3 ventes : prix moyen « — » (pas assez)');
  const Xm = T.tableauComptesVinted({ comptes, vendu, manque: ['shop_b'], releve, offres, de: B30.de, a: B30.a });
  const m2 = Xm.lignes.find((l) => l.uid === '2');
  dit(m2 && m2.pasLu && m2.n == null && m2.prix == null, 'T13 un compte aux ventes pas lues : « — », jamais 0', JSON.stringify(m2 && { n: m2.n, p: m2.pasLu }));
  dit(T.tableauComptesVinted({ comptes, vendu: undefined }).etat === 'encours' && T.tableauComptesVinted({ comptes, vendu: null }).etat === 'passu', 'T14 trois états : lecture · pas lu · lu');
  const Xr = T.tableauComptesVinted({ comptes, vendu, releve: null, offres: null, de: B30.de, a: B30.a });
  dit(lg && Xr.lignes[0].delaiRaison === 'releve' && Xr.lignes[0].offresRaison === 'passu', 'T15 relevé absent ⇒ « ouvre Ventes » ; offres pas lues ⇒ « — »');
  const Xp = T.tableauComptesVinted({ comptes, vendu, releve, annonces: 'passu', offres: undefined, de: B30.de, a: B30.a });
  dit(Xp.lignes[0].delaiRaison === 'passu' && Xp.lignes[0].offresRaison === 'encours', 'T16 annonces pas lues ⇒ « — » ; offres en lecture ⇒ en cours');
  const X90 = T.tableauComptesVinted({ comptes, vendu, de: B90.de, a: B90.a });
  const XA = T.tableauComptesVinted({ comptes, vendu, de: BA.de, a: BA.a });
  dit(X90.lignes.find((l) => l.uid === '2').n === 27 && XA.lignes.find((l) => l.uid === '2').n === 28, 'T17 la vente de juillet : dans l’année, pas dans 90 j');
  const Xn = T.tableauComptesVinted({ comptes, vendu, nonComptees: [{ plateforme: 'Vinted', ts: t(10, 3) }, { plateforme: 'Vinted', ts: t(6, 3) }, { plateforme: 'eBay', ts: t(10, 3) }], de: B30.de, a: B30.a });
  dit(Xn.nNonComptees === 1, 'T18 une vente Vinted au prix pas lu, dans la période : dite hors tableau', String(Xn.nNonComptees));

  console.log('\n── E. L’écran');
  const st = sansCommentaires(lire('ecrans/Stats.jsx'));
  dit(/<ComptesVinted refCarte=\{refComptesV\}[^>]*comptes=\{comptesVinted\}/.test(st), 'E1 Statistiques monte « Tes comptes Vinted » avec les comptes sélectionnés');
  dit(/const comptesVinted = React\.useMemo\(\(\) => \{[\s\S]{0,400}!ecarteStats\(u\)/.test(st), 'E2 un compte exclu (masqué, panneau, supprimé) sort de la liste');
  dit(/vendu=\{vendu\}/.test(st) && /offresBrut=\{offresBrut\}/.test(st), 'E3 ventes = le vendu de la coque, offres = la lecture de Statistiques (aucune seconde règle)');
  const cv = sansCommentaires(lire('ComptesVinted.jsx')) + lire('comptes-vinted.css');
  dit(!/#[0-9a-f]{3,6}\b|rgb\(|ambre|accent|--vrm-rouge|--vrm-vert/i.test(cv), 'E4 aucune couleur dans le tableau (§7)');
  dit(/data-cv-compte=\{l\.uid\}/.test(cv), 'E5 chaque ligne porte l’uid du compte (identité, §5)');

  console.log(`\n${ko ? '❌' : '✅'} audit-comptes-vinted : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
