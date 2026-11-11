// ══════════════════════════════════════════════════════════════════════════════
//  LA SÉLECTION EN SÉRIE — un mécanisme, toutes les listes (11 nov., actions-serie)
// ══════════════════════════════════════════════════════════════════════════════
// La règle (cocher, plage, tout le filtre, résumé honnête, plafond Vinted) est
// dans src/selectionSerie.js ; ici, le geste et la barre :
//   · `useSelectionSerie(ordre)` : l'état d'une liste (clés dans l'ordre affiché) ;
//   · `<CaseSerie>` : la case d'une ligne (Maj-clic = la plage) ;
//   · `serie.ligne(cle)` : les props d'une ligne (appui long au doigt ; quand la
//     sélection est ouverte, un tap coche au lieu d'ouvrir la ligne) ;
//   · `<BarreSerie>` : « N sélectionnés », « Tout sélectionner », les actions,
//     « Annuler » — en portail (une feuille au-dessus d'elle reste au-dessus, §7).
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BoutonBase as Bouton } from './Bouton.jsx';
import { basculer, plage, toutSelectionner, garderVisibles, APPUI_LONG_MS } from '../selectionSerie.js';
import '../selection-serie.css';

const feuilleOuverte = () => {
  try { return !!document.querySelector('[role="dialog"][aria-modal="true"], .vrm-sheet-voile, [data-sheet-ouverte]'); } catch (_) { return false; }
};

export function useSelectionSerie(ordre, { nom = '' } = {}) {
  const [sel, setSel] = useState([]);
  const [actif, setActif] = useState(false);
  const ancre = useRef(null);
  const appui = useRef(null);
  const ordreS = useMemo(() => (Array.isArray(ordre) ? ordre.map(String) : []), [ordre]);
  // Une ligne qui n'est plus affichée (filtre changé) sort de la sélection.
  useEffect(() => { setSel((s) => garderVisibles(s, ordreS)); }, [ordreS]);
  const vider = useCallback(() => { setSel([]); setActif(false); ancre.current = null; }, []);
  // Échap sort de la sélection — sauf si une feuille est ouverte (elle se ferme d'abord).
  useEffect(() => {
    if (!actif) return undefined;
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !feuilleOuverte()) { e.preventDefault(); vider(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [actif, vider]);
  const estCoche = useCallback((cle) => sel.includes(String(cle)), [sel]);
  const cocher = useCallback((cle, e) => {
    const k = String(cle);
    setActif(true);
    setSel((s) => {
      if (e && e.shiftKey && ancre.current != null) return plage(ordreS, ancre.current, k, s, !s.includes(k));
      return basculer(s, k);
    });
    ancre.current = k;
  }, [ordreS]);
  const tout = useCallback(() => { setActif(true); setSel(toutSelectionner(ordreS)); }, [ordreS]);
  const commencer = useCallback((cle) => {
    setActif(true); ancre.current = String(cle);
    setSel((s) => (s.includes(String(cle)) ? s : [...s, String(cle)]));
    try { navigator.vibrate && navigator.vibrate(12); } catch (_) {}
  }, []);
  // Les props d'une ligne : appui long au doigt ; sélection ouverte ⇒ le tap coche.
  // Au repos (rien d'ouvert), les props d'une ligne ne changent pas : gardées par clé,
  // une ligne mémoïsée (React.memo) ne se redessine pas pour rien.
  const repos = useRef(new Map());
  const ligne = useCallback((cle) => {
    const k = String(cle);
    if (!actif && !sel.length && repos.current.has(k)) return repos.current.get(k);
    const annulerAppui = () => { if (appui.current) { clearTimeout(appui.current.t); appui.current = null; } };
    const props = {
      'data-serie-ligne': k,
      'data-serie-coche': sel.includes(k) ? '1' : '0',
      onPointerDown: (e) => {
        if (e.pointerType !== 'touch' || actif) return;
        annulerAppui();
        const x = e.clientX, y = e.clientY;
        appui.current = { x, y, t: setTimeout(() => { appui.current = { fait: true }; commencer(k); }, APPUI_LONG_MS) };
      },
      onPointerMove: (e) => { const a = appui.current; if (a && !a.fait && (Math.abs(e.clientX - a.x) > 8 || Math.abs(e.clientY - a.y) > 8)) annulerAppui(); },
      onPointerUp: () => { if (appui.current && !appui.current.fait) annulerAppui(); },
      onPointerCancel: annulerAppui,
      onContextMenu: (e) => { if (appui.current && appui.current.fait) e.preventDefault(); },
      onClickCapture: (e) => {
        // L'appui long vient d'ouvrir la sélection : le relâcher n'ouvre pas la ligne.
        if (appui.current && appui.current.fait) { appui.current = null; e.preventDefault(); e.stopPropagation(); return; }
        if (!actif) return;
        // La case elle-même gère son clic (Maj-clic compris).
        if (e.target && e.target.closest && e.target.closest('[data-serie-case]')) return;
        e.preventDefault(); e.stopPropagation(); cocher(k, e);
      },
    };
    if (!actif && !sel.length) repos.current.set(k, props);
    return props;
  }, [sel, actif, commencer, cocher]);
  const choisies = useMemo(() => ordreS.filter((k) => sel.includes(k)), [ordreS, sel]);
  return { nom, actif, sel, choisies, n: choisies.length, total: ordreS.length, estCoche, cocher, tout, vider, commencer, ligne, ouvrir: () => setActif(true) };
}

// Deux jeux de props sur la même ligne (le glisser « déposé » ET la sélection) :
// chaque gestionnaire appelle les deux ; celui de la sélection passe d'abord, et
// s'il arrête le clic, l'autre ne le voit pas.
export function avecSerie(a, b) {
  const out = { ...(a || {}), ...(b || {}) };
  for (const k of Object.keys(a || {})) {
    if (!/^on[A-Z]/.test(k) || typeof a[k] !== 'function' || !b || typeof b[k] !== 'function') continue;
    out[k] = (e) => { b[k](e); if (e && typeof e.isPropagationStopped === 'function' && e.isPropagationStopped()) return; a[k](e); };
  }
  return out;
}

// La case d'une ligne. À la souris elle est toujours là (discrète tant que rien
// n'est coché) ; au doigt elle n'apparaît qu'une fois la sélection ouverte.
// `surPhoto` : la case se pose dans le coin de la vignette (les lignes en grille
// gardent leurs colonnes) ; le parent devient `position: relative` (CSS).
export function CaseSerie({ serie, cle, etiquette, surPhoto = false }) {
  const k = String(cle);
  const on = serie.estCoche(k);
  return (
    <label className={surPhoto ? 'vrm-serie-case vrm-serie-case-photo' : 'vrm-serie-case'} data-serie-case={k} data-serie-actif={serie.actif ? '1' : '0'} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={on} aria-label={etiquette ? `Sélectionner ${etiquette}` : 'Sélectionner cette ligne'}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); serie.cocher(k, e); }} onChange={() => {}}/>
    </label>
  );
}

