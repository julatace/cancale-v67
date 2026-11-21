// ── src/natif/GrilleMenu.jsx — l'écran « Menu » en tuiles groupées (21 nov., onglets-menu) ─────────────
// Julien, 21 nov. : « totalement réorganiser les onglets », « toujours dans le style Vintex », inspiré de Bleam ;
// puis « toute l'application doit être simplifiée et ergonomique ». La 5ᵉ place de la barre du bas ouvre CETTE feuille :
// en tête la carte du compte (⇒ Paramètres), puis des groupes de tuiles en grille de deux colonnes (icône + nom), puis
// au besoin des rangées (interrupteurs). Une tuile entière se touche (jamais un bouton dedans) ; 56 px au moins.
// Props :
//   GrilleMenu   titre (l'en-tête 13 gris du groupe) · pied (une ligne grise sous la grille, rare) · tuiles · attrs
//     tuiles     [{ cle, libelle, icone, pastille, libellePastille, valeur, actif, onChoisir, attrs }]
//                pastille : un nombre CONNU (0 / absent ⇒ rien), ambre = un geste à faire
//                valeur   : un texte court à droite (« 2 actives »), jamais en même temps qu'une pastille
//   CarteCompte  avatar (nœud) · nom · sousTitre · onChoisir · attrs
import React from 'react';
import { cx } from './outils.js';
import { Pastille } from './Pastille.jsx';
import { Glyphe } from './icones.jsx';

export function TuileMenu({ libelle, icone = null, pastille, libellePastille = '', valeur = '', actif = false, onChoisir, attrs = null }) {
  return (
    <button type="button" className="n-tuile-menu" aria-current={actif ? 'page' : undefined} onClick={onChoisir} {...(attrs || {})}>
      {icone ? <span className="n-tuile-menu-icone" aria-hidden="true">{icone}</span> : null}
      <span className="n-tuile-menu-libelle">{libelle}</span>
      {pastille ? <Pastille ton="ambre-plein" libelle={libellePastille} className="n-tuile-menu-pastille">{pastille > 99 ? '99+' : pastille}</Pastille>
        : valeur ? <span className="n-tuile-menu-valeur">{valeur}</span> : null}
    </button>
  );
}

export function GrilleMenu({ titre = '', pied = '', tuiles = [], className = '', attrs = null }) {
  const id = React.useId();
  const visibles = tuiles.filter(Boolean);
  if (!visibles.length) return null;
  return (
    <section className={cx('n-grille-menu', className)} aria-labelledby={titre ? id : undefined} {...(attrs || {})}>
      {titre ? <h3 className="n-grille-menu-titre" id={id}>{titre}</h3> : null}
      <div className="n-grille-menu-tuiles">
        {visibles.map((t) => <TuileMenu key={t.cle} {...t}/>)}
      </div>
      {pied ? <p className="n-grille-menu-pied">{pied}</p> : null}
    </section>
  );
}

export function CarteCompte({ avatar = null, nom = '', sousTitre = '', onChoisir, attrs = null }) {
  return (
    <button type="button" className="n-carte-compte" onClick={onChoisir} {...(attrs || {})}>
      {avatar ? <span className="n-carte-compte-avatar" aria-hidden="true">{avatar}</span> : null}
      <span className="n-carte-compte-textes">
        <span className="n-carte-compte-nom">{nom}</span>
        {sousTitre ? <span className="n-carte-compte-sous">{sousTitre}</span> : null}
      </span>
      <Glyphe nom="chevron" taille={16} className="n-carte-compte-fin"/>
    </button>
  );
}

export default GrilleMenu;
