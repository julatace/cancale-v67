// ════════════════════════════════════════════════════════════════════════════
//  L'ATTENTE D'UN ÉCRAN (6 nov., Julien : « les données apparaissent de partout,
//  je veux qu'il y ait de vrais écrans de chargement »).
//
//  Un écran nomme ses données ESSENTIELLES (`attendus`). Tant que l'une d'elles
//  est `undefined` (lecture en cours), l'écran est MONTÉ — ses lectures partent —
//  mais invisible et sans hauteur, et son squelette (src/Squelette.jsx) tient la
//  place. Quand elles sont là, il apparaît d'UN bloc (fondu de 180 ms) ; ce qui
//  arrive ensuite arrive dans un écran déjà posé.
//    · Une donnée essentielle se signale de deux façons : la coque la passe dans
//      `donnees` (ce qu'elle lit elle-même : comptes, nuage, sites), ou l'écran
//      l'annonce de l'intérieur (`useEssentiel(nom, valeur)`).
//    · « Là » veut dire `!== undefined` : `null` (pas su — la lecture a ÉCHOUÉ)
//      est une réponse, l'écran s'ouvre et dit sa panne à sa place (EtatPanne),
//      une fois. Jamais un écran qui saute de la panne au contenu : une fois
//      ouvert, il le reste (rien ne le referme tant qu'on y est).
//    · Plafond : ~2,5 s après le montage, l'écran s'ouvre avec ce qui est sûr ;
//      ses emplacements encore vides gardent leur « chargement » (jamais un « pas
//      lu » qui deviendra une valeur, §5 « pas su ne vaut pas oui »).
//    · Revenir sur un écran déjà vu (ouvert avec ses données dans cette page) :
//      aucun squelette, l'écran revient avec ce qu'il a en mémoire (cache des
//      lectures, src/memoireEcrans.js) et se complète en place.
//  Tant qu'un écran attend, son squelette porte `data-demarrage-attente` : à
//  l'ouverture de l'app, l'écran de démarrage (src/demarrage.js) reste devant.
//  (9 nov., Julien : « Ma journée affichée tout de suite ») Un écran qui a un
//  INSTANTANÉ (`instantane` : les derniers chiffres rendus sur CET appareil, pour
//  CE compte — src/journeeInstantanee.js) le montre À LA PLACE du squelette, sans
//  `data-demarrage-attente` (l'écran de démarrage s'en va), et n'ouvre l'écran vrai
//  que quand ses données sont TOUTES là (`tout`), ou au plafond long
//  (`plafondInstantaneMs`). L'instantané est inerte : aucun geste n'en part.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { Squelette } from './Squelette.jsx';
import { rafraichirDrapeaux } from './drapeauxRacine.js';
import { MUTATION_COPIE } from './copieEcran.js';

export const PLAFOND_ATTENTE_MS = 2500;
// Avec un instantané à montrer, l'écran vrai attend ses données jusqu'à ce plafond.
export const PLAFOND_INSTANTANE_MS = 20000;
// (21 nov., fluidité) Données là, l'écran vrai attend encore que son PREMIER ÉCRAN soit rempli (aucun squelette natif
// dedans) — au plus ce temps-là, une copie montrée (elle tient la place, rien ne presse), ou un squelette.
export const PLAFOND_PEINT_COPIE_MS = 6000;
export const PLAFOND_PEINT_MS = 1200;
// Les briques d'attente (src/natif/Attente.jsx `.n-os`, src/Squelette.jsx `.vrm-sq-barre`) : les mêmes que celles qui
// empêchent une copie d'être prise (src/copieEcran.js `capturerCopie`).
export const SELECTEUR_BRIQUES = '.n-os, .vrm-sq-barre';
// Une brique d'attente dans la première hauteur de fenêtre de l'écran vrai (encore caché, posé à sa place : `.vrm-attente-cache`
// le met en haut de l'attente, à la même largeur — ses mesures sont celles qu'il aura).
export function attenteDansPremierEcran(el) {
  try {
    const H = (typeof window !== 'undefined' && window.innerHeight) || 800;
    for (const b of el.querySelectorAll(SELECTEUR_BRIQUES)) {
      const r = b.getBoundingClientRect();
      if (r.height > 0 && r.width > 0 && r.top < H && r.bottom > 0) return true;
    }
  } catch (_) {}
  return false;
}
const Ctx = React.createContext(null);
// (6 nov., v36-raccords) L'écran est-il MONTRÉ ? Faux tant qu'il attend (monté, caché) :
// un conseil (src/Conseils.jsx) ne se décide pas sur un écran que personne ne voit encore.
// Hors d'une attente : vrai.
const VisibleCtx = React.createContext(true);
export function useEcranMontre() { return React.useContext(VisibleCtx); }

