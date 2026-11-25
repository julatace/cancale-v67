// ═══════════════════════════════════════════════════════════════════════════
// L'APERÇU SANS ABONNEMENT (8 nov.) — Julien : « on lui montre un extrait de
// ses données, le reste sera flouté tant qu'il ne paie pas ».
// ═══════════════════════════════════════════════════════════════════════════
// (25 nov., Julien : « Il voit 5 ventes et 5 annonces ») Sur Ventes et Annonces : les 5 PREMIÈRES
// lignes de l'écran (comptées dans l'ordre, toutes listes confondues) ; ailleurs, les 3 premières
// de chaque liste (`lignesApercu`). Une LIGNE : une rangée du design natif (`.n-rangee`, une case
// d'annonce `.n-inv-case`), une ligne de tableau (`tbody > tr`), ou 4 enfants de même forme.
// La 1re ligne floutée porte `data-apercu-debut` : la carte « Débloquer tout » se pose là.
// Sur un écran (sauf Paramètres, où il se réabonne) :
//   · NET : les titres, et les premières lignes (voir ci-dessus) ;
//   · FLOUTÉ (flou fort + voile) : les lignes suivantes, et hors des lignes
//     nettes tout texte qui n'est pas un titre (chiffres et montants des
//     cartes compris), les graphiques et les images ;
//   · une partie floutée est `aria-hidden` + `inert` (ni lue au lecteur
//     d'écran, ni sélectionnable, ni cliquable) ;
//   · AUCUNE action : tout clic, touche ou saisie dans l'écran est arrêté et
//     montre la carte « Ton abonnement a pris fin » ; copier est refusé.
// Le flou est une porte commerciale (ce sont SES données, la base les lui laisse
// lire, migration 027) ; ce qui compte pour la sécurité est qu'AUCUNE ÉCRITURE
// ne passe : la base la refuse (RLS) et la garde d'écriture la refuse avant
// (src/abonnement/etatAbonnement.js).
// La règle est le DOM rendu, pas chaque écran : un écran ajouté demain est
// couvert sans y penser. Elle se rejoue quand l'écran change (MutationObserver).
// ═══════════════════════════════════════════════════════════════════════════

export const APERCU_LIGNES = 3;
// (25 nov.) Un seul réglage par écran : ses lignes nettes, et si elles se comptent sur tout l'écran.
export const APERCU_ECRANS = { ventes: 5, annonces: 5 };
export const lignesApercu = (tab) => (APERCU_ECRANS[tab] ? { lignes: APERCU_ECRANS[tab], global: true } : { lignes: APERCU_LIGNES, global: false });
const SVG_NS = 'http://www.w3.org/2000/svg';
// Une ligne de données, même seule : rangée natif, case d'annonce, ligne de tableau.
export function estRangee(el) {
  if (!el || el.nodeType !== 1 || el.namespaceURI === SVG_NS) return false;
  const c = el.classList;
  if (c && (c.contains('n-rangee') || c.contains('n-inv-case'))) return true;
  return el.tagName === 'TR' && !!el.parentElement && el.parentElement.tagName === 'TBODY';
}
const TITRES = /^(H1|H2|H3|H4|H5|H6)$/;
const EN_LIGNE = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'SMALL', 'SUP', 'SUB', 'BR', 'CODE', 'ABBR', 'TIME', 'MARK', 'U', 'S', 'WBR']);
const MEDIAS = new Set(['CANVAS', 'IMG', 'PICTURE', 'VIDEO', 'svg', 'SVG']);
const CONTROLES = new Set(['BUTTON', 'A', 'LABEL', 'INPUT', 'OPTION', 'SELECT']);
const ETATS_CLASSE = /(^|-)(actif|active|sel|selected|ouvert|open|on|hover|focus|survol)$/;

const signature = (el) => el.tagName + '|' + (typeof el.className === 'string'
  ? el.className.split(/\s+/).filter((c) => c && !ETATS_CLASSE.test(c)).sort().join('.') : '');

const estCommande = (c) => !!c && (CONTROLES.has(c.tagName) || /^(tab|option|radio|button)$/.test(c.getAttribute('role') || '') || (c.children.length === 1 && estCommande(c.children[0])));
// Les lignes d'une liste : au moins 4 enfants de même forme (balise + classes).
export function lignesDeListe(el) {
  // Un dessin (svg et ses tracés) n'est jamais une liste : une icône à demi floutée n'a aucun sens.
  if (!el || el.namespaceURI === SVG_NS) return null;
  // Les cellules d'une ligne de tableau (ou l'en-tête) ne sont pas des lignes : la LIGNE est le `tr`.
  if (/^(TR|THEAD|TFOOT|COLGROUP)$/.test(el.tagName)) return null;
  const enfants = Array.from(el.children || []);
  if (enfants.length < 4) return null;
  const n = new Map();
  for (const c of enfants) { const s = signature(c); n.set(s, (n.get(s) || 0) + 1); }
  let meilleure = '', k = 0;
  for (const [s, v] of n) if (v > k) { k = v; meilleure = s; }
  if (k < 4) return null;
  const lignes = enfants.filter((c) => signature(c) === meilleure);
  // Une rangée de COMMANDES (filtres, onglets, pastilles) n'est pas une liste
  // de données : elle reste telle quelle (ses gestes sont arrêtés de toute façon).
  // (25 nov.) Une commande enveloppée (un `span` autour d'un bouton de filtre) en est une aussi.
  if (lignes.every((c) => estCommande(c) && (c.textContent || '').trim().length <= 24)) return null;
  return lignes;
}

