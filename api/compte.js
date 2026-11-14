import './_lib/sans-bruit.js';
import {routeProfilAvatar,routeAvatarPublic} from './_lib/profil-avatar.js';
import { avatarPublicVerifie } from './_lib/avatar-discord.js';
import {configurationAuthPublique} from './_lib/auth-public.js';
import {verifierConfidentialite} from './_lib/confidentialite.js';
// ── /api/compte — santé du serveur ET abonnement du vendeur ──────────────────
// ⚠️ POURQUOI UNE SEULE FONCTION : le plan Vercel Hobby plafonne à 12 fonctions
// serverless et le projet en a 12 (voir api/ebay.js). `api/sante.js` est devenu
// le mode par défaut d'ici ; vercel.json garde les adresses publiques :
//   /api/sante            → ?mode=sante       (GET, public, oui/non seulement)
//   /api/stripe-webhook   → ?mode=webhook     (POST, Stripe, SIGNÉ)
//   /api/compte?mode=abonnement   (GET, session)  statut de MON abonnement
//   /api/compte?mode=checkout     (POST, session) ouvre le paiement Stripe
//   /api/compte?mode=portail      (POST, session) changer de carte (page Stripe)
//   /api/compte?mode=factures     (GET, session)  MES factures et MA carte
//   /api/compte?mode=resilier     (POST, session) résilier à la fin de la période
//   /api/compte?mode=reprendre    (POST, session) annuler la résiliation
//   /api/compte?mode=session-extension (POST, session) une session À ELLE pour
//                                 l'extension Chrome (même vendeur, autre famille)
//   /api/compte?mode=superpdp     (GET/POST, session) SA connexion Super PDP
//                                 (plateforme agréée de facturation électronique) :
//                                 statut · connecter · deconnecter · envoyer ·
//                                 relire — voir api/_lib/superpdp.js
//   /api/compte?mode=photoroom    (GET/POST, session) SA clé Photoroom, rangée
//                                 chiffrée dans le coffre : statut (4 derniers
//                                 caractères, date) · poser · verifier · retirer
//                                 — voir api/_lib/photoroom-cle.js
//   /api/compte?mode=facture-pro  (GET/POST, session) LA FACTURE PRO : sa boîte
//                                 d'envoi (chiffrée), émettre, envoyer, avoir —
//                                 voir api/_lib/facture-pro.js
//   /api/compte?mode=facture-autre (POST, session) la facture Pro d'une vente
//                                 Leboncoin / eBay / Vestiaire : émettre —
//                                 voir api/_lib/facture-autres.js
//   /api/compte?mode=equipe       (GET/POST, session) LE MODE ÉQUIPE (migration
//                                 016) : lister · inviter · accepter · révoquer ·
//                                 quitter — voir api/_lib/equipe.js
//   /api/compte?mode=communaute   (GET/POST, session) LA CARTE DE LA COMMUNAUTÉ
//                                 (migration 018) — voir api/_lib/communaute.js
//   /api/compte?mode=entreprise&siret= (GET, session) le NOM de l'entreprise
//                                 d'un SIREN/SIRET (registre public, sans clé)
//   /api/compte?mode=signalement  (GET/POST, session) « SIGNALER UN PROBLÈME » :
//                                 POST envoyer (rangé chez le propriétaire de
//                                 l'installation, 5/h/compte, notifié) ; GET la
//                                 liste et POST {action:'traite'} au PROPRIÉTAIRE
//                                 seul — voir api/_lib/signalement.js
//   /api/compte?mode=aide         (GET/POST, session) « ÉCRIRE AU SUPPORT » (13 nov.) :
//                                 POST envoyer (rangé chez LUI, 5/h, scellé) ; GET la
//                                 liste et POST {action:'traitee'} au PROPRIÉTAIRE seul —
//                                 api/_lib/demande-aide.js, règle src/demandeAide.js
//   /api/compte?mode=rapport-extension (GET/POST, session) « ENVOYER UN RAPPORT » de
//                                 l'extension (5.371) : POST l'état technique (liste
//                                 blanche, 6/h, une ligne par vendeur) ; GET sa ligne,
//                                 ou tous les vendeurs pour le PROPRIÉTAIRE — api/_lib/rapport-extension.js
//   /api/compte?mode=commandes    (POST, session de l'extension) les ventes/achats
//                                 envoyés LÉGERS, fusionnés dans la ligne
//                                 `harvest_{uid}_orders_*` — api/_lib/commandes-leger.js
//   /api/compte?mode=agenda       (GET/POST, session ; GET &f=<jeton>.ics sans session) l'agenda .ics
//   /api/compte?mode=mail-essai   (POST, session) « M'envoyer un e-mail d'essai » :
//                                 à l'adresse de SON compte, 3/h — api/_lib/mail-essai.js
//   /api/compte?mode=supprimer    (GET/POST, session) SUPPRIMER MON COMPTE : GET
//                                 l'inventaire ; POST (« SUPPRIMER » + mot de passe
//                                 ou connexion récente) résilie, efface, puis son
//                                 compte (refusé au propriétaire de l'installation) ;
//                                 `?mode=fermer` = la même fonction
//
// L'abonnement (Julien, 4 octobre) : 12,99 € par mois depuis le 11 octobre
// (9,99 € avant — décision de Julien après l'étude des coûts), prélevé chaque
// mois à la date où la personne s'abonne, pour TOUT LE MONDE SAUF LUI (le
// propriétaire déclaré dans la base, `vrm_reglages`).
// ⚠️ Qui est qui : le serveur ne croit jamais un identifiant envoyé par le
//    navigateur — il prend le jeton de session et demande à Supabase (session.js).
// ⚠️ Le statut ne s'écrit QUE sur un événement Stripe dont la signature est
//    vérifiée, dans une table que le vendeur peut lire mais pas écrire
//    (supabase/migrations/005-abonnements.sql). Sinon on s'abonnerait soi-même
//    depuis la console du navigateur.
import { utilisateurDe, jetonDe, vendeurExige, baseCloisonnee, lireCommeVendeur } from './_lib/session.js';
import { stripeApi, stripePret, stripeModeTest, signatureValide, finPeriode } from './_lib/stripe.js';
import { lireMentions, mentionsManquantes } from './_lib/mentions-legales.js';
import { etatOuverture, lireWebhooksStripe } from './_lib/ouverture-paiements.js';   // (12 nov.) « Ouvrir les paiements »
import { sbCle } from './_lib/cle.js';
import { lirePhoto } from './_lib/photos.js';
import { routeSuperPdp } from './_lib/superpdp.js';
import { routePhotoroom } from './_lib/photoroom-cle.js';
import { routeFacturePro } from './_lib/facture-pro.js';
import { routeFactureAutre } from './_lib/facture-autres.js';
import { routeEntreprise } from './_lib/entreprise.js';
import { accesVendeur } from './_lib/abonnement.js';
import { routeEquipe } from './_lib/equipe.js';
import { routeCommunaute } from './_lib/communaute.js';
import { pagePublique } from './_lib/formateur.js';
import { debutDiscord, retourDiscord, attenteDiscord } from './_lib/discord.js';
import { routeOperations } from './_lib/operations.js';
import {routeFavoris} from './_lib/favoris.js';
import { routeCommandes } from './_lib/commandes-leger.js';
import { traiterAppareils, lireJournal } from './_lib/securite-compte.js';
import { verifierNouvelAppareil } from './_lib/appareil-nouveau.js';   // (10 nov., lot H)
import { traiterAgenda } from './_lib/agenda-ics.js';
import { traiterCatalogue, langueVisiteur, CSP_CATALOGUE } from './_lib/catalogue-prive.js';   // (14 nov., lot messages-achats-plus) le catalogue privé                 // (10 nov., lot H)
import { PROPRIETAIRE_NEUTRE } from './_lib/proprietaire-email.js';
import { verifierConfirmation, verifierMotDePasse, inventaire, lireProprietaire, noterJournal, mailSuppression, FENETRE_RECENTE_MS, MOT_CONFIRMATION } from './_lib/suppression-compte.js';
import { effacerCompte } from './_lib/effacer-compte.js';
import { lirePrevue, poserPrevue, retirerPrevue, arreterAbonnement, reprendreAbonnement, compteVide, mailDemande, jourLong, DELAI_GRACE_JOURS } from './_lib/suppression-differee.js';   // (13 nov., lot 51) 30 jours de grâce
import { pageExport } from './_lib/export-rgpd.js';   // (12 nov.) RGPD : toutes ses données
import { compteOAuthAnnulable } from '../src/auth/compteNeuf.js';   // (11 nov., lot DJ6)
import { envoyerSmtp } from './_lib/smtp.js';
import { contactEmail } from '../src/contact.js';
import { envoyerSignalement, listerSignalements, marquerTraite, proprietaireInstallation as proprioAlertes } from './_lib/signalement.js';
// (13 nov., lot 55) « Écrire au support » : la question, cinq faits techniques, rangée chez LUI (api/_lib/demande-aide.js).
import { envoyerDemandeAide, listerDemandesAide, marquerDemandeTraitee } from './_lib/demande-aide.js';
import { recevoirRapportExt, listerRapportsExt } from './_lib/rapport-extension.js';   // (12 nov., ext. 5.371) « Envoyer un rapport »
import { routeAlertes } from './_lib/alertes-production.js';
import { routePilotage } from './_lib/pilotage.js';
import { recevoirMesures, listerMesures } from './_lib/mesures-terrain.js';
import { etatPublic } from './_lib/etat-public.js';
// (9 nov.) L'état rangé par les sondes automatiques (projection publique, api/_lib/statut-sondes.js).
import { statutPourSante, relancerSondesSiVieilles, oublierStatutPublic } from './_lib/statut-sondes.js';
import { sendPushToAll, pushConfigure } from './_lib/push.js';
import { contexteVendeur } from './_lib/owner.js';
import { freinFork } from './_lib/frein-fork.js';   // (12 nov., M54)
import { lireJetonBilan, lireChoixBilan, ecrireChoixBilan, lireEnvoisBilan, choixEffectif } from './_lib/bilan-mois.js';
import { envoyerMailEssai } from './_lib/mail-essai.js';
import { configurationRelances, lireJeton as lireJetonRelance, ecrireChoix as ecrireChoixRelance, lireChoix as lireChoixRelance, lireEnvois as lireEnvoisRelance } from './_lib/relances-essai.js';
import { corsExtension } from './_lib/cors-extension.js';
import { codeDe, suiviDe, parrainageOuvert, rattacher, factureFilleulPayee, apercuCode, poserNom, nomDe, filleulsDe, filleulDetail } from './_lib/parrainage.js';
// (9 nov.) Solo et Pro : la règle (api/_lib/plan-regle.js, la même que l'app).
import { planDeLAbonnement, prochainChangement, uidValide, PLAN_PRO, PLAN_SOLO, CLE_PRIX_SOLO, PLATEFORMES_SOLO, NOMS_PLATEFORMES_SOLO, META_VENDEUR, idCompteVendeur, PRIX_COMPTE_SUP_CENTIMES, CLE_PRIX_COMPTE_SUP, COMPTES_INCLUS_SOLO, META_COMPTES_SUP, MAX_COMPTES_SUP, estPrixCompteSup } from './_lib/plan-regle.js';
import { fetchAvecDelai } from './_lib/fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
import { routeQrConnexion, depotPostgrest, cleSignature } from './_lib/qr-connexion.js';   // (14 nov., lot 119) connexion par QR
import { routeLienAide, depotLienAide } from './_lib/lien-aide.js';   // (14 nov., lot 120) lien temporaire pour l'aide
import { empreinte } from './_lib/empreinte.js';   // (11 nov.) clé d'idempotence avec les paramètres

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const ANON = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
// L'adresse de retour après paiement est FIXE : jamais l'en-tête Origin de la
// requête (on ne renvoie personne vers un site choisi par l'appelant).
const APP_URL = 'https://vrm.center';
const PRIX_CLE = process.env.STRIPE_PRICE_LOOKUP || 'vrm_mensuel';
// ⚠️ QUI A ACCÈS, SI C'EST OBLIGATOIRE, QUI EST LE PROPRIÉTAIRE : la BASE le
//    dit (`vrm_acces`, supabase/migrations/006-acces-abonnement.sql) — la même
//    règle qui ferme ses lignes (RLS) et qui coupe notifications et widget.
//    Ces réponses vivaient ici dans deux variables d'environnement : l'écran
//    aurait pu dire « abonné » pendant que la base refusait ses données (§11).
//    Le réglage `abonnement_obligatoire` vaut '0' : rien n'est bloqué tant que
//    Julien ne l'a pas passé à '1' (Stripe en mode réel, CGV à jour).
// Un abonnement « vivant » pour Stripe (la carte d'abonnement) : `past_due`,
// Stripe réessaie le prélèvement — on ne propose pas un second abonnement.
const STATUTS_ACTIFS = new Set(['active', 'trialing', 'past_due']);
export const abonnementActif = (statut) => STATUTS_ACTIFS.has(String(statut || ''));

// `{ obligatoire, proprietaire, acces }` lu avec le jeton du vendeur ;
// `undefined` = pas su (on ne devine pas une réponse sur l'accès).
async function accesDe(req) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/rpc/vrm_acces`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!j || typeof j !== 'object' || typeof j.acces !== 'boolean') return undefined;
    // `lecture` (migration 027) : la base laisse LIRE quand l'accès est coupé
    // (lecture seule) — absent tant que la 027 n'est pas passée.
    return { obligatoire: j.obligatoire === true, proprietaire: j.proprietaire === true, acces: j.acces, lecture: j.lecture === true };
  } catch (_) { return undefined; }
}

const repondre = (res, code, corps) => { res.status(code).json(corps); };

// La ligne d'abonnement du vendeur. Lue avec SON jeton (RLS : il ne voit que la
// sienne) — aucune clé de service n'est nécessaire pour ça. `undefined` = pas
// su (lecture ratée), `null` = aucune ligne, sinon la ligne.
async function ligneDe(req) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/abonnements?select=statut,client_stripe,abonnement_stripe,fin_periode,annule_fin_periode,mode_test&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}` },
    });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    return j[0] || null;
  } catch (_) { return undefined; }
}

async function lirePrix() {
  const r = await stripeApi('GET', 'prices', { 'lookup_keys[]': PRIX_CLE, active: 'true', limit: 1 });
  const p = r.ok && r.data && Array.isArray(r.data.data) ? r.data.data[0] : null;
  return p && p.id ? { id: p.id, ...lirePrixStripe(p) } : null;
}
// Un objet « prix » de Stripe (celui de la clé `vrm_mensuel`, ou celui de
// l'article d'un abonnement) → ce qu'on en lit. ⚠️ Sans montant unitaire (prix
// par paliers, à l'usage) : `montant` et `centimes` valent `null` — jamais 0,
// qui s'afficherait « 0,00 € », un chiffre inventé (§7).
const lirePrixStripe = (p) => ({
  montant: Number.isInteger(p.unit_amount) ? p.unit_amount / 100 : null,
  devise: p.currency, intervalle: p.recurring && p.recurring.interval,
  // Les CENTIMES tels que Stripe les donne (un entier) : on compare des
  // entiers, jamais 12.99 à 12.990000001.
  centimes: Number.isInteger(p.unit_amount) ? p.unit_amount : null,
  nIntervalles: p.recurring && p.recurring.interval_count != null ? Number(p.recurring.interval_count) : null,
});

// ⚠️ LE PRIX DE SON ABONNEMENT, PAS CELUI DE L'OFFRE DU MOMENT (revue du
//    11 octobre). Un abonnement Stripe garde le prix auquel il a été souscrit
//    (les CGV : « le prix payé est celui affiché au moment de la souscription ») :
//    quelqu'un abonné à 9,99 € le reste quand la clé `vrm_mensuel` passe à
//    12,99 €. La carte « Abonné · … » disait le prix de l'offre — 12,99 € au-dessus
//    de factures à 9,99 €. On lit donc l'ARTICLE de SON abonnement.
//    `null` = pas su (pas d'abonnement vivant, Stripe muet, abonnement d'un autre
//    client, plusieurs articles) : la carte écrit alors « Abonné » sans montant,
//    jamais un prix deviné.
// SON abonnement chez Stripe (vivant, à SON client) ; `null` = pas su.
async function abonnementStripeDe(ligne) {
  if (!ligne || !ligne.abonnement_stripe || !ligne.client_stripe || !abonnementActif(ligne.statut)) return null;
  const r = await stripeApi('GET', `subscriptions/${encodeURIComponent(ligne.abonnement_stripe)}`);
  if (!r.ok || !r.data || r.data.customer !== ligne.client_stripe) return null;
  return r.data;
}
function prixDeLAbonnement(sub) {
  if (!sub) return null;
  // (13 nov., lot 56) L'article « comptes Vinted de plus » ne change pas le prix
  // de l'OFFRE : il est dit à part (`comptesSup` de `mode=abonnement`).
  const articles = (sub.items && Array.isArray(sub.items.data) ? sub.items.data : []).filter((x) => !(x && estPrixCompteSup(x.price || x.plan)));
  if (articles.length !== 1) return null;
  const a = articles[0], p = a && (a.price || a.plan);
  if (!p || (a.quantity != null && a.quantity !== 1)) return null;
  const lu = lirePrixStripe(p);
  return { montant: lu.montant, devise: lu.devise, intervalle: lu.intervalle, nIntervalles: lu.nIntervalles, texte: prixTexte(lu) };
}

// ⚠️⚠️ LE PRIX DES CGV, ET CELUI QUE STRIPE FACTURERAIT (11 octobre).
//    Julien : « on va passer à 12,99 par mois ». Les CGV le disent
//    (public/legal/cgv.html) — mais le montant PRÉLEVÉ est celui du prix rangé
//    chez Stripe sous la clé `vrm_mensuel`, un réglage de SON tableau de bord
//    qu'aucun code ne change (et un prix Stripe ne se modifie pas : il se
//    recrée). Tant qu'il ne l'a pas recréé, Stripe facturerait encore 9,99 €
//    à quelqu'un qui vient d'accepter des CGV à 12,99 € — un prix qui n'est
//    pas celui des conditions acceptées.
//    ⇒ Le paiement ne s'ouvre QUE si Stripe dit exactement le prix des CGV :
//    même montant en centimes, en euros, une fois par mois. Sinon il reste
//    FERMÉ, et on le dit (au vendeur : « rien n'a été prélevé » ; au
//    propriétaire : le geste). Un prix illisible chez Stripe n'ouvre rien non
//    plus (`lirePrix` rend null ⇒ refus existant).
//    audit-lancement.cjs exige que cette valeur soit celle écrite dans les CGV
//    (et dans le repli de l'app) : une seule valeur (§11).
export const PRIX_CGV = { centimes: 1699, devise: 'eur', intervalle: 'month' };
// ⚠️⚠️ (9 nov.) LE PRIX DE PRO : 19,99 € / mois (décision de Julien du 9 nov. ;
//    Solo reste 16,99 €). Écrit ICI, dans les CGV et dans l'app
//    (src/accueil-reglages.js `PRIX_PRO_MOIS`) — audit-plans-solo-pro les compare.
//    Le paiement Pro ne s'ouvre que quand le prix existe CHEZ STRIPE, que son
//    identifiant (ou sa clé de recherche `vrm_pro_mensuel`) est dans
//    `STRIPE_PRIX_PRO` sur Vercel, ET que Stripe dit exactement ce montant. Le
//    montant prélevé est toujours celui de Stripe : s'il diffère, le paiement
//    reste fermé et le propriétaire voit le montant de Stripe (`texteStripe`).
export const PRIX_PRO_CGV = { centimes: 1999, devise: 'eur', intervalle: 'month' };
const prixProCle = () => String(process.env.STRIPE_PRIX_PRO || '').trim();
export const prixProConforme = (p) => !!(PRIX_PRO_CGV && p
  && p.centimes === PRIX_PRO_CGV.centimes
  && String(p.devise || '').toLowerCase() === PRIX_PRO_CGV.devise
  && p.intervalle === PRIX_PRO_CGV.intervalle
  && (p.nIntervalles == null || p.nIntervalles === 1));
