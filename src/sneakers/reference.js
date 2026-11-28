// ═════════════════════════════════════════════════════════════════════════════
//  LA RÉFÉRENCE FABRICANT ET LA POINTURE D'UN ARTICLE (28 nov. 2026, lot sneakers-cote)
// ═════════════════════════════════════════════════════════════════════════════
// Copié des outils sneakers (Payout, Resellify, Sneaker Portal, SyncKicks, Retailed) : le « style code »
// (Nike « DD1391-100 », Jordan « 555088-134 », adidas « GZ1234 », New Balance « M990GL6 ») et la pointure
// normalisée (EU / US / UK) sur la fiche d'un N°.
//
// ⚠️⚠️ CLAUDE.md §2.4 et §5 : une référence fabricant désigne un MODÈLE, jamais UNE paire — cinquante paires
//    du même modèle portent la même référence. Elle sert aux STATISTIQUES et à la COTE, JAMAIS à relier une
//    vente, un achat, un colis ou une annonce. Aucune fonction de ce dossier ne rend une identité de paire ;
//    `scripts/audit-sneakers.cjs` pose 50 paires de même référence et vérifie qu'aucune vente n'est reliée.
// ⚠️ Rien n'est posé tout seul : `proposerRefs` PROPOSE (une puce), c'est SON toucher qui pose. Une seule
//    référence lisible dans le titre peut servir aux statistiques (`refEffective`) sans être écrite ; deux
//    références différentes = ambigu ⇒ rien n'est utilisé tant qu'il n'a pas choisi.
// Module PUR (aucune lecture). Exécuté par scripts/audit-sneakers.cjs.
// ═════════════════════════════════════════════════════════════════════════════

const str = (v) => String(v == null ? '' : v);

// Les formes reconnues, de la plus sûre à la moins sûre. Chacune rend la forme CANONIQUE.
//   nike     deux lettres + 4 chiffres, tiret, 3 chiffres   « DD1391-100 » (« dd1391 100 » ⇒ « DD1391-100 »)
//   jordan   6 chiffres, TIRET, 3 chiffres                   « 555088-134 » (le tiret est EXIGÉ : un code postal, un
//            prix ou un numéro de suivi suivi d'un nombre n'est jamais pris pour une référence)
//   adidas   deux lettres + 4 chiffres, ou une lettre + 5 chiffres, seuls (sans « -000 » derrière)   « GZ1234 », « B37571 »
//   nb       New Balance : M/U/W/ML/MR/WL + 3 ou 4 chiffres + 2 ou 3 lettres (+ un chiffre)   « M990GL6 », « U9060BLK »
// (28 nov., main-vert) SANS lookbehind `(?<!…)` : Safari < 16.4 refuse de lire TOUT le fichier qui en contient un
// (audit-safari). `avant` est le caractère interdit juste avant la référence ; `chercher` rend la même correspondance
// que l'ancien `(?<![…])re` : une position refusée est réessayée au caractère suivant, comme le moteur le faisait.
const FORMES = [
  { sorte: 'nike', avant: /[A-Z0-9]/, re: /([A-Z]{2}\d{4})[-\s]?(\d{3})(?![0-9])/g, canon: (m) => `${m[1]}-${m[2]}` },
  { sorte: 'jordan', avant: /[A-Z0-9-]/, re: /(\d{6})-(\d{3})(?![0-9])/g, canon: (m) => `${m[1]}-${m[2]}` },
  { sorte: 'nb', avant: /[A-Z0-9]/, re: /((?:ML|MR|WL|[MUW])\d{3,4}[A-Z]{2,3}\d?)(?![A-Z0-9])/g, canon: (m) => m[1] },
  { sorte: 'adidas', avant: /[A-Z0-9]/, re: /([A-Z]{2}\d{4}|[A-Z]\d{5})(?![A-Z0-9]|[-\s]\d{3}(?!\d))/g, canon: (m) => m[1] },
];
// La prochaine correspondance de la forme `f` dans `s` (à partir de `f.re.lastIndex`), ou null.
const chercher = (f, s) => {
  for (;;) {
    const m = f.re.exec(s);
    if (!m) return null;
    if (m.index > 0 && f.avant.test(s[m.index - 1])) { f.re.lastIndex = m.index + 1; continue; }
    return m;
  }
};

