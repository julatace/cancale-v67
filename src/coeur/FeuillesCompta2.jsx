// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import { motTaille } from '../vocabulaireVendeur.js';
import { dateLocale } from '../formatsDate.js';
import { suiviDeLigne } from '../../api/_lib/suivi-colis.js';
import { candidatsNouvelle, etatSuiviMain } from '../annoncesActions.js';
import { etatRemise } from '../annuleesChezToi.js';
import { gestesDormeuse } from '../vendrePlus.js';
import React from 'react';
import { createPortal } from 'react-dom';
import { CLE_REGLAGE_ETIQUETTE, lireReglageEtiquette, poserEtiquette } from '../etiquetteNumero.js';
import { CLE_QR_POSES, titreQrAbsent, qrParCapture } from '../qrCapture.js';
import { AUTH, Bouton, C, CARRIERS, CarrierBadge, DEMANDE_EBAY_PAIRE, DEMANDE_LBC_FICHE, DEMANDE_VC_PAIRE, EXT_CAPACITES, FURN_TYPES, FermeAuRetour, GardeEcranAllume, INV_STATUS, Icon, MicDictee, PROFIL_VENDEUR, PhotoVinted, Pourquoi, SheetShell, Skeleton, StatBox, TamponPose, Z_CONFIRMATION, aLaDemande, annotateAndDownloadBordereau, askConfirm, carrierKey, carrierName, classifyOrderStatus, cleNum, cleanLieu, codeRetrait, colisKey, demanderVue, enTeteSession, entreePool, estTamponAnnule, exemplesActuels, extSait, extractBrand, extractSize, gesteVrm, libererOngletPdf, lireTout, load, mpChoisi, normTitle, normalizePlan, numeroReprenable, orderPhoto, prixAchatDe, retraitMode, save, toast, trackUrl, triPool, vendActuel, vmrCmd } from '../App.jsx';

