// ── src/natif/SelecteurSite.jsx — LE sélecteur de plateforme, un pour toute l'app ───────────────────────────────────────
// Décision du 20 nov. : les onglets restent par fonction ; ce sélecteur, en haut de chaque écran principal, choisit le site
// regardé PARTOUT (src/siteCourant.js, clé `vrm_site_courant`, sites RELIÉS et choisis — `siteMontre`).
// (20 nov. soir, Julien : « c'est de la grosse merde les onglets plateforme […] faire un bel affichage ») UNE RANGÉE DE
// PASTILLES qui défile à l'horizontale : le VRAI logo du site, en couleur (clair et sombre), son nom complet, un compteur
// discret de ce que l'onglet contient pour lui ; « Tous » porte une petite pile des logos. Sélectionnée : fond d'accent très
// léger, bord d'accent, texte à l'encre ; les autres neutres. 36 px de haut, cible 44, arrondi complet ; fondu au bord quand
// ça déborde, la pastille choisie toujours ramenée dans la vue ; transition douce (aucune sous `prefers-reduced-motion`).
// Props :
//   sites       les sites RELIÉS, dans l'ordre de l'app — moins de deux ⇒ rien n'est rendu
//   valeur      'toutes' | un site            onChange (site) => …
//   nom         (site) => son nom complet     tous  le libellé de « Tous »     libelle  le nom du groupe (lecteur d'écran)
//   nombres     { toutes?, vinted?, … } — le compteur de chaque pastille (absent ⇒ rien d'écrit, jamais « 0 » inventé)
//   indisponible + raison : l'écran n'a pas de règle par site (Statistiques, Déclarer…) ⇒ pas de pastilles : UNE ligne
//               discrète (« Tous les sites »).
//   attrs       data-* de l'écran (`data-selecteur-site`)
import React from 'react';
import { useSiteCourant } from '../siteCourant.js';
import './selecteur-site.css';
export { useSiteCourant, CLE_SITE_COURANT } from '../siteCourant.js';

const LOGOS = { vinted: '/brands/vinted.svg', leboncoin: '/brands/leboncoin.svg', ebay: '/brands/ebay.svg', vestiaire: '/brands/vestiaire.svg' };
// Le logo du site, en SA couleur (la forme est le fichier de public/brands/, la couleur est posée par la feuille selon le site).
export function LogoCouleur({ site, taille = 20 }) {
  const src = LOGOS[site];
  if (!src) return null;
  return <span className="n-pastille-logo" data-site={site} aria-hidden="true" style={{ '--n-logo': `url("${src}")`, width: taille, height: taille }}/>;
}
const reduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

export function SelecteurSite({ sites = [], valeur = 'toutes', onChange, nom = (s) => s, tous = 'Tous', libelle = '', nombres = null, attrs = null, indisponible = false, raison = '' }) {
  const refPiste = React.useRef(null);
  const [bords, setBords] = React.useState({ g: false, d: false });
  const liste = Array.isArray(sites) ? sites : [];
  const v = indisponible ? 'toutes' : liste.includes(valeur) ? valeur : 'toutes';
  const mesurer = React.useCallback(() => {
    const el = refPiste.current; if (!el) return;
    const g = el.scrollLeft > 2, d = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setBords((b) => (b.g === g && b.d === d ? b : { g, d }));
  }, []);
  // La pastille choisie revient dans la vue (défilement de la rangée seule, jamais de la page).
  React.useLayoutEffect(() => {
    const el = refPiste.current; if (!el) return;
    const b = el.querySelector('[aria-checked="true"]');
    if (b) {
      const g = b.offsetLeft - 16, d = b.offsetLeft + b.offsetWidth + 16 - el.clientWidth;
      const x = g < el.scrollLeft ? g : d > el.scrollLeft ? d : null;
      if (x != null) { try { el.scrollTo({ left: Math.max(0, x), behavior: reduit() ? 'auto' : 'smooth' }); } catch (_) { el.scrollLeft = Math.max(0, x); } }
    }
    mesurer();
  }, [v, liste.join('|'), mesurer]);
  React.useEffect(() => { const f = () => mesurer(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, [mesurer]);
  if (liste.length < 2) return null;
  if (indisponible) {
    return <div className="n-selecteur-site" data-site-courant="toutes" data-site-indisponible="1" {...(attrs || {})}>
      <p className="n-site-tous-seul" data-site-raison="">{raison || tous}</p>
    </div>;
  }
  const choix = ['toutes', ...liste];
  const clavier = (e) => {
    const i = choix.indexOf(v); let k = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') k = (i + 1) % choix.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') k = (i - 1 + choix.length) % choix.length;
    else if (e.key === 'Home') k = 0; else if (e.key === 'End') k = choix.length - 1;
    if (k < 0) return;
    e.preventDefault(); if (onChange) onChange(choix[k]);
    const b = refPiste.current && refPiste.current.querySelectorAll('[role="radio"]')[k]; if (b) b.focus();
  };
  const n = (s) => (nombres && Number.isFinite(nombres[s]) ? nombres[s] : null);
  return (
    <div className="n-selecteur-site" data-site-courant={v} data-n-choix={choix.length} data-bord-g={bords.g ? '1' : undefined} data-bord-d={bords.d ? '1' : undefined} {...(attrs || {})}>
      <div className="n-pastilles-site" ref={refPiste} role="radiogroup" aria-label={libelle || undefined} onKeyDown={clavier} onScroll={mesurer}>
        {choix.map((s) => {
          const on = s === v; const c = n(s);
          return (
            <button key={s} type="button" role="radio" aria-checked={on ? 'true' : 'false'} tabIndex={on ? 0 : -1} className="n-pastille-site"
              data-site-choix={s} onClick={() => { if (!on && onChange) onChange(s); }}>
              {s === 'toutes'
                ? <span className="n-pastille-pile" aria-hidden="true">{liste.slice(0, 3).map((x) => <span key={x} className="n-pastille-pile-logo"><LogoCouleur site={x} taille={12}/></span>)}</span>
                : <LogoCouleur site={s} taille={18}/>}
              <span className="n-pastille-nom">{s === 'toutes' ? tous : nom(s)}</span>
              {c != null ? <span className="n-pastille-n">{c}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
// Le sélecteur qui garde lui-même le choix : ce qu'un écran pose quand il n'a rien à en faire de plus.
export function SelecteurSiteGarde(props) {
  const [site, poser] = useSiteCourant();
  return <SelecteurSite {...props} valeur={site} onChange={poser}/>;
}
export default SelecteurSite;
