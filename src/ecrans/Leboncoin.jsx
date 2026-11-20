// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { problemesAnnonce } from '../verifAnnonce.js';
import { bilanEnLigneLbc, quandLectureLbc, LIEN_MES_ANNONCES_LBC } from '../enLigneLbc.js';
import { poserNombreAnnonces } from '../plateformes/nombresAnnonces.js';
import { suivreReceptionLeboncoin } from '../rafraichissementLeboncoin.js';
import { lbcFloute } from '../flouCompte.js';
import React, { useState, useEffect, useRef } from 'react';
import { suivi, suivreJob, lireAvanceeJob } from '../suiviTravail.js';   // (11 nov., lot suivi-travail) VRM figé, détail et barre
import { montant } from '../format.js';
import { ventesVcDe } from '../../api/_lib/vestiaire-regle.js';
import { lbcColisAPoster } from '../../api/_lib/colis-sites.js';
import { photoArticle } from '../photosArticles.js';
import PastilleTransporteur from '../PastilleTransporteur.jsx';
import { transporteurDuColis, cleStatTransporteur } from '../transporteursVisuels.js';
import { attrCible } from '../cibleNotif.js';
import { champsFacultatifs, motsVendeur, motArticle } from '../profilVendeur.js';
import { achatDuNumeroLu, __vmrEtat, __vmrJobs, __vmrNotifier, annonceLbcALui, annonceLbcEnVente, annoncesLbcVendues, annotateAndDownloadBordereau, aRetirerDeLbcEbay, aRetirerDeLbcVinted, askConfirm, AUTH, avecNumerosVc, b64ToBytes, bordereauFormatKey, C, Card, categorieLbcDe, ChipsModeles, cleNum, clesAnnonceLbc, comptesLbcProuves, comptesLbcSession, dejaEnLigneLbc, DEMANDE_LBC_CIBLE, DEMANDE_LBC_FICHE, descriptionLbcDe, doublesVenteLbc, estTamponAnnule, EXT_ATTENDUE, EXT_CAPACITES, extractBrand, extSait, familleArticle, gesteVrm, Icon, ilYaCourt, INV_STATUS, jumellesParPhoto, LBC_DESC_MAX, LBC_ETATS, LBC_PHOTOS_MAX, LBC_TITRE_MAX, lbcAnnulee, lbcDescription, lbcEuro, lbcExpediee, lbcFinalisee, lbcSortieDe, lbcTitre, libelleRelais, libererOngletPdf, LignePanne, LigneRelais, lireBaseRelue, lireDressings, lireEbayTous, lireFichesPage, lireLignesEnLigne, lirePreuvesVenteVinted, lireVentesVestiaire, load, mpChoisi, NAV, NUM_OK, numeroLbcIdentite, numerosLbcSortis, numerosVendusEbay, numerosVendusVc, onVmrExt, optsNumeroVerif, PhotoVente, PhotoVinted, Pourquoi, prixAchatDe, QrColis, raisonExtGlobale, readPdfFirstPageSize, refLbcPresente, relaisVivant, save, SB_CONFLICT, sbAuth, ScreenHead, Segmente, SEL_EBAY_COMMANDES, SheetShell, SUPABASE_URL, TamponPose, toast, triNum, useCompteLbcOuvert, useExtVivante, useSansSouris, useVoixExt, valideAnnonceLbc, vendActuel, verifierAvantPublication, vmrCmd, vmrExtPresent, vmrExtVersion, vmrPdfLbc, withOwner, ecrireCopieLocale } from '../App.jsx';

// ⟦← App.jsx #1⟧
import AnnoncesLeboncoin from '../AnnoncesLeboncoin.jsx';
// (11 nov., lot quoi-republier) « Quelles annonces republier ? » dans « Republier sur Leboncoin » : la MÊME règle et la même carte que Vinted.
import QuoiRepublier from '../design/QuoiRepublier.jsx';
import { quoiRepublier, ageDepuis, lireReglage as lireReglageQR, CLE_REGLAGE as CLE_REGLAGE_QR } from '../quoiRepublier.js';
import { BoutonExtension, FeuilleExtension } from '../BoutonExtension.jsx';
import { ouvrirPanneau } from '../ouvrirPanneau.js';   // (20 nov., décision de Julien) « … dans l'extension »
import { Groupe as NGroupe, Rangee as NRangee, Plaque as NPlaque } from '../natif/index.js';
import { AFaireSite } from '../plateformes/AFaireSite.jsx';   // (14 nov., refonte visible) « À faire · N › »
import { IconePlus } from '../plateformes/IconePlus.jsx';
import { BoutonIcone } from '../ui/index.js';
import { limiteRepub, noterRepub, joursRepub, JOURS_REPUB_DEFAUT, CHOIX_JOURS_REPUB, espacementPropre, ESP_DEFAUT, delaiEspacement, attenteTotale, deplacer } from '../lbcPlus.js';
import { useLangue } from '../i18n/react.js';   // (11 nov., lot lbc-plus) baisser le prix en série, sur son clic
import { tr } from '../i18n/index.js';
import { Groupe as GroupeN, Rangee as RangeeN, Vignette as VignetteN, Plaque as PlaqueN, Pastille as PastilleN, Segmente as SegmenteN, Bouton as BoutonN, ChampRecherche as ChampRechercheN } from '../natif/index.js';   // (20 nov.) Ventes · Leboncoin comme Ventes · Vinted
import { ouvrirLiaison } from '../liaisonEtat.js';   // (19 nov.) « Relier » ouvre LE parcours « Relier mes annonces »

