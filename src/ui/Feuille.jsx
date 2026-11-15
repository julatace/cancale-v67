// (14 nov., Studio bleu clair) La feuille est PORCELAINE (`sb-feuille`, rayon 28) ; « OK » est un LIEN (`sb-lien`).
// ── src/ui/Feuille.jsx — la petite feuille des briques de liste ─────────────────
// Une carte qui monte du bas (au centre à l'ordinateur), un voile, un titre, « OK ».
// Portail sur <body> (au-dessus de tout : z 20000, celui des confirmations). Pour une feuille
// PLEIN ÉCRAN, prendre `SheetShell` de l'app : celle-ci est faite pour un choix court (compte, À faire).
//   <Feuille titre="Comptes" onClose={…}>…</Feuille>
//
// (14 nov., correctif « À faire » — Julien bloqué sur son iPhone, Annonces · Vestiaire, la feuille
// « À faire » ouverte que rien ne fermait ; récit docs/passation/2026-11-14-correctif-afaire.md.)
// Elle se ferme de QUATRE façons, partout, et ne laisse rien derrière elle :
//   · « OK » ; · le voile ; · glisser vers le bas (la poignée ou le titre, au doigt comme à la souris) ;
//   · le geste « retour » (et Échap) : le vrai `FermeAuRetour` de l'app (src/ui/retour.jsx).
// `ouvert` (vrai par défaut) : une feuille qui doit rester MONTÉE fermée (`AFaireSite` : ses enfants
// portent des états longs) passe `ouvert={false}` — alors le voile ne porte PLUS la classe
// `vrm-ui-voile` (dont le `display:flex !important` passait devant l'attribut `hidden` : la feuille
// « fermée » restait dessinée, et « OK » ne pouvait rien fermer), il est `hidden` et `display:none`.
// Le focus entre sans faire défiler la page (`preventScroll`) et revient, sans défiler non plus, à
// ce qui l'avait ; `onClose` est lu dans une référence (un écran qui se redessine ne relance rien).
import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { FermeAuRetourUi, retourDisponible } from './retour.jsx';
import './ui.css';

const mouvementReduit = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
const COURBE = 'cubic-bezier(.32,.72,0,1)';

