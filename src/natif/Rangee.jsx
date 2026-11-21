// ── src/natif/Rangee.jsx — UNE ligne d'une liste groupée (contrat NATIF.md §3) ───────────
// À poser dans un <Groupe>. Hauteur : 44 (texte seul ou icône) · 56 (vignette 44) · 72 (vignette 56).
// Props :
//   titre        le texte principal (17/22) — 1 ligne, ou `lignes={2}` pour un titre d'annonce
//   sousTitre    15/20 gris, une ligne (« N° 124 · 42 · en ligne »)
//   sousLignes   2 ⇒ le sous-titre peut passer à la ligne (une phrase d'état qu'on ne coupe pas : « En attente : partira dès que… ») — ajout du 19 nov.
//   valeur       à droite, 17/22 (un prix, un état court) ; `valeurForte` ⇒ en encre et 600
//   detailValeur sous la valeur, 13/18 gris (« il y a 2 j »)
//   vignette     <Vignette src=… /> (56 par défaut, `taille={44}` pour la rangée de 56)
//   icone        nœud (icône de l'app, 22) — à la place de la vignette
//   plaque       <Plaque numero=…/> posée avant le sous-titre
//   pastille     <Pastille>…</Pastille> posée avant la valeur
//   pastilleSous <Pastille>…</Pastille> posée sur la 2e ligne, après la plaque (le titre garde toute sa ligne : 19 nov.)
//   fin          'chevron' (ouvre une page) | 'coche' (choix courant) | nœud | rien
//   interrupteur { actif, onChange } ⇒ un interrupteur à droite ; toute la rangée le bascule
//   onClick / href  la rangée ENTIÈRE se touche (bouton ou lien) — jamais un bouton dans la rangée
//   actions      [{ cle, libelle, icone, ton, onClick, franc }] ⇒ BALAYAGE vers la gauche.
//                ton : 'accent' (défaut) | 'ambre' | 'neutre' | 'encre'. `franc` : balayer jusqu'au bout fait CE geste.
//                Au clavier : ← ouvre les actions (focus sur la première), → ou Échap les referme.
//                À la souris : clic droit. La DERNIÈRE action est la principale (la plus proche du bord).
//   ton          'ambre' ⇒ le sous-titre est en ambre (un geste à faire, une date limite LUE proche)
//   selectionnee vrai ⇒ fond teinté (l'élément ouvert dans le volet de détail, à l'ordinateur)
//   indisponible vrai ⇒ ne se touche pas ; `raison` remplace le sous-titre et dit pourquoi
//   selection    { cochee, onChange(bool), libelle, indisponible } ⇒ UNE CASE à gauche (44 × 44), à côté du corps (jamais dedans) :
//                la cocher ne touche pas la rangée, toucher la rangée ne la coche pas (Ventes : les colis cochés pour l'impression).
//                `indisponible` : la case est grisée et ne se coche pas (pas de bordereau).
//   note         une 3e ligne, 13/18 gris, sur toute la largeur (« Étagère A · r1 c3 · Mondial Relay ») — elle passe à la ligne
//   pied         (21 nov., ventes-lisibles) des gestes SOUS le corps, HORS de son bouton (jamais un bouton dans un bouton) :
//                Ventes y pose « Relier » et le champ « Prix d'achat » ; aligné sur le texte, il ne glisse pas au balayage.
//   className, attrs (data-* de l'écran)
// Exemple :
//   <Rangee vignette={<Vignette src={photo} alt=""/>} titre="Nike Air Max 90 Triple White" lignes={2}
//           plaque={<Plaque numero={124}/>} sousTitre="42 · très bon état" valeur="45 €" fin="chevron"
//           onClick={() => ouvrir(id)}
//           actions={[{ cle: 'baisser', libelle: 'Baisser', ton: 'neutre', onClick: baisser },
//                     { cle: 'envoye', libelle: 'Envoyé', onClick: marquer, franc: true }]}/>
//
// `Vignette` : la photo (rayon 10) ; sans photo ⇒ un fond calme et l'icône « image » (jamais un trou).
// `Interrupteur` : l'interrupteur seul, pour un usage hors rangée (rare).
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx, mouvementReduit } from './outils.js';
import { Glyphe } from './icones.jsx';

