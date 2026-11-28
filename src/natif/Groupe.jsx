// ── src/natif/Groupe.jsx — la liste groupée (l'app Réglages) ─────────────────────────────
// Une carte arrondie qui contient des <Rangee> (ou n'importe quel contenu : <Affiche>, <Faits>…).
// Props :
//   titre     l'en-tête : 13/18 capitales gris (défaut) — ou `grand` ⇒ titre de section 22/28
//   grand     vrai ⇒ le titre est un titre de section (UN ou deux par écran, pas à chaque groupe)
//   action    nœud à droite de l'en-tête : UN <Bouton variante="texte">Tout voir</Bouton>
//   pied      une ligne 13/18 grise sous la carte (la couverture d'un total, une précision) — pas une explication permanente
//   nu        vrai ⇒ pas de carte (le contenu pose lui-même ses surfaces)
//   repli     { ouvert, onBascule, n } ⇒ l'en-tête devient un bouton qui replie le groupe (« À régler · 4 »)
//   className, attrs
// Exemple :
//   <Groupe titre="À envoyer" pied="3 bordereaux prêts sur 4">
//     <Rangee titre="Nike Air Max 90" sousTitre="N° 124 · 42" valeur="45 €" fin="chevron" onClick={ouvrir}/>
//     <Rangee titre="Adidas Samba" sousTitre="N° 131 · 41" valeur="60 €" fin="chevron" onClick={ouvrir}/>
//   </Groupe>
import React from 'react';
import { cx } from './outils.js';
import { Glyphe } from './icones.jsx';

// (28 nov., boutons-donnees — audit a11y P7) `niveau` : le niveau du titre (2 par défaut, sous le h1 de l'écran ; 3 pour un
// groupe posé DANS une section titrée). Avant : h3 par défaut, posé directement sous le h1 (un niveau sauté).
export function Groupe({ titre = '', grand = false, niveau = 2, action = null, pied = '', nu = false, repli = null, className = '', attrs = null, children }) {
  const id = React.useId();
  const ouvert = repli ? !!repli.ouvert : true;
  // `niveau={0}` : l'en-tête dit un ÉTAT (« 8 cochés · 15 sans bordereau »), pas le nom d'une section ⇒ un paragraphe.
  const Titre = grand ? 'h2' : niveau === 0 ? 'p' : `h${Math.min(6, Math.max(2, Number(niveau) || 2))}`;
  let tete = null;
  if (titre || action) {
    const libelle = (
      <>
        <span className="n-groupe-titre-texte">{titre}</span>
        {repli && repli.n ? <span className="n-groupe-n">{repli.n}</span> : null}
      </>
    );
    tete = (
      <div className="n-groupe-tete" data-n-grand={grand ? '1' : undefined}>
        {repli ? (
          <Titre className="n-groupe-titre">
            <button type="button" className="n-groupe-repli" aria-expanded={ouvert ? 'true' : 'false'} aria-controls={id} onClick={repli.onBascule}>
              {libelle}
              <Glyphe nom="chevron" taille={16} className="n-groupe-fleche"/>
            </button>
          </Titre>
        ) : (
          <Titre className="n-groupe-titre" id={id + 't'}>{libelle}</Titre>
        )}
        {action ? <div className="n-groupe-action">{action}</div> : null}
      </div>
    );
  }
  return (
    <section className={cx('n-groupe', className)} aria-labelledby={titre && !repli ? id + 't' : undefined} {...(attrs || {})}>
      {tete}
      {ouvert ? <div className={nu ? 'n-groupe-nu' : 'n-groupe-carte'} id={id}>{children}</div> : null}
      {ouvert && pied ? <p className="n-groupe-pied">{pied}</p> : null}
    </section>
  );
}

export default Groupe;
