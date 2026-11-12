// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — LEBONCOIN, EBAY, VESTIAIRE : émettre (10 nov., lot S)
// ════════════════════════════════════════════════════════════════════════════
// Route `/api/compte?mode=facture-autre` (session exigée, base cloisonnée exigée).
//
//   POST {action:'emettre', plateforme, ref, acheteur:{nom, adresse}, designation?, confirme:true}
//        numérote et fige la facture de CETTE vente — une seule par vente, jamais
//        deux numéros. Le PRIX, la DATE et la désignation par défaut viennent de la
//        vente relue ICI (`lbc_ventes`, `ebay_orders*`), jamais du navigateur ;
//        la règle est src/facturePro/sources.js (la même que l'app).
//
// ⚠️ LA NUMÉROTATION EST LA MÊME SUITE QUE VINTED : `prendreNumero` de
//    api/_lib/facture-pro.js sur `vrm_invoice_counter` (comparer-et-échanger +
//    journal), avec la clé `lbc{n°}` / `ebay{n°}` — une seule suite continue,
//    sans trou ni doublon, toutes plateformes confondues.
// ⚠️ L'ACHETEUR est recopié par le vendeur (aucune de ces plateformes ne le
//    prouve) : rangé comme tel (`acheteurSource: 'saisi'`). VRM n'ENVOIE pas ces
//    factures (aucune adresse e-mail prouvée) : PDF à partager.
// ⚠️ Lectures en projection (§4.4), « pas su » ⇒ 503 et RIEN n'est numéroté.
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { lireLigne, prendreNumero } from './facture-pro.js';
import { manquantsVendeur, manquantsVente, contenuFacture, numeroFacture, anneeParis, refusMarge } from '../../src/facturePro/regle.js';
import { PLATEFORMES, refValide, idFactureAutre, cleNumeroAutre, venteAutre, manquantsAcheteurSaisi, venteFacture } from '../../src/facturePro/sources.js';
import { compteFacturable, compteDeVente } from '../../src/facturePro/comptes.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enTetes = (extra = {}) => ({ ...sbCle(sbKey()), ...extra });
const repondre = (res, code, corps) => res.status(code).json(corps);
const nouveauRev = () => crypto.randomBytes(9).toString('base64url');
const PAS_SU = "La base n'a pas répondu : aucune facture n'a été numérotée. Réessaie.";

