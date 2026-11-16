// ════════════════════════════════════════════════════════════════════════════
//  « BORDEREAU PRÊT » (16 nov., lot tampons-parametres)
//  Julien, sur sa capture iPhone : la feuille d'après était « faite à l'arrache »
//  (grosse coche, émojis, texte centré, « Ouvre-le puis Partager → Imprimer »).
//  Refaite dans le style de l'app : l'APERÇU RÉEL du bordereau tamponné (la page
//  du PDF qui partira), un seul bouton plein « Imprimer » qui ouvre DIRECTEMENT la
//  feuille de partage avec le PDF au téléphone (sinon le PDF), « Enregistrer » à
//  côté, « Déplacer le tampon » (le même aperçu avant impression), « Fermer ».
//  L'explication iPhone : une ligne sous « Pourquoi ? ». Aucun émoji.
//  Composant d'affichage : le moteur (App.jsx) lui passe le PDF et les gestes.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import '../styles-tampons.css';

export default function BordereauPret({ r, Feuille, Bouton, Pourquoi, dessiner, onImprimer, onDeplacer, onFermer, children }) {
  useLangue();
  const cv = React.useRef(null);
  const [vu, setVu] = React.useState('charge');
  React.useEffect(() => {
    let vivant = true;
    if (!r || !r.bytes || !cv.current) { setVu('sans'); return undefined; }
    dessiner(cv.current, r.bytes, { page: 1, largeur: 200 }).then(() => { if (vivant) setVu('ok'); }).catch(() => { if (vivant) setVu('ko'); });
    return () => { vivant = false; };
  }, [r && r.bytes]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;
  const titre = r.batch ? tr('tampons.pret.titreLot', { n: r.count || 0 }) : r.withInvoice ? tr('tampons.pret.titreFacture') : tr('tampons.pret.titre');
  return (
    <Feuille onClose={onFermer} maxWidth={420} z={1250} titre={titre} data-bord-pret={r.batch ? 'lot' : 'un'} data-noswipe="1" className="vrm-bord-pret">
      <div className="vrm-bord-pret-apercu" data-bord-pret-apercu={vu}>
        <canvas ref={cv} aria-label={tr('tampons.pret.apercu')} data-stream-image="bordereau"/>
        {vu === 'charge' ? <span className="vrm-tampons-attente">{tr('tampons.dessin')}</span> : null}
      </div>
      {r.printed ? <p className="vrm-bord-pret-phrase" data-bord-pret-ouvert="">{tr('tampons.pret.ouvert')}</p> : null}
      {children}
      <div className="vrm-bord-pret-actions">
        <Bouton variante="primaire" plein icone="printer" data-bord-imprimer="" onClick={onImprimer}>{tr('tampons.pret.imprimer')}</Bouton>
        <div className="vrm-bord-pret-secondaires">
          <a className="vrm-b vrm-b-secondaire" data-bord-enregistrer="" href={r.url} download={r.filename || 'bordereau.pdf'}>{tr('tampons.pret.enregistrer')}</a>
          {r.pdfBuf && !r.batch ? <Bouton variante="secondaire" data-imprime="1" data-tampon-deplacer="1" onClick={onDeplacer}>{tr('tampons.pret.deplacer')}</Bouton> : null}
        </div>
        <div className="vrm-bord-pret-pied">
          <Pourquoi label={tr('tampons.pret.pourquoi')}>{tr('tampons.pret.pourquoiTexte')}</Pourquoi>
          <Bouton variante="discret" data-bord-fermer="1" onClick={onFermer}>{tr('tampons.fermer')}</Bouton>
        </div>
      </div>
    </Feuille>
  );
}
