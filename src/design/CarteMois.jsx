// La carte sombre « Fusion » (Julien : « la première photo avec les stats
// novembre ») : un surtitre, UN grand chiffre, une sous-ligne, une rangée de
// cases translucides, et une petite courbe quand c'est une tendance.
// Elle n'invente rien : chaque valeur lui est passée par l'écran, qui la tient
// de sa règle (§5 « une seule règle par notion »). Une valeur `null` s'écrit
// « — » (pas su), jamais 0.
import React, { useLayoutEffect, useRef } from 'react';
import { cheminMonotone } from '../courbeMonotone.js';

// La courbe : des valeurs (une par jour), dessinées sans sommet inventé
// (interpolation monotone), remplissage dégradé. Moins de trois points ⇒ rien (deux points font un trait plat, pas une tendance — critique du 3 nov., #12).
export function Courbe({ valeurs, largeur = 96, hauteur = 46 }) {
  const id = React.useId().replace(/:/g, '');
  const v = (valeurs || []).filter((x) => Number.isFinite(x));
  if (v.length < 3 || !v.some((x) => x > 0)) return null;
  const max = Math.max(...v), min = Math.min(0, ...v);
  const pad = 5;
  const pts = v.map((x, i) => [pad + (i * (largeur - 2 * pad)) / (v.length - 1), hauteur - pad - ((x - min) / ((max - min) || 1)) * (hauteur - 2 * pad)]);
  const d = cheminMonotone(pts);
  const [xf, yf] = pts[pts.length - 1];
  return (
    <svg className="vrm-fu-courbe" width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden="true">
      <defs><linearGradient id={'fu' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a84ff" stopOpacity=".42" /><stop offset="1" stopColor="#0a84ff" stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${xf.toFixed(2)},${hauteur} L${pts[0][0].toFixed(2)},${hauteur} Z`} fill={`url(#fu${id})`} />
      <path d={d} fill="none" stroke="#0a84ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xf} cy={yf} r="3.5" fill="#0a84ff" />
    </svg>
  );
}

// cases : [{ cle, n, l, titre, raison, onClick, attrs }] — `n` peut être un nœud ; `raison` :
// la raison courte d'un « — » (ou le manque nommé d'un montant), sous le libellé.
// (3 nov., carte réglable) `action` : un bouton discret en haut à droite (« Modifier ») ;
// `nu` : la carte sans fond à elle, posée dans une tête déjà sombre (Ma journée, Compta) ;
// `grandAttrs` : les attributs du grand chiffre (posés sur le chiffre même, « — » compris).
export default function CarteMois({ surtitre, valeur, sous = null, cases = [], courbe = null, enHaut = null, children = null, className = '', action = null, nu = false, grandAttrs = null, ...attrs }) {
  const vide = valeur == null || valeur === '';
  // (3 nov., cas extrêmes) Un montant à 5 chiffres (« 35 211,97 € ») ne se coupe jamais
  // en « 35 211,9… » : la taille descend d'un pixel à la fois jusqu'à ce qu'il tienne
  // (plancher 22 px), et remonte quand la place revient. Mesuré, pas deviné.
  const grandRef = useRef(null);
  useLayoutEffect(() => {
    const el = grandRef.current;
    if (!el) return undefined;
    const ajuste = () => {
      el.style.fontSize = '';
      let fs = parseFloat(getComputedStyle(el).fontSize) || 38;
      while (el.scrollWidth > el.clientWidth + 0.5 && fs > 22) { fs -= 1; el.style.fontSize = fs + 'px'; }
    };
    ajuste();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(ajuste);
    ro.observe(el.parentElement || el);
    return () => ro.disconnect();
  }, [valeur, vide]);
  // (5 nov., chantier E1, revue 2.11) « Modifier » chevauchait la courbe de Ventes (posé en
  // absolu au-dessus d'elle). Sur une carte à elle, il est DANS la rangée du surtitre : la
  // courbe et le grand chiffre commencent dessous, rien ne peut plus passer sous lui. Posée
  // nue dans une tête (Ma journée), la tête le place sur la ligne de son titre.
  const enRangee = !nu && !!action;
  return (
    <section className={(nu ? 'vrm-fu-carte-nu' : 'vrm-fu-carte') + (action ? ' a-action' : '') + (enRangee ? ' a-rangee' : '') + (className ? ' ' + className : '')} {...(nu ? {} : { 'data-fu-carte': '' })} {...attrs}>
      {enHaut}
      {enRangee ? (
        <div className="vrm-fu-carte-haut">
          {surtitre ? <span className="vrm-fu-surtitre">{surtitre}</span> : <span />}
          {action}
        </div>
      ) : action}
      <div className="vrm-fu-carte-tete">
        <div className="vrm-fu-carte-txt">
          {surtitre && !enRangee ? <span className="vrm-fu-surtitre">{surtitre}</span> : null}
          <div ref={grandRef} className={'vrm-fu-grand' + (vide ? ' is-vide' : '')} {...(grandAttrs || {})}>{vide ? '—' : valeur}</div>
          {sous ? <div className="vrm-fu-sous">{sous}</div> : null}
        </div>
        {courbe && courbe.length ? <Courbe valeurs={courbe} /> : null}
      </div>
      {cases.length ? (
        <div className="vrm-fu-cases" style={{ '--n': cases.length }}>
          {cases.map((c) => {
            const corps = <><b className={c.n == null ? 'is-vide' : undefined}>{c.n == null ? '—' : c.n}</b><span>{c.l}</span>{c.raison ? <small className="vrm-fu-case-raison" data-carte-raison="">{c.raison}</small> : null}</>;
            return c.onClick
              ? <button key={c.cle} type="button" className="vrm-fu-case" data-fu-case={c.cle} title={c.titre} onClick={c.onClick} {...(c.attrs || {})}>{corps}</button>
              : <div key={c.cle} className="vrm-fu-case" data-fu-case={c.cle} title={c.titre} {...(c.attrs || {})}>{corps}</div>;
          })}
        </div>
      ) : null}
      {children}
    </section>
  );
}
