// Relais installé avant les premières réponses réseau de Leboncoin.
(function(){
  if(window.__vrmLbcRelayLoaded)return;window.__vrmLbcRelayLoaded=true;
  const vus=new Set();
  const pausesEnAttente=new Map();     // jeton → réponse au fond (22 oct.)
  const diagnostic=(capteur,capteurVersion)=>{try{chrome.runtime.sendMessage({from:'cancale-lbc',action:'lbcTransport',capteur,relaisVersion:'5.274.0',capteurVersion});}catch(_){}};
  diagnostic(false);
  // Enregistrer l'identité avant de traiter les annonces arrivées ensuite.
  const file=[];let enCours=false,tailleFile=0,identiteRefusee=false;
  const signaler=erreurCapture=>{try{chrome.runtime.sendMessage({from:'cancale-lbc',action:'lbcTransport',capteur:true,erreurCapture});}catch(_){}};
  const transmettre=m=>{
    if(identiteRefusee&&['lbcRaw','lbcVente'].includes(m.action)&&String(m.session||'').startsWith('lbc-account:'))return;
    const taille=new TextEncoder().encode(JSON.stringify(m)).length;
    if(taille>3500000||file.length>=64||tailleFile+taille>4000000){signaler('taille');return;}
    file.push({m,taille});tailleFile+=taille;vider();
  };
  const vider=()=>{
    if(enCours||!file.length)return;enCours=true;
    const {m,taille}=file.shift();tailleFile-=taille;
    let fini=false;const suite=ok=>{
      if(fini)return;fini=true;clearTimeout(timer);
      if(m.action==='lbcVente'&&Number.isSafeInteger(m.sequence))try{window.postMessage({__tag:'CANCALE_LBC_ACCUSE',sequence:m.sequence,ok:ok===true},'*');}catch(_){}
      if(m.action==='lbcSessionPrivee'){
        identiteRefusee=!ok;signaler(ok?null:'identite');
        if(!ok){for(let i=file.length-1;i>=0;i--)if(['lbcRaw','lbcVente'].includes(file[i].m.action)){tailleFile-=file[i].taille;file.splice(i,1);}}
      }
      enCours=false;vider();
    };
    const timer=setTimeout(()=>suite(false),20000);
    try{chrome.runtime.sendMessage(m,r=>{const erreur=chrome.runtime.lastError;suite(!erreur&&r?.ok===true);});}catch(_){suite(false);}
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
    // 22 oct. : la réponse de Leboncoin à une mise en pause demandée par le fond.
    else if (d.kind === 'lbcpauseresultat' && typeof d.jeton === 'string') { const r = pausesEnAttente.get(d.jeton); if (r) { pausesEnAttente.delete(d.jeton); r({ ok: true, statut: Number(d.statut) || 0, corps: String(d.corps || '').slice(0, 300), cles: Array.isArray(d.cles) ? d.cles.slice(0, 60).map(String) : [], erreur: String(d.erreur || '').slice(0, 80), entetes: Number(d.entetes) || 0 }); } }
    else if (d.kind === 'lbccomptes' && Array.isArray(d.comptes)) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcComptes', comptes: d.comptes.slice(0, 10).map((c) => ({ id: String(c.id || '').slice(0, 64), name: String(c.name || '').slice(0, 60), pro: !!c.pro })) }); } catch (_) {} }
  }, false);
  // ── METTRE EN PAUSE, SUR SON CLIC (22 octobre) ───────────────────────────
  // L'ordre ne vient QUE du fond de l'extension (jamais de la page), et ne vaut
  // que pour le cadre principal. Il passe au capteur (monde MAIN, lbc-inject.js)
  // qui seul porte l'adresse et les en-têtes du site. Pas de réponse en 15 s ⇒
  // « muet » : le fond dit qu'il ne SAIT PAS (jamais « fait », jamais « pas fait »).
  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.from!=='vrm-fond'||msg.action!=='lbcPauseAnnonce')return;
    if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;
    const id=String(msg.id||'');if(!/^\d{6,12}$/.test(id)){sendResponse({ok:false,code:'invalide'});return;}
    const jeton=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2,12));
    const t=setTimeout(()=>{if(pausesEnAttente.delete(jeton))sendResponse({ok:false,code:'muet'});},15000);
    pausesEnAttente.set(jeton,(r)=>{clearTimeout(t);sendResponse(r);});
    window.postMessage({__tag:'CANCALE_LBC_ORDRE',kind:'pause',id,jeton},'*');
    return true;
  });}catch(_){}
  window.postMessage({__tag:'CANCALE_LBC_RELAY',kind:'pret'},'*');
})();
