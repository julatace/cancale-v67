// ════════════════════════════════════════════════════════════════════════════
//  LA BAISSE DE PRIX INTELLIGENTE (15 nov. 2026, « vendre plus », validé par Julien) — EXÉCUTÉ
//
//  Les VRAIES règles (src/baisseConseillee.js sur src/conseilPrix.js, src/plancherOffre.js,
//  src/baissePrix.js) tournent sur des annonces INVENTÉES (dépôt public, aucune donnée réelle) :
//    A  moins de 30 j en ligne, âge ou prix pas lus, vendue ⇒ RIEN (aucun prix à la mise en ligne) ;
//       prix d'achat pas saisi ⇒ « Prix d'achat ? », jamais un montant (§2.5) ;
//    B  balayage (prix 5–600 €, achats, frais, âges, vues, favoris variés) : jamais plus de −10 %,
//       jamais sous le plancher complet (achat + frais connus) NI sous l'achat + 10 %, toujours
//       un entier strictement sous le prix ; au plancher ⇒ dit (« au plancher ») ;
//    C  ce qui passe AVANT une baisse : une offre reçue LUE ⇒ garder ; pas lue ⇒ pas un « aucune » ;
//       des favoris LUS (≥ 3) ⇒ garder + offre aux favoris ; peu de vues LUES ⇒ garder + republier ;
//       pas lus ⇒ ni « peu » ni « aucun » ;
//    D  SES ventes comparables : modèle sûr, puis marque LUE, puis tranche ; ≥ 5 ventes datées ;
//       pas en retard (< 1,5 × son délai) ⇒ garder ; 3 × ⇒ la baisse pleine ; une autre marque
//       ne sert jamais de comparable ; une vente se relie à SON annonce par SA transaction ;
//    E  douce (−5 %) par défaut ; pleine (−10 %) si très en retard ou vue sans être aimée ;
//       une proposition déjà faite (mémo de 14 j) reste LA MÊME ;
//    F  IDENTITÉ : 50 annonces au MÊME titre, même marque, même prix ⇒ 50 décisions, chacune sur
//       SES chiffres (son achat, son âge) ; 50 lignes distinctes dans la feuille ;
//    G  « Appliquer » : la baisse en série EXISTANTE avec `cible` (aperçu, son clic, relu) — la
//       cible remplace la baisse tapée, jamais « variée », jamais au-dessus du prix ;
//    H  l'app : la carte `conseilsPrix` passe par la règle ; la feuille n'envoie rien elle-même.
//  `--prouve` : chaque mutation de la règle doit faire rougir au moins un contrôle.
//  `--racine <dir>` : jouer l'audit sur un autre arbre (git archive de la branche de départ).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const iR = process.argv.indexOf('--racine');
const R = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const J = 86400000, T0 = Date.UTC(2026, 10, 15, 10);
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };

