// ── SUPER PDP, CÔTÉ APP (16 octobre) ─────────────────────────────────────────
// La carte « Facturation électronique » parle à /api/superpdp (un mode de
// /api/compte). Le navigateur n'a JAMAIS les identifiants Super PDP : il les
// envoie une fois, puis il ne sait que « connecté · bac à sable/production ».
// Toutes les règles (coffre, idempotence, trois issues) vivent sur le serveur
// (api/_lib/superpdp.js) ; ici, seulement la forme de l'appel et les mots.

// TROIS états : `undefined` en cours (posé par l'appelant) · `null` pas su ·
// l'objet du serveur.
export async function lireSuperPdp(entete) {
  try {
    const r = await fetch('/api/superpdp', { headers: entete || {}, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? j : null;
  } catch (_) { return null; }
}

// `{code, j}` ; une coupure rend `code: 0` (la réponse n'est pas arrivée —
// pour un envoi, c'est « incertain », jamais « refusé »).
export async function appelSuperPdp(entete, corps) {
  try {
    const r = await fetch('/api/superpdp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(entete || {}) }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => null);
    return { code: r.status, j: j || {} };
  } catch (_) { return { code: 0, j: {} }; }
}

export const enBase64 = (octets) => {
  const u = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};

export const ENV_LIBELLE = { sandbox: 'bac à sable', production: 'production' };

// Le mot d'une ligne, selon ce que le serveur a noté. `ton` : 'ok' · 'attention'
// · 'neutre'. Jamais « refusée » pour une incertaine.
export const libelleEnvoi = (e) => {
  if (!e || !e.etat) return null;
  if (e.etat === 'envoye') return { texte: `Envoyée à Super PDP${e.id ? ' · n° ' + e.id : ' · identifiant pas lu'}${e.statut ? ' · ' + e.statut : ''}${e.env === 'sandbox' ? ' (bac à sable)' : ''}`, ton: 'ok' };
  if (e.etat === 'refuse') return { texte: `Refusée par Super PDP : ${e.raison || 'sans raison donnée'}`, ton: 'attention' };
  if (e.etat === 'incertain') return { texte: 'Envoi incertain : je ne sais pas si elle est partie. « Relire » la cherche chez Super PDP.', ton: 'attention' };
  if (e.etat === 'en-cours') return { texte: 'Envoi en cours…', ton: 'neutre' };
  if (e.etat === 'absente') return { texte: "Super PDP ne l'a pas : elle peut être envoyée.", ton: 'neutre' };
  return null;
};
