// api/_lib/bilan-mois.js
// ════════════════════════════════════════════════════════════════════════════
// LE BILAN DU MOIS PAR E-MAIL (8 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Le 1er du mois, pour le mois écoulé, un e-mail court par vendeur QUI L'A
// ACTIVÉ : ventes, vendu, reçu, bénéfice brut, sa plus belle vente, un lien vers
// Compta. Ce n'est PAS la « sauvegarde hebdomadaire envoyée chez lui » refusée
// le 11 octobre (§3) : aucune donnée, aucun fichier — un résumé de chiffres.
//
// ⚠️ ÉTEINT PAR DÉFAUT. Le choix vit dans la ligne `bilan_mois_choix` du vendeur,
//    écrite par le SERVEUR seul (api/compte.js `?mode=bilan-mois` : sa session
//    depuis Réglages, ou le lien signé « ne plus recevoir » de l'e-mail). Ligne
//    absente, illisible ou `actif !== true` ⇒ rien n'est lu, rien ne part.
// ⚠️ LES RÈGLES NE SONT PAS ICI (§5, §11) :
//    · vendu / reçu = `calculerBilan` (api/_lib/bilan-semaine.js), lui-même le
//      miroir EXACT de `ventesFaites` / `ventesDeclarables` de l'app
//      (api/_lib/ventes-regle.js) — VENDU au jour de la vente, REÇU au jour du
//      VERSEMENT ; un total partiel se dit « au moins » et NOMME ce qui manque ;
//    · bénéfice brut = la publication de l'écran Ventes (`vrm_benefice_jours`,
//      son propriétaire) cumulée par `beneficeDesJours`, recopiée de l'app par
//      script (api/_lib/benefice-regle.js, `audit-bilan-mois.cjs --recopie`) :
//      vente − prix d'achat, SEULEMENT sur les ventes au prix d'achat connu ;
//      des prix manquent ⇒ « au moins … (N prix d'achat manquent) » ; aucun
//      prix d'achat, ou jamais publié ⇒ « — » et la raison, jamais 0 € ;
//    · « pas su » ⇒ « — », jamais un 0 inventé.
// ⚠️ LE CANAL EXISTANT : le même serveur SMTP que les e-mails de l'essai
//    (`RELANCES_SMTP_*`, `RELANCES_EXPEDITEUR`), la même adresse — celle DU
//    COMPTE, confirmée (`adresseDuCompte`) —, le même gabarit
//    (api/_lib/gabarit-email.js). Pas configuré ⇒ rien ne part (et le cron le dit).
// ⚠️ LE PLAFOND : Brevo gratuit = 300 e-mails par jour pour TOUT VRM. Le passage
//    du matin donne au bilan ce qui reste après les e-mails de l'essai, et 150 au
//    plus (`VRM_EMAILS_PAR_JOUR`, 300 par défaut) ; ceux qui n'ont pas eu leur
//    bilan l'ont le lendemain — jusqu'au 7 du mois, un seul par mois.
// ⚠️ JAMAIS DEUX FOIS : le mois est RÉSERVÉ dans `bilan_mois_envois` AVANT
//    l'envoi ; réservation non confirmée ⇒ rien ne part ; un refus SMTP avant le
//    message libère le mois (demain) ; un envoi « incertain » ne se refait pas.
// ⚠️ La réponse du cron ne porte AUCUN montant ni adresse : des états seulement.
import crypto from 'node:crypto';
import { calculerBilan, minuitParis, dateParis } from './bilan-semaine.js';
import { beneficeDesJours } from './benefice-regle.js';
import { gabaritEmail } from './gabarit-email.js';
import { sbCle } from './cle.js';

export const SITE = 'https://vrm.center';
export const ID_CHOIX = 'bilan_mois_choix';
export const ID_ENVOIS = 'bilan_mois_envois';
export const JOUR_MAX = 7;                       // rattrapage du 2 au 7
export const PART_MAX_BILAN = 150;               // au plus, par passage du matin
export const PLAFOND_JOUR_DEFAUT = 300;          // Brevo gratuit : 300 / jour, tout VRM
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ── LE MOIS ÉCOULÉ, À L'HEURE DE PARIS ──────────────────────────────────────
// `debut` = le 1er du mois écoulé à 00:00 (Paris), `fin` = le 1er du mois en
// cours à 00:00 (Paris), `jour` = le jour du mois d'aujourd'hui (1…31).
export function moisPasse(maintenant = Date.now()) {
  const auj = dateParis(maintenant);
  const [y, m, d] = auj.split('-').map(Number);
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const ym = `${py}-${String(pm).padStart(2, '0')}`;
  const debut = minuitParis(`${ym}-01`), fin = minuitParis(`${y}-${String(m).padStart(2, '0')}-01`);
  return { ym, debut, fin, jour: d, libelle: `${MOIS[pm - 1]} ${py}` };
}