async function controles(dir, parler) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (parler) console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
  const imp = async (f) => { try { return await import(pathToFileURL(path.join(dir, f)).href + '?v=' + Math.random()); } catch (e) { dit(false, f + ' se charge', e.message); return null; } };
  const B = await imp('baisseConseillee.js');
  const C = await imp('conseilPrix.js');
  const P = await imp('baissePrix.js');
  if (!B || !C) return ko + 1;
  const conseil = (o) => C.conseilBaisse({ maintenant: T0, ...o });
  const D = (o) => { try { return B.baisseConseillee({ conseil: conseil({ prix: o.prix, ageJours: o.ageJours, achat: o.achat, favoris: o.favoris, derniereBaisse: o.derniereBaisse, memo: o.memo }), ...o }); } catch (e) { return { decision: 'leve:' + e.message, raisons: [] }; } };
  const cles = (d) => (d.raisons || []).map((r) => r.cle).join(' ');

  // A — rien à la mise en ligne, rien sans données lues
  dit(D({ prix: 100, ageJours: 10, achat: 40 }).decision === null, 'A1 10 j en ligne ⇒ rien (aucun prix à la mise en ligne)');
  dit(D({ prix: 100, ageJours: 29, achat: 40 }).decision === null && D({ prix: 100, ageJours: 30, achat: 40 }).decision === 'baisser', 'A2 la borne : 29 j ⇒ rien, 30 j ⇒ une proposition');
  dit(D({ prix: 100, ageJours: null, achat: 40 }).decision === null && D({ prix: null, ageJours: 45, achat: 40 }).decision === null, 'A3 âge ou prix pas lus ⇒ rien');
  const dA = D({ prix: 100, ageJours: 60, achat: null });
  dit(dA.decision === 'achat' && dA.sugg == null && /bc\.r\.achat/.test(cles(dA)), 'A4 prix d\'achat pas saisi ⇒ « Prix d\'achat ? », aucun montant', JSON.stringify(dA));
  dit(B.baisseConseillee({ conseil: { sugg: null, pourquoi: 'vendue' }, prix: 100, ageJours: 60 }).decision === null, 'A5 vendue ⇒ rien');
  dit(B.baisseConseillee({ conseil: { sugg: 90, prix: 100, plancher: 44, nouveau: true }, prix: 100, ageJours: 12, vues: 300, favoris: 0 }).decision === null, 'A6 même si on lui passe une proposition, une annonce de 12 j n\'en reçoit aucune (défense en profondeur)');

  // B — le balayage : bornes et plancher
  let pire = null, n = 0, nB = 0;
  for (let p = 5; p <= 600; p += 7.3) for (const achat of [2, 10, 35, 60, 120, 300]) for (const frais of [0, 3, 12]) for (const age of [30, 44, 75, 140]) for (const vues of [null, 10, 80, 500]) for (const fav of [null, 0, 1, 2]) {
    n++;
    const pr = Math.round(p * 100) / 100;
    const pl = { etat: frais === 12 ? 'partiel' : 'ok', plancher: Math.round((achat + frais) * 100) };
    const d = D({ prix: pr, ageJours: age, achat, vues, favoris: fav, plancher: pl });
    if (d.decision !== 'baisser') continue;
    nB++;
    const plC = Math.max(Math.ceil((achat + frais) * 100 / 100), C.plancherConseil(achat));
    const ok = Number.isInteger(d.sugg) && d.sugg * 100 < Math.round(pr * 100) && d.sugg * 100 >= Math.round(pr * 100) * 0.9 - 1e-9 && d.sugg >= plC && d.pct <= 10;
    if (!ok && !pire) pire = { pr, achat, frais, age, vues, fav, d: { sugg: d.sugg, pct: d.pct } };
  }
  dit(!pire && nB > 100, `B1 ${nB} baisses sur ${n} cas : jamais plus de −10 %, jamais sous achat + frais ni achat + 10 %, un entier sous le prix`, JSON.stringify(pire));
  const dPl = D({ prix: 100, ageJours: 120, achat: 40, vues: 300, favoris: 0, plancher: { etat: 'ok', plancher: 9700 } });
  dit(dPl.decision === 'baisser' && dPl.sugg === 97 && dPl.auPlancher === true && /bc\.r\.plancherOk/.test(cles(dPl)), 'B2 −10 % passerait sous le plancher (97 €) ⇒ 97 €, « au plancher », dit', JSON.stringify(dPl));
  const dPl2 = D({ prix: 100, ageJours: 120, achat: 40, plancher: { etat: 'ok', plancher: 10000 } });
  dit(dPl2.decision === 'garder' && /bc\.r\.plancher\b/.test(cles(dPl2)) && dPl2.sugg == null, 'B3 déjà au plancher ⇒ garder, « plus bas, tu perds »', JSON.stringify(dPl2));
  const dPa = D({ prix: 100, ageJours: 60, achat: 40, vues: 80, plancher: { etat: 'partiel', plancher: 4500 } });
  dit(dPa.decision === 'baisser' && dPa.plancherPartiel === true && /bc\.r\.plancherAuMoins/.test(cles(dPa)), 'B4 frais pas tous saisis ⇒ plancher « au moins », dit');
  const dMa = D({ prix: 100, ageJours: 60, achat: 40, vues: 80, plancher: { etat: 'ok', plancher: 4100 } });
  dit(/bc\.r\.plancherMarge/.test(cles(dMa)) && dMa.plancher === 44, 'B5 le plancher dit est le plus haut, nommé : achat + 10 % (44 €) au-dessus d\'achat + frais (41 €)', JSON.stringify(dMa.raisons));

  // C — avant une baisse
  dit(D({ prix: 100, ageJours: 60, achat: 40, offres: 2 }).decision === 'garder' && D({ prix: 100, ageJours: 60, achat: 40, offres: 2 }).geste === 'offres', 'C1 deux offres reçues lues ⇒ garder (réponds-y)');
  dit(D({ prix: 100, ageJours: 60, achat: 40, offres: null, vues: 80 }).decision === 'baisser', 'C2 offres pas lues ⇒ pas un « aucune » : la règle ne s\'y arrête pas, et ne dit pas « aucune offre »');
  const dF = D({ prix: 100, ageJours: 60, achat: 40, favoris: 4, vues: 300 });
  dit(dF.decision === 'garder' && dF.geste === 'favoris' && /bc\.r\.favoris/.test(cles(dF)), 'C3 quatre favoris lus ⇒ garder, une offre aux favoris d\'abord');
  dit(D({ prix: 100, ageJours: 60, achat: 40, favoris: null, vues: 80 }).decision === 'baisser', 'C4 favoris pas lus ⇒ ni « des favoris » ni « aucun »');
  const dV = D({ prix: 100, ageJours: 60, achat: 40, vues: 12 });
  dit(dV.decision === 'garder' && dV.geste === 'republier', 'C5 douze vues en 60 j ⇒ garder, republier d\'abord (le prix n\'est pas en cause)');
  dit(D({ prix: 100, ageJours: 60, achat: 40, vues: null }).decision === 'baisser', 'C6 vues pas lues ⇒ pas « peu de vues »');

  // D — SES ventes comparables
  const vente = (i, j, marque, titre, eur = 90) => ({ ts: T0 - i * J, enLigne: T0 - i * J - j * J, marque, titre, eur });
  const vNike = Array.from({ length: 6 }, (_, i) => vente(i + 1, 40, 'Nike', 'Nike Dunk Low Panda 42'));
  const idx = B.indexComparables(vNike.concat(Array.from({ length: 8 }, (_, i) => vente(i + 1, 5, 'Adidas', 'Adidas Samba OG 41'))));
  const cDunk = B.comparablesDe({ marque: 'Nike', titre: 'Nike Dunk Low noire 43', prix: 100 }, idx);
  dit(cDunk && cDunk.niveau === 'modele' && cDunk.n === 6 && cDunk.mediane === 40, 'D1 le modèle sûr (Nike Dunk) : 6 ventes, la moitié en 40 j', JSON.stringify(cDunk));
  const dD = D({ prix: 100, ageJours: 45, achat: 40, vues: 80, comparables: cDunk });
  dit(dD.decision === 'garder' && /bc\.r\.pasEnRetard/.test(cles(dD)), 'D2 45 j pour un délai habituel de 40 j ⇒ pas en retard, garder', JSON.stringify(dD));
  const cJordan = B.comparablesDe({ marque: 'Nike', titre: 'Nike Air Force 1 blanche', prix: 100 }, idx);
  dit(cJordan && cJordan.niveau === 'marque', 'D3 pas de modèle comparable ⇒ la marque LUE (Nike)', JSON.stringify(cJordan));
  const cPuma = B.comparablesDe({ marque: 'Puma', titre: 'Puma Suede', prix: 300 }, idx);
  dit(cPuma === null, 'D4 une autre marque ne sert jamais de comparable (Adidas ≠ Puma) ; aucune tranche à 5 ventes ⇒ rien', JSON.stringify(cPuma));
  const idx4 = B.indexComparables(vNike.slice(0, 4));
  dit(B.comparablesDe({ marque: 'Nike', titre: 'Nike Dunk Low', prix: 100 }, idx4) === null, 'D5 quatre ventes ne font pas un délai habituel (5 au moins)');
  const cRapide = B.comparablesDe({ marque: 'Adidas', titre: 'Adidas Samba OG 42', prix: 100 }, idx);
  const dR = D({ prix: 100, ageJours: 45, achat: 40, vues: 80, comparables: cRapide });
  dit(dR.decision === 'baisser' && dR.pct === 10 && /bc\.r\.tresEnRetard/.test(cles(dR)), 'D6 45 j quand ses Samba partent en 5 j ⇒ très en retard, la baisse pleine (−10 %)', JSON.stringify(dR));
  // Une vente se relie à SON annonce par SA transaction — jamais par le titre.
  const releve = { l: [['Vinted', 'c', 'TX1', T0 - J, 90, 40, 0, 'Nike Dunk Low'], ['Vinted', 'c', 'TX2', T0 - J, 90, 40, 0, 'Nike Dunk Low'], ['eBay', 'c', 'E1', T0 - J, 90, 40, 0, 'Nike Dunk Low']] };
  const extras = { txn: { TX1: { item: 'A1' } }, items: { A1: { id: 'A1', brand: 'Nike', createdTs: (T0 - 20 * J) / 1000, title: 'Nike Dunk Low' }, A2: { id: 'A2', brand: 'Nike', title: 'Nike Dunk Low' } }, dates: null };
  const vr = B.ventesComparablesDuReleve(releve, extras, (it) => (it.createdTs ? it.createdTs * 1000 : null));
  dit(Array.isArray(vr) && vr.length === 1 && vr[0].marque === 'Nike' && vr[0].enLigne === T0 - 20 * J, 'D7 relevé ⇒ ventes : par SA transaction (TX2 sans transaction lue n\'emprunte pas l\'annonce au même titre ; eBay écarté)', JSON.stringify(vr));
  dit(B.ventesComparablesDuReleve(releve, { txn: null, items: null }, () => null) === null, 'D8 ventes pas lues ⇒ null (pas « aucune vente »)');

  // E — douce, pleine, mémo
  const dDouce = D({ prix: 100, ageJours: 45, achat: 40, vues: 80, favoris: 1 });
  dit(dDouce.decision === 'baisser' && dDouce.sugg === 95 && dDouce.pct === 5, 'E1 par défaut, la baisse douce : 100 € ⇒ 95 €', JSON.stringify(dDouce));
  const dFrein = D({ prix: 100, ageJours: 45, achat: 40, vues: 200, favoris: 0 });
  dit(dFrein.decision === 'baisser' && dFrein.sugg === 90 && /bc\.r\.freine/.test(cles(dFrein)), 'E2 200 vues, aucun favori ⇒ le prix freine, la baisse pleine (90 €)', JSON.stringify(dFrein));
  const dFreinPasLu = D({ prix: 100, ageJours: 45, achat: 40, vues: 200, favoris: null });
  dit(dFreinPasLu.decision === 'baisser' && dFreinPasLu.sugg === 95, 'E3 favoris PAS LUS ⇒ jamais « aucun favori » : la baisse reste douce', JSON.stringify(dFreinPasLu));
  const memo = { at: T0 - 3 * J, prix: 100, sugg: 90 };
  const dMemo = D({ prix: 100, ageJours: 45, achat: 40, vues: 80, favoris: 1, memo });
  dit(dMemo.decision === 'baisser' && dMemo.sugg === 90 && dMemo.nouveau === false, 'E4 proposée il y a 3 j (90 €) ⇒ la MÊME, jamais une autre (pas la douce 95 €)', JSON.stringify(dMemo));
  dit(D({ prix: 100, ageJours: 60, achat: 40, derniereBaisse: T0 - 5 * J }).decision === 'garder', 'E5 baissée il y a 5 j ⇒ garder (laisse-lui le temps)');

  // F — 50 annonces identiques
  const ann = Array.from({ length: 50 }, (_, i) => ({ id: String(9000 + i), titre: 'Nike Dunk Low Panda 42', marque: 'Nike', prix: 100, age: 31 + i, achat: i % 2 ? 40 : 96 }));
  const lignes = ann.map((a) => ({ cle: 'u:' + a.id, id: a.id, age: a.age, d: D({ prix: a.prix, ageJours: a.age, achat: a.achat, vues: 80, favoris: 1, comparables: B.comparablesDe(a, idx) }) }));
  const cl = B.classerConseils(lignes);
  const ok50 = cl.length === 50 && new Set(cl.map((l) => l.cle)).size === 50 && lignes.every((l, i) => (ann[i].achat === 96 ? l.d.decision === 'garder' : l.d.decision === 'baisser' || l.d.decision === 'garder') && (ann[i].achat === 96 ? l.d.sugg == null : true));
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const sur = ann.every((a) => { const l = parId.get(a.id); return a.achat !== 96 || !(l.d.sugg > 0); });
  dit(ok50 && sur, 'F1 50 annonces au même titre ⇒ 50 décisions distinctes, chacune sur SON achat (achat 96 € ⇒ jamais de baisse, même à côté d\'une jumelle à 40 €)');
  dit(cl.slice(0, 1).every((l) => l.d.decision !== 'garder' || cl.every((x) => x.d.decision === 'garder')), 'F2 les baisses d\'abord dans la feuille');

  // G — « Appliquer » : la baisse en série existante, avec la cible
  if (P) {
    const lg = P.lignesBaisse({ annonces: [{ id: '1', uid: 'u', prix: 100, cible: 95 }, { id: '2', uid: 'u', prix: 100, cible: 120 }, { id: '3', uid: 'u', prix: 100, cible: 95.5 }], baisse: P.baisseTapee('pct', '30'), compteOnglet: 'u', plancherDe: () => null, facteurs: { 1: 1.2, 2: 1.2, 3: 1.2 } });
    dit(lg[0].nouveau === 95 && lg[0].avecCible === true && lg[0].baisseVue == null, 'G1 la cible remplace la baisse tapée (−30 %) et n\'est jamais variée', JSON.stringify(lg[0]));
    dit(lg[1].avecCible === false && lg[2].avecCible === false, 'G2 une cible au-dessus du prix, ou pas en euros entiers, n\'est pas une cible');
    const lg2 = P.lignesBaisse({ annonces: [{ id: '1', uid: 'u', prix: 100, cible: 95 }], baisse: { ok: true, mode: 'eur', valeur: 1 }, compteOnglet: 'v', plancherDe: () => ({ etat: 'ok', plancher: 9700 }) });
    dit(lg2[0].bloque && lg2[0].sousPlancher === true && lg2[0].coche === false, 'G3 le MÊME chemin : autre compte ouvert ⇒ bloquée ; sous le plancher ⇒ décochée');
  } else dit(false, 'G src/baissePrix.js se charge');
  return ko;
}