async function lireListe(requete, owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?owner=eq.${encodeURIComponent(owner)}&${requete}`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    return Array.isArray(rows) ? rows : undefined;
  } catch (_) { return undefined; }
}
async function creer(id, owner, data) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, { method: 'POST', headers: enTetes({ 'content-type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify([{ owner, id, data }]) });
    if (r.ok) return 'ok';
    return r.status === 409 ? 'conflit' : 'ko';
  } catch (_) { return 'ko'; }
}

// La vente brute de la plateforme, relue par le serveur. undefined = pas su ·
// null = pas trouvée · objet. Deux commandes eBay au même n° (deux comptes) ⇒ 'double'.
export async function lireVenteAutre(owner, plateforme, ref) {
  if (plateforme === 'leboncoin') {
    const rows = await lireListe('id=eq.lbc_ventes&select=ventes:data->ventes', owner);
    if (rows === undefined) return undefined;
    const ventes = rows[0] && rows[0].ventes;
    if (!ventes || typeof ventes !== 'object' || Array.isArray(ventes)) return null;
    const v = ventes[ref];
    // La clé ET le n° porté doivent dire la même vente (identité, §5).
    return v && typeof v === 'object' && String(v.txId) === String(ref) ? v : null;
  }
  if (plateforme === 'ebay') {
    const rows = await lireListe(`id=like.ebay_orders*&data->orders=cs.${encodeURIComponent(JSON.stringify([{ orderId: String(ref) }]))}&select=id,orders:data->orders`, owner);
    if (rows === undefined) return undefined;
    const trouvees = [];
    // (11 nov.) Chaque commande garde le compte VRM de SA ligne (`_compte`, comme l'app) :
    // « compte professionnel » se décide par compte (src/facturePro/comptes.js).
    for (const r of rows) for (const o of Array.isArray(r && r.orders) ? r.orders : []) if (o && String(o.orderId) === String(ref)) trouvees.push({ ...o, _compte: /^ebay_orders_./.test(String(r.id || '')) ? String(r.id).slice('ebay_orders_'.length) : 'principal' });
    if (trouvees.length > 1) return 'double';
    return trouvees[0] || null;
  }
  if (plateforme === 'vestiaire') {
    const rows = await lireListe('id=eq.vc_ventes&select=ventes:data->ventes', owner);
    if (rows === undefined) return undefined;
    const ventes = rows[0] && rows[0].ventes;
    const v = ventes && typeof ventes === 'object' && !Array.isArray(ventes) ? ventes[ref] : null;
    // (11 nov.) L'identité est la CLÉ relue ici (posée en `id`), jamais un champ du navigateur.
    return v && typeof v === 'object' ? { ...v, id: String(ref) } : null;
  }
  return null;
}

export const factureAutrePublique = (d, id) => (!d ? null : {
  id, numero: d.number || '', emiseLe: d.emiseLe || null, plateforme: d.plateforme || '', reference: d.reference || '',
  acheteur: (d.contenu && d.contenu.acheteur && d.contenu.acheteur.nom) || '', ttc: d.contenu && d.contenu.totaux ? d.contenu.totaux.ttc : null,
  contenu: d.contenu || null,
});

async function emettre(owner, corps, res) {
  const plateforme = String(corps.plateforme || '');
  const ref = String(corps.ref || '').trim();
  if (!PLATEFORMES[plateforme] || !refValide(plateforme, ref)) return repondre(res, 400, { erreur: 'ref', message: 'Vente sans n° de commande lu : pas de facture.' });
  if (corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation' });
  const id = idFactureAutre(plateforme, ref);
  const [cfg, ligne] = await Promise.all([lireLigne('vrm_pro_facture', owner), lireLigne(id, owner)]);
  if (cfg === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'pas-su', message: PAS_SU });
  // Déjà émise : la MÊME (jamais un second numéro, jamais un contenu changé).
  if (ligne && ligne.contenu) return repondre(res, 200, { ok: true, deja: true, facture: factureAutrePublique(ligne, id) });
  const brut = await lireVenteAutre(owner, plateforme, ref);
  if (brut === undefined) return repondre(res, 503, { erreur: 'pas-su', message: PAS_SU });
  if (brut === 'double') return repondre(res, 409, { erreur: 'double', message: 'Deux commandes portent ce n° : pas de facture.' });
  if (!brut) return repondre(res, 409, { erreur: 'absente', message: `Cette vente n'est pas (encore) lue dans tes ventes ${PLATEFORMES[plateforme].l}.` });
  const v = venteAutre(plateforme, brut);
  if (!v.ok) return repondre(res, 409, { erreur: 'refus', code: v.code, raison: v.raison, message: `Pas de facture : ${v.raison}.` });
  // (11 nov., lot DJ1) Seulement un compte qu'IL a dit professionnel (src/facturePro/comptes.js).
  if (compteFacturable(cfg || {}, plateforme, compteDeVente(plateforme, brut)) !== true) return repondre(res, 409, { erreur: 'compte', message: 'Pas de facture : ce compte n’est pas marqué professionnel (Ma facture → Sur quels comptes ?).' });
  const ma =manquantsAcheteurSaisi(corps.acheteur);
  const mv = manquantsVendeur(cfg || {});
  const vente = venteFacture(v, corps.acheteur, corps.designation);
  const mvt = manquantsVente(vente);
  if (mv.length || ma.length || mvt.length) return repondre(res, 409, { erreur: 'incomplet', manquants: [...mv, ...ma, ...mvt] });
  // (11 nov., lot tva-marge) TVA sur marge : aucune TVA apparente (art. 297 E) — refusé AVANT le numéro.
  const rm = refusMarge(cfg, vente);
  if (rm) return repondre(res, 409, { erreur: 'tva-apparente', message: `Pas de facture : ${rm}` });
  const p = await prendreNumero(owner, 'vrm_invoice_counter', cleNumeroAutre(plateforme, ref));
  if (p.erreur) return repondre(res, 503, { erreur: 'pas-su', message: "Le compteur de factures n'a pas pu être lu : aucune facture n'a été numérotée. Réessaie." });
  const numero = numeroFacture(cfg.prefixe, anneeParis(Date.now()), p.n);
  const emiseLe = Date.now();
  const contenu = contenuFacture(cfg, vente, { numero, emiseLe });
  const data = {
    type: 'facture_pro', plateforme, reference: ref, number: numero, status: 'emise', contenu,
    emiseLe: contenu.emiseLe, account: String(v.compte || '').slice(0, 80),
    buyerName: contenu.acheteur.nom, designation: contenu.lignes[0].designation, prix: (vente.centimes / 100).toFixed(2),
    acheteurSource: 'saisi', createdAt: contenu.emiseLe, rev: nouveauRev(),
    vente: { plateforme, ref, centimes: v.centimes, venteLe: v.venteLe, at: contenu.emiseLe },
  };
  const w = await creer(id, owner, data);
  if (w === 'conflit') {
    const relu = await lireLigne(id, owner);
    if (relu && relu.contenu) return repondre(res, 200, { ok: true, deja: true, facture: factureAutrePublique(relu, id) });
    return repondre(res, 409, { erreur: 'course', message: 'La facture a changé pendant l’émission. Réessaie.' });
  }
  if (w !== 'ok') return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu enregistrer la facture. Réessaie : elle gardera le même numéro." });
  return repondre(res, 200, { ok: true, facture: factureAutrePublique(data, id) });
}

export async function routeFactureAutre(req, res, { vendeur, corps, acces, cloisonnee }) {
  if (cloisonnee === null || cloisonnee === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "La base n'a pas répondu. Réessaie." });
  if (cloisonnee !== true) return repondre(res, 503, { erreur: 'base', message: 'La base ne sépare pas encore les vendeurs : la facturation Pro attend que ce soit le cas.' });
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST' });
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'corps' });
  if (acces === false) return repondre(res, 402, { erreur: 'abonnement', message: 'Ton abonnement VRM est coupé : la facturation est en pause.' });
  if (String(corps.action || '') === 'emettre') return emettre(vendeur.id, corps, res);
  return repondre(res, 400, { erreur: 'action inconnue' });
}
