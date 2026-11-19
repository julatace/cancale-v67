// ════════════════════════════════════════════════════════════════════════════
//  « C'EST SANS DOUTE LE MÊME COLIS — RELIER » (17 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (17 nov., captures) : au point « Tabac … » il a UN colis arrivé, VRM en montre deux — « Colis
// Chronopost Pickup » (code, n° Chronopost, non relié) et l'achat Vinted « Code sur Vinted · Incident ».
// Mesuré : un envoi international à DEUX transporteurs, deux n° pour le MÊME colis ; la ligne de suivi
// Vinted ne gardait que le premier ⇒ aucune identité commune.
//
// LA VOIE PRINCIPALE est l'identité : l'extension 5.403 range TOUS les n° du trajet (api/_lib/suivis-
// multiples.js) et `achatDuColis` relie le colis du transporteur à son achat, sans rien proposer.
//
// CE MODULE NE SERT QU'EN ATTENDANT : tant que la liste des n° de l'achat n'a JAMAIS été lue (ligne rangée
// avant la 5.403, `listeLue` faux), VRM ne PEUT PAS encore savoir. Il PROPOSE alors — jamais il ne relie
// (§5 : c'est SON toucher qui relie, rangé comme les autres liens manuels, `colis_suivi_*` + tx/uid) — et
// seulement quand TOUT est vrai :
//   · au même point (nom + code postal normalisés, `cleLieuDoute`), exactement UN colis du transporteur
//     non relié (avec son n°) et exactement UN achat Vinted non relié sans code, liste jamais lue ;
//   · le même GROUPE de transporteur (Chronopost / Shop2Shop / Pickup ; Mondial Relay / InPost ; …) — un
//     transporteur inconnu d'un côté ⇒ rien ;
//   · le colis du transporteur est arrivé APRÈS l'achat (la date d'achat : rien n'est expédié avant) ;
//   · AUCUN autre achat en route vers ce point (même point, ou point inconnu du même groupe) ;
//   · il n'a pas dit « Ce n'est pas le même » pour CE colis et CET achat (`vrm_colis_pas_meme`).
// Plusieurs candidats, d'un côté ou de l'autre ⇒ aucune proposition. Dès que la liste est lue, c'est elle
// qui tranche : plus de proposition, et un lien posé à la main qu'elle contredit est DIT (`liensContredits`).
// PUR : l'app et scripts/audit-meme-colis.cjs exécutent CES fonctions.
//
// ⚠️ (19 nov., décision de Julien : « je ne dois pas relier l'achat au colis qui est au point relais, ça doit être
// automatique […] on ne doit pas avoir le bouton relier un achat ») L'APP NE MONTRE PLUS LA PROPOSITION : c'était un
// « Relier » de plus sur un colis à retirer, par ressemblance (même point, même transporteur). `propositionsMemeColis`
// et `clePasMeme` restent ici, exécutées par leur audit, mais plus aucun écran ne les appelle — ne pas les rebrancher
// sans qu'il le demande. Seul « ce lien ne correspond pas — délier » (`liensContredits`) sert encore, pour les liens
// posés à la main par le passé. Le colis sans identité dit « Contenu pas encore lu » (src/contenuColis.js).
import { cleLieuDoute } from '../api/_lib/achat-arrive-relais.js';
import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';
import { lienContredit } from '../api/_lib/suivis-multiples.js';

// Le groupe d'un transporteur (une clé de l'app, un code Vinted, un nom). '' = inconnu (jamais deviné).
const GROUPES = [
  ['chronopost', /chrono|shop\s*-?\s*2\s*-?\s*shop|pickup/i],
  ['mondialrelay', /mondial|inpost|\bmr\b/i],
  ['vintedgo', /vinted\s*-?\s*go|vintedgo/i],
  ['relaiscolis', /relais\s*-?\s*colis|relaiscolis/i],
  ['laposte', /colissimo|la\s*-?\s*poste|laposte/i],
  ['dpd', /\bdpd/i],
  ['ups', /\bups\b/i],
  ['dhl', /\bdhl/i],
  ['gls', /\bgls\b/i],
];
export function groupeTransporteur(x) {
  const s = String(x == null ? '' : x).replace(/[_]/g, ' ').trim();
  if (!s) return '';
  for (const [g, re] of GROUPES) if (re.test(s)) return g;
  return '';
}

