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
//   <SheetShell onClose titre? sousTitre? croix? lumineuse? maxWidth? z? bloque? FermeAuRetour? {...data-*}>
//   (9 nov., DA4) Un pied d'actions collé en bas : un enfant `.vrm-fs-pied` en dernier
//   (fond de la feuille, filet, zone sûre) — styles-premium.css §12.
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
  FermeAuRetour, className = '', bloque = '', ...rest }) {
  const refFeuille = React.useRef(null);
  const refVoile = React.useRef(null);
  const refAnim = React.useRef(null);
  const refGeste = React.useRef(null);
  const refFermer = React.useRef(onClose); refFermer.current = onClose;
  // (9 nov., DA4) `bloque` : une phrase (« Mets en pause pour fermer ») tant que la
  // feuille ne peut pas se fermer (un envoi en cours). La croix est grisée et la dit,
  // le glisser revient toujours : rien ne part en bas pour rester caché hors de l'écran.
  const refBloque = React.useRef(bloque); refBloque.current = bloque;
  const refMonte = React.useRef(true);
  // Ce qui avait le focus AVANT la feuille (lu au premier rendu : un `autoFocus` d'un
  // enfant le prend avant les effets).
  const [focusAvant] = React.useState(() => { try { return typeof document !== 'undefined' ? document.activeElement : null; } catch (_) { return null; } });
  React.useEffect(() => () => { refMonte.current = false; }, []);
  const [idTitre] = React.useState(() => 'vrm-fs-titre-' + (++_idTitre));
  const avecCroix = croix != null ? !!croix : titre != null;

  const refAnimVoile = React.useRef(null);
  const arreterAnim = () => {
    const a = refAnim.current; refAnim.current = null;
    if (a) { try { a.cancel(); } catch (_) {} }
    const b = refAnimVoile.current; refAnimVoile.current = null;
    if (b) { try { b.cancel(); } catch (_) {} }
  };
  // L'opacité du voile suit la feuille : il s'éclaircit à mesure qu'elle descend.
  const opaciteVoile = (y) => { const el = refFeuille.current; const h = (el && el.offsetHeight) || 1; return Math.max(0, Math.min(1, 1 - Math.max(0, y) / h)); };
  const poser = (y) => {
    const el = refFeuille.current; if (!el) return;
    el.style.transform = y ? `translate3d(0,${y}px,0)` : '';
    const v = refVoile.current;
    if (v) v.style.opacity = String(opaciteVoile(y));
  };
  // Une animation de `depuis` à `vers` (px), interrompable : au toucher suivant,
  // on lit la position affichée et on annule (la fin n'est alors jamais jouée).
  const animer = (depuis, vers, duree, courbe, fin) => {
    const el = refFeuille.current; if (!el) return;
    arreterAnim();
    if (mouvementReduit() || !el.animate) { poser(vers); if (fin) fin(); return; }
    const a = el.animate([{ transform: `translate3d(0,${depuis}px,0)` }, { transform: `translate3d(0,${vers}px,0)` }], { duration: duree, easing: courbe });
    refAnim.current = a;
    const v = refVoile.current;
    if (v && v.animate) { try { refAnimVoile.current = v.animate([{ opacity: opaciteVoile(depuis) }, { opacity: opaciteVoile(vers) }], { duration: duree, easing: courbe }); } catch (_) {} }
    poser(vers);
    let fait = false;
    const finir = () => { if (fait || refAnim.current !== a) return; fait = true; refAnim.current = null; refAnimVoile.current = null; if (fin) fin(); };
    a.onfinish = finir;
    setTimeout(finir, duree + 120);   // un onglet en arrière-plan ne joue pas les animations : la fin arrive quand même
  };

  // L'entrée : la feuille monte du bas (le voile fond à part, en CSS).
  React.useLayoutEffect(() => {
    const el = refFeuille.current; if (!el || mouvementReduit() || !el.animate) return undefined;
    const a = el.animate([{ transform: 'translate3d(0,100%,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: DUREE_ENTREE, easing: EASE_FEUILLE });
    refAnim.current = a;
    a.onfinish = () => { if (refAnim.current === a) refAnim.current = null; };
    return () => arreterAnim();
  }, []);
  // Le focus entre dans la feuille (sauf si un champ s'y est déjà donné le focus),
  // y reste (Tab et Maj+Tab tournent DANS la feuille du dessus : rien derrière le
  // voile ne se prend au clavier), et revient à ce qui l'avait à la fermeture.
  React.useEffect(() => {
    const el = refFeuille.current;
    const avant = focusAvant;
    if (el && !el.contains(document.activeElement)) { try { el.focus({ preventScroll: true }); } catch (_) {} }
    const piege = (e) => {
      if (e.key !== 'Tab' || !el || !el.isConnected) return;
      const feuilles = document.querySelectorAll('[data-feuille]');
      if (feuilles[feuilles.length - 1] !== el) return;           // seule la feuille du dessus garde le focus
      const pris = [...el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden');
      if (!pris.length) { e.preventDefault(); try { el.focus({ preventScroll: true }); } catch (_) {} return; }
      const premier = pris[0], dernier = pris[pris.length - 1], ici = document.activeElement;
      if (e.shiftKey && (ici === premier || ici === el || !el.contains(ici))) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && (ici === dernier || !el.contains(ici))) { e.preventDefault(); premier.focus(); }
    };
    document.addEventListener('keydown', piege, true);
    return () => {
      document.removeEventListener('keydown', piege, true);
      if (avant && avant.isConnected && typeof avant.focus === 'function' && (!document.activeElement || document.activeElement === document.body || (el && el.contains(document.activeElement)))) {
        try { avant.focus({ preventScroll: true }); } catch (_) {}
      }
    };
  }, []);

  const debut = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (refGeste.current) return;                               // un seul doigt mène
    if (e.target && e.target.closest && e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    const el = refFeuille.current; if (!el) return;
    const y0 = translationAffichee(el);                         // là où elle EST, même en plein mouvement
    arreterAnim(); poser(y0);
    refGeste.current = { id: e.pointerId, depart: e.clientY - y0, hist: [{ t: performance.now(), y: y0 }], y: y0, y0 };
    el.setAttribute('data-feuille-geste', 'suit');               // l'état du geste, lisible par les bancs
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
    // La vitesse au lâcher : sur les 100 dernières ms seulement (un doigt arrêté
    // avant de lâcher n'a plus d'élan).
    const t = performance.now();
    const recents = g.hist.filter((p) => t - p.t <= 100);
    const a = recents[0], b = recents[recents.length - 1];
    const v = a && b && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;   // px/ms, positif = vers le bas
    const projete = g.y + (v * 0.998) / (1 - 0.998);             // la projection d'Apple (déc. 0,998)
    const aBouge = Math.abs(g.y - g.y0) >= 6;                     // un simple toucher ne décide rien
    const part = !refBloque.current && aBouge && g.y > 0 && (projete > h * 0.5 || v > 0.6);
    el.setAttribute('data-feuille-geste', part ? 'part' : 'revient');
    if (!aBouge) { if (g.y !== 0) animer(g.y, 0, 300, EASE_FEUILLE); return; }
    if (part) {
      const reste = Math.max(0, h - g.y);
      const duree = Math.max(140, Math.min(260, v > 0 ? reste / v : 260));
      // Une feuille qui REFUSE de se fermer (une saisie à garder, un envoi en cours)
      // reste montée : elle remonte au lieu de rester cachée sous le bord de l'écran.
      animer(g.y, h, duree, 'cubic-bezier(.2,.8,.3,1)', () => {
        const f = refFermer.current; if (f) f();
        setTimeout(() => { if (refMonte.current && refFeuille.current && refFeuille.current.isConnected) animer(h, 0, 300, EASE_FEUILLE); }, 0);
      });
    } else if (g.y !== 0) {
      animer(g.y, 0, 300, EASE_FEUILLE);
    }
  };
  // Une interruption du navigateur n'est pas un lâcher volontaire du doigt.
  const annulerGeste = (e) => {
    const g=refGeste.current;if(!g||g.id!==e.pointerId)return;
    refGeste.current=null;
    refFeuille.current?.setAttribute('data-feuille-geste','revient');
    animer(g.y,0,300,EASE_FEUILLE);
  };
  const poignee = { onPointerDown: debut, onPointerMove: bouge, onPointerUp: fin, onPointerCancel: annulerGeste, onLostPointerCapture: annulerGeste };

  const cls = `vrm-fs${lumineuse ? ' vrm-fs-lumineuse' : ''}${className ? ' ' + className : ''}`;
  const contenu = (
    <div className="vrm-fs-cadre" data-feuille-cadre="" style={{ zIndex: z }}>
      <div ref={refVoile} className="vrm-fs-voile" data-feuille-voile="" onClick={() => { if (refBloque.current) return; const f = refFermer.current; if (f) f(); }} aria-hidden="true"/>
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
                disabled={!!bloque} title={bloque || undefined}
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