// Le prix Pro lu chez Stripe : par identifiant (`price_…`) ou par clé de recherche.
async function lirePrixPro() {
  const cle = prixProCle();
  if (!cle) return null;
  const r = /^price_/.test(cle)
    ? await stripeApi('GET', `prices/${encodeURIComponent(cle)}`)
    : await stripeApi('GET', 'prices', { 'lookup_keys[]': cle, active: 'true', limit: 1 });
  const p = !r.ok || !r.data ? null : (Array.isArray(r.data.data) ? r.data.data[0] : r.data);
  return p && p.id && p.active !== false ? { id: p.id, lookup_key: p.lookup_key || null, ...lirePrixStripe(p) } : null;
}
// L'offre Pro, telle que l'app la montre : ouverte (avec son prix) ou fermée,
// avec la RAISON (le geste du propriétaire). Rien n'est appelé chez Stripe si
// le prix n'est pas posé.
async function offrePro() {
  if (!prixProCle()) return { ouvert: false, raison: 'sans-prix-stripe', texte: null };
  if (!stripePret()) return { ouvert: false, raison: 'stripe', texte: null };
  const p = await lirePrixPro();
  if (!p) return { ouvert: false, raison: 'prix-illisible', texte: null };
  if (!prixProConforme(p)) return { ouvert: false, raison: 'prix-different', texte: null, texteStripe: prixTexte(p) };
  return { ouvert: true, raison: null, texte: prixTexte(p), id: p.id };
}
// ── (13 nov., lot 56) LES COMPTES VINTED DE PLUS EN SOLO ────────────────────
// Le prix Stripe de clé de recherche `vrm_compte_sup` (ou l'identifiant posé dans
// `STRIPE_PRIX_COMPTE_SUP`). Le supplément ne s'achète QUE si Stripe dit exactement
// `PRIX_COMPTE_SUP_CENTIMES` (api/_lib/plan-regle.js, la seule valeur) en euros, par
// mois. Prix absent ⇒ « bientôt » : rien ne s'achète, rien n'est prélevé.
export const PRIX_COMPTE_SUP_CGV = { centimes: PRIX_COMPTE_SUP_CENTIMES, devise: 'eur', intervalle: 'month' };
const prixSupCle = () => String(process.env.STRIPE_PRIX_COMPTE_SUP || '').trim() || CLE_PRIX_COMPTE_SUP;
export const prixSupConforme = (p) => !!(p
  && p.centimes === PRIX_COMPTE_SUP_CGV.centimes
  && String(p.devise || '').toLowerCase() === PRIX_COMPTE_SUP_CGV.devise
  && p.intervalle === PRIX_COMPTE_SUP_CGV.intervalle
  && (p.nIntervalles == null || p.nIntervalles === 1));
async function lirePrixCompteSup() {
  const cle = prixSupCle();
  const r = /^price_/.test(cle)
    ? await stripeApi('GET', `prices/${encodeURIComponent(cle)}`)
    : await stripeApi('GET', 'prices', { 'lookup_keys[]': cle, active: 'true', limit: 1 });
  const p = !r.ok || !r.data ? null : (Array.isArray(r.data.data) ? r.data.data[0] : r.data);
  return p && p.id && p.active !== false && (p.lookup_key === CLE_PRIX_COMPTE_SUP || /^price_/.test(cle)) ? { id: p.id, lookup_key: p.lookup_key || null, ...lirePrixStripe(p) } : null;
}
// L'offre « compte de plus » : ouverte (prix lu, conforme) ou fermée, avec la raison
// (le geste du propriétaire). `prixCentimes` : la valeur de VRM, toujours dite.
async function offreCompteSup() {
  const base = { prixCentimes: PRIX_COMPTE_SUP_CENTIMES, cle: CLE_PRIX_COMPTE_SUP };
  if (!stripePret()) return { ...base, ouvert: false, raison: 'stripe', texte: null };
  const p = await lirePrixCompteSup();
  if (!p) return { ...base, ouvert: false, raison: 'sans-prix-stripe', texte: null };
  if (!prixSupConforme(p)) return { ...base, ouvert: false, raison: 'prix-different', texte: null, texteStripe: prixTexte(p) };
  return { ...base, ouvert: true, raison: null, texte: prixTexte(p), id: p.id };
}

// Les options de la règle : quel prix est Pro, quelle clé est Solo.
const optsPlan = () => ({ prixPro: prixProCle(), cleSolo: PRIX_CLE || CLE_PRIX_SOLO });
export const prixConforme = (p) => !!(p
  && p.centimes === PRIX_CGV.centimes
  && String(p.devise || '').toLowerCase() === PRIX_CGV.devise
  && p.intervalle === PRIX_CGV.intervalle
  && (p.nIntervalles == null || p.nIntervalles === 1));
// ⚠️ LE TEXTE D'UN PRIX STRIPE, ÉCRIT ICI UNE FOIS (revue du 11 octobre).
//    L'alerte du propriétaire (« le prix réglé chez Stripe n'est pas celui des
//    CGV ») sert à guider SON geste dans Stripe — c'est justement quand il se
//    trompe de devise ou de récurrence qu'elle doit le montrer. L'app
//    reformatait le prix de son côté en ignorant la devise et le rythme : elle
//    affirmait « 12,99 € / mois n'est pas 12,99 € / mois » pour un prix en
//    dollars, tous les 3 mois ou par semaine, et « 0,00 € » pour un prix sans
//    montant fixe. Le serveur rend désormais le texte (`texte`), et l'app
//    l'affiche tel quel : tout ce qui rend un prix non conforme (montant,
//    devise, rythme) se voit dans ce texte. `prixTexte(PRIX_CGV)` vaut
//    exactement le texte des CGV de l'app (« 12,99 € / mois ») — audit-abonnement
//    le vérifie, et vérifie qu'un prix non conforme ne s'écrit JAMAIS pareil.
// Les devises sans centimes chez Stripe : le montant y est déjà en unités.
const SANS_DECIMALES = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
const montantTexte = (centimes, devise) => {
  const d = String(devise || '').toLowerCase();
  const n = SANS_DECIMALES.has(d) ? String(centimes) : (centimes / 100).toFixed(2).replace('.', ',');
  return d === 'eur' ? `${n} €` : `${n} ${d ? d.toUpperCase() : '(devise inconnue)'}`;
};
const eurosLisibles = (c) => montantTexte(c, 'eur');
const UNITES = { day: ['jour', 'jours'], week: ['semaine', 'semaines'], month: ['mois', 'mois'], year: ['an', 'ans'] };
export const prixTexte = (p) => {
  const c = p && p.centimes, iv = p && p.intervalle ? String(p.intervalle) : '';
  const n = p && Number.isInteger(p.nIntervalles) && p.nIntervalles > 1 ? p.nIntervalles : 1;
  const u = iv && Object.prototype.hasOwnProperty.call(UNITES, iv) ? UNITES[iv] : null;
  // Le rythme, en mots : « par mois », « tous les 3 mois », « en une fois ».
  const rythme = !iv ? 'en une fois (pas un abonnement)'
    : !u ? (n > 1 ? `tous les ${n} « ${iv} »` : `par « ${iv} »`)
    : n > 1 ? `tous les ${n} ${u[1]}` : `par ${u[0]}`;
  // Sans montant unitaire : on le DIT, jamais « 0,00 € » ni « ? € ».
  if (!Number.isInteger(c)) return `sans montant fixe, ${rythme}`;
  // « 12,99 € / mois » : la forme des CGV, pour un rythme simple.
  return u && n === 1 ? `${montantTexte(c, p.devise)} / ${u[0]}` : `${montantTexte(c, p.devise)} ${rythme}`;
};

// ── Corps BRUT (la signature Stripe porte sur l'octet près) ─────────────────
async function corpsBrut(req) {
  // ⚠️ On lit le FLUX d'abord : toucher `req.body` sur Vercel déclenche son
  //    analyse JSON, et un JSON re-sérialisé ne correspond plus à la signature.
  const morceaux = [];
  try { for await (const c of req) morceaux.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); } catch (_) {}
  if (morceaux.length) return Buffer.concat(morceaux);
  const b = req.rawBody || req.body;
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') return Buffer.from(b, 'utf8');
  return null;   // déjà analysé en objet : impossible de vérifier, on refuse
}

// (11 nov., robustesse) L'ÉVÉNEMENT D'UN AUTRE ABONNEMENT QUE CELUI DE LA LIGNE.
// Un vendeur qui a eu deux abonnements (un premier essai `incomplete_expired`,
// puis le bon) : un événement tardif du PREMIER écrasait la ligne du second et
// coupait l'accès. Il ne remplace la ligne que s'il est VIVANT (un nouvel
// abonnement qui prend la suite) ou si celui de la ligne est déjà terminé.
// Fonction PURE (scripts/audit-robustesse-serveur.cjs).
const STATUTS_VIVANTS = ['active', 'trialing', 'past_due'];
export function evenementDUnAncienAbonnement(avant, ligne) {
  const idAvant = avant && avant.abonnement_stripe, idNouveau = ligne && ligne.abonnement_stripe;
  if (!idAvant || !idNouveau || idAvant === idNouveau) return false;
  if (STATUTS_VIVANTS.includes(String(ligne.statut || ''))) return false;
  return STATUTS_VIVANTS.includes(String(avant.statut || ''));
}

// ── Écrire le statut (clé de service — elle seule écrit cette table) ────────
// ⚠️ (11 nov., H18 de la revue serveur) COMPARER-ET-ÉCHANGER. Avant : lire
//    `evenement_ts`, décider, puis un upsert sans condition — deux webhooks
//    simultanés lisaient la même ligne et le plus ANCIEN pouvait écrire en
//    dernier. Désormais l'écriture ne passe que si la ligne porte ENCORE ce qui a
//    été lu (`evenement_ts` et `maj`, que chaque écriture change) ; devancé ⇒ on
//    relit et on redécide (l'événement plus récent de l'autre gagne alors).
//    Ligne absente ⇒ une INSERTION simple : créée entre-temps ⇒ 409 (23505) ⇒ relu.
//    Aucune migration : PATCH filtré de PostgREST.
export const conditionStatut = (avant) => `evenement_ts=eq.${encodeURIComponent(String(avant.evenement_ts))}&${avant.maj == null ? 'maj=is.null' : `maj=eq.${encodeURIComponent(String(avant.maj))}`}`;
export async function ecrireStatut(owner, ligne, evenementTs, { essais = 5 } = {}) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return { ok: false, code: 'sans-cle' };
  const h = { ...sbCle(SERVICE), 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    // Les webhooks arrivent dans le désordre : un événement plus ANCIEN que celui
    // déjà appliqué n'écrase rien (sinon un vieux « incomplete » effacerait un
    // « active » arrivé avant lui).
    let avant = null;
    try {
      const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/abonnements?owner=eq.${encodeURIComponent(owner)}&select=evenement_ts,impaye_depuis,abonnement_stripe,statut,maj`, { headers: h, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return { ok: false, code: 'lecture' };
      const j = await r.json();
      if (!Array.isArray(j)) return { ok: false, code: 'lecture' };
      avant = j[0] || null;
      if (avant && Number(avant.evenement_ts) > evenementTs) return { ok: true, ignore: 'plus-ancien' };
      if (evenementDUnAncienAbonnement(avant, ligne)) return { ok: true, ignore: 'ancien-abonnement' };
    } catch (_) { return { ok: false, code: 'lecture' }; }
    // Depuis quand le prélèvement échoue : la base laisse 14 jours (Stripe
    // réessaie pendant ce temps), puis coupe. On garde la PREMIÈRE date d'échec —
    // chaque nouvel essai raté de Stripe ne doit pas relancer les 14 jours — et on
    // l'efface dès que le statut n'est plus « impayé ».
    const impaye_depuis = ligne.statut === 'past_due'
      ? ((avant && avant.impaye_depuis) || new Date((evenementTs || Math.floor(Date.now() / 1000)) * 1000).toISOString())
      : null;
    let r;
    try {
      // Rend la réponse ; `rangee` : vrai si la base a écrit, faux si devancé.
      const ecrire = async (l) => {
        const corps = { ...l, impaye_depuis, evenement_ts: evenementTs, maj: new Date().toISOString() };
        if (avant) {
          const w = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/abonnements?owner=eq.${encodeURIComponent(owner)}&${conditionStatut(avant)}&select=owner`, {
            method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify(corps),
          });
          if (!w.ok) return { w, rangee: false };
          const out = await w.json().catch(() => null);
          return { w, rangee: Array.isArray(out) && out.length >= 1, devance: Array.isArray(out) && out.length === 0, illisible: !Array.isArray(out) };
        }
        const w = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/abonnements`, {
          method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify([{ owner, ...corps }]),
        });
        return { w, rangee: w.ok };
      };
      let e = await ecrire(ligne);
      if (e.rangee) return { ok: true };
      if (e.devance) continue;
      if (e.illisible) return { ok: false, code: 'ecriture-illisible' };
      r = e.w;
      let t = await r.text().catch(() => '');
      // (9 nov., Solo par plateforme) Migration 030 pas passée : la colonne
      // `comptes_vendeurs` n'existe pas. Le statut, le plan et le compte Vinted
      // passent sans elle (les autres plateformes : « pas su » côté serveur).
      if (/comptes_vendeurs/.test(t) && 'comptes_vendeurs' in ligne) {
        const { comptes_vendeurs: _cv, ...sans030 } = ligne;
        ligne = sans030;
        e = await ecrire(ligne);
        if (e.rangee) return { ok: true, sans030: true };
        if (e.devance) continue;
        if (e.illisible) return { ok: false, code: 'ecriture-illisible' };
        r = e.w; t = await r.text().catch(() => '');
      }
      // (9 nov.) Migration 028 pas passée : les colonnes `plan`/`compte_vendeur`
      // n'existent pas. Le STATUT compte plus que le plan : on le range sans elles
      // (le plan reste lu en direct chez Stripe par l'app ; « pas su » côté serveur).
      if (/PGRST204|42703|'plan'|compte_vendeur/.test(t) && ('plan' in ligne || 'compte_vendeur' in ligne)) {
        const { plan: _p, compte_vendeur: _c, comptes_vendeurs: _cv2, ...sans } = ligne;
        e = await ecrire(sans);
        if (e.rangee) return { ok: true, sansPlan: true };
        if (e.devance) continue;
        if (e.illisible) return { ok: false, code: 'ecriture-illisible' };
        r = e.w; t = await r.text().catch(() => '');
      }
      // 23503 : ce vendeur n'existe pas (compte VRM supprimé) — réessayer n'y
      // changera rien, on l'acquitte et on le dit dans les journaux.
      if (/23503/.test(t)) return { ok: true, ignore: 'vendeur-inconnu' };
      // 23505 : la ligne a été créée entre la lecture et l'insertion ⇒ relire.
      if (r.status === 409 && /23505/.test(t)) continue;
      return { ok: false, code: 'ecriture-' + r.status };
    } catch (_) { return { ok: false, code: 'ecriture' }; }
  }
  return { ok: false, code: 'concurrence' };
}

// Le propriétaire VRM d'un abonnement Stripe : posé par NOUS dans `metadata`
// au moment du paiement (depuis une session vérifiée) — jamais deviné. En repli,
// la ligne qui porte déjà ce client Stripe.
// ⚠️ (11 nov., robustesse) TROIS ÉTATS : l'owner · '' (personne, constaté) ·
//    `undefined` (PAS SU : lecture ratée, clé de service absente). Avant, une
//    panne rendait '' et le webhook répondait 200 « sans propriétaire » : Stripe
//    ne rejouait plus, le statut n'était jamais écrit et le crédit de parrainage
//    perdu. Pas su ⇒ 503, Stripe rejoue.
async function proprietaireDe(sub, client) {
  const m = sub && sub.metadata && sub.metadata.owner;
  if (m && /^[0-9a-f-]{36}$/i.test(m)) return m;
  if (!client) return '';
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return undefined;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/abonnements?client_stripe=eq.${encodeURIComponent(client)}&select=owner&limit=1`, { headers: sbCle(SERVICE), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    return (j[0] && j[0].owner) || '';
  } catch (_) { return undefined; }
}

// ── Essai gratuit : UNE seule fois par e-mail ET par compte Vinted ──────────
// Un registre de « clés consommées » — une ligne par e-mail et une par id de
// compte Vinted — lu et écrit par la SEULE clé de service (RLS ferme la table
// aux vendeurs : on ne doit pas pouvoir savoir qui a déjà essayé).
// `supabase/migrations/022-essais-gratuits.sql`. Tant que la table n'existe pas
// (migration non passée), la lecture échoue ⇒ `null` ⇒ AUCUN essai accordé : on
// n'offre pas un cadeau qu'on ne peut pas borner. L'essai s'active le jour où
// Julien passe la migration — jamais un faux « gratuit » entre-temps.
const normEmail = (e) => String(e || '').trim().toLowerCase();
const clesEssai = (email, ids) => (normEmail(email) ? ['email:' + normEmail(email)] : [])
  .concat((ids || []).map((v) => 'vinted:' + String(v)));
const enListe = (vals) => vals.map((v) => '%22' + encodeURIComponent(String(v)) + '%22').join(',');

// (11 nov., M51) Trois états : la liste lue · `null` = pas su (lecture ratée).
// `[]` sur une panne accordait l'essai sur le seul e-mail : un compte Vinted
// déjà essayé l'obtenait à nouveau. Pas su ⇒ `essaiDejaUtilise` rend `null` ⇒ pas d'essai.
async function lireVintedIds(owner) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE || !owner) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/vinted_accounts?owner=eq.${encodeURIComponent(owner)}&select=vinted_user_id`, { headers: sbCle(SERVICE) });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j.map((x) => x && x.vinted_user_id).filter(Boolean).map(String) : null;
  } catch (_) { return null; }
}

// true = un essai a DÉJÀ été consommé (par cet e-mail OU un de ces comptes
// Vinted) · false = aucun (éligible) · null = pas su (lecture impossible : on
// n'accorde alors AUCUN essai).
async function essaiDejaUtilise(email, ids) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return null;
  if (ids === null) return null;   // (11 nov., M51) comptes Vinted pas sus ⇒ pas su
  const cles = clesEssai(email, ids);
  if (!cles.length) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/essais_gratuits?cle=in.(${enListe(cles)})&select=cle&limit=1`, { headers: sbCle(SERVICE) });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    return j.length > 0;
  } catch (_) { return null; }
}

// Marque l'essai comme consommé (idempotent : la clé est la clé primaire).
async function enregistrerEssai(owner, email, ids, subId) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return false;
  const cles = clesEssai(email, ids);
  if (!cles.length) return true;   // rien à marquer (aucune clé) : ce n’est pas un échec
  const lignes = cles.map((cle) => ({ cle, owner: owner || null, abonnement_stripe: subId || null, cree: new Date().toISOString() }));
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/essais_gratuits?on_conflict=cle`, {
      method: 'POST',
      headers: { ...sbCle(SERVICE), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(lignes),
    });
    return r.ok;
  } catch (_) { return false; }
}

// ── 1 compte Vinted = 1 compte VRM (index unique global sur vinted_user_id).
// L'app demande, pour le compte Vinted ouvert dans le Chrome du vendeur : est-il
// DÉJÀ pris par un AUTRE compte VRM ? Réponse = un simple oui/non, JAMAIS qui le
// possède (aucun e-mail, aucun identifiant de propriétaire ne sort). Session
// obligatoire. « Pas su » (pas de clé de service, lecture ratée) ⇒ `pris:false` :
// on n'invente pas de fausse alerte — la base bloque de toute façon la capture
// en double, c'est seulement le message qui manquerait.
async function vintedPris(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { ok: false, raison: 'session' });
  const id = String((req.query && req.query.id) || '').trim();
  if (!/^[0-9]{1,20}$/.test(id)) return repondre(res, 400, { ok: false, raison: 'id' });
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  // (11 nov., M52) « pas su » n'est pas « libre » : une lecture ratée répond 503
  // (`pris:null`) ; l'app ne dit alors rien, et la base bloque de toute façon.
  const pasSu = () => repondre(res, 503, { ok: false, pris: null, raison: 'pas-su' });
  if (!SERVICE) return pasSu();
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${encodeURIComponent(id)}&select=owner`, { headers: sbCle(SERVICE) });
    if (!r.ok) return pasSu();
    const j = await r.json();
    if (!Array.isArray(j)) return pasSu();
    const pris = j.some((row) => row && row.owner && String(row.owner) !== String(u.id));
    return repondre(res, 200, { ok: true, pris });
  } catch (_) { return pasSu(); }
}

