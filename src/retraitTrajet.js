// ════════════════════════════════════════════════════════════════════════════
//  LE TRAJET D'UN COLIS À RETIRER, ÉTAPE PAR ÉTAPE (20 nov., Julien : « barre de progression de chaque colis »).
//  Payé · Expédié · En transit · Au point · Retiré — chaque étape porte la DATE LUE qui la prouve, sinon elle
//  reste grise. ⚠️ Jamais devinée : une étape n'est jamais allumée parce qu'une étape plus loin l'est (un colis
//  « au point » dont aucun évènement ne dit quand il a été remis au transporteur garde « Expédié » gris).
//  Règle PURE, aucune lecture : l'écran lui passe ce qu'il a LU, par identité (§5) :
//    · `payeAt`      — la date de SA commande (l'achat relié par n° de suivi, code ou conversation) ;
//    · `evenements`  — les évènements du transporteur pour SON n° (`transp_{transporteur}_{n°}`, data.evenements),
//                      classés par la table MESURÉE de chaque transporteur (api/_lib/transporteurs.js :
//                      Chronopost `CP_CODES`, Vinted Go `VG_GROUPES`, Mondial Relay `classeMr`) — un autre
//                      transporteur, un code inconnu ⇒ l'évènement ne prouve rien ;
//    · `transitAt`   — les e-mails « en route » (`status: 'transit'`) du MÊME n° ;
//    · `arriveesAt`  — les arrivées PROUVÉES au point (e-mail « disponible », état « disponible » du transporteur,
//                      étape Vinted `available_for_pickup`, message d'arrivée de la conversation) ;
//    · `retireAt`    — un retrait prouvé (le transporteur ou l'e-mail l'écrit) ; un colis encore « à retirer »
//                      n'en a pas, l'étape reste grise.
// ════════════════════════════════════════════════════════════════════════════
import { CP_CODES, VG_GROUPES, classeMr } from '../api/_lib/transporteurs.js';

export const ETAPES_TRAJET = ['paye', 'expedie', 'transit', 'point', 'retire'];

const ms = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null; const n = Date.parse(String(v)); return Number.isFinite(n) && n > 0 ? n : null; };

// Le SENS d'un évènement du transporteur : 'prepare' · 'route' · 'disponible' · 'retire' · 'livre' · 'retour' ·
// 'incident' · … ; null = pas su (transporteur sans table, code ou libellé pas mesuré).
export function sensEvenement(transporteur, ev) {
  if (!ev || typeof ev !== 'object') return null;
  const t = String(transporteur || '').toLowerCase();
  if (t === 'chronopost') return CP_CODES[String(ev.code || '').replace(/\s+/g, '').toUpperCase()] || null;
  if (t === 'vinted' || t === 'vintedgo') return VG_GROUPES[String(ev.code || '')] || null;
  if (t === 'mondialrelay') { const c = classeMr(ev.libelle); return c ? c.c : null; }
  return null;
}

// Rend { etapes: [{ cle, at, lue }], courante: index | -1 }. `courante` = la plus avancée des étapes LUES.
export function etapesTrajet({ payeAt = null, evenements = [], transporteur = '', transitAt = [], arriveesAt = [], retireAt = null, maintenant = Date.now() } = {}) {
  const futur = (x) => x != null && x > maintenant + 3600000;   // une date dans le futur ne prouve rien (horloge, saisie)
  const evs = (Array.isArray(evenements) ? evenements : [])
    .map((e) => ({ at: ms(e && e.at), sens: sensEvenement(transporteur, e) }))
    .filter((e) => e.at != null && !futur(e.at) && e.sens)
    .sort((a, b) => a.at - b.at);
  const arr = [...(Array.isArray(arriveesAt) ? arriveesAt : []).map(ms), ...evs.filter((e) => e.sens === 'disponible').map((e) => e.at)].filter((x) => x != null && !futur(x));
  const point = arr.length ? Math.min(...arr) : null;
  // Remis au transporteur puis en route : seulement AVANT l'arrivée (un retour après l'arrivée n'est pas l'aller).
  const route = evs.filter((e) => e.sens === 'route' && (point == null || e.at <= point)).map((e) => e.at);
  const expedie = route.length ? route[0] : null;
  const transitEv = route.length > 1 && route[route.length - 1] > route[0] ? route[route.length - 1] : null;
  const transitMail = (Array.isArray(transitAt) ? transitAt : []).map(ms).filter((x) => x != null && !futur(x) && (point == null || x <= point) && (expedie == null || x >= expedie));
  const transit = transitEv != null ? transitEv : (transitMail.length ? Math.min(...transitMail) : null);
  const retEv = evs.filter((e) => (e.sens === 'retire' || e.sens === 'livre') && (point == null || e.at >= point)).map((e) => e.at);
  const retire = ms(retireAt) != null && !futur(ms(retireAt)) ? ms(retireAt) : (retEv.length ? retEv[0] : null);
  const paye = ms(payeAt) != null && !futur(ms(payeAt)) ? ms(payeAt) : null;
  const val = { paye, expedie, transit, point, retire };
  const etapes = ETAPES_TRAJET.map((cle) => ({ cle, at: val[cle], lue: val[cle] != null }));
  let courante = -1; etapes.forEach((e, i) => { if (e.lue) courante = i; });
  return { etapes, courante };
}

// « 18 nov. » (heure de Paris) — la date sous une étape franchie.
export function jourCourt(at, langue = 'fr-FR') {
  const n = ms(at); if (n == null) return '';
  try { return new Intl.DateTimeFormat(langue, { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(new Date(n)); } catch (_) { return ''; }
}
