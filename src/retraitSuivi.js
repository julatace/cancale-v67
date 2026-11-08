// ════════════════════════════════════════════════════════════════════════════
//  CE QUE DIT LE SUIVI D'UN COLIS À RETIRER, EN UNE LIGNE (8 nov.)
//  Julien : « Améliore ça pour les colis pour le retrait parce que je vois qu'il
//  y a encore des erreurs, l'application doit pouvoir lire les informations de
//  suivi afin de pouvoir enlever si nécessaire. »
//
//  Deux phrases, pures (aucune lecture, aucune écriture), pour Colis → À retirer :
//   · `finDatee` / `texteSortie` : un colis SORTI de « à retirer » (le
//     transporteur, l'e-mail ou la commande Vinted disent retiré, livré, reparti)
//     ne disparaît pas sans un mot (§5 « un colis caché est un colis perdu ») : il
//     passe quelques jours dans « Sortis de « à retirer » » avec la raison LUE et
//     sa date — « Mondial Relay : retiré le 6 nov. ». La DÉCISION reste celle de
//     `pickupUnion` (les fins par identité : `sortiParSuivis`, `finParIdentite`,
//     `finDeCommandeAchat`) ; ici on ne fait que la DIRE, depuis les mêmes lignes.
//   · `pourquoiPasLu` : un colis dont le transporteur n'a jamais répondu dit
//     pourquoi et le geste (§2.7 : une alerte qui ne dit pas quoi faire ne sert à
//     rien) — transporteur que VRM ne lit pas, n° sans transporteur reconnu, colis
//     international, n° abandonné (introuvable 3 fois), suivi expiré.
//  Identité exacte seulement (le n° de suivi normalisé) — jamais le titre, le lieu
//  ou la date (§5).
// ════════════════════════════════════════════════════════════════════════════
import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';
import { carrierLuDeLigne, carrierNonLu, nomTransporteur } from '../api/_lib/transporteurs.js';
import { finDeLigne, suiviDeLigne, colisInternational, nomTransporteurSuivi } from '../api/_lib/suivi-colis.js';

// Combien de jours un colis sorti reste dit sous « À retirer ».
export const SORTIS_JOURS = 3;
// Sans date de fin connue (une commande Vinted « finalisée »), on le dit tant que
// son arrivée a moins de ce nombre de jours.
export const SORTIS_SANS_DATE_JOURS = 10;

const msDe = (v) => { if (Number.isFinite(v)) return v; const x = Date.parse(String(v || '')); return Number.isFinite(x) ? x : null; };
// « 6 nov. » — heure de Paris.
export function jourCourt(ms) {
  if (!Number.isFinite(ms)) return '';
  try { return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }); } catch (_) { return ''; }
}

