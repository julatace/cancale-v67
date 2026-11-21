// ════════════════════════════════════════════════════════════════════════════
// LE NUMÉRO D'UNE FACTURE SAISIE, RÉSERVÉ EN BASE (12 nov., revue fin — métier moy. 11)
// ════════════════════════════════════════════════════════════════════════════
// `prochainNumeroFacture` (src/factureNumero.js) calcule le suivant sur ce que CET
// appareil connaît : deux appareils qui créent une facture au même moment
// prenaient le même numéro (deux factures différentes sous un n°).
// Ici le numéro est RÉSERVÉ dans la ligne `vrm_factures_compteur` du vendeur, par
// comparer-et-échanger sur `data.rev` : lire → suivant = max(ligne, compteur local,
// liste) + 1 → écrire seulement si la ligne n'a pas bougé ; devancé ⇒ on relit.
// Deux appareils simultanés : l'un écrit 2026-000041, l'autre relit et prend 000042.
// « Pas su » (lecture ou écriture ratée, hors ligne) ⇒ null : AUCUNE facture n'est
// créée (jamais un numéro deviné), l'écran le dit.
// Exécuté par scripts/audit-revue-fin.cjs (A5).
// ─────────────────────────────────────────────────────────────────────────────
import { prochainNumeroFacture, noterNumeroPris } from './factureNumero.js';

export const ID_COMPTEUR_FACTURES = 'vrm_factures_compteur';

// `lire()` → { existe, data } | undefined (pas su).
// `ecrire({ existe, data, rev })` → 'ok' | 'conflit' | 'ko'  (rev : la version LUE, null si absente).
export async function reserverNumeroFacture({ factures, pris, ent, annee, appartient, lire, ecrire, essais = 6 }) {
  for (let n = 0; n < essais; n++) {
    const l = await lire();
    if (!l) return null;
    const d = l.existe && l.data && typeof l.data === 'object' ? l.data : {};
    const enBase = d.pris && typeof d.pris === 'object' ? d.pris : {};
    // Le plus grand des deux compteurs (base, appareil), puis la liste.
    const fusion = { ...enBase };
    for (const [k, v] of Object.entries(pris && typeof pris === 'object' ? pris : {})) if (Number(v) > Number(fusion[k] || 0)) fusion[k] = Number(v);
    const numero = prochainNumeroFacture({ factures, pris: fusion, ent, annee, appartient });
    const rev = Number.isSafeInteger(d.rev) ? d.rev : null;
    const data = { ...d, pris: noterNumeroPris(fusion, numero, ent), rev: (rev || 0) + 1 };
    const w = await ecrire({ existe: !!l.existe, data, rev });
    if (w === 'ok') return { numero, pris: data.pris };
    if (w !== 'conflit') return null;
  }
  return null;
}

// Les deux appels réseau, avec la session du vendeur (RLS) : une petite ligne, projetée.
export function accesCompteurFactures({ url, entetes, owner, fetcher = (typeof fetch !== 'undefined' ? fetch : null) }) {
  const base = `${url}/rest/v1/app_data`;
  const filtre = `id=eq.${ID_COMPTEUR_FACTURES}&owner=eq.${encodeURIComponent(owner)}`;
  return {
    lire: async () => {
      if (!owner || !fetcher) return undefined;
      try {
        const r = await fetcher(`${base}?${filtre}&select=data`, { headers: entetes(), cache: 'no-store' });
        if (!r || !r.ok) return undefined;
        const j = await r.json();
        if (!Array.isArray(j)) return undefined;
        return j[0] ? { existe: true, data: j[0].data } : { existe: false, data: null };
      } catch (_) { return undefined; }
    },
    ecrire: async ({ existe, data, rev }) => {
      if (!owner || !fetcher) return 'ko';
      try {
        if (!existe) {
          const r = await fetcher(base, { method: 'POST', headers: entetes({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify([{ id: ID_COMPTEUR_FACTURES, owner, data, updated_at: new Date().toISOString() }]) });
          if (r && r.ok) return 'ok';
          return r && r.status === 409 ? 'conflit' : 'ko';
        }
        const cond = rev == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev}`;
        const r = await fetcher(`${base}?${filtre}&${cond}&select=id`, { method: 'PATCH', headers: entetes({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ data, updated_at: new Date().toISOString() }) });
        if (!r || !r.ok) return 'ko';
        const j = await r.json().catch(() => null);
        if (!Array.isArray(j)) return 'ko';
        return j.length ? 'ok' : 'conflit';
      } catch (_) { return 'ko'; }
    },
  };
}
