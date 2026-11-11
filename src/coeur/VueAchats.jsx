// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import { CaseSerie, BarreSerie, OuvrirSerie } from '../composants/SelectionSerie.jsx';
import { STYLE_FLOU } from '../flouCompte.js';
import { normaliserSuivi } from '../../api/_lib/etat-colis-email.js';
import { achatDuColis, suivisAchat } from '../liensColis.js';
import { suiviDeLigne, codePostalLu, transporteurDeForme, suiviValide, TRANSPORTEURS_SAISIE, normaliserCodePostal, idSuiviManuel } from '../../api/_lib/suivi-colis.js';
import { texteCodePostalMr, carrierLisible, carrierNonLu, LECTURE_SERVEUR_TRANSP } from '../../api/_lib/transporteurs.js';
import { ecrituresRepartition, annulationRepartition, ecritureLienAchat, prixAchatCentimes } from '../achatsSourcing.js';
import { modeleSur } from '../ceQuiRapporte.js';
import { requeteDeLaVoix } from '../rechercheVocale.js';
import React, { useState, useMemo, useEffect } from 'react';
import { montant } from '../format.js';
import { arriveeColisEmail, arriveeColisVinted, jourLocal, texteArrivee } from '../../api/_lib/arrivee-colis.js';
import { urgenceTri, GARDE_MAX_J } from '../../api/_lib/retrait-colis.js';
import { texteLimite, motAConfirmer } from '../aConfirmer.js';
import { installerExtensionIci, pageExtensionsIci } from '../navigateurExtension.js';
import CarteRelaisColis from '../CarteRelais.jsx';
import PastilleTransporteur from '../PastilleTransporteur.jsx';
import { cleStatTransporteur } from '../transporteursVisuels.js';
import { quandCommandeVinted } from '../ordreRecent.js';
import { reglageDePage } from '../design/carteChiffres.js';
import { attrCible } from '../cibleNotif.js';
import { propositionPrixAchat } from '../prixAchatPropose.js';
import { achatAnnule } from '../registres.js';
import { CLE_HORS_MASQUES } from '../achatsDoubles.js';
import Illustration from '../composants/Illustration.jsx';
import { champsAvant } from '../annulerCommandes.js';
import { PastilleFacture } from '../FactureAchat.jsx';
import { ACHAT_A_RENVOYER, AUTH, AcctTag, BlocComptesMuets, Bouton, BoutonRappel, BoutonSuivreColis, C, CARRIERS, CarrierBadge, CarteStatsApp, CodeRetraitCopiable, EXT_ATTENDUE, EXT_CAPACITES, EmptyState, FermeAuRetour, INV_STATUS, Icon, LigneArrivee, LigneNouvelleVinted, LigneSansDate, LigneTransporteur, MicDictee, NAV, NOM_RECU_ACHAT, Notice, PeriodePicker, PhotoVinted, Pourquoi, SB_CONFLICT, SUPABASE_URL, ScreenHead, Segmente, Skeleton, __vmrEtat, __vmrPlusieurs, aLaDemande, achatsMasques, askConfirm, carrierKey, carrierName, cleanLieu, codePerime, codeRetrait, colisKey, connexionExtensionVrm, dansPeriode, dateCourteFr, dateFr, dateLocaleISO, demanderVue, etatColisEmail, extEstEnRetard, extSait, extSaitLireCodes, fetchEmailAchats, generateAchatJustificatif, gesteCorbeille, gesteVrm, iconeApp, joursAvant, ligneTranspDe, lireReglageCarte, load, montantCommande, nomPointRetrait, onVmrExt, orderPhoto, pointAvant, prixAchatHorsNombre, qrImage, raisonAVerifier, raisonExtGlobale, retraitMode, save, sbAuth, telechargerFichier, texteLimiteRetrait, toast, trackUrl, tsCommande, txRecuAchat, useEtatEmailsComptes, useSansSouris, vmrExtPresent, vmrExtVersion, withOwner } from '../App.jsx';

