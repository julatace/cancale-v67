// ════════════════════════════════════════════════════════════════════════════
//  COLIS À RETIRER, LA VUE (20 nov., Julien : « Colis à retirer beaucoup plus visuel, c'est pas exceptionnel,
//  tu peux encore faire »). Règles PURES de présentation, aucune lecture, aucune donnée inventée :
//  les points viennent de `pointsARetirer` (src/relaisColis.js) sur la liste `pickupUnion` ; ici on les TRIE
//  (le plus urgent d'abord), on les RÉSUME (« 15 colis · 6 points · 2 à retirer avant demain »), on écrit le
//  COMPTE À REBOURS d'une date limite LUE (« demain · 10 h », « dans 4 j ») et le lien « Itinéraire ».
//  Pas lu ⇒ rien (jamais une date estimée présentée comme lue : `jours` vient de la limite lue de CE colis).
// ════════════════════════════════════════════════════════════════════════════

// Le délai du point : la date limite LUE la plus proche de ses colis comptés (`jours`, posé par l'écran),
// sinon `null` (pas su). L'heure, quand une source la donne (Vinted Go `limiteAt`) : « 10 h ».
export function limiteDuPoint(p) {
  let best = null;
  for (const x of (p && p.arrives) || []) {
    if (!x || x.aVerifier || x.horsCompte) continue;
    // Une limite ESTIMÉE (garde du transporteur, « vers le ») n'est jamais un compte à rebours (src/contenuColis.js `limiteDuColis`).
    if (x.limite && typeof x.limite === 'object' && x.limite.source && x.limite.source !== 'lue') continue;
    const j = Number.isFinite(x.jours) ? x.jours : null;
    if (j == null) continue;
    const at = (x.limite && typeof x.limite === 'object' && x.limite.at) || x.limiteAt;
    if (!best || j < best.jours) best = { jours: j, heure: heureLimite(at) };
    else if (j === best.jours && !best.heure) best.heure = heureLimite(at);
  }
  return best;
}
// « 10 h », « 18 h 30 » (heure de Paris) depuis une date ISO ; '' si absente ou minuit pile (une date sans heure).
export function heureLimite(iso) {
  const ms = Date.parse(String(iso || ''));
  if (!Number.isFinite(ms)) return '';
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    const H = Number(p.hour), M = Number(p.minute);
    if (!Number.isFinite(H) || (H === 0 && M === 0)) return '';
    return M ? `${H} h ${String(M).padStart(2, '0')}` : `${H} h`;
  } catch (_) { return ''; }
}
// Le compte à rebours : { cle, n, heure, ambre } — la phrase est écrite par l'écran (`tr`). Pas su ⇒ null.
//   jours < 0 ⇒ 'depasse' · 0 ⇒ 'aujourdhui' · 1 ⇒ 'demain' (ambre) · n ⇒ 'dans' (neutre)
export function compteARebours(lim) {
  if (!lim || !Number.isFinite(lim.jours)) return null;
  const j = lim.jours, heure = lim.heure || '';
  if (j < 0) return { cle: 'depasse', n: -j, heure: '', ambre: true };
  if (j === 0) return { cle: 'aujourdhui', n: 0, heure, ambre: true };
  if (j === 1) return { cle: 'demain', n: 1, heure, ambre: true };
  return { cle: 'dans', n: j, heure: '', ambre: false };
}

// Le plus urgent d'abord : la limite lue la plus proche, puis le tri de l'écran (`triPoint` : la garde de son
// transporteur), puis le plus chargé, puis le nom. Un point sans colis compté n'est pas une carte.
export function trierPoints(points) {
  // Un point dont aucun colis ne compte (tous « à vérifier ») passe après les autres.
  const cle = (p) => { if (!(p.arrives || []).some(colisCompte)) return 1000; const l = limiteDuPoint(p); return l ? l.jours : (Number.isFinite(p.triPoint) ? p.triPoint : 99); };
  return [...(points || [])].sort((a, b) => cle(a) - cle(b) || (b.arrives || []).length - (a.arrives || []).length || String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
}

// La bande en tête : { colis, points, urgents } — urgents = colis dont la limite LUE tombe aujourd'hui ou demain
// (ou est passée) : « à retirer avant demain ».
// + `verif` : les colis « à vérifier » montrés dans les cartes (date limite dépassée…) — dits à part, jamais comptés.
export function resumeRetraits(points) {
  let colis = 0, urgents = 0, n = 0, verif = 0;
  for (const p of points || []) {
    const l = (p.arrives || []).filter((x) => x && !x.aVerifier && !x.horsCompte);
    verif += (p.arrives || []).filter((x) => x && !x.redirige && (x.aVerifier || x.horsCompte)).length;
    if (!l.length) continue;
    n++; colis += l.length;
    urgents += l.filter((x) => Number.isFinite(x.jours) && x.jours <= 1).length;
  }
  return { colis, points: n, urgents, verif };
}

// ── RÉTENTION (20 nov., Julien) ─────────────────────────────────────────────
// « Le code de retrait ET le QR restent affichés tant que le colis n'est pas FINI » : retiré (preuve) OU reparti /
// commande annulée (statut PROUVÉ : « retour expéditeur », « non réclamé », annulation). Ces fins-là sont jugées
// en amont, PAR IDENTITÉ (`pickupUnion`, App.jsx : `finsColis`, `finParIdentite`, `finCommandeAchat`) : un colis
// fini n'arrive jamais ici. Tout ce qui arrive reste dans la carte de son point, avec son code et son QR ; une date
// limite dépassée (ou une garde dépassée) n'est PAS une fin : le colis reste, « date limite dépassée · à vérifier »,
// hors du compte (§5 : un colis caché est un colis perdu). Seul un colis RÉACHEMINÉ (`redirige`) a sa propre ligne.
export const colisCompte = (x) => !!x && !x.aVerifier && !x.horsCompte && !x.redirige;
export function colisDuPoint(p) {
  const l = ((p && p.arrives) || []).filter((x) => x && !x.redirige);
  return { comptes: l.filter(colisCompte), verif: l.filter((x) => !colisCompte(x)) };
}
// Pourquoi un colis montré est « à vérifier » — une clé, la phrase est écrite par l'écran (`tr`).
export function mentionVerif(x) {
  if (!x || colisCompte(x)) return '';
  const r = String(x.raisonCode || '');
  if (r === 'delai_depasse') return 'depasse';
  if (r === 'trop_long') return 'trop-long';
  if (r === 'sans_code') return 'sans-code';
  if (r === 'transporteur') return 'transporteur';
  if (r === 'doute_meme_relais') return 'doute';
  return 'autre';
}

// « Itinéraire » : Plans sur un appareil Apple, Google Maps ailleurs (aucune clé, un lien). Le repère SÛR du point
// (`repere`, calculé par l'écran : liste Vinted ou Base Adresse jugée) d'abord, sinon l'adresse écrite ; rien ⇒ ''.
export function lienItineraire(p, { apple = false } = {}) {
  if (!p) return '';
  const r = p.repere && Number.isFinite(Number(p.repere.lat)) && Number.isFinite(Number(p.repere.lon)) ? `${Number(p.repere.lat)},${Number(p.repere.lon)}` : '';
  const adr = [p.nom, p.adresse].filter(Boolean).join(', ').trim();
  const cible = r || (p.adresse ? adr : '');
  if (!cible) return '';
  return apple ? `https://maps.apple.com/?daddr=${encodeURIComponent(cible)}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cible)}`;
}
export const appareilApple = (ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) => /iPhone|iPad|iPod|Macintosh/.test(String(ua || ''));