const comptesVendeursLigne = (autres, sup) => {
  const o = {};
  for (const p of PLATEFORMES_SOLO) if (autres && autres[p] && autres[p].id) o[p] = autres[p].id;
  // (13 nov., lot 56) Les comptes Vinted vendeurs de plus (bornés à la quantité payée) :
  // les bilans et notifications du serveur les lisent (`regleDuVendeur`).
  if (sup && Array.isArray(sup.liste) && sup.liste.length) o.vinted_sup = sup.liste.slice();
  return o;
};
// Ce que l'app lit des comptes de plus : payés, liste, places libres.
const comptesSupApp = (lu) => {
  const s = (lu && lu.comptesSup) || { payes: 0, liste: [] };
  return { inclus: COMPTES_INCLUS_SOLO, payes: s.payes, liste: s.liste.slice(), libres: Math.max(0, s.payes - s.liste.length), max: MAX_COMPTES_SUP };
};
// Ce que l'app lit : { plateforme: { id, le, prochainChangement } } (choisies seulement).
const comptesVendeursApp = (autres) => {
  const o = {};
  for (const p of PLATEFORMES_SOLO) if (autres && autres[p] && autres[p].id) o[p] = { id: autres[p].id, le: autres[p].le, prochainChangement: prochainChangement(autres[p].le) };
  return o;
};
const ligneDeLAbonnement = (sub, livemode) => ({
  // (9 nov.) Le plan et le compte vendeur, lus du PRIX et des métadonnées que
  // NOUS avons posées (route `compte-vendeur`) — jamais d'un champ du navigateur.
  // Colonnes de la migration 028 : sans elle, l'écriture se refait sans ces deux.
  plan: planDeLAbonnement(sub, optsPlan()).plan,
  compte_vendeur: planDeLAbonnement(sub, optsPlan()).vendeur,
  // (9 nov., Solo par plateforme) Le compte vendeur de Leboncoin, eBay, Vestiaire
  // (migration 030, `jsonb`) : { leboncoin: id, ebay: ref, vestiaire: id }, seulement
  // les plateformes CHOISIES. Sans la 030 : l'écriture se refait sans cette colonne.
  comptes_vendeurs: comptesVendeursLigne(planDeLAbonnement(sub, optsPlan()).autres, planDeLAbonnement(sub, optsPlan()).comptesSup),
  statut: String(sub.status || 'incomplete'),
  client_stripe: typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || null,
  abonnement_stripe: sub.id || null,
  fin_periode: finPeriode(sub),
  annule_fin_periode: !!(sub.cancel_at_period_end || sub.cancel_at),
  mode_test: !livemode,
});

async function webhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) return repondre(res, 503, { erreur: 'webhook non configuré' });
  const brut = await corpsBrut(req);
  const entete = (req.headers && (req.headers['stripe-signature'] || req.headers['Stripe-Signature'])) || '';
  if (!brut || !signatureValide(brut, entete, secret)) return repondre(res, 400, { erreur: 'signature invalide' });
  let ev;
  try { ev = JSON.parse(brut.toString('utf8')); } catch (_) { return repondre(res, 400, { erreur: 'corps illisible' }); }
  const type = String(ev.type || ''), obj = (ev.data && ev.data.object) || {}, ts = Number(ev.created) || 0;

  let sub = null;
  if (type.startsWith('customer.subscription.')) sub = obj;
  else if (type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
    // La session porte l'identifiant ; l'état complet vient de Stripe.
    const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
    const r = await stripeApi('GET', `subscriptions/${encodeURIComponent(subId)}`);
    if (!r.ok) return repondre(res, 503, { erreur: 'abonnement illisible chez Stripe', reessayer: true });
    sub = r.data;
    // Le propriétaire de la session (client_reference_id) fait foi s'il manque.
    if (!(sub.metadata && sub.metadata.owner) && obj.client_reference_id) sub.metadata = { ...(sub.metadata || {}), owner: obj.client_reference_id };
  } else if (type === 'invoice.paid') {
    // (8 nov.) LE PARRAINAGE : le premier paiement réel du filleul offre un
    // mois à chacun (api/_lib/parrainage.js). Le vendeur vient de NOTRE table
    // (client Stripe → owner), jamais d'un champ de la facture.
    const client = typeof obj.customer === 'string' ? obj.customer : (obj.customer && obj.customer.id) || '';
    const owner = await proprietaireDe(null, client);
    if (owner === undefined) return repondre(res, 503, { erreur: 'propriétaire pas su', reessayer: true });
    if (!owner) { console.warn('[stripe] invoice.paid sans propriétaire VRM', String(obj.id || '').slice(0, 40)); return repondre(res, 200, { recu: true, ignore: 'sans-proprietaire' }); }   // (11 nov., B133) journalisé
    const p = await factureFilleulPayee(owner, client, obj, PRIX_CGV.centimes);
    if (!p.ok) return repondre(res, 503, { erreur: 'parrainage non crédité', reessayer: true });
    return repondre(res, 200, { recu: true });
  } else {
    // invoice.* : le statut qui compte arrive par customer.subscription.updated.
    return repondre(res, 200, { recu: true, ignore: type });
  }

  const client = typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || '';
  const owner = await proprietaireDe(sub, client);
  if (owner === undefined) return repondre(res, 503, { erreur: 'propriétaire pas su', reessayer: true });
  if (!owner) { console.warn('[stripe] abonnement sans propriétaire VRM', sub.id); return repondre(res, 200, { recu: true, ignore: 'sans-proprietaire' }); }
  const ecrit = await ecrireStatut(owner, ligneDeLAbonnement(sub, !!ev.livemode), ts);
  // ⚠️ Tant que le statut n'est pas RANGÉ, on ne dit pas « reçu » : un 5xx fait
  //    réessayer Stripe (la leçon d'api/email-inbound, §5).
  if (!ecrit.ok) return repondre(res, 503, { erreur: 'statut non enregistré', detail: ecrit.code, reessayer: true });
  if (ecrit.ignore) console.warn('[stripe] événement acquitté sans écriture :', ecrit.ignore, sub.id);
  // Marque l'essai comme consommé quand il a réellement DÉMARRÉ (statut
  // « trialing » ou une date de fin d'essai), d'après ce qu'on a posé au
  // paiement. Idempotent (clé primaire) : un rejeu de webhook ne double rien.
  if (sub.metadata && sub.metadata.essai && (sub.status === 'trialing' || sub.trial_end)) {
    // (11 nov., robustesse) Pas enregistré ⇒ 503 : Stripe rejoue (le statut,
    // déjà rangé, se réécrit à l'identique) — sinon le même e-mail reprenait 7 jours.
    const essaiNote = await enregistrerEssai(owner, sub.metadata.essai_email, String(sub.metadata.essai_vinted || '').split(',').filter(Boolean), sub.id);
    if (!essaiNote) return repondre(res, 503, { erreur: 'essai non enregistré', reessayer: true });
  }
  return repondre(res, 200, { recu: true });
}

