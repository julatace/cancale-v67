// Audit : « LE BOOST EST-IL RENTABLE ? » (src/boostRentable.js — refait le 3 nov.).
//
// On EXÉCUTE la règle pure (avec le VRAI `modeleSur` de src/ceQuiRapporte.js) sur
// des annonces inventées et on juge ce qu'elle REND contre un calcul FAIT À LA
// MAIN (ci-dessous) :
//   · la population : les annonces mises en ligne dans la période (vendues ou
//     non) ; boostée = « Boost payé » saisi OU `promoted === true` ; non boostée
//     = `promoted === false` sans montant ; absent = « pas su » (compté à part) ;
//   · on ne compare que les modèles SÛRS présents des deux côtés ;
//   · vendue = une vente non annulée reliée par SA transaction, jamais le titre ;
//   · vendus/total, délai médian, prix médian BOOST DÉDUIT (boostée sans montant
//     ⇒ hors du prix), coût = somme des montants saisis avec sa couverture ;
//   · moins de 3 boostées comparables ⇒ aucune conclusion ;
//   · lecture ratée ⇒ « pas su ».
// `--prouve` : chaque règle réaffaiblie doit passer au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const SRC = path.join(__dirname, '..', 'src', 'boostRentable.js');
const CQR = path.join(__dirname, '..', 'src', 'ceQuiRapporte.js');

const MUTATIONS = {
  seuil_1: (s) => s.replace('export const SEUIL_BOOST = 3;', 'export const SEUIL_BOOST = 1;'),
  absent_non_booste: (s) => s.replace("(it.promoted === false ? 'nb' : null)", "'nb'"),
  sans_modele_commun: (s) => s.replace('const comp = lignes.filter((l) => communs.has(l.modele));', 'const comp = lignes;'),
  boost_non_deduit: (s) => s.replace('.map((l) => c2(l.prix - l.boost));', '.map((l) => l.prix);'),
  prix_sans_montant: (s) => s.replace('const pb = vb.filter((l) => l.prix != null && l.boost != null)', 'const pb = vb.filter((l) => l.prix != null).map((l) => ({ ...l, boost: l.boost || 0 }))'),
  periode_ignoree: (s) => s.replace('if (!(enLigne >= de && enLigne < a)) continue;', ''),
  annulee_comptee: (s) => s.replace('if (!o || (estAnnulee && estAnnulee(o)) || (ecarte && ecarte(o))) continue;', 'if (!o) continue;'),
  passu_vide: (s) => s.replace("if (annonces == null || !Array.isArray(ventes) || txn == null || fiches == null) return { etat: 'passu' };", 'annonces = annonces || {}; ventes = ventes || []; txn = txn || {}; fiches = fiches || {};'),
  cout_non_saisi: (s) => s.replace('R.cout = avecMontant.length ? c2(avecMontant.reduce((s, l) => s + l.boost, 0)) : null;', 'R.cout = B.length ? c2(B.reduce((s, l) => s + (l.boost || 3), 0)) : null;'),
  par_titre: (s) => s.replace("const item = tx && txn[tx] && txn[tx].item ? String(txn[tx].item) : '';", "const item = tx && txn[tx] && txn[tx].item ? String(txn[tx].item) : (Object.keys(annonces).find((k) => annonces[k] && annonces[k].title === o.title) || '');"),
  invendues_oubliees: (s) => s.replace("lignes.push({ cote, modele: m.cle, nom: m.nom, vendu: !!v,", "if (!v) continue; lignes.push({ cote, modele: m.cle, nom: m.nom, vendu: !!v,"),
};

