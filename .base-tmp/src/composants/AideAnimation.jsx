// ═══════════════════════════════════════════════════════════════════════════
// L'ANIMATION D'UN ÉCRAN (11 nov., lot centre-aide) — données : src/aideAnimations.js
// ═══════════════════════════════════════════════════════════════════════════
// Une maquette SVG de l'écran, un doigt qui fait chaque geste, une seconde par
// geste, en boucle. Le geste en cours est remonté (`onEtape`) : la liste des
// gestes l'allume. Couleurs = jetons de l'app (clair et sombre suivent seuls).
// « Réduire les animations » (système) : rien ne bouge — la maquette reste,
// chaque cible porte son numéro de geste. Un bouton met en pause (WCAG 2.2.2).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { ANIMATIONS_ECRANS, LARGEUR, HAUTEUR, MS_SCENE, centreCible } from '../aideAnimations.js';

const reduit = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };

function Element({ e, actif, scene, apres, numero }) {
  const cls = `vrm-aa-el vrm-aa-${e.t}` + (actif ? ` vrm-aa-actif vrm-aa-${scene.geste}` : '') + (e.rouge ? ' vrm-aa-double' : '') + (e.ambre ? ' vrm-aa-ambre' : '') + (e.plein ? ' vrm-aa-plein' : '');
  const r = e.t === 'bouton' || e.t === 'badge' || e.t === 'champ' ? e.h / 2 : e.t === 'barre' ? e.h / 2 : 6;
  // Le texte tapé reste écrit après sa scène (jusqu'au tour suivant).
  const tape = e.t === 'champ' && apres && apres.texte;
  let contenu = null;
  if (e.t === 'barre' && (e.titre || e.fort)) contenu = <text x={e.x} y={e.y + e.h - 1} className={e.titre ? 'vrm-aa-titre' : 'vrm-aa-fort'}>{e.texte}</text>;
  else if (e.t === 'barre') contenu = <rect x={e.x} y={e.y} width={e.w} height={e.h} rx={r} className={e.discret ? 'vrm-aa-ligne vrm-aa-discret' : 'vrm-aa-ligne'}/>;
  else if (e.t === 'chiffre') contenu = <><rect x={e.x} y={e.y} width={e.w} height={e.h} rx={8} className="vrm-aa-fond"/><text x={e.x + 8} y={e.y + 19} className="vrm-aa-grand">{e.texte}</text><text x={e.x + 8} y={e.y + 30} className="vrm-aa-sous">{e.sous}</text></>;
  else if (e.t === 'case') contenu = <><rect x={e.x} y={e.y} width={e.w} height={e.h} rx={5} className="vrm-aa-fond"/><text x={e.x + e.w / 2} y={e.y + e.h / 2 + 3.5} textAnchor="middle" className="vrm-aa-sous">{e.texte}</text></>;
  else if (e.t === 'champ') contenu = <><rect x={e.x} y={e.y} width={e.w} height={e.h} rx={r} className="vrm-aa-fond vrm-aa-bord"/><text x={e.x + 8} y={e.y + e.h / 2 + 3.5} className={tape || e.fixe ? 'vrm-aa-texte' : 'vrm-aa-sous'}>{tape ? apres.texte : (e.fixe ? e.texte : e.place)}</text></>;
  else if (e.t === 'bouton' || e.t === 'badge') contenu = <><rect x={e.x} y={e.y} width={e.w} height={e.h} rx={r} className="vrm-aa-fond"/><text x={e.x + e.w / 2} y={e.y + e.h / 2 + 3.5} textAnchor="middle" className="vrm-aa-texte">{e.texte}</text></>;
  else contenu = <rect x={e.x} y={e.y} width={e.w} height={e.h} rx={r} className="vrm-aa-fond"/>;
  return (
    <g className={cls} data-aa-el={e.id} data-aa-actif={actif ? '1' : undefined}>
      {contenu}
      {numero ? <g className="vrm-aa-repere"><circle cx={e.x + e.w - 2} cy={e.y + 2} r={7}/><text x={e.x + e.w - 2} y={e.y + 5} textAnchor="middle">{numero}</text></g> : null}
    </g>
  );
}

export function AideAnimation({ cle, onEtape, etapeForcee = null }) {
  const anim = ANIMATIONS_ECRANS[cle];
  const [immobile] = React.useState(reduit);
  const [pause, setPause] = React.useState(false);
  const [i, setI] = React.useState(0);
  const n = anim ? anim.scenes.length : 0;
  React.useEffect(() => { if (etapeForcee != null && etapeForcee >= 0 && etapeForcee < n) setI(etapeForcee); }, [etapeForcee, n]);
  React.useEffect(() => {
    if (!anim || immobile || pause) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % n), MS_SCENE);
    return () => clearInterval(t);
  }, [anim, immobile, pause, n]);
  React.useEffect(() => { if (onEtape) onEtape(immobile ? -1 : i); }, [i, immobile, onEtape]);
  if (!anim) return null;
  const scene = anim.scenes[i];
  const doigt = !immobile ? centreCible(anim, scene) : null;
  // Le texte des champs déjà tapés dans ce tour.
  const tapes = {};
  anim.scenes.forEach((s, k) => { if (s.geste === 'tape' && k <= i) tapes[s.cible] = s; });
  const allume = scene && scene.allume;
  const numeros = {};
  if (immobile) anim.scenes.forEach((s, k) => { if (!numeros[s.cible]) numeros[s.cible] = k + 1; });
  return (
    <figure className="vrm-aa" data-aide-animation={cle} data-aide-animation-scenes={n} data-aide-animation-scene={immobile ? 'immobile' : i} data-aide-animation-pause={pause ? '1' : '0'}>
      <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} role="img" aria-label={`Animation : les gestes de l’écran ${anim.titre}`} preserveAspectRatio="xMidYMid meet">
        <rect x="0.5" y="0.5" width={LARGEUR - 1} height={HAUTEUR - 1} rx="16" className="vrm-aa-ecran"/>
        {anim.elements.map((e) => {
          const actif = !immobile && !!scene && (scene.cible === e.id || allume === e.id);
          return <Element key={e.id + (actif ? ':' + i : '')} e={e} actif={actif} scene={scene} apres={tapes[e.id]} numero={numeros[e.id]}/>;
        })}
        {doigt ? <g className="vrm-aa-doigt" style={{ transform: `translate(${doigt.x}px, ${doigt.y}px)` }} data-aa-doigt={scene.cible}>
          {scene.geste === 'tap' ? <circle key={'onde' + i} r="9" className="vrm-aa-onde"/> : null}
          <circle r="9" className="vrm-aa-bout"/>
        </g> : null}
      </svg>
      {!immobile ? <button type="button" className="vrm-aa-pause" onClick={() => setPause((p) => !p)} aria-pressed={pause} aria-label={pause ? 'Relancer l’animation' : 'Mettre l’animation en pause'} data-aide-animation-bouton="">
        {pause
          ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2.5v9l7.5-4.5z" fill="currentColor"/></svg>
          : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="2.5" width="3" height="9" rx="1" fill="currentColor"/><rect x="8" y="2.5" width="3" height="9" rx="1" fill="currentColor"/></svg>}
      </button> : null}
    </figure>
  );
}

export default AideAnimation;
