// ── src/messages/avatarPersonne.js — LA PHOTO DE PROFIL D'UN INTERLOCUTEUR (sortie de src/filUnique.js le 28 nov., main-vert) ──
// Module PUR, sans import : l'en-tête du fil (Comptabilite, au démarrage) la lit sans emporter filUnique.js.
const txt = (v) => (v == null ? '' : String(v).trim());
// (28 nov., messages-parfaits — Julien : « la photo de profil de la personne ») La PHOTO DE PROFIL de l'interlocuteur,
// telle que Vinted la donne dans la boîte (`opposite_user.photo.url`, mesuré le 28 nov. : 2 253 sur 2 548 conversations
// captées). L'image « pas de photo » de Vinted (`static.vinted.com/assets/no-photo/…`) n'est PAS une photo : rien ⇒ l'initiale.
// Une adresse https seulement (jamais `data:`, jamais un autre schéma) ; c'est une image à montrer, jamais une identité.
export function avatarPersonne(v) {
  const u = txt(v && typeof v === 'object' ? v.url : v);
  if (!/^https:\/\/[^\s"'<>]{8,600}$/.test(u)) return null;
  if (/\/assets\/no-photo\//i.test(u) || /\/no[-_]?photo/i.test(u)) return null;
  return u;
}