// La branche {showLister && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleShowLister({ v }) {
  const { copied, copyText, listBuy, listQ, listSize, lister, setListBuy, setListQ, setListSize, setShowLister } = v;
  return (/*⟦← App.jsx #v1⟧*/<div onClick={()=>setShowLister(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setShowLister(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'90vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>🪄 Aide à la vente</div>
                <div className="vrm-aide" style={{fontSize:11,color:C.muted}}>Prix conseillé d'après TES ventes + titre & description prêts à coller</div>
              </div>
              <button type="button" onClick={()=>setShowLister(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:16}}>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
                <input value={listQ} onChange={e=>setListQ(e.target.value)} placeholder={exemplesActuels().modele} autoFocus
                  style={{flex:'2 1 200px',border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px',fontSize:15,fontFamily:'inherit',background:C.card,color:C.text,outline:'none'}}/>
                <MicDictee onText={(t)=>setListQ(t)} titre="Dicter le modèle"/>
                <input value={listSize} onChange={e=>setListSize(e.target.value)} placeholder={motTaille(vendActuel())} inputMode="decimal"
                  style={{flex:'1 1 80px',border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px',fontSize:15,fontFamily:'inherit',background:C.card,color:C.text,outline:'none'}}/>
                <input value={listBuy} onChange={e=>setListBuy(e.target.value)} placeholder="Prix d'achat&nbsp;€" inputMode="decimal"
                  style={{flex:'1 1 90px',border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px',fontSize:15,fontFamily:'inherit',background:C.card,color:C.text,outline:'none'}}/>
              </div>
              {!lister ? (
                <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'24px 16px',lineHeight:1.5}}>Tape le modèle de l'article que tu mets en vente.<br/><span style={{fontSize:12}}>Un prix d'après tes ventes, un titre et une description.</span></div>
              ) : (<>
                {/* Prix conseillé */}
                <div style={{border:`1.5px solid ${C.accent}`,background:`${C.accent}12`,borderRadius:12,padding:'13px 15px',marginBottom:14}}>
                  {lister.reco!=null ? (<>
                    <div style={{fontSize:11,color:C.muted,fontWeight:500,textTransform:'uppercase',letterSpacing:0.4}}>Prix conseillé</div>
                    <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
                      <div style={{fontSize:34,fontWeight:700,color:C.accentTexte,lineHeight:1.1}}>{lister.reco}&nbsp;€</div>
                      {lister.lo!=null && lister.hi!=null && lister.hi!==lister.lo && <div style={{fontSize:12,color:C.muted}}>fourchette {lister.lo}–{lister.hi}&nbsp;€</div>}
                    </div>
                    <div style={{fontSize:11,color:C.muted,marginTop:5,lineHeight:1.45}}>
                      {lister.soldNb>0
                        ? <>Basé sur <b>{lister.soldNb}</b> vente{lister.soldNb>1?'s':''} identique{lister.soldNb>1?'s':''} chez toi (médiane {lister.soldMed}&nbsp;€){lister.joursMoy!=null?<> · vendues en <b>{lister.joursMoy.toFixed(0)} j</b> en moyenne</>:''}.</>
                        : lister.onlineNb>0
                          ? <>Aucune vente passée : basé sur <b>{lister.onlineNb}</b> de tes annonces en ligne (médiane {lister.onlineMed}&nbsp;€).</>
                          : <>Pas d'historique pour ce modèle — prix calé sur ta marge minimale.</>}
                      {lister.bumped && <> <span style={{color:C.warn,fontWeight:500}}>Relevé à ton plancher de marge ({lister.floor}&nbsp;€).</span></>}
                    </div>
                    {lister.margin!=null && (
                      <div style={{marginTop:8,fontSize:13,fontWeight:600,color:lister.margin>0?C.accent:C.danger}}>
                        {lister.margin>0?`≈ +${Math.round(lister.margin)}\u00a0€ de marge brute`:`⚠️ ${Math.round(lister.margin)}\u00a0€ : sous ton prix d'achat`}
                        <span style={{color:C.muted,fontWeight:600}}> (achat {Math.round(parseFloat(String(listBuy).replace(',','.')))}&nbsp;€, hors boost)</span>
                      </div>
                    )}
                  </>) : (
                    <div style={{fontSize:13,color:C.muted}}>Pas assez d'infos : ajoute un prix d'achat, ou un modèle plus courant.</div>
                  )}
                </div>
                {/* Titre optimisé */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:C.muted,fontWeight:500,marginBottom:5}}>TITRE OPTIMISÉ</div>
                  <div style={{display:'flex',gap:8,alignItems:'stretch'}}>
                    <div style={{flex:1,minWidth:0,border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'9px 12px',fontSize:13,fontWeight:500,color:C.text}}>{lister.title}</div>
                    <button type="button" onClick={()=>copyText(lister.title,'title')} style={{flexShrink:0,border:`1px solid ${C.accent}`,background:copied==='title'?C.accent:`${C.accent}12`,color:copied==='title'?'#fff':C.accent,borderRadius:12,padding:'0 14px',fontSize:13,fontWeight:600,cursor:'pointer'}}>{copied==='title'?'✓ Copié':'Copier'}</button>
                  </div>
                </div>
                {/* Description prête */}
                <div style={{marginBottom:6}}>
                  <div style={{fontSize:11,color:C.muted,fontWeight:500,marginBottom:5}}>DESCRIPTION PRÊTE À COLLER</div>
                  <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 13px',fontSize:13,color:C.text,whiteSpace:'pre-wrap',lineHeight:1.5}}>{lister.desc}</div>
                  <button type="button" onClick={()=>copyText(lister.desc,'desc')} style={{marginTop:8,width:'100%',border:`1px solid ${C.accent}`,background:copied==='desc'?C.accent:`${C.accent}12`,color:copied==='desc'?'#fff':C.accent,borderRadius:12,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer'}}>{copied==='desc'?'✓ Description copiée':'📋 Copier la description'}</button>
                </div>
                <div style={{fontSize:11,color:C.muted,lineHeight:1.5,borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:12}}>Prix tiré de tes ventes du même modèle. Colle tout sur Vinted, avec tes photos.</div>
              </>)}
            </div>
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {lotView && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleLotView({ v }) {
  const { cur, entryKeyByPhoto, lotPanneauRef, lotView, numeros, setLotView } = v;
  return (/*⟦← App.jsx #v2⟧*/<div onClick={()=>setLotView(null)} style={{position:'fixed',inset:0,zIndex:1300,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setLotView(null)}/>
          <div ref={lotPanneauRef} role="dialog" aria-modal="true" aria-label="Paires du lot" tabIndex={-1} data-lot-paires=""
            onKeyDown={e=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); setLotView(null); } }}
            onClick={e=>e.stopPropagation()} style={{outline:'none',width:'min(560px,100%)',maxHeight:'82vh',overflowY:'auto',background:C.bg,borderRadius:'18px 18px 0 0',padding:'16px 16px calc(28px + env(safe-area-inset-bottom))'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <div style={{fontSize:17,fontWeight:700,color:C.text}}>📦 Paires du lot</div>
              <button className="vrm-icon-control" type="button" onClick={()=>setLotView(null)} aria-label="Fermer" style={{border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,width:34,height:34,cursor:'pointer',fontSize:15,fontWeight:600,fontFamily:'inherit'}}><Icon name="close" size={15}/></button>
            </div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{lotView.order?.title||''}{lotView.order?.price?.amount!=null?` · ${Number(lotView.order.price.amount).toFixed(0)}\u00a0${cur(lotView.order.price?.currency_code)}`:''}{classifyOrderStatus(lotView.order?.status)==='cancelled'?' · ❌ remboursé (hors CA)':''}</div>
            {lotView.loading ? (
              <Skeleton variant="row" count={4}/>
            ) : lotView.items.length===0 ? (
              <div style={{textAlign:'center',padding:'26px 16px',color:C.muted,fontSize:13,lineHeight:1.5}}>Détail indisponible.<br/><span style={{fontSize:12}}>Vinted ne l'a pas renvoyé (compte déconnecté ?).</span></div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {lotView.items.map((it,i)=>{
                  // Chaque article du lot porte son IDENTIFIANT d'annonce → on
                  // retrouve son N° avec certitude, jamais par ressemblance de
                  // titre (§5.34). À défaut, la photo de l'article. Sinon rien.
                  const e=(it.id&&numeros[String(it.id)])||(it.photo?numeros[entryKeyByPhoto({photo:it.photo})]:null)||null;
                  const num=e&&e.numero!=null?String(e.numero):null;
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 11px'}}>
                      {it.photo
                        ? <PhotoVinted src={it.photo} alt="" style={{flexShrink:0,width:34,height:34,borderRadius:12,objectFit:'cover',background:C.border}}/>
                        : <span style={{flexShrink:0,width:34,height:34,borderRadius:12,background:C.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
                      <span style={{flexShrink:0,minWidth:30,height:30,borderRadius:12,background:num?C.accent:C.border,color:num?C.onAccent:C.muted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,padding:'0 5px'}}>{num?`#${num}`:'—'}</span>
                      <span style={{flex:'1 1 120px',minWidth:0,fontSize:13,fontWeight:500,color:C.text,overflow:'hidden',textOverflow:'ellipsis'}}>{it.title}{it.size?<span style={{color:C.muted,fontWeight:400}}> · {it.size}</span>:''}</span>
                      {it.price!=null && <span style={{fontSize:12,fontWeight:600,color:C.muted}}>{Number(it.price).toFixed(0)}&nbsp;€</span>}
                    </div>
                  );
                })}
                <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.5}}>Vinted ne donne que le total du lot, pas le prix par article. <Pourquoi label="Le N° ?">Le N° s'affiche quand le titre correspond à un de tes articles.</Pourquoi></div>
              </div>
            )}
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {showSourcing && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleShowSourcing({ v }) {
  const { checker, fmtE, setShowSourcing, setSrcPrice, setSrcQuery, sourcing, srcPrice, srcQuery } = v;
  return (/*⟦← App.jsx #v3⟧*/<div onClick={()=>setShowSourcing(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setShowSourcing(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>🎯 Sourcing — quoi racheter</div>
                <div style={{fontSize:11,color:C.muted}}>{sourcing.total} vente{sourcing.total>1?'s':''} finalisée{sourcing.total>1?'s':''} analysée{sourcing.total>1?'s':''}</div>
              </div>
              <button type="button" onClick={()=>setShowSourcing(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:16}}>
              {/* Vérificateur d'achat : en friperie, tape le modèle + le prix demandé */}
              <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 13px',marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:2}}>🔍 Vérificateur d'achat</div>
                <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginBottom:8}}>Modèle + prix demandé : tes ventes disent si ça vaut le coup.</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:checker?10:0}}>
                  <input value={srcQuery} onChange={e=>setSrcQuery(e.target.value)} placeholder={vendActuel()==='sneakers' ? 'Modèle (ex : gel-lyte, spezial…)' : exemplesActuels().modele}
                    style={{flex:'2 1 160px',border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 11px',fontSize:13,fontFamily:'inherit',background:C.bg,color:C.text,outline:'none'}}/>
                  <input value={srcPrice} onChange={e=>setSrcPrice(e.target.value)} placeholder="Prix demandé&nbsp;€" inputMode="decimal"
                    style={{flex:'1 1 90px',border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 11px',fontSize:13,fontFamily:'inherit',background:C.bg,color:C.text,outline:'none'}}/>
                </div>
                {checker && (checker.nb===0 ? (
                  <div style={{fontSize:12,color:C.muted}}>Aucune vente pour « {srcQuery.trim()} ». Essaie juste la marque.</div>
                ) : (()=>{
                  const ok = checker.estBenef!=null ? (checker.estBenef>=15?'go':checker.estBenef>=5?'mid':'no') : null;
                  const okCol = ok==='go'?INV_STATUS.online.color:ok==='mid'?C.warn:C.danger;
                  return (<>
                    <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:checker.estBenef!=null?10:0}}>
                      <StatBox label="Déjà vendues" value={checker.nb} sub={checker.lastDate?`dernière : ${checker.lastDate.toLocaleDateString('fr-FR')}`:undefined}/>
                      <StatBox label="Prix de vente moyen" value={fmtE(checker.avgSell)} color={C.accent}/>
                      {checker.joursMoy!=null && <StatBox label="Temps de vente" value={`${checker.joursMoy.toFixed(0)} j`}/>}
                      {checker.benefMoy!=null && <StatBox label="Bénéf. moyen/article" value={fmtE(checker.benefMoy)} color={checker.benefMoy>=0?INV_STATUS.online.color:C.danger} sub={`sur ${checker.benefNb} connue${checker.benefNb>1?'s':''}`}/>}
                      {checker.online>0 && <StatBox label="Déjà en ligne" value={checker.online} color={C.warn} sub="chez toi"/>}
                    </div>
                    {checker.estBenef!=null && (
                      <div style={{border:`1.5px solid ${okCol}`,background:`${okCol}14`,borderRadius:12,padding:'9px 12px'}}>
                        <div style={{fontSize:13,fontWeight:700,color:okCol}}>
                          {ok==='go'?'🟢 Fonce':ok==='mid'?'🟡 Négocie':'🔴 Laisse'} — bénéfice estimé {checker.estBenef>=0?'+':''}{checker.estBenef.toFixed(0)}&nbsp;€
                        </div>
                        <div style={{fontSize:11,color:C.muted,marginTop:3}}>Prix de vente moyen {fmtE(checker.avgSell)} − prix demandé {fmtE(checker.price)} (hors boost/frais).</div>
                      </div>
                    )}
                  </>);
                })())}
              </div>
              {sourcing.total===0 ? (
                <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'28px 16px',lineHeight:1.5}}>Pas encore de vente finalisée à analyser.</div>
              ) : (()=>{
                const bestMargin = (rows)=> rows.reduce((mx,r)=> (r.benefMoy!=null && (mx==null || r.benefMoy>mx))?r.benefMoy:mx, null);
                const Section = ({title, rows, hint})=>{
                  const bm = bestMargin(rows);
                  return (
                    <div style={{marginBottom:18}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:2}}>{title}</div>
                      <div style={{fontSize:11,color:C.muted,marginBottom:8}}>{hint}</div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {rows.map((r,i)=>{ const top = r.benefMoy!=null && bm!=null && r.benefMoy===bm && r.benefNb>0;
                          return (
                          <div key={i} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',border:`1px solid ${top?(INV_STATUS.online.color+'88'):C.border}`,borderRadius:12,background:top?`${INV_STATUS.online.color}10`:C.card}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.key==='—'?'Marque inconnue':(r.key==='?'?'Taille inconnue':r.key)} {top && <span style={{fontSize:11,color:INV_STATUS.online.color,fontWeight:500}}>★ top marge</span>}</div>
                              <div style={{fontSize:11,color:C.muted}}>{r.nb} vendue{r.nb>1?'s':''} · CA {fmtE(r.ca)}{r.joursMoy!=null?` · ${r.joursMoy.toFixed(0)} j en moy.`:''}</div>
                            </div>
                            <div style={{textAlign:'right',flexShrink:0}}>
                              <div style={{fontSize:15,fontWeight:700,color:r.benefMoy==null?C.muted:(r.benefMoy>=0?INV_STATUS.online.color:C.danger)}}>{r.benefMoy==null?'—':`${r.benefMoy>=0?'+':''}${r.benefMoy.toFixed(0)}\u00a0€`}</div>
                              <div style={{fontSize:11,color:C.muted}}>{r.benefMoy==null?'achat inconnu':'bénéf./article'}</div>
                            </div>
                          </div>
                        );})}
                      </div>
                    </div>
                  );
                };
                return (<>
                  <Section title="Par marque" rows={sourcing.brands} hint="Trié par nb de ventes. Le bénéfice/article aide à prioriser les rachats."/>
                  <Section title="Par taille" rows={sourcing.sizes} hint="Taille estimée depuis le titre — approximatif. « ? » = taille non détectée."/>
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.5,borderTop:`1px solid ${C.border}`,paddingTop:10}}>Bénéfice : seulement les ventes avec un prix d'achat (🔗 dans Annonces).</div>
                </>);
              })()}
            </div>
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {showTreasury && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleShowTreasury({ v }) {
  const { RETOUR_LABEL, buys, offBuys, retoursAttendus, setShowTreasury, treasury, walletEscrow } = v;
  return (/*⟦← App.jsx #v4⟧*/<div onClick={()=>setShowTreasury(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setShowTreasury(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'88vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>💰 Trésorerie</div>
                <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:1}}>L'argent réel, pas le chiffre d'affaires</div>
              </div>
              <button type="button" onClick={()=>setShowTreasury(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{padding:'14px 16px',overflowY:'auto'}}>
              {/* ARGENT RÉELLEMENT REÇU */}
              <div style={{border:`1px solid #16a34a55`,background:'#16a34a10',borderRadius:12,padding:'13px 15px',marginBottom:11}}>
                <div style={{fontSize:12,color:'#16a34a',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>✅ Reçu dans le porte-monnaie</div>
                <div style={{fontSize:34,fontWeight:700,color:C.text,margin:'3px 0',lineHeight:1}}>{Math.round(treasury.recu)}&nbsp;€</div>
                <div style={{fontSize:12,color:C.muted}}>{treasury.nRecu} vente{treasury.nRecu>1?'s':''} finalisée{treasury.nRecu>1?'s':''}, créditée{treasury.nRecu>1?'s':''} sur ton solde. <b>Sans</b> tes virements vers ta banque.</div>
              </div>
              {/* EN ATTENTE = somme des porte-monnaie Vinted (escrow réel si capté,
                  sinon somme des ventes en cours = argent que Vinted te retient). */}
              {(()=>{ const useEscrow = walletEscrow && walletEscrow.total>0; const val = useEscrow ? walletEscrow.total : treasury.attente; return (
              <div style={{border:`1px solid ${C.warn}55`,background:`${C.warn}10`,borderRadius:12,padding:'13px 15px',marginBottom:11}}>
                <div style={{fontSize:12,color:C.warn,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>⏳ En attente (porte-monnaie Vinted)</div>
                <div style={{fontSize:34,fontWeight:700,color:C.text,margin:'3px 0',lineHeight:1}}>{Math.round(val)}&nbsp;€</div>
                <div style={{fontSize:12,color:C.muted}}>{useEscrow ? <>Solde <b>en attente</b> réel, additionné sur {walletEscrow.accounts} porte-monnaie{walletEscrow.plusVieuxJours>1?<> — dont un lu il y a <b>{walletEscrow.plusVieuxJours} j</b>, repasse dessus pour le montant du jour</>:null}.</> : <>Somme de tes {treasury.nAttente} vente{treasury.nAttente>1?'s':''} en cours (bloquées par Vinted). <span style={{opacity:0.85}}>Ouvre ton porte-monnaie Vinted sur chaque compte pour le solde exact.</span></>}</div>
              </div>
              ); })()}
              {/* LITIGES EN COURS (paires qui reviennent : retour / remboursement / suspension) */}
              {retoursAttendus.length>0 && (
                <div style={{border:`1px solid ${C.danger}55`,background:`${C.danger}0e`,borderRadius:12,padding:'13px 15px',marginBottom:11}}>
                  <div style={{fontSize:12,color:C.danger,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>⚖️ {retoursAttendus.length} litige{retoursAttendus.length>1?'s':''} en cours</div>
                  <div className="vrm-aide" style={{fontSize:12,color:C.muted,margin:'3px 0 7px'}}>Des paires qui te reviennent (retour / remboursement / suspension) — à republier.</div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {retoursAttendus.slice(0,6).map((r,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                        <span style={{fontWeight:700,color:C.danger,background:`${C.danger}18`,borderRadius:6,padding:'1px 7px',flexShrink:0}}>{RETOUR_LABEL[r.kind]?.txt||'↩️'}</span>
                        <span style={{color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.num?`N°${r.num} · `:''}{r.title}</span>
                      </div>
                    ))}
                    {retoursAttendus.length>6 && <div style={{fontSize:11,color:C.muted}}>+ {retoursAttendus.length-6} autre{retoursAttendus.length-6>1?'s':''}…</div>}
                  </div>
                </div>
              )}
              {/* DÉPENSÉ */}
              <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'13px 15px',marginBottom:11}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>🛒 Argent dépensé (tous comptes)</div>
                <div style={{fontSize:28,fontWeight:700,color:C.text,margin:'3px 0',lineHeight:1}}>{buys.items===null && offBuys.length===0 ? '…' : `${Math.round(treasury.spent)}\u00a0€`}</div>
                <div style={{fontSize:12,color:C.muted}}>{treasury.nSpent} achat{treasury.nSpent>1?'s':''} (Vinted + hors Vinted){buys.items===null?' · chargement…':''}</div>
              </div>
              <div className="vrm-aide" style={{fontSize:11,color:C.muted,lineHeight:1.5}}>Basé sur le statut Vinted de chaque commande (fiable, se met à jour tout seul).</div>
            </div>
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {iaOpen && …} de Comptabilite, telle quelle, avec 1 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleIaOpen({ v }) {
  const { copied, copyText, eur, numeros, repubAi, setIaOpen, setRepubAi } = v;
  /*⟦← App.jsx #h5_1⟧*/const redigerIA = async (e) => {
    if (!e) return;
    setRepubAi({ busy:true, key:String(e.numero||e.id||''), res:null, why:'', reason:'' });
    try {
      const r = await fetch('/api/ai', { method:'POST', headers:{'content-type':'application/json', ...enTeteSession()},
        body: JSON.stringify({ title:e.title||'', brand:extractBrand(e.title)||'',
          size:e.size||extractSize(e.title)||'', price:e.price, desc:e.desc||'',
          key: (load('vrm_ai_key','')||'').trim() || undefined }) });
      const j = await r.json().catch(()=>({}));
      if (j && j.ok) setRepubAi({ busy:false, key:String(e.numero||e.id||''), res:{ title:j.title||'', desc:j.desc||'' }, why:j.why||'', reason:'' });
      else setRepubAi({ busy:false, key:String(e.numero||e.id||''), res:null, why:'', reason:(j&&j.reason)||'network' });
    } catch(_) { setRepubAi({ busy:false, key:String(e.numero||e.id||''), res:null, why:'', reason:'network' }); }
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v5⟧*/<div onClick={()=>setIaOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}} data-noswipe="1">
          <FermeAuRetour fermer={()=>setIaOpen(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'90vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>✨ Rédiger une annonce (IA)</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>Choisis un article : l'IA propose titre et description. <b>Tu copies, tu publies.</b> <Pourquoi>Rien n'est envoyé tout seul, et l'IA n'invente aucune caractéristique.</Pourquoi></div>
              </div>
              <button type="button" onClick={()=>setIaOpen(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{overflowY:'auto',padding:'10px 12px 16px'}}>
              {(()=>{ const items=Object.entries(numeros)
                  .filter(([id,e])=>e&&e.numero&&String(e.title||'').trim())
                  .sort((a,b)=>Number(b[1].numero||0)-Number(a[1].numero||0));
                if(!items.length) return <div style={{textAlign:'center',padding:'26px 12px',color:C.muted,fontSize:13}}>Aucun article numéroté à rédiger.</div>;
                return items.map(([id,e])=>{ const k=String(e.numero||id); const actif=repubAi.key===k;
                  return (
                  <div key={id} style={{background:C.card,border:`1px solid ${actif?C.accent+'55':C.border}`,borderRadius:12,padding:'8px 10px',marginBottom:6}}>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <div style={{width:40,height:40,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {e.photo?<PhotoVinted src={e.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:17}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
                      </div>
                      <div style={{flex:'1 1 130px',minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          <span style={{color:C.accentTexte,fontWeight:700}}>N°{e.numero}</span> {e.title}
                        </div>
                        {e.price!=null&&e.price!==''&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{eur(e.price).toFixed(2).replace('.',',')}&nbsp;€</div>}
                      </div>
                      <button type="button" onClick={()=>redigerIA({...e,id})} disabled={repubAi.busy&&actif}
                        style={{flexShrink:0,border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accentTexte,borderRadius:12,padding:'8px 12px',fontSize:13,fontWeight:700,cursor:repubAi.busy&&actif?'default':'pointer',fontFamily:'inherit',opacity:repubAi.busy&&actif?0.6:1}}>
                        {repubAi.busy&&actif?'…':'✨ Rédiger'}
                      </button>
                    </div>
                    {actif&&!repubAi.busy&&repubAi.reason&&(
                      <div style={{marginTop:8,fontSize:12,color:C.muted,lineHeight:1.45}}>
                        {repubAi.reason==='no-key'
                          ? <span data-ia-pas-active="">L'assistant IA n'est pas encore activé sur VRM pour ton compte : rien n'est rédigé sans lui, tes suggestions calculées restent là.</span>
                          : <>L'IA n'a pas répondu ({repubAi.reason}). Réessaie dans un instant.</>}
                      </div>
                    )}
                    {actif&&!repubAi.busy&&repubAi.res&&(()=>{
                      // (5 nov.) Le N° écrit là où il l'a choisi (Réglages → Numéros →
                      // « Le N° sur tes annonces Vinted », src/etiquetteNumero.js) : le
                      // texte copié est celui qui partira. Un refus (titre > 100) laisse
                      // le texte tel quel et le dit.
                      const etq=poserEtiquette({titre:repubAi.res.title,description:repubAi.res.desc},e.numero,lireReglageEtiquette(load(CLE_REGLAGE_ETIQUETTE,null)));
                      const tIA=etq.titre, dIA=etq.description;
                      return (
                      <div data-ia-etiquette={etq.pose?etq.place:(etq.refus?'refus':'aucune')} style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
                        <div style={{border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 10px',background:C.card2||C.card}}>
                          <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:500,marginBottom:2}}>Titre proposé</div>
                          <div style={{fontSize:13,color:C.text,fontWeight:600}}>{tIA}</div>
                          <button type="button" onClick={()=>copyText(tIA,'iat'+k)} style={{marginTop:6,border:`1px solid ${C.border}`,background:'transparent',color:copied==='iat'+k?C.accent:C.text,borderRadius:12,padding:'5px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{copied==='iat'+k?'✓ Copié':'Copier le titre'}</button>
                        </div>
                        <div style={{border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 10px',background:C.card2||C.card}}>
                          <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:500,marginBottom:2}}>Description proposée</div>
                          <div style={{fontSize:13,color:C.text,whiteSpace:'pre-wrap',lineHeight:1.45}}>{dIA}</div>
                          <button type="button" onClick={()=>copyText(dIA,'iad'+k)} style={{marginTop:6,border:`1px solid ${C.border}`,background:'transparent',color:copied==='iad'+k?C.accent:C.text,borderRadius:12,padding:'5px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{copied==='iad'+k?'✓ Copié':'Copier la description'}</button>
                        </div>
                        {etq.refus&&<div data-ia-etiquette-refus="" style={{fontSize:12,color:C.text}}>N°{e.numero} pas ajouté : {etq.refus}.</div>}
                        {repubAi.why&&<div style={{fontSize:11,color:C.muted,fontStyle:'italic'}}>{repubAi.why}</div>}
                      </div>
                    ); })()}
                  </div>
                  ); });
              })()}
            </div>
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {linkPickFor && …} de Comptabilite, telle quelle, avec 1 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleLinkPickFor({ v }) {
  const { bordKey, bordLinks, linkPickFor, linkSearch, numeros, onlineAnnonceIds, setBordLinks, setLinkPickFor, setLinkSearch } = v;
  /*⟦← App.jsx #h6_1⟧*/const setBordLink = (b, numero) => {
    const k = bordKey(b); if (!k) return;
    if (numero && !candidatsVenteSansAnnonce(numeros, onlineAnnonceIds, cleNum).some(e => cleNum(e.num) === cleNum(numero))) { toast('Cet article est encore en ligne ou ne fait plus partie des candidats. Aucun lien modifié.'); return; }
    setBordLinks(prev => { const u = { ...prev }; if (numero) u[k] = { numero: String(numero) }; else delete u[k]; save('vinted_bord_links', u); return u; });
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v6⟧*/(()=>{
        const q = linkSearch.trim().toLowerCase();
        const list = candidatsVenteSansAnnonce(numeros, onlineAnnonceIds, cleNum)
          .filter(e => !q || String(e.num).includes(q) || (e.title||'').toLowerCase().includes(q) || (e.size!=null && String(e.size).toLowerCase().includes(q)))
          .sort((a,b)=>(parseInt(a.num,10)||0)-(parseInt(b.num,10)||0));
        const already = bordLinks[bordKey(linkPickFor)];
        return (
        <div onClick={()=>setLinkPickFor(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setLinkPickFor(null)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'82vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:600,color:C.text}}>Relier à un article numéroté</div>
                  <div style={{fontSize:12,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{linkPickFor.modele||linkPickFor.article||'Bordereau'}{linkPickFor.taille?` · T${linkPickFor.taille}`:''}</div>
                </div>
                <button type="button" onClick={()=>setLinkPickFor(null)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
              </div>
              <input autoFocus value={linkSearch} onChange={e=>setLinkSearch(e.target.value)} placeholder="Chercher par N°, titre ou taille…" style={{marginTop:10,width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px',fontSize:13,background:C.card,color:C.text,outline:'none',fontFamily:'inherit'}}/>
            </div>
            <div style={{flex:1,overflow:'auto',padding:10,display:'flex',flexDirection:'column',gap:6}}>
              {already && <button type="button" onClick={()=>{ setBordLink(linkPickFor, null); setLinkPickFor(null); }} style={{border:`1px solid ${C.danger}66`,background:'transparent',color:C.danger,borderRadius:12,padding:'10px 12px',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',textAlign:'left'}}>✕ Retirer le lien actuel (N°{already.numero})</button>}
              {list.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'24px 12px'}}>Aucun article hors ligne{q?' pour cette recherche':' disponible'} (ceux en ligne ne sont pas proposés).</div>}
              {list.map(e=>(
                <button key={e.num} type="button" onClick={()=>{ setBordLink(linkPickFor, e.num); setLinkPickFor(null); }}
                  style={{display:'flex',gap:10,alignItems:'center',border:`1px solid ${already&&String(already.numero)===String(e.num)?C.accent:C.border}`,background:C.card,borderRadius:12,padding:'8px 10px',cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
                  <div style={{width:42,height:42,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {e.photo?<PhotoVinted src={e.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:17}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>N°{e.num}{e.size!=null&&String(e.size).trim()!==''?` · T${e.size}`:''}</div>
                    <div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.title||''}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        );
      })()/*⟦←/⟧*/);
}

// La branche {tourneeOpen && …} de Comptabilite, telle quelle, avec 3 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleTourneeOpen({ v }) {
  const { buysBase, collected, geo, isPickupActive, markCollected, setCollected, setTourneeOpen, tracking } = v;
  /*⟦← App.jsx #h7_1⟧*/const markAllCollected = (list) => {
    // (Comme avant : seule la liste des retirés change — pas de date posée par ce geste de lot.)
    const vus = new Set(); const ops = [];
    for (const t of (list || [])) { const k = colisKey(t); if (!k || vus.has(k) || collected.has(k)) continue; vus.add(k);
      ops.push({ k: 'vrm_colis_collected', type: 'ensemble', id: k, apres: true, avant: false }); }
    if (!ops.length) return;
    gesteVrm(vus.size > 1 ? `${vus.size} colis retirés` : 'Colis retiré', ops, { vrm_colis_collected: setCollected });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h7_2⟧*/const unique = (liste, cle, valeur) => {
    let trouve = null;
    for (const x of liste) { if (cle(x) === valeur) { if (trouve) return null; trouve = x; } }
    return trouve;
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h7_3⟧*/const buyForTrack = (t) => {
    const n = normTitle(t && t.artTitle); if (!n) return null;
    // Le titre doit aussi être unique côté COLIS : deux colis au même libellé ne
    // peuvent pas revendiquer le même achat.
    if (!unique(tracking || [], (x) => normTitle(x.artTitle || ''), n)) return null;
    return unique(buysBase, (o) => normTitle(o.title || ''), n);
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v7⟧*/(()=>{
        const avail=(tracking||[]).filter(isPickupActive);
        const groups={};
        avail.forEach(t=>{ const c=cleanLieu(t.lieu); const key=c.nom || carrierName(t.carrier); if(!groups[key]) groups[key]={colis:[],carrier:t.carrier,adresse:c.adresse||'',geo:geo[c.nom]||null}; groups[key].colis.push(t); if(!groups[key].carrier) groups[key].carrier=t.carrier; });
        const points=Object.entries(groups).map(([nom,g])=>({nom,...g})).sort((a,b)=>b.colis.length-a.colis.length || a.nom.localeCompare(b.nom));
        const mapsUrl=(p)=> p.geo&&p.geo.lat ? `https://www.google.com/maps/search/?api=1&query=${p.geo.lat},${p.geo.lon}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.nom+(p.adresse?' '+p.adresse:''))}`;
        return (
        <div onClick={()=>setTourneeOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1350,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setTourneeOpen(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>🗺️ Ma tournée</div><div style={{fontSize:12,color:C.muted}}>{avail.length} colis · {points.length} point{points.length>1?'s':''} relais — le plus chargé en premier.</div></div>
              {avail.length>0 && <button type="button" onClick={()=>{ markAllCollected(avail); setTourneeOpen(false); }} style={{border:`1px solid ${INV_STATUS.online.color}`,background:`${INV_STATUS.online.color}14`,color:INV_STATUS.online.color,borderRadius:12,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>✓ Tout retiré</button>}
              <button type="button" onClick={()=>setTourneeOpen(false)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
              {points.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'24px'}}>Aucun colis à retirer. 👌</div>}
              {points.map((p,i)=>(
                <div key={p.nom} style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,overflow:'hidden'}}>
                  <div style={{display:'flex',gap:10,alignItems:'center',padding:'10px 12px',borderBottom:`1px solid ${C.border}`}}>
                    <div style={{width:26,height:26,borderRadius:12,background:C.accent,color:C.onAccent,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700}}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text,display:'flex',alignItems:'center',gap:6}}>{p.carrier&&<CarrierBadge carrier={p.carrier} size={18}/>}<span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nom}</span></div>
                      {p.adresse && <div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.adresse}</div>}
                    </div>
                    <span style={{flexShrink:0,fontSize:12,fontWeight:700,color:C.danger,background:`${C.danger}14`,borderRadius:12,padding:'3px 9px'}}>{p.colis.length}</span>
                    <a href={mapsUrl(p)} target="_blank" rel="noreferrer" title="Itinéraire" style={{flexShrink:0,textDecoration:'none',fontSize:12,fontWeight:600,color:C.accentTexte,border:`1px solid ${C.accent}`,borderRadius:12,padding:'5px 8px'}}>🧭</a>
                  </div>
                  <div style={{display:'flex',flexDirection:'column'}}>
                    {p.colis.map((t,j)=>{ const buy=buyForTrack(t); return (
                      <div key={j} style={{display:'flex',gap:9,alignItems:'center',padding:'7px 12px',borderTop:j>0?`1px solid ${C.border}`:'none'}}>
                        <div style={{width:32,height:32,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>{buy&&orderPhoto(buy)?<PhotoVinted src={orderPhoto(buy)} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:15}}>📦</span>}</div>
                        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(buy&&buy.title)||t.artTitle||`Colis${t.suivi?' n°'+t.suivi:''}`}</div>{codeRetrait(t.code)&&<div style={{fontSize:11,color:C.muted}}>code {codeRetrait(t.code)}</div>}</div>
                        <button className="vrm-icon-control" aria-label="J'ai retiré ce colis" type="button" onClick={()=>markCollected(t)} title="J'ai retiré ce colis" style={{flexShrink:0,border:`1px solid ${INV_STATUS.online.color}`,background:`${INV_STATUS.online.color}14`,color:INV_STATUS.online.color,borderRadius:12,padding:'5px 8px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>✓</button>
                      </div>
                    ); })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        );
      })()/*⟦←/⟧*/);
}

// La branche {showDisputes && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleShowDisputes({ v }) {
  const { disputes, setShowDisputes } = v;
  return (/*⟦← App.jsx #v8⟧*/<div onClick={()=>setShowDisputes(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1350,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setShowDisputes(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>⚖️ Litiges & remboursements</div><div className="vrm-aide" style={{fontSize:12,color:C.muted}}>L'argent perdu (ventes annulées/remboursées) et récupéré (achats remboursés).</div></div>
              <button type="button" onClick={()=>setShowDisputes(false)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{display:'flex',gap:10,padding:'12px 16px',flexShrink:0}}>
              <div style={{flex:1,border:`1px solid ${C.danger}44`,background:`${C.danger}0e`,borderRadius:12,padding:'10px 12px'}}>
                <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:500}}>Manque à gagner</div>
                <div style={{fontSize:22,fontWeight:700,color:C.danger}}>−{Math.round(disputes.totalLost)}&nbsp;€</div>
                <div style={{fontSize:11,color:C.muted}}>{disputes.salesLost.length} vente{disputes.salesLost.length>1?'s':''} perdue{disputes.salesLost.length>1?'s':''}</div>
              </div>
              <div style={{flex:1,border:`1px solid ${INV_STATUS.online.color}44`,background:`${INV_STATUS.online.color}0e`,borderRadius:12,padding:'10px 12px'}}>
                <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:500}}>Récupéré (achats)</div>
                <div style={{fontSize:22,fontWeight:700,color:INV_STATUS.online.color}}>+{Math.round(disputes.totalBack)}&nbsp;€</div>
                <div style={{fontSize:11,color:C.muted}}>{disputes.buysBack.length} achat{disputes.buysBack.length>1?'s':''} remboursé{disputes.buysBack.length>1?'s':''}</div>
              </div>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'0 16px 16px'}}>
              {disputes.salesLost.length>0 && <div style={{fontSize:12,fontWeight:700,color:C.danger,margin:'6px 0 6px'}}>💸 Ventes annulées / remboursées</div>}
              {disputes.salesLost.map((x,i)=>(
                <div key={'s'+i} style={{display:'flex',gap:8,alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{x.title}</div><div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{[x.date?new Date(x.date).toLocaleDateString('fr-FR'):'', x.status].filter(Boolean).join(' · ')}</div></div>
                  <div style={{flexShrink:0,fontSize:13,fontWeight:700,color:C.danger}}>−{Math.round(x.amount)}&nbsp;€</div>
                </div>
              ))}
              {disputes.buysBack.length>0 && <div style={{fontSize:12,fontWeight:700,color:INV_STATUS.online.color,margin:'14px 0 6px'}}>↩️ Achats remboursés</div>}
              {disputes.buysBack.map((x,i)=>(
                <div key={'b'+i} style={{display:'flex',gap:8,alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{x.title}</div><div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{[x.date?new Date(x.date).toLocaleDateString('fr-FR'):'', x.status].filter(Boolean).join(' · ')}</div></div>
                  <div style={{flexShrink:0,fontSize:13,fontWeight:700,color:INV_STATUS.online.color}}>+{Math.round(x.amount)}&nbsp;€</div>
                </div>
              ))}
              {disputes.salesLost.length===0 && disputes.buysBack.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'24px 0'}}>Aucun litige — nickel ! 👌</div>}
              <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:12,lineHeight:1.4}}>D'après le statut Vinted (remboursements, retours, annulations).</div>
            </div>
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {renumOpen && …} de Comptabilite, telle quelle, avec 1 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleRenumOpen({ v }) {
  const { buyByNum, garageNums, numeros, renumPlan, saleOv, setBuyByNum, setNumeros, setRenumOpen, setUsedNumeros, usedNumeros } = v;
  /*⟦← App.jsx #h9_1⟧*/const applyRenum = () => {
    const { moves } = renumPlan;
    if (!moves.length) { setRenumOpen(false); return; }
    const next = { ...numeros };
    const byNum = { ...buyByNum };
    for (const m of moves) {
      const e = next[m.id]; if (!e) continue;
      next[m.id] = { ...e, numero: String(m.to) };
      const bp = e.buyPrice;
      if (bp != null && String(bp).trim() !== '') byNum[String(m.to)] = String(bp);
      if (byNum[String(m.from)] != null && !moves.some(x => x.to === m.from)) delete byNum[String(m.from)];
    }
    setNumeros(next); save('vinted_annonce_numeros', next);
    setBuyByNum(byNum); save('vinted_buyprice_by_num', byNum);
    // Le pool est append-only (§5) : on PART de l'existant, on n'en retire rien.
    const used = new Set(usedNumeros.map(entreePool).filter(x => x != null));
    Object.values(next).forEach(e => { const n = entreePool(e && e.numero); if (n != null) used.add(n); });
    Object.values(saleOv).forEach(e => { const n = entreePool(e && e.numero); if (n != null) used.add(n); });
    garageNums.forEach(g => { const n = entreePool(g); if (n != null) used.add(n); });
    const ua = [...used].sort(triPool);
    setUsedNumeros(ua); save('vinted_used_numeros', ua);
    setRenumOpen(false);
    toast(`✓ ${moves.length} article${moves.length > 1 ? 's' : ''} renuméroté${moves.length > 1 ? 's' : ''}`);
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v9⟧*/(()=>{
        const { moves, nTotal, nLocked, maxBefore, maxAfter } = renumPlan;
        return (
        <div onClick={()=>setRenumOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1350,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setRenumOpen(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'86vh',borderRadius:'20px 20px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'16px 18px 12px',flexShrink:0}}>
              <div style={{width:36,height:4,borderRadius:12,background:C.border,margin:'0 auto 14px'}}/>
              <div style={{fontSize:17,fontWeight:600,color:C.text,letterSpacing:'-0.02em'}}>Renuméroter à la suite</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4,lineHeight:1.45}}>
                Tes numéros vont de 1 à <b style={{color:C.text}}>{maxBefore||'—'}</b> pour <b style={{color:C.text}}>{nTotal}</b> article{nTotal>1?'s':''} en ligne.
                {moves.length>0 ? <> Après, ils iront de 1 à <b style={{color:C.accentTexte}}>{maxAfter}</b>, sans trou.</> : <> Ils sont déjà à la suite.</>}
              </div>
            </div>
            {moves.length>0 && (
              <div style={{padding:'0 18px 12px',flexShrink:0}}>
                <div style={{display:'flex',gap:8}}>
                  <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'11px 13px'}}>
                    <div style={{fontSize:22,fontWeight:600,color:C.accentTexte,lineHeight:1,letterSpacing:'-0.02em'}}>{moves.length}</div>
                    <div style={{fontSize:11,color:C.muted,fontWeight:600,marginTop:3}}>article{moves.length>1?'s':''} à renuméroter</div>
                  </div>
                  <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'11px 13px'}}>
                    <div style={{fontSize:22,fontWeight:600,color:C.text,lineHeight:1,letterSpacing:'-0.02em'}}>{nLocked}</div>
                    <div style={{fontSize:11,color:C.muted,fontWeight:600,marginTop:3}}>gardent leur numéro</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:C.muted,marginTop:9,lineHeight:1.45}}>
                  ⚠️ Déjà <b style={{color:C.text}}>écrits sur tes boîtes</b> ? Il faudra les réécrire. <Pourquoi>Les articles rangés au garage et ceux d'une vente en cours ne bougent pas.</Pourquoi>
                </div>
              </div>
            )}
            <div style={{flex:1,overflowY:'auto',padding:'0 18px'}}>
              {moves.length===0 ? (
                <div style={{textAlign:'center',padding:'26px 10px',fontSize:13,color:C.muted}}>✅ Rien à faire, ta numérotation est déjà propre.</div>
              ) : moves.map(m=>(
                <div key={m.id} style={{display:'flex',alignItems:'center',gap:11,padding:'8px 0',borderTop:`1px solid ${C.border}`}}>
                  <div style={{width:38,height:38,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden'}}>
                    {m.photo && <PhotoVinted src={m.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                  </div>
                  <div style={{flex:1,minWidth:0,fontSize:12,color:C.text,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.title}</div>
                  <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:7,fontSize:13,fontWeight:600}}>
                    <span style={{color:C.muted,textDecoration:'line-through'}}>{m.from}</span>
                    <span style={{color:C.muted,fontSize:11}}>→</span>
                    <span style={{color:C.accentTexte}}>{m.to}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:'12px 18px calc(16px + env(safe-area-inset-bottom))',borderTop:`1px solid ${C.border}`,display:'flex',gap:9,flexShrink:0,background:C.bg}}>
              <button className="vrm-b vrm-b-discret" type="button" onClick={()=>setRenumOpen(false)} style={{flex:1,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:12,padding:'12px',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
              {moves.length>0 && <button type="button" onClick={applyRenum} style={{flex:2,border:'none',background:C.accent,color:C.onAccent||'#fff',borderRadius:12,padding:'12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Renuméroter {moves.length} article{moves.length>1?'s':''}</button>}
            </div>
          </div>
        </div>
        );
      })()/*⟦←/⟧*/);
}

// La branche {inventOpen && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleInventOpen({ v }) {
  const { conflitsNum, effEntry, listings, numeros, porteursNum, sales, setInventOpen } = v;
  return (/*⟦← App.jsx #v10⟧*/(()=>{
        const lignes = Object.entries(porteursNum)
          .map(([num, p]) => ({ num, n: parseInt(num, 10), p }))
          .sort((a, b) => (isNaN(a.n) ? 1e9 : a.n) - (isNaN(b.n) ? 1e9 : b.n));
        const conflits = new Set(conflitsNum.map(c => String(c.numero)));
        // La photo est ce qui permet de VÉRIFIER un carton : on la cherche là
        // où elle est vraiment — l'annonce en ligne, la vente, sinon la fiche
        // numérotée. Rapprochement par IDENTIFIANT uniquement (§5.34).
        const photoDe = (por) => {
          if (por.type === 'annonce') {
            const it = (listings.items || []).find(x => String(x.id) === String(por.id));
            if (it && it.photo) return it.photo;
            const e = numeros[por.id]; if (e && e.photo) return e.photo;
          }
          if (por.type === 'vente' || por.type === 'annulee') {
            const o = (sales.items || []).find(x => String(x.transaction_id || '') === String(por.id));
            if (o) { const ph = orderPhoto(o); if (ph) return ph; const e = effEntry(o); if (e && e.photo) return e.photo; }
          }
          return null;
        };
        const ou = (t) => t === 'annonce' ? 'en ligne' : t === 'vente' ? 'à envoyer'
          : t === 'annulee' ? 'vente annulée — l\'article est resté' : 'au garage';
        return (
          <div onClick={()=>setInventOpen(false)} data-noswipe style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:120,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
            <FermeAuRetour fermer={()=>setInventOpen(false)}/>
            <div onClick={e=>e.stopPropagation()} style={{background:C.bg,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:620,maxHeight:'88vh',overflowY:'auto',padding:'16px 14px calc(20px + env(safe-area-inset-bottom))'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                <span style={{flex:1,fontSize:17,fontWeight:700,color:C.text}}>Inventaire physique</span>
                <button className="vrm-icon-control" type="button" onClick={()=>setInventOpen(false)} aria-label="Fermer" style={{border:'none',background:'transparent',color:C.muted,cursor:'pointer',display:'flex'}}><Icon name="close" size={18}/></button>
              </div>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:12}}>
                <b style={{color:C.text}}>{lignes.length} article{lignes.length>1?'s':''}</b> chez toi : compte tes boîtes contre cette liste. <Pourquoi>Celles en ligne, celles vendues dont le colis n'est pas parti, et celles rangées au garage. Si un numéro manque, l'article n'est pas là où l'app le croit.</Pourquoi>
              </div>
              {conflits.size>0 && (
                <div style={{fontSize:12,fontWeight:600,color:C.doublon,background:`${C.doublon}12`,border:`1px solid ${C.doublon}`,borderRadius:12,padding:'9px 11px',marginBottom:12,lineHeight:1.45}}>
                  <span style={{display:'flex',alignItems:'center',gap:6}}><Icon name="alert" size={14}/>{conflits.size} numéro{conflits.size>1?'s':''} porté{conflits.size>1?'s':''} par deux articles</span>
                  <span style={{display:'block',color:C.text,fontWeight:500,marginTop:3}}>À corriger AVANT de déménager : rien ne dit lequel expédier (en rouge ci-dessous).</span>
                </div>
              )}
              <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,overflow:'hidden'}}>
                {lignes.map((l,i)=>{
                  const dbl = conflits.has(l.num);
                  const ph = l.p.map(photoDe).find(Boolean);
                  return (
                    <div key={l.num} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 11px',borderTop:i?`1px solid ${C.border}66`:'none',background:dbl?`${C.doublon}0e`:'transparent'}}>
                      <span style={{flexShrink:0,fontSize:15,fontWeight:700,color:'#fff',background:dbl?C.doublon:C.accent,borderRadius:12,padding:'3px 8px',minWidth:44,textAlign:'center'}}>N°{l.num}</span>
                      <span style={{width:38,height:38,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden'}}>
                        {ph && <PhotoVinted src={ph} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                      </span>
                      <span style={{flex:1,minWidth:0}}>
                        <span style={{display:'block',fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.p.map(x=>x.titre).filter(Boolean)[0] || '—'}</span>
                        <span style={{display:'block',fontSize:11,color:dbl?C.doublon:C.muted,marginTop:1}}>{l.p.map(x=>ou(x.type)).join(' + ')}{dbl?' — deux articles !':''}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={()=>{
                const txt = lignes.map(l=>`N°${l.num}\t${(l.p.map(x=>x.titre).filter(Boolean)[0]||'').replace(/\t/g,' ')}\t${l.p.map(x=>ou(x.type)).join(' + ')}`).join('\n');
                try { navigator.clipboard.writeText(`Inventaire physique — ${lignes.length} articles\n\n${txt}`); toast('Liste copiée'); } catch(_) { toast('Copie impossible'); }
              }} style={{width:'100%',marginTop:12,border:`1px solid ${C.border}`,background:C.card,color:C.text,borderRadius:12,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>📋 Copier la liste (pour l'imprimer)</button>
            </div>
          </div>
        );
      })()/*⟦←/⟧*/);
}

// La branche {auditOpen && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleAuditOpen({ v }) {
  const { annBase, effEntry, garageNums, numeros, sales, setAuditOpen } = v;
  return (/*⟦← App.jsx #v11⟧*/(()=>{
        const onlineNums = new Set(); annBase.forEach(it=>{ const nn=numeros[it.id]?.numero; if(nn) onlineNums.add(String(nn)); });
        const soldNums = new Set(); (sales.items||[]).forEach(o=>{ if(classifyOrderStatus(o.status)==='completed'){ const e=effEntry(o); if(e&&e.numero) soldNums.add(String(e.numero)); } });
        const byNum = new Map(); Object.values(numeros).forEach(e=>{ if(e&&e.numero!=null) byNum.set(String(e.numero), e); });
        // Tous les numéros présents au garage (grille 2D + pièces 3D).
        const garageAll = new Set(garageNums);
        try { const plan=normalizePlan(load('vrm_room_plan',null)); for(const rm of (plan.rooms||[])) for(const it of (rm.items||[])){ if(it.num!=null){const t=String(it.num).trim().toLowerCase(); if(t)garageAll.add(t);} if(Array.isArray(it.nums)) it.nums.forEach(n=>{const t=String(n).trim().toLowerCase(); if(t)garageAll.add(t);}); for(const c in (it.slots||{})) (it.slots[c]||[]).forEach(n=>{const t=String(n).trim().toLowerCase(); if(t)garageAll.add(t);}); } } catch(_){}
        const atG = (num) => garageAll.has(String(num).trim().toLowerCase());
        const ghosts=[], soldStored=[], notStored=[];
        for (const [num,e] of byNum) { const on=onlineNums.has(num), so=soldNums.has(num), g=atG(num);
          if(!on && !so && !g) ghosts.push({num,e});
          else if(so && g) soldStored.push({num,e});
          else if(on && !g) notStored.push({num,e});
        }
        const unknownAtGarage = [...garageAll].filter(t=>t && ![...byNum.keys()].some(k=>k.toLowerCase()===t)).sort((a,b)=>(+a||0)-(+b||0));
        ghosts.sort((a,b)=>(+a.num||0)-(+b.num||0)); soldStored.sort((a,b)=>(+a.num||0)-(+b.num||0)); notStored.sort((a,b)=>(+a.num||0)-(+b.num||0));
        const Section = ({icon,color,title,desc,items,render}) => items.length===0 ? null : (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color}}>{icon} {title} ({items.length})</div>
            <div style={{fontSize:11,color:C.muted,margin:'2px 0 6px'}}>{desc}</div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>{items.slice(0,60).map(render)}</div>
          </div>
        );
        const Row = ({num,e}) => (
          <div key={num} style={{display:'flex',gap:8,alignItems:'center',border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'5px 8px'}}>
            <div style={{width:30,height:30,borderRadius:6,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>{e&&e.photo?<PhotoVinted src={e.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:13}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>N°{num}{e&&e.size?` · T${e.size}`:''}</div><div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(e&&e.title)||''}</div></div>
          </div>
        );
        const nothing = ghosts.length===0 && soldStored.length===0 && notStored.length===0 && unknownAtGarage.length===0;
        return (
        <div onClick={()=>setAuditOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1350,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setAuditOpen(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',paddingBottom:'env(safe-area-inset-bottom)',}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>🔎 Audit d'inventaire</div><div className="vrm-aide" style={{fontSize:12,color:C.muted}}>Réconcilie tes numéros avec le garage, les annonces et les ventes.</div></div>
              <button type="button" onClick={()=>setAuditOpen(false)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,minHeight:0,overflow:'auto',WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',padding:'14px 16px'}}>
              {nothing && <div style={{fontSize:13,color:INV_STATUS.online.color,fontWeight:600,textAlign:'center',padding:'24px 0'}}>✓ Tout est cohérent, rien à signaler !</div>}
              <Section icon="👻" color={C.danger} title="Articles perdus" desc="Numérotés mais ni en ligne, ni vendus, ni au garage → probablement égarés." items={ghosts} render={Row}/>
              <Section icon="📦" color={C.warn} title="Vendues mais encore au garage" desc="À sortir du garage : elles sont vendues mais toujours rangées." items={soldStored} render={Row}/>
              <Section icon="🏠" color={C.blue||C.accent} title="En ligne, pas encore rangées" desc="En vente mais introuvables au garage → range-les pour les retrouver vite." items={notStored} render={Row}/>
              {unknownAtGarage.length>0 && (
                <div style={{marginBottom:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.muted}}>❓ Au garage, numéro inconnu ({unknownAtGarage.length})</div>
                  <div className="vrm-aide" style={{fontSize:11,color:C.muted,margin:'2px 0 6px'}}>Au garage, sans article à ce N° (ancien ou faute de frappe).</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{unknownAtGarage.slice(0,80).map(t=><span key={t} style={{fontSize:12,fontWeight:600,color:C.text,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'3px 9px'}}>N°{t}</span>)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()/*⟦←/⟧*/);
}

// La branche {lotOpen && …} de Comptabilite, telle quelle, avec 2 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleLotOpen({ v }) {
  const { annBase, eur, listings, lotMode, lotSearch, lotSel, lotTotal, numeros, prix, setLotMode, setLotOpen, setLotSearch, setLotSel, setLotTotal, updatePair } = v;
  /*⟦← App.jsx #h12_1⟧*/const lotShares = () => {
    const items = [...lotSel].map(id => (listings.items||[]).find(x=>x.id===id)).filter(Boolean);
    const total = eur(lotTotal); const n = items.length;
    if (!n || total<=0) return {};
    const out = {}; let acc = 0;
    const sumPrice = items.reduce((s,x)=>s+(Number(x.price)||0),0);
    const usePrice = lotMode==='price' && sumPrice>0;
    items.forEach((x,i)=>{
      let sh = i===n-1 ? +(total-acc).toFixed(2)
             : usePrice ? +((total*(Number(x.price)||0)/sumPrice)).toFixed(2)
             : Math.floor((total/n)*100)/100;
      acc = +(acc+sh).toFixed(2); out[x.id] = sh;
    });
    return out;
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h12_2⟧*/const applyLot = () => {
    const sh = lotShares();
    Object.entries(sh).forEach(([id,val])=>{ const x=(listings.items||[]).find(y=>y.id===id); if(x) updatePair({id:x.id,title:x.title,photo:x.photo,price:x.price,_acc:x._acc},{buyPrice:String(val).replace('.',','),buyFromId:null,buyFrom:null}); });
    setLotOpen(false);
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v12⟧*/(()=>{
        const q = lotSearch.trim().toLowerCase();
        const list = annBase.filter(it=>{ if(!q) return true; const num=numeros[it.id]?.numero||''; return String(num).includes(q) || (it.title||'').toLowerCase().includes(q) || (it.brand||'').toLowerCase().includes(q); });
        const shares = lotShares();
        const nSel = lotSel.size; const total = eur(lotTotal);
        return (
        <div onClick={()=>setLotOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1350,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setLotOpen(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',paddingBottom:'env(safe-area-inset-bottom)',}}>
            <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>🧮 Répartir un lot</div><div className="vrm-aide" style={{fontSize:12,color:C.muted}}>Prix d'un achat groupé ventilé sur les articles choisis → marge juste sur chacun.</div></div>
                <button type="button" onClick={()=>setLotOpen(false)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
              </div>
              <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap',alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:4,border:`1px solid ${C.border}`,borderRadius:12,padding:'7px 10px',background:C.card}}>
                  <span style={{fontSize:11,color:C.muted,fontWeight:500}}>Prix du lot</span>
                  <input autoFocus value={lotTotal} onChange={e=>setLotTotal(e.target.value)} placeholder="0" inputMode="decimal" style={{width:70,border:'none',background:'transparent',color:C.text,fontSize:15,fontWeight:600,outline:'none'}}/>
                  <span style={{fontSize:11,color:C.muted}}>€</span>
                </div>
                {[['equal','À parts égales'],['price','Au prorata du prix']].map(([id,lb])=>(
                  <button key={id} type="button" onClick={()=>setLotMode(id)} style={{border:`1px solid ${lotMode===id?C.accent:C.border}`,background:lotMode===id?C.accent:'transparent',color:lotMode===id?'#fff':C.text,borderRadius:12,padding:'6px 11px',fontSize:12,fontWeight:600,cursor:'pointer'}}>{lb}</button>
                ))}
              </div>
              <div style={{fontSize:12,color:nSel&&total>0?INV_STATUS.online.color:C.muted,fontWeight:600,marginTop:8}}>{nSel} article{nSel>1?'s':''} sélectionné{nSel>1?'s':''}{nSel&&total>0?` · ${(total/nSel).toFixed(2).replace('.',',')}\u00a0€ en moyenne`:''}</div>
              <input value={lotSearch} onChange={e=>setLotSearch(e.target.value)} placeholder="Chercher une annonce (N°, titre, marque)…" style={{marginTop:8,width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 12px',fontSize:13,background:C.card,color:C.text,outline:'none',fontFamily:'inherit'}}/>
            </div>
            <div style={{flex:1,overflow:'auto',padding:10,display:'flex',flexDirection:'column',gap:6}}>
              {list.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'20px'}}>Aucune annonce.</div>}
              {list.map(it=>{ const sel=lotSel.has(it.id); const num=numeros[it.id]?.numero; const sh=shares[it.id];
                return (
                <button key={it.id} type="button" onClick={()=>setLotSel(prev=>{ const n=new Set(prev); if(n.has(it.id))n.delete(it.id); else n.add(it.id); return n; })}
                  style={{display:'flex',gap:10,alignItems:'center',border:`1.5px solid ${sel?C.accent:C.border}`,background:sel?`${C.accent}0e`:C.card,borderRadius:12,padding:'7px 9px',cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
                  <div style={{width:20,height:20,borderRadius:6,flexShrink:0,border:`1.5px solid ${sel?C.accent:C.border}`,background:sel?C.accent:'transparent',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700}}>{sel?'✓':''}</div>
                  <div style={{width:38,height:38,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>{it.photo?<PhotoVinted src={it.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:15}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}</div>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{num?`N°${num} · `:''}{it.title}</div><div style={{fontSize:11,color:C.muted}}>{[it.size,prix(it.price,it.currency)||null].filter(Boolean).join(' · ')}</div></div>
                  {sel && sh!=null && <div style={{flexShrink:0,fontSize:13,fontWeight:700,color:INV_STATUS.online.color}}>{sh.toFixed(2).replace('.',',')}&nbsp;€</div>}
                </button>
                );
              })}
            </div>
            <div style={{flexShrink:0,padding:'12px 16px',borderTop:`1px solid ${C.border}`,display:'flex',gap:10,alignItems:'center'}}>
              <div style={{flex:1,fontSize:12,color:C.muted}}>{nSel>0&&total>0?`Total réparti : ${total.toFixed(2).replace('.',',')}\u00a0€`:'Renseigne le prix du lot et coche les articles.'}</div>
              <button type="button" disabled={!(nSel>0&&total>0)} onClick={applyLot} style={{border:'none',borderRadius:12,padding:'11px 18px',background:(nSel>0&&total>0)?C.accent:C.border,color:'#fff',fontSize:15,fontWeight:600,cursor:(nSel>0&&total>0)?'pointer':'default',fontFamily:'inherit'}}>Appliquer</button>
            </div>
          </div>
        </div>
        );
      })()/*⟦←/⟧*/);
}

// La branche {repubMainOuvert && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleRepubMainOuvert({ v }) {
  const { accNameOf, accounts, buyByNum, listings, loadListings, numeros, poserRepubMain, recreesNum, repubMain, repubMainFile, repubMainOuvert, setRepubMainFile, setRepubMainOuvert } = v;
  return (/*⟦← App.jsx #v13⟧*/(()=>{
        const p = repubMainOuvert; const s = repubMain[String(p.ancienId||p.id)] || null;
        // (6 nov., vague 2 · point 1) Une vente ANNULÉE avant l'envoi (`annulee`) : l'ancienne
        // annonce est fermée chez Vinted (rien à supprimer) ; `numAffiche` = le N° de la vente,
        // `numero` = celui qui se reprend (vide pour un N° d'archive : un neuf viendra).
        const paire = p.ancienId ? { id:String(p.ancienId), uid:String(p.uid||''), numero:String(p.num||''), titre:p.titre||'', compte:(()=>{ const a=(accounts||[]).find(x=>String(x.vinted_user_id)===String(p.uid)); return a?accNameOf(a):`compte ${p.uid}`; })(), domain:p.domain||'www.vinted.fr', prix:p.prix??null, photo:p.photo||'',
          ...(p.annulee ? { annulee:true, tx:String(p.tx||''), numAffiche:String(p.numAffiche||''), archive:!!p.archive } : {}) } : p;
        const enLigneMap = (listings.items||[]).map(it=>{ const pr=(it.price&&typeof it.price==='object')?it.price.amount:it.price; const n=Number(String(pr==null?'':pr).replace(',','.')); const e=numeros[it.id]||{};
          return { id:String(it.id), uid:String((it._acc&&it._acc.vinted_user_id)||''), titre:it.title||'', prix:isFinite(n)&&n>0?n:null, photo:it.photo||'', createdTs:it.createdTs||null, numero:e.numero?String(e.numero):'' }; });
        const cands = candidatsNouvelle({ ancienId:paire.id, uid:paire.uid, enLigne:enLigneMap, numeros, suivis:repubMain, recrees:recreesNum||{}, debut: s && s.at ? Date.parse(s.at) : 0 });
        // Une remise en vente se suit même sans N° à reprendre : désigner la nouvelle la clôt.
        const etatS = paire.annulee ? ({ 'a-remettre':'attente', 'en-cours': s && s.nouvelId ? 'lie' : 'attente', fait:'fait' })[etatRemise(s, { num:paire.numero, reprenable:numeroReprenable, numeros, cle:cleNum })] : etatSuiviMain(s, { numeros, cle: cleNum });
        const marque = paire.annulee ? { annulee:true, tx:paire.tx, ...(paire.archive && paire.numAffiche ? { numArchive:String(paire.numAffiche) } : {}) } : {};
        const debut = ()=>{ if (!s && (paire.numero || paire.annulee)) poserRepubMain(paire.id, { uid:paire.uid, num:paire.numero||'', titre:paire.titre||'', domain:paire.domain, at:new Date().toISOString(), ...marque }); };
        // (6 nov.) Le prix d'achat (le plancher de la baisse, la même règle que Republier : jamais dessous).
        const flM = prixAchatDe(numeros[paire.id]||{}, buyByNum);
        const paireM = { ...paire, floor: flM!=null && !isNaN(flM) ? Number(flM) : null };
        // Plusieurs paires : une à la fois, la file tenue ici (la feuille repart à zéro pour chacune).
        const fileM = repubMainFile && repubMainFile.liste && repubMainFile.liste.length > 1 ? repubMainFile : null;
        const rangM = fileM ? { i:fileM.i, n:fileM.liste.length } : null;
        const fermerM = ()=>{ setRepubMainOuvert(null); setRepubMainFile(null); };
        // La paire suivante garde le prix et le titre choisis dans CETTE ouverture (pas au-delà).
        const suivanteM = fileM && fileM.i < fileM.liste.length-1 ? (encours)=>{ const j=fileM.i+1; setRepubMainFile({ ...fileM, i:j, encours: encours||null }); setRepubMainOuvert(fileM.liste[j]); } : null;
        return <RepublierALaMain key={paire.uid+':'+paire.id} paire={paireM} rang={rangM} onSuivante={suivanteM} encours={fileM ? fileM.encours || null : null} suivi={s} candidats={cands} etatSuivi={etatS} onDebut={debut} onClose={fermerM} onRelire={()=>loadListings(true)}
          onDelier={()=>poserRepubMain(paire.id, { nouvelId:null, nouveauTitre:null, lieAt:null })}
          onLier={async (c)=>{ const ok = await askConfirm({ title:'C’est bien la même paire ?', desc:`« ${c.titre||'Sans titre'} » est la nouvelle annonce de « ${paire.titre||'l’ancienne'} ».${paire.numero?`\nLe N°${paire.numero} passera dessus dès que l’ancienne ne sera plus du tout sur Vinted.`:''}`, ok:'Oui, c’est elle' });
            if (!ok) return; if (!s) debut(); poserRepubMain(paire.id, { uid:paire.uid, num:paire.numero||'', titre:paire.titre||'', nouvelId:String(c.id), nouveauTitre:c.titre||'', lieAt:new Date().toISOString(), ...marque, ...(s?{}:{ at:new Date().toISOString() }) }); }}/>;
      })()/*⟦←/⟧*/);
}

// La branche {qrView && …} de Comptabilite, telle quelle, avec 1 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleQrView({ v }) {
  const { choisirCaptureQr, qrAjout, qrView, setQrAjout, setQrPoses, setQrView } = v;
  /*⟦← App.jsx #h14_1⟧*/const retirerQrPose = (t) => {
    const k = suiviDeLigne(t); if (!k) return;
    setQrPoses(prev => { if (!prev || !prev[k]) return prev; const u = { ...prev }; delete u[k]; save(CLE_QR_POSES, u); return u; });
    setQrView(v => (v && v._t && suiviDeLigne(v._t) === k) ? { ...v, img: null, real: false, source: v._t._o ? 'conversation' : 'email', mode: retraitMode({ ...v._t, qrB64: null, qrType: null, qrSource: null }).mode } : v);
    setQrAjout({ suivi: k, etat: 'retire', msg: 'QR retiré.' });
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v14⟧*/(()=>{
        const cn = qrView.carrierName || carrierName(qrView.carrier);
        const ck = carrierKey(qrView.carrier) || '';
        const avecAbsent = !qrView.img && qrView.mode !== 'home' && !!qrView.qrOu;
        const phraseMode = qrView.mode === 'home' ? `${cn} livre à ton adresse : rien à retirer au comptoir.`
          : qrView.code2 ? (qrView.img ? 'Scanne le QR au casier, ou saisis l’identifiant puis le code d’ouverture.' : 'Saisis l’identifiant puis le code d’ouverture sur l’écran du casier.')
          : (qrView.consigne && qrView.code) ? 'Saisis ce code sur l’écran du casier.'
          : qrView.real ? 'Présente ce QR au comptoir : le scan suffit.'
          : qrView.code ? 'Donne ce code au comptoir avec ta pièce d’identité.'
          : 'Ni QR ni code reçus : donne le numéro de colis et ta pièce d’identité.';
        const lim = (() => { if (!qrView.limite) return null; const j = Math.ceil((new Date(qrView.limite + 'T23:59:59') - Date.now()) / 86400000); if (!Number.isFinite(j)) return null;
          const d = new Date(qrView.limite + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          return { j, t: j < 0 ? 'Délai de retrait dépassé' : j === 0 ? 'Dernier jour pour le retirer' : j === 1 ? 'À retirer demain au plus tard' : `À retirer avant le ${d} · encore ${j} j` }; })();
        const compteTxt = qrView.compte && (qrView.compte.libelle || qrView.compte.horsComptes)
          ? (qrView.compte.source === 'mondialrelay' ? `Compte Mondial Relay · ${qrView.compte.libelle}` : [qrView.compte.libelle ? `Reçu sur ${qrView.compte.libelle}` : 'Reçu par e-mail', qrView.compte.horsComptes ? 'dans aucun de tes comptes Mondial Relay relus' : ''].filter(Boolean).join(' · '))
          : '';
        const accordTxt = qrView.accord ? (qrView.accord === 'confirme' ? 'Code confirmé par ton compte Mondial Relay' : (qrView.code && qrView.code===qrView.codeMr) ? 'Code de ton compte Mondial Relay (plus récent que l’e-mail)' : 'Code de l’e-mail (reçu après la lecture de ton compte Mondial Relay)') : '';
        return (
        <SheetShell lumineuse onClose={() => setQrView(null)} titre={qrView.title} sousTitre={qrView.lieu || null} maxWidth={440} z={Z_CONFIRMATION - 3}
          className="vrm-eg" aria-label="Code et QR de retrait" data-qr-plein="" data-qr-plein-code={qrView.code || ''} data-qr-plein-img={qrView.img ? '1' : '0'} data-qr-plein-source={qrView.source || ''}>
          <GardeEcranAllume/>
          <div className="vrm-eg-corps">
            {qrView.photo ? <PhotoVinted src={qrView.photo} alt="" loading="lazy" className="vrm-eg-photo"/> : null}
            {/* Vrai QR uniquement. Si l'image hébergée ne charge pas, on bascule sur le code — jamais un QR fabriqué. */}
            {qrView.img ? <img className="vrm-eg-qr" src={qrView.img} alt="QR de retrait"
              onError={qrView.hosted ? (() => setQrView(v => v ? { ...v, img: null, real: false, hosted: false } : v)) : undefined}/> : null}
            {/* Consigne Pickup : DEUX codes — Identifiant + Code d'ouverture. */}
            {qrView.code2 ? <div className="vrm-eg-code is-second"><span className="vrm-eg-code-l">Identifiant</span><span className="vrm-eg-code-v vrm-sensible" data-stream-type="code">{qrView.code2}</span></div> : null}
            {qrView.code ? <div className={'vrm-eg-code' + (qrView.img ? ' avec-qr' : '')}><span className="vrm-eg-code-l">{qrView.code2 ? 'Code d’ouverture' : 'Code de retrait'}</span><span className="vrm-eg-code-v vrm-sensible" data-stream-type="code">{qrView.code}</span></div> : null}
            {!qrView.img && !qrView.code && qrView.suivi ? <div className="vrm-eg-code is-suivi"><span className="vrm-eg-code-l">Numéro de colis</span><span className="vrm-eg-code-v">{qrView.suivi}</span></div> : null}
            {/* Pas de QR : dit, avec où le trouver (src/retraitQr.js). Mondial Relay : « Ajouter le QR » — SA capture de l'app. */}
            {avecAbsent ? <div className="vrm-eg-absent" data-qr-plein-absent={ck}><strong>{titreQrAbsent(ck)}</strong><span>{qrView.qrOu}</span></div> : <p className="vrm-eg-mode">{phraseMode}</p>}
            {!qrView.img && qrView.mode !== 'home' && qrView._t && qrParCapture(ck) && suiviDeLigne(qrView._t)
              ? <Bouton variante="secondaire" icone="image" plein data-qr-plein-ajouter="" onClick={() => choisirCaptureQr(qrView._t)} aria-label="Ajouter le QR (capture de l’app Mondial Relay)">Ajouter le QR (capture de l’app)</Bouton> : null}
            {qrView._t && qrAjout && qrAjout.suivi && qrAjout.suivi === suiviDeLigne(qrView._t) ? <p role="status" className={'vrm-eg-note' + (['pose', 'lecture', 'retire'].includes(qrAjout.etat) ? '' : ' is-ambre')} data-qr-plein-ajout={qrAjout.etat}>{qrAjout.msg}</p> : null}
            {qrView.img && qrView.source === 'capture' && qrView._t ? (
              <div className="vrm-eg-capture" data-qr-plein-capture="">
                <span>QR de ta capture de l’app Mondial Relay</span>
                <Bouton variante="secondaire" taille="petit" data-qr-plein-retirer="" onClick={() => retirerQrPose(qrView._t)}>Retirer ce QR</Bouton>
              </div>) : null}
            {/* Les faits du colis, une ligne chacun : l'échéance (ambre seulement si le geste est dû : aujourd'hui,
                demain ou dépassée, §7), le transporteur et son n°, le compte, l'accord des codes. */}
            <ul className="vrm-eg-faits">
              {lim ? <li className={lim.j <= 1 ? 'is-ambre' : ''} data-qr-plein-limite={lim.j}>{lim.t}</li> : null}
              {qrView.suivi && (qrView.img || qrView.code) ? <li>{qrView.carrier ? `${carrierName(qrView.carrier)} · ` : ''}n° {qrView.suivi}</li> : null}
              {compteTxt ? <li data-qr-plein-compte={qrView.compte.source}>{compteTxt}</li> : null}
              {accordTxt ? <li data-qr-plein-accord={qrView.accord}>{accordTxt}</li> : null}
            </ul>
            {/* La luminosité : aucune API web ne la règle — on le dit ; l'écran reste allumé (Wake Lock). */}
            {qrView.img ? <p className="vrm-eg-note" data-qr-plein-luminosite="">Luminosité au maximum : le lecteur lit mal un écran sombre.</p> : null}
            {/* Le suivi du transporteur (le site de Mondial Relay ne montre PAS le QR : le lien suit le colis, rien de plus). */}
            {qrView.suivi ? <Bouton variante="secondaire" icone="truck" plein href={trackUrl(qrView.carrier, qrView.suivi)} target="_blank" rel="noreferrer" data-qr-plein-suivre="">Suivre le colis</Bouton> : null}
          </div>
        </SheetShell>
        );
      })()/*⟦←/⟧*/);
}

// La branche {relayPicker && …} de Comptabilite, telle quelle, avec 2 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleRelayPicker({ v }) {
  const { persistPoints, relayPicker, savedPoints, setRelayPicker } = v;
  /*⟦← App.jsx #h15_1⟧*/const searchPlaces = async (query) => {
    if (!query || !query.trim()) return;
    setRelayPicker(p => p ? { ...p, loading: true, error: null, results: [] } : p);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=fr&addressdetails=1&q=${encodeURIComponent(query.trim())}`);
      const js = await r.json();
      const results = (js || []).map((x, i) => {
        const a = x.address || {};
        const nom = a.shop || a.amenity || (x.display_name || '').split(',')[0].trim();
        const ville = a.village || a.town || a.city || a.municipality || '';
        const rue = [a.house_number, a.road].filter(Boolean).join(' ');
        return { id: String(x.place_id || i), nom, adresse: [rue, a.postcode, ville].filter(Boolean).join(', '), lat: +x.lat, lon: +x.lon, full: x.display_name };
      });
      setRelayPicker(p => p ? { ...p, loading: false, results, error: results.length ? null : 'Aucun lieu trouvé. Ajoute le nom de la ville (ex : « Super U Lyon »).' } : p);
    } catch (_) { setRelayPicker(p => p ? { ...p, loading: false, error: 'Recherche indisponible, réessaie.' } : p); }
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h15_2⟧*/const addFoundPlace = (f) => {
    const carrier = relayPicker && relayPicker.carrier;
    const nom = carrier ? `${f.nom} (${carrier})` : f.nom;
    const byName = new Map(savedPoints.map(s => [s.nom.toLowerCase(), s]));
    byName.set(nom.toLowerCase(), { nom, full: f.adresse ? `${f.nom}, ${f.adresse}` : f.nom, lat: f.lat, lon: f.lon, carrier: carrier || undefined });
    persistPoints([...byName.values()]);
    setRelayPicker(null);
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v15⟧*/<div onClick={()=>setRelayPicker(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setRelayPicker(null)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,height:'88vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>📍 Ajouter un point relais</div>
                <div style={{fontSize:11,color:C.muted}}>Tape le nom du lieu + la ville, puis choisis-le sur la carte</div>
              </div>
              <button type="button" onClick={()=>setRelayPicker(null)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer'}}>×</button>
            </div>
            <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{display:'flex',gap:6}}>
                <input autoFocus value={relayPicker.query} onChange={e=>setRelayPicker(p=>({...p,query:e.target.value}))}
                  onKeyDown={e=>{ if(e.key==='Enter') searchPlaces(relayPicker.query); }}
                  placeholder="ex : Super U Lyon, Tabac de la Place…"
                  style={{flex:1,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',fontSize:13,fontFamily:'inherit',background:C.card,color:C.text,outline:'none'}}/>
                <button type="button" onClick={()=>searchPlaces(relayPicker.query)} style={{border:'none',borderRadius:12,background:C.accent,color:C.onAccent,fontSize:13,fontWeight:600,padding:'0 16px',cursor:'pointer',fontFamily:'inherit'}}>Chercher</button>
              </div>
              <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:11,color:C.muted}}>Transporteur :</span>
                {Object.entries(CARRIERS).map(([k,c])=>{ const on=relayPicker.carrier===c.name; return (
                  <button type="button" key={k} onClick={()=>setRelayPicker(p=>({...p,carrier:on?'':c.name}))} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px 3px 4px',borderRadius:12,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:on?`${c.bg}18`:'transparent',color:on?c.bg:C.muted,border:`1.5px solid ${on?c.bg:C.border}`}}>
                    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,padding:'0 4px',borderRadius:6,background:c.bg,color:c.fg,fontSize:11,fontWeight:700}}>{c.short}</span>
                    {c.name}
                  </button>
                ); })}
              </div>
            </div>
            {relayPicker.loading && <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:C.muted,fontSize:13}}>⏳ Recherche…</div>}
            {!relayPicker.loading && relayPicker.error && <div style={{flex:1,display:'flex',alignItems:'flex-start',justifyContent:'center',color:C.muted,fontSize:13,textAlign:'center',padding:'28px 20px',lineHeight:1.5}}>{relayPicker.error}</div>}
            {!relayPicker.loading && !relayPicker.error && relayPicker.results.length>0 && (<>
              <OsmMap points={relayPicker.results.map(f=>({key:f.id,lat:f.lat,lon:f.lon}))} selected={null} onSelect={id=>{ const f=relayPicker.results.find(x=>x.id===id); if(f) addFoundPlace(f); }}/>
              <div style={{flex:1,overflow:'auto',padding:'8px 12px'}}>
                {relayPicker.results.map(f=>(
                  <button type="button" key={f.id} onClick={()=>addFoundPlace(f)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px',border:`1px solid ${C.border}`,background:C.card,borderRadius:12,marginBottom:6,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                    <span style={{fontSize:20,flexShrink:0}}>📍</span>
                    <span style={{flex:1,minWidth:0}}>
                      <span style={{display:'block',fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.nom}</span>
                      <span style={{display:'block',fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.adresse||f.full}</span>
                    </span>
                    <span style={{fontSize:12,fontWeight:600,color:C.accentTexte,flexShrink:0}}>Ajouter</span>
                  </button>
                ))}
              </div>
            </>)}
            {!relayPicker.loading && !relayPicker.error && relayPicker.results.length===0 && (
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:C.muted,fontSize:13,textAlign:'center',padding:'0 24px',lineHeight:1.6}}>
                Tes points relais lus dans tes e-mails y sont déjà.<br/>Ajoute un autre : tape son nom + la ville.
              </div>
            )}
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {bordResult && …} de Comptabilite, telle quelle, avec 1 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleBordResult({ v }) {
  const { bordResult, setBordResult } = v;
  /*⟦← App.jsx #h16_1⟧*/const adjustBordPlacement = async () => {
    const r = bordResult; if (!r?.pdfBuf) return;
    try { const r2 = await annotateAndDownloadBordereau(r.numero, r.title, r.pdfBuf, null, { apercu: 'force' }); setBordResult({ ...r2, numero: r.numero, title: r.title, pdfBuf: r.pdfBuf, key: r.key, w: r.w, h: r.h }); }
    catch (err) { libererOngletPdf(); if (!estTamponAnnule(err)) toast('Erreur : ' + String(err)); }
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v16⟧*/<div onClick={()=>{ URL.revokeObjectURL(bordResult.url); setBordResult(null); }} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1250,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <FermeAuRetour fermer={()=>{ URL.revokeObjectURL(bordResult.url); setBordResult(null); }}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,borderRadius:12,maxWidth:360,width:'100%',padding:20,textAlign:'center'}}>
            <div style={{fontSize:34,marginBottom:6}}>✅</div>
            <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:4}}>{bordResult.batch?`${bordResult.count} bordereaux prêts`:bordResult.withInvoice?'Bordereau + facture prêts':'Bordereau prêt'}</div>
            <div style={{fontSize:13,color:C.muted,lineHeight:1.45,marginBottom:16}}>{bordResult.batch?<>Tous les bordereaux{bordResult.nInv>0?<> et <b>{bordResult.nInv} facture{bordResult.nInv>1?'s':''}</b> (comptes pro)</>:null} sont <b>à la suite dans un seul PDF</b> (le N° au même endroit sur chacun). {bordResult.printed?<>Ils sont <b>ouverts dans un nouvel onglet</b> : clique sur l'imprimante en haut à droite. Onglet pas ouvert ? Utilise le bouton ci-dessous.</>:<>Ouvre-le puis <b>Imprimer</b> — tu peux tout imprimer d'un coup.</>}</>:bordResult.printed?<>Le bordereau{bordResult.withInvoice?<> (avec <b>la facture</b>)</>:null} est <b>ouvert dans un nouvel onglet</b> : clique sur l'imprimante en haut à droite. Onglet pas ouvert ? Utilise le bouton ci-dessous.</>:<>{bordResult.withInvoice?<>Le PDF contient le <b>bordereau + la facture</b>. </>:null}Ouvre-le puis <b>Partager → Imprimer</b> (ou enregistre-le). Sur iPhone c'est le bouton de partage en bas.</>}</div>
            <a href={bordResult.url} target="_blank" rel="noreferrer"
              style={{display:'block',background:C.accent,color:C.onAccent,borderRadius:12,padding:'13px 16px',fontSize:15,fontWeight:600,textDecoration:'none',marginBottom:8}}>📄 {bordResult.batch?'Ouvrir les bordereaux':bordResult.withInvoice?'Ouvrir bordereau + facture':'Ouvrir le bordereau'}</a>
            {/* (3 nov.) « Déplacer le tampon » : l'aperçu s'ouvre, la place choisie s'imprime (et se mémorise pour la forme). */}
            {bordResult.pdfBuf && !bordResult.batch && <button type="button" data-imprime="1" data-tampon-deplacer="1" onClick={adjustBordPlacement} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:12,background:'transparent',color:C.text,cursor:'pointer',fontSize:13,fontWeight:500,padding:'11px',marginBottom:8}}>Déplacer le tampon</button>}
            {bordResult.batch && !bordResult.thermique && <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginBottom:8,lineHeight:1.4}}>Ton N° est tamponné sur chaque PDF, sinon sur une fiche juste après.</div>}
            {/* ── CE QUE L'IMPRESSION THERMIQUE A VRAIMENT FAIT ────────────────
                LE CHIFFRE, JAMAIS LA PROMESSE. « Ton étiquette est prête » sur
                un bordereau qu'on n'a pas su découper, c'est le défaut le plus
                coûteux du projet. On écrit combien ont été réduits à
                l'étiquette, combien sont partis entiers, et POURQUOI. */}
            <TamponPose r={bordResult}/>
            {bordResult.thermique && (()=>{ const ent=bordResult.entiers||[]; const iso=bordResult.isoles||0;
              return (
                <div style={{fontSize:12,color:C.muted,marginBottom:8,lineHeight:1.45,textAlign:'left',border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 11px'}}>
                  <div style={{color:C.text,fontWeight:600,marginBottom:ent.length?4:0}}>
                    {iso>0 ? `${iso} étiquette${iso>1?'s':''} découpée${iso>1?'s':''} au format 10×15 cm (sans la fiche destinataire)` : 'Aucune étiquette n’a pu être isolée'}
                    {(bordResult.etiquettes||0)>iso ? ` · ${bordResult.etiquettes} pages : un envoi international porte aussi l'étiquette du transporteur partenaire, colle-les toutes` : ''}
                    {ent.length>0 ? ` · ${ent.length} page${ent.length>1?'s':''} entière${ent.length>1?'s':''}` : ''}
                  </div>
                  {ent.length>0 && <div>Je n'ai pas su repérer l'étiquette sur {ent.length===1?'ce bordereau':'ces bordereaux'} : {[...new Set(ent.map(e=>e.raison).filter(Boolean))].join(' · ')||'mise en page inconnue'}. {ent.length===1?'Il part':'Ils partent'} en A4 : découpe à la main.</div>}
                </div>
              ); })()}
            <button type="button" data-bord-fermer="1" onClick={()=>{ URL.revokeObjectURL(bordResult.url); setBordResult(null); }} style={{width:'100%',border:'none',background:'transparent',color:C.muted,cursor:'pointer',fontSize:13,fontWeight:500,padding:'8px'}}>Fermer</button>
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {pickerFor && …} de Comptabilite, telle quelle, avec 4 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuillePickerFor({ v }) {
  const { accNameOf, achatRelie, cibleRelier, ecritureRelierAchat, eur, imgMortes, liensAchats, noterImgMorte, numeros, pickerFor, prixPayeAchat, purchasesPick, receptionAchatMs, receptionsRelierEtat, saleOv, setBesoinInfosRelier, setNumeros, setPickerFor, setSaleOverride, updatePair } = v;
  /*⟦← App.jsx #h17_1⟧*/const iciPicker = (cible) => (cible ? (cible._saleTx ? { ou: 'vente', cle: String(cible._saleTx) } : { ou: 'fiche', cle: String(cible.id) }) : null);/*⟦←/⟧*/
  /*⟦← App.jsx #h17_2⟧*/const relierAchat = async (a, opts = {}) => {
    const cible = pickerFor; if (!cible || !a) return;
    const autres = ecrituresDeplacer(a, { numeros, saleOv, ici: iciPicker(cible) });
    if (opts.deplacer || autres.length) {
      if (autres.length) {
        const ok = await askConfirm({ title: texteDejaRelie(autres), desc: 'Il sera délié de là-bas et relié ici.', ok: 'Déplacer ici', cancel: 'Annuler' });
        if (!ok) return;
      }
    }
    const w = await ecritureRelierAchat(a); if (!w) return;
    for (const x of autres) { if (x.ou === 'vente') setSaleOverride(x.cle, x.patch); else setNumeros((prev) => { const u = { ...prev, [x.cle]: { ...(prev[x.cle] || {}), ...x.patch } }; save('vinted_annonce_numeros', u); return u; }); }
    if (cible._saleTx) setSaleOverride(cible._saleTx, w); else updatePair(cible, w);
    setPickerFor(null);
    toast(`Achat relié${w.buyPrice ? ` · ${String(w.buyPrice).replace('.', ',')}\u00a0€` : ''}`);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h17_3⟧*/const entreePicker = (cible) => (cible ? (cible._saleTx ? saleOv[String(cible._saleTx)] : numeros[cible.id]) : null);/*⟦←/⟧*/
  /*⟦← App.jsx #h17_4⟧*/const delierAchatPicker = () => {
    const cible = pickerFor; const patch = patchDelier(entreePicker(cible)); if (!cible || !patch) return;
    if (cible._saleTx) setSaleOverride(cible._saleTx, patch); else updatePair(cible, patch);
    setPickerFor(null);
    toast('Achat délié');
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v17⟧*/createPortal(
        <div data-relier-feuille data-relier-autre={pickerFor._autre ? String(pickerFor._autre) : undefined} onClick={()=>setPickerFor(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setPickerFor(null)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'85vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* ⚠️ ON MONTRE LA PAIRE QU'ON RELIE. La modale couvrait l'écran et
                demandait « quel achat correspond à CETTE paire ? » sans jamais
                dire laquelle : il fallait se souvenir de la carte sur laquelle
                on venait de taper. Avec 35 annonces dont beaucoup d'Adidas
                Spezial, c'est exactement là qu'on relie le mauvais achat. */}
            <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:11}}>
              <div style={{width:46,height:46,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {pickerFor.photo && !imgMortes.has(pickerFor.photo)
                  ? <PhotoVinted src={pickerFor.photo} alt="" onError={()=>noterImgMorte(pickerFor.photo)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <span style={{fontSize:20}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  {numeros[pickerFor.id]?.numero && <span style={{fontSize:12,fontWeight:700,color:C.onAccent||'#fff',background:C.accent,borderRadius:12,padding:'2px 7px',flexShrink:0}}>N°{numeros[pickerFor.id].numero}</span>}
                  <span style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{pickerFor.title}</span>
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                  {[pickerFor.brand, pickerFor.size && `taille ${pickerFor.size}`, pickerFor.price!=null && `en vente ${eur(pickerFor.price).toFixed(2).replace('.',',')}\u00a0€`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button type="button" onClick={()=>setPickerFor(null)} aria-label="Fermer" style={{flexShrink:0,border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer'}}>×</button>
            </div>
            <div data-relier-achat-corps style={{flex:1,overflow:'auto',padding:'4px 14px 14px'}}>
              <RelierAchatCorps C={C} cible={cibleRelier} achats={purchasesPick.loading ? null : purchasesPick.items} liens={liensAchats}
                curTx={(entreePicker(pickerFor) || {}).buyFromId || ''} compteDe={(a)=>accNameOf(a._acc)||''} prixDe={prixPayeAchat} onRelier={relierAchat}
                autre={!!pickerFor._autre} actuel={achatRelie(entreePicker(pickerFor))} onDelier={delierAchatPicker}
                dejaRelie={(a)=>texteDejaRelie(detenteursAchat(a && a.transaction_id, { numeros, saleOv }))}
                receptionDe={receptionAchatMs} receptionEtat={receptionsRelierEtat} onFiltres={()=>setBesoinInfosRelier(true)}/>
            </div>
          </div>
        </div>, document.body)/*⟦←/⟧*/);
}

// La branche {showBrandCurves && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleShowBrandCurves({ v }) {
  const { brandCurves, curveBrand, setCurveBrand, setShowBrandCurves } = v;
  return (/*⟦← App.jsx #v18⟧*/(()=>{
        const effBrand = (curveBrand && (curveBrand==='__ALL__' || brandCurves.brandList.includes(curveBrand))) ? curveBrand : (brandCurves.brandList[0] || '__ALL__');
        const s = brandCurves.series(effBrand);
        const W=340, H=180, padL=34, padR=14, padT=16, padB=28;
        const xs = i => padL + (i/11)*(W-padL-padR);
        const avgs = s.pts.map(p=>p.avg); const mn=avgs.length?Math.min(...avgs):0, mx=avgs.length?Math.max(...avgs):1;
        const lo=Math.floor(mn/5)*5, hi=Math.max(lo+5, Math.ceil(mx/5)*5);
        const ys = v => padT + (1-(v-lo)/((hi-lo)||1))*(H-padT-padB);
        const monLabel = ym => { const [Y,M]=ym.split('-').map(Number); return dateLocale(new Date(Y,M-1,1),'fr-FR',{month:'short'}).replace('.',''); };
        return (
        <div onClick={()=>setShowBrandCurves(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1350,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setShowBrandCurves(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'85vh',borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.text}}>📈 Prix de vente par marque</div><div className="vrm-aide" style={{fontSize:12,color:C.muted}}>Prix de vente moyen mois par mois (12 derniers mois).</div></div>
              <button type="button" onClick={()=>setShowBrandCurves(false)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{padding:'12px 16px',flexShrink:0}}>
              <select value={effBrand} onChange={e=>setCurveBrand(e.target.value)} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:12,padding:'8px 10px',fontSize:13,background:C.card,color:C.text,fontWeight:500,cursor:'pointer'}}>
                <option value="__ALL__">Toutes marques confondues</option>
                {brandCurves.brandList.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'0 12px 16px'}}>
              {s.pts.length<1 ? <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'30px 0'}}>Pas assez de ventes pour cette marque.</div> : (
                <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}}>
                  {[lo,(lo+hi)/2,hi].map((v,i)=>(<g key={i}><line x1={padL} y1={ys(v)} x2={W-padR} y2={ys(v)} stroke={C.border} strokeWidth="1"/><text x={padL-5} y={ys(v)+3} textAnchor="end" fontSize="9" fill={C.muted}>{Math.round(v)}€</text></g>))}
                  {brandCurves.months.map((ym,i)=> i%2===0 ? <text key={ym} x={xs(i)} y={H-10} textAnchor="middle" fontSize="8.5" fill={C.muted}>{monLabel(ym)}</text> : null)}
                  <polyline fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={s.pts.map(p=>`${xs(p.i)},${ys(p.avg)}`).join(' ')}/>
                  {s.pts.map(p=>(<g key={p.i}><circle cx={xs(p.i)} cy={ys(p.avg)} r="3.5" fill={C.accent}/><text x={xs(p.i)} y={ys(p.avg)-7} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={C.text}>{Math.round(p.avg)}</text></g>))}
                </svg>
              )}
              <div style={{fontSize:11,color:C.muted,marginTop:8,lineHeight:1.5,padding:'0 4px'}}>Un point = prix moyen du mois, <b>{effBrand==='__ALL__'?'toutes marques':effBrand}</b>. Ça monte : tu vends plus cher.</div>
            </div>
          </div>
        </div>
        );
      })()/*⟦←/⟧*/);
}

// La branche {dortAgir && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleDortAgir({ v }) {
  const { dortAgir, numeros, onNav, setCompteSel, setDortAgir, setRepubAction, setRepubReprise, updatePair } = v;
  return (/*⟦← App.jsx #v19⟧*/(()=>{
        const a = dortAgir, it = a.it, e = numeros[it.id] || {};
        const versRepub = (act) => { setDortAgir(null); setRepubReprise([String(it.id)]); setRepubAction(act); };
        // (9 nov., « vendre plus ») Les gestes viennent d'UNE règle (`gestesDormeuse`,
        // src/vendrePlus.js) : chacun ouvre l'écran EXISTANT, sur SON clic, rien ne part
        // tout seul et aucun prix n'est proposé. Republier : la paire pré-choisie dans
        // l'atelier, c'est LUI qui lance.
        const urlFiche = it.url || (/^\d+$/.test(String(it.id)) ? `https://${(it._acc && it._acc.domain) || 'www.vinted.fr'}/items/${it.id}` : '');
        const uidIt = String((it._acc && it._acc.vinted_user_id) || '');
        const aller = {
          republier: ()=>versRepub('recreer'),
          prix: ()=>versRepub('modifier'),
          vinted: ()=>{ try { window.open(urlFiche, '_blank', 'noopener'); } catch (_) {} setDortAgir(null); },
          // ⚠️ On change d'écran AVANT de fermer la feuille : fermée d'abord, elle
          // retirait son entrée d'historique (history.back) avant que le nouvel
          // écran soit rendu, et ce retour ramenait Vinted (mesuré au banc, 1 fois sur 2).
          // Le nouvel écran démonte la feuille ; la fermeture différée ne sert qu'en secours.
          lbc: ()=>{
              if (!mpChoisi(e,'lbc')) updatePair(it, { mp: { ...(e.mp||{}), lbc: true } });
              DEMANDE_LBC_FICHE.id = String(it.id); DEMANDE_LBC_FICHE.at = Date.now(); onNav && onNav('leboncoin'); setTimeout(()=>setDortAgir(null), 400); },
          ebay: ()=>{ DEMANDE_EBAY_PAIRE.id = String(it.id); DEMANDE_EBAY_PAIRE.at = Date.now(); onNav && onNav('ebay_annonces'); setTimeout(()=>setDortAgir(null), 400); },
          vestiaire: ()=>{ DEMANDE_VC_PAIRE.id = String(it.id); DEMANDE_VC_PAIRE.at = Date.now(); onNav && onNav('vestiaire_annonces'); setTimeout(()=>setDortAgir(null), 400); },
          // La file « Envoyer une offre aux favoris » (Messages → Favoris reçus) du compte
          // de l'annonce : c'est LUI qui choisit et envoie.
          favoris: ()=>{ if (uidIt && typeof setCompteSel === 'function') setCompteSel(uidIt); demanderVue('favoris'); onNav && onNav('cat_msg'); setTimeout(()=>setDortAgir(null), 400); },
        };
        // (9 nov.) Seulement les sites qu'il AFFICHE (« Mes plateformes ») : un site masqué ramenait sur Vinted, le clic ne menait nulle part.
        const sitesAffiches = PROFIL_VENDEUR.uid === (AUTH.user?.id || '') && Array.isArray(PROFIL_VENDEUR.plateformes) ? PROFIL_VENDEUR.plateformes : null;
        const choix = gestesDormeuse({ numero: a.numero, favoris: a.favoris, url: urlFiche, cap: (c)=>extSait(c), version: (c)=>EXT_CAPACITES[c] || '', sites: sitesAffiches })
          .map((g)=>({ ...g, go: aller[g.k] }));
        return (
          <SheetShell onClose={()=>setDortAgir(null)} maxWidth={420}>
            <div className="vrm-qd-menu" data-qd-menu={a.id}>
              <div className="vrm-qd-menu-tete">
                <h2 className="vrm-qd-menu-titre">{a.numero ? `N°${a.numero} · ` : ''}{a.titre}</h2>
                <button type="button" className="vrm-qd-fermer" aria-label="Fermer" onClick={()=>setDortAgir(null)}>✕</button>
              </div>
              {choix.map(c=>{ const raison = c.bloque || ''; return (
                <button key={c.k} type="button" className="vrm-qd-choix" data-qd-choix-geste={c.k} aria-disabled={raison?'true':undefined} title={raison||c.sous||undefined}
                  onClick={()=>{ if (raison) { toast(raison); return; } c.go(); }}><span className="vrm-qd-choix-t">{c.t}</span>{c.sous ? <span className="vrm-qd-sous vrm-qd-choix-sous" data-qd-choix-sous="">{c.sous}</span> : null}</button>
              ); })}
            </div>
          </SheetShell>
        );
      })()/*⟦←/⟧*/);
}

// La branche {fileOpen && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleFileOpen({ v }) {
  const { buyByNum, drafts, listings, numeros, setFileOpen } = v;
  return (/*⟦← App.jsx #v20⟧*/(()=>{
        // Candidats = brouillons PRÊTS (titre + prix > 0 + au moins une photo) dont
        // l'annonce est encore en ligne. Un seul propriétaire de la règle « prêt » :
        // `pretDraft`, réutilisé par `verifier` au moment du passage (éligibilité
        // revérifiée juste avant — § T4). Rien n'est publié ici.
        const onlineById = {}; for (const it of (listings.items||[])) onlineById[String(it.id)] = it;
        const titreDe = (d) => String((d&&d.title)||'').trim();
        const prixDe = (d) => { const p = d&&d.price; const n = (p==null||p==='')?NaN:Number(p); return isFinite(n)?n:NaN; };
        const pretDraft = (key) => { const d=drafts[key]; if(!d) return {ok:false,raison:'pas de brouillon'}; if(!titreDe(d)) return {ok:false,raison:'titre manquant'}; if(!(prixDe(d)>0)) return {ok:false,raison:'prix manquant'}; if(!(Array.isArray(d.photos)&&d.photos.length)) return {ok:false,raison:'aucune photo'}; if(!onlineById[String(d.id)]) return {ok:false,raison:'plus en ligne'}; return {ok:true}; };
        const cands = Object.keys(drafts).filter(key=>pretDraft(key).ok).map(key=>{ const d=drafts[key]; return { key, id:d.id, titre:titreDe(d), prix:prixDe(d) }; });
        // Mode RÉEL (tranche 5) : baisser le prix de l'annonce SUR VINTED, en place.
        // On envoie la commande à l'extension (origine de l'app, garde stricte,
        // coffre vérifié, modèle appris — tout revérifié côté extension). Le prix
        // d'achat de la paire sert de plancher (§19). L'app n'écrit JAMAIS sur
        // Vinted elle-même : c'est l'extension, sur ce clic confirmé.
        const publierReel = async (id, pct) => {
          const it=(listings.items||[]).find(x=>String(x.id)===String(id)); if(!it) return { ok:false, raison:'annonce introuvable' };
          const uid=it._acc&&it._acc.vinted_user_id; if(!uid) return { ok:false, raison:'compte introuvable' };
          const e=numeros[id]||{}; const fl=prixAchatDe(e,buyByNum);
          let r=null; try { r=await vmrCmd({ cmd:'republierVinted', uid:String(uid), id:String(id), baissePct:Number(pct)||0, plancher:(fl!=null&&!isNaN(fl))?Number(fl):null, confirme:true }, 30000); } catch(_) { r=null; }
          if (r && r.accepte && r.etape==='fait') return { ok:true };
          return { ok:false, raison:(r&&(r.raison||r.error))||"l'extension n'a pas répondu" };
        };
        return <AtelierFile candidats={cands} verifier={pretDraft} publier={publierReel} majExt={extSait("republier")!=="ok"} onClose={()=>setFileOpen(false)} />;
      })()/*⟦←/⟧*/);
}

// La branche {passportFor && …} de Comptabilite, telle quelle, avec 2 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuillePassportFor({ v }) {
  const { bordForItem, buys, eur, inGarage, listedAgeDays, numeros, passportFor, prix, prixHistorique, sales, setPassportFor, txnItem } = v;
  /*⟦← App.jsx #h21_1⟧*/const garageSpotOf = (num) => {
    const t = String(num||'').trim().toLowerCase(); if (!t) return null;
    try {
      const plan = normalizePlan(load('vrm_room_plan', null));
      for (const rm of (plan.rooms||[])) for (const it of (rm.items||[])) {
        const label = (FURN_TYPES[it.type]||{}).label || 'rangement';
        if (it.num!=null && String(it.num).trim().toLowerCase()===t) return { room: rm.name, kind: label };
        if (Array.isArray(it.nums) && it.nums.some(n=>String(n).trim().toLowerCase()===t)) return { room: rm.name, kind: label };
        for (const cell in (it.slots||{})) if ((it.slots[cell]||[]).some(n=>String(n).trim().toLowerCase()===t)) return { room: rm.name, kind: label };
      }
    } catch(_) {}
    return null;
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h21_2⟧*/const buildPassport = (it, e, num) => {
    const steps = [];
    const eur2 = v => (v!=null && String(v).trim()!=='') ? `${eur(v).toFixed(2).replace('.',',')}\u00a0€` : null;
    // 1) Achat
    const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? eur2(e.buyPrice) : null;
    let buyDate = null;
    if (e && e.buyFromId) { const o = (buys.items||[]).find(b=>String(b.transaction_id)===String(e.buyFromId)); if (o && o.date) buyDate = new Date(o.date); }
    if (buy || buyDate) steps.push({ icon:'🛒', label:'Achetée', detail:[buy?`payée ${buy}`:null, buyDate?`le ${buyDate.toLocaleDateString('fr-FR')}`:null].filter(Boolean).join(' '), done:true });
    // 2) Numérotation
    if (num) steps.push({ icon:'🔢', label:`Numérotée N°${num}`, detail: e && e.numberedAt ? `le ${new Date(e.numberedAt).toLocaleDateString('fr-FR')}` : '', done:true });
    // 3) Garage
    const spot = garageSpotOf(num); const atG = inGarage(num) || !!spot;
    steps.push({ icon:'🏠', label: atG?'Rangée au stock':'Pas encore rangée', detail: spot?`${spot.room} · ${spot.kind}`:(atG?'':'à ranger'), done:atG });
    // 4) En ligne
    if (it) { const age = listedAgeDays(it); steps.push({ icon:'🟢', label:'En ligne', detail:[prix(it.price,it.currency)||null, age!=null?`depuis ${age} j`:null, it.views!=null?`👁 ${it.views}`:null, it.favourites!=null?`❤️ ${it.favourites}`:null].filter(Boolean).join(' · '), done:true }); }
    // 5) Vente
    const sold = (sales.items||[]).find(o=>it?.id&&String(txnItem[String(o.transaction_id)]||'')===String(it.id)&&String(o._acc?.vinted_user_id||'')===String(it._acc?.vinted_user_id||''));
    if (sold) { const st=classifyOrderStatus(sold.status); const sp=sold.price?.amount!=null?Number(sold.price.amount):null; steps.push({ icon: st==='cancelled'?'✖️':'💸', label: st==='cancelled'?'Vente annulée':(st==='completed'?'Vendue':'Vente en cours'), detail:[sp!=null?`${sp.toFixed(0)}\u00a0€`:null, sold.date?`le ${new Date(sold.date).toLocaleDateString('fr-FR')}`:null].filter(Boolean).join(' '), done:st==='completed' }); }
    // 6) Bordereau / expédition
    const bord = bordForItem(it ? it.id : null, null);
    if (bord) steps.push({ icon:'📮', label:'Bordereau reçu — à expédier', detail: bord.dateLimite?`avant le ${bord.dateLimite}`:'', done:true });
    return steps;
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v21⟧*/(()=>{
        const { it, e, num } = passportFor;
        const steps = buildPassport(it, e, num);
        const photo = (it && it.photo) || (e && e.photo) || null;
        const title = (it && (it.title||it.brand)) || (e && e.title) || 'Article';
        return (
        <div onClick={()=>setPassportFor(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1350,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setPassportFor(null)}/>
          <div onClick={ev=>ev.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'85vh',borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',paddingBottom:'env(safe-area-inset-bottom)',}}>
            <div style={{display:'flex',gap:12,alignItems:'center',padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{width:52,height:52,borderRadius:12,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {photo?<PhotoVinted src={photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:22}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>📖 Passeport {num?`· N°${num}`:''}</div>
                <div style={{fontSize:12,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{title}{e&&e.size?` · T${e.size}`:(it&&it.size?` · T${it.size}`:'')}</div>
              </div>
              <button type="button" onClick={()=>setPassportFor(null)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'16px 18px'}}>
              <HistoriqueArticle key={String(AUTH.user?.id)+':'+it?.id} item={it?.id} uid={it?._acc?.vinted_user_id} owner={AUTH.user?.id||''} ownerActuel={()=>AUTH.user?.id||''} lire={q=>lireTout(q,{strict:true})} numeros={numeros} prix={prixHistorique}/>
              {steps.length===0 ? <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'20px 0'}}>Pas encore d'historique pour cet article.</div> : (
                <div style={{position:'relative',paddingLeft:8}}>
                  {steps.map((s,i)=>(
                    <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start',position:'relative',paddingBottom:i<steps.length-1?16:0}}>
                      {i<steps.length-1 && <div style={{position:'absolute',left:15,top:30,bottom:0,width:2,background:C.border}}/>}
                      <div style={{width:32,height:32,borderRadius:12,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,background:s.done?`${INV_STATUS.online.color}1a`:C.card,border:`1.5px solid ${s.done?INV_STATUS.online.color:C.border}`,zIndex:1}}>{s.icon}</div>
                      <div style={{flex:1,minWidth:0,paddingTop:4}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{s.label}</div>
                        {s.detail && <div style={{fontSize:12,color:C.muted,marginTop:1}}>{s.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧
import {ComparaisonComptesVinted,HistoriqueArticle} from '../OutilsArticlesVinted.jsx';
// ⟦← App.jsx #4⟧
import { candidatsVenteSansAnnonce } from "../candidatsVente.js";
// ⟦← App.jsx #5⟧
import { detenteursAchat, texteDejaRelie, patchDelier, ecrituresDeplacer } from "../relierAutreAchat.js";
// ⟦← App.jsx #2⟧
const RelierAchatCorps = aLaDemande(() => import('../ecrans/Achats.jsx').then((m) => ({ default: m.RelierAchatCorps })));
// ⟦→ coeur/FeuillesCompta.jsx #1⟧
const AtelierFile = aLaDemande(() => import('../ecrans/Republier.jsx').then((m) => ({ default: m.AtelierFile })));
// ⟦← App.jsx #3⟧
const RepublierALaMain = aLaDemande(() => import('../ecrans/Republier.jsx').then((m) => ({ default: m.RepublierALaMain })));
// ⟦← App.jsx #6⟧

// Le fond vectoriel de la mini-carte (MapLibre chargé à la demande).
function FondMiniCarte({ lat, lon, zoom, sombre }) {
  const boite = React.useRef(null);
  const [etat, setEtat] = React.useState('charge');
  React.useEffect(() => {
    let vivant = true, carte = null;
    import('../fondCarte.js').then((f) => {
      if (!f.webglDispo()) throw new Error('webgl');
      return f.chargerMaplibre().then((ml) => {
        if (!vivant || !boite.current) return;
        // Fond uni d'abord, puis le style OpenFreeMap (poserFond). L'attribution
        // exigée vient de la TileJSON, repliée en « i » (mini-carte).
        carte = new ml.Map({ container: boite.current, style: { version: 8, sources: {}, layers: [] }, center: [lon, lat], zoom, interactive: false, attributionControl: { compact: true } });
        carte.once('load', () => {
          f.poserFond(carte, { sombre, annule: () => !vivant }).then(() => { if (vivant) setEtat('pret'); }).catch(() => { if (vivant) setEtat('ko'); });
        });
      });
    }).catch(() => { if (vivant) setEtat('ko'); });
    return () => { vivant = false; if (carte) carte.remove(); };
  }, [lat, lon, zoom, sombre]);
  return <div ref={boite} data-mini-fond={etat} aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />;
}

function OsmMap({ points, height = 230, selected, onSelect }) {
  const pts = (points || []).filter(p => p && p.lat && p.lon);
  if (!pts.length) return null;
  const proj = (lat, lon, zz) => { const n = 2 ** zz; const x = (lon + 180) / 360 * n; const latr = lat * Math.PI / 180; const y = (1 - Math.log(Math.tan(latr) + 1 / Math.cos(latr)) / Math.PI) / 2 * n; return { x, y }; };
  // Zoom : le plus serré qui contient toutes les épingles… puis on DÉZOOME d'un
  // cran pour laisser de la marge et voir la ville autour (comme demandé).
  let z = 16;
  while (z > 11) {
    const ts = pts.map(p => proj(p.lat, p.lon, z));
    const spanX = Math.max(...ts.map(t => t.x)) - Math.min(...ts.map(t => t.x));
    const spanY = Math.max(...ts.map(t => t.y)) - Math.min(...ts.map(t => t.y));
    if (spanX < 1.5 && spanY < (height / 256) * 0.72) break;
    z--;
  }
  if (pts.length > 1 && z > 12) z -= 1; // marge : on voit tout d'un coup
  const clat = (Math.min(...pts.map(p => p.lat)) + Math.max(...pts.map(p => p.lat))) / 2;
  const clon = (Math.min(...pts.map(p => p.lon)) + Math.max(...pts.map(p => p.lon))) / 2;
  const c = proj(clat, clon, z);
  // Fond : OpenFreeMap (sans clé, src/fondCarte.js), MapLibre,
  // immobile, centré sur le même point et à la même échelle que les épingles
  // (une tuile MapLibre fait 512 px : zoom MapLibre = z − 1). CARTO retiré (clé
  // exigée). Injoignable ⇒ un fond uni et les épingles restent, jamais rien.
  // (29 oct.) La carte garde ses couleurs claires en mode sombre (décision de Julien, comme la communauté).
  const sombreCarte = false;
  return (
    <div data-mini-carte style={{ position: 'relative', width: '100%', height, overflow: 'hidden', background: sombreCarte ? '#1D1D1F' : '#F2F2F7' }}>
      <FondMiniCarte lat={clat} lon={clon} zoom={z - 1} sombre={sombreCarte} />
      {(() => {
        // Anti-chevauchement : on écarte les épingles trop proches en spirale.
        const placed = [];
        const R = 30; // distance mini entre 2 épingles (px)
        const prio = [...pts].sort((a, b) => (b.count || 0) - (a.count || 0)); // colis d'abord, jamais bougés
        prio.forEach(p => {
          const t = proj(p.lat, p.lon, z);
          let ox = (t.x - c.x) * 256, oy = (t.y - c.y) * 256;
          let tries = 0;
          while (placed.some(q => Math.hypot(q.ox - ox, q.oy - oy) < R) && tries < 40) {
            const ang = tries * 2.399, rad = R * (1 + tries * 0.14);
            ox = (t.x - c.x) * 256 + Math.cos(ang) * rad;
            oy = (t.y - c.y) * 256 + Math.sin(ang) * rad;
            tries++;
          }
          placed.push({ p, ox, oy });
        });
        return placed;
      })().map(({ p, ox, oy }) => {
        const isSel = selected === p.key;
        const car = CARRIERS[carrierKey(p.carrier)];
        const col = car ? car.bg : (p.picked ? '#2e9e5b' : p.count > 0 ? '#e5484d' : '#8E8E93');
        const inner = car ? car.short : (p.count > 0 ? String(p.count) : p.picked ? '✓' : '');
        const innerFg = car ? car.fg : '#fff';
        const dim = !car && !p.picked && !(p.count > 0);
        return (
          <div key={p.key} onClick={() => onSelect && onSelect(p.key)}
            style={{ position: 'absolute', left: `calc(50% + ${ox}px)`, top: `calc(50% + ${oy}px)`, transform: `translate(-50%, -100%) scale(${isSel ? 1.18 : 1})`, cursor: 'pointer', transition: 'transform .15s', zIndex: isSel ? 4 : car || p.count > 0 ? 3 : 1, opacity: dim ? 0.8 : 1, filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.28))' }}>
            {/* Épingle « teardrop » colorée à la marque */}
            <svg width="34" height="44" viewBox="0 0 34 44" style={{ display: 'block' }}>
              <path d="M17 0C7.6 0 0 7.5 0 16.8 0 29 17 44 17 44s17-15 17-27.2C34 7.5 26.4 0 17 0z" fill={col} />
              <circle cx="17" cy="16.5" r="12" fill="#fff" />
            </svg>
            <span style={{ position: 'absolute', left: '50%', top: 16.5, transform: 'translate(-50%,-50%)', color: col, fontSize: inner.length > 2 ? 11 : 12, fontWeight: 800, letterSpacing: 0.2 }}>{inner}</span>
            {/* Pastille « nombre de colis » en coin si c'est une marque */}
            {car && p.count > 0 && <span style={{ position: 'absolute', top: -5, right: -8, minWidth: 18, height: 18, borderRadius: 999, background: '#e5484d', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', border: '1.5px solid #fff' }}>{p.count}</span>}
            {/* Étiquette NOM du point (rend chaque relais distinct d'un coup d'œil) */}
            {(() => { const lbl = p.label || p.key; return (pts.length <= 14 || isSel || p.count > 0) && lbl && (
              <span style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translate(-50%, 1px)', whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11, fontWeight: 800, color: p.count > 0 ? '#b3261e' : '#2C2C2E', background: 'rgba(255,255,255,0.92)', borderRadius: 6, padding: '1px 5px', boxShadow: '0 1px 2px rgba(0,0,0,0.18)', border: isSel ? `1.5px solid ${col}` : '1px solid rgba(0,0,0,0.06)' }}>{String(lbl).length > 20 ? String(lbl).slice(0, 19) + '…' : lbl}</span>
            ); })()}
          </div>
        );
      })}
      <span data-mini-carte-attribution style={{ position: 'absolute', right: 5, bottom: 3, fontSize: 8, color: '#6E6E73', background: 'rgba(255,255,255,0.8)', padding: '1px 5px', borderRadius: 4 }}>OpenFreeMap · © OpenMapTiles · © OpenStreetMap</span>
    </div>
  );
}