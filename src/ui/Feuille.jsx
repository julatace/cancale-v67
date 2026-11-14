// ── src/ui/Feuille.jsx — la petite feuille des briques de liste ─────────────────
// Une carte qui monte du bas (au centre à l'ordinateur), un voile, un titre, « OK ».
// Portail sur <body> (au-dessus de tout : z 20000, celui des confirmations), Échap et
// le voile ferment. Pour une feuille PLEIN ÉCRAN, prendre `SheetShell` de l'app (qui
// porte `FermeAuRetour`) : celle-ci est faite pour un choix court (compte, À faire).
//   <Feuille titre="Comptes" onClose={…}>…</Feuille>
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import './ui.css';

export function Feuille({ titre, onClose, children, ...attrs }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', k);
    const avant = document.activeElement;
    try { if (ref.current) ref.current.focus(); } catch (_) {}
    return () => { window.removeEventListener('keydown', k); try { if (avant && avant.focus) avant.focus(); } catch (_) {} };
  }, [onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-ui-voile" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div ref={ref} tabIndex={-1} className="vrm-ui-feuille" role="dialog" aria-modal="true" aria-label={typeof titre === 'string' ? titre : undefined} data-noswipe="" {...attrs}>
        <div className="vrm-ui-feuille-tete">
          <h2 className="vrm-ui-feuille-titre">{titre}</h2>
          <button type="button" className="vrm-ui-feuille-fermer" onClick={onClose}>{tr('listes.ok')}</button>
        </div>
        {children}
      </div>
    </div>, document.body);
}
export default Feuille;
