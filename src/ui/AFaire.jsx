// (14 nov., Studio bleu clair) La ligne « À faire » est un LIEN (`sb-lien`) ; sa variante capsule, une TOUCHE (`sb-touche`).
// ── src/ui/AFaire.jsx — regrouper les alertes d'un écran SANS les déplacer dans le code ──
// Julien (AJOUT 3) : les alertes éparpillées avant la liste (« 4 brouillons à refaire »,
// « 18 retirées de Vinted », « Prix d'achat 0/19 · Compléter », « 2 nouveaux N° »…) vont
// dans UNE ligne « • À faire · N › » qui ouvre une feuille. Chaque alerte reste écrite là
// où l'écran la calcule : on l'enveloppe dans <VersAFaire>, elle est rendue (portail React)
// dans UN conteneur commun ; <AFaireLigne/> pose ce conteneur :
//   · au téléphone (< 768 px) : la ligne « À faire · N » ; le conteneur vit, caché, dans la
//     page, et passe dans la feuille quand on la touche — les éléments, leurs `data-*` et
//     leurs écritures sont les MÊMES (rien de recopié, rien de perdu) ;
//   · à l'ordinateur : le conteneur est posé tel quel à la place de la ligne (la place y est).
// N = le nombre d'alertes qui ont rendu quelque chose (une alerte qui rend `null` ne compte pas).
//   <AFaireHote> … <AFaireLigne/> … <VersAFaire>{alerte1}</VersAFaire> … </AFaireHote>
// `seulement` : 'telephone' ou 'ordinateur' — deux places dans l'écran, une par appareil.
// `capsule` : la ligne prend la forme d'une capsule de filtre (posée en tête de la rangée des vues : aucune ligne de plus).
import React, { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MAQUETTE_C2 } from '../design/maquette.js';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { Feuille } from './Feuille.jsx';
import './ui.css';

const Ctx = createContext(null);
const Chevron = () => <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
// (17 nov., maquette C2, réglage de BANC seulement — src/design/maquette.js) : « À faire · N » partout, l'ordinateur compris.
const telephone = () => { if (MAQUETTE_C2) return true; try { return window.matchMedia('(max-width: 767px)').matches; } catch (_) { return false; } };

export function AFaireHote({ children }) {
  const conteneur = useMemo(() => { if (typeof document === 'undefined') return null; const d = document.createElement('div'); d.className = 'vrm-ui-afaire-corps'; d.setAttribute('data-ui-afaire-corps', ''); return d; }, []);
  const [n, setN] = useState(0);
  useLayoutEffect(() => {
    if (!conteneur) return undefined;
    const compter = () => setN([...conteneur.children].filter((c) => c.childNodes.length > 0 && (c.textContent || '').trim() !== '').length);
    compter();
    const mo = new MutationObserver(compter);
    mo.observe(conteneur, { childList: true, subtree: true, characterData: true });
    // Un geste qui OUVRE autre chose (une feuille, une saisie : « Préparer la tournée », « Compléter »…) referme
    // « À faire » juste après son clic — sinon la feuille demandée s'ouvrirait derrière celle-ci. Un geste qui
    // déplie sur place (« 2 nouveaux N° · Vérifier ») la laisse ouverte.
    // (14 nov., correctif « À faire ») + `data-afaire-ferme` (un geste qui mène DANS l'écran : filtrer la liste,
    // aller au bloc — la convention d'AFaireSite) ; un bouton qui DÉPLIE sur place (`aria-expanded`) la laisse
    // ouverte. Un geste qui ouvre une couche sans le dire est rattrapé par la feuille (`fermeSiAutreCouche`).
    const ouvreAilleurs = (b) => b && !b.hasAttribute('aria-expanded') && ([...b.attributes].some((a) => /^data-[a-z-]*(ouvrir|completer)/.test(a.name) || a.name === 'data-afaire-ferme') || b.getAttribute('aria-haspopup'));
    const clic = (e) => { const b = e.target && e.target.closest && e.target.closest('button, a'); if (ouvreAilleurs(b)) setTimeout(() => conteneur.dispatchEvent(new CustomEvent('vrm-afaire-fermer')), 0); };
    conteneur.addEventListener('click', clic);
    return () => { mo.disconnect(); conteneur.removeEventListener('click', clic); };
  }, [conteneur]);
  const v = useMemo(() => ({ conteneur, n }), [conteneur, n]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function VersAFaire({ children }) {
  const c = useContext(Ctx);
  if (!c || !c.conteneur) return <>{children}</>;
  return createPortal(<div data-ui-afaire-item="">{children}</div>, c.conteneur);
}

export function AFaireLigne({ titre, className = '', capsule = false, seulement = '' }) {
  const c = useContext(Ctx);
  const [tel, setTel] = useState(telephone);
  const [ouvert, setOuvert] = useState(false);
  const place = useRef(null), corps = useRef(null);
  React.useEffect(() => {
    if (!c || !c.conteneur) return undefined;
    const f = () => setOuvert(false);
    c.conteneur.addEventListener('vrm-afaire-fermer', f);
    return () => c.conteneur.removeEventListener('vrm-afaire-fermer', f);
  }, [c && c.conteneur]);
  // (14 nov., correctif « À faire ») Plus rien à faire (la dernière alerte réglée) : la feuille ouverte se
  // ferme, elle ne reste pas vide ; passé à l'ordinateur (rotation, fenêtre élargie), elle n'a plus lieu d'être.
  const nIci = c ? c.n : 0;
  React.useEffect(() => { if (ouvert && (!nIci || !tel)) setOuvert(false); }, [ouvert, nIci, tel]);
  React.useEffect(() => {
    let mq = null; const f = () => setTel(telephone());
    try { mq = window.matchMedia('(max-width: 767px)'); mq.addEventListener('change', f); } catch (_) {}
    return () => { try { mq && mq.removeEventListener('change', f); } catch (_) {} };
  }, []);
  // Le conteneur va là où il doit être vu : la page (ordinateur), la feuille (ouverte), ou caché.
  useLayoutEffect(() => {
    if (!c || !c.conteneur) return;
    const cible = (tel && ouvert) ? corps.current : place.current;
    if (cible && c.conteneur.parentNode !== cible) cible.appendChild(c.conteneur);
  });
  if (!c || !c.conteneur) return null;
  if (seulement === 'telephone' && !tel) return null;
  if (seulement === 'ordinateur' && tel) return null;
  if (!tel) return <div ref={place} className={'vrm-ui-afaire-place' + (className ? ' ' + className : '')} data-ui-afaire-place="ordinateur"/>;
  return (
    <>
      {c.n > 0 ? (
        <button type="button" className={(capsule ? 'vrm-ui-afaire-capsule sb-touche' : 'vrm-ui-afaire sb-lien') + (className ? ' ' + className : '')} aria-haspopup="dialog" aria-expanded={ouvert} data-ui-afaire={c.n} onClick={() => setOuvert(true)}>
          <span className="vrm-ui-afaire-point" aria-hidden="true"/>
          <span className="vrm-ui-afaire-mots">{titre || tr('listes.afaire')} <span className="vrm-ui-afaire-n">· {c.n}</span></span>
          {capsule ? null : <Chevron/>}
        </button>) : null}
      <div ref={place} hidden data-ui-afaire-place="telephone"/>
      {ouvert ? <Feuille titre={titre || tr('listes.afaire')} onClose={() => setOuvert(false)} fermeSiAutreCouche data-ui-afaire-feuille=""><div ref={corps}/></Feuille> : null}
    </>
  );
}