// L'écran dit qu'une donnée essentielle est là (`valeur !== undefined`).
// Hors d'une attente (écran sans attente, feuille), ne fait rien.
// `nom` vide : ce composant ne lit pas cette donnée ici (il ne la retient pas).
// Deux composants peuvent porter la même donnée (Colis monte deux lecteurs) :
// elle n'est « là » que quand TOUS ceux qui l'ont annoncée la disent là.
export function useEssentiel(nom, valeur) {
  const ctx = React.useContext(Ctx);
  const id = React.useId();
  const la = valeur !== undefined;
  React.useLayoutEffect(() => { if (ctx && nom) ctx.signaler(id, nom, la); }, [ctx, id, nom, la]);
  React.useLayoutEffect(() => () => { if (ctx && nom) ctx.oublier(id, nom); }, [ctx, id, nom]);
}
// Le plafond est passé et l'écran s'est ouvert sans toutes ses données.
export function useAttentePlafond() {
  const ctx = React.useContext(Ctx);
  return !!(ctx && ctx.plafond);
}
// (9 nov.) Toutes les données essentielles de l'écran sont là (pas seulement le plafond) :
// c'est le seul moment où un instantané peut être pris. Hors d'une attente : faux.
export function useAttenteComplete() {
  const ctx = React.useContext(Ctx);
  return !!(ctx && ctx.tout);
}

// Les écrans déjà OUVERTS avec leurs données dans cette page (par vendeur) : y revenir
// ne remonte pas le squelette — l'écran revient avec ce qu'il a en mémoire et se
// complète en place (les lectures en cache se reposent dans les millisecondes qui suivent).
const VUS = new Set();

// (19 nov.) Avant que l'écran se MESURE (ses effets de mise en page passent après celui-ci, placé devant lui) : les
// drapeaux de racine (src/drapeauxRacine.js) sont à jour — les règles « cet écran porte tel bloc » s'appliquent déjà.
function DrapeauxAvantMesure() { React.useLayoutEffect(() => { rafraichirDrapeaux(); }); return null; }

