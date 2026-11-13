// ════════════════════════════════════════════════════════════════════════════
//  REGROUPER PAR COMPTE LES LISTES FLOUTÉES (11 nov., 22 h 10 — Julien)
//  « C'est très bien de flouter les ventes et infos des autres comptes lorsqu'on
//  est connecté à un compte ou qu'on regarde un compte, mais les ventes ne sont
//  pas regroupées et donc ce n'est pas très lisible : peux-tu regrouper ça
//  mieux ».
//
//  LA RÈGLE (une, §11) — elle SUIT LE FLOU, elle n'en refait aucun :
//   · l'écran passe SON prédicat de flou (`floute`) : la même fonction qui pose
//     STYLE_FLOU sur la ligne. Le regroupement ne décide jamais seul qu'une ligne
//     est « à un autre compte » ;
//   · groupe 1 « compte ouvert » : les lignes NETTES portées par le compte ouvert ;
//   · groupe 2 « compte pas relevé » : les lignes NETTES qui ne portent pas ce
//     compte (une ligne sans compte relevé n'est jamais floutée : on ne
//     l'attribue à personne) ;
//   · puis UN groupe par AUTRE compte (les lignes floutées), REPLIÉ par défaut,
//     dans l'ordre de leur ligne la plus récente ;
//   · DANS chaque groupe, l'ordre reçu est conservé (le plus récent en haut,
//     `ordreRecent`, src/ordreRecent.js) — rien n'est retrié ;
//   · aucune ligne ne disparaît, aucune n'est en double : la somme des groupes est
//     la liste reçue (scripts/audit-regroupe-comptes.cjs le compte) ;
//   · « pas su » (aucun compte ouvert) ou aucune ligne floutée ⇒ `null` : la
//     liste reste EXACTEMENT comme avant, aucun en-tête trompeur.
//
//  ⚠️ Ceci REMPLACE, seulement quand un compte est ouvert ET que des lignes sont
//  floutées, la règle du 9 nov. « tous comptes mélangés » (lot AJ) : c'est la
//  dernière demande de Julien. Sans compte ouvert (« Tous les comptes »,
//  téléphone, lecture seule), la liste reste mélangée, du plus récent au plus vieux.
//  Module PUR : l'app et les bancs lisent les mêmes fonctions.
// ════════════════════════════════════════════════════════════════════════════

const chaine = (v) => String(v == null ? '' : v).trim();

// → null (rien à regrouper) | { ouvert, tete:[], sans:[], autres:[{ compte, lignes }] }
export function grouperParCompte(lignes, { ouvert, floute, compteDe } = {}) {
  const L = Array.isArray(lignes) ? lignes : [];
  const o = chaine(ouvert);
  if (!o || typeof floute !== 'function' || typeof compteDe !== 'function') return null;
  const tete = [], sans = [], parCompte = new Map();
  for (const l of L) {
    if (floute(l)) {
      const c = chaine(compteDe(l));
      if (!parCompte.has(c)) parCompte.set(c, []);
      parCompte.get(c).push(l);
    } else if (chaine(compteDe(l)) === o) tete.push(l);
    else sans.push(l);
  }
  if (!parCompte.size) return null;
  return { ouvert: o, tete, sans, autres: [...parCompte].map(([compte, ls]) => ({ compte, lignes: ls })) };
}

// Les nombres que disent les en-têtes : la somme est TOUJOURS la liste reçue.
export function comptesDesGroupes(g) {
  if (!g) return null;
  const nAutres = g.autres.reduce((s, x) => s + x.lignes.length, 0);
  return { tete: g.tete.length, sans: g.sans.length, autres: nAutres, comptes: g.autres.length, total: g.tete.length + g.sans.length + nAutres };
}

// La liste À DESSINER, en entrées plates : une ligne, ou un repère d'en-tête.
//   { ligne }                                   — une ligne (ordre conservé)
//   { tete: 'ouvert'|'sans', n }                — en-tête d'un groupe net
//   { tete: 'autres', n, comptes }              — « Autres comptes · 3 comptes · 42 »
//   { tete: 'compte', compte, n, deplie }       — un autre compte (bouton replié)
//   { sansDate: n }                             — « N sans date » (en bas de son groupe)
// `deplies` : l'ensemble des comptes dépliés. `quand` (facultatif) : la date de la
// ligne, pour dire où commencent les lignes sans date DANS chaque groupe.
// `max` : nombre de lignes NETTES dessinées (la tranche « Afficher les suivantes »
// de l'écran) ; les autres comptes ne s'affichent qu'une fois les lignes nettes
// toutes dessinées — ils sont EN BAS de la liste, comme une suite.
// `maxCompte` : lignes dessinées par compte déplié.
export function entreesGroupees(g, { deplies, quand, max = Infinity, maxCompte = 60 } = {}) {
  if (!g) return null;
  const D = deplies instanceof Set ? deplies : new Set(deplies || []);
  const out = [];
  let netDessinees = 0;
  const groupe = (lignes, limite) => {
    const ls = lignes.slice(0, limite);
    let marque = false;
    for (const l of ls) {
      if (!marque && quand && quand(l) == null) {
        const n = lignes.filter((x) => quand(x) == null).length;
        if (n) out.push({ sansDate: n });
        marque = true;
      }
      out.push({ ligne: l });
    }
    return ls.length;
  };
  if (g.tete.length) { out.push({ tete: 'ouvert', n: g.tete.length }); netDessinees += groupe(g.tete, max); }
  if (g.sans.length && netDessinees < max) { out.push({ tete: 'sans', n: g.sans.length }); netDessinees += groupe(g.sans, max - netDessinees); }
  const nNets = g.tete.length + g.sans.length;
  if (netDessinees < nNets) return { entrees: out, nets: nNets, netsDessinees: netDessinees };
  const c = comptesDesGroupes(g);
  out.push({ tete: 'autres', n: c.autres, comptes: c.comptes });
  for (const a of g.autres) {
    const dep = D.has(a.compte);
    out.push({ tete: 'compte', compte: a.compte, n: a.lignes.length, deplie: dep });
    if (dep) {
      groupe(a.lignes, maxCompte);
      if (a.lignes.length > maxCompte) out.push({ suite: a.compte, n: a.lignes.length - maxCompte });
    }
  }
  return { entrees: out, nets: nNets, netsDessinees: netDessinees };
}

// Le mot qui suit le nombre : « 1 vente », « 12 ventes ».
export const unites = Object.freeze({
  vente: ['vente', 'ventes'], achat: ['achat', 'achats'], annonce: ['annonce', 'annonces'],
});
export function nombreDe(n, unite) {
  const u = unites[unite] || [unite, unite + 's'];
  return `${n} ${n === 1 ? u[0] : u[1]}`;
}
