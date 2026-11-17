// ════════════════════════════════════════════════════════════════════════════
//  LES ALERTES « AVIS BAS » LUES UNE FOIS POUR DEUX LECTEURS (17 nov., fiabilité-vitesse)
//  Ma journée (la carte « Avis 2★ reçu », App.jsx `lireAvisBas`) et la santé des comptes
//  (src/SanteComptes.jsx) lisaient la MÊME adresse (`vrm_avis_bas`, projection des alertes) à
//  quelques secondes d'écart — hors de la fenêtre de 2 s du partage des lectures : mesuré au banc
//  budget-vitesse (main 1a4eb65), « NOUVELLE lecture en double (×2) » à chaque ouverture.
//  ⇒ Une lecture partagée, gardée au plus `GARDE_MS`. Jamais un échec gardé (« pas su » reste
//  « pas su » : la lecture suivante réessaie) ; un signal de l'extension (`vrm:ext`) ou une
//  écriture de l'app oublie la copie (le serveur range une alerte après une lecture d'avis faite
//  par l'extension : son signal est justement ce qui fait relire).
// ════════════════════════════════════════════════════════════════════════════
import { LIGNE_AVIS_BAS } from './avisNegatif.js';

export const ADRESSE_AVIS_BAS = `app_data?id=eq.${LIGNE_AVIS_BAS}&select=a:data->alertes`;
export const GARDE_MS = 60000;
let copie = null;   // { at, p }

export function oublierAvisBas() { copie = null; }
// `get(adresse)` : le lecteur de l'appelant (une liste, ou null si la lecture a raté).
export function lireAlertesAvisBas(get, maintenant = Date.now()) {
  if (copie && maintenant - copie.at < GARDE_MS) return copie.p;
  const moi = { at: maintenant, p: null };
  moi.p = Promise.resolve().then(() => get(ADRESSE_AVIS_BAS)).then((r) => { if (r == null && copie === moi) copie = null; return r; }, () => { if (copie === moi) copie = null; return null; });
  copie = moi;
  return moi.p;
}
if (typeof window !== 'undefined') {
  try { window.addEventListener('vrm:ext', oublierAvisBas); } catch (_) {}
}
