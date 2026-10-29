// api/_lib/transporteurs-notif.js
// ────────────────────────────────────────────────────────────────────────────
// (24 oct.) LA NOTIFICATION D'UN CHANGEMENT D'ÉTAT LU CHEZ LE TRANSPORTEUR (§1.8).
// Seul un CHANGEMENT d'ÉTAT sonne (un libellé de transit de plus ne sonne pas :
// Mondial Relay a 6 libellés de transit, Chronopost 10 codes — ce serait du bruit
// permanent). La règle du changement et ses textes vivent dans
// api/_lib/transporteurs.js (pure) ; ici, ce qui écrit et envoie :
//   1. la préférence (« colis » pour un geste à faire, « suivi » pour le reste) ;
//   2. le silence si une autre voie l'a DÉJÀ annoncé — par une IDENTITÉ : le n°
//      (`relais-{n°}-*`, `retour-{n°}`, `retire-{n°}`…), la transaction reliée
//      (`relais-tx{tx}-*`), le code de retrait de l'e-mail (`retrait-code-{CODE}`) ;
//   3. (29 oct., revues n° 14 et 16) LA VÉRIFICATION ET LA RÉSERVATION EN UN
//      SEUL comparer-et-échanger sur `push_dedup` (`data.rev`, la règle
//      `modifierCas`) : le modificateur relit les clés au moment d'écrire et
//      ABANDONNE si l'une est apparue (un e-mail « disponible » traité pendant
//      le passage, le suivi Vinted de la même transaction) — deux voies, deux
//      passages : une notification. On réserve, PUIS on envoie.
//      (Avant : lire `push_dedup`, réserver `push_transp_{n°}`, puis écrire la
//      clé — l'e-mail passé entre les deux sonnait, le passage aussi.)
// Jamais sur un évènement de plus de 72 h (la fermeture des anciens n° comprise :
// `silence`), une préférence coupée, un abonnement coupé.
// (29 oct., revue n° 13) « PAS SU » NE CONSOMME RIEN : ce qui doit sonner est
// écrit DANS la ligne `transp_` (`notif`, `notifEnAttente`) par le même
// comparer-et-échanger que le changement ; la notification l'efface une fois
// FAITE ou DÉCIDÉE (déjà annoncée, préférence, abonnement…). Une base qui
// hoquette au moment de sonner la laisse : le passage suivant la reprend
// (`reprendreNotifs`), dans les 72 h.
// ────────────────────────────────────────────────────────────────────────────
import { sendPushToAll, pushCategorieActive } from './push.js';
import { modifierCas } from './suivi-vinted.js';
import { changementANotifier, texteNotifTransp, clesEtapeTx, NOTIF_AGE_MAX_MS } from './transporteurs.js';
import { normaliserSuivi } from './etat-colis-email.js';
import { cleCodeRetrait } from '../email-inbound.js';

const msDe = (v) => { const ms = Date.parse(String(v || '')); return Number.isFinite(ms) ? ms : null; };

// `t` : la ligne `transp_` (après l'essai), `ch` : ce qui doit sonner (la règle
// `changementANotifier`). `txs` : les transactions reliées à CE n° par identité ;
// `codes` : les codes de retrait des e-mails de CE n°. Rend { envoye, raison } —
// `raison: 'pas-su'` seulement si RIEN n'a été réservé (à reprendre).
export async function envoyerNotifTransp(t, ch, { txs = [], codes = [] } = {}) {
  if (!t || !ch || !ch.cle) return { envoye: false, raison: 'rien' };
  if (!(await pushCategorieActive(ch.categorie))) return { envoye: false, raison: 'preference' };
  // La PREMIÈRE arrivée se tait devant toute annonce de l'arrivée (e-mail,
  // conversation, suivi Vinted : `relais-{n°}-*`, `relais-tx{tx}-*`, le code) ;
  // une NOUVELLE arrivée devant sa seule clé (revue n° 12).
  const premiere = ch.etape === 'relais' && !ch.nouvelleArrivee;
  const prefixes = [...(ch.prefixesSilence || []), ...(premiere ? (txs || []).filter(Boolean).map((x) => `relais-tx${x}-`) : [])];
  const exactes = [ch.cle, ...(premiere ? (codes || []).map((c) => cleCodeRetrait(c)).filter(Boolean) : [])];
  const aEcrire = [ch.cle];
  for (const tx of (txs || []).filter(Boolean)) {
    const c = clesEtapeTx(ch.etape, tx, ch.jour);
    if (c.vinted) exactes.push(c.vinted);
    if (c.transp) { exactes.push(c.transp); aEcrire.push(c.transp); }
  }
  const r = await modifierCas('push_dedup', (d) => {
    const ks = (d && Array.isArray(d.keys)) ? d.keys.filter((x) => typeof x === 'string') : [];
    if (ks.some((x) => exactes.includes(x) || prefixes.some((p) => x.startsWith(p)))) return undefined;
    return { ...(d || {}), keys: [...aEcrire.filter((x) => !ks.includes(x)), ...ks].slice(0, 300) };
  });
  if (r === null) return { envoye: false, raison: 'pas-su' };
  if (r === false) return { envoye: false, raison: 'deja-annonce' };
  const txt = texteNotifTransp(t, ch);
  const e = await sendPushToAll({ title: txt.title, body: txt.body, tag: ch.cle, url: '/?tab=cat_achats' });
  if (e && e.coupe) return { envoye: false, raison: 'abonnement' };
  if (!e || !(Number(e.sent) > 0)) return { envoye: false, raison: e && e.erreur ? 'envoi-impossible' : 'aucun-appareil' };
  return { envoye: true, raison: ch.etat };
}

// Toujours exportée (la règle complète, pour qui a `avant`/`apres`).
export async function notifierChangementTransp(avant, apres, { arriveeMs = null, silence = false, maintenant = Date.now(), txs = [], codes = [] } = {}) {
  const ch = changementANotifier(avant, apres, { maintenant, arriveeMs, silence });
  if (!ch) return { envoye: false, raison: 'rien' };
  return envoyerNotifTransp({ ...apres, suivi: normaliserSuivi(apres.suivi) }, ch, { txs, codes });
}

// La notification EN ATTENTE d'une ligne : encore à faire ? (même état, moins de
// 72 h) — sinon elle tombe.
export function notifEncoreValable(t, maintenant = Date.now()) {
  const n = t && t.notif;
  if (!n || !n.cle || t.notifEnAttente !== n.cle || t.etat !== n.etat) return false;
  const at = msDe(t.etatAt);
  return at != null && maintenant - at <= NOTIF_AGE_MAX_MS;
}
