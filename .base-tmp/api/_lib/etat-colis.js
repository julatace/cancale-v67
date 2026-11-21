// ─────────────────────────────────────────────────────────────────────────────
// L'ÉTAT D'UN COLIS, PROUVÉ ET DATÉ (6 nov.) — UNE règle, pour l'app (Colis →
// À retirer, la ligne « ce que dit le transporteur »), le widget (api/widget.js)
// et le rappel du matin (api/ship-reminders.js, via `fusionTransporteur`), §11.
// Pure : aucune lecture, aucune écriture. Testée par scripts/bancs/statut-colis.cjs.
//
// Julien (6 nov.) : « Améliore la fiabilité sur le statut de chaque colis, le point
// de retrait, etc. » Mesuré sur sa base (docs/passation/2026-11-06-statut-colis.md) :
// 3 colis arrivés le matin (e-mail « disponible » de 09 h 50, heure de Paris) dont la
// lecture chez Mondial Relay, faite à 09 h 07, disait encore « en route » — la ligne
// du colis l'écrivait « — en route » sous « À retirer jusqu'au… ».
//
// LA RÈGLE, colis par colis, sur des preuves PORTANT SON IDENTITÉ (n° de suivi,
// transaction, code de retrait — jamais le titre ni le lieu) :
//  1. un état FINI prouvé gagne : retiré / livré au destinataire, puis retour
//     reçu, puis annulé (un « retiré » gagne toujours sur un « retour » : la règle
//     de `finsDesLignes`) ;
//  2. sinon, l'état le plus AVANCÉ (en route < disponible) ne recule jamais devant
//     une source plus VIEILLE : une lecture faite AVANT la preuve d'arrivée (son
//     événement ET son heure de lecture avant elle) est « en retard » — dite comme
//     telle, jamais l'état du colis ;
//  3. une source qui dit MOINS avancé avec un événement daté APRÈS la preuve (plus
//     d'une heure après : les horloges des e-mails et des transporteurs diffèrent)
//     contredit la preuve : rien ne l'explique ⇒ « à vérifier », avec la raison ;
//  4. sans date, une preuve compte (elle existe) mais ne contredit rien.
// États : 'en_route' · 'disponible' · 'retire' · 'livre' · 'retour' · 'annule' ·
// 'info' (ne dit rien de la position).
// ─────────────────────────────────────────────────────────────────────────────
export const TOLERANCE_HORLOGES_MS = 3600000;
const RANG = { info: 0, en_route: 1, disponible: 2 };
const FINIS = ['retire', 'livre', 'retour', 'annule'];
export const estFini = (etat) => FINIS.includes(etat);
const msDe = (v) => { if (Number.isFinite(v)) return v; const x = Date.parse(String(v || '')); return Number.isFinite(x) ? x : null; };

// La preuve que porte une LIGNE de suivi (e-mail, SMS, ligne synthétique) — sa forme
// `data` ou ses scalaires (`s`, `a`, `ea`, `r`). L'arrivée est datée par l'e-mail
// d'arrivée (`arriveLe`), sinon la date de l'e-mail.
export function preuveDeLigne(l) {
  if (!l) return null;
  const v = (a, b) => (l[a] != null ? l[a] : l[b]);
  const st = v('status', 's');
  const etat = st === 'delivered' ? 'retire' : st === 'retour' ? 'retour' : st === 'available' ? 'disponible' : st === 'transit' ? 'en_route' : 'info';
  const at = etat === 'disponible' ? (msDe(v('arriveLe', 'a')) ?? msDe(v('emailAt', 'ea')) ?? msDe(v('receivedAt', 'r'))) : (msDe(v('emailAt', 'ea')) ?? msDe(v('receivedAt', 'r')));
  return { etat, at, lu: null, source: l.source === 'sms' ? 'sms' : 'email' };
}
// La preuve que porte la ligne `transp_` (lue chez le transporteur) : l'événement
// (`etatAt`) et l'heure de la lecture (`lu`). Jamais lue ⇒ null (« pas su »).
export function preuveDeTransp(t) {
  if (!t || !t.etat || !t.lu) return null;
  // Un retour (repart ou rendu) est une FIN (`finsDesLignes` la traite) ; un incident ou un
  // statut inconnu ne dit rien de la position (« à vérifier » par sa propre règle).
  const etat = t.etat === 'retour_expediteur' ? 'retour' : t.etat === 'incident' || t.etat === 'inconnu' ? 'info' : t.etat;
  return { etat, at: msDe(t.etatAt), lu: msDe(t.lu), source: 'transporteur', brut: t.etat };
}

