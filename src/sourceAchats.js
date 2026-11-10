// ════════════════════════════════════════════════════════════════════════════
//  D'OÙ VIENNENT MES ACHATS (10 nov., lot BG — validé par Julien : « peu de
//  texte, du visuel »). Le bénéfice moyen par SOURCE d'achat, dans Statistiques.
//
//  LA SOURCE SE LIT OU SE SAISIT — JAMAIS DEVINÉE (§5) :
//    · un achat Vinted capté, relié à la paire par SON n° de transaction
//      (`buyFromId`, posé par son clic) ⇒ « Vinted » ;
//    · un achat en gros chez un fournisseur QU'IL a créé, relié par son clic
//      (`buyGros.id`, src/fournisseurs.js) ⇒ « Fournisseur » ;
//    · un achat hors plateforme relié par le N° QU'IL a écrit dessus (un N° qui
//      ne désigne qu'UN achat hors plateforme, la règle de `bilanFournisseurs`)
//      ⇒ la source QU'IL a saisie sur cet achat (« Où », liste courte + libre) ;
//      rattaché à un fournisseur ⇒ « Fournisseur » ; rien de saisi ⇒ « source
//      pas saisie » (compté à part, jamais rangé dans une barre) ;
//    · une paire sans achat relié (prix tapé sur la fiche seule) ⇒ « achat pas
//      relié » (compté à part). JAMAIS le titre, la marque, la ressemblance.
//
//  LE BÉNÉFICE vient de la règle unique (`beneficeLigneVente` → `beneficePaire`
//  pour Vinted ; la règle de `ventesAutresBenefice` pour Leboncoin, eBay,
//  Vestiaire) — calculé par l'écran Ventes et PUBLIÉ, jamais refait ici. La
//  moyenne d'une source porte sur ses ventes au bénéfice CONNU, la couverture
//  est dite (« sur 14 ventes · prix d'achat manquant pour 3 ») ; jamais « au
//  moins » sur un bénéfice (une paire au prix inconnu peut être à perte :
//  src/beneficeNoms.js) ; « au plus » quand des frais ne sont pas confirmés.
//  Module PUR (sauf la publication, sur l'appareil). Exécuté par
//  scripts/audit-frise-source.cjs.
// ════════════════════════════════════════════════════════════════════════════

const str = (v) => String(v == null ? '' : v).trim();
const sansAccents = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// La liste courte (l'ordre de l'écran) ; tout autre texte qu'il tape est gardé tel quel.
export const SOURCES_CONNUES = [
  ['vinted', 'Vinted'], ['leboncoin', 'Leboncoin'], ['magasin', 'Magasin'], ['vide-grenier', 'Vide-grenier'],
  ['brocante', 'Brocante'], ['fournisseur', 'Fournisseur'], ['particulier', 'Particulier'],
];
const LIB = Object.fromEntries(SOURCES_CONNUES);
// Ce qu'il a ÉCRIT dans « Où » ⇒ { cle, libelle } | null (rien d'écrit).
// « Leboncoin (main propre) » est la source Leboncoin ; « Vide grenier » = « Vide-grenier ».
export function sourceSaisie(texte) {
  const t = sansAccents(texte).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!t) return null;
  if (/^(leboncoin|le bon coin|lbc)\b/.test(t)) return { cle: 'leboncoin', libelle: LIB.leboncoin };
  if (/^vinted\b/.test(t)) return { cle: 'vinted', libelle: LIB.vinted };
  if (/^vide grenier/.test(t)) return { cle: 'vide-grenier', libelle: LIB['vide-grenier'] };
  for (const [cle, lib] of SOURCES_CONNUES) if (t === sansAccents(lib).replace(/[^a-z0-9]+/g, ' ')) return { cle, libelle: lib };
  if (t === 'autre') return { cle: 'autre', libelle: 'Autre' };
  const libre = str(texte).replace(/\s+/g, ' ').slice(0, 40);
  return { cle: 'libre:' + t, libelle: libre.charAt(0).toUpperCase() + libre.slice(1) };
}

// Les achats hors plateforme par N° (identité `cleNum`) ; un N° porté par deux achats : 'ambigu'.
export function horsParNumero(hors, cleNum) {
  const cn = typeof cleNum === 'function' ? cleNum : (x) => str(x).toUpperCase();
  const m = new Map();
  for (const b of (Array.isArray(hors) ? hors : [])) {
    const k = b && b.numero != null ? cn(b.numero) : '';
    if (k) m.set(k, m.has(k) ? 'ambigu' : b);
  }
  return m;
}

