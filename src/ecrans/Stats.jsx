// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { GraphiqueSemaines } from '../GraphiqueSemaines.jsx';   // (8 nov., « beauté ») le vendu par semaine façon Santé
import { annulationsParCompte } from '../annulationsCompte.js';
import { modeleSur, classementRapporte } from '../ceQuiRapporte.js';
import { classerSansConclureTropVite, compteQuiVendLeMieux, brutParCompte, cleBrutCompte, SEUIL_CONCLUSION } from '../vendrePlus.js';   // (9 nov., « vendre plus »)
import { rythmeVendu, ecartPct, quandTuVends, margesPar, delaisPar, tranchePrix, TRANCHES_PRIX, SEUILS_DORT, rotationStock, tauxVenteMois, tauxAnnulation, PERIODES, bornesPeriode, dansBornes, venduPeriode, barresPeriode, ventesPar } from '../statsVentes.js';
import React, { useState, useMemo } from 'react';
import { L } from '../libelles.js';
import { etapeMotVc, vcVenteAnnulee, montantRecuVc } from '../../api/_lib/vestiaire-regle.js';
import { phrasePlage } from '../periodeCalendrier.js';
import { lireSupprimes, CLE_SUPPRIMES } from '../comptesSupprimes.js';
import { recuPublieEntre, valeurObjectif, valeurObjectifMois } from '../design/carteChiffres.js';
import { TYPES_OBJECTIF, estEuros, lireSaisieObjectif, objectifAEnregistrer, progressionObjectif, phraseResteObjectif, rythmeObjectif, phraseRythme, moisPleinsAvant, objectifDuMoisYm } from '../objectifMois.js';
import { PropositionObjectif, BilanObjectif, bilanObjectif } from '../design/CarteStats.jsx';
import { NOM_BENEFICE, NOM_BENEFICE_BRUT, chiffreBenefice, chiffreBrut } from '../beneficeNoms.js';
import { AUTH, Bouton, SheetShell, save, C, Card, DEMANDE_SAISIE_PRIX, FraicheurAnnonces, Icon, LAYOUT, LiveStatsCarte, MOIS_COURTS, PeriodePicker, Pourquoi, REGLES_CARTE, RepartitionsVentes, SUPABASE_URL, ScreenHead, Segmente, StatBox, aPayerUrssaf, beneficeDesJours, beneficeDuMoisPub, bilanLignes, caEbayPayees, classifyOrderStatus, clesVenteStats, commandeEbayEngagee, compteEcarte, dateLocaleISO, dateMiseEnLigneMs, demanderVue, fmt, isCloudReady, lbcAnnulee, lbcFinalisee, lireBeneficeJours, lireComptaSynchro, lireExtrasRepartition, lireReleveVentes, lireTout, load, montantCommande, netApresUrssafDe, nonCompteesDe, onCloudReady, phraseNonComptees, recuAvecADater, sbAuth, tauxUrssaf, useBeneficeCalcul, useExcluAutre, useLigneSynchro, useLigneUrssaf, useObjectifMois, useRegimeFiscal, useSourcesCarte, useVentesCoque, ymCourant } from '../App.jsx';

// ⟦← App.jsx #1⟧
import { notesParCompte } from '../notesRecues.js';
import { useValeurStock } from '../CascadeVente.jsx';   // (10 nov., lot BF)
import { texteValeurStock } from '../coutVente.js';
// ⟦← App.jsx #2⟧
import {comparerDeuxMois,ymEnFace,bornesMois} from '../comparerMois.js';
import { estLot as estLotAchat, nombreLot } from '../achatsSourcing.js';   // (11 nov., C5) la règle des lots de l'écran Achats
import '../styles-mois-boucle.css';
import {fraisParPlateforme,texteCouverture} from '../fraisPlateformes.js';
// ⟦← App.jsx #3⟧
import { boostRentable, SEUIL_BOOST } from "../boostRentable.js";
// ⟦← App.jsx #4⟧
import CeQuiRapporte from "../design/CeQuiRapporte.jsx";
import SourcesAchats from "../SourcesAchats.jsx";
import MargePlateforme from "../MargePlateforme.jsx";   // (10 nov., lot I) marge par plateforme — un bloc isolé
import VitesseEnvoi from "../VitesseEnvoi.jsx";   // (10 nov., lot BM) vitesse d'envoi — un bloc isolé
import AvisLus from "../AvisVinted.jsx";   // (10 nov., lot BN) les avis Vinted lus   // (10 nov., lot BG) d'où viennent mes achats — un bloc isolé
// ⟦← App.jsx #5⟧
import CarteOffres from "../design/CarteOffres.jsx";
import { statsOffres } from "../statsOffres.js";
import { statsParCategorie, stockParFamille, familleDeVente, cleVente, tableFamilles, ecritureCategoriesMain, afficherCategories, FAMILLES_STATS, titreFamille, CLE_CATEGORIES_MAIN } from '../statsCategories.js';   // (11 nov., lot stats-categories)
import { CLE_JE_VENDS, lireReglageJeVends } from '../profilVendeur.js';
import '../stats-categories.css';
import { resumePeriode, margeConnue, meilleuresVentes, ageDuStock, venduEtRecu, MIN_DONNEES, recordsDe, colonneCompte } from '../statsPlus.js';   // (11 nov., lot stats-plus)
import '../stats-plus.css';

// ⟦← App.jsx #6⟧
// « Annonces en ligne » : UNE règle d'écriture pour chaque écran qui la montre
// (§11). Des annonces « à confirmer » (compte dont le dressing date de plus de
// 24 h) ne sont pas comptées : le nombre est alors un MINORANT, écrit « ≥ N »,
// et un zéro qui veut dire « je ne sais pas » s'écrit « — » (§5, §7). Jamais
// un minorant présenté comme un total.
const texteEnLigne = (liveStats) => {
  if (!liveStats || liveStats.online == null) return '—';
  if ((liveStats.annAConfirmer || []).length) return liveStats.online > 0 ? `≥ ${liveStats.online}` : '—';
  return String(liveStats.online);
};
// ⟦← App.jsx #7⟧
// (6 nov., vague 3) LE PRÉDICAT « COMPTE VINTED ÉCARTÉ » D'UN ÉCRAN QUI VIT LONGTEMPS — UNE source :
// `vinted_accounts_hidden` (synchronisé), `panel_accounts_off` (passé par la coque) et les comptes
// supprimés pour de bon (`lireSupprimes`). ⚠️ Lu au MONTAGE seulement, il était faux : Statistiques
// se monte avant que la ligne `main` arrive du nuage (`load` rend alors `[]`) et le memo ne se
// relisait plus — le compte masqué restait dans « Annulations » et « Notes reçues » (banc
// vague3-ecrans, point X). Il se relit à l'arrivée du nuage et à chaque « Masquer ».
function useCompteEcarte(panelOff) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_accounts_hidden' || k === CLE_SUPPRIMES) setTick((t) => t + 1); };
    window.addEventListener('vrm:save', f);
    const stop = onCloudReady(() => setTick((t) => t + 1));
    return () => { window.removeEventListener('vrm:save', f); if (typeof stop === 'function') stop(); };
  }, []);
  return React.useMemo(() => {
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const sup = lireSupprimes();
    const ecarte = (u) => sup.has(String(u)) || compteEcarte(u, hAcc, panelOff || {});
    ecarte.cle = [...hAcc].sort().join(',') + '|' + [...sup].sort().join(',') + '|' + JSON.stringify(panelOff || {});
    return ecarte;
  }, [panelOff, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}
// ⟦← App.jsx #8⟧
function getISOWeekKey(){
  const d=new Date();const day=d.getDay()||7;
  d.setDate(d.getDate()+4-day);
  const y=d.getFullYear();
  const wk=Math.ceil(((d-new Date(y,0,1))/864e5+1)/7);
  return `${y}-W${String(wk).padStart(2,'0')}`;
}
// ⟦← App.jsx #9⟧
const TOTAL_SLOTS = LAYOUT.reduce((s,z)=>s+z.cols.reduce((ss,b)=>ss+b,0),0);
// ⟦← App.jsx #10⟧

// ── COURBE À POINTS DES 12 MOIS (Statistiques, 17 oct.) ──────────────────────
// Julien : « pour les graphiques évolution ventes finalisées et chiffre
// d'affaires des 12 mois, à points comme dans Ma journée, c'est beaucoup
// mieux ». Le même dessin que `CourbeSemaine` (points reliés, valeur écrite sur
// le point, dégradé qui s'efface vers le bas, largeur MESURÉE et hauteur fixe),
// mais sur douze mois. Les chiffres ne changent pas : la courbe ne fait que
// dessiner ce qu'on lui donne. Le mois EN COURS a un point creux et un trait
// pointillé (il n'est pas fini — un total partiel ne se présente pas comme
// complet, §5). Sur téléphone, douze valeurs ne tiennent pas côte à côte : on
// n'écrit que le meilleur mois, le dernier et celui qu'on a touché ; les
// autres sont dans l'infobulle et au toucher (`onChoisir`).
function CourbeMois({ mois, presentation = 'barres', valeur = (m) => m.eur, format = (v) => `${Math.round(v).toLocaleString('fr-FR')}\u00a0€`, hauteur = 176, choisi = null, onChoisir = null, attr = 'data-courbe-mois', legende = true }) {
  const ref=React.useRef(null);
  const [W,setW]=React.useState(340);
  const [compact,setCompact]=React.useState(()=>window.matchMedia('(max-width:767px)').matches);
  const [lecture,setLecture]=React.useState(null);
  React.useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    const mesure=()=>{setCompact(window.matchMedia('(max-width:767px)').matches);if(el.clientWidth>0)setW(el.clientWidth);};
    mesure();const ro=new ResizeObserver(mesure);ro.observe(el);return()=>ro.disconnect();
  },[]);
  const uid=React.useId().replace(/:/g,'');
  const n=mois.length;
  if(!n)return null;
  const H=compact?124:Math.max(hauteur,196), left=18,right=18,top=14,bottom=28;
  const vals=mois.map(m=>Math.max(0,Number(valeur(m))||0));
  const max=Math.max(1,...vals),base=H-bottom;
  const col=(W-left-right)/n;
  const X=i=>left+(i+.5)*col;
  const Y=v=>top+(1-v/max)*(base-top);
  const cleDe=m=>m.cle||m.key;
  const externe=choisi==null?-1:mois.findIndex(m=>cleDe(m)===choisi);
  const local=mois.findIndex(m=>cleDe(m)===lecture);
  const lu=externe>=0?externe:local>=0?local:n-1;
  const meilleur=vals.indexOf(Math.max(...vals));
  const pas=col<30?2:1;
  const court=m=>{const d=new Date(String(cleDe(m))+'-01T12:00:00');return isNaN(d)?String(m.label||''):d.toLocaleDateString('fr-FR',{month:'short'}).replace('.','');};
  const choisir=(m,i)=>{setLecture(cleDe(m));if(onChoisir)onChoisir(i===externe?null:cleDe(m));};
  return <div ref={ref} className="vrm-chart-months" style={{width:'100%',minWidth:0}}>
    <svg {...{[attr]:''}} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group"
      aria-label={mois.map((m,i)=>`${m.long||m.nomComplet||cleDe(m)} ${format(vals[i])}`).join(' · ')} style={{display:'block',maxWidth:'100%'}}>
      <defs><linearGradient id={`area${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.accent} stopOpacity=".20"/><stop offset="1" stopColor={C.accent} stopOpacity=".01"/></linearGradient><linearGradient id={`bars${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.accent}/><stop offset="1" stopColor={C.accent} stopOpacity=".65"/></linearGradient></defs>
      {[0,.5,1].map(f=><line key={f} x1={left} x2={W-right} y1={Y(max*f)} y2={Y(max*f)} stroke={C.border} strokeWidth="1" strokeDasharray={f?'3 5':undefined}/>)}
      {presentation==='ligne'&&<g aria-hidden="true" pointerEvents="none"><path d={`M ${X(0)} ${base} L ${vals.map((v,i)=>`${X(i)} ${Y(v)}`).join(' L ')} L ${X(n-1)} ${base} Z`} fill={`url(#area${uid})`}/><path d={`M ${vals.map((v,i)=>`${X(i)} ${Y(v)}`).join(' L ')}`} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/></g>}
      {mois.map((m,i)=>{const cle=cleDe(m),actif=i===lu,bar=Math.max(2,Math.min(compact?22:34,col*.55));const label=`${m.long||m.nomComplet||cle} · ${format(vals[i])}${m.enCours?' (en cours)':''}`;return <g key={cle} data-mois={cle} data-valeur={Math.round(vals[i]*100)} role="button" tabIndex="0" aria-label={label} aria-pressed={actif} className="vrm-chart-month" onClick={()=>choisir(m,i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choisir(m,i);}}}>
        <title>{label}</title>
        {actif&&presentation!=='ligne'&&<rect x={X(i)-col/2+2} y="2" width={Math.max(1,col-4)} height={H-2} rx="6" fill={C.bg}/>}
        <rect x={X(i)-col/2} y="0" width={col} height={H} fill="transparent"/>
        {presentation==='ligne'?<circle cx={X(i)} cy={Y(vals[i])} r={actif?5:3} fill={actif?C.accent:C.card} stroke={C.accent} strokeWidth="2"/>:<rect data-month-bar="" x={X(i)-bar/2} y={Y(vals[i])} width={bar} height={Math.max(1,base-Y(vals[i]))} rx="3" fill={`url(#bars${uid})`} opacity={actif||i===meilleur?1:m.enCours?.45:.65}/>}
        {(i%pas===0||i===n-1)&&<text x={X(i)} y={H-8} textAnchor="middle" fontSize="11" fontWeight={actif?600:400} fill={actif?C.text:C.muted}>{court(m)}</text>}
      </g>;})}
    </svg>
    {legende && <div className="vrm-chart-caption" data-chart-caption=""><span>{mois[lu].long||mois[lu].nomComplet||cleDe(mois[lu])}{mois[lu].enCours?' · en cours':''}</span><strong>{format(vals[lu])}</strong></div>}
    {legende && lu>0 && <div className="vrm-chart-compare" data-chart-compare=""><span>Précédent · {mois[lu-1].long||mois[lu-1].nomComplet||cleDe(mois[lu-1])}{mois[lu].enCours?' · mois complet':''}</span><strong>{format(vals[lu-1])}</strong></div>}
  </div>;
}
// ⟦← App.jsx #11⟧


