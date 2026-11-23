// ── src/natif/ecrans/annoncesComptes.js — la liste Annonces DIVISÉE PAR COMPTE (20 nov.) ─────────────────────────────
// Julien, 20 nov. : « divise par comptes ». Un groupe par compte (pseudo · site · « 23 annonces »), la même rangée dedans.
// Une VUE : aucune règle neuve. Les articles reçus sont déjà au site, à l'état et à la recherche choisis (les règles de
// src/articles/modele.js) ; ici on les RANGE sous chaque compte où ils ont une annonce — c'est une liste d'annonces : une
// paire en ligne sur deux comptes est sous les deux.
// Ordre : Vinted, Leboncoin, eBay, Vestiaire ; dans un site, le compte qui a le plus d'annonces d'abord (puis son nom).
// Un article sans annonce d'un compte (à publier) va dans le groupe « sans compte », en dernier.
const ORDRE_SITES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];

export function groupesParCompte(articles, site = 'tous') {
  const m = new Map();
  const sans = { cle: 'sans', site: '', compte: '', pseudo: '', articles: [] };
  for (const a of Array.isArray(articles) ? articles : []) {
    const vus = new Set();
    for (const x of Array.isArray(a.annonces) ? a.annonces : []) {
      if (site && site !== 'tous' && x.site !== site) continue;
      if (!x.compte) continue;
      const cle = x.site + ':' + x.compte;
      if (vus.has(cle)) continue;
      vus.add(cle);
      if (!m.has(cle)) m.set(cle, { cle, site: x.site, compte: String(x.compte), pseudo: x.pseudo || '', articles: [] });
      const g = m.get(cle);
      if (!g.pseudo && x.pseudo) g.pseudo = x.pseudo;
      g.articles.push(a);
    }
    if (!vus.size) sans.articles.push(a);
  }
  const l = [...m.values()].sort((x, y) => (ORDRE_SITES.indexOf(x.site) - ORDRE_SITES.indexOf(y.site))
    || (y.articles.length - x.articles.length) || (x.pseudo || x.compte).localeCompare(y.pseudo || y.compte, 'fr'));
  if (sans.articles.length) l.push(sans);
  return l;
}

// Les groupes repliés (le choix de CET appareil : une commodité d'affichage, jamais une donnée).
const CLE_REPLIS = 'vrm_annonces_replis';
export function lireReplis() { try { const v = JSON.parse(localStorage.getItem(CLE_REPLIS) || '[]'); return new Set(Array.isArray(v) ? v.map(String) : []); } catch (_) { return new Set(); } }
export function ecrireReplis(s) { try { localStorage.setItem(CLE_REPLIS, JSON.stringify([...s])); } catch (_) { /* stockage bloqué : le choix vit le temps de la page */ } }
