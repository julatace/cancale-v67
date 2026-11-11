// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — émettre, numéroter, envoyer (2 novembre)
// ════════════════════════════════════════════════════════════════════════════
// Route `/api/compte?mode=facture-pro` (session exigée, base cloisonnée exigée).
//
//   GET                         l'état de SA boîte d'envoi (jamais le mot de passe)
//   POST {action:'boite-poser', adresse, motDePasse, fournisseur?, hote?, port?}
//                               vérifie la connexion (sans rien envoyer), puis range
//                               les identifiants CHIFFRÉS dans le coffre
//   POST {action:'boite-essai'} envoie un e-mail d'essai à SA propre adresse
//   POST {action:'boite-retirer', confirme:true}
//   POST {action:'emettre', tx, compte, designation?, confirme:true}
//                               numérote et fige la facture de CETTE vente (une
//                               seule par transaction, jamais deux numéros) ;
//                               (6 nov.) l'acheteur, le prix et la date viennent
//                               de la PREUVE relue par le serveur (lirePreuve),
//                               jamais du navigateur
//   POST {action:'envoyer', tx, avoir?, renvoyer?, confirme:true}
//                               l'envoie à l'acheteur depuis SA boîte
//   POST {action:'avoir', tx, confirme:true}
//                               annule une facture émise par un avoir numéroté
//
// ⚠️⚠️ LA NUMÉROTATION (une facture est une pièce comptable) :
//   · séquence continue, sans trou ni doublon, par vendeur (`vrm_invoice_counter`,
//     les avoirs `vrm_avoir_counter`) ;
//   · le compteur porte un JOURNAL des derniers numéros donnés (n → transaction) :
//     deux clics simultanés, ou une coupure entre « numéro pris » et « facture
//     écrite », redonnent le MÊME numéro à la même vente au lieu d'en brûler un ;
//   · comparer-et-échanger sur la valeur lue : deux ventes en même temps ne
//     reçoivent jamais le même numéro ;
//   · « pas su » (base muette) ⇒ 503, RIEN n'est numéroté ;
//   · une facture émise est un INSTANTANÉ qui ne change plus ; la corriger, c'est
//     l'annuler par un avoir.
//   · Les 5 brouillons numérotés à l'arrivée de l'e-mail avant le 2 novembre
//     (FA-2026-0001…0005, jamais envoyés) gardent LEUR numéro.
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { coffrePret, chiffrerCoffre, dechiffrerCoffre } from './coffre.js';
import { envoyerSmtp, FOURNISSEURS, fournisseurDe, hoteValide, emailSur } from './smtp.js';
import { gabaritMail } from './mail-gabarit.js';
import { manquantsVendeur, manquantsVente, contenuFacture, numeroFacture, anneeParis, jourParis, nomFichier, MESSAGE_DEFAUT, emailFacture, adresseVintedLisible, emailValide } from '../../src/facturePro/regle.js';
import { preuveAcheteur } from '../../src/facturePro/rattachement.js';
import { pdfFacture } from '../../src/facturePro/pdf.js';
import { configurationRelances } from './relances-essai.js';
// (11 nov., lot ventes-lot) Une vente de plusieurs articles : la règle de l'app (src/venteLot.js),
// COPIE refabriquée par `node scripts/audit-ventes-lot.cjs --recopie` — jamais modifiée à la main.
import { resumeVenteLot, lignesFactureLot } from './vente-lot-regle.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ID_BOITE = 'facture_boite';
export const USAGE = 'smtp-facture-v1';
const TX_RE = /^\d{4,20}$/;
const EN_COURS_MS = 3 * 60 * 1000;
const JOURNAL_MAX = 60;
// (6 nov.) L'envoi PAR VRM (décision de Julien : « ça peut être VRM qui envoie
// et met en copie le vendeur ») passe par le serveur d'envoi de VRM — les mêmes
// variables que les e-mails de l'essai (RELANCES_SMTP_*, RELANCES_EXPEDITEUR,
// api/_lib/relances-essai.js). Garde-fou anti-abus : un plafond d'envois PAR
// VENDEUR ET PAR JOUR (heure de Paris), réservé AVANT l'envoi (comparer-et-
// échanger) ; l'offre gratuite d'un fournisseur comme Brevo s'arrête à 300 / jour
// pour TOUTE l'installation.
export const PLAFOND_JOUR = 50;
// (10 nov., lot Q) Le journal de l'envoi automatique (api/_lib/factures-auto.js).
export const ID_AUTO = 'vrm_facture_auto';
export const journalAutoPublic = (j) => ({
  at: (j && j.at) || null,
  pause: j && j.pause && typeof j.pause === 'object' ? { code: String(j.pause.code || ''), texte: String(j.pause.texte || '') } : null,
  essais: Object.entries((j && j.essais) || {}).map(([tx, e]) => ({ tx, issue: String((e && e.issue) || ''), raison: String((e && e.raison) || ''), at: (e && e.at) || null }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 30),
});
export const ID_ENVOIS_JOUR = 'vrm_facture_envois_jour';
const JOURNAL_ENVOIS_MAX = 20;

const enTetes = (extra = {}) => ({ ...sbCle(sbKey()), ...extra });
const url = (id, owner) => `${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`;
const repondre = (res, code, corps) => res.status(code).json(corps);
export const nouveauRev = () => crypto.randomBytes(9).toString('base64url');
export const idFacture = (tx, avoir = false) => `email_invoice_${avoir ? 'av' : 'tx'}${tx}`;

// ── Lectures en TROIS états : undefined pas su · null absente · data ────────
export async function lireLigne(id, owner, select = 'data') {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetchAvecDelai(`${url(id, owner)}&select=${select}`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    if (!rows[0]) return null;
    return select === 'data' ? (rows[0].data == null ? null : rows[0].data) : rows[0];
  } catch (_) { return undefined; }
}
// Créer seulement si absente : 'ok' · 'conflit' · 'ko'.
export async function creer(id, owner, data) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data`, { method: 'POST', headers: enTetes({ 'content-type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify([{ owner, id, data }]) });
    if (r.ok) return 'ok';
    return r.status === 409 ? 'conflit' : 'ko';
  } catch (_) { return 'ko'; }
}
// Modifier seulement si la ligne est encore celle qu'on a lue (filtre) :
// 'ok' · 'conflit' · 'ko'.
export async function modifierSi(id, owner, filtre, data) {
  try {
    const r = await fetchAvecDelai(`${url(id, owner)}&${filtre}&select=id`, { method: 'PATCH', headers: enTetes({ 'content-type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ data }) });
    if (!r.ok) return 'ko';
    const out = await r.json().catch(() => null);
    if (!Array.isArray(out)) return 'ko';
    return out.length ? 'ok' : 'conflit';
  } catch (_) { return 'ko'; }
}
// Une liste du vendeur (projection scalaire, jamais `select=data`) : undefined = pas su.
export async function lireListe(requete, owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?owner=eq.${encodeURIComponent(owner)}&${requete}`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    return Array.isArray(rows) ? rows : undefined;
  } catch (_) { return undefined; }
}
// ── (11 nov., lot ventes-lot) LES LIGNES D'UNE VENTE EN LOT ─────────────────────
// La transaction de CETTE vente (son n°, le compte de la preuve), relue en projection : ses
// articles (`order.items`) et leur nombre. Rend undefined (pas su : aucune facture numérotée),
// null (pas un lot, ou articles pas lus : la ligne unique d'avant), ou les lignes — une par
// article, à SA part du prix (au prorata des prix affichés, sinon parts égales), somme = prix.
export async function lignesLotFacture(owner, uid, tx, centimes) {
  if (!/^\d{1,20}$/.test(String(uid || '')) || !/^\d{4,20}$/.test(String(tx || ''))) return null;
  const rows = await lireListe(`id=eq.harvest_${uid}_txn_${tx}&select=nb:data->payload->transaction->>items_count,items:data->payload->transaction->order->items`, owner);
  if (rows === undefined) return undefined;
  const r = rows[0];
  if (!r) return null;
  const lot = resumeVenteLot({ transaction: { items_count: r.nb, ...(Array.isArray(r.items) ? { order: { items: r.items } } : {}) } }, centimes);
  if (!lot || !lot.lu || !lot.mode) return null;
  return { n: lot.n, mode: lot.mode, phrase: lot.phrase, lignes: lignesFactureLot(lot.articles, lot.articles.map((a) => a.part)) };
}
// ── (6 nov.) LE BON ACHETEUR, PROUVÉ PAR LE SERVEUR LUI-MÊME ──────────────────
// La règle de src/facturePro/rattachement.js, exécutée sur les lectures du
// SERVEUR (jamais sur l'acheteur que le navigateur envoie) :
//   · les e-mails de vente Vinted Pro qui portent CE n° (scalaires) ;
//   · les lectures `orders_sold` qui contiennent CE n° (filtre `cs` : seules ces
//     lignes reviennent ; une lecture par clic d'émission ou d'envoi, jamais
//     dans une liste) ;
//   · le brouillon de facture déjà lu.
// undefined = pas su (une lecture a échoué) ⇒ l'appelant répond 503, rien.
export async function lirePreuve(owner, tx, brouillon) {
  const r = await lirePreuveEtCommandes(owner, tx, brouillon);
  return r === undefined ? undefined : r.preuve;
}
// (10 nov., lot Q) La même lecture, qui rend AUSSI les ventes Vinted portant ce n°
// (leur état dit si la vente a été annulée : l'envoi automatique ne facture jamais
// une vente annulée). undefined = pas su.
export async function lirePreuveEtCommandes(owner, tx, brouillon) {
  if (!/^\d{4,20}$/.test(String(tx))) return { preuve: preuveAcheteur({ tx }), commandes: [], mails: [] };
  const [mails, ventes] = await Promise.all([
    lireListe(`id=like.email_sale_*&data->>transaction=eq.${tx}&data->>pro=eq.true&select=id,transaction:data->>transaction,receivedAt:data->>receivedAt,prix:data->>prix,email:data->>email,nom:data->>nomComplet,adresse:data->>adresse,uid:data->>uid,designation:data->>designation`, owner),
    lireListe(`id=like.harvest_*_orders_sold&data->payload->my_orders=cs.${encodeURIComponent(JSON.stringify([{ transaction_id: Number(tx) }]))}&select=id,commandes:data->payload->my_orders`, owner),
  ]);
  if (mails === undefined || ventes === undefined) return undefined;
  const commandes = [];
  for (const v of ventes) {
    const uid = (String((v && v.id) || '').match(/^harvest_(\d+)_orders_sold$/) || [])[1] || '';
    for (const c of Array.isArray(v && v.commandes) ? v.commandes : []) if (c && String(c.transaction_id) === String(tx)) commandes.push({ ...c, uid });
  }
  return { preuve: preuveAcheteur({ tx, mails, commandes, brouillon, adresseLisible: adresseVintedLisible }), commandes, mails };
}

