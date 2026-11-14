// ── LA VISITE EN BULLES (2 nov.) — la règle vit dans src/visiteBulles.js.
// Une bulle à la fois, posée à côté de l'onglet RÉEL (barre du bas au téléphone,
// colonne sur ordinateur), une phrase, « Suivant » / « Passer », des points de
// progression. Échap, « Passer » ou un toucher en dehors la ferment (et la
// notent vue : elle ne revient pas toute seule). Portail sur <body>, au niveau
// des confirmations (`z`, Z_CONFIRMATION) : rien de la coque ne passe dessus.
// Accessible : dialogue non modal pour le lecteur d'écran (`aria-live` sur la
// phrase), focus gardé DANS la bulle (Tab boucle), cibles de 44 px, et
// « réduire les animations » coupe tout mouvement (styles-visite.css).
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { etapesPour, etapeMontrable, elementVisible, placerBulle } from './visiteBulles.js';
import { tr } from './i18n/index.js';

const telephoneMaintenant = () => { try { return !window.matchMedia('(min-width: 1024px)').matches; } catch (_) { return true; } };

// (14 nov., idée d'accueil 136) `etapes` : la visite d'un ÉCRAN (src/accueilReste/visiteEcrans.js),
// la même bulle ; sans elles, la visite d'arrivée de toujours.
export default function VisiteBulles({ onTerminer, z = 20000, etapes: etapesDonnees = null, ecran = '' }) {
  const [etapes] = useState(() => (Array.isArray(etapesDonnees) && etapesDonnees.length ? etapesDonnees : etapesPour(telephoneMaintenant())));
  const [i, setI] = useState(() => etapeMontrable(etapes, 0, 1));
  const [pos, setPos] = useState(null);       // { cote, x, y, flecheX, flecheY, trou }
  const bulle = useRef(null);
  const fini = useRef(false);
  const fermer = useCallback((raison) => { if (fini.current) return; fini.current = true; onTerminer && onTerminer(raison); }, [onTerminer]);

  // Aucune étape montrable (aucun onglet visible) : rien à montrer, on ne pointe
  // jamais dans le vide — et rien n'est noté vu (ce n'est pas lui qui a fermé).
  useEffect(() => { if (i < 0) { fini.current = true; onTerminer && onTerminer('rien'); } }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const etape = i >= 0 ? etapes[i] : null;
  const suivanteI = etape ? etapeMontrable(etapes, i + 1, 1) : -1;
  const derniere = suivanteI < 0;
  const montrables = etapes.map((e, k) => (k === i || !!elementVisible(e.cible) ? k : -1)).filter((k) => k >= 0);
  const rang = montrables.indexOf(i);

  // Placer la bulle à côté de la cible ; replacer à chaque redimensionnement.
  const placer = useCallback(() => {
    if (!etape || !bulle.current) return;
    const el = elementVisible(etape.cible);
    if (!el) { const k = etapeMontrable(etapes, i + 1, 1); setI(k); return; }   // la cible a disparu : on saute
    const r = el.getBoundingClientRect();
    const b = bulle.current.getBoundingClientRect();
    const p = placerBulle(r, window.innerWidth, window.innerHeight, b.width, b.height);
    setPos({ ...p, trou: { x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 } });
  }, [etape, etapes, i]);
  useLayoutEffect(() => { setPos(null); }, [i]);
  useLayoutEffect(() => { if (!pos) placer(); }, [pos, placer]);
  useEffect(() => {
    const re = () => setPos(null);
    window.addEventListener('resize', re);
    window.addEventListener('orientationchange', re);
    return () => { window.removeEventListener('resize', re); window.removeEventListener('orientationchange', re); };
  }, []);

  // Le focus va au geste principal de la bulle à chaque étape.
  useEffect(() => { if (!pos || !bulle.current) return; const b = bulle.current.querySelector('[data-visite-suivant]'); try { b && b.focus({ preventScroll: true }); } catch (_) {} }, [pos && pos.x, pos && pos.y, i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Échap ferme ; Tab reste dans la bulle.
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer('echap'); return; }
      if (e.key !== 'Tab' || !bulle.current) return;
      const bs = [...bulle.current.querySelectorAll('button')];
      if (!bs.length) return;
      const premier = bs[0], dernier = bs[bs.length - 1];
      if (!bulle.current.contains(document.activeElement)) { e.preventDefault(); premier.focus(); return; }
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [fermer]);

  if (!etape) return null;
  const suivant = () => { if (derniere) fermer('fin'); else setI(suivanteI); };

  return createPortal(
    <div className="vrm-visite" data-visite={etape.cle} data-visite-cible={etape.cible} data-visite-ecran={ecran || undefined} style={{ zIndex: z }}>
      {/* Le voile : un toucher en dehors de la bulle la ferme. Le trou laisse
          voir l'onglet montré (un simple découpage, aucune lueur). */}
      <div className="vrm-visite-voile" data-visite-dehors="" onClick={() => fermer('dehors')} aria-hidden="true"/>
      {pos && <div className="vrm-visite-trou" aria-hidden="true" style={{ left: pos.trou.x, top: pos.trou.y, width: pos.trou.w, height: pos.trou.h }}/>}
      <div ref={bulle} className="vrm-visite-bulle" role="dialog" aria-modal="false" aria-labelledby="vrm-visite-titre" aria-describedby="vrm-visite-texte"
        data-cote={pos ? pos.cote : 'mesure'} key={etape.cle}
        style={pos ? { left: pos.x, top: pos.y, '--fleche-x': pos.flecheX + 'px', '--fleche-y': pos.flecheY + 'px' } : { left: 0, top: 0, visibility: 'hidden' }}>
        <span className="vrm-visite-fleche" aria-hidden="true"/>
        <h2 id="vrm-visite-titre" className="vrm-visite-titre">{etape.titre}</h2>
        <p id="vrm-visite-texte" className="vrm-visite-texte" aria-live="polite" data-visite-texte="">{etape.texte}</p>
        <div className="vrm-visite-pied">
          <div className="vrm-visite-points" role="img" aria-label={tr('visite.etape', { i: rang + 1, n: montrables.length })} data-visite-rang={rang + 1} data-visite-total={montrables.length}>
            {montrables.map((k) => <span key={k} data-fait={k === i ? 'ici' : k < i ? '1' : '0'}/>)}
          </div>
          <button type="button" className="vrm-visite-passer" data-visite-passer="" onClick={() => fermer('passer')}>{tr('visite.passer')}</button>
          <button type="button" className="vrm-visite-suivant" data-visite-suivant="" onClick={suivant}>{derniere ? tr('visite.terminer') : tr('visite.suivant')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
