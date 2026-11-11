// ── UNE LIGNE DÉDIÉE, ÉCRITE EN COMPARER-ET-ÉCHANGER (11 nov., lot republier-programme) ──
// Le motif d'`ecrireEmailsLus` (src/emailsLusEcriture.js), rendu commun : RELIRE la
// ligne, appliquer `modifier(data)` dessus, écrire gardé par `data.rev` ; un autre
// appareil a écrit entre-temps ⇒ on relit et on rejoue (5 essais).
// ⚠️ Une lecture ratée n'écrit RIEN (§5 : « lecture KO, écriture OK » est le cas qui
//    détruit) : rend `null`. `modifier` rend l'objet à écrire, ou `undefined` (rien).
// ctx : { url, entetes, avecOwner, owner, cloisonne, fetcher }.
// Rend `{ ok: true, data }` (écrit) · `{ ok: false, data }` (rien à écrire) · `null` (pas su).

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

export async function lireLigne(id, ctx) {
  const { url, entetes, owner, cloisonne, fetcher = fetch } = ctx || {};
  if (!owner || !id) return null;
  const moi = cloisonne ? `&owner=eq.${encodeURIComponent(owner)}` : '';
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}${moi}&select=id,data&limit=1`, { headers: entetes(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    return { existe: !!j[0], data: j[0] ? objet(j[0].data) || {} : null };
  } catch (_) { return null; }
}

export async function modifierLigne(id, modifier, ctx, essais = 5) {
  const { url, entetes, avecOwner, owner, cloisonne, fetcher = fetch } = ctx || {};
  if (!owner || !id) return null;
  const moi = cloisonne ? `&owner=eq.${encodeURIComponent(owner)}` : '';
  for (let n = 0; n < essais; n++) {
    const lu = await lireLigne(id, ctx);
    if (!lu) return null;
    const cur = lu.data;
    const rev = cur && Number.isSafeInteger(cur.rev) && cur.rev >= 0 ? cur.rev : null;
    const nouveau = modifier(cur ? JSON.parse(JSON.stringify(cur)) : null);
    if (nouveau === undefined) return { ok: false, data: cur };
    const data = { ...nouveau, rev: (rev || 0) + 1 };
    try {
      if (!lu.existe) {
        const r = await fetcher(`${url}/rest/v1/app_data`, { method: 'POST', headers: { ...entetes(), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify([avecOwner({ id, data })]) });
        if (r.ok) return { ok: true, data };
        if (r.status !== 409) return null;
        continue;   // un autre appareil l'a créée : on relit et on rejoue
      }
      const garde = rev === null ? 'data->>rev=is.null' : `data->>rev=eq.${rev}`;
      const r = await fetcher(`${url}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}${moi}&${garde}&select=id`, { method: 'PATCH', headers: { ...entetes(), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }) });
      if (!r.ok) return null;
      const j = await r.json().catch(() => null);
      if (Array.isArray(j) && j.length === 1) return { ok: true, data };
      // 0 ligne : la garde a refusé (quelqu'un a écrit) ⇒ on relit et on rejoue.
    } catch (_) { return null; }
  }
  return null;
}