export const condRev = (rev) => (rev == null || rev === '' ? 'data->>rev=is.null' : `data->>rev=eq.${encodeURIComponent(String(rev))}`);

// ── LE NUMÉRO ───────────────────────────────────────────────────────────────
// Le compteur : un nombre (forme d'avant le 2 nov.) ou { n, journal:[{n,cle,at}] }.
export function lireCompteur(d) {
  if (d == null) return { n: 0, journal: [], ancien: null };
  if (typeof d === 'number' || (typeof d === 'string' && /^\d+$/.test(d))) return { n: Number(d), journal: [], ancien: Number(d) };
  if (typeof d === 'object' && Number.isInteger(d.n) && d.n >= 0) return { n: d.n, journal: Array.isArray(d.journal) ? d.journal : [], ancien: null };
  return null;                                           // forme inconnue : on ne devine pas
}
// Rend { n } · { erreur:'pas-su' }. `cle` = l'identité de la pièce (tx).
export async function prendreNumero(owner, idCompteur, cle, essais = 12) {
  for (let i = 0; i < essais; i++) {
    if (i) await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 60 * i)));
    const brut = await lireLigne(idCompteur, owner, 'data');
    if (brut === undefined) return { erreur: 'pas-su' };
    const c = lireCompteur(brut);
    if (!c) return { erreur: 'pas-su' };
    const deja = c.journal.find((x) => x && x.cle === cle);
    if (deja) return { n: deja.n };
    const n = c.n + 1;
    const suivant = { n, journal: [...c.journal, { n, cle, at: new Date().toISOString() }].slice(-JOURNAL_MAX) };
    let w;
    if (brut == null) w = await creer(idCompteur, owner, suivant);
    else if (c.ancien != null) w = await modifierSi(idCompteur, owner, `data=eq.${c.ancien}`, suivant);
    else w = await modifierSi(idCompteur, owner, `data->>n=eq.${c.n}`, suivant);
    if (w === 'ok') return { n };
    if (w === 'ko') return { erreur: 'pas-su' };
    // conflit : quelqu'un a pris un numéro entre-temps — on relit.
  }
  return { erreur: 'pas-su' };
}