async function abonnement(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  if (acc === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Réessaie dans un instant." });
  // Le prix de l'OFFRE (clé `vrm_mensuel`) et celui de SON abonnement, lus
  // ensemble : ce ne sont pas les mêmes quand l'offre a changé depuis.
  const [prix, sub, pro, sup] = stripePret() ? await Promise.all([lirePrix(), abonnementStripeDe(ligne), offrePro(), offreCompteSup()]) : [null, null, await offrePro(), await offreCompteSup()];
  const prixAbo = prixDeLAbonnement(sub);
  // (9 nov.) LE PLAN : lu du PRIX Stripe réel de son abonnement (jamais d'un
  // champ du navigateur). Propriétaire : Pro. Pas su ⇒ `null` (rien n'est bridé).
  const lu = sub ? planDeLAbonnement(sub, optsPlan()) : null;
  const plan = acc.proprietaire ? PLAN_PRO : (lu ? lu.plan : null);
  // Trois états : `true` le prix de Stripe est celui des CGV · `false` il en
  // diffère (le paiement est fermé) · `null` pas su (Stripe muet ou pas branché).
  const conforme = prix ? prixConforme(prix) : null;
  // 22 oct. — les mentions de l'éditeur : trois états (`null` = pas su). Vides ⇒
  // le paiement est fermé (comme `prixConforme: false`) ; la LISTE de ce qui
  // manque ne part qu'au propriétaire, le seul qui peut la remplir.
  const lues = await lireMentions();
  const manque = mentionsManquantes(lues);
  // Essai gratuit encore disponible ? Jamais si propriétaire ou déjà abonné ;
  // `null` d'éligibilité ⇒ false (on n'annonce pas un essai qu'on ne pourrait
  // pas honorer). Une seule fois par e-mail ET par compte Vinted.
  const dejaAbo = !!(ligne && abonnementActif(ligne.statut));
  const essaiDispo = (!acc.proprietaire && !dejaAbo && stripePret())
    ? (await essaiDejaUtilise(u.email, await lireVintedIds(u.id))) === false
    : false;
  // (12 nov.) « OUVRIR LES PAIEMENTS » : au PROPRIÉTAIRE seul, chaque prérequis
  // LU (api/_lib/ouverture-paiements.js) — jamais à un vendeur.
  let ouverture;
  if (acc.proprietaire) {
    const webhookLu = stripePret() ? await lireWebhooksStripe(stripeApi) : null;
    ouverture = etatOuverture({
      cle: stripePret(), modeTest: stripePret() ? stripeModeTest() : null,
      secret: /^whsec_/.test(String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()),
      webhook: webhookLu, soloConforme: conforme, soloTexte: prix && conforme === false ? prixTexte(prix) : null,
      pro, manque, contact: contactEmail(),
      editeurEmail: lues && lues.editeur ? (typeof lues.editeur.email === 'string' ? lues.editeur.email : '') : null,
      cleSolo: PRIX_CLE,
    });
  }
  return repondre(res, 200, {
    ok: true,
    ouverture,
    essaiDispo,
    essaiJours: 7,
    mentionsCompletes: manque === null ? null : manque.length === 0,
    mentionsManquantes: acc.proprietaire ? (manque === null ? null : manque.map((x) => x.libelle)) : undefined,
    // 23 oct. (revue) : pourquoi « pas su » (l'erreur de lecture du fichier) —
    // au propriétaire seul, comme la liste ; un vendeur n'en lit rien.
    mentionsErreur: acc.proprietaire && manque === null ? String((lues && lues.erreur) || 'illisible') : undefined,
    proprietaire: acc.proprietaire,
    configure: stripePret(),
    modeTest: stripePret() ? stripeModeTest() : null,
    obligatoire: acc.obligatoire,
    // ⚠️ Un prix qui n'est pas celui des CGV n'est JAMAIS relayé comme « le
    //    prix » : l'app dirait 9,99 € à côté de CGV à 12,99 €. Elle dit alors
    //    le prix des CGV et ne propose pas de payer (`prixConforme: false`).
    prix: prix && conforme ? { montant: prix.montant, devise: prix.devise, intervalle: prix.intervalle } : null,
    prixConforme: conforme,
    // Le prix réglé chez Stripe, au SEUL propriétaire, quand il diffère :
    // c'est lui qui le corrige dans son tableau de bord. `texte` est écrit ICI
    // (`prixTexte` : montant, DEVISE et RYTHME) et l'app l'affiche tel quel —
    // c'est exactement ce qui le rend différent des CGV qu'il doit voir.
    prixStripe: acc.proprietaire && prix && conforme === false
      ? { montant: prix.montant, devise: prix.devise, intervalle: prix.intervalle, nIntervalles: prix.nIntervalles, texte: prixTexte(prix) }
      : null,
    // Le prix de SON abonnement (celui qu'il paie), pas celui de l'offre :
    // `null` = pas su ⇒ la carte écrit « Abonné » sans montant.
    prixAbonnement: prixAbo,
    statut: ligne ? ligne.statut : null,
    finPeriode: ligne ? ligne.fin_periode : null,
    annuleFinPeriode: ligne ? !!ligne.annule_fin_periode : false,
    peutGerer: !!(ligne && ligne.client_stripe),
    // `actif` : l'abonnement est vivant chez Stripe (ce que dit la carte).
    // `acces` : la base laisse entrer (ce que décide la porte) — LA règle.
    actif: acc.proprietaire || !!(ligne && abonnementActif(ligne.statut)),
    acces: acc.acces,
    // (8 nov.) La base laisse-t-elle LIRE quand l'accès est coupé ? (027) —
    // l'app passe alors en lecture seule au lieu de tout fermer.
    lecture: acc.lecture === true,
    lectureSeule: acc.acces === false && acc.lecture === true,
    // La fin de l'ESSAI : pendant « trialing », la période en cours EST l'essai
    // (Stripe : current_period_end = trial_end). Rien d'autre n'est deviné.
    finEssai: ligne && ligne.statut === 'trialing' ? (ligne.fin_periode || null) : null,
    // (9 nov.) Solo / Pro. `plan` : 'solo' · 'pro' · null (pas su ⇒ rien bridé).
    // `planRaison` dit pourquoi `null` (prix inconnu, CGV d'avant Solo…).
    plan,
    planRaison: plan ? null : (lu ? lu.raison : (sub === null && ligne && abonnementActif(ligne.statut) ? 'stripe-muet' : 'sans-abonnement')),
    compteVendeur: !acc.proprietaire && lu && lu.vendeur
      ? { uid: lu.vendeur, le: lu.vendeurLe, prochainChangement: prochainChangement(lu.vendeurLe) }
      : null,
    // (9 nov., Solo par plateforme) Les comptes vendeurs Leboncoin / eBay / Vestiaire.
    comptesVendeurs: !acc.proprietaire && lu ? comptesVendeursApp(lu.autres) : {},
    // (13 nov., lot 56) Les comptes Vinted vendeurs DE PLUS (Solo) : la quantité PAYÉE
    // chez Stripe et la liste (déjà bornée à cette quantité par la règle). Pro : rien.
    comptesSup: !acc.proprietaire && lu && lu.plan === PLAN_SOLO ? comptesSupApp(lu) : null,
    offres: {
      solo: { texte: prix && conforme ? prixTexte(prix) : null, ouvert: !!(prix && conforme) },
      // Le geste qui manque (`raison`) ne part qu'au propriétaire.
      pro: { ouvert: pro.ouvert, texte: pro.ouvert ? pro.texte : null, raison: acc.proprietaire ? pro.raison : undefined, texteStripe: acc.proprietaire ? (pro.texteStripe || null) : undefined },
      // (13 nov., lot 56) Un compte Vinted vendeur de plus, en Solo. Fermé ⇒ « bientôt ».
      compteSup: { ouvert: sup.ouvert, texte: sup.ouvert ? sup.texte : null, prixCentimes: sup.prixCentimes, inclus: COMPTES_INCLUS_SOLO, max: MAX_COMPTES_SUP,
        raison: acc.proprietaire ? sup.raison : undefined, cle: acc.proprietaire ? sup.cle : undefined, texteStripe: acc.proprietaire ? (sup.texteStripe || null) : undefined },
    },
  });
}

// La version des CGV acceptées : la date de « Dernière mise à jour » de
// public/legal/cgv.html (audit-lancement vérifie qu'elles concordent).
// 11 octobre : prix passé à 12,99 € (version précédente : 2026-10-04, 9,99 €).
// 22 octobre : case « accès immédiat » et formulaire de rétractation (art. 5).
// 27 octobre : prix 16,99 €, et essai gratuit de 7 jours (une seule fois par
//   adresse e-mail ET par compte Vinted).
// 31 octobre : prix 16,99 € (sa décision), essai de 7 jours inchangé.
// 8 novembre : fin de l'essai et rappels, lecture seule à l'expiration,
//   parrainage (article 2), chemins Paramètres → Abonnement.
// 9 novembre : deux offres, Solo (un compte vendeur + comptes d'achat) et Pro
//   (les ventes de tous les comptes, prix à venir) — `CGV_PLANS_DEPUIS`.
// 10 novembre (20 h, décision de Julien) : Pro = tous les comptes vendeurs, sans limite.
// 13 novembre (lot 56) : option Solo « compte Vinted vendeur de plus » (3 € / mois, à confirmer).
const CGV_VERSION = '2026-11-13';
async function checkout(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  // ⚠️ LES CGV S'ACCEPTENT DANS VRM, AVANT STRIPE (décision du 6 octobre). La
  //    case de Stripe dépend d'un réglage de son tableau de bord (adresse des
  //    conditions) : tant qu'il manque, Stripe refusait d'ouvrir le paiement et
  //    personne ne pouvait s'abonner. L'acceptation est donc exigée ICI (case
  //    cochée dans l'app, `cgv: true`), datée et rangée dans les métadonnées de
  //    l'abonnement — c'est elle qui rend les CGV opposables. La case de Stripe
  //    reste demandée en plus quand il sait l'afficher.
  //    La case est jugée APRÈS « propriétaire » et « déjà abonné » (on ne
  //    demande pas de cocher une case pour un paiement qui n'aura pas lieu) et
  //    AVANT tout appel à Stripe (`lirePrix` compris) : sans elle, rien ne part.
  const corps = await lireCorpsJson(req);
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  if (acc === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu vérifier ton abonnement. Réessaie dans un instant." });
  if (acc.proprietaire) return repondre(res, 409, { erreur: 'proprietaire', message: 'Ton compte est gratuit : rien à payer.' });
  // Jamais deux abonnements pour un vendeur : déjà actif ⇒ on l'envoie gérer.
  if (ligne && abonnementActif(ligne.statut)) return repondre(res, 409, { erreur: 'deja', message: 'Tu es déjà abonné.' });
  // ⚠️ 22 oct. — LES MENTIONS DE L'ÉDITEUR SONT VIDES (mesuré : 10 champs sur
  //    10 à `null` en production) : on n'ouvre RIEN. Même forme que le refus
  //    « prix ≠ CGV » plus bas : un message générique au VENDEUR (ce qui
  //    manque est un réglage du propriétaire, pas son affaire), le détail dans
  //    les journaux et sur la carte « Mon compte » du propriétaire. Fichier
  //    illisible = « pas su » = fermé aussi.
  const manque = mentionsManquantes(await lireMentions());
  if (manque === null || manque.length) {
    console.warn('[stripe] mentions de l’éditeur', manque === null ? 'illisibles' : 'incomplètes (' + manque.map((x) => x.libelle).join(', ') + ')', '— paiement refusé. Geste : remplir public/legal/editeur.js et src/contact.js.');
    return repondre(res, 503, { erreur: 'mentions-legales', message: "Le paiement n'est pas encore ouvert : rien n'a été prélevé. Réessaie plus tard." });
  }
  if (!corps || corps.cgv !== true) return repondre(res, 400, { erreur: 'cgv', message: "Coche « J'accepte les conditions générales de vente » avant de payer." });
  // 22 oct. — LA DEMANDE D'ACCÈS IMMÉDIAT (art. L221-25 C. conso), cochée dans
  //    l'app à côté des CGV, envoyée et rangée comme elles (même date). Sans
  //    elle, un abonné qui se rétracte sous 14 jours est remboursé en entier,
  //    même s'il a utilisé VRM. ⚠️ Ce n'est PAS une renonciation au droit de
  //    rétractation (L221-28 1° exige un service PLEINEMENT exécuté avant la fin
  //    des 14 jours, ce qu'un abonnement mensuel n'est pas, et l'article 5 des
  //    CGV garde ce droit) : il reste, au prorata de la période écoulée.
  if (corps.accesImmediat !== true) return repondre(res, 400, { erreur: 'acces-immediat', message: "Coche « Je demande l'accès immédiat » avant de payer." });
  const accepteLe = new Date().toISOString();
  // (9 nov.) S'abonner directement à Pro : seulement quand son prix est posé
  // (Stripe + `PRIX_PRO_CGV` + CGV) ; sinon rien ne part.
  const veutPro = corps.plan === PLAN_PRO;
  if (veutPro && !(await offrePro()).ouvert) return repondre(res, 503, { erreur: 'pro-ferme', message: "L'offre Pro n'est pas encore ouverte : rien n'a été prélevé." });
  const prix = veutPro ? await lirePrixPro() : await lirePrix();
  if (!prix) return repondre(res, 503, { erreur: 'prix', message: "Le prix de l'abonnement est introuvable chez Stripe." });
  // Le prix que Stripe facturerait n'est pas celui des CGV qu'il vient
  // d'accepter : on n'ouvre RIEN (voir `PRIX_CGV`). Le propriétaire le lit dans
  // les journaux et sur sa carte « Mon compte », avec le geste.
  if (veutPro ? !prixProConforme(prix) : !prixConforme(prix)) {
    console.warn('[stripe] prix « ' + (veutPro ? prixProCle() : PRIX_CLE) + ' » =', prixTexte(prix), '≠ CGV', prixTexte(PRIX_CGV), '— paiement refusé. Geste : Stripe → Produits → ajouter un prix de', eurosLisibles(PRIX_CGV.centimes), 'par mois, clé de recherche « ' + PRIX_CLE + ' », « transférer la clé ».');
    // ⚠️ Ce refus ne part JAMAIS au propriétaire (il a répondu 409 plus haut) :
    //    c'est un VENDEUR qui le lit. Il ne nomme donc pas le montant réglé chez
    //    Stripe (9,99 € à côté de CGV à 12,99 € : un prix qu'il ne paiera pas,
    //    et un réglage interne qui ne le regarde pas). Le détail reste dans les
    //    journaux ci-dessus et sur la carte « Mon compte » du propriétaire.
    return repondre(res, 503, { erreur: 'prix-cgv', message: "Le paiement n'est pas encore ouvert : rien n'a été prélevé. Réessaie plus tard." });
  }
  // Essai gratuit 7 jours — UNE seule fois par e-mail ET par compte Vinted.
  // `false` = éligible ; `true` = déjà utilisé ; `null` = pas su ⇒ pas d'essai.
  const idsVinted = await lireVintedIds(u.id);
  const avecEssai = (await essaiDejaUtilise(u.email, idsVinted)) === false;
  const params = {
    mode: 'subscription',
    line_items: [{ price: prix.id, quantity: 1 }],
    success_url: `${APP_URL}/?tab=settings&vue=abonnement&abonnement=merci`,
    cancel_url: `${APP_URL}/?tab=settings&vue=abonnement&abonnement=annule`,
    client_reference_id: u.id,
    metadata: { owner: u.id, app: 'vrm', cgv_version: CGV_VERSION, cgv_acceptees_le: accepteLe, acces_immediat_demande_le: accepteLe },
    subscription_data: {
      metadata: { owner: u.id, app: 'vrm', cgv_version: CGV_VERSION, cgv_acceptees_le: accepteLe, acces_immediat_demande_le: accepteLe,
        ...(avecEssai ? { essai: '7j', essai_email: normEmail(u.email), essai_vinted: idsVinted.join(',') } : {}) },
      ...(avecEssai ? { trial_period_days: 7 } : {}),
    },
    locale: 'fr',
    // ⚠️ LES CGV SE FONT ACCEPTER AVANT DE PAYER (5 octobre). Un abonnement
    //    vendu en ligne sans case « j'accepte les conditions de vente » n'a pas
    //    de CGV opposables : la case est OBLIGATOIRE (`required`), Stripe
    //    refuse le paiement tant qu'elle n'est pas cochée, et le lien mène à
    //    NOS CGV (public/legal/cgv.html), pas à un texte générique.
    // ⚠️ Stripe exige en plus l'adresse des conditions dans son tableau de bord
    //    (Paramètres → Détails publics). Tant qu'elle manque, il refuse d'ouvrir
    //    le paiement — c'est dit plus bas, jamais contourné en retirant la case.
    consent_collection: { terms_of_service: 'required' },
    custom_text: { terms_of_service_acceptance: { message: `J'accepte les [conditions générales de vente de VRM](${APP_URL}/legal/cgv.html).` } },
  };
  if (ligne && ligne.client_stripe) params.customer = ligne.client_stripe;
  else if (u.email) params.customer_email = u.email;
  // Un double clic ne crée pas deux sessions (même clé dans la même minute).
  // (11 nov., M55) Les PARAMÈTRES dans la clé (Solo ou Pro, essai) : deux clics
  // différents dans la même minute ne rejouent plus une clé avec d'autres
  // paramètres (Stripe répondait 400, affiché « panne » 502).
  const cle = `vrm-co-${u.id}-${Math.floor(Date.now() / 60000)}-${empreinte(JSON.stringify(params)).slice(0, 12)}`;
  let r = await stripeApi('POST', 'checkout/sessions', params, cle);
  // L'adresse des CGV n'est pas encore réglée chez Stripe : sa case ne peut pas
  // s'afficher. Les CGV ont DÉJÀ été acceptées dans VRM (ci-dessus, datées) :
  // on ouvre le paiement sans la case de Stripe (autre clé d'idempotence :
  // Stripe refuse de rejouer une clé avec d'autres paramètres), et on le note
  // pour le propriétaire.
  const erreurStripe = String((r.data && r.data.error && r.data.error.message) || '');
  if (!r.ok && /terms of service/i.test(erreurStripe)) {
    console.warn('[stripe] case CGV de Stripe indisponible (adresse absente : Stripe → Paramètres → Détails publics → Conditions =', `${APP_URL}/legal/cgv.html) — CGV acceptées dans VRM, paiement ouvert sans la case de Stripe`);
    const sansCase = { ...params };
    delete sansCase.consent_collection;
    delete sansCase.custom_text;
    r = await stripeApi('POST', 'checkout/sessions', sansCase, cle + '-vrm');
  }
  if (!r.ok || !r.data.url) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas pu ouvrir le paiement. Réessaie dans un instant." });
  return repondre(res, 200, { url: r.data.url });
}

async function portail(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Réessaie dans un instant." });
  if (!ligne || !ligne.client_stripe) return repondre(res, 404, { erreur: 'aucun', message: "Tu n'as pas encore d'abonnement." });
  const r = await stripeApi('POST', 'billing_portal/sessions', { customer: ligne.client_stripe, return_url: `${APP_URL}/?tab=settings&vue=abonnement` });
  if (!r.ok || !r.data.url) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas pu ouvrir la page de gestion. Réessaie dans un instant." });
  return repondre(res, 200, { url: r.data.url });
}

// ── SOLO : LE COMPTE QUI VEND (9 nov.) ──────────────────────────────────────
// POST { uid } : le vendeur CHOISIT son compte vendeur (Paramètres → Abonnement,
// feuille « Quel compte vend ? »). Jamais deviné : la seule écriture est ce clic.
// Rangé dans les MÉTADONNÉES de SON abonnement Stripe (aucune table de plus ;
// le webhook le recopie dans `abonnements.compte_vendeur`, migration 028).
//   · le compte doit être l'un de SES comptes Vinted (lu avec SON jeton : RLS) ;
//   · l'abonnement est le sien (client relu chez Stripe) et c'est un Solo ;
//   · premier choix libre, puis un changement tous les 30 jours (dit avec la date).
// (9 nov., Solo par plateforme) POST { plateforme: 'leboncoin'|'ebay'|'vestiaire', id } :
// le compte vendeur de CETTE plateforme, mêmes garanties (SES comptes, lus avec SON jeton ;
// SON abonnement relu chez Stripe ; Solo ; 30 jours, comptés par plateforme).
const LIGNE_COMPTES = {
  leboncoin: { ligne: 'lbc_accounts', select: 'a:data->accounts' },
  ebay: { ligne: 'ebay_comptes', select: 'comptes:data->comptes' },
  vestiaire: { ligne: 'vc_session', select: 'id:data->>id,comptes:data->comptes' },
};
// Ses comptes d'une plateforme (identités), lus avec SON jeton (RLS : les siens seulement).
// `null` = pas su (lecture ratée) ⇒ rien n'est écrit.
async function comptesAutresDe(req, plateforme, owner) {
  const d = LIGNE_COMPTES[plateforme];
  try {
    // RLS ne lui montre que ses lignes ; base cloisonnée : on filtre AUSSI sur lui (ceinture et bretelles).
    const filtre = (await baseCloisonnee()) ? `&owner=eq.${encodeURIComponent(owner)}` : '';
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${d.ligne}${filtre}&select=${d.select}`, { headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}` } });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    const l = j[0] || {};
    const ids = new Set();
    if (plateforme === 'leboncoin') for (const [k, a] of Object.entries(l.a && typeof l.a === 'object' ? l.a : {})) { const id = idCompteVendeur('leboncoin', (a && a.id) || k); if (id) ids.add(id); }
    if (plateforme === 'ebay') for (const c of Array.isArray(l.comptes) ? l.comptes : []) { if (!c || typeof c !== 'object' || Number(c.deconnecteLe)) continue; const id = idCompteVendeur('ebay', c.principal === true ? 'principal' : c.cle); if (id) ids.add(id); }
    if (plateforme === 'vestiaire') { for (const k of Object.keys(l.comptes && typeof l.comptes === 'object' ? l.comptes : {})) { const id = idCompteVendeur('vestiaire', k); if (id) ids.add(id); } const id = idCompteVendeur('vestiaire', l.id); if (id) ids.add(id); }
    return ids;
  } catch (_) { return null; }
}
async function compteVendeurAutre(req, res, u, corps) {
  const plateforme = String(corps.plateforme);
  const nomP = NOMS_PLATEFORMES_SOLO[plateforme];
  const id = idCompteVendeur(plateforme, corps.id);
  if (!id) return repondre(res, 400, { erreur: 'compte', message: `Choisis un de tes comptes ${nomP}.` });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché : rien à choisir." });
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  if (acc === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Rien n'a changé ; réessaie dans un instant." });
  if (acc.proprietaire) return repondre(res, 409, { erreur: 'proprietaire', message: 'Ton compte est Pro : tous tes comptes vendent.' });
  const siens = await comptesAutresDe(req, plateforme, u.id);
  if (siens === null) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire tes comptes. Rien n'a changé ; réessaie dans un instant." });
  if (!siens.has(id)) return repondre(res, 403, { erreur: 'pas-a-toi', message: `Ce compte ${nomP} n'est pas relié à ton VRM.` });
  const sub = await abonnementStripeDe(ligne);
  if (!sub) return repondre(res, 409, { erreur: 'aucun', message: "Je ne trouve pas ton abonnement chez Stripe : rien n'a changé." });
  const lu = planDeLAbonnement(sub, optsPlan());
  if (lu.plan === PLAN_PRO) return repondre(res, 409, { erreur: 'pro', message: 'Tu es en Pro : tous tes comptes vendent.' });
  const avant = lu.autres && lu.autres[plateforme];
  if (avant && avant.id === id) return repondre(res, 200, { ok: true, inchange: true, comptesVendeurs: comptesVendeursApp(lu.autres) });
  const attendre = avant ? prochainChangement(avant.le) : null;
  if (attendre) return repondre(res, 429, { erreur: 'trop-tot', prochainChangement: attendre, message: `Tu as changé de compte vendeur ${nomP} il y a moins de 30 jours : prochain changement possible le ${new Date(attendre).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })}. Pour vendre sur tous tes comptes dès maintenant : Pro.` });
  const le = new Date().toISOString();
  const k = META_VENDEUR[plateforme];
  const r = await stripeApi('POST', `subscriptions/${encodeURIComponent(sub.id)}`, { metadata: { [k]: id, [k + '_le']: le, [k + '_avant']: avant ? avant.id : '' } }, `vrm-cv-${u.id}-${plateforme}-${id}-${Math.floor(Date.now() / 60000)}`);
  if (!r.ok || !r.data) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas enregistré ton choix : rien n'a changé. Réessaie dans un instant." });
  const relu = planDeLAbonnement(r.data, optsPlan());
  if (!(relu.autres && relu.autres[plateforme] && relu.autres[plateforme].id === id)) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas enregistré ton choix : rien n'a changé. Réessaie dans un instant." });
  return repondre(res, 200, { ok: true, comptesVendeurs: comptesVendeursApp(relu.autres) });
}
// ── (13 nov., lot 56) SOLO : UN COMPTE VINTED VENDEUR DE PLUS, PAYÉ ──────────
// POST { action: 'ajouter-sup', uid, cgv: true } : ce compte Vinted (à LUI) vend
// aussi. Une place déjà payée et libre ⇒ seulement rangé ; sinon la quantité de
// l'article `vrm_compte_sup` de SON abonnement monte de 1 (prorata, CGV cochées) —
// et seulement si le prix existe chez Stripe et vaut `PRIX_COMPTE_SUP_CENTIMES`
// (sinon « bientôt » : rien ne part, rien n'est prélevé).
// POST { action: 'retirer-sup', uid } : il ne vend plus ; la quantité redescend au
// nombre de comptes restants (prorata ; l'article part à 0).
// ⚠️ LA LIMITE EST ICI ET DANS LA RÈGLE, JAMAIS SEULEMENT À L'ÉCRAN : la liste
//    rangée ne dépasse jamais la quantité payée (`planDeLAbonnement` la borne aussi
//    à la lecture) ; Pro : rien à ajouter (illimité) ; propriétaire : rien.
async function vintedSiens(req) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id`, { headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}` } });
    const j = r.ok ? await r.json() : null;
    return Array.isArray(j) ? new Set(j.map((x) => String(x && x.vinted_user_id))) : null;
  } catch (_) { return null; }
}
const RIEN_CHANGE = "rien n'a changé, rien n'a été prélevé";
async function compteVendeurSup(req, res, u, corps) {
  const ajouter = corps.action === 'ajouter-sup';
  const uid = String(corps.uid || '').trim();
  if (!uidValide(uid)) return repondre(res, 400, { erreur: 'compte', message: 'Choisis un de tes comptes Vinted.' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: `Le paiement n'est pas encore branché : ${RIEN_CHANGE}.` });
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  if (acc === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: `Je n'ai pas pu lire ton abonnement : ${RIEN_CHANGE}. Réessaie dans un instant.` });
  if (acc.proprietaire) return repondre(res, 409, { erreur: 'proprietaire', message: 'Ton compte est Pro : tous tes comptes vendent.' });
  const siens = await vintedSiens(req);
  if (siens === null) return repondre(res, 503, { erreur: 'base-injoignable', message: `Je n'ai pas pu lire tes comptes : ${RIEN_CHANGE}. Réessaie dans un instant.` });
  if (ajouter && !siens.has(uid)) return repondre(res, 403, { erreur: 'pas-a-toi', message: "Ce compte n'est pas relié à ton VRM." });
  const sub = await abonnementStripeDe(ligne);
  if (!sub) return repondre(res, 409, { erreur: 'aucun', message: `Je ne trouve pas ton abonnement chez Stripe : ${RIEN_CHANGE}.` });
  const lu = planDeLAbonnement(sub, optsPlan());
  if (lu.plan === PLAN_PRO) return repondre(res, 409, { erreur: 'pro', message: 'Tu es en Pro : tous tes comptes vendent, sans supplément.' });
  if (lu.plan !== PLAN_SOLO) return repondre(res, 409, { erreur: 'plan', message: `Ton abonnement a une forme que je ne sais pas changer : ${RIEN_CHANGE}. Écris-nous.` });
  if (!lu.vendeur) return repondre(res, 409, { erreur: 'sans-compte-inclus', message: 'Choisis d’abord le compte Vinted inclus dans Solo (« Quel compte vend ? »).' });
  const s0 = lu.comptesSup;
  const liste = s0.liste.slice();
  const le = new Date().toISOString();
  const cleIdem = (x) => `vrm-sup-${u.id}-${x}-${uid}-${Math.floor(Date.now() / 60000)}`;
  if (ajouter) {
    if (uid === lu.vendeur || liste.includes(uid)) return repondre(res, 200, { ok: true, inchange: true, comptesSup: comptesSupApp(lu) });
    if (liste.length >= MAX_COMPTES_SUP) return repondre(res, 409, { erreur: 'max', message: `${MAX_COMPTES_SUP} comptes de plus au plus en Solo : passe à Pro (illimité).` });
    const nouvelle = [...liste, uid];
    const meta = { [META_COMPTES_SUP]: nouvelle.join(','), [META_COMPTES_SUP + '_le']: le };
    let params;
    if (liste.length < s0.payes) {
      // Une place DÉJÀ PAYÉE et libre : rien à facturer, seulement le choix rangé.
      params = { metadata: meta };
    } else {
      const offre = await offreCompteSup();
      if (!offre.ouvert) return repondre(res, 503, { erreur: 'compte-sup-ferme', message: `Bientôt : un compte vendeur de plus ne s'achète pas encore. ${RIEN_CHANGE[0].toUpperCase() + RIEN_CHANGE.slice(1)}.` });
      if (corps.cgv !== true) return repondre(res, 400, { erreur: 'cgv', message: "Coche « J'accepte les conditions générales de vente » avant d'ajouter un compte." });
      const article = s0.articleId ? { id: s0.articleId, quantity: s0.payes + 1 } : { price: offre.id, quantity: 1 };
      params = { items: [article], proration_behavior: 'create_prorations', metadata: { ...meta, cgv_version: CGV_VERSION, cgv_acceptees_le: le } };
    }
    const r = await stripeApi('POST', `subscriptions/${encodeURIComponent(sub.id)}`, params, cleIdem('a'));
    if (!r.ok || !r.data) return repondre(res, 502, { erreur: 'stripe', message: `Stripe n'a pas enregistré ce compte : ${RIEN_CHANGE}. Réessaie dans un instant.` });
    const relu = planDeLAbonnement(r.data, optsPlan());
    if (!relu.comptesSup.liste.includes(uid)) return repondre(res, 502, { erreur: 'stripe', message: `Stripe n'a pas enregistré ce compte : ${RIEN_CHANGE}. Réessaie dans un instant.` });
    return repondre(res, 200, { ok: true, comptesSup: comptesSupApp(relu) });
  }
  // Retirer : la liste sans lui, la quantité ramenée au nombre de comptes restants.
  if (!liste.includes(uid)) return repondre(res, 200, { ok: true, inchange: true, comptesSup: comptesSupApp(lu) });
  const reste = liste.filter((x) => x !== uid);
  const params = { metadata: { [META_COMPTES_SUP]: reste.join(','), [META_COMPTES_SUP + '_le']: le } };
  if (s0.articleId) {
    params.items = [reste.length ? { id: s0.articleId, quantity: reste.length } : { id: s0.articleId, deleted: true }];
    params.proration_behavior = 'create_prorations';
  }
  const r = await stripeApi('POST', `subscriptions/${encodeURIComponent(sub.id)}`, params, cleIdem('r'));
  if (!r.ok || !r.data) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas enregistré le retrait : rien n'a changé. Réessaie dans un instant." });
  const relu = planDeLAbonnement(r.data, optsPlan());
  if (relu.comptesSup.liste.includes(uid)) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas enregistré le retrait : rien n'a changé. Réessaie dans un instant." });
  return repondre(res, 200, { ok: true, comptesSup: comptesSupApp(relu) });
}

async function compteVendeur(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  const corps = await lireCorpsJson(req);
  if (corps && (corps.action === 'ajouter-sup' || corps.action === 'retirer-sup')) return compteVendeurSup(req, res, u, corps);
  // (10 nov., 20 h) Pro = comptes vendeurs illimités : rien à choisir, rien n'est écrit.
  if (corps && corps.plateforme === 'pro') return repondre(res, 409, { erreur: 'pro-illimite', message: 'En Pro, tous tes comptes vendent : rien à choisir.' });
  if (corps && corps.plateforme != null && corps.plateforme !== 'vinted') {
    if (!PLATEFORMES_SOLO.includes(String(corps.plateforme))) return repondre(res, 400, { erreur: 'plateforme', message: 'Plateforme inconnue.' });
    return compteVendeurAutre(req, res, u, corps);
  }
  const uid = String((corps && corps.uid) || '').trim();
  if (!uidValide(uid)) return repondre(res, 400, { erreur: 'compte', message: 'Choisis un de tes comptes Vinted.' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché : rien à choisir." });
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  if (acc === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Rien n'a changé ; réessaie dans un instant." });
  if (acc.proprietaire) return repondre(res, 409, { erreur: 'proprietaire', message: 'Ton compte est Pro : tous tes comptes vendent.' });
  // Le compte est-il à LUI ? Lu avec SON jeton (la base ne lui montre que les siens).
  let siens = null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id`, { headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}` } });
    const j = r.ok ? await r.json() : null;
    siens = Array.isArray(j) ? new Set(j.map((x) => String(x && x.vinted_user_id))) : null;
  } catch (_) { siens = null; }
  if (siens === null) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire tes comptes. Rien n'a changé ; réessaie dans un instant." });
  if (!siens.has(uid)) return repondre(res, 403, { erreur: 'pas-a-toi', message: "Ce compte n'est pas relié à ton VRM." });
  const sub = await abonnementStripeDe(ligne);
  if (!sub) return repondre(res, 409, { erreur: 'aucun', message: "Je ne trouve pas ton abonnement chez Stripe : rien n'a changé." });
  const lu = planDeLAbonnement(sub, optsPlan());
  if (lu.plan === PLAN_PRO) return repondre(res, 409, { erreur: 'pro', message: 'Tu es en Pro : tous tes comptes vendent.' });
  if (lu.vendeur === uid) return repondre(res, 200, { ok: true, inchange: true, compteVendeur: { uid, le: lu.vendeurLe, prochainChangement: prochainChangement(lu.vendeurLe) } });
  const attendre = lu.vendeur ? prochainChangement(lu.vendeurLe) : null;
  if (attendre) return repondre(res, 429, { erreur: 'trop-tot', prochainChangement: attendre, message: `Tu as changé de compte vendeur il y a moins de 30 jours : prochain changement possible le ${new Date(attendre).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })}. Pour vendre sur tous tes comptes dès maintenant : Pro.` });
  const le = new Date().toISOString();
  const r = await stripeApi('POST', `subscriptions/${encodeURIComponent(sub.id)}`, { metadata: { vrm_compte_vendeur: uid, vrm_compte_vendeur_le: le, vrm_compte_vendeur_avant: lu.vendeur || '' } }, `vrm-cv-${u.id}-${uid}-${Math.floor(Date.now() / 60000)}`);
  if (!r.ok || !r.data) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas enregistré ton choix : rien n'a changé. Réessaie dans un instant." });
  const relu = planDeLAbonnement(r.data, optsPlan());
  if (relu.vendeur !== uid) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas enregistré ton choix : rien n'a changé. Réessaie dans un instant." });
  return repondre(res, 200, { ok: true, compteVendeur: { uid, le: relu.vendeurLe, prochainChangement: prochainChangement(relu.vendeurLe) } });
}

