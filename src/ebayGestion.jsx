import {formaterMontantEbay as montant} from './montantsEbay.js';
import {appelerEbay} from './ebayRequetes.js';
import {useReponseIncertaine} from './ebayEtatIncertain.js';
import {lireBrouillon,sauverBrouillon,effacerBrouillonSiIdentique} from './brouillonsMessages.js';
import {bilanCommandeEbay,codesRetraitEbay} from './ebayParcours.js';
import {centimes} from './beneficePaire.js';
import CoutsVente from './CoutsVente.jsx';
import './ebay-interface.css';
import {offresAffichees} from './ebayOffresVue.js';
import {etatCommandeEbay} from '../api/_lib/ebay-etat-commande.js';
import {useBrouillonCommande} from './brouillonsCommandesEbay.js';
import {useConversationFocus} from './conversationFocus.js';
import {createPortal} from 'react-dom';
import React,{useEffect,useState,useRef} from 'react';

export function ResponsiveChatPortal({children}){
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:767px)').matches);
 useEffect(()=>{const m=window.matchMedia('(max-width:767px)'),change=()=>setMobile(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 return mobile?createPortal(children,document.body):children;
}

export {appelerEbay} from './ebayRequetes.js';
const styleUI=C=>({input:{width:'100%',padding:'9px 10px',border:`1px solid ${C.border}`,borderRadius:8,color:C.text,background:C.card,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'},button:{padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,color:C.text,background:C.card,fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer'},label:{display:'grid',gap:5,fontSize:12,color:C.muted}});
const Erreur=({message})=>message?<p role="status" style={{fontSize:12,lineHeight:1.5}}>{message}</p>:null;
// (16 octobre, revue) Le titre d'un onglet qui redit l'onglet (« Messages eBay »
// sous l'onglet « Messages ») est caché au téléphone, gardé pour les lecteurs
// d'écran : la classe `vrm-ebay-titre-onglet` (ebay-interface.css).
const heureCourte=d=>{const t=Date.parse(d || '');if(!Number.isFinite(t))return '';const x=new Date(t),n=new Date();return x.toDateString()===n.toDateString()?x.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):x.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});};
const corpsLisible=body=>/<(?:div|p|span|br|a)\b/i.test(body || '')?String(body).replace(/<br\s*\/?\s*>|<\/p>/gi,'\n').replace(/<\/?[a-z][^>]*>/gi,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&'):body;

export function EbayCommande({order,ouvrir=false,costs={},onCosts,owner,compte='principal',headers,confirm,theme:C}){
 const call=(action,payload,headers,options)=>appelerEbay(action,{...payload,...(compte && compte!=='principal'?{compte}:{})},headers,options);
 const S=styleUI(C),[open,setOpen]=useState(ouvrir),[data,setData]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[carriers,setCarriers]=useState(null),[carrier,setCarrier]=useState(''),[tracking,setTracking]=useState(''),[copie,setCopie]=useState('');
 const draft=useBrouillonCommande(owner,compte,order.orderId),body=draft.body,subject=draft.subject;
 async function relire(){setBusy(true);setMessage('');try{setData(await call('commande',{orderId:order.orderId},headers));}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 useEffect(()=>{if(open && !data)relire();},[open]);
 async function transporteurs(){if(carriers)return;try{const j=await call('transporteurs',{},headers);setCarriers(j.carriers || []);}catch(e){setMessage(e.message);}}
 const frais=data?.order?.pricingSummary,ship=data?.order?.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
 const adresse=ship?.contactAddress;
 const etat=etatCommandeEbay(data?.order),peutExpedier=etat.peutExpedier;
 const adresseTexte=ship?[ship.fullName,adresse?.addressLine1,adresse?.addressLine2,[adresse?.postalCode,adresse?.city].filter(Boolean).join(' '),adresse?.countryCode].filter(Boolean).join('\n'):'';
 return <details className="vrm-ebay-order-actions" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary>Gérer la commande</summary>
  <div style={{padding:'8px 0',display:'grid',gap:12}}>
   <Erreur message={message}/>{busy && <span style={{fontSize:12,color:C.muted}}>Lecture eBay…</span>}
   {data && <>
    <div className="vrm-ebay-order-state">{etat.label}</div>
    <section aria-label="Articles de la commande eBay" className="vrm-ebay-order-items"><h3>Contenu de la commande</h3>{data.order.lineItems?.length?data.order.lineItems.map((li,i)=><div className="vrm-ebay-order-item" key={li.lineItemId || i}><div><b>{li.title || 'Article sans titre'}</b><small>{li.sku?`Référence : ${li.sku} · `:''}Quantité : {Number.isInteger(li.quantity) && li.quantity>0?li.quantity:'non fournie'}</small></div><span>{montant((li.discountedLineItemCost || (li.discounts?.length?null:li.lineItemCost))?.value,(li.discountedLineItemCost || li.lineItemCost)?.currency)}</span></div>):<p>Le détail des articles n’a pas été fourni par eBay.</p>}</section>
    {onCosts && <EbayBenefice order={data.order} costs={costs} onCosts={onCosts} theme={C}/>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,fontSize:12}}>
     <div><b>Commande {order.orderId}</b><div style={{color:C.muted,marginTop:4}}>Acheteur : {data.order.buyer?.username || '—'}</div><div style={{marginTop:4}}>Total : {montant(frais?.total?.value,frais?.total?.currency)}</div></div>
     <div><b>Livraison</b>{ship?<div style={{color:C.muted,lineHeight:1.5,marginTop:4}}>{ship.fullName}<br/>{[adresse?.addressLine1,adresse?.addressLine2].filter(Boolean).join(' ')}<br/>{[adresse?.postalCode,adresse?.city,adresse?.countryCode].filter(Boolean).join(' ')}{adresseTexte && <div><button type="button" style={{...S.button,marginTop:6}} onClick={async()=>{try{await navigator.clipboard.writeText(adresseTexte);setCopie('Adresse copiée');}catch(_){setCopie('Copie indisponible');}}}>Copier l’adresse</button><span role="status" style={{display:'block',marginTop:4}}>{copie}</span></div>}</div>:<div style={{color:C.muted}}>Adresse non fournie par eBay.</div>}</div>
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
     <label style={S.label}>Objet<input aria-label="Objet du message eBay" maxLength={200} value={subject} onChange={e=>draft.modifier({subject:e.target.value})} style={S.input}/></label>
     <label style={S.label}>Message<textarea aria-label="Message à l’acheteur eBay" maxLength={2000} rows={4} value={body} onChange={e=>draft.modifier({body:e.target.value})} style={S.input}/></label>
     {body && <small style={{color:C.muted}}>{draft.saved?'Brouillon conservé dans cet onglet.':'Brouillon non sauvegardé : garde cette commande ouverte.'}</small>}
     <button type="button" style={S.button} disabled={busy || !body.trim() || !subject.trim()} onClick={async()=>{
      const sent={body,subject};
      if(!await confirm({title:`Envoyer à ${data.order.buyer?.username || 'l’acheteur'} ?`,desc:`Commande ${order.orderId}\n${subject}\n\n${body}`,ok:'Envoyer le message',cancel:'Annuler'}))return;
      setBusy(true);setMessage('');try{await call('messageacheteur',{orderId:order.orderId,...sent,confirme:true},headers,{write:true});draft.effacerEnvoye(sent);setMessage('Message accepté par eBay.');}catch(e){setMessage(e.message);}finally{setBusy(false);}
     }}>Envoyer le message</button>
    </div></details>
   </>}
   <button type="button" disabled={busy} onClick={relire} style={{...S.button,justifySelf:'start'}}>Actualiser la commande</button>
  </div>
 </details>;
}

export function EbayMessages({compte='principal',owner,cible,onClearCible,headers,confirm,theme:C}){
 const call=(action,payload,headers,options)=>appelerEbay(action,{...payload,...(compte && compte!=='principal'?{compte}:{})},headers,options);
 const selection=useRef(null);
 const S=styleUI(C),[rows,setRows]=useState(null),[selected,setSelected]=useState(null),[body,setBody]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[pages,setPages]=useState(null),[search,setSearch]=useState(''),[historySearch,setHistorySearch]=useState(''),[draftOK,setDraftOK]=useState(true),[codeCopie,setCodeCopie]=useState('');
 const fermerConversation=()=>{selection.current=null;setSelected(null);};
 const chatPanel=useConversationFocus(selected?.id,fermerConversation);
 const resultatIncertain=useReponseIncertaine(owner,compte,selected?.id);
 const selectMessage=m=>{selection.current=m.id;setSelected(m);setBody(lireBrouillon(owner,compte,m.id));setDraftOK(true);setHistorySearch('');setCodeCopie('');setMessage('');};
 const modifierBody=v=>{setBody(v);if(selected)setDraftOK(sauverBrouillon(owner,compte,selected.id,v));};
 const cibleOuverte=useRef(null);
 useEffect(()=>{
  if(!cible || !rows || cibleOuverte.current===cible.id)return;
  let stop=false;cibleOuverte.current=cible.id;
  const m=rows.find(m=>String(m.id)===cible.id && (!cible.itemId || String(m.itemId)===cible.itemId));
  if(m){selectMessage(m);return;}
  if(cible.itemId)call('message',{messageId:cible.id,itemId:cible.itemId},headers).then(j=>{if(!stop && j.message && String(j.message.id)===cible.id && String(j.message.itemId)===cible.itemId){selectMessage(j.message);setRows(p=>[...(p || []),j.message]);}}).catch(e=>{if(!stop)setMessage(e.message);});
  return()=>{stop=true;};
 },[cible?.id,rows]);
 async function charger(next=1){setBusy(true);setMessage('');try{const j=await call('messages',{page:next},headers);if(!Array.isArray(j.messages))throw new Error('Les messages ne sont pas lisibles.');setRows(p=>next===1?j.messages:[...new Map([...(p || []),...j.messages].map(m=>[m.id,m])).values()]);setPage(next);setPages(j.totalPages);setSelected(p=>p?(j.messages.find(m=>m.id===p.id && m.itemId===p.itemId) || p):p);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 useEffect(()=>{charger();},[]);
 async function relireEchange(){
  const m=selected;if(!m?.itemId)return;
  setBusy(true);setMessage('');
  try{
   const j=await call('message',{messageId:m.id,itemId:m.itemId},headers);
   if(String(j.message?.id)!==String(m.id) || String(j.message?.itemId)!==String(m.itemId))throw new Error('L’échange exact n’a pas pu être relu.');
   setRows(p=>p?.map(x=>x.id===m.id?j.message:x));
   if(selection.current===m.id){setSelected(j.message);setMessage('Échange relu : vérifie les réponses avant de renvoyer.');}
   resultatIncertain.marquer(false);
  }catch(e){if(selection.current===m.id)setMessage(e.message);}
  finally{setBusy(false);}
 }
 const affiches=(rows || []).filter(m=>`${m.sender} ${m.subject} ${m.titre} ${m.body} ${(m.responses || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
 return <section><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><h2 className="vrm-ebay-titre-onglet" style={{margin:0,fontSize:22,color:C.text}}>Messages eBay</h2><button type="button" disabled={busy} onClick={()=>{cibleOuverte.current=null;charger();}} style={{...S.button,marginLeft:'auto'}}>Actualiser</button></div><Erreur message={message}/>
  {cible && <p style={{fontSize:12}}>Message sélectionné <button type="button" onClick={onClearCible}>Voir tous les échanges</button>{rows && !rows.some(m=>String(m.id)===cible.id) && <span role="status"> · Cet échange n’est pas dans la page lue. Charge la suite ou actualise.</span>}</p>}
  <div className="vrm-message-workspace"><div className="vrm-inbox-column">{Array.isArray(rows) && rows.length>0 && <input type="search" aria-label="Rechercher un message eBay" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un échange…" style={{...S.input,marginBottom:10}}/>}
   {busy && rows===null && <p style={{fontSize:12,color:C.muted}}>Lecture des messages…</p>}
   {rows && !affiches.length && <p style={{fontSize:12,color:C.muted}}>Aucun échange dans cette sélection.</p>}
   <div className="vrm-msg-list" style={{border:`1px solid ${C.border}`,background:C.card,display:affiches.length?undefined:'none'}}>{affiches.map(m=>{const aRepondre=/^unanswered$/i.test(m.status || '') && !(m.responses || []).length;const apercu=corpsLisible(m.body || '').replace(/\s+/g,' ').trim();const nom=m.sender || 'Acheteur',sujet=m.subject || m.titre || '',heure=heureCourte(m.date);return <button type="button" key={m.id} data-ebay-message={m.id} data-nonlu={aRepondre?'1':undefined} aria-label={[nom,sujet,heure,aRepondre?'pas encore de réponse':''].filter(Boolean).join(' ')} className={selected?.id===m.id?'vrm-inbox-row is-current':'vrm-inbox-row'} onClick={()=>selectMessage(m)} style={{color:C.text}}>
     <span className="vrm-msg-av" aria-hidden="true" style={{background:C.card2 || C.bg}}><span className="vrm-msg-ini" style={{color:C.muted}}>{nom.trim().charAt(0).toUpperCase() || '·'}</span></span>
     <span className="vrm-msg-body">
      <span className="vrm-msg-l1"><b className="vrm-msg-name">{nom}</b>{heure && <span className="vrm-msg-time" style={{color:aRepondre?C.accent:C.muted}}>{heure}</span>}</span>
      <span className="vrm-msg-l2"><span className="vrm-msg-extrait" style={{color:aRepondre?C.text:C.muted}}>{sujet}{apercu?<span style={{color:C.muted,fontWeight:400}}> — {apercu}</span>:null}</span>{aRepondre && <span className="vrm-msg-dot" title="Pas encore de réponse" style={{background:C.accent}}/>}</span>
     </span>
    </button>;})}</div>
   {rows && ((pages!=null && page<pages) || (pages==null && rows.length>=50*page)) && <button type="button" disabled={busy} onClick={()=>charger(page+1)} style={{...S.button,marginTop:10}}>Charger la suite</button>}
   <p style={{fontSize:10,color:C.muted}}>Échanges remontés par eBay sur les 90 derniers jours.</p>
  </div><div className="vrm-chat-column">
   {selected?<ResponsiveChatPortal><div className="vrm-chat-overlay vrm-chat-inline"><div ref={chatPanel} className="vrm-chat-panel" role="dialog" aria-label="Conversation eBay" style={{display:'flex',flexDirection:'column',background:C.card,overflow:'hidden'}}>
    <div style={{display:'flex',gap:8,padding:12,borderBottom:`1px solid ${C.border}`}}><div style={{flex:1,minWidth:0}}><b style={{fontSize:14}}>{selected.sender || 'Acheteur'}</b><div style={{fontSize:11,color:C.muted}}>{selected.titre || selected.subject}</div></div><button type="button" aria-label="Fermer la conversation eBay" onClick={fermerConversation} style={S.button}>×</button></div>
    {codesRetraitEbay([selected.body,...(selected.responses || [])]).length>0 && <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:8}}>{codesRetraitEbay([selected.body,...(selected.responses || [])]).map(code=><button key={code} type="button" aria-label={`Copier le code eBay ${code}`} style={S.button} onClick={async()=>{try{await navigator.clipboard.writeText(code);setCodeCopie(code);}catch(_){setCodeCopie('erreur');}}}>{code} · {codeCopie===code?'Copié':'Copier'}</button>)}{codeCopie==='erreur' && <span role="status" style={{fontSize:11}}>Copie indisponible. Le code reste visible.</span>}</div>}
    <input type="search" aria-label="Rechercher dans la conversation eBay" placeholder="Rechercher un message ou un code…" value={historySearch} onChange={e=>setHistorySearch(e.target.value)} style={{...S.input,flexShrink:0}}/>
    <div className="vrm-chat-history" style={{flex:1,overflow:'auto',padding:14,display:'grid',alignContent:'start',gap:10}}>{corpsLisible(selected.body).toLowerCase().includes(historySearch.toLowerCase()) && <div style={{padding:12,border:`1px solid ${C.border}`,borderRadius:10,fontSize:13,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{corpsLisible(selected.body)}</div>}{historySearch && ![selected.body,...(selected.responses || [])].some(r=>corpsLisible(r).toLowerCase().includes(historySearch.toLowerCase())) && <p style={{fontSize:12,color:C.muted}}>Aucun message ne correspond à cette recherche.</p>}{(selected.responses || []).filter(r=>corpsLisible(r).toLowerCase().includes(historySearch.toLowerCase())).map((r,i)=><div key={i} style={{padding:12,borderRadius:10,background:C.bg,fontSize:13,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{corpsLisible(r)}</div>)}</div>
    <div style={{padding:12,borderTop:`1px solid ${C.border}`,display:'grid',gap:8}}><Erreur message={message}/>{body && <small style={{color:C.muted}}>{draftOK?'Brouillon conservé dans cet onglet.':'Brouillon non sauvegardé : garde cet échange ouvert.'}</small>}<textarea aria-label="Réponse au message eBay" maxLength={2000} value={body} onChange={e=>modifierBody(e.target.value)} rows={3} placeholder="Écrire une réponse…" style={S.input}/><button type="button" style={S.button} disabled={busy || resultatIncertain.value || !body.trim() || !selected.itemId} onClick={async()=>{
     const m=selected,texte=body;if(!await confirm({title:`Répondre à ${m.sender || 'cet acheteur'} ?`,desc:`${m.titre || m.subject}\n\n${texte}`,ok:'Envoyer la réponse',cancel:'Annuler'}))return;
     setBusy(true);setMessage('');try{await call('repondre',{itemId:m.itemId,messageId:m.id,body:texte,confirme:true},headers,{write:true});effacerBrouillonSiIdentique(owner,compte,m.id,texte);setRows(p=>p?.map(x=>x.id===m.id?{...x,responses:[...(x.responses || []),texte]}:x));setSelected(p=>p?.id===m.id?{...p,responses:[...(p.responses || []),texte]}:p);if(selection.current===m.id){setBody(current=>current===texte?'':current);setMessage('Réponse acceptée par eBay.');}}catch(e){if(e.reason==='incertain')resultatIncertain.marquer(true);if(selection.current===m.id)setMessage(e.message);}finally{setBusy(false);}
    }}>Envoyer la réponse</button>{resultatIncertain.value && <div style={{fontSize:12,color:C.muted}}><p>Le résultat du dernier envoi n’est pas confirmé. Relis cet échange avant une nouvelle réponse.</p><button type="button" style={S.button} disabled={busy || !selected.itemId} onClick={relireEchange}>Relire l’échange</button></div>}{!selected.itemId && <small style={{color:C.muted}}>Cet échange n’a pas d’annonce identifiée. Le contact des acheteurs d’une commande reste disponible dans Ventes.</small>}</div>
   </div></div></ResponsiveChatPortal>:<div className="vrm-chat-empty"><span>Choisis un échange</span><small>Lis les réponses et réponds depuis VRM.</small></div>}
  </div></div>
 </section>;
}

export function EbayOffres({compte='principal',cible,onClearCible,headers,confirm,theme:C,onAnnonces}){
 const call=(action,payload,headers,options)=>appelerEbay(action,{...payload,...(compte && compte!=='principal'?{compte}:{})},headers,options);
 const S=styleUI(C),[rows,setRows]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[prices,setPrices]=useState({}),[page,setPage]=useState(1),[pages,setPages]=useState(null),[search,setSearch]=useState(''),[sort,setSort]=useState('deadline'),[now,setNow]=useState(Date.now());
 async function charger(next=1){if(next===1)offreCibleLue.current=null;setBusy(true);setMessage('');try{const j=await call('offresrecues',{page:next},headers);if(!Array.isArray(j.offres))throw new Error('Les offres ne sont pas lisibles.');setRows(p=>next===1?j.offres:[...new Map([...(p || []),...j.offres].map(o=>[o.id,o])).values()]);setPage(next);setPages(j.totalPages);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 useEffect(()=>{charger();const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
 const affiches=offresAffichees(rows,{search,sort,cible});
 const offreCibleLue=useRef(null);
 useEffect(()=>{if(!cible || !rows || offreCibleLue.current===cible.id)return;let stop=false;offreCibleLue.current=cible.id;if(rows.some(o=>String(o.id)===cible.id && (!cible.itemId || String(o.itemId)===cible.itemId)))return;if(cible.itemId)call('offredetail',{offerId:cible.id,itemId:cible.itemId},headers).then(j=>{if(!stop && String(j.offre?.id)===cible.id && String(j.offre?.itemId)===cible.itemId)setRows(p=>[...(p || []),j.offre]);}).catch(e=>{if(!stop)setMessage(e.message);});return()=>{stop=true;};},[cible?.id,rows]);

 async function agir(o,decision){const prix=prices[o.id];if(decision==='Counter' && (!/^\d+(?:[.,]\d{1,2})?$/.test(String(prix || '')) || Number(String(prix).replace(',','.'))<=0)){setMessage('Indique un prix valide.');return;}
  const action=decision==='Accept'?'Accepter':decision==='Decline'?'Refuser':'Proposer';
  if(!await confirm({title:`${action} ${decision==='Counter'?montant(String(prix).replace(',','.'),o.currency):montant(o.price,o.currency)} ?`,desc:`${o.titre}\nAcheteur : ${o.buyer || '—'}\nQuantité : ${o.quantity}\n\n${decision==='Accept'?'Cette décision accepte le prix proposé ; elle ne prouve pas le paiement.':'La réponse sera transmise à l’acheteur sur eBay.'}`,ok:action,cancel:'Annuler'}))return;
  setBusy(true);setMessage('');try{await call('repondreoffre',{itemId:o.itemId,offerId:o.id,decision,price:prix,expectedPrice:o.price,currency:o.currency,confirme:true},headers,{write:true});await charger();setMessage('Réponse à l’offre acceptée par eBay.');}catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 return <section className="vrm-ebay-offers"><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><h2 className="vrm-ebay-titre-onglet" style={{margin:0,fontSize:22,color:C.text}}>Offres eBay</h2><button type="button" onClick={()=>charger()} disabled={busy} style={{...S.button,marginLeft:'auto'}}>Actualiser</button></div><Erreur message={message}/>
  {rows===null && busy && <p style={{fontSize:12,color:C.muted}}>Lecture des offres…</p>}{rows && !rows.length && <p style={{fontSize:12,color:C.muted}}>Aucune offre reçue en attente.</p>}
  {cible && <p style={{fontSize:12}}>Offre {cible.id} <button type="button" onClick={onClearCible}>Voir toutes les offres</button>{rows && !rows.some(o=>String(o.id)===cible.id) && <span role="status"> · Cette offre n’est plus dans la page lue. Actualise ou charge la suite.</span>}</p>}
  {!cible && rows && <div className="vrm-ebay-offer-toolbar"><input type="search" aria-label="Rechercher une offre eBay" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Article, acheteur, référence…" style={S.input}/><label style={S.label}>Trier par<select aria-label="Trier les offres eBay" value={sort} onChange={e=>setSort(e.target.value)} style={S.input}><option value="deadline">Échéance</option><option value="title">Article</option><option value="buyer">Acheteur</option></select></label></div>}
  {!cible && rows && <div className="vrm-ebay-results" role="status"><span>{affiches.length} offre{affiches.length>1?'s':''} affichée{affiches.length>1?'s':''} · pages chargées uniquement</span>{search && <button type="button" onClick={()=>setSearch('')}>Effacer la recherche</button>}</div>}
  {rows?.length>0 && !affiches.length && !cible && <p style={{fontSize:12,color:C.muted}}>Aucune offre ne correspond à cette recherche. Tu peux charger la suite des offres.</p>}
  <div className="vrm-ebay-offer-grid" style={{display:'grid',gap:10}}>{affiches.map(o=>{const active=['Active','Pending'].includes(o.status) && (!o.expiresAt || Date.parse(o.expiresAt)>now);const known=active && /^[A-Z]{3}$/.test(o.currency || '') && centimes(o.price)!=null && centimes(o.price)>0 && Number.isInteger(o.quantity) && o.quantity>0;return <article className="vrm-ebay-offer-card" key={o.id} style={{border:`1px solid ${C.border}`,borderRadius:12,padding:14,background:C.card}}><div className="vrm-ebay-offer-heading" style={{display:'flex',gap:10,justifyContent:'space-between'}}> <div style={{minWidth:0}}><b style={{fontSize:13}}>{o.titre || `Annonce ${o.itemId}`}</b><div style={{fontSize:11,color:C.muted,marginTop:4}}>{o.buyer || 'Acheteur'} · quantité {o.quantity || '—'}{o.expiresAt?` · expire le ${new Date(o.expiresAt).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`:''}</div></div><b className="vrm-display" style={{fontSize:20,whiteSpace:'nowrap'}}>{montant(o.price,o.currency)}</b></div>{active && o.expiresAt && Date.parse(o.expiresAt)-now<=3600000 && <p className="vrm-ebay-offer-state">Expire dans moins d’une heure</p>}{o.message && <p style={{fontSize:12,color:C.muted}}>{o.message}</p>}
   {!known && <p className="vrm-ebay-offer-state" role="status">{active?'Informations manquantes : actualise avant de répondre.':'Cette offre n’est plus active.'}</p>}<div className="vrm-ebay-offer-actions" style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}><button type="button" style={{...S.button,border:'none',background:C.accent,color:'#fff',fontWeight:700,opacity:(busy || !known)?0.45:1}} disabled={busy || !known} onClick={()=>agir(o,'Accept')}>Accepter</button><button type="button" style={{...S.button,background:'transparent',opacity:(busy || !known)?0.45:1}} disabled={busy || !known} onClick={()=>agir(o,'Decline')}>Refuser</button></div><details className="vrm-ebay-counteroffer" style={{marginTop:10}}><summary style={{fontSize:12.5,cursor:'pointer',color:C.accentSoft || C.accent,fontWeight:700,textDecoration:'underline',textUnderlineOffset:3,minHeight:44}}>Faire une contre-offre</summary><div style={{display:'flex',gap:8,marginTop:8}}><input aria-label={`Contre-offre ${o.id}`} inputMode="decimal" value={prices[o.id] || ''} onChange={e=>setPrices(p=>({...p,[o.id]:e.target.value}))} placeholder={`Prix ${o.currency || ''}`} style={S.input}/><button type="button" style={S.button} disabled={busy || !known} onClick={()=>agir(o,'Counter')}>Proposer</button></div></details>
  </article>;})}</div>
  {rows && ((pages!=null && page<pages) || (pages==null && rows.length>=50*page)) && <button type="button" disabled={busy} onClick={()=>charger(page+1)} style={{...S.button,marginTop:10}}>Charger la suite</button>}
  <button type="button" onClick={onAnnonces} style={{...S.button,marginTop:14}}>Proposer aux observateurs d’une annonce</button>
 </section>;
}

export function EbayAgent({compte='principal',headers,theme:C,onSection}){
 const S=styleUI(C),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState(''),[allHistory,setAllHistory]=useState(false),[sectionFilter,setSectionFilter]=useState('all');
 async function charger(){setBusy(true);setError('');try{setData(await appelerEbay('agent',{compte},headers));}catch(e){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{charger();},[]);
 const labels={expedier:'Expédition',messageacheteur:'Message acheteur',repondre:'Réponse',repondreoffre:'Offre',modifierannonce:'Annonce modifiée',terminerannonce:'Fin d’annonce'};
 const matchingTasks=(data?.tasks || []).filter(t=>`${t.title || ''} ${t.ref} ${t.label}`.toLowerCase().includes(search.toLowerCase()));
 const tasks=matchingTasks.filter(t=>sectionFilter==='all' || t.section===sectionFilter);
 const history=data?.journal || [],incertains=history.filter(j=>['incertain','en_cours'].includes(j.etat)),autres=history.filter(j=>!['incertain','en_cours'].includes(j.etat));
 return <section className="vrm-ebay-tasks"><div className="vrm-ebay-heading" style={{display:'flex',gap:8,alignItems:'center'}}><h2 className="vrm-ebay-titre-onglet" style={{fontSize:22,margin:0}}>À traiter sur eBay</h2><button type="button" disabled={busy} onClick={charger} style={{...S.button,marginLeft:'auto'}}>{busy?'Lecture…':'Actualiser'}</button></div><Erreur message={error}/>
 {data && <>
 {(data.sources || []).some(s=>!s.ok || s.ancien) && <p role="status" style={{fontSize:12,color:C.muted}}>Certaines données sont anciennes ou indisponibles. Actualise les commandes dans Compte ; les tâches affichées peuvent être incomplètes.</p>}
 <input type="search" aria-label="Rechercher une tâche eBay" placeholder="Rechercher un article ou une commande…" value={search} onChange={e=>setSearch(e.target.value)} style={{...S.input,marginTop:12}}/>
 <nav className="vrm-ebay-task-filters" aria-label="Filtrer les tâches eBay">{[['all','Tout'],['ventes','Expéditions'],['messages','Messages'],['offres','Offres']].map(([value,label])=><button type="button" key={value} aria-pressed={sectionFilter===value} onClick={()=>setSectionFilter(value)} style={{...S.button,color:sectionFilter===value?C.text:C.muted,background:sectionFilter===value?C.border:C.card}}>{label}<span className="vrm-ebay-filter-count">{value==='all'?matchingTasks.length:matchingTasks.filter(t=>t.section===value).length}</span></button>)}</nav>
 <div className="vrm-ebay-task-groups" style={{display:'grid',gap:16,marginTop:14}}>{[['ventes','Expéditions'],['messages','Messages'],['offres','Offres']].map(([section,label])=>{const group=tasks.filter(t=>t.section===section);return group.length>0 && <div key={section}><h3 style={{fontSize:13,margin:'0 0 7px',color:C.muted}}>{label} · {group.length}</h3><div style={{display:'grid',gap:6}}>{group.map(t=><button className="vrm-ebay-task-row" type="button" key={t.id} onClick={()=>onSection(t.section,t)} style={{...S.button,display:'flex',gap:10,alignItems:'center',textAlign:'left',minWidth:0}}><span style={{flex:1,minWidth:0}}><b style={{display:'block',overflowWrap:'anywhere'}}>{t.title || t.label}</b><small style={{display:'block',color:C.muted,marginTop:3}}>{t.label} · {t.ref}</small>{t.deadline && <small style={{display:'block',marginTop:4,color:t.urgent?C.warn:C.muted}}>Échéance : {new Date(t.deadline).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small>}</span><span style={{flexShrink:0,textAlign:'right'}}>{t.price!=null && /^\d+(?:[.,]\d{1,2})?$/.test(String(t.price)) && <b style={{display:'block'}}>{montant(String(t.price).replace(',','.'),t.currency)}</b>}<span aria-hidden="true">→</span></span></button>)}</div></div>;})}</div>
 {!tasks.length && <p style={{fontSize:12,color:C.muted}}>{search?'Aucune tâche ne correspond à cette recherche.':sectionFilter!=='all'?'Aucune tâche dans cette catégorie parmi les données lues.':'Aucune action détectée dans les données lues.'}</p>}
 <details style={{marginTop:14,fontSize:11,color:C.muted}}><summary style={{cursor:'pointer'}}>Sources et dernière lecture</summary><div style={{display:'grid',gap:5,marginTop:8}}>{(data.sources || []).map(s=><span key={s.nom}>{s.nom} : {s.ok?(s.partiel?'lecture partielle':'à jour'):'lecture indisponible'}{s.at?` · ${new Date(s.at).toLocaleString('fr-FR')}`:''}</span>)}</div></details>
 <h3 style={{fontSize:15,marginTop:24}}>Historique des actions</h3>{!data.journalLisible?<Erreur message="Historique indisponible."/>:!history.length?<p style={{fontSize:12,color:C.muted}}>Les prochaines actions effectuées dans VRM apparaîtront ici.</p>:<><div style={{display:'grid',gap:8}}>{[...incertains,...(allHistory?autres:autres.slice(0,5))].map(j=><div key={j.id} style={{padding:10,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}}><b>{labels[j.action] || j.action}</b> · {j.ref}<div style={{fontSize:11,color:C.muted,marginTop:4}}>{new Date(j.at).toLocaleString('fr-FR')} · {j.etat==='reussi'?'Confirmé par eBay':j.etat==='refuse'?'Refusé': 'À vérifier sur eBay'}</div>{['incertain','en_cours'].includes(j.etat) && <button type="button" style={{...S.button,marginTop:8}} onClick={()=>onSection(j.action.includes('offre')?'offres':j.action==='repondre'?'messages':j.action.includes('annonce')?'annonces':'ventes',{targetId:j.entityId || (['expedier','messageacheteur'].includes(j.action)?j.ref:null),ref:j.ref})}>Relire avant de reprendre</button>}</div>)}</div>{autres.length>5 && <button type="button" onClick={()=>setAllHistory(v=>!v)} style={{...S.button,marginTop:8}}>{allHistory?'Réduire l’historique':`Voir les ${history.length} actions`}</button>}</>}
 </>}
 </section>;
}

function EbayBenefice({order,costs,onCosts,theme:C}){
 const S=styleUI(C),b=bilanCommandeEbay(order,costs);
 if(!b.entry)return <p style={{fontSize:11,color:C.muted}}>{b.raison}</p>;
 return <details style={{fontSize:12}}><summary style={{cursor:'pointer'}}>{order.orderPaymentStatus==='PAID'?'Bénéfice de l’article':'Bénéfice prévisionnel'} : {b.benefice==null?'à compléter':montant(b.benefice,'EUR')+(b.complet?'':' estimé')}</summary><p style={{color:C.muted}}>Article : {montant(b.prixArticle,'EUR')} · {b.commissionAuto!=null?`Commission eBay lue : ${montant(b.commissionAuto,'EUR')}`:'Commission eBay non fournie : renseigne-la si tu la connais.'}</p><label style={S.label}>Prix d’achat<input aria-label="Prix d’achat eBay" inputMode="decimal" defaultValue={costs.buyPrice || ''} key={costs.buyPrice || ''} style={S.input} onBlur={ev=>{const v=ev.target.value.trim();if(v && centimes(v)==null){ev.target.setCustomValidity('Indique un montant valide en euros.');ev.target.reportValidity();return;}ev.target.setCustomValidity('');onCosts({buyPrice:v});}} onInput={ev=>ev.target.setCustomValidity('')}/></label><CoutsVente entry={b.entry} readonlyKeys={b.commissionAuto!=null?['commission']:[]} onSave={patch=>onCosts({...patch,...(patch.fraisComplets===true && b.commissionAuto!=null?{commissionLueConfirmee:b.commissionAuto}:{})})} theme={C}/></details>;
}
