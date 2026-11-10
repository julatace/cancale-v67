// ── LA VISIONNEUSE : UNE PHOTO EN GRAND, PARTOUT (10 nov., lot AN) ───────────
// Montée UNE fois par la coque (App.jsx). Elle écoute :
//   · le toucher d'une vignette d'article n'importe où (`data-vrm-vignette`,
//     règle dans src/visionneuse.js), en phase de CAPTURE sur le document : la
//     rangée ne reçoit pas ce clic, le reste de la rangée garde son geste ;
//   · `ouvrirVisionneuse(photos, index, { titre, sous })` (une facture jointe, la photo du
//     carton — lot AZ, sa vue à part fondue ici le 10 nov. : il n'y a qu'UNE visionneuse).
// Fond noir, portail, `FermeAuRetour` (le retour du téléphone ferme), croix ronde,
// Échap ; plusieurs photos : glisser, flèches, compteur « 2/5 » ; zoom : pincer au
// doigt, double toucher / double clic, molette à l'ordinateur.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { EVT_VISIONNEUSE, vignetteTouchee, origineVignette, lienVignette, galerieDe, borneZoom, borneDeplacement, ZOOM_DOUBLE } from './visionneuse.js';

// Au-dessus des feuilles ET des pleins écrans (scanner 19998, bienvenue 19000), sous les confirmations
// (20000) et les messages (30000) : une photo touchée dans le scanner s'ouvre DEVANT lui.
const Z_VISIONNEUSE = 19999;

// La photo remplit l'écran, contenue (jamais rognée), même une petite photo — comme l'app Photos.
const PLEIN = { width: '100%', height: '100%', objectFit: 'contain', display: 'block' };

const Fleche = ({ sens }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {sens < 0 ? <path d="M15 5l-7 7 7 7"/> : <path d="M9 5l7 7-7 7"/>}
  </svg>
);
const Croix = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
);