const MUTATIONS = [
  ['offres ignorées', "if (o != null && o > 0) return garder('bc.r.offres', { n: o }, 'offres');", ''],
  ['comparables ignorés', 'if (cmp && age < Math.max(AGE_MIN_J,', 'if (false && cmp && age < Math.max(AGE_MIN_J,'],
  ['favoris ignorés', "if (f != null && f >= FAVORIS_D_ABORD) return garder('bc.r.favoris', { n: f }, 'favoris');", ''],
  ['peu de vues ignoré', "if (v != null && v <= VUES_PEU) return garder('bc.r.peuVue', { n: v }, 'republier');", ''],
  ['plancher complet ignoré', 'if (plE != null && sugg < plE) { sugg = plE; auPlancher = true; }', ''],
  ['pas lu = aucun favori', 'const freine = v != null && f === 0 &&', 'const freine = v != null && (f === 0 || f == null) &&'],
  ['quatre ventes suffisent', 'export const SEUIL_COMPARABLES = 5;', 'export const SEUIL_COMPARABLES = 4;'],
  ['mise en ligne conseillée', 'if (!Number.isFinite(age) || age < AGE_MIN_J) return vide(\'age\');', 'if (!Number.isFinite(age)) return vide(\'age\');'],
  ['achat deviné', "if (c.pourquoi === 'achat' || (plancher && plancher.etat === 'achat')) return", "if (false) return"],
  ['mémo oublié', 'if (c.nouveau === false) sugg = Math.round(Number(c.sugg));', 'if (false) sugg = 0;'],
  ['comparable par titre', 'const it = itemLot ? extras.items[itemLot] || null : (t && t.item ? extras.items[t.item] || null : null);', "const it = itemLot ? extras.items[itemLot] || null : (t && t.item ? extras.items[t.item] || null : Object.values(extras.items).find((x) => x.title === r[7]) || null);"],
  ['douce = pleine', 'export const BAISSE_DOUCE_PCT = 5;', 'export const BAISSE_DOUCE_PCT = 10;'],
];

