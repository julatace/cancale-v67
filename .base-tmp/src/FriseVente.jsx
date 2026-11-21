// ════════════════════════════════════════════════════════════════════════════
//  LA FRISE D'UNE VENTE (10 nov., lot BE) — le rendu de `friseProuvee`
//  (src/friseProuvee.js, la règle). Aucune règle ici.
//  · Une étape PROUVÉE : un point plein coché et sa date courte (« lu » quand la
//    preuve ne porte pas de date) ; la dernière prouvée porte l'accent (où en est
//    la vente) — la seule couleur.
//  · Une étape pas sue : grise, « pas lu ». Jamais cochée par déduction.
//  · L'étape en cours où un geste DE LUI est attendu : ambre, le geste en un mot.
//  · Litige, retour, annulation : une BIFURCATION après la dernière étape
//    prouvée (ambre seulement si SA réponse est attendue) ; les étapes d'après
//    pâlissent.
//  · « En route » porte le logo du transporteur de SON bordereau.
//  Horizontale quand la place le permet (le panneau de l'ordinateur), verticale
//  au téléphone (plus lisible : sept étapes ne tiennent pas en 358 px).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { sousEtape } from './friseProuvee.js';
import { LogoTransporteur } from './PastilleTransporteur.jsx';
import './styles-frise-vente.css';

const Coche = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true" focusable="false"><path d="M3.5 8.4 6.6 11.3 12.5 4.9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const Fourche = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M4 2v5.5a3 3 0 0 0 3 3h5M9.5 8l2.8 2.5L9.5 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

const ETAT_LU = { fait: 'prouvée', paslu: 'pas lu', geste: 'à faire' };

// frise : la sortie de `friseProuvee` ; transporteur : { cle, nom } (la règle de
// la pastille) ; verse : 'date' | 'oui' | 'non' | null (l'état du versement,
// gardé sur l'étape « Versée » pour les bancs qui le lisent) ; cle : la transaction.
export default function FriseVente({ frise, transporteur = null, verse = null, cle = '', bordereau = null }) {
  if (!frise || !Array.isArray(frise.etapes) || !frise.etapes.length) return null;
  const { etapes, bifurcation: bif, derniere } = frise;
  const n = etapes.length;
  const logo = transporteur && transporteur.cle ? <LogoTransporteur cle={transporteur.cle} taille={16}/> : null;
  // Horizontale : sous l'étape où la vente bifurque, centrée sur 3 colonnes (calée au bord aux extrémités).
  const debut = bif ? Math.max(1, Math.min(n - 2, bif.apres)) : 1;
  const cale = !bif ? 'center' : debut === bif.apres ? 'center' : debut > bif.apres ? 'start' : 'end';
  const bifLi = bif ? (
    <li key="bif" className="vrm-frv-bif" data-frv-bifurcation={bif.genre} data-frv-ton={bif.geste ? 'geste' : 'neutre'}
      style={{ gridRow: 2, gridColumn: `${debut} / span 3`, justifySelf: cale }}>
      <span className="vrm-frv-bif-icone"><Fourche/></span>
      <span className="vrm-frv-texte"><span className="vrm-frv-nom">{bif.libelle}</span>{bif.sous ? <span className="vrm-frv-sous">{bif.sous}</span> : null}</span>
    </li>
  ) : null;
  return (
    <div className="vrm-frv" data-recap-frise="" data-frise-prouvee={cle || ''} data-recap-bordereau={bordereau == null ? undefined : bordereau ? '1' : '0'} data-frv-bif={bif ? bif.genre : undefined}>
      <ol className="vrm-frv-liste" aria-label="Où en est la vente" style={{ '--frv-n': n }}>
        {bif && bif.apres < 0 ? bifLi : null}
        {etapes.map((e, i) => {
          const sous = sousEtape(e);
          const li = (
            <li key={e.cle} className="vrm-frv-etape" data-frv-etape={e.cle} data-frv-etat={e.etat} data-fait={e.etat === 'fait' ? '1' : '0'}
              data-frv-t={e.t != null ? String(e.t) : ''} data-frv-cours={e.cours ? '' : undefined} data-frv-apres-bif={e.apresBif ? '' : undefined}
              data-frv-derniere={i === derniere ? '' : undefined} data-frv-source={e.source || undefined}
              data-recap-verse={e.cle === 'versee' && verse ? verse : undefined}
              aria-current={e.cours ? 'step' : undefined}
              title={e.etat === 'fait' && e.source && !/^(transaction|vinted|email|extension|versement|transporteur)$/.test(e.source) ? e.source : undefined}
              style={{ gridRow: 1, gridColumn: i + 1 }}>
              <span className="vrm-frv-point" aria-hidden="true">{e.etat === 'fait' ? <Coche/> : null}</span>
              <span className="vrm-frv-texte">
                <span className="vrm-frv-nom">{e.label}{e.cle === 'enroute' && logo ? <span className="vrm-frv-logo" data-frv-transporteur={transporteur.cle} title={transporteur.nom || undefined}>{logo}</span> : null}</span>
                <span className="vrm-frv-sous">{sous}</span>
              </span>
              <span className="vrm-sr">{` — ${ETAT_LU[e.etat] || ''}`}</span>
            </li>
          );
          return bif && bif.apres === i ? [li, bifLi] : li;
        })}
      </ol>
    </div>
  );
}
