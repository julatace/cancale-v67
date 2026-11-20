// ── src/natif/ecrans/AideArgent.jsx — « Comment c'est calculé », un « ? » discret (20 nov., lot argent-natif) ──────────
// Julien, 20 nov. : « “Comment c'est calculé” en grosse rangée ». Toute aide permanente d'Argent devient un « ? » de 44
// posé dans l'en-tête de sa carte (`action` de <Carte>) ; le toucher ouvre une feuille avec le texte. Rien n'est retiré :
// le texte est le même, il n'est plus écrit en permanence sur l'écran.
//   <Carte titre="Modèle et taille" action={<AideArgent titre="Comment c'est calculé">…le texte…</AideArgent>}>
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Feuille } from '../Feuille.jsx';
import { BoutonIcone } from '../Bouton.jsx';
import './argent.css';

export function AideArgent({ titre = '', children, attrs = null }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <>
      <BoutonIcone libelle={titre || tr('arn.comment')} icone={<span className="n-arg-q" aria-hidden="true">?</span>} onClick={() => setOuvert(true)}
        attrs={{ 'data-arg-aide': '', 'aria-haspopup': 'dialog', ...(attrs || {}) }}/>
      <Feuille ouverte={ouvert} onFermer={() => setOuvert(false)} titre={titre || tr('arn.comment')} detente="moitie">
        <div className="n-arg-aide-texte">{children}</div>
      </Feuille>
    </>
  );
}

export default AideArgent;
