// ── L'ÉTAT DES COMPTES VINTED (`panel_comptes_etat`), UNE LECTURE EN VOL ─────────────
// (11 nov., intégration 11nov-f) « Santé des comptes » (src/SanteComptes.jsx) et « Tout va
// bien ? » (src/ToutVaBien.jsx) lisaient la même petite projection au même moment, au
// démarrage de Ma journée : deux requêtes identiques (budget-vitesse). Une seule part, la même
// réponse pour les deux, et seulement tant qu'elle est EN COURS (rien n'est gardé après : la
// suivante relit). Trois états : null = pas su (lecture ratée) · {} = rien de rangé · l'objet.
// Une réponse LUE sert encore 20 s (le démarrage d'un écran relit la même ligne à quelques
// secondes d'écart : « Tout va bien ? » se relance quand la base répond) ; un « pas su » jamais.
import { SUPABASE_URL, sbAuth } from './App.jsx';

let enVol = null, lu = null;
const GARDE_MS = 20000;
export function lireEtatsComptes() {
  if (enVol) return enVol;
  if (lu && Date.now() - lu.at < GARDE_MS) return Promise.resolve(lu.v);
  const p = (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_comptes_etat&select=c:data->comptes`, { headers: sbAuth(), cache: 'no-store' });
      if (!r.ok) return null;
      const rows = await r.json();
      return Array.isArray(rows) ? ((rows[0] && rows[0].c && typeof rows[0].c === 'object') ? rows[0].c : {}) : null;
    } catch (_) { return null; }
  })().then((v) => { if (v !== null) lu = { v, at: Date.now() }; return v; }).finally(() => { if (enVol === p) enVol = null; });
  enVol = p; return p;
}
