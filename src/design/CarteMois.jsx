// La carte sombre « Fusion » (Julien : « la première photo avec les stats
// novembre ») : un surtitre, UN grand chiffre, une sous-ligne, une rangée de
// cases translucides, et une petite courbe quand c'est une tendance.
// Elle n'invente rien : chaque valeur lui est passée par l'écran, qui la tient
// de sa règle (§5 « une seule règle par notion »). Une valeur `null` s'écrit
// « — » (pas su), jamais 0.
import React, { useLayoutEffect, useRef } from 'react';
import { cheminMonotone } from '../courbeMonotone.js';
import { PileVignettes } from './PileVignettes.jsx';
import './carte-pages.css';   // (11 nov., lot stats-plus) plus de trois cases : pages de 2×2 au téléphone

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

// ── LE CHIFFRE QUI ROULE (6 nov., v36-visuel-2) ─────────────────────────────
// Comme Wallet et Fitness : quand le grand chiffre CHANGE (une vente arrive, la
// lecture se termine), le nouveau monte en place (0,4 em, un léger flou, 380 ms,
// courbe de sortie). Le premier rendu ne bouge pas ; un rendu au même chiffre ne
// bouge pas. ⚠️ Le texte reste UN nœud (jamais un caractère par élément) : le mode
// stream cache un montant par nœuds voisins (`masquerSuite`) — « 6 », « 0 », « 8 »
// séparés laisseraient lire « 60 ». Mouvement réduit : rien (styles-visuel-2.css).
const texteDe = (n) => (n == null || typeof n === 'boolean') ? '' : (typeof n === 'string' || typeof n === 'number') ? String(n)
  : Array.isArray(n) ? n.map(texteDe).join('') : React.isValidElement(n) ? texteDe(n.props && n.props.children) : '';
export function ChiffreRoule({ valeur }) {
  const prec = useRef(null);
  const texte = texteDe(valeur);
  const change = prec.current != null && prec.current !== texte;
  React.useEffect(() => { prec.current = texte; }, [texte]);
  return <span key={texte} className={'vrm-roule' + (change ? ' is-neuf' : '')}>{valeur}</span>;
}

// cases : [{ cle, n, l, titre, raison, onClick, attrs }] — `n` peut être un nœud ; `raison` :
// la raison courte d'un « — » (ou le manque nommé d'un montant), sous le libellé.
// (3 nov., carte réglable) `action` : un bouton discret en haut à droite (« Modifier ») ;
// `nu` : la carte sans fond à elle, posée dans une tête déjà sombre (Ma journée, Compta) ;
// `grandAttrs` : les attributs du grand chiffre (posés sur le chiffre même, « — » compris).
// (9 nov., Ma journée v2) `tete` : un bloc qui prend la place du grand chiffre (et de son
// surtitre, de sa sous-ligne, de sa pile) — la frise de la semaine de Ma journée, qui porte
// le MÊME chiffre (« vendu » du jour) pour le jour choisi : jamais deux fois à l'écran.
export default function CarteMois({ surtitre, valeur, sous = null, cases = [], courbe = null, pile = null, enHaut = null, children = null, className = '', action = null, nu = false, grandAttrs = null, tete = null, ...attrs }) {
  const vide = valeur == null || valeur === '';
  // (3 nov., cas extrêmes) Un montant à 5 chiffres (« 35 211,97 € ») ne se coupe jamais
  // en « 35 211,9… » : la taille descend d'un pixel à la fois jusqu'à ce qu'il tienne
  // (plancher 22 px), et remonte quand la place revient. Mesuré, pas deviné.
  const grandRef = useRef(null);
  // (6 nov., v36-raccords · banc chargement) Une case qui a dit une raison (« lecture… »)
  // garde la place de cette ligne quand sa valeur arrive : la carte ne rétrécit pas sous
  // le doigt (Colis en réseau lent : −18 px, la rangée des filtres remontait, CLS 0,005).
  const raisonsVues = useRef(new Set());
  useLayoutEffect(() => {
    const el = grandRef.current;
    if (!el) return undefined;
    // (7 nov., vitesse) Avant : une boucle qui baissait d'1 px et relisait la mise
    // en page à chaque tour (jusqu'à 16 recalculs par carte, et à chaque
    // redimensionnement) — ~1,3 s de gel mesuré au téléphone. Maintenant : une
    // règle de trois sur la largeur, une seule correction au plus, et rien si la
    // largeur n'a pas changé.
    let derniere = -1;
    const ajuste = () => {
      const largeur = el.clientWidth;
      if (largeur === derniere) return;
      derniere = largeur;
      el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(el).fontSize) || 38;
      const sw = el.scrollWidth;
      if (!(sw > largeur + 0.5) || largeur <= 0) return;
      let fs = Math.max(22, Math.floor(base * largeur / sw));
      el.style.fontSize = fs + 'px';
      if (el.scrollWidth > el.clientWidth + 0.5 && fs > 22) { fs = Math.max(22, fs - 2); el.style.fontSize = fs + 'px'; }
    };
    ajuste();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => ajuste());
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
      {tete ? tete : <div className="vrm-fu-carte-tete">
        <div className="vrm-fu-carte-txt">
          {surtitre && !enRangee ? <span className="vrm-fu-surtitre">{surtitre}</span> : null}
          <div ref={grandRef} className={'vrm-fu-grand' + (vide ? ' is-vide' : '')} {...(grandAttrs || {})}>{vide ? '—' : <ChiffreRoule valeur={valeur} />}</div>
          {sous ? <div className="vrm-fu-sous">{sous}</div> : null}
        </div>
        {courbe && courbe.length ? <Courbe valeurs={courbe} /> : null}
        {/* (6 nov., v36-visuel-2) Les paires du chiffre, en pile (l'écran passe LEURS photos, par
            identité — `PileVignettes` n'en cherche aucune) ; jamais à côté d'une courbe. */}
        {!(courbe && courbe.length) && pile && Array.isArray(pile.srcs) && pile.srcs.some(Boolean) && pile.Photo
          ? <PileVignettes className="vrm-fu-pile" srcs={pile.srcs} n={pile.n || 0} Photo={pile.Photo} mortes={pile.mortes} onMorte={pile.onMorte} data-fu-pile="" /> : null}
      </div>}
      {cases.length ? (
        <CasesEnPages cases={cases}>{(liste) => liste.map((c) => {
            if (c.raison) raisonsVues.current.add(c.cle);
            // (10 nov., lot P) Au lecteur d'écran : « Vendu · mois : 80 € » — le libellé AVANT le
            // chiffre, et « pas su » à la place d'un « — » muet (§5). Le dessin reste tel quel.
            const lu = `${texteDe(c.l)} : ${c.n == null ? 'pas su' : texteDe(c.n)}${c.raison ? ', ' + texteDe(c.raison) : ''}`;
            const corps = <><span className="vrm-sr-seul" data-fu-case-lu="">{lu}</span><b aria-hidden="true" className={c.n == null ? 'is-vide' : undefined} style={{ '--nc': Math.max(1, texteDe(c.n).length) }}>{c.n == null ? '—' : <ChiffreRoule valeur={c.n} />}</b><span aria-hidden="true">{c.l}</span>{c.raison ? <small className="vrm-fu-case-raison" data-carte-raison="" aria-hidden="true">{c.raison}</small> : raisonsVues.current.has(c.cle) ? <small className="vrm-fu-case-raison" aria-hidden="true">{'\u00a0'}</small> : null}</>;
            return c.onClick
              ? <button key={c.cle} type="button" className="vrm-fu-case" data-fu-case={c.cle} title={c.titre} onClick={c.onClick} {...(c.attrs || {})}>{corps}</button>
              : <div key={c.cle} className="vrm-fu-case" data-fu-case={c.cle} title={c.titre} {...(c.attrs || {})}>{corps}</div>;
          })}</CasesEnPages>
      ) : null}
      {children}
    </section>
  );
}

