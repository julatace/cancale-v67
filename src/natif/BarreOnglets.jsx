// ── src/natif/BarreOnglets.jsx — la barre d'onglets du téléphone (contrat NATIF.md §2) ───
// 5 onglets de MÊME largeur, icône 24 + libellé 10/600, l'actif en --n-accent, 49 px + zone sûre.
// Elle est fixe en bas ; la coque réserve la place (rien ne passe dessous sans marge).
// Props :
//   onglets    [{ cle, libelle, icone, pastille, libellePastille, attrs }]   (attrs : data-* de l'app, posés sur le bouton)
//              icone : nœud (icône de l'app, taille 24) ; pastille : un nombre (0 / absent ⇒ rien)
//              libellePastille : ce que dit le lecteur d'écran (« 3 colis à envoyer »)
//   actif      la `cle` de l'onglet courant (aucune ⇒ aucun onglet actif : l'écran vient de « Plus »)
//   onChoisir  (cle) => …   — retoucher l'onglet actif appelle aussi onChoisir (l'écran remonte en haut)
//   libelle    le nom de la navigation (défaut : « Navigation principale »)
//   attrs      data-* / ref de l'app, posés sur <nav> (ex. { ref, 'data-en-cours': '1' })
// Exemple :
//   <BarreOnglets actif={tab} onChoisir={setTab} onglets={[
//     { cle: 'aujourdhui', libelle: "Aujourd'hui", icone: <Icon name="home" size={24}/> },
//     { cle: 'ventes', libelle: 'Ventes', icone: <Icon name="truck" size={24}/>, pastille: 3 } ]}/>
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';
import { Pastille } from './Pastille.jsx';

export function BarreOnglets({ onglets = [], actif = '', onChoisir, libelle = '', className = '', attrs = null }) {
  return (
    <nav className={cx('n-onglets', className)} aria-label={libelle || tr('natif.nav.nom')} data-n-onglets="" style={{ '--n-onglets-n': onglets.length || 1 }} {...(attrs || {})}>
      {onglets.map((o) => (
        <button
          key={o.cle}
          type="button"
          className="n-onglet"
          data-n-onglet={o.cle}
          aria-current={o.cle === actif ? 'page' : undefined}
          onClick={(e) => { if (onChoisir) onChoisir(o.cle, e); }}
          {...(o.attrs || {})}
        >
          <span className="n-onglet-icone" aria-hidden="true">
            {o.icone}
            {o.pastille ? <Pastille ton="ambre-plein" className="n-onglet-pastille">{o.pastille}</Pastille> : null}
          </span>
          <span className="n-onglet-libelle">{o.libelle}</span>
          {o.pastille && o.libellePastille ? <span className="n-lu-seul">{o.libellePastille}</span> : null}
        </button>
      ))}
    </nav>
  );
}

export default BarreOnglets;
