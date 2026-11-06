// ── « SIGNALER UN PROBLÈME » : UNE RÈGLE, L'APP ET LE SERVEUR (6 nov.) ─────────
// Julien (6 nov.) : un bouton dans l'app, et le message lui arrive — même quand
// c'est un CLIENT qui signale. Ce qui part : l'écran ouvert (et celui d'avant),
// la version de l'app, la version de l'extension si connue, le navigateur, la
// taille d'écran, les 5 derniers plantages de CET appareil (src/plantages.js),
// et le texte tapé. RIEN de ses données : ni vente, ni pseudo, ni e-mail, ni
// montant — seul l'identifiant de son compte VRM (pris dans SA session par le
// serveur, jamais dans le corps).
//
// ⚠️ UNE RÈGLE (§11) : `normaliserSignalement` est la MÊME fonction pour
//    l'aperçu de l'app (ce que la personne voit avant d'envoyer) et pour le
//    serveur (ce qui est rangé). Le serveur la rejoue sur le corps reçu : un
//    champ qu'elle ne connaît pas ne passe pas, quelle que soit la page qui
//    l'envoie. Elle est idempotente — l'aperçu EST ce qui est rangé.
//
// OÙ ÇA ARRIVE : les plantages d'un client sont rangés dans SA base (RLS) —
// Julien ne les voit jamais. Un signalement, lui, doit arriver à l'ÉDITEUR :
// il est rangé par le serveur (clé de service) dans `app_data` du PROPRIÉTAIRE
// DE L'INSTALLATION — `VRM_OWNER_UID` (la variable que toutes les routes
// serveur lisent pour « l'installation »), sinon `vrm_reglages.proprietaire`
// (la base, migration 006, la même règle que `vrm_acces`). Pas su ⇒ RIEN n'est
// rangé et l'app dit « pas envoyé » (jamais chez le propriétaire NEUTRE, où
// personne ne le lirait).
//
// ANTI-ABUS : 5 signalements par heure et par compte, tenus PAR LA BASE — cinq
// identifiants possibles par heure (`signalement_<heure>_<compte>_<1..5>`),
// chacun réservé par une écriture « si absente » (`resolution=ignore-duplicates`).
// Deux envois simultanés ne peuvent pas prendre la même place, et une sixième
// n'a nulle part où aller : 429, rien d'écrit.
//
// LA NOTIFICATION : une par signalement, au propriétaire (ses appareils, par le
// chemin push existant `sendPushToAll`). Plus de 3 dans l'heure (toute
// l'installation) ⇒ regroupées : une seule notification qui se remplace et dit
// combien.
import { sbCle } from './cle.js';
// ⚠️ Aucun import de module Node ici : l'app importe ce fichier (l'aperçu).
// La route passe `pousser(notif, proprio)`, qui ouvre le contexte du vendeur.

export const SIGNALEMENTS_PAR_HEURE = 5;
export const REGROUPER_AU_DELA = 3;
export const PLANTAGES_MAX = 5;
export const TEXTE_MAX = 2000;
export const TEXTE_MIN = 3;
export const PREFIXE = 'signalement_';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEUTRE = '00000000-0000-0000-0000-000000000000';

// Les navigateurs que l'app sait nommer (src/navigateurExtension.js, `NOM_NAV`) ;
// tout le reste devient « inconnu ». audit-signalement vérifie la correspondance.
export const NAVIGATEURS = ['Chrome', 'Brave', 'Edge', 'Opera', 'Vivaldi', 'Yandex Browser', 'Firefox', 'Orion', 'Samsung Internet', 'DuckDuckGo'];

// Ce qui ressemble à une donnée et n'a rien à faire dans un signalement :
// adresse e-mail, jeton, identifiant (uuid), IBAN, suite de 9 chiffres ou plus
// (n° de transaction, téléphone, carte), paramètres d'une adresse web.
// Idempotent : les remplacements ne ressemblent à rien de ce qu'on cherche.
export function masquer(texte) {
  return String(texte == null ? '' : texte)
    .replace(/%40/gi, '@')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '{email}')
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/g, '{jeton}')
    .replace(/(^|[^A-Za-z])((?:\w*_)?(?:token|apikey|key|csrf|secret|password)|Bearer)([=: ]+)[^\s'"&,;)]{6,}/gi, '$1$2$3{jeton}')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '{uuid}')
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g, '{iban}')
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, '$1')
    .replace(/\d(?:[\s.-]?\d){8,}/g, '{n}');
}

