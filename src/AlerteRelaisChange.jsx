// ════════════════════════════════════════════════════════════════════════════
//  « POINT RELAIS CHANGÉ » (10 nov., validée par Julien ; refaite le 12 nov.)
//  Un colis redirigé par le transporteur (« Votre colis a changé de plan ») : il
//  n'est PAS arrivé, il roule vers un autre point. Le nouveau point est celui LU
//  dans l'e-mail (src/relaisChange.js) ; jamais un point deviné.
//  (12 nov., Julien sur capture : « rien n'est cohérent ») UNE carte par nouveau
//  point (« 3 colis changent de point relais → … »), chaque colis (son n°, son
//  ancien point, son CODE copiable — 11 nov., retraits fiables) en dépli ; la
//  carte est NEUTRE (§7 : pas de rose ni de rouge), seul le titre est ambre quand
//  il y a un geste (aller au nouveau point). Point pas lu ⇒ « nouveau point pas
//  encore lu » et « Voir l'e-mail » quand l'e-mail source est connu — jamais
//  « pas écrit dans l'e-mail » sans preuve.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import PastilleTransporteur from './PastilleTransporteur.jsx';
import { transporteurDuColis } from './transporteursVisuels.js';
import { colisRelaisChange, groupesRelaisChange, lienItineraire, appareilApple } from './relaisChange.js';
import VoirEmailColis from './VoirEmailColis.jsx';

export default function AlerteRelaisChange({ lignes, C, transp = null, headers = null }) {
  const liste0 = colisRelaisChange(lignes, { transp });
  const [copie, setCopie] = React.useState('');
  if (!liste0 || !liste0.length) return null;
  const liste = liste0.map((x) => ({ ...x, ancienNom: x.ancienLieu ? String(x.ancienLieu).split(',')[0].trim() : '' }));
  const apple = appareilApple();
  const groupes = groupesRelaisChange(liste);
  return (
    <div className="vrm-relais-change" data-relais-change={liste.length} data-relais-change-groupes={groupes.length} style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
      {groupes.map((g) => {
        const n = g.colis.length;
        const lien = g.lieu ? lienItineraire(g.lieu, apple) : '';
        const t = transporteurDuColis({ declare: g.colis[0].carrier, suivi: g.colis[0].suivi });
        const titre = `${n > 1 ? `${n} colis changent` : '1 colis change'} de point relais${g.lieu ? '' : ' · nouveau point pas encore lu'}`;
        return (
          <div key={g.cle || 'pas-lu'} data-relais-change-groupe={g.cle || 'pas-lu'} data-relais-change-n={n} role="status"
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: `1px solid ${C.border}`, background: C.card, borderRadius: 14, padding: '10px 12px' }}>
            <PastilleTransporteur t={t} C={C} seul taille={22}/>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div data-relais-change-titre="" style={{ fontSize: 14, fontWeight: 700, color: g.lieu ? C.warn : C.text }}>{titre}</div>
              {g.lieu ? (
                <div data-relais-change-lieu="" style={{ fontSize: 13, color: C.text, marginTop: 4, lineHeight: 1.35 }}>
                  → <strong style={{ fontWeight: 650 }}>{g.nom}</strong>{g.adresse ? <>, {g.adresse}</> : null}
                </div>
              ) : null}
              <details className="vrm-repli" data-relais-change-detail="" open={n === 1} style={{ marginTop: 4 }}>
                <summary style={{ fontSize: 12, color: C.muted, minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>En route{n > 1 ? ` · ${n} colis, leurs codes` : ' · son code'}</summary>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {g.colis.map((x) => (
                    <li key={x.suivi} data-relais-change-suivi={x.suivi} style={{ fontSize: 12, color: C.muted }}>
                      <div>Colis {x.suivi}{x.ancienNom ? <span data-relais-change-ancien=""> · avant : {x.ancienNom}</span> : null}</div>
                      {/* (11 nov., retraits fiables) LE CODE de ce colis, en grand, copiable — celui de l'e-mail du
                          changement, sinon celui d'un autre e-mail du même n° ; sinon « code pas encore reçu ». */}
                      {x.code ? (
                        <button type="button" data-relais-change-code={x.code} data-relais-change-code-de={x.codeDe} aria-label={`Copier le code ${x.code}`}
                          onClick={() => { try { navigator.clipboard && navigator.clipboard.writeText(x.code); } catch (_) {} setCopie(x.suivi); }}
                          style={{ marginTop: 4, minHeight: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 22, fontWeight: 700, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums', cursor: 'pointer' }}>
                          {copie === x.suivi ? 'Copié' : x.code}
                        </button>
                      ) : <div data-relais-change-code="" data-relais-change-code-de={x.codeDe || ''} style={{ marginTop: 2 }}>{x.codeDe === 'a-confirmer' ? 'Code à confirmer : le seul reçu date d’avant le changement de point' : 'Code pas encore reçu'}</div>}
                      {!x.lieu && x.emailRecu ? <VoirEmailColis id={x.emailRecu} headers={headers}/> : null}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            {lien ? (
              <a href={lien} target="_blank" rel="noreferrer" data-relais-change-itineraire="" aria-label={`Itinéraire vers ${g.nom || 'le nouveau point'}`}
                style={{ flexShrink: 0, alignSelf: 'center', display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 14px', borderRadius: 999, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Itinéraire
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
