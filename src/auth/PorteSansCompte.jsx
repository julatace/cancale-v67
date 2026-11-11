import React from 'react';
import { nomFournisseur } from './compteNeuf.js';
// (11 nov., lot DJ6) « Continuer avec Discord » a fait créer un compte que personne
// n'a voulu : on demande au serveur de l'annuler (`?mode=oauth-sans-compte`, qui
// refait toutes les preuves). Annulé ⇒ l'écran de connexion le dit (onAnnule).
// Refusé ou pas su ⇒ la porte d'avant, où il choisit (onRepli) — rien n'est deviné.
export default function PorteSansCompte({ fournisseur, theme: C, entetes, onAnnule, onRepli, fetcher }) {
  const fini = React.useRef(false);
  React.useEffect(() => {
    if (fini.current) return;
    fini.current = true;
    (async () => {
      let ok = false;
      try {
        const r = await (fetcher || fetch)('/api/compte?mode=oauth-sans-compte', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(entetes ? entetes() : {}) }, body: '{}' });
        const j = await r.json().catch(() => null);
        ok = r.ok && !!(j && j.annule === true);
      } catch (_) { ok = false; }
      if (ok) onAnnule(); else onRepli();
    })();
  }, []);
  return <div data-porte-sans-compte={fournisseur} role="status" aria-live="polite" style={{ minHeight: '100vh', background: C.bg, color: C.muted, display: 'grid', placeItems: 'center', fontSize: 15, padding: 16 }}>
    Vérification de ton compte {nomFournisseur(fournisseur)}…
  </div>;
}
