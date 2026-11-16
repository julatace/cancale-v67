// ════════════════════════════════════════════════════════════════════════════
//  INDEX DES VENTES, CALCULÉ UNE FOIS PAR VERSION DES DONNÉES (16 nov., lot vitesse-moteur)
//
//  Mesuré à 20 000 ventes (téléphone 390, processeur ×4, profil du démarrage) : le moteur
//  `Comptabilite` se rend 20 à 40 fois par ouverture, et à CHAQUE rendu plusieurs listes
//  (« À envoyer », « Envoyés », les cartes « Partis » de Ma journée) reparcouraient les
//  20 000 ventes pour n'en garder que quelques dizaines : celles des 45 derniers jours, celles
//  qu'il faut expédier, celles qu'un transporteur a prises en charge.
//
//  Ce module ne décide RIEN : il rend, pour une liste de ventes (la même pour toutes les instances
//  du moteur : le magasin partagé `_magasinCommandes`), un SUR-ENSEMBLE des lignes qu'une règle
//  peut garder, DANS L'ORDRE DE LA LISTE. L'appelant applique ensuite SA règle, inchangée, sur ce
//  sous-ensemble : mêmes lignes gardées, même ordre, donc mêmes chiffres.
//   · `recentesOuSansDate(items, jours, msDe)` : les ventes dont la date est à moins de jours + 2
//     jours de maintenant (une marge : l'appelant relit `Date.now()` lui-même), PLUS toutes celles
//     sans date, à la date illisible (NaN) ou qui ne sont pas un objet — elles passent les fenêtres
//     « il y a N jours » selon la règle de chaque appelant (`j == null`, `NaN > 45` est faux…).
//   · `filtreParVersion(items, nom, garder, ver)` : les ventes pour lesquelles `garder(o)` est vrai,
//     gardé tant que `ver` ne change pas. Seulement pour une règle PURE de la vente et de `ver`
//     (ex. `aExpedier` : la vente et `TXN_ETATS.ver`, rien d'autre — lot vitesse-volume).
//   · `parTransaction(items)` : n° de transaction (texte) ⇒ positions dans la liste.
//
//  La mémoire est gardée PAR LISTE (WeakMap : une liste relue est un objet neuf ⇒ index neuf ;
//  une liste oubliée part avec elle). Une liste n'est jamais modifiée en place dans l'app (vérifié :
//  aucun push/splice/sort sur `sales.items`) ; par prudence, une longueur différente refait l'index.
// ════════════════════════════════════════════════════════════════════════════
const JOUR = 86400000;
const parListe = new WeakMap();

const entree = (items) => {
  let e = parListe.get(items);
  if (!e || e.n !== items.length) { e = { n: items.length }; parListe.set(items, e); }
  return e;
};

// Les dates, triées de la plus récente à la plus ancienne, et les lignes « spéciales ».
const datesDe = (items, msDe) => {
  const e = entree(items);
  if (e.dates && e.msDe === msDe) return e;
  const dates = [], speciales = [];
  for (let i = 0; i < items.length; i++) {
    const o = items[i];
    if (!o || typeof o !== 'object' || !o.date) { speciales.push(i); continue; }
    const ms = msDe(o);
    if (!Number.isFinite(ms)) { speciales.push(i); continue; }
    dates.push(ms, i);
  }
  // Paires (ms, i) aplaties, triées par ms décroissant.
  const n = dates.length / 2, ordre = new Array(n);
  for (let k = 0; k < n; k++) ordre[k] = k;
  ordre.sort((a, b) => dates[2 * b] - dates[2 * a]);
  const ms = new Float64Array(n), pos = new Int32Array(n);
  for (let k = 0; k < n; k++) { ms[k] = dates[2 * ordre[k]]; pos[k] = dates[2 * ordre[k] + 1]; }
  e.dates = { ms, pos }; e.speciales = speciales; e.msDe = msDe;
  return e;
};

export function recentesOuSansDate(items, jours, msDe, maintenant = Date.now()) {
  if (!Array.isArray(items)) return [];
  const e = datesDe(items, msDe);
  const seuil = maintenant - (jours + 2) * JOUR;
  const { ms, pos } = e.dates;
  // Recherche du premier indice dont la date est ≤ seuil (ms décroissant).
  let lo = 0, hi = ms.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ms[mid] > seuil) lo = mid + 1; else hi = mid; }
  const idx = e.speciales.slice();
  for (let k = 0; k < lo; k++) idx.push(pos[k]);
  idx.sort((a, b) => a - b);
  const out = new Array(idx.length);
  for (let k = 0; k < idx.length; k++) out[k] = items[idx[k]];
  return out;
}

export function filtreParVersion(items, nom, garder, ver) {
  if (!Array.isArray(items)) return [];
  const e = entree(items);
  const f = (e.filtres || (e.filtres = {}))[nom];
  if (f && f.ver === ver && f.garder === garder) return f.liste;
  const liste = items.filter((o) => garder(o));
  e.filtres[nom] = { ver, garder, liste };
  return liste;
}

export function parTransaction(items) {
  if (!Array.isArray(items)) return new Map();
  const e = entree(items);
  if (e.parTx) return e.parTx;
  const m = new Map();
  for (let i = 0; i < items.length; i++) {
    const o = items[i];
    const tx = o && o.transaction_id != null ? String(o.transaction_id) : '';
    if (!tx) continue;
    const l = m.get(tx); if (l) l.push(i); else m.set(tx, [i]);
  }
  e.parTx = m;
  return m;
}