// La FIN d'un colis, DATÉE, par ses n° de suivi (le sien et ceux de ses autres
// identités, dans l'ordre donné), depuis les mêmes lignes que la règle :
//  · la ligne `transp_` du n° (`tpm`, Map n° → ligne) : retiré / livré, puis
//    repart chez l'expéditeur — l'évènement du transporteur et sa date ;
//  · une ligne d'e-mail du même n° qui dit retiré ou reparti (sa date).
// Un « retiré » gagne toujours sur un « retour » (la règle de `finsDesLignes`) ;
// entre transporteur et e-mail, le transporteur (une lecture, pas un résumé).
// Rend { source, etat: 'retire'|'livre'|'retour'|'rendu', carrier, at, suivi } ou null.
export function finDatee(suivis, { tpm = null, lignes = [], estSortant = null } = {}) {
  const ks = [...new Set((Array.isArray(suivis) ? suivis : [suivis]).map(normaliserSuivi).filter(Boolean))];
  if (!ks.length) return null;
  const cands = [];
  for (const k of ks) {
    const t = tpm && typeof tpm.get === 'function' ? tpm.get(k) : null;
    if (t && t.etat && t.lu) {
      if (t.etat === 'retire' || t.etat === 'livre') cands.push({ source: 'transporteur', etat: t.etat, carrier: t.carrier || '', at: msDe(t.etatAt), suivi: k, rang: 0 });
      else if (t.etat === 'retour_expediteur') cands.push({ source: 'transporteur', etat: t.detail === 'rendu' ? 'rendu' : 'retour', carrier: t.carrier || '', at: msDe(t.etatAt), suivi: k, rang: 2 });
    }
    for (const l of (Array.isArray(lignes) ? lignes : [])) {
      if (!l || suiviDeLigne(l) !== k) continue;
      const f = finDeLigne(l); if (!f) continue;
      if (f === 'retour' && typeof estSortant === 'function' && estSortant(l)) continue;
      const at = f === 'delivered' ? (msDe(l.retireLe) ?? msDe(l.emailAt) ?? msDe(l.receivedAt)) : (msDe(l.emailAt) ?? msDe(l.receivedAt));
      cands.push({ source: 'email', etat: f === 'delivered' ? 'retire' : 'retour', carrier: l.carrier || '', at, suivi: k, rang: f === 'delivered' ? 1 : 3 });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.rang - b.rang || (b.at ?? -Infinity) - (a.at ?? -Infinity));
  const { rang, ...f } = cands[0];
  return f;
}

const MOT = { retire: 'retiré', livre: 'livré', retour: 'repart chez l’expéditeur', rendu: 'rendu à l’expéditeur' };
// La phrase d'une fin : « Mondial Relay : retiré le 6 nov. » · « E-mail de
// Chronopost : retiré le 6 nov. » · « Vinted : commande finalisée ». `via` dit
// par quelle AUTRE identité la fin est prouvée (le n° de sa commande, le même
// code de retrait) — jamais un rapprochement par ressemblance.
export function texteSortie(f, { via = '' } = {}) {
  if (!f) return '';
  if (f.source === 'vinted') return `Vinted : ${f.statut ? String(f.statut).toLowerCase() : (f.etat === 'reparti' ? 'commande non réclamée ou annulée' : 'commande finalisée')}`;
  const jour = jourCourt(f.at);
  const mot = MOT[f.etat] || f.etat;
  const date = jour ? (f.etat === 'retour' ? ` depuis le ${jour}` : ` le ${jour}`) : '';
  const qui = f.source === 'email'
    ? (nomTransporteurSuivi(f.carrier) !== 'Colis' ? `E-mail de ${nomTransporteurSuivi(f.carrier)}` : 'E-mail du transporteur')
    : nomTransporteur(f.carrier);
  const parQuoi = via === 'commande' ? ' — par le n° de suivi de sa commande' : via === 'code' ? ' — par son code de retrait' : '';
  return `${qui} : ${mot}${date}${parQuoi}`;
}

// Le colis sorti reste-t-il dit sous « À retirer » ? Fin datée de moins de
// `SORTIS_JOURS` ; sans date, une arrivée de moins de `SORTIS_SANS_DATE_JOURS`.
export function sortiRecent(f, { arriveeMs = null, maintenant = Date.now() } = {}) {
  if (!f) return false;
  if (Number.isFinite(f.at)) return maintenant - f.at <= SORTIS_JOURS * 86400000 && f.at <= maintenant + 3600000;
  return Number.isFinite(arriveeMs) && maintenant - arriveeMs <= SORTIS_SANS_DATE_JOURS * 86400000;
}

// ── POURQUOI CE COLIS N'EST PAS LU CHEZ SON TRANSPORTEUR ─────────────────────
// `t` : la ligne `transp_` du n° (ou null). Rend null quand une lecture a réussi
// ou quand une lecture est en cours de vie normale (la ligne du transporteur le
// dit déjà) ; sinon { code, texte, geste } :
//   'sans-numero'        aucun n° de suivi lu ;
//   'international'      un n° postal d'un autre pays (S10) ;
//   'non-lu'             un transporteur que VRM ne lit pas (Colissimo, DPD…) ;
//   'inconnu'            un n° dont la forme ne désigne aucun transporteur lu ;
//   'jamais'             lisible, pas encore interrogé ;
//   'abandonne'          introuvable 3 fois : VRM ne le relit plus ;
//   'expire'             le transporteur ne garde plus ce suivi.
export function pourquoiPasLu({ suivi = '', carrier = '', t = null } = {}) {
  const k = normaliserSuivi(suivi);
  if (!k) return { code: 'sans-numero', texte: 'Pas de n° de suivi : VRM ne peut pas demander au transporteur où il en est', geste: 'Coche « J’ai retiré » quand tu l’as.' };
  if (t && t.etat && t.lu) return null;
  const c = (t && t.carrier) || carrierLuDeLigne(carrier, k);
  const nom = c ? nomTransporteur(c) : '';
  if (t && t.essaiRes === 'expire') return { code: 'expire', texte: `${nom} ne garde plus ce suivi : VRM ne le relit plus`, geste: 'Regarde sur le site du transporteur.' };
  if (t && t.fini && t.essaiRes === 'introuvable') return { code: 'abandonne', texte: `${nom} ne trouve pas ce n° (${Number(t.essais) || 3} essais) : VRM ne le relit plus`, geste: 'Regarde sur le site du transporteur.' };
  if (t) return null;   // un essai est en cours de vie (pas su, refusé, code postal) : la ligne du transporteur le dit
  if (!c) {
    const intl = colisInternational(k);
    if (intl) return { code: 'international', texte: `${intl} : VRM ne lit pas ce suivi`, geste: 'Cherche le n° sur le site de la poste du pays.' };
    const nl = carrierNonLu(carrier);
    if (nl) return { code: 'non-lu', texte: `${nl} : VRM ne lit pas ce transporteur`, geste: `Regarde sur le site de ${nl}.` };
    return { code: 'inconnu', texte: 'Transporteur pas reconnu : VRM ne peut pas lire ce suivi', geste: 'Cherche le n° sur le site du transporteur.' };
  }
  return { code: 'jamais', texte: `${nom} : pas encore lu — VRM le lit tant que l’app est ouverte`, geste: '' };
}
