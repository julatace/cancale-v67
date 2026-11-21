// ── « RELANCER AU BON MOMENT » (15 nov., vendre plus) — règle : src/relanceFavoris.js ──
// La carte de Ma journée : « 5 personnes aiment N°124 · depuis 9 j, ni offre ni vente » et
// le geste EXISTANT (Vinted : offre aux favoris, la liste s'ouvre avec ces favoris cochés ;
// eBay : l'offre aux observateurs dans la fiche de l'annonce). Rien ne part d'ici : le
// geste ouvre l'écran, l'envoi reste SON « Envoyer » (plafonds de l'extension inchangés).
// Un geste qui ne peut pas partir le DIT (extension trop ancienne, compte pas su).
import React from 'react';
import { tr } from './i18n/index.js';
import { gesteRelance } from './relanceFavoris.js';
import { BoutonExtension } from './BoutonExtension.jsx';
import './styles-vendre-plus.css';

export default function RelanceFavorisCarte({ res, cap, version, onGeste, Photo }) {
  if (!res || !Array.isArray(res.cartes) || !res.cartes.length) return null;
  const reste = Math.max(0, res.n - res.cartes.length);
  return (
    <section className="vrm-rf" data-rf-carte={res.n} aria-label={tr('rf.titre')}>
      <div className="vrm-rf-tete"><h3>{tr('rf.titre')}</h3></div>
      <ul className="vrm-rf-liste">
        {res.cartes.map((c) => {
          const g = gesteRelance(c, { cap, version });
          const num = c.numero ? `N°${c.numero}` : (c.titre || tr('rf.sansNum'));
          const bloque = g && g.bloque && c.plateforme !== 'vinted' ? (g.bloque === 'extension' ? tr('rf.bloque.extension', { v: g.version || '' }) : tr('rf.bloque.compte')) : '';
          return (
            <li key={c.cle} className="vrm-rf-ligne" data-rf-ligne={c.cle} data-rf-personnes={c.personnes} data-rf-depuis={c.depuisJ} data-rf-plateforme={c.plateforme}>
              {c.photo && Photo ? <Photo src={c.photo} alt="" className="vrm-rf-photo" loading="lazy"/> : <span className="vrm-rf-photo" aria-hidden="true"/>}
              <span className="vrm-rf-texte">
                <b>{tr('rf.carte.' + c.plateforme, { n: c.personnes, num })}</b>
                <span className="vrm-rf-sous">{tr(c.offresLues ? 'rf.depuis' : 'rf.depuisPasLues', { j: c.depuisJ })}</span>
                {bloque ? <span className="vrm-rf-bloque" data-rf-bloque={g.bloque}>{bloque}</span> : null}
              </span>
              {/* (20 nov., décision de Julien) Vinted : l'offre aux favoris se fait dans le panneau de l'extension. eBay reste ici. */}
              {g && c.plateforme === 'vinted' ? <BoutonExtension className="sb-touche vrm-rf-geste" action="favoris" ids={[String(c.id || '')]} attrs={{ 'data-rf-geste': g.k }}/>
                : g ? <button type="button" className="sb-touche vrm-rf-geste" data-rf-geste={g.k} disabled={!!g.bloque} onClick={() => onGeste && onGeste(c, g.k)}>{tr('rf.geste.' + g.k)}</button> : null}
            </li>
          );
        })}
      </ul>
      {reste ? <p className="vrm-rf-note" data-rf-reste={reste}>{tr('rf.plus', { n: reste })}</p> : null}
      <p className="vrm-rf-note">{tr('rf.note')}</p>
    </section>
  );
}
