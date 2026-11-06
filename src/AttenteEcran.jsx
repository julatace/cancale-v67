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
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { Squelette } from './Squelette.jsx';

export const PLAFOND_ATTENTE_MS = 2500;
const Ctx = React.createContext(null);

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

// Les écrans déjà OUVERTS avec leurs données dans cette page (par vendeur) : y revenir
// ne remonte pas le squelette — l'écran revient avec ce qu'il a en mémoire et se
// complète en place (les lectures en cache se reposent dans les millisecondes qui suivent).
const VUS = new Set();

export function AttenteEcran({ ecran, attendus = [], donnees = null, ordi = false, plafondMs = PLAFOND_ATTENTE_MS, memoire = '', children }) {
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
  const [monte, setMonte] = React.useState(false);
  React.useLayoutEffect(() => { setMonte(true); }, []);
  const lu = (n) => { const m = recus.current[n]; return m && m.size > 0 ? [...m.values()].every(Boolean) : monte; };
  const la = (n) => (donnees && Object.prototype.hasOwnProperty.call(donnees, n) ? donnees[n] !== undefined : lu(n));
  const tout = attendus.every(la);
  const visible = ouvert || tout || plafond;
  // Une fois ouvert, il le reste.
  React.useLayoutEffect(() => { if (visible && !ouvert) setOuvert(true); }, [visible, ouvert]);
  // Ouvert par ses données (pas par le plafond) : la prochaine fois, il revient sans squelette.
  React.useEffect(() => { if (tout && attendus.length) VUS.add(cleVu); }, [tout, cleVu, attendus.length]);
  if (!visible) aAttendu.current = true;
  React.useEffect(() => {
    if (ouvert) return undefined;
    const t = setTimeout(() => setPlafond(true), plafondMs);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);
  const ctx = React.useMemo(() => ({ signaler, oublier, plafond }), [signaler, oublier, plafond]);
  const manquent = visible ? [] : attendus.filter((n) => !la(n));
  return <div className="vrm-attente" data-attente={visible ? (tout ? 'pret' : 'plafond') : 'attente'} data-attente-ecran={ecran} data-attente-manque={manquent.join(' ') || undefined}>
    {!visible && <Squelette ecran={ecran} ordi={ordi} data-demarrage-attente=""/>}
    <div className={visible ? (aAttendu.current ? 'vrm-attente-pret' : undefined) : 'vrm-attente-cache'} aria-hidden={visible ? undefined : 'true'}>
      <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
    </div>
  </div>;
}
export default AttenteEcran;