// ── SOLO ⇄ PRO, AVEC PRORATA (9 nov.) ───────────────────────────────────────
// POST { plan: 'pro' | 'solo', cgv: true } : change le PRIX de SON abonnement
// (un seul article) ; Stripe calcule le prorata (`create_prorations`). Pro ne
// s'ouvre que quand son prix est posé (`offrePro`). Les CGV de la nouvelle offre
// s'acceptent dans VRM avant (case cochée), datées dans les métadonnées.
async function changerPlan(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  const corps = await lireCorpsJson(req);
  const cible = corps && (corps.plan === PLAN_PRO || corps.plan === PLAN_SOLO) ? corps.plan : '';
  if (!cible) return repondre(res, 400, { erreur: 'plan', message: 'Offre inconnue.' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  if (acc === undefined || ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Rien n'a changé ; réessaie dans un instant." });
  if (acc.proprietaire) return repondre(res, 409, { erreur: 'proprietaire', message: 'Ton compte est Pro, gratuit : rien à changer.' });
  if (!corps || corps.cgv !== true) return repondre(res, 400, { erreur: 'cgv', message: "Coche « J'accepte les conditions générales de vente » avant de changer d'offre." });
  let prix;
  if (cible === PLAN_PRO) {
    const pro = await offrePro();
    if (!pro.ouvert) return repondre(res, 503, { erreur: 'pro-ferme', message: "L'offre Pro n'est pas encore ouverte : rien n'a changé, rien n'a été prélevé." });
    prix = await lirePrixPro();
    if (!prix || !prixProConforme(prix)) return repondre(res, 503, { erreur: 'pro-ferme', message: "L'offre Pro n'est pas encore ouverte : rien n'a changé, rien n'a été prélevé." });
  } else {
    prix = await lirePrix();
    if (!prix || !prixConforme(prix)) return repondre(res, 503, { erreur: 'prix-cgv', message: "Le paiement n'est pas encore ouvert : rien n'a changé." });
  }
  const sub = await abonnementStripeDe(ligne);
  if (!sub) return repondre(res, 409, { erreur: 'aucun', message: "Je ne trouve pas ton abonnement chez Stripe : rien n'a changé." });
  const lu = planDeLAbonnement(sub, optsPlan());
  if (!lu.articleId) return repondre(res, 409, { erreur: 'article', message: "Ton abonnement a une forme que je ne sais pas changer : rien n'a changé. Écris-nous." });
  if (lu.prixId === prix.id) return repondre(res, 200, { ok: true, inchange: true, plan: cible });
  const le = new Date().toISOString();
  // (13 nov., lot 56) Vers Pro (illimité) : l'article des comptes Vinted de plus part
  // (prorata) — on ne paie jamais un supplément en Pro. Leur liste est gardée dans les
  // métadonnées (revenir à Solo la retrouve, sans place payée : à racheter).
  const supId = cible === PLAN_PRO && lu.comptesSup && lu.comptesSup.articleId;
  const r = await stripeApi('POST', `subscriptions/${encodeURIComponent(sub.id)}`, {
    items: [{ id: lu.articleId, price: prix.id, quantity: 1 }, ...(supId ? [{ id: supId, deleted: true }] : [])],
    proration_behavior: 'create_prorations',
    metadata: { cgv_version: CGV_VERSION, cgv_acceptees_le: le, vrm_plan: cible, vrm_plan_change_le: le },
  }, `vrm-plan-${u.id}-${cible}-${Math.floor(Date.now() / 60000)}`);
  if (!r.ok || !r.data) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas changé ton offre : rien n'a changé, rien n'a été prélevé. Réessaie dans un instant." });
  const relu = planDeLAbonnement(r.data, optsPlan());
  return repondre(res, 200, { ok: true, plan: relu.plan || cible });
}

// ── LE PARRAINAGE (8 nov.) ──────────────────────────────────────────────────
// GET : SON lien et des NOMBRES (inscrits, payés, mois offerts) — jamais qui.
// POST { action: 'rattacher', code } : le vendeur connecté devient filleul du
// code (règles dans api/_lib/parrainage.js). Tout ce qui le concerne vient de
// SA session (jamais du corps, sauf le code lui-même).
// (13 nov., lot 54) GET `?code=XXXXXXXX` SANS session : ce que voit la personne
// qui ouvre le lien (« Offert par <nom choisi> ») — le nom seul, jamais un
// identifiant, un e-mail ni un pseudo Vinted. POST { action: 'nom', nom } : le
// parrain choisit ce nom (règle `nomAffichable`, revalidée à chaque lecture).
async function parrainage(req, res) {
  if (req.method === 'GET' && req.query && req.query.code != null) {
    if (!process.env.SUPABASE_SERVICE_KEY) return repondre(res, 200, { ok: true, ouvert: null, connu: false, nom: null });
    const a = await apercuCode(String(req.query.code));
    return repondre(res, a.ok ? 200 : 503, a.ok ? { ok: true, ouvert: a.ouvert, connu: a.connu, nom: a.nom } : { ok: false });
  }
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  if (!process.env.SUPABASE_SERVICE_KEY) return repondre(res, 200, { ok: true, installe: false });
  if (req.method === 'POST') {
    const corps = await lireCorpsJson(req);
    if (corps && corps.action === 'nom') {
      if (typeof corps.nom !== 'string' || corps.nom.length > 200) return repondre(res, 400, { ok: false, raison: 'nom' });
      const r = await poserNom(u.id, corps.nom);
      return repondre(res, r.http || (r.ok ? 200 : 400), { ok: r.ok, nom: r.ok ? r.nom : undefined, raison: r.raison, message: r.message });
    }
    if (!corps || corps.action !== 'rattacher') return repondre(res, 400, { ok: false, raison: 'action' });
    const [ligne, idsVinted] = await Promise.all([ligneDe(req), lireVintedIds(u.id)]);
    if (idsVinted === null) return repondre(res, 503, { ok: false, raison: 'pas-su', message: 'Parrainage pas vérifié. Réessaie dans un instant.' });   // (11 nov., M51)
    const essaiDeja = await essaiDejaUtilise(u.email, idsVinted);
    const r = await rattacher(corps.code, { u, ligne, idsVinted, essaiDeja });
    return repondre(res, r.http || (r.ok ? 200 : 400), { ok: r.ok, raison: r.raison, message: r.message });
  }
  const [ouvert, code, suivi, filleul, ligne, nom] = await Promise.all([parrainageOuvert(), codeDe(u.id), suiviDe(u.id), filleulDetail(u.id), ligneDe(req), nomDe(u.id)]);
  // Tables absentes (027 pas passée) ou base muette : on ne promet rien.
  if (code === undefined || suivi === undefined) return repondre(res, 200, { ok: true, installe: false, ouvert });
  // (13 nov., lot 54) L'état de CHAQUE filleul, sans identité (rang, jour d'inscription, état).
  const filleuls = await filleulsDe(u.id, ligne === undefined ? null : !!(ligne && ligne.client_stripe));
  // (11 nov.) `modeTest` : Stripe en clé de test (ou pas encore branché) — l'écran le DIT.
  return repondre(res, 200, { ok: true, installe: true, ouvert, code, suivi, filleuls: filleuls || null, nom: nom === undefined ? undefined : nom, filleul: filleul || null, moisCentimes: PRIX_CGV.centimes, modeTest: !stripePret() || stripeModeTest() });
}

// ── MES FACTURES ET MA CARTE (onglet « Mon compte », 4 octobre) ─────────────
// Julien : « un onglet pour gérer l'abonnement et les factures dans les
// paramètres, avec ses infos de compte regroupées ».
// ⚠️ Le client Stripe vient de SA ligne d'abonnement (lue avec son jeton, RLS) :
//    jamais d'un identifiant envoyé par le navigateur — sinon on lirait les
//    factures d'un autre en changeant un paramètre.
const URL_STRIPE = /^https:\/\/(pay|invoice|files|invoicedata)\.stripe\.com\//;
const lienStripe = (u) => (typeof u === 'string' && URL_STRIPE.test(u) ? u : null);
export const factureLisible = (f) => ({
  id: String(f.id || ''),
  numero: f.number || null,
  date: f.created ? new Date(f.created * 1000).toISOString() : null,
  // Le montant FACTURÉ (total), pas ce qui reste à payer : une facture payée
  // dirait sinon « 0,00 € ».
  montant: Number.isFinite(f.total) ? f.total / 100 : null,
  devise: f.currency || 'eur',
  statut: String(f.status || ''),
  pdf: lienStripe(f.invoice_pdf),
  page: lienStripe(f.hosted_invoice_url),
});
export const carteLisible = (pm) => {
  const c = pm && pm.card;
  if (!c) return null;
  return { marque: String(c.display_brand || c.brand || ''), fin: String(c.last4 || ''), mois: c.exp_month || null, annee: c.exp_year || null };
};

async function factures(req, res) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Réessaie dans un instant." });
  // Aucun client Stripe = jamais abonné : la liste est VRAIMENT vide (on le sait).
  if (!ligne || !ligne.client_stripe) return repondre(res, 200, { ok: true, factures: [], carte: null });
  const [rf, rs] = await Promise.all([
    stripeApi('GET', 'invoices', { customer: ligne.client_stripe, limit: 24 }),
    ligne.abonnement_stripe
      ? stripeApi('GET', `subscriptions/${encodeURIComponent(ligne.abonnement_stripe)}`, { 'expand[]': 'default_payment_method' })
      : Promise.resolve(null),
  ]);
  // « Pas su » ne vaut pas « aucune facture » : une lecture ratée chez Stripe
  // répond une erreur, jamais une liste vide.
  if (!rf.ok || !rf.data || !Array.isArray(rf.data.data)) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas répondu pour tes factures. Réessaie dans un instant." });
  const liste = rf.data.data
    .filter((f) => f && f.status !== 'draft' && f.customer === ligne.client_stripe)
    .map(factureLisible);
  let carte = null;
  if (rs && rs.ok && rs.data && rs.data.customer === ligne.client_stripe) carte = carteLisible(rs.data.default_payment_method);
  if (!carte) {
    // Repli : la carte par défaut du client (celle posée depuis le portail).
    const rc = await stripeApi('GET', `customers/${encodeURIComponent(ligne.client_stripe)}`, { 'expand[]': 'invoice_settings.default_payment_method' });
    if (rc.ok && rc.data && rc.data.invoice_settings) carte = carteLisible(rc.data.invoice_settings.default_payment_method);
  }
  return repondre(res, 200, { ok: true, factures: liste, carte });
}

// ── RÉSILIER / REPRENDRE, DIRECTEMENT DEPUIS L'APP ──────────────────────────
// Julien : « il peut le résilier s'il le veut ». En France, un contrat conclu
// en ligne doit pouvoir être résilié en ligne, simplement (loi du 16 août
// 2022) : on ne renvoie pas la personne chercher le bouton chez Stripe.
// La résiliation prend effet à la FIN DE LA PÉRIODE payée (le portail est réglé
// pareil : `at_period_end`, sans prorata) — l'accès reste jusque-là, et aucun
// autre prélèvement ne part. « Reprendre » annule la résiliation tant que la
// période n'est pas finie.
async function resilier(req, res, reprendre) {
  const u = await utilisateurDe(req);
  if (!u) return repondre(res, 401, { erreur: 'session' });
  if (!stripePret()) return repondre(res, 503, { erreur: 'stripe', message: "Le paiement n'est pas encore branché." });
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { erreur: 'base-injoignable', message: "Je n'ai pas pu lire ton abonnement. Réessaie dans un instant." });
  if (!ligne || !ligne.abonnement_stripe || !ligne.client_stripe) return repondre(res, 404, { erreur: 'aucun', message: "Tu n'as pas d'abonnement en cours." });
  // L'abonnement doit être CELUI de ce client, et encore vivant.
  const lu = await stripeApi('GET', `subscriptions/${encodeURIComponent(ligne.abonnement_stripe)}`);
  if (!lu.ok || !lu.data) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas répondu. Réessaie dans un instant." });
  if (lu.data.customer !== ligne.client_stripe) return repondre(res, 403, { erreur: 'pas-a-toi' });
  if (!abonnementActif(lu.data.status)) return repondre(res, 409, { erreur: 'fini', message: "Ton abonnement est déjà terminé." });
  const r = await stripeApi('POST', `subscriptions/${encodeURIComponent(ligne.abonnement_stripe)}`,
    { cancel_at_period_end: reprendre ? 'false' : 'true' },
    `vrm-${reprendre ? 'rep' : 'res'}-${u.id}-${Math.floor(Date.now() / 60000)}`);
  if (!r.ok || !r.data || !r.data.id) return repondre(res, 502, { erreur: 'stripe', message: "Stripe n'a pas pu enregistrer ton choix. Réessaie dans un instant." });
  // Le webhook mettra la ligne à jour ; on l'écrit aussi tout de suite, depuis
  // la réponse de Stripe elle-même, pour que l'écran rouvert dise juste. Une
  // écriture ratée ici n'est pas grave : le webhook la refera.
  await ecrireStatut(u.id, ligneDeLAbonnement(r.data, !!r.data.livemode), Math.floor(Date.now() / 1000)).catch(() => {});
  const l = ligneDeLAbonnement(r.data, !!r.data.livemode);
  return repondre(res, 200, { ok: true, annuleFinPeriode: l.annule_fin_periode, finPeriode: l.fin_periode });
}

// ── UNE SESSION À ELLE POUR L'EXTENSION (« session fourchée », 5 octobre) ───
// ⚠️ POURQUOI : l'app passait à l'extension SA PROPRE session (jeton d'accès ET
//    jeton de renouvellement). Les deux renouvelaient donc la MÊME famille de
//    jetons. Or Supabase fait tourner le jeton de renouvellement : chaque
//    renouvellement consomme l'ancien. Celle des deux qui renouvelle en second
//    présente un jeton déjà consommé → refusé (`refresh_token_already_used`) :
//    elle est déconnectée et réessaie — les journaux d'auth de la production
//    montrent ces refus et des rafales de 429 ; selon la configuration, Supabase
//    révoque en plus la famille entière (il croit à un vol de jeton), et l'app
//    tombe avec elle. Mesuré sur un GoTrue v2.197 local : après deux rotations,
//    l'ancien jeton est bien refusé avec cette erreur-là.
// ⇒ L'extension reçoit une session INDÉPENDANTE, fabriquée ici pour le MÊME
//    vendeur : un lien magique généré côté serveur (`admin/generate_link`,
//    AUCUN email envoyé), aussitôt échangé (`verify`) contre une session neuve
//    — autre `session_id`, autre famille. Chacune renouvelle la sienne ; la
//    révocation de l'une ne touche pas l'autre (prouvé : audit
//    `scripts/audit-session-extension.cjs --local`).
//
// ⚠️ QUI : la session de l'appelant, vérifiée par Supabase (vendeurExige). Son
//    ADRESSE vient de la réponse de Supabase sur ce jeton (/auth/v1/user) —
//    JAMAIS du corps ni de l'adresse de la requête (le corps n'est même pas lu) :
//    sinon on fabriquerait la session de n'importe qui en tapant son email.
//    Et on vérifie deux fois que la session fabriquée est bien à LUI (le lien
//    généré, puis la session rendue) : un écart ⇒ refus, aucun jeton rendu.
// ⚠️ CE QUE ÇA N'OUVRE PAS : une faille XSS dans l'app lirait déjà le jeton de
//    renouvellement de l'app dans le stockage du navigateur — cette route ne
//    donne donc aucun pouvoir de plus à qui détient déjà une session. La
//    connexion propre de l'extension (sa fenêtre, email + mot de passe VRM)
//    reste disponible : ceci n'en est que le raccourci.
// ⚠️ CE QUI NE SORT JAMAIS : `hashed_token`, `email_otp`, `action_link` (de quoi
//    ouvrir une session à volonté) ni le reste de la fiche Supabase. On rend
//    cinq champs, construits ici, et aucun secret n'est écrit dans les journaux.
// ⚠️ Effet de bord, mesuré sur le GoTrue local : générer un lien magique
//    invalide un lien de réinitialisation de mot de passe encore en attente pour
//    ce compte (`otp_expired` : Supabase n'en garde qu'un). Sans conséquence pour
//    quelqu'un déjà connecté — il n'a qu'à redemander le sien.
const FORK_DELAI = 5000;            // chaque appel à Supabase, au plus 5 s
// (12 nov., M54) Le frein (6 sessions par vendeur et par heure) vit EN BASE
// (`ext_fork_frein`, comparer-et-échanger) : plusieurs instances Vercel ne le
// multiplient plus. Base muette ⇒ le frein en mémoire d'avant (api/_lib/frein-fork.js).

// Un appel à l'authentification de Supabase. Rend l'objet JSON, ou `null` si
// Supabase a refusé, n'a pas répondu à temps ou a rendu autre chose que du JSON.
// ⚠️ Le corps de la réponse n'est JAMAIS journalisé (il porte des secrets).
async function appelAuth(chemin, entetes, corps) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/auth/v1/${chemin}`, {
      method: 'POST',
      headers: { ...entetes, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(FORK_DELAI),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// Une session fabriquée qu'on ne rend pas ne doit pas rester vivante : on la
// ferme (au mieux — un échec ici ne change rien à la réponse, déjà un refus).
async function fermerSession(jeton) {
  if (typeof jeton !== 'string' || jeton.split('.').length !== 3) return;
  try {
    await fetchAvecDelai(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jeton}` }, signal: AbortSignal.timeout(FORK_DELAI),
    });
  } catch (_) {}
}

const REESSAIE = "Je n'ai pas pu préparer la connexion de l'extension. Réessaie dans un instant.";

