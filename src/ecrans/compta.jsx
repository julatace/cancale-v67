// ⚠️ FICHIER DÉCOUPÉ D'App.jsx (scripts/decouper-app.cjs) — chargé à la demande.
// Le code ci-dessous est celui d'App.jsx, sans changement ; ce qu'il lit d'App.jsx
// vient de l'import ci-dessous (liaisons vivantes : le thème `C` reste à jour).
import React, { useState, useMemo, useEffect } from "react";
import { etatFacturation, factureDepuisVente, pdfFacturX, nomFichierFacture, recapEReporting, recapCsv, recapJson, eurDe, frJour } from "../facturationElectronique.js";
import { lireSuperPdp, appelSuperPdp, enBase64, libelleEnvoi, ENV_LIBELLE } from "../superpdp.js";
import { Btn, C, COMPTA_DEFAUT, Card, DEMANDE_SAISIE_PRIX, EXT_CAPACITES, FermeAuRetour, Icon, IconeReglage, Input, MOIS_COMPTA, PRIX_CGV_LISIBLE, REGLAGE_PAS_LU, SB_CONFLICT, SUPABASE_URL, ScreenHead, Segmente, TAUX_URSSAF_DEFAUT, _entreprisesLues, aPayerUrssaf, askConfirm, buildFacturXBytes, comptaChargesAnnee, comptaChargesMois, compteEcarte, couvertureBenefice, debutPeriode, decalerPeriode, echeancesAbonnement, enTeteSession, entForInvoice, extSait, fetchProInvoices, fetchVersementsVinted, fmt, fmtDate, generatePDF, isCloudReady, libellePeriodeCa, lireReglage, load, netApresUrssafDe, nextUrssafDeadline, onCloudReady, ouvrirDocumentImprimable, save, sbAuth, setProInvoiceStatus, tauxUrssaf, toast, tod, tsCommande, useBeneficeCalcul, useLigneUrssaf, useVentesCoque, ventesDeclarables, ventesFaites, withOwner, xmlEsc, ymCompta, ymCourant, ymDeTs } from "../App.jsx";