// ── LA BOÎTE D'ENVOI (coffre) ──────────────────────────────────────────────
export async function lireBoite(owner) {
  const b = await lireLigne(ID_BOITE, owner, 'data');
  if (b === undefined) return undefined;
  if (!b || !b.chiffre) return null;
  return b;
}
const boitePublique = (b) => (!b ? { etat: 'aucune' } : {
  etat: 'posee',
  adresse: b.adresse || '', fournisseur: b.fournisseur || '', hote: b.hote || '', port: b.port || null,
  at: b.at || null, essaiLe: b.essaiLe || null,
});
function serveurDe(corps) {
  const adresse = String(corps.adresse || '').trim().toLowerCase();
  const f = FOURNISSEURS[corps.fournisseur] || FOURNISSEURS[fournisseurDe(adresse)] || null;
  const hote = f ? f.hote : String(corps.hote || '').trim().toLowerCase();
  const port = f ? f.port : Number(corps.port) || 465;
  return { adresse, fournisseur: f ? (corps.fournisseur && FOURNISSEURS[corps.fournisseur] ? corps.fournisseur : fournisseurDe(adresse)) : 'autre', hote, port };
}
const MSG_ETAPE = {
  identifiants: "Ta boîte refuse ces identifiants. Pour Gmail et iCloud, il faut un « mot de passe d'application » (pas ton mot de passe habituel).",
  connexion: "Le serveur d'envoi de ta boîte n'a pas répondu.",
  expediteur: "Ta boîte refuse d'envoyer depuis cette adresse.",
  destinataire: "Ta boîte refuse l'adresse de l'acheteur.",
  message: 'Ta boîte a refusé le message.',
  adresse: 'Adresse e-mail invalide.',
};