export function AttenteEcran({ ecran, attendus = [], donnees = null, ordi = false, plafondMs = PLAFOND_ATTENTE_MS, memoire = '', instantane = null, plafondInstantaneMs = PLAFOND_INSTANTANE_MS, garderInstantane = false, children }) {
  const recus = React.useRef({});
  const [, rafraichir] = React.useState(0);
  const [plafond, setPlafond] = React.useState(false);
  const cleVu = memoire || ecran;
  const [ouvert, setOuvert] = React.useState(() => VUS.has(cleVu));
  const aAttendu = React.useRef(false);
  const signaler = React.useCallback((id, nom, la) => {
    const m = recus.current[nom] || (recus.current[nom] = new Map());
    if (m.get(id) === la) return;
    m.set(id, la);
    rafraichir((t) => t + 1);
  }, []);
  const oublier = React.useCallback((id, nom) => {
    const m = recus.current[nom];
    if (m && m.delete(id)) rafraichir((t) => t + 1);
  }, []);
  // Après la première passe (les composants montés se sont annoncés), une donnée qu'AUCUN
  // composant monté n'annonce n'est pas attendue (l'écran n'en a pas sur ce filtre).
  // (20 nov., affichage instantané) Avec une copie à montrer et un écran jamais ouvert dans la page : la copie est
  // PEINTE d'abord ; l'écran vrai (son premier rendu coûte jusqu'à plusieurs secondes au téléphone) n'est monté qu'à
  // l'image suivante — le toucher d'un onglet montre tout de suite quelque chose de vrai, jamais l'ancien écran figé.
  const [enfants, setEnfants] = React.useState(() => !(instantane && !VUS.has(cleVu)));
  React.useEffect(() => {
    if (enfants) return undefined;
    let a = 0, b = 0;
    try { a = requestAnimationFrame(() => { b = setTimeout(() => setEnfants(true), 0); }); } catch (_) {}
    const filet = setTimeout(() => setEnfants(true), 250);   // onglet caché : pas d'image, on n'attend pas
    return () => { try { cancelAnimationFrame(a); } catch (_) {} clearTimeout(b); clearTimeout(filet); };
  }, [enfants]);
  const [monte, setMonte] = React.useState(false);
  const [peint, setPeint] = React.useState(false);
  const hoteVrai = React.useRef(null);
  // Les composants de l'écran s'annoncent dans leurs effets de mise en page, AVANT celui-ci : après lui, ce qui n'est
  // pas annoncé n'est pas attendu.
  React.useLayoutEffect(() => { if (enfants) setMonte(true); }, [enfants]);
  const lu = (n) => { const m = recus.current[n]; return m && m.size > 0 ? [...m.values()].every(Boolean) : monte; };
  const la = (n) => (donnees && Object.prototype.hasOwnProperty.call(donnees, n) ? donnees[n] !== undefined : lu(n));
  const tout = attendus.every(la);
  // (20 nov., affichage instantané) Une lecture RATÉE (base injoignable, hors ligne) avec une copie à montrer : la copie
  // RESTE (« Pas à jour · Réessayer », src/CopieEcran.jsx) au lieu d'un écran vide qui dirait sa panne.
  const garde = !!instantane && !!garderInstantane && !ouvert && MUTATION_COPIE !== 'panne';
  const visible = !garde && enfants && (ouvert || (tout && peint) || plafond);
  // Une fois ouvert, il le reste.
  React.useLayoutEffect(() => { if (visible && !ouvert) setOuvert(true); }, [visible, ouvert]);
  // Ouvert par ses données (pas par le plafond) : la prochaine fois, il revient sans squelette.
  React.useEffect(() => { if (tout && attendus.length) VUS.add(cleVu); }, [tout, cleVu, attendus.length]);
  // L'instantané n'est montré que tant que l'écran n'a jamais été ouvert : une fois ouvert, il le reste.
  const avecInstantane = !!instantane && !ouvert;
  const vuInstantane = React.useRef(false);
  if (!visible && avecInstantane) vuInstantane.current = true;
  if (!visible && !avecInstantane) aAttendu.current = true;
  // (21 nov., fluidité) L'écran vrai est-il PEINT ? Ses données essentielles sont là, mais une partie de son premier écran
  // peut encore attendre la sienne (une liste qui se calcule, son squelette natif `.n-os`) : tant que c'est le cas, ce qui
  // est montré (la copie, le squelette) reste — l'écran vrai prend la place d'un bloc, déjà rempli, jamais une copie
  // remplacée par des blocs gris qui se remplissent ensuite (mesuré, banc couches-chargement : Ventes au toucher, copie →
  // squelettes → liste, CLS 0,32). Borné : `PLAFOND_PEINT_*` après les données.
  React.useEffect(() => {
    if (ouvert || peint || !enfants || !tout) return undefined;
    const el = hoteVrai.current;
    if (!el || typeof MutationObserver === 'undefined') { setPeint(true); return undefined; }
    let fini = false, image = 0, obs = null;
    const conclure = () => { if (fini) return; fini = true; setPeint(true); };
    const voir = () => { image = 0; if (!fini && !attenteDansPremierEcran(el)) conclure(); };
    const bientot = () => { if (!image && !fini) { try { image = requestAnimationFrame(voir); } catch (_) { voir(); } } };
    try { obs = new MutationObserver(bientot); obs.observe(el, { subtree: true, childList: true }); } catch (_) {}
    const plafondPeint = setTimeout(conclure, avecInstantane ? PLAFOND_PEINT_COPIE_MS : PLAFOND_PEINT_MS);
    voir();
    return () => { fini = true; clearTimeout(plafondPeint); try { if (image) cancelAnimationFrame(image); } catch (_) {} try { if (obs) obs.disconnect(); } catch (_) {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, peint, enfants, tout]);
  React.useEffect(() => {
    if (ouvert) return undefined;
    const t = setTimeout(() => setPlafond(true), avecInstantane ? Math.max(plafondMs, plafondInstantaneMs) : plafondMs);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, avecInstantane]);
  const ctx = React.useMemo(() => ({ signaler, oublier, plafond, tout }), [signaler, oublier, plafond, tout]);
  const manquent = visible ? [] : attendus.filter((n) => !la(n));
  return <div className="vrm-attente" data-attente={visible ? (tout ? 'pret' : 'plafond') : (avecInstantane ? 'instantane' : 'attente')} data-attente-ecran={ecran} data-attente-manque={manquent.join(' ') || undefined} data-attente-instantane={vuInstantane.current ? '1' : undefined}>
    <DrapeauxAvantMesure/>
    {/* L'instantané prend le cadre de l'écran prêt (`vrm-attente-pret` : mêmes marges), sans fondu. */}
    {/* (20 nov.) La COPIE d'un écran (src/CopieEcran.jsx, `sansCadre`) se pose APRÈS l'écran vrai caché : ses `id` copiés
        ne passent jamais devant ceux de l'écran vrai (`getElementById` rend l'élément vrai dès qu'il est monté). */}
    {!visible && !(avecInstantane && instantane.type && instantane.type.sansCadre) && (avecInstantane ? <div className="vrm-attente-pret vrm-attente-sans-fondu" data-attente-instantane-cadre="">{instantane}</div> : <Squelette ecran={ecran} ordi={ordi} data-demarrage-attente=""/>)}
    {/* Remplacé EN PLACE : après un instantané, l'écran vrai arrive sans fondu (rien ne « réapparaît »). */}
    <div ref={hoteVrai} className={visible ? (vuInstantane.current ? 'vrm-attente-pret vrm-attente-sans-fondu' : aAttendu.current ? 'vrm-attente-pret' : undefined) : 'vrm-attente-cache'} aria-hidden={visible ? undefined : 'true'}>
      <Ctx.Provider value={ctx}><VisibleCtx.Provider value={visible}>{enfants ? children : null}</VisibleCtx.Provider></Ctx.Provider>
    </div>
    {!visible && avecInstantane && instantane.type && instantane.type.sansCadre ? instantane : null}
  </div>;
}
export default AttenteEcran;