// La part du plafond quotidien laissée au bilan, ce passage-ci.
export function partBilan({ env = process.env, dejaEnvoyes = 0 } = {}) {
  const p = Number(env.VRM_EMAILS_PAR_JOUR);
  const plafond = Number.isFinite(p) && p > 0 ? Math.floor(p) : PLAFOND_JOUR_DEFAUT;
  return Math.max(0, Math.min(PART_MAX_BILAN, plafond - Math.max(0, Number(dejaEnvoyes) || 0)));
}

// ── LE BÉNÉFICE BRUT DU MOIS (la publication de Ventes, la règle de l'app) ──
// Trois états : 'su' (tous les prix d'achat connus) · 'partiel' (« au moins »,
// le manque nommé) · 'pas-su' (« — », la raison). Jamais un 0 inventé.
export function beneficeDuMois(pub, mois) {
  if (!pub || typeof pub !== 'object' || !pub.jours || typeof pub.jours !== 'object') return { etat: 'pas-su', raison: 'pas encore calculé : ouvre l’écran Ventes une fois' };
  const [y, m] = mois.ym.split('-').map(Number);
  // Les clés publiées sont des jours locaux (AAAA-MM-JJ) : bornes à minuit UTC
  // ⇒ `jourClef` (lu en UTC sur le serveur) rend exactement le 1er de chaque mois.
  const r = beneficeDesJours(pub.jours, new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)));
  const vieux = !(Number(pub.at) >= mois.fin);
  if (!r.n) return { etat: 'pas-su', raison: vieux ? 'pas recalculé depuis la fin du mois : ouvre l’écran Ventes' : 'aucune vente finalisée ce mois-ci' };
  if (!r.nCout) return { etat: 'pas-su', raison: 'aucun prix d’achat noté sur les ventes du mois' };
  const manque = [];
  if (r.nCout < r.n) manque.push(`${r.n - r.nCout} prix d’achat manque${r.n - r.nCout > 1 ? 'nt' : ''}`);
  if (vieux) manque.push(`calculé le ${new Date(Number(pub.at) || 0).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' })}`);
  return { etat: manque.length ? 'partiel' : 'su', brut: Math.round(r.brut * 100) / 100, n: r.n, nCout: r.nCout, manque };
}

// ── LE CALCUL (pur) ─────────────────────────────────────────────────────────
// `d` = les lectures du bilan de la semaine (`lireDonneesBilan`, chaque source
// `null` si illisible) ; `pub` = `vrm_benefice_jours` (ou null).
export function calculerBilanMois({ d, pub, mois, maintenant = Date.now() }) {
  const b = calculerBilan({ ...d, debut: mois.debut, fin: mois.fin, seuilCapture: mois.fin, maintenant });
  const benefice = beneficeDuMois(pub, mois);
  // La plus belle vente : la plus haute du mois (par la règle VENDU), et son
  // titre lu sur SA commande Vinted (par son n° de transaction) — sinon le site.
  let meilleure = null;
  const best = b.vendu && b.vendu.meilleure;
  if (best) {
    let titre = '';
    if (best.plateforme === 'Vinted' && best.tx && d && d.commandes) {
      for (const l of Object.values(d.commandes)) {
        const o = (l.orders || []).find((x) => x && String(x.transaction_id) === String(best.tx));
        if (o) { titre = String(o.title || '').trim(); break; }
      }
    }
    meilleure = { eur: best.eur, plateforme: best.plateforme, titre };
  }
  return { mois: mois.ym, libelle: mois.libelle, vendu: b.vendu, recu: b.recu, benefice, meilleure };
}
export const bilanMoisAEnvoyer = (b) => !!b && (b.vendu.etat !== 'pas-su' || b.recu.etat !== 'pas-su');

