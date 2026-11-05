// ═══════════════════════════════════════════════════════════════════════════
// LA FEUILLE UNIQUE — `SheetShell` (5 nov., revue de cohérence 1.9)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 5 nov. : 36 calques fixes faits main contre 15 `SheetShell`, trois
// croix différentes, et l'ancienne feuille FONDAIT : le voile animait son
// opacité de 0 à 1 et la feuille, son enfant, fondait avec lui — à la première
// image, le panneau était transparent (le texte de l'écran passait au travers).
//
// Ce qu'elle garantit, à chaque ouverture :
//   · un PORTAIL sur <body> (§7 : une feuille posée dans un conteneur qui crée
//     un contexte d'empilement — `-webkit-overflow-scrolling`, `transform` —
//     passait SOUS la barre du bas sur iPhone) ;
//   · un fond OPAQUE dès la première image : seul le voile fond, la feuille est
//     sa SŒUR (jamais son enfant) et n'anime que `transform` ;
//   · une poignée qu'on prend au doigt : la feuille suit le doigt 1:1, depuis
//     l'endroit où il l'a prise ; relâchée vite ou loin, elle part vers le bas,
//     sinon elle revient ; reprise en plein mouvement, elle repart de là où elle
//     EST (interrompable : on lit la position affichée, jamais la cible) ;
//   · un titre et la croix en icône (cible 44 px) quand `titre` est donné ;
//   · `FermeAuRetour` (le geste « retour » et Échap ferment la feuille) ;
//   · le mouvement réduit respecté : aucune glissade, la feuille est là.
// Variante `lumineuse` (« En grand », le code tendu au comptoir) : blanc forcé,
// encre foncée, MÊME en mode sombre — un écran noir se lit mal sous un néon.
//
// API (docs/passation/2026-11-05-chantier-b.md) :
//   <SheetShell onClose titre? sousTitre? croix? lumineuse? maxWidth? z? FermeAuRetour? {...data-*}>
// Dans App.jsx, `SheetShell` est un relais qui fournit le vrai `FermeAuRetour`.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { IconeComposant } from './icones.jsx';

const EASE_FEUILLE = 'cubic-bezier(.32,.72,0,1)';   // la courbe des tiroirs d'iOS
const DUREE_ENTREE = 320;

let _idTitre = 0;

const mouvementReduit = () => {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
};
// La translation verticale AFFICHÉE (pendant une animation, la valeur en cours).
const translationAffichee = (el) => {
  try {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    const m = t.match(/matrix(3d)?\(([^)]+)\)/); if (!m) return 0;
    const v = m[2].split(',').map(Number);
    return m[1] ? (v[13] || 0) : (v[5] || 0);
  } catch (_) { return 0; }
};
// Au-delà du bord haut, la feuille résiste de plus en plus (jamais un arrêt sec).
const elastique = (depasse, dim, k = 0.55) => (depasse * dim * k) / (dim + k * Math.abs(depasse));