// `image` (ajout du 19 nov.) : un nœud qui dessine la photo lui-même (l'app passe sa <PhotoVinted> : sans référent,
// relais de l'extension quand l'adresse Vinted a expiré) ; il remplit le cadre, la photo absente reste l'icône.
// (21 nov., fluidité — captures iPhone de Julien : Annonces, Achats, Ventes aux vignettes VIDES, Aujourd'hui avec ses
// photos) Une photo du CDN de Vinted ne s'affiche pas toujours en <img> nu : l'iPhone se la voit refuser (src/photosVinted.js
// `murNatif` : « le secours a marché, le chargement direct jamais »), et seule <PhotoVinted> de l'app passe par le relais
// (serveur, extension). Aujourd'hui la passait en `image` ; Annonces, Ventes et Achats (tableaux et rangées) donnaient
// l'adresse nue à `Vignette` — boîte vide. L'app pose ICI, une fois, qui dessine une photo qu'elle sait servir
// (`poserPhoto(src => <PhotoVinted …/> | null)`) : toute `Vignette` à adresse Vinted passe par la même règle (§11).
let _Photo = null;
export function poserPhoto(f) { _Photo = typeof f === 'function' ? f : null; }
export function photoParApp(src) { try { return src && _Photo ? _Photo(src) : null; } catch (_) { return null; } }
export function Vignette({ src = '', alt = '', taille = 56, icone = null, image: imageDonnee = null, className = '' }) {
  const image = imageDonnee || photoParApp(src);
  const [rate, setRate] = React.useState(false);
  React.useEffect(() => { setRate(false); }, [src]);
  // (20 nov., affichage instantané) La photo arrive en FONDU sur un fond neutre doux (jamais un trou qui « claque ») ;
  // déjà en cache ⇒ montrée telle quelle, sans fondu. Taille fixée (`width`/`height`) : rien ne saute.
  const refImg = React.useRef(null);
  const [chargee, setChargee] = React.useState(false);
  React.useLayoutEffect(() => { const i = refImg.current; setChargee(i && i.complete && i.naturalWidth > 0 ? 'deja' : false); }, [src]);
  // (19 nov. soir) 48 : la vignette d'un tableau de travail ; (21 nov., ventes-lisibles) 64 : la rangée d'une vente au téléphone.
  const t = taille === 44 ? 44 : taille === 48 ? 48 : taille === 64 ? 64 : 56;
  if (image) return <span className={cx('n-vignette', 'n-vignette-image', className)} data-n-taille={t} role={alt ? 'img' : undefined} aria-label={alt || undefined}>{image}</span>;
  if (src && !rate) {
    return <img ref={refImg} className={cx('n-vignette', className)} data-n-taille={t} data-n-photo={chargee || 'attente'} src={src} alt={alt} width={t} height={t} loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable="false"
      onLoad={() => setChargee((c) => c || 'la')} onError={() => setRate(true)}/>;
  }
  return (
    <span className={cx('n-vignette', 'n-vignette-vide', className)} data-n-taille={t} data-n-sans-photo="" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      {icone || <Glyphe nom="image" taille={t >= 56 ? 24 : 20}/>}
    </span>
  );
}

export function Interrupteur({ actif = false, onChange, libelle = '', indisponible = false, attrs = null }) {
  return (
    <input
      type="checkbox"
      role="switch"
      className="n-interrupteur"
      checked={!!actif}
      aria-label={libelle || undefined}
      aria-disabled={indisponible ? 'true' : undefined}
      onChange={(e) => { if (indisponible) return; if (onChange) onChange(e.target.checked); }}
      {...(attrs || {})}
    />
  );
}

// Une seule rangée ouverte à la fois, dans toute la page.
let _fermerOuverte = null;
const SEUIL = 10;        // px avant de décider que c'est un balayage (et pas un défilement)
const VITESSE = 0.35;    // px/ms : un coup sec ouvre ou referme, quelle que soit la position

