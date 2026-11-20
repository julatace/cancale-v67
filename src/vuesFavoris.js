// ── LES VUES ET LES FAVORIS DES ANNONCES EN LIGNE (20 nov. 2026, chantier « ce qui manque ») ──────────────────────
// MESURÉ sur la vraie base (20 nov., lecture seule, projections scalaires) : chaque annonce du dressing Vinted rangé par
// l'extension (`harvest_{uid}_listings`) porte DÉJÀ `view_count` et `favourite_count` (11 comptes, 407 annonces : 407
// avec les deux champs ; ~2 % de `view_count: 0`, que Vinted envoie quand il ne donne plus le nombre — « pas su », jamais
// un zéro, src/App.jsx `mapWardrobeItem`). AUCUNE requête de plus : on lit ce que le dressing lu porte.
// Leboncoin : la page « Mes annonces » ne les donne pas (`counters` vide, 0 annonce sur 194 avec des chiffres) ; seuls les
// chiffres de la page « Statistiques » d'une annonce (ext. `lbcStatsAnnonce`, `stats.{vues,favoris}`) comptent.
// Vestiaire : `favoris` rangé mais vide (3 sur 3), aucune vue. Ce qu'un site ne donne pas s'écrit « — · pas fourni ».
//
// 1. LE JOURNAL (`vrm_vues_lues`, synchronisé sur `main`) : UN POINT DATÉ PAR LECTURE qui change quelque chose —
//      { v: 1, debut: 'AAAA-MM-JJ', a: { 'vinted#123': [[ms, vues|null, favoris|null], …] } }
//    daté par la lecture de SON compte (`lu` : l'heure du dressing qui fait foi, jamais l'heure de l'écran). Une lecture
//    plus ancienne que le dernier point, ou sans date, n'écrit rien. Une valeur pas sue (null) ne remplace JAMAIS une
//    valeur lue : le dernier chiffre connu reste (`dernierConnu`). Une lecture ratée (aucune annonce) n'écrit rien.
// 2. LA PUBLICATION (`vrm_vues_favoris`, cet appareil) : l'écran Annonces (le seul propriétaire, §11) publie les totaux
//    de ses annonces EN LIGNE (la règle de chaque site) et ce qu'elles ont gagné AUJOURD'HUI (jour de Paris : le dernier
//    point d'avant aujourd'hui, comparé au dernier point lu) ; Aujourd'hui la lit, ne recalcule rien. Couverture dite
//    (« sur N annonces ») ; une lecture d'un site manquante ⇒ « au moins ». Lecture ratée ⇒ rien publié (la publication
//    d'avant reste, avec son heure).
// Module PUR (hors `publier`/`lire`) : scripts/audit-vues-stock.cjs exécute ces fonctions.
import { jourParis } from './dateParis.js';

export const CLE_VUES_LUES = 'vrm_vues_lues';
export const CLE_VUES_FAVORIS = 'vrm_vues_favoris';
export const EVT_VUES_FAVORIS = 'vrm:vues-favoris';
export const MAX_POINTS = 8;
export const MAX_ANNONCES = 1500;

const str = (v) => String(v == null ? '' : v).trim();
const nb = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const journalLisible = (j) => !!j && typeof j === 'object' && j.v === 1 && j.a && typeof j.a === 'object' && !Array.isArray(j.a);
export const cleAnnonce = (a) => (a && a.site && a.id != null ? str(a.site) + '#' + str(a.id) : '');

// Le dernier chiffre CONNU d'une série (champ 1 = vues, 2 = favoris), avec sa date. `avant` : ne regarder que les points
// d'avant cet instant (exclu). Rend { v, t } ou null.
export function dernierConnu(serie, champ, { avantJour = '' } = {}) {
  const L = Array.isArray(serie) ? serie : [];
  for (let k = L.length - 1; k >= 0; k--) {
    const p = L[k];
    if (!Array.isArray(p) || !Number.isFinite(p[0])) continue;
    if (avantJour && !(jourParis(p[0]) < avantJour)) continue;
    const v = nb(p[champ]);
    if (v != null) return { v, t: p[0] };
  }
  return null;
}