// Une référence tapée ou lue, sous sa forme canonique, ou '' (illisible : rien n'est posé).
export function normaliserRef(v) {
  let s = str(v).toUpperCase().replace(/[‐-―]/g, '-').trim();
  if (!s || s.length > 24) return '';
  s = s.replace(/^(\d{6})\s+(\d{3})$/, '$1-$2');   // tapé à la main « 555088 134 » : la forme Jordan
  for (const f of FORMES) {
    f.re.lastIndex = 0;
    const m = chercher(f, s);
    if (m && m.index === 0 && m[0].length === s.replace(/\s+$/, '').length) return f.canon(m);
  }
  // Une autre marque (Asics « 1201A789-020 », Salomon « L47452600 ») : lettres, chiffres, un tiret, 5 à 16 signes,
  // au moins 3 chiffres. Tapée par LUI seulement (jamais proposée depuis un titre).
  const libre = s.replace(/\s+/g, '');
  return /^[A-Z0-9]{2,12}(?:-[A-Z0-9]{2,6})?$/.test(libre) && (libre.match(/\d/g) || []).length >= 3 && libre.length >= 5 && libre.length <= 16 ? libre : '';
}

// Les références lisibles dans un texte (titre, description), distinctes, dans l'ordre. Jamais une forme « libre ».
export function refsDuTexte(texte) {
  const s = str(texte).toUpperCase().replace(/[‐-―]/g, '-');
  const vues = [], deja = new Set(), couverts = [];
  for (const f of FORMES) {
    f.re.lastIndex = 0;
    let m;
    while ((m = chercher(f, s))) {
      const a = m.index, b = m.index + m[0].length;
      if (couverts.some(([x, y]) => a < y && b > x)) continue;   // déjà pris par une forme plus sûre
      couverts.push([a, b]);
      const c = f.canon(m);
      if (!deja.has(c)) { deja.add(c); vues.push({ ref: c, sorte: f.sorte }); }
    }
  }
  return vues;
}

// Ce que la fiche PROPOSE : { refs: [...], unique: 'DD1391-100' | '' }. `unique` seulement quand UNE référence
// (une seule) se lit dans tous les textes donnés ; plusieurs ⇒ ambigu ⇒ '' (à lui de choisir une puce).
export function proposerRefs(...textes) {
  const toutes = [], deja = new Set();
  for (const t of textes) for (const r of refsDuTexte(t)) if (!deja.has(r.ref)) { deja.add(r.ref); toutes.push(r.ref); }
  return { refs: toutes.slice(0, 6), unique: toutes.length === 1 ? toutes[0] : '' };
}

// La référence qui COMPTE pour les statistiques : celle qu'il a posée, sinon l'unique lue dans le titre.
// Rend { ref, source: 'posee' | 'titre' | '' }. Jamais une identité de paire (en-tête).
export function refEffective(posee, ...textes) {
  const p = normaliserRef(posee);
  if (p) return { ref: p, source: 'posee' };
  const u = proposerRefs(...textes).unique;
  return u ? { ref: u, source: 'titre' } : { ref: '', source: '' };
}