// ── APPAREILS CONNECTÉS / JOURNAL (4 nov., api/_lib/securite-compte.js) ─────
// L'identifiant vient du JETON vérifié par Supabase (`vendeurExige`), jamais
// de la requête : un vendeur ne voit, ni ne ferme, que SES sessions.
async function appareils(req, res) {
  const u = await vendeurExige(req, res);
  if (!u) return;
  let corps = {};
  if (req.method === 'POST') {
    corps = await lireCorpsJson(req);
    if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return repondre(res, 400, { erreur: 'corps-invalide' });
  }
  // (10 nov., lot H) « Nouvel appareil » : l'app le demande à chaque ouverture (api/_lib/appareil-nouveau.js).
  if (req.method === 'POST' && corps.action === 'verifier') {
    const v = await verifierNouvelAppareil({ base: SUPABASE_URL, cle: process.env.SUPABASE_SERVICE_KEY || '', user: u, pousser: (notif) => contexteVendeur.run({ owner: u.id }, () => sendPushToAll(notif)) });
    return repondre(res, v.status, v.body);
  }
  const r = await traiterAppareils({ base: SUPABASE_URL, cle: process.env.SUPABASE_SERVICE_KEY || '', user: u, jeton: jetonDe(req), methode: req.method, corps });
  return repondre(res, r.status, r.body);
}
// (10 nov., lot H) « Échéances dans l'agenda » (api/_lib/agenda-ics.js) : le calendrier
// par le jeton seul (`f`, réécrit depuis /agenda/<jeton>.ics), le réglage sur SA session.
async function agenda(req, res) {
  const fichier = req.query && req.query.f != null ? String(req.query.f) : null;
  let user = null, corps = null;
  if (fichier == null) {
    user = await vendeurExige(req, res);
    if (!user) return;
    if (req.method === 'POST') {
      corps = await lireCorpsJson(req);
      if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return repondre(res, 400, { erreur: 'corps-invalide' });
    }
  }
  const r = await traiterAgenda({ base: SUPABASE_URL, cle: process.env.SUPABASE_SERVICE_KEY || '', methode: req.method, fichier, user, corps, acces: accesVendeur });
  if (r.type === 'json') return repondre(res, r.status, r.body);
  res.statusCode = r.status;
  res.setHeader('Content-Type', r.type === 'ics' ? 'text/calendar; charset=utf-8' : 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  if (r.type === 'ics') res.setHeader('Content-Disposition', 'inline; filename="vrm-echeances.ics"');
  res.end(r.body);
}
// (14 nov., lot messages-achats-plus, n° 110) LE CATALOGUE PRIVÉ (api/_lib/catalogue-prive.js) :
//   GET  ?j=<jeton> (sans session)  ⇒ la page en lecture seule (HTML, aucun script) ;
//   GET  + session                  ⇒ ses liens ; POST + session { action: 'creer' | 'revoquer' }.
async function catalogue(req, res) {
  const jeton = req.query && req.query.j != null ? String(req.query.j) : null;
  let user = null, corps = null;
  if (jeton == null) {
    user = await vendeurExige(req, res);
    if (!user) return;
    if (req.method === 'POST') {
      corps = await lireCorpsJson(req);
      if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return repondre(res, 400, { erreur: 'corps-invalide' });
    }
  }
  const r = await traiterCatalogue({ base: SUPABASE_URL, cle: process.env.SUPABASE_SERVICE_KEY || '', methode: req.method, jeton, user, corps,
    lireVendeur: (c) => lireCommeVendeur(req, c), acces: accesVendeur, langue: langueVisiteur(req.headers && req.headers['accept-language']) });
  if (r.type === 'json') return repondre(res, r.status, r.body);
  res.statusCode = r.status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', CSP_CATALOGUE);
  res.end(r.body);
}
async function journalVrm(req, res) {
  const u = await vendeurExige(req, res);
  if (!u) return;
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  const lireService = SERVICE ? async (chemin) => {
    try { const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${chemin}`, { headers: sbCle(SERVICE), signal: AbortSignal.timeout(12000) }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? j : null; } catch (_) { return null; }
  } : null;
  const j = await lireJournal({ userId: u.id, lireVendeur: (c) => lireCommeVendeur(req, c), lireService, neutre: PROPRIETAIRE_NEUTRE });
  return repondre(res, 200, { ok: true, ...j });
}

async function sessionExtension(req, res) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  // Sans clé de service, impossible de fabriquer quoi que ce soit : on le dit
  // tout de suite, sans aucun appel.
  if (!SERVICE) return repondre(res, 503, { erreur: 'non-configure', message: "La connexion automatique de l'extension n'est pas encore branchée sur le serveur. Connecte-toi depuis la fenêtre de l'extension." });
  const u = await vendeurExige(req, res);   // 401 déjà répondu, aucun appel d'administration
  if (!u) return;
  // L'adresse vient de Supabase (la fiche de CE jeton), jamais de la requête.
  const email = String(u.email || '').trim();
  if (!email) return repondre(res, 409, { erreur: 'sans-email', message: "Ton compte VRM n'a pas d'adresse email : connecte l'extension depuis sa fenêtre." });
  if (!u.emailConfirme) return repondre(res, 409, { erreur: 'email-non-confirme', message: "Ton adresse email n'est pas encore confirmée : clique le lien reçu par email, puis réessaie." });
  const attente = await freinFork({ uid: u.id, url: SUPABASE_URL, entetes: sbCle(SERVICE) });
  if (attente) {
    res.setHeader('Retry-After', String(attente));
    return repondre(res, 429, { erreur: 'trop-souvent', message: "L'extension a demandé sa connexion trop souvent. Réessaie dans un moment." });
  }

  // 1) Le lien magique, généré côté serveur — aucun email ne part.
  const lien = await appelAuth('admin/generate_link', sbCle(SERVICE), { type: 'magiclink', email });
  const idLien = String((lien && (lien.id || (lien.user && lien.user.id))) || '');
  const hache = lien && typeof lien.hashed_token === 'string' ? lien.hashed_token : '';
  // ⚠️ `magiclink` seulement : `signup` voudrait dire que Supabase vient de
  //    CRÉER un compte pour cette adresse — ce n'est plus la personne connectée.
  if (!lien || !hache || lien.verification_type !== 'magiclink') return repondre(res, 502, { erreur: 'auth', message: REESSAIE });
  if (idLien !== u.id) { console.warn('[session-extension] lien généré pour un autre compte — refusé'); return repondre(res, 502, { erreur: 'identite', message: REESSAIE }); }

  // 2) Échangé aussitôt contre une session NEUVE (clé publique, comme le
  //    navigateur le ferait en cliquant le lien).
  const v = await appelAuth('verify', sbCle(ANON), { type: 'magiclink', token_hash: hache });
  if (!v) return repondre(res, 502, { erreur: 'auth', message: REESSAIE });
  const acces = typeof v.access_token === 'string' ? v.access_token : '';
  const renouv = typeof v.refresh_token === 'string' ? v.refresh_token : '';
  const duree = Number(v.expires_in);
  const idSession = String((v.user && v.user.id) || '');
  if (idSession !== u.id) {
    console.warn('[session-extension] session fabriquée pour un autre compte — refusée et fermée');
    await fermerSession(acces);
    return repondre(res, 502, { erreur: 'identite', message: REESSAIE });
  }
  if (acces.split('.').length !== 3 || !renouv || !(duree > 0)) {
    await fermerSession(acces);
    return repondre(res, 502, { erreur: 'auth', message: REESSAIE });
  }
  // Cinq champs, construits ici — rien d'autre de la réponse de Supabase.
  return repondre(res, 200, {
    ok: true,
    session: {
      access_token: acces,
      refresh_token: renouv,
      // En millisecondes, comme `sessionFrom` dans l'app.
      expires_at: Date.now() + duree * 1000,
      user_id: u.id,
      email,
    },
  });
}

// ── (14 nov., lot 119) SE CONNECTER EN SCANNANT UN QR (api/_lib/qr-connexion.js) ──
// L'ordinateur demande un ticket signé, l'iPhone CONNECTÉ l'approuve (son clic,
// sa session, `aal2` si double vérification), l'ordinateur récupère une session
// NEUVE fabriquée ici par la voie de Supabase (lien magique d'administration
// aussitôt échangé, comme `session-extension`) — jamais le jeton de l'iPhone.
async function utilisateurAvecFacteurs(jeton) {
  if (!jeton || jeton.split('.').length !== 3 || jeton.length > 4096) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/auth/v1/user`, { signal: AbortSignal.timeout(10000), headers: { apikey: ANON, Authorization: `Bearer ${jeton}` } });
    if (!r.ok) return (r.status >= 500 || r.status === 429) ? undefined : null;
    const j = await r.json();
    const id = String((j && j.id) || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { id, email: String((j && j.email) || ''), emailConfirme: !!(j && j.email_confirmed_at), factors: Array.isArray(j && j.factors) ? j.factors : [] };
  } catch (_) { return undefined; }
}
async function sessionNeuvePour(uid, email) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE || !email) return null;
  const lien = await appelAuth('admin/generate_link', sbCle(SERVICE), { type: 'magiclink', email });
  const hache = lien && typeof lien.hashed_token === 'string' ? lien.hashed_token : '';
  if (!lien || !hache || lien.verification_type !== 'magiclink') return null;
  if (String(lien.id || (lien.user && lien.user.id) || '') !== uid) return null;
  const v = await appelAuth('verify', sbCle(ANON), { type: 'magiclink', token_hash: hache });
  if (!v) return null;
  const acces = typeof v.access_token === 'string' ? v.access_token : '';
  if (!v.user || String(v.user.id || '') !== uid || acces.split('.').length !== 3 || typeof v.refresh_token !== 'string') { await fermerSession(acces); return null; }
  // Les seuls champs utiles à l'app (`sessionFrom`) : les facteurs TOTP pour la porte du code.
  const factors = (Array.isArray(v.user.factors) ? v.user.factors : []).filter((f) => f && f.factor_type === 'totp').map((f) => ({ id: f.id, factor_type: f.factor_type, status: f.status, friendly_name: f.friendly_name || '', created_at: f.created_at || '' }));
  return { access_token: acces, refresh_token: v.refresh_token, expires_in: Number(v.expires_in) || 3600, user: { id: uid, email: String(v.user.email || email), factors } };
}
async function qrConnexion(req, res) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return repondre(res, 503, { erreur: 'non-configure' });
  const corps = await lireCorpsJson(req);
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return repondre(res, 400, { erreur: 'corps-invalide' });
  const r = await routeQrConnexion({
    corps, jeton: jetonDe(req), cle: cleSignature('QR_CONNEXION_SECRET'),
    depot: depotPostgrest({ url: SUPABASE_URL, entetes: sbCle(SERVICE), owner: PROPRIETAIRE_NEUTRE, fetcher: fetchAvecDelai }),
    auth: { utilisateur: utilisateurAvecFacteurs, session: sessionNeuvePour },
  });
  res.setHeader('Cache-Control', 'no-store');
  return repondre(res, r.status, r.body);
}
// ── (14 nov., lot 120) LE LIEN TEMPORAIRE POUR L'AIDE (api/_lib/lien-aide.js) ──
// Public en LECTURE (`?t=`) : la photo filtrée de ses colis, un bordereau de la
// liste ; le vendeur crée / rafraîchit / coupe ses liens avec SA session.
async function lienAide(req, res) {
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return repondre(res, 503, { erreur: 'non-configure' });
  let corps = {};
  if (req.method === 'POST') {
    corps = await lireCorpsJson(req);
    if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return repondre(res, 400, { erreur: 'corps-invalide' });
  }
  const r = await routeLienAide({
    methode: req.method, query: req.query || {}, corps, jeton: jetonDe(req), ua: String((req.headers && req.headers['user-agent']) || ''),
    cle: cleSignature('LIEN_AIDE_SECRET'),
    depot: depotLienAide({ url: SUPABASE_URL, entetes: sbCle(SERVICE), fetcher: fetchAvecDelai }),
    auth: { utilisateur: async (j) => (j ? utilisateurAvecFacteurs(j) : null) },
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (r.pdf) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="bordereau.pdf"');
    return res.end(Buffer.from(r.pdf, 'base64'));
  }
  return repondre(res, r.status, r.body);
}

// ── FERMER MON COMPTE (5 octobre) ────────────────────────────────────────────
// La politique de confidentialité promet l'effacement (« supprimées dans un
// délai de 30 jours après la clôture du compte ») — et aucun bouton ne le
// faisait : il fallait écrire à une adresse qui n'existe pas encore.
//
// ⚠️ MESURÉ SUR LA VRAIE BASE LE 5 OCTOBRE, AVANT D'ÉCRIRE : `app_data.owner`
//    et `vinted_accounts.owner` n'ont AUCUNE clé étrangère vers auth.users
//    (seule `abonnements` en a une, ON DELETE CASCADE). La migration 001 en
//    prévoyait une ; elle n'est pas en place. Supprimer l'utilisateur ne
//    supprimerait donc RIEN de ses données : on les efface nous-mêmes, une
//    table à la fois, AVANT l'utilisateur.
//
// ⚠️ CE QUI EST TOUCHÉ : uniquement les lignes `owner = <celui de la session>`.
//    L'identifiant vient de Supabase (le jeton), jamais du corps de la requête ;
//    il est vérifié comme un UUID ; chaque suppression porte `owner=eq.<lui>`
//    et RIEN d'autre (`scripts/audit-fermer-compte.cjs` sert deux vendeurs et
//    exige que l'autre reste intact).
// ⚠️ REFUSÉ AU PROPRIÉTAIRE DE L'INSTALLATION (VRM_OWNER_UID, ou ce que dit la
//    base) : c'est sa boutique — un clic de travers l'effacerait. « Pas su »
//    s'il est le propriétaire ⇒ refus aussi.
// ⚠️ L'ORDRE COMPTE, ET IL EST CHOISI POUR QU'UN ÉCHEC SE RATTRAPE :
//    1. l'abonnement s'arrête D'ABORD — on n'efface jamais un compte qui serait
//       encore prélevé. Résilié à la FIN de la période payée (comme « Résilier »,
//       aucun nouveau prélèvement) ; en IMPAYÉ, arrêté tout de suite (sinon
//       Stripe continuerait de retenter la carte d'un compte fermé).
//       Stripe muet ⇒ RIEN n'est effacé ;
//    2. ses sessions sont fermées (l'extension ne pourra plus renouveler la
//       sienne, donc plus rien écrire au-delà de l'heure de son jeton) ;
//    3. ses données, puis ses comptes Vinted (et leurs jetons), ses compteurs ;
//    4. son cache de photos détourées ;
//    5. EN DERNIER, son compte de connexion : tant qu'il existe, il peut se
//       reconnecter et relancer la fermeture si une étape a raté.
//    La réponse dit ce qui a été fait et ce qui ne l'a pas été — jamais
//    « compte fermé » si une seule étape a échoué.
// ⚠️ LIMITE CONNUE, DITE : un jeton d'accès déjà délivré reste valable jusqu'à
//    son expiration (≈ 1 h). Une extension encore installée peut donc écrire
//    une capture dans l'heure qui suit — d'où le conseil, à l'écran, de la
//    retirer de Chrome. Les copies de sauvegarde techniques (schéma
//    `sauvegarde`) ne sont pas touchées ici : la politique les autorise 90 jours.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function lireCorpsJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const b = await corpsBrut(req);
  if (!b || !b.length) return {};
  try { return JSON.parse(b.toString('utf8')); } catch (_) { return null; }
}

// (9 nov.) `effacer` et `viderCacheDetourage` vivent dans api/_lib/effacer-compte.js.

// Ferme TOUTES ses sessions (app, extension, autres appareils).
async function fermerSessions(req) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jetonDe(req)}` } });
    return r.ok;
  } catch (_) { return false; }
}

const NON_TOUCHE = "Rien n'a été effacé.";
const nb = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const PROPRIO_REFUS = "Ce compte est celui du propriétaire de VRM : le supprimer effacerait toute la boutique. C'est désactivé exprès.";


// ── Discord déjà affiché sur un AUTRE compte VRM (30 octobre) ────────────────
// Julien avait relié Discord à son compte pour la carte (pseudo vérifié, ligne
// `vrm_discord`), puis « Se connecter avec Discord » a créé un compte neuf : la
// ligne de la carte n'est pas une méthode de connexion. Ici, le compte neuf
// demande si SON Discord (prouvé : il vient de s'y connecter) est celui qu'un
// autre compte VRM a vérifié — identité : l'identifiant Discord dans l'adresse
// de l'avatar, sinon le pseudo (unique chez Discord). Rend l'email MASQUÉ de ce
// compte, jamais rien d'autre. Pas su ⇒ { trouve: null }.
const masquerEmail = (e) => { const [l, d] = String(e || '').split('@'); if (!l || !d) return ''; return `${l.slice(0, 2)}•••@${d}`; };
async function discordDeja(req, res) {
  const jeton = jetonDe(req);
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!jeton || !SERVICE) return repondre(res, 200, { trouve: null });
  try {
    const ru = await fetchAvecDelai(`${SUPABASE_URL}/auth/v1/user`, { signal: AbortSignal.timeout(8000), headers: { apikey: ANON, Authorization: `Bearer ${jeton}` } });
    if (!ru.ok) return repondre(res, ru.status === 401 ? 401 : 200, { trouve: null });
    const u = await ru.json();
    const ident = (Array.isArray(u && u.identities) ? u.identities : []).find(i => i && i.provider === 'discord');
    if (!ident) return repondre(res, 200, { trouve: false });
    const did = String((ident.identity_data && (ident.identity_data.provider_id || ident.identity_data.sub)) || ident.id || '');
    const pseudo = String((ident.identity_data && (ident.identity_data.name || ident.identity_data.full_name)) || '').replace(/#0$/, '').toLowerCase();
    const h = sbCle(SERVICE);
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_discord&data->>verifie=eq.true&select=owner,discord:data->>discord,avatar:data->>avatar,pid:data->>pid,signatureAvatar:data->>signatureAvatar&limit=1000`, { headers: h, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return repondre(res, 200, { trouve: null });
    const rows = await r.json();
    if (!Array.isArray(rows)) return repondre(res, 200, { trouve: null });
    // (11 nov., revue de sécurité) La ligne `vrm_discord` peut être écrite par le
    // navigateur (RLS) : seule une ligne SIGNÉE par le serveur (signature de
    // l'avatar : propriétaire + pseudo + photo, api/_lib/avatar-discord.js) fait
    // foi — sinon n'importe qui « portait » le Discord d'un autre.
    const meme = rows.find(x => x && x.owner !== u.id && avatarPublicVerifie(x.owner, x) && ((/^\d{5,25}$/.test(did) && String(x.avatar || '').includes(`/avatars/${did}/`)) || (pseudo && String(x.discord || '').toLowerCase() === pseudo)));
    if (!meme) return repondre(res, 200, { trouve: false });
    const ra = await fetchAvecDelai(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(meme.owner)}`, { headers: h, signal: AbortSignal.timeout(8000) });
    const a = ra.ok ? await ra.json() : null;
    const email = masquerEmail(a && a.email);
    if (!email) return repondre(res, 200, { trouve: null });
    return repondre(res, 200, { trouve: true, email, pseudo: String(meme.discord || '') });
  } catch (_) { return repondre(res, 200, { trouve: null }); }
}

// ── SUPPRIMER MON COMPTE (9 novembre, RGPD art. 17) ─────────────────────────
// `?mode=supprimer` (et l'ancien `?mode=fermer`, même fonction, même exigence) :
//   GET  ce qui SERA effacé et gardé (l'inventaire), sans rien toucher ;
//   POST la suppression, sur confirmation FORTE vérifiée ici
//        (api/_lib/suppression-compte.js : « SUPPRIMER » + mot de passe, ou
//        connexion de moins de 10 minutes).
// Les gardes, dans l'ordre (chacune refuse sans rien toucher) : session prouvée
// par Supabase · identifiant UUID, jamais le neutre · clé de service · jamais le
// propriétaire de l'installation (VRM_OWNER_UID, ce que dit `vrm_acces`, ET ce
// que dit `vrm_reglages` — « pas su » ⇒ refus) · confirmation · inventaire
// (une lecture ratée ⇒ rien) · l'abonnement arrêté chez Stripe (muet ⇒ rien).
// L'effacement : `effacerCompte` (api/_lib/effacer-compte.js), la MÊME fonction
// que le départ des clients partis.
async function gardesSuppression(req, res) {
  const u = await utilisateurDe(req);
  if (u === undefined) { repondre(res, 503, { erreur: 'session-pas-su', message: `Le service de connexion ne répond pas. ${NON_TOUCHE} Réessaie dans un instant.` }); return null; }
  if (!u) { repondre(res, 401, { erreur: 'session', message: `Connecte-toi à VRM pour supprimer ton compte. ${NON_TOUCHE}` }); return null; }
  if (!UUID_RE.test(u.id) || u.id === PROPRIETAIRE_NEUTRE) { repondre(res, 400, { erreur: 'identite', message: NON_TOUCHE }); return null; }
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) { repondre(res, 503, { erreur: 'non-configure', message: `La suppression de compte n'est pas encore branchée sur le serveur. ${NON_TOUCHE}` }); return null; }
  const env = String(process.env.VRM_OWNER_UID || '').trim().toLowerCase();
  if (env && env === u.id.toLowerCase()) { repondre(res, 403, { erreur: 'proprietaire', proprietaire: true, message: PROPRIO_REFUS }); return null; }
  const acc = await accesDe(req);
  if (acc === undefined) { repondre(res, 503, { erreur: 'base-injoignable', message: `Je n'ai pas pu vérifier ton compte. ${NON_TOUCHE} Réessaie dans un instant.` }); return null; }
  if (acc.proprietaire) { repondre(res, 403, { erreur: 'proprietaire', proprietaire: true, message: PROPRIO_REFUS }); return null; }
  const proprio = await lireProprietaire({ url: SUPABASE_URL, service: SERVICE });
  if (proprio === undefined) { repondre(res, 503, { erreur: 'base-injoignable', message: `Je n'ai pas pu vérifier ton compte. ${NON_TOUCHE} Réessaie dans un instant.` }); return null; }
  if (proprio && proprio === u.id.toLowerCase()) { repondre(res, 403, { erreur: 'proprietaire', proprietaire: true, message: PROPRIO_REFUS }); return null; }
  return { u, SERVICE, proprio };
}

async function apercuSuppression(req, res) {
  const g = await gardesSuppression(req, res);
  if (!g) return;
  const inv = await inventaire({ url: SUPABASE_URL, service: g.SERVICE, owner: g.u.id, proprio: g.proprio });
  if (!inv) return repondre(res, 503, { erreur: 'inventaire', message: "Je n'ai pas pu compter tes données. Réessaie dans un instant." });
  const [ligne, prevue] = await Promise.all([ligneDe(req), lirePrevue({ url: SUPABASE_URL, service: g.SERVICE, owner: g.u.id })]);
  return repondre(res, 200, { ok: true, proprietaire: false, nombres: inv,
    // (13 nov., lot 51) La suppression déjà demandée : `null` aucune · la demande · `prevueSu:false` pas su.
    prevue: prevue || null, prevueSu: prevue !== undefined, graceJours: DELAI_GRACE_JOURS, vide: compteVide(inv, ligne),
    abonnement: ligne === undefined ? null : { actif: !!(ligne && abonnementActif(ligne.statut)), resilie: !!(ligne && ligne.annule_fin_periode), fin: (ligne && ligne.fin_periode) || null },
    fenetreMinutes: FENETRE_RECENTE_MS / 60000, mot: MOT_CONFIRMATION });
}

// ── (12 nov.) « TÉLÉCHARGER TOUTES MES DONNÉES » (RGPD art. 15 et 20) ────────
// Une page à la fois (`suite`), pour le compte de SA session seulement : la règle
// et ce qui part sont dans api/_lib/export-rgpd.js. Ouvert avec ou sans
// abonnement (ce n'est pas utiliser VRM, c'est repartir avec ses données).
async function mesDonnees(req, res) {
  const u = await utilisateurDe(req);
  if (u === undefined) return repondre(res, 503, { ok: false, erreur: 'pas-su', message: 'Connexion pas vérifiée. Réessaie dans un instant.' });
  if (!u) return repondre(res, 401, { ok: false, erreur: 'session' });
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  const proprio = SERVICE ? await lireProprietaire({ url: SUPABASE_URL, service: SERVICE }) : '';
  if (proprio === undefined) return repondre(res, 503, { ok: false, erreur: 'pas-su', message: "Je n'ai pas pu tout lire. Relance l'export dans un instant." });
  const r = await pageExport({ utilisateur: u, curseur: String((req.query && req.query.suite) || ''), url: SUPABASE_URL, service: SERVICE, proprio: proprio === u.id ? '' : proprio });
  return repondre(res, r.code, r.corps);
}

