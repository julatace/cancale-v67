// api/_lib/notif-groupe.js
// ────────────────────────────────────────────────────────────────────────────
// (11 nov., lot `notifs-groupees`) UN RÉSUMÉ AU LIEU DE PLUSIEURS ALERTES.
//
// Principe de Julien : « plus beau, simple, surtout PRATIQUE : les gens doivent
// gagner du temps ». Trois bordereaux, deux codes et une offre en dix minutes
// faisaient six sonneries. Désormais :
//
// 1. LA FENÊTRE (15 min par défaut, réglable : 15 · 30 · 60 ; `push_prefs.groupe.fenetre`).
//    La PREMIÈRE notification sonne tout de suite. Celles qui suivent dans la
//    fenêtre attendent (cloche : « Dans le prochain résumé »). À la fin de la
//    fenêtre, UNE notification les dit toutes : « 2 colis à poster · 1 colis à
//    retirer ». Elle part au prochain envoi, ou au passage de 15 min
//    (`api/ship-reminders.js?moment=groupe`, .github/workflows/notifs-groupees.yml).
//    Seuls les ÉVÉNEMENTS par objet se mettent en attente (les genres de
//    api/_lib/notif-belle.js : bordereau, vente, versement, arrivée, offre,
//    message). Un rappel (matin, soir, URSSAF…) est déjà un résumé : il sonne.
//    `regrouper: false` posé à la main ⇒ aucune fenêtre (son choix est gardé).
// 2. L'URGENT PASSE TOUT DE SUITE : une échéance (date limite d'envoi ou de
//    retrait) dans moins de 24 h, ou la double vente. Jamais mis en attente.
// 3. JAMAIS DEUX FOIS LA MÊME CHOSE : une clé par objet ET par jour (Paris) —
//    `cle` posée par l'émetteur, sinon son étiquette d'objet (`tag`) et le fait
//    (le titre). Déjà rangée aujourd'hui ⇒ rien ne part, rien n'est rangé.
// 4. LES CHIFFRES DU RÉSUMÉ ne sont pas recalculés : ce sont les objets
//    annoncés (un par clé), chacun déjà décidé par la règle de son émetteur
//    (§5 « un propriétaire »). Le résumé dit « 2 colis à poster », jamais un
//    total d'écran qu'il ne connaît pas.
// Pur : aucune lecture, aucune écriture — l'app (Paramètres) l'importe aussi.
// ────────────────────────────────────────────────────────────────────────────
import { regrouper } from './notif-textes.js';
import { GENRES, genreDe, couper, sansEmoji, TITRE_MAX, CORPS_MAX } from './notif-belle.js';

export const FENETRES = [15, 30, 60];
// `0` posé à la main (bancs, ou un vendeur qui veut le regroupement par genre
// sans attente) : aucune fenêtre. L'écran propose 15 · 30 · 60 ou « Non ».
export const FENETRE_DEFAUT = 15;
export const URGENCE_MS = 24 * 3600e3;

// La fenêtre du vendeur, en minutes (0 = chaque notification sonne seule).
export function fenetreGroupe(prefs) {
  if (!regrouper(prefs)) return 0;
  const g = prefs && prefs.groupe && typeof prefs.groupe === 'object' ? prefs.groupe : {};
  const f = Number(g.fenetre);
  return f === 0 || FENETRES.includes(f) ? f : FENETRE_DEFAUT;
}

const msDe = (v) => (typeof v === 'number' ? v : Date.parse(String(v || '')));
// Urgent : la double vente, ou une échéance FUTURE dans moins de 24 h.
export function estUrgent({ cat = null, echeance = null } = {}, t = Date.now()) {
  if (cat === 'doublevente') return true;
  const e = msDe(echeance);
  return Number.isFinite(e) && e > t && e - t <= URGENCE_MS;
}

// Ce qui peut attendre dans la fenêtre : un événement par objet (un genre).
export const enAttentePossible = (tag) => !!genreDe(tag);

// La date de Paris (AAAA-MM-JJ) d'un instant.
export function jourDeParis(t = Date.now()) {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t));
    const v = (k) => (p.find((x) => x.type === k) || {}).value;
    return `${v('year')}-${v('month')}-${v('day')}`;
  } catch (_) { return null; }
}
const norm = (s) => sansEmoji(s).toLowerCase().replace(/\d+(?:[.,]\d+)?\s*€/g, '€').slice(0, 60);
// La clé d'idempotence : objet + jour. Sans objet nommé (ni `cle`, ni `tag`) ⇒
// `null` : rien à comparer, la notification n'est pas dédoublonnée ici.
export function cleDuJour({ cle = '', tag = '', title = '' } = {}, t = Date.now()) {
  const jour = jourDeParis(t);
  if (!jour) return null;
  const c = String(cle || '').trim();
  const g = String(tag || '').trim();
  const objet = c || (g ? `${g}|${norm(title)}` : '');
  return objet ? `${jour}|${objet}`.slice(0, 160) : null;
}

