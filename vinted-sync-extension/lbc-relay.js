// Relais installé avant les premières réponses réseau de Leboncoin.
(function(){
  if(window.__vrmLbcRelayLoaded)return;window.__vrmLbcRelayLoaded=true;
  // ⚠️ 5.379 (15 nov., Julien sur Orion iPhone : « Leboncoin marche pas » — leboncoin.fr
  //    reste NOIRE, seuls un bandeau du site et le logo VRM s'affichent).
  //  · Un cadre posé par un AUTRE site (un parent qui n'est pas leboncoin.fr) : rien.
  //  · LE DISJONCTEUR. Si la page ne s'est pas dessinée (presque aucun texte, aucun champ,
  //    aucune grande image ni cadre — un captcha est un grand cadre : il compte comme
  //    dessiné) alors que VRM est branché, chargement fini et page visible depuis 12 s,
  //    trois mesures de suite, VRM se met DE CÔTÉ pour CET onglet : `vrm_lbc_de_cote`
  //    dans le sessionStorage de l'onglet (30 min ; un nouvel onglet repart branché),
  //    puis la page est rechargée UNE fois. Rechargée, rien de VRM ne tourne dans la page
  //    (lbc-inject.js, ce relais et lbc.js s'arrêtent à leur première ligne) ; seule la
  //    carte le dit (vrm-badge.js). Et on MESURE encore : la page s'affiche sans VRM
  //    (« affichee-sans-vrm » : VRM était en cause) ou reste vide (« vide-sans-vrm » : ce
  //    n'est pas VRM) — le fond le note (`lbcDisjoncteur`, rapport). Jamais deux
  //    rechargements : la marque posée et RELUE d'abord, sinon rien.
  const CLE_DE_COTE='vrm_lbc_de_cote',DE_COTE_MS=1800000;
  const lireDeCote=()=>{try{const v=JSON.parse(sessionStorage.getItem(CLE_DE_COTE)||'null');const age=Date.now()-Number(v&&v.t);return v&&typeof v==='object'&&age>=0&&age<DE_COTE_MS?v:null;}catch(_){return null;}};
  const cadreEtranger=()=>{try{const t=window.top;if(!t||typeof t!=='object'||t===window)return false;const ao=location.ancestorOrigins;if(ao&&typeof ao.length==='number'&&ao.length){for(let i=0;i<ao.length;i++)if(!/^https:\/\/([a-z0-9-]+\.)*leboncoin\.fr$/i.test(String(ao[i])))return true;return false;}return !/(^|\.)leboncoin\.fr$/i.test(String(t.location.hostname));}catch(_){return true;}};
  if(cadreEtranger())return;
  // Ce qui se VOIT dans la page (le logo et la carte VRM exclus). Les conteneurs du haut
  // rendus transparents ne comptent pas ; `innerText` ignore déjà ce qui est caché.
  const mesurerPage=()=>{
    const b=document.body;if(!b)return{vide:true,texte:0,boites:0,champs:0,grand:false};
    const W=Math.max(1,innerWidth||0),H=Math.max(1,innerHeight||0),transparents=new Set();
    const voir=(el,prof)=>{for(const c of el.children){if(c.id==='vrm-badge'){transparents.add(c);continue;}let s=null;try{s=getComputedStyle(c);}catch(_){}if(s&&Number(s.opacity)<0.05){transparents.add(c);continue;}if(prof<3)voir(c,prof+1);}};
    voir(b,1);
    const net=x=>String(x||'').replace(/\s+/g,' ').trim().length;
    let texte=0;try{texte=net(b.innerText);for(const c of transparents)texte-=net(c.innerText);}catch(_){}
    let boites=0,champs=0,grand=false,n=0;const pile=[b];
    while(pile.length&&n<4000){const el=pile.pop();n++;for(const c of el.children)if(!transparents.has(c))pile.push(c);if(el===b)continue;
      const r=el.getBoundingClientRect();if(r.width<2||r.height<2||r.bottom<=0||r.right<=0||r.top>=H||r.left>=W)continue;
      boites++;const tag=String(el.tagName||'').toUpperCase();
      if(/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(tag))champs++;
      if(/^(IMG|VIDEO|CANVAS|IFRAME|SVG|PICTURE|OBJECT|EMBED)$/.test(tag)&&r.width*r.height>=W*H*0.2)grand=true;}
    return{vide:texte<250&&champs<3&&!grand&&boites<80,texte,boites,champs,grand};
  };
  const signalerDisjoncteur=quoi=>{try{chrome.runtime.sendMessage({from:'cancale-lbc',action:'lbcDisjoncteur',quoi},()=>{void chrome.runtime.lastError;});}catch(_){}};
  const disjoncteur=deCote=>{
    try{
      if(typeof document==='undefined'||typeof location==='undefined'||window.top!==window)return;
      if(deCote&&deCote.apres)return;                       // déjà jugée sans VRM
      const banc=globalThis.__vrmBancDisjoncteur;            // les bancs seulement (monde isolé : la page ne peut pas l'écrire)
      const R=Object.assign({pas:2000,attente:12000,essais:3,fin:90000},banc&&typeof banc==='object'?banc:{});
      let visible=0,vides=0,ecoule=0;
      const id=setInterval(()=>{
        try{
          ecoule+=R.pas;
          if(document.visibilityState==='visible')visible+=R.pas;else return;
          if(visible>R.fin||ecoule>R.fin*3){clearInterval(id);return;}
          if(visible<R.attente||(document.readyState!=='complete'&&visible<R.attente*2))return;
          const m=mesurerPage();
          if(!m.vide){clearInterval(id);if(deCote){try{sessionStorage.setItem(CLE_DE_COTE,JSON.stringify(Object.assign({},deCote,{apres:'affichee'})));}catch(_){}signalerDisjoncteur('affichee-sans-vrm');}return;}
          if(++vides<R.essais)return;
          clearInterval(id);
          if(deCote){try{sessionStorage.setItem(CLE_DE_COTE,JSON.stringify(Object.assign({},deCote,{apres:'vide'})));}catch(_){}signalerDisjoncteur('vide-sans-vrm');return;}
          try{sessionStorage.setItem(CLE_DE_COTE,JSON.stringify({t:Date.now(),quoi:'page-vide',chemin:String(location.pathname||'').slice(0,80)}));}catch(_){}
          if(!lireDeCote())return;                           // marque pas posée : jamais de rechargement (pas de boucle)
          signalerDisjoncteur('mis-de-cote');
          setTimeout(()=>{try{location.reload();}catch(_){}},300);
        }catch(_){try{clearInterval(id);}catch(__){}}
      },R.pas);
    }catch(_){}
  };
  const deCoteIci=lireDeCote();
  disjoncteur(deCoteIci);
  if(deCoteIci)return;                                       // VRM s'est mis de côté sur cet onglet : ni relais, ni ordres
  const vus=new Set();
  // ⚠️⚠️ 5.362 (revue, moyennes 60 et 63) — LE CANAL PRIVÉ DES ORDRES. lbc-inject.js
  //   (monde MAIN, document_start, avant tout script de la page) nous remet le second
  //   port d'un `MessageChannel`, UNE fois. Les ordres du fond partent par lui, et seuls
  //   ses messages comptent pour les résultats et la recette « apprise » : un script de
  //   la page ne lit plus le jeton ni le texte, et ne peut plus poster un faux résultat.
  let canalOrdres=null;
  const traiterCanal=d=>{
    if(!d||typeof d!=='object'||d.__tag!=='CANCALE_LBC')return;
    // 5.416 : ce que la PAGE a envoyé (preuve d'un geste par l'interface), la conversation qu'elle a chargée,
    // et l'état lu (compte privé, dernière conversation) — pour lbc-ecrire.js seulement (même monde isolé).
    if(d.kind==='lbcgestevu'||d.kind==='lbcconvvue'){for(const f of ecoutesEcrire.slice())try{f(d);}catch(_){}return;}
    if(d.kind==='lbcetat'&&typeof d.jeton==='string'){const r=etatsEnAttente.get(d.jeton);if(r){etatsEnAttente.delete(d.jeton);r({moi:/^[a-z0-9_-]{1,64}$/i.test(String(d.moi||''))?String(d.moi):'',conv:/^[\w-]{3,64}$/.test(String(d.conv||''))?String(d.conv):'',convAt:Number(d.convAt)||0});}return;}
    // 5.370 : l'import de l'historique (modèle vu, résultat d'une page) — canal privé seulement.
    if(d.kind==='lbcimportmodele'&&typeof d.url==='string'){try{chrome.runtime.sendMessage({from:'cancale-lbc',action:'lbcImportModele',url:d.url.slice(0,600),moi:/^[a-z0-9_-]{1,64}$/i.test(String(d.moi||''))?String(d.moi):''});}catch(_){}}
    else if(d.kind==='lbcimportresultat'&&typeof d.jeton==='string'){const r=importsEnAttente.get(d.jeton);if(r){importsEnAttente.delete(d.jeton);r({ ok: true, statut: Number(d.statut) || 0, erreur: String(d.erreur || '').slice(0, 40), url: typeof d.url === 'string' ? d.url.slice(0, 600) : '', corps: typeof d.corps === 'string' ? d.corps.slice(0, 200000) : '', session: typeof d.session === 'string' ? d.session.slice(0, 80) : '', moi: /^[a-z0-9_-]{1,64}$/i.test(String(d.moi || '')) ? String(d.moi) : '' }); } }
  };
  window.addEventListener('message',event=>{
    try{
      if(canalOrdres||event.source!==window||event.origin!==location.origin)return;
      const d=event.data;
      if(!d||d.__tag!=='CANCALE_LBC_CANAL'||!event.ports||!event.ports[0])return;
      canalOrdres=event.ports[0];
      canalOrdres.onmessage=e=>{try{traiterCanal(e&&e.data);}catch(_){}};
    }catch(_){}
  },false);
  const versCapteur=m=>{if(!canalOrdres)return false;try{canalOrdres.postMessage(m);return true;}catch(_){return false;}};
  const importsEnAttente=new Map();    // 5.365 : jeton → réponse au fond (une page de l'historique)
  // 5.416 (21 nov., « on ne fait plus les requêtes ») — LE PONT VERS lbc-ecrire.js. Les ordres d'écriture
  // (pause, suppression, réponse, prix) ne passent PLUS par ici : lbc-ecrire.js agit dans la page (clics,
  // frappes) et ce relais ne lui remet que ce que le capteur a VU (`lbcgestevu`, `lbcconvvue`) et l'état lu
  // (`etat`, une lecture). Le pont vit dans le monde isolé de l'extension : la page ne le voit pas.
  const ecoutesEcrire=[];
  const etatsEnAttente=new Map();
  try{
    if(window.top===window)Object.defineProperty(window,'__vrmLbcPont',{value:Object.freeze({
      ecouter:fn=>{if(typeof fn==='function'&&ecoutesEcrire.length<8)ecoutesEcrire.push(fn);},
      pret:()=>!!canalOrdres,
      etat:()=>new Promise(res=>{
        const jeton=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2,12));
        const t=setTimeout(()=>{if(etatsEnAttente.delete(jeton))res(null);},3000);
        etatsEnAttente.set(jeton,r=>{clearTimeout(t);res(r);});
        if(!versCapteur({__tag:'CANCALE_LBC_ORDRE',kind:'etat',jeton})){etatsEnAttente.delete(jeton);clearTimeout(t);res(null);}
      }),
    }),configurable:false,writable:false});
  }catch(_){}
  const diagnostic=(capteur,capteurVersion)=>{try{chrome.runtime.sendMessage({from:'cancale-lbc',action:'lbcTransport',capteur,relaisVersion:'5.454.1',capteurVersion});}catch(_){}};
  diagnostic(false);
  // Enregistrer l'identité avant de traiter les annonces arrivées ensuite.
  const file=[];let enCours=false,tailleFile=0,identiteRefusee=false;
  const signaler=erreurCapture=>{try{chrome.runtime.sendMessage({from:'cancale-lbc',action:'lbcTransport',capteur:true,erreurCapture});}catch(_){}};
  // 5.335 (9 nov.) : ce que la page a lu PENDANT que l'extension n'était pas
  // connectée à VRM (le fond répond `sansSession`) n'est plus jeté : gardé ici
  // (en mémoire, ce document seulement, 48 messages / 4 Mo / 30 min au plus) et
  // rejoué — l'identité d'abord, par la même garde — dès qu'une session existe.
  // Avant, ce « non » passait pour un refus DÉFINITIF de l'identité : toutes les
  // annonces du document étaient jetées, rien n'était relu après la connexion.
  const REJOUABLES=['lbcSessionPrivee','lbcRaw','lbcVente','lbcListeComplete'];
  let enAttenteSession=[],octetsSession=0,identiteEnAttente=false,minuterieSession=null,attenteDepuis=0;
  const garderPourSession=(m,taille)=>{
    if(m.action==='lbcSessionPrivee'){enAttenteSession=enAttenteSession.filter(x=>x.m.action!=='lbcSessionPrivee');identiteEnAttente=true;}
    enAttenteSession.push({m,taille});octetsSession+=taille;
    while(enAttenteSession.length>48||octetsSession>4000000){const i=enAttenteSession.findIndex(x=>x.m.action!=='lbcSessionPrivee');if(i<0)break;octetsSession-=enAttenteSession[i].taille;enAttenteSession.splice(i,1);}
    if(!attenteDepuis)attenteDepuis=Date.now();
    if(!minuterieSession)minuterieSession=setInterval(sonderSession,30000);
  };
  const rejouer=()=>{
    if(!enAttenteSession.length)return 0;
    const tout=enAttenteSession;enAttenteSession=[];octetsSession=0;identiteEnAttente=false;attenteDepuis=0;
    if(minuterieSession){clearInterval(minuterieSession);minuterieSession=null;}
    tout.sort((a,b)=>(a.m.action==='lbcSessionPrivee'?0:1)-(b.m.action==='lbcSessionPrivee'?0:1));
    for(const x of tout)transmettre(x.m);
    return tout.length;
  };
  const sonderSession=()=>{
    if(!enAttenteSession.length||Date.now()-attenteDepuis>1800000){enAttenteSession=[];octetsSession=0;identiteEnAttente=false;attenteDepuis=0;if(minuterieSession){clearInterval(minuterieSession);minuterieSession=null;}return;}
    try{chrome.runtime.sendMessage({from:'cancale-lbc',action:'lbcSessionPrete'},r=>{void chrome.runtime.lastError;if(r&&r.ok===true)rejouer();});}catch(_){}
  };
  const transmettre=m=>{
    if(identiteRefusee&&['lbcRaw','lbcVente'].includes(m.action)&&String(m.session||'').startsWith('lbc-account:'))return;
    // L'identité attend la session : ses listes l'attendent avec elle (sinon le fond,
    // connecté entre-temps, les refuserait faute de compte enregistré).
    if(identiteEnAttente&&['lbcRaw','lbcVente'].includes(m.action)&&String(m.session||'').startsWith('lbc-account:')){garderPourSession(m,new TextEncoder().encode(JSON.stringify(m)).length);return;}
    const taille=new TextEncoder().encode(JSON.stringify(m)).length;
    if(taille>3500000||file.length>=64||tailleFile+taille>4000000){signaler('taille');return;}
    file.push({m,taille});tailleFile+=taille;vider();
  };
  const vider=()=>{
    if(enCours||!file.length)return;enCours=true;
    const {m,taille}=file.shift();tailleFile-=taille;
    let fini=false;const suite=(ok,sansSession)=>{
      if(fini)return;fini=true;clearTimeout(timer);
      if(m.action==='lbcVente'&&Number.isSafeInteger(m.sequence))try{window.postMessage({__tag:'CANCALE_LBC_ACCUSE',sequence:m.sequence,ok:ok===true},'*');}catch(_){}
      if(!ok&&sansSession===true&&REJOUABLES.includes(m.action)){
        garderPourSession(m,taille);
        if(m.action==='lbcSessionPrivee')signaler('session');
        enCours=false;vider();return;
      }
      if(m.action==='lbcSessionPrivee'){
        identiteRefusee=!ok;signaler(ok?null:'identite');
        if(!ok){for(let i=file.length-1;i>=0;i--)if(['lbcRaw','lbcVente'].includes(file[i].m.action)){tailleFile-=file[i].taille;file.splice(i,1);}}
      }
      enCours=false;vider();
    };
    const timer=setTimeout(()=>suite(false),20000);
    try{chrome.runtime.sendMessage(m,r=>{const erreur=chrome.runtime.lastError;suite(!erreur&&r?.ok===true,!erreur&&r?.sansSession===true);});}catch(_){suite(false);}
  };
  // L'observateur réseau MAIN world (lbc-inject.js) est injecté via le manifest
  // (content_script world:MAIN) → immunisé à la CSP de Leboncoin. Ici on ne fait
  // que RELAYER au background ce qu'il capte (window.postMessage).
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if(d?.__tag==='CANCALE_LBC_CAPTEUR'){diagnostic(true,d.version);if(d.kind==='pret')window.postMessage({__tag:'CANCALE_LBC_RELAY',kind:'pret'},'*');return;}
    if (!d || d.__tag !== 'CANCALE_LBC') return;
    if(Number.isSafeInteger(d.__vrmSequence)){if(vus.has(d.__vrmSequence))return;vus.add(d.__vrmSequence);if(vus.size>256)vus.delete(vus.values().next().value);}
    if(d.kind==='lbcsessionprivee'&&d.preuve){try{transmettre({from:'cancale-lbc',action:'lbcSessionPrivee',url:d.url,preuve:d.preuve});}catch(_){}return;}
    if (d.kind === 'lbcraw' && d.body) { try { transmettre({ from: 'cancale-lbc', action: 'lbcRaw', url: d.url, body: d.body, session: typeof d.session === 'string' ? d.session.slice(0, 80) : '' }); } catch (_) {} }
    else if (d.kind === 'lbccatalogue' && d.body) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcCatalogue', url: d.url, body: d.body, coupe: !!d.coupe }); } catch (_) {} }
    else if (d.kind === 'lbcenvoi' && d.cles) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcEnvoi', url: d.url, methode: d.methode || '', cles: d.cles }); } catch (_) {} }
    else if (d.kind === 'lbcvente' && d.body) { try { transmettre({ from: 'cancale-lbc', action: 'lbcVente', sequence:d.__vrmSequence,url: d.url, body: d.body, coupe: !!d.coupe,session:typeof d.session==='string'?d.session.slice(0,80):'' }); } catch (_) {} }
    else if(d.kind==='lbcblocage'){signaler(d.raison==='taille'?'taille':null);}
    else if (d.kind === 'lbcpaths' && d.paths) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcPaths', paths: d.paths, url: location.href }); } catch (_) {} }
    else if (d.kind === 'lbcschema' && d.cles) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcSchema', endpoint: d.endpoint, cles: d.cles }); } catch (_) {} }
    // La messagerie : le NOMBRE de non-lus d'un compte, et la liste de ses comptes
    // liés (sans email). Jamais un texte de message (voir lbc-inject.js).
    else if (d.kind === 'lbcmsgcompteur' && d.userId) { try { transmettre({ from: 'cancale-lbc', action: 'lbcMsgCompteur', userId: String(d.userId).slice(0, 64), unread: Number(d.unread) }); } catch (_) {} }
    // 22 oct. : une liste COMPLÈTE d'un vendeur (identifiants + total), dans la
    // MÊME file que ses annonces — elle arrive après elles.
    else if (d.kind === 'lbclistecomplete' && typeof d.owner === 'string' && Array.isArray(d.ids)) { try { transmettre({ from: 'cancale-lbc', action: 'lbcListeComplete', owner: d.owner.slice(0, 64), ids: d.ids.slice(0, 2000).map(String), total: Number(d.total) }); } catch (_) {} }
    // 29 oct. : une suppression / mise en pause faite SUR LA PAGE (réponse 2xx de
    // Leboncoin) — identifiants seulement, dans la MÊME file que ses annonces.
    else if (d.kind === 'lbcretraitvu' && Array.isArray(d.ids) && (d.quoi === 'supprime' || d.quoi === 'pause')) { try { transmettre({ from: 'cancale-lbc', action: 'lbcRetraitVu', quoi: d.quoi, ids: d.ids.slice(0, 50).map(String), statut: Number(d.statut) || 0 }); } catch (_) {} }
    // 29 oct. : les statistiques d'UNE annonce (des nombres, jamais qui).
    else if (d.kind === 'lbcstatsannonce' && /^\d{5,15}$/.test(String(d.id || ''))) { const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e7 ? Math.round(v) : null); try { transmettre({ from: 'cancale-lbc', action: 'lbcStatsAnnonce', id: String(d.id), favoris: n(d.favoris), messages: n(d.messages), vues: n(d.vues), du: String(d.du || '').slice(0, 10), au: String(d.au || '').slice(0, 10), jours: n(d.jours) }); } catch (_) {} }
    // 22 oct. : la réponse de Leboncoin à une mise en pause demandée par le fond —
    // 5.362 : par le canal privé SEULEMENT (`traiterCanal`), jamais par `window`.
    // 5.318 (3 nov.) : UN fil (texte, date, « de toi » — jamais un nom), la RECETTE d'un envoi
    // fait par lui sur la page, et la réponse de Leboncoin à un envoi demandé par le fond.
    else if (d.kind === 'lbcfil' && /^[\w-]{3,64}$/.test(String(d.conv || ''))) {
      const messages = (Array.isArray(d.messages) ? d.messages : []).slice(0, 200).map((x) => ({
        id: /^[\w-]{1,64}$/.test(String((x && x.id) || '')) ? String(x.id) : '', t: String((x && x.t) || '').slice(0, 2000),
        deMoi: x && (x.deMoi === true || x.deMoi === false) ? x.deMoi : null, at: String((x && x.at) || '').slice(0, 30) })).filter((x) => x.t);
      // 5.435 : les offres du fil (identité, date, « de toi », montant en centimes seulement si son unité est écrite, statut).
      const offres = (Array.isArray(d.offres) ? d.offres : []).slice(0, 50).map((x) => ({ id: /^[\w-]{1,64}$/.test(String((x && x.id) || '')) ? String(x.id) : '', at: String((x && x.at) || '').slice(0, 30),
        deMoi: x && (x.deMoi === true || x.deMoi === false) ? x.deMoi : null, c: x && Number.isInteger(x.c) && x.c > 0 && x.c < 1e8 ? x.c : null, s: /^[\w .-]{0,30}$/.test(String((x && x.s) || '')) ? String((x && x.s) || '') : '' })).filter((x) => x.id);
      const formeOffre = (Array.isArray(d.formeOffre) ? d.formeOffre : []).slice(0, 60).map((c) => String(c).slice(0, 120));
      try { transmettre({ from: 'cancale-lbc', action: 'lbcFil', conv: String(d.conv), messages, offres, formeOffre, lus: Number(d.lus) || 0, moi: /^[0-9a-z_-]{1,64}$/i.test(String(d.moi || '')) ? String(d.moi) : '', page: String(d.page || '').slice(0, 160), forme: (Array.isArray(d.forme) ? d.forme : []).slice(0, 80).map((c) => String(c).slice(0, 120)), annonce: /^\d{6,12}$/.test(String(d.annonce || '')) ? String(d.annonce) : '' }); } catch (_) {}   // 5.410 : l'annonce de la conversation
    }
    // 5.362 : la recette apprise et le résultat d'un envoi ne viennent QUE du canal privé (`traiterCanal`).
    else if (d.kind === 'lbccomptes' && Array.isArray(d.comptes)) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcComptes', comptes: d.comptes.slice(0, 10).map((c) => ({ id: String(c.id || '').slice(0, 64), name: String(c.name || '').slice(0, 60), pro: !!c.pro })) }); } catch (_) {} }
  }, false);
  // 5.365 : UNE page de l'historique (liste ou détail), commandée par le fond seulement ;
  // pas de réponse en 25 s ⇒ « muet » (rien n'avance).
  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.from!=='vrm-fond'||msg.action!=='lbcImportPage')return;
    if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;
    if(typeof msg.url!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(String(msg.compte||''))){sendResponse({ok:false,code:'invalide'});return;}
    const jeton=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2,12));
    const t=setTimeout(()=>{if(importsEnAttente.delete(jeton))sendResponse({ok:false,code:'muet'});},25000);
    importsEnAttente.set(jeton,(r)=>{clearTimeout(t);sendResponse(r);});
    if(!versCapteur({__tag:'CANCALE_LBC_ORDRE',kind:'importpage',jeton,url:msg.url.slice(0,600),compte:String(msg.compte)})){importsEnAttente.delete(jeton);clearTimeout(t);sendResponse({ok:false,code:'canal'});return;}   // 5.370 : canal privé, sinon rien
    return true;
  });}catch(_){}
  // 5.335 : le fond dit qu'une session VRM vient d'arriver ⇒ on rejoue ce qu'on garde.
  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.from!=='vrm-fond'||msg.action!=='lbcRejouer')return;
    if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;
    sendResponse({ok:true,n:rejouer()});
  });}catch(_){}
  window.postMessage({__tag:'CANCALE_LBC_RELAY',kind:'pret'},'*');
})();
