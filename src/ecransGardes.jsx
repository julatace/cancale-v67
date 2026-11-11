// ════════════════════════════════════════════════════════════════════════════
//  LES ÉCRANS GARDÉS (8 nov., Julien : « tout doit aller beaucoup plus vite »).
//
//  Mesuré (docs/passation/2026-11-08-vitesse-calcul-partage.md) : revenir sur
//  Ma journée, Colis, Ventes ou Annonces REMONTAIT tout l'écran — le moteur
//  `Comptabilite` repartait de zéro (tous ses `useMemo`), le DOM était refait, et
//  12 à 30 lectures repartaient. Ici, Ma journée, Colis et Ventes déjà vus
//  restent MONTÉS, hors de la page, et reviennent tels quels.
//
//  Les règles (chacune tient un risque) :
//   · GELÉ, pas seulement caché : un écran gardé est suspendu (React.Suspense,
//     une promesse qui ne se résout jamais) — React ne le rend plus, ne le
//     valide plus, n'exécute plus aucun de ses effets. Donc un écran caché ne
//     PUBLIE rien (`vrm_colis_aposter`, `widget_stats`…) et n'écrit rien : les
//     publieurs restent uniques, ceux de l'écran montré. Ses mises à jour d'état
//     attendent et s'appliquent d'un coup à son retour.
//   · HORS DE LA PAGE : son DOM est DÉTACHÉ du document (un portail vers un
//     conteneur qu'on retire) — aucun sélecteur, aucun lecteur d'écran, aucun
//     calcul de style ne le voit. ⚠️ Ne pas le « garder dans la page, caché »
//     (`content-visibility`, `display: none`) : ~200 règles de style
//     `.vrm-main:has(.vrm-fu-colis) …`, `.vrm-app-shell:has(.vrm-fu-journee) …`
//     s'appliqueraient alors aux AUTRES écrans (essayé et mesuré le 8 nov.).
//   · RÉUTILISÉ SEULEMENT POUR UN TOUCHER DE LA BARRE (`noterNavigationSimple`).
//     Un lien, une notification, une carte de Ma journée posent souvent une
//     demande lue AU MONTAGE (une cible, un filtre) : l'écran est alors remonté,
//     comme avant.
//   · JAMAIS PÉRIMÉ : une donnée changée pendant qu'il était caché (une
//     sauvegarde d'une clé qui compte, une relecture du nuage, un signal de
//     l'extension ou des transporteurs, un retour au premier plan après 20 s)
//     ⇒ il est remonté, comme avant. Au-delà de 10 min caché, aussi. Ses
//     écoutes qui LISENT se taisent pendant qu'il est caché (`useVivant`) : pas
//     de lectures en double ; elles n'ont rien à rattraper, puisque le signal
//     le fera remonter.
//   · MÉMOIRE BORNÉE : au plus MAX_GARDES écrans (le plus ancien part).
//  Hors de ce mécanisme (tout autre écran), rien ne change.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';

// ⚠️ Pas Annonces (mesuré le 8 nov., CPU ×4) : sa grille rattachée d'un bloc (style et mise
// en page de toutes les fiches) s'affichait ~0,6 s PLUS TARD qu'un écran remonté, qui dessine
// d'abord le haut ; elle reste remontée à chaque visite, comme avant.
export const ECRANS_GARDABLES = ['journee', 'cat_bord', 'ventes'];
export const MAX_GARDES = 4;
export const AGE_MAX_CACHE_MS = 10 * 60 * 1000;
// Clés dont la sauvegarde ne rend aucun écran périmé : des préférences d'affichage
// d'UN écran (repliée / dépliée), réécrites à chaque montage de Comptabilite.
// (11 nov., reprise-ecrans) + `vrm_reprise_ecrans` : l'écran ouvert et les filtres retenus,
// réécrits à CHAQUE changement d'écran — sans elle, aucun écran ne resterait jamais gardé.
export const CLES_NEUTRES = ['vinted_analyse_open', 'vinted_tips_open', 'vinted_off_open', 'vrm_reprise_ecrans'];
// Signaux de données (même sans sauvegarde) : l'écran caché ne les a pas suivis.
const SIGNAUX = ['vrm:transp-maj', 'vrm:ebay-maj', 'vrm:suivis-relire', 'vrm:suivis-manuels', 'vrm:nuage-relu', 'vrm-prefixe', 'vrm-numero-ecrit'];