// (13 nov., lot 51) La phrase d'une suppression PRÉVUE (la route la donne, l'écran l'affiche telle quelle).
function phrasePrevue(p, abonnement) {
  const quand = jourLong(Date.parse(p.effaceLe));
  const abo = abonnement === 'resilie' || abonnement === 'deja-resilie' ? ' Ton abonnement est résilié : aucun nouveau prélèvement.'
    : abonnement === 'arrete' ? ' Ton abonnement est arrêté.' : '';
  return abonnement === 'deja'
    ? `Ta suppression est déjà prévue le ${quand}. D'ici là, rien n'est effacé et tu peux l'annuler.`
    : `C'est noté : ton compte sera supprimé le ${quand}. D'ici là, rien n'est effacé et tu peux annuler.${abo}`;
}

// `?mode=suppression-prevue` (GET, session) : la demande en cours, pour le bandeau
// de la coque. `null` aucune ; 503 pas su (jamais « aucune » sur une lecture ratée).
async function suppressionPrevue(req, res) {
  const u = await utilisateurDe(req);
  if (u === undefined) return repondre(res, 503, { ok: false, erreur: 'session-pas-su' });
  if (!u) return repondre(res, 401, { ok: false, erreur: 'session' });
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE || !UUID_RE.test(u.id) || u.id === PROPRIETAIRE_NEUTRE) return repondre(res, 200, { ok: true, prevue: null });   // sans clé, aucune demande n'a pu être posée
  const p = await lirePrevue({ url: SUPABASE_URL, service: SERVICE, owner: u.id });
  if (p === undefined) return repondre(res, 503, { ok: false, erreur: 'pas-su' });
  return repondre(res, 200, { ok: true, prevue: p || null });
}

// `?mode=supprimer-annuler` (POST, session) : annuler SA demande. Annuler ne
// détruit rien : sa session suffit. L'abonnement que la demande avait résilié est
// repris (Stripe relu) — sinon c'est DIT, avec le geste.
async function annulerSuppression(req, res) {
  const u = await utilisateurDe(req);
  if (u === undefined) return repondre(res, 503, { ok: false, erreur: 'session-pas-su', message: 'Le service de connexion ne répond pas. Réessaie dans un instant.' });
  if (!u) return repondre(res, 401, { ok: false, erreur: 'session', message: 'Connecte-toi à VRM pour annuler la suppression.' });
  if (!UUID_RE.test(u.id) || u.id === PROPRIETAIRE_NEUTRE) return repondre(res, 400, { ok: false, erreur: 'identite' });
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return repondre(res, 200, { ok: true, annule: false, rien: true, message: "Aucune suppression n'était prévue : ton compte est là." });
  const p = await lirePrevue({ url: SUPABASE_URL, service: SERVICE, owner: u.id });
  if (p === undefined) return repondre(res, 503, { ok: false, erreur: 'pas-su', message: "Je n'ai pas pu lire ta demande : rien n'a changé. Réessaie dans un instant." });
  if (!p) return repondre(res, 200, { ok: true, annule: false, rien: true, message: "Aucune suppression n'était prévue : ton compte est là." });
  const n = await retirerPrevue({ url: SUPABASE_URL, service: SERVICE, owner: u.id });
  if (n === null) return repondre(res, 503, { ok: false, erreur: 'retrait', message: `La suppression n'est PAS annulée (le serveur n'a pas répondu) : elle est toujours prévue le ${jourLong(Date.parse(p.effaceLe))}. Réessaie dans un instant.` });
  let abonnement = 'rien';
  if (p.abonnement === 'resilie') {
    const ligne = await ligneDe(req);
    const r = ligne === undefined ? { etat: 'pas-su' } : await reprendreAbonnement({ ligne, owner: u.id, stripe: stripeApi, pret: stripePret });
    abonnement = r.etat;
    if (r.sub) await ecrireStatut(u.id, ligneDeLAbonnement(r.sub, !!r.sub.livemode), Math.floor(Date.now() / 1000)).catch(() => {});
  }
  const abo = abonnement === 'repris' ? ' Ton abonnement continue comme avant.'
    : abonnement === 'pas-su' ? ' Ton abonnement reste résilié pour la fin de la période : reprends-le dans Paramètres → Abonnement.'
    : abonnement === 'fini' ? ' Ton abonnement est terminé : tu peux te réabonner dans Paramètres → Abonnement.' : '';
  return repondre(res, 200, { ok: true, annule: true, abonnement, message: `Suppression annulée : ton compte et tes données restent.${abo}` });
}

async function supprimerCompte(req, res) {
  const g = await gardesSuppression(req, res);
  if (!g) return;
  const { u, SERVICE, proprio } = g;
  // La confirmation est vérifiée ICI, pas seulement à l'écran.
  const corps = await lireCorpsJson(req);
  const conf = await verifierConfirmation({ corps, utilisateur: u, jeton: jetonDe(req),
    verifier: (email, mdp) => verifierMotDePasse({ url: SUPABASE_URL, anon: ANON, email, motDePasse: mdp, id: u.id }) });
  if (!conf.ok) return repondre(res, conf.code, { ok: false, erreur: conf.erreur, message: conf.message });
  // (13 nov., lot 51) Déjà demandée : la même date (jamais repoussée, jamais avancée).
  const deja = await lirePrevue({ url: SUPABASE_URL, service: SERVICE, owner: u.id });
  if (deja === undefined) return repondre(res, 503, { ok: false, erreur: 'prevue-pas-su', message: `Je n'ai pas pu lire l'état de ton compte. ${NON_TOUCHE} Réessaie dans un instant.` });
  if (deja) return repondre(res, 200, { ok: true, deja: true, prevue: deja, message: phrasePrevue(deja, 'deja') });
  // L'inventaire : une lecture ratée ⇒ rien n'est effacé.
  const inv = await inventaire({ url: SUPABASE_URL, service: SERVICE, owner: u.id, proprio });
  if (!inv) return repondre(res, 503, { ok: false, erreur: 'inventaire', message: `Je n'ai pas pu compter tes données. ${NON_TOUCHE} Réessaie dans un instant.` });

  // 1) L'abonnement, d'abord : on n'efface jamais un compte encore prélevé,
  //    et une demande de suppression ne prélève plus (résilié, réversible).
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { ok: false, erreur: 'base-injoignable', message: `Je n'ai pas pu lire ton abonnement. ${NON_TOUCHE} Réessaie dans un instant.` });
  const etapes = { abonnement: 'aucun', confirmation: conf.par };
  const arret = await arreterAbonnement({ ligne, owner: u.id, stripe: stripeApi, pret: stripePret });
  if (!arret.ok) return repondre(res, arret.code, { ok: false, erreur: arret.erreur, message: arret.erreur === 'pas-a-toi' ? NON_TOUCHE : `Je n'ai pas pu arrêter ton abonnement chez Stripe. ${NON_TOUCHE} Réessaie dans un instant.` });
  etapes.abonnement = arret.etape;

  // (13 nov., lot 51) 30 JOURS DE GRÂCE : la demande est posée (ligne neutre),
  // RIEN n'est effacé ; le cron du matin efface à l'échéance
  // (api/_lib/suppression-differee.js). Seul un compte VIDE part tout de suite.
  if (!compteVide(inv, ligne)) {
    const p = await poserPrevue({ url: SUPABASE_URL, service: SERVICE, owner: u.id, abonnement: arret.etape });
    if (!p) {
      const abo = arret.etape === 'resilie' ? " Ton abonnement est résilié pour la fin de la période : tu peux le reprendre dans Paramètres → Abonnement." : '';
      return repondre(res, 503, { ok: false, erreur: 'prevue', etapes, message: `Ta demande n'est pas enregistrée. ${NON_TOUCHE}${abo} Réessaie dans un instant.` });
    }
    etapes.email = 'non-envoye';
    if (u.email && u.emailConfirme) {
      const cfg = configurationRelances();
      if (cfg.pret) {
        try {
          try { await lireMentions(); } catch (_) {}
          const m = mailDemande({ effaceLe: p.effaceLe, contact: contactEmail() });
          const v = await envoyerSmtp({ hote: process.env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: process.env.RELANCES_SMTP_UTILISATEUR, motDePasse: process.env.RELANCES_SMTP_MOT_DE_PASSE,
            de: process.env.RELANCES_EXPEDITEUR, nomDe: 'VRM', a: u.email, sujet: m.sujet, texte: m.texte, html: m.html, entetes: { 'Auto-Submitted': 'auto-generated' } });
          etapes.email = (v && v.issue) || 'incertain';
        } catch (_) { etapes.email = 'incertain'; }
      } else etapes.email = 'non-configure';
    }
    return repondre(res, 200, { ok: true, prevue: p, etapes, message: phrasePrevue(p, arret.etape) });
  }
  etapes.immediat = 'compte-vide';
  // 2) Ses sessions (l'extension ne pourra plus renouveler la sienne).
  etapes.sessions = (await fermerSessions(req)) ? 'fermees' : 'non-fermees';
  // 3) Tout le reste, compte de connexion en dernier.
  const r = await effacerCompte({ url: SUPABASE_URL, service: SERVICE, owner: u.id, proprio, inv });
  Object.assign(etapes, r.etapes);
  const fait = [];
  if (etapes.abonnement === 'resilie' || etapes.abonnement === 'deja-resilie') fait.push('abonnement résilié (aucun nouveau prélèvement)');
  if (etapes.abonnement === 'arrete') fait.push('abonnement arrêté');
  fait.push(...r.fait);
  // 4) Le journal minimal (sans contenu), puis l'e-mail — ni l'un ni l'autre ne
  //    change l'issue (elle est dite à part).
  etapes.journal = (await noterJournal({ url: SUPABASE_URL, service: SERVICE, owner: u.id, ok: r.ok, nombres: { ...inv, donneesEffacees: r.etapes.donnees } })) ? 'note' : 'non-note';
  etapes.email = 'non-envoye';
  if (r.ok && u.email && u.emailConfirme) {
    const cfg = configurationRelances();
    if (cfg.pret) {
      try {
        try { await lireMentions(); } catch (_) {}
        const m = mailSuppression({ fait, contact: contactEmail() });
        const v = await envoyerSmtp({ hote: process.env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: process.env.RELANCES_SMTP_UTILISATEUR, motDePasse: process.env.RELANCES_SMTP_MOT_DE_PASSE,
          de: process.env.RELANCES_EXPEDITEUR, nomDe: 'VRM', a: u.email, sujet: m.sujet, texte: m.texte, html: m.html, entetes: { 'Auto-Submitted': 'auto-generated' } });
        etapes.email = (v && v.issue) || 'incertain';
      } catch (_) { etapes.email = 'incertain'; }
    } else etapes.email = 'non-configure';
  }
  const message = r.ok
    ? `Ton compte VRM est supprimé : ${fait.join(', ')}.`
    : `Suppression INCOMPLÈTE. Fait : ${fait.length ? fait.join(', ') : 'rien'}. Pas encore effacé : ${r.pasFait.join(', ')}. Reconnecte-toi et relance « Supprimer mon compte ».`;
  if (!r.ok) console.warn('[supprimer-compte] incomplet', JSON.stringify(etapes));
  return repondre(res, r.ok ? 200 : 502, { ok: r.ok, immediat: true, etapes, message });
}

// ── « CONTINUER AVEC DISCORD » SANS COMPTE VRM (11 nov., lot DJ6) ─────────────
// `?mode=oauth-sans-compte` (POST, session). Le bouton de CONNEXION (pas celui de
// l'inscription) a fait créer par Supabase un compte que personne n'a voulu. On
// l'annule, SEULEMENT si tout est prouvé ici (chaque garde refuse sans rien toucher) :
// les gardes de « Supprimer mon compte » (session, jamais le propriétaire) · la fiche
// lue avec la clé de service : UNE identité Discord/Google, créée il y a < 10 min,
// jamais reconnectée depuis (`compteOAuthAnnulable`, src/auth/compteNeuf.js) · un
// inventaire LU et entièrement à 0 (aucune donnée, aucun compte Vinted…) · aucune
// abonnement Stripe. Sinon 409 : l'app montre la porte d'avant (son choix).
async function annulerCompteOAuthNeuf(req, res) {
  const g = await gardesSuppression(req, res);
  if (!g) return;
  const { u, SERVICE, proprio } = g;
  const REFUS = (raison) => repondre(res, 409, { ok: false, annule: false, raison, message: NON_TOUCHE });
  let fiche = null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(u.id)}`, { headers: sbCle(SERVICE), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return repondre(res, 503, { ok: false, annule: false, raison: 'fiche', message: NON_TOUCHE });
    fiche = await r.json();
  } catch (_) { return repondre(res, 503, { ok: false, annule: false, raison: 'fiche', message: NON_TOUCHE }); }
  if (!fiche || fiche.id !== u.id) return REFUS('fiche');
  const fournisseur = compteOAuthAnnulable(fiche);
  if (!fournisseur) return REFUS('pas-neuf');
  const inv = await inventaire({ url: SUPABASE_URL, service: SERVICE, owner: u.id, proprio });
  if (!inv) return repondre(res, 503, { ok: false, annule: false, raison: 'inventaire', message: NON_TOUCHE });
  if (Object.values(inv).some((n) => n !== 0)) return REFUS('pas-vide');
  const ligne = await ligneDe(req);
  if (ligne === undefined) return repondre(res, 503, { ok: false, annule: false, raison: 'abonnement', message: NON_TOUCHE });
  if (ligne && (ligne.abonnement_stripe || ligne.client_stripe)) return REFUS('abonnement');
  await fermerSessions(req);
  const r = await effacerCompte({ url: SUPABASE_URL, service: SERVICE, owner: u.id, proprio, inv });
  try { await noterJournal({ url: SUPABASE_URL, service: SERVICE, owner: u.id, ok: r.ok, nombres: { ...inv, oauthSansCompte: 1 } }); } catch (_) {}
  return repondre(res, r.ok ? 200 : 502, { ok: r.ok, annule: r.ok, fournisseur });
}

// La session est vérifiée avant toute lecture du CDN.
async function photo(req, res) {
  const vendeur = await vendeurExige(req,res);
  if (!vendeur) return;
  const corps = await lireCorpsJson(req);
  const r = await lirePhoto(corps && corps.url);
  if (r.status!==200) return repondre(res,r.status,{erreur:'photo indisponible'});
  res.setHeader('Content-Type',r.type);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','private, max-age=3600');
  res.setHeader('Vary','Authorization');
  return res.status(200).send(r.octets);
}

// ── Super PDP : la session d'abord, puis SA connexion (api/_lib/superpdp.js) ─
async function superpdp(req, res) {
  const vendeur = await vendeurExige(req, res);
  if (!vendeur) return;
  const corps = req.method === 'POST' ? await lireCorpsJson(req) : null;
  return routeSuperPdp(req, res, { vendeur, corps, acces: await accesVendeur(vendeur.id) });
}

// ── La clé Photoroom du vendeur : la session d'abord (api/_lib/photoroom-cle.js)
async function photoroom(req, res) {
  const vendeur = await vendeurExige(req, res);
  if (!vendeur) return;
  const corps = req.method === 'POST' ? await lireCorpsJson(req) : null;
  return routePhotoroom(req, res, { vendeur, corps, acces: await accesVendeur(vendeur.id), cloisonnee: await baseCloisonnee() });
}

// ── La facture Pro : émettre, numéroter, envoyer depuis SA boîte (api/_lib/facture-pro.js)
async function facturePro(req, res) {
  const vendeur = await vendeurExige(req, res);
  if (!vendeur) return;
  const corps = req.method === 'POST' ? await lireCorpsJson(req) : null;
  return routeFacturePro(req, res, { vendeur, corps, acces: await accesVendeur(vendeur.id), cloisonnee: await baseCloisonnee() });
}

// ── (10 nov., lot S) La facture Pro des ventes Leboncoin / eBay / Vestiaire (api/_lib/facture-autres.js)
async function factureAutre(req, res) {
  const vendeur = await vendeurExige(req, res);
  if (!vendeur) return;
  const corps = req.method === 'POST' ? await lireCorpsJson(req) : null;
  return routeFactureAutre(req, res, { vendeur, corps, acces: await accesVendeur(vendeur.id), cloisonnee: await baseCloisonnee() });
}

// ── SIRET → nom de l'entreprise (api/_lib/entreprise.js) : la session d'abord ─
async function entreprise(req, res) {
  const vendeur = await vendeurExige(req, res);
  if (!vendeur) return;
  const r = await routeEntreprise(req.query && req.query.siret);
  return repondre(res, r.status, r.body);
}

// ── Le mode équipe : la session d'abord (api/_lib/equipe.js) ─────────────────
async function equipe(req, res) {
  const utilisateur = await vendeurExige(req, res);
  if (!utilisateur) return;
  const corps = req.method === 'POST' ? await lireCorpsJson(req) : null;
  return routeEquipe(req, res, { utilisateur, corps });
}

// ── La carte de la communauté : la session d'abord (api/_lib/communaute.js) ──
async function communaute(req, res) {
  const utilisateur = await vendeurExige(req, res);
  if (!utilisateur) return;
  const corps = req.method === 'POST' ? await lireCorpsJson(req) : null;
  return routeCommunaute(req, res, { utilisateur, corps: corps || {} });
}

// ── « Se connecter avec Discord » : la session d'abord (api/_lib/discord.js) ──
async function discordDebut(req, res) {
  const utilisateur = await vendeurExige(req, res);
  if (!utilisateur) return;
  const corps = await lireCorpsJson(req);
  return debutDiscord(req, res, utilisateur, corps || {});
}

async function discordAttente(req, res) {
  const utilisateur = await vendeurExige(req, res);
  if (!utilisateur) return;
  const corps = await lireCorpsJson(req);
  return attenteDiscord(req, res, utilisateur, corps || {});
}

// ── LES E-MAILS DE L'ESSAI GRATUIT (5 nov., api/_lib/relances-essai.js) ─────
//   GET  ?d=<jeton>        le lien « ne plus recevoir ces rappels » de l'e-mail :
//                          N'ÉCRIT RIEN, montre une page avec UN bouton (un
//                          antivirus de messagerie ouvre les liens tout seul :
//                          un GET qui désinscrit désinscrirait sans clic) ;
//   POST ?d=<jeton>&page=1 ce bouton : désinscrit CE compte, répond la page ;
//   POST ?d=<jeton>        le « un clic » du logiciel de messagerie
//                          (RFC 8058, `List-Unsubscribe-Post`), réponse JSON ;
//   GET  (session)         ce que Réglages montre : envoi configuré ? (ce qui
//                          manque, au propriétaire seul), en essai ?, inscrit ?,
//                          ce qui est parti ;
//   POST (session) {abonne} son choix depuis Réglages.
const pageRelance = (res, code, titre, texte, bouton) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res.status(code).send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VRM</title><meta name="robots" content="noindex"></head>`
    + `<body style="margin:0;padding:40px 16px;background:#fff;color:#1d1d1f;font:17px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">`
    + `<main style="max-width:480px;margin:0 auto"><h1 style="font-size:22px;margin:0 0 12px">${e(titre)}</h1><p style="margin:0 0 20px;color:#3a3a3c">${e(texte)}</p>`
    + (bouton ? `<form method="post" action="${e(bouton)}" style="margin:0 0 20px"><button type="submit" style="font:inherit;font-weight:600;color:#fff;background:#0071e3;border:0;border-radius:12px;min-height:44px;padding:10px 20px;cursor:pointer">Ne plus recevoir ces e-mails</button></form>` : '')
    + `<a href="${APP_URL}" style="color:#0071e3">Ouvrir VRM</a></main></body></html>`);
};
async function relances(req, res) {
  const m = req.method;
  const d = String((req.query && req.query.d) || '');
  if (d) {
    const owner = lireJetonRelance(d);
    if (!owner) return m === 'GET' ? pageRelance(res, 400, 'Lien non reconnu', "Ce lien de désinscription n'est pas valable. Tu peux aussi couper ces e-mails dans VRM : Réglages → Notifications.") : repondre(res, 400, { ok: false });
    if (m === 'GET') {
      return pageRelance(res, 200, 'Ne plus recevoir les e-mails de l\'essai ?', "Un seul geste : le bouton ci-dessous. Tu pourras les réactiver dans VRM : Réglages → Notifications.",
        `/api/compte?mode=relances&d=${encodeURIComponent(d)}&page=1`);
    }
    if (m !== 'POST') return repondre(res, 405, { ok: false });
    const ok = await ecrireChoixRelance(owner, false);
    if (String((req.query && req.query.page) || '') !== '1') return repondre(res, ok ? 200 : 503, { ok });
    return ok
      ? pageRelance(res, 200, "C'est fait", "Tu ne recevras plus les e-mails de l'essai gratuit VRM. Tu peux les réactiver dans VRM : Réglages → Notifications.")
      : pageRelance(res, 503, 'Pas encore enregistré', "Le serveur n'a pas pu enregistrer ton choix. Réessaie dans un instant avec le même lien.");
  }
  const u = await utilisateurDe(req);
  if (u === undefined) return repondre(res, 503, { ok: false, raison: 'connexion-injoignable' });
  if (!u) return repondre(res, 401, { ok: false, raison: 'session' });
  if (m === 'POST') {
    const corps = await lireCorpsJson(req);
    if (!corps || typeof corps.abonne !== 'boolean') return repondre(res, 400, { ok: false, raison: 'corps' });
    if (!process.env.SUPABASE_SERVICE_KEY) return repondre(res, 503, { ok: false, raison: 'non-configure' });
    const ok = await ecrireChoixRelance(u.id, corps.abonne);
    return repondre(res, ok ? 200 : 503, { ok, abonne: ok ? corps.abonne : undefined });
  }
  const cfg = configurationRelances();
  const [acc, ligne] = await Promise.all([accesDe(req), ligneDe(req)]);
  const service = !!process.env.SUPABASE_SERVICE_KEY;
  const [choix, envois] = service ? await Promise.all([lireChoixRelance(u.id), lireEnvoisRelance(u.id)]) : [null, null];
  return repondre(res, 200, {
    ok: true,
    configure: cfg.pret,
    // Les noms des variables manquantes : au propriétaire seul (lui seul les pose).
    manque: acc && acc.proprietaire ? cfg.manque : undefined,
    proprietaire: acc ? acc.proprietaire : null,
    essai: ligne === undefined ? null : !!(ligne && ligne.statut === 'trialing'),
    finEssai: ligne && ligne.statut === 'trialing' ? ligne.fin_periode : null,
    // Trois états : true inscrit · false désinscrit · null pas su.
    abonne: choix ? choix.desinscrit !== true : null,
    envois: envois && envois.envois && typeof envois.envois === 'object'
      ? Object.fromEntries(Object.entries(envois.envois).filter(([k]) => ['j1', 'j3', 'j6'].includes(k)).map(([k, v]) => [k, { at: v && v.at, issue: v && v.issue }]))
      : (envois ? {} : null),
  });
}

