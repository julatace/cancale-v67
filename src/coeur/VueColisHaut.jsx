// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import React from 'react';
import { Numero } from '../composants/Numero.jsx';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { LogoTransporteur, LogoInconnu } from '../PastilleTransporteur.jsx';
import { cleTransporteur } from '../transporteursVisuels.js';
import { libelleTransp } from '../colisEnvoyes.js';
import { bordereauxAImprimer } from '../prochainGesteColis.js';
import { Bouton, BoutonToutGenerer, C, Icon, PhotoVente, SheetShell, aExpedier, lienCommandeEbay, load, normalizePlan, numLigneEbay, ouEstNumero } from '../App.jsx';

// La branche {ongletColisVu==='envoyer' && …} de Comptabilite, telle quelle, avec 2 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function VueColisEnvoyerHaut({ v }) {
  const { accNameOf, batchBordereaux, batchBusy, cochesNonPartis, colisAutres, colisEb, colisSansCompte, effEntry, emailBords, emailBordsKO, estParti, expeditions, freshLabel, invForBord, isShipDone, labelsCaptes, labelsPrets, lignesLot, lignesLotTous, lot, onNav, onOngletColis, progressionLot, sales, setLot, startBordereau, urgenceColis, voitSite } = v;
  /*⟦← App.jsx #h1_1⟧*/const nAPoster = () => expeditions().filter(e => !(e.o && isShipDone(e.o))).length;/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const ouSontLesPresses = (u) => {
    // (19 oct.) La liste se trie maintenant par vente la plus récente : la
    // phrase ne promet plus « en haut », elle dit où le voir (sur sa ligne).
    // (5 nov., chantier D) Les groupes « Prêts à imprimer » / « En attente de leur bordereau » n'existent
    // plus (la liste est rangée par transporteur, le plus pressé d'abord) : la phrase disait où
    // chercher dans des groupes absents. Elle dit l'ordre réel, une fois.
    // (9 nov., soir, lot AJ) La liste est rangée du plus récent au plus ancien (décision de Julien) :
    // les pressés se lisent sur leur carte (date limite, ambre si proche), plus « en haut ».
    if (!u.presseAttente) return 'sa date limite est écrite sur sa carte.';
    return u.presseAttente > 1
      ? `sa date limite est écrite sur sa carte ; ${u.presseAttente} attendent encore leur bordereau.`
      : 'sa date limite est écrite sur sa carte ; 1 attend encore son bordereau.';
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/<>
        {/* RÉCAP EN HAUT : combien de COLIS restent à envoyer. On compte ce que
            Vinted attend de toi (moisson de l'extension), pas les emails reçus :
            un email peut manquer, une vente à expédier ne ment pas. */}
        {/* ⚠️ « Pas su » se DIT : sans cette ligne, une lecture ratée des emails
            rangeait chaque colis en « en attente de bordereau » avec le bouton
            « Générer », alors que son PDF était en base (§4.1 retourné). */}
        {/* ── « NE POSTE PAS » — COMMANDE eBAY DONT L'ACHETEUR A DEMANDÉ
            L'ANNULATION (19 oct.). En tête de Colis : un colis posté quand même,
            c'est une paire partie pour rien. La règle est `colisEbay` (§11) ; le
            geste (accepter / refuser) vit dans eBay → À traiter. */}
        {voitSite('ebay') && colisEb && colisEb.nePasPoster.length>0 && (
          <div data-ebay-ne-pas-poster={colisEb.nePasPoster.length} style={{border:`1px solid ${C.warn}66`,background:`${C.warn}10`,borderRadius:12,padding:'11px 13px',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>Ne poste pas {colisEb.nePasPoster.length>1?`ces ${colisEb.nePasPoster.length} colis eBay`:'ce colis eBay'}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.45}}>{colisEb.nePasPoster.length>1?'Les acheteurs ont':"L'acheteur a"} demandé l'annulation : réponds dans eBay → À traiter. Garde le colis d'ici là.</div>
            {colisEb.nePasPoster.map(x => {
              const num = x.ordre ? (numLigneEbay(x.ordre, (x.ordre.lineItems || [])[0]) || '') : '';
              return <div key={x.compte+':'+x.orderId} data-ebay-ne-pas-poster-cmd={x.orderId} data-colis-ident={'e:'+x.compte+':'+x.orderId} data-numero={num} style={{fontSize:12,color:C.text,marginTop:6}}>{num?<b>N°{num} · </b>:null}{x.titre || `Commande ${x.orderId}`}</div>;
            })}
            <button type="button" onClick={()=>onNav&&onNav('ebay_agent')} style={{marginTop:8,border:`1px solid ${C.border}`,background:C.card,color:C.text,borderRadius:12,padding:'0 12px',minHeight:44,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Ouvrir eBay → À traiter</button>
          </div>
        )}
        {/* (19 oct., revue « argent ») Une commande eBay ni annulée, ni
            remboursée en entier, ni partie, mais que VRM ne sait pas dire « à
            poster » (remboursée en partie, paiement pas confirmé, état
            d'expédition inconnu) : dite, jamais cachée. Le geste est dans eBay. */}
        {voitSite('ebay') && colisEb && Array.isArray(colisEb.aVerifier) && colisEb.aVerifier.length>0 && (
          <div data-ebay-a-verifier={colisEb.aVerifier.length} style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 13px',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{colisEb.aVerifier.length>1?`${colisEb.aVerifier.length} commandes eBay à vérifier avant de poster`:'Une commande eBay à vérifier avant de poster'}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.45}}>Ni annulée, ni partie : regarde-la dans eBay avant de poster ou non.</div>
            {colisEb.aVerifier.map(x => {
              const num = x.ordre ? (numLigneEbay(x.ordre, (x.ordre.lineItems || [])[0]) || '') : '';
              return <div key={x.compte+':'+x.orderId} data-ebay-a-verifier-cmd={x.orderId} data-colis-ident={'e:'+x.compte+':'+x.orderId} data-numero={num} style={{fontSize:12,color:C.text,marginTop:6}}>{num?<b>N°{num} · </b>:null}{x.titre || `Commande ${x.orderId}`} <span style={{color:C.muted}}>· {x.etat}</span> · <a href={lienCommandeEbay(x.orderId, x.compte)} target="_blank" rel="noopener noreferrer" style={{color:C.text}}>Ouvrir dans eBay ↗</a></div>;
            })}
          </div>
        )}
        {/* (5 nov., chantier D) Les pannes de Colis ont une forme : `EtatPanne` (« pas su pour l'instant », la raison, le geste). */}
        {voitSite('vinted') && emailBordsKO && emailBords===null && <div data-bords-ko style={{marginBottom:10}}><EtatPanne compact quoi="Tes bordereaux reçus par e-mail" raison="Rien n’est perdu : un colis sans bordereau ci-dessous a peut-être déjà le sien. L’écran réessaie tout seul."/></div>}
        {voitSite('vinted') && (()=>{
          if (sales.loading && emailBords===null) return <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Chargement des colis à envoyer…</div>;
          const ex = expeditions();
          const aPoster = ex.filter(e=>!(e.o && isShipDone(e.o)));
          const avecPdf = ex.filter(e=>((e.b && e.b.hasPdf) || (e.txn && labelsCaptes[e.txn])) && !(e.o && isShipDone(e.o)));
          const proNb = avecPdf.filter(e=>e.b && invForBord(e.b)).length;   // comptes pro : facture jointe
          // « À générer » = colis à poster SANS bordereau (ni PDF capté, ni email).
          // Chacun a son bouton « Générer » ; le bouton d'ensemble les commande
          // sur son clic (§3). Offert seulement si la lecture est complète, pour
          // ne pas « générer » un bordereau déjà là mais pas encore lu.
          const aGenItems = (!labelsPrets || emailBords===null) ? [] : aPoster
            .filter(e=>!(((e.b && e.b.hasPdf) || (e.txn && labelsCaptes[e.txn]))))
            .map(e=>({ uid: e.o && e.o._acc && e.o._acc.vinted_user_id, tx: e.o && String(e.o.transaction_id), login: accNameOf(e.o && e.o._acc) }))
            .filter(x=>x.uid && x.tx);
          // ⚠️ « PAS ENCORE LU » N'EST PAS « AUCUN » (§5 Colis). Pendant que les
          // bordereaux captés et les emails se lisent, l'en-tête écrivait « 0
          // bordereau prêt à imprimer · 3 en attente de bordereau », puis « 2 · 1 »,
          // puis « 3 » : un total partiel présenté comme exact, et des colis dont
          // le PDF est en base annoncés sans bordereau. Tant que la lecture n'est
          // pas complète, on écrit « au moins » et on ne dit rien de l'attente.
          const lectureComplete = labelsPrets && emailBords!==null;
          // (19 oct.) Les ventes eBay à poster entrent dans le total (le même
          // nombre que Ma journée et la cloche, §11). eBay illisible ⇒ « au moins ».
          const nEb = colisEb && colisEb.aPoster ? colisEb.aPoster.length : 0;
          // (6 nov., audit des chiffres) + Leboncoin et Vestiaire : le MÊME total que la carte
          // « Aujourd'hui » de cet écran (`vrm_colis_aposter`) — il disait 11 sous une carte à 12.
          const nAutresRecap = (colisAutres.leboncoin ? colisAutres.leboncoin.length : 0) + (colisAutres.vestiaire ? colisAutres.vestiaire.length : 0);
          const tot = aPoster.length + nEb + nAutresRecap;
          // (11 nov., parité) « au moins » quand UNE source n'a pas pu être lue — eBay comme avant,
          // et désormais Leboncoin et Vestiaire (`null` = pas su ; `undefined` = encore en lecture).
          const autresPasLusRecap = [colisEb === null ? 'eBay' : null, colisAutres.leboncoin === null ? 'Leboncoin' : null, colisAutres.vestiaire === null ? 'Vestiaire' : null].filter(Boolean);
          // « À imprimer » = pas encore imprimés (la case de la carte, `bordereauxAImprimer`).
          const nAImprRecap = bordereauxAImprimer(lignesLot()).length;
          // Sans compte relié ni colis : le geste est dit en tête, pas « aucun envoi ».
          if (colisSansCompte) return null;
          const uRecap = urgenceColis();
          // Sans geste visible (eBay, urgence, « Tout générer », lot) : le récapitulatif n'est que lu.
          // (5 nov., revue 2.21) Le réglage d'imprimante est dans Paramètres → Imprimante et bordereaux
          // (il était ici en double) : plus rien d'autre à montrer dans ce bloc.
          const recapSansGeste = !(nEb>0) && !(uRecap.total && uRecap.total>=aPoster.length) && !(aGenItems.length>0) && !lot;
          const recapVide = recapSansGeste;
          // (2 nov., colis clair) Le seul geste visible est « Tout générer (N) » : pas de
          // bloc gris autour d'un bouton seul (l'imprimante est cachée au téléphone).
          const recapSeulBouton = !recapVide && !(nEb>0) && !(uRecap.total && uRecap.total>=aPoster.length) && !lot;
          return (
            <div data-colis-recap={tot} data-colis-recap-au-moins={autresPasLusRecap.length ? '1' : '0'} data-colis-recap-vinted={aPoster.length} data-colis-recap-ebay={colisEb === undefined ? 'encours' : colisEb === null ? 'passu' : String(nEb)} data-colis-recap-vide={recapVide ? '1' : '0'} data-colis-recap-sans-geste={recapSansGeste ? '1' : '0'} data-colis-recap-cadre={recapVide || recapSeulBouton ? '0' : '1'} className={'vrm-colis-recap' + (recapSeulBouton ? ' vrm-colis-recap-nu' : '')} style={recapVide
              // (2 nov.) Le texte du récapitulatif n'est plus que lu à l'écran (1er nov.) :
              // sans ligne eBay, urgence, « Générer » ni lot, la carte restait une boîte
              // VIDE en haut de Colis (vue au téléphone). Elle garde son texte lu, sans cadre.
              ? {position:'relative',margin:0,padding:0,border:0,background:'transparent'}
              : recapSeulBouton ? {position:'relative',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'0 0 12px',padding:0,border:0,background:'transparent',boxShadow:'none'}
              : {position:'relative',display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px',marginBottom:16,overflow:'hidden',boxShadow:C.shadow||'none'}}>
              <div className="vrm-colis-recap-tete" style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',flex:'1 1 190px',minWidth:0}}>
                {/* (1er nov.) LES COLONNES DU HAUT DISENT DÉJÀ CES NOMBRES (Prêts · En attente),
                    §7 : « le même nombre ne s'écrit jamais deux fois sur un écran ». Le récapitulatif
                    (même règle, mêmes « au moins » et « pas su ») reste dit au lecteur d'écran et lu
                    par les bancs, sans s'afficher ; ce qui n'existe qu'ici (eBay, urgence, boutons,
                    imprimante, lot) reste visible. */}
                <div className="vrm-colis-recap-texte" style={{flex:1,minWidth:0}}>
                  <div className="vrm-lu-seulement" role="status" data-colis-recap-texte="">
                  <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
                    {tot>0 && <span className="vrm-display" style={{fontSize:34,fontWeight:800,color:C.text,letterSpacing:'-.035em',lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{autresPasLusRecap.length ? 'au moins ' : ''}{tot}</span>}
                    <span style={{fontSize:15,fontWeight:600,color:C.text}}>{tot>0 ? 'colis à envoyer' : (sales.error && !(sales.items||[]).length) ? 'Colis à envoyer : pas encore lus' : autresPasLusRecap.length ? 'Aucun colis Vinted à envoyer' : 'Aucun colis à envoyer'}</span>
                  </div>
                  <div style={{fontSize:13,color:C.muted,marginTop:8,lineHeight:1.45}}>
                    {aPoster.length>0
                      ? (!lectureComplete && avecPdf.length===0) ? 'Je lis encore tes bordereaux…'
                      : `${lectureComplete?'':'au moins '}${nAImprRecap} bordereau${nAImprRecap>1?'x':''} à imprimer${avecPdf.length-nAImprRecap>0?` · ${avecPdf.length-nAImprRecap} déjà imprimé${avecPdf.length-nAImprRecap>1?'s':''}`:''}${lectureComplete && aPoster.length-avecPdf.length>0 && !(emailBordsKO && emailBords===null)?` · ${aPoster.length-avecPdf.length} en attente de bordereau`:''}${proNb>0?` · ${proNb} avec facture (pro)`:''}${lectureComplete?'':' — je n’ai pas encore pu lire tous tes bordereaux'}`
                      : (nEb || nAutresRecap) ? '' : (sales.error && !(sales.items||[]).length) ? 'Tes ventes Vinted n\'ont pas pu être lues : « aucun » n\'est pas su (voir dessous).' : 'Vinted ne te demande aucun envoi en ce moment.'}
                    {nEb>0 && <span>{aPoster.length>0?' · ':''}{nEb} vente{nEb>1?'s':''} eBay</span>}
                    {/* (11 nov., parité) Leboncoin et Vestiaire dits comme eBay : leur nombre, ou « pas lues ». */}
                    {[['Leboncoin', colisAutres.leboncoin], ['Vestiaire', colisAutres.vestiaire]].filter(([, l]) => Array.isArray(l) && l.length > 0).map(([nom, l], i) => <span key={nom} data-colis-recap-autre={nom}>{(aPoster.length>0 || nEb>0 || i>0)?' · ':''}{l.length} vente{l.length>1?'s':''} {nom}</span>)}
                    {colisEb === null && <span data-colis-recap-ebay-ligne="passu">{tot>0?' · ':''}ventes eBay pas lues pour l'instant</span>}
                    {autresPasLusRecap.filter((n) => n !== 'eBay').map((nom) => <span key={nom} data-colis-recap-passu={nom}>{(tot>0 || colisEb === null)?' · ':''}ventes {nom} pas lues pour l'instant</span>)}
                  </div>
                  </div>
                  {/* Ce que les colonnes ne disent pas : OÙ se prend l'étiquette eBay (sans le nombre). */}
                  {false && nEb>0 && <div data-colis-recap-ebay-ligne="" style={{fontSize:13,color:C.muted,lineHeight:1.45}}>Ventes eBay : l'étiquette se prend dans eBay (ci-dessous).</div>}
                  {/* ⚠️ L'URGENCE EST ÉCRITE ICI QUAND ELLE CONCERNE TOUS LES
                      COLIS. Le bandeau rouge juste en dessous ne compte que
                      l'urgent : quand TOUS les colis sont en retard, il
                      annonçait « 3 à poster en priorité » sous un « 3 colis à
                      envoyer » — deux blocs, le même ensemble, à la suite
                      (mesuré en capture). Le bandeau ne s'affiche donc plus que
                      s'il désigne un SOUS-ENSEMBLE strict ; sinon l'urgence
                      tient sur cette ligne. */}
                  {(()=>{ const u=urgenceColis(); if(!u.total || u.total<aPoster.length) return null;
                    return <div data-colis-urgence-ligne="" style={{fontSize:12,color:C.warn,fontWeight:600,marginTop:3}}>{u.parts.join(' · ')}{u.presseAttente ? <> — {ouSontLesPresses(u)}</> : null}</div>; })()}
                </div>
                {/* (31 oct.) « Tout imprimer » est monté dans l'en-tête : « Imprimer les N prêts » (même action, même compte). */}
                {aGenItems.length>0 && <BoutonToutGenerer items={aGenItems}/>}
                {lot && (()=>{
                  const L = lot.lignes || lignesLotTous();
                  const nb=L.filter(l=>lot.coches.has(l.cle)).length;
                  const basculer = (cle) => setLot(x => { const c = new Set(x.coches); if (c.has(cle)) c.delete(cle); else c.add(cle); return { ...x, coches: c }; });
                  const fmtD = (o) => { const t = Date.parse(o && o.date); return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : 'date inconnue'; };
                  return (
                    /* (5 nov., chantier D) « Tout imprimer » ouvre la feuille unique (`SheetShell` : poignée,
                       titre, croix de 44 px, retour du navigateur) au lieu d'un calque fait main. */
                    <SheetShell onClose={()=>setLot(null)} maxWidth={560} z={9000} className="vrm-lot" data-noswipe="1" data-lot={L.length} aria-label="Bordereaux à imprimer"
                      titre={lot.echecs.length ? `${lot.echecs.length} bordereau${lot.echecs.length>1?'x':''} pas imprimé${lot.echecs.length>1?'s':''}` : 'Bordereaux à imprimer'}>
                        {/* (11 nov., capture de Julien : « inadmissible ») La feuille dit l'essentiel, une fois : plus d'étapes
                            « 1 · 2 · 3 », plus de récapitulatif qui redisait « 7 sélectionnés » quatre fois, plus de
                            case « Contrôlé » par ligne ni de confirmation à chaque impression. Le N° et la photo de
                            chaque ligne SONT la vérification ; le contexte (même compte, même N°, même état) reste
                            vérifié au lancement (`verifierContexte`). */}
                        {lot.echecs.length>0&&<p role="alert" className="vrm-preparation-note">Seuls les bordereaux en échec sont repris.</p>}
                        {lot.erreur&&<p className="vrm-preparation-note" role="alert" data-lot-erreur="">{lot.erreur}</p>}
                        {batchBusy&&progressionLot&&<div className="vrm-preparation-progression" role="status">{progressionLot.etape==='lecture'?`Lecture des PDF : ${progressionLot.fait}/${progressionLot.total}`:'Préparation du document groupé…'}<progress {...(progressionLot.etape==='lecture'?{value:progressionLot.fait,max:progressionLot.total}:{})}/></div>}
                        {L.length>1&&(()=>{ const cochables=L.filter(l=>l.cochable!==false); const tout=cochables.length>0&&cochables.every(l=>lot.coches.has(l.cle));
                          return <div className="vrm-lot-outils" style={{display:'flex',gap:12,padding:'4px 0 8px',fontSize:13,color:C.muted,alignItems:'center',justifyContent:'space-between'}}>
                            <span role="status" data-lot-selection={nb}>{nb} sur {L.length}</span>
                            <Bouton variante="discret" disabled={batchBusy} data-lot-tout={tout?'decocher':'cocher'} onClick={()=>setLot(x=>({...x,coches:tout?new Set():new Set(cochables.map(l=>l.cle))}))}>{tout?'Tout décocher':'Tout sélectionner'}</Bouton>
                          </div>; })()}
                        <div className="vrm-lot-liste" style={{padding:'4px 0'}}>
                          {L.map((l, il) => {
                            const o = l.e ? l.e.o : null, coche = lot.coches.has(l.cle);
                            const num = l.num || '';
                            const photo = l.photo || null;
                            let emplacement='';   // dit seulement quand il est CONNU (plus « non vérifié » sur chaque ligne)
                            if(num){try{const plan=load('vrm_room_plan',null),place=plan?ouEstNumero(normalizePlan(plan),num):null;if(place)emplacement=[place.roomName,place.itemName,place.nom].filter(Boolean).join(' · ');}catch(_){}}
                            // (3 nov.) Un en-tête par transporteur, dans l'ordre du PDF (celui des groupes de l'écran).
                            const ouvreT = il === 0 || L[il-1].trNom !== l.trNom;
                            return (
                              <React.Fragment key={l.cle}>
                              {ouvreT ? <div className="vrm-fu-groupe-transp" data-lot-groupe={l.trNom} style={{marginTop:il?10:4}}><span className="vrm-fu-groupe-tuile" aria-hidden="true">{(() => { const c = cleTransporteur(l.trNom); return c ? <LogoTransporteur cle={c} taille={22}/> : <LogoInconnu taille={22}/>; })()}</span><h3 data-lot-groupe-libelle="">{libelleTransp(l.trNom)}</h3><span>{L.filter(x=>x.trNom===l.trNom).length}</span></div> : null}
                              <div data-lot-ligne={l.cle} data-lot-site={l.site} data-lot-num={num} data-lot-transp={l.trNom} data-coche={coche?'1':'0'} data-lot-pdf={l.pdf===false?'0':'1'} data-lot-cochable={l.cochable===false?'0':'1'} style={{display:'flex',gap:10,alignItems:'center',padding:'9px 0',borderTop:`1px solid ${C.border}`,cursor:l.cochable===false?'default':'pointer',opacity:l.cochable===false?0.55:1}}>
                                <label className="vrm-preparation-selection"><input type="checkbox" aria-label={l.cochable===false?`${l.titre||'Commande'} : eBay`:`Sélectionner ${l.titre||'ce bordereau'}`} disabled={batchBusy||l.cochable===false} checked={coche&&l.cochable!==false} onChange={()=>{ if(l.cochable!==false) basculer(l.cle); }} style={{width:18,height:18,flexShrink:0}}/></label>
                                <PhotoVente src={photo} size={32} portrait/>
                                <span style={{flex:1,minWidth:0}}>
                                  <span style={{display:'block',fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{num?`N°${num} · `:''}{l.titre}</span>
                                  <span style={{display:'block',fontSize:12,color:C.muted,marginTop:2}}>
                                    <span style={{display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.sous}{l.site === 'vinted' ? ` · ${fmtD(o)}` : ''}</span>
                                    {l.pdf === false && l.cochable !== false ? <b data-lot-sans-bordereau="1" style={{color:C.warn,fontWeight:600}}> · Sans bordereau</b> : null}
                                    {l.ancienne && <b data-lot-ancienne="1" style={{color:C.warn,fontWeight:600}}> · il y a {Math.floor(l.age)} j : Vinted dit encore « à expédier », vérifie avant d'imprimer</b>}
                                    {l.imprime && <span data-lot-imprime="1"> · déjà imprimé</span>}
                                    {lot.echecs.includes(l.cle) && <b style={{color:C.warn,fontWeight:600}}> · PDF pas lu</b>}
                                    {num ? (emplacement ? <span style={{display:'block',marginTop:2}} data-lot-emplacement="">{emplacement}</span> : null) : <span style={{display:'block',marginTop:2,color:C.warn,fontWeight:600}} data-lot-sans-num="">Sans N° : vérifie avec la photo</span>}
                                  </span>
                                </span>
                                {l.cochable === false ? <span className="vrm-preparation-controle" data-lot-ebay="1" style={{fontSize:12,color:C.muted,fontWeight:600}}>eBay</span> : null}
                              </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                        {/* (5 nov., chantier D) Le pied reste visible en bas de la feuille (collé), deux gestes de
                            la même forme (`Bouton`) ; « Fermer » est la croix de la feuille (plus de second bouton). */}
                        <div className="vrm-lot-pied">
                          {/* (4 nov.) « Placer le tampon » : la feuille de chaque type de bordereau du lot s'ouvre, même déjà gardé. */}
                          <Bouton variante="secondaire" data-imprime="1" data-lot-placer={nb} disabled={!nb || batchBusy} onClick={()=>batchBordereaux(new Set(lot.coches), true)}>Placer le tampon</Bouton>
                          <Bouton variante="primaire" icone="printer" data-imprime="1" data-lot-imprimer={nb} disabled={!nb || batchBusy} onClick={()=>batchBordereaux(new Set(lot.coches))}>
                            {batchBusy?'Préparation…':lot.echecs.length?`Réessayer (${nb})`:`Imprimer ${nb} bordereau${nb>1?'x':''}`}
                          </Bouton>
                        </div>
                    </SheetShell>
                  );
                })()}
              </div>
            </div>
          );
        })()}
        {/* ── « COCHÉ POSTÉ » MAIS VINTED NE L'A PAS VU PARTIR (6 octobre) ───────
            La liste vient de `cochesNonPartis` (la règle `posteSansDepart`, une
            seule — Ma journée lit la même). Le geste est dit UNE fois en tête ;
            la ligne ne garde que ce qui la distingue (depuis quand, la date
            limite, le compte). « ↺ Pas encore posté » la remet dans « à
            envoyer » avec son bordereau, si le carton est encore là. */}
        {/* Retours en cours (21 octobre) : depuis le 3 nov., dans « Envoyés » (une vente partie qui revient). */}
        {voitSite('vinted') && cochesNonPartis.length>0 && (()=>{
          // (2 nov.) Les colis eux-mêmes sont dans « Partis » (une fois, avec « ↺ Pas
          // encore posté ») ; ici, une ligne ambre dit qu'il y a un geste à vérifier.
          const nb = cochesNonPartis.length, pl = nb>1?'s':'';
          return (
            <button type="button" data-poste-sans-depart={nb} className="vrm-colis-alerte" onClick={()=>{ if (onOngletColis) onOngletColis('envoyes'); }}>
              <Icon name="truck" size={16}/><span>{nb} colis coché{pl} « posté » que Vinted n'a pas vu{pl} partir — vérifie le dépôt (dans « Envoyés »)</span>
            </button>
          );
        })()}
        {/* « Où déposer tes colis » retiré le 30 septembre (Julien : « c'est pas
            obligé, c'est pas ouf »). Il affichait aussi « liste captée il y a
            58 j » — l'âge d'une liste de points relais, lu comme l'âge des
            données de Colis. */}
        {/* Bordereau capté par l'extension (téléchargé sur Vinted) → tamponnage 1 clic. */}
        {voitSite('vinted') && freshLabel && (()=>{
          // Bordereau frais capté → on cherche la vente À EXPÉDIER de CE compte.
          // S'il n'y en a qu'UNE, on la pré-associe : bouton « Tamponner N°X » en
          // 1 tap (auto number + titre + fichier capté). Sinon on invite à cliquer
          // 📄 sur la bonne vente.
          const pending = (sales.items||[]).filter(o=> String(o._acc?.vinted_user_id)===String(freshLabel.acc?.vinted_user_id) && aExpedier(o) && !estParti(o));
          const one = pending.length===1 ? pending[0] : null;
          const e = one ? effEntry(one) : null; const num = e?.numero || '';
          return (
            /* (5 nov., chantier D) Neutre (plus le vert hors palette ni les emojis 🆕 📄) : une carte de la
               surface, l'icône du document, une phrase, un geste de 44 px. */
            <div data-colis-bordereau-frais="" style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'10px 12px 10px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <span aria-hidden="true" style={{display:'flex',color:C.muted,flexShrink:0}}><Icon name="doc" size={20}/></span>
              <div style={{flex:'1 1 200px',minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>Bordereau téléchargé il y a {freshLabel.mins} min</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.4,overflowWrap:'anywhere'}}>{one
                  ? <>Pour {num ? <><Numero n={num} taille="petit"/>{' '}</> : null}{one.title} · {freshLabel.name}</>
                  : <>{freshLabel.name} · touche « J’ai le PDF » sur la vente concernée : il se tamponne avec son N°.</>}</div>
              </div>
              {one && <Bouton variante="secondaire" icone="doc" onClick={()=>startBordereau(num, one.title, freshLabel.acc, one.transaction_id)}>Tamponner</Bouton>}
            </div>
          );
        })()}
        {/* Rappel d'urgence quand l'app est ouverte (complète la notif push quotidienne). */}
        {voitSite('vinted') && (()=>{
          // ⚠️ `overdue` DOIT être destructuré : il est lu deux lignes plus bas.
          // Il ne l'était pas depuis §5.64 — donc l'écran Colis TOMBAIT (« overdue
          // is not defined ») dès que l'urgence était un sous-ensemble strict,
          // c'est-à-dire dès qu'il y avait à la fois des colis en retard et des
          // colis tranquilles. Famille §26 : une variable jamais déclarée dans un
          // bloc conditionnel — ni le build ni un smoke sans les bonnes données
          // ne la voient.
          const u = urgenceColis(); const { total, danger, parts, overdue } = u;
          // ⚠️ Ne s'affiche que si l'urgence est un SOUS-ENSEMBLE strict : sinon
          // c'est le même ensemble que le bandeau du haut, qui le dit déjà.
          if (!total || total >= nAPoster()) return null;
          return (
            <div data-colis-urgence={danger?'danger':'presse'} style={{border:`1px solid ${C.warn}66`,background:`${C.warn}12`,borderRadius:12,padding:'10px 13px',marginBottom:10}}>
              {/* ⚠️ CE BANDEAU NE COMPTE QUE L'URGENT (en retard / aujourd'hui /
                  demain), pas tous les colis. Il disait « N colis à expédier »,
                  exactement les mêmes mots que le compteur du haut qui, lui,
                  compte TOUT : on lisait « 4 bordereaux à imprimer » puis
                  « 1 colis à expédier » sur le même écran. On nomme ce qu'on
                  compte au lieu de laisser croire à une contradiction. */}
              <div style={{display:'flex',alignItems:'baseline',gap:7,flexWrap:'wrap'}}>
                <span style={{fontSize:17,fontWeight:700,color:C.warn,letterSpacing:-0.3}}>{total}</span>
                <span style={{fontSize:13,fontWeight:600,color:C.text}}>à envoyer en priorité{overdue?' · du retard':''}</span>
              </div>
              <div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.4}}>{parts.join(' · ')} — {ouSontLesPresses(u)}</div>
            </div>
          );
        })()}
        </>/*⟦←/⟧*/);
}