// Les écrans de l'app (les `tab` d'App.jsx : `ONGLETS_LIENS` et chaque `tab==='…'`).
// Un nom hors de cette liste n'est pas un écran — il pourrait être une donnée
// (un pseudo) : il devient « ». audit-signalement tient la liste à jour.
export const ECRANS = ['ventes', 'annonces', 'messages', 'achats', 'retraits', 'journee', 'collectif', 'plat_vinted', 'plat_leboncoin', 'plat_ebay', 'plat_vestiaire', 'prixmarche', 'dashboard', 'compta', 'comptabilite', 'cat_annonces', 'cat_ventes', 'cat_achats', 'cat_bord', 'cat_msg', 'cat_expedition', 'garage', 'organisation', 'communaute', 'emails', 'invoices', 'masques', 'settings', 'vintedaccounts', 'catalog', 'sales', 'stockvinted', 'leboncoin', 'ebay_annonces', 'ebay_ventes', 'ebay_agent', 'ebay_messages', 'vinted_annonces', 'inventory'];
// La version de l'app telle que l'app l'écrit (`BUILD_ID` : « 6 novembre à 14:32 »).
const VERSION_APP = /^(\d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) à \d{2}:\d{2}|inconnue)$/;
const ORIGINES = ['ecran', 'page', 'promesse', 'csp', 'retour'];
const court = (v, n) => masquer(String(v == null ? '' : v)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, n);
const ecranValide = (v) => (ECRANS.includes(String(v || '')) ? String(v) : '');
const versionApp = (v) => { const s = String(v == null ? '' : v).trim(); return VERSION_APP.test(s) ? s : ''; };
const versionExt = (v) => (/^\d{1,3}\.\d{1,4}\.\d{1,4}$/.test(String(v || '')) ? String(v) : null);
const entier = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 20000 ? Number(v) : null);
const dateIso = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

// LE signalement, tel qu'il part ET tel qu'il est rangé. `null` si le texte
// manque (un signalement vide ne dit rien). Seuls ces champs existent.
export function normaliserSignalement(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const texte = court(c.texte, TEXTE_MAX).trim();
  if (texte.length < TEXTE_MIN) return null;
  const l = entier(c.ecranTaille && c.ecranTaille.largeur), h = entier(c.ecranTaille && c.ecranTaille.hauteur);
  const plantages = (Array.isArray(c.plantages) ? c.plantages : []).slice(-PLANTAGES_MAX).filter((p) => p && typeof p === 'object').map((p) => ({
    message: court(p.message, 300),
    ecran: ecranValide(p.ecran),
    origine: ORIGINES.includes(String(p.origine || '')) ? String(p.origine) : '',
    version: versionApp(p.version),
    at: dateIso(p.at),
  })).filter((p) => p.message);
  return {
    texte,
    ecran: ecranValide(c.ecran),
    ecranAvant: ecranValide(c.ecranAvant),
    version: versionApp(c.version),
    extension: versionExt(c.extension),
    navigateur: NAVIGATEURS.includes(c.navigateur) ? c.navigateur : 'inconnu',
    ecranTaille: l && h ? { largeur: l, hauteur: h } : null,
    plantages,
  };
}

// Le texte d'aperçu, ligne par ligne (l'app l'affiche tel quel) : la personne
// voit exactement ce qui part — rien n'est ajouté ensuite, hormis l'identifiant
// de son compte VRM et l'heure, que l'aperçu nomme aussi.
export function lignesApercu(s) {
  if (!s) return [];
  const L = [
    ['Ton message', s.texte],
    ['Écran ouvert', s.ecran || '—'],
    ['Écran d’avant', s.ecranAvant || '—'],
    ['Version de l’app', s.version || '—'],
    ['Version de l’extension', s.extension || 'pas connue ici'],
    ['Navigateur', s.navigateur],
    ['Taille d’écran', s.ecranTaille ? `${s.ecranTaille.largeur} × ${s.ecranTaille.hauteur}` : '—'],
    ['Plantages de cet appareil', s.plantages.length ? `${s.plantages.length}` : 'aucun noté'],
  ];
  return L;
}

// ── LE SERVEUR ───────────────────────────────────────────────────────────────
const cfg = (env) => ({
  url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co',
  service: env.SUPABASE_SERVICE_KEY || '',
});
const heureDe = (t) => new Date(t).toISOString().slice(0, 13).replace(/\D/g, '');   // AAAAMMJJHH (UTC)
export const idSignalement = (t, uid, k) => `${PREFIXE}${heureDe(t)}_${String(uid).replace(/-/g, '').slice(0, 12)}_${k}`;

