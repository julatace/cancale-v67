// ════════════════════════════════════════════════════════════════════════════
//  UNE ADRESSE QUE LA PAGE A LE DROIT DE LIRE (24 nov., bugs-terrain)
//  La politique de sécurité du contenu (`connect-src` de vercel.json) ne laisse
//  `fetch` lire que ces origines. Une photo Leboncoin (img.leboncoin.fr) lue par
//  `fetch` est REFUSÉE par le navigateur : rien n'est jamais lu, et chaque essai
//  est noté comme un plantage (« CSP connect-src ← https://img.leboncoin.fr »,
//  journal des plantages du 22 nov., écran Annonces). Les lecteurs de photos
//  « génériques » (visuels réseaux, fiche de préparation, dossier de litige)
//  demandent donc d'abord ici : pas permis ⇒ `null` tout de suite (la fiche part
//  sans photo, comme avant), sans requête refusée.
//  ⚠️ Cette liste RECOPIE vercel.json : scripts/audit-lecture-csp.cjs exige
//  qu'elles soient égales (une origine ajoutée là-bas s'ajoute ici).
// ════════════════════════════════════════════════════════════════════════════
export const CONNECT_SRC = [
  'https://lgonxzrzjcqthjtbdpzo.supabase.co',
  'wss://lgonxzrzjcqthjtbdpzo.supabase.co',
  'https://tiles.openfreemap.org',
  'https://cdn.jsdelivr.net',
  'https://*.vinted.net',
  'https://api-adresse.data.gouv.fr',
  'https://nominatim.openstreetmap.org',
];

const origineDeLaPage = () => { try { return window.location.origin; } catch (_) { return ''; } };

export function lisibleParLaPage(u, page = origineDeLaPage()) {
  const s = String(u || '');
  if (!s) return false;
  if (/^(data:|blob:)/i.test(s)) return true;
  let url;
  try { url = new URL(s, page || undefined); } catch (_) { return false; }
  if (page && url.origin === page) return true;
  for (const regle of CONNECT_SRC) {
    const m = /^([a-z]+):\/\/(\*\.)?([^/]+)$/i.exec(regle);
    if (!m || `${m[1]}:` !== url.protocol) continue;
    const hote = url.hostname.toLowerCase(), base = m[3].toLowerCase();
    if (m[2] ? hote.endsWith('.' + base) : hote === base) return true;
  }
  return false;
}
