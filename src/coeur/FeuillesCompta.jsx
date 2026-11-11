// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MINERAL } from '../themeMineral.js';
import { photoArticle } from '../photosArticles.js';
import { AUTH, Bouton, C, FermeAuRetour, INV_STATUS, Icon, NAV, PhotoVinted, Pourquoi, SERIE_DECLARATION, StatBox, TEXTE_SANS_REPONSE, _acctCache, _persistAcctCache, _rowCache, aLaDemande, avecCouleurBrouillon, extSait, familleArticle, generateAchatJustificatif, ilYaBr, lectureIncomplete, libelleRegime, lireMontantSaisi, lirePdfLigne, load, moisDeclare, payeDe, prenomLisible, prixAchatDe, save, toast, tsCommande, vintedDeChrome, vmrCmdSuivi } from '../App.jsx';

// La branche {showReport && …} de Comptabilite, telle quelle, avec 5 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleRapport({ v }) {
  const { accNameOf, ancienneRegle, buys, declForm, declUrssaf, declVoulue, declarables, derniersMoisDeclarables, ebayCmd, fmtE, lbcLu, moisAncienneRegle, moisChoisiMain, moisOuvert, nomsVentesKO, releveMois, releveTotaux, report, reportAnnee, reportMonth, sales, setDeclForm, setDeclUrssaf, setMoisOuvert, setReportAnnee, setReportMonth, setShowReport, ventesComptees, versements } = v;
  /*⟦← App.jsx #h1_1⟧*/const declarerMois = (regle, montantTxt, payeTxt) => {
    // ⚠️ LA GARDE EST DANS LE GESTE, pas seulement sur le bouton (revue du
    //    6 octobre) : une lecture peut tomber PENDANT que le formulaire est
    //    ouvert. Recalculée ici, sur l'état du moment — jamais une liste
    //    incomplète notée comme sa déclaration (tout ce qui manque passerait
    //    ensuite « à régulariser » : payé deux fois).
    const comptesEchec = nomsVentesKO;                // identité, pas libellé (voir le rapport)
    const manque = lectureIncomplete({ registre: declUrssaf, ventes: ventesComptees, ventesErreur: !!sales.error, comptesEchec, versements, lbc: lbcLu, ebay: ebayCmd });
    if (manque || !declarables) { setDeclForm(f => f ? { ...f, refus: manque || { enCours: [], rates: ['les dates de versement Vinted'] } } : f); return; }
    const ids = regle === 'vente' && ancienneRegle ? ancienneRegle.ids : report.saleLines.map(l => l.id).filter(Boolean);
    const ca = regle === 'vente' && ancienneRegle ? ancienneRegle.ca : Math.round(report.ca * 100) / 100;
    const m = parseFloat(String(montantTxt || '').replace(/\s/g, '').replace(',', '.'));
    const p = lireMontantSaisi(payeTxt);
    const rec = { ids, n: ids.length, ca, montant: isFinite(m) && m >= 0 ? Math.round(m * 100) / 100 : null, paye: p == null ? null : p, regle: regle === 'vente' ? 'vente' : 'versement', at: Date.now() };
    setDeclUrssaf(prev => { const u = { ...(prev || {}), [reportMonth]: rec }; save('vrm_urssaf_declare', u); return u; });
    setDeclForm(null);
    allerMoisSuivantSerie(reportMonth);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_2⟧*/const allerMoisSuivantSerie = (ym) => {
    const suite = suivantSerieDecl(ym);
    if (!suite) return;
    moisChoisiMain.current = true;
    setReportMonth(suite); setReportAnnee(Number(suite.slice(0, 4)));
    declVoulue.current = { ym: suite, arme: false };
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_3⟧*/const annulerDeclaration = () => {
    if (declUrssaf == null || !moisDeclare(declUrssaf, reportMonth)) return;
    if (!window.confirm(`Retirer la déclaration de ${report.monthLabel} ? Ses ventes redeviennent comptées à la date de versement.`)) return;
    setDeclUrssaf(prev => { const u = { ...(prev || {}) }; delete u[reportMonth]; save('vrm_urssaf_declare', u); return u; });
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_4⟧*/const exportReportCsv = () => {
    const R=report; const e=(v)=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
    const L=[];
    L.push([`Rapport ${R.monthLabel}`]);
    L.push([`Régime`, libelleRegime(R.regime)]);
    L.push([]);
    L.push(['VENTES']); L.push(['Date','N°','Titre','Vente','Achat','Boost','Bénéfice net']);
    R.saleLines.forEach(s=>L.push([s.date?new Date(s.date).toLocaleDateString('fr-FR'):'',s.num,(s.plateforme&&s.plateforme!=='Vinted'?'['+s.plateforme+'] ':'')+s.title,s.sell.toFixed(2),s.buy!=null?s.buy.toFixed(2):'',s.fee?s.fee.toFixed(2):'',s.buy!=null?(s.sell-s.buy-s.fee).toFixed(2):'']));
    L.push(['','','TOTAL',R.ca.toFixed(2),R.cout.toFixed(2),R.frais.toFixed(2),R.benefNet.toFixed(2)]);
    L.push([]);
    L.push(['ACHATS (registre)']); L.push(['Date','Vendeur','Article','Montant']);
    R.buyLines.forEach(b=>L.push([b.date?new Date(b.date).toLocaleDateString('fr-FR'):'',b.seller,b.title,b.montant.toFixed(2)]));
    L.push(['','','TOTAL',R.achatsTotal.toFixed(2)]);
    L.push([]);
    if (R.regime==='marge') { L.push(['Marge TTC',R.marge.toFixed(2)]); L.push([`TVA sur marge (${R.tvaRate}%)`,R.tvaMarge.toFixed(2)]); L.push(['Marge HT',R.margeHT.toFixed(2)]); }
    else { L.push(['CA des ventes finalisées',R.ca.toFixed(2)]); L.push(['Bénéfice net',R.benefNet.toFixed(2)]); if(R.nbCout<R.nb) L.push(['(bénéfice calculé sur les ventes au coût connu)',`${R.nbCout}/${R.nb}`]); L.push([`Estimation cotisations (${String(R.taux).replace('.',',')}%)`,R.urssaf.toFixed(2)]); }
    if (R.nMasq>0) L.push([`dont ${R.nMasq} vente(s) masquée(s) dans l'app, comptées dans le CA`,R.caMasq.toFixed(2)]);
    // ⚠️ Le document part chez un comptable : ce qui n'y est PAS encore doit
    // partir avec lui, sinon un mois se présente comme terminé (§5.84).
    if (R.nAttente>0) L.push([`Ventes de ce mois pas encore finalisees (hors CA)`,`${R.nAttente}`,R.caAttente.toFixed(2)]);
    // Le registre de ses déclarations : ce qui a été déclaré, et ce qui a bougé depuis.
    if (R.declaration) L.push([`Declare a l'URSSAF le ${new Date(R.declaration.at).toLocaleDateString('fr-FR')}`,`${R.declaration.n}`,Number(R.declaration.ca||0).toFixed(2)]);
    if (R.nApres>0) L.push([`Ventes absentes de toute declaration (a regulariser)`,`${R.nApres}`,R.caApres.toFixed(2)]);
    if (R.nVenteAvant>0) L.push([`Ventes vendues un mois plus tot (relevent de la declaration de leur mois de vente)`,`${R.nVenteAvant}`,R.caVenteAvant.toFixed(2)]);
    if (R.vinted==='passu') L.push([`ATTENTION : dates de versement Vinted illisibles - ventes Vinted absentes de ce document`]);
    if ((R.sourcesKO||[]).length) L.push([`Sources non lues : ${R.sourcesKO.join(', ')}`]);
    if (R.nDouble>0) L.push([`Ventes declarees deux fois (${R.doubles.join(', ')})`,`${R.nDouble}`,R.caDouble.toFixed(2)]);
    if (R.nAilleurs>0) L.push([`Ventes versees ce mois deja declarees dans un autre mois (non recomptees)`,`${R.nAilleurs}`,R.caAilleurs.toFixed(2)]);
    const csv = L.map(r=>r.map(e).join(';')).join('\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`rapport-${reportMonth}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h1_5⟧*/const exportReportPdf = async () => {
    const R=report;
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); const page = pdf.addPage([595,842]);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold); const reg = await pdf.embedFont(StandardFonts.Helvetica);
    let y=800; const T=(t,x,s,f,c)=>page.drawText(String(t),{x,y,size:s,font:f||reg,color:c||rgb(0.1,0.1,0.1)});
    T('Rapport comptable',40,22,bold,rgb(0,0.47,0.51)); y-=22; T(R.monthLabel+'  ·  '+(libelleRegime(R.regime)),40,11,reg,rgb(0.4,0.4,0.4)); y-=28;
    const kv=(k,v,big)=>{ T(k,40,9,reg,rgb(0.45,0.45,0.45)); page.drawText(String(v),{x:40,y:y-14,size:big?15:12,font:big?bold:reg,color:rgb(0.1,0.1,0.1)}); y-=big?36:30; };
    kv('Chiffre d\'affaires des ventes finalisees', R.ca.toFixed(2)+' EUR', true);
    kv('Coût d\'achat', R.cout.toFixed(2)+' EUR ('+R.nbCout+'/'+R.nb+' renseignés)');
    if (R.frais>0) kv('Boosts / mises en avant', R.frais.toFixed(2)+' EUR');
    if (R.regime==='marge') { kv('Marge TTC', R.marge.toFixed(2)+' EUR', true); kv('TVA sur la marge ('+R.tvaRate+'%)', R.tvaMarge.toFixed(2)+' EUR'); kv('Marge HT', R.margeHT.toFixed(2)+' EUR'); }
    else { kv('Bénéfice net', (R.nbCout===0&&R.nb>0) ? 'inconnu — aucun prix d\'achat saisi' : R.benefNet.toFixed(2)+' EUR'+(R.nbCout<R.nb?` (sur ${R.nbCout}/${R.nb} ventes au coût connu)`:''), true); kv('Estimation cotisations ('+String(R.taux).replace('.',',')+'%)', R.urssaf.toFixed(2)+' EUR'); }
    if (R.nMasq>0) kv('dont ventes masquees dans l\'app (comptees)', R.nMasq+' — '+R.caMasq.toFixed(2)+' EUR');
    if (R.nAttente>0) kv('Ventes de ce mois pas encore finalisees (hors CA)', R.nAttente+' — '+R.caAttente.toFixed(2)+' EUR');
    if (R.vinted==='passu') kv('ATTENTION', 'dates de versement Vinted illisibles : ventes Vinted absentes');
    kv('Nombre de ventes', String(R.nb));
    kv('Achats du mois (registre)', R.buyLines.length+' — '+R.achatsTotal.toFixed(2)+' EUR');
    // ── Les REGISTRES, ligne par ligne (G2) : le comptable rapproche les ventes
    // et les achats, il ne peut rien faire d'un total seul. Pagination : une
    // nouvelle page dès que la ligne ne tient plus. Les polices standard de
    // pdf-lib ne savent écrire que le WinAnsi : un emoji ou un caractère exotique
    // dans un titre ferait échouer TOUT l'export — on le retire du texte.
    let pg = page;
    const propre = (t) => String(t==null?'':t).replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC]/g,'').trim();
    const coupe = (t,n) => { const x=propre(t); return x.length>n ? x.slice(0,n-3)+'...' : x; };
    const W=(t,x,s,f,c)=>pg.drawText(propre(t),{x,y,size:s,font:f||reg,color:c||rgb(0.1,0.1,0.1)});
    const place = (h) => { if (y-h < 50) { pg = pdf.addPage([595,842]); y = 800; } };
    const entete = (titre, cols) => {
      place(40); y-=10; W(titre,40,12,bold,rgb(0,0.47,0.51)); y-=16;
      cols.forEach(([x,h])=>W(h,x,8,bold,rgb(0.35,0.35,0.35))); y-=4;
      pg.drawLine({start:{x:40,y},end:{x:555,y},thickness:0.5,color:rgb(0.8,0.8,0.8)}); y-=12;
    };
    const colsV=[[40,'Date'],[92,'N°'],[125,'Article'],[365,'Vente'],[420,'Achat'],[470,'Boost'],[510,'Benefice']];
    entete('Registre des ventes ('+R.saleLines.length+')', colsV);
    R.saleLines.forEach(v=>{
      place(14);
      W(v.date?new Date(v.date).toLocaleDateString('fr-FR'):'',40,8); W(v.num||'',92,8); W(coupe((v.plateforme&&v.plateforme!=='Vinted'?'['+v.plateforme+'] ':'')+(v.title||''),48),125,8);
      W(v.sell.toFixed(2),365,8); W(v.buy!=null?v.buy.toFixed(2):'-',420,8); W(v.fee?v.fee.toFixed(2):'',470,8);
      W(v.buy!=null?(v.sell-v.buy-v.fee).toFixed(2):'-',510,8); y-=12;
    });
    place(16); W('TOTAL',125,8,bold); W(R.ca.toFixed(2),365,8,bold); W(R.cout.toFixed(2),420,8,bold); W(R.frais?R.frais.toFixed(2):'',470,8,bold); y-=18;
    const colsA=[[40,'Date'],[92,'Vendeur'],[200,'Article'],[500,'Montant']];
    entete('Registre des achats ('+R.buyLines.length+')', colsA);
    R.buyLines.forEach(b=>{
      place(14);
      W(b.date?new Date(b.date).toLocaleDateString('fr-FR'):'',40,8); W(coupe(b.seller,20),92,8); W(coupe(b.title,58),200,8); W(b.montant.toFixed(2),500,8); y-=12;
    });
    place(16); W('TOTAL',200,8,bold); W(R.achatsTotal.toFixed(2),500,8,bold); y-=20;
    place(14); pg.drawText('Document indicatif genere par l\'app. Ne remplace pas un conseil comptable.',{x:40,y,size:8,font:reg,color:rgb(0.55,0.55,0.55)});
    const bytes=await pdf.save(); const blob=new Blob([bytes],{type:'application/pdf'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`rapport-${reportMonth}.pdf`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v1⟧*/<div onClick={()=>setShowReport(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setShowReport(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',paddingBottom:'env(safe-area-inset-bottom)',}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text,display:'flex',alignItems:'center',gap:8}}><Icon name="doc" size={17}/>Rapport comptable</div>
                <div style={{fontSize:11,color:C.muted}}>{libelleRegime(report.regime)} · <span style={{opacity:0.8}}>statut modifiable dans Paramètres → Statut</span></div>
              </div>
              <button type="button" onClick={()=>setShowReport(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:16}}>
              {/* ⚠️ N'IMPORTE QUEL MOIS, pas seulement ceux d'une liste : la même
                  grille que le sélecteur de période de l'écran Ventes (§5.57).
                  Un menu déroulant enterrait le mois qu'il cherchait. */}
              <div style={{marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:12,fontWeight:500,color:C.text}}>Mois</span>
                  <button type="button" className="vrm-b vrm-b-secondaire vrm-b-petit" aria-expanded={moisOuvert} onClick={()=>setMoisOuvert(v=>!v)} style={{textTransform:'capitalize'}}>
                    {report.monthLabel} ▾
                  </button>
                </div>
                {moisOuvert && (
                  <div style={{marginTop:8,border:`1px solid ${C.border}`,borderRadius:12,background:C.card,padding:10}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                      <button className="vrm-icon-control" type="button" aria-label="Année précédente" onClick={()=>setReportAnnee(a=>a-1)} style={{border:'none',background:'transparent',color:C.text,fontSize:17,cursor:'pointer',lineHeight:1,padding:'0 8px'}}>‹</button>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{reportAnnee}</div>
                      <button className="vrm-icon-control" type="button" aria-label="Année suivante" onClick={()=>setReportAnnee(a=>a+1)} disabled={reportAnnee>=new Date().getFullYear()} style={{border:'none',background:'transparent',color:reportAnnee>=new Date().getFullYear()?C.muted:C.text,fontSize:17,cursor:reportAnnee>=new Date().getFullYear()?'default':'pointer',lineHeight:1,padding:'0 8px',opacity:reportAnnee>=new Date().getFullYear()?0.4:1}}>›</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                      {MOIS_FR.map((nom,m)=>{
                        const ym = `${reportAnnee}-${String(m+1).padStart(2,'0')}`;
                        const now = new Date();
                        const futur = reportAnnee>now.getFullYear() || (reportAnnee===now.getFullYear() && m>now.getMonth());
                        const actif = ym===reportMonth;
                        const aDesVentes = derniersMoisDeclarables.includes(ym);
                        return (
                          <button key={ym} type="button" disabled={futur}
                            onClick={()=>{ moisChoisiMain.current=true; setReportMonth(ym); setMoisOuvert(false); }}
                            style={{border:`1px solid ${actif?C.accent:C.border}`,borderRadius:12,padding:'7px 4px',fontSize:13,fontWeight:actif?700:500,fontFamily:'inherit',
                              background:actif?`${C.accent}1a`:'transparent',color:futur?C.muted:(actif?C.accent:C.text),
                              cursor:futur?'default':'pointer',opacity:futur?0.35:1,textTransform:'capitalize',lineHeight:1.25}}>
                            {nom}
                            <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.06em',color:actif?C.accent:C.muted,minHeight:11}}>{aDesVentes?'VENTES':''}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {buys.loading && <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Chargement du registre d'achats…</div>}
              {/* Chiffres clés selon le régime.
                  ⚠️ (revue du 6 octobre) Pendant la lecture : « … », jamais
                  « 0,00 € ». Dates de versement Vinted illisibles : le CA est
                  celui qu'on CONNAÎT (Leboncoin, eBay) et le dit (« sans
                  Vinted ») — « — » s'il n'y a rien ; aucune cotisation ni marge
                  chiffrée sur un CA amputé de Vinted (un montant à payer partiel
                  présenté comme complet est pire qu'un tiret, §5). */}
              {(() => { const inc = report.enCours ? '…' : report.vinted === 'passu' ? '—' : null; return (
              <div data-rapport-vinted={report.enCours ? 'encours' : report.vinted} style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:14}}>
                <StatBox label="CA des ventes finalisées" value={report.enCours ? '…' : (report.vinted === 'passu' && !report.nb) ? '—' : fmtE(report.ca)}
                  subColor={report.vinted === 'passu' ? C.warn : undefined}
                  sub={report.enCours ? 'lecture des ventes en cours' : report.vinted === 'passu' ? `sans Vinted (dates de versement illisibles)${report.nb ? ` · ${report.nb} vente${report.nb>1?'s':''} Leboncoin/eBay` : ''}` : `${report.nb} vente${report.nb>1?'s':''}`}/>
                {report.regime==='marge' ? (<>
                  <StatBox label="Marge TTC" value={inc ?? fmtE(report.marge)} color={inc ? C.muted : report.marge>=0?INV_STATUS.online.color:C.danger}/>
                  <StatBox label={`TVA marge ${report.tvaRate}%`} value={inc ?? fmtE(report.tvaMarge)} color={inc ? C.muted : C.warn}/>
                  <StatBox label="Marge HT" value={inc ?? fmtE(report.margeHT)}/>
                </>) : (<>
                  {/* ⚠️ UNE SEULE COULEUR, ET ELLE EST RARE (§5.90). La modale avait
                      gardé l'ancienne identité — un vert et un ambre côte à côte,
                      chacun avec son filet — alors que l'écran Ventes juste
                      derrière est passé à l'encre. Ces deux chiffres n'appellent
                      aucune action : ce sont des faits. Le rouge reste pour un
                      bénéfice NÉGATIF, qui lui en appelle une. */}
                  <StatBox label="Bénéfice estimé" value={report.enCours?'…':report.nbCout===0?'—':fmtE(report.benefNet)} color={report.nbCout===0||report.benefNet>=0?C.text:C.danger}
                    subColor={report.nbCout<report.nb?C.warn:undefined}
                    sub={report.nbCout===0&&report.nb>0?`aucun prix d'achat saisi pour ${report.nb>1?'ces':'cette'} ${report.nb} vente${report.nb>1?'s':''}`:report.nbCout<report.nb?`sur ${report.nbCout} vente${report.nbCout>1?'s':''} sur ${report.nb} — prix d'achat manquants`:(report.frais>0?`frais renseignés ${fmtE(report.frais)}`:undefined)}/>
                  <StatBox label="Cotisations est." value={inc ?? fmtE(report.urssaf)} sub={inc === '—' ? 'attend tes ventes Vinted' : `${String(report.taux).replace('.',',')}\u00a0% du CA · réglable`}/>
                </>)}
              </div>); })()}
              {/* ⚠️ Les ventes masquées à l'écran COMPTENT dans le CA déclaré.
                  On l'écrit, sinon le chiffre paraîtrait inexplicablement plus
                  haut que la liste de l'onglet Ventes. */}
              {report.nAttente>0 && (
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.warn}`,borderRadius:12,padding:'9px 12px',marginBottom:12}}>
                  <div style={{fontSize:13,color:C.text,lineHeight:1.45}}>
                    <b>{report.nAttente} vente{report.nAttente>1?'s':''} de ce mois {report.nAttente>1?'ne sont':"n'est"} pas encore finalisée{report.nAttente>1?'s':''}</b> — <b style={{color:C.warn}}>{fmtE(report.caAttente)}</b> qui {report.nAttente>1?'ne sont':"n'est"} pas dans le CA ci-dessus.
                    <div className="vrm-aide" style={{fontSize:12,color:C.muted,marginTop:2}}>Vinted finalise ~2 semaines après la vente : ce mois va encore monter.</div>
                  </div>
                </div>
              )}
              {report.nMasq>0 && <div style={{fontSize:12,color:C.text,background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.accent}`,borderRadius:12,padding:'8px 12px',marginBottom:12}}>
                <b>{report.nMasq} vente{report.nMasq>1?'s':''} masquée{report.nMasq>1?'s':''} dans l'app</b> ({fmtE(report.caMasq)}) {report.nMasq>1?'sont comptées':'est comptée'} dans ce CA.
                <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:3}}>Masquer une carte range un écran ; ça n'annule pas une vente finalisée.</div>
              </div>}
              {/* ── « J'AI DÉCLARÉ CE MOIS » ─────────────────────────────────
                  Le registre de ses déclarations URSSAF (6 octobre). Il dit ce qui
                  a été déclaré, ce qui a bougé depuis, et ce qui est déjà compté
                  dans un autre mois. Rien n'est coché à sa place. */}
              {(() => {
                const nomMois = (ym) => { const [y,m]=String(ym).split('-'); return new Date(Number(y),Number(m)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); };
                const de = (t) => /^[aeiouyàâéèêîôû]/i.test(t) ? "d'" + t : 'de ' + t;
                const now = new Date(); const ymNow = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const passe = reportMonth < ymNow;
                const d = report.declaration;
                const lignes = [];
                if (report.nAilleurs>0) {
                  const ou = Object.keys(report.ailleurs||{}).sort().map(nomMois).join(', ');
                  lignes.push(<div key="ail" data-decl="ailleurs"><b>{report.nAilleurs} vente{report.nAilleurs>1?'s':''} versée{report.nAilleurs>1?'s':''} ce mois-ci ({fmtE(report.caAilleurs)})</b> {report.nAilleurs>1?'sont':'est'} déjà dans ta déclaration {de(ou)} : {report.nAilleurs>1?'elles ne sont pas recomptées':'elle n\'est pas recomptée'} ici.</div>);
                }
                // ⚠️ (revue du 6 octobre) Pas « arrivées APRÈS ta déclaration » : rien
                //    ne compare de date. Ce qui est vrai, quelle que soit la règle
                //    de la déclaration : ces ventes ne sont dans AUCUNE (une vente
                //    déclarée ailleurs n'est pas ici, elle est « déjà déclarée »).
                if (d && report.nApres>0) lignes.push(<div key="apr" data-decl="apres" data-decl-n={report.nApres} data-decl-cents={Math.round(report.caApres*100)}><b style={{color:C.warn}}>+ {report.nApres} vente{report.nApres>1?'s':''} ({fmtE(report.caApres)})</b> de ce mois {report.nApres>1?'ne figurent':'ne figure'} dans aucune déclaration : à ajouter à la prochaine.</div>);
                // Déclaré à la DATE DE VENTE : une vente vendue le mois d'avant relève
                // de la déclaration de son mois de vente — la dire « à régulariser »
                // faisait payer ses cotisations deux fois.
                if (d && report.nVenteAvant>0) {
                  const mv = Object.keys(report.venteAvant||{}).sort();
                  lignes.push(<div key="va" data-decl="venteavant" data-decl-n={report.nVenteAvant} data-decl-cents={Math.round(report.caVenteAvant*100)}><b>{report.nVenteAvant} vente{report.nVenteAvant>1?'s':''} ({fmtE(report.caVenteAvant)})</b> vendue{report.nVenteAvant>1?'s':''} en {mv.map(nomMois).join(', ')} : <b>rien à régulariser</b>. Note {mv.length>1?'ces mois-là':'ce mois-là'} ici. <Pourquoi>Versée{report.nVenteAvant>1?'s':''} ce mois-ci, mais déclaré à la date de vente : {report.nVenteAvant>1?'elles relèvent':'elle relève'} de ta déclaration {de(mv.map(nomMois).join(', '))}, pas de celle-ci. Note {mv.length>1?'ces mois-là':'ce mois-là'} dans ce rapport pour qu'{report.nVenteAvant>1?'elles n\'y soient':'elle n\'y soit'} plus comptée{report.nVenteAvant>1?'s':''}.</Pourquoi></div>);
                }
                if (report.nDouble>0) lignes.push(<div key="dbl" data-decl="double"><b style={{color:C.warn}}>{report.nDouble} vente{report.nDouble>1?'s':''} ({fmtE(report.caDouble)})</b> déclarée{report.nDouble>1?'s':''} deux fois ({report.doubles.map(nomMois).join(' et ')}) : signale-le à l'URSSAF. <Pourquoi>{report.nDouble>1?'Elles sont comptées':'Elle est comptée'} une fois ici. Signale-le à l'URSSAF lors de ta prochaine déclaration.</Pourquoi></div>);
                if (!d && !passe && !lignes.length) return null;
                const ecart = d && d.montant != null ? Math.round((d.montant - Number(d.ca||0)) * 100) / 100 : null;
                return (
                  <div data-declaration={d ? 'declare' : (report.declarePasSu ? 'passu' : 'libre')} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px',marginBottom:12,fontSize:13,color:C.text,lineHeight:1.45,display:'flex',flexDirection:'column',gap:6}}>
                    {d ? (
                      <div>
                        <b>Déclaré à l'URSSAF</b> le {new Date(d.at).toLocaleDateString('fr-FR')} — {fmtE(d.ca)} ({d.n} vente{d.n>1?'s':''}, {d.regle==='vente'?'à la date de vente':'à la date de versement'}).
                        {ecart != null && (ecart === 0
                          ? <span style={{color:C.muted}}> C'est le montant de ta déclaration.</span>
                          : <span> Tu as indiqué <b>{fmtE(d.montant)}</b> : <b style={{color:C.warn}}>écart de {fmtE(Math.abs(ecart))}</b> avec les ventes que je retrouve.</span>)}
                        {payeDe(d)!=null && <span data-decl-paye-lu={String(d.paye)} style={{color:C.muted}}> Cotisations payées : {fmtE(d.paye)}.</span>}
                        {' '}<button type="button" onClick={annulerDeclaration} style={{border:'none',background:'transparent',color:C.muted,textDecoration:'underline',cursor:'pointer',fontSize:12,padding:0,fontFamily:'inherit'}}>retirer</button>
                      </div>
                    ) : report.declarePasSu ? (
                      passe && <div style={{color:C.muted}}>Tes déclarations passées ne sont pas encore chargées : rouvre le rapport dans un instant.</div>
                    ) : passe && (declForm ? (
                      <div data-decl-form style={{display:'flex',flexDirection:'column',gap:8}}>
                        {serieDeclActive() && SERIE_DECLARATION.liste.includes(reportMonth) ? (
                          <div data-decl-serie={`${SERIE_DECLARATION.total - SERIE_DECLARATION.liste.length + 1}/${SERIE_DECLARATION.total}`} style={{fontSize:12,color:C.muted}}>
                            Rattrapage : mois {SERIE_DECLARATION.total - SERIE_DECLARATION.liste.length + 1} sur {SERIE_DECLARATION.total} — le suivant s'ouvre après « Enregistrer ».
                          </div>) : null}
                        <div><b>Qu'as-tu déclaré pour {report.monthLabel} ?</b></div>
                        {moisAncienneRegle && ancienneRegle ? (
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {[['versement', `À la date de versement (règle actuelle) — ${fmtE(report.ca)}, ${report.nb} vente${report.nb>1?'s':''}`],
                              ['vente', `À la date de vente (règle d'avant le 3 octobre) — ${fmtE(ancienneRegle.ca)}, ${ancienneRegle.ids.length} vente${ancienneRegle.ids.length>1?'s':''} Vinted`]].map(([k, t]) => (
                              <label key={k} style={{display:'flex',gap:8,alignItems:'flex-start',cursor:'pointer'}}>
                                <input type="radio" name="decl-regle" checked={declForm.regle===k} onChange={()=>setDeclForm(f=>({...f, regle:k}))} style={{marginTop:3}}/>
                                <span>{t}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div>{fmtE(report.ca)} — {report.nb} vente{report.nb>1?'s':''} finalisée{report.nb>1?'s':''}, à la date de versement.</div>
                        )}
                        <label style={{display:'flex',flexDirection:'column',gap:3}}>
                          <span style={{fontSize:12,color:C.muted}}>Montant sur ton espace URSSAF (facultatif, comparé)</span>
                          <input inputMode="decimal" value={declForm.montant} onChange={e=>setDeclForm(f=>({...f, montant:e.target.value}))} placeholder="ex. 1 234,50" style={{border:`1px solid ${C.border}`,borderRadius:12,padding:'7px 10px',fontSize:17,background:C.bg,color:C.text,maxWidth:200,fontFamily:'inherit'}}/>
                        </label>
                        <label style={{display:'flex',flexDirection:'column',gap:3}}>
                          <span style={{fontSize:12,color:C.muted}}>Cotisations payées pour ce mois (facultatif — pour ton suivi dans Comptabilité)</span>
                          <input data-decl-paye inputMode="decimal" value={declForm.paye||''} onChange={e=>setDeclForm(f=>({...f, paye:e.target.value}))} placeholder="ex. 153,20" style={{border:`1px solid ${C.border}`,borderRadius:12,padding:'7px 10px',fontSize:17,background:C.bg,color:C.text,maxWidth:200,fontFamily:'inherit'}}/>
                        </label>
                        {(report.incomplet || (declForm.refus && !declarables)) && <RaisonDeclBloquee manque={report.incomplet || declForm.refus} refus={!!declForm.refus}/>}
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          <Bouton variante="primaire" data-decl-enregistrer onClick={()=>declarerMois(declForm.regle, declForm.montant, declForm.paye)}>Enregistrer</Bouton>
                          {serieDeclActive() && SERIE_DECLARATION.liste.includes(reportMonth) ? (<>
                            <Bouton variante="secondaire" data-decl-passer onClick={()=>{ setDeclForm(null); allerMoisSuivantSerie(reportMonth); }}>Pas encore déclaré — mois suivant</Bouton>
                            <Bouton variante="discret" data-decl-serie-stop onClick={()=>{ finirSerieDecl(); setDeclForm(null); }}>Arrêter</Bouton>
                          </>) : (
                          <Bouton variante="discret" onClick={()=>setDeclForm(null)}>Annuler</Bouton>)}
                        </div>
                      </div>
                    ) : (
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                          <span style={{flex:'1 1 220px',color:C.muted,fontSize:12}}>Note-le une fois déclaré : ces ventes ne compteront plus ailleurs.</span>
                          <Bouton variante="secondaire" className="vrm-b-petit" data-decl-ouvrir disabled={!!report.incomplet} onClick={()=>{ if (!report.incomplet) setDeclForm({ regle:'versement', montant:'', paye:'' }); }}>J'ai déclaré ce mois</Bouton>
                        </div>
                        {report.incomplet && <RaisonDeclBloquee manque={report.incomplet}/>}
                      </div>
                    ))}
                    {lignes}
                  </div>
                );
              })()}
              {/* ── LE RELEVÉ DU PORTE-MONNAIE ────────────────────────────
                  Une VÉRIFICATION à côté du CA, jamais à sa place : le CA
                  ci-dessus date au jour de la finalisation, le relevé au jour du
                  mouvement — ce sont deux sources, elles peuvent différer d'un jour.
                  ⚠️ On n'affiche que des faits : Vinted ne nous dit avec
                  certitude qu'une chose, c'est qu'un mouvement `payout` est un
                  virement vers SA banque. On ne baptise donc pas « recette » ce
                  qu'on n'a pas encore mesuré. */}
              {releveTotaux ? (
                <div data-releve="lu" style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.accent}`,borderRadius:12,padding:'9px 12px',marginBottom:12}}>
                  <div style={{fontSize:13,color:C.text,lineHeight:1.45}}>
                    <b>Relevé de ton porte-monnaie Vinted</b> — {releveTotaux.n} mouvement{releveTotaux.n>1?'s':''} sur {releveTotaux.comptes} compte{releveTotaux.comptes>1?'s':''}
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:14,marginTop:6}}>
                    <div><div className="vrm-label" style={{fontSize:11,color:C.muted}}>CRÉDITÉ</div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{fmtE(releveTotaux.entrees)}</div></div>
                    {releveTotaux.sorties!==0 && <div><div className="vrm-label" style={{fontSize:11,color:C.muted}}>PRÉLEVÉ</div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{fmtE(releveTotaux.sorties)}</div></div>}
                    <div><div className="vrm-label" style={{fontSize:11,color:C.muted}}>VIRÉ VERS TA BANQUE</div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{fmtE(Math.abs(releveTotaux.virements))}</div></div>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginTop:5,lineHeight:1.4}}>
                    Un jour d'écart avec le CA est normal ; un virement n'est pas une recette. <Pourquoi>Ces montants sont datés au jour du mouvement ; le CA ci-dessus est daté au jour où la vente est finalisée (l'argent versé). Les deux viennent de deux sources différentes. Un virement vers ta banque déplace ton propre argent.</Pourquoi>
                  </div>
                </div>
              ) : (
                /* ⚠️⚠️ (22 oct.) PLUS AUCUNE PROMESSE. La phrase disait « l'extension
                   le récupère à ta prochaine visite sur Vinted » dès que l'extension
                   était à jour — et ça n'arrivait JAMAIS. Mesuré sur sa base le
                   22 octobre, extension 5.211 : 0 ligne `harvest_*_releve_*`,
                   0 compteur `releve_*` ; `capterReleves` part de
                   `payload.history` de la ligne `_billing`, et Vinted le rend VIDE
                   (`[]`) sur les 4 comptes qui en portent un — la fonction sort
                   sans une seule requête. Aller le chercher autrement voudrait dire
                   deviner une adresse Vinted jamais vue (§3) : rien avant une
                   mesure. La phrase dit donc ce qui est vrai pour TOUTE version de
                   l'extension (pas de garde de version : aucune ne le tient), et
                   que le CA ci-dessus n'en dépend pas. Lecture ratée ⇒ on le dit
                   (« rien lu » ne vaut pas « rien »). */
                <div data-releve={releveMois.mois !== reportMonth ? 'encours' : releveMois.ko ? 'passu' : 'pasencore'} style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.4}}>
                  {releveMois.mois !== reportMonth
                    ? <>Relevé du porte-monnaie Vinted : lecture…</>
                    : releveMois.ko
                      ? <>Relevé du porte-monnaie Vinted : la base n'a pas répondu — rouvre le rapport dans un moment.</>
                      : <>Relevé du porte-monnaie Vinted : VRM n'a pas encore réussi à le lire pour ce mois. Le CA ci-dessus n'en dépend pas : il vient de tes ventes finalisées.</>}
                </div>
              )}
              {/* ── REGISTRE DES VENTES (G2) ─────────────────────────────
                  La modale ne montrait que le TOTAL des ventes à côté du détail
                  des achats : le comptable ne pouvait rien rapprocher. Les lignes
                  viennent de `report.saleLines`, la MÊME boucle que le CA
                  ci-dessus (§11) — la somme des lignes est le CA, par
                  construction. Le prix d'achat n'est écrit que s'il est connu ;
                  sinon un tiret, jamais un 0 (§7). */}
              <div style={{fontSize:12,fontWeight:600,color:C.text,margin:'6px 0 8px'}}>Registre des ventes{report.enCours ? ' — …' : (report.vinted === 'passu' && !report.nb) ? '' : ` — ${fmtE(report.ca)} (${report.saleLines.length})`}</div>
              {/* La répartition et ce qui MANQUE, à côté du total (§5). */}
              {(() => {
                const pp = Object.entries(report.parPlateforme||{}).filter(([,v])=>v.n>0);
                const bits = [];
                if (pp.length > 1) bits.push('dont ' + pp.map(([k,v])=>`${k} ${fmtE(v.ca)}`).join(' · '));
                if ((report.sourcesKO||[]).length) bits.push(`${report.sourcesKO.join(' et ')} : pas pu lire — rouvre le rapport dans un moment`);
                if (report.aDater && report.aDater.n) bits.push(`${report.aDater.n} vente${report.aDater.n>1?'s':''} finalisée${report.aDater.n>1?'s':''} sans date (${fmtE(report.aDater.ca)}, tous mois) : dans aucun mois tant que leur date n'est pas captée`);
                bits.push('mois du versement de l\'argent (commande finalisée)');
                bits.push('Vestiaire Co : pas encore relié');
                return <div data-registre-couverture style={{fontSize:11,color:C.muted,margin:'-4px 0 8px',lineHeight:1.5}}>{bits.join(' · ')}</div>;
              })()}
              {report.saleLines.length===0 && <div data-registre-vide={report.enCours ? 'encours' : report.vinted === 'passu' ? 'passu' : 'aucune'} style={{fontSize:12,color:report.vinted === 'passu' && !report.enCours ? C.warn : C.muted,padding:'6px 0 12px'}}>{report.enCours ? 'Lecture des ventes en cours…'
                : report.vinted === 'passu' ? 'Rien de lisible ce mois-ci pour l\'instant (voir juste au-dessus) — ce n\'est pas zéro.'
                : 'Aucune vente finalisée ce mois-ci.'}</div>}
              <div data-registre="ventes" style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
                {report.saleLines.map((v,i)=>(
                  <div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'7px 10px',border:`1px solid ${C.border}`,borderRadius:12,background:C.card}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{v.num?<span style={{fontWeight:700}}>N°{v.num} · </span>:null}{v.title||'—'}</div>
                      <div style={{fontSize:11,color:C.muted}}>{v.plateforme||'Vinted'}{' · '}{v.date?new Date(v.date).toLocaleDateString('fr-FR'):''}{' · achat '}{v.buy!=null?fmtE(v.buy):'—'}{v.fee?` · frais ${fmtE(v.fee)}`:''}{v.buy!=null?` · bénéfice ${fmtE(v.sell-v.buy-v.fee)}`:''}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,flexShrink:0}}>{fmtE(v.sell)}</div>
                  </div>
                ))}
              </div>
              {/* Registre d'achats */}
              <div style={{fontSize:12,fontWeight:600,color:C.text,margin:'6px 0 8px'}}>Registre d'achats — {fmtE(report.achatsTotal)} ({report.buyLines.length})</div>
              {report.buyLines.length===0 && <div style={{fontSize:12,color:C.muted,padding:'6px 0 12px'}}>Aucun achat ce mois-ci{buys.items===null?' (registre en cours de chargement)':''}.</div>}
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
                {report.buyLines.map((b,i)=>(
                  <div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'7px 10px',border:`1px solid ${C.border}`,borderRadius:12,background:C.card}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.title||'—'}</div>
                      <div style={{fontSize:11,color:C.muted}}>{b.date?new Date(b.date).toLocaleDateString('fr-FR'):''}{b.seller?` · ${b.seller}`:''}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,flexShrink:0}}>{b.montant.toFixed(2)}&nbsp;€</div>
                    <button className="vrm-icon-control" type="button" onClick={()=>generateAchatJustificatif(b.o,{ account:accNameOf(b.o._acc), regime:report.regime })} title="Reçu d'achat PDF" aria-label="Justificatif d'achat" style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:12,background:'transparent',color:C.text,cursor:'pointer',fontSize:12,padding:'3px 8px'}}><Icon name="doc" size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:8,padding:'12px 16px',borderTop:`1px solid ${C.border}`,flexShrink:0}}>
              <Bouton variante="secondaire" icone="save" data-rapport-csv onClick={exportReportCsv} style={{flex:1}}>CSV</Bouton>
              <Bouton icone="doc" data-rapport-pdf onClick={exportReportPdf} style={{flex:1}}>PDF</Bouton>
            </div>
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {showAnnual && …} de Comptabilite, telle quelle, avec 4 fonction(s) que seule elle utilisait. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleAnnuel({ v }) {
  const { accNameOf, accounts, acctOff, annual, buyNumByTxn, buys, capturedReceipts, fmtE, loadOrders, nomsVentesKO, recusPasLus, relireVersements, reportYear, reportYears, sales, setReportYear, setSales, setShowAnnual, versements } = v;
  /*⟦← App.jsx #h2_1⟧*/const relireVentes = async () => {
    try { delete _acctCache.sold; _persistAcctCache(); } catch (_) {}
    for (const u of (Array.isArray(sales.failedUids) ? sales.failedUids : [])) _rowCache.delete(`o:${u}`);
    await Promise.all([
      loadOrders('sold', setSales, false, { silencieux: true }),
      versements === null && relireVersements.current ? relireVersements.current() : null,
    ]);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h2_2⟧*/const downloadReceipt = async (rec) => {
    const lu = await lirePdfLigne(rec.row);
    if (!lu || !lu.octets) { toast(lu === null ? "La base n'a pas répondu — réessaie dans un instant." : "Ce reçu n'a plus son PDF."); return; }
    try { const buf=lu.octets; const blob=new Blob([buf],{type:'application/pdf'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`recu-vinted-${(rec.name||'compte').replace(/[^a-z0-9]/gi,'_')}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),3000); } catch(_){ toast('Impossible d\'ouvrir ce reçu.'); }
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h2_3⟧*/const exportAnnualCsv = () => {
    const R=annual; const e=(v)=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
    const L=[];
    L.push([`Bilan annuel ${R.year}`]);
    L.push([`Régime`, libelleRegime(R.regime)]);
    L.push([]);
    L.push(['Mois','CA des ventes finalisees','Cout achat','Boosts','Benefice net','Ventes']);
    R.months.forEach(m=>L.push([m.label, m.ca.toFixed(2), m.cout.toFixed(2), m.frais.toFixed(2), (m.ca-m.cout-m.frais).toFixed(2), String(m.nb)]));
    L.push(['TOTAL', R.ca.toFixed(2), R.cout.toFixed(2), R.frais.toFixed(2), R.benefNet.toFixed(2), String(R.nb)]);
    L.push([]);
    // Registre des ventes ligne par ligne (ce que l'expert-comptable attend).
    L.push(['VENTES (registre)']); L.push(['Date','Plateforme','N°','Article','Compte','Prix vente','Prix achat','Boost','Marge']);
    R.saleLines.forEach(s=>L.push([s.date?new Date(s.date).toLocaleDateString('fr-FR'):'', s.plateforme||'Vinted', s.num, s.title, s.account, s.sell.toFixed(2), s.buy==null?'':s.buy.toFixed(2), s.fee?s.fee.toFixed(2):'', s.marge==null?'':s.marge.toFixed(2)]));
    L.push(['','','','','TOTAL', R.ca.toFixed(2), R.cout.toFixed(2), R.frais.toFixed(2), R.benefNet.toFixed(2)]);
    L.push([]);
    L.push(['ACHATS (registre)']); L.push(['Date','Vendeur','Article','Montant']);
    R.buyLines.forEach(b=>L.push([b.date?new Date(b.date).toLocaleDateString('fr-FR'):'',b.seller,b.title,b.montant.toFixed(2)]));
    L.push(['','','TOTAL',R.achatsTotal.toFixed(2)]);
    L.push([]);
    // CHARGES d'entreprise (déductibles) : dépenses, packs photos, coûts fixes.
    L.push(['CHARGES (registre)']); L.push(['Date','Type','Libelle','Montant']);
    R.charges.depLignes.forEach(d=>L.push([d.date?new Date(d.date).toLocaleDateString('fr-FR'):'','Depense',`${d.libelle||''}${d.cat?' ('+d.cat+')':''}`,(Number(d.montant)||0).toFixed(2)]));
    R.charges.packLignes.forEach(p=>L.push([p.date?new Date(p.date).toLocaleDateString('fr-FR'):'','Pack photos',`${p.plateforme||''}${p.compte?' '+p.compte:''}`,(Number(p.montant)||0).toFixed(2)]));
    (R.charges.aboLignes||[]).forEach(x=>L.push([x.a.debut?new Date(x.a.debut).toLocaleDateString('fr-FR'):'',`Abonnement x${x.n} echeance${x.n>1?'s':''}`,x.a.libelle||'',x.total.toFixed(2)]));
    R.charges.fixes.forEach(f=>L.push(['',`Cout fixe x${R.charges.moisComptes} mois`,f.libelle||'',((Number(f.montant)||0)*R.charges.moisComptes).toFixed(2)]));
    L.push(['','','TOTAL charges',R.charges.total.toFixed(2)]);
    L.push([]);
    if (R.regime==='marge') { L.push(['Marge TTC',R.marge.toFixed(2)]); L.push([`TVA sur marge (${R.tvaRate}%)`,R.tvaMarge.toFixed(2)]); L.push(['Marge HT',R.margeHT.toFixed(2)]); }
    else { L.push([`Estimation cotisations (${String(R.taux).replace('.',',')}%)`,R.urssaf.toFixed(2)]); }
    L.push([`Resultat apres charges (benefice net - charges)`,R.resultatCharges.toFixed(2)]);
    if (R.nbCout<R.nb) L.push([`  benefice net sur ${R.nbCout}/${R.nb} ventes au cout d'achat connu`]);
    if (R.charges.total>0) L.push([`  couts fixes au tarif actuel x ${R.charges.moisComptes} mois`]);
    if (R.nMasq>0) L.push([`dont ${R.nMasq} vente(s) masquée(s) dans l'app, comptées dans le CA`,R.caMasq.toFixed(2)]);
    // Ce qui manque part AVEC le document (§5) : il va chez un comptable.
    if (R.vinted==='passu') L.push([`ATTENTION : dates de versement Vinted illisibles - ventes Vinted absentes de ce bilan`]);
    const csv = L.map(r=>r.map(e).join(';')).join('\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`bilan-${R.year}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  };/*⟦←/⟧*/
  /*⟦← App.jsx #h2_4⟧*/const exportAnnualPdf = async () => {
    const R=annual;
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); const page = pdf.addPage([595,842]);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold); const reg = await pdf.embedFont(StandardFonts.Helvetica);
    let y=800; const T=(t,x,yy,s,f,c)=>page.drawText(String(t),{x,y:yy,size:s,font:f||reg,color:c||rgb(0.1,0.1,0.1)});
    T('Bilan annuel '+R.year,40,y,22,bold,rgb(0,0.47,0.51)); y-=20; T(libelleRegime(R.regime),40,y,11,reg,rgb(0.4,0.4,0.4)); y-=26;
    // Tableau mensuel
    const cols=[[40,'Mois'],[150,'CA'],[240,'Coût'],[330,'Boosts'],[420,'Bénéf.'],[510,'Ventes']];
    cols.forEach(([x,h])=>T(h,x,y,9,bold,rgb(0.3,0.3,0.3))); y-=4; page.drawLine({start:{x:40,y},end:{x:555,y},thickness:0.5,color:rgb(0.8,0.8,0.8)}); y-=14;
    R.months.forEach(m=>{ T(m.label,40,y,9,reg); T(m.ca.toFixed(0),150,y,9,reg); T(m.cout.toFixed(0),240,y,9,reg); T(m.frais.toFixed(0),330,y,9,reg); T((m.ca-m.cout-m.frais).toFixed(0),420,y,9,reg); T(String(m.nb),510,y,9,reg); y-=15; });
    page.drawLine({start:{x:40,y:y+4},end:{x:555,y:y+4},thickness:0.5,color:rgb(0.8,0.8,0.8)});
    T('TOTAL',40,y-8,10,bold); T(R.ca.toFixed(0),150,y-8,10,bold); T(R.cout.toFixed(0),240,y-8,10,bold); T(R.frais.toFixed(0),330,y-8,10,bold); T(R.benefNet.toFixed(0),420,y-8,10,bold); T(String(R.nb),510,y-8,10,bold); y-=34;
    const kv=(k,v)=>{ T(k,40,y,10,reg,rgb(0.4,0.4,0.4)); T(v,300,y,11,bold); y-=20; };
    kv('Achats (registre)', R.achatsTotal.toFixed(2)+' EUR ('+R.achatsNb+')');
    if (R.vinted==='passu') kv('ATTENTION', 'dates de versement Vinted illisibles : ventes Vinted absentes');
    if (R.regime==='marge') { kv('Marge TTC', R.marge.toFixed(2)+' EUR'); kv('TVA sur la marge ('+R.tvaRate+'%)', R.tvaMarge.toFixed(2)+' EUR'); kv('Marge HT', R.margeHT.toFixed(2)+' EUR'); }
    else { kv('Bénéfice net', R.benefNet.toFixed(2)+' EUR'+(R.nbCout<R.nb?` (sur ${R.nbCout}/${R.nb} ventes au coût connu)`:'')); kv('Estimation cotisations ('+String(R.taux).replace('.',',')+'%)', R.urssaf.toFixed(2)+' EUR'); }
    if (R.charges.total>0) { kv('Charges entreprise (packs, depenses, abonnements, fixes)', R.charges.total.toFixed(2)+' EUR'); kv('Resultat apres charges', R.resultatCharges.toFixed(2)+' EUR'+(R.charges.moisComptes?` (fixes x${R.charges.moisComptes} mois)`:'')); }
    for (const [k,v] of Object.entries(R.parPlateforme||{})) if (k!=='Vinted' && v.n>0) kv('dont '+k, v.ca.toFixed(2)+' EUR ('+v.n+')');
    if (R.nMasq>0) kv('dont ventes masquees dans l\'app (comptees)', R.nMasq+' — '+R.caMasq.toFixed(2)+' EUR');
    y-=6; T('Document indicatif genere par l\'app. Ne remplace pas un conseil comptable.',40,y,8,reg,rgb(0.55,0.55,0.55));
    const bytes=await pdf.save(); const blob=new Blob([bytes],{type:'application/pdf'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`bilan-${R.year}.pdf`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  };/*⟦←/⟧*/
  return (/*⟦← App.jsx #v2⟧*/<div onClick={()=>setShowAnnual(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <FermeAuRetour fermer={()=>setShowAnnual(false)}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'14px 14px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',paddingBottom:'env(safe-area-inset-bottom)',}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>📚 Registre comptable {annual.year}</div>
                <div style={{fontSize:11,color:C.muted}}>{libelleRegime(annual.regime)} · <span style={{opacity:0.8}}>le CSV contient le détail ventes + achats ligne par ligne</span></div>
              </div>
              <button type="button" onClick={()=>setShowAnnual(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:16}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{fontSize:12,fontWeight:500,color:C.text}}>Année</span>
                <select value={reportYear} onChange={e=>setReportYear(Number(e.target.value))} style={{border:`1px solid ${C.border}`,borderRadius:12,padding:'6px 10px',fontSize:13,fontWeight:500,background:C.card,color:C.text,cursor:'pointer'}}>
                  {reportYears.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {buys.loading && <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Chargement du registre d'achats…</div>}
              {/* ⚠️ (revue du 6 octobre) Le bilan ne rendait pas `enCours` : il
                  affichait « 0 € » pendant le simple chargement, et « 0 € » aussi
                  quand les dates de versement Vinted étaient illisibles — en
                  perdant Leboncoin et eBay au passage. Pendant la lecture : « … ».
                  Vinted illisible : le CA connu (Leboncoin, eBay) avec la mention
                  « sans Vinted », et aucune cotisation chiffrée dessus.
                  `data-registre-vinted` : la partie Vinted du registre, compte par
                  compte — le banc la compare à la carte des seuils. Un compte dont
                  les ventes n'ont pas été lues se DIT à côté du total (§5 : la
                  couverture à côté du chiffre, jamais un total partiel présenté
                  comme complet). */}
              {(() => { const inc = annual.enCours ? '…' : annual.vinted === 'passu' ? '—' : null; return (
              <div data-annuel-vinted={annual.enCours ? 'encours' : annual.vinted}
                data-registre-vinted={annual.vintedParUid ? JSON.stringify(Object.fromEntries(Object.entries(annual.vintedParUid).map(([u,q])=>[u,{ n:q.n, eur:(q.cts/100).toFixed(2) }]))) : ''}
                data-registre-vinted-n={annual.vintedParUid ? (annual.parPlateforme?.Vinted?.n ?? 0) : ''} data-registre-vinted-eur={annual.vintedParUid && annual.parPlateforme?.Vinted ? annual.parPlateforme.Vinted.ca.toFixed(2) : ''} data-registre-sans={nomsVentesKO.join(',')}
                style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:14}}>
                <StatBox label="CA des ventes finalisées" value={annual.enCours ? '…' : ((annual.vinted === 'passu' || nomsVentesKO.length) && !annual.nb) ? '—' : fmtE(annual.ca)}
                  subColor={(annual.vinted === 'passu' || nomsVentesKO.length) ? C.warn : undefined}
                  sub={(annual.enCours ? 'lecture des ventes en cours' : (annual.vinted === 'passu' ? 'sans Vinted' + (annual.nb ? ` · ${annual.nb} vente${annual.nb>1?'s':''}` : '') : `${annual.nb} vente${annual.nb>1?'s':''}`)+Object.entries(annual.parPlateforme||{}).filter(([k,v])=>k!=='Vinted'&&v.n>0).map(([k,v])=>` · dont ${k} ${fmtE(v.ca)}`).join(''))+(!annual.enCours && annual.vinted !== 'passu' && nomsVentesKO.length ? ` · ventes de ${nomsVentesKO.join(', ')} pas lues` : '')}/>
                {annual.regime==='marge' ? (<>
                  <StatBox label="Marge TTC" value={inc ?? fmtE(annual.marge)} color={inc ? C.muted : annual.marge>=0?INV_STATUS.online.color:C.danger}/>
                  <StatBox label={`TVA marge ${annual.tvaRate}%`} value={inc ?? fmtE(annual.tvaMarge)} color={inc ? C.muted : C.warn}/>
                  <StatBox label="Marge HT" value={inc ?? fmtE(annual.margeHT)}/>
                </>) : (<>
                  <StatBox label="Bénéfice estimé" value={inc ?? fmtE(annual.benefNet)} color={inc ? C.muted : annual.benefNet>=0?INV_STATUS.online.color:C.danger}
                    subColor={annual.nbCout<annual.nb?C.warn:undefined}
                    sub={inc ? undefined : annual.nbCout<annual.nb?`sur ${annual.nbCout} vente${annual.nbCout>1?'s':''} sur ${annual.nb} — prix d'achat manquants`:(annual.frais>0?`frais renseignés ${fmtE(annual.frais)}`:undefined)}/>
                  <StatBox label="Cotisations est." value={inc ?? fmtE(annual.urssaf)} color={inc ? C.muted : C.warn} sub={inc === '—' ? 'attend tes ventes Vinted' : `${String(annual.taux).replace('.',',')}\u00a0% du CA · réglable`}/>
                </>)}
                {annual.charges && annual.charges.total>0 && (<>
                  <StatBox label="Charges d'entreprise" value={fmtE(annual.charges.total)} sub={(annual.charges.fixesTotal>0?`packs + dépenses + abonnements + fixes × ${annual.charges.moisComptes} mois`:'packs + dépenses + abonnements')}/>
                  {/* Le résultat dérive du bénéfice net : tant que celui-ci n'est
                      pas su (lecture en cours, dates Vinted illisibles), lui non
                      plus — jamais un nombre calculé sur un CA partiel. */}
                  <StatBox label="Résultat après charges" value={inc ?? fmtE(annual.resultatCharges)} color={inc ? C.muted : annual.resultatCharges>=0?INV_STATUS.online.color:C.danger} sub={inc ? undefined : "bénéfice net − tes charges (hors coût d'achat manquant)"}/>
                </>)}
              </div>); })()}
              {annual.vinted === 'passu' && !annual.enCours && <div data-annuel-sans-vinted style={{fontSize:12,color:C.warn,lineHeight:1.45,marginBottom:12}}>Dates de versement Vinted pas lues : absentes des mois, pas zéro. Rouvre plus tard.</div>}
              {annual.nb>annual.nbCout && <div style={{fontSize:12,color:C.warn,background:`${C.warn}18`,border:`1px solid ${C.warn}55`,borderRadius:12,padding:'8px 12px',marginBottom:12}}>⚠️ {annual.nb-annual.nbCout} vente(s) sans prix d'achat — le bénéfice est incomplet.</div>}
              {annual.nMasq>0 && <div style={{fontSize:12,color:C.text,background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.accent}`,borderRadius:12,padding:'8px 12px',marginBottom:12}}>
                <b>{annual.nMasq} vente{annual.nMasq>1?'s':''} masquée{annual.nMasq>1?'s':''} dans l'app</b> ({fmtE(annual.caMasq)}) {annual.nMasq>1?'sont comptées':'est comptée'} dans ce CA.
                <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginTop:3}}>Masquer une carte range un écran ; ça n'annule pas une vente finalisée.</div>
              </div>}
              {/* Tableau mensuel */}
              <div style={{fontSize:12,fontWeight:600,color:C.text,margin:'6px 0 8px'}}>Détail par mois</div>
              <div style={{overflowX:'auto',marginBottom:12}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{color:C.muted,textAlign:'right'}}>
                    <th style={{textAlign:'left',padding:'4px 6px',fontWeight:500}}>Mois</th>
                    <th style={{padding:'4px 6px',fontWeight:500}}>CA</th>
                    <th style={{padding:'4px 6px',fontWeight:500}}>Coût</th>
                    <th style={{padding:'4px 6px',fontWeight:500}}>Bénéf.</th>
                    <th style={{padding:'4px 6px',fontWeight:500}}>Ventes</th>
                  </tr></thead>
                  <tbody>
                    {annual.months.map((m,i)=>{ const b=m.ca-m.cout-m.frais; return (
                      <tr key={i} style={{borderTop:`1px solid ${C.border}`,color:C.text,textAlign:'right'}}>
                        <td style={{textAlign:'left',padding:'5px 6px',textTransform:'capitalize'}}>{m.label}</td>
                        <td style={{padding:'5px 6px'}}>{m.ca?m.ca.toFixed(0)+'\u00a0€':'—'}</td>
                        <td style={{padding:'5px 6px',color:C.muted}}>{m.cout?m.cout.toFixed(0)+'\u00a0€':'—'}</td>
                        <td style={{padding:'5px 6px',fontWeight:500,color:m.nbCout?(b>=0?INV_STATUS.online.color:C.danger):C.muted}}>{m.nbCout?(b>=0?'+':'')+b.toFixed(0)+'\u00a0€':'—'}</td>
                        <td style={{padding:'5px 6px',color:C.muted}}>{m.nb||'—'}</td>
                      </tr>
                    );})}
                    <tr style={{borderTop:`2px solid ${C.border}`,color:C.text,textAlign:'right',fontWeight:700}}>
                      <td style={{textAlign:'left',padding:'6px'}}>TOTAL</td>
                      <td style={{padding:'6px'}}>{annual.enCours ? '…' : (annual.vinted === 'passu' && !annual.nb) ? '—' : `${annual.ca.toFixed(0)}\u00a0€`}</td>
                      <td style={{padding:'6px'}}>{annual.cout.toFixed(0)}&nbsp;€</td>
                      <td style={{padding:'6px',color:annual.benefNet>=0?INV_STATUS.online.color:C.danger}}>{(annual.benefNet>=0?'+':'')+annual.benefNet.toFixed(0)}&nbsp;€</td>
                      <td style={{padding:'6px'}}>{annual.nb}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <CarteSeuilsVinted annee={annual.year} echoues={sales.failedUids} comptes={accounts} ecarte={acctOff} nomDe={accNameOf} datees={annual.vintedParUid} aDater={annual.vintedADater} onRelire={relireVentes}/>
              <div style={{fontSize:12,fontWeight:600,color:C.text,margin:'6px 0 8px'}}>Registre d'achats — {fmtE(annual.achatsTotal)} ({annual.buyLines.length})</div>
              {buys.items===null && <div style={{fontSize:12,color:C.muted,marginBottom:8}}>Registre en cours de chargement…</div>}
              {buys.items!==null && annual.buyLines.length===0 && <div style={{fontSize:12,color:C.muted,padding:'6px 0 12px'}}>Aucun achat cette année.</div>}
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12,maxHeight:260,overflowY:'auto'}}>
                {annual.buyLines.map((b,i)=>(
                  <div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'7px 10px',border:`1px solid ${C.border}`,borderRadius:12,background:C.card}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.title||'—'}</div>
                      <div style={{fontSize:11,color:C.muted}}>{b.date?new Date(b.date).toLocaleDateString('fr-FR'):''}{b.seller?` · ${b.seller}`:''}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,flexShrink:0}}>{b.montant.toFixed(2)}&nbsp;€</div>
                    <button className="vrm-icon-control" type="button" onClick={()=>generateAchatJustificatif(b.o,{ account:accNameOf(b.o._acc), regime:annual.regime, numero:buyNumByTxn[String(b.o.transaction_id)]||'' })} title="Reçu d'achat PDF" aria-label="Justificatif d'achat" style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:12,background:'transparent',color:C.text,cursor:'pointer',fontSize:12,padding:'3px 8px'}}><Icon name="doc" size={16}/></button>
                  </div>
                ))}
              </div>
              {/* Reçus officiels Vinted captés par l'extension (compta pro). */}
              <div style={{border:`1px solid ${C.border}`,borderRadius:12,background:C.card,padding:'10px 12px',marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>📄 Reçus officiels Vinted</div>
                {capturedReceipts.length>0 ? (
                  <>
                    <div className="vrm-aide" style={{fontSize:11,color:C.muted,marginBottom:8}}>Le vrai reçu Vinted, le dernier que tu as ouvert.</div>
                    {capturedReceipts.map((rec,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0'}}>
                        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:C.text}}>{rec.name}</div><div style={{fontSize:11,color:C.muted}}>capté le {rec.capturedAt?new Date(rec.capturedAt).toLocaleDateString('fr-FR'):'—'}</div></div>
                        <button type="button" onClick={()=>downloadReceipt(rec)} style={{flexShrink:0,border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accentTexte,borderRadius:12,padding:'5px 11px',cursor:'pointer',fontSize:12,fontWeight:600}}>⬇️ Télécharger</button>
                      </div>
                    ))}
                    {/* Une liste partielle ne se présente pas comme complète (§5) :
                        un compte dont la lecture a échoué ne disparaît pas en
                        silence derrière les reçus des autres. */}
                    {recusPasLus>0 && <div data-recus-pas-lus={recusPasLus} style={{fontSize:11,color:C.muted,lineHeight:1.5,marginTop:4}}>Et la base n'a pas répondu pour {recusPasLus} autre{recusPasLus>1?'s':''} compte{recusPasLus>1?'s':''} — rouvre le bilan dans un instant.</div>}
                  </>
                ) : recusPasLus>0 ? (
                  <div data-recus-pas-lus={recusPasLus} style={{fontSize:11,color:C.muted,lineHeight:1.5}}>La base n'a pas répondu pour {recusPasLus} compte{recusPasLus>1?'s':''} — rouvre le bilan dans un instant.</div>
                ) : (
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>Aucun reçu. Ouvre un reçu ou une facture sur Vinted : il arrive ici.</div>
                )}
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button type="button" onClick={exportAnnualCsv} style={{flex:1,minWidth:120,padding:'9px 12px',borderRadius:12,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:13,fontWeight:500,cursor:'pointer'}}>⬇️ CSV (registre détaillé)</button>
                <button type="button" onClick={exportAnnualPdf} style={{flex:1,minWidth:120,padding:'9px 12px',borderRadius:12,border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accentTexte,fontSize:13,fontWeight:600,cursor:'pointer'}}>📄 PDF</button>
              </div>
              <div className="vrm-aide" style={{fontSize:11,color:C.muted,lineHeight:1.5,marginTop:12}}>Indicatif, pas un conseil comptable. Sans prix d'achat, bénéfice incomplet.</div>
            </div>
          </div>
        </div>/*⟦←/⟧*/);
}

// La branche {showWrapped && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleBilan({ v }) {
  const { setShowWrapped, setWrapStep, setWrappedMode, setWrappedMonth, setWrappedYear, wrapStep, wrapped } = v;
  return (/*⟦← App.jsx #v3⟧*/(()=>{
        const w = wrapped;
        const eur0 = n => `${Math.round(n).toLocaleString('fr-FR')}\u00a0€`;
        // On ne garde QUE les cartes qui ont une donnée réelle (pas d'invention).
        // (31 oct., Vitrine) Plus de dégradés multicolores ni de violet : chaque
        // carte est un APLAT — l'encre de Vitrine, et le cobalt (la seule couleur
        // d'accent) pour l'ouverture et la fin. Texte blanc (≥ 8:1 sur les deux).
        const FOND_ENCRE = MINERAL.text, FOND_ACCENT = MINERAL.accent;
        const cards = [];
        cards.push({ bg:FOND_ACCENT, body:(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.85)',fontWeight:600,letterSpacing:2,textTransform:'uppercase'}}>{w.mode==='month'?'Ton mois':'Ton année'}</div>
            <div style={{fontSize:w.mode==='month'?52:76,fontWeight:800,color:'#fff',letterSpacing:'-.03em',lineHeight:1.05}}>{w.mode==='month'?w.moisNoms[w.mo]:w.yr}</div>
            {w.mode==='month' && <div style={{fontSize:20,fontWeight:700,color:'rgba(255,255,255,0.9)'}}>{w.yr}</div>}
            <div style={{fontSize:15,color:'rgba(255,255,255,0.9)',fontWeight:500,marginTop:14}}>Prêt à revivre {w.mode==='month'?'ton mois':'ta saison'} ? 👉</div>
          </div>
        )});
        if(w.nb>0) cards.push({ bg:FOND_ENCRE, body:(
          <div style={{textAlign:'center'}}>
            <CountUp value={w.nb} style={{fontSize:96,fontWeight:800,color:'#fff',letterSpacing:'-.03em',lineHeight:1,display:'block'}}/>
            <div style={{fontSize:20,color:'#fff',fontWeight:600,marginTop:6}}>articles vendus</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.85)',marginTop:10}}>Chaque article, une petite victoire. 💪</div>
          </div>
        )});
        cards.push({ bg:FOND_ENCRE, body:(
          <div style={{textAlign:'center'}}>
            <CountUp value={w.ca} format={eur0} style={{fontSize:72,fontWeight:800,color:'#fff',letterSpacing:'-.03em',lineHeight:1,display:'block'}}/>
            <div style={{fontSize:20,color:'#fff',fontWeight:600,marginTop:8}}>de chiffre d'affaires</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.85)',marginTop:10}}>Prix de vente moyen : <b>{eur0(w.avg)}</b></div>
          </div>
        )});
        if(w.topBrand) cards.push({ bg:FOND_ENCRE, body:(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.85)',fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Ta marque star</div>
            <div style={{fontSize:52,fontWeight:800,color:'#fff',letterSpacing:-1,lineHeight:1.05,marginTop:6}}>{w.topBrand[0]}</div>
            <div style={{fontSize:17,color:'#fff',fontWeight:600,marginTop:10}}><CountUp value={w.topBrand[1]}/> articles vendus</div>
          </div>
        )});
        if(w.bestMonth) cards.push({ bg:FOND_ENCRE, body:(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.85)',fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Ton mois record</div>
            <div style={{fontSize:56,fontWeight:800,color:'#fff',letterSpacing:-1,lineHeight:1,marginTop:6}}>{w.bestMonth.nom}</div>
            <div style={{fontSize:20,color:'#fff',fontWeight:700,marginTop:10}}>{eur0(w.bestMonth.v)}</div>
          </div>
        )});
        if(w.bestPair) cards.push({ bg:FOND_ENCRE, body:(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.85)',fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>Article de l'année</div>
            <div style={{width:130,height:130,borderRadius:12,overflow:'hidden',margin:'14px auto',background:'rgba(255,255,255,0.10)',display:'flex',alignItems:'center',justifyContent:'center'}}>{w.bestPair.photo?<PhotoVinted src={w.bestPair.photo} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Icon name="image" size={40} style={{color:'rgba(255,255,255,0.6)'}}/>}</div>
            <div style={{fontSize:17,fontWeight:700,color:'#fff',padding:'0 20px',lineHeight:1.2}}>{w.bestPair.num?`N°${w.bestPair.num} · `:''}{w.bestPair.title}</div>
            <div style={{fontSize:22,fontWeight:800,color:'#fff',marginTop:8}}>+{eur0(w.bestPair.m)} de bénéfice</div>
          </div>
        )});
        if(w.fastest) cards.push({ bg:FOND_ENCRE, body:(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.85)',fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Vente éclair</div>
            <div style={{fontSize:76,fontWeight:800,color:'#fff',letterSpacing:'-.03em',lineHeight:1,marginTop:6}}><CountUp value={w.fastest.j}/> j</div>
            <div style={{fontSize:15,color:'#fff',fontWeight:500,marginTop:10,padding:'0 24px'}}>entre la mise en ligne et la vente{w.fastest.num?` · N°${w.fastest.num}`:''}</div>
          </div>
        )});
        if(w.streak>1) cards.push({ bg:FOND_ENCRE, body:(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.85)',fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Ta plus longue série</div>
            <div style={{fontSize:88,fontWeight:800,color:'#fff',letterSpacing:'-.03em',lineHeight:1,marginTop:6}}><CountUp value={w.streak}/></div>
            <div style={{fontSize:17,color:'#fff',fontWeight:600}}>jours d'affilée avec une vente</div>
          </div>
        )});
        cards.push({ bg:FOND_ACCENT, last:true, body:(
          <div style={{textAlign:'center',width:'100%'}}>
            <div style={{fontSize:28,fontWeight:800,color:'#fff',letterSpacing:-0.5}}>{(()=>{ /* (1er nov.) Le prénom DU vendeur (`vrm_prenom`, saisi par lui) ou rien — jamais celui d'un autre. */ const p=prenomLisible(load('vrm_prenom',''));return (w.mode==='month'?'Quel mois':'Quelle année')+(p?`, ${p}`:'')+' !';})()}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,margin:'18px 6px 0'}}>
              <div style={{background:'rgba(255,255,255,0.15)',borderRadius:12,padding:'12px 8px'}}><div style={{fontSize:22,fontWeight:800,color:'#fff'}}>{w.nb}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.85)'}}>articles vendus</div></div>
              <div style={{background:'rgba(255,255,255,0.15)',borderRadius:12,padding:'12px 8px'}}><div style={{fontSize:22,fontWeight:800,color:'#fff'}}>{eur0(w.ca)}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.85)'}}>de CA</div></div>
              {w.topBrand && <div style={{background:'rgba(255,255,255,0.15)',borderRadius:12,padding:'12px 8px'}}><div style={{fontSize:17,fontWeight:800,color:'#fff'}}>{w.topBrand[0]}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.85)'}}>marque star</div></div>}
              {w.bestMonth && <div style={{background:'rgba(255,255,255,0.15)',borderRadius:12,padding:'12px 8px'}}><div style={{fontSize:17,fontWeight:800,color:'#fff'}}>{w.bestMonth.nom}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.85)'}}>mois record</div></div>}
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.85)',marginTop:18,fontWeight:500}}>On remet ça l'année prochaine ? 👊</div>
          </div>
        )});
        const step = Math.min(wrapStep, cards.length-1);
        const cur = cards[step];
        const next = ()=>{ if(step>=cards.length-1) setShowWrapped(false); else setWrapStep(step+1); };
        const prev = ()=>{ if(step>0) setWrapStep(step-1); };
        if(w.nb===0){
          // ⚠️ createPortal vers document.body : sinon l'overlay est « piégé »
          // dans le contexte d'empilement de <main> et la barre du haut / du bas
          // passent PAR-DESSUS (peu importe le z-index). Le portail l'en sort.
          return createPortal(
            <div onClick={()=>setShowWrapped(false)} style={{position:"fixed",inset:0,zIndex:5000,background:FOND_ACCENT,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
              <div style={{textAlign:'center',color:'#fff'}}><div style={{fontSize:17,fontWeight:600,marginTop:10}}>Aucune vente finalisée · {w.periodLabel}.</div><div style={{fontSize:13,opacity:0.85,marginTop:6}}>{w.mode==='month'?'Choisis un autre mois en haut.':'Reviens plus tard pour ta rétrospective !'}</div></div>
            </div>, document.body);
        }
        return createPortal(
        <div style={{position:"fixed",inset:0,zIndex:5000,background:cur.bg,transition:'background .5s ease',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Barres de progression façon story */}
          <div style={{display:'flex',gap:4,padding:'calc(12px + env(safe-area-inset-top)) 12px 8px'}}>
            {cards.map((c,i)=>(<div key={i} style={{flex:1,height:3,borderRadius:12,background:'rgba(255,255,255,0.3)',overflow:'hidden'}}><div style={{height:'100%',width:i<step?'100%':i===step?'100%':'0%',background:'#fff',transformOrigin:'left',animation:i===step?'wrapBar 0.5s ease both':'none'}}/></div>))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'2px 16px 0'}}>
            <div style={{flex:1,fontSize:12,color:'rgba(255,255,255,0.9)',fontWeight:600}}>Rétrospective · {w.periodLabel}</div>
            {step===0 && (<>
              {/* Bascule Mois / Année (sur la carte d'intro). stopPropagation
                  pour ne pas déclencher le « touche pour continuer ». */}
              <div onClick={e=>e.stopPropagation()} style={{display:'flex',background:'rgba(255,255,255,0.2)',borderRadius:12,padding:2}}>
                {[['month','Mois'],['year','Année']].map(([m,lbl])=>(
                  <button key={m} type="button" onClick={()=>setWrappedMode(m)} style={{border:'none',borderRadius:12,padding:'5px 11px',fontSize:12,fontWeight:700,cursor:'pointer',background:w.mode===m?'#fff':'transparent',color:w.mode===m?FOND_ENCRE:'#fff'}}>{lbl}</button>
                ))}
              </div>
              {w.mode==='month' && (
                <select value={w.mo} onClick={e=>e.stopPropagation()} onChange={e=>setWrappedMonth(Number(e.target.value))} style={{border:'none',borderRadius:12,padding:'5px 8px',fontSize:12,fontWeight:700,background:'rgba(255,255,255,0.25)',color:'#fff',cursor:'pointer'}}>
                  {w.moisNoms.map((nm,i)=><option key={i} value={i} style={{color:'#111'}}>{nm}</option>)}
                </select>
              )}
              {w.mode==='year' && w.years.length>1 && (
                <select value={w.yr} onClick={e=>e.stopPropagation()} onChange={e=>setWrappedYear(Number(e.target.value))} style={{border:'none',borderRadius:12,padding:'5px 10px',fontSize:12,fontWeight:700,background:'rgba(255,255,255,0.25)',color:'#fff',cursor:'pointer'}}>
                  {w.years.map(y=><option key={y} value={y} style={{color:'#111'}}>{y}</option>)}
                </select>
              )}
            </>)}
            <button type="button" onClick={()=>setShowWrapped(false)} aria-label="Fermer" style={{border:'none',background:'rgba(255,255,255,0.22)',color:'#fff',width:32,height:32,borderRadius:12,fontSize:20,cursor:'pointer',lineHeight:1,flexShrink:0}}>×</button>
          </div>
          {/* Contenu de la carte + zones tactiles (gauche = précédent, droite = suivant) */}
          <div style={{flex:1,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 22px'}}>
            <div key={step} style={{width:'100%',maxWidth:460,animation:'wrapPop .45s cubic-bezier(.2,.7,.2,1) both'}}>{cur.body}</div>
            <div onClick={prev} style={{position:'absolute',left:0,top:0,bottom:0,width:'32%',cursor:'pointer'}} aria-label="Précédent"/>
            <div onClick={next} style={{position:'absolute',right:0,top:0,bottom:0,width:'68%',cursor:'pointer'}} aria-label="Suivant"/>
          </div>
          <div style={{textAlign:'center',padding:'0 0 calc(18px + env(safe-area-inset-bottom))',fontSize:12,color:'rgba(255,255,255,0.8)',fontWeight:500}}>{cur.last?'Touche pour fermer':'Touche pour continuer →'}</div>
        </div>, document.body);
      })()/*⟦←/⟧*/);
}

// La branche {repubAction && …} de Comptabilite, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function FeuilleRepublier({ v }) {
  const { brRefaire, brVinted, buyByNum, listedAgeDays, listings, noterPrix, numeros, refaireBrouillon, repubAction, repubCle, repubDepart, repubReprise, setNumeros, setRepubAction, setRepubCle, setRepubDepart, setRepubReprise } = v;
  return (/*⟦← App.jsx #v4⟧*/(()=>{
        // Ses paires EN LIGNE sur Vinted (la même liste que la grille, `listings.items`).
        const annoncesR = (listings.items||[]).filter(it=>it && it.id!=null).map(it=>{
          const e=numeros[it.id]||{}; const fl=prixAchatDe(e,buyByNum); const pr=(it.price&&typeof it.price==='object')?it.price.amount:it.price; const n=Number(String(pr==null?'':pr).replace(',','.'));
          const rc=Date.parse((e&&e.recreeAt)||'');
          return { id:String(it.id), numero:(e&&e.numero)?String(e.numero):'', key:String((e&&e.numero)||it.id), titre:it.title||'', prix:isFinite(n)&&n>0?n:null, floor:(fl!=null&&!isNaN(fl))?Number(fl):null, photo:photoArticle(it)||'', photos:(()=>{ const L=(Array.isArray(it.photosDetail)&&it.photosDetail.length?it.photosDetail:(Array.isArray(it.photos)&&it.photos.length?it.photos:[])).map(p=>typeof p==='string'?p:((p&&(p.full_size_url||p.url))||'')).filter(Boolean); const c=photoArticle(it); return L.length?L.slice(0,20):(c?[c]:[]); })(), uid:it._acc?String(it._acc.vinted_user_id||''):'', compte:it._acc?(it._acc.login||it._acc.username||''):'', favoris:Number.isFinite(it.favourites)?it.favourites:null, vues:Number.isFinite(it.views)?it.views:null, age:listedAgeDays(it), recreeAt:isFinite(rc)?rc:null,
            // (3 nov.) Pour « vérifier avant de republier » : ce que le dressing dit.
            nPhotos:Number.isFinite(it.photoCount)?it.photoCount:null, taille:it.size||'', marque:it.brand||'', famille:familleArticle({ titre:it.title, taille:it.size, marque:it.brand }).famille };
        });
        const vc = vintedDeChrome(); const etatX = vc && vc.uid ? vc.uid : null;
        // (28 oct.) Supprimer et RECRÉER (sa décision). Le N° VRM de l'ancienne
        // annonce passe sur la nouvelle dès que l'extension a lu son identifiant
        // (la nouvelle n'est donc jamais numérotée à neuf) ; l'ancienne fiche reste
        // (elle porte l'historique, sa suppression est notée : plus présente).
        const reporterNumero = (ancienId, nouvelId) => setNumeros(prev => {
          const e = prev[ancienId], cible=prev[nouvelId]||{}; if (!e || !nouvelId || (cible.numero&&String(cible.numero)!==String(e.numero))) return prev;
          const u = { ...prev, [nouvelId]: { ...e, ...cible, numero:cible.numero||e.numero, recreeDe: String(ancienId), recreeAt: new Date().toISOString() } };
          save('vinted_annonce_numeros', u); return u;
        });
        const publierR = async (a, v) => {
          if(!a.uid) return { etat:'echec', raison:'compte introuvable' };
          const r=await vmrCmdSuivi({ cmd:'recreerVinted', uid:a.uid, id:a.id, num:a.numero||undefined, reponses:v.reponses||undefined, prix:v.prix!=null?v.prix:undefined, titre:v.titre!=null?v.titre:undefined, plancher:a.floor, reglages:v.reglages, lettre:v.lettre||undefined, viaBrouillon:v.viaBrouillon===true, differer:v.viaBrouillon===true&&extSait('republierfile')==='ok', confirme:true }, 480000);
          if (r.sansReponse) { brRefaire.relire(); return { etat:'incertain', code:'sans-reponse', raison:TEXTE_SANS_REPONSE }; }
          if (r && r.accepte && r.nouvelId && (r.etape==='fait' || r.etape==='double')) reporterNumero(a.id, String(r.nouvelId));
          // (29 oct., « à la suite comme Vintex ») Mise en ligne PLANIFIÉE par l'extension :
          // la paire suivante part tout de suite ; le résultat arrive plus tard (`maj · repub · fin`).
          if (r && r.accepte && r.etape==='attente') {
            const f=(e)=>{ const d=e&&e.detail; if(!d||d.type!=='maj'||d.quoi!=='repub'||String(d.id)!==String(a.id)||d.etape!=='fin')return; window.removeEventListener('vrm:ext',f); const fin=d.fin||{}; if(fin.accepte&&fin.nouvelId&&(fin.etape==='fait'||fin.etape==='double'))reporterNumero(a.id,String(fin.nouvelId)); if(fin.refaire)brRefaire.relire(); };
            window.addEventListener('vrm:ext', f);
            return { etat:'planifiee', jusqua:Number(r.jusqua)||0, raison:'', nouveau:r.nouveau };
          }
          if (r && r.accepte && ['fait','double','incertain'].includes(r.etape)) return { etat:r.etape, raison:r.raison||'', nouveau:r.nouveau };
          if (r && r.accepte && r.refaire) { brRefaire.relire(); return { etat:'a-refaire', raison:r.raison||'', question:r.question||null }; }
          return { etat:'echec', code:(r&&r.code)||'', raison:(r&&(r.raison||r.error))||"l'extension n'a pas répondu", question:(r&&r.question)||null };
        };
        // (28 oct., 5.252) Modifier SUR PLACE : le PUT mesuré (`republierVinted`), le
        // prix et le titre EXACTS de l'aperçu ; jamais sous le prix d'achat.
        const publierModif = async (a, v) => {
          if(!a.uid) return { etat:'echec', raison:'compte introuvable' };
          const ownerPrix=AUTH.user?.id;
          const r=await vmrCmdSuivi({ cmd:'republierVinted', uid:a.uid, id:a.id, prix:v.prix!=null?v.prix:undefined, titre:v.titre!=null?v.titre:undefined, plancher:a.floor, confirme:true }, 60000);
          if (r.sansReponse) return { etat:'incertain', code:'sans-reponse', raison:TEXTE_SANS_REPONSE };
          if (r && r.accepte && r.etape==='fait') { if(ownerPrix&&AUTH.user?.id===ownerPrix)noterPrix(a,r); return { etat:'fait', nouveau:r.nouveau }; }
          return { etat:'echec', code:(r&&r.code)||'', raison:(r&&(r.raison||r.error))||"l'extension n'a pas répondu" };
        };
        // (28 oct., 5.252) En ligne → brouillon : la même recréation, arrêtée au
        // brouillon (`versBrouillon`) : enregistrée, retirée, PUIS le brouillon
        // créé (sa décision du 28 oct. au soir). Le N° reste sur l'ancienne fiche.
        const publierVersB = async (a, v) => {
          if(!a.uid) return { etat:'echec', raison:'compte introuvable' };
          const r=await vmrCmdSuivi({ cmd:'recreerVinted', uid:a.uid, id:a.id, num:a.numero||undefined, reponses:v.reponses||undefined, prix:v.prix!=null?v.prix:undefined, titre:v.titre!=null?v.titre:undefined, plancher:a.floor, reglages:v.reglages, lettre:v.lettre||undefined, versBrouillon:true, confirme:true }, 480000);
          if (r.sansReponse) { brRefaire.relire(); brVinted.relire(); return { etat:'incertain', code:'sans-reponse', raison:TEXTE_SANS_REPONSE+' (dans tes brouillons aussi)' }; }
          if (r && r.accepte && ['fait','double','incertain'].includes(r.etape)) { if (r.etape==='fait') brVinted.relire(); return { etat:r.etape, raison:r.raison||'' }; }
          if (r && r.accepte && r.refaire) { brRefaire.relire(); return { etat:'a-refaire', raison:r.raison||'', question:r.question||null }; }
          return { etat:'echec', code:(r&&r.code)||'', raison:(r&&(r.raison||r.error))||"l'extension n'a pas répondu", question:(r&&r.question)||null };
        };
        // (28 oct., 5.252) Brouillons → en ligne, à la suite : ses brouillons (la liste
        // de « Voir mes brouillons », §11) ; seuls ceux PRÊTS se cochent.
        const publierEnLigne = async (a) => {
          if(!a.uid) return { etat:'echec', raison:'compte introuvable' };
          const r=await avecCouleurBrouillon((couleur,reponses)=>vmrCmdSuivi({ cmd:'publierBrouillon', uid:a.uid, draftId:a.id, confirme:true, couleur, reponses }, 360000), a.titre||'');
          if (r.sansReponse) { brVinted.relire(); return { etat:'incertain', code:'sans-reponse', raison:TEXTE_SANS_REPONSE }; }
          if (r && r.accepte && r.etape==='fait') { brVinted.relire(); return { etat:'fait' }; }
          if (r && r.accepte && r.etape==='incertain') return { etat:'incertain', raison:r.raison||'' };
          return { etat:'echec', code:(r&&r.code)||'', raison:(r&&(r.raison||r.error))||"l'extension n'a pas répondu" };
        };
        const RAISON_BR = { inconnu:"VRM n'a pas encore son contenu : ouvre-le sur Vinted et enregistre-le une fois", incomplet:'incomplet — finis-le sur Vinted', publie:'déjà mis en ligne par VRM', lecture:'lecture…', passu:"VRM n'a pas pu lire ce qu'il sait de tes brouillons" };
        const annoncesBr = (brVinted.liste||[]).map(b=>{ const i=b._info; const p=i&&i.prix!=null&&i.prix!==''?Number(i.prix):Number(b.price&&typeof b.price==='object'?b.price.amount:b.price);
          return { id:String(b.id), numero:'', key:String(b.id), titre:(i&&i.titre)||b.title||'Brouillon sans titre', prix:p>0?p:null, floor:null, photo:b.photo||'', photos:b.photo?[b.photo]:[], uid:b._uid||'', compte:(b._acc&&(b._acc.login||b._acc.username))||'', favoris:null, vues:null, age:null, recreeAt:null,
            note: b._source==='extension' ? `enregistré il y a ${ilYaBr(b._enregistre)}` : Number.isFinite(b._vu) ? `vu sur Vinted il y a ${ilYaBr(b._vu)}` : '',
            // (2 nov.) LA règle des brouillons proposables (`_place`, src/brouillonsProposables.js) :
            // compte de Chrome, présence prouvée par une lecture complète et récente, contenu prêt.
            place: b._place||'a-verifier',
            bloque: b._place==='proposable' ? '' : b._place==='autre-compte' ? `brouillon du compte ${(b._acc&&(b._acc.login||b._acc.username))||b._uid||'inconnu'} — ouvre Vinted sur ce compte pour le mettre en ligne`
              : b._place==='compte-inconnu' ? `brouillon du compte ${(b._acc&&(b._acc.login||b._acc.username))||b._uid||'inconnu'} — ouvre Vinted sur ce compte ${NAV.dansNu} pour le mettre en ligne`
              : b._place==='pas-pret' ? (RAISON_BR[b._etat]||'pas prêt')
              : `à vérifier sur Vinted : pas de lecture complète et récente des brouillons de ${(b._acc&&(b._acc.login||b._acc.username))||'ce compte'} — ouvre ton dressing Vinted sur ce compte` }; });
        const fermer = ()=>{ setRepubAction(null); setRepubReprise(null); setRepubDepart(false); };
        const reessayer = (ids)=>{ setRepubReprise(ids.map(String)); setRepubDepart(false); setRepubCle(c=>c+1); };
        // (28 oct.) « Refaire le brouillon » sur la ligne ratée : la même commande que
        // la liste « Brouillons à refaire » (§11), l'annonce désignée par son identité.
        const refaireOk = extSait('refaire')==='ok';
        const refaireLigne = refaireOk ? async (a) => { const r = await refaireBrouillon({ uid:a.uid, id:a.id }); return r.etape==='fait' ? { etat:'fait', raison:r.raison||'' } : r.etape==='incertain' ? { etat:'incertain', raison:r.raison||'' } : r.refaire ? { etat:'a-refaire', raison:r.raison||'' } : { etat:'echec', raison:r.raison||'' }; } : null;
        if (repubAction==='enLigne') return <RepublierVinted key={"enLigne"+repubCle} action="enLigne" onReessayer={reessayer} reprise={repubReprise} depart={repubDepart?'envoi':null} annonces={annoncesBr} publier={publierEnLigne} compteChrome={etatX} compteVinted={vc} majExt={extSait('brouillon')!=='ok'} lettreOk={false} brouillonOk={extSait('brouillon')==='ok'} onClose={fermer} />;
        if (repubAction==='modifier') return <RepublierVinted key={"modifier"+repubCle} action="modifier" onReessayer={reessayer} reprise={repubReprise} depart={repubDepart?'modif':null} annonces={annoncesR} publier={publierModif} compteChrome={etatX} compteVinted={vc} majExt={extSait('republiermodif')!=='ok'} lettreOk={false} brouillonOk={false} onClose={fermer} />;
        if (repubAction==='versBrouillon') return <RepublierVinted key={"versBrouillon"+repubCle} action="versBrouillon" onReessayer={reessayer} reprise={repubReprise} depart={repubDepart?'modif':null} annonces={annoncesR} publier={publierVersB} refaire={refaireLigne} compteChrome={etatX} compteVinted={vc} majExt={extSait('versbrouillon')!=='ok'} lettreOk={extSait('lettre')==='ok'} brouillonOk={extSait('versbrouillon')==='ok'} onClose={fermer} />;
        return <RepublierVinted key={"recreer"+repubCle} onReessayer={reessayer} reprise={repubReprise} depart={repubDepart?'modif':null} annonces={annoncesR} publier={publierR} refaire={refaireLigne} compteChrome={etatX} compteVinted={vc} majExt={extSait('recreer')!=='ok'} lettreOk={extSait('lettre')==='ok'} brouillonOk={extSait('republierbrouillon')==='ok'} onClose={fermer} />;
      })()/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧
const RepublierVinted = aLaDemande(() => import('../ecrans/Republier.jsx').then((m) => ({ default: m.RepublierVinted })));
// ⟦← App.jsx #2⟧
// ══════════════════════════════════════════════════════════════════════════════
// CE QUE VINTED TRANSMET AUX IMPÔTS — LES SEUILS, COMPTE PAR COMPTE (6 octobre)
// ══════════════════════════════════════════════════════════════════════════════
// Chaque année, Vinted transmet aux impôts les vendeurs qui atteignent 30 ventes
// OU dépassent 2 000 € dans l'année civile (directive européenne DAC7). Mesuré le
// 6 octobre : trois de ses comptes y sont déjà (101 · 49 · 33 ventes finalisées
// en 2026, l'un à 3 721,10 €), et l'app n'en disait rien.
// ⚠️⚠️ LA PARTIE SÛRE EST LE CHIFFRE DU REGISTRE, ET RIEN D'AUTRE (revue du
//    6 octobre). Le premier jet rattachait à l'année, COMME SÛRES, des ventes
//    sans date de versement (deux bornes dans la même année) — et la carte
//    disait « pour qu'il n'y ait jamais d'écart avec ce que tu déclares ».
//    Mesuré sur sa base : carte 245 ventes · 9 361 € contre registre 141 ·
//    5 226 € ; julatace35260 101 contre 42. Une phrase vraie sur un chiffre
//    faux (§5). Désormais, par compte, et les DEUX parties viennent du registre
//    annuel lui-même (`declRapport`, §11 : une notion, un propriétaire — la
//    carte ne rappelle jamais `ventesDeclarables` de son côté) :
//      · `n`/`cts` = ses ventes Vinted COMPTÉES par le registre dans l'année
//        (`datees` : le mois de sa déclaration s'il l'a notée, sinon celui du
//        versement) — exactement le chiffre du registre, passé tel quel ;
//      · `nAd`/`ctsAd` = ses ventes finalisées PAS ENCORE DATÉES (`aDater`, la
//        liste du registre), rattachées à l'année par une ESTIMATION (le
//        versement suit la vente — 0 sur 173 avant elle — et la suit de près :
//        au plus 25 jours mesurés, d'où `VERSEMENT_MAX_J`). Elles ne rejoignent
//        JAMAIS la partie sûre ;
//      · le verdict n'est « atteint » que sur la partie sûre ; « atteintSi »
//        quand il ne l'est qu'en ajoutant les pas encore datées.
// ⚠️ TROIS ÉTATS : `enCours` (le registre n'est pas encore calculé : `datees`
//    vaut `undefined`) · `pasSu` (la lecture des ventes de CE compte a échoué —
//    jugée par son IDENTITÉ, jamais par son nom affiché — ou le registre n'a pas
//    pu dater les ventes Vinted : `datees` vaut `null` ; un tiret, jamais 0) ·
//    `lu`. Un compte exclu de l'app n'y entre pas (décision du 3 octobre).
// ⚠️ VRM NE SAIT PAS si Vinted juge chaque compte à part ou additionne ceux
//    d'une même personne : `total` additionne les comptes sélectionnés, dit
//    comme tel. Un compte pas lu ⇒ total « au moins », et jamais « sous les
//    seuils » (les ventes qui manquent pourraient l'y faire passer).
// ⚠️ « Plus de 2 000 € » : 2 000,00 € pile ne l'atteint pas. Comparé en
//    centimes entiers, jamais en flottants.
// ⚠️ L'ANNÉE suit le fuseau de l'appareil (`getFullYear`), comme le registre et
//    `ventesDeclarables` : une vente versée le 1er janvier à 00 h 20 (Paris)
//    compte dans l'année d'avant sur un téléphone réglé à Londres. Constaté,
//    laissé tel quel : changer ici seul ferait diverger la carte du registre.
const SEUIL_VINTED_VENTES = 30;
const SEUIL_VINTED_EUR = 2000;
const VERSEMENT_MAX_J = 45;
const seuilVintedAtteint = (n, cts) => n >= SEUIL_VINTED_VENTES || cts > SEUIL_VINTED_EUR * 100;
const seuilsVintedParCompte = ({ comptes, ecarte, echoues, datees, aDater, annee, maintenant = Date.now() } = {}) => {
  const anneeDe = (t) => new Date(t).getFullYear();
  const uidDe = (o) => String((o && o._acc && o._acc.vinted_user_id) ?? '');
  // Le registre : `undefined` pas encore calculé · `null` pas su · un objet lu.
  const lu = !!datees && typeof datees === 'object';
  const ko = (uid) => !!(echoues && echoues.has(uid));
  const parUid = {}, liste = [];
  for (const c of (comptes || [])) {
    const uid = String((c && c.uid) ?? '');
    if (!uid || parUid[uid] || (ecarte && ecarte(uid))) continue;
    // Une lecture ratée de CE compte se sait tout de suite, même registre en cours.
    const etat = ko(uid) ? 'pasSu' : lu ? 'lu' : datees === null ? 'pasSu' : 'enCours';
    const raison = etat !== 'pasSu' ? null : ko(uid) ? 'ventes' : 'versements';
    const q = (etat === 'lu' && datees[uid]) || {};
    const n = etat === 'lu' ? (Number(q.n) || 0) : 0;
    const cts = etat === 'lu' ? Math.round(Number(q.cts) || 0) : 0;
    const r = { uid, nom: (c && c.nom) || uid, etat, raison, n, cts, nAd: 0, ctsAd: 0 };
    parUid[uid] = r; liste.push(r);
  }
  if (lu) {
    for (const l of (Array.isArray(aDater) ? aDater : [])) {
      if (!l || l.plateforme !== 'Vinted') continue;
      const r = parUid[uidDe(l.o)]; if (!r || r.etat !== 'lu') continue;
      const t = tsCommande(l.o);
      const yMin = t ? anneeDe(t) : -Infinity;                                       // le versement suit la vente…
      const yMax = anneeDe(t ? Math.min(maintenant, t + VERSEMENT_MAX_J * 86400e3) : maintenant);   // …et la suit de près (estimation)
      if (annee < yMin || annee > yMax) continue;
      const c = Math.round(Number(l.eur) * 100); if (!isFinite(c)) continue;
      r.nAd += 1; r.ctsAd += c;
    }
  }
  const aCeJour = anneeDe(maintenant) === annee;     // l'année n'est pas finie : « à ce jour »
  const juge = (r, jugeable = true) => {
    r.eur = r.cts / 100; r.eurAd = r.ctsAd / 100;
    r.verdict = r.etat !== 'lu' ? null
      : seuilVintedAtteint(r.n, r.cts) ? 'atteint'
      : seuilVintedAtteint(r.n + r.nAd, r.cts + r.ctsAd) ? 'atteintSi'
      : jugeable ? 'sous' : null;
    // Ce qu'il reste avant le seuil, sur la partie SÛRE (datée) : 30 ventes, ou
    // un centime de plus que 2 000 €.
    r.reste = (r.verdict === 'sous' || r.verdict === 'atteintSi')
      ? { n: Math.max(0, SEUIL_VINTED_VENTES - r.n), cts: Math.max(0, SEUIL_VINTED_EUR * 100 + 1 - r.cts) } : null;
  };
  for (const r of liste) juge(r);
  const lus = liste.filter(r => r.etat === 'lu');
  const manquants = liste.filter(r => r.etat !== 'lu').map(r => r.uid);
  const total = {
    etat: lus.length ? 'lu' : (liste.some(r => r.etat === 'enCours') ? 'enCours' : 'pasSu'),
    manquants, partiel: lus.length > 0 && manquants.length > 0,
    n: lus.reduce((s, r) => s + r.n, 0), cts: lus.reduce((s, r) => s + r.cts, 0),
    nAd: lus.reduce((s, r) => s + r.nAd, 0), ctsAd: lus.reduce((s, r) => s + r.ctsAd, 0),
  };
  juge(total, !total.partiel);
  if (total.partiel) total.reste = null;
  return { comptes: liste, total, aCeJour };
};
// ⟦← App.jsx #3⟧
const SERIE_MAX_MS = 30 * 60 * 1000;
const serieDeclActive = () => SERIE_DECLARATION.liste.length > 0 && Date.now() - SERIE_DECLARATION.at < SERIE_MAX_MS;
const finirSerieDecl = () => { SERIE_DECLARATION.liste = []; SERIE_DECLARATION.total = 0; SERIE_DECLARATION.at = 0; };
// ⟦→ ecrans/Compta.jsx #17⟧
// Le mois suivant de la série, une fois `ym` noté ou passé (null : fini).
const suivantSerieDecl = (ym) => {
  if (!serieDeclActive()) { finirSerieDecl(); return null; }
  SERIE_DECLARATION.liste = SERIE_DECLARATION.liste.filter((m) => m !== ym);
  SERIE_DECLARATION.at = Date.now();
  if (!SERIE_DECLARATION.liste.length) { finirSerieDecl(); return null; }
  return SERIE_DECLARATION.liste[0];
};
// ⟦← App.jsx #4⟧
// ⟦→ coeur/VueAnnonces.jsx #9⟧
// Pourquoi « J'ai déclaré ce mois » ne s'enregistre pas (revue du 6 octobre) :
// ce qui a ÉCHOUÉ et le geste, ou ce qui se lit ENCORE. `manque` vient de
// `lectureIncomplete` (§11 : la même règle grise le bouton et arrête le geste).
// `refus` = le geste vient d'être refusé (la lecture est tombée pendant que le
// formulaire était ouvert) : on dit que RIEN n'est noté.
function RaisonDeclBloquee({ manque, refus = false }) {
  if (!manque) return null;
  const rates = manque.rates || [], enCours = manque.enCours || [];
  return (
    <div data-decl-bloque="" {...(refus ? { 'data-decl-refus': '' } : {})} style={{fontSize:12,color:rates.length?C.warn:C.muted,lineHeight:1.45}}>
      {refus && <b>Rien n'est noté. </b>}
      {rates.length
        ? <>Je n'ai pas pu lire {rates.join(', ')} : je ne note pas ta déclaration sur une liste incomplète — ce qui manquerait passerait ensuite « à régulariser ». Rouvre le rapport dans un moment.</>
        : <>Lecture en cours ({enCours.join(', ')}) : le bouton s'active dès que tout est lu.</>}
    </div>
  );
}
// ⟦← App.jsx #5⟧

// ── CE QUE VINTED TRANSMET AUX IMPÔTS, compte par compte (6 octobre) ─────────
// La carte du registre annuel. Elle ne calcule RIEN : elle rend
// `seuilsVintedParCompte` (§11), et ses deux parties viennent du REGISTRE
// (`datees` et `aDater`, calculés par lui). Ton informatif : aucun rouge, aucun ambre (§7 —
// le rouge est pour deux paires sous un même numéro) ; un seuil atteint se dit
// par le MOT, en gras. Les nombres sont portés en `data-*` pour le banc.
// ⚠️ §7 : une cause, une phrase. La panne, la lecture en cours et l'estimation
//    des ventes pas encore datées se disent UNE fois au-dessus des lignes ; la
//    ligne d'un compte pas lu ne porte qu'un « — ».
// ⚠️ « Relire mes ventes » RELIT pour de vrai (`onRelire` vide le cache et
//    relance la lecture) : « rouvre l'écran Ventes » rouvrait le CACHE, qui
//    gardait l'échec — ou, avant la revue, le transformait en « 0 vente ».
function CarteSeuilsVinted({ annee, echoues, comptes, ecarte, nomDe, datees, aDater, onRelire }) {
  const [relit, setRelit] = useState(false);
  const tous = Array.isArray(comptes) ? comptes : [];
  const ko = new Set((Array.isArray(echoues) ? echoues : []).map(String));
  const R = seuilsVintedParCompte({ comptes: tous.map(a => ({ uid: a.vinted_user_id, nom: nomDe(a) })), ecarte, echoues: ko, datees, aDater, annee });
  const lignes = R.comptes;
  if (!lignes.length) return null;
  const nExclus = tous.filter(a => ecarte && ecarte(String(a.vinted_user_id))).length;
  const eur = (v) => Number(v).toFixed(2).replace('.', ',') + ' €';
  const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const seuilEur = String(SEUIL_VINTED_EUR).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  const nomsDe = (uids) => uids.map(u => (lignes.find(r => r.uid === u) || {}).nom || u).join(', ');
  const avecTotal = lignes.length > 1;
  const verdictTxt = (r, ses) => {
    if (r.verdict === 'atteint') {
      const parN = r.n >= SEUIL_VINTED_VENTES, parE = r.cts > SEUIL_VINTED_EUR * 100;
      return `Seuil atteint : ${parN && parE ? `${SEUIL_VINTED_VENTES} ventes et plus de ${seuilEur}` : parN ? `${SEUIL_VINTED_VENTES} ventes` : `plus de ${seuilEur}`}.`;
    }
    if (r.verdict === 'atteintSi') return `Seuil atteint si ${r.nAd > 1 ? `${ses} ${r.nAd} ventes pas encore datées comptent` : `${ses === 'ses' ? 'sa' : 'la'} vente pas encore datée compte`} en ${annee} (${eur(r.eurAd)}).`;
    if (r.verdict === 'sous') return R.aCeJour ? `Sous les seuils à ce jour : encore ${pl(r.reste.n, 'vente')} ou ${eur(r.reste.cts / 100)} avant le seuil.` : 'Sous les seuils.';
    return '';
  };
  const aDaterTxt = (r) => (r.etat === 'lu' && r.nAd > 0 && r.verdict !== 'atteintSi') ? `+ ${pl(r.nAd, 'vente')} pas encore datée${r.nAd > 1 ? 's' : ''} (${eur(r.eurAd)})` : '';
  const pasLus = lignes.filter(r => r.etat === 'pasSu');
  const parVersements = pasLus.some(r => r.raison === 'versements');
  const ventesKO = pasLus.filter(r => r.raison === 'ventes');
  const enCours = lignes.some(r => r.etat === 'enCours');
  const estimation = lignes.some(r => r.etat === 'lu' && r.nAd > 0);
  const relire = async () => { if (relit || !onRelire) return; setRelit(true); try { await onRelire(); } catch (_) {} setRelit(false); };
  const ligne = (r, { total } = {}) => {
    const lu = r.etat === 'lu';
    const sous = lu ? verdictTxt(r, total ? 'les' : 'ses') : '';
    const plus = aDaterTxt(r);
    const attrs = total
      ? { 'data-seuils-total': annee, 'data-partiel': r.partiel ? r.manquants.join(',') : '' }
      : { 'data-seuil-compte': r.uid };
    return (
      <div key={total ? '_total' : r.uid} {...attrs} data-etat={r.etat} data-n={lu ? r.n : ''} data-eur={lu ? r.eur.toFixed(2) : ''} data-verdict={r.verdict || ''}
        data-adater={lu ? r.nAd : ''} data-eur-adater={lu ? r.eurAd.toFixed(2) : ''} data-reste-n={r.reste ? r.reste.n : ''} data-reste-eur={r.reste ? (r.reste.cts / 100).toFixed(2) : ''}
        style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderTop:`${total ? 2 : 1}px solid ${C.border}`}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:total?700:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:total?'normal':'nowrap'}}>
            {total ? `Tous tes comptes ensemble${r.partiel ? ` · sans ${nomsDe(r.manquants)}` : ''}` : r.nom}
          </div>
          {sous && <div style={{fontSize:12,lineHeight:1.4,marginTop:2,color:r.verdict==='atteint'?C.text:C.muted,fontWeight:r.verdict==='atteint'?700:400}}>{sous}</div>}
          {plus && <div style={{fontSize:11,color:C.muted,lineHeight:1.4,marginTop:2}}>{plus}</div>}
        </div>
        <div style={{flexShrink:0,textAlign:'right',whiteSpace:'nowrap'}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{lu ? `${r.partiel ? 'au moins ' : ''}${pl(r.n, 'vente')}` : '—'}</div>
          {lu && <div style={{fontSize:12,color:C.muted,marginTop:2}}>{eur(r.eur)}</div>}
        </div>
      </div>
    );
  };
  return (
    <div data-seuils-vinted={annee} data-a-ce-jour={R.aCeJour ? '1' : '0'} style={{border:`1px solid ${C.border}`,borderRadius:12,background:C.card,padding:'10px 12px',marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>Ce que Vinted transmet aux impôts pour {annee}{R.aCeJour ? ' — à ce jour' : ''}</div>
      <div style={{fontSize:12,color:C.muted,lineHeight:1.45,marginBottom:8}}>
        Chaque année, Vinted transmet aux impôts les vendeurs qui font au moins {SEUIL_VINTED_VENTES} ventes ou plus de {seuilEur} dans l'année (directive européenne DAC7).
        {' '}Ici, tes ventes Vinted comptées dans ce registre{avecTotal ? <>, compte par compte puis tous ensemble : VRM ne sait pas si Vinted juge chaque compte à part ou additionne ceux d'une même personne.</> : '.'}
      </div>
      {estimation && (
        <div data-seuils-estimation style={{fontSize:11,color:C.muted,lineHeight:1.45,marginBottom:8}}>
          « Pas encore datées » : des ventes finalisées dont VRM n'a pas encore la date de versement. Elles sont rattachées à {annee} d'après leur date de vente — une estimation (Vinted verse en général dans les jours qui suivent), pas un chiffre du registre.
        </div>
      )}
      {enCours && <div data-seuils-encours style={{fontSize:12,color:C.muted,lineHeight:1.45,marginBottom:8}}>Lecture des ventes…</div>}
      {pasLus.length > 0 && (
        <div data-seuils-panne style={{display:'flex',alignItems:'flex-start',gap:10,flexWrap:'wrap',fontSize:12,color:C.text,lineHeight:1.45,marginBottom:8}}>
          <div style={{flex:'1 1 220px',minWidth:0}}>
            {parVersements
              ? "Les dates de versement de tes ventes Vinted n'ont pas pu être lues : impossible de dire où en sont tes comptes."
              : ventesKO.length === 1
                ? `Les ventes de ${ventesKO[0].nom} n'ont pas pu être lues : impossible de dire où en est ce compte.`
                : `Les ventes de ${ventesKO.length} comptes (${ventesKO.map(r => r.nom).join(', ')}) n'ont pas pu être lues : impossible de dire où ils en sont.`}
          </div>
          {onRelire && (
            <button type="button" data-relire-ventes onClick={relire} disabled={relit}
              style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:12,background:'transparent',color:C.text,cursor:relit?'default':'pointer',fontSize:12,fontWeight:600,padding:'5px 11px',maxWidth:200,opacity:relit?0.6:1}}>
              {relit ? 'Lecture…' : 'Relire mes ventes'}
            </button>
          )}
        </div>
      )}
      {lignes.map(r => ligne(r))}
      {avecTotal && ligne(R.total, { total: true })}
      {nExclus > 0 && <div className="vrm-aide" style={{fontSize:11,color:C.muted,lineHeight:1.4,marginTop:4}}>Les comptes que tu as exclus de l'app ne sont pas comptés ici.</div>}
    </div>
  );
}
// ⟦← App.jsx #6⟧
// ⟦→ ecrans/Stats.jsx #10⟧

function CountUp({ value, format, duration = 950, style }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const to = Number(value) || 0; let raf; const start = (typeof performance!=='undefined'?performance.now():Date.now());
    const tick = (t) => { const now = t || (typeof performance!=='undefined'?performance.now():Date.now()); const p = Math.min(1, (now - start) / duration); const e = 1 - Math.pow(1 - p, 3); setN(to * e); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [value, duration]);
  return <span style={style}>{format ? format(n) : Math.round(n).toLocaleString('fr-FR')}</span>;
}
// ⟦← App.jsx #7⟧
// Barre de chargement fine en haut de l'écran (façon navigateur). Elle avance
// vite au début puis ralentit — on ne peut pas connaître l'avancement réel de
// requêtes multiples, donc on donne une progression PLAUSIBLE plutôt qu'un
// pourcentage inventé, et on termine à 100 % d'un coup quand tout est fini.
// En-tête d'écran : un titre + UNE ligne qui dit à quoi sert l'écran. Compact
// (l'app est déjà dense), mais ça enlève toute ambiguïté sur ce qu'on regarde —
// indispensable pour quelqu'un qui découvre l'app.
// État vide soigné : une icône, une phrase qui explique POURQUOI c'est vide, et
// quand c'est possible une action. Un simple texte gris laisse l'utilisateur se
// demander si l'app est cassée ou s'il n'a vraiment rien.
// ── FILTRER PAR PÉRIODE (ventes / achats) ──────────────────────────────────
// Demande de Julien : « trier par mois, par jour, par semaine — appuyer comme
// sur Airbnb, du 12 juillet au 23 août — sinon un filtre par mois pour ma
// déclaration ». Deux entrées donc : des raccourcis d'un tap pour le quotidien
// et la déclaration, un calendrier début→fin pour une plage précise.
const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];