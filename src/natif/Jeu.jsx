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

export function EtiquetteN({ numero, className = '' }) {
  const n = numeroPropre(numero);
  if (!n) return null;
  return (
    <span className={cx('n-etiq', className)} data-n-etiq={n} role="img" aria-label={tr('natif.plaque.numero', { numero: n })}>
      <span className="n-etiq-trou" aria-hidden="true"/>
      <span className="n-etiq-pre" aria-hidden="true">{tr('natif.plaque.prefixe')}</span>
      <span className="n-etiq-n" aria-hidden="true">{n}</span>
    </span>
  );
}

// `taille` : 'm' (56, une rangée) · 'l' (72, la carte d'un événement) · 'xl' (96, une grille). `Icon` : le composant d'icônes
// de l'app (ICON_PATHS) ; sans photo, l'icône occupe la tuile.
export function TuilePaire({ photo = '', numero = '', icone = '', genre = '', Icon = null, taille = 'l', className = '', onErreurPhoto = null, children = null }) {
  const [rate, setRate] = React.useState(false);
  React.useEffect(() => { setRate(false); }, [photo]);
  const avecPhoto = !!photo && !rate;
  return (
    <span className={cx('n-tuile-paire', className)} data-n-tuile={taille} data-n-tuile-genre={genre || undefined} data-n-tuile-photo={avecPhoto ? '1' : '0'}>
      {avecPhoto
        ? <img className="n-tuile-img" src={photo} alt="" referrerPolicy="no-referrer" decoding="async" draggable="false" onError={() => { setRate(true); if (onErreurPhoto) onErreurPhoto(); }}/>
        : <span className="n-tuile-vide" aria-hidden="true">{Icon && icone ? <Icon name={icone} size={taille === 'm' ? 22 : 30}/> : null}</span>}
      {avecPhoto && Icon && icone ? <span className="n-tuile-badge" aria-hidden="true"><Icon name={icone} size={14}/></span> : null}
      <EtiquetteN numero={numero}/>
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
