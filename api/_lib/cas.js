// ═══════════════════════════════════════════════════════════════════════════
// COMPARER-ET-ÉCHANGER SUR `data.rev` — LA règle du serveur (11 nov., familles-serveur)
// ═══════════════════════════════════════════════════════════════════════════
// Lire-fusionner-réécrire sans condition perd l'écriture de l'autre (deux
// e-mails en parallèle, deux passages du cron, deux clics) : CLAUDE.md §5
// « Écritures concurrentes : comparer-et-échanger sur `data.rev` ».
//
// 1. `conditionRev(d)` : le filtre PostgREST qui ne laisse passer le PATCH que
//    si la ligne porte ENCORE la version lue. La version est comparée SOUS SA
//    FORME LUE (M70/M71 de la revue) : un `rev` entier (`3`), une chaîne
//    (UUID de push.js, journal-notifs.js) ou un objet. Avant, un `rev` qui
//    n'était pas un entier donnait `rev=is.null`, qui ne correspond jamais :
//    6 essais puis « pas su », un 503 permanent sur cette ligne.
// 2. `revSuivant(d)` : entier ⇒ +1 ; absent ou d'une autre forme ⇒ 1.
// 3. `modifierLigneCas({...})` : lire → `modifier(d)` → écrire sous condition,
//    relire si devancé. Rend true (écrit par NOUS) · false (`modifier` n'a
//    rien à écrire) · null (pas su : lecture ou écriture ratée, ou toujours
//    devancé). Une lecture ratée n'écrit RIEN.
// 4. `reserverMemo({...})` : la forme « mémo de dédoublonnage » — on RÉSERVE
//    d'abord (CAS), on envoie ensuite. Deux passages simultanés : un seul
//    obtient `true`. « Pas su » (mémo illisible) ne vaut jamais « jamais envoyé ».
// Tenu par scripts/audit-familles-serveur.cjs (famille 4).
// ═══════════════════════════════════════════════════════════════════════════
import { fetchAvecDelai } from './fetch-delai.js';

export function conditionRev(d) {
  const rev = d && typeof d === 'object' ? d.rev : undefined;
  if (rev == null) return 'data->>rev=is.null';
  const texte = typeof rev === 'object' ? JSON.stringify(rev) : String(rev);
  return `data->>rev=eq.${encodeURIComponent(texte)}`;
}

export function revSuivant(d) {
  const rev = d && typeof d === 'object' ? d.rev : undefined;
  return Number.isSafeInteger(rev) && rev >= 0 ? rev + 1 : 1;
}

// `url` : https://….supabase.co · `entetes` : apikey + Authorization (clé de service).
// `owner` : le propriétaire de la ligne (vendeur, ou neutre) — jamais deviné.
export async function modifierLigneCas({ url, entetes, owner, id, modifier, essais = 6, fetcher = fetchAvecDelai, attente = (ms) => new Promise((ok) => setTimeout(ok, ms)) }) {
  if (!url || !owner || !/^[a-z0-9_-]+$/i.test(String(id || ''))) return null;
  const base = `${url}/rest/v1/app_data`;
  const filtre = `owner=eq.${encodeURIComponent(owner)}&id=eq.${encodeURIComponent(id)}`;
  const ecrit = { ...entetes, 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    let rows;
    try {
      const r = await fetcher(`${base}?${filtre}&select=data`, { headers: entetes });
      if (!r || !r.ok) return null;
      rows = await r.json();
    } catch (_) { return null; }
    if (!Array.isArray(rows)) return null;
    const present = !!rows[0];
    const d = present ? (rows[0].data || {}) : null;
    const nouveau = modifier(d);
    if (nouveau === undefined) return false;
    const data = { ...nouveau, rev: revSuivant(d) };
    try {
      if (!present) {
        // Un INSERT simple : créée entre-temps par un autre ⇒ 409 (clé (owner,id)) ⇒ on relit.
        const w = await fetcher(base, {
          method: 'POST', headers: { ...ecrit, Prefer: 'return=minimal' },
          body: JSON.stringify([{ owner, id, data, updated_at: new Date().toISOString() }]),
        });
        if (w && w.ok) return true;
        if (w && w.status === 409) continue;
        return null;
      }
      const w = await fetcher(`${base}?${filtre}&${conditionRev(d)}&select=id`, {
        method: 'PATCH', headers: { ...ecrit, Prefer: 'return=representation' },
        body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
      });
      if (!w || !w.ok) return null;
      const out = await w.json().catch(() => null);
      if (!Array.isArray(out)) return null;
      if (out.length >= 1) return true;
    } catch (_) { return null; }
    await attente(25 * (n + 1));                  // devancé : notre base, une attente courte puis on relit
  }
  return null;
}

// Réserver un mémo de dédoublonnage AVANT d'envoyer.
// `deja(d)` : vrai si le mémo lu dit « déjà fait » ⇒ rien. Sinon `nouveau(d)` est
// écrit sous condition. Rend { reserve:true } (à nous d'envoyer) ·
// { reserve:false, raison:'deja' } · { reserve:false, raison:'pas-su' } (lecture ou
// écriture ratée, ou un autre passage a réservé avant : rien n'est envoyé).
export async function reserverMemo({ deja, nouveau, ...ligne }) {
  let vuDeja = false;
  const r = await modifierLigneCas({ ...ligne, modifier: (d) => { if (deja(d)) { vuDeja = true; return undefined; } vuDeja = false; return nouveau(d); } });
  if (r === true) return { reserve: true };
  if (r === false && vuDeja) return { reserve: false, raison: 'deja' };
  return { reserve: false, raison: 'pas-su' };
}
