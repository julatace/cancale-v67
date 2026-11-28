// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { ouvrirPanneau } from '../ouvrirPanneau.js';
import { publierLbcDepuisVrm } from '../agir/Agir.jsx';
import { champsFacultatifs } from '../profilVendeur.js';
import React from 'react';
import { jourParis } from '../dateParis.js';
import { Btn, C, DEMANDE_EBAY_PAIRE, FermeAuRetour, Icon, PhotoVinted, SUPABASE_URL, aLaDemande, askConfirm, cleNum, descriptionDeFaits, descriptionLbcDe, ebayTitre, familleArticle, lbcTitre, load, mpChoisi, prixAchatDe, sbAuth, toast, useEbayPaires, useExtVivante, vendActuel } from '../App.jsx';

// ⟦← App.jsx #2⟧
// ⟦→ ecrans/Comptabilite.jsx #102⟧   // (6 nov., v36-visuel-2) les dessins des états vides
import { SITES_PUBLIER, apercuEnvoi, manquesEnvoi, etatsPaire, partoutLeMeme, lienVu, chercherPaires, enLigneSur } from "../publierAilleurs.js";

// ⟦← App.jsx #1⟧   // (22 nov., ext. 5.436 `adistance`) « Mes comptes » : tes comptes à distance, ton ordinateur exécute   // (19 nov., demande H) LE seul endroit « Extension »   // (11 nov., ext. 5.350) « Vinted a masqué / fait disparaître / limite »
const PublierAilleurs = aLaDemande(() => import('../PublierAilleurs.jsx'), true);
// ⟦← App.jsx #3⟧
// ⟦→ ecrans/Feuilles.jsx #16⟧
// ══════════════════════════════════════════════════════════════════════════════
// PUBLIER AILLEURS — LE PARCOURS GUIDÉ (5 nov., règle : src/publierAilleurs.js)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « Vinted → Leboncoin, Vestiaire et eBay : beaucoup plus accompagné,
// pro, pointilleux et fiable ». Les paires proposables sont celles de la source
// partagée (`useEbayPaires` : en ligne sur Vinted ou « toujours chez moi », §11) ;
// ce qui part est construit par les règles des moteurs (`lbcTitre`,
// `descriptionLbcDe`, `descriptionEbayPropre`) ; ce qui manque par la
// vérification de l'app ; « vue en ligne » par `sitesDuNumero` (identité).
// « Publier » ouvre le moteur EXISTANT sur CET article — la fiche Leboncoin
// (`DEMANDE_LBC_FICHE`), le formulaire eBay (`DEMANDE_EBAY_PAIRE`), la ligne
// Vestiaire (`DEMANDE_VC_PAIRE`) — avec toutes ses gardes : rien ne part d'ici.
function HotePublierAilleurs({ comptes, num, site, sitesVus, manquesLecture, lecture, onChoisir, onFermer, onNav }) {
  const { paires, pret } = useEbayPaires(comptes);
  const { jobs } = useExtVivante();
  // Les marques « déjà publiée » (Leboncoin, Vestiaire) et les brouillons eBay de
  // ses paires : trois états (undefined en cours · null pas su · Set).
  const [postes, setPostes] = React.useState({ leboncoin: undefined, vestiaire: undefined });
  const [brouillons, setBrouillons] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    const ids = async (id) => { try { const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}&select=ids:data->ids`, { headers: sbAuth() }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? new Set(((j[0] && j[0].ids) || []).map(String)) : null; } catch (_) { return null; } };
    (async () => {
      const [lbc, vc] = await Promise.all([ids('vinted_lbc_posted'), ids('vinted_vc_posted')]);
      // ⚠️ (relecture du 5 nov.) Un brouillon eBay MIS EN LIGNE (ou programmé) garde sa ligne avec
      //    `programme.itemId` (`lireBrouillonsEbay`) : il n'est plus « préparé », il est PUBLIÉ —
      //    le dire « préparée » proposait « Reprendre sur eBay » sur une annonce déjà en ligne.
      let br = null;
      try { const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.ebay_brouillons&select=items:data->items`, { headers: sbAuth() }); if (r.ok) { const j = await r.json(); const it = Array.isArray(j) && j[0] && j[0].items; const l = (Array.isArray(it) ? it : Object.values(it || {})).filter((b) => b && b.pairId != null);
        const publie = (b) => !!((b.programme && b.programme.itemId) || b.itemId);
        br = { prepares: new Set(l.filter((b) => !publie(b)).map((b) => String(b.pairId))), publies: new Set(l.filter(publie).map((b) => String(b.pairId))) }; } } catch (_) { br = null; }
      if (vivant) { setPostes({ leboncoin: lbc, vestiaire: vc }); setBrouillons(br); }
    })();
    return () => { vivant = false; };
  }, [num]);
  const liste = pret ? paires : undefined;
  const k = num ? cleNum(num) : '';
  const paire = k && Array.isArray(liste) ? (liste.find((p) => cleNum(p.num) === k) || null) : null;
  const fiches = load('vinted_annonce_numeros', {}) || {};
  const cartes = React.useMemo(() => {
    if (!paire) return [];
    const fiche = fiches[String(paire.id)] || {};
    let achat = null; try { achat = prixAchatDe(fiche, load('vinted_buyprice_by_num', {}) || {}); } catch (_) { achat = null; }
    const famille = familleArticle({ titre: paire.title, taille: paire.taille, marque: paire.marque }).famille;
    const etats = etatsPaire(paire, { sitesVus: lecture ? null : sitesVus, manquesLecture, jobs, brouillonsEbay: brouillons ? brouillons.prepares : null, publiesEbay: brouillons ? brouillons.publies : null,
      postes: { leboncoin: postes.leboncoin === undefined ? null : postes.leboncoin, vestiaire: postes.vestiaire === undefined ? null : postes.vestiaire } });
    return SITES_PUBLIER.map((sx) => {
      const apercu = apercuEnvoi(sx, paire, { titreLbc: (m, t, ta) => lbcTitre(m, t, ta), titreVc: (m, t, ta) => lbcTitre(m, t, ta, 80), titreEbay: (t, ta) => ebayTitre(t || '', ta || ''),
        descriptionLbc: (o) => descriptionLbcDe(o), descriptionEbay: (pp) => (pp && pp.desc) || descriptionDeFaits(pp || {}) });
      return { site: sx, apercu, manques: manquesEnvoi(sx, apercu, { achat, famille, mpLbc: mpChoisi(fiche, 'lbc'), horsVinted: paire.chezMoi === true, facultatifs: champsFacultatifs(vendActuel()) }), etat: etats[sx], lien: lienVu(sx, sitesVus) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paire, sitesVus, manquesLecture, lecture, jobs, postes, brouillons]);
  const publier = (sx) => {
    if (!paire) return;
    const id = String(paire.id), at = Date.now();
    // (20 nov., décision de Julien) Leboncoin et Vestiaire : la publication se fait dans le panneau de l'extension, sur le
    // site, depuis CETTE annonce Vinted (son identifiant) ; eBay reste ici (API serveur, pas de panneau).
    // (24 nov., lot agir-tout) Leboncoin DEPUIS VRM (la file, compte Leboncoin ouvert par une extension connectée) ; Vestiaire
    // reste au panneau : VRM n'y clique jamais « Publier » à sa place (il relit et publie lui-même).
    if (sx === 'leboncoin') { publierLbcDepuisVrm(id, { panneau: () => ouvrirPanneau({ site: sx, page: 'publier', ids: [id], action: 'publier' }) }); onFermer(); return; }
    if (sx === 'vestiaire') { ouvrirPanneau({ site: sx, page: 'publier', ids: [id], action: 'publier' }); onFermer(); return; }
    if (sx === 'ebay') { DEMANDE_EBAY_PAIRE.id = id; DEMANDE_EBAY_PAIRE.at = at; onNav && onNav('ebay_annonces'); }
    // L'écran du site est rendu d'abord ; la feuille se ferme ensuite (son retour
    // d'historique ne doit pas ramener l'écran d'avant — même piège que « qui dorment »).
    setTimeout(() => onFermer(), 400);
  };
  const avis = num && Array.isArray(liste) && !paire ? `N°${num} n’est pas proposable ici (vendu, plus en ligne, ou à trancher).` : '';
  return <PublierAilleurs paire={paire} paires={liste} lecture={lecture} cartes={cartes} partout={lecture ? [] : partoutLeMeme(sitesVus)} siteDemande={site}
    avis={avis} chercher={(l, q) => chercherPaires(l, q, cleNum)} onChoisir={(p) => onChoisir(String(p.num))} onChanger={() => onChoisir(null)}
    onPublier={publier} onFermer={onFermer} Photo={(src) => <PhotoVinted src={src} alt="" loading="lazy"/>} Retour={FermeAuRetour}/>;
}
// ⟦← App.jsx #4⟧
// ⟦→ ecrans/Stock.jsx #8⟧

/* ── App ─────────────────────────────────────────────── */

/* ── BackupModal ─────────────────────────────────────── */
function BackupModal({catalog,sales,garageGrid,blockedCells,onClose,onImport}) {
  const exportData=()=>{
    const data={
      catalog,sales,garageGrid,blockedCells,
      exportedAt:new Date().toISOString(),
      version:'1.0',
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`vrm-backup-${jourParis()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const importData=(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=async (ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.catalog&&!data.sales){
          toast('❌ Fichier invalide : pas de données détectées');
          return;
        }
        if(await askConfirm(`Importer cette sauvegarde ?\n\nCatalogue: ${data.catalog?.length||0} articles\nVentes: ${data.sales?.length||0} ventes\n\n⚠️ Tes données actuelles seront remplacées.`)){
          onImport(data);
        }
      }catch(err){
        toast('❌ Erreur de lecture : '+err.message);
      }
    };
    reader.readAsText(file);
  };
  
  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20,
      animation:'fadeIn 0.2s',
    }}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={e=>e.stopPropagation()} style={{
        background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
        padding:24,maxWidth:480,width:'100%',
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,color:C.accentTexte,fontSize:20,fontWeight:600}}>💾 Sauvegarde</h3>
          <button className="vrm-icon-control" type="button" aria-label="Fermer la fenêtre" onClick={onClose} style={{background:'transparent',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}><Icon name="close" size={15}/></button>
        </div>
        
        <div style={{fontSize:12,color:C.muted,marginBottom:18,lineHeight:1.5}}>
          Toutes tes données dans un fichier, à restaurer partout.
        </div>
        
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:`${C.accent}11`,border:`1px solid ${C.accent}44`,borderRadius:12,padding:14}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'none',letterSpacing:'normal',marginBottom:4}}>📤 Exporter</div>
            <div style={{fontSize:12,color:C.text,marginBottom:10}}>
              <b>{catalog.length}</b> articles ·<b>{sales.length}</b> ventes
            </div>
            <Btn small onClick={exportData}>Télécharger la sauvegarde</Btn>
          </div>

          <div style={{background:`${C.warn}11`,border:`1px solid ${C.warn}44`,borderRadius:12,padding:14}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'none',letterSpacing:'normal',marginBottom:4}}>📥 Restaurer</div>
            <div style={{fontSize:12,color:C.text,marginBottom:10}}>
              ⚠️ Cela remplacera toutes tes données actuelles
            </div>
            <label style={{display:'inline-block',cursor:'pointer'}}>
              <input type="file" accept=".json" onChange={importData} style={{display:'none'}}/>
              <span style={{
                display:'inline-block',background:C.warn,color:'#000',
                border:'none',borderRadius:12,padding:'5px 12px',
                fontSize:12,fontWeight:400,fontFamily:'inherit',
              }}>📁 Choisir un fichier JSON</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
export { BackupModal, HotePublierAilleurs };
