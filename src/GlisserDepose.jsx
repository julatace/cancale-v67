// ════════════════════════════════════════════════════════════════════════════
//  « DÉPOSÉ » DEPUIS LA LISTE DES VENTES (1er nov., maquette « ventes-B-journal »)
//  Sur téléphone, une vente À EXPÉDIER se glisse vers la gauche pour dire
//  « Déposé ». Le bouton « Déposé » de la ligne fait EXACTEMENT la même chose
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

// La ligne qui se glisse — un rendu à fonction : `children(gp)` reçoit les
// propriétés à poser sur la LIGNE elle-même (aucune enveloppe : les règles
// `.vrm-ventes-liste > .vrm-sale-row` restent vraies). `actif` faux ⇒ `gp` vide.
// Le « Déposé » révélé à droite est dessiné par la feuille (`::after`).
const SEUIL = 0.32;     // part de la largeur à glisser pour valider
export function GlisserVente({ actif, onDepose, children }) {
  const g = React.useRef(null);   // { id, x0, y0, dx, sens, w, el }
  const avale = React.useRef(false);
  const [dx, setDx] = React.useState(0);
  if (!actif) return children({});
  const fin = (valide) => {
    const s = g.current; g.current = null;
    setDx(0);
    if (s && s.sens === 'h') { avale.current = true; setTimeout(() => { avale.current = false; }, 350); }
    if (valide && onDepose) onDepose();
  };
  const gp = {
    'data-glisse-depose': '',
    'data-glisse-actif': dx ? '1' : undefined,
    'data-glisse-pret': dx && g.current && -dx >= g.current.w * SEUIL ? '1' : undefined,
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      if (e.target && e.target.closest && e.target.closest('input,textarea,select,a,[data-sans-glisse]')) return;
      g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, sens: null, w: e.currentTarget.offsetWidth || 360, el: e.currentTarget };
    },
    onPointerMove: (e) => {
      const s = g.current; if (!s || e.pointerId !== s.id) return;
      const ddx = e.clientX - s.x0, ddy = e.clientY - s.y0;
      if (!s.sens) {
        if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return;
        s.sens = Math.abs(ddx) > Math.abs(ddy) * 1.4 && ddx < 0 ? 'h' : 'v';
        if (s.sens === 'h') { try { s.el.setPointerCapture(e.pointerId); } catch (_) {} }
      }
      if (s.sens !== 'h') return;
      s.dx = Math.max(-s.w * 0.6, Math.min(0, ddx));
      setDx(s.dx);
    },
    onPointerUp: (e) => { const s = g.current; if (!s || e.pointerId !== s.id) return; fin(s.sens === 'h' && -s.dx >= s.w * SEUIL); },
    onPointerCancel: () => { if (g.current) fin(false); },
    onClickCapture: (e) => { if (avale.current) { e.preventDefault(); e.stopPropagation(); } },
    style: dx ? { transform: `translate3d(${dx}px,0,0)`, transition: 'none' } : undefined,
  };
  return children(gp);
}
