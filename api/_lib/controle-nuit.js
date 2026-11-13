// ═══════════════════════════════════════════════════════════════════════════
// LE CONTRÔLE DE NUIT, CÔTÉ SERVEUR (11 nov., lot agent2-veille)
// ═══════════════════════════════════════════════════════════════════════════
// La règle et les mots : src/controleNuit.js (module pur, importé tel quel).
// Ici, au cron du MATIN (api/ship-reminders.js — PAS une 13ᵉ fonction) :
//   · `controleVendeur` : pour CE vendeur (contexte du tour), en lecture seule,
//     projetée (jamais `select=data` sur `main` ni sur un dressing), paginée par
//     `Range` (le `lireTout` du cron) ; UNE écriture : sa ligne `vrm_controle_nuit` ;
//   · `controleInstallation` : une fois, pour le PROPRIÉTAIRE de l'installation —
//     les e-mails en quarantaine (propriétaire NEUTRE) et les abonnements Stripe
//     incohérents ; UNE écriture : `vrm_controle_installation` à son nom.
// Une lecture ratée ⇒ ce contrôle est « pas su » (`n: null` + raison), jamais 0 ;
// les autres contrôles continuent. Rien n'est corrigé, rien n'est envoyé.
// ═══════════════════════════════════════════════════════════════════════════
import { annoncesVintedParNumero } from './double-vente.js';
import { comptesARelire, dernieresCaptures, SELECT_CAPTURES } from './comptes-a-relire.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import { CLE_CONTROLE, CLE_CONTROLE_INSTALLATION, numerosEnDouble, comptesPasRelus, versementsEnRetard, incoherencesStripe, resultatControle } from '../../src/controleNuit.js';

