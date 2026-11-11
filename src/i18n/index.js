// ══════════════════════════════════════════════════════════════════════════
// LA TRADUCTION DE VRM (11 nov., décision de Julien : « traduire toute l'app en
// anglais, espagnol, italien, allemand »). Aucune dépendance : un dictionnaire
// par langue, `t('cle', { vars })`, les pluriels par Intl.PluralRules et les
// formats (nombres, euros, dates, heures) par Intl.
//
// • Le FRANÇAIS est la source (src/i18n/langues/fr.js, dans le JS initial) ; les
//   autres langues se chargent À LA DEMANDE (un morceau chacune, `import()`).
// • Une clé absente d'une langue retombe sur le français, jamais sur un blanc ;
//   une clé absente du français rend la clé elle-même (audit-traduction le refuse).
// • La langue est le CHOIX du vendeur (Paramètres → Langue, `vrm_langue`, dans
//   SYNC_KEYS : la même sur tous ses appareils) ; sans choix, celle du navigateur
//   si elle est parmi les cinq, sinon le français. `<html lang>` la suit.
// • Les TEXTES seulement : aucune règle de calcul ne dépend de la langue (la
//   compta par pays est un lot séparé, `fiscalite-pays`). Les noms propres
//   (Vinted, Leboncoin, eBay, Vestiaire Collective, URSSAF…) et les DONNÉES
//   (titres d'annonces, pseudos, messages) ne se traduisent jamais.
// Méthode pour migrer un écran : docs/passation/2026-11-11-traduction.md.
// ══════════════════════════════════════════════════════════════════════════
import fr from './langues/fr.js';

export const LANGUES = ['fr', 'en', 'es', 'it', 'de'];
// Le nom de chaque langue DANS sa langue (un sélecteur se lit par celui qui ne
// comprend pas la langue courante).
export const NOMS_LANGUES = { fr: 'Français', en: 'English', es: 'Español', it: 'Italiano', de: 'Deutsch' };
// La région des formats : l'euro et le jour avant le mois partout (Europe).
export const LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' };
export const CLE_LANGUE = 'vrm_langue';

const CHARGEURS = {
  en: () => import('./langues/en.js'),
  es: () => import('./langues/es.js'),
  it: () => import('./langues/it.js'),
  de: () => import('./langues/de.js'),
};

let langue = 'fr';
let dict = fr;
const charges = { fr };
const abonnes = new Set();

export const estLangue = (l) => LANGUES.includes(l);
export const langueCourante = () => langue;
export const localeCourante = () => LOCALES[langue] || 'fr-FR';

// La langue du navigateur si elle est parmi les cinq (« de-AT » ⇒ de), sinon fr.
export function langueDuNavigateur(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  const liste = [];
  try { if (nav && Array.isArray(nav.languages)) liste.push(...nav.languages); } catch (_) {}
  try { if (nav && nav.language) liste.push(nav.language); } catch (_) {}
  for (const x of liste) { const l = String(x || '').toLowerCase().split(/[-_]/)[0]; if (estLangue(l)) return l; }
  return 'fr';
}
// Ce que le vendeur a choisi (rangé en JSON par `save`, ou brut) ; rien ⇒ null.
export function langueChoisie(stockage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  let v = null;
  try { v = stockage && stockage.getItem(CLE_LANGUE); } catch (_) { return null; }
  if (v == null) return null;
  try { v = JSON.parse(v); } catch (_) {}
  return estLangue(v) ? v : null;
}
export const langueInitiale = () => langueChoisie() || langueDuNavigateur();

function emettre() {
  try { if (typeof document !== 'undefined') document.documentElement.lang = langue; } catch (_) {}
  [...abonnes].forEach((fn) => { try { fn(langue); } catch (_) {} });
}
export function abonnerLangue(fn) { abonnes.add(fn); return () => abonnes.delete(fn); }

