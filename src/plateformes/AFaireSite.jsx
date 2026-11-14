// ── src/plateformes/AFaireSite.jsx — « • À faire · N › » d'un site (Leboncoin, eBay, Vestiaire) ──
// Julien (14 nov., AJOUT 3) : « 10 choses à revoir », « Republier sur Leboncoin », « Baisser le prix »,
// « À faire sur eBay »… posés AVANT la liste, en cartes de 120 px : la 1re annonce arrivait après un
// écran et demi. Ici : UNE ligne (la forme de `src/ui/LigneAFaire`, mêmes classes `vrm-ui-afaire`) qui
// ouvre une feuille (les classes de `src/ui/Feuille`) où chaque chose garde SON geste, tel quel.
//
// La seule différence avec `LigneAFaire` : la feuille reste MONTÉE quand elle est fermée (`hidden`).
// Ses enfants portent des états longs (une baisse de prix en série, une republication, un formulaire
// eBay ouvert) : démonter la feuille à la fermeture (Échap, voile) aurait coupé une série en cours.
// Les enfants restent donc dans la page (et leurs `data-*` aussi) ; seule la feuille se montre ou
// se cache. Rien n'est calculé ici : `n` est le nombre de choses que l'écran a comptées.
//   <AFaireSite n={3} site="leboncoin">{portes}</AFaireSite>
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import '../ui/ui.css';
import './plateformes.css';

const Chevron = () => <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// Une demande d'ouverture venue d'ailleurs (un conseil de Ma journée qui mène ici) : l'événement
// `vrm:afaire-site` { site } ouvre la feuille du site.
export function ouvrirAFaireSite(site) { try { window.dispatchEvent(new CustomEvent('vrm:afaire-site', { detail: { site } })); } catch (_) {} }

export function AFaireSite({ n, site = '', titre, children, className = '', ...attrs }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const f = (e) => { if (!e || !e.detail || !e.detail.site || e.detail.site === site) setOuvert(true); };
    window.addEventListener('vrm:afaire-site', f);
    return () => window.removeEventListener('vrm:afaire-site', f);
  }, [site]);
  useEffect(() => {
    if (!ouvert) return undefined;
    const k = (e) => {
      // Échap ferme LA feuille du dessus seulement : une feuille ouverte depuis la nôtre (baisse en
      // série, republication) se ferme d'abord (elle est montée après nous, dans <body>).
      if (e.key !== 'Escape') return;
      const voiles = [...document.querySelectorAll('.vrm-ui-voile, .vrm-fs, [role="dialog"]')].filter((x) => x.getClientRects().length);
      const dernier = voiles[voiles.length - 1];
      if (dernier && ref.current && !ref.current.contains(dernier) && dernier !== ref.current) return;
      setOuvert(false);
    };
    window.addEventListener('keydown', k);
    try { if (ref.current) ref.current.focus(); } catch (_) {}
    return () => window.removeEventListener('keydown', k);
  }, [ouvert]);
  // Un geste de la feuille qui mène DANS l'écran (filtrer la liste, aller à un bloc) la referme.
  const surClic = (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-afaire-ferme]') : null;
    if (t) setTimeout(() => setOuvert(false), 0);
  };
  if (!n) return null;
  const nom = titre || tr('listes.afaire');
  const feuille = (
    <div className="vrm-ui-voile vrm-pf-voile" hidden={!ouvert} onClick={(e) => { if (e.target === e.currentTarget) setOuvert(false); }}>
      <div ref={ref} tabIndex={-1} className="vrm-ui-feuille vrm-pf-feuille" role="dialog" aria-modal="true" aria-label={nom} data-noswipe="" data-pf-afaire-feuille={site} onClick={surClic}>
        <div className="vrm-ui-feuille-tete">
          <h2 className="vrm-ui-feuille-titre">{nom}</h2>
          <button type="button" className="vrm-ui-feuille-fermer" onClick={() => setOuvert(false)}>{tr('listes.ok')}</button>
        </div>
        <div className="vrm-ui-afaire-corps vrm-pf-afaire-corps">{children}</div>
      </div>
    </div>
  );
  return (
    <>
      <button type="button" className={'vrm-ui-afaire vrm-pf-afaire' + (className ? ' ' + className : '')} aria-haspopup="dialog" aria-expanded={ouvert}
        data-ui-afaire={n} data-pf-afaire={site} onClick={() => setOuvert(true)} {...attrs}>
        <span className="vrm-ui-afaire-point" aria-hidden="true"/>
        <span className="vrm-ui-afaire-mots">{nom} <span className="vrm-ui-afaire-n">· {n}</span></span>
        <Chevron/>
      </button>
      {typeof document !== 'undefined' ? createPortal(feuille, document.body) : null}
    </>
  );
}
export default AFaireSite;
