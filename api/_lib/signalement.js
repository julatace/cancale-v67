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
// (8 nov.) Les messages d'erreur passent AUSSI par le nettoyage du journal des
// plantages (valeur citée, prix, suites de chiffres) : un module sans Node.
import { nettoyer } from '../../src/plantages.js';
// ⚠️ Aucun import de module Node ici : l'app importe ce fichier (l'aperçu).
// La route passe `pousser(notif, proprio)`, qui ouvre le contexte du vendeur.

export const SIGNALEMENTS_PAR_HEURE = 5;
export const REGROUPER_AU_DELA = 3;
// (8 nov., « Signaler un problème » enrichi) les 50 dernières erreurs de CET
// appareil (src/plantages.js, `erreursRecentes`), pas seulement 5 plantages.
export const PLANTAGES_MAX = 50;
export const LECTURES_MAX = 30;
export const PLAN_MAX = 400;
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
    // (8 nov.) Un MONTANT ne part jamais (« 87,50 € », « 1 250 € », « 45 euros »,
    // « 87,50 » tout seul) — comme le mode stream qui les cache à l'écran.
    .replace(/\d+(?:[ \u00a0\u202f.]\d{3})*(?:[.,]\d{1,2})?[ \u00a0\u202f]?(?:€|eur(?:os?)?\b)/gi, '{montant}')
    .replace(/(^|[^\w{])\d+,\d{2}(?![\d\w])/g, '$1{montant}')
    .replace(/\d(?:[\s.-]?\d){8,}/g, '{n}');
}