function Scene({ photos, index, lien = '', titre = '', sous = '', fermer, Photo, Retour, clavier }) {
  const [i, setI] = useState(index);
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [glisse, setGlisse] = useState(0);         // décalage horizontal pendant un glisser (zoom 1)
  const scene = useRef(null), croix = useRef(null);
  const ptrs = useRef(new Map());
  const geste = useRef(null);
  const dernierTap = useRef(0);
  const n = photos.length;
  const aller = useCallback((d) => { if (n < 2) return; setI((v) => (v + d + n) % n); setZ(1); setPos({ x: 0, y: 0 }); setGlisse(0); }, [n]);
  const taille = () => { const r = scene.current ? scene.current.getBoundingClientRect() : { width: 390, height: 700 }; return { w: r.width, h: r.height }; };
  const zoomer = useCallback((nz, cx = 0, cy = 0) => {
    setZ((z0) => {
      const z1 = borneZoom(nz);
      setPos((p) => { const { w, h } = taille(); if (z1 === 1) return { x: 0, y: 0 }; const k = z1 / z0; return borneDeplacement(p.x * k - cx * (k - 1), p.y * k - cy * (k - 1), z1, w, h); });
      return z1;
    });
  }, []);
  // Le clavier : Échap ferme, ← → changent de photo.
  useEffect(() => {
    const av = document.activeElement;
    try { croix.current && croix.current.focus({ preventScroll: true }); } catch (_) {}
    const k = (e) => {
      // stopImmediatePropagation : la feuille ou le plein écran SOUS la photo (scanner, Préparer,
      // mode relais…) n'entend pas cet Échap — seule la photo se ferme.
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); fermer(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); aller(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); aller(-1); }
      else if (e.key === 'Tab') {   // le focus reste dans la visionneuse
        const f = scene.current ? [...scene.current.parentNode.querySelectorAll('button')] : [];
        if (!f.length) return; const a = f.indexOf(document.activeElement);
        e.preventDefault(); f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    // L'écouteur est celui de la coque, posé au démarrage (AVANT ceux des feuilles) : il passe
    // donc le premier, même devant une feuille qui écoute elle aussi en capture.
    clavier.current = k;
    const html = document.documentElement, avant = html.style.overflow; html.style.overflow = 'hidden';
    return () => { if (clavier.current === k) clavier.current = null; html.style.overflow = avant; try { av && av.focus && av.focus({ preventScroll: true }); } catch (_) {} };
  }, [fermer, aller]);
  // La molette zoome (écouteur NON passif : la page ne défile pas derrière).
  useEffect(() => {
    const el = scene.current; if (!el) return undefined;
    const w = (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2; zoomer(z * Math.exp(-e.deltaY * 0.0022), cx, cy); };
    el.addEventListener('wheel', w, { passive: false });
    return () => el.removeEventListener('wheel', w);
  }, [z, zoomer]);

  const centre = (e) => { const r = scene.current.getBoundingClientRect(); return { cx: e.clientX - r.left - r.width / 2, cy: e.clientY - r.top - r.height / 2 }; };
  const bas = (e) => {
    if (e.target.closest && e.target.closest('button')) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const L = [...ptrs.current.values()];
    if (L.length === 2) geste.current = { type: 'pince', d0: Math.hypot(L[0].x - L[1].x, L[0].y - L[1].y) || 1, z0: z };
    else if (L.length === 1) geste.current = { type: z > 1 ? 'deplace' : 'glisse', x0: e.clientX, y0: e.clientY, p0: pos, t0: Date.now(), bouge: false };
  };
  const bouge = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = geste.current; if (!g) return;
    const L = [...ptrs.current.values()];
    if (g.type === 'pince' && L.length === 2) { const d = Math.hypot(L[0].x - L[1].x, L[0].y - L[1].y); setZ(borneZoom(g.z0 * d / g.d0)); setPos((p) => { const { w, h } = taille(); return borneDeplacement(p.x, p.y, borneZoom(g.z0 * d / g.d0), w, h); }); return; }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (Math.abs(dx) + Math.abs(dy) > 6) g.bouge = true;
    if (g.type === 'deplace') { const { w, h } = taille(); setPos(borneDeplacement(g.p0.x + dx, g.p0.y + dy, z, w, h)); }
    else if (g.type === 'glisse' && n > 1) setGlisse(dx);
  };
  const haut = (e) => {
    const g = geste.current;
    ptrs.current.delete(e.pointerId);
    if (!g) return;
    if (g.type === 'pince') { if (ptrs.current.size === 0) { geste.current = null; if (z <= 1.02) { setZ(1); setPos({ x: 0, y: 0 }); } } return; }
    geste.current = null;
    if (g.type === 'glisse') {
      const dx = e.clientX - g.x0;
      setGlisse(0);
      if (n > 1 && Math.abs(dx) > 56) { aller(dx < 0 ? 1 : -1); return; }
    }
    if (!g.bouge && e.pointerType !== 'mouse') {   // double toucher (au doigt ; à la souris, c'est dblclick)
      const t = Date.now();
      if (t - dernierTap.current < 320) { dernierTap.current = 0; const { cx, cy } = centre(e); zoomer(z > 1 ? 1 : ZOOM_DOUBLE, cx, cy); }
      else dernierTap.current = t;
    }
  };
  const annule = (e) => { ptrs.current.delete(e.pointerId); geste.current = null; setGlisse(0); };
  const src = photos[i];
  return (
    <div className="vrm-visionneuse" role="dialog" aria-modal="true" aria-label={titre || (n > 1 ? `Photo ${i + 1} sur ${n}` : 'Photo en grand')}
      data-visionneuse="ouverte" data-visionneuse-index={i} data-visionneuse-n={n} data-visionneuse-zoom={z.toFixed(2)}
      style={{ position: 'fixed', inset: 0, zIndex: Z_VISIONNEUSE, background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', overscrollBehavior: 'contain' }}>
      {Retour ? <Retour fermer={fermer}/> : null}
      <div ref={scene} className="vrm-visionneuse-scene" onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={annule}
        onDoubleClick={(e) => { const { cx, cy } = centre(e); zoomer(z > 1 ? 1 : ZOOM_DOUBLE, cx, cy); }}
        onClick={(e) => { if (e.target === e.currentTarget && z === 1 && !glisse) fermer(); }}
        style={{ position: 'absolute', inset: 0, touchAction: 'none', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: z > 1 ? 'grab' : 'zoom-in', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <div key={i} className="vrm-visionneuse-photo" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          transform: `translate3d(${pos.x + glisse}px, ${pos.y}px, 0) scale(${z})`, transition: geste.current ? 'none' : 'transform .22s cubic-bezier(.2,.8,.2,1)' }}>
          {Photo ? <Photo src={src} alt="" draggable={false} data-visionneuse-img="" style={PLEIN} repli={null}/>
            : <img src={src} alt="" draggable={false} data-visionneuse-img="" style={PLEIN}/>}
        </div>
      </div>
      <div className="vrm-visionneuse-haut" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(10px, env(safe-area-inset-top)) 12px 0', pointerEvents: 'none' }}>
        {titre ? (
          <span data-visionneuse-legende="" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, padding: '0 6px', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>
            <b style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titre}{n > 1 ? <span data-visionneuse-compteur="" style={{ fontWeight: 500, opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>{` · ${i + 1}/${n}`}</span> : null}</b>
            {sous ? <small style={{ fontSize: 13, color: '#c7c7cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sous}</small> : null}
          </span>
        ) : <span data-visionneuse-compteur="" aria-live="polite" style={{ minWidth: 44, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', opacity: n > 1 ? 0.9 : 0, padding: '0 6px' }}>{n > 1 ? `${i + 1}/${n}` : ''}</span>}
        <button ref={croix} type="button" data-visionneuse-fermer="" aria-label="Fermer la photo" onClick={fermer}
          style={{ pointerEvents: 'auto', width: 44, height: 44, borderRadius: 22, border: 0, background: 'rgba(255,255,255,.16)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Croix/></button>
      </div>
      {lien ? (
        <a href={lien} target="_blank" rel="noreferrer" data-visionneuse-lien="" onClick={() => fermer()}
          style={{ position: 'absolute', left: '50%', bottom: 'max(18px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)', minHeight: 44, padding: '0 18px', borderRadius: 22, background: 'rgba(255,255,255,.16)', color: '#fff', display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Voir l’annonce ↗</a>
      ) : null}
      {n > 1 ? [-1, 1].map((d) => (
        <button key={d} type="button" data-visionneuse-fleche={d < 0 ? 'avant' : 'apres'} aria-label={d < 0 ? 'Photo précédente' : 'Photo suivante'} onClick={() => aller(d)}
          style={{ position: 'absolute', top: '50%', [d < 0 ? 'left' : 'right']: 10, transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 22, border: 0, background: 'rgba(255,255,255,.16)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Fleche sens={d}/></button>
      )) : null}
    </div>
  );
}

export default function Visionneuse({ Photo = null, Retour = null }) {
  const [vue, setVue] = useState(null);   // { photos, index, cle }
  const fermer = useCallback(() => setVue(null), []);
  const clavier = useRef(null);
  useEffect(() => {
    const k = (e) => { if (clavier.current) clavier.current(e); };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, []);
  useEffect(() => {
    const ouvrir = (e) => { const d = e && e.detail; if (d && Array.isArray(d.photos) && d.photos.length) setVue({ photos: d.photos, index: d.index || 0, titre: d.titre || '', sous: d.sous || '', cle: Date.now() }); };
    // En CAPTURE sur le document : avant la rangée (React écoute sur sa racine, plus bas).
    const clic = (e) => {
      if (e.defaultPrevented || (e.button != null && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const img = vignetteTouchee(e.target);
      if (!img) return;
      e.preventDefault(); e.stopPropagation();
      const g = galerieDe(origineVignette(img));
      if (g.photos.length) setVue({ photos: g.photos, index: g.index, lien: lienVignette(img), cle: Date.now() });
    };
    window.addEventListener(EVT_VISIONNEUSE, ouvrir);
    document.addEventListener('click', clic, true);
    return () => { window.removeEventListener(EVT_VISIONNEUSE, ouvrir); document.removeEventListener('click', clic, true); };
  }, []);
  if (!vue || typeof document === 'undefined') return null;
  return createPortal(<Scene key={vue.cle} photos={vue.photos} index={vue.index} lien={vue.lien || ''} titre={vue.titre || ''} sous={vue.sous || ''} fermer={fermer} clavier={clavier} Photo={Photo} Retour={Retour}/>, document.body);
}
