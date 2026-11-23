// ── src/natif/Toast.jsx — le message passager, au-dessus de la barre d'onglets ───────────
// Il dit ce qui VIENT d'être fait et laisse 10 s pour l'annuler. Pas de confirmation avant un geste
// sans risque : on le fait, on le dit, on laisse l'annuler (NATIF.md §4 « pratique, pas pénible »).
// Props :
//   message    la phrase (15/20) — « Marqué envoyé · N° 124 »
//   onAnnuler  ⇒ un bouton « Annuler » (le geste est défait par l'écran)
//   libelleAnnuler  (rare) un autre mot que « Annuler »
//   onFin      appelé quand le toast a fini (10 s, ou après « Annuler ») : l'écran le retire de son état
//   duree      ms (défaut 10 000) ; le compte s'arrête tant que le pointeur ou le focus est dessus
// Un toast à la fois : l'écran rend le dernier (clé = son identité) ; le précédent sort.
// Exemple :
//   {fait ? <Toast key={fait.id} message={`Marqué envoyé · N° ${fait.numero}`} onAnnuler={() => defaire(fait)} onFin={() => setFait(null)}/> : null}
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx, useDernier } from './outils.js';

export function Toast({ message, onAnnuler = null, libelleAnnuler = '', onFin = null, duree = 10000, className = '' }) {
  const refFin = useDernier(onFin);
  const [tenu, setTenu] = React.useState(false);
  const reste = React.useRef(duree), depuis = React.useRef(0);
  React.useEffect(() => {
    if (tenu) return undefined;
    depuis.current = Date.now();
    const t = setTimeout(() => { const f = refFin.current; if (f) f(); }, Math.max(0, reste.current));
    return () => { clearTimeout(t); reste.current -= Date.now() - depuis.current; };
  }, [tenu, refFin]);
  return (
    <div
      className={cx('n-toast', className)}
      role="status"
      aria-live="polite"
      onPointerEnter={() => setTenu(true)}
      onPointerLeave={() => setTenu(false)}
      onFocus={() => setTenu(true)}
      onBlur={() => setTenu(false)}
    >
      <span className="n-toast-message">{message}</span>
      {onAnnuler ? (
        <button type="button" className="n-toast-action" onClick={() => { onAnnuler(); const f = refFin.current; if (f) f(); }}>
          {libelleAnnuler || tr('natif.annuler')}
        </button>
      ) : null}
    </div>
  );
}

export default Toast;
