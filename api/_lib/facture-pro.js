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
//   POST {action:'emettre', tx, compte, acheteur:{nom,adresse,email}, designation,
//         centimes, venteLe, confirme:true}
//                               numérote et fige la facture de CETTE vente (une
//                               seule par transaction, jamais deux numéros)
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
import { manquantsVendeur, manquantsVente, contenuFacture, numeroFacture, anneeParis, jourParis, messageEmail, nomFichier, MESSAGE_DEFAUT } from '../../src/facturePro/regle.js';
import { pdfFacture } from '../../src/facturePro/pdf.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ID_BOITE = 'facture_boite';
export const USAGE = 'smtp-facture-v1';
const TX_RE = /^\d{4,20}$/;
const EN_COURS_MS = 3 * 60 * 1000;
const JOURNAL_MAX = 60;

const enTetes = (extra = {}) => ({ ...sbCle(sbKey()), ...extra });
const url = (id, owner) => `${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`;
const repondre = (res, code, corps) => res.status(code).json(corps);
const nouveauRev = () => crypto.randomBytes(9).toString('base64url');
export const idFacture = (tx, avoir = false) => `email_invoice_${avoir ? 'av' : 'tx'}${tx}`;

// ── Lectures en TROIS états : undefined pas su · null absente · data ────────
export async function lireLigne(id, owner, select = 'data') {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetch(`${url(id, owner)}&select=${select}`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    if (!rows[0]) return null;
    return select === 'data' ? (rows[0].data == null ? null : rows[0].data) : rows[0];
  } catch (_) { return undefined; }
}
// Créer seulement si absente : 'ok' · 'conflit' · 'ko'.
async function creer(id, owner, data) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, { method: 'POST', headers: enTetes({ 'content-type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify([{ owner, id, data }]) });
    if (r.ok) return 'ok';
    return r.status === 409 ? 'conflit' : 'ko';
  } catch (_) { return 'ko'; }
}
// Modifier seulement si la ligne est encore celle qu'on a lue (filtre) :
// 'ok' · 'conflit' · 'ko'.
async function modifierSi(id, owner, filtre, data) {
  try {
    const r = await fetch(`${url(id, owner)}&${filtre}&select=id`, { method: 'PATCH', headers: enTetes({ 'content-type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ data }) });
    if (!r.ok) return 'ko';
    const out = await r.json().catch(() => null);
    if (!Array.isArray(out)) return 'ko';
    return out.length ? 'ok' : 'conflit';
  } catch (_) { return 'ko'; }
}
const condRev = (rev) => (rev == null || rev === '' ? 'data->>rev=is.null' : `data->>rev=eq.${encodeURIComponent(String(rev))}`);

// ── LE NUMÉRO ───────────────────────────────────────────────────────────────
// Le compteur : un nombre (forme d'avant le 2 nov.) ou { n, journal:[{n,cle,at}] }.
export function lireCompteur(d) {
  if (d == null) return { n: 0, journal: [], ancien: null };
  if (typeof d === 'number' || (typeof d === 'string' && /^\d+$/.test(d))) return { n: Number(d), journal: [], ancien: Number(d) };
  if (typeof d === 'object' && Number.isInteger(d.n) && d.n >= 0) return { n: d.n, journal: Array.isArray(d.journal) ? d.journal : [], ancien: null };
  return null;                                           // forme inconnue : on ne devine pas
}
// Rend { n } · { erreur:'pas-su' }. `cle` = l'identité de la pièce (tx).
export async function prendreNumero(owner, idCompteur, cle, essais = 4) {
  for (let i = 0; i < essais; i++) {
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
async function lireBoite(owner) {
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: enTetes({ 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify([{ owner, id: ID_BOITE, data }]) });
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
async function boiteEssai(owner, res) {
  const id = await identifiants(owner);
  if (id.erreur) return repondre(res, id.erreur === 'pas-su' ? 503 : 409, { erreur: id.erreur, message: id.erreur === 'pas-su' ? "La base n'a pas répondu." : 'Aucune boîte d’envoi connectée.' });
  const v = await envoyerSmtp({ hote: id.b.hote, port: id.b.port, utilisateur: id.d.utilisateur, motDePasse: id.d.motDePasse, de: id.b.adresse, a: id.b.adresse,
    sujet: 'VRM — essai d’envoi de tes factures', texte: "Si tu lis ce message, VRM sait envoyer tes factures depuis cette boîte. Tu peux le supprimer." });
  if (v.issue === 'envoye') {
    await modifierSi(ID_BOITE, owner, condRev(id.b.rev), { ...id.b, essaiLe: new Date().toISOString(), rev: nouveauRev() });
    return repondre(res, 200, { ok: true, issue: 'envoye', a: id.b.adresse });
  }
  return repondre(res, 200, { ok: false, issue: v.issue, message: v.issue === 'incertain' ? v.message : `${MSG_ETAPE[v.etape] || "L'envoi a échoué."}${v.message ? ` (${v.message})` : ''}` });
}
async function boiteRetirer(owner, corps, res) {
  if (!corps || corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation' });
  try {
    const r = await fetch(url(ID_BOITE, owner), { method: 'DELETE', headers: enTetes({ Prefer: 'return=minimal' }) });
    if (!r.ok) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta boîte est peut-être toujours connectée. Réessaie." });
  } catch (_) { return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu. Réessaie." }); }
  return repondre(res, 200, { ok: true, boite: { etat: 'aucune' } });
}

// ── ÉMETTRE ─────────────────────────────────────────────────────────────────
// Ce que l'app apprend d'une facture (jamais les octets du formulaire).
export const facturePublique = (d, id) => (!d ? null : {
  id, numero: d.number || '', emise: !!d.contenu, emiseLe: d.emiseLe || null, contenu: d.contenu || null,
  envoi: d.envoi || null, retour: !!(d.retourNom), annuleePar: d.annuleePar || null, transaction: d.transaction || '',
});
async function emettre(owner, corps, res) {
  const tx = String(corps.tx || '');
  if (!TX_RE.test(tx)) return repondre(res, 400, { erreur: 'tx', message: 'Vente sans n° de transaction : pas de facture.' });
  if (corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation' });
  const id = idFacture(tx);
  const [cfg, ligne] = await Promise.all([lireLigne('vrm_pro_facture', owner), lireLigne(id, owner)]);
  if (cfg === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : aucune facture n'a été numérotée. Réessaie." });
  // Déjà émise : on rend LA MÊME (jamais un second numéro, jamais un contenu changé).
  if (ligne && ligne.contenu) return repondre(res, 200, { ok: true, deja: true, facture: facturePublique(ligne, id) });
  const mv = manquantsVendeur(cfg || {});
  const vente = {
    acheteur: { nom: String((corps.acheteur || {}).nom || '').slice(0, 200), adresse: String((corps.acheteur || {}).adresse || '').slice(0, 600), email: String((corps.acheteur || {}).email || '').trim().slice(0, 200) },
    designation: String(corps.designation || '').slice(0, 400),
    centimes: Number(corps.centimes),
    venteLe: String(corps.venteLe || ''),
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
  const contenu = contenuFacture(cfg, vente, { numero, emiseLe });
  const data = {
    ...(ligne || {}), type: 'facture_pro', number: numero, status: 'emise', contenu,
    emiseLe: contenu.emiseLe, transaction: tx, account: String(corps.compte || (ligne && ligne.account) || '').slice(0, 80),
    buyerEmail: contenu.acheteur.email, buyerName: contenu.acheteur.nom, designation: contenu.lignes[0].designation, prix: (vente.centimes / 100).toFixed(2),
    html: '', createdAt: (ligne && ligne.createdAt) || contenu.emiseLe, rev: nouveauRev(),
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
async function envoyer(owner, corps, res) {
  const tx = String(corps.tx || '');
  if (!TX_RE.test(tx) || corps.confirme !== true) return repondre(res, 400, { erreur: 'tx' });
  const id = idFacture(tx, !!corps.avoir);
  const [cfg, ligne, ids] = await Promise.all([lireLigne('vrm_pro_facture', owner), lireLigne(id, owner), identifiants(owner)]);
  if (cfg === undefined || ligne === undefined || ids.erreur === 'pas-su') return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu : rien n'est parti. Réessaie." });
  if (!ligne || !ligne.contenu) return repondre(res, 409, { erreur: 'pas-emise', message: "La facture n'est pas encore émise." });
  if (ids.erreur) return repondre(res, 409, { erreur: 'boite', message: ids.erreur === 'aucune' ? 'Connecte d’abord ta boîte e-mail (Facturation Pro → Envoi).' : 'Ta boîte d’envoi ne se lit plus côté serveur : reconnecte-la.' });
  const c = ligne.contenu;
  if (!emailSur(c.acheteur.email)) return repondre(res, 409, { erreur: 'email', message: "La facture ne porte pas d'adresse e-mail d'acheteur valide." });
  const e = ligne.envoi || null;
  const tEnvoi = Date.parse((e && e.at) || '');
  if (e && e.etat === 'en-cours' && Number.isFinite(tEnvoi) && Date.now() - tEnvoi < EN_COURS_MS) return repondre(res, 409, { erreur: 'en-cours', message: "Un envoi de cette facture est déjà en cours. Attends une minute." });
  if (e && (e.etat === 'envoyee' || e.etat === 'incertaine') && corps.renvoyer !== true) return repondre(res, 409, { erreur: 'deja', envoi: e, message: e.etat === 'envoyee' ? 'Cette facture est déjà partie.' : 'Un envoi précédent est incertain.' });
  // Marquer « en cours » AVANT d'envoyer (comparer-et-échanger) : deux clics,
  // deux appareils, un seul envoi.
  const marque = { ...ligne, envoi: { etat: 'en-cours', at: new Date().toISOString(), a: c.acheteur.email }, rev: nouveauRev() };
  const w = await modifierSi(id, owner, condRev(ligne.rev), marque);
  if (w === 'conflit') return repondre(res, 409, { erreur: 'en-cours', message: "La facture a changé à l'instant (un autre appareil ?). Rouvre-la." });
  if (w !== 'ok') return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : rien n'est parti. Réessaie." });
  let pdf;
  try { pdf = Buffer.from(await pdfFacture(c)); } catch (err) {
    await modifierSi(id, owner, condRev(marque.rev), { ...marque, envoi: { etat: 'refusee', at: new Date().toISOString(), message: 'Le PDF n’a pas pu être fabriqué.' }, rev: nouveauRev() });
    return repondre(res, 500, { erreur: 'pdf', message: "Le PDF de la facture n'a pas pu être fabriqué : rien n'est parti." });
  }
  const pieces = [{ nom: nomFichier(c), octets: pdf }];
  if (c.type !== 'avoir' && ligne.retourB64) pieces.push({ nom: ligne.retourNom || 'Formulaire-retour.pdf', octets: Buffer.from(ligne.retourB64, 'base64') });
  const { sujet, corps: texte } = messageEmail(cfg || {}, c);
  const v = await envoyerSmtp({ hote: ids.b.hote, port: ids.b.port, utilisateur: ids.d.utilisateur, motDePasse: ids.d.motDePasse,
    de: ids.b.adresse, nomDe: c.vendeur.nom, a: c.acheteur.email, bcc: cfg && cfg.copie === false ? [] : [ids.b.adresse],
    sujet, texte, pieces });
  const at = new Date().toISOString();
  const envoi = v.issue === 'envoye' ? { etat: 'envoyee', at, a: c.acheteur.email, de: ids.b.adresse, id: v.id, retour: pieces.length > 1 }
    : v.issue === 'incertain' ? { etat: 'incertaine', at, a: c.acheteur.email, message: v.message }
    : { etat: 'refusee', at, a: c.acheteur.email, message: `${MSG_ETAPE[v.etape] || "L'envoi a échoué."}${v.message ? ` (${v.message})` : ''}` };
  const fin = { ...marque, envoi, status: v.issue === 'envoye' ? 'sent' : marque.status, ...(v.issue === 'envoye' ? { sentAt: at, retourB64: '' } : {}), rev: nouveauRev() };
  let ecrit = await modifierSi(id, owner, condRev(marque.rev), fin);
  if (ecrit === 'ko') ecrit = await modifierSi(id, owner, condRev(marque.rev), fin);   // un hoquet : une fois encore
  return repondre(res, 200, { ok: v.issue === 'envoye', issue: v.issue, envoi, noteRatee: ecrit !== 'ok', facture: facturePublique(fin, id) });
}

async function etat(owner, res) {
  const b = await lireBoite(owner);
  if (b === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "Je n'ai pas pu lire ta boîte d'envoi (la base n'a pas répondu)." });
  return repondre(res, 200, { ok: true, coffre: coffrePret(), boite: boitePublique(b), fournisseurs: Object.fromEntries(Object.entries(FOURNISSEURS).map(([k, f]) => [k, { l: f.l, hote: f.hote, port: f.port }])), messageDefaut: MESSAGE_DEFAUT });
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
