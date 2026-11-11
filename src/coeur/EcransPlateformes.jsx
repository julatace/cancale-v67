// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import { suivreReceptionLeboncoin } from '../rafraichissementLeboncoin.js';
import { STYLE_FLOU, lbcFloute, vcFloute } from '../flouCompte.js';
import { souvenir } from '../memoireEcrans.js';
import { motEtatVente } from '../ventesEcran.js';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { montant } from '../format.js';
import { Numero } from '../composants/Numero.jsx';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { L, PAS_SU } from '../libelles.js';
import { numVcVente, montantRecuVc, departsVc } from '../../api/_lib/vestiaire-regle.js';
import { compteDeVente } from '../../api/_lib/comptes-exclus.js';
import { photoArticle, photosVenteVintedCandidates } from '../photosArticles.js';
import { ouExtensionIci } from '../navigateurExtension.js';
import { signaturePlan, reglePlanCourante } from '../abonnement/planVentes.js';
import { venteAutreHorsPlan } from '../../api/_lib/plan-regle.js';
import { VentesAutresHorsPlan } from '../abonnement/PlansSoloPro.jsx';
import { LogoTransporteur } from '../PastilleTransporteur.jsx';
import { transporteurDuColis } from '../transporteursVisuels.js';
import { transporteurDeVente } from '../colisEnvoyes.js';
import { ordreRecent, nbSansDate, debutSansDate, quandLeboncoin, quandVestiaire } from '../ordreRecent.js';
import Frise from '../design/Frise.jsx';
import { friseVenteLue } from '../design/friseFusion.js';
import { LogoSite } from '../SelecteurSites.jsx';
import { nomCompteVente, annuaireLbc } from '../plateformes.js';
import { AUTH, Bouton, BoutonSuivreColis, C, Card, DEPS_FACTURE, EXT_CAPACITES, FiltresVentes, INV_STATUS, Icon, LigneSansDate, LigneVente, PhotoVinted, Pourquoi, QrColis, SUPABASE_URL, ScreenHead, URL_LBC_COMPTES_FLOU, ageCourtVc, askConfirm, commandeEbayEngagee, compteEcarte, compteVenteEbay, dateCourteVc, departsCarte, etapeVente, extSait, fetchEmailBordereaux, ficheUniqueDuNumero, fmt, idCompteLbcApp, ilYaCourt, isCloudReady, lbcAnnoncesSession, lbcAnnulee, lbcEuro, lbcExpediee, lbcFinalisee, lireBaseRelue, lireDatesLbc, lireReglage, lireTout, load, nomCompteEbay, numLigneEbay, numeroLbcIdentite, numerosVcEffectifs, onCloudReady, prixAchatDe, publierATrancher, save, sbAuth, toast, useCompteLbcOuvert, useCompteVcOuvert, useVcLocal, useVueSession } from '../App.jsx';

