// ════════════════════════════════════════════════════════════════════════════
//  « ACHAT PAS ENCORE RELIÉ · RELIER » : UN COLIS À RETIRER ET SON ACHAT (16 nov., lot achats-qr)
// ════════════════════════════════════════════════════════════════════════════
// Julien (capture iPhone, Achats → À retirer) : des lignes « Colis Mondial Relay · Code de retrait 885828 ·
// n° 88763730 » SANS la photo ni le titre de l'annonce achetée — « je veux qu'il y ait la photo de l'annonce pour
// le colis que j'ai retiré / à retirer ».
//
// MESURÉ le 16 nov. sur sa base (lecture seule, projections scalaires, rien recopié ici) :
//   · 7 colis à retirer publiés (`vrm_colis_retirer`) : 1 avec son article, 6 sans (5 Mondial Relay, 1 Chronopost) ;
//   · la FORME des n° n'y est pour rien : Mondial Relay = 8 chiffres dans l'e-mail ET dans le suivi Vinted relevé
//     par l'extension (`harvest_{uid}_suivi_{tx}`, 20 lignes MONDIAL, 8 chiffres) — la même normalisation
//     (`normaliserSuivi`) des deux côtés ; 22 des 58 e-mails Mondial Relay « disponible » du mois se relient déjà ;
//   · les 36 autres n'ont AUCUNE identité ailleurs : ni dans les 46 lignes de suivi Vinted, ni dans les
//     transactions (aucun n° d'expédition), ni dans les conversations, ni par le code de retrait (aucun code commun
//     avec `panel_colis_relais`). Leurs achats n'ont simplement pas encore eu leur suivi relu par l'extension
//     (les listes d'achats de deux comptes dataient du 11 nov.).
// Donc rien à « corriger » dans le rapprochement : sans identité, la ligne garde le logo et dit
// « Achat pas encore relié · Relier ». SON clic choisit l'achat dans ses achats EN ATTENTE ; le n° de suivi du
// colis est alors MÉMORISÉ comme identité de cet achat (une ligne `colis_suivi_{transporteur}_{n°}` portant
// `tx`/`uid`, la même que « Relier à un achat » des n° ajoutés à la main) : `achatDuColis` le retrouve ensuite,
// partout (ligne, feuille du QR, Ma journée, widget, scan d'un bordereau d'achat).
//
// PUR (aucune écriture, aucune horloge implicite) : l'app et `scripts/audit-relier-colis.cjs` exécutent CES fonctions.

import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';
import { suivisAchat, achatDuColis } from './liensColis.js';
import { idSuiviManuel, TRANSPORTEURS_SAISIE } from '../api/_lib/suivi-colis.js';

const tx = (a) => (a && a.transaction_id != null ? String(a.transaction_id) : '');
const uidDe = (a) => String((a && a._acc && a._acc.vinted_user_id) || (a && a._acc) || '');
// Un achat FINI (rien à aller chercher) : finalisé, livré, remboursé, annulé, en retour.
const FINI = /finalis|rembours|annul|commande livr|retourn|retour (?:accept|valid)|suspendu|paiement (?:refus|échou|echou)/i;
// Le plus avancé d'abord : au point relais, puis expédié, puis bordereau / payé.
const rang = (st) => (/point relais|bureau de poste|d[ée]pos[ée]/i.test(st) ? 0 : /exp[ée]di|achemin/i.test(st) ? 1 : 2);
const ms = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : 0; };

// L'achat d'un n° de suivi, par IDENTITÉ seulement (la fonction UNIQUE : la ligne « à retirer », la feuille du QR et
// le scan d'un bordereau d'achat l'appellent). Un n° illisible, aucun achat, ou deux achats ⇒ null (jamais deviné).
export function achatDuSuivi(numSuivi, achats, index = {}) {
  const su = normaliserSuivi(numSuivi);
  if (!su) return null;
  return achatDuColis({ suivi: su }, achats, index);
}

// Les achats EN ATTENTE qu'on peut relier à ce colis : Vinted, des `jours` derniers jours, pas finis, sans n° de
// suivi déjà connu (un autre n° ⇒ un autre colis). Le plus avancé puis le plus récent d'abord. `null` si les achats
// ne sont pas lus (« pas su » : la feuille le dit, elle ne montre pas une liste vide).
export function achatsARelier(achats, index = {}, { maintenant = Date.now(), jours = 60 } = {}) {
  if (!Array.isArray(achats)) return null;
  const vus = new Set();
  const out = [];
  for (const a of achats) {
    const t = tx(a); if (!t) continue;
    const cle = uidDe(a) + ':' + t; if (vus.has(cle)) continue; vus.add(cle);
    const st = String(a.status || a.status_title || '');
    if (FINI.test(st)) continue;
    const d = ms(a.date);
    if (d && maintenant - d > jours * 864e5) continue;
    if (suivisAchat(a, index).length) continue;
    out.push(a);
  }
  return out.sort((x, y) => rang(String(x.status || '')) - rang(String(y.status || '')) || ms(y.date) - ms(x.date));
}

// L'écriture du lien : la ligne `colis_suivi_*` du n° (son id et ce qu'elle porte). Rien sans n° lisible ni achat.
export function ecritureRelierColis({ suivi, transporteur }, achat) {
  const su = normaliserSuivi(suivi); const t = tx(achat);
  if (!su || !t) return null;
  const tr = TRANSPORTEURS_SAISIE.includes(transporteur) ? transporteur : 'autre';
  const uid = uidDe(achat);
  return { id: idSuiviManuel(tr, su), patch: { suivi: su, transporteur: tr, tx: t, uid: uid || null, relieDepuis: 'retrait' } };
}
