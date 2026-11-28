// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { lbcFloute } from '../flouCompte.js';
import { motEtatVente } from '../ventesEcran.js';
import React, { useState, useEffect, Suspense } from 'react';
import { lazySur } from '../chargementSur.js';
import { montant } from '../format.js';
import { photoArticle } from '../photosArticles.js';
import { ordreRecent, quandLeboncoin } from '../ordreRecent.js';
import Frise from '../design/Frise.jsx';
import { friseVenteLue } from '../design/friseFusion.js';
import { nomCompteVente } from '../plateformes.js';
import { AUTH, BulleConv, C, CadreFil, ComposeConv, DEPS_FACTURE, EbayAchats, EbayActionCompte, EbayMessages, FicheConvVolet, FiltresVentes, LigneConv, LigneVente, Operations, PiedSansEnvoi, REPERE_MIN, RapidesConv, SEL_EBAY_ANNONCES, ScreenHead, THEMES, TeteFil, URL_ITEM_EBAY, aLaDemande, authRefresh, authValid, compteEcarte, compteVenteLbc, exemplesActuels, extractModel, ficheUniqueDuNumero, fmt, idCompteLbcApp, lbcAnnoncesSession, lbcAnnulee, lbcExpediee, lbcFinalisee, lireDatesLbc, lireEbayTous, load, moyennesParModele, nomCompteEbay, numEbayLu, numeroLbcIdentite, prixAchatDe, rangementDuNum, reponsesRapidesPartagees, useAnnuaireLbc, useCompteLbcOuvert, useVentesCoque, useVueSession, vendActuel } from '../App.jsx';

// ⟦← App.jsx #1⟧
// ⟦→ ecrans/Comptabilite.jsx #11⟧
import FiabiliteVentes from '../FiabiliteVentes.jsx';
// ⟦← App.jsx #2⟧
// ⟦→ ecrans/Comptabilite.jsx #13⟧ // (11 nov., agent2-regroupe-comptes) lignes floutées regroupées par compte
import { TeteGroupeCompte, useDepliesComptes, ListeParCompte } from '../GroupesComptes.jsx';
// ⟦← App.jsx #3⟧   // (20 nov.) les achats Leboncoin / Vestiaire, disposition Vinted
import { BandeChiffres } from '../ui/index.js';
import { mediane } from '../alertesEbayMarge.js';
// ⟦← App.jsx #6⟧
// (6 nov., vitesse 2) RechercheEbay : à la demande ; sa règle pure `repereAdmis` vit dans repereEbay.js.
import {repereAdmis} from "../repereEbay.js";
// ⟦← App.jsx #7⟧
// ⟦→ ecrans/Comptabilite.jsx #73⟧
import { beneficeLigneVente, texteBenefice, euros as eurosLigne } from "../beneficeLigne.js";