// La source de LA paire vendue (sa fiche fusionnée `entree`) ⇒ { cle, libelle, par } | null.
//   registre : `vrm_fournisseurs` (lireRegistre) — { achats, hors } ;
//   hors     : `horsParNumero(...)` ; cleNum : l'identité d'un N°.
// cle 'non-saisie' : un achat hors plateforme relié, sans source écrite.
export function sourceDeVente(entree, { hors = null, registre = null, cleNum = null } = {}) {
  const e = entree || {};
  if (/^\d{4,20}$/.test(str(e.buyFromId))) return { cle: 'vinted', libelle: LIB.vinted, par: 'achat-vinted' };
  const reg = registre || {};
  const g = e.buyGros && typeof e.buyGros === 'object' ? str(e.buyGros.id) : '';
  if (g && reg.achats && reg.achats[g]) return { cle: 'fournisseur', libelle: LIB.fournisseur, par: 'achat-gros' };
  const cn = typeof cleNum === 'function' ? cleNum : (x) => str(x).toUpperCase();
  const k = e.numero != null && str(e.numero) ? cn(e.numero) : '';
  const b = k && hors instanceof Map ? hors.get(k) : null;
  if (!b || b === 'ambigu') return null;
  if (reg.hors && reg.hors[b.id]) return { cle: 'fournisseur', libelle: LIB.fournisseur, par: 'achat-hors' };
  const s = sourceSaisie(b.source);
  return s ? { ...s, par: 'achat-hors' } : { cle: 'non-saisie', libelle: '', par: 'achat-hors' };
}

// ── LE CALCUL (Statistiques) ────────────────────────────────────────────────
// lignes : [{ id, ts, cle, libelle, benefice: centimes | null, partiel }] (la
// publication, déjà filtrée sur la période). cle null ⇒ achat pas relié.
// Rend { groupes: [{ cle, libelle, n, nConnu, moyenne, partiel }], sansAchat, sansSource, n }.
// Ordre : la moyenne la plus haute d'abord ; une source sans bénéfice connu en dernier.
export function beneficeParSource(lignes) {
  const par = new Map();
  let sansAchat = 0, sansSource = 0, n = 0;
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    if (!l) continue;
    n++;
    if (!l.cle) { sansAchat++; continue; }
    if (l.cle === 'non-saisie') { sansSource++; continue; }
    const g = par.get(l.cle) || { cle: l.cle, libelle: l.libelle || l.cle, n: 0, nConnu: 0, somme: 0, partiel: false };
    g.n++;
    if (Number.isSafeInteger(l.benefice)) { g.nConnu++; g.somme += l.benefice; if (l.partiel) g.partiel = true; }
    par.set(l.cle, g);
  }
  const groupes = [...par.values()].map((g) => ({ cle: g.cle, libelle: g.libelle, n: g.n, nConnu: g.nConnu, partiel: g.partiel, moyenne: g.nConnu ? Math.round(g.somme / g.nConnu) : null }));
  groupes.sort((a, b) => (a.moyenne == null) - (b.moyenne == null) || (b.moyenne || 0) - (a.moyenne || 0) || b.n - a.n || a.libelle.localeCompare(b.libelle, 'fr'));
  return { groupes, sansAchat, sansSource, n };
}

const pl = (k, s, p) => `${k} ${k > 1 ? (p || s + 's') : s}`;
export const eurosSource = (c) => {
  if (c == null || !Number.isFinite(c)) return '—';
  const e = Math.round(c / 100);
  return (e < 0 ? '−' : '') + String(Math.abs(e)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
};
// « 32 € en moyenne » · « au plus 32 € en moyenne » · « — » ; et « sur 14 ventes » (+ le manque nommé).
export function texteSource(g) {
  if (!g) return { montant: '—', sur: '' };
  const montant = g.moyenne == null ? '—' : `${g.partiel ? 'au plus ' : ''}${eurosSource(g.moyenne)} en moyenne`;
  let sur = `sur ${pl(g.nConnu, 'vente')}`;
  if (g.nConnu < g.n) sur = `sur ${pl(g.nConnu, 'vente')} · prix d’achat manquant pour ${g.n - g.nConnu}`;
  return { montant, sur };
}

// ── LA PUBLICATION (un propriétaire : l'écran Ventes ; un lecteur : Statistiques) ──
export const CLE_SOURCES = 'vrm_sources_ventes';
export const EVT_SOURCES = 'vrm:sources-ventes';
// lignes : [{ id, ts, cle, libelle, benefice, partiel }] ; partiel : une plateforme pas lue.
export function publierSources(lignes, { owner = '', partiel = false } = {}) {
  if (!Array.isArray(lignes)) return;
  const l = lignes.map((x) => [str(x.id), Number(x.ts) || 0, x.cle || '', x.libelle || '', Number.isSafeInteger(x.benefice) ? x.benefice : null, x.partiel ? 1 : 0]);
  const p = { v: 1, owner: str(owner), partiel: !!partiel, l };
  try {
    const avant = localStorage.getItem(CLE_SOURCES);
    const neuf = JSON.stringify(p);
    if (avant && avant.replace(/,"at":\d+}$/, '}') === neuf) return;
    localStorage.setItem(CLE_SOURCES, JSON.stringify({ ...p, at: Date.now() }));
  } catch (_) { /* stockage refusé : Statistiques dit « — » */ }
  try { window.dispatchEvent(new CustomEvent(EVT_SOURCES)); } catch (_) {}
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — »).
export function lireSources(owner = '') {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_SOURCES) || 'null');
    if (!p || p.v !== 1 || str(p.owner) !== str(owner) || !Array.isArray(p.l)) return null;
    return { partiel: !!p.partiel, at: p.at || null, lignes: p.l.map(([id, ts, cle, libelle, benefice, partiel]) => ({ id, ts, cle: cle || null, libelle, benefice: Number.isSafeInteger(benefice) ? benefice : null, partiel: !!partiel })) };
  } catch (_) { return null; }
}
