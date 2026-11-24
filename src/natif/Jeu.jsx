// ── src/natif/Jeu.jsx — le langage « jeu vidéo » de VRM (24 nov., Julien : « c'est pas visuel, hésite pas à faire des designs
// comme jeu vidéo »). Des pièces RÉUTILISABLES, sans règle métier : chacune affiche ce qu'on lui donne, rien de plus.
//   <TuilePaire photo numero icone genre/>   la paire comme un objet d'inventaire : la photo en grand, l'étiquette du N°
//                                            (papier, jamais orange), l'icône de l'événement en médaillon.
//   <EtiquetteN numero/>                     l'étiquette du N° seule (« N° » + le numéro tel qu'écrit sur le carton).
//   <Confettis/>                             une petite pluie (1 s) qui ne bloque rien ; rien sous `prefers-reduced-motion`.
//   <Anneau valeur total/>                   un anneau de progression ; `valeur`/`total` inconnus (null) ⇒ anneau en
//                                            pointillé, « — », JAMAIS plein ni 0 (« pas su » n'est pas 0, CLAUDE.md §5).
// Règles (CLAUDE.md §5, §7) : une photo ne vient que de l'appelant, qui l'a trouvée PAR IDENTITÉ ; un N° absent ne dessine
// rien (mieux vaut un blanc qu'un faux) ; aucune couleur orange ; le rouge n'est jamais utilisé ici.
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';
import './jeu.css';

// Le N° tel qu'il est écrit sur le carton (« 124 », « B230 ») — sinon '' (rien n'est inventé ni reformaté).
export const numeroPropre = (n) => { const s = n == null ? '' : String(n).trim(); return /^[A-Z]{0,2}\d{1,6}$/i.test(s) ? s.toUpperCase() : ''; };

export function EtiquetteN({ numero, className = '', attrs = null }) {
  const n = numeroPropre(numero);
  if (!n) return null;
  return (
    <span className={cx('n-etiq', className)} data-n-etiq={n} role="img" aria-label={tr('natif.plaque.numero', { numero: n })} {...(attrs || {})}>
      <span className="n-etiq-trou" aria-hidden="true"/>
      <span className="n-etiq-pre" aria-hidden="true">{tr('natif.plaque.prefixe')}</span>
      <span className="n-etiq-n" aria-hidden="true">{n}</span>
    </span>
  );
}

// `taille` : 'm' (56, une rangée) · 'l' (72, la carte d'un événement) · 'xl' (96, une grille). `Icon` : le composant d'icônes
// de l'app (ICON_PATHS) ; sans photo, l'icône occupe la tuile. `Photo` (facultatif) : le composant photo de l'app
// (`PhotoVinted`, qui prend la bonne taille — src/photoTaille.js) ; sinon une simple <img>. `attrsN` : attributs de l'étiquette.
const PX = { m: 56, l: 72, xl: 96 };
export function TuilePaire({ photo = '', numero = '', icone = '', genre = '', Icon = null, taille = 'l', className = '', onErreurPhoto = null, children = null, Photo = null, attrsN = null }) {
  const [rate, setRate] = React.useState(false);
  // (24 nov., « pas d'un coup en bloc ») chargée ⇒ fondu ; une image déjà en cache (complete au montage) ne refait pas le fondu.
  const [charge, setCharge] = React.useState(false);   // false · true (chargée sous nos yeux : fondu) · 'deja' (en cache : aucun fondu)
  const refTuile = React.useRef(null);
  // (« sans latence ») vérifié AVANT la première peinture : une image en cache n'est jamais cachée, même une image.
  const avantPeinture = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;
  avantPeinture(() => {
    setRate(false);
    const el = refTuile.current; if (!el) return undefined;
    const vu = () => setCharge((c) => (c === 'deja' ? c : true));
    el.addEventListener('load', vu, true);   // `load` ne remonte pas : écouté en capture sur la tuile (l'<img> peut changer de source)
    let deja = false; try { const im = el.querySelector('img'); deja = !!(im && im.complete && im.naturalWidth); } catch (_) {}
    setCharge(deja ? 'deja' : false);
    return () => el.removeEventListener('load', vu, true);
  }, [photo]);
  const avecPhoto = !!photo && !rate;
  return (
    <span ref={refTuile} className={cx('n-tuile-paire', className)} data-n-tuile={taille} data-n-tuile-genre={genre || undefined} data-n-tuile-photo={avecPhoto ? '1' : '0'} data-n-tuile-charge={avecPhoto ? (charge === 'deja' ? 'deja' : charge ? '1' : '0') : undefined}
>
      {avecPhoto && Photo
        ? <Photo className="n-tuile-img" src={photo} alt="" loading="lazy" draggable="false" style={{ width: PX[taille] || 72, height: PX[taille] || 72 }} repli={null}/>
        : avecPhoto
        ? <img className="n-tuile-img" src={photo} alt="" referrerPolicy="no-referrer" decoding="async" draggable="false" onError={() => { setRate(true); if (onErreurPhoto) onErreurPhoto(); }}/>
        : <span className="n-tuile-vide" aria-hidden="true">{Icon && icone ? <Icon name={icone} size={taille === 'm' ? 22 : 30}/> : null}</span>}
      {avecPhoto && Icon && icone ? <span className="n-tuile-badge" aria-hidden="true"><Icon name={icone} size={14}/></span> : null}
      <EtiquetteN numero={numero} attrs={attrsN}/>
      {children}
    </span>
  );
}

