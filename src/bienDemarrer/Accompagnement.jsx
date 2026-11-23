// ── L'ACCOMPAGNEMENT DE « BIEN DÉMARRER » : une feuille, une étape, une petite animation (23 nov., lot demarrage-guide) ──
// La règle (quelle étape, quelles marches, quel geste, la reprise) : ./accompagnement.js. Ici seulement ce qui se dessine :
//   · une SCÈNE en SVG, jouée UNE fois à l'ouverture (≈ 2 s, CSS seulement), « Passer » la fige tout de suite, « Revoir » la
//     rejoue ; `prefers-reduced-motion` ⇒ la scène est posée, immobile (aucun mouvement) ;
//   · « Étape 2 sur 5 », un titre chaleureux, une phrase, les petites marches numérotées (selon le navigateur pour
//     l'extension), UN bouton plein — le geste — et « Étape suivante » ; une étape faite porte sa coche (prouvée).
// Couleurs : les jetons neutres (`--n-*`) ; aucun ambre, aucun rouge. Aucune écriture : le geste OUVRE l'écran qui le fait.
import React from 'react';
import { tr } from '../i18n/index.js';
import { Feuille, Bouton, Glyphe } from '../natif/index.js';
import PourquoiReplie from '../composants/PourquoiReplie.jsx';
import { pageAccompagnement, etapeSuivante } from './accompagnement.js';
import './accompagnement.css';

const T = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
// Chaque scène : des groupes `acc-a1…a4` que la feuille de style anime l'un après l'autre (entrée, glissement, coche).
const SCENES = {
  piece: (
    <>
      <rect className="acc-fond" x="14" y="22" width="132" height="76" rx="10" {...T}/>
      <path className="acc-fond" d="M14 40h132" {...T}/>
      <circle className="acc-fond" cx="26" cy="31" r="2.5" fill="currentColor"/><circle className="acc-fond" cx="35" cy="31" r="2.5" fill="currentColor"/>
      <g className="acc-a1"><path d="M108 26h10a4 4 0 0 1 8 0h10v10a4 4 0 0 1 0 8v0h-28z" {...T}/></g>
      <g className="acc-a2"><rect x="30" y="54" width="56" height="8" rx="4" fill="currentColor" opacity=".18"/><rect x="30" y="70" width="88" height="8" rx="4" fill="currentColor" opacity=".12"/></g>
      <g className="acc-a3 acc-accent"><circle cx="122" cy="74" r="12" {...T}/><path d="M116 74l4 4 8-8" {...T}/></g>
    </>
  ),
  liens: (
    <>
      <g className="acc-a1"><circle cx="52" cy="60" r="22" {...T}/><text x="52" y="66" textAnchor="middle" fontSize="16" fill="currentColor" stroke="none">V</text></g>
      <g className="acc-a2"><circle cx="108" cy="60" r="22" {...T}/><text x="108" y="66" textAnchor="middle" fontSize="16" fill="currentColor" stroke="none">VRM</text></g>
      <g className="acc-a3 acc-accent"><path className="acc-trait" d="M74 60h12" {...T} strokeDasharray="12" /></g>
      <g className="acc-a4 acc-accent"><circle cx="80" cy="96" r="9" {...T}/><path d="M76 96l3 3 6-6" {...T}/></g>
    </>
  ),
  barres: (
    <>
      <path className="acc-fond" d="M24 100h112" {...T}/>
      <g className="acc-a1 acc-pousse"><rect x="34" y="70" width="16" height="30" rx="4" fill="currentColor" opacity=".25"/></g>
      <g className="acc-a2 acc-pousse"><rect x="60" y="56" width="16" height="44" rx="4" fill="currentColor" opacity=".35"/></g>
      <g className="acc-a3 acc-pousse"><rect x="86" y="42" width="16" height="58" rx="4" fill="currentColor" opacity=".5"/></g>
      <g className="acc-a4 acc-pousse acc-accent"><rect x="112" y="28" width="16" height="72" rx="4" fill="currentColor"/></g>
    </>
  ),
  etiquette: (
    <>
      <g className="acc-fond"><path d="M30 58l50-20 50 20-50 20z" {...T}/><path d="M30 58v28l50 20 50-20V58" {...T}/></g>
      <g className="acc-a1 acc-tombe"><rect x="62" y="70" width="36" height="22" rx="4" {...T}/><text x="80" y="86" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" stroke="none">N°1</text></g>
      <g className="acc-a3 acc-accent"><circle cx="128" cy="34" r="10" {...T}/><path d="M123 34l3.5 3.5 6-6" {...T}/></g>
    </>
  ),
  document: (
    <>
      <path className="acc-fond" d="M50 18h44l18 18v68H50z" {...T}/><path className="acc-fond" d="M94 18v18h18" {...T}/>
      <g className="acc-a1"><path d="M62 52h36" {...T}/></g>
      <g className="acc-a2"><path d="M62 66h36" {...T}/></g>
      <g className="acc-a3"><path d="M62 80h22" {...T}/></g>
      <g className="acc-a4 acc-accent"><circle cx="104" cy="92" r="12" {...T}/><path d="M98 92l4 4 8-8" {...T}/></g>
    </>
  ),
};