// ── PLUS DE TROIS CASES (11 nov., lot stats-plus) ───────────────────────────
// Julien : « on a la possibilité d'avoir qu'une seule stat dans le carré bleu ».
// Jusqu'à trois cases : la rangée d'avant, inchangée. Quatre : une grille 2×2.
// Cinq ou six : au téléphone, des PAGES de quatre (2×2) qu'on fait glisser, avec
// des points de pagination (boutons : « Page 2 sur 2 ») ; sur ordinateur, une
// seule rangée (les pages s'effacent, `display: contents`). Le glissé reste dans
// la carte (`data-noswipe` : il ne change pas d'onglet).
export const PAR_PAGE = 4;
export function CasesEnPages({ cases, children }) {
  const n = cases.length;
  const rail = useRef(null);
  const [page, setPage] = React.useState(0);
  if (n <= 3) return <div className="vrm-fu-cases" style={{ '--n': n }}>{children(cases)}</div>;
  const pages = [];
  for (let i = 0; i < n; i += PAR_PAGE) pages.push(cases.slice(i, i + PAR_PAGE));
  const surDefile = () => {
    const el = rail.current;
    if (!el || !el.clientWidth) return;
    const p = Math.round(el.scrollLeft / el.clientWidth);
    if (p !== page) setPage(Math.max(0, Math.min(pages.length - 1, p)));
  };
  const aller = (p) => { const el = rail.current; if (!el) return; setPage(p); try { el.scrollTo({ left: p * el.clientWidth, behavior: 'smooth' }); } catch (_) { el.scrollLeft = p * el.clientWidth; } };
  return (
    <div className="vrm-fu-cases-pages" data-fu-pages={pages.length} data-fu-n={n} style={{ '--n': n }}>
      <div ref={rail} className="vrm-fu-cases is-pages" data-noswipe="" onScroll={surDefile} style={{ '--n': n }}>
        {pages.map((liste, i) => (
          <div key={i} className="vrm-fu-page" data-fu-page={i} aria-label={pages.length > 1 ? `Chiffres, page ${i + 1} sur ${pages.length}` : undefined} role={pages.length > 1 ? 'group' : undefined}>
            {children(liste)}
          </div>
        ))}
      </div>
      {pages.length > 1 ? (
        <div className="vrm-fu-points" data-fu-points="">
          {pages.map((_, i) => (
            <button key={i} type="button" className="vrm-fu-point" aria-current={i === page ? 'true' : undefined} aria-label={`Page ${i + 1} sur ${pages.length}`} data-fu-point={i} onClick={() => aller(i)}><span aria-hidden="true"/></button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