// La branche {curSub==='achats' && …} de Comptabilite, telle quelle, avec 14 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function VueAchats({ v }) {
  const { NoAcc, aConfirmer, aEncoreCode, aFilter, accName, accNameOf, accounts, achatMenu, achatNotes, achatPhKo, achatsAffiches, achatsDoubles, achatsMax, achatsOutilsOuverts, achatsSansDate, annBase, asoDeclarables, asoDelai, asoFichesLibres, asoFournisseurs, asoLots, baseKO, boutonCalculette, buyNumByTxn, buys, buysBase, collected, compteDuColisEmail, dansPlateforme, dropOffs, entreeSuiviAchat, estFloute, estLotApp, etatColisVinted, facturesAchat, finsSuivis, fmtE0, foActions, garderAchatDouble, gesteCollecte, gestesRetraitAchats, groupesRelais, horsMasques, imgMortes, importAchats, indexSuivisAchats, lienConv, lireSuivis, lireTransp, listings, liveStats, loadListings, loadOrders, markCollected, markPickupDone, masquerAchat, masquerAchats, matchOrd, modeListeAchats, modeRetraits, nextNumero, nonRecusAchat, noterImgMorte, nouvelleDe, numeros, offBuys, offBuysTous, offSecOpen, onNav, openQrView, ordSearch, ordSearchDiff, periode, phaseReception, pickupDone, pickupUnion, poserPatchAchat, qrVivant, receiptFor, recordUsed, recusAchat, recusRelies, relaisDe, relireSuivisManuels, relireSuivisVinted, retraitsOutils, serieAchats, setAFilter, setAchEmails, setAchatMenu, setAchatPhKo, setAchatsMax, setAchatsOutilsOuverts, setAsoOuvert, setBuyByNum, setBuys, setHorsMasques, setLotsDeclares, setNoteEdit, setNumeros, setOffBuys, setOffSecOpen, setOrdSearch, setPeriode, setPickupDone, setReceiptView, setRepartitionsLots, setReventeVue, stockPourModele, suivisManuels, suivisVinted, trackForBuy, tracking, trackingKO, trackingRetrait, transp, transpMap, transporteurColis, ventilationDeTx } = v;
  /*⟦← App.jsx #h1_1⟧*/const unmarkCollected = (t) => gesteCollecte(t, false);/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const etatSuiviDe = (o) => { const e = entreeSuiviAchat(o); return e && e.nv ? 'nouvelle' : (e && e.ligne ? 'sans-date' : 'aucune'); };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_3⟧*/const relireSuivisManuelsPartout = async () => { await relireSuivisManuels(); try { window.dispatchEvent(new Event('vrm:suivis-manuels')); } catch (_) {} };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_4⟧*/const unmarkPickupDone = (o) => { const k = String(o.transaction_id||''); if(!k) return; setPickupDone(prev=>{ const u={...prev}; delete u[k]; save('vinted_pickup_done',u); return u; }); };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_5⟧*/const markPickupDoneSerie = (liste) => {
    const L = (liste || []).filter(o => o && o.transaction_id != null);
    if (!L.length) return 0;
    const t = new Date().toISOString();
    gesteVrm(L.length > 1 ? `${L.length} colis retirés` : 'Colis retiré', L.map(o => ({ k: 'vinted_pickup_done', type: 'cle', id: String(o.transaction_id), apres: t, avant: pickupDone[String(o.transaction_id)] })), { vinted_pickup_done: setPickupDone });
    return L.length;
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_6⟧*/const actionsSerieAchats = () => {
    const parTx = new Map(achatsAffiches.map(x => [String(x.o.transaction_id), x]));
    const lignes = (cles) => cles.map(k => parTx.get(k)).filter(Boolean);
    return [
      { k: 'retire', libelle: 'Retiré', icone: 'check', variante: 'primaire', faire: (cles) => {
        const { ok, pasFaits } = trierSerie(lignes(cles), ({ o, st }) => {
          if (st.step === 0) return 'annulé';
          if (st.retour) return 'en retour';
          if (pickupDone[String(o.transaction_id)] || st.step >= 4) return 'déjà retiré';
          return st.step === 3 ? true : 'pas au point relais';
        });
        markPickupDoneSerie(ok.map(x => x.o));
        return resumeSerie({ faits: ok, pasFaits }, { un: 'retiré', plusieurs: 'retirés' });
      } },
      { k: 'relier', libelle: 'Relier', icone: 'link', faire: (cles) => {
        // Relier = désigner LA paire de l'achat : c'est toujours SON tap (§5, jamais par
        // ressemblance). La série l'amène à la file « Sans achat relié » (une suggestion
        // par annonce, « Relier · 32 € » en un tap) et dit ce qui est déjà relié.
        const { ok, pasFaits } = trierSerie(lignes(cles), ({ o, st }) => st.step === 0 ? 'annulé' : buyNumByTxn[String(o.transaction_id)] != null ? 'déjà relié' : true);
        if (!ok.length) return resumeSerie({ faits: [], pasFaits }, { un: 'à relier', plusieurs: 'à relier' });
        demanderVue('sansachat'); if (onNav) onNav('cat_annonces');
        return resumeSerie({ faits: ok, pasFaits }, { un: 'à relier dans « Sans achat relié »', plusieurs: 'à relier dans « Sans achat relié »' });
      } },
      { k: 'exporter', libelle: 'Exporter', icone: 'doc', faire: (cles) => {
        const L = lignes(cles);
        const csv = csvDe(['Date', 'Compte', 'Article', 'N°', 'Prix payé (€)', 'État', 'N° de transaction'],
          L.map(({ o, st }) => [o.date && Number.isFinite(new Date(o.date).getTime()) ? new Date(o.date).toLocaleDateString('fr-FR') : '', o._acc ? accNameOf(o._acc) : '', o.title || '', buyNumByTxn[String(o.transaction_id)] ?? '', montantCommande(o).toFixed(2).replace('.', ','), st.label || '', String(o.transaction_id)]));
        telechargerFichier(csv, `achats-${dateLocaleISO()}.csv`, 'text/csv;charset=utf-8');
        return resumeSerie({ faits: L, pasFaits: [] }, { un: 'achat exporté', plusieurs: 'achats exportés' });
      } },
      { k: 'masquer', libelle: 'Masquer', icone: 'eyeOff', faire: (cles) => {
        const deja = achatsMasques();
        const { ok, pasFaits } = trierSerie(lignes(cles), ({ o }) => deja.has(String(o.transaction_id)) ? 'déjà masqué' : true);
        masquerAchats(ok.map(x => x.o));
        return resumeSerie({ faits: ok, pasFaits }, { un: 'masqué', plusieurs: 'masqués' });
      } },
    ];
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_7⟧*/const reafficherHorsDouble = (id) => gesteVrm('Achat réaffiché', [{ k: CLE_HORS_MASQUES, type: 'ensemble', id: String(id), apres: false, avant: true }], { [CLE_HORS_MASQUES]: setHorsMasques });/*⟦←/⟧*/
  /*⟦← App.jsx #h1_8⟧*/const addOffBuy = (b) => setOffBuys(prev => { const u = [{ id: 'ob_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), createdAt: new Date().toISOString(), ...b }, ...prev]; save('vinted_offvinted_buys', u); return u; });/*⟦←/⟧*/
  /*⟦← App.jsx #h1_9⟧*/const updOffBuy = (id, patch) => setOffBuys(prev => { const u = prev.map(x => x.id===id ? { ...x, ...patch } : x); save('vinted_offvinted_buys', u); return u; });/*⟦←/⟧*/
  /*⟦← App.jsx #h1_10⟧*/const delOffBuy = (id) => {
    const L = load('vinted_offvinted_buys', []); const i = L.findIndex(x => x && x.id === id); const b = i >= 0 ? L[i] : null;
    if (!b) { setOffBuys(prev => { const u = prev.filter(x => x.id!==id); save('vinted_offvinted_buys', u); return u; }); return; }
    gesteCorbeille({ type: 'achat', libelle: b.title || '', numero: b.numero || null, lignes: b.photo ? ['achat_hors_photo_' + String(id).replace(/[^\w-]/g, '')] : [],
      morceaux: [{ k: 'vinted_offvinted_buys', type: 'element', idCle: 'id', id, index: i, avant: b }] }, { vinted_offvinted_buys: setOffBuys });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_11⟧*/const asoRelier = (tx, f) => {
    const a = buysBase.find((o) => String(o.transaction_id) === String(tx)); if (!a || !f) return;
    const lot = estLotApp(a);
    const p = lot ? null : propositionPrixAchat({ identite: { achat: a, par: 'choix' }, ventilationDe: ventilationDeTx, estLot: estLotApp });
    const patch = ecritureLienAchat(numeros[f.cle] || {}, a, { lot, montant: p ? p.centimes : prixAchatCentimes(a), accNom: a._acc ? accNameOf(a._acc) : '', photo: orderPhoto(a) || '' });
    if (!patch) return;
    // (9 nov., lot B) Relier un achat (SON clic, par identité) : la pilule « Annuler » 5 s au lieu du
    // simple message — l'annulation remet exactement les champs d'avant de CETTE fiche.
    if (numeros[f.cle]) gesteVrm(`N°${f.numero} relié`, [{ k: 'vinted_annonce_numeros', type: 'champs', id: f.cle, apres: patch, avant: champsAvant(numeros[f.cle], patch) }], { vinted_annonce_numeros: setNumeros });
    else { poserPatchAchat('f:' + f.cle, patch); toast(`N°${f.numero} relié`); }
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_12⟧*/const asoRepartir = async ({ lot, saisies, inclus }) => {
    const ok = await askConfirm({ title: `Répartir ${lot.titre ? '« ' + lot.titre + ' »' : 'ce lot'} ?`,
      desc: lot.articles.map((x, i) => `${x.numero ? 'N°' + x.numero : 'Sans N°'} · ${String(saisies[i] || '').trim()}\u00a0€`).join('\n'), ok: 'Enregistrer', cancel: 'Annuler' });
    if (!ok) return false;
    const w = ecrituresRepartition({ achat: lot.achat, articles: lot.articles, saisies, inclus, ventilation: ventilationDeTx(lot.tx), confirme: true,
      at: new Date().toISOString(), accNom: lot.achat._acc ? accNameOf(lot.achat._acc) : '', photo: orderPhoto(lot.achat) || '' });
    if (!w) { toast("La somme ne tombe pas juste : rien n'a été enregistré"); return false; }
    pointAvant('serie', `Répartition d’un lot (${w.ecritures.length} prix)`);   // (11 nov.) revenir en arrière
    for (const x of w.ecritures) poserPatchAchat(x.cle, x.patch);
    setRepartitionsLots((prev) => { const u = { ...prev, [lot.tx]: lot.journal ? { ...w.journal, avant: lot.journal.avant } : w.journal }; save('vrm_repartitions_lots', u); return u; });
    toast(`${w.ecritures.length} prix d'achat enregistrés`);
    return true;
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_13⟧*/const asoAnnuler = async (lot) => {
    if (!lot || !lot.journal) return false;
    const ok = await askConfirm({ title: 'Annuler la répartition ?', desc: 'Les prix d’achat d’avant reviennent.', ok: 'Annuler la répartition', cancel: 'Garder' });
    if (!ok) return false;
    for (const x of annulationRepartition(lot.journal)) poserPatchAchat(x.cle, x.patch);
    setRepartitionsLots((prev) => { const u = { ...prev }; delete u[lot.tx]; save('vrm_repartitions_lots', u); return u; });
    toast('Répartition annulée');
    return true;
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_14⟧*/const asoDeclarerLot = (tx, oui) => setLotsDeclares((prev) => { const u = { ...prev }; if (oui) u[String(tx)] = true; else delete u[String(tx)]; save('vrm_lots_declares', u); return u; });/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/<div className="vrm-achats" data-ecran-achats={modeRetraits?(retraitsOutils?'retraits-outils':'retraits'):'achats'}>
        {/* (26 oct.) Dans l'espace Vinted, l'onglet « Achats » sélectionné dit déjà le titre : pas deux fois (§7). */}
        {/* (9 nov., lot V) « Scanner » au point relais : la caméra lit le colis ⇒ l'achat qui porte CE n°
            de suivi ou CE code de retrait (src/scanColis.js), « J'ai retiré » sur SON toucher. */}
        {!dansPlateforme && (modeRetraits
          ? <ScreenHead icon="qr" title="Colis à retirer" desc="Les colis à aller chercher : code de retrait, date limite, point relais." right={gestesRetraitAchats}/>
          : <ScreenHead icon="bag" title="Achats" desc="En route, reçus, et le prix payé." right={<div className="vrm-achats-gestes" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{boutonCalculette}{gestesRetraitAchats}</div>}/>)}
        {/* (9 nov.) Pas dans Colis → À retirer : ce bloc y est rendu SOUS la liste (avant « Argent à vérifier ») et Colis porte
            déjà « Scanner » en tête de l'onglet (mode retrait) ; il ne reste que dans l'espace plateforme → Achats. */}
        {dansPlateforme && !modeRetraits && !baseKO && pickupUnion.total > 0 ? <div className="vrm-achats-scan" data-achats-scan="" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{boutonCalculette}{gestesRetraitAchats}</div> : null}
        {/* (10 nov., lot L) Dans l'espace Vinted (pas d'en-tête), la calculette garde sa place en haut. */}
        {dansPlateforme && !modeRetraits && !(!baseKO && pickupUnion.total > 0) ? <div className="vrm-achats-scan" data-achats-scan="" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{boutonCalculette}</div> : null}
        {/* (3 nov.) LA carte d'Achats parle d'ACHATS (jamais « Vendu · mois ») : Dépensé du mois (la règle de la
            case « Dépensé » plus bas — hors annulés, `montantCommande` — sur le mois en cours), En route et Reçus
            (les nombres des onglets, `phaseReception`), À retirer (`vrm_colis_retirer`). Aucun nombre recalculé. */}
        {dansPlateforme && !modeRetraits && !baseKO && (() => {
          const lu = Array.isArray(buys.items);
          // (6 nov.) Les achats se lisent encore : « lecture… » (jamais « pas lu » qui deviendrait un nombre),
          // et la carte attend avec l'écran (src/AttenteEcran.jsx).
          const enLecture = !lu && !buys.error ? { raisonCourte: 'lecture…', enCours: true } : {};
          const m0 = new Date(); m0.setDate(1);
          const duMois = { from: m0, to: new Date() };
          const annule = achatAnnule;   // (3 nov.) la règle de « Dépensé », partagée avec le registre des achats (src/registres.js)
          const mois = lu ? buysBase.filter((o) => !annule(o) && dansPeriode(o, duMois)) : [];
          const depense = lu ? mois.reduce((a, o) => a + montantCommande(o), 0) : null;
          const n = { route: 0, recu: 0 }; if (lu) buysBase.forEach((o) => { const ph = phaseReception(o); if (n[ph] != null) n[ph]++; });
          return <CarteStatsApp page="achats" aide liveStats={liveStats} className="vrm-fu-ecran" ici="achats" onNav={onNav} sel={{ site: 'toutes', compte: null, periode: null }}
            locaux={{
              depense: { nom: 'Dépensé du mois', court: 'Dépensé', type: 'eur', aide: 'Tes achats du mois, hors annulés et remboursés (le montant payé).', valeur: depense, ...enLecture, quand: (() => { const m = m0.toLocaleDateString('fr-FR', { month: 'long' }); return m.charAt(0).toUpperCase() + m.slice(1); })(), attrs: { 'data-n': lu ? String(mois.length) : '' } },
              enroute: { nom: 'En route', court: 'En route', type: 'n', aide: 'Tes achats payés ou expédiés, pas encore arrivés au point relais.', valeur: lu ? n.route : null, ...enLecture, attrs: { 'data-n': lu ? String(n.route) : '' } },
              recus: { nom: 'Arrivés', court: 'Arrivés', type: 'n', aide: 'Tes achats livrés ou finalisés, depuis toujours.', valeur: lu ? n.recu : null, ...enLecture, attrs: { 'data-n': lu ? String(n.recu) : '' } },
            }}/>;
        })()}
        {/* (5 nov.) Pourquoi des codes manquent (l'extension les lit dans les conversations, sur le
            compte connecté dans l'onglet) : dit ICI, sur l'écran où il le constate. Se tait si elle est à jour. */}
        <ExtEnRetard onNav={onNav}/>
        {/* (11 nov.) Où acheter ce qui se revend le mieux : la carte lit la publication faite plus haut
            (`publierMeilleures`), la même qu'Argent → Statistiques. */}
        {dansPlateforme && !modeRetraits && !baseKO && <div className="vrm-achats-sources" data-achats-sources="" style={{ margin: '12px 16px 0' }}><MeilleuresSources owner={AUTH.user?.id || ''} Retour={FermeAuRetour} ici="achats"/></div>}
        {/* (5 nov., revue 2.16) Fournisseurs · Délai · Lots rangés derrière « … » : une seule carte de
            chiffres en tête, les outils à un geste (src/AchatsOutils.jsx, inchangé). */}
        {!modeRetraits && !baseKO && achatsOutilsOuverts && <div className="vrm-achats-outils" id="vrm-achats-outils" data-achats-outils="ouverts">
          <AchatsOutils fournisseurs={asoFournisseurs ? { ...asoFournisseurs, actions: foActions } : asoFournisseurs} delai={asoDelai} lots={asoLots} achatsDeclarables={asoDeclarables} fichesLibres={asoFichesLibres}
          onOuvrir={setAsoOuvert} onRelier={asoRelier} onRepartir={asoRepartir} onAnnulerRepartition={asoAnnuler} onDeclarerLot={asoDeclarerLot}
          onFiche={(n)=>{ try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: String(n) })); } catch (_) {} }}
          Retour={FermeAuRetour} Photo={(src)=><PhotoVinted src={src} alt="" loading="lazy"/>}/>
        </div>}
        {!retraitsOutils && <NoAcc/>}
        {/* ⚠️ LE BANDEAU DE L'EXTENSION VIT AUSSI ICI, PAS SEULEMENT SUR MA
            JOURNÉE. C'est sur CET écran que Julien compte les codes qui
            manquent — « il n'y a pas tous les codes de retrait ». Mesuré le
            6 septembre : `panel_colis_relais`, la ligne où l'extension dépose
            les codes lus dans les conversations, contenait **0 colis**, et
            aucun des colis Vinted à retirer n'avait de code. Lui dire pourquoi
            sur un autre écran que celui où il le constate, ça ne sert à rien.
            Le bandeau se cache tout seul dès que l'extension est à jour.
            (5 nov.) Il est rendu plus haut, en tête de l'écran. */}
        {/* ⚠️ MÊME ORDRE QUE L'ÉCRAN VENTES. Ici la période arrivait en 19e position,
            après les cartes — alors qu'elle est en 1re sur Ventes. Deux écrans
            jumeaux organisés différemment, c'est ce qui rend la navigation
            hésitante : ce qu'on manipule tous les jours passe en premier. */}
        {!modeRetraits && <div className="vrm-achats-barre">
        <div className="vrm-seg vrm-seg-plein" role="group" aria-label="Étapes de tes achats">
          {/* ⚠️ LES ONGLETS SONT LES ÉTAPES DU COLIS, pas des états de commande.
              C'est ça, un outil de réception : où en est chaque article entre
              « payée » et « dans le carton chez moi ». Le compte est affiché :
              un onglet vide se voit avant d'être ouvert. */}
          {(()=>{ const n={relais:0,route:0,recu:0};
            buysBase.forEach(o=>{ const p=phaseReception(o); if(n[p]!=null) n[p]++; });
            // ⚠️ « À retirer » DOIT afficher LE MÊME NOMBRE que la section juste
            // en dessous. `pickupUnion.total` est LA définition (union email +
            // statut Vinted, déjà partagée par Ma journée et cet onglet, §11) —
            // compter les achats « au relais » à la place donnait 2 en haut et
            // « 4 colis à retirer » en dessous, sur le même écran.
            // (revue du 23 oct.) E-mails de suivi pas lus ⇒ « — », jamais un total
            // partiel (les colis d'e-mail manqueraient) présenté comme complet.
            // (31 oct., soir) Sur « Achats », plus d'étape « À retirer » : c'est
            // l'écran voisin, « Colis à retirer » (pas deux fois la même chose).
            // (6 nov., onglets A, §7) LE MÊME NOMBRE UNE FOIS. Sur sa base : la carte disait « 28 En
            // route · 1806 Arrivés » et, juste dessous, les onglets « En route 28 · Arrivés 1,8 k » (deux
            // écritures du même nombre). Un onglet dont la carte du haut montre le chiffre se tait ;
            // `data-n` reste (le nombre de l'onglet, pour qui le lit).
            const surCarte = (dansPlateforme && !baseKO) ? idsCarteAchats() : null;
            const dejaDit = (id) => !!surCarte && surCarte.has(id === 'route' ? 'enroute' : id);
            return [...(modeListeAchats?[]:[['attente','À retirer',tracking===null?'—':pickupUnion.total]]),['route','En route',n.route],['recus','Arrivés',n.recu],['all','Tous',null]].map(([id,label,cnt])=>(
            <button type="button" key={id} className="vrm-seg-btn" data-achats-onglet={id} data-n={cnt==null?undefined:String(cnt)} onClick={()=>setAFilter(id)} aria-pressed={aFilter===id} aria-label={cnt?`${label} ${cnt}`:undefined} style={{whiteSpace:'nowrap'}}>{label}{cnt&&!dejaDit(id)?<span className="vrm-seg-n" title={String(cnt)}> {cnt>=1000?`${(Math.floor(cnt/100)/10).toLocaleString('fr-FR')} k`:cnt}</span>:null}</button>
          )); })()}
        </div>
        {!baseKO && <button type="button" className="vrm-icon-control vrm-achats-plus" data-achats-plus={achatsOutilsOuverts?'ouvert':'ferme'} aria-expanded={achatsOutilsOuverts} aria-controls="vrm-achats-outils" aria-label="Plus : fournisseurs, délai, lots" title="Fournisseurs · Délai · Lots" onClick={()=>setAchatsOutilsOuverts(v=>!v)}><Icon name="more" size={20}/></button>}
        </div>}
        {/* (31 oct., soir) Achats ne montre plus les colis à retirer : une ligne mène
            à Colis (colonne « À retirer » et son détail). Le nombre est celui de la
            règle (`pickupUnion.total`), seulement quand les e-mails de suivi sont lus. */}
        {/* (5 nov.) Le chemin vers Colis reste ; dans l'espace Vinted, la carte sombre dit déjà le nombre :
            le lien ne le répète pas (le même nombre une fois, §7). */}
        {modeListeAchats && tracking!==null && pickupUnion.total>0 && (
          <div style={{margin:'0 0 12px'}}>
            <button type="button" className="vrm-lien-action" data-achats-vers-colis={pickupUnion.total} onClick={()=>onNav&&onNav('cat_achats')}
              style={{minHeight:44,background:'transparent',border:0,padding:0,color:C.text,fontSize:13,fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>
              {dansPlateforme ? 'Voir les colis à retirer → Colis' : `${pickupUnion.total} colis à retirer → Colis`}
            </button>
          </div>
        )}
        {/* ⚠️⚠️ UN ACHAT EN LITIGE NE SE CACHE PAS DERRIÈRE « TOUS » (revue du
            9 octobre). « Retour initié » range l'achat en « annulé » pour
            l'argent (aucune livraison à attendre) : il sortait donc de « En
            route », l'onglet par défaut n'affiche aucune liste, et le lien du
            bordereau de retour ne se voyait QUE sous « Tous », parmi des
            centaines d'achats. Une action de litige cachée est un colis oublié.
            Il a sa place en tête des onglets du quotidien — sans revenir dans
            le compte « En route » (il n'arrive pas, il repart). Sous « Tous »,
            sa carte porte déjà le lien : pas deux fois. */}
        {/* (21 oct., 5.204) À CONFIRMER AVANT LA DATE LIMITE — « Tout est OK »
            sur Vinted. Une ligne, le compte nommé une fois quand il est le même
            (§7), le lien vers SA conversation. « Pas su » se dit, jamais un
            « rien à confirmer ». */}
        {/* (31 oct., soir) « Tout est OK » avant la date limite : un geste sur le
            colis qu'on vient de retirer — sur « Colis à retirer », pas sur « Achats ». */}
        {!modeListeAchats && aConfirmer.etat==='passu' && !baseKO && <div data-a-confirmer="passu" style={{fontSize:13,color:C.muted,margin:'4px 0 10px'}}>Colis à confirmer : pas pu lire — rien n'est perdu, réessaie dans un moment.</div>}
        {!modeListeAchats && aConfirmer.etat==='lu' && aConfirmer.liste.length>0 && (()=>{
          const l = aConfirmer.liste;
          const nomDe = (e)=>{ const a=(accounts||[]).find(x=>String(x.vinted_user_id)===String(e.uid)); return a?accNameOf(a):''; };
          const comptes = [...new Set(l.map(nomDe).filter(Boolean))];
          const unSeul = comptes.length===1;
          return (
            <div className="vrm-achats-bloc" data-a-confirmer={l.length} data-a-confirmer-limite={l[0].limite||''} style={{background:C.card,border:`1px solid ${C.border}`}}>
              <div className="vrm-achats-bloc-t" style={{color:C.text}}><span style={{color:C.warn}}>✓</span> {l.length} {motAConfirmer(l)} à confirmer avant le {texteLimite(l[0])}{unSeul?<span style={{fontWeight:500,color:C.muted}}> · compte {comptes[0]}</span>:null} <Pourquoi label="Comment confirmer">Vérifie l'article puis appuie sur « Tout est OK » dans la conversation Vinted (ou « J'ai un problème »). Passé la date, Vinted conclut sans toi.</Pourquoi></div>
              {l.map(e=>(
                <div key={e.tx} data-confirmer-tx={e.tx} data-confirmer-sur={e.limiteMs!=null?'oui':'texte'} style={{display:'flex',alignItems:'center',gap:10,marginTop:9,flexWrap:'wrap'}}>
                  {e.photo && !imgMortes.has(e.photo) ? <PhotoVinted src={e.photo} alt="" loading="lazy" onError={()=>noterImgMorte(e.photo)} style={{width:38,height:38,borderRadius:12,objectFit:'cover',flexShrink:0,border:`1px solid ${C.border}`}}/> : null}
                  <div style={{flex:'1 1 160px',minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={e.titre}>{e.titre||'Commande'}</div>
                    <div style={{fontSize:12,color:C.muted}}>{e.quoi==='retour'?'Retour qui te revient':'Achat'} · avant le {texteLimite(e)}{!unSeul && nomDe(e)?` · compte ${nomDe(e)}`:''}</div>
                  </div>
                  {e.url ? <Bouton variante="secondaire" data-confirmer-lien={e.tx} href={e.url} target="_blank" rel="noreferrer" style={{flexShrink:0,minHeight:44}}>Ouvrir la conversation ↗</Bouton> : null}
                </div>
              ))}
            </div>
          );
        })()}
        {/* (31 oct., soir) Le litige est un ACHAT à renvoyer, pas un colis à aller
            chercher : sur « Achats », en tête de chaque étape (Tous compris : c'est
            désormais l'écran par défaut), jamais sur « Colis à retirer ». */}
        {!modeRetraits && (aFilter!=='all' || modeListeAchats) && (()=>{
          const l = buysBase.filter(o=>ACHAT_A_RENVOYER.test(String(o.status||'')));
          if (!l.length) return null;
          const comptes = [...new Set(l.map(o=>o._acc?accNameOf(o._acc):"").filter(Boolean))];
          const unSeul = comptes.length===1;
          return (
            <div className="vrm-achats-bloc" data-a-renvoyer={l.length} style={{background:C.card,border:`1px solid ${C.border}`}}>
              <div className="vrm-achats-bloc-t" style={{color:C.text}}><span style={{color:C.warn}}>↩</span> {l.length} article{l.length>1?'s':''} à renvoyer (litige){unSeul?<span style={{fontWeight:500,color:C.muted}}> · compte {comptes[0]}</span>:null} <Pourquoi label="Pourquoi sur Vinted">L'étiquette de retour se génère sur Vinted — VRM ne l'envoie pas à ta place (compte en litige).</Pourquoi></div>
              {l.map(o=>{ const ph=orderPhoto(o); return (
                <div key={o.transaction_id} style={{display:'flex',alignItems:'center',gap:10,marginTop:9,flexWrap:'wrap'}}>
                  {ph && !imgMortes.has(ph) ? <PhotoVinted src={ph} alt="" loading="lazy" onError={()=>noterImgMorte(ph)} style={{width:38,height:38,borderRadius:12,objectFit:'cover',flexShrink:0,border:`1px solid ${C.border}`}}/> : null}
                  <div style={{flex:'1 1 160px',minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={o.title}>{o.title}</div>
                    {!unSeul && o._acc && <div style={{fontSize:12,color:C.muted}}>compte {accNameOf(o._acc)}</div>}
                  </div>
                  <Bouton variante="secondaire" data-retour-tx={o.transaction_id} href={`https://www.vinted.fr/member/transactions/${encodeURIComponent(o.transaction_id)}`} target="_blank" rel="noreferrer" style={{flexShrink:0,minHeight:44}}>↩ Bordereau de retour ↗</Bouton>
                </div>
              ); })}
            </div>
          );
        })()}
        {/* ⚠️ SUR « À RETIRER », CES TROIS COMMANDES N'AGISSENT SUR RIEN.
            Cet onglet n'affiche AUCUNE liste de commandes (`aFilter==='attente'`
            renvoie faux dans le filtre plus bas) : il montre les colis groupés
            par point relais. La période, la recherche et les quatre chiffres
            comptables portent donc sur du contenu qui n'est pas là — et ils
            repoussaient les colis, leur code et leur QR de plus d'un écran vers
            le bas, alors que c'est exactement ce qu'on vient chercher quand on
            part au relais. Ils reviennent tels quels sur En route / Reçus /
            Tous, où ils filtrent vraiment quelque chose. */}
        {/* (6 nov., v36-visuel-2) La recherche et la période sur UNE ligne (la période sans valeur =
            son icône seule, le libellé reste lu au lecteur d'écran) : la liste remonte d'un cran. */}
        {buysBase.length>0 && aFilter!=='attente' && <div className="vrm-achats-filtres">
        {buysBase.length>0 && aFilter!=='attente' && (
          <label className="vrm-msg-search vrm-achats-search" style={{color:C.muted}}><Icon name="search" size={16}/><input type="search" aria-label="Rechercher un achat" value={ordSearch} onChange={e=>setOrdSearch(e.target.value)} placeholder="Titre, N°, vendeur"
            style={{color:C.text,background:'transparent',border:0,boxShadow:'none'}}/><MicDictee nu titre="Chercher à la voix (« numéro 124 », « chemise bleue »)" onDirect={setOrdSearch} onText={(t)=>setOrdSearch(requeteDeLaVoix(t).requete)}/></label>
        )}
        <PeriodePicker value={periode} onChange={setPeriode} titre="Période des achats" datation="Date d’achat"/></div>}
        {/* ── LES CHIFFRES DE L'ACHAT (l'écran n'en avait AUCUN) ─────────────────
            « C'est mon métier, fais ça comme un pro. » L'écran Ventes porte
            quatre chiffres depuis toujours ; Achats, zéro — alors que l'achat,
            c'est la moitié de la marge. Mesuré sur ses 534 achats réels :
              reçus 326 · 8 064 €   ·   en route 62 · 1 672 €
              au relais 13 · 346 €  ·   ⚠️ annulés/remboursés 146 · 3 980 € = 27,3 %
            Plus d'un achat sur quatre n'aboutit pas, et rien ne le lui disait.
            ⚠️ Les chiffres suivent LA PÉRIODE choisie (`matchOrd`), comme sur
            Ventes — sinon deux écrans jumeaux ne compteraient pas pareil (§11).
            ⚠️ On ne remet PAS « à retirer » ici : ce compte-là a sa définition
            (`pickupUnion.total`, union email + statut Vinted) et il est déjà
            affiché deux fois plus haut. Deux nombres proches pour deux notions
            différentes sur le même écran, c'est exactement ce qu'on s'interdit. */}
        {/* (5 nov., revue 2.15) Une seule carte de chiffres : la grille ne s'affiche plus sous la carte
            sombre (espace Vinted), qui dit déjà Dépensé, En route, À retirer, Arrivés. */}
        {!dansPlateforme && buysBase.length>0 && aFilter!=='attente' && (()=>{
          const dans = buysBase.filter(o=>matchOrd(o));
          const M = (o)=>montantCommande(o);
          const annule = achatAnnule;
          const enRoute = (o)=>!annule(o) && phaseReception(o)==='route';
          const somme = (l)=>l.reduce((a,o)=>a+M(o),0);
          const vrais = dans.filter(o=>!annule(o));
          const ann = dans.filter(annule);
          const rte = dans.filter(enRoute);
          const tauxAnn = dans.length ? Math.round(100*ann.length/dans.length) : 0;
          const prix = vrais.map(M).filter(v=>v>0).sort((a,b)=>a-b);
          const med = prix.length ? prix[Math.floor(prix.length/2)] : 0;
          return (
            // (16 oct.) Une seule surface, quatre cellules — plus quatre cartes de
            // même poids. La couleur ne reste que sur le taux d'annulation quand
            // il est anormal (≥ 20 %) : c'est le seul chiffre à rattraper (§7).
            <div className="vrm-achats-kpis" style={{background:C.card,border:`1px solid ${C.border}`}}>
              {[
                ['Dépensé', fmtE0(somme(vrais)), `${vrais.length} article${vrais.length>1?'s':''}`, null],
                ['Prix médian', fmtE0(med), 'par article', null],
                ['En route', fmtE0(somme(rte)), `${rte.length} article${rte.length>1?'s':''}`, null],
                ['Annulés', fmtE0(somme(ann)), `${ann.length} sur ${dans.length} · ${tauxAnn}\u00a0%`, tauxAnn>=20?C.warn:null],
              ].map(([k,v,sub,col])=>(
                <div key={k} className="vrm-achats-kpi" style={{borderColor:C.border}}>
                  <div className="vrm-achats-kpi-k" style={{color:C.muted}}>{k}</div>
                  <div className="vrm-achats-kpi-v" data-montant="" style={{color:col||C.text}}>{v}</div>
                  <div className="vrm-achats-kpi-s" style={{color:col||C.muted}}>{sub}</div>
                </div>
              ))}
            </div>
          );
        })()}
        {/* Compte des colis à retirer PAR TRANSPORTEUR, pour que Chronopost,
            Mondial Relay et Vinted Go aient chacun leur ligne sur l'onglet
            Achats — même quand ils n'ont rien (demande de Julien). */}
        {/* ⚠️ CE BANDEAU N'A DE SENS QUE LÀ OÙ LES CODES MANQUENT. Il s'affichait
            sur les quatre onglets — donc au-dessus de la liste des achats en
            route, où il ne dit rien d'utile. C'est une information de
            configuration (une boîte mail qui ne transfère pas), pas une alerte
            de tous les jours. */}
        {/* À RETIRER — liste simple façon appli de colis : groupée par point relais,
            avec LE CODE de retrait en gros (c'est ça qu'on donne au comptoir) et un
            « Y aller ». Source = emails transporteur (qui portent le code), et non
            plus le statut Vinted (qui n'a pas les codes). La carte est en option. */}
        {/* (23 oct.) LA FRAÎCHEUR DES ACHATS, UNE FOIS. Les achats d'un compte ne
            sont relus que quand Chrome est connecté dessus : mesuré le 23 oct.,
            jujuf38 relu il y a 9 j, julatace35260 il y a 6 j. Un colis arrivé
            depuis sur ces comptes n'est pas encore ici, et un « déposé en point
            relais » lu à l'époque a pu changer. On le dit, avec le geste. */}
        {/* (revue du 23 oct.) LES E-MAILS DE SUIVI N'ONT PAS PU ÊTRE LUS : on le
            dit UNE fois, avec le geste. Les colis vus par Vinted restent
            affichés ; ceux arrivés par e-mail (codes, lieux, dates limites) ne
            sont pas là — et le compte « À retirer » dit « — ». */}
        {aFilter==='attente' && trackingKO && (
          <div data-suivis-ko={tracking===null?'jamais':'ancienne'} style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',fontSize:12,color:C.text,border:`1px solid ${C.warn}`,background:`${C.warn}0e`,borderRadius:12,padding:'8px 12px',marginBottom:10,lineHeight:1.45}}>
            <span style={{flex:'1 1 220px'}}>{tracking===null
              ? <>Les e-mails de suivi n'ont pas pu être lus : leurs colis (codes, lieux) manquent ici. Rien n'est perdu.</>
              : <>Dernière lecture des e-mails de suivi ratée : tu vois la lecture d'avant.</>}</span>
            <Bouton variante="secondaire" icone="sync" data-suivis-reessayer="" onClick={()=>{ lireSuivis({ force:true }); try { window.dispatchEvent(new Event('vrm:suivis-relire')); } catch (_) {} }} style={{flexShrink:0,minHeight:44}}>Réessayer</Bouton>
          </div>
        )}
        {/* (24 oct.) Ce que le statut chez les transporteurs ne peut pas dire ici,
            UNE fois en tête de liste (§7) : la lecture ratée, Mondial Relay sans
            l'extension à jour, un transporteur que VRM ne lit pas. */}
        {aFilter==='attente' && (()=>{
          const deAchat = (o) => { const su = suivisAchat(o, indexSuivisAchats)[0]; const e = entreeSuiviAchat(o); return su ? { suivi: su, carrier: (e && e.transporteur) || transporteurDeForme(su) || '' } : null; };
          const colis = [...pickupUnion.emailList.map(t => ({ suivi: suiviDeLigne(t), carrier: t.carrier })),
            ...pickupUnion.extra.map(deAchat).filter(Boolean),
            ...pickupUnion.aVerifier.map(x => x.kind === 'email' ? { suivi: suiviDeLigne(x.t), carrier: x.t.carrier } : deAchat(x.o)).filter(Boolean)].filter(x => x.suivi);
          return <TeteTransporteurs transp={transp} colis={colis} relire={lireTransp}/>;
        })()}
        {aFilter==='route' && (()=>{
          const colis = achatsAffiches.filter(({st}) => st && st.step>=1 && st.step<4 && !st.retour).map(({o,tk}) => { const su = (tk && tk.suivi) || suivisAchat(o, indexSuivisAchats)[0]; const e = entreeSuiviAchat(o); return su ? { suivi: su, carrier: (tk && tk.carrier) || (e && e.transporteur) || transporteurDeForme(su) || '' } : null; }).filter(Boolean);
          return <TeteTransporteurs transp={transp} colis={colis} relire={lireTransp}/>;
        })()}
        {/* (10 nov.) « Votre colis a changé de plan » : POINT RELAIS CHANGÉ, en ambre, avec le
            nouveau point LU dans l'e-mail et son itinéraire (src/AlerteRelaisChange.jsx). */}
        {(aFilter==='attente' || aFilter==='route') && <AlerteRelaisChange lignes={tracking} C={C} transp={transpMap}/>}
        {/* (9 nov., lot AG) « Achats relus il y a N j sur compte_a — ouvre Vinted sur ce compte » n'est plus dit ici :
            des achats pas relus depuis plus de FRAICHEUR_ACHATS_J jours sont NOMMÉS, avec le geste, par la ligne de
            fraîcheur unique du haut de l'app (src/fraicheur.js, le même seuil) — une voix, pas deux (§7). */}
        {/* (1er nov.) Dans Colis, la colonne « À retirer » (`ColonneRetirer`) porte les
            points relais et leur carte : le détail ne la redessine pas (une carte, §7). */}
        {aFilter==='attente' && !modeRetraits && <CarteRelaisColis donnees={groupesRelais} C={C}/>}
        {/* (31 oct., soir) « Colis à retirer » sans rien à aller chercher le DIT —
            seulement quand tout est lu (e-mails de suivi, achats) : pas su ≠ rien. */}
        {modeRetraits && !retraitsOutils && !baseKO && tracking!==null && !trackingKO && Array.isArray(buys.items) && !buys.error && pickupUnion.total===0
          && !(pickupUnion.aVerifier||[]).length && !(pickupUnion.aConfirmer||[]).length && !(aConfirmer.etat==='lu' && aConfirmer.liste.length) && (
          <div data-retraits-vide="" className="vrm-vide-dessin" style={{fontSize:13,color:C.muted,padding:'18px 0',lineHeight:1.5}}><Illustration nom="boite" taille={110}/><p>Aucun colis à aller chercher pour l'instant.</p></div>
        )}
        {(()=>{
          // (2 nov.) Sous Colis → « À retirer », chaque colis et son code sont dans la
          // liste par point relais (au-dessus) : ici, les outils seulement.
          if (retraitsOutils) return null;
          const avail = pickupUnion.emailList;   // colis avec CODE/lieu (email transporteur)
          const extra = pickupUnion.extra;       // colis « déposé » (statut Vinted) sans code encore
          // (la règle « un code de retrait est numérique » vit au niveau module :
          //  `codeRetrait`. Trois copies traînaient, c'est le doublon que §11 interdit.)
          if (!avail.length && !extra.length) return null;
          // ⚠️ UNE ÉTAPE = UN ÉCRAN. Les destinations sont le contenu de l'étape
          // « À retirer » : les afficher aussi au-dessus de « En route » ou de
          // « Reçus », c'était le même bloc répété sur trois onglets. La pastille
          // du haut porte le compte (« À retirer 4 ») : rien n'est caché, on sait
          // qu'il y a des colis à aller chercher même en regardant autre chose.
          if (aFilter !== 'attente') return null;
          // Photo de la paire par titre : les achats moissonnés portent la vraie
          // photo Vinted → on la montre à côté du code de retrait (savoir quelle
          // paire on va chercher / si on l'a déjà retirée).
          const photoColis=t=>{const achat=achatDuColis(t,buysBase,indexSuivisAchats);if(!achat)return t.photo||null;return orderPhoto(achat)||indexSuivisAchats[String(achat.transaction_id)]?.photo||null;};
          // ⚠️ MÊME RÈGLE QUE LE QR : une photo morte ne laisse pas un carré cassé.
          // Les photos viennent du CDN Vinted et leurs liens expirent ; l'icône
          // « image brisée » du navigateur au milieu d'une carte de colis, c'est
          // ce qui fait « pas fini » (vu en capture sur « Salomon sneakers »).
          const thumb = (src) => src && !imgMortes.has(src)
            ? <PhotoVinted src={src} alt="" loading="lazy" onError={()=>noterImgMorte(src)}
                className="vrm-pickup-thumb" style={{width:48,height:48,borderRadius:12,objectFit:'cover',flexShrink:0}}/>
            : <span className="vrm-pickup-thumb" style={{flexShrink:0,color:C.muted,background:C.card2||C.bg,width:48,height:48,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="bag" size={20}/></span>;
          // (17 oct.) UNE CARTE « COLIS VU PAR VINTED », UNE FORME : rendue dans le bloc
          // du lieu quand un email nomme le même endroit (un endroit = un bloc,
          // plus « Consigne Vinted Go » ici et « Kusmi Tea » là pour la même consigne),
          // sinon dans son propre bloc plus bas.
          const carteColisVinted = (o, i, melange, memeCompte) => {
                    // Ce que la CONVERSATION Vinted dit de ce colis : l'adresse du
                    // relais et le code de retrait. Pour Vinted Go c'est la seule
                    // source — aucun email ne les porte (voir `colisRelais`).
                    const rel = relaisDe(o); const cd = rel ? codeRetrait(rel.code) : '';
                    // (11 nov., gestes-glisser) Glisser vers la gauche : « Retiré » (principale, la pilule « Annuler »
                    // 5 s de `gesteVrm`) et le lien du code — les MÊMES gestes que les boutons de la carte.
                    const hrefCode = (rel && (rel.qr || rel.url)) || lienConv(o);
                    return (
                    <LigneGlissable key={'x'+i} cle={String(o.transaction_id||'')} libelle={o.title||'colis'} actions={[
                      { cle: 'retire', libelle: 'Retiré', icone: <Icon name="check" size={18}/>, faire: ()=>markPickupDone(o), data: { 'data-lg-retire': String(o.transaction_id||'') } },
                      hrefCode ? { cle: 'code', libelle: 'Le code', icone: <Icon name="qr" size={18}/>, href: hrefCode, data: { 'data-lg-code': String(o.transaction_id||'') } } : null,
                    ]}>{(gp, tiroirG) => (
                    <div className="vrm-pickup-card" {...gp} style={{display:'flex',gap:11,alignItems:'center',flexWrap:'wrap',background:C.card,border:`1px solid ${cd?INV_STATUS.online.color+'55':C.border}`,borderRadius:12,padding:'10px 12px'}}>
                      {thumb(orderPhoto(o)||(rel&&rel.photo))}
                      <div style={{flex:'1 1 150px',minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.title||'Colis'}</div>
                        {/* (29 oct.) L'arrivée et la LIMITE lues chez le transporteur (son
                            n° de suivi, une identité) : la même ligne qu'un colis d'e-mail. */}
                        {(()=>{ const ev = etatColisVinted(o, Date.now(), transpMap); const jl = ev.limite ? joursAvant(ev.limite) : null;
                          return <>
                            <LigneArrivee arr={ev.arr}/>
                            {jl!=null && <div data-colis-limite={String(ev.limite).slice(0,10)} data-colis-limite-transp="" style={{fontSize:11,fontWeight:jl<=1?700:600,color:jl<=1?C.warn:C.text,marginTop:1,lineHeight:1.3}}>{texteLimiteRetrait(jl, ev.limite, ev.limiteAt)}</div>}
                            {jl==null && ev.limiteVers && <div data-colis-limite="vers" data-colis-limite-vers={String(ev.limiteVers)} style={{fontSize:11,color:C.text,marginTop:1}}>À retirer vers le {new Date(String(ev.limiteVers).slice(0,10)+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} (estimé : le transporteur ne donne pas la date)</div>}
                          </>; })()}
                        {/* (23 oct.) La dernière nouvelle de Vinted pour CETTE transaction. */}
                        <LigneNouvelleVinted nv={nouvelleDe(o)} transp={transpMap} suivi={suivisAchat(o, indexSuivisAchats)[0] || ''}/>
                        {/* (24 oct.) Ce que dit le transporteur, par le n° de suivi de CET achat. */}
                        {(()=>{ const e=entreeSuiviAchat(o); const su=suivisAchat(o, indexSuivisAchats)[0]; return su ? <LigneTransporteur transp={transpMap} suivi={su} carrier={(e&&e.transporteur)||transporteurDeForme(su)||''} court limiteCarte={(()=>{ const ev2 = etatColisVinted(o, Date.now(), transpMap); return (ev2 && (ev2.limite || ev2.limiteVers)) || ''; })()}/> : null; })()}
                        {/* (23 oct.) « DÉPOSÉ EN POINT RELAIS » EST CE QUE VINTED DISAIT
                            À LA DERNIÈRE LECTURE de ce compte, pas forcément aujourd'hui :
                            au-delà d'un jour, on dit depuis quand (le compte n'est relu
                            que quand Chrome est connecté dessus). */}
                        {/* (revue du 23 oct.) Seulement si la ligne de fraîcheur du haut
                            ne nomme pas déjà ce compte (≥ FRAICHEUR_ACHATS_J jours). */}
                        {(()=>{ const e = etatColisVinted(o); const cap = e.capMs; if (!cap) return null; const j = Math.floor((Date.now()-cap)/86400000); if (j < 1 || j >= FRAICHEUR_ACHATS_J) return null;
                          return <div data-capture-age={j} style={{fontSize:11,color:C.muted,marginTop:1}}>État lu par Vinted il y a {j} j — il a pu changer depuis</div>; })()}
                        {/* ⚠️ « Il manque des infos utiles » (Julien). Le prix et
                            la date SONT portés par la commande Vinted (§5 retrait :
                            transaction_id, date, titre, prix, statut) — la MÊME
                            source et le MÊME format que le bloc « repartis chez
                            leurs vendeurs » plus bas (§11 : montantCommande + o.date).
                            Chacun ne s'affiche que s'il est connu — jamais un 0
                            inventé (§5/§7). */}
                        <details className="vrm-pickup-details"><summary>Détails de l’achat</summary>{(()=>{ const m=montantCommande(o); const dt=o.date?new Date(o.date):null;
                          const jour = dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString('fr-FR') : '';
                          const bits=[]; if(m>0) bits.push(m.toFixed(2).replace('.',',')+'\u00a0€'); if(jour) bits.push('commandé le '+jour);
                          return bits.length ? <div style={{fontSize:11,color:C.muted,marginTop:1}}>{bits.join(' · ')}</div> : null;
                        })()}</details>
                        {/* L'adresse est déjà en tête du bloc : ici on ne met que
                            ce qui est propre à CE colis. */}
                        {/* ⚠️ Seulement quand le groupe est MIXTE : là, la ligne
                            distingue vraiment ce colis de ses voisins. Si AUCUN
                            n'a de code, l'en-tête du bloc l'a déjà dit. */}
                        {!cd && melange && !(rel && rel.lieu) && <div style={{fontSize:11,color:C.muted,marginTop:1}}>Code de retrait pas encore reçu</div>}
                        {/* ⚠️ LE COMPTE, PARCE QU'IL EN A NEUF. Mesuré le
                            7 septembre : ses cinq colis à retirer sont TOUS sur
                            `julatace3535`, dont la dernière capture datait de
                            4 jours — et leurs cinq conversations n'avaient
                            JAMAIS été captées. `capterRetraits` (extension,
                            depuis le 27 août) va pourtant les chercher TOUT
                            SEUL — mais seulement pour le compte connecté dans
                            l'onglet : encore faut-il savoir lequel. C'est tout
                            ce qui manquait. */}
                        {o && o._acc && !memeCompte && (
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                            compte <b style={{color:C.text,fontWeight:600}}>{accName(o._acc)}</b>
                          </div>
                        )}
                        {!cd && !(rel && rel.qr) && rel && rel.lieu && <div data-colis-sans-code-conv="" style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.35}}>Code par l’e-mail du transporteur <Pourquoi label="Où est le code">La conversation Vinted ne donne pas de code pour ce colis : il arrive par l’e-mail du transporteur (« Votre colis … est disponible ») sur l’adresse de ce compte. Si cette boîte fait suivre ses e-mails à VRM, il s’affichera ici.</Pourquoi></div>}
                        {/* ⚠️ LE QR VIT DANS LA CONVERSATION, on n'en fabrique pas
                            (§17). Si le message porte le lien direct du code, on
                            l'ouvre ; sinon on ouvre le fil, où il est affiché. */}
                        {/* ⚠️ UNE LIGNE QUI DIT « en attente de leur code » SANS
                            RIEN À TOUCHER NE SERT À RIEN. Le lien de la
                            conversation existe toujours (`conversation_id` de la
                            commande) : même sans l'extension, il est à un tap du
                            code et du QR, à l'endroit exact où Vinted les met. */}
                        {(()=>{
                          const href = (rel && (rel.qr || rel.url)) || lienConv(o);
                          if (!href) return null;
                          // ⚠️ POUR UN NOVICE, LE GESTE DOIT DIRE CE QU'IL RAPPORTE
                          //    (Julien, 25 sept. : « quel code de retrait par
                          //    colis »). « Ouvrir la conversation » ne dit pas qu'on
                          //    y trouve LE CODE. Quand le code n'est pas encore
                          //    affiché ici, le bouton dit « Voir mon code de retrait »
                          //    et ressemble à un bouton (bordé, accent) : c'est LA
                          //    chose à toucher. Quand le code est déjà en gros à
                          //    côté (`cd`), le lien reste discret (rien de neuf à
                          //    aller chercher).
                          const qr = !!(rel && rel.qr);
                          const primaire = !cd;   // pas de code visible → c'est l'action principale
                          // (17 oct.) La conversation a été LUE (le lieu en vient) et ne
                          // porte aucun code : promettre « Voir mon code de retrait »
                          // enverrait chercher un code qui n'y est pas (mesuré : 3 colis
                          // Mondial Relay, lieu lu, code vide). Le bouton dit ce qu'il ouvre.
                          const luSansCode = !cd && !qr && !!(rel && rel.lieu);
                          const quoi = qr ? 'Voir le QR de retrait ↗'
                            : (cd || luSansCode) ? 'Ouvrir la conversation ↗'
                            : 'Voir mon code de retrait ↗';
                          return primaire ? (
                            <Bouton variante="secondaire" className="vrm-pickup-cta" href={href} target="_blank" rel="noreferrer" style={{marginTop:8}}>{quoi}</Bouton>
                          ) : (
                            <Bouton variante="discret" className="vrm-pickup-lien" href={href} target="_blank" rel="noreferrer">{quoi}</Bouton>
                          );
                        })()}
                      </div>
                      {cd&&(
                        <CodeRetraitCopiable label="Code de retrait" code={cd}/>
                      )}
                      {(()=>{ const e=entreeSuiviAchat(o); const su=suivisAchat(o, indexSuivisAchats)[0]; return su ? <BoutonSuivreColis transporteur={(e&&e.transporteur)||transporteurDeForme(su)||''} suivi={su} codePostal={codePostalLu({lieu: rel && rel.lieu})} enLigne court/> : null; })()}
                      <button className="vrm-pickup-collect" type="button" onClick={()=>markPickupDone(o)} title="J'ai retiré ce colis" aria-label="J’ai retiré ce colis" data-pickup-sans-code={cd?undefined:''} style={{flexShrink:0,marginLeft:cd?undefined:'auto',whiteSpace:'nowrap'}}><span aria-hidden="true">✓</span><span className="vrm-pickup-collect-label"> J’ai retiré</span></button>
                      {tiroirG}
                    </div>
                    )}</LigneGlissable>
                    );
          };
          // ⚠️ ON NE DEVINE PLUS LE LIEU (Julien, 23 sept. : « ne prends plus en
          // compte la localisation, seulement les informations du mail »).
          // Avant, un email sans adresse de relais héritait du relais le plus
          // FRÉQUENT du transporteur (ex. Mondial Relay → « Maison de la Presse »).
          // C'était un rapprochement par ressemblance (§5) : ça l'envoyait à un
          // point qui n'était PAS celui du colis — Maison de la Presse a arrêté
          // Vinted, une consigne Pick-up n'a rien à voir avec son relais habituel.
          // Quand l'email ne nomme pas le lieu, on l'ÉCRIT (« lieu non indiqué »)
          // et on s'appuie sur le CODE / le QR, qui, eux, sont dans le mail —
          // jamais sur un lieu inventé. Mieux vaut un blanc qu'un faux.
          // ⚠️ COMPLÉTER L'ADRESSE DEPUIS LA LISTE OFFICIELLE DE VINTED.
          // L'email donne souvent le NOM du relais sans son adresse ni ses
          // horaires (mesuré : 13 lieux renseignés sur 94 suivis). Or la liste
          // des points captée par l'extension porte, elle, `drop_off_point_address`
          // et l'ouverture du jour. On rapproche **par NOM EXACT normalisé**
          // seulement — jamais par ressemblance (§24) : envoyer Julien au mauvais
          // comptoir serait pire que de ne rien afficher. Ce n'est donc PAS une
          // déduction : c'est la même enseigne, dans la liste de Vinted.
          // (23 oct.) Sans espaces ni ponctuation : l'e-mail écrit « TABA'VAP », la
          // conversation « TABAVAP » — le même nom, à la ponctuation près (mesuré).
          const normNom = (s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
          const pointsConnus = {};
          ((dropOffs&&dropOffs.carriers)||[]).forEach(c=>c.points.forEach(p=>{ const k=normNom(p.nom); if(k&&!pointsConnus[k]) pointsConnus[k]=p; }));
          const groups = {};
          avail.forEach(t=>{ const cl=cleanLieu(t.lieu); const lieuInconnu=!cl.nom; const nom = nomPointRetrait(cl) || (t.consigne ? `Consigne Pick-up ${carrierName(t.carrier)}` : `${carrierName(t.carrier)} — lieu non indiqué dans l'e-mail`); const pc = lieuInconnu ? null : (pointsConnus[normNom(cl.nom)]||null); (groups[nom]=groups[nom]||{colis:[],carrier:t.carrier,adresse:cl.adresse||(pc&&pc.adresse)||'',horaires:(pc&&pc.ouverture)||'',geoPt:pc||null,lieuInconnu}).colis.push(t); if(!groups[nom].carrier) groups[nom].carrier=t.carrier; });
          // (17 oct.) UN ENDROIT = UN BLOC, QUELLE QUE SOIT LA SOURCE. Plainte de Julien :
          // « des colis à Vinted Go et d'autres à Kusmi Tea (aussi Vinted Go) ». Mesuré :
          // l'email nommait le lieu « *Consigne Vinted Go*, * Kusmi Tea *… » (rangé sous
          // « Consigne Vinted Go », avec la consigne de Vannes Speed Queen dans le même
          // bloc) et la conversation « Kusmi Tea, 13 Rue Saint-Vincent… » (un second
          // bloc). `cleanLieu` rend maintenant le même NOM pour les deux, et un colis
          // vu par Vinted dont le lieu porte le nom d'un bloc email rejoint ce bloc.
          // Identité : le nom EXACT normalisé du lieu, jamais une ressemblance.
          const nomsEmail = new Set(Object.keys(groups).filter(n => !groups[n].lieuInconnu).map(normNom));
          const extraFusion = {}; const extraSeul = [];
          extra.forEach(o => { const rel = relaisDe(o); const k = normNom(nomPointRetrait(cleanLieu(rel && rel.lieu))); if (k && nomsEmail.has(k)) (extraFusion[k] = extraFusion[k] || []).push(o); else extraSeul.push(o); });
          return (
            <div className="vrm-pickup-board">
              <div className="vrm-pickup-head">
                <div style={{flex:1,minWidth:0}}>
                  {/* ⚠️ UN TOTAL QUI NE DIT PAS LE HORS-DÉLAI EST TROMPEUR : sur
                      les 4 colis affichés, 3 avaient leur date limite passée.
                      Ce n'est pas la même liste de travail — soit tu l'as déjà
                      récupéré sans cocher, soit il est reparti chez l'expéditeur
                      et il faut le réclamer. On le dit sur la même ligne. */}
                  {/* ⚠️ ET CE QUI N'EST PAS ENCORE RETIRABLE. « 13 colis à retirer »
                      au-dessus de 13 lignes qui disent toutes « code pas encore
                      reçu », c'est un total qui envoie au comptoir pour rien.
                      Le nombre NE BOUGE PAS (un colis caché est un colis perdu) :
                      c'est la phrase qui dit ce qu'on peut en faire — exactement
                      ce que §5.83 a fait pour la tuile de Ma journée. */}
                  {(()=>{ const hd = pickupUnion.aVerifier.length, sc = pickupUnion.sansCode;   // §11 : calculés UNE fois, dans pickupUnion
                    /* Revue du 16 octobre : « 2 colis à retirer » sous l'onglet « À
                       retirer 2 » redisait le même nombre. Sans rien d'autre à
                       ajouter (à vérifier, sans code), le titre ne se dessine plus —
                       il reste lu par un lecteur d'écran (§7, une fois).
                       (23 oct.) Les colis « à vérifier » ne sont PAS dans ce
                       nombre : ils ont leur bloc plus bas. */
                    // (31 oct., soir) Sur « Colis à retirer », plus d'onglet « À retirer N »
                    // au-dessus : ce titre porte le nombre, visible. E-mails de suivi pas lus ⇒
                    // un total PARTIEL, dit « au moins » (§5), et `data-pickup-total` vaut « — ».
                    const partiel = tracking===null;
                    // Dans Colis, la colonne « À retirer » porte déjà le nombre : le titre
                    // reste pour un lecteur d'écran quand il n'a rien d'autre à dire (§7).
                    return (<div className={'vrm-pickup-title'+(hd===0&&sc===0&&!partiel?' vrm-sr':'')} style={{color:C.text}} data-pickup-total={partiel?'—':pickupUnion.total} data-pickup-au-moins={partiel?String(pickupUnion.total):undefined} data-pickup-a-verifier={hd}>
                      {partiel?'Au moins ':''}{pickupUnion.total} colis à retirer
                      {hd>0 && <span style={{color:C.warn,fontWeight:700}}> · {hd} à vérifier plus bas</span>}
                      {sc>0 && <span style={{color:C.muted,fontWeight:600}}> · {sc} en attente de leur code</span>}
                    </div>); })()}
                  {/* (23 oct.) UN COMPTE INCONNU NE FAIT JAMAIS DISPARAÎTRE UN COLIS :
                      il est dit, UNE fois. Mesuré : le Mondial Relay du 21 octobre est
                      arrivé le 21 sur une adresse reliée à un compte le 22. */}
                  {/* ⚠️ Le GESTE (relier l'adresse) n'est proposé que si l'adresse de
                      réception est connue ET toujours reliée à aucun compte : une
                      ligne rangée avant le 23 oct. ne la porte pas (on ne sait pas
                      laquelle c'était — elle a pu être reliée depuis). */}
                  {(()=>{ const sans = avail.filter(t => !compteDuColisEmail(t) && t.source !== 'sms'); const n = sans.length;   /* (6 nov.) un SMS n'a pas d'adresse de réception : il le dit sur sa carte */
                    const adresseLibre = sans.some(t => Array.isArray(t.recuSur) && t.recuSur.length);
                    return n ? <div data-pickup-sans-compte={n} style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.4}}>{n>1?`${n} colis : compte non reconnu`:'1 colis : compte non reconnu'}{adresseLibre?' — Relie-la dans Paramètres → Comptes liés.':''} <Pourquoi label="Pourquoi">L'e-mail est arrivé sur une adresse qui n'était alors reliée à aucun de tes comptes Vinted (e-mail du compte, dans Paramètres → Comptes liés).</Pourquoi></div> : null; })()}
                  {/* ⚠️ « À chaque fois on doit voir le nombre de paires que l'on
                      reçoit » (Julien). On compte les colis dont on SAIT nommer
                      la paire — jamais un total gonflé : quand il en manque, ça
                      se voit, c'est justement l'information utile. */}

                  {/* ⚠️ POUR QUELQU'UN QUI NE CONNAÎT PAS VINTED (Julien, 25 sept. :
                      « une personne qui ne connaît pas du tout Vinted pourrait
                      savoir ce qu'elle doit faire »). Le geste, en 3 temps, écrit
                      une seule fois en haut — pas répété sur chaque fiche (§7).
                      Chaque fiche répond ensuite à OÙ · QUEL CODE · QUEL JOUR. */}
                  <details className="vrm-pickup-help"><summary>Comment retirer un colis ?</summary><div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>
                    {[['1','Va au point relais indiqué'],['2','Donne le code ou montre le QR'],['3','Coche ✓ « récupéré »']].map(([n,txt])=>(
                      <span key={n} style={{display:'inline-flex',alignItems:'center',gap:6,background:C.card,border:`1px solid ${C.border}`,borderRadius:999,padding:'4px 10px 4px 4px',fontSize:12,color:C.text,fontWeight:600}}>
                        <span style={{flexShrink:0,width:18,height:18,borderRadius:999,background:C.accent,color:'var(--vrm-on-accent)',fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{n}</span>
                        {txt}
                      </span>
                    ))}
                  </div></details>
                </div>
              </div>
              {/* ⚠️ UN ENDROIT DÉDIÉ PAR TRANSPORTEUR (demande de Julien). Chaque
                  transporteur a sa façon de remettre le colis (§28) : Chronopost
                  au QR, Mondial Relay au code. Les mélanger obligeait à relire le
                  logo de chaque ligne pour savoir quoi présenter. */}
              {(()=>{
                // ⚠️ L'ENDROIT D'ABORD (Julien : « sépare les différents endroits
                // pour bien savoir où je vais »). Avant, le niveau principal était
                // le TRANSPORTEUR, et le point relais en dessous : avec un seul
                // relais par transporteur, ça faisait un étage de titres pour rien
                // et l'adresse — la seule chose qui décide où on va — arrivait en
                // second. Maintenant : une destination = un bloc, et le GESTE à
                // faire là-bas est écrit dessus (§28 : chaque transporteur remet
                // le colis à sa façon).
                // Ordre : le point dont un colis expire le plus tôt d'abord — un
                // colis non retiré repart chez l'expéditeur, c'est ça l'urgence ;
                // à égalité, le point qui en porte le plus.
                // (23 oct.) Sans date limite, un bloc passait DERRIÈRE tous les
                // autres (urgence infinie) — le Mondial Relay du 21 octobre, seul dans
                // son bloc, toujours dernier. On trie sur la règle partagée
                // (`urgenceTri` : les jours qui restent, sinon ce qui reste de la
                // garde mesurée depuis l'arrivée). Ce chiffre n'est jamais affiché.
                const urgence = (g) => {
                  let min = Infinity;
                  for (const t of g.colis) { const u = urgenceTri(etatColisEmail(t)); if (u < min) min = u; }
                  return min;
                };
                const ordrePoints = Object.entries(groups).sort((a,b)=>{
                  const ua=urgence(a[1]), ub=urgence(b[1]);
                  if (ua !== ub) return ua - ub;
                  return b[1].colis.length - a[1].colis.length;
                });
                return ordrePoints.map(([nom,g])=>(
                <div className="vrm-pickup-point" key={nom} style={{marginBottom:14,border:`1px solid ${C.border}`,borderRadius:12,background:C.card,overflow:'hidden'}}>
                  {/* ── LA DESTINATION ────────────────────────────────────────
                      Le nom du lieu en premier (c'est là qu'on va), l'adresse
                      dessous, et LE GESTE à faire une fois sur place — chaque
                      transporteur remet le colis à sa façon (§28). */}
                  <div className="vrm-pickup-dest" style={{borderBottom:`1px solid ${C.border}`}}>
                    {g.carrier&&<CarrierBadge carrier={g.carrier} size={24}/>}
                    <div style={{flex:'1 1 140px',minWidth:0}}>
                      {/* ⚠️ « NE PRENDS PLUS EN COMPTE LA LOCALISATION, JUSTE LES
                          CODES » (Julien, 20 sept.). Plus d'adresse, d'horaires,
                          d'itinéraire ni de carte : le point relais exact est dans
                          l'e-mail du transporteur / son appli. Ce qui sert à retirer,
                          c'est le CODE / le QR juste en dessous. Le nom vient de
                          l'e-mail, jamais deviné (§5).
                          ⚠️ « OÙ EST-CE QUE JE DOIS ALLER » (Julien, 25 sept.) : on
                          préfixe « Va à : » quand le lieu est connu, pour qu'un
                          novice lise l'ADRESSE comme une destination, pas comme un
                          titre. Lieu inconnu → on ne ment pas, on renvoie à la
                          source (e-mail du transporteur). */}
                      <div className="vrm-pickup-location-label" style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.6}}>{g.lieuInconnu?'Point relais':'Va à'}</div>
                      <div style={{fontSize:15,fontWeight:700,color:C.text,whiteSpace:g.lieuInconnu?'normal':'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.25}}>{nom}</div>
                      {g.lieuInconnu && <div style={{fontSize:11,color:C.muted,marginTop:1}}>L'adresse exacte est dans l'e-mail du transporteur.</div>}
                    </div>
                  </div>
                  {(()=>{ const M=methodeDuPoint(g.colis);
                    const urg=(()=>{ let m=null; for(const t of g.colis){ const j=joursAvant(t.limite); if(j!=null&&(m==null||j<m)) m=j; } return m; })();
                    return (
                      <details className="vrm-pickup-method"><summary aria-label="Informations sur ce retrait" title="Informations sur ce retrait">i</summary><div style={{display:'flex',alignItems:'baseline',gap:6,flexWrap:'wrap',padding:'7px 12px',borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontSize:12,fontWeight:700,color:C.text,flexShrink:0}}>{g.colis.length} colis · {M.titre}</span>
                        <span style={{fontSize:12,color:C.muted,flex:'1 1 140px',minWidth:0}}>{M.geste}</span>
                        {/* ⚠️ LE RÉSUMÉ N'A SA PLACE QUE S'IL AJOUTE QUELQUE CHOSE
                            (§5.64). Quand les 3 colis du point sont tous hors
                            délai, le badge « délai dépassé » répétait mot pour
                            mot ce que chaque ligne dit juste en dessous — quatre
                            fois la même information dans un bloc de six lignes.
                            On ne l'affiche que si les colis N'ONT PAS le même
                            état : là seulement « le plus urgent » veut dire
                            quelque chose. Le tri des blocs, lui, s'appuie
                            toujours sur `urg` — il n'a pas besoin d'être écrit. */}
                        {urg!=null && (()=>{
                          const seau=(j)=> j==null?'?':(j<0?'x':(j===0?'0':(j===1?'1':'+')));
                          const etats=new Set(g.colis.map(t=>seau(joursAvant(t.limite))));
                          if (etats.size<2) return null;
                          return (
                            <span style={{fontSize:11,fontWeight:700,flexShrink:0,color:urg<0?C.danger:(urg<=2?C.accent:C.muted)}}>
                              au plus tôt : {urg<0?'délai dépassé':(urg===0?"dernier jour":(urg===1?'demain':`${urg} j`))}
                            </span>
                          );
                        })()}
                      </div></details>
                    ); })()}
                  <div style={{padding:'10px 12px 4px'}}>
                  {g.colis.map((t,i)=>{
                    const code=codeRetrait(t.code);
                    const ident=codeRetrait(t.code2);   // consigne Pickup : identifiant du casier
                    // ⚠️ AU CASIER IL FAUT LES DEUX NOMBRES. N'afficher que le code
                    //    d'ouverture ne permet PAS d'ouvrir la porte — défaut vu au
                    //    rendu réel, pas à la relecture. Et une consigne n'a pas de
                    //    comptoir : le geste n'est pas le même, le texte non plus.
                    const casier = !!t.consigne || !!ident;
                    const jours = joursAvant(t.limite);
                    // (11 nov., gestes-glisser) « Retiré » au glisser (le geste annulable `markCollected`) et
                    // « Le code » en grand quand la carte porte le bouton du QR (`openQrView`).
                    return (
                      <LigneGlissable key={i} cle={colisKey(t)} libelle={t.title||'colis'} actions={[
                        { cle: 'retire', libelle: 'Retiré', icone: <Icon name="check" size={18}/>, faire: ()=>markCollected(t), data: { 'data-lg-retire': colisKey(t) } },
                        qrVivant(t) ? { cle: 'code', libelle: 'Le code', icone: <Icon name="qr" size={18}/>, faire: ()=>openQrView(t), data: { 'data-lg-code': colisKey(t) } } : null,
                      ]}>{(gp, tiroirG) => (
                      <div className="vrm-pickup-card vrm-pickup-row" {...gp} style={{display:'flex',gap:11,alignItems:'center',flexWrap:'wrap',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',marginBottom:7}}>
                        {thumb(photoColis(t))}
                        <div style={{flex:'1 1 150px',minWidth:0}}>
                          {/* ⚠️ LE N° DE SUIVI ÉTAIT ÉCRIT DEUX FOIS — vu en capture, pas à la
                              relecture : « Colis n°08448878300059 » en titre, puis
                              « n° 08448878300059 » juste en dessous. Un email de
                              transporteur ne nomme pas l'article (mesuré : artTitle
                              vide sur 127 lignes sur 127), donc à défaut on écrit ce
                              qu'on SAIT — le transporteur — et le n° reste sur sa
                              ligne, une seule fois. */}
                          <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.artTitle||carrierName(t.carrier)}</div>
                          <LigneArrivee arr={arriveeColisEmail(t)}/>
                          {/* (23 oct.) LE N° DE SUIVI SUR LA LIGNE, PLUS DANS UN REPLI :
                              c'est le seul numéro qu'il a dans l'e-mail et dans la
                              notification (« Mondial Relay — n°… »). Il le
                              cherchait dans l'app sans le trouver. Le compte à côté
                              quand il est connu. */}
                          {(t.suivi || compteDuColisEmail(t)) && (
                            <div data-colis-suivi={t.suivi||''} data-colis-compte={compteDuColisEmail(t)||''} style={{fontSize:12,color:C.muted,marginTop:1,overflowWrap:'anywhere'}}>
                              {t.suivi && <span style={{fontFamily:'ui-monospace,monospace',letterSpacing:.4,color:C.text}}>n° {t.suivi}</span>}
                              {compteDuColisEmail(t) && <>{t.suivi?' · ':''}compte <b style={{color:C.text,fontWeight:600}}>{compteDuColisEmail(t)}</b></>}
                            </div>
                          )}
                          {/* ⚠️ NI LE LIEU NI LE GESTE ICI : ils sont écrits une
                              fois, en tête de la destination. Les répéter sur
                              chaque ligne, c'était trois fois la même phrase sur
                              un écran de téléphone. Ne reste que ce qui est propre
                              à CE colis. */}
                          {/* (revue du 23 oct.) Un colis d'e-mail sans code lu : le code
                              EST dans l'e-mail du transporteur (« disponible »), c'est
                              VRM qui n'a pas su le lire — pas « pas encore reçu ». */}
                          {!code && !qrImage(t) && (t.viaTransporteur
                            // (24 oct.) « Disponible » LU CHEZ LE TRANSPORTEUR (aucun e-mail ne
                            // l'a encore dit) : VRM ne lit que le statut, jamais le code.
                            ? <div data-colis-code-pas-lu="transporteur" style={{fontSize:11,color:C.muted,marginTop:1}}>Code : dans l'e-mail du transporteur ou la conversation Vinted.</div>
                            : <div data-colis-code-pas-lu="" style={{fontSize:11,color:C.muted,marginTop:1}}>Code pas lu — ouvre l'e-mail du transporteur{t.suivi?' (ou le suivi du colis)':''}</div>)}
                          {/* Le n° de suivi sur SA ligne, en chiffres lisibles :
                              au comptoir c'est ce qu'on demande quand le scan
                              ou le code ne passe pas. */}
                          {/* n° de suivi + JOUR D'ARRIVÉE (demande de Julien) : savoir
                              depuis quand le colis attend, c'est ce qui dit s'il faut y
                              aller aujourd'hui. La date vient de l'email lui-même — et
                              un email rejoué garde SA date d'origine (api/email-rattacher). */}
                          {/* (21 oct.) La date d'arrivée est sortie de ce repli (ligne
                              visible au-dessus) : `receivedAt` était la date du DERNIER
                              email, souvent un rappel. */}
                          {/* DATE LIMITE : passé cette date le colis repart chez
                              l'expéditeur. Captée dans l'email, jamais déduite.
                              (23 oct.) Sans elle on le DIT : « date limite
                              inconnue » — jamais une date inventée. ⚠️ Pas « non
                              indiquée dans l'e-mail » : mesuré, l'e-mail du Mondial
                              Relay du 21 octobre la portait (« RETRAIT JUSQU'AU 26/10 »),
                              c'est la route qui ne savait pas la lire. */}
                          {jours==null && t.limiteVers && <div data-colis-limite="vers" data-colis-limite-vers={String(t.limiteVers)} style={{fontSize:11,color:C.text,marginTop:1}}>À retirer vers le {new Date(String(t.limiteVers).slice(0,10)+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} (estimé : le transporteur ne donne pas la date)</div>}
                          {jours==null && !t.limiteVers && <div data-colis-limite="inconnue" style={{fontSize:11,color:C.muted,marginTop:1}} title="Un point relais garde un colis 4 à 7 jours">Date limite inconnue (4 à 7 j en général)</div>}
                          {jours!=null && (
                            /* ⚠️ CETTE LIGNE-LÀ NE SE COUPE PAS. Elle était en
                               `nowrap + ellipsis` comme ses voisines : à 430 px
                               elle s'affichait « délai dépassé depuis 3 j
                               (29/08/2026) — va … », donc la consigne la plus
                               urgente de l'écran était la seule tronquée. Un
                               n° de suivi peut se couper, une date limite non. */
                            <div data-colis-limite={String(t.limite||'').slice(0,10)} style={{fontSize:11,fontWeight:jours<=1?700:600,color:jours<=1?C.warn:C.text,marginTop:1,lineHeight:1.3}}>
                              {/* ⚠️ « délai dépassé » tout court se lit comme une
                                  contradiction quand la ligne du dessus dit
                                  « arrivé il y a 6 j ». On donne LA date et de
                                  COMBIEN c'est dépassé : c'est ce qui décide si
                                  on court au relais ou si on réclame. */}
                              {/* (23 oct.) « jusqu'au » : c'est le mot du transporteur, le jour est compris. */}
                              {/* (29 oct.) + l'HEURE quand le transporteur la donne (« Dernier jour — avant 11 h 34 »). */}
                              {texteLimiteRetrait(jours, t.limite, t.limiteAt)}
                            </div>
                          )}
                          {/* (23 oct.) La dernière nouvelle de Vinted, par la commande reliée
                              par identité (n° de suivi ou code de retrait) — jamais le titre. */}
                          <LigneNouvelleVinted nv={nouvelleDe(pickupUnion.cmdParColis && pickupUnion.cmdParColis.get(colisKey(t)))} transp={transpMap} suivi={suiviDeLigne(t)}/>
                          {/* (24 oct.) Ce que dit le transporteur sur son site, par le n°. */}
                          <LigneTransporteur transp={transpMap} suivi={suiviDeLigne(t)} carrier={t.carrier} court limiteCarte={t.limite || t.limiteVers || ''}/>
                          {/* (23 oct.) Le suivi du transporteur, sur CHAQUE colis qui a un n°. */}
                          <BoutonSuivreColis transporteur={t.carrier} suivi={t.suivi} codePostal={codePostalLu(t)} attrs={{'data-colis-suivre':''}}/>
                        </div>
                        {/* ⚠️⚠️ LE QR MANQUAIT SUR CETTE CARTE — c'est CELLE-CI que
                            l'écran Achats utilise (groupée par point relais), pas
                            celle de Ma journée. Chronopost/Pickup se retire en
                            SCANNANT le Pickup Pass : sans lui, les nombres ne
                            servent qu'au casier, et en relais il n'y avait
                            littéralement rien à présenter au comptoir.
                            Il passe EN PREMIER : c'est le geste principal. */}
                        {/* ⚠️ SI L'IMAGE NE CHARGE PAS, ON NE LAISSE PAS UN CARRÉ CASSÉ.
                            Le repli existait UNIQUEMENT dans la modale plein écran
                            (§17) — sur la carte, une image morte restait une image
                            morte, et au comptoir il n'y avait rien à présenter.
                            Les 3 vrais QR de Julien répondent bien (PNG, 645-873 o),
                            mais un lien de transporteur expire, et c'est justement
                            au comptoir qu'on ne peut pas se le permettre.
                            `onError` efface la vignette : le code prend sa place. */}
                        {qrVivant(t) && (
                          <button className="vrm-icon-control" type="button" onClick={()=>openQrView(t)} title="QR de retrait — afficher en grand pour scanner" aria-label="Afficher le QR de retrait en grand"
                            style={{flexShrink:0,border:`1.5px solid ${C.accent}`,background:'#fff',borderRadius:12,padding:3,cursor:'pointer',width:64,height:64,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                            <img src={qrVivant(t)} alt="QR de retrait" onError={()=>noterImgMorte(qrImage(t))}
                              style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                          </button>
                        )}
                        {/* ⚠️ NI QR NI CODE : on affiche le NUMÉRO DE COLIS en gros,
                            honnêtement (§17). Sans ça, un colis dont le seul moyen
                            de retrait était un QR mort ne laissait RIEN à présenter
                            au comptoir — vu en capture sur 09447431562792. */}
                        {(code||ident) && (
                          <div className="vrm-pickup-codes" style={{flexShrink:0,display:'flex',gap:6}}>
                            {ident && (
                              <CodeRetraitCopiable label="Identifiant" code={ident}/>
                            )}
                            {code && (
                              <CodeRetraitCopiable label={ident?"Code d’ouverture":"Code de retrait"} code={code}/>
                            )}
                          </div>
                        )}
                        <button className="vrm-pickup-collect" type="button" onClick={()=>markCollected(t)} title="J'ai retiré ce colis" aria-label="J’ai retiré ce colis" style={{flexShrink:0,whiteSpace:'nowrap'}}><span aria-hidden="true">✓</span><span className="vrm-pickup-collect-label"> J’ai retiré</span></button>
                        {tiroirG}
                      </div>
                      )}</LigneGlissable>
                    );
                  })}
                  {(extraFusion[normNom(nom)]||[]).map((o,i)=>carteColisVinted(o,'f'+i,true,null))}
                  </div>
                </div>
                )); })()}
              {/* Colis vus « déposés » par Vinted mais dont le CODE n'est pas
                  encore arrivé par email → on les montre quand même (sinon le
                  compteur dirait 2 et la liste n'en montrerait qu'1). */}
              {extraSeul.length>0 && (()=>{
                // ⚠️ MÊME RÈGLE QUE CI-DESSUS : une destination = un bloc. Depuis
                // que la conversation nous donne l'adresse (Vinted Go, §5.72), ces
                // colis ont un ENDROIT eux aussi — les laisser en vrac dans une
                // liste « quelque part en point relais » obligerait à les relire un
                // par un pour savoir où aller. Les colis dont on ne connaît pas
                // encore le lieu restent groupés à part, et on le dit.
                const pts = {};
                // Le nom vient de `cleanLieu` (§11, la même règle que les blocs email) :
                // « point relais TABAVAP, TABAVAP, 29 RUE HOCHE » → « Tabavap ».
                extraSeul.forEach(o => {
                  const rel = relaisDe(o);
                  const cl = cleanLieu(rel && rel.lieu);
                  const k = normNom(cl.nom) || '__inconnu';
                  (pts[k] = pts[k] || { nom: cl.nom, adresse: cl.adresse || '', colis: [] }).colis.push(o);
                });
                const ordre = Object.entries(pts).sort((a,b)=>{
                  if ((a[0]==='__inconnu') !== (b[0]==='__inconnu')) return a[0]==='__inconnu' ? 1 : -1;
                  return b[1].colis.length - a[1].colis.length;
                });
                return ordre.map(([k,pt]) => {
                  // ⚠️ CALCULÉ UNE FOIS POUR LE GROUPE (§11) : l'en-tête ci-dessous
                  // dit déjà « le code arrive dans la conversation ». Le répéter
                  // sur chaque ligne donnait TREIZE fois la même phrase sous
                  // treize titres différents — vu en capture.
                  const aCode = (o) => { const r = relaisDe(o); return !!(r && codeRetrait(r.code)); };
                  const avecCode = pt.colis.some(aCode);
                  const melange  = avecCode && pt.colis.some(o => !aCode(o));
                  // ⚠️ LE COMPTE AUSSI EST UNE PHRASE DE GROUPE QUAND IL EST LE
                  //    MÊME. Vu en capture le 8 septembre : « compte
                  //    julatace3535 » écrit CINQ fois, sous cinq titres
                  //    différents, alors que les cinq colis sont sur ce
                  //    compte-là. C'est §7 mot pour mot — la ligne ne reprend la
                  //    phrase du groupe que si le groupe est MIXTE, là seulement
                  //    elle distingue. Il en a neuf, donc on le NOMME toujours :
                  //    une fois en tête si c'est le même, sur chaque ligne sinon.
                  const comptesGr = [...new Set(pt.colis.map(o => (o && o._acc) ? accName(o._acc) : '').filter(Boolean))];
                  const memeCompte = comptesGr.length === 1 ? comptesGr[0] : null;
                  // (16 oct.) LE TRANSPORTEUR DU GROUPE : celui que la conversation
                  // NOMME (extension ≥ 5.179), et seulement s'il est le même pour
                  // tous les colis du lieu. Avant : un badge « Vinted Go » écrit en
                  // dur sur un relais Mondial Relay. Inconnu ⇒ aucun badge.
                  const transpGr = [...new Set(pt.colis.map(o => { const r = relaisDe(o); return (r && r.transporteur) || ''; }))];
                  const transpUn = transpGr.length === 1 && transpGr[0] && CARRIERS[transpGr[0]] ? transpGr[0] : '';
                  const adresseSuite = pt.adresse || '';
                  return (
                <div className="vrm-pickup-point" key={'xg'+k} style={{marginBottom:14,border:`1px solid ${C.border}`,borderRadius:12,background:C.card,overflow:'hidden'}}>
                  <div className="vrm-pickup-dest" style={{borderBottom:`1px solid ${C.border}`}}>
                    {transpUn ? <CarrierBadge carrier={transpUn} size={24}/> : <span aria-hidden="true" style={{display:'inline-flex',width:24,height:24,alignItems:'center',justifyContent:'center',color:C.muted}}><Icon name="box" size={18}/></span>}
                    <div style={{flex:'1 1 140px',minWidth:0}}>
                      {/* Nom du relais quand la conversation Vinted le donne (une
                          identité, §5) ; sinon un libellé neutre. Plus d'adresse
                          ni d'itinéraire : juste le code de retrait, en dessous.
                          ⚠️ « OÙ EST-CE QUE JE DOIS ALLER » (25 sept.) : lieu connu →
                          « Va à : … » ; lieu inconnu → on le DIT en clair (le lieu
                          ET le code sont dans la conversation Vinted), jamais un
                          libellé vague qu'un novice ne comprend pas. */}
                      <div className="vrm-pickup-location-label" style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.6}}>{pt.nom?'Va à':'Point relais'}</div>
                      <div data-relais-nom="" style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.25,overflowWrap:'anywhere'}}>{pt.nom || 'À voir dans ta conversation Vinted'}</div>
                      {adresseSuite && <div data-relais-adresse="" style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.35,overflowWrap:'anywhere'}}>{adresseSuite}</div>}
                      {(transpUn || memeCompte) && <div data-relais-transporteur={transpUn||''} style={{fontSize:11,color:C.muted,marginTop:2}}>{[transpUn ? CARRIERS[transpUn].name : '', memeCompte].filter(Boolean).join(' · ')}</div>}
                      {!pt.nom && <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:1}}>Le lieu exact et le code sont écrits dans la conversation du colis.</div>}
                    </div>
                  </div>
                  <details className="vrm-pickup-method"><summary aria-label="Informations sur ce retrait" title="Informations sur ce retrait">i</summary><div style={{display:'flex',alignItems:'baseline',gap:6,flexWrap:'wrap',padding:'7px 12px',borderBottom:`1px solid ${C.border}`}}>
                    {/* ⚠️ LE MÊME NOMBRE NE S'ÉCRIT PAS DEUX FOIS SUR UN ÉCRAN.
                        « 12 colis à retirer » en tête, puis « 12 colis · Au
                        comptoir » trois lignes dessous : le second ne distingue
                        rien tant qu'il n'y a qu'un point relais. Dès qu'il y en a
                        deux, il redevient l'information utile — combien dans
                        CELUI-là — donc il revient tout seul. */}
                    <span style={{fontSize:12,fontWeight:700,color:C.text,flexShrink:0}}>
                      {(ordre.length > 1 || pt.colis.length !== pickupUnion.total)
                        ? `${pt.colis.length} colis · Au comptoir` : 'Au comptoir'}
                    </span>
                    <span style={{fontSize:12,color:C.muted,flex:'1 1 140px',minWidth:0}}>
                      {avecCode
                        ? 'Donne le code de retrait, ou scanne le QR depuis la conversation Vinted'
                        : (()=>{ const e = extSaitLireCodes();
                            if (e === 'retard') return "Extension en retard : elle ne lit pas encore les codes. Mets-la à jour (Paramètres → État des connexions) ; en attendant, ouvre la conversation, le code y est.";
                            if (e === 'absente') return "Ouvre la conversation Vinted du colis : le code et le QR y sont.";
                            // ⚠️ Le chemin SÛR en premier : le code est dans la
                            //    conversation (bouton sous chaque colis), et il y
                            //    est tout de suite. L'extension la lit aussi toute
                            //    seule, mais pour les casiers Vinted Go il faut une
                            //    version récente — ne pas en faire la promesse
                            //    principale, sinon « j'ai attendu et rien n'est venu ».
                            return `Le code et le QR sont dans la conversation Vinted (bouton sous le colis). L'extension la lit aussi toute seule quand tu passes sur Vinted connecté ${memeCompte ? `sur ${memeCompte}` : 'avec le compte indiqué sur chaque ligne'}.`; })()}
                      {memeCompte && !avecCode && extSaitLireCodes() !== 'ok' && <> Ils sont tous sur <b style={{color:C.text,fontWeight:600}}>{memeCompte}</b>.</>}
                    </span>
                  </div></details>
                  {/* ⚠️ DEUX COLONNES SUR ORDINATEUR, comme Colis et Ventes.
                      Une ligne de colis tient sur UNE ligne de texte et s'étirait
                      sur 1 080 px : le bouton « ✓ retiré » se retrouvait à un
                      mètre du titre qu'il concerne, et douze colis remplissaient
                      deux écrans. Le `min()` évite qu'une piste de 430 px déborde
                      un téléphone. */}
                  <div style={{padding:'10px 12px 4px',display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(430px,100%), 1fr))',gap:7,alignItems:'start'}}>
                  {pt.colis.map((o,i)=>carteColisVinted(o,i,melange,memeCompte))}
                  </div>
                </div>
                );}); })()}
              {/* Colis cochés « retiré » que Vinted n'a pas encore confirmés :
                  on les garde EN GRIS plutôt que de les faire disparaître d'un
                  coup — on voit que c'est fait, et on peut annuler. Ils sortent
                  tout seuls dès que Vinted enregistre le retrait. */}
              {/* Colis d'EMAIL cochés : en gris, AVEC leur QR (voir pickupUnion). */}
              {pickupUnion.attenteMail.length>0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:8}}>✓ {pickupUnion.attenteMail.length} retiré{pickupUnion.attenteMail.length>1?'s':''} — en attente de confirmation</div>
                  {pickupUnion.attenteMail.map((t,i)=>{
                    const qi = qrImage(t), cd = codeRetrait(t.code), id2 = codeRetrait(t.code2);
                    return (
                    <div key={'m'+i} style={{display:'flex',gap:11,alignItems:'center',flexWrap:'wrap',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',marginBottom:7}}>
                      <span style={{opacity:.45,display:'flex',flexShrink:0}}>{thumb(photoColis(t))}</span>
                      <div style={{flex:'1 1 150px',minWidth:0,opacity:.6}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textDecoration:'line-through'}}>{t.artTitle||`Colis${t.suivi?' n°'+t.suivi:''}`}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:1}}>Coché récupéré · son QR reste là en cas de souci</div>
                        <LigneArrivee arr={arriveeColisEmail(t)}/>
                        {t.suivi&&<div style={{fontSize:11,color:C.muted,fontFamily:'monospace',letterSpacing:.5,marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>n° {t.suivi}</div>}
                      </div>
                      {qi && (
                        <button className="vrm-icon-control" type="button" onClick={()=>openQrView(t)} title="QR de retrait — encore disponible en cas de problème" aria-label="Afficher le QR de retrait en grand"
                          style={{flexShrink:0,border:`1.5px solid ${C.accent}`,background:'#fff',borderRadius:12,padding:3,cursor:'pointer',width:52,height:52,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                          <img src={qi} alt="QR de retrait" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                        </button>
                      )}
                      {!qi && (cd||id2) && (
                        <div style={{flexShrink:0,display:'flex',gap:5}}>
                          {id2 && <div style={{textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:'3px 8px'}}><div style={{fontSize:7.5,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>Identifiant</div><div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:'monospace',letterSpacing:1}}>{id2}</div></div>}
                          {cd && <div style={{textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:'3px 8px'}}><div style={{fontSize:7.5,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>{id2?'Ouverture':'Code'}</div><div className="vrm-sensible" data-stream-type="code" style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:'monospace',letterSpacing:1}}>{cd}</div></div>}
                        </div>
                      )}
                      <Bouton variante="discret" onClick={()=>unmarkCollected(t)} title="Annuler : je ne l'ai pas encore récupéré" aria-label="Annuler : je ne l'ai pas encore récupéré" style={{flexShrink:0,marginLeft:'auto'}}>↺ Remettre</Bouton>
                    </div>
                    );
                  })}
                </div>
              )}
              {pickupUnion.attente.length>0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:8}}>✓ {pickupUnion.attente.length} retiré{pickupUnion.attente.length>1?'s':''} — Vinted n'a pas encore enregistré</div>
                  {pickupUnion.attente.map((o,i)=>{
                    // ⚠️ LE QR RESTE ACCESSIBLE TANT QUE CE N'EST PAS CONFIRMÉ.
                    //    « Si jamais il y a un problème, j'ai quand même le QR
                    //    code » — au comptoir, un colis qu'on croyait retiré peut
                    //    devoir être rescanné. Le colis reliée par `trackForBuy`
                    //    (titre exact ET candidat unique des deux côtés, §5.39) :
                    //    jamais le QR d'un autre colis.
                    // ⚠️ L'opacité N'EST PAS sur la carte : elle se transmet aux
                    //    enfants et on ne peut pas la « défaire ». On grise donc
                    //    le texte et la photo, et le QR reste net.
                    const tk = trackForBuy(o);
                    const qi = qrImage(tk), cd = codeRetrait(tk&&tk.code), id2 = codeRetrait(tk&&tk.code2);
                    return (
                    <div key={'w'+i} style={{display:'flex',gap:11,alignItems:'center',flexWrap:'wrap',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',marginBottom:7}}>
                      <span style={{opacity:.45,display:'flex',flexShrink:0}}>{thumb(orderPhoto(o))}</span>
                      <div style={{flex:'1 1 150px',minWidth:0,opacity:.6}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textDecoration:'line-through'}}>{o.title||'Colis'}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:1}}>Coché récupéré · Vinted dit encore « déposé », ça se règle seul</div>
                        <LigneArrivee arr={tk ? arriveeColisEmail(tk) : arriveeColisVinted(relaisDe(o))}/>
                        {tk&&tk.suivi&&<div style={{fontSize:11,color:C.muted,fontFamily:'monospace',letterSpacing:.5,marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>n° {tk.suivi}</div>}
                      </div>
                      {qi && (
                        <button className="vrm-icon-control" type="button" onClick={()=>openQrView(tk)} title="QR de retrait — encore disponible en cas de problème" aria-label="Afficher le QR de retrait en grand"
                          style={{flexShrink:0,border:`1.5px solid ${C.accent}`,background:'#fff',borderRadius:12,padding:3,cursor:'pointer',width:52,height:52,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                          <img src={qi} alt="QR de retrait" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                        </button>
                      )}
                      {!qi && (cd||id2) && (
                        <div style={{flexShrink:0,display:'flex',gap:5}}>
                          {id2 && <div style={{textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:'3px 8px'}}><div style={{fontSize:7.5,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>Identifiant</div><div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:'monospace',letterSpacing:1}}>{id2}</div></div>}
                          {cd && <div style={{textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:'3px 8px'}}><div style={{fontSize:7.5,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>{id2?"Ouverture":'Code'}</div><div className="vrm-sensible" data-stream-type="code" style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:'monospace',letterSpacing:1}}>{cd}</div></div>}
                        </div>
                      )}
                      <Bouton variante="discret" onClick={()=>unmarkPickupDone(o)} title="Annuler : je ne l'ai pas encore récupéré" aria-label="Annuler : je ne l'ai pas encore récupéré" style={{flexShrink:0,marginLeft:'auto'}}>↺ Remettre</Bouton>
                    </div>
                    );
                  })}
                </div>
              )}
              <div className="vrm-pickup-foot" style={{color:C.muted}}>Coche ✓ quand tu l'as récupéré : il reste en gris jusqu'à ce que Vinted confirme.</div>
            </div>
          );
        })()}
        {/* ── « À VÉRIFIER » (23 octobre) ──────────────────────────────────────
            Remplace « colis jamais retirés » (> 14 j). « Pour l'instant c'est
            catastrophique ; il doit prendre en compte si une paire est repartie
            au vendeur » (Julien). Un colis dont la date limite ÉCRITE est passée,
            ou arrivé depuis plus que ce qu'un point relais garde (mesuré : 4 à
            7 j), n'est plus présenté « à retirer » : à vérifier (29 oct. : jamais
            « sans doute reparti » — 5 sur 5 avaient été retirés). On ne dit jamais « perdu »,
            on ne le cache pas (code et QR restent : il est peut-être encore là),
            et il ne compte dans AUCUN total (`pickupUnion.aVerifier`, §11). */}
        {/* (23 oct.) LE SUIVI VINTED DES ACHATS, DIT UNE FOIS (§7) : relevé par
            l'extension sur Vinted (ligne `harvest_{uid}_suivi_{tx}`). Sur chaque
            carte reliée : « Vinted : « … » ». Ici seulement ce qui MANQUE, et le
            geste — la promesse « l'extension le relève » n'est faite qu'à une
            extension qui sait le faire (`extSait('suivivinted')`). */}
        {aFilter==='attente' && <EtatSuiviVinted achats={[...pickupUnion.extra, ...(pickupUnion.aConfirmer||[]), ...pickupUnion.aVerifier.filter(x=>x.kind==='vinted').map(x=>x.o)]}
          suivisVinted={suivisVinted} etatDe={etatSuiviDe} accName={accName} relire={relireSuivisVinted}/>}
        {aFilter==='attente' && <SuivisManuels liste={suivisManuels} tracking={tracking} transp={transpMap} achats={buysBase} accName={accName} relire={relireSuivisManuelsPartout}
          etapeDe={(n)=>etapeDuSuiviManuel(n,{union:pickupUnion,fins:finsSuivis,tracking:trackingRetrait,collected,index:indexSuivisAchats,raison:raisonAVerifier})}/>}
        {/* (29 oct.) « EN COURS DE VÉRIFICATION » : des achats que Vinted dit
            « déposés en point relais », qu'AUCUNE identité ne relie encore à un
            colis montré au-dessus (ni code de retrait, ni n° de suivi), alors
            qu'un colis d'e-mail du même compte n'est relié à aucune commande —
            peut-être le même colis vu deux fois. Rien ne permet de le dire (§5 :
            jamais le lieu, la date ou le titre) : ils sont montrés ici, une fois,
            et ne comptent dans aucun total tant que leur n° n'est pas connu. */}
        {aFilter==='attente' && !retraitsOutils && (pickupUnion.aConfirmer||[]).length>0 && (()=>{ const l = pickupUnion.aConfirmer; const n = l.length;
          return (
          <div className="vrm-achats-bloc" data-en-verification={n} style={{background:C.card,border:`1px solid ${C.border}`,marginBottom:10}}>
            <div className="vrm-achats-bloc-t" style={{color:C.text}}>{n} {n>1?'achats':'achat'} au point relais en cours de vérification</div>
            <div className="vrm-achats-bloc-p" style={{color:C.muted}}>
              Vinted {n>1?'les dit':'le dit'} « déposé{n>1?'s':''} en point relais » : peut-être {n>1?'les mêmes colis':'le même colis'}. <Pourquoi>Rien ne {n>1?'les':'le'} relie encore à un colis ci-dessus (ni code de retrait, ni n° de suivi). {n>1?'Ils ne comptent':'Il ne compte'} pas dans « à retirer » tant que {n>1?'leur':'son'} n° de suivi n'est pas connu.</Pourquoi>{/* (tour 2 n° 4) Le geste (l'extension qui relève le suivi Vinted) est dit par `EtatSuiviVinted`, gardé par `extSait` — une voix, et jamais une promesse à un téléphone ni à une extension qui ne le fait pas. */}
            </div>
            <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
              {l.map((o,i)=>(
                <div key={'c'+(o.transaction_id||i)} data-en-verification-tx={String(o.transaction_id||'')} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 10px'}}>
                  <div style={{flex:'1 1 150px',minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.title||'Colis'}</div>
                    <div style={{fontSize:11,color:C.muted}}>{o._acc?accName(o._acc):''}</div>
                  </div>
                  {lienConv(o) && <a href={lienConv(o)} target="_blank" rel="noreferrer" style={{flexShrink:0,textDecoration:'none',border:`1px solid ${C.border}`,color:C.muted,borderRadius:12,padding:'5px 9px',fontSize:12,fontWeight:600,minHeight:44,boxSizing:'border-box',display:'inline-flex',alignItems:'center'}}>Conversation ↗</a>}
                  <button type="button" title="Je l'avais récupéré" onClick={()=>markPickupDone(o)} style={{flexShrink:0,border:`1px solid ${C.accent}`,background:`${C.accent}14`,color:C.accentTexte,borderRadius:12,padding:'5px 10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',minHeight:44}}>✓ Je l'ai eu</button>
                </div>
              ))}
            </div>
          </div>); })()}
        {aFilter==='attente' && !retraitsOutils && (pickupUnion.aVerifier||[]).length>0 && (
          <div data-oublies={pickupUnion.aVerifier.length} data-a-verifier={pickupUnion.aVerifier.length} style={{border:`1px solid ${C.warn}`,background:`${C.warn}0e`,borderRadius:12,padding:'12px 14px',marginBottom:10}}>
            <div style={{fontSize:15,fontWeight:700,color:C.text,display:'flex',alignItems:'center',gap:7}}>
              {/* ⚠️ (29 oct.) Plus « sans doute repartis » : mesuré le 29, les 5 colis
                  ainsi nommés avaient TOUS été retirés. Seuls le transporteur ou
                  Vinted disent « reparti » (le bloc « repartis » plus bas). */}
              <Icon name="alert" size={16} color={C.warn}/>{pickupUnion.aVerifier.length} colis à vérifier
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:4,lineHeight:1.45}}>
              Tu l'as eu ? Coche « Je l'ai eu ». Sinon, regarde son suivi. <Pourquoi label="Pourquoi « à vérifier »">Délai de retrait dépassé, ou au point relais depuis plus longtemps que son transporteur ne garde un colis (mesuré sur tes e-mails : Chronopost 4 jours, Mondial Relay 5, Vinted Go 6 ; {GARDE_MAX_J} pour les autres){pickupUnion.aVerifier.some(x=>x.e&&x.e.etat==='transporteur')?', ou le transporteur signale un problème (son message est recopié sur la ligne)':''}. Ils ne comptent plus dans « à retirer » : rien ne dit encore s'ils ont été retirés ou s'ils sont repartis.</Pourquoi>
              {/* (revue du 23 oct.) Le compte suit la MÊME règle que les lignes
                  (`aEncoreCode`) : un colis vu par Vinted dont la conversation
                  porte le code compte aussi — avant, seuls les e-mails comptaient. */}
              {(()=>{ const n=pickupUnion.aVerifier.filter(aEncoreCode).length;
                return n ? <><br/>{n>1?`${n} ont encore leur code ou leur QR`:'1 a encore son code ou son QR'} : peut-être encore au relais.</> : null; })()}
            </div>
            {(()=>{ const c=compteAVCommun(pickupUnion.aVerifier, compteDuColisEmail, accName), r=raisonAVCommune(pickupUnion.aVerifier); return (c||r) ? (
              <div data-a-verifier-commun={c||''} style={{fontSize:12,color:C.muted,marginTop:4,lineHeight:1.45}}>
                {c ? <>Tous sur <b style={{color:C.text,fontWeight:600}}>{c}</b></> : null}{c&&r ? ' · ' : ''}{r ? <b style={{color:C.warn,fontWeight:600}}>{r}</b> : null}
              </div>) : null; })()}
            <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:7}}>
              {pickupUnion.aVerifier.map((x,i)=>{
                // (30 oct.) Compte et raison communs à tout le groupe : dits UNE fois au-dessus.
                const raisonC = raisonAVCommune(pickupUnion.aVerifier), compteC = compteAVCommun(pickupUnion.aVerifier, compteDuColisEmail, accName);
                const raison = raisonC ? '' : raisonAVerifier(x);
                if (x.kind==='email') {
                  const t=x.t; const cl=cleanLieu(t.lieu); const code=codeRetrait(t.code);
                  const arr=arriveeColisEmail(t); const cpt=compteDuColisEmail(t);
                  return (
                    <div key={'e'+(colisKey(t)||i)} data-oublie="" data-a-verifier-code={aEncoreCode(x)?'oui':'non'} data-a-verifier-raison={x.e.etat} data-colis-suivi={t.suivi||''} data-arrive-le={arr?jourLocal(arr.ms):'inconnue'} data-arrive-sur={arr?arr.sur:''} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'8px 10px'}}>
                      <CarrierBadge carrier={t.carrier} size={20}/>
                      <div style={{flex:'1 1 150px',minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          {cl.nom || carrierName(t.carrier)}
                        </div>
                        <div data-oublie-info="" style={{fontSize:11,color:C.muted,overflowWrap:'anywhere'}}>
                          n° {t.suivi||'?'}{cpt&&!compteC?` · ${cpt}`:''}{raison ? <> · <b style={{color:C.warn,fontWeight:600}}>{raison}</b></> : null} · {texteArrivee(arr)}
                        </div>
                        <LigneNouvelleVinted nv={nouvelleDe(x.o)}/>
                        <LigneTransporteur transp={transpMap} suivi={suiviDeLigne(t)} carrier={t.carrier}/>
                      </div>
                      <div className="vrm-oublie-gestes">
                      {code && <span className="vrm-sensible" data-stream-type="code" style={{flexShrink:0,fontSize:12,fontWeight:700,color:C.text,fontFamily:'ui-monospace,monospace',border:`1px solid ${C.border}`,borderRadius:12,padding:'2px 7px'}}>{code}</span>}
                      {(()=>{ const qi=qrVivant(t); return qi ? (
                        <button className="vrm-icon-control" type="button" onClick={()=>openQrView(t)} title="QR de retrait — présente-le au comptoir" aria-label="Afficher le QR de retrait en grand"
                          style={{flexShrink:0,border:`1.5px solid ${C.accent}`,background:'#fff',borderRadius:12,padding:3,cursor:'pointer',width:46,height:46,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                          <img src={qi} alt="QR de retrait" onError={()=>noterImgMorte(qi)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                        </button>
                      ) : null; })()}
                      <BoutonSuivreColis transporteur={t.carrier} suivi={t.suivi} codePostal={codePostalLu(t)} enLigne court attrs={{'data-oublie-verifier':''}}/>
                      <Bouton variante="secondaire" title="Je l'avais récupéré" data-oublie-eu="" onClick={()=>markCollected(t)} style={{flexShrink:0}}>✓ Je l'ai eu</Bouton>
                      </div>
                    </div>
                  );
                }
                const o=x.o; const rel=relaisDe(o); const cd=rel?codeRetrait(rel.code):''; const href=(rel&&(rel.qr||rel.url))||lienConv(o);
                const jCap = x.e.capMs ? Math.floor((Date.now()-x.e.capMs)/86400000) : null;
                return (
                  <div key={'v'+(o.transaction_id||i)} data-a-verifier-vinted={String(o.transaction_id||'')} data-a-verifier-code={aEncoreCode(x)?'oui':'non'} data-a-verifier-raison={x.e.etat} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'8px 10px'}}>
                    <div style={{flex:'1 1 150px',minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.title||'Colis'}</div>
                      <div style={{fontSize:11,color:C.muted,overflowWrap:'anywhere'}}>
                        {[o._acc && !compteC ? accName(o._acc) : '', raison ? <b key="r" style={{color:C.warn,fontWeight:600}}>{raison}</b> : '',
                          /* (revue du 23 oct.) Un compte déjà nommé par la ligne de fraîcheur ne se redit pas ici. */
                          jCap!=null && jCap>=1 && jCap<FRAICHEUR_ACHATS_J ? `« déposé en point relais » lu il y a ${jCap} j` : ''].filter(Boolean).map((x,k)=><React.Fragment key={k}>{k?' · ':''}{x}</React.Fragment>)}
                      </div>
                      <LigneNouvelleVinted nv={nouvelleDe(o)}/>
                      {(()=>{ const e=entreeSuiviAchat(o); const su=suivisAchat(o, indexSuivisAchats)[0]; return su ? <LigneTransporteur transp={transpMap} suivi={su} carrier={(e&&e.transporteur)||transporteurDeForme(su)||''}/> : null; })()}
                    </div>
                    <div className="vrm-oublie-gestes">
                      {(()=>{ const e=entreeSuiviAchat(o); const su=suivisAchat(o, indexSuivisAchats)[0]; return su ? <BoutonSuivreColis transporteur={(e&&e.transporteur)||transporteurDeForme(su)||''} suivi={su} enLigne court/> : null; })()}
                      {cd && <span className="vrm-sensible" data-stream-type="code" style={{flexShrink:0,fontSize:12,fontWeight:700,color:C.text,fontFamily:'ui-monospace,monospace',border:`1px solid ${C.border}`,borderRadius:12,padding:'2px 7px'}}>{cd}</span>}
                      {href && <Bouton variante="secondaire" href={href} target="_blank" rel="noreferrer" style={{flexShrink:0}}>Conversation ↗</Bouton>}
                      <Bouton variante="secondaire" title="Je l'avais récupéré" onClick={()=>markPickupDone(o)} style={{flexShrink:0}}>✓ Je l'ai eu</Bouton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* ⚠️ SOUS LES COLIS, PAS AU-DESSUS. Ce panneau dit quelles boîtes mail
            ne transfèrent pas — une information de configuration, vraie pendant
            des semaines, qu'on règle une fois. Placé en tête, il repoussait
            chaque jour les colis, leurs codes et leurs QR d'une centaine de
            pixels : ce qu'on vient chercher passait après ce qu'on ne peut pas
            régler d'ici. Il reste sur cet onglet (c'est bien là que les codes
            manquent), simplement après — ET APRÈS LES COLIS JAMAIS RETIRÉS
            (revue du 11 octobre : déplié, il faisait 312 px et repoussait de
            l'argent perdu). Avec des comptes muets : une ligne (`MuetsCompact`). */}
        {aFilter==='attente' && <ReceptionEmails tracking={tracking} comptes={accounts}
          colisParTransporteur={(()=>{ const m={}; for(const t of (pickupUnion.emailList||[])){ const k=carrierKey(t&&t.carrier)||'autre'; m[k]=(m[k]||0)+1; } return m; })()}/>}
        {/* ── LES COLIS QUI SONT REPARTIS CHEZ LE VENDEUR ────────────────────
            ⚠️ MESURÉ SUR LA VRAIE BASE (6 septembre) : trois achats portent
            « Commande non réclamée - Retournée à l'expéditeur.rice », pour
            84,94 € et tous de moins de quinze jours — et AUCUN écran ne le
            disait. `phaseReception` les range en « annulé » (son test attrape
            « retour »), avec les remboursements : ils sortaient donc de
            « À retirer », de « En route » ET de « Reçus » sans un mot.
            Un colis caché est un colis perdu, et celui-là est le pire des
            trois : la paire est repartie chez le vendeur, et l'argent n'est
            pas forcément revenu.
            ⚠️ On n'écrit PAS « tu as perdu 84,94 € » : Vinted rembourse
            souvent tout seul, et un chiffre qu'on ne peut pas vérifier est
            invendable (§2.7). On dit ce que Vinted dit, on donne le montant à
            vérifier, et on ouvre la conversation — là où ça se règle. */}
        {(()=>{
          // (23 oct.) + ce que dit un SIGNAL CERTAIN, par identité (§5) : le
          // transporteur écrit que le colis repart (statut « retour »), ou la
          // commande liée au colis (n° de suivi, code de retrait) dit non
          // réclamée / remboursée / annulée, ou la transaction dit « non
          // réclamée » alors que la liste des achats disait encore « déposé ».
          // Le statut affiché est celui de Vinted ou du transporteur, tel quel.
          const vus = new Set(); const rendus = [];
          for (const o of (buysBase || []).filter(o => /non r[ée]clam/i.test(o.status || ''))) { vus.add(String(o.transaction_id)); rendus.push({ o, statut: String(o.status || '') }); }
          for (const r of (pickupUnion.repartis || [])) {
            if (r.o) { const k = String(r.o.transaction_id); if (vus.has(k)) continue; vus.add(k); }
            else if (r.t) { const k = 'suivi:' + normaliserSuivi(r.t.suivi); if (vus.has(k)) continue; vus.add(k); }
            rendus.push(r);
          }
          rendus.sort((a,b) => {
            const da = a.o ? new Date(a.o.date||0).getTime() : Date.parse((a.t&&a.t.receivedAt)||0);
            const db = b.o ? new Date(b.o.date||0).getTime() : Date.parse((b.t&&b.t.receivedAt)||0);
            return (db||0) - (da||0);
          });
          if (!rendus.length) return null;
          const avecMontant = rendus.filter(r => r.o && montantCommande(r.o) > 0);
          const tot = avecMontant.reduce((t,r) => t + montantCommande(r.o), 0);
          const auMoins = avecMontant.length < rendus.length;
          // (3 nov., Julien : « beaucoup trop brouillon ») Sous Colis → À retirer : une carte « À faire » courte
          // par colis reparti — sa photo (l'achat lui-même), « Remboursement à vérifier · 19,64 € », « Ouvrir »
          // (la conversation de LA commande). Mêmes listes, même montant (`montantCommande`), aucune phrase.
          if (retraitsOutils) return (
            <section className="vrm-rpf-section" data-rp-section="argent" data-rp-section-n={rendus.length}>
            <h3 className="vrm-rpf-section-titre" data-rp-section-titre="argent">Argent à vérifier<span className="vrm-rpf-section-n">{rendus.length}</span></h3>
            <div className="vrm-repartis-courts" data-repartis={rendus.length} data-repartis-total={tot > 0 ? tot.toFixed(2) : ''}>
              {rendus.map((r, ix) => { const o = r.o, t = r.t; const ph = o ? orderPhoto(o) : null; const m = o ? montantCommande(o) : 0;
                const href = o ? lienConv(o) : (t && t.suivi ? trackUrl(t.carrier || '', String(t.suivi)) : '');
                return (
                  <div key={o ? 'nr' + o.transaction_id : 'nrt' + ((t && t.suivi) || ix)} className="vrm-rpf-ligne vrm-reparti-court" {...(o ? { 'data-reparti-tx': String(o.transaction_id) } : { 'data-reparti-suivi': (t && t.suivi) || '' })}>
                    {/* (6 nov., v36-visuel-2) Une rangée de Wallet : la puce dit l'état en court (une ligne,
                        jamais coupée), le MONTANT vit à droite comme un prix ; toute la rangée ouvre la
                        conversation de LA commande (↗) — plus de « Ouvrir » qui serrait la puce sur 2 lignes. */}
                    {(() => { const corps = (<>
                      <span className={'vrm-rpf-vignette' + (ph && !imgMortes.has(ph) ? '' : ' is-sans')} aria-hidden="true">{ph && !imgMortes.has(ph) ? <PhotoVinted src={ph} alt="" loading="lazy" onError={() => noterImgMorte(ph)}/> : null}</span>
                      <span className="vrm-rpf-quoi"><span className="vrm-rpf-titre">{o ? (o.title || 'Achat') : `${carrierName(t && t.carrier)} · n° ${(t && t.suivi) || ''}`}</span>
                        <span className="vrm-rpf-puces"><span className="vrm-rpf-puce is-ambre">Remboursement à vérifier</span></span></span>
                      {m > 0 ? <b className="vrm-rpf-montant" data-montant="">{montant(m)}</b> : null}
                      {href ? <span className="vrm-rpf-sortie" aria-hidden="true">↗</span> : null}
                    </>);
                    return href
                      ? <a className="vrm-rpf-rang vrm-rpf-rang-lien" href={href} target="_blank" rel="noreferrer" data-reparti-ouvrir="" aria-label={`Ouvrir la conversation : ${o ? (o.title || 'achat') : 'colis'}, remboursement à vérifier${m > 0 ? ' ' + montant(m) : ''}`}>{corps}</a>
                      : <div className="vrm-rpf-rang" style={{cursor:'default'}}>{corps}</div>; })()}
                  </div>); })}
            </div>
            </section>
          );
          return (
            <div className="vrm-achats-bloc" data-repartis={rendus.length} style={{background:C.card,border:`1px solid ${C.border}`}}>
              {/* (6 nov., v36-visuel-2) Une carte d'alerte : icône · titre court + « ⓘ » (le pourquoi) ·
                  UNE ligne (le montant à vérifier) — plus 4 lignes de phrase avant la liste. */}
              <div className="vrm-achats-bloc-t vrm-alerte-tete" style={{color:C.text}}>
                <span aria-hidden="true" className="vrm-alerte-icone"><Icon name="alert" size={15}/></span>
                <span className="vrm-alerte-ligne-texte">
                  <span className="vrm-alerte-ligne-titre">{rendus.length} colis {rendus.length>1?'repartis':'reparti'} chez {rendus.length>1?'leurs vendeurs':'son vendeur'}{' '}<Pourquoi titre="Colis reparti">L'article ne viendra pas. Vérifie le remboursement dans la conversation Vinted de la commande.</Pourquoi></span>
                  <span className="vrm-alerte-ligne-sous">{tot>0 ? <><span data-montant="" style={{whiteSpace:'nowrap'}}>{auMoins?'au moins ':''}{montant(tot)}</span> à vérifier</> : 'Remboursement à vérifier'}</span>
                </span>
              </div>
              <div className="vrm-achats-bloc-liste">
                {rendus.slice(0,8).map((r,ix)=>{
                  if (!r.o) {
                    const t = r.t;
                    return (
                      <div key={'nrt'+(t.suivi||ix)} data-reparti-suivi={t.suivi||''} className="vrm-achats-bloc-ligne" style={{borderColor:C.border}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{carrierName(t.carrier)} · n° {t.suivi}</div>
                          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{r.statut==='transporteur'?"Le transporteur dit sur son site qu'il repart chez l'expéditeur":"Le transporteur écrit qu'il repart chez l'expéditeur"}{compteDuColisEmail(t)?` · ${compteDuColisEmail(t)}`:''}</div>
                          <LigneTransporteur transp={transpMap} suivi={suiviDeLigne(t)} carrier={t.carrier}/>
                        </div>
                        {t.suivi && <Bouton variante="discret" className="vrm-pickup-lien" href={trackUrl(t.carrier||'', String(t.suivi))} target="_blank" rel="noreferrer" style={{flexShrink:0}}>Suivi ↗</Bouton>}
                      </div>
                    );
                  }
                  const o = r.o;
                  const j = Math.round((Date.now() - new Date(o.date||0).getTime())/86400000);
                  const href = lienConv(o);
                  const st = r.statut === 'retour' ? "le transporteur écrit qu'il repart chez l'expéditeur" : r.statut === 'transporteur' ? "le transporteur dit sur son site qu'il repart chez l'expéditeur" : (r.statut && !/non r[ée]clam/i.test(r.statut) ? `Vinted : « ${r.statut} »` : '');
                  return (
                    <div key={'nr'+o.transaction_id} data-reparti-tx={String(o.transaction_id)} className="vrm-achats-bloc-ligne" style={{borderColor:C.border}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.title||'Achat'}</div>
                        <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                          {montant(montantCommande(o))}{isFinite(j) ? ` · commandé il y a ${j} jour${j>1?'s':''}` : ''}{st?` · ${st}`:''}
                        </div>
                        {(()=>{ const su = r.t ? suiviDeLigne(r.t) : suivisAchat(o, indexSuivisAchats)[0]; const e = entreeSuiviAchat(o); return su ? <LigneTransporteur transp={transpMap} suivi={su} carrier={(r.t && r.t.carrier) || (e && e.transporteur) || transporteurDeForme(su) || ''}/> : null; })()}
                      </div>
                      {href && <Bouton variante="discret" className="vrm-pickup-lien" href={href} target="_blank" rel="noreferrer" style={{flexShrink:0}}>Conversation ↗</Bouton>}
                    </div>
                  );
                })}
              </div>
              {rendus.length>8 && <div style={{fontSize:11,color:C.muted,marginTop:6}}>et {rendus.length-8} autre{rendus.length-8>1?'s':''} — ils sont tous dans l'onglet « Tous ».</div>}
            </div>
          );
        })()}
        {/* ACHATS HORS PLATEFORME (brocante, fournisseur, main propre…) : la
            liste se replie (saisie occasionnelle, l'écran reste léger), mais
            « + Ajouter » est TOUJOURS là, en un tap. Le composant porte la
            règle ; ici on ne fait que brancher la clé synchronisée (§11). */}
        {/* (31 oct., soir) Un achat, pas un colis à aller chercher : sur « Achats » seulement. */}
        {!modeRetraits && facturesAchat.champ}
        {/* (10 nov., lot BH) Un même achat saisi deux fois : les deux fiches côte à côte, « Garder celle-ci ». */}
        {!modeRetraits && <AchatsEnDouble groupes={achatsDoubles} masques={(offBuysTous || []).filter((b) => b && horsMasques.includes(String(b.id)))}
          onGarder={garderAchatDouble} onReafficher={reafficherHorsDouble} Photo={PhotoVinted} Icon={Icon} photo={(a) => (a.source === 'vinted' ? orderPhoto(a.achat) || '' : '')} prixAchat={(a) => (a.source === 'vinted' ? (a.achat && a.achat.price && a.achat.price.amount != null ? Number(a.achat.price.amount) : null) : prixAchatHorsNombre(a.achat))}
          compte={(a) => (a.source === 'vinted' && a.achat && a.achat._acc ? accNameOf(a.achat._acc) : '')} quand={(a) => (a.source === 'vinted' ? quandCommandeVinted(a.achat) : (a.achat && a.achat.date ? Date.parse(String(a.achat.date).length === 10 ? a.achat.date + 'T12:00:00' : a.achat.date) : null))}/>}
        {!modeRetraits && <AchatsHorsPlateforme achats={offBuys} ouvert={offSecOpen} onBasculer={setOffSecOpen} facture={facturesAchat} importer={importAchats}
          onAjouter={addOffBuy} onModifier={updOffBuy} onSupprimer={delOffBuy}
          paires={annBase.filter(it=>String((numeros[it.id]||{}).numero||'').trim()).map(it=>({ id: it.id, num: String((numeros[it.id]||{}).numero), title: it.title||'' })).sort((a,b)=>String(a.num).localeCompare(String(b.num),'fr',{numeric:true}))}
          prochainNumero={nextNumero} onReserverNumero={recordUsed} stock={Array.isArray(listings.items)&&!listings.error?stockPourModele:null}
          chargerStock={()=>{ if (accounts.length && listings.items===null && !listings.loading) loadListings(false, true); }}
          onPrixParNumero={(nm,pr)=>setBuyByNum(prev=>{ const u={...prev,[nm]:pr}; save('vinted_buyprice_by_num',u); return u; })}/>}
        {/* (Ancien bloc « Colis en route » retiré : le suivi est maintenant DANS
            chaque ligne d'achat ci-dessous — photo + statut + progression + Suivre.) */}
        {/* (la barre d'outils est remontée sous le titre, comme sur Ventes) */}
        {buys.loading && !buys.items && <Skeleton variant="row" count={5}/>}
        {buys.error && <LoadError onRetry={()=>loadOrders('purchased',setBuys,true)}/>}
        {!modeRetraits && buys.items && !buys.error && buysBase.length===0 && (buys.items.length>0
          // (5 nov.) Des achats existent, mais tous sur des comptes écartés : « aucun achat » serait faux.
          ? <div data-achats-vide="ecartes"><EmptyState icon="bag" title="Tes achats sont sur des comptes écartés"
              desc="Les comptes écartés n'entrent dans aucun écran ni aucun total. Paramètres → Comptes liés pour les remettre."/></div>
          : <div data-achats-vide="aucun"><EmptyState icon="bag" title="Aucun achat pour l'instant"
              desc="Tes achats Vinted arrivent ici tout seuls dès que l'extension a capté ton compte. Rien à faire."/></div>
        )}
        {/* (5 nov.) Un filtre ou une recherche qui ne trouve rien le DIT (avant : une liste vide, muette). */}
        {!modeRetraits && buys.items && !buys.error && buysBase.length>0 && achatsAffiches.length===0 && aFilter!=='attente' && (
          <div className="vrm-achats-vide" data-achats-vide={ordSearchDiff.trim() ? 'recherche' : aFilter} style={{color:C.muted}}>
            <span>{ordSearchDiff.trim() ? `Aucun achat pour « ${ordSearchDiff.trim().slice(0,40)} »` : aFilter==='route' ? 'Rien en route en ce moment' : aFilter==='recus' ? 'Aucun achat arrivé sur cette période' : 'Aucun achat sur cette période'}</span>
            {ordSearchDiff.trim() ? <button type="button" className="vrm-lien-action" data-achats-effacer="" onClick={()=>setOrdSearch('')}>Effacer la recherche</button> : null}
          </div>
        )}
        {/* ⚠️ SUR ORDINATEUR, LA LISTE SE RANGE EN DEUX COLONNES.
            Une ligne de vente de 980 px pour une photo, un titre et un
            prix, c'est le meme defaut que les cartes d'action de Ma
            journee : on defile deux fois plus pour voir la meme chose.
            `auto-fit, minmax(min(430px, 100%), 1fr)` donne DEUX colonnes sur grand
            ecran et UNE sur telephone — la meme regle, sans test de
            largeur dans le JavaScript, donc rien a maintenir en double.
            Les lignes portent deja `flexWrap` et une largeur plancher
            (§26), elles supportent la colonne plus etroite. */}
        {/* Liste blanche groupée (style démo iOS) : une seule surface, des lignes
            séparées par un filet fin, beaucoup d'air — plus de cartes encadrées
            séparées. La couleur ne sert qu'au point de statut ; les actions sont
            de petites icônes discrètes à droite.
            (16 oct.) Ligne dense alignée : vignette · titre · statut · montant,
            et un seul bouton « ⋯ » au doigt (suivre et code de retrait passent
            dans ce menu sur téléphone). Le compte se nomme UNE fois en tête
            quand toute la liste est sur le même (§7) ; sur chaque ligne sinon. */}
        {(()=>{ const tranche = achatsAffiches.slice(0, achatsMax);
          const cptes = [...new Set(tranche.map(({o})=>o._acc?String(o._acc.vinted_user_id):'').filter(Boolean))];
          const unCompte = cptes.length===1 ? (tranche.find(({o})=>o._acc)||{}).o._acc : null;
          return (<>
        {unCompte && tranche.length>1 && <div className="vrm-buy-compte" style={{color:C.muted}}>Tous sur <AcctTag acc={unCompte} name={accNameOf(unCompte)}/></div>}
        {tranche.length>1 && <div className="vrm-serie-entree" style={{display:'flex',justifyContent:'flex-end'}}><OuvrirSerie serie={serieAchats}/></div>}
        <BarreSerie serie={serieAchats} actions={actionsSerieAchats()} rendreIcone={iconeApp}/>
        <div className="vrm-buy-list" style={{background:C.card,border:tranche.length?`1px solid ${C.border}`:'none'}}>
          {tranche.map(({o,tk,st},i)=>{
            const cancelled = st.step===0;
            const suivi = tk && tk.suivi ? String(tk.suivi) : '';
            const rc = receiptFor(o);
            const numA = buyNumByTxn[String(o.transaction_id)];
            return (
            <React.Fragment key={o.transaction_id}>
            {i === achatsSansDate.i ? <LigneSansDate n={achatsSansDate.n}/> : null}
            <div {...serieAchats.ligne(String(o.transaction_id))} className="vrm-buy-row" data-cible={attrCible(['achat',String(o.transaction_id)])} data-achat-tx={String(o.transaction_id)} data-ordre-t={tsCommande(o) || ''} style={{opacity:cancelled?0.55:1,...(estFloute(o)?STYLE_FLOU:null),...(achatMenu!=null&&achatMenu===String(o.transaction_id||'')?{zIndex:42}:null)}}>{/* (8 nov.) la ligne dont le menu ⋯ est ouvert passe AU-DESSUS des suivantes : une ligne pressée (:active, scale) ou atténuée (opacité) devient un contexte d'empilement, et la ligne suivante recouvrait son menu (banc recu-achat) */}
              <div className="vrm-buy-ph" style={{background:C.card2||C.bg}}>
                <CaseSerie serie={serieAchats} cle={String(o.transaction_id)} etiquette={o.title} surPhoto/>
                {orderPhoto(o)&&!achatPhKo.has(orderPhoto(o))?<PhotoVinted src={orderPhoto(o)} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={()=>{ const u=orderPhoto(o); setAchatPhKo(s=>{ if(s.has(u)) return s; const n=new Set(s); n.add(u); return n; }); }}/>:<Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/>}
              </div>
              <div className="vrm-buy-main">
                <div className="vrm-buy-title" style={{color:C.text}} title={o.title}>{o.title}</div>
                {/* (10 nov., lot AN) Une rangée DA6 : titre · sous-ligne (compte, date, depuis, N°) · une rangée de
                    pastilles (l'état, le reçu, la facture jointe). L'état n'est plus un point de couleur. */}
                <div className="vrm-buy-meta" style={{color:C.muted}}>
                  {/* (5 nov., revue 2.16) Achats : le compte en mots, sans pastille de couleur (hors palette). */}
                  {!unCompte && <AcctTag acc={o._acc} name={accNameOf(o._acc)} pastille={false}/>}
                  <span style={{whiteSpace:'nowrap'}}>{o.date?dateFr(o.date, new Date(o.date).getFullYear()===new Date().getFullYear() ? {day:'numeric',month:'short'} : {day:'numeric',month:'short',year:'numeric'}):''}
                  {/* DEPUIS COMBIEN DE TEMPS : « dois-je m'inquiéter ? ». Au-delà de
                      trois semaines, en rouge — le moment de relancer le vendeur. */}
                  {/* (6 nov., onglets A) AU RELAIS, ce qui compte est le temps passé AU RELAIS (le point le
                      renvoie au bout de quelques jours), pas l'âge de la commande — et « relance le vendeur »
                      n'a pas de sens pour un colis qui attend au point. Sur sa base : « 16 oct. · depuis 20 j »
                      pour un colis arrivé le 28 oct. L'arrivée est celle LUE dans l'e-mail du colis
                      (`arriveLe`, relié par identité) ; pas lue ⇒ rien d'écrit. */}
                  {!cancelled && !st.retour && st.step===3 && (()=>{ const a=Date.parse((tk&&tk.arriveLe)||''); if(!Number.isFinite(a)) return null; const j=Math.max(0,Math.floor((Date.now()-a)/86400000)); return <span data-achat-au-relais={j} style={{fontWeight:500,color:C.muted,whiteSpace:'normal'}}> · au relais {j===0?'depuis aujourd’hui':`depuis ${j} j`}</span>; })()}
                  {!cancelled && !st.retour && st.step>=1 && st.step<3 && (()=>{ const t=tsCommande(o); if(!t) return null; const j=Math.floor((Date.now()-t)/86400000); if(j<2) return null; const tard=j>ACHAT_RETARD_J; return <span style={{fontWeight:tard?700:500,color:tard?C.warn:C.muted,whiteSpace:'normal'}}> · depuis {j} j{tard?' — relance le vendeur':''}</span>; })()}</span>
                  {tk && tk.lieu && st.step===3 && <span style={{color:C.text}} title={tk.lieu}>· {(cleanLieu(tk.lieu).nom || tk.lieu)}</span>}
                  {numA!=null && <span title="Numéro de l'article (lien avec l'annonce / la vente)" style={{fontWeight:600,color:C.text}}>N°{numA}</span>}
                  {o._fromEmail && <span title="Reconstituée depuis l'email — pas encore confirmée par Vinted" style={{fontSize:11,fontWeight:600,color:C.muted,border:`1px solid ${C.border}`,borderRadius:12,padding:'0 6px'}}>email</span>}
                </div>
                {/* (29 oct.) « LES FACTURES SI TU LES REÇOIS PAR MAIL » (Julien) : le
                    reçu que Vinted envoie par email, relié à CET achat par son n°
                    de transaction (une identité, jamais le titre, §5). Visible sur
                    la ligne — il n'était que dans le menu ⋯. Son contenu (et un
                    PDF joint) ne se lit qu'au clic. */}
                <div className="vrm-buy-pastilles">
                  <span className="vrm-buy-statut" data-achat-etat={cancelled?'annule':(st.retour||st.step===3)?'geste':'neutre'}><i style={{background:st.color}}/>{st.label}</span>
                  {rc && (
                    <span className="vrm-buy-facture">
                      <button type="button" className="vrm-lien-action vrm-buy-chip" data-achat-facture={rc._pdf || rc.pdfB64 ? 'pdf' : 'email'} data-achat-facture-tx={String(txRecuAchat(rc))}
                        onClick={()=>setReceiptView(rc)} title="Ouvrir le reçu d'achat que Vinted t'a envoyé par e-mail">
                        <Icon name="receipt" size={13} style={{flexShrink:0}}/>{NOM_RECU_ACHAT}
                      </button>
                    </span>
                  )}
                  {(()=>{ const cf = cleFacture('tx', o.transaction_id); const fa = facturesAchat.factures && facturesAchat.factures[cf];
                    return fa ? <PastilleFacture cle={cf} f={fa} onOuvrir={facturesAchat.ouvrir} enCours={facturesAchat.enCours===cf} Icon={Icon}/> : null; })()}
                </div>
                {/* (24 oct.) En route : ce que dit le transporteur, par le n° de CET achat. */}
                {!cancelled && !st.retour && st.step>=1 && st.step<4 && (()=>{ const su = suivi || suivisAchat(o, indexSuivisAchats)[0]; const e = entreeSuiviAchat(o);
                  // (2 nov.) Le transporteur LU (logo + nom), puis ce qu'il dit.
                  const trA = transporteurColis((tk && tk.carrier) || (e && e.transporteur) || '', su);
                  return su ? <div className="vrm-buy-transp" data-achat-transporteur={cleStatTransporteur(trA)} style={{display:'flex',flexDirection:'column',gap:2,marginTop:4}}><PastilleTransporteur t={trA} C={C}/><LigneTransporteur transp={transpMap} suivi={su} carrier={(tk && tk.carrier) || (e && e.transporteur) || transporteurDeForme(su) || ''}/></div> : null; })()}
                {/* ⚠️ LITIGE / RETOUR : il doit RENVOYER la paire, et générer le
                    bordereau de retour. VRM ne le crée PAS à sa place : la route
                    qui GÉNÈRE un retour n'a jamais été observée (§4.10), et agir
                    tout seul sur un compte en litige est le pire endroit (§3 —
                    un trafic inhabituel rend un blocage définitif). On l'amène en
                    UN tap sur la commande Vinted, où Vinted fabrique l'étiquette,
                    et on dit clairement ce que VRM fait et ne fait pas. Le lien
                    de commande est celui déjà utilisé par le bouton bordereau. */}
                {st.retour && (
                  <div className="vrm-buy-retour">
                    <Bouton variante="secondaire" href={`https://www.vinted.fr/member/transactions/${encodeURIComponent(o.transaction_id)}`} target="_blank" rel="noreferrer">↩ Bordereau de retour ↗</Bouton>
                    <div style={{fontSize:12,color:C.muted,marginTop:4,lineHeight:1.4}}>Litige : l'étiquette de retour se génère sur Vinted.</div>
                  </div>
                )}
              </div>
              {/* Prix à deux décimales et une virgule (jamais « 21.0 € » brut). */}
              <div className="vrm-buy-price" style={{color:C.text}}>{montant(montantCommande(o), { devise: o.price?.currency_code || 'EUR' })}</div>
              {/* Actions rapides : suivre · code en accès direct ; le reste dans un
                  menu « … » (attestations, étiquette SKU, note interne, masquer). */}
              {(() => {
                const tid = String(o.transaction_id || '');
                const note = achatNotes[tid] || '';
                const rembourse = /annul|rembours|refus|retour|cancel|refund/i.test(String(o.status || '') + ' ' + String((o.status_title||'')));
                // FICHE À L'ARRIVÉE (G11) : quand la paire achetée ARRIVE (à
                // retirer / reçue), elle est prête à remettre en vente. Le seul
                // pont honnête vers la revente est de reporter le PRIX PAYÉ vers
                // le numérotage (G1 le redemande à ce moment-là). On ne relie
                // RIEN automatiquement (§5) : il la renumérote/rephotographie.
                const arrive = st.step>=3 && !cancelled && !st.retour;
                const prixPaye = montantCommande(o).toFixed(2).replace('.',',');
                const peutSuivre = !!(suivi && (st.step===2||st.step===3));
                const peutCode = !!(st.step===3 && tk && (qrImage(tk)||codeRetrait(tk.code)));
                const item = { display:'flex',alignItems:'center',gap:10,width:'100%',textAlign:'left',border:'none',background:'transparent',color:C.text,fontSize:15,fontWeight:500,padding:'0 14px',minHeight:44,cursor:'pointer',fontFamily:'inherit',textDecoration:'none',boxSizing:'border-box' };
                const close = () => setAchatMenu(null);
                return (
              <div className="vrm-buy-act">
                {note && <button className="vrm-icon-control vrm-buy-quick" type="button" onClick={()=>setNoteEdit({tid,title:o.title,val:note})} title={`Note : ${note}`} aria-label="Note interne" style={{color:C.accentTexte}}><Icon name="doc" size={15}/></button>}
                {peutSuivre && (
                  <a className="vrm-buy-quick" href={trackUrl(tk.carrier||'', suivi)} target="_blank" rel="noreferrer" title={`Suivre le colis (${carrierName(tk.carrier)} n°${suivi})`} aria-label="Suivre le colis" style={{color:C.muted}}><Icon name="truck" size={16}/></a>
                )}
                {peutCode && (
                  <button className="vrm-icon-control vrm-buy-quick" type="button" onClick={()=>openQrView(tk)} title="Code de retrait" aria-label="Code de retrait" style={{color:C.warn}}><Icon name="key" size={16}/></button>
                )}
                <button className="vrm-icon-control vrm-buy-more" type="button" onClick={()=>setAchatMenu(m=>m===tid?null:tid)} title="Code de retrait, suivi, note, reçu d’achat, étiquette" aria-label="Plus d’actions pour cet achat" aria-haspopup="menu" style={{color:achatMenu===tid?C.accent:C.muted,background:achatMenu===tid?`${C.accent}12`:'transparent'}}>⋯</button>
                {achatMenu===tid && (<>
                  <div onClick={close} style={{position:'fixed',inset:0,zIndex:40}}/>
                  <div role="menu" className="vrm-buy-menu" style={{background:C.card,border:`1px solid ${C.border}`,boxShadow:C.shadowLg||'0 8px 24px rgba(0,0,0,.18)'}}>
                    {peutCode && <button type="button" role="menuitem" className="vrm-buy-menu-tel" style={item} onClick={()=>{ close(); openQrView(tk); }}><Icon name="key" size={15} style={{color:C.muted}}/>Code de retrait</button>}
                    {peutSuivre && <a role="menuitem" className="vrm-buy-menu-tel" href={trackUrl(tk.carrier||'', suivi)} target="_blank" rel="noreferrer" style={item} onClick={close}><Icon name="truck" size={15} style={{color:C.muted}}/>Suivre le colis</a>}
                    {arrive && <button type="button" role="menuitem" data-copier-prix={prixPaye} style={item} onClick={async ()=>{ close(); try { await navigator.clipboard.writeText(prixPaye); toast(`Prix payé copié : ${prixPaye}\u00a0€ — colle-le au numérotage`); } catch(_) { toast('Copie impossible','error'); } }}><Icon name="cash" size={15} style={{color:C.muted}}/>Copier le prix payé (pour le numérotage)</button>}
                    <button type="button" role="menuitem" style={item} onClick={()=>{ close(); setNoteEdit({tid,title:o.title,val:note}); }}><Icon name="doc" size={15} style={{color:C.muted}}/>{note?'Modifier la note interne':'Ajouter une note interne'}</button>
                    {/* (11 nov.) « Me le rappeler » : par le n° de transaction de l'achat (§5). */}
                    <BoutonRappel variante="menu" style={item} avant={close} cible={{ sorte: 'achat', tx: String(o.transaction_id || ''), num: numA || '', plat: 'vinted' }} libelle={numA ? `N°${numA} · ${o.title || ''}` : (o.title || '')}/>
                    <button type="button" role="menuitem" style={item} onClick={()=>{ close(); if(rc){ setReceiptView(rc); } else generateAchatJustificatif(o,{ account:accNameOf(o._acc), regime:load('vinted_regime','micro'), numero:numA||'' }); }}><Icon name="receipt" size={15} style={{color:C.muted}}/>{rc?NOM_RECU_ACHAT:'Attestation d\'achat'}</button>
                    {rembourse && <button type="button" role="menuitem" style={item} onClick={()=>{ close(); generateRemboursementAttestation(o,{ account:accNameOf(o._acc) }); }}><Icon name="receipt" size={15} style={{color:C.muted}}/>Attestation de remboursement</button>}
                    {(()=>{ const cf = cleFacture('tx', o.transaction_id); if (!cf) return null; const a = !!(facturesAchat.factures && facturesAchat.factures[cf]);
                      return <button type="button" role="menuitem" data-achat-joindre-facture={tid} style={item} onClick={()=>{ close(); facturesAchat.choisir(cf); }}><Icon name="doc" size={15} style={{color:C.muted}}/>{a?'Remplacer la facture':'Joindre une facture'}</button>; })()}
                    {modeleSur('', o.title||'') && <button type="button" role="menuitem" data-achat-revente={tid} style={item} onClick={()=>{ close(); setReventeVue({ titre: String(o.title||'') }); }}><Icon name="chart" size={15} style={{color:C.muted}}/>Revendu combien ?</button>}
                    {numA && <button type="button" role="menuitem" style={item} onClick={()=>{ close(); generateEtiquetteSku(numA,{ title:o.title, transaction_id:o.transaction_id }); }}><Icon name="tag" size={15} style={{color:C.muted}}/>Étiquette N°{numA}</button>}
                    <div style={{height:1,background:C.border,margin:'4px 0'}}/>
                    <button type="button" role="menuitem" data-achat-masquer={tid} style={{...item,color:C.muted}} onClick={()=>{ close(); masquerAchat(o); }}><Icon name="eyeOff" size={15} style={{color:C.muted}}/>Masquer cet achat</button>
                  </div>
                </>)}
              </div>
                );
              })()}
            </div>
            </React.Fragment>
          );})}
        </div>
          </>); })()}
        {/* ⚠️ MÊME RÈGLE QUE LES VENTES : on dessine une tranche, le bouton
            porte le TOTAL, rien n'est caché. Mesuré : l'onglet « Tous »
            faisait 72 880 px sur iPhone — quatre-vingt-six écrans. */}
        {achatsAffiches.length > achatsMax && (
          <Bouton variante="secondaire" plein onClick={()=>setAchatsMax(n=>n+120)} style={{marginTop:10}}>
            {achatsAffiches.length - achatsMax <= 120 ? `Voir les ${achatsAffiches.length - achatsMax} derniers` : 'Voir plus'} — {achatsMax} affichés sur {achatsAffiches.length.toLocaleString('fr-FR')}
          </Bouton>
        )}
        {/* (26 oct.) Les reçus par email sont une archive, pas le geste du jour :
            sous la liste, plus en tête (une carte « · 0 » poussait les colis vers le bas). */}
        {/* (31 oct., soir) Les reçus d'achat : sur « Achats », pas sur « Colis à retirer ». */}
        {!modeRetraits && <div className="vrm-achats-recus-bas"><RecusEmail recus={recusAchat} autres={nonRecusAchat} relies={recusRelies && { ...recusRelies, nomsKo: recusRelies.ko.map((u) => { const a = (accounts || []).find((x) => String(x.vinted_user_id) === u); return a ? accNameOf(a) : `#${u}`; }) }} nom={NOM_RECU_ACHAT} onOuvrir={r=>setReceiptView(r)} onActualiser={()=>{setAchEmails(undefined);fetchEmailAchats().then(setAchEmails);}}/></div>}
      </div>/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧
import { trierSerie, resumeSerie, csvDe } from '../selectionSerie.js';
// ⟦← App.jsx #2⟧
import RecusEmail from "../RecusEmail.jsx";
// ⟦← App.jsx #5⟧
import { FRAICHEUR_ACHATS_J } from '../fraicheur.js';
// ⟦← App.jsx #6⟧
import AlerteRelaisChange from "../AlerteRelaisChange.jsx";
// ⟦← App.jsx #7⟧
import LigneGlissable from "../LigneGlissable.jsx";
// ⟦← App.jsx #8⟧
import { AchatsEnDouble } from '../AchatsEnDouble.jsx';
// ⟦← App.jsx #9⟧   // (10 nov., lot AN) facture d'achat jointe
import { cleFacture } from "../factureAchat.js";
// ⟦← App.jsx #3⟧
const AchatsOutils = aLaDemande(() => import('../AchatsOutils.jsx'));
// (11 nov.) « Tes meilleures sources » dans Achats (src/MeilleuresSources.jsx, la même carte qu'Argent).
const MeilleuresSources = aLaDemande(() => import('../MeilleuresSources.jsx'));
// ⟦← App.jsx #4⟧
const AchatsHorsPlateforme = aLaDemande(() => import('../ecrans/Achats.jsx').then((m) => ({ default: m.AchatsHorsPlateforme })));
// ⟦← App.jsx #10⟧
// ⟦→ coeur/VueVentes.jsx #13⟧
// ⚠️ LA MÊME RÈGLE À LA LECTURE (leçon §5.37).
// Les emails déjà en base n'ont pas de champ `famille` — ils ne seront jamais
// réécrits. Sans cette copie côté app, le compteur continuerait d'annoncer
// « 28 emails non compris » alors que 27 sont des évaluations, des newsletters
// et les emails que Julien envoie lui-même à Vinted.
// ⚠️ Copie EXACTE de `familleConnue` (api/email-inbound.js), vérifiée par
// scripts/audit-email-formes.cjs — deux règles qui divergent, c'est deux
// chiffres qui se contredisent (§11).
const familleEmail = (subject, from) => {
  const s = String(subject || ''), f = String(from || '');
  if (/laiss[ée] une [ée]valuation|^Laisse une [ée]valuation/i.test(s)) return 'évaluation';
  if (/Commande mise [àa] jour/i.test(s)) return 'commande mise à jour (le statut vient de la moisson)';
  if (/a mis en ligne un nouvel article/i.test(s)) return "nouvel article d'un membre suivi";
  if (/Demande de motivation|Contestation formelle|DEMANDE URGENTE|r[ée]examen humain|MISE EN DEMEURE|intervention humaine|contestation/i.test(s)) return 'ton propre e-mail envoyé à Vinted';
  if (/transfert bancaire|virement bancaire/i.test(s)) return 'virement du porte-monnaie vers ta banque';
  if (/@team\.vinted|newsletter/i.test(f) || /rentr[ée]e|d[ée]couvre|inspire|nouveaut[ée]s/i.test(s)) return 'newsletter Vinted';
  if (/bienvenue|confirme ton adresse|mot de passe/i.test(s)) return 'e-mail de compte Vinted';
  if (/^Suppression de vos annonces/i.test(s) && /leboncoin/i.test(f + ' ' + s)) return 'annonce Leboncoin supprimée';
  return '';
};
// ⟦← App.jsx #11⟧
const fetchEmailsIncompris = async () => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.email_inconnu_*&select=id,subject:meta->>subject,from:meta->>from,forme:meta->>forme,raison:meta->>raison,famille:meta->>famille,at:meta->>receivedAt&limit=200`, { headers: sbAuth() });
    if (!r.ok) return [];
    const rows = await r.json();
    return rows.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  } catch (_) { return []; }
};
// ⟦← App.jsx #12⟧
// ── CE QU'ON FAIT EN ARRIVANT À CE POINT-LÀ (une seule règle, §11) ──────────
// Julien : « sépare les différents endroits pour bien savoir où je vais ». Un
// point relais, c'est une destination ET un geste : au comptoir on donne un
// code, à la consigne on tape deux nombres, chez Chronopost on scanne. Écrire
// le geste SUR la destination évite de relire le logo de chaque ligne.
// ⚠️ Dérivé de `retraitMode` (§28), jamais d'une règle parallèle.
const methodeDuPoint = (colis) => {
  const l = colis || [];
  if (l.some(t => t && (t.consigne || codeRetrait(t.code2)))) {
    return { cle: 'casier', titre: 'Consigne automatique', geste: "Tape l'identifiant puis le code d'ouverture sur le casier" };
  }
  const modes = l.map(t => retraitMode(t).mode);
  if (modes.includes('qr') && !modes.includes('code')) return { cle: 'qr', titre: 'Au comptoir', geste: 'Présente le QR de chaque colis' };
  if (modes.includes('qr')) return { cle: 'mixte', titre: 'Au comptoir', geste: 'QR pour certains colis, code pour les autres' };
  if (modes.includes('code')) return { cle: 'code', titre: 'Au comptoir', geste: 'Donne le code de retrait + une pièce d\'identité' };
  if (modes.includes('home')) return { cle: 'home', titre: 'Livré chez toi', geste: 'Rien à retirer' };
  return { cle: 'numero', titre: 'Au comptoir', geste: 'Donne ton numéro de colis + une pièce d\'identité' };
};
// ⟦← App.jsx #13⟧

// Petit helper partagé : télécharge des octets PDF.
const _telechargerPdf = (bytes, nom) => {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

// ── ÉTIQUETTE SKU ───────────────────────────────────────────────────────────
// Julien (Actions rapides) : une petite étiquette à coller, avec le N° en gros.
// Format sticker 100×60 mm (283×170 pt). Le N° domine ; titre + transaction
// dessous pour la retrouver. Rien d'inventé : si pas de N°, on ne génère pas.
// ── ATTESTATION DE REMBOURSEMENT ────────────────────────────────────────────
// Julien (Actions rapides) : un document à part pour un achat remboursé/annulé.
// SÉPARÉ du reçu d'achat (protégé par audit-justificatif.cjs) : on ne touche pas
// au document du comptable. Même garde : ce n'est PAS une facture Vinted.
const generateRemboursementAttestation = async (o, opts = {}) => {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 520]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();
  const G = rgb(0.45, 0.45, 0.45), N = rgb(0.1, 0.1, 0.1);
  let y = height - 44;
  const ents = load('vinted_entreprises', []);
  const actif = load('vinted_entreprise_active', '');
  const ent = (Array.isArray(ents) && ents.length) ? (ents.find(e => e && String(e.id) === String(actif)) || ents[0]) : load('vinted_invoice_settings', null);
  const qui = [ent && ent.companyName, ent && ent.companyType].filter(Boolean).join(' ');
  page.drawText('Attestation de remboursement', { x: 32, y, size: 18, font: bold, color: N }); y -= 16;
  page.drawText(qui || opts.account || 'Achat de marchandise', { x: 32, y, size: 10, font: reg, color: G }); y -= 24;
  page.drawRectangle({ x: 32, y, width: 356, height: 2, color: rgb(0.9, 0.9, 0.9) }); y -= 24;
  const line = (label, val, big) => {
    page.drawText(label, { x: 32, y, size: 9, font: reg, color: G });
    page.drawText(String(val == null ? '—' : val), { x: 32, y: y - 15, size: big ? 15 : 12, font: big ? bold : reg, color: N });
    y -= 38;
  };
  line('Article', (o.title || '—').slice(0, 54));
  line('Date d\'achat', o.date ? dateFr(o.date) : '—');
  line('N° de transaction Vinted', o.transaction_id || '—');
  line('Vendeur', o.seller || o.user_login || (o.opposite_user && o.opposite_user.login) || '—');
  line('Montant remboursé', o.price && o.price.amount != null ? `${Number(o.price.amount).toFixed(2).replace('.', ',')} ${o.price.currency_code === 'EUR' ? '€' : (o.price.currency_code || '')}` : '—', true);
  line('Compte acheteur', opts.account || '—');
  y -= 4;
  const notes = [
    'Attestation d\'un achat annule ou retourne, rembourse par Vinted.',
    'Recapitulatif etabli par VRM d\'apres les donnees de la commande Vinted. Ce n\'est pas une facture emise par Vinted.',
    'Etabli le ' + new Date().toLocaleDateString('fr-FR') + '.',
  ];
  notes.forEach(n => { page.drawText(n.slice(0, 74), { x: 32, y, size: 8, font: reg, color: G }); y -= 13; });
  _telechargerPdf(await pdf.save(), `attestation-remboursement-${o.transaction_id || 'achat'}.pdf`);
};

const generateEtiquetteSku = async (num, o = {}) => {
  const n = String(num || '').trim();
  const titre = (o.title || '').slice(0, 60);
  // ⚠️ Julien (1er oct.) : « même s'il n'y a pas encore le numéro, place quand
  //    même le TITRE en attendant ». Sans N° ET sans titre, rien à coller.
  if (!n && !titre) return;
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const W = 283, H = 170;
  const page = pdf.addPage([W, H]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const N = rgb(0.08, 0.08, 0.08), G = rgb(0.4, 0.4, 0.4);
  if (n) {
    page.drawText('N°', { x: 18, y: H - 46, size: 16, font: reg, color: G });
    const big = String(n);
    page.drawText(big, { x: 18, y: 54, size: big.length > 5 ? 56 : 72, font: bold, color: N });
    if (titre) page.drawText(titre.slice(0, 42), { x: 18, y: 32, size: 10, font: reg, color: G });
  } else {
    // Pas encore de numéro : le TITRE devient le repère principal.
    page.drawText('En attente de numéro', { x: 18, y: H - 40, size: 11, font: reg, color: G });
    const t = titre.length > 26 ? titre.slice(0, 26) : titre;
    page.drawText(t, { x: 18, y: 76, size: t.length > 18 ? 20 : 26, font: bold, color: N });
    if (titre.length > 26) page.drawText(titre.slice(26, 54), { x: 18, y: 52, size: 14, font: bold, color: N });
  }
  if (o.transaction_id) page.drawText('tx ' + String(o.transaction_id), { x: 18, y: 16, size: 8, font: reg, color: G });
  page.drawRectangle({ x: 4, y: 4, width: W - 8, height: H - 8, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  _telechargerPdf(await pdf.save(), `etiquette-${n || 'titre'}.pdf`);
};
// ⟦← App.jsx #14⟧
function ExtEnRetard({ onNav }) {
  const [ext, setExt] = useState(() => ({ on: vmrExtPresent(), v: vmrExtVersion() }));
  useEffect(() => onVmrExt(() => setExt({ on: vmrExtPresent(), v: vmrExtVersion() })), []);
  // ⚠️ ET LE BANDEAU DOIT S'AFFICHER AUSSI QUAND ELLE NE DIT PAS SA VERSION :
  // le pont l'annonce depuis la 5.26, donc se taire veut dire « plus vieille
  // que ça ». `extEnRetard` exigeait `!!v` : l'extension la plus en retard
  // était précisément la seule à ne rien déclencher.
  const muette = ext.on && !ext.v;
  if (!extEstEnRetard(ext)) return null;
  // (8 nov.) La fiche de la boutique de CE navigateur, si elle est publiée
  // (`installerExtensionIci`, LIENS_BOUTIQUES) : installée de là, l'extension
  // se met ensuite à jour TOUTE SEULE. Sinon, le zip et ses gestes, comme avant.
  const inst = installerExtensionIci();
  if (inst.boutique) return (
    <Notice tone="warn" icon="alert"
      title="Ton extension VRM est en retard"
      value={muette ? `? → ${EXT_ATTENDUE}` : `${ext.v} → ${EXT_ATTENDUE}`}
      desc={`Installe-la depuis ${inst.nomBoutique} : ensuite, elle se met à jour toute seule.`}
      detail={`1. Ouvre la fiche ${inst.nomBoutique} ci-contre et ajoute VRM à ton navigateur. Si elle vient déjà de la boutique, la nouvelle version arrive toute seule dès que la boutique l'a validée. 2. Sur la page des extensions (${pageExtensionsIci()}), retire l'ancienne copie installée à la main : deux extensions VRM dans un même navigateur, l'app coupe les commandes. 3. Recharge une page Vinted.`}
      action={<a href={inst.lien} target="_blank" rel="noreferrer" data-ext-boutique={inst.nav}
        style={{display:'inline-block',border:'none',background:C.warn,color:C.onWarn||'#fff',borderRadius:12,padding:'9px 15px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',textDecoration:'none'}}>
        Ouvrir la boutique
      </a>}
      style={{marginBottom:14}}/>
  );
  return (
    <Notice tone="warn" icon="alert"
      title="Ton extension VRM est en retard"
      value={muette ? `? → ${EXT_ATTENDUE}` : `${ext.v} → ${EXT_ATTENDUE}`}
      desc="Elle capte toujours, mais moins que ce que l'app attend — et elle ne le dit pas d'elle-même. C'est elle qui va chercher les codes de retrait dans tes conversations Vinted."
      /* ⚠️ LES DEUX GESTES, ET DANS CET ORDRE — MESURÉ (11 octobre).
         · ⟳ SEUL ne suffit pas : la flèche ronde recharge le DOSSIER du disque,
           donc la même vieille version tant qu'on ne l'a pas remplacé (c'est
           ce qui l'a bloqué des semaines en août-septembre).
         · Remplacer le dossier SEUL ne suffit pas non plus : Chrome garde
           l'ANCIEN code en mémoire — mesuré chez lui, 5 Chrome sur 6
           exécutaient une 5.95–5.129 sous un manifeste « 5.164 » — tant qu'on
           n'a pas cliqué ⟳, et SEULEMENT dans le Chrome où on le clique. Il a
           un Chrome (un profil) par compte Vinted : ⟳ dans CHACUN. */
      detail={"1. Télécharge le zip ci-contre. 2. Dézippe-le : tu obtiens un dossier « VRM-extension » — mets-le à la place de l'ancien, au même endroit et avec le même nom. 3. PUIS, dans CHAQUE navigateur où l'extension est installée (chaque profil) : ouvre sa page des extensions (chrome://extensions sur Chrome), garde une seule carte VRM, et recharge-la (⟳ sur Chrome) — sinon le navigateur garde l'ancien code. 4. Recharge une page Vinted : la capture repart avec la nouvelle version."}
      action={<a href={`/VRM-extension.zip?v=${EXT_ATTENDUE}`} download
        style={{display:'inline-block',border:'none',background:C.warn,color:C.onWarn||'#fff',borderRadius:12,padding:'9px 15px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',textDecoration:'none'}}>
        Télécharger la {EXT_ATTENDUE}
      </a>}
      style={{marginBottom:14}}/>
  );
}
// ⟦← App.jsx #15⟧
// Un compte qui a vendu SANS email, mais pas assez pour conclure : sa phrase à
// lui, tirée de la donnée (jamais « n'a pas encore vendu » — revue du 11 oct.).
const phraseCompteSurveille = (l) => {
  const s = (k) => (k > 1 ? 's' : '');
  if (l.raisonSurveiller === 'aucunDebut') return 'VRM n’a encore reçu aucun e-mail — rien à conclure';
  if (l.raisonSurveiller === 'peu') return `${l.nSansEmail} vente${s(l.nSansEmail)} sans e-mail depuis le ${dateCourteFr(l.premiereSansEmail)}${l.nRecentes ? ` (+ ${l.nRecentes} récente${s(l.nRecentes)})` : ''} — pas encore de quoi conclure`;
  return `${l.nRecentes} vente${s(l.nRecentes)} de moins de 3 jours — ${l.nRecentes > 1 ? 'leur' : 'son'} e-mail peut encore arriver`;
};
// ⟦← App.jsx #16⟧
function MuetsCompact({ muets, detail }) {
  const [ouvert, setOuvert] = useState(false);
  const n = muets.length;
  return (
    <details data-muets-compact={n} style={{marginBottom:10}} onToggle={(e) => setOuvert(e.currentTarget.open)}>
      <summary style={{cursor:'pointer',listStyle:'none',display:'flex',alignItems:'center',gap:7,fontSize:12,fontWeight:600,color:C.text,padding:'6px 10px',border:`1px solid ${C.warn}`,borderLeft:`3px solid ${C.warn}`,background:`${C.warn}10`,borderRadius:12}}>
        <span aria-hidden="true" style={{color:C.warn,display:'flex'}}><Icon name="alert" size={14}/></span>
        <span style={{flex:1,minWidth:0}}>{ouvert ? 'Masquer' : <>{n} compte{n>1?'s':''} n’envoie{n>1?'nt':''} aucun e-mail à VRM — voir {n>1?'lesquels':'lequel'} et le geste</>}</span>
        <span aria-hidden="true" style={{color:C.muted}}>{ouvert ? '▴' : '▾'}</span>
      </summary>
      <div style={{marginTop:6}}><BlocComptesMuets muets={muets}/></div>
      <details style={{marginTop:6}}>
        <summary style={{cursor:'pointer',fontSize:12,color:C.muted}}>Le détail : transporteurs et comptes</summary>
        <div style={{marginTop:8,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'10px 12px'}}>{detail}</div>
      </details>
    </details>
  );
}
function ReceptionEmails({ tracking, comptes, colisParTransporteur }) {
  const [incompris, setIncompris] = useState(null);
  const etatComptes = useEtatEmailsComptes(comptes);
  useEffect(() => {
    let mort = false;
    fetchEmailsIncompris().then(r => { if (!mort) setIncompris(r); });
    return () => { mort = true; };
  }, []);
  const lignes = useMemo(() => {
    const m = {};
    for (const t of (tracking || [])) {
      const k = carrierKey(t && t.carrier) || 'autre';
      const d = t && t.receivedAt ? Date.parse(t.receivedAt) : NaN;
      if (isNaN(d)) continue;
      if (!m[k] || d > m[k].ts) m[k] = { ts: d, n: (m[k] ? m[k].n : 0) + 1 };
      else m[k].n += 1;
    }
    for (const k of ['chronopost', 'mondialrelay', 'vinted']) if (!m[k]) m[k] = { ts: 0, n: 0 };
    return Object.entries(m).sort((a, b) => b[1].ts - a[1].ts);
  }, [tracking]);
  const age = (ts) => {
    if (!ts) return null;
    const h = (Date.now() - ts) / 3600000;
    return h < 1 ? "à l'instant" : h < 24 ? `il y a ${Math.round(h)} h` : `il y a ${Math.round(h / 24)} j`;
  };
  // ⚠️ « Non compris » doit vouloir dire quelque chose. Les familles reconnues
  // sans action (évaluations, newsletters, « commande mise à jour », les emails
  // que Julien envoie lui-même à Vinted) sont comptées à part : sinon le
  // compteur crie au loup et on cesse de le regarder.
  const vraimentInconnus = useMemo(() => (incompris || []).filter(e => !String(e.famille || '').trim() && !familleEmail(e.subject, e.from)), [incompris]);
  const nInc = vraimentInconnus.length;
  const nConnus = (incompris ? incompris.length : 0) - nInc;
  // Un compte MUET, sur preuve : des ventes captées qui n'ont eu aucun email
  // depuis son dernier signe de vie (`etatEmailsComptes`). « Aucun email » seul
  // ne prouve rien — un compte qui n'a rien vendu n'avait rien à recevoir.
  const muets = etatComptes.muets;
  // ⚠️⚠️ « ON LES ATTEND » N'EST PAS VRAI LE PREMIER JOUR. Vu au rendu le
  //    16 septembre sur une installation neuve : « Réception des emails ·
  //    3 transporteurs silencieux », en ambre, avec trois « aucun email reçu »
  //    en rouge — à quelqu'un qui vient de créer son compte et n'a encore rien
  //    acheté. Rien ne se tait : rien n'a commencé. Une fausse alerte est ce
  //    qui fait cesser de lire les vraies (leçon du panneau de sécurité et du
  //    compte exclu). Trois états, jamais deux : jamais rien reçu · certains
  //    muets · tout arrive.
  // ⚠️ §4.6 : `detail` est un élément JSX construit IMMÉDIATEMENT, et il lit
  //    cette valeur — posée plus bas, l'écran Achats mourait sur « Cannot
  //    access before initialization ». C'est le RENDU qui l'a vu, pas le build.
  const aucunEmailDeSuivi = lignes.every(([, v]) => !v.ts);
  const ligne = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 };
  // Le DÉTAIL (transporteurs + comptes, un par ligne) : c'est la preuve, pas
  // l'alerte. Il vit derrière un dépliant dans les deux cas, pour que l'écran
  // Achats commence par les colis et non par un tableau de diagnostic.
  const detail = (
    <>
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        {lignes.map(([k, v]) => {
          const nColis = (colisParTransporteur && colisParTransporteur[k]) || 0;
          return (
            <div key={k} style={ligne}>
              <CarrierBadge carrier={k} size={18}/>
              <div style={{flex:1,minWidth:0,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {carrierName(k)}
                {nColis>0 && <b style={{color:C.accentTexte}}> · {nColis} colis à retirer</b>}
              </div>
              <div style={{color:v.ts?(Date.now()-v.ts<3*86400000?(C.ok||C.accent):C.warn):(aucunEmailDeSuivi?C.muted:C.danger),fontWeight:600,flexShrink:0,textAlign:'right'}}>
                {v.ts ? `${v.n} email${v.n>1?'s':''} · ${age(v.ts)}` : aucunEmailDeSuivi ? 'rien encore' : 'aucun e-mail reçu'}
              </div>
            </div>
          );
        })}
      </div>
      {comptes && comptes.length > 0 && (
        <div style={{marginTop:9,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:5}}>Tes comptes Vinted et leurs e-mails</div>
          {etatComptes.etat === 'encours' && <div style={{fontSize:11,color:C.muted}}>lecture en cours…</div>}
          {etatComptes.etat === 'pasSu' && <div style={{fontSize:11,color:C.muted}}>E-mails reçus pas lus : rien dit des comptes. Rouvre dans un moment.</div>}
          {etatComptes.etat === 'lu' && (
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {/* ⚠️ §7 (revue du 11 oct.) : un compte déjà nommé dans le bloc
                  au-dessus n'est pas redit ici. */}
              {etatComptes.lignes.filter(l => !(muets.length && l.statut === 'muet')).map(l => {
                const ts = l.last ? Date.parse(l.last) : NaN;
                // ⚠️ Plus de rouge (§7 : le rouge est pour deux paires sous un
                //    même numéro). Ambre seulement pour un compte PROUVÉ muet.
                const coul = l.statut === 'muet' ? C.warn
                  : l.statut === 'recoit' ? (!isNaN(ts) && Date.now()-ts<7*86400000 ? (C.ok||C.accent) : C.muted)
                  : C.muted;
                const txt = l.statut === 'muet' ? (l.jamais ? 'aucun e-mail, jamais' : `plus rien depuis le ${dateCourteFr(l.depuis)}`)
                  : l.statut === 'recoit' ? `${l.n} email${l.n>1?'s':''}${isNaN(ts)?'':' · '+age(ts)}`
                  : l.statut === 'surveiller' ? phraseCompteSurveille(l)
                  : l.statut === 'exclu' ? 'exclu de l’app — non vérifié'
                  : l.statut === 'calme' ? 'aucun e-mail pour l’instant'
                  : l.statut === 'encours' ? '…' : '—';
                return (
                  <div key={l.uid} data-compte-email={l.login} data-statut={l.statut} style={{...ligne,fontSize:12,flexWrap:'wrap'}}>
                    <div style={{flex:'1 1 110px',minWidth:0,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.login}</div>
                    <div style={{flex:'0 1 auto',minWidth:0,fontWeight:600,color:coul,textAlign:'right'}}>{txt}</div>
                  </div>
                );
              })}
              {muets.length > 0 && (
                <div style={{fontSize:11,color:C.muted}}>+ {muets.length} compte{muets.length>1?'s':''} nommé{muets.length>1?'s':''} au-dessus.</div>
              )}
              {/* La phrase vient de la MÊME source que le statut (§5) : « calme »
                  = aucune vente depuis le début de la réception. */}
              {etatComptes.lignes.some(l => l.statut === 'calme') && (
                <div style={{fontSize:11,color:C.muted,marginTop:2}} data-note-calme>« Aucun e-mail pour l’instant » n’est pas une panne : {etatComptes.lignes.filter(l => l.statut === 'calme').length > 1 ? 'ces comptes n’ont rien vendu' : 'ce compte n’a rien vendu'}{etatComptes.debut ? ` depuis le ${dateCourteFr(etatComptes.debut)}, premier e-mail reçu par VRM` : ''} — rien n’avait à arriver.</div>
              )}
            </div>
          )}
        </div>
      )}
      {nInc>0 && (
        <div style={{marginTop:9,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:4}}>{nInc} email{nInc>1?'s':''} que l'app n'a pas su classer</div>
          {vraimentInconnus.slice(0,4).map(e=>(
            <div key={e.id} style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {(e.at||'').slice(0,16).replace('T',' ')} · {e.subject || '(sans sujet)'}
            </div>
          ))}
          <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:4}}>Ils sont conservés entiers — rien n'est perdu.</div>
        </div>
      )}
      {nInc===0 && nConnus>0 && (
        <div style={{fontSize:11,color:C.muted,marginTop:9,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
          {nConnus} email{nConnus>1?'s':''} reconnu{nConnus>1?'s':''} sans action à faire (évaluations, newsletters, mises à jour de commande).
        </div>
      )}
    </>
  );
  const muetsTr = aucunEmailDeSuivi ? 0 : lignes.filter(([, v]) => !v.ts).length;
  const probleme = muets.length > 0 || nInc > 0;
  // ── QUAND QUELQUE CHOSE CLOCHE : on le NOMME, avec le geste à faire.
  //    Un compte muet est le cas grave : ses codes de retrait n'arrivent jamais.
  if (probleme) {
    if (muets.length > 0) {
      // ⚠️ REVUE DU 11 OCTOBRE : déplié d'office, ce bloc faisait 312 px à
      //    390 px (125 avant) et repoussait les colis que personne n'est venu
      //    chercher — de l'argent perdu — sous une information de configuration
      //    qu'on règle une fois. Dans Achats : UNE ligne, qui s'ouvre sur le bloc
      //    complet (Réglages → Notifications le garde en entier).
      // (Ne pas écrire ici le titre exact de ce bloc-là : `audit-retrait` le
      //  trouve par sa première occurrence dans le fichier.)
      return <MuetsCompact muets={muets} detail={detail}/>;
    }
    return (
      <Notice tone="warn" icon="alert"
        value={nInc}
        title={`e-mail${nInc>1?'s':''} pas classé${nInc>1?'s':''}`}
        desc="Conservés entiers, rien n’est perdu — aucune action tirée."
        detail={detail}/>
    );
  }
  // ⚠️ (revue du 23 oct.) Les e-mails de suivi PAS LUS (lecture ratée ou en
  // cours) ne sont pas « aucun e-mail de suivi reçu » : « pas su » ne vaut pas
  // « rien » (§4.1). L'écran Achats dit la panne une fois, avec « Réessayer ».
  if (!Array.isArray(tracking)) return null;
  // ── QUAND TOUT VA BIEN : une ligne, pas un tableau. Le détail reste à un clic.
  return (
    <details style={{marginBottom:10}}>
      <summary className="vrm-reception-sum" style={{listStyle:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:7,fontSize:12,color:C.muted,padding:'2px 0'}}>
        {/* ⚠️ Ni triangle ambre (rien ne cloche), ni coche verte (rien n'est
            confirmé non plus) : gris, comme une sonde qui n'a pas encore de
            quoi répondre. */}
        <span aria-hidden="true" style={{color:muetsTr?C.warn:aucunEmailDeSuivi?C.muted:(C.ok||C.accent),display:'flex'}}><Icon name={muetsTr?'alert':aucunEmailDeSuivi?'clock':'check'} size={14}/></span>
        Réception des e-mails{muetsTr>0 ? ` · ${muetsTr} transporteur${muetsTr>1?'s':''} silencieux`
          : aucunEmailDeSuivi ? ' · aucun e-mail de suivi reçu pour l’instant' : ' · tout arrive'}
      </summary>
      <div style={{marginTop:8,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'10px 12px'}}>{detail}</div>
    </details>
  );
}
// ⟦← App.jsx #17⟧
// En tête de la liste des colis, UNE fois chacune (§7) :
//   · la lecture de NOTRE base a raté (`transp === null`) ;
//   · SI LE SERVEUR NE LISAIT PAS Mondial Relay : des colis Mondial Relay sans
//     lecture, et l'extension de CE navigateur ne sait pas le faire (« depuis ton
//     ordinateur, avec l'extension à jour ») — plus jamais dit quand il le lit ;
//   · Mondial Relay REFUSE en ce moment le serveur (`bloque`) : l'extension le
//     lit à la place, depuis l'ordinateur — le geste selon CE navigateur ;
//   · des colis d'un transporteur que VRM ne lit pas (Colissimo, DPD, UPS…).
// `colis` : [{ carrier, suivi }] — les colis de la liste affichée.
function TeteTransporteurs({ transp, colis, relire }) {
  // Sur un téléphone sans extension : le geste se fait sur l'ordinateur.
  const sansSouris = useSansSouris() && !vmrExtPresent();
  if (transp === undefined) return null;
  const liste = Array.isArray(colis) ? colis : [];
  const nonLus = [...new Set(liste.map(x => x && carrierNonLu(x.carrier)).filter(Boolean))];
  const mrServeur = !!LECTURE_SERVEUR_TRANSP.mondialrelay;
  const estMr = x => x && carrierLisible(x.carrier, x.suivi) === 'mondialrelay';
  const mrSans = (transp === null || mrServeur) ? 0 : liste.filter(x => estMr(x) && !ligneTranspDe(transp, x.suivi)).length;
  const mrRefus = (transp === null || !mrServeur) ? 0 : new Set(liste.filter(x => { if (!estMr(x)) return false; const t = ligneTranspDe(transp, x.suivi); return !!t && t.essaiRes === 'bloque'; }).map(x => normaliserSuivi(x.suivi))).size;
  const sait = extSait('transp');
  // (tour 2 n° 12) Ce que l'extension DIT d'elle-même (`nav.indispo` de son état) :
  // la permission des sites des transporteurs refusée (Firefox, Safari avant le
  // clic) ou pas sue — on ne lui promet alors pas de lire à la place du serveur.
  const indispo = (__vmrEtat && __vmrEtat.nav && Array.isArray(__vmrEtat.nav.indispo)) ? __vmrEtat.nav.indispo : [];
  const navTransp = indispo.includes('transporteurs') ? 'permission' : (indispo.includes('transporteurs-passu') ? 'passu' : '');
  const montrerMr = mrSans > 0 && sait !== 'ok';
  // (tour 2 n° 2) Le code postal du point relais qui manque : dit UNE fois ici
  // (la carte n'en garde qu'une mention courte). Un code postal SAISI refusé reste
  // sur sa carte (il la distingue : il nomme le code).
  const cpMr = { cherche: 0, inconnu: 0 };
  if (transp !== null) for (const k of new Set(liste.filter(estMr).map(x => normaliserSuivi(x.suivi)))) {
    const t = ligneTranspDe(transp, k);
    if (!t || t.essaiRes !== 'cp-inconnu' || (t.cpRefuse && t.cpRefuseSource === 'manuel')) continue;
    if (t.cpCherche) cpMr.cherche++; else cpMr.inconnu++;
  }
  const phrasesCp = texteCodePostalMr(cpMr);
  if (transp !== null && !montrerMr && !mrRefus && !nonLus.length && !phrasesCp.length) return null;
  const st = {fontSize:12,color:C.muted,lineHeight:1.45,margin:'0 0 10px'};
  const geste = sansSouris
    ? <>ouvre VRM sur l'ordinateur où est l'extension.</>
    : sait === 'absente'
    ? <>installe ou allume l'extension VRM sur cet ordinateur — c'est elle qui lit Mondial Relay.</>
    : <>mets à jour l'extension VRM (version {EXT_CAPACITES.transp} ou plus récente) : elle lira Mondial Relay depuis {NAV.ce}.</>;
  return <>
    {transp === null && <div data-transp-passu="" style={{...st,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
      <span style={{flex:'1 1 220px'}}>Le statut chez les transporteurs n'a pas pu être relu. Rien n'est perdu.</span>
      {relire && <button type="button" data-transp-reessayer="" onClick={relire} style={{flexShrink:0,border:`1px solid ${C.border}`,background:C.card,color:C.text,borderRadius:12,padding:'0 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minHeight:44}}>Réessayer</button>}
    </div>}
    {montrerMr && <div data-transp-mr={sansSouris ? 'telephone' : sait} data-transp-mr-n={String(mrSans)} style={st}>
      Mondial Relay ne se lit que depuis ton ordinateur, avec l'extension à jour ({mrSans} colis) : {geste}
    </div>}
    {mrRefus > 0 && <div data-transp-mr-refus={sansSouris ? 'telephone' : (sait === 'ok' && navTransp ? navTransp : sait)} data-transp-mr-n={String(mrRefus)} style={st}>
      Mondial Relay refuse en ce moment la lecture du serveur VRM ({mrRefus} colis) : {sait === 'ok' && !sansSouris
        ? (navTransp === 'permission'
          ? <>touche « Autoriser » dans la fenêtre de l'icône VRM.</>
          : navTransp === 'passu'
            ? <>ouvre la fenêtre de l'icône VRM pour vérifier la permission.</>
            : <>l'extension VRM {NAV.de} les lit à la place, depuis ton ordinateur.</>)
        : sansSouris
          ? <>ouvre VRM sur l'ordinateur où elle est installée.</>
          : sait === 'absente'
          // (30 oct.) Sur un ORDINATEUR sans l'extension, « ouvre VRM sur l'ordinateur » ne
          // voulait rien dire : on y est déjà. Le geste est ici.
          ? <>installe ou allume l'extension VRM sur cet ordinateur : elle les lira à la place.</>
          : <>mets à jour l'extension VRM (version {EXT_CAPACITES.transp} ou plus récente) pour qu'elle les lise depuis {NAV.ce}.</>}
    </div>}
    {phrasesCp.map((p, i) => <div key={i} data-transp-cp={/cherche/.test(p) ? 'cherche' : 'inconnu'} data-transp-cp-n={String(/cherche/.test(p) ? cpMr.cherche : cpMr.inconnu)} style={st}>{p}</div>)}
    {nonLus.length > 0 && <div data-transp-non-lu={nonLus.join(',')} style={st}>
      VRM ne lit pas le suivi de {nonLus.join(' ni de ')} : regarde {nonLus.length > 1 ? 'leurs' : 'ses'} e-mails.
    </div>}
  </>;
}
// ⟦← App.jsx #18⟧
// (23 oct.) « AJOUTER UN N° DE SUIVI » — Julien : « enregistrer le numéro de
// suivi et tracer le colis ». Un n° qu'il tape (un colis annoncé hors Vinted,
// un e-mail qui n'est pas arrivé) : le transporteur se lit à la FORME du n°
// (8 chiffres = Mondial Relay ; 2 lettres, 9 chiffres, 2 lettres = Chronopost ;
// « VGS… » = Vinted Go) — ambigu ⇒ on DEMANDE, jamais deviné ; le code postal
// est facultatif (il sert la page Mondial Relay). Rangé UNE ligne par n°
// (`colis_suivi_{transporteur}_{n°}`, au nom du vendeur, lire-fusionner-réécrire
// gardé : une lecture ratée n'écrit rien). Il sert d'IDENTITÉ aux e-mails qui
// arriveront (un « disponible », un « retiré » au même n° se reconnaissent) et
// donne « Suivre ↗ ». Relié à un achat SEULEMENT par son clic.
// ⚠️ Ce n'est JAMAIS un colis « à retirer » : rien ne dit qu'il est arrivé. La
// ligne dit « suivi ajouté — en attente d'une nouvelle » tant qu'aucun e-mail
// au même n° n'est arrivé.
const NOMS_SAISIE = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go', autre: 'Autre transporteur' };
const NOMS_CHOIX = { autre: 'Autre' };   // le segment, à 390 px : quatre libellés tiennent sur la ligne
async function lireLigneSuiviManuel(id) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&select=data`, { headers: sbAuth() });
    if (!r.ok) return undefined;
    const j = await r.json(); if (!Array.isArray(j)) return undefined;
    return (j[0] && j[0].data) || null;
  } catch (_) { return undefined; }
}
async function ecrireSuiviManuel(id, patch) {
  const avant = await lireLigneSuiviManuel(id);
  if (avant === undefined) return { ok: false, msg: "Je n'ai pas pu relire ce suivi — rien n'est enregistré. Réessaie." };
  const data = { ...(avant || {}), ...patch, majAt: new Date().toISOString() };
  if (!data.at) data.at = data.majAt;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
      method: 'POST', headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(withOwner({ id, data })),
    });
    return r.ok ? { ok: true } : { ok: false, msg: "La base n'a pas enregistré ce suivi — réessaie." };
  } catch (_) { return { ok: false, msg: "La base n'a pas répondu — rien n'est enregistré." }; }
}
async function retirerSuiviManuel(id) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: sbAuth() });
    return r.ok;
  } catch (_) { return false; }
}
// La raison d'un colis « à vérifier », dite sur sa ligne ET pour un n° ajouté à
// la main (une phrase, §11).
// (30 oct.) Le compte (et la raison) d'un groupe « à vérifier » UNIFORME se dit une
// fois en tête du groupe ; sur chaque ligne seulement quand le groupe est mixte (§7).
const compteAVCommun = (liste, cptEmail, nomAcc) => {
  if (!Array.isArray(liste) || liste.length < 2) return '';
  const c = liste.map((x) => x.kind === 'email' ? (cptEmail(x.t) || '') : (x.o && x.o._acc ? nomAcc(x.o._acc) : ''));
  return c[0] && c.every((v) => v === c[0]) ? c[0] : '';
};
const raisonAVCommune = (liste) => {
  if (!Array.isArray(liste) || liste.length < 2) return '';
  const r = liste.map(raisonAVerifier);
  return r[0] && r.every((v) => v === r[0]) ? r[0] : '';
};
// ⟦← App.jsx #19⟧
// ── OÙ EN EST UN N° AJOUTÉ À LA MAIN (revue du 24 oct.) ─────────────────────
// La MÊME règle que l'écran (§11) : on regarde dans quelle liste de
// `pickupUnion` le colis de ce n° se trouve — jamais le statut de l'e-mail le
// plus récent seul (un rappel « disponible » reçu APRÈS un « retiré » disait
// « il est dans « à retirer » » d'un colis qui n'y était pas, et un colis au
// délai dépassé, dans « à vérifier », disait la même chose — §5).
//   · dans `emailList` / `extra` ⇒ « à retirer » ;
//   · dans `aVerifier` ⇒ « à vérifier » (sa raison) ;
//   · dans `repartis` ⇒ reparti chez l'expéditeur ;
//   · fini (retiré sous n'importe quelle clé, `finis`, ou coché « retiré ») ⇒ retiré ;
//   · sinon le statut du dernier e-mail, SANS dire de quelle liste il fait partie.
// `raison(x)` : la raison d'un « à vérifier », la même que celle du bloc.
function etapeDuSuiviManuel(n, { union, fins, tracking, collected, index, raison } = {}) {
  const k = normaliserSuivi(n); if (!k || !union) return null;
  const deLigne = (t) => suiviDeLigne(t) === k;
  const deAchat = (o) => !!o && suivisAchat(o, index || {}).map(normaliserSuivi).includes(k);
  const dans = (x) => x && (x.kind === 'email' ? deLigne(x.t) : deAchat(x.o));
  if ((union.emailList || []).some(deLigne) || (union.extra || []).some(deAchat)) return { ou: 'a-retirer', texte: 'arrivé au point de retrait — il est dans « à retirer »' };
  const av = (union.aVerifier || []).find(dans);
  if (av) return { ou: 'a-verifier', texte: `à vérifier (${raison ? raison(av) : 'à voir'}) — il est dans « colis à vérifier »` };
  if ((union.repartis || []).some(dans)) return { ou: 'reparti', texte: "reparti chez l'expéditeur" };
  const f = fins && fins.get ? fins.get(k) : null;
  const coche = (tracking || []).some((t) => t && deLigne(t) && collected && collected.has(colisKey(t)));
  if ((union.finis || []).includes('e:' + k) || (f && f.retire) || coche || (union.attenteMail || []).some(deLigne) || (union.attente || []).some(deAchat)) return { ou: 'retire', texte: coche ? 'tu l’as coché retiré' : 'retiré' };
  let der = null;
  for (const t of (Array.isArray(tracking) ? tracking : [])) {
    if (!t || !deLigne(t)) continue;
    const d = Date.parse(t.emailAt || t.receivedAt || '') || 0;
    if (!der || d > der.d) der = { d, st: t.status };
  }
  if (!der) return null;
  const mot = ({ available: 'un e-mail « arrivé au point de retrait »', delivered: 'retiré', retour: "reparti chez l'expéditeur", transit: 'en route', info: 'une nouvelle du transporteur' })[der.st] || 'une nouvelle du transporteur';
  return { ou: 'email', texte: mot };
}
// ── LE SUIVI VINTED DES ACHATS, DIT UNE FOIS (§7), ET SA PROMESSE GARDÉE ─────
// (revue du 24 oct.) « L'extension le relève à ta prochaine visite » se disait
// à toute extension 5.214 — non connectée à VRM (la visite s'arrête sans
// session), au code périmé, en double, et pour six colis alors qu'elle n'en lit
// que trois par visite. La forme de `ligneSansPreuve` (eBay → Annonces), §11 :
//   · la promesse seulement si l'extension de CE navigateur sait le faire
//     (`extSait`), rien ne la bloque (`raisonExtGlobale` — la phrase de
//     l'indicateur, une voix), connectée à CE compte VRM, code à jour, seule ;
//   · « au fil de tes visites » quand un compte a plus de colis que ce qu'elle
//     lit par visite (`SUIVI_PAR_VISITE` = `SUIVI_MAX_PAR_VISITE` de
//     background.js, comparé par audit-suivi-colis) ; chaque compte NOMMÉ (la
//     lecture active ne lit que le compte connecté dans Chrome) ;
//   · la FORME jamais reconnue (`panel_formes_suivi.journey.etat === 'inconnue'`)
//     remplace la promesse : l'extension a vu la page et ne sait pas la lire ;
//   · une ligne RELEVÉE sans étape datée n'est pas « pas encore relevée » : elle
//     se dit à part, et sa dernière étape est recopiée sur la carte, sans date.
// Trois états pour la forme aussi : `undefined` en cours · `null` pas su · lu.
const SUIVI_PAR_VISITE = 3;
async function lireFormesSuivi() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_formes_suivi&select=je:data->journey->>etat,ja:data->journey->>at`, { headers: sbAuth() });
    if (!r.ok) return null;
    const j = await r.json(); if (!Array.isArray(j)) return null;
    const x = j[0] || {};
    return { journey: x.je ? String(x.je) : '', at: x.ja || '' };
  } catch (_) { return null; }
}
function EtatSuiviVinted({ achats, suivisVinted, etatDe, accName, relire }) {
  // 5.188 : un téléphone qui a l'extension (Firefox pour Android) fait le geste ICI.
  const sansSouris = useSansSouris() && !vmrExtPresent();
  const [, majExt] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => onVmrExt(majExt), []);
  const [formes, setFormes] = React.useState(undefined);
  const aLire = Array.isArray(achats) && achats.length > 0 && suivisVinted != null;
  React.useEffect(() => { if (!aLire) return; let stop = false; lireFormesSuivi().then((f) => { if (!stop) setFormes(f); }); return () => { stop = true; }; }, [aLire, suivisVinted]);
  if (!Array.isArray(achats) || !achats.length || suivisVinted === undefined) return null;
  const bouton = { border: 'none', background: 'transparent', color: C.accentTexte, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, minHeight: 44 };
  if (suivisVinted === null) return <div data-suivi-vinted-etat="passu" style={{fontSize:12,color:C.muted,margin:'0 0 10px',lineHeight:1.45}}>Le suivi Vinted n'a pas pu être lu, rien n'est perdu. <Bouton variante="discret" onClick={relire}>Réessayer</Bouton></div>;
  const aucune = achats.filter((o) => etatDe(o) === 'aucune');
  const sansDate = achats.filter((o) => etatDe(o) === 'sans-date');
  if (!aucune.length && !sansDate.length) return null;
  const cap = extSait('suivivinted');
  const ailleurs = cap === 'absente' || sansSouris;
  const blocage = cap === 'ok' && !ailleurs ? raisonExtGlobale(false, { cap: 'suivivinted', role: 'relève le suivi de tes achats' }) : null;
  const promet = cap === 'ok' && !ailleurs && !blocage && connexionExtensionVrm() === 'ok' && !codePerime() && !__vmrPlusieurs;
  const formeJ = formes === undefined ? 'encours' : (formes === null ? 'passu' : (formes.journey || ''));
  const parCompte = new Map();
  for (const o of aucune) { const a = o && o._acc; const k = a ? String(a.vinted_user_id || '') : ''; const e = parCompte.get(k) || { a, n: 0 }; e.n++; parCompte.set(k, e); }
  const noms = [...parCompte.values()].map((e) => (e.a ? accName(e.a) : 'ce compte') + (parCompte.size > 1 ? ` (${e.n})` : ''));
  const ce = parCompte.size === 1 ? (noms[0] || 'ce compte') : `chacun de ces comptes (${noms.join(', ')})`;
  const un = aucune.length === 1;
  const plusParCompte = Math.max(0, ...[...parCompte.values()].map((e) => e.n));
  const quand = plusParCompte > SUIVI_PAR_VISITE ? 'au fil de tes visites' : 'à ta prochaine visite';
  const geste = 'touche « Suivre le colis » dans la commande sur vinted.fr';
  let phrase = null;
  if (aucune.length) {
    const tete = `${un ? '1 colis' : `${aucune.length} colis`} sans suivi Vinted relevé${parCompte.size === 1 && noms[0] ? ` (${noms[0]})` : ''}.`;
    const suite = promet
      ? (formeJ === 'inconnue'
        ? `L'extension a vu la page de suivi de Vinted mais ne sait pas encore la lire — ${geste}.`
        : `L'extension le relève toute seule sur vinted.fr connecté sur ${ce} — ${SUIVI_PAR_VISITE} par visite, donc ${quand}.`)
      : ailleurs
        ? `Il se relève avec l'extension VRM sur ton ordinateur, connecté sur ${ce} — ou ${geste}.`
        : cap === 'retard'
          ? `L'extension installée ici ne le relève pas encore : mets-la à jour (${EXT_CAPACITES.suivivinted} ou plus). En attendant, ${geste}.`
          : `${blocage ? blocage.texte : "Je vérifie que l'extension de ce navigateur est connectée à ton compte VRM."} Tant que ce n'est pas réglé, elle ne relève rien : ${geste}.`;
    phrase = <>{tete} {suite}</>;
  }
  const nSD = sansDate.length;
  return <div data-suivi-vinted-etat={cap} data-suivi-vinted-sans={aucune.length} data-suivi-vinted-sans-date={nSD}
    data-suivi-vinted-promesse={aucune.length && promet && formeJ !== 'inconnue' ? '1' : '0'} data-suivi-vinted-blocage={blocage ? blocage.code : ''} data-suivi-vinted-forme={formeJ}
    data-suivi-vinted-quand={aucune.length && promet ? (plusParCompte > SUIVI_PAR_VISITE ? 'fil' : 'prochaine') : ''}
    style={{fontSize:12,color:C.muted,margin:'0 0 10px',lineHeight:1.45}}>
    {phrase}
    {nSD > 0 && <div data-suivi-vinted-sans-date-texte="" style={{marginTop: phrase ? 4 : 0}}>{nSD > 1 ? `${nSD} colis ont` : '1 colis a'} une étape sans date : Vinted ne donne pas de date.</div>}
  </div>;
}
function SuivisManuels({ liste, tracking, achats, accName, relire, etapeDe, transp }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [n, setN] = React.useState('');
  const [tr, setTr] = React.useState('');
  const [cp, setCp] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [envoi, setEnvoi] = React.useState(false);
  const [relierPour, setRelierPour] = React.useState('');
  const norm = normaliserSuivi(n);
  const deForme = transporteurDeForme(norm);
  const choisi = tr || deForme || '';
  const valide = suiviValide(norm);
  const enregistrer = async () => {
    if (!valide) { setMsg("Ce n'est pas un n° de suivi (8 à 24 lettres et chiffres, au moins un chiffre)."); return; }
    if (!choisi) { setMsg('Choisis le transporteur : la forme de ce n° ne suffit pas à le dire.'); return; }
    if (cp && !normaliserCodePostal(cp)) { setMsg('Le code postal fait 5 chiffres (ou laisse vide).'); return; }
    setEnvoi(true); setMsg('');
    const r = await ecrireSuiviManuel(idSuiviManuel(choisi, norm), { suivi: norm, transporteur: choisi, codePostal: normaliserCodePostal(cp) || null });
    setEnvoi(false);
    if (!r.ok) { setMsg(r.msg); return; }
    setN(''); setTr(''); setCp(''); setOuvert(false); relire();
  };
  const candidats = (Array.isArray(achats) ? achats : []).filter(o => o && o.transaction_id && Date.now() - (Date.parse(o.date || '') || 0) < 45 * 86400000)
    .sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0)).slice(0, 30);
  const champ = { minHeight: 44, boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 12, padding: '0 12px', fontSize: 17, background: C.card, color: C.text, fontFamily: 'inherit' };
  const bouton = { minHeight: 44, boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 12, padding: '0 14px', fontSize: 13, fontWeight: 600, background: 'transparent', color: C.text, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div className="vrm-achats-bloc" data-suivis-manuels={Array.isArray(liste) ? liste.length : (liste === null ? 'pas-su' : 'en-cours')} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', fontSize: 15, fontWeight: 700, color: C.text }}>{Array.isArray(liste) && liste.length ? `N° de suivi ajoutés · ${liste.length}` : 'Suivre un colis par son n°'}</div>
        <Bouton variante={ouvert ? 'discret' : 'secondaire'} data-suivi-ajouter="" onClick={() => { setOuvert(o => !o); setMsg(''); }} style={{ minHeight: 44 }}>{ouvert ? 'Fermer' : '+ Ajouter un n° de suivi'}</Bouton>
      </div>
      {liste === null && <div data-suivis-manuels-pas-su="" style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Les n° ajoutés n'ont pas pu être lus — la base n'a pas répondu. Rien n'est perdu. <Bouton variante="discret" onClick={relire}>Réessayer</Bouton></div>}
      {ouvert && (
        <div data-suivi-form="" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input aria-label="N° de suivi" data-suivi-saisie="" value={n} onChange={e => { setN(e.target.value); setTr(''); setMsg(''); }} placeholder="N° de suivi (ex. 8 chiffres pour Mondial Relay)" autoCapitalize="characters" autoComplete="off" style={champ}/>
          {valide && (
            <div data-suivi-transporteur={choisi || 'a-choisir'} data-suivi-transporteur-phrase={!deForme ? (tr ? 'choisi' : 'ambigu') : (!tr || tr === deForme ? 'forme' : 'autre')} style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
              {/* (revue du 24 oct.) TROIS CAS, TROIS PHRASES : après un clic, l'écran
                  disait « La forme de ce n° ne le dit pas » d'un n° dont la forme le
                  disait. Reconnu (choisi ou non) · un autre choisi · ambigu. */}
              {deForme
                ? (!tr || tr === deForme
                  ? <>Transporteur reconnu à la forme du n° : <b style={{ color: C.text }}>{NOMS_SAISIE[deForme]}</b>.</>
                  : <>Tu as choisi <b style={{ color: C.text }}>{NOMS_SAISIE[tr]}</b> (la forme du n° faisait penser à {NOMS_SAISIE[deForme]}).</>)
                : (tr ? <>Tu as choisi <b style={{ color: C.text }}>{NOMS_SAISIE[tr]}</b>.</> : <>Quel transporteur ? La forme de ce n° ne le dit pas.</>)}
              {/* (revue du 24 oct.) LA FORME COMMUNE D'UN CHOIX (§7) : `Segmente` —
                  le segment actif à la règle commune (jamais un bouton blanc plein
                  en sombre). */}
              <Segmente label="Transporteur" plein className="vrm-seg-grille" value={choisi} onChange={setTr} style={{ marginTop: 6, marginBottom: 0 }}
                options={TRANSPORTEURS_SAISIE.map(k => ({ v: k, l: NOMS_CHOIX[k] || NOMS_SAISIE[k], data: { 'data-suivi-choix': k } }))}/>
            </div>
          )}
          {choisi === 'mondialrelay' && <input aria-label="Code postal (facultatif)" data-suivi-cp="" value={cp} onChange={e => setCp(e.target.value)} inputMode="numeric" placeholder="Code postal du point relais (facultatif)" style={champ}/>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Bouton variante="primaire" data-suivi-enregistrer="" disabled={envoi} onClick={enregistrer} style={{ minHeight: 44, opacity: envoi ? .5 : 1 }}>{envoi ? 'Enregistrement…' : 'Enregistrer ce suivi'}</Bouton>
            <span className="vrm-aide" data-suivi-promesse="" style={{ fontSize: 12, color: C.muted }}>« À retirer » dès que le transporteur le dit {LECTURE_SERVEUR_TRANSP.mondialrelay ? '(Mondial Relay : code postal du point relais).' : '(Mondial Relay : depuis ton ordinateur).'}</span>
          </div>
          {msg && <div data-suivi-msg="" style={{ fontSize: 13, color: C.warn }}>{msg}</div>}
        </div>
      )}
      {Array.isArray(liste) && liste.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map(m => {
            const et = etapeDe ? etapeDe(m.suivi) : null;
            const etape = et && et.texte;
            const lie = m.tx ? (Array.isArray(achats) ? achats.find(o => String(o.transaction_id) === m.tx && (!m.uid || String((o._acc && o._acc.vinted_user_id) || '') === m.uid)) : null) : null;
            return (
              <div key={m.id} data-suivi-manuel={m.suivi} data-suivi-etape={etape ? 'nouvelle' : 'attente'} data-suivi-ou={et ? et.ou : ''} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflowWrap: 'anywhere' }}>{NOMS_SAISIE[m.transporteur] || 'Transporteur'} · n° <span style={{ fontFamily: 'ui-monospace,monospace' }}>{m.suivi}</span></div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{etape ? (et.ou === 'email' ? `Dernière nouvelle par e-mail : ${etape}` : `Ce colis : ${etape}`) : 'Suivi ajouté — en attente d’une nouvelle'}</div>
                <LigneTransporteur transp={transp} suivi={m.suivi} carrier={m.transporteur}/>
                {m.tx && <div data-suivi-lie={m.tx} style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Relié à : {lie ? `${lie.title || 'Achat'}${lie._acc ? ` (${accName(lie._acc)})` : ''}` : `l'achat ${m.tx}`}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                  <BoutonSuivreColis transporteur={m.transporteur} suivi={m.suivi} codePostal={m.cp} enLigne/>
                  {!m.tx && <Bouton variante="secondaire" data-suivi-relier={m.suivi} onClick={() => setRelierPour(p => p === m.id ? '' : m.id)} style={{ minHeight: 44 }}>Relier à un achat</Bouton>}
                  {m.tx && <Bouton variante="discret" data-suivi-delier={m.suivi} onClick={async () => { const r = await ecrireSuiviManuel(m.id, { tx: null, uid: null }); if (!r.ok) setMsg(r.msg); relire(); }}>Délier</Bouton>}
                  {/* (revue du 24 oct.) « Retirer », dans l'onglet « À retirer », se lisait
                      « je l'ai retiré » : le bouton efface le SUIVI, il le dit. */}
                  <button type="button" data-suivi-retirer={m.suivi} onClick={async () => { if (!window.confirm(`Ne plus suivre le n° ${m.suivi} ? Le suivi ajouté est effacé ; les e-mails déjà reçus ne changent pas.`)) return; if (!(await retirerSuiviManuel(m.id))) setMsg("Le suivi n'a pas pu être effacé — la base n'a pas répondu."); relire(); }} style={{ ...bouton, border: 'none', background: 'transparent', color: C.muted, padding: '0 6px' }}>Ne plus suivre ce n°</button>
                </div>
                {relierPour === m.id && (
                  <div data-suivi-choix-achat="" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12, color: C.muted }}>Choisis l'achat de ce colis (c'est toi qui relies : VRM ne devine rien).</div>
                    {!candidats.length && <div style={{ fontSize: 12, color: C.muted }}>Aucun achat des 45 derniers jours.</div>}
                    {candidats.map(o => (
                      <button key={String(o.transaction_id)} type="button" data-suivi-achat={String(o.transaction_id)} onClick={async () => { const r = await ecrireSuiviManuel(m.id, { tx: String(o.transaction_id), uid: String((o._acc && o._acc.vinted_user_id) || '') || null }); if (!r.ok) setMsg(r.msg); setRelierPour(''); relire(); }}
                        style={{ ...bouton, textAlign: 'left', fontWeight: 500, overflowWrap: 'anywhere' }}>{o.title || 'Achat'}{o._acc ? ` · ${accName(o._acc)}` : ''}{o.date ? ` · ${dateFr(o.date)}` : ''}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {msg && !ouvert && <div data-suivi-msg="" style={{ fontSize: 13, color: C.warn, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
// ⟦← App.jsx #20⟧
// (revue du 23 oct.) Au-delà de ce nombre de jours, la ligne de fraîcheur d'Achats
// nomme le compte : ses colis ne le redisent pas (§7).
// (23 oct.) Les 14 jours supposés (`PICKUP_MAX_DAYS`) et la grâce de 10 jours
// après la limite sont retirés : la garde MESURÉE est de 4 à 7 jours, et la
// règle vit dans api/_lib/retrait-colis.js (`etatRetrait`, `GARDE_MAX_J`).
// Combien de temps on affiche un colis coché « retiré » en gris, le temps que
// Vinted enregistre le retrait. Au-delà on n'attend plus : la ligne s'efface,
// sinon un statut Vinted qui ne bouge jamais encombrerait la liste pour toujours.
// ⚠️ 4 OCTOBRE — Julien : « les colis retirés qui montrent encore "en attente de
// confirmation", enlève-les. » La ligne grise, c'est son idée (undo + QR gardé si
// problème au comptoir) et on la garde, MAIS 7 j, c'est trop long : un colis qu'il
// a déjà récupéré n'a plus rien à faire à l'écran. Ramené à 2 j — assez pour
// annuler une erreur ou re-montrer le QR le lendemain, et ça DISPARAÎT ensuite
// même si Vinted n'a toujours pas enregistré le retrait (souvent le cas). C'est
// le « à enlever » qu'il demande, sans perdre le filet de sécurité d'origine.
// ⚠️ AU-DELÀ, UN ACHAT « EN ROUTE » EST ANORMAL — mesuré sur ses 441 achats :
// 12 colis en transit ont 7 à 15 j (le rythme normal Vinted), mais 4 dépassent
// le mois avec un statut qui ne bouge plus. On ne les CACHE pas (un colis caché
// est un colis perdu, §5.43) : on affiche leur âge en rouge pour qu'il réclame.
const ACHAT_RETARD_J = 21;
// ⟦← App.jsx #21⟧
// ══════════════════════════════════════════════════════════════════════════════
// LA CARTE SOMBRE DES CHIFFRES, RÉGLABLE PAR PAGE (3 novembre) — Julien : « je veux
// juste le CA, le bénéfice etc. dans cette case sombre sur chaque onglet »,
// « modifiable en fonction de ce qu'on a sélectionné ».
// Le catalogue, les défauts, le périmètre et la lecture des valeurs vivent dans
// src/design/carteChiffres.js ; l'affichage et la feuille « Modifier » dans
// src/design/CarteStats.jsx. Ici, seulement le branchement : le réglage
// synchronisé (`vrm_carte_stats`), les SOURCES que l'app a déjà (liveStats de la
// coque, publications de Ventes et de Colis, la lecture du bénéfice de Compta) et
// les RÈGLES propriétaires passées telles quelles — aucun chiffre recalculé.
// ══════════════════════════════════════════════════════════════════════════════
// (6 nov., onglets A) Les chiffres que la carte d'Achats montre (grand chiffre et cases), d'après SON réglage :
// un onglet d'étape ne redit pas un nombre déjà écrit au-dessus (§7).
const idsCarteAchats = () => { try { const r = reglageDePage(lireReglageCarte(), 'achats', { depense: {}, enroute: {}, recus: {} }); return new Set(r ? [r.g && r.g.id, ...(r.c || []).map((x) => x && x.id)].filter(Boolean) : []); } catch (_) { return new Set(); } };
// ⟦← App.jsx #22⟧

// État d'erreur de chargement, avec un bouton « Réessayer ».
function LoadError({ onRetry }) {
  return <div className="vrm-erreur-chargement" style={{textAlign:'center',padding:'28px 16px'}}>
    <div aria-hidden="true" style={{width:44,height:44,margin:'0 auto 10px',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',background:C.card2,color:C.muted}}><Icon name="cloudOff" size={20}/></div>
    <div style={{fontSize:15,fontWeight:500,color:C.text,marginBottom:4}}>Impossible de charger ces données</div>
    <div style={{marginBottom:12}}/>
    <button type="button" className="vrm-erreur-chargement-bouton" onClick={onRetry} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:12,padding:'0 22px',minHeight:44,cursor:'pointer',fontSize:15,fontWeight:600}}>Réessayer</button>
  </div>;
}