// ════════════════════════════════════════════════════════════════════════════
//  « DÉPOSÉ » DEPUIS LA LISTE DES VENTES (1er nov., maquette « ventes-B-journal »)
//  Sur téléphone, une vente À EXPÉDIER se glisse vers la gauche pour dire
//  « Déposé » (src/LigneGlissable.jsx). Le bouton « Déposé » de la ligne fait EXACTEMENT la même chose
//  (jamais un geste caché seul). Les deux appellent `demander`, qui n'écrit
//  RIEN tout de suite : une barre « Déposé · Annuler » reste quelques secondes ;
//  « Annuler » ⇒ rien n'est écrit. Passé le délai (ou un autre « Déposé », ou
//  l'écran quitté), l'écriture part — le geste EXISTANT « ✓ Colis fait » de
//  Colis (`marquerPoste` : `vinted_ship_done` + `vinted_bords_shipped`).
//  Aucun geste automatique : rien ne part sans son doigt.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import './styles-ventes-ligne.css';

export const DELAI_ANNULER_DEPOSE = 5000;

// La file d'UN « Déposé » en attente. `ecrire(o)` est l'écriture réelle.
// `ecrireHorsEcran(o)` : la même écriture quand l'écran a disparu (un état React
// démonté n'écrit plus rien) — sinon `ecrire`.
export function useDeposeDiffere(ecrire, delai = DELAI_ANNULER_DEPOSE, ecrireHorsEcran = null) {
  const [attente, setAttente] = React.useState(null);   // { cle, o, libelle }
  const ref = React.useRef({ attente: null, timer: null, ecrire, ecrireHorsEcran });
  ref.current.ecrire = ecrire; ref.current.ecrireHorsEcran = ecrireHorsEcran;
  const valider = React.useCallback(() => {
    const r = ref.current;
    if (r.timer) { clearTimeout(r.timer); r.timer = null; }
    const a = r.attente; r.attente = null;
    setAttente(null);
    if (a) { try { r.ecrire(a.o); } catch (_) {} }
  }, []);
  const demander = React.useCallback((cle, o, libelle) => {
    const r = ref.current;
    if (r.attente && r.attente.cle === cle) return;
    if (r.attente) valider();            // un second « Déposé » écrit le premier
    r.attente = { cle: String(cle), o, libelle: libelle || '' };
    setAttente(r.attente);
    r.timer = setTimeout(valider, delai);
  }, [delai, valider]);
  const annuler = React.useCallback(() => {
    const r = ref.current;
    if (r.timer) { clearTimeout(r.timer); r.timer = null; }
    r.attente = null; setAttente(null);
  }, []);
  // L'écran quitté pendant l'attente : le geste a été fait, il est écrit.
  React.useEffect(() => () => { const r = ref.current; if (r.timer) clearTimeout(r.timer); r.timer = null; const a = r.attente; r.attente = null; if (a) { try { (r.ecrireHorsEcran || r.ecrire)(a.o); } catch (_) {} } }, []);
  return { attente, demander, annuler, valider };
}

export function BarreAnnulerDepose({ attente, onAnnuler, zIndex = 19000 }) {
  if (!attente) return null;
  return createPortal(
    <div className="vrm-depose-barre" role="status" aria-live="polite" data-depose-barre={attente.cle} style={{ zIndex }}>
      <span className="vrm-depose-barre-t">{attente.libelle ? `${attente.libelle} : déposé` : 'Déposé'}</span>
      <button type="button" className="vrm-depose-annuler" data-depose-annuler={attente.cle} onClick={onAnnuler}>Annuler</button>
    </div>,
    document.body
  );
}

// (11 nov., gestes-glisser) Le glisser de la ligne vit dans src/LigneGlissable.jsx (un seul composant,
// réutilisé par Ventes, Achats et Annonces) ; ici ne restent que la file « Déposé » et sa barre « Annuler ».