(async () => {
  const SRC = path.join(R, 'src');
  const FICHIERS = ['baisseConseillee.js', 'conseilPrix.js', 'statsVentes.js', 'ceQuiRapporte.js', 'baissePrix.js'];
  let ko = await controles(SRC, true);
  // H — l'app (lue en texte, commentaires retirés)
  const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const APP = sans(lire('src/App.jsx')), F = sans(lire('src/BaissesConseillees.jsx')), BPS = '';   // (20 nov.) la feuille de baisse en série est retirée : la baisse se fait dans l'extension
  const dit = (c, m) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m); };
  dit(/baisseConseillee\(\{ conseil: c,/.test(APP) && /commeConseil\(d, tr\)/.test(APP), 'H1 la carte `conseilsPrix` (fiche, repricing, qui dorment) passe par la règle');
  dit(/cible: l\.d\.sugg/.test(APP) && /setBaisseSel\(l2\.map/.test(APP), 'H2 « Appliquer » ouvre la baisse en série EXISTANTE avec le prix conseillé');
  dit(F.length > 0 && !/vmrCmd|fetch\(|baisserPrixVinted/.test(F), 'H3 la feuille « Baisses conseillées » n\'envoie rien elle-même');
  void BPS;
  dit(/<FeuilleAnnoncesExtension action="baisser" annonces=\{baisseSel\}/.test(APP) && /a\.cible != null \? '→ ' \+ prixLigneExt\(a\.cible\)/.test(APP), 'H4 (20 nov.) « Appliquer » montre les cibles et ouvre « Baisser dans l’extension » sur ces annonces');
  dit(/lireExtrasRepartition\(\)/.test(APP) && /indexComparables\(ventesComparablesDuReleve\(/.test(APP), 'H5 les comparables viennent de SES ventes (la lecture partagée de Statistiques)');
  let koM = 0;
  if (PROUVE && fs.existsSync(path.join(SRC, 'baisseConseillee.js'))) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baisse-conseillee-'));
    const src = fs.readFileSync(path.join(SRC, 'baisseConseillee.js'), 'utf8');
    for (const f of FICHIERS.slice(1)) fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
    if (fs.existsSync(path.join(SRC, 'beneficePaire.js'))) fs.copyFileSync(path.join(SRC, 'beneficePaire.js'), path.join(dir, 'beneficePaire.js'));
    for (const [nom, a, b] of MUTATIONS) {
      if (!src.includes(a)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); koM++; continue; }
      fs.writeFileSync(path.join(dir, 'baisseConseillee.js'), src.replace(a, b));
      const k = await controles(dir, false);
      console.log((k > 0 ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${k} contrôle(s) rouge(s)`);
      if (!k) koM++;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(ko || koM ? `\n${ko} contrôle(s) rouge(s)${PROUVE ? `, ${koM} mutation(s) non vue(s)` : ''}` : '\nTout est vert.');
  process.exit(ko || koM ? 1 : 0);
})();