// ── LE TEXTE ────────────────────────────────────────────────────────────────
// Montants : virgule, espace fine insécable des milliers, espace insécable avant « € ».
export const euros = (x) => {
  const c = Math.round(Number(x) * 100); if (!Number.isFinite(c)) return '—';
  const n = Math.abs(c);
  return (c < 0 ? '−' : '') + String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + String(n % 100).padStart(2, '0') + ' €';
};
const liste = (xs, max = 3) => (xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} et ${xs.length - max} autre${xs.length - max > 1 ? 's' : ''}`);

// « d’octobre », « d’avril », « d’août », mais « de novembre ».
export const deMois = (libelle) => (/^[aeiouyàâéèêîôû]/i.test(String(libelle)) ? 'd’' : 'de ') + libelle;
export function texteBilanMois(b, { lien = '' } = {}) {
  // « Au moins 0 » ne se dit jamais (§5) : un total partiel nul s'écrit « — ».
  const val = (etat, x, f) => (etat === 'pas-su' || (etat === 'partiel' && !(Math.abs(Number(x)) > 0)) ? '—' : `${etat === 'partiel' ? 'au moins ' : ''}${f(x)}`);
  const v = b.vendu, r = b.recu, be = b.benefice;
  const chiffres = [
    ['Ventes', val(v.etat, v.n, String), v.etat === 'pas-su' ? 'pas lues' : ''],
    ['Vendu', val(v.etat, v.eur, euros), 'au jour de la vente'],
    ['Reçu', val(r.etat, r.eur, euros), r.etat === 'pas-su' ? 'pas su' : 'versé ce mois-ci'],
    ['Bénéfice brut', be.etat === 'pas-su' ? '—' : `${be.etat === 'partiel' ? 'au moins ' : ''}${euros(be.brut)}`, be.etat === 'pas-su' ? be.raison : be.etat === 'partiel' ? be.manque.join(' · ') : 'vente − prix d’achat'],
  ];
  if (b.meilleure) chiffres.push(['Ta plus belle vente', euros(b.meilleure.eur), [b.meilleure.titre, b.meilleure.plateforme].filter(Boolean).join(' · ')]);
  const manque = [...new Set([...(v.etat === 'partiel' ? v.manque : []), ...(r.etat === 'partiel' ? r.manque : [])])];
  const suite = [];
  if (manque.length) suite.push(`« Au moins » : il manque ${liste(manque)}. Le détail est dans Compta.`);
  suite.push('Les chiffres suivent les règles de l’app : vendu au jour de la vente, reçu au jour du versement, bénéfice sur les ventes dont tu as noté le prix d’achat.');
  const titre = `Ton mois ${deMois(b.libelle)}`;
  const { texte, html } = gabaritEmail({
    titre, paras: [`Le résumé ${deMois(b.libelle)}, compté par VRM sur tous tes comptes.`], chiffres, suite,
    bouton: { mot: 'Ouvrir la Compta', url: `${SITE}/?tab=compta` },
    pied: { texte: 'Tu reçois ce bilan parce que tu l’as activé dans VRM (Réglages → Notifications).', ...(lien ? { lien, motLien: 'ne plus recevoir ce bilan' } : {}) },
  });
  return { sujet: `Ton bilan ${deMois(b.libelle)} — VRM`, texte, html };
}

// ── LE LIEN « NE PLUS RECEVOIR » (signé, comme celui de l'essai) ───────────
const b64url = (x) => x.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function cleLien(service) {
  if (!service) return null;
  return crypto.createHmac('sha256', String(service)).update('vrm-bilan-mois-v1').digest();
}
export function jetonBilan(owner, service = process.env.SUPABASE_SERVICE_KEY || '') {
  const k = cleLien(service);
  if (!k || !UUID.test(String(owner || ''))) return null;
  const o = String(owner).toLowerCase();
  return `${o}.${b64url(crypto.createHmac('sha256', k).update(o).digest()).slice(0, 32)}`;
}
export function lireJetonBilan(t, service = process.env.SUPABASE_SERVICE_KEY || '') {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/.exec(String(t || '').trim());
  if (!m || !UUID.test(m[1])) return null;
  const attendu = jetonBilan(m[1], service);
  if (!attendu) return null;
  const a = Buffer.from(attendu), c = Buffer.from(`${m[1]}.${m[2]}`);
  return a.length === c.length && crypto.timingSafeEqual(a, c) ? m[1] : null;
}
export const lienBilan = (owner, service) => { const t = jetonBilan(owner, service); return t ? `${SITE}/api/compte?mode=bilan-mois&d=${t}` : null; };

// ── LE PASSAGE D'UN VENDEUR (dans le cron du matin, son contexte) ──────────
// Les entrées sont des FONCTIONS (le cron donne les siennes, le banc les fausses) :
//   lireChoix() / lireEnvois()  → objet · null (absente) · undefined (pas su)
//   ecrireEnvois(data)          → true si la base a confirmé
//   lireDonnees()               → les lectures du bilan (`lireDonneesBilan`)
//   lirePub()                   → `vrm_benefice_jours` · null · undefined
//   adresse()                   → { etat:'ok', email } | { etat:… }
//   envoyer(message)            → { issue: 'envoye' | 'refuse' | 'incertain' }
//   compteur                    → { reste } partagé par tout le passage
//   config                      → `configurationRelances()` (le canal existant)
export async function bilanMoisVendeur({ owner, maintenant = Date.now(), lireChoix, lireEnvois, ecrireEnvois, lireDonnees, lirePub, adresse, envoyer, compteur, config, service }) {
  const mois = moisPasse(maintenant);
  if (mois.jour > JOUR_MAX) return null;                           // hors de la fenêtre : on ne lit RIEN
  const choix = await lireChoix();
  if (choix === undefined) return 'réglage illisible — rien';
  if (!choix || choix.actif !== true) return 'éteint';            // le défaut : aucun envoi, aucune lecture
  if (!config || !config.pret) return 'envoi non configuré';
  const envois = await lireEnvois();
  if (envois === undefined) return 'mémo illisible — rien';
  const deja = envois && envois.mois && envois.mois[mois.ym];
  if (deja && ['envoye', 'incertain', 'en-cours'].includes(deja.issue)) return 'déjà envoyé';
  if (!compteur || compteur.reste <= 0) return 'plafond du jour — demain';
  const d = await lireDonnees();
  if (d && Array.isArray(d.comptes) && !d.comptes.length && !Array.isArray(d.lbc) && !Array.isArray(d.ebay)) return 'aucun compte lié';
  const pub = await lirePub();
  const b = calculerBilanMois({ d, pub: pub === undefined ? null : pub, mois, maintenant });
  if (!bilanMoisAEnvoyer(b)) return 'données illisibles — réessai demain';
  const adr = await adresse();
  if (!adr || adr.etat !== 'ok') return `adresse ${adr ? adr.etat : 'pas su'}`;
  const lien = lienBilan(owner, service);
  if (!lien) return 'lien de désinscription impossible — rien';
  const t = texteBilanMois(b, { lien });
  // Le plafond se prend AVANT tout envoi (les vendeurs passent 8 à la fois).
  if (compteur.reste <= 0) return 'plafond du jour — demain';
  compteur.reste -= 1;
  const base = { ...((envois && envois.mois) || {}) };
  if (!(await ecrireEnvois({ mois: { ...base, [mois.ym]: { at: new Date(maintenant).toISOString(), issue: 'en-cours' } } }))) { compteur.reste += 1; return 'réservation non confirmée — rien'; }
  let r;
  try {
    r = await envoyer({ a: adr.email, sujet: t.sujet, texte: t.texte, html: t.html,
      entetes: { 'List-Unsubscribe': `<${lien}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', 'Auto-Submitted': 'auto-generated' } });
  } catch (e) { r = { issue: 'incertain' }; }
  const issue = ['envoye', 'refuse', 'incertain'].includes(r && r.issue) ? r.issue : 'incertain';
  const fin = issue === 'refuse' ? base : { ...base, [mois.ym]: { at: new Date(maintenant).toISOString(), issue } };
  if (issue === 'refuse') compteur.reste += 1;
  await ecrireEnvois({ mois: fin });
  return { mois: mois.ym, issue, vendu: b.vendu.etat, recu: b.recu.etat, benefice: b.benefice.etat };
}