// Une pluie légère : 18 éclats aux couleurs de l'app (ardoise, vert « fait », argent, blanc), partis du centre de leur
// parent (`position: relative`), 1 s, puis plus rien dans le DOM. Jamais au-dessus d'un bouton (pointer-events: none).
const TEINTES = ['var(--n-jeu-c1)', 'var(--n-jeu-c2)', 'var(--n-jeu-c3)', 'var(--n-jeu-c4)'];
export const mouvementReduit = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
export function Confettis({ n = 18, graine = 1, duree = 1100 }) {
  const [vivant, setVivant] = React.useState(() => !mouvementReduit());
  React.useEffect(() => { if (!vivant) return undefined; const t = setTimeout(() => setVivant(false), duree + 100); return () => clearTimeout(t); }, [vivant, duree]);
  const eclats = React.useMemo(() => {
    let h = (graine * 9301 + 49297) % 233280; const alea = () => { h = (h * 9301 + 49297) % 233280; return h / 233280; };
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + alea() * 0.5, d = 46 + alea() * 70;
      return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d * 0.7 - 18), r: Math.round(alea() * 540 - 270), c: TEINTES[i % TEINTES.length], f: i % 3, t: Math.round(alea() * 120) };
    });
  }, [n, graine]);
  if (!vivant) return null;
  return (
    <span className="n-confettis" aria-hidden="true" data-n-confettis={n}>
      {eclats.map((e, i) => <i key={i} data-f={e.f} style={{ '--x': e.x + 'px', '--y': e.y + 'px', '--r': e.r + 'deg', '--c': e.c, '--t': e.t + 'ms', '--d': duree + 'ms' }}/>)}
    </span>
  );
}

// L'anneau : `valeur` sur `total`. Inconnu ⇒ pointillé et « — » (data-n-anneau-su="0"), jamais une jauge pleine ni vide.
export function Anneau({ valeur = null, total = null, taille = 56, epaisseur = 6, libelle = '', centre = null, fait = false, className = '' }) {
  const su = Number.isFinite(valeur) && Number.isFinite(total) && total > 0;
  const part = su ? Math.max(0, Math.min(1, valeur / total)) : 0;
  const r = (taille - epaisseur) / 2, c = 2 * Math.PI * r;
  return (
    <span className={cx('n-anneau', className)} role="img" aria-label={libelle || (su ? `${valeur}/${total}` : tr('jeu.pasSu'))}
      data-n-anneau-su={su ? '1' : '0'} data-n-anneau-part={su ? part.toFixed(3) : ''} data-n-anneau-fait={fait && su && part >= 1 ? '1' : undefined}
      style={{ width: taille, height: taille }}>
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden="true">
        <circle className="n-anneau-fond" cx={taille / 2} cy={taille / 2} r={r} strokeWidth={epaisseur} fill="none" strokeDasharray={su ? undefined : '3 5'}/>
        {su ? <circle className="n-anneau-plein" cx={taille / 2} cy={taille / 2} r={r} strokeWidth={epaisseur} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - part)} transform={`rotate(-90 ${taille / 2} ${taille / 2})`}/> : null}
      </svg>
      <span className="n-anneau-centre" aria-hidden="true">{centre != null ? centre : (su ? valeur : '—')}</span>
    </span>
  );
}

