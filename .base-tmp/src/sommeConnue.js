// (11 nov., famille « pas su ≠ 0 ») UNE règle pour sommer des montants dont certains
// ne sont pas sus. §5 : « un total partiel qui se présente comme complet est pire qu'un
// total absent » — on somme ce qu'on connaît, on COMPTE ce qu'on ne connaît pas, et
// l'écran dit « au moins … » avec la couverture (« sur N ») ; rien de connu ⇒ « — ».
// Avant : chaque écran faisait `Number(x) || 0` (un prix illisible valait 0 €, en silence).
// Gardien : scripts/audit-pas-su.cjs.

// La valeur d'une entrée, ou null : nombre fini, chaîne « 12,50 » / « 12.5 », prix Vinted
// `{ amount, currency_code }` (une autre devise que l'euro n'est PAS sue en euros).
export function valeurSue(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') {
    const dev = v.currency_code || v.currency || v.devise;
    if (dev && String(dev).toUpperCase() !== 'EUR') return null;
    return valeurSue(v.amount != null ? v.amount : v.valeur);
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim().replace(/[\s  €]/g, '');
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Somme d'une liste : `valeurDe(x)` rend le montant (ou ce que `valeurSue` sait lire).
// → { total, n, connus, manque, partiel }
//    total : la somme des montants SUS (au centime) ; null si la liste a des entrées mais
//            qu'AUCUNE n'est sue ; 0 pour une liste vide (lue et vide : « rien », pas « pas su »).
export function sommeConnue(liste, valeurDe = (x) => x) {
  let cts = 0, n = 0, connus = 0;
  for (const x of (liste || [])) {
    n++;
    const v = valeurSue(valeurDe(x));
    if (v == null) continue;
    connus++; cts += Math.round(v * 100);
  }
  const manque = n - connus;
  return { total: n === 0 ? 0 : (connus === 0 ? null : cts / 100), n, connus, manque, partiel: manque > 0 };
}

// Le texte d'une somme : « — » (rien de su) · « 120 € » (complète) · « au moins 120 € » (partielle).
// `ecrire` : la mise en forme des euros de l'écran (par défaut « 120,50 € »).
const ecrireDefaut = (v) => `${(Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')} €`;
export function texteSomme(r, ecrire = ecrireDefaut) {
  if (!r || r.total == null) return '—';
  return (r.partiel ? 'au moins ' : '') + ecrire(r.total);
}
// La couverture, à écrire À CÔTÉ du chiffre partiel : « sur 3 achats sur 5 » ('' si complète).
export function texteCouverture(r, nom = 'ventes') {
  if (!r || !r.partiel || r.n === 0) return '';
  return `sur ${r.connus} ${nom} sur ${r.n}`;
}

// Une médiane qui n'invente rien : null sans valeur sue ; moyenne des deux centrales si paire.
export function medianeSue(liste, valeurDe = (x) => x) {
  const v = (liste || []).map((x) => valeurSue(valeurDe(x))).filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round(((v[m - 1] + v[m]) / 2) * 100) / 100;
}