// ── LE CHOIX DU VENDEUR (écrit par le serveur seul : sa session, ou le lien signé) ──
// Trois états à la lecture : objet · null (jamais choisi ⇒ ÉTEINT) · undefined (pas su).
const URL_BASE = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
async function ligne(owner, id) {
  const service = process.env.SUPABASE_SERVICE_KEY || '';
  if (!service || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetch(`${URL_BASE()}/rest/v1/app_data?owner=eq.${encodeURIComponent(owner)}&id=eq.${id}&select=data&limit=1`, { headers: { ...sbCle(service) } });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    const d = j[0] && j[0].data;
    return d && typeof d === 'object' ? d : null;
  } catch (_) { return undefined; }
}
export const lireChoixBilan = (owner) => ligne(owner, ID_CHOIX);
export const lireEnvoisBilan = (owner) => ligne(owner, ID_ENVOIS);
export async function ecrireChoixBilan(owner, actif) {
  const service = process.env.SUPABASE_SERVICE_KEY || '';
  if (!service || !UUID.test(String(owner || '')) || typeof actif !== 'boolean') return false;
  try {
    const r = await fetch(`${URL_BASE()}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{ owner: String(owner).toLowerCase(), id: ID_CHOIX, data: { actif, at: new Date().toISOString() } }]),
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) && j.length === 1;
  } catch (_) { return false; }
}
