// ── L'ÉTAT DES COMPTES VINTED (`panel_comptes_etat`), UNE LECTURE EN VOL ─────────────
// (11 nov., intégration 11nov-f) « Santé des comptes » (src/SanteComptes.jsx) et « Tout va
// bien ? » (src/ToutVaBien.jsx) lisaient la même petite projection au même moment, au
// démarrage de Ma journée : deux requêtes identiques (budget-vitesse). Une seule part, la même
// réponse pour les deux, et seulement tant qu'elle est EN COURS (rien n'est gardé après : la
// suivante relit). Trois états : null = pas su (lecture ratée) · {} = rien de rangé · l'objet.
import { SUPABASE_URL, sbAuth } from './App.jsx';

let enVol = null;
export function lireEtatsComptes() {
  if (enVol) return enVol;
  const p = (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_comptes_etat&select=c:data->comptes`, { headers: sbAuth(), cache: 'no-store' });
      if (!r.ok) return null;
      const rows = await r.json();
      return Array.isArray(rows) ? ((rows[0] && rows[0].c && typeof rows[0].c === 'object') ? rows[0].c : {}) : null;
    } catch (_) { return null; }
  })().finally(() => { if (enVol === p) enVol = null; });
  enVol = p; return p;
}