// ⟦← App.jsx #2⟧
import { accompagner } from '../accompagnement.js';   // (14 nov.) pendant, après, échec d'un geste

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIER DEPUIS L'APP (5.130) — « c'est l'application qui contrôle l'extension »
// ══════════════════════════════════════════════════════════════════════════════
// Les panneaux sur leboncoin.fr et ebay.fr sont retirés : le geste vit ici. L'app
// n'envoie qu'un IDENTIFIANT ; l'extension relit la paire dans SA file (vendue,
// décochée ou preuve illisible → refusée), ouvre le dépôt et remplit — et sur
// Leboncoin publie sans booster (décision du 20 septembre).
// GRISÉ et jamais caché quand l'extension ne peut pas (§ BoutonBordereau) ; la
// raison commune est dite UNE fois au-dessus de la liste (`RaisonPublication`).
// `croitVendue` (revue du 11 octobre, défaut 12) : VRM sait la paire REVENUE
// (vente remboursée ensuite), mais une extension antérieure à la règle de
// l'instantané (`EXT_CAPACITES.preuves`) la croit encore vendue et refuserait
// de la publier (elle relit SA file). Le bouton est grisé avec la raison — dite
// UNE fois au-dessus de la liste (`LbcCroitVendue`), §7.
const texteCroitVendue = () => `Ton extension le croit encore vendu (elle ne sait pas qu'une vente remboursée fait revenir l'article) et refuserait de le publier : mets-la à jour (${EXT_ATTENDUE}).`;
import { BoutonBase } from '../composants/Bouton.jsx';   // (20 nov.) le bouton natif (src/natif/Bouton.jsx) par son relais
// ⚠️⚠️ 11 octobre — « QUAND JE VAIS POSTER DES PAIRES SUR LE BON COIN, JE NE
//    PEUX PAS ». Reproduit 2 sur 2 : après un dépôt qui n'aboutissait pas
//    (onglet fermé, Leboncoin qui demande de se connecter), le bouton restait
//    « Publication en cours… » 15 minutes, et un clic ne faisait RIEN, sans un
//    mot (`if (… enCours) return;`). Désormais :
//      · un clic refusé DIT pourquoi, toujours (grisé, déjà publiée, en cours) ;
//      · « en cours » renvoie la commande : l'extension remet l'onglet du dépôt
//        devant s'il est ouvert, ou relance s'il a été fermé ;
//      · un dépôt arrêté ou fermé passe à « Le dépôt n'a pas abouti —
//        Réessayer » (l'extension le dit, `depotArrete` / onglet fermé) ;
//      · le bouton annonce les photos CAPTÉES sur le total de l'annonce — le
//        dépôt part avec ce qui est capté, jamais plus.
// ⚠️⚠️ Revue du 11 octobre : « LE DÉPÔT N'A PAS ABOUTI » ÉTAIT UNE AFFIRMATION
//    SUR UNE MESURE QUI N'A PAS EU LIEU. L'arrêt à 90 s arrive justement quand
//    un champ obligatoire ne se devine pas (Univers*), c'est-à-dire quand il
//    FINIT À LA MAIN — et VRM ne voit pas la page de fin. « Réessayer » ouvrait
//    alors un second dépôt qui PUBLIE TOUT SEUL (prouvé : 2 onglets de dépôt,
//    `publier: true`) : la paire en ligne deux fois. L'arrêt veut dire « pas
//    su », pas « échec » : on le dit, on nomme « Déjà publiée », et relancer
//    demande une confirmation (l'extension l'exige aussi, `confirme`).
const RAISON_ABANDON = { 'onglet-ferme': "l'onglet Leboncoin a été fermé avant que VRM voie la fin", 'onglet-quitte': "l'onglet du dépôt est parti sur une autre page avant que VRM voie la fin", arret: "le remplissage s'est arrêté avant la fin (Leboncoin a peut-être demandé autre chose)", 'bandeau-ferme': 'tu as fermé le bandeau VRM sur Leboncoin avant la fin' };
function BoutonPublier({ place, id, croitVendue, photos = null, total = null, onFiche = null }) {
  const { jobs } = useExtVivante();
  const sansSouris = useSansSouris();
  const [refus, setRefus] = React.useState(null);
  const [envoi, setEnvoi] = React.useState(false);
  const lbc = place === 'lbc';
  const jobId = (lbc ? 'lbc:' : 'ebay:') + id;
  const job = jobs[jobId] || null;
  const glob = raisonExtGlobale(sansSouris, { cap: lbc ? 'publication' : 'publication-ebay', role: 'publie tes annonces' })
    || (croitVendue && extSait('preuves') === 'retard' ? { code: 'croit-vendue', texte: texteCroitVendue() } : null);
  const fait = job && job.etape === 'fait';
  const enCours = job && job.etape === 'depot' && (Date.now() - Number(job.at || 0) < 15 * 60000);
  const abandonne = job && job.etape === 'abandonne';
  const lancer = async () => {
    if (envoi) return;                       // la demande précédente est en vol : son résultat arrive
    // 5.182 : sur Leboncoin, le bouton OUVRE LA FICHE (voir `FicheLbc`) — c'est
    // elle qui montre ce qui partira, laisse corriger, puis publie (les gardes y
    // vivent aussi). Grisé ou déjà publiée : on le dit ici, comme avant — une
    // fiche qu'on ne pourrait pas publier ne s'ouvre pas pour rien.
    if (lbc && onFiche && !glob && !fait) { setRefus(null); onFiche(); return; }
    // ⚠️ Un clic refusé dit TOUJOURS pourquoi (11 octobre) : avant, ces trois
    //    cas faisaient `return` en silence — « je ne peux pas poster ».
    if (glob) { setRefus(glob.texte); return; }
    if (fait) { setRefus(lbc ? 'Déjà publiée sur Leboncoin depuis VRM — rien à refaire.' : 'Déjà préparée sur eBay.'); return; }
    // Un dépôt abandonné a pu être FINI À LA MAIN : relancer publierait la
    // paire une seconde fois. On demande d'abord — ici si l'app le sait déjà,
    // sinon quand l'extension le découvre (onglet parti ailleurs : `confirmer`).
    const demander = () => askConfirm({ title: 'Relancer le dépôt sur Leboncoin ?',
      desc: "VRM n'a pas vu la fin du dépôt précédent. Si tu l'as publiée toi-même sur Leboncoin, annule et clique « Déjà publiée » : un nouveau dépôt la publierait une seconde fois. Sinon, relance.",
      ok: 'Relancer le dépôt', cancel: 'Annuler' });
    let confirme = false;
    if (lbc && abandonne) { if (!(await demander())) return; confirme = true; }
    setRefus(null); setEnvoi(true);
    const t0 = Date.now();
    const envoyer = (c) => vmrCmd(Object.assign({ cmd: 'ebayPreparer', id: String(id) }, c ? { confirme: true } : {}), 30000);   // (20 nov.) Leboncoin : dans l'extension (plus haut)
    let r = await envoyer(confirme);
    if (r && !r.accepte && r.code === 'confirmer' && !confirme) {
      __vmrJobs[jobId] = Object.assign({}, __vmrJobs[jobId] || {}, { etape: 'abandonne', raison: 'onglet-quitte', at: Date.now() }); __vmrNotifier();
      setEnvoi(false);
      if (!(await demander())) return;
      setEnvoi(true);
      r = await envoyer(true);
    }
    setEnvoi(false);
    if (!r) { setRefus("L'extension n'a pas répondu — recharge cette page et réessaie."); return; }
    if (!r.accepte) { setRefus(r.raison || "Refusé par l'extension."); return; }
    __vmrJobs[r.jobId] = { etape: r.etape, at: Date.now() };
    __vmrNotifier();
    // (11 nov., lot suivi-travail) La feuille « VRM travaille » (eBay : VRM remplit, il met en vente lui-même).
    if (!enCours) suivrePublicationSite({ sorte: lbc ? 'publier-lbc' : 'preparer-ebay', titre: lbc ? 'Publier sur Leboncoin' : 'Préparer sur eBay', etapes: lbc ? ETAPES_SUIVI_LBC : ETAPES_SUIVI_EBAY, id: String(id), jobId: r.jobId || jobId, depuis: t0, site: lbc ? 'Leboncoin' : 'eBay', preparer: !lbc });
  };
  const libelle = job && libelleRelais(job.etape) ? libelleRelais(job.etape) : envoi ? 'Envoi…' : fait ? (lbc ? 'Publiée ✓' : 'Préparée ✓')
    : enCours ? (lbc ? 'Publication en cours…' : 'Formulaire eBay ouvert')
    : abandonne ? 'Réessayer'
    : (lbc ? 'Publier sur Leboncoin' : 'Préparer sur eBay');
  const grise = !!glob || fait;
  const nPh = Number.isFinite(Number(photos)) && photos != null ? Number(photos) : null;
  const nTot = Number.isFinite(Number(total)) && total != null && Number(total) >= (nPh || 0) ? Number(total) : null;
  const textePhotos = nPh == null ? '' : nTot != null && nTot > nPh ? `${nPh} photo${nPh > 1 ? 's' : ''} sur ${nTot}` : `${nPh} photo${nPh > 1 ? 's' : ''}`;
  const etat = glob ? 'grise' : fait ? 'fait' : enCours ? 'encours' : abandonne ? 'abandonne' : 'pret';
  // (20 nov., décision de Julien) Leboncoin : la publication se fait dans le panneau de l'extension, sur leboncoin.fr,
  // depuis CETTE annonce Vinted (son identifiant). L'app ne remplit plus le dépôt. eBay reste ici.
  if (lbc) return <span data-bouton-publier={fait ? 'fait' : 'panneau'} data-id={id}>{fait ? <span style={{ fontSize: 13, color: C.muted }}>{tr('actionsExt.dejaPubliee')}</span>
    : <BoutonExtension className="vrm-ao-second" action="publier" site="leboncoin" ids={[String(id)]}/>}</span>;
  return (
    <span data-bouton-publier={etat} data-id={id} data-photos={nPh == null ? undefined : nPh} data-photos-total={nTot == null ? undefined : nTot}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, maxWidth: '100%' }}>
      {abandonne && <span data-depot-abandonne={job.raison || ''} style={{ fontSize: 11, color: C.warn, lineHeight: 1.35, whiteSpace: 'normal', fontWeight: 600 }}>{RAISON_ABANDON[job.raison] ? RAISON_ABANDON[job.raison].charAt(0).toUpperCase() + RAISON_ABANDON[job.raison].slice(1) : "VRM n'a pas vu la fin du dépôt"}. {lbc ? 'Si tu l’as publiée toi-même, clique « Déjà publiée » ; sinon Réessayer.' : 'Si tu l’as mise en vente toi-même, rien à refaire ; sinon Réessayer.'}</span>}
      <button type="button" onClick={lancer} aria-disabled={grise ? 'true' : undefined}
        title={glob ? glob.texte : enCours ? (lbc ? 'Le dépôt est ouvert dans un onglet Leboncoin — clique pour y retourner' : 'Le formulaire eBay est ouvert — clique pour y retourner') : lbc ? "L'extension ouvre Leboncoin, remplit tout (photos, titre, description, prix, catégorie) et publie sans option payante" : "L'extension ouvre la mise en vente eBay et remplit ce qu'elle reconnaît — tu relis et tu mets en vente"}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 12, fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
          padding: '7px 11px', whiteSpace: 'nowrap', cursor: grise ? 'not-allowed' : 'pointer',
          border: `1px solid ${glob ? C.border : C.accent}`, background: glob ? 'transparent' : (fait ? 'transparent' : `${C.accent}14`),
          color: glob ? C.muted : C.accent, opacity: glob ? 0.55 : 1, filter: glob ? 'grayscale(1)' : 'none' }}>
        {libelle}
        {textePhotos && !fait ? <span data-photos-bouton="" style={{ fontWeight: 400, fontSize: 12, color: glob ? C.muted : C.text, opacity: 0.8 }}>· {textePhotos}</span> : null}
      </button>
      {refus && <span data-refus-publier="" style={{ fontSize: 11, color: C.warn, lineHeight: 1.35, whiteSpace: 'normal' }}>{refus}</span>}
    </span>
  );
}
// ══════════════════════════════════════════════════════════════════════════════
// LA FICHE « PUBLIER SUR LEBONCOIN » (5.182, 16 octobre)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « je veux que le poste d'annonce sur leboncoin se fasse comme pour
// eBay, pour tout gérer depuis VRM ». Leboncoin n'a pas d'API : c'est
// l'extension qui remplit le dépôt dans son Chrome. La fiche lui montre AVANT
// ce qui partira — titre (50 car.), description avec sa référence VRM-{n°},
// prix, état, les photos captées (choisies et ordonnées), la catégorie et le
// compte — et le laisse corriger. Puis UN bouton : l'app envoie l'annonce
// corrigée, l'extension la REVÉRIFIE (`valideAnnonceLbc`, la même règle des
// deux côtés, §11), ouvre le dépôt, remplit, publie sans option payante, et
// raconte l'avancement que la fiche affiche en direct.
// ⚠️ Ce qui ne bouge pas : une paire vendue, décochée ou déjà publiée est
//    refusée par l'extension (elle relit SA file) ; un dépôt en cours n'est pas
//    relancé ; un dépôt dont VRM n'a pas vu la fin ne repart qu'avec sa
//    confirmation (il a pu le finir à la main) ; jamais un bouton payant.
// ⚠️ Une extension plus ancienne que la 5.182 ne sait pas recevoir la fiche :
//    publier « tel quel » reste possible (elle publie SA version, comme avant),
//    mais une fiche CORRIGÉE ne part pas — le bouton le dit, il ne promet rien.
const ETAPES_FICHE_LBC = [
  ['ouverture', 'Dépôt ouvert sur Leboncoin'],
  ['remplissage', 'Titre, description, prix'],
  ['photos', 'Photos'],
  ['publication', 'Publication, sans option payante'],
];
const RANG_PROGRES_LBC = { ouverture: 0, remplissage: 1, 'champ-manquant': 1, photos: 2, etapes: 2, publication: 3, 'publication-refusee': 3 };
function defautsFicheLbc(q) {
  const etat = String(q.etat || '').trim();
  return {
    title: q.title || '',
    price: q.prix != null && isFinite(Number(q.prix)) ? Number(q.prix).toFixed(2).replace('.', ',') : '',
    etat,
    description: descriptionLbcDe({ ref: 'VRM-' + q.numero, texte: q.texte, base: q.base || q.vinted, marque: q.marque, taille: q.taille, etat, couleur: q.couleur }),
    photos: Array.isArray(q.photosAll) ? q.photosAll.slice(0, LBC_PHOTOS_MAX) : [],
  };
}
// (20 nov., décision de Julien) La fiche « Publier sur Leboncoin » est retirée : la publication se fait dans le panneau de l'extension.
function LbcCroitVendue({ n }) {
  useExtVivante();
  if (!n || extSait('preuves') !== 'retard') return null;
  return (
    <div data-lbc-croit-vendue={n} style={{ fontSize: 13, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.warn}`, borderRadius: 12, padding: '9px 12px', marginBottom: 10, lineHeight: 1.45 }}>
      <b>{n} article{n > 1 ? 's' : ''} revenu{n > 1 ? 's' : ''}</b> : mets l'extension à jour ({EXT_ATTENDUE}) pour {n > 1 ? 'les' : 'le'} publier.{' '}
      <Pourquoi>Vente remboursée ou annulée : de nouveau à publier pour VRM, mais ton extension {n > 1 ? 'les croit encore vendus' : 'le croit encore vendu'} et refuserait de {n > 1 ? 'les' : 'le'} publier.</Pourquoi>
    </div>
  );
}
function RaisonPublication({ n, place }) {
  const sansSouris = useSansSouris();
  useExtVivante();
  const r = raisonExtGlobale(sansSouris, { cap: place === 'lbc' ? 'publication' : 'publication-ebay', role: 'publie tes annonces' });
  useVoixExt(r && n ? r.code : null);
  if (!r && n && place === 'lbc' && relaisVivant()) return <LigneRelais quoi="Publier sur Leboncoin :"/>;
  if (!r || !n) return null;
  return (
    <div data-raison-publier={r.code} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: C.text, background: C.card,
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.warn}`, borderRadius: 12, padding: '9px 12px', marginBottom: 10, lineHeight: 1.45 }}>
      <span><b>Publier sur {place === 'lbc' ? 'Leboncoin' : 'eBay'}</b> — {r.texte}</span>
    </div>
  );
}
// ⟦← App.jsx #3⟧
// ── LEBONCOIN · COLIS — à envoyer (bordereau + QR), puis déjà postés ─────────
// Julien : « onglet colis Leboncoin, avec le QR code, et le bordereau qui
// disparaît quand tu expédies ». Le colis « à envoyer » montre bordereau + QR ;
// une fois posté il descend dans « Déjà postés » (le bordereau n'est plus en
// avant). On rend ce qui est MESURÉ (label capté), jamais un colis inventé.
function LeboncoinColis({ lbcVentes = { ventes: [] }, enSection = false, onglet = null, onOnglet = null, avant = null }) {
  // (20 nov., « même squelette ») En section de Ventes : la recherche, puis le segment, puis « À régler » (`avant`), comme Vinted.
  const [cherche, setCherche] = React.useState('');
  // « Colis fait » comme sur Vinted (`vinted_ship_done`) : un colis coché quitte
  // la liste « à poster » et descend dans « Déjà postés », sans être perdu.
  const [lbcDone, setLbcDone] = React.useState(() => (typeof load === 'function' ? (load('vrm_lbc_colis_done', {}) || {}) : {}));
  const estFait = (o) => !!(o && lbcDone[o.txId]);
  // (6 nov., v36) Geste annulable (src/gesteAnnulable.js) : l'écran suit, la pilule offre « Annuler ».
  const toggleFait = (o) => { if (!o || o.txId == null) return; const id = String(o.txId), avant = lbcDone[id] != null ? lbcDone[id] : lbcDone[o.txId]; gesteVrm(avant ? 'Colis remis à poster' : 'Colis fait', [{ k: 'vrm_lbc_colis_done', type: 'cle', id, apres: avant ? undefined : Date.now(), avant }], { vrm_lbc_colis_done: setLbcDone }); };
  // ── IMPRESSION DU BORDEREAU « EXACTEMENT COMME VINTED » (Julien, 3 oct.) ────
  // Le tampon N° + titre est posé à l'emplacement APPRIS pour ce format (taille
  // de page = transporteur + forme), puis une modale permet de le DÉPLACER si
  // besoin — et le nouvel emplacement est retenu pour tous les prochains
  // bordereaux de ce format. C'est le MÊME store que Vinted
  // (`vinted_bordereau_formats`) : un emplacement appris sur Vinted sert aussi
  // sur Leboncoin et inversement (§11, un seul propriétaire de la donnée).
  const [bordResult, setBordResult] = React.useState(null);
  // (20 nov.) Ventes · Leboncoin : À envoyer · En route · Terminées — l'onglet de Ventes (`ongletColis`, le même que Vinted)
  // quand l'app le passe, sinon le sien.
  const [ongletLocal, setOngletLocal] = React.useState('envoyer');
  const ongletLbc = onglet === 'envoyes' ? 'route' : onglet === 'toutes' ? 'toutes' : onglet ? 'envoyer' : ongletLocal;
  const setOngletLbc = (v) => { if (onOnglet) onOnglet(v === 'route' ? 'envoyes' : v); else setOngletLocal(v); };
  const [bordFormats, setBordFormats] = React.useState(() => (typeof load === 'function' ? (load('vinted_bordereau_formats', {}) || {}) : {}));
  const posForFormat = () => null; // la place vient de la forme (`positionTampon`) ou de l'aperçu
  // « Déplacer le tampon » : l'aperçu s'ouvre toujours, la place choisie s'imprime.
  const adjustBordPlacement = async () => {
    const r = bordResult; if (!r?.pdfBuf) return;
    try { const r2 = await annotateAndDownloadBordereau(r.numero, r.title, r.pdfBuf, null, { apercu: 'force', site: 'leboncoin' }); setBordResult({ ...r2, numero: r.numero, title: r.title, pdfBuf: r.pdfBuf, key: r.key, w: r.w, h: r.h }); }
    catch (err) { libererOngletPdf(); if (!estTamponAnnule(err)) toast('Erreur : ' + String(err)); }
  };
  const ventes = lbcVentes.ventes || [];
  const aLabel = (o) => !!(o.label && (o.label.voucherUrl || o.label.qrUrl || o.label.reference));
  // Un COLIS vendeur : vente prouvée (isSeller) OU un bordereau existe (un
  // bordereau n'existe que pour le vendeur). On exclut les achats / côté inconnu.
  const estVendeur = (o) => o.isSeller!==false && (o.isSeller===true || aLabel(o));
  const colis=ventes.filter(o=>estVendeur(o) && !lbcAnnulee(o) && !lbcFinalisee(o));
  // (1er nov., audit A4) « À poster » : LA règle (`lbcColisAPoster`, api/_lib/colis-sites.js)
  // que Ma journée, la cloche, le widget et les rappels comptent aussi (§11).
  const aExpedier=colis.filter(o=>lbcColisAPoster(o, lbcDone));
  const prets = aExpedier.filter(o => o.label && o.label.voucherUrl);   // bordereau prêt
  const aGenerer = aExpedier.filter(o => !(o.label && o.label.voucherUrl)); // bordereau à générer
  const postes = colis.filter(o => lbcExpediee(o) || estFait(o));
  const lbcUrl = (o) => `https://www.leboncoin.fr/compte/part/transaction/${encodeURIComponent(o.txId)}`;
  const euro = (p) => p == null ? '' : (Number(p) / 100).toFixed(2).replace('.', ',') + '\u00a0€';
  // ── LE N° (SKU) D'UN COLIS LEBONCOIN ──────────────────────────────────────
  // ⚠️ Le colis porte l'`itemId` LEBONCOIN (pas l'id Vinted) : il ne se retrouve
  // dans `vinted_annonce_numeros` (clé = id Vinted) que si les deux coïncident.
  // Quand ça ne résout pas, PAS de N° inventé — mieux vaut un blanc qu'un faux (§5).
  const numD = (typeof load === 'function' ? (load('vinted_annonce_numeros', {}) || {}) : {});
  const numDe = (o) => { const e = o && o.itemId && numD[o.itemId]; return (e && e.numero != null && String(e.numero).trim()) ? String(e.numero).trim() : ''; };
  // Pastille N° accent — IDENTIQUE à l'écran Colis Vinted (fond accent, blanc).
  const badgeNum = (n) => n ? <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, color: C.onAccent || '#fff', background: C.accent, borderRadius: 12, padding: '3px 9px', letterSpacing: -0.2 }}>N°{n}</span> : null;
  // ── « LE TAMPON TITRE + N° PARTOUT » (3 octobre, 5.136) ───────────────────
  // Le PDF Leboncoin sort tamponné comme celui de Vinted (même fonction : même
  // cartouche, même place), puis s'ouvre dans l'onglet réservé au clic. Un N°
  // qu'on ne sait pas relier n'est pas inventé : le titre seul est tamponné.
  const imprimerLbc = async (o, n) => {
    const r0 = await vmrPdfLbc(o.label && o.label.voucherUrl);
    if (!r0.dataUrl) { libererOngletPdf(); toast(`Bordereau Leboncoin illisible${r0.error ? ' — ' + r0.error : ''}. Il s'ouvre tel quel.`); try { if (/^https:\/\//i.test(String(o.label.voucherUrl))) window.open(o.label.voucherUrl, '_blank', 'noopener'); } catch (_) {} return; }
    try {
      const bytes = b64ToBytes(r0.dataUrl.split(',')[1] || '');
      const { width, height } = await readPdfFirstPageSize(bytes);
      const key = bordereauFormatKey(width, height);
      const pos = posForFormat(width, height);   // emplacement APPRIS pour ce format
      const r = await annotateAndDownloadBordereau(n || '', o.title || '', bytes, pos, { site: 'leboncoin' });
      // On garde le PDF SOUS LA MAIN pour permettre de DÉPLACER ensuite (comme Vinted).
      setBordResult({ ...r, numero: n || '', title: o.title || '', pdfBuf: bytes, key, w: width, h: height });
    } catch (e) { libererOngletPdf(); if (!estTamponAnnule(e)) toast('Impossible de tamponner ce bordereau : ' + String(e)); }
  };
  // Carte d'un colis — même squelette que l'écran Colis Vinted : photo 58 ·
  // N° + titre · transporteur + prix · UNE action principale (🖨 Imprimer) + Colis fait.
  const carte = (o, { principal }) => {
    const n = numDe(o);
    const posted = estFait(o);
    return (
      <div className="vrm-lbc-package" key={o.txId} data-lbc-vente={o.txId} data-cible={attrCible(['lbcvente', o.txId])} data-bord-card data-transporteur={cleStatTransporteur(transporteurDuColis({ declare: o.deliveryMethod || o.deliveryLabel || '' }))} style={{ padding: '11px 12px', border: `1px solid ${o.label && o.label.voucherUrl ? INV_STATUS.online.color + '44' : C.border}`, background: C.card, borderRadius: 12, marginBottom: 8, opacity: posted ? 0.55 : 1 }}>
        <div className="vrm-lbc-package-head" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <PhotoVente src={photoArticle(o)} size={58} />
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {badgeNum(n)}
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.title || '(sans titre)'}</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {euro(o.price) && <span style={{ flexShrink: 0, fontWeight: 600, color: C.text }}>{euro(o.price)}</span>}
              {o.label && o.label.reference && <span style={{ flexShrink: 0 }}>bordereau {o.label.reference}</span>}
              {posted && <span style={{ flexShrink: 0, color: INV_STATUS.online.color, fontWeight: 600 }}>✓ posté</span>}
            </div>
          </div>
          {o.label && o.label.qrUrl && <QrColis url={o.label.qrUrl} size={64} />}
        </div>
        {/* ACTION PRINCIPALE — comme Vinted : un gros bouton accent. « Imprimer »
            ouvre le PDF du bordereau Leboncoin ; « Générer » ouvre la vente sur
            Leboncoin pour qu'il y soit créé (l'extension le capte ensuite). */}
        <div className="vrm-lbc-package-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          {/* (2 nov. au soir) Le transporteur que Leboncoin écrit (`deliveryMethod`) : la puce À GAUCHE
              du geste principal, sur la même rangée (logo + nom ; sinon « pas lu »). */}
          <div className="vrm-rangee-bord" data-rangee-bord="">
          <PastilleTransporteur t={transporteurDuColis({ declare: o.deliveryMethod || o.deliveryLabel || '' })} C={C}/>
          {principal === 'imprimer' && extSait('lbcpdf') === 'ok'
            ? <button type="button" className="vrm-lbc-package-primary" data-imprime="1" data-imprime-lbc={o.txId} onClick={() => imprimerLbc(o, n)} style={{ flex: '1 1 160px', maxWidth: 340, textAlign: 'center', border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><span className="vrm-lib-long">Imprimer le bordereau</span><span className="vrm-lib-court">Imprimer</span></button>
            : principal === 'imprimer'
            ? <a className="vrm-lbc-package-primary" href={/^https:\/\//i.test(String(o.label.voucherUrl)) ? o.label.voucherUrl : undefined} target="_blank" rel="noreferrer" title={extSait('lbcpdf') === 'retard' ? `Mets l'extension à jour (${EXT_CAPACITES.lbcpdf}) pour qu'il sorte tamponné du titre et du N°` : "Sans l'extension, le bordereau s'ouvre tel quel (sans N° ni titre)"} style={{ flex: '1 1 160px', maxWidth: 340, textAlign: 'center', border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}><span className="vrm-lib-long">Imprimer le bordereau</span><span className="vrm-lib-court">Imprimer</span></a>
            : <a className="vrm-lbc-package-primary" href={lbcUrl(o)} target="_blank" rel="noreferrer" style={{ flex: '1 1 160px', maxWidth: 340, textAlign: 'center', border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}><span className="vrm-lib-long">Générer le bordereau</span><span className="vrm-lib-court">Générer</span></a>}
          </div>
          <button type="button" onClick={() => toggleFait(o)} title={posted ? 'Remettre dans les colis à poster' : 'Marquer comme posté'} style={{ flexShrink: 0, border: `1px solid ${posted ? INV_STATUS.online.color : C.border}`, background: posted ? `${INV_STATUS.online.color}18` : 'transparent', color: posted ? INV_STATUS.online.color : C.muted, borderRadius: 12, padding: '12px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{posted ? '↺ Pas encore' : '✓ Colis fait'}</button>
        </div>
      </div>
    );
  };
  // ── (20 nov., Julien : « tu dois appliquer les mêmes dispositions sur toutes les plateformes ») EN SECTION DE VENTES, LA
  // DISPOSITION DE VENTES · VINTED (src/natif/ecrans/Ventes.jsx) : le segment À envoyer · En route, des groupes de rangées
  // natives (vignette, N°, titre sur 2 lignes, transporteur, prix à droite), le toucher fait LE geste (imprimer, ou ouvrir
  // la vente sur leboncoin.fr pour générer le bordereau), le balayage « Colis fait ». Mêmes listes, mêmes règles
  // (`lbcColisAPoster`, `lbcExpediee`, `vrm_lbc_colis_done`) : seule la mise en page change. La limite du site (le bordereau
  // se génère SUR leboncoin.fr) est dite UNE fois, en pied du groupe (plus bas, `if (enSection)`).
  // ── BORDEREAU PRÊT : ouvre l'onglet d'impression + propose de DÉPLACER le N° — exactement comme l'écran Colis Vinted
  // (même modale, même store). Posée par les deux dispositions (section de Ventes et écran Leboncoin).
  const modaleBord = bordResult ? (
        <div onClick={() => { if (bordResult.url) URL.revokeObjectURL(bordResult.url); setBordResult(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.bg, borderRadius: 12, maxWidth: 420, width: '100%', padding: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Bordereau prêt</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45, marginBottom: 16 }}>{bordResult.printed ? <>Il est <b>ouvert dans un nouvel onglet</b> : imprime-le. Sinon, le bouton ci-dessous.</> : <>Ouvre-le puis <b>Imprimer</b> (ou enregistre-le). Sur iPhone, le bouton de partage en bas.</>}</div>
            <a href={bordResult.url} target="_blank" rel="noreferrer" style={{ display: 'block', background: C.accent, color: C.onAccent, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, textDecoration: 'none', marginBottom: 8, textAlign: 'center' }}>📄 Ouvrir le bordereau</a>
            <TamponPose r={bordResult}/>
            {bordResult.thermique && <div data-lbc-thermique={bordResult.isoles>0?'isole':'entier'} style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, marginBottom: 8 }}>{bordResult.isoles>0 ? <>Imprimante thermique : <b style={{color:C.text}}>l'étiquette seule, au format 10×15 cm</b>, ton N° en bas.</> : <>Imprimante thermique : je n'ai pas su repérer l'étiquette ({(bordResult.entiers&&bordResult.entiers[0]&&bordResult.entiers[0].raison)||'mise en page inconnue'}) — la page part entière, découpe-la à la main.</>}</div>}
            {bordResult.pdfBuf && <button type="button" data-imprime="1" data-tampon-deplacer="1" onClick={adjustBordPlacement} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, background: 'transparent', color: C.text, cursor: 'pointer', fontSize: 13, fontWeight: 400, padding: '11px', marginBottom: 8, fontFamily: 'inherit' }}>Déplacer le tampon</button>}
            <button type="button" onClick={() => { if (bordResult.url) URL.revokeObjectURL(bordResult.url); setBordResult(null); }} style={{ width: '100%', border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 400, padding: '8px', fontFamily: 'inherit' }}>Fermer</button>
          </div>
        </div>
  ) : null;
  if (enSection) {
    const ouvrirLbc = (o) => { try { window.open(lbcUrl(o), '_blank', 'noopener'); } catch (_) {} };
    const rangee = (o, principal) => {
      const n = numDe(o); const t = transporteurDuColis({ declare: o.deliveryMethod || o.deliveryLabel || '' }); const posted = estFait(o);
      const imprimerOk = principal === 'imprimer' && extSait('lbcpdf') === 'ok';
      const pdf = principal === 'imprimer' && !imprimerOk && /^https:\/\//i.test(String(o.label && o.label.voucherUrl)) ? o.label.voucherUrl : '';
      const toucher = principal === 'generer' ? () => ouvrirLbc(o) : imprimerOk ? () => imprimerLbc(o, n) : pdf ? () => { try { window.open(pdf, '_blank', 'noopener'); } catch (_) {} } : null;
      return <RangeeN key={o.txId} vignette={<VignetteN src={photoArticle(o) || ''} alt=""/>} titre={o.title || '—'} lignes={2}
        plaque={n ? <PlaqueN numero={n}/> : null}
        sousTitre={[t && t.nom ? t.nom : '', o.label && o.label.reference ? o.label.reference : '', principal === 'route' ? (estFait(o) ? tr('vn.lbc.poste') : (o.stepLabel || tr('vn.lbc.poste'))) : ''].filter(Boolean).join(' · ')}
        pastilleSous={principal === 'generer' ? <PastilleN ton="ambre">{tr('vn.lbc.generer')}</PastilleN> : principal === 'imprimer' ? <PastilleN>{tr('vn.lbc.pret')}</PastilleN> : null}
        valeur={euro(o.price) || null} valeurForte onClick={toucher}
        fin={o.label && o.label.qrUrl && principal !== 'route' ? <QrColis url={o.label.qrUrl} size={44}/> : toucher ? 'chevron' : null}
        actions={principal === 'route' ? (estFait(o) && !lbcExpediee(o) ? [{ cle: 'pasEncore', libelle: tr('vn.lbc.pasEncore'), ton: 'neutre', onClick: () => toggleFait(o), franc: true }] : (o.label && o.label.trackingUrl ? [{ cle: 'suivre', libelle: tr('vn.lbc.suivre'), ton: 'neutre', onClick: () => { try { window.open(o.label.trackingUrl, '_blank', 'noopener'); } catch (_) {} } }] : null))
          : [{ cle: 'fait', libelle: posted ? tr('vn.lbc.pasEncore') : tr('vn.lbc.fait'), ton: 'neutre', onClick: () => toggleFait(o), franc: true }]}
        attrs={{ 'data-lbc-vente': o.txId, 'data-cible': attrCible(['lbcvente', o.txId]), 'data-bord-card': '', 'data-lbc-principal': principal, 'data-transporteur': cleStatTransporteur(t), ...(imprimerOk ? { 'data-imprime': '1', 'data-imprime-lbc': o.txId } : {}) }}/>;
    };
    const nEnv = aExpedier.length, nRoute = postes.length;
    const mots = cherche.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const garde = (o) => !mots.length || mots.every((m) => [o.title || '', numDe(o), 'n' + numDe(o), o.label && o.label.reference || ''].join(' ').toLowerCase().includes(m));
    return (
      <div data-lbc-colis-natif="" data-lbc-onglet={ongletLbc}>
        <div className="n-page-recherche"><ChampRechercheN valeur={cherche} onChange={setCherche} placeholder={tr('v2v.rechercher')} libelle={tr('v2v.rechercher')}/></div>
        <SegmenteN valeur={ongletLbc} onChange={setOngletLbc} libelle={tr('vv.seg.label')}
          options={[{ cle: 'envoyer', libelle: tr('vv.seg.expedier'), n: nEnv || null, attrs: { 'data-lbc-seg': 'envoyer' } }, { cle: 'route', libelle: tr('vv.seg.route'), n: nRoute || null, attrs: { 'data-lbc-seg': 'route' } },
            ...(onOnglet ? [{ cle: 'toutes', libelle: tr('vn.terminees'), attrs: { 'data-lbc-seg': 'toutes' } }] : [])]}/>
        {ongletLbc === 'toutes' ? null : avant}
        {ongletLbc === 'toutes' ? null : colis.length === 0
          ? <GroupeN attrs={{ 'data-lbc-colis-vide': lbcVentes.maj ? 'lu' : 'jamais' }}><RangeeN titre={lbcVentes.maj ? tr('vn.lbc.rien') : tr('vn.lbc.pasLu')} sousTitre={lbcVentes.maj ? ilYaCourt(lbcVentes.maj) : ''}/></GroupeN>
          : ongletLbc === 'envoyer' ? (<>
            {aGenerer.length > 0 ? <GroupeN titre={`${tr('vn.lbc.aGenerer')} · ${aGenerer.length}`} pied={tr('vn.lbc.limite')}
              action={aGenerer.length > 1 ? <BoutonN variante="texte" taille="compact" onClick={() => { if (aGenerer.length > 4 && !window.confirm(`${tr('vn.lbc.genererTous')} · ${aGenerer.length} ?`)) return; aGenerer.forEach(ouvrirLbc); }} attrs={{ 'data-lbc-generer-tous': '' }}>{tr('vn.lbc.genererTous')}</BoutonN> : null}
              attrs={{ 'data-lbc-groupe': 'generer' }}>{aGenerer.filter(garde).map((o) => rangee(o, 'generer'))}</GroupeN> : null}
            {prets.length > 0 ? <GroupeN titre={`${tr('vn.lbc.prets')} · ${prets.length}`} attrs={{ 'data-lbc-groupe': 'prets' }}>{prets.filter(garde).map((o) => rangee(o, 'imprimer'))}</GroupeN> : null}
            {!aGenerer.length && !prets.length ? <GroupeN><RangeeN titre={tr('vn.lbc.rien')}/></GroupeN> : null}
          </>) : (
            postes.length ? <GroupeN titre={`${tr('vv.seg.route')} · ${postes.length}`} attrs={{ 'data-lbc-groupe': 'route' }}>{postes.filter(garde).map((o) => rangee(o, 'route'))}</GroupeN>
              : <GroupeN><RangeeN titre={tr('vn.lbc.rien')}/></GroupeN>)}
        {modaleBord}
      </div>
    );
  }
  return (
    <div style={{ padding: enSection ? '0 16px 16px' : 16 }}>
      {/* (12 nov., finitions) En section de Ventes, l'intertitre « À expédier » suffit : « Colis Leboncoin »
          en grand juste dessous faisait deux titres l'un sur l'autre. */}
      {enSection ? null : <ScreenHead icon="box" title="Colis Leboncoin" desc="Génère tes bordereaux, poste tes colis — comme sur Vinted" />}
      {colis.length === 0 ? (
        // (20 oct., revue) Jamais lu n'est pas « aucun colis » : Ventes dit « — »
        // tant que « Mes transactions » n'a pas été relue, Colis disait « Aucun
        // colis » sur la même absence de lecture (« rien lu » ne vaut pas « rien »).
        <Card><div data-lbc-colis-vide={lbcVentes.maj ? 'lu' : 'jamais'} style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{lbcVentes.maj
          ? <>Aucun colis Leboncoin à envoyer dans ta dernière lecture ({ilYaCourt(lbcVentes.maj)}).</>
          // (12 nov., finitions) En section de Ventes, la carte « Tes ventes Leboncoin ne sont pas encore lues »
          // juste dessous dit déjà le geste (« Ouvre « Mes transactions »… », avec son bouton) : une fois (§7).
          : enSection ? <>Colis Leboncoin : pas encore lus.</> : <>Pas encore lu : ouvre « Mes transactions » sur leboncoin.fr.</>}</div></Card>
      ) : (<>
        {/* ── À GÉNÉRER : vendu, mais le bordereau n'existe pas encore ──────────
            Générer un bordereau Leboncoin est une action SUR leboncoin.fr (API de
            livraison, session requise) : l'app ne peut pas le faire seule (comme
            sur Vinted, où c'est l'extension qui le fait). On ouvre donc la vente
            sur Leboncoin pour que le bordereau s'y crée — VRM le capte ensuite et
            la vente passe dans « Prêts à poster ». */}
        {aGenerer.length > 0 && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 8px 2px' }}>
            <div style={{ flex: 1, fontSize: 11, color: C.warn, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Bordereau à générer ({aGenerer.length})</div>
            {aGenerer.length > 1 && <button type="button" onClick={() => { if (aGenerer.length > 4 && !window.confirm(`Ouvrir ${aGenerer.length} ventes Leboncoin pour générer leurs bordereaux ?`)) return; aGenerer.forEach(o => { try { window.open(lbcUrl(o), '_blank', 'noopener'); } catch (_) {} }); }}
              style={{ flexShrink: 0, border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 12, padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Générer tous ↗</button>}
          </div>
          {aGenerer.map(o => carte(o, { principal: 'generer' }))}
        </>)}
        {/* ── PRÊTS À POSTER : bordereau dispo → imprimer + étiquette N° + QR ──── */}
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: (aGenerer.length ? '16px' : '2px') + ' 0 8px 2px' }}>Prêts à poster ({prets.length})</div>
        {prets.length === 0 ? <Card style={{ marginBottom: 14 }}><div style={{ fontSize: 13, color: C.muted }}>{aGenerer.length ? 'Génère les bordereaux ci-dessus, ils arriveront ici.' : 'Rien à poster — tout est parti. 👌'}</div></Card>
          : prets.map(o => carte(o, { principal: 'imprimer' }))}
        {postes.length > 0 && (<>
          <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: '16px 0 8px 2px' }}>En livraison ({postes.length})</div>
          <Card>
            {postes.map((o, i) => { const n = numDe(o); const lbl = o.label || {}; return (
              <div key={o.txId} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <PhotoVente src={photoArticle(o)} size={40} />
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title || '(sans titre)'}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{estFait(o) ? 'Posté' : (o.stepLabel || 'Posté')}{lbl.reference ? ` · ${lbl.reference}` : ''}</div>
                </div>
                {badgeNum(n)}
                {estFait(o) && !lbcExpediee(o) && <button type="button" onClick={() => toggleFait(o)} title="Remettre dans les colis à poster" style={{ flexShrink: 0, border: 'none', background: 'transparent', color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>↺ Pas encore</button>}
                {lbl.trackingUrl && <a href={lbl.trackingUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0, color: C.accentTexte, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>Suivre ↗</a>}
              </div>
            ); })}
          </Card>
        </>)}
      </>)}
      {/* ── BORDEREAU PRÊT : ouvre l'onglet d'impression + propose de DÉPLACER le
          N° — exactement comme l'écran Colis Vinted (même modale, même store). */}
      {modaleBord}
    </div>
  );
}
// ⟦← App.jsx #4⟧
// Les commandes eBay de TOUS ses comptes, pour l'argent (CA déclaré, bilan,
// « ventes payées ») : un seul compte illisible ⇒ `null` (« pas su ») — jamais
// un total partiel présenté comme complet (§5).
async function commandesEbayTous() {
  const r = await lireEbayTous('ebay_orders', SEL_EBAY_COMMANDES, 'orders');
  return (!r || r.illisibles.length) ? null : r.items;
}
// ⟦← App.jsx #5⟧

/* ── Paramètres (accessible via le rouage en haut à droite) ──────────────── */
// Écran LEBONCOIN dans l'app : vue d'ensemble du cross-posting (lecture seule),
// consultable depuis le téléphone. La publication elle-même se fait via
// l'extension sur leboncoin.fr (assistant 1-clic). Ici on montre : combien
// publiées / ton offre, ce qu'il reste à publier, et ce qu'il faut retirer
// (vendu sur Vinted). Tout est lu depuis Supabase (0 appel Vinted/Leboncoin).
// ── RELIER UNE ANNONCE LEBONCOIN À UNE PAIRE, À LA MAIN (C4, 30 sept.) ─────
// « Annonce Leboncoin non reliée : afficher la photo + pouvoir la relier à un N°
// dans l'app. » Le lien est une IDENTITÉ posée par lui (son clic), jamais une
// ressemblance : il tape le N° qu'il reconnaît sur la photo, ou clique une des
// paires proposées (4 octobre) — la proposition ne relie rien toute seule. Un
// N° que VRM ne connaît pas est refusé (sinon le lien ne mènerait à aucune
// paire, et l'annonce resterait « non reliée » sans le dire).
// Pose le lien « annonce Leboncoin → N° de paire » (une identité qu'il pose
// lui-même, §5). Une seule écriture pour les deux chemins (champ N° et clic sur
// une suggestion) — sinon l'un des deux finirait par ne plus écrire pareil (§11).
function relierAnnonceLbc(id, n) {
  const liens = { ...(load('vrm_lbc_liens', {}) || {}), [String(id)]: String(n) };
  // ⚠️ `save` écrit 500 ms plus tard : l'écran se rechargeait AVANT et ne
  //    voyait pas le lien (vu au banc). On pose la copie locale tout de
  //    suite ; `save` garde la synchro vers le nuage.
  ecrireCopieLocale('vrm_lbc_liens', liens);
  save('vrm_lbc_liens', liens);
}
// « Je me suis trompé » (16 oct., Julien : « j'ai mal relié une paire, il faut
// que je puisse enlever ça »). On ne SUPPRIME pas la clé : le nuage la
// rendrait à la fusion (local par-dessus nuage). On pose une valeur VIDE, que
// l'app (`clesAnnonceLbc`) et l'extension (`adRefKeys`, `cleNum('')`) ignorent
// — l'annonce redevient « non reliée » et peut être reliée à la bonne paire.
// (9 nov.) Le geste lui-même : `gesteDelierLbc` (annulable), juste en dessous.
// (9 nov., lot B — « Annuler » au lieu d'une confirmation) Délier est RÉVERSIBLE dans VRM (une
// valeur de `vrm_lbc_liens`, rien chez Leboncoin) : il part tout de suite et la pilule offre
// « Annuler » 5 s, qui remet EXACTEMENT le lien d'avant (le même N°). La copie locale suit tout de
// suite (l'écran se relit, comme `relierAnnonceLbc`) ; l'écriture passe par la file du geste.
function gesteDelierLbc(id, numero, reload) {
  if (id == null) return;
  const k = String(id);
  const avant = (load('vrm_lbc_liens', {}) || {})[k];
  if (avant == null || String(avant).trim() === '') return;
  const poserLocal = (v) => { try { const l = { ...(load('vrm_lbc_liens', {}) || {}), [k]: v }; ecrireCopieLocale('vrm_lbc_liens', l); } catch (_) {} };
  gesteVrm(numero ? `Lien avec la N°${numero} retiré` : 'Lien retiré', [{ k: 'vrm_lbc_liens', type: 'cle', id: k, apres: '', avant }], {}, (sens) => {
    poserLocal(sens === 'apres' ? '' : avant);
    if (typeof reload === 'function') { try { reload(); } catch (_) {} }
  });
}
// « Ce n'est aucune de celles-là » (16 oct., Julien : « ça sert à rien de relier
// une paire vendue, je n'ai plus de numéro »). Sa réponse, rangée par identité
// — `tx:{transaction}` pour une vente, `ad:{annonce}` pour une annonce en ligne —
// jamais déduite. La question ne revient plus pour elle. Même double écriture
// que le lien (copie locale tout de suite, nuage ensuite).
function rangerSansJumelleLbc(cle) {
  if (!cle) return;
  const m = { ...(load('vrm_lbc_pas_de_paire', {}) || {}), [String(cle)]: new Date().toISOString() };
  ecrireCopieLocale('vrm_lbc_pas_de_paire', m);
  save('vrm_lbc_pas_de_paire', m);
}

// ── SUGGESTIONS POUR RELIER UNE ANNONCE — JAMAIS UNE DÉCISION (§5) ──────────
// Julien, 4 octobre : « quand une paire est vendue sur une plateforme, elle
// doit disparaître des autres, pour ne pas vendre deux fois la même paire ».
// Mesuré le jour même : 3 ventes Leboncoin (dont un colis à envoyer) portaient
// sur des annonces reliées à AUCUNE paire — ni référence VRM, ni N° dans le
// titre. Impossible, donc, de savoir laquelle est encore en vente sur Vinted.
// ⇒ On PROPOSE les paires en ligne qui ressemblent (mots du titre, pointure,
//   prix) pour qu'il reconnaisse la sienne en un clic. ⚠️ Une ressemblance ne
//   relie RIEN toute seule : 22 % des ventes portent un titre en double, et le
//   titre a déjà désigné la mauvaise paire (§5). C'est SON clic qui pose
//   l'identité ; la suggestion ne fait qu'éviter de taper le numéro.
const motsDeTitre = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9,.]+/g, ' ').split(' ').filter((w) => w.length >= 2 && !/^(taille|pointure|neuf|neuve|tres|bon|etat|avec|pour|les|des|une|homme|femme|paire)$/.test(w));
// La pointure : d'abord ce qui suit « taille », « pointure » ou « T » ; sinon le
// DERNIER nombre de 16 à 50. ⚠️ Pas le premier nombre venu : dans « Nike Air
// Max 90 … taille 44 », c'était « 90 », et une paire en 42 était proposée
// (vu par `audit-double-vente.cjs`).
const pointureDe = (s) => {
  const t = String(s || '');
  const m = /(?:taille|pointure|\bt|\bp)\s*(\d{2}(?:[.,]5)?)(?!\d)/i.exec(t);
  if (m) return m[1].replace(',', '.');
  const tous = [...t.matchAll(/(?:^|[^\d])(\d{2}(?:[.,]5)?)(?=[^\d]|$)/g)].map((x) => x[1].replace(',', '.')).filter((x) => { const n = parseFloat(x); return n >= 16 && n <= 50; });
  return tous.length ? tous[tous.length - 1] : null;
};
// 23 oct. (capture de Julien) : une Adidas Spezial marron 40,5 vendue 45 € sur
// Leboncoin proposait « N°65 Nike LD waffle sacai » — même pointure (+3), prix
// proche (+2), donc 5, sans UN SEUL mot en commun. Une suggestion qui désigne
// une autre marque fait douter de toutes les autres. Deux règles de plus :
// une MARQUE différente écarte la paire (Jordan est de la famille Nike), et il
// faut au moins un mot du MODÈLE en commun (ni la marque, ni une couleur, ni
// un nombre) — même pointure et même prix ne disent rien du modèle.
const familleMarque = (t) => { const b = extractBrand(String(t || '')); return b ? (/jordan/i.test(b) ? 'nike' : b.toLowerCase()) : null; };
const MOTS_HORS_MODELE = new Set(['nike', 'adidas', 'air', 'new', 'balance', 'asics', 'puma', 'reebok', 'vans', 'converse', 'salomon', 'hoka', 'lacoste', 'fila', 'saucony', 'mizuno', 'brooks',
  'noir', 'noire', 'noires', 'blanc', 'blanche', 'blanches', 'gris', 'grise', 'bleu', 'bleue', 'rouge', 'vert', 'verte', 'marron', 'beige', 'rose', 'jaune', 'orange', 'violet', 'kaki', 'creme', 'black', 'white', 'grey', 'gray', 'blue', 'red', 'green', 'brown',
  'chaussures', 'chaussure', 'baskets', 'basket', 'sneakers', 'sneaker', 'low', 'high', 'mid']);
const motsModele = (s) => motsDeTitre(s).filter((w) => !/^\d/.test(w) && !MOTS_HORS_MODELE.has(w));
function suggestionsPaires(cible, candidats, max = 3) {
  const mc = new Set(motsDeTitre(cible && cible.titre));
  const mm = new Set(motsModele(cible && cible.titre));
  const fc = familleMarque(cible && cible.titre);
  const tc = pointureDe(cible && cible.titre);
  const pc = Number(cible && cible.prix);
  return (candidats || []).map((c) => {
    let note = 0;
    const texte = `${c.titre || ''} ${c.marque || ''}`;
    for (const w of new Set(motsDeTitre(texte))) if (mc.has(w)) note += /^\d/.test(w) ? 1 : 2;
    // Une autre marque, ou aucun mot du modèle en commun : ce n'est pas la même paire.
    const f = familleMarque(texte);
    if (fc && f && fc !== f) return { ...c, note: -1 };
    if (!motsModele(texte).some((w) => mm.has(w))) return { ...c, note: -1 };
    const t = pointureDe(c.taille) || pointureDe(c.titre);
    // Une pointure DIFFÉRENTE écarte la paire, quoi que disent les mots : c'est
    // le cas des « 50 paires identiques » (§2.4) — même modèle, autre paire.
    if (tc && t && tc !== t) return { ...c, note: -1 };
    if (tc && t) note += 3;
    if (pc > 0 && Number(c.prix) > 0) { const r = Math.abs(pc - c.prix) / Math.max(pc, c.prix); if (r <= 0.15) note += 2; else if (r > 0.6) note -= 1; }
    return { ...c, note };
  }).filter((x) => x.note >= 4).sort((a, b) => b.note - a.note).slice(0, max);
}
// ⟦← App.jsx #6⟧
// Le compte Leboncoin connecté en DERNIER dans son navigateur (session vue), sinon
// rien : « le dernier compte vu » n'est pas « le compte connecté ».
function compteLbcConnecte(accounts) {
  const l = Object.values(accounts || {}).filter((a) => a && a.sessionAt);
  l.sort((a, b) => String(b.sessionAt).localeCompare(String(a.sessionAt)));
  return l[0] || null;
}
// ⟦← App.jsx #7⟧
// Une annonce pas revue depuis plus de 7 jours : on ne sait pas si elle est
// encore sur Leboncoin. On ne demande pas « quelle paire ? » pour elle (relier
// une annonce morte à une paire vivante), on dit le geste qui tranche. Sans date
// de passage (`seenAt` absent), on ne sait pas qu'elle est vieille : rien ne
// change pour elle (`null`).
const LBC_REVUE_JOURS = 7;
const lbcJoursSansVoir = (ad) => { const t = Date.parse((ad && ad.seenAt) || ''); return isFinite(t) ? (Date.now() - t) / 864e5 : null; };
const lbcPasRevue = (ad) => { const j = lbcJoursSansVoir(ad); return j != null && j > LBC_REVUE_JOURS; };
// ⟦← App.jsx #8⟧

function LbcRelier({ ad, numsConnus, onRelie, suggestions, detail, vendue = false, cleRangement = '' }) {
  const [num, setNum] = useState('');
  const [msg, setMsg] = useState('');
  const photo = (Array.isArray(ad.images) && ad.images[0]) || ad.image || '';
  const id = ad.id != null ? String(ad.id) : '';
  const poser = (n) => {
    if (!id) { setMsg("Cette annonce n'a pas d'identifiant Leboncoin : impossible de la relier."); return; }
    relierAnnonceLbc(id, n);
    setMsg('');
    toast(`Annonce reliée à l'article N°${n}.`);
    onRelie && onRelie();
  };
  const aucune = () => { rangerSansJumelleLbc(cleRangement); toast('Compris — je ne te le redemande plus.'); onRelie && onRelie(); };
  const relier = () => {
    // « n125 » (l'écriture des titres Vinted) vaut 125 — sauf s'il existe une
    // vraie série « N » : alors N125 est un numéro à part entière.
    const brut = cleNum(num);
    const sansN = brut.replace(/^N[°O]?(?=\d)/, '');
    let n = numsConnus.includes(brut) ? brut : sansN;
    // (16 oct.) Le numéro écrit sur le CARTON d'une ancienne paire (« 233 ») est
    // devenu « B233 » à la remise à zéro du 11 octobre : on le reconnaît, sans
    // jamais prendre la nouvelle paire du même chiffre quand elle existe.
    if (!numsConnus.includes(n) && /^\d+$/.test(n) && numsConnus.includes('B' + n)) n = 'B' + n;
    if (!NUM_OK.test(n)) { setMsg('Tape le numéro de l’article (125, ou B125).'); return; }
    if (!numsConnus.includes(n)) { setMsg(`Aucun article ne porte le N°${n} dans VRM.`); return; }
    poser(n);
  };
  const sugg = (suggestions || []).filter((s) => s && s.numero);
  const btn = { border: 0, borderRadius: 999, background: 'var(--d-remplir)', color: C.text, padding: '0 14px', minHeight: 'var(--d-h-ctrl)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div data-lbc-relier={id} style={{ padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: C.card2 || C.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photo ? <PhotoVinted src={photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Icon name="image" size={18} style={{ color: C.muted, opacity: .55 }}/>}
        </div>
        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.subject || ad.title || '—'}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {detail || (ad.price != null && isFinite(Number(ad.price)) ? `${Number(ad.price).toFixed(2).replace('.', ',')}\u00a0€` : '')}{ad.customRef ? ` · réf ${ad.customRef}` : ''}
            {ad.url ? <> · <a href={ad.url} target="_blank" rel="noreferrer" className="vrm-lien-touche" style={{ color: C.accentTexte, fontWeight: 600 }}>voir</a></> : null}
          </div>
          {msg && <div style={{ fontSize: 12, color: C.warn, marginTop: 3 }}>{msg}</div>}
        </div>
        {/* Une paire VENDUE n'a plus de numéro à taper (Julien, 16 oct.) : seule
            l'annonce encore en ligne garde le champ N°. */}
        {!vendue && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
            <input value={num} onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') relier(); }}
              inputMode="numeric" placeholder="N°" aria-label="N° de l'article"
              style={{ width: 58, border: `1px solid ${C.border}`, borderRadius: 12, padding: '7px 8px', background: C.bg, color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}/>
            <button type="button" onClick={relier} style={btn}>Relier</button>
          </div>
        )}
      </div>
      {/* Les paires ENCORE EN VENTE SUR VINTED qui y ressemblent, à confirmer :
          c'est son clic qui relie, jamais la ressemblance (§5). */}
      {sugg.length > 0 && (
        <div data-lbc-suggestions={id} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: C.muted }}>{vendue ? 'Est-ce le même article ?' : "C'est peut-être :"}</span>
          {sugg.map((s) => (
            <button key={s.numero} type="button" data-suggestion={s.numero} onClick={() => poser(s.numero)} title={s.titre || ''}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, color: C.text, padding: '6px 10px 6px 6px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: 0 }}>
              {s.photo ? <PhotoVinted src={s.photo} alt="" loading="lazy" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}/> : null}
              <b style={{ flexShrink: 0 }}>N°{s.numero}</b>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: C.muted }}>{s.titre || ''}</span>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: C.accentTexte }}>{vendue ? "C'est lui" : 'Relier'}</span>
            </button>
          ))}
        </div>
      )}
      {cleRangement && (
        <div style={{ marginTop: 8 }}>
          <button type="button" data-lbc-aucune={cleRangement} onClick={aucune} style={btn}>{sugg.length ? 'Aucun de ceux-là' : 'Pas d’article à relier'}</button>
        </div>
      )}
    </div>
  );
}
// (19 nov.) L'ancienne feuille « Relier à Vinted » (`ChoixVintedLbc` : vignettes minuscules, textes superposés, la bonne
// paire troisième, deux gestes) est RETIRÉE : « Relier » ouvre le parcours « Relier mes annonces »
// (src/LiaisonSites.jsx, `ouvrirLiaison`), photo contre photo, la plus proche en tête, un toucher. Ne pas la remettre.

