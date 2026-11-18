// ════════════════════════════════════════════════════════════════════════════
//  PLATEFORME + COMPTE = UN MENU, SOUS LE GRAND TITRE (17 nov., nouveau design).
//  « Vinted · 3 comptes ▾ » : la rangée de pastilles (sites, comptes) disparaît de l'écran et vit dans
//  une feuille qui s'ouvre au toucher. Ce sont les MÊMES contrôles qu'avant (FiltreSites, SelecteurCompte,
//  les rubriques du site), passés en `children` : rien de supprimé, les mêmes états, les mêmes écritures.
//  Un choix fait referme la feuille. La feuille est un portail (§7 : jamais dans un conteneur qui défile),
//  avec `FermeAuRetour` (le geste retour d'iOS la ferme).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { BoutonIconeV2 } from './BoutonV2.jsx';
import './design-v2.css';

export default function MenuPlateforme({ libelle, sous = '', logo = null, children, Icon, Retour = null, id = 'menu' }) {
  const [ouvert, setOuvert] = React.useState(false);
  const corps = React.useRef(null);
  // Un choix dans la feuille (un bouton touché) la referme, après que le contrôle a fait son travail.
  const apresChoix = (e) => { const b = e.target && e.target.closest && e.target.closest('button,[role="radio"],[role="tab"],[role="option"]'); if (b) setTimeout(() => setOuvert(false), 120); };
  React.useEffect(() => {
    if (!ouvert) return undefined;
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [ouvert]);
  return (
    <>
      <button type="button" className="v2-rangee v2-menu" data-v2-rangee="" data-v2-menu={id} aria-haspopup="dialog" aria-expanded={ouvert} onClick={() => setOuvert(true)}>
        {logo ? <span className="v2-menu-logo" aria-hidden="true">{logo}</span> : null}
        <span className="v2-menu-lib">{libelle}</span>
        {sous ? <span className="v2-menu-sous">{sous}</span> : null}
        <span className="v2-menu-fleche" aria-hidden="true"><Icon name="chevron" size={14}/></span>
      </button>
      {/* Les contrôles restent MONTÉS (cachés) quand la feuille est fermée : leurs effets (choix retenu, nombres
          publiés) continuent comme avant. */}
      {createPortal(
        <div className={'v2-feuille-hote' + (ouvert ? ' is-ouverte' : '')} data-v2-feuille={id} hidden={!ouvert}>
          {ouvert && Retour ? <Retour fermer={() => setOuvert(false)}/> : null}
          <div className="v2-voile" onClick={() => setOuvert(false)} aria-hidden="true"/>
          <div className="v2-feuille" role="dialog" aria-modal="true" aria-label={tr('v2.menu.titre')}>
            <div className="v2-feuille-tete">
              <span className="v2-feuille-poignee" aria-hidden="true"/>
              <h2 className="v2-feuille-titre">{tr('v2.menu.titre')}</h2>
              <BoutonIconeV2 icone={<Icon name="close" size={22}/>} label={tr('v2.menu.fermer')} onClick={() => setOuvert(false)} attrs={{ 'data-v2-feuille-fermer': '' }}/>
            </div>
            <div className="v2-feuille-corps" ref={corps} onClick={apresChoix}>{children}</div>
          </div>
        </div>, document.body)}
    </>
  );
}