// Les listes de n° des lignes de suivi Vinted de l'app (`suivisVinted` : { 'uid:tx': { uid, tx, suivi, suivisV, listeLue } }).
export function listesDesSuivisVinted(suivisVinted) {
  const out = new Map();
  for (const v of Object.values(suivisVinted || {})) {
    if (!v || !v.uid || !v.tx) continue;
    const numeros = [...new Set([normaliserSuivi(v.suivi), ...(Array.isArray(v.suivisV) ? v.suivisV : []).map(normaliserSuivi)].filter(Boolean))];
    out.set(`${v.uid}:${v.tx}`, { uid: String(v.uid), tx: String(v.tx), numeros, lue: !!v.listeLue });
  }
  return out;
}
// Les liens posés à la main que la liste LUE contredit (rien n'est supprimé : l'écran propose « Délier »).
export function liensContredits(suivisVinted, suivisManuels) {
  const listes = listesDesSuivisVinted(suivisVinted);
  return (Array.isArray(suivisManuels) ? suivisManuels : []).filter((m) => m && m.tx && m.suivi && lienContredit(m, listes));
}

const memeLieu = (a, b) => !!a && !!b && a.nom === b.nom && (!a.cp || !b.cp || a.cp === b.cp);
export const clePasMeme = (suivi, cleAchat) => `${normaliserSuivi(suivi)}|${cleAchat}`;

// `colis` : les colis du transporteur montrés à retirer, NON reliés : [{ cle, suivi, transporteur, lieu, arriveeMs }].
// `achats` : les achats Vinted montrés à retirer (ou à vérifier), NON reliés : [{ cle ('uid:tx'), o, lieu, transporteurs[],
//   listeLue, aCode, dateMs }].
// `enRoute` : TOUS les autres achats pas finis et expédiés : [{ cle, lieu, transporteurs[] }] (lieu '' = inconnu).
// `pasMeme` : Set de `clePasMeme(suivi, cleAchat)`.
// Rend Map(cle du colis → { achat, cleAchat, suivi }) — vide le plus souvent.
export function propositionsMemeColis({ colis = [], achats = [], enRoute = [], pasMeme = new Set() } = {}) {
  const out = new Map();
  const C = (colis || []).filter((c) => c && normaliserSuivi(c.suivi)).map((c) => ({ ...c, point: cleLieuDoute(c.lieu), groupe: groupeTransporteur(c.transporteur) }));
  const A = (achats || []).filter((a) => a && a.cle).map((a) => ({ ...a, point: cleLieuDoute(a.lieu), groupes: new Set((a.transporteurs || []).map(groupeTransporteur).filter(Boolean)) }));
  const R = (enRoute || []).filter((a) => a && a.cle).map((a) => ({ ...a, point: cleLieuDoute(a.lieu), groupes: new Set((a.transporteurs || []).map(groupeTransporteur).filter(Boolean)) }));
  for (const c of C) {
    if (!c.point || !c.groupe) continue;
    // Exactement UN colis du transporteur non relié à ce point.
    if (C.filter((x) => memeLieu(x.point, c.point)).length !== 1) continue;
    // Exactement UN achat Vinted non relié, sans code, à ce point (quel que soit son transporteur).
    const ici = A.filter((a) => memeLieu(a.point, c.point));
    if (ici.length !== 1) continue;
    const a = ici[0];
    if (a.listeLue || a.aCode) continue;                                  // la liste lue tranche ; un code est une autre identité
    if (!a.groupes.size || !a.groupes.has(c.groupe)) continue;            // même groupe de transporteur, connu
    if (!(Number.isFinite(c.arriveeMs) && Number.isFinite(a.dateMs) && c.arriveeMs > a.dateMs)) continue;
    // Aucun AUTRE achat en route vers ce point (ou vers un point inconnu, du même groupe ou d'un groupe inconnu).
    const autre = R.some((r) => r.cle !== a.cle && (r.point ? memeLieu(r.point, c.point) : (!r.groupes.size || r.groupes.has(c.groupe))));
    if (autre) continue;
    if (pasMeme && pasMeme.has(clePasMeme(c.suivi, a.cle))) continue;
    out.set(c.cle, { achat: a.o, cleAchat: a.cle, suivi: normaliserSuivi(c.suivi) });
  }
  return out;
}
