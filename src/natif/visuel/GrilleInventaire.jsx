// ── src/natif/visuel/GrilleInventaire.jsx — une GRILLE d'inventaire longue, virtualisée (24 nov., lot visuel-annonces) ──────
// Julien (24 nov.) : « toute l'application visuelle », « pas d'un coup en bloc », puis « fais quelque chose sans latence ».
// Une VUE sans règle métier : elle place des cases de taille CONNUE d'avance (photo carrée + un corps de hauteur fixe), ne monte
// que les rangées proches de l'écran (des centaines d'annonces restent fluides), et réserve la hauteur totale tout de suite :
// rien ne saute ni à l'arrivée des données, ni à celle des photos, ni pendant le défilement (CLS ≈ 0).
//
//   <GrilleInventaire items cle rendu corps min colonnesTel gap revele debut attente attrs/>
//     items      undefined ⇒ le squelette de la forme finale (`attente` cases) ; [] ⇒ rien ; [x] ⇒ les cases
//     cle(x)     l'identité d'une case (jamais un titre)
//     rendu(x, i, props) la case ; `props` = { className, style, 'data-n-revele' } de `revele` (Jeu.jsx) quand la case ARRIVE
//     corps      la hauteur (px) du texte sous la photo — la même pour toutes les cases
//     min        la largeur minimale d'une colonne (ordinateur) ; colonnesTel : le nombre de colonnes sous 700 px
//     revele     vrai seulement quand le contenu vient d'ARRIVER (lecture terminée pendant que l'écran était ouvert) : un
//                contenu déjà connu s'affiche tel quel à la première image, sans fondu (« sans latence »)
//     debut      le rang de la 1re case dans l'apparition (une 2e grille de l'écran continue la cascade de la 1re)
// Règles : `transform`/`opacity` seulement (aucun décalage de mise en page) ; `prefers-reduced-motion` ⇒ immédiat (jeu.css) ;
// la cascade est celle de `revele` (src/natif/Jeu.jsx) : un seul réglage pour toute l'app.
import React from 'react';
import { revele as reveleJeu } from '../Jeu.jsx';
import { cx } from '../outils.js';
import './inventaire.css';

const DEBORD = 3;            // rangées montées au-dessus et au-dessous de l'écran
const ESTIME_LARGEUR = () => { try { return Math.max(280, Math.min(window.innerWidth || 390, 1600) - 32); } catch (_) { return 358; } };

// Le parent qui défile (la page, ou un panneau `overflow: auto`) : la grille écoute le défilement de TOUS en capture.
export function geometrie(largeur, { min = 200, colonnesTel = 2, gap = 12, corps = 96 } = {}) {
  const l = Math.max(1, largeur);
  const cols = l < 700 - 32 ? colonnesTel : Math.max(1, Math.floor((l + gap) / (min + gap)));
  const colL = (l - (cols - 1) * gap) / cols;
  const rangH = Math.round(colL + corps);
  return { cols, colL, rangH, pas: rangH + gap };
}

export default function GrilleInventaire({ items, cle = (x) => x && x.cle, rendu, corps = 96, min = 200, colonnesTel = 2, gap = 12, revele = false, debut = 0,
  attente = 6, attrs = null, className = '', squelette = null }) {
  const ref = React.useRef(null);
  const [largeur, setLargeur] = React.useState(ESTIME_LARGEUR);
  const [fenetre, setFenetre] = React.useState({ a: 0, b: 4 });
  // Elle a VU la lecture (squelette) puis l'arrivée : la cascade d'arrivée, 600 ms au plus. Contenu déjà connu ⇒ jamais.
  const vu = React.useRef({ vide: items === undefined, le: 0 });
  if (items === undefined) vu.current.vide = true; else if (vu.current.vide) { vu.current.vide = false; vu.current.le = Date.now(); }
  const enRevele = revele || (!!vu.current.le && Date.now() - vu.current.le < 600);
  const n = Array.isArray(items) ? items.length : (items === undefined ? attente : 0);
  const g = geometrie(largeur, { min, colonnesTel, gap, corps });
  const rangees = Math.ceil(n / g.cols);
  const hauteur = rangees ? rangees * g.rangH + (rangees - 1) * gap : 0;

  // La largeur MESURÉE avant la première peinture (useLayoutEffect) : la grille ne se redessine jamais sous les yeux.
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const lire = () => { const w = el.clientWidth; if (w > 0) setLargeur((v) => (Math.abs(v - w) > 0.5 ? w : v)); };
    lire();
    let ro = null; try { ro = new ResizeObserver(lire); ro.observe(el); } catch (_) { window.addEventListener('resize', lire); }
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', lire); };
  }, []);

  // Les rangées proches de l'écran : recalculées au défilement (une fois par image au plus).
  const calculer = React.useCallback(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect(); const h = window.innerHeight || 800;
    let a = Math.floor(-r.top / g.pas) - DEBORD, b = Math.ceil((h - r.top) / g.pas) + DEBORD;
    a = Math.max(0, Math.min(a, rangees - 1)); b = Math.max(a, Math.min(b, rangees - 1));
    setFenetre((f) => (f.a === a && f.b === b ? f : { a, b }));
  }, [g.pas, rangees]);
  React.useLayoutEffect(() => { calculer(); }, [calculer, n]);
  React.useEffect(() => {
    let image = 0;
    const surDefile = () => { if (image) return; image = requestAnimationFrame(() => { image = 0; calculer(); }); };
    window.addEventListener('scroll', surDefile, { capture: true, passive: true });
    window.addEventListener('resize', surDefile, { passive: true });
    return () => { window.removeEventListener('scroll', surDefile, { capture: true }); window.removeEventListener('resize', surDefile); if (image) cancelAnimationFrame(image); };
  }, [calculer]);

  const de = fenetre.a * g.cols, a = Math.min(n, (fenetre.b + 1) * g.cols);
  const style = { '--n-inv-cols': g.cols, '--n-inv-rang-h': g.rangH + 'px', '--n-inv-gap': gap + 'px', '--n-inv-corps': corps + 'px', '--n-inv-col-l': Math.round(g.colL) + 'px' };
  const cases = [];
  if (items === undefined) {
    for (let i = de; i < a; i++) cases.push(<React.Fragment key={'os' + i}>{squelette ? squelette(i) : <span className="n-inv-os" aria-hidden="true"><span className="n-os n-inv-os-photo"/><span className="n-os n-inv-os-l"/><span className="n-os n-inv-os-l" data-court=""/></span>}</React.Fragment>);
  } else if (Array.isArray(items)) {
    // La cascade part de la 1re case À L'ÉCRAN (jamais retardée par celles d'au-dessus), plafonnée par `revele` (Jeu.jsx).
    for (let i = de; i < a; i++) { const x = items[i]; cases.push(<React.Fragment key={cle(x) || i}>{rendu(x, i, enRevele ? reveleJeu(debut + i - de, '', true) : null)}</React.Fragment>); }
  }
  return (
    <div ref={ref} className={cx('n-inv-grille', className)} style={{ ...style, height: hauteur }} data-inv-grille="" data-inv-n={String(n)} data-inv-cols={String(g.cols)}
      data-inv-rang-h={String(g.rangH)} data-inv-montees={String(a - de)} data-inv-attente={items === undefined ? '1' : undefined} aria-busy={items === undefined ? 'true' : undefined} {...(attrs || {})}>
      <div className="n-inv-fenetre" style={{ transform: `translateY(${fenetre.a * g.pas}px)` }}>{cases}</div>
    </div>
  );
}