// ── PROFIL FISCAL : le SIREN se vérifie, il ne se bloque pas (16 octobre) ────
// SIREN = 9 chiffres, SIRET = SIREN + 5 chiffres ; les deux portent une clé de
// Luhn. On DIT qu'il est invalide (une faute de frappe part sur chaque reçu
// envoyé au comptable, §5), on n'empêche jamais d'enregistrer : lui seul sait.
// Exception connue : La Poste (SIREN 356000000) — ses SIRET ne suivent pas Luhn
// mais une somme de chiffres multiple de 5.
const luhnOk = (ch) => { let s = 0; for (let i = 0; i < ch.length; i++) { let n = Number(ch[ch.length - 1 - i]); if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; } s += n; } return s % 10 === 0; };
async function generateFacturXPdf(inv, ent){
  try{
    const out = await buildFacturXBytes(inv, ent);
    const blob=new Blob([out],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`facture-${String(inv.number||'').replace(/[^\w-]/g,'_')||'facturx'}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){ try{toast('Factur-X impossible : '+e.message);}catch(_){} }
}
const COMPTA_CATS = ['Emballage', 'Fournitures', 'Abonnement', 'Frais plateforme', 'Transport', 'Matériel', 'Autre'];
const DEPENSE_CATS = [
  { k: 'Emballage', ex: 'cartons, papier bulle, scotch' },
  { k: 'Fournitures', ex: 'étiquettes, sachets, stylos' },
  { k: 'Matériel', ex: 'imprimante thermique, lampe photo' },
  { k: 'Transport', ex: 'essence pour aller au relais' },
  { k: 'Frais plateforme', ex: 'boost, option de mise en avant' },
  { k: 'Autre', ex: 'ce que tu as payé' },
];
// Les abonnements les plus courants d'un revendeur : un clic remplit le NOM.
// Le prix n'est rempli que pour VRM (celui des CGV, §11) — les autres, on ne
// connaît pas son offre : il le tape (jamais un tarif deviné, §2.3).
const ABONNEMENTS_COURANTS = [
  { nom: 'VRM', prix: () => (String(PRIX_CGV_LISIBLE).match(/\d+(?:,\d+)?/) || [''])[0] },
  { nom: 'Canva' },
  { nom: 'Lightroom' },
  { nom: 'Photoroom' },
];
const rCompId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const comptaVide = (d) => !((d.depenses || []).length || (d.fixes || []).length || (d.packs || []).length || (d.abonnements || []).length);
// Montant saisi « 12,50 » ou « 12.50 » → nombre. Jamais NaN silencieux : on
// renvoie null, et l'appelant refuse d'ajouter (mieux vaut un blanc qu'un faux).
const parseMontant = (s) => { const n = parseFloat(String(s == null ? '' : s).replace(',', '.').replace(/[^0-9.]/g, '')); return isFinite(n) && n > 0 ? n : null; };
const verifierSiren = (brut) => {
  const ch = String(brut || '').replace(/[\s.-]/g, '');
  if (!ch) return { etat: 'vide' };
  if (!/^\d+$/.test(ch)) return { etat: 'invalide', raison: 'il ne doit contenir que des chiffres' };
  if (ch.length !== 9 && ch.length !== 14) return { etat: 'invalide', raison: `${ch.length} chiffre${ch.length > 1 ? 's' : ''} — un SIREN en a 9, un SIRET 14` };
  const type = ch.length === 9 ? 'SIREN' : 'SIRET';
  const siren = ch.slice(0, 9);
  if (!luhnOk(siren)) return { etat: 'invalide', type, raison: 'la clé de contrôle du SIREN ne correspond pas (faute de frappe ?)' };
  if (type === 'SIRET' && !(siren === '356000000' ? ch.split('').reduce((s, c) => s + Number(c), 0) % 5 === 0 : luhnOk(ch))) return { etat: 'invalide', type, raison: 'la clé de contrôle du SIRET ne correspond pas (faute de frappe ?)' };
  return { etat: 'ok', type, siren };
};
// `series` = { vendu, finalise, recu } — chacune une liste `{ts, eur}` ou `null`
// (« pas su » ⇒ la colonne vaut `null`, jamais 0).
const caParPeriodes = (series, p, n = 6, maintenant = Date.now()) => {
  const s0 = debutPeriode(maintenant, p);
  const somme = (liste, a, b) => {
    if (!Array.isArray(liste)) return null;
    let eur = 0, nb = 0;
    for (const l of liste) if (l && l.ts >= a && l.ts < b) { eur += Number(l.eur) || 0; nb += 1; }
    return { eur: Math.round(eur * 100) / 100, n: nb };
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = decalerPeriode(s0, p, -i), f = decalerPeriode(d, p, 1);
    out.push({ cle: d.toISOString(), libelle: libellePeriodeCa(d, p), enCours: i === 0,
      vendu: somme(series.vendu, d.getTime(), f.getTime()), finalise: somme(series.finalise, d.getTime(), f.getTime()), recu: somme(series.recu, d.getTime(), f.getTime()) });
  }
  return out;
};

// ── CA PAR PÉRIODE — vendu · finalisé · reçu (versé) ─────────────────────────
// Julien appelle « encaissé » l'argent versé ; le CA déclaré ne dit jamais
// « encaissé » (§5 : l'app ne connaît pas les recettes encaissées au sens de
// l'URSSAF, et Leboncoin n'est pas daté au versement). D'où « reçu (versé) ».
// AUCUNE règle de vente n'est écrite ici (§11) :
//   · VENDU    = `ventesFaites` (au jour de la vente, en cours comprises, hors
//                annulées et hors ventes/comptes cachés — la règle de Ma journée) ;
//   · FINALISÉ = `ventesDeclarables` (lignes + « à dater »), au jour de la VENTE ;
//   · REÇU     = `ventesDeclarables`, au jour du VERSEMENT (Vinted), de la vente
//                (Leboncoin), de la commande (eBay) — `recuDuMois`, la date des
//                barres de Ma journée, sans le registre des déclarations.
// Les sources sont celles que la COQUE lit déjà (ventes de tous les comptes,
// Leboncoin, eBay) : aucune lecture de plus, sauf les dates de versement.
// Trois états partout : `undefined` lecture en cours · `null` pas su · lu.
const PERIODES_CA = [['semaine', 'Semaine'], ['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];          // chiffres → réponse (une fois par session)
async function chercherEntreprise(brut) {
  const ch = String(brut || '').replace(/\D/g, '');
  if (ch.length !== 9 && ch.length !== 14) return { etat: 'invalide' };
  if (_entreprisesLues.has(ch)) return _entreprisesLues.get(ch);
  try {
    const r = await fetch(`/api/compte?mode=entreprise&siret=${ch}`, { headers: enTeteSession() });
    const j = await r.json().catch(() => null);
    if (r.ok && j && (j.etat === 'trouve' || j.etat === 'inconnu')) { _entreprisesLues.set(ch, j); return j; }
    return { etat: 'passu' };
  } catch (_) { return { etat: 'passu' }; }
}
const PROFIL_CHAMPS = [['siret', 'SIRET (14 chiffres) ou SIREN', '1 1 100%'], ['nom', "Nom de l'entreprise", '1 1 100%'], ['tva', 'N° TVA intracom. (si assujetti)', '1 1 200px'], ['adresse', 'Adresse', '1 1 100%'], ['codePostal', 'Code postal', '0 1 140px'], ['ville', 'Ville', '1 1 160px']];

// ── FACTURATION ÉLECTRONIQUE — Factur-X et récap e-reporting (16 octobre) ────
// VRM PRÉPARE, le vendeur ENVOIE depuis sa plateforme agréée gratuite : aucune
// connexion à une plateforme, aucune fonction payante (§2.9). Les règles vivent
// dans `src/facturationElectronique.js` ; les ventes viennent de
// `ventesDeclarables` (datées au versement, comme le CA déclaré) — AUCUNE règle
// de vente n'est écrite ici (§11). Le numéro de facture : une série par année
// (`FX-AAAA-0001`), rangée dans `vrm_compta.facturx` (synchronisé), donnée UNE
// fois par vente (regénérer la même vente redonne le même numéro et la même
// date). ⚠️ Tant que le nuage n'est pas arrivé, on ne numérote pas : un appareil
// neuf repartirait de 0001 et doublerait un numéro déjà donné.
const ymListe = (n = 12, maintenant = Date.now()) => { const out = []; const d = new Date(maintenant); d.setDate(1); for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); } return out; };
const libelleYm = (ym) => { const [a, m] = String(ym).split('-'); return `${MOIS_COMPTA[Number(m) - 1] || ''} ${a}`; };
const telechargerFichier = (contenu, nom, type) => {
  const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
const MOIS_NOMS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
// ── TON BÉNÉFICE, BRUT ET NET (19 octobre, Julien : « le bénéfice brut et net ») ─
// AUCUNE règle de vente ni aucun prix d'achat n'est relu ici (§11) :
//   · BRUT et NET DES VENTES = la somme des jours publiés par l'écran Ventes
//     (`vrm_benefice_jours`, `ajouterVenteBenefice`) — le même nombre que ses
//     cartes « Bénéfice brut / net » sur la même période ;
//   · CHARGES = `comptaChargesMois` / `comptaChargesAnnee` (celles de cet écran) ;
//   · COTISATIONS = `aPayerUrssaf` sur la part VINTED du CA déclaré publié
//     (`vinted_urssaf_mois`) ; depuis la publication `v: 2` (Leboncoin et eBay
//     reliés par identité), sur le CA déclaré des trois (`caBeneficeDuMois`).
// Le NET final n'est écrit que si TOUTES les ventes de la période ont leur prix
// d'achat : sinon un « — », la raison, et la porte (saisie en série). Trois
// états : `encours` (nuage pas arrivé) · `passu` (jamais publié) · `lu`.
const PERIODES_BENEF = [['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];

/* ── Factures ───────────────────────────────────────── */
function Invoices({invoices,setInvoices,catalog,sales,invoiceSettings,setInvoiceSettings,entreprises,setEntreprises,activeEnt,setActiveEnt}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [zone,setZone]=useState('attente'); // 'attente' | 'comptabilisees'
  const [page,setPage]=useState(null);
  const [showAll,setShowAll]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  // « Facturation Pro » vit ICI depuis le 30 sept. (Julien : « ça doit être dans
  // l'onglet Facture », plus dans Réglages). Même composant, même ligne
  // `vrm_pro_facture` — seul l'endroit change (§11 : un seul propriétaire).
  const [showPro,setShowPro]=useState(false);
  const [fetching,setFetching]=useState(false);
  const [proInvs,setProInvs]=useState(null); // factures Pro (pipeline email)
  const PER_PAGE=50;
  useEffect(()=>{ fetchProInvoices().then(setProInvs); },[]);

  // ⚠️⚠️ CHEMIN GOOGLE SHEETS RETIRÉ (9 septembre) — IL ÉTAIT MORT, MESURÉ.
  // `fetchVintedInvoices` appelait un Apps Script
  // (`script.google.com/macros/s/…/exec`) au montage de l'écran ET TOUTES LES
  // 5 MINUTES, en silence (`silencieux=true`, donc aucun message). Interrogé
  // le 9 septembre : **404**, réponse HTML — donc `res.json()` levait, le
  // `catch` avalait, et l'écran retentait indéfiniment un endpoint qui
  // n'existe plus.
  // ⚠️ Et l'écran vide DISAIT à Julien « elles arrivent de tes emails Vinted,
  // par ta feuille Google », avec un bouton « Aller les chercher maintenant » :
  // il pouvait attendre des factures qui ne pouvaient PAS arriver, et cliquer
  // sur un bouton qui ne pouvait QUE échouer (avec « Erreur récupération : … »,
  // du vocabulaire d'informaticien par-dessus le marché).
  // ⚠️ Le dossier annonçait pourtant cette architecture retirée le 30 août
  // (« plus AUCUN appelant ») : c'était FAUX, ce caller-ci avait survécu.
  // Même famille que le tiroir `Nav` — sauf qu'ici le code mort TOURNAIT.
  // ⚠️ Et l'URL `/exec` d'un Apps Script est une URL-capacité : quiconque la
  // connaît peut l'invoquer. Elle vivait en clair dans un dépôt PUBLIC.
  //
  // La VRAIE source est juste à côté et elle est vivante : `fetchProInvoices`
  // lit `email_invoice_*` en base — les reçus Vinted arrivés par email
  // (`api/email-inbound`). Plus « + Nouvelle facture » pour la saisie.

  // 🔄 Rafraîchissement automatique toutes les 5 min — sur la source VIVANTE.
  // ⚠️ Cette boucle interrogeait l'Apps Script mort (404) toutes les 5 minutes,
  //    en silence. Elle relit maintenant les reçus Vinted arrivés par email
  //    (`email_invoice_*`), c'est-à-dire ce qui remplit réellement l'écran.
  const _autoFetchedRef=React.useRef(false);
  useEffect(()=>{
    if(_autoFetchedRef.current) return;
    _autoFetchedRef.current=true;
    const interval=setInterval(()=>{ fetchProInvoices().then(setProInvs); }, 5*60*1000);
    return ()=>clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  
  // Numéro auto pour la prochaine facture — SÉQUENCE PROPRE À L'ENTITÉ ACTIVE.
  // Une facture sans `entrepriseId` appartient à la 1ʳᵉ entité (rétro-compat).
  // Chaque micro-entreprise garde ainsi sa propre numérotation continue (légal).
  const firstEntId=(Array.isArray(entreprises)&&entreprises[0]&&entreprises[0].id)||'ent_1';
  const invBelongsToActive=(i)=>{ const eid=i.entrepriseId||firstEntId; return eid===(activeEnt||firstEntId); };
  const nextInvoiceNumber=useMemo(()=>{
    const year=new Date().getFullYear();
    const yearInvoices=invoices.filter(i=>i.number&&i.number.startsWith(`${year}-`)&&invBelongsToActive(i));
    const maxNum=yearInvoices.reduce((mx,i)=>{
      const n=parseInt(i.number.split('-')[1],10);
      return isNaN(n)?mx:Math.max(mx,n);
    },0);
    return `${year}-${String(maxNum+1).padStart(6,'0')}`;
  },[invoices,activeEnt,firstEntId]);
  
  // Set des productIds qui sont déjà dans Ventes (= comptabilisés)
  const accountedSet=useMemo(()=>{
    const s=new Set();
    sales.forEach(v=>{
      if(v.productId) String(v.productId).trim().split('+').forEach(id=>{const t=id.trim();if(t) s.add(t);});
    });
    return s;
  },[sales]);
  
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};
  
  // Filtrage par zone + recherche
  const fullList=useMemo(()=>{
    let list=invoices;
    // Si une recherche est active, on cherche dans TOUTES les zones (pratique pour retrouver/supprimer une facture)
    if(search.trim()){
      const q=search.trim().toLowerCase();
      list=list.filter(i=>(i.number||'').toLowerCase().includes(q)||
        String(i.productId||'').toLowerCase().includes(q)||
        (i.itemName||'').toLowerCase().includes(q)||
        (i.buyerName||'').toLowerCase().includes(q)||
        fmtDate(i.saleDate||'').toLowerCase().includes(q)||
        String(i.saleDate||'').toLowerCase().includes(q));
      return [...list].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||''));
    }
    // Sinon, filtrage normal par zone
    if(zone==='attente') list=list.filter(i=>!accountedSet.has(String(i.productId).trim()));
    else if(zone==='comptabilisees') list=list.filter(i=>accountedSet.has(String(i.productId).trim()));
    return [...list].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||''));
  },[invoices,zone,search,accountedSet]);
  
  const totalPages=Math.max(1,Math.ceil(fullList.length/PER_PAGE));
  const currentPage=page===null?0:Math.min(page,totalPages-1);
  const list=showAll?fullList:fullList.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);
  
  // Compteurs par zone
  const counters=useMemo(()=>{
    const attente=invoices.filter(i=>!accountedSet.has(String(i.productId).trim())).length;
    const comptabilisees=invoices.filter(i=>accountedSet.has(String(i.productId).trim())).length;
    return {attente,comptabilisees};
  },[invoices,accountedSet]);
  
  const deleteInvoice=async (id)=>{
    const inv=invoices.find(i=>i.id===id);
    const isAcc=inv&&accountedSet.has(String(inv.productId).trim());
    const msg=isAcc
      ? `⚠️ La paire #${inv.productId} a une vente saisie dans ta compta.\nSupprimer cette facture quand même ?`
      : 'Supprimer cette facture ?';
    if(!await askConfirm(msg)) return;
    const u=invoices.filter(i=>i.id!==id);
    setInvoices(u); save('vinted_invoices',u);
  };
  
  const addInvoice=(data)=>{
    const newInvoice={
      id:'inv_'+Date.now(),
      number:nextInvoiceNumber,
      entrepriseId:activeEnt||firstEntId, // à quelle micro-entreprise cette facture appartient
      ...data,
      createdAt:new Date().toISOString(),
    };
    const u=[newInvoice,...invoices];
    setInvoices(u); save('vinted_invoices',u);
    setShowForm(false);
  };
  
  // Export CSV/Excel
  const exportExcel=()=>{
    if(fullList.length===0){toast('Aucune facture à exporter');return;}
    const multiEnt=Array.isArray(entreprises)&&entreprises.length>1;
    const headers=['N° Facture',...(multiEnt?['Entreprise','SIRET']:[]),'Date vente','N° Paire','Désignation','Prix vente','Acheteur','Email','Adresse','N° Vinted','Statut'];
    const rows=fullList.map(i=>{
      const e=entForInvoice(i,entreprises,activeEnt,invoiceSettings);
      return [
      i.number||'',...(multiEnt?[e&&e.companyName||'',e&&e.siret||'']:[]),i.saleDate||'',i.productId||'',i.itemName||'',
      (i.sellPrice||'').toString().replace('.',','),
      i.buyerName||'',i.buyerEmail||'',i.buyerAddress||'',i.vintedNumber||'',
      accountedSet.has(String(i.productId).trim())?'Comptabilisée':'En attente',
    ];});
    const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`factures-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      {/* ⚠️ LES BOUTONS PASSENT DANS LE `right` DE `ScreenHead`. Posés à côté
          dans une rangée à part, ils sortaient de la zone protégée et
          glissaient SOUS l'île d'actions flottante : « ⚙ Réglages » était
          invisible (vu en capture). Le slot `right` existe pour ça. */}
      <div>
        <ScreenHead icon="receipt" title="Factures" desc="Les justificatifs de tes ventes, importés depuis tes emails Vinted."
          right={<div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <Btn small onClick={()=>setShowForm(true)} color={C.accent}>+ Nouvelle facture</Btn>
          {/* ⚠️ « Récupérer Vinted » appelait l'Apps Script mort : le bouton ne
              pouvait QUE échouer. Il relit maintenant les reçus arrivés par
              email — la source qui remplit vraiment cet écran. */}
          <Btn small outline color={C.muted} disabled={fetching}
            onClick={async()=>{ setFetching(true); try{ setProInvs(await fetchProInvoices()); toast('Reçus Vinted relus'); } finally { setFetching(false); } }}
            style={{display:'inline-flex',alignItems:'center',gap:5}}>
            <Icon name="sync" size={13}/>{fetching?'Chargement…':'Relire les reçus'}
          </Btn>
          <Btn small outline color={C.muted} onClick={exportExcel} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="save" size={13}/>Exporter Excel</Btn>
          <Btn small outline color={C.muted} onClick={()=>setShowPro(v=>!v)} aria-expanded={showPro} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="receipt" size={13}/>Facturation Pro</Btn>
          <Btn small outline color={C.muted} onClick={()=>setShowSettings(true)} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="gear" size={13}/>Réglages</Btn>
        </div>}/>
      </div>
      {showPro && <ProFactureSetting/>}

      {/* Barre de recherche : par n° de paire ou date de vente (cherche dans toutes les zones) */}
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <input
          value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="N° de paire ou date de vente... puis Entrée"
          style={{flex:1,minWidth:200,padding:'9px 12px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,
            color:C.text,fontSize:13,fontFamily:'inherit',outline:'none'}}
        />
        <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕ Effacer</Btn>}
      </div>
      {search&&<div style={{fontSize:12,color:C.warn}}>
        🔍 Recherche « {search} » dans toutes les factures — {fullList.length} résultat{fullList.length>1?'s':''}. Tu peux supprimer directement avec 🗑.
      </div>}
      
      {/* Factures Pro (pipeline email) : préparées par le serveur, envoi Gmail */}
      {Array.isArray(proInvs)&&proInvs.length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:600,color:C.text,margin:'0 0 8px'}}>🧾 Factures Pro ({proInvs.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {proInvs.slice(0,20).map(inv=>{
              const col=inv.status==='sent'?'#27a85d':inv.status==='queued'?C.warn:C.muted;
              const lbl=inv.status==='sent'?'📧 envoyée':inv.status==='queued'?'⏳ envoi en cours':'brouillon';
              return (
                <div key={inv._id} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',border:`1px solid ${col}55`,background:`${col}0d`,borderRadius:10,flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:140}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>
                      {inv.number} <span style={{fontSize:11,fontWeight:600,color:col,marginLeft:4}}>{lbl}</span>
                    </div>
                    <div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:260}}>
                      {inv.designation||'Article'} · {inv.prix} € · {inv.buyerName||inv.buyerEmail}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button type="button" onClick={()=>{ ouvrirDocumentImprimable(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Facture ${xmlEsc(inv.number)}</title></head><body>${(inv.html||'').replace('cid:logoFacture','')}</body></html>`); }}
                      style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Voir</button>
                    {inv.status==='draft'&&inv.buyerEmail&&(
                      <button type="button" onClick={async()=>{
                        if(!await askConfirm(`Mettre la facture ${inv.number} en file d'envoi à ${inv.buyerEmail} ?`)) return;
                        const ok=await setProInvoiceStatus(inv,'queued');
                        if(ok) setProInvs(await fetchProInvoices()); else toast('Échec — réessaie.');
                      }} style={{padding:'6px 12px',borderRadius:8,border:'none',background:C.accent,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Envoyer</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.4}}>Préparées automatiquement à chaque vente Pro (coordonnées acheteur dans l'email Vinted). Réglages : Paramètres → Facturation Pro.</div>
        </div>
      )}

      {/* Sous-onglets zones */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${C.border}`,overflowX:'auto',opacity:search?0.4:1,pointerEvents:search?'none':'auto'}}>
        {[
          {id:'attente',icon:'clock',label:'En attente',count:counters.attente},
          {id:'comptabilisees',icon:'check',label:'Comptabilisées',count:counters.comptabilisees},
        ].map(z=>(
          <button key={z.id} type="button" onClick={()=>{setZone(z.id);setPage(null);}}
            style={{background:'transparent',border:'none',borderBottom:zone===z.id?`3px solid ${C.accent}`:'3px solid transparent',
              color:zone===z.id?C.accent:C.muted,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:500,fontFamily:'inherit',whiteSpace:'nowrap'}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name={z.icon} size={13}/>{z.label} ({z.count})</span>
          </button>
        ))}
      </div>
      {/* (Une seule barre de recherche, au-dessus des onglets — la deuxième,
          identique, faisait doublon.) */}
      {search.trim()&&<div style={{fontSize:11,color:C.warn,marginTop:6}}>🔍 Recherche active dans toutes les factures.</div>}
      
      {/* Tableau factures */}
      <Card style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:700}}>
          <thead>
            <tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.warn,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>N° Paire</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>N° Facture</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Date vente</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Désignation</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Prix</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Acheteur</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.muted,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* ⚠️ UN ÉCRAN VIDE DOIT DIRE QUOI FAIRE (§7 : il n'est pas
                développeur — « Aucune facture en attente » ne se rattrape
                nulle part). D'où l'origine des lignes, et la porte : le même
                « Récupérer Vinted » que le haut de l'écran, à l'endroit où il
                constate le vide. */}
            {list.length===0&&<tr><td colSpan={7} style={{padding:'28px 20px',textAlign:'center',color:C.muted,fontSize:12.5,lineHeight:1.5}}>
              {search.trim()
                ? <>Aucune facture trouvée pour « {search} ».</>
                : zone==='attente'
                  ? <>Aucune facture en attente.<br/>
                      {/* ⚠️ Cette phrase parlait d'une « feuille Google » : le
                          pipeline Apps Script est mort (404, mesuré). Il aurait
                          attendu des factures qui ne pouvaient pas arriver. Ce
                          qui remplit vraiment cet écran, ce sont les reçus
                          Vinted reçus par email, et sa propre saisie. */}
                      <span style={{fontSize:11.5}}>Les reçus Vinted arrivent par email, à l'adresse de l'app. Tu peux aussi en créer une à la main.</span>
                      <br/>
                      <span style={{display:'inline-block',marginTop:10}}>
                        <Btn small color={C.accent} onClick={()=>setShowForm(true)}
                          style={{display:'inline-flex',alignItems:'center',gap:5}}>+ Nouvelle facture</Btn>
                      </span>
                    </>
                  : <>Aucune facture comptabilisée.<br/>
                      <span style={{fontSize:11.5}}>Une facture arrive ici quand tu la marques comptabilisée.</span>
                    </>}
            </td></tr>}
            {list.map(inv=>{
              const isAccounted=accountedSet.has(String(inv.productId).trim());
              return (
                <tr key={inv.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'8px',color:C.warn,fontWeight:600,fontFamily:'monospace',fontSize:15}}>#{inv.productId||'?'}</td>
                  <td style={{padding:'8px',color:C.accent,fontWeight:500,fontFamily:'monospace',fontSize:11}}>{inv.number||'—'}{(entreprises&&entreprises.length>1)&&(()=>{const e=entForInvoice(inv,entreprises,activeEnt,invoiceSettings);return e&&e.companyName?<div style={{marginTop:2,fontFamily:'inherit',fontSize:9.5,color:C.muted,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:110}}>🏢 {e.companyName}</div>:null;})()}</td>
                  <td style={{padding:'8px',color:C.text,fontFamily:'monospace',fontSize:11}}>{fmtDate(inv.saleDate)}</td>
                  <td style={{padding:'8px',color:C.text}}>{String(inv.itemName||'—').replace(/\bimages?\s*:\s*/gi,'').replace(/\bimages?\b/gi,'').replace(/\s+/g,' ').trim()||'—'}</td>
                  <td style={{padding:'8px',textAlign:'right',color:C.accent,fontWeight:500}}>{fmt(+inv.sellPrice||0)}</td>
                  <td style={{padding:'8px',color:C.muted,fontSize:11}}>{inv.buyerName||'—'}</td>
                  <td style={{padding:'8px',textAlign:'right',whiteSpace:'nowrap'}}>
                    <Btn small onClick={()=>generatePDF(inv,entForInvoice(inv,entreprises,activeEnt,invoiceSettings))} color={C.blue} style={{marginRight:4}}>📄</Btn>
                    <Btn small onClick={()=>generateFacturXPdf(inv,entForInvoice(inv,entreprises,activeEnt,invoiceSettings))} color={C.muted} style={{marginRight:4}} title="Facture électronique Factur-X (PDF + XML EN16931 embarqué)">🧾</Btn>
                    <Btn small onClick={()=>deleteInvoice(inv.id)} color={C.danger}>🗑</Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      
      {/* Pagination */}
      {!showAll&&totalPages>1&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?0:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullList.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?0:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullList.length} factures</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
      
      {/* Modale création facture */}
      {showForm&&<InvoiceForm onClose={()=>setShowForm(false)} onSave={addInvoice} nextNumber={nextInvoiceNumber} catalog={catalog}/>}
      
      {/* Modale réglages */}
      {showSettings&&<InvoiceSettings settings={invoiceSettings} setSettings={(s)=>{setInvoiceSettings(s);save('vinted_invoice_settings',s);}} entreprises={entreprises} setEntreprises={setEntreprises} activeEnt={activeEnt} setActiveEnt={setActiveEnt} onClose={()=>setShowSettings(false)}/>}
    </div>
  );
}

// Formulaire de création d'une facture
function InvoiceForm({onClose,onSave,nextNumber,catalog}) {
  const [data,setData]=useState({
    productId:'',itemName:'',sellPrice:'',saleDate:tod(),
    buyerName:'',buyerEmail:'',buyerAddress:'',
    vintedNumber:'',source:'manual',
  });
  const [err,setErr]=useState('');
  
  const submit=()=>{
    setErr('');
    if(!data.productId.trim()){setErr('Le numéro de paire est obligatoire');return;}
    if(!data.sellPrice||+data.sellPrice<=0){setErr('Prix de vente invalide');return;}
    if(!data.itemName.trim()){setErr('La désignation est obligatoire');return;}
    onSave(data);
  };
  
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={onClose}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:20,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,color:C.accent}}>Nouvelle facture</h3>
          <button type="button" onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>×</button>
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Numéro auto : <b style={{color:C.accent}}>{nextNumber}</b></div>
        
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Field label="N° paire (étiquetage) *">
            <Input type="number" value={data.productId} onChange={e=>{
              const id=e.target.value;
              const p=catalog.find(p=>p.id===id);
              setData(d=>({...d,productId:id, itemName:p?(d.itemName||''):d.itemName}));
            }} placeholder="ex: 1280"/>
          </Field>
          <Field label="Désignation *">
            <Input value={data.itemName} onChange={e=>setData(d=>({...d,itemName:e.target.value}))} placeholder="ex: Adidas Spezial bleu marine taille 365"/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <Field label="Prix de vente € *">
              <Input type="number" step="0.01" value={data.sellPrice} onChange={e=>setData(d=>({...d,sellPrice:e.target.value}))} placeholder="38.00"/>
            </Field>
            <Field label="Date vente">
              <Input type="date" value={data.saleDate} onChange={e=>setData(d=>({...d,saleDate:e.target.value}))}/>
            </Field>
          </div>

          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:4}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8,fontWeight:500}}>Acheteur</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Field label="Nom complet"><Input value={data.buyerName} onChange={e=>setData(d=>({...d,buyerName:e.target.value}))} placeholder="Prénom Nom"/></Field>
              <Field label="Email"><Input type="email" value={data.buyerEmail} onChange={e=>setData(d=>({...d,buyerEmail:e.target.value}))} placeholder="prenom.nom@exemple.fr"/></Field>
              <Field label="Adresse complète"><Input value={data.buyerAddress} onChange={e=>setData(d=>({...d,buyerAddress:e.target.value}))} placeholder="N° et rue, code postal, ville, pays"/></Field>
            </div>
          </div>

          <Field label="N° transaction Vinted">
            <Input value={data.vintedNumber} onChange={e=>setData(d=>({...d,vintedNumber:e.target.value}))} placeholder="19921523337"/>
          </Field>

          {err&&<div style={{color:C.danger,fontSize:12}}>⚠ {err}</div>}

          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Btn onClick={submit} color={C.accent} style={{flex:1}}>✓ Créer la facture</Btn>
            <Btn onClick={onClose} color={C.border}>Annuler</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Réglages personnalisables
// Réglages factures — gère PLUSIEURS micro-entreprises. Rétro-compatible : si une
// seule entité, c'est exactement comme avant. `setSettings` continue de refléter
// l'entité ACTIVE dans `vinted_invoice_settings` (pour tout code hérité qui le lit).
function InvoiceSettings({settings,setSettings,entreprises,setEntreprises,activeEnt,setActiveEnt,onClose}) {
  const list = (Array.isArray(entreprises)&&entreprises.length) ? entreprises : [{id:'ent_1',...settings}];
  const [sel,setSel]=useState(()=>{ const a=list.find(e=>e.id===activeEnt); return (a&&a.id)||list[0].id; });
  const cur = list.find(e=>e.id===sel)||list[0];
  const [data,setData]=useState(cur);
  // Quand on change d'entité sélectionnée, charge ses champs dans le formulaire.
  const pick=(id)=>{ setSel(id); const e=list.find(x=>x.id===id); if(e) setData(e); };
  const mirror=(entList,activeId)=>{ const act=entList.find(e=>e.id===activeId)||entList[0]; if(act) setSettings({companyName:act.companyName||'',companyType:act.companyType||'',companyAddress:act.companyAddress||'',siret:act.siret||'',footer:act.footer||''}); };
  const persist=(entList,activeId)=>{ setEntreprises(entList); if(activeId!==undefined){ setActiveEnt(activeId); } mirror(entList, activeId!==undefined?activeId:activeEnt); };
  const saveCur=()=>{ const next=list.map(e=>e.id===sel?{...e,...data,id:sel}:e); persist(next); onClose(); };
  const addEnt=()=>{ const id='ent_'+Date.now(); const blank={id,companyName:'',companyType:'Entrepreneur individuel',companyAddress:'',siret:'',tvaMention:'TVA non applicable, art. 293 B du CGI',footer:'Merci pour votre achat !'}; const next=[...list,blank]; setEntreprises(next); setSel(id); setData(blank); };
  const delEnt=()=>{ if(list.length<=1) return; const next=list.filter(e=>e.id!==sel); const newActive=(activeEnt===sel)?next[0].id:activeEnt; persist(next,newActive); const nsel=next[0].id; setSel(nsel); setData(next[0]); };
  const makeActive=()=>{ const next=list.map(e=>e.id===sel?{...e,...data,id:sel}:e); persist(next,sel); };
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:20,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,color:C.accent}}>⚙ Réglages factures</h3>
          <button type="button" onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>×</button>
        </div>
        {/* Sélecteur de micro-entreprise */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:5}}>Mes micro-entreprises</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {list.map(e=>(
              <button key={e.id} type="button" onClick={()=>pick(e.id)}
                style={{border:`1px solid ${e.id===sel?C.accent:C.border}`,background:e.id===sel?`${C.accent}18`:'transparent',color:e.id===sel?C.accent:C.text,borderRadius:8,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {e.id===activeEnt?'⭐ ':''}{e.companyName||'(sans nom)'}
              </button>
            ))}
            <button type="button" onClick={addEnt} style={{border:`1px dashed ${C.border}`,background:'transparent',color:C.muted,borderRadius:8,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Ajouter</button>
          </div>
          <div style={{fontSize:10.5,color:C.muted,marginTop:5}}>⭐ = entité utilisée pour les nouvelles factures. Chaque entité a sa propre numérotation.</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Field label="Nom de l'entreprise"><Input value={data.companyName||''} onChange={e=>setData(d=>({...d,companyName:e.target.value}))}/></Field>
          <Field label="Forme juridique"><Input value={data.companyType||''} onChange={e=>setData(d=>({...d,companyType:e.target.value}))}/></Field>
          <Field label="Adresse"><Input value={data.companyAddress||''} onChange={e=>setData(d=>({...d,companyAddress:e.target.value}))}/></Field>
          <Field label="SIRET"><Input value={data.siret||''} onChange={e=>setData(d=>({...d,siret:e.target.value}))}/></Field>
          <Field label="Mention TVA (bas de facture)"><Input value={data.tvaMention!=null?data.tvaMention:'TVA non applicable, art. 293 B du CGI'} onChange={e=>setData(d=>({...d,tvaMention:e.target.value}))}/></Field>
          <Field label="Message de bas de page"><Input value={data.footer||''} onChange={e=>setData(d=>({...d,footer:e.target.value}))}/></Field>
          {sel!==activeEnt&&<Btn onClick={makeActive} color={C.blue} style={{fontSize:12}}>⭐ Utiliser cette entité pour les nouvelles factures</Btn>}
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Btn onClick={saveCur} color={C.accent} style={{flex:1}}>✓ Enregistrer</Btn>
            {list.length>1&&<Btn onClick={delEnt} color={C.red||'#c0392b'}>🗑 Supprimer</Btn>}
            <Btn onClick={onClose} color={C.border}>Annuler</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper pour les champs du formulaire
function Field({label,children}) {
  return <label style={{display:'flex',flexDirection:'column',gap:4}}>
    <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</span>
    {children}
  </label>;
}
function CaParPeriodeCarte({ lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const { ventes, ko } = useVentesCoque();
  const [periode, setPeriode] = React.useState(() => { try { const v = localStorage.getItem('vrm_compta_periode'); return PERIODES_CA.some(([k]) => k === v) ? v : 'mois'; } catch (_) { return 'mois'; } });
  const choisir = (p) => { setPeriode(p); try { localStorage.setItem('vrm_compta_periode', p); } catch (_) {} };
  const [versements, setVersements] = React.useState(undefined);
  React.useEffect(() => { let mort = false; fetchVersementsVinted().then((m) => { if (!mort) setVersements(m); }).catch(() => { if (!mort) setVersements(null); }); return () => { mort = true; }; }, []);
  // Les ventes et comptes masqués sont des réglages synchronisés (§5.49).
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => onCloudReady(() => setTick((t) => t + 1)), []);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_sales_hidden' || k === 'vinted_accounts_hidden') setTick((t) => t + 1); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const calc = React.useMemo(() => {
    if (ventes === undefined) return { etat: 'encours' };
    if (!Array.isArray(ventes)) return { etat: 'passu' };
    const hTx = new Set((load('vinted_sales_hidden', []) || []).map(String));
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const ecarte = (uid) => compteEcarte(uid, hAcc, panelOff || {});
    const uidDe = (o) => o && o._acc && o._acc.vinted_user_id;
    const lbc = lbcCoqueLu === true ? ((lbcVentes && lbcVentes.ventes) || []) : [];
    const ebay = Array.isArray(ebayCommandes) ? ebayCommandes : [];
    const vf = ventesFaites({ vinted: ventes, lbc, ebay, cachee: (o) => hTx.has(String(o && o.transaction_id)) || ecarte(uidDe(o)) });
    const decl = ventesDeclarables({ vinted: ventes, lbc, ebay, masquee: (o) => hTx.has(String(o && o.transaction_id)), exclu: (o) => ecarte(uidDe(o)), versements: versements || {} });
    let finSansDate = 0;
    const finalise = [];
    for (const l of [...decl.lignes, ...decl.aDater]) {
      const t = l.o ? tsCommande(l.o) : (l.ts || 0);
      if (t) finalise.push({ ts: t, eur: l.eur }); else finSansDate += 1;
    }
    const recu = versements ? decl.lignes.filter((l) => l.ts).map((l) => ({ ts: l.ts, eur: l.eur })) : null;
    const aDater = versements ? decl.aDater : [];
    const loginDe = (uid) => { const a = (accounts || []).find((x) => String(x.vinted_user_id) === String(uid)); return (a && a.login) || String(uid); };
    const manque = [
      ...(ko || []).filter((uid) => !ecarte(uid)).map(loginDe),
      ...(lbcCoqueLu === null ? ['Leboncoin'] : []),
      ...(ebayCommandes === null ? ['eBay'] : []),
    ];
    const attente = lbcCoqueLu === undefined || ebayCommandes === undefined;
    return { etat: 'lu', vendu: vf.lignes, finalise, recu, aDater, venduSansDate: vf.sansDate, venduEbayEcartees: vf.ecartees || 0, finSansDate, manque, attente };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, ko, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, versements, accounts, tick]);
  const lignes = calc.etat === 'lu' ? caParPeriodes({ vendu: calc.vendu, finalise: calc.finalise, recu: calc.recu }, periode, 6) : null;
  const cur = lignes ? lignes[0] : null;
  const partiel = calc.etat === 'lu' && (calc.manque.length > 0 || calc.attente);
  const montant = (x) => x == null ? '—' : fmt(x.eur);
  const nb = (x) => x == null ? '' : `${x.n} vente${x.n > 1 ? 's' : ''}`;
  const COLS = [
    ['vendu', 'Vendu', 'au jour de la vente, en cours comprises'],
    ['finalise', 'Finalisé', 'ventes finalisées, au jour de la vente'],
    ['recu', 'Reçu (versé)', versements === undefined ? 'dates de versement en lecture…' : versements === null ? 'dates de versement illisibles' : "au jour où l'argent a été versé"],
  ];
  const aDaterEur = calc.etat === 'lu' ? calc.aDater.reduce((t, l) => t + (Number(l.eur) || 0), 0) : 0;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div data-ca-periode={periode} data-ca-etat={calc.etat} data-ca-partiel={partiel ? '1' : '0'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: `${C.accent}14`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chart" size={16} /></span>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Chiffre d'affaires par période</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Toutes plateformes · les mêmes règles que Ma journée et le CA déclaré.</div>
          </div>
          {/* (16 oct.) Le contrôle segmenté PARTAGÉ (`.vrm-seg`, celui des
              sous-onglets de plateforme) : plus de segment rempli d'accent. */}
          <nav role="group" aria-label="Période" className="vrm-seg" data-segment="" style={{ '--seg-ink': C.text, '--seg-muted': C.muted, '--seg-point': C.accent, flex: '1 1 260px', maxWidth: 360, margin: 0 }}>
            {PERIODES_CA.map(([k, l]) => (
              <button key={k} type="button" onClick={() => choisir(k)} aria-pressed={periode === k} aria-current={periode === k ? 'page' : undefined} data-ca-choix={k} className="vrm-seg-btn">{l}</button>
            ))}
          </nav>
        </div>
        {calc.etat !== 'lu' ? (
          <div style={{ padding: '16px', fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
            {calc.etat === 'encours' ? 'Je lis tes ventes…' : "Je n'ai pas pu lire tes ventes : aucun chiffre n'est affiché plutôt qu'un zéro qui ne serait pas vrai. Rouvre cet écran dans un moment."}
          </div>
        ) : (<>
          <div className="vrm-ca-periode-tuiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderBottom: `1px solid ${C.border}` }}>
            {COLS.map(([k, l, s], i) => (
              <div key={k} data-ca-cur={k} data-ca-eur={cur[k] == null ? '' : String(cur[k].eur)} style={{ padding: '14px 16px', borderLeft: i ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{l} · {cur.libelle}</div>
                <div className="vrm-display" style={{ fontSize: 20, fontWeight: 750, color: cur[k] == null ? C.muted : C.text, marginTop: 4, letterSpacing: -0.5 }}>{partiel && cur[k] != null ? <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>au moins </span> : null}{montant(cur[k])}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{cur[k] == null ? s : `${nb(cur[k])} · ${s}`}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table data-ca-table className="vrm-ca-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '9px 16px', fontSize: 11 }}>Période</th>
                  {COLS.map(([k, l]) => <th key={k} style={{ fontWeight: 600, padding: '9px 16px 9px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {lignes.slice(1).map((r) => (
                  <tr key={r.cle} data-ca-ligne={r.libelle} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '9px 16px', color: C.text, whiteSpace: 'nowrap' }}>{r.libelle}</td>
                    {COLS.map(([k]) => <td key={k} style={{ padding: '9px 16px 9px 8px', textAlign: 'right', color: r[k] == null ? C.muted : C.text, whiteSpace: 'nowrap' }}>{montant(r[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(partiel || calc.aDater.length > 0 || calc.venduSansDate > 0 || calc.venduEbayEcartees > 0 || versements === null) && (
            <div data-ca-couverture style={{ padding: '10px 16px 13px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, lineHeight: 1.55 }}>
              {calc.manque.length > 0 && <div>Totaux partiels — sans {calc.manque.join(', ')} (pas pu lire) : chaque montant est un minimum.</div>}
              {!calc.manque.length && calc.attente && <div>Leboncoin ou eBay se lit encore : chaque montant est un minimum pour l'instant.</div>}
              {versements === null && <div>Les dates de versement Vinted sont illisibles : la colonne « reçu » attend, plutôt que d'afficher des zéros.</div>}
              {calc.aDater.length > 0 && <div>{calc.aDater.length} vente{calc.aDater.length > 1 ? 's' : ''} finalisée{calc.aDater.length > 1 ? 's' : ''} sans date de versement ({fmt(aDaterEur)}) : dans aucune période « reçu » tant que la date n'est pas captée.</div>}
              {calc.venduSansDate > 0 && <div>{calc.venduSansDate} vente{calc.venduSansDate > 1 ? 's' : ''} Leboncoin sans date de vente : dans aucune période.</div>}
              {calc.venduEbayEcartees > 0 && <div data-ca-ebay-ecartees={calc.venduEbayEcartees}>{calc.venduEbayEcartees} commande{calc.venduEbayEcartees > 1 ? 's' : ''} eBay écartée{calc.venduEbayEcartees > 1 ? 's' : ''} : le montant que tu reçois (frais eBay retirés, port non compté) n'est pas lisible ou n'est pas en euros.</div>}
            </div>
          )}
        </>)}
      </div>
    </Card>
  );
}
function ProfilFiscalCarte({ onNav }) {
  const [cfg, setCfg] = React.useState(undefined);          // undefined = en cours · null = pas su · objet = lu
  const [statut, setStatut] = React.useState('');
  const minuteur = React.useRef(null);
  React.useEffect(() => { let mort = false; lireReglage('vrm_pro_facture').then((d) => { if (!mort) setCfg(d === null ? null : { ...d }); }).catch(() => { if (!mort) setCfg(null); }); return () => { mort = true; }; }, []);
  const ecrire = (next) => {
    if (!cfg) return;                                      // pas lu : on n'écrit rien
    setCfg(next); setStatut('enregistrement…');
    try { window.dispatchEvent(new CustomEvent('vrm:profil-fiscal', { detail: next })); } catch (_) {}
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
          method: 'POST',
          headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([withOwner({ id: 'vrm_pro_facture', data: next })]),
        });
        setStatut(r.ok ? '✓ enregistré' : "⚠ pas enregistré — la base n'a pas répondu, réessaie");
      } catch (_) { setStatut("⚠ pas enregistré — la base n'a pas répondu, réessaie"); }
    }, 600);
  };
  const [regime, setRegime] = React.useState(() => load('vinted_regime', 'micro'));
  React.useEffect(() => onCloudReady(() => setRegime((v) => v === 'micro' ? load('vinted_regime', 'micro') : v)), []);
  const virgule = (n) => String(n).replace('.', ',');
  const [taux, setTaux] = React.useState(() => virgule(tauxUrssaf()));
  React.useEffect(() => onCloudReady(() => setTaux((v) => v === virgule(TAUX_URSSAF_DEFAUT) ? virgule(tauxUrssaf()) : v)), []);
  const siren = verifierSiren(cfg && cfg.siret);
  // Le registre : interrogé quand le numéro est VALIDE (clé de contrôle), une
  // fois par numéro. Trouvé ⇒ le nom (et l'adresse si elle est vide) sont posés,
  // sauf s'il a tapé lui-même un autre nom.
  const [registre, setRegistre] = React.useState(null);   // null · {etat:'encours'|'trouve'|'inconnu'|'passu', …}
  const chiffres = String((cfg && cfg.siret) || '').replace(/\D/g, '');
  const cfgRef = React.useRef(cfg); cfgRef.current = cfg;
  const pret = !!cfg;
  React.useEffect(() => {
    if (!pret || siren.etat !== 'ok') { setRegistre(null); return undefined; }
    let mort = false;
    setRegistre({ etat: 'encours' });
    chercherEntreprise(chiffres).then((j) => {
      if (mort) return;
      setRegistre(j);
      const c = cfgRef.current;
      if (j.etat !== 'trouve' || !c || String(c.siret || '').replace(/\D/g, '') !== chiffres) return;
      const libre = !String(c.nom || '').trim() || c.nom === c.nomAuto;
      const next = { ...c };
      let change = false;
      if (libre && c.nom !== j.nom) { next.nom = j.nom; next.nomAuto = j.nom; change = true; }
      if (j.etabTrouve && !String(c.adresse || '').trim() && j.adresse) { next.adresse = j.adresse; change = true; }
      if (j.etabTrouve && !String(c.codePostal || '').trim() && j.codePostal) { next.codePostal = j.codePostal; change = true; }
      if (j.etabTrouve && !String(c.ville || '').trim() && j.ville) { next.ville = j.ville; change = true; }
      if (change) ecrire(next);
    });
    return () => { mort = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiffres, siren.etat, pret]);
  const inp = { border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 15, fontFamily: 'inherit', minWidth: 0, outline: 'none', boxSizing: 'border-box' };
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div data-profil-fiscal={cfg === undefined ? 'encours' : cfg === null ? 'passu' : 'lu'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: `${C.accent}14`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="doc" size={16} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Ton entreprise</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Ton SIRET suffit : VRM retrouve le nom et l'adresse. Ils figurent sur tes reçus et tes factures ; ton régime sert à calculer tes cotisations.</div>
          </div>
          {statut && <span style={{ fontSize: 11, color: /⚠/.test(statut) ? C.warn : C.muted, whiteSpace: 'nowrap' }} data-profil-statut>{statut}</span>}
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cfg === undefined && <div style={{ fontSize: 13, color: C.muted }}>Je lis ton entité…</div>}
          {cfg === null && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}><span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 9px', marginRight: 6 }}>{REGLAGE_PAS_LU}</span>La base n'a pas répondu : je ne te montre pas de champs vides à remplir (ils remplaceraient ton entité). Rouvre cet écran dans un moment.</div>}
          {cfg && (<>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PROFIL_CHAMPS.map(([k, ph, flex]) => (
                <input key={k} data-profil-champ={k} value={cfg[k] || ''} placeholder={ph} aria-label={ph} inputMode={k === 'siret' || k === 'codePostal' ? 'numeric' : undefined}
                  onChange={(e) => ecrire({ ...cfg, [k]: e.target.value })}
                  data-profil-auto={k === 'nom' && cfg.nom && cfg.nom === cfg.nomAuto ? '1' : undefined}
                  style={{ ...inp, flex, borderColor: k === 'siret' && siren.etat === 'invalide' ? C.warn : C.border }} />
              ))}
            </div>
            <div data-siren={siren.etat} data-registre={registre ? registre.etat : undefined} style={{ fontSize: 11, lineHeight: 1.5, color: siren.etat === 'invalide' ? C.warn : C.muted, marginTop: -4 }}>
              {siren.etat === 'vide' ? 'Tape ton SIRET (14 chiffres) : il figure sur ton avis de situation INSEE. Le nom de ton entreprise se remplit tout seul.'
                : siren.etat !== 'ok' ? `Ce numéro ne semble pas valide : ${siren.raison}. Il reste enregistré tel quel — vérifie-le sur ton avis INSEE.`
                : !registre || registre.etat === 'encours' ? `${siren.type} valide — je cherche ton entreprise au registre…`
                : registre.etat === 'trouve' ? <>✓ Trouvée au registre des entreprises : <b className="vrm-sensible" style={{ color: C.text }}>{registre.nom}</b>{registre.ferme ? ' — le registre la dit fermée, vérifie ton numéro.' : '.'}{cfg.nom && cfg.nom !== registre.nom ? ' Tu as gardé ton propre nom : VRM ne le remplace pas.' : ''}</>
                : registre.etat === 'inconnu' ? `${siren.type} valide, mais aucune entreprise à ce numéro au registre public — tape le nom toi-même.`
                : `${siren.type} valide. Le registre des entreprises ne répond pas pour l'instant — le nom se remplira à ta prochaine visite, ou tape-le.`}
            </div>
          </>)}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* (16 oct.) Contrôle segmenté PARTAGÉ (`.vrm-seg`) : plus de segment rempli d'accent. */}
            <nav role="group" aria-label="Régime fiscal" className="vrm-seg" data-segment="" style={{ '--seg-ink': C.text, '--seg-muted': C.muted, '--seg-point': C.accent, margin: 0 }}>
              {[['micro', 'Micro-entreprise (BIC)', 'Micro-entreprise'], ['marge', 'Société — régime de la marge', 'Régime de la marge']].map(([k, l, court]) => (
                <button key={k} type="button" aria-pressed={regime === k} aria-current={regime === k ? 'page' : undefined} data-regime-choix={k} title={l} onClick={() => { setRegime(k); save('vinted_regime', k); }} className="vrm-seg-btn">{court}</button>
              ))}
            </nav>
            {regime !== 'marge' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Taux de cotisations</span>
                <input type="text" inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} data-profil-taux
                  onBlur={() => { const v = parseFloat(String(taux).replace(',', '.')); const ok = (isFinite(v) && v >= 0 && v <= 50) ? v : TAUX_URSSAF_DEFAUT; setTaux(virgule(ok)); save('vinted_urssaf_taux', ok); }}
                  style={{ ...inp, width: 72, padding: '6px 9px', fontWeight: 600 }} />
                <span style={{ fontSize: 13, color: C.muted }}>% du CA déclaré — celui que tu choisis, l'app ne le devine pas.</span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Régime de la marge : le taux de TVA se règle dans <button type="button" onClick={() => onNav && onNav('settings')} style={{ border: 'none', background: 'transparent', color: C.accent, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontSize: 13 }}>Réglages</button>.</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
