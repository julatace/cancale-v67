// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import ChampSaisie from '../composants/ChampSaisie.jsx';
import { CaseSerie, BarreSerie, OuvrirSerie, avecSerie } from '../composants/SelectionSerie.jsx';
import { trierSerie, resumeSerie, csvDe } from '../selectionSerie.js';
import { ComparaisonComptesVinted } from '../OutilsArticlesVinted.jsx';
import { comparerComptes } from '../outilsArticlesVinted.js';
import FiabiliteVentes from '../FiabiliteVentes.jsx';
import { STYLE_FLOU } from '../flouCompte.js';
import VuesVentes from '../VuesVentes.jsx';
import { paireARemettre } from '../annuleesChezToi.js';
import { centimes, beneficePaire, champsCharges } from '../beneficePaire.js';
import { motEtatVente, comptesQuiAnnulent, fenetreAnnulations, bandeauPrixAchat } from '../ventesEcran.js';
import { requeteDeLaVoix } from '../rechercheVocale.js';
import React, { useState, lazy, Suspense } from 'react';
import { montant } from '../format.js';
import { ChampRecherche } from '../composants/ChampRecherche.jsx';
import { Numero } from '../composants/Numero.jsx';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { L, VERBES } from '../libelles.js';
import * as photosVinted from '../photosVinted.js';
import { quandRelu } from '../fraicheurComptes.js';
import { gesteVenteEmail, STATUT_VENTE_EMAIL, statutVentesEmail } from '../venteEmailFraiche.js';
import { MENTION_SANS_NUM, phraseImprimeSansNumero } from '../bordereauVenteEmail.js';
import { texteLimiteEnvoi } from '../../api/_lib/limite-envoi.js';
import { choisirPhotoDisponible } from '../photosArticles.js';
import { texteLimite as texteLimiteLitige, LIBELLE_GENRE as LIBELLE_LITIGE } from '../litiges.js';
import { VentesHorsPlan } from '../abonnement/PlansSoloPro.jsx';
import PastilleTransporteur from '../PastilleTransporteur.jsx';
import { BarreAnnulerDepose } from '../GlisserDepose.jsx';
import LigneGlissable from '../LigneGlissable.jsx';
import { PhotoCartonVente } from '../PhotoCarton.jsx';
import { beneficeLigneVente, texteBenefice, euros as eurosLigne } from '../beneficeLigne.js';
import { phraseVente, eurosRecap } from '../recapVente.js';
import Frise from '../design/Frise.jsx';
import { friseVenteFusion } from '../design/friseFusion.js';
import { cascadeVente } from '../coutVente.js';
import { redirigerOnglet } from '../navigationTache.js';
import { attrCible } from '../cibleNotif.js';
import { NOM_BENEFICE_BRUT, NOM_APRES_FRAIS } from '../beneficeNoms.js';
import Illustration from '../composants/Illustration.jsx';
import { AUTH, ArgentAVenirCarte, Bouton, BoutonBordereau, BoutonRappel, C, CLOISONNE, CarteStatsApp, CompteVente, CoutAchatVente, DEPS_FACTURE, Icon, LigneSansDate, LigneVenteCompacte, MicDictee, NAV, Notice, ONGLETS_DEPLACES, PeriodePicker, PhotoArticleAgrandissable, PhotoVente, PhotoVinted, Pourquoi, RaisonBordereauxGrises, SUPABASE_URL, ScreenHead, Skeleton, StatBox, Z_CONFIRMATION, aExpedier, aLaDemande, cadrePhoto, classifyOrderStatus, clavierNum, compteCarte, dansPeriode, dateFr, dateLocaleISO, fmt, garageCellLabel, garageCellOf, gesteVrm, iconeApp, numeroReprenable, orderPhoto, pctFr, poserCible, save, sbAuth, tailleDansTitre, taillePicto, telechargerFichier, venteFinalisee, vintedApiCall, vmrExtPresent, voirAbonnement } from '../App.jsx';