// Une lecture (transporteur) EN RETARD sur une preuve plus avancée : elle dit moins,
// et ni son événement ni sa lecture ne sont postérieurs à la preuve.
export function lectureEnRetard(p, preuve) {
  if (!p || !preuve || estFini(p.etat) || estFini(preuve.etat)) return false;
  if ((RANG[p.etat] ?? 0) >= (RANG[preuve.etat] ?? 0) || !Number.isFinite(preuve.at)) return false;
  const quand = Math.max(Number.isFinite(p.at) ? p.at : -Infinity, Number.isFinite(p.lu) ? p.lu : -Infinity);
  return Number.isFinite(quand) && quand < preuve.at;
}
// Une source qui CONTREDIT une preuve plus avancée : elle dit moins, avec un
// événement daté après la preuve (au-delà de la tolérance des horloges).
export function contredit(p, preuve, tol = TOLERANCE_HORLOGES_MS) {
  if (!p || !preuve || estFini(p.etat) || estFini(preuve.etat)) return false;
  if (p.etat === 'info' || (RANG[p.etat] ?? 0) >= (RANG[preuve.etat] ?? 0)) return false;
  return Number.isFinite(p.at) && Number.isFinite(preuve.at) && p.at > preuve.at + tol;
}

const NOMS = { email: 'l’e-mail', sms: 'le SMS', transporteur: 'le transporteur', vinted: 'Vinted', geste: 'ton geste' };
const MOTS = { en_route: 'en route', disponible: 'disponible', retire: 'retiré', livre: 'livré', retour: 'reparti chez l’expéditeur', annule: 'annulé', info: '—' };
// L'état affiché d'UN colis, à partir de toutes ses preuves (règle ci-dessus).
// Rend { etat, at, source, fini, conflit: null | { raison, par, at }, enRetard: [preuves] }
// ou null quand il n'y a aucune preuve (« pas su »).
export function etatProuve(preuves, { tol = TOLERANCE_HORLOGES_MS } = {}) {
  const P = (Array.isArray(preuves) ? preuves : []).filter((p) => p && p.etat);
  if (!P.length) return null;
  const plusRecent = (L) => L.slice().sort((a, b) => (Number.isFinite(b.at) ? b.at : -Infinity) - (Number.isFinite(a.at) ? a.at : -Infinity))[0];
  const ret = P.filter((p) => p.etat === 'retire' || p.etat === 'livre');
  const finis = ret.length ? ret : P.filter((p) => p.etat === 'retour').length ? P.filter((p) => p.etat === 'retour') : P.filter((p) => p.etat === 'annule');
  if (finis.length) { const f = plusRecent(finis); return { etat: f.etat, at: Number.isFinite(f.at) ? f.at : null, source: f.source, fini: true, conflit: null, enRetard: [] }; }
  const rangMax = Math.max(...P.map((p) => RANG[p.etat] ?? 0));
  const tete = plusRecent(P.filter((p) => (RANG[p.etat] ?? 0) === rangMax));
  const enRetard = P.filter((p) => p !== tete && lectureEnRetard(p, tete));
  const c = P.find((p) => p !== tete && contredit(p, tete, tol));
  const conflit = c ? { par: c.source, at: c.at, raison: `${NOMS[c.source] || c.source} dit « ${MOTS[c.etat] || c.etat} » après ${NOMS[tete.source] || tete.source} « ${MOTS[tete.etat] || tete.etat} » : rien ne l’explique` } : null;
  return { etat: tete.etat, at: Number.isFinite(tete.at) ? tete.at : null, source: tete.source, fini: false, conflit, enRetard };
}
