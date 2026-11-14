// ── src/ui/LigneAFaire.jsx — « • À faire · 5 › » : toutes les alertes d'un écran en UNE ligne ──
// Julien (AJOUT 3) : « 4 brouillons à refaire », « 18 retirées de Vinted », « Bénéfice — :
// prix d'achat 0/19 connus », « 2 nouveaux N° »… éparpillés avant la liste. Ici : une
// rangée (point ambre, « À faire », le nombre, chevron) qui ouvre une feuille où chaque
// chose garde SON geste (rien de perdu, tout regroupé). Les alertes sont passées en
// `children` (les éléments de l'écran, tels quels) ; `n` est le nombre de choses ; n = 0
// ⇒ rien n'est rendu. `ouvert`/`onOuvert` : l'écran peut tenir l'état (rouvrir après un geste).
//   <LigneAFaire n={alertes.length}>{alertes}</LigneAFaire>
import React, { useState } from 'react';
import { tr } from '../i18n/index.js';
import { Feuille } from './Feuille.jsx';
import './ui.css';

const Chevron = () => <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export function LigneAFaire({ n, titre, children, ouvert: ouvertVoulu, onOuvert, className = '', ...attrs }) {
  const [ouvertIci, setOuvertIci] = useState(false);
  const ouvert = ouvertVoulu != null ? ouvertVoulu : ouvertIci;
  const poser = (v) => { if (onOuvert) onOuvert(v); if (ouvertVoulu == null) setOuvertIci(v); };
  if (!n) return null;
  return (
    <>
      <button type="button" className={'vrm-ui-afaire' + (className ? ' ' + className : '')} aria-haspopup="dialog" aria-expanded={ouvert} data-ui-afaire={n} onClick={() => poser(true)} {...attrs}>
        <span className="vrm-ui-afaire-point" aria-hidden="true"/>
        <span className="vrm-ui-afaire-mots">{titre || tr('listes.afaire')} <span className="vrm-ui-afaire-n">· {n}</span></span>
        <Chevron/>
      </button>
      {ouvert ? <Feuille titre={titre || tr('listes.afaire')} onClose={() => poser(false)} data-ui-afaire-feuille=""><div className="vrm-ui-afaire-corps">{children}</div></Feuille> : null}
    </>
  );
}
export default LigneAFaire;
