// api/_lib/argent-passes.js
// ════════════════════════════════════════════════════════════════════════════
// (15 nov., lot argent-plus) DEUX NOTIFICATIONS D'ARGENT DU PASSAGE DU MATIN
// (api/ship-reminders.js, le cron de 5 h UTC, au nom de CHAQUE vendeur) :
//
// 1. LE BILAN DE FIN DE MOIS — le 1er (rattrapage jusqu'au 7 si rien n'était lisible),
//    UNE fois par mois (`bilan_mois_push_dedup`, réservé AVANT l'envoi) : vendu, reçu
//    (au versement), URSSAF du mois (régime CHOISI, sinon « choisis ton régime ») et
//    les articles qui dorment ; elle ouvre Argent → « Bilan du mois » sur CE mois, où
//    sont aussi le bénéfice et sa couverture, le meilleur compte, le PDF et le tableur.
//    AUCUNE RÈGLE ICI (§5) : vendu / reçu / bénéfice = `calculerBilanMois`
//    (api/_lib/bilan-mois.js, le calcul de l'e-mail du bilan, lui-même le miroir des
//    règles de l'app) ; l'URSSAF = `montantPeriodeUrssaf` du miroir
//    (api/_lib/urssaf-regle.js) sur le MOIS ; qui dorment = `dormentDe` ; la forme =
//    `urssafDuBilan` / `donneesNotifBilan` (src/bilanFinMois.js, l'app les lit aussi).
// 2. LES SEUILS DE L'ANNÉE — chaque matin : le plafond micro, la TVA (deux seuils) et
//    DAC7 par plateforme, à 80 % puis 100 %, UNE fois chacun (`seuils_alertes_dedup`,
//    les clés dites, réservées AVANT l'envoi) : `alertesSeuils` / `alertesADire`
//    (src/alertesSeuils.js, la règle de l'alerte de l'écran Argent) sur la ligne
//    publiée par Ventes (`vinted_urssaf_mois`) — le régime n'est jamais deviné.
// Les entrées sont des FONCTIONS (le cron donne les siennes, l'audit les fausses).
// Un mémo illisible ⇒ RIEN n'est envoyé (« pas su » ne vaut jamais « jamais envoyé »).
// La réponse du cron ne porte AUCUN montant : des états seulement.
// ════════════════════════════════════════════════════════════════════════════
import { calculerBilanMois, moisPasse } from './bilan-mois.js';
import { dormentDe, dateParis } from './bilan-semaine.js';
import { montantPeriodeUrssaf, tauxDe } from './urssaf-regle.js';
import { DESTINATIONS } from './lien-notif.js';
import { rediger } from './notif-redaction.js';
import { urssafDuBilan, donneesNotifBilan, notifBilanAEnvoyer } from '../../src/bilanFinMois.js';
import { alertesSeuils, alertesADire, vuesAvec } from '../../src/alertesSeuils.js';

export const ID_BILAN_PUSH = 'bilan_mois_push_dedup';
export const ID_SEUILS = 'seuils_alertes_dedup';
export const JOUR_MAX_PUSH = 7;
export const SEUILS_PAR_PASSAGE = 3;
// Les seules clés de `main` lues (§4.4 : `main` est lourde).
export const MAIN_ARGENT = ['vinted_regime', 'vinted_urssaf_taux', 'vinted_urssaf_mois', 'vrm_paires_dorment', 'vrm_micro_options'];
const REGIMES = ['particulier', 'micro', 'societe', 'marge'];
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
// `main` : objet · null (aucune ligne) · undefined (pas su). Le régime : choisi, null, ou pas su.
export const regimeDe = (main) => (main === undefined ? undefined : REGIMES.includes(objet(main).vinted_regime) ? objet(main).vinted_regime : null);
const ligneDe = (main) => { const l = objet(main).vinted_urssaf_mois; return l && Array.isArray(l.mois) ? l : null; };

// ── 1. LE BILAN DE FIN DE MOIS (pur) ───────────────────────────────────────
export function notifBilanDuMois({ d, pub = null, main, mois, maintenant = Date.now() }) {
  const b = calculerBilanMois({ d, pub, mois, maintenant });
  const regime = regimeDe(main);
  const [y, m] = mois.ym.split('-').map(Number);
  const montant = regime === 'micro' ? montantPeriodeUrssaf({ periodStart: new Date(y, m - 1, 1), periodEnd: new Date(y, m, 0) }, ligneDe(main), tauxDe(objet(main).vinted_urssaf_taux)) : null;
  const urssaf = urssafDuBilan({ regime, montant });
  const dorment = dormentDe(main ? objet(main).vrm_paires_dorment : null, maintenant);
  const redaction = donneesNotifBilan(b, { urssaf, dorment });
  return { b, urssaf, dorment, redaction, envoyer: notifBilanAEnvoyer(redaction), url: DESTINATIONS.bilanMois({ mois: mois.ym }) };
}

