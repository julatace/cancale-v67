// ⚠️ FICHIER DÉCOUPÉ D'App.jsx (scripts/decouper-app.cjs) — chargé à la demande.
// Le code ci-dessous est celui d'App.jsx, sans changement ; ce qu'il lit d'App.jsx
// vient de l'import ci-dessous (liaisons vivantes : le thème `C` reste à jour).
import React, { useState, useMemo, useEffect } from "react";
import { Btn, C, Card, DEMANDE_SAISIE_PRIX, DayWeekNote, ENTREPRISE_VIDE, FermeAuRetour, FraicheurAnnonces, INV_STATUS, Icon, Input, PhotoVinted, ScreenHead, StatBox, TOTAL_SLOTS, aPayerUrssaf, annotateAndDownloadBordereau, askConfirm, caParPlateforme, classifyOrderStatus, compteEcarte, entForInvoice, extractPairNumber, fetchHarvest, fetchVintedListings, fetchVintedOrders, fmt, fmtN, generatePDF, getISOWeekKey, lireExtrasRepartition, load, netApresUrssafDe, nomPays, normTitle, orderPhoto, repartitionsVentes, save, tauxUrssaf, texteEnLigne, toast, tod, uid, useVentesCoque } from "../App.jsx";


/* ── Editable cell ───────────────────────────────────── */
function Cell({value, onChange, align="left", mono=false}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const commit = () => { setEditing(false); if(String(val)!==String(value)) onChange(val); };
  if(editing) return (
    <input autoFocus value={val}
      onChange={e=>setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){setVal(value);setEditing(false);}}}
      style={{background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,
        color:C.text,padding:'3px 6px',fontSize:12,fontFamily:'inherit',
        width:'100%',boxSizing:'border-box',textAlign:align,outline:'none'}}
    />
  );
  return (
    <span onClick={()=>{setVal(value);setEditing(true);}} title="Cliquer pour modifier"
      style={{cursor:'text',display:'block',padding:'3px 6px',borderRadius:8,minHeight:22,
        textAlign:align,fontFamily:mono?'monospace':'inherit'}}
      onMouseEnter={e=>e.currentTarget.style.background=C.bg}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >{value||<span style={{color:C.muted,fontSize:11}}>—</span>}</span>
  );
}
function Badge({children,color}) {
  const tone = color || C.muted;
  return <span className="vrm-badge" style={{background:`color-mix(in srgb, ${tone} 10%, ${C.card})`,color:tone}}>{children}</span>;
}

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
function CourbeMois({ mois, valeur = (m) => m.eur, format = (v) => `${Math.round(v).toLocaleString('fr-FR')} €`, hauteur = 176, choisi = null, onChoisir = null, attr = 'data-courbe-mois', legende = true }) {
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
      <defs><linearGradient id={`bars${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.accent}/><stop offset="1" stopColor={C.accent} stopOpacity=".65"/></linearGradient></defs>
      {[0,.5,1].map(f=><line key={f} x1={left} x2={W-right} y1={Y(max*f)} y2={Y(max*f)} stroke={C.border} strokeWidth="1" strokeDasharray={f?'3 5':undefined}/>)}
      {mois.map((m,i)=>{const cle=cleDe(m),actif=i===lu,bar=Math.max(2,Math.min(compact?22:34,col*.55));const label=`${m.long||m.nomComplet||cle} · ${format(vals[i])}${m.enCours?' (en cours)':''}`;return <g key={cle} data-mois={cle} data-valeur={Math.round(vals[i]*100)} role="button" tabIndex="0" aria-label={label} aria-pressed={actif} className="vrm-chart-month" onClick={()=>choisir(m,i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choisir(m,i);}}}>
        <title>{label}</title>
        {actif&&<rect x={X(i)-col/2+2} y="2" width={Math.max(1,col-4)} height={H-2} rx="6" fill={C.bg}/>}
        <rect x={X(i)-col/2} y="0" width={col} height={H} fill="transparent"/>
        <rect data-month-bar="" x={X(i)-bar/2} y={Y(vals[i])} width={bar} height={Math.max(1,base-Y(vals[i]))} rx="3" fill={`url(#bars${uid})`} opacity={actif||i===meilleur?1:m.enCours?.45:.65}/>
        {(i%pas===0||i===n-1)&&<text x={X(i)} y={H-8} textAnchor="middle" fontSize="11" fontWeight={actif?600:400} fill={actif?C.text:C.muted}>{court(m)}</text>}
      </g>;})}
    </svg>
    {legende && <div className="vrm-chart-caption" data-chart-caption=""><span>{mois[lu].long||mois[lu].nomComplet||cleDe(mois[lu])}{mois[lu].enCours?' · en cours':''}</span><strong>{format(vals[lu])}</strong></div>}
    {legende && lu>0 && <div className="vrm-chart-compare" data-chart-compare=""><span>Précédent · {mois[lu-1].long||mois[lu-1].nomComplet||cleDe(mois[lu-1])}{mois[lu].enCours?' · mois complet':''}</span><strong>{format(vals[lu-1])}</strong></div>}
  </div>;
}


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
    <div style={{marginTop:16,padding:14,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>{mois.nomComplet} — {ventes.length} vente{ventes.length>1?'s':''}</span>
        <span onClick={onClose} style={{cursor:'pointer',color:C.muted,fontSize:20,fontWeight:500,lineHeight:1}}>×</span>
      </div>
      <div style={{display:'flex',gap:16,marginBottom:12,fontSize:12}}>
        <span style={{color:C.text}}>CA : <b>{fmt(totalCA)}</b></span>
        <span style={{color:C.accent}}>Bénéfice : <b>{fmt(totalProfit)}</b></span>
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

// (17 oct.) L'écran « Collectif » est retiré — Julien : « il ne sert à rien, il
// est déjà représenté dans les statistiques ». `?tab=collectif` mène aux
// Statistiques (`ONGLETS_DEPLACES`).
function Dashboard({catalog,sales,garageGrid,invoices,liveStats,onGo,actions,baseKO,premierJour,lbcVentes={ventes:[],inconnues:0},ebayCa=null,panelOff=null}) {
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

  const [objectif,setObjectif]=useState(()=>+(load('vrm_ca_objectif',0))||0); // objectif de CA du mois
  const [objEdit,setObjEdit]=useState(false);
  const [objTmp,setObjTmp]=useState('');

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
  const stockValue=useMemo(()=>garageVals.reduce((s,id)=>s+(catMap[id]||0),0),[garageVals,catMap]);
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
  const monthKey=new Date().toISOString().slice(0,7);
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
  const caRange=useMemo(()=>{
    if(!caDu && !caAu) return null;
    const toNum=(iso)=> iso ? parseInt(iso.replace(/-/g,''),10) : null;   // YYYY-MM-DD → YYYYMMDD
    const from=toNum(caDu), to=toNum(caAu);
    let ca=0, count=0;
    sales.forEach(v=>{
      const p=(v.saleDate||'').trim().split('/');
      if(p.length!==3) return;
      const n=parseInt(p[2]+p[1].padStart(2,'0')+p[0].padStart(2,'0'),10);  // AAAAMMJJ
      if(!Number.isFinite(n)) return;
      if(from!=null && n<from) return;
      if(to!=null && n>to) return;
      ca+=+v.sellPrice||0; count++;
    });
    return {ca,count};
  },[sales,caDu,caAu]);

  // ── GRAPHIQUES « épuré / haut de gamme » (Julien, 28 sept.) : une seule teinte
  //    d'accent, variée par OPACITÉ fixée par plateforme (jamais par rang, §7 +
  //    dataviz), et l'identité portée par les libellés — pas par la couleur seule.
  // Anneau par plateforme — CONSOMME caParPlateforme (§11), ne recalcule rien.
  const platParts=useMemo(()=>{
    const arr=caParPlateforme(liveStats,lbcVentes,ebayCa).filter(p=>p.ca!=null && p.ca>0)
      .map(p=>({nom:p.nom, court:p.nom==='Vestiaire Collective'?'Vestiaire':p.nom, ca:p.ca}));
    const total=arr.reduce((s,p)=>s+p.ca,0);
    return {arr,total};
  },[liveStats,lbcVentes,ebayCa]);
  // CA du mois courant (par date de VENTE, §5) pour la jauge d'objectif.
  // ⚠️ Elle sommait l'ANCIENNE archive (`sales`, vide depuis juillet 2026) : la
  //    jauge restait à 0 € quoi qu'il vende. Elle lit maintenant « vendu ce
  //    mois », la règle de Ma journée (`liveStats.caMois`, §11) ; l'archive ne
  //    sert plus qu'en repli tant que les ventes ne sont pas lues.
  const caMoisCourant=useMemo(()=>{
    if (liveStats && liveStats.caMois!=null) return liveStats.caMois;
    if (liveStats && liveStats.venduPasSu) return null;     // pas su : jamais l'archive vide (0 €)
    const now=new Date(); const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return sales.reduce((s,v)=>{ const p=(v.saleDate||'').trim().split('/'); return (p.length===3 && `${p[2]}-${p[1]}`===ym) ? s+(+v.sellPrice||0) : s; },0);
  },[sales, liveStats]);

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
  const stockInconnu = !!(liveStats && liveStats.online > 0
    && !((liveStats.stockValue != null ? liveStats.stockValue : stockValue) > 0));
  const quoiDepuisDebut = stockInconnu
    ? 'La valeur du stock, le bénéfice et la marge'
    : 'Le bénéfice et la marge';
  // (16 oct., passe « premium ») : un LIEN discret, pas une ligne orange — la
  // cause est dite une fois par groupe, et le geste est le lien lui-même.
  const LignePrixAchat = ({ quoi, dans = false }) => (
    <button type="button" onClick={versSaisiePrix}
      title="Ouvrir la saisie en série des prix d'achat"
      style={{alignSelf:'flex-start',border:'none',background:'transparent',padding:0,margin:dans?0:'-4px 0 0',cursor:'pointer',
        fontFamily:'inherit',fontSize:13,fontWeight:500,color:C.muted,textAlign:'left',minHeight:0,lineHeight:1.45}}>
      {quoi} attendent tes prix d'achat — <span style={{color:C.accent,fontWeight:600,whiteSpace:'nowrap'}}>les saisir →</span>
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
    <div className="vrm-finance-page" style={{padding:16,display:'flex',flexDirection:'column',gap:18}}>
      <div>
        <h2 style={{margin:0,color:C.text,fontSize:28,fontWeight:600,letterSpacing:-0.5}}>Statistiques</h2>
        <div style={{fontSize:13,color:C.muted,marginTop:2}}>Tes ventes, ton évolution, tes résultats</div>
      </div>

      {/* Stats principales — priorité aux valeurs Vinted en direct (liveStats) :
          Paires en stock = nb de numéros étiquetés au garage · Valeur du stock =
          Σ prix d'achat des annonces en ligne · CA = ventes finalisées, tous comptes.
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
        <div className="vrm-display" style={{...sHero,fontSize:28,marginTop:6}}>{fmt(liveStats&&liveStats.caEncaisse!=null?liveStats.caEncaisse:ca)}</div>
        <div style={{...sNote,marginTop:6}}>Ventes finalisées, Vinted seul (tous comptes) · au jour de la vente · Leboncoin et eBay sont dans « Finalisé par plateforme »</div>
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
          {[['Bénéfice estimé', liveStats&&liveStats.caEncaisse!=null?'—':fmt(profit), liveStats&&liveStats.caEncaisse!=null?null:'argent reçu uniquement'],
            ['Taux marge', (liveStats&&liveStats.caEncaisse!=null)||avgMargin===null?'—':`${avgMargin}%`, liveStats&&liveStats.caEncaisse!=null?null:(avgMargin===null?'dès ta première vente':'bénéf / CA')]].map(([l,v,sub],i)=>(
            <div key={l} style={{padding:'12px 0 0',paddingLeft:i?16:0,borderLeft:i?`1px solid ${C.border}`:'none',minWidth:0}}>
              <div style={sLib}>{l}</div>
              <div className="vrm-display" style={{...sHero,fontSize:20,letterSpacing:-0.4,marginTop:4,color:v==='—'?C.muted:C.text}}>{v}</div>
              {sub && <div style={{...sNote,fontSize:11,marginTop:2}}>{sub}</div>}
            </div>
          ))}
        </div>
        {manquePrix && <div style={{marginTop:14}}><LignePrixAchat quoi={quoiDepuisDebut} dans/></div>}
      </div>
      {/* 🎯 OBJECTIF DU MOIS — jauge vers un objectif de CA que tu fixes. */}
      <div className="vrm-finance-goal"><Card>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:objectif>0&&!objEdit?8:2}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>Objectif du mois</div>
          <button type="button" onClick={()=>{ setObjTmp(objectif>0?String(objectif):''); setObjEdit(e=>!e); }} style={{border:`1px solid ${C.border}`,background:'transparent',color:C.muted,borderRadius:8,padding:'6px 11px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{objEdit?'Annuler':(objectif>0?'Modifier':'Fixer')}</button>
        </div>
        {objEdit ? (
          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <input aria-label="Objectif de chiffre d’affaires du mois" type="number" min="0" step="0.01" inputMode="decimal" value={objTmp} onChange={e=>setObjTmp(e.target.value)} placeholder="ex. 2000" style={{flex:1,minWidth:0,border:`1px solid ${C.border}`,background:C.card,color:C.text,borderRadius:10,padding:'11px 12px',fontSize:15,fontFamily:'inherit',outline:'none'}}/>
            <button type="button" onClick={()=>{ const n=Number(objTmp); if(!Number.isFinite(n)||n<0){toast('Indique un objectif valide.');return;} setObjectif(n); save('vrm_ca_objectif',n); setObjEdit(false); }} style={{border:'none',background:C.accent,color:'#fff',borderRadius:10,padding:'11px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>OK</button>
          </div>
        ) : objectif>0 && caMoisCourant==null ? (
          <div style={{fontSize:13,color:C.muted,marginTop:6,lineHeight:1.5}}>— · tes ventes n'ont pas pu être lues, la jauge revient dès qu'elles le sont.</div>
        ) : objectif>0 ? (()=>{ const pct=Math.min(100,Math.round(caMoisCourant/objectif*100)); const done=caMoisCourant>=objectif; return (
          <>
            <div style={{display:'flex',alignItems:'baseline',gap:8}}>
              <span className="vrm-display" style={{fontSize:28,fontWeight:800,color:C.text}}>{fmt(caMoisCourant)}</span>
              <span style={{fontSize:13,color:C.muted}}>/ {fmt(objectif)}</span>
            </div>
            <div role="progressbar" aria-label="Progression vers l’objectif du mois" aria-valuemin={0} aria-valuemax={objectif} aria-valuenow={Math.min(caMoisCourant,objectif)} aria-valuetext={`${fmt(caMoisCourant)} sur ${fmt(objectif)}`} style={{height:12,background:C.card2||C.bg,borderRadius:999,overflow:'hidden',marginTop:8}}><div style={{width:`${Math.max(2,pct)}%`,height:'100%',background:C.accent,borderRadius:999,transition:'width .3s ease'}}/></div>
            <div style={{fontSize:13,color:C.muted,marginTop:6}}>{done?'Objectif atteint':`${pct}% de ton objectif`} · vendu ce mois, toutes plateformes, ventes en cours comprises</div>
          </>
        ); })() : (
          <div style={{fontSize:13,color:C.muted,marginTop:6,lineHeight:1.5}}>Fixe un objectif de CA pour ce mois et suis ta progression au fil de tes ventes.</div>
        )}
      </Card></div>

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
      <details className="vrm-finance-stock"><summary>Stock et volume de ventes{liveStats && <> · <span style={{whiteSpace:'nowrap'}} data-dash-stat="online">annonces en ligne <b style={{color:C.text,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{texteEnLigne(liveStats)}</b></span></>}</summary><div className="vrm-finance-stock-grid">
        {/* ⚠️ LE LIBELLÉ ÉTAIT FAUX. « Paires en stock : 0 » s'affichait en gros
            alors qu'il y a 50 annonces en ligne — parce que ce compteur mesure
            les numéros POSÉS AU GARAGE (le garage est vide), ce que seule la
            légende disait. Un chiffre qu'on doit corriger avec sa légende est un
            chiffre faux : le titre dit maintenant ce qu'il compte. */}
        <StatCard icon="📦" label="Paires en stock" value={liveStats&&liveStats.pairesStock!=null?liveStats.pairesStock:stockCount} color={C.text} sub="cases réellement remplies"/>
        {/* ⚠️ « 0,00 € » N'EST PAS UN ZÉRO, C'EST UNE ABSENCE. Cette carte somme
            les PRIX D'ACHAT des annonces en ligne — or aucun n'est saisi, donc
            elle affichait un gros 0,00 € à côté d'un « 1581 € de valeur » sur
            l'écran Annonces (qui, lui, somme les prix de VENTE). Deux chiffres
            qui portent presque le même nom et se contredisent (§11). Tant qu'on
            ne sait rien, on l'écrit. */}
        {(()=>{ const v = (liveStats&&liveStats.stockValue!=null?liveStats.stockValue:stockValue) || 0;
          const enLigne = liveStats && liveStats.online > 0;
          return <StatCard icon="💰" label="Valeur d'achat du stock"
            value={(v>0 || !enLigne) ? fmt(v) : '—'} color={C.text}
            sub={(v>0 || !enLigne) ? "prix d'achat des annonces en ligne" : undefined}/>; })()}
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
            <div className="vrm-display" style={{...sHero,fontSize:28,letterSpacing:-0.8,marginTop:6}}>{fmt(tot)}</div>
            <DayWeekNote label="Comprendre ce graphique"><div style={{...sNote,marginTop:6}}>Toutes plateformes, ventes en cours comprises, au jour de la vente — ce n'est pas le finalisé, c'est pourquoi ce total peut dépasser celui du dessus.</div></DayWeekNote>
            <div style={{marginTop:14}}><CourbeMois mois={mois.map((m,i)=>({...m,enCours:i===mois.length-1}))} attr="data-courbe-vendu" legende={false}/></div>
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
          les seules comptées ; eBay et Vestiaire Collective n'ont encore
          aucune vente captée. */}
      {(()=>{
        // §11 : LE MÊME helper que l'onglet Collectif — un seul propriétaire du
        // « CA par plateforme », les deux écrans ne peuvent pas diverger.
        const plateformes = caParPlateforme(liveStats, lbcVentes, ebayCa);
        const caVinted = plateformes[0].ca, caLbc = plateformes[1].ca;
        const parCompte = (liveStats && liveStats.caParCompte) || null;
        // Rien à décomposer tant que le CA Vinted n'est pas encore lu.
        if (caVinted == null && caLbc == null) return null;
        const comptes = parCompte ? Object.entries(parCompte).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]) : [];
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
              <span style={{fontSize:11,color:C.muted,fontVariantNumeric:'tabular-nums',minWidth:34,textAlign:'right',whiteSpace:'nowrap'}}>{Math.round(part*100)} %</span>
            </div>}
          </div>
        );
        const totPlat = plateformes.reduce((s2,p)=>s2+(p.ca||0),0);
        const totCpt = comptes.reduce((s2,[,v])=>s2+v,0);
        return (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(320px,100%), 1fr))',gap:12,marginTop:4}}>
            <div data-stats-carte="plateformes" data-stats-plateformes data-notion="finalise" style={{...sCarte,paddingBottom:12}}>
              <div style={{...sTitre,marginBottom:8}}>Finalisé par plateforme</div>
              {plateformes.map(p => <Ligne key={p.nom} label={p.nom} val={p.ca} note={p.note} part={p.ca!=null && totPlat>0 && plateformes.filter(x=>x.ca!=null).length>1 ? p.ca/totPlat : null}/>)}
              {/* Total = somme des plateformes captées = le CA global de l'onglet
                  Collectif (§11 : les deux écrans ne peuvent pas se contredire).
                  Affiché seulement quand ≥ 2 plateformes ont des ventes, sinon il
                  répète la seule ligne remplie. */}
              {(()=>{ const nz=plateformes.filter(p=>p.ca!=null); return nz.length>=2 ? <Ligne label="Total finalisé" val={nz.reduce((s,p)=>s+p.ca,0)} fort/> : null; })()}
            </div>
            <div data-stats-carte="comptes" style={{...sCarte,paddingBottom:12}}>
              <div style={{...sTitre,marginBottom:8}}>CA Vinted par compte</div>
              {comptes.length
                ? comptes.map(([lg,v]) => <Ligne key={lg} label={lg} val={v} part={comptes.length>1 && totCpt>0 ? v/totCpt : null}/>)
                : <div style={{fontSize:13,color:C.muted,padding:'10px 0',borderTop:`1px solid ${C.border}`}}>Le détail par compte apparaît dès que tes ventes sont chargées.</div>}
              {comptes.length>0 && caVinted!=null && <Ligne label="Total Vinted" val={caVinted} fort/>}
            </div>
          </div>
        );
      })()}

      {/* Barre de progression du garage */}
      <div data-stats-carte="garage" style={sCarte}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
          <span style={{...sTitre,display:'inline-flex',alignItems:'center',gap:6}}><Icon name="home" size={14}/>Remplissage du stock</span>
          <span className="vrm-display" style={{fontSize:15,fontWeight:700,color:C.text,fontVariantNumeric:'tabular-nums'}}>{fillRate}%</span>
        </div>
        <div style={{height:6,background:C.card2||C.surface,borderRadius:999,overflow:'hidden'}}>
          <div style={{
            height:'100%',
            width:`${fillRate}%`,
            background:C.accent,
            borderRadius:999,
            transition:'width 0.4s ease',
          }}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:9,fontSize:13,color:C.muted}}>
          <span><b style={{color:C.text,fontWeight:600}}>{stockCount}</b> boîtes occupées</span>
          <span><b style={{color:C.text,fontWeight:600}}>{freeSlots}</b> libres / {TOTAL_SLOTS} total</span>
        </div>
      </div>

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
          ['× moyen', hv?'—':`×${avgX}`, null, true],
          ['Vente moyenne', venteMoy==null?'—':fmt(venteMoy), hv?`sur ${liveStats.soldTotal} vente${liveStats.soldTotal>1?'s':''}`:null, false],
          ['Bénéf. moyen / vente', hv?'—':fmt(avgProfit), null, true],
          ['CA / jour de vente', hv && liveStats.joursVente>0 ? fmt(liveStats.caEncaisse/liveStats.joursVente) : '—',
            hv && liveStats.joursVente>0 ? `${liveStats.joursVente} jour${liveStats.joursVente>1?'s':''} où tu as vendu` : 'en attente de la synchro Vinted', false],
        ];
        return (
          <div data-stats-carte="details" style={sCarte}>
            <div style={{...sTitre,marginBottom:4}}>Détails</div>
            <div className="vrm-mois-grille" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:0}}>
              {cases.map(([l,v,sub,sourd])=>(
                <div key={l} style={{minWidth:0,padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
                  <div style={sLib}>{l}</div>
                  <div className="vrm-display" style={{...sHero,fontSize:20,letterSpacing:-0.4,marginTop:4,color:(sourd||v==='—')?C.muted:C.text}}>{v}</div>
                  {sub && <div style={{...sNote,fontSize:11,marginTop:2}}>{sub}</div>}
                </div>
              ))}
            </div>
            {hv && <div style={{marginTop:6}}><LignePrixAchat quoi="Le multiplicateur et le bénéfice moyen" dans/></div>}
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
              <div style={sLib}>Meilleur jour bénéfice</div>
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
              <div style={{display:'flex',gap:4,background:C.surface,borderRadius:8,padding:2,border:`1px solid ${C.border}`}}>
                {[['ca','CA €'],['ventes','Ventes']].map(([v,l])=>(
                  <button type="button" key={v} onClick={()=>setCaMode(v)} style={{border:'none',borderRadius:8,padding:'3px 10px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:caMode===v?C.accent:'transparent',color:caMode===v?'#fff':C.muted}}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>
              {moisMoisson.length} mois · même source que le récap comptable (Comptabilité) — touche un point pour le détail.
            </div>
            <CourbeMois mois={moisMoisson.map(h=>({cle:h.key,long:h.nomComplet,n:h.ventes,ca:h.ca,ventes:h.ventes,enCours:h.enCours}))} valeur={(m)=>caMode==='ca'?m.ca:m.ventes} format={(v)=>caMode==='ca'?`${Math.round(v).toLocaleString('fr-FR')} €`:String(Math.round(v))} choisi={selMois} onChoisir={setSelMois} attr="data-courbe-finalise"/>
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
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>💰 Évolution du CA (ventes finalisées, 12 derniers mois)</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Touche un point pour voir le détail des ventes du mois.</div>
            <CourbeMois mois={caHistory.map(h=>({cle:h.key,long:h.nomComplet,ca:h.ca,n:h.ventes.length}))} valeur={(m)=>m.ca} format={(v)=>`${Math.round(v).toLocaleString('fr-FR')} €`} choisi={selMonthEnc} onChoisir={setSelMonthEnc} attr="data-courbe-encaisse"/>
            {sel&&<MonthDetail mois={sel} type="encaisse" C={C} fmt={fmt} catMap={catMap} catalog={catalog} onClose={()=>setSelMonthEnc(null)}/>}
          </Card>
        );
      })()}

      {/* CA SUR MESURE : d'une date à une autre (Julien, 28 sept.). */}
      <Card>
        <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>📅 Chiffre d'affaires entre deux dates</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Choisis une période — le total porte sur tes ventes finalisées, à leur date de vente.</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600}}>Du</label>
            <input type="date" value={caDu} onChange={e=>setCaDu(e.target.value)} style={{border:`1px solid ${C.border}`,background:C.card,color:C.text,borderRadius:10,padding:'10px 12px',fontSize:15,fontFamily:'inherit',outline:'none',colorScheme:'inherit'}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600}}>Au</label>
            <input type="date" value={caAu} onChange={e=>setCaAu(e.target.value)} style={{border:`1px solid ${C.border}`,background:C.card,color:C.text,borderRadius:10,padding:'10px 12px',fontSize:15,fontFamily:'inherit',outline:'none',colorScheme:'inherit'}}/>
          </div>
          {(caDu||caAu) && <button type="button" onClick={()=>{setCaDu('');setCaAu('');}} style={{border:`1px solid ${C.border}`,background:'transparent',color:C.muted,borderRadius:10,padding:'10px 12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Effacer</button>}
        </div>
        {caRange ? (
          <div style={{marginTop:14}}>
            <div className="vrm-display" style={{fontSize:28,fontWeight:800,color:C.text}}>{fmt(caRange.ca)}</div>
            <div style={{fontSize:13,color:C.muted,marginTop:2}}>
              {caRange.count} vente{caRange.count>1?'s':''} finalisée{caRange.count>1?'s':''}
              {caDu&&caAu?` du ${caDu.split('-').reverse().join('/')} au ${caAu.split('-').reverse().join('/')}`
                : caDu?` depuis le ${caDu.split('-').reverse().join('/')}`
                : ` jusqu'au ${caAu.split('-').reverse().join('/')}`}
            </div>
          </div>
        ) : (
          <div style={{fontSize:13,color:C.muted,marginTop:12,lineHeight:1.5}}>Renseigne une date de début et/ou de fin pour voir le CA de la période.</div>
        )}
      </Card>

      {/* 🍩 ANNEAU PAR PLATEFORME — une seule teinte (accent), variée par opacité
          FIXE par plateforme (§7) ; identité portée par la légende, pas la couleur. */}
      {platParts.total>0 && (()=>{
        const op={'Vinted':1,'Leboncoin':0.6,'eBay':0.4,'Vestiaire Collective':0.24};
        const cx=66,cy=66,r=52,CIRC=2*Math.PI*r; let acc=0;
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>Répartition du CA par plateforme</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:12}}>La part de chaque plateforme dans ton chiffre d'affaires.</div>
            <div style={{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap'}}>
              <svg width="132" height="132" viewBox="0 0 132 132" style={{flexShrink:0}} role="img" aria-label="Répartition du CA par plateforme">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.card2||C.border} strokeWidth="14"/>
                {platParts.arr.map((p)=>{ const len=p.ca/platParts.total*CIRC; const el=(
                  <circle key={p.nom} cx={cx} cy={cy} r={r} fill="none" stroke={C.accent} strokeOpacity={op[p.nom]!=null?op[p.nom]:0.3} strokeWidth="14"
                    strokeDasharray={`${len} ${CIRC-len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"/>);
                  acc+=len; return el; })}
                {/* (20 oct., revue) Le centre disait « 6984 € » à côté de « 6983,57 € » dans la
                    légende : le même total, arrondi deux fois (§7). Le montant exact. */}
                <text x="66" y="62" textAnchor="middle" className="vrm-display" data-anneau-total={Math.round(platParts.total*100)} style={{fontSize:fmt(platParts.total).length>9?'12px':'14px',fontWeight:800,fill:C.text}}>{fmt(platParts.total)}</text>
                <text x="66" y="79" textAnchor="middle" style={{fontSize:'11px',fill:C.muted}}>CA total</text>
              </svg>
              {/* 220 px : sur téléphone la légende passe SOUS l'anneau — à 150 px elle
                  tenait à côté et le nom de la plateforme tombait à « Vin… ». */}
              <div data-anneau-legende="" style={{flex:'1 1 220px',minWidth:0,display:'flex',flexDirection:'column',gap:8}}>
                {platParts.arr.map((p)=>(
                  <div key={p.nom} style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                    <span style={{width:11,height:11,borderRadius:999,background:C.accent,opacity:op[p.nom]!=null?op[p.nom]:0.3,flexShrink:0}}/>
                    <span style={{flex:1,color:C.text,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.court}</span>
                    <span style={{color:C.text,fontWeight:700}}>{fmt(p.ca)}</span>
                    <span style={{color:C.muted,width:40,textAlign:'right'}}>{Math.round(p.ca/platParts.total*100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Ce qui se vend : marque, taille, modèle, pays, temps de vente (17 oct.). */}
      <RepartitionsVentes panelOff={panelOff}/>

      {/* Graphique du CA par date de vente (cliquable) */}
      {caHistoryVente.length>0&&(()=>{
        const maxCA=Math.max(...caHistoryVente.map(h=>h.ca),1);
        const sel=caHistoryVente.find(h=>h.key===selMonthVente);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>🛒 Évolution du CA par date de vente (12 derniers mois)</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Touche un point pour voir le détail des ventes du mois.</div>
            <CourbeMois mois={caHistoryVente.map(h=>({cle:h.key,long:h.nomComplet,ca:h.ca,n:h.ventes.length}))} valeur={(m)=>m.ca} format={(v)=>`${Math.round(v).toLocaleString('fr-FR')} €`} choisi={selMonthVente} onChoisir={setSelMonthVente} attr="data-courbe-vente"/>
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
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>📦 Paires ajoutées par jour</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>
              {totalAjouts} paire{totalAjouts>1?'s':''} sur {ajoutsParJour.length} jour{ajoutsParJour.length>1?'s':''} d'activité — moyenne {moyenne.toFixed(1)}/jour.
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
        <Card style={{borderLeft:`4px solid ${C.blue}`,background:`${C.blue}11`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.blue,marginBottom:6}}>📅 Récap semaine dernière ({weeklyRecapData.from} → {weeklyRecapData.to})</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13}}>
                <span><b style={{color:C.text}}>{weeklyRecapData.count}</b> <span style={{color:C.muted}}>vente{weeklyRecapData.count>1?'s':''}</span></span>
                <span><b style={{color:C.accent}}>{fmt(weeklyRecapData.ca)}</b> <span style={{color:C.muted}}>vendu</span></span>
                <span><b style={{color:C.accent}}>{fmt(weeklyRecapData.profit)}</b> <span style={{color:C.muted}}>bénéfice</span></span>
              </div>
              {(()=>{ const pc=weeklyRecapData.prevCa||0, c=weeklyRecapData.ca; if(pc<=0&&c<=0) return null; const diff=c-pc; const pct=pc>0?Math.round(diff/pc*100):null; const up=diff>=0; return (
                <div style={{fontSize:11,color:up?C.accent:C.danger,fontWeight:600,marginTop:6}}>{up?'▲':'▼'} {up?'+':''}{fmt(diff)} vs semaine précédente{pct!=null?` (${up?'+':''}${pct} %)`:''} <span style={{color:C.muted,fontWeight:600}}>— {fmt(pc)} vendus</span></div>
              ); })()}
            </div>
            <button className="vrm-icon-control" aria-label="Fermer le bilan de la semaine" type="button" onClick={()=>{localStorage.setItem('vinted_last_weekly_recap',isoWeek);setShowWeekly(false);}}
              style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,fontSize:15,lineHeight:1,padding:'2px 4px'}}><Icon name="close" size={15}/></button>
          </div>
        </Card>
      )}

      {/* Récap mensuel */}
      {showMonthly&&monthlyRecapData.count>0&&(
        <Card style={{borderLeft:`4px solid ${C.purple}`,background:`${C.purple}11`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.purple,marginBottom:6}}>📆 Récap {monthlyRecapData.nom}</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13}}>
                <span><b style={{color:C.text}}>{monthlyRecapData.count}</b> <span style={{color:C.muted}}>vente{monthlyRecapData.count>1?'s':''}</span></span>
                <span><b style={{color:C.accent}}>{fmt(monthlyRecapData.ca)}</b> <span style={{color:C.muted}}>vendu</span></span>
                <span><b style={{color:C.accent}}>{fmt(monthlyRecapData.profit)}</b> <span style={{color:C.muted}}>bénéfice</span></span>
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

/* ── Catalogue ───────────────────────────────────────── */
function Catalog({catalog,setCatalog,onDeleteId}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [newRow,setNewRow]=useState({id:'',buyPrice:''});
  const [lastAddedId,setLastAddedId]=useState(null); // dernier n° ajouté
  const priceInputRef=React.useRef(null);
  const [page,setPage]=useState(null); // null = dernière page
  const [showAll,setShowAll]=useState(false);
  const PER_PAGE=50;
  
  // Recherche : sur Entrée ou bouton
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};

  const update=(id,field,val)=>{
    const u=catalog.map(p=>p.id===id?{...p,[field]:field==='buyPrice'?+val:val}:p);
    setCatalog(u); save('vinted_catalog',u);
  };
  const remove=async (id)=>{
    if(!await askConfirm(`Supprimer #${id} ?`)) return;
    const u=catalog.filter(p=>p.id!==id);
    setCatalog(u); save('vinted_catalog',u);
    if(onDeleteId) onDeleteId(id);
  };
  const toggleStatus=(id)=>{
    const u=catalog.map(p=>p.id===id?{...p,status:p.status==='stock'?'vendu':'stock'}:p);
    setCatalog(u); save('vinted_catalog',u);
  };
  const addRow=()=>{
    const id=newRow.id.trim();
    if(!id||!newRow.buyPrice) return;
    if(catalog.find(p=>p.id===id)){toast('Numéro déjà existant !');return;}
    const u=[...catalog,{id,buyPrice:+newRow.buyPrice,status:'stock',addedAt:tod()}];
    setCatalog(u); save('vinted_catalog',u);
    setLastAddedId(id);
    // Pré-remplit automatiquement le numéro suivant (ex: après 50 → 51 prêt pour le prix)
    let nextId='';
    if(/^\d+$/.test(id)) nextId=String(parseInt(id,10)+1);
    setNewRow({id:nextId,buyPrice:''});
    setPage(null); // reste sur la dernière page (où se trouve la ligne d'ajout)
    // Place le curseur sur le champ prix pour enchaîner directement
    setTimeout(()=>{ if(priceInputRef.current) priceInputRef.current.focus(); },50);
  };

  // Bouton +1 : pré-remplit le champ N° avec (dernier n° ajouté + 1).
  // Si rien n'a encore été ajouté dans cette session, part du plus grand n° du catalogue.
  const fillNextId=()=>{
    let base;
    if(lastAddedId!==null && /^\d+$/.test(lastAddedId)){
      base=parseInt(lastAddedId,10);
    } else {
      const nums=catalog.map(p=>parseInt(p.id,10)).filter(n=>!isNaN(n));
      base=nums.length?Math.max(...nums):0;
    }
    setNewRow(r=>({...r,id:String(base+1)}));
    // Place le curseur sur le champ prix pour enchaîner rapidement
    setTimeout(()=>{ if(priceInputRef.current) priceInputRef.current.focus(); },50);
  };

  const fullList=useMemo(()=>catalog
    .filter(p=>p.id.toString().includes(search.trim())&&(filter==='all'||p.status===filter))
    .sort((a,b)=>+a.id-+b.id),[catalog,search,filter]);
  const totalPages=Math.max(1,Math.ceil(fullList.length/PER_PAGE));
  const currentPage=page===null?totalPages-1:Math.min(page,totalPages-1);
  const list=showAll?fullList:fullList.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);

  const oldStockCount=useMemo(()=>{
    const now=new Date();
    return catalog.filter(p=>{
      if(p.status!=='stock') return false;
      const parts=(p.addedAt||'').split('/');
      if(parts.length!==3) return false;
      const d=new Date(+parts[2],+parts[1]-1,+parts[0]);
      return (now-d)/86400000>30;
    }).length;
  },[catalog]);

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <ScreenHead icon="box" title={`Catalogue (${catalog.length})`}
        desc="Les paires de l'ancienne application. Elles comptent toujours dans les statistiques."
        right={<Btn small onClick={()=>{
          if(fullList.length===0){toast('Aucune paire à exporter');return;}
          const headers=['N° Paire','Prix Achat (€)','Statut','Date ajout'];
          const rows=fullList.map(p=>[p.id||'',String(p.buyPrice||'').replace('.',','),p.status||'',p.addedAt||'']);
          const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
          const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url;
          a.download=`catalogue-${new Date().toISOString().slice(0,10)}.csv`;
          document.body.appendChild(a);a.click();document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }} color={C.blue} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name="save" size={13}/>Exporter Excel</Btn>}/>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:200}}>
          <Input value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
            placeholder="Numéro... puis Entrée"
            style={{flex:1,minWidth:120}}/>
          <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
          {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
        </div>
        {['all','stock','vendu'].map(f=>(
          <Btn key={f} small onClick={()=>setFilter(f)} color={filter===f?C.accent:C.border} style={{color:filter===f?'#fff':C.muted}}>
            {f==='all'?'Tous':f==='stock'?'Stock':'Vendus'}
          </Btn>
        ))}
      </div>
      {oldStockCount>0&&(
        <div style={{background:`${C.warn}22`,border:`1px solid ${C.warn}66`,borderRadius:8,padding:'8px 14px',fontSize:12,color:C.warn,fontWeight:500}}>
          ⚠️ {oldStockCount} paire{oldStockCount>1?'s':''} en stock depuis + de 30 jours
        </div>
      )}
      <Card style={{padding:0,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{background:C.surface}}><tr>
            {['N°','Prix achat','Statut','Ajouté',''].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'10px 12px',color:C.muted,fontWeight:600,fontSize:11,textTransform:'uppercase'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {list.length===0&&<tr><td colSpan={5} style={{padding:20,textAlign:'center',color:C.muted}}>Aucune paire</td></tr>}
            {list.map(p=>(
              <tr key={p.id} style={{borderTop:`1px solid ${C.border}`,background:(()=>{if(p.status==='vendu') return '#ff4d6d08';const parts=(p.addedAt||'').split('/');if(parts.length===3){const d=new Date(+parts[2],+parts[1]-1,+parts[0]);const days=Math.floor((new Date()-d)/86400000);if(days>60) return `${C.danger}18`;if(days>30) return `${C.warn}18`;}return 'transparent';})()}}>
                <td style={{padding:'2px 12px',fontWeight:600,color:C.accent,fontSize:15,minWidth:60}}>
                  <Cell value={p.id} onChange={v=>update(p.id,'id',v)} mono/>
                </td>
                <td style={{padding:'2px 12px',minWidth:80}}>
                  <Cell value={String(p.buyPrice)} onChange={v=>update(p.id,'buyPrice',v)} align="right"/>
                </td>
                <td style={{padding:'2px 12px'}}>
                  <span onClick={()=>toggleStatus(p.id)} style={{cursor:'pointer'}}>
                    <Badge color={p.status==='stock'?C.accent:C.danger}>{p.status==='stock'?'Stock':'Vendu'}</Badge>
                  </span>
                </td>
                <td style={{padding:'2px 12px',color:C.muted,fontSize:11,minWidth:80}}>
                  <Cell value={p.addedAt||'—'} onChange={v=>update(p.id,'addedAt',v)}/>
                  {p.status==='stock'&&(()=>{const parts=(p.addedAt||'').split('/');if(parts.length!==3) return null;const d=new Date(+parts[2],+parts[1]-1,+parts[0]);const days=Math.floor((new Date()-d)/86400000);if(days>30) return <span style={{fontSize:11,color:days>60?C.danger:C.warn,fontWeight:500,marginLeft:3}}>{days}j</span>;return null;})()}
                </td>
                <td style={{padding:'2px 12px'}}>
                  <Btn small danger onClick={()=>remove(p.id)}>✕</Btn>
                </td>
              </tr>
            ))}
            {/* Ligne d'ajout en bas (dernière page uniquement) */}
            {(showAll||currentPage===totalPages-1)&&<tr style={{borderTop:`2px solid ${C.accent}44`,background:'#00e5a008'}}>
              <td style={{padding:'6px 8px'}}>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <input value={newRow.id} onChange={e=>setNewRow(n=>({...n,id:e.target.value}))}
                    placeholder="N°" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:5,color:C.text,padding:'4px 8px',fontSize:12,width:60,fontFamily:'monospace',outline:'none'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                  <button type="button" onClick={fillNextId} title="Numéro suivant (dernier ajouté +1)"
                    style={{background:`${C.accent}22`,border:`1px solid ${C.accent}66`,borderRadius:5,color:C.accent,padding:'4px 6px',fontSize:15,fontWeight:600,cursor:'pointer',lineHeight:1}}>
                    +1
                  </button>
                </div>
              </td>
              <td style={{padding:'6px 8px'}}>
                <input ref={priceInputRef} value={newRow.buyPrice} onChange={e=>setNewRow(n=>({...n,buyPrice:e.target.value}))}
                  type="number" placeholder="Prix achat €" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                  style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:5,color:C.text,padding:'4px 8px',fontSize:12,width:100,outline:'none',fontFamily:'inherit'}}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                />
              </td>
              <td colSpan={2} style={{padding:'6px 8px',color:C.muted,fontSize:11}}>← Entrée ou bouton pour ajouter</td>
              <td style={{padding:'6px 8px'}}>
                <Btn small onClick={addRow} color={C.accent}>+ Ajouter</Btn>
              </td>
            </tr>}
          </tbody>
        </table>
      </Card>
      {/* Pagination Catalogue */}
      {!showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?totalPages-1:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullList.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?totalPages-1:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullList.length} paires</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
    </div>
  );
}

/* ── Ventes ──────────────────────────────────────────── */
function Sales({catalog,setCatalog,sales,setSales,invoices,invoiceSettings,entreprises,activeEnt}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [newRow,setNewRow]=useState({productId:'',saleDate:'',receiveDate:'',sellPrice:'',buyPrice:''});
  const [err,setErr]=useState('');
  const [page,setPage]=useState(null); // null = dernière page (init)
  const [showAll,setShowAll]=useState(false);
  const [selectMode,setSelectMode]=useState(false);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [isDragging,setIsDragging]=useState(false);
  const dragModeRef=React.useRef('add');
  const selectedIdsRef=React.useRef(new Set());
  selectedIdsRef.current=selectedIds;
  const PER_PAGE=50;
  
  // Recherche : sur Entrée ou bouton
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};
  
  // Drag global avec écoute des événements window
  useEffect(()=>{
    if(!selectMode) return;
    
    const onMove=(e)=>{
      if(!isDragging) return;
      const t=e.touches?e.touches[0]:e;
      if(!t) return;
      const el=document.elementFromPoint(t.clientX,t.clientY);
      if(!el) return;
      const tr=el.closest('tr[data-vid]');
      if(!tr) return;
      const vid=tr.getAttribute('data-vid');
      if(!vid) return;
      const ns=new Set(selectedIdsRef.current);
      if(dragModeRef.current==='add') ns.add(vid); else ns.delete(vid);
      // Si pas de changement, on ne re-render pas
      if(ns.size===selectedIdsRef.current.size&&dragModeRef.current==='add'?selectedIdsRef.current.has(vid):!selectedIdsRef.current.has(vid)) return;
      setSelectedIds(ns);
    };
    
    const onUp=()=>setIsDragging(false);
    
    window.addEventListener('mousemove',onMove);
    window.addEventListener('touchmove',onMove,{passive:true});
    window.addEventListener('mouseup',onUp);
    window.addEventListener('touchend',onUp);
    return ()=>{
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('touchmove',onMove);
      window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchend',onUp);
    };
  },[selectMode,isDragging]);
  


  const updateSale=(id,field,val)=>{
    const u=sales.map(s=>{
      if(s.id!==id) return s;
      const ns={...s,[field]:val};
      const sell=+(field==='sellPrice'?val:ns.sellPrice);
      const buy=+(field==='buyPrice'?val:ns.buyPrice);
      ns.profit=+(sell-buy).toFixed(2);
      ns.multi=buy>0?+(sell/buy).toFixed(2):0;
      return ns;
    });
    setSales(u); save('vinted_sales',u);
  };

  const del=async (sid,pid)=>{
    if(!await askConfirm('Supprimer cette vente ?')) return;
    const ns=sales.filter(s=>s.id!==sid); setSales(ns); save('vinted_sales',ns);
    const pids=String(pid||'').split('+').map(v=>v.trim()).filter(Boolean);
    const nc=catalog.map(p=>pids.includes(p.id)?{...p,status:'stock'}:p); setCatalog(nc); save('vinted_catalog',nc);
  };

  const addRow=()=>{
    setErr('');
    const rawPid=newRow.productId.trim();
    if(!rawPid||!newRow.saleDate||!newRow.sellPrice){setErr('Article, date et prix vente obligatoires');return;}
    const pids=rawPid.split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
    const pid=pids.join('+');
    const foundItems=pids.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
    const alreadySold=pids.find(id=>{const cp=catalog.find(x=>x.id===id);return cp&&cp.status==='vendu';});
    if(alreadySold){setErr(`#${alreadySold} déjà vendue`);return;}
    const buy=foundItems.length>0?foundItems.reduce((s,cp)=>s+(+cp.buyPrice),0):(+newRow.buyPrice||0);
    const sell=+newRow.sellPrice;
    const sale={id:uid(),productId:pid,buyPrice:+buy.toFixed(2),sellPrice:sell,
      profit:+(sell-buy).toFixed(2),multi:buy>0?+(sell/buy).toFixed(2):0,
      saleDate:newRow.saleDate,receiveDate:newRow.receiveDate,createdAt:new Date().toISOString(),
      ...(pids.length>1?{isLot:true}:{})};
    const ns=[sale,...sales]; setSales(ns); save('vinted_sales',ns);
    if(foundItems.length>0){const nc=catalog.map(x=>pids.includes(x.id)?{...x,status:'vendu'}:x);setCatalog(nc);save('vinted_catalog',nc);}
    setNewRow({productId:'',saleDate:'',receiveDate:'',sellPrice:'',buyPrice:''});
  };

  const fullFiltered=useMemo(()=>sales.filter(s=>
    !search||(s.productId||'').toLowerCase().includes(search.toLowerCase())||(s.saleDate||'').includes(search)||(s.receiveDate||'').includes(search)
  ),[sales,search]);
  const totalPages=Math.max(1,Math.ceil(fullFiltered.length/PER_PAGE));
  const currentPage=page===null?totalPages-1:Math.min(page,totalPages-1);
  const filtered=showAll?fullFiltered:fullFiltered.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);

  const totalCA=useMemo(()=>fullFiltered.reduce((s,v)=>s+ +v.sellPrice,0),[fullFiltered]);
  const totalProfit=useMemo(()=>fullFiltered.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0),[fullFiltered]);

  const _pids=newRow.productId.trim().split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
  const p=_pids.length===1?catalog.find(x=>x.id===_pids[0]):null;
  const _foundItems=_pids.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
  const previewBuy=_foundItems.length>0?_foundItems.reduce((s,x)=>s+(+x.buyPrice),0):(+newRow.buyPrice||null);
  const previewSell=newRow.sellPrice?+newRow.sellPrice:null;

  // CA + bénéfice du mois en cours (basé sur la date de réception JJ/MM/AAAA = argent encaissé)
  const moisVentes=useMemo(()=>{
    const now=new Date();
    const mm=String(now.getMonth()+1).padStart(2,'0');
    const yyyy=String(now.getFullYear());
    let caM=0, profitM=0, countM=0;
    sales.forEach(v=>{
      const dt=(v.receiveDate||'').trim();
      const parts=dt.split('/');
      if(parts.length===3 && parts[1]===mm && parts[2]===yyyy){
        caM+=+v.sellPrice; profitM+=(+v.sellPrice-+v.buyPrice); countM++;
      }
    });
    const labels=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return {ca:caM, profit:profitM, count:countM, nom:labels[now.getMonth()]};
  },[sales]);

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      {/* Bandeau mois en cours */}
      <div style={{display:'flex',flexWrap:'wrap',gap:14,background:C.card,
        border:`1px solid ${C.blue}44`,borderRadius:8,padding:'12px 16px'}}>
        <div style={{fontSize:11,color:C.blue,textTransform:'uppercase',letterSpacing:1,fontWeight:500,width:'100%'}}>
          📅 {moisVentes.nom} — mois en cours
        </div>
        <div><span style={{fontSize:11,color:C.muted}}>CA finalisé</span><div style={{fontSize:20,fontWeight:600,color:C.text}}>{fmt(moisVentes.ca)}</div></div>
        <div><span style={{fontSize:11,color:C.muted}}>Bénéfice</span><div style={{fontSize:20,fontWeight:600,color:moisVentes.profit>=0?C.accent:C.danger}}>{fmt(moisVentes.profit)}</div></div>
        <div><span style={{fontSize:11,color:C.muted}}>Ventes</span><div style={{fontSize:20,fontWeight:600,color:C.muted}}>{moisVentes.count}</div></div>
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:600}}>Ventes ({sales.length})</h2>
        <div style={{display:'flex',gap:12,fontSize:13,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{color:C.muted}}>CA filtré : <b style={{color:C.text}}>{fmt(totalCA)}</b></span>
          <span style={{color:C.muted}}>Bénéf. : <b style={{color:totalProfit>=0?C.accent:C.danger}}>{fmt(totalProfit)}</b></span>
          <Btn small onClick={()=>{
            if(fullFiltered.length===0){toast('Aucune vente à exporter');return;}
            const headers=['ID','N° Paire','Date vente','Date réception','Prix achat (€)','Prix vente (€)','Bénéfice (€)','Multi'];
            const rows=fullFiltered.map(s=>[
              s.id||'',s.productId||'',s.saleDate||'',s.receiveDate||'',
              String(s.buyPrice||'').replace('.',','),String(s.sellPrice||'').replace('.',','),
              String(s.profit||'').replace('.',','),String(s.multi||'').replace('.',','),
            ]);
            const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
            const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download=`ventes-${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);a.click();document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }} color={C.blue}>📤 Exporter Excel</Btn>
        </div>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <Input value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="Article, date... puis Entrée"
          style={{maxWidth:280,flex:1,minWidth:160}}/>
        <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
      </div>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div className={selectMode?'sales-select-mode':''} style={{overflowX:'auto',position:'relative'}}>
          <style>{`
            .sales-select-mode tbody td > * { pointer-events: none !important; }
            .sales-select-mode tbody tr { pointer-events: auto !important; }
          `}</style>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,
            ...(selectMode?{userSelect:'none',WebkitUserSelect:'none'}:{})}}>
            <thead style={{background:C.surface,position:'sticky',top:0,zIndex:1}}><tr>
              {['Article','Date vente','Réception €','Achat','Vente','Bénéfice','×','Facture',''].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'10px 10px',color:C.muted,fontWeight:600,fontSize:11,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={9} style={{padding:20,textAlign:'center',color:C.muted}}>Aucune vente</td></tr>}
              {filtered.map(v=>{
                const b=+(+v.sellPrice-+v.buyPrice);
                const isSelected=selectedIds.has(v.id);
                return (
                  <tr key={v.id}
                    onMouseDown={selectMode?(e)=>{
                      e.preventDefault();
                      const ns=new Set(selectedIds);
                      const willAdd=!ns.has(v.id);
                      if(willAdd) ns.add(v.id); else ns.delete(v.id);
                      setSelectedIds(ns);
                      dragModeRef.current=willAdd?'add':'remove';
                      setIsDragging(true);
                    }:undefined}
                    onTouchStart={selectMode?(e)=>{
                      const ns=new Set(selectedIds);
                      const willAdd=!ns.has(v.id);
                      if(willAdd) ns.add(v.id); else ns.delete(v.id);
                      setSelectedIds(ns);
                      dragModeRef.current=willAdd?'add':'remove';
                      setIsDragging(true);
                    }:undefined}
                    data-vid={v.id}
                    style={{borderTop:`1px solid ${C.border}`,background:isSelected?`${C.accent}33`:'transparent',cursor:selectMode?'pointer':'auto',userSelect:selectMode?'none':'auto',position:'relative'}}>
                    <td style={{padding:'2px 10px',minWidth:100,fontWeight:500,color:C.accent}}>
                      <Cell value={v.productId||''} onChange={val=>updateSale(v.id,'productId',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:90}}>
                      <Cell value={v.saleDate||''} onChange={val=>updateSale(v.id,'saleDate',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:90}}>
                      <Cell value={v.receiveDate||''} onChange={val=>updateSale(v.id,'receiveDate',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:65}}>
                      <Cell value={String(v.buyPrice)} onChange={val=>updateSale(v.id,'buyPrice',val)} align="right"/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:65}}>
                      <Cell value={String(v.sellPrice)} onChange={val=>updateSale(v.id,'sellPrice',val)} align="right"/>
                    </td>
                    <td style={{padding:'2px 10px',color:b>=0?C.accent:C.danger,fontWeight:600,whiteSpace:'nowrap'}}>{fmt(b)}</td>
                    <td style={{padding:'2px 10px',color:C.warn,whiteSpace:'nowrap'}}>×{fmtN(v.multi)}</td>
                    <td style={{padding:'2px 10px',whiteSpace:'nowrap'}}>
                      {(() => {
                        const inv=invoices&&invoices.find(i=>String(i.productId).trim()===String(v.productId||'').trim());
                        if(!inv) return <span style={{color:C.muted,fontSize:11}}>—</span>;
                        return <button type="button" onClick={()=>generatePDF(inv,entForInvoice(inv,entreprises,activeEnt,invoiceSettings||{...ENTREPRISE_VIDE}))}
                          title={`Voir la facture ${inv.number}`}
                          style={{background:`${C.blue}22`,border:`1px solid ${C.blue}66`,borderRadius:5,color:C.blue,padding:'2px 8px',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'monospace'}}>
                          📄 {inv.number}
                        </button>;
                      })()}
                    </td>
                    <td style={{padding:'2px 10px'}}>
                      <Btn small danger onClick={()=>del(v.id,v.productId)}>✕</Btn>
                    </td>
                  </tr>
                );
              })}
              {/* Ligne d'ajout en bas */}
              <tr style={{borderTop:`2px solid ${C.accent}44`,background:'#00e5a008'}}>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.productId} onChange={e=>{
                    const pid=e.target.value;
                    const parts=pid.trim().split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
                    const inv=parts.length===1?(invoices?invoices.find(i=>String(i.productId).trim()===parts[0]):null):null;
                    setNewRow(n=>({
                      ...n,
                      productId:pid,
                      ...(inv?{saleDate:inv.saleDate||n.saleDate}:{}),
                    }));
                  }}
                    placeholder="N° ou N°+N° (lot)" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:5,color:C.accent,padding:'4px 6px',fontSize:12,width:90,fontFamily:'monospace',outline:'none',fontWeight:500}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.saleDate} onChange={e=>setNewRow(n=>({...n,saleDate:e.target.value}))}
                    placeholder="jj/mm/aaaa"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:5,color:C.text,padding:'4px 6px',fontSize:12,width:90,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.receiveDate} onChange={e=>setNewRow(n=>({...n,receiveDate:e.target.value}))}
                    placeholder="jj/mm/aaaa"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:5,color:C.text,padding:'4px 6px',fontSize:12,width:90,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  {_foundItems.length>0?<span style={{color:C.muted,fontSize:12,padding:'0 6px'}}>{fmt(previewBuy)}{_foundItems.length>1?<span style={{fontSize:11,color:C.purple,marginLeft:3}}>lot</span>:null}</span>:
                  <input value={newRow.buyPrice} onChange={e=>setNewRow(n=>({...n,buyPrice:e.target.value}))}
                    type="number" placeholder="Achat €"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:5,color:C.text,padding:'4px 6px',fontSize:12,width:70,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />}
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.sellPrice} onChange={e=>setNewRow(n=>({...n,sellPrice:e.target.value}))}
                    type="number" placeholder="Vente €"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:5,color:C.text,padding:'4px 6px',fontSize:12,width:70,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px',color:previewBuy!==null&&previewSell!==null?(previewSell-previewBuy>=0?C.accent:C.danger):C.muted,fontWeight:600,fontSize:12,whiteSpace:'nowrap'}}>
                  {previewBuy!==null&&previewSell!==null?fmt(previewSell-previewBuy):''}
                </td>
                <td style={{padding:'6px 6px',color:C.warn,fontSize:12}}>
                  {previewBuy&&previewBuy>0&&previewSell?`×${(previewSell/previewBuy).toFixed(2)}`:''}
                </td>
                <td style={{padding:'6px 6px'}}>
                  <Btn small onClick={addRow} color={C.accent}>+ Ajouter</Btn>
                </td>
              </tr>
              {err&&<tr><td colSpan={8} style={{padding:'6px 12px',color:C.danger,fontSize:12}}>⚠ {err}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Pagination */}
      {!showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?totalPages-1:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullFiltered.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?totalPages-1:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullFiltered.length} ventes</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
      
      {/* Barre flottante en bas : bouton sélection + somme */}
      <div style={{position:'sticky',bottom:0,zIndex:20,padding:'8px 0',background:`linear-gradient(180deg, transparent 0%, ${C.bg} 30%)`}}>
        <Card style={{padding:'10px 14px',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',background:selectMode?`${C.accent}15`:C.card,borderColor:selectMode?`${C.accent}66`:C.border}}>
          <Btn small onClick={()=>{setSelectMode(!selectMode);if(selectMode)setSelectedIds(new Set());}} color={selectMode?C.accent:C.border} style={{color:selectMode?'#fff':C.muted}}>
            {selectMode?'✓ Mode sélection actif':'☑️ Activer la sélection'}
          </Btn>
          {selectMode&&<>
            <span style={{fontSize:11,color:C.muted}}>
              {selectedIds.size===0?'Clique ou glisse sur les lignes du tableau pour les sélectionner':`${selectedIds.size} vente${selectedIds.size>1?'s':''} sélectionnée${selectedIds.size>1?'s':''}`}
            </span>
            {selectedIds.size>0&&(()=>{
              const sel=fullFiltered.filter(v=>selectedIds.has(v.id));
              const sumCA=sel.reduce((s,v)=>s+ +v.sellPrice,0);
              const sumProfit=sel.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
              const sumRecu=sel.filter(v=>v.receiveDate&&v.receiveDate.trim()!=='').reduce((s,v)=>s+ +v.sellPrice,0);
              return (<>
                <span style={{fontSize:13,color:C.muted,marginLeft:'auto'}}>Σ : <b style={{color:C.text}}>{fmt(sumCA)}</b></span>
                <span style={{fontSize:13,color:C.muted}}>💰 Reçu : <b style={{color:C.accent}}>{fmt(sumRecu)}</b></span>
                <span style={{fontSize:13,color:C.muted}}>Bénéf. : <b style={{color:sumProfit>=0?C.accent:C.danger}}>{fmt(sumProfit)}</b></span>
              </>);
            })()}
          </>}
        </Card>
      </div>
    </div>
  );
}

/* ── Stock Vinted ──────────────────────────────────────── */
// Suivi des annonces en ligne sur Vinted, avec réconciliation garage.
// - Saisie manuelle des numéros (à l'unité + collage en masse)
// - Une facture qui arrive => le numéro se retire automatiquement (géré dans App via useEffect)
// - Une facture supprimée => le numéro revient (géré dans App)
// - Nouveau numéro au catalogue (à partir de maintenant) => ajout auto (géré dans App)
// - Incohérences : compare le Stock Vinted avec les numéros présents dans le Garage
function StockVinted({stockVinted,setStockVinted,garageGrid,invoices}) {
  const [input,setInput]=useState('');
  const [bulk,setBulk]=useState('');
  const [showBulk,setShowBulk]=useState(false);
  const [search,setSearch]=useState('');

  // Normalise un numéro (string, trim)
  const norm=(v)=>String(v||'').trim();

  // Ajoute un numéro à l'unité
  const addOne=()=>{
    const n=norm(input);
    if(!n){ return; }
    if(stockVinted.includes(n)){ toast('Le numéro '+n+' est déjà dans le stock Vinted.'); setInput(''); return; }
    const u=[...stockVinted,n];
    setStockVinted(u); save('vinted_stock_vinted',u);
    setInput('');
  };

  // Ajoute plusieurs numéros d'un coup (séparés par virgule, espace, point-virgule ou saut de ligne)
  const addBulk=()=>{
    const parts=bulk.split(/[\s,;]+/).map(norm).filter(Boolean);
    if(parts.length===0){ toast('Aucun numéro détecté.'); return; }
    const set=new Set(stockVinted);
    let added=0;
    parts.forEach(p=>{ if(!set.has(p)){ set.add(p); added++; } });
    const u=Array.from(set);
    setStockVinted(u); save('vinted_stock_vinted',u);
    setBulk(''); setShowBulk(false);
    toast(added+' numéro(s) ajouté(s) au stock Vinted.');
  };

  // Retire un numéro manuellement
  const removeOne=(n)=>{
    const u=stockVinted.filter(x=>x!==n);
    setStockVinted(u); save('vinted_stock_vinted',u);
  };

  // Numéros présents dans le garage (toutes les cases non vides)
  const garageNums=useMemo(()=>{
    const s=new Set();
    Object.values(garageGrid||{}).forEach(arr=>{
      if(Array.isArray(arr)) arr.forEach(v=>{ const t=norm(v); if(t) s.add(t); });
    });
    return s;
  },[garageGrid]);

  // Set du stock Vinted pour comparaisons rapides
  const stockSet=useMemo(()=>new Set(stockVinted.map(norm)),[stockVinted]);

  // Incohérences :
  //  - "en ligne mais pas au garage" : numéro dans Stock Vinted mais introuvable dans le garage
  //    (=> l'annonce est en ligne alors que la paire n'est plus là : à vérifier)
  //  - "au garage mais pas en ligne" : numéro présent au garage mais pas dans Stock Vinted
  //    (=> paire stockée mais pas annoncée : peut-être à mettre en ligne)
  const enLignePasGarage=useMemo(()=>
    stockVinted.map(norm).filter(n=>n&&!garageNums.has(n)).sort((a,b)=>(+a||0)-(+b||0))
  ,[stockVinted,garageNums]);

  // ⚠️ Le garage 3D est-il seulement utilise ? Sans ca, « en ligne mais absent
  // du garage » vaut mecaniquement 100 % et n'apprend rien.
  const garageVide = garageNums.size === 0;
  // Jamais des centaines de pastilles d'un coup : une tranche, et le total ecrit
  // sur le bouton (meme motif que Ventes et Achats).
  const [ecartsMax, setEcartsMax] = useState(200);
  const [listeMax, setListeMax] = useState(200);
  const garagePasEnLigne=useMemo(()=>
    Array.from(garageNums).filter(n=>!stockSet.has(n)).sort((a,b)=>(+a||0)-(+b||0))
  ,[garageNums,stockSet]);

  // Une recherche remet la tranche a zero : sinon on croirait que les derniers
  // resultats manquent (meme regle que Ventes et Achats).
  useEffect(()=>{ setListeMax(200); },[search]);
  // Liste filtrée pour l'affichage
  const liste=useMemo(()=>{
    const arr=[...stockVinted].map(norm).sort((a,b)=>(+a||0)-(+b||0));
    const q=norm(search).toLowerCase();
    if(!q) return arr;
    return arr.filter(n=>n.toLowerCase().includes(q));
  },[stockVinted,search]);

  return (
    <div>
      <ScreenHead icon="tag" title={`Stock Vinted (${stockVinted.length})`}
        desc="L'ancienne liste des numéros en ligne."
        right={<button type="button" onClick={()=>setShowBulk(s=>!s)} style={{background:C.purple,color:'#fff',border:'none',borderRadius:8,padding:'7px 12px',fontWeight:500,fontSize:12,cursor:'pointer'}}>
          {showBulk?'Fermer':'Coller en masse'}
        </button>}/>

      <p style={{fontSize:13,color:C.muted,margin:'0 0 14px',lineHeight:1.5}}>
        L'<b>ancienne</b> liste de numéros en ligne, tenue à la main avant que l'app lise Vinted
        directement (l'onglet <b>Annonces</b> a pris le relais). Ajoute tes numéros un par un ci-dessous.
        Quand une facture arrive, le numéro se retire tout seul ; si tu supprimes la facture, il revient. Les nouveaux numéros ajoutés au catalogue s'ajoutent aussi automatiquement.
      </p>

      {/* Saisie à l'unité */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') addOne(); }}
          placeholder="N° de l'annonce (ex : 1908)"
          inputMode="numeric"
          style={{flex:1,padding:'10px 12px',border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:15}}
        />
        <button type="button" onClick={addOne} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'10px 16px',fontWeight:500,fontSize:15,cursor:'pointer'}}>
          Ajouter
        </button>
      </div>

      {/* Collage en masse (optionnel) */}
      {showBulk&&(
        <div style={{marginBottom:14,padding:12,background:C.card2||'rgba(0,0,0,0.04)',borderRadius:8}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Colle plusieurs numéros (séparés par espace, virgule ou retour à la ligne) :</div>
          <textarea
            value={bulk}
            onChange={e=>setBulk(e.target.value)}
            rows={4}
            placeholder="1908 1925 898 ..."
            style={{width:'100%',padding:10,border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:13,boxSizing:'border-box',resize:'vertical'}}
          />
          <button type="button" onClick={addBulk} style={{marginTop:8,background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'9px 16px',fontWeight:500,fontSize:13,cursor:'pointer'}}>
            Ajouter tout
          </button>
        </div>
      )}

      {/* Incohérences */}
      {/* ⚠️ Rien a comparer tant que le garage est vide : on le DIT, une fois. */}
      {garageVide && stockVinted.length>0 && (
        <div style={{marginBottom:16,padding:'10px 12px',border:`1px solid ${C.border}`,borderRadius:10,background:C.card,fontSize:12.5,color:C.muted,lineHeight:1.5}}>
          Aucun numéro n'est encore posé dans le <b style={{color:C.text}}>Stock</b> : la comparaison
          avec cette liste ne dirait donc rien d'utile (elle signalerait les {stockVinted.length} numéros
          d'un coup). Range tes paires dans le Stock, et les écarts apparaîtront ici.
        </div>
      )}
      {!garageVide && (enLignePasGarage.length>0||garagePasEnLigne.length>0)&&(
        <div style={{marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:'0 0 8px',color:C.warn,display:'flex',alignItems:'center',gap:6}}><Icon name="alert" size={15}/>Incohérences avec le stock</h3>

          {enLignePasGarage.length>0&&(
            <div style={{marginBottom:10,padding:10,background:'rgba(156,106,31,0.10)',borderRadius:8}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>En ligne mais absent du stock ({enLignePasGarage.length})</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Ces annonces sont dans ton stock Vinted mais leur numéro n'est pas dans le stock.</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {enLignePasGarage.slice(0,ecartsMax).map(n=>(
                  <span key={n} style={{background:C.warn,color:'#fff',borderRadius:5,padding:'3px 8px',fontSize:12,fontWeight:500}}>{n}</span>
                ))}
              </div>
              {enLignePasGarage.length>ecartsMax && (
                <button type="button" onClick={()=>setEcartsMax(m=>m+200)}
                  style={{marginTop:8,border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:8,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  Voir plus — {ecartsMax} affichés sur {enLignePasGarage.length}
                </button>
              )}
            </div>
          )}

          {garagePasEnLigne.length>0&&(
            <div style={{padding:10,background:'rgba(0,119,130,0.08)',borderRadius:8}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Au stock mais pas en ligne ({garagePasEnLigne.length})</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Ces paires sont dans le stock mais pas dans ton stock Vinted (peut-être à mettre en ligne).</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {garagePasEnLigne.map(n=>(
                  <span key={n} style={{background:C.accent,color:C.onAccent,borderRadius:5,padding:'3px 8px',fontSize:12,fontWeight:500}}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recherche */}
      {stockVinted.length>0&&(
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher un numéro…"
          style={{width:'100%',padding:'9px 12px',border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:13,boxSizing:'border-box',marginBottom:12}}
        />
      )}

      {/* Liste des numéros en ligne */}
      {liste.length===0?(
        <div style={{textAlign:'center',color:C.muted,fontSize:13,padding:'30px 0'}}>
          {stockVinted.length===0?'Aucun numéro pour le moment. Ajoute tes annonces en ligne ci-dessus.':'Aucun résultat.'}
        </div>
      ):(
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {liste.slice(0,listeMax).map(n=>{
            // ⚠️ Le contour ambre ne veut dire quelque chose que si le garage
            // sert : sinon il est sur les 1815 pastilles a la fois, donc sur
            // aucune. Une alerte qui vise tout ne vise rien.
            const absentGarage=!garageVide && !garageNums.has(n);
            return (
              <span key={n} style={{
                display:'inline-flex',alignItems:'center',gap:6,
                background:absentGarage?'rgba(156,106,31,0.12)':(C.card2||'rgba(0,0,0,0.05)'),
                border:absentGarage?`1px solid ${C.warn}`:'1px solid transparent',
                borderRadius:8,padding:'5px 8px 5px 10px',fontSize:13,fontWeight:500
              }}>
                {n}
                <button type="button" onClick={()=>removeOne(n)} title="Retirer" style={{background:'none',border:'none',color:C.danger,cursor:'pointer',fontSize:15,lineHeight:1,padding:0,fontWeight:700}}>×</button>
              </span>
            );
          })}
        </div>
      )}
      {liste.length>listeMax && (
        <div style={{marginTop:10}}>
          <button type="button" onClick={()=>setListeMax(m=>m+200)}
            style={{border:`1px solid ${C.border}`,background:'transparent',color:C.text,borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            Voir plus — {listeMax} affichés sur {liste.length}
          </button>
        </div>
      )}
    </div>
  );
}
function Inventory({ inventory, setInventory, accounts, garageGrid, labels, onLocate }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // all | online | sold | stock
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ numero:'', title:'', status:'stock' });
  const [showImport, setShowImport] = useState(false);
  const [importState, setImportState] = useState({}); // { [accId]: {loading, items, error} }
  const [importNums, setImportNums] = useState({});   // { [itemId]: numero }
  const [editing, setEditing] = useState(null);       // pair id
  const [editDraft, setEditDraft] = useState(null);
  const bordereauInputRef = React.useRef(null);
  const bordereauPairRef = React.useRef(null);        // paire ciblee par l'annotation

  const persist = (next) => { setInventory(next); save('vinted_inventory', next); };

  // Bordereau : on demande a l'utilisateur le PDF telecharge depuis Vinted, puis
  // on y imprime le numero + le titre de la paire avant de le retelecharger.
  const startBordereau = (pair) => { bordereauPairRef.current = pair; bordereauInputRef.current?.click(); };
  const onBordereauFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    const pair = bordereauPairRef.current;
    if (!file || !pair) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast('Merci de choisir le bordereau au format PDF téléchargé depuis Vinted.'); return;
    }
    try {
      const buf = await file.arrayBuffer();
      await annotateAndDownloadBordereau(pair.numero, pair.title, buf);
    } catch (err) {
      toast('Impossible d\'annoter ce PDF : ' + String(err));
    }
  };

  // Index inverse garage : numero (normalise) -> present dans une case ?
  const garageNums = useMemo(() => {
    const s = new Set();
    Object.values(garageGrid || {}).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(v => { const t = (v||'').trim().toLowerCase(); if (t) s.add(t); });
    });
    return s;
  }, [garageGrid]);
  const inGarage = (numero) => !!numero && garageNums.has(String(numero).trim().toLowerCase());

  const accName = (accId) => (labels && labels[accId]) || accounts.find(a=>a.vinted_user_id===accId)?.login || `Compte #${accId}`;

  const numeroExists = (numero, exceptId=null) =>
    inventory.some(p => String(p.numero).trim().toLowerCase() === String(numero).trim().toLowerCase() && p.id !== exceptId);

  const addPair = () => {
    const numero = addForm.numero.trim();
    if (!numero) { toast('Indique un numéro.'); return; }
    if (numeroExists(numero)) { toast(`Le numéro ${numero} est déjà utilisé.`); return; }
    const pair = { id: uid(), numero, title: addForm.title.trim(), status: addForm.status,
      vintedItemId:null, vintedAccountId:null, price:null, photo:null, soldAt:null, transactionId:null, createdAt: tod() };
    persist([pair, ...inventory]);
    setAddForm({ numero:'', title:'', status:'stock' });
    setShowAdd(false);
  };

  const deletePair = async (id)=>{
    if (!await askConfirm('Supprimer cette paire de l\'inventaire ?')) return;
    persist(inventory.filter(p => p.id !== id));
  };

  const startEdit = (p) => { setEditing(p.id); setEditDraft({ ...p }); };
  const commitEdit = () => {
    const numero = String(editDraft.numero).trim();
    if (!numero) { toast('Le numéro ne peut pas être vide.'); return; }
    if (numeroExists(numero, editDraft.id)) { toast(`Le numéro ${numero} est déjà utilisé.`); return; }
    persist(inventory.map(p => p.id === editDraft.id ? { ...editDraft, numero } : p));
    setEditing(null); setEditDraft(null);
  };

  // Import : charge les annonces en ligne d'un compte.
  const loadListings = async (acc) => {
    setImportState(s => ({ ...s, [acc.vinted_user_id]: { loading:true } }));
    const res = await fetchVintedListings(acc);
    setImportState(s => ({ ...s, [acc.vinted_user_id]: { loading:false, items: res.ok?res.items:[], error: res.ok?null:res.error } }));
    // Pre-remplit une suggestion de numero depuis le titre (nXX) - modifiable.
    if (res.ok) {
      setImportNums(prev => {
        const u = { ...prev };
        res.items.forEach(it => { if (u[it.id] === undefined) u[it.id] = extractPairNumber(it.title) || ''; });
        return u;
      });
    }
  };

  // Associe une annonce en ligne a un numero (cree ou met a jour la paire).
  const associate = (acc, listing) => {
    const numero = String(importNums[listing.id] || '').trim();
    if (!numero) { toast('Indique le numéro à associer à cette annonce.'); return; }
    const existing = inventory.find(p => String(p.numero).trim().toLowerCase() === numero.toLowerCase());
    if (existing) {
      // On sauvegarde le titre EXACT de l'annonce : c'est ce même titre qui
      // reviendra dans la commande vendue, et qui permettra de retrouver le
      // numéro au moment de la vente (les commandes n'ont pas d'id d'article).
      persist(inventory.map(p => p.id === existing.id
        ? { ...p, title: listing.title, status:'online', vintedItemId: listing.id,
            vintedAccountId: acc.vinted_user_id, price: listing.price, photo: listing.photo }
        : p));
    } else {
      const pair = { id: uid(), numero, title: listing.title, status:'online', vintedItemId: listing.id,
        vintedAccountId: acc.vinted_user_id, price: listing.price, photo: listing.photo, soldAt:null, transactionId:null, createdAt: tod() };
      persist([pair, ...inventory]);
    }
  };

  const isListingLinked = (itemId) => inventory.some(p => p.vintedItemId === String(itemId));

  // Synchronise les VENTES depuis Vinted : recupere les commandes vendues de
  // chaque compte et bascule en "Vendu" les paires de l'inventaire dont le
  // numero (nXX) apparait dans le titre de la commande. Ne touche jamais une
  // paire deja marquee vendue, ni une commande annulee/remboursee.
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const syncSalesFromVinted = async () => {
    if (accounts.length === 0) { setSyncResult({ msg:'Aucun compte Vinted lié.' }); return; }
    setSyncing(true); setSyncResult(null);
    // Matching par TITRE : les annonces Vinted n'exposent pas d'id d'article
    // dans les commandes, seulement le titre exact. On a sauvegardé ce titre
    // sur chaque paire au moment de l'association -> on relie ainsi la vente au
    // numéro sans dépendre d'un "nXX" dans le titre.
    const byTitle = new Map();
    inventory.forEach(p => { const k = normTitle(p.title); if (k) byTitle.set(k, p); });
    const updates = new Map(); // id -> patch
    let sold = 0, pending = 0, scanned = 0;
    for (const acc of accounts) {
      // Priorité aux ventes moissonnées par l'extension (aucun appel Vinted).
      // Sinon repli sur le proxy (jusqu'à 3 pages).
      const harvested = await fetchHarvest(acc.vinted_user_id, 'orders');
      let pages;
      if (harvested && Array.isArray(harvested.my_orders)) {
        pages = [harvested.my_orders];
      } else {
        pages = [];
        for (let page = 1; page <= 3; page++) {
          const res = await fetchVintedOrders(acc, 'sold', page, 'all');
          if (!res.ok) break;
          pages.push(res.items || []);
          if (!res.pagination || page >= (res.pagination.total_pages || 1)) break;
        }
      }
      for (const orders of pages) {
        scanned += orders.length;
        for (const o of orders) {
          const cls = classifyOrderStatus(o.status);
          const pair = byTitle.get(normTitle(o.title));
          if (!pair) continue;
          const base = {
            transactionId: o.transaction_id || pair.transactionId || null,
            photo: pair.photo || orderPhoto(o) || null,
            price: pair.price ?? (o.price?.amount != null ? Number(o.price.amount) : null),
            vintedAccountId: pair.vintedAccountId || acc.vinted_user_id,
          };
          if (cls === 'completed') {
            // Vente FINALISÉE = argent reçu -> on la comptabilise.
            if (pair.status !== 'sold') { updates.set(pair.id, { ...base, status:'sold', soldAt: o.date ? new Date(o.date).toLocaleDateString('fr-FR') : tod() }); sold++; }
          } else if (cls === 'cancelled') {
            // Annulée/remboursée : si on l'avait mise "en cours", on la remet en ligne.
            if (pair.status === 'pending_sale') updates.set(pair.id, { status:'online' });
          } else {
            // Vente en cours (expédiée, en acheminement...) : on l'affiche mais on
            // NE la compte PAS tant que l'acheteur n'a pas validé (argent reçu).
            if (pair.status === 'online' || pair.status === 'stock') { updates.set(pair.id, { ...base, status:'pending_sale' }); pending++; }
          }
        }
      }
    }
    if (updates.size > 0) {
      persist(inventory.map(p => updates.has(p.id) ? { ...p, ...updates.get(p.id) } : p));
    }
    setSyncing(false);
    setSyncResult({ sold, pending, scanned });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inventory
      .filter(p => filter === 'all' ? true : p.status === filter)
      .filter(p => !term || String(p.numero).toLowerCase().includes(term) || (p.title||'').toLowerCase().includes(term))
      .sort((a,b) => {
        const na = parseInt(a.numero,10), nb = parseInt(b.numero,10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return String(a.numero).localeCompare(String(b.numero));
      });
  }, [inventory, q, filter]);

  const counts = useMemo(() => ({
    all: inventory.length,
    online: inventory.filter(p=>p.status==='online').length,
    pending_sale: inventory.filter(p=>p.status==='pending_sale').length,
    sold: inventory.filter(p=>p.status==='sold').length,
    stock: inventory.filter(p=>p.status==='stock').length,
  }), [inventory]);

  const inputStyle = { padding:'8px 10px', borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:13 };
  const btn = (bg, fg='#fff') => ({ padding:'8px 12px', borderRadius:8, border:'none', background:bg, color:fg, fontWeight:500, fontSize:13, cursor:'pointer' });

  return (
    <div style={{padding:'0 4px'}}>
      <input ref={bordereauInputRef} type="file" accept="application/pdf,.pdf" onChange={onBordereauFile} style={{display:'none'}}/>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
        <StatBox label="Paires" value={counts.all}/>
        <StatBox label="En ligne" value={counts.online} color={INV_STATUS.online.color}/>
        <StatBox label="Vente en cours" value={counts.pending_sale} color={INV_STATUS.pending_sale.color}/>
        <StatBox label="Vendues" value={counts.sold} color={INV_STATUS.sold.color} sub="argent reçu"/>
        <StatBox label="En stock" value={counts.stock} color={INV_STATUS.stock.color}/>
      </div>

      <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un numéro ou un titre…"
          style={{...inputStyle, flex:1, minWidth:180}}/>
        <button type="button" onClick={()=>{setShowAdd(v=>!v);setShowImport(false);}} style={btn(C.accent)}>➕ Ajouter</button>
        <button type="button" onClick={()=>{setShowImport(v=>!v);setShowAdd(false);}} style={btn(C.blue||C.accent)}>🔄 Importer mes annonces</button>
        <button type="button" onClick={syncSalesFromVinted} disabled={syncing} style={{...btn(INV_STATUS.sold.color),opacity:syncing?0.6:1,cursor:syncing?'default':'pointer'}}>
          {syncing ? 'Synchronisation…' : '💸 Mettre à jour les ventes'}
        </button>
      </div>

      {syncResult && (
        <div style={{fontSize:12,marginBottom:12,padding:'8px 12px',borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text}}>
          {syncResult.msg
            ? syncResult.msg
            : ((syncResult.sold + syncResult.pending) > 0
                ? `✅ ${syncResult.sold} vente(s) finalisée(s) comptée(s)${syncResult.pending?`, ${syncResult.pending} en cours (non comptée(s), en attente de validation)`:''} — sur ${syncResult.scanned} commandes analysées.`
                : `Aucune vente à reporter (${syncResult.scanned} commandes analysées). Chaque paire doit avoir le même titre que son annonce Vinted (via « Importer mes annonces »).`)}
        </div>
      )}

      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {[['all','Toutes'],['online','En ligne'],['pending_sale','En cours'],['sold','Vendues'],['stock','Stock']].map(([id,label]) => (
          <button key={id} type="button" onClick={()=>setFilter(id)}
            style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${filter===id?C.accent:C.border}`,
              background:filter===id?C.accent:'transparent',color:filter===id?'#fff':C.muted,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
              boxShadow:filter===id?`0 2px 8px ${C.accent}44`:'none',transition:'all .18s ease'}}>
            {label} <span style={{opacity:0.7}}>({counts[id]})</span>
          </button>
        ))}
      </div>

      {showAdd && (
        <Card style={{marginBottom:14}}>
          <div style={{fontWeight:600,marginBottom:10,color:C.text}}>Nouvelle paire</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
            <input value={addForm.numero} onChange={e=>setAddForm(f=>({...f,numero:e.target.value}))} placeholder="Numéro (ex : 2057)" style={{...inputStyle,width:150}}/>
            <input value={addForm.title} onChange={e=>setAddForm(f=>({...f,title:e.target.value}))} placeholder="Titre (ex : Adidas Spezial 38)" style={{...inputStyle,flex:1,minWidth:180}}/>
            <select value={addForm.status} onChange={e=>setAddForm(f=>({...f,status:e.target.value}))} style={inputStyle}>
              <option value="stock">📦 Stock</option>
              <option value="online">🟢 En ligne</option>
              <option value="sold">💸 Vendu</option>
            </select>
            <button type="button" onClick={addPair} style={btn(C.accent)}>Enregistrer</button>
          </div>
        </Card>
      )}

      {showImport && (
        <Card style={{marginBottom:14}}>
          <div style={{fontWeight:600,marginBottom:4,color:C.text}}>Importer mes annonces en ligne</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            Charge tes annonces Vinted actuellement en ligne, puis attribue à chacune son numéro et clique « Associer ».
            {' '}Si le titre contient déjà « nXX », le numéro est pré-rempli (tu peux le corriger).
          </div>
          {accounts.length === 0 && <div style={{fontSize:13,color:C.muted}}>Aucun compte Vinted lié.</div>}
          {accounts.map(acc => {
            const st = importState[acc.vinted_user_id] || {};
            return (
              <div key={acc.vinted_user_id} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{fontWeight:500,color:C.text,fontSize:13}}>{accName(acc.vinted_user_id)}</div>
                  <button type="button" onClick={()=>loadListings(acc)} style={{...btn(C.blue||C.accent),padding:'5px 10px',fontSize:12}}>
                    {st.loading ? 'Chargement…' : (st.items ? 'Recharger' : 'Charger les annonces')}
                  </button>
                </div>
                {st.error && <div style={{fontSize:12,color:C.danger}}>Erreur : {String(st.error)}</div>}
                {st.items && st.items.length === 0 && <div style={{fontSize:12,color:C.muted}}>Aucune annonce en ligne sur ce compte.</div>}
                {st.items && st.items.length > 0 && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',gap:12}}>
                    {st.items.map(listing => {
                      const linked = isListingLinked(listing.id);
                      return (
                        <div key={listing.id} style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden',background:C.bg,opacity:linked?0.6:1}}>
                          <div style={{width:'100%',aspectRatio:'1/1',background:C.border,display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {listing.photo ? <PhotoVinted src={listing.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:26}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
                          </div>
                          <div style={{padding:8}}>
                            <div title={listing.title} style={{fontSize:11,fontWeight:600,color:C.text,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',minHeight:28}}>{listing.title}</div>
                            {linked ? (
                              <div style={{fontSize:11,color:INV_STATUS.online.color,fontWeight:500,marginTop:6}}>✓ Associée</div>
                            ) : (
                              <div style={{display:'flex',gap:4,marginTop:6}}>
                                <input value={importNums[listing.id] ?? ''} onChange={e=>setImportNums(n=>({...n,[listing.id]:e.target.value}))}
                                  placeholder="N°" style={{...inputStyle,width:52,padding:'5px 6px'}}/>
                                <button type="button" onClick={()=>associate(acc, listing)} style={{...btn(C.accent),padding:'5px 8px',fontSize:11,flex:1}}>Associer</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {filtered.length === 0 && (
        <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'30px 0'}}>
          {inventory.length === 0 ? 'Ton inventaire est vide. Ajoute une paire ou importe tes annonces en ligne.' : 'Aucune paire pour ce filtre.'}
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(p => {
          const stt = INV_STATUS[p.status] || INV_STATUS.stock;
          const garage = inGarage(p.numero);
          return (
            <div key={p.id} style={{display:'flex',gap:12,alignItems:'center',padding:11,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,boxShadow:C.shadow||'none'}}>
              <div style={{width:52,height:52,borderRadius:8,background:C.border,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                {p.photo ? <PhotoVinted src={p.photo} alt="" loading="lazy" decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:22}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
              </div>
              <div style={{flexShrink:0,minWidth:54,textAlign:'center'}}>
                <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>N°</div>
                <div style={{fontSize:20,fontWeight:700,color:C.text,lineHeight:1}}>{p.numero}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title || <span style={{color:C.muted,fontStyle:'italic'}}>Sans titre</span>}</div>
                <div style={{display:'flex',gap:6,alignItems:'center',marginTop:5,flexWrap:'wrap'}}>
                  <Badge color={stt.color}>{stt.icon} {stt.label}</Badge>
                  <button type="button" onClick={()=>garage && onLocate && onLocate(p.numero)}
                    title={garage?'Voir dans le stock':'Ce numéro n\'apparaît dans aucune case du stock'}
                    style={{border:'none',background:'transparent',cursor:garage?'pointer':'default',padding:0,fontSize:11,fontWeight:500,color:garage?C.blue||C.accent:C.muted}}>
                    {garage ? 'Au stock' : 'Absent du stock'}
                  </button>
                  {p.price != null && <span style={{fontSize:11,color:C.muted}}>{p.price} €</span>}
                  {p.vintedItemId && <span style={{fontSize:11,color:C.muted}}>🔗 annonce liée</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button className="vrm-icon-control" aria-label="Générer le bordereau annoté (numéro + titre)" type="button" title="Générer le bordereau annoté (numéro + titre)" onClick={()=>startBordereau(p)} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`,padding:'6px 10px'}}><Icon name="doc" size={16}/></button>
                <button className="vrm-icon-control" aria-label="Modifier la paire" type="button" onClick={()=>startEdit(p)} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`,padding:'6px 10px'}}>✏️</button>
                <button className="vrm-icon-control" aria-label="Supprimer la paire" type="button" onClick={()=>deletePair(p.id)} style={{...btn('transparent',C.danger),border:`1px solid ${C.border}`,padding:'6px 10px'}}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && editDraft && (
        <div onClick={()=>{setEditing(null);setEditDraft(null);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <FermeAuRetour fermer={()=>{setEditing(null);setEditDraft(null);}}/>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:10,padding:20,width:'100%',maxWidth:420}}>
            <div style={{fontWeight:600,fontSize:15,color:C.text,marginBottom:14}}>Modifier la paire</div>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Numéro</label>
            <input value={editDraft.numero} onChange={e=>setEditDraft(d=>({...d,numero:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Titre</label>
            <input value={editDraft.title||''} onChange={e=>setEditDraft(d=>({...d,title:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Statut</label>
            <select value={editDraft.status} onChange={e=>setEditDraft(d=>({...d,status:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:16}}>
              <option value="stock">📦 Stock</option>
              <option value="online">🟢 En ligne</option>
              <option value="pending_sale">⏳ Vente en cours</option>
              <option value="sold">💸 Vendu</option>
            </select>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button type="button" onClick={()=>{setEditing(null);setEditDraft(null);}} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`}}>Annuler</button>
              <button type="button" onClick={commitEdit} style={btn(C.accent)}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function RepartitionsVentes({ panelOff }) {
  const { ventes, ko } = useVentesCoque();
  const [extras, setExtras] = React.useState(undefined);
  React.useEffect(() => { let mort = false; lireExtrasRepartition().then((x) => { if (!mort) setExtras(x); }).catch(() => { if (!mort) setExtras({ txn: null, items: null, dates: null }); }); return () => { mort = true; }; }, []);
  const [mode, setMode] = React.useState('marques');
  const R = React.useMemo(() => {
    if (!Array.isArray(ventes)) return null;
    const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    const ecarte = (o) => compteEcarte(o && o._acc && o._acc.vinted_user_id, hAcc, panelOff || {});
    const x = extras || {};
    return repartitionsVentes({ ventes, txn: extras ? x.txn : {}, items: extras ? x.items : null, dates: x.dates, ecarte });
  }, [ventes, extras, panelOff]);
  const sCarte = {padding:18,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:C.shadow};
  const sNote = {fontSize:13,color:C.muted,lineHeight:1.5};
  const titre = <div style={{fontSize:15,fontWeight:600,color:C.text,letterSpacing:-0.15}}>Ce qui se vend</div>;
  if (ventes === undefined) return <div data-stats-carte="repartitions" data-repart-etat="encours" style={sCarte}>{titre}<div style={{...sNote,marginTop:8}}>Je lis tes ventes…</div></div>;
  if (!R) return <div data-stats-carte="repartitions" data-repart-etat="passu" style={sCarte}>{titre}<div style={{...sNote,marginTop:8}}>Tes ventes n'ont pas pu être lues : aucune répartition plutôt qu'une répartition fausse. Rouvre l'écran dans un moment.</div></div>;
  const libelles = { marques: 'Marques', tailles: 'Tailles', modeles: 'Modèles', pays: 'Pays' };
  const bloc = R[mode];
  const lignes = bloc ? Object.values(bloc.par).sort((a, b) => b.n - a.n || b.eur - a.eur) : [];
  const top = lignes.slice(0, 6);
  const autres = lignes.slice(6).reduce((a, e) => ({ n: a.n + e.n, eur: a.eur + e.eur, k: a.k + 1 }), { n: 0, eur: 0, k: 0 });
  const maxN = Math.max(1, ...top.map((e) => e.n));
  const lib = (k) => mode === 'pays' ? nomPays(k) : mode === 'tailles' && /^\d/.test(k) ? `T${k}` : k;
  const extrasPasSu = extras && extras.txn === null;
  const delai = R.delai;
  const jFmt = (j) => (j < 1 ? 'moins d’un jour' : `${Math.round(j)} j`);
  const manque = (ko || []).length;
  return (
    <div data-stats-carte="repartitions" data-repart-etat="lu" data-repart-total={R.total} style={sCarte}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
        {titre}
        <span style={{fontSize:13,color:C.muted}}>{R.total} vente{R.total > 1 ? 's' : ''} Vinted, tous comptes</span>
      </div>
      {/* Le temps de vente : la moyenne, la médiane, et SUR combien de ventes. */}
      <div data-repart-delai={delai && delai.n ? Math.round(delai.moyenne * 10) / 10 : ''} data-repart-delai-n={delai ? delai.n : ''} style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'4px 16px',marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:13,color:C.muted,fontWeight:500}}>Temps moyen de vente</div>
          <div className="vrm-display" style={{fontSize:20,fontWeight:700,color:delai && delai.n ? C.text : C.muted,letterSpacing:-0.5,marginTop:4,fontVariantNumeric:'tabular-nums'}}>{delai && delai.n ? jFmt(delai.moyenne) : '—'}</div>
        </div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:13,color:C.muted,fontWeight:500}}>La moitié part en</div>
          <div className="vrm-display" style={{fontSize:20,fontWeight:700,color:delai && delai.n ? C.text : C.muted,letterSpacing:-0.5,marginTop:4,fontVariantNumeric:'tabular-nums'}}>{delai && delai.n ? jFmt(delai.mediane) : '—'}</div>
        </div>
        <div style={{...sNote,fontSize:11,gridColumn:'1 / -1',marginTop:2}}>
          {extras === undefined ? 'Je lis les dates de mise en ligne…'
            : !delai ? "Tes annonces n'ont pas pu être lues : le temps de vente n'est pas calculé."
            : delai.n === 0 ? "Aucune vente n'a encore sa date de mise en ligne connue."
            : <>De la mise en ligne à la vente · sur {delai.n} vente{delai.n > 1 ? 's' : ''} dont la date de mise en ligne est connue (sur {R.total}) · {delai.rapide} en moins d'une semaine.</>}
        </div>
      </div>
      <div role="group" aria-label="Répartition" style={{display:'flex',gap:3,background:C.card2||C.bg,borderRadius:8,padding:3,marginTop:14,width:'fit-content',maxWidth:'100%',flexWrap:'wrap'}}>
        {Object.entries(libelles).map(([k, l]) => (
          <button key={k} type="button" data-repart-mode={k} aria-pressed={mode === k} onClick={() => setMode(k)} style={{border:'none',borderRadius:999,padding:'5px 12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minHeight:32,background:mode === k ? C.card : 'transparent',color:mode === k ? C.text : C.muted,boxShadow:mode === k ? C.shadow : 'none'}}>{l}</button>
        ))}
      </div>
      <div data-repart-liste={mode} style={{marginTop:12}}>
        {mode === 'pays' && extrasPasSu ? <div style={sNote}>Le détail de tes transactions n'a pas pu être lu : le pays de tes clients n'est pas affiché plutôt qu'un pays faux.</div>
          : mode === 'pays' && extras === undefined ? <div style={sNote}>Je lis le pays de tes clients…</div>
          : !top.length ? <div style={sNote}>Rien à répartir pour l'instant.</div>
          : <div style={{display:'flex',flexDirection:'column',gap:9}}>
              {top.map((e) => (
                <div key={e.k} data-repart-ligne={e.k} data-repart-n={e.n} style={{display:'grid',gridTemplateColumns:'minmax(70px, 34%) 1fr auto',alignItems:'center',gap:10}}>
                  <span style={{fontSize:13,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={lib(e.k)}>{lib(e.k)}</span>
                  <div style={{height:8,background:C.card2||C.bg,borderRadius:5,overflow:'hidden'}}><div style={{width:`${Math.max(4, e.n / maxN * 100)}%`,height:'100%',background:C.accent,borderRadius:5}}/></div>
                  <span style={{fontSize:13,color:C.muted,whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums',textAlign:'right'}}><b style={{color:C.text,fontWeight:600}}>{e.n}</b> · {fmt(e.eur)}</span>
                </div>
              ))}
              {autres.n > 0 && <div style={{fontSize:13,color:C.muted}}>+ {autres.k} autre{autres.k > 1 ? 's' : ''} · {autres.n} vente{autres.n > 1 ? 's' : ''} · {fmt(autres.eur)}</div>}
            </div>}
        {bloc && <div data-repart-couverture={`${bloc.n}/${R.total}`} style={{...sNote,fontSize:11,marginTop:10}}>
          Sur {bloc.n} vente{bloc.n > 1 ? 's' : ''} dont {mode === 'pays' ? 'le pays du client' : mode === 'marques' ? 'la marque' : mode === 'tailles' ? 'la taille' : 'le modèle'} est connu{mode === 'marques' || mode === 'tailles' ? 'e' : ''} (sur {R.total}){mode === 'pays' ? ' · lu dans le détail de la transaction' : mode === 'modeles' ? ' · lu dans le titre' : ' · lue sur l’annonce, sinon dans le titre'}.
        </div>}
        {manque > 0 && <div style={{...sNote,fontSize:11,marginTop:4}}>Sans {manque} compte{manque > 1 ? 's' : ''} dont les ventes n'ont pas pu être lues.</div>}
      </div>
    </div>
  );
}

export { Dashboard, Inventory, Sales, Catalog, StockVinted };