// ── La génération des données : tout ce qui rend un écran caché périmé ──────
let generation = 0;
export const generationDonnees = () => generation;
export const perimer = () => { generation++; };
let poses = false;
function poserEcoutes() {
  if (poses || typeof window === 'undefined') return;
  poses = true;
  window.addEventListener('vrm:save', (e) => { const d = e && e.detail; if (!d || !d.k || d.distant || !CLES_NEUTRES.includes(d.k)) perimer(); });
  window.addEventListener('vrm:ext', (e) => { const d = e && e.detail; if (d && d.type === 'maj') perimer(); });
  for (const n of SIGNAUX) window.addEventListener(n, perimer);
  let cacheA = 0;
  try { document.addEventListener('visibilitychange', () => { if (document.hidden) cacheA = Date.now(); else { if (cacheA && Date.now() - cacheA >= 20000) perimer(); cacheA = 0; } }); } catch (_) {}
}
poserEcoutes();

// ── Le toucher de la barre ─────────────────────────────────────────────────
const NAV = { id: null, at: 0 };
export function noterNavigationSimple(id) { NAV.id = id; NAV.at = Date.now(); }
const navigationSimple = (id) => NAV.id === id && Date.now() - NAV.at < 3000;

// Les écrans prêts à revenir tels quels (relevé pour le banc et le diagnostic).
const PRETS = new Map();   // tab → { gen, quitte }

// ── Ce que voit un composant d'un écran gardé ─────────────────────────────
//  `useVivant()` : null hors d'un écran gardé ; sinon un objet STABLE (aucun
//  rendu quand il change) : `actif` (montré ?), `surRetour(fn)` (rappelée à
//  chaque retour, sans remontage ; rend de quoi se désabonner).
const VivantCtx = React.createContext(null);
export const useVivant = () => React.useContext(VivantCtx);
export const estCache = (v) => !!(v && !v.actif);
// Montré ou non, en valeur (re-rend le composant qui le lit) : pour les portails
// vers la coque (`DansBarreHaut`) qui ne doivent pas rester derrière l'écran.
const MontreCtx = React.createContext(true);
export const useEcranGardeMontre = () => React.useContext(MontreCtx);

const JAMAIS = new Promise(() => {});
function Gel({ fige, children }) { if (fige) throw JAMAIS; return children; }
// Caché : on ne re-rend pas avec les nouvelles props de la coque (l'écran garde son dernier rendu).
const GelMemo = React.memo(Gel, (a, b) => !b.actif && a.fige === b.fige);

// ── Le même écran, au même état ? ─────────────────────────────────────────
//  La coque refait l'élément de l'écran à chacun de ses rendus (fonctions en
//  ligne, objets littéraux). S'il est ÉQUIVALENT au dernier rendu (mêmes types,
//  mêmes valeurs, mêmes références de données, fonctions au même texte), on
//  rend l'ancien élément tel quel : React n'y redescend pas (le retour sur un
//  écran gardé ne recalcule rien). Ses propres états et ses contextes, eux,
//  continuent de le mettre à jour comme d'habitude.
//  ⚠️ Une fonction au même texte peut tenir une valeur différente de la coque :
//  les fonctions passées à ces quatre écrans n'appellent que des poseurs d'état
//  (setTab, setPlatSub…) ou des fonctions qui lisent l'état par `prev =>` —
//  à garder ainsi (un nouvel appel qui capture une valeur doit la passer AUSSI
//  en prop, et l'équivalence verra son changement).
const ELEMENT = Symbol.for('react.element');
const PORTAIL = Symbol.for('react.portal');
const estObjetSimple = (x) => { if (!x || typeof x !== 'object') return false; const p = Object.getPrototypeOf(x); return p === Object.prototype || p === null; };
// `pile` (diagnostic, `window.__vrmGardeDebug`) : le chemin du premier écart.
export function egalRendu(a, b, budget = { n: 20000 }, pile = null) {
  const non = (pourquoi) => { if (pile && !pile.ecart) pile.ecart = pile.chemin.join('') + ' : ' + pourquoi; return false; };
  const sous = (etape, x, y) => { if (pile) pile.chemin.push(etape); const r = egalRendu(x, y, budget, pile); if (pile) pile.chemin.pop(); return r; };
  if (Object.is(a, b)) return true;
  if (--budget.n < 0) return non('trop grand');
  const ta = typeof a;
  if (ta !== typeof b) return non('type');
  if (ta === 'function') return a.toString() === b.toString() || non('fonction');
  if (!a || !b || ta !== 'object') return non('valeur');
  if (a.$$typeof === ELEMENT || b.$$typeof === ELEMENT) {
    if (!(a.$$typeof === b.$$typeof && a.type === b.type && a.key === b.key && a.ref === b.ref)) return non('élément');
    const nom = typeof a.type === 'string' ? a.type : (a.type && (a.type.displayName || a.type.name)) || '?';
    return sous('<' + nom + '>', a.props, b.props);
  }
  if (a.$$typeof === PORTAIL || b.$$typeof === PORTAIL) return non('portail');
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return non('liste');
    for (let i = 0; i < a.length; i++) if (!sous('[' + i + ']', a[i], b[i])) return false;
    return true;
  }
  if (!estObjetSimple(a) || !estObjetSimple(b)) return non('objet');   // Set, Map, Date… : la même référence seulement
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return non('clés');
  for (const k of ka) { if (!Object.prototype.hasOwnProperty.call(b, k)) return non('clé ' + k); if (!sous('.' + k, a[k], b[k])) return false; }
  return true;
}

