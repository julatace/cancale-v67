// Audit : « VENDRE PLUS » (9 novembre) — src/vendrePlus.js et ses branchements.
//   · favoris sans vente : favoris LUS ≥ seuil, une offre lue l'écarte, « pas lu »
//     n'écarte pas et n'entre pas (favoris pas lus ⇒ aucune liste, compté à part) ;
//   · 50 annonces au MÊME titre : 50 lignes distinctes, chacune par SON identifiant,
//     jamais fusionnées ni confondues (la règle ne lit pas le titre) ;
//   · les gestes d'une paire qui dort : ceux qui existent, aucun prix, « favoris »
//     seulement si des favoris sont LUS, une raison pour chaque geste bloqué ;
//   · ce qui part vite : un groupe à moins de 5 ventes datées n'est jamais classé ;
//   · le compte qui vend le mieux : jamais sous 5 ventes, jamais sur une égalité ;
//   · la carte de Ma journée : rien à 0, rien sans date lue, « au moins » si partiel ;
//   · branchements : l'App et Statistiques importent CES règles, rien ne lance seul.
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'src', 'vendrePlus.js'), 'utf8');
const APP = require('./_source-app.cjs').sourceAppDe(path.join(R, 'src', 'App.jsx'));
const STATS = fs.readFileSync(path.join(R, 'src', 'ecrans', 'Stats.jsx'), 'utf8');

