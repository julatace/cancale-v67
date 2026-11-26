// ── src/natif/Carte.jsx — la carte-tableau et les tuiles de chiffres (19 nov.) ────────────
// Julien, 19 nov. : « je veux que ce soit mieux, plus dans le style de Vintex, entre Vintex et celui-là ». Ce qu'on en
// prend : des cartes à FILET fin (1 px, rayon 12, aucune ombre), l'en-tête DANS la carte en petites capitales grises,
// des rangées denses (vignette 44) ; les chiffres en tuiles alignées, l'écart en petit dessous.
//
// <Carte> — une carte-tableau.
//   titre      l'en-tête (petites capitales grises) ; n : un compte à côté (« 8 ») ; sousTitre : une ligne grise dessous
//              (tonSous 'ambre' : un geste à faire, une date limite LUE proche)
//   action     un nœud à droite de l'en-tête (le <Bouton variante="plein"> de l'écran s'y fait compact, ou un lien)
//   children   des <Rangee> (vignette 44), un <CodeRetrait>, des <Vignettes>…
//   attrs      data-* de l'écran
//   <Carte titre="À envoyer" n={8} sousTitre="3 pas encore prêts" action={<Bouton variante="plein">Imprimer 5</Bouton>}>
//     <Rangee vignette={…} titre="Nike…" sousTitre="N° 91 · Mondial Relay" pastille={<Pastille ton="ambre">demain</Pastille>} valeur="45 €"/>
//   </Carte>
//
// <Tuiles> + <Tuile> — les chiffres d'un écran, côte à côte (2 colonnes au téléphone, 4 dès 600 px).
//   Tuiles : titre (en-tête gris, à gauche), action (à droite : un <Segmente>), pied (sous la grille : une <Progression>), children = des <Tuile>
//   Tuile  : libelle (petites capitales grises) · valeur (« 1 284 », null ⇒ « — ») · unite (« € ») · detail (13 gris :
//            l'écart, « au moins », la raison d'un « — ») · ton ('neutre' | 'ambre' : le détail est un geste à faire)
//            · onClick (la tuile entière se touche) · attrs
//   <Tuiles titre="Tes chiffres" action={<Segmente …/>}>
//     <Tuile libelle="CA vendu" valeur="497" unite="€" detail="−12 % vs la semaine dernière" onClick={ouvrir}/>
//   </Tuiles>
import React from 'react';
import { cx, TIRET, attenteDe, attrsAttente } from './outils.js';
import './complements.css';

export function Carte({ titre = '', n = null, sousTitre = '', tonSous = 'neutre', action = null, className = '', attrs = null, children }) {
  const id = React.useId();
  return (
    <section className={cx('n-carte', className)} aria-labelledby={titre ? id : undefined} {...(attrs || {})}>
      {titre || action ? (
        <header className="n-carte-tete">
          <div className="n-carte-titres">
            {titre ? <h2 className="n-carte-titre" id={id}>{titre}{n != null && n !== '' ? <span className="n-carte-n">{n}</span> : null}</h2> : null}
            {sousTitre ? <p className="n-carte-sous" data-n-ton={tonSous}>{sousTitre}</p> : null}
          </div>
          {action ? <div className="n-carte-action">{action}</div> : null}
        </header>
      ) : null}
      <div className="n-carte-corps">{children}</div>
    </section>
  );
}

export function Tuiles({ titre = '', action = null, pied = null, className = '', attrs = null, children }) {
  return (
    <section className={cx('n-tuiles', className)} {...(attrs || {})}>
      {titre || action ? (
        <header className="n-tuiles-tete">
          {titre ? <h2 className="n-tuiles-titre">{titre}</h2> : null}
          {action ? <div className="n-tuiles-action">{action}</div> : null}
        </header>
      ) : null}
      <div className="n-tuiles-grille" role="list">{children}</div>
      {pied ? <div className="n-tuiles-pied">{pied}</div> : null}
    </section>
  );
}

// `graphe` (22 nov., style-clarte) : une petite forme sous le chiffre (<Etincelle>), facultative.
export function Tuile({ libelle, valeur = null, unite = '', detail = '', ton = 'neutre', onClick = null, className = '', attrs = null, graphe = null, enCours = null }) {
  const su = !(valeur == null || valeur === '');
  const att = attenteDe(enCours, su, detail);   // (24 nov., livrable) en lecture : un squelette, jamais « — · lecture… »
  const contenu = (
    <>
      <span className="n-tuile-libelle">{libelle}</span>
      <span className="n-tuile-ligne">
        <span className="n-tuile-valeur" data-n-vide={su ? undefined : '1'} {...attrsAttente(att, 'valeur')}>{su ? valeur : TIRET}</span>
        {su && unite ? <span className="n-tuile-unite">{unite}</span> : null}
        {graphe ? <span className="n-tuile-graphe">{graphe}</span> : null}
      </span>
      <span className="n-tuile-detail" data-n-ton={ton} {...attrsAttente(att, 'note')}>{detail || ' '}</span>
    </>
  );
  return (
    <div role="listitem" className="n-tuile-case">
      {onClick
        ? <button type="button" className={cx('n-tuile', 'n-tuile-touche', className)} onClick={onClick} {...(attrs || {})}>{contenu}</button>
        : <div className={cx('n-tuile', className)} {...(attrs || {})}>{contenu}</div>}
    </div>
  );
}

export default Carte;