function Vivant({ actif, hote, evincer, children }) {
  const dernier = React.useRef(null);
  let rendu = children;
  if (actif) {
    if (dernier.current && egalRendu(dernier.current, children)) rendu = dernier.current;
    else if (dernier.current && typeof window !== 'undefined' && window.__vrmGardeDebug) { const pile = { chemin: [], ecart: '' }; egalRendu(dernier.current, children, undefined, pile); (window.__vrmGardeEcarts = window.__vrmGardeEcarts || []).push(pile.ecart); }
    dernier.current = rendu;
  }
  const vivant = React.useRef(null);
  if (!vivant.current) {
    const retours = new Set();
    vivant.current = { actif, retours, surRetour(fn) { retours.add(fn); return () => retours.delete(fn); } };
  }
  const [conteneur] = React.useState(() => { const d = document.createElement('div'); d.className = 'vrm-ecran-vivant'; return d; });
  const [fige, setFige] = React.useState(false);
  const dejaMontre = React.useRef(false);
  return (
    <VivantCtx.Provider value={vivant.current}>
      <MontreCtx.Provider value={actif}>
        <Attacheur actif={actif} hote={hote} conteneur={conteneur} vivant={vivant.current} setFige={setFige} dejaMontre={dejaMontre} evincer={evincer}/>
        <React.Suspense fallback={null}>
          <GelMemo fige={fige && !actif} actif={actif}>{createPortal(rendu, conteneur)}</GelMemo>
        </React.Suspense>
      </MontreCtx.Provider>
    </VivantCtx.Provider>
  );
}
// Une FEUILLE de l'écran ouverte hors de lui (un portail vers <body> ou la coque :
// fiche, visionneuse, choix…) ? Elle resterait affichée par-dessus l'écran suivant
// (React ne cache pas un portail d'une limite suspendue — essayé) : l'écran n'est
// alors pas gardé, il se démonte comme avant. Reconnu par l'arbre de React (la
// fibre portée par le nœud) : on remonte jusqu'au portail de CET écran.
function feuilleOuverte(conteneur) {
  try {
    const hors = [...document.body.children];
    const coque = document.querySelector('.vrm-app-shell');
    if (coque) hors.push(...coque.children);
    for (const n of hors) {
      if (n.id === 'root' || n.hidden || n.contains(conteneur)) continue;
      const cle = Object.keys(n).find((k) => k.startsWith('__reactFiber'));
      for (let f = cle ? n[cle] : null; f; f = f.return) {
        if (f.tag === 4 && f.stateNode && f.stateNode.containerInfo === conteneur) return true;
      }
    }
  } catch (_) {}
  return false;
}
// Premier enfant de `Vivant` : ses effets de mise en page passent AVANT ceux de
// l'écran (ordre de l'arbre) — l'écran qui revient est déjà dans la page quand
// il se mesure.
function Attacheur({ actif, hote, conteneur, vivant, setFige, dejaMontre, evincer }) {
  const evincerRef = React.useRef(evincer); evincerRef.current = evincer;
  React.useLayoutEffect(() => {
    vivant.actif = actif;
    const h = hote.current;
    if (actif) { if (h && conteneur.parentNode !== h) h.appendChild(conteneur); }
    else {
      // Démonté comme avant : sa feuille avec lui, ou un écran tombé (son garde-fou
      // `GardeEcran` affiché) — y revenir doit le relancer à neuf (banc garde-ecrans P4).
      if (feuilleOuverte(conteneur) || conteneur.querySelector('[data-garde-ecran]')) { evincerRef.current(); return; }
      if (conteneur.parentNode) conteneur.parentNode.removeChild(conteneur);
    }
    setFige(!actif);
  }, [actif, hote, conteneur, vivant, setFige]);
  React.useEffect(() => {
    if (!actif) return;
    if (dejaMontre.current) for (const fn of [...vivant.retours]) { try { fn(); } catch (_) {} }
    dejaMontre.current = true;
  }, [actif, vivant, dejaMontre]);
  React.useLayoutEffect(() => () => { if (conteneur.parentNode) conteneur.parentNode.removeChild(conteneur); }, [conteneur]);
  return null;
}

