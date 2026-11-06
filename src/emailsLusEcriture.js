// ── ÉCRIRE « LU / NON LU » D'UN E-MAIL (6 nov., v36) ────────────────────────
// La règle est api/_lib/emails-lus.js (la même que la route qui la relit). Ici,
// seulement l'écriture, sur SON geste (ouvrir un e-mail, « Marquer non lu »,
// « Tout marquer lu ») — le même schéma que les notifications lues
// (`ecrireLuNotifs`, App.jsx) : RELIRE la ligne, rejouer SES gestes dessus
// (`appliquerGestes`), écrire en comparer-et-échanger sur `data.rev` ; trois
// essais. Deux appareils en même temps : aucun geste de l'un n'efface l'autre.
// ⚠️ Une lecture ratée n'écrit RIEN (§5 « lecture KO, écriture OK » est le cas
//    qui détruit) : rend `false`, l'écran garde le geste affiché et le redira.
import { LUS_ID, appliquerGestes } from '../api/_lib/emails-lus.js';

export async function ecrireEmailsLus(gestes, { url, entetes, avecOwner, owner, cloisonne, fetcher = fetch }) {
  if (!owner || !Array.isArray(gestes) || !gestes.length) return false;
  const moi = cloisonne ? `&owner=eq.${encodeURIComponent(owner)}` : '';
  for (let essai = 0; essai < 3; essai++) {
    let ligne;
    try {
      const r = await fetcher(`${url}/rest/v1/app_data?id=eq.${LUS_ID}${moi}&select=id,data&limit=1`, { headers: entetes(), cache: 'no-store' });
      if (!r.ok) return false;
      const j = await r.json();
      if (!Array.isArray(j)) return false;
      ligne = j[0] || null;
    } catch (_) { return false; }
    const cur = ligne && ligne.data && typeof ligne.data === 'object' ? ligne.data : null;
    const rev = cur && Number.isSafeInteger(cur.rev) ? cur.rev : null;
    const data = { ...appliquerGestes(cur || undefined, gestes), rev: (rev || 0) + 1 };
    try {
      if (!ligne) {
        const r = await fetcher(`${url}/rest/v1/app_data`, { method: 'POST', headers: { ...entetes(), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify([avecOwner({ id: LUS_ID, data })]) });
        if (r.ok) return true;
        if (r.status !== 409) return false;
        continue;   // un autre appareil l'a créée : on relit et on rejoue
      }
      const garde = rev === null ? 'data->>rev=is.null' : `data->>rev=eq.${rev}`;
      const r = await fetcher(`${url}/rest/v1/app_data?id=eq.${LUS_ID}${moi}&${garde}&select=id`, { method: 'PATCH', headers: { ...entetes(), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }) });
      if (!r.ok) return false;
      const j = await r.json().catch(() => null);
      if (Array.isArray(j) && j.length === 1) return true;
    } catch (_) { return false; }
  }
  return false;
}
