// ════════════════════════════════════════════════════════════════════════════
//  LE « COUCOU » DES GROUPES D'ACCOMPAGNEMENT (17 nov.) — les règles PURES,
//  partagées par l'app, la route (api/_lib/coucou.js) et les audits.
//
//  Julien (17 nov.) : « Je veux aussi que les personnes puissent se faire
//  coucou, mais pas échanger des messages dans mon app, mais sur Discord. »
//
//  Un coucou est un SIGNE, jamais un message : un toucher, aucun champ de texte,
//  aucun contenu. La base n'en garde que (de, à, groupe, quand) — migration 046.
//  Celui qui le reçoit n'a qu'UN geste : « Lui écrire sur Discord », qui ouvre
//    1. le profil Discord de celui qui a fait coucou, s'il a relié Discord à VRM
//       (identifiant signé par le serveur, jamais tapé par le navigateur) ;
//    2. sinon le salon Discord du groupe (collé par le créateur) ;
//    3. sinon rien : « Pas de Discord lié », et aucun autre geste.
//  Aucune réponse dans l'app, aucun fil, aucun texte libre — nulle part.
// ════════════════════════════════════════════════════════════════════════════

// Les bornes anti-spam (la BASE les tient ; ces nombres ne servent qu'à l'écran
// et à l'audit, qui vérifie qu'ils sont les mêmes que dans la 046).
export const COUCOU_PAR_PAIRE_H = 24;      // une paire de personnes : un coucou par 24 h (dans un sens ou dans l'autre)
export const COUCOU_PAR_JOUR = 20;         // un expéditeur : 20 coucous par 24 h glissantes
export const COUCOU_GARDE_J = 7;           // l'écran montre les coucous des 7 derniers jours

// Le lien Discord d'un GROUPE (collé par le créateur) : une invitation ou un
// salon, en https, sur discord.gg ou discord.com — rien d'autre (jamais une
// adresse libre : elle s'ouvre au toucher d'un membre). LA MÊME expression que
// la contrainte de la 046 (`vrm_accomp_habillage_discord`, vérifié par l'audit).
export const DISCORD_GROUPE_RE = /^https:\/\/(discord\.gg\/[A-Za-z0-9-]{2,32}|(www\.)?discord\.com\/(invite\/[A-Za-z0-9-]{2,32}|channels\/[0-9]{15,25}(\/[0-9]{15,25})?))\/?$/;
export const DISCORD_GROUPE_SQL = '^https://(discord\\.gg/[A-Za-z0-9-]{2,32}|(www\\.)?discord\\.com/(invite/[A-Za-z0-9-]{2,32}|channels/[0-9]{15,25}(/[0-9]{15,25})?))/?$';

