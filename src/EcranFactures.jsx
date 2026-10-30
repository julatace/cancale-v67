// ════════════════════════════════════════════════════════════════════════════
// Découpé d'App.jsx (29 octobre) : Invoices et ce qu'eux SEULS utilisent,
// chargés à l'ouverture de l'écran (React.lazy) au lieu du démarrage de l'app.
// Le code n'a pas changé ; ce qu'il partage avec le reste vient d'App.jsx.
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useMemo, useEffect } from "react";
import { Btn, C, Card, FermeAuRetour, Icon, Input, REGLAGE_PAS_LU, SB_CONFLICT, SUPABASE_URL, ScreenHead, askConfirm, buildFacturXBytes, entForInvoice, fetchProInvoices, fmt, fmtDate, generatePDF, lireReglage, ouvrirDocumentImprimable, save, sbAuth, setProInvoiceStatus, toast, tod, withOwner, xmlEsc } from "./App.jsx";


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
      ? `⚠️ L’article #${inv.productId} a une vente saisie dans ta compta.\nSupprimer cette facture quand même ?`
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
    const headers=['N° Facture',...(multiEnt?['Entreprise','SIRET']:[]),'Date vente','N° Article','Désignation','Prix vente','Acheteur','Email','Adresse','N° Vinted','Statut'];
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
          placeholder="N° d’article ou date de vente... puis Entrée"
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
          <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.4}}>Préparées automatiquement à chaque vente Pro (coordonnées acheteur dans l'email Vinted). Réglages : Paramètres → Facturation Pro.</div>
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
              <th style={{padding:'10px 8px',textAlign:'left',color:C.warn,fontWeight:500,fontSize:11,letterSpacing:0.5,textTransform:'uppercase'}}>N° Article</th>
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

function InvoiceForm({onClose,onSave,nextNumber,catalog}) {
  const [data,setData]=useState({
    productId:'',itemName:'',sellPrice:'',saleDate:tod(),
    buyerName:'',buyerEmail:'',buyerAddress:'',
    vintedNumber:'',source:'manual',
  });
  const [err,setErr]=useState('');
  
  const submit=()=>{
    setErr('');
    if(!data.productId.trim()){setErr('Le numéro d’article est obligatoire');return;}
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
          <Field label="N° article (étiquetage) *">
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
          <div className="vrm-aide" style={{fontSize:10.5,color:C.muted,marginTop:5}}>⭐ = entité utilisée pour les nouvelles factures. Chaque entité a sa propre numérotation.</div>
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

function Field({label,children}) {
  return <label className="vrm-field" style={{display:'flex',flexDirection:'column',gap:4}}>
    <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</span>
    {children}
  </label>;
}
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

export default Invoices;
