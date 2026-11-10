// ════════════════════════════════════════════════════════════════════════════
//  « SEUIL DE TVA » — la jauge et l'alerte, à côté des factures (10 nov., lot T)
// ════════════════════════════════════════════════════════════════════════════
// La règle : src/seuilTvaFacture.js (`alerteSeuilTva`, sur `jaugeSeuils` de
// src/microEntreprise.js — la même jauge que Comptabilité). Ici, seulement
// l'affichage :
//   · une jauge du CA de l'année face au seuil de franchise (85 000 € en 2026) ;
//   · une alerte AMBRE à 80 % puis au dépassement, avec ce que ça change, et
//     LA porte : « Mon régime de TVA » ouvre « Ma facture » sur ce champ ;
//   · rien sur un « pas su » (pas de ligne publiée, fiche illisible) ;
//   · déjà en TVA (classique ou marge) : une ligne neutre, aucune alerte.
// Chargé à la demande depuis Comptabilité → Factures (src/ecrans/Compta.jsx).
import React from 'react';
import './facture-tva.css';
import { useLigneUrssaf, useProfilFiscal } from './App.jsx';
import { useFicheFacturation, FicheFacturation } from './FacturePro.jsx';
import { alerteSeuilTva, phrasesSeuilTva } from './seuilTvaFacture.js';

const eur = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;
const pct = (p) => `${String(Math.floor(p))} %`;

export default function SeuilTvaFactures({ deps }) {
  const ligne = useLigneUrssaf();
  const pf = useProfilFiscal();
  const cfg = useFicheFacturation(deps);
  const [ouvrir, setOuvrir] = React.useState(false);
  const activite = pf && pf.activite === 'services' ? 'services' : 'vente';
  const regime = cfg === undefined ? undefined : cfg === null ? null : String(cfg.tva_regime || '');
  const a = React.useMemo(() => alerteSeuilTva({ ligne, activite, regime }), [ligne, activite, regime]);
  if (!a) return null;                                   // pas su : on se tait (§5)
  const p = phrasesSeuilTva(a);
  const am = a.partiel ? 'au moins ' : '';
  const remplissage = Math.min(100, (a.ca / a.majore) * 100);
  const trait = (a.seuil / a.majore) * 100;
  return (
    <section className={`vrm-stva${a.alerte ? ' is-alerte' : ''}`} data-seuil-tva={a.etat} data-seuil-tva-alerte={a.alerte || ''}
      data-seuil-tva-ca={String(a.ca)} data-seuil-tva-partiel={a.partiel ? '1' : ''} data-seuil-tva-regime={a.regimeSu ? (a.regime || 'aucun') : 'passu'}
      aria-label="Seuil de TVA">
      <div className="vrm-stva-tete">
        <span className="vrm-stva-titre">Seuil de TVA {a.annee}</span>
        <span className="vrm-stva-chiffre"><b>{am}{eur(a.ca)}</b> / {eur(a.seuil)}</span>
      </div>
      <div className="vrm-stva-jauge" role="meter" aria-valuemin={0} aria-valuemax={a.majore} aria-valuenow={Math.round(a.ca)} aria-label={`${am}${eur(a.ca)} reçus sur ${eur(a.seuil)}`}>
        <span className="vrm-stva-plein" style={{ width: `${remplissage}%` }} data-seuil-tva-pct={String(Math.floor(a.pct))}/>
        <span className="vrm-stva-trait" style={{ left: `${trait}%` }} aria-hidden="true"/>
      </div>
      {a.alerte ? (
        <div className="vrm-stva-alerte" role="status" data-seuil-tva-texte="">
          <b>{a.partiel && a.etat === 'proche' ? `Tu factures sans TVA : au moins ${pct(a.pct)} du seuil.` : p.titre}</b>
          <span>{p.change}</span>
          {p.plus ? <span>{p.plus}</span> : null}
          {a.regime === '' ? <span data-seuil-tva-pas-choisi="">Ton régime de TVA n'est pas encore choisi.</span> : null}
          <button type="button" className="vrm-b vrm-b-secondaire vrm-stva-porte" data-seuil-tva-porte="tva_regime" aria-expanded={ouvrir} onClick={() => setOuvrir((v) => !v)}>
            {ouvrir ? 'Fermer Ma facture' : 'Mon régime de TVA'}
          </button>
        </div>
      ) : (
        <p className="vrm-stva-calme" data-seuil-tva-texte="">
          {a.assujetti ? 'Tu factures déjà la TVA.'
            : a.etat === 'ok' ? `${am}${pct(a.pct)} du seuil · encore ${a.partiel ? 'au plus ' : ''}${eur(a.reste)}.`
            : a.etat === 'proche' ? `${am}${pct(a.pct)} du seuil.`
            : p.titre}
        </p>
      )}
      <details className="vrm-stva-pourquoi">
        <summary>Pourquoi ?</summary>
        <p>Le chiffre : ce que tes plateformes t'ont versé en {a.annee}, comme dans Comptabilité.{a.partiel ? ` C'est un minimum : ${a.raisons.join(' · ')}.` : ''}</p>
        <p>Franchise de TVA, {activite === 'services' ? 'prestations de services' : 'vente de marchandises'} : {eur(a.seuil)}, seuil majoré {eur(a.majore)} (service-public.fr, F21746). Au-dessus de {eur(a.seuil)}, la TVA s'applique au 1er janvier suivant ; au-dessus de {eur(a.majore)}, le jour même.</p>
      </details>
      {ouvrir ? <div className="vrm-stva-fiche" data-seuil-tva-fiche=""><FicheFacturation deps={deps} focus="tva_regime"/></div> : null}
    </section>
  );
}