// Le bouton « Sélectionner » d'une liste (ouvre la sélection sans appui long).
export function OuvrirSerie({ serie, libelle = 'Sélectionner' }) {
  if (serie.actif || !serie.total) return null;
  return <Bouton variante="discret" taille="petit" data-serie-ouvrir={serie.nom} onClick={() => serie.ouvrir()}>{libelle}</Bouton>;
}

// La barre flottante. `actions` = [{ k, libelle, icone?, desactive?, raison?, faire }]
// `faire(choisies)` rend (ou promet) un résumé (texte) ; il est dit dans la barre.
export function BarreSerie({ serie, actions = [], unite = { un: 'sélectionné', plusieurs: 'sélectionnés' }, rendreIcone }) {
  const [resume, setResume] = useState('');
  const [occupe, setOccupe] = useState(false);
  // Le résumé reste lisible quelques secondes après la fermeture de la sélection.
  useEffect(() => { if (!resume || serie.actif) return undefined; const t = setTimeout(() => setResume(''), 8000); return () => clearTimeout(t); }, [resume, serie.actif]);
  if (typeof document === 'undefined') return null;
  if (!serie.actif) {
    return resume ? createPortal(<div className="vrm-serie-barre" data-serie-barre={serie.nom} data-serie-fermee="">
      <p className="vrm-serie-resume" role="status" data-serie-resume="">{resume}</p>
      <Bouton variante="discret" taille="petit" onClick={() => setResume('')}>OK</Bouton></div>, document.body) : null;
  }
  const n = serie.n;
  const lancer = async (a) => {
    if (!n || occupe || a.desactive) return;
    setOccupe(true);
    try {
      const r = await a.faire(serie.choisies);
      if (r && typeof r === 'object' && r.annule) { setOccupe(false); return; }
      setResume(typeof r === 'string' ? r : (r && r.texte) || '');
      if (!(r && r.garder)) serie.vider();
    } catch (e) { setResume('Pas fait : ' + String((e && e.message) || e)); }
    setOccupe(false);
  };
  return createPortal(
    <div className="vrm-serie-barre" role="toolbar" aria-label="Actions sur la sélection" data-serie-barre={serie.nom} data-serie-n={n} data-serie-total={serie.total}>
      <div className="vrm-serie-tete">
        <b role="status" data-serie-compte={n}>{n} {n > 1 ? unite.plusieurs : unite.un}</b>
        {n < serie.total
          ? <Bouton variante="discret" taille="petit" data-serie-tout={serie.total} onClick={() => serie.tout()}>Tout sélectionner · {serie.total}</Bouton>
          : null}
        <Bouton variante="discret" taille="petit" data-serie-annuler="" onClick={() => serie.vider()} title="Échap">Annuler</Bouton>
      </div>
      {resume ? <p className="vrm-serie-resume" role="status" data-serie-resume="">{resume}</p> : null}
      <div className="vrm-serie-actions">
        {actions.filter(Boolean).map((a) => (
          <Bouton key={a.k} variante={a.variante || 'secondaire'} taille="petit" icone={a.icone} {...(rendreIcone ? { rendreIcone } : {})} data-serie-action={a.k}
            disabled={!n || occupe || !!a.desactive} title={a.desactive ? a.raison : undefined} onClick={() => lancer(a)}>{a.libelle}</Bouton>
        ))}
      </div>
    </div>,
    document.body,
  );
}
