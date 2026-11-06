// ═══════════════════════════════════════════════════════════════════════════
// LES RANGÉES « RÉGLAGES » D'iOS (6 nov., v36-visuel)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 6 nov., sur Annonces · eBay : « c'est catastrophique, on dirait du
// travail bâclé ». Les réglages d'un écran (règle d'offre, retrait automatique)
// étaient des paragraphes de 9 lignes dans des cadres ambre, un bouton coincé au
// milieu d'une phrase. Ici, la forme des Réglages d'iPhone :
//
//   GroupeIos   — un titre de groupe en petites capitales, une carte aux coins
//                 continus, des rangées séparées par un filet qui commence
//                 APRÈS l'icône (comme iOS) ; un pied facultatif (une ligne).
//   RangeeIos   — icône · libellé (+ une ligne de détail au plus) · valeur ·
//                 interrupteur OU chevron. Toute la rangée se touche (44 px au
//                 moins) quand elle ouvre quelque chose. `ton="geste"` met la
//                 VALEUR en ambre (§7 : un geste à faire), jamais un cadre.
//   Interrupteur — le vrai interrupteur d'iOS (51 × 31), rôle `switch`.
//
// Le sens ne vit pas ici : chaque écran passe ses data-* (les bancs les lisent)
// et ses textes. Un composant de forme, pas de règle.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';

export function GroupeIos({ titre, pied, children, className = '', ...rest }) {
  return (
    <section className={'vrm-ios-groupe ' + className} {...rest}>
      {titre ? <h3 className="vrm-ios-groupe-titre">{titre}</h3> : null}
      <div className="vrm-ios-carte">{children}</div>
      {pied ? <div className="vrm-ios-groupe-pied">{pied}</div> : null}
    </section>
  );
}

export function Interrupteur({ on, onChange, disabled = false, label, attrs = {} }) {
  return (
    <button type="button" role="switch" aria-checked={on === true} aria-label={label} disabled={disabled}
      className="vrm-ios-switch" data-on={on === true ? '1' : on === false ? '0' : 'pas-su'}
      onClick={(e) => { e.stopPropagation(); if (!disabled && onChange) onChange(!on); }} {...attrs}>
      <span className="vrm-ios-switch-pouce" aria-hidden="true" />
    </button>
  );
}

// `onClick` ⇒ la rangée entière est un bouton (chevron). `interrupteur` ⇒ le
// libellé ouvre `onClick` s'il est donné, l'interrupteur bascule seul.
export function RangeeIos({ icone, titre, detail, valeur, ton, chevron, onClick, interrupteur, apres, valeurAttrs = {}, className = '', ...rest }) {
  const corps = (
    <>
      {icone ? <span className="vrm-ios-icone" aria-hidden="true">{icone}</span> : null}
      <span className="vrm-ios-texte">
        <span className="vrm-ios-titre">{titre}</span>
        {detail ? <span className="vrm-ios-detail">{detail}</span> : null}
      </span>
      {valeur != null && valeur !== '' ? <span className="vrm-ios-valeur" data-ton={ton || undefined} {...valeurAttrs}>{valeur}</span> : null}
      {(chevron ?? (!!onClick && !interrupteur)) ? <span className="vrm-ios-chevron" aria-hidden="true"><svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m1.5 1.5 5 5-5 5"/></svg></span> : null}
    </>
  );
  if (interrupteur) {
    return (
      <div className={'vrm-ios-rangee ' + className} {...rest}>
        {onClick
          ? <button type="button" className="vrm-ios-rangee-zone" onClick={onClick}>{corps}</button>
          : <span className="vrm-ios-rangee-zone">{corps}</span>}
        {apres}
        <Interrupteur {...interrupteur} />
      </div>
    );
  }
  if (onClick) {
    return (
      <div className={'vrm-ios-rangee ' + className} {...rest}>
        <button type="button" className="vrm-ios-rangee-zone" onClick={onClick}>{corps}</button>
        {apres}
      </div>
    );
  }
  return <div className={'vrm-ios-rangee ' + className} {...rest}><span className="vrm-ios-rangee-zone">{corps}</span>{apres}</div>;
}
