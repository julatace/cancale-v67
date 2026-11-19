// ── src/natif/Volets.jsx — la liste et son détail, côte à côte à l'ordinateur ──────────
// Le contrat (docs/design/NATIF.md §2) : à l'ordinateur, la LISTE (380–520) et le DÉTAIL (la fiche touchée, borné à 760)
// côte à côte, la liste toujours visible. La <Coque volets="trois"> le fait pour un écran rendu dans sa grille ; <Volets>
// fait la MÊME chose à l'intérieur d'un écran quand la coque qui l'entoure est à deux volets (ou n'est pas la coque
// native) : la <PagePoussee> que l'écran rend s'ouvre alors toute seule dans le volet de droite, sans rien changer
// dans l'écran. Au téléphone, <Volets> ne fait rien : la page poussée couvre l'écran, comme partout.
// Si la coque porte déjà un volet de détail, <Volets> s'efface (pas de volet dans le volet).
//    Props :
//      detailVide  ce que montre le volet de droite quand rien n'est touché (un <Vide/>)
//      className, attrs
//    Exemple :
//      <Volets detailVide={<Vide icone={…} phrase="Touche une vente pour la voir ici."/>}>
//        <Page titre="Ventes">…</Page>
//        <PagePoussee ouverte={!!choisie} …>…</PagePoussee>
//      </Volets>
import React from 'react';
import { tr } from '../i18n/index.js';
import { ContexteCoque } from './Page.jsx';
import { useOrdinateur } from './Coque.jsx';
import { cx } from './outils.js';

export function Volets({ detailVide = null, className = '', attrs = null, children }) {
  const ordinateur = useOrdinateur();
  const coque = React.useContext(ContexteCoque);
  const [volet, setVolet] = React.useState(null);
  const contexte = React.useMemo(() => ({ ...(coque || {}), titreRendu: !!(coque && coque.titreRendu), voletDetail: volet, ordinateur: true }), [coque, volet]);
  if (!ordinateur || (coque && coque.voletDetail)) return <>{children}</>;
  return (
    <div className={cx('n-volets', className)} data-n-volets-ecran="" {...(attrs || {})}>
      <ContexteCoque.Provider value={contexte}>
        <div className="n-volets-liste">{children}</div>
      </ContexteCoque.Provider>
      <aside className="n-volets-detail" aria-label={tr('natif.detail.nom')}>
        <div className="n-volets-fente" ref={setVolet}/>
        <div className="n-volets-vide">{detailVide}</div>
      </aside>
    </div>
  );
}

export default Volets;