// Les écrans de l'app (les `tab` d'App.jsx : `ONGLETS_LIENS` et chaque `tab==='…'`).
// Un nom hors de cette liste n'est pas un écran — il pourrait être une donnée
// (un pseudo) : il devient « ». audit-signalement tient la liste à jour.
export const ECRANS = ['ventes', 'annonces', 'messages', 'achats', 'retraits', 'journee', 'collectif', 'plat_vinted', 'plat_leboncoin', 'plat_ebay', 'plat_vestiaire', 'prixmarche', 'dashboard', 'compta', 'comptabilite', 'cat_annonces', 'cat_ventes', 'cat_achats', 'cat_bord', 'cat_msg', 'cat_expedition', 'garage', 'organisation', 'communaute', 'emails', 'invoices', 'masques', 'settings', 'vintedaccounts', 'catalog', 'sales', 'stockvinted', 'leboncoin', 'ebay_annonces', 'ebay_ventes', 'ebay_agent', 'ebay_messages', 'vinted_annonces', 'inventory', 'trancher', 'semaine', 'litiges', 'republier', 'favoris'];   // (11 nov.) + litiges, republier, favoris : des écrans de l'app (audit-signalement)
// La version de l'app telle que l'app l'écrit (`BUILD_ID` : « 6 novembre à 14:32 »).
const VERSION_APP = /^(\d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) à \d{2}:\d{2}|inconnue)$/;
const ORIGINES = ['ecran', 'feuille', 'page', 'promesse', 'csp', 'retour'];
// (8 nov.) L'appareil, en mots FERMÉS (aucune chaîne libre ne passe).
export const APPAREILS_SIG = ['telephone', 'tablette', 'ordinateur'];
export const SYSTEMES = ['iOS', 'iPadOS', 'Android', 'macOS', 'Windows', 'Linux', 'ChromeOS', 'autre'];
const METHODES = ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'];
// Une lecture se nomme par sa FAMILLE (jamais son adresse ni ses paramètres) :
// « base:app_data », « api:compte:signalement », « auth », « stockage », « autre ».
const QUOI_LECTURE = /^(base|api|auth|stockage|extension|autre)(:[a-z0-9_-]{1,40}){0,2}$/;
// Les compteurs de l'état de l'écran (des nombres, jamais un texte).
export const ETAT_DOM = ['boutons', 'champs', 'feuilles', 'squelettes', 'pannes', 'gardeFou', 'defilement'];
// Les sortes de rectangles de la capture schématique (src/signalementContexte.js).
export const SORTES_PLAN = ['bloc', 'texte', 'bouton', 'champ', 'image', 'masque'];
const court = (v, n) => masquer(String(v == null ? '' : v)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, n);
const ecranValide = (v) => (ECRANS.includes(String(v || '')) ? String(v) : '');
export const versionApp = (v) => { const s = String(v == null ? '' : v).trim(); return VERSION_APP.test(s) ? s : ''; };
const versionExt = (v) => (/^\d{1,3}\.\d{1,4}\.\d{1,4}$/.test(String(v || '')) ? String(v) : null);
const entier = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 20000 ? Number(v) : null);
const dateIso = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const borne = (v, max) => (v != null && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.round(Number(v)))) : null);
const ecranDeGarde = (v) => { const s = String(v || ''); return ecranValide(s) || ecranValide(s.split(':')[0]); };
// La capture schématique : des rectangles [x, y, l, h, sorte] dans le cadre de
// l'écran — que des NOMBRES ; tout autre forme est jetée.
function planValide(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const l = entier(p.l), h = entier(p.h);
  if (!l || !h || !Array.isArray(p.b)) return null;
  const b = [];
  for (const r of p.b.slice(0, PLAN_MAX)) {
    if (!Array.isArray(r) || r.length !== 5 || !r.every((x) => Number.isFinite(Number(x)))) continue;
    const k = Math.round(Number(r[4]));
    if (k < 0 || k >= SORTES_PLAN.length) continue;
    const x = borne(r[0], l), y = borne(r[1], h), w = borne(r[2], l), hh = borne(r[3], h);
    if (!w || !hh) continue;
    b.push([x, y, w, hh, k]);
  }
  return b.length ? { l, h, b } : null;
}
function etatDomValide(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const out = {};
  for (const k of ETAT_DOM) {
    if (k === 'gardeFou') out[k] = e[k] === true;
    else if (k === 'defilement') out[k] = borne(e[k], 100);
    else out[k] = borne(e[k], 9999);
  }
  return out;
}
const lecturesValides = (l) => (Array.isArray(l) ? l : []).slice(-LECTURES_MAX).filter((x) => x && typeof x === 'object' && !Array.isArray(x)).map((x) => ({
  m: METHODES.includes(String(x.m || '').toUpperCase()) ? String(x.m).toUpperCase() : 'GET',
  quoi: QUOI_LECTURE.test(String(x.quoi || '')) ? String(x.quoi) : 'autre',
  s: Number.isInteger(Number(x.s)) && Number(x.s) >= 0 && Number(x.s) < 600 ? Number(x.s) : 0,
  ms: borne(x.ms, 600000),
  at: dateIso(x.at),
}));
// (8 nov.) Ce qui a la FORME d'un pseudo dans le message tapé : un mot avec un
// « _ » ou un point intérieur (marie_dupont, julie.b), ou des lettres suivies de
// deux chiffres ou plus (julatace3535, lea75). Un pseudo que l'écran ne connaît
// pas (aucun jeton du mode stream) ne part pas non plus. Seulement le TEXTE tapé :
// un message d'erreur garde ses noms de code (nettoyés par ailleurs).
export const masquerPseudos = (t) => String(t == null ? '' : t)
  .replace(/(^|[^\p{L}\p{N}_{])(?=[\p{L}\p{N}]*[_.][\p{L}\p{N}])[\p{L}\p{N}]+(?:[_.][\p{L}\p{N}]+)+(?![\p{L}\p{N}_])/gu, (m, a) => { const mot = m.slice(a.length); return /^\S+\.(fr|com|net|org|center|io)$/i.test(mot) || !/\p{L}{2,}/u.test(mot) ? m : a + '{pseudo}'; })
  .replace(/(^|[^\p{L}\p{N}_{])\p{L}{2,}\d{2,}(?![\p{L}\p{N}_])/gu, '$1{pseudo}');

// LE signalement, tel qu'il part ET tel qu'il est rangé. `null` si le texte
// manque (un signalement vide ne dit rien). Seuls ces champs existent.
// `opts.masque(texte)` (l'app seulement) : cache en plus ce que l'écran sait
// sensible (pseudos de ses comptes, des acheteurs : les jetons du mode stream).
// Le serveur rejoue la règle sans lui : ce qui a été masqué reste masqué.
export function normaliserSignalement(c, opts = {}) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const m2 = typeof opts.masque === 'function' ? (t) => { try { return String(opts.masque(t)); } catch (_) { return t; } } : (t) => t;
  const texte = masquerPseudos(court(m2(String(c.texte == null ? '' : c.texte)), TEXTE_MAX)).trim();
  if (texte.length < TEXTE_MIN) return null;
  const l = entier(c.ecranTaille && c.ecranTaille.largeur), h = entier(c.ecranTaille && c.ecranTaille.hauteur);
  const plantages = (Array.isArray(c.plantages) ? c.plantages : []).slice(-PLANTAGES_MAX).filter((p) => p && typeof p === 'object').map((p) => ({
    message: court(nettoyer(m2(String(p.message == null ? '' : p.message))), 300),
    ecran: ecranDeGarde(p.ecran),
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
    appareil: APPAREILS_SIG.includes(c.appareil) ? c.appareil : null,
    systeme: SYSTEMES.includes(c.systeme) ? c.systeme : null,
    enLigne: c.enLigne === true ? true : c.enLigne === false ? false : null,
    theme: c.theme === 'clair' || c.theme === 'sombre' ? c.theme : null,
    etatEcran: etatDomValide(c.etatEcran),
    lectures: lecturesValides(c.lectures),
    plan: planValide(c.plan),
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
    ['Appareil', [{ telephone: 'téléphone', tablette: 'tablette', ordinateur: 'ordinateur' }[s.appareil], s.systeme].filter(Boolean).join(' · ') || '—'],
    ['Connexion', s.enLigne === true ? 'en ligne' : s.enLigne === false ? 'hors connexion' : '—'],
    ['Capture de l’écran', s.plan ? `schéma, ${s.plan.b.length} blocs, sans texte` : 'pas prise'],
    ['État de l’écran', s.etatEcran ? `${s.etatEcran.boutons} boutons · ${s.etatEcran.champs} champs${s.etatEcran.gardeFou ? ' · écran tombé' : ''}${s.etatEcran.squelettes ? ' · en chargement' : ''}` : '—'],
    ['Requêtes récentes', s.lectures.length ? `${s.lectures.length}${(() => { const n = s.lectures.filter((x) => !(x.s >= 200 && x.s < 400)).length; return n ? `, dont ${n} en échec` : ', toutes réussies'; })()}` : 'aucune notée'],
    ['Erreurs de cet appareil', s.plantages.length ? `${s.plantages.length}` : 'aucune notée'],
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

export function resumeDe(s) {
  return { plantages: s.plantages.length, lectures: s.lectures.length, echecs: s.lectures.filter((x) => !(x.s >= 200 && x.s < 400)).length, plan: s.plan ? s.plan.b.length : 0, gardeFou: !!(s.etatEcran && s.etatEcran.gardeFou) };
}
const resumeValide = (r) => {
  const o = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  const n = (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < 10000 ? Number(v) : 0);
  return { plantages: n(o.plantages), lectures: n(o.lectures), echecs: n(o.echecs), plan: n(o.plan), gardeFou: o.gardeFou === true };
};
// Ce que la liste projette : des scalaires et le résumé, jamais `data` entier.
const SELECT_LISTE = ['id', 'texte:data->>texte', 'ecran:data->>ecran', 'ecranAvant:data->>ecranAvant', 'version:data->>version', 'extension:data->>extension', 'navigateur:data->>navigateur', 'appareil:data->>appareil', 'systeme:data->>systeme', 'largeur:data->ecranTaille->>largeur', 'hauteur:data->ecranTaille->>hauteur', 'de:data->>de', 'at:data->>at', 'traite:data->>traite', 'traiteLe:data->>traiteLe', 'resume:data->resume', 'repondre:data->>repondre'].join(',');
// (12 nov., « J'ai un problème ») « Réponds-moi par e-mail » : SEULEMENT si la personne
// l'a coché (`repondreA: true`), et l'adresse vient de SA SESSION (jamais du corps).
// Sans la case, rien ne change : ni e-mail, ni pseudo (audit-aide-client).
const FORME_EMAIL = /^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/;
export const adresseReponse = (corps, utilisateur) => (corps && corps.repondreA === true && utilisateur && FORME_EMAIL.test(String(utilisateur.email || '').trim()) ? String(utilisateur.email).trim().toLowerCase() : null);
const reponseLue = (x) => (FORME_EMAIL.test(String(x || '')) ? String(x) : null);

// POST (session) : envoyer. `utilisateur` = SA session (api/_lib/session.js).
export async function envoyerSignalement({ utilisateur, corps, env = process.env, fetcher = fetch, pousser = null, maintenant = Date.now() }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const s = normaliserSignalement(corps);
  if (!s) return { code: 400, corps: { ok: false, raison: 'texte' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  const at = new Date(maintenant).toISOString();
  // `resume` : les nombres que la LISTE lit (projetée, §4.4) — les champs lourds
  // (capture, erreurs, lectures) ne se lisent qu'à l'ouverture d'UN signalement.
  const data = { ...s, de: String(utilisateur.id), at, traite: false, resume: resumeDe(s) };
  const reponse = adresseReponse(corps, utilisateur);
  if (reponse) data.repondre = reponse;
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
export async function listerSignalements({ utilisateur, unId = null, env = process.env, fetcher = fetch }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  // (8 nov.) UN signalement, en entier (capture, erreurs, lectures) : `?id=`.
  if (unId) {
    if (!/^signalement_\d{10}_[0-9a-f]{12}_[1-9]$/.test(String(unId))) return { code: 400, corps: { ok: false, raison: 'id' } };
    const r1 = await lire(env, fetcher, `app_data?owner=eq.${proprio}&id=eq.${unId}&select=id,data&limit=1`);
    if (!r1) return { code: 503, corps: { ok: false, raison: 'base' } };
    if (!r1[0]) return { code: 404, corps: { ok: false, raison: 'absent' } };
    const d = r1[0].data || {};
    const s = normaliserSignalement({ ...d, texte: d.texte || '…' });
    return { code: 200, corps: { ok: true, signalement: { id: r1[0].id, ...s, de: UUID.test(String(d.de)) ? String(d.de) : null, repondre: reponseLue(d.repondre), at: dateIso(d.at), traite: d.traite === true, traiteLe: dateIso(d.traiteLe) } } };
  }
  // La LISTE : projetée (§4.4) — 200 signalements à 30 Ko chacun ne se lisent pas d'un coup.
  const rows = await lire(env, fetcher, `app_data?owner=eq.${proprio}&id=like.${PREFIXE}*&select=${SELECT_LISTE}&order=data->>at.desc&limit=200`);
  if (!rows) return { code: 503, corps: { ok: false, raison: 'base' } };
  const signalements = rows.map((x) => {
    const s = normaliserSignalement({ texte: x.texte, ecran: x.ecran, ecranAvant: x.ecranAvant, version: x.version, extension: x.extension, navigateur: x.navigateur, appareil: x.appareil, systeme: x.systeme, ecranTaille: { largeur: x.largeur, hauteur: x.hauteur } })
      || { texte: '', ecran: '', ecranAvant: '', version: '', extension: null, navigateur: 'inconnu', ecranTaille: null, appareil: null, systeme: null };
    const { plantages, lectures, plan, etatEcran, enLigne, theme, ...leger } = s;   // eslint-disable-line no-unused-vars
    return { id: x.id, ...leger, resume: resumeValide(x.resume), de: UUID.test(String(x.de)) ? String(x.de) : null, repondre: reponseLue(x.repondre), at: dateIso(x.at), traite: String(x.traite) === 'true', traiteLe: dateIso(x.traiteLe) };
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
export async function posterSignalement(signalement, { entetes = {}, fetcher = (typeof fetch === 'function' ? fetch : null), repondreA = false } = {}) {
  try {
    const r = await fetcher('/api/compte?mode=signalement', { method: 'POST', headers: { 'Content-Type': 'application/json', ...entetes }, body: JSON.stringify(repondreA === true ? { ...signalement, repondreA: true } : signalement) });
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