// ⟦← App.jsx #1⟧
import FiabiliteVentes from '../FiabiliteVentes.jsx';
// ⟦← App.jsx #3⟧
import { PhotoVide } from "../composants/PhotoVide.jsx";
// ⟦← App.jsx #4⟧
// ⟦→ ecrans/Vestiaire.jsx #4⟧
// §11 : l'adresse de réception se compare avec LA forme du serveur (celle qui
// décide à qui appartient un email) — jamais une seconde normalisation ici.
import { normAdresse, ADRESSE_COLLECTRICE, estAdresseCollectrice } from "../../api/_lib/proprietaire-email.js";
// ⟦← App.jsx #5⟧
import { adressesSansCompte, comptesSansAdresse, relierAdresse, CLE_ADRESSES_ACHETEUR } from "../adressesSansCompte.js";
// ⟦← App.jsx #2⟧
// ⟦→ coeur/VueVentes.jsx #6⟧
// (10 nov., lot S) La facture Pro d'une vente Leboncoin / eBay / Vestiaire, dans le détail de la vente.
const FactureAutreParesseuse = lazy(() => import('../FactureAutres.jsx').then((m) => ({ default: m.FactureAutreVente })));
const FactureAutreVente = (props) => <Suspense fallback={null}><FactureAutreParesseuse {...props}/></Suspense>;
// ⟦← App.jsx #6⟧
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
    suite={o.isSeller === true ? <FactureAutreVente plateforme="leboncoin" vente={o} deps={DEPS_FACTURE}/> : null}
    meta={<>{o.stepLabel || o.stepStatus || ''}{o.deliveryLabel ? ` · ${o.deliveryLabel}` : ''}{benef != null ? <span data-lbc-benef={benef.toFixed(2)} style={{ color: benef >= 0 ? C.text : C.warn, fontWeight: 600 }}> · marge avant frais {fmt(benef)}</span> : null}</>}/>;
}
// L'étape d'un ACHAT Leboncoin, dans les mêmes mots et les mêmes couleurs que
// celle d'un achat Vinted (`etapeAchat`) : Annulé · Reçu · En transit · Payé.
// Elle lit ce que l'extension capte (colis, liste v3), jamais un mot deviné.
function etapeAchatLbc(o) {
  if (lbcAnnulee(o)) return { label: 'Annulé', step: 0, color: C.danger };
  if (lbcFinalisee(o)) return { label: 'Reçu', step: 4, color: INV_STATUS.online.color };
  if (lbcExpediee(o)) return { label: 'En transit', step: 2, color: C.blue || C.accent };
  const s = String(o.stepLabel || '').trim();
  return { label: s ? (s.length > 26 ? s.slice(0, 26) + '…' : s) : 'Payé', step: 1, color: C.muted };
}
// UNE LIGNE D'ACHAT, la forme de l'écran Achats Vinted (`vrm-buy-row` : photo ·
// titre + statut à pastille · prix · gestes). Partagée par les achats
// Leboncoin (et la même structure est rendue par les achats eBay) — Julien :
// « les achats Leboncoin et eBay doivent fonctionner exactement comme Vinted ».
function LigneAchat({ photo, titre, statut, meta, montant, actions, sous, attenue, data, floute = false }) {
  return (
    <div className="vrm-buy-row" {...(data || {})} style={{ opacity: attenue ? 0.55 : 1, ...(floute ? STYLE_FLOU : null) }}>
      <div className="vrm-buy-ph" style={{ background: C.card2 || C.bg }}>
        {photo ? <PhotoVinted src={photo} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="image" size={18} style={{ color: C.muted, opacity: .55 }} />}
      </div>
      <div className="vrm-buy-main">
        <div className="vrm-buy-title" style={{ color: C.text }} title={titre || ''}>{titre || '(sans titre)'}</div>
        <div className="vrm-buy-meta" style={{ color: C.muted }}>
          {statut && <span className="vrm-buy-statut" style={{ color: C.text }}><i style={{ background: statut.color }} />{statut.label}</span>}
          {meta}
        </div>
        {sous}
      </div>
      <div className="vrm-buy-price" style={{ color: C.text }}>{montant}</div>
      <div className="vrm-buy-act">{actions}</div>
    </div>
  );
}
function LigneAchatLbc({ o, floute = false }) {
  const [qr, setQr] = React.useState(false);
  const st = etapeAchatLbc(o);
  const lbl = o.label || {};
  const enCours = st.step >= 1 && st.step < 4;
  const qrUrl = enCours && /^https?:\/\//.test(String(lbl.qrUrl || '')) ? lbl.qrUrl : '';
  const suivi = enCours && /^https?:\/\//.test(String(lbl.trackingUrl || '')) ? lbl.trackingUrl : '';
  const date = o.dateVente ? new Date(o.dateVente) : null;
  return <LigneAchat data={{ 'data-lbc-achat': String(o.txId || ''), 'data-flou': floute ? '1' : '0' }} floute={floute} attenue={st.step === 0}
    photo={photoArticle(o)} titre={o.title} statut={st} montant={lbcEuro(o.price)}
    meta={<>{date && !isNaN(date) && <span style={{ whiteSpace: 'nowrap' }}>{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })}</span>}{o.deliveryLabel && <span>· {o.deliveryLabel}</span>}</>}
    sous={qr && qrUrl ? <div style={{ marginTop: 8 }}><QrColis url={qrUrl} size={120} /></div> : null}
    actions={<>
      {suivi && <a className="vrm-buy-quick" href={suivi} target="_blank" rel="noreferrer" title="Suivre le colis" aria-label="Suivre le colis" style={{ color: C.muted }}><Icon name="truck" size={16} /></a>}
      {qrUrl && <button className="vrm-icon-control vrm-buy-quick" type="button" data-lbc-achat-qr="" onClick={() => setQr(v => !v)} title="QR du colis" aria-label="QR du colis" aria-expanded={qr} style={{ color: C.warn }}><Icon name="key" size={16} /></button>}
    </>} />;
}
// ⟦← App.jsx #7⟧
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
    const achat = fiche ? prixAchatDe({ numero: num }, buyByNum) : null;
    const benef = (prix != null && achat != null && !lbcAnnulee(o)) ? prix - achat : null;
    return { num, benef, achat, compte: compteVenteLbc(o, itemsLbc, annLbc) };
  };
  return <div>
    <ScreenHead icon="cash" title="Ventes"/>
    <FiltresVentes plateforme="leboncoin" value={filtre} onChange={setFiltre} search={recherche} onSearch={setRecherche} count={visibles.length} cancelled/>
    <FiabiliteVentes perimetre="Leboncoin · ventes finalisées" lignes={visibles.map(o=>{const info=infoVente(o);return {incluse:lbcFinalisee(o)&&!lbcAnnulee(o),achatConnu:info.achat!=null,prixConnu:o.price!=null&&String(o.price).trim()!==''&&Number.isFinite(Number(o.price)),valide:info.benef!=null,fraisSuivis:false};})}/>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}>{visibles.map(o=><CarteLbc key={o.txId} o={o} {...infoVente(o)} floute={lbcFloute(lbcOuvert, o.account)}/>)}</div>
    {!visibles.length && <p style={{fontSize:12,color:C.muted,padding:'12px 0'}}>Aucune vente dans cette sélection.</p>}
    {lbcVentes.inconnues>0 && <details style={{marginTop:12,fontSize:12,color:C.muted}}><summary>Transactions à confirmer ({lbcVentes.inconnues})</summary><p>Ouvre tes transactions sur Leboncoin pour lire leur côté acheteur ou vendeur.</p></details>}
  </div>;
}
// Ses ACHATS Leboncoin — demande de Julien (29 sept.) : « ajoute les photos et
// les informations pour les achats ET les ventes ». Même donnée que les ventes
// (`lbc_ventes`, chaque transaction), côté ACHETEUR : `isSeller === false`
// (jamais déduit, §5). Même carte, même séparation « reçu / en cours » que les
// ventes — côté achat « finalisé » = colis reçu. Photo + titre + statut + prix.
function AchatsLeboncoin({ lbcVentes = { achats: [] } }) {
  const achats = (lbcVentes.achats || []);
  // (31 oct.) Le compte Leboncoin OUVERT mis en avant, les autres estompés (§11).
  const lbcOuvert = useCompteLbcOuvert();
  // (17 oct., revue) La section « Achats » est toujours dans la navigation :
  // rendre `null` laissait un écran BLANC sous le titre (vu au rendu). Une
  // liste vide a une cause, et une cause se dit — jamais lu (« — ») n'est pas
  // « aucun achat » (lu, vide).
  if (achats.length === 0) {
    const lu = !!lbcVentes.maj;
    return (
      <div data-lbc-achats-vide={lu ? 'lu' : 'jamais'} style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '14px 16px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
        {lu
          ? <>Aucun achat Leboncoin dans ta dernière lecture ({ilYaCourt(lbcVentes.maj)}).</>
          : <>Ouvre « Mes transactions » sur leboncoin.fr : tes achats arrivent.</>}
      </div>
    );
  }
  const actives = achats.filter(o => !lbcAnnulee(o));
  const recus = actives.filter(lbcFinalisee);
  const enRoute = actives.filter(o => !lbcFinalisee(o));
  const annules = achats.filter(lbcAnnulee);
  const somme = (arr) => arr.reduce((s, o) => s + (o.price != null ? Number(o.price) / 100 : 0), 0);
  const fmt2 = (n) => n.toFixed(2).replace('.', ',') + '\u00a0€';
  // (28 oct.) Le plus récent d'abord, comme les achats Vinted ; une date
  // illisible en dernier. L'année est dite quand ce n'est pas celle-ci.
  // (9 nov., soir, lot AJ) La règle unique (src/ordreRecent.js) : date d'achat lue, tous comptes mélangés.
  const tsAchat = (o) => quandLeboncoin(o);
  const Liste = ({ arr }) => <div className="vrm-buy-list" style={{ background: C.card, border: `1px solid ${C.border}`, marginTop: 6 }}>{ordreRecent(arr, tsAchat).map(o => <LigneAchatLbc key={o.txId} o={o} floute={lbcFloute(lbcOuvert, o.account)} />)}</div>;
  return (
    <div style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '12px 14px' }}>
      {/* (27 oct., « pareil que Vinted ») Plus de second titre « Achats
          Leboncoin (2) » sous l'onglet « Achats » de l'espace Leboncoin. */}
      <h2 className="vrm-sr">Achats Leboncoin</h2>
      {/* Côté achat : « Reçus » = colis arrivé · « En route » = en cours de
          livraison. Deux chiffres, deux mots, jamais mélangés (comme les ventes). */}
      {actives.length > 0 && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '2px 0 10px' }}>
          <div>
            <div className="vrm-display" style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{fmt2(somme(recus))}</div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Reçus · {recus.length}</div>
          </div>
          <div>
            <div className="vrm-display" style={{ fontSize: 20, fontWeight: 800, color: C.muted }}>{fmt2(somme(enRoute))}</div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>En route · {enRoute.length}</div>
          </div>
        </div>
      )}
      {enRoute.length > 0 && (<>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: '6px 0 0' }}>En cours de livraison ({enRoute.length})</div>
        <Liste arr={enRoute}/>
        {/* (17 oct.) OÙ ARRIVE LE CODE D'UN COLIS LEBONCOIN. Mesuré sur sa base :
            une transaction Leboncoin ne porte NI point de retrait NI code (champs
            captés : statut, transporteur, prix). Le code vient de l'e-mail du
            transporteur — qui ne dit pas de quelle plateforme vient le colis :
            il rejoint donc la liste « À retirer » des achats, comme ceux de
            Vinted. On le dit une fois, plutôt qu'un « en route » muet. */}
        {enRoute.some(o => o.deliveryLabel) && <div data-lbc-code-ou="" style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.45 }}><Pourquoi ecrit label="Où arrive le code de retrait ?">Par l’e-mail du transporteur, dans Achats → À retirer.</Pourquoi></div>}
      </>)}
      {recus.length > 0 && (<>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: '12px 0 0' }}>Reçus ({recus.length})</div>
        <Liste arr={recus}/>
      </>)}
      {annules.length > 0 && (<>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: '12px 0 0' }}>Annulés / remboursés ({annules.length})</div>
        <Liste arr={annules}/>
      </>)}
    </div>
  );
}
// ⟦← App.jsx #8⟧
// ⟦→ ecrans/Vestiaire.jsx #14⟧
// ══════════════════════════════════════════════════════════════════════════════
// VESTIAIRE COLLECTIVE : TES ACHATS (27 octobre, 5.239)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « fais pareil pour les achats Vestiaire ». L'extension lit ce que la
// page charge déjà (`vc_achats`) : jamais le panier, jamais le vendeur ni ton
// adresse. Le NOM de l'article est montré pour que tu le reconnaisses — il ne
// relie JAMAIS un achat à une paire (§5). Le montant n'entre dans aucun prix
// d'achat ni aucun total : c'est toi qui saisis tes prix d'achat (§2.5).
function AchatsVestiaire() {
  const [d, setD] = React.useState(undefined);   // undefined en cours · null pas su · objet
  const vcOuvert = useCompteVcOuvert();
  const relire = React.useCallback(async () => {
    // (1er nov.) Relue une fois sur un échec passager (`lireBaseRelue`).
    const j = await lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_achats&select=achats:data->achats,lecture:data->lecture`);
    if (!Array.isArray(j)) { setD(null); return; }
    const a = j[0] && j[0].achats;
    setD({ achats: a && typeof a === 'object' && !Array.isArray(a) ? a : null, lecture: (j[0] && j[0].lecture) || null });
  }, []);
  React.useEffect(() => { relire(); }, [relire]);
  React.useEffect(() => {
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && x.quoi === 'vestiaire') relire(); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, [relire]);
  const style = { fontSize: 13, color: C.muted, lineHeight: 1.55 };
  let corps;
  if (d === undefined) corps = <div data-vc-achats="charge" style={style}>Lecture de tes achats Vestiaire…</div>;
  else if (d === null) corps = <div data-vc-achats="pas-su" style={style}>Je n'ai pas pu lire tes achats Vestiaire (rien perdu). <button type="button" className="vrm-lien-action" data-vc-achats-relire="" onClick={() => { setD(undefined); relire(); }} style={{ background: 'none', border: 'none', color: C.accentTexte, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, padding: 0 }}>Réessayer</button></div>;
  else if (!d.achats) corps = <div data-vc-achats="jamais" style={style}>Pas encore lus : ouvre <b style={{ color: C.text }}>« Mes commandes »</b> sur Vestiaire{extSait('vcachats') === 'retard' ? <> (mise à jour en <b>{EXT_CAPACITES.vcachats}</b> d'abord)</> : ''}. Ton panier n'est jamais lu.</div>;
  else {
    // (9 nov., soir, lot AJ) le plus récent en haut, la règle unique (src/ordreRecent.js)
    const liste = ordreRecent(Object.entries(d.achats).filter(([, v]) => v && typeof v === 'object').map(([id, v]) => ({ id, ...v })), quandVestiaire);
    if (!liste.length) corps = <div data-vc-achats="vide" style={style}>Aucun achat Vestiaire lu{d.lecture && d.lecture.at ? ` (${ageCourtVc(d.lecture.at)})` : ''}. Après un achat, ouvre <b style={{ color: C.text }}>« Mes commandes »</b> sur Vestiaire.</div>;
    else corps = (
      <div data-vc-achats="lu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div data-vc-achats-resume="" style={style}>
          {liste.length} achat{liste.length > 1 ? 's' : ''} vu{liste.length > 1 ? 's' : ''}{d.lecture && !d.lecture.complet ? ' (au moins)' : ''}. Hors totaux : tes prix d'achat, tu les saisis.
        </div>
        {liste.slice(0, 30).map((v) => (
          <div key={v.id} data-vc-achat={v.id} data-vc-achat-suivi={v.suivi || ''} data-flou={vcFloute(vcOuvert, v.compte) ? '1' : '0'} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, ...(vcFloute(vcOuvert, v.compte) ? STYLE_FLOU : {}) }}>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflowWrap: 'anywhere' }}>{v.nom || 'Article sans nom lu'}</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {v.etat ? `Vestiaire : « ${v.etat} »` : 'état non dit'}{dateCourteVc(v.date) ? ` · ${dateCourteVc(v.date)}` : ''}
              {v.montant && isFinite(Number(v.montant.valeur)) ? ` · ${fmt(v.montant.valeur)}${v.montant.devise && v.montant.devise !== 'EUR' ? ' ' + v.montant.devise : ''} (« ${v.montant.cle} »)` : ''}
              {v.suivi ? ` · suivi ${v.suivi}${v.transporteur ? ' (' + v.transporteur + ')' : ''}` : ''}
            </div>
            {v.suivi ? <BoutonSuivreColis transporteur={v.transporteur} suivi={v.suivi}/> : null}
          </div>
        ))}
      </div>
    );
  }
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Tes achats Vestiaire</div>
      {corps}
    </Card>
  );
}
// ⟦← App.jsx #9⟧
// (5 nov.) LES NOMS DES COMPTES LEBONCOIN (`lbc_accounts`), pour écrire le compte
// sur chaque vente (`compteVenteLbc`). UNE lecture (la même projection que le
// flou), relue quand l'extension range du neuf (`suivreReceptionLeboncoin`),
// normalisée par `annuaireLbc` (« 8442… » et « lbc-account:8442… » = UN compte).
// `undefined` en cours · `null` pas su · objet { id: nom }. Une relecture ratée
// après une lecture réussie ne change rien (pas su ≠ aucun nom).
function useAnnuaireLbc() {
  const [a, setA] = useState(undefined);
  useEffect(() => {
    const suivi = suivreReceptionLeboncoin({ fenetre: window, document, relire: async (estActif) => {
      let rows = null; try { rows = await lireBaseRelue(URL_LBC_COMPTES_FLOU()); } catch (_) { rows = null; }
      if (!estActif()) return;
      if (Array.isArray(rows)) setA(annuaireLbc((rows[0] && rows[0].a) || {}));
      else setA((x) => (x === undefined ? null : x));
    } });
    suivi.actualiser();
    return () => suivi.arreter();
  }, []);
  return a;
}
// ⟦← App.jsx #10⟧
// (5 nov.) Le compte Leboncoin d'UNE vente, écrit sur sa ligne. Par IDENTITÉ
// seulement (§5) : le compte que l'extension a joint à la vente (la session de
// la liste « Mes transactions », `account`/`accountName`), sinon le compte de
// SON annonce (`itemId`). Le nom vient de la vente, sinon de `lbc_accounts`
// sous CET identifiant (`annuaire`, `useAnnuaireLbc`), sinon de l'annonce si
// elle porte LE MÊME compte (jamais le nom d'un compte voisin). Un identifiant
// sans nom lu ⇒ son identifiant court (« n° 8442aaaa », `nomCompteVente`) : deux
// comptes sans nom restent deux. Aucune identité ⇒ `null` (« compte Leboncoin
// non relevé »), jamais deviné. Noms en cours de lecture ⇒ `undefined` (rien
// d'écrit encore, plutôt qu'un identifiant qui changerait sous ses yeux).
const compteVenteLbc = (o, items, annuaire) => {
  if (!o) return null;
  if (o.accountName) return String(o.accountName).slice(0, 64);
  const idA = o.itemId != null ? String(o.itemId) : '';
  const ann = !idA || !items || typeof items !== 'object' ? null
    : Array.isArray(items) ? (items.find((x) => x && String(x.id ?? x.list_id ?? '') === idA) || null) : (items[idA] || null);
  const idAnn = ann ? idCompteLbcApp(ann.account || ann.lbcUser || '') : '';
  const id = idCompteLbcApp(o.account || '') || idAnn;
  if (!id) return null;
  if (annuaire === undefined) return undefined;
  const lu = annuaire && typeof annuaire === 'object' && annuaire[id] ? String(annuaire[id]) : '';
  if (lu) return lu;
  if (ann && ann.accountName && idAnn === id) return String(ann.accountName).slice(0, 64);
  return nomCompteVente('leboncoin', { account: id }, {}) || null;
};
// ⟦← App.jsx #11⟧
// (10 nov.) `ComptesARelierColis` (le bandeau « N colis de X : ses e-mails n'arrivent pas ») est retiré :
// une marque discrète sur la carte du colis (`data-colis-sans-email`), la ligne de fraîcheur dit le reste.

// ── « ADRESSE SANS COMPTE » (6 nov., vague 2, point 5) ──────────────────────
// En tête de E-mails → Relier ma boîte. La règle est dans src/adressesSansCompte.js :
// SES e-mails rangés (`email_reception_*`, l'adresse de RÉCEPTION a décidé qu'ils
// sont à lui) arrivés sur une adresse qu'aucun compte Vinted ne porte. Deux gestes,
// sur SON clic : « Relier un compte » (le registre existant `vinted_account_emails`,
// ligne `main` à son nom, une adresse = un compte) et « C'est un compte acheteur »
// (`vrm_adresses_acheteur`, réversible). Le compte n'est JAMAIS deviné.
// Lecture : deux scalaires par ligne (date, adresses), jamais `select=data` (§4.4),
// toutes les pages (`lireTout`). Pas su ⇒ `EtatPanne`, jamais « aucune ».
function AdressesSansCompte({ comptes }) {
  const [lignes, setLignes] = useState(undefined);
  const [declarees, setDeclarees] = useState(undefined);
  const [comptesEmails, setComptesEmails] = useState(() => (isCloudReady() ? (load('vinted_account_emails', {}) || {}) : undefined));
  const [acheteurs, setAcheteurs] = useState(() => load(CLE_ADRESSES_ACHETEUR, {}) || {});
  const [choix, setChoix] = useState('');
  const charger = React.useCallback(async () => {
    setLignes(undefined); setDeclarees(undefined);
    const [l, d] = await Promise.all([
      lireTout('id=like.email_reception_*&select=at:data->>at,adresses:data->adresses', { strict: true }).catch(() => null),
      lireReglage('vrm_email_owners'),
    ]);
    setLignes(Array.isArray(l) ? l : null);
    setDeclarees(d === null ? null : ((d && d.adresses) || {}));
  }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    const relire = () => { setComptesEmails(load('vinted_account_emails', {}) || {}); setAcheteurs(load(CLE_ADRESSES_ACHETEUR, {}) || {}); };
    const off = onCloudReady(relire);
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_account_emails' || k === CLE_ADRESSES_ACHETEUR) relire(); };
    window.addEventListener('vrm:save', f);
    return () => { off(); window.removeEventListener('vrm:save', f); };
  }, []);
  const liste = adressesSansCompte({ lignes, declarees, comptesEmails, acheteurs });
  // (9 nov., lot AC) « À trancher » consomme CE nombre (lu en entier seulement).
  const nSansCompte = Array.isArray(liste) ? liste.length : null;
  useEffect(() => { if (nSansCompte != null) publierATrancher('adresses-sans-compte', nSansCompte); }, [nSansCompte]);
  const libres = comptesSansAdresse(comptes, comptesEmails);
  const nomCompte = (a) => (a && (load('vinted_account_labels', {}) || {})[String(a.vinted_user_id)]) || (a && a.login) || `#${a && a.vinted_user_id}`;
  const relier = async (adresse, compte) => {
    const u = relierAdresse(comptesEmails, compte.vinted_user_id, adresse);
    if (!u) { toast('Cette adresse ou ce compte est déjà relié — change-le dans Comptes liés → Gérer.'); return; }
    const ok = await askConfirm({ title: `Relier ${adresse} à ${nomCompte(compte)} ?`, desc: `Les e-mails qui arrivent sur cette adresse seront ceux du compte ${nomCompte(compte)} (ventes, bordereaux, messages). Tu peux le changer dans Comptes liés → Gérer.`, ok: 'Relier', cancel: 'Annuler' });
    if (!ok) return;
    save('vinted_account_emails', u); setComptesEmails(u); setChoix('');
    toast(`${adresse} est reliée à ${nomCompte(compte)}.`);
  };
  const acheteur = async (adresse) => {
    const ok = await askConfirm({ title: 'C’est un compte acheteur ?', desc: `${adresse} sert à acheter : aucun compte vendeur à relier. VRM ne la signalera plus ici. Ses e-mails restent rangés comme avant.`, ok: 'Oui, acheteur', cancel: 'Annuler' });
    if (!ok) return;
    const n = { ...(load(CLE_ADRESSES_ACHETEUR, {}) || {}), [normAdresse(adresse)]: { at: new Date().toISOString() } };
    save(CLE_ADRESSES_ACHETEUR, n); setAcheteurs(n);
  };
  const annulerAcheteur = (adresse) => { const n = { ...(load(CLE_ADRESSES_ACHETEUR, {}) || {}) }; delete n[adresse]; save(CLE_ADRESSES_ACHETEUR, n); setAcheteurs(n); };
  const marquees = Object.keys(acheteurs || {});
  const jour = (d) => { const t = Date.parse(d || ''); return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''; };
  if (liste === undefined) return null;   // en cours : rien ne s'affirme, rien ne clignote
  if (liste === null) return <div className="vrm-sans-compte" data-adresses-sans-compte="pas-su"><EtatPanne compact quoi="Les adresses sans compte" raison="Tes e-mails ou tes adresses n’ont pas pu être lus. Rien n’est changé." onReessayer={charger}/></div>;
  if (!liste.length && !marquees.length) return null;
  return (
    <section className="vrm-sans-compte" data-adresses-sans-compte={liste.length} aria-label="Adresses sans compte">
      {liste.length ? <h3 className="vrm-sans-compte-entete">Adresses sans compte</h3> : null}
      {liste.map((x) => (
        <div key={x.adresse} className="vrm-sans-compte-ligne" data-adresse-sans-compte={x.adresse} data-adresse-sans-compte-n={x.n}>
          {/* (10 nov., soir) Une ligne, deux boutons (DA6) : l'adresse, « N e-mails · date », Relier · Acheteur. */}
          <span className="vrm-sans-compte-ic" aria-hidden="true">@</span>
          <div className="vrm-sans-compte-tete">
            <span className="vrm-sans-compte-adresse vrm-sensible" data-stream-type="adresse">{x.adresse}</span>
            <span className="vrm-sans-compte-titre"><span className="vrm-boite-sr">Adresse sans compte : </span>{x.n} e-mail{x.n > 1 ? 's' : ''}{x.dernier ? ` · ${jour(x.dernier)}` : ''}</span>
          </div>
          <div className="vrm-sans-compte-gestes">
            <Bouton variante="secondaire" data-relier-compte={x.adresse} aria-expanded={choix === x.adresse} onClick={() => setChoix((c) => (c === x.adresse ? '' : x.adresse))}>Relier</Bouton>
            <Bouton variante="discret" data-compte-acheteur={x.adresse} aria-label="C’est un compte acheteur" onClick={() => acheteur(x.adresse)}>Acheteur</Bouton>
          </div>
          {choix === x.adresse && (
            <div className="vrm-sans-compte-choix" data-relier-choix-liste={libres.length}>
              {libres.length
                ? <>
                    <span className="vrm-sans-compte-aide">Quel compte ?</span>
                    {libres.map((a) => <Bouton key={a.vinted_user_id} variante="secondaire" data-relier-choix={String(a.vinted_user_id)} onClick={() => relier(x.adresse, a)}>{nomCompte(a)}</Bouton>)}
                  </>
                : <span className="vrm-sans-compte-aide" data-relier-aucun="">Tous tes comptes Vinted ont déjà une adresse — change-la dans Comptes liés → Gérer.</span>}
            </div>
          )}
        </div>
      ))}
      {marquees.length > 0 && (
        <details className="vrm-sans-compte-acheteurs" data-adresses-acheteur={marquees.length}>
          <summary>{marquees.length} adresse{marquees.length > 1 ? 's' : ''} marquée{marquees.length > 1 ? 's' : ''} « compte acheteur »</summary>
          {marquees.map((a) => <div key={a} className="vrm-sans-compte-acheteur"><span className="vrm-sensible" data-stream-type="adresse">{a}</span><button type="button" className="vrm-lien-action" data-annuler-acheteur={a} onClick={() => annulerAcheteur(a)}>Annuler</button></div>)}
        </details>
      )}
    </section>
  );
}
// ⟦← App.jsx #12⟧

// ── VENTES · « TOUTES » : LA LISTE MÉLANGÉE, SANS RIEN FUSIONNER ────────────
// Chaque ligne est UNE vente lue sur SON site, sous SON identité : la
// transaction Vinted (`transaction_id`), la transaction Leboncoin (`txId`), la
// commande eBay (`orderId`), la vente Vestiaire (sa clé). Deux paires au même
// titre sur deux sites = deux lignes (§5 : jamais par ressemblance). Le N° n'est
// écrit que quand une IDENTITÉ le donne (SKU eBay, lien ou référence Leboncoin,
// référence Vestiaire) — un blanc plutôt qu'un faux.
// Les sources sont celles que la coque lit déjà, avec leurs trois états
// (`undefined` en cours · `null` pas su · lu) : un site illisible est NOMMÉ
// (« rien lu » ≠ « rien »), un compte Vinted écarté par son choix n'y entre pas
// (`compteEcarte`, la même règle que l'écran Ventes). Les montants Vestiaire ne
// sont pas écrits : on ne sait pas si c'est le prix ou ce que Vestiaire verse.
// Une ligne ouvre l'écran de SON site (une vente eBay : sa commande).
// (9 nov., Solo par plateforme) En Solo, une vente Leboncoin / eBay / Vestiaire d'un compte qui
// n'est pas le compte vendeur CHOISI de sa plateforme sort de cette liste (et des totaux,
// `useExcluAutre`) et se montre en APERÇU dessous (`VentesAutresHorsPlan`) — jamais supprimée ;
// son colis à envoyer est DIT et reste dans Colis. La règle : `venteAutreHorsPlan`
// (api/_lib/plan-regle.js) sur l'identité que la vente PORTE (`compteDeVente`).
const horsPlanAutre = (plateforme, v) => venteAutreHorsPlan(reglePlanCourante(), plateforme, compteDeVente(plateforme, v));
// ⟦← App.jsx #13⟧
function VentesToutes({ sites, ventesVinted, ventesKO, comptes, panelOff, lbcVentes, lbcLu, ebayTous, onOuvrir, onPro }) {
  // (8 nov.) Les départs prouvés chez le transporteur : la ligne d'une vente Vestiaire partie se redessine.
  const vcLocDep = useVcLocal();
  const voit = (s) => !sites || sites.has(s);
  // (9 nov., Ma journée v2 — Julien : « il manque les transporteurs à côté de chaque vente ») LE
  // TRANSPORTEUR D'UNE VENTE VINTED : par SON bordereau (le MÊME n° de transaction), la règle de Colis
  // (`transporteurDeVente`, src/colisEnvoyes.js) — le transporteur nommé dans l'e-mail du bordereau, puis
  // la forme propre de son n°. Jamais par titre ; rien lu ⇒ rien posé. Les bordereaux : ceux que Colis
  // vient de lire (mémoire de l'écran), sinon la même lecture légère (métadonnées seules, jamais le PDF).
  const [bordsT, setBordsT] = React.useState(() => souvenir('emailBords', AUTH.user?.id) || null);
  React.useEffect(() => {
    if (!voit('vinted') || bordsT) return undefined;
    let vivant = true;
    fetchEmailBordereaux().then((v) => { if (vivant && Array.isArray(v)) setBordsT(v); }).catch(() => {});
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites && sites.has('vinted')]);
  const bordTParTx = React.useMemo(() => {
    const m = {};
    for (const b of (bordsT || [])) { if (b && b.transaction && !m[String(b.transaction)]) m[String(b.transaction)] = b; }
    return m;
  }, [bordsT]);
  // (5 nov.) Le compte de CHAQUE vente, toutes plateformes (`nomCompteVente`).
  const annLbc = useAnnuaireLbc();
  const [vc, setVc] = React.useState(undefined);   // undefined en cours · null pas su · objet
  React.useEffect(() => {
    if (!voit('vestiaire')) return undefined;
    let vivant = true;
    const lire = async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=in.(vc_ventes,vc_listings)&select=id,ventes:data->ventes,liens:data->liens,lectures:data->lectures`, { headers: sbAuth() });
        if (!r.ok) throw new Error('lecture');
        const j = await r.json();
        if (!Array.isArray(j)) throw new Error('forme');
        const par = Object.fromEntries(j.map((x) => [x.id, x]));
        if (vivant) setVc({ ventes: (par.vc_ventes && par.vc_ventes.ventes) || null, liens: (par.vc_listings && par.vc_listings.liens) || {}, lectures: (par.vc_ventes && par.vc_ventes.lectures) || {} });
      } catch (_) { if (vivant) setVc(null); }
    };
    lire();
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && x.quoi === 'vestiaire') lire(); };
    window.addEventListener('vrm:ext', f);
    return () => { vivant = false; window.removeEventListener('vrm:ext', f); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites && sites.has('vestiaire')]);
  const sigPlanT = signaturePlan();
  const toutesLignes = React.useMemo(() => {
    const out = [];
    const ts = (d) => { const t = Date.parse(d || ''); return Number.isFinite(t) ? t : null; };
    const euro = (n) => (n == null || !isFinite(Number(n))) ? null : Number(n);
    if (voit('vinted') && Array.isArray(ventesVinted)) {
      const masques = new Set((load('vinted_accounts_hidden', []) || []).map(String));
      const labels = load('vinted_account_labels', {}) || {};
      const shipDone = load('vinted_ship_done', {}) || {};
      for (const o of ventesVinted) {
        const uid = String((o && o._acc && o._acc.vinted_user_id) || '');
        if (!o || compteEcarte(uid, masques, panelOff)) continue;
        const tx = String(o.transaction_id != null ? o.transaction_id : o.id);
        out.push({ cle: 'vinted:' + tx, site: 'vinted', id: tx, titre: o.title || '(sans titre)', t: ts(o.date),
          prix: euro(o.price && typeof o.price === 'object' ? o.price.amount : o.price), devise: (o.price && o.price.currency_code) || 'EUR',
          etat: etapeVente(o, { poste: (x) => !!shipDone[String(x.transaction_id)] }).label,
          compte: labels[uid] || (o._acc && o._acc.login) || '', num: '', photo: photosVenteVintedCandidates(o)[0] || null,
          tr: bordTParTx[tx] ? transporteurDeVente({ bord: bordTParTx[tx] }) : null });
      }
    }
    if (voit('leboncoin') && lbcLu === true) {
      const liens = load('vrm_lbc_liens', {}) || {};
      const dates = lireDatesLbc();
      for (const v of ((lbcVentes && lbcVentes.ventes) || [])) {
        if (!v || v.isSeller !== true || lbcAnnulee(v)) continue;
        const id = String(v.txId || v.id || v.itemId || '');
        if (!id) continue;
        out.push({ hp: horsPlanAutre('leboncoin', v) ? compteDeVente('leboncoin', v) : null, cle: 'leboncoin:' + id, site: 'leboncoin', id, titre: v.title || '(sans titre)', t: ts(v.dateVente) ?? ts(v.txId ? dates[v.txId] : null),
          prix: v.price != null ? euro(Number(v.price) / 100) : null, devise: 'EUR',
          etat: lbcFinalisee(v) ? 'Finalisée' : 'En cours', compte: compteVenteLbc(v, null, annLbc) || '', num: numeroLbcIdentite(v, null, liens), photo: photoArticle(v) || null,
          tr: transporteurDuColis({ declare: v.deliveryMethod || v.deliveryLabel || '' }) });
      }
    }
    if (voit('ebay') && ebayTous && Array.isArray(ebayTous.items)) {
      for (const c of ebayTous.items) {
        if (!c || !c.orderId) continue;
        const li = (c.lineItems || [])[0] || {};
        const st = c.pricingSummary && c.pricingSummary.priceSubtotal;
        out.push({ hp: horsPlanAutre('ebay', c) ? compteDeVente('ebay', c) : null, cle: 'ebay:' + c.orderId, site: 'ebay', id: String(c.orderId), compteRef: c._compte, titre: li.title || 'Commande eBay', t: ts(c.creationDate),
          prix: st && st.value != null ? euro(st.value) : null, devise: (st && st.currency) || 'EUR',
          etat: commandeEbayEngagee(c) ? 'Payée' : 'Annulée ou remboursée', compte: compteVenteEbay(c, null) || '', num: numLigneEbay(c, li) || '', photo: photoArticle(li) || photoArticle(c) || null });
      }
    }
    if (voit('vestiaire') && vc && vc.ventes) {
      const partisVc = departsVc({ ...vc, departs: departsCarte() });
      for (const [id, v] of Object.entries(vc.ventes)) {
        if (!v) continue;
        // (6 nov., onglets A) Le montant de la ligne = celui que « vendu » compte (`montantRecuVc`, ce que
        // Vestiaire te verse) ; pas sûr ⇒ rien d'écrit. Avant : la ligne était muette (203,23 € comptés
        // dans la carte du haut, aucun montant sur la vente).
        const recuVc = montantRecuVc(v);
        out.push({ hp: horsPlanAutre('vestiaire', v) ? compteDeVente('vestiaire', v) : null, cle: 'vestiaire:' + id, site: 'vestiaire', id, titre: v.titre || v.title || 'Vente Vestiaire', t: ts(v.date) ?? ts(v.premiereVue),
          prix: recuVc && recuVc.eur != null ? recuVc.eur : null, devise: 'EUR', etat: v.aExpedier ? (partisVc.has(String(id)) ? 'Envoyée' : L.aEnvoyer) : (v.etat || ''), compte: nomCompteVente('vestiaire', v, {}),
          num: numVcVente(v, vc.liens, numerosVcEffectifs()), photo: photoArticle(v) || null, tr: transporteurDuColis({ declare: v.transporteur || '', suivi: v.suivi || '' }) });
      }
    }
    // La plus récente d'abord, TOUS COMPTES ET SITES MÉLANGÉS ; une vente sans date lue va à la fin
    // (jamais datée au hasard). La règle unique (src/ordreRecent.js, lot AJ du 9 nov.).
    return ordreRecent(out, (l) => l.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, ventesVinted, panelOff, lbcVentes, lbcLu, ebayTous, vc, annLbc, vcLocDep.departsCle, bordTParTx, sigPlanT]);
  const lignes = React.useMemo(() => toutesLignes.filter((l) => !l.hp), [toutesLignes]);
  const lignesHorsPlan = React.useMemo(() => toutesLignes.filter((l) => l.hp), [toutesLignes]);
  // (lot AJ) Où commencent les ventes sans date lue (en bas), et combien : dit une fois.
  const sansDateT = React.useMemo(() => ({ i: debutSansDate(lignes, (x) => x.t), n: nbSansDate(lignes, (x) => x.t) }), [lignes]);
  const [n, setN] = React.useState(60);
  const NOM = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
  // Ce que chaque site a pu lire : dit UNE fois, en tête (jamais un « 0 » inventé).
  const etats = [];
  if (voit('vinted')) {
    if (ventesVinted === undefined) etats.push(['vinted', 'lecture', 'Vinted : lecture en cours…']);
    else if (ventesVinted === null) etats.push(['vinted', 'pas-su', 'Vinted : ventes pas lues — rien n’est perdu, réessaie dans un moment.']);
    // (1er nov., vendeur neuf) Aucun compte relié : ce n'est pas « aucune vente »,
    // c'est « rien lu » — le geste, comme les autres sites (« jamais lu »).
    else if (Array.isArray(comptes) && comptes.length === 0 && !(Array.isArray(ventesVinted) && ventesVinted.length)) etats.push(['vinted', 'jamais', `Vinted : aucun compte relié — installe l’extension VRM ${ouExtensionIci()}, puis ouvre vinted.fr une fois connecté.`]);
    else if (ventesKO && ventesKO.length) {
      const labels = load('vinted_account_labels', {}) || {};
      const noms = ventesKO.map((u) => labels[u] || ((comptes || []).find((a) => String(a.vinted_user_id) === String(u)) || {}).login || ('#' + u));
      etats.push(['vinted', 'partiel', `Vinted : ventes de ${noms.join(', ')} pas lues — elles manquent ici.`]);
    }
  }
  if (voit('leboncoin')) {
    if (lbcLu === undefined) etats.push(['leboncoin', 'lecture', 'Leboncoin : lecture en cours…']);
    else if (lbcLu === null) etats.push(['leboncoin', 'pas-su', 'Leboncoin : ventes pas lues — rien n’est perdu, réessaie dans un moment.']);
    else if (lbcVentes && lbcVentes.maj) etats.push(['leboncoin', 'lu', `Leboncoin : lu ${ilYaCourt(lbcVentes.maj)}.`]);
    else etats.push(['leboncoin', 'jamais', 'Leboncoin : jamais lu — ouvre « Mes transactions » sur leboncoin.fr avec l’extension.']);
  }
  if (voit('ebay')) {
    if (ebayTous === undefined) etats.push(['ebay', 'lecture', 'eBay : lecture en cours…']);
    else if (ebayTous === null) etats.push(['ebay', 'pas-su', 'eBay : commandes pas lues — rien n’est perdu, réessaie dans un moment.']);
    else if (ebayTous.illisibles && ebayTous.illisibles.length) etats.push(['ebay', 'partiel', `eBay : commandes de ${ebayTous.illisibles.map(nomCompteEbay).join(', ')} pas lues — elles manquent ici.`]);
  }
  if (voit('vestiaire')) {
    if (vc === undefined) etats.push(['vestiaire', 'lecture', 'Vestiaire : lecture en cours…']);
    else if (vc === null) etats.push(['vestiaire', 'pas-su', 'Vestiaire : ventes pas lues — rien n’est perdu, réessaie dans un moment.']);
    else if (!vc.ventes) etats.push(['vestiaire', 'jamais', 'Vestiaire : jamais lu — ouvre tes ventes sur Vestiaire avec l’extension.']);
  }
  // « aujourd'hui », « hier », sinon le jour (l'année seulement si ce n'est pas celle-ci).
  const jour = (t) => {
    if (t == null) return 'date pas lue';
    const d = new Date(t), h = new Date(); const j0 = new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime();
    if (t >= j0 && t < j0 + 86400000) return 'aujourd’hui';
    if (t >= j0 - 86400000 && t < j0) return 'hier';
    return d.toLocaleDateString('fr-FR', d.getFullYear() === h.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  // Une devise étrangère est DITE (« 12,50 GBP »), jamais convertie ; l'euro par `montant()`.
  const prix = (l) => l.prix == null ? '' : montant(l.prix, { devise: l.devise || 'EUR' });
  const enCours = etats.some((e) => e[1] === 'lecture');
  // (5 nov., revue 2.14) Ce qui n'appelle aucun geste aujourd'hui ne s'écrit plus en
  // phrases permanentes : « jamais lu » (un site pas encore ouvert avec l'extension)
  // se replie en UNE ligne, le geste dedans ; « lu il y a… » ne se redit plus (la
  // fraîcheur vit dans la coque, revue 2.30). Une lecture en cours, ratée ou partielle
  // reste écrite, en clair : elle change ce que la liste veut dire.
  const visibles = etats.filter((e) => e[1] === 'lecture' || e[1] === 'pas-su' || e[1] === 'partiel');
  const sansCompteVinted = etats.some((e) => e[0] === 'vinted' && e[1] === 'jamais');
  // Aucun compte Vinted et aucune vente : l'état vide dit déjà ce geste — le repli ne le redit pas.
  const jamais = etats.filter((e) => e[1] === 'jamais' && !(e[0] === 'vinted' && lignes.length === 0));
  const NOMS_SITES = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
  const listeNoms = (l) => l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1];
  // L'état d'une vente : le mot retenu (« À envoyer », « En route »), et l'ambre
  // seulement quand il y a un geste à faire (un colis à envoyer, §7).
  const geste = (l) => l.etat === L.aEnvoyer || motEtatVente(l.etat) === L.aEnvoyer;
  return (
    <div className="vrm-ventes-toutes" data-ventes-toutes={enCours ? 'lecture' : 'lu'} data-n={String(lignes.length)} style={{ padding: '4px 16px 16px' }}>
      {visibles.length > 0 && (
        <div className="vrm-toutes-etats" style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '4px 0 10px', fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
          {visibles.map(([s, k, txt]) => <div key={s} data-toutes-etat-site={s} data-etat={k} style={{ color: (k === 'pas-su' || k === 'partiel') ? C.warn : C.muted }}>{txt}</div>)}
        </div>
      )}
      {jamais.length > 0 && (
        <details className="vrm-toutes-repli" data-toutes-repli={jamais.map((e) => e[0]).join(',')}>
          <summary className="vrm-toutes-repli-tete"><span className="vrm-toutes-repli-txt">{listeNoms(jamais.map((e) => NOMS_SITES[e[0]] || e[0]))} : pas encore {jamais.length > 1 ? 'lus' : 'lu'}</span><span className="vrm-toutes-repli-chevron" aria-hidden="true">›</span></summary>
          <div className="vrm-toutes-repli-corps">
            {jamais.map(([s, k, txt]) => <p key={s} data-toutes-etat-site={s} data-etat={k}>{txt.replace(' : jamais lu — ', ' : ')}</p>)}
          </div>
        </details>
      )}
      {lignes.length === 0
        ? <div data-toutes-vide="" className="vrm-toutes-vide">
            {enCours ? <p>{PAS_SU.enCours}</p>
              : visibles.some((e) => e[1] === 'pas-su' || e[1] === 'partiel') ? <p>Aucune vente lue : une lecture a échoué (ci-dessus). Rien n’est perdu.</p>
              : sansCompteVinted ? <><p className="vrm-toutes-vide-titre">Tes ventes arriveront ici</p><p data-toutes-etat-site="vinted" data-etat="jamais">Vinted : aucun compte relié. Installe l’extension VRM {ouExtensionIci()}, puis ouvre vinted.fr.</p></>
              : <><p className="vrm-toutes-vide-titre">Aucune vente pour l’instant</p><p>Dès qu’un article part, il apparaît ici, sur tous tes sites.</p></>}
          </div>
        : (
          <div className="vrm-toutes-liste" role="list">
            {lignes.slice(0, n).map((l, il) => (
              <React.Fragment key={l.cle}>
              {il === sansDateT.i ? <LigneSansDate n={sansDateT.n}/> : null}
              <button type="button" role="listitem" className="vrm-toutes-ligne" data-toutes-vente={l.site} data-toutes-id={l.id} data-toutes-compte={l.compte || ''} data-ordre-t={l.t != null ? String(l.t) : ''} onClick={() => onOuvrir(l)}
                aria-label={`${l.titre} — ${NOM[l.site]}${l.compte ? ', ' + l.compte : ''}, ${jour(l.t)}${l.etat ? ', ' + motEtatVente(l.etat) : ''}${l.prix != null ? ', ' + prix(l) : ''}`}
                style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px', background: 'transparent', border: 0, borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: C.text }}>
                {/* (31 oct., Julien : « pas de photos partout ») La photo de la vente, comme sur l'écran de son site. */}
                <span className="vrm-toutes-photo" data-toutes-photo={l.photo ? '1' : '0'} aria-hidden="true" style={{ width: 64, height: 80, flexShrink: 0, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {l.photo ? <PhotoVinted src={l.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <PhotoVide remplir titre=""/>}
                </span>
                <span className="vrm-toutes-titre" aria-hidden="true" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{l.titre}</span>
                  <span className="vrm-toutes-meta" style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span data-toutes-site=""><LogoSite site={l.site}/>{NOM[l.site]}</span>{l.tr && l.tr.cle ? <span className="vrm-toutes-transp" data-toutes-transp={l.tr.cle} title={l.tr.nom || ''}> · <LogoTransporteur cle={l.tr.cle} taille={14}/></span> : null}{l.compte ? <> · <span className="vrm-sensible">{l.compte}</span></> : null} · {jour(l.t)}
                  </span>
                  {/* (5 nov., revue 2.13) L'état sur SA ligne au téléphone : jamais coupé par l'ellipse de la ligne du dessus. */}
                  {l.etat ? <span className="vrm-toutes-etat" data-toutes-etat={motEtatVente(l.etat)} data-ton={geste(l) ? 'action' : undefined}>{motEtatVente(l.etat)}</span> : null}
                </span>
                <span className="vrm-toutes-bureau" aria-hidden="true"><span><b className="vrm-toutes-bureau-site"><LogoSite site={l.site}/>{NOM[l.site]}{l.tr && l.tr.cle ? <span className="vrm-toutes-transp" title={l.tr.nom || ''}><LogoTransporteur cle={l.tr.cle} taille={16}/></span> : null}</b>{l.compte&&<small className="vrm-sensible">{l.compte}</small>}</span><span>{jour(l.t)}</span><span data-ton={geste(l) ? 'action' : undefined}>{l.etat ? motEtatVente(l.etat) : PAS_SU.vide}</span></span>
                <span className="vrm-toutes-montant" aria-hidden="true" style={{ flexShrink: 0, textAlign: 'right' }}>
                  {l.prix != null && <span data-toutes-prix="" style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{prix(l)}</span>}
                  {l.num ? <span data-toutes-num={l.num} style={{ display: 'block', marginTop: 4 }}><Numero n={l.num} taille="petit"/></span> : null}
                </span>
              </button>
              </React.Fragment>
            ))}
            {lignes.length > n && <Bouton variante="secondaire" plein data-toutes-plus="" onClick={() => React.startTransition(()=>setN((x) => x + 60))} style={{ marginTop: 12 }}>Afficher {Math.min(60,lignes.length-n) > 1 ? `les ${Math.min(60,lignes.length-n)} suivantes` : 'la suivante'}</Bouton>}
          </div>
        )}
      {/* (9 nov., Solo par plateforme) Les ventes Leboncoin / eBay / Vestiaire des comptes d'achat, en aperçu. */}
      <VentesAutresHorsPlan lignes={lignesHorsPlan.map((l) => ({ cle: l.cle, site: l.site, compteId: l.hp, compte: l.compte, titre: l.titre, prix: prix(l), aEnvoyer: geste(l) }))} onPro={onPro}/>
    </div>
  );
}
export { VentesToutes, AchatsLeboncoin, VentesLeboncoin, AchatsVestiaire, AdressesSansCompte };