// Les couches modales qu'un geste peut ouvrir : une feuille (`SheetShell`, celle-ci), une confirmation.
const SEL_COUCHES = '[aria-modal="true"], [role="alertdialog"], [data-feuille], .vrm-fs';
export function Feuille({ titre, onClose, children, ouvert = true, className = '', voileClassName = '', fermeSiAutreCouche = false, ...attrs }) {
  const ref = useRef(null), refVoile = useRef(null), refGeste = useRef(null);
  const refFermer = useRef(onClose); refFermer.current = onClose;
  const fermer = useCallback(() => { const f = refFermer.current; if (f) f(); }, []);

  // La position de la feuille (glisser) et l'opacité du voile qui la suit.
  const poser = (y, anime) => {
    const el = ref.current; if (!el) return;
    el.style.transition = anime && !mouvementReduit() ? `transform 220ms ${COURBE}` : 'none';
    el.style.transform = y ? `translate3d(0,${y}px,0)` : '';
    const v = refVoile.current;
    if (v) { v.style.transition = el.style.transition.replace('transform', 'opacity'); v.style.opacity = y ? String(Math.max(0, 1 - y / ((el.offsetHeight || 1) * 1.2))) : ''; }
  };
  const remettre = () => {
    const el = ref.current; if (el) { el.style.transition = ''; el.style.transform = ''; el.style.animation = ''; el.removeAttribute('data-feuille-geste'); }
    const v = refVoile.current; if (v) { v.style.transition = ''; v.style.opacity = ''; }
  };

  useEffect(() => {
    if (!ouvert) return undefined;
    const el = ref.current;
    const avant = typeof document !== 'undefined' ? document.activeElement : null;
    try { if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true }); } catch (_) {}
    // Échap : celui de `FermeAuRetour` quand l'app l'a posé (la feuille du DESSUS seulement) ; sinon le nôtre.
    const k = retourDisponible() ? null : (e) => { if (e.key === 'Escape' && !e.defaultPrevented) fermer(); };
    if (k) window.addEventListener('keydown', k);
    return () => {
      if (k) window.removeEventListener('keydown', k);
      refGeste.current = null;
      remettre();
      try {
        const ici = document.activeElement;
        if (avant && avant !== document.body && avant.isConnected && typeof avant.focus === 'function' && (!ici || ici === document.body || (el && el.contains(ici)))) avant.focus({ preventScroll: true });
      } catch (_) {}
    };
  }, [ouvert, fermer]);

  // `fermeSiAutreCouche` (les feuilles « À faire ») : un geste de la feuille qui OUVRE une autre couche (une
  // feuille, une saisie, une confirmation — n'importe laquelle, marquée ou non) la referme. Sinon la couche
  // demandée s'ouvrait DERRIÈRE notre voile (z 20000) : invisible, et le doigt ne trouvait rien. On regarde
  // pendant 1,5 s après le toucher (un écran chargé à la demande arrive après son clic).
  useEffect(() => {
    if (!ouvert || !fermeSiAutreCouche) return undefined;
    const el = ref.current; if (!el) return undefined;
    const couches = () => [...document.querySelectorAll(SEL_COUCHES)].filter((x) => x !== el && !el.contains(x) && !x.contains(el) && x.getClientRects().length > 0);
    let t = null;
    const clic = (e) => {
      if (!e.target || !e.target.closest || !e.target.closest('button, a, [role="button"], summary, input, select')) return;
      const avant = new Set(couches());
      clearTimeout(t);
      let n = 0;
      const voir = () => { if (couches().some((x) => !avant.has(x))) { fermer(); return; } if (++n < 15) t = setTimeout(voir, 100); };
      t = setTimeout(voir, 0);
    };
    el.addEventListener('click', clic, true);
    return () => { el.removeEventListener('click', clic, true); clearTimeout(t); };
  }, [ouvert, fermeSiAutreCouche, fermer]);

  // Glisser vers le bas : la poignée et la tête se prennent au doigt (pas « OK »).
  const debut = (e) => {
    if (!ouvert || refGeste.current || (e.button != null && e.button !== 0)) return;
    if (e.target && e.target.closest && e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    const el = ref.current; if (!el) return;
    el.style.animation = 'none';   // l'animation d'entrée (`both`) passerait devant la position posée
    refGeste.current = { id: e.pointerId, y0: e.clientY, y: 0, hist: [{ t: performance.now(), y: 0 }] };
    el.setAttribute('data-feuille-geste', 'suit');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const bouge = (e) => {
    const g = refGeste.current; if (!g || g.id !== e.pointerId) return;
    const brut = e.clientY - g.y0;
    const y = brut < 0 ? -Math.min(24, -brut / 4) : brut;   // vers le haut : elle résiste
    g.y = y; g.hist.push({ t: performance.now(), y }); if (g.hist.length > 6) g.hist.shift();
    poser(y, false);
  };
  const fin = (e) => {
    const g = refGeste.current; if (!g || g.id !== e.pointerId) return;
    refGeste.current = null;
    const el = ref.current; if (!el) return;
    const h = el.offsetHeight || 400;
    const t = performance.now();
    const r = g.hist.filter((p) => t - p.t <= 100); const a = r[0], b = r[r.length - 1];
    const v = a && b && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;   // px/ms, positif = vers le bas
    const part = g.y > 8 && (g.y > Math.min(120, h * 0.3) || v > 0.5);
    el.setAttribute('data-feuille-geste', part ? 'part' : 'revient');
    if (!part) { poser(0, true); return; }
    poser(h, true);
    setTimeout(() => { fermer(); }, mouvementReduit() ? 0 : 200);
  };
  const annuler = (e) => { const g = refGeste.current; if (!g || g.id !== e.pointerId) return; refGeste.current = null; if (ref.current) ref.current.setAttribute('data-feuille-geste', 'revient'); poser(0, true); };
  const poignee = { onPointerDown: debut, onPointerMove: bouge, onPointerUp: fin, onPointerCancel: annuler, onLostPointerCapture: annuler };

  if (typeof document === 'undefined') return null;
  const cls = ['vrm-ui-feuille', 'sb-feuille', ...String(className || '').split(/\s+/).filter((c) => c && c !== 'vrm-ui-feuille' && c !== 'sb-feuille')].join(' ');
  return createPortal(
    <div ref={refVoile} className={ouvert ? 'vrm-ui-voile' + (voileClassName ? ' ' + voileClassName : '') : 'vrm-ui-voile-repos'} hidden={!ouvert}
      style={ouvert ? undefined : { display: 'none' }} data-ui-voile={ouvert ? 'ouvert' : 'ferme'}
      onClick={(e) => { if (ouvert && e.target === e.currentTarget) fermer(); }}>
      {ouvert ? <FermeAuRetourUi fermer={fermer}/> : null}
      <div ref={ref} tabIndex={-1} className={cls} role="dialog" aria-modal={ouvert ? 'true' : undefined} aria-label={typeof titre === 'string' ? titre : undefined} data-noswipe="" {...attrs}>
        <div className="vrm-ui-feuille-poignee-zone" data-ui-feuille-poignee="" aria-hidden="true" {...poignee}><span className="vrm-ui-feuille-poignee"/></div>
        <div className="vrm-ui-feuille-tete" {...poignee}>
          <h2 className="vrm-ui-feuille-titre">{titre}</h2>
          <button type="button" className="vrm-ui-feuille-fermer sb-lien" data-ui-feuille-ok="" onClick={fermer}>{tr('listes.ok')}</button>
        </div>
        {children}
      </div>
    </div>, document.body);
}
export default Feuille;
