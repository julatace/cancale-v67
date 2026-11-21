// ════════════════════════════════════════════════════════════════════════════
//  L'ORDRE DES LISTES : LE PLUS RÉCENT EN HAUT, TOUS COMPTES MÉLANGÉS
//  (9 nov., soir, lot AJ — Julien, mot pour mot : « Les ventes, achats, colis à
//  expédier, à préparer ne sont pas rangés dans l'ordre, du plus récent en haut
//  au plus vieux en bas, peu importe le compte, ça doit être parfait. »)
//
//  ⚠️ DÉCISION NOUVELLE DE JULIEN : elle REMPLACE le tri « par urgence » (date
//  limite la plus proche d'abord, puis groupes par transporteur) de Colis →
//  « À envoyer » et de « Préparer mes colis » (décision des 8-9 nov.). La date
//  limite reste écrite sur chaque carte (ambre si proche) ; l'ORDRE, lui, est
//  le plus récent en haut. Un groupe par compte ou par transporteur n'impose
//  plus jamais l'ordre : il devient un filtre (pastilles).
//
//  UNE RÈGLE (§11) : `ordreRecent(liste, quand)` — date décroissante, STABLE à
//  date égale (l'ordre reçu), une ligne SANS date lue en BAS (jamais datée au
//  hasard ; l'écran le dit). Les dates de référence, par type :
//    · vente           : la date de VENTE lue (Vinted `o.date`, Leboncoin
//                        `dateVente` puis la date relevée, eBay `creationDate`,
//                        Vestiaire `date` puis `premiereVue` — Vestiaire ne la
//                        donne pas toujours : la première lecture est la seule
//                        date LUE qui reste, jamais une date inventée) ;
//    · achat           : la date d'ACHAT lue (Vinted `o.date`, Leboncoin
//                        `dateVente`, Vestiaire `date` puis `premiereVue`) ;
//    · colis à envoyer : la date de la VENTE du colis (`quandColisAEnvoyer`) ;
//    · colis envoyé    : prise en charge lue, sinon « Colis fait », sinon date de
//                        vente — la règle existante `quandEnvoye`
//                        (src/colisEnvoyes.js, inchangée) ;
//    · colis à retirer : la date d'ARRIVÉE lue au point (`arrivee` posée sur la
//                        carte : e-mail d'arrivée, message d'arrivée de la
//                        conversation, ou ligne « disponible » du transporteur).
//  Module PUR : l'app et les bancs lisent les mêmes fonctions
//  (scripts/audit-ordre-recent.cjs).
// ════════════════════════════════════════════════════════════════════════════

// Une date lue ⇒ millisecondes ; rien de lisible ⇒ null (jamais 0, jamais
// « maintenant »). Un nombre en secondes (Unix) est converti.
export function msDe(v) {
  if (v == null || v === '' || v === false) return null;
  if (v instanceof Date) { const t = v.getTime(); return Number.isFinite(t) && t > 0 ? t : null; }
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return null;
    return v < 1e11 ? v * 1000 : v;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{9,13}$/.test(s)) return msDe(Number(s));
  const t = Date.parse(s);
  return Number.isFinite(t) && t > 0 ? t : null;
}

// La première date lisible d'une liste de candidats (dans l'ordre donné).
export function premiereDate(...vals) {
  for (const v of vals) { const t = msDe(v); if (t != null) return t; }
  return null;
}

// LA RÈGLE : le plus récent en haut ; à date égale, l'ordre reçu ; sans date en
// bas (entre elles, l'ordre reçu). Rend une NOUVELLE liste (rien n'est muté).
export function ordreRecent(liste, quand) {
  const L = Array.isArray(liste) ? liste : [];
  const q = typeof quand === 'function' ? quand : (x) => x;
  return L.map((x, i) => [x, i, msDe(q(x))])
    .sort((a, b) => {
      const A = a[2], B = b[2];
      if (A == null && B == null) return a[1] - b[1];
      if (A == null) return 1;
      if (B == null) return -1;
      return (B - A) || (a[1] - b[1]);
    })
    .map(([x]) => x);
}

// Combien de lignes n'ont pas de date lue (l'écran le dit, une fois).
export function nbSansDate(liste, quand) {
  const q = typeof quand === 'function' ? quand : (x) => x;
  return (Array.isArray(liste) ? liste : []).reduce((n, x) => n + (msDe(q(x)) == null ? 1 : 0), 0);
}

