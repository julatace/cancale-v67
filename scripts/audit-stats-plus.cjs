// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — PLUS DE STATISTIQUES (11 nov., lot stats-plus)
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE les règles neuves sur des données inventées (aucune base) :
//   1. src/statsPlus.js : en bref (ventes, panier, ± % au même point, « pas
//      assez de données »), marge connue (couverture), 10 meilleures ventes
//      (prix d'achat inconnu jamais classé), âge du stock (tranches, sans date),
//      vendu ≠ reçu (une vente vendue une semaine, versée la suivante).
//   2. src/design/carteChiffres.js : Ma journée à 6 cases (rangé, rogné à 6,
//      les autres pages à 3), valeur du stock (minimum dit, jamais 0 pour pas
//      su), objectif (%), URSSAF à payer (statut sans cotisations ⇒ hors).
//   3. Le branchement : Stats.jsx lit le reçu par `recuPublieEntre`, App.jsx
//      passe `montantPeriodeUrssaf` (la règle du rappel) à la carte.
// Mutations (`--mutation=…`) : chacune réaffaiblit une règle ⇒ l'audit DOIT rougir.
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + JSON.stringify(d) : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

let SP = lire('src/statsPlus.js'), CC = lire('src/design/carteChiffres.js');
const muter = (quoi, avant, apres) => {
  const t = quoi === 'sp' ? SP : CC;
  if (!t.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 80)); process.exit(2); }
  if (quoi === 'sp') SP = t.replace(avant, apres); else CC = t.replace(avant, apres);
};
if (MUT === 'achat') muter('sp', '    if (!connu(l.achat)) continue;\n', '');
else if (MUT === 'pasassez') muter('sp', 'x && x.n >= MIN_DONNEES ?', 'x && x.n > 0 ?');
else if (MUT === 'recu') muter('sp', 'const R = typeof recuEntre === \'function\' ? recuEntre(x.debut, x.fin - 1) : null;', 'const R = { valeur: x.eur };');
else if (MUT === 'tranches') muter('sp', 'const n = [dort.datesConnues - s30, s30 - s90, s90];', 'const n = [dort.total - s30, s30 - s90, s90];');
else if (MUT === 'six') muter('cc', 'Math.min(r.c.length, maxCases(page))', 'r.c.length');
else if (MUT === 'stock') muter('cc', "    if (partiel && !(v.centimes > 0)) return vide('achats');\n", '');
else if (MUT === 'stockpartiel') muter('cc', "const partiel = !!v.partiel || Number(v.nSans) > 0;", 'const partiel = false;');
else if (MUT === 'record') muter('sp', "out.vente = T.nCout >= MIN_DONNEES ?", "out.vente = T.n >= MIN_DONNEES ?");
else if (MUT === 'recordachat') muter('sp', "    if (!connu(l.achat)) continue;\n", '');
else if (MUT === 'unmois') muter('sp', "if (gs.length < 2) return { pasAssez: true, nGroupes: gs.length };", '');
else if (MUT === 'tauxlbc') muter('sp', "taux: vinted && Number.isFinite(enLigne) ? tauxVente(c.n, enLigne) : (vinted ? null : undefined),", "taux: tauxVente(c.n, enLigne || 0),");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const fichiers = (t, dossier) => t.replace(/from '(\.\.?\/[^']+)'/g, (m, f) => `from 'file://${path.join(R, dossier, f)}'`);

