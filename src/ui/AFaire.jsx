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
// `capsule` : la ligne prend la forme d'une capsule de filtre (posée en tête de la rangée des vues : aucune ligne de plus).
import React, { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { Feuille } from './Feuille.jsx';
import './ui.css';

const Ctx = createContext(null);
const Chevron = () => <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const telephone = () => { try { return window.matchMedia('(max-width: 767px)').matches; } catch (_) { return false; } };

export function AFaireHote({ children }) {
  const conteneur = useMemo(() => { if (typeof document === 'undefined') return null; const d = document.createElement('div'); d.className = 'vrm-ui-afaire-corps'; d.setAttribute('data-ui-afaire-corps', ''); return d; }, []);
  const [n, setN] = useState(0);
  useLayoutEffect(() => {
    if (!conteneur) return undefined;
    const compter = () => setN([...conteneur.children].filter((c) => c.childNodes.length > 0 && (c.textContent || '').trim() !== '').length);
    compter();
    const mo = new MutationObserver(compter);
    mo.observe(conteneur, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [conteneur]);
  const v = useMemo(() => ({ conteneur, n }), [conteneur, n]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function VersAFaire({ children }) {
  const c = useContext(Ctx);
  if (!c || !c.conteneur) return <>{children}</>;
  return createPortal(<div data-ui-afaire-item="">{children}</div>, c.conteneur);
}

export function AFaireLigne({ titre, className = '', capsule = false }) {
  const c = useContext(Ctx);
  const [tel, setTel] = useState(telephone);
  const [ouvert, setOuvert] = useState(false);
  const place = useRef(null), corps = useRef(null);
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
  if (!tel) return <div ref={place} className={'vrm-ui-afaire-place' + (className ? ' ' + className : '')} data-ui-afaire-place="ordinateur"/>;
  return (
    <>
      {c.n > 0 ? (
        <button type="button" className={(capsule ? 'vrm-ui-afaire-capsule' : 'vrm-ui-afaire') + (className ? ' ' + className : '')} aria-haspopup="dialog" aria-expanded={ouvert} data-ui-afaire={c.n} onClick={() => setOuvert(true)}>
          <span className="vrm-ui-afaire-point" aria-hidden="true"/>
          <span className="vrm-ui-afaire-mots">{titre || tr('listes.afaire')} <span className="vrm-ui-afaire-n">· {c.n}</span></span>
          <Chevron/>
        </button>) : null}
      <div ref={place} hidden data-ui-afaire-place="telephone"/>
      {ouvert ? <Feuille titre={titre || tr('listes.afaire')} onClose={() => setOuvert(false)} data-ui-afaire-feuille=""><div ref={corps}/></Feuille> : null}
    </>
  );
}
