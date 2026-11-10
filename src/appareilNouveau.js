// ── « NOUVEL APPAREIL » — la demande de l'app (10 nov., lot H) ────────────────
// À chaque ouverture de VRM (une fois par session de CE navigateur et par
// vendeur), l'app demande au serveur de relire SES sessions
// (`POST /api/compte?mode=appareils {action:'verifier'}`, api/_lib/appareil-nouveau.js).
// C'est le serveur qui décide et alerte ; ici, on ne fait que demander. Une
// réponse ratée n'est pas notée : la prochaine ouverture redemande.
export const CLE_VERIF_APPAREIL = 'vrm_appareil_verifie';
export async function verifierAppareilUneFois({ uid, enTete, stockage, fetch: f }) {
  if (!uid || typeof f !== 'function') return 'rien';
  const cle = `${CLE_VERIF_APPAREIL}_${uid}`;
  try { if (stockage && stockage.getItem(cle)) return 'deja'; } catch (_) {}
  try {
    const r = await f('/api/compte?mode=appareils', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(enTete || {}) }, body: JSON.stringify({ action: 'verifier' }) });
    if (!r || !r.ok) return 'pas-su';
    // Seule la réponse de la route compte (une page HTML de repli n'est pas un « fait »).
    const j = await r.json().catch(() => null);
    if (!j || j.ok !== true) return 'pas-su';
    try { if (stockage) stockage.setItem(cle, String(Date.now())); } catch (_) {}
    return 'fait';
  } catch (_) { return 'pas-su'; }
}
// La session qu'une notification « Nouvel appareil » désigne (`?session=`), gardée le
// temps d'ouvrir Paramètres → Appareils connectés.
export const DEMANDE_APPAREIL = { session: null };
export const sessionValide = (s) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '')) ? String(s) : null);
