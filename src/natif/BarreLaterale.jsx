// ── src/natif/BarreLaterale.jsx — la barre latérale de l'ordinateur (≥ 1024, 240 px) ─────
// Fond --n-fond ; l'entrée active = une pastille --n-teinte + texte --n-sur-teinte (l'accent, tenu à 4,5:1).
// Props :
//   tete       nœud en haut (la marque, le compte)
//   groupes    [{ titre, entrees: [{ cle, libelle, icone, pastille, libellePastille, attrs }] }]
//              icone : nœud (icône de l'app, taille 20)
//   actif      la `cle` de l'entrée courante
//   onChoisir  (cle) => …
//   pied       nœud en bas (le compte, l'aide)
//   libelle    le nom de la navigation
//   reduite / onReduire(v)  (19 nov. soir) la barre réduite aux icônes (72 px) ; le bouton « Réduire / Déplier » en tête.
//              Les libellés restent lus par le lecteur d'écran (et en bulle au survol).
// Clavier : ↑ ↓ passent d'une entrée à l'autre.
// Exemple :
//   <BarreLaterale actif={tab} onChoisir={setTab} groupes={[
//     { entrees: [{ cle: 'aujourdhui', libelle: "Aujourd'hui", icone: <Icon name="home" size={20}/> }] },
//     { titre: 'Plus', entrees: [{ cle: 'stock', libelle: 'Stock', icone: <Icon name="box" size={20}/> }] } ]}/>
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';
import { Pastille } from './Pastille.jsx';

export function BarreLaterale({ tete = null, groupes = [], actif = '', onChoisir, pied = null, libelle = '', className = '', attrs = null, reduite = false, onReduire = null, icone = null }) {
  const clavier = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const toutes = [...e.currentTarget.querySelectorAll('.n-laterale-entree')];
    const k = toutes.indexOf(document.activeElement); if (k < 0) return;
    const s = toutes[k + (e.key === 'ArrowDown' ? 1 : -1)];
    if (s) { e.preventDefault(); s.focus(); }
  };
  return (
    <nav className={cx('n-laterale', className)} aria-label={libelle || tr('natif.nav.nom')} data-n-laterale="" data-n-reduite={reduite ? '1' : undefined} onKeyDown={clavier} {...(attrs || {})}>
      {tete || onReduire ? <div className="n-laterale-tete">{reduite ? null : tete}
        {onReduire ? <button type="button" className="n-laterale-reduire" data-n-reduire={reduite ? '1' : '0'} aria-pressed={reduite ? 'true' : 'false'}
          aria-label={reduite ? tr('natif.nav.deplier') : tr('natif.nav.reduire')} title={reduite ? tr('natif.nav.deplier') : tr('natif.nav.reduire')} onClick={() => onReduire(!reduite)}>{icone}</button> : null}
      </div> : null}
      <div className="n-laterale-liste">
        {groupes.map((g, i) => (
          // (28 nov., boutons-donnees — audit a11y P8) Le nom d'un groupe de la barre n'est PAS un titre de la page (il passait
          // avant le h1 de l'écran) : un libellé qui nomme son groupe (role=group + aria-labelledby).
          <div className="n-laterale-groupe" key={g.titre || i} role={g.titre ? 'group' : undefined} aria-labelledby={g.titre ? `n-lat-g-${i}` : undefined}>
            {g.titre ? <p className="n-laterale-titre" id={`n-lat-g-${i}`}>{g.titre}</p> : null}
            {g.entrees.map((o) => (
              <button
                key={o.cle}
                type="button"
                className="n-laterale-entree"
                data-n-entree={o.cle}
                aria-current={o.cle === actif ? 'page' : undefined}
                title={reduite ? o.libelle : undefined}
                onClick={() => { if (o.onChoisir) o.onChoisir(o.cle); else if (onChoisir) onChoisir(o.cle); }}
                {...(o.attrs || {})}
              >
                {o.icone ? <span className="n-laterale-icone" aria-hidden="true">{o.icone}</span> : null}
                <span className="n-laterale-libelle">{o.libelle}</span>
                {o.pastille === true ? <span className="n-laterale-point" aria-hidden="true"/> : o.pastille ? <Pastille ton="ambre-plein" libelle={o.libellePastille || ''}>{o.pastille}</Pastille> : null}
              </button>
            ))}
          </div>
        ))}
      </div>
      {pied ? <div className="n-laterale-pied">{pied}</div> : null}
    </nav>
  );
}

export default BarreLaterale;
