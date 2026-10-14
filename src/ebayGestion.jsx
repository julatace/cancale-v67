import {createPortal} from 'react-dom';
import React,{useEffect,useState,useRef} from 'react';

export function ResponsiveChatPortal({children}){
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:767px)').matches);
 useEffect(()=>{const m=window.matchMedia('(max-width:767px)'),change=()=>setMobile(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 return mobile?createPortal(children,document.body):children;
}
const montant=(v,c)=>v==null?'—':Number.isFinite(Number(v))?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2,minimumFractionDigits:2}).format(Number(v))+(c?` ${c==='EUR'?'€':c}`:''): '—';
export async function appelerEbay(action,payload,headers,{write=false}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const r=await fetch('/api/ebay',{method:'POST',headers:{'Content-Type':'application/json',...headers()},body:JSON.stringify({action,...payload}),signal:controller.signal});
  const j=await r.json();if(!r.ok || !j?.ok)throw Object.assign(new Error(j?.error || 'eBay est indisponible.'),{reason:j?.reason});return j;
 }catch(e){if(e.name==='AbortError' || e instanceof TypeError)throw Object.assign(new Error(write?'État incertain : actualise avant de recommencer.':'Lecture indisponible. Réessaie.'),{reason:write?'incertain':'lecture'});throw e;
 }finally{clearTimeout(timer);}
}
const styleUI=C=>({input:{width:'100%',padding:'9px 10px',border:`1px solid ${C.border}`,borderRadius:8,color:C.text,background:C.card,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'},button:{padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,color:C.text,background:C.card,fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer'},label:{display:'grid',gap:5,fontSize:12,color:C.muted}});
const Erreur=({message})=>message?<p role="status" style={{fontSize:12,lineHeight:1.5}}>{message}</p>:null;
const corpsLisible=body=>/<(?:div|p|span|br|a)\b/i.test(body || '')?String(body).replace(/<br\s*\/?\s*>|<\/p>/gi,'\n').replace(/<\/?[a-z][^>]*>/gi,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&'):body;

export function EbayCommande({order,compte='principal',headers,confirm,theme:C}){
 const call=(action,payload,headers,options)=>appelerEbay(action,{...payload,...(compte && compte!=='principal'?{compte}:{})},headers,options);
 const S=styleUI(C),[open,setOpen]=useState(false),[data,setData]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[carriers,setCarriers]=useState(null),[carrier,setCarrier]=useState(''),[tracking,setTracking]=useState(''),[body,setBody]=useState(''),[subject,setSubject]=useState('À propos de votre commande');
 async function relire(){setBusy(true);setMessage('');try{setData(await call('commande',{orderId:order.orderId},headers));}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 useEffect(()=>{if(open && !data)relire();},[open]);
 async function transporteurs(){if(carriers)return;try{const j=await call('transporteurs',{},headers);setCarriers(j.carriers || []);}catch(e){setMessage(e.message);}}
 const frais=data?.order?.pricingSummary,ship=data?.order?.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
 const adresse=ship?.contactAddress;
 const paiement=data?.order?.orderPaymentStatus,annulation=data?.order?.cancelStatus?.cancelState;
 const peutExpedier=paiement==='PAID' && data?.order?.orderFulfillmentStatus!=='FULFILLED' && (!annulation || ['NONE_REQUESTED','CANCEL_REJECTED'].includes(annulation));
 return <details className="vrm-ebay-order-actions" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary>Gérer la commande</summary>
  <div style={{padding:'8px 0',display:'grid',gap:12}}>
   <Erreur message={message}/>{busy && <span style={{fontSize:12,color:C.muted}}>Lecture eBay…</span>}
   {data && <>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,fontSize:12}}>
     <div><b>Commande {order.orderId}</b><div style={{color:C.muted,marginTop:4}}>Acheteur : {data.order.buyer?.username || '—'}</div><div style={{marginTop:4}}>Total : {montant(frais?.total?.value,frais?.total?.currency)}</div></div>
     <div><b>Livraison</b>{ship?<div style={{color:C.muted,lineHeight:1.5,marginTop:4}}>{ship.fullName}<br/>{[adresse?.addressLine1,adresse?.addressLine2].filter(Boolean).join(' ')}<br/>{[adresse?.postalCode,adresse?.city,adresse?.countryCode].filter(Boolean).join(' ')}</div>:<div style={{color:C.muted}}>Adresse non fournie par eBay.</div>}</div>
    </div>
    <div style={{fontSize:12}}><b>Suivi</b>{data.fulfillments===null?<p>Le suivi n’a pas pu être lu.</p>:data.fulfillments.length?data.fulfillments.map((f,i)=><div key={f.fulfillmentId || i} style={{marginTop:5,color:C.muted}}>{f.shippingCarrierCode || 'Transporteur'} · {f.shipmentTrackingNumber || 'Numéro non fourni'}{f.shippedDate?` · ${new Date(f.shippedDate).toLocaleDateString('fr-FR')}`:''}</div>):<p style={{color:C.muted}}>Aucune expédition enregistrée sur eBay.</p>}</div>
    {peutExpedier && <details onToggle={e=>{if(e.currentTarget.open)transporteurs();}}><summary style={{fontSize:12,cursor:'pointer',fontWeight:600}}>Enregistrer l’expédition</summary>
     <div style={{display:'grid',gap:8,marginTop:8}}>
      <label style={S.label}>Transporteur<select aria-label="Transporteur eBay" value={carrier} onChange={e=>setCarrier(e.target.value)} style={S.input}><option value="">Choisir le transporteur</option>{(carriers || []).map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></label>
      <label style={S.label}>Numéro de suivi<input aria-label="Numéro de suivi eBay" value={tracking} onChange={e=>setTracking(e.target.value)} style={S.input}/></label>
      <button type="button" disabled={busy || !carrier || !tracking.trim() || data.fulfillments===null} style={S.button} onClick={async()=>{
       if(!await confirm({title:'Confirmer l’expédition ?',desc:`Commande ${order.orderId}\n${carrier} · ${tracking}\n\nJe confirme avoir remis le colis au transporteur. eBay et l’acheteur recevront ce suivi.`,ok:'Enregistrer le suivi',cancel:'Annuler'}))return;
       setBusy(true);setMessage('');try{const j=await call('expedier',{orderId:order.orderId,shippingCarrierCode:carrier,trackingNumber:tracking,confirme:true},headers,{write:true});await relire();setMessage(j.deja?'Ce suivi était déjà enregistré.':'Expédition enregistrée sur eBay.');}catch(e){setMessage(e.message);}finally{setBusy(false);}
      }}>Enregistrer le suivi</button>
     </div>
    </details>}
    <details><summary style={{fontSize:12,cursor:'pointer',fontWeight:600}}>Écrire à l’acheteur</summary><div style={{display:'grid',gap:8,marginTop:8}}>
     <label style={S.label}>Objet<input aria-label="Objet du message eBay" maxLength={200} value={subject} onChange={e=>setSubject(e.target.value)} style={S.input}/></label>
     <label style={S.label}>Message<textarea aria-label="Message à l’acheteur eBay" maxLength={2000} rows={4} value={body} onChange={e=>setBody(e.target.value)} style={S.input}/></label>
     <button type="button" style={S.button} disabled={busy || !body.trim() || !subject.trim()} onClick={async()=>{
      if(!await confirm({title:`Envoyer à ${data.order.buyer?.username || 'l’acheteur'} ?`,desc:`Commande ${order.orderId}\n${subject}\n\n${body}`,ok:'Envoyer le message',cancel:'Annuler'}))return;
      setBusy(true);setMessage('');try{await call('messageacheteur',{orderId:order.orderId,subject,body,confirme:true},headers,{write:true});setBody('');setMessage('Message accepté par eBay.');}catch(e){setMessage(e.message);}finally{setBusy(false);}
     }}>Envoyer le message</button>
    </div></details>
   </>}
   <button type="button" disabled={busy} onClick={relire} style={{...S.button,justifySelf:'start'}}>Actualiser la commande</button>
  </div>
 </details>;
}

export function EbayMessages({compte='principal',headers,confirm,theme:C}){
 const call=(action,payload,headers,options)=>appelerEbay(action,{...payload,...(compte && compte!=='principal'?{compte}:{})},headers,options);
 const selection=useRef(null);
 const S=styleUI(C),[rows,setRows]=useState(null),[selected,setSelected]=useState(null),[body,setBody]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[pages,setPages]=useState(null),[search,setSearch]=useState('');
 async function charger(next=1){setBusy(true);setMessage('');try{const j=await call('messages',{page:next},headers);if(!Array.isArray(j.messages))throw new Error('Les messages ne sont pas lisibles.');setRows(p=>next===1?j.messages:[...new Map([...(p || []),...j.messages].map(m=>[m.id,m])).values()]);setPage(next);setPages(j.totalPages);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 useEffect(()=>{charger();},[]);
 const affiches=(rows || []).filter(m=>`${m.sender} ${m.subject} ${m.titre}`.toLowerCase().includes(search.toLowerCase()));
 return <section><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><h2 style={{margin:0,fontSize:22,color:C.text}}>Messages eBay</h2><button type="button" disabled={busy} onClick={()=>charger()} style={{...S.button,marginLeft:'auto'}}>Actualiser</button></div><Erreur message={message}/>
  <div className="vrm-message-workspace"><div className="vrm-inbox-column"><input type="search" aria-label="Rechercher un message eBay" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un échange…" style={{...S.input,marginBottom:10}}/>
   {busy && rows===null && <p style={{fontSize:12,color:C.muted}}>Lecture des messages…</p>}
   {rows && !affiches.length && <p style={{fontSize:12,color:C.muted}}>Aucun échange dans cette sélection.</p>}
   <div style={{border:`1px solid ${C.border}`,borderRadius:10,background:C.card,overflow:'hidden'}}>{affiches.map(m=><button type="button" key={m.id} className={selected?.id===m.id?'vrm-inbox-row is-current':'vrm-inbox-row'} onClick={()=>{selection.current=m.id;setSelected(m);setBody('');setMessage('');}} style={{display:'grid',gap:4,width:'100%',border:0,borderBottom:`1px solid ${C.border}`,padding:12,background:'transparent',color:C.text,textAlign:'left',cursor:'pointer'}}><b style={{fontSize:13}}>{m.sender || 'Acheteur'}</b><span style={{fontSize:12,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',color:C.muted}}>{m.subject || m.titre}</span></button>)}</div>
   {rows && ((pages!=null && page<pages) || (pages==null && rows.length>=50*page)) && <button type="button" disabled={busy} onClick={()=>charger(page+1)} style={{...S.button,marginTop:10}}>Charger la suite</button>}
   <p style={{fontSize:10,color:C.muted}}>Échanges remontés par eBay sur les 90 derniers jours.</p>
  </div><div className="vrm-chat-column">
   {selected?<ResponsiveChatPortal><div className="vrm-chat-overlay vrm-chat-inline"><div className="vrm-chat-panel" role="dialog" aria-label="Conversation eBay" style={{display:'flex',flexDirection:'column',background:C.card,overflow:'hidden'}}>
    <div style={{display:'flex',gap:8,padding:12,borderBottom:`1px solid ${C.border}`}}><div style={{flex:1,minWidth:0}}><b style={{fontSize:14}}>{selected.sender || 'Acheteur'}</b><div style={{fontSize:11,color:C.muted}}>{selected.titre || selected.subject}</div></div><button type="button" aria-label="Fermer la conversation eBay" onClick={()=>{selection.current=null;setSelected(null);}} style={S.button}>×</button></div>
    <div className="vrm-chat-history" style={{flex:1,overflow:'auto',padding:14,display:'grid',alignContent:'start',gap:10}}><div style={{padding:12,border:`1px solid ${C.border}`,borderRadius:10,fontSize:13,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{corpsLisible(selected.body)}</div>{(selected.responses || []).map((r,i)=><div key={i} style={{padding:12,borderRadius:10,background:C.bg,fontSize:13,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{corpsLisible(r)}</div>)}</div>
    <div style={{padding:12,borderTop:`1px solid ${C.border}`,display:'grid',gap:8}}><Erreur message={message}/><textarea aria-label="Réponse au message eBay" maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} rows={3} placeholder="Écrire une réponse…" style={S.input}/><button type="button" style={S.button} disabled={busy || !body.trim() || !selected.itemId} onClick={async()=>{
     const m=selected,texte=body;if(!await confirm({title:`Répondre à ${m.sender || 'cet acheteur'} ?`,desc:`${m.titre || m.subject}\n\n${texte}`,ok:'Envoyer la réponse',cancel:'Annuler'}))return;
     setBusy(true);setMessage('');try{await call('repondre',{itemId:m.itemId,messageId:m.id,body:texte,confirme:true},headers,{write:true});setSelected(p=>p?.id===m.id?{...p,responses:[...p.responses,texte]}:p);if(selection.current===m.id){setBody('');setMessage('Réponse acceptée par eBay.');}}catch(e){if(selection.current===m.id)setMessage(e.message);}finally{setBusy(false);}
    }}>Envoyer la réponse</button>{!selected.itemId && <small style={{color:C.muted}}>Cet échange n’a pas d’annonce identifiée. Le contact des acheteurs d’une commande reste disponible dans Ventes.</small>}</div>
   </div></div></ResponsiveChatPortal>:<div className="vrm-chat-empty"><span>Choisis un échange</span><small>Lis les réponses et réponds depuis VRM.</small></div>}
  </div></div>
 </section>;
}

export function EbayOffres({compte='principal',headers,confirm,theme:C,onAnnonces}){
 const call=(action,payload,headers,options)=>appelerEbay(action,{...payload,...(compte && compte!=='principal'?{compte}:{})},headers,options);
 const S=styleUI(C),[rows,setRows]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[prices,setPrices]=useState({}),[page,setPage]=useState(1),[pages,setPages]=useState(null);
 async function charger(next=1){setBusy(true);setMessage('');try{const j=await call('offresrecues',{page:next},headers);if(!Array.isArray(j.offres))throw new Error('Les offres ne sont pas lisibles.');setRows(p=>next===1?j.offres:[...new Map([...(p || []),...j.offres].map(o=>[o.id,o])).values()]);setPage(next);setPages(j.totalPages);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 useEffect(()=>{charger();},[]);
 async function agir(o,decision){const prix=prices[o.id];if(decision==='Counter' && (!/^\d+(?:[.,]\d{1,2})?$/.test(String(prix || '')) || Number(String(prix).replace(',','.'))<=0)){setMessage('Indique un prix valide.');return;}
  const action=decision==='Accept'?'Accepter':decision==='Decline'?'Refuser':'Proposer';
  if(!await confirm({title:`${action} ${decision==='Counter'?montant(String(prix).replace(',','.'),o.currency):montant(o.price,o.currency)} ?`,desc:`${o.titre}\nAcheteur : ${o.buyer || '—'}\nQuantité : ${o.quantity}\n\n${decision==='Accept'?'Cette décision accepte le prix proposé ; elle ne prouve pas le paiement.':'La réponse sera transmise à l’acheteur sur eBay.'}`,ok:action,cancel:'Annuler'}))return;
  setBusy(true);setMessage('');try{await call('repondreoffre',{itemId:o.itemId,offerId:o.id,decision,price:prix,expectedPrice:o.price,currency:o.currency,confirme:true},headers,{write:true});await charger();setMessage('Réponse à l’offre acceptée par eBay.');}catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 return <section><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><h2 style={{margin:0,fontSize:22,color:C.text}}>Offres eBay</h2><button type="button" onClick={()=>charger()} disabled={busy} style={{...S.button,marginLeft:'auto'}}>Actualiser</button></div><Erreur message={message}/>
  {rows===null && busy && <p style={{fontSize:12,color:C.muted}}>Lecture des offres…</p>}{rows && !rows.length && <p style={{fontSize:12,color:C.muted}}>Aucune offre reçue en attente.</p>}
  <div style={{display:'grid',gap:10}}>{(rows || []).map(o=>{const active=['Active','Pending'].includes(o.status) && (!o.expiresAt || Date.parse(o.expiresAt)>Date.now());const known=active && o.currency && Number.isInteger(o.quantity) && o.quantity>0;return <article key={o.id} style={{border:`1px solid ${C.border}`,borderRadius:12,padding:14,background:C.card}}><div style={{display:'flex',gap:10,justifyContent:'space-between'}}><div style={{minWidth:0}}><b style={{fontSize:13}}>{o.titre || `Annonce ${o.itemId}`}</b><div style={{fontSize:11,color:C.muted,marginTop:4}}>{o.buyer || 'Acheteur'} · quantité {o.quantity || '—'}{o.expiresAt?` · expire le ${new Date(o.expiresAt).toLocaleString('fr-FR')}`:''}</div></div><b className="vrm-display" style={{fontSize:20,whiteSpace:'nowrap'}}>{montant(o.price,o.currency)}</b></div>{o.message && <p style={{fontSize:12,color:C.muted}}>{o.message}</p>}
   <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}><button type="button" style={S.button} disabled={busy || !known} onClick={()=>agir(o,'Accept')}>Accepter</button><button type="button" style={S.button} disabled={busy || !known} onClick={()=>agir(o,'Decline')}>Refuser</button></div><details style={{marginTop:10}}><summary style={{fontSize:12,cursor:'pointer'}}>Faire une contre-offre</summary><div style={{display:'flex',gap:8,marginTop:8}}><input aria-label={`Contre-offre ${o.id}`} inputMode="decimal" value={prices[o.id] || ''} onChange={e=>setPrices(p=>({...p,[o.id]:e.target.value}))} placeholder={`Prix ${o.currency || ''}`} style={S.input}/><button type="button" style={S.button} disabled={busy || !known} onClick={()=>agir(o,'Counter')}>Proposer</button></div></details>
  </article>;})}</div>
  {rows && ((pages!=null && page<pages) || (pages==null && rows.length>=50*page)) && <button type="button" disabled={busy} onClick={()=>charger(page+1)} style={{...S.button,marginTop:10}}>Charger la suite</button>}
  <button type="button" onClick={onAnnonces} style={{...S.button,marginTop:14}}>Proposer aux observateurs d’une annonce</button>
 </section>;
}

export function EbayAgent({compte='principal',headers,theme:C,onSection}){
 const S=styleUI(C),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function charger(){setBusy(true);setError('');try{setData(await appelerEbay('agent',{compte},headers));}catch(e){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{charger();},[]);
 const labels={expedier:'Expédition',messageacheteur:'Message acheteur',repondre:'Réponse',repondreoffre:'Offre',modifierannonce:'Annonce modifiée',terminerannonce:'Fin d’annonce'};
 return <section><div style={{display:'flex',gap:8,alignItems:'center'}}><h2 style={{fontSize:22,margin:0}}>À traiter sur eBay</h2><button disabled={busy} onClick={charger} style={{...S.button,marginLeft:'auto'}}>{busy?'Lecture…':'Actualiser'}</button></div><Erreur message={error}/><p style={{fontSize:12,color:C.muted}}>Prépare tes actions ici, puis vérifie et confirme dans la section correspondante.</p>
 {data && <><div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11,color:C.muted}}>{data.sources.map(s=><span key={s.nom}>{s.nom} : {s.ok?(s.partiel?'lecture partielle':'à jour'):'lecture indisponible'}{s.at?` · ${new Date(s.at).toLocaleString('fr-FR')}`:''}</span>)}</div><div style={{display:'grid',gap:8,marginTop:12}}>{data.tasks.map(t=><button key={t.id} onClick={()=>onSection(t.section)} style={{...S.button,display:'flex',gap:8,justifyContent:'space-between',textAlign:'left'}}><span>{t.label}</span><small>{t.ref} →</small></button>)}</div>{!data.tasks.length && <p style={{fontSize:12,color:C.muted}}>Aucune action détectée dans les données lues.</p>}
 <h3 style={{fontSize:15,marginTop:24}}>Historique des actions</h3>{!data.journalLisible?<Erreur message="Historique indisponible."/>:!data.journal.length?<p style={{fontSize:12,color:C.muted}}>Les prochaines actions effectuées dans VRM apparaîtront ici.</p>:<div style={{display:'grid',gap:8}}>{data.journal.map(j=><div key={j.id} style={{padding:10,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}}><b>{labels[j.action] || j.action}</b> · {j.ref}<div style={{fontSize:11,color:C.muted,marginTop:4}}>{new Date(j.at).toLocaleString('fr-FR')} · {j.etat==='reussi'?'Confirmé par eBay':j.etat==='refuse'?'Refusé': 'À vérifier sur eBay'}</div>{['incertain','en_cours'].includes(j.etat) && <button style={{...S.button,marginTop:8}} onClick={()=>onSection(j.action.includes('offre')?'offres':['repondre','messageacheteur'].includes(j.action)?'messages':j.action.includes('annonce')?'annonces':'ventes')}>Relire avant de reprendre</button>}</div>)}</div>}</>}
 </section>;
}