// ── LA POINTURE ─────────────────────────────────────────────────────────────
// { sys: 'EU' | 'US' | 'UK', val: nombre (au demi ou au tiers), texte: « EU 42,5 » } ou null.
// « 42,5 », « EU 42.5 », « T42 », « taille 42 2/3 », « 42⅔ », « US 9.5 », « UK8 », « US M 10 ».
const TIERS = { '⅓': 1 / 3, '⅔': 2 / 3, '½': 0.5 };
const arrondi = (n) => Math.round(n * 6) / 6;   // demis et tiers
export function texteVal(val) {
  const e = Math.floor(val + 1e-9), f = val - e;
  if (Math.abs(f) < 0.02) return String(e);
  if (Math.abs(f - 0.5) < 0.02) return `${e},5`;
  if (Math.abs(f - 1 / 3) < 0.02) return `${e} 1/3`;
  if (Math.abs(f - 2 / 3) < 0.02) return `${e} 2/3`;
  return String(Math.round(val * 100) / 100).replace('.', ',');
}
export function normaliserPointure(v, sysParDefaut = 'EU') {
  const s = str(v).toUpperCase().replace(/,/g, '.').trim();
  if (!s) return null;
  const m = /^(?:(?:TAILLE|POINTURE|SIZE|T)\s*)?(EU|FR|US|UK)?\s*(?:[MW]\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*(1\/3|2\/3|1\/2|[⅓⅔½])?\s*(EU|FR|US|UK)?$/.exec(s);
  if (!m) return null;
  let val = Number(m[2]);
  if (m[3]) val += m[3] === '1/3' || m[3] === '⅓' ? 1 / 3 : m[3] === '2/3' || m[3] === '⅔' ? 2 / 3 : 0.5;
  const sys = ((m[1] || m[4] || sysParDefaut) === 'FR' ? 'EU' : (m[1] || m[4] || sysParDefaut));
  val = arrondi(val);
  const bornes = { EU: [16, 52], US: [1, 18], UK: [1, 17] }[sys];
  if (!bornes || !(val >= bornes[0] && val <= bornes[1])) return null;
  return { sys, val, texte: `${sys} ${texteVal(val)}` };
}
// La pointure lisible dans un titre (« … taille 42,5 », « … 42 2/3 », « … US 9 »), ou null. Deux pointures
// différentes ⇒ null (ambigu). Un nombre seul n'est pris que s'il est annoncé (taille, T, EU, US, UK, pointure).
export function pointureDuTexte(texte) {
  const s = str(texte).toUpperCase().replace(/,/g, '.');
  const re = /(?:^|[^A-Z0-9])(TAILLE|POINTURE|SIZE|T|EU|FR|US|UK)\s*(?:[MW]\s)?\s*(\d{1,2}(?:\.\d{1,2})?(?:\s*(?:1\/3|2\/3|1\/2))?|\d{1,2}\s*[⅓⅔½])(?![0-9])/g;
  const vues = new Map();
  let m;
  // Un tiers ou un demi collé à un nombre de 2 chiffres (« 42 2/3 », « 42⅔ ») est une pointure européenne, même sans « taille ».
  const reTiers = /(?:^|[^0-9.\/])(\d{2})\s*(1\/3|2\/3|[⅓⅔])(?![0-9])/g;
  while ((m = reTiers.exec(s))) { const p = normaliserPointure(`EU ${m[1]} ${m[2]}`); if (p) vues.set(p.texte, p); }
  while ((m = re.exec(s))) {
    const p = normaliserPointure(`${m[1] === 'TAILLE' || m[1] === 'POINTURE' || m[1] === 'SIZE' || m[1] === 'T' ? '' : m[1]} ${m[2]}`);
    if (p) vues.set(p.texte, p);
  }
  return vues.size === 1 ? [...vues.values()][0] : null;
}

// La table HOMME de Nike / Jordan (celle que Nike publie : US = UK + 1, EU au demi). Les autres marques ont
// leur propre table (adidas au tiers) : la conversion n'est faite QUE pour une référence de forme Nike/Jordan,
// et elle est DITE (« ≈ table Nike homme »). Sans table sûre, les pointures de systèmes différents ne se
// comparent pas (pas su ≠ égal).
const NIKE_US_EU = [[3.5, 35.5], [4, 36], [4.5, 36.5], [5, 37.5], [5.5, 38], [6, 38.5], [6.5, 39], [7, 40], [7.5, 40.5], [8, 41], [8.5, 42], [9, 42.5], [9.5, 43], [10, 44], [10.5, 44.5], [11, 45], [11.5, 45.5], [12, 46], [12.5, 47], [13, 47.5], [14, 48.5], [15, 49.5]];
export const refNikeJordan = (ref) => /^[A-Z]{2}\d{4}-\d{3}$|^\d{6}-\d{3}$/.test(str(ref));
export function enEU(p, ref) {
  if (!p) return null;
  if (p.sys === 'EU') return p.val;
  if (!refNikeJordan(ref)) return null;
  const us = p.sys === 'UK' ? p.val + 1 : p.val;
  const l = NIKE_US_EU.find(([u]) => Math.abs(u - us) < 0.01);
  return l ? l[1] : null;
}
export function equivalents(p, ref) {
  const eu = enEU(p, ref);
  if (eu == null || !refNikeJordan(ref)) return null;
  const l = NIKE_US_EU.find(([, e]) => Math.abs(e - eu) < 0.01);
  return l ? { eu: texteVal(l[1]), us: texteVal(l[0]), uk: texteVal(l[0] - 1), table: 'nike-homme' } : null;
}
// La clé de comparaison d'une pointure pour UNE référence : « EU:42.5 » (convertie quand la table est sûre),
// sinon « US:9 » tel quel. Deux pointures de même clé = même pointure ; autre chose = autre pointure ou pas su.
export function clePointure(p, ref) {
  if (!p) return '';
  const eu = enEU(p, ref);
  return eu != null ? `EU:${Math.round(eu * 6) / 6}` : `${p.sys}:${p.val}`;
}
