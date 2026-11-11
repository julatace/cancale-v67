// ════════════════════════════════════════════════════════════════════════════
//  « POINT RELAIS CHANGÉ » — l'alerte AMBRE (10 nov., validée par Julien)
//  Un colis redirigé par le transporteur (« Votre colis a changé de plan ») : il
//  n'est PAS arrivé, il roule vers un autre point. Ambre = un geste à faire (§7) :
//  aller ailleurs que prévu. Le nouveau point est celui LU dans l'e-mail
//  (src/relaisChange.js) ; sans adresse lue, on le dit — jamais un point deviné.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import PastilleTransporteur from './PastilleTransporteur.jsx';
import { transporteurDuColis } from './transporteursVisuels.js';
import { colisRelaisChange, lienItineraire, appareilApple } from './relaisChange.js';

export default function AlerteRelaisChange({ lignes, C, transp = null }) {
  const liste0 = colisRelaisChange(lignes, { transp });
  const [copie, setCopie] = React.useState('');
  if (!liste0 || !liste0.length) return null;
  const liste = liste0.map((x) => ({ ...x, ancienNom: x.ancienLieu ? String(x.ancienLieu).split(',')[0].trim() : '' }));
  const apple = appareilApple();
  return (
    <div className="vrm-relais-change" data-relais-change={liste.length} style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
      {liste.map((x) => {
        const t = transporteurDuColis({ declare: x.carrier, suivi: x.suivi });
        const lien = x.lieu ? lienItineraire(x.lieu, apple) : '';
        return (
          <div key={x.suivi} data-relais-change-suivi={x.suivi} role="status"
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: `1px solid ${C.warn}`, background: `${C.warn}12`, borderRadius: 14, padding: '10px 12px' }}>
            <PastilleTransporteur t={t} C={C} seul taille={22}/>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.warn }}>Point relais changé</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Colis {x.suivi} · en route</div>
              {x.lieu ? (
                <div data-relais-change-lieu="" style={{ fontSize: 13, color: C.text, marginTop: 4, lineHeight: 1.35 }}>
                  <strong style={{ fontWeight: 650 }}>{x.nom}</strong>{x.adresse ? <><br/>{x.adresse}</> : null}
                </div>
              ) : (
                <div data-relais-change-lieu="absent" style={{ fontSize: 13, color: C.text, marginTop: 4 }}>Le nouveau point n'est pas écrit dans l'e-mail : regarde l'e-mail du transporteur.</div>
              )}
              {x.ancienNom ? <div data-relais-change-ancien="" style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Avant : {x.ancienNom}</div> : null}
              {/* (11 nov., retraits fiables) LE CODE de ce colis, en grand, copiable — celui de l'e-mail du
                  changement, sinon celui d'un autre e-mail du même n° ; sinon « code pas encore reçu ». */}
              {x.code ? (
                <button type="button" data-relais-change-code={x.code} data-relais-change-code-de={x.codeDe} aria-label={`Copier le code ${x.code}`}
                  onClick={() => { try { navigator.clipboard && navigator.clipboard.writeText(x.code); } catch (_) {} setCopie(x.suivi); }}
                  style={{ marginTop: 6, minHeight: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 22, fontWeight: 700, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums', cursor: 'pointer' }}>
                  {copie === x.suivi ? 'Copié' : x.code}
                </button>
              ) : <div data-relais-change-code="" data-relais-change-code-de={x.codeDe || ''} style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{x.codeDe === 'a-confirmer' ? 'Code à confirmer : le seul reçu date d’avant le changement de point' : 'Code pas encore reçu'}</div>}
            </div>
            {lien ? (
              <a href={lien} target="_blank" rel="noreferrer" data-relais-change-itineraire="" aria-label={`Itinéraire vers ${x.nom || 'le nouveau point'}`}
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
