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

function FeuilleOffre({ l, recette, cap, versionExt, envoyer, Photo, Feuille, envoi, onClose }) {
  const [texte, setTexte] = React.useState('');
  const [enCours, setEnCours] = React.useState(false);
  const [res, setRes] = React.useState(null);
  const cents = montantOffre(texte, l.prixCents);
  const n = Math.min(l.aPrevenir, PAR_TOUCHER);
  const pret = recette.etat === 'appris' && cap === 'ok' && Number.isInteger(l.prixCents) && n > 0;
  const suivi = envoi && envoi.produit === l.produit ? envoi : null;
  const lancer = async () => {
    if (!pret || cents == null || enCours) return;
    setEnCours(true); setRes(null);
    let r = null; try { r = await envoyer({ cmd: 'vcOffreAimes', produit: l.produit, avantCents: l.prixCents, prixCents: cents }); } catch (_) { r = null; }
    setEnCours(false); setRes(r || { accepte: false, raison: tr('aimesVc.sansReponse') });
  };
  return (
    <Feuille titre={tr('aimesVc.feuilleTitre')} sousTitre={l.numero ? `N°${l.numero}` : tr('aimesVc.vestiaire')} onClose={onClose} maxWidth={520} data-feuille-aimes-vc={l.produit}>
      <div className="avc-feuille">
        <div className="avc-article">
          <span className="sb-vignette avc-photo">{l.photo && Photo ? <Photo src={l.photo}/> : null}</span>
          <span className="avc-article-txt"><b>{l.titre || tr('aimesVc.article')}</b><span className="avc-chiffre">{euros(l.prixCents)}</span>
            <small>{tr('aimesVc.personnes', { n: l.n })}{l.prevenues ? ` · ${tr('aimesVc.dejaPrevenues', { n: l.prevenues })}` : ''}</small></span>
        </div>
        {cap !== 'ok' ? <p className="avc-note" data-aimes-vc-ext={cap}>{tr(cap === 'absente' ? 'aimesVc.extAbsente' : 'aimesVc.extRetard', { v: versionExt })}</p>
          : recette.etat !== 'appris' ? (
            <div className="avc-apprendre" data-aimes-vc-recette={recette.etat}>
              <p><b>{tr('aimesVc.apprendreTitre')}</b></p>
              <ol><li>{tr('aimesVc.apprendre1')}</li><li>{tr('aimesVc.apprendre2')}</li><li>{tr('aimesVc.apprendre3')}</li></ol>
              {recette.etat === 'pas-rejouable' ? <p className="avc-note">{tr('aimesVc.pasRejouable', { raison: recette.raison || '—' })}</p> : null}
            </div>
          ) : (<>
            <label className="avc-label" htmlFor={'avc-montant-' + l.produit}>{tr('aimesVc.montant')}</label>
            <div className="avc-montant">
              <input id={'avc-montant-' + l.produit} className="avc-champ" inputMode="decimal" autoComplete="off" placeholder="€" value={texte} onChange={(e) => setTexte(e.target.value.slice(0, 10))} data-aimes-vc-montant=""/>
              {remises(l.prixCents).map((x) => (
                <button key={x.p} type="button" className="sb-touche avc-remise" aria-pressed={cents === x.cents} data-aimes-vc-remise={x.p} onClick={() => setTexte(String(x.cents / 100))}>−{x.p} %<small>{euros(x.cents)}</small></button>
              ))}
            </div>
            <p className="avc-note">{tr('aimesVc.regle', { n: PAR_TOUCHER })}</p>
            <button type="button" className="sb-btn-plein avc-envoyer" data-aimes-vc-envoyer={l.produit} disabled={!pret || cents == null || enCours || (suivi && !suivi.fin)} onClick={lancer}>
              {enCours ? '…' : cents == null ? tr('aimesVc.choisisMontant') : tr('aimesVc.envoyer', { prix: euros(cents), n })}
            </button>
          </>)}
        {res && res.accepte === false ? <p className="avc-refus" role="alert" data-aimes-vc-refus={res.code || ''}>{res.raison || tr('aimesVc.rienParti')}</p> : null}
        {suivi ? (
          <p className="avc-suivi" role="status" data-aimes-vc-suivi={suivi.fin || 'encours'} data-faites={suivi.faites} data-n={suivi.n}>
            {suivi.fin ? tr(suivi.fin === 'arret' ? 'aimesVc.arrete' : 'aimesVc.fini', { faites: suivi.faites, n: suivi.n, heure: heure(suivi.at) }) : tr('aimesVc.encours', { faites: suivi.faites, n: suivi.n })}
            {suivi.incertaines ? <> · {tr('aimesVc.incertaines', { n: suivi.incertaines })}</> : null}
            {suivi.fin === 'arret' && suivi.raison ? <small> — {suivi.raison}</small> : null}
          </p>
        ) : null}
      </div>
    </Feuille>
  );
}

// etat : `lignesAimes(...)` ; recette : `etatRecetteFavori(...)` ; cap : extSait('vcaimes').
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