const MAIN_LEBONCOIN = ['vinted_annonce_numeros', 'vinted_accounts_hidden', 'vinted_accounts_blocked', 'vinted_pairs_lost', 'vrm_lbc_liens', 'vrm_lbc_pas_de_paire'];
// La limite d'annonces de son offre Leboncoin (le compteur la compare au nombre
// en ligne). Elle se réglait dans le panneau sur leboncoin.fr, retiré en 5.130 :
// elle se règle ici, et c'est l'extension qui l'écrit (propriétaire de la ligne
// `vinted_lbc_posted`, §11).
function QuotaLbc({ limit, plan, onFait }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [v, setV] = React.useState(limit ? String(limit) : '');
  const [msg, setMsg] = React.useState(null);
  const cap = extSait('publication');
  if (cap !== 'ok') return limit ? null : <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>La limite de ton offre se règle ici depuis l'ordinateur où l'extension {cap === 'retard' ? `est installée, une fois passée en ${EXT_CAPACITES.publication}` : 'est installée'}.</div>;
  const enregistrer = async () => {
    setMsg(null);
    const r = await vmrCmd({ cmd: 'lbcQuota', limit: v, plan: plan || '' });
    if (r && r.accepte) { setOuvert(false); onFait && onFait(); } else setMsg((r && r.raison) || "L'extension n'a pas répondu — réessaie.");
  };
  if (!ouvert) return (
    <button type="button" onClick={() => setOuvert(true)} style={{ marginTop: 6, border: 'none', background: 'transparent', padding: 0, minHeight: 0, color: C.accentTexte, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
      {limit ? 'Changer la limite de mon offre' : 'Indiquer la limite de mon offre Leboncoin'}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
      <input value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} inputMode="numeric" placeholder="ex. 50"
        style={{ width: 80, padding: '7px 9px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit' }}/>
      <span style={{ fontSize: 12, color: C.muted }}>annonces au maximum</span>
      <button type="button" onClick={enregistrer} style={{ border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 12, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Enregistrer</button>
      {msg && <span style={{ fontSize: 11, color: C.warn, width: '100%' }}>{msg}</span>}
    </div>
  );
}

// ── MESSAGES LEBONCOIN : COMBIEN DE NON-LUS, SUR QUEL COMPTE (4 octobre) ──────
// Julien : « dans Leboncoin, il y ait les messages ». Mesuré : AUCUNE conversation
// n'est captée, mais la page Leboncoin recharge elle-même un compteur de non-lus
// par compte ; l'extension (5.153) relaie ce NOMBRE et rien d'autre (aucun texte
// de message ne quitte sa page). On dit donc combien, sur quel compte, et on
// ouvre la messagerie de Leboncoin pour répondre. Lire les fils viendra après
// avoir mesuré leur forme — pas avant (§4.10, §6.3).
// Trois états, jamais deux : `undefined` en cours · `null` pas su · objet lu.
// « 0 » ≠ « jamais relevé », et un relevé ancien le dit (il ne se met à jour
// que quand une page leboncoin.fr est ouverte).
// ── RÉPUBLIER SUR LEBONCOIN (29 oct.) — Choisir · Modifier · Republier ───────
// La forme de « Republier » de Vinted (Julien : « exactement pareil »), sur ce
// que Leboncoin permet MESURÉ : il n'existe pas de « remonter » gratuit, une
// annonce neuve se fait en SUPPRIMANT l'ancienne (`lbcSupprime`, la requête vue
// dans ses gestes) puis en la RECRÉANT par la publication de VRM (`lbcPublier`,
// la même fiche que « Publier sur Leboncoin », §11). Une paire à la fois :
//   1. supprimer (sa confirmation, au départ, vaut pour le lot ; l'extension
//      revérifie compte et plafond pour CHAQUE annonce) — refus ou doute ⇒ arrêt,
//      la paire suivante n'est pas touchée ;
//   2. retirer sa marque « publiée » (sinon la file la croit encore en ligne) ;
//   3. publier sa fiche, puis ATTENDRE la page de confirmation de Leboncoin
//      avant la suivante (un dépôt à la fois, aucune attente artificielle).
// Ce qui ne peut pas être recréé n'est jamais proposé (voir `repub` dans l'écran).
// (11 nov., lot suivi-travail) Les étapes d'une annonce, telles que l'extension les dit (`progres.etape`).
const ETAPES_SUIVI_LBC_REPUB = [['coffre', 'Fiche mise dans le coffre'], ['suppression', 'Suppression sur Leboncoin'], ['marque', 'Remise dans la file de VRM'], ['depot', 'Dépôt demandé à l’extension'], ['ouverture', 'Ouverture du dépôt'], ['remplissage', 'Remplissage du formulaire'], ['photos', 'Envoi des photos'], ['etapes', 'Étapes du dépôt'], ['publication', 'Publication'], ['relu', 'Relue sur « Mes annonces »'], ['accepte', 'Publiée sur Leboncoin ✓']];
const ETAPES_SUIVI_LBC = ETAPES_SUIVI_LBC_REPUB.slice(3).filter(([k]) => k !== 'relu');
const ETAPES_SUIVI_EBAY = [['depot', 'Demande envoyée à l’extension'], ['formulaire', 'Formulaire eBay ouvert et rempli']];
// Une publication lancée sur SON clic (Leboncoin, eBay) : la feuille « VRM travaille » la suit
// jusqu'à ce que l'extension dise « fait », un geste à faire dans l'onglet, l'abandon ou le délai.
// `preparer` (eBay) : VRM remplit, c'est lui qui met en vente — l'annonce finit « à la main ».
function suivrePublicationSite({ sorte, titre, etapes, id, num, titreArticle, jobId, depuis, site, preparer = false }) {
  const t = suivi.demarrer({ sorte, titre, etapes, articles: [{ id, num: num || '', titre: titreArticle || '' }] });
  if (!t) return;
  t.etape(id, 'depot');
  if (preparer) { t.etape(id, 'formulaire'); t.fin(id, { etat: 'main', raison: `formulaire ${site} ouvert et rempli par l’extension`, geste: `Relis et mets en vente sur ${site}` }); t.terminer(''); return; }
  suivreJob(t, id, { jobId, lireJobs: () => __vmrJobs, depuis, delaiMs: 15 * 60000 }).then(({ fin, raison }) => {
    if (fin === 'fait') { t.etape(id, 'accepte'); t.fin(id, { etat: 'ok' }); }
    else if (fin === 'geste') t.fin(id, { etat: 'main', raison: `le dépôt attend ton geste dans l’onglet ${site}`, geste: `Termine-le dans l’onglet ${site}` });
    else if (fin === 'abandonne') t.fin(id, { etat: 'main', raison: RAISON_ABANDON[raison] || 'VRM n’a pas vu la fin du dépôt', geste: `Si tu l’as publiée toi-même, clique « Déjà publiée » ; sinon relance` });
    else if (fin === 'arret') t.fin(id, { etat: 'main', raison: `le dépôt continue dans l’onglet ${site}`, geste: `Regarde l’onglet ${site}` });
    else t.fin(id, { etat: 'main', raison: 'VRM n’a pas vu la fin du dépôt en 15 min', geste: `Regarde l’onglet ${site} avant de relancer` });
    t.terminer('');
  });
}
const REPUB_LBC_MAX = 10;   // le plafond de suppressions par heure de l'extension
const REPUB_LBC_ATTENTE_MS = 10 * 60000;
const attendreRepubLbc = (ms) => new Promise((r) => setTimeout(r, ms));
function prixRepubLbc(base, mode, val) {
  const b = Number(base);
  if (!(isFinite(b) && b > 0)) return null;
  if (mode === 'aucun') return b;
  const v = Number(String(val || '').replace(',', '.'));
  if (!(isFinite(v) && v > 0)) return null;
  const n = mode === 'pourcent' ? b * (1 - v / 100) : b - v;
  const r = Math.round(n * 100) / 100;
  return r >= 1 ? r : null;   // jamais sous 1 € : une baisse qui l'amènerait là ne part pas
}
// (11 nov., lot lbc-plus) « LE MÊME SYSTÈME QUE POUR VINTED » (Julien, validé) : c'est LUI
// qui choisit les annonces, l'ORDRE, l'ESPACEMENT (fixe ou au hasard) et qui lance ; fait
// PAR L'EXTENSION (le coffre d'abord — titre, description, prix, état, photos, critères, N° —,
// puis supprimer, recréer la même fiche, relire : la nouvelle annonce porte sa référence
// VRM-{N°}, une IDENTITÉ, le N° est gardé) ou À LA MAIN (VRM prépare la fiche copiable, les
// photos et l'ordre ; il coche « C'est fait »). Limite anti-abus : une fois par N jours et
// par annonce (30 par défaut, réglable, dite à l'écran ; src/lbcPlus.js). Jamais de
// remontée payante (le dépôt passe par `publierSansBooster`).
async function ecrireCoffreLbc(it, f, extra = {}) {
  try {
    const data = { v: 1, lbcId: String(it.lbc.id), num: String(it.numero), compte: it.lbc.compte || '', at: new Date().toISOString(),
      annonce: f && f.v && f.v.ok ? f.v.annonce : null, fiche: defautsFicheLbc(it),
      lbc: { titre: it.lbc.titre || '', prix: it.lbc.prix, url: it.lbc.url || '', photo: it.lbc.photo || '', publieeLe: it.lbc.publieeLe || '', favoris: it.lbc.favoris, vues: it.lbc.vues }, ...extra };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, { method: 'POST', headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(withOwner({ id: 'lbc_coffre_' + it.lbc.id, data })) });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
async function copierTexte(t) {
  try { await navigator.clipboard.writeText(String(t || '')); toast(tr('lbcplus.repub.copie'), 'ok'); return true; }
  catch (_) { toast(tr('lbcplus.repub.copieKo'), 'err'); return false; }   // une promesse rejetée n'est jamais « copié »
}
// (20 nov., décision de Julien) L'atelier « Republier sur Leboncoin » est retiré : la republication se fait dans le panneau de l'extension.
const CarteEcranLbc = ({ children, style, className }) => <div className={className} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, padding: '16px 18px', marginBottom: 14, boxShadow: C.shadow, ...style }}>{children}</div>;
const SousEcranLbc = ({ children }) => <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 4 }}>{children}</div>;
const TitreEcranLbc = ({ children, ...p }) => <div {...p} style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3, letterSpacing: '-.01em' }}>{children}</div>;
function LeboncoinScreen() {
  const [data, setData] = useState(null);
  // (31 oct.) Le compte Leboncoin OUVERT mis en avant, les autres estompés (§11).
  const lbcOuvert = useCompteLbcOuvert();
  const [loading, setLoading] = useState(true);
  const [erreurReception,setErreurReception]=useState(false);
  const suiviReception=useRef(null);
  const reload=()=>suiviReception.current?.actualiser();
  const sbGet = q => lireBaseRelue(`${SUPABASE_URL}/rest/v1/${q}`);
  const lireDonnees = async (estActif) => {
    setLoading(true);
    setErreurReception(false);
    // ⚠️ 197 Ko POUR EN LIRE 133 : cet écran lit `main` lui-même (c'est ce qui
    //    lui donne son propre `echecLecture`), mais il n'en utilise que QUATRE
    //    clés. Mesuré le 15 septembre : `select=data` 197 Ko / 795 ms, la
    //    projection 133 Ko / 442 ms, **valeurs identiques**. §4.4 : on ne
    //    rapatrie pas le blob d'une ligne lourde. L'alias porte le nom de la
    //    clé, donc la lecture ci-dessous ne change pas.
    const mainRows = await sbGet(`app_data?id=eq.main&select=${MAIN_LEBONCOIN.map(k => `${k}:data->${k}`).join(',')}`);
    // ⚠️ `sbGet` rend `null` quand la base n'a PAS RÉPONDU, et `[]` quand elle
    //    a répondu « rien ». Confondre les deux faisait fêter « Tout est
    //    publié 🎉 » une file qu'on n'avait jamais pu lire.
    const echecLecture = mainRows === null;
    const main = (mainRows && mainRows[0]) || {};
    const numeros = main.vinted_annonce_numeros || {};
    const postedRows = await sbGet('app_data?id=eq.vinted_lbc_posted&select=data');
    const pd = (postedRows && postedRows[0] && postedRows[0].data) || {};
    const posted = new Set((pd.ids || []).map(String));
    // (11 nov., robustesse des données, point 5) Ce qui est DÉJÀ sur Leboncoin pas lu
    // (`null`) : la file « à publier » listait alors TOUTES les paires déjà publiées,
    // et « Publier » en série les republiait en double. Pas lu ⇒ file vide, compteur
    // « — », et l'écran dit pourquoi.
    const postedKO = postedRows === null;
    // MÊMES RÈGLES DE COMPTE QUE LE RESTE DE L'APP : un compte MASQUÉ à la main
    // ne doit pas alimenter la file (choix explicite de Julien).
    // ⚠️⚠️ UN COMPTE BANNI PAR VINTED (`vinted_accounts_blocked`), LUI, RESTE
    //    DANS LA FILE (Julien, 25 sept.) : « dès qu'un compte est banni, je veux
    //    pouvoir publier ses annonces sur Leboncoin/eBay/Vestiaire ». Les paires
    //    existent encore physiquement — le compte Vinted est mort, pas le stock.
    //    Elles sortent de « en ligne » Vinted (annBase/liveStats les écartent),
    //    mais restent PUBLIABLES ailleurs. C'est un renversement ASSUMÉ de
    //    l'ancienne règle « un compte fermé n'alimente aucune file » — qui, elle,
    //    ne vaut plus que pour les comptes SUPPRIMÉS (`vrm_blocked_accounts`).
    const offAcc = new Set((main.vinted_accounts_hidden || []).map(String));
    // ⚠️⚠️ ET LES SUPPRIMÉS DÉFINITIVEMENT (`vrm_blocked_accounts`) : une TROISIÈME
    //    liste, que ni `vinted_accounts_hidden` ni `vinted_accounts_blocked` ne
    //    recouvrent. Sans ça les paires d'un compte fermé par Vinted (mesuré :
    //    `shop_cancale`, 96 paires numérotées) étaient proposées à la
    //    republication, ici comme dans le panneau. `null`/échec ⇒ on n'exclut
    //    RIEN (ne pas cacher un compte vivant sur un hoquet — sens inverse du cas
    //    d'écriture). C'est la MÊME règle que `buildLbcData`/`buildEbayData` (§11).
    const blkRows = await sbGet('app_data?id=eq.vrm_blocked_accounts&select=data');
    ((blkRows && blkRows[0] && blkRows[0].data && blkRows[0].data.uids) || []).forEach((u) => offAcc.add(String(u)));
    const lost = main.vinted_pairs_lost || {};
    // (6 nov., vitesse 2) Projetés (§4.4), sans les comptes que l'écran écarte de
    // toute façon (`offAcc` : masqués, supprimés — chacun de leurs usages plus bas
    // les saute). Les autres, liés ou non, restent : la file doit être celle de
    // l'extension (`buildLbcData` lit tous les comptes, §11), et « vendue sur
    // Vinted → à retirer » a besoin de l'état de chaque annonce.
    const listRowsBrut = await lireDressings(sbGet, { exclure: [...offAcc] });
    // 5.167 (11 octobre) : seulement ce qui est EN LIGNE d'après la lecture la
    // plus récente de chaque compte — la même règle que l'écran Annonces et que
    // la file de l'extension (`enLigneDesLignes`, §11). Celles « à confirmer »
    // (compte pas relu depuis 24 h) ne sont ni dans la file, ni « à retirer de
    // Leboncoin » : on ne sait pas, on ne dit rien.
    const enl = await lireLignesEnLigne(listRowsBrut || []);
    const listRows = enl.lignes;
    const aConfirmerIds = new Set();
    for (const [u, l] of enl.aConfirmer) if (!offAcc.has(String(u))) for (const it of l) if (it && it.id != null) aConfirmerIds.add(String(it.id));
    // Les photos HD et la description ne viennent QUE de la page de l'annonce :
    // mesuré le 12 septembre, l'API Vinted ne renvoie aucune photo (0 sur 57
    // lignes `harvest_*_item_*`, captures jusqu'au 9 septembre). Sans cette
    // lecture, l'écran ne peut pas dire avec combien de photos une annonce
    // partirait — et 54 des 59 partiraient avec UNE SEULE.
    // (6 nov., vague 2) Lue plus bas, une fiche par annonce en ligne numérotée
    // (`lireFichesPage`) : jamais la ligne entière (§4.4).
    // ⚠️ « VENDUE » SE PROUVE (§5). Les 400 lignes `harvest_*_txn_*` portent
    //    toutes leur `item_id` : c'est l'identité qui relie une vente à son
    //    annonce. Mesuré : sur 400 annonces fermées, 151 seulement ont une vente
    //    prouvée — « plus en ligne » ne veut donc pas dire « vendue ».
    // ⚠️⚠️ ET ON NE DEMANDE QUE `item_id`, PAS LE BLOB (§4.4). Mesuré le
    //    15 septembre sur sa vraie base : `select=data` sur ces 704 lignes rend
    //    **19,8 Mo en 5,0 s** ; la projection rend **16 Ko en 0,36 s** —
    //    **1 251× moins d'octets, 14× plus vite**, et **exactement les mêmes
    //    242 ventes prouvées** (0 manquante, 0 en trop : c'est la preuve qu'un
    //    jugement métier n'a pas bougé). Le repli `t.item.id` n'existe nulle
    //    part dans ses données (704 lignes sur 704 portent `item_id`), donc il
    //    ne perd rien — et un `item_id` absent ne prouverait aucune vente de
    //    toute façon.
    // ⚠️⚠️⚠️ ET « CITÉE DANS UNE TRANSACTION » N'EST PAS « VENDUE ». Mesuré le
    //    15 septembre en vérifiant la FORME (§6) : sur les **711 lignes** de
    //    cette famille, **468 portent un `status_title` VIDE** — ce sont des
    //    CONVERSATIONS. Une seule annonce en portait treize (« salomon XT-6
    //    blanc taille 40 », toujours en ligne) : treize acheteurs lui ont écrit,
    //    aucun n'a acheté. La file écartait ainsi **15 paires qu'il a encore**.
    //    ⇒ Une vente est prouvée quand Vinted donne un ÉTAT DE COMMANDE à la
    //      transaction, et que cet état ne la fait pas REVENIR. On ne liste pas
    //      des codes : un code inconnu demain doit compter comme une vente.
    // ⚠️⚠️ ET « JE N'AI PAS PU LIRE » N'EST PAS « AUCUNE VENTE ». Mesuré en
    //    direct le 15 septembre : cette lecture a échoué une fois (base sous
    //    charge), le `|| []` l'a transformée en « aucune vente prouvée », et la
    //    file est passée de **40 à 55 paires** — quinze paires DÉJÀ VENDUES
    //    reproposées à la publication, sans un mot. C'est la plainte du
    //    13 septembre ressuscitée par un simple timeout.
    // ⚠️⚠️ (revue du 11 octobre) LA MÊME PREUVE QUE L'EXTENSION ET L'ÉCRAN eBAY
    //    (§11) : cet écran gardait sa propre boucle sur les seules transactions.
    //    Une vente prouvée par son BORDEREAU (le cas de la N°553) sortait de la
    //    file de l'extension et restait ici « à publier » — et le clic
    //    « Publier » était alors refusé par l'extension, qui relit SA file. Et
    //    une transaction figée sur « payée » d'une vente remboursée restait
    //    « vendue ». Une règle (`lirePreuvesVenteVinted`), `null` = pas su.
    // ⚠️ (revue du 11 octobre, défaut 12) + `ancienne` : ce que les extensions
    //    PUBLIÉES (jusqu'à la 5.170) disent vendu sur la seule transaction. Une
    //    paire REVENUE (vente remboursée ensuite) est « à publier » ici et
    //    « vendue » pour elles : leur « Publier » serait refusé.
    const preuveP = await lirePreuvesVenteVinted();
    const preuveLue = preuveP ? preuveP.vendus : null;
    const ancienne = (preuveP && preuveP.ancienne) || new Set();
    const preuveKO = preuveLue === null;
    const vendus = preuveLue || new Set();
    const online = []; const onlineIds = new Set(); const seen = new Set(); const etatVinted = {};
    for (const r of listRows) {
      const uid = String(r.id).split('_')[1];
      if (offAcc.has(uid)) continue;
      const p = (r.data && r.data.payload) || {};
      for (const it of (p.items || [])) {
        const oid = String(it.id);
        etatVinted[oid] = it.is_hidden ? 'pause' : (it.is_draft ? 'brouillon'
          : (it.is_closed ? (vendus.has(oid) ? 'vendue' : 'fermee') : 'enligne'));
        if (it.is_closed || it.is_hidden || it.is_draft) continue;
        onlineIds.add(oid); if (seen.has(oid)) continue; seen.add(oid);
        online.push({ id: oid, uid, title: it.title, brand: it.brand_title || '', size: it.size_title || '', status: it.status || '', color: [it.color1, it.color2].filter(Boolean).join(' '), price: (it.price && it.price.amount) || it.price || null, photo: (it.photo && it.photo.url) || '', nPhotos: Number.isFinite(it.nPhotos) ? it.nPhotos : (it.photos_count != null ? Number(it.photos_count) : undefined) });
      }
    }
    // Seules les annonces en ligne NUMÉROTÉES passent par `itemFileLbc` (la file et
    // Republier) : ce sont les seules fiches lues. Illisible ⇒ `{}` comme avant.
    const pageDet = (await lireFichesPage(online.filter((o) => { const e = numeros[o.id]; return e && e.numero && String(e.numero).trim() !== ''; }).map((o) => o.id), lireBaseRelue)) || {};
    // ── OÙ EN EST LA PRÉPARATION DE LA PUBLICATION AUTOMATIQUE ────────────────
    // L'extension collecte depuis quatre versions (le catalogue des codes, la
    // config du formulaire dynamique, la forme de ce qui part) et l'app n'en
    // montrait RIEN : impossible pour lui de savoir si ça avance, ni quel geste
    // fait avancer. C'est le motif du tiroir `Nav` (§4.11).
    // ⚠️ §4.4 : on ne lit PAS `lbc_catalogue` (des centaines de Ko) ni
    //    `lbc_recon` (67 Ko). C'est l'extension qui PUBLIE un résumé de 1 Ko,
    //    l'app le CONSOMME — le motif de `vrm_colis_prets` (§11).
    const prepRows = await sbGet('app_data?id=eq.vrm_lbc_prep&select=data');
    // Trois états, jamais deux : `null` = pas su, `[]` = jamais publié, sinon lu.
    const prep = prepRows === null ? null : ((prepRows[0] && prepRows[0].data) || {});

    // Comptes Leboncoin réellement vus dans le navigateur (captés par l'extension).
    // Le compte Vinted d'où vient chaque paire (la fiche le nomme) : login, ou
    // le nom qu'il lui a donné. Lecture ratée ⇒ aucun nom, jamais un faux.
    const vaRows = await sbGet('vinted_accounts?select=vinted_user_id,login');
    const labelsComptes = load('vinted_account_labels', {}) || {};
    const nomCompteDe = (u) => { const a = (vaRows || []).find((x) => String(x.vinted_user_id) === String(u)); return labelsComptes[String(u)] || (a && a.login) || ''; };
    const accRows = await sbGet('app_data?id=eq.lbc_accounts&select=data');
    const accsLbc = (accRows && accRows[0] && accRows[0].data && accRows[0].data.accounts) || {};
    // Le compte connecté en dernier (session vue) d'abord, puis les autres.
    const lbcAccounts = Object.values(accsLbc).filter(Boolean)
      .sort((a, b) => String(b.sessionAt || '').localeCompare(String(a.sessionAt || '')) || String(b.seenAt || '').localeCompare(String(a.seenAt || '')));
    const lbcConnecte = compteLbcConnecte(accsLbc);
    // Annonces Leboncoin réellement captées (par l'extension). On s'en sert pour
    // reconnaître TOUT SEUL ce qui est déjà en ligne là-bas, via la référence
    // pro (CustomRef) ou le « nXXXX » du titre — même logique que l'extension,
    // pour que les deux écrans racontent la même chose.
    // (31 oct.) Projetée (§4.4) : les annonces et les dates des listes complètes.
    const lbcRows = await sbGet('app_data?id=eq.lbc_listings&select=items:data->items,lectures:data->lectures');
    // ⚠️ « jamais capté » n'est pas « zéro annonce » : sans cette ligne, le
    //    rapprochement par référence est impossible, donc « vendue sur Vinted →
    //    à retirer » ne peut RIEN trouver. L'écran doit le dire, pas afficher 0.
    // « jamais capté » = aucune annonce QUI SOIT À LUI (la ligne peut exister et
    // ne contenir que des annonces d'autres).
    const lbcJamaisLu = lbcRows !== null && !(lbcRows && lbcRows[0]);
    const lbcItems = (lbcRows && lbcRows[0] && lbcRows[0].items) || {};
    const lbcAds = Object.values(lbcItems).filter(Boolean);
    // Ses ventes Leboncoin PROUVÉES (il est le vendeur) : elles disent quels
    // comptes Leboncoin sont les siens, et quelles paires sont déjà parties.
    // `null` = pas su : on n'en tire RIEN (ni compte, ni double vente).
    const lbcVentesRows = await sbGet('app_data?id=eq.lbc_ventes&select=data');
    const ventesLbcKO = lbcVentesRows === null;
    const ventesLbc = (lbcVentesRows && lbcVentesRows[0] && lbcVentesRows[0].data && lbcVentesRows[0].data.ventes) || {};
    const prouves = new Set([...comptesLbcProuves(ventesLbc, lbcItems), ...comptesLbcSession(accsLbc)]);
    // ⚠️ LE LIEN POSÉ À LA MAIN D'ABORD (C4) : « Relier » écrit annonce LBC →
    //    N° dans `vrm_lbc_liens`. C'est une identité qu'il pose lui-même — la
    //    même règle vit dans l'extension (`adRefKeys`), sinon l'app relie et le
    //    panneau ne relie pas (§11). La copie locale prime sur le nuage : elle
    //    est plus récente que la dernière synchro (l'envoi est différé).
    const liens = { ...(main.vrm_lbc_liens || {}), ...(load('vrm_lbc_liens', {}) || {}) };
    // Toutes les clés passent par `cleNum` (« VRM-b125 » = « B125 »), des deux
    // côtés — la même règle que l'extension (`adRefKeys`, §11).
    const adKeys = (ad) => clesAnnonceLbc(ad, liens);
    // ⚠️ ET ON NE GARDE QUE CE QU'ON PEUT LUI ATTRIBUER. Mesuré le 13 septembre :
    //    81 annonces rangées par la capture n'étaient pas les siennes (chalets,
    //    gîtes — le flux « découverte » de la page qu'il regardait). Sans ce
    //    filtre elles ressortaient toutes en « annonces non reliées », et le
    //    compteur annonçait 81. Une annonce est à lui si elle porte notre
    //    référence VRM, ou si son propriétaire est connu.
    // ⚠️ Et un compte dont il a VENDU une annonce est le sien (`comptesLbcProuves`,
    //    4 octobre) : ses 7 autres annonces étaient invisibles ici.
    const aLui = (ad) => annonceLbcALui(ad, prouves);
    // Une annonce qu'il a VENDUE sur Leboncoin n'y est plus en vente : elle ne
    // compte ni « en ligne », ni « à retirer », ni « non reliée » — elle a son
    // propre bloc (vendue ici, encore sur Vinted ?).
    const vendusLbc = annoncesLbcVendues(ventesLbc);
    const liveAds = lbcAds.filter(ad => annonceLbcEnVente(ad, vendusLbc) && aLui(ad));
    // (6 nov.) CE QU'ON COMPTE « EN LIGNE » : la règle de Vinted appliquée à
    // Leboncoin (src/enLigneLbc.js) — la lecture COMPLÈTE de « Mes annonces » de
    // son compte, de moins de 24 h. Plus vieille ou jamais faite ⇒ « à confirmer »
    // (hors du compte, rien effacé). `liveAds` (la règle partagée) reste ce qui
    // PROTÈGE : file à publier, « à retirer » — une annonce à confirmer peut
    // encore être en ligne (sens sûr).
    const bilanLbc = bilanEnLigneLbc(lbcAds.filter(aLui), { enVente: (ad) => annonceLbcEnVente(ad, vendusLbc), lectures: (lbcRows && lbcRows[0] && lbcRows[0].lectures) || {}, maintenant: Date.now() });
    // (22 oct.) Ce qui n'est plus compté en ligne : plus vue dans une liste
    // COMPLÈTE de son compte, ou mise en pause depuis VRM. Rien n'est effacé ;
    // l'écran le dit, une fois. Et les N° dont l'annonce est sortie : plus rien
    // à retirer pour eux (même règle que le tableau de bord, §11).
    const sortiesLbc = lbcAds.filter((ad) => aLui(ad) && !vendusLbc.has(String(ad.id)) && lbcSortieDe(ad));
    const lecturesLbc = (lbcRows && lbcRows[0] && lbcRows[0].lectures) || {};
    // La preuve qu'aucune autre annonce de la paire n'est en ligne : une liste
    // complète de chacun de ses comptes, postérieure à la marque « publiée ».
    // Comptes, ventes ou annonces illisibles ⇒ pas de preuve (pas su ≠ sorti).
    const preuveListes = (accRows === null || ventesLbcKO || lbcRows === null || postedRows === null) ? null
      : { lectures: lecturesLbc, comptes: prouves, depuis: pd.updatedAt || '' };
    const { prouves: numsSortis, sorties: numsSortiesDoute } = numerosLbcSortis(lbcItems, liens, vendusLbc, preuveListes);
    const pasRevues = liveAds.filter(lbcPasRevue);
    const refToAd = new Map();
    liveAds.forEach(ad => adKeys(ad).forEach(k => { if (!refToAd.has(k)) refToAd.set(k, ad); }));
    // (31 oct.) Le « nXXX » d'un TITRE Vinted n'est plus une clé (§5) : après la
    // remise à zéro 013, « n230 » d'un titre peut être l'ancien numéro d'une AUTRE
    // paire — il faisait sortir de la file (« déjà sur Leboncoin ») une paire jamais
    // publiée. Seul le N° de la fiche compte, la même règle que l'extension
    // (`vintedKeys`, §11). `id` et `title` gardés pour les appelants.
    const vKeys = (id, _title) => { const e = numeros[id] || {}; return e.numero ? [cleNum(e.numero)].filter(Boolean) : []; };

    // ⚠️ CET ÉCRAN ET LE PANNEAU DE L'EXTENSION CALCULENT LA MÊME FILE, CHACUN
    //    DE SON CÔTÉ (le panneau tourne sur leboncoin.fr, où l'app n'est pas
    //    chargée). Ils doivent donc appliquer EXACTEMENT les mêmes règles, sinon
    //    l'app annonce « 12 à publier » et le panneau en montre 8 —
    //    `audit-places.cjs` vérifie que les deux filtres existent des deux côtés.
    const queue = []; let autoMatched = 0; let retirees = 0; let vendues = 0;
    // ⚠️ Combien d'annonces en ligne portent un numéro : sans ça, une file vide
    //    ne sait pas DIRE pourquoi elle est vide (voir le bloc « Tout est
    //    publié 🎉 » plus bas — il le disait à quelqu'un qui n'a aucune annonce).
    let nNumerotees = 0;
    // (17 oct.) La même paire sous deux N° (photo exacte, `jumellesParPhoto`) :
    // une seule des deux se publie. Notée ici sur toutes les annonces numérotées
    // (publiées ou non) ; la file reste celle de l'extension (§11), seule la
    // ligne le DIT et ne propose pas de publier la seconde.
    const candidatsJ = [];
    for (const o of online) { const e = numeros[o.id]; const num = e && e.numero; if (num && String(num).trim()) candidatsJ.push({ id: String(o.id), num: String(num), photoK: (e && e.photoK) || null, cover: o.photo || null, posee: posted.has(o.id) || posted.has(String(num)) }); }
    const jumLbc = jumellesParPhoto(candidatsJ, (k) => candidatsJ.some((c) => c.posee && cleNum(c.num) === k));
    const twinDe = (id) => { const j = jumLbc.get(String(id)); if (!j) return null; const posee = candidatsJ.find((c) => c.posee && j.autres.some((n) => cleNum(n) === cleNum(c.num))); return posee ? { num: posee.num, posee: true } : (j.gardeId !== String(id) ? { num: j.gardeNum, posee: false } : null); };
    // (29 oct.) Ce que la file — ET l'outil Republier — publiera pour une paire
    // (une règle, §11 : la fiche de republication est celle de « À publier »).
    const itemFileLbc = (o, e, num) => {
      // Ce que l'extension publiera VRAIMENT : le titre Leboncoin (même règle des
      // deux côtés), le prix, et le nombre de photos réellement disponibles.
      // Avant, cette liste montrait le titre VINTED brut — donc pas ce qui part.
      const d = pageDet[o.id] || {};
      const normPh = (p) => typeof p === 'string' ? p : (p && (p.url || p.full_size_url)) || '';
      // TOUTES les photos captées (Julien : « je veux à chaque fois toutes les
      // photos »), pas seulement la couverture. Le nombre RÉEL que Vinted annonce
      // (nPhotos) peut être plus grand que ce qui est capté : on le garde pour
      // dire « 6/12 captées » sans mentir.
      const photosAll = (Array.isArray(d.photos) ? d.photos.map(normPh).filter(Boolean) : (o.photo ? [o.photo] : []));
      const photos = photosAll.length;
      const nReelles = Number.isFinite(o.nPhotos) ? o.nPhotos : (Number.isFinite(d.nPhotos) ? d.nPhotos : null);
      return {
        id: o.id, numero: String(num), vinted: o.title || (e && e.title) || '',
        title: lbcTitre(d.brand || o.brand, d.title || o.title, d.size || o.size),
        prix: o.price != null ? Number(o.price) : null,
        photos, photosAll, nReelles, vignette: photosAll[0] || '',
        desc: !!lbcDescription(d.description),
        url: 'https://www.vinted.fr/items/' + o.id,
        croitVendue: ancienne.has(String(o.id)),
        // 5.182 : ce que la fiche « Publier sur Leboncoin » montre et laisse
        // corriger — les mêmes entrées que `buildLbcAd` dans l'extension (§11).
        base: String(d.title || o.title || '').trim(), marque: d.brand || o.brand || '', taille: d.size || o.size || '',
        etat: o.status || '', couleur: o.color || '', texte: lbcDescription(d.description),
        compte: nomCompteDe(o.uid), uid: o.uid != null ? String(o.uid) : '',
        jumelle: twinDe(o.id),
        // (3 nov.) Le prix d'achat CONNU (fiche du N°, sinon saisie par N°), pour
        // « vérifier avant de publier » — jamais deviné (§2.5).
        achat: (() => { try { return prixAchatDe(e, load('vinted_buyprice_by_num', {}) || {}); } catch (_) { return null; } })(),
      };
    };
    for (const o of online) {
      const e = numeros[o.id]; const num = e && e.numero;
      if (!num || String(num).trim() === '') continue;
      nNumerotees++;
      if (!mpChoisi(e, 'lbc')) { retirees++; continue; }             // retirée de la file par Julien
      // ⚠️⚠️ VENDUE = HORS DE LA FILE (mesuré : 14 des 57 « en ligne » ont une
      //    vente prouvée). La preuve prime sur l'état de l'annonce : Vinted ne
      //    la ferme pas toujours, et une capture peut dater de 85 h.
      if (vendus.has(o.id)) { vendues++; continue; }
      if (lost[String(num).trim()]) continue;                        // paire retirée du stock
      if (posted.has(o.id) || posted.has(String(num))) continue;
      if (vKeys(o.id, o.title).some(k => refToAd.has(k))) { autoMatched++; continue; } // déjà sur LBC
      queue.push(itemFileLbc(o, e, num));
    }
    queue.sort((a, b) => triNum(a.numero, b.numero));
    if (postedKO) queue.length = 0;

    // ── RÉPUBLIER SUR LEBONCOIN (29 oct.) ─────────────────────────────────────
    // Julien : « un outil de republication comme pour Vinted, exactement pareil ».
    // Republier = SUPPRIMER l'annonce Leboncoin (sur son clic confirmé,
    // `lbcSupprime`) puis la RECRÉER par la publication existante (`lbcPublier`).
    // La suppression est sans retour : on ne la propose QUE si la recréation passe
    // les mêmes règles que la file « À publier » (§11) — sinon l'extension
    // refuserait la recréation APRÈS avoir supprimé :
    //   · l'annonce désigne sa paire par IDENTITÉ (`numeroLbcIdentite` : lien posé
    //     à la main, référence VRM), jamais par un titre (§5) ;
    //   · aucune AUTRE annonce Leboncoin en vente ne porte ses clés (elle garderait
    //     la paire « déjà sur Leboncoin ») ;
    //   · une seule annonce Vinted en ligne pour ce N°, ni vendue, ni retirée du
    //     stock, cochée pour Leboncoin, sans jumelle ;
    //   · sa marque « publiée » se retire (identifiant Vinted, N° en chiffres).
    const repub = []; const repubKO = {};
    {
      const ko = (m) => { repubKO[m] = (repubKO[m] || 0) + 1; };
      const vParCle = new Map();
      for (const o of online) { const e = numeros[o.id]; const k = e && e.numero ? cleNum(e.numero) : ''; if (!k) continue; if (!vParCle.has(k)) vParCle.set(k, []); vParCle.get(k).push(o); }
      for (const ad of liveAds) {
        const k = numeroLbcIdentite({ itemId: ad.id }, lbcItems, liens);
        if (!k) { ko('sansPaire'); continue; }
        const os = vParCle.get(k) || [];
        if (!os.length) { ko('pasEnLigne'); continue; }
        if (os.length > 1) { ko('plusieurs'); continue; }
        const o = os[0]; const e = numeros[o.id] || {}; const num = String(e.numero).trim();
        if (vendus.has(String(o.id))) { ko('vendue'); continue; }
        if (lost[num] || !mpChoisi(e, 'lbc')) { ko('retiree'); continue; }
        const cles = vKeys(o.id, o.title);
        if (liveAds.some((x) => x !== ad && adKeys(x).some((kk) => cles.includes(kk)))) { ko('deux'); continue; }
        const marques = [String(o.id), num].filter((x, i, l) => posted.has(x) && l.indexOf(x) === i);
        if (marques.some((x) => !/^\d+$/.test(x))) { ko('marque'); continue; }
        const it = itemFileLbc(o, e, num);
        if (it.jumelle) { ko('jumelle'); continue; }
        const st = ad.stats || {};
        repub.push({ ...it, marques, lbc: {
          id: String(ad.id), titre: ad.subject || ad.title || '', prix: ad.price != null && isFinite(Number(ad.price)) ? Number(ad.price) : null,
          url: /^https:\/\/(?:www\.)?leboncoin\.fr\//i.test(String(ad.url || '')) ? ad.url : '', photo: (Array.isArray(ad.images) && ad.images[0]) || '',
          publieeLe: ad.publieeLe || '', favoris: Number.isFinite(st.favoris) ? st.favoris : null, vues: Number.isFinite(st.vues) ? st.vues : null,
          compte: ad.accountName || '',
        } });
      }
    }

    // (11 nov., lot lbc-plus) « Baisser le prix » : ses annonces EN VENTE (la règle partagée,
    // `liveAds`), chacune avec ses statistiques relevées (`lbcstats`) — la proposition se
    // décide dans src/lbcPlus.js, l'envoi sur SON clic (src/LbcBaissePrix.jsx).
    const baisse = liveAds.map((ad) => {
      const st = ad.stats || {};
      return { id: String(ad.id), uid: String(ad.account || ad.lbcUser || ''), compte: ad.accountName || '', numero: numeroLbcIdentite({ itemId: ad.id }, lbcItems, liens) || '',
        titre: ad.subject || ad.title || '', photo: (Array.isArray(ad.images) && ad.images[0]) || '', prix: ad.price != null && isFinite(Number(ad.price)) ? Number(ad.price) : null,
        favoris: Number.isFinite(st.favoris) ? st.favoris : null, vues: Number.isFinite(st.vues) ? st.vues : null, statsAt: st.at || '', publieeLe: ad.publieeLe || ad.createdAt || '' };
    });

    // (29 oct.) Une annonce PROUVÉE vendue ne garde pas son N° « en ligne » : c'est
    // ce qui cachait la N°18 (vendue le 18, annonce encore ouverte sur Vinted).
    const keysOnline = new Set(); online.forEach(o => { if (!vendus.has(String(o.id))) vKeys(o.id, o.title).forEach(k => keysOnline.add(k)); });
    for (const [u, l] of enl.aConfirmer) if (!offAcc.has(String(u))) for (const it of l) if (!vendus.has(String(it.id))) vKeys(String(it.id), it.title).forEach(k => keysOnline.add(k));
    const removals = [];
    // (29 oct.) La preuve de vente PRIME sur l'état de l'annonce (13 sept.) : Vinted
    // ne ferme pas toujours une annonce vendue.
    const etatDe = (oid) => (vendus.has(String(oid)) ? 'vendue' : (etatVinted[String(oid)] || 'inconnue'));
    for (const pid of posted) { if (!/^\d+$/.test(pid)) continue; if ((onlineIds.has(pid) && !vendus.has(pid)) || (aConfirmerIds.has(pid) && !vendus.has(pid))) continue; const e = numeros[pid] || {}; const kN = e.numero ? cleNum(e.numero) : ''; if (kN && numsSortis.has(kN)) continue; if (kN && keysOnline.has(kN)) continue; /* (29 oct.) republiée : une AUTRE annonce Vinted en ligne porte ce N° — la paire est là */ const so = kN ? numsSortiesDoute.get(kN) : null; removals.push({ numero: String(e.numero || '?'), title: e.title || '', etat: etatDe(pid), ...(so ? { sortie: so.quoi } : {}) }); }
    // Détection auto : annonce LBC active dont la paire n'est plus en ligne sur
    // Vinted = vendue → à retirer. Uniquement si la paire est connue de VRM.
    // ⚠️ Une paire « à confirmer » n'est pas « plus en ligne » : on ne sait pas.
    const keysKnown = new Set();
    for (const id in numeros) { const e = numeros[id] || {}; if (e.numero) keysKnown.add(cleNum(e.numero)); }
    const unlinked = [];
    for (const ad of liveAds) {
      const ks = adKeys(ad);
      // (22 oct.) Pas revue depuis plus de 7 jours : on ne demande pas « quelle
      // paire ? » (relier une annonce peut-être morte à une paire vivante) — la
      // ligne « pas revues » dit le geste qui tranche.
      if (!ks.length || !ks.some(k => keysKnown.has(k))) { if (!lbcPasRevue(ad)) unlinked.push(ad); continue; }
      if (ks.some(k => keysOnline.has(k))) continue;
      // L'état vient de l'annonce VINTED que ces clés désignent : l'annonce
      // Leboncoin, elle, ne sait rien de la vente.
      let etat = 'inconnue';
      for (const id in numeros) { const en = numeros[id] || {}; const k2 = cleNum(en.numero); if (k2 && ks.includes(k2)) { etat = etatDe(id); break; } }
      removals.push({ numero: ks[0], title: ad.subject || '', lbc: true, url: ad.url || '', etat, id: ad.id != null ? String(ad.id) : '', prix: ad.price != null && isFinite(Number(ad.price)) ? Number(ad.price) : null });
    }
    // (20 oct., audit sur données réelles) UNE PAIRE, UNE LIGNE. La même paire
    // arrivait par les deux sources — marquée « publiée » par VRM ET vue sur
    // Leboncoin avec sa référence : « 2 vendues sur Vinted — à retirer » pour
    // UNE paire (N°18, écrite deux fois). L'annonce vue sur Leboncoin l'emporte
    // (elle porte son lien) ; le N° est l'identité, jamais le titre.
    {
      const vuesLbc = new Set(removals.filter((r) => r.lbc).map((r) => cleNum(r.numero)).filter(Boolean));
      for (let i = removals.length - 1; i >= 0; i--) {
        const r = removals[i];
        if (!r.lbc && r.numero !== '?' && vuesLbc.has(cleNum(r.numero))) removals.splice(i, 1);
      }
    }
    // (29 oct.) « Vendue sur Vinted — à retirer de Leboncoin » : LA règle partagée
    // (`aRetirerDeLbcVinted`, §11) — la même que Ma journée, le tableau de bord
    // et le logo VRM sur leboncoin.fr. Preuve illisible ⇒ on garde ce qui précède
    // (aucune vente prouvée n'y figure de toute façon).
    // (9 nov.) Ce que la règle n'a pas pu PROUVER encore en ligne sur Leboncoin.
    const aConfAilleurs = [];
    {
      const ar = aRetirerDeLbcVinted({ posted, numeros, enLigne: new Set([...onlineIds, ...aConfirmerIds]), vendus: preuveKO ? null : vendus, itemsLbc: lbcRows === null ? null : lbcItems, liens, vendusLbc: ventesLbcKO ? null : vendusLbc, sortis: numsSortis, lectures: lbcRows === null ? null : lecturesLbc });
      if (ar && Array.isArray(ar.aConfirmer)) for (const r of ar.aConfirmer) aConfAilleurs.push({ numero: r.numero || '?', title: r.titre, ou: 'Vinted', id: r.lbcId || '', lu: r.lu, raison: r.raison || '' });
      if (ar) {
        const kAr = new Set(ar.map((r) => cleNum(r.numero)).filter(Boolean));
        for (let i = removals.length - 1; i >= 0; i--) { const r = removals[i]; if (r.etat === 'vendue' || kAr.has(cleNum(r.numero))) removals.splice(i, 1); }
        for (const r of ar) { const so = !r.lbcId && r.numero ? numsSortiesDoute.get(cleNum(r.numero)) : null; removals.push({ numero: r.numero || '?', title: r.titre, lbc: !!r.lbcId, ident: !!r.lbcId, url: r.url, etat: 'vendue', id: r.lbcId, prix: r.prix, ...(so ? { sortie: so.quoi } : {}) }); }
      }
    }
    // ── CROISEMENT eBay → LEBONCOIN (26 oct.) : une paire VENDUE SUR eBAY et
    //    encore en ligne ici doit en sortir, sinon elle se vend deux fois.
    //    `commandesEbayTous` rend null si un compte eBay est illisible ⇒ « pas
    //    su », on ne retire RIEN (rien lu ne vaut pas rien). Identité par le SKU
    //    VRM-{n°} (§5), jamais le titre. Une paire déjà « à retirer » (vendue
    //    sur Vinted) n'est pas doublée — une paire, une ligne.
    try {
      // (29 oct., revue 2) LA règle partagée avec Ma journée (`aRetirerDeLbcEbay`) :
      // une annonce reliée seulement par sa marque « publiée » reste listée, sans
      // geste ; pause et suppression demandent l'identité.
      const soldEbay = numerosVendusEbay(await commandesEbayTous());   // null si un compte eBay illisible ⇒ pas su
      const deja = new Set(removals.filter((r) => r.etat === 'vendue' && r.ou !== 'eBay').map((r) => cleNum(r.numero)).filter(Boolean));
      const re = aRetirerDeLbcEbay({ soldEbay, posted, numeros, itemsLbc: lbcRows === null ? null : lbcItems, liens, vendusLbc: ventesLbcKO ? null : vendusLbc, sortis: numsSortis, deja, lectures: lbcRows === null ? null : lecturesLbc });
      if (re && Array.isArray(re.aConfirmer)) for (const r of re.aConfirmer) aConfAilleurs.push({ numero: r.numero || '?', title: r.titre, ou: 'eBay', id: r.lbcId || '', lu: r.lu, raison: r.raison || '' });
      if (re && re.length) {
        const parN = new Map(); removals.forEach((r) => { const k = cleNum(r.numero); if (k && !parN.has(k)) parN.set(k, r); });
        for (const r of re) {
          const ex = parN.get(r.numero);
          if (ex) { const i = removals.indexOf(ex); if (i >= 0) removals.splice(i, 1); }   // un simple doute devient une vente eBay PROUVÉE
          const entry = { numero: r.numero, title: r.titre, lbc: !!r.lbcId, ident: !!r.ident, ou: 'eBay', url: r.url, etat: 'vendue', id: r.lbcId, prix: r.prix };
          removals.push(entry); parN.set(r.numero, entry);
        }
      }
    } catch (_) { /* une lecture eBay qui tombe ne casse jamais l'écran Leboncoin */ }
    // ── (1er nov., audit A1) CROISEMENT VESTIAIRE → LEBONCOIN : une paire VENDUE
    //    SUR VESTIAIRE (par identité : annonce créée par VRM ou référence VRM-n°)
    //    et encore en ligne ici doit en sortir. La MÊME règle que eBay
    //    (`aRetirerDeLbcEbay`) ; Vestiaire pas lu ⇒ rien (pas su). Une paire déjà
    //    « à retirer » n'est pas doublée.
    try {
      const soldVc = numerosVendusVc(ventesVcDe(avecNumerosVc(await lireVentesVestiaire())));
      const deja = new Set(removals.filter((r) => r.etat === 'vendue').map((r) => cleNum(r.numero)).filter(Boolean));
      const re = aRetirerDeLbcEbay({ soldEbay: soldVc, posted, numeros, itemsLbc: lbcRows === null ? null : lbcItems, liens, vendusLbc: ventesLbcKO ? null : vendusLbc, sortis: numsSortis, deja, lectures: lbcRows === null ? null : lecturesLbc });
      if (re && Array.isArray(re.aConfirmer)) for (const r of re.aConfirmer) aConfAilleurs.push({ numero: r.numero || '?', title: r.titre, ou: 'Vestiaire', id: r.lbcId || '', lu: r.lu, raison: r.raison || '' });
      if (re && re.length) {
        const parN = new Map(); removals.forEach((r) => { const k = cleNum(r.numero); if (k && !parN.has(k)) parN.set(k, r); });
        for (const r of re) {
          const ex = parN.get(r.numero);
          if (ex) { const i = removals.indexOf(ex); if (i >= 0) removals.splice(i, 1); }
          const entry = { numero: r.numero, title: r.titre, lbc: !!r.lbcId, ident: !!r.ident, ou: 'Vestiaire', url: r.url, etat: 'vendue', id: r.lbcId, prix: r.prix };
          removals.push(entry); parN.set(r.numero, entry);
        }
      }
    } catch (_) { /* une lecture Vestiaire qui tombe ne casse jamais l'écran Leboncoin */ }
    removals.sort((a, b) => triNum(a.numero, b.numero));
    // ⚠️⚠️ (9 nov., Julien : « elle propose de supprimer des annonces vendues sur
    // Vinted qui ne sont plus sur Leboncoin ») UNE LIGNE « À RETIRER » SE PROUVE
    // AUSSI CÔTÉ LEBONCOIN : son annonce doit être EN LIGNE selon la dernière
    // lecture COMPLÈTE de « Mes annonces », de moins de 24 h (`bilanLbc.etats`,
    // src/enLigneLbc.js — la règle de Vinted). Sinon : une vente à confirmer
    // (dite à côté, avec le geste qui relit la liste), jamais une suppression
    // proposée ; une annonce sortie d'une lecture complète ne revient pas.
    const retirerAConfirmer = [];
    for (let i = removals.length - 1; i >= 0; i--) {
      const r = removals[i];
      const e = r.id ? bilanLbc.etats.get(String(r.id)) : null;
      if (e && e.etat === 'enligne') continue;
      removals.splice(i, 1);
      if (r.etat === 'vendue' && !(e && e.etat === 'sortie')) retirerAConfirmer.unshift({ numero: r.numero, title: r.title, ou: r.ou || 'Vinted', id: r.id || '', lu: e ? e.lu : null });
    }
    {
      const dejaK = new Set([...removals, ...retirerAConfirmer].map((r) => cleNum(r.numero)).filter(Boolean));
      for (const r of aConfAilleurs) { const k = cleNum(r.numero); if (k && dejaK.has(k)) continue; if (k) dejaK.add(k); retirerAConfirmer.push(r); }
      retirerAConfirmer.sort((a, b) => triNum(a.numero, b.numero));
    }
    // ── L'AUTRE SENS : VENDUE SUR LEBONCOIN, ENCORE EN VENTE SUR VINTED ────────
    // Les paires que Vinted propose encore à la vente (`onlineIds`), et celles que
    // Vinted a déjà vendues (`vendus`) : vendue ici ET là, c'est une vente qu'il
    // ne pourra pas honorer.
    const dv = ventesLbcKO ? { doublons: [], aRelier: [] }
      // ⚠️ Une paire « à confirmer » PEUT être encore en vente sur Vinted : vendue
      //    sur Leboncoin, on le dit quand même (manquer une double vente coûte une
      //    paire ; regarder sur Vinted, un clic).
      : doublesVenteLbc({ ventes: ventesLbc, items: lbcItems, liens, numeros, enLigne: new Set([...onlineIds, ...aConfirmerIds]), vendusVinted: vendus });
    // Les paires qu'il a encore en ligne sur Vinted, avec leur N° : ce sont elles
    // qu'une annonce Leboncoin peut désigner. Proposées, jamais reliées seules.
    const candidats = online.filter((o) => numeros[o.id] && numeros[o.id].numero)
      .map((o) => ({ numero: String(numeros[o.id].numero), titre: o.title || '', marque: o.brand || '', taille: o.size || '', prix: o.price != null ? Number(o.price) : null, photo: o.photo || '' }));
    const suggPour = (titre, prix) => suggestionsPaires({ titre, prix }, candidats);
    // ⚠️ (16 oct., Julien : « ça sert à rien de relier une paire vendue, je n'ai
    //    plus de numéro ».) Relier une vente ne sert qu'à une chose : savoir si la
    //    MÊME paire est encore en vente sur Vinted. Sans paire ressemblante encore
    //    en ligne, il n'y a rien à vendre deux fois — on ne demande rien. Et sa
    //    réponse « aucune de celles-là » range la question pour de bon.
    const pasDePaire = { ...(main.vrm_lbc_pas_de_paire || {}), ...(load('vrm_lbc_pas_de_paire', {}) || {}) };
    const aRelierTout = dv.aRelier.map(({ vente, ad }) => ({ vente, ad, suggestions: suggPour(vente.title || ad.subject, vente.price != null ? Number(vente.price) / 100 : ad.price) }));
    const aRelierVentes = aRelierTout.filter((v) => v.suggestions.length > 0 && !pasDePaire['tx:' + (v.vente.txId || v.ad.id)]);
    const ventesSansJumelle = aRelierTout.length - aRelierVentes.length;
    const doublons = dv.doublons.map((d) => ({ ...d, vintedUrl: d.surVinted[0] ? 'https://www.vinted.fr/items/' + d.surVinted[0] : '' }));
    unlinked.forEach((u) => { u.suggestions = suggPour(u.subject || u.title, u.price); });
    // Une annonce Leboncoin ENCORE EN LIGNE garde son champ N° (la relier dit
    // laquelle retirer quand la paire se vend sur Vinted). Seule sa réponse
    // « pas de paire à relier » la range — jamais une déduction.
    const nonRelieesTout = unlinked.length;
    const unlinkedAsk = unlinked.filter((u) => !pasDePaire['ad:' + (u.id != null ? u.id : '')]);
    const nonRelieesSansJumelle = nonRelieesTout - unlinkedAsk.length;
    // Les liens qu'IL a posés (non vides) : la liste qui permet de les défaire.
    const adParId = new Map((Array.isArray(lbcAds) ? lbcAds : []).map((a) => [String(a && a.id), a]));
    const liensPoses = Object.entries(liens).filter(([, n]) => n != null && String(n).trim())
      .map(([id, n]) => { const a = adParId.get(String(id)) || {}; return { id, numero: String(n), titre: a.subject || a.title || '', image: (Array.isArray(a.images) && a.images[0]) || '' }; });
    // Répartition des annonces LBC par compte (plusieurs comptes possibles).
    const parCompte = {};
    // L'annonce porte son compte dans `account` (capture du fond) ou `lbcUser`
    // (capture de la page) : `lbcUser` seul comptait 0 annonce par compte.
    for (const ad of liveAds) { const k = String(ad.account || ad.lbcUser || '?'); (parCompte[k] = parCompte[k] || []).push(ad); }
    if (!estActif()) return;
    // (15 nov., Annonces propre) La touche Leboncoin du sélecteur d'Annonces : SES annonces en ligne (la règle
    // `bilanEnLigneLbc`, le même nombre que `lbcCount`) ; lecture ratée ⇒ pas su (src/plateformes/nombresAnnonces.js).
    poserNombreAnnonces('leboncoin', lbcRows === null ? null : bilanLbc.enLigne.length);
    // (19 nov.) `choixVinted` (la liste de l'ancienne feuille « Relier à Vinted ») est retiré : le parcours « Relier mes annonces » calcule ses candidates.
    setData({ retirerAConfirmer, catalogueAds: lbcAds.filter(aLui), catalogueVentes: ventesLbc, sortiesLbc: sortiesLbc.map((a) => { const q = lbcSortieDe(a); return { id: String(a.id), plusVueAt: q === 'plusvue' ? a.plusVueAt : null, pauseAt: q === 'pause' ? a.pauseAt : null, compte: String(a.account || a.lbcUser || '') }; }), lecturesLbc, pasRevues: pasRevues.length, pasRevuesJours: pasRevues.length ? Math.floor(Math.min(...pasRevues.map(lbcJoursSansVoir))) : 0, liensPoses, liensMain: liens, preuveKO, aConfirmer: aConfirmerIds.size, echecLecture: echecLecture || listRowsBrut === null, postedKO, lbcJamaisLu: lbcJamaisLu || (lbcRows !== null && liveAds.length === 0), lbcKO: lbcRows === null, vendues, nEnLigne: online.length, nNumerotees, queue, removals, unlinked: unlinkedAsk, nonRelieesSansJumelle, ventesSansJumelle, doublons, aRelierVentes, ventesLbcKO, numsConnus: [...keysKnown], liveAds, autoMatched, retirees, repub: (preuveKO || ventesLbcKO || postedRows === null || lbcRows === null) ? null : repub, repubKO, baisse: lbcRows === null ? null : baisse, lbcAccounts, lbcConnecte, parCompte, postedCount: [...posted].filter((x) => /^\d+$/.test(x)).length, lbcCount: bilanLbc.enLigne.length, lbcAConfirmer: { n: bilanLbc.aConfirmer.length, ids: bilanLbc.aConfirmer.map((a) => String(a.id)), lu: bilanLbc.comptes.reduce((m, c) => (Number.isFinite(c.lu) && (m == null || c.lu < m) ? c.lu : m), null), jamais: bilanLbc.comptes.some((c) => !Number.isFinite(c.lu)) }, limit: pd.limit, plan: pd.plan, prep });
    setLoading(false);
  };
  useEffect(() => {
    const suivi=suivreReceptionLeboncoin({fenetre:window,document,relire:lireDonnees,onErreur:()=>{setErreurReception(true);setLoading(false);}});
    suiviReception.current=suivi;
    suivi.actualiser();
    return ()=>{suivi.arreter();suiviReception.current=null;};
    /* eslint-disable-next-line */
  }, []);
  const marquer = async (id) => { const r = await vmrCmd({ cmd: 'lbcMarque', id: String(id), etat: 'posted' }); if (r && r.accepte) reload(); };
  // ── METTRE EN PAUSE SUR LEBONCOIN, SUR SON CLIC (22 octobre — proposition 6) ──
  // La N°18, vendue sur Vinted le 18 octobre, était encore en ligne sur
  // Leboncoin 4 jours après : cet écran n'offrait qu'un lien. Le bouton envoie
  // UN identifiant à l'extension ; elle relit l'annonce en base, vérifie le
  // compte Leboncoin connecté et envoie UNE pause (jamais une suppression).
  // La réponse de Leboncoin est écrite telle quelle ; un refus dit « pas fait »,
  // un silence dit « je ne sais pas ». Une à la fois.
  // Trois états de l'extension, jamais deux : absente (téléphone) · on vérifie ·
  // elle sait (`lbcPause` dans son état, capacité par présence) · en retard.
  const [, setExtTic] = useState(0);
  useEffect(() => onVmrExt(() => setExtTic((x) => x + 1)), []);
  const pauseEtat = () => {
    if (!vmrExtPresent()) return 'absente';
    if (__vmrEtat === undefined) return 'verif';
    if (__vmrEtat === null) return 'muette';
    return __vmrEtat.lbcPause === true ? 'ok' : 'retard';
  };
  const [pauseEnVol, setPauseEnVol] = useState(null);
  const [pauseRes, setPauseRes] = useState([]);
  // (20 nov., décision de Julien) La pause se fait dans le panneau de l'extension : l'app ouvre leboncoin.fr sur CETTE annonce.
  const mettreEnPause = (r) => { if (r && r.id) ouvrirPanneau({ site: 'leboncoin', page: 'annonces', ids: [String(r.id)], action: 'pause' }); };
  // ── SUPPRIMER DE LEBONCOIN, SUR SON CLIC CONFIRMÉ (29 octobre) ──────────
  // Julien : « je veux pouvoir sur VRM supprimer une annonce de Leboncoin ».
  // Même chemin que la pause : l'app n'envoie qu'UN identifiant et la
  // confirmation ; l'extension relit l'annonce en base, vérifie le compte
  // Leboncoin connecté et envoie la requête VUE dans ses gestes (DELETE
  // …/manual/delete/ads). C'est SANS RETOUR : la confirmation le dit, en rouge.
  // Trois états de l'extension (absente · on vérifie · elle sait `lbcSupprime`)
  // — le bouton n'est montré qu'à une extension qui sait.
  const supprEtat = () => {
    if (!vmrExtPresent()) return 'absente';
    if (__vmrEtat === undefined) return 'verif';
    if (__vmrEtat === null) return 'muette';
    return __vmrEtat.lbcSupprime === true ? 'ok' : 'retard';
  };
  const [supprRes, setSupprRes] = useState([]);
  // (20 nov., décision de Julien) Supprimer : dans le panneau de l'extension (sa confirmation y est demandée).
  const supprimerSurLbc = (r) => { if (r && r.id) ouvrirPanneau({ site: 'leboncoin', page: 'annonces', ids: [String(r.id)], action: 'supprimer' }); };
  const phraseSuppr = (x) => {
    const rp = x.rep;
    const cite = rp && rp.reponse ? ` « ${String(rp.reponse).slice(0, 160)} »` : '';
    if (!rp) return { etape: 'incertain', t: "je ne sais pas si elle est supprimée : l'extension n'a pas répondu à temps. Regarde l'annonce sur Leboncoin avant de recliquer." };
    if (rp.accepte === false) return { etape: 'refuse', t: `pas fait — ${rp.raison || 'refusé par l’extension'}.` };
    if (rp.etape === 'fait') return { etape: 'fait', t: `supprimée : Leboncoin a répondu ${rp.statut}${cite}.${rp.note === false ? " (VRM n'a pas pu le noter : elle restera affichée jusqu'à la prochaine lecture complète de tes annonces.)" : ''}` };
    if (rp.etape === 'refuse') return { etape: 'refuse', t: `pas fait — Leboncoin a répondu ${rp.statut}${cite}. L'annonce est toujours en ligne.` };
    return { etape: 'incertain', t: `je ne sais pas si elle est supprimée — ${rp.raison || "pas de réponse de Leboncoin"}.` };
  };
  // Ce que Leboncoin a répondu, en clair — et seulement ce qu'on sait.
  const phrasePause = (x) => {
    const rp = x.rep;
    const cite = rp && rp.reponse ? ` « ${String(rp.reponse).slice(0, 160)} »` : '';
    if (!rp) return { etape: 'incertain', t: "je ne sais pas si c'est fait : l'extension n'a pas répondu à temps. Regarde l'annonce sur Leboncoin avant de recliquer." };
    if (rp.accepte === false) return { etape: 'refuse', t: `pas fait — ${rp.raison || 'refusé par l’extension'}.` };
    if (rp.etape === 'fait') return { etape: 'fait', t: `mise en pause : Leboncoin a répondu ${rp.statut}${cite}.${rp.note === false ? " (VRM n'a pas pu le noter : elle restera dans cette liste jusqu'à la prochaine lecture complète de tes annonces.)" : ''}` };
    if (rp.etape === 'refuse') return { etape: 'refuse', t: `pas fait — Leboncoin a répondu ${rp.statut}${cite}. L'annonce est toujours en ligne.` };
    return { etape: 'incertain', t: `je ne sais pas si c'est fait — ${rp.raison || "pas de réponse de Leboncoin"}.` };
  };
  // 5.182 : la fiche « Publier sur Leboncoin » ouverte (une paire de la file).
  const [fiche, setFiche] = useState(null);
  // (3 nov.) Venu d'« Articles qui dorment » → « Mettre sur Leboncoin » : la fiche de
  // CET article s'ouvre dès qu'il est dans la file (par son identifiant, jamais un titre).
  useEffect(() => {
    const d = DEMANDE_LBC_FICHE;
    if (!d.id || Date.now() - d.at > 60000 || !data || !Array.isArray(data.queue)) return;
    const q = data.queue.find((x) => String(x.id) === String(d.id));
    d.id = null;
    if (q) setFiche(q);
    // (relecture du 5 nov.) Un article demandé (« Publier ailleurs », « qui dorment ») qui n'est
    // PAS dans la file : le dire, jamais un écran qui ne fait rien.
    else toast('Cet article n’est pas dans ta file « À publier » Leboncoin (déjà publié, retiré de Leboncoin, vendu ou plus en ligne sur Vinted).');
  }, [data]);
  const [repubOuvert, setRepubOuvert] = useState(false);
  // (6 nov.) Le nombre affiché = les annonces EN LIGNE (src/enLigneLbc.js) ; les
  // « à confirmer » sont dites à côté, jamais comptées. La jauge de la limite,
  // elle, reste prudente : marques « publiée » ou annonces pas encore sorties.
  const nAConf = data && data.lbcAConfirmer ? data.lbcAConfirmer.n : 0;
  const n = data ? data.lbcCount : 0;
  const nQuota = data ? Math.max(data.postedCount, data.lbcCount + nAConf) : 0;
  const lim = data ? (data.limit || null) : null;
  const pct = lim ? Math.min(100, Math.round((nQuota / lim) * 100)) : 0;
  const barCol = lim ? (nQuota >= lim ? C.danger : nQuota >= lim - 3 ? C.warn : INV_STATUS.online.color) : C.muted;
  // (16 oct.) Mise en page dans l'identité de l'app : cartes blanches à ombre
  // douce, titres courts, une colonne plus large sur ordinateur (elle faisait
  // 600 px et tout s'empilait en pavés).
  // ⚠️ (29 oct.) Ces deux formes vivent HORS du composant : définies ici, chaque
  //    rendu de l'écran en faisait un NOUVEAU type, et React REMONTAIT toutes les
  //    cartes — un défilement suffisait (mesuré au banc : le bouton « Publier »
  //    remplacé sous le doigt, sa raison « depuis ton ordinateur » effacée, le N°
  //    tapé dans « Relier » perdu). Même leçon que la fenêtre du Stock (§ planches).
  const Card = CarteEcranLbc;
  const Titre = TitreEcranLbc;
  const Sous = SousEcranLbc;
  // ── L'AGENT QUI CONSEILLE (26 oct., parité avec eBay — Julien : « une vraie
  //    expérience ») : « À faire sur Leboncoin » range les actions du plus
  //    urgent au moins, sur les signaux DÉJÀ calculés dans `data` (§11, aucun
  //    nouveau calcul). Chaque ligne saute au bloc concerné. Rien quand il n'y
  //    a rien à faire, muet tant que `data` n'est pas lu. Mêmes libellés que
  //    les blocs eux-mêmes — pas de nouvelle consigne à vérifier.
  const plurLbc = (n) => (n > 1 ? 's' : '');
  // ⚠️ NE COMPTER QUE LES VENTES PROUVÉES (revue du 26 oct.). `data.removals`
  //    mélange trois états — vendue (prouvée) · pause (masquée sur Vinted, PAS
  //    vendue, rien à faire) · doute (fermée sans preuve). Compter le TOTAL
  //    affichait « N vendues à retirer » en rouge sur des paires non vendues :
  //    exactement la régression que le bloc détaillé (« VENDUE SE PROUVE »)
  //    existe pour empêcher. Aligné sur eBay (`dvVue.aRetirerEbay`) et la
  //    cloche (`lbcRemoveCount`), qui ne comptent que le prouvé.
  // (28 oct.) Le N° d'une annonce de « Mes annonces » : la règle de l'écran
  // (lien posé à la main, sinon référence VRM traduite par la 013), jamais la
  // référence brute (§5, §11).
  const numeroAnnonceLbc = React.useMemo(() => {
    if (!data || !Array.isArray(data.catalogueAds)) return null;
    const parId = {}; for (const a of data.catalogueAds) if (a && a.id != null) parId[String(a.id)] = a;
    const liens = data.liensMain || null;
    return (ad) => (ad && ad.id != null) ? numeroLbcIdentite({ itemId: ad.id }, parId, liens) : '';
  }, [data]);
  const retraitParAnnonce = React.useMemo(() => new Map(
    (data?.removals || []).filter((r) => r.ident && r.id && r.etat === 'vendue')
      .map((r) => [String(r.id), r.ou || 'Vinted'])
  ), [data]);
  const nRetirerLbc = (data && data.removals) ? data.removals.filter((r) => r.etat === 'vendue' && r.ou !== 'eBay').length : 0;
  const nRetirerLbcEbay = (data && data.removals) ? data.removals.filter((r) => r.etat === 'vendue' && r.ou === 'eBay').length : 0;
  const conseilsLbc = data ? [
    nRetirerLbc && { k: 'retirer', urg: true, sel: '[data-lbc-retirer]', txt: `${motArticle(nRetirerLbc)} vendu${motsVendeur().e}${plurLbc(nRetirerLbc)} sur Vinted, encore en ligne ici — à retirer de Leboncoin` },
    nRetirerLbcEbay && { k: 'retirer-ebay', urg: true, sel: '[data-lbc-retirer-ebay]', txt: `${motArticle(nRetirerLbcEbay)} vendu${motsVendeur().e}${plurLbc(nRetirerLbcEbay)} sur eBay, encore en ligne ici — à retirer de Leboncoin` },
    data.doublons && data.doublons.length && { k: 'doublons', urg: true, sel: '[data-lbc-doublons]', txt: `${data.doublons.length} vendu${motsVendeur().e}${plurLbc(data.doublons.length)} sur Leboncoin, encore sur Vinted — à retirer là-bas` },
    data.aRelierVentes && data.aRelierVentes.length && { k: 'relier-ventes', sel: '[data-lbc-ventes-a-relier]', txt: `${data.aRelierVentes.length} vente${plurLbc(data.aRelierVentes.length)} Leboncoin à relier à un article` },
    data.queue && data.queue.length && { k: 'publier', sel: '.vrm-lbc-a-publier', txt: `${motArticle(data.queue.length)} prêt${motsVendeur().e}${plurLbc(data.queue.length)} à publier sur Leboncoin` },
  ].filter(Boolean) : [];
  const allerLbc = (c) => () => { try { const el = document.querySelector(c.sel); if (el) el.scrollIntoView({ behavior: (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth', block: 'center' }); } catch (_) {} };
  // La cible posée par Ma journée : consommée une fois, dans la minute ; la mémoire
  // de défilement de l'écran peut repasser derrière (2,5 s), d'où quelques essais
  // tant que la paire n'est pas à l'écran — jamais après un geste de défilement.
  useEffect(() => {
    const d = DEMANDE_LBC_CIBLE;
    if (!data || !d.sel || Date.now() - d.at > 60000) return undefined;
    const sel = d.sel; d.sel = null;
    let fini = false; const stop = () => { fini = true; };
    const evts = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    evts.forEach((e) => window.addEventListener(e, stop, { passive: true, once: true }));
    const ids = [60, 500, 1300, 2800].map((ms) => setTimeout(() => {
      if (fini) return;
      try { const el = document.querySelector(sel); if (!el) return; const r = el.getBoundingClientRect(); if (r.top >= 0 && r.top < (window.innerHeight || 800) * 0.8) return; el.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (_) {}
    }, ms));
    return () => { ids.forEach(clearTimeout); evts.forEach((e) => window.removeEventListener(e, stop)); };
  }, [data]);
  // (14 nov.) La porte « Republier » se montre quand il y a quelque chose à republier, ou quand on
  // ne sait pas (lecture ratée, `null`) — la même condition qu'avant, nommée une fois.
  const porteRepubLbc = !!(data && (data.repub === null || (data.repub && (data.repub.length || Object.keys(data.repubKO || {}).length))));
  return (
    <div className="vrm-lbc-ecran" style={{ padding: '12px 16px 40px', maxWidth: 920, margin: '0 auto' }}>
      {/* (20 nov.) La fiche « Publier sur Leboncoin » est retirée : la publication se fait dans l'extension. */}
      {/* Revue du 16 octobre : ce titre redisait l'onglet « Annonces » juste
          au-dessus. Il reste pour un lecteur d'écran, plus à l'œil. */}
      <h2 className="vrm-sr">Tes annonces Leboncoin</h2>
      {erreurReception && <LignePanne>Relecture Leboncoin ratée (ancien affichage gardé) : touche Actualiser.</LignePanne>}
      {/* (14 nov., refonte visible — AJOUT 3 « la liste d'abord ») Les conseils, « Republier » et
          « Baisser le prix » étaient trois cartes de 120 px AVANT la liste : ils vivent dans UNE ligne
          « • À faire · N › » qui ouvre leur feuille (src/plateformes/AFaireSite.jsx), chacun avec SON
          geste, inchangé. Les alertes de double vente restent dans la page, dessous (seul geste urgent). */}
      <AFaireSite site="leboncoin" n={conseilsLbc.length + (porteRepubLbc ? 1 : 0) + (data && Array.isArray(data.baisse) && data.baisse.length ? 1 : 0)}>
      {conseilsLbc.length > 0 && (
        <Card data-lbc-conseils={conseilsLbc.length} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>À faire sur Leboncoin</div>
          {conseilsLbc.slice(0, 4).map((c, i) => (
            <div key={c.k} data-lbc-conseil={c.k} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              {/* (6 nov., v36-visuel-2) Une icône de Réglages par geste (au lieu d'un point bleu) ; l'ambre au geste pressé. */}
              <span aria-hidden="true" className="vrm-lbc-conseil-icone" data-urgent={c.urg ? '1' : undefined}><Icon name={{ publier: 'tag', 'relier-ventes': 'link', doublons: 'alert' }[c.k] || 'trash'} size={16}/></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, lineHeight: 1.4 }}>{c.txt}</span>
              <button type="button" data-lbc-conseil-go={c.k} data-afaire-ferme="" onClick={allerLbc(c)} style={{ border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 12, padding: '4px 11px', fontSize: 12, fontWeight: 600, color: C.text, cursor: 'pointer', flexShrink: 0 }}>Voir</button>
            </div>
          ))}
        </Card>
      )}
      {/* (29 oct.) « Un outil de republication comme pour Vinted » : une porte,
          au-dessus de ses annonces ; l'outil dit lui-même ce qu'il ne peut pas faire. */}
      {porteRepubLbc ? (
        <div data-repub-lbc-porte={data.repub === null ? 'pas-su' : String(data.repub.length)} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Republier sur Leboncoin</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{data.repub === null ? "Pas vérifié (lecture ratée) : touche « ↻ Actualiser »." : <>{`${data.repub.length} annonce${data.repub.length > 1 ? 's' : ''} peu${data.repub.length > 1 ? 'vent' : 't'} l'être`}{' '}<Pourquoi titre="Republier sur Leboncoin">Supprimer puis remettre une annonce comme neuve, une à la fois.</Pourquoi></>}</div>
          </div>
          {data.repub !== null && <button type="button" data-repub-lbc-ouvrir="" data-afaire-ferme="" onClick={() => setRepubOuvert(true)} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Choisir les annonces…</button>}
        </div>
      ) : null}
      {/* (20 nov., décision de Julien) Baisser les prix Leboncoin : dans le panneau de l'extension. */}
      {data && Array.isArray(data.baisse) && data.baisse.length ? <div data-lbc-baisse-panneau={data.baisse.length} style={{ margin: '8px 0' }}><BoutonExtension action="baisser" site="leboncoin" ids={data.baisse.map((x) => String(x.id))}/></div> : null}
      </AFaireSite>
      {/* ── ANTI DOUBLE VENTE : EN PREMIER, C'EST LE SEUL GESTE URGENT DE L'ÉCRAN ──
          Une paire vendue ici et encore en vente sur Vinted peut être achetée
          une deuxième fois. On le dit avec le N° et le lien ; VRM ne retire pas
          l'annonce Vinted tout seul (§3 : irréversible côté Vinted). */}
      {data && data.doublons && data.doublons.length > 0 && (
        <Card style={{ borderColor: C.warn }}>
          <div data-lbc-doublons={data.doublons.length} style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3 }}>
            {data.doublons.length} article{data.doublons.length > 1 ? 's' : ''} vendu{data.doublons.length > 1 ? 's' : ''} sur Leboncoin — encore sur Vinted
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 6 }}>
            Retire-{data.doublons.length > 1 ? 'les' : 'la'} de Vinted maintenant, sinon double vente.
          </div>
          {data.doublons.map((d) => {
            const ph = (Array.isArray(d.ad.images) && d.ad.images[0]) || '';
            return (
              <div key={String(d.vente.txId || d.ad.id)} data-doublon={d.numero} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: C.card2 || C.border }}>
                  {ph ? <PhotoVinted src={ph} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : null}
                </div>
                {/* (1er nov.) Au téléphone, les deux gestes (largeur fixe) écrasaient le
                    texte à une lettre par ligne : la rangée passe à la ligne, le
                    texte garde au moins 160 px. */}
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>N°{d.numero} · {d.vente.title || d.ad.subject || ''}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Leboncoin : {d.vente.stepLabel || 'vendue'}{d.vente.price != null ? ` · ${lbcEuro(d.vente.price)}` : ''}
                    {d.vendueVinted.length > 0 && <span style={{ color: C.warn, fontWeight: 700 }}> · vendue AUSSI sur Vinted : une des deux ventes ne pourra pas partir — annule-en une</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0, marginLeft: 'auto' }}>
                {d.vintedUrl && <a href={d.vintedUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0, border: `1px solid ${C.border}`, borderRadius: 12, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: C.text, textDecoration: 'none' }}>Ouvrir sur Vinted</a>}
                {data.liensMain && String(data.liensMain[String(d.ad.id)] || '').trim() && (
                  <button type="button" data-lbc-delier={String(d.ad.id)} onClick={() => { gesteDelierLbc(d.ad.id, d.numero, reload); }}
                    style={{ border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 12, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: C.muted, cursor: 'pointer' }}>Pas le bon article</button>
                )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {data && data.aRelierVentes && data.aRelierVentes.length > 0 && (
        <Card>
          <Titre data-lbc-ventes-a-relier={data.aRelierVentes.length}>
            {data.aRelierVentes.length} vente{data.aRelierVentes.length > 1 ? 's' : ''} Leboncoin : quel article ?
          </Titre>
          <Sous>Un article semblable est en vente sur Vinted. Le même ? Touche-le.</Sous>
          {data.aRelierVentes.map(({ vente, ad, suggestions }) => (
            <LbcRelier key={String(vente.txId || ad.id)} ad={ad} numsConnus={data.numsConnus || []} onRelie={reload} suggestions={suggestions} vendue
              cleRangement={'tx:' + (vente.txId || ad.id)}
              detail={`Vendue${vente.price != null ? ' ' + lbcEuro(vente.price) : ''}${vente.stepLabel ? ' · ' + vente.stepLabel : ''}`}/>
          ))}
        </Card>
      )}
      {/* (20 nov., décision de Julien) Republier sur Leboncoin : dans le panneau de l'extension (l'ancien atelier est retiré). */}
      {repubOuvert && data && Array.isArray(data.repub) && <FeuilleExtension action="republier" site="leboncoin" ids={data.repub.map((x) => String(x.id))} onFermer={() => setRepubOuvert(false)}>
        <NGroupe>{data.repub.slice(0, 40).map((x) => <NRangee key={x.id} titre={x.titre || x.subject || x.title || '—'} plaque={x.numero ? <NPlaque numero={x.numero}/> : null}/>)}</NGroupe>
      </FeuilleExtension>}
      {data && <AnnoncesLeboncoin outils={<>
          {/* (14 nov.) « Actualiser » et « Publier sur Leboncoin » : deux icônes de la barre de la liste
              (l'entrée « Publier » garde son attribut et son événement, src/App.jsx `EntreePublierAilleurs`). */}
          <BoutonIcone label={loading ? tr('plateformes.actualisation') : tr('plateformes.actualiser')} data-lbc-actualiser="" onClick={reload} disabled={!!loading}><Icon name="sync" size={18}/></BoutonIcone>
          <span className="vrm-pa-entree is-outil" data-pa-entree="leboncoin"><BoutonIcone label={tr('plateformes.publierSur', { site: 'Leboncoin' })} onClick={() => { try { window.dispatchEvent(new CustomEvent('vrm:publier-ailleurs', { detail: { site: 'leboncoin' } })); } catch (_) {} }}><IconePlus/></BoutonIcone></span>
        </>} owner={AUTH.user?.id||''} compteOuvert={lbcOuvert} floute={(ad) => lbcFloute(lbcOuvert, ad && (ad.account || ad.lbcUser))} aConfirmerDe={(ad) => !!(data.lbcAConfirmer && data.lbcAConfirmer.ids.includes(String(ad && ad.id)))} confirmer={nAConf > 0 ? (() => {
        const pe = pauseEtat(), A = data.lbcAConfirmer;
        return <>{A.jamais ? 'Ta liste « Mes annonces » n’a jamais été lue en entier' : `Ta liste « Mes annonces » a été ${quandLectureLbc(A.lu)}`} : « à confirmer », pas comptées, rien effacé.{' '}
          {pe === 'absente'
            ? <>Ouvre « Mes annonces » sur leboncoin.fr, chaque compte.</>
            : pe === 'retard'
              ? <>Mets l’extension à jour, puis ouvre « Mes annonces », chaque compte.</>
              : <><a href={LIEN_MES_ANNONCES_LBC} target="_blank" rel="noreferrer" data-lbc-ouvrir-mes-annonces="">Ouvrir « Mes annonces » sur leboncoin.fr ↗</a> — sur chacun de tes comptes : l’extension relit la liste en entier.</>}</>;
      })() : null} annonces={data.catalogueAds} ventes={data.catalogueVentes} lectureKO={data.lbcKO} numeroDe={numeroAnnonceLbc} sortieDe={lbcSortieDe} onSupprimer={supprimerSurLbc} enVol={pauseEnVol ? String(pauseEnVol) : null} achatDe={achatDuNumeroLu}
        lienVintedDe={(ad) => !!data.liensMain?.[String(ad.id)]}
        retraitDe={(ad) => retraitParAnnonce.get(String(ad.id))}
        onRelierVinted={(ad) => ouvrirLiaison({ site: 'Leboncoin', id: ad.id })}/>}
      {/* ⚠️ UNE LECTURE RATÉE SE DIT UNE FOIS (§7). L'écran la disait jusqu'à quatre
          fois (ventes Leboncoin, compteur, preuve de vente, file vide) et, sur une
          lecture ratée de ses annonces Leboncoin, il affirmait « je n'ai pas encore
          vu tes annonces, ouvre leboncoin.fr » : le mauvais geste. Un seul bloc
          nomme ce qui n'a pas pu être lu, et ce que ça empêche. */}
      {data && (() => {
        const rates = [data.echecLecture && 'tes annonces Vinted', data.postedKO && 'ce qui est déjà sur Leboncoin', data.preuveKO && 'tes ventes Vinted', data.ventesLbcKO && 'tes ventes Leboncoin', data.lbcKO && 'tes annonces Leboncoin'].filter(Boolean);
        if (!rates.length) return null;
        const liste = rates.length === 1 ? rates[0] : rates.slice(0, -1).join(', ') + ' ni ' + rates[rates.length - 1];
        const effets = [
          data.preuveKO && `la liste à publier peut contenir des ${motsVendeur().noms} déjà vendu${motsVendeur().e}s sur Vinted`,
          data.ventesLbcKO && "je n'ai pas pu vérifier qu'aucun article vendu ici n'est encore en vente sur Vinted",
          data.lbcKO && 'je ne peux pas te dire lesquelles retirer de Leboncoin',
          data.echecLecture && 'la file à publier est incomplète',
          data.postedKO && 'je ne propose rien à publier (risque de doublon)',
        ].filter(Boolean);
        return (
          <div data-lbc-lecture-ratee={rates.length} style={{ marginBottom: 12 }}>
            <LignePanne>Je n'ai pas pu lire {liste} (rien perdu) : rouvre dans un moment. En attendant, {effets.join(', et ')}.</LignePanne>
          </div>
        );
      })()}
      {loading && !data ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '30px 16px' }}>Chargement…</div> : (<>
        {/* Compteur / offre */}
        {/* (23 oct., intégration) La carte ne s'affiche que s'il y a une limite ou
            une offre (main) — mais elle porte aussi « plus comptées en ligne » et
            « pas revues » (lot Leboncoin) : sans limite connue, ces deux lignes
            disparaissaient. Elle s'affiche dès que l'une des quatre a quelque chose à dire. */}
        {(lim || data.plan || (data.sortiesLbc || []).length > 0 || data.pasRevues > 0 || nAConf > 0) && <Card className="vrm-lbc-compteur">
          {/* (6 nov.) « 0 » qui veut dire « je ne sais pas » s'écrit « — » (§5) :
              aucune annonce confirmée en ligne, mais des annonces à confirmer. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="vrm-display" data-lbc-en-ligne={data.lbcKO || (n === 0 && nAConf > 0) ? '' : String(n)} style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{data.lbcKO || (data.lbcJamaisLu && !data.postedCount) || (n === 0 && nAConf > 0) ? '—' : n}</span>
            <span style={{ fontSize: 15, color: C.muted, fontWeight: 600 }}>annonce{n > 1 ? 's' : ''} en ligne sur Leboncoin{lim ? ` / ${lim}` : ''}</span>
            {/* (6 nov.) « À CONFIRMER » (src/enLigneLbc.js) : le nombre ici ; la raison
                et le geste UNE fois, en tête de « Mes annonces » (là où sont les cartes). */}
            {nAConf > 0 && <span data-lbc-a-confirmer={nAConf} style={{ fontSize: 15, color: C.warn, fontWeight: 600 }}>· {nAConf} à confirmer</span>}
          </div>
          {data.lbcJamaisLu && !data.postedCount && (
            <div style={{ fontSize: 12, color: C.warn, fontWeight: 600, marginTop: 5, lineHeight: 1.5 }}>
              Annonces Leboncoin pas encore lues : ouvre <b>tes annonces</b> sur leboncoin.fr.{' '}
              <Pourquoi>Je n'ai pas encore vu tes annonces Leboncoin. Ouvre la page de tes annonces sur leboncoin.fr une fois, avec l'extension : je les lirai au passage. Tant que c'est le cas, je ne peux pas te dire lesquelles retirer quand un article se vend sur Vinted.</Pourquoi>
            </div>
          )}
          {/* ⚠️ « Offre : Gratuit » s'affichait quand AUCUNE offre n'était connue
              (mesuré : `plan` et `limit` jamais renseignés) — une valeur inventée. */}
          {data.plan ? <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginTop: 2 }}>Offre : {data.plan}</div> : null}
          {lim ? (<>
            <div style={{ height: 8, borderRadius: 999, background: C.border, overflow: 'hidden', marginTop: 9 }}><div style={{ width: pct + '%', height: '100%', background: barCol, borderRadius: 999 }} /></div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 5, color: barCol }}>{nQuota >= lim ? 'Limite atteinte' : nQuota >= lim - 3 ? 'Tu approches de ta limite' : `Il te reste ${lim - nQuota} annonce${lim - nQuota > 1 ? 's' : ''}`}</div>
          </>) : null}
          {/* (22 oct.) Une liste COMPLÈTE de son compte ne montre plus certaines
              annonces : elles ne sont plus comptées en ligne. On dit combien et
              pourquoi, une fois — jamais « supprimée », jamais « vendue ». */}
          {(() => {
            const so = data.sortiesLbc || [];
            if (!so.length) return null;
            const pv = so.filter((x) => x.plusVueAt), pz = so.filter((x) => !x.plusVueAt && x.pauseAt);
            const dates = Object.values(data.lecturesLbc || {}).map((l) => Date.parse((l && l.at) || '')).filter(isFinite);
            const quand = dates.length ? new Date(Math.max(...dates)).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div data-lbc-plus-vues={so.length} style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                {so.length} annonce{so.length > 1 ? 's' : ''} {so.length > 1 ? 'ne sont' : "n'est"} plus comptée{so.length > 1 ? 's' : ''} en ligne
                {pv.length ? <> : {pv.length} plus vue{pv.length > 1 ? 's' : ''} dans ta liste Leboncoin lue en entier{quand ? ` le ${quand}` : ''} (vendue, supprimée ou mise en pause : je ne sais pas laquelle)</> : null}
                {pz.length ? <>{pv.length ? ',' : ' :'} {pz.length} mise{pz.length > 1 ? 's' : ''} en pause depuis VRM</> : null}. Rien n'est effacé.
              </div>
            );
          })()}
          {/* (22 oct.) Pas revues depuis plus de 7 jours : on ne sait pas si elles
              y sont encore. Le geste qui tranche, selon l'extension d'ici. */}
          {data.pasRevues > 0 && !nAConf && (() => {
            const pe = pauseEtat();
            return (
              <div data-lbc-pas-revues={data.pasRevues} style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                {data.pasRevues} annonce{data.pasRevues > 1 ? 's' : ''} Leboncoin pas revue{data.pasRevues > 1 ? 's' : ''} depuis plus de {data.pasRevuesJours > LBC_REVUE_JOURS ? data.pasRevuesJours : LBC_REVUE_JOURS} jours.{' '}
                {pe === 'absente'
                  ? <>Ouvre ta page profil Leboncoin : la liste sera relue en entier.</>
                  : pe === 'retard'
                    ? <>Mets l'extension à jour, puis ouvre ta page profil Leboncoin.</>
                    : <>Ouvre ta page profil Leboncoin {NAV.dans} : la liste sera relue en entier.</>}{' '}
                <Pourquoi>Je ne sais pas si elle{data.pasRevues > 1 ? 's y sont' : ' y est'} encore, je ne te demande donc pas à quel article {data.pasRevues > 1 ? 'les' : 'la'} relier.</Pourquoi>
              </div>
            );
          })()}
        </Card>}
        {/* À retirer (vendues sur Vinted) */}
        {/* ⚠️⚠️ « VENDUE » SE PROUVE, ELLE NE SE DÉDUIT PAS D'UNE ABSENCE.
            Ce bloc disait « Vendues sur Vinted → retire-les », en rouge, dès
            qu'une annonce n'était plus en ligne. Or elle peut sortir de la liste
            parce qu'il l'a mise en pause. Mesuré le 12 septembre : sur ses
            400 annonces fermées, **151 seulement** portent une vente prouvée par
            identité (`transaction → item_id`). Pour les 249 autres, « retire-la
            de Leboncoin » lui ferait perdre une vente sur une paire qu'il a
            encore. Trois états, et seul le prouvé est rouge — §5 « mieux vaut un
            blanc qu'un faux », et on dit « à vérifier », jamais « vendu ». */}
        {/* (9 nov.) Vendues ailleurs, mais l'annonce Leboncoin n'est pas PROUVÉE en
            ligne (aucune lecture complète de moins de 24 h) : rien n'est proposé à
            la suppression ; le geste qui tranche, une fois. */}
        {Array.isArray(data.retirerAConfirmer) && data.retirerAConfirmer.length > 0 && (
          <Card>
            <div data-lbc-retirer-aconfirmer={data.retirerAConfirmer.length}>
              <Titre>{data.retirerAConfirmer.length} vendue{data.retirerAConfirmer.length > 1 ? 's' : ''} ailleurs — encore sur Leboncoin ? À confirmer</Titre>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>
                {(() => { const lus = data.retirerAConfirmer.map((r) => r.lu).filter((x) => Number.isFinite(x)); return lus.length ? `Ta liste « Mes annonces » a été ${quandLectureLbc(Math.max(...lus))}` : data.retirerAConfirmer.every((r) => r.raison === 'pasrelue') ? 'Aucune annonce relue sur Leboncoin ne porte ce numéro (seulement ta marque « publiée »)' : "Ta liste « Mes annonces » n'a pas encore été lue en entier"; })()}. <a href={LIEN_MES_ANNONCES_LBC} target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 700 }}>Ouvre « Mes annonces » sur Leboncoin</a> pour trancher.{' '}
                <Pourquoi>Je ne sais pas si {data.retirerAConfirmer.length > 1 ? 'ces annonces sont' : 'cette annonce est'} encore en ligne, donc je ne te propose pas de supprimer. L'extension relit « Mes annonces » en entier, et seules celles encore en ligne s'afficheront ici.</Pourquoi>
              </div>
              {data.retirerAConfirmer.slice(0, 30).map((r, i) => (
                <div key={i} data-lbc-retirer-aconfirmer-num={cleNum(r.numero) || undefined} style={{ fontSize: 13, color: C.text, padding: '3px 0' }}><b>N°{r.numero}</b> · {r.title || '—'} <span style={{ color: C.muted }}>· vendue sur {r.ou}</span></div>
              ))}
            </div>
          </Card>
        )}
        {data.removals.length > 0 && (() => {
          const vendues = data.removals.filter(r => r.etat === 'vendue' && r.ou !== 'eBay' && r.ou !== 'Vestiaire');
          const venduesEbay = data.removals.filter(r => r.etat === 'vendue' && r.ou === 'eBay');
          const venduesVc = data.removals.filter(r => r.etat === 'vendue' && r.ou === 'Vestiaire');
          const pause = data.removals.filter(r => r.etat === 'pause');
          const doute = data.removals.filter(r => r.etat !== 'vendue' && r.etat !== 'pause');
          const pe = pauseEtat();
          const se = supprEtat();
          const Ligne = (r, i, coul, pausable) => (
            // (1er nov., audit A5) La notification « double vente » vise la ligne
            // par son N° (`cleNum`, chaque N° d'un lot) : `data-lbc-retirer` porte
            // l'identifiant Leboncoin quand l'annonce est reliée, il ne pouvait
            // jamais répondre au N° de la notification (`src/cibleNotif.js`).
            // Seules les lignes VENDUES (pausable) le portent : une ligne « à
            // vérifier » ou « en pause » n'est pas une double vente.
            <div key={i} data-lbc-retirer={r.id || r.numero} data-cible={pausable ? attrCible(...String(r.numero == null ? '' : r.numero).split('+').map((n) => ['doublon', 'leboncoin', n])) : undefined} data-lbc-retirer-num={pausable ? (String(r.numero == null ? '' : r.numero).split('+').map(cleNum).filter(Boolean).join(' ') || undefined) : undefined} data-lbc-retirer-sortie={r.sortie || undefined} style={{ fontSize: 13, color: C.text, padding: '3px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px' }}>
              <span><b>N°{r.numero}</b> · {r.title || '—'}
              {r.url ? <> · <a href={r.url} target="_blank" rel="noreferrer" style={{ color: coul, fontWeight: 700 }}>voir sur Leboncoin</a></> : null}
              {r.sortie ? <span style={{ color: C.muted }}> · {r.sortie === 'pause' ? "l'annonce reliée est en pause depuis VRM" : r.sortie === 'supprimee' ? "l'annonce reliée a été supprimée de Leboncoin" : "l'annonce reliée n'est plus dans ta liste"}</span> : null}</span>
              {/* (29 oct., revue) La pause et la suppression ne sont proposées que sur
                  une annonce désignée par IDENTITÉ (lien posé, référence VRM) :
                  jamais sur une annonce reliée par son seul titre. */}
              {/* (20 nov., décision de Julien) Mettre en pause, supprimer : dans le panneau de l'extension sur leboncoin.fr,
                  toujours sur une annonce désignée par IDENTITÉ (lien posé, référence VRM). */}
              {pausable && r.ident && r.lbc && r.id ? <> <BoutonExtension className="vrm-ao-second" action="pause" site="leboncoin" ids={[String(r.id)]} attrs={{ 'data-lbc-pause': r.id }}/>
                {' '}<BoutonExtension className="vrm-ao-second" action="supprimer" site="leboncoin" ids={[String(r.id)]} attrs={{ 'data-lbc-supprimer': r.id }}/></> : null}
            </div>
          );
          const pausables = vendues.some((r) => r.ident && r.lbc && r.id);
          // (22 oct., revue) Une paire dont l'annonce RELIÉE est sortie, mais sans
          // la preuve qu'aucune autre annonce de la paire n'est en ligne : la ligne
          // reste (sens sûr). Le pourquoi et le geste, une fois (§7).
          const nDoute = data.removals.filter((r) => r.sortie).length;
          // La phrase vit dans la PREMIÈRE carte qui porte une telle ligne, une fois.
          const carteDoute = vendues.some((r) => r.sortie) ? 'vendues' : doute.some((r) => r.sortie) ? 'doute' : pause.some((r) => r.sortie) ? 'pause' : null;
          const phraseDoute = nDoute > 0 ? (
            <div data-lbc-retirer-doute={nDoute} style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>
              {nDoute > 1 ? `Pour ${nDoute} de ces ${motsVendeur().noms}` : `Pour ${motsVendeur().une} de ces ${motsVendeur().noms}`}, <b>une autre annonce</b> est peut-être en ligne : ouvre ta page profil Leboncoin.
            </div>
          ) : null;
          return (<>
            {vendues.length > 0 && (<div data-lbc-retirer-bloc="vinted" data-cible="doublon:leboncoin">
              <Card style={{ borderColor: C.warn }}>
                <Titre>{vendues.length} vendue{vendues.length > 1 ? 's' : ''} sur Vinted — à retirer de Leboncoin</Titre>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Vente <b>certaine</b> : retire-{vendues.length > 1 ? 'les' : 'la'} de Leboncoin (référence <b>VRM-N°</b> dans l'annonce).
                  {pausables && se === 'ok' ? <> <span data-lbc-supprimer-geste="ok">Tu peux {vendues.length > 1 ? 'les' : 'la'} supprimer d'ici (sans retour) ou {vendues.length > 1 ? 'les' : 'la'} mettre en pause (elle se remet en ligne depuis « Mes annonces »), une à la fois.</span></>
                    : pausables && pe === 'ok' ? <> <span data-lbc-pause-geste="ok">Ou mets-{vendues.length > 1 ? 'les' : 'la'} en pause d'ici (réversible).</span></> : null}
                  {pausables && pe === 'retard' ? <> <span data-lbc-pause-geste="retard">Pour {vendues.length > 1 ? 'les' : 'la'} mettre en pause d'ici, mets l'extension à jour (Paramètres → État des connexions).</span></> : null}
                  {' '}<Pourquoi>La vente est certaine (la transaction Vinted désigne cette annonce). Retire-{vendues.length > 1 ? 'les' : 'la'} de Leboncoin pour ne pas vendre le même article deux fois — cherche la référence VRM-N° dans l'annonce. Le numéro de l'article ne change pas.</Pourquoi>
                </div>
                {vendues.slice(0, 30).map((r, i) => Ligne(r, i, C.danger, true))}
                {carteDoute === 'vendues' ? phraseDoute : null}
              </Card>
            </div>)}
            {venduesEbay.length > 0 && (<div data-lbc-retirer-bloc="ebay" data-cible="doublon:leboncoin">
              <Card style={{ borderColor: C.warn }}>
                <Titre>{venduesEbay.length} vendue{venduesEbay.length > 1 ? 's' : ''} sur eBay — à retirer de Leboncoin</Titre>
                <div data-lbc-retirer-ebay={venduesEbay.length} style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Vente eBay <b>certaine</b> (SKU <b>VRM-N°</b>) : retire-{venduesEbay.length > 1 ? 'les' : 'la'} de Leboncoin.
                  {venduesEbay.some((r) => r.ident && r.lbc && r.id) && se === 'ok' ? <> <span data-lbc-supprimer-geste-ebay="ok">Tu peux {venduesEbay.length > 1 ? 'les' : 'la'} supprimer d'ici (sans retour) ou {venduesEbay.length > 1 ? 'les' : 'la'} mettre en pause, une à la fois.</span></>
                    : venduesEbay.some((r) => r.ident && r.lbc && r.id) && pe === 'ok' ? <> <span data-lbc-pause-geste-ebay="ok">Ou mets-{venduesEbay.length > 1 ? 'les' : 'la'} en pause d'ici, une à la fois : ce n'est pas une suppression.</span></> : null}
                  {venduesEbay.some((r) => r.ident && r.lbc && r.id) && pe === 'retard' ? <> <span data-lbc-pause-geste-ebay="retard">Pour {venduesEbay.length > 1 ? 'les' : 'la'} mettre en pause d'ici, mets l'extension à jour (Paramètres → État des connexions).</span></> : null}
                  {venduesEbay.some((r) => !r.ident) ? <> <span data-lbc-ebay-sans-ident={venduesEbay.filter((r) => !r.ident).length}>{(() => { const sans = venduesEbay.filter((r) => !r.ident); const ns = sans.map((r) => 'N°' + r.numero).join(', '); return sans.length > 1 ? `${ns} : annonces inconnues, retire-les toi-même dans « Mes annonces ».` : `${ns} : annonce inconnue, retire-la toi-même dans « Mes annonces ».`; })()}</span></> : null}
                </div>
                {venduesEbay.slice(0, 30).map((r, i) => Ligne(r, i, C.danger, true))}
              </Card>
            </div>)}
            {venduesVc.length > 0 && (
              <Card style={{ borderColor: C.warn }}>
                <Titre>{venduesVc.length} vendue{venduesVc.length > 1 ? 's' : ''} sur Vestiaire — à retirer de Leboncoin</Titre>
                <div data-lbc-retirer-vestiaire={venduesVc.length} style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Vente Vestiaire <b>prouvée</b> : retire-{venduesVc.length > 1 ? 'les' : 'la'} de Leboncoin.</div>
                {venduesVc.slice(0, 30).map((r, i) => Ligne(r, i, C.danger, true))}
              </Card>
            )}
            {doute.length > 0 && (
              <Card>
                <Titre>{doute.length} plus en ligne sur Vinted — à vérifier</Titre>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Plus sur Vinted, <b>vente pas prouvée</b> : ouvre-les et décide.</div>
                {doute.slice(0, 30).map((r, i) => Ligne(r, i, C.warn))}
                {carteDoute === 'doute' ? phraseDoute : null}
              </Card>
            )}
            {pause.length > 0 && (
              <Card>
                <Titre>{pause.length} en pause sur Vinted</Titre>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Masquées sur Vinted, pas vendues : elles restent sur Leboncoin, <b>rien à faire</b>.</div>
                {pause.slice(0, 20).map((r, i) => Ligne(r, i, C.muted))}
                {carteDoute === 'pause' ? phraseDoute : null}
              </Card>
            )}
          </>);
        })()}
        {/* (22 oct.) Ce que Leboncoin a répondu à chaque mise en pause demandée
            d'ici — la ligne « à retirer » disparaît une fois la pause acceptée,
            la réponse, elle, reste lisible. */}
        {supprRes.length > 0 && (
          <Card className="vrm-lbc-suppressions">
            <Titre>Suppression sur Leboncoin</Titre>
            {supprRes.map((x) => { const p = phraseSuppr(x); return (
              <div key={x.id} data-lbc-supprimer-resultat={x.id} data-etape={p.etape} style={{ fontSize: 13, color: p.etape === 'fait' ? C.text : C.warn, padding: '3px 0', lineHeight: 1.45 }}>
                {x.numero ? <b>N°{x.numero} · </b> : null}{x.titre || '—'} — {p.t}
              </div>
            ); })}
          </Card>
        )}
        {pauseRes.length > 0 && (
          <Card className="vrm-lbc-pauses">
            <Titre>Mise en pause sur Leboncoin</Titre>
            {pauseRes.map((x) => { const p = phrasePause(x); return (
              <div key={x.id} data-lbc-pause-resultat={x.id} data-etape={p.etape} style={{ fontSize: 13, color: p.etape === 'fait' ? C.text : C.warn, padding: '3px 0', lineHeight: 1.45 }}>
                <b>N°{x.numero}</b> · {x.titre || '—'} — {p.t}
              </div>
            ); })}
          </Card>
        )}
        {/* ⚠️⚠️ LA PREUVE DE VENTE N'A PAS PU ÊTRE LUE : la file peut contenir des
            paires déjà vendues. Mesuré le 15 septembre — une lecture ratée a fait
            passer la file de 40 à 55. On ne cache pas la liste, on dit ce qu'on
            n'a pas pu vérifier. */}
        {/* « Je n'ai pas pu vérifier lesquelles sont déjà vendues » est dit une fois,
            dans le bloc des lectures ratées en haut de l'écran. */}
        {/* Annonces Leboncoin non reliées à une paire VRM : informatif. On ne les
            présente JAMAIS comme « à retirer » (VRM ne connaît pas la paire). */}
        {data.unlinked && data.unlinked.length > 0 && (
          <Card className="vrm-lbc-non-reliees">
            <Titre>{data.unlinked.length} annonce{data.unlinked.length > 1 ? 's' : ''} Leboncoin non reliée{data.unlinked.length > 1 ? 's' : ''}</Titre>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>Quel article ? Choisis-le, ou tape son <b>N°</b> et « Relier ».</div>
            {data.unlinked.slice(0, 40).map((u) => <LbcRelier key={String(u.id || u.url || u.subject)} ad={u} numsConnus={data.numsConnus || []} onRelie={reload} suggestions={u.suggestions} cleRangement={u.id != null ? 'ad:' + u.id : ''}/>)}
            {data.unlinked.length > 40 && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>… et {data.unlinked.length - 40} autre{data.unlinked.length - 40 > 1 ? 's' : ''}.</div>}
          </Card>
        )}
        {/* Diagnostic fourni par Leboncoin lui-même sur tes annonces en ligne. */}
        {(() => {
          const flagged = (data.liveAds || []).filter(a => a.issue);
          if (!flagged.length) return null;
          return (
            <Card>
              <Titre>{flagged.length} annonce{flagged.length > 1 ? 's' : ''} signalée{flagged.length > 1 ? 's' : ''} par Leboncoin</Titre>
              <div className="vrm-aide" style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Selon Leboncoin, elles sortent mal : prix, titre ou photos.</div>
              {flagged.slice(0, 20).map((a, i) => (
                <div key={i} style={{ fontSize: 13, color: C.text, padding: '3px 0' }}>
                  {a.subject || '—'}{a.price != null && isFinite(Number(a.price)) ? ` · ${Number(a.price).toFixed(2).replace('.', ',')}\u00a0€` : ''} · <span style={{ color: C.warn, fontWeight: 700 }}>{a.issue === 'LowVisibility' ? 'peu visible' : a.issue}</span>
                  {a.url ? <> · <a href={a.url} target="_blank" rel="noreferrer" style={{ color: C.blue || C.accent, fontWeight: 700 }}>voir</a></> : null}
                </div>
              ))}
            </Card>
          );
        })()}
        {/* À publier */}
        <Card className="vrm-lbc-a-publier">
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{(data.echecLecture || data.postedKO) ? '—' : data.queue.length} à publier sur Leboncoin{data.autoMatched > 0 ? <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}> · {data.autoMatched} déjà reconnue{data.autoMatched > 1 ? 's' : ''} en ligne</span> : null}</div>
          {/* ⚠️ UNE ANNONCE QUE TU AS RETIRÉE NE DISPARAÎT PAS EN SILENCE.
              Sans cette ligne, désélectionner faisait fondre la file sans que
              rien ne dise pourquoi — et « 0 à publier » se serait lu « tout est
              fait ». On dit combien, et où c'est réglé. */}
          {data.vendues > 0 && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
              {data.vendues} <b>déjà vendu{data.vendues > 1 ? 's' : ''} sur Vinted</b>, hors de cette file. <Pourquoi label="Pourquoi">Vinted laisse parfois l'annonce ouverte après la vente ; c'est la transaction qui fait foi.</Pourquoi>
            </div>
          )}
          {/* ⚠️ Revue de la 5.167 : les annonces « à confirmer » (compte pas relu
              depuis 24 h) sortaient de la file SANS UN MOT — et quand c'étaient
              toutes, l'écran affirmait « tu n'as pas encore d'annonce en ligne ».
              La cause est connue : on la dit, une fois, au-dessus de la file. */}
          {data.aConfirmer > 0 && !data.echecLecture && (
            <div data-lbc-a-confirmer={data.aConfirmer} style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
              {data.aConfirmer} à confirmer (compte{data.aConfirmer > 1 ? 's' : ''} pas relu{data.aConfirmer > 1 ? 's' : ''} depuis 24 h) — rien n'est supprimé, détail sur <b>Annonces</b>.
            </div>
          )}
          {data.retirees > 0 && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
              {data.retirees} retirée{data.retirees > 1 ? 's' : ''} de Leboncoin par toi — réglable sur <b>Annonces</b> (puce « Aussi sur »).
            </div>
          )}
          {/* ⚠️ « Tout est publié 🎉 » se disait aussi quand la file était vide
              parce que la base n'avait pas répondu — une fête sur une lecture
              ratée. Le 🎉 ne sort que si on a pu REGARDER. */}
          {data.queue.length === 0 ? ((data.echecLecture || data.postedKO)
            ? <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>File pas lue (lecture ratée), pas vide.</div>
            /* ⚠️⚠️ TROISIÈME CAUSE, VUE AU RENDU LE 16 SEPTEMBRE SUR UNE
               INSTALLATION NEUVE : « Tout est publié 🎉 (toutes tes paires
               numérotées en ligne sont sur Leboncoin) » s'affichait à quelqu'un
               qui n'a AUCUNE annonce. Rien n'est publié, et la parenthèse
               affirme une chose qui ne veut rien dire sur zéro paire. Une file
               vide a ici encore une cause connue — et une cause connue se dit.
               Troisième forme, après « lecture ratée » et « tout décoché ». */
            /* Quatrième cause (revue de la 5.167) : tout est « à confirmer » — la
               ligne au-dessus le dit ; affirmer « pas encore d'annonce » serait faux. */
            : data.nEnLigne === 0 && data.aConfirmer > 0
              ? <div data-lbc-vide="a-confirmer" style={{ fontSize: 13, color: C.muted }}>Comptes à relire</div>
            : data.nEnLigne === 0
              ? <div style={{ fontSize: 13, color: C.muted }}>Aucune annonce Vinted en ligne</div>
            : data.nNumerotees === 0
              ? <div style={{ fontSize: 13, color: C.muted }}>{data.nEnLigne} annonce{data.nEnLigne > 1 ? 's' : ''} sans numéro</div>
            : data.retirees > 0 && data.autoMatched === 0
              // ⚠️ « Tout est publié 🎉 » serait faux : rien n'est publié, tout
              //    a été retiré de la file. Deux causes, deux phrases.
              ? <div style={{ fontSize: 13, color: C.muted }}>Rien dans la file</div>
              : <div style={{ fontSize: 12, color: C.muted }}>Tout est publié 🎉 ({motsVendeur().toutes} {motsVendeur().tes} numéroté{motsVendeur().e}s en ligne sont sur Leboncoin).</div>) : (<>
            {/* ⚠️⚠️ « EXACTEMENT TEL QU'IL PARTIRA » EST UNE PROMESSE SUR L'EXTENSION.
                C'est ELLE qui publie, avec SA version de la règle : une extension
                antérieure à 5.55.4 enverra l'ancien titre, coupé en plein mot.
                Sans cette garde, l'app promettrait ce que l'extension installée ne
                sait pas faire — le défaut le plus coûteux du projet, déjà refait
                quatre fois (le zip, les codes de retrait, les places, eBay). */}
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
              {extSait('lbctitre') === 'ok'
                ? <Pourquoi ecrit label="Ce que VRM publie">Voici le titre <b>exactement tel qu'il partira</b> sur Leboncoin (50 caractères max, la taille à la fin). L'extension y joint la description et les photos, puis publie sans option payante.</Pourquoi>
                : extSait('lbctitre') === 'absente'
                  /* Revue du 16 octobre : « la publication se fait depuis ton
                     ordinateur » était dit ici ET dans la ligne juste dessous
                     (`RaisonPublication`) — une cause, une phrase (§7). */
                  ? <Pourquoi ecrit label="Ce que VRM publie">Voici le titre <b>que VRM proposera</b> sur Leboncoin (50 caractères max, la taille à la fin).</Pourquoi>
                  : <>Voici le titre <b>que VRM propose</b>. ⚠️ <b>Ton extension est plus ancienne que la {EXT_CAPACITES.lbctitre}</b> : elle publiera encore l'ancien titre (coupé en plein mot). Mets-la à jour (Paramètres → État des connexions).</>}
            </div>
            {/* ⚠️ LA LISTE SE GROUPE SUR CE QU'IL PEUT FAIRE, pas sur le numéro.
                C'est la loi de l'écran Colis : mesuré ici, 54 des 59 annonces
                partiraient avec UNE SEULE photo, parce que les photos HD ne sont
                lues que sur la page de l'annonce (l'API Vinted n'en renvoie
                aucune — 0 sur 57 lignes, vérifié). Mettre ces 54 en haut, c'est
                mettre devant ce qui fera une annonce bâclée. */}
            <RaisonPublication n={data.queue.length} place="lbc"/>
            <LbcCroitVendue n={data.queue.filter(q => q.croitVendue).length}/>
            {(() => {
              const pretes = data.queue.filter(q => q.photos >= 2);
              const maigres = data.queue.filter(q => q.photos === 1);
              // ⚠️ VU EN CAPTURE : « N°30 · 49,00 € · 0 photo », rangée sous
              //    « Une seule photo ». Une annonce sans AUCUNE photo ne peut
              //    pas être publiée sur Leboncoin — ce n'est pas une nuance,
              //    c'est un blocage, et il doit être en haut.
              const nues = data.queue.filter(q => q.photos === 0);
              // Un seul groupe ⇒ pas de titre de groupe : il répéterait le
              //    compte de l'en-tête (§7, le même nombre deux fois).
              const groupes = [pretes, maigres, nues].filter(g => g.length).length;
              // (17 oct.) UNE CARTE PAR PAIRE — Julien : « j'aime pas le visuel des
              // propositions de paires à publier ». La photo en grand, le N° et
              // le prix d'un coup d'œil, ce qui manque en pastilles (l'ambre
              // seulement pour ce qui BLOQUE), les gestes en bas. La même paire
              // sous deux N° (photo exacte) : la seconde ne propose pas de
              // publier, elle dit laquelle est la bonne.
              const Ligne = (q) => {
                const toutes = Array.isArray(q.photosAll) ? q.photosAll : [];
                // Combien MANQUENT à la capture (le vrai nombre d'après Vinted).
                const manque = (q.nReelles != null && q.nReelles > q.photos) ? (q.nReelles - q.photos) : 0;
                const jm = q.jumelle || null;
                const vign = toutes.slice(1, 7);
                return (
                <div key={q.id} className="vrm-apub-carte" data-apub={q.numero} {...(jm ? { 'data-apub-jumelle': cleNum(jm.num) } : {})}>
                  <div className="vrm-apub-haut">
                    {toutes[0]
                      ? <PhotoVinted src={toutes[0]} alt="" loading="lazy" decoding="async" className="vrm-apub-photo" style={{ width: 84, height: 84, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                      : <span className="vrm-apub-photo"><Icon name="image" size={24} style={{ opacity: .5 }} /></span>}
                    <div className="vrm-apub-corps">
                      <div className="vrm-apub-ligne1">
                        <span className="vrm-apub-num">N°{q.numero}</span>
                        <span className="vrm-apub-prix">{montant(q.prix)}</span>
                      </div>
                      <div className="vrm-apub-titre">{q.title || '—'}</div>
                      <div className="vrm-apub-pastilles">
                        <span className="vrm-apub-pastille" data-ton={q.photos === 0 ? 'bloque' : undefined}>{q.photos === 0 ? 'Aucune photo' : `${q.photos}${q.nReelles != null && q.nReelles > q.photos ? `/${q.nReelles}` : ''} photo${q.photos > 1 ? 's' : ''}`}</span>
                        {!q.desc && <span className="vrm-apub-pastille">Pas de description</span>}
                        {q.compte ? <span className="vrm-apub-pastille">{q.compte}</span> : null}
                      </div>
                    </div>
                  </div>
                  {(vign.length > 0 || manque > 0) && (
                    <div className="vrm-apub-vignettes">
                      {vign.map((src, i) => <PhotoVinted key={i} src={src} alt="" loading="lazy" decoding="async" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />)}
                      {manque > 0 && <span className="vrm-apub-plus" data-photos-manquantes={manque} title={tr('photosFond.titre')}>+{manque}</span>}
                    </div>
                  )}
                  {jm && <div className="vrm-apub-jumelle" data-apub-jumelle-texte="">{jm.posee
                    ? <>Même photo que la <b>N°{jm.num}</b>, déjà sur Leboncoin : c'est le même article, il ne se publie pas deux fois.</>
                    : <>Même photo que la <b>N°{jm.num}</b> : c'est sans doute le même article sous deux N°. Publie la N°{jm.num} seulement.</>}</div>}
                  <div className="vrm-apub-gestes">
                    {/* Le bouton dit les photos captées sur le total (11 octobre) —
                        une fois, là où on décide de publier (§7). */}
                    {!jm && q.photos > 0 && <BoutonPublier place="lbc" id={q.id} croitVendue={!!q.croitVendue} photos={q.photos} total={q.nReelles} onFiche={() => setFiche(q)}/>}
                    <a href={q.url} target="_blank" rel="noreferrer" className="vrm-apub-lien">Annonce Vinted ↗</a>
                    <button type="button" onClick={() => marquer(q.id)} title="Tu l'as déjà publiée toi-même : elle sort de la file" className="vrm-apub-lien">Déjà publiée</button>
                  </div>
                </div>
                );
              };
              // Appelé comme une FONCTION (pas `<Groupe/>`) : un composant défini
              // dans le rendu est un type neuf à chaque fois, React remontait les
              // cartes à chaque rafraîchissement (29 oct., banc lbc-publier-app H).
              const Groupe = ({ titre, liste, note, ton }) => (<>
                {groupes > 1 && <div className="vrm-apub-groupe"><span className="vrm-apub-groupe-titre" style={ton ? { color: C.warn } : undefined}>{titre}</span><span className="vrm-apub-groupe-n">{liste.length}</span></div>}
                {note ? <div className="vrm-apub-groupe-note">{note}</div> : null}
                <div className="vrm-apub-grille">{liste.slice(0, 40).map(Ligne)}</div>
                {liste.length > 40 && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>+ {liste.length - 40} autres…</div>}
              </>);
              return (<>
                {nues.length > 0 && Groupe({ titre: "Aucune photo", ton: true, liste: nues, note: <>{tr('photosFond.noteAucune')}</> })}
                {pretes.length > 0 && Groupe({ titre: "Prêtes", liste: pretes })}
                {maigres.length > 0 && Groupe({ titre: "Une seule photo", liste: maigres, note: <>{tr('photosFond.noteUne')} <Pourquoi label="Pourquoi">Une annonce Leboncoin avec une seule photo se vend mal. Vinted ne donne les autres photos que sur la page de l'annonce.</Pourquoi></> })}
              </>);
            })()}
          </>)}
        </Card>
      </>)}
      {/* ── DÉTAILS ET RÉGLAGES, REPLIÉS (4 octobre) ─────────────────────────
          Julien : « que Leboncoin soit beaucoup plus intuitif ». Mesuré : la
          liste « à publier » — la seule chose qu'il fait vraiment ici — était
          le DERNIER de douze blocs, après la préparation de la publication, un
          paragraphe d'explication, les comptes et la limite de l'offre. Ce qui
          se LIT une fois descend ici ; ce qui se FAIT reste en haut. */}
      {data && Array.isArray(data.liensPoses) && data.liensPoses.length > 0 && (
        <details data-lbc-liens={data.liensPoses.length} className="vrm-repli" style={{ marginTop: 6 }}>
          <summary>{motsVendeur().Noms} que tu as relié{motsVendeur().e}s ({data.liensPoses.length}) — corriger une erreur</summary>
          <Card>
            {data.liensPoses.map((l, i) => (
              <div key={l.id} data-lien-lbc={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: C.card2 || C.border }}>
                  {l.image ? <PhotoVinted src={l.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : null}
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titre || 'Annonce Leboncoin'}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>reliée à la N°{l.numero}</div>
                </div>
                <button type="button" data-lbc-delier={l.id} onClick={() => { gesteDelierLbc(l.id, l.numero, reload); }}
                  style={{ border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 12, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: C.text, cursor: 'pointer' }}>Délier</button>
              </div>
            ))}
          </Card>
        </details>
      )}
      {data && (
        <details data-lbc-details="" className="vrm-repli" style={{ marginTop: 6 }}>
          <summary>Détails et réglages</summary>
          <div style={{ paddingTop: 8 }}>
      {/* ══════════════════════════════════════════════════════════════════════
          PUBLIER TOUT SEUL : OÙ ÇA EN EST, ET CE QUI FAIT AVANCER
          ══════════════════════════════════════════════════════════════════════
          L'extension collecte depuis quatre versions — le catalogue des codes de
          Leboncoin, la config de son formulaire (qui est DYNAMIQUE : mesuré,
          `api/adsubmit/dynamic-deposit/config`), la forme de ce qui part — et
          l'app n'en montrait RIEN. Julien ne pouvait donc pas savoir si ça
          avançait, ni quel geste faisait avancer : il a refait trois dépôts à la
          main sans jamais voir de retour. C'est le motif du tiroir `Nav` (§4.11),
          sur la chose qu'il attend.
          ⚠️ On écrit des FAITS — des tailles, des dates, des noms d'endpoint — et
             le GESTE. Jamais « bientôt », jamais un pourcentage inventé. */}
      {(() => {
        const p = data && data.prep;
        if (p === undefined) return null;
        // Trois états, jamais deux : pas su · jamais publié · lu.
        const morceaux = (p && p.morceaux) || {};
        const PIECES = [
          ['codes', 'Les codes de Leboncoin', 'marques, tailles, états — leurs valeurs exactes'],
          ['config', 'La composition du formulaire', 'quels champs, dans quel ordre, par catégorie'],
          ['prerempli', 'Ce que Leboncoin remplit tout seul', 'la catégorie, la description et le prix qu’il propose'],
          ['soumission', 'La forme de la publication', 'les champs attendus quand on valide'],
        ];
        const aPiece = (k) => { const m = morceaux[k]; return m && m.taille > 0 ? (m.coupe ? 'coupe' : 'ok') : 'non'; };
        const faits = PIECES.filter(([k]) => aPiece(k) === 'ok').length;
        const coupes = PIECES.filter(([k]) => aPiece(k) === 'coupe').length;
        const pastille = (e) => e === 'ok' ? { t: '✓', c: INV_STATUS.online.color } : e === 'coupe' ? { t: '⚠', c: C.warn } : { t: '·', c: C.muted };
        // Le geste : un seul, celui qui débloque le plus. Jamais une liste.
        // Tout reçu : la carte n'a plus rien à apprendre — elle disparaît (§7).
        if (p && p.majAt && ['codes', 'config', 'prerempli', 'soumission'].every((k) => { const m = morceaux[k]; return m && m.taille > 0 && !m.coupe; })) return null;
        const geste = p === null ? null
          : !p.majAt ? { q: 'Mets l’extension à jour, puis passe une fois sur leboncoin.fr.', d: 'Rien n’a encore été relevé : c’est la visite qui déclenche tout.' }
          : aPiece('codes') !== 'ok' ? { q: 'Passe une fois sur leboncoin.fr.', d: 'Leboncoin envoie ses codes au chargement — l’extension les attrape au passage.' }
          : aPiece('config') !== 'ok' || aPiece('soumission') !== 'ok'
            ? { q: 'Dépose une annonce à la main, jusqu’au bout.', d: 'VRM apprend ainsi le formulaire de Leboncoin.' }
            : null;
        return (
          <Card style={{ borderColor: C.border }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>Publier sans rien retaper — préparation</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
              {p === null
                ? 'Je n’ai pas pu lire où ça en est. Rien n’est perdu — rouvre cet écran dans un moment.'
                : <><b>{faits} sur {PIECES.length}</b> pièces {faits > 1 ? 'reçues' : 'reçue'}{coupes ? `, ${coupes} incomplète${coupes > 1 ? 's' : ''}` : ''}{' '}<Pourquoi label="Pourquoi ces pièces" titre="Publier sans rien retaper">Le formulaire de Leboncoin n’est pas le même d’une annonce à l’autre : il est <b>construit</b> à partir d’une configuration qu’il envoie. Il me faut ces quatre pièces pour remplir juste.</Pourquoi></>}
            </div>
            {p !== null && (
              <div style={{ display: 'grid', gap: 5, marginBottom: geste ? 10 : 0 }}>
                {PIECES.map(([k, titre, quoi]) => {
                  const e = aPiece(k); const pa = pastille(e); const m = morceaux[k] || {};
                  return (
                    <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12 }}>
                      <span style={{ color: pa.c, fontWeight: 700, width: 12, flexShrink: 0 }}>{pa.t}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: e === 'non' ? C.muted : C.text, fontWeight: e === 'non' ? 500 : 700 }}>{titre}</span>
                        <span style={{ color: C.muted }}> — {quoi}</span>
                        {e === 'coupe' && <span style={{ color: C.warn }}> · reçue incomplète, elle se recomplètera à ta prochaine visite</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {geste && (
              <div style={{ fontSize: 12, color: C.text, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 10px' }}>
                <b>{geste.q}</b> <span style={{ color: C.muted }}>{geste.d}</span>
              </div>
            )}

          </Card>
        );
      })()}
      {/* ⚠️ MÊME DÉFAUT QUE LA LIGNE DES PLACES, TROUVÉ EN BALAYANT « télécharg » :
          cette phrase-ci disait aussi « photos téléchargées » et n'était gardée
          par AUCUNE version. Depuis la 5.58 elles s'attachent au formulaire.
          *Une suppression « terminée » se vérifie sur ce qui RESTE* — le premier
          correctif n'avait touché qu'un des deux endroits. */}
      {/* ⚠️⚠️ ET ELLE NE CONNAISSAIT QUE DEUX ÉTATS — vu au rendu le 15 septembre
          sur ses vraies données. `extSait` en rend TROIS, et le troisième est
          celui de son iPhone : **absente**. L'écran lui annonçait alors
          « photos téléchargées dans un dossier » — la description d'un
          comportement qui ne peut PAS avoir lieu (sans extension, rien n'est
          téléchargé ni attaché), au lieu de lui dire le vrai geste : ouvrir
          l'app sur l'ordinateur où elle est installée. C'est exactement le trou
          du premier jet d'`extSaitLireCodes` (« l'extension la plus en retard
          était la seule à ne rien déclencher »), et l'écran Annonces, lui,
          traitait déjà les trois. *« Pas su » ne vaut pas « oui ».* */}
      {/* (6 nov., v36-visuel — « des murs de texte ») Une ligne ; le comment, derrière le « ⓘ ». */}
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.4 }}>La file : tes annonces en ligne sur Vinted.{' '}<Pourquoi label="Comment se fait la file" titre="La file Leboncoin">La file est construite à partir de tes <b>annonces réellement en ligne sur Vinted</b> (comptes actifs uniquement, {motsVendeur().noms} retiré{motsVendeur().e}s exclu{motsVendeur().e}s). {(() => {
        // Trois états, jamais deux (§ extSait) — et la phrase suit la version
        // INSTALLÉE : c'est l'extension qui publie, avec SA règle.
        const e = extSait('publication');
        if (e === 'ok') return <>{motsVendeur().chaque} a son bouton <b>« Publier sur Leboncoin »</b> : l'extension ouvre le dépôt, attache les photos, remplit tout et publie <b>sans option payante</b>.</>;
        if (e === 'retard') return <>Le bouton <b>« Publier sur Leboncoin »</b> arrive avec l'extension <b>{EXT_CAPACITES.publication}</b> : mets-la à jour depuis <b>Paramètres → État des connexions</b>. En attendant, celle installée publie encore depuis son panneau sur leboncoin.fr.</>;
        return <>Publie depuis l'ordinateur où est l'extension.</>;
      })()}</Pourquoi></div>

      {/* COMPTES LEBONCOIN — plusieurs comptes possibles. On liste ceux que
          l'extension a réellement vus connectés dans le navigateur, avec le
          nombre d'annonces rattachées à chacun. Sans ça, impossible de savoir
          depuis quel compte republier. */}
      {data && (data.lbcAccounts || []).length > 1 && (
        <div style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 14, padding: '13px 15px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Comptes Leboncoin détectés</div>
          {data.lbcAccounts.map(a => {
            const nb = ((data.parCompte || {})[String(a.id)] || []).length;
            const vu = a.seenAt ? new Date(a.seenAt) : null;
            const jours = vu ? Math.floor((Date.now() - vu.getTime()) / 86400000) : null;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, background: C.bg, border: `1px solid ${C.border}`, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                  {String(a.name || '?').slice(0, 1).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span data-compte-lbc-nom={a.id} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name || 'nom pas encore lu'}{a.type === 'pro' ? ' · pro' : a.type === 'particulier' ? ' · particulier' : ''}</span>
                  <span data-compte-lbc-annonces={nb} style={{ display: 'block', fontSize: 11, color: C.muted, marginTop: 1 }}>
                    {data.lbcConnecte && String(data.lbcConnecte.id) === String(a.id) ? 'dernier compte relevé · ' : ''}{nb} annonce{nb > 1 ? 's' : ''}{jours != null ? ` · vu ${jours === 0 ? "aujourd'hui" : `il y a ${jours} j`}` : ''}
                  </span>
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            Ouvre Leboncoin, connecté : le compte apparaît ici.
          </div>
        </div>
      )}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>Limite de ton offre Leboncoin</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{data.limit ? `${data.limit} annonces au maximum${data.plan ? ` · offre ${data.plan}` : ''}.` : 'Pas encore indiquée : le compteur ne peut pas te prévenir avant la limite.'}</div>
              <QuotaLbc limit={data.limit} plan={data.plan} onFait={reload}/>
            </Card>
          </div>
        </details>
      )}
    </div>
  );
}
export { LeboncoinScreen, LeboncoinColis };
