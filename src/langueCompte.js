// (8 nov.) La langue des e-mails de compte (confirmation, mot de passe
// oublié…). VRM n'a pas de sélecteur de langue (il reste en France, CLAUDE.md
// §3) : on range seulement la langue du navigateur dans les métadonnées de
// l'utilisateur Supabase (`user_metadata.langue`), que les modèles d'e-mails
// lisent (`{{ if eq .Data.langue "en" }}`). 'fr' ou 'en', rien d'autre ;
// le français par défaut.
export const langueNavigateur = (nav = (typeof navigator !== 'undefined' ? navigator : null)) => {
  const l = String((nav && (nav.languages && nav.languages[0])) || (nav && nav.language) || '').toLowerCase();
  return /^en(?:-|$)/.test(l) ? 'en' : 'fr';
};
// (15 nov.) Les cinq langues de l'app (src/i18n) : les notifications push suivent
// celle du compte (api/_lib/push.js, `langueDuVendeur`). (17 nov.) Les e-mails aussi :
// ceux que VRM envoie (api/_lib/mail-textes.js) et les modèles de compte Supabase
// (scripts/modeles-email.cjs) parlent les cinq langues.
export const LANGUES_COMPTE = ['fr', 'en', 'es', 'it', 'de'];
export const langueRangee = (user) => {
  const l = user && user.user_metadata && user.user_metadata.langue;
  return LANGUES_COMPTE.includes(l) ? l : null;
};
// Une fois par compte et par appareil : relit l'utilisateur et n'écrit la
// langue que si elle est ABSENTE (jamais par-dessus une valeur rangée).
export const poserLangueUneFois = async ({ url, cle, jeton, uid, stockage, nav, fetcher = fetch }) => {
  if (!url || !cle || !jeton || !uid) return 'sans-session';
  const marque = 'vrm_langue_posee';
  try { if (stockage && stockage.getItem(marque) === uid) return 'deja'; } catch (_) {}
  const h = { apikey: cle, Authorization: `Bearer ${jeton}` };
  const r = await fetcher(`${url}/auth/v1/user`, { headers: h, cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return 'pas-su';
  const u = await r.json().catch(() => null);
  if (!u || u.id !== uid) return 'pas-su';
  if (!langueRangee(u)) {
    const w = await fetcher(`${url}/auth/v1/user`, { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { langue: langueNavigateur(nav) } }) }).catch(() => null);
    if (!w || !w.ok) return 'pas-su';
  }
  try { if (stockage) stockage.setItem(marque, uid); } catch (_) {}
  return 'pose';
};

// (15 nov.) LA LANGUE CHOISIE dans l'app (Paramètres → Langue, ou celle qu'elle
// affiche) rangée sur le compte, pour que les notifications push parlent la même.
// Relit l'utilisateur ; n'écrit que si elle DIFFÈRE. Lecture ratée ⇒ rien écrit.
export const alignerLangueCompte = async ({ url, cle, jeton, uid, langue, fetcher = fetch }) => {
  if (!url || !cle || !jeton || !uid) return 'sans-session';
  if (!LANGUES_COMPTE.includes(langue)) return 'langue-inconnue';
  const h = { apikey: cle, Authorization: `Bearer ${jeton}` };
  const r = await fetcher(`${url}/auth/v1/user`, { headers: h, cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return 'pas-su';
  const u = await r.json().catch(() => null);
  if (!u || u.id !== uid) return 'pas-su';
  if (langueRangee(u) === langue) return 'deja';
  const w = await fetcher(`${url}/auth/v1/user`, { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { langue } }) }).catch(() => null);
  return w && w.ok ? 'pose' : 'pas-su';
};