function FacturationElectroniqueCarte({ data, maj, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const { ventes, ko } = useVentesCoque();
  const [versements, setVersements] = React.useState(undefined);
  React.useEffect(() => { let mort = false; fetchVersementsVinted().then((m) => { if (!mort) setVersements(m); }).catch(() => { if (!mort) setVersements(null); }); return () => { mort = true; }; }, []);
  // Le profil fiscal : relu à l'ouverture, et suivi quand la carte « Profil
  // fiscal » juste au-dessus l'écrit (même ligne, §11).
  const [cfg, setCfg] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    lireReglage('vrm_pro_facture').then((d) => { if (!mort) setCfg(d === null ? null : { ...d }); }).catch(() => { if (!mort) setCfg(null); });
    const f = (e) => { if (e && e.detail && typeof e.detail === 'object') setCfg({ ...e.detail }); };
    window.addEventListener('vrm:profil-fiscal', f);
    return () => { mort = true; window.removeEventListener('vrm:profil-fiscal', f); };
  }, []);
  // Le régime BRUT : jamais choisi ⇒ null (on ne retombe pas sur « micro »).
  const [regime, setRegime] = React.useState(() => load('vinted_regime', null));
  const [nuage, setNuage] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => { setNuage(true); setRegime(load('vinted_regime', null)); }), []);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_regime') setRegime(load('vinted_regime', null)); if (k === 'vinted_sales_hidden' || k === 'vinted_accounts_hidden') setTick((t) => t + 1); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const etat = etatFacturation({ cfg, regime, verifier: verifierSiren });
  const mois = React.useMemo(() => ymListe(12), []);
  const [ym, setYm] = React.useState(mois[0]);
  const [msg, setMsg] = React.useState('');
  const [enCours, setEnCours] = React.useState('');
  // ── SUPER PDP : SA connexion (le navigateur ne relit jamais ses identifiants)
  // Trois états : `undefined` en cours · `null` pas su · l'objet du serveur.
  const [spdp, setSpdp] = React.useState(undefined);
  const relireSpdp = React.useCallback(() => lireSuperPdp(enTeteSession()).then((j) => setSpdp(j)), []);
  React.useEffect(() => { let mort = false; lireSuperPdp(enTeteSession()).then((j) => { if (!mort) setSpdp(j); }); return () => { mort = true; }; }, []);
  const [spEnv, setSpEnv] = React.useState('sandbox');
  const [spId, setSpId] = React.useState('');
  const [spSecret, setSpSecret] = React.useState('');
  const [spOccupe, setSpOccupe] = React.useState('');
  const [spMsg, setSpMsg] = React.useState('');
  const connecterSpdp = async () => {
    setSpMsg(''); setSpOccupe('connexion');
    const corps = { action: 'connecter', environnement: spEnv, client_id: spId, client_secret: spSecret };
    // Les identifiants quittent le champ DÈS l'envoi : ils ne restent pas dans la page.
    setSpId(''); setSpSecret('');
    const { code, j } = await appelSuperPdp(enTeteSession(), corps);
    setSpOccupe('');
    if (code === 200 && j.ok) { setSpMsg(`Compte Super PDP connecté (${ENV_LIBELLE[j.env] || j.env}). Tes identifiants sont rangés sur le serveur — VRM ne te les remontrera plus.`); relireSpdp(); }
    else setSpMsg(j.message || (code === 0 ? "Le serveur n'a pas répondu : je ne sais pas si la connexion a été rangée. Rouvre cet écran." : 'La connexion a échoué.'));
  };
  const deconnecterSpdp = async () => {
    setSpMsg(''); setSpOccupe('deconnexion');
    const { code, j } = await appelSuperPdp(enTeteSession(), { action: 'deconnecter' });
    setSpOccupe('');
    if (code === 200 && j.ok) { setSpMsg('Compte Super PDP déconnecté : VRM a effacé tes identifiants.'); relireSpdp(); }
    else setSpMsg(j.message || "Le serveur n'a pas répondu : la connexion est peut-être toujours rangée.");
  };
  const envoiDe = (num) => (spdp && spdp.envois && num && spdp.envois[num.numero]) || null;
  const noterEnvoiLocal = (numero, envoi) => { if (!envoi) return; setSpdp((cur) => (cur && cur.envois ? { ...cur, envois: { ...cur.envois, [numero]: envoi } } : cur)); };

  const calc = React.useMemo(() => {
    if (ventes === undefined) return { etat: 'encours' };
    if (!Array.isArray(ventes)) return { etat: 'passu' };
    const hTx = new Set((load('vinted_sales_hidden', []) || []).map(String));
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const ecarte = (uid) => compteEcarte(uid, hAcc, panelOff || {});
    const uidDe = (o) => o && o._acc && o._acc.vinted_user_id;
    const lbc = lbcCoqueLu === true ? ((lbcVentes && lbcVentes.ventes) || []) : [];
    const ebay = Array.isArray(ebayCommandes) ? ebayCommandes : [];
    const decl = ventesDeclarables({ vinted: versements ? ventes : [], lbc, ebay, masquee: (o) => hTx.has(String(o && o.transaction_id)), exclu: (o) => ecarte(uidDe(o)), versements: versements || {} });
    const loginDe = (uid) => { const a = (accounts || []).find((x) => String(x.vinted_user_id) === String(uid)); return (a && a.login) || String(uid); };
    const manque = [
      ...(ko || []).filter((uid) => !ecarte(uid)).map(loginDe),
      ...(lbcCoqueLu === null ? ['Leboncoin'] : []),
      ...(ebayCommandes === null ? ['eBay'] : []),
    ];
    return { etat: 'lu', decl, manque, attente: lbcCoqueLu === undefined || ebayCommandes === undefined || versements === undefined };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, ko, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, versements, accounts, tick]);
  const recap = calc.etat === 'lu' ? recapEReporting({ lignes: calc.decl.lignes, aDater: versements ? calc.decl.aDater : [], ym, ymDe: ymDeTs, manque: calc.manque, attente: calc.attente, versementsLus: versements !== null }) : null;

  const fx = (data && data.facturx) || {};
  const numeroDe = (id) => (fx.parVente && fx.parVente[id]) || null;
  // Le numéro et les octets d'UNE vente : le même chemin pour « Facture »
  // (téléchargement) et « Envoyer à Super PDP » — une vente garde son numéro.
  const preparerFacture = async (l) => {
    let deja = numeroDe(l.id);
    let next = data;
    if (!deja) {
      const emiseLe = Date.now(), an = String(new Date(emiseLe).getFullYear());
      const compteur = { ...(fx.compteur || {}) }; const n = (Number(compteur[an]) || 0) + 1; compteur[an] = n;
      deja = { numero: `FX-${an}-${String(n).padStart(4, '0')}`, emiseLe };
      next = { ...data, facturx: { ...fx, compteur, parVente: { ...(fx.parVente || {}), [l.id]: deja } } };
    }
    const f = factureDepuisVente(l, { numero: deja.numero, emiseLe: deja.emiseLe });
    if (!isFinite(f.centimes)) throw new Error('montant illisible');
    const octets = await pdfFacturX(f, etat.vendeur);
    if (next !== data) maj(next);
    return { f, octets };
  };
  const envoyerSpdp = async (l, relireSeulement) => {
    setMsg('');
    if (!etat.ok) { setMsg(etat.raison + ' ' + etat.geste); return; }
    if (!nuage) { setMsg("Je relis d'abord les numéros de facture déjà donnés — réessaie dans un instant."); return; }
    setEnCours(l.id);
    try {
      if (relireSeulement) {
        const numero = numeroDe(l.id) && numeroDe(l.id).numero;
        const { code, j } = await appelSuperPdp(enTeteSession(), { action: 'relire', numero });
        if (j.envoi) noterEnvoiLocal(numero, j.envoi);
        setMsg(code === 200 ? `Statut relu chez Super PDP pour ${numero}.` : (j.message || "Super PDP n'a pas répondu : statut pas relu."));
        return;
      }
      const { f, octets } = await preparerFacture(l);
      noterEnvoiLocal(f.numero, { etat: 'en-cours' });
      const { code, j } = await appelSuperPdp(enTeteSession(), { action: 'envoyer', numero: f.numero, pdf: enBase64(octets) });
      if (j.envoi) noterEnvoiLocal(f.numero, j.envoi);
      // La réponse n'est pas arrivée : INCERTAIN, jamais « refusé ».
      else if (code === 0) noterEnvoiLocal(f.numero, { etat: 'incertain' });
      if (code === 200) setMsg(j.deja ? `Facture ${f.numero} : déjà chez Super PDP — rien n'a été renvoyé.` : `Facture ${f.numero} envoyée à Super PDP.`);
      else setMsg(j.message || (code === 0 ? "La réponse du serveur n'est pas arrivée : je ne sais pas si la facture est partie. « Relire » la cherchera chez Super PDP." : "L'envoi a échoué."));
      relireSpdp();
    } catch (e) { setMsg('La facture n’a pas pu être préparée : ' + String((e && e.message) || e).slice(0, 120)); }
    finally { setEnCours(''); }
  };
  const genererFacture = async (l) => {
    setMsg('');
    if (!etat.ok) { setMsg(etat.raison + ' ' + etat.geste); return; }
    if (!nuage) { setMsg("Je relis d'abord les numéros de facture déjà donnés — réessaie dans un instant."); return; }
    setEnCours(l.id);
    try {
      const { f, octets } = await preparerFacture(l);
      telechargerFichier(new Blob([octets], { type: 'application/pdf' }), nomFichierFacture(f.numero), 'application/pdf');
      setMsg(`Facture ${f.numero} téléchargée — à déposer sur ta plateforme agréée.`);
    } catch (e) { setMsg('La facture n’a pas pu être préparée : ' + String((e && e.message) || e).slice(0, 120)); }
    finally { setEnCours(''); }
  };
  const exporter = (format) => {
    if (!recap) return;
    const v = etat.ok ? etat.vendeur : null;
    if (format === 'csv') telechargerFichier(recapCsv(recap, v), `e-reporting-${ym}.csv`, 'text/csv;charset=utf-8');
    else telechargerFichier(recapJson(recap, v), `e-reporting-${ym}.json`, 'application/json');
  };

  const chip = (icon) => <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: `${C.accent}14`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} /></span>;
  const btn2 = (actif) => ({ border: `1px solid ${C.border}`, background: C.card, color: actif ? C.text : C.muted, borderRadius: 8, padding: '8px 13px', fontSize: 13, fontWeight: 600, cursor: actif ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: actif ? 1 : 0.6 });
  const peutFacturer = etat.ok && nuage;
  const raisonGrise = !etat.ok ? etat.raison : !nuage ? "Je relis d'abord les numéros de facture déjà donnés." : '';
  const parPlat = recap ? Object.entries(recap.parPlateforme) : [];
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div data-fe-carte data-fe-etat={etat.etat} data-fe-nuage={nuage ? '1' : '0'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          {chip('doc')}
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Facturation électronique</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>VRM prépare les fichiers. Connecte ton compte Super PDP pour que tes factures partent d'ici, ou dépose-les toi-même.</div>
          </div>
          <select value={ym} onChange={(e) => { setYm(e.target.value); setMsg(''); }} aria-label="Mois" data-fe-mois
            style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
            {mois.map((m) => <option key={m} value={m}>{libelleYm(m)}</option>)}
          </select>
        </div>

        <div className="vrm-fe-trois" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', borderBottom: `1px solid ${C.border}` }}>
          {[
            ['Ce que VRM prépare', 'Une facture Factur-X (PDF + données lisibles par machine) par vente, et le récapitulatif mensuel de tes ventes aux particuliers (e-reporting).'],
            ["Où l'envoyer", "Super PDP (plateforme agréée) : connecte TON compte ci-dessous, les factures partent d'ici. Ailleurs (Indy, Pennylane, Tiime…) : dépose les fichiers toi-même."],
            ['À partir de quand', 'Septembre 2027 pour les micro-entreprises — à vérifier sur impots.gouv.fr.'],
          ].map(([t, d], i) => (
            <div key={t} data-fe-explique={i} style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, marginTop: -1 }}>
              <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 4 }}>{d}</div>
            </div>
          ))}
        </div>

        {/* ── SUPER PDP : SON compte ── */}
        <div data-spdp data-spdp-etat={spdp === undefined ? 'encours' : spdp === null ? 'passu' : spdp.connecte ? 'connecte' : spdp.illisible ? 'illisible' : 'deconnecte'} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Plateforme agréée · Super PDP</div>
          {spdp === undefined && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Je lis ta connexion Super PDP…</div>}
          {spdp === null && <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.55 }}>Je n'ai pas pu lire ta connexion Super PDP (le serveur n'a pas répondu) — je ne dis ni « connecté » ni « pas connecté ». <button type="button" onClick={() => { setSpdp(undefined); relireSpdp(); }} style={{ ...btn2(true), padding: '4px 10px', marginLeft: 4 }}>Réessayer</button></div>}
          {spdp && spdp.connecte && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ flex: '1 1 220px', fontSize: 13, color: C.text, lineHeight: 1.5 }} data-spdp-env={spdp.env}>
              <strong>Connecté à Super PDP</strong> · {ENV_LIBELLE[spdp.env] || spdp.env}{spdp.env === 'sandbox' ? ' (rien ne part réellement aux impôts)' : ''}
              <div style={{ fontSize: 11, color: C.muted }}>Ce choix est celui que tu as déclaré : c'est ton compte Super PDP qui décide de l'environnement. Tes identifiants restent sur le serveur, chiffrés.</div>
            </div>
            <button type="button" data-spdp-deconnecter disabled={!!spOccupe} onClick={deconnecterSpdp} style={btn2(!spOccupe)}>{spOccupe === 'deconnexion' ? '…' : 'Déconnecter'}</button>
          </div>}
          {spdp && !spdp.connecte && <div style={{ marginTop: 8 }}>
            {spdp.illisible && <div data-spdp-illisible style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8 }}>Ta connexion Super PDP ne se lit plus côté serveur (sa clé a changé) : reconnecte-la.</div>}
            {spdp.coffre === false && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8 }}>Le serveur n'a pas de coffre configuré : aucune clé ne peut être rangée pour l'instant.</div>}
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Colle l'identifiant client et le secret client de TON compte Super PDP (espace développeur). Ils partent une seule fois au serveur, chiffrés ; VRM ne te les remontrera jamais. Les envois sont facturés sur ton compte Super PDP, pas sur celui de VRM.</div>
            <div role="radiogroup" aria-label="Environnement" style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[['sandbox', 'Bac à sable'], ['production', 'Production']].map(([k, t]) => (
                <button key={k} type="button" role="radio" aria-checked={spEnv === k} data-spdp-choix={k} onClick={() => setSpEnv(k)}
                  style={{ ...btn2(true), borderColor: spEnv === k ? C.accent : C.border, color: spEnv === k ? C.accent : C.text }}>{t}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <input data-spdp-id value={spId} onChange={(e) => setSpId(e.target.value)} placeholder="Identifiant client (client_id)" autoComplete="off" spellCheck={false}
                style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
              <input data-spdp-secret type="password" value={spSecret} onChange={(e) => setSpSecret(e.target.value)} placeholder="Secret client (client_secret)" autoComplete="new-password" spellCheck={false}
                style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
              <button type="button" data-spdp-connecter disabled={!!spOccupe || !spId.trim() || !spSecret.trim() || spdp.coffre === false} onClick={connecterSpdp} style={btn2(!spOccupe && !!spId.trim() && !!spSecret.trim() && spdp.coffre !== false)}>{spOccupe === 'connexion' ? 'Vérification…' : 'Connecter'}</button>
            </div>
          </div>}
          {spMsg && <div data-spdp-msg role="status" style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{spMsg}</div>}
        </div>

        {/* ── RÉCAP E-REPORTING ── */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Récapitulatif e-reporting · {libelleYm(ym)}</div>
          {!recap ? (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.55 }} data-fe-recap-etat={calc.etat}>
              {calc.etat === 'encours' ? 'Je lis tes ventes…' : "Je n'ai pas pu lire tes ventes : aucun total n'est affiché plutôt qu'un zéro qui ne serait pas vrai. Rouvre cet écran dans un moment."}
            </div>
          ) : (<div data-fe-recap data-recap-ym={ym} data-recap-total={eurDe(recap.centimes)} data-recap-n={recap.n} data-recap-partiel={recap.partiel ? '1' : '0'}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <div className="vrm-display" style={{ fontSize: 20, fontWeight: 750, color: C.text, letterSpacing: -0.6 }}>
                {recap.partiel && <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>au moins </span>}{fmt(recap.centimes / 100)}
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>{recap.n} vente{recap.n > 1 ? 's' : ''} · datées comme ton CA déclaré (au versement pour Vinted)</div>
            </div>
            {parPlat.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {parPlat.map(([p, x]) => <span key={p} data-recap-plateforme={p} style={{ fontSize: 11, color: C.text, border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 10px' }}>{p} · {fmt(x.centimes / 100)} · {x.n}</span>)}
            </div>}
            {recap.partiel && <div data-fe-manque style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginTop: 8 }}>
              Total partiel — il manque : {recap.manques.join(' ; ')}. Le fichier le dit aussi.
            </div>}
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>VRM ne sait pas si un acheteur est une entreprise : toutes tes ventes du mois y figurent. Retire celles faites à une entreprise (elles demandent une facture).</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" onClick={() => exporter('csv')} data-fe-recap-csv style={btn2(true)}><Icon name="save" size={14} />Récap CSV</button>
              <button type="button" onClick={() => exporter('json')} data-fe-recap-json style={btn2(true)}><Icon name="save" size={14} />Récap JSON</button>
            </div>
            {spdp && spdp.connecte && <div data-spdp-recap style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>Le récapitulatif ne part pas encore tout seul vers Super PDP : la forme de son envoi par l'API n'a pas pu être vérifiée dans leur documentation officielle. Dépose ces fichiers toi-même d'ici là.</div>}
          </div>)}
        </div>

        {/* ── FACTURES FACTUR-X ── */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Factures Factur-X · ventes de {libelleYm(ym)}</div>
          {raisonGrise && <div data-fe-raison style={{ marginTop: 8, fontSize: 13, color: C.text, lineHeight: 1.55, border: `1px solid ${C.border}`, background: C.bg, borderRadius: 8, padding: '10px 12px' }}>
            {raisonGrise}{!etat.ok && etat.geste ? <span style={{ color: C.muted }}> {etat.geste}</span> : null}
          </div>}
          {etat.ok && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>Vendeur : {etat.vendeur.nom} · SIREN {etat.vendeur.siren} · « {etat.vendeur.mention} ». Acheteur : le nom porté par la vente, sinon « Particulier ».</div>}
          {recap && recap.lignes.length === 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Aucune vente datée sur ce mois{recap.partiel ? ' (avec ce qui a pu être lu)' : ''}.</div>}
          {recap && recap.lignes.length > 0 && <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginTop: 10 }}>
            {recap.lignes.map((l, i) => {
              const num = numeroDe(l.id);
              const env = envoiDe(num), lib = libelleEnvoi(env);
              const peutEnvoyer = peutFacturer && spdp && spdp.connecte && enCours !== l.id && !(env && (env.etat === 'envoye' || env.etat === 'en-cours'));
              const peutRelire = spdp && spdp.connecte && enCours !== l.id && env && (env.etat === 'incertain' || env.etat === 'envoye');
              return (
                <div key={l.id} data-fe-vente={l.id} data-spdp-ligne={env ? env.etat : ''} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titre || 'Article'}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{l.plateforme} · {l.plateforme === 'Vinted' ? 'versée' : l.plateforme === 'eBay' ? 'payée' : 'vendue'} le {frJour(l.ts)}{num ? ` · ${num.numero}` : ''}</div>
                    {lib && <div data-spdp-statut={env.etat} style={{ fontSize: 11, marginTop: 2, lineHeight: 1.45, color: lib.ton === 'attention' ? C.warn : C.muted, overflowWrap: 'anywhere' }}>{lib.texte}</div>}
                  </div>
                  <span className="vrm-display" style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>{fmt(l.eur)}</span>
                  <button type="button" data-fe-facture={l.id} disabled={!peutFacturer || enCours === l.id} title={raisonGrise || 'Télécharger la facture Factur-X (PDF + XML)'}
                    onClick={() => genererFacture(l)} style={btn2(peutFacturer && enCours !== l.id)}>
                    <Icon name="receipt" size={14} />{enCours === l.id ? '…' : 'Facture'}
                  </button>
                  {spdp && spdp.connecte && (peutRelire
                    ? <button type="button" data-spdp-relire={l.id} onClick={() => envoyerSpdp(l, true)} style={btn2(true)}>Relire</button>
                    : <button type="button" data-spdp-envoyer={l.id} disabled={!peutEnvoyer} title={!peutFacturer ? raisonGrise : 'Envoyer la facture Factur-X à Super PDP'}
                        onClick={() => envoyerSpdp(l, false)} style={btn2(peutEnvoyer)}>{enCours === l.id ? '…' : 'Envoyer à Super PDP'}</button>)}
                </div>
              );
            })}
          </div>}
          {msg && <div data-fe-msg role="status" style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>{msg}</div>}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>Numérotation continue par année (FX-AAAA-0001) ; une vente garde toujours le même numéro. La conformité du fichier n'a pas été validée par un outil officiel : ta plateforme le vérifiera au dépôt.</div>
        </div>
      </div>
    </Card>
  );
}
function CarteUrssafMois({ liveStats, onNav }) {
  const v = useLigneUrssaf();
  const urssafMois = v ? v.mois : null;
  // `declare` : le registre « J'ai déclaré ce mois » était-il lu quand la ligne
  // a été publiée (`lu`) ou pas encore (`pasSu`) ? (revue du 6 octobre)
  const urssafInfo = v ? { aDater: v.aDater || null, sources: v.sources || null, declare: v.declare || null } : null;
  const TAUX_URSSAF = tauxUrssaf() / 100;
  const now0 = new Date();
  const moisCourant = { nom: MOIS_NOMS_FR[now0.getMonth()] };
  const ymCour = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}`;
  const eCour = urssafMois ? urssafMois.find((m) => m.ym === ymCour) : null;
  const moisCourantCA = urssafMois ? (eCour ? eCour.ca : 0) : null;
  // Le nombre vient de la MÊME ligne que le montant : ils ne peuvent pas diverger.
  const moisCourantN = urssafMois ? (eCour ? (eCour.n || 0) : 0) : null;
  const urssafEstime = moisCourantCA == null ? null : aPayerUrssaf(moisCourantCA, TAUX_URSSAF * 100);
  const netApresUrssaf = moisCourantCA == null ? null : netApresUrssafDe(moisCourantCA, TAUX_URSSAF * 100);
  const [urssafFreq, setUrssafFreq] = React.useState(() => load('vinted_urssaf_freq', 'trimestriel'));
  // §5.49 : réglage synchronisé, rattrapé seulement s'il est resté au défaut.
  React.useEffect(() => onCloudReady(() => setUrssafFreq((x) => x === 'trimestriel' ? load('vinted_urssaf_freq', 'trimestriel') : x)), []);
  const urssafDue = React.useMemo(() => nextUrssafDeadline(urssafFreq), [urssafFreq]);
  // Le « CA finalisé » de la prochaine échéance : les mois PUBLIÉS qui tombent
  // dans la période ; sans ligne publiée, `null` — un tiret, jamais un zéro.
  const urssafPeriodCA = (!urssafDue || !urssafMois) ? null : Math.round(urssafMois.reduce((s, m) => {
    const [y, mo] = m.ym.split('-'); const d = new Date(Number(y), Number(mo) - 1, 1);
    return (d >= urssafDue.periodStart && d <= urssafDue.periodEnd) ? s + (Number(m.ca) || 0) : s;
  }, 0) * 100) / 100;
  // Des ventes finalisées sans date de versement peuvent tomber dans cette
  // période : le montant de l'échéance est alors un MINIMUM, et il le dit (§5).
  const echeancePartiel = (urssafInfo && urssafInfo.aDater && Number(urssafInfo.aDater.n)) || 0;
  const versSaisiePrix = () => { DEMANDE_SAISIE_PRIX.on = true; if (onNav) onNav('vinted_annonces'); };
  const Mt = ({ v: x }) => <span style={{whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{fmt(x)}</span>;
  const sTitre = {fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15};
  const sLib = {fontSize:13,color:C.muted,fontWeight:500};
  const sNote = {fontSize:13,color:C.muted,lineHeight:1.5};
  const sHero = {fontWeight:700,color:C.text,letterSpacing:-1,lineHeight:1.05,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'};
  const sCarte = {padding:18,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:C.shadow};
  return (
    <section data-compta-urssaf="" style={{display:'flex',flexDirection:'column',gap:8}}>
      <h3 className="vrm-set-titre vrm-titre-compta" style={{color:C.muted,margin:'0 16px'}}>Ta déclaration URSSAF</h3>
      {/* ── LE MOIS EN COURS, EN UNE SEULE CARTE ────────────────────────────
          ⚠️ Il y en avait DEUX à la suite, toutes deux titrées du même mois
          (« Mois en cours — septembre », puis « À payer pour septembre »), et
          la première répétait un « CA du mois » déjà affiché quatre lignes plus
          haut — arrondi différemment (296 € contre 296,40 €). Le même nombre,
          deux fois, deux valeurs : c'est ce qui fait douter de tous les autres
          (§11). Une carte, un mois, et chaque chiffre une seule fois. */}
      {/* (16 oct., passe « premium ») Une carte, quatre chiffres, une ligne de
          calcul et la couverture en lignes courtes : tout ce qui empêche un total
          partiel de se faire passer pour complet reste VISIBLE (§5). Ce qui
          s'explique (le détail du calcul, les gestes pour dater les ventes, la
          réserve « je ne suis pas comptable ») se replie dans « Comment c'est
          calculé » au lieu de quatre pavés colorés de même poids. L'ambre ne
          reste que là où il y a vraiment quelque chose à faire (§7). */}
      {(() => {
        const now=new Date(); const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const e = (urssafMois||[]).find(m=>m.ym===ym) || {};
        const nA = Number(e.nAilleurs)||0, caA = Number(e.caAilleurs)||0;
        const ou = Object.keys(e.ailleurs||{}).sort().map(k=>{ const [y,m]=k.split('-'); return new Date(Number(y),Number(m)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); }).join(', ');
        const decl = (urssafInfo && urssafInfo.declare) || '';
        // La couverture : de la MÊME ligne publiée que le total (§5) — les
        // « dont » somment au total, et ce qui MANQUE est dit à côté.
        const par = Object.entries(e.par||{}).filter(([,v])=>v && v.n>0);
        const src = (urssafInfo && urssafInfo.sources) || {};
        const pasSu = Object.entries(src).filter(([,v])=>v==='pasSu').map(([k])=>k);
        const ad = urssafInfo && urssafInfo.aDater;
        const adV = ad && ad.par && ad.par.Vinted;
        const adL = ad && (ad.par ? ad.par.Leboncoin : (ad.n > 0 ? ad : null));
        const morceaux = [];
        const Puce = ({ children, warn }) => (
          <div style={{display:'flex',gap:8,alignItems:'baseline',color:warn?C.warn:C.muted}}>
            <span aria-hidden="true" style={{width:4,height:4,borderRadius:999,background:'currentColor',opacity:.55,flexShrink:0,transform:'translateY(-2px)'}}/>
            <span style={{minWidth:0}}>{children}</span>
          </div>
        );
        if (moisCourantCA!=null) {
          if (par.length > 1 || (par.length === 1 && par[0][0] !== 'Vinted')) morceaux.push(<Puce key="d">dont {par.map(([k,v],i)=><React.Fragment key={k}>{i?' · ':''}{k} <Mt v={v.ca}/></React.Fragment>)}</Puce>);
          if (pasSu.length) morceaux.push(<Puce key="p" warn>{pasSu.join(' et ')} : pas pu lire — {pasSu.length>1?'leurs':'ses'} ventes ne sont pas dans ce chiffre, rouvre l'écran dans un moment</Puce>);
          if (adV && adV.n > 0) morceaux.push(<Puce key="av">{adV.n} vente{adV.n>1?'s':''} Vinted finalisée{adV.n>1?'s':''} sans date de versement (<Mt v={adV.ca}/>) : dans aucun mois pour l'instant{extSait('versement')==='retard' && <span style={{color:C.warn}}> — mets l'extension à jour ({EXT_CAPACITES.versement}) : c'est elle qui va chercher ces dates</span>}</Puce>);
          if (adL && adL.n > 0) morceaux.push(<Puce key="a">{adL.n} vente{adL.n>1?'s':''} Leboncoin sans date (<Mt v={adL.ca}/>) : dans aucun mois tant que leur date n'est pas captée{extSait('lbcdate')==='retard' && <span style={{color:C.warn}}> — mets d'abord l'extension à jour ({EXT_CAPACITES.lbcdate})</span>}</Puce>);
          if (src.Vestiaire === 'nonRelie') morceaux.push(<Puce key="v">Vestiaire Collective : pas encore relié</Puce>);
        }
        const Chiffre = ({ lib, val, fort, couleur, sous, sousStyle }) => (
          <div style={{minWidth:0}}>
            <div style={sLib}>{lib}</div>
            <div className="vrm-display" style={{...sHero,fontSize:fort?28:20,letterSpacing:fort?-0.8:-0.5,marginTop:5,color:couleur||C.text}}>{val}</div>
            {sous && <div style={{...sNote,fontSize:11,marginTop:3,...(sousStyle||{})}}>{sous}</div>}
          </div>
        );
        return (
      <div data-stats-carte="mois" style={{...sCarte,padding:'20px 20px 16px'}}>
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'4px 12px',flexWrap:'wrap'}}>
          <div style={{...sTitre,fontSize:15,textTransform:'capitalize'}}>{moisCourant.nom}</div>
          <div style={{...sNote,fontSize:13}}>Ce que tu déclares à l'URSSAF</div>
        </div>
        <div className="vrm-mois-grille" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'18px 16px',marginTop:16}}>
          <Chiffre fort lib={`À payer (${String(tauxUrssaf()).replace('.',',')} %)`} val={urssafEstime==null?'—':fmt(urssafEstime)} couleur={urssafEstime==null?C.muted:C.text}/>
          <Chiffre fort lib="Net après paiement" val={netApresUrssaf==null?'—':fmt(netApresUrssaf)} couleur={netApresUrssaf==null?C.muted:C.text}/>
          {/* LA COUVERTURE À CÔTÉ, jamais à la place : une vente de ce mois
              n'est pas encore finalisée, elle n'entre donc pas dans ce qu'il
              doit déclarer — mais elle existe, et il l'a vue sur Ventes. */}
          {/* ⚠️ (revue des chiffres, 17 octobre) « sur N vendues ce mois-ci »
              présentait les finalisées comme une PARTIE des vendues. Depuis le
              3 octobre elles sont comptées au mois du VERSEMENT : une vente
              faite le mois dernier et versée ce mois-ci est dedans, sans être
              « vendue ce mois-ci » (banc chiffres-croises : « 3 sur 4 » quand
              2 seulement des 4 en font partie). Deux notions côte à côte, chacune
              son mot — jamais « sur ». */}
          <Chiffre lib="Ventes finalisées" val={moisCourantN!=null?moisCourantN:'—'} couleur={moisCourantN!=null?C.text:C.muted}
            sous={moisCourantN!=null && liveStats && liveStats.ventesMois!=null && liveStats.ventesMois!==moisCourantN ? <span data-mois-vendues={liveStats.ventesMois}>argent versé ce mois · {liveStats.ventesMois} vente{liveStats.ventesMois>1?'s':''} faite{liveStats.ventesMois>1?'s':''} ce mois-ci</span> : null}/>
          {/* ⚠️ « n/d » est du vocabulaire d'informaticien : un tiret, et la
              raison en clair — il n'est pas développeur. */}
          <Chiffre lib="Bénéfice" val={'—'} couleur={C.muted}
            sous={liveStats&&liveStats.caMois!=null ? <button type="button" onClick={versSaisiePrix} title="Ouvrir la saisie en série des prix d'achat" style={{border:'none',background:'transparent',padding:0,margin:0,font:'inherit',color:C.accent,fontWeight:600,cursor:'pointer',minHeight:0,textAlign:'left',display:'inline-flex',alignItems:'flex-start',justifyContent:'flex-start'}}>saisis tes prix d'achat →</button> : null}/>
        </div>
        {/* ⚠️⚠️ CETTE PHRASE CITAIT `moisCourant.ca` — L'ANCIENNE ARCHIVE, VIDE
            DEPUIS JUILLET 2026, donc « (0,00 €) ». Les CHIFFRES avaient été
            rebranchés sur la ligne publiée, la phrase qui les explique était
            restée en arrière (§5). Elle cite le MÊME montant que celui qui
            produit « à payer », et reste visible (le banc urssaf.cjs la lit).
            ⚠️ (revue du 6 octobre) une vente versée ce mois-ci mais déjà
            déclarée ailleurs est EXCLUE : la phrase le dit, des MÊMES champs de
            la MÊME ligne publiée (`nAilleurs`, `caAilleurs`, `ailleurs`) — et
            dit aussi quand le registre n'était pas encore lu (`declare`). */}
        <div style={{...sNote,fontSize:13,marginTop:10,paddingTop:14,borderTop:`1px solid ${C.border}`,lineHeight:1.55}}>
          {moisCourantCA==null
            ? <>Ce chiffre se calcule sur l'écran <b>Ventes</b> : ouvre-le une fois sur cet appareil et il s'affichera ici.</>
            : <span data-urssaf-declare={decl}>Calculé sur le CA des ventes finalisées en {moisCourant.nom}, toutes plateformes (<b style={{color:C.text,fontWeight:600}}><Mt v={moisCourantCA}/></b>)
                {nA > 0 && <span data-urssaf-ailleurs={Math.round(caA*100)} data-urssaf-ailleurs-n={nA}>, hors {nA} vente{nA>1?'s':''} (<Mt v={caA}/>) déjà dans ta déclaration{ou ? <> de {ou}</> : null}</span>}
                .
                {decl === 'pasSu' && <span style={{color:C.warn}}> Tes déclarations passées (« J'ai déclaré ce mois ») n'étaient pas encore chargées quand ce chiffre a été calculé : une vente déjà déclarée peut encore y être comptée — ouvre l'écran <b>Ventes</b> pour le mettre à jour.</span>}
              </span>}
        </div>
        {morceaux.length > 0 && <div data-urssaf-couverture style={{...sNote,marginTop:8,display:'flex',flexDirection:'column',gap:4}}>{morceaux}</div>}
        {/* ⚠️ HONNÊTETÉ (§5.57) : l'URSSAF veut le CA ENCAISSÉ, et l'app dit
            comment elle date chaque vente — replié, pas retiré. */}
        <details className="vrm-stats-calcul" style={{marginTop:10}}>
          <summary style={{cursor:'pointer',fontSize:13,fontWeight:500,color:C.muted,padding:'6px 0'}}>Comment c'est calculé</summary>
          <div style={{...sNote,display:'flex',flexDirection:'column',gap:8,padding:'4px 0 6px'}}>
            {moisCourantCA!=null && <div>On additionne les ventes <b>finalisées</b> (argent versé) en {moisCourant.nom}, <b>toutes plateformes</b>, ventes masquées comprises{nA > 0 && <> — {nA>1?'les ventes versées':'la vente versée'} ce mois-ci mais déjà dans ta déclaration{ou ? <> de {ou}</> : null} {nA>1?'ne sont pas recomptées':'n\'est pas recomptée'} ici</>}. C'est la somme à verser à la fin du mois (versement libératoire).</div>}
            {moisCourantCA!=null && adV && adV.n > 0 && extSait('versement')!=='retard' && <div>Ventes Vinted sans date de versement : {extSait('versement')==='ok' ? <>l'extension va chercher leur date à tes prochaines visites sur Vinted (compte par compte)</> : <>c'est l'extension, sur ton ordinateur, qui va chercher ces dates</>}.</div>}
            {moisCourantCA!=null && adL && adL.n > 0 && <div>Ventes Leboncoin sans date : {extSait('lbcdate')==='ok' ? <>ouvre « Mes transactions » sur leboncoin.fr, l'extension la relève au passage</> : extSait('lbcdate')==='retard' ? <>une fois l'extension à jour, ouvre « Mes transactions » sur leboncoin.fr</> : <>depuis l'ordinateur où l'extension est installée, ouvre « Mes transactions » sur leboncoin.fr</>}.</div>}
            {moisCourantCA!=null && (e.par||{}).Leboncoin && <div>Leboncoin : daté au jour de la vente (sa date de versement n'est pas encore captée).</div>}
            <div>Ces ventes sont datées au jour où la plateforme t'a <b>versé l'argent</b> (la commande finalisée par l'acheteur), pas au jour de la vente. Vérifie ton taux et ton chiffre sur autoentrepreneur.urssaf.fr — je ne suis pas comptable.</div>
          </div>
        </details>
        {/* Prochaine échéance de DÉCLARATION (rappel) — un encart neutre ; la
            couleur ne vient QUE si l'échéance presse (≤ 14 j) ou est passée. */}
        <div style={{marginTop:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap'}}>
            <span style={{...sTitre,fontSize:13,flex:1}}>Prochaine déclaration</span>
            <div style={{display:'flex',gap:2,background:C.card2||C.surface,borderRadius:10,padding:2}}>
              {[['trimestriel','Trimestre'],['mensuel','Mois']].map(([v,l])=>(
                <button type="button" key={v} onClick={()=>{setUrssafFreq(v);save('vinted_urssaf_freq',v);}} style={{border:'none',borderRadius:8,padding:'5px 11px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minHeight:0,background:urssafFreq===v?C.card:'transparent',color:urssafFreq===v?C.text:C.muted,boxShadow:urssafFreq===v?C.shadow:'none'}}>{l}</button>
              ))}
            </div>
          </div>
          {urssafDue ? (()=>{
            const late=urssafDue.daysLeft<0, soon=urssafDue.daysLeft>=0&&urssafDue.daysLeft<=14;
            const col=late?C.danger:soon?C.warn:C.text;
            return (
              <div style={{background:C.card2||C.bg,borderRadius:12,padding:'14px 14px 12px',border:(late||soon)?`1px solid ${col}55`:`1px solid transparent`}}>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'2px 10px',flexWrap:'wrap'}}>
                  <span style={{fontSize:15,fontWeight:700,color:col,letterSpacing:-0.2,whiteSpace:'nowrap'}}>{urssafDue.dueDate.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</span>
                  <span style={{fontSize:13,fontWeight:600,color:(late||soon)?col:C.muted,whiteSpace:'nowrap'}}>{late?`en retard de ${-urssafDue.daysLeft} j`:urssafDue.daysLeft===0?"aujourd'hui !":`dans ${urssafDue.daysLeft} j`}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'4px 12px',marginTop:10,fontSize:13,color:C.muted}}>
                  <span>Période</span><span style={{color:C.text,fontWeight:500,textAlign:'right'}}>{urssafDue.label}</span>
                  {/* (revue du 19 oct.) Ce montant vient de la ligne publiée, datée au
                      VERSEMENT : c'est le « Reçu (versé) » du tableau juste au-dessus,
                      pas son « Finalisé ». Le libellé « CA finalisé » le contredisait
                      sur le même écran (septembre : 0,00 € ici, 4 224,77 € là). */}
                  <span>Reçu (versé)</span><span data-echeance-ca={urssafPeriodCA==null?'':String(urssafPeriodCA)} data-echeance-de={urssafDue.periodStart.toISOString()} data-echeance-a={urssafDue.periodEnd.toISOString()} data-echeance-partiel={echeancePartiel||undefined} style={{color:urssafPeriodCA==null?C.muted:C.text,fontWeight:500,textAlign:'right'}}>{urssafPeriodCA==null?'—':<>{echeancePartiel>0?'au moins ':''}<Mt v={urssafPeriodCA}/></>}</span>
                  <span>À payer ≈</span><span data-echeance-apayer={urssafPeriodCA==null?'':String(aPayerUrssaf(urssafPeriodCA, TAUX_URSSAF*100))} style={{color:urssafPeriodCA==null?C.muted:C.text,fontWeight:700,textAlign:'right'}}>{urssafPeriodCA==null?'—':<>{echeancePartiel>0?'au moins ':''}<Mt v={aPayerUrssaf(urssafPeriodCA, TAUX_URSSAF*100)}/></>}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'6px 12px',flexWrap:'wrap',marginTop:12}}>
                  <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" data-declarer-urssaf="" style={{fontSize:13,fontWeight:600,color:C.onAccent||'#fff',background:C.accent,borderRadius:10,padding:'8px 14px',textDecoration:'none',minHeight:44,boxSizing:'border-box',display:'inline-flex',alignItems:'center'}}>Déclarer sur l'URSSAF →</a>
                  <span style={{fontSize:11,color:C.muted,lineHeight:1.4,flex:'1 1 160px'}}>Estimation ({String(tauxUrssaf()).replace('.',',')} %) — le chiffre officiel se saisit là‑bas.</span>
                </div>
              </div>
            );
          })() : <div style={{fontSize:13,color:C.muted}}>Aucune échéance à venir.</div>}
        </div>
      </div>
        );
      })()}


    </section>
  );
}
// Le récap comptable mensuel : la MÊME ligne publiée, mois par mois (§11).
// ⚠️ Le bénéfice n'est pas calculable ici (les prix d'achat vivent sur l'écran
// Annonces) : « — », jamais un zéro qui passerait pour un vrai chiffre.
function RecapComptableMensuel() {
  const v = useLigneUrssaf();
  const urssafMois = v ? v.mois : null;
  const TAUX_URSSAF = tauxUrssaf() / 100;
  const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const moisRecap = !urssafMois ? [] : urssafMois.map((m) => {
    const [y, mo] = String(m.ym || '').split('-');
    return { ym: m.ym, label: `${moisNoms[Number(mo) - 1] || mo} ${y}`, ca: Number(m.ca) || 0, profit: null, count: m.n,
             urssaf: aPayerUrssaf(m.ca, TAUX_URSSAF * 100), net: netApresUrssafDe(m.ca, TAUX_URSSAF * 100) };
  });
  const exportCompta = () => {
    try {
      const rows = [['Mois','Ventes','CA finalise','Benefice',`Cotisations+impot ${String(tauxUrssaf()).replace('.',',')}%`,'Net estime']];
      moisRecap.forEach((m) => rows.push([m.label, m.count, m.ca.toFixed(2), m.profit == null ? '' : m.profit.toFixed(2), m.urssaf.toFixed(2), m.net.toFixed(2)]));
      const csv = rows.map((r) => r.join(';')).join('\n');
      telechargerFichier(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `vrm-comptabilite-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    } catch (err) { toast('Erreur export : ' + err.message); }
  };
  return (
    <>
      {/* Récap comptable mensuel */}
      {moisRecap.length>0&&(
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>📊 Récap comptable mensuel</span>
            <Btn small onClick={exportCompta} style={{fontSize:13}}>📥 Exporter (CSV · Excel · Numbers)</Btn>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {['Mois','Ventes','CA finalisé','Bénéfice',`Cotis.+impôt ${String(tauxUrssaf()).replace('.',',')} %`,'Net estimé'].map(h=>(
                    <th key={h} style={{textAlign:h==='Mois'?'left':'right',padding:'8px 10px',color:C.muted,fontWeight:600,fontSize:11,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moisRecap.map(m=>(
                  <tr key={m.label} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:'8px 10px',fontWeight:600,color:C.text,whiteSpace:'nowrap'}}>{m.label}</td>
                    <td style={{padding:'8px 10px',textAlign:'right'}}>{m.count}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:500,whiteSpace:'nowrap'}}>{fmt(m.ca)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:m.profit==null?C.muted:C.text,whiteSpace:'nowrap'}}>{m.profit==null?'—':fmt(m.profit)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:C.muted,whiteSpace:'nowrap'}}>{fmt(m.urssaf)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:C.text,fontWeight:600,whiteSpace:'nowrap'}}>{fmt(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* ⚠️ (revue des chiffres, 17 octobre) Cette phrase disait « ventes que
              Vinted a marquées finalisées, à leur date de vente » — sous un
              tableau qui lit la ligne publiée par Ventes (`vinted_urssaf_mois`) :
              TOUTES plateformes, datée au VERSEMENT depuis le 3 octobre, et au
              mois de déclaration quand il l'a notée. La carte du mois, au-dessus,
              disait le contraire sur le même écran. La phrase qui explique un
              chiffre vient de la même source que lui (§5) : `data-regle` dit
              laquelle a produit les lignes. */}
          <div data-recap-regle={urssafMois?'versement':'archive'} style={{fontSize:11,color:C.muted,marginTop:12,lineHeight:1.5}}>
            {urssafMois
              ? <>Ventes <b>finalisées</b>, toutes plateformes, comptées dans le mois où l'argent a été versé (Vinted), de la vente (Leboncoin), de la commande payée (eBay) — ou dans le mois où tu les as déclarées. Annulées et remboursements exclus, ventes masquées comprises ; une vente sans date de versement n'est dans aucun mois.</>
              : <>Ventes de l'ancienne archive, à leur date de réception — annulées et remboursements exclus.</>} Cotisations estimées à {String(tauxUrssaf()).replace('.',',')} % (taux réglable dans Réglages). La déclaration se fait sur autoentrepreneur.urssaf.fr.
          </div>
        </Card>
      )}


    </>
  );
}

function ComptaLigne({ gauche, droite, onDel, extra, attrs }) {
  return (
    <div className="vrm-set-ligne" {...(attrs || {})}>
      <span className="vrm-set-lib">{gauche}</span>
      <span className="vrm-display" style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{droite}</span>
      {extra}
      <button type="button" onClick={onDel} title="Supprimer" aria-label="Supprimer" style={{ border: 'none', background: 'transparent', color: C.muted, fontSize: 20, cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: '0 2px', minHeight: 36, minWidth: 28 }}>×</button>
    </div>
  );
}
// (16 oct.) Une section = un GROUPE comme dans Réglages : le titre en casse
// normale au-dessus (son total à droite), une liste à lignes, la note en pied.
// Le formulaire d'ajout ne s'ouvre plus d'office : une ligne « + Ajouter… »
// le déplie dans la liste (trois formulaires toujours ouverts écrasaient
// l'écran, placeholders tronqués compris).
function ComptaSection({ titre, note, total, totalSub, children, data }) {
  return (
    <section className="vrm-set-groupe vrm-compta-groupe" data-compta-section={data} style={{ margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '0 16px 8px' }}>
        <h3 className="vrm-set-titre vrm-titre-compta" style={{ color: C.muted, margin: 0 }}>{titre}</h3>
        {total != null && <span style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}><b className="vrm-display" style={{ color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</b>{totalSub ? ` ${totalSub}` : ''}</span>}
      </div>
      <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>{children}</div>
      {note && <div className="vrm-set-pied" style={{ color: C.muted }}>{note}</div>}
    </section>
  );
}
// Ligne « + Ajouter… » d'une section : déplie le formulaire dans la liste.
function ComptaAjout({ ouvert, onClick, libelle, data }) {
  return (
    <button type="button" className="vrm-set-ligne" onClick={onClick} aria-expanded={ouvert} {...data} style={{ color: C.accent }}>
      <span className="vrm-set-lib"><b style={{ color: C.accent, fontWeight: 600 }}>{ouvert ? 'Fermer' : `+ ${libelle}`}</b></span>
    </button>
  );
}
function BeneficeCompta({ compta, onNav }) {
  const [periode, setPeriode] = React.useState(() => { try { const v = localStorage.getItem('vrm_compta_periode_benef'); return PERIODES_BENEF.some(([k]) => k === v) ? v : 'mois'; } catch (_) { return 'mois'; } });
  const choisir = (p) => { setPeriode(p); try { localStorage.setItem('vrm_compta_periode_benef', p); } catch (_) {} };
  const { pub, etat, B } = useBeneficeCalcul(compta, periode);
  const versSaisiePrix = () => { DEMANDE_SAISIE_PRIX.on = true; if (onNav) onNav('vinted_annonces'); };
  const e2 = (x) => x == null ? '' : String(Math.round(x * 100) / 100);
  const sansAchat = B ? B.n - B.nCout : 0;
  const Ligne = ({ lib, val, sous, fort, data }) => (
    <div className="vrm-set-ligne" {...(data || {})}>
      <span className="vrm-set-lib"><b style={{ color: C.text }}>{lib}</b>{sous ? <small style={{ color: C.muted }}>{sous}</small> : null}</span>
      <span className="vrm-display" style={{ fontSize: fort ? 20 : 15, fontWeight: fort ? 700 : 600, color: val == null ? C.muted : C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{val == null ? '—' : fmt(val)}</span>
    </div>
  );
  const lienSaisie = <button type="button" onClick={versSaisiePrix} data-benef-porte="" style={{ background: 'none', border: 0, padding: 0, color: C.accent, fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Compléter les prix d'achat</button>;
  return (
    <section className="vrm-set-groupe vrm-compta-groupe" style={{ margin: 0 }}
      data-benef-etat={etat} data-benef-periode={periode}
      data-benef-n={B ? String(B.n) : ''} data-benef-ncout={B ? String(B.nCout) : ''}
      data-benef-brut={B && B.nCout > 0 ? e2(B.brut) : ''} data-benef-ventes-net={B && B.nCout > 0 ? e2(B.net) : ''}
      data-benef-charges={B ? e2(B.charges) : ''} data-benef-cotis={B ? e2(B.cotis) : ''}
      data-benef-net={B ? e2(B.netFinal) : ''} data-benef-raison={B ? B.raison : ''}
      data-benef-couverture={B ? couvertureBenefice(B) : ''} data-benef-plateformes={B ? (B.toutes ? 'toutes' : 'vinted') : ''}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 16px 8px' }}>
        <h3 className="vrm-set-titre vrm-titre-compta" style={{ color: C.muted, margin: 0, flex: '1 1 auto' }}>Ton bénéfice{B ? ` · ${B.libelle}` : ''}</h3>
        <Segmente label="Période du bénéfice" value={periode} onChange={choisir} style={{ margin: 0, flex: '0 1 300px' }}
          options={PERIODES_BENEF.map(([k, l]) => ({ v: k, l, data: { 'data-benef-choix': k } }))} />
      </div>
      <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>
        {!B ? (
          <div className="vrm-set-ligne"><span className="vrm-set-lib"><small style={{ color: C.muted, marginTop: 0, lineHeight: 1.5 }}>
            {etat === 'encours' ? 'Je lis ton bénéfice…' : <>Ton bénéfice se calcule dans l'écran Ventes, à partir de tes prix d'achat : ouvre-le une fois{onNav ? <> (<a href="?tab=cat_ventes" onClick={(ev) => { ev.preventDefault(); onNav('cat_ventes'); }} style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>Ventes</a>)</> : null}, il arrivera ici.</>}
          </small></span></div>
        ) : (<>
          <Ligne lib="Bénéfice brut" val={B.nCout > 0 ? B.brut : (B.n === 0 ? 0 : null)}
            sous={B.n === 0 ? (B.toutes ? 'aucune vente finalisée sur la période' : 'aucune vente Vinted finalisée sur la période')
              : B.nCout === B.n ? `CA − prix d'achat · prix d'achat connus pour les ${B.n} vente${B.n > 1 ? 's' : ''}`
              : <>CA − prix d'achat · prix d'achat connus pour {B.nCout} vente{B.nCout > 1 ? 's' : ''} sur {B.n} — {lienSaisie}</>}
            data={{ 'data-benef-ligne': 'brut' }} />
          {B.nCout > 0 && (B.fraisCouverts > 0 || B.fraisInconnus > 0) && <Ligne lib="− boosts et frais de vente" val={B.fraisInconnus > 0 ? null : B.fraisCouverts} sous={B.fraisInconnus > 0 ? `frais eBay pas connus pour ${B.fraisInconnus} vente${B.fraisInconnus > 1 ? 's' : ''}` : 'des mêmes ventes'} data={{ 'data-benef-ligne': 'frais' }} />}
          <Ligne lib="− charges" val={B.charges} sous="abonnements, dépenses, packs et coûts fixes de la période" data={{ 'data-benef-ligne': 'charges' }} />
          <Ligne lib="− cotisations URSSAF" val={B.cotis}
            sous={B.cotis == null ? 'ton CA déclaré se calcule dans l\'écran Ventes' : `${String(tauxUrssaf()).replace('.', ',')} % du CA ${B.toutes ? 'déclaré (Vinted, Leboncoin, eBay)' : 'Vinted'} versé sur la période (${fmt(B.caDecl)})`}
            data={{ 'data-benef-ligne': 'cotis' }} />
          <Ligne lib="Bénéfice net" fort val={B.netFinal}
            sous={B.raison === 'achats' ? <>il manque le prix d'achat de {sansAchat} vente{sansAchat > 1 ? 's' : ''} : sans lui, le net ne se calcule pas — {lienSaisie}</>
              : B.raison === 'frais' ? 'des frais eBay ne sont pas connus : sans eux, le net ne se calcule pas'
              : B.raison === 'cotisations' ? 'en attente de ton CA déclaré (écran Ventes)'
              : 'brut − frais − charges − cotisations'}
            data={{ 'data-benef-ligne': 'net' }} />
          <div className="vrm-set-ligne"><span className="vrm-set-lib"><small style={{ color: C.muted, marginTop: 0, lineHeight: 1.5 }}>
            {B.toutes ? <>Ventes finalisées Vinted, Leboncoin et eBay, au jour de la vente — la même règle que l'écran Ventes.{couvertureBenefice(B) ? ` Prix d'achat connus : ${couvertureBenefice(B)}.` : ''} Une vente Leboncoin ou eBay se relie à sa paire par son SKU VRM, sa référence ou un lien posé, jamais par son titre.</> : <>Ventes Vinted finalisées, au jour de la vente — publiées par une version d'avant de l'écran Ventes : ouvre-le une fois pour y ajouter Leboncoin et eBay.</>} Les cotisations sont celles du CA versé sur la période.{pub.at ? ` Calculé avec tes ventes lues le ${new Date(pub.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.` : ''}
          </small></span></div>
        </>)}
      </div>
    </section>
  );
}
function ComptaPro({ liveStats, onNav, lbcVentes, lbcCoqueLu, ebayCommandes, panelOff, accounts }) {
  const [data, setData] = React.useState(() => {
    try { const d = load('vrm_compta', null); return d && typeof d === 'object' ? { ...COMPTA_DEFAUT, ...d } : { ...COMPTA_DEFAUT }; }
    catch (_) { return { ...COMPTA_DEFAUT }; }
  });
  // Rattrapage nuage : on ne remplace QUE si rien n'a encore été saisi (§5.49).
  React.useEffect(() => onCloudReady(() => {
    try { const d = load('vrm_compta', null); if (d && typeof d === 'object') setData(cur => comptaVide(cur) ? { ...COMPTA_DEFAUT, ...d } : cur); } catch (_) {}
  }), []);
  const maj = (next) => { setData(next); try { save('vrm_compta', next); } catch (_) {} };
  const depenses = data.depenses || [], fixes = data.fixes || [], packs = data.packs || [], abonnements = data.abonnements || [];

  // ── Totaux, tous OWNED (aucun CA recalculé ici) ───────────────────────────
  const annee = new Date().getFullYear();
  const moisEcoules = new Date().getMonth() + 1;          // janvier = 1
  const moisCle = ymCourant();
  const cetteAnnee = (d) => String(d || '').slice(0, 4) === String(annee);
  const somme = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const fixesParMois = somme(fixes, x => x.montant);
  // Total annuel et total du mois : UNE seule règle, partagée avec le rapport annuel (§11).
  const charges = comptaChargesAnnee(data, annee);
  const chargesAnnee = charges.total;
  const chargesDuMois = comptaChargesMois(data, moisCle);
  const chargesMois = chargesDuMois.total;

  // ── RÉSULTAT = recettes déclarées − charges ───────────────────────────────
  // On CONSOMME la ligne publiée par l'écran Ventes (`vinted_urssaf_mois`, le CA
  // déclaré, toutes plateformes, §11) — on ne recalcule aucun CA. Ligne
  // absente/pas encore publiée ⇒ `null` (on n'invente pas de recettes).
  // ⚠️ Ce n'est PAS le bénéfice : le prix d'achat des paires n'est pas déduit
  // ici — le bénéfice brut et net vit dans `BeneficeCompta`, juste en dessous.
  // ⚠️ (17 octobre) TROIS ÉTATS, ET LA LIGNE SE RELIT QUAND ELLE CHANGE. Elle
  // était lue une fois au rendu : sur un appareil qui n'avait jamais ouvert
  // Ventes, la carte disait « ton CA déclaré arrive sur cet appareil » — rien ne
  // l'y amenait (la ligne n'était pas synchronisée) — pendant que la carte « CA
  // par période », juste en dessous, chiffrait déjà le reçu du mois. La ligne
  // est maintenant synchronisée (elle arrive avec le nuage) et la carte la relit
  // à l'arrivée du nuage et à chaque publication :
  //   `encours` (nuage pas encore arrivé) · `passu` (nuage arrivé, jamais
  //   publiée : « — » et où elle se calcule) · `lu`.
  const lireLigneCa = () => { try { const v = load('vinted_urssaf_mois', null); return v && Array.isArray(v.mois) ? v : null; } catch (_) { return null; } };
  const [ligneCa, setLigneCa] = React.useState(lireLigneCa);
  const [nuagePret, setNuagePret] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => { setNuagePret(true); setLigneCa(lireLigneCa()); }), []);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_urssaf_mois') setLigneCa(lireLigneCa()); };
    const g = (e) => { if (e && e.key === 'vinted_urssaf_mois') setLigneCa(lireLigneCa()); };
    window.addEventListener('vrm:save', f); window.addEventListener('storage', g);
    return () => { window.removeEventListener('vrm:save', f); window.removeEventListener('storage', g); };
  }, []);
  const etatCa = ligneCa ? 'lu' : (nuagePret ? 'passu' : 'encours');
  const caAt = ligneCa && Number(ligneCa.at) > 0 ? Number(ligneCa.at) : null;
  const recettesAnnee = ligneCa
    ? ligneCa.mois.filter(m => String(m.ym || '').slice(0, 4) === String(annee)).reduce((s, m) => s + (Number(m.ca) || 0), 0)
    : null;
  const resultatAnnee = recettesAnnee == null ? null : recettesAnnee - chargesAnnee;
  // ⚠️ (revue des chiffres, 17 octobre) LA COUVERTURE DE LA MÊME LIGNE. Ce CA
  // se présentait comme complet alors que la ligne publiée peut dire « eBay :
  // pas pu lire » ou porter des ventes finalisées sans date (dans aucun mois) —
  // ce que la carte URSSAF du tableau de bord dit, sur la MÊME ligne. Un total
  // partiel qui se présente comme complet est pire qu'un total absent (§5).
  const couvertureCa = (() => {
    if (!ligneCa) return null;
    const pasSu = Object.entries(ligneCa.sources || {}).filter(([, e]) => e === 'pasSu').map(([k]) => k);
    const ad = ligneCa.aDater && Number(ligneCa.aDater.n) > 0 ? { n: Number(ligneCa.aDater.n), ca: Number(ligneCa.aDater.ca) || 0 } : null;
    return { pasSu, aDater: ad };
  })();
  const caPartiel = !!(couvertureCa && couvertureCa.pasSu.length);

  // ── Formulaires d'ajout (états locaux) ────────────────────────────────────
  const auj = new Date().toISOString().slice(0, 10);
  const [dDate, setDDate] = React.useState(auj);
  const [dLib, setDLib] = React.useState('');
  const [dCat, setDCat] = React.useState(COMPTA_CATS[0]);
  const [dMnt, setDMnt] = React.useState('');
  const [dErr, setDErr] = React.useState('');
  const [pPlat, setPPlat] = React.useState('Leboncoin');
  const [pCpt, setPCpt] = React.useState('');
  const [pMnt, setPMnt] = React.useState('');
  const [pDate, setPDate] = React.useState(auj);
  const [aLib, setALib] = React.useState('');
  const [aMnt, setAMnt] = React.useState('');
  const [aPer, setAPer] = React.useState('mois');
  const [aDeb, setADeb] = React.useState(auj);
  const [aFin, setAFin] = React.useState('');
  const [aErr, setAErr] = React.useState('');
  const [ouvert, setOuvert] = React.useState('');          // '' · 'abo' · 'dep' · 'pack' : un formulaire à la fois
  const [packLbc, setPackLbc] = React.useState(undefined);
  React.useEffect(() => {
    let mort = false;
    fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_pack_photo&select=actif:data->actif,at:data->>at`, { headers: sbAuth() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (mort) return; const x = Array.isArray(j) ? j[0] : null; setPackLbc(x && typeof x.actif === 'boolean' ? { actif: x.actif, at: x.at || null } : null); })
      .catch(() => { if (!mort) setPackLbc(null); });
    return () => { mort = true; };
  }, []);
  const basculer = (k) => setOuvert(o => o === k ? '' : k);

  const ajouterDepense = () => {
    const m = parseMontant(dMnt);
    if (!dLib.trim()) { setDErr('Dis en deux mots ce que tu as payé (ex. « cartons »).'); return; }
    if (!m) { setDErr('Le montant doit être un nombre en euros, par exemple 12,50.'); return; }
    setDErr('');
    maj({ ...data, depenses: [{ id: rCompId(), date: dDate || auj, libelle: dLib.trim(), cat: dCat, montant: m }, ...depenses] });
    setDLib(''); setDMnt(''); setDCat(COMPTA_CATS[0]); setDDate(auj); setOuvert('');
  };
  const ajouterPack = () => {
    const m = parseMontant(pMnt); if (!m) return;
    maj({ ...data, packs: [{ id: rCompId(), plateforme: pPlat, compte: pCpt.trim(), montant: m, date: pDate || auj }, ...packs] });
    setPCpt(''); setPMnt(''); setPDate(auj); setOuvert('');
  };
  // Un abonnement mal saisi n'est pas ajouté, et on DIT pourquoi (jamais en silence).
  const ajouterAbonnement = () => {
    const m = parseMontant(aMnt);
    if (!aLib.trim()) { setAErr('Donne-lui un nom (ex. « VRM », « Canva »).'); return; }
    if (!m) { setAErr('Le montant doit être un nombre en euros, par exemple 12,99.'); return; }
    if (!ymCompta(aDeb)) { setAErr('Il faut une date de début.'); return; }
    if (aFin && aFin < aDeb) { setAErr('La date de fin est avant la date de début.'); return; }
    maj({ ...data, abonnements: [{ id: rCompId(), libelle: aLib.trim(), montant: m, periode: aPer === 'an' ? 'an' : 'mois', debut: aDeb, fin: aFin || '' }, ...abonnements] });
    setALib(''); setAMnt(''); setAPer('mois'); setADeb(auj); setAFin(''); setAErr(''); setOuvert('');
  };
  const terminerAbonnement = (id) => maj({ ...data, abonnements: abonnements.map(a => a.id === id ? { ...a, fin: auj } : a) });
  const retirer = (cle, id) => maj({ ...data, [cle]: (data[cle] || []).filter(x => x.id !== id) });
  // Export CSV des charges pour le comptable (date · type · libellé · montant).
  const exporterCharges = () => {
    const e = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const L = [[`Charges ${annee}`], [], ['Date', 'Type', 'Libelle', 'Montant']];
    depenses.filter(d => cetteAnnee(d.date)).forEach(d => L.push([d.date ? d.date.split('-').reverse().join('/') : '', 'Depense' + (d.cat ? ' (' + d.cat + ')' : ''), d.libelle || '', (Number(d.montant) || 0).toFixed(2)]));
    packs.filter(p => cetteAnnee(p.date)).forEach(p => L.push([p.date ? p.date.split('-').reverse().join('/') : '', 'Pack / option', `${p.plateforme || ''}${p.compte ? ' ' + p.compte : ''}`, (Number(p.montant) || 0).toFixed(2)]));
    charges.aboLignes.forEach(x => L.push([x.a.debut ? x.a.debut.split('-').reverse().join('/') : '', `Abonnement x${x.n} echeance${x.n > 1 ? 's' : ''}`, x.a.libelle || '', x.total.toFixed(2)]));
    fixes.forEach(f => L.push(['', `Cout fixe x${moisEcoules} mois`, f.libelle || '', ((Number(f.montant) || 0) * moisEcoules).toFixed(2)]));
    L.push(['', '', 'TOTAL', chargesAnnee.toFixed(2)]);
    const csv = L.map(r => r.map(e).join(';')).join('\n');
    try {
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `charges-${annee}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (_) {}
  };

  // Factures reçues (reçus Vinted par email) : on consomme juste le NOMBRE pour
  // renvoyer vers l'écran Factures, on ne duplique pas la liste (§7/§11).
  const [nFactures, setNFactures] = React.useState(null);
  React.useEffect(() => { let stop = false; fetchProInvoices().then(r => { if (!stop) setNFactures(Array.isArray(r) ? r.length : null); }).catch(() => {}); return () => { stop = true; }; }, []);

  // ── Palette d'écran (§7 : neutre partout, UN accent rare) ──────────────────
  const inp = { border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 15, fontFamily: 'inherit', minWidth: 0, outline: 'none', boxSizing: 'border-box', minHeight: 40 };
  const btnAdd = { border: 'none', background: C.accent, color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, minHeight: 40 };
  const formBox = { padding: '12px 16px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 };
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: C.muted, flex: '1 1 140px', minWidth: 0 };
  const pastille = (actif) => ({ border: `1px solid ${actif ? C.text : C.border}`, background: actif ? C.text : 'transparent', color: actif ? C.card : C.text, borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 });
  // Section et Ligne vivent HORS du composant : définies ici, elles changeaient
  // d'identité à chaque rendu et React remontait leurs champs — le curseur
  // sautait à chaque lettre tapée.
  const Ligne = ComptaLigne, Section = ComptaSection;
  const vide = (txt) => <div className="vrm-set-ligne"><span className="vrm-set-lib"><small style={{ color: C.muted, marginTop: 0 }}>{txt}</small></span></div>;
  const listeBox = (items) => items;
  const dateFr = (s) => String(s || '').split('-').reverse().join('/');
  // (16 oct.) Un LIEN dans une phrase, pas un bouton : la règle des boutons
  // (hauteur plancher au doigt) étirait la ligne qui le portait — un
  // interligne de ~2 dans le paragraphe du résultat.
  const lienBtn = (txt, tab, fs = 13) => <a href={`?tab=${tab}`} onClick={(e) => { e.preventDefault(); if (onNav) onNav(tab); }} style={{ color: C.accent, fontWeight: 600, cursor: 'pointer', fontSize: fs, textDecoration: 'none' }}>{txt}</a>;

  return (
    <div className="vrm-finance-page" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHead icon="euro" title="Comptabilité" desc="Tes charges, tes abonnements et ton chiffre d'affaires par période — chaque euro compte dans ton résultat." />

      {/* ── HÉRO : LE RÉSULTAT ─────────────────────────────────────────────────
          Recettes déclarées (ligne publiée par Ventes, §11) − charges. Le seul
          endroit où l'accent est permis (§7 : rare) : le filet du haut. */}
      <Card className="vrm-finance-result" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px' }} data-compta-resultat={resultatAnnee == null ? '' : String(Math.round(resultatAnnee * 100) / 100)} data-compta-ca={recettesAnnee == null ? '' : String(Math.round(recettesAnnee * 100) / 100)} data-compta-charges={String(Math.round(chargesAnnee * 100) / 100)} data-compta-ca-etat={etatCa} data-compta-ca-at={caAt ? new Date(caAt).toISOString() : ''}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 500, marginBottom: 6 }}>Résultat {annee} · CA déclaré − charges</div>
          {recettesAnnee == null ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <div className="vrm-display" style={{ fontSize: 28, fontWeight: 700, color: C.muted, letterSpacing: -0.8 }}>—</div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Tes charges {annee} : <span className="vrm-display">{fmt(chargesAnnee)}</span></div>
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>
                {etatCa === 'encours'
                  ? 'Je lis ton CA déclaré…'
                  : <>Ton CA déclaré n'a encore été calculé sur aucun de tes appareils : il se calcule dans {lienBtn('Ventes', 'cat_ventes')}. Ouvre-le une fois, et tes charges y seront déduites ici.</>}
              </div>
            </div>
          ) : (
            <div>
              <div className="vrm-display" style={{ fontSize: 28, fontWeight: 700, color: resultatAnnee < 0 ? C.warn : C.text, letterSpacing: -0.8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{caPartiel ? <span style={{ fontSize: 15, fontWeight: 600, color: C.muted }}>au moins </span> : null}{fmt(resultatAnnee)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10, fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
                <span className="vrm-display" style={{ color: C.text, fontWeight: 600 }}>{caPartiel ? 'au moins ' : ''}{fmt(recettesAnnee)}</span>
                <span>CA déclaré</span>
                <span style={{ color: C.border }}>—</span>
                <span className="vrm-display" style={{ color: C.text, fontWeight: 600 }}>{fmt(chargesAnnee)}</span>
                <span>de charges{charges.aboTotal > 0 ? ` (dont ${fmt(charges.aboTotal)} d'abonnements)` : ''}</span>
              </div>
              {couvertureCa && (caPartiel || couvertureCa.aDater) && (
                <div data-compta-couverture={couvertureCa.pasSu.join(',')} data-compta-adater={couvertureCa.aDater ? String(couvertureCa.aDater.n) : '0'} style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>
                  {caPartiel && <div>Sans {couvertureCa.pasSu.join(' ni ')} : {couvertureCa.pasSu.length > 1 ? 'leurs' : 'ses'} ventes n'ont pas pu être lues — ce CA est un minimum.</div>}
                  {/* (17 oct., revue) La carte URSSAF, juste en dessous sur le même écran,
                      écrit déjà « N ventes sans date de versement (X €) » avec le
                      geste : ici on y renvoie, sans redire les mêmes nombres (§7). */}
                  {couvertureCa.aDater && <div>Des ventes finalisées n'ont pas encore de date de versement : elles ne sont dans aucun mois pour l'instant (le détail est dans « Ta déclaration URSSAF »).</div>}
                </div>
              )}
              <div style={{ fontSize: 13, color: C.muted, marginTop: 12, lineHeight: 1.45, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                Ce résultat ne déduit pas le prix d'achat de tes paires : ton bénéfice brut et net, qui le déduit, est juste en dessous.
              </div>
            </div>
          )}
        </div>
      </Card>

      <BeneficeCompta compta={data} onNav={onNav} />

      {/* Trois repères de charges — une liste groupée, comme Réglages : le
          libellé à gauche, le montant à droite (les data-compta-kpi restent). */}
      <section className="vrm-set-groupe vrm-compta-groupe" style={{ margin: 0 }}>
        <h3 className="vrm-set-titre vrm-titre-compta" style={{ color: C.muted }}>Tes charges</h3>
        <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>
          {[
            { k: 'abo', l: 'Abonnements ce mois', v: chargesDuMois.abo, s: abonnements.length ? `${abonnements.length} abonnement${abonnements.length > 1 ? 's' : ''}` : 'aucun de déclaré' },
            { k: 'mois', l: 'Charges ce mois', v: chargesMois, s: 'abonnements + dépenses + packs' },
            { k: 'annee', l: `Total charges ${annee}`, v: chargesAnnee, s: 'depuis janvier' },
          ].map((x) => (
            <div key={x.k} className="vrm-set-ligne" data-compta-kpi={x.k} data-eur={String(Math.round(x.v * 100) / 100)}>
              <span className="vrm-set-lib"><b style={{ color: C.text }}>{x.l}</b><small style={{ color: C.muted }}>{x.s}</small></span>
              <span className="vrm-display" style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(x.v)}</span>
            </div>
          ))}
          {chargesAnnee > 0 && (
            <button type="button" className="vrm-set-ligne" onClick={exporterCharges}>
              <span className="vrm-set-lib"><b style={{ color: C.accent, fontWeight: 600 }}>Exporter mes charges {annee} (CSV)</b></span>
              <span className="vrm-set-chev" aria-hidden="true" style={{ color: C.muted }}><Icon name="save" size={16} /></span>
            </button>
          )}
        </div>
      </section>

      <CarteUrssafMois liveStats={liveStats} onNav={onNav} />

      <CaParPeriodeCarte lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />

      <RecapComptableMensuel />

      <div className="vrm-compta-grille" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16, alignItems: 'start' }}>
        {/* ABONNEMENTS RÉCURRENTS */}
        <Section data="abonnements" titre="Abonnements" note="Logiciels et services qui reviennent tout seuls : comptés à chaque échéance (une échéance compte dès le début de son mois), jamais dans ton CA."
          total={abonnements.length ? charges.aboTotal : null} totalSub={abonnements.length ? `en ${annee}` : null}>
          {abonnements.length === 0 && ouvert !== 'abo' ? vide('Ton abonnement VRM, Canva, une appli de retouche ? Ajoute-le une fois — il sera compté à chaque échéance.') : null}
          {abonnements.length > 0 && listeBox(abonnements.map((a) => {
              const ech = echeancesAbonnement(a, moisCle);
              const cumul = ech.length * (Number(a.montant) || 0);
              const pasEncore = ymCompta(a.debut) > moisCle;
              const fini = a.fin && ymCompta(a.fin) < moisCle;
              return (
                  <Ligne key={a.id} attrs={{ 'data-abo': a.libelle, 'data-abo-cumul': String(Math.round(cumul * 100) / 100), 'data-abo-echeances': ech.length }}
                    gauche={<><b style={{ color: C.text }}>{a.libelle}</b>
                      <small style={{ color: C.muted }}>
                        {pasEncore ? `commence le ${dateFr(a.debut)}` : `depuis le ${dateFr(a.debut)}`}{a.fin ? ` · ${fini ? 'terminé' : 'jusqu’au'} ${dateFr(a.fin)}` : ''}
                        {!pasEncore && ` · ${ech.length} échéance${ech.length > 1 ? 's' : ''}, ${fmt(cumul)} en tout`}
                      </small></>}
                    droite={fmt(a.montant) + (a.periode === 'an' ? ' /an' : ' /mois')}
                    extra={!a.fin && !pasEncore ? <button type="button" onClick={() => terminerAbonnement(a.id)} title="Il s'arrête ce mois-ci (le mois en cours reste compté)" style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, borderRadius: 6, fontSize: 13, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Arrêter</button> : null}
                    onDel={() => retirer('abonnements', a.id)} />
              );
            }))}
          <ComptaAjout ouvert={ouvert === 'abo'} onClick={() => basculer('abo')} libelle="Ajouter un abonnement" data={{ 'data-abo-ouvrir': '' }} />
          {ouvert === 'abo' && <div style={formBox} data-abo-form>
          <div style={{ fontSize: 13, color: C.muted }}>Les plus courants</div>
          <div role="group" aria-label="Abonnements courants" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ABONNEMENTS_COURANTS.map((x) => <button key={x.nom} type="button" data-abo-courant={x.nom} aria-pressed={aLib === x.nom}
              onClick={() => { setALib(x.nom); if (x.prix) setAMnt(x.prix()); setAPer('mois'); setAErr(''); }} style={pastille(aLib === x.nom)}>{x.nom}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ ...lab, flex: '2 1 170px' }}>Nom
              <input type="text" placeholder="ex. Canva" data-abo-libelle value={aLib} onChange={e => { setALib(e.target.value); setAErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterAbonnement(); }} style={{ ...inp, width: '100%' }} />
            </label>
            <label style={{ ...lab, flex: '0 1 110px' }}>Prix
              <input type="text" inputMode="decimal" placeholder="0,00 €" data-abo-montant value={aMnt} onChange={e => { setAMnt(e.target.value); setAErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterAbonnement(); }} style={{ ...inp, width: '100%' }} />
            </label>
            <label style={{ ...lab, flex: '1 1 140px' }}>Revient
              <select value={aPer} onChange={e => setAPer(e.target.value)} data-abo-periode style={{ ...inp, width: '100%' }}><option value="mois">tous les mois</option><option value="an">tous les ans</option></select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={lab}>Depuis le
              <input type="date" value={aDeb} onChange={e => { setADeb(e.target.value); setAErr(''); }} data-abo-debut style={{ ...inp, width: '100%' }} />
            </label>
            <label style={lab}>Jusqu'au <span style={{ fontSize: 11 }}>(vide s'il continue)</span>
              <input type="date" value={aFin} onChange={e => { setAFin(e.target.value); setAErr(''); }} data-abo-fin style={{ ...inp, width: '100%' }} />
            </label>
            <button type="button" onClick={ajouterAbonnement} data-abo-ajouter style={btnAdd}>Ajouter</button>
          </div>
          {aErr && <div data-abo-erreur style={{ fontSize: 13, color: C.warn }}>{aErr}</div>}
          </div>}
        </Section>

        {/* DÉPENSES PONCTUELLES */}
        <Section data="depenses" titre="Dépenses" note="Emballage, fournitures, frais… tout ce que tu paies pour ton activité." total={depenses.length ? somme(depenses.filter(d => cetteAnnee(d.date)), x => x.montant) : null} totalSub={depenses.length ? `en ${annee}` : null}>
          {depenses.length === 0 && ouvert !== 'dep'
            ? vide('Note ta première dépense — ça prend cinq secondes, et ça allège ton résultat.')
            : listeBox(depenses.map((d) => <Ligne key={d.id} gauche={<><b style={{ color: C.text }}>{d.libelle}</b><small style={{ color: C.muted }}>{d.cat} · {dateFr(d.date)}</small></>} droite={fmt(d.montant)} onDel={() => retirer('depenses', d.id)} />))}
          <ComptaAjout ouvert={ouvert === 'dep'} onClick={() => basculer('dep')} libelle="Ajouter une dépense" data={{ 'data-dep-ouvrir': '' }} />
          {ouvert === 'dep' && <div style={formBox} data-dep-form>
            <div style={{ fontSize: 13, color: C.muted }}>C'est pour quoi ?</div>
            <div role="radiogroup" aria-label="Catégorie" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEPENSE_CATS.map((c) => <button key={c.k} type="button" role="radio" aria-checked={dCat === c.k} data-dep-cat={c.k} onClick={() => { setDCat(c.k); setDErr(''); }} style={pastille(dCat === c.k)}>{c.k}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ ...lab, flex: '2 1 180px' }}>Ce que tu as payé
                <input type="text" placeholder={`ex. ${(DEPENSE_CATS.find((c) => c.k === dCat) || DEPENSE_CATS[DEPENSE_CATS.length - 1]).ex}`} data-dep-libelle value={dLib} onChange={e => { setDLib(e.target.value); setDErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterDepense(); }} style={{ ...inp, width: '100%' }} />
              </label>
              <label style={{ ...lab, flex: '0 1 110px' }}>Montant
                <input type="text" inputMode="decimal" placeholder="0,00 €" data-dep-montant value={dMnt} onChange={e => { setDMnt(e.target.value); setDErr(''); }} onKeyDown={e => { if (e.key === 'Enter') ajouterDepense(); }} style={{ ...inp, width: '100%' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={lab}>Payé le
                <input type="date" value={dDate} onChange={e => setDDate(e.target.value)} data-dep-date style={{ ...inp, width: '100%' }} />
              </label>
              <button type="button" onClick={ajouterDepense} data-dep-ajouter style={btnAdd}>Ajouter</button>
            </div>
            {dErr && <div data-dep-erreur style={{ fontSize: 13, color: C.warn }}>{dErr}</div>}
          </div>}
        </Section>

        {/* PACKS ET OPTIONS PAYÉS (Leboncoin, eBay…) — § « packs de photos pris
            en compte du bénéfice ». ⚠️ Mesuré le 16 octobre : AUCUNE plateforme ne
            transmet à VRM ce que tu lui paies (ni pack, ni option, ni boost
            Leboncoin : aucune ligne captée). Un montant deviné serait un faux :
            seul ce qui est saisi ici compte. Les boosts Vinted, eux, se notent
            par annonce (champ « boost ») et sortent de la marge dans Statistiques. */}
        <Section data="packs" titre="Packs & options (facultatif)" note={<>Rien d'obligatoire : si tu as payé un pack de photos ou une option, note son prix ici pour qu'il soit déduit de ton résultat. Leboncoin et eBay ne transmettent pas à VRM ce que tu leur paies. Les boosts Vinted se notent par annonce et sortent de ta marge dans {lienBtn('Statistiques', 'dashboard')}.</>} total={packs.length ? somme(packs.filter(p => cetteAnnee(p.date)), x => x.montant) : null} totalSub={packs.length ? `en ${annee}` : null}>
          {packLbc && <div className="vrm-set-ligne" data-pack-lbc={packLbc.actif ? 'actif' : 'aucun'}>
            <span className="vrm-set-lib"><b style={{ color: C.text }}>Pack photo Leboncoin : {packLbc.actif ? 'pris' : 'aucun'}</b>
              <small style={{ color: C.muted }}>Détecté par l'extension{packLbc.at && !isNaN(Date.parse(packLbc.at)) ? ` le ${new Date(packLbc.at).toLocaleDateString('fr-FR')}` : ''}{packLbc.actif ? ' — son prix n’est pas transmis : ajoute-le ci-dessous si tu veux le déduire.' : ''}</small></span>
          </div>}
          {packs.length === 0 && ouvert !== 'pack'
            ? (packLbc ? null : vide('Tu as acheté un pack de photos ou une option ? Tu peux le noter ici — ce n’est pas obligatoire.'))
            : listeBox(packs.map((p) => <Ligne key={p.id} gauche={<><b style={{ color: C.text }}>{p.plateforme}</b><small style={{ color: C.muted }}>{p.compte ? `${p.compte} · ` : ''}{dateFr(p.date)}</small></>} droite={fmt(p.montant)} onDel={() => retirer('packs', p.id)} />))}
          <ComptaAjout ouvert={ouvert === 'pack'} onClick={() => basculer('pack')} libelle="Ajouter un pack ou une option" data={{ 'data-pack-ouvrir': '' }} />
          {ouvert === 'pack' && <div style={formBox}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={pPlat} onChange={e => setPPlat(e.target.value)} aria-label="Plateforme" style={{ ...inp, flex: '1 1 130px' }}>{['Leboncoin', 'eBay', 'Vinted', 'Vestiaire', 'Autre'].map(p => <option key={p} value={p}>{p}</option>)}</select>
              <input type="text" placeholder="Compte (facultatif)" aria-label="Compte" value={pCpt} onChange={e => setPCpt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ajouterPack(); }} style={{ ...inp, flex: '1 1 150px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={pDate} onChange={e => setPDate(e.target.value)} aria-label="Date" style={{ ...inp, flex: '1 1 150px' }} />
              <input type="text" inputMode="decimal" placeholder="€" aria-label="Montant" value={pMnt} onChange={e => setPMnt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ajouterPack(); }} style={{ ...inp, width: 96 }} />
              <button type="button" onClick={ajouterPack} style={btnAdd}>Ajouter</button>
            </div>
          </div>}
        </Section>

        {/* Les anciens COÛTS FIXES (sans date de début) : gardés tant qu'il en
            reste, comptés comme avant ; on n'en ajoute plus — un abonnement daté
            les remplace (rien n'est perdu, §4.11). */}
        {fixes.length > 0 && (
          <Section data="fixes" titre="Coûts fixes (sans date)" note={`Comptés au tarif actuel × ${moisEcoules} mois depuis janvier. Pour un compte exact, recrée-les en abonnement avec leur date de début.`} total={fixesParMois} totalSub="par mois">
            {listeBox(fixes.map((f) => <Ligne key={f.id} gauche={<b style={{ color: C.text }}>{f.libelle}</b>} droite={fmt(f.montant) + ' /mois'} onDel={() => retirer('fixes', f.id)} />))}
          </Section>
        )}

        <ProfilFiscalCarte onNav={onNav} />
      </div>

      {/* FACTURES — reçues (reçus Vinted par email) + le reste vit dans Factures */}
      <section className="vrm-set-groupe vrm-compta-groupe" style={{ margin: 0 }}>
        <div className="vrm-set-liste" style={{ background: C.card, border: `1px solid ${C.border}`, '--vrm-set-filet': C.border }}>
          <button type="button" className="vrm-set-ligne" onClick={() => onNav && onNav('invoices')}>
            <IconeReglage name="receipt" />
            <span className="vrm-set-lib"><b style={{ color: C.text }}>Factures{nFactures != null && nFactures > 0 ? ` — ${nFactures} reçue${nFactures > 1 ? 's' : ''}` : ''}</b><small style={{ color: C.muted }}>Tes reçus Vinted arrivés par email, et tes factures à émettre pour tes clients.</small></span>
            <span className="vrm-set-chev" aria-hidden="true" style={{ color: C.muted, fontSize: 20 }}>›</span>
          </button>
        </div>
      </section>

      {/* FACTURATION ÉLECTRONIQUE — Factur-X par vente + récap e-reporting du mois. */}
      <FacturationElectroniqueCarte data={data} maj={maj} lbcVentes={lbcVentes} lbcCoqueLu={lbcCoqueLu} ebayCommandes={ebayCommandes} panelOff={panelOff} accounts={accounts} />
    </div>
  );
}

// Facturation Pro : réglages rangés dans Supabase (ligne vrm_pro_facture) —
// c'est cette ligne que lit le serveur quand une vente Pro arrive. Le toggle
// « envoi automatique » est LE consentement : OFF = aucune facture ne part
// (les factures restent en brouillon, envoi manuel possible dans Factures).
function ProFactureSetting() {
  const DEFAULTS = { actif:false, autoSend:false, nom:'', adresse:'', codePostal:'', ville:'', siret:'', tva:'', prefixe:'FA', tauxTva:'0', mentions:'', logo:'' };
  const [cfg, setCfg] = useState(undefined); // undefined = en cours · null = pas su · objet = lu
  const [status, setStatus] = useState('');
  const HEADERS = sbAuth();
  const saveTimer = React.useRef(null);

  useEffect(() => { (async () => {
    try {
      // ⚠️⚠️ CE PANNEAU RÉÉCRIT LA LIGNE ENTIÈRE AU PREMIER CARACTÈRE TAPÉ.
      //    Avant, une lecture ratée (aucun `res.ok` : sur un 522 Cloudflare
      //    `res.json()` lève, et le `catch` posait les valeurs par DÉFAUT) lui
      //    montrait un formulaire VIDE — et la première frappe écrasait sa
      //    raison sociale, son adresse et son SIRET. C'est l'entité que porte
      //    le reçu d'achat envoyé à son comptable (§5) : sans elle, il redit
      //    « Ma boutique ». « Rien lu » ne vaut pas « rien ».
      const d = await lireReglage('vrm_pro_facture');
      setCfg(d === null ? null : { ...DEFAULTS, ...d });
    } catch (_) { setCfg(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })(); }, []);

  const persist = (next) => {
    if (cfg === null) return;                  // pas lu : on n'écrit rien
    setCfg(next); setStatus('enregistrement…');
    try { window.dispatchEvent(new CustomEvent('vrm:profil-fiscal', { detail: next })); } catch (_) {}
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
          method: 'POST',
          headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([withOwner({ id: 'vrm_pro_facture', data: next })]),
        });
        setStatus('✓ enregistré');
      } catch (_) { setStatus('⚠ échec — réessaie'); }
    }, 600);
  };
  const upd = (field, val) => persist({ ...cfg, [field]: val });

  // Trois états : `undefined` = en cours · `null` = la base n'a pas répondu ·
  // un objet = lu. Un panneau qui a ÉCHOUÉ ne doit pas dire « Chargement… »
  // pour toujours, et surtout pas montrer des champs vides à remplir.
  if (cfg === undefined) return <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'12px 14px',fontSize:12,color:C.muted}}>Chargement…</div>;
  if (cfg === null) return (
    <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'12px 14px'}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>🧾 Facturation Pro</div>
      <span style={{display:'inline-block',fontSize:11,fontWeight:600,color:C.muted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:999,padding:'2px 9px'}}>{REGLAGE_PAS_LU}</span>
    </div>
  );

  const input = (field, placeholder, flex) => (
    <input value={cfg[field]||''} onChange={e=>upd(field, e.target.value)} placeholder={placeholder}
      style={{flex:flex||'1 1 130px',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',fontSize:13,fontFamily:'inherit',background:C.bg,color:C.text,outline:'none',minWidth:0}}/>
  );

  return (
    <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:10,padding:'12px 14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:4}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>🧾 Facturation Pro</div>
        <button type="button" onClick={()=>upd('actif', !cfg.actif)} style={{
          padding:'4px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
          background:cfg.actif?C.accent:'transparent',color:cfg.actif?'#fff':C.muted,
          border:`1.5px solid ${cfg.actif?C.accent:C.border}`,
        }}>{cfg.actif?'Activée':'Désactivée'}</button>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:cfg.actif?12:0,lineHeight:1.4}}>
        Pour les comptes Vinted Pro : l'email de vente contient les coordonnées de l'acheteur — l'app prépare la facture avec tes informations ci-dessous.
      </div>
      {cfg.actif && (<>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          {cfg.logo && <img src={cfg.logo} alt="logo" style={{height:46,width:46,objectFit:'contain',borderRadius:8,border:`1px solid ${C.border}`,background:'#fff'}}/>}
          <label style={{cursor:'pointer'}}>
            <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
              const f=e.target.files[0]; if(!f) return;
              const r=new FileReader();
              r.onload=ev=>upd('logo', ev.target.result);
              r.readAsDataURL(f); e.target.value='';
            }}/>
            <span style={{padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',background:'transparent',color:C.accent,border:`1.5px solid ${C.accent}66`,display:'inline-block'}}>
              {cfg.logo?'Changer le logo':'Ajouter un logo'}
            </span>
          </label>
          {cfg.logo && <button type="button" onClick={()=>upd('logo','')} style={{padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',background:'transparent',color:C.danger,border:`1.5px solid ${C.danger}66`,fontFamily:'inherit'}}>Retirer</button>}
        </div>
        {/* Identité */}
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}>
          {input('nom','Nom commercial','1 1 100%')}
          {input('adresse','Adresse','1 1 100%')}
          {input('codePostal','Code postal','1 1 90px')}
          {input('ville','Ville')}
          {input('siret','SIRET','1 1 100%')}
          {input('tva','N° TVA intracom. (si assujetti)','1 1 100%')}
        </div>
        {/* Préfixe + taux TVA */}
        <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:500,color:C.text}}>Préfixe</span>
          {input('prefixe','FA','0 1 70px')}
          <span style={{fontSize:12,fontWeight:500,color:C.text,marginLeft:6}}>TVA</span>
          <select value={cfg.tauxTva||'0'} onChange={e=>upd('tauxTva', e.target.value)}
            style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',fontSize:13,fontFamily:'inherit',background:C.bg,color:C.text,outline:'none'}}>
            <option value="0">0 % (franchise)</option>
            <option value="5.5">5,5 %</option>
            <option value="10">10 %</option>
            <option value="20">20 %</option>
          </select>
        </div>
        {/* Mentions */}
        <textarea value={cfg.mentions||''} onChange={e=>upd('mentions', e.target.value)} rows={2}
          placeholder="Mentions légales / pied de facture (ex : TVA non applicable – art. 293 B du CGI)"
          style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',fontSize:12,fontFamily:'inherit',background:C.bg,color:C.text,outline:'none',resize:'vertical',marginBottom:8}}/>
        {/* Envoi automatique */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>Envoi automatique à l'acheteur</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4}}>Rien ne part sans ton accord. Tu peux couper à tout moment — l'arrêt est immédiat. OFF = les factures attendent dans l'onglet Factures.</div>
          </div>
          <button type="button" onClick={()=>upd('autoSend', !cfg.autoSend)} style={{
            flexShrink:0,padding:'6px 16px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
            background:cfg.autoSend?C.accent:'transparent',color:cfg.autoSend?'#fff':C.muted,
            border:`1.5px solid ${cfg.autoSend?C.accent:C.border}`,
          }}>{cfg.autoSend?'ON':'OFF'}</button>
        </div>
      </>)}
      {status && <div style={{fontSize:11,color:status.includes('⚠')?C.danger:C.muted,marginTop:8}}>{status}</div>}
    </div>
  );
}

export { ComptaPro, Invoices };