// ── LE BILAN DU MOIS PAR E-MAIL (8 nov., api/_lib/bilan-mois.js) ─────────────
//   GET  ?d=<jeton>        le lien « ne plus recevoir ce bilan » : N'ÉCRIT RIEN,
//                          une page avec UN bouton (un antivirus ouvre les liens) ;
//   POST ?d=<jeton>&page=1 ce bouton : éteint le bilan de CE compte ;
//   POST ?d=<jeton>        le « un clic » du logiciel de messagerie (RFC 8058) ;
//   GET  (session)         { actif: true|false|null, defaut, configure, envois } — Réglages ;
//   POST (session) {actif} son choix depuis Réglages.
// (13 nov., lot 53) Le défaut : ACTIVÉ pour un compte créé depuis le 13 nov.
// (`choixEffectif`, la date de création de SA session), éteint avant.
async function bilanMois(req, res) {
  const m = req.method;
  const d = String((req.query && req.query.d) || '');
  if (d) {
    const owner = lireJetonBilan(d);
    if (!owner) return m === 'GET' ? pageRelance(res, 400, 'Lien non reconnu', "Ce lien n'est pas valable. Tu peux aussi couper le bilan dans VRM : Réglages → Notifications.") : repondre(res, 400, { ok: false });
    if (m === 'GET') return pageRelance(res, 200, 'Ne plus recevoir le bilan du mois ?', 'Un seul geste : le bouton ci-dessous. Tu pourras le réactiver dans VRM : Réglages → Notifications.', `/api/compte?mode=bilan-mois&d=${encodeURIComponent(d)}&page=1`);
    if (m !== 'POST') return repondre(res, 405, { ok: false });
    const ok = await ecrireChoixBilan(owner, false);
    if (String((req.query && req.query.page) || '') !== '1') return repondre(res, ok ? 200 : 503, { ok });
    return ok
      ? pageRelance(res, 200, "C'est fait", 'Tu ne recevras plus le bilan du mois par e-mail. Tu peux le réactiver dans VRM : Réglages → Notifications.')
      : pageRelance(res, 503, 'Pas encore enregistré', "Le serveur n'a pas pu enregistrer ton choix. Réessaie dans un instant avec le même lien.");
  }
  const u = await utilisateurDe(req);
  if (u === undefined) return repondre(res, 503, { ok: false, raison: 'connexion-injoignable' });
  if (!u) return repondre(res, 401, { ok: false, raison: 'session' });
  if (m === 'POST') {
    const corps = await lireCorpsJson(req);
    if (!corps || typeof corps.actif !== 'boolean') return repondre(res, 400, { ok: false, raison: 'corps' });
    if (!process.env.SUPABASE_SERVICE_KEY) return repondre(res, 503, { ok: false, raison: 'non-configure' });
    const ok = await ecrireChoixBilan(u.id, corps.actif);
    return repondre(res, ok ? 200 : 503, { ok, actif: ok ? corps.actif : undefined });
  }
  const [choix, envois] = await Promise.all([lireChoixBilan(u.id), lireEnvoisBilan(u.id)]);
  return repondre(res, 200, {
    ok: true,
    configure: configurationRelances().pret,
    // Trois états : true allumé · false éteint · null pas su — la MÊME règle que le cron
    // (`choixEffectif`) ; `defaut` : il n'a rien choisi, c'est le défaut de son compte.
    actif: choixEffectif(choix, u.created_at),
    defaut: !(choix && typeof choix === 'object' && typeof choix.actif === 'boolean'),
    envois: envois && envois.mois && typeof envois.mois === 'object'
      ? Object.fromEntries(Object.entries(envois.mois).slice(-6).map(([k, v]) => [k, { at: v && v.at, issue: v && v.issue }]))
      : (envois === undefined ? null : {}),
  });
}

// ── « M'ENVOYER UN E-MAIL D'ESSAI » (8 nov., api/_lib/mail-essai.js) ─────────
// Sur SON clic, à l'adresse de SON compte (jamais une adresse du corps), 3 par heure.
async function mailEssaiRoute(req, res) {
  const u = await utilisateurDe(req);
  if (u === undefined) return repondre(res, 503, { ok: false, raison: 'connexion-injoignable' });
  if (!u) return repondre(res, 401, { ok: false, raison: 'session' });
  const r = await envoyerMailEssai({ owner: u.id });
  return repondre(res, r.code, r.corps);
}

// ── « SIGNALER UN PROBLÈME » (6 nov., api/_lib/signalement.js) ───────────────
// La session d'abord : l'identifiant du compte VRM est celui de SA session,
// jamais un champ du corps. Le reste (où c'est rangé, l'anti-abus, la
// notification, la liste du propriétaire) vit dans la règle.
async function signalement(req, res) {
  const utilisateur = await vendeurExige(req, res);
  if (!utilisateur) return;
  if (req.method === 'GET') { const r = await listerSignalements({ utilisateur, unId: (req.query && req.query.id) || null }); return repondre(res, r.code, r.corps); }
  const corps = await lireCorpsJson(req);
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { ok: false, raison: 'corps' });
  if (corps.action === 'traite') { const r = await marquerTraite({ utilisateur, corps }); return repondre(res, r.code, r.corps); }
  const r = await envoyerSignalement({ utilisateur, corps, pousser: (notif, proprio) => contexteVendeur.run({ owner: proprio }, () => sendPushToAll(notif)) });
  return repondre(res, r.code, r.corps);
}

// ── « ÉCRIRE AU SUPPORT » (13 nov., lot 55, api/_lib/demande-aide.js) ────────
// POST (session) : envoyer — rangé chez LUI (owner = sa session), 5/h, scellé.
// GET et POST {action:'traitee'} : le PROPRIÉTAIRE de l'installation seul (403).
async function demandeAide(req, res) {
  const utilisateur = await vendeurExige(req, res);
  if (!utilisateur) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') { const r = await listerDemandesAide({ utilisateur }); return repondre(res, r.code, r.corps); }
  const corps = await lireCorpsJson(req);
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { ok: false, raison: 'corps' });
  if (corps.action === 'traitee') { const r = await marquerDemandeTraitee({ utilisateur, corps }); return repondre(res, r.code, r.corps); }
  const r = await envoyerDemandeAide({ utilisateur, corps, pousser: (notif, proprio) => contexteVendeur.run({ owner: proprio }, () => sendPushToAll(notif)) });
  return repondre(res, r.code, r.corps);
}

// ── « ENVOYER UN RAPPORT » DE L'EXTENSION (12 nov., ext. 5.371, api/_lib/rapport-extension.js) ──
// POST : la session de l'extension ; l'état technique seulement (liste blanche
// rejouée ici). GET : le vendeur sa ligne ; le PROPRIÉTAIRE tous les vendeurs.
async function rapportExtension(req, res) {
  const utilisateur = await vendeurExige(req, res);
  if (!utilisateur) return;
  if (req.method === 'GET') { const r = await listerRapportsExt({ utilisateur, de: (req.query && req.query.de) || null }); return repondre(res, r.code, r.corps); }
  const corps = await lireCorpsJson(req);
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { ok: false, raison: 'corps' });
  const r = await recevoirRapportExt({ utilisateur, corps, pousser: (notif, proprio) => contexteVendeur.run({ owner: proprio }, () => sendPushToAll(notif)) });
  return repondre(res, r.code, r.corps);
}

// ── LES TEMPS RÉELS DES VENDEURS (6 nov., v36, api/_lib/mesures-terrain.js) ──
// POST : un `sendBeacon` de l'app (corps en texte, jeton DANS le corps — un
// beacon ne porte pas d'en-tête), au plus une fois par minute ; le jeton est
// vérifié, jamais rangé. GET : le PROPRIÉTAIRE de l'installation seulement.
async function mesures(req, res) {
  if (req.method === 'GET') {
    const utilisateur = await vendeurExige(req, res);
    if (!utilisateur) return;
    const r = await listerMesures({ utilisateur, quoi: String((req.query && req.query.quoi) || '') });
    return repondre(res, r.code, r.corps);
  }
  const brut = await corpsBrut(req);
  const corps = brut || (req.body && typeof req.body === 'object' ? req.body : null);
  // (8 nov.) Une alerte de plantage groupée part au PROPRIÉTAIRE (ses appareils), jamais au vendeur.
  const r = await recevoirMesures({ corps, jetonEntete: jetonDe(req), verifierJeton: (j) => utilisateurDe({ headers: { authorization: 'Bearer ' + j } }), pousser: (notif, proprio) => contexteVendeur.run({ owner: proprio }, () => sendPushToAll(notif)) });
  return repondre(res, r.code, r.corps);
}

// ── Santé : des OUI/NON (route publique), et l'état de la page /etat ─────────
// (6 nov.) `etat` : base · e-mails · notifications ('ok' | 'panne' | 'inconnu')
// et l'heure de la vérification, pour public/etat.html — aucune donnée d'un
// vendeur (api/_lib/etat-public.js). LÉGER : une requête de deux scalaires,
// gardée 30 s en mémoire, et 30 s au cache de Vercel (`s-maxage`).
// (12 nov., agent2-fiabilite-prod) Ce que la surveillance lit (ok, serviceKey, owner,
// `etat.base`) reste PUBLIC ; les oui/non de CONFIGURATION (IA, détourage, Stripe,
// webhook Stripe, e-mails de l'essai) ne disent plus à n'importe qui quelles portes
// sont posées : ils ne partent (`config`) qu'au PROPRIÉTAIRE de l'installation, avec
// SA session, et jamais par le cache partagé. Tenu par scripts/audit-sante-publique.cjs.
async function configPourProprietaire(req) {
  if (!String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '')) return undefined;
  const u = await utilisateurDe(req).catch(() => null);
  const proprio = u && u.id ? await proprioAlertes().catch(() => null) : null;
  if (!proprio || String(u.id).toLowerCase() !== proprio) return undefined;
  return { ia: !!process.env.AI_API_KEY, detourage: !!process.env.PHOTOROOM_API_KEY, stripe: stripePret(), stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET, relancesEssai: configurationRelances().pret };
}
async function sante(req, res) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  const config = await configPourProprietaire(req);
  res.setHeader('Cache-Control', config ? 'private, no-store' : 'public, max-age=0, s-maxage=30');
  if (config) res.setHeader('Vary', 'Authorization');
  const [etat, statut0] = await Promise.all([etatPublic({ pushPret: pushConfigure(), anon: ANON }), statutPourSante().catch(() => null)]);
  // (14 nov., fiabilité prod) GitHub ne lance les sondes que 3 à 4 fois par jour : un état de plus
  // de 15 min est relancé ICI (api/_lib/statut-sondes.js `relancerSondesSiVieilles`), puis relu.
  let statut = statut0;
  const relance = await relancerSondesSiVieilles({ statut: statut0 }).catch(() => null);
  if (relance && relance.ok) { oublierStatutPublic(); statut = await statutPourSante().catch(() => statut0); }
  return repondre(res, 200, {
    ok: true,
    serviceKey: !!process.env.SUPABASE_SERVICE_KEY,
    owner: !!process.env.VRM_OWNER_UID,
    etat,
    statut,
    config,
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (corsExtension(req, res)) return;   // (8 nov.) Orion : préalable CORS des appels de l'extension
  const mode = String((req.query && req.query.mode) || 'sante');
  const m = req.method;
  if(mode==='profil-avatar')return routeProfilAvatar(req,res);
  if(mode==='avatar-public')return routeAvatarPublic(req,res);
  if(mode==='configuration-auth'){
    if(m!=='GET')return repondre(res,405,{ok:false});
    const cfg=configurationAuthPublique(SUPABASE_URL,ANON);
    return repondre(res,cfg?200:503,cfg?{ok:true,...cfg}:{ok:false});
  }
  if(mode==='confidentialite'){
    if(m!=='GET')return repondre(res,405,{ok:false});
    const u=await utilisateurDe(req);if(!u)return repondre(res,401,{ok:false,raison:'session'});
    const resultat=await verifierConfidentialite({url:SUPABASE_URL,anon:ANON,jeton:jetonDe(req),uid:u.id});
    return repondre(res,resultat.ok?200:503,{...resultat,...(resultat.ok?{uid:u.id}:{})});
  }
  if (mode === 'operations') return routeOperations(req, res);
  // (8 nov., extension 5.326) Les ventes/achats envoyés LÉGERS par l'extension :
  // la fenêtre lue en abrégé, fusionnée ici dans la ligne (api/_lib/commandes-leger.js).
  if (mode === 'commandes') {
    if (m === 'POST') { req.body = await lireCorpsJson(req); if (req.body === null) return repondre(res, 400, { ok: false, erreur: 'json' }); }
    return routeCommandes(req, res);
  }
  if(mode==='favoris'){
    if(m==='POST'){req.body=await lireCorpsJson(req);if(req.body===null)return repondre(res,400,{ok:false,erreur:'json'});}   // (11 nov., B145) un JSON illisible est un 400 net
    return routeFavoris(req,res);
  }
  if (mode === 'photo') return m === 'POST' ? photo(req,res) : repondre(res,405,{erreur:'POST seulement'});
  if (mode === 'sante') return m === 'GET' ? sante(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'vinted-pris') return m === 'GET' ? vintedPris(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'webhook') return m === 'POST' ? webhook(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'abonnement') return m === 'GET' ? abonnement(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'checkout') return m === 'POST' ? checkout(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'portail') return m === 'POST' ? portail(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'compte-vendeur') return m === 'POST' ? compteVendeur(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'changer-plan') return m === 'POST' ? changerPlan(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'parrainage') return (m === 'GET' || m === 'POST') ? parrainage(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'factures') return m === 'GET' ? factures(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'resilier') return m === 'POST' ? resilier(req, res, false) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'reprendre') return m === 'POST' ? resilier(req, res, true) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'qr-connexion') return m === 'POST' ? qrConnexion(req, res) : repondre(res, 405, { erreur: 'POST seulement' });   // (14 nov., lot 119)
  if (mode === 'lien-aide') return (m === 'GET' || m === 'POST') ? lienAide(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });   // (14 nov., lot 120)
  if (mode === 'session-extension') return m === 'POST' ? sessionExtension(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'superpdp') return (m === 'GET' || m === 'POST') ? superpdp(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'facture-autre') return m === 'POST' ? factureAutre(req, res) : repondre(res, 405, { erreur: 'POST' });
  if (mode === 'facture-pro') return (m === 'GET' || m === 'POST') ? facturePro(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'photoroom') return (m === 'GET' || m === 'POST') ? photoroom(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'equipe') return (m === 'GET' || m === 'POST') ? equipe(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'communaute') return (m === 'GET' || m === 'POST') ? communaute(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  // (10 nov., lot AR) La page PUBLIQUE d'un formateur (vrm.center/f/<adresse>) : SANS session,
  // clé publique ; la base (032) ne rend que nom, présentation et groupes montrés.
  if (mode === 'formateur') {
    if (m !== 'GET') return repondre(res, 405, { erreur: 'GET seulement' });
    res.setHeader('Cache-Control', 'no-store');
    const r = await pagePublique(req.query && req.query.f, ANON);
    return repondre(res, r.code, r.corps);
  }
  if (mode === 'discord-debut') return m === 'POST' ? discordDebut(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'discord-attente') return m === 'POST' ? discordAttente(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'discord') return m === 'GET' ? retourDiscord(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'entreprise') return m === 'GET' ? entreprise(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'discord-deja') return m === 'GET' ? discordDeja(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  // (9 nov.) « Supprimer mon compte » : GET l'inventaire, POST la suppression ;
  // l'ancien `fermer` mène à la MÊME fonction (même confirmation forte).
  if (mode === 'oauth-sans-compte') return m === 'POST' ? annulerCompteOAuthNeuf(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'supprimer' || mode === 'fermer') return m === 'POST' ? supprimerCompte(req, res) : (m === 'GET' && mode === 'supprimer') ? apercuSuppression(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  // (6 nov.) « Signaler un problème » : envoyer (tous), lire et « Traité » (le propriétaire).
  if (mode === 'supprimer-annuler') return m === 'POST' ? annulerSuppression(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  if (mode === 'suppression-prevue') return m === 'GET' ? suppressionPrevue(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'mes-donnees') return m === 'GET' ? mesDonnees(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  if (mode === 'signalement') return (m === 'GET' || m === 'POST') ? signalement(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'aide') return (m === 'GET' || m === 'POST') ? demandeAide(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'rapport-extension') return (m === 'GET' || m === 'POST') ? rapportExtension(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  // (6 nov., v36) Les temps réels (anonymes, agrégés) : recevoir un lot, lire les agrégats (propriétaire).
  // (9 nov.) Le tableau de bord du PROPRIÉTAIRE de l'installation (api/_lib/pilotage.js) :
  // jeton vérifié d'abord, propriétaire seul (403 sinon), clé de service après.
  if (mode === 'pilotage') {
    if (m !== 'GET') return repondre(res, 405, { erreur: 'GET seulement' });
    const utilisateur = await vendeurExige(req, res);
    if (!utilisateur) return;
    res.setHeader('Cache-Control', 'no-store');
    const r = await routePilotage({ utilisateur });
    return repondre(res, r.code, r.corps);
  }
  if (mode === 'mesures') return (m === 'GET' || m === 'POST') ? mesures(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  // (11 nov.) Les alertes de production (api/_lib/alertes-production.js) : PROPRIÉTAIRE
  // seul (403 sinon). GET : les dernières et les interrupteurs ; POST { type, actif }.
  if (mode === 'alertes') {
    if (m !== 'GET' && m !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST' });
    const utilisateur = await vendeurExige(req, res);
    if (!utilisateur) return;
    const corps = m === 'POST' ? await lireCorpsJson(req) : null;
    const r = await routeAlertes({ methode: m, utilisateur, corps, proprio: await proprioAlertes() });
    return repondre(res, r.code, r.corps);
  }
  // (4 nov.) Paramètres → Mon compte : « Appareils connectés » et « Ce que VRM a fait ».
  if (mode === 'appareils') return (m === 'GET' || m === 'POST') ? appareils(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'catalogue') return (m === 'GET' || m === 'POST') ? catalogue(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'agenda') return (m === 'GET' || m === 'POST') ? agenda(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'journal') return m === 'GET' ? journalVrm(req, res) : repondre(res, 405, { erreur: 'GET seulement' });
  // (5 nov.) Les e-mails de l'essai gratuit : état, choix, lien de désinscription.
  if (mode === 'relances') return (m === 'GET' || m === 'POST') ? relances(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  // (8 nov.) Le bilan du mois par e-mail : état, choix, lien « ne plus recevoir ».
  if (mode === 'bilan-mois') return (m === 'GET' || m === 'POST') ? bilanMois(req, res) : repondre(res, 405, { erreur: 'GET ou POST' });
  if (mode === 'mail-essai') return m === 'POST' ? mailEssaiRoute(req, res) : repondre(res, 405, { erreur: 'POST seulement' });
  return repondre(res, 404, { erreur: 'mode inconnu' });
}
