// ── src/ui/BandeChiffres.jsx — la bande de chiffres d'un écran de LISTE ─────────
// Julien (AJOUT 3) : pas de carte sombre pour un chiffre sur un écran de liste — une
// BANDE compacte (≤ 72 px), 2 à 4 chiffres côte à côte (28/700, libellé 13), posée sur
// le fond de la page, sans carte. Un chiffre PAS SU (`n == null`) n'est pas montré
// (jamais une case pour « — ») sauf `garderVide` (il s'écrit alors « — », à la taille
// du texte, avec sa raison dans `titre`). Les valeurs viennent de l'écran, qui les tient
// de SA règle (§5) : la bande n'en calcule aucune.
//   <BandeChiffres items={[{ cle:'enligne', n:36, l:'en ligne' }, { cle:'vendu', n:'1 471 €', l:'vendu · mois', onClick }]}/>
import React from 'react';
import './ui.css';

export function BandeChiffres({ items = [], className = '', ...attrs }) {
  const vus = (items || []).filter((x) => x && (x.n != null || x.garderVide)).slice(0, 4);
  if (!vus.length) return null;
  return (
    <div className={'vrm-ui-bande' + (className ? ' ' + className : '')} data-ui-bande={vus.length} {...attrs}>
      {vus.map((x) => {
        const corps = <><span className={'vrm-ui-bande-n' + (x.n == null ? ' is-vide' : '')}>{x.n == null ? '—' : x.n}</span><span className="vrm-ui-bande-l">{x.l}</span></>;
        return x.onClick
          ? <button key={x.cle} type="button" className="vrm-ui-bande-item" data-ui-bande-item={x.cle} title={x.titre} onClick={x.onClick} {...(x.attrs || {})}>{corps}</button>
          : <div key={x.cle} className="vrm-ui-bande-item" data-ui-bande-item={x.cle} title={x.titre} {...(x.attrs || {})}>{corps}</div>;
      })}
    </div>
  );
}
export default BandeChiffres;
