// ═══════════════════════════════════════════════════════════════════════════
// L'AVIS DE L'ACHETEUR, DANS LE RÉCAP D'UNE VENTE (10 nov., lot U)
// ═══════════════════════════════════════════════════════════════════════════
// La règle : src/avisVente.js (relié par n° de transaction SEULEMENT). Une ligne
// des « Détails » du récapitulatif, lue à l'ouverture : les avis du compte de la
// vente (≤ 20, une projection, jamais `select=data`), gardés pour la session.
// Avis pas lus ⇒ aucune ligne (rien promis). ⚠️ Aucun rappel d'évaluation.
import React from 'react';
import { avisDeLaVente } from './avisVente.js';

const cache = new Map();   // uid → Promise<tableau | null>
export const viderCacheAvis = () => cache.clear();

function Etoiles({ n }) {
  return (
    <span role="img" aria-label={`${n} sur 5`} data-avis-vente-note={n} style={{ letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden="true" style={{ opacity: i <= n ? 1 : 0.25 }}>★</span>)}
    </span>
  );
}

export default function AvisVente({ uid, tx, lire }) {
  const u = String(uid || '');
  const [avis, setAvis] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    if (!u || typeof lire !== 'function') { setAvis(null); return undefined; }
    if (!cache.has(u)) cache.set(u, Promise.resolve().then(() => lire(u)).catch(() => null));
    cache.get(u).then((r) => { if (vivant) setAvis(Array.isArray(r) ? r : null); });
    return () => { vivant = false; };
  }, [u, lire]);
  const r = avisDeLaVente(tx, avis);
  if (r.etat === 'encours' || r.etat === 'pasLu') return null;
  return (
    <div className="vrm-recap-ligne" data-avis-vente={r.etat}>
      <dt>Avis reçu</dt>
      <dd>
        {r.etat === 'relie' ? <><Etoiles n={r.note}/>{r.texte ? <small> « {r.texte.length > 90 ? r.texte.slice(0, 89).trimEnd() + '…' : r.texte} »</small> : null}</>
          : r.etat === 'aucun' ? 'pas dans les derniers avis lus'
          : 'pas relié : Vinted ne dit pas quelle vente il note'}
      </dd>
    </div>
  );
}