const objetJson = (v) => {
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return undefined; } }
  if (v == null) return null;
  return typeof v === 'object' && !Array.isArray(v) ? v : undefined;
};
const ensemble = (v) => new Set(Array.isArray(v) ? v.map(String) : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// `lireTout(chemin)` : le `fetchPaginated(scoped(chemin))` du cron (tableau, ou `null` = pas su).
// `ecrire(id, data)` : l'`ecrireDedup` du cron (vrai si la base a confirmé).
export async function controleVendeur({ lireTout, ecrire, maintenant = Date.now() }) {
  const [mainL, vL, vP, vS, comptesL, panneau, etats, noirs, captures] = await Promise.all([
    lireTout('app_data?id=eq.main&select=fiches:data->vinted_annonce_numeros,retirees:data->vrm_annonces_retirees,masques:data->vinted_accounts_hidden,aDater:data->vinted_urssaf_mois->aDater'),
    lireTout('app_data?id=like.harvest_%25_listings&select=id,cap:data->>capturedAt,uid:data->uid,items:data->payload->items'),
    lireTout('app_data?id=like.harvest_%25_enligne&select=id,cap:data->>capturedAt,complet:data->complet,ids:data->ids,items:data->items'),
    lireTout('app_data?id=like.harvest_%25_supprimees&select=id,ids:data->ids'),
    lireTout('vinted_accounts?select=vinted_user_id'),
    lireTout('app_data?id=eq.panel_accounts_off&select=d:data'),
    lireTout('app_data?id=eq.panel_comptes_etat&select=comptes:data->comptes'),
    lireTout('app_data?id=eq.vrm_blocked_accounts&select=uids:data->uids'),
    lireTout(`app_data?id=like.harvest_%25&meta->>supprime=is.null&select=${SELECT_CAPTURES}`),
  ]);
  const valeurs = {}, raisons = {};
  const m0 = Array.isArray(mainL) ? (mainL[0] || {}) : null;
  // 1. Deux paires en ligne sous un N° : fiches (N° par identifiant d'annonce) + dressings lus.
  valeurs['numeros-double'] = null;
  if (!m0) raisons['numeros-double'] = 'tes fiches n’ont pas pu être lues';
  else if (!Array.isArray(vL) || !Array.isArray(vS)) raisons['numeros-double'] = 'tes annonces n’ont pas pu être lues';
  else {
    const fiches = objetJson(m0.fiches), retirees = objetJson(m0.retirees);
    const supp = new Map();
    for (const r of vS) { const k = /^harvest_(\d+)_supprimees$/.exec(String((r && r.id) || '')); const ids = objetJson(r && r.ids); if (k && ids) supp.set(k[1], ids); }
    const lignesL = vL.filter((r) => /^harvest_\d+_listings$/.test(String((r && r.id) || ''))).map((r) => ({ ...r, items: typeof r.items === 'string' ? (() => { try { return JSON.parse(r.items); } catch (_) { return null; } })() : r.items }));
    if (fiches === undefined || retirees === undefined || !lignesL.every((r) => r.items == null || Array.isArray(r.items))) raisons['numeros-double'] = 'forme inattendue';
    else {
      const lignesP = Array.isArray(vP) ? vP.filter((r) => /^harvest_\d+_enligne$/.test(String((r && r.id) || ''))) : null;
      valeurs['numeros-double'] = numerosEnDouble(annoncesVintedParNumero(lignesL, lignesP, supp, fiches || {}, retirees || {}, maintenant));
    }
  }
  // 2. Ventes sans versement depuis 30 jours : le nombre publié par l'écran Ventes.
  valeurs['versement-30j'] = m0 ? versementsEnRetard(objetJson(m0.aDater)) : null;
  if (valeurs['versement-30j'] == null) raisons['versement-30j'] = m0 ? 'ouvre Ventes pour le compter' : 'pas lu';
  // 3. Comptes pas relus depuis 48 h : la règle de « Tout va bien ? ».
  valeurs['comptes-48h'] = null;
  if (!m0 || !Array.isArray(comptesL) || !Array.isArray(panneau) || !Array.isArray(etats) || !Array.isArray(noirs) || !Array.isArray(captures)) raisons['comptes-48h'] = 'tes comptes n’ont pas pu être lus';
  else {
    const liste = comptesARelire({
      comptes: comptesL, captures: dernieresCaptures(captures), masques: ensemble(m0.masques),
      panneau: objet(panneau[0] && panneau[0].d), etats: objet(etats[0] && etats[0].comptes), supprimes: ensemble(noirs[0] && noirs[0].uids), maintenant,
    });
    valeurs['comptes-48h'] = comptesPasRelus(liste, maintenant);
    if (valeurs['comptes-48h'] == null) raisons['comptes-48h'] = 'pas lu';
  }
  const data = resultatControle(valeurs, raisons, maintenant);
  const ecrit = await ecrire(CLE_CONTROLE, data);
  // La réponse du cron : des NOMBRES seulement.
  return { ecrit: !!ecrit, n: Object.fromEntries(Object.entries(data.controles).map(([k, c]) => [k, c.n])) };
}

// Le propriétaire de l'installation. `lire(chemin)` : lecture paginée SANS filtre de
// vendeur (clé de service) ; `ecrire(owner, id, data)` ; `stripe` : { pret(), api(m, chemin) }.
export const STRIPE_MAX = 40;
export async function controleInstallation({ lire, ecrire, proprio, stripe = null, maintenant = Date.now(), budgetMs = 15000 }) {
  if (!proprio) return { fait: false, raison: 'propriétaire inconnu' };
  const [quar, abos] = await Promise.all([
    lire(`app_data?id=like.email_quarantaine_*&meta->>supprime=is.null&owner=eq.${PROPRIETAIRE_NEUTRE}&select=id`),
    lire('abonnements?select=owner,statut,abonnement_stripe,fin_periode,annule_fin_periode'),
  ]);
  const valeurs = {}, raisons = {};
  valeurs['emails-quarantaine'] = Array.isArray(quar) ? quar.map((r) => String((r && r.id) || '')).filter(Boolean) : null;
  if (!Array.isArray(quar)) raisons['emails-quarantaine'] = 'la quarantaine n’a pas pu être lue';
  if (!Array.isArray(abos)) { valeurs.stripe = null; raisons.stripe = 'les abonnements n’ont pas pu être lus'; }
  else {
    let carte = null;
    if (stripe && typeof stripe.pret === 'function' && stripe.pret()) {
      carte = new Map();
      const t0 = Date.now();
      const aVoir = abos.filter((r) => r && r.abonnement_stripe && ['active', 'trialing', 'past_due'].includes(String(r.statut))).slice(0, STRIPE_MAX);
      for (const r of aVoir) {
        if (Date.now() - t0 > budgetMs) break;
        const x = await stripe.api('GET', `subscriptions/${encodeURIComponent(String(r.abonnement_stripe))}`).catch(() => null);
        if (x && x.ok && x.data && x.data.status) carte.set(String(r.abonnement_stripe), { statut: String(x.data.status) });
        else if (x && x.status === 404) carte.set(String(r.abonnement_stripe), { absent: true });
        // Stripe muet : rien de rangé (pas su) — la table seule est comparée.
      }
    }
    valeurs.stripe = incoherencesStripe(abos, { stripe: carte, maintenant, proprio });
  }
  const data = resultatControle(valeurs, raisons, maintenant);
  const ecrit = await ecrire(proprio, CLE_CONTROLE_INSTALLATION, data);
  return { fait: !!ecrit, n: Object.fromEntries(Object.entries(data.controles).map(([k, c]) => [k, c.n])) };
}
