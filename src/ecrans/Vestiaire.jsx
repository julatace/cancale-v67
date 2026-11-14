// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { problemesAnnonce } from '../verifAnnonce.js';
import { AlerteArnaque, CompteurArnaque, PastilleArnaque } from '../AlerteArnaque.jsx';
import { motifDeLApercu } from '../antiArnaque.js';
import { ordreRecent, quandVestiaire } from '../ordreRecent.js';
import { STYLE_FLOU, vcFloute } from '../flouCompte.js';
import { ListeParCompte } from '../GroupesComptes.jsx'; // (11 nov.) lignes floutées regroupées par compte
import { lienDe, vcReliable } from '../lienVestiaire.js';
import React, { useState, useEffect } from 'react';
import { suivi, suivreJob } from '../suiviTravail.js';   // (11 nov., lot suivi-travail) VRM figé, détail et barre
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { PAS_SU } from '../libelles.js';
import { trierRecents } from '../ordreConversations.js';
import { etatEnvoiExtension, dejaDansFil, filPasLu } from '../envoiFil.js';   // (12 nov.) l'envoi vu dans le fil
import { EnvoiDansFil, FilPasLu, FilIllisible } from '../composants/EnvoiDansFil.jsx';
import { VC_VENTE_ETAPES, VC_ANNONCE_ETATS, etapeMotVc, vcVenteAnnulee, numVcVente, numVcAnnonce, montantRecuVc, departsVc, etatAnnonceVcBrut, fraisVc } from '../../api/_lib/vestiaire-regle.js';
import PastilleTransporteur from '../PastilleTransporteur.jsx';
import { transporteurDuColis } from '../transporteursVisuels.js';
import { texteBenefice, euros as eurosLigne } from '../beneficeLigne.js';
import { friseVente, eurosRecap } from '../recapVente.js';
import Frise from '../design/Frise.jsx';
import { friseVenteFusion } from '../design/friseFusion.js';
import { attrCible } from '../cibleNotif.js';
import { nomCompteVente } from '../plateformes.js';
import { champsFacultatifs, motsVendeur } from '../profilVendeur.js';
import { InfoPop, AUTH, BlocBarrerVc, Bouton, BoutonImprimerVc, BulleConv, C, CadreFil, Card, ComposeConv, CoutAchatVente, DEMANDE_VC_PAIRE, EXT_CAPACITES, FicheConvVolet, Icon, LigneConv, LigneVenteCompacte, MULTI_USER, NAV, PhotoVc, PhotoVinted, PiedSansEnvoi, Pourquoi, RapidesConv, RecapFrise, SUPABASE_URL, TeteFil, __vmrJobs, __vmrNotifier, aLaDemande, ageCourtVc, askConfirm, cleNum, clePhotoLbc, dateCourteVc, defaireVc, emettreClesRelues, enTeteSession, extSait, familleArticle, ficheUniqueDuNumero, fmt, gesteVrm, limiteVcTexte, lireBaseRelue, load, nonLusVestiaire, normTitle, onCloudReady, prixAchatDe, raisonExtGlobale, rangementDuNum, reponsesRapidesPartagees, save, sbAuth, signalerVc, urlPhotoVc, useCompteVcOuvert, useEbayPaires, useExtVivante, useNumerotationVestiaire, useSansSouris, useStateCle, useVcLocal, vcCarte, vcSetter, verifierAvantPublication, vmrCmd, vendActuel, optsNumeroVerif, FermeAuRetour } from '../App.jsx';

// ⟦← App.jsx #1⟧
import { preuvesFriseVc, preuvesFriseEbay } from "../friseSites.js";
import ParcoursVestiaire, { LigneArgentVc, etapeEnCoursVc } from "../ParcoursVestiaire.jsx";
import PhotosVestiaire, { textePhotosManquantes } from "../PhotosVestiaire.jsx";
const BaissePrixVestiaire = aLaDemande(() => import("../BaissePrixVestiaire.jsx"));
import { photosExigeesVc } from "../photosVestiaire.js";
import { tr } from "../i18n/index.js";
// ⟦← App.jsx #2⟧
// (6 nov., vitesse 2) OffresVestiaire : à la demande.
import { offresVestiaire, euros } from "../offresVestiaire.js";
// ⟦← App.jsx #4⟧
// ⟦→ ecrans/Compta.jsx #5⟧
import { cleUtilisable, lirePhotoroom, appelPhotoroom, phraseVerif, phraseSansReponse, dateCourte, LIEN_CLE, LIEN_TARIFS } from "../photoroomCle.js";
// (10 nov., lot S) La facture Pro : Vestiaire ne donne pas le prix payé par l'acheteur (src/FactureAutres.jsx).
import { DEPS_FACTURE } from '../App.jsx';
const FactureVcTeteParesseuse = React.lazy(() => import('../FactureAutres.jsx').then((m) => ({ default: m.FactureVcTete })));
const FactureVcTete = (props) => <React.Suspense fallback={null}><FactureVcTeteParesseuse {...props}/></React.Suspense>;
// (11 nov., extension 5.340) La facture Pro d'UNE vente, quand l'extension a lu son prix de vente (`prixVente`).
const FactureVcVenteParesseuse = React.lazy(() => import('../FactureAutres.jsx').then((m) => ({ default: m.FactureAutreVente })));
const FactureVcVente = (props) => <React.Suspense fallback={null}><FactureVcVenteParesseuse {...props}/></React.Suspense>;

