// ── src/natif/Attente.jsx — le squelette : la FORME EXACTE de ce qui arrive ──────────────
// Jamais de saut à l'arrivée des données : le squelette a les hauteurs des vrais composants.
// Props :
//   forme     'rangees' (défaut) | 'affiche' | 'faits' | 'texte'
//   n         nombre de rangées / de faits / de lignes (défaut 3)
//   vignette  0 | 44 | 56 — la vignette des rangées attendues (0 = sans ; 44 ⇒ rangée 56 ; 56 ⇒ rangée 72)
//   colonnes  2–4 (forme 'faits')
//   titre     vrai ⇒ un en-tête de groupe au-dessus des rangées
// Le lecteur d'écran entend « Chargement… » une fois ; le squelette lui-même est muet.
// Exemple :
//   {ventes === undefined ? <Attente forme="rangees" n={5} vignette={56} titre/> : <Groupe …/>}
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';

const suite = (n) => Array.from({ length: Math.max(1, n | 0) }, (_, i) => i);
// Des largeurs qui varient sans hasard (le même squelette à chaque rendu : rien ne clignote).
const LARGEURS = [62, 78, 54, 70, 46, 66];

export function Attente({ forme = 'rangees', n = 3, vignette = 0, colonnes = 2, titre = false, className = '' }) {
  let corps;
  if (forme === 'affiche') {
    corps = (
      <div className="n-affiche">
        <span className="n-os n-os-affiche"/>
        <span className="n-os n-os-ligne" style={{ width: '58%' }}/>
      </div>
    );
  } else if (forme === 'faits') {
    corps = (
      <div className="n-faits" data-n-colonnes={colonnes}>
        {suite(n).map((i) => (
          <div className="n-fait" key={i}>
            <span className="n-os n-os-legende" style={{ width: '52%' }}/>
            <span className="n-os n-os-ligne" style={{ width: LARGEURS[i % LARGEURS.length] + '%' }}/>
          </div>
        ))}
      </div>
    );
  } else if (forme === 'texte') {
    corps = (
      <div className="n-attente-texte">
        {suite(n).map((i) => <span className="n-os n-os-ligne" key={i} style={{ width: LARGEURS[i % LARGEURS.length] + 20 + '%' }}/>)}
      </div>
    );
  } else {
    corps = (
      <div className="n-groupe">
        {titre ? <div className="n-groupe-tete"><span className="n-os n-os-legende" style={{ width: 96 }}/></div> : null}
        <div className="n-groupe-carte">
          {suite(n).map((i) => (
            <div className="n-rangee" data-n-taille={vignette === 56 ? 72 : vignette === 44 ? 56 : 44} data-n-tete={vignette ? 'vignette-' + vignette : undefined} key={i}>
              <div className="n-rangee-corps">
                {vignette ? <span className="n-os n-vignette" data-n-taille={vignette}/> : null}
                <span className="n-rangee-bloc">
                  <span className="n-os n-os-ligne" style={{ width: LARGEURS[i % LARGEURS.length] + '%' }}/>
                  <span className="n-os n-os-ligne" style={{ width: 44 }}/>
                  {vignette ? <span className="n-os n-os-second" style={{ width: LARGEURS[(i + 2) % LARGEURS.length] - 14 + '%' }}/> : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={cx('n-attente', className)} role="status" aria-busy="true" data-n-attente={forme}>
      <span className="n-lu-seul">{tr('natif.attente')}</span>
      <div aria-hidden="true">{corps}</div>
    </div>
  );
}

export default Attente;
