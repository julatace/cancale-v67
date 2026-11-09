// ── LE CENTRE DE NOTIFICATIONS — la règle de l'écran (5 nov.) ──────────────
// Ce que le serveur a rangé (`push_journal`, écrit par lui seul,
// api/_lib/journal-notifs.js) et ce qu'il a LU (`push_journal_lu`, écrit par
// l'app seule). Pur : aucune lecture, aucune écriture, aucun React.
//
// ⚠️ « Pas su » ≠ « rien » : un journal illisible rend `null` et l'écran dit
//    « — » ; un journal lu et vide dit « Aucune notification ». Le compte des
//    non-lues se lit en deux SCALAIRES (le dernier numéro `n`, et `luJusqua`) :
//    pas besoin de charger la liste pour poser la pastille de la cloche.

export const TYPES_CENTRE = [
  { id: 'ventes', titre: 'Ventes' },
  { id: 'offres', titre: 'Offres' },
  { id: 'messages', titre: 'Messages' },
  { id: 'poster', titre: 'Colis à poster' },
  { id: 'arrives', titre: 'Codes de retrait' },
  { id: 'doublevente', titre: 'Double vente' },
  { id: 'rappels', titre: 'Rappels' },
];
import { embellir, GENRES } from '../api/_lib/notif-belle.js';
// Ce que l'écran dit d'une notification qui n'a PAS sonné (rien pour « envoyée »).
export const ETAT_CENTRE = {
  calme: 'Heures calmes',
  discret: 'Sans sonnerie',
  'sans-appareil': 'Aucun appareil',
  serveur: 'Pas envoyée',
  echec: 'Pas reçue',
};
const ent = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);

// Une entrée bien formée (ce que l'écran accepte de montrer), sinon `null`.
export function entreeSure(x) {
  if (!x || typeof x !== 'object' || !Number.isSafeInteger(x.seq) || x.seq <= 0) return null;
  const t = Date.parse(x.at || '');
  if (!Number.isFinite(t)) return null;
  const url = typeof x.url === 'string' && /^\/(\?[A-Za-z0-9_=&%.-]{0,600})?$/.test(x.url) ? x.url : '/';
  // (8 nov.) Le MÊME texte que le téléphone (api/_lib/notif-belle.js) : les
  // entrées rangées avant le 8 nov. perdent leurs emoji ici aussi.
  const v = embellir({ title: String(x.titre || '').slice(0, 120), body: String(x.texte || '').slice(0, 240) }, x.cat);
  return {
    seq: x.seq, t, famille: typeof x.famille === 'string' ? x.famille : '',
    titre: v.title, texte: v.body,
    genre: typeof x.genre === 'string' && GENRES.some((g) => g.id === x.genre) ? x.genre : null,
    url, etat: typeof x.etat === 'string' ? x.etat : 'envoyee',
  };
}
// Le journal lu (`data` de la ligne) → la liste triée, la plus récente d'abord.
// `null` (pas su) reste `null`.
export function entreesDuJournal(data) {
  if (data === null || data === undefined) return null;
  const l = data && Array.isArray(data.entrees) ? data.entrees.map(entreeSure).filter(Boolean) : [];
  return l.sort((a, b) => b.seq - a.seq);
}
// Lue ? Toute entrée jusqu'à `luJusqua`, plus celles touchées une par une.
export function estLue(e, lu) {
  if (!e) return true;
  const l = lu && typeof lu === 'object' ? lu : {};
  return e.seq <= ent(l.luJusqua) || (Array.isArray(l.lus) && l.lus.includes(e.seq));
}
// Le nombre de non-lues, à partir des scalaires. `n` inconnu ⇒ `null`.
// `depuis` (le plus petit numéro encore gardé par le serveur) : une entrée
// purgée n'est plus dans la liste, elle ne compte plus dans la pastille.
export function nombreNonLues(n, lu, depuis = 1) {
  if (!Number.isSafeInteger(n) || n < 0) return null;
  const l = lu && typeof lu === 'object' ? lu : {};
  const j = Math.max(ent(l.luJusqua), Number.isSafeInteger(depuis) && depuis > 1 ? Math.min(depuis - 1, n) : 0);
  const une = new Set((Array.isArray(l.lus) ? l.lus : []).filter((s) => Number.isSafeInteger(s) && s > j && s <= n));
  return Math.max(0, n - j - une.size);
}
// Marquer des entrées lues. Les numéros qui suivent `luJusqua` sans trou le font
// avancer ; les autres restent dans `lus` (au plus 300, les plus récents).
export function marquerLues(lu, seqs) {
  const l = lu && typeof lu === 'object' ? lu : {};
  let j = ent(l.luJusqua);
  const s = new Set([...(Array.isArray(l.lus) ? l.lus : []), ...(seqs || [])].filter((x) => Number.isSafeInteger(x) && x > j));
  while (s.has(j + 1)) { s.delete(j + 1); j += 1; }
  return { luJusqua: j, lus: [...s].sort((a, b) => b - a).slice(0, 300) };
}
// (5 nov., intégration) Deux appareils qui marquent lu en même temps : ce qui
// est lu ne fait que GRANDIR. La fusion de deux états lus est leur union —
// jamais une entrée lue d'un côté ne redevient non lue.
export function fusionnerLus(a, b) {
  const x = a && typeof a === 'object' ? a : {}, y = b && typeof b === 'object' ? b : {};
  return marquerLues({ luJusqua: Math.max(ent(x.luJusqua), ent(y.luJusqua)), lus: [] },
    [...(Array.isArray(x.lus) ? x.lus : []), ...(Array.isArray(y.lus) ? y.lus : [])]);
}
export const toutLu = (n, lu) => ({ luJusqua: Math.max(ent(n), ent(lu && lu.luJusqua)), lus: [] });