async function boitePoser(owner, corps, res) {
  const s = serveurDe(corps);
  const mdp = String(corps.motDePasse || '').replace(/\s+/g, '');   // Google affiche le sien par blocs de 4
  if (!emailSur(s.adresse)) return repondre(res, 400, { erreur: 'adresse', message: "Ce n'est pas une adresse e-mail." });
  if (!mdp || mdp.length > 200) return repondre(res, 400, { erreur: 'mdp', message: 'Colle le mot de passe d’application de ta boîte.' });
  if (!hoteValide(s.hote) || ![465, 587].includes(s.port)) return repondre(res, 400, { erreur: 'serveur', message: "Le serveur d'envoi doit être un nom (ex. smtp.exemple.fr) et le port 465 ou 587." });
  if (!coffrePret()) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const utilisateur = String(corps.utilisateur || '').trim() || s.adresse;
  const v = await envoyerSmtp({ hote: s.hote, port: s.port, utilisateur, motDePasse: mdp, de: s.adresse, a: s.adresse, seulementConnexion: true });
  if (v.issue !== 'connecte') return repondre(res, 400, { erreur: 'refusee', etape: v.etape, message: `${MSG_ETAPE[v.etape] || 'La connexion a échoué.'}${v.message ? ` (${v.message})` : ''} Rien n'a été rangé.` });
  const chiffre = chiffrerCoffre(USAGE, owner, { utilisateur, motDePasse: mdp });
  if (!chiffre) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre n'a pas pu chiffrer : rien n'a été rangé." });
  const data = { v: 1, chiffre, adresse: s.adresse, fournisseur: s.fournisseur, hote: s.hote, port: s.port, at: new Date().toISOString(), rev: nouveauRev() };
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: enTetes({ 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify([{ owner, id: ID_BOITE, data }]) });
    if (!r.ok) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu ranger ta boîte : rien n'a changé. Réessaie." });
  } catch (_) { return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : rien n'a changé. Réessaie." }); }
  return repondre(res, 200, { ok: true, boite: boitePublique(data) });
}
async function identifiants(owner) {
  const b = await lireBoite(owner);
  if (b === undefined) return { erreur: 'pas-su' };
  if (!b) return { erreur: 'aucune' };
  const d = dechiffrerCoffre(USAGE, owner, b.chiffre);
  if (!d || !d.motDePasse) return { erreur: 'illisible' };
  return { b, d };
}
// (8 nov.) L'e-mail d'essai de SA boîte d'envoi : le gabarit commun (api/_lib/mail-gabarit.js).
export const mailBoiteEssai = () => gabaritMail({
  titre: 'Ta boîte envoie bien tes factures',
  preentete: 'Tu peux supprimer ce message.',
  paras: ['Si tu lis ce message, VRM sait envoyer tes factures depuis cette boîte.', 'Tu peux le supprimer : il ne sert qu’à vérifier l’envoi.'],
  pied: { texte: 'Tu reçois ce message parce que tu as cliqué sur « Essayer » dans VRM (Ma facture → Envoi).' },
});
async function boiteEssai(owner, res) {
  const id = await identifiants(owner);
  if (id.erreur) return repondre(res, id.erreur === 'pas-su' ? 503 : 409, { erreur: id.erreur, message: id.erreur === 'pas-su' ? "La base n'a pas répondu." : 'Aucune boîte d’envoi connectée.' });
  const v = await envoyerSmtp({ hote: id.b.hote, port: id.b.port, utilisateur: id.d.utilisateur, motDePasse: id.d.motDePasse, de: id.b.adresse, a: id.b.adresse,
    sujet: 'Essai d’envoi de tes factures', ...mailBoiteEssai() });
  if (v.issue === 'envoye') {
    await modifierSi(ID_BOITE, owner, condRev(id.b.rev), { ...id.b, essaiLe: new Date().toISOString(), rev: nouveauRev() });
    return repondre(res, 200, { ok: true, issue: 'envoye', a: id.b.adresse });
  }
  return repondre(res, 200, { ok: false, issue: v.issue, message: v.issue === 'incertain' ? v.message : `${MSG_ETAPE[v.etape] || "L'envoi a échoué."}${v.message ? ` (${v.message})` : ''}` });
}
async function boiteRetirer(owner, corps, res) {
  if (!corps || corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation' });
  try {
    const r = await fetchAvecDelai(url(ID_BOITE, owner), { method: 'DELETE', headers: enTetes({ Prefer: 'return=minimal' }) });
    if (!r.ok) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta boîte est peut-être toujours connectée. Réessaie." });
  } catch (_) { return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu. Réessaie." }); }
  return repondre(res, 200, { ok: true, boite: { etat: 'aucune' } });
}

// ── ÉMETTRE ─────────────────────────────────────────────────────────────────
// Ce que l'app apprend d'une facture (jamais les octets du formulaire).
export const facturePublique = (d, id) => (!d ? null : {
  id, numero: d.number || '', emise: !!d.contenu, emiseLe: d.emiseLe || null, contenu: d.contenu || null,
  envoi: d.envoi || null, envois: Array.isArray(d.envois) ? d.envois : [], retour: !!(d.retourNom), annuleePar: d.annuleePar || null, transaction: d.transaction || '',
  preuve: !!d.preuve,
});
export async function emettre(owner, corps, res) {
  const tx = String(corps.tx || '');
  if (!TX_RE.test(tx)) return repondre(res, 400, { erreur: 'tx', message: 'Vente sans n° de transaction : pas de facture.' });
  if (corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation' });
  const id = idFacture(tx);
  const [cfg, ligne] = await Promise.all([lireLigne('vrm_pro_facture', owner), lireLigne(id, owner)]);
  if (cfg === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : aucune facture n'a été numérotée. Réessaie." });
  // Déjà émise : on rend LA MÊME (jamais un second numéro, jamais un contenu changé).
  if (ligne && ligne.contenu) return repondre(res, 200, { ok: true, deja: true, facture: facturePublique(ligne, id) });
  const mv = manquantsVendeur(cfg || {});
  // (6 nov.) L'acheteur, le prix et la date viennent de la PREUVE lue par le
  // serveur — jamais du navigateur. Pas prouvé ⇒ aucune facture, aucun numéro.
  const preuve = await lirePreuve(owner, tx, ligne);
  if (preuve === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : aucune facture n'a été numérotée. Réessaie." });
  if (!preuve.prouve) return repondre(res, 409, { erreur: 'pas-prouve', code: preuve.code, raison: preuve.raison, message: `Pas de facture : acheteur pas prouvé — ${preuve.raison}.` });
  // (11 nov.) Une vente EN LOT : une facture, une ligne par article. Pas su ⇒ aucun numéro pris.
  const lot = await lignesLotFacture(owner, preuve.uid, tx, preuve.centimes);
  if (lot === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : aucune facture n'a été numérotée. Réessaie." });
  const vente = {
    ...(lot ? { lignes: lot.lignes } : {}),
    acheteur: { nom: preuve.acheteur.nom.slice(0, 200), adresse: preuve.acheteur.adresse.slice(0, 600), email: preuve.acheteur.email.slice(0, 200) },
    designation: (String(corps.designation || '').trim() || preuve.designation).slice(0, 400),
    centimes: preuve.centimes,
    venteLe: preuve.venteLe,
    reference: tx, plateforme: 'Vinted',
  };
  const mvt = manquantsVente(vente);
  if (mv.length || mvt.length) return repondre(res, 409, { erreur: 'incomplet', manquants: [...mv, ...mvt] });
  // Le numéro : celui du brouillon d'avant (jamais envoyé) s'il en a un, sinon un neuf.
  let numero = ligne && ligne.number ? String(ligne.number) : '';
  if (!numero) {
    const p = await prendreNumero(owner, 'vrm_invoice_counter', `tx${tx}`);
    if (p.erreur) return repondre(res, 503, { erreur: 'pas-su', message: "Le compteur de factures n'a pas pu être lu : aucune facture n'a été numérotée. Réessaie." });
    numero = numeroFacture(cfg.prefixe, anneeParis(Date.now()), p.n);
  }
  const emiseLe = Date.now();
  // (10 nov., lot T) « Facture en anglais » : choisie à l'émission, figée dans l'instantané.
  const contenu = contenuFacture(cfg, vente, { numero, emiseLe, langue: corps.langue === 'en' ? 'en' : 'fr' });
  const data = {
    ...(ligne || {}), type: 'facture_pro', number: numero, status: 'emise', contenu,
    emiseLe: contenu.emiseLe, transaction: tx, account: String(corps.compte || (ligne && ligne.account) || '').slice(0, 80),
    buyerEmail: contenu.acheteur.email, buyerName: contenu.acheteur.nom, designation: contenu.lignes[0].designation, prix: (vente.centimes / 100).toFixed(2),
    html: '', createdAt: (ligne && ligne.createdAt) || contenu.emiseLe, rev: nouveauRev(),
    preuve: { tx, uid: preuve.uid, ecartS: preuve.ecartS, centimes: preuve.centimes, venteLe: preuve.venteLe, at: contenu.emiseLe },
  };
  const w = ligne ? await modifierSi(id, owner, condRev(ligne.rev), data) : await creer(id, owner, data);
  if (w === 'conflit') {
    // Un autre clic l'a émise pendant ce temps : on rend la sienne (même numéro, journal).
    const relu = await lireLigne(id, owner);
    if (relu && relu.contenu) return repondre(res, 200, { ok: true, deja: true, facture: facturePublique(relu, id) });
    return repondre(res, 409, { erreur: 'course', message: 'La facture a changé pendant l’émission. Réessaie.' });
  }
  if (w !== 'ok') return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu enregistrer la facture. Réessaie : elle gardera le même numéro." });
  return repondre(res, 200, { ok: true, facture: facturePublique(data, id) });
}

// ── L'AVOIR ─────────────────────────────────────────────────────────────────
async function avoir(owner, corps, res) {
  const tx = String(corps.tx || '');
  if (!TX_RE.test(tx) || corps.confirme !== true) return repondre(res, 400, { erreur: 'tx' });
  const idF = idFacture(tx); const idA = idFacture(tx, true);
  const [cfg, f, a] = await Promise.all([lireLigne('vrm_pro_facture', owner), lireLigne(idF, owner), lireLigne(idA, owner)]);
  if (cfg === undefined || f === undefined || a === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu. Réessaie." });
  if (!f || !f.contenu) return repondre(res, 409, { erreur: 'pas-de-facture', message: "Aucune facture émise pour cette vente : il n'y a rien à annuler." });
  if (a && a.contenu) return repondre(res, 200, { ok: true, deja: true, avoir: facturePublique(a, idA) });
  const p = await prendreNumero(owner, 'vrm_avoir_counter', `av${tx}`);
  if (p.erreur) return repondre(res, 503, { erreur: 'pas-su', message: "Le compteur d'avoirs n'a pas pu être lu. Réessaie." });
  const fc = f.contenu;
  // L'avoir reprend la facture TELLE QU'ELLE A ÉTÉ ÉMISE (son instantané), signe inversé.
  const contenu = { ...fc, type: 'avoir', numero: numeroFacture('', anneeParis(Date.now()), p.n, 'avoir'), origine: fc.numero,
    emiseLe: new Date().toISOString(),
    lignes: fc.lignes.map((l) => ({ ...l, unite: -Math.abs(l.unite), total: -Math.abs(l.total) })),
    totaux: { ht: -Math.abs(fc.totaux.ht), tva: fc.totaux.tva == null ? null : -Math.abs(fc.totaux.tva), ttc: -Math.abs(fc.totaux.ttc) },
    paiement: "Montant remboursé à l'acheteur." };
  contenu.emiseJour = jourParis(contenu.emiseLe);
  const data = { type: 'avoir_pro', number: contenu.numero, status: 'emise', contenu, emiseLe: contenu.emiseLe, transaction: tx, origine: fc.numero, buyerEmail: fc.acheteur.email, rev: nouveauRev() };
  const w = a ? await modifierSi(idA, owner, condRev(a.rev), data) : await creer(idA, owner, data);
  if (w !== 'ok') { const relu = await lireLigne(idA, owner); if (relu && relu.contenu) return repondre(res, 200, { ok: true, deja: true, avoir: facturePublique(relu, idA) }); return repondre(res, 503, { erreur: 'base', message: "L'avoir n'a pas pu être enregistré. Réessaie : il gardera le même numéro." }); }
  await modifierSi(idF, owner, condRev(f.rev), { ...f, annuleePar: contenu.numero, rev: nouveauRev() });
  return repondre(res, 200, { ok: true, avoir: facturePublique(data, idA) });
}

// ── ENVOYER ─────────────────────────────────────────────────────────────────
// (6 nov.) Deux chemins, choisis dans « Ma facture » (`cfg.envoiPar`) :
//   · 'vrm' (DÉFAUT, décision de Julien) : de l'adresse d'envoi de VRM, sous le
//     nom « <vendeur> via VRM », Reply-To = l'e-mail du vendeur, le vendeur en
//     COPIE (Cc), l'acheteur PROUVÉ en destinataire ;
//   · 'boite' : depuis SA boîte (mot de passe d'application chiffré), copie
//     cachée à lui-même (le chemin du 2 nov.).
// Garde-fous, dans l'ordre : facture émise AVEC sa preuve · preuve relue par le
// serveur, même acheteur que la facture · pas d'envoi en cours · pas de second
// envoi sans « Renvoyer » · serveur d'envoi configuré · plafond du jour réservé
// · « en cours » posé AVANT d'envoyer. Une écriture ratée avant l'envoi ⇒ RIEN
// ne part (« pas envoyé »), jamais « envoyé ».
const jourParisIso = (t = Date.now()) => { const j = jourParis(t); return `${j.slice(6, 10)}-${j.slice(3, 5)}-${j.slice(0, 2)}`; };
export const configurationEnvoiVrm = (env = process.env) => {
  const c = configurationRelances(env);
  return { pret: c.pret, manque: c.manque.filter((m) => m !== 'SUPABASE_SERVICE_KEY'), port: c.port };
};
// Réserve un envoi dans le plafond du jour : 'ok' · 'plein' · 'pas-su'.
async function reserverEnvoiJour(owner) {
  const jour = jourParisIso();
  for (let i = 0; i < 8; i++) {
    const brut = await lireLigne(ID_ENVOIS_JOUR, owner, 'data');
    if (brut === undefined) return { etat: 'pas-su' };
    const n = brut && brut.jour === jour && Number.isInteger(brut.n) ? brut.n : 0;
    if (n >= PLAFOND_JOUR) return { etat: 'plein', n };
    const data = { jour, n: n + 1, rev: nouveauRev() };
    const w = brut == null ? await creer(ID_ENVOIS_JOUR, owner, data) : await modifierSi(ID_ENVOIS_JOUR, owner, condRev(brut.rev), data);
    if (w === 'ok') return { etat: 'ok', n: n + 1 };
    if (w === 'ko') return { etat: 'pas-su' };
  }
  return { etat: 'pas-su' };
}
// `opts.auto` : l'envoi AUTOMATIQUE (api/_lib/factures-auto.js) — jamais posé par le navigateur.
export async function envoyer(owner, corps, res, env = process.env, opts = {}) {
  const auto = !!(opts && opts.auto === true);
  const tx = String(corps.tx || '');
  if (!TX_RE.test(tx) || corps.confirme !== true) return repondre(res, 400, { erreur: 'tx' });
  const avoir = !!corps.avoir;
  const id = idFacture(tx, avoir);
  const [cfg, ligne, facture] = await Promise.all([lireLigne('vrm_pro_facture', owner), lireLigne(id, owner), avoir ? lireLigne(idFacture(tx), owner) : Promise.resolve(null)]);
  if (cfg === undefined || ligne === undefined || facture === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : rien n'est parti. Réessaie." });
  if (!ligne || !ligne.contenu) return repondre(res, 409, { erreur: 'pas-emise', message: "La facture n'est pas encore émise." });
  const c = ligne.contenu;
  // La preuve : celle de l'émission, puis RELUE maintenant (une vente peut avoir changé).
  const preuveEmise = avoir ? (facture && facture.preuve) : ligne.preuve;
  if (!preuveEmise) return repondre(res, 409, { erreur: 'pas-prouve', code: 'emission', message: "Cette facture a été émise sans preuve de l'acheteur : VRM ne l'envoie pas. Partage le PDF toi-même si tu es sûr du destinataire." });
  const preuve = await lirePreuve(owner, tx, avoir ? facture : ligne);
  if (preuve === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : rien n'est parti. Réessaie." });
  if (!preuve.prouve) return repondre(res, 409, { erreur: 'pas-prouve', code: preuve.code, raison: preuve.raison, message: `Rien n'est parti : acheteur pas prouvé — ${preuve.raison}.` });
  if (String(preuve.acheteur.email).toLowerCase() !== String(c.acheteur.email || '').toLowerCase()) return repondre(res, 409, { erreur: 'pas-prouve', code: 'destinataire', message: "Rien n'est parti : l'adresse de la facture n'est plus celle de l'acheteur prouvé." });
  if (!emailSur(c.acheteur.email)) return repondre(res, 409, { erreur: 'email', message: "La facture ne porte pas d'adresse e-mail d'acheteur valide." });
  const e = ligne.envoi || null;
  const tEnvoi = Date.parse((e && e.at) || '');
  if (e && e.etat === 'en-cours' && Number.isFinite(tEnvoi) && Date.now() - tEnvoi < EN_COURS_MS) return repondre(res, 409, { erreur: 'en-cours', message: "Un envoi de cette facture est déjà en cours. Attends une minute." });
  if (e && (e.etat === 'envoyee' || e.etat === 'incertaine') && corps.renvoyer !== true) return repondre(res, 409, { erreur: 'deja', envoi: e, message: e.etat === 'envoyee' ? 'Cette facture est déjà partie.' : 'Un envoi précédent est incertain.' });
  // Le chemin d'envoi et ce qu'il exige.
  const via = cfg && cfg.envoiPar === 'boite' ? 'boite' : 'vrm';
  const vendeurEmail = String((cfg && cfg.email) || '').trim();
  let transport;
  if (via === 'vrm') {
    const conf = configurationEnvoiVrm(env);
    if (!conf.pret) return repondre(res, 503, { erreur: 'vrm-smtp', manque: conf.manque, message: "L'envoi par VRM n'est pas encore ouvert sur ce serveur : rien n'est parti." });
    if (!emailValide(vendeurEmail) || !emailSur(vendeurEmail)) return repondre(res, 409, { erreur: 'email-vendeur', message: "Ajoute ton adresse e-mail dans « Ma facture » : l'acheteur te répond à cette adresse et tu reçois la copie. Rien n'est parti." });
    transport = { hote: env.RELANCES_SMTP_HOTE, port: conf.port, utilisateur: env.RELANCES_SMTP_UTILISATEUR, motDePasse: env.RELANCES_SMTP_MOT_DE_PASSE, de: String(env.RELANCES_EXPEDITEUR).trim(), cc: [vendeurEmail], replyTo: vendeurEmail, bcc: [] };
  } else {
    const ids = await identifiants(owner);
    if (ids.erreur === 'pas-su') return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : rien n'est parti. Réessaie." });
    if (ids.erreur) return repondre(res, 409, { erreur: 'boite', message: ids.erreur === 'aucune' ? 'Connecte d’abord ta boîte e-mail (Ma facture → Envoi), ou laisse VRM envoyer.' : 'Ta boîte d’envoi ne se lit plus côté serveur : reconnecte-la.' });
    transport = { hote: ids.b.hote, port: ids.b.port, utilisateur: ids.d.utilisateur, motDePasse: ids.d.motDePasse, de: ids.b.adresse, cc: [], replyTo: '', bcc: cfg && cfg.copie === false ? [] : [ids.b.adresse] };
  }
  // Le plafond du jour (envoi par VRM seulement : c'est son serveur qui compte).
  if (via === 'vrm') {
    const p = await reserverEnvoiJour(owner);
    if (p.etat === 'pas-su') return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : rien n'est parti. Réessaie." });
    if (p.etat === 'plein') return repondre(res, 429, { erreur: 'plafond', plafond: PLAFOND_JOUR, message: `Plafond atteint : ${PLAFOND_JOUR} factures envoyées par VRM aujourd'hui. Rien n'est parti ; réessaie demain, ou partage le PDF toi-même.` });
  }
  // Marquer « en cours » AVANT d'envoyer (comparer-et-échanger) : deux clics,
  // deux appareils, un seul envoi. Écriture ratée ⇒ rien ne part.
  const marque = { ...ligne, envoi: { etat: 'en-cours', at: new Date().toISOString(), a: c.acheteur.email, via, ...(auto ? { auto: true } : {}) }, rev: nouveauRev() };
  const w = await modifierSi(id, owner, condRev(ligne.rev), marque);
  if (w === 'conflit') return repondre(res, 409, { erreur: 'en-cours', message: "La facture a changé à l'instant (un autre appareil ?). Rouvre-la." });
  if (w !== 'ok') return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : rien n'est parti. Réessaie." });
  let pdf;
  try { pdf = Buffer.from(await pdfFacture(c)); } catch (err) {
    await modifierSi(id, owner, condRev(marque.rev), { ...marque, envoi: { etat: 'refusee', at: new Date().toISOString(), message: 'Le PDF n’a pas pu être fabriqué.', via }, rev: nouveauRev() });
    return repondre(res, 500, { erreur: 'pdf', message: "Le PDF de la facture n'a pas pu être fabriqué : rien n'est parti." });
  }
  const pieces = [{ nom: nomFichier(c), octets: pdf }];
  if (c.type !== 'avoir' && ligne.retourB64) pieces.push({ nom: ligne.retourNom || 'Formulaire-retour.pdf', octets: Buffer.from(ligne.retourB64, 'base64') });
  const mail = emailFacture(cfg || {}, c, { via });
  const v = await envoyerSmtp({ hote: transport.hote, port: transport.port, utilisateur: transport.utilisateur, motDePasse: transport.motDePasse,
    de: transport.de, nomDe: mail.nomExpediteur, a: c.acheteur.email, cc: transport.cc, replyTo: transport.replyTo, bcc: transport.bcc,
    sujet: mail.sujet, texte: mail.texte, html: mail.html, pieces });
  const at = new Date().toISOString();
  const envoi = v.issue === 'envoye' ? { etat: 'envoyee', at, a: c.acheteur.email, de: transport.de, via, cc: transport.cc[0] || '', id: v.id, retour: pieces.length > 1, ...(auto ? { auto: true } : {}) }
    : v.issue === 'incertain' ? { etat: 'incertaine', at, a: c.acheteur.email, via, message: v.message, ...(auto ? { auto: true } : {}) }
    : { etat: 'refusee', at, a: c.acheteur.email, via, message: `${MSG_ETAPE[v.etape] || "L'envoi a échoué."}${v.message ? ` (${v.message})` : ''}`, ...(auto ? { auto: true } : {}) };
  // Le JOURNAL des envois (date, destinataire, chemin, issue) : seulement allongé.
  const envois = [...(Array.isArray(ligne.envois) ? ligne.envois : []), { etat: envoi.etat, at, a: envoi.a, via, cc: envoi.cc || '', ...(auto ? { auto: true } : {}) }].slice(-JOURNAL_ENVOIS_MAX);
  const fin = { ...marque, envoi, envois, status: v.issue === 'envoye' ? 'sent' : marque.status, ...(v.issue === 'envoye' ? { sentAt: at, retourB64: '' } : {}), rev: nouveauRev() };
  let ecrit = await modifierSi(id, owner, condRev(marque.rev), fin);
  if (ecrit === 'ko') ecrit = await modifierSi(id, owner, condRev(marque.rev), fin);   // un hoquet : une fois encore
  return repondre(res, 200, { ok: v.issue === 'envoye', issue: v.issue, envoi, envois, noteRatee: ecrit !== 'ok', facture: facturePublique(fin, id) });
}

async function etat(owner, res, env = process.env) {
  const [b, compteur, jour, auto] = await Promise.all([lireBoite(owner), lireLigne('vrm_invoice_counter', owner, 'data'), lireLigne(ID_ENVOIS_JOUR, owner, 'data'), lireLigne(ID_AUTO, owner, 'data')]);
  if (b === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "Je n'ai pas pu lire ta boîte d'envoi (la base n'a pas répondu)." });
  // Le prochain n° (lu, jamais deviné) : null = pas su.
  const cpt = compteur === undefined ? null : lireCompteur(compteur);
  const conf = configurationEnvoiVrm(env);
  const n = jour === undefined ? null : (jour && jour.jour === jourParisIso() && Number.isInteger(jour.n) ? jour.n : 0);
  return repondre(res, 200, { ok: true, coffre: coffrePret(), boite: boitePublique(b), fournisseurs: Object.fromEntries(Object.entries(FOURNISSEURS).map(([k, f]) => [k, { l: f.l, hote: f.hote, port: f.port }])), messageDefaut: MESSAGE_DEFAUT,
    prochain: cpt ? cpt.n + 1 : null,
    vrm: { pret: conf.pret, manque: conf.manque, plafond: PLAFOND_JOUR, aujourdhui: n },
    // (10 nov., lot Q) Le dernier passage de l'envoi automatique (aucun e-mail d'acheteur
    // dedans : n° de transaction, issue, raison). undefined = pas su ⇒ null.
    auto: auto === undefined ? null : auto ? journalAutoPublic(auto) : { at: null, pause: null, essais: [] } });
}

export async function routeFacturePro(req, res, { vendeur, corps, acces, cloisonnee }) {
  if (cloisonnee === null || cloisonnee === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu. Réessaie." });
  if (cloisonnee !== true) return repondre(res, 503, { erreur: 'base', message: 'La base ne sépare pas encore les vendeurs : la facturation Pro attend que ce soit le cas.' });
  const owner = vendeur.id;
  if (req.method === 'GET') return etat(owner, res);
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST' });
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'corps' });
  const action = String(corps.action || '');
  if (action === 'boite-retirer') return boiteRetirer(owner, corps, res);
  if (acces === false) return repondre(res, 402, { erreur: 'abonnement', message: 'Ton abonnement VRM est coupé : la facturation est en pause.' });
  if (action === 'boite-poser') return boitePoser(owner, corps, res);
  if (action === 'boite-essai') return boiteEssai(owner, res);
  if (action === 'emettre') return emettre(owner, corps, res);
  if (action === 'envoyer') return envoyer(owner, corps, res);
  if (action === 'avoir') return avoir(owner, corps, res);
  return repondre(res, 400, { erreur: 'action inconnue' });
}