export function Scene({ scene, tour = 0, figee = false }) {
  return (
    <svg key={tour} className={'acc-scene' + (figee ? ' is-figee' : '')} viewBox="0 0 160 120" width="160" height="120" role="img" aria-hidden="true" data-acc-scene={scene} data-acc-figee={figee ? '1' : '0'}>
      {SCENES[scene] || null}
    </svg>
  );
}

// (23 nov., Julien : « trop de texte, pas assez de beaux boutons ») une phrase de ≤ 8 mots, le détail sous « Pourquoi ? » ;
// les actions en vrais boutons (icône + verbe court). `Icon` : l'icône de l'app (celles de « Bien démarrer »).
const ICONES_GESTE = { extension: 'device', compte: 'link', lecture: 'sync', numeros: 'tag', fiscal: 'receipt' };
export default function Accompagnement({ ouverte, etapes, cle, setCle, nav = '', mobile = null, onGeste, onFermer, Icon = null }) {
  const [tour, setTour] = React.useState(0);
  const [figee, setFigee] = React.useState(false);
  React.useEffect(() => { setFigee(false); setTour((t) => t + 1); }, [cle]);
  const p = cle ? pageAccompagnement(etapes, cle, { nav, mobile }) : null;
  if (!p) return null;
  const suivante = etapeSuivante(etapes, cle);
  const pied = (
    <div className="acc-pied">
      {!p.fait ? <Bouton variante="plein" icone={Icon ? <Icon name={ICONES_GESTE[cle] || 'check'} size={18}/> : null} onClick={() => onGeste && onGeste(cle)} attrs={{ 'data-acc-geste': cle }}>{tr(p.geste.cle, { nav: p.geste.nom })}</Bouton> : null}
      {suivante ? <Bouton variante="teinte" icone={<Glyphe nom="chevron" taille={16}/>} onClick={() => setCle(suivante)} attrs={{ 'data-acc-suivante': suivante }}>{tr('acc.suivante')}</Bouton>
        : <Bouton variante="teinte" icone={<Glyphe nom="check" taille={16}/>} onClick={onFermer} attrs={{ 'data-acc-fin': '' }}>{tr('acc.fermer')}</Bouton>}
    </div>
  );
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('acc.rang', { n: p.rang, total: p.total })} detente="auto" pied={pied}
      attrs={{ 'data-acc-feuille': cle, 'data-acc-fait': p.fait ? '1' : '0', 'data-acc-famille': p.famille }}>
      <div className="acc-corps">
        <div className="acc-scene-cadre">
          <Scene scene={p.scene} tour={tour} figee={figee}/>
          <div className="acc-scene-actions">
            {figee ? <button type="button" className="acc-lien" onClick={() => { setFigee(false); setTour((t) => t + 1); }} data-acc-revoir="">{tr('acc.revoir')}</button>
              : <button type="button" className="acc-lien" onClick={() => setFigee(true)} data-acc-passer="">{tr('acc.passer')}</button>}
          </div>
        </div>
        <h2 className="acc-titre">{p.fait ? <span className="acc-coche" aria-hidden="true">✓ </span> : null}{tr('acc.' + cle + '.titre')}</h2>
        <p className="acc-phrase">{p.fait ? tr('acc.dejaFait') : tr('acc.' + cle + '.phrase')}</p>
        {!p.fait ? <PourquoiReplie label={tr('acc.pourquoi')} data-acc-pourquoi={cle}><p>{tr('acc.' + cle + '.pourquoi')}</p></PourquoiReplie> : null}
        {!p.fait ? (
          <ol className="acc-marches" data-acc-marches={p.marches.length}>
            {p.marches.map((m, i) => <li key={m} className="acc-marche" style={{ '--acc-i': i }}><span className="acc-marche-n">{i + 1}</span><span>{tr(m, { nav: p.geste.nom || tr('acc.tonNavigateur') })}</span></li>)}
          </ol>
        ) : null}
      </div>
    </Feuille>
  );
}