// ⟦← App.jsx #4⟧
// ⟦→ ecrans/Vestiaire.jsx #3⟧
// ⟦→ ecrans/Compta.jsx #3⟧
const RechercheEbay = aLaDemande(() => import('../ebayRecherche.jsx'));
// (11 nov., lot alertes-ebay) « Nouvelles annonces pour tes recherches » (eBay → Achats), à la demande.
const AlertesEbay = aLaDemande(() => import('../AlertesEbay.jsx'));
// ⟦← App.jsx #5⟧
// ⟦→ ecrans/Comptabilite.jsx #42⟧
// (10 nov., lot S) La facture Pro d'une vente Leboncoin / eBay / Vestiaire, dans le détail de la vente.
const FactureAutreParesseuse = lazySur(() => import('../FactureAutres.jsx').then((m) => ({ default: m.FactureAutreVente })));
const FactureAutreVente = (props) => <Suspense fallback={null}><FactureAutreParesseuse {...props}/></Suspense>;
// (11 nov., lot lbc-plus) La remise en main propre organisée d'une vente Leboncoin (date, heure, lieu, « Remis »).
const RemiseMainPropreParesseuse = lazySur(() => import('../RemiseMainPropre.jsx'));
const RemiseMainPropre = (props) => <Suspense fallback={null}><RemiseMainPropreParesseuse {...props}/></Suspense>;
// ⟦← App.jsx #8⟧
// ⟦→ ecrans/Vestiaire.jsx #5⟧
// La même composition, passée aux écrans qui vivent hors de ce fichier (eBay → Messages, src/ebayGestion.jsx).
const COMPO_MESSAGES = { LigneConv, CadreFil, TeteFil, BulleConv, RapidesConv, ComposeConv, PiedSansEnvoi, FicheConvVolet, rapides: reponsesRapidesPartagees };
// LA FICHE D'UN ÉCHANGE eBay (1er nov.) — par IDENTITÉ seulement (§5) : l'ItemID
// que eBay rattache à l'échange, l'annonce captée de CE compte sous cet ItemID,
// et le N° que porte SON SKU `VRM-{n°}` (ou le lien posé à la main), lu par
// `numEbayLu` (la règle de l'écran eBay, §11 : un N° douteux ne désigne personne).
// Sans ItemID : `null` ⇒ « Pas reliée ».
const paireEbayDe = (m, annonces, compteNom) => {
  const id = m && m.itemId != null ? String(m.itemId).trim() : '';
  if (!/^\d{1,19}$/.test(id)) return null;
  const a = annonces ? annonces.get(id) || null : null;
  const num = numEbayLu(a && a.sku, id, null, a && a.depuis) || '';
  const p = a && a.price != null && a.price !== '' ? Number(String(a.price).replace(',', '.')) : NaN;
  const obs = a && Number.isInteger(a.observateurs) ? a.observateurs : null;
  return { item: id, num, photo: a && /^https:\/\//.test(String(a.photo || '')) ? a.photo : null, titre: (a && a.title) || (m.titre || ''),
    // Le prix de l'annonce dans SA devise (affiché, jamais converti ni compté, §5).
    sous: [Number.isFinite(p) && p > 0 ? `${p.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(p) ? 0 : 2, maximumFractionDigits: 2 })} ${!a.currency || a.currency === 'EUR' ? '€' : a.currency}` : null, 'eBay', compteNom || null],
    blocs: [{ cle: 'rangement', lib: 'Rangée', val: rangementDuNum(num) }, { cle: 'attention', lib: 'Attention', val: obs != null ? `${obs} observateur${obs > 1 ? 's' : ''}` : null }],
    lien: URL_ITEM_EBAY(id) ? { href: URL_ITEM_EBAY(id), texte: 'Voir l’annonce sur eBay ↗' } : null };
};
// Messages · eBay en volets : les annonces de CE compte (lecture projetée, §4.4),
// puis l'écran d'avant (src/ebayGestion.jsx) avec la composition partagée.
function EbayMessagesVolets({ compte, comptesEbay, ...p }) {
  const [annonces, setAnnonces] = React.useState(null);   // Map ItemID → annonce · null pas encore lu / pas su
  React.useEffect(() => { let vivant = true; (async () => {
    let r = null; try { r = await lireEbayTous('ebay_listings', SEL_EBAY_ANNONCES, 'items', Array.isArray(comptesEbay) ? comptesEbay : undefined); } catch (_) { r = null; }
    if (!vivant || !r) return;
    const m = new Map(); for (const a of r.items || []) { if (a && a.itemId != null && (a._compte || 'principal') === (compte || 'principal') && !m.has(String(a.itemId))) m.set(String(a.itemId), a); }
    setAnnonces(m);
  })(); return () => { vivant = false; }; }, [compte, comptesEbay]);
  const nom = Array.isArray(comptesEbay) && comptesEbay.length >= 2 ? nomCompteEbay(comptesEbay.find((c) => c.ref === compte)) : '';
  return <EbayMessages {...p} compte={compte} compo={COMPO_MESSAGES} paireDe={(m) => paireEbayDe(m, annonces, nom)}/>;
}
// ⟦← App.jsx #9⟧
// Carte d'une transaction Leboncoin — comme Vinted : photo · titre · statut +
// transporteur · prix. Partagée par Ventes ET Achats (§11 : une seule forme).
function CarteLbc({ o, num = '', benef = null, floute = false, compte = undefined }) {
  // (29 oct., Julien : « côté vente, fais les mêmes modifications que pour
  // Vinted ; enlève N° ») Le titre d'une vente est celui de l'annonce, sans N° :
  // le N° (identité stricte, §5) reste dans le tiroir (« Fiche article N°… »),
  // le bénéfice en meta. Rien n'est affiché qui ne soit connu (jamais 0).
  const titre = o.title || '';
  // (27 oct., « pareil que Vinted ») La ligne repliée dit QUAND (la date de
  // VENTE relevée, jamais `at` = heure de capture) et PAR QUOI elle part ;
  // l'étape qui demande un geste (colis à envoyer) passe en ambre.
  const dv = Date.parse(o.dateVente || '');
  const sous = [isNaN(dv) ? '' : new Date(dv).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(new Date(dv).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }), o.deliveryLabel || ''].filter(Boolean).join(' · ');
  // « À envoyer » = la règle de l'onglet Colis (vente prouvée, ni annulée, ni
  // finalisée, pas encore partie) — jamais une lecture du libellé (§11).
  const aLabel = !!(o.label && (o.label.voucherUrl || o.label.qrUrl || o.label.reference));
  const ton = lbcAnnulee(o) ? 'annule' : ((o.isSeller === true || (o.isSeller !== false && aLabel)) && !lbcFinalisee(o) && !lbcExpediee(o) && !((load('vrm_lbc_colis_done', {}) || {})[o.txId]) ? 'action' : '');
  // (28 oct.) L'état de la LIGNE dit la règle qui compte la vente (§11) :
  // « Paiement effectué » (l'étape brute de Leboncoin) s'affichait — coupé à
  // 390 px — sur une vente que les totaux comptent finalisée. L'étape brute
  // reste dans le détail.
  const etatCourt = lbcAnnulee(o) ? 'Annulée' : lbcFinalisee(o) ? 'Finalisée' : ton === 'action' ? 'À envoyer' : lbcExpediee(o) ? 'En transit' : (o.stepLabel || o.stepStatus || '');
  // (3 nov., critique #3) La frise de Vinted, sur ce que l'extension a LU de la transaction :
  // « Postée » = expédiée, « Livrée » et « Payée » = finalisée (Leboncoin verse à la finalisation).
  const friseLbc = lbcAnnulee(o) ? null : <Frise etapes={friseVenteLue({ vendue: true, postee: lbcExpediee(o) || lbcFinalisee(o), livree: lbcFinalisee(o), payee: lbcFinalisee(o) }, { geste: ton === 'action' })} cle={'lbc' + o.txId} className="vrm-fu-ligne-frise" label="Où en est la vente"/>;
  return <LigneVente frise={friseLbc} numerosArticle={num?[num]:[]} plateforme="leboncoin" data={{ 'data-lbc-vente': String(o.txId), 'data-lbc-etat': etatCourt, 'data-flou': floute ? '1' : '0' }} floute={floute} photo={photoArticle(o)} titre={titre} sous={sous} compte={compte} ton={ton} montant={montant(o.price != null && String(o.price).trim() !== '' ? Number(o.price) / 100 : null)} etat={motEtatVente(etatCourt)}
    suite={o.isSeller === true ? <><RemiseMainPropre o={o} num={num} eligible={!lbcAnnulee(o) && !lbcExpediee(o) && (!lbcFinalisee(o) || /main propre/i.test(String(o.deliveryLabel || '')))}/><FactureAutreVente plateforme="leboncoin" vente={o} deps={DEPS_FACTURE}/></> : null}
    meta={<>{o.stepLabel || o.stepStatus || ''}{o.deliveryLabel ? ` · ${o.deliveryLabel}` : ''}{benef != null ? <span data-lbc-benef={benef.toFixed(2)} style={{ color: benef >= 0 ? C.text : C.warn, fontWeight: 600 }}> · marge avant frais {fmt(benef)}</span> : null}</>}/>;
}
// ⟦← App.jsx #10⟧
// Résumé COMPACT d'une plateforme, toujours visible en haut de son onglet —
// la même forme que `VintedResume` (Julien : « eBay et Leboncoin comme Vinted :
// le résumé en haut, puis Ventes / Achats / Annonces, pas d'Aperçu »).
// Une valeur inconnue s'écrit « — », jamais 0 (§7).
function PlatResume({ cases, note, dark, baseKO }) {
  if (baseKO) return null;   // la coque dit déjà la panne (§7)
  // (14 nov., refonte visible — AJOUT 3) Plus de repli « Chiffres » ni de carte encadrée en tête des sites :
  // UNE bande de chiffres (src/ui/BandeChiffres, ≤ 72 px, sur le fond de la page). Un montant PAS SU
  // n'a pas de case (jamais une carte « — ») ; la note (un compte illisible) reste, en une ligne.
  // Les valeurs sont celles d'avant (`cases`, calculées par l'écran) : rien de recalculé.
  const items = (cases || []).map(([lib, val], i) => ({ cle: 'c' + i, n: val == null ? null : val, l: lib }));
  if (!items.some((x) => x.n != null) && !note) return null;
  return (
    <div className="vrm-pf-resume" data-plat-resume="1" data-plat-resume-dark={dark ? '1' : undefined}>
      <BandeChiffres items={items}/>
      {note && <div className="vrm-pf-note" style={{ color: C.muted }}>{note}</div>}
    </div>
  );
}
function VentesLeboncoin({ lbcVentes = {ventes:[],inconnues:0}, sansTotaux = false }) {
  const [filtre,setFiltre]=useVueSession('leboncoin-ventes-filtre','all');
  const [recherche,setRecherche]=useVueSession('leboncoin-ventes-recherche','');
  const ventes=lbcVentes.ventes || [];
  // (31 oct.) Le compte Leboncoin OUVERT mis en avant, les autres estompés (§11).
  const lbcOuvert = useCompteLbcOuvert();
  // (9 nov., soir, lot AJ) La plus récente en haut, TOUS COMPTES MÉLANGÉS (date de vente lue, sinon la date
  // relevée par l'extension ou datée à la main) ; sans date en bas — la règle unique (src/ordreRecent.js).
  const datesLbcV = React.useMemo(() => lireDatesLbc(), [lbcVentes]);
  const visibles=ordreRecent(ventes.filter(o=>(!recherche || String(o.title || '').toLowerCase().includes(recherche.toLowerCase()))
    && (filtre==='all' || (filtre==='cancelled'?lbcAnnulee(o):filtre==='done'?lbcFinalisee(o):!lbcAnnulee(o)&&!lbcFinalisee(o)))), (o) => quandLeboncoin(o, datesLbcV));
  // ── BÉNÉFICE PAR VENTE (parité Vinted/eBay, 26 oct.) ──────────────────────
  // N° et bénéfice par IDENTITÉ seulement (§5) : `numeroLbcIdentite` (lien posé
  // à la main > référence VRM de l'annonce, '' si ambigu), puis le prix d'achat
  // SAISI de cette paire (`vinted_buyprice_by_num`, via `prixAchatDe` — la MÊME
  // source que Vinted/eBay, §11). Prix d'achat inconnu ⇒ pas de bénéfice (jamais
  // 0 : un total partiel présenté comme complet est pire qu'un absent).
  const liens = React.useMemo(() => load('vrm_lbc_liens', {}) || {}, [lbcVentes]);
  const buyByNum = React.useMemo(() => load('vinted_buyprice_by_num', {}) || {}, [lbcVentes]);
  const numerosFiches = React.useMemo(() => load('vinted_annonce_numeros', {}) || {}, [lbcVentes]);
  // La carte des annonces LBC donne la réf VRM ; en l'attendant, `null` ⇒ le
  // lien posé à la main suffit déjà (c'est l'identité la plus forte).
  const [itemsLbc, setItemsLbc] = useState(null);
  useEffect(() => { let m = false; lbcAnnoncesSession().then((it) => { if (!m) setItemsLbc(it || null); }).catch(() => {}); return () => { m = true; }; }, []);
  // (5 nov.) Les noms de ses comptes Leboncoin, pour écrire le compte sur chaque vente.
  const annLbc = useAnnuaireLbc();
  const infoVente = (o) => {
    const num = numeroLbcIdentite(o, itemsLbc, liens);
    const prix = o.price != null ? Number(o.price) / 100 : null;
    // ⚠️ BÉNÉFICE SEULEMENT SI UNE SEULE FICHE PORTE CE N° (revue du 26 oct.,
    //    §11) — le MÊME garde que le total de la compta (`ficheUniqueDuNumero`
    //    → `achatDuNum`). Mesuré : 13 N° hérités d'août sont portés par
    //    plusieurs fiches à des prix d'achat différents ; `buyByNum[num]` n'en
    //    garde qu'UN (arbitraire). La carte montrait alors un bénéfice que le
    //    total disait « inconnu » : un chiffre d'argent faux présenté comme
    //    certain. Le N° reste affiché (l'identité de la vente est connue) ;
    //    seul le bénéfice est tu quand le coût est ambigu.
    const fiche = num ? ficheUniqueDuNumero(numerosFiches, num) : null;
    // (11 nov., famille « une règle par notion ») la règle de la ligne (`beneficeLigneVente` → `beneficePaire`) :
    //    le prix d'achat de LA fiche (puis son miroir), moins les frais saisis — la même que le total.
    const r = fiche && prix != null ? beneficeLigneVente(prix, { ...fiche, buyPrice: prixAchatDe(fiche, buyByNum) }, { annulee: lbcAnnulee(o) }) : null;
    const achat = r ? r.achat : null;
    const benef = r ? r.benefice : null;
    return { num, benef, achat, compte: compteVenteLbc(o, itemsLbc, annLbc) };
  };
  return <div>
    <ScreenHead icon="cash" title="Ventes"/>
    <FiltresVentes plateforme="leboncoin" value={filtre} onChange={setFiltre} search={recherche} onSearch={setRecherche} count={visibles.length} cancelled/>
    <FiabiliteVentes perimetre="Leboncoin · ventes finalisées" lignes={visibles.map(o=>{const info=infoVente(o);return {incluse:lbcFinalisee(o)&&!lbcAnnulee(o),achatConnu:info.achat!=null,prixConnu:o.price!=null&&String(o.price).trim()!==''&&Number.isFinite(Number(o.price)),valide:info.benef!=null,fraisSuivis:false};})}/>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}><ListeParCompte lignes={visibles} ouvert={lbcOuvert} floute={(o)=>lbcFloute(lbcOuvert, o.account)} compteDe={(o)=>idCompteLbcApp(o.account)} unite="vente" libelle="Compte ouvert sur Leboncoin" nomDe={(id)=>nomCompteLbcGroupe(annLbc, id)}
      rendre={(o)=><CarteLbc key={o.txId} o={o} {...infoVente(o)} floute={lbcFloute(lbcOuvert, o.account)}/>}/></div>
    {!visibles.length && <p style={{fontSize:12,color:C.muted,padding:'12px 0'}}>Aucune vente dans cette sélection.</p>}
    {lbcVentes.inconnues>0 && <details style={{marginTop:12,fontSize:12,color:C.muted}}><summary>Transactions à confirmer ({lbcVentes.inconnues})</summary><p>Ouvre tes transactions sur Leboncoin pour lire leur côté acheteur ou vendeur.</p></details>}
  </div>;
}
// ⟦← App.jsx #11⟧
// ⟦→ ecrans/Ebay.jsx #22⟧