export function SheetShell({ onClose, children, maxWidth = 460, z = 2000, titre, sousTitre, croix, lumineuse = false,
  FermeAuRetour, className = '', ...rest }) {
  const refFeuille = React.useRef(null);
  const refVoile = React.useRef(null);
  const refAnim = React.useRef(null);
  const refGeste = React.useRef(null);
  const refFermer = React.useRef(onClose); refFermer.current = onClose;
  const [idTitre] = React.useState(() => 'vrm-fs-titre-' + (++_idTitre));
  const avecCroix = croix != null ? !!croix : titre != null;

  const arreterAnim = () => {
    const a = refAnim.current; refAnim.current = null;
    if (a) { try { a.cancel(); } catch (_) {} }
  };
  const poser = (y) => {
    const el = refFeuille.current; if (!el) return;
    el.style.transform = y ? `translate3d(0,${y}px,0)` : '';
    const v = refVoile.current;
    if (v) { const h = el.offsetHeight || 1; v.style.opacity = String(Math.max(0, Math.min(1, 1 - Math.max(0, y) / h))); }
  };
  // Une animation de `depuis` à `vers` (px), interrompable : au toucher suivant,
  // on lit la position affichée et on annule.
  const animer = (depuis, vers, duree, courbe, fin) => {
    const el = refFeuille.current; if (!el) return;
    arreterAnim();
    if (mouvementReduit() || !el.animate) { poser(vers); if (fin) fin(); return; }
    const a = el.animate([{ transform: `translate3d(0,${depuis}px,0)` }, { transform: `translate3d(0,${vers}px,0)` }], { duration: duree, easing: courbe });
    refAnim.current = a;
    poser(vers);
    a.onfinish = () => { if (refAnim.current === a) refAnim.current = null; if (fin) fin(); };
  };

  // L'entrée : la feuille monte du bas (le voile fond à part, en CSS).
  React.useLayoutEffect(() => {
    const el = refFeuille.current; if (!el || mouvementReduit() || !el.animate) return undefined;
    const a = el.animate([{ transform: 'translate3d(0,100%,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: DUREE_ENTREE, easing: EASE_FEUILLE });
    refAnim.current = a;
    a.onfinish = () => { if (refAnim.current === a) refAnim.current = null; };
    return () => arreterAnim();
  }, []);
  // Le focus entre dans la feuille (sauf si un champ s'y est déjà donné le focus).
  React.useEffect(() => {
    const el = refFeuille.current;
    if (el && !el.contains(document.activeElement)) { try { el.focus({ preventScroll: true }); } catch (_) {} }
  }, []);

  const debut = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (refGeste.current) return;                               // un seul doigt mène
    if (e.target && e.target.closest && e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    const el = refFeuille.current; if (!el) return;
    const y0 = translationAffichee(el);                         // là où elle EST, même en plein mouvement
    arreterAnim(); poser(y0);
    refGeste.current = { id: e.pointerId, depart: e.clientY - y0, hist: [{ t: performance.now(), y: y0 }], y: y0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const bouge = (e) => {
    const g = refGeste.current; if (!g || g.id !== e.pointerId) return;
    const brut = e.clientY - g.depart;
    const el = refFeuille.current; const h = (el && el.offsetHeight) || 600;
    const y = brut < 0 ? -elastique(-brut, h) : brut;
    g.y = y; g.hist.push({ t: performance.now(), y }); if (g.hist.length > 6) g.hist.shift();
    poser(y);
  };
  const fin = (e) => {
    const g = refGeste.current; if (!g || g.id !== e.pointerId) return;
    refGeste.current = null;
    const el = refFeuille.current; if (!el) return;
    const h = el.offsetHeight || 600;
    const a = g.hist[0], b = g.hist[g.hist.length - 1];
    const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;          // px/ms, positif = vers le bas
    const projete = g.y + (v * 0.998) / (1 - 0.998);             // la projection d'Apple (déc. 0,998)
    if (g.y > 0 && (projete > h * 0.5 || v > 0.6)) {
      const reste = Math.max(0, h - g.y);
      const duree = Math.max(140, Math.min(260, v > 0 ? reste / v : 260));
      animer(g.y, h, duree, 'cubic-bezier(.2,.8,.3,1)', () => { const f = refFermer.current; if (f) f(); });
    } else if (g.y !== 0) {
      animer(g.y, 0, 300, EASE_FEUILLE);
    }
  };
  const poignee = { onPointerDown: debut, onPointerMove: bouge, onPointerUp: fin, onPointerCancel: fin };

  const cls = `vrm-fs${lumineuse ? ' vrm-fs-lumineuse' : ''}${className ? ' ' + className : ''}`;
  const contenu = (
    <div className="vrm-fs-cadre" data-feuille-cadre="" style={{ zIndex: z }}>
      <div ref={refVoile} className="vrm-fs-voile" data-feuille-voile="" onClick={() => { const f = refFermer.current; if (f) f(); }} aria-hidden="true"/>
      {FermeAuRetour ? <FermeAuRetour fermer={onClose}/> : null}
      <div ref={refFeuille} className={cls} role="dialog" aria-modal="true" tabIndex={-1}
        {...(titre != null ? { 'aria-labelledby': idTitre } : {})}
        data-feuille="" data-feuille-lumineuse={lumineuse ? '1' : undefined}
        style={{ maxWidth }} onClick={(e) => e.stopPropagation()} {...rest}>
        <div className="vrm-fs-poignee-zone" data-feuille-poignee="" {...poignee}><span className="vrm-fs-poignee"/></div>
        {(titre != null || avecCroix) ? (
          <div className="vrm-fs-tete" {...poignee}>
            <div className="vrm-fs-tete-texte">
              {titre != null ? <h2 id={idTitre} className="vrm-fs-titre">{titre}</h2> : null}
              {sousTitre ? <p className="vrm-fs-sous-titre">{sousTitre}</p> : null}
            </div>
            {avecCroix ? (
              <button type="button" className="vrm-fs-croix" data-feuille-croix="" aria-label="Fermer"
                onClick={() => { const f = refFermer.current; if (f) f(); }}>
                <span className="vrm-fs-croix-rond"><IconeComposant nom="close" taille={15} trait={2.2}/></span>
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="vrm-fs-corps">{children}</div>
      </div>
    </div>
  );
  if (typeof document === 'undefined' || !document.body) return contenu;
  return createPortal(contenu, document.body);
}

export default SheetShell;