// Le propriétaire de l'installation : `null` = pas su.
export async function proprietaireInstallation({ env = process.env, fetcher = fetch } = {}) {
  const e = String(env.VRM_OWNER_UID || '').trim().toLowerCase();
  if (UUID.test(e) && e !== NEUTRE) return e;
  const { url, service } = cfg(env);
  if (!service) return null;
  try {
    const r = await fetcher(`${url}/rest/v1/vrm_reglages?cle=eq.proprietaire&select=valeur&limit=1`, { headers: sbCle(service) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const v = Array.isArray(j) && j[0] ? String(j[0].valeur || '').trim().toLowerCase() : '';
    return UUID.test(v) && v !== NEUTRE ? v : null;
  } catch (_) { return null; }
}

async function lire(env, fetcher, chemin) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/${chemin}`, { headers: sbCle(service) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// Réserve une place (1..5) de l'heure : rend l'id écrit, `'plein'`, ou `null`
// (la base n'a pas confirmé — « pas écrit » ne vaut pas « écrit »).
async function reserver({ env, fetcher, proprio, uid, t, data }) {
  const { url, service } = cfg(env);
  for (let k = 1; k <= SIGNALEMENTS_PAR_HEURE; k++) {
    const id = idSignalement(t, uid, k);
    let r;
    try {
      r = await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
        method: 'POST',
        headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify([{ owner: proprio, id, data, updated_at: new Date(t).toISOString() }]),
      });
    } catch (_) { return null; }
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return null;
    if (j.length === 1) return id;          // la place était libre : écrite
    // j.length === 0 : place déjà prise — la suivante.
  }
  return 'plein';
}

const titreNotif = (n) => (n > REGROUPER_AU_DELA ? `🛟 ${n} problèmes signalés depuis une heure` : '🛟 Problème signalé');
export function notifSignalement({ id, s, n }) {
  const extrait = s.texte.length > 90 ? s.texte.slice(0, 89) + '…' : s.texte;
  const groupe = Number.isInteger(n) && n > REGROUPER_AU_DELA;
  return {
    cat: 'signalement',
    title: titreNotif(groupe ? n : 1),
    body: `${groupe ? 'Dernier : ' : ''}${s.ecran ? s.ecran + ' · ' : ''}« ${extrait} »`,
    tag: groupe ? 'vrm-signalements' : `signalement-${id}`,
    url: '/?tab=settings&section=signalements',
  };
}

// POST (session) : envoyer. `utilisateur` = SA session (api/_lib/session.js).
export async function envoyerSignalement({ utilisateur, corps, env = process.env, fetcher = fetch, pousser = null, maintenant = Date.now() }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const s = normaliserSignalement(corps);
  if (!s) return { code: 400, corps: { ok: false, raison: 'texte' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  const at = new Date(maintenant).toISOString();
  const data = { ...s, de: String(utilisateur.id), at, traite: false };
  const id = await reserver({ env, fetcher, proprio, uid: utilisateur.id, t: maintenant, data });
  if (id === null) return { code: 503, corps: { ok: false, raison: 'base' } };
  if (id === 'plein') return { code: 429, corps: { ok: false, raison: 'trop', max: SIGNALEMENTS_PAR_HEURE, reessayerDans: 60 - new Date(maintenant).getUTCMinutes() } };
  // La notification : jamais une raison de dire « pas envoyé » (le signalement
  // EST rangé) — elle est tentée, son issue est dite à part.
  let notifie = null;
  if (pousser) {
    try {
      const recents = await lire(env, fetcher, `app_data?owner=eq.${proprio}&id=like.${PREFIXE}*&select=id&data->>at=gte.${encodeURIComponent(new Date(maintenant - 3600e3).toISOString())}&limit=100`);
      const n = Array.isArray(recents) ? recents.length : null;
      const r = await pousser(notifSignalement({ id, s, n }), proprio);
      notifie = !!(r && r.sent > 0);
    } catch (_) { notifie = false; }
  }
  return { code: 200, corps: { ok: true, id, notifie, restant: SIGNALEMENTS_PAR_HEURE - Number(id.slice(id.lastIndexOf('_') + 1)) } };
}

// GET (session, PROPRIÉTAIRE seulement) : la liste. Les lignes sont légères
// (un texte borné, 5 plantages au plus) : on lit `data`, projeté champ par champ.
export async function listerSignalements({ utilisateur, env = process.env, fetcher = fetch }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  const rows = await lire(env, fetcher, `app_data?owner=eq.${proprio}&id=like.${PREFIXE}*&select=id,data&order=data->>at.desc&limit=200`);
  if (!rows) return { code: 503, corps: { ok: false, raison: 'base' } };
  const signalements = rows.map(({ id, data }) => {
    const s = normaliserSignalement(data) || { texte: '', ecran: '', ecranAvant: '', version: '', extension: null, navigateur: 'inconnu', ecranTaille: null, plantages: [] };
    return { id, ...s, de: UUID.test(String(data && data.de)) ? String(data.de) : null, at: dateIso(data && data.at), traite: !!(data && data.traite === true), traiteLe: dateIso(data && data.traiteLe) };
  });
  return { code: 200, corps: { ok: true, signalements, nonTraites: signalements.filter((x) => !x.traite).length } };
}

// POST {action:'traite', id, traite} (PROPRIÉTAIRE seulement) : lire, puis
// réécrire la MÊME ligne — une lecture ratée n'écrit rien.
export async function marquerTraite({ utilisateur, corps, env = process.env, fetcher = fetch, maintenant = Date.now() }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  const id = String((corps && corps.id) || '');
  if (!/^signalement_\d{10}_[0-9a-f]{12}_[1-9]$/.test(id)) return { code: 400, corps: { ok: false, raison: 'id' } };
  const traite = corps.traite !== false;
  const rows = await lire(env, fetcher, `app_data?owner=eq.${proprio}&id=eq.${id}&select=data&limit=1`);
  if (!rows) return { code: 503, corps: { ok: false, raison: 'base' } };
  if (!rows[0] || !rows[0].data) return { code: 404, corps: { ok: false, raison: 'absent' } };
  const data = { ...rows[0].data, traite, traiteLe: traite ? new Date(maintenant).toISOString() : null };
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ data, updated_at: new Date(maintenant).toISOString() }),
    });
    if (!r.ok) return { code: 503, corps: { ok: false, raison: 'base' } };
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j) || j.length !== 1) return { code: 503, corps: { ok: false, raison: 'base' } };
  } catch (_) { return { code: 503, corps: { ok: false, raison: 'base' } }; }
  return { code: 200, corps: { ok: true, id, traite } };
}

// ── CÔTÉ APP : l'envoi, et ce qu'il dit ─────────────────────────────────────
// `envoye: true` SEULEMENT sur une réponse `ok:true` du serveur qui porte l'id
// rangé ; tout le reste (réseau, 5xx, réponse illisible) est « pas envoyé ».
export async function posterSignalement(signalement, { entetes = {}, fetcher = (typeof fetch === 'function' ? fetch : null) } = {}) {
  try {
    const r = await fetcher('/api/compte?mode=signalement', { method: 'POST', headers: { 'Content-Type': 'application/json', ...entetes }, body: JSON.stringify(signalement) });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.ok === true && typeof j.id === 'string' && j.id.startsWith(PREFIXE)) return { envoye: true, id: j.id, notifie: j.notifie === true };
    return { envoye: false, raison: (j && j.raison) || (r.status === 401 ? 'session' : 'serveur'), reessayerDans: j && j.reessayerDans };
  } catch (_) { return { envoye: false, raison: 'reseau' }; }
}
export const PHRASES_REFUS = {
  trop: (m) => `Pas envoyé : 5 signalements par heure au plus.${m ? ` Réessaie dans ${m} min.` : ''}`,
  session: () => 'Pas envoyé : connecte-toi à VRM, puis réessaie.',
  texte: () => 'Pas envoyé : écris en quelques mots ce qui ne va pas.',
  reseau: () => 'Pas envoyé : pas de connexion. Ton texte est gardé, réessaie.',
  base: () => 'Pas envoyé : le serveur n’a pas pu le ranger. Ton texte est gardé, réessaie.',
  'non-configure': () => 'Pas envoyé : le serveur n’est pas configuré pour les signalements.',
  'destinataire-inconnu': () => 'Pas envoyé : le serveur ne sait pas à qui le remettre.',
  serveur: () => 'Pas envoyé : le serveur n’a pas confirmé. Ton texte est gardé, réessaie.',
};
export const phraseRefus = (r) => (PHRASES_REFUS[r && r.raison] || PHRASES_REFUS.serveur)(r && r.reessayerDans);