/* ── Dashboard ───────────────────────────────────────── */
// Détail des ventes d'un mois (affiché au clic sur une barre du graphique)
function MonthDetail({mois,type,C,fmt,catMap,catalog,onClose}){
  // Construit le nom de chaque paire depuis le catalogue (si dispo)
  const catName={};
  (catalog||[]).forEach(p=>{ if(p.name) catName[p.id]=p.name; });
  const ventes=[...(mois.ventes||[])].sort((a,b)=>{
    // tri par date (la plus récente d'abord) selon le type de graphique
    const da=(type==='encaisse'?a.receiveDate:a.saleDate)||'';
    const db=(type==='encaisse'?b.receiveDate:b.saleDate)||'';
    return db.localeCompare(da);
  });
  const totalCA=ventes.reduce((s,v)=>s+(+v.sellPrice||0),0);
  const totalProfit=ventes.reduce((s,v)=>s+((+v.sellPrice||0)-(+v.buyPrice||0)),0);
  return (
    <div style={{marginTop:16,padding:14,background:C.bg,borderRadius:12,border:`1px solid ${C.border}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>{mois.nomComplet} — {ventes.length} vente{ventes.length>1?'s':''}</span>
        <span onClick={onClose} style={{cursor:'pointer',color:C.muted,fontSize:20,fontWeight:500,lineHeight:1}}>×</span>
      </div>
      <div style={{display:'flex',gap:16,marginBottom:12,fontSize:12}}>
        <span style={{color:C.text}}>CA : <b>{fmt(totalCA)}</b></span>
        <span style={{color:C.accentTexte}}>Bénéfice : <b>{fmt(totalProfit)}</b></span>
      </div>
      <div style={{maxHeight:260,overflowY:'auto'}}>
        {ventes.map((v,i)=>{
          const nom=catName[v.productId]||(v.productId?('Paire '+v.productId):'—');
          const dateAff=(type==='encaisse'?v.receiveDate:v.saleDate)||'';
          const benef=(+v.sellPrice||0)-(+v.buyPrice||0);
          return (
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:C.text,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nom}</div>
                <div style={{color:C.muted,fontSize:11}}>{dateAff}{v.productId?` · n°${v.productId}`:''}</div>
              </div>
              <div style={{textAlign:'right',marginLeft:10}}>
                <div style={{color:C.text,fontWeight:500}}>{fmt(+v.sellPrice||0)}</div>
                <div style={{color:benef>=0?C.accent:C.warn,fontSize:11}}>{benef>=0?'+':''}{fmt(benef)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ⟦← App.jsx #12⟧

// ── CA FINALISÉ PAR PLATEFORME (propriétaire unique, §11) ──────────────────
// Consommé par le Tableau de bord ET l'onglet Collectif : une seule règle, un
// seul endroit — les deux écrans ne peuvent donc pas se contredire. Vinted vient
// de `liveStats.caEncaisse` (ventes finalisées), Leboncoin des ventes prouvées
// non annulées (prix en centimes), eBay des commandes payées (`caEbayPayees`).
// Une plateforme sans vente captée rend `ca:null` (« pas encore de vente
// captée »), jamais 0 € (§5/§7).
// « Vestiaire Collective » reste la CLÉ interne (prop `plat`, comparaisons
// `plat===`) ; à l'écran on écrit « Vestiaire Co » (Julien, 27 oct.). Un seul
// endroit qui décide du nom AFFICHÉ — les clés ne bougent pas (§11).
// (31 oct.) L'ÉTAT du CA eBay, pour que la phrase dise ce qui est mesuré (§5 :
// la phrase qui explique un chiffre vient de la même source que lui). Mesuré le
// 20 oct. : eBay LU, 0 commande, et la ligne disait « total des ventes payées
// en euros indisponible » — comme si la lecture avait raté.
//   `undefined` lecture en cours · `null` pas su · tableau lu :
//   'lu' (un total) · 'aucune' (aucune commande payée) · 'illisible' (des
//   commandes payées, montant reçu en euros pas su).
function etatCaEbay(orders) {
  if (orders === undefined) return 'encours';
  if (!Array.isArray(orders)) return 'passu';
  if (caEbayPayees(orders) != null) return 'lu';
  return orders.some(o => String((o && o.orderPaymentStatus) || '').toUpperCase() === 'PAID') ? 'illisible' : 'aucune';
}
const NOTE_CA_EBAY = {
  lu: 'ventes payées',
  aucune: 'pas encore de vente payée',
  encours: 'lecture en cours',
  passu: 'commandes eBay pas lues',
  illisible: 'montant reçu en euros indisponible',
};
function nomAffichePlat(n) { return n === 'Vestiaire Collective' ? 'Vestiaire Co' : n; }
// (2 nov., audit des données) Vestiaire : la ligne disait « pas encore de vente
// captée » en dur, pendant que Ma journée, Compta et l'URSSAF comptaient ses
// ventes au montant sûr — deux vérités pour une notion. Elle lit maintenant les
// ventes rangées (`ventesVcDe`) par les MÊMES règles (`montantRecuVc`, étape
// versée/terminée) ; un montant pas sûr ⇒ « — » et la raison, jamais un total
// partiel. Leboncoin : un prix inconnu n'est plus compté 0 €, il est dit.
const caVestiaireFinalise = (ventesVc) => {
  if (ventesVc === undefined) return { ca: null, note: 'lecture en cours' };
  if (!Array.isArray(ventesVc)) return { ca: null, note: 'ventes Vestiaire pas lues' };
  let ca = 0, n = 0, pasSur = 0;
  for (const v of ventesVc) {
    if (!v || vcVenteAnnulee(v)) continue;
    const et = etapeMotVc(v); if (et !== 'versee' && et !== 'terminee') continue;
    const r = montantRecuVc(v);
    if (r.eur == null) { pasSur++; continue; }
    ca += r.eur; n++;
  }
  if (pasSur) return { ca: null, note: `${pasSur} vente${pasSur > 1 ? 's' : ''} finalisée${pasSur > 1 ? 's' : ''} au montant pas sûr` };
  return n ? { ca: Math.round(ca * 100) / 100, note: 'ventes finalisées (montant versé)' } : { ca: null, note: 'pas encore de vente finalisée' };
};
function caParPlateforme(liveStats, lbcVentes, ebayCa, ebayCommandes, ventesVc) {
  const caVinted = liveStats && liveStats.caEncaisse != null ? liveStats.caEncaisse : null;
  // ⚠️ CA = VENTES FINALISÉES SEULEMENT (Julien, 1er oct.) : « le CA d'un mois est
  //    la somme des ventes FINALISÉES, pas celles en cours — une vente en cours
  //    peut partir en litige ». Côté Leboncoin on comptait toute vente non
  //    annulée (donc les « en attente d'envoi » aussi) : on restreint aux
  //    finalisées (argent reçu), par le MÊME prédicat que l'écran Ventes (§11).
  const lbcOk = ((lbcVentes && lbcVentes.ventes) || []).filter(o => !lbcAnnulee(o) && lbcFinalisee(o));
  const lbcPrix = (o) => { const e = o.price != null ? Number(o.price) / 100 : NaN; return Number.isFinite(e) ? e : null; };
  const lbcSansPrix = lbcOk.filter(o => lbcPrix(o) == null).length;
  const caLbc = (lbcOk.length && !lbcSansPrix) ? lbcOk.reduce((s,o)=> s + lbcPrix(o), 0) : null;
  const vc = caVestiaireFinalise(ventesVc);
  const caEbay = ebayCa != null ? ebayCa : null;
  return [
    { nom:'Vinted', ca:caVinted, note:'ventes finalisées, tous comptes' + (liveStats && liveStats.nMasque > 0 ? ` · sans ${liveStats.nMasque} masquée${liveStats.nMasque>1?'s':''}` : '') },
    { nom:'Leboncoin', ca:caLbc, note:lbcSansPrix?`${lbcSansPrix} vente${lbcSansPrix>1?'s':''} finalisée${lbcSansPrix>1?'s':''} au prix inconnu`:caLbc==null?'pas encore de vente finalisée':'ventes finalisées (argent reçu)' },
    { nom:'eBay', ca:caEbay, note: caEbay != null ? NOTE_CA_EBAY.lu : NOTE_CA_EBAY[etatCaEbay(ebayCommandes)] },
    { nom:'Vestiaire Collective', ca:vc.ca, note:vc.note },
  ];
}
// ⟦← App.jsx #13⟧

// (17 oct.) L'écran « Collectif » est retiré — Julien : « il ne sert à rien, il
// est déjà représenté dans les statistiques ». `?tab=collectif` mène aux
// Statistiques (`ONGLETS_DEPLACES`).
// (2 nov.) Un volet replié des Statistiques : un titre, une phrase qui dit ce qu'il
// contient, ouvert d'un geste. Son état ouvert/fermé est une commodité de CET
// appareil (localStorage, protégé) — jamais une donnée.
const REPLIS_STATS = 'vrm_stats_replis';
function RepliStats({ id, titre, phrase, children, ouvertDefaut = false }) {
  // (11 nov., lot stats-plus) `ouvertDefaut` : un volet ouvert tant qu'il ne l'a pas fermé sur cet appareil.
  const [ouvert, setOuvert] = React.useState(() => { try { const v = (JSON.parse(localStorage.getItem(REPLIS_STATS) || '{}') || {})[id]; return v === undefined ? !!ouvertDefaut : !!v; } catch (_) { return !!ouvertDefaut; } });
  const basculer = (e) => {
    const o = e.currentTarget.open; setOuvert(o);
    try { const v = JSON.parse(localStorage.getItem(REPLIS_STATS) || '{}') || {}; v[id] = o; localStorage.setItem(REPLIS_STATS, JSON.stringify(v)); } catch (_) {}
  };
  return (
    <details className="vrm-repli vrm-stats-repli" data-stats-repli={id} data-ouvert={ouvert ? '1' : '0'} open={ouvert} onToggle={basculer}>
      <summary><span className="vrm-stats-repli-tete"><span className="vrm-stats-repli-titre">{titre}</span>{/* (3 nov.) La phrase du volet n'est plus affichée (critique #4) : le titre suffit. */}</span></summary>
      {/* Monté seulement ouvert : rien n'est calculé pour un volet fermé. */}
      {ouvert ? <div className="vrm-stats-repli-corps">{children}</div> : null}
    </details>
  );
}
function Dashboard({catalog,sales,garageGrid,invoices,liveStats,onGo,actions,baseKO,premierJour,lbcVentes={ventes:[],inconnues:0},ebayCa=null,ebayCommandes,panelOff=null,ventesVc,sousNav=null}) {
  // Les N° des annonces « à confirmer » (la liste dépliée sous « Annonces en ligne ») :
  // relus avec les chiffres, jamais un « sans N° » inventé (revue de la 5.167).
  const numerosDash=React.useMemo(()=>load('vinted_annonce_numeros',{}),[liveStats]);
  // Mois sélectionné au clic sur un graphique (affiche le détail des ventes)
  const [selMonthEnc,setSelMonthEnc]=useState(null);   // graphique encaissé
  const [selMonthVente,setSelMonthVente]=useState(null); // graphique date de vente
  const [caMode,setCaMode]=useState('ca');             // graphique d'évolution : « ca » (€) ou « ventes » (nb)
  const [selMois,setSelMois]=useState(null);           // mois sélectionné dans le graphique d'évolution moisson
  const [caDu,setCaDu]=useState('');                   // CA sur mesure : borne de début (YYYY-MM-DD)
  const [caAu,setCaAu]=useState('');                   // CA sur mesure : borne de fin
  // (29 oct., revue) Le LIBELLÉ du raccourci choisi (« 30 derniers jours ») : sans
  // lui, Statistiques réécrivait « Du 1er au 30 oct. » là où Ventes et Achats
  // disent « 30 derniers jours » — le même choix, deux écritures (§11).
  const [caLabel,setCaLabel]=useState('');
  // (31 oct., maquette) La période de la page : Semaine · Mois · Année — une règle (`bornesPeriode`) pour tout le bloc du haut.
  const [periodeStats,setPeriodeStats]=useState('mois');
  const valeurStk = useValeurStock((AUTH.user && AUTH.user.id) || '');   // (10 nov., lot BF) lue, jamais recalculée


  // Paires réellement présentes dans le garage (mémorisé)
  const garageVals=useMemo(()=>
    Object.values(garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='').map(v=>v.trim()),
  [garageGrid]);
  
  // Map id -> buyPrice depuis le catalogue (mémorisé)
  const catMap=useMemo(()=>{
    const m={};
    catalog.forEach(p=>{m[p.id]=+p.buyPrice;});
    return m;
  },[catalog]);
  
  // Stock & valeur (mémorisés)
  const stockCount=garageVals.length;
  const freeSlots=TOTAL_SLOTS-stockCount;
  const fillRate=Math.round((stockCount/TOTAL_SLOTS)*100);
  
  const totalSold=useMemo(()=>catalog.filter(p=>p.status==='vendu').length,[catalog]);
  const encaissees=useMemo(()=>sales.filter(v=>v.receiveDate&&v.receiveDate.trim()!==''),[sales]);
  const ca=useMemo(()=>encaissees.reduce((s,v)=>s+ +v.sellPrice,0),[encaissees]);
  const profit=useMemo(()=>encaissees.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0),[encaissees]);
  const enAttente=useMemo(()=>sales.filter(v=>!v.receiveDate||v.receiveDate.trim()===''),[sales]);
  const caAttente=useMemo(()=>enAttente.reduce((s,v)=>s+ +v.sellPrice,0),[enAttente]);
  const avgX=useMemo(()=>encaissees.length?(encaissees.reduce((s,v)=>s+ +v.multi,0)/encaissees.length).toFixed(2):'—',[encaissees]);
  // ⚠️ SANS CA, UN TAUX DE MARGE N'EXISTE PAS — c'est 0 ÷ 0. Vu au rendu le
  //    16 septembre sur une installation neuve : « Taux marge 0% », un chiffre
  //    fabriqué présenté comme un fait, sur le premier tableau de bord d'une
  //    nouvelle personne. §7 : un zéro qui veut dire « on ne sait pas » s'écrit
  //    `—`, avec la raison à côté.
  const avgMargin=ca>0?((profit/ca)*100).toFixed(1):null;
  const avgSale=encaissees.length?(ca/encaissees.length):0;
  const avgProfit=encaissees.length?(profit/encaissees.length):0;
  // ── (3 nov.) « BÉNÉFICE » = LA RÈGLE DE COMPTA, ICI AUSSI (src/beneficeNoms.js) ──
  // « Bénéfice estimé », « Taux marge » et « Bénéfice moyen » lisaient l'ancien
  // catalogue (vente − achat, saisi à la main, vide) et disaient « — » dès que
  // les ventes Vinted étaient lues : un autre chiffre sous le même nom que
  // Comptabilité. Désormais : le bénéfice de l'ANNÉE (`useBeneficeCalcul`, la
  // lecture de Compta et de Statistiques), « — » quand la règle dit « pas su » ;
  // la marge = ce bénéfice ÷ les ventes qu'il compte (`BPa.ca`), jamais un brut.
  const [comptaD] = useLigneSynchro('vrm_compta', lireComptaSynchro);
  const { etat: etatBPa, B: BPa } = useBeneficeCalcul(comptaD, 'annee');
  const CBa = chiffreBenefice(BPa, etatBPa);
  const margeA = CBa.valeur != null && BPa && BPa.ca > 0 ? Math.round((CBa.valeur / BPa.ca) * 1000) / 10 : null;
  const beneficeMoyA = CBa.valeur != null && BPa && BPa.n > 0 ? Math.round((CBa.valeur / BPa.n) * 100) / 100 : null;
  const anneeA = new Date().getFullYear();

  const weeklyRecapData=useMemo(()=>{
    const today=new Date();
    const day=today.getDay()||7;
    const lastMon=new Date(today);lastMon.setDate(today.getDate()-day-6);lastMon.setHours(0,0,0,0);
    const lastSun=new Date(today);lastSun.setDate(today.getDate()-day);lastSun.setHours(23,59,59,999);
    const parseDt=s=>{if(!s)return null;const p=s.split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0]):null;};
    const ventes=encaissees.filter(v=>{const d=parseDt(v.receiveDate);return d&&d>=lastMon&&d<=lastSun;});
    const ca=ventes.reduce((s,v)=>s+ +v.sellPrice,0);
    const profit=ventes.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
    // Semaine ENCORE avant (pour la comparaison ▲/▼).
    const prevMon=new Date(lastMon);prevMon.setDate(prevMon.getDate()-7);
    const prevSun=new Date(lastSun);prevSun.setDate(prevSun.getDate()-7);
    const prevV=encaissees.filter(v=>{const d=parseDt(v.receiveDate);return d&&d>=prevMon&&d<=prevSun;});
    const prevCa=prevV.reduce((s,v)=>s+ +v.sellPrice,0);
    return{count:ventes.length,ca,profit,prevCa,prevCount:prevV.length,from:lastMon.toLocaleDateString('fr-FR'),to:lastSun.toLocaleDateString('fr-FR')};
  },[encaissees]);

  const monthlyRecapData=useMemo(()=>{
    const today=new Date();
    const prevM=today.getMonth()===0?11:today.getMonth()-1;
    const prevY=today.getMonth()===0?today.getFullYear()-1:today.getFullYear();
    const prevMM=String(prevM+1).padStart(2,'0');
    const prevY4=String(prevY);
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const ventes=encaissees.filter(v=>{const p=(v.receiveDate||'').split('/');return p.length===3&&p[1]===prevMM&&p[2]===prevY4;});
    const ca=ventes.reduce((s,v)=>s+ +v.sellPrice,0);
    const profit=ventes.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
    return{count:ventes.length,ca,profit,nom:`${moisNoms[prevM]} ${prevY4}`};
  },[encaissees]);

  const isoWeek=getISOWeekKey();
  const monthKey=dateLocaleISO().slice(0,7);
  const [showWeekly,setShowWeekly]=useState(()=>load('vinted_last_weekly_recap','')!==isoWeek);
  const [showMonthly,setShowMonthly]=useState(()=>load('vinted_last_monthly_recap','')!==monthKey);

  // Stats journalières basées sur la date de réception (CA encaissé) (mémorisé)
  const dayStats=useMemo(()=>{
    const ds={};
    encaissees.forEach(v=>{
      const dt=v.receiveDate||'';
      if(!dt) return;
      if(!ds[dt]) ds[dt]={ca:0,count:0,profit:0};
      ds[dt].ca+=+v.sellPrice;
      ds[dt].count++;
      ds[dt].profit+=(+v.sellPrice-+v.buyPrice);
    });
    return ds;
  },[encaissees]);
  const days=useMemo(()=>Object.entries(dayStats),[dayStats]);

  // (Estimation des cotisations URSSAF déplacée après moisCourant, voir plus bas)

  // CA et bénéfice du MOIS EN COURS (basé sur la date de réception JJ/MM/AAAA)
  const moisCourant=useMemo(()=>{
    const now=new Date();
    const mm=String(now.getMonth()+1).padStart(2,'0');
    const yyyy=String(now.getFullYear());
    let caM=0, profitM=0, countM=0;
    encaissees.forEach(v=>{
      const dt=(v.receiveDate||'').trim(); // format attendu JJ/MM/AAAA
      const parts=dt.split('/');
      if(parts.length===3 && parts[1]===mm && parts[2]===yyyy){
        caM+=+v.sellPrice; profitM+=(+v.sellPrice-+v.buyPrice); countM++;
      }
    });
    const labels=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return {ca:caM, profit:profitM, count:countM, nom:labels[now.getMonth()]};
  },[encaissees]);

  // ⚠️ LE RÉCAP URSSAF NE VIENT PLUS DE L'ARCHIVE (elle est vide depuis
  // juillet 2026, §4 — il affichait donc 0 € partout). Il vient de la photo
  // publiée par l'écran Ventes, qui est le propriétaire des ventes (§11) :
  // ventes FINALISÉES, à leur date de vente, ventes masquées comprises.
  const urssafMois = useMemo(() => {
    const v = load('vinted_urssaf_mois', null);
    return (v && Array.isArray(v.mois)) ? v.mois : null;
  }, [liveStats]);
  const TAUX_URSSAF = tauxUrssaf()/100;
  const bestDayCA=useMemo(()=>[...days].sort((a,b)=>b[1].ca-a[1].ca)[0],[days]);
  const bestDayProfit=useMemo(()=>[...days].sort((a,b)=>b[1].profit-a[1].profit)[0],[days]);
  const avgDayCA=days.length>0?ca/days.length:0;

  // Historique du CA ENCAISSÉ par mois (12 derniers mois, basé sur receiveDate)
  const caHistory=useMemo(()=>{
    const moisCourts=['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    encaissees.forEach(v=>{
      const p=(v.receiveDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,label:moisCourts[parseInt(p[1],10)-1]||p[1],nomComplet:`${moisNoms[parseInt(p[1],10)-1]||p[1]} ${p[2]}`,ventes:[]};
        map[key].ca+=+v.sellPrice;
        map[key].ventes.push(v);
      }
    });
    return Object.keys(map).sort().slice(-12).map(k=>({key:k,label:map[k].label,nomComplet:map[k].nomComplet,ca:map[k].ca,ventes:map[k].ventes}));
  },[encaissees]);

  // Historique du CA par DATE DE VENTE (12 derniers mois, basé sur saleDate)
  const caHistoryVente=useMemo(()=>{
    const moisCourts=['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    sales.forEach(v=>{
      const p=(v.saleDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,label:moisCourts[parseInt(p[1],10)-1]||p[1],nomComplet:`${moisNoms[parseInt(p[1],10)-1]||p[1]} ${p[2]}`,ventes:[]};
        map[key].ca+=+v.sellPrice;
        map[key].ventes.push(v);
      }
    });
    return Object.keys(map).sort().slice(-12).map(k=>({key:k,label:map[k].label,nomComplet:map[k].nomComplet,ca:map[k].ca,ventes:map[k].ventes}));
  },[sales]);

  // CA SUR MESURE — « d'une date à une autre » (Julien, 28 sept.). MÊME source
  // que le graphique par date de vente ci-dessus (§11) : les ventes finalisées,
  // à leur date de VENTE (§5 — jamais la date d'encaissement). Bornes incluses ;
  // une borne vide = ouverte de ce côté. On n'affiche que ce qu'on sait (le
  // nombre de ventes de la période à côté du total, jamais un total « complet »).
  // ⚠️ (29 oct., revue) Il sommait `sales`, l'ANCIENNE archive (vide depuis
  //    juillet) : « 0 vente finalisée · 0,00 € » sous « Finalisé sur Vinted
  //    338 € », sur la même page. Il somme maintenant le CA finalisé par jour de
  //    vente publié par la coque (`caFinaliseParJour`, la population de
  //    « Finalisé sur Vinted », §11). Pas encore lu ⇒ `{passu}` : « — », jamais 0.
  const caRange=useMemo(()=>{
    if(!caDu && !caAu) return null;
    const parJour = liveStats && liveStats.caFinaliseParJour;
    if(!parJour || typeof parJour!=='object') return { passu:true, enCours: !liveStats || !liveStats.venduPasSu };
    let ca=0, count=0;
    for(const [k,v] of Object.entries(parJour)){
      if(caDu && k<caDu) continue;
      if(caAu && k>caAu) continue;
      ca+=Number(v&&v.ca)||0; count+=Number(v&&v.n)||0;
    }
    return {ca:Math.round(ca*100)/100,count};
  },[liveStats,caDu,caAu]);

  // ── GRAPHIQUES « épuré / haut de gamme » (Julien, 28 sept.) : une seule teinte
  //    d'accent, variée par OPACITÉ fixée par plateforme (jamais par rang, §7 +
  //    dataviz), et l'identité portée par les libellés — pas par la couleur seule.
  // Anneau par plateforme — CONSOMME caParPlateforme (§11), ne recalcule rien.
  const platParts=useMemo(()=>{
    const arr=caParPlateforme(liveStats,lbcVentes,ebayCa,ebayCommandes,ventesVc).filter(p=>p.ca!=null && p.ca>0)
      .map(p=>({nom:p.nom, court:nomAffichePlat(p.nom), ca:p.ca}));
    const total=arr.reduce((s,p)=>s+p.ca,0);
    return {arr,total};
  },[liveStats,lbcVentes,ebayCa,ebayCommandes,ventesVc]);

  // Paires ajoutées par jour (basé sur addedAt JJ/MM/AAAA).
  // On ignore la date d'init "01/01/2024" qui regroupe tout l'historique importé,
  // pour ne montrer que le rythme réel d'ajout jour après jour.
  const ajoutsParJour=useMemo(()=>{
    const map={};
    catalog.forEach(p=>{
      const d=(p.addedAt||'').trim();
      if(!d||d==='01/01/2024') return; // on saute l'historique initial
      const parts=d.split('/');
      if(parts.length!==3) return;
      const key=parts[2]+'-'+parts[1].padStart(2,'0')+'-'+parts[0].padStart(2,'0'); // AAAA-MM-JJ pour tri
      if(!map[key]) map[key]={count:0,label:`${parts[0]}/${parts[1]}`};
      map[key].count++;
    });
    // 30 derniers jours d'activité (ceux qui ont au moins une paire)
    return Object.keys(map).sort().slice(-30).map(k=>({key:k,count:map[k].count,label:map[k].label}));
  },[catalog]);

  // Récap comptable par MOIS (CA encaissé, bénéfice, cotisations + impôt 13,5 %)
  // Basé sur la date d'encaissement car c'est ce qui compte pour l'URSSAF.
  const moisRecap=useMemo(()=>{
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    encaissees.forEach(v=>{
      const p=(v.receiveDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,profit:0,count:0,annee:p[2],mois:parseInt(p[1],10)};
        map[key].ca+=+v.sellPrice; map[key].profit+=(+v.sellPrice-+v.buyPrice); map[key].count++;
      }
    });
    const depuisArchive = Object.keys(map).sort().reverse().map(k=>({
      ym:k,
      label:`${moisNoms[map[k].mois-1]||map[k].mois} ${map[k].annee}`,
      ca:map[k].ca, profit:map[k].profit, count:map[k].count,
      urssaf:aPayerUrssaf(map[k].ca, TAUX_URSSAF*100), net:netApresUrssafDe(map[k].ca, TAUX_URSSAF*100)
    }));
    if (!urssafMois) return depuisArchive;
    // ⚠️ Le bénéfice n'est PAS calculable ici (les prix d'achat vivent sur
    // l'écran Annonces) : on le laisse à null et la colonne affiche « — »
    // plutôt qu'un zéro qui passerait pour un vrai chiffre.
    return urssafMois.map(m=>{
      const [y,mo]=m.ym.split('-');
      return { ym:m.ym, label:`${moisNoms[Number(mo)-1]||mo} ${y}`, ca:m.ca, profit:null, count:m.n,
               nMasq:m.nMasq, caMasq:m.caMasq,
               urssaf:aPayerUrssaf(m.ca, TAUX_URSSAF*100), net:netApresUrssafDe(m.ca, TAUX_URSSAF*100) };
    });
  },[encaissees,urssafMois,TAUX_URSSAF]);

  // ── ÉVOLUTION MENSUELLE, DÉRIVÉE DU RÉCAP COMPTABLE (§11) ─────────────────
  // On CONSOMME `moisRecap` — le même tableau que le Récap comptable mensuel
  // (source : la ligne publiée `vinted_urssaf_mois`, sinon l'archive) : le
  // graphique et le tableau ne peuvent donc PAS diverger, et la courbe apparaît
  // partout où le tableau a des lignes. Les deux anciens graphiques lisaient le
  // vieux catalogue local par `receiveDate`/`saleDate` (vide depuis la moisson) :
  // Julien ne voyait plus aucune courbe alors qu'il a ~190 ventes en août.
  // `moisRecap` est du plus récent au plus ancien → on remet dans l'ordre du
  // temps et on garde 12 mois ; le dernier est le mois EN COURS (encore en
  // train de se finaliser — on le DIT, jamais un total partiel présenté comme
  // complet, §5).
  const moisMoisson=useMemo(()=>{
    if(!moisRecap||!moisRecap.length) return null;
    const mc=['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
    const now=new Date(); const curKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    return [...moisRecap].reverse().slice(-12).map(m=>{
      const mo=parseInt(String(m.ym||'').split('-')[1],10); const mi=mo-1;
      return {key:m.ym||m.label,label:mc[mi]||String(mo||''),nomComplet:m.label,ca:Number(m.ca)||0,ventes:Number(m.count)||0,enCours:m.ym===curKey};
    });
  },[moisRecap]);

  // Carte avec icône et taille
  // ⚠️ LE TABLEAU DE BORD AVAIT GARDÉ L'ANCIENNE IDENTITÉ : cartes encadrées à
  // l'ombre douce, avec un EMOJI devant chaque chiffre — alors que tous les
  // écrans du quotidien sont passés au filet d'accent et au chiffre hors boîte
  // (§5.65), et que « un emoji utilisé COMME icône devient une icône au trait »
  // (§5.55). Deux dessins pour la même chose, dans la même application.
  // `StatCard` n'est plus qu'un ALIAS de `StatBox` : une seule définition (§11),
  // donc cet écran hérite désormais de tout ce qui arrivera ensuite.
  // `icon` et `gradient` restent acceptés — les 10 appels ne changent pas — mais
  // ne sont plus dessinés.
  const StatCard=({label,value,color=C.text,sub,subColor=null,onClick=null,title=null})=>
    <div className={label==='CA finalisé'?'vrm-finance-metric is-primary':'vrm-finance-metric'}><StatBox compact label={label} value={value} color={color} sub={sub} subColor={subColor} onClick={onClick} title={title}/></div>;
  // Une seule phrase pour une seule cause, et elle ouvre la saisie en série sur
  // l'écran Annonces (le propriétaire de la modale, §11).
  // (16 oct.) Vinted → Annonces (l'écran de la plateforme), plus l'ancien
  // écran isolé « Annonces en ligne » (`cat_annonces`).
  const versSaisiePrix = () => { DEMANDE_SAISIE_PRIX.on = true; if (onGo) onGo('vinted_annonces'); };
  // Les cartes qui ne peuvent rien afficher gardent leur tiret ; la RAISON et la
  // PORTE vivent ici, une fois par groupe (§7 : la même phrase répétée sur
  // chaque ligne est UNE phrase — il y en avait six sur cet écran).
  const manquePrix = !!(liveStats && liveStats.caEncaisse != null);
  // ⚠️ La ligne ne nomme QUE ce qui est vraiment bloqué. Dès qu'un prix d'achat
  // est saisi, la valeur du stock s'affiche et n'attend plus rien : la citer
  // quand même serait une alerte fausse, et une alerte fausse fait douter des
  // vraies.
  const stockInconnu = !!(valeurStk && valeurStk.n > 0 && valeurStk.centimes == null);
  // (3 nov.) Le bénéfice et la marge attendent un prix d'achat seulement quand LA règle le dit (`CBa.raison`).
  const quoiDepuisDebut = stockInconnu
    ? (CBa.raison === 'achats' ? 'La valeur du stock, le bénéfice et la marge' : 'La valeur du stock')
    : 'Le bénéfice et la marge';
  // (16 oct., passe « premium ») : un LIEN discret, pas une ligne orange — la
  // cause est dite une fois par groupe, et le geste est le lien lui-même.
  const LignePrixAchat = ({ quoi, dans = false }) => (
    <button type="button" onClick={versSaisiePrix}
      title="Ouvrir la saisie en série des prix d'achat"
      style={{alignSelf:'flex-start',border:'none',background:'transparent',padding:0,margin:dans?0:'-4px 0 0',cursor:'pointer',
        fontFamily:'inherit',fontSize:13,fontWeight:500,color:C.muted,textAlign:'left',minHeight:0,lineHeight:1.45}}>
      {quoi} attendent tes prix d'achat — <span style={{color:C.accentTexte,fontWeight:600,whiteSpace:'nowrap'}}>les saisir →</span>
    </button>
  );
  // ── Typographie de l'écran (16 oct.) ─────────────────────────────────────
  // Un montant ne se coupe JAMAIS en deux (« 2066,80 » puis « € » seul sur la
  // ligne suivante) : `Mt` le garde d'un bloc, en chiffres tabulaires.
  const Mt = ({ v }) => <span style={{whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmt(v)}</span>;
  // Libellés en casse normale (plus de capitales espacées partout) : un titre
  // de carte, un libellé de chiffre, une note.
  const sTitre = {fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15};
  const sLib = {fontSize:13,color:C.muted,fontWeight:500};
  const sNote = {fontSize:13,color:C.muted,lineHeight:1.5};
  const sHero = {fontWeight:700,color:C.text,letterSpacing:-1,lineHeight:1.05,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'};
  const sCarte = {padding:18,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:C.shadow};

  return (
    <div className="vrm-finance-page vrm-statistiques-premium" style={{padding:16,display:'flex',flexDirection:'column',gap:18}}>
      <ScreenHead icon="euro" title={L.argent} phrase="dashboard" sous={sousNav ? <div className="vrm-stats-sous-nav" data-stats-sous-nav="">{sousNav}</div> : null} right={<Segmente label="Période" className="vrm-sv-periode" value={periodeStats} onChange={setPeriodeStats} options={Object.entries(PERIODES).map(([v,l])=>({v,l,data:{'data-sv-choix':v}}))}/>}/>
      <StatsVitrine liveStats={liveStats} panelOff={panelOff} periode={periodeStats} onSaisirPrix={versSaisiePrix} onGo={onGo}/>
      {/* 🎯 OBJECTIF DU MOIS (4 nov.) — le MÊME réglage et la MÊME règle que la barre de la carte sombre.
          (11 nov., lot objectifs-mois) Sorti du volet replié : c'est LE détail de l'objectif dans Argent. */}
      <div className="vrm-objectif-argent" data-objectif-argent=""><Card><ObjectifDuMois liveStats={liveStats}/></Card></div>
      {/* (8 nov., « beauté ») Le vendu par semaine façon Santé : les 12 semaines de `rythmeVendu`
          (`ventesFaites`), une semaine touchée = son détail. Sorti du volet replié (il n'y est plus redit). */}
      <VenduParSemaineSante liveStats={liveStats}/>
      {/* (10 nov., lot BC) L'écran « Ma semaine » (le bilan de la semaine) : un lien, rien de recalculé ici. */}
      {onGo ? <button type="button" className="vrm-lien-action" data-ouvre-ma-semaine="" onClick={() => onGo('semaine')} style={{alignSelf:'flex-start',minHeight:44,padding:'0 4px',border:0,background:'transparent',font:'inherit',fontSize:15,fontWeight:600,color:C.accentTexte||C.text,cursor:'pointer'}}>Ma semaine <span aria-hidden="true">›</span></button> : null}
      <ComparerMoisCarte liveStats={liveStats} panelOff={panelOff}/>
      <FraisParSiteCarte periode={periodeStats} ebayCommandes={ebayCommandes}/>
      {/* (2 nov., « beaucoup d'incompréhension » — Julien) En haut, les chiffres qui
          comptent pour la période ; tout le reste est rangé en deux volets repliés,
          ouverts d'un geste et gardés ouverts sur cet appareil. Aucune règle ne change. */}
      <RepliStats id="argent" titre="L’argent depuis le début" phrase="Finalisé par plateforme et par compte, mois par mois, entre deux dates.">

      {/* Stats principales — priorité aux valeurs Vinted en direct (liveStats) :
          Articles en stock = nb de numéros étiquetés au garage · Valeur du stock =
          celle publiée par Annonces (`vrm_valeur_stock`, paires présentes) · CA = ventes finalisées, tous comptes.
          Repli sur les valeurs locales (catalogue/garage) tant que le direct charge. */}
      <div data-stats-carte="hero" data-notion="finalise-vinted" className="vrm-stats-hero" style={{...sCarte,padding:'20px 20px 18px',marginTop:4}}>
        <div style={sLib}>Finalisé sur Vinted · depuis le début</div>
        {/* ⚠️ « CA ENCAISSÉ » EST LE MOT INTERDIT : l'app date tout au jour de la
            VENTE, jamais au jour où Vinted a versé l'argent (elle ne connaît pas
            cette date). Le rapport comptable a été corrigé, ce titre-là était
            resté — et c'est le chiffre qu'on regarde pour déclarer. */}
        {/* ⚠️ SCOPE EXPLICITE : ce chiffre est le CA finalisé VINTED (caEncaisse) —
            le même que la ligne « Vinted » de la carte « par plateforme » juste
            dessous. Sans « Vinted » dans le sous-titre, il se lit comme un total
            global alors que le « Total toutes plateformes » (Collectif) est plus
            grand dès qu'une autre plateforme a des ventes : un total partiel qui
            se présente comme complet (§5). On ne touche PAS la valeur (URSSAF). */}
        {/* (16 oct.) Le chiffre héros, seul, en très gros — plus de cellule
            noire, plus de filet vertical parasite à gauche de chaque texte
            (l'ombre « -1px » de StatBox compact). */}
        <div className="vrm-display" data-finalise-vinted={liveStats&&liveStats.caEncaisse!=null?Math.round(liveStats.caEncaisse*100):undefined} data-finalise-prix-pas-lu={liveStats&&liveStats.prixPasLu>0?liveStats.prixPasLu:undefined} style={{...sHero,fontSize:28,marginTop:6}}>{liveStats&&liveStats.prixPasLu>0&&liveStats.caEncaisse!=null?<span style={{fontSize:15,fontWeight:600,color:C.muted,letterSpacing:0}}>au moins </span>:null}{fmt(liveStats&&liveStats.caEncaisse!=null?liveStats.caEncaisse:ca)}</div>
        {liveStats && liveStats.prixPasLu > 0 && liveStats.caEncaisse != null && <div style={{...sNote,marginTop:4}}>{liveStats.prixPasLu} vente{liveStats.prixPasLu>1?'s':''} finalisée{liveStats.prixPasLu>1?'s':''} au prix pas lu : pas dans ce montant.</div>}
        <div style={{...sNote,marginTop:6,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>Vinted seul · tous comptes · au jour de la vente <Pourquoi label="Et Leboncoin, eBay ?">Ce chiffre ne compte que les ventes finalisées sur Vinted. Leboncoin et eBay sont dans « Finalisé par plateforme », plus bas.</Pourquoi></div>
        {liveStats && liveStats.nMasque > 0 && liveStats.caEncaisse != null && (
          <div data-finalise-masquees={liveStats.nMasque} data-finalise-masquees-eur={Math.round(liveStats.caMasque*100)} style={{...sNote,marginTop:4}}>
            {liveStats.nMasque>1 ? `Sans tes ${liveStats.nMasque} ventes masquées (${fmt(liveStats.caMasque)}) — elles restent dans ton CA déclaré (Comptabilité).` : `Sans ta vente masquée (${fmt(liveStats.caMasque)}) — elle reste dans ton CA déclaré (Comptabilité).`}
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',marginTop:16,borderTop:`1px solid ${C.border}`}}>
          {/* Bénéfice/marge : un tiret tant qu'aucun prix d'achat n'est saisi
              (sinon on afficherait le CA comme « bénéfice », ce qui est faux —
              cf. écran Ventes). ⚠️ « prix d'achat manquants » disait la MÊME
              chose que ses deux voisines : une cause, une phrase (le lien
              dessous). */}
          {[[NOM_BENEFICE, CBa.valeur==null?'—':fmt(CBa.valeur), `en ${anneeA}`, { 'data-benef-notion':'benefice', 'data-benef-periode':'annee', 'data-benef-valeur':CBa.valeur==null?'':String(Math.round(CBa.valeur*100)), 'data-benef-raison':CBa.raison||'' }],
            ['Marge', margeA==null?'—':`${String(margeA).replace('.',',')}\u00a0%`, `en ${anneeA}`, { 'data-marge-notion':'benefice', 'data-marge-valeur':margeA==null?'':String(margeA) }]].map(([l,v,sub,attrs],i)=>(
            <div key={l} {...attrs} style={{padding:'12px 0 0',paddingLeft:i?16:0,borderLeft:i?`1px solid ${C.border}`:'none',minWidth:0}}>
              <div style={sLib}>{l}</div>
              <div className="vrm-display" style={{...sHero,fontSize:20,letterSpacing:-0.4,marginTop:4,color:v==='—'?C.muted:C.text}}>{v}</div>
              {sub && <div style={{...sNote,fontSize:11,marginTop:2}}>{sub}</div>}
            </div>
          ))}
        </div>
        {(CBa.raison === 'achats' || (manquePrix && stockInconnu)) && <div style={{marginTop:14}}><LignePrixAchat quoi={quoiDepuisDebut} dans/></div>}
      </div>

      {/* (16 oct.) Les deux volets repliés vivent dans UNE carte, l'un sous
          l'autre — ils flottaient entre deux cartes avec des marges inégales. */}
      <div data-stats-carte="activite" className="vrm-stats-volets" style={{...sCarte,padding:'4px 18px'}}>
      {liveStats && <details className="vrm-finance-activity" style={{fontSize:13,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
        {/* (16 oct.) Chaque montant reste d'un bloc avec son libellé : « 2066,80 »
            ne se sépare plus de son « € » au retour à la ligne. */}
        <summary style={{cursor:'pointer',padding:'10px 0',lineHeight:1.65}}>Ventes enregistrées · <span style={{whiteSpace:'nowrap'}} data-dash-vendu-jour={liveStats.ventesJour!=null?Math.round((liveStats.caJour || 0)*100):undefined} data-dash-vendu-jour-n={liveStats.ventesJour!=null?liveStats.ventesJour:undefined}>aujourd’hui <b style={{color:C.text,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{liveStats.caJour!=null?fmt(liveStats.caJour):'—'}</b></span> · <span style={{whiteSpace:'nowrap'}} data-dash-stat="caMois" data-dash-cents={liveStats.caMois!=null?Math.round(liveStats.caMois*100):undefined}>ce mois <b style={{color:C.text,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{liveStats.caMois!=null?fmt(liveStats.caMois):'—'}</b></span></summary>
        <p>Ventes faites, toutes plateformes, avant encaissement. Le CA finalisé et l’argent reçu restent distincts.</p>
        {liveStats.venduPasSu && <p data-dash-vendu-pas-su="1">Les ventes n’ont pas pu être lues. Les montants restent inconnus.</p>}
        {(liveStats.venduManque || []).length>0 && <p data-dash-vendu-manque={liveStats.venduManque.join(',')}>Total partiel, sans {liveStats.venduManque.join(', ')} : ventes non lues.</p>}
      </details>}
      {/* (16 oct.) « Annonces en ligne » avait disparu du tableau de bord avec
          la simplification du 13 octobre — et avec elle la ligne qui dit de
          quand date sa lecture. Le chiffre revient ICI, dans le titre du volet
          (visible replié), écrit par `texteEnLigne` (« ≥ N » quand des annonces
          sont à confirmer) ; la ligne de fraîcheur est la MÊME que celle de
          l'écran Annonces (`FraicheurAnnonces`, §11), et se tait quand tout
          est frais. */}
      <details className="vrm-finance-stock"><summary>Stock et volume de ventes{/* (31 oct.) le nombre d'annonces en ligne vit dans la tuile « En ligne » du haut (écrit une fois, §7) */}</summary><div className="vrm-finance-stock-grid">
        {/* ⚠️ LE LIBELLÉ ÉTAIT FAUX. « Paires en stock : 0 » s'affichait en gros
            alors qu'il y a 50 annonces en ligne — parce que ce compteur mesure
            les numéros POSÉS AU GARAGE (le garage est vide), ce que seule la
            légende disait. Un chiffre qu'on doit corriger avec sa légende est un
            chiffre faux : le titre dit maintenant ce qu'il compte. */}
        <StatCard icon="📦" label="Articles en stock" value={liveStats&&liveStats.pairesStock!=null?liveStats.pairesStock:stockCount} color={C.text} sub="cases réellement remplies"/>
        {/* ⚠️ « 0,00 € » N'EST PAS UN ZÉRO, C'EST UNE ABSENCE. Cette carte somme
            les PRIX D'ACHAT des annonces en ligne — or aucun n'est saisi, donc
            elle affichait un gros 0,00 € à côté d'un « 1581 € de valeur » sur
            l'écran Annonces (qui, lui, somme les prix de VENTE). Deux chiffres
            qui portent presque le même nom et se contredisent (§11). Tant qu'on
            ne sait rien, on l'écrit. */}
        {/* (10 nov., lot BF) LA VALEUR DU STOCK : celle publiée par Annonces (`vrm_valeur_stock`,
            src/coutVente.js — paires PRÉSENTES, prix d'achat SAISIS), avec sa couverture ;
            « N sans prix » ouvre la saisie en série. Jamais publiée ⇒ « — ». */}
        {(()=>{ const t = texteValeurStock(valeurStk, { partiel: !!(valeurStk && valeurStk.partiel) });
          return <div style={{display:'contents'}} data-stats-valeur-stock={valeurStk ? (valeurStk.centimes == null ? 'passu' : String(valeurStk.centimes)) : 'jamais'} data-stats-valeur-sans={valeurStk ? valeurStk.nSans : undefined}><StatCard icon="💰" label="Valeur du stock"
            value={valeurStk && valeurStk.centimes != null ? t.montant : '—'} color={C.text}
            sub={valeurStk ? [t.auMoins && valeurStk.centimes != null ? 'au moins' : '', t.sur, t.sans].filter(Boolean).join(' · ') : 'annonces pas encore lues'}
            onClick={valeurStk && valeurStk.nSans ? versSaisiePrix : null} title={valeurStk && valeurStk.nSans ? 'Saisir les prix d’achat qui manquent' : null}/></div>; })()}
        {/* « Vendues » = nb de ventes finalisées côté Vinted (moisson), pas le
            vieux catalogue archivé (vide → carte vide, plainte de Julien). */}
        <StatCard icon="✅" label="Vendues" value={liveStats&&liveStats.soldTotal!=null?liveStats.soldTotal:totalSold} color={C.text} sub="finalisées, tous comptes"/>
      </div></details>
      {liveStats && <FraicheurAnnonces attr="data-dash-fraicheur" lues={liveStats.annLues} enLigne={liveStats.annEnLigne} noms={liveStats.annNoms} supprimees={liveStats.annSuppr} aConfirmer={liveStats.annAConfirmer} numeros={numerosDash} activite={liveStats.annActivite} style={{marginTop:4,marginBottom:10}}/>}
      </div>

      {/* ── COURBE DU CHIFFRE D'AFFAIRES, 12 MOIS (30 sept.) ─────────────────
          « Des graphiques de qualité » : la même courbe que l'accueil, sur
          douze mois. Source = `caParMois`, calculé dans la même boucle que « CA
          du mois » (§11) — le dernier point est donc exactement ce chiffre-là. */}
      {liveStats && liveStats.caParMois && (()=>{
        const now = new Date(); const mois = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          mois.push({ cle:k, eur: liveStats.caParMois[k] || 0, n: (liveStats.ventesParMois||{})[k] || 0,
            long: d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}) });
        }
        const tot = mois.reduce((a,m)=>a+m.eur,0);
        if (!tot) return null;
        const meilleur = mois.reduce((a,m)=>m.eur>a.eur?m:a, mois[0]);
        const encours = mois[mois.length-1];
        // (16 oct.) Douze BARRES plutôt qu'une ligne écrasée : un mois est un
        // total, il se lit en hauteur. Le meilleur mois et le mois en cours sont
        // MARQUÉS sur le graphique et leur valeur exacte écrite dessous — jamais
        // une valeur arrondie différemment (« 2 k ») à côté du vrai montant (§7).
        return (
          <div data-stats-carte="courbe" data-stats-courbe data-notion="vendu" style={{...sCarte,marginTop:4}}>
            <div style={sLib}>Vendu · 12 derniers mois</div>
            <div style={{fontSize:11,color:C.muted,marginTop:4,display:'flex',alignItems:'center',gap:4}}>Toutes plateformes · ventes en cours comprises <Pourquoi label="Pourquoi plus que le finalisé ?">Au jour de la vente, ventes en cours comprises : ce n'est pas le finalisé, c'est pourquoi ce total peut dépasser celui du dessus.</Pourquoi></div>
            <div className="vrm-display" style={{...sHero,fontSize:28,letterSpacing:-0.8,marginTop:6}}>{fmt(tot)}</div>
            <div style={{marginTop:14}}><CourbeMois mois={mois.map((m,i)=>({...m,enCours:i===mois.length-1}))} attr="data-courbe-vendu" presentation="ligne" legende={false}/></div>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.muted}}>
                <span aria-hidden="true" style={{width:10,height:10,borderRadius:999,background:C.accent,flexShrink:0}}/>
                <span style={{flex:1,minWidth:0}}>Meilleur mois · <span style={{color:C.text,fontWeight:500}}>{meilleur.long}</span></span>
                <b style={{color:C.text,fontWeight:600}}><Mt v={meilleur.eur}/></b>
              </div>
              {encours.cle !== meilleur.cle && <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.muted}}>
                <span aria-hidden="true" style={{width:10,height:10,borderRadius:999,flexShrink:0,boxSizing:'border-box',border:`2px solid ${C.accent}`,background:C.card}}/>
                <span style={{flex:1,minWidth:0}}>En cours · <span style={{color:C.text,fontWeight:500}}>{encours.long}</span></span>
                <b style={{color:C.text,fontWeight:600}}><Mt v={encours.eur}/></b>
              </div>}
            </div>
          </div>
        );
      })()}

      {/* ── CA PAR PLATEFORME ET PAR COMPTE ─────────────────────────────────
          Julien, 21 sept. : « un chiffre d'affaires global et un CA par
          application ; et tu peux décomposer aussi en compte ». Deux
          décompositions du CA finalisé, sur la MÊME source que le total
          (§11) — la somme des lignes est exactement le global, donc chaque
          chiffre est vérifiable (§2.7).
          ⚠️ On n'invente aucune vente : une plateforme sans vente captée
          affiche « — · pas encore de vente captée », jamais « 0 € »
          (§7, un zéro qui veut dire « on ne sait pas » s'écrit avec sa
          raison). Les ventes Leboncoin PROUVÉES (isSeller===true, §5) sont
          les seules comptées ; eBay et Vestiaire Co n'ont encore
          aucune vente captée. */}
      {(()=>{
        // §11 : LE MÊME helper que l'onglet Collectif — un seul propriétaire du
        // « CA par plateforme », les deux écrans ne peuvent pas diverger.
        const plateformes = caParPlateforme(liveStats, lbcVentes, ebayCa, ebayCommandes, ventesVc);
        const caVinted = plateformes[0].ca, caLbc = plateformes[1].ca;
        const parCompte = (liveStats && liveStats.caParCompte) || null;
        // Rien à décomposer tant que le CA Vinted n'est pas encore lu.
        if (caVinted == null && caLbc == null) return null;
        // ⚠️ (5 nov., Julien : « le dernier compte connecté n'avait pas son CA dans
        //    Statistiques ») Seuls les comptes à CA finalisé > 0 avaient une ligne :
        //    un compte neuf dont la seule vente est EN COURS (pas encore finalisée)
        //    disparaissait de la carte, comme s'il n'existait pas. Désormais CHAQUE
        //    compte lié non écarté a sa ligne (`comptesCa`, la même boucle que le
        //    total, §11) : son finalisé (0,00 € s'il n'en a pas — un zéro LU),
        //    et dessous ce qui est en cours ; ventes pas lues ⇒ « — · pas lues ».
        const detail = (liveStats && Array.isArray(liveStats.comptesCa)) ? liveStats.comptesCa : null;
        const comptes = detail
          ? detail.map((c)=>[c.login || `#${c.uid}`, c.lu ? c.finalise : null, c]).sort((a,b)=>(b[1]??-1)-(a[1]??-1) || ((b[2].enCours||0)-(a[2].enCours||0)))
          : parCompte ? Object.entries(parCompte).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]) : [];
        const noteCompte = (c) => !c ? null : !c.lu ? 'ventes pas lues pour ce compte' : [
          c.nFinalise ? `${c.nFinalise} vente${c.nFinalise>1?'s':''} finalisée${c.nFinalise>1?'s':''}` : 'aucune vente finalisée',
          c.nEnCours ? `${c.nEnCours} en cours · ${fmt(c.enCours)}` : '',
          // (revue) Une vente finalisée au prix illisible : le montant est un minimum, et il le dit (§5).
          c.nPrixPasLu ? `au moins : ${c.nPrixPasLu} vente${c.nPrixPasLu>1?'s':''} au prix pas lu` : '',
        ].filter(Boolean).join(' · ');
        // (16 oct.) Une ligne = le nom, sa note, le montant à droite (d'un
        // bloc, chiffres tabulaires) ; dessous, la part du total en barre
        // pleine sur un rail, une seule teinte (§7). Une plateforme sans vente
        // captée reste nommée, en sourdine, avec son tiret.
        const Ligne = ({label, val, note, fort, part}) => (
          <div style={{padding:fort?'12px 0 2px':'11px 0',borderTop:`1px solid ${C.border}`}}>
            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:15,fontWeight:fort?600:500,color:val==null?C.muted:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</div>
                {note && <div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.35}}>{note}</div>}
              </div>
              <span className="vrm-display" style={{fontSize:15,fontWeight:fort?700:600,color:val==null?C.muted:C.text,whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums',flexShrink:0,letterSpacing:-0.2}}>{val==null?'—':fmt(val)}</span>
            </div>
            {part!=null && <div style={{display:'flex',alignItems:'center',gap:10,marginTop:8}}>
              <div style={{flex:1,height:6,borderRadius:999,background:C.card2||C.border,overflow:'hidden'}}><div style={{width:`${Math.max(2,part*100)}%`,height:'100%',borderRadius:999,background:C.accent}}/></div>
              <span style={{fontSize:11,color:C.muted,fontVariantNumeric:'tabular-nums',minWidth:34,textAlign:'right',whiteSpace:'nowrap'}}>{Math.round(part*100)}&nbsp;%</span>
            </div>}
          </div>
        );
        const totPlat = plateformes.reduce((s2,p)=>s2+(p.ca||0),0);
        const totCpt = comptes.reduce((s2,[,v])=>s2+(v||0),0);
        return (
          <div className="vrm-stats-comptes" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(320px,100%), 1fr))',gap:12,marginTop:4}}>
            <div data-stats-carte="plateformes" data-stats-plateformes data-notion="finalise" style={{...sCarte,paddingBottom:12}}>
              <div style={{...sTitre,marginBottom:8}}>Finalisé par plateforme</div>
              {plateformes.map(p => <Ligne key={p.nom} label={nomAffichePlat(p.nom)} val={p.ca} note={p.note} part={p.ca!=null && totPlat>0 && plateformes.filter(x=>x.ca!=null).length>1 ? p.ca/totPlat : null}/>)}
              {/* Total = somme des plateformes captées = le CA global de l'onglet
                  Collectif (§11 : les deux écrans ne peuvent pas se contredire).
                  Affiché seulement quand ≥ 2 plateformes ont des ventes, sinon il
                  répète la seule ligne remplie. */}
              {(()=>{ const nz=plateformes.filter(p=>p.ca!=null); return nz.length>=2 ? <Ligne label="Total finalisé" val={nz.reduce((s,p)=>s+p.ca,0)} fort/> : null; })()}
            </div>
            <div data-stats-carte="comptes" style={{...sCarte,paddingBottom:12}}>
              <div style={{...sTitre,marginBottom:8}}>CA Vinted par compte</div>
              {comptes.length
                ? comptes.map(([lg,v,c]) => <div key={c ? c.uid : lg} data-stats-compte={c ? c.uid : lg} data-stats-compte-cents={v==null?'':String(Math.round(v*100))} data-stats-compte-encours={c&&c.lu?String(Math.round(c.enCours*100)):undefined} data-stats-compte-partiel={c&&c.nPrixPasLu?'1':undefined}><Ligne label={lg} val={v} note={noteCompte(c)} part={comptes.length>1 && totCpt>0 && v!=null ? v/totCpt : null}/></div>)
                : <div style={{fontSize:13,color:C.muted,padding:'10px 0',borderTop:`1px solid ${C.border}`}}>Le détail par compte apparaît dès que tes ventes sont chargées.</div>}
              {/* (30 oct.) Plus de « Total Vinted » : c'est « Finalisé sur Vinted · tous comptes »,
                  en tête du même écran (§7, un chiffre une fois). */}
            </div>
          </div>
        );
      })()}

      {/* (30 oct.) « Remplissage du stock » lisait l'ancienne grille de zones, que plus aucun
          écran ne remplit (le Stock range dans Mes meubles / Ma pièce) : 0 % à vie. Retiré. */}
      {/* Stats secondaires */}
      {/* Ces cartes venaient du vieux catalogue (vide) → toutes à 0 (plainte de
          Julien). « Vente moyenne » se calcule sur la moisson (CA encaissé /
          nb ventes finalisées). Le « × moyen » et le « bénéf. moyen »
          dépendent des prix d'achat (non saisis) → un tiret honnête plutôt
          qu'un 0 trompeur. (16 oct.) Une carte, une grille 2 × 2 régulière, au
          lieu de quatre boîtes de largeurs différentes. */}
      {(()=>{
        const hv = liveStats && liveStats.soldTotal!=null;
        // Ventes illisibles : un tiret, jamais la moyenne de l'archive vide (0 €).
        const venteMoy = liveStats && liveStats.venduPasSu ? null : (hv && liveStats.soldTotal>0 ? liveStats.caEncaisse/liveStats.soldTotal : avgSale);
        // ⚠️ PAS DE « n/d » : un tiret dit « on ne sait pas » ; la raison juste
        // dessous dit quoi faire.
        // ⚠️ TRANCHÉ. « CA / jour actif » comptait les jours d'après
        // `receiveDate` (retirée de l'app) : un tiret que RIEN ne pouvait
        // remplir. On affiche le CA moyen par JOUR OÙ IL A VENDU — `joursVente`
        // est publié par le même calcul que `caEncaisse` (§11), sur exactement
        // les mêmes ventes finalisées. Tant que la moisson n'a rien publié, tiret.
        const cases = [
          ['Multiplicateur moyen (vente ÷ achat)', hv?'—':`×${avgX}`, null, true],
          ['Vente moyenne', venteMoy==null?'—':fmt(venteMoy), hv?`sur ${liveStats.soldTotal} vente${liveStats.soldTotal>1?'s':''}`:null, false],
          [`${NOM_BENEFICE} moyen par vente`, beneficeMoyA==null?'—':fmt(beneficeMoyA), `en ${anneeA}`, beneficeMoyA==null],
          ['CA / jour de vente', hv && liveStats.joursVente>0 ? fmt(liveStats.caEncaisse/liveStats.joursVente) : '—',
            hv && liveStats.joursVente>0 ? `${liveStats.joursVente} jour${liveStats.joursVente>1?'s':''} où tu as vendu` : 'en attente de la synchro Vinted', false],
        ];
        return (
          <div data-stats-carte="details" style={sCarte}>
            <div style={{...sTitre,marginBottom:4}}>Moyennes</div>
            <div className="vrm-mois-grille" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:0}}>
              {cases.map(([l,v,sub,sourd])=>(
                <div key={l} style={{minWidth:0,padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
                  <div style={sLib}>{l}</div>
                  <div className="vrm-display" style={{...sHero,fontSize:20,letterSpacing:-0.4,marginTop:4,color:(sourd||v==='—')?C.muted:C.text}}>{v}</div>
                  {sub && <div style={{...sNote,fontSize:11,marginTop:2}}>{sub}</div>}
                </div>
              ))}
            </div>
            {hv && !manquePrix && <div style={{marginTop:6}}><LignePrixAchat quoi="Le multiplicateur" dans/></div>}
          </div>
        );
      })()}

      {/* Records — seulement s'il y en a (un titre sans rien dessous n'apprend rien). */}
      {(bestDayCA||bestDayProfit) && <div data-stats-carte="records" style={sCarte}>
        <div style={{...sTitre,marginBottom:4}}>Records</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:0}}>
          {bestDayCA&&(
            <div style={{minWidth:0,padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
              <div style={sLib}>Meilleur jour</div>
              <div className="vrm-display" style={{...sHero,fontSize:20,letterSpacing:-0.4,marginTop:4}}>{fmt(bestDayCA[1].ca)}</div>
              <div style={{...sNote,fontSize:11,marginTop:2}}>{bestDayCA[0]} · {bestDayCA[1].count} vente{bestDayCA[1].count>1?'s':''}</div>
            </div>
          )}
          {bestDayProfit&&(
            <div style={{minWidth:0,padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
              <div style={sLib} data-benef-notion="brut">Meilleur jour · {NOM_BENEFICE_BRUT.toLowerCase()}</div>
              <div className="vrm-display" style={{...sHero,fontSize:20,letterSpacing:-0.4,marginTop:4}}>{fmt(bestDayProfit[1].profit)}</div>
              <div style={{...sNote,fontSize:11,marginTop:2}}>{bestDayProfit[0]}</div>
            </div>
          )}
        </div>
      </div>}

      {/* ── ÉVOLUTION MENSUELLE, SUR LES VRAIES DONNÉES (moisson) ──────────
          §11 : même source que le CA total. Une seule teinte d'accent (§7),
          barres fines à sommet arrondi, la valeur écrite sur chaque barre. Le
          mois EN COURS est hachuré et dit « en cours » : un total partiel ne se
          présente jamais comme complet (§5). Bascule CA €/Ventes plutôt qu'un
          double axe (jamais deux échelles sur un même graphique — dataviz). */}
      {moisMoisson && moisMoisson.length>0 && (()=>{
        const val=(h)=> caMode==='ca' ? h.ca : h.ventes;
        const maxV=Math.max(...moisMoisson.map(val),1);
        const sel=moisMoisson.find(h=>h.key===selMois);
        return (
          <Card>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:600,color:C.text,flex:1,minWidth:120}}>Évolution — ventes finalisées</span>
              <Segmente label="Montrer" value={caMode} onChange={setCaMode} options={[{v:'ca',l:'CA\u00a0€'},{v:'ventes',l:'Ventes'}]}/>
            </div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>
              {moisMoisson.length} mois · touche un point pour le détail
            </div>
            <CourbeMois mois={moisMoisson.map(h=>({cle:h.key,long:h.nomComplet,n:h.ventes,ca:h.ca,ventes:h.ventes,enCours:h.enCours}))} valeur={(m)=>caMode==='ca'?m.ca:m.ventes} format={(v)=>caMode==='ca'?`${Math.round(v).toLocaleString('fr-FR')}\u00a0€`:String(Math.round(v))} choisi={selMois} onChoisir={setSelMois} attr="data-courbe-finalise"/>
            {sel&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,fontSize:13,color:C.text}}>
                <b>{sel.nomComplet}</b>{sel.enCours&&<span style={{color:C.muted,fontWeight:500}}> · en cours (se finalise ~2 semaines après la vente)</span>} — <b>{fmt(sel.ca)}</b> · {sel.ventes} vente{sel.ventes>1?'s':''}
              </div>
            )}
          </Card>
        );
      })()}

      {/* Graphique du CA encaissé par mois (repli : ancien catalogue local, si
          la moisson n'a encore rien publié) */}
      {!moisMoisson && caHistory.length>0&&(()=>{
        const maxCA=Math.max(...caHistory.map(h=>h.ca),1);
        const sel=caHistory.find(h=>h.key===selMonthEnc);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>Évolution du CA (ventes finalisées, 12 derniers mois)</div>
            <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginBottom:14}}>Touche un point pour voir le détail des ventes du mois.</div>
            <CourbeMois mois={caHistory.map(h=>({cle:h.key,long:h.nomComplet,ca:h.ca,n:h.ventes.length}))} valeur={(m)=>m.ca} format={(v)=>`${Math.round(v).toLocaleString('fr-FR')}\u00a0€`} choisi={selMonthEnc} onChoisir={setSelMonthEnc} attr="data-courbe-encaisse"/>
            {sel&&<MonthDetail mois={sel} type="encaisse" C={C} fmt={fmt} catMap={catMap} catalog={catalog} onClose={()=>setSelMonthEnc(null)}/>}
          </Card>
        );
      })()}

      {/* CA SUR MESURE : d'une date à une autre (Julien, 28 sept.). */}
      <Card>
        <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>CA entre deux dates</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Ventes finalisées, à leur date de vente</div>
        {/* (29 oct.) Le même calendrier « comme Airbnb » que Ventes et Achats (§11). */}
        <PeriodePicker titre="Période du chiffre d'affaires" vide="Choisir une période" value={(caDu||caAu)?{from:caDu?new Date(caDu+'T00:00:00'):null,to:caAu?new Date(caAu+'T00:00:00'):null,...(caLabel?{label:caLabel}:{})}:null}
          onChange={v=>{ const k=(d)=>{ if(!d) return ''; const t=d instanceof Date?d:new Date(d); return isNaN(t.getTime())?'':`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; }; setCaDu(v?k(v.from):''); setCaAu(v?k(v.to):''); setCaLabel(v&&v.label?String(v.label):''); }}/>
        {caRange ? (
          <div style={{marginTop:14}}>
            <div className="vrm-display" data-ca-plage={caRange.passu?'':String(Math.round(caRange.ca*100))} style={{fontSize:28,fontWeight:800,color:C.text}}>{caRange.passu?'—':fmt(caRange.ca)}</div>
            <div data-ca-plage-phrase style={{fontSize:13,color:C.muted,marginTop:2}}>
              {caRange.passu
                ? (caRange.enCours ? `Lecture de tes ventes Vinted… (${phrasePlage(caDu?new Date(caDu+'T00:00:00'):null, caAu?new Date(caAu+'T00:00:00'):null)})` : `Tes ventes Vinted n'ont pas pu être lues — le total ${phrasePlage(caDu?new Date(caDu+'T00:00:00'):null, caAu?new Date(caAu+'T00:00:00'):null)} ne se calcule pas pour l'instant.`)
                : `${caRange.count} vente${caRange.count>1?'s':''} finalisée${caRange.count>1?'s':''} ${phrasePlage(caDu?new Date(caDu+'T00:00:00'):null, caAu?new Date(caAu+'T00:00:00'):null)} · Vinted, tous comptes`}
            </div>
          </div>
        ) : null /* (30 oct.) Rien de choisi : le bouton dit « Choisir une période » (il disait
                  « Toute la période » au-dessus d'une phrase « choisis une période ») ; le
                  total de toute la période est déjà « Finalisé sur Vinted », en tête. */}
      </Card>

      {/* (30 oct.) L'anneau « Répartition du CA par plateforme » redisait « Finalisé par plateforme »
          (mêmes montants, mêmes parts) : une notion, un bloc (§7). */}
      {/* Ce qui se vend : marque, taille, modèle, pays, temps de vente (17 oct.). */}
      {/* (31 oct.) Rythme, marges par groupe, temps de vente, jours et heures,
          stock qui dort, rotation, annulations — chacun avec sa couverture. */}
      </RepliStats>
      <RepliStats id="vente" titre="Ce qui se vend, ton rythme, le stock qui dort" phrase="Marges par marque, temps de vente, jours et heures où tu vends, paires en ligne depuis longtemps, boost.">
      <StatsDetaillees liveStats={liveStats} panelOff={panelOff} onVoirDorment={onGo ? () => { demanderVue('dorment'); onGo('vinted_annonces'); } : null}/>
      <AnalysesStatistiques panelOff={panelOff}/>

      {/* (3 nov.) « Boost rentable ? » : UNE carte, en tête de Statistiques (StatsVitrine). */}

      {/* Graphique du CA par date de vente (cliquable) */}
      {caHistoryVente.length>0&&(()=>{
        const maxCA=Math.max(...caHistoryVente.map(h=>h.ca),1);
        const sel=caHistoryVente.find(h=>h.key===selMonthVente);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>Évolution du CA par date de vente (12 derniers mois)</div>
            <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginBottom:14}}>Touche un point pour voir le détail des ventes du mois.</div>
            <CourbeMois mois={caHistoryVente.map(h=>({cle:h.key,long:h.nomComplet,ca:h.ca,n:h.ventes.length}))} valeur={(m)=>m.ca} format={(v)=>`${Math.round(v).toLocaleString('fr-FR')}\u00a0€`} choisi={selMonthVente} onChoisir={setSelMonthVente} attr="data-courbe-vente"/>
            {sel&&<MonthDetail mois={sel} type="vente" C={C} fmt={fmt} catMap={catMap} catalog={catalog} onClose={()=>setSelMonthVente(null)}/>}
          </Card>
        );
      })()}

      {/* Graphique : paires ajoutées par jour */}
      {ajoutsParJour.length>0&&(()=>{
        const maxAjout=Math.max(...ajoutsParJour.map(h=>h.count),1);
        const totalAjouts=ajoutsParJour.reduce((s,h)=>s+h.count,0);
        const moyenne=(totalAjouts/ajoutsParJour.length);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>Articles ajoutés par jour</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>
              {totalAjouts} article{totalAjouts>1?'s':''} sur {ajoutsParJour.length} jour{ajoutsParJour.length>1?'s':''} d'activité — moyenne {moyenne.toFixed(1)}/jour.
            </div>
            <div style={{display:'flex',alignItems:'flex-end',gap:4,height:150,paddingTop:10,overflowX:'auto'}}>
              {ajoutsParJour.map((h,i)=>{
                const pct=Math.round(h.count/maxAjout*100);
                return (
                  <div key={i} style={{flex:'1 0 auto',minWidth:22,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end'}}>
                    <div style={{fontSize:11,color:C.muted,fontWeight:500}}>{h.count}</div>
                    <div style={{width:'100%',maxWidth:30,height:`${pct}%`,minHeight:4,background:C.accent,borderRadius:'14px 14px 0 0',transition:'height .4s'}}/>
                    <div style={{fontSize:11,color:C.muted,fontWeight:600,whiteSpace:'nowrap'}}>{h.label}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Récap hebdomadaire */}
      {showWeekly&&weeklyRecapData.count>0&&(
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>Semaine dernière ({weeklyRecapData.from} → {weeklyRecapData.to})</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13}}>
                <span><b style={{color:C.text}}>{weeklyRecapData.count}</b> <span style={{color:C.muted}}>vente{weeklyRecapData.count>1?'s':''}</span></span>
                <span><b style={{color:C.accentTexte}}>{fmt(weeklyRecapData.ca)}</b> <span style={{color:C.muted}}>vendu</span></span>
                <span><b style={{color:C.accentTexte}}>{fmt(weeklyRecapData.profit)}</b> <span style={{color:C.muted}} data-benef-notion="brut">{NOM_BENEFICE_BRUT.toLowerCase()}</span></span>
              </div>
              {(()=>{ const pc=weeklyRecapData.prevCa||0, c=weeklyRecapData.ca; if(pc<=0&&c<=0) return null; const diff=c-pc; const pct=pc>0?Math.round(diff/pc*100):null; const up=diff>=0; return (
                <div style={{fontSize:11,color:up?C.accent:C.muted,fontWeight:600,marginTop:6}}>{up?'▲':'▼'} {up?'+':''}{fmt(diff)} vs semaine précédente{pct!=null?` (${up?'+':''}${pct}\u00a0%)`:''} <span style={{color:C.muted,fontWeight:600}}>— {fmt(pc)} vendus</span></div>
              ); })()}
            </div>
            <button className="vrm-icon-control" aria-label="Fermer le bilan de la semaine" type="button" onClick={()=>{localStorage.setItem('vinted_last_weekly_recap',isoWeek);setShowWeekly(false);}}
              style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,fontSize:15,lineHeight:1,padding:'2px 4px'}}><Icon name="close" size={15}/></button>
          </div>
        </Card>
      )}

      </RepliStats>
      {/* Récap mensuel */}
      {showMonthly&&monthlyRecapData.count>0&&(
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>Récap {monthlyRecapData.nom}</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13}}>
                <span><b style={{color:C.text}}>{monthlyRecapData.count}</b> <span style={{color:C.muted}}>vente{monthlyRecapData.count>1?'s':''}</span></span>
                <span><b style={{color:C.accentTexte}}>{fmt(monthlyRecapData.ca)}</b> <span style={{color:C.muted}}>vendu</span></span>
                <span><b style={{color:C.accentTexte}}>{fmt(monthlyRecapData.profit)}</b> <span style={{color:C.muted}} data-benef-notion="brut">{NOM_BENEFICE_BRUT.toLowerCase()}</span></span>
              </div>
            </div>
            <button className="vrm-icon-control" aria-label="Fermer le bilan du mois" type="button" onClick={()=>{localStorage.setItem('vinted_last_monthly_recap',monthKey);setShowMonthly(false);}}
              style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,fontSize:15,lineHeight:1,padding:'2px 4px'}}><Icon name="close" size={15}/></button>
          </div>
        </Card>
      )}

    </div>
  );
}
// ⟦← App.jsx #14⟧
// ── LES OFFRES, POUR STATISTIQUES (4 nov., src/statsOffres.js) ─────────────
// Trois lectures PROJETÉES (§4.4, jamais `select=data`), une fois par dix
// minutes, seulement quand la carte « Les offres » paraît à l'écran (les
// messages des conversations à offre pèsent ~1,2 Mo) :
//   · les conversations dont un message est une offre (`cs.`), côté vendeur ;
//   · la dernière lecture de CHAQUE compte (`capturedAt` de toutes ses
//     conversations : la capture s'est arrêtée — ce qui suit n'est pas lu) ;
//   · les transactions : prix conclu, `is_system`, nombre de paires, prix affiché.
// Une lecture ratée ⇒ `null` (« — »), jamais une liste vide.
let _offresCache = null;
const OFFRES_STATS_CONV = 'id=like.harvest_%25_conv_%25&data->payload->conversation->messages=cs.' + encodeURIComponent(JSON.stringify([{ entity_type: 'offer_request_message' }]))
  + '&data->payload->conversation->transaction->>current_user_side=eq.seller&select=id,opp:data->payload->conversation->opposite_user->>id,side:data->payload->conversation->transaction->>current_user_side,msgs:data->payload->conversation->messages';
const OFFRES_STATS_LECTURES = 'id=like.harvest_%25_conv_%25&select=id,cap:data->>capturedAt';
const OFFRES_STATS_TXN = 'id=like.harvest_%25_txn_%25&select=tx:meta->>id,sys:data->payload->transaction->offer->>is_system,op:data->payload->transaction->offer->price->>amount,oc:data->payload->transaction->offer->price->>currency_code,ic:data->payload->transaction->order->>item_count,ip:data->payload->transaction->order->items->0->price->>amount,icur:data->payload->transaction->order->items->0->price->>currency_code';
const lireOffresStats = async () => {
  const owner = AUTH.user?.id;
  if (!owner) return { convs: null, lectures: null, txn: null };
  if (_offresCache?.owner === owner && Date.now() - _offresCache.at < 10 * 60 * 1000) return _offresCache;
  const [rc, rl, rt] = await Promise.all([
    lireTout(OFFRES_STATS_CONV, { strict: true }).catch(() => null),
    lireTout(OFFRES_STATS_LECTURES, { strict: true }).catch(() => null),
    lireTout(OFFRES_STATS_TXN, { strict: true }).catch(() => null),
  ]);
  const uidDe = (id) => { const m = /^harvest_(\d+)_conv_\d+$/.exec(String(id || '')); return m ? m[1] : null; };
  const convs = Array.isArray(rc) && Array.isArray(rl) ? rc.map((r) => ({ compte: uidDe(r.id), side: r.side, opp: r.opp, messages: Array.isArray(r.msgs) ? r.msgs : [] })).filter((c) => c.compte) : null;
  let lectures = null;
  if (convs && Array.isArray(rl)) {
    lectures = {};
    for (const r of rl) { const u = uidDe(r.id); const t = Date.parse(r.cap || ''); if (u && Number.isFinite(t) && !(lectures[u] >= t)) lectures[u] = t; }
  }
  let txn = null;
  if (Array.isArray(rt)) { txn = {}; for (const r of rt) if (r && r.tx) txn[String(r.tx)] = { sys: r.sys, op: r.op, oc: r.oc, ic: r.ic, ip: r.ip, icur: r.icur }; }
  if (AUTH.user?.id !== owner) return { convs: null, lectures: null, txn: null };
  _offresCache = { owner, at: Date.now(), convs, lectures, txn };
  return _offresCache;
};
// ⟦← App.jsx #15⟧
const lireStatsStock = () => { try { const v = load('vrm_stats_stock', null); return v && v.dort && typeof v.dort === 'object' ? v : null; } catch (_) { return null; } };
// ⟦← App.jsx #16⟧
const eurStat = (v) => v == null ? '—' : fmt(v);
const pctStat = (v) => v == null ? '—' : `${v > 0 ? '+' : ''}${v}\u00a0%`;
const minuitLocalStats = (k = 0) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + k).getTime(); };
// Barres verticales, une série (une teinte), survol natif (<title>) sur une
// cible de toute la hauteur (plus large que la barre).
function BarresStats({ valeurs, titres, hauteur = 96, attenue = [], data }) {
  const n = valeurs.length, max = Math.max(1, ...valeurs.map((v) => Number(v) || 0));
  const W = 100 / n;
  return (
    <svg viewBox={`0 0 100 ${hauteur}`} preserveAspectRatio="none" role="img" style={{ width: '100%', height: hauteur, display: 'block' }} {...(data || {})}>
      <line x1="0" x2="100" y1={hauteur - 0.5} y2={hauteur - 0.5} stroke={C.border} strokeWidth="1" vectorEffect="non-scaling-stroke"/>
      {valeurs.map((v, i) => {
        const h = (Number(v) || 0) / max * (hauteur - 4);
        return (
          <g key={i}>
            <rect x={i * W} y={0} width={W} height={hauteur} fill="transparent"><title>{titres ? titres[i] : String(v)}</title></rect>
            {h > 0 && <rect x={i * W + W * 0.18} y={hauteur - h} width={W * 0.64} height={h} rx="0.8" fill={C.accent} opacity={attenue.includes(i) ? 0.45 : 1} pointerEvents="none"/>}
          </g>
        );
      })}
    </svg>
  );
}
function LegendeBarres({ libelles }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${libelles.length}, minmax(0,1fr))`, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{libelles.map((l, i) => <span key={i} style={{ overflow: 'visible', whiteSpace: 'nowrap' }}>{l}</span>)}</div>;
}
// ══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES — LA PAGE DE LA MAQUETTE (31 octobre, Julien : « applique ça »,
// puis « fais exactement cette mise en page »). Une période choisie (Semaine ·
// Mois · Année, `bornesPeriode`) gouverne TOUT ce bloc : 4 tuiles, « Vendu par
// semaine », « Ce qui part vite », « Par compte », « Par taille », « Boost
// rentable ? ». Aucune règle neuve sur l'argent ; chaque chiffre vient de son
// propriétaire (§11) :
//   · Vendu, Par compte, les barres : `liveStats.venduLignes` (`ventesFaites`,
//     la population de « Vendu » de Ma journée) — la somme des comptes = la tuile ;
//   · Bénéfice : `vrm_benefice_jours` (l'écran Ventes, la règle de « Ton
//     bénéfice ») — brut des seules ventes au prix d'achat connu, « au moins »
//     et « N sur M » dès qu'il en manque (§5) ;
//   · Délai, Ce qui part vite, Par taille : le relevé `vrm_stats_ventes` et la
//     date de mise en ligne de l'annonce reliée par SA transaction (Vinted) ;
//   · En ligne : `texteEnLigne` (la coque) et `vrm_stats_stock` (l'écran Annonces) ;
//   · Boost : `boostRentable` (src/boostRentable.js), annonces mises en ligne dans la période.
// « Pas su » s'écrit « — » avec la raison ; une seule couleur d'accent : la
// barre en cours et la taille la plus vendue (§7). Banc : stats-vitrine.
function useReleveStats() {
  const [releve, setReleve] = React.useState(lireReleveVentes);
  const [stock, setStock] = React.useState(lireStatsStock);
  const [benef, setBenef] = React.useState(lireBeneficeJours);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vrm_stats_ventes') setReleve(lireReleveVentes()); if (k === 'vrm_stats_stock') setStock(lireStatsStock()); if (k === 'vrm_benefice_jours') setBenef(lireBeneficeJours()); };
    window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f);
  }, []);
  const [extras, setExtras] = React.useState(undefined);
  React.useEffect(() => { let mort = false; lireExtrasRepartition().then((x) => { if (!mort) setExtras(x); }).catch(() => { if (!mort) setExtras({ txn: null, items: null, dates: null }); }); return () => { mort = true; }; }, []);
  const lignes = React.useMemo(() => {
    if (!releve) return null;
    const x = extras || {};
    return releve.l.map((r) => {
      const [plateforme, compte, id, ts, eur, achat, frais, titre] = r;
      const t = plateforme === 'Vinted' && x.txn && id ? x.txn[String(id)] : null;
      const it = t && t.item && x.items ? x.items[t.item] : null;
      return { plateforme, compte, id, ts, eur, achat, frais, titre, ...clesVenteStats(titre, it), marqueLue: String((it && it.brand) || '').trim(), modeleSur: modeleSur((it && it.brand) || '', titre), enLigne: it ? dateMiseEnLigneMs(it, x.dates || null) : null };
    });
  }, [releve, extras]);
  return { releve, stock, benef, extras, lignes };
}
const SITE_COURT = { Leboncoin: 'Leboncoin', eBay: 'eBay', Vestiaire: 'Vestiaire' };
// (9 nov.) Les axes de « Ce qui part vite » et la clé de groupe de chacun.
const AXES_VITE = { modele: 'Modèle', marque: 'Marque', taille: 'Taille', compte: 'Compte' };
const CLE_VITE = { modele: (l) => l.modele, marque: (l) => l.marqueLue, taille: (l) => l.taille, compte: (l) => l.compte };
// Le titre de la période : « Octobre · comparé à septembre ».
const titrePeriodeStats = (b) => {
  const maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (b.type === 'semaine') return `Semaine du ${new Date(b.de).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · comparée à la précédente`;
  if (b.type === 'annee') return `${new Date(b.de).getFullYear()} · comparée à ${new Date(b.prevDe).getFullYear()}`;
  return `${maj(new Date(b.de).toLocaleDateString('fr-FR', { month: 'long' }))} · comparé à ${new Date(b.prevDe).toLocaleDateString('fr-FR', { month: 'long' })}`;
};
// ── ANNULATIONS PAR COMPTE ET NOTES REÇUES (3 nov.) ─────────────────────────
// Deux cartes de Statistiques, sur les règles pures `annulationsParCompte`
// (src/annulationsCompte.js : « annulée » = `classifyOrderStatus`, la règle de
// `PAS_UNE_VENTE`, sur la période choisie) et `notesParCompte`
// (src/notesRecues.js : le profil Vinted capté, lecture seule, aucun rappel).
// Les comptes : ceux que la coque range sur l'appareil (`vinted_accounts`),
// moins les exclus (masqués, panneau, supprimés pour de bon) — un compte exclu
// n'apparaît nulle part.
const lireProfilsNotes = async () => {
  try {
    const sel = 'id,uid:data->>uid,at:data->>capturedAt,login:data->payload->user->>login,rep:data->payload->user->>feedback_reputation,n:data->payload->user->>feedback_count,pos:data->payload->user->>positive_feedback_count,neu:data->payload->user->>neutral_feedback_count,neg:data->payload->user->>negative_feedback_count';
    const [r, f] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_*_profile&select=${sel}`, { headers: sbAuth() }),
      // (À venir) la liste des avis, quand l'extension lira /api/v2/user_feedbacks :
      // tant que la ligne n'existe pas, la liste reste « pas encore lue ».
      // (10 nov., lot BN) la ligne est petite (20 avis sans personne, < 1 Ko) : projetée, jamais `select=data`.
      fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_*_feedbacks&data->>type=eq.feedbacks&select=id,avis:data->payload->user_feedbacks,pag:data->payload->pagination,hist:data->payload->historique`, { headers: sbAuth() }),
    ]);
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    const avis = {}, pags = {}, hists = {};
    try { if (f.ok) { const fj = await f.json(); if (Array.isArray(fj)) for (const x of fj) { const u = ((x && x.id) || '').match(/^harvest_(\d+)_feedbacks$/); if (u && Array.isArray(x.avis)) { avis[u[1]] = x.avis; pags[u[1]] = x.pag && typeof x.pag === 'object' ? x.pag : null; hists[u[1]] = Array.isArray(x.hist) ? x.hist : null; } } } } catch (_) {}
    return j.map((x) => {
      const uid = String((x && x.uid) || ((x && x.id) || '').match(/^harvest_(\d+)_profile$/)?.[1] || '');
      return { uid, at: x.at, login: x.login, rep: x.rep, n: x.n, pos: x.pos, neu: x.neu, neg: x.neg, avis: avis[uid], pag: pags[uid] || null, hist: hists[uid] || null };
    });
  } catch (_) { return null; }
};
// (5 nov., chantier F, revue 2.25) LA CARTE DE STATISTIQUES, ET SA FORME REPLIÉE.
// Un corps « vide » (`videStatsVitrine` : lecture en cours, pas su, rien sur la
// période) ne prend plus une carte entière : une ligne, le titre et la raison
// (`data-sv-repliee`). Le texte reste celui que l'écran disait déjà.
const videStatsVitrine = (txt, attrs) => <div className="vrm-sv-vide" data-sv-vide-carte="" {...(attrs || {})}>{txt}</div>;
const estVideStats = (corps) => !!(corps && corps.props && Object.prototype.hasOwnProperty.call(corps.props, 'data-sv-vide-carte'));
function CarteStatsVitrine({ k, titre, droite, corps, attrs, cls }) {
  if (estVideStats(corps)) {
    const raison = corps.props.children;
    return (
      <section className={`vrm-sv-carte vrm-sv-repliee${cls ? ' ' + cls : ''}`} data-stats-carte={k} data-sv-repliee="" {...(attrs || {})}>
        <h2 className="vrm-sv-repliee-titre">{titre}</h2>
        <span className="vrm-sv-repliee-raison" {...Object.fromEntries(Object.entries(corps.props).filter(([a]) => a.startsWith('data-') && a !== 'data-sv-vide-carte'))}>{raison === '…' ? 'Lecture en cours…' : raison}</span>
      </section>
    );
  }
  return (
    <section className={`vrm-sv-carte${cls ? ' ' + cls : ''}`} data-stats-carte={k} {...(attrs || {})}>
      <div className="vrm-sv-carte-tete"><h2 className="vrm-display vrm-sv-carte-titre">{titre}</h2>{droite ? <span className="vrm-sv-note">{droite}</span> : null}</div>
      {corps}
    </section>
  );
}
function AnnulationsEtNotes({ b, panelOff }) {
  const { ventes, ko } = useVentesCoque();
  const [profils, setProfils] = React.useState(undefined);
  React.useEffect(() => { let mort = false; lireProfilsNotes().then((x) => { if (!mort) setProfils(x); }); return () => { mort = true; }; }, []);
  const ecarteUid = useCompteEcarte(panelOff);   // (6 nov.) suit le nuage et « Masquer » (vague 3, point X)
  const comptes = React.useMemo(() => {
    let lies = [];
    try { const a = JSON.parse(localStorage.getItem('vinted_accounts') || 'null'); if (Array.isArray(a)) lies = a; } catch (_) {}
    const out = new Map();
    for (const a of lies) { const u = String((a && a.vinted_user_id) || ''); if (u && !ecarteUid(u)) out.set(u, { uid: u, nom: a.login || u }); }
    if (!out.size) for (const p of (profils || [])) if (p && p.uid && !ecarteUid(p.uid)) out.set(p.uid, { uid: p.uid, nom: p.login || p.uid });
    return [...out.values()];
    // `ventes` : la coque publie ses ventes APRÈS avoir rangé la liste des comptes
    // (`vinted_accounts`, sans événement) — relue à ce moment-là.
  }, [profils, ecarteUid, ventes]); // eslint-disable-line react-hooks/exhaustive-deps
  const nomDe = (u) => (comptes.find((c) => c.uid === String(u)) || {}).nom || 'un compte';
  const A = React.useMemo(() => annulationsParCompte({ ventes, ko, de: b.de, a: b.a, estAnnulee: (o) => classifyOrderStatus(o.status) === 'cancelled', ecarte: ecarteUid }), [ventes, ko, b, ecarteUid]);
  const N = React.useMemo(() => notesParCompte({ profils, comptes }), [profils, comptes]);
  const pl = (n, s1, p) => `${n} ${n > 1 ? (p || s1 + 's') : s1}`;
  const pctTxt = (t) => (t == null ? '—' : `${String(t).replace('.', ',')}\u00a0%`);
  const note = (x) => (x == null ? '—' : String(x).replace('.', ','));
  const jour = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const carte = (k, titre, droite, corps, attrs) => <CarteStatsVitrine k={k} titre={titre} droite={droite} corps={corps} attrs={attrs}/>;
  const vide = videStatsVitrine;
  const maxT = A.etat === 'lu' ? Math.max(1, ...A.comptes.map((g) => g.taux || 0)) : 1;
  // (5 nov., chantier F, revue 2.25) « Annulations » se dit UNE fois : le total d'en-tête
  // n'apparaît que s'il additionne PLUSIEURS comptes (avec un seul, il redisait la ligne).
  const annul = carte('sv-annulations', 'Annulations',
    A.etat === 'lu' && A.n && A.comptes.length > 1 ? <span data-sv-annul-total={`${A.annulees}/${A.n}`}>{A.annulees} sur {A.n}{A.partiel ? '' : ` · ${pctTxt(A.taux)}`}</span> : null,
    A.etat === 'encours' ? vide('…', { 'data-sv-annul': 'encours' })
      : A.etat !== 'lu' ? vide('Tes ventes Vinted n’ont pas pu être lues.', { 'data-sv-annul': 'passu' })
        : !A.comptes.length ? vide('Aucune vente Vinted sur la période.', { 'data-sv-annul': 'lu' })
        : (<div className="vrm-sv-lignes" data-sv-annul="lu">
          {A.comptes.map((g) => (
            <details key={g.cle} className="vrm-sv-annul-compte" data-sv-annul-compte={g.uid} data-n={g.n} data-annulees={g.annulees} data-taux={g.taux == null ? '' : g.taux}>
              <summary className="vrm-sv-annul-ligne">
                <span className="vrm-sv-nom">{g.compte}</span>
                <span className="vrm-sv-piste"><span style={{ width: `${g.taux ? Math.max(3, g.taux / maxT * 100) : 0}%` }}/></span>
                <span className="vrm-sv-chiffre">{g.annulees}/{g.n} · {pctTxt(g.taux)}</span>
              </summary>
              {g.liste.length ? g.liste.map((x) => (
                <a key={x.id} className="vrm-sv-annul-vente" data-sv-annul-vente={x.id} href={x.lien || undefined} target="_blank" rel="noreferrer">
                  <span className="vrm-sv-annul-titre">{x.titre || `Vente ${x.id}`}</span>
                  <span className="vrm-sv-chiffre">{jour(x.ts)}{x.eur != null ? ` · ${fmt(x.eur)}` : ''}</span>
                  <span className="vrm-sv-annul-etat">{x.statut}</span>
                </a>
              )) : <div className="vrm-sv-note" style={{ padding: '4px 0 8px' }}>Aucune annulation.</div>}
            </details>
          ))}
          {(A.manquants.length > 0 || A.sansDate > 0) && <div className="vrm-sv-note" data-sv-annul-manque={A.manquants.join(',')} style={{ marginTop: 8 }}>
            {A.manquants.length ? `${A.manquants.map(nomDe).join(', ')} : pas lu` : ''}{A.manquants.length && A.sansDate ? ' · ' : ''}{A.sansDate ? `${pl(A.sansDate, 'vente')} sans date` : ''}
          </div>}
          <div className="vrm-sv-note" data-sv-annul-non-couvertes={A.nonCouvertes.join(',')} style={{ marginTop: 4 }}>{A.nonCouvertes.join(', ')} : pas comptés</div>
        </div>),
    { 'data-sv-carte': 'annulations', 'data-sv-etat': A.etat });
  // (5 nov., chantier F) Aucun compte lu : une ligne repliée, pas une liste de « pas lu — ».
  const aucuneNoteLue = N.etat !== 'encours' && N.etat !== 'passu' && Array.isArray(N.comptes) && !N.comptes.some((c) => c.etat === 'lu');
  const notes = carte('sv-notes', 'Notes reçues',
    N.etat === 'lu' && N.moyenne != null && N.comptes.length > 1 ? <span data-sv-notes-moyenne={N.moyenne} data-sv-notes-total={N.total}>{N.partiel ? 'au moins ' : ''}{pl(N.total, 'avis', 'avis')} · {note(N.moyenne)}/5</span> : null,
    N.etat === 'encours' ? vide('…', { 'data-sv-notes': 'encours' })
      : N.etat === 'passu' ? vide('Tes profils Vinted n’ont pas pu être lus.', { 'data-sv-notes': 'passu' })
        : aucuneNoteLue ? vide('Pas encore lues : elles arrivent à ta prochaine visite sur Vinted.', { 'data-sv-notes': N.etat, 'data-sv-notes-aucune': '' })
        : (<div className="vrm-sv-lignes" data-sv-notes={N.etat}>
          {N.comptes.map((c) => (
            <div key={c.uid} className="vrm-sv-note-ligne" data-sv-notes-compte={c.uid} data-etat={c.etat} data-note={c.note == null ? '' : c.note} data-n={c.n == null ? '' : c.n} data-neg={c.neg == null ? '' : c.neg} data-vieux={c.vieux ? '1' : ''}>
              <span className="vrm-sv-nom">{c.nom}</span>
              <span className="vrm-sv-chiffre vrm-sv-note-detail">{c.etat !== 'lu' ? 'pas lu' : <>{pl(c.n, 'avis', 'avis')}{c.neg > 0 ? ` · ${c.neg} négatif${c.neg > 1 ? 's' : ''}` : ''}{c.neu > 0 ? ` · ${c.neu} neutre${c.neu > 1 ? 's' : ''}` : ''}{c.vieux && c.at ? ` · lu le ${jour(c.at)}` : ''}</>}</span>
              <span className="vrm-display vrm-sv-note-val">{c.etat !== 'lu' ? '—' : note(c.note)}</span>
            </div>
          ))}
          {/* (10 nov., lot BN) les avis LUS : moyenne, évolution, les 5 derniers (src/AvisVinted.jsx). */}
          <AvisLus comptes={N.comptes}/>
        </div>),
    { 'data-sv-carte': 'notes', 'data-sv-etat': N.etat });
  return <div className="vrm-sv-rangee vrm-sv-rangee-2" data-sv-annul-notes="">{annul}{notes}</div>;
}
// ── PAR CATÉGORIE (11 nov., lot stats-categories, src/statsCategories.js) ────
// La catégorie vient de Vinted (catalog_id de l'annonce, reliée par SA
// transaction) ou de SON choix ; jamais du titre. Le catalogue de Vinted
// (~550 Ko) n'est lu que si la carte paraît et que sa VERSION (`data->>at`,
// un scalaire) a changé : la table { catalog_id: famille } est gardée sur
// l'appareil (`vrm_cat_familles`, quelques Ko). Catalogue illisible et aucune
// table gardée ⇒ les catégories Vinted sont « pas sues » (rien de deviné).
const CLE_TABLE_FAMILLES = 'vrm_cat_familles';
let _tableFamillesEnVol = null;
const lireTableFamilles = () => {
  if (_tableFamillesEnVol) return _tableFamillesEnVol;
  _tableFamillesEnVol = (async () => {
    let garde = null;
    try { const g = JSON.parse(localStorage.getItem(CLE_TABLE_FAMILLES) || 'null'); if (g && g.table && typeof g.table === 'object') garde = g; } catch (_) {}
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vinted_catalogue&select=at:data->>at`, { headers: sbAuth() });
      const j = r.ok ? await r.json() : null;
      if (!Array.isArray(j)) return garde ? garde.table : null;
      const at = j[0] && j[0].at ? String(j[0].at) : '';
      if (!at) return garde ? garde.table : {};   // aucun catalogue rangé : aucune catégorie Vinted traduisible
      if (garde && garde.at === at) return garde.table;
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vinted_catalogue&select=c:data->>corps`, { headers: sbAuth() });
      const j2 = r2.ok ? await r2.json() : null;
      const c = Array.isArray(j2) && j2[0] && j2[0].c;
      const table = c ? tableFamilles(JSON.parse(c)) : null;
      if (!table) return garde ? garde.table : null;
      try { localStorage.setItem(CLE_TABLE_FAMILLES, JSON.stringify({ at, table })); } catch (_) {}
      return table;
    } catch (_) { return garde ? garde.table : null; }
    finally { setTimeout(() => { _tableFamillesEnVol = null; }, 60000); }
  })();
  return _tableFamillesEnVol;
};
// La catégorie lue sur la PAGE de l'annonce (`vinted_item_details[id].catalogId`),
// pour les annonces dont le dressing ne la porte pas (mesuré le 5 nov. : un
// dressing non allégé envoie `catalog_id: null`). Projetée clé par clé, un
// scalaire par annonce (§4.4) ; un lot raté ⇒ null (« pas su »).
const lireCategoriesFiches = async (ids) => {
  const uniq = [...new Set((ids || []).map((x) => String(x == null ? '' : x)).filter((x) => /^\d+$/.test(x)))];
  if (!uniq.length) return {};
  const lots = []; for (let i = 0; i < uniq.length; i += 80) lots.push(uniq.slice(i, i + 80));
  try {
    const res = await Promise.all(lots.map(async (l) => {
      const sel = l.map((id, i) => `f${i}:data->${encodeURIComponent('"' + id + '"')}->>catalogId`).join(',');
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vinted_item_details&select=${sel}`, { headers: sbAuth() });
      if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? j : null;
    }));
    if (res.some((x) => !x)) return null;
    const out = {};
    res.forEach((rows, k) => { const ligne = rows[0]; if (!ligne) return; lots[k].forEach((id, i) => { const v = ligne['f' + i]; if (v != null && String(v).trim() && String(v) !== '0') out[id] = String(v); }); });
    return out;
  } catch (_) { return null; }
};
const lireCategoriesMain = () => { try { const v = load(CLE_CATEGORIES_MAIN, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (_) { return {}; } };
function ParCategorie({ vendu, lp, extras, stock, b }) {
  const ref = React.useRef(null);
  const [table, setTable] = React.useState(undefined);
  const [fiches, setFiches] = React.useState(undefined);
  const [main] = useLigneSynchro(CLE_CATEGORIES_MAIN, lireCategoriesMain);
  const [ouvert, setOuvert] = React.useState(false);
  React.useEffect(() => {
    let mort = false;
    const go = () => { lireTableFamilles().then((t) => { if (!mort) setTable(t); }).catch(() => { if (!mort) setTable(null); }); };
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { go(); return () => { mort = true; }; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => { mort = true; io.disconnect(); };
  }, []);
  // L'annonce de chaque vente Vinted de la période, par SA transaction.
  const itemDe = React.useCallback((tx) => { const t = extras && extras.txn ? extras.txn[String(tx)] : null; return t && t.item ? String(t.item) : ''; }, [extras]);
  const manquent = React.useMemo(() => {
    if (!Array.isArray(vendu) || !extras) return [];
    const out = [];
    for (const l of vendu) if (l && l.plateforme === 'Vinted') { const id = itemDe(l.tx); const it = id && extras.items ? extras.items[id] : null; if (id && !(it && it.cat)) out.push(id); }
    return out.sort();
  }, [vendu, extras, itemDe]);
  const cleManquent = manquent.join(',');
  React.useEffect(() => {
    if (table === undefined) return undefined;
    let mort = false;
    lireCategoriesFiches(manquent).then((f) => { if (!mort) setFiches(f); });
    return () => { mort = true; };
  }, [cleManquent, table]); // eslint-disable-line react-hooks/exhaustive-deps
  const famDe = React.useCallback((plat, id) => {
    let cat = null;
    if (plat === 'Vinted') { const it = itemDe(id); const x = it && extras && extras.items ? extras.items[it] : null; cat = (x && x.cat) || (it && fiches ? fiches[it] : null) || null; }
    return familleDeVente({ catalogId: cat, table, main, cle: cleVente(plat, id) });
  }, [itemDe, extras, fiches, table, main]);
  const pret = table !== undefined && fiches !== undefined && extras !== undefined;
  const S = React.useMemo(() => {
    if (!pret || !Array.isArray(vendu)) return null;
    const stk = stockParFamille(stock && stock.parCatalogue, table);
    return statsParCategorie({ vendu, releve: lp, famDe, stock: stk });
  }, [pret, vendu, lp, famDe, stock, table]);
  const jeVends = React.useMemo(() => { try { return lireReglageJeVends(load(CLE_JE_VENDS, null)).choix; } catch (_) { return 'auto'; } }, []);
  const montre = afficherCategories(S, jeVends);
  // Le titre d'une vente sans catégorie : celui du relevé (sa vente) ou de son annonce Vinted.
  const titres = React.useMemo(() => {
    const t = {};
    for (const l of (lp || [])) { const k = cleVente(l.plateforme, l.id); if (k && l.titre) t[k] = l.titre; }
    if (extras && extras.items) for (const l of (vendu || [])) if (l && l.plateforme === 'Vinted') { const k = cleVente('Vinted', l.tx); const it = extras.items[itemDe(l.tx)]; if (k && !t[k] && it && it.title) t[k] = it.title; }
    return t;
  }, [lp, vendu, extras, itemDe]);
  const pl = (n, s1, p) => `${n} ${n > 1 ? (p || s1 + 's') : s1}`;
  const jTxt = (j) => (j < 1 ? '< 1 j' : `${String(Math.round(j * 10) / 10).replace('.', ',')} j`);
  // Pas montré : un repère d'un pixel (un `hidden` ne serait jamais « vu » par l'observateur).
  if (!montre) return <div ref={ref} data-sv-categories-cache={S ? 'une' : 'attente'} aria-hidden="true" style={{ height: 1 }}/>;
  const maxN = Math.max(1, ...S.groupes.map((g) => g.n));
  return (
    <div ref={ref}>
      <CarteStatsVitrine k="sv-categories" titre="Par catégorie" droite="ventes · vendu" attrs={{ 'data-sv-carte': 'categories', 'data-sv-etat': 'lu' }} corps={(
        <div className="vrm-sv-lignes vrm-sv-cats" data-sv-etat="lu">
          {S.groupes.map((g) => (
            <div key={g.v} className="vrm-sv-ligne-cat" data-sv-cat={g.v} data-n={g.n} data-eur={Math.round(g.eur * 100)} data-brut={g.brut == null ? '' : Math.round(g.brut * 100)} data-couv={`${g.nCout}/${g.fin}`} data-mediane={g.mediane == null ? '' : g.mediane} data-stock={g.stock == null ? '' : g.stock}>
              <span className="vrm-sv-nom">{g.titre}</span>
              <span className="vrm-sv-piste"><span style={{ width: g.n ? `${Math.max(3, g.n / maxN * 100)}%` : 0 }}/></span>
              <span className="vrm-sv-chiffre vrm-sv-cat-chiffre">{g.n ? `${pl(g.n, 'vente')} · ${fmt(g.eur)}` : 'aucune vente'}</span>
              <span className="vrm-sv-cat-detail">
                {g.fin > 0 && <span data-benef-notion="brut" title={`${NOM_BENEFICE_BRUT} : ventes finalisées au prix d’achat connu`}>brut {g.brut == null ? '—' : fmt(g.brut)}{g.nCout < g.fin ? ` · ${pl(g.fin - g.nCout, 'sans prix d’achat', 'sans prix d’achat')}` : ''}</span>}
                {g.mediane != null && <span title={`délai médian, sur ${pl(g.nDelai, 'vente datée', 'ventes datées')}`}>{jTxt(g.mediane)} pour vendre</span>}
                {g.stock != null && <span>{g.stock} en ligne</span>}
              </span>
            </div>
          ))}
          {S.sans.n > 0 && (
            <div className="vrm-sv-cat-sans" data-sv-cat-sans={S.sans.n}>
              <span>Sans catégorie ({S.sans.n}) · {fmt(S.sans.eur)}</span>
              <Bouton variante="discret" data-sv-cat-poser="" onClick={() => setOuvert(true)}>Poser la catégorie</Bouton>
            </div>
          )}
          {S.stockSans > 0 && <div className="vrm-sv-note" data-sv-cat-stock-sans={S.stockSans}>{pl(S.stockSans, 'annonce en ligne', 'annonces en ligne')} sans catégorie lue.</div>}
        </div>
      )}/>
      {ouvert && <PoserCategories cles={S.sans.cles} titres={titres} vendu={vendu} main={main} onClose={() => setOuvert(false)}/>}
    </div>
  );
}
// La feuille « Poser la catégorie » : les ventes sans catégorie de la période,
// cochées puis rangées d'UN toucher. SON clic écrit, par l'identifiant de la vente.
function PoserCategories({ cles, titres, vendu, main, onClose }) {
  const [coche, setCoche] = React.useState(() => new Set());
  const [fait, setFait] = React.useState(0);
  const parCle = React.useMemo(() => { const m = {}; for (const l of (vendu || [])) { const k = l && cleVente(l.plateforme, l.tx); if (k) m[k] = l; } return m; }, [vendu]);
  const restent = cles.filter((k) => !(main && main[k]));
  const tous = restent.length > 0 && restent.every((k) => coche.has(k));
  const basculer = (k) => setCoche((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const ranger = (f) => {
    const choisies = restent.filter((k) => coche.has(k));
    if (!choisies.length) return;
    save(CLE_CATEGORIES_MAIN, ecritureCategoriesMain(lireCategoriesMain(), choisies, f, [], Date.now()));
    setFait((x) => x + choisies.length); setCoche(new Set());
  };
  const date = (ts) => (ts ? new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '');
  return (
    <SheetShell onClose={onClose} titre="Poser la catégorie" sousTitre="Coche des ventes, puis choisis." maxWidth={560} data-feuille-categories="">
      <div className="vrm-cat-feuille">
        {restent.length === 0
          ? <p className="vrm-cat-fini" data-cat-fini={fait}>Tout est rangé.</p>
          : <>
            {restent.length > 1 && <label className="vrm-cat-ligne vrm-cat-tout"><input type="checkbox" checked={tous} onChange={() => setCoche(tous ? new Set() : new Set(restent))}/> <span>Tout cocher ({restent.length})</span></label>}
            <div className="vrm-cat-liste">
              {restent.map((k) => { const l = parCle[k] || {}; return (
                <label key={k} className="vrm-cat-ligne" data-cat-vente={k}>
                  <input type="checkbox" checked={coche.has(k)} onChange={() => basculer(k)}/>
                  <span className="vrm-cat-titre">{titres[k] || `Vente ${l.plateforme || ''}`.trim()}</span>
                  <span className="vrm-cat-info">{[l.plateforme !== 'Vinted' ? l.plateforme : '', date(l.ts), l.eur != null ? fmt(l.eur) : ''].filter(Boolean).join(' · ')}</span>
                </label>); })}
            </div>
            <div className="vrm-cat-choix" data-cat-cochees={coche.size}>
              <span className="vrm-cat-choix-lib">{coche.size ? `Ranger ${coche.size} dans :` : 'Coche au moins une vente.'}</span>
              <div className="vrm-cat-puces">
                {FAMILLES_STATS.map((f) => <Bouton key={f.v} variante="discret" data-cat-choix={f.v} disabled={!coche.size} onClick={() => ranger(f.v)}>{f.titre}</Bouton>)}
              </div>
            </div>
          </>}
      </div>
    </SheetShell>
  );
}
// ═══════════════════════════════════════════════════════════════════════════
// (11 nov., lot stats-plus) PLUS DE CHIFFRES — Julien : « il n'y en a pas assez
// à mon goût ». Quatre blocs neufs, chacun avec sa période et sa couverture ;
// les règles sont celles de src/statsPlus.js (qui assemble les propriétaires).
// ═══════════════════════════════════════════════════════════════════════════
const plSP = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
const ecartTxt = (e, nomPrec) => (e == null ? '' : `${e > 0 ? '+' : e < 0 ? '−' : '±'}${Math.abs(e)} % par rapport à ${nomPrec}`);
const RAISON_RECU = { absente: 'le reçu se calcule dans Ventes (ouvre-le une fois)', ancienne: 'calcul du reçu trop ancien : rouvre Ventes', 'ancienne-app': 'calcul du reçu trop ancien : rouvre Ventes', illisible: 'le reçu n’a pas pu être lu', encours: 'je lis le reçu…', partiel: 'reçu pas tout lu' };
// Le graphique « Vendu et reçu » : deux barres par période, sans bibliothèque (SVG).
// Chaque groupe est un BOUTON : toucher ou tabuler écrit ses deux valeurs au-dessus.
function GraphiqueVenduRecu({ VR, lib, titre }) {
  const [choisi, setChoisi] = React.useState(null);
  const lues = VR.barres.filter((x) => !x.avenir);
  const enCours = VR.barres.findIndex((x) => x.enCours);
  const i0 = choisi != null ? choisi : (enCours >= 0 ? enCours : VR.barres.length - 1);
  const x0 = VR.barres[i0];
  const max = Math.max(1, ...lues.map((x) => Math.max(x.vendu || 0, x.recu || 0)));
  const H = 150;
  const val = (v, partiel) => (v == null ? '—' : `${partiel ? 'au moins ' : ''}${fmt(v)}`);
  return (
    <div className="vrm-sp-vr" data-sp-vr={VR.barres.map((x) => `${x.vendu == null ? '' : Math.round(x.vendu * 100)}:${x.recu == null ? '' : Math.round(x.recu * 100)}`).join(',')}>
      <div className="vrm-sp-vr-lu" aria-live="polite" data-sp-vr-choisi={i0}>
        <span className="vrm-sp-vr-quand">{x0 ? lib(x0) : ''}{x0 && x0.enCours ? ' (en cours)' : ''}</span>
        <span className="vrm-sp-cle vrm-sp-cle-vendu">Vendu <b>{x0 && !x0.avenir ? val(x0.vendu, false) : '—'}</b></span>
        <span className="vrm-sp-cle vrm-sp-cle-recu">Reçu <b>{x0 && !x0.avenir ? val(x0.recu, x0.recuPartiel) : '—'}</b></span>
      </div>
      <div className="vrm-sp-vr-barres" role="group" aria-label={titre}>
        {VR.barres.map((x, i) => {
          const h = (v) => (v == null || !(v > 0) ? 0 : Math.max(2, v / max * 100));
          const aria = `${lib(x)} : ${x.avenir ? 'pas encore commencé' : `vendu ${val(x.vendu, false)}, reçu ${val(x.recu, x.recuPartiel)}`}`;
          return (
            <button key={i} type="button" className="vrm-sp-vr-col" aria-label={aria} aria-pressed={i === i0} data-sp-vr-col={i}
              onClick={() => setChoisi(i)} onFocus={() => setChoisi(i)} onPointerEnter={(e) => { if (e.pointerType === 'mouse') setChoisi(i); }}>
              <span className="vrm-sp-vr-zone" style={{ height: H }} aria-hidden="true">
                {!x.avenir ? <span className="vrm-sp-vr-b is-vendu" style={{ height: `${h(x.vendu)}%` }}/> : null}
                {!x.avenir ? <span className={'vrm-sp-vr-b is-recu' + (x.recu == null ? ' is-passu' : '')} style={{ height: x.recu == null ? '100%' : `${h(x.recu)}%` }}/> : null}
              </span>
              <span className="vrm-sp-vr-lib" aria-hidden="true">{lib(x)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
// ── (11 nov., ajout de Julien) MES RECORDS ──────────────────────────────────
// Chaque record se touche : une feuille dit d'où il vient (le mois ou la semaine : ses
// ventes ; la vente : son détail) et mène à l'écran Ventes. Rien n'est rangé : recalculé.
const MOIS_LONGS_SP = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const nomMoisSP = (ym) => { const [y, m] = String(ym).split('-').map(Number); return `${MOIS_LONGS_SP[m - 1]} ${y}`; };
const dateSP = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const delaiSP = (r) => (r.heures < 24 ? `${Math.max(1, r.heures)} h` : `${String(r.jours).replace('.', ',')} j`);
function MesRecords({ vendu, releve, partiel, onGo }) {
  const R = React.useMemo(() => recordsDe({ vendu, releve, partiel }), [vendu, releve, partiel]);
  const [ouvert, setOuvert] = React.useState(null);
  const ligne = (k, lib, x, val, sous, attrs) => {
    const vide = x === undefined ? 'je lis…' : x === null ? 'pas pu être lu' : null;
    const corps = (
      <>
        <span className="vrm-sp-rec-lib">{lib}</span>
        <span className="vrm-display vrm-sp-rec-val" data-vide={vide || (x && x.pasAssez) ? '1' : undefined}>{vide || (x && x.pasAssez) ? '—' : val}</span>
        <span className="vrm-sp-rec-sous">{vide || sous}</span>
      </>
    );
    return x && !x.pasAssez
      ? <button key={k} type="button" className="vrm-sp-rec" data-sp-record={k} {...attrs} onClick={() => setOuvert(k)} aria-label={`${lib} : ${typeof val === 'string' ? val : ''} — voir le détail`}>{corps}<span className="vrm-sp-rec-chev" aria-hidden="true">›</span></button>
      : <div key={k} className="vrm-sp-rec" data-sp-record={k} data-sp-record-etat={x === undefined ? 'encours' : x === null ? 'passu' : 'pas-assez'}>{corps}</div>;
  };
  const lu = partiel ? ' · parmi les ventes lues' : '';
  const M = R.mois, S = R.semaine, V = R.vente, Q = R.rapide;
  const lignesDe = (de, a) => (Array.isArray(vendu) ? vendu.filter((l) => l && Number(l.ts) >= de && Number(l.ts) < a && connuSP(l.eur)).sort((x, y) => Number(y.eur) - Number(x.eur)) : []);
  const bornesMois = (ym) => { const [y, m] = ym.split('-').map(Number); return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()]; };
  const feuille = () => {
    if (!ouvert) return null;
    const fermer = () => setOuvert(null);
    let titre = '', sous = '', corps = null;
    if (ouvert === 'mois' || ouvert === 'semaine') {
      const [de, a] = ouvert === 'mois' ? bornesMois(M.k) : [S.de, S.a];
      titre = ouvert === 'mois' ? `Meilleur mois · ${nomMoisSP(M.k)}` : `Meilleure semaine · du ${new Date(de).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
      const L = lignesDe(de, a);
      sous = `${fmt((ouvert === 'mois' ? M : S).eur)} · ${plSP(L.length, 'vente')}`;
      corps = (
        <ol className="vrm-sp-top" data-sp-record-ventes={L.length}>
          {L.slice(0, 60).map((l, i) => (
            <li key={`${l.tx || ''}-${i}`} className="vrm-sp-top-ligne">
              <span className="vrm-sp-top-rang" aria-hidden="true">{i + 1}</span>
              <span className="vrm-sp-top-nom"><span>{new Date(Number(l.ts)).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span><small>{l.plateforme === 'Vinted' && l.compte ? l.compte : l.plateforme}</small></span>
              <span className="vrm-sv-chiffre vrm-sp-top-brut">{fmt(Number(l.eur))}</span>
            </li>
          ))}
          {L.length > 60 ? <li className="vrm-sv-note vrm-sp-top-note">+ {plSP(L.length - 60, 'autre vente')}</li> : null}
        </ol>
      );
    } else {
      const x = ouvert === 'vente' ? V : Q;
      titre = ouvert === 'vente' ? 'Meilleure vente' : 'Vente la plus rapide';
      sous = x.titre || 'Sans titre';
      corps = (
        <dl className="vrm-sp-rec-detail" data-sp-record-detail={ouvert}>
          <div><dt>Vendue le</dt><dd>{dateSP(x.ts)}</dd></div>
          <div><dt>Où</dt><dd>{x.plateforme === 'Vinted' && x.compte ? `Vinted · ${x.compte}` : x.plateforme}</dd></div>
          <div><dt>Prix de vente</dt><dd>{fmt(x.eur)}</dd></div>
          {ouvert === 'vente' ? <><div><dt>Prix d’achat</dt><dd>{fmt(x.achat)}</dd></div><div><dt>{NOM_BENEFICE_BRUT}</dt><dd>{fmt(x.brut)}</dd></div></>
            : <><div><dt>Mise en ligne</dt><dd>{dateSP(x.enLigne)}</dd></div><div><dt>Partie en</dt><dd>{delaiSP(x)}</dd></div></>}
          {x.id ? <div><dt>N° de transaction</dt><dd>{String(x.id).replace(/^(lbc|ebay):/, '')}</dd></div> : null}
        </dl>
      );
    }
    return (
      <SheetShell titre={titre} sousTitre={sous} onClose={fermer} z={20000} maxWidth={560} className="vrm-sp-rec-feuille" data-noswipe="" data-sp-record-feuille={ouvert}>
        <div className="vrm-sp-rec-feuille-corps">
          {corps}
          {onGo ? <button type="button" className="vrm-lien-action vrm-sp-rec-aller" data-sp-record-aller="" onClick={() => { fermer(); onGo('cat_ventes'); }}>Voir mes ventes <span aria-hidden="true">›</span></button> : null}
        </div>
      </SheetShell>
    );
  };
  return (
    <>
      <div className="vrm-sp-records" data-sp-records="">
        {ligne('mois', 'Meilleur mois', M, M && !M.pasAssez ? fmt(M.eur) : '', M && !M.pasAssez ? `${nomMoisSP(M.k)} · ${plSP(M.n, 'vente')}${lu}` : M ? `pas assez de données (${plSP(M.nGroupes, 'mois', 'mois')} de ventes)` : '', M && !M.pasAssez ? { 'data-sp-record-k': M.k, 'data-sp-record-v': String(Math.round(M.eur * 100)) } : {})}
        {ligne('semaine', 'Meilleure semaine', S, S && !S.pasAssez ? fmt(S.eur) : '', S && !S.pasAssez ? `du ${new Date(S.de).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${plSP(S.n, 'vente')}${lu}` : S ? 'pas assez de données' : '', S && !S.pasAssez ? { 'data-sp-record-v': String(Math.round(S.eur * 100)) } : {})}
        {ligne('vente', 'Meilleure vente', V, V && !V.pasAssez ? `+${fmt(V.brut)}` : '', V && !V.pasAssez ? `${V.titre || 'Sans titre'} · parmi les ventes au prix d’achat connu (${V.nCout} sur ${V.n})` : V ? `pas assez de données · prix d’achat connu ${V.nCout} sur ${V.n}` : '', V && !V.pasAssez ? { 'data-sp-record-v': String(Math.round(V.brut * 100)), 'data-sp-record-couv': `${V.nCout}/${V.n}` } : {})}
        {ligne('rapide', 'Vente la plus rapide', Q, Q && !Q.pasAssez ? delaiSP(Q) : '', Q && !Q.pasAssez ? `${Q.titre || 'Sans titre'} · parmi ${plSP(Q.nDelai, 'vente Vinted datée', 'ventes Vinted datées')}` : Q ? 'pas assez de ventes Vinted à la date de mise en ligne connue' : '', Q && !Q.pasAssez ? { 'data-sp-record-h': String(Q.heures) } : {})}
      </div>
      {feuille()}
    </>
  );
}
const connuSP = (v) => v != null && String(v).trim() !== '' && isFinite(Number(v));

// ── (11 nov., ajout de Julien) COMPARER DEUX COMPTES ────────────────────────
const CLE_COMPARER_COMPTES = 'vrm_sp_comparer_comptes';   // commodité de CET appareil (protégée)
function ComparerComptes({ comptes, brutComptes, enLigneDe }) {
  const [choix, setChoixEtat] = React.useState(() => { try { const v = JSON.parse(localStorage.getItem(CLE_COMPARER_COMPTES) || 'null'); return Array.isArray(v) ? v : []; } catch (_) { return []; } });
  const setChoix = (v) => { setChoixEtat(v); try { localStorage.setItem(CLE_COMPARER_COMPTES, JSON.stringify(v)); } catch (_) {} };
  if (!Array.isArray(comptes) || comptes.length < 2) return null;
  const cles = comptes.map((c) => c.k);
  const a = cles.includes(choix[0]) ? choix[0] : cles[0];
  const b = cles.includes(choix[1]) && choix[1] !== a ? choix[1] : cles.find((k) => k !== a);
  const col = (k) => {
    const c = comptes.find((x) => x.k === k);
    const bc = brutComptes && (c.plat === 'Vinted' || comptes.filter((x) => x.plat === c.plat).length === 1) ? brutComptes[cleBrutCompte(c.plat, k.split('|').slice(1).join('|'))] : null;
    return colonneCompte(c, bc, enLigneDe(c), tauxVenteMois);
  };
  const A = col(a), B = col(b);
  const nom = (c) => `${c.nom}${c.site && c.site !== c.nom ? ` (${c.site})` : ''}`;
  const choisir = (i, k) => { const n = [a, b]; n[i] = k; if (n[0] === n[1]) n[1 - i] = cles.find((x) => x !== k); setChoix(n); };
  const sel = (i, v) => (
    <label className="vrm-sp-cmp-choix">
      <span className="vrm-sr-seul">{i === 0 ? 'Premier compte' : 'Second compte'}</span>
      <select value={v} data-sp-cmp-choix={i} onChange={(e) => choisir(i, e.target.value)}>
        {comptes.map((c) => <option key={c.k} value={c.k}>{nom(c)}</option>)}
      </select>
    </label>
  );
  const pct = (v) => `${v} %`;
  const jr = (j) => (j < 1 ? '< 1 j' : `${String(Math.round(j * 10) / 10).replace('.', ',')} j`);
  const L = [
    ['ventes', 'Ventes', (x) => String(x.n)],
    ['vendu', 'Vendu', (x) => fmt(x.eur)],
    ['benef', 'Bénéfice connu', (x) => (x.brut == null ? (x.nFin ? `— · prix d’achat 0 sur ${x.nFin}` : '—') : `${fmt(x.brut)}${x.nCout < x.nFin ? ` · ${x.nCout} sur ${x.nFin}` : ''}`)],
    ['panier', 'Panier moyen', (x) => (x.panier == null ? '— · pas assez' : fmt(x.panier))],
    ['delai', 'Temps pour vendre', (x) => (x.delai === undefined ? '— · pas sur ce site' : x.delai == null ? '— · aucune date' : jr(x.delai))],
    ['taux', 'Taux de vente', (x) => (x.taux === undefined ? '— · pas sur ce site' : x.taux == null ? '— · en ligne pas lu' : pct(x.taux))],
  ];
  return (
    <div className="vrm-sp-cmp" data-sv-etat="lu" data-sp-cmp={`${a}~${b}`}>
      <div className="vrm-sp-cmp-tete">{sel(0, a)}<span className="vrm-sp-cmp-vs" aria-hidden="true">et</span>{sel(1, b)}</div>
      <table className="vrm-sp-cmp-table">
        <thead><tr><th scope="col"><span className="vrm-sr-seul">Chiffre</span></th><th scope="col">{A.nom}</th><th scope="col">{B.nom}</th></tr></thead>
        <tbody>
          {L.map(([k, lib, f]) => (
            <tr key={k} data-sp-cmp-ligne={k}>
              <th scope="row">{lib}</th>
              <td data-sp-cmp-a="">{f(A)}</td>
              <td data-sp-cmp-b="">{f(B)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="vrm-sv-note">Sur la période, comptes sélectionnés · seuls les comptes avec au moins une vente · bénéfice : ventes finalisées au prix d’achat connu · temps pour vendre : médiane, Vinted seulement · taux : vendues ÷ (vendues + en ligne aujourd’hui), Vinted seulement · panier : à partir de {MIN_DONNEES} ventes.</p>
    </div>
  );
}
function StatsPlus({ b, V, partielVendu, lp, stock, barres, ligneUrssaf, lib, nomPrec, auMemePoint, titreBarres, noteBarres, venduTout, releveTout, partielTout, comptes, brutComptes, enLigneDe, onGo }) {
  const R = React.useMemo(() => resumePeriode(V === undefined ? undefined : V, partielVendu), [V, partielVendu]);
  const M = React.useMemo(() => margeConnue(lp === null ? null : lp), [lp]);
  const T = React.useMemo(() => meilleuresVentes(lp === null ? null : lp, 10), [lp]);
  const A = React.useMemo(() => ageDuStock(stock ? stock.dort : undefined), [stock]);
  const VR = React.useMemo(() => (barres ? venduEtRecu(barres, (de, a) => ligneUrssaf === undefined ? { valeur: null, raison: 'encours' } : recuPublieEntre(ligneUrssaf, { de, a })) : barres), [barres, ligneUrssaf]);
  const aDater = ligneUrssaf && ligneUrssaf.aDater ? Number(ligneUrssaf.aDater.n) || 0 : 0;
  const vide = videStatsVitrine;
  const carte = (k, titre, droite, corps, attrs, cls) => <CarteStatsVitrine k={k} titre={titre} droite={droite} corps={corps} attrs={attrs} cls={cls}/>;
  const pct = (v) => `${String(v).replace('.', ',')} %`;
  const memePoint = auMemePoint ? ', au même jour' : '';
  // ── En bref : trois tuiles de plus (ventes, panier moyen, marge connue) ──
  const tuile = (k, lib2, val, sous, attrs, titre) => (
    <div className="vrm-sv-tuile" data-sv-tuile={k} title={titre || undefined} {...(attrs || {})}>
      <div className="vrm-sv-tuile-lib">{lib2}</div>
      <div className="vrm-display vrm-sv-tuile-val" data-vide={val === '—' ? '1' : undefined}>{val}</div>
      <div className="vrm-sv-tuile-sous">{sous}</div>
    </div>
  );
  const tVentes = R === undefined ? tuile('sp-ventes', 'Ventes', '—', 'je lis tes ventes…', { 'data-sv-etat': 'encours' })
    : R === null ? tuile('sp-ventes', 'Ventes', '—', 'ventes pas pu être lues', { 'data-sv-etat': 'passu' })
      : tuile('sp-ventes', 'Ventes', `${R.partiel ? 'au moins ' : ''}${R.n}`, R.ecartN != null && !R.partiel ? ecartTxt(R.ecartN, nomPrec) : R.nPrec != null ? `${nomPrec} : ${R.nPrec}` : '',
        { 'data-sv-etat': 'lu', 'data-sp-n': R.n, 'data-sp-ecart-n': R.ecartN == null ? '' : R.ecartN, 'data-sv-partiel': R.partiel ? '1' : '0' }, `Comparé à ${nomPrec}${memePoint}.`);
  const tPanier = R === undefined ? tuile('sp-panier', 'Panier moyen', '—', 'je lis tes ventes…', { 'data-sv-etat': 'encours' })
    : R === null ? tuile('sp-panier', 'Panier moyen', '—', 'ventes pas pu être lues', { 'data-sv-etat': 'passu' })
      : R.partiel ? tuile('sp-panier', 'Panier moyen', '—', 'des ventes au montant pas lu : pas de moyenne', { 'data-sv-etat': 'partiel', 'data-sp-panier': '' })
        : R.panier == null ? tuile('sp-panier', 'Panier moyen', '—', R.n === 0 ? 'aucune vente sur la période' : `pas assez de données (${plSP(R.n, 'vente')}, il en faut ${MIN_DONNEES})`, { 'data-sv-etat': 'pas-assez', 'data-sp-panier': '' })
          : tuile('sp-panier', 'Panier moyen', fmt(R.panier), R.ecartPanier != null ? ecartTxt(R.ecartPanier, nomPrec) : `sur ${plSP(R.n, 'vente')}`,
            { 'data-sv-etat': 'lu', 'data-sp-panier': String(Math.round(R.panier * 100)), 'data-sp-ecart-panier': R.ecartPanier == null ? '' : R.ecartPanier }, 'Le vendu de la période divisé par le nombre de ventes (la tuile « Vendu »).');
  const tMarge = M === undefined || lp === undefined ? tuile('sp-marge', 'Marge connue', '—', 'je lis tes ventes…', { 'data-sv-etat': 'encours' })
    : !M ? tuile('sp-marge', 'Marge connue', '—', 'pas encore calculé', { 'data-sv-etat': 'passu' })
      : M.marge == null ? tuile('sp-marge', 'Marge connue', '—', M.n === 0 ? 'aucune vente finalisée' : `pas assez de données · prix d’achat connu ${M.nCout} sur ${M.n}`, { 'data-sv-etat': 'pas-assez', 'data-sp-marge': '', 'data-sp-couv': `${M.nCout}/${M.n}` })
        : tuile('sp-marge', 'Marge connue', pct(M.marge), <>{fmt(M.moyen)} par vente{M.nCout < M.n ? ` · ${M.nCout} ventes sur ${M.n}` : ''}</>,
          { 'data-sv-etat': 'lu', 'data-sp-marge': String(M.marge), 'data-sp-moyen': String(Math.round(M.moyen * 100)), 'data-sp-couv': `${M.nCout}/${M.n}`, 'data-benef-notion': 'brut' },
          `${NOM_BENEFICE_BRUT} ÷ ventes, seulement les ventes finalisées au prix d’achat connu (sans frais, dépenses ni URSSAF).`);
  // ── Vendu et reçu ──
  const corpsVR = VR === undefined || VR == null ? vide(VR === null ? 'Tes ventes n’ont pas pu être lues.' : 'Je lis tes ventes…', { 'data-sv-etat': VR === null ? 'passu' : 'encours' })
    : (<>
      <GraphiqueVenduRecu VR={VR} lib={lib} titre={`Vendu et reçu, ${noteBarres}`}/>
      <div className="vrm-sv-note" data-sp-vr-note={VR.raison || ''}>
        Vendu : à la date de la vente · Reçu : au jour du versement (ce que tu déclares){!VR.recuLu ? ` · ${RAISON_RECU[VR.raison] || 'reçu pas lu'}` : !VR.recuComplet ? ' · reçu pas tout lu : un minimum' : ''}{aDater > 0 ? ` · ${plSP(aDater, 'vente')} sans date de versement (dans aucune barre)` : ''}
      </div>
    </>);
  // ── Les 10 meilleures ventes ──
  const corpsTop = T === undefined ? vide('Je lis tes ventes…', { 'data-sv-etat': 'encours' })
    : T === null ? vide('Pas encore calculé : ouvre l’écran Ventes une fois.', { 'data-sv-etat': 'passu' })
      : T.n === 0 ? vide('Aucune vente finalisée sur la période.', { 'data-sv-etat': 'lu' })
        : T.nCout === 0 ? vide(`Il manque le prix d’achat de tes ${plSP(T.n, 'vente finalisée', 'ventes finalisées')} : rien à classer.`, { 'data-sv-etat': 'lu', 'data-sp-top-couv': `0/${T.n}` })
          : (
            <ol className="vrm-sp-top" data-sv-etat="lu" data-sp-top={T.lignes.map((l) => Math.round(l.brut * 100)).join(',')} data-sp-top-couv={`${T.nCout}/${T.n}`}>
              {T.lignes.map((l, i) => (
                <li key={`${l.id}-${i}`} className="vrm-sp-top-ligne" data-sp-top-brut={Math.round(l.brut * 100)}>
                  <span className="vrm-sp-top-rang" aria-hidden="true">{i + 1}</span>
                  <span className="vrm-sp-top-nom"><span>{l.titre || 'Sans titre'}</span><small>{new Date(l.ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {l.plateforme === 'Vinted' && l.compte ? l.compte : l.plateforme} · vendu {fmt(l.eur)}, acheté {fmt(l.achat)}</small></span>
                  <span className="vrm-sv-chiffre vrm-sp-top-brut">{l.brut >= 0 ? '+' : '−'}{fmt(Math.abs(l.brut))}</span>
                </li>
              ))}
              {T.nCout < T.n || T.pasAssez ? <li className="vrm-sv-note vrm-sp-top-note">{T.pasAssez ? 'Peu de ventes classées : ' : ''}classées sur {T.nCout} ventes au prix d’achat connu (sur {T.n}).</li> : null}
            </ol>
          );
  // ── L'âge du stock (aujourd'hui, quelle que soit la période) ──
  const maxA = A && A.tranches ? Math.max(1, ...A.tranches.map((t) => t.n)) : 1;
  const corpsAge = A === undefined ? vide('Ouvre l’écran Annonces une fois : il compte l’âge de tes annonces.', { 'data-sv-etat': 'passu' })
    : A === null ? vide('L’âge de tes annonces n’a pas pu être lu.', { 'data-sv-etat': 'passu' })
      : A.total === 0 ? vide('Aucune annonce en ligne.', { 'data-sv-etat': 'lu' })
        : (
          <div className="vrm-sv-lignes" data-sv-etat="lu" data-sp-age={A.tranches.map((t) => t.n).join(',')} data-sp-age-sans={A.sansDate}>
            {A.tranches.map((t) => (
              <div key={t.k} className="vrm-sv-ligne-taille vrm-sp-age-ligne" data-sp-tranche={t.k} data-n={t.n}>
                <span className="vrm-sv-nom">{t.l}</span>
                <span className="vrm-sv-piste vrm-sv-piste-epaisse"><span data-vieux={t.k === '90+' && t.n > 0 ? '1' : undefined} style={{ width: `${t.n ? Math.max(3, t.n / maxA * 100) : 0}%` }}/></span>
                <span className="vrm-sv-chiffre">{plSP(t.n, 'annonce')}</span>
              </div>
            ))}
            {A.sansDate > 0 ? <div className="vrm-sv-note">{plSP(A.sansDate, 'annonce')} sans date de mise en ligne : pas rangée{A.sansDate > 1 ? 's' : ''}.</div> : null}
          </div>
        );
  return (
    <>
      <div className="vrm-sv-tuiles vrm-sp-tuiles" data-sp-en-bref="">{tVentes}{tPanier}{tMarge}</div>
      <RepliStats id="plus" titre="Plus de chiffres" ouvertDefaut>
        <div className="vrm-sp-corps">
          <div className="vrm-sv-rangee vrm-sv-rangee-2">
            {carte('sp-vr', 'Vendu et reçu', `${titreBarres.replace('Vendu par ', 'par ')} · ${noteBarres}`, corpsVR, { 'data-sv-carte': 'vendu-recu' }, 'vrm-sv-large')}
            {carte('sp-age', 'L’âge de ton stock', A && A.total ? `aujourd’hui · ${plSP(A.datesConnues, 'annonce datée', 'annonces datées')}` : 'aujourd’hui', corpsAge, { 'data-sv-carte': 'age-stock' })}
          </div>
          {carte('sp-records', 'Mes records', 'depuis le début', <MesRecords vendu={venduTout} releve={releveTout} partiel={partielTout} onGo={onGo}/>, { 'data-sv-carte': 'records' })}
          {Array.isArray(comptes) && comptes.length >= 2
            ? carte('sp-comptes', 'Comparer deux comptes', null, <ComparerComptes comptes={comptes} brutComptes={brutComptes} enLigneDe={enLigneDe}/>, { 'data-sv-carte': 'comparer-comptes' })
            : carte('sp-comptes', 'Comparer deux comptes', null, vide(comptes === null ? 'Tes ventes n’ont pas pu être lues.' : comptes === undefined ? 'Je lis tes ventes…' : 'Il faut deux comptes avec au moins une vente sur la période.', { 'data-sv-etat': comptes == null ? 'passu' : 'pas-assez' }), { 'data-sv-carte': 'comparer-comptes' })}
          {carte('sp-top', 'Tes 10 meilleures ventes', T && T.nCout ? `bénéfice brut · ${T.nCout} sur ${T.n}` : null, corpsTop, { 'data-sv-carte': 'meilleures' })}
        </div>
      </RepliStats>
    </>
  );
}
function StatsVitrine({ liveStats, panelOff, periode, onSaisirPrix = null, onGo = null }) {
  const maintenant = React.useMemo(() => Date.now(), [periode, liveStats]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = React.useMemo(() => bornesPeriode(periode, maintenant), [periode, maintenant]);
  const { releve, stock, benef, extras, lignes } = useReleveStats();
  const { ventes: ventesCoque } = useVentesCoque();
  const [nuage, setNuage] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => setNuage(true)), []);
  const ecarteStats = useCompteEcarte(panelOff);   // (6 nov.) une source pour les comptes écartés (Boost, Offres)
  // (11 nov., lot stats-plus) Le reçu publié par Ventes (`vinted_urssaf_mois`) et l'âge du stock
  // publié par Annonces (`vrm_stats_stock`) ; `undefined` tant que ce n'est pas lu sur cet appareil.
  const ligneUrssafPlus = useLigneUrssaf();
  const stockPlus = stock || undefined;   // jamais publié sur cet appareil ⇒ « ouvre Annonces »

  const vendu = liveStats ? liveStats.venduLignes : undefined;
  const manque = (liveStats && liveStats.venduManque) || [];
  // (2 nov., audit des données) Des ventes de la PÉRIODE dont l'argent ne se lit
  // pas (frais eBay pas lus, prix Vinted illisible, Vestiaire pas sûr) : le
  // « Vendu » est un minimum et le dit — comme Ma journée (§5).
  const ncPeriode = nonCompteesDe(liveStats && liveStats.venduNonComptees, b.de, b.a);
  const partielVendu = manque.length > 0 || ncPeriode.length > 0;
  const V = React.useMemo(() => venduPeriode(vendu, b), [vendu, b]);
  const barres = React.useMemo(() => barresPeriode(vendu, b.type, maintenant), [vendu, b, maintenant]);
  // Bénéfice : les jours publiés compris dans la période (jusqu'à demain minuit).
  const B = React.useMemo(() => benef ? beneficeDesJours(benef.jours, new Date(b.de), new Date(b.a)) : null, [benef, b]);
  // (3 nov.) « Bénéfice » du mois ou de l'année = la lecture de Comptabilité et
  // de Ma journée (`useBeneficeCalcul`, mêmes charges, même CA déclaré), jamais
  // un second calcul. Une semaine n'a ni dépenses ni URSSAF à elle (elles se
  // comptent au mois) : la tuile dit alors « Bénéfice brut », un autre nom.
  const [comptaS] = useLigneSynchro('vrm_compta', lireComptaSynchro);
  const { etat: etatBP, B: BP } = useBeneficeCalcul(comptaS, b.type === 'annee' ? 'annee' : 'mois');
  const dansP = (l) => l && dansBornes(l.ts, b.de, b.a);
  const lp = React.useMemo(() => (lignes ? lignes.filter(dansP) : null), [lignes, b]); // eslint-disable-line react-hooks/exhaustive-deps
  const datesPasSu = extras !== undefined && (!extras || extras.items == null || extras.txn == null);
  const lv = lp && !datesPasSu && extras !== undefined ? lp.filter((l) => l.plateforme === 'Vinted') : null;
  const Dl = React.useMemo(() => (lv ? delaisPar(lv, () => '') : null), [lv]);
  // (9 nov., « vendre plus ») Ce qui part vite, par Modèle · Marque (LUE sur l'annonce,
  // jamais devinée du titre) · Taille · Compte. Un groupe à moins de 5 ventes datées est
  // montré, jamais classé (`classerSansConclureTropVite`, src/vendrePlus.js).
  const [axeVite, setAxeViteEtat] = React.useState(() => { try { const v = localStorage.getItem('vrm_sv_axe_vite'); return AXES_VITE[v] ? v : 'modele'; } catch (_) { return 'modele'; } });
  const setAxeVite = (v) => { const x = AXES_VITE[v] ? v : 'modele'; setAxeViteEtat(x); try { localStorage.setItem('vrm_sv_axe_vite', x); } catch (_) {} };
  const rapidesC = React.useMemo(() => (lv ? classerSansConclureTropVite(delaisPar(lv, CLE_VITE[axeVite]), SEUIL_CONCLUSION, 5) : null), [lv, axeVite]);
  const rapides = rapidesC ? rapidesC.classes : null;
  const tailles = React.useMemo(() => {
    if (!lp || extras === undefined) return null;
    const D = delaisPar(lp, (l) => l.taille);
    const top = D.groupes.slice().sort((x, y) => y.n - x.n || (x.k < y.k ? -1 : 1)).slice(0, 6);
    const num = (k) => { const n = parseFloat(String(k).replace(',', '.')); return isFinite(n) ? n : Infinity; };
    return { n: D.n, sansTaille: D.n - D.groupes.reduce((s, g) => s + g.n, 0), plus: top.length ? top[0].k : null, groupes: top.sort((x, y) => num(x.k) - num(y.k) || (x.k < y.k ? -1 : 1)) };
  }, [lp, extras, datesPasSu]);
  // Par compte : les lignes du VENDU de la période (la tuile), compte et site.
  const comptes = React.useMemo(() => {
    if (!Array.isArray(vendu)) return null;
    const P = ventesPar(vendu.filter(dansP), (l) => `${l.plateforme}|${l.compte || ''}`);
    const dl = lp && lv ? delaisPar(lv, (l) => l.compte) : null;
    const nbLbc = new Set(P.groupes.filter((g) => g.k.startsWith('Leboncoin|')).map((g) => g.k)).size;
    return P.groupes.map((g) => {
      const [plat, compte] = g.k.split('|');
      const d = plat === 'Vinted' && dl ? dl.groupes.find((x) => x.k === compte) : null;
      const nom = plat === 'Vinted' ? (compte || 'Vinted') : plat === 'Leboncoin' ? (nbLbc > 1 && compte ? `Leboncoin ${compte.slice(-4)}` : 'Leboncoin') : (compte || plat);
      return { k: g.k, plat, nom, site: plat === 'Vinted' ? '' : (SITE_COURT[plat] || plat), n: g.n, eur: g.eur, mediane: d ? d.mediane : null, nDelai: d ? d.nDelai : 0 };
    });
  }, [vendu, b, lp, lv]); // eslint-disable-line react-hooks/exhaustive-deps
  // (9 nov.) Le bénéfice brut par compte : LA règle du « Bénéfice brut » de Statistiques
  // (`classementRapporte`, axe Compte), sur les ventes FINALISÉES de la période ; la
  // couverture (prix d'achat connus) dite à côté. Rien n'est recalculé ici.
  const brutComptes = React.useMemo(() => (lp ? brutParCompte(classementRapporte(lp, 'compte').groupes) : null), [lp]);
  const meilleurCompte = React.useMemo(() => compteQuiVendLeMieux(comptes, SEUIL_CONCLUSION), [comptes]);
  // Boost (3 nov.) : les annonces mises en ligne dans la période, boostées
  // contre non boostées du MÊME modèle sûr (`boostRentable`, src/boostRentable.js).
  const boost = React.useMemo(() => {
    if (!Array.isArray(ventesCoque) || !extras || !nuage) return null;
    let fiches = null;
    try { fiches = load('vinted_annonce_numeros', {}) || {}; } catch (_) { fiches = null; }
    return boostRentable({
      annonces: extras.items, ventes: ventesCoque, txn: extras.txn, fiches, de: b.de, a: b.a,
      modeleDe: (it) => modeleSur((it && it.brand) || '', (it && it.title) || ''),
      dateMiseEnLigne: (it) => dateMiseEnLigneMs(it, extras.dates || null),
      estAnnulee: (o) => classifyOrderStatus(o.status) === 'cancelled',
      ecarte: (o) => ecarteStats(o && o._acc && o._acc.vinted_user_id),
      montantVente: montantCommande,
    });
  }, [ventesCoque, extras, nuage, ecarteStats, b]);

  // (4 nov.) LES OFFRES (src/statsOffres.js) : lues quand la carte paraît
  // (lecture projetée, ~1,2 Mo de messages, une fois par dix minutes).
  const refOffres = React.useRef(null);
  const [offresBrut, setOffresBrut] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    const go = () => { lireOffresStats().then((x) => { if (!mort) setOffresBrut(x); }).catch(() => { if (!mort) setOffresBrut({ convs: null, lectures: null, txn: null }); }); };
    const el = refOffres.current;
    if (!el || typeof IntersectionObserver === 'undefined') { go(); return () => { mort = true; }; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => { mort = true; io.disconnect(); };
  }, []);
  const offres = React.useMemo(() => {
    if (offresBrut === undefined || vendu === undefined) return null;
    const ecarte = ecarteStats;
    const convs = Array.isArray(offresBrut.convs) ? offresBrut.convs.filter((c) => !ecarte(c.compte)) : null;
    const lectures = offresBrut.lectures ? Object.fromEntries(Object.entries(offresBrut.lectures).filter(([u]) => !ecarte(u))) : {};
    const ventes = Array.isArray(vendu) ? vendu.filter((l) => l.plateforme === 'Vinted') : null;
    return statsOffres({ convs, lectures, ventes, txn: offresBrut.txn, de: b.de, a: b.a, maintenant });
  }, [offresBrut, vendu, ecarteStats, b, maintenant]);
  const nomCompteOffres = (uid) => {
    const labels = load('vinted_account_labels', {}) || {};
    if (labels[uid]) return labels[uid];
    const l = Array.isArray(vendu) ? vendu.find((x) => x.uid === uid && x.compte && x.compte !== uid) : null;
    if (l) return l.compte;
    const a = (load('vinted_accounts', []) || []).find((x) => String(x && x.vinted_user_id) === String(uid));
    return (a && a.login) || `#${uid}`;
  };

  const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  // Un délai s'écrit à la demi-journée près (la médiane de 3 et 10 est 6,5 j, jamais « 7 »).
  const j10 = (j) => Math.round(j * 10) / 10, jTxt = (j) => String(j10(j)).replace('.', ',');
  const jours = (j) => (j == null ? '—' : j < 1 ? '< 1 j' : `${jTxt(j)} j`);
  const joursLong = (j) => (j == null ? '—' : j < 1 ? 'moins d’un jour' : `${jTxt(j)} jour${j10(j) >= 2 ? 's' : ''}`);
  const cents = (v) => (v == null ? '' : String(Math.round(v * 100)));
  const nomPrec = b.type === 'semaine' ? 'la semaine d’avant' : b.type === 'annee' ? String(new Date(b.prevDe).getFullYear()) : new Date(b.prevDe).toLocaleDateString('fr-FR', { month: 'long' });
  const auMemePoint = b.prevCoupe < b.prevA;

  // ── Les 4 tuiles ──
  const tuile = (k, lib, val, sous, attrs, titre) => (
    <div className="vrm-sv-tuile" data-sv-tuile={k} title={titre || undefined} {...(attrs || {})}>
      <div className="vrm-sv-tuile-lib">{lib}</div>
      <div className="vrm-display vrm-sv-tuile-val" data-vide={val === '—' ? '1' : undefined}>{val}</div>
      <div className="vrm-sv-tuile-sous">{sous}</div>
    </div>
  );
  const tVendu = V == null
    ? tuile('vendu', 'Vendu', '—', vendu === null ? 'ventes pas pu être lues' : 'je lis tes ventes…', { 'data-sv-etat': vendu === null ? 'passu' : 'encours' })
    : tuile('vendu', 'Vendu', `${partielVendu ? 'au moins ' : ''}${fmt(V.eur)}`,
      <>{pl(V.n, 'vente')}{V.ecart != null && !partielVendu ? <span title={`Comparé à ${nomPrec}${auMemePoint ? ', au même jour' : ''} : ${fmt(V.prec.eur)}`}>{` · ${V.ecart > 0 ? '+' : ''}${V.ecart}\u00a0% par rapport à ${nomPrec}`}</span> : null}{manque.length ? ` · sans ${manque.join(', ')}` : ''}{ncPeriode.length ? ` · ${ncPeriode.length} non comptée${ncPeriode.length > 1 ? 's' : ''}` : ''}</>,
      { 'data-sv-etat': 'lu', 'data-sv-n': V.n, 'data-sv-eur': cents(V.eur), 'data-sv-prec': cents(V.prec.eur), 'data-sv-ecart': V.ecart == null ? '' : V.ecart, 'data-sv-partiel': partielVendu ? '1' : '0', 'data-sv-non-comptees': ncPeriode.length || undefined }, ncPeriode.length ? `Pas dans ce montant : ${phraseNonComptees(ncPeriode)}` : undefined);
  // (7 nov., demande de Julien) LE CA DEPUIS LE DÉBUT : la MÊME source que « Vendu »
  // (`ventesFaites`, date de vente, toutes plateformes, comptes sélectionnés), sans borne
  // de date. Un site pas lu ou une vente dont l'argent ne se lit pas ⇒ « au moins » (§5) ;
  // pas lu ⇒ « — ». La date de la première vente lue dit d'où part le total.
  const tTotal = (() => {
    if (vendu == null) return tuile('total', 'CA depuis le début', '—', vendu === null ? 'ventes pas pu être lues' : 'je lis tes ventes…', { 'data-sv-etat': vendu === null ? 'passu' : 'encours' });
    let n = 0, c = 0, premier = null;
    for (const l of vendu) { if (!l || !isFinite(l.ts) || !(l.ts > 0) || !isFinite(Number(l.eur))) continue; n += 1; c += Math.round(Number(l.eur) * 100); if (premier == null || l.ts < premier) premier = l.ts; }
    const ncTout = nonCompteesDe(liveStats && liveStats.venduNonComptees, 0, Infinity);
    const partiel = manque.length > 0 || ncTout.length > 0;
    const depuis = premier != null ? ` · depuis le ${new Date(premier).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
    return tuile('total', 'CA depuis le début', n === 0 && !partiel ? '0,00 €' : `${partiel ? 'au moins ' : ''}${fmt(c / 100)}`, n === 0 ? 'aucune vente lue pour l’instant' : <>{pl(n, 'vente')}{depuis}</>,
      { 'data-sv-etat': 'lu', 'data-sv-n': n, 'data-sv-eur': String(c), 'data-sv-partiel': partiel ? '1' : '0' },
      'Toutes tes ventes, toutes plateformes, à la date de la vente (comme « Vendu »), depuis la première que VRM a lue.');
  })();
  const tBenef = (() => {
    if (b.type === 'semaine') {
      const R = chiffreBrut(B);
      const sous = !B ? 'pas encore calculé'
        : B.n === 0 ? 'aucune vente finalisée'
        : B.nCout === 0 ? `il manque le prix d’achat de tes ${pl(B.n, 'vente')}`
        : R.partiel ? `${B.nCout} vente${B.nCout > 1 ? 's' : ''} sur ${B.n} ${B.nCout > 1 ? 'ont' : 'a'} leur prix d’achat : il manque celui des autres`
        : `vente − prix d’achat, sur ${pl(B.n, 'vente finalisée', 'ventes finalisées')}`;
      return tuile('benefice', NOM_BENEFICE_BRUT, R.valeur == null ? '—' : fmt(R.valeur), sous,
        { 'data-sv-etat': B ? 'lu' : 'passu', 'data-sv-n': B ? B.n : undefined, 'data-sv-ncout': B ? B.nCout : undefined, 'data-sv-brut': R.valeur == null ? '' : cents(R.valeur), ...R.attrs },
        'Bénéfice brut : vente − prix d’achat, ventes finalisées de la semaine, sur les seules ventes au prix d’achat connu. Dépenses et URSSAF se comptent au mois.');
    }
    const CB = chiffreBenefice(BP, etatBP);
    const manquent = BP ? BP.n - BP.nCout : 0;
    const sous = !BP ? (etatBP === 'encours' ? 'je le lis…' : 'pas encore calculé')
      // (7 nov., revue UX) « finalisées » écrit : à côté de « Vendu · 35 ventes », « 21 sur 21 » semblait le contredire.
      : CB.raison === 'achats' ? `il manque le prix d’achat de ${manquent} vente${manquent > 1 ? 's' : ''} finalisée${manquent > 1 ? 's' : ''} sur ${BP.n}`
      : CB.raison === 'frais' ? 'des frais eBay ne sont pas encore connus'
      : CB.raison === 'cotisations' ? 'en attente de ton chiffre déclaré (écran Ventes)'
      : CB.raison === 'rien' ? 'aucune vente finalisée ni dépense sur la période'
      : `${BP.n === 0 ? 'aucune vente finalisée · ' : ''}après prix d’achat, frais${BP.depenses === 'jamais' ? '' : ', dépenses'}${BP.sansCotis ? '' : ' et URSSAF'}${BP.depenses === 'jamais' ? ' · avant tes dépenses' : ''}`;
    return tuile('benefice', NOM_BENEFICE, CB.valeur == null ? '—' : fmt(CB.valeur), sous,
      { 'data-sv-etat': BP ? 'lu' : etatBP, 'data-sv-n': BP ? BP.n : undefined, 'data-sv-ncout': BP ? BP.nCout : undefined, 'data-sv-brut': BP && BP.nCout > 0 ? cents(BP.brut) : '', ...CB.attrs },
      'Bénéfice : tes ventes finalisées moins le prix d’achat des paires, les frais de vente, tes dépenses et l’URSSAF — la même règle que Comptabilité et Ma journée.');
  })();
  const tDelai = !releve
    ? tuile('delai', 'Temps pour vendre', '—', 'pas encore calculé', { 'data-sv-etat': 'passu' })
    : extras === undefined ? tuile('delai', 'Temps pour vendre', '—', 'je lis tes annonces…', { 'data-sv-etat': 'encours' })
      : datesPasSu ? tuile('delai', 'Temps pour vendre', '—', 'annonces pas pu être lues', { 'data-sv-etat': 'passu' })
        : !Dl || Dl.nDelai === 0 ? tuile('delai', 'Temps pour vendre', '—', Dl && Dl.n ? (Dl.n === 1 ? 'ta vente Vinted n’a pas de date de mise en ligne' : `aucune de tes ${Dl.n} ventes Vinted n’a de date de mise en ligne`) : 'aucune vente Vinted finalisée', { 'data-sv-etat': 'lu', 'data-sv-mediane': '', 'data-sv-couv': Dl ? `0/${Dl.n}` : '0/0' })
          : tuile('delai', 'Temps pour vendre', joursLong(Dl.mediane), `la moitié de tes articles partent plus vite${Dl.nDelai < Dl.n ? ` · ${Dl.nDelai} ventes datées sur ${Dl.n}` : ''}`,
            { 'data-sv-etat': 'lu', 'data-sv-mediane': Dl.mediane, 'data-sv-couv': `${Dl.nDelai}/${Dl.n}` }, 'Vinted seulement : Leboncoin et eBay ne donnent pas la date de mise en ligne.');
  const enLigneTxt = texteEnLigne(liveStats);
  const dort = stock && stock.dort && stock.dort.seuils ? (stock.dort.seuils[30] || { n: 0 }).n : null;
  const tEnLigne = tuile('enligne', 'En ligne',
    <span data-dash-stat="online">{enLigneTxt === '—' ? '—' : <><b style={{ fontWeight: 'inherit' }}>{enLigneTxt}</b> annonce{enLigneTxt === '1' ? '' : 's'}</>}</span>,
    dort == null ? 'aujourd’hui' : dort === 0 ? 'aucune depuis 30 jours ou plus' : `dont ${dort} depuis 30 jours ou plus`,
    { 'data-sv-etat': enLigneTxt === '—' ? 'passu' : 'lu', 'data-sv-dort': dort == null ? '' : dort }, 'Aujourd’hui, quelle que soit la période choisie.');

  // ── Les barres ──
  const maxB = barres ? Math.max(1, ...barres.map((x) => x.eur)) : 1;
  const libBarre = (x) => b.type === 'semaine' ? new Date(x.debut).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
    : b.type === 'annee' ? new Date(x.debut).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : new Date(x.debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const titreBarres = b.type === 'semaine' ? 'Vendu par jour' : b.type === 'annee' ? 'Vendu par mois' : 'Vendu par semaine';
  const noteBarres = b.type === 'semaine' ? 'cette semaine' : b.type === 'annee' ? String(new Date(b.de).getFullYear()) : '8 dernières semaines';
  const H = 190;

  // (5 nov., chantier F, revue 2.25) Une carte sans rien à montrer (lecture en cours, pas su,
  // aucune donnée sur la période) se REPLIE en une ligne : son titre et la raison, rien d'autre.
  const carte = (k, titre, droite, corps, attrs, cls) => <CarteStatsVitrine k={k} titre={titre} droite={droite} corps={corps} attrs={attrs} cls={cls}/>;
  const vide = videStatsVitrine;
  const maxRapide = rapides && rapides.length ? Math.max(...rapides.map((g) => g.mediane), 1) : 1;
  const maxTaille = tailles && tailles.groupes.length ? Math.max(...tailles.groupes.map((g) => g.n), 1) : 1;

  return (
    <div className="vrm-stats-vitrine" data-sv-periode={b.type} data-sv-de={b.de} data-sv-a={b.a}>
      <div className="vrm-sv-sous-titre" data-sv-sous-titre="">{titrePeriodeStats(b)}{auMemePoint ? <span className="vrm-sv-note"> · au même jour</span> : null}</div>
      <div className="vrm-sv-tuiles">{tVendu}{tBenef}{tDelai}{tEnLigne}{tTotal}</div>
      {/* (11 nov., lot stats-plus) En bref (ventes, panier moyen, marge connue), puis « Plus de chiffres ». */}
      <StatsPlus b={b} V={vendu === undefined ? undefined : V} partielVendu={partielVendu} lp={lignes === null ? null : lp} stock={stockPlus} barres={barres} ligneUrssaf={ligneUrssafPlus}
        lib={libBarre} nomPrec={nomPrec} auMemePoint={auMemePoint} titreBarres={titreBarres} noteBarres={noteBarres}
        venduTout={vendu} releveTout={!lignes ? (releve ? undefined : null) : extras === undefined ? undefined : datesPasSu ? lignes.map((l) => ({ ...l, enLigne: null })) : lignes}
        partielTout={manque.length > 0 || nonCompteesDe(liveStats && liveStats.venduNonComptees, 0, Infinity).length > 0}
        comptes={vendu === undefined ? undefined : comptes} brutComptes={brutComptes} onGo={onGo}
        enLigneDe={(c) => { if (c.plat !== 'Vinted') return null; const l = Array.isArray(vendu) ? vendu.find((x) => x && x.plateforme === 'Vinted' && String(x.compte || '') === c.k.split('|').slice(1).join('|') && x.uid) : null; const E = liveStats && liveStats.annEnLigne; return l && E && Object.prototype.hasOwnProperty.call(E, l.uid) && Number.isFinite(E[l.uid]) ? E[l.uid] : null; }}/>
      <div className="vrm-sv-rangee vrm-sv-rangee-3">
        {carte('sv-barres', titreBarres, noteBarres, !barres
          ? vide(vendu === null ? 'Tes ventes n’ont pas pu être lues : aucune barre.' : 'Je lis tes ventes…')
          : (
            <div className="vrm-sv-barres" role="img" aria-label={`${titreBarres}, ${noteBarres}`} data-sv-barres={barres.map((x) => cents(x.eur)).join(',')} data-sv-barres-n={barres.map((x) => x.n).join(',')} data-sv-encours={barres.findIndex((x) => x.enCours)}>
              {barres.map((x, i) => (
                <div key={i} className="vrm-sv-barre-col" title={`${libBarre(x)} : ${x.avenir ? 'pas encore commencé' : `${fmt(x.eur)} · ${pl(x.n, 'vente')}`}${x.enCours ? ' (en cours)' : ''}`}>
                  <div className="vrm-sv-barre-zone" style={{ height: H }}>
                    {!x.avenir && x.eur > 0 && <div className="vrm-sv-barre" data-en-cours={x.enCours ? '1' : undefined} style={{ height: `${Math.max(2, x.eur / maxB * 100)}%` }}/>}
                  </div>
                  <div className="vrm-sv-barre-lib">{libBarre(x)}</div>
                </div>
              ))}
            </div>
          ), { 'data-sv-carte': 'barres' }, 'vrm-sv-large')}
        {carte('sv-rapides', 'Ce qui part vite', rapidesC && (rapides.length || rapidesC.peu.length) ? 'jours pour vendre' : null, !lignes
          ? vide('Pas encore calculé', { 'data-sv-etat': 'passu' })
          : extras === undefined ? vide('Je lis les dates de mise en ligne…', { 'data-sv-etat': 'encours' })
            : datesPasSu ? vide('Tes annonces n’ont pas pu être lues : aucun délai.', { 'data-sv-etat': 'passu' })
              : !rapides.length && !rapidesC.peu.length ? vide('Aucune vente Vinted à la date de mise en ligne connue sur la période.', { 'data-sv-etat': 'lu' })
                : (
                  <div className="vrm-sv-lignes" data-sv-etat="lu" data-sv-axe-vite={axeVite} data-sv-peu={rapidesC.peu.length} data-sv-n-peu={rapidesC.nPeu}>
                    <Segmente label="Par" className="vrm-sv-axes-vite" value={axeVite} onChange={setAxeVite} options={Object.entries(AXES_VITE).map(([v, l]) => ({ v, l, data: { 'data-sv-axe-choix': v } }))}/>
                    {rapides.map((g) => (
                      <div key={g.k} className="vrm-sv-ligne-rapide" data-sv-rapide={g.k} data-mediane={g.mediane} data-ndelai={g.nDelai} title={`${g.k} : médiane ${jours(g.mediane)}, sur ${pl(g.nDelai, 'vente datée', 'ventes datées')}`}>
                        <span className="vrm-sv-nom">{g.k.replace(/(^|\s)(\p{Ll})/gu, (m, e, c) => e + c.toUpperCase())}</span>
                        <span className="vrm-sv-piste"><span style={{ width: `${Math.max(4, (1 - g.mediane / (maxRapide * 1.15)) * 100)}%` }}/></span>
                        <span className="vrm-sv-chiffre">{jours(g.mediane)}</span>
                      </div>
                    ))}
                    {rapidesC.peu.length > 0 && (
                      <div className="vrm-sv-note" data-sv-pas-conclu={rapidesC.peu.length}>
                        {rapides.length ? 'Pas encore classés' : 'Rien de classé'} : {pl(rapidesC.peu.length, 'groupe')} à moins de {SEUIL_CONCLUSION} ventes datées ({rapidesC.peu.slice(0, 4).map((g) => `${g.k.replace(/(^|\s)(\p{Ll})/gu, (m, e, c) => e + c.toUpperCase())} ${g.nDelai}`).join(', ')}{rapidesC.peu.length > 4 ? '…' : ''}) — pas assez pour conclure.
                      </div>
                    )}
                  </div>
                ), { 'data-sv-carte': 'rapides' })}
        {carte('sv-comptes', 'Quel compte vend le mieux', comptes && comptes.length ? 'ventes · jours pour vendre' : null, !comptes
          ? vide(vendu === null ? 'Tes ventes n’ont pas pu être lues.' : 'Je lis tes ventes…', { 'data-sv-etat': vendu === null ? 'passu' : 'encours' })
          : !comptes.length ? vide('Aucune vente sur la période.', { 'data-sv-etat': 'lu' })
            : (
              <div className="vrm-sv-lignes vrm-sv-comptes" data-sv-etat="lu">
                {(() => { const m = meilleurCompte ? comptes.find((c) => c.k === meilleurCompte) : null;
                  if (m) return <p className="vrm-sv-phrase" data-sv-meilleur={m.k}>{m.nom}{m.site && m.site !== m.nom ? ` (${m.site})` : ''} vend le plus</p>;
                  return comptes.length > 1 ? <p className="vrm-sv-note" data-sv-pas-conclu-compte="">Moins de {SEUIL_CONCLUSION} ventes ou égalité : pas de « meilleur compte ».</p> : null; })()}
                {comptes.slice(0, 6).map((c) => (
                  <div key={c.k} className="vrm-sv-ligne-compte" data-sv-compte={c.k} data-n={c.n} data-mediane={c.mediane == null ? '' : c.mediane}>
                    <span className="vrm-sv-nom">{c.nom}{c.site && c.site !== c.nom ? <span className="vrm-sv-site"> ({c.site})</span> : null}</span>
                    <span className="vrm-sv-n">{pl(c.n, 'vente')}{(() => {
                      // Un site à plusieurs comptes (deux Leboncoin) n'a qu'un brut commun : rien n'est
                      // attribué à un compte qui ne le porte pas (aucune ligne plutôt qu'un faux).
                      if (!brutComptes || (c.plat !== 'Vinted' && comptes.filter((x) => x.plat === c.plat).length > 1)) return null;
                      const bc = brutComptes[cleBrutCompte(c.plat, c.k.split('|').slice(1).join('|'))];
                      const v = bc && bc.brut != null ? bc.brut : null;
                      return <span className="vrm-sv-brut-compte" data-benef-notion="brut" data-benef-valeur={v == null ? '' : String(Math.round(v * 100))} data-sv-brut-couv={bc ? `${bc.nCout}/${bc.n}` : '0/0'} title={bc ? `${NOM_BENEFICE_BRUT} : ventes finalisées au prix d’achat connu, ${bc.nCout} sur ${bc.n}` : 'aucune vente finalisée sur la période'}>brut {v == null ? '—' : fmt(v)}{bc && bc.n && bc.nCout < bc.n ? ` · ${bc.nCout} sur ${bc.n}` : ''}</span>; })()}</span>
                    <span className="vrm-sv-chiffre" title={c.plat === 'Vinted' ? (c.mediane == null ? 'aucune vente datée' : `délai médian, sur ${pl(c.nDelai, 'vente datée', 'ventes datées')}`) : 'pas de date de mise en ligne sur cette plateforme'}>{jours(c.mediane)}</span>
                  </div>
                ))}
                {comptes.length > 6 && <div className="vrm-sv-note">+ {pl(comptes.length - 6, 'autre compte', 'autres comptes')}</div>}
              </div>
            ), { 'data-sv-carte': 'comptes' })}
      </div>
      {/* (3 nov.) « Ce qui rapporte le plus » : le relevé de la période, classé (src/ceQuiRapporte.js). */}
      <CeQuiRapporte lignes={lp} Segmente={Segmente} fmt={fmt} etat={!releve ? 'passu' : 'encours'}/>
      {/* (10 nov., lot BG) « D'où viennent mes achats » : lu dans `vrm_sources_ventes` (src/sourceAchats.js), sur la période. */}
      <SourcesAchats owner={(AUTH.user && AUTH.user.id) || ''} de={b.de} a={b.a}/>
      {/* (10 nov., lot BM) « Vitesse d'envoi » : lu dans `vrm_vitesse_envoi` (src/vitesseEnvoi.js), 30 jours. */}
      <VitesseEnvoi owner={(AUTH.user && AUTH.user.id) || ''}/>
      {/* (10 nov., lot I) « Marge par plateforme » : vendu de `venduLignes`, bénéfice du relevé de Ventes (src/margePlateforme.js). */}
      <MargePlateforme liveStats={liveStats} releve={lp} de={b.de} a={b.a} onSaisirPrix={onSaisirPrix} lireLignesSites={lireLignesSitesMarge}/>
      {/* (11 nov., lot stats-categories) « Par catégorie » : seulement si DEUX familles sont connues (src/statsCategories.js). */}
      <ParCategorie vendu={Array.isArray(vendu) ? vendu.filter(dansP) : vendu} lp={lp} extras={extras} stock={stock} b={b}/>
      {/* (4 nov.) Les offres de la période, par compte (src/statsOffres.js). */}
      <div ref={refOffres}><CarteOffres S={offres} etat={offresBrut === undefined || vendu === undefined ? 'encours' : 'passu'} fmt={fmt} nomDe={nomCompteOffres}/></div>
      <div className="vrm-sv-rangee vrm-sv-rangee-2">
        {carte('sv-tailles', 'Les tailles qui se vendent', tailles && tailles.groupes.length ? 'ventes · jours pour vendre' : null, !lignes
          ? vide('Pas encore calculé', { 'data-sv-etat': 'passu' })
          : !tailles ? vide('Je lis tes annonces…', { 'data-sv-etat': 'encours' })
            : !tailles.groupes.length ? vide(tailles.n ? `Aucune taille connue sur ${pl(tailles.n, 'vente finalisée', 'ventes finalisées')}.` : 'Aucune vente finalisée sur la période.', { 'data-sv-etat': 'lu' })
              : (
                <div className="vrm-sv-lignes" data-sv-etat="lu" data-sv-plus={tailles.plus}>
                  {tailles.groupes.map((g) => (
                    <div key={g.k} className="vrm-sv-ligne-taille" data-sv-taille={g.k} data-n={g.n} data-mediane={g.mediane == null ? '' : g.mediane}>
                      <span className="vrm-display vrm-sv-taille">{g.k}</span>
                      <span className="vrm-sv-piste vrm-sv-piste-epaisse"><span data-plus={g.k === tailles.plus ? '1' : undefined} style={{ width: `${Math.max(3, g.n / maxTaille * 100)}%` }}/></span>
                      <span className="vrm-sv-chiffre">{pl(g.n, 'vente')} · {jours(g.mediane)}</span>
                    </div>
                  ))}
                  {tailles.sansTaille > 0 && <div className="vrm-sv-note">{pl(tailles.sansTaille, 'vente')} sans taille connue.</div>}
                </div>
              ), { 'data-sv-carte': 'tailles' })}
        {(() => {
          // (3 nov.) UNE carte « Boost rentable ? » (l'ancienne carte du volet replié
          // est retirée) : boostés contre non boostés du même modèle sûr, mis en
          // ligne sur la période ; couverture dite ; moins de 3 boostés ⇒ rien de comparé.
          const etat = boost == null ? (Array.isArray(ventesCoque) || ventesCoque === null || (extras && extras.items == null) ? 'passu' : 'encours') : boost.etat !== 'lu' ? 'passu' : boost.assez ? 'lu' : 'pas-assez';
          const C2 = boost && boost.etat === 'lu' ? boost.comparables : null;
          const droite = C2 ? `${pl(C2.b, 'boosté')} · ${pl(C2.nb, 'autre')}` : null;
          const pct = (t) => `${Math.round(t * 100)}\u00a0%`;
          const ligneB = (k, lib, vb, vnb, dv) => (
            <div className="vrm-sv-boost-ligne" data-sv-boost={k} data-v={dv} style={{ display: 'contents' }}>
              <span className="vrm-sv-tuile-lib" style={{ alignSelf: 'center' }}>{lib}</span>
              <span className="vrm-display vrm-sv-boost-val" data-cote="b">{vb}</span>
              <span className="vrm-display vrm-sv-boost-val" data-cote="nb">{vnb}</span>
            </div>
          );
          const corps = etat === 'encours' ? vide('…')
            : etat === 'passu' ? vide('Tes annonces ou tes ventes ne sont pas encore lues.', { 'data-sv-boost-passu': '' })
              : etat === 'pas-assez' ? vide(`Pas assez de données · ${boost.comparables.b}/${SEUIL_BOOST} boostés`, { 'data-sv-boost-pas-assez': String(boost.comparables.b) })
                : (<>
                  <div className="vrm-sv-boost-table">
                    <span/>
                    <span className="vrm-sv-tuile-lib vrm-sv-boost-col">Boostés</span>
                    <span className="vrm-sv-tuile-lib vrm-sv-boost-col">Autres</span>
                    {ligneB('vendues', 'Vendus', `${boost.vendues.b}/${boost.vendues.nB} · ${pct(boost.vendues.tb)}`, `${boost.vendues.nb}/${boost.vendues.nN} · ${pct(boost.vendues.tnb)}`, `${boost.vendues.b}/${boost.vendues.nB}|${boost.vendues.nb}/${boost.vendues.nN}`)}
                    {ligneB('delai', 'Délai médian', jours(boost.delai.b), jours(boost.delai.nb), `${boost.delai.b == null ? '' : j10(boost.delai.b)}|${boost.delai.nb == null ? '' : j10(boost.delai.nb)}`)}
                    {ligneB('prix', 'Prix médian, boost déduit', boost.prix.b == null ? '—' : fmt(boost.prix.b), boost.prix.nb == null ? '—' : fmt(boost.prix.nb), `${cents(boost.prix.b)}|${cents(boost.prix.nb)}`)}
                  </div>
                  <div className="vrm-sv-note vrm-sv-boost-note" data-sv-boost="cout" data-v={cents(boost.cout)} data-couv={`${boost.avecMontant}/${boost.comparables.b}`}>
                    Coût des boosts : {boost.cout == null ? '—' : `${boost.avecMontant < boost.comparables.b ? 'au moins ' : ''}${fmt(boost.cout)}`} · montant saisi {boost.avecMontant}/{boost.comparables.b}
                  </div>
                </>);
          return carte('sv-boost', 'Boost rentable ?', droite, corps, { 'data-sv-carte': 'boost', 'data-sv-etat': etat, 'data-sv-boostees': C2 ? C2.b : '', 'data-sv-autres': C2 ? C2.nb : '' });
        })()}
      </div>
      <AnnulationsEtNotes b={b} panelOff={panelOff}/>
      <div className="vrm-sv-note vrm-sv-pied">
        {/* (3 nov., critique #4) Plus la phrase de définitions (« Vendu : toutes tes plateformes… ») : restent les seuls MANQUES nommés (§5). */}
        {liveStats && liveStats.venduSansDate ? `${pl(liveStats.venduSansDate, 'vente')} Leboncoin sans date` : ''}{liveStats && (liveStats.venduNonComptees || []).length ? <span data-stats-non-comptees={liveStats.venduNonComptees.length}>{`${liveStats.venduSansDate ? ' · ' : ''}Pas dans « vendu » : ${phraseNonComptees(liveStats.venduNonComptees)}`}</span> : null}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════
// (4 nov.) COMPARER DEUX MOIS — Statistiques, sous le choix de période.
// ═══════════════════════════════════════════════════════════════════════════
// Rien n'est calculé ici (src/comparerMois.js) : ventes et CA vendu = lignes de
// `ventesFaites` + `bilanLignes` ; reçu = la ligne publiée `vinted_urssaf_mois`
// (`recuPublieEntre`) ; bénéfice = `beneficeDuMoisPub` (`beneficePeriode`,
// `chiffreBenefice`). Un mois en cours se compare AU MÊME POINT. « — » = pas su.
const nomColonneMois = (ym, b, memePoint, maintenant) => {
  const [y, m] = String(ym).split('-').map(Number);
  const an = y !== new Date(maintenant).getFullYear() ? ` ${y}` : '';
  if (!memePoint) return `${MOIS_COURTS[m - 1]}${an}`;
  const fin = new Date(Math.max(b.de, b.a - 1)).getDate();
  return `1–${fin} ${MOIS_COURTS[m - 1]}${an}`;
};
const signeEur = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));
const signePct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${String(Math.abs(v)).replace('.', ',')}\u00a0%`;
// ⟦← App.jsx #17⟧
// La raison d'un « — », dite en mots (une phrase sous le tableau, jamais une infobulle seule).
const RAISONS_COMPARER = {
  absente: 'pas encore calculé : ouvre l’écran Ventes une fois',
  illisible: 'pas pu être lu',
  ancienne: 'calcul trop ancien : rouvre l’écran Ventes',
  'ancienne-app': 'calcul d’une version d’avant : rouvre l’écran Ventes',
  publication: 'pas encore calculé : ouvre l’écran Ventes une fois',
  'mois pas couvert': 'mois pas couvert par tes ventes lues',
  achats: 'il manque des prix d’achat',
  frais: 'des frais eBay ne sont pas connus',
  cotisations: 'CA déclaré pas encore calculé',
  rien: 'aucune vente finalisée ni dépense',
  pasSu: 'pas su pour l’instant',
};
const raisonComparer = (x) => {
  if (!x || x.valeur != null) return '';
  if (x.raison === 'aDater' || x.raison === 'partiel') return (x.manque || []).join(', ') || RAISONS_COMPARER.pasSu;
  return RAISONS_COMPARER[x.raison] || RAISONS_COMPARER.pasSu;
};
// (10 nov., lot BL) « COMPARER DEUX MOIS » : deux sélecteurs (le mois et celui d'en face, au choix),
// côte à côte vendu, reçu, bénéfice (couverture dite), ventes, achats ; l'écart NEUTRE (flèche
// grise, jamais rouge ni vert), et aucune flèche quand un côté est « au moins » ou « — ».
// Aucun chiffre neuf : `comparerDeuxMois` (src/comparerMois.js) avec les règles de toujours —
// achats = le registre des achats du mois (`registreAchatsDe`, la carte « Registres »).
// (11 nov., décision C11) Les annonces et ventes rangées par l'extension pour Leboncoin, eBay et
// Vestiaire : l'identifiant et le PREMIER élément seulement (jamais `select=data`, §4.4). Une
// lecture ratée ⇒ null (tous les sites montrés).
const lireLignesSitesMarge = () => lireTout('or=(id.eq.lbc_listings,id.eq.lbc_ventes,id.like.ebay_orders*,id.like.ebay_listings*,id.eq.vc_listings,id.eq.vc_ventes)&select=id,a:data->items->0,v:data->ventes->0,o:data->orders->0').catch(() => null);
const MOIS_CHOIX = 25;   // le mois en cours et les 24 d'avant (le même mois l'an dernier y est)
const ymListeComparer = (maintenant) => { const out = []; const d = new Date(maintenant); d.setDate(1); for (let i = 0; i < MOIS_CHOIX; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); } return out; };
const libelleMoisCourt = (ym, maintenant) => { const [y, m] = String(ym).split('-').map(Number); return `${MOIS_COURTS[m - 1]}${y !== new Date(maintenant).getFullYear() ? ` ${y}` : ''}`; };
const FlecheComparer = ({ sens }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className="vrm-cm-fleche" data-sens={sens}>
    {sens === 'egal' ? <path d="M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      : <path d={sens === 'hausse' ? 'M6 10V2M2.5 5.5 6 2l3.5 3.5' : 'M6 2v8M2.5 6.5 6 10l3.5-3.5'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>
);
function ComparerMoisCarte({ liveStats, panelOff = null }) {
  const lireChoix = () => { try { const o = JSON.parse(localStorage.getItem('vrm_comparer_mois') || 'null'); return o && typeof o === 'object' ? o : null; } catch (_) { return null; } };
  const maintenant = Date.now();
  const ymC = ymCourant(maintenant);
  const choixListe = ymListeComparer(maintenant);
  const [choix, setChoixB] = React.useState(() => {
    const o = lireChoix();
    const ancien = (() => { try { return localStorage.getItem('vrm_comparer_mode') === 'an' ? 'an' : 'precedent'; } catch (_) { return 'precedent'; } })();
    const a = o && choixListe.includes(o.a) ? o.a : ymC;
    const b = o && choixListe.includes(o.b) ? o.b : ymEnFace(a, ancien);
    return { a, b };
  });
  const setChoix = (k, v) => setChoixB((c) => { const n = { ...c, [k]: v }; try { localStorage.setItem('vrm_comparer_mois', JSON.stringify(n)); } catch (_) {} return n; });
  const [pub] = useLigneSynchro('vrm_benefice_jours', lireBeneficeJours);
  const [compta] = useLigneSynchro('vrm_compta', lireComptaSynchro);
  const ligneUrssaf = useLigneUrssaf();
  const regime = useRegimeFiscal();
  // Les achats : lus une fois (undefined en cours · null pas su · tableau), puis le registre de CHAQUE mois.
  // (Le registre vit avec Comptabilité : chargé à la demande, la même fonction que la carte « Registres ».)
  const [achatsLus, setAchatsLus] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    import('./Compta.jsx').then((m) => m.lireAchatsRegistre().then((a) => { if (!mort) setAchatsLus({ achats: a, registre: m.registreAchatsDe }); }))
      .catch(() => { if (!mort) setAchatsLus(null); });
    return () => { mort = true; };
  }, []);
  // (11 nov., décision C5) Les PAIRES : le nombre d'articles d'un achat Vinted en lot, lu sur SA
  // transaction (`items_count`, côté acheteur, la projection de l'écran Achats) — seulement les
  // achats des deux mois choisis. Pas lu ⇒ la règle des lots sans lui (titre « Lot 3 », lot déclaré).
  const txDesMois = React.useMemo(() => {
    if (!achatsLus || !Array.isArray(achatsLus.achats)) return '';
    const bs = [bornesMois(choix.a), bornesMois(choix.b)];
    const ids = new Set();
    for (const o of achatsLus.achats) {
      const t = Date.parse((o && o.date) || ''); if (!Number.isFinite(t) || !bs.some((b) => t >= b.de && t < b.a)) continue;
      if (o._uid && /^\d+$/.test(String(o.transaction_id || ''))) ids.add(`harvest_${o._uid}_txn_${o.transaction_id}`);
    }
    return [...ids].sort().join(',');
  }, [achatsLus, choix.a, choix.b]);
  const [nArticlesTx, setNArticlesTx] = React.useState({});
  React.useEffect(() => {
    if (!txDesMois) return undefined;
    let mort = false;
    (async () => {
      const ids = txDesMois.split(','), m = {};
      for (let i = 0; i < ids.length; i += 100) {
        const rows = await lireTout(`id=in.(${ids.slice(i, i + 100).join(',')})&select=id,side:data->payload->transaction->>user_side,nb:data->payload->transaction->>items_count`).catch(() => null);
        if (!Array.isArray(rows)) continue;
        for (const r of rows) { const tx = String((r && r.id) || '').split('_txn_')[1]; if (tx && r.side === 'buyer' && r.nb != null && Number.isInteger(Number(r.nb))) m[tx] = Number(r.nb); }
      }
      if (!mort) setNArticlesTx(m);
    })();
    return () => { mort = true; };
  }, [txDesMois]);
  const nombreDe = (l) => {
    const declares = load('vrm_lots_declares', {}) || {};
    const a = { title: l.titre, transaction_id: l.reference };
    return estLotAchat(a, { nArticlesTx, declares }) ? nombreLot(a, { nArticlesTx, declares }) : 1;
  };
  const vendu = liveStats && !liveStats.venduPasSu && Array.isArray(liveStats.venduLignes)
    ? { lignes: liveStats.venduLignes, manque: [...(liveStats.venduManque || []), ...(liveStats.venduEnAttente ? ['lecture en cours'] : [])], nonComptees: liveStats.venduNonComptees || [] } : null;
  const K = comparerDeuxMois({ ymA: choix.a, ymB: choix.b, maintenant, vendu,
    recuDe: (b) => recuAvecADater(recuPublieEntre(ligneUrssaf, b, maintenant), ligneUrssaf),
    beneficeDe: ({ ym, jusqua }) => { const B = beneficeDuMoisPub({ pub, compta, ligneUrssaf, regime }, ym, jusqua); return B ? chiffreBenefice(B, 'lu') : { valeur: null, raison: pub ? 'mois pas couvert' : 'publication' }; },
    achatsDe: ({ ym }) => (achatsLus === undefined ? undefined : achatsLus === null ? null : achatsLus.registre({ achats: achatsLus.achats, recus: [], periode: ym, panelOff })),
    nombreDe, R: { bilanLignes } });
  const colA = K ? nomColonneMois(K.ymA, K.bornes.A, K.memePoint, maintenant) : '', colB = K ? nomColonneMois(K.ymB, K.bornes.B, K.memePoint, maintenant) : '';
  const val = (x, type) => x.valeur == null ? '—' : type === 'eur' ? fmt(x.valeur) : String(x.valeur);
  const cents = (x, type) => x == null ? '' : type === 'eur' ? String(Math.round(x * 100)) : String(x);
  const nomLigne = (Lg) => (Lg.cle === 'vendu' ? L.vendu : Lg.cle === 'benefice' ? L.benefice : Lg.cle === 'recu' ? L.recu : Lg.nom);
  // Sous un chiffre : « au moins », la couverture du bénéfice (« 3/4 prix »), ou rien.
  const sous = (x, Lg) => {
    if (Lg.cle === 'benefice' && x.n > 0 && x.nCout < x.n) return `${x.nCout}/${x.n} prix`;
    // (11 nov., C5) Sous les paires : le nombre d'ACHATS, en petit.
    if (Lg.cle === 'paires' && x.achats != null) return `${x.partiel ? 'au moins · ' : ''}${x.achats} achat${x.achats > 1 ? 's' : ''}`;
    if (x.partiel) return 'au moins';
    return '';
  };
  const pourquoi = K ? K.lignes.map((Lg) => {
    const ra = raisonComparer(Lg.a), rb = raisonComparer(Lg.b);
    if (!ra && !rb) return null;
    const txt = ra && rb && ra !== rb ? `${colA} : ${ra} ; ${colB} : ${rb}` : (ra || rb);
    return { cle: Lg.cle, nom: nomLigne(Lg), txt };
  }).filter(Boolean) : [];
  const select = (k, v) => (
    <select className="vrm-cm-mois" aria-label={k === 'a' ? 'Premier mois' : 'Mois comparé'} data-comparer-mois={k} value={v} onChange={(e) => setChoix(k, e.target.value)}>
      {choixListe.map((m) => <option key={m} value={m}>{libelleMoisCourt(m, maintenant)}</option>)}
    </select>
  );
  return (
    <section className="vrm-cm" data-comparer={K ? K.mode : 'aucun'} data-comparer-a={choix.a} data-comparer-b={choix.b} data-comparer-meme-point={K && K.memePoint ? '1' : '0'}>
      <div className="vrm-cm-tete">
        <h2 className="vrm-display vrm-cm-titre" data-titre-section="">Comparer</h2>
        <div className="vrm-cm-choix">{select('a', choix.a)}<span className="vrm-cm-vs" aria-hidden="true">et</span>{select('b', choix.b)}</div>
      </div>
      {K ? <>
        <div className="vrm-cm-grille vrm-cm-cols" aria-hidden="true">
          <span/>
          <span data-comparer-col="a">{colA}</span>
          <span data-comparer-col="b">{colB}</span>
          <span>Écart</span>
        </div>
        {K.lignes.map((Lg) => (
          <div key={Lg.cle} className="vrm-cm-grille vrm-cm-ligne" data-comparer-ligne={Lg.cle} data-a={cents(Lg.a.valeur, Lg.type)} data-b={cents(Lg.b.valeur, Lg.type)} data-ecart={cents(Lg.ecart, Lg.type)} data-pct={Lg.pct == null ? '' : String(Lg.pct)} data-sens={Lg.sens || ''}
            data-a-partiel={Lg.a.partiel ? '1' : undefined} data-b-partiel={Lg.b.partiel ? '1' : undefined}
            data-a-raison={Lg.a.valeur == null ? (Lg.a.raison || 'pasSu') : undefined} data-b-raison={Lg.b.valeur == null ? (Lg.b.raison || 'pasSu') : undefined}
            data-a-achats={Lg.cle === 'paires' && Lg.a.achats != null ? String(Lg.a.achats) : undefined} data-b-achats={Lg.cle === 'paires' && Lg.b.achats != null ? String(Lg.b.achats) : undefined}>
            <span className="vrm-cm-nom">{nomLigne(Lg)}</span>
            {[Lg.a, Lg.b].map((x, i) => (
              <span key={i} className={'vrm-cm-v' + (i === 0 ? ' is-a' : '') + (x.valeur == null ? ' is-vide' : '')} title={x.partiel ? `au moins — sans ${x.manque.join(', ')}` : x.valeur == null ? raisonComparer(x) : undefined}>
                <b>{val(x, Lg.type)}</b>
                {sous(x, Lg) ? <small>{sous(x, Lg)}</small> : null}
              </span>
            ))}
            <span className={'vrm-cm-ecart' + (Lg.sens ? '' : ' is-vide')}>
              {Lg.sens ? <b><FlecheComparer sens={Lg.sens}/>{Lg.type === 'eur' ? signeEur(Lg.ecart) : (Lg.ecart > 0 ? '+' : Lg.ecart < 0 ? '−' : '') + Math.abs(Lg.ecart)}</b> : <b aria-label="pas comparable">—</b>}
              {Lg.pct != null ? <small>{signePct(Lg.pct)}</small> : null}
            </span>
          </div>
        ))}
        {pourquoi.length ? (
          <div className="vrm-cm-pourquoi" data-comparer-pourquoi="">
            {pourquoi.map((p) => <div key={p.cle} data-comparer-pourquoi-ligne={p.cle}><b>{p.nom} —</b> {p.txt}</div>)}
          </div>
        ) : null}
      </> : <p className="vrm-cm-vide" data-comparer-futur="">Un mois à venir ne se compare pas.</p>}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// (4 nov.) CE QUE COÛTE CHAQUE SITE — Statistiques, sur la période choisie.
// ═══════════════════════════════════════════════════════════════════════════
// Rien n'est calculé ici (src/fraisPlateformes.js) : le relevé de Ventes
// (`vrm_stats_ventes`, frais saisis sur les fiches), les commandes eBay
// (`totalMarketplaceFee`), les packs et options de Comptabilité. La couverture
// est dite là où le site a une commission à lire.
const lireReleveFrais = () => { try { const v = load('vrm_stats_ventes', null); return v && Array.isArray(v.l) ? v : null; } catch (_) { return null; } };
function FraisParSiteCarte({ periode, ebayCommandes }) {
  const [releve] = useLigneSynchro('vrm_stats_ventes', lireReleveFrais);
  const [compta] = useLigneSynchro('vrm_compta', lireComptaSynchro);
  const excluAutre = useExcluAutre();
  const b = bornesPeriode(periode, Date.now());
  const F = fraisParPlateforme({ releve: releve ? releve.l : null, ebay: Array.isArray(ebayCommandes) ? ebayCommandes : null, packs: compta && compta.packs, de: b.de, a: b.a, excluAutre, R: { commandeEbayEngagee } });
  if (!F.sites.length) return null;
  // (6 nov.) Aucun site lu : une ligne, pas trois rangées de « pas lu — — » (moins de cartes,
  // celles qui servent). Le geste qui la remplit est dit.
  if (F.sites.every((x) => x.passu)) return (
    <section className="vrm-frais-sites" data-frais-sites={b.type} data-frais-tous-passu="" style={{ padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px' }}>
      <h2 className="vrm-display" data-titre-section="" style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', color: C.text }}>Frais par site</h2>
      <span style={{ fontSize: 13, color: C.muted }}>Pas encore calculés : ouvre l’écran Ventes une fois.</span>
    </section>
  );
  const grille = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,96px) minmax(0,64px)', columnGap: 10, alignItems: 'center' };
  return (
    <section className="vrm-frais-sites" data-frais-sites={b.type} data-frais-total={String(Math.round(F.total * 100))} data-frais-partiel={F.partiel ? '1' : undefined}
      style={{ padding: 18, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <h2 className="vrm-display" data-titre-section="" style={{ flex: 1, margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', color: C.text }}>Frais par site</h2>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, width: 64, textAlign: 'right' }}>% vendu</span>
      </div>
      {F.sites.map((x) => {
        const cov = texteCouverture(x);
        return (
          <div key={x.plateforme} role="row" data-frais-site={x.plateforme} data-frais-eur={x.frais == null ? '' : String(Math.round(x.frais * 100))} data-frais-pct={x.pct == null ? '' : String(x.pct)}
            data-frais-lus={x.couverture ? `${x.couverture.lus}/${x.couverture.n}` : ''} data-frais-options={String(Math.round(x.options * 100))}
            title={x.options > 0 ? `dont ${fmt(x.options)} d’options et packs (${x.nOptions})` : undefined}
            style={{ ...grille, minHeight: 44, borderTop: `1px solid ${C.border}` }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: C.text }}>{x.plateforme}</span>
              <span style={{ display: 'block', fontSize: 12, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.passu ? 'pas lu' : `${x.n} vente${x.n > 1 ? 's' : ''}${cov ? ` · ${cov}` : ''}`}</span>
            </span>
            <span style={{ textAlign: 'right', fontSize: 15, fontWeight: 600, color: x.frais == null ? C.muted : C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{x.frais == null ? '—' : fmt(x.frais)}</span>
            <span style={{ textAlign: 'right', fontSize: 13, color: C.muted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{x.pct == null ? '—' : `${String(x.pct).replace('.', ',')}\u00a0%`}</span>
          </div>
        );
      })}
    </section>
  );
}
// ⟦← App.jsx #18⟧

// (8 nov., « beauté ») « Vendu par semaine » façon Santé, en tête de l'écran. Les semaines de
// `rythmeVendu` sur `liveStats.venduLignes` (la règle de « Vendu », §5) ; pas lu ⇒ rien de dessiné,
// la raison dite ; une plateforme pas lue ⇒ « au moins ».
function VenduParSemaineSante({ liveStats }) {
  const vendu = liveStats ? liveStats.venduLignes : undefined;
  const R = React.useMemo(() => (Array.isArray(vendu) ? rythmeVendu(vendu) : null), [vendu]);
  const manque = (liveStats && liveStats.venduManque) || [];
  if (!R) return (
    <section className="vrm-sante vrm-sante-vide" data-stats-carte="semaines-sante" data-sante-etat={vendu === null || (liveStats && liveStats.venduPasSu) ? 'passu' : 'encours'}>
      <div className="vrm-sante-haut"><h2 className="vrm-sante-titre">Vendu par semaine</h2></div>
      <p className="vrm-sante-note">{vendu === null || (liveStats && liveStats.venduPasSu) ? 'Tes ventes n’ont pas pu être lues : rien n’est dessiné.' : 'Je lis tes ventes…'}</p>
    </section>
  );
  return <GraphiqueSemaines semaines={R.semaines} partiel={manque.length > 0} manque={manque} fmt={fmt}/>;
}
function StatsDetaillees({ liveStats, panelOff, onVoirDorment = null }) {
  const sCarte = { padding: 18, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadow };
  const sTitre = { fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: -0.15 };
  const sLib = { fontSize: 13, color: C.muted, fontWeight: 500 };
  const sNote = { fontSize: 11, color: C.muted, lineHeight: 1.5 };
  // Un montant dans une phrase ne se coupe jamais en deux (« 31,07 » / « € »).
  const mt = (v) => <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</span>;
  const sChiffre = { fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginTop: 4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const [releve, setReleve] = React.useState(lireReleveVentes);
  const [stock, setStock] = React.useState(lireStatsStock);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vrm_stats_ventes') setReleve(lireReleveVentes()); if (k === 'vrm_stats_stock') setStock(lireStatsStock()); };
    window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f);
  }, []);
  const [extras, setExtras] = React.useState(undefined);
  React.useEffect(() => { let mort = false; lireExtrasRepartition().then((x) => { if (!mort) setExtras(x); }).catch(() => { if (!mort) setExtras({ txn: null, items: null, dates: null }); }); return () => { mort = true; }; }, []);
  const { ventes: ventesCoque } = useVentesCoque();
  const [axeMarge, setAxeMarge] = React.useState('marque');
  const [axeDelai, setAxeDelai] = React.useState('marque');

  const vendu = liveStats ? liveStats.venduLignes : undefined;
  const R = React.useMemo(() => (Array.isArray(vendu) ? rythmeVendu(vendu) : null), [vendu]);
  const Q = React.useMemo(() => (Array.isArray(vendu) ? quandTuVends(vendu) : null), [vendu]);
  const manque = (liveStats && liveStats.venduManque) || [];
  // Le relevé, avec ses clés (marque, modèle, taille) et la date de mise en
  // ligne de l'annonce reliée par la transaction (Vinted seulement).
  const lignes = React.useMemo(() => {
    if (!releve) return null;
    const x = extras || {};
    return releve.l.map((r) => {
      const [plateforme, compte, id, ts, eur, achat, frais, titre] = r;
      const t = plateforme === 'Vinted' && x.txn && id ? x.txn[String(id)] : null;
      const it = t && t.item && x.items ? x.items[t.item] : null;
      return { plateforme, compte, id, ts, eur, achat, frais, ...clesVenteStats(titre, it), enLigne: it ? dateMiseEnLigneMs(it, x.dates || null) : null };
    });
  }, [releve, extras]);
  const AXES_MARGE = { marque: 'Marque', modele: 'Modèle', taille: 'Taille', plateforme: 'Plateforme', compte: 'Compte' };
  const M = React.useMemo(() => lignes ? margesPar(lignes, (l) => axeMarge === 'compte' ? (l.plateforme === 'Vinted' ? l.compte : l.plateforme) : axeMarge === 'taille' ? (/^\d/.test(l.taille) ? `T${l.taille}` : l.taille) : l[axeMarge]) : null, [lignes, axeMarge]);
  const AXES_DELAI = { marque: 'Marque', prix: 'Prix', compte: 'Compte' };
  const Dl = React.useMemo(() => {
    if (!lignes || extras === undefined) return null;
    if (!extras || extras.items == null || extras.txn == null) return 'passu';
    return delaisPar(lignes.filter((l) => l.plateforme === 'Vinted'), (l) => axeDelai === 'prix' ? tranchePrix(l.eur) : axeDelai === 'compte' ? l.compte : l.marque);
  }, [lignes, extras, axeDelai]);
  const annul = React.useMemo(() => {
    if (!Array.isArray(ventesCoque)) return null;
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    return tauxAnnulation(ventesCoque.filter((o) => o && !compteEcarte(o._acc && o._acc.vinted_user_id, hAcc, panelOff || {})).map((o) => classifyOrderStatus(o.status)));
  }, [ventesCoque, panelOff]);
  const vint30 = Array.isArray(vendu) ? vendu.filter((l) => l.plateforme === 'Vinted' && l.ts >= minuitLocalStats(-29)).length : null;
  const vintMois = Array.isArray(vendu) ? (() => { const d = new Date(); const de = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); return vendu.filter((l) => l.plateforme === 'Vinted' && l.ts >= de).length; })() : null;
  const enLigne = stock ? stock.dort.total : null;
  const rot = rotationStock(enLigne, vint30), tauxV = tauxVenteMois(vintMois, enLigne);
  const quand = (at) => at ? new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
  const jFmt = (j) => j == null ? '—' : j < 1 ? '< 1 j' : `${Math.round(j)} j`;
  const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const fig = (lib, val, sous, attr) => (
    <div style={{ minWidth: 0 }} {...(attr || {})}>
      <div style={sLib}>{lib}</div>
      <div className="vrm-display" style={{ ...sChiffre, color: val === '—' ? C.muted : C.text }}>{val}</div>
      {sous ? <div style={{ ...sNote, marginTop: 2 }}>{sous}</div> : null}
    </div>
  );
  const grille = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '14px 18px', marginTop: 12 };
  const JOURS_C = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  const ligneTab = { display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) repeat(4, minmax(0,1fr))', gap: 8 };

  return (<>
    {/* ── 1. LE RYTHME ─────────────────────────────────────────────────── */}
    <section data-stats-carte="rythme" data-stats-rythme={R ? 'lu' : vendu === null ? 'passu' : 'encours'} style={sCarte}>
      <div style={sTitre}>Ton rythme de vente</div>
      {!R ? <div style={{ ...sNote, marginTop: 8 }}>{vendu === null ? "Tes ventes n'ont pas pu être lues : le rythme n'est pas calculé." : 'Je lis tes ventes…'}</div> : (<>
        <div style={grille}>
          {fig("Aujourd'hui", fmt(R.jour.eur), R.moyenne ? <>{pl(R.jour.n, 'vente')} · moyenne {mt(R.moyenne.eur)}/j{R.moyenne.depuisPremiere ? ` (sur ${R.moyenne.jours} j)` : ''}{ecartPct(R.jour.eur, R.moyenne.eur) != null ? ` · ${pctStat(ecartPct(R.jour.eur, R.moyenne.eur))}` : ''}</> : `${pl(R.jour.n, 'vente')} · pas encore de moyenne`, { 'data-stat-jour': Math.round(R.jour.eur * 100), 'data-stat-moyenne': R.moyenne ? Math.round(R.moyenne.eur * 100) : '' })}
          {fig('7 derniers jours', fmt(R.j7.eur), <>{pl(R.j7.n, 'vente')} · les 7 d'avant {mt(R.j7av.eur)}{ecartPct(R.j7.eur, R.j7av.eur) != null ? ` · ${pctStat(ecartPct(R.j7.eur, R.j7av.eur))}` : ''}</>, { 'data-stat-j7': Math.round(R.j7.eur * 100), 'data-stat-j7av': Math.round(R.j7av.eur * 100) })}
          {fig('Panier moyen', eurStat(R.panier30.moyen), R.panier30.n ? `sur ${pl(R.panier30.n, 'vente')} en 30 jours` : 'aucune vente en 30 jours', { 'data-stat-panier': R.panier30.moyen == null ? '' : Math.round(R.panier30.moyen * 100) })}
          {fig('Ventes par jour', R.panier30.n ? String(Math.round(R.panier30.n / 30 * 10) / 10).replace('.', ',') : '—', 'moyenne des 30 derniers jours')}
        </div>
        {/* (8 nov., « beauté ») Les 12 semaines sont en tête de l'écran (« Vendu par semaine », façon Santé). */}
        <div style={{ ...sNote, marginTop: 10 }}>{manque.length ? `Sans ${manque.join(', ')} : au moins` : ''}{liveStats && liveStats.venduSansDate ? ` ${pl(liveStats.venduSansDate, 'vente')} Leboncoin sans date : dans aucune semaine.` : ''}{liveStats && (liveStats.venduNonComptees || []).length ? ` Pas comptées (l'argent ne se lit pas) : ${phraseNonComptees(liveStats.venduNonComptees)}.` : ''}</div>
      </>)}
    </section>

    {/* ── 2. BÉNÉFICE ET MARGE PAR GROUPE ──────────────────────────────── */}
    <section data-stats-carte="marges" data-stats-marges={M ? 'lu' : 'passu'} data-stats-marges-n={M ? M.n : ''} data-stats-marges-ncout={M ? M.nCout : ''} style={sCarte}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={sTitre}>{NOM_BENEFICE_BRUT} et marge</div>
        {M && <span style={{ fontSize: 13, color: C.muted }} data-stats-marges-couverture={`${M.nCout}/${M.n}`}>sur {pl(M.nCout, 'vente')} avec prix d'achat (sur {M.n})</span>}
      </div>
      {!M ? <div style={{ ...sNote, marginTop: 8 }}>Relevé de tes ventes pas encore ici : ouvre l’écran Ventes. <Pourquoi>Il se calcule quand Ma journée ou Ventes a lu toutes tes ventes (Vinted, Leboncoin, eBay).</Pourquoi></div> : (<>
        <Segmente label={`${NOM_BENEFICE_BRUT} par`} value={axeMarge} onChange={setAxeMarge} options={Object.entries(AXES_MARGE).map(([v, l]) => ({ v, l, data: { 'data-stats-marge-axe': v } }))} style={{ marginTop: 12 }}/>
        {M.groupes.length === 0 ? <div style={{ ...sNote, marginTop: 10 }}>Aucune vente finalisée à répartir.</div> : (
          <div role="table" aria-label={`${NOM_BENEFICE_BRUT} par ${AXES_MARGE[axeMarge].toLowerCase()}`} style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
            <div role="row" style={{ ...ligneTab, fontSize: 11, color: C.muted, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
              <span role="columnheader">{AXES_MARGE[axeMarge]}</span><span role="columnheader" style={{ textAlign: 'right' }}>Ventes</span><span role="columnheader" style={{ textAlign: 'right' }}>Brut</span><span role="columnheader" style={{ textAlign: 'right' }}>Marge</span><span role="columnheader" style={{ textAlign: 'right' }}>Par article</span>
            </div>
            {M.groupes.slice(0, 8).map((g) => (
              <div role="row" key={g.k} data-stats-marge-ligne={g.k} data-n={g.n} data-ncout={g.nCout} data-brut={g.brut == null ? '' : Math.round(g.brut * 100)} data-marge={g.marge == null ? '' : g.marge}
                style={{ ...ligneTab, fontSize: 13, padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontVariantNumeric: 'tabular-nums', alignItems: 'baseline' }}>
                <span role="cell" title={g.k} style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.k}</span>
                <span role="cell" style={{ textAlign: 'right', color: C.muted }}>{g.nCout < g.n ? `${g.nCout}/${g.n}` : g.n}</span>
                <span role="cell" style={{ textAlign: 'right', color: g.brut == null ? C.muted : C.text, whiteSpace: 'nowrap' }}>{eurStat(g.brut)}</span>
                <span role="cell" style={{ textAlign: 'right', color: g.marge == null ? C.muted : C.text, whiteSpace: 'nowrap' }}>{g.marge == null ? '—' : `${String(g.marge).replace('.', ',')}\u00a0%`}</span>
                <span role="cell" style={{ textAlign: 'right', color: g.parPaire == null ? C.muted : C.text, whiteSpace: 'nowrap' }}>{eurStat(g.parPaire)}</span>
              </div>
            ))}
            {M.groupes.length > 8 && <div style={{ ...sNote, marginTop: 6 }}>+ {pl(M.groupes.length - 8, 'autre')}</div>}
          </div>
        )}
        <div style={{ ...sNote, marginTop: 10 }}>
          « 3/5 » : prix d'achat connu pour 3 ventes sur 5.{M.sansCle ? ` ${pl(M.sansCle, 'vente')} sans ${AXES_MARGE[axeMarge].toLowerCase()} connu${axeMarge === 'marque' || axeMarge === 'taille' || axeMarge === 'plateforme' ? 'e' : ''}.` : ''}{releve && releve.at ? ` Relevé du ${quand(releve.at)}.` : ''} <Pourquoi>Ventes finalisées, au jour de la vente — les mêmes que « Ton bénéfice » de Comptabilité. Bénéfice brut = vente − prix d'achat, sur les seules ventes au prix d'achat connu ; « — » quand aucun n'est connu. Frais, boosts et charges : dans Comptabilité.</Pourquoi>
        </div>
      </>)}
    </section>

    {/* ── 3. LE TEMPS DE VENTE ─────────────────────────────────────────── */}
    <section data-stats-carte="delais" data-stats-delais={Dl && Dl !== 'passu' ? 'lu' : Dl === 'passu' ? 'passu' : 'encours'} data-stats-delai-n={Dl && Dl !== 'passu' ? `${Dl.nDelai}/${Dl.n}` : ''} style={sCarte}>
      <div style={sTitre}>Temps de vente</div>
      {!Dl ? <div style={{ ...sNote, marginTop: 8 }}>{!releve ? 'Pas encore calculé' : 'Lecture…'}</div>
        : Dl === 'passu' ? <div style={{ ...sNote, marginTop: 8 }}>Tes annonces n'ont pas pu être lues : le temps de vente n'est pas calculé.</div> : (<>
        <div style={grille}>
          {fig('La moitié part en', jFmt(Dl.mediane), `médiane, sur ${pl(Dl.nDelai, 'vente datée', 'ventes datées')} (sur ${Dl.n})`, { 'data-stat-delai-mediane': Dl.mediane == null ? '' : Dl.mediane })}
          {fig('En moyenne', jFmt(Dl.moyenne), 'de la mise en ligne à la vente')}
        </div>
        <Segmente label="Temps de vente par" value={axeDelai} onChange={setAxeDelai} options={Object.entries(AXES_DELAI).map(([v, l]) => ({ v, l, data: { 'data-stats-delai-axe': v } }))} style={{ marginTop: 14 }}/>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(axeDelai === 'prix' ? TRANCHES_PRIX.map(([, , k]) => Dl.groupes.find((g) => g.k === k)).filter(Boolean) : Dl.groupes.slice(0, 8)).map((g) => {
            const maxJ = Math.max(1, ...Dl.groupes.map((x) => x.mediane || 0));
            return (
              <div key={g.k} data-stats-delai-ligne={g.k} data-mediane={g.mediane == null ? '' : g.mediane} style={{ display: 'grid', gridTemplateColumns: 'minmax(70px, 34%) 1fr auto', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.k}>{g.k}</span>
                <div style={{ height: 8, background: C.card2 || C.bg, borderRadius: 6, overflow: 'hidden' }}>{g.mediane != null && <div style={{ width: `${Math.max(4, g.mediane / maxJ * 100)}%`, height: '100%', background: C.accent, borderRadius: 4 }}/>}</div>
                <span style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}><b style={{ color: g.mediane == null ? C.muted : C.text, fontWeight: 600 }}>{jFmt(g.mediane)}</b> · {g.nDelai}/{g.n}</span>
              </div>
            );
          })}
        </div>
        <div style={{ ...sNote, marginTop: 10 }}>Vinted seulement. Médiane ; « 4/6 » = 4 ventes datées sur 6. <Pourquoi>Leboncoin et eBay ne donnent pas la date de mise en ligne. Une annonce republiée après la vente n'est pas comptée.</Pourquoi></div>
      </>)}
    </section>

    {/* ── 4. QUAND TU VENDS ────────────────────────────────────────────── */}
    {Q && Q.n > 0 && (
      <section data-stats-carte="quand" data-stats-jours={Q.jours.map((j) => j.n).join(',')} data-stats-heures-n={Q.avecHeure} style={sCarte}>
        <div style={sTitre}>Quand tu vends</div>
        <div style={{ ...sLib, marginTop: 12 }}>Par jour de la semaine</div>
        <div style={{ marginTop: 8 }}>
          <BarresStats valeurs={Q.jours.map((j) => j.n)} hauteur={72} titres={Q.jours.map((j, i) => `${JOURS_C[i]} : ${pl(j.n, 'vente')} · ${fmt(j.eur)}`)} data={{ 'aria-label': 'Ventes par jour de la semaine' }}/>
          <LegendeBarres libelles={JOURS_C}/>
        </div>
        {Q.avecHeure > 0 && <>
          <div style={{ ...sLib, marginTop: 16 }}>Par heure</div>
          <div style={{ marginTop: 8 }}>
            <BarresStats valeurs={Q.heures.map((h) => h.n)} hauteur={60} titres={Q.heures.map((h) => `${h.h} h : ${pl(h.n, 'vente')}`)} data={{ 'aria-label': 'Ventes par heure' }}/>
            <LegendeBarres libelles={Q.heures.map((h) => h.h % 6 === 0 ? `${h.h} h` : '')}/>
          </div>
        </>}
        <div style={{ ...sNote, marginTop: 10 }}>Sur {pl(Q.n, 'vente')} des 12 derniers mois, toutes plateformes{Q.sansHeure ? ` · l'heure est connue pour ${Q.avecHeure} sur ${Q.n} (une date sans heure n'est dans aucune heure)` : ''}.</div>
      </section>
    )}

    {/* ── 5. LE STOCK ──────────────────────────────────────────────────── */}
    <section data-stats-carte="dort" data-stats-dort={stock ? 'lu' : 'passu'} style={sCarte}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={sTitre}>Les articles qui dorment</div>
        {stock && <span style={{ fontSize: 13, color: C.muted }}>{pl(stock.dort.total, 'annonce')} Vinted en ligne</span>}
        {/* (3 nov.) La LISTE, avec un geste par article : l'écran Annonces (« Articles qui dorment »). */}
        {onVoirDorment && stock && (stock.dort.seuils[30] || {}).n > 0 && <button type="button" className="vrm-lien-action" data-stats-voir-dorment="" onClick={onVoirDorment} style={{ minHeight: 44 }}>Voir la liste</button>}
      </div>
      {!stock ? <div style={{ ...sNote, marginTop: 8 }}>Pas encore calculé : ouvre l’écran Annonces une fois.</div> : (<>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
          {SEUILS_DORT.map((s) => { const b = stock.dort.seuils[s] || { n: 0, valeur: 0, nCout: 0, cout: 0 }; return (
            <div key={s} data-stats-dort-seuil={s} data-n={b.n} data-valeur={Math.round(b.valeur * 100)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,0.8fr) minmax(0,1.4fr)', gap: 8, padding: '9px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontVariantNumeric: 'tabular-nums', alignItems: 'baseline' }}>
              <span style={{ color: C.text }}>En ligne depuis {s} j et plus</span>
              <span style={{ textAlign: 'right', color: C.text, fontWeight: 600 }}>{pl(b.n, 'article')}</span>
              <span style={{ textAlign: 'right', color: C.muted }}>{mt(b.valeur)} affichés{b.n ? <> · achat {b.nCout ? <>{b.nCout < b.n ? 'au moins ' : ''}{mt(b.cout)}</> : '—'}{b.nCout < b.n ? ` (${b.nCout}/${b.n})` : ''}</> : null}</span>
            </div>
          ); })}
        </div>
        <div style={grille}>
          {fig('Rotation', rot == null ? '—' : `${rot} j`, vint30 ? `au rythme de ${pl(vint30, 'vente')} Vinted en 30 jours — un repère, pas une prévision` : 'aucune vente Vinted en 30 jours', { 'data-stat-rotation': rot == null ? '' : rot })}
          {fig('Taux de vente du mois', tauxV == null ? '—' : `${tauxV}\u00a0%`, vintMois != null && enLigne != null ? `${vintMois} vendue${vintMois > 1 ? 's' : ''} ce mois sur ${vintMois + enLigne} (vendues + encore en ligne), Vinted` : 'ventes pas lues', { 'data-stat-taux-vente': tauxV == null ? '' : tauxV })}
          {fig('Annulations', annul && annul.taux != null ? `${String(annul.taux).replace('.', ',')}\u00a0%` : '—', annul ? `${annul.annulees} sur ${pl(annul.n, 'commande')} Vinted lue${annul.n > 1 ? 's' : ''}` : 'ventes pas lues', { 'data-stat-annulation': annul && annul.taux != null ? annul.taux : '' })}
        </div>
        <div style={{ ...sNote, marginTop: 10 }}>Âge connu pour {stock.dort.datesConnues} sur {stock.dort.total}{stock.dort.datesConnues < stock.dort.total ? ' — les autres ne sont dans aucune ligne' : ''}. Calculé le {quand(stock.at)}. <Pourquoi>Âge = date de mise en ligne lue sur l'annonce. Valeur = prix affichés ; coût = prix d'achat connus seulement.</Pourquoi></div>
      </>)}
    </section>
  </>);
}
function AnalysesStatistiques({panelOff}) {
 const [detail,setDetail]=React.useState(false);
 return <section className="vrm-stats-analyses" data-stats-carte="repartitions" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:18}}>
  <h3>Répartition des ventes</h3><RepartitionsVentes panelOff={panelOff} apercu/>
  <details onToggle={e=>setDetail(e.currentTarget.open)}><summary>Tailles, modèles et délais de vente</summary>{detail&&<RepartitionsVentes panelOff={panelOff}/>}</details>
 </section>;
}
// ⟦← App.jsx #19⟧
// Le bloc « Objectif du mois » de Statistiques (4 nov.) : le MÊME réglage
// (`useObjectifMois`) et la MÊME valeur que la barre de la carte sombre
// (`valeurObjectif` sur les sources de la carte) — aucune seconde somme.
// (11 nov., lot objectifs-mois) LE DÉTAIL, dans Argent : où il en est, ce qui
// reste et le rythme, ses 3 derniers mois (même règle, `valeurObjectifMois`,
// contre l'objectif qu'il avait alors), le bilan du mois passé, et le réglage
// (Vendu · Bénéfice · Ventes, « Viser … » = sa moyenne sur 3 mois).
const NOMS_MOIS_OBJ = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function ObjectifDuMois({ liveStats }) {
  const [obj, poser, brut] = useObjectifMois();
  const liveCoque = React.useContext(LiveStatsCarte);
  const sources = useSourcesCarte(liveStats || liveCoque);
  const [edit, setEdit] = React.useState(false);
  const [type, setType] = React.useState(obj ? obj.type : 'ca');
  const [saisie, setSaisie] = React.useState('');
  const prog = obj ? progressionObjectif(obj, valeurObjectif(obj, sources, REGLES_CARTE)) : null;
  const lu = lireSaisieObjectif(type, saisie);
  const eur = prog && estEuros(prog.type);
  const montre = (v) => (eur ? fmt(v) : `${v} vente${v > 1 ? 's' : ''}`);
  const montreCourt = (v) => (eur ? fmt(v) : String(v));
  const ry = prog ? rythmeObjectif(prog) : null;
  const bilan = obj || brut ? bilanObjectif(brut, sources, REGLES_CARTE) : null;
  const poserValeur = (v) => { const n = objectifAEnregistrer(brut, { type, valeur: v }); if (n) { poser(n); setEdit(false); } };
  const eurT = estEuros(type);
  // Ses 3 derniers mois, contre l'objectif EN VIGUEUR chaque mois (aucun ⇒ la valeur seule).
  const passes = obj ? moisPleinsAvant(Date.now(), 3).map((b) => {
    const x = valeurObjectifMois(obj.type, sources, REGLES_CARTE, b);
    const o = objectifDuMoisYm(brut, b.ym);
    const visait = o && o.type === obj.type ? o.valeur : null;
    return { ...b, x, visait, atteint: visait != null && x && x.valeur != null && x.valeur >= visait };
  }) : [];
  const tete = prog ? `${eur ? fmt(prog.objectif) : `${prog.objectif} ventes`} ${(TYPES_OBJECTIF[prog.type] || TYPES_OBJECTIF.ca).ceMois}` : '';
  return (
    <div data-objectif-bloc={obj ? obj.type : ''}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: prog && !edit ? 8 : 2 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{prog && !edit ? tete : 'Objectif du mois'}</div>
        <Bouton variante={edit ? 'discret' : 'secondaire'} className="vrm-b-petit" data-objectif-modifier="" onClick={() => { setType(obj ? obj.type : 'ca'); setSaisie(obj ? String(obj.valeur).replace('.', ',') : ''); setEdit((e) => !e); }}>{edit ? 'Annuler' : (obj ? 'Modifier' : 'Fixer')}</Bouton>
      </div>
      {edit ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Segmente label="Type d’objectif" value={type} onChange={setType} options={Object.entries(TYPES_OBJECTIF).map(([v, d]) => ({ v, l: d.nom, data: { 'data-objectif-type': v } }))}/>
          <PropositionObjectif type={type} sources={sources} regles={REGLES_CARTE} onViser={poserValeur}/>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input aria-label={eurT ? 'Objectif en euros' : 'Objectif en nombre de ventes'} type="text" inputMode={eurT ? 'decimal' : 'numeric'} value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={eurT ? '2 000' : '40'} data-objectif-saisie=""
              style={{ flex: 1, minWidth: 0, border: `1px solid ${C.border}`, background: C.card, color: C.text, borderRadius: 12, padding: '11px 12px', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}/>
            <span style={{ fontSize: 13, color: C.muted }}>{eurT ? '€' : 'ventes'}</span>
            <Bouton variante="primaire" disabled={lu == null} data-objectif-ok="" onClick={() => { if (lu != null) poserValeur(lu); }}>OK</Bouton>
          </div>
          {type === 'benefice' ? <div style={{ fontSize: 13, color: C.muted }}>Seules les ventes au prix d’achat connu comptent.</div> : null}
          {obj ? <Bouton variante="discret" data-objectif-retirer="" onClick={() => { poser(objectifAEnregistrer(brut, null)); setEdit(false); }} style={{ alignSelf: 'flex-start' }}>Retirer</Bouton> : null}
        </div>
      ) : prog ? (
        <div data-objectif-valeur={prog.valeur == null ? '' : (eur ? String(Math.round(prog.valeur * 100)) : String(prog.valeur))} data-objectif-pct={prog.pct == null ? '' : prog.pct} data-objectif-partiel={prog.partiel ? '1' : undefined} data-objectif-rythme={ry ? ry.etat : undefined}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, color: C.muted }}>{prog.partiel ? 'Au moins' : 'Tu en es à'}</span>
            <span className="vrm-display" style={{ fontSize: 28, fontWeight: 800, color: C.text }} title={prog.partiel ? (prog.couverture ? `Prix d’achat connu pour ${prog.couverture} ventes` : `${prog.manque.join(', ')} pas lu`) : undefined}>{prog.valeur == null ? '—' : montreCourt(prog.valeur)}</span>
          </div>
          <div role="progressbar" aria-label="Objectif du mois" aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.pct == null ? undefined : prog.pct} style={{ height: 4, background: C.card2 || C.bg, borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
            {prog.pct ? <div style={{ width: `${prog.pct}%`, height: '100%', background: C.accent, borderRadius: 999, transition: 'width .3s ease' }}/> : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 12px', marginTop: 8, fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
            <span data-objectif-detail-reste="">{phraseResteObjectif(prog, montreCourt)}</span>
            {ry ? <span data-objectif-detail-rythme={ry.etat} style={{ color: ry.etat === 'avance' ? C.text : C.muted }}>{phraseRythme(ry, prog.type, montreCourt)}</span> : null}
          </div>
          {prog.couverture ? <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }} data-objectif-couverture={prog.couverture}>Prix d’achat connu pour {prog.couverture} ventes.</div> : null}
          {passes.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }} data-objectif-passes="">
              {passes.map((m) => {
                const v = m.x && m.x.valeur != null && m.x.couvert ? m.x.valeur : null;
                return (
                  <div key={m.ym} data-objectif-passe={m.ym} data-objectif-passe-valeur={v == null ? '' : (eur ? String(Math.round(v * 100)) : String(v))} data-objectif-passe-atteint={m.atteint ? '1' : undefined} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.muted }}>{NOMS_MOIS_OBJ[Number(m.ym.slice(5)) - 1]}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: v == null ? C.muted : C.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v == null ? '—' : <>{m.x.partiel ? <span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>≥ </span> : null}{montreCourt(v)}</>}{m.atteint ? ' ✓' : ''}</div>
                    <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v == null ? (m.x && !m.x.couvert ? 'avant l’historique' : 'pas su') : m.visait != null ? `visé ${montreCourt(m.visait)}` : 'sans objectif'}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {bilan && !edit ? <div className="vrm-objectif-bilan-clair" style={{ marginTop: 12, fontSize: 13, color: C.text }}><BilanObjectif bilan={bilan} fmt={fmt} onVu={() => { const n = objectifAEnregistrer(brut, { bilanVu: bilan.ym }); if (n) poser(n); }}/></div> : null}
    </div>
  );
}
export { Dashboard };