// ── La coque : `<EcransGardes ecran={tab} cle={uid}>{l'écran montré}</EcransGardes>` ──
//  `children` est l'écran COURANT (le même élément qu'avant) ; un écran gardable
//  est rendu dans son `Vivant`, les autres comme avant, à la même place.
export function EcransGardes({ ecran, cle = '', pret = true, children }) {
  const hote = React.useRef(null);
  const etat = React.useRef({ liste: [], dernier: null, cle, n: 0 });
  const [, forcer] = React.useState(0);
  const e = etat.current;
  if (e.cle !== cle) { e.liste = []; e.dernier = null; e.cle = cle; PRETS.clear(); }
  const gardable = ECRANS_GARDABLES.includes(ecran);
  // Décidé UNE fois par changement d'écran (rendu rejoué ⇒ même décision).
  if (e.dernier !== ecran) {
    const parti = e.liste.find((x) => x.tab === e.dernier);
    if (parti) { parti.quitte = Date.now(); parti.gen = generation; PRETS.set(parti.tab, { gen: parti.gen, quitte: parti.quitte }); }
    if (gardable) {
      const ici = e.liste.find((x) => x.tab === ecran);
      const garder = ici && navigationSimple(ecran) && ici.gen === generation && Date.now() - ici.quitte < AGE_MAX_CACHE_MS;
      if (ici && !garder) ici.cle = ecran + '#' + (++e.n);       // remonté, comme avant
      if (!ici) e.liste.push({ tab: ecran, cle: ecran + '#' + (++e.n), quitte: 0, gen: generation });
      PRETS.delete(ecran);
      // Au-delà de MAX_GARDES, le plus anciennement quitté part (l'ordre de la liste ne bouge pas).
      while (e.liste.length > MAX_GARDES) {
        const v = e.liste.filter((x) => x.tab !== ecran).sort((a, b) => a.quitte - b.quitte)[0];
        e.liste = e.liste.filter((x) => x !== v); PRETS.delete(v.tab);
      }
    }
    e.dernier = ecran;
  }
  const evincer = React.useCallback((cleV) => {
    const x = etat.current.liste.find((y) => y.cle === cleV);
    if (!x) return;
    etat.current.liste = etat.current.liste.filter((y) => y !== x); PRETS.delete(x.tab);
    forcer((n) => n + 1);
  }, []);
  // `pret` faux (la section de l'écran n'est pas encore posée) : l'écran visé reste gelé
  // un rendu de plus — jamais rendu avec la section de l'écran d'avant.
  const montre = gardable && pret ? ecran : null;
  return (
    <>
      <div ref={hote} className="vrm-ecrans-gardes" data-ecrans-gardes={e.liste.map((x) => x.tab).join(' ')}/>
      {e.liste.map((x) => <Vivant key={x.cle} actif={x.tab === montre} hote={hote} evincer={() => evincer(x.cle)}>{x.tab === montre ? children : null}</Vivant>)}
      {!gardable && children}
    </>
  );
}
export default EcransGardes;