// ── La QUÊTE : une chose à faire, comme une carte de quête — l'icône (médaillon), UN verbe, le nombre restant ; `fait` ⇒ la
// coche s'anime (trait qui se dessine, médaillon vert, petite pluie) puis la carte se replie dans le compteur « fait »
// (`onReplie`, après 900 ms). `restant` inconnu (null) ⇒ « — », jamais 0. Le geste appartient à l'écran (`onClick`).
export function CarteQuete({ icone = 'check', Icon = null, titre = '', verbe = '', restant = null, fait = false, onClick = null, onReplie = null, attrs = null, className = '' }) {
  const [replie, setReplie] = React.useState(false);
  React.useEffect(() => {
    if (!fait) { setReplie(false); return undefined; }
    const t = setTimeout(() => { setReplie(true); if (onReplie) onReplie(); }, mouvementReduit() ? 0 : 900);
    return () => clearTimeout(t);
  }, [fait, onReplie]);
  if (replie) return null;
  const su = restant != null && Number.isFinite(Number(restant));
  return (
    <div className={cx('n-quete', className)} data-n-quete-fait={fait ? '1' : undefined} data-n-quete-su={su ? '1' : '0'} {...(attrs || {})}>
      <span className="n-quete-med" aria-hidden="true">
        {fait ? <svg className="n-quete-coche" width="22" height="22" viewBox="0 0 22 22"><path d="M5 11.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : (Icon ? <Icon name={icone} size={20}/> : null)}
        {fait ? <Confettis n={12} duree={900}/> : null}
      </span>
      <span className="n-quete-corps">
        <span className="n-quete-titre">{titre}</span>
        <span className="n-quete-reste">{fait ? tr('jeu.fait') : su ? tr('jeu.restant', { n: Number(restant) }) : '—'}</span>
      </span>
      {!fait && onClick && verbe ? <button type="button" className="n-quete-geste" onClick={onClick}>{verbe}</button> : null}
    </div>
  );
}

// Le compteur des quêtes faites : « ✓ 3 faites aujourd'hui » (rien sous 1).
export function QuetesFaites({ n = 0, Icon = null }) {
  if (!(n > 0)) return null;
  return <span className="n-quetes-faites" data-n-quetes-faites={n} key={n}>{Icon ? <Icon name="check" size={14}/> : null}{tr('jeu.faites', { n })}</span>;
}

// ── Le TROPHÉE : un palier RÉEL atteint (1re vente, 10, 100…) — calme, une étagère, jamais une relance. `atteint` faux ⇒ la
// silhouette grisée ; `valeur` inconnue ⇒ on ne dit rien (l'écran ne rend pas le trophée).
export const PALIERS_VENTES = [1, 10, 50, 100, 250, 500, 1000];
export function Trophee({ palier, atteint = false, Icon = null, libelle = '' }) {
  return (
    <span className="n-trophee" data-n-trophee={palier} data-n-trophee-atteint={atteint ? '1' : '0'} role="img" aria-label={libelle || tr('jeu.trophee', { n: palier })}>
      <span className="n-trophee-med" aria-hidden="true">{Icon ? <Icon name={atteint ? 'star' : 'lock'} size={18}/> : null}</span>
      <span className="n-trophee-n" aria-hidden="true">{palier}</span>
    </span>
  );
}
// L'étagère : les paliers de ventes ; `total` = un nombre LU (sinon null ⇒ rien n'est rendu : « pas su » ne dit pas « 0 trophée »).
export function EtagereTrophees({ total = null, Icon = null, paliers = PALIERS_VENTES }) {
  if (!Number.isFinite(total)) return null;
  return <span className="n-etagere" data-n-etagere={total}>{paliers.map((p) => <Trophee key={p} palier={p} atteint={total >= p} Icon={Icon}/>)}</span>;
}

// ── (24 nov., Julien : « pas d'un coup en bloc », puis « fais quelque chose sans latence ») L'APPARITION, partagée par tous
// les écrans visuels. Elle n'ajoute JAMAIS d'attente :
//   • ce qui est DÉJÀ connu au premier rendu (cache, visite d'avant) s'affiche d'un coup, sans fondu : `useArrive(pret)` dit
//     si le contenu est ARRIVÉ après le montage (faux s'il était là dès la première image) ;
//   • `revele(i, className, arrive)` ⇒ les props du i-ème élément ({ className, style, 'data-n-revele' }). Seul un contenu qui
//     ARRIVE s'anime : fondu + 3 px, 160 ms, 15 ms après le précédent, plafonné à 120 ms ; le PREMIER élément (i = 0) n'attend
//     jamais et n'a pas de fondu ; transform et opacité seulement (aucun décalage de mise en page) ; mouvement réduit ⇒ rien.
//   • <Revele i arrive>…</Revele> : la même chose en composant.
//   • <SqueletteTuile taille/> et <SqueletteInventaire n/> : SEULEMENT quand rien n'est encore connu ; la forme exacte de ce
//     qui arrive (mêmes tailles : CLS ≤ 0,02).
//   • Les images des tuiles : sur le gris du squelette ; une image déjà en cache s'affiche tout de suite, une image qui se
//     charge arrive en fondu de 160 ms (jamais de flash blanc).
export const REVELE_PAS = 15, REVELE_MAX = 8;   // 8 × 15 ms = 120 ms au plus
export function useArrive(pret) {
  const auMontage = React.useRef(!!pret);
  return !!pret && !auMontage.current;
}
export const revele = (i = 0, className = '', arrive = true) => {
  const rang = Math.min(Math.max(0, i | 0), REVELE_MAX);
  if (!arrive || rang === 0) return { className: cx(className) || undefined, style: undefined, 'data-n-revele': arrive ? '0' : undefined };
  return { className: cx('n-revele', className), style: { '--n-rang': rang }, 'data-n-revele': String(rang) };
};
export function Revele({ i = 0, arrive = true, as: Balise = 'div', className = '', children, ...reste }) {
  const p = revele(i, className, arrive);
  return <Balise {...reste} className={p.className} style={p.style ? { ...(reste.style || {}), ...p.style } : reste.style} data-n-revele={p['data-n-revele']}>{children}</Balise>;
}
export function SqueletteTuile({ taille = 'l', className = '' }) {
  return <span className={cx('n-tuile-paire n-tuile-os', className)} data-n-tuile={taille} aria-hidden="true"><span className="n-os n-tuile-os-fond"/></span>;
}
export function SqueletteInventaire({ n = 4 }) {
  return (
    <div className="n-inventaire" aria-busy="true" data-n-inventaire-os={n}>
      {Array.from({ length: n }, (_, k) => (
        <span key={k} className="n-inventaire-case" aria-hidden="true">
          <SqueletteTuile taille="xl"/>
          <span className="n-os" style={{ width: '50%', height: 14, margin: '3px 0' }}/>
          <span className="n-os" style={{ width: '70%', height: 10, margin: '3px 0' }}/>
        </span>
      ))}
    </div>
  );
}

// ── Le TRAJET d'un colis, comme une carte de niveau : des étapes PROUVÉES (`etapes` = [{ cle, fait, ici }], la règle de
// l'appelant — src/ventesVerre.js `etapesRoute`), reliées par une piste ; le camion (ou `icone`) sur l'étape où il est. Aucune
// étape prouvée ⇒ la piste en pointillé, sans camion (« pas su » ne dit pas « au départ »). `libelles[cle]` : le nom de chaque
// étape pour le lecteur d'écran.
export function Trajet({ etapes = [], Icon = null, icone = 'truck', libelles = {}, className = '' }) {
  const L = Array.isArray(etapes) ? etapes : [];
  if (!L.length) return null;
  const ici = L.findIndex((e) => e && e.ici);
  const part = ici < 0 ? 0 : ici / Math.max(1, L.length - 1);
  const dit = ici < 0 ? tr('jeu.pasSu') : L.map((e) => (libelles[e.cle] || e.cle) + (e.fait ? ' ✓' : '')).join(' · ');
  return (
    <span className={cx('n-trajet', className)} role="img" aria-label={dit} data-n-trajet={ici} data-n-trajet-su={ici < 0 ? '0' : '1'} style={{ '--n-trajet-part': part }}>
      <span className="n-trajet-piste" aria-hidden="true"><span className="n-trajet-fait"/></span>
      {L.map((e, k) => <span key={e.cle || k} className="n-trajet-pt" data-fait={e.fait ? '1' : '0'} data-ici={e.ici ? '1' : undefined} style={{ '--k': k / Math.max(1, L.length - 1) }} aria-hidden="true"/>)}
      {ici >= 0 && Icon ? <span className="n-trajet-pion" aria-hidden="true"><Icon name={icone} size={12}/></span> : null}
    </span>
  );
}