(async () => {
  console.log('── 1. src/statsPlus.js');
  let S = null, M = null;
  if (SP) { try { S = await charger(fichiers(SP, 'src'), 'stats-plus'); } catch (e) { dit(false, 'src/statsPlus.js se charge', e.message); } }
  dit(!!S && typeof S.resumePeriode === 'function', 'le module des statistiques neuves existe (src/statsPlus.js)');
  if (CC) { try { M = await charger(fichiers(CC, 'src/design'), 'carte-chiffres'); } catch (e) { dit(false, 'carteChiffres.js se charge', e.message); } }
  const SV = await charger(fichiers(lire('src/statsVentes.js'), 'src'), 'stats-ventes');
  if (!S || !M) { console.log(`\n❌ stats-plus : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // ── En bref ──
  const MAINT = new Date(2026, 10, 18, 15).getTime();   // mercredi 18 nov. 2026
  const T = (m, j, h = 12) => new Date(2026, m, j, h).getTime();
  const L = [
    { plateforme: 'Vinted', compte: 'alice', ts: T(10, 2), eur: 40 }, { plateforme: 'Vinted', compte: 'alice', ts: T(10, 5), eur: 60 },
    { plateforme: 'Leboncoin', compte: 'l1', ts: T(10, 10), eur: 50 }, { plateforme: 'Vinted', compte: 'bruno', ts: T(10, 17), eur: 70 },
    { plateforme: 'Vinted', compte: 'alice', ts: T(9, 3), eur: 30 }, { plateforme: 'Vinted', compte: 'alice', ts: T(9, 9), eur: 30 },
    { plateforme: 'eBay', compte: 'e', ts: T(9, 15), eur: 30 },
    { plateforme: 'Vinted', compte: 'alice', ts: T(9, 25), eur: 999 },   // après le 18 octobre : hors « même point »
  ];
  const b = SV.bornesPeriode('mois', MAINT);
  const V = SV.venduPeriode(L, b);
  const Rz = S.resumePeriode(V, false);
  dit(Rz.n === 4 && Rz.nPrec === 3, 'ventes : 4 ce mois, 3 le mois d’avant au même jour (le 25 octobre ne compte pas)', Rz);
  dit(Rz.panier === 55 && Rz.panierPrec === 30, 'panier moyen : 220 € ÷ 4 = 55 € ; 90 € ÷ 3 = 30 € au même point', [Rz.panier, Rz.panierPrec]);
  dit(Rz.ecartPanier === 83 && Rz.ecartN === 33, 'écarts : +83 % (panier), +33 % (ventes)', [Rz.ecartPanier, Rz.ecartN]);
  const deux = S.resumePeriode(SV.venduPeriode(L.slice(0, 2), b), false);
  dit(deux.panier === null && deux.pasAssez === true, 'deux ventes : « pas assez de données », aucun panier moyen', deux);
  dit(S.resumePeriode(V, true).panier === null, 'des ventes au montant pas lu : pas de moyenne (« — »), jamais une moyenne partielle');
  dit(S.resumePeriode(null) === null && S.resumePeriode(undefined) === undefined, 'trois états : pas su = null, en cours = undefined');
  // Comptes exclus : la coque retire leurs lignes AVANT ; aucun total ne les garde.
  const sansBruno = S.resumePeriode(SV.venduPeriode(L.filter((l) => l.compte !== 'bruno'), b), false);
  dit(sansBruno.n === 3 && sansBruno.panier === 50, 'compte exclu (bruno) : 3 ventes, 150 € ÷ 3 = 50 €', sansBruno);

  // ── Marge connue ──
  const LP = [
    { plateforme: 'Vinted', compte: 'alice', ts: T(10, 2), eur: 100, achat: 60, titre: 'Air Max 90' },
    { plateforme: 'Vinted', compte: 'alice', ts: T(10, 3), eur: 80, achat: 30, titre: 'Samba' },
    { plateforme: 'Vinted', compte: 'bruno', ts: T(10, 4), eur: 50, achat: 50, titre: 'Gazelle' },
    { plateforme: 'Leboncoin', compte: 'l1', ts: T(10, 5), eur: 300, achat: null, titre: 'Jordan 1' },   // prix d'achat inconnu
    { plateforme: 'eBay', compte: 'e', ts: T(10, 6), eur: 40, achat: 45, titre: 'Stan Smith' },          // vendue à perte
  ];
  const Mg = S.margeConnue(LP);
  dit(Mg.n === 5 && Mg.nCout === 4, 'marge : 4 ventes au prix d’achat connu sur 5', Mg);
  dit(Mg.brut === 85 && Mg.marge === 31.5 && Mg.moyen === 21.25, 'brut 270 − 185 = 85 € ; marge 85 ÷ 270 = 31,5 % ; 21,25 € par vente (sans la Jordan)', Mg);
  dit(S.margeConnue(LP.slice(3)).marge === null, 'une seule vente au prix connu : pas assez de données');

  // ── Les 10 meilleures ventes ──
  const Tp = S.meilleuresVentes(LP, 10);
  dit(Tp.lignes.map((l) => l.titre).join('|') === 'Samba|Air Max 90|Gazelle|Stan Smith', 'classées : Samba +50, Air Max +40, Gazelle 0, Stan Smith −5', Tp.lignes.map((l) => [l.titre, l.brut]));
  dit(!Tp.lignes.some((l) => l.titre === 'Jordan 1') && Tp.n === 5 && Tp.nCout === 4, 'la Jordan au prix d’achat inconnu n’est PAS classée (ses 300 € ne sont pas un bénéfice) ; « 4 sur 5 »');
  const beaucoup = Array.from({ length: 14 }, (_, i) => ({ plateforme: 'Vinted', ts: T(10, 1 + i), eur: 10 + i, achat: 5, titre: `P${i}` }));
  dit(S.meilleuresVentes(beaucoup, 10).lignes.length === 10 && S.meilleuresVentes(beaucoup, 10).lignes[0].titre === 'P13', 'dix au plus, la meilleure en tête');
  dit(S.meilleuresVentes(null) === null, 'relevé pas lu : null (« — »), jamais une liste vide');

  // ── Âge du stock ──
  const A = S.ageDuStock({ total: 20, datesConnues: 18, seuils: { 30: { n: 10 }, 60: { n: 6 }, 90: { n: 4 } } });
  dit(A && A.tranches.map((t) => t.n).join(',') === '8,6,4' && A.sansDate === 2, 'âge : 8 de moins de 30 j, 6 de 30 à 90 j, 4 de 90 j et plus ; 2 sans date dites, pas rangées', A);
  dit(S.ageDuStock(undefined) === undefined && S.ageDuStock({ total: 3 }) === null, 'jamais publié ⇒ undefined (« ouvre Annonces ») ; illisible ⇒ null');
  dit(S.ageDuStock({ total: 5, datesConnues: 5, seuils: { 30: { n: 2 }, 60: { n: 1 }, 90: { n: 3 } } }) === null, 'des seuils incohérents (90 j > 30 j) : null, jamais des tranches négatives');

  // ── Vendu ≠ reçu ──
  // Vendue le 9 nov. (semaine du 9), versée le 17 nov. (semaine du 16).
  const LV = [{ plateforme: 'Vinted', compte: 'alice', ts: T(10, 9), eur: 70 }];
  const barres = SV.barresPeriode(LV, 'mois', MAINT);
  const pub = { at: MAINT - 3600000, mois: [{ ym: '2026-11', ca: 70 }], recu: { '2026-11': 70 }, recuJours: { '2026-11-17': 70 }, sources: { vinted: 'lu' } };
  const VR = S.venduEtRecu(barres, (de, a) => M.recuPublieEntre(pub, { de, a }, MAINT));
  const i9 = VR.barres.findIndex((x) => new Date(x.debut).getDate() === 9 && new Date(x.debut).getMonth() === 10);
  const i16 = VR.barres.findIndex((x) => new Date(x.debut).getDate() === 16 && new Date(x.debut).getMonth() === 10);
  dit(i9 >= 0 && VR.barres[i9].vendu === 70 && VR.barres[i9].recu === 0, 'semaine du 9 : vendu 70 €, reçu 0 € (pas encore versé)', VR.barres[i9]);
  dit(i16 >= 0 && VR.barres[i16].vendu === 0 && VR.barres[i16].recu === 70, 'semaine du 16 : vendu 0 €, reçu 70 € (le jour du versement)', VR.barres[i16]);
  const VRk = S.venduEtRecu(barres, () => ({ valeur: null, raison: 'absente' }));
  dit(VRk.barres.every((x) => x.recu === null) && VRk.raison === 'absente' && VRk.recuLu === false, 'reçu pas publié : chaque barre « — » (null) avec sa raison, jamais 0');
  const VRp = S.venduEtRecu(barres, (de, a) => M.recuPublieEntre({ ...pub, sources: { vinted: 'lu', ebay: 'pasSu' } }, { de, a }, MAINT));
  dit(VRp.recuComplet === false && VRp.barres[i16].recuPartiel === true, 'un site pas lu : le reçu est un minimum (« au moins »)');

  // ── Mes records ──
  const VT = [
    { plateforme: 'Vinted', compte: 'a', ts: T(8, 3), eur: 50 }, { plateforme: 'Vinted', compte: 'a', ts: T(8, 4), eur: 60 },   // sept. : 110
    { plateforme: 'Vinted', compte: 'a', ts: T(9, 5), eur: 200 },                                                              // oct. : 200 (lun. 5)
    { plateforme: 'Leboncoin', compte: 'l', ts: T(9, 7), eur: 30 },                                                            // oct. : 230, même semaine que le 5
    { plateforme: 'Vinted', compte: 'a', ts: T(10, 2), eur: 120 },                                                             // nov. : 120
  ];
  const RLV = [
    { plateforme: 'Vinted', ts: T(9, 5), eur: 200, achat: 120, titre: 'A', enLigne: T(9, 4, 13) },   // 23 h, brut 80
    { plateforme: 'Vinted', ts: T(9, 9), eur: 150, achat: null, titre: 'B', enLigne: T(9, 1) },    // achat inconnu : 150 € n'est pas un bénéfice
    { plateforme: 'Vinted', ts: T(10, 2), eur: 120, achat: 20, titre: 'C', enLigne: T(9, 20) },    // brut 100
    { plateforme: 'Leboncoin', ts: T(8, 3), eur: 50, achat: 10, titre: 'D' },                      // brut 40, pas de date de mise en ligne
  ];
  const Rec = S.recordsDe({ vendu: VT, releve: RLV });
  dit(Rec.mois && Rec.mois.k === '2026-10' && Rec.mois.eur === 230 && Rec.mois.n === 2, 'meilleur mois : octobre, 230 € (2 ventes)', Rec.mois);
  dit(Rec.semaine && Rec.semaine.eur === 230 && new Date(Rec.semaine.de).getDate() === 5, 'meilleure semaine : celle du lundi 5 octobre, 230 €', Rec.semaine);
  dit(Rec.vente && Rec.vente.titre === 'C' && Rec.vente.brut === 100 && Rec.vente.nCout === 3 && Rec.vente.n === 4, 'meilleure vente : C (+100 €) parmi 3 au prix connu sur 4 — jamais B (achat inconnu)', Rec.vente);
  dit(Rec.rapide && Rec.rapide.titre === 'A' && Rec.rapide.heures === 23 && Rec.rapide.nDelai === 3, 'vente la plus rapide : A, 23 h, parmi 3 datées (Leboncoin sans date hors)', Rec.rapide);
  dit(S.recordsDe({ vendu: VT.slice(4), releve: RLV.slice(0, 2) }).mois.pasAssez === true, 'un seul mois de ventes : pas de « record »');
  dit(S.recordsDe({ vendu: VT, releve: RLV.slice(0, 2) }).vente.pasAssez === true, 'une seule vente au prix connu : pas de « meilleure vente »');
  dit(S.recordsDe({ vendu: VT, releve: [RLV[0], RLV[1], { ...RLV[1], ts: T(9, 10) }] }).vente.pasAssez === true, 'trois ventes dont UNE au prix connu : pas de « meilleure vente » (le compte se fait sur les prix connus)');
  const R0 = S.recordsDe({ vendu: undefined, releve: null });
  dit(R0.mois === undefined && R0.vente === null, 'trois états : en cours = undefined, pas su = null');
  dit(S.recordsDe({ vendu: VT.filter((l) => l.compte !== 'l'), releve: RLV }).mois.eur === 200, 'compte exclu (Leboncoin retiré par la coque) : octobre = 200 €');

  // ── Comparer deux comptes ──
  const tv = SV.tauxVenteMois;
  const cA = S.colonneCompte({ k: 'Vinted|a', plat: 'Vinted', nom: 'a', n: 4, eur: 210, mediane: 6.5, nDelai: 3 }, { brut: 80, nCout: 2, n: 3 }, 12, tv);
  dit(cA.panier === 52.5 && cA.brut === 80 && cA.nCout === 2 && cA.nFin === 3, 'compte Vinted : panier 52,50 €, bénéfice connu 80 € (2 sur 3)', cA);
  dit(cA.delai === 6.5 && cA.taux === 25, 'délai médian 6,5 j ; taux 4 ÷ (4 + 12) = 25 %', cA);
  const cL = S.colonneCompte({ k: 'Leboncoin|', plat: 'Leboncoin', nom: 'Leboncoin', n: 2, eur: 90, mediane: null, nDelai: 0 }, null, null, tv);
  dit(cL.panier === null && cL.delai === undefined && cL.taux === undefined && cL.brut === null, 'Leboncoin : 2 ventes ⇒ pas de panier ; délai et taux hors sujet (jamais 0) ; bénéfice pas su', cL);
  dit(S.colonneCompte({ k: 'Vinted|b', plat: 'Vinted', nom: 'b', n: 3, eur: 30, nDelai: 0 }, null, null, tv).taux === null, 'Vinted au nombre en ligne pas lu : taux « — »');

  console.log('── 2. La carte de Ma journée (src/design/carteChiffres.js)');
  dit(M.maxCases('journee') === 6 && M.maxCases('ventes') === 3, 'Ma journée : 6 cases au plus ; les autres pages : 3');
  const six = [{ id: 'vendu', p: 'semaine' }, { id: 'ventes', p: 'mois' }, { id: 'panier' }, { id: 'stock' }, { id: 'aposter' }, { id: 'retirer' }, { id: 'objectif' }];
  const reg = M.reglageAEnregistrer(null, 'journee', { g: { id: 'vendu', p: 'jour' }, c: six });
  dit(reg.pages.journee.c.length === 6, 'enregistré : rogné à 6 cases', reg.pages.journee.c.length);
  const lu = M.reglageDePage({ v: 1, pages: { journee: { g: { id: 'vendu', p: 'jour' }, c: six } } }, 'journee');
  dit(lu.c.length === 6 && lu.c.map((x) => x.id).join(',') === 'vendu,ventes,panier,stock,aposter,retirer', 'relu : les 6 dans SON ordre (le 7e ne passe pas)', lu.c.map((x) => x.id));
  const deuxC = M.reglageDePage({ v: 1, pages: { journee: { g: { id: 'vendu', p: 'jour' }, c: [{ id: 'retirer' }, { id: 'stock' }] } } }, 'journee');
  dit(deuxC.c.map((x) => x.id).join(',') === 'retirer,stock', 'deux cases rangées : deux cases (réordonnées), jamais complétées en douce');
  const autre = M.reglageDePage({ v: 1, pages: { compta: { g: { id: 'benefice', p: 'mois' }, c: six } } }, 'compta');
  dit(autre.c.length === 3, 'une page à 3 cases reste à 3');
  const dbl = M.reglageDePage({ v: 1, pages: { journee: { g: { id: 'vendu', p: 'jour' }, c: [{ id: 'stock' }, { id: 'stock' }, { id: 'aposter' }, { id: 'retirer' }] } } }, 'journee');
  dit(dbl.c.filter((x) => x.id === 'stock').length === 1, 'jamais deux fois le même chiffre sur la carte (§7)');
  const REG = { fmt: (v) => String(v), progressionObjectif: (await charger(fichiers(lire('src/objectifMois.js'), 'src'), 'objectif')).progressionObjectif,
    bilanLignes: (lignes, de, a) => { const x = lignes.filter((l) => l.ts >= de && (a == null || l.ts <= a)); return { n: x.length, eur: x.reduce((t, l) => t + l.eur, 0) }; },
    debutPeriode: (t, p) => { const d = new Date(t); return p === 'mois' ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), 0, 1); },
    decalerPeriode: (d, p, k) => (p === 'mois' ? new Date(d.getFullYear(), d.getMonth() + k, 1) : new Date(d.getFullYear() + k, 0, 1)),
    urssafAPayer: (ligne) => (ligne && ligne.micro === false ? { hors: 'pas de cotisations pour ton statut' } : ligne ? { apayer: 24.8, partiel: !!ligne.p, label: 'T4' } : null) };
  const sel = { site: 'toutes', compte: null, periode: null };
  const v = (id, S2) => M.valeurChiffre(id, { id }, S2, sel, REG, MAINT);
  const st = v('stock', { valeurStock: { centimes: 120000, n: 10, nPrix: 7, nSans: 3, partiel: false } });
  dit(st.valeur === 1200 && st.partiel === true && st.couverture === '7 sur 10', 'valeur du stock : au moins 1 200 € (7 paires sur 10 ont leur prix d’achat)', st);
  dit(v('stock', { valeurStock: { centimes: 0, n: 4, nPrix: 0, nSans: 4, partiel: true } }).valeur === null, 'aucun prix d’achat connu : « — », jamais « au moins 0 € »');
  dit(v('stock', { valeurStock: null }).valeur === null && v('stock', { valeurStock: null }).raison === 'annonces', 'jamais publiée : « — », le geste « ouvre Annonces »');
  dit(v('stock', { valeurStock: { centimes: 50000, n: 5, nPrix: 5, nSans: 0, partiel: false } }).partiel === false, 'toutes les paires au prix connu : un total complet (500 €)');
  const vendu = { lignes: [{ plateforme: 'Vinted', compte: 'a', ts: T(10, 3), eur: 600 }], manque: [], nonComptees: [] };
  const obj = v('objectif', { vendu, objectif: { type: 'ca', valeur: 1000 } });
  dit(obj.valeur === 60 && obj.def === undefined, 'objectif : 600 € sur 1 000 € ⇒ 60 %', obj);
  dit(v('objectif', { vendu, objectif: null }).hors === 'aucun objectif', 'pas d’objectif : « — » et la raison');
  dit(v('urssafapayer', { ligneUrssaf: { micro: true } }).valeur === 24.8, 'URSSAF à payer : le montant de l’échéance, par la règle passée par l’app');
  dit(v('urssafapayer', { ligneUrssaf: { micro: true, p: 1 } }).partiel === true, 'période pas finie : « au moins »');
  dit(v('urssafapayer', { ligneUrssaf: { micro: false } }).valeur === null && !!v('urssafapayer', { ligneUrssaf: { micro: false } }).hors, 'statut sans cotisations : hors sujet, jamais 0 €');
  dit(v('urssafapayer', { ligneUrssaf: null }).valeur === null, 'ligne pas publiée : « — »');
  dit(['stock', 'objectif', 'urssafapayer'].every((id) => !!M.AIDE_CHIFFRES[id]), 'chaque chiffre neuf dit d’où il vient (« ? » de la carte)');

  console.log('── 3. Le branchement (lu dans le code, sans commentaires)');
  const STATS = sansCommentaires(lire('src/ecrans/Stats.jsx'));
  const APP = sansCommentaires(require('./_source-app.cjs').sourceApp());
  dit(/venduEtRecu\(barres, \(de, a\) => ligneUrssaf === undefined \? \{ valeur: null, raison: 'encours' \} : recuPublieEntre\(ligneUrssaf, \{ de, a \}\)\)/.test(STATS), 'Statistiques : le reçu de chaque barre est `recuPublieEntre` (la ligne de Ventes), jamais recalculé');
  dit(/<StatsPlus b=\{b\} V=\{vendu === undefined \? undefined : V\}/.test(STATS), 'Statistiques : « En bref » lit le MÊME `venduPeriode` que la tuile « Vendu »');
  dit(/const urssafAPayerCarte = [\s\S]{0,400}montantPeriodeUrssaf\(due, ligne, tauxUrssaf\(\)\)/.test(APP), 'la carte : URSSAF à payer = `montantPeriodeUrssaf` (la règle du rappel de Ma journée)');
  dit(/useValeurStockCarte\(AUTH\.user\?\.id \|\| ''\)/.test(APP), 'la carte : valeur du stock = la publication d’Annonces (`useValeurStock`)');
  const CM = sansCommentaires(lire('src/design/CarteMois.jsx'));
  dit(/export function CasesEnPages/.test(CM) && /data-noswipe=""/.test(CM) && /aria-label=\{`Page \$\{i \+ 1\} sur \$\{nPages\}`\}/.test(CM), 'plus de 3 cases : pages qui glissent (sans changer d’onglet), points nommés « Page n sur N »');

  console.log(ko ? `\n❌ stats-plus : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ stats-plus : ${ok} vert(s), 0 rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