// La branche {curSub==='ventes' && …} de Comptabilite, telle quelle, avec 7 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function VueVentes({ v }) {
  const { NoAcc, SHIP_DAYS, accName, accNameOf, accounts, acctOff, acctOffOf, achatRelie, actionsVentesProxy, analyseOpen, annoncesVendues, annulChezParTx, annuleesReglees, appliquerProposition, autresParIdRapport, baseKO, batchBordereaux, blocRetirerAilleurs, blockedAccts, boostsDetected, bordKey, bordParTx, bordsParTxn, bordsSansNum, bordsShipped, buys, chargesVente, commandesParTx, cur, dansPlateforme, declRapport, deposeVente, ebayCmd, effEntry, entreeVenteLot, estFloute, estParti, fmtE, fmtE0, garageGrid, garageUtilise, groupeFacture, identiteAnnonce, inGarage, isHidden, isPairLost, isShipDone, labelsCaptes, lbcLu, lignesLotTous, listings, litiges, liveStats, loadListings, loadOrders, lotOrigineRef, margeModeles, monthlyChart, nPropVentes, nomsVentesKO, onNav, openReport, ordSearch, ordSearchDiff, outilsOrdinateur, ouvrirRecuRelie, perf, periode, photosVentesValides, preparerLigneVente, preuvesFriseDe, propositionVente, propositionsPrix, recuOuverture, saleOutcome, sales, seasonality, selEff, serieVentes, setAnalyseOpen, setAnnuleesReglees, setBordsShipped, setBuys, setCapturedReceipts, setFillBuyOpen, setLotLiens, setLotView, setOrdSearch, setPeriode, setPhotosVentesForcees, setRecusPasLus, setRepereOuvert, setRepubMainOuvert, setSales, setShipDone, setShowAnnual, setShowWrapped, setToolsOpen, setVFilter, setVentesMax, setWrapStep, shipDone, soldManual, toShip, toShipEmailTx, toolsOpen, totals, transporteurVente, vFilter, validerPropositions, venteStage, ventesAffichees, ventesEmailTete, ventesMax, ventesSansDate, ventesVc } = v;
  /*⟦← App.jsx #h1_1⟧*/const relierArticleLot = (tx, item, num) => setLotLiens((prev) => {
    const t = String(tx), i = String(item), n = String(num == null ? '' : num).trim();
    const u = { ...prev, [t]: { ...(prev[t] || {}) } };
    if (n) u[t][i] = n; else delete u[t][i];
    if (!Object.keys(u[t]).length) delete u[t];
    save('vrm_lot_liens', u); return u;
  });/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const poserAnnuleeReglee = (tx) => gesteVrm('Noté : VRM ne la propose plus', [{ k: 'vrm_annulees_reglees', type: 'cle', id: String(tx), apres: new Date().toISOString(), avant: (annuleesReglees || {})[String(tx)] }], { vrm_annulees_reglees: setAnnuleesReglees });/*⟦←/⟧*/
  /*⟦← App.jsx #h1_3⟧*/const actionsSerieVentes = () => {
    const parTx = new Map(ventesAffichees.map(o => [String(o.transaction_id), o]));
    const lignes = (cles) => cles.map(k => parTx.get(k)).filter(Boolean);
    const annulee = (o) => classifyOrderStatus(o.status) === 'cancelled';
    return [
      { k: 'imprimer', libelle: 'Imprimer', icone: 'printer', variante: 'primaire', faire: async (cles) => {
        // Les bordereaux prêts du lot « Tout imprimer » (même clé : le n° de transaction).
        const prets = new Set(lignesLotTous().filter(l => l.cochable !== false).map(l => String(l.cle)));
        const { ok, pasFaits } = trierSerie(lignes(cles), (o) => annulee(o) ? 'annulée' : estParti(o) ? 'déjà partie' : prets.has(String(o.transaction_id)) ? true : 'pas de bordereau prêt');
        if (ok.length) await batchBordereaux(new Set(ok.map(o => String(o.transaction_id))));
        return resumeSerie({ faits: ok, pasFaits }, { un: 'bordereau préparé', plusieurs: 'bordereaux préparés' });
      } },
      { k: 'depose', libelle: 'Je dépose', icone: 'check', faire: (cles) => {
        // L'écriture de « Colis déposé » (`gesteColisFait`), en UN geste ⇒ UN « Annuler ».
        const { ok, pasFaits } = trierSerie(lignes(cles), (o) => annulee(o) ? 'annulée' : estParti(o) ? 'déjà déposée' : !aExpedier(o) ? 'pas à envoyer' : true);
        const ops = [];
        for (const o of ok) {
          const k = String(o.transaction_id), b = bordsParTxn[k], kb = b ? bordKey(b) : null;
          if (!shipDone[k]) ops.push({ k: 'vinted_ship_done', type: 'cle', id: k, apres: Date.now(), avant: shipDone[k] });
          if (kb) ops.push({ k: 'vinted_bords_shipped', type: 'cle', id: kb, apres: 1, avant: bordsShipped[kb] });
        }
        if (ops.length) gesteVrm(ok.length > 1 ? `${ok.length} colis déposés` : 'Colis déposé', ops, { vinted_ship_done: setShipDone, vinted_bords_shipped: setBordsShipped });
        return resumeSerie({ faits: ok, pasFaits }, { un: 'déposée', plusieurs: 'déposées' });
      } },
      { k: 'exporter', libelle: 'Exporter', icone: 'doc', faire: (cles) => {
        const L = lignes(cles);
        const csv = csvDe(['Date', 'Compte', 'Article', 'N°', 'Prix (€)', 'État', 'N° de transaction'],
          L.map(o => { const e = effEntry(o); return [o.date && Number.isFinite(new Date(o.date).getTime()) ? new Date(o.date).toLocaleDateString('fr-FR') : '', o._acc ? accNameOf(o._acc) : '', o.title || '', (e && e.numero) || '', o.price && o.price.amount != null ? Number(o.price.amount).toFixed(2).replace('.', ',') : '', o.status_title || o.status || '', String(o.transaction_id)]; }));
        telechargerFichier(csv, `ventes-${dateLocaleISO()}.csv`, 'text/csv;charset=utf-8');
        return resumeSerie({ faits: L, pasFaits: [] }, { un: 'vente exportée', plusieurs: 'ventes exportées' });
      } },
      { k: 'facture', libelle: 'Facture Pro', icone: 'receipt', faire: async (cles) => {
        const L = lignes(cles);
        const txDe = (o) => String(o._fromEmail ? o._txMail : o.transaction_id);
        const m = await import('../FacturePro.jsx');
        const r = await m.envoyerFacturesSerie(DEPS_FACTURE, L.map(txDe), sales.items);
        if (!r) return { annule: true };
        return resumeSerie(r, { un: 'facture envoyée', plusieurs: 'factures envoyées' });
      } },
    ];
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_4⟧*/const remettreEnVente = (x) => { const p = paireARemettre(x, { reprenable: numeroReprenable }); if (p) setRepubMainOuvert(p); };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_5⟧*/const openAnnual = async () => {
    setShowAnnual(true);
    if (buys.items===null && accounts.length) loadOrders('purchased', setBuys);
    // Reçus officiels Vinted captés par l'extension (compta pro), par compte.
    // Les comptes sont lus ENSEMBLE (lectures de NOTRE base, pas de Vinted), et
    // une lecture ratée ne se fait pas passer pour « aucun reçu ».
    const lus = await Promise.all(accounts.map(a => fetchCapturedReceipt(a.vinted_user_id).then(r => ({ a, r }))));
    setCapturedReceipts(lus.filter(x => x.r).map(x => ({ name: accName(x.a), ...x.r })));
    setRecusPasLus(lus.filter(x => x.r === null).length);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_6⟧*/const menuOutilsVentes = (sousBarre) => (
    <>
      <div className="vrm-menu-voile" onClick={()=>setToolsOpen(false)} style={{position:'fixed',inset:0,zIndex:70}}/>
      <div className="vrm-menu-flottant" data-outils-ventes={sousBarre?'sous-barre':'bouton'} style={{position:'absolute',zIndex:71,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:C.shadowLg||'0 8px 24px rgba(0,0,0,.2)',padding:6,display:'flex',flexDirection:'column',gap:2,...(sousBarre?{left:8,right:8,top:'calc(100% - 4px)'}:{right:0,top:'calc(100% + 6px)',minWidth:270})}}>
        {(
          <div className="vrm-outils-reglages" style={{padding:'4px 6px 8px',borderBottom:`1px solid ${C.border}`,marginBottom:2}}>
            {/* (2 nov., 22 h) La recherche et la période ne sont plus sur l'écran (maquette FusionVentes) :
                elles sont ici, à un geste — les mêmes états (`ordSearch`, `periode`). */}
            {sales.items && sales.items.length>0 && <div className="vrm-outils-recherche" data-outils-recherche="" style={{display:'flex',flexDirection:'column',gap:8,padding:'4px 4px 10px'}}>
              <div className="vrm-list-search"><Icon name="search" size={17}/><input aria-label="Rechercher dans les ventes Vinted" type="search" value={ordSearch} onChange={e=>setOrdSearch(e.target.value)} placeholder="Rechercher"
                style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 13px',fontSize:17,background:C.card,color:C.text,outline:'none',minHeight:44}}/><MicDictee nu titre="Chercher à la voix (« numéro 124 », « chemise bleue »)" onDirect={setOrdSearch} onText={(t)=>setOrdSearch(requeteDeLaVoix(t).requete)}/></div>
              <PeriodePicker value={periode} onChange={setPeriode} titre="Période des ventes" datation="Date de vente"/>
            </div>}
            <BordereauxAuto key={AUTH.user?.id} owner={AUTH.user?.id} lire={lireBordereauxAuto} sauver={sauverBordereauxAuto}/>
            <VuesVentes owner={AUTH.user?.id} plateforme="vinted" valeur={{filtre:vFilter,recherche:ordSearch,periode}} onAppliquer={v=>{setVFilter(v.filtre);setOrdSearch(v.recherche);setPeriode(v.periode);setToolsOpen(false);}}/>
          </div>
        )}
        {[
          {k:'rep', icon:'doc', lab:'Rapport comptable', desc:'CA, bénéfice, cotisations du mois', on:()=>{ setToolsOpen(false); openReport(); }},
          {k:'ann', icon:'receipt', lab:'Registre annuel', desc:'Ventes et achats, ligne par ligne', on:()=>{ setToolsOpen(false); openAnnual(); }},
          /* « Litiges » retiré des Outils le 30 septembre (Julien : « ce n'est
             pas un problème, je reçois les articles après ; ils sont déjà
             dans Annulées »). La modale reste, plus rien n'y mène d'ici. */
          ...(((sales.items&&sales.items.length>0) || ((declRapport && declRapport.lignes) || []).some((l) => l && l.plateforme !== 'Vinted'))?[{k:'csv', icon:'save', lab:'Exporter en tableur', desc:'CSV, lisible dans Excel et Numbers', on:()=>{ setToolsOpen(false); exportCsv(); }}]:[]),
          /* (30 oct.) La rétrospective est un geste RARE : elle quitte la page
             (un bouton pleine largeur sous l'analyse) pour ce menu. */
          ...((sales.items&&sales.items.some(o=>classifyOrderStatus(o.status)==='completed'))?[{k:'wrap', icon:'spark', lab:`Rétrospective ${new Date().getFullYear()}`, desc:'Ton année en quelques chiffres', on:()=>{ setToolsOpen(false); setWrapStep(0); setShowWrapped(true); }}]:[]),
        ].map(t=>(
          <button type="button" key={t.k} onClick={t.on} style={{display:'flex',alignItems:'center',gap:10,textAlign:'left',border:'none',background:'transparent',borderRadius:12,padding:'9px 10px',cursor:'pointer',fontFamily:'inherit'}}>
            <span aria-hidden="true" style={{flexShrink:0,display:'flex',color:C.muted}}><Icon name={t.icon} size={18}/></span>
            <span style={{minWidth:0}}>
              <span style={{display:'block',fontSize:13,fontWeight:600,color:t.danger?C.danger:C.text}}>{t.lab}</span>
              <span style={{display:'block',fontSize:11,color:C.muted,marginTop:1}}>{t.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );/*⟦←/⟧*/
  /*⟦← App.jsx #h1_7⟧*/const exportCsv = () => {
    const rows = [['Date','Compte','N°','Titre','Prix vente','Prix achat','Frais renseignés','Bénéfice avant charges générales','Statut','Boost','Commission','Port vendeur','Remboursement','Autres frais','Emballage','Frais confirmés','Plateforme']];
    (sales.items||[]).filter(o=>!isHidden(o)).forEach(o=>{
      const st = classifyOrderStatus(o.status);
      const e = effEntry(o); const num = e?.numero || '';
      const sell = o.price?.amount!=null ? Number(o.price.amount) : '';
      const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? (centimes(e.buyPrice)==null?null:centimes(e.buyPrice)/100) : '';
      const fee = chargesVente(e);
      const bilan=beneficePaire(o.price?.amount,e);
      const benef = st!=='cancelled' && bilan.benefice!=null ? bilan.benefice.toFixed(2) : '';
      rows.push([
        o.date?dateFr(o.date):'', accName(o._acc), num, o.title||'',
        sell===''?'':String(sell).replace('.',','), buy==='' || buy==null?'':String(buy).replace('.',','),
        fee>0?String(fee.toFixed(2)).replace('.',','):'',
        benef===''?'':String(benef).replace('.',','), st==='completed'?'finalisée':st==='cancelled'?'annulée':'en cours',
        ...['fees',...champsCharges.map(([k])=>k)].map(k=>centimes(e?.[k])==null?'':String(centimes(e[k])/100).replace('.',',')),bilan.complet?'oui':'non',
        'Vinted',
      ]);
    });
    // (11 nov., parité) LEBONCOIN, eBAY, VESTIAIRE : les ventes à l'argent reçu (`declRapport`, la
    // règle du CA déclaré — finalisées, comptes écartés hors), datées comme elle (versement, sinon
    // vente). Prix d'achat et N° : la paire reliée par IDENTITÉ (`autresParIdRapport`), sinon vide.
    // Le montant est déjà net des frais de la plateforme (eBay, Vestiaire) : aucun frais ajouté.
    // Une vente en cours ou au montant pas sûr n'est pas ici (elle n'est pas dans le CA) : dite en pied.
    const virg = (n) => String(Number(n).toFixed(2)).replace('.', ',');
    let nAutres = 0;
    for (const l of ((declRapport && declRapport.lignes) || [])) {
      if (!l || l.plateforme === 'Vinted') continue;
      const a = autresParIdRapport.get(String(l.id));
      const buy = a && a.achat != null && Number.isFinite(Number(a.achat)) ? Number(a.achat) : null;
      const d = l.ts || (l.dateVente ? Date.parse(l.dateVente) : NaN);
      rows.push([Number.isFinite(d) ? dateFr(new Date(d).toISOString()) : '', l.plateforme, (a && a.num) || '', l.titre || '', virg(l.eur), buy == null ? '' : virg(buy), '',
        buy == null ? '' : virg(l.eur - buy), 'finalisée', '', '', '', '', '', '', buy == null ? 'non' : 'oui', l.plateforme]);
      nAutres += 1;
    }
    const sourcesAutresKO = [lbcLu === null ? 'Leboncoin' : null, ebayCmd === null ? 'eBay' : null, ventesVc === null ? 'Vestiaire' : null].filter(Boolean);
    if (sourcesAutresKO.length) rows.push([`Ventes pas lues : ${sourcesAutresKO.join(', ')} — absentes de ce fichier`]);
    if (nAutres) rows.push([`Leboncoin, eBay et Vestiaire : ventes finalisées seulement (montant reçu) ; en cours ou montant pas sûr : absentes`]);
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'comptabilite-ventes.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/<>
        {!dansPlateforme && <ScreenHead icon="cash" title="Ventes" desc="Tout ce que tu as vendu : bénéfice par article, expédition, et tes documents comptables."/>}
        {/* (11 nov., anti double vente) EN TÊTE : vendu ici, encore en ligne ailleurs — un toucher. */}
        {!baseKO && blocRetirerAilleurs(false)}
        {/* (2 nov., style « Fusion », son choix : « la première photo avec les stats
            novembre ») LA CARTE DU MOIS. Le grand chiffre est le VENDU du mois, toutes
            plateformes (`bilanVentes` sur `vendus` — la règle de « Vendu » de Ma
            journée), « au moins » si un compte n'a pas été lu ; la courbe en est le
            cumul jour par jour (mêmes lignes). Les cases comptent les ventes Vinted de
            la liste : « à poster » = la règle « À expédier » (`aExpedier`, pas encore
            déposée), « en route » / « argent à venir » = la frise de chaque vente
            (`preuvesFriseDe` → `friseVente`, une étape n'est comptée que PROUVÉE). */}
        {!baseKO && Array.isArray(sales.items) && (() => {
          // (3 nov., carte réglable par page) Les cases propres de Ventes : « en route » / « à payer »
          // = la frise de chaque vente (`preuvesFriseDe` → `friseVente`, une étape n'est comptée que
          // PROUVÉE) — les mêmes qu'avant. Le reste vient du catalogue (src/design/carteChiffres.js) :
          // le grand chiffre par défaut est le VENDU du mois de VINTED (le site de cet écran,
          // `ventesFaites` par `bilanLignes`), « à poster » la publication de Colis pour Vinted.
          let enRoute = 0, aVenir = 0;
          for (const o of sales.items) {
            if (!o || o.transaction_id == null || isHidden(o)) continue;
            const stO = classifyOrderStatus(o.status);
            if (stO === 'cancelled') continue;
            if (aExpedier(o) && !estParti(o)) continue;
            const p = preuvesFriseDe(o); const f = p.etapes ? friseVenteFusion(p.etapes) : null;
            if (!f) continue;
            const fait = Object.fromEntries(f.map((e) => [e.cle, e.fait]));
            // (8 nov.) Partie par une preuve sûre (e-mail de dépôt de SON n°, transporteur…) : en route.
            if (aExpedier(o) && estParti(o) && !fait.livree) { enRoute += 1; continue; }
            if (fait.postee && !fait.livree) enRoute += 1;
            else if (fait.livree && !fait.payee) aVenir += 1;
          }
          // Des ventes illisibles ⇒ ces comptes ne sont pas sûrs (« rien lu ne vaut pas rien »).
          const pasSu = nomsVentesKO.length > 0;
          const ts = (x) => { if (!x) return null; const t = x instanceof Date ? x : new Date(x); return isNaN(t.getTime()) ? null : t; };
          const pf = periode && (periode.from || periode.to) ? (() => { const f = ts(periode.from), t = ts(periode.to); if (f) f.setHours(0, 0, 0, 0); const fin = t ? new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime() : null; return { de: f ? f.getTime() : 0, a: fin, label: libellePeriode(periode) }; })() : null;
          return (
            <CarteStatsApp page="ventes" aide liveStats={liveStats} className="vrm-fu-ecran vrm-fu-ventes" ici="cat_ventes" onNav={onNav}
              sel={{ site: 'vinted', compte: compteCarte(selEff, accounts), periode: pf }}
              /* (9 nov., Ma journée v2 — Julien : « "Colis à envoyer" et "Ventes", ça fait répéter deux fois la
                 même chose ») Ventes = l'argent et l'histoire des ventes ; Colis = les gestes. La case « À envoyer »
                 mène à Colis (son `aller` du catalogue), elle ne déplie plus ici une seconde liste « à envoyer ». */
              attrsDe={(x) => x.place.id === 'vendu' && (x.p === 'mois' || (pf && x.p === pf)) ? { 'data-fu-vendu-mois': x.valeur == null ? '' : String(Math.round(x.valeur * 100)), 'data-fu-partiel': x.partiel ? '1' : undefined, 'data-fu-pas-su': x.valeur == null ? '1' : undefined } : x.place.id === 'aposter' ? { 'data-n': x.valeur == null ? '' : String(x.valeur), 'aria-pressed': vFilter === 'aexpedier' } : null}
              locaux={{
                enroute: { nom: 'Ventes en route', court: 'en route', type: 'n', valeur: pasSu ? null : enRoute, titre: 'Déposées, pas encore livrées', onClick: () => setVFilter((v) => v === 'transit' ? 'all' : 'transit'), attrs: { 'data-n': pasSu ? '' : String(enRoute), 'aria-pressed': vFilter === 'transit' } },
                apayer: { nom: 'Ventes à payer', court: 'à payer', type: 'n', valeur: pasSu ? null : aVenir, titre: "Livrées : l'argent arrive quand l'acheteur confirme", attrs: { 'data-n': pasSu ? '' : String(aVenir) } },
              }}/>
          );
        })()}
        {/* (5 nov., chantier E2) L'argent de Vinted, sous la carte du mois — le même ordre que
            « Tous » : la carte, puis « À venir ». Mêmes composants, mêmes règles qu'avant. */}
        {dansPlateforme && !baseKO && <div className="vrm-retirer-hote" style={{margin:'12px 0 0'}}><RetirerArgent liveStats={liveStats}/></div>}
        {dansPlateforme && !baseKO && <div className="vrm-a-venir-hote" style={{margin:'12px 0 0'}}><ArgentAVenirCarte A={liveStats && liveStats.aVenir} plateforme="Vinted"/></div>}
        {/* ⚠️ LES OUTILS DE TRAVAIL AVANT LES COMMENTAIRES. La période et la
            recherche étaient sous six bandeaux d'explication : il fallait
            défiler un écran et demi pour filtrer ses ventes. Ce qu'on manipule
            tous les jours vient en premier, les encadrés d'information ensuite. */}
        {/* (26 oct.) Dans l'espace Vinted, le nombre de résultats seul sur sa ligne
            ne servait qu'à repousser la liste : il ne reste que sur l'écran seul. */}
        {!dansPlateforme && <div className="vrm-mobile-sales-intro"><span className="vrm-mobile-resultats" role="status">{Array.isArray(sales.items) && !sales.loading && !baseKO ? `${ventesAffichees.length} résultat${ventesAffichees.length !== 1 ? 's' : ''}` : sales.loading ? 'Chargement…' : 'Non disponible'}</span></div>}
        <div className="vrm-workbar vrm-sales-workbar" style={{position:'relative'}}>
        {sales.items && sales.items.length>0 && (
          <div className="vrm-sales-search-group" style={{marginBottom:14}}>
            <ChampRecherche valeur={ordSearch} onChange={setOrdSearch} label="Rechercher dans les ventes Vinted" placeholder="Rechercher une vente" micro data-ventes-recherche=""/>
            {(ordSearch || periode || vFilter!=='all') && <div className="vrm-filter-recap">
              <span>Filtres actifs</span><Bouton variante="discret" onClick={()=>{setOrdSearch('');setPeriode(null);setVFilter('all');}}>Réinitialiser les ventes</Bouton>
            </div>}
          </div>
        )}
        {/* (30 oct.) Les OUTILS sortent de la rangée des filtres : collés au bout, ils
            couvraient « Finalisées » (coupé en « Finalis… ») et cachaient « Annulées ».
            Les filtres défilent seuls, « Outils » reste à droite, à part. */}
        <div className="vrm-filtres-et-outils" style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,minWidth:0}}>
        <div className="vrm-rangee vrm-filtres" style={{display:'flex',gap:6,alignItems:'center',WebkitOverflowScrolling:'touch',scrollbarWidth:'none',msOverflowStyle:'none',paddingBottom:2,flex:'1 1 auto',minWidth:0}}>
          {/* (9 nov., Ma journée v2) Plus de filtre « À envoyer » ici : la liste des colis à envoyer vit dans
              Colis (un lien, au bout de la rangée), jamais redite en entier dans Ventes. Une vue enregistrée
              qui le choisit filtre encore (rien n'est cassé) ; l'état « À envoyer » reste sur chaque vente. */}
          {[['all','Toutes'],['transit',L.enRoute],['finalisees','Finalisées'],['annulees','Annulées']].map(([id,label])=>(
            <button type="button" key={id} onClick={()=>setVFilter(id)} aria-pressed={vFilter===id} style={{flexShrink:0,whiteSpace:'nowrap',padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'background-color .15s ease, color .15s ease'}}>{label}</button>
          ))}
          {onNav ? <button type="button" className="vrm-ventes-vers-colis" data-ventes-vers-colis="" onClick={()=>onNav('cat_bord')} style={{flexShrink:0,whiteSpace:'nowrap',padding:'7px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{L.aEnvoyer} : Colis ›</button> : null}
        </div>
          {/* OUTILS regroupés : la barre mélangeait filtres et outils (10 boutons
              sur une ligne). Les filtres restent visibles — c'est le réglage du
              quotidien — et Compta / Registre / CSV passent derrière un seul
              « ⋯ Outils » (sur téléphone, aussi « Bordereaux auto » et « Mes
              vues »). Les litiges gardent une pastille d'alerte : de l'argent. */}
          {accounts.length>0 && (
            <div className="vrm-outils-ventes" style={{position:outilsOrdinateur?'relative':undefined,flexShrink:0}}>
              {/* (30 oct.) Plus de point ROUGE : il signalait les litiges, retirés de ce
                  menu le 30 sept. — il ne menait plus à rien (§7 : le rouge, c'est le
                  doublon de N°). */}
              <Bouton variante="secondaire" className="vrm-b-petit" icone="more" onClick={()=>setToolsOpen(v=>!v)} aria-expanded={toolsOpen} title="Rapport comptable, registre annuel, export, rétrospective">Outils</Bouton>
              {toolsOpen && outilsOrdinateur && menuOutilsVentes(false)}
            </div>
          )}
        </div>
        {/* Sous 1 024 px la rangée des filtres défile au doigt : un menu ouvert
            DEDANS était coupé par elle (invisible, intouchable — mesuré au banc
            `revendeurs.cjs`). Il s'ouvre sous la barre entière. */}
        {accounts.length>0 && toolsOpen && !outilsOrdinateur && menuOutilsVentes(true)}
        {/* LA PÉRIODE, SOUS LE FILTRE QU'ELLE AFFINE. Elle était tout en haut,
            au-dessus de tout : six pastilles + la recherche formaient deux blocs
            pleins avant la première vente. Ici, elle est là où on l'utilise —
            on choisit « Finalisées », puis le mois. */}
        {sales.items && sales.items.length>0 && <PeriodePicker value={periode} onChange={setPeriode} titre="Période des ventes" datation="Date de vente"/>}
        </div>
        <NoAcc/>
        {/* ⚠️ LES VENTES LEBONCOIN NE SONT PLUS ICI : elles vivent dans l'espace
            LEBONCOIN (onglet Leboncoin → aperçu), pas dans les ventes VINTED
            (Julien, 25 sept.). Cet écran est Vinted uniquement. */}
        {/* Rappel d'expédition : alerte les ventes à expédier, les plus urgentes
            d'abord (échéance estimée à +5 j). Protège la note vendeur. */}
         {/* ⚠️ AU-DESSUS DE LA LISTE, ON NE GARDE QUE CE QU'ON VIENT FAIRE.
             Julien : « je veux que ce soit plus minimaliste ». Il y avait ONZE
             blocs avant la première vente : colis à expédier (qui a son propre
             écran), argent en attente, vente repérée, ventes par jour, quatre
             chiffres, rétrospective, analyse, deux avertissements, et encore
             une ligne sur les ventes masquées. Tout ce qui n'est ni un filtre
             ni un chiffre ni une vente est descendu dans « Analyse ». */}
        {/* Boosts détectés automatiquement (facturation Vinted captée par
            l'extension). LECTURE SEULE : n'écrase jamais tes saisies « 💡 boost »
            par annonce — c'est un repère pour vérifier/compléter à la main. */}
        {Array.isArray(boostsDetected) && boostsDetected.length>0 && (()=>{
          const tot = boostsDetected.reduce((s,b)=>s+(b.amount||0),0);
          return (
            <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'10px 13px',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>{montant(tot)} de boosts sur Vinted <span style={{color:C.muted,fontWeight:500}}>· {boostsDetected.length} mise{boostsDetected.length>1?'s':''} en avant</span>
                <Pourquoi label="D'où vient ce montant ?">Capté dans ta facturation Vinted par l'extension. Reporte chaque montant dans le champ « Boost » de son annonce pour un bénéfice net exact — l'app ne l'inscrit pas toute seule, pour ne pas écraser tes saisies.</Pourquoi></div>
            </div>
          );
        })()}
        {/* ── ANALYSE : tout ce qui n'est pas l'action du jour est REPLIÉ ────
            L'onglet Ventes montrait 6 panneaux d'analyse AVANT la liste des
            ventes — l'essentiel était enterré. On les regroupe derrière un seul
            bouton, fermé par défaut : l'écran va droit au but, l'analyse reste
            à un tap. */}
        {/* ⚠️ LE BANDEAU « WRAPPED » NE PREND PLUS TOUT L'ÉCRAN.
            C'était un pavé en dégradé violet/rose, texte blanc, emoji de 26 px,
            posé au milieu d'un outil de comptabilité — l'élément qui faisait le
            plus « application fabriquée par une machine ». La rétrospective est
            sympathique, elle n'a simplement pas à crier plus fort que les colis
            à expédier. Elle devient une ligne discrète, au même gabarit que
            « Analyse de tes ventes » juste en dessous : deux entrées de même
            nature ont désormais la même apparence. */}
        {/* Les comptes non chargés, jugés par leur IDENTITÉ (`failedUids`) et
            nommés au rendu — y compris quand la liste vient du cache. */}
        {nomsVentesKO.length>0 && (
          <div data-ventes-ko={nomsVentesKO.length} style={{fontSize:12,fontWeight:500,color:C.warn,background:`${C.warn}12`,border:`1px solid ${C.warn}55`,borderRadius:12,padding:'8px 12px',marginBottom:12,lineHeight:1.4}}>
            {nomsVentesKO.length} compte{nomsVentesKO.length>1?'s':''} non chargé{nomsVentesKO.length>1?'s':''} : {nomsVentesKO.join(', ')}. Ouvre {nomsVentesKO.length>1?'ces comptes':'ce compte'} sur vinted.fr, puis « Synchroniser ».
          </div>
        )}
        {/* (5 nov., chantier E2) UN COMPTE QUI ANNULE NETTEMENT PLUS QUE LES AUTRES, sur 30 jours.
            Mesuré par `annulationsParCompte` (src/annulationsCompte.js, la règle de Statistiques,
            jamais recopiée), jugé par `comptesQuiAnnulent` (src/ventesEcran.js). Dit UNE fois, avec
            les ventes concernées ; aucune alerte quand ce n'est pas su (lecture en cours, ratée ou
            partielle), ni pour un compte exclu. Sans geste à faire : ni ambre, ni rouge (§7). */}
        {Array.isArray(sales.items) && !sales.loading && !sales.error && (() => {
          const f = fenetreAnnulations();
          const R = annulationsParCompte({ ventes: sales.items, ko: (Array.isArray(sales.failedUids) ? sales.failedUids : []).map(String), de: f.de, a: f.a,
            estAnnulee: (o) => classifyOrderStatus(o.status) === 'cancelled', ecarte: (u) => acctOff(u), nomCompte: (o) => (o && o._acc ? accNameOf(o._acc) : '') });
          const alertes = comptesQuiAnnulent(R).filter((x) => !selEff || String(x.uid) === String(selEff));
          if (!alertes.length) return null;
          const jourA = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          return alertes.map((x) => (
            <section key={x.uid} className="vrm-annul-alerte" data-annulations-alerte={x.uid} data-annulations-n={String(x.annulees)} data-annulations-sur={String(x.n)} aria-label={`Annulations du compte ${x.compte}`}>
              <div className="vrm-annul-alerte-tete">
                <Icon name="info" size={18}/>
                <div style={{ minWidth: 0 }}>
                  <p className="vrm-annul-alerte-titre"><span className="vrm-sensible">{x.compte}</span> annule plus que tes autres comptes</p>
                  <p className="vrm-annul-alerte-sous">{x.annulees} annulation{x.annulees > 1 ? 's' : ''} sur {x.n} ventes en 30 jours ({pctFr(x.taux)}), contre {pctFr(x.tauxAutres)} sur tes autres comptes.</p>
                </div>
              </div>
              <details>
                <summary className="vrm-annul-alerte-voir">Voir {x.annulees > 1 ? `les ${x.annulees} ventes annulées` : 'la vente annulée'}<span aria-hidden="true">›</span></summary>
                {x.liste.map((v) => (
                  <div key={v.id} className="vrm-annul-ligne" data-annulation-vente={v.id}>
                    <span>{v.titre || 'Vente sans titre'}<small>{jourA(v.ts)}{v.eur != null ? ` · ${montant(v.eur)}` : ''}{v.statut && !/^commande annul[ée]e$/i.test(v.statut.trim()) ? ` · ${v.statut}` : ''}</small></span>
                    {v.lien ? <a href={v.lien} target="_blank" rel="noreferrer" aria-label={`Ouvrir sur Vinted : ${v.titre || 'la vente'}`}>Vinted ↗</a> : null}
                  </div>
                ))}
              </details>
            </section>
          ));
        })()}
        {sales.loading && !sales.items && <Skeleton variant="row" count={5}/>}
        {sales.error && <EtatPanne quoi="Tes ventes Vinted" raison="La lecture n’a pas répondu. Rien n’est perdu." onReessayer={()=>loadOrders('sold',setSales,true)}/>}
        {/* (5 nov., chantier E2) L'état vide dit ce qui va se passer : TOUTES les ventes arrivent ici
            (pas seulement les finalisées, comme le disait l'ancienne phrase). */}
        {sales.items && !sales.error && sales.items.length===0 && <div className="vrm-toutes-vide vrm-vide-dessin" data-ventes-vide=""><Illustration nom="etiquette" taille={110}/><p className="vrm-toutes-vide-titre">Aucune vente pour l’instant</p><p>Dès qu’un article part sur Vinted, il apparaît ici avec son état et son bordereau.</p></div>}
        {/* ⚠️ SUR ORDINATEUR, LA LISTE SE RANGE EN DEUX COLONNES.
            Une ligne de vente de 980 px pour une photo, un titre et un
            prix, c'est le meme defaut que les cartes d'action de Ma
            journee : on defile deux fois plus pour voir la meme chose.
            `auto-fit, minmax(min(430px, 100%), 1fr)` donne DEUX colonnes sur grand
            ecran et UNE sur telephone — la meme regle, sans test de
            largeur dans le JavaScript, donc rien a maintenir en double.
            Les lignes portent deja `flexWrap` et une largeur plancher
            (§26), elles supportent la colonne plus etroite. */}
        {/* Liste blanche groupée façon démo (comme Achats) : une seule surface,
            filets fins entre les lignes, lignes aérées — plus de cartes
            encadrées séparées. */}
        {/* ⚠️ UNE RAISON COMMUNE SE DIT UNE FOIS (§7). Si l'extension est
            absente, muette ou en retard, TOUS les boutons « Générer le
            bordereau » sont grisés pour la même raison : on la dit ici, au-dessus
            de la liste, au lieu de la répéter sous chaque vente. */}
        {nPropVentes > 1 && <div className="vrm-prix-proposes" data-prix-proposes={nPropVentes} style={{display:'flex',justifyContent:'flex-end',margin:'0 0 10px'}}><Bouton variante="secondaire" icone="check" data-prix-proposes-valider="" onClick={()=>validerPropositions([...propositionsPrix.m.keys()].filter(c=>c.startsWith('v:')))}>Valider les {nPropVentes} prix proposés</Bouton></div>}
        {/* (6 nov., vague 2 · E2 « ce qui reste ») LE PRIX D'ACHAT SE DIT UNE FOIS, EN TÊTE — comme Annonces
            (chantier C, `data-ann-achats`) : « Prix d'achat N/M connus · Compléter ». Compté sur les ventes
            affichées qui ont un coût (pas les annulées, ni une autre devise), avec la règle de la ligne
            (`beneficeLigneVente`). La case « Achat » de chaque ligne passe en gris (plus d'ambre répété). */}
        {Array.isArray(sales.items) && !sales.error && (()=>{
          const bd = bandeauPrixAchat(ventesAffichees, { annulee: (o) => classifyOrderStatus(o.status) === 'cancelled', masquee: isHidden,
            achatConnu: (o) => beneficeLigneVente(o.price?.amount, effEntry(o), { annulee: false }).achat != null });
          if (!bd) return null;
          const { n, m } = bd;
          return (
            <div className="vrm-ann-avis vrm-ventes-avis" data-ventes-avis="">
              <div className="vrm-ann-achats" data-ventes-achats={`${n}/${m}`} role="status">
                <span className="vrm-ann-achats-texte"><span className="vrm-ann-achats-nom">Prix d’achat</span><span className="vrm-ann-achats-n">{n}/{m}</span><span className="vrm-ann-achats-sous">connus</span></span>
                <Bouton variante="discret" data-ventes-achats-completer="" title="Le bénéfice ne compte que les prix d’achat connus" onClick={()=>setFillBuyOpen(true)}>{VERBES.completer}</Bouton>
              </div>
            </div>
          );
        })()}
        <RaisonBordereauxGrises ventes={ventesAffichees.filter(o=>o && o.transaction_id!=null && !isHidden(o) && classifyOrderStatus(o.status)!=='cancelled' && aExpedier(o) && !estParti(o) && !labelsCaptes[String(o.transaction_id)] && !bordParTx[String(o.transaction_id)])}/>
        {/* (9 nov.) Solo : les ventes des comptes d'achat, en aperçu (3 nettes, le reste flouté, aucun geste), jamais supprimées. */}
        {!dansPlateforme && <VentesHorsPlan ventes={Array.isArray(sales.items) ? sales.items.filter(o => o && !acctOffOf(o) && classifyOrderStatus(o.status) !== 'cancelled') : null}
          comptes={(accounts || []).map(a => ({ uid: String(a.vinted_user_id), nom: accNameOf(a) }))}
          aEnvoyer={(o) => aExpedier(o) && !estParti(o)} prix={(o) => (o.price && o.price.amount != null ? fmt(Number(o.price.amount)) : '')}
          onPro={() => { voirAbonnement(null); onNav && onNav('settings'); }}/>}
        {/* (8 nov., « restes ventes ») UNE PHRASE PAR GROUPE (§7) : ce que plusieurs lignes diraient
            à l'identique — la note « vue par e-mail » d'un compte, un refus de facture commun. */}
        {[...ventesEmailTete.values()].map((g) => <NoteVentesEmailTete key={g.uid} g={g} nom={g.acc ? accNameOf(g.acc) : ''}/>)}
        <FactureRaisonsTete deps={DEPS_FACTURE} ventes={groupeFacture}/>
        {ventesAffichees.length>1 && <div className="vrm-serie-entree" style={{display:'flex',justifyContent:'flex-end'}}><OuvrirSerie serie={serieVentes}/></div>}
        <BarreSerie serie={serieVentes} actions={actionsSerieVentes()} rendreIcone={iconeApp}/>
        <div className="vrm-ventes-liste" data-fu-liste="" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',boxShadow:C.shadow||'none'}}>
          <div className="vrm-ledger-heading" aria-hidden="true"><span>Article</span><span className="vrm-ledger-state-heading">État</span><span>Montant</span></div>
          {/* (1er nov.) Sur ordinateur : les colonnes Prix · Achat · Bénéfice (maquette « ventes-ordi »). */}
          <div className="vrm-ventes-entete" aria-hidden="true" data-ventes-entete-cols=""><span/><span>Article</span><span>État</span><span className="is-droite">Prix</span><span className="is-droite">Achat</span><span className="is-droite">Bénéfice</span><span/></div>
          {/* ⚠️ UNE FRAPPE NE RECRÉE PLUS LES 60 LIGNES AU RENDU URGENT (16 oct.).
              Mesuré (banc `ventes-frappe.cjs`, téléphone ×4) : chaque lettre
              recréait les 60 lignes au rendu urgent PUIS au rendu différé —
              jusqu'à 350 ms par lettre. Pendant le rendu urgent, seule la
              recherche a changé et la liste affichée reste l'ancienne
              (`ordSearchDiff` est en retard) : `LigneVenteVinted` garde alors la
              ligne déjà peinte. Le rendu différé, lui, refait tout comme avant
              — aucun comportement ne change. */}
          {ventesAffichees.slice(0, ventesMax).map((o,i)=>{ const gel = ordSearch!==ordSearchDiff; return <React.Fragment key={o.transaction_id}>{i === ventesSansDate.i ? <LigneSansDate n={ventesSansDate.n}/> : null}<LigneVenteVinted o={o} i={i} gel={gel} pre={gel?null:preparerLigneVente(o)} rendre={(o,i,pre)=>{
            if (!pre) pre = preparerLigneVente(o);
            const st = classifyOrderStatus(o.status);
            const hidden = pre.hidden;
            // (11 nov., lot ventes-lot) Une vente EN LOT : UNE ligne, les N° de ses articles (par
            // identité) et le prix d'achat du LOT (src/venteLot.js) — jamais celui d'un seul article.
            const lot = pre.lot;
            const e = lot && lot.lu ? entreeVenteLot(o, pre.e) : pre.e; const num = lot && lot.lu ? (lot.nums[0] || null) : e?.numero;
            const sell = o.price?.amount!=null?Number(o.price.amount):null;
            const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? (centimes(e.buyPrice)==null?null:centimes(e.buyPrice)/100) : null;
            const fees = chargesVente(e);
            const bilan = beneficePaire(o.price?.amount,e);
            const benef = st==='cancelled'?null:bilan.benefice;
            const ov = pre.ov;
            const baseE = pre.baseE;
            const photo = pre.photo;
            const sourcesPhoto = pre.sourcesPhoto;
            const clePhoto=JSON.stringify([String(o._acc?.vinted_user_id),String(o.transaction_id)]);
            // La ligne repliée et le détail déplié montrent LA MÊME photo : mêmes
            // sources, même choix partagé (`cle`), voir `PhotoVenteSources`.
            const photoSourcesProps={candidats:sourcesPhoto,cle:clePhoto,alt:'',loading:'lazy',decoding:'async',onSourceChargee:url=>photosVentesValides.current.set(clePhoto,url),onBesoinAlternative:()=>{photosVentesValides.current.delete(clePhoto);setPhotosVentesForcees(prev=>{const next=new Set(prev);next.add(clePhoto);return next;});}};
            const baseNum = baseE?.numero || '';
            const baseBuy = baseE && baseE.buyPrice!=null && String(baseE.buyPrice).trim()!=='' ? String(baseE.buyPrice) : '';
            // Les gestes passent par `actionsVentes` : une ligne gardée telle
            // quelle appelle quand même la version À JOUR de chaque fonction.
            const { imprimerBordereauVente, markPairLost, unmarkPairLost, onLocate, openPicker, rechargerLabels, setSaleOverride, toggleHidden, demanderDepose } = actionsVentesProxy;
            // (1er nov.) Prix · Achat · Bénéfice SUR LA LIGNE — la règle du tiroir
            // (`beneficePaire`, src/beneficeLigne.js) : « — » sans prix d'achat (le geste
            // « Prix d'achat » est sur la ligne), « au plus » tant que les frais ne sont
            // pas confirmés (ce qui manque ne peut que baisser le bénéfice).
            const devise = o.price?.currency_code;
            const lb = (devise && devise !== 'EUR') ? { etat:'prix', achat:null, benefice:null } : beneficeLigneVente(o.price?.amount, e, { annulee: st==='cancelled' });
            const propPrix = !hidden && st!=='cancelled' && buy==null ? propositionVente(o.transaction_id) : null;
            const coutManque = !hidden && st!=='cancelled' && buy==null && (!(e && e.buyFromId) || !!propPrix);
            const benefLigne = { etat: lb.etat, achatCentimes: lb.achat!=null ? Math.round(lb.achat*100) : null, benefCentimes: lb.benefice!=null ? Math.round(lb.benefice*100) : null,
              achatTxt: lb.achat!=null ? `${eurosLigne(lb.achat)}\u00a0€` : (st==='cancelled' ? '' : coutManque ? 'à saisir' : '—'), benefTxt: texteBenefice(lb.etat==='partiel' ? { ...lb, etat:'ok' } : lb),
              aria: lb.etat==='partiel' ? `Bénéfice : au plus ${texteBenefice({ ...lb, etat:'ok' })}, frais pas confirmés` : lb.etat==='achat' ? "Bénéfice : prix d'achat manquant" : undefined };
            // (1er nov.) « DÉPOSÉ » : seulement une vente À EXPÉDIER, pas encore cochée.
            const txL = String(o.transaction_id);
            const deposeIci = !!(deposeVente.attente && deposeVente.attente.cle === txL);
            // (6 nov.) Une vente vue par e-mail, pas encore relue sur Vinted : aucun geste d'envoi
            // ici (ni « Déposé », ni bordereau) tant que Vinted n'a pas rendu son état.
            const peutDeposer = !o._venteEmail && !hidden && st!=='cancelled' && aExpedier(o) && !estParti(o) && o.transaction_id!=null;
            // (8 nov., « restes ventes ») La note « vue par e-mail » de ce compte est dite en tête (§7).
            const emailEnTete = !!(o._venteEmail && o._acc && ventesEmailTete.has(String(o._acc.vinted_user_id || '')));
            const libDepose = num ? `N°${num}` : (o.title || '');
            const gesteCout = coutManque ? <CoutAchatVente surLigne propose={propPrix} onUtiliser={propPrix ? ()=>appliquerProposition('v:'+o.transaction_id, propPrix) : null} onSaisir={p=>setSaleOverride(o.transaction_id,{buyPrice:p})}
                  onRelier={(autre)=>{ const idf = identiteAnnonce(o); const _autre = autre ? '1' : undefined; openPicker(idf ? { id: idf, title: o.title, photo: photo, price: sell, _acc: o._acc, _dateRef: o.date, _autre } : { id: '_v'+o.transaction_id, _saleTx: String(o.transaction_id), title: o.title, photo: photo, price: sell, _acc: o._acc, _dateRef: o.date, _autre }); }}/> : null;
            // (6 nov., vague 2 · point 1) Vente annulée AVANT l'envoi, paire chez lui : « Remettre en
            // vente » (SON clic → « Republier à la main » depuis le coffre, src/annuleesChezToi.js).
            const annChez = annulChezParTx.get(txL) || null;
            const gesteRemise = annChez ? <div className="vrm-remise-ligne" data-remise-vente={txL} data-remise-etat={annChez.etat} data-remise-num={annChez.sansNum ? 'sans' : annChez.archive ? 'archive' : 'garde'}>
                {annChez.item ? <Bouton variante="secondaire" icone="sync" data-remettre-vente={txL} onClick={()=>remettreEnVente(annChez)}>{annChez.etat === 'en-cours' ? 'Reprendre la remise en vente' : 'Remettre en vente'}</Bouton> : null}
                {annChez.sansNum ? <span className="vrm-remise-note" data-remise-sans-num="">Paire pas reliée</span> : !annChez.item ? <span className="vrm-remise-note">Annonce pas identifiée</span> : null}
              </div> : null;
            const gesteDepose = peutDeposer ? <Bouton variante="secondaire" icone="check" className="vrm-depose-bouton" data-depose-vente={txL} data-sans-glisse="" disabled={deposeIci} aria-label={`Marquer ${libDepose || 'ce colis'} déposé`} onClick={()=>demanderDepose(txL, o, libDepose)}>Déposé</Bouton> : null;
            // ── (1er nov.) LE RÉCAPITULATIF DE LA VENTE — maquette A, « fiche en lignes nettes »
            // (Julien : « applique tout, je veux que ce soit clair »). De haut en bas : la paire
            // (photo, N° seulement si l'identité le donne, nom, taille), UNE phrase d'état et la
            // frise (src/recapVente.js : une étape n'est cochée que PROUVÉE), l'argent en lignes
            // (mêmes règles qu'avant : `beneficeLigneVente`/`beneficePaire`), les détails, puis
            // les gestes — les MÊMES fonctions et écritures que l'ancien tiroir, rien de retiré.
            // ⚠️ La frise REMPLACE la pastille de statut ici (jamais les deux, cf. 28 sept.).
            // (2 nov., Fusion) LES PREUVES DE LA FRISE, lues une fois : le tiroir (cinq
            // étapes) et la ligne (quatre segments, `friseVenteFusion`) passent par la
            // MÊME `friseVente` — une règle, deux formes.
            const preuvesFrise = preuvesFriseDe(o);
            const fuEtapes = preuvesFrise.etapes ? friseVenteFusion(preuvesFrise.etapes, { geste: peutDeposer, verification: preuvesFrise.verification }) : null;
            // Le transporteur : la règle de la pastille (`transporteurVente` → `transporteurDuColis`), la même que le tiroir.
            const fuTransp = transporteurVente(preuvesFrise.bordE);
            const fuPdf = !!(labelsCaptes[txL] || bordParTx[txL]);
            const recapVente = ({ titreId, fermerRef, fermer }) => {
              const { s, tus, vs, horsParcours, bordE, bordC, posteMain, finalisee, versement, etapes } = preuvesFrise;
              const aExp = !hidden && st !== 'cancelled' && aExpedier(o) && !posteMain;
              const phrase = phraseVente({ etat: vs.label, aide: vs.aide, etapes: etapes || [], aExpedier: aExp, posteMain, verification: preuvesFrise.verification });
              const jourCourt = (t) => t == null ? '' : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
              const taille = String((e && e.size) || o.size || '').trim();
              const nom = o.title || '(sans titre)';
              // (11 nov., lot ventes-lot) Un lot : la taille et l'état d'UN article ne le décrivent pas — chaque article a les siens plus bas.
              const sousTitre = lot ? '' : [taille && !tailleDansTitre(o.title, taille) ? `Taille ${taille}` : '', pre.etatArticle || ''].filter(Boolean).join(' · ');
              // L'argent : la règle de la ligne (`lb`), aucune autre.
              const autreDevise = !!(devise && devise !== 'EUR');
              // (10 nov., lot BA) LE COÛT RÉEL : la règle du bénéfice DÉCOMPOSÉE (src/coutVente.js) —
              // vente − achat − frais − emballage = bénéfice, au centime ; l'emballage non saisi est NOMMÉ.
              const cv = cascadeVente(o.price?.amount, e, { annulee: st === 'cancelled', autreDevise });
              const fraisConnus = !autreDevise && cv.frais != null && cv.frais > 0 ? cv.frais / 100 : null;
              const benefTexte = lb.benefice == null ? '—' : eurosRecap(lb.benefice);
              const benefAide = st === 'cancelled' ? '' : lb.etat === 'partiel' ? 'frais pas confirmés' : lb.etat === 'illisible' ? 'un montant saisi est illisible' : lb.etat === 'prix' ? (autreDevise ? 'vente dans une autre devise' : 'prix de vente pas lu') : '';
              // (10 nov., lot BE) « Versé sur ton porte-monnaie » est l'étape « Versée » de la frise (sa date, une fois).
              const acheteur = o.user_login || (o.buyer && o.buyer.login) || (o.opposite_user && o.opposite_user.login) || '';
              const aRelie = !hidden && st !== 'cancelled' && e && e.buyFromId ? achatRelie(e) : null;
              const saleItem = (() => { const idf = identiteAnnonce(o); return idf ? { id: idf, title: o.title, photo: photo, price: sell, _acc: o._acc } : { id: '_v'+o.transaction_id, _saleTx: String(o.transaction_id), title: o.title, photo: photo, price: sell, _acc: o._acc }; })();
              const cell = num && aExpedier(o) ? garageCellOf(garageGrid, num) : null;
              const lienVinted = o.conversation_id ? `https://www.vinted.fr/inbox/${encodeURIComponent(o.conversation_id)}` : (o.transaction_id != null ? `https://www.vinted.fr/member/transactions/${encodeURIComponent(o.transaction_id)}` : '');
              // (1er nov., audit A9) Une perte ne « libère » aucun numéro : elle sort
              // du stock, sa case est vidée, son N° n'est jamais redonné (§5).
              // `k` marque une ancienne paire (N° B…) qui prendra un numéro neuf.
              const issue = (() => {
                // (6 nov., vague 2 · point 1) Annulée AVANT l'envoi (prouvé par la transaction) : la paire
                // n'est jamais partie, elle est chez lui — le geste est « Remettre en vente ».
                if (annChez) return { k: annChez.archive ? 'remise-archive' : 'remise', t: annChez.sansNum ? 'La paire n’est jamais partie : elle est chez toi. Paire pas reliée (cette vente n’a pas de N°).' : annChez.archive ? `La paire n’est jamais partie : elle est chez toi. Le N°${num} est un ancien numéro : remise en vente, elle en prendra un neuf.` : `La paire n’est jamais partie : elle est chez toi. Remise en vente, elle garde le N°${num}.` };
                if (!(st === 'cancelled' && num)) return null;
                const out = saleOutcome(o); const arch = !numeroReprenable(num);
                if (isPairLost(num)) return { t: `N°${num} déclarée perdue : elle est sortie du stock et sa case au garage est vidée. Son numéro n'est jamais redonné à une autre paire.` };
                if (out === 'retour') return arch ? { k: 'retour', t: `La paire te revient. Le N°${num} est un ancien numéro : elle prendra un numéro neuf à sa republication.` } : { t: `La paire te revient : elle garde le N°${num}, republie-la avec le même.` };
                if (out === 'suspendue') return { t: `Rien n'est tranché : le N°${num} est conservé.` };
                return arch ? { k: 'renvoi', t: `Si la paire t'est renvoyée, elle prendra un numéro neuf (le N°${num} est un ancien numéro).` } : { t: `Si la paire t'est renvoyée, republie-la avec le N°${num}.` };
              })();
              const bordGeste = !hidden && st !== 'cancelled' && aExpedier(o) && !estParti(o) && o.transaction_id != null;
              // (2 nov.) Le transporteur LU de la vente (n° de SON bordereau) : à côté du bouton
              // bordereau tant qu'il y a un colis à envoyer, sinon une ligne des détails (dit une fois).
              const trRecap = transporteurVente(bordE);
              return <>
                <header className="vrm-recap-tete">
                  <div className="vrm-sale-photo vrm-recap-photo">{photo ? <PhotoArticleAgrandissable src={photo} titre={o.title}><PhotoVenteSources {...photoSourcesProps} data-photo-vente="detail" style={{width:'100%',height:'100%',objectFit:'cover'}}/></PhotoArticleAgrandissable> : <Icon name="image" size={22} style={{color:C.muted,opacity:.55}}/>}</div>
                  <div className="vrm-recap-ident">
                    {lot && lot.lu && lot.nums.length > 1 ? <span className="vrm-recap-nums-lot" data-recap-num={lot.nums.join(',')}>{lot.nums.map((n) => <Numero key={n} n={n} taille="grand"/>)}</span> : num ? <Numero n={num} taille="grand" data-recap-num={num}/> : <span className="vrm-recap-sans-num" data-recap-num="" title="Pas de numéro VRM confirmé pour cette vente : aucune fiche n’est choisie au hasard.">Sans N° VRM</span>}
                    <h2 id={titreId} className="vrm-recap-nom">{nom}</h2>
                    {sousTitre ? <p className="vrm-recap-sous">{sousTitre}</p> : null}
                  </div>
                  <button ref={fermerRef} type="button" className="vrm-recap-fermer" aria-label="Fermer les détails de la vente" onClick={fermer}><Icon name="close" size={18}/></button>
                </header>
                <section className="vrm-recap-etat" data-recap-etat={vs.label}>
                  <p className="vrm-recap-phrase" data-recap-phrase=""><strong>{phrase.gras}</strong>{phrase.suite ? ' ' + phrase.suite : ''}</p>
                  {issue ? <p className="vrm-recap-issue" data-retour-archive={issue.k}>{issue.t}</p> : null}
                  {o._fromEmail ? <p className="vrm-recap-issue">Reconstituée depuis l'email — pas encore confirmée par Vinted.</p> : null}
                  {pre.litige && !pre.litige.ancien ? (() => { const l = pre.litige; const lim = texteLimiteLitige(l); return (
                    <div className="vrm-recap-litige" data-recap-litige={l.genre} data-litige-limite={l.limite || ''} data-litige-cle={l.cle}>
                      <p className="vrm-recap-issue"><strong>{LIBELLE_LITIGE[l.genre] || 'Litige'}</strong>{' · '}{lim ? `avant le ${lim}` : 'délai non lu'}</p>
                      <Bouton variante="secondaire" className="vrm-b-petit" href={l.geste.url} target="_blank" rel="noreferrer" data-litige-geste={l.geste.url}>{l.geste.libelle} ↗</Bouton>
                    </div>); })() : null}
                  {/* (10 nov., lot BE) LA FRISE PROUVÉE : sept étapes, chacune seulement si SA preuve est lue
                      (src/friseProuvee.js) — jamais déduite ; litige / retour / annulation en bifurcation.
                      Elle remplace ici la frise de la ligne (4 segments, inchangée sur la ligne). */}
                  {pre.frisePv ? <FriseVente frise={pre.frisePv.frise} transporteur={trRecap} verse={pre.frisePv.verse} bordereau={pre.frisePv.bordereau} cle={txL}/> : null}
                </section>
                {lot ? <ArticlesLotVente lot={lot} devise={devise || 'EUR'} tx={txL} onRelier={hidden || st === 'cancelled' ? null : relierArticleLot}/> : null}
                <section className="vrm-recap-argent" aria-label="L'argent">
                  <h3 className="vrm-recap-titre">L'argent</h3>
                  {st !== 'cancelled' ? <BarreCoutVente c={cv}/> : null}
                  <dl>
                    <div className="vrm-recap-ligne"><dt>Prix de vente</dt><dd data-prix-vente={sell!=null?Math.round(sell*100):undefined}>{sell==null ? '—' : autreDevise ? `${String(sell).replace('.',',')} ${cur(devise)}` : eurosRecap(sell)}</dd></div>
                    {st !== 'cancelled' ? <div className="vrm-recap-ligne" data-recap-achat={lb.achat != null ? lb.achat.toFixed(2) : ''}><dt><PointCout cle="achat"/>Prix d’achat</dt><dd>{lb.achat != null ? eurosRecap(-lb.achat) : coutManque ? <CoutAchatVente recap propose={propPrix} onUtiliser={propPrix ? ()=>appliquerProposition('v:'+o.transaction_id, propPrix) : null} onSaisir={p=>setSaleOverride(o.transaction_id,{buyPrice:p})} onRelier={(autre)=>openPicker({ ...saleItem, _dateRef: o.date, _autre: autre ? '1' : undefined })}/> : '—'}</dd></div> : null}
                    {fraisConnus != null ? <div className="vrm-recap-ligne" data-recap-frais={fraisConnus.toFixed(2)}><dt><PointCout cle="frais"/>Frais</dt><dd>{eurosRecap(-fraisConnus)}</dd></div> : null}
                    {st !== 'cancelled' && !autreDevise ? <div className="vrm-recap-ligne" data-recap-emballage={cv.emballage != null ? String(cv.emballage) : cv.emballageSaisi ? 'illisible' : 'non-saisi'}><dt><PointCout cle="emballage"/>Emballage</dt><dd>{cv.emballage != null ? eurosRecap(-cv.emballage / 100) : (hidden || cv.emballageSaisi) ? '—' : <SaisieEmballage onSaisir={v=>setSaleOverride(o.transaction_id,{emballage:v})}/>}</dd></div> : null}
                    {st !== 'cancelled' ? <div className="vrm-recap-ligne vrm-recap-benef" data-recap-benef-etat={lb.etat} data-benef-vente={benef!=null?benef.toFixed(2):undefined}><dt><PointCout cle="benefice"/>Bénéfice</dt><dd><span className="vrm-recap-valeur">{lb.etat === 'partiel' ? <span className="vrm-recap-borne">au plus </span> : null}<span className="vrm-recap-montant">{benefTexte}</span></span>{benefAide ? <small>{benefAide}</small> : null}</dd></div> : null}
                  </dl>
                </section>
                <section className="vrm-recap-details" aria-label="Détails">
                  <dl>
                    {acheteur ? <div className="vrm-recap-ligne"><dt>Acheteur</dt><dd>{acheteur}</dd></div> : null}
                    <div className="vrm-recap-ligne" data-vente-acces=""><dt>Compte</dt><dd><CompteVente compte={o._acc ? (accNameOf(o._acc) || null) : null} plateforme="vinted" ou="detail"/> · Vinted</dd></div>
                    {/* (10 nov., lot U) L'avis de l'acheteur, relié par n° de transaction SEULEMENT (src/avisVente.js). */}
                    {o.transaction_id != null && st !== 'cancelled' && o._acc ? <AvisVente uid={o._acc.vinted_user_id} tx={String(o.transaction_id)} lire={lireAvisCompte}/> : null}
                    {(!etapes || !o.date) ? <div className="vrm-recap-ligne"><dt>Vendue</dt><dd>{o.date ? dateFr(o.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '— date pas lue'}</dd></div> : null}
                    {!bordGeste && (trRecap.cle || trRecap.nom) ? <div className="vrm-recap-ligne"><dt>Transporteur</dt><dd><PastilleTransporteur t={trRecap} C={C} seul data-recap-transporteur=""/></dd></div> : null}
                    {bordE && bordE.suivi ? <div className="vrm-recap-ligne"><dt>Suivi</dt><dd className="vrm-recap-mono">{bordE.suivi}</dd></div> : null}
                    {/* (10 nov., lot AZ) La photo du carton fermé, rangée avec CETTE vente (son n° de transaction). */}
                    {o.transaction_id != null && st !== 'cancelled' ? <PhotoCartonVente site="vinted" tx={txL} num={num || ''}/> : null}
                    {cell ? <div className="vrm-recap-ligne"><dt>Rangement</dt><dd><button type="button" className="vrm-lien-action" onClick={()=>{fermer();onLocate&&onLocate(num);}} title="Voir la paire au stock">{garageCellLabel(cell)}</button></dd></div>
                      : (num && aExpedier(o) && garageUtilise) ? <div className="vrm-recap-ligne"><dt>Rangement</dt><dd>pas au garage</dd></div> : null}
                    {aRelie ? <div className="vrm-recap-ligne" data-recap-achat-relie=""><dt>Achat relié</dt><dd><span className="vrm-recap-achat-photo">{orderPhoto(aRelie) ? <PhotoVinted src={orderPhoto(aRelie)} alt="Photo de l'achat" data-photo-achat="1" loading="lazy" decoding="async"/> : null}</span>{[aRelie.date ? new Date(aRelie.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '', 'Vinted'].filter(Boolean).join(' · ')}</dd></div> : null}
                  </dl>
                </section>
                <section className="vrm-recap-gestes" aria-label="Actions">
                  {bordGeste ? <div className="vrm-recap-principal vrm-rangee-bord" data-rangee-bord=""><PastilleTransporteur t={trRecap} C={C} data-recap-transporteur=""/><BoutonBordereau grand uid={o._acc && o._acc.vinted_user_id} tx={String(o.transaction_id)} conv={o.conversation_id} login={accNameOf(o._acc)}
                    aGenerer pdf={!!(labelsCaptes[txL] || bordParTx[txL])} onImprimer={()=>imprimerBordereauVente(o)} onFait={(u)=>rechargerLabels(u)}/></div> : null}
                  <div className="vrm-recap-grille">
                    {o.conversation_id && onNav ? <Bouton variante="secondaire" icone="chat" data-recap-conversation="" onClick={()=>{ fermer(); poserCible({ type: 'conv', conv: String(o.conversation_id), compte: String((o._acc && o._acc.vinted_user_id) || '') }, redirigerOnglet('cat_msg', null, ONGLETS_DEPLACES).tab); onNav('cat_msg'); }}>Conversation</Bouton> : null}
                    {num ? <Bouton variante="secondaire" icone="doc" data-recap-fiche={num} aria-label={`Fiche N°${num}`} onClick={()=>{fermer();window.dispatchEvent(new CustomEvent('vrm:fiche-paire',{detail:String(num)}));}}>Fiche de la paire</Bouton> : null}
                    {/* (11 nov.) « Me le rappeler » : par le n° de transaction (§5), jamais le titre. */}
                    {o.transaction_id != null ? <BoutonRappel variante="grille" cible={{ sorte: 'vente', tx: String(o.transaction_id), num: num || '', plat: 'vinted' }} libelle={num ? `N°${num} · ${nom}` : nom}/> : null}
                    {lienVinted ? <Bouton variante="secondaire" href={lienVinted} target="_blank" rel="noreferrer" data-recap-vinted="">Voir sur Vinted ↗</Bouton> : null}
                    {num && aExpedier(o) && !hidden && inGarage(num) ? <Bouton variante="secondaire" icone="pin" onClick={()=>{fermer();onLocate&&onLocate(num);}} aria-label="Voir au stock">Voir au stock</Bouton> : null}
                    {/* (11 nov., lot ventes-lot) Les articles d'un lot PROUVÉ sont dans le récapitulatif (section
                        « Lot · N articles ») ; « Voir le lot » (lecture en direct) ne reste que pour un titre
                        « Lot » dont la transaction n'est pas dans la base. */}
                    {isLotTitle(o.title) && !(lot && lot.lu) ? <Bouton variante="secondaire" icone="box" onClick={async(ev)=>{ lotOrigineRef.current = ev.currentTarget; setLotView({loading:true,order:o,items:[]}); const items=await fetchLotItems(o._acc,o.transaction_id); setLotView({loading:false,order:o,items}); }} title="Voir les paires du lot" aria-label="Voir les paires du lot">Voir le lot</Bouton> : null}
                    {annChez && annChez.item ? <Bouton variante="secondaire" icone="sync" data-recap-remettre={txL} onClick={()=>{ fermer(); remettreEnVente(annChez); }}>{annChez.etat === 'en-cours' ? 'Reprendre la remise en vente' : 'Remettre en vente'}</Bouton> : null}
                    {annChez ? <Bouton variante="discret" data-recap-remise-faite={txL} title="Tu l’as déjà remise en vente toi-même : VRM ne le redit plus" onClick={()=>poserAnnuleeReglee(txL)}>Déjà remise en vente</Bouton> : null}
                    {!annChez && st==='cancelled' && num && saleOutcome(o)==='rembourse' && !isPairLost(num) ? <Bouton variante="secondaire" onClick={()=>markPairLost(num,o)} title={`Tu as remboursé l'acheteur. Si l'article ne revient PAS, déclare-le perdu : le N°${num} sera libéré et sa case au garage vidée.`} aria-label="Déclarer l'article perdu">Article perdu ?</Bouton> : null}
                    {num && isPairLost(num) ? <Bouton variante="discret" onClick={()=>unmarkPairLost(num)} title={`Annuler : l'article N°${num} est finalement revenu.`} aria-label="Annuler article perdu">Il est revenu</Bouton> : null}
                  </div>
                  {(o._fromEmail ? o._txMail : o.transaction_id != null) ? <FactureVente deps={DEPS_FACTURE} vente={{ tx: String(o._fromEmail ? o._txMail : o.transaction_id), uid: o._acc && o._acc.vinted_user_id, compte: o._acc && o._acc.login, titre: o.title || '', centimes: sell != null && !autreDevise ? Math.round(sell * 100) : null, venteLe: o.date || '', commandes: commandesParTx.get(String(o._fromEmail ? o._txMail : o.transaction_id)) || [] }}/> : null}
                  <details className="vrm-sale-details vrm-recap-modifier"><summary title="Numéro, coût d’achat, frais">N° et frais</summary>
                    {!hidden && <CoutsVente entry={e} onSave={patch=>setSaleOverride(o.transaction_id,patch)} theme={C}/>}
                    {!hidden && (
                      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',minWidth:0}}>
                        <div title={num?undefined:"Article pas encore identifié automatiquement : pose son N° ici"} style={{display:'flex',alignItems:'center',gap:3,border:`1px solid ${C.border}`,borderRadius:12,padding:'5px 7px',background:C.bg,width:74,flexShrink:0}}>
                          <span style={{fontSize:11,color:C.muted,fontWeight:500}}>N°</span>
                          <ChampSaisie value={ov.numero ?? ''} onCommit={v=>setSaleOverride(o.transaction_id,{numero:v})} placeholder={baseNum||'?'} inputMode={clavierNum()} style={{width:'100%',minWidth:0,border:'none',background:'transparent',color:C.text,fontSize:13,fontWeight:500,outline:'none'}}/>
                        </div>
                        {/* (30 oct.) Tant que « Saisir le prix d'achat » est visible plus haut, ce champ
                            ferait la même chose une seconde fois (même écriture) : il ne revient qu'une
                            fois le coût connu, pour le CORRIGER. */}
                        {!coutManque && <div style={{flex:'1 1 140px',minWidth:0,display:'flex',alignItems:'center',gap:3,border:`1px solid ${C.border}`,borderRadius:12,padding:'5px 8px',background:C.bg}}>
                          <ChampSaisie value={ov.buyPrice ?? ''} onCommit={v=>setSaleOverride(o.transaction_id,{buyPrice:v})} placeholder={baseBuy?`achat ${baseBuy}€ (auto)`:"prix d'achat"} inputMode="decimal" style={{width:'100%',minWidth:0,border:'none',background:'transparent',color:C.text,fontSize:13,fontWeight:500,outline:'none'}}/>
                          <span style={{fontSize:11,color:C.muted}}>€</span>
                        </div>}
                        {(ov.numero!=null||ov.buyPrice!=null) && <span style={{fontSize:11,color:C.muted,flexShrink:0}} title="Valeurs saisies à la main pour cette vente (priment sur l'auto)">✎</span>}
                      </div>
                    )}
                    {aRelie ? <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      <Bouton variante="secondaire" icone="doc" data-recu-relie={String(aRelie.transaction_id||'')} disabled={recuOuverture===String(aRelie.transaction_id||'')} onClick={()=>ouvrirRecuRelie(aRelie, num)} title="Ouvrir le reçu d'achat" aria-label="Reçu d'achat">Reçu d’achat</Bouton>
                      <Bouton variante="discret" data-recap-changer-achat="" onClick={()=>openPicker(saleItem)} title="Relier un autre achat à cette vente, ou le délier">Changer l’achat relié</Bouton>
                    </div> : null}
                  </details>
                </section>
              </>;
            };
            return (
              /* (11 nov., gestes-glisser) Glisser vers la gauche : « Déposé » (principale, le glisser long) et
                 « Imprimer » quand le PDF est là — les MÊMES fonctions que les boutons de la ligne
                 (`demanderDepose` et sa barre « Annuler » 5 s ; `imprimerBordereauVente`). */
              <LigneGlissable actif={peutDeposer && !deposeIci} cle={txL} libelle={libDepose || 'vente'} actions={[
                { cle: 'depose', libelle: 'Déposé', icone: <Icon name="check" size={18}/>, faire: ()=>demanderDepose(txL, o, libDepose), data: { 'data-lg-depose': txL } },
                fuPdf ? { cle: 'imprimer', libelle: 'Imprimer', icone: <Icon name="printer" size={18}/>, faire: ()=>imprimerBordereauVente(o), data: { 'data-lg-imprimer': txL } } : null,
              ]}>{(gp, tiroirG) => (
              // Ligne de vente dans la liste groupée (filet fin entre les lignes,
              // pas de carte encadrée séparée — style démo, comme Achats).
              <LigneVenteCompacte montantCentimes={sell!=null?Math.round(sell*100):undefined} numerosArticle={lot && lot.lu ? lot.nums : (num?[num]:[])} plateforme="vinted" photo={photo} photoNoeud={<><CaseSerie serie={serieVentes} cle={txL} etiquette={o.title} surPhoto/>{photo?<PhotoVenteSources {...photoSourcesProps} data-photo-vente="ligne" style={{width:28,height:36,borderRadius:12,objectFit:'cover',flexShrink:0}}/>:<PhotoVente src={photo} size={46} portrait/>}</>} titre={(()=>{ const t=String((e&&e.size)||o.size||'').trim(); const nom=t&&!tailleDansTitre(o.title,t)?`${o.title} · taille ${t}`:o.title; return nom; })()} numTitre={num||''}
                {...avecSerie(gp, serieVentes.ligne(txL))} glisse={tiroirG} benef={benefLigne} recap={recapVente} data-depose-attente={deposeIci?'1':undefined}
                data-fu-ligne="" fusion={{ lot: lot ? { n: lot.n, nums: lot.nums || [], nonRelies: lot.nonRelies || 0 } : null, transp: peutDeposer ? null : fuTransp, prix: montant(sell, { devise: o.price?.currency_code || 'EUR' }), nom: String(o.title||'').replace(/[\s,·-]*(?:taille|t\.?)\s*[\d.,/ ]+(?:\s*(?:eu|fr|us|uk))?\s*$/i,'').trim() || o.title, num, site: 'vinted', siteNom: 'Vinted', taille: lot ? '' : String((e&&e.size)||o.size||'').trim() || ((String(o.title||'').match(/taille\s*([\d.,/]+)/i)||[])[1]||'') }} frise={<>{fuEtapes ? <Frise etapes={fuEtapes} cle={txL} className="vrm-fu-ligne-frise" label="Où en est la vente"/> : null}{(o._fromEmail ? o._txMail : o.transaction_id != null) ? <FactureVenteLigne deps={DEPS_FACTURE} groupe={groupeFacture} vente={{ tx: String(o._fromEmail ? o._txMail : o.transaction_id), uid: o._acc && o._acc.vinted_user_id, compte: o._acc && o._acc.login, titre: o.title || '', venteLe: o.date || '', commandes: commandesParTx.get(String(o._fromEmail ? o._txMail : o.transaction_id)) || [] }}/> : null}</>}
                data-vente-email-tete={o._venteEmail && emailEnTete ? String(o._acc.vinted_user_id) : undefined}
                bas={o._venteEmail && emailEnTete && !toShipEmailTx.has(txL) ? null : o._venteEmail ? <>
                  {emailEnTete ? null : <NoteVenteEmail o={o}/>}
                  {/* (8 nov.) Le bordereau reçu par e-mail porte le MÊME n° de transaction : il s'imprime
                      tout de suite, avec le N° seulement s'il est sûr (src/bordereauVenteEmail.js). */}
                  {toShipEmailTx.has(txL) ? <div className="vrm-rangee-bord" data-rangee-bord="" data-sans-glisse="" data-vente-email-bord={txL}>
                    <PastilleTransporteur t={fuTransp} C={C} className="vrm-fu-transp" data-fu-transporteur=""/>
                    <button type="button" className="vrm-fu-principal" data-fu-geste="" data-fu-imprimer={txL} data-fu-imprimer-num={num || ''} onClick={()=>imprimerBordereauVente(o)}><Icon name="printer" size={16}/><span className="vrm-lib-long">Imprimer le bordereau</span><span className="vrm-lib-court">Imprimer</span></button>
                  </div> : null}
                  {toShipEmailTx.has(txL) && (!num || bordsSansNum[txL]) ? <div data-vente-sans-num={num ? 'avec' : 'sans'} data-sans-glisse="" style={{fontSize:12,fontWeight:600,color:C.warn,overflowWrap:'anywhere'}}>{phraseImprimeSansNumero(bordsSansNum, txL, num) || MENTION_SANS_NUM}</div> : null}
                </> : peutDeposer ? <>
                  {/* (2 nov., 22 h 30) Une vente à expédier porte TOUJOURS la rangée de la maquette : la puce du
                      transporteur et le bouton bordereau (« Imprimer le bordereau » si le PDF est là, sinon
                      « Générer le bordereau », l'extension) ; « Déposé » vient après. */}
                  <div className="vrm-rangee-bord" data-rangee-bord="" data-sans-glisse="">
                    <PastilleTransporteur t={fuTransp} C={C} className="vrm-fu-transp" data-fu-transporteur=""/>
                    {fuPdf
                      ? <button type="button" className="vrm-fu-principal" data-fu-geste="" data-fu-imprimer={txL} onClick={()=>imprimerBordereauVente(o)}><Icon name="printer" size={16}/><span className="vrm-lib-long">Imprimer le bordereau</span><span className="vrm-lib-court">Imprimer</span></button>
                      : <BoutonBordereau grand uid={o._acc && o._acc.vinted_user_id} tx={txL} conv={o.conversation_id} login={accNameOf(o._acc)} aGenerer pdf={false} onFait={(u)=>actionsVentesProxy.rechargerLabels(u)}/>}
                  </div>
                  {gesteDepose ? <div className="vrm-fu-apres" data-sans-glisse="">{gesteDepose}</div> : null}
                </> : gesteRemise} basSeul={!peutDeposer && !!gesteRemise} gestes={gesteCout ? <div className="vrm-gestes-pile">{gesteCout}</div> : null} compte={o._acc ? (accNameOf(o._acc) || null) : null} sous={o.date?dateFr(o.date, {day:'numeric',month:'short'}):''} etat={motEtatVente(venteStage(o).label)} ton={st!=='cancelled' && aExpedier(o) && !estParti(o) ? 'action' : (st==='cancelled' ? 'annule' : '')} montant={montant(sell, { devise: o.price?.currency_code || 'EUR' })} className="vrm-sale-row" key={o.transaction_id} data-tx={String(o.transaction_id)} data-cible={attrCible(['vente',String(o.transaction_id)])} style={{borderTop:i>0?`1px solid ${C.border}`:'none',opacity:hidden?0.5:(st==='cancelled'&&!annChez?0.6:1),padding:'12px 14px',display:'flex',flexDirection:'column',gap:10,...(estFloute(o)?STYLE_FLOU:null),...(gp.style||{})}}>
              </LigneVenteCompacte>
              )}</LigneGlissable>
            );
          }}/></React.Fragment>; })}
        </div>
        <BarreAnnulerDepose attente={deposeVente.attente} onAnnuler={deposeVente.annuler} zIndex={Z_CONFIRMATION - 1}/>
        {/* ⚠️ RIEN N'EST CACHÉ : le compte total est écrit sur le bouton, et
            un clic ouvre la suite. On dessine 60 cartes au lieu de 287 — sur
            iPhone, la page passait de 46 209 px (cinquante-quatre écrans) à
            une longueur qu'on peut parcourir. Les totaux du haut, eux, portent
            TOUJOURS sur l'ensemble : ils ne dépendent pas de cette tranche. */}
        {ventesAffichees.length > ventesMax && (
          <Bouton variante="secondaire" plein onClick={()=>React.startTransition(()=>setVentesMax(n=>n+120))} style={{marginTop:10}}>
            Afficher {Math.min(120,ventesAffichees.length-ventesMax) > 1 ? `les ${Math.min(120,ventesAffichees.length-ventesMax)} suivantes` : 'la suivante'}{ventesAffichees.length-ventesMax > 120 ? ` · encore ${ventesAffichees.length-ventesMax-120} après` : ''}
          </Bouton>
        )}
        {/* (29 oct., « un peu moche ») Les contrôles passent SOUS la liste : avant la
            première vente il y avait huit blocs empilés. Ils restent tous là, repliés. */}
        <section className="vrm-ventes-controles" data-ventes-controles="" style={{display:'flex',flexDirection:'column',gap:8,margin:'16px 0 12px'}}>
          <h3 data-titre-section="" style={{fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15,margin:'0 2px'}}>Vérifications</h3>
  {/* (5 nov., revue 2.30) La fraîcheur (« Données ») et « Vendus ailleurs » ne se redisent plus
      ici : la fraîcheur vit dans la coque, « Vendus ailleurs » dans Ma journée. */}
  <GelPendantFrappe gel={ordSearch!==ordSearchDiff} rendre={()=><>
        {/* (5 nov., chantier E2) Comparer n'a de sens qu'à partir de DEUX comptes (revue 2.12 : pas de
            lignes par compte avec un seul compte). */}
        {accounts.filter(a=>!acctOff(a.vinted_user_id)).length>1 && <ComparaisonComptesVinted rows={comparerComptes({comptes:accounts.filter(a=>!acctOff(a.vinted_user_id)).map(a=>({uid:String(a.vinted_user_id),nom:accName(a)})),ventes:sales.items||[],stock:(listings.items||[]).filter(it=>!acctOffOf(it)&&!blockedAccts.has(String(it._acc?.vinted_user_id))&&!soldManual.has(String(it.id))&&!annoncesVendues.has(String(it.id))),dansPeriode:o=>dansPeriode(o,periode),finalisee:o=>classifyOrderStatus(o.status)==='completed',masquee:isHidden,meta:effEntry,aFaire:o=>aExpedier(o)&&!isShipDone(o)})} periode={libellePeriode(periode)} disponible={Array.isArray(sales.items)&&!sales.loading&&!sales.error&&!(sales.failedUids||[]).some(u=>!acctOff(u))} stockDisponible={Array.isArray(listings.items)&&!listings.loading&&!listings.error&&!listings.incomplet} charger={()=>{loadOrders('sold',setSales,true);loadListings(true);}}/>}
        <FiabiliteVentes partiel={nomsVentesKO.length>0} perimetre="Vinted · ventes finalisées, hors ventes masquées" lignes={ventesAffichees.map(o=>{const e=effEntry(o),b=beneficePaire(o.price?.amount,e);return {incluse:!isHidden(o)&&venteFinalisee(o),supporte:o.price?.currency_code==='EUR',achatConnu:b.achat!=null,prixConnu:b.vente!=null,valide:b.valid,fraisConfirmes:b.complet};})}/>
  </>}/>
        </section>
        <div className="vrm-sales-analysis">
        {(totals.nb>0) && (
          <div style={{marginBottom:12}}>
            <button type="button" onClick={()=>setAnalyseOpen(v=>!v)} aria-expanded={analyseOpen}
              style={{width:'100%',display:'flex',alignItems:'center',gap:8,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 14px',cursor:'pointer',fontFamily:'inherit',boxShadow:C.shadow||'none'}}>
              <span aria-hidden="true" style={{color:C.accentTexte,display:'flex'}}><Icon name="chart" size={17}/></span>
              <span style={{flex:1,textAlign:'left',fontSize:13,fontWeight:600,color:C.text}}>Analyse de tes ventes</span>
              <span style={{fontSize:11,color:C.muted,fontWeight:500}}>{analyseOpen?'masquer':'voir'}</span>
              <span style={{fontSize:13,color:C.muted,transform:analyseOpen?'rotate(90deg)':'none',transition:'transform .2s ease'}}>›</span>
            </button>
          </div>
        )}
        {analyseOpen && (<>
        {(totals.nb>0 || totals.bN>0 || totals.nbAttente>0) && (<>
          {/* 30 sept. — une seule carte, trois colonnes séparées d'un filet.
              ⚠️ (30 oct.) Ce commentaire était écrit sans accolades : il
              s'AFFICHAIT tel quel au-dessus des chiffres (vu au rendu). */}
          <div className="vrm-summary-strip" data-ventes-benef-n={String(totals.bN)} data-ventes-benef-ncout={String(totals.nbCout)}
            data-ventes-benef-brut={totals.nbCout>0?String(Math.round(totals.benefBrut*100)/100):''} data-ventes-benef-net={totals.nbCout>0&&totals.benefConnu!=null?String(Math.round(totals.benefConnu*100)/100):''}
            data-ventes-benef-couverture={totals.couverture} data-ventes-benef-autres={totals.autresKO?'passu':'lu'}
            style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(92px, 1fr))',gap:0,marginBottom:12,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 0',overflow:'hidden',boxShadow:C.shadow||'none'}}>
            <StatBox compact label="CA finalisé" value={fmtE0(totals.ca)} sub={`${totals.nb} vente${totals.nb>1?'s':''}`}/>
            {/* ⚠️ L'ARGENT EN ATTENTE RESTE UN CHIFFRE VISIBLE. Sa grande carte
                (avec le détail par compte et l'avertissement d'incomplétude) est
                descendue dans « Analyse » — mais le montant lui-même est ce que
                Julien vient regarder : il prend sa place dans la rangée. */}
            {/* (4 nov.) « En attente » (la somme des statuts « en cours » de la liste, Vinted
                seul) n'est plus ici : l'argent à venir a UNE règle et UNE carte, plus bas. */}
            {/* ⚠️ PAS DE « 💰 En attente » ICI : la carte dépliable juste au-dessus
                affiche déjà ce montant, avec le détail par compte et l'avertissement
                d'incomplétude. On lisait donc « ≈ 807 € · 25 ventes en cours » puis,
                dix lignes plus bas, « 807 € · 25 en cours » — la même chose deux fois
                sur le même écran (§11 : une seule règle, et un seul endroit). */}
            {/* ⚠️ LE CHIFFRE FAUX EST LA PORTE POUR LE CORRIGER. La saisie en
                série ne vivait plus que derrière « Analyse de tes ventes »,
                repliée (§5.67) — or le prix d'achat est LA donnée manquante
                (0 sur 320) et c'est ce chiffre-ci qui le dit. Un tap dessus
                ouvre la liste. */}
            {/* 30 sept. — « trop chargé » : sans AUCUN prix d'achat, « Coût
                d'achat 0 € » et « Bénéfice — » disaient la même absence en deux
                cases. Il n'en reste qu'une (Bénéfice), qui ouvre la saisie. */}
            {totals.nbCout>0 && <StatBox compact label="Coût d'achat" value={fmtE0(totals.cout)} sub={`${totals.nbCout}/${totals.bN} renseigné${totals.nbCout>1?'s':''}${totals.nbCout<totals.bN?' · compléter':''}`}
              onClick={totals.nbCout<totals.bN ? ()=>setFillBuyOpen(true) : null}
              title="Compléter les prix d'achat, article par article"/>}
            {totals.frais>0 && <StatBox compact label="Boosts" value={fmtE0(totals.frais)} sub="mises en avant"/>}
            {/* ⚠️ HONNÊTETÉ DES CHIFFRES : sans AUCUN prix d'achat saisi, le
                « bénéfice » vaut mécaniquement le CA (coût = 0) — c'est FAUX, et
                l'afficher en gros trompe (plainte de Julien : « les données ne
                sont plus fiables »). Donc : 0 prix d'achat → on n'affiche pas un
                faux bénéfice, on dit qu'il manque les prix d'achat. Prix connus
                en partie → on affiche le bénéfice mais on précise « sur X/Y ». */}
            {/* BRUT (vente − achat) et NET (− boosts & frais), demandés par Julien.
                Sans aucun prix d'achat : « — » (un faux bénéfice tromperait). Si
                brut = net (aucun frais capté), une seule carte « Bénéfice » — ne
                pas écrire deux fois le même nombre (§7). La couverture « sur X/Y »
                suit le même total partiel que l'ancienne carte (§5). */}
            {/* (3 nov.) Ces cartes ne déduisent ni tes dépenses ni l'URSSAF : elles ne
                s'appellent plus « Bénéfice » (le nom de la règle de Comptabilité, de
                Ma journée et de Statistiques — src/beneficeNoms.js). Brut = vente −
                achat ; « Après frais de vente » = brut − boosts et frais. */}
            {totals.nbCout===0
              ? <StatBox compact label={NOM_BENEFICE_BRUT} value="—" color={C.muted} sub={null}
                  onClick={()=>setFillBuyOpen(true)} title="Saisir les prix d'achat, article par article"/>
              : totals.benefBrut===totals.benefConnu && totals.benefConnu!=null
                ? <StatBox compact label={NOM_BENEFICE_BRUT} value={fmtE0(totals.benefConnu)} color={totals.benefConnu>=0?C.text:C.danger}
                    subColor={totals.nbCout<totals.bN?C.warn:undefined}
                    sub={totals.nbCout<totals.bN
                      ? `sur ${totals.nbCout} vente${totals.nbCout>1?'s':''} sur ${totals.bN} — les autres n'ont pas de prix d'achat`
                      : (totals.margeMoy!=null?`marge ${totals.margeMoy.toFixed(0)}\u00a0%`:'CA − achat')}/>
                : <>
                    <StatBox compact label={NOM_BENEFICE_BRUT} value={fmtE0(totals.benefBrut)} color={totals.benefBrut>=0?C.text:C.danger}
                      subColor={totals.nbCout<totals.bN?C.warn:undefined}
                      sub={totals.nbCout<totals.bN
                        ? `sur ${totals.nbCout} vente${totals.nbCout>1?'s':''} sur ${totals.bN} — avant frais`
                        : 'CA − achat (avant frais)'}/>
                    <StatBox compact label={NOM_APRES_FRAIS} value={totals.benefConnu==null?'—':fmtE0(totals.benefConnu)} color={totals.benefConnu==null?C.muted:(totals.benefConnu>=0?C.text:C.danger)}
                      sub={totals.benefConnu==null?`frais eBay pas connus pour ${totals.fraisInconnus} vente${totals.fraisInconnus>1?'s':''}`:totals.margeMoy!=null?`après boosts & frais · marge ${totals.margeMoy.toFixed(0)}\u00a0%`:'après boosts & frais'}/>
                  </>}
          </div>
          {/* (19 oct.) La couverture PAR PLATEFORME, une fois sous les chiffres :
              une vente Leboncoin ou eBay n'a un prix d'achat que si elle est
              reliée à sa paire par IDENTITÉ (SKU, référence, lien posé). */}
          {totals.bN>0 && <div data-ventes-benef-note="" style={{fontSize:12,color:C.muted,margin:'-6px 2px 12px',lineHeight:1.45}}>
            Prix d'achat connus : {totals.couverture || '—'}{totals.autresKO ? ' · Leboncoin et eBay pas encore lus : bénéfice Vinted seul' : null}{!totals.autresKO && <> <Pourquoi label="Leboncoin et eBay">Une vente Leboncoin ou eBay se relie à sa paire par son SKU VRM, sa référence ou un lien posé, jamais par son titre.</Pourquoi></>}
          </div>}
        </>)}

        {/* (30 oct.) « Rétrospective » est passée dans « ⋯ Outils » : un geste rare. */}
        {/* Ce qui n'est ni un filtre, ni un chiffre, ni une vente vit ici :
            colis à expédier (il a son écran), argent en attente et son détail,
            vente repérée via bordereau, ventes par jour. */}
        {toShip.length>0 && (()=>{
          // (revue du 22 oct.) « en retard » : une limite LUE et dépassée ; une
          // date estimée dépassée est « à vérifier » (`retard`, le module).
          const late = toShip.filter(t=>t.retard).length;
          const verif = toShip.filter(t=>t.depasse && !t.retard).length;
          const urgent = toShip.filter(t=>t.daysLeft!=null && t.daysLeft>=0 && t.daysLeft<=1).length;
          const s = toShip[0];
          // ⚠️ `toShip` porte {o, daysLeft, shipBy} — il n'y a JAMAIS eu de champ
          // `title` : la ligne affichait donc « Le plus pressé : — » pour tout le
          // monde, en permanence. Le titre vit sur la commande, et le NUMÉRO est
          // ce qu'on lit pour trouver la boîte : on le met devant. Identité
          // certaine (effEntry → id d'annonce Vinted, sinon photo), jamais un
          // rapprochement par titre.
          // (22 oct.) La phrase de la limite est celle de Colis (`texteLimiteEnvoi`,
          // avec l'heure lue dans l'email) — elle ne s'écrivait QUE pour une
          // date estimée (`shipBy`), jamais pour celle de l'email.
          const when = (t)=> t.jour ? texteLimiteEnvoi(t) : '';
          return (
            <Notice
              tone={late>0 ? 'danger' : (verif>0 || urgent>0) ? 'warn' : 'ok'}
              icon="truck"
              value={toShip.length}
              title={`colis à expédier${late>0?` · ${late} en retard`:verif>0?` · ${verif} à vérifier sur Vinted (date estimée dépassée)`:urgent>0?` · ${urgent} pour demain`:''}`}
              desc={s.jour ? (()=>{ const e=effEntry(s.o); const n=e&&e.numero?`N°${e.numero} · `:'';
                const t=(s.o&&s.o.title)||''; const q=when(s);
                return t||n ? `Le plus pressé : ${n}${t}${q?` · ${q}`:''}` : (q?`Le plus pressé : ${q}`:null); })() : null}
              detail={`Vinted laisse environ ${SHIP_DAYS} jours après la vente pour expédier. À temps, ta note vendeur est préservée. L'échéance vient de l'email du bordereau (avec son heure) ; sans lui, elle est estimée. Le bordereau se génère depuis l'onglet Colis.`}
              action={onNav && (
                <Bouton variante="secondaire" className="vrm-b-petit" icone="truck" onClick={()=>onNav('cat_bord')} style={{flexShrink:0,alignSelf:'center'}}>Colis</Bouton>
              )}/>
          );
        })()}
        {/* (4 nov.) L'ARGENT À VENIR, toutes plateformes, compte par compte : la
            règle de la coque (`liveStats.aVenir`, src/argentAVenir.js). Elle
            remplace « l'argent en attente » d'avant (Vinted seul, solde bloqué ou
            somme des statuts « en cours » de la liste — 220 € de ventes déjà
            versées comptées, mesuré le 4 nov.). */}
        {/* Elle est montée en tête de Ventes (la coque), à côté de « Retirer mon argent ». */}
        {/* ── VENTES PAR JOUR ────────────────────────────────────────────────
            Demande de Julien : « un endroit où on puisse voir les ventes par
            jour, pareil un calendrier de tel jour à tel jour ; ici ce n'est pas
            l'argent reçu, mais simplement les ventes qui ont été faites ce
            jour-là ». Donc : DATE DE VENTE, toujours — même quand le filtre
            « Finalisées » fait porter le reste de l'écran sur l'encaissement.
            Les annulées sont exclues (elles ne sont pas des ventes). */}
        {(()=>{
          const jours = {};
          for (const o of (sales.items || [])) {
            if (isHidden(o)) continue;
            if (classifyOrderStatus(o.status) === 'cancelled') continue;
            if (!dansPeriode(o, periode)) continue;             // ← date de VENTE
            const t = o.date ? Date.parse(o.date) : NaN; if (isNaN(t)) continue;
            const d = new Date(t); const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const j = jours[k] || (jours[k] = { n:0, ca:0, ts:new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime() });
            j.n += 1; j.ca += (o.price?.amount!=null ? Number(o.price.amount) : 0);
          }
          const liste = Object.entries(jours).sort((a,b)=>b[1].ts-a[1].ts);
          if (!liste.length) return null;
          const totN = liste.reduce((s,[,v])=>s+v.n,0), totCa = liste.reduce((s,[,v])=>s+v.ca,0);
          const max = Math.max(...liste.map(([,v])=>v.ca)) || 1;
          const fmtJ = (ts) => new Date(ts).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit'});
          return (
            <details style={{marginBottom:10}} open={liste.length<=10}>
              <summary style={{listStyle:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'11px 13px'}}>
                <span aria-hidden="true" style={{flexShrink:0,color:C.accentTexte,display:'flex'}}><Icon name="calendar" size={18}/></span>
                <span style={{flex:'1 1 150px',minWidth:0}}>
                  <span style={{display:'block',fontSize:13,fontWeight:600,color:C.text}}>Ventes par jour</span>
                  <span style={{display:'block',fontSize:12,color:C.muted,marginTop:2}}>{liste.length} jour{liste.length>1?'s':''} · {totN} vente{totN>1?'s':''} · {fmtE0(totCa)} — sur {libellePeriode(periode).toLowerCase()}</span>
                </span>
              </summary>
              <div style={{marginTop:8,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,overflow:'hidden'}}>
                {liste.map(([k,v],i)=>(
                  <div key={k} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderTop:i?`1px solid ${C.border}66`:'none'}}>
                    <span style={{flexShrink:0,width:76,fontSize:12,fontWeight:600,color:C.text}}>{fmtJ(v.ts)}</span>
                    {/* La barre rend la comparaison entre jours immédiate ; le
                        chiffre reste à droite, c'est lui qui fait foi. */}
                    <span aria-hidden="true" style={{flex:1,minWidth:20,height:6,borderRadius:12,background:`${C.accent}22`,overflow:'hidden'}}>
                      <span style={{display:'block',height:'100%',width:`${Math.round(v.ca/max*100)}%`,background:C.accent}}/>
                    </span>
                    <span style={{flexShrink:0,fontSize:12,color:C.muted,width:58,textAlign:'right'}}>{v.n} vente{v.n>1?'s':''}</span>
                    <span style={{flexShrink:0,fontSize:13,fontWeight:700,color:C.text,width:66,textAlign:'right',whiteSpace:'nowrap'}}>{fmtE0(v.ca)}</span>
                  </div>
                ))}
              </div>
            </details>
          );
        })()}
        {/* Analyse de perf : temps de vente, écoulement, meilleure marque, top compte */}
        {totals.nb>0 && (perf.joursMoy!=null || perf.ecoul!=null || perf.bestBrand) && (
          <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:8}}>
            {perf.joursMoy!=null && <StatBox label="Temps de vente" value={`${perf.joursMoy.toFixed(0)} j`} sub={`moyenne sur ${perf.joursNb}`}/>}
            {perf.ecoul!=null && <StatBox label="Écoulement" value={`${perf.ecoul.toFixed(0)}\u00a0%`} sub={`${perf.vendues} vendu / ${perf.online} en ligne`}/>}
            {perf.bestBrand && <StatBox label="Top marque" value={perf.bestBrand.brand} sub={`+${perf.bestBrand.moy.toFixed(0)} €/paire`}/>}
            {/* (5 nov.) « Compte qui vend le mieux » : une seule place, Statistiques → « Quel compte vend le mieux ». */}
          </div>
        )}
        {/* (5 nov.) Le classement « Ventes finalisées par compte » vit dans Statistiques (« Quel compte
            vend le mieux ») : une seule place (banc ventes-par-compte). */}
        {/* Repère d'achat par modèle (proposition 10) : deux moyennes, jamais de la compta. */}
        {totals.nb>0 && (
          <details data-repere-modeles onToggle={(e)=>{ if (e.currentTarget.open) { setRepereOuvert(true); if (buys.items===null && !buys.loading && accounts.length) loadOrders('purchased', setBuys); } }}
            style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'9px 13px',marginBottom:8}}>
            <summary style={{cursor:'pointer',fontSize:13,fontWeight:600,color:C.text}}>Repère d'achat par modèle <span style={{fontWeight:500,color:C.muted}}>— combien tu gagnes en moyenne sur chaque modèle</span></summary>
            {(() => {
              const r = margeModeles;
              if (r === null) return null;
              if (r === undefined) return <div style={{fontSize:12,color:C.muted,marginTop:8}}>Lecture de tes achats…</div>;
              if (r.pasSu) return <div style={{fontSize:12,color:C.muted,marginTop:8}}>Tes achats n'ont pas pu être lus : je ne calcule rien pour l'instant. Referme et rouvre ce bloc dans un moment.</div>;
              const seuls = r.achatsSeuls || [];
              const nonLus = (r.nonLus || []).length ? <div data-repere-non-lus={r.nonLus.join(',')} style={{fontSize:12,color:C.warn,marginTop:8,lineHeight:1.45}}>Ces moyennes ne comptent pas {r.nonLus.length>1?'les comptes':'le compte'} {r.nonLus.join(', ')}.{seuls.length>0?<span data-repere-achats-seuls={seuls.join(',')}> {seuls.length>1?'Leurs':'Ses'} achats n'ont pas pu être lus : ouvre {seuls.length>1?'ces comptes':'ce compte'} sur vinted.fr puis « Synchroniser ».</span>:null}</div> : null;
              if (!r.lignes.length) return <>{nonLus}<div style={{fontSize:12,color:C.muted,marginTop:8}}>Pas encore assez de ventes et d'achats d'un même modèle : il en faut au moins 3 de chaque pour qu'une moyenne veuille dire quelque chose.</div></>;
              return (
                <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>
                  {nonLus}
                  {r.lignes.map((l)=>(
                    <div key={l.k} data-repere-modele={l.k} style={{display:'flex',alignItems:'baseline',gap:8,fontSize:12,color:C.text,padding:'4px 0',borderTop:`1px solid ${C.border}`}}>
                      <span style={{flex:1,minWidth:0,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.nom}</span>
                      <span style={{color:C.muted,fontSize:11,whiteSpace:'nowrap'}}>revendue {fmtE(l.pV)} ({l.nV}) · achetée {fmtE(l.pA)} ({l.nA})</span>
                      <span style={{fontWeight:700,whiteSpace:'nowrap',color:l.marge<0?C.warn:C.text}}>{l.marge>=0?'+':'−'}{fmtE(Math.abs(l.marge))}</span>
                    </div>
                  ))}
                  <div style={{fontSize:11,color:C.muted,marginTop:4,lineHeight:1.45}}>
                    Prix moyen de revente moins prix moyen d'achat, avant frais de port, de protection et de boost — deux moyennes, pas la marge d'un article précis. Un lot acheté compte comme un achat. C'est un repère pour acheter : il n'entre dans aucun total, rapport ni export.{r.tropPeu>0?` ${r.tropPeu} autre${r.tropPeu>1?'s':''} modèle${r.tropPeu>1?'s':''} : pas encore assez de ventes ou d'achats.`:''}
                  </div>
                </div>
              );
            })()}
          </details>
        )}
        {/* Saisonnalité : meilleurs mois de vente → acheter avant les pics */}
        {seasonality && seasonality.top.length>0 && (
          <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'9px 13px',marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:600,color:C.text}}>Tes meilleurs mois : </span>
            <span style={{fontSize:12,fontWeight:700,color:C.text}}>{seasonality.top.map(t=>t.m).join(' · ')}</span>
            <span style={{fontSize:12,color:C.muted,display:'block',marginTop:3}}>Sur {seasonality.total} ventes — achète un peu avant.</span>
          </div>
        )}

        {/* Litiges / annulations : manque à gagner */}
        {litiges.nb>0 && (
          <div data-ventes-annulees={litiges.nb} style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'6px 13px',marginBottom:8,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            {/* (30 oct.) Plus de rouge (§7) ; la consigne « filtre Annulées
                ci-dessous » devient le geste lui-même. */}
            <span style={{flex:'1 1 200px',minWidth:0,fontSize:13,color:C.text}}><b>{litiges.nb} vente{litiges.nb>1?'s':''} annulée{litiges.nb>1?'s':''}</b> · {fmtE(litiges.montant)} de manque à gagner</span>
            <Bouton variante="discret" onClick={()=>{ setVFilter('annulees'); try { document.querySelector('.vrm-sales-workbar')?.scrollIntoView({block:'start',behavior:'smooth'}); } catch(_) {} }}>Voir les annulées</Bouton>
          </div>
        )}
        {/* (4 nov.) L'objectif du mois vit dans la carte sombre de cet écran (une barre
            fine, `vrm_objectif_mois`, src/objectifMois.js) : l'ancien bloc (`vinted_goal`,
            jamais posé en base, et sa proposition calculée sur l'archive Vinted seule)
            redisait le même nombre sur le même écran (§7, §11). */}
        {/* Graphique de tendance 6 mois : CA + bénéfice net */}
        {monthlyChart.total>0 && (()=>{
          // GRAPHIQUE DE TENDANCE — refait proprement :
          //  • Les deux séries étaient DEUX VERTS quasi identiques (écart perçu
          //    bien trop faible) : impossible de distinguer CA et bénéfice, même
          //    avec une vision normale. Elles utilisent maintenant une paire
          //    vérifiée (vert / violet), lisible aussi en cas de daltonisme.
          //  • Chaque barre porte sa VALEUR : on lit le graphique sans survoler.
          //  • Repères horizontaux discrets pour situer les hauteurs, et sommets
          //    de barres arrondis posés sur la ligne de base.
          const W=320, H=112, pad=8, bw=(W-pad*2)/6;
          const s1=C.s1||C.accent, s2=C.s2||C.purple;
          const nice=(v)=>{ const p=Math.pow(10,Math.floor(Math.log10(v||1))); return Math.ceil((v||1)/p)*p; };
          const top=nice(monthlyChart.max||1);
          const eur=(v)=> v>=1000 ? `${(v/1000).toFixed(1).replace('.',',')}k` : Math.round(v);
          return (
          <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'14px 15px',marginBottom:12,boxShadow:C.shadow||'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>Tendance — 6 mois</div>
              <div style={{display:'flex',gap:12,fontSize:11,fontWeight:500,color:C.muted}}>
                <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{width:9,height:9,borderRadius:6,background:s1,display:'inline-block'}}/>CA</span>
                <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{width:9,height:9,borderRadius:6,background:s2,display:'inline-block'}}/>Bénéfice net</span>
              </div>
            </div>
            {/* (30 oct.) Le dessin fait 320 unités de large : étiré sur 1 300 px, ses
                mois s'écrivaient en 40 px (vu au rendu). Il garde une taille lisible. */}
            <div style={{width:'100%',maxWidth:560,margin:'0 auto',overflowX:'auto'}}>
              <svg viewBox={`0 0 ${W} ${H+22}`} style={{width:'100%',minWidth:280,height:'auto',display:'block'}} role="img" aria-label={`Chiffre d'affaires et bénéfice net sur 6 mois. ${monthlyChart.months.map(m=>`${m.label} : CA ${Math.round(m.ca)} euros, bénéfice ${Math.round(m.benef)} euros`).join('. ')}`}>
                {/* Repères horizontaux : discrets, sous les données. */}
                {[0.5,1].map((f,i)=>(
                  <line key={i} x1={pad} y1={H-H*f} x2={W-pad} y2={H-H*f} stroke={C.border} strokeWidth="1" strokeDasharray={f===1?undefined:'3,4'}/>
                ))}
                {monthlyChart.months.map((m,i)=>{
                  const x=pad+i*bw;
                  const caH=Math.max(0,(m.ca/top)*H), beH=Math.max(0,(Math.max(0,m.benef)/top)*H);
                  const barW=bw*0.28, gap=2; // 2 px de fond entre les deux barres
                  const cx=x+bw*0.5;
                  return (
                    <g key={i}>
                      {caH>0 && <rect x={cx-barW-gap/2} y={H-caH} width={barW} height={caH} rx={4} fill={s1}/>}
                      {beH>0 && <rect x={cx+gap/2} y={H-beH} width={barW} height={beH} rx={4} fill={s2}/>}
                      {m.ca>0 && <text x={cx} y={H-Math.max(caH,beH)-5} textAnchor="middle" fontSize="8.5" fill={C.muted} fontWeight="800">{eur(m.ca)}</text>}
                      <text x={cx} y={H+15} textAnchor="middle" fontSize="9" fill={C.muted} fontWeight="700">{m.label}</text>
                    </g>
                  );
                })}
                <line x1={pad} y1={H} x2={W-pad} y2={H} stroke={C.border} strokeWidth="1"/>
              </svg>
            </div>
          </div>
        ); })()}
        </>)}
        </div>
      </>/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧
import BordereauxAuto from "../BordereauxAuto.jsx";
// ⟦← App.jsx #2⟧
// ⟦→ ecrans/Compta.jsx #1⟧
import { annulationsParCompte } from '../annulationsCompte.js';
// ⟦← App.jsx #3⟧
import CoutsVente from "../CoutsVente.jsx";
// ⟦← App.jsx #4⟧
import AvisVente from "../AvisVente.jsx";
// ⟦← App.jsx #8⟧
import { libellePlage, phrasePlage } from "../periodeCalendrier.js";
// ⟦← App.jsx #9⟧   // (10 nov., lot BE) la frise d'une vente, étape par étape
import FriseVente from "../FriseVente.jsx";
// ⟦← App.jsx #10⟧   // (10 nov., lot W) l'inventaire de fin d'année
import { BarreCoutVente, PointCout, SaisieEmballage } from "../CascadeVente.jsx";
// ⟦← App.jsx #5⟧
// ⟦→ ecrans/Compta.jsx #4⟧
const FactureVente = aLaDemande(() => import('../FacturePro.jsx').then((m) => ({ default: m.FactureVente })));
// ⟦← App.jsx #6⟧
const FactureVenteLigneParesseuse = lazy(() => import('../FacturePro.jsx').then((m) => ({ default: m.FactureVente })));
const FactureVenteLigne = (props) => <Suspense fallback={null}><FactureVenteLigneParesseuse ligne {...props}/></Suspense>;
// ⟦← App.jsx #7⟧
// (8 nov.) Le refus de facture commun à plusieurs lignes, dit une fois en tête de la liste (§7).
const FactureRaisonsTeteParesseuse = lazy(() => import('../FacturePro.jsx').then((m) => ({ default: m.FactureRaisonsTete })));
const FactureRaisonsTete = (props) => <Suspense fallback={null}><FactureRaisonsTeteParesseuse {...props}/></Suspense>;
// ⟦← App.jsx #11⟧

// (10 nov., lot U) Les avis Vinted d'UN compte (≤ 20, rangés par l'extension) : une projection,
// jamais `select=data`. Lecture ratée ou rien capté ⇒ `null` (« pas lus », jamais « aucun avis »).
const lireAvisCompte = async (uid) => {
  if (!/^\d{1,15}$/.test(String(uid || ''))) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.harvest_${uid}_feedbacks&select=avis:data->payload->user_feedbacks`, { headers: sbAuth() });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) && j[0] && Array.isArray(j[0].avis) ? j[0].avis : null;
  } catch (_) { return null; }
};
// ⟦← App.jsx #12⟧

// Ce que le studio photo reçoit pour lire et écrire SA ligne (`studio_photos_{N°}`) :
// la même session, le même propriétaire, la même clé de conflit que le reste (§11).
async function lireBordereauxAuto(owner) {
  if (!owner || owner !== AUTH.user?.id) throw Error('Session indisponible');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_bordereaux_auto&owner=eq.${encodeURIComponent(owner)}&select=data`, { headers: sbAuth() });
  if (!r.ok) throw Error('Lecture impossible');
  const rows = await r.json();
  return rows.length === 1 && rows[0]?.data?.active === true;
}
async function sauverBordereauxAuto(owner, active) {
  if (!owner || owner !== AUTH.user?.id || !CLOISONNE) throw Error('Session indisponible');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
    method: 'POST', headers: sbAuth({'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=representation'}),
    body: JSON.stringify({id:'vrm_bordereaux_auto',owner,data:{active:active === true},updated_at:new Date().toISOString()})
  });
  if (!r.ok) throw Error('Enregistrement impossible');
  const rows = await r.json();
  if (rows.length !== 1 || rows[0]?.data?.active !== active) throw Error('Enregistrement non confirmé');
}
// ⟦← App.jsx #13⟧
// La ligne d'une vente vue par e-mail : ce qu'elle est, depuis quand la liste
// n'a pas été relue, et LE geste (où la relire — le navigateur nommé par
// `motsNavigateur`, ou l'ordinateur de l'extension quand elle n'est pas ici).
function NoteVenteEmail({ o }) {
  const lu = Number(o && o._lectureVentes);
  // La date dite comme dans l'indicateur des comptes (`quandRelu`, une règle) : « hier 15 h 11 ».
  const quand = Number.isFinite(lu) ? quandRelu(lu) : '';
  const dans = vmrExtPresent() ? NAV.dans : 'sur l’ordinateur où est l’extension VRM';
  return (
    <div className="vrm-vente-email" data-vente-email={String(o.transaction_id)} data-vente-email-lu={Number.isFinite(lu) ? String(lu) : ''} data-sans-glisse=""
      style={{ fontSize: 13, lineHeight: 1.45, color: C.muted, overflowWrap: 'anywhere' }}>
      <span style={{ color: C.text, fontWeight: 600 }}>{STATUT_VENTE_EMAIL}</span>
      {quand ? <> · ventes de ce compte relues {quand}</> : null}
      <br/><span data-vente-email-geste="" style={{ color: C.warn }}>{gesteVenteEmail(dans).replace(/^./, (c) => c.toUpperCase())}.</span>
    </div>
  );
}
// (8 nov., « restes ventes ») LA MÊME PHRASE, UNE FOIS PAR COMPTE (§7) : dès que deux lignes
// affichées d'un compte sont « vues par e-mail » (`groupesVentesEmailEnTete`), ce qui est dit
// sur `NoteVenteEmail` — l'état, la date de lecture du compte, le geste — se dit ici, en tête
// de la liste ; la ligne ne garde que ce qui lui est propre (son état court, son bordereau).
function NoteVentesEmailTete({ g, nom }) {
  const lu = Number(g && g.lu);
  const quand = Number.isFinite(lu) ? quandRelu(lu) : '';
  const dans = vmrExtPresent() ? NAV.dans : 'sur l’ordinateur où est l’extension VRM';
  return (
    <div className="vrm-ventes-email-tete" role="note" data-ventes-email-tete={g.uid} data-ventes-email-n={String(g.txs.length)} data-ventes-email-txs={g.txs.join(',')} data-ventes-email-lu={Number.isFinite(lu) ? String(lu) : ''}
      style={{ fontSize: 13, lineHeight: 1.45, color: C.muted, overflowWrap: 'anywhere', margin: '0 0 10px', padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <span style={{ color: C.text, fontWeight: 600 }}>{statutVentesEmail(g.txs.length)}</span>
      {nom ? <> · <span className="vrm-sensible" data-stream-type="compte">{nom}</span></> : null}
      {quand ? <> · ventes de ce compte relues {quand}</> : null}
      <br/><span data-ventes-email-tete-geste="" style={{ color: C.warn }}>{gesteVenteEmail(dans).replace(/^./, (c) => c.toUpperCase())}.</span>
    </div>
  );
}
// ⟦← App.jsx #14⟧
// Dernier REÇU / FACTURE officiel Vinted capté par l'extension quand tu l'as
// consulté sur Vinted (ligne harvest_{uid}_receipt_latest). Pour la compta pro.
// Scalaires seulement (§4.4) — le PDF ne part qu'au clic « Télécharger ».
// Rend { row, capturedAt } · false (aucun reçu) · null (la base n'a pas répondu).
const fetchCapturedReceipt = async (uid) => {
  if (!uid) return false;
  try {
    const row = `harvest_${uid}_receipt_latest`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${row}&select=capturedAt:meta->>capturedAt&meta->>_pdf=eq.true`, { headers: sbAuth() });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    return rows[0] ? { row, capturedAt: rows[0].capturedAt || null } : false;
  } catch (_) { return null; }
};
// ⟦← App.jsx #15⟧
// Plusieurs sources certaines d’une vente : ne pas laisser un lien mort masquer son archive.
// ── UNE VENTE, UNE PHOTO (20 octobre) ────────────────────────────────────────
// Julien : « quand je clique sur la vente d'une paire, il y a une AUTRE photo
// qui apparaît ». La ligne repliée montrait la PREMIÈRE source (`PhotoVente`),
// le détail déplié choisissait la sienne (`PhotoVenteSources`, la première qui
// charge) : dès que la vignette de la commande ne chargeait pas, les deux ne
// montraient plus la même image. Le choix vit maintenant ICI, par vente
// (`cle` = [compte, transaction]) : la ligne et le détail lisent la même
// source et les mêmes échecs — ce que l'un affiche, l'autre l'affiche.
const __choixPhotoVente = new Map();
const __choixPhotoVenteSubs = new Set();
const choixPhotoVente = (cle, key) => { const c = cle != null ? __choixPhotoVente.get(cle) : null; return c && c.key === key ? c : { key, favori: null, echecs: [] }; };
const poserChoixPhotoVente = (cle, key, patch) => {
  if (cle == null) return;
  const cur = choixPhotoVente(cle, key), next = { ...cur, ...patch(cur), key };
  if (next.favori === cur.favori && next.echecs.length === cur.echecs.length) return;
  __choixPhotoVente.set(cle, next);
  if (__choixPhotoVente.size > 600) __choixPhotoVente.delete(__choixPhotoVente.keys().next().value);
  __choixPhotoVenteSubs.forEach(fn => { try { fn(cle); } catch (_) {} });
};
function PhotoVenteSources({candidats,cle,onBesoinAlternative,onSourceChargee,style,...props}){
 const key=JSON.stringify(candidats),[favoriLocal,setFavoriLocal]=useState(null),[echecsLocal,setEchecsLocal]=useState({key,urls:[]});
 const [,maj]=React.useReducer(n=>n+1,0);
 React.useEffect(()=>{ if(cle==null)return undefined; const fn=c=>{ if(c===cle)maj(); }; __choixPhotoVenteSubs.add(fn); return ()=>{ __choixPhotoVenteSubs.delete(fn); }; },[cle]);
 const partage=cle!=null?choixPhotoVente(cle,key):null;
 const favori=partage?(partage.favori?{key,url:partage.favori}:null):favoriLocal;
 const echecs=partage?{key,urls:partage.echecs}:echecsLocal;
 const setFavori=v=>{ if(partage)poserChoixPhotoVente(cle,key,()=>({favori:v.url})); else setFavoriLocal(v); };
 const setEchecs=f=>{ if(partage)poserChoixPhotoVente(cle,key,cur=>({echecs:f({key,urls:cur.echecs}).urls})); else setEchecsLocal(f); };
 const echecNatif=key===echecs.key?echecs.urls:[];
 const echecsActuels=React.useRef(echecNatif);echecsActuels.current=echecNatif;
 const etat=url=>echecNatif.includes(url)?'ko':photosVinted.estPhotoVinted(url)?(photosVinted.estMorte(url)?'ko':photosVinted.etatRendu(url)):'natif';
 const snapshot=candidats.map(etat).join('|'),dernier=React.useRef(snapshot);dernier.current=snapshot;
 const demander=React.useRef(onBesoinAlternative);demander.current=onBesoinAlternative;
 const dejaDemande=React.useRef(null);
 React.useEffect(()=>photosVinted.ecouter(()=>{
  const nouveau=candidats.map(url=>echecsActuels.current.includes(url)?'ko':photosVinted.estPhotoVinted(url)?(photosVinted.estMorte(url)?'ko':photosVinted.etatRendu(url)):'natif').join('|');
  if(nouveau!==dernier.current){dernier.current=nouveau;maj();}
 }),[key]);
 const source=choisirPhotoDisponible(candidats,etat,favori?.key===key?favori.url:null);
 const tousEnEchec=!!source && candidats.every(url=>etat(url)==='ko');
 React.useEffect(()=>{if(tousEnEchec && dejaDemande.current!==key){dejaDemande.current=key;demander.current?.();}},[key,tousEnEchec]);
 if(!source || tousEnEchec && !photosVinted.estPhotoVinted(source))return <span style={cadrePhoto(style)} role="img" aria-label="Photo indisponible" title="Photo indisponible"><Icon name="image" size={taillePicto(style)}/></span>;
 return <PhotoVinted {...props} src={source} style={style} onLoad={()=>{setFavori({key,url:source});onSourceChargee?.(source);}} onError={()=>setEchecs(prev=>{const urls=prev.key===key?prev.urls:[];return urls.includes(source)?prev:{key,urls:[...urls,source]};})}/>;
}
// ⟦← App.jsx #16⟧
// LOT / BUNDLE : Vinted range le détail des articles d'un lot dans la
// transaction. GET /api/v2/transactions/{id} → transaction.order.items = les
// paires du lot. Renvoie [{ title, id, price }] ou [] si indisponible.
const isLotTitle = (t) => /(^|\s)lot\b/i.test(String(t || '')) || /\d+\s*articles?/i.test(String(t || ''));
const fetchLotItems = async (account, transactionId) => {
  if (!account || transactionId == null) return [];
  try {
    const res = await vintedApiCall(account, `/api/v2/transactions/${transactionId}`);
    const tx = res && res.data && (res.data.transaction || res.data);
    const items = tx && tx.order && Array.isArray(tx.order.items) ? tx.order.items : [];
    // ⚠️ CHAQUE article d'un lot porte son IDENTIFIANT D'ANNONCE (vérifié en base :
    // 206 articles sur 206 ont `id`, plus `photos` et `size_title`). C'est donc une
    // identité certaine, pas un titre — le N° d'une paire d'un lot n'a jamais à
    // être deviné (§5.34).
    return items.map(it => ({
      title: it.title || it.name || '',
      id: it.id != null ? String(it.id) : null,
      price: (it.price && (it.price.amount ?? it.price)) ?? null,
      photo: (Array.isArray(it.photos) && it.photos[0] && (it.photos[0].url || it.photos[0])) || null,
      size: it.size_title || null,
      url: it.url || null,
    })).filter(x => x.title);
  } catch (_) { return []; }
};
// ⟦← App.jsx #17⟧
// (29 oct.) La plage se dit EN CLAIR (« du 12 au 28 oct. 2026 »), par la même
// règle que le calendrier (`libellePlage`, periodeCalendrier.js — §11).
const libellePeriode = (p) => {
  if (!p || (!p.from && !p.to)) return 'Toute la période';
  if (p.label) return p.label;
  const d = (x) => { if (!x) return null; const t = x instanceof Date ? x : new Date(x); return isNaN(t.getTime()) ? null : t; };
  return libellePlage(d(p.from), d(p.to));
};
// ⟦← App.jsx #18⟧
// (17 oct.) Julien : « un endroit où on peut retirer l'argent du porte-monnaie,
// si possible ». ⚠️ VRM NE FAIT PAS LE VIREMENT, et c'est une décision : son
// navigateur a bien vu Vinted appeler `POST /api/v2/users/{id}/payouts`
// (mesuré dans `seen_urls`), mais jamais la FORME de la demande (montant ? compte
// bancaire ? confirmation ?) — envoyer de l'argent sur une adresse dont on
// devine le contenu est exactement ce que ce projet s'interdit. VRM dit donc
// combien est disponible sur CHAQUE compte, et ouvre son porte-monnaie Vinted :
// le virement se fait là-bas, en deux clics, sur le compte connecté dans le
// navigateur. ⚠️ L'adresse de la page (`/wallet/balance`) n'est pas mesurée ici.
const PORTE_MONNAIE_VINTED = 'https://www.vinted.fr/wallet/balance';
// ⟦← App.jsx #19⟧
function RetirerArgent({ liveStats }) {
  const [ouvert, setOuvert] = useState(false);
  const liste = liveStats && Array.isArray(liveStats.walletParCompte) ? liveStats.walletParCompte.filter((x) => x.dispo != null) : null;
  if (!liste) return null;
  const total = liste.reduce((a, x) => a + (x.dispo || 0), 0);
  // (26 oct., « trop brouillon ») Rien à retirer ⇒ rien à montrer : le résumé du
  // haut dit déjà « Disponible 0 € ». Une carte qui ne mène à aucun geste est du bruit.
  if (!(total > 0)) return null;
  return (
    <div data-retirer-argent={liste.length} data-portefeuille-vide={total === 0 ? "true" : undefined} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, padding: '10px 14px' }}>
      <button type="button" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 0, padding: '2px 0', minHeight: 44, cursor: 'pointer', color: C.text, fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 15, fontWeight: 700 }}>Retirer mon argent</span><span style={{ display: 'block', fontSize: 12, color: C.muted }}>{/* Le total disponible est déjà écrit dans le résumé juste au-dessus : la
            ligne repliée ne le redit pas (le même nombre deux fois, §7), elle dit
            OÙ il est. */}{total > 0 ? (() => { const n = liste.filter((x) => x.dispo > 0).length; return n > 1 ? `Disponible sur ${n} comptes — détail par compte` : `Disponible sur ${liste.find((x) => x.dispo > 0)?.login || 'un compte'} — ouvre ton porte-monnaie`; })() : 'Rien de disponible pour l\'instant'}</span></span>
        <span aria-hidden="true" style={{ color: C.muted, transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>
      {ouvert && (
        <div style={{ marginTop: 6 }}>
          {liste.map((x) => (
            <div key={x.uid} data-retirer-compte={x.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="vrm-sensible" style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.login || `compte ${x.uid}`}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{montant(x.dispo)} disponible{x.jours != null && x.jours > 0 ? ` · lu il y a ${x.jours} j` : ''}</div>
              </div>
              {x.dispo > 0 && <Bouton variante="secondaire" href={PORTE_MONNAIE_VINTED} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>Retirer sur Vinted ↗</Bouton>}
            </div>
          ))}
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, paddingTop: 6, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>Connecte-toi d'abord sur le bon compte dans ton navigateur.<Pourquoi label="Pourquoi sur Vinted ?">Le virement se fait dans ton porte-monnaie Vinted, sur le compte connecté dans ton navigateur. VRM ne déplace jamais ton argent lui-même.</Pourquoi></div>
        </div>
      )}
    </div>
  );
}
// ⟦← App.jsx #20⟧

// Une ligne de la liste des ventes (16 oct., « app plus rapide »). Elle rend
// ce que l'écran lui donne (`rendre`) — le même rendu qu'avant. Elle garde sa
// sortie précédente dans deux cas seulement, la vente et sa place étant les
// mêmes : (1) le rendu URGENT d'une frappe dans la recherche (`gel`) — seule
// la recherche a changé, la liste affichée est encore l'ancienne, et le rendu
// différé qui suit la redessine ; (2) `pre.deps` identique : tout ce que la
// ligne lit dans l'écran (`preparerLigneVente`) est inchangé. Une valeur
// « pas comparable » (première fois, rendu gelé avant) la fait redessiner.
const LigneVenteVinted = React.memo(function LigneVenteVinted({ o, i, pre, rendre }) { return rendre(o, i, pre); },
  (avant, apres) => {
    if (avant.o !== apres.o || avant.i !== apres.i) return false;
    if (apres.gel === true) return true;
    const a = avant.pre && avant.pre.deps, b = apres.pre && apres.pre.deps;
    if (!a || !b || a.length !== b.length) return false;
    for (let k = 0; k < a.length; k++) if (!Object.is(a[k], b[k])) return false;
    return true;
  });

// (31 oct., banc ventes-frappe) Un bloc de l'écran qui ne dépend PAS de la
// lettre tapée (les « Vérifications » sous la liste : bilan de synchro, comptes
// comparés, fiabilité). Au rendu URGENT d'une frappe (`gel` : la recherche a
// changé, la liste affichée est encore l'ancienne), il garde sa sortie : ses
// calculs sur toutes les ventes (`comparerComptes`…) doublaient le processeur
// d'une lettre (49 → 92 ms, ×4, même charge). Le rendu différé qui suit
// (`gel` faux) le redessine avec tout — la même règle que `LigneVenteVinted`.
const GelPendantFrappe = React.memo(function GelPendantFrappe({ rendre }) { return rendre(); },
  (avant, apres) => apres.gel === true);
// ⟦← App.jsx #21⟧
// ── (11 nov., lot ventes-lot) LES ARTICLES D'UNE VENTE EN LOT, dans le récapitulatif ──────────
// UNE vente, chaque article à sa place : son N° par identité (src/venteLot.js), SA part du prix
// (au prorata des prix affichés, sinon parts égales DITES), son prix d'achat, son bénéfice. Un
// article sans identité prouvée ⇒ « Non relié » + « Relier » (SON clic : il tape le N° écrit sur
// l'article) ; jamais deviné. `lot` = `lotDeVente(o)`.
function ArticlesLotVente({ lot, devise = 'EUR', tx, onRelier }) {
  const [saisie, setSaisie] = React.useState(null);   // { item, val }
  if (!lot) return null;
  const eur = (c) => (c == null ? '—' : `${(c / 100).toFixed(2).replace('.', ',')}\u00a0${devise === 'EUR' ? '€' : devise}`);
  if (!lot.lu) return <section className="vrm-recap-lot" data-recap-lot="" data-lot-etat={lot.attente ? 'attente' : lot.passu ? 'passu' : 'pas-lu'} aria-label="Les articles du lot">
    <h3 className="vrm-recap-titre">Les articles du lot</h3>
    <p className="vrm-recap-issue">{lot.attente ? 'Lecture des articles du lot…' : lot.passu ? 'La base n’a pas répondu : articles du lot pas lus. Réessaie plus tard.' : 'Articles du lot pas encore lus : ouvre cette vente sur vinted.fr (l’extension lit sa transaction). Rien n’est relié en attendant.'}</p>
  </section>;
  return <section className="vrm-recap-lot" data-recap-lot={lot.n} data-lot-mode={lot.mode || ''} data-lot-non-relies={lot.nonRelies} aria-label="Les articles du lot">
    <h3 className="vrm-recap-titre">Les articles</h3>
    <p className="vrm-recap-lot-note" data-lot-phrase={lot.mode || ''}>Une vente, un colis. Prix {lot.phrase}.</p>
    {lot.nonRelies ? <p className="vrm-recap-lot-manque" data-lot-manque={lot.nonRelies}>{lot.phraseManque} : aucun N° n’est deviné.</p> : null}
    <ul className="vrm-recap-lot-liste">
      {lot.articles.map((a, i) => <li key={a.item || i} className="vrm-recap-lot-article" data-lot-article={a.item || ''} data-lot-num={a.num || ''} data-lot-par={a.par || ''} data-lot-part={a.part == null ? '' : a.part} data-lot-achat={a.achat == null ? '' : a.achat}>
        <span className="vrm-recap-lot-photo">{a.photo ? <PhotoVinted src={a.photo} alt="" loading="lazy" decoding="async"/> : <Icon name="image" size={18} style={{ color: C.muted, opacity: .55 }}/>}</span>
        <span className="vrm-recap-lot-txt">
          <span className="vrm-recap-lot-l1">{a.num ? <Numero n={a.num} taille="petit"/> : <span className="vrm-recap-lot-sans" data-lot-sans="">{a.conflit ? 'N° en double' : 'Non relié'}</span>}<span className="vrm-recap-lot-nom">{a.titre || 'Article'}{a.taille && !String(a.titre || '').includes(a.taille) ? ` · ${a.taille}` : ''}</span></span>
          <span className="vrm-recap-lot-l2">Part {eur(a.part)} · achat {a.achat == null ? '—' : eur(a.achat)}{a.benefice != null ? ` · bénéfice ${eur(a.benefice)}` : ''}</span>
          {!a.num && a.item && onRelier ? (saisie && saisie.item === a.item
            ? <span className="vrm-recap-lot-relier" data-lot-saisie={a.item}>
                <input aria-label={`N° écrit sur l’article ${a.titre || ''}`} inputMode={clavierNum()} value={saisie.val} autoFocus onChange={(e) => setSaisie({ item: a.item, val: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && saisie.val.trim()) { onRelier(tx, a.item, saisie.val.trim()); setSaisie(null); } if (e.key === 'Escape') setSaisie(null); }} placeholder="N°"/>
                <Bouton variante="secondaire" className="vrm-b-petit" disabled={!saisie.val.trim()} data-lot-valider={a.item} onClick={() => { onRelier(tx, a.item, saisie.val.trim()); setSaisie(null); }}>Relier</Bouton>
                <Bouton variante="discret" className="vrm-b-petit" onClick={() => setSaisie(null)}>Annuler</Bouton>
              </span>
            : <Bouton variante="secondaire" className="vrm-b-petit" data-lot-relier={a.item} onClick={() => setSaisie({ item: a.item, val: '' })}>Relier</Bouton>) : null}
          {a.par === 'main' && onRelier ? <Bouton variante="discret" className="vrm-b-petit" data-lot-delier={a.item} onClick={() => onRelier(tx, a.item, '')}>Délier</Bouton> : null}
        </span>
      </li>)}
    </ul>
  </section>;
}