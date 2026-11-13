// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import ChampSaisie from '../composants/ChampSaisie.jsx';
import { montantSeuil } from '../offresSures.js';
import { erreurMessageAuto } from '../messageSur.js';
import { motsVendeur, motArticle } from '../profilVendeur.js';
import { lancerTravail as lancerTravailCV } from '../suiviTravail.js';
import { ProgrammesRepubCarte } from '../RepubProgramme.jsx';
import { STYLE_FLOU } from '../flouCompte.js';
import { actionsPossibles, ETATS_ANNONCE } from '../annoncesActions.js';
import { meilleureSuggestion, texteSuggestion } from '../achatsARelier.js';
import { prixADemander, suggestionNumerotage } from '../prixAuNumerotage.js';
import { produitDeVinted } from '../lienVestiaire.js';
import { liensParAchat } from '../suggestionsAchat.js';
import { seuilValide } from '../quiDorment.js';
import { lireReglage as lireReglageQR, CLE_REGLAGE as CLE_REGLAGE_QR } from '../quoiRepublier.js';
import { seuilFavorisValide } from '../vendrePlus.js';
import { masqueesParCompte } from '../annoncesMasquees.js';
import React, { useState, useMemo } from 'react';
import { montant, prixTxt as prixTxtMontant } from '../format.js';
import { ChampRecherche } from '../composants/ChampRecherche.jsx';
import { SuitePaquets } from '../composants/SuitePaquets.jsx';
import { PhotoVide } from '../composants/PhotoVide.jsx';
import { Numero } from '../composants/Numero.jsx';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { VERBES, PAS_SU } from '../libelles.js';
import { ChiffreConseil } from '../Conseils.jsx';
import { photoArticle } from '../photosArticles.js';
import { baisseProportion } from '../conseilPrix.js';
import { propositionPrixAchat } from '../prixAchatPropose.js';
import { carteNumerosVc } from '../numerosVestiaire.js';
import { fichesAPublier, texteAColler } from '../dupliquerFiche.js';
import { initialeCompte } from '../annoncesGrille.js';
import { EnLigneDeuxFoisAlerte } from '../EnLigneDeuxFois.jsx';
import { PHRASE_FORCE as PHRASE_REMISE } from '../remiseEnLigne.js';
import { PHRASE_ETAT as PHRASE_NUMERO_ECRIT } from '../numeroEcrit.js';
import { aussiSur, texteAussiSur } from '../publierPartout.js';
import { tr } from '../i18n/index.js';
import { trj } from '../i18n/react.js';
import { ACTIONS_REPUB, AcctTag, BlocBarrerVc, Bouton, BoutonRappel, C, ETAPES_REPUB, EXT_CAPACITES, EmptyState, FeuilleCreerVinted, FraicheurAnnonces, INV_STATUS, Icon, JOURNAL_REPUB, LBC_ORANGE, MP_PLACES, NUM_OK, NotePaireCoque, PhotoVinted, Pourquoi, PuceProposition, ScreenHead, Segmente, SheetShell, Skeleton, __repubVivant, aLaDemande, annonceDeclareePartie, appelEbay, askConfirm, askText, avecCouleurBrouillon, clavierNum, cleNum, corpsCompteEbay, defaireVc, deleteVintedAccount, demanderVue, depuisFr, ecrireJournalRepub, emettreClesRelues, etatPrepaLbc, etatRegleOffre, extSait, extractBrand, extractColors, extractModel, fmt, garageCellLabel, garageCellOf, gesteCorbeille, gesteVrm, load, mpChoisi, numeroEcritActif, numeroReprenable, onCloudReady, orderPhoto, photoKey, prixAchatDe, prixCompatibleRegle, prixCourt, refusHorsLigne, resultatReviseEbay, save, tailleDansTitre, toast, useVcLocal, vcCarte, vintedDeChrome, vmrCmdSuivi } from '../App.jsx';

