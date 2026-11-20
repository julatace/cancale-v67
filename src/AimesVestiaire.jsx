// ── VESTIAIRE · « ONT AIMÉ TES ARTICLES » (15 nov., lot favoris-sites, extension 5.392) ──
// Vestiaire NOMME chaque personne qui aime un article (« … vient d'aimer votre pièce,
// envoyez-lui un message ! ») et permet au vendeur de lui faire la première offre. Ici : par
// article, combien de personnes (des NOMBRES : l'extension garde les personnes dans CE
// navigateur), et UN geste, sur SON clic : « Faire une offre » — aperçu (photo, prix,
// montant), « Envoyer l'offre de 237 € à 3 personnes », une fois par personne, relue par
// Vestiaire. Sans recette apprise de SON propre geste : rien ne part, et on dit comment.
// Règle : src/aimesVestiaire.js ; envoi : `offrirAuxAimesVc` (background.js).
import { BoutonExtension } from './BoutonExtension.jsx';   // (20 nov.) l'offre aux personnes qui aiment : dans l'extension
import React from 'react';
import { tr, monnaie, heure } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { montantOffre, remises, PAR_TOUCHER } from './aimesVestiaire.js';
import './styles-aimes-vestiaire.css';

const euros = (c) => (Number.isInteger(c) ? monnaie(c / 100, 'EUR', { maximumFractionDigits: c % 100 ? 2 : 0 }) : '—');

// (20 nov., décision de Julien) La feuille « Faire une offre » est retirée : l'offre part du panneau de l'extension.
export default function AimesVestiaire({ etat, recette, cap, versionExt = '', envoyer, Photo = null, Feuille }) {
  useLangue();
  const [ouvert, setOuvert] = React.useState('');
  if (!etat || !etat.pret) return null;
  const l = etat.lignes;
  const choisie = l.find((x) => x.produit === ouvert) || null;
  return (
    <section className="avc" data-aimes-vc={l.length ? String(l.length) : etat.lu ? 'aucun' : 'pas-lu'}>
      <h3 className="avc-titre">{tr('aimesVc.titre')}{l.length ? <span className="avc-n">{etat.total}</span> : null}</h3>
      {!l.length ? (
        <p className="avc-note" data-aimes-vc-vide="">{cap === 'ok' ? tr('aimesVc.vide') : tr(cap === 'absente' ? 'aimesVc.extAbsente' : 'aimesVc.extRetard', { v: versionExt })}</p>
      ) : (
        <ul className="avc-liste">
          {l.slice(0, 30).map((x) => (
            <li key={x.produit} className="avc-ligne" data-aimes-vc-article={x.produit} data-aimes-vc-n={x.n} data-aimes-vc-prevenues={x.prevenues}>
              <span className="sb-vignette avc-photo">{x.photo && Photo ? <Photo src={x.photo}/> : null}</span>
              <span className="avc-ligne-txt">
                <b>{x.numero ? <span className="sb-plaque"><small>N°</small>{x.numero}</span> : null}{x.titre || tr('aimesVc.article')}</b>
                <small>{tr('aimesVc.personnes', { n: x.n })}{x.prevenues ? ` · ${tr('aimesVc.dejaPrevenues', { n: x.prevenues })}` : ''}</small>
              </span>
              {x.aPrevenir > 0 && Number.isInteger(x.prixCents)
                ? <BoutonExtension className="sb-touche avc-geste" action="favoris" site="vestiaire" ids={[String(x.produit)]} attrs={{ 'data-aimes-vc-ouvrir': x.produit }}/>
                : <span className="avc-fait">{x.aPrevenir > 0 ? tr('aimesVc.prixPasLu') : tr('aimesVc.toutes')}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="avc-aide">{tr('aimesVc.aide')}</p>
    </section>
  );
}
