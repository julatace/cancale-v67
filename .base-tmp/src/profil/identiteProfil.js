// ═══════════════════════════════════════════════════════════════════════════
// LE PROFIL : QUELLE PHOTO, QUEL NOM (11 nov., lot DJ6)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « la photo de profil du compte [doit être] celle du compte Discord,
// Google si la personne a relié son compte ; je veux pouvoir téléverser une photo
// de profil, et masquer le nom ».
// Ordre (une règle, un propriétaire) :
//   1. la photo TÉLÉVERSÉE par lui (ligne privée `profil_avatar_*`, api/_lib/profil-avatar.js) ;
//   2. la photo de son identité Discord ou Google RELIÉE à ce compte VRM (fiche
//      GoTrue `identities[].identity_data`), la plus récemment utilisée d'abord ;
//   3. l'initiale.
// Une adresse de photo n'est prise que chez Discord ou Google, en https (jamais
// une adresse quelconque écrite dans les métadonnées).
const HOTES_DISCORD = ['cdn.discordapp.com', 'media.discordapp.net'];
export function urlAvatarPermise(url) {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
    const h = u.hostname.toLowerCase();
    if (HOTES_DISCORD.includes(h) || /^[a-z0-9-]+\.googleusercontent\.com$/.test(h)) return u.href;
    return '';
  } catch (_) { return ''; }
}

const quand = (i) => { const t = Date.parse(String((i && (i.last_sign_in_at || i.updated_at || i.created_at)) || '')); return Number.isFinite(t) ? t : 0; };
// `{ url, fournisseur }` de l'identité Discord/Google reliée, ou null.
export function avatarFournisseur(fiche) {
  const ids = (Array.isArray(fiche && fiche.identities) ? fiche.identities : [])
    .filter((i) => i && (i.provider === 'discord' || i.provider === 'google'))
    .sort((a, b) => quand(b) - quand(a));
  for (const i of ids) {
    const d = i.identity_data || {};
    const url = urlAvatarPermise(d.avatar_url || d.picture);
    if (url) return { url, fournisseur: i.provider };
  }
  return null;
}

// La photo à montrer : { source: 'televersee' | 'discord' | 'google' | 'initiale', url }.
export function choisirAvatar({ televersee, fiche }) {
  if (typeof televersee === 'string' && /^data:image\/png;base64,/.test(televersee)) return { source: 'televersee', url: televersee };
  const f = avatarFournisseur(fiche);
  if (f) return { source: f.fournisseur, url: f.url };
  return { source: 'initiale', url: '' };
}

// Le nom montré dans la coque : masqué ⇒ « Mon compte », jamais le nom ni l'e-mail.
export const NOM_MASQUE = 'Mon compte';
export function nomAffiche({ masque, nom, email }) {
  if (masque) return NOM_MASQUE;
  return String(nom || '').trim() || String(email || '').trim();
}
export function initialeAffichee({ masque, nom, email }) {
  if (masque) return '•';
  return (String(nom || '').trim() || String(email || '').trim()).charAt(0).toUpperCase() || '•';
}
export function emailMasque(email) {
  const [l, d] = String(email || '').split('@');
  if (!l || !d) return '';
  return `${l.slice(0, 1)}•••@${d}`;
}
// Les identités reliées (fournisseurs) et leur identifiant GoTrue, pour « Délier ».
export function identitesReliees(fiche) {
  return (Array.isArray(fiche && fiche.identities) ? fiche.identities : [])
    .filter((i) => i && typeof i.provider === 'string')
    .map((i) => ({ fournisseur: i.provider, id: String(i.identity_id || i.id || '') }));
}