export async function passeBilanMoisPush({ maintenant = Date.now(), actif, lireDedup, reserver, lireDonnees, lirePub, lireMain, pousser }) {
  const mois = moisPasse(maintenant);
  if (mois.jour > JOUR_MAX_PUSH) return null;                   // hors fenêtre : rien n'est lu
  const deja = await lireDedup();
  if (deja === undefined) return 'mémo illisible — rien';
  if (deja && deja.mois === mois.ym) return 'déjà envoyé';
  if (!(await actif())) return 'désactivé par le vendeur';
  const [d, pub, main] = await Promise.all([lireDonnees(), lirePub(), lireMain()]);
  const n = notifBilanDuMois({ d, pub: pub === undefined ? null : pub, main, mois, maintenant });
  if (!n.envoyer) return 'données illisibles — réessai demain';
  const res = await reserver((x) => !!x && x.mois === mois.ym, (x) => ({ ...(x || {}), mois: mois.ym, at: new Date(maintenant).toISOString() }));
  if (!res || !res.reserve) return res && res.raison === 'deja' ? 'déjà envoyé' : 'mémo illisible — rien';
  const fr = rediger(n.redaction, { langue: 'fr', maintenant }) || { title: 'Ton bilan du mois', body: '' };
  await pousser({ cat: 'bilan', title: fr.title, body: fr.body, tag: 'bilan-mois-' + mois.ym, cle: 'bilan-mois:' + mois.ym, url: n.url, redaction: n.redaction });
  return { mois: mois.ym, envoye: true, vendu: n.b.vendu.etat, recu: n.b.recu.etat, urssaf: n.urssaf.etat, dorment: n.dorment.etat };
}

// ── 2. LES SEUILS DE L'ANNÉE ────────────────────────────────────────────────
// L'année civile À PARIS (le serveur est en UTC) : midi du jour de Paris.
export const nowParis = (maintenant = Date.now()) => { const [y, m, j] = dateParis(maintenant).split('-').map(Number); return new Date(y, m - 1, j, 12); };
export function seuilsAPrevenir({ main, dedup, maintenant = Date.now() }) {
  if (main === undefined) return { etat: 'passu', aDire: [] };
  const mm = objet(main);
  const activite = objet(mm.vrm_micro_options).activite === 'services' ? 'services' : 'vente';
  const alertes = alertesSeuils({ ligne: ligneDe(main), now: nowParis(maintenant), regime: regimeDe(main), activite });
  return { etat: 'lu', alertes, aDire: alertesADire(alertes, objet(dedup).vues) };
}
export async function passeSeuilsPush({ maintenant = Date.now(), actif, lireDedup, reserver, lireMain, pousser }) {
  const main = await lireMain();
  if (main === undefined) return 'réglages illisibles — rien';
  const deja = await lireDedup();
  if (deja === undefined) return 'mémo illisible — rien';
  const s = seuilsAPrevenir({ main, dedup: deja, maintenant });
  if (!s.alertes.length) return 'aucun seuil à 80 % ni au-delà';
  if (!s.aDire.length) return 'déjà prévenu';
  if (!(await actif())) return 'rappels coupés par le vendeur';
  const lot = s.aDire.slice(0, SEUILS_PAR_PASSAGE);
  const cles = lot.flatMap((a) => a.marquer);
  const res = await reserver((x) => cles.every((k) => !!objet(objet(x).vues)[k]), (x) => ({ ...objet(x), vues: vuesAvec(objet(x).vues, cles, maintenant) }));
  if (!res || !res.reserve) return res && res.raison === 'deja' ? 'déjà prévenu' : 'mémo illisible — rien';
  for (const a of lot) {
    const fr = rediger({ sorte: 'seuil', ...a }, { langue: 'fr', maintenant });
    if (!fr) continue;
    await pousser({ cat: 'seuil', title: fr.title, body: fr.body, tag: 'seuil-' + a.cle.replace(/[^\w-]+/g, '-'), cle: 'seuil:' + a.cle, url: DESTINATIONS.seuil(), redaction: { sorte: 'seuil', ...a } });
  }
  return { envoyes: lot.length, cles: lot.map((a) => a.cle.replace(/^\d{4}:/, '')) };
}