// La branche {curSub==='annonces' && …} de Comptabilite, telle quelle, avec 32 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function VueAnnonces({ v }) {
  const { NoAcc, SLEEP_DAYS, aVerifierCarton, accNameOf, accounts, acctOff, achatPlusTard, achatRelie, annACompleter, annAConfirmer, annBannies, annBase, annEnDouble, annGroupes, annGroupesVus, annMasquees, annMax, annPlus, annSearch, annSelectionnables, annShown, annSort, annStats, annToolsCote, annToolsOpen, annUnCompte, annonceBaisse, apercuEcrit, astuceNum, baissesEbay, basculerOffresAuto, blocAEcrire, blockedAccts, blockedList, bordForItem, brVinted, buyByNum, buyOf, changerRefusVariantes, chargerAchats, comptesMuets, conseilsPrix, cur, dansPlateforme, declarerPartie, dispOpen, disparues, donnerNumeroNeuf, ebayBaisse, ebayNums, ebayVerif, ebayVivantes, ecrirePrixTape, ecrireRefusMsg, ecritOnUi, ecritureRelierAchat, effEntry, emailSoldIds, enLigneDeux, estFloute, estLotPropose, eur, ficheMenu, fichesOuvertes, fichesParNum, fileAchat, fillBuyAchats, garageGrid, hiddenAccts, imgMortes, inGarage, lbcAussi, liensAchats, listedAgeDays, listings, liveStats, loadListings, masqOpen, masqueePlusLa, masqueesBloc, modeDort, nAutresSignalements, nRefaire, neufsOuverts, nextNumero, noAcc, nomPorteur, noterImgMorte, numAttente, numDoublons, numeroReprises, numeros, numerosNeufs, offresAuto, offresInfo, onLocate, onNav, onStore, openPicker, ouvrirProgramme, ouvrirRecuRelie, photosComptes, porteursNum, prix, progsRepub, qdSel, qrReglage, quoiRep, recordUsed, recuOuverture, refusMsg, refusVariantes, relireEmpreintes, remiseRefus, remisesParts, repriceList, repubAction, retoursSuivis, saisirPrixAnnonce, saleOv, selAnn, setAchatPlusTard, setActionsSelOpen, setAnnSearch, setAnnSort, setAnnToolsCote, setAnnToolsOpen, setAstuceNum, setAtelier, setBaisseSel, setBaissesEbay, setBlockedAccts, setBrouillonsOpen, setDispOpen, setDortAgir, setEbayBaisse, setFicheMenu, setFichesOuvertes, setFillBuyOpen, setKitMain, setMasqOpen, setModeDort, setNeufsOuverts, setNeufsVus, setNumeros, setOffresInfo, setPairsLost, setPassportFor, setPhotosComptesOuvert, setQdSel, setQrReglageEtat, setRefaireOpen, setRemiseRefus, setRepubAction, setRepubCle, setRepubDepart, setRepubMainOuvert, setRepubReprise, setSelAnn, setSeuilDortEtat, setSeuilFavEtat, setShowEmailSold, setShowLister, setShowReprice, setSoldManual, setStudioOpen, setTipsOpen, seuilDort, seuilFav, showEmailSold, showReprice, soldManual, suiviesList, suivisMainVisibles, takenCles, tipsOpen, updatePair, vcNumsAnn, ventilationDeTx, vueRelancer } = v;
  /*⟦← App.jsx #h1_1⟧*/const gesteVendues = (ids, oui) => {
    const ops = [...new Set((ids || []).map(String))].filter((id) => soldManual.has(id) !== !!oui)
      .map((id) => ({ k: 'vinted_annonces_vendues', type: 'ensemble', id, apres: !!oui, avant: !oui }));
    if (!ops.length) return;
    gesteVrm(oui ? (ops.length > 1 ? `${ops.length} annonces marquées vendues` : 'Annonce marquée vendue') : (ops.length > 1 ? `${ops.length} annonces réaffichées` : 'Annonce réaffichée'), ops, { vinted_annonces_vendues: setSoldManual });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const setSeuilDort = (v) => { const x = seuilValide(v); setSeuilDortEtat(x); try { localStorage.setItem('vrm_qd_seuil', String(x)); } catch (_) {} };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_3⟧*/const setQrReglage = (r) => { const x = lireReglageQR(r); setQrReglageEtat(x); try { localStorage.setItem(CLE_REGLAGE_QR, JSON.stringify(x)); } catch (_) {} };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_4⟧*/const setSeuilFav = (v) => { const x = seuilFavorisValide(v); setSeuilFavEtat(x); try { localStorage.setItem('vrm_qd_seuil_fav', String(x)); } catch (_) {} };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_5⟧*/const setMpToutes = (place, on) => {
    setNumeros(prev => {
      const u = { ...prev }; let n = 0;
      for (const it of annBase) {
        const c = u[it.id]; if (!c || !String(c.numero || '').trim()) continue;  // sans N°, rien à envoyer
        if (mpChoisi(c, place) === on) continue;
        u[it.id] = { ...c, mp: { ...(c.mp || {}), [place]: on } }; n++;
      }
      if (!n) return prev;
      save('vinted_annonce_numeros', u);
      const nom = (MP_PLACES.find(p => p.cle === place) || {}).nom || place;
      toast(on ? `${n} annonce${n>1?'s':''} ajoutée${n>1?'s':''} à la file ${nom}` : `${n} annonce${n>1?'s':''} retirée${n>1?'s':''} de ${nom}`);
      return u;
    });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_6⟧*/const AchatRelie = ({ entry, numero }) => {
    const a = achatRelie(entry);
    if (!a) return null;
    const ph = orderPhoto(a);
    return (
      <div style={{display:'flex',alignItems:'center',gap:7,margin:'0 0 8px',padding:'5px 7px',borderRadius:12,border:`1px solid ${INV_STATUS.online.color}44`,background:`${INV_STATUS.online.color}0e`}}>
        {/* La photo de l'ACHAT (celle du vendeur à qui tu l'as achetée), pas
            celle de la paire vendue : elle est dite comme telle (20 oct.). */}
        <div title="Photo de l'achat (prise par le vendeur)" style={{width:30,height:30,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
          {ph ? <PhotoVinted src={ph} alt="Photo de l'achat" data-photo-achat="1" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:15}}>🧾</span>}
        </div>
        <div style={{flex:'1 1 90px',minWidth:0}}>
          <div style={{fontSize:11,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={a.title}><span style={{color:C.muted,fontWeight:500}}>Achat relié · </span>{a.title||'sans titre'}</div>
          <div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            Acheté {a.price?.amount!=null?`${Number(a.price.amount).toFixed(2).replace('.',',')}\u00a0${cur(a.price?.currency_code)}`:'—'}{a.date?` · ${new Date(a.date).toLocaleDateString('fr-FR')}`:''}
          </div>
        </div>
        <button type="button" data-recu-relie={String(a.transaction_id||'')} disabled={recuOuverture===String(a.transaction_id||'')} onClick={()=>ouvrirRecuRelie(a, numero)}
          title="Ouvrir le reçu d'achat" aria-label="Reçu d'achat"
          style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:12,background:C.bg,color:C.text,cursor:'pointer',fontSize:11,fontWeight:600,padding:'4px 8px',fontFamily:'inherit'}}><Icon name="doc" size={14}/> Reçu</button>
      </div>
    );
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_7⟧*/const poserAchatPlusTard = (id) => gesteVrm('Mise de côté — elle revient dans 7 jours', [{ k: 'vrm_achat_plus_tard', type: 'cle', id: String(id), apres: new Date().toISOString(), avant: (achatPlusTard || {})[String(id)] }], { vrm_achat_plus_tard: setAchatPlusTard });/*⟦←/⟧*/
  /*⟦← App.jsx #h1_8⟧*/const demanderPrixAchat = async (item, numeroPose) => {
    if (!prixADemander(effEntry(item), buyOf(item))) return;   // prix connu ou achat relié
    // Une suggestion d'achat (la règle de « Sans achat relié » : marque ET taille,
    // achat antérieur à la mise en ligne) est PROPOSÉE à côté du champ, jamais posée
    // dedans. Les achats captés sont relus (relecture seule, aucun appel Vinted) ;
    // s'ils tardent plus d'1,5 s, la feuille s'ouvre sans suggestion.
    let sugg = null;
    try {
      const achats = await Promise.race([chargerAchats(), new Promise((r) => setTimeout(() => r(null), 1500))]);
      const s = Array.isArray(achats) && achats.length ? meilleureSuggestion({ item, achats, liens: liensParAchat(numeros, saleOv), marqueDe: extractBrand, couleursDe: extractColors, modeleDe: extractModel }) : null;
      const aff = s ? suggestionNumerotage(texteSuggestion(s, propositionSuggestion(s.achat)), montant) : null;
      if (aff) sugg = { achat: s.achat, aff: { ...aff, photo: orderPhoto(s.achat) || '', autre: true } };
    } catch (_) { sugg = null; }
    const rep = await askText({
      title: `Prix d'achat de la N°${numeroPose} ?`,
      desc: `Tu viens de numéroter « ${item.title || item.brand || 'cet article'} ». Note ce que tu l'as payé — tu peux le mettre plus tard.`,
      value: '', placeholder: 'ex : 25 ou 12,50', decimal: true, data: 'prix-numerotage', ok: 'Enregistrer', cancel: 'Plus tard',
      suggestion: sugg ? sugg.aff : null,
    });
    if (rep == null) return;                               // « Plus tard » / fermé : rien d'écrit
    if (typeof rep === 'object') { if (rep.relier && sugg) await relierAchatAnnonce(item, sugg.achat); else if (rep.autre && sugg) openPicker({ ...item, _autre: String(sugg.achat.transaction_id) }); return; }
    const w = ecrirePrixTape(item, rep, numeroPose);
    if (w.etat === 'ok') toast(`Prix d'achat enregistré : ${w.patch.buyPrice}\u00a0€`);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_9⟧*/const changeAMain = (item, avantN, v, at, opts) => {
    if (opts && opts.carton) return {};
    const c = numeros[String(item.id)] || {};
    const enCours = c.reattribue && !c.reattribue.ecrit && cleNum(c.reattribue.vers) === cleNum(avantN) ? c.reattribue : null;
    const de = enCours ? String(enCours.de) : String(avantN == null ? '' : avantN).trim();
    if (!cleNum(de) || cleNum(de) === cleNum(v)) return enCours ? { reattribue: null } : {};
    return { reattribue: { de, vers: String(v), at, main: true } };
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_10⟧*/const poserNumero = async (item, valeur, avant, opts = {}) => {
    const brut = String(valeur || '').trim();
    // Champ vidé : on ne retire JAMAIS un numéro (§5.40, il est écrit sur une
    // boîte). L'affichage se remet tout seul sur la valeur enregistrée.
    if (!brut) return;
    const moi = String(item.id);
    avant = String(avant ?? '');
    const cle = cleNum(brut);
    if (cle === cleNum(avant)) return;                         // rien n'a changé (« b125 » = « B125 »)
    if (!NUM_OK.test(cle)) {
      updatePair(item, { numero: avant });
      toast('Un numéro, ce sont des chiffres (125) ou 1 à 3 lettres suivies de chiffres (B125).');
      return;
    }
    // Un numéro d'ARCHIVE (« B230 ») ne se redonne pas à une annonce : la paire
    // republiée a un numéro neuf (Julien, 10 octobre).
    if (!numeroReprenable(cle)) {
      updatePair(item, { numero: avant });
      toast(`« ${cle} » est un ancien numéro : il ne se redonne pas. Ton article republié garde un numéro neuf — écris celui-là sur son étiquette.`);
      return;
    }
    // Ce qu'on écrit : tel quel pour des chiffres, la clé (majuscules) sinon.
    const n = /^\d+$/.test(brut) ? brut : cle;
    // Un numéro posé À LA MAIN porte sa date : la base sait que c'est un geste.
    const manuelAt = new Date().toISOString();
    const autres = Object.keys(numeros).filter(k => k !== moi && cleNum((numeros[k] || {}).numero) === cle);
    // ⚠️ Un numéro BRÛLÉ sans fiche (une vente passée, un numéro posé sur une
    //    vente) a déjà été écrit sur un carton : avant, on le reprenait sans un
    //    mot. On demande — c'est la même paire qui revient, ou un autre numéro.
    if (!autres.length && takenCles.has(cle) && !(porteursNum[cle] || []).some(p => String(p.id) !== moi)) {
      // (11 nov.) Hors ligne : la réponse « non » donnerait un N° NEUF (réservé au serveur seul, §5).
      if (!opts.memePaire && refusHorsLigne('numero')) { updatePair(item, { numero: avant }); return; }
      // (9 nov.) « C'est la même paire » déjà dit (remise en ligne) : pas redemandé.
      const meme = opts.memePaire ? true : await askConfirm({
        title: `Le N°${n} a déjà servi`,
        desc: `Ce numéro a déjà été donné à un article (il est peut-être écrit là où un article est rangé : carton, étagère, bac…).\n\nEst-ce bien le MÊME article qui revient ? Sinon, prends un numéro neuf.`,
        ok: 'Oui, le même article', cancel: `Non — N°${nextNumero}`,
      });
      const v = meme ? n : String(nextNumero);
      updatePair(item, { numero: v, manuelAt, ...changeAMain(item, avant, v, manuelAt, opts) }); recordUsed(v); await demanderPrixAchat(item, v); return;
    }
    // ⚠️ C'EST ICI qu'on écrit le numéro (le champ ne valide qu'à la sortie,
    //    cf. `ChampSaisie` — il n'écrit plus à chaque frappe).
    if (!autres.length) { updatePair(item, { numero: n, manuelAt, ...changeAMain(item, avant, n, manuelAt, opts) }); recordUsed(n); await demanderPrixAchat(item, n); return; }
    const presents = (porteursNum[cle] || []).filter(p => String(p.id) !== moi);
    if (presents.length && refusHorsLigne('numero')) { updatePair(item, { numero: avant }); return; }
    if (presents.length) {
      // Revue de la 5.167 : une annonce « à confirmer » n'est ni « en ligne » ni
      // « partie » — on ne sait pas. On le dit tel quel, et on ne propose JAMAIS
      // de lui prendre son numéro.
      const qui = presents.map(p => p.type === 'annonce' ? (p.masquee
          ? `📦 masquée par Vinted, toujours chez toi « ${p.titre} »`
          : p.aConfirmer
          ? `📦 peut-être encore en ligne « ${p.titre} » (son compte n'a pas été relu depuis ${p.lu ? depuisFr(p.lu).replace(/^il y a /, '') : 'longtemps'})`
          : `📦 en ligne « ${p.titre} »`)
        : p.type === 'vente' ? `📮 à expédier « ${p.titre} »`
        : p.type === 'annulee' ? `↩️ vente annulée, l'article est resté « ${p.titre} »`
        : `${p.titre}`).join('\n');
      const peutEtre = presents.every(p => p.aConfirmer);
      const prendre = await askConfirm({
        title: peutEtre ? `Le N°${n} est peut-être encore pris` : `Le N°${n} est déjà pris`,
        desc: `${peutEtre ? 'Un article le porte peut-être encore' : 'Un article le porte encore'} :\n${qui}\n\nDeux articles avec le même numéro, c'est le mauvais article au moment d'expédier.`,
        ok: `Prendre le N°${nextNumero}`, cancel: 'Annuler',
      });
      updatePair(item, prendre ? { numero: String(nextNumero), manuelAt, ...changeAMain(item, avant, String(nextNumero), manuelAt, opts) } : { numero: avant });
      if (prendre) { recordUsed(nextNumero); await demanderPrixAchat(item, String(nextNumero)); }
      return;
    }
    const anc = numeros[autres[0]] || {};
    if (!opts.memePaire && refusHorsLigne('numero')) { updatePair(item, { numero: avant }); return; }
    const meme = opts.memePaire ? true : await askConfirm({
      title: `Le N°${n} a déjà servi`,
      desc: `Il était sur « ${anc.title || 'un autre article'} », qui n'est plus en ligne.\n\nEst-ce bien le MÊME article qui te revient (litige, retour, annulation) ?\n\nSi oui, il reprend son prix d'achat et ses infos. Si c'est un autre article, prends le N°${nextNumero} : un numéro ne se réattribue jamais.`,
      ok: 'Oui, le même article revient', cancel: `Non — N°${nextNumero}`,
    });
    if (!meme) { updatePair(item, { numero: String(nextNumero), manuelAt, ...changeAMain(item, avant, String(nextNumero), manuelAt, opts) }); recordUsed(nextNumero); await demanderPrixAchat(item, String(nextNumero)); return; }
    setNumeros(prev => {
      const u = { ...prev }; const a = u[autres[0]] || {};
      u[moi] = { ...(u[moi] || {}),
        buyPrice: a.buyPrice, buyFromId: a.buyFromId ?? null, buyFrom: a.buyFrom ?? null,
        fees: a.fees, size: (u[moi] || {}).size ?? a.size ?? null,
        numero: n, title: item.title, photo: item.photo || null, photoK: photoKey(item.photo) || null,
        price: item.price ?? null, accountId: item._acc?.vinted_user_id,
        auto: false, repriseAt: new Date().toISOString(), manuelAt, repriseDe: String(autres[0]), ...changeAMain(item, avant, n, manuelAt, opts) };
      delete u[autres[0]];                       // l'ancienne fiche devient celle-ci (`repriseDe` le dit à la base)
      save('vinted_annonce_numeros', u); return u;
    });
    recordUsed(n);
    toast(`N°${n} repris — les infos de l'ancien article sont revenues avec lui`);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_11⟧*/const feesOf = (e) => e ? eur(e.fees) : 0;/*⟦←/⟧*/
  /*⟦← App.jsx #h1_12⟧*/const marquerCartonVerifie = (id, cle) => {
    setNumeros((prev) => {
      const c = prev[id];
      if (!c || cleNum(c.numero) !== cle) return prev;
      const u = { ...prev, [id]: { ...c, cartonVerifie: new Date().toISOString() } };
      save('vinted_annonce_numeros', u); return u;
    });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_13⟧*/const autresPorteurs = (it) => {
    const moi = String(it.id), cle = cleNum((numeros[moi] || {}).numero);
    return cle ? (porteursNum[cle] || []).filter((p) => !(p.type === 'annonce' && String(p.id) === moi)) : [];
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_14⟧*/const blocMasquees = () => (masqueesBloc.presentes.length + masqueesBloc.parties.length) > 0 && (
          <div data-masquees-bloc={masqueesBloc.presentes.length} style={{marginBottom:12,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 13px'}}>
            <button type="button" onClick={()=>setMasqOpen(v=>!v)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',border:'none',background:'transparent',padding:0,cursor:'pointer',fontFamily:'inherit'}}>
              <span aria-hidden="true" style={{flexShrink:0,color:C.muted,display:'flex'}}><Icon name="eye" size={17}/></span>
              <span style={{flex:1,minWidth:0}}>
                <span style={{display:'block',fontSize:13,fontWeight:600,color:C.text}}>{masqueesBloc.presentes.length > 0
                  ? `${motArticle(masqueesBloc.presentes.length)} masqué${motsVendeur().e}${masqueesBloc.presentes.length>1?'s':''} par Vinted, compté${motsVendeur().e}${masqueesBloc.presentes.length>1?'s':''} sur ton étagère`
                  : `${motArticle(masqueesBloc.parties.length)} masqué${motsVendeur().e}${masqueesBloc.parties.length>1?'s':''} par Vinted, déclaré${motsVendeur().e}${masqueesBloc.parties.length>1?'s':''} partie${masqueesBloc.parties.length>1?'s':''}`}</span>
                <span style={{display:'block',fontSize:11,color:C.muted,marginTop:2}}>Plus en vente, mais leur numéro reste protégé. Si l'une n'est plus chez toi, dis-le.</span>
              </span>
              <span style={{color:C.muted,fontSize:17}}>{masqOpen?'▾':'▸'}</span>
            </button>
            {masqOpen && (
              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:7}}>
                {[...masqueesBloc.presentes.map(it=>({it,partie:false})), ...masqueesBloc.parties.map(it=>({it,partie:true}))].slice(0,60).map(({it,partie})=>(
                  <div key={it.id} data-masquee-ligne={String(it.id)} data-masquee-partie-faite={partie?'1':undefined} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderTop:`1px solid ${C.border}`}}>
                    <div style={{width:34,height:34,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden'}}>
                      {it.photo && <PhotoVinted src={it.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>N°{(numeros[it.id]||{}).numero} · {it.title||'—'}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:1}}><AcctTag acc={it._acc} name={accNameOf(it._acc)}/>{partie?' · déclarée partie':''}</div>
                    </div>
                    {partie
                      ? <button type="button" data-masquee-encore={String(it.id)} onClick={()=>masqueeEncoreLa(it)} style={{flexShrink:0,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'6px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Elle est encore là</button>
                      : <button type="button" data-masquee-partie={String(it.id)} onClick={()=>masqueePlusLa(it)} style={{flexShrink:0,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'6px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Elle n'est plus là</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
  );/*⟦←/⟧*/
  /*⟦← App.jsx #h1_15⟧*/const vuNeuf = (ids) => setNeufsVus((p) => { const u = { ...p }; for (const [id, n] of ids) u[id] = cleNum(n); try { localStorage.setItem('vrm_num_neufs_vus', JSON.stringify(u)); } catch (_) {} return u; });/*⟦←/⟧*/
  /*⟦← App.jsx #h1_16⟧*/const blocNouveaux = () => numerosNeufs.length > 0 && (
    <div className="vrm-ann-neufs" data-num-neufs={numerosNeufs.length}>
      <div className="vrm-ann-neufs-tete">{numerosNeufs.length > 1 ? `${numerosNeufs.length} mises en ligne numérotées par VRM` : 'Une mise en ligne numérotée par VRM'}</div>
      <div className="vrm-ann-neufs-phrase">Touche le N° pour le changer. Prix d'achat : facultatif.</div>
      {numerosNeufs.slice(0, 6).map((it) => { const f = numeros[it.id] || {};
        // (6 nov.) LE PRIX D'ACHAT AU MÊME GESTE (src/prixAuNumerotage.js) : un champ vide,
        // jamais pré-rempli ; une suggestion d'achat est PROPOSÉE à côté (« Relier · 32 € »),
        // SON tap relie. Écrit par `ecrirePrixTape`, l'écriture de la saisie en série.
        const aPrix = !prixADemander(f, prixAchatDe(f, buyByNum));
        const sg = !aPrix && Array.isArray(fillBuyAchats.items) && fillBuyAchats.items.length ? meilleureSuggestion({ item: it, achats: fillBuyAchats.items, liens: liensAchats, marqueDe: extractBrand, couleursDe: extractColors, modeleDe: extractModel }) : null;
        const sgAff = sg ? suggestionNumerotage(texteSuggestion(sg, propositionSuggestion(sg.achat)), montant) : null;
        return (
        <div key={it.id} data-num-neuf={String(it.id)} className="vrm-ann-neufs-ligne">
          {it.photo ? <PhotoVinted src={it.photo} alt="" loading="lazy" decoding="async" className="vrm-ann-neufs-photo"/> : <PhotoVide taille={36} rayon={12}/>}
          <span className="vrm-ann-neufs-num">
            <EnLigne data="numero-neuf" value={f.numero} onCommit={(v, avant) => poserNumero(it, v, avant)} inputMode={clavierNum()} placeholder={String(nextNumero)} largeur={56} titre="Changer ce numéro" rendu={<Numero n={f.numero} titre={`Numéro ${f.numero} — le changer`}/>}/>
          </span>
          <span className="vrm-ann-neufs-nom">{it.title || '—'}</span>
          <Bouton variante="secondaire" taille="petit" data-num-neuf-ok={String(it.id)} onClick={() => vuNeuf([[it.id, f.numero]])} style={{ flexShrink: 0 }}>C'est bon</Bouton>
          <div className="vrm-ann-neufs-prix" data-num-neuf-prix={aPrix ? 'connu' : 'vide'}>
            {aPrix ? <span className="vrm-ann-neufs-prix-connu">{prixAchatDe(f, buyByNum) != null ? `Prix d'achat ${montant(prixAchatDe(f, buyByNum))}` : 'Achat relié'}</span> : <>
              <label className="vrm-ann-neufs-prix-champ">
                <span>Prix d'achat</span>
                <ChampSaisie value="" data-prix-neuf={String(it.id)} onCommit={(v) => ecrirePrixTape(it, v, f.numero)} placeholder="facultatif" inputMode="decimal" aria-label={`Prix d'achat de la N°${f.numero}`}/>
                <span aria-hidden="true">€</span>
              </label>
              {sgAff ? <Bouton variante="discret" taille="petit" icone="link" data-num-neuf-relier={String(sg.achat.transaction_id)} title={sgAff.detail} onClick={() => relierAchatAnnonce(it, sg.achat)}>{sgAff.bouton}</Bouton> : null}
              {sgAff ? <Bouton variante="discret" taille="petit" icone="search" data-num-neuf-autre={String(sg.achat.transaction_id)} onClick={() => openPicker({ ...it, _autre: String(sg.achat.transaction_id) })}>Autre achat</Bouton> : null}
            </>}
          </div>
        </div>); })}
      {numerosNeufs.length > 1 && <Bouton variante="discret" data-num-neufs-tout="" onClick={() => vuNeuf(numerosNeufs.map((it) => [it.id, (numeros[it.id] || {}).numero]))}>{numerosNeufs.length > 6 ? `Tout est bon (${numerosNeufs.length})` : 'Tout est bon'}</Bouton>}
    </div>);/*⟦←/⟧*/
  /*⟦← App.jsx #h1_17⟧*/const confirmerCarton = async (it) => {
    const f = numeros[it.id] || {};
    const autres = autresPorteurs(it);
    if (autres.length) {
      // On ne confirme pas un numéro qu'un autre carton présent porte déjà.
      await donnerNumeroNeuf(it, `Le N°${f.numero} est aussi sur ${autres.map(nomPorteur).join(' et ')}. Deux articles au même numéro, c'est le mauvais qui part.`);
      return;
    }
    marquerCartonVerifie(String(it.id), cleNum(f.numero)); toast(`N°${f.numero} confirmé pour « ${it.title} »`);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_18⟧*/const corrigerCarton = async (it, valeur) => {
    const brut = String(valeur || '').trim();
    const cle = cleNum(brut);
    if (!cle || !NUM_OK.test(cle)) { toast('Un numéro, ce sont des chiffres (125) ou 1 à 3 lettres suivies de chiffres (B125).'); return; }
    const n = /^\d+$/.test(brut) ? brut : cle;
    const moi = String(it.id), f = numeros[moi] || {};
    if (cleNum(f.numero) === cle) { marquerCartonVerifie(moi, cle); return; }
    const autreId = Object.keys(numeros).find((k) => k !== moi && cleNum((numeros[k] || {}).numero) === cle);
    const autre = autreId ? aVerifierCarton.find((x) => String(x.id) === autreId) : null;
    if (autre) {
      // Le N° du carton est aujourd'hui sur une AUTRE paire renumérotée pendant
      // la panne : son N° est donc probablement faux lui aussi. Elle reçoit un
      // numéro NEUF (jamais un numéro déjà servi) et reste dans la liste.
      if (refusHorsLigne('numero')) return;
      const prov = String(nextNumero);
      const ok = await askConfirm({
        title: `Le N°${n} est sur « ${autre.title} »`,
        desc: `Cet article a aussi été renuméroté pendant la panne : son N°${n} est sans doute faux.\n\nIl prend le N°${prov} en attendant que tu regardes SON étiquette (il reste dans la liste), et « ${it.title} » prend le N°${n}.`,
        ok: `Oui, le N°${n} est à « ${it.title} »`, cancel: 'Annuler',
      });
      if (!ok) return;
      const now = new Date().toISOString();
      updatePair(autre, { numero: prov, auto: true, cartonVerifie: null });
      recordUsed(prov);
      updatePair(it, { numero: n, manuelAt: now, cartonVerifie: now });
      recordUsed(n);
      toast(`N°${n} → « ${it.title} » · « ${autre.title} » passe au N°${prov} (à vérifier)`);
      return;
    }
    // Sinon : le geste habituel du champ N° (il demande quand le numéro a déjà
    // servi ou qu'une autre paire le porte encore), puis « vérifié » s'il a été posé.
    await poserNumero(it, brut, f.numero, { carton: true });
    setTimeout(() => marquerCartonVerifie(moi, cle), 700);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_19⟧*/const masqueeEncoreLa = (it) => {
    const id = String(it.id), n = cleNum((numeros[id] || {}).numero);
    setPairsLost(prev => {
      const u = { ...prev };
      for (const k of Object.keys(u)) {
        const e = u[k];
        if (e && e.id != null ? String(e.id) === id : (n && cleNum(k) === n && annonceDeclareePartie(id, numeros, { [k]: e }))) delete u[k];
      }
      save('vinted_pairs_lost', u); return u;
    });
    toast('Elle compte de nouveau sur ton étagère');
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_20⟧*/const applyReprise = async (r)=>{
    const oldNum = String(r.orphan.e.numero), autoNum2 = String(r.current.numero);
    const q = r.vendue
      ? `Cet article t'est REVENU (litige, retour, annulation) ?\n\n« ${r.item.title} »\n\nIl a été vendu sous le N°${oldNum}. Si tu l'as remis dans SA boîte, il peut le reprendre — sinon garde le N°${autoNum2}, qui est neuf.`
      : `Cette annonce est bien ton article N°${oldNum} ?\n\n« ${r.item.title} »\n\nElle reprendra le N°${oldNum} (celui écrit sur sa boîte).\nLe N°${autoNum2}, créé automatiquement, reste brûlé : il ne sera donné à aucun autre article.`;
    if (!await askConfirm(q)) return;
    setNumeros(prev => {
      const u = { ...prev };
      u[r.item.id] = { ...(u[r.item.id] || {}), ...r.orphan.e, numero: oldNum, title: r.item.title, photo: r.item.photo || null, photoK: photoKey(r.item.photo) || null, price: r.item.price ?? null, accountId: r.item._acc?.vinted_user_id, auto: false, repriseAt: new Date().toISOString(), manuelAt: new Date().toISOString(), repriseDe: String(r.orphan.key) };
      delete u[r.orphan.key]; // l'ancienne fiche devient l'annonce actuelle
      save('vinted_annonce_numeros', u);
      return u;
    });
    // ⚠️ ON NE REND PLUS LE NUMÉRO AU POT. Un numéro donné une fois est pris à vie
    //    (règle de Julien) : le rendre, c'est risquer qu'une autre paire le
    //    reçoive alors que la première peut revenir en litige. Un numéro « brûlé »
    //    ne coûte rien — le compteur monte, c'est normal ; une collision, si.
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_21⟧*/const baisseEbayDe = (r) => {
    const num = numeros[r.it.id]?.numero; if (!num || !(ebayVivantes instanceof Map)) return null;
    const cle = cleNum(num);
    const e = ebayVivantes.get(cle); if (!e) return null;
    if (e.ambigu) return { ambigu: e.ambigu };
    if ((fichesParNum.get(cle) || 0) > 1) return { ambigu: 'numero' };
    // Déjà baissée pour CE prix Vinted (mémo synchronisé) : rien de neuf à proposer.
    const memo = baissesEbay && baissesEbay[e.itemId];
    const memoValable = !!(memo && Number(memo.vinted) === Number(r.price));
    // ⚠️⚠️ (revue du 8 octobre) LE PRIX eBAY D'AUJOURD'HUI. Changer un prix
    //    (`revise`) ne réécrit pas `ebay_listings` : tant qu'eBay n'a pas été
    //    relu, la liste garde le prix d'AVANT la baisse. L'écran affichait
    //    « 60 € aujourd'hui » pour une annonce à 53 €, et — Vinted baissé
    //    ensuite — proposait de « baisser » de 53 à 56 €, une HAUSSE. Le mémo
    //    porte le prix posé par VRM : il fait foi tant que la liste n'a pas été
    //    relue APRÈS lui (date de la liste inconnue ⇒ le mémo, que VRM a posé).
    const memoEbay = memo && Number(memo.ebay) > 0 ? Number(memo.ebay) : null;
    const capL = Number.isFinite(ebayVivantes.cap) ? ebayVivantes.cap : NaN;
    const prixConnu = memoEbay != null && !(Number.isFinite(capL) && Number.isFinite(Number(memo.at)) && capL > Number(memo.at)) ? memoEbay : e.prix;
    const fait = ebayBaisse[e.itemId] || (memoValable ? { etat: 'ok', prix: prixConnu, memo: true } : undefined);
    const prixActuel = fait && fait.etat === 'ok' && !fait.memo ? fait.prix : prixConnu;
    // (12 nov.) La même règle mesurée (src/conseilPrix.js) : −10 % au plus, jamais sous l'achat + 10 %.
    const sugg = baisseProportion(prixActuel, r.conseil, prixAchatDe(numeros[r.it.id], buyByNum)) ?? prixActuel;
    // (9 octobre) La règle d'offre de l'annonce eBay : la MÊME garde que la
    // carte (`prixCompatibleRegle`, §11) — un prix à ou sous le seuil connu
    // n'est pas proposé (eBay le refuserait).
    const regle = ebayVivantes.regles ? etatRegleOffre({ itemId: e.itemId, price: prixActuel, _compte: e.compte }, ebayVivantes.regles.map, ebayVivantes.regles.illisibles) : null;
    const garde = prixCompatibleRegle(sugg, regle);
    // Jamais « baisser » à un prix supérieur ou égal au prix eBay connu.
    return { ...e, prix: prixConnu, prixActuel, sugg, utile: !memoValable && sugg < prixActuel && garde.ok, fait, regle, bloqueRegle: !memoValable && sugg < prixActuel && !garde.ok ? regle : null };
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_22⟧*/const baisserSurEbay = async (e, rp) => {
    if (!e || !e.itemId || !(e.sugg > 0)) return;
    const prix = (n) => Number(n).toFixed(2).replace('.', ',') + '\u00a0€';
    const num = rp && numeros[rp.it.id] ? numeros[rp.it.id].numero : '';
    const g = prixCompatibleRegle(e.sugg, e.regle); if (!g.ok) return;
    const okc = await askConfirm({ title: `Baisser le prix sur eBay : ${prix(e.prixActuel)} → ${prix(e.sugg)} ?`,
      desc: `L'annonce eBay « ${e.titre || e.itemId} »${num ? ` (N°${num})` : ''} change tout de suite. Sur Vinted, c'est toi qui le fais (bouton « Baisser »).`
        + (e.regle && e.regle.etat === 'connue' ? `\n\nTa règle d'offre (dès ${prix(e.regle.accepte)}) peut tomber avec le changement de prix : VRM la relit après et te le dit.` : ''), ok: 'Baisser sur eBay' });
    if (!okc) return;
    setEbayBaisse((m) => ({ ...m, [e.itemId]: { etat: 'envoi', prix: e.sugg } }));
    const res = resultatReviseEbay(await appelEbay({ action: 'revise', itemId: e.itemId, price: e.sugg, prixVu: e.prixActuel, confirme: true, ...corpsCompteEbay(e.compte) }));
    if (res.etat === 'ok') {
      // Ce que le changement de prix a fait à la règle d'offre (relue par la route).
      setEbayBaisse((m) => ({ ...m, [e.itemId]: { etat: 'ok', prix: e.sugg, regleMsg: res.msg || '', regleTon: res.ton || 'ok' } }));
      // Le prix Vinted de référence de CETTE baisse : pas de nouvelle proposition
      // tant qu'il n'a pas bougé (gardé aux 200 dernières annonces).
      setBaissesEbay((m) => {
        const n = { ...(m || {}), [e.itemId]: { vinted: Number(rp && rp.price), ebay: e.sugg, at: Date.now() } };
        const garde = Object.entries(n).sort((a, b) => ((b[1] && b[1].at) || 0) - ((a[1] && a[1].at) || 0)).slice(0, 200);
        const out = Object.fromEntries(garde);
        save('vrm_ebay_baisses', out);
        return out;
      });
    } else setEbayBaisse((m) => ({ ...m, [e.itemId]: { etat: res.etat, prix: e.prixActuel, msg: res.msg } }));
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_23⟧*/const choisirNumeroEcrit = (l, prendre) => {
    const it = (listings.items || []).find((x) => String(x.id) === String(l.id)); if (!it) return;
    const now = new Date().toISOString();
    if (prendre) {
      if (!numeroReprenable(l.lu)) { toast(`N°${l.lu} est un ancien numéro : il ne se redonne pas.`); return; }
      updatePair(it, { numero: l.lu, auto: false, manuelAt: now, ecrit: l.lecture && l.lecture.source, ecritAt: now, ecritRefuse: null, reattribue: { de: l.connu, vers: l.lu, at: now } });
      recordUsed(l.lu);
      toast(`« ${it.title} » → N°${l.lu} · écris-le là où il est rangé`);
    } else {
      updatePair(it, { ecritRefuse: l.lu });
      toast(`« ${it.title} » garde le N°${l.connu}. Corrige son annonce pour qu'elle dise « N° ${l.connu} ».`);
    }
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_24⟧*/const repondreRemise = async (r, o) => {
    const it = (listings.items || []).find((x) => String(x.id) === r.nouvelle); if (!it) return;
    if (o) { await poserNumero(it, o.numero, (numeros[it.id] || {}).numero, { carton: true, memePaire: true }); return; }
    const n = { ...remiseRefus, [r.nouvelle]: [...new Set([...(remiseRefus[r.nouvelle] || []), ...r.options.map((x) => x.ancienne)])] };
    setRemiseRefus(n); save('vrm_remise_refus', n);
    toast('C’est noté : VRM ne le propose plus pour cette annonce.');
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_25⟧*/const vignetteRemise = (src, num, alt) => (
    <span className="vrm-remise-photo">{src && !imgMortes.has(src) ? <PhotoVinted src={src} alt={alt} loading="lazy" onError={() => noterImgMorte(src)}/> : <PhotoVide taille={40}/>}{num ? <span className="vrm-remise-num">N°{num}</span> : null}</span>
  );/*⟦←/⟧*/
  /*⟦← App.jsx #h1_26⟧*/const photoNouvelleRemise = (id) => { const it = (listings.items || []).find((x) => String(x.id) === String(id)); return (it && it.photo) || ''; };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_27⟧*/const photoAncienneRemise = (id) => { const f = numeros[id] || {}; return f.photo || ''; };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_28⟧*/const carteRemise = (r, surVignette) => {
    const o0 = r.options[0];
    return (
      <div key={r.nouvelle} className={'vrm-remise-carte' + (surVignette ? ' is-vignette' : '')} data-remise-ligne={r.nouvelle} data-remise-force={o0.force} data-remise-sur-vignette={surVignette ? '1' : undefined}>
        <div className="vrm-remise-photos">
          {vignetteRemise(photoAncienneRemise(o0.ancienne), o0.numero, o0.titre || 'Ancienne annonce')}
          <span className="vrm-remise-egal" aria-hidden="true">=</span>
          {vignetteRemise(photoNouvelleRemise(r.nouvelle), '', r.titre || 'Nouvelle annonce')}
        </div>
        <div className="vrm-remise-q"><b>Même {motsVendeur().nom}{r.options.length === 1 ? ` que N°${o0.numero}` : ''} ?</b>
          <Pourquoi label="Pourquoi ?" titre={`Même ${motsVendeur().nom} ?`}>
            {r.titre || 'Nouvelle annonce'} — {r.options.length === 1 ? <>c’est {motsVendeur().meme} que N°{o0.numero} « {o0.titre || 'ancienne annonce'} » ?</> : `c’est ${motsVendeur().meme} qu’${motsVendeur().une} de ${motsVendeur().celles}-ci ?`}
            {' '}{PHRASE_REMISE[o0.force]}
            {r.plusieurs && r.options.length > 1 ? ' Plusieurs anciennes lui ressemblent : seule l’étiquette dit laquelle.' : ''}
            {r.concurrence ? ' Une autre nouvelle annonce lui ressemble aussi.' : ''}
            {' '}Tu as supprimé une annonce, puis tu en as mis une nouvelle. Si c’est {motsVendeur().meme}, {motsVendeur().elle} garde son numéro : rien à réécrire là où {motsVendeur().elle} est rangé{motsVendeur().e}.
          </Pourquoi>
        </div>
        <div className="vrm-remise-boutons">
          {r.options.map((o) => <Bouton key={o.ancienne} variante="secondaire" data-remise-oui={o.numero} title={o.titre} onClick={() => repondreRemise(r, o)}>{r.options.length > 1 ? `Oui, N°${o.numero}` : 'Oui'}</Bouton>)}
          <Bouton variante="secondaire" data-remise-non={r.nouvelle} onClick={() => repondreRemise(r, null)}>Non</Bouton>
        </div>
      </div>
    );
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_29⟧*/const blocRemiseEnLigne = () => {
    const tete = remisesParts.tete; const nSur = remisesParts.sur.size;
    if (!tete.length && !nSur) return null;
    // (10 nov., Julien : « je n'aime pas du tout les pop-up ») Une PROPOSITION est une carte VISUELLE :
    // les deux photos côte à côte (l'ancienne paire et la nouvelle annonce), « Même paire ? » et [Oui] [Non].
    // Aucun paragraphe ; la règle (photo / ressemblance, vérifier l'étiquette) reste derrière ⓘ.
    // SON clic relie (`repondreRemise` → `poserNumero`), rien d'autre. `data-remise-bloc` : la cible d'« À trancher ».
    const allerVignette = () => { try { const el = document.querySelector('[data-remise-sur-vignette]'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const b = el.querySelector('[data-remise-oui]'); if (b) b.focus({ preventScroll: true }); } } catch (_) {} };
    return (<>
      {nSur > 0 && (
        <span className="vrm-pop-puce-hote" data-remise-resume={nSur} data-remise-bloc={tete.length ? undefined : nSur}>
          <button type="button" className="vrm-pop-puce is-ambre" onClick={allerVignette} aria-label={`${nSur} annonce${nSur > 1 ? 's' : ''} : même ${motsVendeur().nom} qu’une ancienne ? Voir dans la grille`}>
            <span className="vrm-pop-puce-n">{nSur}</span>
            <span className="vrm-pop-puce-txt">Même {motsVendeur().nom} ?</span>
            <svg className="vrm-pop-puce-chev" width="7" height="12" viewBox="0 0 8 14" aria-hidden="true" focusable="false"><path d="M1.2 1.2 6.8 7l-5.6 5.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </span>
      )}
      {tete.length > 0 && (
        <div className="vrm-remise-cartes" data-remise-bloc={tete.length} role="group" aria-label={`Annonces remises en ligne : même ${motsVendeur().nom} ?`}>
          {tete.slice(0, 20).map((r) => carteRemise(r, false))}
        </div>
      )}
    </>);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_30⟧*/const blocNumeroEcrit = () => {
    if (!ecritOnUi || !apercuEcrit) return null;
    const av = apercuEcrit.lignes.filter((l) => l.etat === 'contredit' || l.etat === 'ambigu' || l.etat === 'archive');
    const sans = apercuEcrit.lignes.filter((l) => l.etat === 'rien');
    if (!av.length && !sans.length) return null;
    // (9 nov., lot AI) Une puce (« 2 numéros écrits à vérifier › ») ; la pop-up porte le bloc d'avant
    // et ses boutons (« Garder N°X » / « Prendre N°Y ») : SON clic décide, rien d'autre.
    const titreEcrit = av.length > 0 ? `${av.length} numéro${av.length>1?'s':''} écrit${av.length>1?'s':''} à vérifier` : `${sans.length} annonce${sans.length>1?'s':''} sans N° écrit`;
    return (
      <PuceProposition n={av.length > 0 ? av.length : sans.length} libelle={av.length > 0 ? `numéro${av.length>1?'s':''} écrit${av.length>1?'s':''} à vérifier` : `annonce${sans.length>1?'s':''} sans N° écrit`}
        nom="numero-ecrit" titre={titreEcrit} attrs={{ 'data-numero-ecrit-bloc': av.length, 'data-numero-ecrit-sans': sans.length }}>
        <div data-numero-ecrit-detail={av.length}>
        <p className="vrm-pop-note">Tu numérotes toi-même : VRM ne change aucun numéro tout seul.</p>
        {av.slice(0, 40).map((l) => (
          <div key={l.id} data-numero-ecrit-ligne={l.id} data-numero-ecrit-etat={l.etat} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:`1px solid ${C.border}`,marginTop:6,flexWrap:'wrap'}}>
            <div style={{flex:'1 1 180px',minWidth:0}}>
              <div style={{fontSize:13,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.titre || 'Annonce'}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{l.etat === 'contredit' ? <>Écrit : <b style={{color:C.text}}>N°{l.lu}</b> · VRM : <b style={{color:C.text}}>N°{l.connu}</b></> : l.etat === 'ambigu' ? (l.lecture && l.lecture.raison) : PHRASE_NUMERO_ECRIT[l.etat]}</div>
            </div>
            {l.etat === 'contredit' && <div style={{display:'flex',gap:6,flexShrink:0}}>
              <Bouton variante="secondaire" data-numero-ecrit-garder={l.id} onClick={() => choisirNumeroEcrit(l, false)}>Garder N°{l.connu}</Bouton>
              <Bouton variante="secondaire" data-numero-ecrit-prendre={l.id} onClick={() => choisirNumeroEcrit(l, true)}>Prendre N°{l.lu}</Bouton>
            </div>}
          </div>
        ))}
        {sans.length > 0 && <div data-numero-ecrit-rien={sans.length} style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.5}}>{sans.length} annonce{sans.length>1?'s':''} sans N° écrit ni numéro VRM : termine sa description par « N° 123 ».{sans.some((l) => !l.descSue) ? ' Ouvre-la une fois sur vinted.fr pour que VRM lise sa description.' : ''}</div>}
        </div>
      </PuceProposition>
    );
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_31⟧*/const relierAchatAnnonce = async (it, a) => {
    const w = await ecritureRelierAchat(a); if (!w) return;
    updatePair(it, w);
    toast(`Achat relié${w.buyPrice ? ` · ${String(w.buyPrice).replace('.', ',')}\u00a0€` : ''}`);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_32⟧*/const propositionSuggestion = (a) => (a ? propositionPrixAchat({ identite: { achat: a, par: 'suggestion' }, ventilationDe: ventilationDeTx, estLot: estLotPropose }) : null);/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/<>
        {/* (26 oct., « trop brouillon ») Dans l'espace Vinted, l'onglet « Annonces »
            dit déjà où l'on est : pas de second titre. */}
        {!dansPlateforme && <ScreenHead icon="vitrine" title={tr('annonces.annoncesLigne')} />}
        <NoAcc/>
        {/* (2 nov.) Sans compte Vinted, rien à compléter : « 0 à relire sur Vinted » n'était qu'un zéro de plus. */}
        {/* (3 nov., critique #7) « Annonces à compléter » et « Offres automatiques » vivent dans « Outils » (…). */}
        {false && astuceNum && listings.items?.length>0 && (
          <div data-astuce-numeros style={{display:'flex',gap:8,alignItems:'center',background:'var(--vrm-b-teinte)',borderRadius:12,padding:'6px 4px 6px 12px',/* (2 nov.) au téléphone la phrase passe sur deux lignes : elle touchait le bord */margin:'0 0 12px',fontSize:13,lineHeight:1.45,color:C.muted}}>
            <span aria-hidden="true" style={{display:'flex',color:C.muted}}><Icon name="tag" size={16}/></span>
            <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}><span data-numero-phrase="">{tr('annonces.chaqueArticle')} <b style={{color:C.text,fontWeight:600}}>{tr('annonces.numero')}</b>{tr('annonces.jamaisRedonne')}</span> <Pourquoi label={tr('annonces.quoiSert')}>Il suit l’ordre de mise en ligne : il sert à retrouver {motsVendeur().le} sur ton étagère, sur Leboncoin et sur eBay. Il se change d’un clic sur la carte et n’est jamais donné à {motsVendeur().autre}.</Pourquoi></div>
            <button type="button" aria-label={tr('annonces.aiComprisMasquer')} onClick={()=>{ save('vrm_astuce_numeros', false); setAstuceNum(false); }} style={{flexShrink:0,border:'none',background:'transparent',color:C.muted,cursor:'pointer',fontSize:17,lineHeight:1,minWidth:44,minHeight:44,padding:0,fontFamily:'inherit'}}>✕</button>
          </div>
        )}
        {/* (27 oct.) Acceptation automatique des offres — interrupteur, éteint par
            défaut. Le risque est dit à l'allumage (askConfirm). L'extension doit
            savoir le faire (capacité `offresauto`) et tourner dans CE Chrome. */}
        {/* (29 oct.) Julien : « que ce ne soit pas un bouton comme ça, j'aime pas avec
            tout le texte, c'est moche ». UNE ligne courte (nom · état · ⓘ · interrupteur) ;
            le fonctionnement et le message de refus vivent derrière ⓘ. Le comportement ne
            change pas (`basculerOffresAuto` : confirmation à l'allumage, éteint par défaut).
            Seul ce qui demande un GESTE reste visible : l'extension qui ne peut pas. */}
        <div className="vrm-workbar vrm-ann-workbar">
        {/* (5 nov., chantier C — revue 2.10) LA BARRE D'OUTILS : une forme pour tout.
            La recherche partagée (`ChampRecherche`, micro intégré), puis trois boutons du
            MÊME dessin (fond teinté, rayon des commandes, 36 px souris / 44 px doigt) :
            Trier · Republier… · ⋯ Outils. Au téléphone, une rangée : recherche, puis les
            trois en icône (leur nom dans aria-label). Styles : styles-annonces-coherence.css. */}
        {listings.items?.length>0 && <div className="vrm-ann-toolbar vrm-annbar" data-ann-barre="">
            <ChampRecherche className="vrm-annbar-recherche" valeur={annSearch} onChange={setAnnSearch} placeholder={tr('annonces.rechercher')} label={tr('annonces.rechercherAnnonceTitre')} micro data-ann-recherche=""/>
            <div className="vrm-annbar-gestes">
            <label className="vrm-annbar-bouton vrm-annbar-tri" data-ann-tri={annSort} title={tr('annonces.trierAnnonces')}>
              <Icon name="filter" size={17}/>
              <span className="vrm-annbar-mot">{({oldest:'Les plus anciennes',recent:'Ordre Vinted',price_desc:'Prix décroissant',price_asc:'Prix croissant',favs:'Plus de favoris',views:'Plus de vues',boost:'Vues sans favoris',sleeping:'En ligne depuis longtemps',nonum:'Sans numéro'})[annSort] || tr('annonces.trier')}</span>
            <select className="vrm-ann-tri" aria-label={tr('annonces.trierAnnonces')} value={['oldest','recent','price_desc','price_asc','favs','views','boost','sleeping','nonum'].includes(annSort)?annSort:''} onChange={e=>setAnnSort(e.target.value)}>
              {!['oldest','recent','price_desc','price_asc','favs','views','boost','sleeping','nonum'].includes(annSort) && <option value="" disabled>{tr('annonces.trier')}</option>}
              <option value="oldest">{tr('annonces.plusAnciennes')}</option>
              <option value="recent">{tr('annonces.ordreVinted')}</option>
              <option value="price_desc">{tr('annonces.prixDecroissant')}</option>
              <option value="price_asc">{tr('annonces.prixCroissant')}</option>
              {(annStats.hasFav || annSort==='favs') && <option value="favs">{tr('annonces.plusFavoris')}</option>}
              {(annStats.hasView || annSort==='views') && <option value="views">{tr('annonces.plusVues')}</option>}
              {(annStats.hasView || annSort==='boost') && <option value="boost">{tr('annonces.vuesSansFavoris')}</option>}
              {(annStats.sleeping>0 || annSort==='sleeping') && <option value="sleeping">{tr('annonces.ligneDepuisLongtemps')}</option>}
              <option value="nonum">{tr('annonces.sansNumero')}</option>
            </select>
            </label>
            {/* (5 nov., chantier C — revue 2.5) « Republier… » mène à la vue « Sélectionner » :
                on coche, puis UNE feuille « Actions » (Republier · Modifier prix ou titre ·
                Mettre en brouillon · Mettre en ligne). L'ancienne feuille « Republier et
                brouillons » (un second chemin, d'autres mots) est retirée. */}
            {/* (9 nov., lot AL) … et depuis que « Republier » est une vue d'Annonces, il mène à ELLE
                (cocher, puis « Republier » ouvre l'atelier) ; « Sélectionner » garde la feuille « Actions ». */}
            <button type="button" className="vrm-annbar-bouton" data-actions-ouvrir="" aria-pressed={annSort==='republier'} aria-label={tr('annonces.republierAnnonces')} title={tr('annonces.republierCocheAnnonces')}
              onClick={()=>setAnnSort('republier')}><Icon name="sync" size={17}/><span className="vrm-annbar-mot">{tr('annonces.republier')}</span></button>
            <div className="vrm-ann-outils">
              <button type="button" className="vrm-annbar-bouton" aria-label={tr('annonces.outilsAnnonces')} onClick={(e)=>{ try { const r=e.currentTarget.getBoundingClientRect(); setAnnToolsCote(r.right>=246?'droite':'gauche'); } catch(_){} setAnnToolsOpen(v=>!v); }} aria-expanded={annToolsOpen} title={tr('annonces.outilsOffresAutomatiques')}>
                <Icon name="more" size={17}/><span className="vrm-annbar-mot vrm-ann-outils-mot">{tr('ventes.outils')}</span></button>
              {annToolsOpen && (<>
                <div className="vrm-menu-voile" onClick={()=>setAnnToolsOpen(false)} style={{position:'fixed',inset:0,zIndex:70}}/>
                {/* Le menu s'ancrait à GAUCHE du bouton, posé au bord droit de la ligne :
                    ses quatre outils sortaient de l'écran (1512 px : 1332→1562 pour une zone
                    visible jusqu'à 1452 ; 390 px : 274→504), leurs noms coupés, sans erreur.
                    Il s'ancre à droite comme le menu de l'écran Ventes — sauf si le bouton,
                    passé à la ligne, est trop près du bord gauche pour cela. */}
                <div className="vrm-menu-flottant" data-outils-annonces="" style={{position:'absolute',...(annToolsCote==='gauche'?{left:0}:{right:0}),top:'calc(100% + 6px)',zIndex:71,minWidth:230,maxWidth:'calc(var(--vrm-vw100, 100vw) - 32px)',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:C.shadowLg||'0 8px 24px rgba(0,0,0,.2)',padding:6,display:'flex',flexDirection:'column',gap:2}}>
                  <div className="vrm-outils-annonces-haut" data-outils-haut="">
        {listings.items?.length>0 && (() => {
          const nbMini = nbAccepterDes(annBase, numeros);
          // (2 nov.) `offresgarde` (5.308) : une extension plus ancienne accepterait une
          // offre sur une paire vendue ailleurs — elle est dite « à mettre à jour ».
          const ext = offresAuto ? extSait('offresgarde') : 'ok';
          // (29 oct., revue) Court, et il passe à la ligne s'il le faut : au téléphone il
          // était coupé (« Allumées · 2 annonces avec u… ») — justement le nombre.
          const etat = !offresAuto ? 'Éteintes' : nbMini === 0 ? 'Allumées · aucun « Accepter dès » rempli' : `Allumées · ${nbMini} annonce${nbMini > 1 ? 's' : ''} avec « Accepter dès »`;
          return (
          <div data-offres-auto-carte data-offres-auto-etat={offresAuto ? 'on' : 'off'} data-offres-auto-mini={offresAuto ? String(nbMini) : undefined} className={`vrm-offres-auto${offresAuto ? ' on' : ''}`}>
            <div className="vrm-offres-auto-ligne">
              <span className="vrm-offres-auto-icone" aria-hidden="true"><Icon name="tag" size={15}/></span>
              <div className="vrm-offres-auto-texte">
                <span className="vrm-offres-auto-nom">{tr('annonces.offresAutomatiques')}</span>
                <span className="vrm-offres-auto-statut" data-offres-auto-statut>{etat}</span>
              </div>
              <button type="button" className="vrm-offres-auto-info" data-offres-auto-info aria-expanded={offresInfo} aria-controls="vrm-offres-auto-detail" aria-label={tr('annonces.commentMarchentOffres')} title={tr('annonces.commentCaMarche')} onClick={() => setOffresInfo((v) => !v)}>i</button>
              <button type="button" role="switch" aria-checked={offresAuto} data-offres-auto-toggle={offresAuto?'1':'0'} onClick={basculerOffresAuto}
                className="vrm-offres-auto-switch" aria-label={tr('annonces.acceptationAutomatiqueOffres')}>
                <span className="vrm-offres-auto-piste" aria-hidden="true"><span/></span>
              </button>
            </div>
            {offresAuto && vintedDeChrome() ? <JaugeActions uid={vintedDeChrome().uid}/> : null}
            {/* (11 nov., lot DJ8) L'écran complet : seuils par paire, aperçu, historique (Messages → Favoris & offres → Offres auto). */}
            <button type="button" className="vrm-lien-action vrm-offres-auto-regler" data-offres-auto-regler="" onClick={()=>{ setAnnToolsOpen(false); demanderVue('offresauto'); try { window.dispatchEvent(new CustomEvent('vrm:vue',{detail:'offresauto'})); } catch(_) {} onNav && onNav('cat_msg'); }}>Régler par {motsVendeur().nom}, voir l’historique ›</button>
            {offresInfo && (
              <div id="vrm-offres-auto-detail" className="vrm-offres-auto-detail" data-offres-auto-detail>
                <p>{tr('annonces.remplis')} <b>{tr('annonces.accepter')}</b> {tr('annonces.annonceOffreAtteint2')} <b>{tr('annonces.refuserSous')}</b>{tr('annonces.refuseeEntreDeux')}</p>
                {offresAuto && (
                  <div data-offre-refus className="vrm-offres-auto-refus">
                    <label htmlFor="vrm-offre-refus-msg">{tr('annonces.messageQuandVrm')} <span>{tr('annonces.videRefusSans')}</span></label>
                    <textarea id="vrm-offre-refus-msg" data-offre-refus-msg value={refusMsg} onChange={e=>ecrireRefusMsg(e.target.value)}
                      rows={2} placeholder={tr('annonces.exMerciOffre')}/>
                    <AutresVersions nom="refus-annonces" premier={refusMsg} variantes={refusVariantes} onChange={changerRefusVariantes} extOk={extSait('variantes')==='ok'}/>
                    {erreurMessageAuto(refusMsg) ? <p role="status" data-message-auto-refuse="" style={{margin:'6px 0 0',fontSize:13,fontWeight:600,color:C.warn}}>{erreurMessageAuto(refusMsg)}</p> : null}
                  </div>
                )}
              </div>
            )}
            {offresAuto && ext!=='ok' && (
              <div data-offres-auto-ext={ext} className="vrm-offres-auto-ext" style={{color:C.warn}}>{ext==='absente'
                ? tr('annonces.rienPartIci')
                : `Mets l'extension à jour (${EXT_CAPACITES.offresgarde.replace(/\.0$/,'')}) : une plus ancienne pourrait accepter une offre sur ${motsVendeur().un} déjà vendu${motsVendeur().e} ailleurs.`}</div>
            )}
          </div>
          );
        })()}
                  {/* (11 nov., décision C10 — Julien : « tranche ») L'ancien bloc « Annonces à compléter » est
                      FONDU dans la vue d'Annonces « À compléter » (un seul endroit, une seule règle :
                      src/annoncesACompleter.js) ; ici, une ligne qui y mène. */}
                  {!noAcc && annACompleter && annACompleter.n > 0 ? <button type="button" className="vrm-outils vrm-outils-vers" data-outils-a-completer={annACompleter.n} onClick={()=>{ setAnnToolsOpen(false); setAnnSort('acompleter'); }}>{tr('annonces.completer')}<span>{annACompleter.n}</span></button> : null}
                  </div>
                  {[
                    /* ⚠️ (11 nov., lot DJ4 — Julien, mot pour mot : « L'inventaire physique n'est pas fiable.
                       Pareil pour audit d'inventaire. Pareil répartir un lot je trouve que ça sert à rien. »)
                       « Répartir un lot », « Inventaire physique » et « Audit du stock » QUITTENT ce menu (leur
                       seule entrée). Rien n'est supprimé : leurs modales (`lotOpen`, `inventOpen`, `auditOpen`)
                       et les données (prix d'achat posés, numéros) restent ; plus rien ne les ouvre. Ne pas les
                       remettre sans sa demande. Les prix d'un achat groupé : Achats → Fournisseurs. */
                    /* (11 nov., lot photos-comptes) La même photo sur deux de ses comptes Vinted : la feuille. */
                    {k:'photos-comptes', icon:'image', lab:tr('photosComptes.outil'), n:photosComptes ? photosComptes.groupes.length : 0, desc:tr('photosComptes.outilDesc'), on:()=>{ setAnnToolsOpen(false); relireEmpreintes(); setPhotosComptesOuvert(true); }},
                    {k:'studio', icon:'camera', lab:'Studio photo', desc:tr('annonces.cadreGuidePrise'), on:()=>{ setAnnToolsOpen(false); setStudioOpen(true); }},
                    /* (5 nov., chantier C — revue 2.7) « Compléter les prix d'achat » n'est plus
                       dans ce menu : le bandeau « Prix d'achat · N/M → Compléter », au-dessus de
                       la grille, est la seule porte (le même nombre ne s'écrit pas deux fois). */
                    /* « Rédiger une annonce (IA) » retiré le 30 septembre (Julien : « ça ne
                       va pas servir »). */
                    /* ⚠️ « Renuméroter à la suite » A ÉTÉ RETIRÉ DU MENU (23 août 2026).
                       C'est le seul outil qui RÉATTRIBUE des numéros en masse — donc
                       exactement ce que Julien interdit maintenant qu'il les écrit sur
                       les boîtes. Le code de la modale reste, mais plus rien ne l'ouvre.
                       Ne pas le remettre sans son accord explicite. */
                  ].map(t=>(
                    <button key={t.k} type="button" className="vrm-annbar-outil" data-outil-annonces={t.k} data-outil-n={t.n ? String(t.n) : undefined} onClick={t.on} title={t.desc}>
                      <span aria-hidden="true" className="vrm-annbar-outil-icone"><Icon name={t.icon} size={18}/></span>
                      <span className="vrm-annbar-outil-mot">{t.lab}</span>
                      {t.n ? <span className="vrm-annbar-outil-n" style={{marginLeft:'auto',color:'var(--vrm-warn, #B25000)',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{t.n}</span> : null}
                    </button>
                  ))}
                </div>
              </>)}
            </div>
            </div>
            {/* (9 nov., lot AI — Julien : « encore du texte ») Une puce compacte (compteur + mots), plus un gros bouton large. */}
            {nRefaire > 0 && <button type="button" className="vrm-pop-puce vrm-annbar-refaire" data-refaire-ouvrir={nRefaire} aria-haspopup="dialog" onClick={()=>setRefaireOpen(true)}><span className="vrm-pop-puce-n">{nRefaire}</span><span>{trj('annonces.brouillonsRefaire', { n: nRefaire })}</span></button>}
            {!repubAction && <CompteRenduOperation onRefaire={()=>setRefaireOpen(true)} onReprendre={(act, ids)=>{ setRepubReprise(ids); setRepubAction(act); }} />}
            {!repubAction && <ProgrammesRepubCarte progs={progsRepub} onModifier={(p)=>ouvrirProgramme(p, 'modifier')} />}
          </div>}

        {(listings.items?.length>0 || annMasquees.length>0 || (brVinted.liste||[]).length>0) && <div className="vrm-stock-views vrm-filtres" role="group" aria-label={tr('annonces.vuesRapidesAnnonces')}>
          {/* (5 nov., chantier C — revue 2.10) « Sélectionner » en DEUXIÈME : au téléphone, la
              rangée défile et le coupait au bord (« Séle… »). « Tout le stock » devient « Toutes »
              (le Stock est un autre écran). */}
          <button type="button" data-vue-toutes="" aria-pressed={annSort==='oldest'&&!annSearch.trim()} onClick={()=>{setAnnSort('oldest');setAnnSearch('');}}>{tr('journee.toutes')}</button>
          {/* (5 nov.) « Sélectionner » : en ligne, brouillons et masquées ensemble, puis UNE feuille « Actions ». */}
          <button type="button" data-vue-selection aria-pressed={annSort==='selection'} onClick={()=>setAnnSort('selection')}>{tr('annonces.selectionner')}{selAnn.length ? <span className="vrm-of-n">{selAnn.length}</span> : null}</button>
          {/* (9 nov., lot AL — Julien : « Republier dans Annonces ») L'ancienne entrée « Republier » du menu
              est ICI : ses annonces en ligne à cocher, puis « Republier » ouvre l'atelier (ordre, espacement, lancer). */}
          <button type="button" data-vue-republier="" aria-pressed={annSort==='republier'} onClick={()=>setAnnSort('republier')}>{tr('annonces.republier2')}</button>
          {/* (5 nov., Julien : « les annonces en brouillon doivent apparaître dans Annonces,
              avec leur marque « brouillon » ») Ses brouillons, compte par compte, à cocher. */}
          {((brVinted.liste||[]).length>0 || annSort==='brouillons') && <button type="button" data-vue-brouillons={(brVinted.liste||[]).length} aria-pressed={annSort==='brouillons'} onClick={()=>setAnnSort('brouillons')}>{tr('annonces.brouillons')}<span className="vrm-of-n">{(brVinted.liste||[]).length}</span></button>}
          {/* (4 nov.) Les annonces masquées par Vinted, compte par compte (toujours chez toi, pas « en ligne »). */}
          {(annMasquees.length>0 || annSort==='masquees') && <button type="button" data-vue-masquees={annMasquees.length} aria-pressed={annSort==='masquees'} onClick={()=>setAnnSort('masquees')}>{tr('annonces.masquees')}<span className="vrm-of-n">{annMasquees.length}</span></button>}
          <button type="button" aria-pressed={annSort==='nonum'} onClick={()=>setAnnSort('nonum')}>{tr('annonces.sansNumero')}{annStats.sansNum>0 ? <span className="vrm-of-n">{annStats.sansNum}</span> : null}</button>
          {/* (6 nov., vague 2 · point 4) Les annonces numérotées dont l'achat n'est pas relié (src/achatsARelier.js). */}
          {((fileAchat && fileAchat.length > 0) || annSort==='sansachat') && <button type="button" data-vue-sans-achat={fileAchat ? fileAchat.length : ''} aria-pressed={annSort==='sansachat'} onClick={()=>setAnnSort('sansachat')}>{tr('annonces.sansAchatRelie')}{fileAchat && fileAchat.length ? <span className="vrm-of-n">{fileAchat.length}</span> : null}</button>}
          {((annACompleter && annACompleter.n>0) || annSort==='acompleter') && <button type="button" data-vue-a-completer={annACompleter && annACompleter.n!=null ? annACompleter.n : ''} aria-pressed={annSort==='acompleter'} onClick={()=>setAnnSort('acompleter')}>{tr('annonces.completer')}{annACompleter && annACompleter.n>0 ? <span className="vrm-of-n">{annACompleter.n}</span> : null}</button>}
          {(annStats.sleeping>0 || vueRelancer.favoris>0) && <button type="button" data-vue-relancer={annStats.sleeping} aria-pressed={annSort==='sleeping'} onClick={()=>{ if (!(annStats.sleeping>0)) setModeDort('favoris'); setAnnSort('sleeping'); }}>{tr('annonces.relancer')}</button>}
          {/* (6 nov.) Pour les conseils (src/accompagnement.js) : les nombres de cet écran, lus
              seulement (liste pas chargée ou en erreur ⇒ rien). */}
          <ChiffreConseil cle="annonces.dorment" valeur={Array.isArray(listings.items) && !listings.error ? annStats.sleeping : undefined}/>
          <ChiffreConseil cle="annonces.prixMini" valeur={Array.isArray(listings.items) && !listings.error ? { offresAuto: offresAuto === true, nbMini: nbAccepterDes(annBase, numeros), total: (annBase || []).length } : undefined}/>
        </div>}
        {/* (5 nov., chantier C — revue 2.9) « sélection » ne nomme plus que les cases cochées :
            le filtre dit « affichées ». Dans les vues à cocher (Sélectionner, Brouillons), leur
            propre tête dit déjà quoi faire : pas de ligne de filtre en plus. */}
        {(annSearch.trim() || annSort!=='oldest') && annSort!=='selection' && annSort!=='republier' && annSort!=='brouillons' && annSort!=='sansachat' && annSort!=='acompleter' && <div className="vrm-filter-recap" role="status" data-ann-filtre="">
          <span>{(()=>{ const k = annSort==='masquees' ? annMasquees.length : annShown.length; return `${k} annonce${k>1?'s':''} affichée${k>1?'s':''}`; })()}</span>
          <button type="button" onClick={()=>{setAnnSearch('');setAnnSort('oldest');}}>{tr('annonces.toutAfficher')}</button>
        </div>}

        </div>
        {/* ⚠️ On DIT ce que le filtre « compte banni » a mis de côté (§ : une
            liste qui rétrécit sans explication se lit comme une perte). Les
            paires ne sont pas perdues — le compte Vinted est bloqué, elles ne
            peuvent juste plus s'y vendre. */}
        {annBannies.n>0 && (
          <div style={{margin:'0 0 12px',fontSize:12,color:C.warn,background:`${C.warn}12`,border:`1px solid ${C.warn}55`,borderRadius:12,padding:'9px 12px',lineHeight:1.5}}>
            <b>{trj('annonces.annonces', { n: annBannies.n })}</b> {tr('annonces.texte7')} {annBannies.comptes.length>1?tr('annonces.comptesRefuses'):'ton compte '+annBannies.comptes[0]} {tr('annonces.retiree')}{annBannies.n>1?'s':''} {tr('annonces.vintedCompteBloque')}{annBannies.n>1?'les':'la'} {tr('journee.texte2')} <b>Leboncoin</b> {tr('annonces.texte5')} <b>eBay</b>. <Pourquoi>{trj('annonces.compteBloqueElles', { n: annBannies.n })}</Pourquoi>
          </div>
        )}
        {/* ── SIGNALEMENTS, REPLIÉS ────────────────────────────────────────
            Trois bandeaux d'alerte s'empilaient ici en permanence (compte muet,
            annonces disparues, compte bloqué) : il fallait défiler longtemps
            avant de voir ses annonces. Ils sont maintenant derrière une seule
            ligne, dépliable, et n'apparaissent que s'il y a vraiment quelque
            chose à signaler. */}
        {/* ⚠️ IL NE RESTE QU'UNE SEULE ALERTE ICI, ET C'EST VOULU.
            Julien : « enlève le signalement sur tes annonces, et tout ce qui
            n'est pas pertinent ». Le compteur générique mélangeait des choses
            sans conséquence (compte muet, annonce disparue, compte bloqué) avec
            LA seule qui coûte de l'argent : deux paires présentes sous le même
            numéro, donc la mauvaise chaussure dans le carton. Noyée au milieu,
            elle ne se voyait plus. Les autres sont retirées ; celle-ci reste,
            en rouge, et se déplie toute seule. */}
        {/* ⚠️ LE DOUBLON D'ALERTE (§11 : une notion, un seul endroit).
            Le panneau des numéros en double se déplie TOUT SEUL (effet sur
            numDoublons) : la barre de résumé qui le précédait était donc
            TOUJOURS affichée juste au-dessus de lui, avec le même titre.
            Mesuré en capture : deux blocs consécutifs disant la même chose.
            La barre est supprimée — le panneau se montre seul, sans bascule :
            c'est la seule alerte de l'app qui coûte de l'argent (§19), elle
            n'a pas à être repliable. */}
        {numDoublons.length > 0 && (
          <div style={{border:`1.5px solid ${C.doublon}`,background:`${C.doublon}0e`,borderRadius:12,padding:'12px 14px',marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:C.doublon}}>{trj('annonces.numerosPortesDeux', { n: numDoublons.length })}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.45}}>
              {tr('annonces.memeDeux')} {motsVendeur().noms} {tr('annonces.donneNumeroNeuf')}{motsVendeur().une} {tr('annonces.deux')} <Pourquoi>Deux {motsVendeur().noms} rangé{motsVendeur().e}s dans la même boîte : à l'expédition, tu risques d'envoyer {motsVendeur().la} mauvais{motsVendeur().e}. Les numéros ne se réutilisent jamais.</Pourquoi>
            </div>
            {numDoublons.map(g => (
              <div key={g.numero} style={{marginTop:10,paddingTop:9,borderTop:`1px solid ${C.border}`}}>
                <div style={{marginBottom:6}}><Numero n={g.numero} etat="doublon" taille="petit"/></div>
                {g.items.map(it => (
                  <div key={it.id} style={{display:'flex',alignItems:'center',gap:9,marginBottom:6}}>
                    {it.photo && <PhotoVinted src={it.photo} alt="" style={{width:34,height:34,borderRadius:12,objectFit:'cover',flexShrink:0}}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.title}</div>
                      <div style={{fontSize:11,color:C.muted}}><AcctTag acc={it._acc} name={accNameOf(it._acc)}/>{it._vrmMasquee ? <span data-doublon-masquee> {tr('annonces.masqueeVintedToujours')}</span> : null}</div>
                    </div>
                    {/* (5 nov., chantier C) Les deux gestes du doublon : le bouton partagé (plus de bordure bleue faite main). */}
                    <Bouton variante="secondaire" taille="petit" style={{flexShrink:0}} title={tr('annonces.donnerNeufArticle', { nextNumero: String(nextNumero) })} onClick={async ()=>{
                      if (refusHorsLigne('numero')) return;
                      const libre = String(nextNumero);
                      if (!await askConfirm({ title:tr('annonces.donnerArticle', { libre: String(libre) }), desc:tr('annonces.quitteResteAutre', { title: String(it.title), numero: String(g.numero) }), ok:`Passer au N°${libre}` })) return;
                      setNumeros(prev => { const u={...prev}; u[it.id]={...(u[it.id]||{}), numero:libre, manuelAt:new Date().toISOString()}; save('vinted_annonce_numeros',u); return u; });
                      recordUsed(libre);   // le numéro est pris à vie (§5.40)
                      toast(tr('annonces.articleMaintenant', { libre: String(libre) }));
                    }}>{trj('annonces.passer', { nextNumero: nextNumero })}</Bouton>
                    {it._vrmMasquee ? <Bouton variante="secondaire" taille="petit" data-masquee-partie={String(it.id)} onClick={()=>masqueePlusLa(it)} style={{flexShrink:0}}>{tr('annonces.plus')}</Bouton> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {/* ⚠️ LES AUTRES SIGNALEMENTS ÉTAIENT PRISONNIERS DE CETTE BASCULE.
            Ils ne s'ouvraient qu'avec le bouton de la barre de résumé, qui
            n'apparaissait QUE s'il y avait un numéro en double. Sans conflit
            de numéro, un compte muet ou une annonce disparue était donc
            INATTEIGNABLE — de l'affichage mort. Ils ont désormais leur propre
            dépliant, qui ne s'affiche que s'il y a vraiment quelque chose. */}
        {/* ⚠️ TROIS DÉPLIANTS DE CONSEILS EMPILÉS, C'ÉTAIT DEUX DE TROP.
            « N signalements », « N paires qui te reviennent » et « Conseils &
            signalements » posaient trois lignes à ouvrir l'une sous l'autre,
            avant la moindre annonce. Les signalements (compte muet, annonces
            disparues, comptes refusés) rejoignent le panneau « Conseils &
            signalements », qui existait déjà et compte déjà ce genre de
            choses. Un seul endroit où regarder. */}
        {/* ── LES COMPTES : UNE LIGNE, PLUS UNE RANGÉE DE PUCES (H1, 30 sept.) ──
            « L'onglet Annonces, c'est le bordel : la liste des comptes connectés
            va dans Réglages, avec les infos. » La rangée « Comptes : » (une puce
            par compte, qui MASQUAIT le compte au tap) faisait doublon avec
            Réglages → Comptes liés, qui porte déjà l'email, le téléphone, l'état
            de capture et le même interrupteur « masquer ». Il reste ici UNE
            ligne qui dit combien de comptes alimentent la liste, ce qui demande
            un geste (connexion refusée, données d'une semaine), et la porte.
            Les nombres viennent de `annBase` comme « N en ligne » (§11). */}
        {listings.items && listings.items.length>0 && (()=>{
          const brut = {}, visibles = {};
          for (const it of listings.items) { const uid = String(it._acc?.vinted_user_id || ''); if (!uid) continue; brut[uid] = (brut[uid]||0)+1; }
          for (const it of annBase) { const uid = String(it._acc?.vinted_user_id || ''); if (!uid) continue; visibles[uid] = (visibles[uid]||0)+1; }
          const uids = Object.keys(brut);
          if (uids.length < 2 && !uids.some(u=>hiddenAccts.has(u))) return null; // un seul compte : rien à dire
          const nOff = uids.filter(u => acctOff(u)).length;
          const refuses = uids.filter(u => blockedAccts.has(u) && !acctOff(u));
          // (26 oct.) Dans l'espace Vinted, le sélecteur « Compte » est juste au-dessus :
          // la ligne ne reste que si elle demande un geste (connexion refusée).
          if (dansPlateforme && refuses.length === 0) return null;
          const accByUid = {}; accounts.forEach(a=>{ accByUid[String(a.vinted_user_id)] = a; });
          const nom = (u) => { const a = accByUid[u]; return a ? accNameOf(a) : `#${u}`; };
          return (
            <div data-comptes-annonces style={{marginBottom:12,display:'flex',flexWrap:'wrap',alignItems:'center',gap:'4px 10px',fontSize:12,color:C.muted,lineHeight:1.45}}>
              <span>
                {tr('annonces.annonces4')} <b style={{color:C.text}}>{trj('annonces.comptes', { n: uids.length - nOff })}</b>
                {nOff>0 && <> · {nOff} {tr('annonces.masque')}{nOff>1?'s':''}</>}
                {refuses.length>0 && <> · <b style={{color:C.warn}}>{trj('annonces.connexionRefusee', { x: refuses.map(nom).join(', ') })}</b></>}
              </span>
              <button type="button" onClick={()=>onNav && onNav('vintedaccounts')}
                style={{border:'none',background:'transparent',padding:0,color:C.accentTexte,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {tr('annonces.gererComptes')}
              </button>
            </div>
          );
        })()}
        {/* 5.165 — DE QUAND DATE CE QU'ON VOIT, et les annonces SUPPRIMÉES depuis.
            Une fois, au-dessus de la grille (§7) ; la règle et la phrase sont
            celles du tableau de bord (`FraicheurAnnonces`, §11). Remplace le
            « pas rafraîchie depuis une semaine » de la ligne des comptes. */}
        {listings.items && (()=>{
          const enLigne = {};
          for (const it of annBase) { const u = String(it._acc?.vinted_user_id || ''); if (u) enLigne[u] = (enLigne[u]||0)+1; }
          for (const u of Object.keys(listings.supprimees || {})) if (!acctOff(u) && !(u in enLigne)) enLigne[u] = 0;
          const noms = {}; accounts.forEach(a => { noms[String(a.vinted_user_id)] = accNameOf(a); });
          return <FraicheurAnnonces lues={listings.lues} enLigne={enLigne} noms={noms} supprimees={listings.supprimees} aConfirmer={annAConfirmer} numeros={numeros} activite={liveStats && liveStats.annActivite}/>;
        })()}
        {/* (9 nov., lot AF) LA MÊME PAIRE EN LIGNE DEUX FOIS (`enLigneDeux`, src/enLigneDeuxFois.js) :
            mêmes groupes que la carte de Ma journée (§11) — même PHOTO EXACTE ou `recreeDe`, lectures
            de moins de 24 h, jamais le titre. AMBRE, avant la double vente ; le geste est le sien,
            sur vinted.fr (VRM ne supprime rien, §3). */}
        {enLigneDeux && enLigneDeux.vinted.length > 0 && <EnLigneDeuxFoisAlerte groupes={enLigneDeux.vinted} manque={enLigneDeux.manque} PhotoVinted={PhotoVinted} Feuille={SheetShell}/>}
        {listings.loading && !listings.items && <Skeleton variant="card" count={6}/>}
        {listings.error && <EtatPanne quoi="Tes annonces Vinted" data-ann-panne="" onReessayer={()=>loadListings(true)}/>}
        {/* Aucune annonce en ligne MAIS des annonces à confirmer : la ligne du
            dessus le dit déjà, avec le geste (§7 — une cause, une phrase). */}
        {listings.items && !listings.error && listings.items.length===0 && !annAConfirmer.length && (
          <EmptyState icon="tag" title={tr('annonces.aucuneAnnonceLigne')}
            desc="Ouvre ta boutique sur vinted.fr une fois, avec l'extension active : tes annonces remonteront ici automatiquement."
            action={<Bouton variante="primaire" href="https://www.vinted.fr/member/general/settings" target="_blank" rel="noreferrer">{tr('annonces.ouvrirVinted')}</Bouton>}/>
        )}
        {listings.items && !listings.error && listings.items.length===0 && blocMasquees()}
          {numAttente ? <Skeleton variant="card" count={6}/> : (<>
          {blocAEcrire()}
          <BlocBarrerVc/>
          {/* (5 nov., chantier C — revue 2.7) UNE ligne d'avis en tête de la liste :
              « Prix d'achat N/M · Compléter » (plus l'ambre sur chaque carte ; N/M compté sur
              les annonces en ligne, §5 : la couverture dite, « Compléter » ouvre la saisie en
              série) et « N nouveaux N° · Vérifier » (la liste se déplie dessous). Une ligne, pas
              deux blocs : au téléphone le premier article reste dans le premier écran (fusion-app F4). */}
          {(()=>{
            const m = annBase.length;
            const n = m ? annBase.filter(it=>{ const a = prixAchatDe(numeros[it.id]||{}, buyByNum); return a!=null && !isNaN(a); }).length : 0;
            const vuePrix = !['selection','republier','brouillons','masquees','sleeping','sansachat','acompleter'].includes(annSort);   // (6 nov.) « Sans achat relié » dit déjà sa file
            // (6 nov.) LE PROCHAIN GESTE EN TÊTE (src/prochainGesteAnnonces.js) : un geste, celui
            // qui compte le plus, avec son bouton — sur la liste de toujours (pas dans une vue filtrée).
            const geste = annSort === 'oldest' && !annSearch.trim() && listings.items && !listings.error
              ? prochainGesteAnnonces({ aVerifier: aVerifierCarton.length, sansNum: annStats.sansNum, prixConnus: n, prixTotal: m, dorment: annStats.sleeping, ecrit: numeroEcritActif() })
              : null;
            const faireGeste = () => {
              if (!geste) return;
              if (geste.cle === 'prix') { setFillBuyOpen(true); return; }
              if (geste.cle === 'sansnum') { setAnnSort('nonum'); return; }
              if (geste.cle === 'dorment') { setAnnSort('sleeping'); return; }
              try { const el = document.querySelector('[data-numeros-a-verifier]'); if (el) { el.open = true; el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } catch (_) {}
            };
            const ligneGeste = geste ? (
              <div className="vrm-ann-geste" data-ann-prochain-geste={geste.cle} role="status">
                <span className="vrm-ann-geste-texte"><b>{tr('annonces.prochainGeste')}</b><span>{geste.texte}</span></span>
                <Bouton variante="discret" data-ann-prochain-geste-bouton="" onClick={faireGeste}>{geste.bouton}</Bouton>
              </div>
            ) : null;
            // « Prix d'achat N/M » se dit une fois (§7) : dans le geste quand c'est lui.
            const prixManque = vuePrix && m > 0 && n < m && !(geste && geste.cle === 'prix');
            const nN = numerosNeufs.length;
            // (6 nov.) Pour le conseil « Des prix d'achat manquent » : le N/M de cette ligne, lu seulement.
            const chiffrePrix = <ChiffreConseil cle="annonces.prixAchat" valeur={Array.isArray(listings.items) && !listings.error ? { n, m } : undefined}/>;
            if (!prixManque && !nN) return <>{chiffrePrix}{ligneGeste}</>;
            return (<>
              {chiffrePrix}
              {ligneGeste}
              <div className="vrm-ann-avis" data-ann-avis="">
                {prixManque && (
                  <div className="vrm-ann-achats" data-ann-achats={`${n}/${m}`} role="status">
                    <span className="vrm-ann-achats-texte"><span className="vrm-ann-achats-nom">{tr('ventes.prixAchat')}</span><span className="vrm-ann-achats-n">{n}/{m}</span><span className="vrm-ann-achats-sous">{tr('ventes.connus')}</span></span>
                    <Bouton variante="discret" data-ann-achats-completer="" title={tr('ventes.beneficeComptePrix')} onClick={()=>setFillBuyOpen(true)}>{tr('journee.completer')}</Bouton>
                  </div>
                )}
                {nN > 0 && (
                  <button type="button" className="vrm-ann-avis-neufs" data-num-neufs-ouvrir={nN} aria-expanded={neufsOuverts} onClick={()=>setNeufsOuverts(v=>!v)}
                    title={tr('annonces.vrmVientPoser')}>
                    <span><b>{nN}</b> {nN > 1 ? tr('annonces.nouveaux') : tr('annonces.nouveau')}</span><span className="vrm-ann-avis-voir">{neufsOuverts ? tr('creerVinted.fermer') : tr('annonces.verifier')}</span><Icon name="chevron" size={14} className="vrm-ann-avis-chevron" style={{transform:neufsOuverts?'rotate(-90deg)':'rotate(90deg)',transition:'transform .15s'}}/>
                  </button>
                )}
              </div>
              {neufsOuverts && blocNouveaux()}
            </>);
          })()}
          {/* (9 nov., lot AI) Les propositions en puces côte à côte (chacune ouvre SA pop-up). */}
          <div className="vrm-pop-puces" data-popup-puces="">{blocNumeroEcrit()}{blocRemiseEnLigne()}</div>
          {aVerifierCarton.length > 0 && (
          <details data-numeros-a-verifier={aVerifierCarton.length} className="vrm-repli" open style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.warn || '#B25000'}`, borderRadius: 12, padding: '4px 12px 10px', marginBottom: 12 }}>
            <summary style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{trj('annonces.numerosVerifier', { n: aVerifierCarton.length })}</summary>
            {/* (6 nov., v36-visuel) Une ligne ; le récit de la panne derrière le « ⓘ ». */}
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45, margin: '2px 0 6px' }}>
              <b style={{ color: C.text, fontWeight: 600 }}>{tr('annonces.seuleEtiquetteArticle')}</b>{' '}
              <Pourquoi label={tr('annonces.pourquoiVerifier')} titre={tr('annonces.numerosVerifier2')}>{tr('annonces.1118Octobre')}</Pourquoi>
            </div>
            {ebayVerif && !ebayVerif.ko && ebayVerif.annonces.length > 0 && (
              <div data-verif-ebay style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 4 }}>
                {tr('annonces.ebayAnnoncesPortent')} {ebayVerif.annonces.map((a) => `${a.sku} « ${a.titre} »`).join(' · ')}.
              </div>
            )}
            {aVerifierCarton.map((it) => (
              <LigneVerifCarton key={it.id} it={it} fiche={numeros[it.id] || {}} onPlusLa={masqueePlusLa} preuve={ebayVerif && ebayVerif.preuves ? ebayVerif.preuves[String(it.id)] : ''}
                onConfirmer={confirmerCarton} onCorriger={corrigerCarton}/>
            ))}
          </details>
        )}
        {/* (3 nov., critique #7) « Stock et ajustements » et « Publier aussi ailleurs » descendent SOUS la grille : le premier article d'abord. */}
        {/* ══ LA CARTE D'ANNONCE (3 octobre) ══════════════════════════════════
            Julien : « c'est totalement n'importe quoi ; on ne sait pas sur quelle
            application, c'est quoi le prix, le boost ». Mesuré : 70 cartes sur
            71 n'affichaient que la MARQUE (jamais le titre), quatre montants
            dont deux sans libellé, six teintes, le sommeil dit trois fois, et
            « Leboncoin » pour deux notions côte à côte (la file ET la présence).
            ⇒ Une carte qui se LIT : le PRIX, le TITRE, la présence prouvée
            ailleurs, puis une ligne de chiffres TOUS libellés ; la saisie (N°,
            achat) en bas ; le reste dans « ⋯ ». Une seule couleur d'accent,
            rare (§7) : l'ambre ne sert qu'à « dort » et à une marge négative. */}
        <FichesNeuves annonces={listings.items}/>
        {/* (11 nov., lot quoi-republier) « Quelles annonces republier ? » en tête de la vue Republier : un toucher COCHE
            l'annonce dans la liste ci-dessous (la même sélection `selAnn`, par compte + identifiant) ; rien ne part,
            c'est lui qui choisit ensuite « À la main » ou « Par VRM » et qui lance (§3). */}
        {annSort==='republier' && !(listings.items==null && listings.loading) ? (
          <QuoiRepublier site="vinted" res={quoiRep && annUnCompte ? { ...quoiRep, liste: quoiRep.liste.map((l)=>({ ...l, compte:'' })), aVerifier: quoiRep.aVerifier.map((l)=>({ ...l, compte:'' })) } : quoiRep}
            reglage={qrReglage} onReglage={setQrReglage} Photo={PhotoVinted} pasLu={tr('qr.pasLuVinted')}
            estCoche={(l)=>selAnn.some((x)=>x.uid===l.uid && x.id===l.id)}
            onBasculer={(l)=>{ const a = annSelectionnables.find((x)=>x.uid===l.uid && x.id===l.id);
              // La même règle que la case de la liste : une annonce que l'atelier refuse (en vérification…) dit pourquoi.
              if (!a || a.raisonPas || a.etat!=='en-ligne') { toast((a && a.raisonPas) || tr('qr.pasCochable')); return; }
              setSelAnn((v)=>(v.some((x)=>x.uid===l.uid && x.id===l.id) ? v.filter((x)=>!(x.uid===l.uid && x.id===l.id)) : [...v, { id:a.id, uid:a.uid, etat:a.etat }])); }}
            onCocherTout={(ls)=>{ const ok = new Map(annSelectionnables.filter((a)=>!a.raisonPas && a.etat==='en-ligne').map((a)=>[a.uid+':'+a.id, a]));
              setSelAnn((v)=>{ const deja = new Set(v.map((x)=>x.uid+':'+x.id)); return [...v, ...ls.map((l)=>ok.get(l.uid+':'+l.id)).filter((a)=>a && !deja.has(a.uid+':'+a.id)).map((a)=>({ id:a.id, uid:a.uid, etat:a.etat }))]; }); }}/>
        ) : null}
        {(annSort==='selection' || annSort==='brouillons' || annSort==='republier') ? (
          <ChoixAnnoncesVinted filtre={annSort==='brouillons' ? 'brouillon' : annSort==='republier' ? 'republier' : 'tout'} annonces={annSelectionnables} sel={selAnn} setSel={setSelAnn}
            charge={listings.items==null && listings.loading} brLecture={brVinted.liste==null}
            onActions={()=>setActionsSelOpen(true)}
            onRepublier={(choisies)=>{
              // (9 nov., lot AL) La vue « Republier » lance LE MÊME atelier que la tuile « Republier »
              // de la feuille Actions (`RepublierVinted`, action `recreer`), avec la même règle
              // (`actionsPossibles` : un compte, celui de l'onglet, extension à jour) — refus ⇒ sa raison.
              const vc = vintedDeChrome();
              const r = actionsPossibles({ selection: choisies.map(a=>({ id:a.id, uid:a.uid, etat:a.etat })), chrome: vc === undefined ? undefined : (vc ? String(vc.uid||'') : null),
                capOk: (cap)=>extSait(cap)==='ok', nomCompte: (u)=>{ const a=(accounts||[]).find(x=>String(x.vinted_user_id)===String(u)); return a ? accNameOf(a) : ''; } }).find(x=>x.k==='recreer');
              if (!r || !r.ok) { toast((r && r.raison) || tr('annonces.republierPossibleSelection')); return; }
              setRepubReprise(choisies.map(a=>a.id)); setRepubDepart(true); setRepubCle(c=>c+1); setRepubAction('recreer'); }}
            onALaMain={(choisies)=>{
              // (10 nov., lot AP) « À la main » : la règle de la tuile « Republier à la main » (chaque paire SON compte connu).
              const r = actionsPossibles({ selection: choisies.map(a=>({ id:a.id, uid:a.uid, etat:a.etat })), chrome: undefined, capOk: ()=>true }).find(x=>x.k==='main');
              if (!r || !r.ok) { toast((r && r.raison) || tr('annonces.mainPossibleSelection')); return; }
              setKitMain(choisies.map(a=>{ const fl = prixAchatDe(numeros[a.id]||{}, buyByNum); return { ...a, floor: fl!=null && !isNaN(fl) ? Number(fl) : null }; })); }} suivis={suivisMainVisibles} onSuivi={(a)=>setRepubMainOuvert(a)}
            onDetailBrouillons={()=>setBrouillonsOpen(true)}/>
        ) : annSort==='sansachat' ? (
          <AchatsARelier file={fileAchat} achats={fillBuyAchats.loading && !fillBuyAchats.items ? undefined : (fillBuyAchats.items || (accounts.length ? undefined : []))} liens={liensAchats}
            propositionDe={propositionSuggestion} onRelier={relierAchatAnnonce} onSaisir={saisirPrixAnnonce} onPlusTard={poserAchatPlusTard} onSerie={()=>setFillBuyOpen(true)}
            onChoisir={(it, propose)=>openPicker({ ...it, _autre: propose ? String(propose.transaction_id || '1') : undefined, _dateRef: (()=>{ const t=Number(it.createdTs); return Number.isFinite(t)&&t>0 ? new Date(t<1e12?t*1000:t).toISOString() : null; })() })} compteDe={(a)=>a&&a._acc?accNameOf(a._acc):''}/>
        ) : annSort==='acompleter' ? (
          <VueACompleter Photo={PhotoVinted} res={annACompleter} onBrouillon={(id)=>setAtelier(String(id))} onPrixAchat={(id)=>{ const it=(listings.items||[]).find(x=>x&&String(x.id)===String(id)); if (it) saisirPrixAnnonce(it); }}/>
        ) : annSort==='masquees' ? (
          <AnnoncesMasquees Photo={PhotoVinted} res={listings.masquees==null ? (listings.loading ? undefined : null) : masqueesParCompte(annMasquees, { numeroDe:(id)=>(numeros[id]||{}).numero||'', nomDe:(a)=>a?accNameOf(a):'' })}/>
        ) : annSort==='sleeping' ? (
          <QuiDorment seuil={seuilDort} onSeuil={setSeuilDort} Segmente={Segmente} fmt={fmt} onAgir={(a)=>setDortAgir(a)}
            selection={qdSel} onSelection={setQdSel} onBaisser={(choisies)=>setBaisseSel(choisies.map(a=>annonceBaisse(a.it)))}
            mode={modeDort} onMode={setModeDort} seuilFavoris={seuilFav} onSeuilFavoris={setSeuilFav} nDort={vueRelancer.dort} nFavoris={vueRelancer.favoris}
            pasLus={modeDort==='favoris' && vueRelancer.favorisPasLus>0 ? `Favoris pas lus sur ${vueRelancer.favorisPasLus} annonce${vueRelancer.favorisPasLus>1?'s':''}.` : ''}
            liste={listings.items==null ? null : annShown.map(it=>{ const e=numeros[it.id]||{}; const pr=(it.price&&typeof it.price==='object')?it.price.amount:it.price; const n=Number(String(pr==null?'':pr).replace(',','.'));
              return { id:String(it.id), it, numero:e.numero?String(e.numero):'', titre:it.title||'', photo:photoArticle(it)||'', prix:isFinite(n)&&n>0?n:null, age:listedAgeDays(it),
                vues:Number.isFinite(it.views)?it.views:null, favoris:Number.isFinite(it.favourites)?it.favourites:null, compte:annUnCompte?'':((it._acc&&(it._acc.login||it._acc.username))||'') }; })}/>
        ) : (<>
        <div className="vrm-ledger-heading vrm-ann-ledger-heading" aria-hidden="true"><span>{tr('annonces.articleStock')}</span><span>{tr('partout.part.prix')}</span></div>
        {/* (10 nov., lot AM — demande 15 de Julien : « la disposition par compte de Vinted me plaît … la même pour
            Toutes, en gardant toutes les fonctions ») LA GRILLE DE VIGNETTES, RANGÉE PAR COMPTE, comme le dressing
            Vinted : un en-tête par compte (son initiale, comme la carte du compte de la colonne), puis ses annonces
            — photo carrée, N° en pastille, prix, titre, petites marques d'état. 2 colonnes au téléphone, 4 à 6 sur
            ordinateur (styles-annonces-grille.css). TOUCHER la vignette l'ouvre EN PLACE, sur toute la largeur :
            c'est la fiche d'avant, entière (achat, mini, refuse, boost, marge, achat relié, stock, « … »), mêmes
            éléments, mêmes écritures, mêmes data-* (rien n'est retiré, seulement replié). Toucher la PHOTO ouvre la
            visionneuse unique (src/visionneuse.js). L'ordre et la règle « en ligne » ne changent pas (`annShown`). */}
        <div className="vrm-ann-grid vrm-fiches vrm-ann-vignettes" data-ann-grille="vignettes" data-ann-grille-comptes={annGroupes.length} style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 180px), 1fr))',gap:16}}>
          {annGroupesVus.map(g=>{ const acc0 = g.items[0] && g.items[0]._acc; const nomG = acc0 ? accNameOf(acc0) : ''; return [
          <div key={'compte-'+g.uid} className="vrm-ann-compte-tete" data-ann-compte={g.uid} data-ann-compte-n={g.tous} role="heading" aria-level={3}>
            <span className="vrm-ann-compte-avatar" aria-hidden="true">{initialeCompte(nomG)}</span>
            <span className="vrm-ann-compte-nom" title={nomG || undefined}>{nomG || tr('annonces.compteVinted')}</span>
            <span className="vrm-ann-compte-n">{trj('annonces.annonces', { n: g.tous })}</span>
          </div>,
          ...g.items.map(it=>{
            // ⚠️ `item` porte TOUT ce que la carte lit (photos captées, date) :
            //    reconstruit avec 5 champs, la pastille « prête » valait
            //    « à capter » sur toutes les cartes, par construction.
            const item = it;
            const e = numeros[it.id] || {}; const num = e.numero || ''; const buy = e.buyPrice ?? '';
            const atGarage = inGarage(num);
            const age = listedAgeDays(it); const sleeps = age!=null && age>=SLEEP_DAYS;
            // Bordereau reçu pour cette paire → elle est vendue (par IDENTITÉ,
            // §5). Renumérotée APRÈS ce bordereau ⇒ republiée, pas vendue.
            const soldBord = (()=>{ const b = bordForItem(it.id, num); if(!b) return null; const en=numeros[it.id]; const et=en?new Date(en.repriseAt||en.numberedAt||0).getTime():0; const bt=new Date(b.receivedAt||0).getTime(); return (et&&bt&&et>bt)?null:b; })();
            // Le prix d'achat : la MÊME lecture que les baisses (`prixAchatDe`, §11).
            const achat = prixAchatDe(e, buyByNum);
            const boost = feesOf(e);
            const marge = (it.price!=null && achat!=null && !isNaN(achat)) ? Math.round(Number(it.price) - achat - boost) : null;
            const ailleurs = lbcAussi.has(String(it.id));
            // (12 nov., Julien : « pas abusif ») Le conseil MESURÉ (src/conseilPrix.js, la même carte que
            // le repricing) : 30 j en ligne, −10 % au plus, 14 j entre deux, jamais sous l'achat + 10 %.
            const conseil = soldBord ? null : conseilsPrix.get(String(it.id)) || null;
            const sugg = conseil ? conseil.sugg : null;
            // (29 oct., Julien : « augmente la taille des photos ; l'état plus
            // original avec à côté la saisie du prix d'achat ; toutes les infos
            // qui sont dans les 3 petits points ») LA FICHE : la photo en grand,
            // puis titre, prix et N° ; une rangée « état (jauge) · prix d'achat » ;
            // les chiffres (mini, refuse, boost, marge) TOUS libellés ; ce qui
            // était replié dans « Gérer l'annonce » est VISIBLE (achat relié,
            // stock, Leboncoin et sa préparation, les gestes). Les écritures sont
            // les MÊMES qu'avant (`updatePair`, `poserNumero`, §11).
            const cell = { display:'flex', flexDirection:'column', justifyContent:'center', gap:2, minWidth:0, border:`1px solid ${C.border}`, borderRadius:12, background:C.bg, padding:'6px 9px' };
            const lib = { fontSize:11, fontWeight:600, color:C.muted, letterSpacing:'.01em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' };
            const valeur = { fontSize:13, fontWeight:600, color:C.text, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' };
            const mn = e.min==null||String(e.min).trim()===''?null:Number(String(e.min).replace(',','.'));
            const rf = e.refuse==null||String(e.refuse).trim()===''?null:Number(String(e.refuse).replace(',','.'));
            // (29 oct.) Les gestes de la fiche : hauteur posée par la feuille de style
            // (`.vrm-fiche-geste` : 36 px à la souris, 44 px au doigt — §7).
            const geste = { border:`1px solid ${C.border}`, background:'transparent', color:C.text, borderRadius:12, padding:'0 11px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', boxSizing:'border-box' };
            // La préparation pour Leboncoin, COURTE sur la carte (§7 : « passe sur
            // Vinted (ce compte) » écrit sur 40 cartes serait une phrase répétée) ;
            // le geste est dans l'infobulle.
            // (29 oct., revue) Raccourcir la phrase ne suffisait pas : chez lui ~125
            // fiches sur 179 auraient porté « photos pas encore captées ». L'état
            // COMMUN se dit une fois au-dessus de la grille (`annStats.prepaCommun`).
            const prepaEtat = etatPrepaLbc(item, num);
            const prepa = prepaEtat && (prepaEtat.code === 'partielle' || prepaEtat.code !== annStats.prepaCommun) ? prepaEtat.texte : null;
            const tailleHorsTitre = it.size && !tailleDansTitre(it.title, it.size) ? it.size : '';
            // (1er nov., Julien : « trop de cases empilées sous la photo » — maquette Vitrine)
            // AU TÉLÉPHONE la fiche se lit : photo + N°, nom + taille, prix, une ligne
            // discrète (état · vues · favoris · âge). Le prix d'achat MANQUANT reste à la
            // vue (le seul geste ambre, §7) ; tout le reste — l'état en jauge, mini,
            // refuse, boost, marge, l'achat relié, le stock, la file Leboncoin, Relier,
            // Passeport, Marquer vendue — passe sous « Plus d'actions ». RIEN n'est
            // supprimé : les MÊMES éléments, les mêmes écritures, les mêmes data-*,
            // seulement repliés (styles-annonces-fiche.css). L'ordinateur ne change pas.
            const ouverte = fichesOuvertes.has(String(it.id));
            const idRepli = `fiche-plus-${it._acc.vinted_user_id}-${it.id}`;
            // (10 nov., lot AM) Ouvrir / fermer la vignette (le même état que « Détails et gestes ») ; ouverte, elle
            // prend toute la largeur : on la garde à l'écran.
            const cleCarte = it._acc.vinted_user_id+'_'+it.id;
            const basculerFiche = () => { const k=String(it.id); const ouvrir = !fichesOuvertes.has(k);
              setFichesOuvertes(x=>{ const n=new Set(x); if(n.has(k)) n.delete(k); else n.add(k); return n; });
              if (ouvrir) requestAnimationFrame(()=>{ try { const el=document.querySelector(`[data-vignette-cle="${CSS.escape(cleCarte)}"]`); if (el) el.scrollIntoView({block:'nearest',behavior:'smooth'}); } catch (_) {} }); };
            const remiseIci = remisesParts.sur.get(String(it.id)) || null;
            const enDouble = annEnDouble.has(String(it.id));
            const achatConnu = achat!=null && !isNaN(achat);
            // (1er nov., banc tous-boutons) La photo promet « Ouvrir l'annonce sur
            // Vinted » : sans `url` lue, le lien n'avait AUCUNE adresse (un clic
            // mort). L'adresse se refait par l'identité de l'annonce (son id, sur
            // le domaine du compte) ; sans id numérique, la photo n'est pas un lien.
            const urlFiche = it.url || (/^\d+$/.test(String(it.id)) ? `https://${(it._acc && it._acc.domain) || 'www.vinted.fr'}/items/${it.id}` : '');
            return (
              <div className="vrm-ann-card vrm-fiche vrm-vignette" key={cleCarte} data-carte-annonce={it.id} data-fiche="29oct" data-fiche-ouverte={ouverte?'1':'0'} data-vignette-cle={cleCarte} data-vignette-double={enDouble?'1':undefined}
                onClick={(ev)=>{ if (ouverte) return; const t = ev.target; if (t && t.closest && t.closest('a,button,input,select,textarea,label,[data-edition],[role="dialog"]')) return; basculerFiche(); }}
                style={{borderRadius:12,background:C.card,border:`1px solid ${soldBord?C.warn:C.border}`,boxShadow:C.shadow||'none',display:'flex',flexDirection:'column',overflow:'hidden',...(estFloute(it)?STYLE_FLOU:null)}}>
                <div className="vrm-ann-overview" style={{display:'flex',flexDirection:'column',position:'relative'}}>
                  <a className="vrm-fiche-photo" data-fiche-photo href={urlFiche||undefined} target={urlFiche?'_blank':undefined} rel="noreferrer" title={urlFiche?tr('annonces.ouvrirAnnonceVinted'):undefined} style={{display:'flex',alignItems:'center',justifyContent:'center',position:'relative',background:C.bg}}>
                    {/* (10 nov., lot P) Le nom lu du lien : QUELLE annonce (et, après, ses pastilles d'état « En double »…). */}
                    {urlFiche && <span className="vrm-sr">{`Ouvrir sur Vinted : ${it.title || it.brand || 'l’annonce'}. `}</span>}
                    {it.photo?<PhotoVinted src={it.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<PhotoVide remplir rayon={0}/>}
                    {it._vrmAConfirmer && <span data-ann-a-confirmer="" title={tr('annonces.compteEteRelu')} style={{position:'absolute',right:10,top:10,fontSize:11,fontWeight:600,whiteSpace:'nowrap',color:C.text,background:C.card,border:`1px solid ${C.warn || C.border}`,borderRadius:999,padding:'4px 9px'}}>{tr('annonces.confirmer3')}{it._vrmAConfirmerLu ? ` · lu ${new Date(it._vrmAConfirmerLu).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}` : ''}</span>}
                    {enDouble && <span className="vrm-vignette-marque is-ambre" data-vignette-en-double="" title={`${motsVendeur().Meme} est en ligne deux fois sur Vinted (même photo) : retire celle en trop sur vinted.fr — l'alerte au-dessus les nomme`}>{tr('annonces.double')}</span>}
                    {it.promoted===true && <span data-boostee title={tr('annonces.vintedDitAnnonce')} style={{position:'absolute',left:10,bottom:10,fontSize:11,fontWeight:600,whiteSpace:'nowrap',color:C.text,background:C.card,border:`1px solid ${C.border}`,borderRadius:999,padding:'4px 9px'}}>{tr('annonces.boostee')}</span>}
                  </a>
                  {/* (31 oct., Vitrine) Le N° de rangement SUR la photo, en haut à
                      gauche, comme l'étiquette du carton : une pastille à chasse
                      fixe. HORS du lien de la photo (un bouton dans un lien ne se
                      touche pas) ; la MÊME édition en place qu'avant (`EnLigne`,
                      `poserNumero`) — un tap sur la pastille, on tape, Entrée. */}
                  {/* (5 nov., chantier C — revue 2.8) La pastille partagée `Numero` (rayon 6,
                      chiffres alignés ; jamais blanche en sombre), la même que partout. */}
                  <span className="vrm-fiche-numero" data-fiche-num={num||''}>
                    <EnLigne data="numero" value={num} onCommit={(v,avant)=>poserNumero(item,v,avant)} inputMode={clavierNum()} placeholder={String(nextNumero)} largeur={46}
                      titre={tr('annonces.numeroRangementEcrit')} rendu={num?<Numero n={num} taille="grand" titre={tr('annonces.numeroChanger', { num: String(num) })}/>:<span className="vrm-fiche-num-vide">+ N°</span>}/>
                  </span>
                  <div className="vrm-ann-ledger-info" style={{display:'flex',flexDirection:'column',gap:8}}>
                    <div data-titre style={{fontSize:15,fontWeight:600,color:C.text,lineHeight:1.35,overflowWrap:'anywhere'}}>{it.title||it.brand||'—'}{tailleHorsTitre ? <span data-titre-taille=""> · {tailleHorsTitre}</span> : null}</div>
                    {/* (10 nov., lot BD) La note privée de la paire, par SON identité (N°, sinon l'annonce). */}
                    <NotePaireCoque numero={num} itemId={it.id} recreeDe={e && e.recreeDe} ajout rangee/>
                    {remiseIci ? carteRemise(remiseIci, true) : null}
                    <div className="vrm-ann-price-line" style={{display:'flex',alignItems:'center',gap:10}}>
                      <span data-prix style={{fontSize:22,fontWeight:700,color:C.text,fontVariantNumeric:'tabular-nums',letterSpacing:'-.02em'}}>{prix(it.price,it.currency)||'—'}</span>
                    </div>
                    {/* L'ÉTAT EN JAUGE, et JUSTE À CÔTÉ le prix d'achat qu'on tape en place. */}
                    <div className="vrm-fiche-duo" data-fiche-duo style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:8}}>
                      <div className="vrm-fiche-cell vrm-fiche-etat" data-fiche-etat style={cell}>
                        <JaugeEtat statut={it.condition} lib={<span style={lib}>{tr('ventes.etat')}</span>}/>
                      </div>
                      <div className="vrm-fiche-cell vrm-fiche-achat" data-fiche-achat={achatConnu?'connu':'inconnu'} style={cell}>
                        <span className="vrm-fiche-etat-haut"><span style={lib}>{tr('annonces.prixAchat')}</span><Icon name="pencil" size={12} style={{color:C.muted,flexShrink:0}}/></span>
                        <EnLigne data="achat" value={buy} onCommit={v=>String(v??'').trim() ? ecrirePrixTape(item, v) : updatePair(item,{buyPrice:'',buyFromId:null,buyFrom:null})} inputMode="decimal" placeholder={achat!=null&&!isNaN(achat)?String(achat):'€'} largeur={72}
                          titre={tr('annonces.prixAchatTouche')} rendu={<span data-vide={achat!=null&&!isNaN(achat)?undefined:''} style={{...valeur,fontSize:15}}>{achat!=null&&!isNaN(achat)?prixCourt(achat):'—'}</span>}/>
                      </div>
                    </div>
                    {/* Les chiffres, TOUS libellés ; « — » quand on ne sait pas, jamais 0 (§7). */}
                    <div data-chiffres className="vrm-fiche-chiffres" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6}}>
                      <div className="vrm-fiche-cell" style={cell} title={tr('annonces.prixMiniOffre')}>
                        <span style={lib}>{tr('annonces.accepter2')}</span>
                        <EnLigne data="min" value={e.min??''} onCommit={v=>updatePair(item,{min:montantSeuil(v)})} inputMode="decimal" placeholder="€" largeur={56}
                          titre={tr('annonces.prixMiniAcceptation')} rendu={<span data-vide={mn!=null&&isFinite(mn)&&mn>0?undefined:''} style={valeur}>{mn!=null&&isFinite(mn)&&mn>0?prixCourt(mn):'—'}</span>}/>
                      </div>
                      <div className="vrm-fiche-cell" style={cell} title={tr('annonces.seuilRefusAcceptation')}>
                        <span style={lib}>{tr('annonces.refuserSous2')}</span>
                        <EnLigne data="refuse" value={e.refuse??''} onCommit={v=>updatePair(item,{refuse:montantSeuil(v)})} inputMode="decimal" placeholder="€" largeur={56}
                          titre={tr('annonces.seuilRefusOffre')} rendu={<span data-vide={rf!=null&&isFinite(rf)&&rf>0?undefined:''} style={valeur}>{rf!=null&&isFinite(rf)&&rf>0?prixCourt(rf):'—'}</span>}/>
                      </div>
                      <div className="vrm-fiche-cell" style={cell} title={tr('annonces.coutBoostMise')}>
                        <span style={lib}>{tr('annonces.boostPaye')}</span>
                        <EnLigne data="boost" value={e.fees ?? ''} onCommit={v=>updatePair(item,{fees:v})} inputMode="decimal" placeholder="€" largeur={56}
                          titre={tr('annonces.boostPayeTouche')} rendu={<span data-vide={boost>0?undefined:''} style={valeur}>{boost>0?prixCourt(boost):'—'}</span>}/>
                      </div>
                      <div className="vrm-fiche-cell" style={cell} title={tr('annonces.partPrixPrix')}>
                        <span style={lib}>{tr('annonces.marge')}</span>
                        <span data-marge={marge==null?'':String(marge)} style={{...valeur,color:marge!=null&&marge<0?C.warn:marge==null?C.muted:C.text}}>{marge==null?'—':montant(marge,{signe:true})}</span>
                      </div>
                    </div>
                    <div data-etat-ligne style={{fontSize:12,color:C.muted,display:'flex',alignItems:'center',flexWrap:'wrap',gap:'4px 12px',minWidth:0}}>
                      <span data-stats-annonce style={{display:'inline-flex',flexWrap:'wrap',alignItems:'center',gap:'2px 12px'}}>
                        {it.condition ? <span className="vrm-fiche-etat-court" data-etat-court="">{String(it.condition)}</span> : null}
                        {it.views!=null && <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="eye" size={13}/>{it.views}</span>}
                        {it.favourites!=null && <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="heart" size={13}/>{it.favourites}</span>}
                        {age!=null && <span title={tr('annonces.ligneDepuisJours', { age: String(age) })} style={{color:sleeps?C.warn:C.muted,fontWeight:sleeps?600:400}}>{age} j{sleeps?tr('annonces.dort'):''}</span>}
                        {!annUnCompte && <span data-stats-compte="" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:140}}>{accNameOf(it._acc)}</span>}
                      </span>
                      {/* La présence AILLEURS, prouvée seulement (Vinted : l'en-tête le dit une fois). */}
                      <span data-plateformes style={{display:'inline-flex',alignItems:'center',gap:4,marginLeft:'auto',flexShrink:0}}>
                        <MarquePlateforme p="vinted"/>
                        {/* (11 nov.) « aussi sur Leboncoin · eBay · Vestiaire » : chaque site PROUVÉ par identité (src/publierPartout.js `aussiSur`). */}
                        {(() => { const l = aussiSur({ lbc: !!ailleurs, ebay: !!(num && ebayNums.has(cleNum(num))), vestiaire: !!(num && vcNumsAnn.has(cleNum(num))) });
                          return <>{l.map((x) => <MarquePlateforme key={x} p={x}/>)}{l.length ? <span data-aussi-sur={l.join(',')} className="vrm-sr">{tr('partout.aussiSur', { sites: texteAussiSur(l).replace(/^aussi sur /, '') })}</span> : null}</>; })()}
                      </span>
                    </div>
                    {soldBord && <div title={tr('annonces.bordereauEnvoiEte')} style={{fontSize:12,fontWeight:600,color:C.warn}}>{tr('annonces.vendueBordereauRecu')}</div>}
                    {/* Téléphone seulement (caché sur ordinateur, où tout reste à la vue). */}
                    {/* (10 nov., lot P) Au lecteur d'écran, le bouton dit QUELLE paire il ouvre (« N°12, titre, 65 € »). */}
                    <button type="button" className="vrm-fiche-plus-bouton" data-fiche-plus-bouton="" aria-expanded={ouverte} aria-controls={idRepli}
                      aria-label={`${ouverte ? 'Moins de détails' : 'Détails et gestes'} — ${num ? 'N°' + num + ', ' : ''}${it.title || it.brand || 'annonce'}, ${prix(it.price,it.currency) || 'prix pas lu'}`}
                      onClick={basculerFiche}>
                      <span>{ouverte ? tr('annonces.moinsDetails') : tr('annonces.detailsGestes')}</span><Icon name="chevron" size={14} style={{transform:ouverte?'rotate(-90deg)':'rotate(90deg)',transition:'transform .15s'}}/>
                    </button>
                  </div>
                </div>
                {/* CE QUI ÉTAIT DANS « ⋯ Gérer l'annonce », À LA VUE (29 oct.) : l'achat
                    relié, le stock, Leboncoin (la file et sa préparation), les gestes. */}
                <div className="vrm-fiche-plus" id={idRepli} data-fiche-plus style={{display:'flex',flexDirection:'column',gap:8,borderTop:`1px solid ${C.border}`}}>
                  <AchatRelie entry={e} numero={num}/>
                  {/* (5 nov., chantier C — revue 2.6) DEUX gestes à la vue, le reste dans « … ».
                      La carte d'ordinateur portait neuf boutons. « Changer le prix » et « Baisser
                      à X € » ne font plus qu'un (le prix conseillé est dit DANS le geste, sans
                      bleu : l'accent reste rare, §7). « … » ouvre une feuille : la file
                      Leboncoin, Relier un achat, Passeport, Relier à Vestiaire, Histoire ·
                      Dupliquer, Marquer vendue — les MÊMES gestes, les mêmes écritures. */}
                  <div className="vrm-fiche-gestes" data-fiche-gestes="" data-fiche-gestes-n={num ? 2 : 1}>
                    {num
                      ? <button type="button" className="vrm-fiche-geste vrm-fiche-geste-prix" data-annonce-prix-partout={num} onClick={()=>{ try { window.dispatchEvent(new CustomEvent('vrm:prix-partout',{detail:String(num)})); } catch (_) {} }} style={geste}
                          title={conseil ? tr('annonces.suggestionRienChange', { raison: String(conseil.raison) }) : tr('annonces.prixTousSites')}>
                          {tr('annonces.changerPrix')}{conseil ? <span className="vrm-fiche-geste-sous" data-prix-conseille={sugg} data-conseil-raison={conseil.raison}>{conseil.phrase}<span className="vrm-fiche-geste-raison"> · {conseil.raison}</span></span> : null}</button>
                      : <a className="vrm-fiche-geste vrm-fiche-geste-prix" href={urlFiche ? `${urlFiche.replace(/\/$/,'')}/edit` : undefined} target="_blank" rel="noreferrer" data-annonce-prix-vinted="" style={geste}
                          title={tr('annonces.sansPrixChange')}>{tr('annonces.changerPrix2')}{conseil ? <span className="vrm-fiche-geste-sous" data-prix-conseille={sugg} data-conseil-raison={conseil.raison}>{conseil.phrase}<span className="vrm-fiche-geste-raison"> · {conseil.raison}</span></span> : null}</a>}
                    {num && (
                      <button type="button" className="vrm-fiche-geste" data-fiche-stock={atGarage?'range':'a-ranger'} onClick={()=>atGarage?(onLocate&&onLocate(num)):(onStore&&onStore(num))} style={geste}
                        title={atGarage?tr('annonces.rangeeDansStock', { num: String(num) }):tr('annonces.encoreRangeeDans', { num: String(num) })}>
                        <Icon name="box" size={14}/>{atGarage?tr('ventes.voirStock'):tr('annonces.rangerStock')}
                      </button>
                    )}
                    <button type="button" className="vrm-fiche-geste vrm-fiche-geste-plus" data-fiche-menu-ouvrir={String(it.id)} aria-haspopup="dialog" aria-label={tr('annonces.autresGestes')} title={tr('annonces.autresGestesLeboncoin')}
                      onClick={()=>setFicheMenu(String(it._acc.vinted_user_id)+'_'+String(it.id))} style={geste}><Icon name="more" size={18}/></button>
                  </div>
                  {ficheMenu===String(it._acc.vinted_user_id)+'_'+String(it.id) && (
                  <SheetShell onClose={()=>setFicheMenu(null)} maxWidth={420} titre={it.title||it.brand||tr('annonces.annonce2')} sousTitre={num ? <Numero n={num} taille="petit"/> : tr('annonces.sansTouchePhoto')} data-fiche-menu={String(it.id)}>
                  <div className="vrm-fiche-menu" onClickCapture={(ev)=>{ const b = ev.target && ev.target.closest && ev.target.closest('button,a'); if (b && !b.hasAttribute('data-fiche-place')) setTimeout(()=>setFicheMenu(null), 0); }}>
                    {MP_PLACES_UI.map(pl => {
                      const on = mpChoisi(e, pl.cle);
                      // (29 oct., revue) Une paire PROUVÉE sur Leboncoin (`ailleurs` : la
                      // marque Leboncoin est déjà sur la fiche) n'a pas de bascule « À publier
                      // sur Leboncoin » — deux affirmations contraires sur la même fiche.
                      // Et le geste reste NEUTRE (Leboncoin est coché par défaut : l'accent
                      // sur chaque fiche ne serait plus rare, §7) : coché = encre, retiré = gris.
                      if (pl.cle === 'lbc' && ailleurs) return null;
                      return (
                        <button key={pl.cle} type="button" className="vrm-fiche-geste" data-fiche-place={pl.cle} data-fiche-place-etat={on?'on':'off'} aria-pressed={on}
                          onClick={()=>updatePair(item,{ mp: { ...(e.mp||{}), [pl.cle]: !on } })}
                          title={!num
                            ? tr('annonces.metsArticleAbord', { nom: String(pl.nom) })
                            : on ? tr('annonces.dansFileClique', { nom: String(pl.nom) })
                                 : tr('annonces.iraCliqueMettre', { nom: String(pl.nom) })}
                          style={{...geste,color:on?C.text:C.muted}}>
                          {/* (30 oct.) Le libellé dit l'ÉTAT, pas un ordre : coché, « À publier sur X »
                              se lisait comme un statut et ne changeait que d'une coche. */}
                          {on ? <>{tr('annonces.dansFile')} {pl.nom} ✓</> : <>{tr('annonces.ajouterFile')} {pl.nom}</>}
                        </button>
                      );
                    })}
                    {/* (11 nov.) « Publier partout » : depuis CETTE annonce Vinted, Leboncoin · Vestiaire · eBay (src/publierPartout.js). */}
                    {num && <button type="button" className="vrm-fiche-geste" data-fiche-partout={num} onClick={()=>{ try { window.dispatchEvent(new CustomEvent('vrm:publier-partout',{detail:{nums:[String(num)]}})); } catch (_) {} }} style={geste}>{tr('partout.entree')}</button>}
                    {/* (11 nov., lot visuels-reseaux) Un visuel carré / story de CETTE annonce (src/composants/VisuelsReseaux.jsx). */}
                    <button type="button" className="vrm-fiche-geste" data-fiche-visuels={String(it.id)} onClick={()=>{ try { window.dispatchEvent(new CustomEvent('vrm:visuels',{detail:{ items:[it] }})); } catch (_) {} }} style={geste}>{tr('visuels.titre')}</button>
                    <button type="button" className="vrm-fiche-geste" data-fiche-relier-achat="" onClick={()=>openPicker(item)} style={geste}>{tr('ventes.relierAchat2')}</button>
                    <button type="button" className="vrm-fiche-geste" data-fiche-passeport="" onClick={()=>setPassportFor({it,e,num})} style={geste}>{tr('annonces.passeport')}</button>
                    {num && <GesteLienVcVinted it={it} num={num} style={geste}/>}
                    {/* (3 nov.) L'histoire de CE N° et sa copie (N° neuf). */}
                    {num && <button type="button" className="vrm-fiche-geste" data-annonce-histoire={num} onClick={()=>{ try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire',{detail:String(num)})); } catch (_) {} }} style={geste}>{tr('annonces.histoireDupliquer')}</button>}
                    {/* (11 nov.) « Me le rappeler » : par le N° et l'identifiant de l'annonce (§5). */}
                    <BoutonRappel variante="geste" style={geste} cible={{ sorte: 'article', num: num || '', item: String(it.id || '') }} libelle={num ? `N°${num}` : (it.title || '')}/>
                    <button type="button" className="vrm-fiche-geste" data-fiche-vendue="" onClick={()=>{ gesteVendues([it.id], true); }} title={tr('annonces.marquerVendueRetire')} style={geste}>{tr('annonces.marquerVendue')}</button>
                  </div>
                  </SheetShell>
                  )}
                  {/* (29 oct., revue) « il lui faut un N° pour aller sur Leboncoin »
                      était écrit sur CHAQUE fiche sans N° (§7) : la pastille « + N° »
                      de la fiche le montre déjà, et la raison se dit UNE fois
                      au-dessus de la grille (`data-sans-num`). */}
                  {prepa && (
                    <div data-fiche-infos style={{fontSize:12,color:C.muted,lineHeight:1.35}}>
                      {prepa && <span data-prepa={prepaEtat.code} title={/prête/.test(prepa) ? tr('annonces.photosDescriptionCaptees') : tr('annonces.passeVintedConnecte')}>Leboncoin : {prepa}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })]; })}
        </div>
        <SuitePaquets montres={Math.min(annMax, annShown.length)} total={annShown.length} onPlus={annPlus}/>
        </>)}
          </>)}
        {listings.items && listings.items.length>0 && (<details className="vrm-ann-stock-tools"><summary aria-label={tr('annonces.stockAjustements')}><span className="vrm-label-full">{tr('annonces.stockAjustements')}</span><span className="vrm-label-short" aria-hidden="true">{tr('nav.garage')}</span></summary>
          {/* FRAÎCHEUR : l'extension ne capte que quand tu navigues sur Vinted.
              Si elle n'a rien capté depuis longtemps, on le DIT (avant, l'app
              affichait un instantané périmé en le faisant passer pour du direct
              → une paire vendue restait « en ligne » indéfiniment). */}
          {/* ⚠️ LE BANDEAU « N j SANS CAPTURE » EST SUPPRIMÉ — DOUBLON.
              Il disait exactement ce que dit déjà la ligne « X annonces
              viennent d'un compte dont les données datent », posée juste sous
              les puces de comptes (donc à côté de l'information qu'elle
              qualifie, et repliée). Deux blocs pour la même notion (§11), dont
              un plein écran au-dessus de la grille. */}
          {/* Le bandeau « N prix planchers posés, mais rien ne les applique » est
              RETIRÉ avec l'acceptation automatique des offres (5 octobre, à sa
              demande) : il n'y a plus rien à appliquer. */}
          {numeroReprises.length > 0 && (
            <div data-reprises-num={numeroReprises.length} style={{marginBottom:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px'}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{trj('annonces.articlesDejaConnus', { n: numeroReprises.length })}</div>
              {/* ⚠️ Une paire VENDUE n'est jamais remise à son ancien numéro toute
                  seule : elle est partie, et si elle revient (litige, retour) elle
                  revient dans un autre carton. On le PROPOSE, il tranche. */}
              <div style={{fontSize:11,color:C.muted,marginBottom:8,lineHeight:1.45}}>{tr('annonces.cesAnnoncesOnt')}</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {numeroReprises.slice(0,8).map((r,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:9,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'7px 9px'}}>
                    <div style={{width:34,height:34,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {r.item.photo?<PhotoVinted src={r.item.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<PhotoVide taille={34} rayon={0}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.item.title}</div>
                      <div style={{fontSize:11,color:C.muted,fontWeight:500,marginTop:2,display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}><Numero n={r.current.numero} taille="petit"/> {tr('annonces.neuf')} <Numero n={r.orphan.e.numero} taille="petit"/>{garageCellOf(garageGrid,r.orphan.e.numero)?` · ${garageCellLabel(garageCellOf(garageGrid,r.orphan.e.numero))}`:''}</div>
                      {r.vendue && <div style={{fontSize:11,color:C.warn,fontWeight:600,marginTop:2}}>{trj('annonces.articleEteVendu', { numero: r.orphan.e.numero })}</div>}
                    </div>
                    <Bouton variante="secondaire" taille="petit" onClick={()=>applyReprise(r)} style={{flexShrink:0}}>{trj('annonces.remettre', { numero: r.orphan.e.numero })}</Bouton>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* ── L'EN-TÊTE (3 octobre, « trop brouillon ») ───────────────────────
              Huit pastilles en rang, toutes encadrées, se lisaient comme huit
              choses à faire. Les CHIFFRES (combien en ligne, valeur, favoris,
              vues) sont une ligne de texte neutre ; seules les pastilles qui
              demandent un GESTE restent des pastilles. §7 : la couleur est
              réservée à ce qui est à rattraper. */}
          <div data-ann-resume style={{fontSize:13,color:C.muted,marginBottom:8,lineHeight:1.5}}>
            <b style={{color:C.text,fontWeight:700}}>{trj('annonces.ligneVinted', { x: annStats.n })}</b>
            {annStats.aussiLbc>0?tr('annonces.aussiLeboncoin2', { aussiLbc: String(annStats.aussiLbc) }):''}
            {annStats.boostees>0?tr('annonces.boostees', { n: String(annStats.boostees) }):''}
            {annStats.valConnus>0 ? <span data-ann-valeur={Math.round(annStats.val)} data-ann-valeur-sur={annStats.valConnus<annStats.n?annStats.valConnus:undefined}>{` · ${annStats.valConnus<annStats.n?'au moins ':''}${montant(annStats.val, { centimes: 'jamais' })} de valeur${annStats.valConnus<annStats.n?` (prix lu sur ${annStats.valConnus})`:''}`}</span> : null}
            {annStats.hasFav?<> · <Icon name="heart" size={12} style={{verticalAlign:'-2px'}}/> {annStats.favs}</>:null}
            {annStats.hasView?<> · <Icon name="eye" size={12} style={{verticalAlign:'-2px'}}/> {annStats.views}</>:null}
            {annStats.pretLbc>0 && (annStats.aRecapturer===0 || annStats.prepaCommun==='prete') ? <span data-prepa-pretes={annStats.pretLbc}>{tr('annonces.pretesLeboncoin', { pretLbc: String(annStats.pretLbc) })}</span> : ''}
          </div>
          <div className="vrm-rangee" style={{display:'flex',gap:8,marginBottom:10,alignItems:'center',WebkitOverflowScrolling:'touch',scrollbarWidth:'none',msOverflowStyle:'none',paddingBottom:2}}>
            {annStats.sansNum>0 && <span data-sans-num={annStats.sansNum} title={`Le N° est la référence qui retrouve ${motsVendeur().le} sur Leboncoin : touche « + N° » sur sa fiche.`} style={{flexShrink:0,whiteSpace:'nowrap',fontSize:12,fontWeight:600,color:C.warn,background:`${C.warn}14`,border:`1px solid ${C.warn}55`,borderRadius:12,padding:'4px 11px'}}>{trj('annonces.sansLeurFaut', { n: annStats.sansNum })}</span>}
            {/* ⚠️ « Toute l'annonce captée ? » — même base que la grille (§11). */}
            {annStats.aRecapturer>0 && <span data-prepa-resume={annStats.aRecapturer} data-prepa-commun={annStats.prepaCommun||''} title={tr('annonces.articleOntToutes', { pretLbc: String(annStats.pretLbc), aRecapturer: String(annStats.aRecapturer) })} style={{flexShrink:0,whiteSpace:'nowrap',fontSize:12,fontWeight:600,color:C.warn,background:`${C.warn}14`,border:`1px solid ${C.warn}55`,borderRadius:12,padding:'4px 11px'}}>{trj('annonces.recapturerLeboncoin', { aRecapturer: annStats.aRecapturer })}</span>}
            {/* Une paire qui dort se rattrape : de l'ambre, jamais du rouge (§5.56). */}
            {annStats.sleeping>0 && <button type="button" onClick={()=>setAnnSort('sleeping')} style={{flexShrink:0,whiteSpace:'nowrap',fontSize:12,fontWeight:600,color:C.warn,background:`${C.warn}14`,border:`1px solid ${C.warn}55`,borderRadius:12,padding:'4px 11px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5}}><Icon name="sleep" size={13}/>{annStats.sleeping} {tr('annonces.dorment2')}{annStats.sleepingVal>0?` · ${annStats.sleepingVal.toFixed(0)}\u00a0€`:''}</button>}
            <Bouton variante="secondaire" taille="petit" icone="spark" onClick={()=>setShowLister(true)} title={tr('annonces.titreDescriptionPrets')} style={{flexShrink:0}}>{tr('annonces.aideVente')}</Bouton>
          </div>
          {/* ── CONSEILS ET SIGNALEMENTS : repliés ─────────────────────────
              Cinq bandeaux s'empilaient ici avant la liste des annonces (vendues
              auto, marquées vendues, qui dorment, dates inconnues, repricing).
              Ils sont regroupés derrière un seul bouton avec un compteur : on voit
              qu'il y a quelque chose à regarder, sans que ça mange l'écran. */}
          {(()=>{
            const n = (emailSoldIds.size>0?1:0) + (soldManual.size>0?1:0)
              + ((annStats.sleeping>0 && annSort!=='sleeping')?1:0)
              + ((annStats.n>0 && annStats.datesKnown===0)?1:0)
              + (repriceList.length>0?1:0)
              + nAutresSignalements
              + ((retoursSuivis.etat==='lu'&&retoursSuivis.lignes.length>0)?1:0);
            if (!n) return null;
            return (
              <button type="button" onClick={()=>setTipsOpen(v=>!v)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:8,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 14px',marginBottom:10,cursor:'pointer',fontFamily:'inherit',boxShadow:C.shadow||'none'}}>
                <span style={{display:'inline-flex',color:C.muted}}><Icon name="spark" size={15}/></span>
                <span style={{flex:1,textAlign:'left',fontSize:13,fontWeight:600,color:C.text}}>{tr('annonces.conseilsSignalements')}</span>
                <span style={{fontSize:11,fontWeight:700,color:C.onAccent,background:C.accent,borderRadius:12,padding:'1px 8px'}}>{n}</span>
                <span style={{fontSize:13,color:C.muted,transform:tipsOpen?'rotate(90deg)':'none',transition:'transform .2s ease'}}>›</span>
              </button>
            );
          })()}
          {tipsOpen && (<>
          {/* Les paires qui reviennent (retour, litige) : une liste de
              travail, donc ici et pas au-dessus du stock. */}
          {/* (21 octobre) Les retours se suivent dans Colis → « Retours en cours »
              (une seule voix, §7) : ici, une ligne qui y mène. */}
          {retoursSuivis.etat==='lu' && retoursSuivis.lignes.length > 0 && (
            <button type="button" data-retours-renvoi={retoursSuivis.lignes.length} onClick={()=>onNav&&onNav('cat_bord')}
              style={{width:'100%',minHeight:44,display:'flex',alignItems:'center',gap:8,marginBottom:10,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'8px 12px',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
              <span style={{flex:1,minWidth:0,fontSize:13,fontWeight:600,color:C.text}}>{trj('annonces.articlesReviennentSuivis', { n: retoursSuivis.lignes.length })}</span>
              <span style={{fontSize:13,color:C.muted}}>›</span>
            </button>
          )}
          {/* Les signalements (compte muet, annonces disparues, comptes
              refusés) vivent ici : un seul panneau à ouvrir. */}
        {/* COMPTE MUET : il a des paires numérotées mais ne renvoie plus AUCUNE
            annonce. C'est la signature d'un masquage par Vinted. On le dit tout
            de suite, sinon on croit avoir perdu son stock. */}
        {comptesMuets.map(m=>(
          <div key={m.uid} style={{marginBottom:12,border:`1px solid ${C.warn}`,background:`${C.warn}10`,borderRadius:12,padding:'11px 13px'}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>{trj('annonces.renvoiePlusAucune', { accNameOf: accNameOf(m.acc) })}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:4,lineHeight:1.5}}>
              {m.nb} {tr('achats.article')}{m.nb>1?'s':''} {tr('annonces.numerote')}{m.nb>1?'s':''} {tr('annonces.compteZeroAnnonce')} <b>{tr('annonces.vintedMasqueCompte')}</b> {tr('annonces.quelquesJoursNumeros')}
            </div>
          </div>
        ))}
        {/* ANNONCES DISPARUES SANS VENTE : ni vendues, ni en ligne. Masquées par
            Vinted, ou retirées à la main. On les sort de « en ligne » (déjà fait
            par annBase) et on te laisse décider de leur sort. */}
        {disparues.length>0 && (()=>{
          const [ouvert, setOuvert] = [dispOpen, setDispOpen];
          return (
          <div style={{marginBottom:12,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 13px'}}>
            <button type="button" onClick={()=>setOuvert(v=>!v)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',border:'none',background:'transparent',padding:0,cursor:'pointer',fontFamily:'inherit'}}>
              <span aria-hidden="true" style={{flexShrink:0,color:C.muted,display:'flex'}}><Icon name="eye" size={17}/></span>
              <span style={{flex:1,minWidth:0}}>
                <span style={{display:'block',fontSize:13,fontWeight:600,color:C.text}}>{trj('annonces.annoncesDisparuesSans', { n: disparues.length })}</span>
                <span className="vrm-aide" style={{display:'block',fontSize:11,color:C.muted,marginTop:2}}>{tr('annonces.plusLigneAucune')}</span>
              </span>
              <span style={{color:C.muted,fontSize:17}}>{ouvert?'▾':'▸'}</span>
            </button>
            {ouvert && (
              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:7}}>
                {disparues.slice(0,40).map(d=>(
                  <div key={d.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderTop:`1px solid ${C.border}`}}>
                    <div style={{width:34,height:34,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden'}}>
                      {d.e.photo && <PhotoVinted src={d.e.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>N°{d.numero} · {d.e.title||'—'}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:1}}>{inGarage(d.numero) ? tr('annonces.rangeeStock') : tr('annonces.stock')}</div>
                    </div>
                    <button type="button" title={tr('annonces.articlePlusVendre')}
                      onClick={()=>{ declarerPartie(d.id, d.numero, d.e.title||''); toast(tr('annonces.retireeStock', { numero: String(d.numero) })); }}
                      style={{flexShrink:0,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'6px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                      {tr('achats.retirer')}
                    </button>
                  </div>
                ))}
                {disparues.length>40 && <div style={{fontSize:11,color:C.muted,paddingTop:6}}>{trj('annonces.autres2', { x: disparues.length-40 })}</div>}
                <div style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.5}}>
                  {tr('annonces.retirerLibereNumero')}
                </div>
              </div>
            )}
          </div>
          );
        })()}
        {blocMasquees()}
        {/* Compte bloqué par Vinted : détecté à la synchro (401/403). Ses annonces
            sont retirées automatiquement — on te dit lequel et tu peux le retirer. */}
        {blockedList.length>0 && (
          <div style={{marginBottom:12,border:`1px solid ${C.danger}`,background:`${C.danger}10`,borderRadius:12,padding:'11px 13px'}}>
            {blockedList.map(a=>(
              <div key={a.vinted_user_id} style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <span style={{fontSize:20}}>🚫</span>
                <div style={{flex:1,minWidth:160}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.danger}}>{trj('annonces.compteBloqueVinted', { accNameOf: accNameOf(a) })}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:1}}>{tr('annonces.annoncesOntEte')}</div>
                </div>
                <button type="button" onClick={async ()=>{ if(await askConfirm({title:tr('annonces.deconnecter', { accNameOf: String(accNameOf(a)) }), desc:tr('annonces.jetonsAnnoncesVentes'), ok:'Déconnecter', cancel:'Annuler', danger:true})){ const r=await deleteVintedAccount(a.vinted_user_id, a.login); setBlockedAccts(prev=>{ const n=new Set(prev); n.delete(String(a.vinted_user_id)); save('vinted_accounts_blocked',[...n]); return n; }); toast(!r.ok?tr('annonces.echecDeconnexionReessaie'):r.memo?tr('annonces.deconnecteRechargeApp', { accNameOf: String(accNameOf(a)) }):tr('annonces.deconnecteMaisBase', { accNameOf: String(accNameOf(a)) })); } }} style={{flexShrink:0,border:`1px solid ${C.danger}`,background:`${C.danger}14`,color:C.danger,borderRadius:12,padding:'7px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{tr('annonces.deconnecter2')}</button>
              </div>
            ))}
          </div>
        )}
          {emailSoldIds.size>0 && (
            <div style={{fontSize:12,color:C.muted,marginBottom:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:`${INV_STATUS.online.color}0c`,border:`1px solid ${INV_STATUS.online.color}33`,borderRadius:12,padding:'7px 11px'}}>
              <span style={{color:INV_STATUS.online.color,fontWeight:600}}>{trj('annonces.annoncesRetireesAuto', { n: emailSoldIds.size })}</span>
              <span style={{flex:1,minWidth:0}}>{tr('annonces.eMailVente')}</span>
              <button type="button" onClick={()=>setShowEmailSold(v=>!v)} style={{border:'none',background:'transparent',color:C.blue||C.accent,fontWeight:600,cursor:'pointer',fontSize:12,padding:0,fontFamily:'inherit'}}>{showEmailSold?'masquer':'voir'}</button>
            </div>
          )}
          {soldManual.size>0 && (()=>{ const hidden=(listings.items||[]).filter(it=>soldManual.has(String(it.id))); if(!hidden.length) return null; return (
            <div style={{fontSize:12,color:C.muted,marginBottom:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:`${C.warn}0c`,border:`1px solid ${C.warn}33`,borderRadius:12,padding:'7px 11px'}}>
              <span style={{color:C.warn,fontWeight:600}}>{trj('annonces.annoncesMarqueesVendues', { n: hidden.length })}</span>
              <span style={{flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{hidden.map(it=>it.title).join(' · ')}</span>
              <button type="button" data-reafficher-vendues="" onClick={()=>{ gesteVendues(hidden.map(it=>it.id), false); }} style={{border:'none',background:'transparent',color:C.blue||C.accent,fontWeight:600,cursor:'pointer',fontSize:12,padding:0,fontFamily:'inherit'}}>{tr('annonces.annuler')}</button>
            </div>
          ); })()}
          {annStats.sleeping>0 && annSort!=='sleeping' && (
            <div style={{fontSize:12,color:C.text,background:`${C.warn}10`,border:`1px solid ${C.warn}44`,borderRadius:12,padding:'8px 12px',marginBottom:10,lineHeight:1.4}}>
              😴 {annStats.sleeping} {tr('achats.article')}{annStats.sleeping>1?'s':''} {tr('annonces.ligneDepuisPlus')} {SLEEP_DAYS} {tr('annonces.jours')}{annStats.sleepingVal>0?<>{tr('annonces.soit')} <b>{trj('annonces.dorment', { x: annStats.sleepingVal.toFixed(0) })}</b></>:''} {tr('annonces.pense')} <b>{tr('annonces.baisserPrix')}</b> {tr('annonces.texte5')} <b>{tr('annonces.republier3')}</b>. <button type="button" onClick={()=>setAnnSort('sleeping')} style={{border:'none',background:'transparent',color:C.blue||C.accent,fontWeight:600,cursor:'pointer',padding:0,fontSize:12}}>{tr('annonces.voir')}</button>
              {annStats.datesKnown<annStats.n && <div style={{fontSize:11,color:C.muted,marginTop:3}}>{trj('annonces.calculeAnnoncesDont', { n: annStats.datesKnown, x: annStats.n })}</div>}
            </div>
          )}
          {/* Aucune date connue : on le DIT (avant, l'app déduisait l'ancienneté
              de la date de numérotation → chiffres faux, « qui dort » à 0). */}
          {annStats.n>0 && annStats.datesKnown===0 && (
            <div style={{fontSize:12,color:C.text,background:`${C.warn}10`,border:`1px solid ${C.warn}44`,borderRadius:12,padding:'8px 12px',marginBottom:10,lineHeight:1.45}}>
              ⏳ <b>{tr('annonces.ancienneteAnnoncesInconnue')}</b> {tr('annonces.vintedDonnePage')}
            </div>
          )}
          {/* ── Assistant de repricing : liste consolidée à baisser ── */}
          {repriceList.length>0 && (
            <div style={{marginBottom:12,border:`1px solid ${C.warn}66`,background:`${C.warn}0e`,borderRadius:12,overflow:'hidden'}}>
              <button type="button" onClick={()=>setShowReprice(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'11px 13px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                <span style={{fontSize:20}}>🏷️</span>
                <span style={{flex:1,minWidth:0}}>
                  <span style={{display:'block',fontSize:13,fontWeight:700,color:C.text}}>{trj('annonces.repricingArticlesBaisser', { n: repriceList.length })}</span>
                  <span className="vrm-aide" style={{display:'block',fontSize:11,color:C.muted,fontWeight:500}}>{tr('annonces.ligneDepuis30')}</span>
                </span>
                <span style={{fontSize:13,color:C.muted}}>{showReprice?'▲':'▼'}</span>
              </button>
              {showReprice && (
                <div style={{borderTop:`1px solid ${C.warn}33`}}>
                  {repriceList.slice(0,30).map((rp)=>{
                    const {it,price,sugg,why,atFloor} = rp;
                    const num = numeros[it.id]?.numero;
                    const eb = baisseEbayDe(rp);
                    const surLbcAussi = lbcAussi.has(String(it.id));
                    return (
                      <div key={it.id} style={{borderTop:`1px solid ${C.warn}22`}}>
                      <div style={{display:'flex',gap:10,alignItems:'center',padding:'8px 12px'}}>
                        <div style={{width:40,height:40,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {it.photo?<PhotoVinted src={it.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:15}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{num?`N°${num} · `:''}{it.title||tr('annonces.annonce2')}</div>
                          <div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{why.join(' · ')}</div>
                          {/* (27 oct., demande de Julien) Toucher ses favoris SANS robot :
                              Vinted prévient tout seul les personnes qui ont mis en favori
                              dès que le prix baisse. On le DIT ici — c'est SA baisse (le
                              bouton « Baisser » à droite), aucun message programmé (§3). */}
                          {rp.favs>0 && <div data-reprice-favs={rp.favs} style={{fontSize:11,color:C.muted,display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}><Icon name="heart" size={11} style={{color:C.muted}}/><span>{trj('annonces.favoriBaissePrevient', { favs: rp.favs })}</span></div>}
                        </div>
                        <div style={{flexShrink:0,textAlign:'right'}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.text,lineHeight:1.15}}><span style={{textDecoration:'line-through',color:C.muted,fontWeight:600}}>{price}</span> → {sugg} {cur(it.currency)}</div>
                          {atFloor && <div style={{fontSize:11,color:C.muted}}>{tr('annonces.achat10Plancher')}</div>}
                        </div>
                        <a href={it.url||undefined} target="_blank" rel="noreferrer" title={tr('annonces.ouvrirAnnonceVinted2')} style={{flexShrink:0,textDecoration:'none',border:`1px solid ${C.warn}55`,background:'transparent',color:C.warn,fontSize:11,fontWeight:600,padding:'5px 10px',borderRadius:12,display:'inline-flex',alignItems:'center',gap:4}}><Icon name="tag" size={12}/>{tr('annonces.baisser')}</a>
                      </div>
                      {/* Les AUTRES plateformes de la même paire (proposition 9). */}
                      {(eb || surLbcAussi) && (
                        <div data-reprice-ailleurs={it.id} style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',padding:'0 12px 8px 62px',fontSize:12,color:C.muted,lineHeight:1.4}}>
                          {eb && eb.ambigu === 'ebay' && <span data-reprice-ebay-ambigu="ebay">{tr('annonces.ebayDeuxAnnonces')}</span>}
                          {eb && eb.ambigu === 'numero' && <span data-reprice-ebay-ambigu="numero">{tr('annonces.ebayPortePlusieurs')}</span>}
                          {eb && !eb.ambigu && (eb.fait && eb.fait.etat === 'ok'
                            ? (eb.fait.memo
                              ? <span data-reprice-ebay="fait" data-reprice-ebay-memo="1">{tr('annonces.ebayDejaBaisse')} <b style={{color:C.text}}>{eb.prixActuel}&nbsp;€</b> {tr('annonces.aujourdHui')}</span>
                              : (eb.fait.regleMsg
                                ? <span data-reprice-ebay="fait" data-reprice-ebay-regle-msg={eb.fait.regleTon === 'ok' && /^✓/.test(eb.fait.regleMsg) ? 'ok' : 'warn'} style={{color: eb.fait.regleTon === 'ok' && /^✓/.test(eb.fait.regleMsg) ? C.text : C.warn}}>{tr('annonces.ebayBaisse')} <b>{eb.fait.prix}&nbsp;€</b> — {eb.fait.regleMsg}</span>
                                : <span data-reprice-ebay="fait">{tr('annonces.ebayBaisse')} <b style={{color:C.text}}>{eb.fait.prix}&nbsp;€</b> ✓</span>))
                            : eb.bloqueRegle
                              ? <span data-reprice-ebay-regle={eb.itemId} style={{color:C.warn}}>{tr('annonces.aussiEbay')} <b style={{color:C.text}}>{eb.prixActuel}&nbsp;€</b> {tr('annonces.regleOffreAccepte')} {Number(eb.bloqueRegle.accepte).toFixed(2).replace('.', ',')}{tr('annonces.baisseRetireAbord')}</span>
                            : eb.utile
                              ? <>
                                  <span>{tr('annonces.aussiEbay')} <b style={{color:C.text}}>{eb.prixActuel}&nbsp;€</b></span>
                                  <button type="button" data-reprice-ebay={eb.itemId} disabled={eb.fait && eb.fait.etat === 'envoi'} onClick={()=>baisserSurEbay(eb, rp)}
                                    style={{border:`1px solid ${C.border}`,background:'transparent',color:C.text,fontSize:11,fontWeight:600,padding:'4px 9px',borderRadius:12,cursor:'pointer',fontFamily:'inherit'}}>
                                    {eb.fait && eb.fait.etat === 'envoi' ? tr('annonces.envoi') : tr('annonces.baisserEbay', { sugg: String(eb.sugg) })}
                                  </button>
                                  {eb.fait && (eb.fait.etat === 'ko' || eb.fait.etat === 'incertain') && <span data-reprice-ebay-issue={eb.fait.etat} style={{color:C.warn}}>{eb.fait.msg}{eb.fait.etat === 'incertain' && eb.url ? <> <a href={eb.url} target="_blank" rel="noreferrer" style={{color:C.accentTexte,fontWeight:600}}>{tr('annonces.voirAnnonceEbay')}</a></> : null}</span>}
                                </>
                              : <span>{trj('annonces.aussiEbayDeja', { prixActuel: eb.prixActuel })}</span>)}
                          {surLbcAussi && <span>{tr('annonces.aussiLeboncoinBaisse')}</span>}
                        </div>
                      )}
                      </div>
                    );
                  })}
                  {ebayVivantes === null && <div style={{padding:'6px 12px',fontSize:11,color:C.muted}}>{tr('annonces.annoncesEbayOnt')}</div>}
                  {repriceList.length>30 && <div style={{padding:'8px 12px',fontSize:11,color:C.muted}}>{trj('annonces.autresArticlesBaisser', { x: repriceList.length-30 })}</div>}
                </div>
              )}
              {/* G22 — suivies, pas encore vendues → remise NATIVE (prévient tous les favoris) */}
              {suiviesList.length>0 && (
                <div data-suivies style={{border:`1px solid ${C.border}`,borderRadius:12,background:C.card,overflow:'hidden',marginTop:10}}>
                  <div style={{padding:'10px 12px',borderBottom:`1px solid ${C.border}`}}>
                    <span style={{display:'block',fontSize:13,fontWeight:700,color:C.text}}>{trj('annonces.suiviesEncoreVendues', { suiviesListN: suiviesList.length })}</span>
                    <span style={{display:'block',fontSize:11,color:C.muted,marginTop:3,lineHeight:1.45}}>{tr('annonces.cesArticlesSont')} <b>{tr('annonces.toutes')}</b> {tr('annonces.personnesOntMis')}</span>
                  </div>
                  {suiviesList.slice(0,30).map(({it,favs})=>{
                    const num = numeros[it.id]?.numero;
                    return (
                      <div key={it.id} data-suivie={String(it.id)} data-favs={favs} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 12px',borderTop:`1px solid ${C.border}`}}>
                        <div style={{width:40,height:40,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {it.photo?<PhotoVinted src={it.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{num?`N°${num} · `:''}{it.title||tr('annonces.annonce2')}</div>
                          <div style={{fontSize:11,color:C.muted}}>{favs} {tr('annonces.favori')}{(it.views!=null)?tr('annonces.vues', { views: String(it.views) }):''}</div>
                        </div>
                        <a href={it.url||undefined} target="_blank" rel="noreferrer" title={tr('annonces.ouvrirAnnonceVinted3')} style={{flexShrink:0,textDecoration:'none',border:`1px solid ${C.border}`,background:'transparent',color:C.text,fontSize:11,fontWeight:600,padding:'5px 10px',borderRadius:12,display:'inline-flex',alignItems:'center',gap:4}}><Icon name="tag" size={12}/>{tr('annonces.proposerRemise')}</a>
                      </div>
                    );
                  })}
                  {suiviesList.length>30 && <div style={{padding:'8px 12px',fontSize:11,color:C.muted}}>{trj('annonces.autresArticlesSuivis', { x: suiviesList.length-30 })}</div>}
                </div>
              )}
            </div>
          )}
          </>)}
          {/* Recherche + tri */}

          {/* ⚠️ Mode d'emploi permanent retiré : « les numéros se mettent
              automatiquement… » s'apprend une fois. Le prochain numéro libre
              reste visible là où on en a besoin — dans le champ N° d'une paire
              qui n'en a pas. */}
        </details>)}
        {listings.items && listings.items.length>0 && annShown.length===0 && (
          <div data-ann-vue-vide="" style={{fontSize:13,color:C.muted,textAlign:'center',padding:'24px 16px',lineHeight:1.6}}><b style={{display:'block',color:C.text}}>{tr('annonces.aucuneAnnonceDans')}</b>{annBase.length ? tr('annonces.annoncesSontToujours') : tr('annonces.verifieCompteSelectionne')}{(annSearch.trim() || annSort !== 'oldest') ? <div><Bouton variante="secondaire" data-ann-effacer-vue="" onClick={()=>{setAnnSearch('');setAnnSort('oldest');}}>{tr('annonces.effacerRechercheTri')}</Bouton></div> : null}</div>
        )}
        {/* ⚠️ SUR ORDINATEUR, `minmax(160px, …)` FAISAIT DES COLONNES, PAS DES
            CARTES. Mesuré à 1512 px : 6 colonnes de ~180 px, donc tous les champs
            de saisie tronqués — « acha€ » pour « achat € », « N° 15( », « Min.
            accepté » sur deux lignes, « Prix conseill ». Or c'est précisément
            cet écran qui porte le N°, le prix d'achat et le prix plancher.
            `clamp(160px, 25%, 240px)` : le pourcentage se résout sur la largeur
            de la grille, donc le plancher MONTE avec l'écran — 4 colonnes de
            ~284 px sur ordinateur, et **2 colonnes inchangées sur téléphone**
            (25 % de 362 px = 90 px, ramené au plancher de 160). Une seule règle,
            aucun test de largeur en JavaScript (§5.62). */}
        {/* ── OÙ VONT TES ANNONCES, EN PLUS DE VINTED ─────────────────────
            Une LIGNE PAR PLACE DE MARCHÉ, avec son compte et ses deux boutons.
            La phrase se dit ici une fois (§7) ; sur chaque carte il n'y a que
            la puce, dont l'état change d'une carte à l'autre. Les comptes
            viennent d'`annStats` — la même base que la grille (§11), donc il
            peut les vérifier en comptant les puces bleues.
            ⚠️ Chaque place annonce ce que l'extension INSTALLÉE sait faire,
            jamais ce que la dernière version sait faire (`EXT_CAPACITES`). */}
        {annStats.n > 0 && (()=>{
          /* ⚠️ §7 : LA MÊME PHRASE SUR CHAQUE LIGNE EST **UNE** PHRASE.
             Vu au rendu le 13 septembre : les deux places portaient mot pour mot
             « Ton choix est enregistré. C'est l'extension, dans ton Chrome, qui
             prépare ensuite chaque annonce sur X — ouvre l'app sur l'ordinateur
             où elle est installée. » — 150 caractères écrits deux fois, dont
             seul le nom de la place changeait, et il est déjà dans le titre de
             la ligne juste au-dessus. C'est le défaut des 13 × « code pas encore
             reçu » et des 14 × « l'extension le récupère », sur l'écran qu'il
             ouvre pour cocher ses annonces.
             ⚠️ MAIS ON NE JUGE PAS SUR L'ÉTAT, ON JUGE SUR LA PHRASE RENDUE :
             deux places « en retard » ne réclament pas la même version (5.54 et
             5.55), donc leurs phrases DISTINGUENT et doivent rester sur la
             ligne. D'où une clé qui porte tout ce qui varie. Un contrôle posé
             sur l'état aurait fusionné deux consignes différentes. */
          const lignes = MP_PLACES_UI.map(pl => {
            const n = pl.cle === 'lbc' ? annStats.surLbc : annStats.surEbay;
            const etat = extSait(pl.cap);
            const ph = extSait(pl.capPhotos) === 'ok';
            const cle = etat + '|' + ph + '|' + (etat==='retard' ? EXT_CAPACITES[pl.cap] : '')
                      + '|' + (etat==='ok' && !ph ? EXT_CAPACITES[pl.capPhotos] : '');
            return { pl, n, etat, ph, cle };
          });
          const uniforme = lignes.length > 1 && lignes.every(l => l.cle === lignes[0].cle);
          const phrase = (l, nommer) => {
            const pl = l.pl;
            const ou = nommer ? <> {tr('journee.texte2')} {pl.nom.toLowerCase()}{tr('annonces.fr')}</> : <> {tr('annonces.siteChaquePlace')}</>;
            return l.etat==='ok'
                    ? (l.ph
                      /* ⚠️ LA PHRASE QUI DÉCRIT CE QUE FAIT L'EXTENSION DOIT SUIVRE CE
                         QU'ELLE FAIT. Elle disait « photos téléchargées » — vrai jusqu'à
                         la 5.58, faux depuis : elles s'ATTACHENT au formulaire, et c'est
                         exactement ce dont il se plaignait (« ça me fait télécharger des
                         photos dans mon ordi »). Même défaut que la carte URSSAF : les
                         chiffres rebranchés, la phrase restée en arrière.
                         ⚠️ Et la phrase dépend de la VERSION INSTALLÉE, PLACE PAR PLACE :
                         Leboncoin attache depuis la 5.58, eBay depuis la 5.59. Un seul
                         seuil pour les deux aurait menti dans un sens ou dans l'autre. */
                      ? <>{tr('annonces.puceSousChaque')}{ou} — <b>{tr('annonces.photosAttacheesFormulaire')}</b> {tr('annonces.rienOrdinateurTexte')} <b>{tr('annonces.toiPublies')}</b>.</>
                      : <>{tr('annonces.puceSousChaque')}{ou} {tr('annonces.photosTelechargeesDans')} <b>{tr('annonces.toiPublies')}</b>{tr('annonces.texte8')} <b>{EXT_CAPACITES[pl.capPhotos]}</b> {tr('annonces.attacheDirectementFormulaire')}</>)
                  : l.etat==='absente'
                    ? <>{tr('annonces.choixEnregistreExtension')}{nommer ? <> {tr('journee.texte2')} {pl.nom}</> : ''} {tr('annonces.ouvreAppOrdinateur')}</>
                    : <>{tr('annonces.choixEnregistre')} <b>{tr('annonces.maisExtensionInstallee')} {nommer ? <>{tr('annonces.preparer')} {pl.nom}</> : tr('annonces.preparer2')}</b> {tr('annonces.luiFaut')} <b>{EXT_CAPACITES[pl.cap]}</b>{tr('annonces.metsJourDepuis')} <b>{tr('annonces.parametresEtatConnexions')}</b> {tr('annonces.cochesBougent')}</>;
          };
          return (<>
            {/* La phrase commune une seule fois, au-dessus des lignes. Sur la
                ligne il ne reste alors que ce qui DISTINGUE : le nom de la
                place, son compte, et ses deux boutons. */}
            {/* 1er oct. — « trop chargé » : les places tiennent dans UNE carte,
                une ligne chacune (nom · combien · Toutes / Aucune). La phrase
                commune dessous, en petit. */}
            {/* ── 13 oct. — « trop de texte, mal agencé » (Julien). CE RÉGLAGE
                (où publier en plus de Vinted) SE LIT UNE FOIS : il descend
                derrière un dépliant FERMÉ par défaut, au lieu d'un encart
                permanent de 4-5 lignes posé entre les contrôles et la première
                annonce. Le geste du quotidien reste la puce sous chaque carte ;
                ici il n'y a que le réglage en masse (Toutes/Aucune) et
                l'explication. Le résumé de la ligne (place N/total) est VISIBLE
                sans ouvrir. `data-places` reste sur le contenu : le banc le
                trouve par cet attribut (invariant : aucune case eBay). */}
            <details data-places-wrap style={{marginBottom:12}}>
              <summary aria-label={tr('annonces.publierAussiAilleurs')} style={{listStyle:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:8,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 14px',boxShadow:C.shadow||'none',fontFamily:'inherit'}}>
                <span style={{display:'inline-flex',color:C.muted}}><Icon name="tag" size={15}/></span>
                <span style={{fontSize:13,fontWeight:600,color:C.text}}><span className="vrm-label-full">{tr('annonces.publierAussiAilleurs')}</span><span className="vrm-label-short" aria-hidden="true">{tr('annonces.publier2')}</span></span>
                <span style={{flex:1,textAlign:'right',fontSize:12,color:C.muted,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lignes.map(l=>`${l.pl.nom} ${l.n}/${annStats.n}`).join(' · ')}</span>
                <span className="vrm-chevron" style={{fontSize:15,color:C.muted}}>›</span>
              </summary>
              <div data-places="" style={{marginTop:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 12px 10px',boxShadow:C.shadow||'none'}}>
              <div style={{display:'flex',flexWrap:'wrap',columnGap:22}}>
              {lignes.map((l, i) => (
                <div key={l.pl.cle} style={{padding:'6px 0',flex:'1 1 260px',minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{flex:1,minWidth:0,fontSize:13,color:C.text}}>
                      <b style={{fontWeight:700}}>{l.pl.nom}</b>
                      <span style={{color:C.muted,marginLeft:8,fontVariantNumeric:'tabular-nums'}}>{trj('annonces.annonces3', { n: annStats.n, x: l.n })}</span>
                    </div>
                    <div role="group" aria-label={tr('annonces.selection', { nom: String(l.pl.nom) })} style={{display:'flex',border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',flexShrink:0}}>
                      <button type="button" onClick={()=>setMpToutes(l.pl.cle, true)} aria-pressed={l.n===annStats.n}
                        style={{border:'none',background:l.n===annStats.n?(C.card2||C.bg):'transparent',color:C.text,padding:'5px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minHeight:0}}>{tr('journee.toutes')}</button>
                      <button type="button" onClick={()=>setMpToutes(l.pl.cle, false)} aria-pressed={l.n===0}
                        style={{border:'none',borderLeft:`1px solid ${C.border}`,background:l.n===0?(C.card2||C.bg):'transparent',color:C.text,padding:'5px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minHeight:0}}>{tr('journee.aucune')}</button>
                    </div>
                  </div>
                  {!uniforme && <div style={{fontSize:12,color:C.muted,lineHeight:1.45,marginTop:4}}>{phrase(l, true)}</div>}
                </div>
              ))}
              </div>
              {uniforme && <div style={{fontSize:12,color:C.muted,lineHeight:1.45,paddingTop:6}}>{phrase(lignes[0], false)}</div>}
              </div>
            </details>
          </>);
        })()}
      </>/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧
import QuiDorment from "../design/QuiDorment.jsx";
// (11 nov., lot quoi-republier) « Quelles annonces republier ? » : la règle (sur `articlesQuiDorment`) et sa carte.
import QuoiRepublier from "../design/QuoiRepublier.jsx";
// ⟦← App.jsx #2⟧
import { prochainGesteAnnonces } from '../prochainGesteAnnonces.js';
import AnnoncesMasquees from "../AnnoncesMasquees.jsx";
import VueACompleter from "../AnnoncesACompleter.jsx";
// ⟦← App.jsx #4⟧
import { etatVinted, NIVEAU_ETAT_MAX } from "../carteAnnonce.js";
// ⟦← App.jsx #5⟧   // (11 nov., lot annonce-vinted) « Créer sur Vinted » depuis une fiche (extension 5.367)
import { etatFicheVinted } from '../annonceVinted.js';
// ⟦← App.jsx #6⟧
import AutresVersions from "../AutresVersions.jsx";
// ⟦← App.jsx #3⟧
const JaugeActions = aLaDemande(() => import('../JaugeActions.jsx'));
// ⟦← App.jsx #7⟧
const MP_PLACES_UI = MP_PLACES.filter((p) => p.ui !== false);
// ⟦← App.jsx #8⟧
// L'état d'un écran qui porte une clé synchronisée : `init` est l'initialiseur
// d'avant (`() => load(k, d)`), rejoué quand la clé change ailleurs.
// (3 nov.) LES FICHES DUPLIQUÉES À PUBLIER (src/dupliquerFiche.js) : N° neuf,
// photos à prendre. Une fiche sort de la liste dès qu'une annonce porte son N°
// (fiche Vinted, lien Leboncoin posé) ; « Retirer » la range (le N° reste servi).
function FichesNeuves({ annonces = null }) {
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const off = onCloudReady(maj); window.addEventListener('vrm:save', maj); return () => { if (typeof off === 'function') off(); window.removeEventListener('vrm:save', maj); }; }, []);
  // (11 nov., lot annonce-vinted) « Créer sur Vinted » : la sélection et la feuille ouverte.
  const [sel, setSel] = React.useState(() => new Set());
  const [ouvert, setOuvert] = React.useState(null);
  const toutes0 = load('vrm_fiches_neuves', {}) || {};
  // Le brouillon créé DEPUIS une fiche porte le N° de cette fiche (par l'identifiant rendu
  // par Vinted) : il ne la fait pas sortir de la liste — elle y reste « Brouillon sur Vinted ».
  const draftsFiches = new Set(Object.values(toutes0).filter((f) => f && f.vinted && f.vinted.draftId).map((f) => String(f.vinted.draftId)));
  const portes = new Set();
  for (const [id, f] of Object.entries(load('vinted_annonce_numeros', {}) || {})) if (f && f.numero && !draftsFiches.has(String(id))) portes.add(cleNum(f.numero));
  for (const n of Object.values(load('vrm_lbc_liens', {}) || {})) if (n) portes.add(cleNum(n));
  for (const n of Object.values(carteNumerosVc(vcCarte('vrm_vc_numeros')))) if (n) portes.add(cleNum(n));
  const liste = fichesAPublier(toutes0, portes, cleNum).filter((f) => etatFicheVinted(f, annonces) !== 'en-ligne');
  if (!liste.length && !ouvert) return null;
  // (10 nov., lot Y) « Retirer » range la fiche (le N° reste servi, §5) ET la met à la corbeille 30 jours :
  // pilule « Annuler » 5 s, puis Paramètres → Corbeille la remet « À publier », même N°.
  const retirer = (f) => {
    const toutes = load('vrm_fiches_neuves', {}) || {};
    if (!toutes[f.id]) return;
    gesteCorbeille({ type: 'fiche', libelle: f.titre || '', numero: f.numero, morceaux: [{ k: 'vrm_fiches_neuves', type: 'champs', id: f.id, avant: { retireeAt: toutes[f.id].retireeAt }, apres: { retireeAt: new Date().toISOString() } }] }, {}, () => maj());
  };
  const noterVinted = (id, champs) => {
    const t = load('vrm_fiches_neuves', {}) || {};
    if (!t[id]) return;
    save('vrm_fiches_neuves', { ...t, [id]: { ...t[id], vinted: { ...(t[id].vinted || {}), ...champs } } });
    emettreClesRelues(['vrm_fiches_neuves']); maj();
  };
  const aCreer = liste.filter((f) => etatFicheVinted(f, annonces) === 'a-creer');
  const coches = aCreer.filter((f) => sel.has(f.id));
  const basculer = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Mettre en ligne le brouillon créé depuis la fiche : la voie de « Publier » des brouillons (`publierBrouillon`).
  const publier = async (f) => {
    const v = f.vinted || {};
    const ok = await askConfirm({ title: tr('creerVinted.publier.titre', { num: f.numero }), desc: tr('creerVinted.publier.desc'), ok: tr('creerVinted.publier'), cancel: tr('creerVinted.annuler') });
    if (!ok) return;
    await lancerTravailCV({ titre: tr('creerVinted.publier.suivi'), sorte: 'publier-fiche-vinted', uid: String(v.uid || ''), executer: async () => {
      const r = await avecCouleurBrouillon((couleur, reponses) => vmrCmdSuivi({ cmd: 'publierBrouillon', uid: String(v.uid), draftId: String(v.draftId), confirme: true, couleur, reponses }, 360000), f.titre || '');
      if (r && r.accepte && r.etape === 'fait') { noterVinted(f.id, { publieAt: new Date().toISOString() }); return { etat: 'ok' }; }
      return { etat: r && r.sansReponse ? 'main' : 'refus', raison: String((r && r.raison) || 'refusé').slice(0, 300), geste: 'Ouvre le brouillon sur Vinted', lien: `https://www.vinted.fr/items/${encodeURIComponent(String(v.draftId))}/edit` };
    } });
  };
  return (
    <section className="vrm-ao-neuves" data-fiches-neuves={liste.length} aria-label="À publier">
      <h3>À publier</h3>
      {liste.map((f) => {
        const etatV = etatFicheVinted(f, annonces);
        return (
        <div key={f.id} className="vrm-ao-neuve" data-fiche-neuve-num={f.numero} data-fiche-neuve-vinted={etatV}>
          {etatV === 'a-creer' && aCreer.length > 1 ? <label className="vrm-ao-neuve-coche"><input type="checkbox" checked={sel.has(f.id)} onChange={() => basculer(f.id)} aria-label={tr('creerVinted.cocher', { num: f.numero })} data-fiche-neuve-cocher={f.numero}/></label> : null}
          <span className="vrm-ao-neuve-num">N°{f.numero}</span>
          <span className="vrm-ao-neuve-txt"><b>{f.titre || 'Sans titre'}</b><small>{etatV === 'brouillon' ? <span className="vrm-ao-neuve-etat">{tr('creerVinted.etat.brouillon')}</span> : [f.taille, f.prix != null ? `${String(f.prix).replace('.', ',')}\u00a0€` : null, 'photos à prendre'].filter(Boolean).join(' · ')}</small></span>
          {etatV === 'brouillon'
            ? <button type="button" className="vrm-ao-second" data-fiche-neuve-publier={f.numero} onClick={() => publier(f)}>{tr('creerVinted.publier')}</button>
            : <button type="button" className="vrm-ao-second" data-fiche-neuve-creer={f.numero} onClick={() => setOuvert([f])}>{tr('creerVinted.bouton')}</button>}
          <button type="button" className="vrm-ao-second" data-fiche-neuve-copier={f.numero} onClick={async () => { try { await navigator.clipboard.writeText(texteAColler(f)); toast('Texte copié'); } catch (_) { toast('Copie impossible ici'); } }}>Copier</button>
          <button type="button" className="vrm-ao-second" aria-label={`Retirer la fiche N°${f.numero}`} data-fiche-neuve-retirer={f.numero} onClick={() => retirer(f)}>×</button>
        </div>
        );
      })}
      {coches.length > 1 && <div className="vrm-ao-neuve-serie"><button type="button" className="vrm-ao-second" data-fiche-neuve-serie={coches.length} onClick={() => setOuvert(coches)}>{tr('creerVinted.lancer', { n: coches.length })}</button></div>}
      {ouvert && <FeuilleCreerVinted fiches={ouvert} saisie onFait={maj} onFermer={() => { setOuvert(null); setSel(new Set()); }}/>}
    </section>
  );
}
// ⟦← App.jsx #9⟧
// ⟦→ ecrans/Compta.jsx #15⟧
/* ── UN CHAMP QUI NE VALIDE QU'À LA SORTIE ─────────────────────────────────
   ⚠️ Julien : « quand je remplis les prix d'achat, dès que je mets 2 pour
   mettre 20, ça le rentre et je ne peux plus mettre plus que 2 ».
   Cause : le champ écrivait à CHAQUE frappe. `updatePair` réécrit
   `vinted_annonce_numeros`, la grille Annonces se retrie (tri par prix, par
   N°…), l'input est remonté ailleurs dans le DOM et le focus part — donc on
   ne pouvait taper qu'un seul caractère.
   Ici la saisie reste EN LOCAL tant que le champ a le focus ; on ne valide
   qu'à la sortie du champ ou sur Entrée (Échap annule). Tant qu'on n'écrit
   pas dedans, il suit la donnée (numéro posé automatiquement, prix repris
   d'un achat relié…). `onCommit` n'est appelé QUE si la valeur a changé —
   sinon entrer puis sortir d'un champ prix effacerait l'achat relié. */
// ── ÉDITER EN PLACE (3 octobre, écran Annonces) ─────────────────────────────
// « L'onglet Annonces est trop brouillon » : chaque carte écrivait son N° et son
// prix d'achat DEUX fois (le texte, puis un champ de saisie juste dessous). Le
// texte reste — c'est lui qu'on lit — et un clic le transforme en champ ;
// Entrée ou un clic ailleurs enregistre (ChampSaisie), Échap annule.
// ── L'ÉTAT EN JAUGE (29 octobre) : cinq barres montantes, comme le signal d'un
// téléphone — de « Satisfaisant » (1) à « Neuf avec étiquette » (5). Les barres
// pleines sont à l'encre, les autres au filet : aucune couleur de plus (§7).
// Un état inconnu de VRM est ÉCRIT tel quel, sans jauge (jamais un niveau
// deviné) ; aucun état ⇒ « — ». La règle : `etatVinted` (src/carteAnnonce.js).
// Le libellé de la case (« État ») est sur la même ligne que la jauge, le mot
// en dessous, en entier (il revient à la ligne plutôt que d'être coupé :
// « Très bo… » se lisait mal, mesuré au rendu).
function JaugeEtat({ statut, lib }) {
  const e = etatVinted(statut);
  const niv = e && e.niveau;
  return (
    <span className="vrm-fiche-etat-val" data-etat-niveau={niv ? String(niv) : (e ? 'inconnu' : 'aucun')}>
      <span className="vrm-fiche-etat-haut">
        {lib}
        {niv ? (
          <span className="vrm-fiche-jauge" role="img" aria-label={tr('annonces.etat', { niv: String(niv), NIVEAU_ETAT_MAX: String(NIVEAU_ETAT_MAX) })} title={tr('annonces.texte3', { libelle: String(e.libelle), niv: String(niv), NIVEAU_ETAT_MAX: String(NIVEAU_ETAT_MAX) })}>
            {Array.from({ length: NIVEAU_ETAT_MAX }, (_, i) => (
              <span key={i} className={i < niv ? 'plein' : ''} style={{ height: 5 + i * 2.5, background: i < niv ? C.text : C.border }}/>
            ))}
          </span>
        ) : null}
      </span>
      <span className="vrm-fiche-etat-mot" style={{ color: e ? C.text : C.muted }}>{e ? e.libelle : '—'}</span>
    </span>
  );
}
function EnLigne({ value, onCommit, rendu, placeholder, inputMode, largeur = 64, titre, data }) {
  const [edit, setEdit] = useState(false);
  if (edit) return (
    <span onBlur={() => setEdit(false)} style={{display:'inline-flex'}}>
      <ChampSaisie autoFocus value={value} onCommit={onCommit} placeholder={placeholder} inputMode={inputMode}
        style={{width:largeur,border:'none',borderBottom:`1.5px solid ${C.accent}`,background:'transparent',color:C.text,fontSize:13,fontWeight:600,outline:'none',padding:'0 2px',fontFamily:'inherit'}}/>
    </span>
  );
  return (
    // (revue du 19 oct.) La zone au doigt fait 44 px de LARGE aussi : sur
    // « achat — » elle faisait 10 px (le tiret), 25 px sur « N°2 ». Le
    // pointillé reste sous le texte seul (le span), pas sous la zone.
    <button type="button" data-edition={data} onClick={() => setEdit(true)} title={titre || tr('annonces.cliquerModifier')}
      style={{border:'none',background:'transparent',padding:0,minHeight:0,minWidth:44,margin:0,color:'inherit',font:'inherit',cursor:'text',lineHeight:'inherit',textAlign:'inherit'}}><span style={{borderBottom:`1px dashed ${C.border}`}}>{rendu}</span></button>
  );
}
// ⟦← App.jsx #10⟧

// ⚠️ UNE EXTENSION EN RETARD NE FAIT AUCUN BRUIT. Elle continue de capter —
// simplement moins que ce que l'app attend, et sans jamais afficher d'erreur.
// Mesuré le 6 septembre : ses captures dataient de la matinée et il n'y avait
// pourtant AUCUNE ligne de relevé (la lecture du porte-monnaie daté, arrivée en
// 5.52). Le seul endroit qui le disait affichait un numéro de version nu, dans
// les réglages — illisible pour quelqu'un qui n'est pas développeur.
// ⚠️ Ne s'affiche QUE sur un navigateur où l'extension est là ET annonce sa
// version : sur téléphone, ou tant que le pont n'a pas répondu, on ne dit rien.
// (6 nov.) Combien d'annonces portent un « Accepter dès » (le seuil des offres automatiques) :
// la carte « Offres automatiques » et le conseil « Offres automatiques sans seuil » (§11).
const nbAccepterDes = (annonces, numeros) => (annonces || []).filter((it) => { const v = Number(String(((numeros || {})[it.id] || {}).min ?? '').replace(',', '.')); return isFinite(v) && v > 0; }).length;
// ⟦← App.jsx #11⟧
// (16 oct.) LES MARQUES DES PLATEFORMES — Julien : « mets le logo des
// plateformes sur les annonces ». Une pastille par plateforme où la paire est
// PROUVÉE en ligne (jamais devinée par le titre, §5). Ce sont des identifiants
// de marque, pas un accent : petites, et toujours avec leur nom en infobulle.
const MARQUES_PLAT = {
  vinted:    { nom: 'Vinted',    court: 'V',   bg: '#007782', fg: '#fff' },
  leboncoin: { nom: 'Leboncoin', court: 'lbc', bg: LBC_ORANGE, fg: '#fff' },
  ebay:      { nom: 'eBay',      court: 'eBay', bg: '#fff', fg: '#0071E3', bord: '#D1D1D6' },
  // (11 nov., « Publier partout ») Vestiaire, en neutre (aucune couleur de marque en plus, §7).
  vestiaire: { nom: 'Vestiaire', court: 'VC', bg: '#fff', fg: '#1d1d1f', bord: '#D1D1D6' },
};
function MarquePlateforme({ p, taille = 18 }) {
  const m = MARQUES_PLAT[p]; if (!m) return null;
  return <span data-marque={p} title={`En ligne sur ${m.nom}`} aria-label={`En ligne sur ${m.nom}`}
    style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:taille,height:taille,padding:'0 4px',borderRadius:6,
      background:m.bg,color:m.fg,border:`1px solid ${m.bord||m.bg}`,fontSize:Math.round(taille*0.5),fontWeight:800,letterSpacing:-0.2,lineHeight:1,flexShrink:0}}>{m.court}</span>;
}
// ⟦← App.jsx #12⟧
function lireJournalRepub() { try { const o = JSON.parse(localStorage.getItem(JOURNAL_REPUB) || 'null'); return o && typeof o === 'object' && Array.isArray(o.paires) ? o : null; } catch (_) { return null; } }
// ⟦← App.jsx #13⟧
function CompteRenduOperation({ onReprendre, onRefaire }) {
  const [j, setJ] = useState(() => lireJournalRepub());
  React.useEffect(() => { const f = () => setJ(lireJournalRepub()); window.addEventListener('vrm:journal-repub', f); return () => window.removeEventListener('vrm:journal-repub', f); }, []);
  if (!j || j.fini || __repubVivant) return null;
  const A = ACTIONS_REPUB[j.action] || ACTIONS_REPUB.recreer;
  const faits = j.paires.filter((p) => p.etat === 'fait');
  const enCours = j.paires.filter((p) => p.etat === 'encours');
  const ratees = j.paires.filter((p) => ['echec', 'incertain', 'double', 'a-refaire'].includes(p.etat));
  const restent = j.paires.filter((p) => !p.etat || p.etat === 'attente');
  const nom = (p) => `${p.num ? 'N°' + p.num + ' ' : ''}${p.titre || 'annonce'}`;
  const quand = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const etapeNom = (e) => { for (const l of Object.values(ETAPES_REPUB)) { const x = l.find((k) => k[0] === e); if (x) return x[1]; } return ''; };
  const lien = { background: 'none', border: 'none', padding: 0, color: C.accentTexte, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' };
  // (30 oct.) « Tout doit être plus clair » : un titre qui dit ce qui s'est passé,
  // le compte en une ligne, la paire en cours (le point qui demande de regarder),
  // et le détail des noms replié. Deux gestes : reprendre, effacer.
  const resume = [faits.length ? `${faits.length} ${A.faits}${faits.length > 1 ? 's' : ''}` : null, enCours.length ? `${enCours.length} en cours` : null, ratees.length ? `${ratees.length} pas faite${ratees.length > 1 ? 's' : ''}` : null, restent.length ? `${restent.length} pas commencée${restent.length > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ');
  return (
    <div data-compte-rendu={j.action} style={{ border: `1px solid ${C.warn}`, borderRadius: 12, padding: '12px 14px', margin: '10px 0', background: C.card, fontSize: 13, color: C.text, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontWeight: 700 }}>« {A.titre} {tr('annonces.arretee')}{j.majAt ? ` (${quand(j.majAt)})` : ''} <Pourquoi label={tr('annonces.pourquoi')}>{tr('annonces.appEteFermee')}</Pourquoi></div>
      <div style={{ color: C.muted }}>{resume}</div>
      {enCours.map((p) => <div key={p.id} data-cr-encours={p.id}>{tr('annonces.coursArret')} <b>{nom(p)}</b>{p.etape ? ` — « ${etapeNom(p.etape) || p.etape} »` : ''}{tr('annonces.regardeDressingVinted')}{onRefaire ? <>{tr('annonces.texte4')} <button type="button" style={lien} onClick={onRefaire}>{tr('annonces.brouillonsRefaire2')}</button></> : ''}.</div>)}
      <details className="vrm-repli">
        <summary style={{ display: 'flex', alignItems: 'center', minHeight: 44, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{tr('annonces.voirDetail')}</summary>
        <div data-cr-faits={faits.length}>{faits.length ? `${faits.length} ${A.faits}${faits.length > 1 ? 's' : ''} : ${faits.map(nom).join(', ')}.` : tr('annonces.aucuneAnnonceAvant', { faits: String(A.faits) })}</div>
        {ratees.length > 0 && <div data-cr-ratees={ratees.length}>{tr('annonces.faites')} {ratees.map((p) => `${nom(p)}${p.raison ? ` (${String(p.raison).slice(0, 90)})` : ''}`).join(' · ')}.</div>}
        <div data-cr-restent={restent.length}>{restent.length ? tr('annonces.commencees', { x: String(restent.map(nom).join(', ')) }) : tr('annonces.toutesAnnoncesChoisies')}</div>
      </details>
      <div className="vrm-b-rangee" style={{ justifyContent: 'flex-start' }}>
        {restent.length > 0 && onReprendre && <Bouton data-cr-reprendre onClick={() => onReprendre(j.action, restent.map((p) => p.id))} style={{ minHeight: 44 }}>{trj('annonces.reprendreCommencees', { n: restent.length })}</Bouton>}
        <Bouton variante="discret" data-cr-effacer onClick={() => ecrireJournalRepub(null)}>{tr('annonces.aiVuEffacer')}</Bouton>
      </div>
    </div>
  );
}
// ⟦← App.jsx #14⟧
// ══ SÉLECTIONNER DES ANNONCES, PUIS « ACTIONS POSSIBLES » (5 nov.) ═══════════
// Julien : « pouvoir sélectionner les annonces (brouillons et en ligne — sauf
// celles en vérification par Vinted), puis un petit carré « Actions » qui
// propose, selon la sélection… ». Règles : `src/annoncesActions.js`. Les moteurs
// sont ceux qui existent (`RepublierVinted` / `ACTIONS_REPUB`) : la sélection
// ne fait que choisir, rien ne part d'ici.
// (9 nov., lot AL) `filtre = 'republier'` : la vue « Republier » d'Annonces (l'ancienne entrée
// du menu) — ses annonces EN LIGNE seulement, la même sélection, et au pied « Republier · N »
// (`onRepublier`) qui ouvre l'atelier ; « Sélectionner » garde « Actions · N ».
function ChoixAnnoncesVinted({ filtre = 'tout', annonces, sel, setSel, charge, brLecture, onActions, onRepublier, onALaMain, suivis = [], onSuivi, onDetailBrouillons }) {
  const rep = filtre === 'republier';
  const liste = (annonces || []).filter((a) => (filtre !== 'brouillon' || a.etat === 'brouillon') && (!rep || a.etat === 'en-ligne'));
  const cle = (a) => a.uid + ':' + a.id;
  const coches = new Set((sel || []).map((x) => x.uid + ':' + x.id));
  const groupes = []; const parUid = new Map();
  for (const a of liste) { if (!parUid.has(a.uid)) { const g = { uid: a.uid, compte: a.compte, items: [] }; parUid.set(a.uid, g); groupes.push(g); } parUid.get(a.uid).items.push(a); }
  const basculer = (a) => {
    if (a.raisonPas) { toast(a.raisonPas); return; }
    setSel((v) => (v.some((x) => x.uid === a.uid && x.id === a.id) ? v.filter((x) => !(x.uid === a.uid && x.id === a.id)) : [...v, { id: a.id, uid: a.uid, etat: a.etat }]));
  };
  const cocherTout = (g) => setSel((v) => { const deja = new Set(v.map((x) => x.uid + ':' + x.id)); return [...v, ...g.items.filter((a) => !a.raisonPas && !deja.has(cle(a))).map((a) => ({ id: a.id, uid: a.uid, etat: a.etat }))]; });
  const toutCocheG = (g) => g.items.filter((a) => !a.raisonPas).every((a) => coches.has(cle(a)));
  const decocherG = (g) => setSel((v) => v.filter((x) => x.uid !== g.uid));
  const prixTxt = prixTxtMontant;   // (5 nov.) alias de `montant()`, src/format.js
  const nCoches = (sel || []).length;
  // Republier : seules les annonces en ligne cochées DE CETTE LISTE partent (un brouillon coché dans
  // « Sélectionner » reste coché, mais n'est pas republié).
  const aRepublier = rep ? liste.filter((a) => coches.has(cle(a))) : [];
  return (
    <section className="vrm-sel" data-selection-vue={filtre} data-selection-n={liste.length}>
      {/* (11 nov., lot DJ8) Le conseil passe AVANT les suivis : en arrivant, « À la main » se voit d'abord. */}
      {/* (10 nov., lot AP — demande 17) À LA MAIN, CONSEILLÉ : le moins risqué (c'est lui qui publie,
          rien ne part d'ici), rendu attirant — trois gestes prêts, le N° qui suit la paire. */}
      {rep && <div className="vrm-kit-conseil vrm-kit-conseil-vue" data-republier-conseil="main">
        <span className="vrm-kit-conseil-icone" aria-hidden="true"><Icon name="shield" size={20}/></span>
        <div><b>{tr('annonces.mainConseilleMoins')}</b><span>{tr('annonces.photosDansGalerie')}</span></div>
      </div>}
      {suivis.length > 0 && suivis.map((s) => (
        <div key={s.ancienId} data-suivi-main={s.ancienId} data-suivi-main-etat={s._etat} className="vrm-act-paire">
          <span className="vrm-act-paire-nom">{s.num ? <Numero n={s.num} taille="petit"/> : null}<b>{s.titre || tr('annonces.annonce2')}</b></span>
          <span>{tr('annonces.republieeMain')} {s._etat === 'lie' ? tr('annonces.nouvelleAnnonceDesignee') : tr('annonces.choisisNouvelleAnnonce')}</span>
          <div className="vrm-b-rangee" style={{ justifyContent: 'flex-start' }}><Bouton variante="discret" data-suivi-main-reprendre={s.ancienId} onClick={() => onSuivi && onSuivi(s)}>{tr('annonces.reprendre')}</Bouton></div>
        </div>
      ))}
      <div className="vrm-sel-tete" data-sel-tete="">
        {/* (10 nov., lot AI) La consigne RÉÉCRITE en une phrase courte, sans pop-up (le geste suffit) ;
            sur la vue « Republier » (navigation fusionnée) : c'est toujours lui qui choisit et lance. */}
        <span data-sel-consigne="" style={{ minWidth: 0, flex: '1 1 auto' }}>{rep ? <>{tr('annonces.cocheAnnoncesPuis')} <b>{tr('annonces.main2')}</b> {tr('annonces.texte5')} <b>{tr('annonces.vrm2')}</b>.</> : filtre === 'brouillon' ? <>{tr('annonces.cocheBrouillonsPuis')} <b>{tr('ventes.actions')}</b>.</> : <>{tr('annonces.cocheAnnoncesCompte')} <b>{tr('ventes.actions')}</b>.</>}</span>
        {/* (11 nov., lot DJ8) Un seul compte : son « Tout décocher » suffit (le même geste ne s'écrit pas deux fois). */}
        {nCoches > 0 && groupes.length !== 1 && <Bouton variante="discret" data-selection-vider onClick={() => setSel([])}>{tr('annonces.toutDecocher')}</Bouton>}
        {filtre === 'brouillon' && onDetailBrouillons ? <Bouton variante="discret" data-brouillons-detail="" onClick={onDetailBrouillons}>{tr('annonces.texte6')}</Bouton> : null}
      </div>
      {charge ? <div className="vrm-sel-vide" data-selection-charge="">{PAS_SU.enCours}</div>
        : !liste.length ? <div className="vrm-sel-vide" data-selection-vide="">{filtre === 'brouillon' ? (brLecture ? PAS_SU.enCours : tr('annonces.aucunBrouillonLu')) : tr('annonces.aucuneAnnonceLue')}</div>
        : groupes.map((g) => (
          <div key={g.uid || 'x'} className="vrm-sel-groupe" data-selection-compte={g.uid} data-selection-compte-n={g.items.length}>
            <div className="vrm-sel-compte"><b>{g.compte}</b><span className="vrm-sel-n">{trj('annonces.annonces', { n: g.items.length })}</span>
              {g.items.some((a) => !a.raisonPas) && (toutCocheG(g)
                ? <Bouton variante="discret" data-selection-compte-decocher={g.uid} onClick={() => decocherG(g)}>{tr('annonces.toutDecocher')}</Bouton>
                : <Bouton variante="discret" data-selection-compte-cocher={g.uid} onClick={() => cocherTout(g)}>{tr('annonces.toutCocher')}</Bouton>)}
            </div>
            <ul className="vrm-sel-liste">
              {g.items.map((a) => { const on = coches.has(cle(a)); const off = !!a.raisonPas; return (
                <li key={cle(a)}>
                  <label className="vrm-sel-ligne" data-selection-annonce={a.id} data-selection-etat={a.etat} data-sel-coche={on ? '1' : '0'} aria-disabled={off ? 'true' : undefined} title={off ? a.raisonPas : undefined}>
                    <input type="checkbox" className="vrm-sel-case" checked={on} disabled={off} onChange={() => basculer(a)} aria-label={`Sélectionner ${a.titre || 'cette annonce'}`}/>
                    {a.photo ? <PhotoVinted src={a.photo} alt="" className="vrm-sel-photo" loading="lazy"/> : <PhotoVide taille={52} className="vrm-sel-photo"/>}
                    <span className="vrm-sel-centre">
                      <span className="vrm-sel-nom">{a.numero ? <Numero n={a.numero} taille="petit" className="vrm-sel-num"/> : null}<span className="vrm-sel-titre">{a.titre || tr('annonces.sansTitre')}</span></span>
                      <span className="vrm-sel-sous"><span className="vrm-sel-etat" data-etat-annonce={a.etat}>{ETATS_ANNONCE[a.etat] || a.etat}</span><span className="vrm-sel-prix">{prixTxt(a.prix)}</span></span>
                      {off && <span className="vrm-sel-raison" data-selection-raison="">{a.raisonPas}</span>}
                    </span>
                  </label>
                </li>
              ); })}
            </ul>
          </div>
        ))}
      {rep
        ? (aRepublier.length > 0 && <div className="vrm-sel-barre vrm-sel-barre-deux">
            <Bouton variante="secondaire" data-republier-lancer={aRepublier.length} onClick={() => onRepublier && onRepublier(aRepublier)}>{trj('annonces.vrm', { aRepublierN: aRepublier.length })}</Bouton>
            <Bouton variante="primaire" icone="shield" data-republier-main-lancer={aRepublier.length} onClick={() => onALaMain && onALaMain(aRepublier)}>{trj('annonces.main', { aRepublierN: aRepublier.length })}</Bouton>
          </div>)
        : (nCoches > 0 && <div className="vrm-sel-barre"><Bouton variante="primaire" data-actions-possibles={nCoches} onClick={onActions}>{trj('annonces.actions', { nCoches: nCoches })}</Bouton></div>)}
    </section>
  );
}
// ⟦← App.jsx #15⟧
// ══ « SANS ACHAT RELIÉ » : UNE SUGGESTION PAR ANNONCE (6 nov., vague 2 · point 4) ══
// La file (src/achatsARelier.js) : chaque annonce numérotée en ligne sans achat relié, avec
// LA meilleure suggestion de `suggestionsAchat` (marque et taille obligatoires, achat
// antérieur à la mise en ligne, lots). « Relier » écrit au prix du reçu (`propositionDe`),
// « Saisir » le prix qu'il tape, « Plus tard » la range en fin de file. SON tap, toujours.
function AchatsARelier({ file, achats, liens, propositionDe, onRelier, onSaisir, onPlusTard, onChoisir, compteDe, onSerie = null }) {
  const lignes = useMemo(() => (Array.isArray(file) ? file.map((x) => {
    const sugg = Array.isArray(achats) ? meilleureSuggestion({ item: x.item, achats, liens, marqueDe: extractBrand, couleursDe: extractColors, modeleDe: extractModel }) : null;
    const p = sugg ? propositionDe(sugg.achat) : null;
    return { ...x, sugg, texte: texteSuggestion(sugg, p) };
  }) : null), [file, achats, liens, propositionDe]);
  if (lignes == null) return <div className="vrm-ar-vide" data-ar-etat="lecture">{PAS_SU.enCours}</div>;
  if (!lignes.length) return <div className="vrm-ar-vide" data-ar-etat="vide">{tr('annonces.chaqueAnnonceNumerotee')}</div>;
  const nSugg = lignes.filter((l) => l.sugg).length;
  const jour = (d) => { const t = Date.parse(d || ''); return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : ''; };
  return (
    <section className="vrm-ar" data-ar={lignes.length} data-ar-sugg={achats === undefined ? '' : String(nSugg)} aria-label={tr('annonces.annoncesSansAchat')}>
      <p className="vrm-ar-tete">{achats === undefined ? tr('annonces.annonces2', { n: String(lignes.length), toLowerCase: String(PAS_SU.enCours.toLowerCase()) }) : tr('annonces.annoncesAvecSuggestion', { n: String(lignes.length), nSugg: String(nSugg) })}{achats !== undefined && nSugg < lignes.length ? <span> {tr('annonces.suggestionMemeMarque')}</span> : null}</p>
      {onSerie ? <div className="vrm-ar-serie"><Bouton variante="secondaire" icone="pencil" data-ar-serie="" onClick={onSerie}>{tr('annonces.saisieSeriePrix')}</Bouton></div> : null}
      <ul className="vrm-ar-liste">
        {lignes.map((l) => {
          const it = l.item, t = l.texte, num = l.fiche && l.fiche.numero;
          const prix = (() => { const v = it.price && typeof it.price === 'object' ? it.price.amount : it.price; const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; })();
          const relierTxt = t && t.proposition ? `${VERBES.relier} · ${montant(t.proposition.centimes / 100)}` : VERBES.relier;
          return (
            <li key={l.id} className="vrm-ar-ligne" data-ar-ligne={l.id} data-ar-plus-tard={l.plusTard ? '1' : undefined} data-ar-reportee={l.reporteLe ? String(l.reporteLe).slice(0, 10) : undefined} data-ar-sugg-tx={l.sugg ? String(l.sugg.achat.transaction_id) : ''}>
              <div className="vrm-ar-annonce">
                {it.photo ? <PhotoVinted src={it.photo} alt="" className="vrm-ar-photo" loading="lazy"/> : <PhotoVide taille={48}/>}
                <span className="vrm-ar-centre"><span className="vrm-ar-nom">{num ? <Numero n={num} taille="petit"/> : null}<span className="vrm-ar-titre">{it.title || tr('annonces.sansTitre')}</span></span>
                  {/* (6 nov., finitions) La date de SON « Plus tard » est dite ; au bout de 7 jours l'annonce revient. */}
                  <span className="vrm-ar-sous">{[prix != null ? montant(prix) : '', l.reporteLe ? `reportée le ${jour(l.reporteLe)}${l.plusTard && l.revientLe ? ` · revient le ${jour(l.revientLe)}` : ''}` : ''].filter(Boolean).join(' · ')}</span></span>
              </div>
              {l.sugg ? (
                <div className="vrm-ar-sugg" data-ar-rang={l.sugg.rang}>
                  {orderPhoto(l.sugg.achat) ? <PhotoVinted src={orderPhoto(l.sugg.achat)} alt="" className="vrm-ar-photo-achat" loading="lazy"/> : <PhotoVide taille={36}/>}
                  <span className="vrm-ar-centre"><span className="vrm-ar-titre">{t.titre || tr('annonces.achatSansTitre')}</span>
                    <span className="vrm-ar-sous">{[jour(t.date), compteDe(l.sugg.achat), t.lot ? 'lot : le prix de cet article te sera demandé' : t.proposition ? (t.proposition.source === 'recu' ? 'prix du reçu' : 'article seul') : (t.prixLu != null ? `payé ${montant(t.prixLu)}` : '')].filter(Boolean).join(' · ')}</span></span>
                </div>
              ) : <div className="vrm-ar-sans" data-ar-sans-sugg="">{achats === undefined ? PAS_SU.enCours : tr('annonces.aucuneSuggestion')}</div>}
              <div className="vrm-ar-gestes">
                {l.sugg ? <Bouton variante="secondaire" icone="link" data-ar-relier={String(l.sugg.achat.transaction_id)} onClick={() => onRelier(it, l.sugg.achat)}>{relierTxt}</Bouton>
                  : <Bouton variante="secondaire" icone="link" data-ar-choisir="" disabled={achats === undefined} onClick={() => onChoisir(it)}>{tr('annonces.choisirAchat')}</Bouton>}
                {/* (11 nov., lot DJ5) La suggestion n'est qu'une proposition : un AUTRE achat se choisit ici. */}
                {l.sugg ? <Bouton variante="discret" icone="search" data-ar-autre={String(l.sugg.achat.transaction_id)} onClick={() => onChoisir(it, l.sugg.achat)}>{tr('annonces.autreAchat')}</Bouton> : null}
                <Bouton variante="discret" icone="pencil" data-ar-saisir="" onClick={() => onSaisir(it)}>{tr('annonces.saisir')}</Bouton>
                {!l.plusTard ? <Bouton variante="discret" data-ar-plus-tard-geste="" onClick={() => onPlusTard(l.id)}>{tr('annonces.plusTard')}</Bouton> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
// ⟦← App.jsx #16⟧
// Le geste sur la fiche d'une annonce Vinted : « Relier à Vestiaire », ou, reliée, « Délier Vestiaire ».
function GesteLienVcVinted({ it, num, style }) {
  const vcLoc = useVcLocal();
  const pid = produitDeVinted(vcLoc.liens, it && it.id);
  if (pid) return <button type="button" className="vrm-fiche-geste" data-annonce-delier-vc={String(it.id)} data-lien-vc-produit={pid} onClick={() => defaireVc(pid)} style={style}>{tr('annonces.delierVestiaire')}</button>;
  return <button type="button" className="vrm-fiche-geste" data-annonce-relier-vc={String(it.id)} onClick={() => { try { window.dispatchEvent(new CustomEvent('vrm:lien-vc', { detail: { sens: 'vinted', id: String(it.id), num: String(num), titre: it.title || '', photo: typeof it.photo === 'string' ? it.photo : (it.photo && typeof it.photo.url === 'string' ? it.photo.url : ''), marque: it.brand || it.brand_title || '', taille: it.size || it.size_title || '', couleur: '' } })); } catch (_) {} }} style={style}>{tr('annonces.relierVestiaire')}</button>;
}
// ⟦← App.jsx #17⟧
// ⟦→ ecrans/MessagesLeboncoin.jsx #1⟧
// ⟦→ ecrans/Leboncoin.jsx #9⟧

// ── QUOI RECEVOIR SUR LE TÉLÉPHONE ──────────────────────────────────────────
// Julien : « des fois je reçois des choses complètement débiles ». Mesuré : un
// push partait à chaque étape de colis — 61 de ses 94 emails de suivi
// n'appelaient aucune action. Les défauts ne sonnent plus que pour l'argent et
// ce qu'il y a à faire ; le reste reste consultable dans l'app.
// ⚠️ Écrit dans la ligne `push_prefs`, que le SERVEUR lit avant d'envoyer
//    (api/_lib/push.js). Ce n'est donc pas un filtre d'affichage : la
//    notification n'est pas envoyée du tout.
// Une ligne de « Numéros à vérifier sur tes cartons » (écran Annonces).
function LigneVerifCarton({ it, fiche, preuve, onConfirmer, onCorriger, onPlusLa }) {
  const [v, setV] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const agir = async (f) => { if (occupe) return; setOccupe(true); try { await f(); } finally { setOccupe(false); } };
  return (
    <div data-verif-carton={String(it.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
      {it.photo
        ? <PhotoVinted src={it.photo} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: C.card2 }}/>
        : <div style={{ width: 48, height: 48, borderRadius: 12, background: C.card2, flexShrink: 0 }}/>}
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        {/* (11 nov., pire cas) Le titre ENTIER : c'est lui qu'on compare au carton (coupé, « Größe 42 Sportschuh… » ne disait plus quelle paire). */}
        <div data-verif-titre="" style={{ fontSize: 13, fontWeight: 600, color: C.text, overflowWrap: 'anywhere' }}>{it.title}</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {tr('annonces.vrmDit')} <b data-verif-actuel style={{ color: C.text }}>N°{fiche.numero}</b>
          {it._vrmMasquee ? <> · <span data-verif-masquee>{tr('annonces.masqueeVinted')}</span></> : null}
          {preuve ? <> · <span data-verif-preuve>{preuve}</span></> : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={occupe} onClick={() => agir(() => onConfirmer(it))} style={{ padding: '7px 10px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{trj('annonces.bien', { numero: fiche.numero })}</button>
        <input className="vrm-autre-num" value={v} onChange={(e) => setV(e.target.value)} inputMode="numeric" placeholder={tr('annonces.autre')} aria-label={tr('annonces.numeroEcritEtiquette', { title: String(it.title) })}
          onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) agir(() => onCorriger(it, v)); }}
          style={{ width: 118, padding: '7px 9px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13 }}/>
        <button type="button" disabled={occupe || !v.trim()} onClick={() => agir(() => onCorriger(it, v))} style={{ padding: '7px 10px', borderRadius: 12, border: 'none', background: C.text, color: C.card, fontSize: 13, fontWeight: 600, cursor: v.trim() ? 'pointer' : 'default', opacity: v.trim() ? 1 : 0.5 }}>{tr('annonces.corriger')}</button>
        {it._vrmMasquee && onPlusLa ? <button type="button" data-masquee-partie={String(it.id)} disabled={occupe} onClick={() => agir(() => onPlusLa(it))} style={{ padding: '7px 10px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{tr('annonces.plus')}</button> : null}
      </div>
    </div>
  );
}