// ── LE TEXTE DU RÉSUMÉ ──────────────────────────────────────────────────────
// Une phrase par genre (dans cet ordre : ce qui presse d'abord). Les mêmes mots
// que l'écran : « à poster » (Ventes · À expédier), « à retirer » (Achats).
const PHRASE = {
  bordereau: (k) => `${k} colis à poster`,
  arrivee: (k) => `${k} colis à retirer`,
  vente: (k) => `${k} vente${k > 1 ? 's' : ''}`,
  argent: (k) => `${k} versement${k > 1 ? 's' : ''}`,
  offre: (k) => `${k} offre${k > 1 ? 's' : ''}`,
  message: (k) => `${k} message${k > 1 ? 's' : ''}`,
};
const GESTE = { bordereau: 'Colis à poster', arrivee: 'Colis à retirer', vente: 'Ventes', argent: 'Ventes', offre: 'Offres', message: 'Messages' };
// (11 nov.) L'heure du résumé du soir (`push_prefs.resumeSoir`, « HH:MM »).
// Absente ⇒ le passage habituel (cron Vercel, 18:00 UTC : 19 h l'hiver, 20 h l'été).
export const HEURES_SOIR = ['18:00', '19:00', '20:00', '21:00'];
export const heureSoir = (prefs) => (prefs && HEURES_SOIR.includes(prefs.resumeSoir) ? prefs.resumeSoir : null);
export const ORDRE_GENRES = ['bordereau', 'arrivee', 'vente', 'argent', 'offre', 'message'];

// `entrees` : les notifications du résumé (rangées dans la cloche, avec leur
// `genre`, `titre`, `texte`, `url`). Rend `null` (rien) ou
// `{ title, body, url, actions, n, parGenre }`.
//   · une seule ⇒ elle-même (son titre, son écran) ;
//   · un seul genre ⇒ le titre du genre (« 3 bordereaux prêts à imprimer ») et sa liste ;
//   · plusieurs genres ⇒ « 2 colis à poster · 1 colis à retirer », l'écran du
//     premier genre, et un geste par genre (Android ; iOS ouvre le premier).
export function resumeDeGroupe(entrees) {
  const l = (Array.isArray(entrees) ? entrees : []).filter((e) => e && typeof e === 'object');
  if (!l.length) return null;
  if (l.length === 1) {
    const e = l[0];
    return { title: couper(e.titre || 'VRM', TITRE_MAX), body: couper(e.texte || '', CORPS_MAX), url: e.url || '/', actions: [], n: 1, parGenre: { [e.genre || 'autre']: 1 } };
  }
  const par = new Map();
  for (const e of l) { const g = e.genre && PHRASE[e.genre] ? e.genre : 'autre'; par.set(g, (par.get(g) || 0) + 1); }
  const genres = [...ORDRE_GENRES.filter((g) => par.has(g)), ...(par.has('autre') ? ['autre'] : [])];
  const derniere = l.reduce((a, b) => ((b.seq || 0) > (a.seq || 0) ? b : a), l[0]);
  const detail = `Dernier : ${[derniere.titre, derniere.texte].filter(Boolean).join(' · ')}`;
  const parGenre = Object.fromEntries(par);
  const urlDe = (g) => { const G = GENRES.find((x) => x.id === g); return G ? G.url : (derniere.url || '/'); };
  if (genres.length === 1) {
    const g = genres[0], k = par.get(g);
    const G = GENRES.find((x) => x.id === g);
    const memeUrl = l.every((e) => e.url === l[0].url) ? l[0].url : null;
    return { title: couper(G ? G.titre(k) : `${k} notifications`, TITRE_MAX), body: couper(detail, CORPS_MAX), url: memeUrl || urlDe(g), actions: [], n: l.length, parGenre };
  }
  const phrases = genres.map((g) => (g === 'autre' ? `${par.get(g)} autre${par.get(g) > 1 ? 's' : ''}` : PHRASE[g](par.get(g))));
  let title = '';
  for (let i = 0; i < phrases.length; i++) {
    const t = phrases.slice(0, i + 1).join(' · ');
    if (t.length > TITRE_MAX) break;
    title = t;
  }
  const restes = phrases.slice(title ? title.split(' · ').length : 0);
  if (!title) title = `${l.length} notifications`;
  const body = couper([restes.join(' · '), detail].filter(Boolean).join(' · '), CORPS_MAX);
  const actions = genres.filter((g) => g !== 'autre').slice(0, 2).map((g) => ({ action: `g-${g}`, title: GESTE[g], url: urlDe(g) }));
  return { title, body, url: urlDe(genres.find((g) => g !== 'autre') || genres[0]), actions, n: l.length, parGenre };
}
