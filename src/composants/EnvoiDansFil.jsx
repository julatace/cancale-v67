// ════════════════════════════════════════════════════════════════════════════
//  L'ENVOI SE VOIT DANS LE FIL — Leboncoin, Vestiaire, eBay (12 nov.). La même
//  forme que Messages · Vinted (App.jsx, 11 nov.) : la bulle pâle « Envoi… »
//  pendant, « Envoyé ✓ » quand le site l'a accepté, « Pas envoyé · Réessayer »
//  quand rien n'est parti (SON clic renvoie, le texte reste dans le champ),
//  « Pas confirmé · vérifie sur … » sinon (rien ne propose de renvoyer).
//  L'état vient de src/envoiFil.js ; les règles d'envoi ne passent pas ici.
//  `Bulle` est la bulle partagée (`BulleConv`), passée par l'écran : ce fichier
//  n'importe rien d'App.jsx. Styles : src/styles-messages-naturel.css.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

export function EnvoiDansFil({ envoi, Bulle, site, onReessayer, reessayerDesactive = false, dejaLu = false }) {
  if (!envoi || !envoi.etat || !Bulle) return null;
  const { etat, texte } = envoi;
  if (etat === 'ok' && dejaLu) return <div className="vrm-envoi-etat" data-envoi="ok" role="status">Envoyé ✓</div>;
  const etatTexte = etat === 'envoi' ? 'Envoi…'
    : etat === 'ok' ? 'Envoyé ✓'
    : etat === 'refuse' ? <>Pas envoyé · <button type="button" className="vrm-envoi-reessayer" data-envoi-reessayer="" disabled={reessayerDesactive} onClick={onReessayer}>Réessayer</button></>
    : `Pas confirmé · vérifie sur ${site}`;
  return (
    <Bulle moi qui="Toi" texte={texte}
      attrs={{ 'data-envoi-bulle': etat, className: etat === 'ok' ? 'vrm-bulle-l vrm-bulle-moi' : 'vrm-bulle-l vrm-bulle-moi vrm-bulle-envoi' }}
      apres={<div className="vrm-envoi-etat" data-envoi={etat} role={etat === 'envoi' || etat === 'ok' ? 'status' : 'alert'}>{etatTexte}</div>}/>
  );
}

// Un fil vide dont la liste annonce un message : une lecture incomplète, jamais « aucun message ».
export function FilPasLu({ onRelire, attrs }) {
  return (
    <div data-fil-pas-lu="" role="status" {...(attrs || {})} style={{ fontSize: 13, color: 'var(--vrm-muted)', textAlign: 'center', padding: '20px 0' }}>
      Ce fil n’est pas encore lu en entier. <button type="button" className="vrm-pied-lien" data-pied-lien="relire-fil" onClick={onRelire}>Relire</button>
    </div>
  );
}

// Une lecture RATÉE (la base n'a pas répondu) : la raison et « Réessayer » — jamais un fil vide.
export function FilIllisible({ texte, onRelire, attrs }) {
  return (
    <div data-fil-illisible="" role="alert" {...(attrs || {})} style={{ fontSize: 13, color: 'var(--vrm-muted)', textAlign: 'center', padding: '20px 0', lineHeight: 1.55 }}>
      {texte} <button type="button" className="vrm-pied-lien" data-pied-lien="relire-fil" onClick={onRelire}>Réessayer</button>
    </div>
  );
}