// ── eBay · VENTES (commandes captées par l'API officielle) ──────────────────
// Même esprit que les Ventes Leboncoin : on rend ce qui est MESURÉ (ebay_orders),
// jamais un chiffre inventé. Skin eBay (noir). La place de la photo est réservée.
// ── eBAY → ACHATS (29 octobre) : la recherche et le fil, puis les achats
// gagnés, repliés. Le repère de revente est celui du MODÈLE, calculé par LA
// règle `moyennesParModele` sur ses ventes Vinted (comptes écartés exclus,
// §11) — dit « le modèle, pas cette paire ». Ventes pas lues ⇒ aucun repère.
// (30 oct., revue) La session du fil eBay : au réveil, attendre le renouvellement
// en cours plutôt que d'envoyer un jeton expiré ; sur un 401, renouveler puis
// réessayer une fois. Trois états : true · false (refusé, plus de session) · null (pas su).
const SESSION_FIL_EBAY={
  prete:async()=>{ if(!AUTH.session) return true; if(authValid()) return true; return authRefresh(); },
  renouveler:()=>authRefresh(),
};
function EbayAchatsOnglet({headers,panelOff,vue,comptes,onCompte,contexte={},sansGagnes=false}){
  const {ventes}=useVentesCoque();
  const repere=React.useMemo(()=>{
    if(!Array.isArray(ventes))return null;
    const hAcc=new Set((load('vinted_accounts_hidden',[])||[]).map(String));
    const V=moyennesParModele(ventes,(o)=>compteEcarte(o&&o._acc&&o._acc.vinted_user_id,hAcc,panelOff||{}));
    // (30 oct.) Pas de repère sur une clé générique (« air max ») ni sur un accessoire
    // ou une taille enfant (« lacets », « boîte vide », « enfant ») : mieux vaut un blanc qu'un faux.
    return (titre)=>{const k=extractModel(titre);if(!repereAdmis(titre,k))return null;const e=k&&V[k];if(!e||e.n<REPERE_MIN)return null;return {modele:k,moyenne:e.s/e.n,n:e.n};};
  },[ventes,panelOff]);
  // (11 nov., lot alertes-ebay) La revente d'une recherche en alerte, à défaut de SON prix : la MÉDIANE
  // de ses ventes du modèle de la recherche (même règle que le repère : ≥ 3 ventes, jamais une clé
  // générique ni un accessoire). Ventes pas lues ⇒ undefined (« pas su »), rien ⇒ null.
  const revente=React.useMemo(()=>{
    if(!Array.isArray(ventes))return ()=>undefined;
    const hAcc=new Set((load('vinted_accounts_hidden',[])||[]).map(String));
    const V=moyennesParModele(ventes,(o)=>compteEcarte(o&&o._acc&&o._acc.vinted_user_id,hAcc,panelOff||{}));
    return (mots)=>{const k=extractModel(mots);if(!repereAdmis(mots,k))return null;const e=k&&V[k];if(!e||e.n<REPERE_MIN)return null;return {modele:k,mediane:mediane(e.prix),n:e.n};};
  },[ventes,panelOff]);
  const [gagnes,setGagnes]=React.useState(false);
  return <div style={{padding:16}} data-ebay-achats-onglet="">
    <Suspense fallback={null}><AlertesEbay headers={headers} theme={C} revente={revente} contexte={contexte}/></Suspense>
    <RechercheEbay vend={vendActuel()} exemple={exemplesActuels().achat} headers={headers} theme={C} owner={AUTH.user?.id || ''} repere={repere} session={SESSION_FIL_EBAY}/>
    <Suspense fallback={<p>Lecture des recherches…</p>}><Operations sombre={C===THEMES.dark} headers={headers} initialSection="veilles" contexteEbay/></Suspense>
    {/* Les achats GAGNÉS (WonList) : gardés, repliés — lus seulement à l'ouverture. */}
    {sansGagnes?null:<details className="vrm-repli" data-ebay-achats-gagnes="" onToggle={e=>{if(e.currentTarget.open)setGagnes(true);}} style={{marginTop:18}}>
      <summary>Tes achats gagnés sur eBay · 60 derniers jours</summary>
      {gagnes&&<div style={{paddingTop:10}}><EbayActionCompte vue={vue} comptes={comptes} onCompte={onCompte}>{ref=><EbayAchats key={'ac-'+ref} headers={headers} theme={C} compte={ref} sansTitre/>}</EbayActionCompte></div>}
    </details>}
  </div>;
}
// ⟦← App.jsx #12⟧
// (11 nov.) Le nom d'un compte Leboncoin dans l'en-tête de son groupe : la règle `nomCompteVente` (src/plateformes.js).
const nomCompteLbcGroupe = (annuaire, id) => nomCompteVente('leboncoin', { account: id }, { leboncoin: annuaire && typeof annuaire === 'object' ? annuaire : {} });
export { VentesLeboncoin, EbayMessagesVolets, EbayAchatsOnglet, PlatResume };
