// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { HistoriqueModifications } from '../OutilsParcours.jsx';
import { dateImportValide } from '../brouillonsReglages.js';
import { preparerLiaisonOAuth } from '../auth/liaisonOAuth.js';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChampRecherche } from '../composants/ChampRecherche.jsx';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { L, PAS_SU } from '../libelles.js';
import { useReglageConseils } from '../Conseils.jsx';
import { PHRASES_ECRAN } from '../phrasesEcran.js';
import { APPARENCES, LIBELLES_APPARENCE, PHRASES_APPARENCE } from '../apparence.js';
import { SignalerProblemeFeuille as SignalerProblemeFeuilleBase, SignalementsRecus } from '../composants/SignalerProbleme.jsx';
import { CLE_COMPTES_EXCLUS, estExclu, basculerExclu } from '../../api/_lib/comptes-exclus.js';
import { PLATEFORMES_COMPTES, etatCompteLie, ageLecture, nomCompteLie, LIBELLE_ETAT } from '../comptesLies.js';
import { contactEmail, CONTACT_A_VENIR } from '../contact.js';
import { normAdresse, ADRESSE_COLLECTRICE, estAdresseCollectrice } from '../../api/_lib/proprietaire-email.js';
import { photoACacherSelon, poserReglesStream, normaliserRegles, masquerTexteStream, regleApercu, ligneACacher, CATEGORIES as STREAM_CATEGORIES, LISTES as STREAM_LISTES, nettoyerMots, CLE_STREAM_REGLES } from '../modeStream.js';
import { noterTicketDiscord } from '../communaute/discordAttente.js';
import { CLE_MODELES } from '../modelesDescription.js';
import { MesModeles } from '../ModelesDescription.jsx';
import { CLE_NUMERO_ECRIT, lireReglageNumeroEcrit, lireNumeroEcrit, apercuNumeroEcrit } from '../numeroEcrit.js';
import { CLE_AFFICHAGE, CLE_JE_VENDS, lireReglageAffichage, lireReglageJeVends, SEUIL_VENTES_SIMPLE, JOURS_VENTES_SIMPLE } from '../profilVendeur.js';
import { CLE_REGLAGE_ETIQUETTE, PLACES as PLACES_ETIQUETTE, FORMES as FORMES_ETIQUETTE, QUESTIONS as QUESTIONS_ETIQUETTE, ANNONCE_EXEMPLE, lireReglageEtiquette, etiquetteDe, poserEtiquette, proposition as propositionEtiquette } from '../etiquetteNumero.js';
import { ANNONCES_RETIREES, AUTH, AUTH_REDIRECT, RECHERCHE_OUVERTURE, Avancement, BUILD_ID, BlocComptesMuets, Bouton, BrandMark, C, CE_QUE_VOIT_UN_MEMBRE, CLOISONNE, CaseCgv, DEMANDE_ADRESSES, DEMANDE_REGLAGE_SOUS, DEMANDE_SAISIE_PRIX, DEMANDE_SIGNALEMENTS, DOCS_LEGAUX, EQUIPE_NON_INSTALLE_TXT, EXT_ATTENDUE, FermeAuRetour, GuideReglage, IMPR_MODES, Icon, IconeReglage, LignePanne, ListeComptes, MESSAGES_RETIRES, MFA_TROP, MM_PT, MULTI_USER, NAV, OAUTH_PROVIDERS, PRIX_CGV_LISIBLE, PhotoVinted, Pourquoi, REGIMES_FISCAUX, REGLAGE_PAS_LU, SB_CONFLICT, SEL_EBAY_ANNONCES, SUPABASE_KEY, SUPABASE_URL, ScreenHead, Segmente, SheetShell, TAUX_URSSAF_DEFAUT, TEXTE_DELAI_EMAIL_BOUTON, ZOOM_KEY, _apercuEcrit, _ecoutesApercuEcrit, _failedLocalSaves, _reglagesEcoute, _reglagesRates, _saveTimers, _settingsConfirmed, _settingsRevision, _syncInfo, aLaDemande, aPayerUrssaf, actionEquipe, annonceLbcALui, annonceLbcEnVente, annoncesLbcVendues, appelEbay, applyZoom, archiveNumeros, askConfirm, askText, authSetPassword, authSignOut, avecRetour, bordereauFormatKey, brouillonsParametres, casesCgvCochees, choisirVueEquipe, cleNum, cloudPush, codePerime, compterReglesEbay, comptesLbcProuves, comptesLbcSession, contexteSignalement, corpsCompteEbay, dateJourFr, delaiDemandeEmail, deleteVintedAccount, dessinerPdf, ecrireLigneAccompagnement, enTeteSession, estRelaisApple, extEnRetard, extSait, fetchVintedAccounts, harvestTs, imprMode, imprimanteChoisie, isCloudReady, lbcListingsSession, lectureEcriteLbc, lienEbay, lireAbonnement, lireAchatsLies, lireBaseRelue, lireCapturesDetail, lireComptaSynchro, lireComptesEbay, lireDeclarations, lireEbayTous, lireEquipe, lireLigneAccompagnement, lireLignesDuCompte, lireMisDeCote, lireModelesRanges, lirePdfLigne, lireReglage, lireTout, load, makeChallenge, makeVerifier, mapMailError, mfaAppel, mfaInjoignable, mfaLireFacteurs, mfaVerifierCode, mfaVerifierCodeParmi, nomAppareil, numeroReprenable, numerosVcEffectifs, onCloudReady, onSyncChange, onVmrExt, ouvrirEmailsRelier, ouvrirStripe, phrasePersonne, poserBordereau, poserReglesStreamEnAttente, poserStream, prefixeNumeros, prixLisible, providerEnabled, readZoom, regimeFiscal, relierBoiteDe, save, sbAuth, signalerComptesEbay, sondeLectureSansCompte, tauxUrssaf, telechargerFichier, textePerime, texteReglesQuiRestent, toast, typeBordereau, typeCompteVinted, uidsLies, useComptesAutresSites, useComptesExclus, useEstProprietaire, useEtatEmailsComptes, useMisDeCote, useReglesStream, useSecondesRestantes, useStateCle, useStream, vcCarte, vintedDeChrome, vmrAuthEtat, vmrExtPresent, vmrExtVersion, withOwner, writeSession, zoneEtiquette, AideEcran, masquerPourEnvoi, useProfilVendeur } from '../App.jsx';

// (8 nov.) En tête (hors des morceaux recollés) : App.jsx importe déjà ces deux noms ; recollé
// dans le texte de l'app (`_source-app.cjs`), l'import les déclarait deux fois.
import { installerExtensionIci, boutiqueOrion } from '../navigateurExtension.js';

// (8 nov.) « Vérifier mon installation » : le même contrôle que le guide de démarrage (src/guideDemarrage.js).
import { VerifierInstallationApp } from '../App.jsx';

// ⟦← App.jsx #1⟧
import SuiviComptes from '../SuiviComptes.jsx';
// (8 nov.) Paramètres → « Tout va bien ? » (garde-fous de la capture, api/_lib/garde-capture.js).
import { ToutVaBien } from '../ToutVaBien.jsx';
// ⟦→ ecrans/Ebay.jsx #3⟧
import { etatExtensionAffichage, etatDerniereLecture } from '../etatConnexions.js';
// ⟦← App.jsx #2⟧
import { filtrerReglages } from '../rechercheReglages.js';
import { preparerApercusModes } from '../apercusBordereaux.js';
import { actionsReglages } from '../reglagesActions.js';
// ⟦← App.jsx #3⟧
import ConnexionsCompte from '../auth/ConnexionsCompte.jsx';
// ⟦← App.jsx #4⟧
import {FAMILLES as FAMILLES_NOTIF,familleActive as familleNotifActive,reglageCalme,heureValide} from '../../api/_lib/notif-textes.js';
import {apercuFamille as apercuFamilleNotif} from '../../api/_lib/notif-apercus.js';
import {embellir as embellirNotif,ICONE_FAMILLE as ICONE_FAMILLE_NOTIF} from '../../api/_lib/notif-belle.js';
// ⟦← App.jsx #5⟧
import GuideIphone, { useGuideIphone } from '../GuideIphone.jsx';
// (6 nov.) « Recevoir les SMS Mondial Relay » : jeton, adresse, pas-à-pas Raccourcis (api/_lib/sms-mondialrelay.js).
import SmsColisSetting from '../SmsColis.jsx';
import { etatJetonSms } from '../smsColis.js';
// ⟦← App.jsx #6⟧
import PhotoProfil,{AvatarCompte} from '../profil/AvatarPersonnel.jsx';
// ⟦← App.jsx #7⟧
// (6 nov., vitesse 2) qrMfa (et son générateur de QR, ~50 Ko) : importé à la demande, à l'activation.
import {conflitAdresseCompte} from '../receptionEmail.js';
// ⟦← App.jsx #8⟧
import EspaceEmails from '../EspaceEmails.jsx';
// ⟦← App.jsx #9⟧
import { feuillesExport, fichiersExport, zipStocke, nomExport } from "../exportDonnees.js";
// ⟦← App.jsx #11⟧
import { MesuresTerrain } from "../composants/MesuresTerrain.jsx";
import { PlantagesTerrain } from "../composants/PlantagesTerrain.jsx";
import { GroupeIos, RangeeIos } from '../composants/Ios.jsx';
import { etatAbonnement, lienParrainage, lectureSeuleActive, EXPORT_FERME } from '../abonnement/etatAbonnement.js';
import { nomEcran as nomEcranVeille } from "../../api/_lib/veille-plantages.js";
// ⟦← App.jsx #12⟧
import { VAPID_PUBLIC_KEY } from "../vapid.js";
// ⟦← App.jsx #13⟧
import TesDonnees from '../composants/TesDonnees.jsx';
import { deconnecterPartout, texteConfirmationPartout, ligneJournal, filtrerJournal, comptesDuJournal, FILTRES_TYPE } from '../securiteCompte.js';
// ⟦← App.jsx #14⟧
import { DISCORD_ERREURS } from "../communaute/discordErreurs.js";
// ⟦← App.jsx #15⟧
import { ligneEmailsCompte } from "../emailsCompteLie.js";
// ⟦← App.jsx #16⟧
// La migration qui cloisonne les vendeurs, lue depuis LE fichier (pas recopiée) :
// deux copies finiraient par diverger, et c'est le genre de texte qu'on colle
// dans une base de production sans le relire.
import MIGRATION_SQL from "../../supabase/migrations/001-multi-utilisateurs.sql?raw";

// ⟦← App.jsx #10⟧
const SuiviReceptionEmails = aLaDemande(() => import('../ReceptionEmails.jsx'));
const JournalEmails = aLaDemande(() => import('../JournalEmails.jsx'));
// (8 nov.) « Ton adresse VRM » : l'adresse de réception unique (src/AdresseReception.jsx), à la demande.
const CarteAdresseReception = aLaDemande(() => import('../AdresseReception.jsx'));
// ⟦← App.jsx #17⟧
// Un nom déjà pris (GoTrue refuse deux facteurs au même nom pour un compte) :
// comparé sans casse ni espaces de bord, pour ne pas laisser « iPhone » et
// « iphone » côte à côte — on ne saurait plus lequel retirer.
const nomAppareilPris = (nom, verifies) => {
  const k = String(nom || '').trim().toLowerCase();
  return !!k && (verifies || []).some((f) => String((f && f.friendly_name) || '').trim().toLowerCase() === k || nomAppareil(f).toLowerCase() === k);
};
// ⟦← App.jsx #18⟧

const lireConnexionsOAuth = async()=>{
 try{const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,...enTeteSession()},signal:AbortSignal.timeout(15000)});if(!r.ok)return null;const j=await r.json();return Array.isArray(j.identities)?j.identities.map(i=>i.provider):null;}catch(_){return null;}
};
const oauthRelier = async provider => {
  try{const verifier=makeVerifier();const r=await preparerLiaisonOAuth({provider,enabled:providerEnabled(provider),token:AUTH.session?.access_token,owner:AUTH.user?.id,base:SUPABASE_URL,cle:SUPABASE_KEY,origine:window.location.origin,verifier,challenge:await makeChallenge(verifier)});if(r.ok)window.location.assign(r.url);return r;}catch(_){return{ok:false,error:'Impossible de préparer cette connexion. Réessaie.'};}
};
// ⟦← App.jsx #19⟧

// Changer son adresse email. Supabase envoie une confirmation aux DEUX adresses
// (l'ancienne et la nouvelle) quand « Secure email change » est actif : tant que
// les deux liens ne sont pas ouverts, l'ancienne reste la bonne. On le dit.
const authSetEmail = async (email) => {
  const tok = AUTH.session && AUTH.session.access_token;
  if (!tok) return { ok: false, error: 'Reconnecte-toi avant de changer ton email.' };
  try {
    // Le lien de validation de la nouvelle adresse ramène sur l'app (`avecRetour`).
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${avecRetour('user')}`, {
      method: 'PUT',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(email).trim().toLowerCase() }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const brut = j.msg || j.message || `Erreur ${res.status}`; return { ok: false, error: mapMailError(brut), attente: delaiDemandeEmail(brut) }; }
    return { ok: true };
  } catch (_) { return { ok: false, error: 'Pas de connexion internet.' }; }
};
// ⟦← App.jsx #20⟧
function SignalerProblemeFeuille({ ecran, ...props }) {
  return <SignalerProblemeFeuilleBase Feuille={SheetShell} Bouton={Bouton} entetes={enTeteSession} masque={masquerPourEnvoi} contexte={() => contexteSignalement(ecran)} {...props}/>;
}
// ⟦← App.jsx #21⟧
function ModelesSetting() {
  const [modeles, setModeles] = useStateCle(CLE_MODELES, () => lireModelesRanges());
  React.useEffect(() => onCloudReady(() => setModeles((l) => (l && l.length ? l : lireModelesRanges()))), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const poser = (l) => { setModeles(l); save(CLE_MODELES, l); };
  return <MesModeles modeles={modeles} onChange={poser} confirmer={(m) => askConfirm({ title: `Supprimer « ${m.nom} » ?`, ok: 'Supprimer', cancel: 'Annuler', danger: true })}/>;
}
// ⟦← App.jsx #22⟧

// ── EFFACEMENT CIBLÉ DES DONNÉES D'UN COMPTE (récupérable) ───────────────────
// Julien, 3 octobre : « sur supprimer ce compte, on doit pouvoir sélectionner
// si on veut tout enlever, la compta, les ventes, les achats, les annonces ».
// Et sa précision qui fixe TOUTE la sémantique : « si je veux récupérer mes
// données, je reconnecte simplement l'extension sur le compte Vinted ».
// ⇒ Donc ce geste n'écrit JAMAIS `vrm_blocked_accounts` (sinon l'extension
//    refuserait de recapter — l'inverse de ce qu'il veut). Il VIDE les lignes
//    choisies (`{supprime:true}`, le DELETE ne marche pas sur `app_data`, §
//    deleteVintedAccount) ; une re-capture les réécrit (listePlusRiche repart
//    d'un `nItems` absent → écrit). Le blocage définitif reste un geste SÉPARÉ
//    (deleteVintedAccount), pour un compte fermé par Vinted (shop_cancale).
// ⚠️ GARDE DESTRUCTIVE : le `_` de PostgREST `like` est un joker 1-caractère, donc
//    `harvest_35_*` matcherait `harvest_352_*`. On relit la liste et on filtre
//    sur le préfixe EXACT en JS avant d'effacer quoi que ce soit.
// `scopes` : { annonces, ventes, bordereaux, releves, achats, messages, compte } (booléens).
const familiesDeCompte = (uid, id, scopes) => {
  const hp = `harvest_${uid}_`, cp = `coffre_${uid}_`;
  if (id.startsWith(cp)) return scopes.annonces;          // le coffre = annonces archivées
  if (!id.startsWith(hp)) return false;                   // garde EXACTE (pas de 35→352)
  const r = id.slice(hp.length);
  if (/^(listings$|enligne$|item_)/.test(r)) return scopes.annonces;   // `enligne` : la relecture publique (5.170)
  if (/^label/.test(r)) return scopes.bordereaux;          // les bordereaux captés (PDF) — séparés des ventes (26 oct.)
  if (/^releve_/.test(r)) return scopes.releves;           // les relevés de versement — séparés des ventes
  if (/^(orders_sold$|txn_|billing$)/.test(r)) return scopes.ventes;
  if (/^(orders_purchased$)/.test(r)) return scopes.achats;
  if (/^(conv_)/.test(r)) return scopes.messages;
  // Le reste (seen_urls, diag, offer_statuts…) ne part qu'avec « tout le compte ».
  return !!scopes.compte;
};
const supprimerDonneesCompte = async (uid0, login, scopes) => {
  const uid = String(uid0 || '').trim();
  if (!uid) return { ok: false, n: 0 };
  let n = 0;
  try {
    // (1er nov.) Toutes les pages, motif échappé (`lireLignesDuCompte`).
    const rows = await lireLignesDuCompte(uid);
    if (!Array.isArray(rows)) return { ok: false, n: 0 };   // « pas su » : on n'efface rien à l'aveugle
    const cibles = rows.filter(x => familiesDeCompte(uid, String(x.id), scopes));
    for (let i = 0; i < cibles.length; i += 500) {
      const lot = cibles.slice(i, i + 500);
      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
        method: 'POST',
        headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(lot.map(x => withOwner({ id: x.id, data: { supprime: true, uid, purgedAt: new Date().toISOString() } }))),
      });
      if (!w.ok) return { ok: false, n };
      n += lot.length;
    }
    // « Le compte et ses jetons » : la ligne vinted_accounts (DELETE marche là,
    // autre table). Récupérable en reconnectant l'extension sur ce compte.
    if (scopes.compte) {
      try { await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${uid}`, { method: 'DELETE', headers: sbAuth({ Prefer: 'return=minimal' }) }); } catch (_) {}
    }
    return { ok: true, n };
  } catch (_) { return { ok: false, n: 0 }; }
};
// ⟦← App.jsx #23⟧
const apercuEcritPublie = (site) => _apercuEcrit[site] || null;
const ecouterApercuEcrit = (f) => { _ecoutesApercuEcrit.add(f); return () => _ecoutesApercuEcrit.delete(f); };
// ⟦← App.jsx #24⟧
// Les anciennes coordonnées ne prouvent pas qu'un autre PDF est dégagé.
const smartDefaultBordPos = (w, h) => null;
// ⟦← App.jsx #25⟧

// ── QUEL TYPE DE BORDEREAU EST-CE ? ──────────────────────────────────────────
// Pour les aperçus de Réglages seulement — l'impression, elle, ne dépend
// JAMAIS du type (elle repère l'étiquette sur la page, `zoneEtiquette`). Mesuré
// le 17 octobre sur ses 93 bordereaux : les mots du transporteur sont lisibles
// sur Chronopost (43+4), Colissimo (3) et la plupart des Mondial Relay ; les
// autres se reconnaissent à leur créateur (« MondialRelay … ») ou à l'étiquette
// partenaire posée au format exact (envoi international). Rien d'autre n'est
// deviné : sans repère, c'est « autre mise en page », avec ses dimensions.
const TYPES_BORDEREAU = [
  ['mondialrelay', 'Mondial Relay · InPost'],
  ['international', 'Mondial Relay · envoi international'],
  ['chronopost', 'Chronopost · Shop2Shop'],
  ['colissimo', 'Colissimo'],
  ['vintedgo', 'Vinted Go'],
  ['relaiscolis', 'Relais Colis'],
  ['ups', 'UPS'],
  ['dpd', 'DPD'],
];
// ⟦← App.jsx #26⟧
const nomTypeBordereau = (t) => (TYPES_BORDEREAU.find(([k]) => k === t) || [, 'Autre mise en page'])[1];
// ⟦← App.jsx #27⟧

function ApercuPdf({ octets, page = 1, largeur, zone, label }) {
  const ref = React.useRef(null);
  const [etat, setEtat] = React.useState('charge');   // charge · ok · ko
  React.useEffect(() => {
    let vivant = true;
    setEtat('charge');
    dessinerPdf(ref.current, octets, { page, largeur, zone }).then(() => { if (vivant) setEtat('ok'); }).catch(() => { if (vivant) setEtat('ko'); });
    return () => { vivant = false; };
  }, [octets, page, largeur, zone]);
  const ouvrir = () => { try { const u = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' })); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch (_) {} };
  return (
    <figure data-apercu={etat} style={{margin:0,display:'flex',flexDirection:'column',gap:6,alignItems:'flex-start'}}>
      <figcaption style={{fontSize:12,fontWeight:600,color:C.muted}}>{label}</figcaption>
      <canvas ref={ref} aria-label={label} data-stream-image="bordereau" style={{display: etat === 'ko' ? 'none' : 'block', borderRadius:12, border:`1px solid ${C.border}`, background:'#fff', maxWidth:'100%'}}/>
      {etat === 'charge' && <span style={{fontSize:12,color:C.muted}}>Je dessine l’aperçu…</span>}
      {etat === 'ko' && <span style={{fontSize:12,color:C.muted,lineHeight:1.45}}>Je n’ai pas pu dessiner l’aperçu ici. <button type="button" onClick={ouvrir} style={{border:'none',background:'none',padding:0,color:C.text,textDecoration:'underline',cursor:'pointer',font:'inherit'}}>Ouvrir le PDF</button></span>}
    </figure>
  );
}

// ── RÉGLAGES → IMPRIMANTE ET BORDEREAUX (17 octobre) ────────────────────────
// Julien : « dans les paramètres, imprimante thermique et normale ; tous les
// types de bordereau avec une visualisation pour chaque type collecté par
// l'app ». Le choix est LE réglage `vrm_imprimante` — le même que les deux
// pastilles de l'écran Colis (§11 : un réglage, deux portes).
// Les aperçus se calculent sur SES bordereaux, dans son navigateur, au clic :
// ils lisent des PDF (≈ 70 Ko chacun), donc rien ne part tant qu'il ne le
// demande pas, et jamais plus de `APERCU_MAX` (§4.4).
const APERCU_MAX = 24;
const ImprimanteSetting = ({ nu = false }) => {
  const [mode, setMode] = React.useState(imprimanteChoisie);
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => { if (!touche.current) setMode(imprimanteChoisie()); }), []);
  const [erreurMode,setErreurMode]=React.useState('');
  const choisir = (v) => {
    const m=imprMode(v);touche.current=true;
    try{localStorage.setItem('vrm_imprimante',JSON.stringify(m));}
    catch(_){setErreurMode('Le format n’a pas pu être appliqué sur cet appareil. Réessaie après avoir libéré du stockage.');return;}
    setErreurMode('');setMode(m);save('vrm_imprimante',m);
  };
  const [ap, setAp] = React.useState(null);   // null = pas demandé · {etat:'charge'|'pasSu'|'vide'|'lu', ...}
  const chargerBrut = async () => {
    setAp({ etat: 'charge' });
    const [emails, captes] = await Promise.all([
      lireTout('id=like.email_bord_*&meta->>_pdf=eq.true&select=id,at:meta->>receivedAt'),
      lireTout('id=like.harvest_*_label_*&meta->>_pdf=eq.true&select=id,at:meta->>capturedAt'),
    ]);
    if (emails === null && captes === null) { setAp({ etat: 'pasSu' }); return; }
    // Un bordereau peut être là deux fois (capté par l'extension ET reçu par
    // email) : la transaction le dit, on n'en garde qu'un.
    const vus = new Set(), lignes = [];
    for (const r of [...(captes || []), ...(emails || [])].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))) {
      if (/_label_latest$/.test(r.id)) continue;
      const tx = (r.id.match(/(\d{6,})$/) || [])[1] || r.id;
      if (vus.has(tx)) continue; vus.add(tx); lignes.push(r);
    }
    if (!lignes.length) { setAp({ etat: 'vide', partiel: emails === null || captes === null }); return; }
    const PL = await import('pdf-lib');
    const types = new Map(); let lus = 0, rates = 0;
    for (const r of lignes.slice(0, APERCU_MAX)) {
      const lu = await lirePdfLigne(r.id);
      if (!lu || !lu.octets) { if (lu === null) rates++; continue; }
      let doc; try { doc = await PL.PDFDocument.load(lu.octets); } catch (_) { continue; }
      lus++;
      const ty = typeBordereau(PL, doc);
      const z = zoneEtiquette(PL, doc.getPages()[0]);
      const e = types.get(ty.cle) || { ...ty, n: 0, isoles: 0, raisons: new Set(), exemple: null };
      e.n++; if (z.ok) e.isoles++; else e.raisons.add(z.raison || 'mise en page inconnue');
      if (!e.exemple) {
        // Les deux impressions, faites par LE code d'impression (`poserBordereau`),
        // avec un N° d'exemple — ce qu'on voit est ce qui sortira.
        const fabrique = async (thermique) => { const src = await PL.PDFDocument.load(lu.octets); const out = await PL.PDFDocument.create();
          // le N° tombe là où il tombera vraiment : l'emplacement appris pour ce format
          const { width: fw, height: fh } = src.getPages()[0].getSize();
          const pos = (load('vinted_bordereau_formats', {}) || {})[bordereauFormatKey(fw, fh)] || smartDefaultBordPos(fw, fh);
          const r1 = await poserBordereau(PL, out, src, { numero: '123', title: '', pos, thermique }); return { octets: await out.save(), r1, pages: out.getPageCount() }; };
        const modes=await preparerApercusModes(fabrique);
        e.exemple={...modes,zone:z.ok?z:null};
        if(Object.keys(modes.erreurs).length) rates++;
      }
      types.set(ty.cle, e);
    }
    const sens = new Set([...types.values()].map((e) => e.type + '|' + e.sens));
    const doubles = new Set([...types.values()].filter((e) => [...sens].filter((k) => k.startsWith(e.type + '|')).length > 1).map((e) => e.type));
    setAp({ etat: 'lu', lus, rates, total: lignes.length, types: [...types.values()].sort((a, b) => b.n - a.n), doubles, partiel: emails === null || captes === null });
  };
  const charger = async () => {if(ap?.etat==='charge')return;try{await chargerBrut();}catch(_){setAp({etat:'erreur'});}};
  const vus = ap && ap.etat === 'lu' ? new Set(ap.types.map((e) => e.type)) : new Set();
  return (
    <div data-imprimante-reglage={mode} style={nu ? {} : {padding:'13px 16px',borderRadius:12,border:`1px solid ${C.border}`,background:C.card,marginBottom:8}}>
      {!nu && <div style={{fontSize:13,fontWeight:600,color:C.text}}>Imprimante et bordereaux</div>}
      <Segmente label="Imprimante" plein value={mode} onChange={choisir} style={{marginTop:nu?0:10}}
        options={IMPR_MODES.map((v) => ({ v, l: v === 'thermique' ? 'Thermique · 10×15' : 'Normale · A4', data: { 'data-imprimante-choix': v } }))}/>
      <div className="vrm-setting-applique" role="status" style={{color:erreurMode?C.warn:C.text}}>{erreurMode||`Format appliqué sur cet appareil : ${mode==='thermique'?'étiquettes 100 × 150 mm':'papier A4'}.`}</div>
      <GuideReglage titre="Avant d’imprimer" etapes={[
        ['Choisis le papier', 'A4 pour une imprimante classique ; 100 × 150 mm pour une imprimante thermique.'],
        ['Vérifie le document', 'Ouvre un aperçu reçu sur ta boutique et contrôle que les codes restent lisibles et que le N° et le titre sont posés hors des codes (ou dans la bande, ou sur la fiche colis).'],
        ['Contrôle la fenêtre d’impression', 'Vérifie le papier et l’échelle. L’app prépare le PDF ; le pilote de ton imprimante décide du réglage final.']
      ]}/>
      <div data-imprimante-phrase style={{fontSize:13,color:C.muted,marginTop:10,lineHeight:1.5}}>
        {mode === 'thermique'
          ? <>Une étiquette par page, <b style={{color:C.text}}>10 × 15 cm</b>, ton N° dessus ; étiquette pas repérée ⇒ page <b style={{color:C.text}}>entière</b>. <Pourquoi label="Détail">Chaque étiquette sort seule, tournée à l’endroit et entière (sans la fiche destinataire ni la pub), ton N° dans un espace blanc vérifié. Quand l’app ne sait pas repérer l’étiquette sur un bordereau, la page part entière et l’écran le dit — jamais un code-barres coupé.</Pourquoi></>
          : <>A4, <b style={{color:C.text}}>une feuille par bordereau</b>, ton N° dans un blanc du PDF. <Pourquoi label="Recto-verso ?">Le document n’est pas réduit. Si ton imprimante sort du recto-verso, décoche-le dans sa fenêtre d’impression : le PDF le demande, le pilote peut passer outre.</Pourquoi></>}
      </div>
      <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>Tes types de bordereaux</div>
        {ap&&ap.etat!=='charge'&&<button type="button" onClick={charger} style={{marginTop:8,minHeight:44,border:`1px solid ${C.border}`,borderRadius:12,background:'transparent',color:C.text,padding:'8px 12px',font:'inherit',cursor:'pointer'}}>Actualiser les aperçus</button>}
        {!ap && <>
          <div style={{fontSize:13,color:C.muted,marginTop:4,lineHeight:1.5}}>Pour chaque type que l’app a reçu, ce qui sortira sur une imprimante normale et sur une thermique. Calculé sur tes {APERCU_MAX} derniers bordereaux.</div>
          <button type="button" data-apercus-voir onClick={charger} style={{marginTop:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'0 16px',minHeight:44,fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Voir les aperçus</button>
        </>}
        {ap && ap.etat === 'charge' && <div data-apercus="charge" style={{fontSize:13,color:C.muted,marginTop:6}}>Je lis tes bordereaux…</div>}
        {ap&&ap.etat==='erreur'&&<p role="alert" style={{color:C.warn,fontSize:12}}>Les aperçus n’ont pas pu être préparés. Aucun bordereau n’a été modifié. Utilise « Actualiser les aperçus » pour réessayer.</p>}
        {ap && ap.etat === 'pasSu' && <div data-apercus="passu" style={{fontSize:13,color:C.muted,marginTop:6,lineHeight:1.5}}>La base n’a pas répondu : je n’ai pas pu lire tes bordereaux. <button type="button" onClick={charger} style={{border:'none',background:'none',padding:0,color:C.text,textDecoration:'underline',cursor:'pointer',font:'inherit'}}>Réessayer</button></div>}
        {ap && ap.etat === 'vide' && <div data-apercus="vide" style={{fontSize:13,color:C.muted,marginTop:6,lineHeight:1.5}}>{ap.partiel ? 'Une partie de tes bordereaux n’a pas pu être lue, et aucun PDF n’est arrivé dans le reste.' : 'Aucun bordereau avec son PDF pour l’instant : les aperçus apparaîtront avec ta prochaine vente.'}</div>}
        {ap && ap.etat === 'lu' && <div data-apercus="lu" style={{marginTop:6}}>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.5}} data-apercus-compte={ap.lus}>
            D’après tes {ap.lus} derniers bordereaux{ap.total > ap.lus + ap.rates ? ` (sur ${ap.total})` : ''}.{ap.rates > 0 ? ` ${ap.rates} n’ont pas pu être préparés ou vérifiés.` : ''}{ap.partiel ? ' Une partie de la liste n’a pas pu être lue.' : ''} Le N° montré est un exemple.
          </div>
          {ap.types.map((e) => (
            <div key={e.cle} data-apercu-type={e.type} data-apercu-isoles={e.isoles} data-apercu-n={e.n} style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>{e.type === 'autre' ? `Autre mise en page (${Math.round(e.W / MM_PT)} × ${Math.round(e.H / MM_PT)} mm)` : nomTypeBordereau(e.type)}{ap.doubles.has(e.type) ? (e.sens === 'paysage' ? ' · page couchée' : ' · page debout') : ''}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.45}}>
                {e.n} bordereau{e.n > 1 ? 'x' : ''} · {e.isoles === e.n ? (e.n > 1 ? 'étiquette repérée sur tous' : 'étiquette repérée') : e.isoles === 0 ? <>étiquette <b style={{color:C.text}}>non repérée</b> : en thermique la page part entière ({[...e.raisons].join(' · ')})</> : <>étiquette repérée sur {e.isoles} — les autres partent entières en thermique ({[...e.raisons].join(' · ')})</>}
              </div>
              {Object.entries(e.exemple?.erreurs||{}).map(([mode,message])=><p key={mode} role="alert" style={{fontSize:12,color:C.warn}}><b>{mode==='normale'?'A4':'Thermique'} :</b> {message}</p>)}
              {e.exemple && <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:10,alignItems:'flex-start'}}>
                {e.exemple.normale && <ApercuPdf octets={e.exemple.normale.octets} largeur={180} zone={e.exemple.zone} label={e.exemple.zone ? 'Normale · A4 (en pointillés : ce qui part en thermique)' : 'Normale · A4'}/>}
                {e.exemple.thermique && Array.from({ length: e.exemple.thermique.pages }, (_, i) => (
                  <ApercuPdf key={i} octets={e.exemple.thermique.octets} page={i + 1} largeur={e.exemple.thermique.r1.isole ? 120 : 180}
                    label={e.exemple.thermique.r1.isole ? `Thermique · 10×15${e.exemple.thermique.pages > 1 ? ` (${i + 1}/${e.exemple.thermique.pages})` : ''}` : 'Thermique · page entière'}/>
                ))}
              </div>}
            </div>
          ))}
          {(() => { const jamais = TYPES_BORDEREAU.filter(([k]) => !vus.has(k)); return jamais.length ? (
            <div data-apercus-jamais={jamais.map(([k]) => k).join(',')} style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`,fontSize:12,color:C.muted,lineHeight:1.5}}>
              <b style={{color:C.text}}>Pas encore vus</b> dans tes derniers bordereaux : {jamais.map(([, l]) => l).join(' · ')}. Pas d’aperçu inventé : il apparaîtra avec le premier reçu. En thermique, l’app les découpera si elle repère l’étiquette, sinon la page partira entière.
            </div>) : null; })()}
        </div>}
      </div>
    </div>
  );
};
// ⟦← App.jsx #28⟧
const ecrireReglesStream = (r) => {
  const n = normaliserRegles(r);
  // `save` écrit l'appareil (puis le nuage) après un court délai : la règle, elle,
  // change TOUT DE SUITE, et les écrans ouverts la reçoivent par l'événement.
  poserReglesStreamEnAttente(n);
  save(CLE_STREAM_REGLES, n);
  poserReglesStream(n);
  try { window.dispatchEvent(new CustomEvent('vrm:stream-regles', { detail: n })); } catch (_) {}
};
// ⟦← App.jsx #29⟧

// ══════════════════════════════════════════════════════════════════════════════
//  LES PREMIERS PAS — UNE SEULE RÈGLE, DEUX ÉCRANS (§11)
// ══════════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ IL Y AVAIT DEUX ONBOARDINGS, ET ILS NE DISAIENT PAS LA MÊME CHOSE.
// Mesuré au rendu le 16 septembre sur une installation neuve : le tableau de
// bord récitait « 3 étapes » (installe « Shop Cancale35 – Vinted Sync », va sur
// vinted.fr, reviens ici) — SANS lien de téléchargement, avec le nom de la
// boutique de quelqu'un d'autre, et surtout SANS l'étape qui sépare les
// vendeurs : se connecter à l'extension avec le même email. Ma journée, elle,
// en disait quatre, mesurées. Deux écrans, deux consignes, sur les deux
// premières pages que voit une nouvelle personne. C'est §11 mot pour mot.
// ⇒ La règle vit ICI. Les deux écrans la RENDENT, ils ne la réécrivent pas.
//
// ⚠️ TROIS ÉTATS PARTOUT : le pont dit si l'extension tourne dans CE
// navigateur, `vmrAuthEtat` sous quel compte elle écrit — et « pas su » ne vaut
// ni oui ni non.
// EST-CE QU'ON PEUT INSTALLER UNE EXTENSION CHROME ICI ?
// ⚠️ On ne devine PAS « c'est un téléphone » : on MESURE l'entrée. Un appareil
// sans souris du tout (pointeur grossier ET aucun survol) ne peut pas ouvrir
// `chrome://extensions` — c'est vrai des téléphones comme des tablettes, et ça
// reste vrai le jour où la marque change. Un portable tactile, lui, a une
// souris : il déclare `pointer: fine`, et rien ne change pour lui.
// Mesuré au rendu le 16 septembre : sur iPhone, la carte déroulait quand même
// « va sur chrome://extensions », « Mode développeur », « Charger l'extension
// non empaquetée » — et proposait de TÉLÉCHARGER un zip sur un téléphone, où il
// ne sert à rien. La seule ligne vraie (« fais-le sur un ordinateur ») était en
// tout petit, tout en bas.
// Les clés d'une RÉPONSE D'ERREUR de Vinted (corps `{code, message,
// message_code, errors, payload}`) : un échantillon de « dérive de forme » qui
// n'a QUE celles-là est un refus, pas un renommage (voir État des connexions).
const CLES_ERREUR_VINTED = new Set(['code', 'message', 'message_code', 'errors', 'payload']);
function estCorpsErreurVinted(cles) {
  return Array.isArray(cles) && cles.length > 0 && cles.includes('message_code') && cles.every(k => CLES_ERREUR_VINTED.has(String(k)));
}
// ⟦← App.jsx #30⟧
// (29 oct.) UN PARCOURS EN PLUSIEURS ÉTAPES se lit toujours pareil — Julien :
// « pour les republications la barre de progression est incompréhensible ».
// Quatre choses, dans cet ordre, et une seule barre :
//   · `titre`  — où j'en suis, en mots (« Paire 2 sur 5 », « En pause », « Terminé ») ;
//   · `phrase` — ce qui se passe maintenant (une phrase) ;
//   · `part`   — 0 à 1, la barre (une seule par parcours) ;
//   · `compte` — combien sont faites / ratées / restent (`compteAvancement`) ;
//   · `erreur` — ce qui a raté et quoi faire (vide si rien n'a raté).
// Pas de jargon (« passage », « file », « job »). `data` passe les data-* des bancs.
function compteAvancement({ faites = 0, ratees = 0, restent = 0, motFait = 'faite', motFaits }) {
  const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  return [pl(faites, motFait, motFaits), ratees ? pl(ratees, 'ratée') : null, restent ? pl(restent, 'restante') : null].filter(Boolean).join(' · ');
}
// ⟦← App.jsx #31⟧
// ⟦→ ecrans/Stock.jsx #9⟧


/* ── COMPTES LIÉS : TOUTES LES PLATEFORMES (3 nov.) ─────────────────────────
   Julien : « Comptes liés : il doit y avoir les comptes Leboncoin, Vestiaire et
   eBay ; tout ce qui est fait pour Vinted doit être fait pour le reste ». Une
   liste groupée par plateforme, la même carte (`CarteCompteLie`) ; les règles
   sont dans src/comptesLies.js, le choix « dans les totaux » des autres sites
   dans api/_lib/comptes-exclus.js. Lecture : trois états par plateforme
   (`undefined` en cours · `null` pas su · lu) — « pas su » n'est jamais « aucun compte ». */
const URL_SITE_COMPTE = { vinted: 'https://www.vinted.fr/', vestiaire: 'https://fr.vestiairecollective.com/', leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces', ebay: 'https://www.ebay.fr/' };
// LA DERNIÈRE CAPTURE DE CHAQUE COMPTE VINTED (une règle, §11 : Comptes liés et
// le panneau de l'indicateur la lisent). uid → ms ; `null` = pas su (lecture
// ratée), jamais un objet vide présenté comme « jamais capté ».
// ⚠️ 1 127 lignes `harvest_*` en base : au-delà de 1 000, Supabase tronque en
// silence (§A1) — `lireTout` pagine. Les lignes vidées (comptes supprimés) sont
// écartées : elles ne disent plus rien sur un compte vivant.
// ⚠️ Revue de la 5.167 : `harvest_{uid}_enligne` est la lecture PUBLIQUE de son
//    dressing, faite avec la session d'un AUTRE compte — comptée, elle faisait
//    dire « À jour » à un compte figé depuis trois jours. `ligneDeSaSession`.
async function lireDernieresCaptures() {
  const d = await lireCapturesDetail();
  return d ? d.by : null;
}
// ⟦← App.jsx #32⟧
// UNE carte pour chaque compte, quelle que soit la plateforme. Les attributs
// `data-compte-*` sont ce que lisent les bancs (jamais un libellé, §6.4).
function CarteCompteLie({ plateforme, id, nom, photo, etat, age, type, inclus, onInclus, action, secondaire, etatVinted, enfants, emails = null }) {
  const libre = LIBELLE_ETAT[etat] || '';
  return (
    <div className="vrm-cl-carte" data-compte-lie={plateforme} data-compte-id={id} data-compte-etat={etat} data-compte-inclus={inclus == null ? '' : inclus ? '1' : '0'}>
      <div className="vrm-cl-tete">
        <span className="vrm-cl-avatar" data-compte-photo={photo ? 'oui' : 'non'} aria-hidden="true">
          {photo ? <PhotoVinted src={photo} alt="" loading="lazy"/> : String(nom || '?').replace(/^n° /, '').slice(0, 1).toUpperCase()}
        </span>
        <div className="vrm-cl-corps">
          <div className="vrm-cl-nom vrm-sensible" data-stream-type="compte">{nom}</div>
          <span className={'vrm-cl-etat is-' + etat} {...(etatVinted ? { 'data-etat-compte': etatVinted.etat, 'data-etat-source': etatVinted.source || '', title: etatVinted.hint } : {})}>{libre}</span>
          {age && etat !== 'ouvert' && etat !== 'jamais' && <span className="vrm-cl-age">{age}</span>}
          {type && <span className="vrm-cl-type" data-type-compte={type}>{type === 'pro' ? 'Pro' : 'Particulier'}</span>}
        </div>
        {inclus != null && (
          <label className="vrm-cl-inclus" title="Dans les totaux">
            <input type="checkbox" role="switch" checked={!!inclus} onChange={onInclus} aria-label={`${nom} dans les totaux`} data-compte-inclus-bouton=""/>
            <span aria-hidden="true"/>
          </label>
        )}
      </div>
      {emails}
      {(action || secondaire) && <div className="vrm-cl-actions">{action}{secondaire}</div>}
      {enfants}
    </div>
  );
}
// ⟦← App.jsx #33⟧
// (6 nov., vague 2, point 5) LA LIGNE « E-MAILS » D'UNE CARTE VINTED : la règle des
// comptes sans e-mail (`etatEmailsComptes`, celle de Notifications et d'Achats — §11),
// projetée par `ligneEmailsCompte` (src/emailsCompteLie.js). Le geste n'apparaît que
// sur un compte MUET prouvé : il ouvre E-mails → Relier ma boîte, sur les adresses.
// (6 nov., onglets C) Le geste NOMME le compte et ouvre SON pas-à-pas (avec la vérification) :
// `relierBoiteDe(uid)` — le même chemin depuis Comptes liés, Colis et Ma journée.
function LigneEmailsCompte({ ligne, uid, login }) {
  if (!ligne) return null;
  const relier = () => relierBoiteDe(uid);
  return (
    <div className="vrm-cl-emails" data-compte-emails={ligne.etat} data-compte-emails-jours={ligne.jours != null ? String(ligne.jours) : undefined}>
      <span className="vrm-cl-emails-lib">{L.emails}</span>
      <span className={'vrm-cl-emails-txt' + (ligne.geste ? ' is-geste' : '')}>{ligne.texte}</span>
      {ligne.geste && <button type="button" className="vrm-lien-action vrm-cl-emails-geste" data-compte-emails-relier={uid || ''} onClick={relier}>{login ? `Relier la boîte de ${login}` : L.relierBoite.replace(/\bma\b/, 'sa')}</button>}
    </div>
  );
}
function GroupeComptes({ plateforme, n, enfants, pasSu, onRelire, attrs }) {
  const p = PLATEFORMES_COMPTES.find((x) => x.id === plateforme);
  return (
    <section className="vrm-cl-groupe" data-comptes-groupe={plateforme} {...(attrs || {})}>
      <div className="vrm-fu-titre-section"><h2>{p ? p.nom : plateforme}</h2>{n != null && <span>{n}</span>}</div>
      {pasSu ? <div className="vrm-cl-vide" data-comptes-pas-su={plateforme}>— <button type="button" className="vrm-lien-action" onClick={onRelire}>Réessayer</button></div> : enfants}
    </section>
  );
}
// Les groupes Vestiaire, Leboncoin et eBay (Vinted est rendu par l'écran, avec ses outils).
function ComptesAutresSites({ lu, relire }) {
  const [exclus, setExclus] = useComptesExclus();
  const maintenant = Date.now();
  const basculer = (plateforme, id) => { const n = basculerExclu(exclus, plateforme, id); setExclus(n); save(CLE_COMPTES_EXCLUS, n); };
  const [ebayEnCours, setEbayEnCours] = React.useState({});
  const ouvrir = (plateforme) => <a className="vrm-b vrm-b-discret vrm-cl-bouton" href={URL_SITE_COMPTE[plateforme]} target="_blank" rel="noreferrer" data-compte-action="ouvrir">Ouvrir</a>;
  const relireEbay = async (c) => {
    setEbayEnCours((m) => ({ ...m, [c.ref]: 'relire' }));
    const { j } = await appelEbay({ action: 'relire', ...corpsCompteEbay(c.ref) });
    setEbayEnCours((m) => { const n = { ...m }; delete n[c.ref]; return n; });
    if (!(j && j.ok)) toast((j && j.error) || 'eBay n’a pas répondu — rien n’a changé, réessaie.');
    signalerComptesEbay(); relire();
  };
  const relierEbay = async (c) => {
    setEbayEnCours((m) => ({ ...m, [c.ref]: 'relier' }));
    try {
      const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'authurl', state: 'vrm', ...(c.principal ? {} : { ajout: true }) }) });
      const j = await r.json();
      if (j && j.ok && j.url) { window.location.href = j.url; return; }
      toast((j && j.error) || 'Impossible de démarrer la connexion à eBay — réessaie.');
    } catch (_) { toast('Impossible de démarrer la connexion à eBay — réessaie.'); }
    setEbayEnCours((m) => { const n = { ...m }; delete n[c.ref]; return n; });
  };
  const delierEbay = async (c) => {
    const nom = nomCompteLie(c);
    const tR = texteReglesQuiRestent(await compterReglesEbay(await lireComptesEbay(), c.ref), 'deconnecter');
    const ok = await askConfirm({ title: `Délier « ${nom} » ?`, desc: `VRM ne lira plus ses annonces ni ses ventes, et ne publiera plus rien dessus. Ses annonces restent en ligne sur eBay.${tR ? `\n\n${tR}` : ''}`, ok: 'Délier', cancel: 'Annuler', danger: true });
    if (!ok) return;
    setEbayEnCours((m) => ({ ...m, [c.ref]: 'delier' }));
    const { j } = await appelEbay({ action: 'deconnecter', confirme: true, ...(c.principal ? {} : { compte: c.cle }) });
    setEbayEnCours((m) => { const n = { ...m }; delete n[c.ref]; return n; });
    if (!(j && j.ok)) toast((j && j.error) || 'Je n’ai pas pu le délier — rien n’a changé, réessaie.');
    signalerComptesEbay(); relire();
  };
  const groupe = (plateforme, liste, carte) => (liste === undefined ? null
    : <GroupeComptes key={plateforme} plateforme={plateforme} n={Array.isArray(liste) && liste.length ? liste.length : null} pasSu={liste === null} onRelire={relire}
        enfants={liste.length ? liste.map(carte) : <div className="vrm-cl-vide" data-comptes-vide={plateforme}>{ouvrir(plateforme)}</div>}/>);
  return (<>
    {groupe('vestiaire', lu.vestiaire, (c) => {
      const etat = etatCompteLie({ ouvert: c.ouvert, lu: c.lu, maintenant });
      return <CarteCompteLie key={c.id} plateforme="vestiaire" id={c.id} nom={nomCompteLie(c)} etat={etat} age={ageLecture(c.lu, maintenant)}
        inclus={!estExclu(exclus, 'vestiaire', c.id)} onInclus={() => basculer('vestiaire', c.id)} action={ouvrir('vestiaire')}/>;
    })}
    {groupe('leboncoin', lu.leboncoin, (c) => {
      const etat = etatCompteLie({ ouvert: c.ouvert, lu: c.lu, maintenant });
      return <CarteCompteLie key={c.id} plateforme="leboncoin" id={c.id} nom={nomCompteLie(c)} etat={etat} age={ageLecture(c.lu, maintenant)} type={c.type}
        inclus={!estExclu(exclus, 'leboncoin', c.id)} onInclus={() => basculer('leboncoin', c.id)} action={ouvrir('leboncoin')}/>;
    })}
    {groupe('ebay', lu.ebay, (c) => {
      const etat = etatCompteLie({ delie: c.delie, lu: c.lu, maintenant });
      const enCours = ebayEnCours[c.ref];
      const action = c.delie
        ? <Bouton className="vrm-cl-bouton" data-compte-action="relier" disabled={!!enCours} onClick={() => relierEbay(c)}>{enCours ? '…' : 'Relier'}</Bouton>
        : <Bouton className="vrm-cl-bouton" data-compte-action="relire" disabled={!!enCours} onClick={() => relireEbay(c)}>{enCours === 'relire' ? '…' : 'Relire'}</Bouton>;
      const secondaire = c.delie ? null : <Bouton variante="discret" className="vrm-cl-bouton" data-compte-action="delier" disabled={!!enCours} onClick={() => delierEbay(c)}>{enCours === 'delier' ? '…' : 'Délier'}</Bouton>;
      return <CarteCompteLie key={c.ref} plateforme="ebay" id={c.ref} nom={nomCompteLie(c)} etat={etat} age={ageLecture(c.lu, maintenant)} type={c.type}
        inclus={c.delie ? null : !estExclu(exclus, 'ebay', c.ref)} onInclus={() => basculer('ebay', c.ref)} action={action} secondaire={secondaire}/>;
    })}
  </>);
}

/* ── Comptes Vinted liés (gestion des comptes uniquement) ───────────────
   Cet écran ne sert plus qu'à GÉRER les comptes liés (les capturés par
   l'extension) : les lister, les renommer, tester la connexion, resynchroniser.
   Les données (annonces, ventes, achats, messages, bordereaux) vivent désormais
   dans les onglets DÉDIÉS du menu (Annonces / Ventes / Achats / Bordereaux /
   Messages), tous rendus par <Comptabilite/>. On a donc retiré d'ici tout ce
   qui était en doublon (numérotation, sélecteur d'achat, vues, conversations,
   bordereaux) — un seul endroit par chose. */
function VintedAccounts({ accounts, setAccounts, baseKO, onRetour }) {
  const [loading, setLoading] = useState(false);

  const [labels, setLabels] = useStateCle('vinted_account_labels', () => load('vinted_account_labels', {}));
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');
  // Email associé à chaque compte (l'adresse à laquelle Vinted écrit — masquée
  // iCloud ou classique). Sert au serveur pour attribuer chaque email de vente/
  // bordereau au bon compte. Synchronisé (vinted_account_emails).
  const [acctEmails, setAcctEmails] = useStateCle('vinted_account_emails', () => load('vinted_account_emails', {}));
  // Téléphone de chaque compte (Julien, 30 sept. : « pour ceux qui font du
  // multi-compte, savoir si les numéros ont servi »). Saisi à la main — Vinted
  // ne l'expose pas dans ce qu'on capte, on ne le devine pas. Synchronisé.
  const [acctPhones, setAcctPhones] = useStateCle('vinted_account_phones', () => load('vinted_account_phones', {}));
  // §5.49 : étiquettes/emails/téléphones des comptes, synchronisés, lus au
  // montage → froids sur un appareil neuf. Cartes : on ne remplit que si vide,
  // jamais par-dessus une saisie faite pendant le chargement.
  useEffect(() => onCloudReady(() => {
    const vide = (o) => !o || Object.keys(o).length === 0;
    setLabels(n => vide(n) ? load('vinted_account_labels', {}) : n);
    setAcctEmails(n => vide(n) ? load('vinted_account_emails', {}) : n);
    setAcctPhones(n => vide(n) ? load('vinted_account_phones', {}) : n);
  }), []);
  const setAcctPhone = (uid, val) => {
    const u = { ...acctPhones, [String(uid)]: val };
    if (!String(val).trim()) delete u[String(uid)];
    setAcctPhones(u); save('vinted_account_phones', u);
  };
  // Même numéro sur deux comptes : la comparaison se fait chiffres seuls
  // (« 06 12… » et « +33 6 12… » sont le même numéro).
  const telNorm = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.startsWith('33') && d.length === 11 ? '0' + d.slice(2) : d; };
  const [reput, setReput] = useState({}); // { uid: { rating, count, pos, neg } } — note vendeur captée
  const [typesProfil, setTypesProfil] = useState({}); // { uid: true (pro) | false (particulier) } — lu dans le profil capté
  const [photosProfil, setPhotosProfil] = useState({}); // { uid: adresse de la photo de profil Vinted } — lue dans le profil capté
  const setAcctEmail = (uid, val) => {
    const conflit=conflitAdresseCompte(acctEmails,uid,val);
    if(conflit){const autre=accounts.find(a=>String(a.vinted_user_id)===conflit);toast(`Cette adresse est déjà associée à ${autre?.login||'un autre compte Vinted'}. Chaque compte doit avoir son adresse.`);return;}
    const u = { ...acctEmails, [String(uid)]: val.trim() };
    if (!u[String(uid)]) delete u[String(uid)];
    setAcctEmails(u); save('vinted_account_emails', u);
  };
  // Auto-remplissage : l'extension capte le profil Vinted (users/current) qui
  // contient l'email du compte. On remplit les champs vides automatiquement —
  // la saisie manuelle reste possible et n'est jamais écrasée.
  useEffect(() => { (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_*_profile&select=id,data`, {
        headers: sbAuth(),
      });
      if (!res.ok) return;
      const rows = await res.json();
      // Note vendeur (feedback_reputation 0..1) + nb d'avis, si Vinted les fournit.
      const rep = {};
      rows.forEach(r => {
        const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        const usr = r.data && r.data.payload && r.data.payload.user;
        if (uid && usr) {
          const rating = typeof usr.feedback_reputation === 'number' ? usr.feedback_reputation : null;
          const count = Number.isFinite(usr.feedback_count) ? usr.feedback_count : null;
          if (rating != null || count != null) rep[uid] = { rating, count, pos: usr.positive_feedback_count, neg: usr.negative_feedback_count };
        }
      });
      if (Object.keys(rep).length) setReput(rep);
      // Photo de profil Vinted (Julien, 27 oct. : « dans Comptes liés, la photo
      // de profil, pour tous les comptes »). Le profil capté la porte déjà ;
      // un compte sans photo sur Vinted garde son initiale.
      const ph = {};
      rows.forEach(r => {
        const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        const photo = r.data && r.data.payload && r.data.payload.user && r.data.payload.user.photo;
        if (!uid || !photo || typeof photo !== 'object') return;
        const th = Array.isArray(photo.thumbnails) ? photo.thumbnails : [];
        const petit = th.find(t => t && /100|150|thumb/.test(String(t.type || '')) && t.url);
        const u = (petit && petit.url) || photo.url || photo.full_size_url || '';
        if (/^https:\/\//.test(u)) ph[uid] = u;
      });
      if (Object.keys(ph).length) setPhotosProfil(ph);
      const typ = {};
      rows.forEach(r => {
        const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        const t = typeCompteVinted(r.data && r.data.payload);
        if (uid && typeof t === 'boolean') typ[uid] = t;
      });
      if (Object.keys(typ).length) setTypesProfil(typ);
      setAcctEmails(prev => {
        const u = { ...prev }; let changed = false;
        rows.forEach(r => {
          const uid = String((r.data && r.data.uid) || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
          const email = r.data && r.data.payload && r.data.payload.user && r.data.payload.user.email;
          if (uid && email && !u[uid] && !conflitAdresseCompte(u,uid,email)) { u[uid] = email; changed = true; }
        });
        if (changed) save('vinted_account_emails', u);
        return changed ? u : prev;
      });
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })(); }, []);
  // ── DIAGNOSTIC : santé de chaque compte (dernière capture par l'extension) ──
  // Requête LÉGÈRE : on ne lit que la colonne updated_at des lignes harvest_* (pas
  // les gros payloads) → pour chaque compte, la date de dernière capture. Croisé
  // avec updated_at du compte (fraîcheur du token) et la liste des bloqués.
  const [lastCap, setLastCap] = useState({}); // uid -> ms de la dernière capture
  const blockedAccts = useMemo(() => new Set((load('vinted_accounts_blocked', []) || []).map(String)), []);
  useEffect(() => { (async () => { const by = await lireDernieresCaptures(); if (by) setLastCap(by); })(); }, []);
  // ÉTAT ÉVALUÉ PAR L'EXTENSION (5.181, `noterEtatCompte`) : actif / banni, lu
  // dans le champ `is_account_banned` du profil Vinted qu'elle reçoit déjà.
  // Trois états : `undefined` en cours · `null` pas su (lecture ratée) · objet lu.
  // « Pas su » ne fait jamais « banni » : on retombe sur ce qu'on savait déjà.
  const [etatExt, setEtatExt] = useState(undefined);
  useEffect(() => {
    let mort = false, t = null;
    const lire = async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_comptes_etat&select=data`, { headers: sbAuth() });
        if (!r.ok) { if (!mort) setEtatExt(null); return; }
        const rows = await r.json();
        if (!Array.isArray(rows)) { if (!mort) setEtatExt(null); return; }
        const d = (rows[0] && rows[0].data) || {};
        if (!mort) setEtatExt((d.comptes && typeof d.comptes === 'object') ? d.comptes : {});
      } catch (_) { if (!mort) setEtatExt(null); }
    };
    lire();
    const f = (e) => { const d = e && e.detail; if (!d || d.type !== 'maj' || d.quoi !== 'etatcompte') return; clearTimeout(t); t = setTimeout(lire, 800); };
    window.addEventListener('vrm:ext', f);
    return () => { mort = true; clearTimeout(t); window.removeEventListener('vrm:ext', f); };
  }, []);
  // ⚠️ 1 compte Vinted = 1 compte VRM (verrou en base, index unique global).
  // Si le compte Vinted ouvert dans TON Chrome n'est pas dans tes comptes liés
  // ET appartient déjà à un AUTRE compte VRM, VRM ne captera rien pour lui :
  // on le DIT clairement (sinon l'écran reste vide, sans explication). Le
  // serveur ne répond qu'un oui/non — jamais QUI le possède. « Pas su » (pas de
  // clé de service, lecture ratée, compte à soi, compte libre) ⇒ pas d'alerte.
  const [vintedPris, setVintedPris] = useState(false);
  const prisRef = React.useRef('');
  useEffect(() => {
    let mort = false;
    const verifier = () => {
      const v = vintedDeChrome();
      const uid = v && v.uid ? String(v.uid) : '';
      if (!uid || accounts.some(a => String(a.vinted_user_id) === uid)) { prisRef.current = ''; setVintedPris(false); return; }
      if (prisRef.current === uid) return; // déjà vérifié ce compte
      prisRef.current = uid;
      fetch(`/api/compte?mode=vinted-pris&id=${encodeURIComponent(uid)}`, { headers: enTeteSession() })
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (!mort) setVintedPris(j && j.pris ? { login: (v.login || ''), uid } : false); })
        .catch(() => { if (!mort) setVintedPris(false); });
    };
    verifier();
    const f = () => verifier();
    window.addEventListener('vrm:ext', f);
    return () => { mort = true; window.removeEventListener('vrm:ext', f); };
  }, [accounts]);
  const acctHealth = (acc) => {
    const uid = String(acc.vinted_user_id);
    const ev = etatExt && etatExt[uid];
    const evLu = ev && (ev.etat === 'banni' || ev.etat === 'actif') ? ev : null;
    const evQuand = evLu && evLu.at ? (() => { try { return new Date(evLu.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return ''; } })() : '';
    // ⚠️⚠️ UN CHOIX N'EST PAS UNE PANNE. Vu en capture le 9 septembre :
    // l'en-tête annonçait « 2 en panne » en ROUGE, et l'un des deux était
    // `liliand653` — le compte que Julien a lui-même EXCLU de l'application
    // (le bandeau juste au-dessus le dit : « 1 compte est exclu »). Sa carte
    // affichait donc « Masqué (annonces + compta) » ET « Pas capté (il y a
    // 38 j) » en rouge, avec le conseil « repasse sur vinted.fr » — c'est-à-dire
    // exactement ce qu'il ne faut PAS faire pour un compte qu'on a mis de côté.
    // Même famille que le panneau de sécurité : une fausse alerte est ce qui
    // fait cesser de lire les vraies. Un compte exclu n'a plus d'état de
    // fraîcheur — il est simplement hors de l'app, en gris, sans consigne.
    // ⚠️ Cette branche vient EN PREMIER, avant même « refusé par Vinted » :
    // masquer un compte est très souvent la RÉPONSE à un blocage (le bouton le
    // dit : « idéal pour un compte bloqué ou fermé »). Une fois le geste fait,
    // l'app n'a plus à le réclamer. La raison reste écrite dans l'infobulle.
    if (hiddenAccts.has(uid)) return { etat: 'exclu', ic: 'eyeOff', label: 'Exclu de l\'app', color: C.muted,
      hint: `Tu as masqué ce compte : ses annonces, ses ventes et ses achats n'apparaissent nulle part.${blockedAccts.has(uid) ? ' (Vinted l\'avait aussi refusé.)' : ''} Sa date de capture ne veut donc plus rien dire ici — rien à rattraper.` };
    // L'extension l'a LU dans le profil Vinted : c'est la preuve la plus forte,
    // elle passe avant la liste locale (un refus 403 vu par cet appareil).
    if (evLu && evLu.etat === 'banni') return { etat: 'bad', source: 'extension', ic: 'alert', label: 'Banni par Vinted', color: C.danger, hint: `Vinted le dit lui-même dans le profil du compte (lu par l'extension${evQuand ? ` le ${evQuand}` : ''}). Rien n'est masqué tout seul : masque-le si tu ne veux plus voir ses annonces.` };
    if (!evLu && blockedAccts.has(uid)) return { etat: 'bad', source: 'appareil', ic: 'alert', label: 'Accès refusé', color: C.warn, hint: 'Vinted a refusé un accès à ce compte. Ce refus ne suffit pas à confirmer un blocage : reconnecte ce compte sur Vinted pour actualiser son état.' };
    // (16 oct.) Julien : « juste s'il est actif ou banni, l'extension doit
    // évaluer l'état du compte ». Deux états sur la pastille ; la fraîcheur de
    // la capture n'est plus une alerte, seulement une ligne grise (`ago`).
    const cap = lastCap[uid];
    const ageH = cap ? (Date.now() - cap) / 3600000 : null;
    const ago = ageH == null ? 'pas encore capté' : ageH < 1 ? 'capté il y a moins d\'une heure' : ageH < 48 ? `capté il y a ${Math.round(ageH)} h` : `capté il y a ${Math.round(ageH / 24)} j`;
    const lu = evLu ? ` · état lu par l'extension${evQuand ? ` le ${evQuand}` : ''}` : '';
    if (!evLu) return { etat: 'inconnu', source: '', ic: 'info', label: 'État non vérifié', color: C.muted, hint: `Le statut de ce compte n'a pas encore pu être confirmé. Ouvre ce compte sur Vinted avec l'extension connectée pour l'actualiser · ${ago}.`, ago };
    return { etat: 'ok', source: evLu ? 'extension' : '', ic: 'check', label: 'Actif', color: C.text, hint: `Compte actif · ${ago}${lu}.`, ago };
  };
  // Comptes exclus de la comptabilité (leurs ventes ne comptent pas).
  const [hiddenAccts, setHiddenAccts] = useState(() => new Set((load('vinted_accounts_hidden', []) || []).map(String)));
  // ⚠️ MASQUER SE DEMANDE, RÉAFFICHER NON. La confirmation vivait sur les puces
  // de l'écran Annonces (Julien masquait des comptes en croyant FILTRER —
  // vérifié en base) ; ces puces sont parties ici le 2 octobre (H1), la
  // confirmation les suit. Le geste retire le compte de partout, sur tous les
  // appareils.
  const toggleAcctCompta = async (uid) => {
    const k = String(uid);
    if (!hiddenAccts.has(k)) {
      const a = (accounts || []).find(x => String(x.vinted_user_id) === k);
      const nom = a ? (labels[a.vinted_user_id] || a.login || `#${k}`) : `#${k}`;
      const ok = await askConfirm({
        title: `Masquer « ${nom} » ?`,
        desc: "Ses annonces disparaissent de l'écran Annonces et ses ventes ne comptent plus dans la comptabilité, sur tous tes appareils. À réserver à un compte fermé ou abandonné — un nouveau tap le réaffiche.",
        ok: 'Masquer', cancel: 'Annuler', danger: true,
      });
      if (!ok) return;
    }
    setHiddenAccts(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); save('vinted_accounts_hidden', [...n]); return n; });
  };

  const startEditLabel = (acc) => { setEditingLabel(acc.vinted_user_id); setLabelDraft(labels[acc.vinted_user_id] || acc.login || ''); };
  const commitLabel = (acc) => {
    const u = { ...labels, [acc.vinted_user_id]: labelDraft.trim() };
    if (!u[acc.vinted_user_id]) delete u[acc.vinted_user_id];
    setLabels(u); save('vinted_account_labels', u);
    setEditingLabel(null);
  };
  const accountName = (acc) => labels[acc.vinted_user_id] || acc.login || `Compte #${acc.vinted_user_id}`;

  // Déconnecter un compte : le retire de l'app (Supabase + state). Utile quand un
  // compte est bloqué/fermé définitivement. On garde son étiquette au cas où.
  const [removing, setRemoving] = useState(null);
  const disconnectAccount = async (acc) => {
    if (!await askConfirm({
      title: `Supprimer « ${accountName(acc)} » ?`,
      // On dit exactement ce qui part, et ce qui reste. « Déconnecter » laissait
      // croire à un simple débranchement — Julien veut choisir ses comptes et
      // supprimer les autres pour de bon.
      desc: "Ses jetons, ses annonces, ses ventes et ses achats captés sont effacés, et l'extension ne le recaptera plus (avant, il revenait tout seul au bout de 10 minutes). Son chiffre d'affaires passé reste dans tes statistiques — c'est de l'argent réellement gagné. Tes numéros de garage et tes factures ne bougent pas. Réversible depuis « Tout réafficher ».",
      ok: 'Supprimer', cancel: 'Garder', danger: true,
    })) return;
    // ⚠️ UNE SEULE QUESTION. Une deuxième feuille s'ouvrait juste après la
    // première (« garder son chiffre d'affaires passé ? ») : deux boîtes à la
    // suite pour un seul geste, et surtout — mesuré au banc — tant qu'on n'y
    // répondait pas, LA SUPPRESSION NE PARTAIT PAS. On garde le comportement
    // sensé par défaut : ses ventes passées restent dans le chiffre d'affaires,
    // parce que c'est de l'argent réellement gagné. Ça ne se devine pas, c'est
    // écrit dans la confirmation ci-dessus.
    const login = String(acc.login || '').trim().toLowerCase();
    if (login) {
      const cur = (load('vinted_ca_keep_removed', []) || []).map(String);
      save('vinted_ca_keep_removed', [...new Set([...cur, login])]);
    }
    // ⚠️ On MASQUE aussi le compte de façon permanente (vinted_accounts_hidden,
    // clé synchronisée). Supprimer la ligne Supabase ne suffit pas : un compte
    // encore connecté dans Chrome est RE-CAPTURÉ par l'extension au prochain
    // passage sur Vinted, et il revenait dans les annonces + les stats (plainte
    // de Julien : « je l'ai supprimé mais il est toujours là »). Le masque, lui,
    // survit à la re-capture (il est posé sur l'uid, pas sur la ligne du compte)
    // → annonces ET stats l'excluent pour de bon (skipAcc / acctOff).
    // ⚠️ ON NE MASQUE PLUS EN PLUS DE SUPPRIMER. `deleteVintedAccount` inscrit
    // désormais le compte dans `vrm_blocked_accounts` (l'extension refuse de le
    // recapter) ET vide ses lignes moissonnées. Ajouter en prime son uid à
    // `vinted_accounts_hidden` — une clé SYNCHRONISÉE — le faisait apparaître
    // « masqué » sur tous les appareils alors qu'il était supprimé : c'est la
    // moitié de la confusion « mes comptes sont tous masqués » (§5.09/§5.10).
    setRemoving(acc.vinted_user_id);
    const r = await deleteVintedAccount(acc.vinted_user_id, acc.login);
    setRemoving(null);
    // ⚠️ Le mémo « ne le recapte plus » et la suppression des jetons sont DEUX
    //    choses. Quand le mémo n'a pas pu être écrit (base injoignable), le
    //    compte est bien parti mais l'extension peut le ramener : on le dit, et
    //    on dit le geste. Se taire, c'est le défaut d'origine (« je l'ai
    //    supprimé mais il est toujours là »).
    toast(!r.ok ? 'Échec de la suppression — réessaie.'
      : r.memo ? `« ${accountName(acc)} » supprimé.`
      : `« ${accountName(acc)} » supprimé — mais la base n'a pas répondu pour le mémo. S'il réapparaît, resupprime-le.`);
    setAccounts(prev => prev.filter(a => a.vinted_user_id !== acc.vinted_user_id));
  };

  // ── ANNONCES RETIRÉES POUR DE BON (26 oct.) — voir `annoncesRetirees` ─────────
  const [retireesAnn, setRetireesAnn] = useState(() => { const m = load(ANNONCES_RETIREES, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; });
  useEffect(() => onCloudReady(() => setRetireesAnn((v) => (Object.keys(v || {}).length ? v : ((() => { const m = load(ANNONCES_RETIREES, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; })())))), []);
  const retirerAnnoncesPourDeBon = async (acc) => {
    if (!acc) return;
    if (!await askConfirm({
      title: `Retirer les annonces de « ${accountName(acc)} » ?`,
      desc: "Ses annonces sortent de VRM pour de bon — elles ne reviennent pas, même si l'extension recapte ce compte. Ses ventes, sa compta, ses achats et ses messages restent. Rien n'est supprimé sur Vinted. Tu peux les remettre depuis cette carte.",
      ok: 'Retirer ses annonces', cancel: 'Annuler',
    })) return;
    const uid = String(acc.vinted_user_id);
    const suivant = { ...retireesAnn, [uid]: { at: new Date().toISOString(), login: acc.login || '' } };
    setRetireesAnn(suivant); save(ANNONCES_RETIREES, suivant);
    setDelCible(null);
    toast(`Annonces de « ${accountName(acc)} » retirées — rouvre l'onglet Annonces.`);
  };
  const remettreAnnonces = (acc) => {
    const uid = String(acc.vinted_user_id);
    const suivant = { ...retireesAnn }; delete suivant[uid];
    setRetireesAnn(suivant); save(ANNONCES_RETIREES, suivant);
    toast(`Annonces de « ${accountName(acc)} » remises.`);
  };

  // ── MESSAGES RETIRÉS POUR DE BON (26 oct.) — voir `messagesRetires` ──────────
  const [retiresMsg, setRetiresMsg] = useState(() => { const m = load(MESSAGES_RETIRES, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; });
  useEffect(() => onCloudReady(() => setRetiresMsg((v) => (Object.keys(v || {}).length ? v : ((() => { const m = load(MESSAGES_RETIRES, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; })())))), []);
  const retirerMessagesPourDeBon = async (acc) => {
    if (!acc) return;
    if (!await askConfirm({
      title: `Retirer les messages de « ${accountName(acc)} » ?`,
      desc: "Ses conversations sortent de VRM pour de bon — elles ne reviennent pas, même si l'extension recapte ce compte. Ses ventes, sa compta, ses achats et ses annonces restent. Rien n'est supprimé sur Vinted. Tu peux les remettre depuis cette carte.",
      ok: 'Retirer ses messages', cancel: 'Annuler',
    })) return;
    const uid = String(acc.vinted_user_id);
    const suivant = { ...retiresMsg, [uid]: { at: new Date().toISOString(), login: acc.login || '' } };
    setRetiresMsg(suivant); save(MESSAGES_RETIRES, suivant);
    setDelCible(null);
    toast(`Messages de « ${accountName(acc)} » retirés — rouvre l'onglet Messages.`);
  };
  const remettreMessages = (acc) => {
    const uid = String(acc.vinted_user_id);
    const suivant = { ...retiresMsg }; delete suivant[uid];
    setRetiresMsg(suivant); save(MESSAGES_RETIRES, suivant);
    toast(`Messages de « ${accountName(acc)} » remis.`);
  };

  // ── SUPPRESSION CIBLÉE (modale, récupérable) ────────────────────────────────
  // Julien : « on doit pouvoir sélectionner si on veut tout enlever — la compta,
  // les ventes, les achats, les annonces » + « pour récupérer, je reconnecte
  // l'extension ». La modale efface les lignes CHOISIES (récupérables à la
  // prochaine capture) ; elle n'écrit JAMAIS la liste noire. La compta se
  // calcule sur les ventes : la modale le dit, pas de fausse case qui
  // dupliquerait « ventes ». Le blocage définitif reste une option à part.
  const [delCible, setDelCible] = useState(null);     // le compte visé, ou null
  const [delScopes, setDelScopes] = useState({ annonces: true, ventes: true, bordereaux: true, releves: true, achats: true, messages: true, compte: true });
  const [delBusy, setDelBusy] = useState(false);
  const ouvrirSuppression = (acc) => { setDelScopes({ annonces: true, ventes: true, bordereaux: true, releves: true, achats: true, messages: true, compte: true }); setDelCible(acc); };
  const rienCoche = !delScopes.annonces && !delScopes.ventes && !delScopes.bordereaux && !delScopes.releves && !delScopes.achats && !delScopes.messages && !delScopes.compte;
  const confirmerSuppression = async () => {
    const acc = delCible; if (!acc || rienCoche) return;
    setDelBusy(true);
    const r = await supprimerDonneesCompte(acc.vinted_user_id, acc.login, delScopes);
    setDelBusy(false);
    if (!r.ok) { toast('Échec de la suppression — réessaie.'); return; }
    toast(delScopes.compte
      ? `« ${accountName(acc)} » retiré. Pour le récupérer : reconnecte l'extension sur ce compte Vinted.`
      : `Données effacées pour « ${accountName(acc)} ». Elles reviendront à ta prochaine visite sur Vinted avec ce compte.`);
    // Si on a retiré le compte lui-même, il quitte la liste ; sinon il reste
    // (ses lignes effacées se re-captent).
    if (delScopes.compte) setAccounts(prev => prev.filter(a => a.vinted_user_id !== acc.vinted_user_id));
    setDelCible(null);
  };
  // Blocage DÉFINITIF (option à part, dans la modale) : compte fermé par Vinted
  // — l'extension ne doit plus JAMAIS le recapter. On DÉLÈGUE à
  // `disconnectAccount`, le chemin éprouvé (sa propre confirmation, l'écriture
  // `vrm_blocked_accounts`, le `vinted_ca_keep_removed`, le toast) : pas de
  // logique dupliquée, et `disconnectAccount` reste vivant (pas de code mort).
  const bloquerDefinitif = async () => {
    const acc = delCible; if (!acc) return;
    setDelCible(null);
    await disconnectAccount(acc);
  };

  const refreshAccounts = async () => {
    setLoading(true);
    const list = await fetchVintedAccounts();
    // ⚠️ Un échec ne doit pas EFFACER la liste affichée : sinon un « ↻ Actualiser »
    //    pendant une panne fait disparaître ses neuf comptes sous ses yeux.
    if (Array.isArray(list)) setAccounts(list);
    setLoading(false);
  };
  useEffect(() => { refreshAccounts(); /* eslint-disable-next-line */ }, []);


  // ── TOUT REMETTRE : le seul écran qui décide de ce qui manque ──────────────
  // Demande de Julien : « mets TOUTES les annonces et TOUTES les ventes dans
  // l'application ». Relevé du 15 août : 9 annonces et 153 ventes visibles,
  // pour **112 annonces et 514 ventes réellement captées** — l'écart n'est pas
  // une perte de données, c'est trois comptes masqués (des puces tapées par
  // erreur, §5.10) et un compte retiré qui porte à lui seul 96 annonces et
  // 284 ventes. Un bouton remet tout, au lieu de chercher où ça coince.
  const [retires, setRetires] = useState(null);   // { uids:[], logins:[] }
  const [remise, setRemise] = useState(false);
  useEffect(() => { (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_blocked_accounts&select=data`, { headers: sbAuth() });
      if (!r.ok) return;
      const j = await r.json();
      setRetires((j[0] && j[0].data) || { uids: [], logins: [] });
    } catch (_) { /* pas bloquant */ }
  })(); }, []);
  const nbExclus = hiddenAccts.size + ((retires && retires.uids) || []).length;
  const toutAfficher = async () => {
    if (!await askConfirm({
      title: 'Tout réafficher ?',
      desc: "Les comptes masqués et les comptes retirés reviennent, avec leurs annonces, leurs ventes et leurs achats. Tu pourras en remasquer un ensuite si besoin.",
      ok: 'Tout réafficher', cancel: 'Annuler',
    })) return;
    setRemise(true);
    setHiddenAccts(new Set()); save('vinted_accounts_hidden', []);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_blocked_accounts`, {
        method: 'PATCH',
        headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ data: { uids: [], logins: [], note: 'tout réaffiché depuis l\'app' } }),
      });
      setRetires({ uids: [], logins: [] });
    } catch (_) { /* le démasquage local est déjà fait */ }
    // ⚠️ Ici `blockedAccts` est un useMemo (pas d'état) : on écrit la clé, et
    // l'app la relit au prochain démarrage. Appeler un `setBlockedAccts`
    // inexistant dans CE composant planterait l'écran (même famille de bug
    // qu'en §26 : un identifiant absent que le build ne voit pas).
    save('vinted_accounts_blocked', []);
    await refreshAccounts();
    setRemise(false);
    toast('Tous les comptes sont réaffichés — rouvre l\'onglet Annonces');
  };

  // (3 nov.) Les comptes des autres plateformes, sur le même écran (« Comptes liés »).
  const [autres, relireAutres] = useComptesAutresSites();
  const ouvertChrome = (() => { const v = vintedDeChrome(); return v && v.uid ? String(v.uid) : ''; })();
  const santes = accounts.map(acctHealth);
  const nbActifs = santes.filter(s=>s.etat==='ok').length, nbBannis = santes.filter(s=>s.etat==='bad').length;
  // (6 nov., vague 2) Les e-mails de chaque compte : la règle des comptes muets (§11).
  const etatEmails = useEtatEmailsComptes(accounts);
  const emailsDe = (uid) => ligneEmailsCompte(etatEmails.etat, (etatEmails.lignes || []).find((l) => l.uid === String(uid)) || null);
  const carteVinted = (acc) => {
    const uid = String(acc.vinted_user_id);
    const h = acctHealth(acc);
    const ev = etatExt && etatExt[uid];
    const pro = ev && typeof ev.pro === 'boolean' ? ev.pro : (typeof typesProfil[uid] === 'boolean' ? typesProfil[uid] : null);
    let etat = etatCompteLie({ banni: h.etat === 'bad' && h.source === 'extension', ouvert: ouvertChrome === uid, lu: lastCap[uid] || null });
    if (h.etat === 'bad' && h.source !== 'extension' && (etat === 'lu' || etat === 'ouvert')) etat = 'a-relire';
    const r = reput[uid];
    const nomAff = accountName(acc);
    return (
      <CarteCompteLie key={uid} plateforme="vinted" id={uid} nom={nomAff} photo={photosProfil[uid] || ''} etat={etat} age={ageLecture(lastCap[uid], Date.now())}
        type={pro == null ? '' : pro ? 'pro' : 'particulier'} inclus={!hiddenAccts.has(uid)} onInclus={() => toggleAcctCompta(acc.vinted_user_id)}
        etatVinted={{ etat: h.etat === 'bad' ? 'banni' : h.etat === 'exclu' ? 'masque' : 'actif', source: h.source || '', hint: h.hint }}
        emails={<LigneEmailsCompte ligne={emailsDe(uid)} uid={uid} login={acc.login || nomAff}/>}
        action={<a className="vrm-b vrm-b-discret vrm-cl-bouton" href={`https://www.vinted.fr/member/${encodeURIComponent(uid)}`} target="_blank" rel="noreferrer" data-compte-action="ouvrir">Ouvrir</a>}
        enfants={(
          <details data-gerer-compte="" className="vrm-cl-gerer">
            <summary>Gérer</summary>
            <div style={{display:'flex',flexDirection:'column',gap:8,paddingBottom:4}}>
              <input defaultValue={labels[acc.vinted_user_id] || ''} placeholder={acc.login || `#${uid}`} aria-label="Nom affiché"
                onBlur={(e) => { const v = e.target.value.trim(); const u = { ...labels, [acc.vinted_user_id]: v }; if (!v) delete u[acc.vinted_user_id]; setLabels(u); save('vinted_account_labels', u); }}
                style={{width:'100%',maxWidth:320,boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',fontSize:15,fontFamily:'inherit',background:C.surface,color:C.text}}/>
              <input value={acctEmails[uid] || ''} onChange={e=>setAcctEmail(acc.vinted_user_id, e.target.value)} placeholder="E-mail du compte" aria-label="E-mail du compte"
                style={{width:'100%',maxWidth:320,boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',fontSize:15,fontFamily:'inherit',background:C.surface,color:C.text}}/>
              <input type="tel" inputMode="tel" value={acctPhones[uid] || ''} onChange={e=>setAcctPhone(acc.vinted_user_id, e.target.value)} placeholder="Téléphone du compte" aria-label="Téléphone du compte"
                style={{width:'100%',maxWidth:320,boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',fontSize:15,fontFamily:'inherit',background:C.surface,color:C.text}}/>
              {(()=>{ const n=telNorm(acctPhones[uid]); if(n.length<9) return null;
                const autresT=(accounts||[]).filter(o=>String(o.vinted_user_id)!==uid && telNorm(acctPhones[String(o.vinted_user_id)])===n).map(o=>labels[String(o.vinted_user_id)]||o.login||`#${o.vinted_user_id}`);
                return autresT.length ? <div style={{fontSize:13,color:C.warn}}>Ce numéro sert aussi sur {autresT.join(', ')}.</div> : null; })()}
              {r && (r.rating != null || r.count != null) && <div style={{fontSize:13,color:C.muted}}>{r.rating != null ? `${(r.rating*5).toFixed(2)}/5` : ''}{r.rating != null && r.count != null ? ' · ' : ''}{r.count != null ? `${r.count} avis` : ''}{r.neg > 0 ? ` · ${r.neg} négatif${r.neg>1?'s':''}` : ''}</div>}
              {retireesAnn[uid] && <span data-annonces-retirees={uid} style={{fontSize:13,color:C.muted}}>Annonces retirées · <button type="button" className="vrm-lien-action" onClick={()=>remettreAnnonces(acc)} style={{border:'none',background:'transparent',color:C.accentTexte,fontWeight:600,cursor:'pointer',padding:0,minHeight:44,fontFamily:'inherit',fontSize:'inherit'}}>Les remettre</button></span>}
              {retiresMsg[uid] && <span data-messages-retires={uid} style={{fontSize:13,color:C.muted}}>Messages retirés · <button type="button" className="vrm-lien-action" onClick={()=>remettreMessages(acc)} style={{border:'none',background:'transparent',color:C.accentTexte,fontWeight:600,cursor:'pointer',padding:0,minHeight:44,fontFamily:'inherit',fontSize:'inherit'}}>Les remettre</button></span>}
              <Bouton variante="discret" icone="trash" onClick={()=>ouvrirSuppression(acc)}>Supprimer des données…</Bouton>
            </div>
          </details>
        )}/>
    );
  };

  return (
    <div className="vrm-cl-ecran vrm-fu-ecran" data-comptes-lies="">
      {onRetour && <Bouton variante="discret" className="vrm-settings-back" onClick={onRetour}>‹ Paramètres</Bouton>}
      <ScreenHead icon="link" title="Comptes liés"
        right={<Bouton icone="sync" className="vrm-b-petit" onClick={()=>{ refreshAccounts(); relireAutres(); }}>{loading ? '…' : 'Actualiser'}</Bouton>}/>
      {vintedPris && <div className="vrm-cl-alerte" data-vinted-pris={vintedPris.uid}>{vintedPris.login || 'Ce compte Vinted'} est déjà relié à un autre compte VRM — ouvre Vinted sur un autre compte.</div>}
      {nbExclus > 0 && (
        <div className="vrm-cl-alerte">
          <span>{nbExclus} compte{nbExclus>1?'s':''} Vinted masqué{nbExclus>1?'s':''}</span>
          <Bouton data-tout-reafficher onClick={toutAfficher} disabled={remise}>{remise ? '…' : 'Tout réafficher'}</Bouton>
        </div>
      )}
      <GroupeComptes plateforme="vinted" n={accounts.length || null} attrs={{ 'data-comptes-actifs': nbActifs, 'data-comptes-bannis': nbBannis }}
        enfants={accounts.length === 0
          ? (baseKO
            ? <LignePanne>Je n'ai pas pu lire la liste de tes comptes — elle est vide parce que la lecture a échoué, pas parce qu'aucun compte n'est lié. Rien n'est perdu.</LignePanne>
            : <div className="vrm-cl-vide" data-comptes-vide="vinted"><a className="vrm-b vrm-b-discret vrm-cl-bouton" href={URL_SITE_COMPTE.vinted} target="_blank" rel="noreferrer">Ouvrir Vinted</a></div>)
          : accounts.map(carteVinted)}/>
      <ComptesAutresSites lu={autres} relire={relireAutres}/>
      {/* (8 nov.) L'accueil d'un compte relié (src/CompteRelie.jsx), rattrapable ici : la feuille revient
          avec les derniers comptes reliés, leur première lecture et leurs choix. */}
      <div className="vrm-cl-revoir" style={{display:'flex',justifyContent:'center'}}>
        <Bouton variante="discret" icone="link" data-comptes-relies-revoir="" onClick={()=>{ try{ window.dispatchEvent(new Event('vrm:comptes-relies-revoir')); }catch(_){} }}>Revoir l’accueil des comptes reliés</Bouton>
      </div>

      {/* ── MODALE : SUPPRIMER LES DONNÉES D'UN COMPTE (ciblé, récupérable) ──── */}
      {delCible && (()=>{ const acc = delCible;
        const Case = ({ k, titre, sous }) => (
          <label style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',border:`1px solid ${delScopes[k]?C.accent:C.border}`,background:delScopes[k]?`${C.accent}0d`:'transparent',borderRadius:12,cursor:'pointer',marginBottom:8}}>
            <input type="checkbox" checked={!!delScopes[k]} onChange={e=>setDelScopes(s=>({...s,[k]:e.target.checked}))} style={{marginTop:2,width:17,height:17,accentColor:C.accent,flexShrink:0}}/>
            <span style={{minWidth:0}}>
              <span style={{display:'block',fontSize:13,fontWeight:600,color:C.text}}>{titre}</span>
              <span style={{display:'block',fontSize:12,color:C.muted,lineHeight:1.45,marginTop:1}}>{sous}</span>
            </span>
          </label>
        );
        const tout = delScopes.annonces && delScopes.ventes && delScopes.bordereaux && delScopes.releves && delScopes.achats && delScopes.messages && delScopes.compte;
        return (
        <div onClick={()=>!delBusy&&setDelCible(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1300,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0'}}>
          <FermeAuRetour fermer={()=>!delBusy&&setDelCible(null)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'92vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',paddingBottom:'env(safe-area-inset-bottom)',}}>
            <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
              <span style={{flexShrink:0,width:34,height:34,borderRadius:12,background:`${C.danger}14`,color:C.danger,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="trash" size={17}/></span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>Supprimer les données de « {accountName(acc)} »</div>
                <div style={{fontSize:12,color:C.muted}}>Choisis ce que tu effaces. Rien ne part tant que tu n'as pas confirmé.</div>
              </div>
              <button type="button" onClick={()=>!delBusy&&setDelCible(null)} aria-label="Fermer" style={{flexShrink:0,border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'14px 16px'}}>
              {/* Tout sélectionner / désélectionner */}
              <label style={{display:'flex',gap:10,alignItems:'center',padding:'8px 12px',borderRadius:12,cursor:'pointer',marginBottom:10,background:C.card,border:`1px solid ${C.border}`}}>
                <input type="checkbox" checked={tout} onChange={e=>{ const v=e.target.checked; setDelScopes({annonces:v,ventes:v,bordereaux:v,releves:v,achats:v,messages:v,compte:v}); }} style={{width:17,height:17,accentColor:C.accent}}/>
                <span style={{fontSize:13,fontWeight:700,color:C.text}}>Tout supprimer</span>
              </label>
              <Case k="annonces" titre="Annonces" sous="Le dressing capté, les photos et descriptions, le coffre."/>
              <Case k="ventes" titre="Ventes" sous="Les ventes, transactions et porte-monnaie. La compta (CA, URSSAF) se recalcule dessus : la retirer la met à jour."/>
              <Case k="bordereaux" titre="Bordereaux" sous="Les étiquettes d'envoi (PDF) captées sur ce compte. Les ventes et la compta ne bougent pas."/>
              <Case k="releves" titre="Relevés" sous="Les relevés de versement captés sur ce compte. Les ventes et la compta ne bougent pas."/>
              <Case k="achats" titre="Achats" sous="Les commandes achetées sur ce compte."/>
              <Case k="messages" titre="Messages" sous="Les conversations captées de ce compte."/>
              <Case k="compte" titre="Le compte et ses jetons" sous="Retire le compte de la liste. Tu le récupères en reconnectant l'extension dessus sur Vinted."/>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.5,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',marginTop:4}}>
                ↩︎ <b style={{color:C.text}}>Rien n'est perdu pour de bon</b> : ce que tu effaces ici revient tout seul à ta prochaine visite sur Vinted avec ce compte (l'extension recapte). Pour qu'un compte ne revienne <b>jamais</b> (fermé par Vinted), utilise le blocage ci-dessous.
              </div>
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',gap:8}}>
                <button className="vrm-b vrm-b-discret" type="button" onClick={()=>!delBusy&&setDelCible(null)} style={{flex:1,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'12px',fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
                <button type="button" onClick={confirmerSuppression} disabled={delBusy||rienCoche} style={{flex:2,border:'none',background:rienCoche?C.border:C.danger,color:'#fff',borderRadius:12,padding:'12px',fontSize:15,fontWeight:700,cursor:(delBusy||rienCoche)?'default':'pointer',fontFamily:'inherit',opacity:delBusy?0.6:1}}>{delBusy?'…':rienCoche?'Coche au moins une case':'Supprimer'}</button>
              </div>
              {/* ── POUR DE BON : par catégorie (26 oct., demande de Julien) ──────
                  « Annonce + message, pas les ventes. » Ne revient jamais, même
                  recapté. Seules les annonces et les messages : ni les ventes (ta
                  compta/URSSAF en dépend), ni les achats (ton repère de prix).
                  Réactivable ici et sur la carte du compte. */}
              {(()=>{ const uid=String(acc.vinted_user_id); const annR=!!retireesAnn[uid]; const msgR=!!retiresMsg[uid];
                const BtnPDB = ({ retire, onRetirer, onRemettre, label, attr }) => (
                  <button type="button" {...attr} onClick={()=>!delBusy&&(retire?onRemettre(acc):onRetirer(acc))} disabled={delBusy}
                    style={{flex:1,border:`1px solid ${retire?C.accent:C.border}`,background:retire?`${C.accent}0d`:'transparent',color:retire?C.accent:C.text,borderRadius:12,padding:'9px 10px',fontSize:13,fontWeight:600,cursor:delBusy?'default':'pointer',fontFamily:'inherit',lineHeight:1.3}}>
                    {retire ? `${label} retirées ✓ — les remettre` : `Retirer les ${label.toLowerCase()}`}
                  </button>
                );
                return (
                <div style={{border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px'}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>Pour de bon <span style={{fontWeight:500,color:C.muted}}>— ne revient jamais, même recapté</span></div>
                  <div className="vrm-aide" style={{fontSize:11,color:C.muted,lineHeight:1.45,margin:'3px 0 8px'}}>Compte bloqué par Vinted ? Sors ses annonces ou ses messages pour de bon. Ses ventes, sa compta et ses achats restent (le CA et tes prix d'achat en dépendent).</div>
                  <div style={{display:'flex',gap:8}}>
                    <BtnPDB retire={annR} onRetirer={retirerAnnoncesPourDeBon} onRemettre={remettreAnnonces} label="Annonces" attr={{'data-retirer-annonces':true}}/>
                    <BtnPDB retire={msgR} onRetirer={retirerMessagesPourDeBon} onRemettre={remettreMessages} label="Messages" attr={{'data-retirer-messages':true}}/>
                  </div>
                </div>
                ); })()}
              <button type="button" onClick={bloquerDefinitif} disabled={delBusy} style={{border:'none',background:'transparent',color:C.muted,borderRadius:12,padding:'4px',fontSize:12,fontWeight:500,cursor:delBusy?'default':'pointer',fontFamily:'inherit',textDecoration:'underline'}}>Compte fermé par Vinted ? Le bloquer définitivement</button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}
// ⟦← App.jsx #34⟧
// ── (3 nov.) « EXPORTER MES DONNÉES » (Paramètres, src/exportDonnees.js) ─────
// Les sources des écrans, telles quelles ; lectures en base PAGINÉES (`lireTout`)
// et PROJETÉES (jamais `select=data`). Une source ratée ⇒ sa feuille dit « — ».
// Rien ne part ailleurs : le zip est téléchargé sur l'appareil.
// (6 nov., vitesse 2) Les achats des comptes LIÉS seulement (`lireAchatsLies`) — les
// mêmes que le registre des achats et les totaux de Comptabilité (« un compte
// retiré n'entre dans aucun total ») : la liste des comptes lue d'abord, puis
// leurs seules lignes. Liste illisible ⇒ tous, comme avant.
async function sourcesExportDonnees() {
  const rel = load('vrm_stats_ventes', null), urs = load('vinted_urssaf_mois', null);
  const fiches = load('vinted_annonce_numeros', null);
  const comptesLus = fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id,login`, { headers: sbAuth() }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [lignesAchats, comptesV, factures] = await Promise.all([
    comptesLus.then((c) => lireAchatsLies(Array.isArray(c) ? uidsLies(c) : null)),
    comptesLus,
    lireTout('id=like.email_invoice_*&select=id,number:data->>number,status:data->>status,emiseLe:data->>emiseLe,tx:data->>transaction,annuleePar:data->>annuleePar,type:data->>type').catch(() => null),
  ]);
  const login = new Map((Array.isArray(comptesV) ? comptesV : []).map((c) => [String(c.vinted_user_id), String(c.login || '')]));
  const achats = Array.isArray(lignesAchats) ? lignesAchats.flatMap((r) => { const k = /^harvest_(\d+)_orders_purchased$/.exec(String(r && r.id || '')); const uid = k ? k[1] : ''; return (Array.isArray(r && r.orders) ? r.orders : []).map((o) => ({ ...o, compte: login.get(uid) || uid })); }) : null;
  return {
    releve: rel && Array.isArray(rel.l) ? rel.l : null,
    urssaf: urs && Array.isArray(urs.mois) ? urs.mois.map((m) => ({ ym: m.ym, n: m.n != null ? m.n : m.count, ca: m.ca })) : null,
    aPayer: (ca) => aPayerUrssaf(ca, tauxUrssaf()),
    declarations: lireDeclarations(),
    fiches: fiches && typeof fiches === 'object' ? fiches : null,
    achats, compta: lireComptaSynchro(),
    factures: Array.isArray(factures) ? factures.filter((f) => f && (f.type === 'facture_pro' || f.number)) : null,
  };
}
async function exporterMesDonnees() {
  if (lectureSeuleActive()) { toast(EXPORT_FERME); return; }
  try {
    const src = await sourcesExportDonnees();
    const zip = zipStocke(fichiersExport(feuillesExport(src)));
    telechargerFichier(new Blob([zip], { type: 'application/zip' }), nomExport(), 'application/zip');
  } catch (e) { toast('Export pas créé : ' + (e && e.message || e)); }
}
// ⟦← App.jsx #35⟧

// ── LES E-MAILS DE L'ESSAI GRATUIT (5 nov., api/_lib/relances-essai.js) ─────
// Au propriétaire : l'envoi est-il configuré (et sinon, ce qui manque sur
// Vercel). Au vendeur EN ESSAI : les reçoit-il (un interrupteur). À un abonné
// qui paie : rien (il n'en reçoit jamais).
function RelancesEssaiSetting() {
  const [r, setR] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const lire = React.useCallback(async () => {
    try {
      const x = await fetch('/api/compte?mode=relances', { headers: enTeteSession(), cache: 'no-store' });
      const j = x.ok ? await x.json() : null;
      setR(j && j.ok ? j : null);
    } catch (_) { setR(null); }
  }, []);
  useEffect(() => { lire(); }, [lire]);
  if (r === undefined) return null;
  if (r === null) return <div data-relances-essai="passu" className="vrm-np-relance" style={{marginTop:12}}>E-mails de l’essai : —</div>;
  if (!r.proprietaire && !r.essai) return null;
  const basculer = async () => {
    if (busy || r.abonne === null) return; setBusy(true);
    try {
      const x = await fetch('/api/compte?mode=relances', { method: 'POST', headers: { ...enTeteSession(), 'Content-Type': 'application/json' }, body: JSON.stringify({ abonne: !r.abonne }) });
      const j = x.ok ? await x.json() : null;
      if (j && j.ok) setR({ ...r, abonne: j.abonne }); else toast('Choix non enregistré — réessaie dans un instant.');
    } catch (_) { toast('Choix non enregistré — réessaie quand tu as du réseau.'); }
    setBusy(false);
  };
  const envoyes = r.envois ? Object.values(r.envois).filter((e) => e && e.issue === 'envoye').length : null;
  return (
    <div data-relances-essai={r.configure ? 'pret' : 'non-configure'} style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'4px 14px 10px',marginTop:12,color:C.text}}>
      <div className="vrm-np-titre">E-mails de l’essai gratuit</div>
      {r.proprietaire ? (
        <div className="vrm-np-relance" data-relances-proprio="">
          {r.configure
            ? <>Prêts : chaque matin, les comptes en essai reçoivent au plus un e-mail (jour 1, jour 3, la veille de la fin). Jamais toi, jamais un abonné qui paie.</>
            : <><b>Pas configurés : aucun e-mail ne part.</b> À poser sur Vercel (Settings → Environment Variables), avec une boîte d’envoi de VRM : {(r.manque || []).map((m, i) => <React.Fragment key={m}>{i ? ', ' : ''}<code>{m}</code></React.Fragment>)}.</>}
        </div>
      ) : null}
      {r.essai ? (
        <div className="vrm-np-ligne" data-relances-abonne={r.abonne === null ? 'passu' : r.abonne ? 'on' : 'off'}>
          <span className="vrm-np-lib">Conseils par e-mail pendant l’essai<small>{!r.configure ? 'L’envoi d’e-mails n’est pas configuré : aucun ne part.' : envoyes ? `${envoyes} reçu${envoyes > 1 ? 's' : ''} sur 3 au plus.` : 'Trois au plus, à l’adresse de ton compte.'}</small></span>
          {r.abonne === null ? <span className="vrm-np-relance">—</span>
            : <Interrupteur on={!!r.abonne} onClick={basculer} disabled={busy} label={`Conseils par e-mail : ${r.abonne ? 'activés' : 'désactivés'}`}/>}
        </div>
      ) : null}
    </div>
  );
}

// ── LE BILAN DU MOIS PAR E-MAIL (8 nov., api/_lib/bilan-mois.js) ─────────────
// Un résumé (ventes, vendu, reçu, bénéfice brut, sa plus belle vente) le 1er du
// mois, à l'adresse de son compte. ÉTEINT par défaut : le choix est écrit par le
// serveur (`?mode=bilan-mois`), jamais deviné. Trois états : allumé · éteint ·
// « — » (pas su : aucun interrupteur qui mentirait).
function BilanMoisSetting() {
  const [r, setR] = useState(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let mort = false;
    (async () => {
      try {
        const x = await fetch('/api/compte?mode=bilan-mois', { headers: enTeteSession(), cache: 'no-store' });
        const j = x.ok ? await x.json() : null;
        if (!mort) setR(j && j.ok ? j : null);
      } catch (_) { if (!mort) setR(null); }
    })();
    return () => { mort = true; };
  }, []);
  if (r === undefined) return null;
  const basculer = async () => {
    if (busy || !r || r.actif === null) return; setBusy(true);
    try {
      const x = await fetch('/api/compte?mode=bilan-mois', { method: 'POST', headers: { ...enTeteSession(), 'Content-Type': 'application/json' }, body: JSON.stringify({ actif: !r.actif }) });
      const j = x.ok ? await x.json() : null;
      if (j && j.ok) setR({ ...r, actif: j.actif }); else toast('Choix non enregistré — réessaie dans un instant.');
    } catch (_) { toast('Choix non enregistré — réessaie quand tu as du réseau.'); }
    setBusy(false);
  };
  const etat = !r || r.actif === null ? 'passu' : r.actif ? 'on' : 'off';
  const dernier = r && r.envois ? Object.entries(r.envois).filter(([, e]) => e && e.issue === 'envoye').map(([k]) => k).sort().pop() : null;
  return (
    <div data-bilan-mois={etat} style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'4px 14px 10px',marginTop:12,color:C.text}}>
      <div className="vrm-np-ligne">
        <span className="vrm-np-lib">Bilan du mois par e-mail<small>{!r ? 'Pas su pour l’instant — réessaie plus tard.'
          : !r.configure ? 'L’envoi d’e-mails n’est pas encore configuré : aucun ne part.'
          : dernier ? `Le 1er du mois : ventes, vendu, reçu, bénéfice. Dernier envoyé : ${dernier}.`
          : 'Le 1er du mois, à l’adresse de ton compte : ventes, vendu, reçu, bénéfice et ta plus belle vente.'}</small></span>
        {etat === 'passu' ? <span className="vrm-np-relance">—</span>
          : <Interrupteur on={!!r.actif} onClick={basculer} disabled={busy} label={`Bilan du mois par e-mail : ${r.actif ? 'activé' : 'désactivé'}`}/>}
      </div>
    </div>
  );
}

// (8 nov.) « M'envoyer un e-mail d'essai » : pour voir un VRAI e-mail de VRM dans sa
// boîte. Sur SON clic, à l'adresse de SON compte (le serveur la lit, jamais l'écran),
// 3 par heure (api/_lib/mail-essai.js). L'issue est dite telle quelle : envoyé ·
// peut-être parti · rien n'est parti (et pourquoi).
function MailEssaiSetting() {
  const [etat, setEtat] = useState(null);   // null · 'envoi' · { ok, texte }
  const envoyer = async () => {
    if (etat === 'envoi') return; setEtat('envoi');
    try {
      const x = await fetch('/api/compte?mode=mail-essai', { method: 'POST', headers: { ...enTeteSession(), 'Content-Type': 'application/json' }, body: '{}' });
      const j = await x.json().catch(() => null);
      if (j && j.ok) setEtat({ ok: 'envoye', texte: `Envoyé à ${j.a}. Regarde ta boîte de réception dans une minute.` });
      else setEtat({ ok: j && j.issue === 'incertain' ? 'incertain' : 'refuse', texte: (j && j.message) || 'Rien n’est parti : le serveur n’a pas répondu. Réessaie dans un instant.' });
    } catch (_) { setEtat({ ok: 'refuse', texte: 'Rien n’est parti : pas de réseau. Réessaie quand tu as du réseau.' }); }
  };
  return (
    <div data-mail-essai={etat && etat !== 'envoi' ? etat.ok : etat === 'envoi' ? 'envoi' : 'pret'} style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'4px 14px 10px',marginTop:12,color:C.text}}>
      <div className="vrm-np-ligne">
        <span className="vrm-np-lib">Voir un e-mail de VRM<small>Un e-mail d’essai, à l’adresse de ton compte. Trois par heure au plus.</small></span>
        <Bouton variante="secondaire" className="vrm-b-petit" disabled={etat === 'envoi'} onClick={envoyer}>{etat === 'envoi' ? 'Envoi…' : 'M’envoyer un e-mail d’essai'}</Bouton>
      </div>
      {etat && etat !== 'envoi' ? <div className="vrm-np-relance" role="status" style={{paddingTop:6}}>{etat.texte}</div> : null}
    </div>
  );
}

// (3 nov., 5 nov.) Sept types, un interrupteur chacun (api/_lib/notif-textes.js, la
// règle que le serveur applique avant d'envoyer). Les anciennes catégories
// fines restent lues comme réglage d'avant tant qu'une famille n'est pas posée.
const PUSH_FAMILLES = FAMILLES_NOTIF;
function PushPrefsSetting({ comptes, onMuets }) {
  // ⚠️ TROIS ÉTATS : `undefined` = en cours de lecture · `null` = la base n'a
  //    pas répondu · un objet = lu. Confondre les deux premiers ferait dire
  //    « Chargement… » pour toujours à un panneau qui a ÉCHOUÉ.
  const [prefs, setPrefs] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  // Comptes dont ni les ventes ni les messages ne peuvent déclencher de
  // notification : la MÊME règle que l'écran Achats (`etatEmailsComptes`, §11).
  // Rien tant qu'on ne sait pas : jamais une accusation sur une lecture ratée.
  const etatComptes = useEtatEmailsComptes(comptes);
  const muets = etatComptes.etat === 'lu' ? etatComptes.muets : null;
  // Au téléphone ce panneau vit dans un sous-écran : la ligne qui y mène dit
  // combien de comptes sont muets — le MÊME nombre, remonté d'ici (§11).
  const nMuets = muets ? muets.length : null;
  useEffect(() => { if (onMuets) onMuets(nMuets); }, [nMuets]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let mort = false;
    (async () => {
      try {
        const d = await lireReglage('push_prefs');
        // `null` = pas su : on NE bascule rien tant qu'on n'a pas lu (sinon un
        // seul clic réécrit la ligne avec une seule préférence).
        if (!mort) setPrefs(d);
      } catch (_) { if (!mort) setPrefs(null); }
    })();
    return () => { mort = true; };
  }, []);
  const actif = (c) => familleNotifActive(prefs || {}, c.id);
  const pasLu = prefs === null;              // la base n'a pas répondu
  const enCours = prefs === undefined;
  // (5 nov.) Une seule écriture pour tous les réglages de la ligne (types,
  // heures calmes, regroupement) : la ligne LUE, modifiée, réécrite entière.
  // `quoi` : ce que la ligne nomme si l'écriture est refusée.
  const ecrirePrefs = async (next, quoi = 'Le réglage') => {
    if (busy || pasLu || !prefs) return; setBusy(true);
    const avant = prefs;
    setPrefs(next);
    // (5 nov.) Une écriture refusée (réseau, 4xx, 5xx) n'est JAMAIS montrée comme
    // faite : l'interrupteur revient à ce que la base a vraiment, et on le dit.
    let ok = false;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
        method: 'POST',
        headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([withOwner({ id: 'push_prefs', data: next })]),
      });
      ok = !!(r && r.ok);
    } catch (_) { ok = false; }
    if (!ok) { setPrefs(avant); toast(`${quoi} n’a pas été enregistré — réessaie quand tu as du réseau.`); }
    setBusy(false);
  };
  const bascule = (c) => ecrirePrefs({ ...(prefs || {}), familles: { ...((prefs && prefs.familles) || {}), [c.id]: !actif(c) } }, `« ${c.titre} »`);
  const calme = reglageCalme(prefs || {});
  const poserCalme = (patch) => ecrirePrefs({ ...(prefs || {}), calme: { ...calme, ...patch } });
  // (8 nov.) Allumé par défaut (api/_lib/notif-textes.js, `regrouper`) : seul un `false` posé l'éteint.
  const regroupe = !(prefs && prefs.regrouper === false);
  const n = prefs ? PUSH_FAMILLES.filter(actif).length : 0;
  return (
    <>
    <details style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'10px 14px'}} onToggle={(e) => setOuvert(e.currentTarget.open)}>
      <summary style={{cursor:'pointer',listStyle:'none',display:'flex',alignItems:'center',gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>Ce que tu reçois sur ton téléphone</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.4}}>
            {enCours ? 'Chargement…'
              : pasLu ? <span style={{display:'inline-block',fontSize:11,fontWeight:600,color:C.muted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:999,padding:'2px 9px'}}>{REGLAGE_PAS_LU}</span>
              : `${n} sur ${PUSH_FAMILLES.length} activée${n>1?'s':''}.`}
            {/* §7 (revue du 11 oct.) : déplié, le bloc dessous dit tout — le résumé se tait. */}
            {muets && muets.length > 0 && !ouvert && (
              <div style={{color:C.warn,fontWeight:600,marginTop:3}} data-resume-muets={muets.length}>
                ⚠ {muets.length} compte{muets.length>1?'s':''} sans e-mail&nbsp;: ni {muets.length>1?'leurs':'ses'} ventes ni {muets.length>1?'leurs':'ses'} messages ne sonneront.
              </div>
            )}
          </div>
        </div>
        <span style={{color:C.muted,fontSize:13,flexShrink:0}}>▾</span>
      </summary>
      {muets && muets.length > 0 && (
        <div style={{marginTop:10}}><BlocComptesMuets muets={muets}/></div>
      )}
      <div className="vrm-notif-groupes" data-notif-groupes="">
        {groupesFamillesNotif(PUSH_FAMILLES).map(g => (
          <section key={g.id} className="vrm-notif-groupe" data-notif-groupe={g.id}>
            <h4 className="vrm-notif-groupe-titre">{g.titre}</h4>
            <div className="vrm-notif-groupe-corps">
              {g.familles.map(c => <LigneFamilleNotif key={c.id} c={c} on={actif(c)} disabled={!prefs||busy} onBascule={()=>bascule(c)}/>)}
            </div>
          </section>
        ))}
      </div>
    </details>
    {/* (5 nov.) Heures calmes et regroupement : lus par le serveur juste avant
        d'envoyer (api/_lib/notif-textes.js) — pas un filtre d'affichage. */}
    <div data-np-reglages="" style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'4px 14px 10px',marginTop:12,color:C.text}}>
      <div className="vrm-np-ligne" data-np-calme={calme.actif?'on':'off'} style={{borderTop:0}}>
        <span className="vrm-np-lib">Heures calmes<small>Rien ne sonne la nuit, sauf la double vente et ce qui expire avant 10 h. Au réveil, une seule notification dit ce qui est arrivé.</small></span>
        <Interrupteur on={calme.actif} onClick={()=>poserCalme({ actif: !calme.actif })} disabled={!prefs||busy} label={`Heures calmes : ${calme.actif?'activées':'désactivées'}`}/>
      </div>
      {calme.actif && (
        <div className="vrm-np-heures" data-np-heures={`${calme.debut}-${calme.fin}`}>
          <label>De <input type="time" value={calme.debut} disabled={!prefs||busy} aria-label="Début des heures calmes" onChange={(e)=>{ if (heureValide(e.target.value)) poserCalme({ debut: e.target.value }); }}/></label>
          <label>à <input type="time" value={calme.fin} disabled={!prefs||busy} aria-label="Fin des heures calmes" onChange={(e)=>{ if (heureValide(e.target.value)) poserCalme({ fin: e.target.value }); }}/></label>
        </div>
      )}
      {calme.actif && (
        <div className="vrm-np-ligne" data-np-calme-dv={calme.sauf.includes('doublevente')?'on':'off'}>
          <span className="vrm-np-lib">La double vente sonne quand même</span>
          <Interrupteur on={calme.sauf.includes('doublevente')} onClick={()=>poserCalme({ sauf: calme.sauf.includes('doublevente') ? calme.sauf.filter((x)=>x!=='doublevente') : [...calme.sauf, 'doublevente'] })} disabled={!prefs||busy} label="La double vente sonne pendant les heures calmes"/>
        </div>
      )}
      <div className="vrm-np-ligne" data-np-regrouper={regroupe?'on':'off'}>
        <span className="vrm-np-lib">Regrouper<small>« 3 bordereaux prêts à imprimer » au lieu de trois notifications.</small></span>
        <Interrupteur on={regroupe} onClick={()=>ecrirePrefs({ ...(prefs || {}), regrouper: !regroupe })} disabled={!prefs||busy} label={`Regrouper : ${regroupe?'activé':'désactivé'}`}/>
      </div>
      <div className="vrm-np-ligne">
        <Bouton variante="secondaire" data-np-voir-centre="" onClick={()=>{ try { window.dispatchEvent(new Event('vrm:centre-notifs')); } catch (_) {} }}>Voir les notifications envoyées</Bouton>
      </div>
    </div>
    </>
  );
}
// (5 nov., Julien : « une meilleure interface des notifications, plus pro ») Les
// familles rangées en trois groupes ; chacune dit en une ligne ce qui la fait
// sonner, son interrupteur, et un APERÇU de ce que le téléphone affichera — les
// textes viennent des fonctions qui fabriquent les vraies notifications
// (api/_lib/notif-apercus.js), avec des données d'exemple inventées. Une famille
// que ces groupes ne connaissent pas (ajoutée plus tard) va dans « Autres » :
// jamais cachée.
const GROUPES_NOTIF = [
  { id: 'argent', titre: 'Ventes, argent et rappels', ids: ['ventes', 'doublevente', 'rappels'] },
  { id: 'colis', titre: 'Colis', ids: ['poster', 'arrives'] },
  { id: 'echanges', titre: 'Échanges avec les acheteurs', ids: ['offres', 'messages'] },
  { id: 'comptes', titre: 'Comptes', ids: ['comptes'] },
];
function groupesFamillesNotif(familles) {
  const vus = new Set();
  const out = GROUPES_NOTIF.map(g => { const f = g.ids.map(id => familles.find(x => x.id === id)).filter(Boolean); f.forEach(x => vus.add(x.id)); return { ...g, familles: f }; }).filter(g => g.familles.length);
  const reste = familles.filter(x => !vus.has(x.id));
  if (reste.length) out.push({ id: 'autres', titre: 'Autres', familles: reste });
  return out;
}
function LigneFamilleNotif({ c, on, disabled, onBascule }) {
  const ap = apercuFamilleNotif(c.id);
  const [vue, setVue] = useState(false);
  const idAp = React.useId();
  return (
    <div className="vrm-notif-famille" data-famille-notif={c.id} data-on={on?'1':'0'}>
      <div className="vrm-notif-famille-tete">
        <span className="vrm-notif-famille-icone" aria-hidden="true"><Icon name={ICONE_FAMILLE_NOTIF[c.id] || 'info'} size={17}/></span>
        <span className="vrm-notif-famille-txt">
          <b>{c.titre}</b>
          {ap ? <span className="vrm-notif-famille-quoi">{ap.quoi}</span> : null}
        </span>
        <Interrupteur on={on} onClick={onBascule} disabled={disabled} label={`${c.titre} : ${on?'activé':'désactivé'}`}/>
      </div>
      {ap && ap.exemples.length ? <>
        <button type="button" className="vrm-notif-apercu-bouton" aria-expanded={vue} aria-controls={idAp} data-apercu-ouvrir={c.id} onClick={()=>setVue(v=>!v)}>
          {vue ? 'Masquer l’aperçu' : `Aperçu · ${ap.exemples.length} notification${ap.exemples.length>1?'s':''}`}
        </button>
        {vue ? <div className="vrm-notif-apercu" id={idAp} data-apercu-famille={c.id} data-apercu-coupee={on?undefined:'1'}>
          {!on ? <p className="vrm-notif-apercu-coupee">Coupée : rien de cette famille ne sonne.</p> : null}
          {ap.exemples.map((e, i) => { const v = embellirNotif(e); return (
            <div key={i} className="vrm-notif-bulle" data-apercu-notif={i} data-apercu-exemple={e.exemple?'1':undefined}>
              <div className="vrm-notif-bulle-tete"><img src="/vrm-icon-v5-192.png" alt="" width="18" height="18"/><span>VRM</span><span className="vrm-notif-bulle-quand">maintenant</span></div>
              <b className="vrm-notif-bulle-titre">{v.title}</b>
              <span className="vrm-notif-bulle-corps">{v.body}</span>
              <span className="vrm-notif-bulle-mene" data-apercu-mene="">Toucher ouvre : {e.mene}</span>
            </div>
          ); })}
          <p className="vrm-notif-apercu-note">Exemples inventés ; les vraies portent ton article, ton compte et ton code.</p>
        </div> : null}
      </> : null}
    </div>
  );
}
// ⟦← App.jsx #36⟧

function StatutSauvegardeReglages() {
  const [,maj]=React.useReducer(n=>n+1,0);
  React.useEffect(()=>{
    const f=()=>maj();const stop=onSyncChange(f);
    window.addEventListener('vrm:reglage-attente',f);window.addEventListener('vrm:save',f);
    return ()=>{stop();window.removeEventListener('vrm:reglage-attente',f);window.removeEventListener('vrm:save',f);};
  },[]);
  // (30 oct.) Une ligne, et seulement quand il y a quelque chose à dire : tout
  // va bien ⇒ rien (« synchronisées » écrit en permanence sur deux lignes, en
  // tête de chaque écran de réglage, était du bruit). En cours, raté, refusé :
  // dit, avec le geste. Sans synchronisation : dit une fois, en court.
  if(!AUTH.user || !CLOISONNE) return <div className="vrm-settings-status" style={{color:C.muted}}>Sur cet appareil seulement</div>;
  const attente=_settingsRevision>_settingsConfirmed;
  const stockage=[..._failedLocalSaves.values()].some(v=>v.owner===AUTH.user?.id);
  const echec=stockage||(attente&&['error','refus'].includes(_syncInfo.etat));
  if(!attente&&!stockage) return null;
  // (8 nov.) Abonnement terminé (aperçu) : la base refuse d'écrire, et
  // « Réessayer » n'y changerait rien — on dit pourquoi, sans geste trompeur.
  if(lectureSeuleActive()) return <div className="vrm-settings-status" role="status" data-statut-reglages="lecture-seule" style={{color:C.muted}}><span>Abonnement terminé : rien n'est enregistré tant que tu ne l'as pas repris</span></div>;
  return <div className="vrm-settings-status" role="status" data-statut-reglages={echec?'echec':'encours'} style={{color:echec?C.warn:C.muted}}>
    {!echec&&<span className="vrm-settings-status-pt" aria-hidden="true"/>}
    <span>{stockage?'Refusée par cet appareil':echec?'Pas encore synchronisé':'Enregistrement…'}</span>
    {echec&&<Bouton variante="discret" onClick={()=>{for(const [k,d] of _failedLocalSaves)if(d.owner===AUTH.user?.id&&!_saveTimers[k])save(k,d.v);cloudPush();}}>Réessayer</Bouton>}
  </div>;
}
function ActionsReglages({comptes,onOuvrir}) {
  const [preuves,setPreuves]=React.useState(null);
  const [tick,maj]=React.useReducer(n=>n+1,0);
  React.useEffect(()=>{let vivant=true,requete=0;const lire=()=>{const id=++requete;return lirePreuvesAdresses().then(v=>{if(vivant&&id===requete)setPreuves(v);});};lire();
    const f=()=>{if(vivant){maj();lire();}};const stop=onCloudReady(f);window.addEventListener('vrm:save',f);window.addEventListener('focus',f);
    return ()=>{vivant=false;if(typeof stop==='function')stop();window.removeEventListener('vrm:save',f);window.removeEventListener('focus',f);};},[]);
  const emails=isCloudReady()?load('vinted_account_emails',{}):null;
  const masques=new Set((load('vinted_accounts_hidden',[])||[]).map(String));
  const actions=actionsReglages({comptes:comptes.filter(c=>!masques.has(String(c.vinted_user_id))),emails,preuves});
  if(!actions.length)return null;
  return <section className="vrm-settings-todo" style={{background:C.card,borderColor:C.border}} aria-label="À terminer">
    <h3>À terminer</h3>{actions.map(a=><div key={a.id}><span><b>{a.titre}</b>{a.texte?<small style={{color:C.muted}}>{a.texte}</small>:null}</span><Bouton variante="secondaire" className="vrm-b-petit" onClick={()=>onOuvrir(a.cible)}>{a.geste}</Bouton></div>)}
  </section>;
}

function SettingsScreen({ setTab, onPlateforme, comptes, onExport, onImport, dark, toggleDark, apparence = null, onApparence = null, notifEnabled, onToggleNotif, ebayCompte = null, ouvrir = null, onOuvert }) {
  // (1er nov., VRM vendu à d'autres) « Import des emails Vinted · Date de début »
  // n'agit que sur la boîte du PROPRIÉTAIRE de l'installation : la réception
  // collective (le script Gmail) ne lit pas la date d'un autre vendeur
  // (docs/emails/boite-collective.md). Le montrer à un autre, c'était un réglage
  // qui s'enregistre et ne fait rien : il n'est pas proposé.
  const proprioInst = useEstProprietaire();
  // Actions sur le compte : une vraie fenêtre plutôt qu'un prompt du navigateur.
  // Un window.prompt ne se style pas, ne masque pas le mot de passe saisi, et
  // sur iPhone il s'affiche comme une alerte système au milieu de rien — c'est
  // exactement ce qui fait « page web bricolée » au lieu d'« application ».
  const [acct, setAcct] = React.useState(null);   // { mode:'email'|'pw'|'out', val, err, busy }
  // Fenêtre d'action sur le compte (email / mot de passe / déconnexion).
  const AcctSheet = () => {
    // 22 oct. : un changement d'adresse redemandé trop tôt (« after N seconds »)
    // grise « Enregistrer » le temps qui reste, et la phrase le dit en français.
    const resteEmail = useSecondesRestantes((acct && acct.finAttente) || 0);
    if (!acct) return null;
    const M = acct.mode;
    const titre = M==='email' ? 'Changer mon e-mail' : M==='pw' ? 'Changer mon mot de passe' : 'Se déconnecter';
    const close = () => setAcct(null);
    const valider = async () => {
      setAcct(a => ({ ...a, busy:true, err:'' }));
      // Un temps pour que le message à l'extension parte avant le rechargement.
      if (M === 'out') { authSignOut(); setTimeout(() => location.reload(), 300); return; }
      if (M === 'pw') {
        if (acct.val.length < 8) { setAcct(a=>({...a,busy:false,err:'8 caractères minimum.'})); return; }
        if (/^(\d+|[a-zA-Z]+)$/.test(acct.val)) { setAcct(a=>({...a,busy:false,err:'Mélange lettres et chiffres — ce mot de passe protège ta compta.'})); return; }
        const r = await authSetPassword(acct.val);
        if (!r.ok) { setAcct(a=>({...a,busy:false,err:r.error})); return; }
        close(); toast('✓ Mot de passe changé');
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(acct.val.trim())) { setAcct(a=>({...a,busy:false,err:'Adresse e-mail invalide.'})); return; }
      if (resteEmail > 0) { setAcct(a=>({...a,busy:false})); return; }
      const r = await authSetEmail(acct.val);
      if (!r.ok) { setAcct(a=>({...a,busy:false,err:r.attente?'':r.error,finAttente:r.attente?Date.now()+r.attente*1000:0})); return; }
      close(); toast("✓ Demande envoyée — ouvre le lien reçu pour valider la nouvelle adresse");
    };
    // ⚠️ 30 sept. (Julien) : « le bouton Se déconnecter est trop bas, la barre
    // Leboncoin/Vestiaire passe dessus ». Rendue DANS l'écran, la fenêtre était
    // piégée sous la barre du bas (même défaut que l'overlay plus bas) : elle
    // part dans document.body, au-dessus de tout.
    // (5 nov., chantier H) LA feuille de l'app (`SheetShell` : portail, poignée, la
    // même croix, retour du navigateur) — plus un calque fait main.
    return (
      <SheetShell onClose={close} titre={titre} z={10000} data-feuille-compte={M}>
          <div style={{fontSize:13,color:C.muted,marginTop:-6,lineHeight:1.5}}>
            {M==='email' ? <>Un lien de validation t’est envoyé. <b style={{color:C.text}}>Ton adresse actuelle marche tant qu’il n’est pas ouvert.</b></>
             : M==='pw'  ? <>8 caractères minimum, lettres et chiffres. Tu restes connecté.</>
             : <>Tes données restent dans ton compte. Seul <b style={{color:C.text}}>ce navigateur</b> est vidé.</>}
          </div>
          {M!=='out' && (
            <input autoFocus type={M==='pw'?'password':'email'} inputMode={M==='email'?'email':undefined}
              autoComplete={M==='pw'?'new-password':'email'} autoCapitalize="none" aria-label={M==='pw'?'Nouveau mot de passe':'Nouvelle adresse e-mail'}
              placeholder={M==='email'?'nouvelle@adresse.com':'Nouveau mot de passe'}
              value={acct.val} onChange={e=>setAcct(a=>({...a,val:e.target.value,err:''}))}
              onKeyDown={e=>{ if(e.key==='Enter') valider(); }}
              style={{width:'100%',boxSizing:'border-box',marginTop:12,border:`1px solid ${acct.err?C.danger:C.border}`,borderRadius:12,padding:'13px 14px',fontSize:17,minHeight:44,background:C.card,color:C.text,outline:'none',fontFamily:'inherit'}}/>
          )}
          {acct.err && <div role="alert" style={{fontSize:13,color:C.danger,marginTop:8,lineHeight:1.4}}>{acct.err}</div>}
          {M==='email' && resteEmail > 0 && <div role="status" data-auth-attente={resteEmail} style={{fontSize:13,color:C.text,marginTop:8,lineHeight:1.4}}>{TEXTE_DELAI_EMAIL_BOUTON}</div>}
          <div style={{display:'flex',gap:9,marginTop:16}}>
            <Bouton variante="discret" onClick={close} style={{flex:1}}>Annuler</Bouton>
            <Bouton variante="primaire" onClick={valider} occupe={!!acct.busy} disabled={(M!=='out' && !acct.val.trim()) || (M==='email' && resteEmail > 0)}
              style={{flex:2,opacity:((M!=='out'&&!acct.val.trim())||(M==='email'&&resteEmail>0))?0.5:1}}>
              {acct.busy ? (M==='out' ? 'Déconnexion…' : 'Enregistrement…') : M==='out' ? 'Se déconnecter' : (M==='email' && resteEmail > 0) ? `Réessaie dans ${resteEmail} s` : 'Enregistrer'}
            </Bouton>
          </div>
      </SheetShell>
    );
  };

  // ── DEUX ONGLETS : « Réglages » et « Mon compte » (Julien, 4 octobre) ─────
  // « un onglet pour gérer l'abonnement et les factures dans les paramètres,
  // avec ses infos de compte regroupées ». Tout ce qui concerne LA PERSONNE
  // (identité, abonnement, carte, factures, connexion, ses données) vit dans
  // « Mon compte » ; ce qui règle l'APP reste dans « Réglages ».
  // Sans session (accès temporaire), pas d'onglets : l'écran reste d'un bloc,
  // et le bouton « Aller à l'écran de connexion » reste visible tout de suite.
  const ongletsCompte = MULTI_USER && !!AUTH.user;
  const [vue, setVueBrute] = React.useState(() => {
    // Retour de Stripe (paiement, page de gestion) : on revient sur le compte.
    // (17 oct., Julien : « prépare dans les paramètres un onglet abonnement »)
    // Le retour de Stripe (paiement, page de gestion) ouvre l'onglet Abonnement.
    if (RETOUR_ABONNEMENT || RETOUR_VUE === 'abonnement') return 'abonnement';
    if (RETOUR_VUE === 'compte') return 'compte';
    try { const v = localStorage.getItem('vrm_reglages_vue'); return v === 'compte' || v === 'abonnement' ? v : 'reglages'; } catch (_) { return 'reglages'; }
  });
  const voirCompte = !ongletsCompte || vue === 'compte';
  const voirReglages = !ongletsCompte || vue === 'reglages';
  const voirAbonnement = ongletsCompte && !!AUTH.user && vue === 'abonnement';

  // ── LA DISPOSITION (16 octobre : « trop vibe-codé, surtout sur téléphone ») ─
  // Modèle : les Réglages d'iOS. Des groupes en listes à lignes ; un panneau
  // long n'est plus déplié dans une page interminable : sur TÉLÉPHONE il
  // s'ouvre dans un SOUS-ÉCRAN (chevron, puis « ‹ Réglages »). Sur ordinateur
  // la place ne manque pas : tout reste déplié, avec un sommaire collant.
  // ⚠️ Les panneaux restent MONTÉS même fermés (`hidden`) : chacun lit sa ligne
  //    au montage (`lireReglage`), et le bloc « N réglages n'ont pas pu être
  //    lus » (ReglagesPasLus) nomme ceux qui ont échoué — un panneau jamais
  //    monté ne lirait rien et ce bloc se tairait. Aucune règle de lecture ni
  //    d'écriture ne change : c'est le même composant, rangé ailleurs.
  const etroit = useEtroitReglages();
  const streamOn = useStream();
  const [nMuetsPush, setNMuetsPush] = React.useState(null);
  const [rechercheReglage, setRechercheReglage] = React.useState('');
  // (5 nov., chantier G, revue 2.24) Les e-mails ne sont plus un sous-écran d'ici : la demande
  // « ouvre mes adresses » (`DEMANDE_ADRESSES`) est servie par l'écran E-mails, onglet « Relier ma boîte ».
  const [sous, setSous] = React.useState(null);       // l'id du sous-écran ouvert (téléphone)
  // (6 nov.) « Signaler un problème » : la feuille (src/composants/SignalerProbleme.jsx).
  const [signaler, setSignaler] = React.useState(false);
  // (6 nov.) Les conseils (src/Conseils.jsx) : l'interrupteur et « Revoir », sur SA ligne.
  const [conseilsOn, basculerConseils, revoirLesConseils] = useReglageConseils({ lire: lireLigneAccompagnement, ecrire: ecrireLigneAccompagnement });
  const racine = React.useRef(null);
  const ouvrirSous = (id) => { setSous(id); try { racine.current && racine.current.scrollIntoView({ block: 'start' }); } catch (_) {} };
  // (31 oct., soir) Un lien vers l'ancien « eBay → Compte » (`?tab=plat_ebay&section=compte`)
  // ouvre le panneau « Comptes eBay » — une fois, puis la demande est consommée.
  React.useEffect(()=>{ if(ouvrir==='ebay'&&ebayCompte){ setVueBrute('reglages'); setSous('ebay'); if(onOuvert) onOuvert(); } /* eslint-disable-next-line */ },[ouvrir,!!ebayCompte]);
  // (6 nov.) Un conseil ouvre un panneau (« Voir comment ») : `DEMANDE_REGLAGE_SOUS`.
  React.useEffect(()=>{ const servir=()=>{ const id=DEMANDE_REGLAGE_SOUS.id; if(!id) return; DEMANDE_REGLAGE_SOUS.id=null; setVueBrute('reglages'); ouvrirSous(id); setTimeout(()=>{ try{ const el=document.querySelector(`[data-sous-ouvrir="${id}"]`)||document.querySelector(`[data-sous-panneau="${id}"]`); if(el&&el.getClientRects().length) el.scrollIntoView({block:'center'}); }catch(_){} },60); }; servir(); window.addEventListener('vrm:reglage-sous',servir); return ()=>window.removeEventListener('vrm:reglage-sous',servir); /* eslint-disable-next-line */ },[]);
  // (6 nov.) La notification « problème signalé » ouvre la liste (propriétaire seul).
  React.useEffect(()=>{ if(DEMANDE_SIGNALEMENTS.on&&proprioInst){ DEMANDE_SIGNALEMENTS.on=false; setVueBrute('reglages'); setSous('signalements'); setTimeout(()=>{ try{ const el=document.getElementById('reglages-aide'); if(el) el.scrollIntoView({block:'start'}); }catch(_){} },50); } },[proprioInst]);
  const versPlateforme=(p)=>{ if(p==='plat_ebay'&&ebayCompte){ setVueBrute('reglages'); ouvrirSous('ebay'); return; } if(onPlateforme) onPlateforme(p); };
  const fermerSous = () => { const id = sous; setSous(null); setTimeout(() => { try { const l = racine.current && racine.current.querySelector(`[data-sous-ouvrir="${id}"]`); if (l) { l.scrollIntoView({ block: 'center' }); l.focus({preventScroll:true}); } } catch (_) {} }, 0); };
  const setVue = (v) => { setVueBrute(v); setSous(null); try { localStorage.setItem('vrm_reglages_vue', v); } catch (_) {} };
  // (8 nov.) La ligne de l'abonnement de la coque (J-3, J-1) ouvre cet onglet.
  React.useEffect(() => { const f = () => { setVueBrute('abonnement'); setSous(null); }; window.addEventListener('vrm:voir-abonnement', f); return () => window.removeEventListener('vrm:voir-abonnement', f); }, []);


  // ── Les valeurs dites à droite des lignes : lues dans LEUR réglage, jamais
  //    recalculées (§11). Relues à chaque rendu (fermer un sous-écran en est un).
  const valNumeros = (() => { const p = prefixeNumeros(); return p ? `Série ${p}` : 'Chiffres'; })();
  const valRegime = (() => { const r = regimeFiscal(); const x = r && REGIMES_FISCAUX.find((g) => g[0] === r); return x ? x[1] : 'À choisir'; })();
  const valZoom = (() => { const z = readZoom(); const t = etroit && Number(z) < 1 ? '1' : z; return (ZOOMS.find(([v]) => v === t) || [, 'Normal'])[1]; })();
  const derniereSauvegarde = (() => { const t = Number(load('vinted_last_backup', 0)) || 0; const days = t ? Math.floor((Date.now() - t) / 86400000) : null; return { t, days, old: days === null || days >= 30 }; })();
  const tokWidget = load('vrm_widget_token', '');
  // (6 nov.) Le jeton des SMS Mondial Relay : relu dans le stockage (le nuage le remplit au chargement).
  const [jetonSms, setJetonSms] = useState(() => load('vrm_sms_token', ''));
  const urlWidget = tokWidget ? `https://vrm.center/api/widget?k=${tokWidget}` : '';

  // ── Les morceaux de rendu (des FONCTIONS appelées, pas des composants : un
  //    composant défini ici serait recréé à chaque rendu, et ce qu'il contient
  //    — un panneau en cours de saisie — remonterait à neuf).
  const chevron = <svg className="vrm-set-chev" width="9" height="15" viewBox="0 0 9 15" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1.5 1.5 6 6-6 6"/></svg>;
  const ligne = (it) => {
    if (it.type === 'el') return <React.Fragment key={it.id}>{it.el}</React.Fragment>;
    const ouvre = it.type === 'panneau';
    const corps = (<>
      {it.ic && <IconeReglage name={it.ic}/>}
      <span className="vrm-set-lib">
        <b style={{color:C.text}}>{it.lib}</b>
        {/* (6 nov., onglets D) « Chaque réglage dit en une phrase ce qu'il fait » (demande du 6 nov.,
            qui remplace la critique #1.4 du 3 nov.) : la phrase revient, UNE ligne grise, courte ;
            une alerte (un élément) garde sa couleur. */}
        {it.desc && <small className="vrm-set-desc" data-reglage-phrase={typeof it.desc === 'string' ? '' : 'alerte'} style={{color:C.muted}}>{it.desc}</small>}
      </span>
      {it.val != null && it.val !== '' && <span className="vrm-set-val" style={{color:C.muted}}>{it.val}</span>}
      {it.type === 'switch' && <Interrupteur on={it.on} label={it.lib} onClick={it.onClick} {...(it.data || {})}/>}
      {(ouvre || it.type === 'nav') && chevron}
    </>);
    if (it.type === 'switch') return <div key={it.id} className="vrm-set-ligne">{corps}</div>;
    return (
      <button key={it.id} type="button" className="vrm-set-ligne"
        onClick={ouvre ? () => ouvrirSous(it.id) : it.onClick}
        {...(ouvre ? { 'data-sous-ouvrir': it.id, 'aria-haspopup': 'true' } : {})} {...(it.data || {})}>
        {corps}
      </button>
    );
  };
  const contenuPanneau = (it, avecTete) => it.nu
    ? (<div className="vrm-set-carte" style={{background:C.card,border:`1px solid ${C.border}`}}>
        {avecTete && <div className="vrm-set-carte-tete"><IconeReglage name={it.ic}/><b style={{color:C.text}}>{it.lib}</b></div>}
        {it.el}
      </div>)
    : <div className="vrm-set-panneau">{it.el}</div>;
  const liste = (items) => items.length ? (
    <div className="vrm-set-liste" style={{background:C.card,border:`1px solid ${C.border}`}}>{items.map(ligne)}</div>
  ) : null;
  const groupe = (g) => {
    if (!g || !g.items.some(Boolean)) return null;
    const items = g.items.filter(Boolean);
    // Téléphone : tout en lignes. Ordinateur : les lignes, puis les panneaux dépliés.
    // Un groupe « brut » (l'onglet Abonnement) se rend tel quel, sans liste.
    let corps;
    if (g.brut) corps = items.map((it) => <React.Fragment key={it.id}>{it.el}</React.Fragment>);
    else corps = liste(items);

    return (
      <section key={g.id} id={`reglages-${g.id}`} className="vrm-set-groupe" data-groupe-reglages={g.id}>
        {g.titre && <h3 className="vrm-set-titre" style={{color:C.muted}}>{g.titre}</h3>}
        {corps}
        {g.pied && <div className="vrm-set-pied" style={{color:C.muted}}>{g.pied}</div>}
      </section>
    );
  };

  // ── TES DONNÉES ET LES CONDITIONS
  const donnees = (
    <div style={{fontSize:13,color:C.muted,lineHeight:1.55}}>
      <b style={{color:C.text}}>Exporter</b> : « Sauvegarde complète » {ongletsCompte ? '(Réglages)' : 'ci-dessous'}{AUTH.user ? <> · <b style={{color:C.text}}>Fermer ton compte</b> : « Fermer mon compte »</> : null}. Tes autres droits : <a href="/legal/confidentialite.html" target="_blank" rel="noopener" style={{color:C.accentTexte}}>politique de confidentialité</a>.
      <LigneContact/>
      <div style={{display:'flex',flexWrap:'wrap',gap:'4px 16px',marginTop:10}}>
        {DOCS_LEGAUX.map(([h,t]) => <a key={h} href={h} target="_blank" rel="noopener" style={{color:C.accentTexte,fontWeight:500,textDecoration:'none',minHeight:44,minWidth:44,display:'inline-flex',alignItems:'center'}}>{t}</a>)}
      </div>
    </div>
  );

  // Boutons communs au widget et à l'installation de l'application.
  // ── WIDGET IPHONE — l'adresse contient ta clé personnelle. Avant, cette
  //    adresse était publique : n'importe qui pouvait lire ton chiffre
  //    d'affaires en la connaissant. Recopie la nouvelle dans Scriptable.
  const widget = urlWidget ? (
    <div>
      <div style={{fontSize:13,color:C.muted,marginBottom:10,lineHeight:1.45}}>
        Contient <b>ta clé</b> : ne la partage pas. Colle-la dans Scriptable.
      </div>
      <div style={{fontSize:12,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',color:C.text,background:C.bg,
        border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',wordBreak:'break-all',lineHeight:1.5,marginBottom:12}}>{urlWidget}</div>
      <Bouton variante="primaire" icone="copy" onClick={()=>{ try{navigator.clipboard.writeText(urlWidget); toast('✓ Adresse copiée');}catch(_){ toast('Copie impossible','error'); } }}>
        Copier l'adresse
      </Bouton>
    </div>
  ) : null;

  // ── LES GROUPES ────────────────────────────────────────────────────────────
  // Réglages de l'APP.
  const profilV = useProfilVendeur();
  const GROUPES_REGLAGES = [
    // (1er nov.) Le groupe portait « Comptes Vinted » mais rangeait aussi eBay, les
    // emails et la sécurité : son titre dit maintenant ce qu'il contient, et
    // « Import des emails Vinted » vient à côté de « Réception des emails »
    // (il était dans Comptabilité, loin de l'autre réglage des emails).
    // (6 nov.) PARAMÈTRES PAR INTENTION — Julien : « tout doit être simplifié, on doit être
    // beaucoup plus accompagné ». Les groupes disent ce qu'on vient faire (Mes comptes, Mes
    // e-mails, Notifications, Mon abonnement, Sécurité et sauvegarde, Aide), et chaque ligne
    // dit en UNE phrase ce que fait le réglage. Les `id` et les attributs `data-*` ne bougent
    // pas (bancs, recherche) ; seuls les titres, l'ordre et les phrases changent.
    { id:'comptes', titre:'Mes comptes', items:[
      // (8 nov.) « Tout va bien ? » EN HAUT : chaque compte relu ou bloqué, chaque appareil et sa version (src/ToutVaBien.jsx).
      { id:'toutvabien', type:'panneau', ic:'heart', lib:'Tout va bien ?', desc:'Chaque compte, sa dernière relecture et l’extension de chaque appareil.', data:{ 'data-reglage-toutvabien':'' }, el:<ToutVaBien onComptes={()=>setTab('vintedaccounts')}/> },
      { id:'liens', type:'nav', ic:'link', lib:L.comptesLies, desc:'Tes comptes Vinted, Leboncoin, Vestiaire et eBay : lesquels comptent dans tes chiffres.', onClick:()=>setTab('vintedaccounts') },
      { id:'connexions', type:'panneau', ic:'pulse', lib:'État des connexions', desc:'Pour chaque compte : ce qui est à jour, ce qui attend un geste de toi.', titreInterne:true, el:<ConnexionsSetting key={AUTH.user?.id||'sans-session'} comptes={comptes||[]} onComptes={()=>setTab('vintedaccounts')} onPlateforme={versPlateforme}/> },
      // (31 oct., soir) L'ancien « eBay → Compte » : connexion et comptes eBay reliés.
      ebayCompte && { id:'ebay', type:'panneau', ic:'shop', lib:'Comptes eBay', desc:'Connecter eBay à VRM et choisir les comptes reliés.', el:ebayCompte },
    ]},
    { id:'emails-reglages', titre:'Mes e-mails', items:[
      // (5 nov., chantier G, revue 2.24) UN seul écran « E-mails » : l'ancien sous-écran est devenu
      // l'onglet « Relier ma boîte » de l'écran E-mails ; Paramètres y MÈNE (plus de second écran ici).
      { id:'adresses', type:'nav', ic:'mail', lib:L.emails, desc:'Relier ta boîte pour que VRM lise tes ventes, colis et codes de retrait.', onClick:()=>{ ouvrirEmailsRelier('reception'); setTab('emails'); }, data:{ 'data-reglage-emails':'', 'data-sous-ouvrir':'adresses' } },   // l'attribut d'avant reste : « Paramètres → E-mails » se touche au même endroit
      proprioInst && { id:'import', type:'panneau', nu:true, ic:'calendar', lib:'Import des e-mails Vinted', desc:'À partir de quelle date VRM relit tes anciens e-mails.', el:<EmailStartSetting key={AUTH.user?.id||'sans-session'} nu/> },
    ]},
    { id:'notifications', titre:'Notifications', items:[
      { id:'push', type:'panneau', ic:'bell2', lib:'Notifications du téléphone', titreInterne:true,
        desc: nMuetsPush > 0 ? <span style={{color:C.warn,fontWeight:600}}>{nMuetsPush} compte{nMuetsPush>1?'s':''} sans e-mail : pas de notification</span> : 'Être prévenu sur ton téléphone d’une vente, d’une offre ou d’un colis.',
        el:<><PushSetting/><div style={{height:12}}/><PushPrefsSetting comptes={comptes} onMuets={setNMuetsPush}/><BilanMoisSetting/><RelancesEssaiSetting/><MailEssaiSetting/></> },
      // Alertes locales (l'ancien bouton 🔔 du haut) : bandeau + notification
      // quand l'app est OUVERTE (ventes comptabilisées, factures reçues).
      // (6 nov.) Les colis en casier que Mondial Relay n'annonce que par SMS : jeton + pas-à-pas Raccourcis.
      { id:'sms-colis', type:'panneau', nu:true, ic:'truck', lib:'SMS Mondial Relay', desc:'Faire lire à VRM les SMS de Mondial Relay pour tes colis en casier.', val: etatJetonSms(jetonSms) === 'actif' ? 'Activé' : etatJetonSms(jetonSms) === 'coupe' ? 'Coupé' : 'À activer', data:{ 'data-reglage-sms':etatJetonSms(jetonSms) },
        el:<SmsColisSetting jeton={jetonSms} onJeton={(v)=>{ save('vrm_sms_token', v); setJetonSms(v); }} toast={toast}/> },
      { id:'alertes', type:'switch', ic:'alert', lib:"Alertes dans l'app", desc:'Un bandeau pour tes ventes et factures, quand l’app est ouverte.', on:!!notifEnabled, onClick:onToggleNotif, data:{ 'data-reglage-alertes': notifEnabled ? 'on' : 'off' } },
    ]},
    // « Mon abonnement » : l'onglet du haut, joignable depuis la liste (le même écran, §11).
    MULTI_USER && AUTH.user && { id:'abonnement-lien', titre:'Mon abonnement', items:[
      { id:'abonnement-ouvrir', type:'nav', ic:'wallet', lib:'Mon abonnement', desc:'Ton offre, ta carte, tes factures, et l’arrêt si tu veux.', onClick:()=>setVue('abonnement'), data:{ 'data-reglage-abonnement':'' } },
    ]},
    MULTI_USER && { id:'stock', titre:'Stock et rangement', items:[
      { id:'numeros', type:'panneau', nu:true, ic:'tag', lib:'Numéros de rangement', desc:`Comment s’écrivent les numéros de tes prochain${profilV.vend === 'sneakers' ? 'es paires' : 's articles'}.`, val:valNumeros, el:<NumerosSetting nu onStock={()=>setTab('garage')} onAnnonces={()=>setTab('cat_annonces')}/> },
      // ⛔ Réponse automatique aux messages Vinted retirée (16 oct., sa décision).
      // ⛔ Détourage des photos retiré des Paramètres (17 oct., sa décision) :
      //    il n'existe plus que pour Vestiaire Collective, qui l'exige, sans réglage.
    // (5 nov., chantier H — revue 2.31) « Organisation » n'est plus une ligne de la
    // liste (inutilisée, 29 oct.) : l'écran reste joignable par SON LIEN, sous le
    // groupe — jamais perdu (`?tab=organisation` aussi).
    ], pied: <button type="button" className="vrm-lien-action vrm-set-lien" data-reglage-organisation="" onClick={()=>setTab('organisation')}>Organisation<Icon name="chevron" size={13}/></button>},
    // (3 nov.) Les textes types insérés en un tap dans une description.
    { id:'annonces-reglages', titre:'Annonces', items:[
      { id:'modeles', type:'panneau', nu:true, ic:'pencil', lib:'Mes modèles', desc:'Des textes prêts à insérer d’un geste dans une description.', val:String(lireModelesRanges().length || ''), data:{ 'data-reglage-modeles':'' }, el:<ModelesSetting/> },
    ]},
    { id:'impression', titre:'Impression', items:[
      { id:'imprimante', type:'panneau', nu:true, ic:'printer', lib:'Imprimante et bordereaux', desc:'Le papier de ton imprimante, pour des bordereaux à la bonne taille.', val: imprimanteChoisie() === 'thermique' ? 'Thermique · 10×15' : 'Normale · A4', el:<ImprimanteSetting nu/> },
    ]},
    { id:'compta', titre:'Compta', items:[
      // (1er nov.) À droite, le statut CHOISI (lu dans `vinted_regime`, jamais deviné) :
      // « À choisir » tant qu'il ne l'a pas posé — avant, il fallait ouvrir pour savoir.
      { id:'regime', type:'panneau', nu:true, ic:'receipt', lib:L.statut, desc:'Ton statut fiscal : il fixe le taux de tes cotisations URSSAF.', val:valRegime, data:{ 'data-reglage-regime': regimeFiscal() || 'aucun' }, el:<RegimeSetting nu/> },
      // Julien, 1er oct. : « les ventes masquées, je veux que ce soit dans les
      // paramètres, pas sous Factures ». L'écran reste monté, joignable ici.
      // (1er nov.) Depuis le 29 oct. une VENTE ne se masque plus : la ligne disait
      // encore « Ventes et achats masqués » pour un écran qui ne liste que des achats.
      { id:'masques', type:'nav', ic:'eyeOff', lib:'Achats masqués', desc:'Les achats que tu as retirés de la compta, à réafficher.', onClick:()=>setTab('masques'), data:{ 'data-reglage-masques':'' } },
      // (31 oct., soir) La porte « Compléter les prix d'achat » revient ici (retirée par la
      // refonte du 31 oct.) : même destination — Annonces · Vinted, saisie en série ouverte.
      { id:'prixachat', type:'nav', ic:'cash', lib:"Compléter les prix d'achat", desc:'Les saisir à la suite : sans eux, le bénéfice n’est qu’un minimum.', onClick:()=>{DEMANDE_SAISIE_PRIX.on=true;setTab('vinted_annonces');} },

    ]},
    { id:'affichage', titre:'Affichage', items:[
      // (8 nov.) Simple / Complet et « Je vends » (src/profilVendeur.js).
      { id:'affichage-mode', type:'panneau', nu:true, ic:'grid', lib:'Affichage', desc:'Simple : seulement ce qui te sert déjà. Complet : tout.', val: profilV.mode === 'simple' ? 'Simple' : 'Complet', data:{ 'data-reglage-affichage': profilV.mode }, el:<AffichageSetting/> },
      { id:'je-vends', type:'panneau', nu:true, ic:'bag', lib:'Je vends', desc:'Sneakers, ou autre chose : les mots et les vérifications suivent.', val: profilV.vend === 'sneakers' ? 'Sneakers' : 'Autre', data:{ 'data-reglage-vends': profilV.vend || 'autre' }, el:<JeVendsSetting/> },
      { id:'sombre', type:'switch', ic:'moon', lib:'Mode sombre', desc: apparence === 'auto' || apparence === 'soir' ? `${LIBELLES_APPARENCE[apparence]} : ${PHRASES_APPARENCE[apparence].replace(/\.$/, '').toLowerCase()}.` : 'Fond sombre, plus doux le soir.', on:!!dark, onClick:toggleDark, data:{ 'data-reglage-sombre': dark ? 'on' : 'off' } },
      // (8 nov., « beauté ») L'apparence : Clair · Sombre · Automatique (le système) · Le soir (19 h–7 h).
      // L'interrupteur ci-dessus reste le choix explicite (il quitte Automatique / Le soir).
      onApparence && { id:'apparence', type:'panneau', nu:true, ic:'contraste', lib:'Apparence', desc:'Clair, sombre, comme l’appareil, ou sombre le soir.', val: LIBELLES_APPARENCE[apparence] || '', data:{ 'data-reglage-apparence': apparence || '' }, el:<ApparenceSetting valeur={apparence} onChoisir={onApparence}/> },
      // (5 nov.) Le mode stream PROGRAMMÉ : son sous-écran (catégories, mots, aperçu).
      // (5 nov., chantier H) L'interrupteur DANS la liste (le même état que « Stream » en
      // haut : un réglage), et son programme dans un sous-écran à son nom — le titre
      // « Mode stream » n'est plus écrit deux fois dans le sous-écran.
      { id:'stream-on', type:'switch', ic:'stream', lib:'Mode stream', desc:'Cache tes montants, pseudos et adresses quand tu filmes ton écran.', on:!!streamOn, onClick:()=>poserStream(!streamOn), data:{ 'data-reglage-stream-on': streamOn ? 'on' : 'off' } },
      { id:'stream', type:'panneau', nu:true, ic:'filter', lib:'Ce que le stream cache', desc:'Choisir les mots, marques et comptes à cacher.', data:{ 'data-reglage-stream': streamOn ? 'on' : 'off' }, el:<ReglagesStream/> },
      { id:'zoom', type:'panneau', nu:true, ic:'texte', lib:"Taille de l'affichage", desc:'Agrandir ou réduire les textes de VRM.', val:valZoom, el:<ZoomSetting nu/> },
      urlWidget && { id:'widget', type:'panneau', nu:true, ic:'chart', lib:'Widget iPhone', desc:'Ton lien privé pour Scriptable', el:widget },
    ]},
    { id:'sauvegarde', titre:'Sécurité et sauvegarde', items:[
      { id:'securite', type:'panneau', ic:'shield', lib:'Sécurité des données', desc:'Vérifier que toi seul peux lire et écrire tes données.', el:<SecuriteSetting/> },
      { id:'donnees', type:'action', ic:'doc', lib:'Exporter mes données', desc:'Tes ventes, achats et annonces dans un fichier, pour toi.', onClick:exporterMesDonnees, data:{ 'data-exporter-donnees':'' } },
      { id:'export', type:'action', ic:'archive', lib:'Sauvegarde complète', desc:'Tout VRM (réglages, numéros, données) dans un fichier à garder.', onClick:onExport, data:{ 'data-reglage-sauvegarde':'' } },
      { id:'restaurer', type:'action', ic:'restore', lib:'Restaurer une sauvegarde', desc:'Remettre VRM tel qu’il était dans une sauvegarde.', onClick:onImport },
    ], pied: (
      <span data-derniere-sauvegarde={derniereSauvegarde.old ? 'ancienne' : 'recente'} style={{color: derniereSauvegarde.old ? C.warn : C.muted, fontWeight: derniereSauvegarde.old ? 600 : 400}}>
        {derniereSauvegarde.t ? `Dernière sauvegarde : ${derniereSauvegarde.days===0?"aujourd'hui":derniereSauvegarde.days===1?'hier':`il y a ${derniereSauvegarde.days} j`}${derniereSauvegarde.old?' · à refaire':''}` : 'Jamais sauvegardé — touche « Sauvegarde complète »'}
      </span>
    )},
    {id:'aide',titre:'Aide',items:[
      // (8 nov.) Un geste : extension (présente, version, connectée à CE compte), comptes, boîte e-mail, dernière relecture — et ce qui manque.
      { id:'verifier', type:'panneau', nu:true, ic:'check', lib:'Vérifier mon installation', desc:'Extension, comptes, boîte e-mail : ce qui manque, et le geste.', data:{ 'data-reglage-verifier':'' }, el:<VerifierInstallationApp comptes={comptes} onNav={setTab} seule/> },
      // (2 nov.) La visite en bulles, rejouée sur son clic (src/VisiteBulles.jsx).
      { id:'visite', type:'action', ic:'play', lib:'Revoir la visite', desc:'Les onglets de VRM présentés un par un.', onClick:()=>{ try { window.dispatchEvent(new Event('vrm:visite')); } catch (_) {} }, data:{ 'data-reglage-visite':'' } },
      // (6 nov.) L'accompagnement : une bulle sur le bon bouton, deux par jour au plus (src/accompagnement.js).
      // « Pas su » (ligne pas lue) : l'interrupteur ne ment pas, la phrase le dit.
      { id:'conseils', type:'switch', ic:'spark', lib:'Conseils', desc: conseilsOn === null ? 'Pas pu lire ce réglage — touche pour réessayer.' : 'Une bulle sur le bon bouton quand un geste t’aiderait.', on:conseilsOn === true,
        onClick:()=>{ if (conseilsOn === null) { try { window.dispatchEvent(new Event('vrm:accompagnement')); } catch (_) {} return; } if (conseilsOn === undefined) return; basculerConseils().then((r)=>{ if(r.etat==='ko') toast('Pas pu enregistrer — réessaie.'); }); },
        data:{ 'data-reglage-conseils': conseilsOn === true ? 'on' : conseilsOn === false ? 'off' : 'pas-su' } },
      { id:'conseils-revoir', type:'action', ic:'sync', lib:'Revoir les conseils', desc:'Ceux que tu as passés ou masqués pourront revenir.', onClick:()=>{ revoirLesConseils().then((r)=>toast(r.etat==='ok' ? 'Les conseils pourront revenir.' : 'Pas pu enregistrer — réessaie.')); }, data:{ 'data-reglage-conseils-revoir':'' } },
      // (6 nov.) Un bouton : le message part avec l'écran, les versions, le navigateur
      // et les plantages de cet appareil — et il voit tout avant d'envoyer.
      // (8 nov.) Le centre d'aide (vrm.center/aide, public/aide/) : des articles courts, une recherche.
      { id:'centre-aide', type:'action', ic:'search', lib:'Centre d’aide', desc:'Installer l’extension, relier ta boîte, les numéros, l’URSSAF.', onClick:()=>{ try { window.open('/aide', '_blank', 'noopener'); } catch (_) {} }, data:{ 'data-reglage-centre-aide':'' } },
      // (8 nov., confiance) La page publique de l'état de VRM (vrm.center/statut), dans un nouvel onglet.
      { id:'statut', type:'nav', ic:'cloud', lib:'État de VRM', desc:'La base, les e-mails et les notifications fonctionnent-ils ?', onClick:()=>{ try { window.open('/statut', '_blank', 'noopener'); } catch (_) {} }, data:{ 'data-reglage-statut':'' } },
      { id:'signaler', type:'action', ic:'send', lib:'Signaler un problème', desc:'Dire ce qui ne va pas : tu vois tout ce qui part avant d’envoyer.', onClick:()=>setSignaler(true), data:{ 'data-reglage-signaler':'' } },
      // La liste des signalements reçus : au PROPRIÉTAIRE de l'installation seul
      // (le serveur refuse tout autre compte).
      proprioInst && { id:'signalements', type:'panneau', nu:true, ic:'info', lib:'Signalements reçus', data:{ 'data-reglage-signalements':'' }, el:<SignalementsRecus entetes={enTeteSession} Bouton={Bouton} PanneEl={EtatPanne}/> },
      {id:'depannage',type:'panneau',nu:true,ic:'help',lib:'Résoudre un problème',desc:'Les gestes à faire quand un e-mail, un compte ou une impression coince.',el:<div className="vrm-settings-help">
      <details data-aide-statut=""><summary>VRM semble en panne</summary><p>La page d’état dit, minute par minute, si la base, la réception des e-mails et les notifications fonctionnent, et les incidents connus. Si tout y fonctionne, le souci vient sans doute de cet appareil : recharge la page.</p><Bouton variante="secondaire" onClick={()=>{ try { window.open('/statut', '_blank', 'noopener'); } catch (_) {} }}>Voir l’état de VRM</Bouton></details>
      <details><summary>Je ne reçois pas mes e-mails</summary><p>Vérifie l’adresse associée au compte Vinted, sa confirmation, puis le transfert depuis ta messagerie. L’historique reçu permet de distinguer un e-mail absent d’un e-mail à vérifier.</p><Bouton variante="secondaire" onClick={()=>{ ouvrirEmailsRelier('reception'); setTab('emails'); }}>{L.relierBoite}</Bouton></details>
      <details><summary>Mon compte Vinted n’apparaît pas</summary><p>Connecte le compte attendu sur Vinted et vérifie que l’extension utilise ton compte VRM. Actualise ensuite les comptes liés et contrôle le pseudo. N’ajoute pas les données d’un autre vendeur.</p><Bouton variante="secondaire" onClick={()=>setTab('vintedaccounts')}>Voir mes comptes liés</Bouton></details>
      <details><summary>Mon bordereau s’imprime mal</summary><p>Choisis le papier correspondant à ton imprimante, ouvre un aperçu puis contrôle l’échelle d’impression. Le numéro doit rester dans un espace blanc. En cas d’échec d’un lot, relance uniquement les fichiers refusés.</p><Bouton variante="secondaire" onClick={()=>ouvrirSous('imprimante')}>Vérifier l’impression</Bouton></details>
    </div>}]},
  ];
  // « Mon compte » : la PERSONNE.
  const GROUPES_COMPTE = MULTI_USER ? [
    { id:'profil', titre:null, items:[
      { id:'prenom', type:'el', el:<PrenomSetting key="prenom"/> },
    ], pied:'Pour te dire bonjour sur l’accueil. Vide : « Bonjour ».' },
    // Discord relié au COMPTE (20 oct.), sans être sur la carte de la communauté.

    // (5 nov., chantier H — revue 2.31) Discord était dit DEUX fois : une ligne
    // « Bientôt » (fournisseur de connexion) ET la carte qui le relie (« Discord
    // relié » ou « pas pu lire »). Une seule ligne par compte : Google ici,
    // Discord par `DiscordCompte` (la liaison, qui ouvre aussi « Se connecter avec Discord »).
    AUTH.user && {id:'connexions-rapides',titre:'Comptes associés',items:[
      {id:'google',type:'el',el:<ConnexionsCompte nu theme={C} providers={OAUTH_PROVIDERS.filter(pr=>pr.id!=='discord')} enabled={providerEnabled} relier={oauthRelier} lire={lireConnexionsOAuth} retour={AUTH_REDIRECT?.error||(AUTH_REDIRECT?.liaison==='google'?'Ton compte Google est associé à VRM.':AUTH_REDIRECT?.liaison==='discord'?'Ton compte Discord est associé à VRM : « Se connecter avec Discord » ouvrira désormais ce compte-ci.':'')} icone={id=><BrandMark id={id}/>}/>},
      {id:'discord',type:'el',el:<DiscordCompte key="discord"/>},
    ]},
    // (29 oct., revue) PAS de carte Photoroom ici : le 17 oct. Julien a dit du
    // détourage « ne le mets pas dans les paramètres ». Elle vit sur l'écran
    // Vestiaire Collective (le banc detourage-reglage refuse la carte ici).
    // (1er nov.) La carte porte déjà son titre (« Ta photo de profil ») : le groupe ne
    // le redit pas et ne l'enferme plus dans une seconde carte. Sa lettre de repli est
    // celle de l'en-tête (l'initiale de l'email), plus un « V » qui ne venait de rien.
    // (5 nov., chantier H) La photo se change DANS la carte du profil (plus d'avatar dessiné deux fois).
    // (17 oct.) L'abonnement a SON onglet (« Abonnement ») ; ici, un renvoi.
    AUTH.user && { id:'boutique', titre:'Ta boutique', items:[
      // (30 oct.) « Abonnement et factures » retiré : l'onglet « Abonnement » du haut fait la même chose.
      { id:'equipe', type:'panneau', ic:'users', lib:'Équipe', desc:'Inviter un aide pour les colis', el:<EquipeSetting/> },
    ]},
    { id:'connexion', titre:'Connexion', items:[
      AUTH.user && { id:'email', type:'nav', ic:'mail', lib:'Changer mon e-mail', onClick:()=>{ setAcct({ mode:'email', val:'', err:'', busy:false }); } },
      AUTH.user && { id:'motdepasse', type:'nav', ic:'key', lib:'Changer mon mot de passe', onClick:()=>{ setAcct({ mode:'pw', val:'', err:'', busy:false }); } },
      // Double vérification (TOTP) — facultative, sur SON clic (16 octobre).
      // (4 nov.) Les appareils où VRM est ouvert, et « Se déconnecter partout ».
      AUTH.user && { id:'appareils', type:'panneau', ic:'device', lib:'Appareils connectés', el:<AppareilsConnectes/> },
      // (4 nov.) Tout ce que VRM a envoyé en son nom, lu de ce qui est noté en base.
      AUTH.user && { id:'journal-vrm', type:'panneau', ic:'clock', lib:'Ce que VRM a fait', el:<JournalVrm/> },
      AUTH.user && { id:'double', type:'panneau', nu:true, ic:'lock', lib:'Double vérification', val: Array.isArray(AUTH.session && AUTH.session.totp) ? (AUTH.session.totp.length > 1 ? `Activée · ${AUTH.session.totp.length} appareils` : AUTH.session.totp.length ? 'Activée' : 'Désactivée') : '', el:<DoubleVerification/> },
    ]},
    AUTH.user && { id:'sortir', titre:null, items:[
      { id:'deconnexion', type:'action', ic:'door', lib:'Se déconnecter', danger:true, onClick:()=>{ setAcct({ mode:'out', val:'', err:'', busy:false }); } },
    ], pied:'Vide ce navigateur ; tes données restent dans ton compte.' },
    { id:'donnees', titre:'Tes données', items:[
      // (8 nov., confiance) Ce que VRM lit, garde et fait — chaque phrase tenue par le code (src/tesDonnees.js).
      { id:'tes-donnees', type:'panneau', ic:'shield', lib:'Ce que VRM lit et fait', desc:'Par site, où c’est rangé, qui y a accès.', data:{ 'data-reglage-tes-donnees':'' },
        el:<TesDonnees cloisonne={!!CLOISONNE} onExporter={exporterMesDonnees} onJournal={AUTH.user ? ()=>ouvrirSous('journal-vrm') : undefined} onFermer={AUTH.user ? ()=>ouvrirSous('fermer') : undefined}/> },
      { id:'conditions', type:'panneau', nu:true, ic:'doc', lib:'Données et conditions', el:donnees },
      AUTH.user && { id:'fermer', type:'panneau', ic:'trash', lib:'Fermer mon compte', el:<FermerCompte/> },
    ]},
  ] : [
    { id:'donnees', titre:'Tes données', items:[
      { id:'tes-donnees', type:'panneau', ic:'shield', lib:'Ce que VRM lit et fait', desc:'Par site, où c’est rangé, qui y a accès.', data:{ 'data-reglage-tes-donnees':'' },
        el:<TesDonnees cloisonne={!!CLOISONNE} onExporter={exporterMesDonnees}/> },
      { id:'conditions', type:'panneau', nu:true, ic:'doc', lib:'Données et conditions', el:donnees },
    ]},
  ];
  // L'onglet Abonnement : la carte de l'abonnement, d'un bloc (statut, prix,
  // carte, factures, résilier) — le MÊME composant qu'avant (§11).
  const GROUPES_ABONNEMENT = [{ id:'abonnement', titre:null, brut:true, items:[{ id:'abonnement', type:'el', el:<div key="abonnement" data-onglet-abonnement=""><MonAbonnement/><Parrainage/></div> }] }];
  const groupes = [...(voirCompte ? GROUPES_COMPTE : []), ...(voirReglages ? GROUPES_REGLAGES : []), ...(voirAbonnement ? GROUPES_ABONNEMENT : [])].filter(Boolean)
    .map((g) => ({ ...g, items: g.items.filter(Boolean) }));
  const panneaux = groupes.flatMap((g) => g.items.filter((it) => it.type === 'panneau'));
  const ouvert = sous ? panneaux.find((it) => it.id === sous) : null;
  const titreRetour = !ongletsCompte ? 'Paramètres' : vue === 'compte' ? 'Mon compte' : vue === 'abonnement' ? 'Abonnement' : 'Réglages';

  // ── TON COMPTE VRM ──────────────────────────────────────────────────────
  // Toujours présent en multi-vendeurs, y compris quand on est entré par la
  // porte de secours : sans ça, une fois passé par « Entrer sans compte » il
  // n'y avait AUCUN moyen de revenir à l'écran de connexion.
  const profil = MULTI_USER && voirCompte && (AUTH.user ? (
    <div className="vrm-set-profil" data-profil-compte="" style={{background:C.card,border:`1px solid ${C.border}`}}>
      <span className="vrm-set-avatar" aria-hidden="true" style={{background:`${C.text}0f`,color:C.text}}>
        <AvatarCompte key={AUTH.user.id} owner={AUTH.user.id} headers={enTeteSession} lettre={String(AUTH.user.email||'?').slice(0,1).toUpperCase()}/>
      </span>
      <span>
        <span style={{display:'block',fontSize:17,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:'-.01em'}}>{AUTH.user.email}</span>
        <span style={{display:'block',fontSize:13,color:C.muted,marginTop:3}}>
          {CLOISONNE ? 'Tes données ne sont visibles que par toi.' : 'Connecté — séparation des comptes pas encore activée.'}
        </span>
      </span>
      <div className="vrm-set-profil-photo"><PhotoProfil key={AUTH.user.id} nu owner={AUTH.user.id} headers={enTeteSession} theme={C} lettre={String(AUTH.user.email||'?').slice(0,1).toUpperCase()}/></div>
    </div>
  ) : (
    <div className="vrm-set-carte" style={{border:`1px solid ${C.warn}55`,background:`${C.warn}0d`,marginBottom:32}}>
      <div style={{fontSize:17,fontWeight:600,color:C.text}}>Tu n'es pas connecté</div>
      <div style={{fontSize:13,color:C.muted,marginTop:4,lineHeight:1.5}}>
        Accès temporaire : tes données sont là, mais rattachées à aucun compte.
      </div>
      <Bouton variante="primaire"
        className="vrm-set-connect" onClick={()=>{ try{ localStorage.removeItem('vrm_acces_direct'); }catch(_){} location.reload(); }}
        style={{marginTop:12}}>
        Aller à l'écran de connexion
      </Bouton>
    </div>
  ));

  return (
    <div ref={racine} className="vrm-set" data-reglages-disposition={etroit ? 'telephone' : 'ordinateur'} data-sous-ecran-ouvert={ouvert ? ouvert.id : ''}
      style={{'--vrm-set-filet': C.border, '--vrm-set-appui': `${C.text}0a`}}>
      {/* (5 nov., chantier H) Appelée, pas montée : `<AcctSheet/>` était un composant
          RECRÉÉ à chaque rendu — chaque lettre tapée remontait la feuille. */}
      {AcctSheet()}
      {signaler && <SignalerProblemeFeuille onClose={()=>setSignaler(false)}/>}
      {ouvert ? (
        // ── SOUS-ÉCRAN (téléphone) ──
        <div className="vrm-set-nav">
          <button type="button" className="vrm-set-retour" onClick={fermerSous} data-sous-retour="" style={{color:C.accentTexte}}>
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8"/></svg>
            {titreRetour}
          </button>
          <StatutSauvegardeReglages/>
        </div>
      ) : (<>
        {/* (5 nov., chantier H — revue 2.31) « Enregistrement en cours… » vit dans la
            ligne du titre, à droite : il ne prend plus la place d'un surtitre (le
            titre ne saute plus de 26 px à chaque réglage touché). */}
        <div className="vrm-set-tete"><h2 className="vrm-set-h1" style={{color:C.text}}>Paramètres</h2><StatutSauvegardeReglages/></div>
        {PHRASES_ECRAN.settings ? <p className="vrm-phrase-ecran vrm-phrase-reglages" data-phrase-ecran="settings">{PHRASES_ECRAN.settings}<AideEcran cle="settings"/></p> : null}
        <ReglagesPasLus/>
        {ongletsCompte && (
          // (5 nov., chantier H) Les trois onglets ont LA forme du contrôle segmenté de
          // l'app (`.vrm-seg`, une règle) : avant, un dessin à part dont l'aplat se
          // perdait (l'onglet choisi n'était pas le blanc).
          <div role="tablist" aria-label="Paramètres" data-onglets-reglages="" className="vrm-seg vrm-seg-plein vrm-set-onglets">
            {[['reglages','Réglages'],['compte','Mon compte'],...(AUTH.user?[['abonnement','Abonnement']]:[])].map(([k,l]) => (
              <button key={k} type="button" role="tab" className="vrm-seg-btn" aria-selected={vue===k} data-vue={k} onClick={()=>setVue(k)}>
                {l}
              </button>
            ))}
          </div>
        )}
      </>)}

      {ouvert && <h2 className="vrm-set-sous-h" style={{color:C.text}}>{ouvert.lib}</h2>}

      {!ouvert && <>
        {profil}
        {voirReglages && <ActionsReglages comptes={comptes||[]} onOuvrir={id=>id==='comptes'?setTab('vintedaccounts'):id==='adresses'?(ouvrirEmailsRelier('reception'),setTab('emails')):ouvrirSous(id)}/>}
        {/* (5 nov., chantier H) LE champ de recherche de l'app (`ChampRecherche`). */}
        {voirReglages && <ChampRecherche valeur={rechercheReglage} onChange={setRechercheReglage} placeholder="Rechercher un réglage" label="Rechercher dans les paramètres" className="vrm-set-recherche" data-recherche-reglages=""/>}
        {(() => {
          const filtres=filtrerReglages(groupes,voirReglages?rechercheReglage:'');
          return filtres.length ? <>{rechercheReglage.trim()&&<p className="vrm-settings-search-info" role="status" style={{color:C.muted}}>{(n=>`${n} réglage${n>1?'s':''} trouvé${n>1?'s':''}`)(filtres.reduce((n,g)=>n+g.items.length,0))}</p>}{filtres.map(groupe)}</> : <div role="status" className="vrm-set-rien" style={{color:C.muted,fontSize:13}}><p style={{margin:'0 0 4px'}}>Aucun réglage pour « {rechercheReglage.trim()} ». Essaie « e-mail », « numéro » ou « impression ».</p><Bouton variante="discret" onClick={()=>setRechercheReglage('')}>Effacer la recherche</Bouton></div>;
        })()}
      </>}
      {panneaux.map(it=><div key={it.id} hidden={!ouvert || ouvert.id!==it.id} data-sous-ecran={it.id} className={it.titreInterne?'vrm-set-sans-titre':undefined}>
        {contenuPanneau(it,false)}
      </div>)}
    </div>
  );
}

// Téléphone (< 768 px) : les panneaux longs passent dans un sous-écran.
// `matchMedia` qui lève ⇒ « pas su » ⇒ la disposition d'ordinateur, où tout
// reste déplié (rien n'est caché sur une mesure ratée).
function useEtroitReglages() {
  const q = '(max-width: 767px)';
  const lire = () => { try { return window.matchMedia(q).matches; } catch (_) { return false; } };
  const [v, setV] = React.useState(lire);
  React.useEffect(() => {
    let mq; try { mq = window.matchMedia(q); } catch (_) { return undefined; }
    const maj = () => setV(mq.matches);
    try { mq.addEventListener('change', maj); } catch (_) { return undefined; }
    return () => { try { mq.removeEventListener('change', maj); } catch (_) {} };
  }, []);
  return v;
}
// ⟦← App.jsx #37⟧
// Julien trouvait encore « trop serré » au minimum : on descend plus bas.
// 0,65 fait tenir une fois et demie plus de contenu qu'à 100 %.
const ZOOMS = [['0.65', 'Minus'], ['0.75', 'Petit'], ['0.85', 'Compact'], ['1', 'Normal'], ['1.1', 'Grand']];
// ⟦← App.jsx #38⟧

// ── TON PRÉNOM ───────────────────────────────────────────────────────────────
// « Bonjour Julien » était écrit en dur dans l'app. Sur une installation neuve
// c'est le prénom de quelqu'un d'autre, sur la première ligne du premier écran.
// Réglage SYNCHRONISÉ (il suit la personne d'un appareil à l'autre) ; vide par
// défaut, et alors l'accueil dit « Bonjour » tout court. On ne le déduit PAS de
// l'email : un prénom inventé est un faux, et un blanc vaut mieux (§5).
// ══════════════════════════════════════════════════════════════════════════
// L'ABONNEMENT (4 octobre) — 12,99 €/mois depuis le 11 octobre (9,99 € avant),
// pour tout le monde sauf le propriétaire
// ══════════════════════════════════════════════════════════════════════════
// Le serveur décide (api/compte.js) : qui est propriétaire (VRM_OWNER_UID), si
// Stripe est branché, si l'abonnement est obligatoire, et le statut — lu dans
// une table que le vendeur ne peut pas écrire. L'app ne fait que l'afficher.
// Le retour de Stripe (`?abonnement=merci|annule`) est capté AU CHARGEMENT :
// la navigation par `?tab=` efface ensuite l'adresse.
// (8 nov.) Lus dans l'adresse D'OUVERTURE (App.jsx) : cet écran est chargé à la demande, après que `goto` a nettoyé l'adresse.
const RETOUR_ABONNEMENT = (() => { try { return new URLSearchParams(RECHERCHE_OUVERTURE).get('abonnement') || ''; } catch (_) { return ''; } })();
// `?vue=compte` : ouvrir les Paramètres sur l'onglet « Mon compte » (retour de
// la page de gestion Stripe, lien direct). Capté au chargement pour la même raison.
const RETOUR_VUE = (() => { try { return new URLSearchParams(RECHERCHE_OUVERTURE).get('vue') || ''; } catch (_) { return ''; } })();
// ⟦← App.jsx #39⟧
const dateLisible = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (_) { return ''; } };

// MES FACTURES ET MA CARTE — trois états : `undefined` en cours · `null` pas su
// · `{ factures, carte }` lu. ⚠️ « Pas su » ne s'affiche JAMAIS comme « aucune
// facture » : quelqu'un qui cherche une facture pour sa compta en conclurait
// qu'elle n'existe pas.
async function lireFactures() {
  try {
    const r = await fetch('/api/compte?mode=factures', { headers: enTeteSession(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok && Array.isArray(j.factures) ? { factures: j.factures, carte: j.carte || null } : null;
  } catch (_) { return null; }
}
// Résilier (à la fin de la période payée) ou annuler la résiliation.
async function choisirResiliation(reprendre) {
  try {
    const r = await fetch(`/api/compte?mode=${reprendre ? 'reprendre' : 'resilier'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.ok) return { ok: true, annuleFinPeriode: !!j.annuleFinPeriode, finPeriode: j.finPeriode || null };
    return { ok: false, message: (j && j.message) || "Stripe n'a pas répondu. Réessaie dans un instant." };
  } catch (_) { return { ok: false, message: 'Pas de connexion. Réessaie dans un instant.' }; }
}
const montantLisible = (n, devise) => {
  if (!Number.isFinite(Number(n))) return '—';
  try { return Number(n).toLocaleString('fr-FR', { style: 'currency', currency: String(devise || 'eur').toUpperCase() }); }
  catch (_) { return `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`; }
};
const STATUT_FACTURE = { paid: 'Payée', open: 'À payer', void: 'Annulée', uncollectible: 'Impayée' };
// Seuls les liens de Stripe s'ouvrent depuis la liste (le serveur filtre déjà ;
// on ne fait pas confiance à une seula moitié).
const lienFacture = (u) => (typeof u === 'string' && /^https:\/\/(pay|invoice|files|invoicedata)\.stripe\.com\//.test(u) ? u : null);

// ── FERMER MON COMPTE (5 octobre) ────────────────────────────────────────────
// La politique de confidentialité promet l'effacement ; il fallait écrire à une
// adresse qui n'existe pas encore. Le serveur fait le travail
// (api/compte.js?mode=fermer) et rend ce qui a été fait ET ce qui ne l'a pas
// été : l'écran l'affiche tel quel — jamais « compte fermé » sur un échec.
// Trois états de réponse : `{ ok:true }` fermé · `{ ok:false, message }` dit
// par le serveur · pas de réponse = PAS SU (on ne prétend ni l'un ni l'autre).
async function fermerMonCompte(confirmation) {
  try {
    const r = await fetch('/api/compte?mode=fermer', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ confirmation }) });
    const j = await r.json().catch(() => null);
    if (j && typeof j.message === 'string') return { ok: r.ok && j.ok === true, message: j.message };
    return { ok: false, message: "Le serveur n'a pas répondu clairement : je ne sais pas si la fermeture a eu lieu. Reconnecte-toi — si ton compte existe encore, relance-la." };
  } catch (_) { return { ok: false, message: "Pas de réponse (connexion coupée) : je ne sais pas si la fermeture a eu lieu. Reconnecte-toi — si ton compte existe encore, relance-la." }; }
}
// ── DOUBLE VÉRIFICATION — le panneau de Réglages → Mon compte → Connexion ──
// Trois états pour la lecture des facteurs : `undefined` en cours · `null` pas
// su (GoTrue injoignable : on le dit, « Réessayer ») · l'objet lu.
// « Activée » ne s'écrit qu'APRÈS une vérification réussie d'un premier code.
// Désactiver demande une confirmation ET un code (la session repasse en aal2,
// ce que GoTrue exige pour supprimer un facteur vérifié).
// 22 octobre — PLUSIEURS APPAREILS, le chemin de secours GRATUIT (le SMS est
// payant, Julien l'a refusé) : chaque appareil a un nom qu'il choisit, la liste
// les montre, « Ajouter un appareil de secours » en enregistre un autre (même
// QR + premier code juste), et chacun se retire avec le code de N'IMPORTE
// LEQUEL — un téléphone perdu se retire avec le code de l'autre. Rien n'est
// imposé : avec un seul appareil, une phrase neutre propose d'en ajouter un.
const NOM_APPAREIL_MAX = 40;
const nomParDefaut = (verifies, ajout) => {
  const base = ajout ? 'Appareil de secours' : 'Téléphone';
  if (!nomAppareilPris(base, verifies)) return base;
  for (let i = 2; i < 50; i++) if (!nomAppareilPris(`${base} ${i}`, verifies)) return `${base} ${i}`;
  return base + ' ' + Date.now().toString(36);
};
function DoubleVerification({ onEtat } = {}) {
  const [f, setF] = React.useState(undefined);
  const [essai, setEssai] = React.useState(0);
  // { etape: 'nom' } (ajout : choisir le nom) · { etape: 'qr', id, qr, secret, nom, ajout }
  // · { etape: 'off', id, nom } (retirer CET appareil — le dernier = désactiver)
  const [cours, setCours] = React.useState(null);
  const [nom, setNom] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);   // { t, ton: 'ok'|'err'|'passu' }
  React.useEffect(() => {
    let mort = false; setF(undefined);
    mfaLireFacteurs().then((x) => { if (!mort) setF(x); });
    return () => { mort = true; };
  }, [essai]);
  const verifies = (f && f.verifies) || [];
  const actif = verifies.length ? verifies[0] : null;
  const seul = verifies.length === 1;
  const relire = () => setEssai((n) => n + 1);
  const champ = { width:150, boxSizing:'border-box', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px', fontSize:17, letterSpacing:4, textAlign:'center', background:C.bg, color:C.text, outline:'none', fontFamily:'inherit', fontVariantNumeric:'tabular-nums' };
  const champNom = { width:'100%', maxWidth:260, boxSizing:'border-box', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px', fontSize:17, background:C.bg, color:C.text, outline:'none', fontFamily:'inherit', minHeight:44 };
  const txt = { fontSize:13, color:C.muted, lineHeight:1.55 };
  const PASSU = "Le service de connexion ne répond pas — rien n'a changé. Réessaie dans un instant.";
  // Le champ « nom » se remplit d'une proposition libre dès qu'on sait ce qui
  // existe (jamais par-dessus ce qu'il a tapé).
  React.useEffect(() => { if (f && !nom) setNom(nomParDefaut(f.verifies, f.verifies.length > 0)); }, [f]);

  // Créer le facteur (premier appareil OU appareil de secours) puis montrer le QR.
  const creer = async () => {
    if (busy || !f) return;
    const ajout = verifies.length > 0;
    const n = String(nom || '').trim().slice(0, NOM_APPAREIL_MAX) || nomParDefaut(verifies, ajout);
    if (nomAppareilPris(n, verifies)) { setMsg({ t: `Tu as déjà un appareil nommé « ${n} » : choisis un autre nom, pour savoir lequel retirer le jour où il le faudra.`, ton: 'err' }); return; }
    setBusy(true); setMsg(null);
    // Un essai d'activation laissé en plan (facteur non vérifié) bloquerait le
    // suivant : on le retire d'abord (un facteur non vérifié ne protège rien).
    for (const x of (f && f.enAttente) || []) { await mfaAppel('DELETE', `factors/${encodeURIComponent(x.id)}`); }
    const r = await mfaAppel('POST', 'factors', { factor_type: 'totp', friendly_name: n, issuer: 'VRM' });
    setBusy(false);
    const t = r.json && r.json.totp;
    if (!r.ok || !r.json.id || !t) {
      const brut = String((r.json && (r.json.code || r.json.error_code)) || '') + ' ' + String((r.json && (r.json.msg || r.json.message)) || '');
      if (mfaInjoignable(r)) setMsg({ t: PASSU, ton: 'passu' });
      else if (r.status === 429) setMsg({ t: MFA_TROP + " Rien n'a changé.", ton: 'err' });
      else if (/name_conflict|friendly name/i.test(brut)) setMsg({ t: `Le service de connexion connaît déjà un appareil nommé « ${n} » : choisis un autre nom. Rien n'a changé.`, ton: 'err' });
      else if (r.status === 403 || /insufficient_aal|aal2/i.test(brut)) setMsg({ t: "Pour ajouter un appareil, VRM doit d'abord revérifier ton code : déconnecte-toi, reconnecte-toi (mot de passe + code), puis réessaie. Rien n'a changé.", ton: 'err' });
      else setMsg({ t: (r.json && (r.json.msg || r.json.message)) ? `Le service de connexion a refusé : « ${r.json.msg || r.json.message} ». Rien n'est activé.` : `Le service de connexion a refusé (erreur ${r.status}). Rien n'est activé.`, ton: 'err' });
      return;
    }
    const qr = await import('../qrMfa.js').then((m) => m.qrMfa(t)).catch(() => '');   // (6 nov., vitesse 2) à la demande
    setCode(''); setCours({ etape: 'qr', id: String(r.json.id), qr, secret: String(t.secret || ''), nom: n, ajout });
  };
  const annulerActivation = async () => {
    const id = cours && cours.id; setCours(null); setCode(''); setMsg(null);
    if (id) await mfaAppel('DELETE', `factors/${encodeURIComponent(id)}`);
    relire();
  };
  const recommencerActivation = async () => {
    if (busy || !cours?.id) return;
    setBusy(true); setMsg(null);
    const d = await mfaAppel('DELETE', `factors/${encodeURIComponent(cours.id)}`);
    if (!d.ok) { setBusy(false); setMsg({t:"L’ancienne configuration n’a pas pu être annulée. Réessaie avant de créer un nouveau code QR.",ton:'err'}); return; }
    setCours(null); setCode(''); setBusy(false);
    await creer();   // même nom : le champ le garde pendant l'étape du QR
  };
  const confirmerActivation = async () => {
    if (busy || !cours) return;
    setBusy(true); setMsg(null);
    const ajout = !!cours.ajout, n = cours.nom;
    const r = await mfaVerifierCode(cours.id, code, n);
    setBusy(false);
    const rien = ajout ? ' Cet appareil n’est pas ajouté.' : ' Rien n’est activé.';
    if (r.passu) { setMsg({ t: "Je n'ai pas pu vérifier ce code : le service de connexion ne répond pas." + rien + ' Réessaie.', ton: 'passu' }); return; }
    if (!r.ok) { setMsg({ t: (r.message || 'Code refusé.') + rien, ton: 'err' }); setCode(''); return; }
    setCours(null); setCode(''); setNom('');
    setMsg({ t: ajout
      ? `« ${n} » est ajouté. À la connexion, le code de n'importe lequel de tes ${verifies.length + 1} appareils marche : si l'un est perdu, entre avec l'autre et retire le perdu ici.`
      : 'Double vérification activée. À ta prochaine connexion, VRM te demandera le code de ton app après ton mot de passe.', ton: 'ok' });
    relire();
  };
  // Retirer UN appareil. Le code peut venir de N'IMPORTE LEQUEL : on essaie
  // d'abord les AUTRES (le cas « téléphone perdu »), puis celui qu'on retire.
  // Le dernier retiré = double vérification désactivée.
  const retirer = async () => {
    if (busy || !cours || cours.etape !== 'off') return;
    const cible = String(cours.id);
    const dernier = verifies.length <= 1;
    setBusy(true); setMsg(null);
    const ordre = [...verifies.map((x) => String(x.id)).filter((x) => x !== cible), cible];
    const v = await mfaVerifierCodeParmi(ordre, code);
    const reste = dernier ? ' La double vérification reste activée.' : ` « ${cours.nom} » reste enregistré.`;
    if (!v.ok) {
      setBusy(false);
      if (v.passu) setMsg({ t: "Je n'ai pas pu vérifier ce code : le service de connexion ne répond pas." + reste + ' Réessaie.', ton: 'passu' });
      else if (v.introuvable) { setMsg({ t: 'La liste de tes appareils a changé entre-temps : je la relis.', ton: 'passu' }); setCours(null); relire(); }
      else { setMsg({ t: (v.message || 'Code refusé.') + reste, ton: 'err' }); setCode(''); }
      return;
    }
    const d = await mfaAppel('DELETE', `factors/${encodeURIComponent(cible)}`);
    setBusy(false); setCode('');
    // 404 : GoTrue ne connaît plus cet appareil — il a déjà été retiré (depuis un
    // autre appareil pendant que ce formulaire était ouvert, ou par un essai dont
    // la réponse s'est perdue). C'est l'état voulu : jamais « reste enregistré ».
    const dejaParti = !d.ok && d.status === 404;
    if (d.ok || dejaParti) {
      const cur = AUTH.session;
      if (cur) {
        const noms = { ...(cur.totpNoms && typeof cur.totpNoms === 'object' ? cur.totpNoms : {}) }; delete noms[cible];
        writeSession({ ...cur, totp: (Array.isArray(cur.totp) ? cur.totp : []).filter((x) => x !== cible), totpNoms: noms });
      }
      setCours(null); setNom('');   // la proposition de nom se refait sur la liste relue
      if (dejaParti) setMsg({ t: `« ${cours.nom} » n'était déjà plus enregistré (retiré entre-temps) : son code ne permet plus d'entrer. Je relis la liste.`, ton: 'passu' });
      else setMsg({ t: dernier ? 'Double vérification désactivée. Ton mot de passe suffit de nouveau pour te connecter.' : `« ${cours.nom} » est retiré : son code ne permet plus d'entrer. Tes autres appareils restent actifs.`, ton: 'ok' });
    } else if (mfaInjoignable(d)) {
      setMsg({ t: "Je ne sais pas s'il a été retiré : le service de connexion n'a pas répondu. Je relis la liste.", ton: 'passu' });
    } else {
      setMsg({ t: `Le service de connexion a refusé (erreur ${d.status}).` + reste, ton: 'err' });
    }
    relire();
  };
  // La liste relue ne contient plus l'appareil que le formulaire « retirer » vise
  // (retiré ailleurs, ou retrait fait chez GoTrue dont la réponse s'est perdue) :
  // le formulaire se referme et la liste relue s'affiche. Sans ça, avec un seul
  // appareil restant, il devenait « Pour désactiver la double vérification… Ton
  // mot de passe suffira ensuite » — faux : l'appareil restant est toujours actif.
  React.useEffect(() => {
    if (!f || !cours || cours.etape !== 'off') return;
    if (f.verifies.some((x) => String(x.id) === String(cours.id))) return;
    setCours(null); setCode(''); setNom(nomParDefaut(f.verifies, f.verifies.length > 0));
  }, [f]);
  const ouvrirRetrait = (x) => { setCours({ etape: 'off', id: String(x.id), nom: nomAppareil(x) }); setCode(''); setMsg(null); };

  const bandeau = msg && (
    <div data-mfa-message={msg.ton} style={{fontSize:13,lineHeight:1.5,marginTop:10,borderRadius:12,padding:'9px 11px',
      color: msg.ton === 'err' ? C.danger : C.text,
      background: msg.ton === 'passu' ? `${C.warn}12` : msg.ton === 'err' ? `${C.danger}0f` : `${C.text}0a`,
      border: `1px solid ${msg.ton === 'passu' ? C.warn + '44' : msg.ton === 'err' ? C.danger + '33' : C.border}`}}>{msg.t}</div>
  );
  const etatDit = f === undefined ? 'lecture' : f === null ? 'passu' : (actif ? 'active' : 'inactive');
  React.useEffect(() => { if (onEtat) onEtat(etatDit); }, [etatDit]);
  const champDuNom = (
    <label style={{display:'block',marginTop:10}}>
      <span style={{...txt,display:'block',marginBottom:4}}>Nom de l'appareil</span>
      <input data-mfa-nom="" type="text" maxLength={NOM_APPAREIL_MAX} autoComplete="off" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. iPhone, iPad, ancien téléphone" style={champNom}/>
    </label>
  );
  return (
    <div data-mfa-panneau={etatDit} data-mfa-cours={cours ? cours.etape : ''} data-mfa-nb={f ? verifies.length : ''}>
      {f === undefined && <div style={txt}>Lecture de l'état de la double vérification…</div>}
      {f === null && (<>
        <div style={txt}>Je n'ai pas pu lire l'état de ta double vérification : le service de connexion ne répond pas. Rien n'a changé.</div>
        <button type="button" data-mfa-relire="" onClick={relire} className="vrm-b vrm-b-secondaire" style={{marginTop:10}}>Réessayer</button>
      </>)}
      {f && !actif && !cours && (<>
        <div style={txt}>
          <b style={{color:C.text}}>Désactivée.</b> Un code à 6 chiffres de ton téléphone, en plus du mot de passe. Gratuit.{' '}
          <Pourquoi label="Comment ça marche">Après ton mot de passe, VRM demande le code affiché par une app d'authentification (Mots de passe de l'iPhone, Google Authenticator, Microsoft Authenticator, Authy). Quelqu'un qui connaîtrait ton mot de passe ne pourrait pas entrer sans ton téléphone.</Pourquoi>
        </div>
        {champDuNom}
        <button type="button" data-mfa-activer="" disabled={busy} onClick={creer} className="vrm-b vrm-b-primaire" style={{marginTop:10}}>{busy ? 'Préparation…' : 'Activer'}</button>
      </>)}
      {cours && cours.etape === 'qr' && (<>
        {cours.ajout && <div data-mfa-ajout-consigne="" style={{...txt,marginBottom:6}}>Prends <b style={{color:C.text}}>l'autre appareil</b> (« {cours.nom} ») — pas celui qui te donne déjà les codes : s'il était perdu, les deux codes partiraient avec lui.</div>}
        <div style={txt}><b style={{color:C.text}}>1.</b> Sur {cours.ajout ? 'cet appareil' : 'ton iPhone'}, ouvre l'app <b style={{color:C.text}}>Mots de passe</b> (ou Google Authenticator), touche « + » puis scanne ce code :</div>
        {cours.qr
          ? <img data-mfa-qr="" src={cours.qr} alt="Code QR à scanner dans ton app d'authentification" width={180} height={180} style={{display:'block',margin:'10px 0',background:'#fff',borderRadius:12,padding:6}}/>
          : <div style={{...txt,margin:'8px 0'}}>(le code QR n'a pas pu s'afficher : utilise la clé ci-dessous)</div>}
        <details data-mfa-cle-manuelle="" style={{...txt,margin:'8px 0 12px'}}><summary style={{cursor:'pointer'}}>Configurer sans scanner le QR</summary>
          <p>Dans ton app d’authentification, choisis « saisir une clé ». Garde cette clé privée : ne la partage pas et ne l’envoie pas en capture.</p>
          <div data-mfa-cle="" style={{fontFamily:'ui-monospace,Menlo,monospace',fontSize:15,color:C.text,wordBreak:'break-all',userSelect:'all'}}>{cours.secret.replace(/(.{4})/g, '$1 ').trim()}</div>
        </details>
        <button type="button" data-mfa-recommencer="" disabled={busy} onClick={recommencerActivation} className="vrm-b vrm-b-secondaire" style={{marginBottom:10}}>Remplacer cette configuration</button>
        <div style={txt}><b style={{color:C.text}}>2.</b> Tape le code à 6 chiffres que {cours.ajout ? 'ce nouvel appareil' : "l'app"} affiche pour VRM :</div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}>
          <input data-mfa-code-activer="" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={champ}/>
          <button type="button" data-mfa-confirmer="" disabled={busy || code.length !== 6} onClick={confirmerActivation} className="vrm-b vrm-b-primaire">{busy ? 'Vérification…' : 'Confirmer'}</button>
          <button className="vrm-b vrm-b-discret" type="button" data-mfa-annuler="" disabled={busy} onClick={annulerActivation}>Annuler</button>
        </div>
      </>)}
      {actif && cours && cours.etape === 'nom' && (<>
        <div style={txt}>Un autre téléphone ou une tablette : son code fera entrer comme celui de ton appareil actuel.</div>
        {champDuNom}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
          <button type="button" data-mfa-ajouter-continuer="" disabled={busy} onClick={creer} className="vrm-b vrm-b-primaire">{busy ? 'Préparation…' : 'Afficher le code QR'}</button>
          <button className="vrm-b vrm-b-discret" type="button" disabled={busy} onClick={() => { setCours(null); setMsg(null); }}>Annuler</button>
        </div>
      </>)}
      {actif && !cours && (<>
        <div style={txt}>
          <b style={{color:C.text}}>Activée.</b> À chaque connexion, VRM demande, après ton mot de passe, le code {seul ? "de ton app d'authentification" : "de l'un de tes appareils — celui de n'importe lequel marche"}.
        </div>
        <div data-mfa-liste="" style={{marginTop:10,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}>
          {verifies.map((x, i) => (
            <div key={x.id} data-mfa-appareil={String(x.id)} style={{display:'flex',alignItems:'center',gap:10,justifyContent:'space-between',flexWrap:'wrap',padding:'8px 12px',borderTop: i ? `1px solid ${C.border}` : 'none'}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text,overflowWrap:'anywhere'}}>{nomAppareil(x)}</div>
                {x.created_at && <div style={{fontSize:12,color:C.muted}}>ajouté le {new Date(x.created_at).toLocaleDateString('fr-FR')}</div>}
              </div>
              {seul
                ? <button type="button" data-mfa-desactiver="" onClick={() => ouvrirRetrait(x)} className="vrm-b vrm-b-secondaire">Désactiver…</button>
                : <button type="button" data-mfa-retirer={String(x.id)} onClick={() => ouvrirRetrait(x)} className="vrm-b vrm-b-secondaire">Retirer…</button>}
            </div>
          ))}
        </div>
        {seul && <div data-mfa-conseil-secours="" style={{...txt,marginTop:10}}>Un seul appareil : perdu, tu ne pourras plus entrer. Ajoute un appareil de secours, ou désactive avant de changer de téléphone.</div>}
        <button type="button" data-mfa-ajouter="" onClick={() => { setNom(nomParDefaut(verifies, true)); setCours({ etape: 'nom' }); setMsg(null); }} className="vrm-b vrm-b-secondaire" style={{marginTop:10}}>{seul ? 'Ajouter un appareil de secours' : 'Ajouter un autre appareil'}</button>
      </>)}
      {actif && cours && cours.etape === 'off' && (<>
        <div style={txt}>{seul
          ? <>Pour désactiver la double vérification, tape le code actuel de ton app. Ton mot de passe suffira ensuite pour te connecter.</>
          : <>Pour retirer <b style={{color:C.text}}>« {cours.nom} »</b>, tape le code actuel de <b style={{color:C.text}}>l'un</b> de tes appareils — celui d'un autre si « {cours.nom} » est perdu. Les autres restent actifs.</>}</div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}>
          <input data-mfa-code-desactiver="" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={champ}/>
          <button type="button" data-mfa-confirmer-off="" disabled={busy || code.length !== 6} onClick={retirer} className="vrm-b vrm-b-primaire">{busy ? 'Vérification…' : seul ? 'Désactiver' : 'Retirer'}</button>
          <button type="button" disabled={busy} onClick={() => { setCours(null); setCode(''); setMsg(null); }} className="vrm-b vrm-b-discret">Garder</button>
        </div>
      </>)}
      {bandeau}
    </div>
  );
}

// ── SÉCURITÉ DU COMPTE VRM (4 nov.) — src/securiteCompte.js ──────────────────
// « Se déconnecter partout », « Appareils connectés », « Ce que VRM a fait ».
const appelSecurite = async (mode, init) => {
  try {
    const r = await fetch(`/api/compte?mode=${mode}`, { ...(init || {}), headers: { ...enTeteSession(), ...((init && init.body) ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => null);
    return { status: r.status, j };
  } catch (_) { return { status: 0, j: null }; }
};
const quandCourt = (v) => {
  const t = typeof v === 'number' ? v : Date.parse(String(v || ''));
  if (!Number.isFinite(t)) return '—';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  if (m < 24 * 60) return `il y a ${Math.round(m / 60)} h`;
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
const seDeconnecterPartout = async () => {
  const owner = AUTH.user?.id;
  if (!owner) return;
  const ext = !vmrExtPresent() ? 'inconnue' : extSait('liaison') === 'ok' ? 'liaison' : 'ancienne';
  const ok = await askConfirm({ title: 'Se déconnecter partout ?', desc: texteConfirmationPartout({ extension: ext }), ok: 'Se déconnecter partout', cancel: 'Annuler', danger: true });
  if (!ok || AUTH.user?.id !== owner) return;
  const r = await deconnecterPartout({ fetch: (...a) => fetch(...a), url: SUPABASE_URL, apikey: SUPABASE_KEY, jeton: AUTH.session && AUTH.session.access_token });
  if (AUTH.user?.id !== owner) return;
  if (r === 'injoignable') { toast("⚠️ Le service de connexion n'a pas répondu — rien n'a été fermé. Réessaie dans un instant.", 'err'); return; }
  if (r === 'refuse') toast('Ta session ici avait expiré : reconnecte-toi, puis recommence pour fermer les autres appareils.', 'info');
  else toast('✓ VRM est fermé sur tous tes appareils.', 'ok');
  setTimeout(() => { if (AUTH.user?.id !== owner) return; try { authSignOut(); } catch (_) {} location.reload(); }, 1600);
};
function AppareilsConnectes() {
  // `undefined` en cours · `{ erreur, message }` pas su · `{ appareils }` lu.
  const [etat, setEtat] = React.useState(undefined);
  const [enVol, setEnVol] = React.useState(null);
  const lire = React.useCallback(async () => {
    const { status, j } = await appelSecurite('appareils');
    setEtat(status === 200 && j && Array.isArray(j.appareils) ? { appareils: j.appareils } : { erreur: (j && j.erreur) || 'reseau', message: (j && j.message) || "Je n'ai pas pu lire tes appareils — réessaie dans un instant." });
  }, []);
  React.useEffect(() => { lire(); }, [lire]);
  const fermer = async (a) => {
    const owner = AUTH.user?.id;
    if (!owner) return;
    const ok = await askConfirm({ title: `Déconnecter ${a.appareil} ?`, desc: 'VRM s’y fermera dans l’heure au plus.', ok: 'Déconnecter', cancel: 'Annuler', danger: true });
    if (!ok || AUTH.user?.id !== owner) return;
    setEnVol(a.id);
    const { status, j } = await appelSecurite('appareils', { method: 'POST', body: JSON.stringify({ session: a.id }) });
    if (AUTH.user?.id !== owner) return;
    setEnVol(null);
    if (status === 200 && j?.ok === true && j.ferme === a.id) { toast(`✓ ${a.appareil} déconnecté.`, 'ok'); lire(); }
    else toast('⚠️ ' + ((j && j.message) || "Je n'ai pas pu déconnecter cet appareil."), 'err');
  };
  return (
    <div data-appareils={etat === undefined ? 'lecture' : etat.erreur ? 'pas-su' : String(etat.appareils.length)}>
      {etat === undefined ? <div className="vrm-sec-liste"><div className="vrm-sec-vide">…</div></div>
        : etat.erreur ? <div className="vrm-sec-liste"><div className="vrm-sec-ligne" data-appareils-erreur={etat.erreur}><div className="vrm-sec-corps"><span className="vrm-sec-sous" style={{ whiteSpace: 'normal' }}>{etat.message}</span></div><button type="button" className="vrm-sec-bouton" onClick={() => { setEtat(undefined); lire(); }}>Réessayer</button></div></div>
        : (
        <div className="vrm-sec-liste">
          {etat.appareils.map((a) => (
            <div key={a.id} className="vrm-sec-ligne" data-appareil={a.ici ? 'ici' : 'autre'}>
              <div className="vrm-sec-corps">
                <span className="vrm-sec-titre">{a.appareil}</span>
                <span className="vrm-sec-sous">{quandCourt(a.actifLe)}</span>
              </div>
              {a.ici ? <span className="vrm-sec-etat is-ici">Cet appareil</span>
                : <button type="button" className="vrm-sec-bouton" data-appareil-fermer={a.id} disabled={enVol === a.id} onClick={() => fermer(a)}>{enVol === a.id ? '…' : 'Déconnecter'}</button>}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <Bouton variante="secondaire" data-deconnexion-partout="" onClick={seDeconnecterPartout} style={{ width: '100%' }}>Se déconnecter partout</Bouton>
      </div>
    </div>
  );
}
function JournalVrm() {
  const [etat, setEtat] = React.useState(undefined);
  const [compte, setCompte] = React.useState('*');
  const [type, setType] = React.useState('tous');
  const [n, setN] = React.useState(60);
  const lire = React.useCallback(async () => {
    const { status, j } = await appelSecurite('journal');
    setEtat(status === 200 && j && Array.isArray(j.evenements) ? j : { erreur: true });
  }, []);
  React.useEffect(() => { lire(); }, [lire]);
  const fiches = load('vinted_annonce_numeros', {}) || {};
  const labels = load('vinted_account_labels', {}) || {};
  const comptesV = (() => { try { return JSON.parse(localStorage.getItem('vinted_accounts') || '[]') || []; } catch (_) { return []; } })();
  const nomCompte = (uid) => labels[uid] || (comptesV.find((a) => String(a && a.vinted_user_id) === String(uid)) || {}).login || null;
  const numeroDeItem = (id) => (fiches[id] && fiches[id].numero) || null;
  if (etat === undefined) return <div className="vrm-sec-liste"><div className="vrm-sec-vide">…</div></div>;
  if (etat.erreur) return <div className="vrm-sec-liste" data-journal="pas-su"><div className="vrm-sec-ligne"><div className="vrm-sec-corps"><span className="vrm-sec-sous" style={{ whiteSpace: 'normal' }}>Je n'ai pas pu lire le journal — réessaie dans un instant.</span></div><button type="button" className="vrm-sec-bouton" onClick={() => { setEtat(undefined); lire(); }}>Réessayer</button></div></div>;
  const comptesJ = comptesDuJournal(etat.evenements);
  const vus = filtrerJournal(etat.evenements, { compte, type });
  const jours = [];
  for (const e of vus.slice(0, n)) {
    const j = e.at ? dateJourFr(new Date(e.at)) : 'En cours';
    if (!jours.length || jours[jours.length - 1].j !== j) jours.push({ j, l: [] });
    jours[jours.length - 1].l.push(e);
  }
  return (
    <div data-journal={String(vus.length)}>
      <HistoriqueModifications owner={AUTH.user?.id||''}/>
      <div className="vrm-sec-filtres vrm-compte-puces" role="radiogroup" aria-label="Type">
        {FILTRES_TYPE.map(([id, lib]) => <button key={id} type="button" role="radio" aria-checked={type === id} data-journal-type={id} className={'vrm-compte-puce' + (type === id ? ' is-actif' : '')} onClick={() => setType(id)}>{lib}</button>)}
      </div>
      {comptesJ.length >= 2 && <ListeComptes id="vrm-journal-compte" valeur={compte} onChange={setCompte} options={comptesJ.map((c) => ({ val: c, nom: nomCompte(c) || (c === 'principal' ? 'eBay principal' : c) }))}/>}
      {!vus.length && <div className="vrm-sec-liste"><div className="vrm-sec-vide" data-journal-vide="">Rien pour l’instant.</div></div>}
      {jours.map((g) => (
        <div key={g.j}>
          <div className="vrm-sec-jour">{g.j}</div>
          <div className="vrm-sec-liste">
            {g.l.map((e, i) => { const L = ligneJournal(e, { numeroDeItem, nomCompte }); return (
              <div key={i} className="vrm-sec-ligne" data-journal-ligne={e.type} data-journal-resultat={e.resultat}>
                <div className="vrm-sec-corps">
                  <span className="vrm-sec-titre">{L.titre}{L.article ? <> · {L.article}</> : null}</span>
                  <span className="vrm-sec-sous">{e.at ? new Date(e.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}{L.compte ? ` · ${L.compte}` : ''}{e.via === 'telephone' ? ' · depuis ton téléphone' : ''}</span>
                  {/* (8 nov., confiance) La PREUVE de la ligne : ce qui, dans sa base, note ce geste. */}
                  <span className="vrm-sec-sous vrm-sec-preuve" data-journal-preuve={L.preuve ? 'oui' : 'pas-su'}>{L.preuve || 'D’où vient cette ligne : pas su'}</span>
                </div>
                <span className={'vrm-sec-etat' + (L.aVerifier ? ' is-verifier' : '')}>{L.resultat}</span>
              </div>
            ); })}
          </div>
        </div>
      ))}
      {vus.length > n && <div style={{ marginTop: 12 }}><Bouton variante="secondaire" onClick={() => setN((x) => x + 100)} style={{ width: '100%' }}>Voir plus</Bouton></div>}
      <div className="vrm-sec-trous" data-journal-trous="">
        {(etat.pasLu || []).length ? <p data-journal-pas-lu={etat.pasLu.join(',')}>Pas pu lire : {etat.pasLu.map((x) => ({ favoris: 'favoris', ebayAgent: 'actions eBay', ebayRetraits: 'retraits eBay', brouillons: 'republications', bordereaux: 'bordereaux', relais: 'commandes du téléphone' }[x] || x)).join(', ')}.</p> : null}
        {(etat.nonJournalise || []).map((x) => <p key={x.id} data-journal-non={x.id}>{x.texte}</p>)}
      </div>
    </div>
  );
}
function FermerCompte() {
  const [ouvert, setOuvert] = React.useState(false);
  // `undefined` en cours · `null` pas su · l'objet du serveur (`proprietaire`).
  const [info, setInfo] = React.useState(undefined);
  const [tape, setTape] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const [fin, setFin] = React.useState(null);
  // (9 octobre) Ses RÈGLES D'OFFRE eBay restent posées chez eBay après la
  // fermeture : eBay continuera d'accepter. Compté sur tous ses comptes eBay ;
  // `undefined` en cours · `null` pas su · { oui, peutEtre } (`compterReglesEbay`).
  const [reglesEbayN, setReglesEbayN] = React.useState(undefined);
  React.useEffect(() => {
    if (!ouvert || info !== undefined) return;
    let mort = false;
    lireAbonnement().then((x) => { if (!mort) setInfo(x); });
    compterReglesEbay().then((n) => { if (!mort) setReglesEbayN(n); }).catch(() => { if (!mort) setReglesEbayN(null); });
    return () => { mort = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);
  const email = String((AUTH.user && AUTH.user.email) || '');
  const pareil = !!email && tape.trim().toLowerCase() === email.trim().toLowerCase();
  const valider = async () => {
    if (!pareil || occupe) return;
    setOccupe(true);
    const r = await fermerMonCompte(tape.trim());
    setOccupe(false);
    setFin(r);
    // Fermé : on efface aussi ce navigateur, puis retour à l'accueil public.
    if (r.ok) setTimeout(() => { try { authSignOut(); } catch (_) {} location.assign('/'); }, 4000);
  };
  const txt = { fontSize: 12, color: C.muted, lineHeight: 1.55 };
  return (
    <div data-fermer-compte="" style={{ padding: '13px 16px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, marginBottom: 8 }}>
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text }}>Fermer mon compte</span>
          <span style={{ display: 'block', fontSize: 12, color: C.muted, marginTop: 2 }}>Efface tes données et ton compte VRM, définitivement.</span>
        </span>
        <span style={{ color: C.muted, fontSize: 13 }}>{ouvert ? '▴' : '▾'}</span>
      </button>
      {ouvert && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          {fin ? (
            <div data-fermer-resultat={fin.ok ? 'ferme' : 'incomplet'} style={{ ...txt, color: C.text }}>
              {fin.message}
              {fin.ok && <div style={{ ...txt, marginTop: 6 }}>Pense à retirer l'extension VRM de ton navigateur. Retour à l'accueil dans un instant…</div>}
            </div>
          ) : info === undefined ? (
            <div style={txt}>Vérification de ton compte…</div>
          ) : info === null ? (
            <div data-fermer-etat="pas-su" style={txt}>Compte pas vérifié : rien n'est proposé. Rouvre cet écran dans un instant.</div>
          ) : info.proprietaire ? (
            <div data-fermer-etat="proprietaire" style={txt}>
              <b style={{ color: C.text }}>Tu es le propriétaire de cette installation VRM.</b> Fermer ce compte effacerait toute la boutique : désactivé ici, exprès.
            </div>
          ) : (
            <div data-fermer-etat="possible">
              <div style={txt}>
                Seront effacés : <b style={{ color: C.text }}>tes données VRM</b> (ventes, annonces captées, numéros, compta, réglages), <b style={{ color: C.text }}>tes comptes Vinted liés</b> et <b style={{ color: C.text }}>ton compte de connexion</b>.
                {(info.peutGerer && info.actif) ? ' Ton abonnement est résilié en même temps : aucun nouveau prélèvement ne part.' : ''}
                {' '}C'est <b style={{ color: C.text }}>définitif</b> : fais d'abord une « Sauvegarde complète » (Réglages), puis retire l'extension VRM de ton navigateur.
              </div>
              {reglesEbayN === null && <div data-fermer-regles-ebay="pas-su" style={{ ...txt, marginTop: 8, color: C.warn }}>{texteReglesQuiRestent(null, 'fermer')}</div>}
              {reglesEbayN && (reglesEbayN.oui > 0 || reglesEbayN.peutEtre > 0) && <div data-fermer-regles-ebay={reglesEbayN.oui + reglesEbayN.peutEtre} data-fermer-regles-ebay-peut-etre={reglesEbayN.peutEtre} style={{ ...txt, marginTop: 8, color: C.warn }}>Après la fermeture, sur eBay : {texteReglesQuiRestent(reglesEbayN, 'fermer')}</div>}
              <label style={{ display: 'block', ...txt, marginTop: 10 }}>
                Pour confirmer, recopie ton adresse : <b style={{ color: C.text }}>{email}</b>
                <input type="email" autoComplete="off" autoCapitalize="none" value={tape} onChange={(e) => setTape(e.target.value)} placeholder={email}
                  data-fermer-confirmation=""
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, border: `1px solid ${C.border}`, borderRadius: 12, padding: '11px 12px', fontSize: 15, background: C.bg, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
              </label>
              <button type="button" className="vrm-b vrm-b-primaire" onClick={valider} disabled={!pareil || occupe} data-fermer-bouton=""
                style={{ marginTop: 10 }}>
                {occupe ? 'Fermeture en cours…' : 'Fermer définitivement mon compte'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// Le contact de VRM (src/contact.js, une seule source avec la page d'accueil).
function LigneContact() {
  const e = contactEmail();
  return (
    <div data-contact="" style={{ marginTop: 9, fontSize: 13 }}>
      Contact : {e
        ? <a href={`mailto:${e}`} style={{ color: C.accentTexte, fontWeight: 500, textDecoration: 'none' }}>{e}</a>
        : <span data-contact-absent="" style={{ color: C.muted }}>{CONTACT_A_VENIR}</span>}
    </div>
  );
}
// ⟦← App.jsx #40⟧
// ── LA PAGE ABONNEMENT (8 nov., « abonnement propre ») ──────────────────────
// En tête, UNE carte : l'état (essai · abonné · résilié · paiement en échec ·
// abonnement terminé · pas d'abonnement), la phrase de ce qui se passe ensuite, et
// les gestes. Puis des rangées iOS : la carte bancaire et la page de gestion de
// Stripe (factures, carte, adresse — le PORTAIL CLIENT, `mode=portail`, ouvert
// sur SON client seul, côté serveur), et « Résilier » : deux clics (la rangée,
// puis la confirmation), comme l'exige la résiliation en ligne (art. L215-1-1).
// L'état vient de `etatAbonnement` (src/abonnement/etatAbonnement.js) — la même
// règle que la ligne de la coque. Les `data-abonnement` d'avant sont gardés
// (actif · sans · impaye · proprietaire · non-branche · pas-su · chargement),
// `data-abonnement-etat` dit l'état fin. Le parrainage vit À CÔTÉ (son groupe).
// L'en-tête de la page : l'état, le titre, la phrase de ce qui suit, les gestes.
function Tete({ etat, titre, phrase, children, jauge }) {
  return (
    <div className="vrm-abo-tete">
      <div className="vrm-abo-etat">{etat}</div>
      {titre ? <div className="vrm-abo-titre">{titre}</div> : null}
      {phrase ? <div className="vrm-abo-phrase">{phrase}</div> : null}
      {jauge != null ? <div className="vrm-abo-jauge" role="progressbar" aria-label="Jours d'essai écoulés" aria-valuemin={0} aria-valuemax={7} aria-valuenow={7 - jauge}><span style={{ width: `${Math.round(Math.min(7, Math.max(0, 7 - jauge)) / 7 * 100)}%` }}/></div> : null}
      {children}
    </div>
  );
}
function MonAbonnement() {
  const [cases, setCases] = React.useState({ cgv: false, acces: false });
  const cgv = casesCgvCochees(cases);
  const [e, setE] = React.useState(undefined);
  const [fx, setFx] = React.useState(undefined);
  const [occupe, setOccupe] = React.useState('');
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => {
    let mort = false;
    (async () => {
      let x = await lireAbonnement();
      // De retour de Stripe : le webhook peut avoir quelques secondes de retard.
      for (let i = 0; RETOUR_ABONNEMENT === 'merci' && x && !x.actif && i < 8 && !mort; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        x = await lireAbonnement();
      }
      if (mort) return;
      setE(x);
      // Les factures n'existent que pour quelqu'un qui a (eu) un client Stripe.
      if (x && x.configure && !x.proprietaire && x.peutGerer) { const f = await lireFactures(); if (!mort) setFx(f); }
    })();
    return () => { mort = true; };
  }, []);
  const agir = async (mode) => {
    if (mode === 'checkout' && !cgv) { setMsg("Coche les deux cases (conditions de vente et accès immédiat) avant de payer."); return; }
    setOccupe(mode); setMsg('');
    const m = await ouvrirStripe(mode, mode === 'checkout' ? { cgv: true, accesImmediat: true } : null);
    if (m) { setMsg(m); setOccupe(''); }
  };
  const enEssai = !!(e && e.statut === 'trialing');
  const resilierOuReprendre = async (reprendre) => {
    if (!reprendre) {
      const fin = e && e.finPeriode ? dateLisible(e.finPeriode) : 'la fin du mois payé';
      const oui = await askConfirm({ title: enEssai ? 'Résilier ton essai ?' : 'Résilier ton abonnement ?',
        desc: enEssai
          ? `Tu gardes VRM jusqu'au ${fin}, et rien ne sera prélevé : aucun autre prélèvement ne partira. Tes données restent intactes. Tu peux changer d'avis jusqu'à cette date.`
          : `Tu gardes VRM jusqu'au ${fin}, et aucun autre prélèvement ne partira. Tes données restent intactes. Tu peux changer d'avis jusqu'à cette date.`,
        ok: 'Résilier', cancel: 'Garder mon abonnement', danger: true });
      if (!oui) return;
    }
    setOccupe(reprendre ? 'reprendre' : 'resilier'); setMsg('');
    const r = await choisirResiliation(reprendre);
    setOccupe('');
    if (!r.ok) { setMsg(r.message); return; }
    setE((x) => (x ? { ...x, annuleFinPeriode: r.annuleFinPeriode, finPeriode: r.finPeriode || x.finPeriode } : x));
    toast(r.annuleFinPeriode ? `✓ Abonnement résilié — VRM reste ouvert jusqu'au ${dateLisible(r.finPeriode || e.finPeriode)}` : '✓ Abonnement repris — rien ne change pour toi');
  };
  const et = etatAbonnement(e);
  const pied = <div className="vrm-ios-groupe-pied" style={{ margin: '12px 16px 0' }}>Paiement sécurisé par Stripe — VRM ne voit jamais ta carte.</div>;
  if (e === undefined) return <div data-abonnement="chargement" data-abonnement-etat="chargement"><Tete etat="Ton abonnement" phrase="Je regarde…"/></div>;
  if (e === null) return <div data-abonnement="pas-su" data-abonnement-etat="pas-su"><Tete etat="Ton abonnement" phrase="Abonnement pas lu. Rouvre cet écran dans un instant — rien n'a changé."/></div>;
  // ⚠️ LE PRIX CHEZ STRIPE ≠ CELUI DES CGV (11 octobre) : dit au SEUL
  //    propriétaire, avec le texte du SERVEUR (`prixStripe.texte` : montant,
  //    devise, rythme), jamais reformaté ici.
  const prixAcorriger = e.proprietaire && e.prixConforme === false && e.prixStripe;
  const mentionsAremplir = e.proprietaire && e.mentionsCompletes === false && Array.isArray(e.mentionsManquantes) && e.mentionsManquantes.length ? e.mentionsManquantes : null;
  const texteStripe = prixAcorriger && typeof e.prixStripe.texte === 'string' && e.prixStripe.texte.trim() ? e.prixStripe.texte : 'un prix différent';
  const note = { fontSize: 13, color: C.text, marginTop: 10, lineHeight: 1.5 };
  if (e.proprietaire) return (
    <div data-abonnement="proprietaire" data-abonnement-etat="proprietaire">
      <Tete etat="Ton abonnement" titre="Compte propriétaire" phrase="Compte propriétaire de VRM : gratuit, aucun abonnement.">
        {mentionsAremplir && (
          <div data-mentions-manquantes={mentionsAremplir.length} style={note}>
            Le paiement reste <b>fermé</b> tant que les mentions légales sont incomplètes ({mentionsAremplir.join(', ')}). Elles se remplissent dans <b>public/legal/editeur.js</b>, et l'adresse de contact aussi dans src/contact.js.
          </div>
        )}
        {e.mentionsCompletes === null && (
          <div data-mentions-manquantes="pas-su" style={{ ...note, color: C.muted }}>
            Je n'ai pas pu relire les mentions légales (<b style={{ color: C.text }}>public/legal/editeur.js</b>{typeof e.mentionsErreur === 'string' && e.mentionsErreur.trim() ? <> : « {e.mentionsErreur.trim().slice(0, 160)} »</> : null}) : le paiement reste fermé tant qu'elles ne sont pas lisibles. Cause la plus courante : une apostrophe dans un texte écrit entre apostrophes (« 'Marie d'Exemple' ») — écris-le entre guillemets droits (« "Marie d'Exemple" »).
          </div>
        )}
        {prixAcorriger && (
          <div data-prix-stripe="different" style={note}>
            Le prix réglé chez Stripe (<b data-prix-stripe-texte="">{texteStripe}</b>) n'est pas celui des conditions de vente (<b>{PRIX_CGV_LISIBLE}</b>). Le paiement reste <b>fermé</b> : personne ne peut s'abonner tant que ce n'est pas corrigé. Dans Stripe → Produits, ajoute au produit VRM un prix de {PRIX_CGV_LISIBLE.replace(' / ', ' par ')} avec la clé de recherche « vrm_mensuel » (coche « transférer la clé »).
          </div>
        )}
      </Tete>
    </div>
  );
  // Stripe pas branché (`STRIPE_SECRET_KEY` absente) : dit calmement, aucun bouton.
  if (!e.configure && !et.lectureSeule) return <div data-abonnement="non-branche" data-abonnement-etat="non-branche"><Tete etat="Ton abonnement" titre="Paiement pas encore ouvert" phrase="Le paiement n'est pas encore ouvert : VRM reste gratuit pour l'instant. Rien ne t'est demandé."/></div>;
  const test = e.modeTest ? <div data-mode-test="" className="vrm-ios-groupe-pied" style={{ margin: '8px 16px 0' }}>Paiement en <b style={{ color: C.text }}>mode test</b> : aucune vraie carte n'est débitée (carte d'essai 4242 4242 4242 4242).</div> : null;
  const cb = fx && fx.carte;
  const texteCarte = cb ? `${cb.marque ? cb.marque.charAt(0).toUpperCase() + cb.marque.slice(1) : 'Carte'} •••• ${cb.fin}${cb.mois && cb.annee ? ` · expire ${String(cb.mois).padStart(2, '0')}/${String(cb.annee).slice(-2)}` : ''}` : (fx === undefined && e.peutGerer ? 'Je regarde…' : null);
  const listeFactures = e.peutGerer ? <FacturesAbonnement fx={fx}/> : null;
  const erreur = msg ? <div role="alert" style={{ fontSize: 13, color: C.warn, margin: '8px 16px 0' }}>{msg}</div> : null;
  // Julien, 8 nov. : sans abonnement, un extrait net, le reste flouté — rien supprimé.
  const apresFin = e.lecture === true ? 'Ensuite, sans abonnement : un aperçu de tes données, le reste masqué ; rien n’est supprimé.' : 'Tes données restent intactes : rien n’est supprimé.';
  // Les rangées « paiement » : la carte (portail) et la page de gestion Stripe.
  const groupePaiement = (
    <GroupeIos titre="Paiement">
      <RangeeIos titre="Changer de carte" detail={texteCarte ? <span data-carte="">{texteCarte}</span> : undefined} onClick={occupe ? undefined : () => agir('portail')} data-rangee-carte=""/>
      <RangeeIos titre={occupe === 'portail' ? 'Ouverture…' : 'Gérer chez Stripe'} detail="Factures, moyen de paiement, adresse de facturation" onClick={occupe ? undefined : () => agir('portail')} data-rangee-portail=""/>
    </GroupeIos>
  );
  if (et.etat === 'essai' || et.etat === 'essai-resilie' || et.etat === 'actif' || et.etat === 'resilie') {
    const annule = !!e.annuleFinPeriode;
    const fin = e.finPeriode ? dateLisible(e.finPeriode) : '';
    const prix = et.prixAbonnement;
    let tete;
    if (et.etat === 'essai') {
      const j = et.jours;
      tete = <Tete etat="Essai gratuit" jauge={Number.isInteger(j) ? j : null}
        titre={j == null ? 'Essai en cours' : j === 0 ? "Dernier jour d'essai" : j === 1 ? "Encore 1 jour d'essai" : `Encore ${j} jours d'essai`}
        phrase={<span data-essai-phrase="">{fin ? `Le ${fin}, ` : 'À la fin de l’essai, '}ton abonnement démarre{prix ? ` : ${prix} prélevés sur ta carte` : ' et ta carte est débitée'}, sauf si tu résilies avant. Rien n'est prélevé pendant l'essai.</span>}/>;
    } else if (et.etat === 'essai-resilie') {
      tete = <Tete etat="Essai gratuit · résilié" titre={fin ? `Fin le ${fin}` : 'Essai résilié'} phrase={`Résilié : VRM reste ouvert jusqu'au ${fin || 'la fin de l’essai'}, et rien ne sera prélevé. ${apresFin}`}/>;
    } else if (annule) {
      tete = <Tete etat="Abonnement résilié" titre={fin ? `Fin le ${fin}` : 'Résilié'} phrase={`Résilié : VRM reste ouvert jusqu'au ${fin || 'la fin du mois payé'}, aucun autre prélèvement. ${apresFin}`}/>;
    } else {
      tete = <Tete etat="Ton abonnement" titre={<span data-prix-abonnement={prix ? '' : undefined}>Abonné{prix ? ` · ${prix}` : ''}</span>}
        phrase={fin ? `Prochain prélèvement le ${fin}.` : 'Sans engagement, résiliable à tout moment.'}/>;
    }
    return (<>
      <div data-abonnement="actif" data-abonnement-etat={et.etat} data-resilie={annule ? '' : undefined} data-essai-jours={enEssai && Number.isInteger(et.jours) ? et.jours : undefined}>
        {tete}
        {annule && (
          <div className="vrm-abo-actions" style={{ padding: '0 0' }}>
            <button type="button" disabled={!!occupe} onClick={() => resilierOuReprendre(true)} className="vrm-b vrm-b-primaire vrm-b-plein" style={{ marginTop: 12 }}>{occupe === 'reprendre' ? 'Un instant…' : 'Reprendre mon abonnement'}</button>
          </div>
        )}
        {groupePaiement}
        {!annule && (
          <GroupeIos titre="Résiliation" pied={enEssai
            ? `Pendant l'essai : rien n'est prélevé, VRM reste ouvert jusqu'au ${fin || 'dernier jour'}. ${apresFin}`
            : `Effet à la fin de la période payée${fin ? `, le ${fin}` : ''} : aucun autre prélèvement. Tu peux changer d'avis jusque-là.`}>
            <RangeeIos titre={occupe === 'resilier' ? 'Un instant…' : 'Résilier'} onClick={occupe ? undefined : () => resilierOuReprendre(false)} data-rangee-resilier=""/>
          </GroupeIos>
        )}
        {erreur}
        {test}
        {pied}
      </div>
      {listeFactures}
    </>);
  }
  const portePaiementFerme = e.prixConforme === false || e.mentionsCompletes !== true || e.configure === false;
  if (et.etat === 'impaye') {
    return (<>
      <div data-abonnement="impaye" data-abonnement-etat="impaye">
        <Tete etat="Paiement en échec" titre="Le dernier prélèvement n'est pas passé"
          phrase="Le dernier prélèvement n'est pas passé. Mets à jour ta carte : Stripe réessaie pendant 14 jours, puis l'app passe en lecture seule (tes données restent intactes).">
          <div className="vrm-abo-actions"><button type="button" disabled={!!occupe} onClick={() => agir('portail')} className="vrm-b vrm-b-primaire vrm-b-plein">{occupe ? 'Ouverture…' : 'Mettre à jour ma carte'}</button></div>
        </Tete>
        {texteCarte && <GroupeIos titre="Paiement"><RangeeIos titre="Carte enregistrée" detail={<span data-carte="">{texteCarte}</span>}/></GroupeIos>}
        {erreur}
        {test}
      </div>
      {listeFactures}
    </>);
  }
  if (et.etat === 'expire') {
    // SANS ABONNEMENT (Julien, 8 nov.) : ailleurs, un aperçu net et le reste
    // flouté ; ici, de quoi reprendre. Paiement fermé ⇒ aucune case ni bouton.
    return (<>
      <div data-abonnement="expire" data-abonnement-etat="expire" data-lecture-seule={et.lectureSeule ? '' : undefined}>
        <Tete etat="Abonnement terminé" titre={et.impaye ? "Ton prélèvement n'est pas passé" : 'Ton abonnement a pris fin'}
          phrase={`Tes données sont là, rien n’est supprimé : ${e.lecture === true ? 'un aperçu reste visible, le reste est masqué' : 'elles reviennent telles quelles'}. Pour tout retrouver et agir à nouveau, ${et.impaye ? 'mets ta carte à jour' : `reprends l’abonnement${portePaiementFerme ? '' : ` : ${prixLisible(e.prix)}, sans engagement`}`}.`}>
          {et.impaye
            ? <div className="vrm-abo-actions"><button type="button" disabled={!!occupe} onClick={() => agir('portail')} className="vrm-b vrm-b-primaire vrm-b-plein">{occupe ? 'Ouverture…' : 'Mettre à jour ma carte'}</button></div>
            : portePaiementFerme
              ? <div className="vrm-abo-phrase" data-paiement-ferme="">Le paiement n'est pas encore ouvert : rien n'a été prélevé. Réessaie un peu plus tard.</div>
              : <>
                  <CaseCgv cases={cases} onChange={setCases}/>
                  <div className="vrm-abo-actions"><button type="button" disabled={!!occupe || !cgv} data-sabonner="" onClick={() => agir('checkout')} className="vrm-b vrm-b-primaire vrm-b-plein" title={cgv ? undefined : 'Coche d’abord les conditions de vente'}>{occupe ? 'Ouverture…' : (et.ancien ? "Reprendre l'abonnement" : "S'abonner")}</button></div>
                </>}
        </Tete>
        {erreur}
        {test}
        {pied}
      </div>
      {listeFactures}
    </>);
  }
  // Le prix de Stripe n'est pas celui des CGV, ou les mentions manquent : le
  // serveur n'ouvrira pas le paiement — aucun bouton qui mènerait à un refus.
  // Un ANCIEN abonné garde ses factures (sa compta).
  if (e.prixConforme === false || e.mentionsCompletes !== true) return (<>
    <div data-abonnement="non-branche" data-abonnement-etat="non-branche" data-raison={e.prixConforme === false ? 'prix' : 'mentions'}><Tete etat="Ton abonnement" titre="Paiement pas encore ouvert" phrase="Le paiement n'est pas encore ouvert : VRM reste gratuit pour l'instant."/></div>
    {listeFactures}
  </>);
  return (<>
    <div data-abonnement="sans" data-abonnement-etat="sans">
      <Tete etat="Pas encore d'abonnement" titre={e.essaiDispo ? `${e.essaiJours || 7} jours gratuits` : prixLisible(e.prix)}
        phrase={<span data-essai-dispo={e.essaiDispo ? '' : undefined}>
          {e.essaiDispo
            ? <>Puis {prixLisible(e.prix)}, sans engagement : aucun prélèvement pendant l'essai, résiliable à tout moment. À la fin de l'essai, sans abonnement, tes données restent là.</>
            : <>{prixLisible(e.prix)}, sans engagement : prélevé chaque mois à la date où tu t'abonnes, résiliable à tout moment.</>}
          {!e.obligatoire && <> Pour l'instant VRM reste gratuit pour toi.</>}
        </span>}>
        {RETOUR_ABONNEMENT === 'merci' && <div className="vrm-abo-phrase">Paiement reçu par Stripe — ton abonnement apparaîtra ici dans quelques secondes. Rouvre l'écran si besoin.</div>}
        <CaseCgv cases={cases} onChange={setCases}/>
        <div className="vrm-abo-actions">
          <button type="button" disabled={!!occupe || !cgv} data-sabonner="" data-essai={e.essaiDispo ? '' : undefined} onClick={() => agir('checkout')} className="vrm-b vrm-b-primaire vrm-b-plein" title={cgv ? undefined : 'Coche d’abord les conditions de vente'}>{occupe ? 'Ouverture…' : e.essaiDispo ? `Commencer l'essai gratuit de ${e.essaiJours || 7} jours` : "S'abonner"}</button>
        </div>
        {e.essaiDispo && <div className="vrm-aide" style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>Essai gratuit <b>une seule fois</b> — par adresse e-mail et par compte Vinted. Ta carte n'est débitée qu'après {e.essaiJours || 7} jours ; tu peux résilier avant sans rien payer.</div>}
      </Tete>
      {erreur}
      {test}
      {pied}
    </div>
    {listeFactures}
  </>);
}

// La liste des factures, en rangées iOS. Une rangée par facture : date ·
// statut · montant · le PDF. « Pas su » n'est JAMAIS « aucune facture ».
function FacturesAbonnement({ fx }) {
  const vide = (etat, texte) => <GroupeIos titre="Tes factures" data-factures={etat}><RangeeIos titre={texte}/></GroupeIos>;
  if (fx === undefined) return vide('chargement', 'Je regarde…');
  if (fx === null) return vide('pas-su', 'Factures pas lues chez Stripe. Rouvre cet écran dans un instant — elles sont gardées.');
  if (!fx.factures.length) return vide('vide', "Aucune facture pour l'instant : la première arrive avec ton premier prélèvement.");
  return (
    <GroupeIos titre="Tes factures" data-factures={String(fx.factures.length)}>
      {fx.factures.map((f, i) => {
        const lien = lienFacture(f.pdf) || lienFacture(f.page);
        const st = STATUT_FACTURE[f.statut] || f.statut;
        return (
          <RangeeIos key={f.id || i} data-facture="" titre={f.date ? dateLisible(f.date) : '—'}
            detail={<span style={{ color: f.statut === 'open' || f.statut === 'uncollectible' ? C.warn : undefined }}>{st}{f.numero ? ` · n° ${f.numero}` : ''}</span>}
            valeur={<span style={{ fontVariantNumeric: 'tabular-nums', color: C.text, fontWeight: 600 }}>{montantLisible(f.montant, f.devise)}</span>}
            apres={lien
              ? <a href={lien} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, fontWeight: 600, color: C.accentTexte, textDecoration: 'none', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingRight: 12 }}>{lienFacture(f.pdf) ? 'PDF' : 'Voir'}</a>
              : <span style={{ minWidth: 44 }}/>}/>
        );
      })}
    </GroupeIos>
  );
}

// ── PARRAINAGE (8 nov.) ──────────────────────────────────────────────────────
// Un lien personnel ; un mois offert à chacun quand l'ami paie son premier
// mois (règle et anti-abus : api/_lib/parrainage.js, CGV article 2 bis). Le
// serveur rend des NOMBRES (« 2 amis inscrits, 1 a payé »), jamais qui.
// Trois états : `undefined` en cours · `null` pas su · l'objet lu. Pas installé
// (027 pas passée) ou parrainage fermé : on le dit, sans lien à partager.
async function lireParrainage() {
  try {
    const r = await fetch('/api/compte?mode=parrainage', { headers: enTeteSession(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? j : null;
  } catch (_) { return null; }
}
function Parrainage() {
  const [p, setP] = React.useState(undefined);
  const proprio = useEstProprietaire();
  React.useEffect(() => { let mort = false; lireParrainage().then((x) => { if (!mort) setP(x); }); return () => { mort = true; }; }, []);
  if (p === undefined) return null;
  if (p === null) return <GroupeIos titre="Parrainage" data-parrainage="pas-su"><RangeeIos titre="Parrainage pas lu" detail="Rouvre cet écran dans un instant."/></GroupeIos>;
  if (!p.installe || !p.ouvert) {
    // Fermé : rien n'est promis au vendeur ; le propriétaire lit le geste.
    if (!proprio) return null;
    return <GroupeIos titre="Parrainage" data-parrainage="ferme" pied={!p.installe ? 'À activer : passer la migration 027, puis vrm_reglages.parrainage = 1.' : 'Éteint : vrm_reglages.parrainage = 1 l’ouvre (un mois offert au parrain et au filleul).'}><RangeeIos titre="Parrainage pas encore ouvert"/></GroupeIos>;
  }
  const lien = lienParrainage(p.code);
  const s = p.suivi || { inscrits: 0, payes: 0, moisOfferts: 0, enAttente: 0 };
  const amis = (n) => `${n} ami${n > 1 ? 's' : ''}`;
  const copier = async () => {
    try { if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'VRM', text: 'Essaie VRM : un mois offert à ton premier paiement.', url: lien }); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(lien); toast('✓ Lien copié'); } catch (_) { toast('Copie impossible ici — sélectionne le lien'); }
  };
  return (
    <GroupeIos titre="Parrainage" data-parrainage="ouvert" data-inscrits={s.inscrits} data-payes={s.payes}
      pied={`Un mois offert à ton ami et à toi quand il paie son premier mois : un crédit d'un mois déduit de la prochaine facture. Une fois par ami, pas pour toi-même ; au plus 12 mois offerts par an.${p.filleul && p.filleul.parraine ? (p.filleul.moisOffert ? ' Ton mois offert de filleul est crédité.' : ' Tu as été parrainé : ton mois offert arrive avec ton premier paiement.') : ''}`}>
      <div className="vrm-ios-rangee" style={{ padding: '10px 16px', display: 'block' }}>
        <div className="vrm-abo-lien"><code data-lien-parrainage="">{lien}</code></div>
        <div className="vrm-abo-actions" style={{ marginTop: 10 }}><button type="button" className="vrm-b vrm-b-secondaire" onClick={copier} data-copier-parrainage="">Partager mon lien</button></div>
      </div>
      <RangeeIos titre="Amis inscrits" valeur={<span data-chiffre-inscrits="">{s.inscrits}</span>}/>
      <RangeeIos titre="Ont payé leur premier mois" valeur={<span data-chiffre-payes="">{s.payes}</span>}/>
      <RangeeIos titre="Mois offerts pour toi" detail={s.enAttente ? `${amis(s.enAttente)} : en attente de ton premier abonnement` : undefined} valeur={<span data-chiffre-mois="">{s.moisOfferts}</span>}/>
    </GroupeIos>
  );
}
// ⟦← App.jsx #41⟧

// ── RÉGLAGES → MON COMPTE → ÉQUIPE ─────────────────────────────────────────
// ── DISCORD RELIÉ AU COMPTE (20 oct.) ────────────────────────────────────────
// Julien : « connecter mon compte Discord à mon compte qui est déjà connecté ».
// Sans être sur la carte : le pseudo VÉRIFIÉ (OAuth, preuve signée) est rangé
// par la route dans `app_data.vrm_discord` (api/_lib/communaute.js). Le retour
// de Discord revient ICI (`?tab=settings&vue=compte`, `ou=compte`).
// Trois états : `undefined` lecture · `null` pas su · `{discord, connexion}`.
function DiscordCompte() {
  const [lu, setLu] = React.useState(undefined);
  const [occupe, setOccupe] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const appel = React.useCallback(async (corps) => {
    try {
      const r = await fetch('/api/compte?mode=communaute', { method: 'POST', headers: { ...enTeteSession(), 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => null);
      return j && typeof j === 'object' ? j : { ok: false };
    } catch (_) { return { ok: false }; }
  }, []);
  const relire = React.useCallback(async () => {
    const j = await appel({ action: 'discord-compte' });
    setLu(j.ok ? { discord: typeof j.discord === 'string' ? j.discord : '', connexion: j.discordConnexion === true } : null);
  }, [appel]);
  React.useEffect(() => {
    (async () => {
      // Le retour de Discord, mis de côté par main.jsx (seulement s'il vient d'ICI).
      let brut = '';
      try { brut = sessionStorage.getItem('vrm_discord_retour') || ''; } catch (_) {}
      const h = new URLSearchParams(brut);
      if (brut && h.get('ou') === 'compte') {
        try { sessionStorage.removeItem('vrm_discord_retour'); } catch (_) {}
        const err = h.get('discord-erreur'), d = h.get('discord'), preuve = h.get('preuve');
        if (err) setMsg(DISCORD_ERREURS[err] || DISCORD_ERREURS.discord);
        else if (d) {
          setOccupe(true);
          const r = await appel({ action: 'discord-compte-verifie', discord: d, preuve });
          setOccupe(false);
          setMsg(r.ok ? `Ton compte Discord « ${r.discord} » est relié à ton compte VRM.` : (r.message || DISCORD_ERREURS.discord));
        }
      }
      relire();
    })();
  }, [appel, relire]);
  const connecter = async () => {
    setOccupe(true); setMsg('');
    try {
      const r = await fetch('/api/compte?mode=discord-debut', { method: 'POST', headers: { ...enTeteSession(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ou: 'compte' }) });
      const j = await r.json().catch(() => null);
      if (j && j.ok && typeof j.url === 'string' && j.url.startsWith('https://discord.com/')) { noterTicketDiscord(j.ticket, 'compte'); window.location.href = j.url; return; }
      setMsg((j && j.message) || DISCORD_ERREURS.discord);
    } catch (_) { setMsg(DISCORD_ERREURS.discord); }
    setOccupe(false);
  };
  const retirer = async () => {
    if (!(await askConfirm({ title: 'Retirer ton Discord ?', desc: 'Il n’est plus relié à ton compte VRM (ni affiché sur la carte, s’il y était).', ok: 'Retirer', cancel: 'Annuler', danger: true }))) return;
    setOccupe(true); setMsg('');
    const r = await appel({ action: 'discord-compte-retirer' });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || "Je n'ai pas pu joindre la base — rien n'a changé. Réessaie dans un instant."); return; }
    setMsg('Ton Discord est retiré de ton compte.');
    relire();
  };
  const note = msg && <div data-discord-compte-msg="" role="status" style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.45,flexBasis:'100%' }}>{msg}</div>;
  if (lu === undefined) return <div data-discord-compte="chargement" style={{ fontSize: 13, color: C.muted, padding: '14px 16px', minHeight: 56, boxSizing: 'border-box' }}>Lecture de ton Discord…{note}</div>;
  // (5 nov., chantier H) La panne se dit comme partout (`EtatPanne`), et la carte
  // devient une LIGNE de la liste « Comptes associés » (plus de carte dans la carte).
  if (lu === null) return (
    <div data-discord-compte="pas-su" style={{ padding: '4px 4px' }}>
      <EtatPanne compact quoi="Ton Discord" raison="La base n’a pas répondu." onReessayer={relire}/>{note}
    </div>
  );
  return (
    <div data-discord-compte={lu.discord ? 'relie' : 'aucun'} style={{ fontSize: 13, color: C.text, padding:'10px 14px 10px 16px',minHeight:56,boxSizing:'border-box',borderTop:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap' }}>
      <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}><span aria-hidden="true" style={{width:32,height:32,display:'grid',placeItems:'center',borderRadius:12,background:'#5865F218'}}><BrandMark id="discord"/></span><span>{lu.discord ? <>Discord relié : <b data-discord-compte-pseudo={lu.discord}>{lu.discord}</b></> : <><b>Profil Discord</b><span style={{display:'block',fontSize:11,color:C.muted,marginTop:2}}>Ton pseudo et ton avatar Discord dans VRM</span></>}</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {lu.connexion && <button type="button" data-discord-compte-connecter="" disabled={occupe} onClick={connecter} className="vrm-b vrm-b-secondaire">{occupe ? 'Un instant…' : lu.discord ? 'Changer de compte' : 'Connecter Discord'}</button>}
        {lu.discord && <button type="button" data-discord-compte-retirer="" disabled={occupe} onClick={retirer} className="vrm-b vrm-b-discret">Retirer</button>}
      </div>
      {!lu.connexion && !lu.discord && <span data-discord-compte-indispo="" title={DISCORD_ERREURS['non-configure']} style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Bientôt</span>}
      {note}
    </div>
  );
}

function EquipeSetting() {
  const uid = (AUTH.user && AUTH.user.id) || '';
  const proprio = useEstProprietaire();
  const [lu, setLu] = React.useState(undefined);
  const [email, setEmail] = React.useState('');
  const [occupe, setOccupe] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const relire = React.useCallback(() => { lireEquipe().then(setLu); }, []);
  React.useEffect(() => { relire(); }, [relire]);
  const agir = async (cle, action, extra, ok) => {
    setOccupe(cle); setMsg('');
    const r = await actionEquipe(action, extra);
    setOccupe('');
    if (!r.ok) { setMsg(r.message); return; }
    if (ok) ok(r);
    relire();
    try { window.dispatchEvent(new Event('vrm-equipe')); } catch (_) {}
  };
  const ligne = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 0', borderTop: `1px solid ${C.border}` };
  if (lu === undefined) return <div data-equipe-reglage="chargement" style={{ fontSize: 13, color: C.muted }}>Lecture de ton équipe…</div>;
  if (lu === null) return (
    <div data-equipe-reglage="pas-su" style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
      Je n'ai pas pu lire ton équipe — la base n'a pas répondu. <button type="button" onClick={relire} className="vrm-b vrm-b-secondaire" style={{ marginLeft: 6 }}>Réessayer</button>
    </div>
  );
  // (8 nov.) Tant que la 016 n'est pas appliquée : la phrase (la même que l'écran de
  // l'équipe), CE QUE l'aide verra une fois le mode activé, et qui fait le geste —
  // jamais un bouton « Inviter » qui ne mènerait nulle part (CLAUDE.md §5, 016).
  if (lu.nonInstalle) return (
    <div data-equipe-reglage="non-installe" style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
      <div>{EQUIPE_NON_INSTALLE_TXT}</div>
      <div data-equipe-attente-geste={proprio ? 'proprietaire' : 'vendeur'} style={{ color: C.muted, marginTop: 6 }}>
        {proprio
          ? <>Il s’active quand la mise à jour <b style={{ color: C.text }}>016</b> de la base est appliquée (Supabase) : rien d’autre à préparer, l’invitation marchera aussitôt.</>
          : <>Rien à faire de ton côté : dès qu’il est activé, tu inviteras ici la personne qui t’aide, par son e-mail.</>}
      </div>
      <div data-equipe-ce-qui-viendra="" style={{ color: C.muted, marginTop: 8 }}>{CE_QUE_VOIT_UN_MEMBRE}</div>
    </div>
  );
  const vivants = lu.equipe.filter((x) => x.statut !== 'revoquee');
  const inviter = async () => {
    const e = email.trim();
    if (!e) { setMsg("Tape l'adresse e-mail de la personne qui t'aide."); return; }
    await agir('inviter', 'inviter', { email: e }, (r) => { setEmail(''); setMsg(r.deja ? 'Cette personne est déjà invitée.' : ''); });
  };
  return (
    <div data-equipe-reglage="lu" style={{ fontSize: 13, color: C.text }}>
      <div style={{ color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>{CE_QUE_VOIT_UN_MEMBRE}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail de la personne" aria-label="E-mail à inviter" data-equipe-email=""
          style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 10px', fontSize: 15, background: C.bg, color: C.text, outline: 'none', fontFamily: 'inherit' }}/>
        <button type="button" data-equipe-inviter="" disabled={!!occupe} onClick={inviter} className="vrm-b vrm-b-primaire">{occupe === 'inviter' ? 'Invitation…' : 'Inviter'}</button>
      </div>
      <div style={{ color: C.muted, fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>Aucun e-mail n'est envoyé : préviens-la. Elle crée son compte VRM avec cette adresse.</div>
      {msg && <div data-equipe-msg="" style={{ color: C.warn, marginTop: 8 }}>{msg}</div>}
      {vivants.length > 0 && <div style={{ marginTop: 12 }}>
        {vivants.map((x) => (
          <div key={x.id} data-equipe-membre={x.statut} style={ligne}>
            <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}><b>{x.email}</b> <span style={{ color: C.muted }}>· {x.statut === 'actif' ? 'membre' : 'invitée, pas encore acceptée'}</span></span>
            <button type="button" data-equipe-revoquer={x.id} disabled={!!occupe} onClick={async () => { if (await askConfirm({ title: 'Retirer cette personne ?', desc: `${x.email} ne verra plus tes colis, tout de suite.`, ok: 'Retirer', cancel: 'Annuler', danger: true })) agir(x.id, 'revoquer', { id: x.id }); }} className="vrm-b vrm-b-discret">Retirer</button>
          </div>
        ))}
      </div>}
      {(lu.invitations.length > 0 || lu.membreDe.length > 0) && <div style={{ marginTop: 14 }}>
        {lu.invitations.map((inv) => (
          <div key={inv.id} data-invitation={inv.id} style={ligne}>
            <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}><b>{inv.de || 'Un vendeur'}</b> t'invite à préparer ses colis</span>
            <button type="button" data-accepter={inv.id} disabled={!!occupe} onClick={() => agir(inv.id, 'accepter', { id: inv.id })} className="vrm-b vrm-b-primaire">Accepter</button>
          </div>
        ))}
        {lu.membreDe.map((m) => (
          <div key={m.id} data-membre-de={m.vendeur} style={ligne}>
            <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}>Tu prépares les colis de <b>{m.de || 'un vendeur'}</b>{m.acces === false ? <span style={{ color: C.muted }}> · son abonnement n'est plus actif</span> : null}</span>
            <button type="button" data-ouvrir-equipe={m.vendeur} onClick={() => { if (uid) choisirVueEquipe(uid, m.vendeur); }} className="vrm-b vrm-b-primaire">Ouvrir ses colis</button>
            <button type="button" data-quitter={m.id} disabled={!!occupe} onClick={async () => { if (await askConfirm({ title: "Quitter l'équipe ?", desc: `Tu ne verras plus les colis de ${m.de || 'ce vendeur'}.`, ok: 'Quitter', cancel: 'Annuler', danger: true })) agir(m.id, 'quitter', { id: m.id }); }} className="vrm-b vrm-b-discret">Quitter</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

function PrenomSetting() {
  const [v, setV] = React.useState(() => String(load('vrm_prenom', '') || ''));
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => {
    // §5.49 : le nuage arrive après le montage. On ne remplace que le vide,
    // sinon une saisie faite pendant le chargement serait écrasée.
    if (touche.current) return;
    setV((p) => p || String(load('vrm_prenom', '') || ''));
  }), []);
  const ecrire = (t) => { touche.current = true; const n = t.slice(0, 24); setV(n); save('vrm_prenom', n.trim()); };
  // Une ligne de réglage (libellé à gauche, champ à droite) ; l'explication
  // vit sous le groupe, dans les Paramètres (§7 : une phrase, une fois).
  return (
    <label className="vrm-set-ligne" data-reglage-prenom="">
      <IconeReglage name="pencil"/>
      <span className="vrm-set-lib"><b style={{color:C.text}}>Prénom</b></span>
      <input className="vrm-set-champ" value={v} onChange={(e)=>ecrire(e.target.value)} placeholder="Facultatif" autoComplete="given-name" aria-label="Ton prénom"
        style={{color:C.text}}/>
    </label>
  );
}

// ── « JE NUMÉROTE MOI-MÊME DANS MES ANNONCES » (7 nov.) ──────────────────────
// Julien, 7 novembre : « la personne met son numéro d'étiquetage à la fin de sa
// description […] capter ce numéro-là […] et n'attribuer donc pas de numéro
// automatiquement ». Le réglage (synchronisé, éteint par défaut), le pas-à-pas, et
// l'APERÇU : ce que VRM lit dans ses annonces actuelles, compté et nommé — Vinted
// (publié par l'écran Annonces, qui a les annonces), Leboncoin, Vestiaire et eBay
// (lus ici, projetés). La règle : src/numeroEcrit.js. Rien ne change un numéro ici.
function resumeApercu(a) {
  if (!a) return null;
  const c = a.comptes || {};
  return { lus: (c['a-poser'] || 0) + (c.accord || 0), rien: (c.rien || 0) + (c['sans-ecrit'] || 0), ambigus: c.ambigu || 0, contredits: c.contredit || 0, autres: (c.archive || 0) + (c.avant || 0), garde: c.garde || 0, total: a.total || 0 };
}
// (8 nov.) AFFICHAGE SIMPLE / COMPLET et « JE VENDS » (src/profilVendeur.js) : deux
// réglages synchronisés. « Automatique » est un choix à part entière : il suit la
// règle (Simple pour un seul compte Vinted et moins de 30 ventes sur 30 jours,
// jamais pour le propriétaire de l'installation) et le dit en une phrase.
function phraseAffichageAuto(p) {
  const c = (p && p.contexte) || {};
  if (c.proprietaire === true) return 'Automatique : Complet (ta boutique).';
  if (p.mode === 'simple') return `Automatique : Simple — un compte Vinted, ${c.nVentes30j} vente${c.nVentes30j > 1 ? 's' : ''} sur ${JOURS_VENTES_SIMPLE} jours.`;
  if (c.nComptesVinted == null || c.nVentes30j == null || c.proprietaire == null) return 'Automatique : Complet tant que VRM n’a pas tout lu.';
  return c.nComptesVinted > 1 ? `Automatique : Complet — ${c.nComptesVinted} comptes Vinted.` : `Automatique : Complet — ${SEUIL_VENTES_SIMPLE} ventes ou plus sur ${JOURS_VENTES_SIMPLE} jours.`;
}
function AffichageSetting() {
  const p = useProfilVendeur();
  const [r, setR] = React.useState(() => lireReglageAffichage(load(CLE_AFFICHAGE, null)));
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => { if (!touche.current) setR(lireReglageAffichage(load(CLE_AFFICHAGE, null))); }), []);
  const choisir = (choix) => {
    touche.current = true;
    const n = { choix, at: new Date().toISOString() };
    setR(n); save(CLE_AFFICHAGE, n);
    toast(choix === 'simple' ? 'Affichage simple : ce qui ne sert pas encore se range. Rien n’est supprimé.' : choix === 'complet' ? 'Affichage complet : tous les écrans sont là.' : 'Affichage automatique.');
  };
  return (
    <div data-reglage-affichage-mode={p.mode} data-reglage-affichage-choix={r.choix}>
      <Segmente label="Affichage" plein value={r.choix} onChange={choisir}
        options={[['auto', 'Automatique'], ['simple', 'Simple'], ['complet', 'Complet']].map(([v, l]) => ({ v, l, data: { 'data-affichage-choix': v } }))}/>
      <div className="vrm-setting-applique" role="status" style={{ color: C.text }}>{r.choix === 'auto' ? phraseAffichageAuto(p) : r.choix === 'simple' ? 'Simple, choisi par toi.' : 'Complet, choisi par toi.'}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        En simple, le menu ne montre pas ce qui ne sert pas encore : Stock (sans meuble), Republier (jamais lancé), les sites jamais reliés. Ma journée garde tous les gestes dus. <Pourquoi label="Rien n’est perdu ?">Aucun écran n’est supprimé et aucun chiffre ne change : chaque total compte toujours tout. Dès que tu ranges un meuble, relies Leboncoin ou republies, l’entrée revient d’elle-même. « Complet » remet tout, tout de suite.</Pourquoi>
      </div>
    </div>
  );
}
function JeVendsSetting() {
  const p = useProfilVendeur();
  const [r, setR] = React.useState(() => lireReglageJeVends(load(CLE_JE_VENDS, null)));
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => { if (!touche.current) setR(lireReglageJeVends(load(CLE_JE_VENDS, null))); }), []);
  const choisir = (choix) => {
    touche.current = true;
    const n = { choix, at: new Date().toISOString() };
    setR(n); save(CLE_JE_VENDS, n);
  };
  const vend = p.vend || 'autre';
  return (
    <div data-reglage-je-vends={vend} data-reglage-je-vends-choix={r.choix}>
      <Segmente label="Je vends" plein value={r.choix} onChange={choisir}
        options={[['auto', 'Automatique'], ['sneakers', 'Sneakers'], ['autre', 'Autre']].map(([v, l]) => ({ v, l, data: { 'data-je-vends-choix': v } }))}/>
      <div className="vrm-setting-applique" role="status" style={{ color: C.text }}>{vend === 'sneakers' ? 'Sneakers : VRM parle de « paires » et vérifie taille et marque avant de publier.' : 'Autre : VRM parle d’« articles » ; taille et marque sont facultatives.'}</div>
    </div>
  );
}

function NumeroEcritSetting({ onAnnonces }) {
  const lire = () => lireReglageNumeroEcrit(load(CLE_NUMERO_ECRIT, null));
  const [r, setR] = React.useState(lire);
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => { if (!touche.current) setR(lire()); }), []);
  const basculer = () => {
    touche.current = true;
    const n = { actif: !r.actif, depuis: new Date().toISOString() };
    setR(n); save(CLE_NUMERO_ECRIT, n);
    try { window.dispatchEvent(new Event('vrm-numero-ecrit')); } catch (_) {}
    toast(n.actif ? 'C’est noté : VRM ne donne plus de numéro tout seul, il lit le tien.' : 'VRM redonne un numéro aux annonces qui n’en ont pas.');
  };
  // Vinted : l'aperçu publié par l'écran Annonces (mis à jour en direct).
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => ecouterApercuEcrit(maj), []);
  const vinted = apercuEcritPublie('vinted');
  // Leboncoin, Vestiaire, eBay : lus une fois à l'ouverture (projetés, §4.4).
  // `undefined` en cours · `null` pas su · aperçu.
  const [autres, setAutres] = React.useState(undefined);
  React.useEffect(() => { let stop = false; (async () => {
    const out = {};
    const rep = (k) => !!numeroReprenable(k);
    try {
      const [l, jv, ja] = await Promise.all([
        lbcListingsSession(),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_ventes&select=v:data->ventes`),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_accounts&select=a:data->accounts`),
      ]);
      if (l && Array.isArray(jv) && Array.isArray(ja)) {
        const items = l.items || {}, ventes = (jv[0] && jv[0].v) || {};
        const prouves = new Set([...comptesLbcProuves(ventes, items), ...comptesLbcSession((ja[0] && ja[0].a) || {})]);
        const vendues = annoncesLbcVendues(ventes); const liens = load('vrm_lbc_liens', {}) || {};
        const ads = Object.values(items).filter((ad) => ad && ad.id != null && annonceLbcALui(ad, prouves) && annonceLbcEnVente(ad, vendues));
        out.leboncoin = apercuNumeroEcrit(ads.map((ad) => { const li = liens[String(ad.id)]; return { id: String(ad.id), site: 'leboncoin', titre: ad.subject || '', lecture: lectureEcriteLbc(ad), connu: li != null && String(li).trim() ? cleNum(li) : '', presente: true }; }), { reprenable: rep });
      } else out.leboncoin = null;
    } catch (_) { out.leboncoin = null; }
    try {
      const jl = await lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens`);
      if (Array.isArray(jl)) {
        const L = jl[0] || {}; const items = L.items && typeof L.items === 'object' ? L.items : {};
        const donnes = numerosVcEffectifs() || {}; const liensMain = vcCarte('vrm_vc_liens') || {};
        const connuVc = (id) => { const m = liensMain[id]; const v = (m && typeof m === 'object' ? m.numero : m) || (L.liens || {})[id] || donnes[id] || ''; return cleNum(v); };
        out.vestiaire = apercuNumeroEcrit(Object.entries(items).filter(([, it]) => it && typeof it === 'object').map(([id, it]) => ({ id: String(id), site: 'vestiaire', titre: it.titre || '', lecture: lireNumeroEcrit({ titre: it.titre || '' }), connu: connuVc(id), presente: true })), { reprenable: rep });
      } else out.vestiaire = null;
    } catch (_) { out.vestiaire = null; }
    try {
      const e = await lireEbayTous('ebay_listings', SEL_EBAY_ANNONCES, 'items');
      if (e && !e.illisibles.length) {
        const fiches = load('vinted_annonce_numeros', {}) || {};
        out.ebay = apercuNumeroEcrit(e.items.filter((a) => a && a.itemId != null).map((a) => { const lien = lienEbay(a.itemId); const f = lien ? fiches[lien.pairId] : null; return { id: String(a.itemId), site: 'ebay', titre: a.title || '', lecture: lireNumeroEcrit({ ref: a.sku, titre: a.title || '' }), connu: f && f.numero != null ? cleNum(f.numero) : '', presente: true }; }), { reprenable: rep });
      } else out.ebay = null;
    } catch (_) { out.ebay = null; }
    if (!stop) setAutres(out);
  })(); return () => { stop = true; }; }, []);
  const sites = [
    ['vinted', 'Vinted', vinted, 'la fin de la description, puis le titre'],
    ['leboncoin', 'Leboncoin', autres === undefined ? undefined : autres.leboncoin, 'la référence pro, la fin de la description, le titre'],
    ['vestiaire', 'Vestiaire Collective', autres === undefined ? undefined : autres.vestiaire, 'le titre'],
    ['ebay', 'eBay', autres === undefined ? undefined : autres.ebay, 'le SKU, puis le titre'],
  ];
  const nomsDe = (a, etat) => (a ? a.lignes.filter((l) => l.etat === etat).map((l) => l.titre || 'Annonce') : []);
  const liste = (noms) => noms.slice(0, 3).join(' · ') + (noms.length > 3 ? '…' : '');
  const ligneSite = ([cle, nom, a, ou]) => {
    const z = resumeApercu(a);
    const amb = nomsDe(a, 'ambigu'), con = nomsDe(a, 'contredit');
    return (
      <div key={cle} data-numero-ecrit-site={cle} data-numero-ecrit-lus={z ? z.lus : undefined} data-numero-ecrit-rien={z ? z.rien : undefined} data-numero-ecrit-ambigus={z ? z.ambigus : undefined} data-numero-ecrit-contredits={z ? z.contredits : undefined}
        style={{padding:'10px 0',borderTop:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
          <b style={{fontSize:13,color:C.text}}>{nom}</b>
          <span style={{fontSize:12,color:C.muted}}>VRM lit {ou}</span>
        </div>
        {a === undefined && <div role="status" style={{fontSize:13,color:C.muted,marginTop:4}}>Lecture…</div>}
        {a === null && (cle === 'vinted'
          ? <div data-numero-ecrit-passu="vinted" style={{fontSize:13,color:C.muted,marginTop:4,lineHeight:1.5}}>Pas encore lu : ouvre tes annonces une fois, VRM les lira. {onAnnonces && <button type="button" className="vrm-lien-action" data-numero-ecrit-ouvrir-annonces="" onClick={onAnnonces}>Ouvrir mes annonces</button>}</div>
          : <div data-numero-ecrit-passu={cle} style={{fontSize:13,color:C.muted,marginTop:4}}>— tes annonces n’ont pas pu être lues.</div>)}
        {z && z.total === 0 && <div style={{fontSize:13,color:C.muted,marginTop:4}}>Aucune annonce en ligne lue.</div>}
        {z && z.total > 0 && (
          <div style={{fontSize:13,color:C.text,marginTop:4,lineHeight:1.6,fontVariantNumeric:'tabular-nums'}}>
            <span data-ne-n="lus"><b>{z.lus}</b> N° lu{z.lus>1?'s':''}</span>{' · '}
            <span data-ne-n="rien"><b>{z.rien}</b> sans N° écrit</span>
            {z.ambigus > 0 && <>{' · '}<span data-ne-n="ambigus" style={{color:C.warn}}><b>{z.ambigus}</b> ambigu{z.ambigus>1?'s':''}</span></>}
            {z.contredits > 0 && <>{' · '}<span data-ne-n="contredits" style={{color:C.warn}}><b>{z.contredits}</b> à vérifier</span></>}
            {z.autres > 0 && <>{' · '}<span data-ne-n="autres"><b>{z.autres}</b> pas pris</span></>}
            <span style={{color:C.muted}}> sur {z.total}</span>
            {a.doublons.length > 0 && <div data-numero-ecrit-doublons={a.doublons.length} style={{color:C.doublon,fontWeight:600}}>{a.doublons.map((d) => `N°${d.cle}`).join(', ')} : sur deux annonces en ligne.</div>}
            {amb.length > 0 && <div style={{fontSize:12,color:C.muted}}>Deux numéros : {liste(amb)}</div>}
            {con.length > 0 && <div style={{fontSize:12,color:C.muted}}>N° écrit ≠ N° de VRM : {liste(con)}</div>}
          </div>
        )}
      </div>
    );
  };
  const zv = resumeApercu(vinted);
  return (
    <section data-numero-ecrit={r.actif ? 'actif' : 'eteint'} aria-label="Je numérote moi-même dans mes annonces" style={{marginBottom:16,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text}}>Je numérote moi-même dans mes annonces</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3,lineHeight:1.5}}>{r.actif ? 'VRM lit ton numéro dans l’annonce. Il n’en donne plus tout seul.' : 'Éteint : VRM donne un numéro aux annonces qui n’en ont pas.'}</div>
        </div>
        <button type="button" role="switch" aria-checked={r.actif} aria-label="Je numérote moi-même dans mes annonces" data-numero-ecrit-bascule={r.actif ? 'on' : 'off'} onClick={basculer}
          style={{flexShrink:0,width:51,minHeight:44,padding:0,border:'none',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center'}}>
          <span aria-hidden="true" style={{position:'relative',display:'block',width:51,height:31,borderRadius:999,background:r.actif?C.accent:C.border,transition:'background .2s'}}>
            <span style={{position:'absolute',top:2,left:r.actif?22:2,width:27,height:27,borderRadius:999,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'left .2s'}}/>
          </span>
        </button>
      </div>
      <div data-numero-ecrit-exemple="" style={{marginTop:12,padding:'12px 14px',borderRadius:12,background:C.bg,border:`1px solid ${C.border}`,fontSize:13,color:C.text,lineHeight:1.55}}>
        <div style={{fontWeight:700}}>Termine ta description par :</div>
        <div style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',fontSize:15,marginTop:6}}>N° 123</div>
        <div style={{color:C.muted,marginTop:6}}>Ou une seule fois dans le titre. <Pourquoi label="Les formes acceptées">« N° 123 », « N°123 », « No 123 », « Réf 123 », « Ref. 123 », « #123 », ou avec ta lettre : « N° B125 ». Un nombre seul (« 42 ») n’est jamais lu : c’est peut-être la pointure. Deux numéros différents dans la même annonce : VRM ne choisit pas.</Pourquoi></div>
      </div>
      <GuideReglage titre="Numéroter dans tes annonces" etapes={[
        ['Écris le numéro sur la boîte', 'Sur le carton, comme d’habitude.'],
        ['Écris-le à la fin de la description', '« N° 123 » sur la dernière ligne. Sur Leboncoin, la référence pro marche aussi ; sur eBay, le SKU.'],
        ['Ouvre tes annonces dans VRM', 'Il lit le numéro et le range avec la paire. Si un numéro ne colle pas, il te demande.'],
      ]}/>
      <div data-numero-ecrit-apercu="" style={{marginTop:12}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>Ce que VRM lit dans tes annonces</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:4}}>{r.actif ? 'Un numéro qui ne colle pas reste tel quel : tu choisis dans Annonces.' : 'Un aperçu, avant d’allumer. Rien n’est changé.'}</div>
        {sites.map(ligneSite)}
        {r.actif && zv && zv.contredits + zv.ambigus > 0 && onAnnonces && <div style={{marginTop:8}}><Bouton variante="secondaire" data-numero-ecrit-verifier="" onClick={onAnnonces}>Vérifier dans Annonces</Bouton></div>}
      </div>
    </section>
  );
}

// ── TES NUMÉROS DE RANGEMENT : CHIFFRES OU SÉRIE À LETTRE ──────────────────
// Julien, 2 octobre : « toutes les personnes n'utilisent pas les mêmes numéros :
// des fois elles commencent par B125, C123 ; rends la chose adaptable ».
// Deux façons de numéroter, au choix de chacun : des chiffres (1, 2, 3… —
// défaut, rien ne change pour lui) ou une série à lettre (B1, B2…). Le choix ne
// porte QUE sur les numéros à venir : un numéro déjà donné est écrit sur un
// carton, il ne bouge jamais (§5). Et quelle que soit la série choisie, un N°
// tapé à la main peut toujours être « 125 » ou « C40 ».
function NumerosSetting({ nu = false, onStock, onAnnonces }) {
  const [p, setP] = React.useState(() => prefixeNumeros());
  const [mode, setMode] = React.useState(() => (prefixeNumeros() ? 'lettre' : 'chiffres'));
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => {
    if (touche.current) return;                            // §5.49 : ne remplacer que le vide
    const v=prefixeNumeros();setP(v||'');setMode(v?'lettre':'chiffres');
  }), []);
  // La lettre des ANCIENS numéros (remise à zéro, migration 013) ne peut pas
  // être celle des nouveaux : « B12 » désignerait deux paires. La base le
  // refuse ; l'écran le dit avant, et n'enregistre rien.
  // ⚠️ (relecture du 11 octobre) Cliquer « Avec une lettre » ENREGISTRAIT déjà
  //    une lettre par défaut (« C »), puis taper « B » affichait « rien n'est
  //    enregistré » — il repartait en croyant n'avoir rien changé, et ses paires
  //    republiées partaient en C1, C2… La série ne s'enregistre plus qu'à la
  //    lettre TAPÉE et acceptée, et l'écran dit ce qui est réellement enregistré.
  const arch = archiveNumeros();
  const [refusee, setRefusee] = React.useState('');
  const [erreurLocal,setErreurLocal]=React.useState('');
  const poser = (v) => {
    touche.current = true;
    const n = String(v || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (n && arch && n === arch) { setRefusee(n); setP(prefixeNumeros()); return; }
    setRefusee('');
    setP(n);
    // La copie locale tout de suite (`save` écrit 500 ms plus tard) : les champs
    // N° et la numérotation automatique la lisent dès le prochain rendu.
    try { localStorage.setItem('vrm_num_prefixe', JSON.stringify(n));setErreurLocal(''); } catch (_) {setErreurLocal('Le format n’a pas pu être appliqué sur cet appareil. Aucun numéro existant n’est modifié.');setP(prefixeNumeros());setMode(prefixeNumeros()?'lettre':'chiffres');return;}
    save('vrm_num_prefixe', n);
    try { window.dispatchEvent(new Event('vrm-prefixe')); } catch (_) {}
  };
  const defaut = arch === 'B' ? 'C' : 'B';
  // « Avec une lettre » n'enregistre rien tout seul : la lettre se TAPE.
  const choix = (m) => { setMode(m); setRefusee(''); if (m === 'chiffres') poser(''); };
  const ex = p && p !== arch ? p : defaut;
  const enregistree = prefixeNumeros();
  // Les exemples ne citent JAMAIS la lettre des anciens numéros (l'app la refuse).
  const lettreEx = arch ? (arch === 'C' ? 'D' : 'C') : 'B';
  const lettreEx2 = ['C', 'D', 'E'].find((x) => x !== arch && x !== lettreEx);
  return (
    <div data-numeros-reglage={mode} style={nu ? {} : {padding:'13px 16px',borderRadius:12,border:`1px solid ${C.border}`,background:C.card,marginBottom:8}}>
      {!nu && <div style={{fontSize:13,fontWeight:600,color:C.text}}>Tes numéros de rangement</div>}
      <NumeroEcritSetting onAnnonces={onAnnonces}/>
      <div style={{fontSize:13,color:C.muted,marginTop:nu?0:3,lineHeight:1.5}}>
        Le format des <b>prochains</b> numéros. Ceux déjà donnés ne changent pas.
      </div>
      {erreurLocal&&<p role="alert" style={{fontSize:12,color:C.warn}}>{erreurLocal}</p>}
      <Segmente label="Format des prochains numéros" value={mode} onChange={choix} style={{marginTop:10}}
        options={[{ v:'chiffres', l:'Chiffres · 1, 2, 3…' }, { v:'lettre', l:`Avec une lettre · ${ex}1, ${ex}2…` }]}/>
      {/* (30 oct.) Le format ENREGISTRÉ, en une ligne (une carte à quatre cases
          redisait le choix du dessus). Il peut différer du choix tant qu'aucune
          lettre n'est tapée : c'est lui qui fait foi. */}
      <div data-numeros-applique={enregistree || 'chiffres'} style={{fontSize:13,color:C.muted,marginTop:10}}>
        Format enregistré : <b style={{color:C.text,fontVariantNumeric:'tabular-nums'}}>{enregistree?`${enregistree} + chiffres (ex. ${enregistree}125)`:'chiffres seuls (ex. 125)'}</b>
      </div>
      {mode === 'lettre' && (
        <label style={{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:13,color:C.text}}>
          Lettre(s) de ta série
          <input value={p} onChange={(e) => poser(e.target.value)} placeholder={defaut} autoCapitalize="characters" aria-label="Lettres de la série"
            style={{width:70,padding:'8px 10px',borderRadius:12,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:15,fontFamily:'inherit',textTransform:'uppercase'}}/>
        </label>
      )}
      {mode === 'lettre' && !refusee && !enregistree && (
        <div data-numeros-lettre-a-taper style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.5}}>
          Tape la lettre de ta série : tant qu'aucune n'est tapée, tes prochains numéros restent en <b>chiffres</b> (1, 2, 3…).
        </div>
      )}
      {mode === 'lettre' && arch && refusee && (
        <div data-numeros-lettre-archive style={{fontSize:12,color:C.text,marginTop:8,lineHeight:1.5}}>
          « {refusee} » est la lettre de tes <b>anciens</b> numéros ({arch}1, {arch}2…) : elle n'est pas enregistrée. Tes prochains numéros restent {enregistree ? <>en <b>{enregistree}</b> ({enregistree}1, {enregistree}2…)</> : <>en <b>chiffres</b> (1, 2, 3…)</>}. Choisis une autre lettre.
        </div>
      )}
      <div style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.5}}>
        Un numéro tapé à la main peut prendre n'importe quelle forme.{' '}
        <Pourquoi label="Numéros tapés à la main">Exemples : 125, {lettreEx}125, {lettreEx2}40. « {lettreEx.toLowerCase()}125 » et « {lettreEx}125 » sont le même numéro.</Pourquoi>
        {arch && <> Les anciens numéros (<b>{arch}…</b>) ne se redonnent pas.</>}
      </div>
      <GuideReglage titre="Du numéro à l’emplacement" etapes={[
        ['Choisis un format', 'Chiffres seuls ou lettres suivies de chiffres. Les exemples montrent un format, pas le prochain numéro disponible.'],
        ['Identifie ton article', 'Reporte le numéro attribué par VRM sur son support physique pour le retrouver sans hésiter.'],
        ['Indique où il est rangé', 'Exemple : l’article N° C125 est dans Étagère A, case 3. Dans Stock 3D, choisis son numéro puis sa place libre. Le numéro identifie l’article ; la case indique où le trouver.']
      ]}/>
      <NumeroSurVinted/>
      {onStock&&<div className="vrm-settings-next" style={{borderColor:C.border}}><b>Ensuite : indiquer l’emplacement</b><p style={{color:C.muted}}>Choisis la place de l’article dans le stock.</p><Bouton variante="secondaire" onClick={onStock}>Ouvrir mon stock</Bouton></div>}
    </div>
  );
}

// ── LE N° DANS LE TEXTE DE L'ANNONCE VINTED (5 nov.) ─────────────────────────
// Julien, 5 novembre : « les numéros sur les annonces Vinted doivent être bien
// mieux positionnés » ; « plusieurs façons d'étiqueter, des rythmes variés,
// accompagné par l'app ». La règle (places, formes, pose/retrait, proposition)
// vit dans src/etiquetteNumero.js ; ici : le choix, l'aperçu EN DIRECT sur une
// annonce inventée, et deux questions qui proposent un réglage. Rien ne change
// un numéro : c'est l'écriture du N° dans le texte, pas la numérotation.
// « Pas su ≠ oui » : l'écran dit où le réglage s'applique AUJOURD'HUI (les
// textes que VRM prépare à copier) et ce que l'extension ne fait pas encore.
function surligneEtiquette(texte, etiq, aLaFin) {
  const t = String(texte || '');
  const i = etiq ? (aLaFin ? t.lastIndexOf(etiq) : t.indexOf(etiq)) : -1;
  if (i < 0) return t;
  return <>{t.slice(0, i)}<mark data-apercu-etiquette={etiq} style={{background:`${C.accent}1F`,color:C.text,fontWeight:700,borderRadius:6,padding:'0 3px'}}>{etiq}</mark>{t.slice(i + etiq.length)}</>;
}
function PuceChoix({ actif, onClick, children, data }) {
  return <button type="button" aria-pressed={!!actif} onClick={onClick} {...(data || {})}
    style={{minHeight:44,padding:'0 14px',borderRadius:999,border:`1px solid ${actif?C.accent:C.border}`,background:actif?`${C.accent}14`:C.card,color:C.text,fontSize:14,fontWeight:actif?700:500,cursor:'pointer',fontFamily:'inherit',fontVariantNumeric:'tabular-nums'}}>{children}</button>;
}
function NumeroSurVinted() {
  const lire = () => lireReglageEtiquette(load(CLE_REGLAGE_ETIQUETTE, null));
  const [r, setR] = React.useState(lire);
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => { if (!touche.current) setR(lire()); }), []);
  const poser = (patch) => { touche.current = true; const n = lireReglageEtiquette({ ...r, ...patch }); setR(n); save(CLE_REGLAGE_ETIQUETTE, n); try { window.dispatchEvent(new Event('vrm-num-vinted')); } catch (_) {} };
  const [rep, setRep] = React.useState({});
  const prop = propositionEtiquette(rep);
  const dejaPris = prop && prop.place === r.place && prop.forme === r.forme;
  // L'exemple suit SA série (« C12 » s'il numérote en C) : la vraie forme.
  const pref = prefixeNumeros(); const numEx = pref ? `${pref}12` : '12';
  const ap = poserEtiquette(ANNONCE_EXEMPLE, numEx, r);
  const place = PLACES_ETIQUETTE.find((p) => p.v === r.place) || PLACES_ETIQUETTE[0];
  const enTitre = r.place.startsWith('titre'), aLaFin = r.place.endsWith('_fin');
  const etiq = ap.pose ? ap.etiquette : '';
  const lib = {fontSize:13,fontWeight:600,color:C.text,margin:'14px 0 8px'};
  return (
    <section data-num-vinted={r.place} data-num-vinted-forme={r.forme} aria-label="Le N° sur tes annonces Vinted" style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
      <div style={{fontSize:15,fontWeight:700,color:C.text}}>Le N° sur tes annonces Vinted</div>
      <div style={{fontSize:13,color:C.muted,marginTop:3,lineHeight:1.5}}>Où l'écrire dans le texte de l'annonce, et sous quelle forme. Ton numéro ne change pas.</div>

      {/* L'ACCOMPAGNEMENT : deux questions → une proposition, prise sur SON clic. */}
      <div data-num-vinted-guide="" style={{marginTop:12,padding:'12px 14px',borderRadius:12,background:C.bg,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>Je t'aide à choisir</div>
        {QUESTIONS_ETIQUETTE.map((q) => (q.id === 'vu' && rep.ou === 'vrm') ? null : (
          <div key={q.id} data-num-vinted-question={q.id}>
            <div style={{fontSize:13,color:C.text,margin:'10px 0 6px'}}>{q.q}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {q.r.map((o) => <PuceChoix key={o.v} actif={rep[q.id] === o.v} onClick={() => setRep((x) => ({ ...x, [q.id]: o.v }))} data={{'data-num-vinted-reponse': q.id + ':' + o.v}}>{o.l}</PuceChoix>)}
            </div>
          </div>))}
        {prop && (
          <div data-num-vinted-proposition={prop.place + ':' + prop.forme} style={{marginTop:12,fontSize:13,color:C.text,lineHeight:1.5}}>
            <b>{(PLACES_ETIQUETTE.find((p) => p.v === prop.place) || {}).l}{prop.place !== 'aucune' ? `, en « ${etiquetteDe(numEx, prop.forme)} »` : ''}.</b> {prop.pourquoi}
            <div style={{marginTop:8}}>
              {dejaPris
                ? <span data-num-vinted-pris="" style={{fontSize:13,color:C.muted}}>C'est ton réglage.</span>
                : <Bouton variante="secondaire" data-num-vinted-prendre="" onClick={() => poser({ place: prop.place, forme: prop.forme })}>Prendre ce choix</Bouton>}
            </div>
          </div>)}
      </div>

      <div style={lib}>Où l'écrire</div>
      <div role="radiogroup" aria-label="Où écrire le N°" style={{display:'flex',flexDirection:'column',gap:6}}>
        {PLACES_ETIQUETTE.map((p) => { const on = r.place === p.v; return (
          <button key={p.v} type="button" role="radio" aria-checked={on} data-num-vinted-place={p.v} onClick={() => poser({ place: p.v })}
            style={{display:'flex',alignItems:'flex-start',gap:10,textAlign:'left',minHeight:44,padding:'10px 12px',borderRadius:12,border:`1px solid ${on?C.accent:C.border}`,background:on?`${C.accent}0F`:C.card,color:C.text,cursor:'pointer',fontFamily:'inherit'}}>
            <span aria-hidden="true" style={{flexShrink:0,width:18,height:18,marginTop:1,borderRadius:999,border:`2px solid ${on?C.accent:C.border}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center'}}>{on && <span style={{width:8,height:8,borderRadius:999,background:C.accent}}/>}</span>
            <span style={{minWidth:0}}><b style={{display:'block',fontSize:14}}>{p.l}</b><span style={{display:'block',fontSize:12,color:C.muted,lineHeight:1.45,marginTop:2}}>{p.d}</span></span>
          </button>); })}
      </div>

      {r.place !== 'aucune' && <>
        <div style={lib}>Sous quelle forme</div>
        <div role="group" aria-label="Forme de l'étiquette" style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {FORMES_ETIQUETTE.map((f) => <PuceChoix key={f.v} actif={r.forme === f.v} onClick={() => poser({ forme: f.v })} data={{'data-num-vinted-forme-choix': f.v}}>{etiquetteDe(numEx, f.v)}</PuceChoix>)}
        </div>
      </>}

      {/* L'APERÇU EN DIRECT, sur une annonce INVENTÉE (§2.3 : aucune donnée réelle). */}
      <div style={lib}>Aperçu <span style={{fontWeight:400,color:C.muted}}>· annonce inventée</span></div>
      <div data-num-vinted-apercu={ap.pose ? 'pose' : (ap.refus ? 'refus' : 'rien')} style={{border:`1px solid ${C.border}`,borderRadius:12,background:C.card,overflow:'hidden'}}>
        <div style={{display:'flex',gap:12,padding:12}}>
          <div aria-hidden="true" style={{width:72,height:90,flexShrink:0,borderRadius:8,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.muted}}><Icon name="image" size={22}/></div>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:17,fontWeight:700,color:C.text,fontVariantNumeric:'tabular-nums'}}>{ANNONCE_EXEMPLE.prix}</div>
            <div data-apercu-titre={ap.titre} style={{fontSize:14,color:C.text,lineHeight:1.4,marginTop:2,overflowWrap:'anywhere'}}>{enTitre ? surligneEtiquette(ap.titre, etiq, aLaFin) : ap.titre}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>42 · Très bon état</div>
          </div>
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,padding:'10px 12px'}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:4}}>Description</div>
          <div data-apercu-desc={ap.description} style={{fontSize:13,color:C.text,whiteSpace:'pre-wrap',lineHeight:1.5}}>{!enTitre ? surligneEtiquette(ap.description, etiq, aLaFin) : ap.description}</div>
        </div>
        {/* Une liste étroite (ventes, messages) coupe le titre : on le montre. */}
        <div style={{borderTop:`1px solid ${C.border}`,padding:'10px 12px'}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:4}}>Dans une liste étroite (ventes, messages)</div>
          <div data-apercu-liste="" style={{maxWidth:240,fontSize:13,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{enTitre ? surligneEtiquette(ap.titre, etiq, aLaFin) : ap.titre}</div>
          {enTitre && aLaFin && <div style={{fontSize:12,color:C.muted,marginTop:4,lineHeight:1.45}}>En fin de titre, une liste étroite peut couper le N° : garde tes titres courts, ou mets-le au début.</div>}
        </div>
      </div>
      {ap.refus && <div data-num-vinted-refus="" style={{fontSize:12,color:C.text,marginTop:6}}>{ap.refus}.</div>}

      {r.place !== 'aucune' && (
        <div data-num-vinted-portee="" style={{fontSize:12,color:C.muted,marginTop:10,lineHeight:1.5}}>
          Aujourd'hui, VRM écrit « {etiquetteDe(numEx, r.forme)} » {place.ou} dans les textes qu'il te prépare à copier (« Rédiger une annonce »). Tes annonces déjà en ligne ne sont pas réécrites : sur vinted.fr, l'extension continue d'afficher la pastille N° dans ton navigateur.
        </div>)}
      <GuideReglage titre="Bien placer ton N°" etapes={[
        ['Pense au moment où tu le cherches', 'Une vente tombe : tu lis la liste (le titre) ou tu ouvres l’annonce (la description). Mets le N° là où ton œil va en premier.'],
        ['Choisis une forme que tu reconnais', 'N°12, #12, Réf 12, (12)… La même partout : tu la repères d’un coup d’œil, et elle ne change jamais le numéro écrit sur ton carton.'],
        ['Si tu changes un N°', 'Dans les textes que VRM te prépare, l’ancienne étiquette est remplacée, jamais empilée. Sur une annonce déjà en ligne, c’est à toi de la changer : VRM te dit quoi remplacer. L’ancien numéro passe dans « numéros à écrire sur tes cartons » jusqu’à « C’est écrit ».'],
      ]}/>
    </section>
  );
}

// ⛔ DÉTOURAGE DES PHOTOS : plus de réglage (17 octobre, sa décision — « le
// détourage ne doit être présent QUE dans Vestiaire Collective, pas du tout pour
// Leboncoin, ne le mets pas dans les paramètres »). L'extension ne détoure plus
// rien pour Leboncoin ni eBay ; Vestiaire, qui l'exige, détoure toujours, sans
// réglage (`photosPourVestiaire`). `vrm_detourage` n'est plus lu nulle part.

// La carte « Les offres, c'est toi qui décides » (Réglages) est RETIRÉE avec
// l'acceptation automatique des offres (5 octobre, à sa demande) : une carte qui
// explique une fonction qui n'existe plus est du bruit (§7). Les offres se
// tranchent dans Messages, sur son clic.

// L'interrupteur des Paramètres — UNE forme pour tous (16 octobre : les
// « ON / OFF » en boutons pleins faisaient « page bricolée »). Un vrai
// `role="switch"` : les bancs le cherchent ainsi, et un lecteur d'écran le dit.
function Interrupteur({ on, onClick, label, disabled, ...rest }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} onClick={onClick} disabled={disabled}
      className="vrm-switch" style={{'--vrm-sw': on ? C.accent : `${C.text}26`}} {...rest}/>
  );
}
// ⟦← App.jsx #42⟧
// ── LE PROGRAMME DU MODE STREAM (5 nov.) ────────────────────────────────────
// Ce qu'il cache quand il filme : des catégories à cocher, trois listes de mots
// (marques et mots · « les mots qui commencent par… » · « cacher toute l'annonce
// qui contient… ») et un APERÇU EN DIRECT sur des données d'exemple (jamais ses
// vrais pseudos dans une démonstration). Le programme est synchronisé ; la règle
// (src/modeStream.js) change dès le geste.
const STREAM_AIDE_LISTE = {
  marques: 'Le mot entier, majuscules ignorées.',
  prefixes: 'Chaque mot qui commence ainsi.',
  contient: 'La ligne entière (texte et photo) est cachée.',
};
const STREAM_EX_LISTE = { marques: 'Ex. une marque', prefixes: 'Ex. les 3 premières lettres', contient: 'Ex. un modèle' };
// (6 nov.) La photo d'EXEMPLE de l'aperçu : une chaussure dessinée, un « LOGO »
// inventé — jamais une vraie photo de ses annonces dans une démonstration.
const STREAM_PHOTO_EXEMPLE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#e8ecf2"/><path d="M12 62c0-6 4-10 10-11l24-5c6-1 10-6 14-11l6-7c3-3 8-2 10 1l5 9c3 5 9 8 15 9l9 2c5 1 8 5 8 10v5H12z" fill="#1d1d1f"/><rect x="12" y="66" width="101" height="8" rx="4" fill="#fff" stroke="#1d1d1f" stroke-width="2"/><text x="44" y="60" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="12" fill="#fff">LOGO</text></svg>');
function ListeMotsStream({ id, titre, mots, onChange }) {
  const [saisie, setSaisie] = React.useState('');
  const ajouter = () => {
    const morceaux = saisie.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
    if (!morceaux.length) return;
    onChange(nettoyerMots([...mots, ...morceaux]));
    setSaisie('');
  };
  return (
    <div className="vrm-stream-liste" data-stream-liste={id} data-stream-mots={mots.length}>
      <b style={{color:C.text}}>{titre}</b>
      <small style={{color:C.muted}}>{STREAM_AIDE_LISTE[id]}</small>
      {mots.length > 0 && <div className="vrm-stream-puces">
        {mots.map((m) => (
          <span key={m} className="vrm-stream-puce" data-stream-mot={m} style={{background:`${C.text}0d`,color:C.text}}>
            <span>{m}</span>
            <button type="button" aria-label={`Retirer ${m}`} onClick={() => onChange(mots.filter((x) => x !== m))} style={{color:C.muted}}>×</button>
          </span>
        ))}
      </div>}
      <form className="vrm-stream-ajout" onSubmit={(e) => { e.preventDefault(); ajouter(); }}>
        <input type="text" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={STREAM_EX_LISTE[id]} aria-label={titre}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200}
          style={{background:C.bg,color:C.text,border:`1px solid ${C.border}`}}/>
        <Bouton type="submit" disabled={!saisie.trim()} title={saisie.trim() ? undefined : 'Écris d’abord dans le champ à côté ce qu’il faut cacher.'} data-stream-ajouter={id}>Ajouter</Bouton>
      </form>
    </div>
  );
}
function ReglagesStream() {
  const on = useStream();
  const regles = useReglesStream();
  const [essai, setEssai] = React.useState('');
  const changer = (patch) => ecrireReglesStream({ ...regles, ...patch });
  // L'aperçu : données INVENTÉES (« ton_compte », « acheteur_exemple »), la règle du
  // programme affiché. Une ligne « annonce entière » se cache d'un bloc.
  const R = regleApercu(regles, { comptes_apercu: ['ton_compte'], acheteurs_apercu: ['acheteur_exemple'] });
  const marque = regles.marques[0] || 'Marque';
  // (6 nov.) Les photos de l'aperçu : la MÊME règle (`photoACacherSelon`). Sans
  // aucun mot programmé, l'aperçu prend « Marque » pour exemple (dit sous les photos).
  const sansMot = !regles.marques.length && !regles.prefixes.length && !regles.contient.length;
  const Rp = sansMot ? regleApercu({ ...regles, marques: ['Marque'] }, {}) : R;
  const motPhoto = regles.marques[0] || regles.contient[0] || (regles.prefixes[0] ? regles.prefixes[0] + 'ina' : 'Marque');
  const photosEx = [`${motPhoto} Air Max 90 · taille 42`, 'Autre paire · taille 41'];
  const lignes = [
    `${marque} Air Max 90 · taille 42 · 89,00\u00a0€`,
    'Vendue sur ton_compte à acheteur_exemple',
    '8 rue de l’Exemple, 00000 Ville-Test · 06 00 00 00 00',
    'IBAN FR76 3000 6000 0112 3456 7890 189',
    ...(regles.prefixes[0] ? [`${regles.prefixes[0]}ina Runner · 54,00\u00a0€`] : []),
    ...(regles.contient[0] ? [`${regles.contient[0]} édition limitée · 120,00\u00a0€`] : []),
    ...(essai.trim() ? [essai] : []),
  ];
  return (
    <div className="vrm-stream-reglages" data-stream-reglages="">
      <div className="vrm-set-ligne" data-stream-reglage={on ? 'on' : 'off'}>
        <IconeReglage name="stream"/>
        <span className="vrm-set-lib"><b style={{color:C.text}}>Mode stream</b><small style={{color:C.muted}}>{regles.bouton ? 'Sur cet appareil. Le bouton « Stream » en haut de l’écran fait la même chose.' : 'Sur cet appareil.'}</small></span>
        <Interrupteur on={on} label="Mode stream" onClick={() => poserStream(!on)}/>
      </div>
      {/* (6 nov.) Julien : « pour le bouton stream tu peux faire une option qui
          n'apparaît que si on le sélectionne dans les paramètres ». Éteint par défaut ;
          synchronisé avec le programme. Sans lui, l'œil en haut cache les montants. */}
      <div className="vrm-set-ligne" data-stream-option="bouton" data-stream-bouton={regles.bouton ? '1' : '0'}>
        <span className="vrm-set-lib"><b style={{color:C.text}}>Afficher le bouton Stream</b><small style={{color:C.muted}}>{regles.bouton ? 'En haut de l’écran, à la place de l’œil des montants.' : 'Sinon, l’œil en haut de l’écran cache les montants.'}{on && !regles.bouton ? ' Le bouton reste affiché tant que le mode stream est allumé.' : ''}</small></span>
        <Interrupteur on={!!regles.bouton} label="Afficher le bouton Stream" onClick={() => changer({ bouton: !regles.bouton })}/>
      </div>
      <h3 className="vrm-stream-h" style={{color:C.muted}}>Ce qui est caché</h3>
      <div className="vrm-stream-cats">
        {STREAM_CATEGORIES.map(([k, lib]) => (
          <div key={k} className="vrm-set-ligne" data-stream-cat={k} data-stream-cache={regles[k] ? '1' : '0'}>
            <span className="vrm-set-lib"><b style={{color:C.text}}>{lib}</b></span>
            <Interrupteur on={!!regles[k]} label={lib} onClick={() => changer({ [k]: !regles[k] })}/>
          </div>
        ))}
      </div>
      <h3 className="vrm-stream-h" style={{color:C.muted}}>Tes mots</h3>
      {STREAM_LISTES.map(([k, lib]) => <ListeMotsStream key={k} id={k} titre={lib} mots={regles[k]} onChange={(l) => changer({ [k]: l })}/>)}
      {/* (6 nov.) Julien : « je veux que on puisse aussi flouter les photos en lien
          avec ce que on veut cacher ». La règle des photos est celle du texte
          (src/modeStream.js, `photoACacherSelon`). */}
      <h3 className="vrm-stream-h" style={{color:C.muted}}>Photos</h3>
      <div className="vrm-stream-cats">
        <div className="vrm-set-ligne" data-stream-option="photos" data-stream-cache={regles.photos ? '1' : '0'}>
          <span className="vrm-set-lib"><b style={{color:C.text}}>Flouter aussi les photos</b><small style={{color:C.muted}}>Les photos des articles qui ont une de tes marques ou un de tes mots.</small></span>
          <Interrupteur on={!!regles.photos} label="Flouter aussi les photos" onClick={() => changer({ photos: !regles.photos })}/>
        </div>
        <div className="vrm-set-ligne" data-stream-option="photosToutes" data-stream-cache={regles.photosToutes ? '1' : '0'}>
          <span className="vrm-set-lib"><b style={{color:C.text}}>Flouter toutes les photos</b><small style={{color:C.muted}}>Toutes les photos d’articles, quels que soient tes mots.</small></span>
          <Interrupteur on={!!regles.photosToutes} label="Flouter toutes les photos" onClick={() => changer({ photosToutes: !regles.photosToutes })}/>
        </div>
      </div>
      <h3 className="vrm-stream-h" style={{color:C.muted}}>Aperçu</h3>
      <div className="vrm-stream-apercu" data-stream-apercu="" style={{background:C.bg,border:`1px solid ${C.border}`}}>
        {lignes.map((t, i) => {
          const entiere = ligneACacher(t, R);
          return <div key={i} className="vrm-stream-apercu-l" data-apercu-entiere={entiere ? '1' : '0'} style={{color:C.text}}>{entiere ? '•••' : masquerTexteStream(t, R)}</div>;
        })}
      </div>
      <div className="vrm-stream-photos-apercu" data-stream-libre="" data-stream-apercu-photos="">
        {photosEx.map((t) => {
          const floue = photoACacherSelon(t, Rp);
          return (
            <figure key={t} className="vrm-stream-apercu-photo" data-apercu-photo={floue ? 'floue' : 'nette'}>
              <span style={{border:`1px solid ${C.border}`}}><img src={STREAM_PHOTO_EXEMPLE} alt="" width={120} height={90}/></span>
              <figcaption style={{color:C.muted}}>{masquerTexteStream(t, Rp)}</figcaption>
            </figure>
          );
        })}
        <small style={{color:C.muted}}>{sansMot ? 'Exemple avec la marque « Marque ». ' : ''}{regles.photosToutes ? 'Toutes les photos sont floutées.' : regles.photos ? 'Photo inventée : floutée quand l’article a un de tes mots.' : 'Les photos ne sont pas floutées.'}</small>
      </div>
      <textarea className="vrm-stream-essai" value={essai} onChange={(e) => setEssai(e.target.value)} rows={2} placeholder="Essaie un texte : il s’affiche ci-dessus comme à l’écran" aria-label="Essayer un texte"
        style={{background:C.bg,color:C.text,border:`1px solid ${C.border}`}}/>
    </div>
  );
}
// ⟦← App.jsx #43⟧
// (8 nov., « beauté ») L'APPARENCE : quatre choix en liste d'iOS (une coche sur le choisi).
// Le choix est le sien, jamais posé tout seul ; « Le soir » suit l'heure de l'appareil.
function ApparenceSetting({ valeur, onChoisir }) {
  return (
    <div className="vrm-apparence" role="radiogroup" aria-label="Apparence" data-apparence-choix={valeur || ''}>
      {APPARENCES.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={valeur === m} className={'vrm-apparence-ligne' + (valeur === m ? ' is-choisi' : '')}
          data-apparence={m} onClick={() => onChoisir && onChoisir(m)}>
          <span className={'vrm-apparence-apercu is-' + m} aria-hidden="true"><span/></span>
          <span className="vrm-apparence-txt"><b>{LIBELLES_APPARENCE[m]}</b><small>{PHRASES_APPARENCE[m]}</small></span>
          <svg className="vrm-apparence-coche" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 8.5 3.2 3.2L13 4.8"/></svg>
        </button>
      ))}
    </div>
  );
}
function ZoomSetting({ nu = false }) {
  const [z, setZ] = React.useState(readZoom);
  const [telephone, setTelephone] = React.useState(() => window.matchMedia('(max-width: 767px)').matches);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const maj = () => setTelephone(mq.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  const choisir = (v) => { setZ(v); try { localStorage.setItem(ZOOM_KEY, v); } catch (_) {} applyZoom(v); };
  const choix = telephone ? ZOOMS.filter(([v]) => Number(v) >= 1) : ZOOMS;
  const selection = telephone && Number(z) < 1 ? '1' : z;
  return (
    <div style={nu ? {} : {background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 14px',marginBottom:8,boxShadow:C.shadow||'none'}}>
      {!nu && <div style={{fontSize:15,fontWeight:600,color:C.text}}>Taille de l'affichage</div>}
      <div style={{fontSize:13,color:C.muted,marginTop:nu?0:3,lineHeight:1.45}}>
        Réglage propre à cet appareil.
      </div>
      <Segmente label="Taille de l'affichage" plein value={selection} onChange={choisir} style={{marginTop:11}}
        options={choix.map(([v, label]) => ({ v, l: label }))}/>
    </div>
  );
}

// Date de départ de l'import des emails Vinted. Rangée dans Supabase
// (ligne vrm_email_config) : le script Gmail la lit à chaque passage, donc
// changer la date ici prend effet à la synchro suivante, sans toucher au script.
// ⚠️ LE BLOC SE POSE UNE FOIS, EN HAUT (§7). Quatre panneaux qui disent la même
// chose sont quatre alertes pour une cause — et une alerte qu'on lit quatre fois
// est une alerte qu'on cesse de lire. Il NOMME les panneaux touchés : sans ça il
// ne saurait pas lesquels regarder sur un écran qui fait défiler.
function ReglagesPasLus() {
  const [, forcer] = useState(0);
  useEffect(() => {
    const f = () => forcer((n) => n + 1);
    _reglagesEcoute.add(f);
    return () => { _reglagesEcoute.delete(f); };
  }, []);
  const noms = [..._reglagesRates.values()];
  if (!noms.length) return null;
  const liste = noms.length === 1 ? noms[0]
    : noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1];
  return (
    <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 13px',marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text}}>
        {noms.length > 1 ? `${noms.length} réglages n'ont pas pu être lus` : "Un réglage n'a pas pu être lu"}
      </div>
      <div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.45}}>
        La base n'a pas répondu pour {liste}. <b>Rien n'est perdu</b>, et rien ne sera
        écrit par-dessus : tant que je n'ai pas lu, je ne touche à rien. Rouvre cet
        écran dans un moment.
      </div>
    </div>
  );
}
// ⟦← App.jsx #44⟧
function EmailStartSetting({ nu = false }) {
  const [date, setDate] = useState('');
  const [base,setBase]=useState('');
  const [reprise,setReprise]=useState(false);
  const owner=AUTH.user?.id||null;
  const [status, setStatus] = useState('load'); // load | ok | saving | err | pasLu
  const HEADERS = sbAuth();

  useEffect(()=>{
    let actif=true;setStatus('load');
    (async()=>{
      const d=await lireReglage('vrm_email_config');
      if(!actif||(AUTH.user?.id||null)!==owner)return;
      if(d===null){setStatus('pasLu');return;}
      const actuelle=d.startDate||'',brouillon=brouillonsParametres.lire(owner,'email-import');
      setBase(actuelle);
      if(brouillon&&brouillon.valeur!==actuelle){setDate(brouillon.valeur);setReprise(true);setStatus('modifie');}
      else{setDate(actuelle);setStatus('ok');brouillonsParametres.effacer(owner,'email-import');}
    })().catch(()=>{if(actif&&(AUTH.user?.id||null)===owner)setStatus('pasLu');});
    return()=>{actif=false;};
  },[owner]);

  React.useEffect(()=>{
    if((AUTH.user?.id||null)!==owner)return;
    const modifie=['modifie','err','saving'].includes(status)&&date!==base;
    if(owner){if(modifie)brouillonsParametres.ecrire(owner,'email-import',{valeur:date,base});else if(['ok','modifie','err','saved'].includes(status))brouillonsParametres.effacer(owner,'email-import');}
    const prevenir=e=>{if(modifie){e.preventDefault();e.returnValue='';}};
    if(modifie)window.addEventListener('beforeunload',prevenir);
    return()=>window.removeEventListener('beforeunload',prevenir);
  },[date,base,status,owner]);
  const annuler=()=>{if((AUTH.user?.id||null)!==owner)return;setDate(base);setReprise(false);setStatus('ok');brouillonsParametres.effacer(owner,'email-import');};
  const saveDate = async (v) => {
    if (!dateImportValide(v) || status === 'pasLu' || status === 'saving') return;
    if((AUTH.user?.id||null)!==owner)return;
    setStatus('saving');
    if(!await askConfirm({title:'Modifier le début de l’import ?',desc:`Les prochains imports utiliseront la date du ${v.split('-').reverse().join('/')} comme début d’historique. Les données déjà présentes ne sont pas effacées par ce réglage.`,ok:'Enregistrer cette date',cancel:'Annuler'})){setStatus('modifie');return;}
    if((AUTH.user?.id||null)!==owner)return;
    try {
      const r=await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
        method:'POST',headers:{...HEADERS,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify([withOwner({id:'vrm_email_config',data:{startDate:v,updatedAt:new Date().toISOString()}})])
      });
      if(!r.ok) throw Error('refus de sauvegarde');
      if((AUTH.user?.id||null)!==owner)return;
      setBase(v);setReprise(false);brouillonsParametres.effacer(owner,'email-import');setStatus('saved');
    } catch (_) {setStatus('err');}
  };

  return (
    <div style={nu ? {} : {border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 14px'}}>
      {!nu && <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>Import des e-mails</div>}
      <div style={{fontSize:13,color:C.muted,marginBottom:12,lineHeight:1.45}}>
        Les e-mails Vinted sont pris en compte à partir de cette date (appliqué en 5 min au plus).
      </div>
      {/* (1er nov.) Ce qui est VRAI : le script collectif (BOITE_PARTAGEE) ne lit pas
          cette date — il reçoit pour tous les vendeurs ; sa date de départ est la
          propriété VRM_START_DATE du script. Réservé au propriétaire (Paramètres). */}
      <div data-import-collectif="" style={{fontSize:12,color:C.muted,margin:'-6px 0 12px',lineHeight:1.45}}>
        Avec la boîte collective, cette date ne s’applique pas : le script utilise sa propriété <code>VRM_START_DATE</code> (Apps Script → Paramètres du projet → Propriétés du script).
      </div>
      {reprise&&<p role="status" className="vrm-settings-draft" style={{color:C.warn}}>Une modification non enregistrée a été reprise pour ce compte. La date en ligne reste {base?base.split('-').reverse().join('/'):'non définie'} tant que tu ne valides pas.</p>}
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:500,color:C.text}}>À partir du</span>
        <input type="date" value={date} onChange={e=>{setDate(e.target.value);setStatus('modifie');}} disabled={status==='load'||status==='pasLu'||status==='saving'}
          style={{border:`1px solid ${C.border}`,borderRadius:12,padding:'6px 10px',fontSize:13,fontFamily:'inherit',background:C.bg,color:C.text,outline:'none',opacity:status==='pasLu'?0.45:1}}/>
        <span style={{fontSize:11,color:status==='err'?C.danger:C.muted}}>
          {status==='load'?'chargement…':status==='saving'?'enregistrement…':status==='err'?'⚠ échec — réessaie':status==='pasLu'?'':status==='modifie'?'Modification non enregistrée':status==='saved'?'✓ enregistré':date?'Date actuelle':'Aucune date définie'}
        </span>
      </div>
      {(status==='modifie'||status==='err'||status==='saving') && <Bouton variante="primaire" disabled={!dateImportValide(date)||status==='saving'} onClick={()=>saveDate(date)} style={{marginTop:10}}>{status==='saving'?'Enregistrement…':status==='err'?'Réessayer l’enregistrement':'Enregistrer la date'}</Bouton>}
      {['modifie','err'].includes(status)&&<Bouton variante="discret" onClick={annuler} style={{margin:'10px 0 0 12px'}}>Annuler</Bouton>}
      {date&&!dateImportValide(date)&&<p role="alert" style={{color:C.warn,fontSize:12}}>Choisis une date valide avant d’enregistrer.</p>}
      {status==='pasLu' && <div style={{marginTop:9}}><span style={{display:'inline-block',fontSize:11,fontWeight:600,color:C.muted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:999,padding:'2px 9px'}}>{REGLAGE_PAS_LU}</span></div>}
    </div>
  );
}

// Notifications push : ventes / bordereaux / argent reçu en temps réel, même
// app fermée. Nécessite l'app installée sur l'écran d'accueil (iPhone) et le
// pipeline email branché (api/email-inbound.js). Un abonnement par appareil.
// La clé vit dans src/vapid.js (une seule source, §11).
function PushSetting() {
  // (1er nov.) Les consignes Vercel/VAPID : au propriétaire de l'installation seul.
  const proprio = useEstProprietaire();
  const [state, setState] = useState('checking'); // checking | unsupported | off | on | busy
  const [msg, setMsg] = useState(null);
  const [srv, setSrv] = useState(null);   // ce que le SERVEUR dit de lui-même
  // (5 nov.) « Installer VRM sur l'iPhone » : iPhone + Safari + pas installée + pas fermé (src/guideIphone.js).
  const [guideIphone, fermerGuideIphone] = useGuideIphone();
  const b64ToU8 = (s) => { const p='='.repeat((4-s.length%4)%4); const b=(s+p).replace(/-/g,'+').replace(/_/g,'/'); const r=atob(b); return Uint8Array.from([...r].map(c=>c.charCodeAt(0))); };

  // ⚠️ LE PIÈGE QUI A COUPÉ SES NOTIFICATIONS (et qui vient de MOI).
  // En sortant la clé privée VAPID du dépôt public (§5.53), la paire a été
  // RÉGÉNÉRÉE — donc la clé PUBLIQUE a changé elle aussi. Or un abonnement push
  // est scellé à la clé publique avec laquelle il a été créé : les abonnements
  // déjà posés sur ses appareils sont devenus inutilisables, le service de push
  // refuse l'envoi, et `getSubscription()` les rend quand même. L'écran
  // affichait donc « activé » pendant que plus rien n'arrivait.
  // ➡️ On COMPARE la clé de l'abonnement à la clé courante et on ré-abonne.
  const memeCle = (sub) => {
    try {
      const a = new Uint8Array(sub.options.applicationServerKey);
      const b = b64ToU8(VAPID_PUBLIC_KEY);
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    } catch (_) { return true; }  // clé illisible : on ne casse rien
  };

  useEffect(() => { (async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') { setState('unsupported'); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !memeCle(sub)) {
        // Abonnement périmé : on le remplace tout seul, sans rien demander.
        try {
          await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) }).catch(()=>{});
          await sub.unsubscribe();
          sub = Notification.permission === 'granted'
            ? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY) })
            : null;
          if (sub) setMsg('Abonnement renouvelé sur cet appareil (la clé du serveur avait changé).');
        } catch (_) { sub = null; }
      }
      const on = sub && Notification.permission === 'granted';
      setState(on ? 'on' : 'off');
      // Auto-réparation : si l'appareil se croit abonné, on renvoie son
      // abonnement au serveur (idempotent). Évite le cas « le téléphone est
      // abonné mais le serveur ne le connaît pas ».
      if (on) {
        fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'subscribe', sub: sub.toJSON() }) }).catch(()=>{});
      }
    } catch (_) { setState('off'); }
  })(); }, []);

  // Le serveur peut-il seulement envoyer ? (clé privée présente ou non)
  useEffect(() => { (async () => {
    try {
      const r = await fetch('/api/push?etat=1', { headers: enTeteSession() });
      const j = await r.json().catch(() => ({}));
      if (j && typeof j.pret === 'boolean') setSrv(j);
    } catch (_) {}
  })(); }, []);

  const enable = async () => {
    setState('busy'); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('off'); setMsg('Permission refusée. Autorise les notifications dans les réglages du site.'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY) });
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'subscribe', sub: sub.toJSON() }) });
      // ⚠️ « enregistrement serveur échoué » est du vocabulaire d'informaticien,
      //    et surtout ça ne dit pas quoi faire. La route explique maintenant en
      //    clair pourquoi (la base ne répond pas) et que rien n'est perdu : on
      //    affiche SA phrase quand elle est là.
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error((j && j.message) || "Le serveur n'a pas pu enregistrer cet appareil. Réessaie dans quelques minutes.");
      }
      setState('on'); setMsg('✅ Activé sur cet appareil.');
    } catch (e) { setState('off'); setMsg((e && e.message) || String(e)); }
  };

  const disable = async () => {
    setState('busy'); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) }).catch(()=>{});
        await sub.unsubscribe();
      }
      setState('off'); setMsg('Notifications coupées sur cet appareil.');
    } catch (_) { setState('off'); }
  };

  const test = async () => {
    setMsg(null);
    try {
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'test' }) });
      const j = await r.json().catch(()=>({}));
      // ⚠️ On affiche la RAISON donnée par le serveur. « Aucun appareil n'a
      // reçu le test » ne dit pas si c'est l'appareil ou la clé du serveur qui
      // manque — et c'est justement la question quand plus rien n'arrive.
      setMsg(j.sent > 0
        ? `✅ Test envoyé à ${j.sent} appareil${j.sent>1?'s':''} — la notif doit apparaître.`
        : j.coupe === 'abonnement'
        ? "Ton abonnement VRM n'est plus actif : les notifications sont en pause. Elles reviennent toutes seules dès que tu le reprends (Paramètres → Abonnement)."
        : (j.erreur === 'VAPID_PRIVATE_KEY absente'
            ? (proprio ? '⚠ Le serveur ne peut RIEN envoyer : la clé VAPID_PRIVATE_KEY n\'est pas configurée sur Vercel. Tant qu\'elle manque, aucune notification ne partira.' : 'Les notifications ne sont pas encore activées sur VRM : aucune ne peut partir pour l\'instant. Tu n\'as rien à faire.')
            : (j.total === 0 ? '⚠ Aucun appareil abonné. Active les notifications sur cet appareil d\'abord.'
            // ⚠️ Un abonnement scellé sur une ANCIENNE clé publique est mort pour
            // toujours (mesuré : 403 côté Chrome, VapidPkHashMismatch côté Apple).
            // Le serveur vient de le purger ; il faut rouvrir l'app sur chaque
            // appareil pour qu'il se réabonne sur la clé courante. Sans ce
            // message, on lisait « 2 abonnés, 0 joint » sans savoir quoi faire.
               : j.perimes ? `⚠ ${j.perimes} appareil(s) étai(en)t abonné(s) avec une ancienne clé — ils viennent d\'être retirés. Rouvre l\'app sur chaque appareil : il se réabonnera tout seul, puis refais ce test.`
                             : `⚠ ${j.total} appareil(s) abonné(s), 0 joint. Réactive les notifications sur cet appareil.`)));
    } catch (e) { setMsg('Erreur test : ' + (e?.message || e)); }
  };

  return (
    <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 14px'}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>Notifications téléphone</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:10,lineHeight:1.4}}>
        Vente, bordereau, argent reçu : notifié en temps réel, même app fermée.
        {/* (5 nov.) Sur un iPhone dans Safari, le guide illustré le dit (une phrase, une fois — §7). */}
        {state==='unsupported' && !guideIphone && ' — Non disponible ici : installe d\'abord l\'app sur ton écran d\'accueil (Partager → Sur l\'écran d\'accueil) puis ouvre-la depuis l\'icône.'}
      </div>
      {guideIphone && <GuideIphone onFermer={fermerGuideIphone}/>}
      {/* ⚠️ « Je ne reçois plus rien » a DEUX causes qui font le même silence :
          aucun appareil abonné, ou le serveur sans sa clé. On les sépare ici,
          au lieu de laisser deviner. */}
      {srv && !srv.pret && (
        <div data-push-serveur="pas-pret" style={{display:'flex',gap:8,alignItems:'flex-start',padding:'9px 11px',borderRadius:12,border:`1px solid ${C.warn}55`,background:`${C.warn}12`,marginBottom:10}}>
          <Icon name="alert" size={16} style={{color:C.warn,flexShrink:0,marginTop:1}}/>
          <div style={{fontSize:12,color:C.text,lineHeight:1.45,minWidth:0}}>
            {proprio ? <><b>Le serveur ne peut envoyer aucune notification</b> : sa clé manque. Activer ici ne changerait rien.</>
              : <span data-push-vendeur=""><b>Les notifications ne sont pas encore activées sur VRM.</b> Activer ici ne changerait rien pour l'instant ; tu n'as rien à faire.</span>}
            {/* ⚠️ UNE ALERTE QUI NE DIT PAS QUOI FAIRE NE SERT À RIEN. Julien n'est
                pas développeur : la marche à suivre doit être exacte, dans l'ordre,
                avec le nom du réglage à taper. */}
            {proprio && <details className="vrm-repli" style={{marginTop:7}}><summary>Ce qu'il faut faire, une seule fois</summary>
              <div>1. Ouvrir <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" style={{color:C.accentTexte,fontWeight:600}}>Vercel → projet de l'installation → Settings → Environment Variables</a></div>
              <div>2. Ajouter la variable <code style={{fontSize:11}}>VAPID_PRIVATE_KEY</code> avec la clé privée que je t'ai donnée</div>
              <div>3. Redéployer (Deployments → ⋯ → Redeploy)</div>
              <div style={{marginTop:4,color:C.muted}}>La clé privée ne peut pas vivre dans le code : le dépôt est public, n'importe qui pourrait envoyer des notifications sur ton téléphone.</div>
            </details>}
          </div>
        </div>
      )}
      {srv && srv.pret && (
        <div style={{fontSize:12,color:C.muted,marginBottom:10}}>
          {/* (1er nov.) Sans nombre lu, la ligne disait « · appareil abonné » — lu comme
              « CET appareil est abonné », juste au-dessus d'« Activer sur cet appareil ».
              Le nombre est celui de TOUS ses appareils : on le dit. */}
          Serveur prêt à envoyer{Number.isFinite(Number(srv.devices)) && srv.devices !== null && srv.devices !== undefined
            ? <> · <b data-push-appareils={Number(srv.devices)} style={{color:C.text}}>{Number(srv.devices)}</b> appareil{Number(srv.devices)>1?'s':''} abonné{Number(srv.devices)>1?'s':''} en tout</> : null}.
        </div>
      )}
      {state!=='unsupported' && (
        <div className="vrm-b-rangee" style={{justifyContent:'flex-start'}}>
          {state!=='on' ? (
            <Bouton variante="primaire" icone="bell2" onClick={enable} disabled={state==='busy'||state==='checking'}>
              {state==='busy'?'…':'Activer sur cet appareil'}
            </Bouton>
          ) : (<>
            <Bouton variante="secondaire" onClick={test}>Envoyer un essai</Bouton>
            <Bouton variante="discret" onClick={disable}>Désactiver</Bouton>
          </>)}
        </div>
      )}
      {msg && <div style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.4}}>{msg}</div>}
    </div>
  );
}

// ── ÉCRAN QUI TOMBE ≠ APPLICATION QUI TOMBE ───────────────────────────────────
// ⚠️ Sans garde-fou, UNE erreur de rendu dans un seul écran vide la page
// entière : écran blanc, barre du bas comprise (§19 : un useMemo lu trop tôt ;
// §26 : une variable jamais déclarée). L'ancien `EcranGardeFou` (un seul, autour
// de toute la zone des écrans) est remplacé le 6 nov. par `GardeEcran`
// (src/composants/GardeEcran.jsx) : un par écran, un par feuille plein écran,
// et celui de la coque — même message, même notation dans le journal.

// ── SÉCURITÉ DES DONNÉES : L'ÉTAT RÉEL, MESURÉ ────────────────────────────────
// Trois verrous doivent être en place pour que « chacun ses données » soit vrai.
// Ils étaient décrits dans la documentation, donc invérifiables depuis l'app —
// et un verrou qu'on croit posé est pire qu'un verrou absent. Chacun est
// SONDÉ pour de bon, et chaque ligne dit quoi faire s'il manque.
function SecuriteSetting() {
  // (1er nov.) Les consignes Vercel/Supabase de ce panneau : au propriétaire seul.
  const proprio = useEstProprietaire();
  const [st, setSt] = useState(null);
  const [ext, setExt] = useState(undefined);   // undefined = pas encore demandé
  const [copie, setCopie] = useState('');
  const [srv, setSrv] = useState(null);   // état des routes serveur (clé de service, propriétaire)
  // ⚠️ UN SONDAGE RATÉ RESTE `null` — il ne devient pas un diagnostic. `{}`
  //    rendait `srv !== null`, donc « clé de service manquante » alors qu'on
  //    n'avait rien mesuré (route injoignable, 404, réponse HTML d'un 522).
  //    Seul `ok:true` est une mesure.
  useEffect(() => { fetch('/api/sante').then(r=>r.json()).then(j=>setSrv(j && j.ok === true ? j : null)).catch(()=>setSrv(null)); }, []);
  useEffect(() => { (async () => {
    const out = { colonne: null, lisibleSansCompte: null, ecritureSansCompte: null, jetonsLisibles: null, mailAuto: null };
    // 1. La colonne `owner` existe-t-elle ? SEUL un 400 « column does not
    //    exist » répond NON. ⚠️ `out.colonne = res.ok` faisait répondre non à
    //    TOUT échec : le 10 septembre, base injoignable (522), ce panneau
    //    affichait « Propriétaire des lignes · colonne absente » et le bouton
    //    « Copier la migration SQL » — un diagnostic et son remède sur une
    //    mesure qui n'avait pas eu lieu. « Pas su » ne vaut pas « non ».
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: sbAuth() });
      out.colonne = r.ok ? true : (r.status === 400 ? false : null);
    }
    catch (_) { out.colonne = null; }
    // 2. ⚠️ LE PIÈGE : la colonne peut exister sans que RLS soit actif. On teste
    //    donc ce qui compte vraiment — une lecture avec la clé PUBLIQUE seule
    //    ramène-t-elle encore des lignes ? Si oui, tout le monde lit tout.
    // §11 : la règle vit dans `sondeLectureSansCompte`, la porte d'entrée lit
    // la MÊME. Elle rend trois états, dont `null` = pas su — c'était le feu
    // vert menteur du 11 septembre (`: false` sur tout échec).
    out.lisibleSansCompte = await sondeLectureSansCompte();
    // 2 bis. ⚠️⚠️ ET LIRE N'EST PAS LE PIRE — MESURÉ LE 15 SEPTEMBRE.
    //    La clé publique peut aussi ÉCRIRE : un `POST` sur `app_data` avec elle
    //    seule répond **201**. Lire, c'est regarder ; écrire, c'est remplacer
    //    ses numéros de rangement, ses bordereaux, ses comptes — et effacer.
    //    Le panneau ne disait que la lecture : il décrivait donc le moindre des
    //    deux risques sur l'écran qui sert à décider si ses données sont
    //    protégées.
    //    ⚠️ ON NE SONDE PAS EN ÉCRIVANT (§2.3 : aucune ligne de test dans la
    //    base de production).
    //    ⚠️⚠️ L'ANCIENNE SONDE (un `PATCH` sur un identifiant inexistant) NE
    //    POUVAIT PAS DIRE « FERMÉ » : mesuré le 2 octobre, base fermée, RLS
    //    filtre EN SILENCE et répond 200 + `[]` — exactement comme une base
    //    ouverte. Le panneau aurait annoncé « tout écrire et effacer » sur une
    //    base verrouillée.
    //    ⇒ On envoie DEUX FOIS la même ligne en un seul envoi. Base ouverte : la
    //    première passe, la seconde heurte la clé → 409 et Postgres annule TOUT
    //    l'envoi (rien n'est écrit). Base fermée : la règle refuse dès la
    //    première → 401/403. Vérifié dans la base : 23505 / 42501, 0 ligne.
    try {
      const sonde = { id: '__sonde_droits_ecriture__', data: {} };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify([sonde, sonde]),
      });
      out.ecritureSansCompte = r.status === 409 ? true : ((r.status === 401 || r.status === 403) ? false : null);
    } catch (_) { out.ecritureSansCompte = null; }
    // 2 ter. ⚠️⚠️ LE PIRE DE TOUS, ET AUCUNE SONDE NE LE REGARDAIT : la table
    //    `vinted_accounts` porte les JETONS de ses neuf comptes
    //    (`access_token`, `refresh_token`, `csrf_token`), et la clé publique la
    //    lit — mesuré, elle répond 200. Qui les a n'a pas besoin de son mot de
    //    passe : il EST lui sur Vinted. Les trois autres sondes parlaient de
    //    `app_data` uniquement.
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=id&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      out.jetonsLisibles = r.ok ? (await r.json()).length > 0
        : ((r.status === 401 || r.status === 403) ? false : null);
    } catch (_) { out.jetonsLisibles = null; }
    // 3. Création de compte : faut-il un email de confirmation ? (le serveur de
    //    test Supabase n'en envoie que quelques-uns par heure)
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
      if (r.ok) { const j = await r.json(); out.mailAuto = !!j.mailer_autoconfirm; }
    } catch (_) { out.mailAuto = null; }
    setSt(out);
    setExt(await vmrAuthEtat());
  })(); }, []);
  const copier = async (txt, quoi) => {
    try { await navigator.clipboard.writeText(txt); setCopie(quoi); setTimeout(()=>setCopie(''), 2200); } catch (_) {}
  };
  // Ce qu'on écrit quand la sonde n'a pas répondu : jamais un diagnostic.
  const PAS_SU = "Le sondage n'a pas abouti (réseau, ou base injoignable). Rouvre cet écran pour réessayer.";
  // Un état « OK » s'écrit à l'encre, sans couleur (§7) : INV_STATUS.online.color est le vert
  // #0F8A6A de l'ancienne palette menthe (banc formes-communes, 22 oct.).
  const Ligne = ({ t, ok, etat, d, action }) => (
    <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 0',borderTop:`1px solid ${C.border}`}}>
      <span style={{flexShrink:0,marginTop:2,display:'inline-flex',color: ok == null ? C.muted : ok ? C.text : C.warn}}>
        <Icon name={ok == null ? 'clock' : ok ? 'check' : 'alert'} size={14}/>
      </span>
      <div style={{minWidth:0,flex:'1 1 140px'}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{t} <span style={{fontWeight:500,color: ok == null ? C.muted : ok ? C.text : C.warn}}>· {etat}</span></div>
        <div style={{fontSize:12,color:C.muted,lineHeight:1.45,marginTop:2}}>{d}</div>
        {action}
      </div>
    </div>
  );
  const s = st || {};
  // ⚠️ LE VERDICT PORTE SUR LES QUATRE, pas sur la lecture seule : une base
  // qu'on peut encore ÉCRIRE, ou dont les jetons Vinted se lisent, n'est pas
  // cloisonnée — même si `app_data` finissait par se fermer en lecture.
  const proteges = s.colonne === true && s.lisibleSansCompte === false
    && s.ecritureSansCompte === false && s.jetonsLisibles === false;
  // « Je ne sais pas » n'est ni « cloisonnées » ni « partagées ».
  const sondeInconnue = s.colonne == null || s.lisibleSansCompte == null
    || s.ecritureSansCompte == null || s.jetonsLisibles == null;
  return (
    <div style={{border:`1px solid ${proteges || sondeInconnue ? C.border : C.warn + '66'}`,background:C.card,borderRadius:12,padding:'12px 14px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
        {/* Le titre du sous-écran (téléphone) le dit déjà : caché là par CSS (§7) ;
            le verdict à côté reste. Sur ordinateur, c'est le seul titre du panneau. */}
        <div className="vrm-titre-panneau" style={{fontSize:13,fontWeight:600,color:C.text}}>Sécurité des données</div>
        <span style={{fontSize:11,fontWeight:600,color:sondeInconnue?C.muted:proteges?C.text:C.warn,background:(sondeInconnue?C.muted:proteges?C.text:C.warn)+'18',borderRadius:12,padding:'1px 8px'}}>
          {st === null ? 'vérification…' : sondeInconnue ? 'pas encore vérifié' : proteges ? 'cloisonnées' : 'partagées'}
        </span>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:4,lineHeight:1.45}}>
        Vérifié en direct sur ta base, à chaque ouverture.
      </div>
      <Ligne t="Propriétaire des lignes" ok={s.colonne}
        etat={s.colonne == null ? 'pas encore vérifié' : s.colonne ? 'colonne présente' : 'colonne absente'}
        d={s.colonne == null ? PAS_SU : s.colonne ? "Chaque ligne peut être attribuée à un vendeur."
          : "Sans elle, un deuxième compte ouvrirait TA boutique. À corriger par la migration SQL (Supabase → SQL Editor)."}
        action={s.colonne === false && (
          <Bouton variante="secondaire" icone={copie==='sql' ? undefined : 'doc'} className="vrm-b-petit" onClick={()=>copier(MIGRATION_SQL, 'sql')} style={{marginTop:7}}>
            {copie==='sql' ? '✓ Copié — colle-le dans Supabase → SQL Editor' : 'Copier la migration SQL'}
          </Bouton>)}/>
      {/* ⚠️ UNE CAUSE, UNE LIGNE (§7). Lire, écrire et les jetons Vinted, c'est
          le MÊME verrou manquant (RLS) : trois lignes d'alerte pour un seul
          geste se liraient comme trois problèmes. Mais les trois faits sont
          DIFFÉRENTS — écrire, c'est remplacer et effacer ; les jetons, c'est
          être lui sur Vinted — donc la ligne les dit tous les trois, mesurés.
          ⚠️ Et chacun garde ses trois états : une sonde qui n'a pas répondu ne
          doit ni accuser ni rassurer. */}
      {(() => {
        const su = [s.lisibleSansCompte, s.ecritureSansCompte, s.jetonsLisibles];
        const inconnu = su.some((v) => v == null);
        const ouverts = [
          s.lisibleSansCompte === true ? 'tout lire' : null,
          s.ecritureSansCompte === true ? 'tout écrire et effacer' : null,
          s.jetonsLisibles === true ? 'lire les jetons de tes comptes Vinted' : null,
        ].filter(Boolean);
        // Ce qui n'a pas pu être mesuré est nommé, jamais compté comme fermé.
        const pasSus = [
          s.lisibleSansCompte == null ? 'la lecture' : null,
          s.ecritureSansCompte == null ? 'l’écriture' : null,
          s.jetonsLisibles == null ? 'les jetons Vinted' : null,
        ].filter(Boolean);
        return (
          <Ligne t="Accès sans compte"
            ok={inconnu ? null : ouverts.length === 0}
            etat={inconnu ? 'pas encore vérifié' : ouverts.length === 0 ? 'fermé' : ouverts.length === 3 ? 'tout est ouvert' : 'partiellement ouvert'}
            d={inconnu
              ? `${PAS_SU} (${pasSus.join(' · ')})`
              : ouverts.length === 0
                ? "La clé publique ne ramène plus rien et n'écrit plus rien : seule une session identifiée touche tes données."
                : <>La clé publique — celle qui est <b>visible dans le code de la page</b> — permet encore de <b>{ouverts.join(', ')}</b>. Le verrou qui manque : RLS.{s.jetonsLisibles === true ? <> Un jeton Vinted vaut le compte lui-même.</> : null}</>}/>
        );
      })()}
      <Ligne t="Création de compte" ok={s.mailAuto == null ? null : s.mailAuto === true}
        etat={s.mailAuto == null ? 'pas encore vérifié' : s.mailAuto ? 'immédiate' : 'e-mail de confirmation exigé'}
        d={s.mailAuto == null ? PAS_SU : s.mailAuto ? "Un nouveau compte est utilisable tout de suite."
          : "Lien de confirmation exigé. Pas reçu ? Vérifie les indésirables, puis redemande-le depuis la connexion."}/>
      {/* ⚠️ LA MOITIÉ SERVEUR DU CLOISONNEMENT. Les emails, les rappels
          d'expédition et les notifications sont écrits par des routes qui
          tournent SANS vendeur connecté : sans clé de service elles ne
          pourront plus rien écrire dès que RLS est actif, et sans propriétaire
          leurs lignes n'appartiendront à personne (email reçu la nuit =
          silencieusement perdu). C'est le vrai blocage à lever AVANT la
          migration, et il ne se voit nulle part ailleurs. */}
      <Ligne t="Routes serveur (e-mails, rappels)" ok={srv === null ? null : !!(srv.serviceKey && srv.owner)}
        etat={srv == null ? 'pas encore vérifié' : srv.serviceKey && srv.owner ? 'prêtes' : srv.serviceKey ? 'propriétaire manquant' : 'clé de service manquante'}
        d={srv == null ? PAS_SU : srv.serviceKey && srv.owner
          ? "Elles écriront sous ton compte une fois la base cloisonnée."
          : !proprio ? "Pas encore activé sur VRM : c'est réglé de notre côté, tu n'as rien à faire."
          : "AVANT la migration, dans Vercel → Settings → Environment Variables : SUPABASE_SERVICE_KEY (Supabase → Settings → API → service_role) et VRM_OWNER_UID. Sans ça, e-mails et rappels ne seront plus enregistrés."}/>
      <Ligne t="Extension identifiée" ok={ext === undefined ? null : !!(ext && ext.connecte)}
        etat={ext === undefined ? '…' : !ext ? 'extension absente ici' : ext.connecte ? (ext.email || 'connectée') : 'pas connectée'}
        d={!ext ? "Normal sur téléphone. Sur l'ordinateur, ouvre l'app dans le navigateur de l'extension."
          : ext.connecte ? "Elle écrira sous ce compte."
          : `Icône de l'extension ${NAV.dansNu} → Compte VRM → ton e-mail et ton mot de passe.`}/>
      {/* (6 nov., v36) Les temps réels des vendeurs, anonymes et agrégés (src/composants/MesuresTerrain.jsx) :
          au propriétaire de l'installation seulement (la route refuse les autres). */}
      {proprio ? <MesuresTerrain entetes={enTeteSession} Bouton={Bouton} PanneEl={EtatPanne} nomEcran={nomEcranVeille}/> : null}
      {/* (8 nov.) Les alertes de plantage groupées (src/composants/PlantagesTerrain.jsx) : propriétaire seul. */}
      {proprio ? <PlantagesTerrain entetes={enTeteSession} PanneEl={EtatPanne}/> : null}
    </div>
  );
}
// ⟦← App.jsx #45⟧
// La forme acceptée pour une adresse de réception (saisie à la main OU
// suggérée) : une seule règle.
const ADRESSE_RECEPTION_OK = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

// ── LES ADRESSES OÙ ARRIVENT DÉJÀ TES EMAILS ─────────────────────────────────
// Mesuré le 6 octobre (lecture seule, sa vraie base) : parmi les lignes
// `email_*`, SEULES `email_inconnu_*` gardent l'adresse de destination — le
// champ `to` (l'en-tête « À », 1 053 lignes sur 1 053, 17 formes, dont
// « Hide My Email <…@icloud.com> »). C'est l'un des champs que lit la règle
// d'arrivée (`adressesDeLivraison`) : la déclarer suffit à ce que les emails
// suivants lui reviennent. Une IDENTITÉ — l'adresse où ses propres emails sont
// arrivés —, jamais une ressemblance.
// ⚠️ SES lignes seulement (session, RLS) : jamais les adresses du tas mis de
//    côté, qui peuvent être celles d'un autre vendeur.
// ⚠️ Des suggestions, pas un total : les 1 000 plus récentes suffisent (§4.5
//    vaut pour un total ; aucun n'est affiché ici). Scalaire `meta->>to` : la
//    ligne porte jusqu'à 200 Ko d'email brut, jamais rapatrié (§4.4).
// Rend un tableau `{ adresse, n, dernier }` (le plus fréquent d'abord), ou
// `null` si la lecture a échoué — rien n'est alors suggéré, rien n'est affirmé.
async function lireAdressesVues() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.email_inconnu_*&select=to:meta->>to,quand:meta->>receivedAt&order=meta->>receivedAt.desc&limit=1000`, { headers: sbAuth() });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    const vues = {};
    for (const x of j) {
      for (const brut of String((x && x.to) || '').split(/[,;]/)) {
        const a = normAdresse(brut);
        if (!a || !ADRESSE_RECEPTION_OK.test(a)) continue;
        const v = vues[a] || (vues[a] = { adresse: a, n: 0, dernier: '' });
        v.n++;
        if (String((x && x.quand) || '') > v.dernier) v.dernier = String(x.quand || '');
      }
    }
    return Object.values(vues).sort((a, b) => b.n - a.n || (a.dernier < b.dernier ? 1 : -1));
  } catch (_) { return null; }
}
// ── LES ADRESSES PROUVÉES (22 octobre) ────────────────────────────────────────
// Une adresse déclarée ne suffit plus (base cloisonnée) : VRM envoie un lien À
// CETTE adresse, et c'est le clic, depuis la session du vendeur, qui la prouve
// (api/_lib/preuve-adresse.js). Le SERVEUR décide l'état de chaque adresse ;
// l'écran l'écrit tel quel (§11). Trois états de lecture : `undefined` en cours ·
// `null` pas su · objet lu `{ cloisonnee, installation, adresses, collecteur }`.
async function lirePreuvesAdresses() {
  try {
    const r = await fetch('/api/email-rattacher?mode=preuves', { headers: { ...enTeteSession() }, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok && j.adresses && typeof j.adresses === 'object' ? j : null;
  } catch (_) { return null; }
}
// Demande un lien pour UNE adresse. Rend `{ etat, message }` (etat `null` = pas su).
// `essai` (1er nov.) : un relais Apple, sur SA demande — le lien part quand même.
async function demanderPreuveAdresse(adresse, essai) {
  try {
    const r = await fetch('/api/email-rattacher?mode=preuve-demander', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify(essai === true ? { adresse, essai: true } : { adresse }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.ok) return { etat: j.etat, via: j.via || null, message: '' };
    if (r.status === 422) return { etat: 'impossible', message: j.message || '' };
    if (r.status === 429 || r.status === 409) return { etat: 'refus', message: j.message || '' };
    return { etat: null, message: (j && j.message) || "Le serveur n'a pas répondu — rien n'est perdu, réessaie dans un moment." };
  } catch (_) { return { etat: null, message: 'Réseau indisponible — réessaie.' }; }
}
// Ce qu'une ligne d'adresse dit de son état : le mot, s'il faut agir, et le geste.
// Une cause, une phrase (§7) : l'explication générale vit UNE fois au-dessus.
const PREUVE_LIGNE = {
  prouvee: { t: 'confirmée', alerte: false, geste: '' },
  transition: { t: 'reçue — à confirmer', alerte: false, geste: 'Confirmer' },
  envoi: { t: 'lien en préparation', alerte: false, geste: '' },
  envoyee: { t: 'lien envoyé', alerte: false, geste: 'Renvoyer' },
  perimee: { t: 'lien expiré', alerte: true, geste: 'Renvoyer' },
  // (22 oct., revue) La boîte VRM n'a pas réussi à l'envoyer (3 essais) : la
  // demande sort de sa file — « Renvoyer » repart d'une demande neuve.
  echec: { t: "la boîte VRM n'a pas pu envoyer le lien — vérifie l'adresse", alerte: true, geste: 'Renvoyer' },
  aucune: { t: 'pas confirmée — ses e-mails sont mis de côté', alerte: true, geste: 'Confirmer' },
  // (1er nov.) Plus de quarantaine silencieuse : la ligne dit que ses emails sont
  // mis de côté, l'aide dessous dit pourquoi et le geste sûr, et « Essayer quand
  // même » envoie le lien (si Apple le laisse passer, l'adresse est prouvée).
  impossible: { t: "relais Apple « Masquer mon adresse » : pas confirmée — ses e-mails sont mis de côté", alerte: true, geste: 'Essayer quand même' },
};
// ⟦← App.jsx #46⟧
// (`estRelaisApple`, déclarée plus haut, sert aussi ici — une règle, §11.)
function EmailsSetting({onComptes}) {
  // ⚠️ `undefined` = en cours · `null` = la base n'a pas répondu · objet = lu.
  //    Sans ce troisième état, une lecture ratée affichait « Aucune adresse
  //    déclarée » — une AFFIRMATION sur l'attribution de ses emails, faite sur
  //    une mesure qui n'a pas eu lieu.
  const [reg, setReg] = useState(undefined);     // { adresse: {owner,label} }
  // Même trois états : `undefined` en cours · `null` pas su · objet lu (la
  // réponse de la route : `emails`, et `installation` pour le seul propriétaire).
  const misDeCote = useMisDeCote();
  const quarantaine = misDeCote ? misDeCote.emails : misDeCote;
  // Les adresses où arrivent déjà SES emails (suggestions) : `null` = pas lu.
  const [vues, setVues] = useState(null);
  const [busy, setBusy] = useState('');
  const [versionReception,setVersionReception]=useState(0);
  const proprioEmails = useEstProprietaire();
  const [rubriqueEmail,setRubriqueEmail]=useState(()=>DEMANDE_ADRESSES.on?(DEMANDE_ADRESSES.vers||'adresses'):'reception');
  const [journalFiltre,setJournalFiltre]=useState(()=>DEMANDE_ADRESSES.vers==='journal'?DEMANDE_ADRESSES.filtre:'');
  // (2 nov.) L'Aperçu ouvre le journal sur un état OU un type (« 2 bordereaux ajoutés à Colis » → les bordereaux).
  const [journalType,setJournalType]=useState('');
  const ouvrirJournal=(etat,type)=>{setJournalFiltre(etat||'');setJournalType(type||'');setRubriqueEmail('journal');requestAnimationFrame(()=>{try{racine.current&&racine.current.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){}});};
  // Les reçus d'achat qu'il a déliés (« Ce n'est pas ça ») — réversible, rien n'est supprimé.
  const [recusDelies,setRecusDelies]=useStateCle('vrm_recus_delies', ()=>load('vrm_recus_delies',{})||{});
  useEffect(()=>{const relire=()=>setRecusDelies(load('vrm_recus_delies',{})||{});const off=onCloudReady(relire);const f=e=>{if(e&&e.detail&&e.detail.k==='vrm_recus_delies')relire();};window.addEventListener('vrm:save',f);return()=>{off();window.removeEventListener('vrm:save',f);};},[]);
  const delierRecu=(id,tx)=>{const n={...recusDelies,[id]:{tx:String(tx||''),at:new Date().toISOString()}};setRecusDelies(n);save('vrm_recus_delies',n);};
  const relierRecu=(id)=>{const n={...recusDelies};delete n[id];setRecusDelies(n);save('vrm_recus_delies',n);};
  const espaceId=React.useId();
  const [adresseGuide,setAdresseGuide]=useState(''),[guideOuvert,setGuideOuvert]=useState(false);
  const configurerAdresse=adr=>{setAdresseGuide(adr);setGuideOuvert(true);requestAnimationFrame(()=>racine.current?.querySelector('.vrm-reception-parcours')?.scrollIntoView({block:'start',behavior:'smooth'}));};
  const [rechercheRattachement,setRechercheRattachement]=useState(''),[limiteRattachement,setLimiteRattachement]=useState(10);
  useEffect(()=>{const ouvrir=()=>{const v=DEMANDE_ADRESSES.vers;setRubriqueEmail(v||'adresses');if(v==='journal')setJournalFiltre(DEMANDE_ADRESSES.filtre||'');};window.addEventListener('vrm:ouvrir-adresses',ouvrir);return()=>window.removeEventListener('vrm:ouvrir-adresses',ouvrir);},[]);
  const [suiviAdresses,setSuiviAdresses]=useState(null);
  const [preuves, setPreuves] = useState(undefined);
  const [preuveBusy, setPreuveBusy] = useState('');
  const uid = (AUTH.user && AUTH.user.id) || '';
  const racine = useRef(null);
  useEffect(() => {
    if (!DEMANDE_ADRESSES.on) return;
    DEMANDE_ADRESSES.on = false;
    const t = setTimeout(() => { try { racine.current && racine.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {} }, 250);
    return () => clearTimeout(t);
  }, []);
  const charger = React.useCallback(async () => {
    try {
      // ⚠️⚠️ C'EST L'ADRESSE DE RÉCEPTION QUI DÉCIDE à quel vendeur appartient
      //    un email (§5), et cette liste se réécrit ENTIÈRE à chaque ajout.
      //    Avec `r.ok ? … : []`, un hoquet de la base pendant qu'il ouvre cet
      //    écran, puis un seul ajout, effaçait TOUTES ses autres adresses : les
      //    emails Vinted suivants (bordereaux, ventes, suivis) ne lui étaient
      //    plus attribués et partaient en quarantaine. « Rien lu » ≠ « rien ».
      const d = await lireReglage('vrm_email_owners');
      setReg(d === null ? null : (d.adresses || {}));
    } catch (_) { setReg(null); }
    // ⚠️ Une lecture ratée rendait `[]` : la section se taisait comme s'il n'y
    //    avait rien à réclamer. « Rien lu » ne vaut pas « rien ».
    lireMisDeCote();
    lireAdressesVues().then(setVues);
    lirePreuvesAdresses().then(setPreuves);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const ecrire = async (adresses) => {
    if (reg === null || reg === undefined) return;   // pas lu : on n'écrase pas la liste
    const avant = reg;
    setReg(adresses);
    // ⚠️ Une écriture REFUSÉE (la base répond, mais non) s'affichait comme
    //    réussie : l'adresse semblait déclarée, ses emails continuaient de
    //    partir de côté. On remet la liste d'avant et on le dit.
    let ok = false;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
        method: 'POST',
        headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([withOwner({ id: 'vrm_email_owners', data: { adresses, updatedAt: new Date().toISOString() } })]),
      });
      ok = !!(r && r.ok);
    } catch (_) { ok = false; }
    if (!ok) { setReg(avant); toast("La liste n'a pas pu être enregistrée — réessaie."); return false; }
    setVersionReception(v=>v+1);
    // Une adresse ajoutée (ou retirée) change ce qui t'est proposé en dessous :
    // on relit, sans attendre la prochaine ouverture de l'écran.
    lireMisDeCote();
    return true;
  };
  // ── LA PREUVE (22 octobre) : un lien part À CETTE ADRESSE ─────────────────
  const confirmerAdresse = async (adr, silencieux, essai) => {
    setPreuveBusy(adr);
    // Un relais Apple : un clic de SA part (« Essayer quand même », « Renvoyer ») envoie
    // le lien malgré tout (`essai`) ; la demande automatique, elle, ne l'envoie jamais.
    const r = await demanderPreuveAdresse(adr, essai === true || estRelaisApple(adr));
    setPreuveBusy('');
    if (!silencieux || r.etat === null) {
      if (r.etat === 'prouvee') toast(r.via === 'compte' ? `${adr} est ton adresse de connexion VRM, déjà confirmée : c'est fait.` : `${adr} est confirmée.`);
      else if (r.etat === 'envoi') toast(`Un lien de confirmation va partir vers ${adr}. Ouvre-le en étant connecté à VRM.`);
      else if (r.message) toast(r.message);
    }
    const p = await lirePreuvesAdresses(); setPreuves(p);
    if (r.etat === 'prouvee') lireMisDeCote();
    return ['prouvee','envoi','envoyee'].includes(r.etat);
  };
  // Une ou plusieurs adresses d'un coup (saisie à la main, ou suggestion).
  const ajouterAdresses = async (liste) => {
    const nouv = { ...(reg || {}) };
    let n = 0;
    for (const a of liste) {
      const adr = normAdresse(a);
      if(estAdresseCollectrice(adr)){toast('Ajoute ton adresse personnelle de réception, pas la boîte collective VRM.');continue;}
      if (!adr || !ADRESSE_RECEPTION_OK.test(adr) || Object.keys(nouv).some((k) => normAdresse(k) === adr)) continue;
      nouv[adr] = { owner: uid || '', label: '', at: new Date().toISOString() };
      n++;
    }
    if (!n) return false;
    const ok = await ecrire(nouv);
    // Déclarer une adresse envoie son lien de confirmation (base cloisonnée :
    // sinon aucune preuve n'est nécessaire). Le résultat s'écrit sur sa ligne.
    if (ok && preuves && preuves.cloisonnee) {
      const neuves = Object.keys(nouv).filter((k) => !(reg || {})[k]);
      for (const a of neuves) { if (!estRelaisApple(a)) await demanderPreuveAdresse(a); }
      setPreuves(await lirePreuvesAdresses());
    }
    return ok === true;
  };
  const ajouter = async () => {
    const a = await askText({ desc: "Tes adresses personnelles.\n\nIndique les adresses où Vinted t’écrit, avant leur transfert vers VRM. Tu peux en ajouter plusieurs, séparées par des virgules. N’indique pas la boîte collective VRM.", value: '', ok: 'Ajouter' });
    const adresses=[...new Set(String(a||'').split(/[,;\n]+/).map(normAdresse).filter(Boolean))];
    if(!adresses.length)return;
    if(adresses.some(adr=>!ADRESSE_RECEPTION_OK.test(adr))){toast('Une adresse est incorrecte — vérifie la liste avant de l’ajouter.');return;}
    if(adresses.some(estAdresseCollectrice)){toast('Ajoute tes adresses personnelles, pas la boîte collective VRM.');return;}
    if(adresses.every(adr=>Object.keys(reg||{}).some(k=>normAdresse(k)===adr))){toast('Ces adresses sont déjà dans ta liste.');return;}
    await ajouterAdresses(adresses);
  };
  const retirer = async (adr) => {
    const ok = await askConfirm({ title: `Retirer ${adr} ?`, desc: "Les e-mails qui arriveront ensuite sur cette adresse ne te seront plus attribués : ils seront mis de côté en attendant que tu les réclames. Rien de déjà reçu n'est supprimé.", ok: 'Retirer', danger: true });
    if (!ok) return;
    const u = { ...(reg || {}) }; delete u[adr]; await ecrire(u);
  };
  const rejouerUn = async (id, silencieux) => {
    const r = await fetch('/api/email-rattacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(AUTH.session && AUTH.session.access_token ? { Authorization: `Bearer ${AUTH.session.access_token}` } : {}) },
      body: JSON.stringify({ id, silencieux: !!silencieux }),
    });
    const j = await r.json().catch(() => ({}));
    return !!(j && j.ok);
  };
  const rattacher = async (id) => {
    setBusy(id);
    try {
      const ok = await rejouerUn(id, false);
      toast(ok ? 'E-mail rattaché — il apparaît maintenant dans tes écrans.' : "Ce mail n'a pas pu être rattaché (format non reconnu). Il reste conservé.");
    } catch (_) { toast('Réseau indisponible — réessaie.'); }
    setBusy(''); charger();
  };
  // ── TOUT REJOUER ────────────────────────────────────────────────────────────
  // Après l'incident du 16→22 août (§5.43), 593 emails s'étaient accumulés ici
  // alors qu'ils auraient dû être traités : les colis à retirer, leurs QR et
  // leurs codes n'apparaissaient nulle part. Ce bouton les repasse dans le même
  // traitement que s'ils venaient d'arriver.
  // ⚠️ UN PAR UN, en attendant la réponse : on ne lâche pas 600 requêtes d'un
  //    coup sur la fonction serveur. Et `silencieux` coupe les notifications —
  //    sinon c'est 600 alertes pour des choses déjà faites.
  const [lot, setLot] = useState(null);   // { fait, total, ok } pendant le rejeu
  const toutRejouer = async () => {
    const ids = (quarantaine || []).map(q => q.id);
    if (!ids.length) return;
    const go = await askConfirm({
      title: `Rejouer ${ids.length} e-mail${ids.length > 1 ? 's' : ''} ?`,
      desc: "Ils repassent dans le traitement normal : colis à retirer avec leur QR et leur code, bordereaux, ventes, offres.\n\nAucune notification ne sera envoyée, et rien n'est supprimé tant que le traitement n'a pas abouti.",
      ok: 'Tout rejouer',
    });
    if (!go) return;
    let ok = 0;
    setLot({ fait: 0, total: ids.length, ok: 0 });
    for (let i = 0; i < ids.length; i++) {
      try { if (await rejouerUn(ids[i], true)) ok++; } catch (_) {}
      setLot({ fait: i + 1, total: ids.length, ok });
    }
    setLot(null);
    toast(`${ok} e-mail${ok > 1 ? 's' : ''} traité${ok > 1 ? 's' : ''} sur ${ids.length}.`);
    charger();
  };
  const liste = Object.keys(reg || {});
  const enAttente = Array.isArray(quarantaine) ? quarantaine : [];
  const motsRattachement=rechercheRattachement.trim().toLocaleLowerCase('fr-FR');
  const rattachementsVisibles=enAttente.filter(q=>!motsRattachement||[q.sujet,q.raison].join(' ').toLocaleLowerCase('fr-FR').includes(motsRattachement));
  // ── CE QUE LA ROUTE DIT AU SEUL PROPRIÉTAIRE DE L'INSTALLATION ─────────────
  const inst = (misDeCote && misDeCote.installation) || null;
  const pers = inst ? phrasePersonne(inst.personne) : null;
  // ⚠️⚠️ « Aucune adresse déclarée… les emails reçus sont attribués au
  //    propriétaire de cette installation » s'affichait QUOI QU'IL ARRIVE —
  //    y compris quand un autre compte avait déclaré la sienne, c'est-à-dire
  //    quand ce repli ne jouait PLUS et que ses emails partaient de côté. La
  //    phrase suit ce que la règle d'arrivée fait vraiment (la route le dit) ;
  //    sans réponse, elle n'affirme rien sur l'attribution.
  const vide = (misDeCote && misDeCote.cloisonnee === false)
      ? { t: "Aucune adresse déclarée. Cette installation n'a qu'une boutique : tous les e-mails reçus y sont rangés.", alerte: false }
    : inst && inst.repli === true
      ? { t: "Aucune adresse déclarée. Personne d'autre n'en a déclaré : pour l'instant, les e-mails reçus te reviennent (tu es le propriétaire de cette installation). Dès qu'un autre compte déclarera la sienne, un e-mail arrivé sur une adresse que tu n'as pas déclarée sera mis de côté — déclare les tiennes dès maintenant.", alerte: false }
    : inst && inst.repli === false
      // Le geste ne se dit qu'une fois (§7) : quand le nombre est écrit juste
      // dessous, c'est lui qui le porte.
      ? { t: "Aucune adresse déclarée — et un autre compte a déclaré les siennes : un e-mail arrivé sur une adresse que tu n'as pas déclarée ne t'est plus attribué, il est mis de côté." + (pers ? '' : ' Ajoute tes adresses de réception.'), alerte: true }
    : misDeCote
      ? { t: "Aucune adresse déclarée : tant que tu n'en déclares aucune, aucun e-mail ne t'est attribué. Ajoute ton adresse personnelle, celle où Vinted t’écrit avant le transfert vers VRM.", alerte: true }
      : { t: "Aucune adresse déclarée. Ajoute ton adresse personnelle, celle où Vinted t’écrit avant le transfert vers VRM.", alerte: false };
  // ── L'état de preuve de chaque adresse, tel que le SERVEUR le décide ──────
  const etatsPreuve = preuves && preuves.cloisonnee ? (preuves.adresses || {}) : null;
  const etatDe = (adr) => (etatsPreuve ? (etatsPreuve[normAdresse(adr)] || null) : null);
  const aConfirmer = liste.filter((a) => { const e = etatDe(a); return e && e.etat !== 'prouvee'; });
  const enPreparation = liste.some((a) => (etatDe(a) || {}).etat === 'envoi');
  const boite = preuves ? preuves.collecteur : null;               // null = pas su
  const boiteAge = boite && boite.at ? Date.now() - Date.parse(boite.at) : null;
  const dureeLisible = (ms) => { const h = ms / 3600e3; return h < 1 ? `${Math.max(1, Math.round(ms / 60000))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} jours`; };
  const phraseBoite = !enPreparation || !boite ? null
    : !boite.at ? "La boîte d'envoi de VRM n'a pas encore tourné : le lien partira dès qu'elle sera en marche."
    : boiteAge > 30 * 60000 ? `La boîte d'envoi de VRM n'a pas tourné depuis ${dureeLisible(boiteAge)} : le lien partira dès qu'elle reprend.`
    : `Il part de la boîte VRM (${ADRESSE_COLLECTRICE}) dans les prochaines minutes — regarde aussi les indésirables.`;
  const quandLisible = (d) => { const t = Date.parse(d || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };
  // Les suggestions : SES adresses déjà vues, pas encore déclarées.
  const declarees = new Set(liste.map(normAdresse));
  const sugg = Array.isArray(vues) ? vues.filter((v) => !declarees.has(v.adresse)) : [];
  // ⚠️ (22 oct., revue) La phrase qui promet suit la RÈGLE lue (§5) : pour un
  //    vendeur (base cloisonnée, pas le propriétaire), AJOUTER ne suffit plus —
  //    c'est la confirmation qui attribue. Pas su ⇒ une phrase vraie dans les
  //    deux cas, sans promesse.
  const promesse = preuves && preuves.cloisonnee && !preuves.installation ? 'confirmation'
    : preuves && (preuves.cloisonnee === false || preuves.installation) ? 'directe' : 'passu';
  const toutesSugg = async () => {
    const ok = await askConfirm({
      title: `Ajouter ${sugg.length} adresses ?`,
      desc: `${promesse === 'confirmation' ? "Un lien de confirmation part à chacune : une fois confirmée, les e-mails qui arrivent dessus te sont attribués, et ceux déjà mis de côté te sont proposés." : promesse === 'directe' ? 'Les e-mails qui arrivent dessus te seront attribués, et ceux déjà mis de côté te seront proposés.' : "Les e-mails qui arrivent dessus sont gardés entiers — rien n'est perdu."}\n\n${sugg.map((v) => v.adresse).join('\n')}`,
      ok: 'Les ajouter',
    });
    if (ok) await ajouterAdresses(sugg.map((v) => v.adresse));
  };
  return (
    <div ref={racine}>
    <EspaceEmails onglet={rubriqueEmail} onOnglet={(o)=>{if(o==='journal'){setJournalFiltre('');setJournalType('');}setRubriqueEmail(o);}} idBase={espaceId} theme={C}>
    <div id={espaceId+'-adresses'} data-email-panneau="adresses" hidden={rubriqueEmail!=='adresses'}>
    {/* (8 nov.) L'adresse de réception UNIQUE, en tête : la plus simple (rien à prouver). */}
    {rubriqueEmail==='adresses'&&<CarteAdresseReception headers={sbAuth} FermeAuRetour={FermeAuRetour} proprio={proprioEmails===true} onBoite={()=>{try{window.dispatchEvent(new CustomEvent('vrm:aller',{detail:'emails'}));}catch(_){}}}/>}
    <div data-reglage-adresses="" style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 14px'}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>Mes adresses de réception</div>
      <p className="vrm-email-intro-adresses">Ajoute les adresses où Vinted t’écrit, puis configure leur transfert vers VRM.</p>
      {/* ⚠️ (16 octobre) Julien : « je ne comprends pas à quoi ça sert ». Le
          paragraphe d'avant disait la RÈGLE (« l'adresse d'arrivée décide »)
          sans dire l'USAGE. Trois lignes visibles — à quoi ça sert, un exemple,
          ce qui se passe si une adresse manque — et le pas-à-pas replié. */}

      {reg === undefined ? <div role="status" style={{fontSize:12,color:C.muted}}>{PAS_SU.enCours}</div>
      : reg === null ? <EtatPanne compact data-adresses="pas-su" quoi="Tes adresses de réception" raison="La liste n’a pas pu être lue. Rien n’est changé : elle n’est pas réécrite tant qu’elle n’est pas lue." onReessayer={charger}/>
      : liste.length === 0 ? (
        <div data-adresses-vide={vide.alerte ? 'alerte' : 'info'} style={{fontSize:12,color:vide.alerte?C.warn:C.muted,background:vide.alerte?`${C.warn}12`:C.bg,border:`1px solid ${vide.alerte?`${C.warn}44`:C.border}`,borderRadius:12,padding:'9px 11px',lineHeight:1.45}}>
          {vide.t}
        </div>
      ) : (<>
        {/* (22 oct.) La règle de la preuve, UNE fois au-dessus des lignes (§7) ;
            sur chaque ligne il ne reste que SON état et SON geste. */}
        {aConfirmer.length > 0 && (
          <div data-preuve-explication={preuves && preuves.installation ? 'installation' : 'vendeur'} style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:'0 0 8px'}}>
            Chaque adresse se confirme une fois : VRM envoie un lien <b style={{color:C.text}}>à cette adresse</b>, et tu l'ouvres en étant connecté à VRM.{' '}
            {preuves && preuves.installation
              ? "Les tiennes restent reçues en attendant (tu es le propriétaire de cette installation) ; les confirmer les protège le jour où d'autres vendeurs rejoindront VRM."
              : "Tant qu'une adresse n'est pas confirmée, ses e-mails sont mis de côté — rien n'est perdu, ils te sont proposés dès la confirmation."}
            {phraseBoite ? <span data-preuve-boite={!boite.at ? 'jamais' : boiteAge > 30 * 60000 ? 'arretee' : 'active'}>{' '}{phraseBoite}</span> : null}
          </div>
        )}
        {preuves === null && (
          <EtatPanne compact data-preuves="pas-su" quoi="Les adresses confirmées" raison="Je n’ai pas pu vérifier lesquelles le sont. Rien n’est perdu." onReessayer={async()=>{ setPreuves(undefined); setPreuves(await lirePreuvesAdresses()); }}/>
        )}
        {liste.map(adr => { const ep = etatDe(adr); const lp = ep ? PREUVE_LIGNE[ep.etat] : null;
          // « Renvoyer » seulement quand le serveur l'accepterait (10 min après la demande).
          const renvoiPermis = !ep || !ep.demandeLe || Date.now() - Date.parse(ep.demandeLe) > 10 * 60000;
          const geste = lp && lp.geste && !(ep.etat === 'transition' && estRelaisApple(adr)) && (lp.geste !== 'Renvoyer' || renvoiPermis) ? lp.geste : '';
          return (
        <div key={adr} data-adresse={normAdresse(adr)} data-adresse-etat={ep ? ep.etat : (preuves === undefined ? 'lecture' : preuves === null ? 'pas-su' : 'sans-preuve')} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:`1px solid ${C.border}`,flexWrap:'wrap'}}>
          <span style={{flex:'1 1 140px',minWidth:0,fontSize:12,color:C.text,overflowWrap:'anywhere'}}>
            <span style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:2}}>{((suiviAdresses?.owner===uid?suiviAdresses.adresses:[])||[]).find(a=>a.adresse===normAdresse(adr))?.comptes?.length ? ((suiviAdresses?.owner===uid?suiviAdresses.adresses:[])||[]).find(a=>a.adresse===normAdresse(adr)).comptes.map(compte=><span key={compte.id} style={{display:'inline-flex',alignItems:'center',gap:5}}><b style={{fontSize:12}}>{compte.nom}</b>{compte.bloque&&<span title="Bannissement confirmé par le profil Vinted ; les données VRM restent accessibles" style={{fontSize:11,color:C.muted,border:`1px solid ${C.border}`,borderRadius:6,padding:'0 5px'}}>Bloqué</span>}</span>) : <span style={{fontSize:11,color:C.muted}}>Compte à associer</span>}</span>
            <span style={{fontSize:12,color:C.muted}}>{adr}</span>
            {lp && (
              <span data-adresse-preuve={ep.etat} data-adresse-retenue={ep.retenue ? 'oui' : 'non'} style={{display:'flex',alignItems:'center',gap:5,marginTop:3,fontSize:12,lineHeight:1.4,color:lp.alerte && !ep.retenue ? C.warn : C.muted}}>
                {ep.etat === 'prouvee' && <span aria-hidden="true" style={{display:'inline-flex'}}><Icon name="check" size={12}/></span>}
                <span>{lp.t}{ep.etat === 'prouvee' && ep.via === 'compte' ? ' (ton adresse de connexion VRM)' : ''}{ep.etat === 'envoyee' && ep.envoyeLe ? ` le ${quandLisible(ep.envoyeLe)} — ouvre-le depuis cette boîte` : ''}{ep.etat === 'transition' && estRelaisApple(adr) ? ' (relais Apple : aucun lien ne peut y arriver, elle reste à toi)' : ''}</span>
              </span>
            )}
            {ep && estRelaisApple(adr) && !['prouvee', 'transition'].includes(ep.etat) && (
              <span data-relais-apple-aide={ep.etat} style={{display:'block',marginTop:4,fontSize:12,lineHeight:1.45,color:C.muted}}>
                Pourquoi : Apple n'accepte en principe sur ce relais que les e-mails de Vinted — le lien de VRM risque de ne pas y arriver, et tant que l'adresse n'est pas confirmée, ses e-mails sont mis de côté (rien n'est perdu, ils te reviennent dès la confirmation).
                {' '}<b style={{color:C.text}}>Le plus sûr</b> : sur Vinted, Paramètres → Compte → E-mail, mets ton adresse habituelle (Gmail, Outlook…), puis ajoute-la ici et confirme-la. Tu peux aussi essayer d'envoyer le lien quand même.
              </span>
            )}
          </span>
          <button type="button" className="vrm-email-configurer" aria-label={`Configurer le transfert de ${adr}`} onClick={()=>configurerAdresse(adr)}>Configurer</button>
          {geste && (
            <button type="button" data-confirmer-adresse={normAdresse(adr)} disabled={preuveBusy === adr} onClick={()=>confirmerAdresse(adr, false)} aria-label={`${geste} ${adr}`}
              className="vrm-b vrm-b-secondaire vrm-b-petit" style={{flexShrink:0}}>{preuveBusy === adr ? '…' : geste}</button>
          )}
          <button type="button" onClick={()=>retirer(adr)} aria-label={`Retirer ${adr}`}
            className="vrm-b vrm-b-discret" style={{flexShrink:0}}>Retirer</button>
        </div>
      ); })}
      </>)}
      {/* ── CE QUE PERSONNE NE PEUT RÉCUPÉRER (le seul propriétaire le voit) ──
          Le nombre et la cause, jamais le contenu : ce tas peut contenir les
          e-mails d'un autre vendeur. Placé AVANT les suggestions : on lit le
          problème, puis le geste qui le règle juste dessous. */}
      {pers && (
        <div data-personne={inst.personne.n} style={{marginTop:12,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
          <div style={{fontSize:13,fontWeight:600,color:C.warn,marginBottom:3}}>{pers.titre}</div>
          {pers.lignes.map((l) => <div key={l} style={{fontSize:12,color:C.muted,lineHeight:1.45}}>{l}</div>)}
          <div style={{fontSize:12,color:C.muted,lineHeight:1.45,marginTop:3}}>Conservés entiers — rien n'est perdu.</div>
        </div>
      )}
      {inst && inst.personne === null && (
        <div data-personne="pas-su" style={{marginTop:10,fontSize:12,color:C.muted,lineHeight:1.45}}>
          Je n'ai pas pu compter les e-mails mis de côté que personne ne peut récupérer — rouvre cet écran dans un moment.
        </div>
      )}
      {/* ── SES ADRESSES DÉJÀ VUES, ajoutables d'un clic ──────────────────
          Lues sur SES e-mails déjà rangés (jamais sur le tas mis de côté) : une
          identité, pas une ressemblance. Le nombre et la date l'aident à
          reconnaître les siennes. Rien quand la lecture a échoué (on ne
          suggère pas sur du vide) ni quand le registre n'est pas lu (on ne
          pourrait pas l'écrire). */}
      {reg && sugg.length > 0 && (
        <div data-suggestions={sugg.length} style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>Adresses où arrivent déjà tes e-mails</div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:'2px 0 4px'}}>Vues sur tes e-mails rangés. Ajoute celles qui sont à toi.</div>
          {sugg.slice(0, 8).map((v) => (
            <div key={v.adresse} data-suggestion={v.adresse} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:`1px solid ${C.border}`}}>
              <span style={{flex:'1 1 140px',minWidth:0}}>
                <span style={{display:'block',fontSize:13,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.adresse}</span>
                <span style={{display:'block',fontSize:11,color:C.muted,marginTop:1}}>
                  {v.n} email{v.n>1?'s':''}{v.dernier ? ` · dernier le ${new Date(v.dernier).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}` : ''}
                </span>
              </span>
              <button type="button" onClick={()=>ajouterAdresses([v.adresse])} aria-label={`Ajouter ${v.adresse}`}
                className="vrm-b vrm-b-secondaire vrm-b-petit" style={{flexShrink:0}}>Ajouter</button>
            </div>
          ))}
          {sugg.length > 1 && (
            <button type="button" onClick={toutesSugg} className="vrm-b vrm-b-discret" style={{marginTop:6}}>
              Les ajouter toutes ({sugg.length})
            </button>
          )}
        </div>
      )}
      <button type="button" onClick={ajouter} disabled={reg === null || reg === undefined}
        className="vrm-b vrm-b-secondaire" style={{marginTop:10}} title={reg ? undefined : 'Tes adresses ne sont pas encore lues'}>
        + Ajouter une adresse
      </button>
      <details className="vrm-email-aide-adresses"><summary>Comprendre les adresses et le transfert</summary>
      <div data-adresses-explication="" style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',margin:'6px 0 12px'}}>
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr',columnGap:9,rowGap:6,fontSize:13,lineHeight:1.45,color:C.text}}>
          <span aria-hidden="true" style={{color:C.accentTexte,marginTop:2}}><Icon name="mail" size={14}/></span>
          <span>VRM range tes e-mails Vinted (bordereaux, ventes, colis) dans ta boutique <b>grâce à l'adresse où ils arrivent</b>.</span>
          <span aria-hidden="true" style={{color:C.muted,marginTop:2}}><Icon name="check" size={14}/></span>
          <span><span style={{color:C.muted}}>Exemple :</span> Vinted t'écrit sur <b style={{whiteSpace:'nowrap'}}>tonnom@exemple.fr</b> → ajoute cette adresse ici.</span>
          <span aria-hidden="true" style={{color:C.muted,marginTop:2}}><Icon name="clock" size={14}/></span>
          <span data-adresses-promesse={promesse}>{promesse === 'confirmation'
            ? "Une adresse manque, ou n'est pas encore confirmée ? Ses e-mails sont mis de côté, gardés entiers — ils te sont proposés ici dès que tu l'as ajoutée puis confirmée."
            : promesse === 'directe'
              ? "Une adresse manque ? Ses e-mails sont mis de côté, gardés entiers — ils te sont proposés ici dès que tu l'ajoutes."
              : "Une adresse manque ? Ses e-mails sont mis de côté, gardés entiers — rien n'est perdu."}</span>
        </div>
        <div data-adresse-transfert-vrm="" style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,marginTop:10,fontSize:12}}><span>Adresse de transfert : <b style={{overflowWrap:'anywhere'}}>{ADRESSE_COLLECTRICE}</b></span><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(ADRESSE_COLLECTRICE);toast('Adresse de transfert copiée.');}catch(_){toast('Sélectionne l’adresse affichée pour la copier.');}}} className="vrm-b vrm-b-secondaire vrm-b-petit">Copier l’adresse</button></div>
        <details style={{marginTop:8}}>
          <summary style={{cursor:'pointer',fontSize:13,fontWeight:600,color:C.accentTexte,padding:'13px 0',minHeight:44,boxSizing:'border-box'}}>Comment faire suivre mes e-mails Vinted vers VRM&nbsp;?</summary>
          <ol style={{margin:'8px 0 0',paddingLeft:18,fontSize:12,color:C.text,lineHeight:1.5,display:'grid',gap:5}}>
            <li>Sur Vinted, dans chaque compte : <b>Paramètres → Notifications</b>, laisse les e-mails activés (ventes, bordereaux, messages).</li>
            <li>Ajoute ici <b>ton adresse personnelle</b>, celle où Vinted et les transporteurs t’écrivent. La boîte collective VRM n’est pas ton adresse personnelle.</li>
            <li>Dans Gmail : <b>Paramètres → Voir tous les paramètres → Transfert et POP/IMAP → Ajouter une adresse de transfert</b>, puis indique <b>{ADRESSE_COLLECTRICE}</b>. Dans Outlook ou iCloud, utilise une règle de transfert automatique vers cette même adresse.</li>
            <li>Google peut demander une validation à la boîte VRM : tant qu’elle n’est pas faite, le transfert n’est pas actif. Une règle de transfert manuel qui masque ton adresse personnelle peut nécessiter une vérification.</li>
            <li>Crée une règle pour <b>les e-mails Vinted et de tes transporteurs</b>, avec leurs pièces jointes. Garde une copie dans ta boîte. Le transfert général de tous tes e-mails personnels n’est pas nécessaire.</li>
            <li>Après le prochain e-mail, vérifie sa réception dans VRM. Les reçus d’achat sont dans <b>Vinted → Achats → Reçus d’achat par e-mail</b>. Un reçu reçu par e-mail ne crée pas une commande synchronisée.</li>
            <li>Adresse « Masquer mon adresse » d'Apple : sur l'iPhone, <b>Réglages → ton nom → Connexion et sécurité → Se connecter avec Apple → Vinted → Transférer à</b>.</li>
          </ol>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.45,marginTop:8}}>
            Pourquoi l'adresse et pas le contenu ? Un expéditeur ou un texte se falsifient ; l'adresse d'arrivée, non. Personne ne peut donc déposer ses e-mails dans ta boutique, et un e-mail dont l'adresse n'est déclarée par personne n'est jamais donné au hasard.
          </div>
        </details>
      </div>
      </details>
    </div>
    </div>
    {/* (31 oct.) Monté seulement quand on le regarde : aucune lecture pour un
        onglet caché (« sauf si c'est trop lourd en données »). */}
    <div id={espaceId+'-journal'} data-email-panneau="journal" hidden={rubriqueEmail!=='journal'}>
      {rubriqueEmail==='journal'&&<JournalEmails key={journalFiltre+'|'+journalType} headers={sbAuth} filtreInitial={journalFiltre} typeInitial={journalType} delies={recusDelies} onDelier={delierRecu} onRelier={relierRecu}
        onNav={(t)=>{try{window.dispatchEvent(new CustomEvent('vrm:aller',{detail:t}));}catch(_){}}}
        onNum={(n)=>{try{window.dispatchEvent(new CustomEvent('vrm:fiche-article',{detail:String(n)}));}catch(_){}}}/>}
    </div>
    <div id={espaceId+'-reception'} data-email-panneau="reception" hidden={rubriqueEmail==='a-traiter'||rubriqueEmail==='journal'}>
      <SuiviReceptionEmails onAdresseGuide={setAdresseGuide} adresseGuide={adresseGuide} guideOuvert={guideOuvert} onFermerGuide={()=>setGuideOuvert(false)} onVoirReception={()=>setRubriqueEmail('reception')} onJournal={ouvrirJournal} onOnglet={setRubriqueEmail} section={rubriqueEmail==='adresses'?'configuration':'reception'} key={uid} owner={uid} headers={sbAuth} theme={C} version={versionReception} onAdresses={setSuiviAdresses} onComptes={onComptes} onDeclarer={ajouterAdresses} preuves={preuves} onConfirmer={adr=>confirmerAdresse(adr,false)} quarantaine={quarantaine} onVerifier={()=>{setRubriqueEmail('a-traiter');requestAnimationFrame(()=>racine.current?.querySelector('[data-emails-mis-de-cote]')?.scrollIntoView({block:'center',behavior:'smooth'}));}}/>
    </div>
    <div id={espaceId+'-a-traiter'} data-email-panneau="a-traiter" hidden={rubriqueEmail!=='a-traiter'} className="vrm-email-rattachement">
      <h3>E-mails à rattacher</h3><p>Arrivés sur une adresse que VRM ne peut pas encore relier à toi : ils sont gardés entiers. Touche « C’est à moi » sur ceux qui sont à toi.</p>
      {quarantaine===undefined&&<p role="status">Lecture des e-mails mis de côté…</p>}
      {Array.isArray(quarantaine)&&quarantaine.length===0&&<div className="vrm-email-vide">Aucun e-mail à rattacher pour le moment.</div>}
      {/* Pas su ≠ aucun. Une seule phrase, et seulement si le registre, lui, a
          été lu (sinon la pastille du dessus et le bloc de Réglages le disent). */}
      {quarantaine === null && (
        <EtatPanne data-mis-de-cote="pas-su" quoi="Les e-mails mis de côté" raison="Je n’ai pas pu vérifier s’il y en a pour toi. Rien n’est perdu." onReessayer={charger}/>
      )}
      {enAttente.length > 0 && (
        <div data-emails-mis-de-cote="" style={{marginTop:12,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>{enAttente.length} email{enAttente.length>1?'s':''} conservé{enAttente.length>1?'s':''}</div>
          <ChampRecherche className="vrm-email-recherche-champ" valeur={rechercheRattachement} onChange={v=>{setRechercheRattachement(v);setLimiteRattachement(10);}} label="Rechercher dans les e-mails à rattacher" placeholder="Sujet ou motif" voix="brut"/>
          {motsRattachement&&<p className="vrm-email-resultats">{rattachementsVisibles.length} sur {enAttente.length} · recherche appliquée</p>}
          {/* (30 oct.) Un parcours : où j'en suis, une barre, combien. */}
          {lot ? <Avancement titre={`Email ${Math.min(lot.fait + 1, lot.total)} sur ${lot.total}`} part={lot.total ? lot.fait / lot.total : 0}
              phrase="Chaque e-mail repasse dans le traitement normal. Rien n'est supprimé avant la fin."
              compte={compteAvancement({ faites: lot.ok, ratees: lot.fait - lot.ok, restent: lot.total - lot.fait, motFait: 'traité' })}
              data={{ 'data-rejeu-lot': `${lot.fait}/${lot.total}` }}/>
            : <button type="button" onClick={toutRejouer} className="vrm-b vrm-b-primaire vrm-b-plein" style={{marginBottom:10}}>
              {enAttente.length>1?`Réessayer les ${enAttente.length} e-mails`:'Réessayer cet e-mail'}
            </button>}
          {rattachementsVisibles.slice(0,limiteRattachement).map(q => (
            <div key={q.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:`1px solid ${C.border}`}}>
              <span style={{flex:'1 1 130px',minWidth:0,fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {q.sujet || '(sans sujet)'} <span style={{color:C.muted}}>· {q.raison || ''}</span>
              </span>
              <button type="button" disabled={busy===q.id || !!lot} onClick={()=>rattacher(q.id)}
                className="vrm-b vrm-b-secondaire vrm-b-petit" style={{flexShrink:0}}>
                {busy===q.id ? '…' : "C'est à moi"}
              </button>
            </div>
          ))}
          {rattachementsVisibles.length===0&&<div className="vrm-email-vide">Aucun e-mail ne correspond à cette recherche.</div>}
          {rattachementsVisibles.length>limiteRattachement&&<button type="button" className="vrm-email-suivants" onClick={()=>setLimiteRattachement(n=>n+10)}>Afficher les suivants ({rattachementsVisibles.length-limiteRattachement})</button>}
        </div>
      )}
    </div>
    </EspaceEmails>
    </div>
  );
}

function ConnexionsSetting({comptes=[],onComptes,onPlateforme}) {
  const [versionLecture,actualiser]=React.useReducer(n=>n+1,0);
  const [ext, setExt] = useState(() => ({ on: vmrExtPresent(), v: vmrExtVersion() }));
  const [mail, majMail] = useState(undefined);   // { ts, n } | 'vide' | null = en cours
  const [capt, majCapt] = useState(undefined);   // { ts, n }
  // ⚠️⚠️ QUELLE VERSION A VRAIMENT CAPTÉ ? Depuis son iPhone, le pont n'existe
  // pas — l'app ne pouvait donc PAS répondre « ton extension est-elle à jour ? »
  // sur l'appareil où il pose justement la question. L'extension inscrit
  // désormais sa version dans sa ligne de diagnostic à chaque capture, et c'est
  // une MESURE, pas une déduction (trois sessions ont dû la deviner, une de ces
  // déductions était fausse).
  // ⚠️ C'EST UN CONSTAT, JAMAIS UNE CAPACITÉ : cette version est celle de
  // l'extension qui a capté EN DERNIER, quelque part. `extSait()` n'y touche
  // pas — promettre sur cette valeur, ce serait annoncer à un iPhone ce qu'un
  // Chrome sait faire. Trois états, comme partout : `undefined` = en cours,
  // `null` = pas su, un objet = lu.
  const [derniereExt, majDerniereExt] = useState(undefined);
  // ⚠️ DÉRIVE DE FORMAT (sentinelle 5.139). L'extension note `forme_inconnue_*`
  // + un échantillon `rates.forme_<type>` quand Vinted/LBC/eBay renomme la clé de
  // liste d'une réponse — la capture tombe à 0 sans erreur. On le SURFACE ici
  // pour qu'il le sache (sinon la liste serait juste « vide »), mais SEULEMENT
  // si c'est RÉCENT (< 7 j) : une dérive déjà corrigée laisse son compteur, et
  // une alerte périmée fait cesser de lire les vraies.
  const [drift, majDrift] = useState(undefined);
  // Les plantages notés ces 7 derniers jours (src/plantages.js). Lecture ratée
  // ou aucun : rien n'est affiché — une alerte n'apparaît que sur un fait.
  const [plantages, majPlantages] = useState(undefined);
  useEffect(() => onVmrExt(() => setExt({ on: vmrExtPresent(), v: vmrExtVersion() })), []);
  useEffect(()=>{let actif=true;const owner=AUTH.user?.id||null;const setPlantages=v=>{if(actif&&(AUTH.user?.id||null)===owner)majPlantages(v);};setPlantages(undefined);(async()=>{
    try {
      // Trié et filtré PAR LA BASE (la date est copiée dans `meta`) : sans
      // `order`, 60 lignes quelconques pouvaient laisser dehors celles de la semaine.
      const depuis7 = new Date(Date.now() - 7 * 864e5).toISOString();
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.plantage_*&meta->>at=gte.${encodeURIComponent(depuis7)}&select=id,message:data->>message,at:data->>at,ecran:data->>ecran&order=meta->>at.desc&limit=60`, { headers: sbAuth() });
      if (!r.ok) { setPlantages(null); return; }
      const rows = await r.json();
      if (!Array.isArray(rows)) { setPlantages(null); return; }
      setPlantages(rows.filter(x => { const t = Date.parse(x.at || '') || 0; return t && (Date.now() - t) < 7 * 864e5; })
        .sort((a, b) => String(b.at).localeCompare(String(a.at))));
    } catch (_) { setPlantages(null); }
  })();return()=>{actif=false;};},[versionLecture]);
  useEffect(()=>{let actif=true;const owner=AUTH.user?.id||null;const setDerniereExt=v=>{if(actif&&(AUTH.user?.id||null)===owner)majDerniereExt(v);};setDerniereExt(undefined);const setDrift=v=>{if(actif&&(AUTH.user?.id||null)===owner)majDrift(v);};setDrift(undefined);(async()=>{
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_diag_capture&select=ver:data->>ver,verAt:data->>verAt,rates:data->rates`, { headers: sbAuth() });
      if (!r.ok) { setDerniereExt(null); setDrift(null); return; }
      const rows = await r.json();
      if (!Array.isArray(rows)) { setDerniereExt(null); setDrift(null); return; }
      const d = rows[0] || {};
      setDerniereExt(d.ver ? { v: String(d.ver), at: d.verAt || '' } : 'aucune');
      const rates = (d.rates && typeof d.rates === 'object') ? d.rates : {};
      const recents = Object.keys(rates)
        .filter(k => /^forme_/.test(k))
        .map(k => ({ type: k.slice('forme_'.length), ...(rates[k] || {}) }))
        .filter(x => { const t = Date.parse(x.at || '') || 0; return t && (Date.now() - t) < 7 * 864e5; })
        // 20 oct. : un échantillon dont les clés sont celles d'une RÉPONSE
        // D'ERREUR de Vinted (`code`, `message`, `message_code`…) n'est pas un
        // renommage : c'est un refus, jugé à tort comme une conversation par les
        // extensions < 5.193 (mesuré chez Julien : 250 fausses alertes). On ne
        // le montre pas comme « un site a changé son format ».
        .filter(x => !estCorpsErreurVinted(x.cles));
      setDrift(recents);
    } catch (_) { setDerniereExt(null); setDrift(null); }
  })();return()=>{actif=false;};},[versionLecture]);
  // Le type de capture → un mot que Julien lit (jamais le nom technique brut).
  const nomFamille = (t) => /orders_sold|transaction|txn/.test(t) ? 'ventes' : /orders_purchased/.test(t) ? 'achats'
    : /listings|item/.test(t) ? 'annonces' : /inbox|conv/.test(t) ? 'messages' : t;
  useEffect(()=>{let actif=true;const owner=AUTH.user?.id||null;const setMail=v=>{if(actif&&(AUTH.user?.id||null)===owner)majMail(v);};setMail(undefined);const setCapt=v=>{if(actif&&(AUTH.user?.id||null)===owner)majCapt(v);};setCapt(undefined);(async()=>{
    const lire = async (motif) => {
      try {
        // ⚠️ `email_*` = 1 211 lignes, `harvest_*` = 1 127 : sans pagination on
        // n'en lit que 1 000, et la coupure enlève justement les `email_track_*`
        // (les colis), donc « dernier email reçu » pouvait dater d'avant le
        // dernier colis arrivé (§A1). Lignes vidées écartées.
        const rows = await lireTout(`id=like.${motif}&select=id,updated_at,cap:meta->>capturedAt&meta->>supprime=is.null`);
        if (!rows) return null;
        let ts = 0; rows.forEach(x => { const t = harvestTs(x) || 0; if (t > ts) ts = t; });
        return { n: rows.length, ts, lignes:rows };
      } catch (_) { return null; }
    };
    const [emails,captures]=await Promise.all([lire('email_*'),lire('harvest_*')]);setMail(emails);setCapt(captures);
  })();return()=>{actif=false;};},[versionLecture]);
  const extension=etatExtensionAffichage({presente:ext.on,version:ext.v,retard:extEnRetard(ext.v)});
  const emails=etatDerniereLecture(mail),capture=etatDerniereLecture(capt);
  const lecture=[mail,capt,derniereExt,plantages].some(v=>v===undefined);
  const dateLisible=d=>{const t=Date.parse(d||'');return Number.isFinite(t)&&t<=Date.now()+300000?new Date(t).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'date non vérifiée';};
  return <div data-connexions-panneau="" style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:14}}>
    <div className="vrm-titre-panneau" style={{fontSize:15,fontWeight:600,color:C.text}}>État des connexions</div>
    <div className="vrm-connexions-entete"><p style={{color:C.muted}}>Une donnée ancienne ne veut pas dire « déconnecté ».</p><Bouton variante="secondaire" icone="sync" onClick={actualiser} disabled={lecture}>{lecture?'Vérification…':'Actualiser les états'}</Bouton></div>
    <section className="vrm-connexion-source" data-connexion="extension" style={{borderColor:C.border}}>
      <h3>Extension · ce navigateur</h3><strong style={{color:extension.etat==='action'?C.warn:C.text}}>{extension.titre}</strong><p style={{color:C.muted}}>{extension.detail}</p>
      {ext.on&&codePerime()&&<p style={{color:C.warn}}>{textePerime()}</p>}
      <details><summary>Installer ou mettre à jour l’extension</summary>
        <div className="vrm-connexions-actions">{(()=>{const b=installerExtensionIci();return b.boutique?<a href={b.lien} target="_blank" rel="noreferrer" data-ext-boutique={b.nav}>{b.nomBoutique} · mises à jour automatiques</a>:null;})()}<a href={`/VRM-extension.zip?v=${EXT_ATTENDUE}`} download>Ordinateur · version {EXT_ATTENDUE}</a>{boutiqueOrion()&&<a href={boutiqueOrion()} target="_blank" rel="noreferrer" data-orion-boutique="">Orion · depuis la boutique (mises à jour automatiques)</a>}<a href={`/VRM-Orion.xpi?v=${EXT_ATTENDUE}`} download>Orion · iPhone et iPad</a><a href={`/VRM-Orion-dossier.zip?v=${EXT_ATTENDUE}`} download data-orion-dossier="">Orion · en dossier</a></div>
        <p>Le zip se dézippe en un seul dossier « VRM-extension » : mets-le à la place de l'ancien, au même endroit, PUIS dans chaque navigateur où elle est installée, ouvre <code>chrome://extensions</code> et clique ⟳ sur VRM (sans ⟳, le navigateur garde l'ancien code). Sur Edge, utilise <code>edge://extensions</code>.</p>
        <p>Dans Orion : autorise les extensions Firefox, puis installe le fichier XPI depuis Extensions → + → depuis un fichier. Autorise ensuite VRM sur les sites utilisés.</p>
        <p>Si Orion refuse le fichier : télécharge « Orion · en dossier », ouvre-le dans l'app Fichiers (le toucher donne un dossier « VRM-Orion »), puis dans Orion, Extensions → + → depuis un fichier, et choisis ce dossier (ou le fichier manifest.json qui est dedans).</p>
        <a href="/VRM-Orion-installation.txt" target="_blank" rel="noopener noreferrer">Voir les instructions Orion</a>
      </details>
      <details><summary>Version qui a lu en dernier</summary><p>{derniereExt===undefined?'Lecture en cours…':derniereExt===null?'Cette information n’a pas pu être lue.':derniereExt==='aucune'?'Aucune version enregistrée.':`Version ${derniereExt.v} · ${dateLisible(derniereExt.at)}.`} Celle de la dernière capture, peut-être faite ailleurs : elle ne confirme pas la version utilisée ici.</p></details>
    </section>
    <section className="vrm-connexion-source" data-connexion="capture" style={{borderColor:C.border}}><h3>Ce que l’extension a lu</h3><strong>{capture.titre}</strong>{capture.date&&<time dateTime={capture.date}>{dateLisible(capture.date)}</time>}<p style={{color:C.muted}}>Pour la rafraîchir : ouvre le compte sur sa plateforme, extension active.</p></section>
    <SuiviComptes comptes={comptes} lignes={capt?.lignes||null} onComptes={onComptes}/>
    {onPlateforme&&<div className="vrm-connexions-actions"><Bouton variante="secondaire" onClick={()=>onPlateforme('plat_leboncoin')}>Comptes Leboncoin</Bouton><Bouton variante="secondaire" onClick={()=>onPlateforme('plat_ebay')}>Comptes eBay</Bouton></div>}
    <section className="vrm-connexion-source" data-connexion="emails" style={{borderColor:C.border}}><h3>E-mails reçus</h3><strong>{emails.titre}</strong>{emails.date&&<time dateTime={emails.date}>{dateLisible(emails.date)}</time>}<p style={{color:C.muted}}>La date du dernier arrivé, pas la preuve que chaque transfert marche. Détail : « Réception des e-mails ».</p></section>
    {((Array.isArray(drift)&&drift.length>0)||(Array.isArray(plantages)&&plantages.length>0))&&<details className="vrm-connexion-source" style={{borderColor:C.border}}><summary>Incidents et détails pour l’assistance</summary>
      {Array.isArray(drift)&&drift.length>0&&<p>Le format de certaines réponses est à vérifier : {[...new Set(drift.map(x=>nomFamille(x.type)))].join(', ')}.</p>}
      {Array.isArray(plantages)&&plantages.length>0&&<p data-plantages={plantages.length}>{plantages.length} incident(s) observé(s) ces 7 derniers jours. Dernier : {plantages[0].message} · {dateLisible(plantages[0].at)}.</p>}
    </details>}
    <details className="vrm-connexion-source" style={{borderColor:C.border}}><summary>Version de l’application</summary><p>{BUILD_ID==='inconnue'?'Version non vérifiée.':`Compilation du ${BUILD_ID}.`}</p><Bouton variante="secondaire" onClick={()=>{if(window.__vrmForceUpdate)window.__vrmForceUpdate();else window.location.reload();}}>Recharger la dernière version</Bouton></details>
  </div>;
}
// ⟦← App.jsx #47⟧

// Réglage du régime fiscal : détermine comment le rapport comptable présente les
// chiffres. Micro-entrepreneur (CA + estimation cotisations) ou société au
// régime de la marge (marge + TVA sur la marge). Synchronisé (vinted_regime/tva).
function RegimeSetting({ nu = false }) {
  const [regime, setRegime] = useState(() => regimeFiscal());
  // §5.49 : la base du régime URSSAF (donc du taux affiché) est synchronisée et
  // lue au montage. Scalaire à défaut non vide : remplacer SEULEMENT s'il est
  // resté au défaut, jamais un choix fait pendant le chargement.
  useEffect(() => onCloudReady(() => setRegime(v => v == null ? regimeFiscal() : v)), []);
  const [tva, setTva] = useState(() => Number(load('vinted_tva', 20)) || 20);
  // ⚠️ LE TAUX DE COTISATIONS EST UN RÉGLAGE, PAS UNE CONSTANTE. Il était écrit
  // 13,5 % en dur à SIX endroits, et il tombe sur un document qu'il recopie
  // pour l'URSSAF. Le bon taux dépend de son activité et de son option pour le
  // versement libératoire — lui seul le connaît, et il change chaque année.
  // ⚠️ À LA FRANÇAISE, comme partout ailleurs dans l'app. Le champ affichait
  //    « 13.5 » (le nombre recopié tel quel) alors que les deux rapports qui
  //    l'utilisent écrivent « 13,5 % » : le même taux, deux orthographes, sur
  //    l'écran qui sert justement à le régler. Même défaut que les prix
  //    d'achat « 21.0 € » de l'écran Achats. La saisie, elle, accepte
  //    toujours les deux (`replace(',','.')` à la validation).
  const virgule = (n) => String(n).replace('.', ',');
  const [txUrs, setTxUrs] = useState(() => virgule(load('vinted_urssaf_taux', TAUX_URSSAF_DEFAUT)));
  const pick = (r) => { setRegime(r); save('vinted_regime', r); };
  const setRate = (v) => { const n = Math.max(0, Math.min(100, Number(v)||0)); setTva(n); save('vinted_tva', n); };
  return (
    <div style={nu ? {} : {border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 14px'}}>
      {!nu && <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>{L.statut}</div>}
      <div className="vrm-aide" style={{fontSize:13,color:C.muted,marginBottom:12,lineHeight:1.45}}>Adapte le rapport comptable à ta situation.</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {/* (1er nov.) La ligne courte (« Je vends mes propres affaires », « SAS, SASU… »)
            aide à se reconnaître : elle n'était dite que dans Comptabilité. */}
        {REGIMES_FISCAUX.map(([id,t,qui,d])=>(
          <button type="button" key={id} onClick={()=>pick(id)} style={{textAlign:'left',display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',borderRadius:12,cursor:'pointer',
            border:`1px solid ${regime===id?C.accent:C.border}`,background:regime===id?`${C.accent}12`:'transparent'}}>
            <span style={{flexShrink:0,width:18,height:18,marginTop:1,borderRadius:12,border:`2px solid ${regime===id?C.accent:C.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {regime===id && <span style={{width:9,height:9,borderRadius:12,background:C.accent}}/>}
            </span>
            <span style={{minWidth:0}}>
              <span style={{fontSize:13,fontWeight:600,color:C.text,display:'block'}}>{t} <span data-regime-qui="" style={{fontWeight:400,color:C.muted}}>· {qui}</span></span>
              <span style={{fontSize:12,color:C.muted,lineHeight:1.4}}>{d}</span>
            </span>
          </button>
        ))}
      </div>
      {regime==='micro' && (
        <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:500,color:C.text}}>Taux de cotisations</span>
            <input type="text" inputMode="decimal" value={txUrs}
              onChange={e=>setTxUrs(e.target.value)}
              onBlur={()=>{ const v=parseFloat(String(txUrs).replace(',','.')); const ok=(isFinite(v)&&v>=0&&v<=50)?v:TAUX_URSSAF_DEFAUT; const avant=Number(load('vinted_urssaf_taux', TAUX_URSSAF_DEFAUT)); setTxUrs(virgule(ok)); save('vinted_urssaf_taux', ok);
                // (1er nov.) Le taux s'enregistrait sans rien dire ; un taux illisible retombait au défaut en silence.
                if (ok !== v) toast(`Taux illisible : ${virgule(ok)}\u00a0% gardé`, 'error'); else if (ok !== avant) toast(`✓ Taux enregistré : ${virgule(ok)}\u00a0%`); }}
              style={{width:70,border:`1px solid ${C.border}`,borderRadius:12,padding:'5px 8px',fontSize:13,fontWeight:600,background:C.bg,color:C.text,outline:'none'}}/>
            <span style={{fontSize:12,color:C.muted}}>% du CA</span>
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.5}}>
            Le tien, vérifié sur{' '}
            <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" style={{color:C.accentTexte,fontWeight:700,textDecoration:'none'}}>autoentrepreneur.urssaf.fr →</a>
            {' '}: l'app applique celui que tu poses ici.{' '}
            <Pourquoi label="De quoi se compose ce taux">Cotisations sociales, contribution à la formation, et versement libératoire de l'impôt si tu l'as choisi. Il dépend de ta situation et change d'une année à l'autre ; il sert au rapport mensuel et annuel.</Pourquoi>
          </div>
        </div>
      )}
      {regime==='marge' && (
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
          <span style={{fontSize:12,fontWeight:500,color:C.text}}>Taux de TVA</span>
          <input type="number" value={tva} onChange={e=>setRate(e.target.value)} style={{width:64,border:`1px solid ${C.border}`,borderRadius:12,padding:'4px 8px',fontSize:13,fontWeight:500,background:C.bg,color:C.text,outline:'none'}}/>
          <span style={{fontSize:12,color:C.muted}}>%</span>
        </div>
      )}
    </div>
  );
}
export { SettingsScreen, VintedAccounts, EmailsSetting };
