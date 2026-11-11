// ── AU RÉVEIL : CE QUI EST ARRIVÉ PENDANT LES HEURES CALMES (5 nov.) ─────────
// Pendant ses heures calmes, rien ne sonne : la notification est rangée dans la
// cloche (`push_journal`, état `calme`) et ne sonnait JAMAIS ensuite — il ne la
// voyait qu'en ouvrant VRM. À la fin des heures calmes, UNE notification dit ce
// qui attend : « Pendant tes heures calmes : 2 ventes · 1 offre », et ouvre la
// cloche. Rien n'est inventé : seules les entrées `calme` des dernières 24 h,
// encore NON LUES, sont comptées ; zéro ⇒ rien ne part.
//
// Le déclencheur : `api/ship-reminders.js?moment=reveil`, appelé toutes les
// 30 minutes le matin (`.github/workflows/reveil-notifs.yml`). La fenêtre est
// de 3 heures après la fin des heures calmes (un appel GitHub peut être en
// retard) ; un seul récapitulatif par jour (`push_reveil`, écrit AVANT l'envoi :
// un envoi raté ne part pas deux fois).
import { reglageCalme, minutesParis, FAMILLES, reglageJours, jourCalme } from './notif-textes.js';

export const ID_REVEIL = 'push_reveil';
export const FENETRE_MIN = 180;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutesDe = (h) => { const m = HHMM.exec(String(h || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// La date de Paris (AAAA-MM-JJ) d'un instant.
export function jourParis(t) {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t));
    const v = (k) => (p.find((x) => x.type === k) || {}).value;
    return `${v('year')}-${v('month')}-${v('day')}`;
  } catch (_) { return null; }
}

const estLue = (e, lu) => {
  const j = Number.isSafeInteger(lu && lu.luJusqua) ? lu.luJusqua : 0;
  return e.seq <= j || (Array.isArray(lu && lu.lus) && lu.lus.includes(e.seq));
};
// Le singulier de chaque famille, écrit à la main (« colis » ne perd pas son s).
const SINGULIER = { ventes: 'vente', offres: 'offre', messages: 'message', poster: 'colis à poster', arrives: 'code de retrait', doublevente: 'double vente', rappels: 'rappel', autres: 'autre' };
const PLURIEL = { doublevente: 'doubles ventes' };
const accord = (n, id, titre) => (n > 1 ? `${n} ${PLURIEL[id] || titre.toLowerCase()}` : `1 ${SINGULIER[id] || titre.toLowerCase()}`);

// Rend `{ envoyer: false, raison }` ou `{ envoyer: true, jour, title, body, url, n }`.
// `lu` : `null` = pas su ⇒ on ne compte rien (« pas su » n'invente pas un nombre).
// (11 nov.) LES JOURS CALMES : un jour calme, rien ne part (le réveil attend le
// premier matin non calme) ; ce matin-là, tout ce qui a été gardé depuis le
// dernier récapitulatif (`dejaSeq`, le plus grand numéro déjà dit) est compté —
// un week-end entier, des congés — au plus 30 jours (la cloche n'en garde pas plus).
// Sans `dejaSeq` (mémo d'avant) : depuis le dernier récapitulatif (`dejaAt`) ; sans
// aucun récapitulatif, 30 jours si des jours calmes sont posés, sinon 24 h comme avant.
// Toujours les seules NON LUES.
export function resumeReveil({ prefs, journal, lu, dejaJour, dejaSeq = null, dejaAt = null, maintenant }) {
  const c = reglageCalme(prefs);
  const rj = reglageJours(prefs);
  if (!c.actif && !rj.jours.length && !rj.conges) return { envoyer: false, raison: 'calme-eteint' };
  if (jourCalme(prefs, maintenant)) return { envoyer: false, raison: 'jour-calme' };
  const f = minutesDe(c.fin), d = minutesDe(c.debut), m = minutesParis(maintenant);
  if (f == null || d == null || m == null || d === f) return { envoyer: false, raison: 'reglage' };
  const depuisFin = (m - f + 1440) % 1440;
  if (depuisFin >= FENETRE_MIN) return { envoyer: false, raison: 'pas-l-heure' };
  const jour = jourParis(maintenant);
  if (!jour) return { envoyer: false, raison: 'reglage' };
  if (dejaJour === jour) return { envoyer: false, raison: 'deja' };
  if (lu === null || journal === null) return { envoyer: false, raison: 'pas-su' };
  const entrees = journal && Array.isArray(journal.entrees) ? journal.entrees : [];
  const parFamille = new Map();
  let seule = null, seqMax = Number.isSafeInteger(dejaSeq) ? dejaSeq : 0, plusVieux = maintenant;
  const depuis = Date.parse(String(dejaAt || ''));
  const ageMax = Number.isSafeInteger(dejaSeq) ? 30 * 86400e3
    : Number.isFinite(depuis) ? Math.min(30 * 86400e3, Math.max(0, maintenant - depuis))
    : (rj.jours.length || rj.conges) ? 30 * 86400e3 : 86400e3;
  for (const e of entrees) {
    if (!e || e.etat !== 'calme' || !Number.isSafeInteger(e.seq)) continue;
    if (Number.isSafeInteger(dejaSeq) && e.seq <= dejaSeq) continue;
    const at = Date.parse(e.at);
    if (!Number.isFinite(at) || at > maintenant || maintenant - at > ageMax) continue;
    seqMax = Math.max(seqMax, e.seq); plusVieux = Math.min(plusVieux, at);
    if (estLue(e, lu || {})) continue;
    parFamille.set(e.famille, (parFamille.get(e.famille) || 0) + 1);
    seule = e;
  }
  const n = [...parFamille.values()].reduce((a, b) => a + b, 0);
  if (!n) return { envoyer: false, raison: 'rien', jour };
  const morceaux = FAMILLES.filter((x) => parFamille.get(x.id)).map((x) => accord(parFamille.get(x.id), x.id, x.titre));
  const autres = n - FAMILLES.reduce((a, x) => a + (parFamille.get(x.id) || 0), 0);
  if (autres > 0) morceaux.push(accord(autres, 'autres', 'Autres'));
  // (8 nov.) UNE seule gardée : elle sonne telle quelle (son titre, son geste, son
  // écran) — « 1 notification · 1 code de retrait » ne disait pas lequel.
  if (n === 1 && seule && seule.titre) {
    return { envoyer: true, jour, n, seq: seqMax, title: seule.titre, body: seule.texte || '', url: typeof seule.url === 'string' && seule.url.startsWith('/') ? seule.url : '/?tab=journee&cloche=1' };
  }
  return {
    envoyer: true, jour, n, seq: seqMax,
    // Gardées depuis plus d'un jour (week-end, congés) : « Pendant ta pause ».
    title: `${maintenant - plusVieux > 86400e3 ? 'Pendant ta pause' : 'Cette nuit'} : ${n} notification${n > 1 ? 's' : ''}`,
    body: morceaux.join(' · '),
    url: '/?tab=journee&cloche=1',
  };
}