// Rangées par jour : « Aujourd'hui », « Hier », puis la date (heure de l'appareil).
const jourDe = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
export function parJour(entrees, maintenant = Date.now()) {
  const out = [];
  const auj = jourDe(maintenant), hier = jourDe(maintenant - 86400e3);
  for (const e of entrees || []) {
    const cle = jourDe(e.t);
    let g = out[out.length - 1];
    if (!g || g.cle !== cle) {
      const titre = cle === auj ? 'Aujourd’hui' : cle === hier ? 'Hier'
        : new Date(e.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      g = { cle, titre, items: [] }; out.push(g);
    }
    g.items.push(e);
  }
  return out;
}
export const heureCourte = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
// L'adresse à suivre au toucher : la partie `?…` d'un chemin de l'app, ou `null`.
export const rechercheDe = (url) => (typeof url === 'string' && /^\/\?/.test(url) ? url.slice(1) : null);

// (8 nov.) LE MÊME REGROUPEMENT QUE LE TÉLÉPHONE : dans un jour, les entrées d'un
// même genre (« bordereau », « vente », « offre »…) deviennent UNE ligne
// (« 3 bordereaux prêts à imprimer ») placée à la plus récente, dépliable.
// Une seule entrée d'un genre reste une ligne simple.
export function regrouperLignes(items) {
  const parGenre = new Map();
  for (const e of items || []) if (e && e.genre) parGenre.set(e.genre, [...(parGenre.get(e.genre) || []), e]);
  const out = [], places = new Set();
  for (const e of items || []) {
    const l = e && e.genre ? parGenre.get(e.genre) : null;
    if (l && l.length > 1) {
      if (places.has(e.genre)) continue;
      places.add(e.genre);
      const g = GENRES.find((x) => x.id === e.genre);
      out.push({ groupe: true, cle: 'g-' + e.genre + '-' + e.seq, genre: e.genre, titre: g ? g.titre(l.length) : `${l.length} notifications`, famille: e.famille, t: e.t, url: g ? g.url : '/', items: l });
    } else out.push(e);
  }
  return out;
}
// L'heure dite comme un téléphone : « À l'instant », « Il y a 5 min », « Il y a 2 h »,
// puis l'heure (le jour est dans l'intertitre).
export function quandRelatif(t, maintenant = Date.now()) {
  const d = maintenant - t;
  if (!Number.isFinite(d) || d < 0) return heureCourte(t);
  if (d < 60e3) return 'À l’instant';
  if (d < 3600e3) return `Il y a ${Math.floor(d / 60e3)} min`;
  if (d < 6 * 3600e3) return `Il y a ${Math.floor(d / 3600e3)} h`;
  return heureCourte(t);
}
