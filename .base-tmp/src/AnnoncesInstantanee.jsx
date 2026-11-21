// ════════════════════════════════════════════════════════════════════════════
//  ANNONCES TOUT DE SUITE — LE RENDU DE L'INSTANTANÉ (11 nov., ouverture-legere-2)
//  Les dernières annonces rendues sur CET appareil pour CE compte
//  (src/annoncesInstantanee.js), dans la forme de l'écran vrai (mêmes classes :
//  la place ne bouge pas quand il le remplace), « Mis à jour il y a N min » à la
//  place de « Modifier ». INERTE : aucun geste n'en part. Aucune photo (sa place
//  seulement), aucun lien, aucun identifiant d'annonce : `data-inst-*` seulement
//  (les attributs de STYLE sans valeur `data-titre`, `data-prix`,
//  `data-fiche-ouverte="0"` sont repris pour la même taille de texte).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { annoncesMontrable } from './annoncesInstantanee.js';
import { useInerte, useMaintenant, MentionInstantane, CarteInstantanee } from './InstantaneCommun.jsx';
import './styles-colis-ventes-instantanes.css';

export function AnnoncesInstantanee({ snap, maintenant = null, fmt = null }) {
  const ref = React.useRef(null);
  const now = useMaintenant(maintenant);
  useInerte(ref);
  const M = annoncesMontrable(snap, now);
  if (!M) return null;
  return (
    <div ref={ref} className="vrm-ji vrm-inst" style={{ position: 'relative' }} data-inst-ecran="annonces" data-inst-t={String(M.t)} data-inst-age={String(Math.floor(M.age / 60000))} aria-busy="true">
      {/* La forme de `rendreTache('annonces')` · Vinted (App.jsx) : tête, puces, carte, vignettes. */}
      <section className="vrm-tache" aria-label="Annonces — dernières connues">
        <header className="vrm-market-heading vrm-tache-tete">
          <h1>Annonces</h1>
          {M.phrase ? <p className="vrm-phrase-ecran">{M.phrase}</p> : null}
        </header>
        {M.carte ? null : <MentionInstantane age={M.age} className="vrm-ji-age vrm-ji-age-seule" prefixe="data-inst"/>}
        <section className="vrm-market-space" aria-label="Vinted">
          {M.puces > 1 ? (
            <div className="vrm-compte-choix vrm-compte-puces-hote" style={{ padding: '12px 16px 0' }}>
              <div className="vrm-compte-puces" aria-hidden="true">
                {Array.from({ length: M.puces }, (_, i) => (
                  <span key={i} className={'vrm-compte-puce' + (i === 0 ? ' is-actif' : ' vrm-inst-puce')} style={{ display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>{i === 0 ? 'Tous' : ' '}</span>
                ))}
              </div>
            </div>
          ) : null}
          {M.carte ? <div style={{ padding: '12px 16px 0' }}><CarteInstantanee carte={M.carte} age={M.age} fmt={fmt} maintenant={now}/></div> : null}
          {M.ecart ? <div aria-hidden="true" style={{ height: M.ecart }}/> : null}
          <div style={{ padding: M.ecart ? '0 14px 40px' : '16px 14px 40px' }}>
          <div className="vrm-ann-grid vrm-fiches vrm-ann-vignettes" data-inst-annonces={String(M.fiches.length)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: 16 }}>
            {M.fiches.map((f, i) => (
              <div key={i} className="vrm-ann-card vrm-fiche vrm-vignette vrm-inst-annonce" data-fiche-ouverte="0" data-inst-annonce="">
                <div className="vrm-ann-overview">
                  <span className="vrm-fiche-photo vrm-inst-photo" aria-hidden="true"/>
                  {f.num ? <span className="vrm-fiche-numero"><span className="vrm-num vrm-num-grand"><span className="vrm-num-prefixe" aria-hidden="true">N°</span><span>{f.num}</span></span></span> : null}
                  <div className="vrm-ann-ledger-info">
                    <div data-titre="">{f.titre}</div>
                    <div className="vrm-ann-price-line"><span data-prix="">{f.prix}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        </section>
      </section>
    </div>
  );
}