async function charger(src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boost-'));
  fs.writeFileSync(path.join(dir, 'b.mjs'), src);
  fs.writeFileSync(path.join(dir, 'c.mjs'), fs.readFileSync(CQR, 'utf8'));
  try { return [await import(path.join(dir, 'b.mjs')), await import(path.join(dir, 'c.mjs'))]; }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

const J = 86400000, T = (j) => Date.parse('2026-09-01T00:00:00Z') + j * J;
const DE = T(0), A = T(30);
const DUNK = 'Nike Dunk Low blanc taille 42';
// LE JEU, ET LE CALCUL À LA MAIN :
//   Dunk boostées : b1 (2 €, en ligne J1, vendue J4 à 60 €), b2 (3 €, J2 → J12
//   à 70 €), b3 (promoted, sans montant, J3, invendue), b5 (promoted, sans
//   montant, J9 → J14 à 90 € : vendue, mais son coût est inconnu) ;
//   Dunk non boostées : n1 (J1 → J21 à 50 €), n2 (J4, sa vente est ANNULÉE),
//   n3 (J5, invendue) ;
//   Samba boostée b4 (1,50 €) : aucune Samba non boostée ⇒ hors comparaison ;
//   x1 sans modèle sûr ; y1 boost pas su ; z1 Dunk boostée en ligne en août
//   (hors période) ; w1 sans date ; une vente « au même titre » que b3 sans
//   transaction reliée (ne la rend pas vendue).
//   ⇒ comparables 4 boostés / 3 autres ; vendus 3/4 contre 1/3 ;
//     délai médian (3, 5, 10 j) = 5 j contre 20 j ;
//     prix médian boost déduit (58, 67 — b5 sans montant n'y entre pas) =
//     62,50 € contre 50 € ;
//     coût 2 + 3 = 5 €, montant saisi 2/4 ;
//     période : 10 annonces (b1 b2 b3 b5 n1 n2 n3 b4 x1 y1), 5 boostées, 4 non
//     boostées, 1 sans modèle, 1 pas su, 1 sans date.
function jeu({ sansB3 = false } = {}) {
  const annonces = {}, fiches = {}, ventes = [], txn = {};
  const pose = (id, title, brand, j, promoted, fees) => { annonces[id] = { id, title, brand, promoted, createdTs: j == null ? null : T(j) / 1000 }; fiches[id] = fees != null ? { fees } : {}; };
  const vend = (id, j, prix, status = 'Commande finalisée') => { const tx = 'tx-' + id; ventes.push({ transaction_id: tx, title: annonces[id].title, price: { amount: String(prix) }, status, date: new Date(T(j)).toISOString() }); txn[tx] = { item: id }; };
  pose('b1', DUNK, 'Nike', 1, false, '2'); vend('b1', 4, 60);
  pose('b2', DUNK, 'Nike', 2, null, '3,00'); vend('b2', 12, 70);
  if (!sansB3) pose('b3', 'Nike Dunk Low noir taille 41', 'Nike', 3, true, null);
  if (!sansB3) { pose('b5', DUNK, 'Nike', 9, true, null); vend('b5', 14, 90); }
  pose('n1', DUNK, 'Nike', 1, false, ''); vend('n1', 21, 50);
  pose('n2', DUNK, 'Nike', 4, false, null); vend('n2', 6, 55, 'Commande annulée');
  pose('n3', DUNK, 'Nike', 5, false, null);
  pose('b4', 'Adidas Samba noir', 'Adidas', 6, false, '1.5'); vend('b4', 7, 80);
  pose('x1', 'Article vintage', '', 7, false, null);
  pose('y1', DUNK, 'Nike', 8, null, null);
  pose('z1', DUNK, 'Nike', -12, true, '4');
  pose('w1', DUNK, 'Nike', null, false, null);
  ventes.push({ transaction_id: 'tx-orpheline', title: 'Nike Dunk Low noir taille 41', price: { amount: '99' }, status: 'Commande finalisée', date: new Date(T(9)).toISOString() });
  return { annonces, fiches, ventes, txn };
}

async function audit(src, bavard) {
  let ko = 0;
  const ok = (c, m, d) => { if (!c) ko++; if (bavard) console.log(`${c ? '✅' : '❌'} ${m}${!c && d != null ? ` — ${d}` : ''}`); };
  let M, Q;
  try { [M, Q] = await charger(src); } catch (e) { ok(false, 'le module se charge', e.message); return ko; }
  const f = M.boostRentable;
  ok(typeof f === 'function' && M.SEUIL_BOOST === 3, 'A0 la règle existe, seuil 3 boostés');
  if (typeof f !== 'function') return ko;
  const inj = {
    de: DE, a: A,
    modeleDe: (it) => Q.modeleSur(it.brand || '', it.title || ''),
    dateMiseEnLigne: (it) => (it.createdTs ? it.createdTs * 1000 : null),
    estAnnulee: (o) => /annul/i.test(o.status || ''),
    montantVente: (o) => Number(o.price.amount),
  };
  let R;
  try { R = f({ ...jeu(), ...inj }); } catch (e) { ok(false, 'la règle tourne', e.message); return ko; }
  ok(R && R.etat === 'lu', 'A1 lu');
  ok(R.total === 10 && R.boostees === 5 && R.nonBoostees === 4 && R.sansModele === 1 && R.inconnues === 1 && R.sansDate === 1, 'A2 couverture de la période : 10 annonces, 5 boostées, 4 autres, 1 sans modèle, 1 pas su, 1 sans date', JSON.stringify({ t: R.total, b: R.boostees, nb: R.nonBoostees, sm: R.sansModele, inc: R.inconnues, sd: R.sansDate }));
  ok(R.comparables && R.comparables.b === 4 && R.comparables.nb === 3 && R.assez === true && R.modeles.join() === 'Nike Dunk', 'A3 comparables : 4 Dunk boostées contre 3 Dunk non boostées (la Samba seule est écartée)', JSON.stringify({ c: R.comparables, m: R.modeles }));
  ok(R.vendues && R.vendues.b === 3 && R.vendues.nB === 4 && R.vendues.nb === 1 && R.vendues.nN === 3, 'A4 vendus 3/4 contre 1/3 (la vente annulée ne compte pas, la vente « au même titre » non plus)', JSON.stringify(R.vendues));
  ok(R.delai && R.delai.b === 5 && R.delai.nb === 20, 'A5 délai médian 5 j contre 20 j', JSON.stringify(R.delai));
  ok(R.prix && R.prix.b === 62.5 && R.prix.nb === 50 && R.prix.nb_b === 2 && R.prix.sansMontant === 1, 'A6 prix médian BOOST DÉDUIT 62,50 € (58, 67 ; la vendue sans montant dite à part) contre 50 €', JSON.stringify(R.prix));
  ok(R.cout === 5 && R.avecMontant === 2, 'A7 coût des boosts 5 €, montant saisi 2 sur 4', JSON.stringify({ cout: R.cout, m: R.avecMontant }));
  const R2 = f({ ...jeu({ sansB3: true }), ...inj });
  ok(R2.etat === 'lu' && R2.assez === false && R2.comparables.b === 2 && R2.vendues == null && R2.delai == null && R2.prix == null, 'A8 moins de 3 boostés comparables ⇒ aucune conclusion, aucun chiffre comparé', JSON.stringify({ a: R2.assez, c: R2.comparables, v: R2.vendues }));
  const j = jeu();
  ok(f({ ...j, annonces: null, ...inj }).etat === 'passu' && f({ ...j, txn: null, ...inj }).etat === 'passu' && f({ ...j, fiches: null, ...inj }).etat === 'passu' && f({ ...j, ventes: null, ...inj }).etat === 'passu', 'A9 une lecture ratée ⇒ « pas su », jamais « 0 »');
  return ko;
}

function app(ok) {
  const s = require("./_source-app.cjs").sourceAppDe(path.join(__dirname, '..', 'src', 'App.jsx')).replace(/\/\/[^\n]*/g, '');
  ok((s.match(/carte\('sv-boost'/g) || []).length === 1 && !/function BoostRentable\(|<BoostRentable/.test(s), 'B1 UNE seule carte « Boost rentable ? » (l’ancienne du volet replié est retirée)');
  ok(/modeleDe: \(it\) => modeleSur\(\(it && it\.brand\) \|\| '', \(it && it\.title\) \|\| ''\)/.test(s) && /annonces: extras\.items, ventes: ventesCoque, txn: extras\.txn, fiches, de: b\.de, a: b\.a/.test(s), 'B2 la carte passe les annonces, la période choisie et le modèle sûr (`modeleSur`)');
  ok(/Pas assez de données/.test(s) && /montant saisi \{boost\.avecMontant\}\/\{boost\.comparables\.b\}/.test(s), 'B3 « pas assez de données » et la couverture du coût sont dits');
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [nom, fn] of Object.entries(MUTATIONS)) {
      const m = fn(src);
      if (m === src) { console.log(`❌ ${nom} : la mutation ne s'applique plus`); continue; }
      const k = await audit(m, false);
      console.log(`${k ? '✅' : '❌'} mutation ${nom} : ${k} rouge(s)`);
      if (k) rouges++;
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  let ko = await audit(src, true);
  const ok = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d != null ? ` — ${d}` : ''}`); };
  app(ok);
  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ règle du boost : tout est vert');
  process.exit(ko ? 1 : 0);
})();
