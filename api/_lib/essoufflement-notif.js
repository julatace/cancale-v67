// ═══════════════════════════════════════════════════════════════════════════
// « 3 ANNONCES S'ESSOUFFLENT » — LA NOTIFICATION (28 nov., choix de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// La règle et les mots : src/essoufflement.js (pur, importé tel quel). L'écran « À republier » (Annonces) compte les
// annonces essoufflées et appelle `/api/push` (action `essouffle`, `n` seulement — un nombre, jamais un titre ni un compte).
//   · ÉTEINTE PAR DÉFAUT : seul `push_prefs.essouffle === true` (Réglages → Notifications, SON interrupteur) l'allume ;
//     la famille « Rappels » décide aussi (`pushCategorieActive`), heures calmes et plafonds de `sendPushToAll` compris ;
//   · UNE PAR JOUR AU PLUS (jour de Paris) : le mémo `vrm_essouffle_dit` (écrit par le serveur seul) est écrit AVANT
//     d'envoyer — mémo illisible ou pas écrit ⇒ rien n'est envoyé ;
//   · aucune carte, aucun rappel répété (§2.10) : rien d'autre ne sonne, rien n'est relancé.
// ═══════════════════════════════════════════════════════════════════════════
import { CAT_ESSOUFFLE, notificationEssouffle, jourParis } from '../../src/essoufflement.js';
import { getRowVendeur, ecrireVendeur } from './veille-chiffres.js';
import { proprietaireCourant } from './owner.js';
import { sendPushToAll, pushCategorieActive, prefsDuVendeur } from './push.js';

export const MEMO_ESSOUFFLE = 'vrm_essouffle_dit';
export const essouffleAllume = (prefs) => !!(prefs && typeof prefs === 'object' && prefs.essouffle === true);

// `prefs()` : push_prefs (null = pas su ⇒ le défaut : éteinte). `getRow(id)` : objet · null · undefined (pas su).
// `ecrire(id, data)` : vrai si la base a confirmé. `pousser(notif)` : `sendPushToAll`. `active()` : la famille.
export async function notifierEssoufflees({ n, prefs, getRow, ecrire, pousser, active = async () => true, maintenant = Date.now() }) {
  const k = Number(n);
  if (!Number.isInteger(k) || k < 1 || k > 5000) return { envoye: false, raison: 'nombre invalide' };
  if (!essouffleAllume(await prefs())) return { envoye: false, raison: 'désactivé par le vendeur' };
  if (!(await active())) return { envoye: false, raison: 'désactivé par le vendeur' };
  const memo = await getRow(MEMO_ESSOUFFLE);
  if (memo === undefined) return { envoye: false, raison: 'mémo illisible — rien envoyé' };
  const jour = jourParis(maintenant);
  if (memo && memo.jour === jour) return { envoye: false, raison: 'déjà aujourd’hui' };
  if (!(await ecrire(MEMO_ESSOUFFLE, { jour, n: k, at: new Date(maintenant).toISOString() }))) return { envoye: false, raison: 'mémo non écrit — rien envoyé' };
  const txt = notificationEssouffle(k);
  if (!txt) return { envoye: false, raison: 'texte vide' };
  const envoi = await pousser({ cat: CAT_ESSOUFFLE, ...txt });
  return { envoye: true, n: k, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// La version « route » (`/api/push`, action `essouffle`) : au nom du vendeur de la session.
export async function notifierEssouffleesDuVendeur(body, { maintenant = Date.now() } = {}) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, raison: 'vendeur inconnu' };
  const r = await notifierEssoufflees({ n: body && body.n, prefs: prefsDuVendeur, getRow: getRowVendeur, ecrire: ecrireVendeur, pousser: sendPushToAll,
    active: () => pushCategorieActive(CAT_ESSOUFFLE), maintenant });
  return { status: r.raison === 'nombre invalide' ? 400 : /illisible|non écrit/.test(String(r.raison || '')) ? 503 : 200, ...r };
}