const MUTATIONS = {
  favoris_pas_lu_vaut_zero: (s) => s.replace("if (v == null || v === '' || typeof v === 'boolean') return null;", "if (v === '' || typeof v === 'boolean') return null;"),
  seuil_favoris_strict: (s) => s.replace('if (f < s) continue;', 'if (f <= s) continue;'),
  offre_lue_ignoree: (s) => s.replace('if (o != null && o > 0) continue;', ''),
  favoris_toujours_propose: (s) => s.replace('if (f != null && f > 0) g.push(', 'g.push('),
  conclure_sous_5: (s) => s.replace('const classes = avec.filter((g) => g.nDelai >= min)', 'const classes = avec.filter((g) => g.nDelai >= 1)'),
  meilleur_sans_minimum: (s) => s.replace('if (t.length < 2 || t[0].n < min || !(t[0].n > t[1].n)) return null;', 'if (t.length < 2 || !(t[0].n > t[1].n)) return null;'),
  meilleur_sur_egalite: (s) => s.replace('!(t[0].n > t[1].n)', '!(t[0].n >= t[1].n)'),
  carte_a_zero: (s) => s.replace('if (!b || !(b.n > 0)) return null;', 'if (!b) return null;'),
  carte_sans_dates: (s) => s.replace('if (!dort || !dort.seuils || !(dort.datesConnues > 0)) return null;', 'if (!dort || !dort.seuils) return null;'),
  republier_sans_raison: (s) => s.replace("bloque: ext('recreer') }", "bloque: '' }"),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `vendrePlus-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  let M;
  try { M = await charger(src); } catch (e) { dit(false, 'le module se charge', e.message); return ko || 1; }

  // ── Favoris sans vente ──
  const JEU = [
    { id: 'f1', favoris: 12, offres: null }, { id: 'f2', favoris: 5, offres: null }, { id: 'f3', favoris: 4, offres: null },
    { id: 'f4', favoris: 9, offres: 2 }, { id: 'f5', favoris: null, offres: null }, { id: 'f6', favoris: 7, offres: 0 },
    { id: 'f7', favoris: 12, offres: null }, { id: 'f8', favoris: undefined }, { id: 'f9', favoris: '6' },
  ];
  const F = M.favorisSansVente(JEU, 5);
  dit(F && F.liste.map((x) => x.id).join(',') === 'f1,f7,f6,f9,f2', 'seuil 5 : f1, f7 (12, par identifiant), f6 (7, aucune offre lue), f9 (6), f2 (5 = le seuil compte) ; f3 (4) sous le seuil ; f4 a une offre lue', F && F.liste.map((x) => x.id).join(','));
  dit(F && F.total === 9 && F.favorisLus === 7 && F.favorisPasLus === 2, '9 en ligne, 7 aux favoris lus, 2 pas lus (dans aucune liste, jamais « 0 favori »)', F && `${F.total}/${F.favorisLus}/${F.favorisPasLus}`);
  dit(F && F.offresPasLues === 4, '4 de la liste ont des offres pas lues (dit, pas compté « aucune »)', F && F.offresPasLues);
  dit(M.favorisSansVente(null) === null, 'annonces pas lues ⇒ null (jamais une liste vide)');
  dit(M.seuilFavorisValide(7) === 5 && M.seuilFavorisValide('10') === 10, 'seuil hors 3/5/10 ⇒ 5');

  // ── 50 annonces au MÊME titre ──
  const cinquante = Array.from({ length: 50 }, (_, i) => ({ id: String(900000 + i), titre: 'Nike Air Force 1 blanche 42', favoris: i % 2 ? 8 : 2, offres: i % 5 === 1 ? 1 : null }));
  const G = M.favorisSansVente(cinquante, 5);
  const ids = G ? G.liste.map((x) => x.id) : [];
  const attendus = cinquante.filter((a) => a.favoris >= 5 && a.offres !== 1).map((a) => a.id).sort();
  dit(G && ids.length === new Set(ids).size && ids.slice().sort().join(',') === attendus.join(','), `50 annonces au même titre : ${attendus.length} retenues, chacune par SON identifiant, aucune fusionnée`, `${ids.length} vs ${attendus.length}`);
  dit(G && G.total === 50, '50 au même titre = 50 comptées (jamais regroupées par titre)', G && G.total);
  dit(!/\.titre\b|\.title\b/.test(src.replace(/\/\/.*$/gm, '')), 'aucune règle du module ne lit un titre');

  // ── Les gestes d'une paire qui dort ──
  const capOk = () => 'ok';
  const g1 = M.gestesDormeuse({ numero: '12', favoris: 3, url: 'https://www.vinted.fr/items/1', cap: capOk });
  dit(g1.map((x) => x.k).join(',') === 'republier,prix,vinted,lbc,ebay,vestiaire,favoris', 'gestes : Republier · Baisser (il tape) · Vinted · Leboncoin · eBay · Vestiaire · Offre aux favoris', g1.map((x) => x.k).join(','));
  dit(g1.every((x) => !x.bloque), 'tout est permis quand l’extension est à jour, le N° posé, le lien lu');
  dit(!JSON.stringify(g1).match(/\d+\s?€|%/), 'aucun geste ne porte un prix ni un pourcentage (aucun prix conseillé)');
  const g2 = M.gestesDormeuse({ numero: '', favoris: null, url: '', cap: () => 'retard', version: (c) => ({ recreer: '5.248.0', republiermodif: '5.247.0' })[c] });
  dit(!g2.some((x) => x.k === 'favoris'), 'favoris pas lus ⇒ pas de « offre aux favoris »');
  dit(M.gestesDormeuse({ favoris: 0, cap: capOk }).every((x) => x.k !== 'favoris'), 'zéro favori lu ⇒ pas de « offre aux favoris »');
  const r = Object.fromEntries(g2.map((x) => [x.k, x.bloque]));
  dit(/5\.248\.0/.test(r.republier) && /5\.247\.0/.test(r.prix) && /lien/.test(r.vinted) && /N°/.test(r.lbc) && /N°/.test(r.vestiaire), 'chaque geste bloqué dit pourquoi (version, lien, N°)', JSON.stringify(r));

  // ── Ce qui part vite ──
  const D = { groupes: [
    { k: 'dunk', n: 9, nDelai: 8, mediane: 4 }, { k: 'samba', n: 6, nDelai: 5, mediane: 2.5 }, { k: 'tn', n: 4, nDelai: 4, mediane: 1 },
    { k: 'forum', n: 3, nDelai: 0, mediane: null }, { k: 'gazelle', n: 7, nDelai: 6, mediane: 4 },
  ] };
  const V = M.classerSansConclureTropVite(D, 5, 5);
  dit(V && V.classes.map((g) => g.k).join(',') === 'samba,dunk,gazelle', 'classés (≥ 5 datées) du plus rapide au plus lent, à égalité le plus daté : samba, dunk, gazelle', V && V.classes.map((g) => g.k).join(','));
  dit(V && V.peu.map((g) => g.k).join(',') === 'tn' && V.nPeu === 4, '« tn » (4 ventes datées, la plus rapide) montré, JAMAIS classé', V && JSON.stringify(V.peu));

  // ── Le compte qui vend le mieux ──
  dit(M.compteQuiVendLeMieux([{ k: 'a', n: 3 }, { k: 'b', n: 1 }]) === null, '3 ventes contre 1 : pas de conclusion (moins de 5)');
  dit(M.compteQuiVendLeMieux([{ k: 'a', n: 6 }, { k: 'b', n: 6 }]) === null, 'égalité : pas de meilleur');
  dit(M.compteQuiVendLeMieux([{ k: 'b', n: 2 }, { k: 'a', n: 7 }]) === 'a', '7 contre 2 : « a » vend le plus');
  dit(M.compteQuiVendLeMieux([{ k: 'a', n: 9 }]) === null, 'un seul compte : rien à comparer');

  // ── Le brut par compte ──
  const B = M.brutParCompte([{ k: 'Vinted|x', brut: 40, nCout: 2, n: 3 }, { k: 'Vinted|y', brut: null, nCout: 0, n: 2 }, { k: '', brut: 5 }]);
  dit(B && B['Vinted|x'].brut === 40 && B['Vinted|x'].nCout === 2 && B['Vinted|y'].brut === null && !('' in B), 'brut repris tel quel avec sa couverture ; sans prix d’achat ⇒ null (« — ») ; « Autres » écarté');
  dit(M.cleBrutCompte('Vinted', 'x') === 'Vinted|x' && M.cleBrutCompte('Leboncoin', 'z') === 'Leboncoin', 'clé : Vinted|compte, sinon le site');

  // ── La carte de Ma journée ──
  const dort = { total: 10, datesConnues: 8, seuils: { 30: { n: 4 }, 60: { n: 0 }, 90: { n: 0 } } };
  const c30 = M.cartePairesQuiDorment(dort, 30);
  dit(c30 && c30.n === 4 && c30.partiel === true, '30 j : 4, partiel (8 dates sur 10) ⇒ « au moins »', JSON.stringify(c30));
  dit(M.cartePairesQuiDorment(dort, 60) === null, '0 à 60 j ⇒ pas de carte');
  dit(M.cartePairesQuiDorment({ total: 3, datesConnues: 0, seuils: { 30: { n: 2 } } }, 30) === null && M.cartePairesQuiDorment(null) === null, 'aucune date lue / rien lu ⇒ pas de carte');

  // ── Compteurs ──
  dit(M.texteCompteur(null, 'vue', 'vues', 'vues pas lues') === 'vues pas lues' && M.texteCompteur(0, 'favori', 'favoris') === '0 favori' && M.texteCompteur(3, 'favori', 'favoris') === '3 favoris', '« pas lu » ≠ 0 ; 0 lu s’écrit 0');
  return ko;
}

function branchements(bavard) {
  let ko = 0;
  const dit = (c, m) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m); };
  dit(/from "\.\/vendrePlus\.js"/.test(APP) && /favorisSansVente\(/.test(APP) && /gestesDormeuse\(/.test(APP) && /cartePairesQuiDorment\(/.test(APP), 'App : favoris sans vente, gestes et carte de Ma journée viennent de src/vendrePlus.js');
  dit(/id: 'paires-dorment'[^\n]*avant: \(\) => demanderVue\('dorment'\)/.test(APP), 'Ma journée : la carte ouvre Annonces → À relancer (rien ne part)');
  const feuille = APP.slice(APP.indexOf('{dortAgir && (()=>{'), APP.indexOf('{dortAgir && (()=>{') + 5000);
  dit(!/vmrCmd|vmrExec|fetch\(/.test(feuille), 'la feuille « Agir » n’appelle ni l’extension ni le réseau : elle ouvre les écrans existants');
  dit(/from '\.\.\/vendrePlus\.js'/.test(STATS) && /classerSansConclureTropVite\(/.test(STATS) && /compteQuiVendLeMieux\(/.test(STATS), 'Statistiques : part vite et meilleur compte par les règles du module');
  dit(/classementRapporte\(lp, 'compte'\)/.test(STATS), 'Statistiques : le brut par compte vient de `classementRapporte` (la règle du bénéfice brut)');
  dit(/marqueLue: String\(\(it && it\.brand\) \|\| ''\)/.test(STATS), 'la marque de « part vite » est celle LUE sur l’annonce (jamais devinée du titre)');
  return ko;
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  const ko = (await audit(SRC, true)) + branchements(true);
  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ vendre plus : tout est tenu');
  if (prouve) {
    let tenues = 0;
    for (const [nom, mut] of Object.entries(MUTATIONS)) {
      const s = mut(SRC);
      if (s === SRC) { console.log(`❌ mutation ${nom} : ne s’applique pas`); continue; }
      const k = await audit(s, false);
      console.log(k ? `✅ mutation ${nom} ⇒ rouge (${k})` : `❌ mutation ${nom} ⇒ resté vert`);
      if (k) tenues++;
    }
    console.log(`${tenues}/${Object.keys(MUTATIONS).length} mutations attrapées`);
    if (tenues < Object.keys(MUTATIONS).length) process.exit(1);
  }
  process.exit(ko ? 1 : 0);
})();
