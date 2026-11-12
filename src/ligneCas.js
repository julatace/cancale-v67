// ════════════════════════════════════════════════════════════════════════════
//  UNE LIGNE `app_data` MODIFIÉE PAR COMPARER-ET-ÉCHANGER (11 nov., revue de
//  robustesse, points 3 et 4)
//
//  `vrm_room` (la pièce, les meubles, la case de chaque N°) et `vrm_email_owners`
//  (les adresses qui décident à quel vendeur va un e-mail) étaient réécrites EN
//  ENTIER depuis l'état lu à l'ouverture de l'écran, sans version : la sortie
//  automatique d'une paire partie et un geste dans la pièce s'écrasaient l'un
//  l'autre ; une adresse ajoutée sur un autre appareil disparaissait (ses e-mails
//  partaient en quarantaine).
//  Désormais (§5 « Lectures et écritures ») : on RELIT la ligne, on applique la
//  modification à ce qu'on vient de lire (`modifier(actuel)`), et on écrit
//  seulement si `data.rev` n'a pas bougé (PATCH conditionnel ; insertion sans
//  fusion si la ligne n'existe pas). Devancé ⇒ on relit et on recommence. Une
//  lecture ratée n'écrit RIEN.
//
//  Module PUR (le `fetch` et les en-têtes sont passés) : exécuté tel quel par
//  `scripts/audit-robustesse-donnees.cjs`.
// ════════════════════════════════════════════════════════════════════════════

import { fusion3, egal } from './fusionNuage.js';

const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const revDe = (d) => (estObjet(d) && Number.isSafeInteger(d.rev) && d.rev >= 0 ? d.rev : null);

// `modifier(actuel)` reçoit la donnée relue (`null` = pas de ligne) et rend la
// nouvelle donnée, ou `undefined` (rien à écrire). Rend { ok, data } ou
// { ok:false, raison: 'lecture' | 'ecriture' | 'devance', statut?, texte? }.
// (12 nov.) `select` / `deLigne` : une ligne LOURDE se relit PROJETÉE (§4.4) — ex.
// `ebay_brouillons` : `select: 'items:data->items,rev:data->rev'`, `deLigne: (r) => ({ items: r.items, rev: r.rev })`.
export async function modifierLigneCas({ base, id, entetes, modifier, filtre = '', estampille = (o) => o, essais = 5, fetch: f = fetch, select = 'data', deLigne = (row) => row.data }) {
  const enc = encodeURIComponent(id);
  for (let i = 0; i < essais; i++) {
    let rows;
    try {
      const r = await f(`${base}/rest/v1/app_data?id=eq.${enc}${filtre}&select=${select}`, { headers: entetes(), cache: 'no-store' });
      if (!r.ok) return { ok: false, raison: 'lecture', statut: r.status };
      rows = await r.json();
    } catch (_) { return { ok: false, raison: 'lecture' }; }
    if (!Array.isArray(rows) || rows.length > 1) return { ok: false, raison: 'lecture' };
    const existe = rows.length === 1;
    const actuel = existe ? deLigne(rows[0]) : null;
    const neuf = modifier(actuel == null ? null : JSON.parse(JSON.stringify(actuel)));
    if (neuf === undefined) return { ok: true, data: actuel, inchange: true };
    const rev = revDe(actuel);
    const data = { ...neuf, rev: (rev == null ? 0 : rev) + 1 };
    let r;
    try {
      if (existe) {
        const cond = rev == null ? 'is.null' : `eq.${rev}`;
        r = await f(`${base}/rest/v1/app_data?id=eq.${enc}${filtre}&data->>rev=${cond}`, { method: 'PATCH', headers: entetes({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ data, updated_at: new Date().toISOString() }) });
      } else {
        r = await f(`${base}/rest/v1/app_data`, { method: 'POST', headers: entetes({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(estampille({ id, data })) });
        if (r.status === 409) continue;                    // créée entre-temps ailleurs : on relit
      }
    } catch (_) { return { ok: false, raison: 'ecriture' }; }
    if (!r.ok) { let texte = ''; try { texte = await r.text(); } catch (_) {} return { ok: false, raison: 'ecriture', statut: r.status, texte }; }
    let ecrites = null; try { ecrites = await r.json(); } catch (_) { ecrites = null; }
    if (Array.isArray(ecrites) && ecrites.length === 0) continue;   // devancé : relire, refaire
    return { ok: true, data };
  }
  return { ok: false, raison: 'devance' };
}

// ── Écrire PAR DIFFÉRENCE (12 nov., revue de robustesse, points 18 et 21) ────
// Un écran qui a LU une ligne de réglages (`push_prefs`, `vrm_pro_facture`) et
// la montre : il n'y pose que CE QU'IL A CHANGÉ (de `avant` à `apres`), sur la
// ligne RELUE à l'instant, par comparer-et-échanger. Un réglage changé ailleurs
// entre-temps (autre appareil, Ma configuration, Ma facture) reste. Rien changé
// ici ⇒ rien écrit. Rend ce que rend `modifierLigneCas` (`data` = la ligne écrite).
export function ecrireDifference({ avant, apres, ...o }) {
  return modifierLigneCas({ ...o, modifier: (actuel) => {
    if (egal(avant, apres)) return undefined;
    const lu = estObjet(actuel) ? actuel : {};
    const out = fusion3(estObjet(avant) ? avant : {}, estObjet(apres) ? apres : {}, lu);
    return estObjet(out) ? out : {};
  } });
}
