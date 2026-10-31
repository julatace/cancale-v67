// Audit : « LE BOOST EST-IL RENTABLE ? » (src/boostRentable.js, 21 octobre).
//
// On EXÉCUTE la règle pure sur des ventes inventées et on juge ce qu'elle REND :
//   · une vente se relie à son annonce par la TRANSACTION — deux paires au
//     même titre, l'une boostée, l'autre non, ne se mélangent jamais ;
//   · boostée = `promoted === true` OU un « Boost payé » saisi > 0 ;
//     `promoted` absent sans montant = « pas su », ni d'un côté ni de l'autre ;
//   · on ne compare que dans les MÊMES tranches de prix ;
//   · moins de 5 de chaque côté ⇒ aucun chiffre comparé (`assez: false`) ;
//   · la marge d'une boostée déduit le montant saisi, et sans montant : pas de marge ;
//   · lecture ratée (txn, annonces ou fiches null) ⇒ « pas su ».
// `--prouve` rejoue l'audit sur des règles RÉAFFAIBLIES : chacune doit le faire
// passer au rouge (« le module n'existait pas avant » ne prouve rien seul).
const fs = require('fs'), path = require('path'), os = require('os');
const SRC = path.join(__dirname, '..', 'src', 'boostRentable.js');

const MUTATIONS = {
  seuil: (s) => s.replace('export const SEUIL_BOOST = 5;', 'export const SEUIL_BOOST = 1;'),
  absent_non_booste: (s) => s.replace("(it.promoted === false ? 'nb' : null)", "'nb'"),
  sans_tranche: (s) => s.replace('const comp = lignes.filter((l) => communes.has(l.t));', 'const comp = lignes;'),
  boost_non_deduit: (s) => s.replace('const coutBoost = cote === \'b\' ? boost : 0;', 'const coutBoost = 0;'),
  marge_sans_montant: (s) => s.replace('const coutBoost = cote === \'b\' ? boost : 0;', "const coutBoost = cote === 'b' ? (boost || 0) : 0;"),
  passu_vide: (s) => s.replace('if (!Array.isArray(ventes) || txn == null || items == null || fiches == null) return { etat: \'passu\' };', "if (!Array.isArray(ventes)) return { etat: 'passu' }; txn = txn || {}; items = items || {}; fiches = fiches || {};"),
  cout_non_saisi_compte: (s) => s.replace('coutC += Math.round(boost * 100);', 'coutC += Math.round((boost || 3) * 100);').replace('if (boost != null) { R.avecMontant += 1;', '{ if (boost != null) R.avecMontant += 1;'),
  par_titre: (s) => s.replace("const it = itemId ? items[itemId] : null;", "const it = (itemId ? items[itemId] : null) || Object.values(items).find((x) => x && x.title === o.title) || null;"),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `boostRentable-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

const J = 86400000;
const BASE = Date.parse('2026-09-01T00:00:00Z');
// Fabrique un jeu : `nb` boostées et `nnb` non boostées, prix 50 € (tranche 30-60).
function jeu({ nb = 6, nnb = 6, montant = '3', achat = '20', prixB = 50, prixNB = 50, inconnues = 0 } = {}) {
  const ventes = [], txn = {}, items = {}, fiches = {};
  let i = 0;
  const pose = (cote, prix, promoted) => {
    i += 1;
    const id = `it${i}`, tx = `tx${i}`;
    const enLigne = BASE + i * J;
    const delaiJ = cote === 'b' ? 3 : 10;
    ventes.push({ transaction_id: tx, title: 'Nike air max taille 42', price: { amount: String(prix) }, status: 'Commande finalisée', date: new Date(enLigne + delaiJ * J).toISOString() });
    txn[tx] = { item: id };
    items[id] = { id, title: 'Nike air max taille 42', promoted, views: cote === 'b' ? 200 : 80, favourites: cote === 'b' ? 12 : 4, createdTs: enLigne / 1000 };
    fiches[id] = { buyPrice: achat, fees: cote === 'b' ? montant : '' };
  };
  for (let k = 0; k < nb; k++) pose('b', prixB, k % 2 === 0 ? true : false); // une sur deux : boost prouvé seulement par le montant saisi
  for (let k = 0; k < nnb; k++) pose('nb', prixNB, false);
  for (let k = 0; k < inconnues; k++) { i += 1; const id = `it${i}`, tx = `tx${i}`; ventes.push({ transaction_id: tx, title: 'x', price: { amount: '50' }, status: 'ok', date: new Date(BASE).toISOString() }); txn[tx] = { item: id }; items[id] = { id, promoted: null, createdTs: BASE / 1000 }; fiches[id] = {}; }
  return { ventes, txn, items, fiches };
}
const inj = {
  estAnnulee: (o) => /annul/i.test(o.status || ''),
  montantVente: (o) => Number(o.price.amount),
  dateMiseEnLigne: (it) => (it.createdTs ? it.createdTs * 1000 : null),
  prixAchat: (f) => (f && f.buyPrice ? Number(f.buyPrice) : null),
};

async function audit(src, bavard) {
  let ko = 0;
  const ok = (c, m, d) => { if (!c) ko++; if (bavard) console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ` — ${d}` : ''}`); };
  let M;
  try { M = await charger(src); } catch (e) { ok(false, 'le module se charge', e.message); return ko; }
  const essaie = (m, f) => { try { f(); } catch (e) { ok(false, m, e.message); } };
  const { boostRentable } = M;

  essaie('A. jeu suffisant', () => {
    const R = boostRentable({ ...jeu(), ...inj });
    ok(R.etat === 'lu', 'A1 lu', R.etat);
    ok(R.boostees === 6 && R.avecMontant === 6 && R.nonBoostees === 6, 'A2 6 boostées (6 avec montant), 6 non boostées', JSON.stringify([R.boostees, R.avecMontant, R.nonBoostees]));
    ok(R.assez === true, 'A3 assez pour juger');
    ok(R.coutBoost === 18, 'A6 coût des boosts saisis des paires vendues : 6 × 3 € = 18 €', R.coutBoost);
    ok(R.delai.b === 3 && R.delai.nonb === 10, 'A4 délai médian 3 j contre 10 j', JSON.stringify(R.delai));
    ok(R.vues.b === 200 && R.favoris.nonb === 4, 'A5 vues et favoris', JSON.stringify([R.vues, R.favoris]));
    ok(R.marge.b === 27 && R.marge.nonb === 30, 'A6 marge : 50 − 20 − 3 (boost) = 27 contre 30', JSON.stringify(R.marge));
  });
  essaie('B. sous le seuil', () => {
    const R = boostRentable({ ...jeu({ nb: 4 }), ...inj });
    ok(R.assez === false, 'B1 4 boostées ⇒ pas assez');
    ok(R.delai.b === null && R.delai.nonb === null && R.marge.b === null, 'B2 aucun chiffre comparé', JSON.stringify(R.delai));
  });
  essaie('C. tranches', () => {
    // boostées à 120 €, non boostées à 50 € : aucune tranche commune.
    const R = boostRentable({ ...jeu({ prixB: 120 }), ...inj });
    ok(R.comparables.b === 0 && R.assez === false, 'C1 aucune tranche commune ⇒ rien de comparé', JSON.stringify(R.comparables));
  });
  essaie('D. « pas su »', () => {
    const R = boostRentable({ ...jeu({ inconnues: 3 }), ...inj });
    ok(R.inconnues === 3 && R.nonBoostees === 6, 'D1 promoted absent sans montant ⇒ ni boostée ni non boostée', JSON.stringify([R.inconnues, R.nonBoostees]));
    const j = jeu();
    ok(boostRentable({ ...j, txn: null, ...inj }).etat === 'passu', 'D2 transactions illisibles ⇒ pas su');
    ok(boostRentable({ ...j, items: null, ...inj }).etat === 'passu', 'D3 annonces illisibles ⇒ pas su');
    ok(boostRentable({ ...j, fiches: null, ...inj }).etat === 'passu', 'D4 fiches illisibles ⇒ pas su');
  });
  essaie('E. marge sans montant', () => {
    // boostées par `promoted` seulement : aucun montant ⇒ aucune marge de boostée.
    const j = jeu();
    for (const id of Object.keys(j.fiches)) if (j.items[id].promoted !== false || j.fiches[id].fees) { j.fiches[id].fees = ''; j.items[id].promoted = true; }
    const R = boostRentable({ ...j, ...inj });
    ok(R.boostees === 6 && R.avecMontant === 0, 'E1 6 boostées, aucune avec montant', JSON.stringify([R.boostees, R.avecMontant]));
    ok(R.marge.nb === 0 && R.marge.b === null, 'E2 marge des boostées inconnue', JSON.stringify(R.marge));
    ok(R.coutBoost === 0 && R.avecMontant === 0, 'E4 aucun montant saisi : coût 0 sur 0 (l’écran dit « — »)', R.coutBoost);
    ok(R.delai.b === 3, 'E3 le délai, lui, reste comparé');
  });
  essaie('F. identité, jamais le titre', () => {
    // 6 non boostées + 6 boostées SANS transaction reliée, au même titre qu'une annonce boostée.
    const j = jeu({ nb: 6 });
    for (const v of j.ventes.slice(0, 6)) delete j.txn[v.transaction_id];
    const R = boostRentable({ ...j, ...inj });
    ok(R.sansAnnonce === 6 && R.boostees === 0, 'F1 vente sans transaction reliée ⇒ pas reliée (pas de titre)', JSON.stringify([R.sansAnnonce, R.boostees]));
  });
  essaie('G. annulées', () => {
    const j = jeu(); j.ventes[0].status = 'Commande annulée';
    const R = boostRentable({ ...j, ...inj });
    ok(R.total === 11 && R.boostees === 5, 'G1 une vente annulée ne compte pas', JSON.stringify([R.total, R.boostees]));
  });
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [nom, f] of Object.entries(MUTATIONS)) {
      const m = f(src);
      if (m === src) { console.log(`❌ ${nom} : la mutation ne s'applique plus`); continue; }
      const k = await audit(m, false);
      console.log(`${k ? '✅' : '❌'} mutation ${nom} : ${k} rouge(s)`);
      if (k) rouges++;
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  const ko = await audit(src, true);
  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ règle du boost : tout est vert');
  process.exit(ko ? 1 : 0);
})();