const estFeuilleTexte = (el) => Array.from(el.children).every((c) => EN_LIGNE.has(c.tagName)) && /\S/.test(el.textContent || '');
// Un titre de carte : une balise de titre, ou un court texte en gras sans chiffre.
function estTitre(el, style) {
  if (TITRES.test(el.tagName) || el.getAttribute('role') === 'heading') return true;
  const t = (el.textContent || '').trim();
  if (!t || t.length > 60 || /\d/.test(t)) return false;
  const poids = Number((style ? style(el) : null) || 400);
  return poids >= 600;
}

function flouter(el) {
  el.setAttribute('data-apercu-floute', '');
  el.setAttribute('aria-hidden', 'true');
  try { el.inert = true; } catch (_) {}
  el.setAttribute('inert', '');
}
export function effacerApercu(racine) {
  if (!racine) return;
  racine.querySelectorAll('[data-apercu-nette]').forEach((e) => e.removeAttribute('data-apercu-nette'));
  racine.querySelectorAll('[data-apercu-floute]').forEach((e) => {
    e.removeAttribute('data-apercu-floute'); e.removeAttribute('aria-hidden'); e.removeAttribute('inert'); e.removeAttribute('data-apercu-debut');
    try { e.inert = false; } catch (_) {}
  });
  racine.removeAttribute('data-apercu');
}

// Marque l'écran. `style(el)` rend le poids de police (injecté : testable hors
// navigateur). `opts` : { lignes, global } (`lignesApercu(tab)`). Rend
// { nettes, floutees, debut } — `debut` : la 1re ligne floutée (ou null).
export function marquerApercu(racine, style = (el) => { try { return getComputedStyle(el).fontWeight; } catch (_) { return 400; } }, opts = {}) {
  if (!racine) return { nettes: 0, floutees: 0, debut: null, derniere: null };
  effacerApercu(racine);
  racine.setAttribute('data-apercu', '');
  const limite = Math.max(1, Number(opts.lignes) || APERCU_LIGNES);
  const global = opts.global === true;
  const bilan = { nettes: 0, floutees: 0, debut: null, derniere: null };
  let vues = 0; const parListe = new Map();
  // La ligne suivante : nette tant que la limite n'est pas atteinte (sur l'écran, ou dans SA liste).
  const ligne = (r, liste) => {
    // Une ligne CACHÉE (un double rendu masqué, un onglet replié) est floutée sans compter : sinon elle
    // prendrait la place d'une ligne qu'il voit. Hors navigateur (bancs de la règle), tout est visible.
    if (r.getClientRects && typeof r.getClientRects === 'function' && r.getClientRects().length === 0 && r.isConnected !== false && typeof window !== 'undefined') { flouter(r); return; }
    let i; if (global) i = vues++; else { i = parListe.get(liste) || 0; parListe.set(liste, i + 1); }
    if (i < limite) { bilan.nettes++; bilan.derniere = r; r.setAttribute('data-apercu-nette', ''); return; }
    bilan.floutees++; flouter(r);
    if (!bilan.debut) { bilan.debut = r; r.setAttribute('data-apercu-debut', ''); }
  };
  const visiter = (el) => {
    if (!el || el.nodeType !== 1 || el.hasAttribute('data-apercu-garde')) return;
    if (estRangee(el)) { ligne(el, el.parentElement); return; }
    const lignes = lignesDeListe(el);
    if (lignes) {
      lignes.forEach((r) => ligne(r, el));
      for (const c of el.children) if (!lignes.includes(c)) visiter(c);
      return;
    }
    if (MEDIAS.has(el.tagName)) { flouter(el); return; }
    // Du texte posé directement à côté de blocs (« 12 ventes » + une liste) :
    // le bloc entier est flouté, sauf un titre.
    if (Array.from(el.childNodes).some((n) => n.nodeType === 3 && /\S/.test(n.nodeValue || '')) && !estFeuilleTexte(el)) { if (!estTitre(el, style)) flouter(el); return; }
    if (estFeuilleTexte(el)) { if (!estTitre(el, style)) flouter(el); return; }
    for (const c of el.children) visiter(c);
  };
  for (const c of racine.children) visiter(c);
  return bilan;
}

// Arrête tout geste dans l'écran ; `surGeste()` montre la carte.
const EVENEMENTS = ['click', 'dblclick', 'auxclick', 'submit', 'change', 'beforeinput', 'paste', 'copy', 'cut', 'dragstart', 'contextmenu'];
export function bloquerGestes(racine, surGeste) {
  const stop = (e) => {
    if (e.target && e.target.closest && e.target.closest('[data-apercu-garde]')) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type !== 'copy' && e.type !== 'cut' && e.type !== 'contextmenu') surGeste && surGeste();
  };
  const touche = (e) => { if (['Enter', ' ', 'Spacebar'].includes(e.key) || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) stop(e); };
  EVENEMENTS.forEach((t) => racine.addEventListener(t, stop, true));
  racine.addEventListener('keydown', touche, true);
  return () => { EVENEMENTS.forEach((t) => racine.removeEventListener(t, stop, true)); racine.removeEventListener('keydown', touche, true); };
}