export async function chargerLangue(l) {
  if (charges[l]) return charges[l];
  if (!CHARGEURS[l]) return null;
  const m = await CHARGEURS[l]();
  charges[l] = (m && m.default) || null;
  return charges[l];
}
// Pose une langue (chargée d'abord : jamais une moitié d'écran dans l'autre langue).
// Un chargement raté garde la langue d'avant et rend false.
export async function appliquerLangue(l) {
  const cible = estLangue(l) ? l : 'fr';
  let d = null;
  try { d = await chargerLangue(cible); } catch (_) { d = null; }
  if (!d) return false;
  if (cible === langue && d === dict) { emettre(); return true; }
  langue = cible; dict = d; emettre();
  return true;
}
// Au démarrage : la langue initiale, au plus `ms` d'attente (au-delà, le français
// s'affiche et la langue arrive dès que son morceau est là).
export function preparerLangue(ms = 2000) {
  const l = langueInitiale();
  if (l === 'fr') { emettre(); return Promise.resolve(true); }
  return Promise.race([appliquerLangue(l), new Promise((r) => setTimeout(() => r(false), ms))]);
}
// Le choix du vendeur : rangé (par `ranger`, le `save` de l'app ⇒ synchronisé), puis posé.
export function choisirLangue(l, ranger) {
  if (!estLangue(l)) return Promise.resolve(false);
  try { if (typeof ranger === 'function') ranger(CLE_LANGUE, l); else localStorage.setItem(CLE_LANGUE, JSON.stringify(l)); } catch (_) {}
  return appliquerLangue(l);
}
// La langue relue du nuage (un autre appareil l'a changée) ou d'un autre onglet.
if (typeof window !== 'undefined') {
  const relire = () => { const l = langueChoisie(); if (l && l !== langue) appliquerLangue(l); };
  try { window.addEventListener('vrm:save', (e) => { const d = e && e.detail; if (d && d.k === CLE_LANGUE) relire(); }); } catch (_) {}
  try { window.addEventListener('storage', (e) => { if (e && e.key === CLE_LANGUE) relire(); }); } catch (_) {}
}

// ── Les pluriels ─────────────────────────────────────────────────────────────
const regles = {};
const regle = (l) => regles[l] || (regles[l] = (() => { try { return new Intl.PluralRules(LOCALES[l] || l); } catch (_) { return { select: (n) => (n === 1 ? 'one' : 'other') }; } })());
export function choisirPluriel(entree, n, l = langue) {
  if (n === 0 && entree.zero != null) return entree.zero;
  const cat = regle(l).select(Number(n) || 0);
  return entree[cat] != null ? entree[cat] : entree.other;
}

// ── Les formats ──────────────────────────────────────────────────────────────
export const nombre = (n, opts) => { try { return new Intl.NumberFormat(localeCourante(), opts).format(n); } catch (_) { return String(n); } };
// L'euro par défaut ; `null`/`undefined` ⇒ « — » (pas su ne vaut pas 0, §5).
export const monnaie = (n, devise = 'EUR', opts) => (n == null || Number.isNaN(Number(n)) ? '—'
  : nombre(Number(n), { style: 'currency', currency: devise, ...opts }));
const enDate = (d) => (d instanceof Date ? d : new Date(d));
export const date = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => { try { return new Intl.DateTimeFormat(localeCourante(), opts).format(enDate(d)); } catch (_) { return ''; } };
export const heure = (d, opts = { hour: '2-digit', minute: '2-digit' }) => { try { return new Intl.DateTimeFormat(localeCourante(), opts).format(enDate(d)); } catch (_) { return ''; } };
export const dateRelative = (valeur, unite) => { try { return new Intl.RelativeTimeFormat(localeCourante(), { numeric: 'auto' }).format(valeur, unite); } catch (_) { return ''; } };

// ── t() ──────────────────────────────────────────────────────────────────────
// `t('reglages.titre')` · `t('colis.n', { n: 3 })` (pluriel par `n`) ·
// `{nom}` remplacé par la variable (un nombre est formaté dans la langue).
const remplir = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => {
  if (!(k in vars)) return m;
  const v = vars[k];
  return typeof v === 'number' ? nombre(v) : String(v == null ? '' : v);
}) : String(s));
export function t(cle, vars) {
  let e = dict[cle];
  if (e == null) e = fr[cle];
  if (e == null) return cle;
  if (typeof e === 'object') e = choisirPluriel(e, vars && (vars.n != null ? vars.n : vars.count));
  return remplir(e, vars);
}
// Une clé existe-t-elle (dans la langue ou en français) ?
export const aCle = (cle) => dict[cle] != null || fr[cle] != null;
// Pour les bancs et l'audit : le dictionnaire source.
export const SOURCE = fr;
export const tr = t;
