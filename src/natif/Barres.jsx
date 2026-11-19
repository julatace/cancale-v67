// ── src/natif/Barres.jsx — une petite série en barres (les 7 jours d'« Aujourd'hui ») ─────
// À poser dans une <Affiche> (ses `children`) ou un <Groupe>. UNE série, une seule teinte ; la barre choisie est pleine.
// Props :
//   barres    [{ cle, lettre (« L »), libelle (« Lundi 16 novembre · 45 € », lu par le lecteur d'écran), valeur (nombre | null) }]
//             valeur null = pas su : la piste reste vide (jamais une barre à zéro inventée)
//   choisie   le rang de la barre choisie
//   onChoisir (rang) ⇒ chaque barre se touche (cible 44 × 64)
//   libelle   le nom du groupe (« Les sept derniers jours »)
//   attrs     data-* de l'écran
// Exemple :
//   <Affiche valeur="186" unite="€" libelle="vendus aujourd'hui · 4 ventes">
//     <Barres libelle="Les sept derniers jours" barres={jours} choisie={6} onChoisir={setJour}/>
//   </Affiche>
import React from 'react';
import { cx } from './outils.js';
import './complements.css';

export function Barres({ barres = [], choisie = -1, onChoisir = null, libelle = '', className = '', attrs = null }) {
  const max = Math.max(0, ...barres.map((b) => (b.valeur > 0 ? b.valeur : 0)));
  return (
    <ol className={cx('n-barres', className)} aria-label={libelle || undefined} {...(attrs || {})}>
      {barres.map((b, i) => {
        const h = b.valeur > 0 && max > 0 ? Math.max(8, Math.round((b.valeur / max) * 100)) : 0;
        return (
          <li key={b.cle} className="n-barres-jour">
            <button type="button" className="n-barres-btn" aria-pressed={i === choisie ? 'true' : 'false'} aria-label={b.libelle} title={b.libelle} data-n-barre={b.cle}
              onClick={onChoisir ? () => onChoisir(i) : undefined}>
              <span className="n-barres-piste" aria-hidden="true"><span className="n-barres-plein" data-n-h={h ? String(Math.round(h / 4) * 4) : '0'}/></span>
              <span className="n-barres-lettre" aria-hidden="true">{b.lettre}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default Barres;
