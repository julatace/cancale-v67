// Relais installé avant les premières réponses réseau de Leboncoin.
(function(){
  if(window.__vrmLbcRelayLoaded)return;window.__vrmLbcRelayLoaded=true;
  const vus=new Set();
  const pausesEnAttente=new Map();     // jeton → réponse au fond (22 oct.)
  const importsEnAttente=new Map();    // 5.365 : jeton → réponse au fond (une page de l'historique)
  const envoisEnAttente=new Map();     // 5.318 : jeton → réponse au fond (répondre dans un fil)
  const prixEnAttente=new Map();       // 5.363 : jeton → réponse au fond (changer un prix)
  const diagnostic=(capteur,capteurVersion)=>{try{chrome.runtime.sendMessage({from:'cancale-lbc',action:'lbcTransport',capteur,relaisVersion:'5.369.0',capteurVersion});}catch(_){}};
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
    // 22 oct. : la réponse de Leboncoin à une mise en pause demandée par le fond.
    else if (d.kind === 'lbcpauseresultat' && typeof d.jeton === 'string') { const r = pausesEnAttente.get(d.jeton); if (r) { pausesEnAttente.delete(d.jeton); r({ ok: true, statut: Number(d.statut) || 0, corps: String(d.corps || '').slice(0, 300), cles: Array.isArray(d.cles) ? d.cles.slice(0, 60).map(String) : [], erreur: String(d.erreur || '').slice(0, 80), entetes: Number(d.entetes) || 0 }); } }
    // 5.318 (3 nov.) : UN fil (texte, date, « de toi » — jamais un nom), la RECETTE d'un envoi
    // fait par lui sur la page, et la réponse de Leboncoin à un envoi demandé par le fond.
    else if (d.kind === 'lbcfil' && /^[\w-]{3,64}$/.test(String(d.conv || ''))) {
      const messages = (Array.isArray(d.messages) ? d.messages : []).slice(0, 200).map((x) => ({
        id: /^[\w-]{1,64}$/.test(String((x && x.id) || '')) ? String(x.id) : '', t: String((x && x.t) || '').slice(0, 2000),
        deMoi: x && (x.deMoi === true || x.deMoi === false) ? x.deMoi : null, at: String((x && x.at) || '').slice(0, 30) })).filter((x) => x.t);
      try { transmettre({ from: 'cancale-lbc', action: 'lbcFil', conv: String(d.conv), messages, lus: Number(d.lus) || 0, moi: /^[0-9a-z_-]{1,64}$/i.test(String(d.moi || '')) ? String(d.moi) : '', page: String(d.page || '').slice(0, 160), forme: (Array.isArray(d.forme) ? d.forme : []).slice(0, 80).map((c) => String(c).slice(0, 120)) }); } catch (_) {}
    }
    // 5.365 : le modèle d'une liste « Mes transactions » (son adresse exacte), et une page lue pour l'historique.
    else if (d.kind === 'lbcimportmodele' && typeof d.url === 'string') { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcImportModele', url: d.url.slice(0, 600), moi: /^[a-z0-9_-]{1,64}$/i.test(String(d.moi || '')) ? String(d.moi) : '' }, () => { void chrome.runtime.lastError; }); } catch (_) {} }
    else if (d.kind === 'lbcimportresultat' && typeof d.jeton === 'string') { const r = importsEnAttente.get(d.jeton); if (r) { importsEnAttente.delete(d.jeton); r({ ok: true, statut: Number(d.statut) || 0, erreur: String(d.erreur || '').slice(0, 40), url: typeof d.url === 'string' ? d.url.slice(0, 600) : '', corps: typeof d.corps === 'string' ? d.corps.slice(0, 200000) : '', session: typeof d.session === 'string' ? d.session.slice(0, 80) : '', moi: /^[a-z0-9_-]{1,64}$/i.test(String(d.moi || '')) ? String(d.moi) : '' }); } }
    else if (d.kind === 'lbcenvoiappris' && d.recette && typeof d.recette === 'object') { try { transmettre({ from: 'cancale-lbc', action: 'lbcEnvoiAppris', recette: d.recette }); } catch (_) {} }
    else if (d.kind === 'lbcenvoiresultat' && typeof d.jeton === 'string') { const r = envoisEnAttente.get(d.jeton); if (r) { envoisEnAttente.delete(d.jeton); r({ ok: true, statut: Number(d.statut) || 0, cles: (Array.isArray(d.cles) ? d.cles : []).slice(0, 60).map((c) => String(c).slice(0, 120)), idMsg: /^[\w-]{1,64}$/.test(String(d.idMsg || '')) ? String(d.idMsg) : '', erreur: String(d.erreur || '').slice(0, 80) }); } }
    // 5.363 (11 nov.) : la RECETTE d'un changement de prix fait par lui sur la page, et la réponse
    // de Leboncoin à un changement demandé par le fond (statut, forme, prix montré — jamais autre chose).
    else if (d.kind === 'lbcprixappris' && d.recette && typeof d.recette === 'object') { try { transmettre({ from: 'cancale-lbc', action: 'lbcPrixAppris', recette: d.recette }); } catch (_) {} }
    else if (d.kind === 'lbcprixresultat' && typeof d.jeton === 'string') { const r = prixEnAttente.get(d.jeton); if (r) { prixEnAttente.delete(d.jeton); const pv = Number(d.prixVu); r({ ok: true, statut: Number(d.statut) || 0, cles: (Array.isArray(d.cles) ? d.cles : []).slice(0, 60).map((c) => String(c).slice(0, 120)), prixVu: d.prixVu != null && Number.isFinite(pv) && pv > 0 ? pv : null, erreur: String(d.erreur || '').slice(0, 80), defi: d.defi === true, ra: String(d.ra || '').slice(0, 40) }); } }
    else if (d.kind === 'lbccomptes' && Array.isArray(d.comptes)) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcComptes', comptes: d.comptes.slice(0, 10).map((c) => ({ id: String(c.id || '').slice(0, 64), name: String(c.name || '').slice(0, 60), pro: !!c.pro })) }); } catch (_) {} }
  }, false);
  // ── METTRE EN PAUSE, SUR SON CLIC (22 octobre) ───────────────────────────
  // (29 oct.) et SUPPRIMER, sur son clic confirmé : même chemin, l'ordre dit lequel.
  // L'ordre ne vient QUE du fond de l'extension (jamais de la page), et ne vaut
  // que pour le cadre principal. Il passe au capteur (monde MAIN, lbc-inject.js)
  // qui seul porte l'adresse et les en-têtes du site. Pas de réponse en 15 s ⇒
  // « muet » : le fond dit qu'il ne SAIT PAS (jamais « fait », jamais « pas fait »).
  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.from!=='vrm-fond'||(msg.action!=='lbcPauseAnnonce'&&msg.action!=='lbcSupprimeAnnonce'))return;
    if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;
    const id=String(msg.id||'');if(!/^\d{6,12}$/.test(id)){sendResponse({ok:false,code:'invalide'});return;}
    const jeton=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2,12));
    const t=setTimeout(()=>{if(pausesEnAttente.delete(jeton))sendResponse({ok:false,code:'muet'});},15000);
    pausesEnAttente.set(jeton,(r)=>{clearTimeout(t);sendResponse(r);});
    window.postMessage({__tag:'CANCALE_LBC_ORDRE',kind:msg.action==='lbcSupprimeAnnonce'?'supprime':'pause',id,jeton},'*');
    return true;
  });}catch(_){}
  // 5.365 : UNE page de l'historique (liste ou détail), commandée par le fond seulement ;
  // pas de réponse en 25 s ⇒ « muet » (rien n'avance).
  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.from!=='vrm-fond'||msg.action!=='lbcImportPage')return;
    if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;
    if(typeof msg.url!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(String(msg.compte||''))){sendResponse({ok:false,code:'invalide'});return;}
    const jeton=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2,12));
    const t=setTimeout(()=>{if(importsEnAttente.delete(jeton))sendResponse({ok:false,code:'muet'});},25000);
    importsEnAttente.set(jeton,(r)=>{clearTimeout(t);sendResponse(r);});
    window.postMessage({__tag:'CANCALE_LBC_ORDRE',kind:'importpage',jeton,url:msg.url.slice(0,600),compte:String(msg.compte)},'*');
    return true;
  });}catch(_){}
  // 5.335 : le fond dit qu'une session VRM vient d'arriver ⇒ on rejoue ce qu'on garde.
  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.from!=='vrm-fond'||msg.action!=='lbcRejouer')return;
    if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;
    sendResponse({ok:true,n:rejouer()});
  });}catch(_){}
  // 5.318 (3 nov.) : RÉPONDRE dans un fil, sur SON clic. L'ordre ne vient QUE du fond
  // (jamais de la page), pour le cadre principal ; pas de réponse en 20 s ⇒ « muet ».
  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.from!=='vrm-fond'||msg.action!=='lbcRepondre')return;
    if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;
    const conv=String(msg.conv||''),texte=typeof msg.texte==='string'?msg.texte:'';
    if(!/^[\w-]{3,64}$/.test(conv)||!texte.trim()||texte.length>2000){sendResponse({ok:false,code:'invalide'});return;}
    const jeton=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2,12));
    const t=setTimeout(()=>{if(envoisEnAttente.delete(jeton))sendResponse({ok:false,code:'muet'});},20000);
    envoisEnAttente.set(jeton,(r)=>{clearTimeout(t);sendResponse(r);});
    window.postMessage({__tag:'CANCALE_LBC_ORDRE',kind:'repondre',jeton,conv,texte,recette:msg.recette,compte:String(msg.compte||'')},'*');
    return true;
  });}catch(_){}
  // 5.363 (11 nov.) : CHANGER UN PRIX, sur SON clic. L'ordre ne vient QUE du fond (jamais
  // de la page), pour le cadre principal ; pas de réponse en 20 s ⇒ « muet » (le fond dit
  // qu'il ne SAIT PAS si le prix a changé — jamais « fait »).
  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.from!=='vrm-fond'||msg.action!=='lbcPrixAnnonce')return;
    if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;
    const id=String(msg.id||''),prix=Number(msg.prix);
    if(!/^\d{6,12}$/.test(id)||!Number.isFinite(prix)||prix<1){sendResponse({ok:false,code:'invalide'});return;}
    const jeton=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2,12));
    const t=setTimeout(()=>{if(prixEnAttente.delete(jeton))sendResponse({ok:false,code:'muet'});},20000);
    prixEnAttente.set(jeton,(r)=>{clearTimeout(t);sendResponse(r);});
    window.postMessage({__tag:'CANCALE_LBC_ORDRE',kind:'prix',jeton,id,prix,recette:msg.recette,compte:String(msg.compte||'')},'*');
    return true;
  });}catch(_){}
  window.postMessage({__tag:'CANCALE_LBC_RELAY',kind:'pret'},'*');
})();
