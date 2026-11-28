// ── src/crm/HoteFicheAcheteur.jsx — l'hôte de la fiche acheteur, posé UNE fois par App.jsx ───────────
// Une vente, une conversation, n'importe quel écran ouvre la fiche par `ouvrirFicheAcheteur(...)`
// (src/crm/api.js) : l'hôte l'affiche, chargée à la demande (rien ne pèse au démarrage).
import React from 'react';
import { EVENEMENT_FICHE } from './api.js';

const FicheAcheteur = React.lazy(() => import('./FicheAcheteur.jsx'));

export default function HoteFicheAcheteur({ headers, confirm }) {
  const [c, setC] = React.useState(null);
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.acheteur) setC({ ...d, k: Date.now() }); };
    window.addEventListener(EVENEMENT_FICHE, f);
    return () => window.removeEventListener(EVENEMENT_FICHE, f);
  }, []);
  if (!c) return null;
  return <React.Suspense fallback={null}>
    <FicheAcheteur key={c.k} acheteur={c.acheteur} compte={c.compte || 'principal'} headers={headers} confirm={confirm} ouverte onFermer={() => setC(null)} ecrireAuDepart={c.ecrire}/>
  </React.Suspense>;
}