// ⟦← App.jsx #3⟧
const OffresVestiaire = aLaDemande(() => import('../OffresVestiaire.jsx'));
// ⟦← App.jsx #5⟧
// La fiche VRM d'un N° — par le NUMÉRO seulement (l'identité écrite sur le carton,
// §5). Deux fiches sous ce N° qui ne portent pas le même titre : il ne désigne
// personne (la règle de `numEbayLu`) ⇒ `null`, jamais un choix au hasard.
const ficheDuNumero = (num) => {
  const k = cleNum(num || ''); if (!k) return null;
  let fiches = {}; try { fiches = load('vinted_annonce_numeros', {}) || {}; } catch (_) {}
  const porteurs = Object.values(fiches).filter((f) => f && f.numero != null && cleNum(f.numero) === k);
  if (!porteurs.length) return null;
  if (new Set(porteurs.map((f) => normTitle(f.title || ''))).size > 1) return null;
  const f = porteurs.slice().sort((a, b) => (Number(b.numberedAt) || 0) - (Number(a.numberedAt) || 0))[0];
  return { titre: f.title || '', photo: f.photo || null };
};
// ⟦← App.jsx #6⟧
// ⟦→ ecrans/Ebay.jsx #25⟧
// (17 oct.) Les achats eBay sont lus (Trading GetMyeBayBuying) : `EbayAchats`
// vit dans ebayGestion.jsx, avec les retours, annulations et la promotion.
// ── VESTIAIRE : OÙ EN EST LA MESURE DU SITE (4 octobre, extension 5.154) ─────
// On ne chiffre AUCUNE vente Vestiaire tant que la mesure n'a pas montré où vit
// une vente, son montant net et sa date. En attendant, l'écran dit où en est la
// mesure et quel geste la fait avancer — lu sur les SCALAIRES de `vc_recon`
// (colonne meta, §4.4 : jamais la ligne entière).
// Trois états, jamais deux : `undefined` en cours · `null` pas su · objet lu
// (`{}` = jamais relevé).
// ── TA CLÉ PHOTOROOM (26 octobre ; carte refaite et coffre le 29 octobre) ────
// Julien, 29 oct. : « fais un meilleur visuel pour la clé API Photoroom des
// personnes qui utilisent VRM ». UNE carte, rendue dans l'écran Vestiaire (là
// où elle sert : Vestiaire exige des photos sur fond net).
// ⚠️ (29 oct., revue) PAS dans les Paramètres : le 17 octobre il a dit du
//    détourage « ne le mets pas dans les paramètres », et sa demande du 29 ne
//    parle pas des Paramètres. Le banc `detourage-reglage` refuse la CARTE
//    (`data-photoroom-cle`) dans les Paramètres — pas un mot de son titre.
// La clé ne revient JAMAIS au navigateur : il l'envoie une fois, le serveur la
// vérifie chez Photoroom, la chiffre et la range ; on n'en montre que les 4
// derniers caractères. Trois états, jamais deux : `undefined` lecture · `null`
// pas su (aucun formulaire : on n'agit pas sur ce qu'on n'a pas lu) · l'objet.
function ClePhotoroom({ cadre = true }) {
  const owner = AUTH.user?.id;
  const [s, setS] = useState(undefined);
  const [val, setVal] = useState('');
  const [remplacer, setRemplacer] = useState(false);
  const [occupe, setOccupe] = useState('');     // '' | 'poser' | 'verifier' | 'retirer'
  const [msg, setMsg] = useState(null);         // { ton, texte }
  // (29 oct., revue) « maintenant chiffrée » n'est dit que si la copie EN CLAIR
  // a vraiment été effacée (la base l'a confirmé) ; sinon on dit qu'elle reste,
  // et le serveur réessaie à chaque ouverture de cette carte.
  const relire = React.useCallback(async () => {
    setS(undefined);
    const j = await lirePhotoroom(enTeteSession());
    setS(j);
    if (j && j.ancienneEffacee === false) setMsg({ ton: 'attention', texte: "Ta clé est rangée chiffrée dans le coffre du serveur, mais son ancienne copie, lisible par ton navigateur, n'a pas pu être effacée cette fois. Je réessaie à chaque ouverture de cette carte." });
    else if (j && j.migree && j.ancienneEffacee === true) setMsg({ ton: 'neutre', texte: "Ta clé, rangée jusqu'ici lisible par ton navigateur, est maintenant chiffrée dans le coffre du serveur." });
    else if (j && j.ancienneEffacee === true) setMsg({ ton: 'neutre', texte: "L'ancienne copie de ta clé, lisible par ton navigateur, est maintenant effacée." });
  }, []);
  useEffect(() => { if (owner && MULTI_USER) relire(); }, [owner, relire]);
  if (!MULTI_USER || !owner) return null;

  const poser = async () => {
    const cle = val.trim();
    if (!cle) return;
    setOccupe('poser'); setMsg(null);
    const { code, j } = await appelPhotoroom(enTeteSession(), { action: 'poser', cle });
    setOccupe('');
    if (code === 200 && j.ok) { setS(j); setVal(''); setRemplacer(false); setMsg({ ton: 'ok', texte: `✓ Clé rangée (se termine par ${j.fin}). Elle est chiffrée sur le serveur : VRM ne te la remontrera jamais en entier.` + (j.ancienneEffacee === false ? " Son ancienne copie lisible par ton navigateur n'a pas pu être effacée : je réessaie à la prochaine ouverture de cette carte." : '') }); return; }
    setMsg({ ton: 'attention', texte: code === 0 ? "Pas de réponse du serveur : je ne sais pas si ta clé a été rangée. Rouvre cet écran pour le voir." : (j.message || "La clé n'a pas pu être rangée — réessaie dans un moment.") });
  };
  const verifier = async () => {
    setOccupe('verifier'); setMsg(null);
    const { code, j } = await appelPhotoroom(enTeteSession(), { action: 'verifier' });
    setOccupe('');
    // (29 oct., revue) Photoroom muet : le serveur ne réécrit RIEN, la dernière
    // réponse connue reste (un refus reste un refus) — et on le dit.
    if (code === 200 && j.ok) { setS(j); if (j.sansReponse) setMsg({ ton: 'neutre', texte: phraseSansReponse(j) }); return; }
    if (code === 409 && j.erreur === 'changee') { await relire(); setMsg({ ton: 'attention', texte: j.message }); return; }
    setMsg({ ton: 'attention', texte: code === 0 ? "Pas de réponse du serveur — réessaie." : (j.message || "La vérification n'a pas abouti — réessaie.") });
  };
  const retirer = async () => {
    if (!(await askConfirm({ title: 'Retirer ta clé Photoroom ?', desc: "Elle est effacée du coffre de VRM. Plus aucune photo ne sera détourée avec ton compte Photoroom (la clé reste valable chez Photoroom : désactive-la là-bas si tu ne t'en sers plus).", ok: 'Retirer la clé', cancel: 'Annuler', danger: true }))) return;
    setOccupe('retirer'); setMsg(null);
    const { code, j } = await appelPhotoroom(enTeteSession(), { action: 'retirer', confirme: true });
    setOccupe('');
    if (code === 200 && j.ok) { setS(j); setRemplacer(false); setMsg({ ton: 'neutre', texte: 'Clé retirée de VRM.' }); return; }
    setMsg({ ton: 'attention', texte: code === 0 ? "Pas de réponse du serveur : ta clé est peut-être toujours rangée. Rouvre cet écran pour le voir." : (j.message || "La clé n'a pas pu être retirée — réessaie.") });
  };

  const etat = s === undefined ? 'chargement' : s === null ? 'pas-su' : s.etat;
  const posee = etat === 'posee' || etat === 'en-clair';
  const verif = posee ? phraseVerif(s) : null;
  const aRevoir = etat === 'illisible' || (verif && verif.ton === 'attention');
  const formulaire = s && s.coffre !== false && (etat === 'aucune' || etat === 'illisible' || remplacer);
  const ligneFine = { fontSize: 13, color: C.muted, lineHeight: 1.55 };
  // (14 nov., passe design 3) Les deux gestes du système : principal (l'aplat bleu) ou secondaire (capsule remplie) — plus un rectangle encadré.
  const bouton = (plein) => ({ border: 'none', background: plein ? C.accent : 'var(--d-remplir)', color: plein ? (C.onAccent || '#fff') : C.text, borderRadius: 999, padding: '0 16px', minHeight: 44, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' });
  const pastille = etat === 'chargement' ? null : (
    <span data-photoroom-pastille={aRevoir ? 'a-revoir' : posee ? 'rangee' : etat === 'pas-su' ? 'pas-su' : 'aucune'}
      style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, border: `1px solid ${aRevoir ? C.warn + '66' : C.border}`, color: aRevoir ? C.warn : posee ? C.text : C.muted, background: aRevoir ? `${C.warn}12` : 'transparent', whiteSpace: 'nowrap' }}>
      {aRevoir ? 'À revoir' : posee ? 'Rangée' : etat === 'pas-su' ? 'Pas lue' : 'Aucune clé'}
    </span>
  );
  const bloc = (titre, enfants, data) => (
    <div data-photoroom-bloc={data} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: '.01em', marginBottom: 4 }}>{titre}</div>
      <div style={ligneFine}>{enfants}</div>
    </div>
  );
  return (
    <section data-photoroom-cle={etat} aria-label="Ta clé Photoroom"
      style={cadre ? { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: 'grid', gap: 14 } : { display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${C.text}0d`, color: C.text, flex: '0 0 auto' }}><Icon name="image" size={20}/></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: '-.01em' }}>Ta clé Photoroom</span>
        </span>
        {pastille}
      </div>

      {etat === 'chargement' && <div style={ligneFine}>Lecture de ta clé…</div>}
      {etat === 'pas-su' && (
        <div data-photoroom-passu="" style={{ ...ligneFine, color: C.text }}>
          Je n'ai pas pu lire si une clé est rangée — la base n'a pas répondu. Rien n'est changé.
          <div style={{ marginTop: 8 }}><button type="button" data-photoroom-relire="" onClick={relire} style={bouton(false)}>Réessayer</button></div>
        </div>
      )}

      {posee && (
        <div data-photoroom-etat-cle="" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span data-photoroom-fin={s.fin || ''} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 15, letterSpacing: '.08em', color: C.text, background: `${C.text}0a`, border: `1px solid ${C.border}`, borderRadius: 12, padding: '6px 10px' }}>•••• {s.fin || '····'}</span>
            <span style={ligneFine}>{s.at ? `rangée le ${dateCourte(s.at)}` : 'rangée'}{etat === 'posee' ? ' · chiffrée sur le serveur' : ''}</span>
          </div>
          {etat === 'en-clair' && <div data-photoroom-en-clair={s.cause || 'pas-su'} style={{ ...ligneFine, color: C.warn }}>{s.cause === 'coffre-absent'
            ? "Elle sert, mais n'est pas encore chiffrée : le coffre du serveur n'est pas configuré."
            : s.cause === 'rangement-rate'
              ? "Elle sert, pas encore chiffrée : nouvel essai à la prochaine ouverture."
              : "Elle sert, mais n'est pas encore chiffrée dans le coffre du serveur."}</div>}
          {verif && <div data-photoroom-verif={s.verif} style={{ ...ligneFine, color: verif.ton === 'attention' ? C.warn : C.text }}>{verif.texte}</div>}
          {!remplacer && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {etat === 'posee' && <button type="button" data-photoroom-verifier="" disabled={!!occupe} onClick={verifier} style={bouton(false)}>{occupe === 'verifier' ? 'Vérification…' : 'Vérifier chez Photoroom'}</button>}
              {s.coffre !== false && <button type="button" data-photoroom-remplacer="" disabled={!!occupe} onClick={() => { setRemplacer(true); setMsg(null); }} style={bouton(false)}>Remplacer</button>}
              <button type="button" data-photoroom-retirer="" disabled={!!occupe} onClick={retirer} style={{ ...bouton(false), color: C.muted }}>{occupe === 'retirer' ? 'Retrait…' : 'Retirer'}</button>
            </div>
          )}
        </div>
      )}
      {etat === 'illisible' && <div data-photoroom-illisible="" style={{ ...ligneFine, color: C.warn }}>Ta clé ne se lit plus côté serveur (la clé du coffre a changé) : colle-la de nouveau.</div>}
      {s && s.coffre === false && !posee && <div data-photoroom-sans-coffre="" style={ligneFine}>Le coffre du serveur n'est pas configuré : aucune clé ne peut être rangée pour l'instant.</div>}

      {formulaire && (
        <form data-photoroom-form="" onSubmit={(e) => { e.preventDefault(); poser(); }} style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}><label htmlFor="vrm-photoroom-cle">{remplacer ? 'Colle ta nouvelle clé' : 'Colle ta clé API Photoroom'}</label>{' '}<Pourquoi titre="Ta clé Photoroom">VRM la vérifie chez Photoroom (sans dépenser d'image), puis la range chiffrée. Tu n'en reverras que les 4 derniers caractères.</Pourquoi></span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input id="vrm-photoroom-cle" data-photoroom-champ="" value={val} onChange={(e) => setVal(e.target.value)} type="password" autoComplete="off" spellCheck={false} autoCapitalize="off"
              placeholder="Ta clé Photoroom" aria-label="Clé API Photoroom"
              style={{ flex: '1 1 200px', minWidth: 0, minHeight: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 17, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}/>
            <button type="submit" data-photoroom-enregistrer="" disabled={!!occupe || !val.trim()} style={{ ...bouton(true), opacity: (occupe || !val.trim()) ? 0.55 : 1 }}>{occupe === 'poser' ? 'Vérification…' : 'Vérifier et ranger'}</button>
            {remplacer && <button className="vrm-b vrm-b-discret" type="button" onClick={() => { setRemplacer(false); setVal(''); }} style={bouton(false)}>Annuler</button>}
          </div>
        </form>
      )}

      {msg && <div data-photoroom-msg={msg.ton} role="status" style={{ ...ligneFine, color: msg.ton === 'attention' ? C.warn : C.text }}>{msg.texte}</div>}

      {/* (3 nov., critique #4) Coût, usages, où la trouver : derrière un repli, plus étalés sous la carte. */}
      <details className="vrm-repli vrm-photoroom-aide" data-photoroom-aide="">
      <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: C.text }}>Coût et aide</summary>
      <div className="vrm-photoroom-blocs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        {bloc('Ce que ça coûte', <>C'est <b style={{ color: C.text }}>ton</b> compte Photoroom qui paie, à la photo — jamais VRM, jamais un autre vendeur. Environ 0,02 $ la photo avec leur formule de base (relevé le 4 octobre). Une photo gardée par VRM n'est pas repayée. Clé « sandbox » : gratuite, avec filigrane.
          <a data-photoroom-tarifs="" href={LIEN_TARIFS} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', width: 'fit-content', minHeight: 44, color: C.text, fontWeight: 600, textDecoration: 'none' }}>Leurs tarifs ↗</a></>, 'cout')}
        {bloc('Où elle sert', <>
          <span style={{ display: 'block' }}>· <b style={{ color: C.text }}>Vestiaire Collective</b> : les photos que l'extension prépare pour ton annonce (fond net exigé).</span>
          <span style={{ display: 'block' }}>· <b style={{ color: C.text }}>Studio photo</b> (Annonces → Outils) : le bouton « Détourer avec Photoroom ».</span>
          <span style={{ display: 'block', marginTop: 4 }}>Leboncoin et eBay gardent tes photos d'origine.</span>
        </>, 'usages')}
        {bloc('Où la trouver', <>
          <span style={{ display: 'block' }}>1. Connecte-toi sur Photoroom.</span>
          <span style={{ display: 'block' }}>2. « API dashboard » → « API keys ».</span>
          <span style={{ display: 'block' }}>3. Copie la clé et colle-la ici.</span>
          <a data-photoroom-lien="" href={LIEN_CLE} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: C.accentTexte, fontWeight: 600, textDecoration: 'none' }}>Ouvrir Photoroom ↗</a>
        </>, 'trouver')}
      </div>
      </details>
    </section>
  );
}
// ⟦← App.jsx #7⟧
// L'ÉTAT D'UNE ANNONCE VESTIAIRE (1er nov.) — le mot que Vestiaire écrit, rangé
// dans une des familles qu'on sait dire. La forme n'a jamais été vue pleine : un
// mot qu'aucune famille ne reconnaît est recopié TEL QUEL (jamais deviné), aucun
// mot ⇒ « état non dit ». Une VENTE lue (`vc_ventes`, même identifiant
// d'article) prouve « vendue », quel que soit le mot.
// (1er nov.) Les familles (`VC_ANNONCE_ETATS`) et la règle (`etatAnnonceVcBrut`) vivent dans
// api/_lib/vestiaire-regle.js : la même pour l'app et le serveur (anti double vente).
function etatAnnonceVc(it, vendueParVente, capturedAt) {
  if (vendueParVente) return { etat: 'vendue', label: 'Vendue', brut: (it && it.statut) || '' };
  const brut = String((it && it.statut) || '').trim();
  const etatR = etatAnnonceVcBrut(it, false, capturedAt);
  // (1er nov., 5.299) UNE ANNONCE QUI N'EST PLUS DANS LES LECTURES n'est pas
  // « en ligne ». Une liste en plusieurs pages n'était jamais lue en entier :
  // une annonce vendue ou supprimée gardait son dernier mot (« on_sale ») et
  // passait pour en ligne sous une lecture fraîche. Plus vue depuis plus de 24 h
  // alors que la liste a été relue ⇒ « à confirmer » (rien n'est retiré).
  const vu = Date.parse((it && it.vuAt) || ''), lu = Date.parse(capturedAt || '');
  if (etatR === 'a-confirmer' && isFinite(vu) && isFinite(lu)) {
    return { etat: 'a-confirmer', label: `Plus vue sur Vestiaire depuis ${ageCourtVc(it.vuAt).replace(/^il y a /, '')} — à confirmer`, brut };
  }
  if (etatR === 'pas-dit') return { etat: 'pas-dit', label: 'État non dit par Vestiaire', brut: '' };
  const f = VC_ANNONCE_ETATS.find(([k]) => k === etatR);
  return f ? { etat: f[0], label: f[2], brut } : { etat: 'autre', label: `Vestiaire : « ${brut} »`, brut };
}
// ⟦← App.jsx #8⟧
// (11 nov.) La vignette d'une ligne de baisse : la photo Vestiaire entière, à la taille de la case.
const PhotoBaisseVc = ({ src, className }) => <span className={className}><PhotoVc src={src} style={{ width: '100%', height: '100%' }}/></span>;
function AnnoncesVestiaire() {
  const [d, setD] = useState(undefined);   // undefined en cours · null pas su · objet
  const [recettePrix, setRecettePrix] = useState(undefined);
  const [baisseOuverte, setBaisseOuverte] = useState(false);
  const vcOuvert = useCompteVcOuvert();
  // (2 nov., soir) Un N° par annonce, comme Vinted et Leboncoin (src/numerosVestiaire.js).
  const vcLoc = useVcLocal();
  useNumerotationVestiaire();
  const relire = React.useCallback(async () => {
    const [rl, rv, rp] = await Promise.all([
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens,capturedAt:data->>capturedAt,complet:data->complet,total:data->total,inconnu:data->formeInconnue`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_ventes&select=ventes:data->ventes`),
      // (11 nov., 5.364) Baisser un prix : la recette APPRISE de son propre geste sur Vestiaire (jamais devinée).
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_prix_recette&select=appris:data->appris,raison:data->>raison,at:data->>at`),
    ]);
    setRecettePrix(Array.isArray(rp) ? (rp[0] ? { appris: rp[0].appris === true ? true : rp[0].appris === false ? false : null, raison: rp[0].raison || '' } : {}) : null);
    if (!Array.isArray(rl)) { setD(null); return; }
    const r = rl[0] || {};
    // Les ventes ne servent qu'à PROUVER « vendue » ; illisibles ⇒ on n'en tire rien.
    const vendus = new Set();
    if (Array.isArray(rv) && rv[0] && rv[0].ventes && typeof rv[0].ventes === 'object') for (const v of Object.values(rv[0].ventes)) if (v && v.productId) vendus.add(String(v.productId));
    setD({ items: r.items && typeof r.items === 'object' ? r.items : null, liens: (r.liens && typeof r.liens === 'object') ? r.liens : {}, capturedAt: r.capturedAt || '', complet: r.complet === true, total: typeof r.total === 'number' ? r.total : null, vendus, ventesKO: !Array.isArray(rv), inconnu: Array.isArray(r.inconnu) && r.inconnu.length > 0 });
  }, []);
  useEffect(() => { relire(); }, [relire]);
  useEffect(() => {
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && x.quoi === 'vestiaire') relire(); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, [relire]);
  const style = { fontSize: 13, color: C.muted, lineHeight: 1.55 };
  const geste = <>ouvre <b style={{ color: C.text }}>« Mes articles »</b> sur Vestiaire, avec l'extension</>;
  let corps;
  if (d === undefined) corps = <div data-vc-annonces="charge" style={style}>Lecture de tes annonces Vestiaire…</div>;
  else if (d === null) corps = <div data-vc-annonces="pas-su" style={style}>Je n'ai pas pu lire tes annonces Vestiaire (rien perdu). <button type="button" className="vrm-lien-action" data-vc-annonces-relire="" onClick={() => { setD(undefined); relire(); }} style={{ background: 'none', border: 'none', color: C.accentTexte, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, padding: 0 }}>Réessayer</button></div>;
  // (5.299) Vestiaire a répondu, mais dans une forme que l'extension ne sait pas encore lire : on le DIT (jamais « aucune annonce »).
  else if (d.inconnu && !(d.items && Object.keys(d.items).length)) corps = <div data-vc-annonces="format" style={style}>Réponse de Vestiaire illisible pour l'instant : <b style={{ color: C.text }}>aucune annonce n'est devinée</b>.</div>;
  else if (!d.items || !d.capturedAt) corps = <div data-vc-annonces="jamais" style={style}>Tes annonces Vestiaire n'ont pas encore été lues : {geste}{extSait('vcfiche') === 'retard' ? <> — mise à jour en <b>{EXT_CAPACITES.vcfiche}</b> d'abord</> : ''}.</div>;
  else {
    const liste = Object.entries(d.items).filter(([, it]) => it && typeof it === 'object').map(([id, it]) => {
      const num = numVcAnnonce(id, it, d.liens, vcLoc.auto);
      return { id, it, num, ...etatAnnonceVc(it, d.vendus.has(String(id)), d.capturedAt) };
    });
    const ordre = { 'en-ligne': 0, attente: 1, autre: 2, 'pas-dit': 3, 'a-confirmer': 4, vendue: 5, retiree: 6 };
    liste.sort((a, z) => (ordre[a.etat] - ordre[z.etat]) || (z.num ? 1 : 0) - (a.num ? 1 : 0) || String(a.num || '').localeCompare(String(z.num || ''), 'fr', { numeric: true }));
    const age = Date.now() - Date.parse(d.capturedAt);
    const vieille = !(age <= 24 * 3600e3);
    const sansFiche = liste.length > 0 && liste.every(({ it }) => !it.titre && !it.photo && !it.prix && !it.statut);
    const n = liste.length;
    if (!n) corps = <div data-vc-annonces="vide" style={style}>Aucune annonce Vestiaire à la dernière lecture ({ageCourtVc(d.capturedAt)}). Tu viens d'en publier ? {geste}.</div>;
    else corps = (
      <div data-vc-annonces="lu" data-vc-annonces-n={n} data-vc-annonces-vieille={vieille ? '1' : '0'}>
        {/* (9 nov., lot AI) UNE ligne courte (« au moins 3 annonces · lu il y a 7 j · à confirmer »),
            ambre si la lecture est à refaire ; la phrase d'avant, entière, dans la pop-up. */}
        <InfoPop nom="vc-fraicheur" titre="Tes annonces Vestiaire" ton={vieille || sansFiche ? 'ambre' : 'neutre'}
          attrs={{ 'data-vc-annonces-fraicheur': '' }}
          puces={[{ texte: `${d.complet ? '' : 'Au moins '}${n} annonce${n > 1 ? 's' : ''}` }, { texte: `Lu ${ageCourtVc(d.capturedAt)}` }, vieille ? { texte: 'À confirmer', ton: 'ambre' } : null, sansFiche ? { texte: 'Fiches à venir', ton: 'ambre' } : null].filter(Boolean)}
          phrase={vieille ? 'Ouvre « Mes articles » sur Vestiaire pour les relire.' : sansFiche ? 'Mets l’extension à jour pour voir photo, titre et prix.' : `${n} annonce${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''} sur Vestiaire.`}>
          <p data-vc-annonces-fraicheur-detail="" style={{ margin: 0 }}>
          {n} annonce{n > 1 ? 's' : ''}{d.complet ? '' : d.total != null ? ` (au moins — Vestiaire en annonce ${d.total})` : ' (au moins)'}, lue{n > 1 ? 's' : ''} sur Vestiaire {ageCourtVc(d.capturedAt)}.
          {vieille ? <> <b style={{ color: C.warn }}>À confirmer</b> : la lecture a plus de 24 h — {geste} pour la remettre à jour (rien n'est retiré d'ici).</> : null}
          {sansFiche ? <> Photo, titre et prix arrivent avec l'extension {EXT_CAPACITES.vcfiche}{extSait('vcfiche') === 'ok' ? <> : {geste} une fois</> : <> — mets-la à jour depuis Paramètres → État des connexions, puis {geste}</>}.</> : null}
          </p>
        </InfoPop>
        {/* (11 nov., lot vestiaire-plus) Baisser le prix en série, sur SON clic (ext. 5.364) : la feuille dit
            d'abord si le geste est appris de son propre changement de prix sur Vestiaire. */}
        {liste.some((l) => l.etat === 'en-ligne') ? <div style={{ margin: '8px 0' }}><Bouton variante="secondaire" icone="tag" data-vc-baisse-ouvrir="" onClick={() => setBaisseOuverte(true)}>{tr('vcBaisse.ouvrir')}</Bouton></div> : null}
        {baisseOuverte ? <BaissePrixVestiaire annonces={liste.filter((l) => l.etat === 'en-ligne').map(({ id, it, num }) => ({ id, it, num, compte: it.compte || '', titre: it.titre || '', photo: it.photo || '' }))}
          compteOnglet={vcOuvert || null} recette={recettePrix} cap={extSait('vcprix')} Photo={PhotoBaisseVc} Retour={FermeAuRetour}
          onBaisser={async (l) => { const r = await vmrCmd({ cmd: 'vcPrix', produit: String(l.id), avantCents: l.avant, apresCents: l.apres }, 60000); return r || { sansReponse: true }; }}
          onFermer={() => { setBaisseOuverte(false); relire(); }}/> : null}
        {/* (2 nov., soir) « c'est beaucoup zoomé sur le produit » : la photo ENTIÈRE
            (contenue sur fond blanc, `vrm-vc-catalog`), aux proportions des fiches. */}
        <section className="vrm-lbc-catalog vrm-vc-catalog" aria-label="Mes annonces Vestiaire" style={{ margin: 0 }}>
          {/* (11 nov.) Regroupées par compte quand un compte Vestiaire est ouvert (src/regroupeComptes.js, suit le flou). */}
          <ul><ListeParCompte enLi unite="annonce" libelle="Compte ouvert sur Vestiaire" lignes={liste} ouvert={vcOuvert} floute={(l) => vcFloute(vcOuvert, l.it.compte)} compteDe={(l) => String(l.it.compte == null ? '' : l.it.compte).trim()} nomDe={(id) => nomCompteVente('vestiaire', { compte: id }, {})} rendre={({ id, it, num, etat, label, brut }) => {
            const flou = vcFloute(vcOuvert, it.compte);
            const prix = it.prix && isFinite(Number(it.prix.valeur)) ? (it.prix.devise && it.prix.devise !== 'EUR' ? `${Number(it.prix.valeur).toFixed(2).replace('.', ',')} ${it.prix.devise}` : fmt(it.prix.valeur)) : '—';
            const extra = [it.boost === true ? 'boostée' : '', typeof it.favoris === 'number' ? `${it.favoris} favori${it.favoris > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
            return (
              <li key={id} data-vc-annonce={id} data-vc-annonce-num={num || ''} data-vc-annonce-etat={etat} data-flou={flou ? '1' : '0'} style={flou ? STYLE_FLOU : undefined}>
                <PhotoVc src={it.photo}/>
                <div className="vrm-lbc-catalog-info">
                  <strong>{it.titre || (num ? `N°${num}` : 'Annonce sans titre lu')}</strong>
                  <small>{num ? <span data-vc-annonce-numtxt="">N°{num}</span> : etat === 'retiree' ? 'Sans N° (retirée)' : 'N° en attente'}{extra ? ` · ${extra}` : ''}</small>
                  <div><span data-etat={etat === 'en-ligne' ? 'active' : etat === 'vendue' ? 'vendue' : 'autre'} title={brut ? 'État lu sur Vestiaire' : undefined}>{label}</span></div>
                  {/* (3 nov.) Un seul N° pour l'article aussi en ligne sur Vinted : SON toucher relie. */}
                  {lienDe(vcLoc.liens, id)
                    ? <button type="button" className="vrm-lvc-geste" data-vc-delier={id} onClick={() => defaireVc(id)}>Délier Vinted</button>
                    : etat !== 'retiree' && etat !== 'vendue' && vcReliable({ productId: id, item: it, liensPub: d.liens, liens: vcLoc.liens, cleNum })
                      ? <button type="button" className="vrm-lvc-geste" data-vc-relier={id} onClick={() => { try { window.dispatchEvent(new CustomEvent('vrm:lien-vc', { detail: { sens: 'vc', id, num: num || '', titre: it.titre || '', photo: it.photo || '', site: 'Vestiaire' } })); } catch (_) {} }}>Relier à Vinted</button>
                      : null}
                </div>
                <b data-vc-annonce-prix={it.prix ? String(it.prix.valeur) : ''} title={it.prix && it.prix.cle ? 'Prix lu sur Vestiaire' : undefined}>{prix}</b>
              </li>
            );
          }}/></ul>
        </section>
        {/* (2 nov., soir) Chaque annonce reçoit un N° (comme Vinted et Leboncoin) : celui de
            la paire publiée depuis VRM ou de sa référence VRM-n°, sinon un N° neuf — par
            l'identifiant Vestiaire du produit, jamais par le titre. */}
        {liste.some((l) => !l.num && l.etat !== 'retiree') ? <div data-vc-annonces-attente="" style={{ ...style, marginTop: 8 }}>« N° en attente » : il arrive dans quelques secondes (connexion nécessaire).</div> : null}
        <div style={{ marginTop: 12 }}><BlocBarrerVc titres={Object.fromEntries(Object.entries(d.items).map(([k, v]) => [k, (v && v.titre) || '']))}/></div>
        {d.ventesKO ? <div style={{ ...style, marginTop: 4 }}>Ventes Vestiaire pas relues : « vendue » seulement si l'annonce le dit.</div> : null}
      </div>
    );
  }
  return (
    <Card style={{ padding: 16, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Tes annonces Vestiaire</div>
      {corps}
    </Card>
  );
}
// ⟦← App.jsx #9⟧
function PublierVestiaire({ comptes }) {
  const { paires, enLigne } = useEbayPaires(comptes);
  // (28 oct.) La photo de l'ÉTIQUETTE, choisie par lui : Vestiaire la veut en
  // 2ᵉ (case « Étiquette » du smart listing). `vrm_vc_etiquettes[id]` = la clé
  // de la photo (`clePhotoLbc`, la même règle que l'extension, §11).
  const [etiquettes, setEtiquettes] = useStateCle('vrm_vc_etiquettes', () => load('vrm_vc_etiquettes', {}) || {});
  React.useEffect(() => onCloudReady(() => setEtiquettes((v) => (v && Object.keys(v).length) ? v : (load('vrm_vc_etiquettes', {}) || {}))), []);
  const [choixEtiq, setChoixEtiq] = React.useState('');
  const poserEtiquette = (id, cle) => {
    setEtiquettes((prev) => { const u = { ...(load('vrm_vc_etiquettes', {}) || {}), ...(prev || {}) }; if (cle) u[String(id)] = cle; else delete u[String(id)]; save('vrm_vc_etiquettes', u); return u; });
    setChoixEtiq('');
  };
  // (11 nov., lot vestiaire-plus) La clé Photoroom (détourage, Vestiaire seul) : true utilisable · false aucune · null pas su.
  const [photoroom, setPhotoroom] = React.useState(null);
  React.useEffect(() => { let vivant = true; if (MULTI_USER && AUTH.user?.id) lirePhotoroom(enTeteSession()).then((x) => { if (vivant) setPhotoroom(x ? cleUtilisable(x) : null); }); return () => { vivant = false; }; }, []);
  const etatEtiquette = (p) => { const ph = (p.photos || []).filter((u) => clePhotoLbc(u)); const k = etiquettes[String(p.id)] || ''; return k ? (ph.some((u) => clePhotoLbc(u) === k) ? 'choisie' : 'introuvable') : 'pas-choisie'; };
  const photosDe = (p) => ({ famille: familleArticle({ titre: p.title, taille: p.taille, marque: p.marque }).famille, nPhotos: (p.photos || []).length, etiquette: etatEtiquette(p), photoroom });
  const { jobs } = useExtVivante();
  const sansSouris = useSansSouris();
  const [publiees, setPubliees] = React.useState(undefined);   // undefined en cours · null pas su · Set
  const [msg, setMsg] = React.useState({});
  const [envoi, setEnvoi] = React.useState('');
  const [tout, setTout] = React.useState(false);
  const relire = React.useCallback(async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vinted_vc_posted&select=ids:data->ids`, { headers: sbAuth() });
      if (!r.ok) throw new Error('lecture');
      const rows = await r.json();
      setPubliees(new Set(((rows && rows[0] && rows[0].ids) || []).map(String)));
    } catch (_) { setPubliees(null); }
  }, []);
  // 5.236 : tes annonces Vestiaire telles que l'extension les a lues, et leur
  // BOOST (`vc_listings`). Trois états : undefined en cours · null pas su · objet.
  const [vcAnn, setVcAnn] = React.useState(undefined);
  const vcLoc = useVcLocal();
  const relireAnn = React.useCallback(async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens,capturedAt:data->>capturedAt,complet:data->complet,total:data->total`, { headers: sbAuth() });
      if (!r.ok) throw new Error('lecture');
      const rows = await r.json();
      setVcAnn(Array.isArray(rows) ? (rows[0] || {}) : null);
    } catch (_) { setVcAnn(null); }
  }, []);
  React.useEffect(() => { relire(); relireAnn(); }, [relire, relireAnn]);
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && d.quoi === 'vestiaire') { relire(); relireAnn(); } };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, [relire]);
  const glob = raisonExtGlobale(sansSouris, { cap: 'vcpublier', role: 'prépare tes annonces Vestiaire' });
  // 5.236 : une extension qui sait publier sans booster le fait ; plus ancienne,
  // elle prépare seulement (et on le dit, jamais une promesse qu'elle ne tient pas).
  const auto = extSait('vcauto') === 'ok';
  // Le boost d'une paire : par IDENTITÉ seulement — le lien posé à la création
  // (id Vestiaire → N°) ou la référence VRM-{n°} lue dans l'annonce (§5).
  const boostParNum = React.useMemo(() => {
    const m = new Map();
    if (!vcAnn || !vcAnn.items) return m;
    const liens = vcAnn.liens || {};
    for (const [id, it] of Object.entries(vcAnn.items)) {
      const n = numVcAnnonce(id, it, liens, vcLoc.auto);
      if (!n) continue;
      const prev = m.get(n);
      const b = it && (it.boost === true || it.boost === false) ? it.boost : null;
      m.set(n, prev === true ? true : (b === true ? true : (prev === false || b === false ? (b === null && prev == null ? null : false) : null)));
    }
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vcAnn, JSON.stringify(vcLoc.auto)]);
  const resumeBoost = (() => {
    if (vcAnn === undefined) return null;
    if (vcAnn === null) return null;   // (1er nov.) dit par « Tes annonces Vestiaire » au-dessus
    const items = vcAnn.items ? Object.values(vcAnn.items) : null;
    // (1er nov.) Le NOMBRE d'annonces, leur fraîcheur et « jamais lues » sont dits
    // une fois, par la carte « Tes annonces Vestiaire » au-dessus (§7 : le même
    // nombre ne s'écrit pas deux fois sur un écran) ; ici, le boost seul.
    if (!items || !vcAnn.capturedAt) return null;
    const n = items.length, b = items.filter((x) => x && x.boost === true).length, inc = items.filter((x) => !x || x.boost == null).length;
    if (!n) return null;
    const nums = [...boostParNum.entries()].filter(([, v]) => v === true).map(([k]) => 'N°' + k).sort((a, z) => a.localeCompare(z, 'fr', { numeric: true }));
    const sansN = b - items.filter((x, i) => x && x.boost === true && numVcAnnonce(Object.keys(vcAnn.items)[i], x, vcAnn.liens || {}, vcLoc.auto)).length;

    return { code: 'lu', b, texte: `Boost : ${b ? `${b} boostée${b > 1 ? 's' : ''}` : 'aucune boostée'}${nums.length ? ` (${nums.join(', ')}${sansN > 0 ? ` et ${sansN} pas reliée${sansN > 1 ? 's' : ''} à un article` : ''})` : ''}${inc ? ` · ${inc} dont Vestiaire ne dit pas le boost` : ''}` };
  })();
  // 5.295 — LES FAVORIS VESTIAIRE : combien de personnes ont mis chaque annonce
  // en favori (un NOMBRE lu par l'extension, jamais qui). Par identité seulement
  // (lien posé à la création ou référence VRM). Une capture d'avant la 5.295 ne
  // porte pas le champ : on ne dit rien ; `null` = Vestiaire ne le dit pas.
  const resumeFavoris = (() => {
    if (!vcAnn || !vcAnn.items) return null;
    const items = Object.entries(vcAnn.items).filter(([, it]) => it && Object.prototype.hasOwnProperty.call(it, 'favoris'));
    if (!items.length) return null;
    const liens = vcAnn.liens || {};
    const sus = items.filter(([, it]) => typeof it.favoris === 'number');
    const inc = items.length - sus.length;
    if (!sus.length) return { code: 'pas-dit', texte: 'Favoris : pas lus' };
    const total = sus.reduce((t, [, it]) => t + it.favoris, 0);
    const parN = sus.filter(([, it]) => it.favoris > 0).map(([id, it]) => [numVcAnnonce(id, it, liens, vcLoc.auto), it.favoris]).filter(([n]) => n).sort((a, z) => z[1] - a[1]);
    return { code: 'lu', total, texte: `${total} favori${total > 1 ? 's' : ''} sur ${sus.length} annonce${sus.length > 1 ? 's' : ''}${parN.length ? ` (${parN.slice(0, 8).map(([n, f]) => `N°${n} · ${f}`).join(', ')})` : ''}${inc ? ` · ${inc} dont Vestiaire ne dit pas le nombre` : ''}` };
  })();
  const liste = (paires || []).filter((p) => !(publiees && publiees.has(String(p.id))));
  const visibles = tout ? liste : liste.slice(0, 12);
  // (5 nov.) Venu de « Publier ailleurs » : la ligne de CET article à l'écran, mise en évidence.
  React.useEffect(() => {
    const d = DEMANDE_VC_PAIRE;
    if (!d.id || Date.now() - d.at > 60000 || !Array.isArray(paires) || !paires.length) return undefined;
    const id = String(d.id); d.id = null;
    if (!paires.some((p) => String(p.id) === id)) return undefined;
    setTout(true);
    const t = setTimeout(() => { try { const el = document.querySelector(`[data-vc-paire="${CSS.escape(id)}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('vrm-cc-cible'); el.setAttribute('data-vc-demande', ''); setTimeout(() => el.classList.remove('vrm-cc-cible'), 2400); } } catch (_) {} }, 150);
    return () => clearTimeout(t);
  }, [paires]);
  const preparer = async (p) => {
    if (envoi) return;
    if (glob) { setMsg((m) => ({ ...m, [p.id]: glob.texte })); return; }
    // (3 nov.) Vérifier avant de publier (`src/verifAnnonce.js`) ; la catégorie se choisit sur Vestiaire.
    let achatV = null;
    try { achatV = prixAchatDe((load('vinted_annonce_numeros', {}) || {})[String(p.id)], load('vinted_buyprice_by_num', {}) || {}); } catch (_) { achatV = null; }
    // (11 nov., lot vestiaire-plus) Les photos que Vestiaire demande : ce que VRM SAIT manquer est dit AVANT (src/photosVestiaire.js).
    { const rp = photosExigeesVc(photosDe(p));
      if (rp.manque.length && !(await askConfirm({ title: tr('vcPhotos.confirme.titre', { n: rp.manque.length }), desc: textePhotosManquantes(rp), ok: tr('vcPhotos.confirme.ok'), cancel: tr('vcPhotos.confirme.annuler') }))) return; }
    if (!(await verifierAvantPublication(problemesAnnonce({ titre: p.title || '', taille: p.taille || '', famille: familleArticle({ titre: p.title, taille: p.taille, marque: p.marque }).famille, marque: p.marque || '', nPhotos: (p.photos || []).length, prix: p.prix, achat: achatV , facultatifs: champsFacultatifs(vendActuel()),
      // (11 nov.) Le N° écrit : jugé seulement si la description qui partira est sue.
      numero: p.num || '', ...(typeof p.description === 'string' ? { description: p.description } : {}), ...optsNumeroVerif() }, 'vestiaire'), { site: 'vestiaire' }))) return;
    setEnvoi(p.id); setMsg((m) => ({ ...m, [p.id]: '' }));
    const t0 = Date.now();
    const r = await vmrCmd({ cmd: 'vcPreparer', id: String(p.id), publier: auto }, 30000);
    setEnvoi('');
    if (!r) { setMsg((m) => ({ ...m, [p.id]: "L'extension n'a pas répondu — recharge cette page et réessaie." })); return; }
    if (!r.accepte) { setMsg((m) => ({ ...m, [p.id]: r.raison || "Refusé par l'extension." })); return; }
    __vmrJobs[r.jobId] = { etape: r.etape, at: Date.now() }; __vmrNotifier();
    // (11 nov., lot suivi-travail) La feuille « VRM travaille » : « publiée » seulement si l'extension le dit.
    const id = String(p.id);
    const t = suivi.demarrer({ sorte: auto ? 'publier-vc' : 'preparer-vc', titre: auto ? 'Publier sur Vestiaire' : 'Préparer sur Vestiaire', articles: [{ id, num: p.num || '', titre: p.title || '' }],
      etapes: auto ? [['depot', 'Formulaire Vestiaire ouvert'], ['accepte', 'Publiée sur Vestiaire ✓']] : [['depot', 'Formulaire Vestiaire ouvert et rempli']] });
    if (!t) return;
    t.etape(id, 'depot');
    if (!auto) { t.fin(id, { etat: 'main', raison: 'formulaire ouvert et rempli par l’extension', geste: 'Relis et publie sur Vestiaire' }); t.terminer(''); return; }
    suivreJob(t, id, { jobId: r.jobId || 'vc:' + id, lireJobs: () => __vmrJobs, depuis: t0, delaiMs: 15 * 60000 }).then(({ fin }) => {
      if (fin === 'fait') { t.etape(id, 'accepte'); t.fin(id, { etat: 'ok' }); }
      else t.fin(id, { etat: 'main', raison: fin === 'abandonne' ? 'VRM n’a pas vu la fin de la publication' : fin === 'arret' ? 'la publication continue dans l’onglet Vestiaire' : 'VRM n’a pas vu la fin en 15 min', geste: 'Regarde l’onglet Vestiaire ; si elle est en ligne, clique « Déjà publiée »' });
      t.terminer('');
    });
  };
  const marquer = async (p) => {
    if (envoi) return;
    const ok = await askConfirm({ title: `N°${p.num} déjà publiée sur Vestiaire ?`, desc: "Elle sort de cette liste. Rien n'est envoyé à Vestiaire.", ok: 'Oui, elle est en ligne', cancel: 'Annuler' });
    if (!ok) return;
    setEnvoi(p.id);
    const r = await vmrCmd({ cmd: 'vcMarque', id: String(p.id), etat: 'posted' }, 15000);
    setEnvoi('');
    if (!r || !r.accepte) { setMsg((m) => ({ ...m, [p.id]: (r && r.raison) || "L'extension n'a pas répondu — rien n'est noté." })); return; }
    relire();
  };
  const btn = (accent) => ({ display: 'inline-flex', alignItems: 'center', minHeight: 36, borderRadius: 12, fontFamily: 'inherit', fontWeight: 600, fontSize: 13, padding: '7px 11px', cursor: 'pointer',
    border: `1px solid ${accent && !glob ? C.accent : C.border}`, background: accent && !glob ? `${C.accent}14` : 'transparent', color: accent && !glob ? C.accent : C.muted });
  let corps;
  if (enLigne === undefined || publiees === undefined) corps = <div data-vc-publier="charge" style={{ fontSize: 13, color: C.muted }}>Lecture de tes articles en ligne…</div>;
  else if (enLigne === null) corps = <div data-vc-publier="pas-su" style={{ fontSize: 13, color: C.muted }}>Je n'ai pas pu lire tes annonces Vinted — rien n'est perdu, réessaie dans un moment.</div>;
  else if (!liste.length) corps = <div data-vc-publier="vide" style={{ fontSize: 13, color: C.muted }}>{paires.length ? 'Tout est publié' : 'Aucun article numéroté'}</div>;
  else corps = (
    <div data-vc-publier="lu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {publiees === null && <div style={{ fontSize: 12, color: C.muted }}>Déjà publiées ? Pas lu : l'extension revérifie au clic.</div>}
      {visibles.map((p) => {
        const job = jobs['vc:' + p.id] || null;
        const ouvert = job && job.etape === 'depot' && (Date.now() - Number(job.at || 0) < 30 * 60000);
        return (
          <div key={p.id} data-vc-paire={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8, flexWrap: 'wrap' }}>
            {p.cover ? <PhotoVinted src={p.cover} alt="" loading="lazy" style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}/> : null}
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>N°{p.num} · {p.title || '—'}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{p.prix != null ? fmt(p.prix) : 'prix —'}{p.photos && p.photos.length ? ` · ${p.photos.length} photo${p.photos.length > 1 ? 's' : ''}` : ''}{job && job.etape === 'fait' ? ' · publiée sur Vestiaire' : ''}</div>
              {boostParNum.has(cleNum(p.num)) ? <div data-vc-boost={String(boostParNum.get(cleNum(p.num)))} style={{ fontSize: 12, color: C.muted }}>Déjà sur Vestiaire{boostParNum.get(cleNum(p.num)) === true ? ' · boostée' : boostParNum.get(cleNum(p.num)) === false ? ' · pas boostée' : ''}</div> : null}
              {(() => {
                const ph = (p.photos || []).filter((u) => clePhotoLbc(u));
                const k = etiquettes[String(p.id)] || '';
                const i = k ? ph.findIndex((u) => clePhotoLbc(u) === k) : -1;
                if (ph.length < 2) return null;
                return (
                  <div data-vc-etiq={k ? (i >= 0 ? 'choisie' : 'introuvable') : 'pas-choisie'} style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {i >= 0 ? <><PhotoVinted src={ph[i]} alt="" style={{ width: 22, height: 28, objectFit: 'cover', borderRadius: 4 }}/>Étiquette : photo {i + 1}</> : k ? 'Étiquette : la photo choisie n\'est plus là' : 'Étiquette : pas choisie'}
                    <button type="button" className="vrm-lien-action" data-vc-etiq-ouvrir={p.id} onClick={() => setChoixEtiq(choixEtiq === p.id ? '' : p.id)} style={{ background: 'none', border: 'none', color: C.accentTexte, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>{i >= 0 ? 'changer' : 'choisir'}</button>
                  </div>
                );
              })()}
              <PhotosVestiaire id={p.id} {...photosDe(p)} onEtiquette={(p.photos || []).filter((u) => clePhotoLbc(u)).length >= 2 ? () => setChoixEtiq(p.id) : null}/>
              {choixEtiq === p.id ? (
                <div data-vc-etiq-choix={p.id} style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Touche la photo de l'étiquette (2ᵉ sur Vestiaire).</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(p.photos || []).filter((u) => clePhotoLbc(u)).map((u, j) => {
                      const c = clePhotoLbc(u); const on = etiquettes[String(p.id)] === c;
                      return <button key={c} type="button" data-vc-etiq-photo={j + 1} aria-label={`Photo ${j + 1} : c'est l'étiquette`} aria-pressed={on ? 'true' : 'false'} onClick={() => poserEtiquette(p.id, c)} style={{ padding: 0, border: `2px solid ${on ? C.accent : C.border}`, borderRadius: 6, background: 'transparent', cursor: 'pointer', width: 48, height: 60, overflow: 'hidden' }}><PhotoVinted src={u} alt={`photo ${j + 1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/></button>;
                    })}
                    {etiquettes[String(p.id)] ? <button type="button" data-vc-etiq-retirer={p.id} onClick={() => poserEtiquette(p.id, '')} style={btn(false)}>Aucune</button> : null}
                  </div>
                </div>
              ) : null}
              {msg[p.id] ? <div data-vc-refus="" style={{ fontSize: 11, color: C.warn, marginTop: 2 }}>{msg[p.id]}</div> : null}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" data-vc-preparer={p.id} aria-disabled={glob ? 'true' : undefined} title={glob ? glob.texte : auto ? "L'extension ouvre Vestiaire, remplit, attache les photos et publie SANS booster dès que tout est rempli" : "L'extension ouvre Vestiaire et remplit ce qu'elle reconnaît — tu relis et tu publies"} onClick={() => preparer(p)} style={btn(true)}>
                {envoi === p.id ? 'Envoi…' : ouvert ? 'Ouvert sur Vestiaire' : auto ? 'Publier sur Vestiaire' : 'Préparer sur Vestiaire'}
              </button>
              <button type="button" data-vc-marquer={p.id} onClick={() => marquer(p)} style={btn(false)}>Déjà publiée</button>
            </div>
          </div>
        );
      })}
      {liste.length > 12 && !tout && <button type="button" className="vrm-lien-action" onClick={() => setTout(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: C.accentTexte, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Voir les {liste.length} articles</button>}
    </div>
  );
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Mettre en vente</div>
      {/* (3 nov., critique #4) Plus de paragraphe « L'extension ouvre Vestiaire… » : le bouton le dit en infobulle. */}
      <div data-vc-auto={auto ? 'oui' : 'non'} style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
        {glob ? <div data-vc-raison={glob.code} style={{ color: C.warn, marginTop: 6 }}>{glob.texte}</div> : null}
        {resumeBoost ? <div data-vc-boost-resume={resumeBoost.code} style={{ marginTop: 6 }}>{resumeBoost.texte}</div> : null}
        {resumeFavoris ? <div data-vc-favoris-resume={resumeFavoris.code} data-vc-favoris-total={resumeFavoris.total == null ? undefined : String(resumeFavoris.total)} style={{ marginTop: 6 }}>{resumeFavoris.texte}</div> : null}
      </div>
      {corps}
    </Card>
  );
}
// ⟦← App.jsx #10⟧
function etapeVenteVc(v, depart = null) {
  // (8 nov.) Encore « à expédier » chez Vestiaire (pas relu), mais le n° de suivi
  // EXACT est pris en charge chez le transporteur : partie, la raison dite.
  if (v && v.aExpedier === true && depart) return { etape: 'en-route', label: `Envoyée — ${depart.phrase}`, rang: 1, departLu: depart };
  if (v && v.aExpedier === true) return { etape: 'a-expedier', label: 'À envoyer', rang: 0 };
  const brut = String((v && v.etat) || '').trim();
  const f = brut ? VC_VENTE_ETAPES.find(([, re]) => re.test(brut)) : null;
  if (f) { const rang = { 'en-route': 1, controle: 1, livree: 2, terminee: 3, versee: 3 }[f[0]]; return { etape: f[0], label: f[2], rang: rang == null ? null : rang }; }
  if (v && v.plusAExpedierDepuis) return { etape: 'plus-a-expedier', label: 'Plus dans « à expédier » (envoyée ou annulée — Vestiaire ne dit pas laquelle)', rang: null };
  return { etape: brut ? 'autre' : 'pas-dit', label: brut ? `Vestiaire : « ${brut} »` : 'Étape non dite par Vestiaire', rang: null };
}
// ⟦← App.jsx #11⟧
// Le prix d'achat d'une vente Vestiaire : celui SAISI pour son N°
// (`vinted_buyprice_by_num`, la source de Vinted et Leboncoin, §11) — seulement
// si au plus UNE fiche porte ce N° (deux fiches ⇒ coût ambigu, rien).
const achatVc = (num) => {
  if (!num) return null;
  try {
    const fiches = load('vinted_annonce_numeros', {}) || {};
    if (Object.values(fiches).filter((f) => f && f.numero != null && cleNum(f.numero) === num).length > 1) return null;
    const f = ficheUniqueDuNumero(fiches, num);
    return prixAchatDe(f || { numero: num }, load('vinted_buyprice_by_num', {}) || {});
  } catch (_) { return null; }
};
const poserAchatVc = (num, p) => {
  if (!num) return;
  const u = { ...(load('vinted_buyprice_by_num', {}) || {}), [num]: String(p) };
  save('vinted_buyprice_by_num', u);
  // L'écran Ventes Vinted tient la carte dans son état : il la relit.
  setTimeout(() => emettreClesRelues(['vinted_buyprice_by_num']), 650);
  signalerVc();
};
// Les colonnes Achat · Bénéfice de la ligne : ce que Vestiaire verse (commission
// déjà retirée) − le prix d'achat. Un des deux manque ⇒ « — » (jamais 0, §5).
function beneficeVc(v, fait) {
  const verse = montantRecuVc(v).eur;
  const annulee = vcVenteAnnulee(v);
  const achat = achatVc(v.num);
  if (annulee) return { etat: 'annulee', achat, benefice: null, verse };
  if (verse == null) return { etat: 'prix', achat, benefice: null, verse };
  if (achat == null) return { etat: 'achat', achat: null, benefice: null, verse };
  return { etat: 'ok', achat, benefice: Math.round((verse - achat) * 100) / 100, verse };
}
// L'ÉTAPE comme la ligne de Vinted la dit, et le ton (ambre = un geste à faire).
const etatLigneVc = (v, fait) => {
  if (vcVenteAnnulee(v)) return { etat: 'Annulée', ton: 'annule' };
  if (v.aExpedier && fait) return { etat: 'Colis fait', ton: '' };
  if (v.aExpedier) return { etat: 'À envoyer', ton: 'action' };
  return { etat: v.label || '', ton: '' };
};
// ⟦← App.jsx #12⟧
// UNE LIGNE DE VENTE VESTIAIRE (écran Ventes) — `LigneVenteCompacte`, comme Vinted.
function LigneVenteVc({ v, fait, enV, flou, i = 0 }) {
  const lb = beneficeVc(v, fait);
  const { etat, ton } = etatLigneVc(v, fait);
  const titre = v.titre || 'Article Vestiaire';
  const nomLigne = v.num ? `N°${v.num} · ${titre}` : titre;
  // Comme Vinted : la date sur la ligne (et, à expédier, « à envoyer avant … » — le
  // « à poster avant » de la carte Colis) ; le transporteur à côté du bouton bordereau.
  // (11 nov. soir) Les frais que Vestiaire prend, LUS (prix affiché − versé, `fraisVc`) : sur la
  // ligne seulement quand ils sont lus ; la fiche dit « frais pas lus » sinon (jamais 0).
  const fv = vcVenteAnnulee(v) ? null : fraisVc(v);
  const sous = [v.date ? dateCourteVc(v.date) : '', v.aExpedier && !fait ? limiteVcTexte(v) : '', fv && fv.lu ? `Frais Vestiaire ${eurosRecap(fv.frais)} (${String(fv.pct).replace('.', ',')}\u00a0%)` : ''].filter(Boolean).join(' · ');
  const trV = transporteurDuColis({ declare: v.transporteur, suivi: v.suivi });
  const benef = lb.etat === 'annulee' ? null : { etat: lb.etat, achatCentimes: lb.achat != null ? Math.round(lb.achat * 100) : null, benefCentimes: lb.benefice != null ? Math.round(lb.benefice * 100) : null,
    achatTxt: lb.achat != null ? `${eurosLigne(lb.achat)}\u00a0€` : (v.num ? 'à saisir' : '—'), benefTxt: texteBenefice(lb),
    aria: lb.etat === 'achat' ? "Bénéfice : prix d'achat manquant" : undefined };
  const coutManque = lb.etat !== 'annulee' && lb.achat == null && !!v.num;
  const gesteCout = coutManque ? <CoutAchatVente surLigne onSaisir={(p) => poserAchatVc(v.num, p)}/> : null;
  const photoNoeud = <PhotoVc src={v.photo || ''} style={{ width: 28, height: 36, borderRadius: 12, flexShrink: 0 }}/>;
  // (3 nov.) La frise de Vinted sur la ligne Vestiaire : chaque étape PROUVÉE par une donnée lue.
  const preuvesVc = preuvesFriseVc(v, fait);
  const etapesVc = preuvesVc ? friseVente(preuvesVc) : null;
  const fuVc = etapesVc ? friseVenteFusion(etapesVc, { geste: ton === 'action' }) : null;
  const recap = ({ titreId, fermerRef, fermer }) => {
    const mot = etapeMotVc(v);
    // (3 nov.) Les MÊMES étapes prouvées que la ligne (src/friseSites.js : `etapesVc` de Vestiaire « done », Colis fait, le mot lu).
    const etapes = etapesVc;
    const ici = etapes ? (etapes.find((x) => x.ici) || {}).cle : null;
    const phrase = vcVenteAnnulee(v) ? { gras: 'Annulée.', suite: 'L’article ne part pas : il reste chez toi.' }
      : v.aExpedier && !fait ? { gras: 'À envoyer.', suite: v.bordereau ? 'Imprime le bordereau (titre et N° tamponnés), puis dépose le colis.' : 'Le bordereau se prend sur Vestiaire, puis dépose le colis.' }
      : v.aExpedier && fait ? { gras: 'Colis fait.', suite: 'Vestiaire confirmera l’envoi au premier passage chez le transporteur.' }
      : mot === 'controle' ? { gras: 'Contrôle par Vestiaire.', suite: 'Vestiaire vérifie l’article avant de l’envoyer à l’acheteur.' }
      : ici === 'argent' ? { gras: 'Terminée.', suite: 'Vestiaire a versé l’argent.' }
      : ici === 'livree' ? { gras: 'Livrée.', suite: 'L’argent arrive quand Vestiaire le verse.' }
      // (11 nov.) Un mot de Vestiaire non rangé (« IN_PROGRESS ») : l'étape EN COURS lue dans sa frise, s'il y en a une.
      : etapeEnCoursVc(v, fait || null) ? { gras: `${etapeEnCoursVc(v, fait || null)}.`, suite: '' }
      : { gras: `${v.label || 'En cours'}.`, suite: '' };
    return <>
      <header className="vrm-recap-tete">
        <div className="vrm-sale-photo vrm-recap-photo"><PhotoVc src={v.photo || ''} style={{ width: '100%', height: '100%' }}/></div>
        <div className="vrm-recap-ident">
          {v.num ? <span className="vrm-recap-num" data-recap-num={v.num}>N°{v.num}</span> : <span className="vrm-recap-sans-num" data-recap-num="">Sans N° VRM</span>}
          <h2 id={titreId} className="vrm-recap-nom">{titre}</h2>
          <p className="vrm-recap-sous">Vestiaire Collective</p>
        </div>
        <button ref={fermerRef} type="button" className="vrm-recap-fermer" aria-label="Fermer les détails de la vente" onClick={fermer}><Icon name="close" size={18}/></button>
      </header>
      <section className="vrm-recap-etat" data-recap-etat={etat}>
        <p className="vrm-recap-phrase" data-recap-phrase=""><strong>{phrase.gras}</strong>{phrase.suite ? ' ' + phrase.suite : ''}</p>
        {/* (3 nov., critique #6) UNE frise : la même que la ligne (4 segments, mêmes mots, src/design/Frise.jsx),
            projetée des MÊMES étapes prouvées (`friseVente`) ; le bordereau n'est plus une étape mais
            une ligne de détail sous la frise, datée quand elle l'est. */}
        {etapes ? <RecapFrise etapes={etapes} cle={String(v.id || v.tx || '')}/> : null}
      </section>
      {/* (11 nov., lot vestiaire-plus) Le parcours CHEZ VESTIAIRE, étape par étape (envoyé → arrivé →
          authentification → validé/refusé → payé), chaque étape lue (src/parcoursVestiaire.js), et le
          moment où l'argent arrive (CA daté au versement). Une vente annulée n'a pas de parcours. */}
      {!vcVenteAnnulee(v) ? <ParcoursVestiaire v={v} colisFait={fait || null}/> : null}
      <section className="vrm-recap-argent" aria-label="L'argent">
        <h3 className="vrm-recap-titre">L'argent</h3>
        <dl>
          {/* (11 nov. soir, Julien) « Prix · Frais Vestiaire (%) · Pour toi » : les frais LUS (`fraisVc`),
              « frais pas lus » sinon — jamais 0, jamais devinés. */}
          {fv ? <div className="vrm-recap-ligne" data-vc-prix={fv.lu ? fv.cPrix : ''}><dt>Prix</dt><dd><span className="vrm-recap-montant">{fv.lu ? eurosRecap(fv.prix) : '—'}</span></dd></div> : null}
          {fv ? <div className="vrm-recap-ligne" data-vc-frais={fv.lu ? fv.cFrais : ''} data-vc-frais-etat={fv.lu ? 'lu' : 'passu'}><dt>Frais Vestiaire</dt><dd>{fv.lu ? <><span className="vrm-recap-montant">{eurosRecap(-fv.frais)}</span> <small data-vc-frais-pct={fv.pct}>({String(fv.pct).replace('.', ',')}{'\u00a0'}%)</small></> : <span className="vrm-recap-montant">— <small>frais pas lus</small></span>}</dd></div> : null}
          <div className="vrm-recap-ligne"><dt>{fv ? 'Pour toi' : 'Vestiaire te verse'}</dt><dd data-prix-vente={lb.verse != null ? Math.round(lb.verse * 100) : undefined}>{lb.verse != null ? eurosRecap(lb.verse) : '— pas sûr'}</dd></div>
          {lb.etat !== 'annulee' ? <div className="vrm-recap-ligne" data-recap-achat={lb.achat != null ? lb.achat.toFixed(2) : ''}><dt>Prix d’achat</dt><dd>{lb.achat != null ? eurosRecap(-lb.achat) : coutManque ? <CoutAchatVente recap onSaisir={(p) => poserAchatVc(v.num, p)}/> : '—'}</dd></div> : null}
          {lb.etat !== 'annulee' ? <div className="vrm-recap-ligne vrm-recap-benef" data-recap-benef-etat={lb.etat} data-benef-vente={lb.benefice != null ? lb.benefice.toFixed(2) : undefined}><dt>Bénéfice</dt><dd><span className="vrm-recap-valeur"><span className="vrm-recap-montant">{lb.benefice == null ? '—' : eurosRecap(lb.benefice)}</span></span>{lb.etat === 'prix' ? <small> montant versé pas sûr</small> : null}</dd></div> : null}
          {/* (11 nov., lot vestiaire-plus) Le moment où l'argent arrive (versé ⇒ le mois du CA ; estimé ⇒ pas encore dans le CA). */}
          {!vcVenteAnnulee(v) ? <LigneArgentVc v={v}/> : null}
        </dl>
      </section>
      <section className="vrm-recap-details" aria-label="Détails">
        <dl>
          <div className="vrm-recap-ligne"><dt>Vendue</dt><dd>{v.date ? dateCourteVc(v.date) : '— date pas lue'}</dd></div>
          {v.aExpedier ? <div className="vrm-recap-ligne"><dt>Envoi</dt><dd>{limiteVcTexte(v)}</dd></div> : null}
          {!(v.aExpedier && !fait && v.bordereau) && (trV.cle || trV.nom) ? <div className="vrm-recap-ligne"><dt>Transporteur</dt><dd><PastilleTransporteur t={trV} C={C} seul data-recap-transporteur=""/></dd></div> : null}
          {v.suivi ? <div className="vrm-recap-ligne"><dt>Suivi</dt><dd className="vrm-recap-mono">{v.suivi}</dd></div> : null}
          {v.etat && v.etape === 'autre' ? <div className="vrm-recap-ligne"><dt>Vestiaire écrit</dt><dd>« {v.etat} »</dd></div> : null}
        </dl>
        {enV ? <p data-vc-vente-vinted="" className="vrm-recap-issue">Encore en ligne sur Vinted : retire-la, sinon double vente. <a href={`https://www.vinted.fr/items/${enV.id}`} target="_blank" rel="noreferrer">Ouvrir l'annonce ↗</a></p> : null}
      </section>
      <section className="vrm-recap-gestes" aria-label="Actions">
        {v.aExpedier && !fait && v.bordereau ? <div className="vrm-recap-principal vrm-rangee-bord" data-rangee-bord=""><PastilleTransporteur t={trV} C={C} data-recap-transporteur=""/><BoutonImprimerVc v={v} grand/></div> : null}
        {!(v.aExpedier&&!fait)&&v.bordereau?.id?<BoutonImprimerVc v={v} lectureSeule/>:null}
        {v.prixVente && !vcVenteAnnulee(v) ? <FactureVcVente plateforme="vestiaire" vente={v} deps={DEPS_FACTURE}/> : null}
        <div className="vrm-recap-grille">
          {v.aExpedier ? <Bouton variante="secondaire" icone="check" data-geste="fait" data-vc-fait={v.id} onClick={() => gesteVrm(fait ? 'Colis remis à envoyer' : 'Colis fait', [{ k: 'vrm_vc_colis_done', type: 'cle', id: String(v.id), apres: fait ? undefined : Date.now(), avant: vcCarte('vrm_vc_colis_done')[String(v.id)] }], { vrm_vc_colis_done: vcSetter('vrm_vc_colis_done') })}>{fait ? '↺ Pas encore' : 'Colis fait'}</Bouton> : null}
          {v.num ? <Bouton variante="secondaire" icone="doc" data-recap-fiche={v.num} aria-label={`Fiche de l’article N°${v.num}`} onClick={() => { fermer(); window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: String(v.num) })); }}>Fiche de l’article</Bouton> : null}
        </div>
      </section>
    </>;
  };
  return (
    <LigneVenteCompacte compte={nomCompteVente('vestiaire', v, {}) || undefined} className="vrm-sale-row" data-tx={'vc:' + v.id} data-cible={attrCible(['vcvente', v.id], ['vcvente', v.productId])} data-vc-vente={v.id} data-vc-vente-num={v.num || ''} data-vc-vente-etape={v.etape} data-flou={flou ? '1' : '0'}
      style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none', opacity: vcVenteAnnulee(v) ? 0.6 : 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, ...(flou ? STYLE_FLOU : null) }}
      montantCentimes={lb.verse != null ? Math.round(lb.verse * 100) : undefined} numerosArticle={v.num ? [v.num] : []} plateforme="vestiaire"
      photo={v.photo || ''} photoNoeud={photoNoeud} titre={nomLigne} sous={sous} etat={etat} ton={ton}
      montant={lb.verse != null ? `${eurosLigne(lb.verse)}\u00a0€` : '—'} benef={benef} recap={recap}
      frise={fuVc ? <Frise etapes={fuVc} cle={'vc' + v.id} className="vrm-fu-ligne-frise" label="Où en est la vente"/> : null}
      gestes={gesteCout ? <div className="vrm-gestes-pile">{gesteCout}</div> : null}/>
  );
}
// ⟦← App.jsx #13⟧
function VentesVestiaire({ comptes }) {
  const { paires, enLigne } = useEbayPaires(comptes);
  const [d, setD] = React.useState(undefined);   // undefined en cours · null pas su · objet
  const vcOuvert = useCompteVcOuvert();
  const vcLoc = useVcLocal();
  useNumerotationVestiaire();
  const relire = React.useCallback(async () => {
    // (1er nov.) Relues une fois sur un échec passager (`lireBaseRelue`).
    const [jv, jl] = await Promise.all([
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_ventes&select=ventes:data->ventes,lectures:data->lectures`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=liens:data->liens`),
    ]);
    if (!Array.isArray(jv) || !Array.isArray(jl)) { setD(null); return; }
    const v = jv[0] && jv[0].ventes;
    setD({ ventes: v && typeof v === 'object' && !Array.isArray(v) ? v : null, lectures: (jv[0] && jv[0].lectures && typeof jv[0].lectures === 'object') ? jv[0].lectures : {}, liens: (jl[0] && jl[0].liens && typeof jl[0].liens === 'object') ? jl[0].liens : {} });
  }, []);
  React.useEffect(() => { relire(); }, [relire]);
  React.useEffect(() => {
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && x.quoi === 'vestiaire') relire(); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, [relire]);
  const enLigneParNum = React.useMemo(() => {
    const m = new Map();
    for (const p of (paires || [])) { const k = cleNum(p.num); if (k) m.set(k, p); }
    return m;
  }, [paires]);
  const style = { fontSize: 13, color: C.muted, lineHeight: 1.55 };
  const geste = <>ouvre <b style={{ color: C.text }}>« Mes ventes »</b> et <b style={{ color: C.text }}>« Articles à expédier »</b> sur Vestiaire</>;
  // (1er nov., audit A2) Une vente Vestiaire n'entre dans un total que si son
  // montant est SÛR (`montantRecuVc`) ; sinon elle est NOMMÉE à côté de chaque
  // total « toutes plateformes » (« au moins »). La phrase le dit, des mêmes lignes.
  const nPasSur = d && d.ventes ? Object.values(d.ventes).filter((v) => v && typeof v === 'object' && !vcVenteAnnulee(v) && montantRecuVc(v).eur == null).length : 0;
  const phraseMontant = <div data-vc-ventes-montant="" data-vc-ventes-pas-sur={nPasSur} style={{ ...style, marginTop: 8 }}>{nPasSur
    ? <span title="Montant pas sûr : prix de vente ou somme versée ? Chaque total le dit à côté (« au moins »).">{nPasSur} vente{nPasSur > 1 ? 's' : ''} non comptée{nPasSur > 1 ? 's' : ''}</span>
    : null}</div>;
  let corps;
  if (d === undefined) corps = <div data-vc-ventes="charge" style={style}>Lecture de tes ventes Vestiaire…</div>;
  else if (d === null) corps = <div data-vc-ventes="pas-su" style={style}>Je n'ai pas pu lire tes ventes Vestiaire (rien perdu). <button type="button" className="vrm-lien-action" data-vc-ventes-relire="" onClick={() => { setD(undefined); relire(); }} style={{ background: 'none', border: 'none', color: C.accentTexte, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, padding: 0 }}>Réessayer</button></div>;
  else if (!d.ventes) corps = <div data-vc-ventes="jamais" style={style}>Pas encore lues : {geste}{extSait('vcventes') === 'retard' ? <> — mise à jour en <b>{EXT_CAPACITES.vcventes}</b> d'abord</> : ''}.</div>;
  else {
    const partisVc = departsVc({ ...d, departs: vcLoc.departs });
    const liste = ordreRecent(Object.entries(d.ventes).filter(([, v]) => v && typeof v === 'object').map(([id, v]) => {
      const num = numVcVente(v, d.liens, vcLoc.auto);
      return { id, ...v, num, ...etapeVenteVc(v, partisVc.get(String(id)) || null) };
    // ⚠️ (9 nov., soir, lot AJ — décision de Julien : « du plus récent en haut au plus vieux en bas ») La
    // plus RÉCENTE en haut, tous comptes mélangés (src/ordreRecent.js). Avant (31 oct.) : les ventes à
    // expédier d'abord, la limite la plus proche en tête — l'étape et la limite restent écrites sur chaque ligne.
    }), quandVestiaire);
    const aExp = liste.filter((v) => v.aExpedier && !vcLoc.fait[v.id] && !v.departLu);
    const lue = d.lectures && d.lectures['a-expedier'];
    // (5.374) une lecture PARTIELLE plus fraîche que la lecture entière gardée est datée à côté (`partielleAt`).
    const derniere = [d.lectures && d.lectures.ventes && d.lectures.ventes.at, d.lectures && d.lectures.ventes && d.lectures.ventes.partielleAt, lue && lue.at, lue && lue.partielleAt].filter(Boolean).sort().pop() || '';
    if (!liste.length) corps = <div data-vc-ventes="vide" style={style}>Aucune vente Vestiaire à la dernière lecture{derniere ? ` (${ageCourtVc(derniere)})` : ''}. Après une vente, {geste} : elle apparaît ici.</div>;
    else corps = (
      <div data-vc-ventes="lu">
        <div data-vc-ventes-resume="" style={{ ...style, marginBottom: 8 }}>
          {liste.length} vente{liste.length > 1 ? 's' : ''} vue{liste.length > 1 ? 's' : ''} · <b style={{ color: C.text }}>{aExp.length} à expédier</b>{lue && !lue.complet ? ' (au moins)' : ''}{derniere ? `, lues ${ageCourtVc(derniere)}` : ''}.
          {!lue ? <> La liste « Articles à expédier » n'a pas encore été lue : {geste}.</> : null}
        </div>
        {/* La liste groupée de Vinted (`vrm-ventes-liste`) : une ligne par vente, filet fin. */}
        <div className="vrm-ventes-liste" data-vc-ventes-liste="" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',boxShadow:C.shadow||'none'}}>
          <div className="vrm-ledger-heading" aria-hidden="true"><span>Article</span><span className="vrm-ledger-state-heading">État</span><span>Montant</span></div>
          <div className="vrm-ventes-entete" aria-hidden="true" data-ventes-entete-cols=""><span/><span>Article</span><span>État</span><span className="is-droite">Versé</span><span className="is-droite">Achat</span><span className="is-droite">Bénéfice</span><span/></div>
          {/* (11 nov.) Regroupées par compte quand un compte Vestiaire est ouvert (src/regroupeComptes.js, suit le flou). */}
          <ListeParCompte lignes={liste.slice(0, 30)} ouvert={vcOuvert} floute={(v) => vcFloute(vcOuvert, v.compte)} compteDe={(v) => String(v.compte == null ? '' : v.compte).trim()} unite="vente" libelle="Compte ouvert sur Vestiaire" nomDe={(id) => nomCompteVente('vestiaire', { compte: id }, {})}
            rendre={(v, i) => <LigneVenteVc key={v.id} i={i} v={v} fait={vcLoc.fait[v.id] || null} enV={v.num && enLigne ? enLigneParNum.get(v.num) : null} flou={vcFloute(vcOuvert, v.compte)}/>}/>
        </div>
        {liste.length > 30 ? <div style={style}>Les 30 plus récentes sont montrées (sur {liste.length}).</div> : null}
      </div>
    );
  }
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Tes ventes Vestiaire</div>
      {corps}
      {d && d.ventes && Object.keys(d.ventes).length ? phraseMontant : null}
      {d && d.ventes && Object.keys(d.ventes).length ? <FactureVcTete deps={DEPS_FACTURE} ventes={Object.entries(d.ventes).filter(([, v]) => v && typeof v === 'object' && !vcVenteAnnulee(v)).map(([id, v]) => ({ id, ...v }))}/> : null}
    </Card>
  );
}
// ⟦← App.jsx #14⟧
// ══════════════════════════════════════════════════════════════════════════════
// VESTIAIRE COLLECTIVE : TES MESSAGES (27 octobre, 5.238 — lus et répondus le 31 octobre, 5.295)
// ══════════════════════════════════════════════════════════════════════════════
// Julien (27 oct.) : « fais pareil pour les messages Vestiaire » ; (31 oct.) :
// « au moins pouvoir lire les messages et écrire aux personnes, sans forcément
// automatiser ». L'extension relève ce que la page charge déjà : le NOMBRE de
// non-lus (`vc_messages.compteur`, mesuré), la liste des conversations
// (`vc_messages.conversations`, avec l'aperçu du dernier message depuis la
// 5.295) et, conversation par conversation, son FIL (`vc_fil_{id}` : le texte
// des messages, leur date, « de toi » — jamais le nom de la personne).
// La paire se relie par IDENTITÉ seulement (référence VRM-{n°} de l'article ou
// annonce créée par VRM), jamais le titre (§5).
// Répondre : sur SON clic (« Envoyer »), depuis l'onglet vestiairecollective.com
// ouvert dans ce Chrome, par l'extension (`vcRepondre`) — une à la fois, dans le
// plafond d'actions de l'heure, jamais pendant une pause de Vestiaire. Tant que
// l'extension n'a pas VU comment Vestiaire envoie un message (`vc_envoi.appris`),
// rien ne part : on le dit, avec le geste. Trois états, jamais « 0 » sur un « pas su ».
const etiquetteResultatVc = (r) => {
  if (!r) return { ton: 'muet', texte: "L'extension n'a pas répondu — je ne sais pas si le message est parti. Regarde la conversation sur Vestiaire avant de renvoyer." };
  if (r.accepte === true && r.etape === 'fait') return { ton: 'ok', texte: 'Envoyé sur Vestiaire.' };
  if (r.accepte === true && r.etape === 'incertain') return { ton: 'muet', texte: r.raison || "Je ne sais pas si le message est parti — regarde sur Vestiaire avant de renvoyer." };
  if (r.accepte === true && r.etape === 'refuse') return { ton: 'ko', texte: r.raison || "Vestiaire a refusé : le message n'est pas parti." };
  return { ton: 'ko', texte: (r.raison ? r.raison.charAt(0).toUpperCase() + r.raison.slice(1) : "Rien n'est parti.") + (/[.!]$/.test(r.raison || '') ? '' : '.') };
};
// (1er nov.) La présentation de Messages · Vinted (liste · fil · fiche de la
// paire) : la composition partagée (`LigneConv`, `CadreFil`, `BulleConv`,
// `ComposeConv`, `FicheConvVolet`). Les GESTES restent ceux de la 5.295 :
// « Envoyer » n'existe qu'avec `extSait('vcrepondre') === 'ok'` ET une recette
// apprise (`vc_envoi.appris`) ; sinon le pied le dit et propose Vestiaire.
// La fiche est reliée par la RÉFÉRENCE VRM de l'article (ou le lien posé par
// VRM à la publication) — le N° — puis la fiche VRM de CE N° (`ficheDuNumero`,
// ambigu ⇒ rien) ; sans référence : « Pas reliée ».
function ficheVestiaireDe(v, items) {
  if (!v || !v.num) return null;
  const f = ficheDuNumero(v.num);
  const it = (v.pid && items && items[v.pid]) || null;
  const fav = it && Number.isFinite(it.favoris) ? it.favoris : null;
  return { item: v.pid || undefined, num: v.num, photo: f && f.photo, titre: f && f.titre, sous: ['Vestiaire'],
    blocs: [{ cle: 'rangement', lib: 'Rangée', val: rangementDuNum(v.num) }, { cle: 'attention', lib: 'Attention', val: fav != null ? `${fav} favori${fav > 1 ? 's' : ''}` : null }] };
}
function FilVestiaire({ conv, num, titre, envoi, annonce = false, offre = null, onFerme }) {
  const [fil, setFil] = React.useState(undefined);   // undefined en cours · null pas su · objet
  const [texte, setTexte] = React.useState('');
  const [enCours, setEnCours] = React.useState(false);
  const [res, setRes] = React.useState(null);
  // (12 nov.) L'envoi se voit DANS le fil (src/envoiFil.js) : { etat, texte, depuis }.
  const [envoiFil, setEnvoiFil] = React.useState(null);
  const relire = React.useCallback(async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_fil_${encodeURIComponent(conv)}&select=messages:data->messages,page:data->>page,at:data->>capturedAt`, { headers: sbAuth() });
      if (!r.ok) throw new Error('lecture');
      const j = await r.json();
      setFil(j && j[0] ? { messages: Array.isArray(j[0].messages) ? j[0].messages : [], page: j[0].page || '', at: j[0].at || '' } : { messages: null });
    } catch (_) { setFil(null); }
  }, [conv]);
  React.useEffect(() => { relire(); }, [relire]);
  React.useEffect(() => {
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && x.quoi === 'vestiaire') relire(); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, [relire]);
  const cap = extSait('vcrepondre');
  const peut = cap === 'ok' && envoi && envoi.appris === true;
  const envoyer = async () => {
    const t = texte.trim();
    if (!t || enCours || !peut) return;
    setEnCours(true); setRes(null);
    const depuis = Date.now(); setEnvoiFil({ etat: 'envoi', texte: t, depuis });
    let r = null; try { r = await vmrCmd({ cmd: 'vcRepondre', conv, texte: t }, 45000); } catch (_) { r = null; }
    const etat = etatEnvoiExtension(r);
    setEnCours(false); setEnvoiFil({ etat, texte: t, depuis });
    // « Envoyé ✓ » est dit sous la bulle ; au-dessus du champ, seulement ce qui demande un geste.
    setRes(etat === 'ok' ? null : etiquetteResultatVc(r));
    if (etat === 'ok') { setTexte((v) => (v.trim() === t ? '' : v)); relire(); }
  };
  const style = { fontSize: 13, color: C.muted, lineHeight: 1.55, textAlign: 'center', padding: '20px 0' };
  let corps;
  if (fil === undefined) corps = <div data-vc-fil="charge" style={style}>Lecture de la conversation…</div>;
  // (12 nov.) Lecture ratée ≠ vide : la raison et « Réessayer ».
  else if (fil === null) corps = <FilIllisible attrs={{ 'data-vc-fil': 'pas-su' }} texte="Je n'ai pas pu lire cette conversation — rien n'est perdu." onRelire={() => { setFil(undefined); relire(); }}/>;
  else if (!fil.messages) corps = <div data-vc-fil="jamais" style={style}>Pas encore lue : ouvre-la une fois sur Vestiaire, avec l'extension{cap === 'retard' ? <> (mise à jour en <b>{EXT_CAPACITES.vcfil}</b> d'abord)</> : ''}.</div>;
  // (12 nov.) La liste annonce un message mais le fil est vide : « pas encore lu · Relire », jamais « aucun ».
  else if (filPasLu(fil.messages, annonce)) corps = <FilPasLu attrs={{ 'data-vc-fil': 'vide' }} onRelire={relire}/>;
  else if (!fil.messages.length) corps = <div data-vc-fil="vide" style={style}>Conversation lue, mais Vestiaire n'y a rendu aucun message lisible.</div>;
  else corps = (
    <div data-vc-fil="lu" data-vc-fil-n={fil.messages.length} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fil.messages.slice(-80).map((m, i) => (
        <BulleConv key={m.id || i} moi={m.deMoi === true} qui={m.deMoi === true ? 'Toi' : m.deMoi === false ? "L'autre personne" : ''} texte={m.t} quand={Date.parse(m.at || '') || null} avecDate traduire={m.deMoi !== true ? m.t : ''}
          attrs={{ 'data-vc-msg': m.deMoi === true ? 'moi' : m.deMoi === false ? 'autre' : 'passu' }}
          apres={(m.deMoi == null || m.envoyeParVrm || !Date.parse(m.at || '')) ? <small className="vrm-bulle-note" style={{ display: 'block', fontSize: 11, color: C.muted, marginTop: 3 }}>{[m.deMoi == null ? 'Auteur non dit par Vestiaire' : '', !Date.parse(m.at || '') ? 'date non dite' : '', m.envoyeParVrm ? 'envoyé depuis VRM' : ''].filter(Boolean).join(' · ')}</small> : null}/>
      ))}
    </div>
  );
  const page = fil && /^\/[\w/.-]*$/.test(fil.page || '') ? fil.page : '';
  const lien = `https://fr.vestiairecollective.com${page || '/'}`;
  const envoiVu = <EnvoiDansFil envoi={envoiFil} Bulle={BulleConv} site="Vestiaire" onReessayer={envoyer} reessayerDesactive={enCours || !texte.trim()}
    dejaLu={!!(envoiFil && fil && dejaDansFil(fil.messages, envoiFil.texte, envoiFil.depuis))}/>;
  const resultat = res && <div role="status" data-vc-resultat={res.ton} style={{ fontSize: 13, color: res.ton === 'ko' ? C.warn : res.ton === 'ok' ? C.text : C.muted, lineHeight: 1.5, marginBottom: 8 }}>{res.texte}</div>;
  let pied;
  if (fil && fil.messages && peut) pied = (
    <div className="vrm-chat-foot" data-vc-repondre="pret" style={{ borderTop: `1px solid ${C.border}`, background: C.card }}>
      {resultat}
      <RapidesConv liste={reponsesRapidesPartagees()} onChoisir={(t) => setTexte(String(t).slice(0, 2000))} desactive={enCours}/>
      <ComposeConv site="vestiaire" valeur={texte} onChange={(t) => setTexte(String(t).slice(0, 2000))} onEnvoyer={envoyer} enCours={enCours} etiquette="Ta réponse sur Vestiaire" libelleEnvoyer="Envoyer sur Vestiaire"
        envoiBloque={!texte.trim() || enCours} attrsEnvoyer={{ 'data-vc-envoyer': '' }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.muted, lineHeight: 1.45 }}>Part de l'onglet Vestiaire {NAV.dans}, à ton nom, un à la fois.</span>
        <a href={lien} target="_blank" rel="noreferrer" className="vrm-lien-action" style={{ color: C.muted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 13 }}>Ouvrir sur Vestiaire ↗</a>
      </div>
    </div>
  );
  else if (fil && fil.messages) pied = (
    <PiedSansEnvoi attrs={{ 'data-vc-repondre': cap !== 'ok' ? 'ext-' + cap : 'pas-appris', ...(cap === 'ok' ? { 'data-vc-pas-appris': envoi && envoi.raison ? envoi.raison : '' } : {}) }} lien={lien} texteLien="Répondre sur Vestiaire ↗"
      raison={cap === 'absente' ? <>Ouvre VRM là où est l'extension, ou réponds sur Vestiaire.</>
        : cap !== 'ok' ? <>Pour répondre d'ici, il faut l'extension <b>{EXT_CAPACITES.vcrepondre}</b> — mets-la à jour depuis <b>Paramètres → État des connexions</b>.</>
        : envoi && envoi.raison === 'messagerie-stream'
          ? <span data-vc-envoi-stream="">Vestiaire passe par un service de messagerie à part : réponds sur Vestiaire.</span>
          : <>D'abord, envoie <b>une</b> réponse toi-même sur Vestiaire, {NAV.dans} : VRM apprend.{envoi && envoi.raison ? <> (Dernier essai vu : pas encore sûr à refaire — {envoi.raison}.)</> : null}</>}>
      {resultat}
    </PiedSansEnvoi>
  );
  else if (fil !== undefined) pied = <PiedSansEnvoi lien={lien} texteLien="Ouvrir sur Vestiaire ↗" raison="Sans le texte de la conversation, VRM ne répond pas d'ici."/>;
  return (
    <CadreFil etiquette="Conversation Vestiaire" onFermer={onFerme} attrs={{ 'data-vc-fil-ouvert': conv }}>
      <TeteFil onFermer={onFerme} nom={num ? `N°${num}` : 'Conversation pas reliée à un article VRM'} titre={titre || ''} compte="Vestiaire"/>
      {/* (12 nov.) L'offre de CET article (même productId, §5), en carte, en tête du fil : ses gestes seulement
          quand c'est à lui de répondre (`OffresVestiaire`, recettes apprises, inchangé). */}
      {offre ? <div className="vrm-vc-fil-offre" data-vc-fil-offre="" style={{ padding: '10px 16px 0', flexShrink: 0 }}>{offre}</div> : null}
      <div className="vrm-chat-history" style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fil && fil.messages ? <AlerteArnaque site="vestiaire" lien={lien} messages={fil.messages}/> : null}
        {corps}
        {envoiVu}
      </div>
      {pied}
    </CadreFil>
  );
}
// (4 nov., 5.319) La photo d'un article dans une offre Vestiaire (adresse images.vestiairecollective.com vérifiée).
function PhotoOffreVc({ src, className }) {
  const [ko, setKo] = useState(false);
  const url = urlPhotoVc(src);
  return url && !ko ? <img src={url} className={className} alt="" loading="lazy" data-vrm-vignette="" onError={() => setKo(true)}/> : <span className={className} aria-hidden="true"/>;
}
function MessagesVestiaire() {
  const [d, setD] = React.useState(undefined);   // undefined en cours · null pas su · objet
  const vcOuvert = useCompteVcOuvert();
  const [ouvert, setOuvert] = React.useState('');
  const relire = React.useCallback(async () => {
    try {
      // (1er nov.) Relues une fois sur un échec passager (`lireBaseRelue`).
      const [jm, jl, jf, je, jo, jr] = await Promise.all([
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_messages&select=compteur:data->compteur,compteurs:data->compteurs,conversations:data->conversations,lecture:data->lecture`),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=liens:data->liens,items:data->items`),
        // 5.295 : les fils lus, en SCALAIRES (§4.4 : jamais le texte de tous les fils d'un coup).
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=like.vc_fil_*&select=id,n:meta->>n,da:meta->>dernierAt,ap:meta->>apercu,dm:meta->>dernierDeMoi,pid:meta->>productId,ref:meta->>ref`),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_envoi&select=appris:data->appris,raison:data->>raison,at:data->>at,chemin:data->>chemin`),
        // 5.319 : les offres reçues (`vc_offres`) et ce que VRM sait y répondre (`vc_offres_recette`).
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_offres&select=offres:data->offres,lecture:data->lecture,capturedAt:data->>capturedAt`),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_offres_recette&select=accepter:data->accepter,refuser:data->refuser,contre:data->contre`),
      ]);
      if (!Array.isArray(jm) || !Array.isArray(jl)) throw new Error('lecture');
      const r = (jm && jm[0]) || {};
      const fils = {};
      for (const x of (Array.isArray(jf) ? jf : [])) { const id = String(x.id || '').replace(/^vc_fil_/, ''); if (id) fils[id] = x; }
      setD({ compteur: r.compteur || null, compteurs: r.compteurs || null, conversations: r.conversations || null, lecture: r.lecture || null, liens: (jl && jl[0] && jl[0].liens) || {}, items: (jl && jl[0] && jl[0].items) || {},
        offres: Array.isArray(jo) ? (jo[0] || {}) : null, recettesOffres: Array.isArray(jr) ? (jr[0] || {}) : null,
        fils: Array.isArray(jf) ? fils : null, envoi: Array.isArray(je) ? (je[0] ? { appris: je[0].appris === true,
          // (3 nov.) L'ouverture d'une conversation (`/chat/channel/`) notée à tort comme un essai d'envoi par les 5.295-5.316 : pas un essai.
          raison: /^\/chat\/channel\/?$/.test(String(je[0].chemin || '')) ? '' : (je[0].raison || ''), at: je[0].at || '' } : { appris: false, raison: '' }) : null });
    } catch (_) { setD(null); }
  }, []);
  React.useEffect(() => { relire(); }, [relire]);
  React.useEffect(() => {
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && x.quoi === 'vestiaire') relire(); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, [relire]);
  const style = { fontSize: 13, color: C.muted, lineHeight: 1.55 };
  const age = (iso) => { const t = Date.parse(iso || ''); if (!isFinite(t)) return ''; const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? `il y a ${m} min` : m < 48 * 60 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
  // La page où la liste a été VUE (sans identifiant) ; sinon l'accueil — jamais une adresse devinée.
  const page = d && d.lecture && /^\/[\w/.-]*$/.test(d.lecture.page || '') ? d.lecture.page : '';
  const lien = `https://fr.vestiairecollective.com${page || '/'}`;
  let corps;
  if (d === undefined) corps = <div role="status" data-vc-messages="charge" style={{ ...style, padding: '12px 0' }}>{PAS_SU.enCours}</div>;
  // (5 nov., chantier G, revue 1.10) La panne par `EtatPanne`, avec SON « Réessayer ».
  else if (d === null) corps = <div data-vc-messages="pas-su"><EtatPanne quoi="Tes messages Vestiaire" raison="Rien n’est perdu : c’est la lecture qui a échoué." onReessayer={() => { setD(undefined); return relire(); }}/></div>;
  else if (!d.compteur && !d.conversations && !(d.fils && Object.keys(d.fils).length)) corps = <div data-vc-messages="jamais" style={style}>Pas encore relevés. Ouvre Vestiaire dans le navigateur où l'extension VRM est installée{extSait('vcmessages') === 'retard' ? <> — mise à jour en <b>{EXT_CAPACITES.vcmessages}</b> d'abord</> : ''}.</div>;
  else {
    const nl = nonLusVestiaire(d.compteur, d.compteurs);
    const n = nl ? nl.n : null;
    const ids = new Set([...Object.keys(d.conversations || {}), ...Object.keys(d.fils || {})]);
    const liste = [...ids].map((id) => {
      const v = (d.conversations || {})[id] || {}; const f = (d.fils || {})[id] || null;
      const pid = v.productId || (f && f.pid) || ''; const ref = v.ref || (f && f.ref) || '';
      const apercu = (f && f.ap) || v.apercu || '';
      const date = (f && f.da) || v.date || v.vuAt || '';
      const deMoi = f && f.ap ? f.dm === 'true' : v.apercuDeMoi === true;
      // (11 nov., anti-arnaque) L'auteur de l'aperçu en TROIS états (pas su ⇒ null) : l'alerte ne lit que « false ».
      const deMoiSu = f && f.ap ? (f.dm === 'true' ? true : f.dm === 'false' ? false : null) : (v.apercuDeMoi === true ? true : v.apercuDeMoi === false ? false : null);
      // (3 nov., 5.317) Le titre et la photo de l'ARTICLE lus par l'extension (fil des notifications
      // Vestiaire) quand la conversation n'est reliée à aucune fiche — affichage seul, jamais une identité.
      const it = (pid && d.items && d.items[pid]) || null;
      return { id, pid: String(pid || ''), nonLu: v.nonLu, apercu, deMoi, deMoiSu, date, lu: !!(f && Number(f.n) > 0), num: cleNum((pid && d.liens[pid]) || ref || ''), compte: v.compte || '',
        titreArticle: String(v.titre || (it && it.titre) || ''), photoArticle: urlPhotoVc(v.photo || (it && it.photo) || '') };
    }); // (11 nov.) le plus récent en haut, par horodatage (avant : les non-lus devant, puis un tri de textes)
    liste.splice(0, liste.length, ...trierRecents(liste, (v) => v.date));
    const choisie = liste.find((v) => v.id === ouvert) || null;
    const fcChoisie = choisie ? ficheVestiaireDe(choisie, d.items) : null;
    const offresEtat = offresVestiaire(d.offres);
    // (12 nov.) L'offre d'un article se lit DANS sa conversation (même productId, jamais le titre) ;
    // en haut ne restent que les offres dont la conversation n'est pas ouverte (le même prix jamais deux fois).
    const pidOuvert = choisie && choisie.pid ? choisie.pid : '';
    const offresDu = (garder) => (offresEtat.etat === 'lu' ? { ...offresEtat, aTrancher: offresEtat.aTrancher.filter((o) => garder(o.produit)), enAttente: offresEtat.enAttente.filter((o) => garder(o.produit)) } : offresEtat);
    const propsOffres = { recettes: d.recettesOffres, cap: extSait('vcoffrerepondre'), numDe: (pid) => cleNum((pid && d.liens[pid]) || ''),
      envoyer: async (m) => { const r = await vmrCmd(m, 45000); relire(); return r; }, Photo: PhotoOffreVc };
    const offreFil = pidOuvert && offresEtat.etat === 'lu' && (offresEtat.aTrancher.some((o) => o.produit === pidOuvert) || offresEtat.enAttente.some((o) => o.produit === pidOuvert))
      ? <OffresVestiaire etat={offresDu((p) => p === pidOuvert)} {...propsOffres}/> : null;
    corps = (
      <div data-vc-messages="lu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div data-vc-messages-nonlus={n == null ? 'passu' : String(n)} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0 12px' }}>
          {n == null ? <>Nombre de non-lus pas encore relevé.</>
            : <span><b style={{ color: C.text }}>{n === 0 ? 'Aucun message non lu' : `${n} message${n > 1 ? 's' : ''} non lu${n > 1 ? 's' : ''}`}</b>{nl.comptes > 1 ? <span data-vc-messages-comptes={nl.comptes}> · {nl.comptes} comptes</span> : null}</span>}
          <a data-vc-messages-ouvrir="" href={lien} target="_blank" rel="noreferrer" className="vrm-pied-lien" data-pied-lien="ouvrir-vc">{page ? 'Ouvrir la messagerie ↗' : 'Ouvrir Vestiaire ↗'}</a>
        </div>
        <OffresVestiaire etat={offreFil ? offresDu((p) => p !== pidOuvert) : offresEtat} {...propsOffres}/>
        <div className="vrm-message-workspace">
          <div className="vrm-inbox-column">
            {liste.length ? <>
              <div style={{ ...style, marginBottom: 6 }}>{liste.length} conversation{liste.length > 1 ? 's' : ''}{d.lecture && !d.lecture.complet ? ' (au moins)' : ''}</div>
              <CompteurArnaque n={liste.filter((v) => motifDeLApercu(v.apercu, v.deMoiSu)).length}/>
              <div className="vrm-msg-list">
                {liste.slice(0, 40).map((v) => {
                  const fv = v.num ? ficheDuNumero(v.num) : null; const t = Date.parse(v.date || '');
                  return (
                    <div key={v.id} data-vc-conv={v.id} data-vc-conv-num={v.num || ''} data-vc-conv-nonlu={v.nonLu === true ? 'oui' : v.nonLu === false ? 'non' : 'passu'} data-vc-conv-lu={v.lu ? 'oui' : 'non'} data-flou={vcFloute(vcOuvert, v.compte) ? '1' : '0'} style={vcFloute(vcOuvert, v.compte) && ouvert !== v.id ? STYLE_FLOU : undefined}>
                      {/* (5 nov., chantier G) La ligne porte le nom de l'ARTICLE (Vestiaire ne donne jamais celui de
                          l'acheteur) : « Vestiaire » trois fois de suite ne disait rien. Le N° vient de l'identité (référence VRM). */}
                      <LigneConv actif={ouvert === v.id} onClick={() => setOuvert(v.id)} ariaLabel={`Ouvrir la conversation ${v.num ? 'du N°' + v.num : 'pas reliée à un article VRM'}`}
                        photo={(fv && fv.photo) || v.photoArticle} nom={(fv && fv.titre) || v.titreArticle || 'Article Vestiaire'} quand={isFinite(t) ? t : null} couleurHeure={v.nonLu === true ? C.text : C.muted}
                        titre={v.num || v.titreArticle ? '' : 'Pas reliée à un article VRM'} num={v.num}
                        extrait={v.apercu || (v.lu ? '' : 'Texte pas encore lu')} toi={!!v.apercu && v.deMoi} couleurExtrait={v.nonLu === true ? C.text : C.muted}
                        apres={<>{offresEtat.etat === 'lu' && v.pid && offresEtat.parProduit[v.pid] ? <span className="vrm-of-tag" data-vc-conv-offre={offresEtat.parProduit[v.pid].id}>offre {euros(offresEtat.parProduit[v.pid].offre)}</span> : null}{v.nonLu == null ? <span className="vrm-msg-etat" title="Vestiaire ne dit pas si elle est lue" style={{ color: C.muted, borderColor: C.border }}>lu ?</span> : null}<PastilleArnaque motif={motifDeLApercu(v.apercu, v.deMoiSu)}/></>}
                        point={v.nonLu === true ? C.accent : null}/>
                    </div>
                  );
                })}
              </div>
            </> : (d.conversations ? <div data-vc-conv-vide="" style={style}>Aucune conversation à la dernière lecture.</div>
              : <div data-vc-conv-jamais="" style={style}>Le détail des conversations arrive quand tu ouvres ta messagerie sur Vestiaire {NAV.dans}.</div>)}
          </div>
          <div className="vrm-chat-column">{choisie
            ? <FilVestiaire key={choisie.id} conv={choisie.id} num={choisie.num} titre={(fcChoisie && fcChoisie.titre) || choisie.titreArticle || ''} envoi={d.envoi} annonce={!!choisie.apercu} offre={offreFil} onFerme={() => setOuvert('')}/>
            : <div className="vrm-chat-empty"><Icon name="chat" size={28}/><span>Choisis une conversation</span><small>Lis-la et réponds-y depuis VRM.</small></div>}</div>
          {!choisie ? <FicheConvVolet site="vestiaire" etat="aucune"/>
            : <FicheConvVolet site="vestiaire" etat={fcChoisie ? 'reliee' : 'non-reliee'} fc={fcChoisie} raison={`Cet article Vestiaire ne porte aucune référence VRM : VRM ne devine pas ${motsVendeur().le} d’après le titre.`}/>}
        </div>
      </div>
    );
  }
  return (
    <div data-messagerie-site="vestiaire">
      {corps}
    </div>
  );
}
export { PublierVestiaire, AnnoncesVestiaire, MessagesVestiaire, VentesVestiaire, ClePhotoroom, FilVestiaire, ficheDuNumero };
