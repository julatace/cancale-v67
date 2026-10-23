// ══════════════════════════════════════════════════════════════════════════════
// UNE LIGNE NEUTRE MODIFIÉE PAR COMPARER-ET-ÉCHANGER (22 octobre)
// ══════════════════════════════════════════════════════════════════════════════
// Les compteurs qui protègent la boîte VRM (preuve d'adresse) vivent sous le
// propriétaire NEUTRE : aucune session ne peut les lire ni les écrire (RLS).
// Lire, décider, puis écrire ENTIER laisse passer des demandes simultanées —
// trente requêtes en parallèle lisaient toutes « 0 » et passaient toutes (revue
// du 22 octobre, reproduit). Chaque écriture est donc CONDITIONNELLE sur la
// version lue (`data->>rev`) : Postgres réévalue le filtre après avoir pris le
// verrou de la ligne, un écrivain devancé reçoit 0 ligne, relit et recommence.
// Une ligne absente se crée par une INSERTION sans fusion : 409 ⇒ un autre l'a
// créée entre-temps, on relit. Même motif que `modifierDonnee` (api/_lib/ebay.js).
//
// `decider(data | null)` rend `{ data, valeur }` (écrire `data`, rendre `valeur`)
// ou `{ valeur }` sans `data` (rien à écrire). La fonction rend `{ valeur }`, ou
// `null` = « pas su » (base muette, ou trop d'écrivains à la fois) : l'appelant
// n'agit pas.
import { sbCle } from './cle.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';

const SUPABASE_URL = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';

export async function modifierNeutre(id, decider, { essais = 12 } = {}) {
  const cle = process.env.SUPABASE_SERVICE_KEY || '';
  if (!cle || !/^[a-z0-9_]+$/i.test(String(id || ''))) return null;
  const base = `${SUPABASE_URL()}/rest/v1/app_data`;
  const filtre = `owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${id}`;
  const lecture = { ...sbCle(cle) };
  const ecriture = { ...sbCle(cle), 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    let rows;
    try {
      const r = await fetch(`${base}?${filtre}&select=data`, { headers: lecture });
      if (!r.ok) return null;
      rows = await r.json();
    } catch (_) { return null; }
    if (!Array.isArray(rows)) return null;
    const present = !!rows[0];
    const d = present ? (rows[0].data || {}) : null;
    const choix = decider(d);
    if (!choix || choix.data === undefined) return { valeur: choix ? choix.valeur : undefined };
    const rev0 = d && Number.isSafeInteger(d.rev) && d.rev >= 0 ? d.rev : null;
    const data = { ...choix.data, rev: (rev0 == null ? 0 : rev0) + 1 };
    try {
      if (!present) {
        const w = await fetch(base, { method: 'POST', headers: { ...ecriture, Prefer: 'return=minimal' }, body: JSON.stringify([{ owner: PROPRIETAIRE_NEUTRE, id, data }]) });
        if (w.ok) return { valeur: choix.valeur };
        if (w.status !== 409) return null;            // créée entre-temps : on relit
      } else {
        const cond = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;
        const w = await fetch(`${base}?${filtre}&${cond}&select=id`, { method: 'PATCH', headers: { ...ecriture, Prefer: 'return=representation' }, body: JSON.stringify({ data }) });
        if (!w.ok) return null;
        const out = await w.json().catch(() => null);
        if (!Array.isArray(out)) return null;
        if (out.length >= 1) return { valeur: choix.valeur };
      }
    } catch (_) { return null; }
    // Devancé : une attente FIXE et courte (notre base, pas Vinted — §3 ne
    // s'applique pas), puis on relit.
    await new Promise((ok) => setTimeout(ok, 20 * (n + 1)));
  }
  return null;
}