// Ajoute au journal ce qu'une lecture apprend. `annonces` : [{ site, id, lu (ms), vues, favoris }]. Rend { journal, ajoutes }
// — le MÊME objet si rien n'a changé.
export function noterVuesLues(journal, annonces, { maintenant = Date.now() } = {}) {
  const base = journalLisible(journal) ? journal : { v: 1, debut: jourParis(maintenant), a: {} };
  const a = { ...base.a };
  let ajoutes = 0;
  for (const x of (Array.isArray(annonces) ? annonces : [])) {
    const k = cleAnnonce(x); if (!k) continue;
    const ts = Number(x.lu);
    if (!Number.isFinite(ts) || ts <= 0 || ts > maintenant + 60000) continue;
    const vues = nb(x.vues), fav = nb(x.favoris);
    if (vues == null && fav == null) continue;              // rien de lu : rien n'est écrit (jamais un blanc par-dessus un chiffre)
    const L = Array.isArray(a[k]) ? a[k] : [];
    const der = L[L.length - 1];
    if (der && ts <= der[0]) continue;                      // une lecture en retard ne réécrit pas l'histoire
    const dv = dernierConnu(L, 1), df = dernierConnu(L, 2);
    if ((vues == null || (dv && dv.v === vues)) && (fav == null || (df && df.v === fav))) continue;   // rien de neuf
    let n = [...L, [Math.round(ts), vues, fav]];
    if (n.length > MAX_POINTS) n = n.slice(n.length - MAX_POINTS);
    a[k] = n; ajoutes += 1;
  }
  if (!ajoutes) return { journal: base === journal ? journal : base, ajoutes: 0 };
  let ids = Object.keys(a);
  if (ids.length > MAX_ANNONCES) {
    ids.sort((x, y) => a[y][a[y].length - 1][0] - a[x][a[x].length - 1][0]);
    for (const k of ids.slice(MAX_ANNONCES)) delete a[k];
  }
  return { journal: { v: 1, debut: base.debut || jourParis(maintenant), a }, ajoutes };
}

// Les totaux des annonces EN LIGNE des articles (src/articles/modele.js : `articles[].annonces[]`, l'état de CHAQUE
// site par SA règle). Les vues et les favoris sont ceux de chaque annonce (deux sites = deux publics : ils s'ajoutent) ;
// `manque` : des sites pas lus ⇒ « au moins ». `journal` : ce qu'elles ont gagné aujourd'hui.
// Rend { vues, favoris, nAnnonces, manque } où vues/favoris = { total, n (annonces au chiffre lu), gagnes, nGagnes } ;
// total null = aucun chiffre lu (« — »).
export function vuesFavorisEnLigne(articles, journal, { maintenant = Date.now(), manque = false } = {}) {
  const J = journalLisible(journal) ? journal.a : {};
  const aujourdhui = jourParis(maintenant);
  const acc = () => ({ total: 0, n: 0, gagnes: 0, nGagnes: 0 });
  const V = acc(), F = acc();
  let nAnnonces = 0;
  const ajoute = (S, v, serie, champ) => {
    if (v == null) return;
    S.total += v; S.n += 1;
    const avant = dernierConnu(serie, champ, { avantJour: aujourdhui });
    if (avant) { S.gagnes += v - avant.v; S.nGagnes += 1; }
  };
  for (const art of (Array.isArray(articles) ? articles : [])) {
    for (const an of (art && Array.isArray(art.annonces) ? art.annonces : [])) {
      if (!an || an.etat !== 'enligne') continue;
      nAnnonces += 1;
      const serie = J[cleAnnonce(an)];
      ajoute(V, nb(an.vues), serie, 1);
      ajoute(F, nb(an.favoris), serie, 2);
    }
  }
  const fin = (S) => ({ total: S.n ? S.total : null, n: S.n, gagnes: S.nGagnes ? S.gagnes : null, nGagnes: S.nGagnes });
  return { vues: fin(V), favoris: fin(F), nAnnonces, manque: !!manque };
}

// ── Publication (un propriétaire : l'écran Annonces ; un lecteur : Aujourd'hui) ─────
export function publierVuesFavoris(r, { owner = '', maintenant = Date.now() } = {}) {
  if (!r || !Number.isFinite(r.nAnnonces)) return false;    // lecture ratée : la publication d'avant reste
  const p = { ...r, owner: String(owner || ''), at: maintenant };
  try {
    const avant = JSON.parse(localStorage.getItem(CLE_VUES_FAVORIS) || 'null');
    if (avant && JSON.stringify({ ...avant, at: 0 }) === JSON.stringify({ ...p, at: 0 })) return false;
    localStorage.setItem(CLE_VUES_FAVORIS, JSON.stringify(p));
  } catch (_) { return false; }
  try { window.dispatchEvent(new CustomEvent(EVT_VUES_FAVORIS, { detail: p })); } catch (_) {}
  return true;
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — »).
export function lireVuesFavoris(owner = '') {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_VUES_FAVORIS) || 'null');
    if (!p || typeof p !== 'object' || String(p.owner || '') !== String(owner || '') || !Number.isFinite(p.nAnnonces)) return null;
    return p;
  } catch (_) { return null; }
}