// Ce que le créateur colle : espaces retirés, « discordapp.com » ramené à
// « discord.com », « http » refusé. Rend '' (aucun lien) ou l'adresse propre,
// ou `null` si ce n'est pas un lien Discord accepté.
export function lienDiscordGroupe(brut) {
  const s = String(brut == null ? '' : brut).trim().replace(/^https:\/\/(www\.)?discordapp\.com\//i, 'https://discord.com/');
  if (!s) return '';
  return DISCORD_GROUPE_RE.test(s) && s.length <= 120 ? s : null;
}

// L'identifiant Discord (un nombre de 15 à 25 chiffres, le « snowflake ») d'un
// compte relié ⇒ son profil. Rien d'autre n'est accepté.
export const ID_DISCORD_RE = /^[0-9]{15,25}$/;
export const profilDiscord = (id) => (ID_DISCORD_RE.test(String(id || '')) ? `https://discord.com/users/${id}` : '');

// LA RÈGLE DU GESTE de celui qui reçoit (une seule, §11) :
//   { sorte: 'profil', url } · { sorte: 'groupe', url } · { sorte: 'aucun', url: '' }.
export function lienPourEcrire({ profil = '', groupe = '' } = {}) {
  const p = profilDiscord(profil);
  if (p) return { sorte: 'profil', url: p };
  const g = lienDiscordGroupe(groupe);
  if (g) return { sorte: 'groupe', url: g };
  return { sorte: 'aucun', url: '' };
}

// La photo d'un groupe : une petite image carrée JPEG (160 px), en data URL,
// 40 000 caractères au plus — LA MÊME borne que la contrainte de la 046. Aucun
// hébergement d'image : elle vit dans la ligne du groupe, servie aux membres.
export const PHOTO_MAX = 40000;
export const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
export const photoValide = (p) => typeof p === 'string' && p.length <= PHOTO_MAX && PHOTO_RE.test(p);

// La photo choisie ⇒ un carré de 160 px (le centre), JPEG. Navigateur seulement.
export async function photoCarree(fichier, cote = 160) {
  if (!fichier || !/^image\//.test(fichier.type || '')) return null;
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const c = Math.min(img.naturalWidth, img.naturalHeight);
    if (!c) return null;
    const cv = document.createElement('canvas'); cv.width = cv.height = cote;
    const g = cv.getContext('2d');
    g.drawImage(img, (img.naturalWidth - c) / 2, (img.naturalHeight - c) / 2, c, c, 0, 0, cote, cote);
    for (const q of [0.82, 0.7, 0.55, 0.4]) { const d = cv.toDataURL('image/jpeg', q); if (photoValide(d)) return d; }
    return null;
  } catch (_) { return null; } finally { URL.revokeObjectURL(url); }
}

// Le bouton « Coucou » d'une personne : ce qu'il peut faire maintenant.
//   'pret' · 'deja' (un coucou entre vous deux il y a moins de 24 h) · 'plafond' (20 par jour atteints)
export function etatCoucou(cible, { envoyes24h = 0 } = {}) {
  if (cible && cible.deja) return 'deja';
  if (Number(envoyes24h) >= COUCOU_PAR_JOUR) return 'plafond';
  return 'pret';
}

// Ce que l'app accepte de la route (forme vérifiée, jamais supposée). Rend
// `null` si la forme n'est pas la bonne — « pas su », jamais « aucun coucou ».
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function coucousLus(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.groupes) || !Array.isArray(x.recus)) return null;
  const nom = (s) => String(s || '').slice(0, 60);
  return {
    envoyes24h: Math.max(0, Number(x.envoyes24h) || 0),
    groupes: x.groupes.filter((g) => g && UUID_RE.test(String(g.groupe))).map((g) => ({
      groupe: g.groupe, discord: lienDiscordGroupe(g.discord) || '', photo: photoValide(g.photo) ? g.photo : '',
      ouvert: g.ouvert === true,
      cibles: (Array.isArray(g.cibles) ? g.cibles : []).filter((c) => c && (c.role === 'createur' || UUID_RE.test(String(c.cible)))).map((c) => ({ cible: c.role === 'createur' ? null : c.cible, role: c.role === 'createur' ? 'createur' : 'membre', nom: nom(c.nom), deja: c.deja === true })),
    })),
    recus: x.recus.filter((r) => r && UUID_RE.test(String(r.id))).map((r) => ({ id: r.id, groupe: r.groupe, groupeNom: nom(r.groupe_nom), de: nom(r.de_nom), le: r.le, ecrire: lienPourEcrire({ profil: r.profil, groupe: r.discord_groupe }) })),
    sourdines: (Array.isArray(x.sourdines) ? x.sourdines : []).filter((s) => s && UUID_RE.test(String(s.coucou))).map((s) => ({ coucou: s.coucou, nom: nom(s.nom) })),
  };
}

// Le texte de la notification, dans la langue de CELUI QUI REÇOIT (aucun emoji :
// la forme des notifications les retire, api/_lib/notif-belle.js).
export const TEXTES_COUCOU = {
  fr: { t: '{nom} t’a fait coucou', b: 'Dans « {groupe} ». Pour lui répondre, écris-lui sur Discord.', carte: 'Sur la carte de VRM. Pour lui répondre, écris-lui sur Discord.' },
  en: { t: '{nom} waved at you', b: 'In “{groupe}”. To reply, message them on Discord.', carte: 'On the VRM map. To reply, message them on Discord.' },
  es: { t: '{nom} te ha saludado', b: 'En «{groupe}». Para responder, escríbele en Discord.', carte: 'En el mapa de VRM. Para responder, escríbele en Discord.' },
  it: { t: '{nom} ti ha salutato', b: 'In «{groupe}». Per rispondere, scrivigli su Discord.', carte: 'Sulla mappa di VRM. Per rispondere, scrivigli su Discord.' },
  de: { t: '{nom} hat dir zugewinkt', b: 'In „{groupe}“. Antworte ihm auf Discord.', carte: 'Auf der VRM-Karte. Antworte ihm auf Discord.' },
};
export const texteCoucou = (langue, nom, groupe) => {
  const x = TEXTES_COUCOU[langue] || TEXTES_COUCOU.fr;
  const r = (s) => s.replace('{nom}', String(nom || '').slice(0, 40)).replace('{groupe}', String(groupe || '').slice(0, 60));
  // Sans groupe : un coucou de la CARTE (047).
  return { title: r(x.t), body: groupe ? r(x.b) : r(x.carte) };
};