export function Rangee({ titre, sousTitre = '', sousLignes = 1, valeur = null, valeurForte = false, detailValeur = '', vignette = null, icone = null, plaque = null,
  pastille = null, pastilleSous = null, fin = null, interrupteur = null, lignes = 1, onClick = null, href = '', actions = null, ton = 'neutre', selectionnee = false,
  indisponible = false, raison = '', selection = null, note = '', pied = null, className = '', attrs = null }) {
  const idAide = React.useId();
  const refRangee = React.useRef(null), refCorps = React.useRef(null), refActions = React.useRef(null);
  const geste = React.useRef(null), avaleClic = React.useRef(false);
  const [ouverte, setOuverte] = React.useState(false);
  const aActions = !!(actions && actions.length) && !indisponible;

  const tv = vignette ? (vignette.props && vignette.props.taille === 44 ? 44 : vignette.props && vignette.props.taille === 64 ? 64 : 56) : 0;
  const taille = tv === 64 ? 80 : tv === 56 ? 72 : tv === 44 ? 56 : 44;
  const tete = tv ? 'vignette-' + tv : icone ? 'icone' : undefined;

  const largeur = () => (refActions.current ? refActions.current.offsetWidth : 0);
  const poser = (x, anime) => {
    const el = refCorps.current; if (!el) return;
    el.style.transition = anime && !mouvementReduit() ? 'transform var(--n-duree) var(--n-courbe)' : 'none';
    el.style.transform = x ? `translate3d(${Math.round(x * 10) / 10}px,0,0)` : '';
  };
  const fermer = React.useCallback((focus) => {
    poser(0, true);
    setOuverte(false);
    if (_fermerOuverte === fermer) _fermerOuverte = null;
    if (focus && refCorps.current) { try { refCorps.current.focus({ preventScroll: true }); } catch (_) {} }
  }, []);
  const ouvrir = (focus) => {
    if (!aActions) return;
    if (_fermerOuverte && _fermerOuverte !== fermer) _fermerOuverte(false);
    _fermerOuverte = fermer;
    poser(-largeur(), true);
    setOuverte(true);
    if (focus) setTimeout(() => { const b = refActions.current && refActions.current.querySelector('button'); if (b) { try { b.focus({ preventScroll: true }); } catch (_) {} } }, 0);
  };

  // Ouverte : un toucher ailleurs, un défilement ou Échap la referment.
  React.useEffect(() => {
    if (!ouverte) return undefined;
    const dehors = (e) => { if (refRangee.current && !refRangee.current.contains(e.target)) fermer(false); };
    const echap = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(true); } };
    const defile = () => fermer(false);
    document.addEventListener('pointerdown', dehors, true);
    document.addEventListener('keydown', echap, true);
    window.addEventListener('scroll', defile, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', dehors, true);
      document.removeEventListener('keydown', echap, true);
      window.removeEventListener('scroll', defile, { capture: true });
    };
  }, [ouverte, fermer]);
  React.useEffect(() => () => { if (_fermerOuverte === fermer) _fermerOuverte = null; }, [fermer]);

  const bas = (e) => {
    if (!aActions || (e.pointerType === 'mouse' && e.button !== 0)) return;
    geste.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: ouverte ? -largeur() : 0, actif: false, x: 0, pts: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const bouge = (e) => {
    const g = geste.current; if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.actif) {
      if (Math.abs(dx) < SEUIL && Math.abs(dy) < SEUIL) return;
      if (Math.abs(dy) > Math.abs(dx)) { geste.current = null; return; }   // c'est un défilement : on laisse faire
      g.actif = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      if (refRangee.current) refRangee.current.setAttribute('data-n-glisse', '');
    }
    const w = largeur(), total = refRangee.current ? refRangee.current.offsetWidth : w;
    const franc = actions.some((a) => a.franc);
    let x = g.base + dx;
    if (x > 0) x = x * 0.2;                                         // résistance au bord
    else if (x < -w) x = franc ? Math.max(-total, x) : -w + (x + w) * 0.3;
    g.x = x;
    g.pts.push({ x: e.clientX, t: e.timeStamp }); if (g.pts.length > 5) g.pts.shift();
    poser(x, false);
  };
  const haut = (e) => {
    const g = geste.current; if (!g || g.id !== e.pointerId) return;
    geste.current = null;
    if (refRangee.current) refRangee.current.removeAttribute('data-n-glisse');
    if (!g.actif) return;
    avaleClic.current = true; setTimeout(() => { avaleClic.current = false; }, 350);
    const a = g.pts[0], b = g.pts[g.pts.length - 1];
    const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;            // px/ms, négatif = vers la gauche
    const w = largeur(), total = refRangee.current ? refRangee.current.offsetWidth : w;
    const franc = actions.find((x) => x.franc);
    if (franc && e.type !== 'pointercancel' && g.x < -total * 0.6) { fermer(false); if (franc.onClick) franc.onClick(); return; }
    const ouvre = e.type !== 'pointercancel' && (v < -VITESSE || (v <= VITESSE && g.x < -w / 2));
    if (ouvre) ouvrir(false); else fermer(false);
  };
  const clic = (e) => {
    if (avaleClic.current) { e.preventDefault(); e.stopPropagation(); return; }
    if (ouverte) { e.preventDefault(); fermer(false); return; }
    if (indisponible) { e.preventDefault(); return; }
    if (onClick) onClick(e);
  };
  const clavier = (e) => {
    if (aActions && e.key === 'ArrowLeft') { e.preventDefault(); ouvrir(true); }
  };
  const menu = (e) => { if (!aActions) return; e.preventDefault(); if (ouverte) fermer(false); else ouvrir(e.detail === 0); };

  const finNoeud = interrupteur
    ? <Interrupteur actif={interrupteur.actif} onChange={interrupteur.onChange} indisponible={indisponible} attrs={interrupteur.attrs}/>
    : fin === 'chevron' ? <Glyphe nom="chevron" taille={16} className="n-rangee-chevron"/>
      : fin === 'coche' ? <Glyphe nom="check" taille={20} className="n-rangee-coche"/>
        : fin || null;

  const sous = indisponible && raison ? raison : sousTitre;
  const aValeur = valeur != null && valeur !== '';
  // Deux lignes : « titre | valeur » puis « sous-titre | détail ». Le sous-titre prend toute la largeur quand il n'y a pas de détail.
  const contenu = (
    <>
      {vignette || (icone ? <span className="n-rangee-icone" aria-hidden="true">{icone}</span> : null)}
      <span className="n-rangee-bloc">
        <span className="n-rangee-titre" data-n-lignes={lignes === 2 ? '2' : '1'}>{titre}</span>
        {aValeur || pastille ? (
          <span className="n-rangee-valeurs">
            {pastille}
            {aValeur ? <span className="n-rangee-valeur" data-n-forte={valeurForte ? '1' : undefined}>{valeur}</span> : null}
          </span>
        ) : null}
        {plaque || sous || pastilleSous ? (
          <span className="n-rangee-sous" data-n-ton={ton} data-n-seul={detailValeur ? undefined : '1'} data-n-raison={indisponible && raison ? '1' : undefined}>
            {plaque}
            {pastilleSous}
            {sous ? <span className="n-rangee-sous-texte" data-n-lignes={sousLignes === 2 ? '2' : undefined}>{sous}</span> : null}
          </span>
        ) : null}
        {detailValeur ? <span className="n-rangee-detail">{detailValeur}</span> : null}
        {note ? <span className="n-rangee-note">{note}</span> : null}
      </span>
      {finNoeud ? <span className="n-rangee-fin">{finNoeud}</span> : null}
      {aActions ? <span className="n-lu-seul" id={idAide}>{tr('natif.rangee.aideActions')}</span> : null}
    </>
  );

  const commun = {
    ref: refCorps,
    className: 'n-rangee-corps',
    onPointerDown: aActions ? bas : undefined,
    onPointerMove: aActions ? bouge : undefined,
    onPointerUp: aActions ? haut : undefined,
    onPointerCancel: aActions ? haut : undefined,
    onKeyDown: aActions ? clavier : undefined,
    onContextMenu: aActions ? menu : undefined,
    'aria-describedby': aActions ? idAide : undefined,
    'aria-disabled': indisponible ? 'true' : undefined,
    'aria-current': selectionnee ? 'true' : undefined,
  };
  let corps;
  if (interrupteur) corps = <label {...commun}>{contenu}</label>;
  else if (href && !indisponible) corps = <a {...commun} href={href} onClick={clic}>{contenu}</a>;
  else if (onClick) corps = <button {...commun} type="button" onClick={clic}>{contenu}</button>;
  else corps = <div {...commun} tabIndex={aActions ? 0 : undefined} role={aActions ? 'group' : undefined} onClick={aActions ? clic : undefined}>{contenu}</div>;

  return (
    <div
      ref={refRangee}
      className={cx('n-rangee', className)}
      data-n-taille={taille}
      data-n-tete={tete}
      data-n-ouverte={ouverte ? '1' : undefined}
      data-n-selection={selectionnee ? '1' : undefined}
      data-n-touche={onClick || href || interrupteur ? '1' : undefined}
      data-n-balayage={aActions ? '1' : undefined}
      data-n-case={selection ? '1' : undefined}
      data-n-a-pied={pied ? '1' : undefined}
      {...(attrs || {})}
    >
      {selection ? (
        <label className="n-rangee-case" data-n-indisponible={selection.indisponible ? '1' : undefined}>
          <input type="checkbox" className="n-case" checked={!!selection.cochee && !selection.indisponible} disabled={!!selection.indisponible} aria-label={selection.libelle || undefined}
            onChange={(e) => { if (!selection.indisponible && selection.onChange) selection.onChange(e.target.checked); }} {...(selection.attrs || {})}/>
          <span className="n-case-dessin" aria-hidden="true"><Glyphe nom="check" taille={14}/></span>
        </label>
      ) : null}
      {aActions ? (
        <div className="n-rangee-actions" ref={refActions} aria-hidden={ouverte ? undefined : 'true'}>
          {actions.map((a) => (
            <button
              key={a.cle}
              type="button"
              className="n-rangee-action"
              data-n-ton={a.ton || 'accent'}
              tabIndex={ouverte ? 0 : -1}
              onClick={() => { fermer(false); if (a.onClick) a.onClick(); }}
              onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); fermer(true); } }}
            >
              {a.icone ? <span className="n-rangee-action-icone" aria-hidden="true">{a.icone}</span> : null}
              <span className="n-rangee-action-libelle">{a.libelle}</span>
            </button>
          ))}
        </div>
      ) : null}
      {corps}
      {pied ? <div className="n-rangee-pied" data-n-pied="">{pied}</div> : null}
    </div>
  );
}

export default Rangee;