// L'index de la PREMIÈRE ligne sans date dans une liste déjà rangée (-1 : aucune).
// Sert à poser, une fois, « Sans date lue » au-dessus d'elles.
export function debutSansDate(listeRangee, quand) {
  const q = typeof quand === 'function' ? quand : (x) => x;
  const L = Array.isArray(listeRangee) ? listeRangee : [];
  for (let i = 0; i < L.length; i++) if (msDe(q(L[i])) == null) return i;
  return -1;
}

export const PHRASE_SANS_DATE = (n) => `${n} sans date lue, en bas de la liste`;

// ── Les dates de référence, par type ─────────────────────────────────────────
// Vinted (vente ou achat) : la date de la commande lue.
export const quandCommandeVinted = (o) => msDe(o && o.date);
// Leboncoin : la date de vente lue, sinon celle relevée par l'extension ou
// datée à la main (`vrm_lbc_dates[txId]`, passée en `dates`).
export const quandLeboncoin = (v, dates = null) => premiereDate(v && v.dateVente, v && v.at, v && v.date, v && v.txId != null && dates ? dates[v.txId] : null);
// eBay : la date de la commande.
export const quandEbay = (c) => msDe(c && c.creationDate);
// Vestiaire : la date lue, sinon la première lecture (voir l'en-tête).
export const quandVestiaire = (v) => premiereDate(v && v.date, v && v.premiereVue);

// Un colis « À envoyer » tel que Colis le construit (`colisAEnvoyerBase`) :
// `{ __autre: 'vc'|'eb'|'lbc', v|x|o }` ou une vente Vinted `{ o, b }`.
export function quandColisAEnvoyer(x) {
  if (!x) return null;
  if (x.__autre === 'vc') return quandVestiaire(x.v);
  if (x.__autre === 'eb') return quandEbay(x.x && x.x.ordre) ?? msDe(x.x && x.x.creationDate);
  if (x.__autre === 'lbc') return premiereDate(x.o && x.o.dateVente, x.o && x.o.at, x.o && x.o.date, x.x && x.x.dateVente, x.x && x.x.at);
  return quandCommandeVinted(x.o);
}

// Un colis « À retirer » (carte de Colis) : son arrivée lue au point.
export const quandARetirer = (c) => msDe(c && c.arrivee);

// ── « À RETIRER » : les points (src/relaisColis.js `pointsARetirer`, option `ordonner`) ──
// Décision de Julien (« du plus récent en haut au plus vieux en bas, peu importe le compte ») : dans
// « À retirer », UN POINT = UNE CARTE (§5) reste ; les colis d'un point vont de l'arrivée LUE la plus
// récente à la plus ancienne (`arrivee`, posée par Colis ; sans date en bas), et les points dans l'ordre
// de leur arrivée la plus récente (avant : la limite la plus proche d'abord). Les « à vérifier » restent
// sous les comptés de leur point ; un point sans colis arrivé (seulement « en route ») passe après ;
// « pas encore connu » reste à la fin. Les limites restent écrites (ambre si proches). Aucun colis écarté.
// L'arrivée la plus récente d'un point : parmi ses colis COMPTÉS (un « à vérifier » ne fait pas monter
// le point) ; un point qui n'a que des « à vérifier » se range par eux.
const plusRecenteArrivee = (p) => {
  const tous = p.arrives || []; const comptes = tous.filter((c) => c && !c.aVerifier);
  let m = null; for (const c of (comptes.length ? comptes : tous)) { const t = msDe(c && c.arrivee); if (t != null && (m == null || t > m)) m = t; }
  return m;
};
export function ordreRecentPoints(groupes) {
  const L = (Array.isArray(groupes) ? groupes : []).map((p) => ({ ...p, arrives: [...ordreRecent((p.arrives || []).filter((c) => !c.aVerifier), (c) => c && c.arrivee), ...ordreRecent((p.arrives || []).filter((c) => c.aVerifier), (c) => c && c.arrivee)] }));
  const rang = (p) => (p.inconnu ? 2 : (p.arrives.length ? 0 : 1));
  const avecRang = L.map((p, i) => [p, i]);
  const parRang = [0, 1, 2].map((r) => avecRang.filter(([p]) => rang(p) === r));
  return [...ordreRecent(parRang[0], ([p]) => plusRecenteArrivee(p)), ...parRang[1], ...parRang[2]].map(([p]) => p);
}

