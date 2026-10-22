// ════════════════════════════════════════════════════════════════════
// VRM — Transfert Gmail → app (script Google Apps Script)
//
// Rôle : toutes les 5 minutes, prend les emails Vinted pas encore
// traités et les POSTe tels quels à l'app (api/email-inbound), qui se
// charge de TOUT : parsing (vente / bordereau / argent reçu), rangement
// dans Supabase, et notifications push.
//
// Installation (une fois) :
//   1. script.google.com (connecté avec le Gmail qui reçoit les mails)
//   2. Nouveau projet → coller ce fichier → 💾 Enregistrer
//   3. Propriétés du script : EMAIL_INBOUND_SECRET (la même clé que Vercel).
//   4. Exécuter verifierInstallationVRM, puis installerVRM → autoriser Google.
//   5. Vérifier le premier passage ; aucun mot de passe à coller dans le code.
// ════════════════════════════════════════════════════════════════════

const ENDPOINT = 'https://vrm.center/api/email-inbound';
// ⚠️ CLÉ SECRÈTE — À REMPLIR (4 octobre). C'est la même valeur que la
// variable EMAIL_INBOUND_SECRET sur Vercel : sans elle, n'importe qui pouvait
// envoyer de fausses ventes ou de faux bordereaux à l'app. Renseigne la clé
// dans les propriétés du script (EMAIL_INBOUND_SECRET), puis enregistre.
// Ne la mets jamais dans le dépôt GitHub : il est public.
const SECRET = '';

// La date de départ se règle DANS L'APP (Paramètres → Import des emails).
// Elle est stockée dans Supabase ; le script la lit à chaque passage.
// Valeur de secours si l'app n'a encore rien réglé :
const DEFAULT_START = '2026/07/15';

// ⚠️ Le script ne lit plus la base directement : depuis qu'elle est
// cloisonnée, la clé publique n'y lit plus RIEN (la date retombait sur sa
// valeur de secours, et aucune facture ne partait). Il passe par l'app, avec
// la clé secrète ci-dessus.
function appVRM(mode, methode, corps) {
  const url = ENDPOINT + '?mode=' + mode;
  const opts = { method: methode || 'get', headers:{'x-vrm-email-key':secretVRM()}, muteHttpExceptions: true };
  if (corps) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(corps); }
  const r = UrlFetchApp.fetch(url, opts);
  const code = r.getResponseCode();
  let j = null; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  return { code: code, ok: code >= 200 && code < 300 && j && j.ok, data: j || {} };
}

function getStartDate() {
  const depuis=PropertiesService.getScriptProperties().getProperty('VRM_START_DATE');
  if(depuis && /^\d{4}-\d{2}-\d{2}$/.test(depuis))return depuis.replace(/-/g,'/');
  if(BOITE_PARTAGEE || !secretVRM())return DEFAULT_START;
  try {
    const r = appVRM('config');
    const d = r.ok && r.data.startDate; // 'AAAA-MM-JJ'
    if (d) return d.replace(/-/g, '/');
    if (!r.ok) Logger.log('Date de départ : VRM a répondu ' + r.code + ' — valeur de secours.');
  } catch (e) {}
  return DEFAULT_START;
}

const LABEL = 'vrm-traite'; // Compatibilité : empêche le renvoi massif des anciens emails.
const LABEL_PREUVE = 'vrm-confirme-v2'; // Accusé nominatif de VRM, obligatoire pour le nouveau ménage.

// ── MÉNAGE DE LA BOÎTE ───────────────────────────────────────────────
// Julien, 4 oct. : « supprimer les mails si l'app conserve les données ».
// Archivage uniquement avec preuve `vrm-confirme-v2`, hors erreurs et
// vérifications, après N jours. Le label historique seul ne suffit jamais.
//   'archive'  (défaut, SÛR) → sortis de la boîte mais GARDÉS sous le label,
//              récupérables : le filet de re-lecture reste intact (ex. l'email
//              Vinted Go re-traité le 4 oct. parce qu'on l'avait encore).
//   'corbeille' → vraie suppression (corbeille Gmail, purgée après ~30 j).
//              Forcée à 90 j minimum : au-delà, tout correctif d'analyseur a
//              déjà tourné. Ne bascule là que pour VRAIMENT libérer de l'espace.
const CLEANUP_MODE = 'archive';   // 'archive' (sûr) | 'corbeille' (supprime, ≥90 j)
const CLEANUP_MIN_AGE_DAYS = 6;   // Julien : « tous les mails de plus de 6 jours »

// Gmail renvoie ici des IDENTIFIANTS DE MESSAGES, pas des fils : un nouveau
// message d'une conversation déjà traitée reste donc dans la file.
const BOITE_PARTAGEE = true;
const MAX_PAR_PASSAGE = 100;
const BUDGET_TRANSFERT_MS = 180000;
function secretVRM(){return PropertiesService.getScriptProperties().getProperty('EMAIL_INBOUND_SECRET') || SECRET;}
function gmailVRM(chemin,methode,corps){
 const r=UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+chemin,{method:methode||'get',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},contentType:'application/json',...(corps?{payload:JSON.stringify(corps)}:{}),muteHttpExceptions:true});
 const code=r.getResponseCode();let j;try{j=JSON.parse(r.getContentText());}catch(_){throw Error('Réponse Gmail illisible ('+code+').');}
 if(code<200||code>=300)throw Error('Gmail a refusé la lecture ou le classement ('+code+').');return j;
}
function messagesVRM(q,max){const j=gmailVRM('messages?maxResults='+max+'&q='+encodeURIComponent(q));if(j.messages&&!Array.isArray(j.messages))throw Error('Liste Gmail illisible.');return j.messages||[];}
function labelVRM(nom){return (GmailApp.getUserLabelByName(nom)||GmailApp.createLabel(nom)).getId();}
function classerMessageVRM(id,ajouter,retirer){return gmailVRM('messages/'+encodeURIComponent(id)+'/modify','post',{addLabelIds:ajouter||[],removeLabelIds:retirer||[]});}
function empreinteVRM(json){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,json,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function accuseValideVRM(code,j,id,empreinte){return code>=200&&code<300&&j&&j.reception&&j.reception.stocke===true&&j.reception.messageId===id&&j.reception.empreinte===empreinte;}
function categorieVRM(j){
 const c=j.reception.classement;
 if(c==='a-verifier')return 'vrm-a-verifier';
 return ({achat:'vrm-achats',vente:'vrm-ventes',bordereau:'vrm-bordereaux',finalisation:'vrm-versements',finalise:'vrm-versements',colis:'vrm-colis',suivi:'vrm-colis',message:'vrm-messages',offre:'vrm-offres'})[c]||'vrm-informations';
}
function confirmationTransfertVRM(){
 const label=labelVRM('vrm-configuration');
 const messages=messagesVRM('from:forwarding-noreply@google.com -label:vrm-configuration -in:trash -in:spam',20);
 messages.forEach(m=>classerMessageVRM(m.id,[label],[]));
 // Aucun lien de validation n'est ouvert automatiquement.
}
// Télémétrie sans sujet, contenu, adresse personnelle ni compteur collectif.
function signalerPassageVRM(etat){
 try{const r=appVRM('reception-passage','post',{etat:etat});if(!r.ok)Logger.log('VRM : suivi du collecteur indisponible ('+r.code+'), transfert conservé.');}
 catch(_){Logger.log('VRM : suivi du collecteur indisponible, transfert conservé.');}
}
function forwardVintedEmails() {
 const verrou=LockService.getScriptLock();
 if(!verrou.tryLock(1000)){Logger.log('VRM : un passage est déjà en cours.');return;}
 let compteVerifie=false;
 const debut=Date.now(),bilan={debut:new Date().toISOString(),confirmes:0,aVerifier:0,aReessayer:0,classementEchoue:0};
 try{
  if(!secretVRM())throw Error('Renseigne EMAIL_INBOUND_SECRET dans les propriétés du script.');
  if(BOITE_PARTAGEE && String(gmailVRM('profile').emailAddress||'').toLowerCase()!=='vrm.vinted35@gmail.com')throw Error('Ce script collectif doit être installé dans vrm.vinted35@gmail.com.');
  compteVerifie=true;signalerPassageVRM('debut');
  const traite=labelVRM(LABEL),preuve=labelVRM(LABEL_PREUVE),erreur=labelVRM('vrm-a-reessayer');
  confirmationTransfertVRM();
  const query='{from:(vinted OR mondialrelay OR chronopost OR privaterelay OR icloudmail OR leboncoin OR ebay OR colissimo OR laposte OR dpd OR gls OR ups OR relaiscolis) subject:(vinted OR vendu OR bordereau OR colis OR offre OR message OR achat OR commande OR facture)} -label:'+LABEL+' -label:vrm-configuration -in:spam -in:trash -in:sent after:'+getStartDate();
  // (22 oct.) `-in:sent` : ce que CETTE boîte envoie (factures, liens de
  // confirmation d'adresse — l'expéditeur contient « vinted ») n'est pas un
  // email reçu, il ne repart pas vers VRM.
  const vus={};let n=0,phase='nouveaux';const proprietes=PropertiesService.getScriptProperties();
  while(n<MAX_PAR_PASSAGE&&Date.now()-debut<BUDGET_TRANSFERT_MS){
   if(phase==='nouveaux'&&n>=80)phase='reprises';
   let lot;
   if(phase==='nouveaux')lot=messagesVRM(query+' -label:vrm-a-reessayer',Math.min(50,80-n));
   else{
    const token=proprietes.getProperty('VRM_REPRISE_PAGE')||'';
    let page;
    try{page=gmailVRM('messages?maxResults=20&q='+encodeURIComponent(query+' label:vrm-a-reessayer')+(token?'&pageToken='+encodeURIComponent(token):''));}
    catch(e){if(!token)throw e;proprietes.deleteProperty('VRM_REPRISE_PAGE');page=gmailVRM('messages?maxResults=20&q='+encodeURIComponent(query+' label:vrm-a-reessayer'));}
    if(page.nextPageToken)proprietes.setProperty('VRM_REPRISE_PAGE',page.nextPageToken);else proprietes.deleteProperty('VRM_REPRISE_PAGE');
    lot=page.messages||[];
   }
   lot=lot.filter(m=>!vus[m.id]);
   if(!lot.length){if(phase==='nouveaux'){phase='reprises';continue;}break;}
   for(const m of lot){
    if(Date.now()-debut>=BUDGET_TRANSFERT_MS)break;
    vus[m.id]=true;n++;
    try{
     const msg=GmailApp.getMessageById(m.id),header=nom=>{try{return msg.getHeader(nom)||'';}catch(_){return '';}};
     const id=header('Message-ID')||msg.getId();
     const payload={messageId:id,from:msg.getFrom(),to:msg.getTo(),cc:msg.getCc(),subject:msg.getSubject(),text:msg.getPlainBody(),html:msg.getBody(),deliveredTo:header('Delivered-To'),headers:{'delivered-to':header('Delivered-To'),'x-original-to':header('X-Original-To')},source:BOITE_PARTAGEE?'gmail-shared':'gmail-v2',sourceMessageId:msg.getId(),sourceDate:msg.getDate().toISOString(),attachments:msg.getAttachments().map(a=>({filename:a.getName(),contentType:a.getContentType(),content:Utilities.base64Encode(a.getBytes())}))};
     const json=JSON.stringify(payload);
     if(Utilities.newBlob(json).getBytes().length>4000000)throw Error('Email trop volumineux pour la réception VRM : conservé dans Gmail.');
     const r=UrlFetchApp.fetch(ENDPOINT,{headers:{'x-vrm-email-key':secretVRM()},method:'post',contentType:'application/json',payload:json,muteHttpExceptions:true});
     const code=r.getResponseCode();let j=null;try{j=JSON.parse(r.getContentText());}catch(_){}
     if(!accuseValideVRM(code,j,id,empreinteVRM(json)))throw Error('Réception non confirmée par VRM ('+code+').');
     // Si ce classement échoue, le message restera dans la file : son renvoi
     // conserve le même Message-ID, traité de façon idempotente par VRM.
     try{classerMessageVRM(m.id,[traite,preuve,labelVRM(categorieVRM(j))],[erreur]);}catch(e){bilan.classementEchoue++;throw e;}
     bilan.confirmes++;if(j.reception.classement==='a-verifier')bilan.aVerifier++;
     Logger.log('VRM : message '+m.id+' confirmé et classé ('+j.reception.classement+').');
    }catch(e){bilan.aReessayer++;try{classerMessageVRM(m.id,[erreur],[]);}catch(_){}Logger.log('VRM : message '+m.id+' conservé, à réessayer : '+String(e.message||e));}
   }
   if(phase==='reprises')break;
  }
  // Conserve le flux Pro existant, limité au propriétaire de l'installation
  // par modeScript. Aucune facture des autres utilisateurs n'est ajoutée ici.
  // (22 oct., revue) Les factures PASSENT AVANT les liens : elles partagent le
  // quota d'envoi de cette boîte, et une facture compte plus qu'un lien.
  sendQueuedInvoices();
  // Les liens de confirmation d'adresse demandés par les vendeurs (22 oct.).
  envoyerPreuvesAdresse();
  if(Date.now()-debut<230000)nettoyerTraites();
 }catch(e){bilan.erreur=String(e.message||e);Logger.log('VRM : '+bilan.erreur);}
 finally{if(compteVerifie)signalerPassageVRM(bilan.erreur||bilan.aReessayer||bilan.classementEchoue?'erreur':'succes');bilan.fin=new Date().toISOString();try{PropertiesService.getScriptProperties().setProperty('VRM_DERNIER_PASSAGE',JSON.stringify(bilan));}finally{verrou.releaseLock();}}
}

function nettoyerTraites() {
 // Aucun effacement tant que l’archivage complet des documents n’est pas certifié.
 if(CLEANUP_MODE==='corbeille'){Logger.log('VRM : suppression désactivée — conservation des documents non certifiée.');return;}
 const corbeille=CLEANUP_MODE==='corbeille',age=corbeille?Math.max(90,CLEANUP_MIN_AGE_DAYS):CLEANUP_MIN_AGE_DAYS;
 const avant=new Date(Date.now()-age*86400000),y=avant.getFullYear()+'/'+('0'+(avant.getMonth()+1)).slice(-2)+'/'+('0'+avant.getDate()).slice(-2);
 const q='label:'+LABEL_PREUVE+' -label:vrm-a-verifier -label:vrm-a-reessayer'+(corbeille?' -in:trash':' in:inbox')+' before:'+y;
 // On déplace seulement les messages confirmés. Jamais toute la conversation,
 // qui pourrait contenir un nouveau message encore non enregistré dans VRM.
 const lot=messagesVRM(q,100);
 lot.forEach(m=>corbeille?gmailVRM('messages/'+encodeURIComponent(m.id)+'/trash','post',{}):classerMessageVRM(m.id,[],['INBOX']));
 Logger.log('VRM : '+lot.length+' message(s) confirmés '+(corbeille?'mis à la corbeille':'archivés')+'.');
}

// ════════════════════════════════════════════════════════════════════
// FACTURATION PRO — envoi des factures en file d'attente
// L'app (via api/email-inbound) prépare les factures dans Supabase avec
// status='queued' UNIQUEMENT si l'utilisateur a activé l'envoi auto
// (ou s'il clique « Envoyer » manuellement sur une facture). Ce script
// les envoie depuis cette boîte Gmail puis les marque 'sent'.
// ════════════════════════════════════════════════════════════════════
function sendQueuedInvoices() {
  if (!SECRET) { Logger.log('Factures : pas de clé secrète — rien à envoyer.'); return; }
  let r;
  try { r = appVRM('factures'); } catch (e) { Logger.log('Factures : VRM injoignable — ' + e); return; }
  if (!r.ok) { Logger.log('Factures : VRM a répondu ' + r.code + ' — rien envoyé.'); return; }
  if (!r.data.actif) return; // facturation coupée dans l'app → on ne touche à rien
  const cfg = { nom: r.data.nom, logo: r.data.logo };
  const queued = r.data.factures || [];
  if (queued.length === 0) return;

  queued.forEach(d => {
    try {
      const opts = { htmlBody: d.html, name: cfg.nom || 'Facturation' };
      // Logo intégré dans l'email (le base64 des réglages devient une image inline)
      if (cfg.logo && cfg.logo.indexOf('base64,') > -1) {
        try {
          const b64 = cfg.logo.split('base64,')[1];
          const mime = (cfg.logo.match(/^data:([^;]+);/) || [])[1] || 'image/png';
          opts.inlineImages = { logoFacture: Utilities.newBlob(Utilities.base64Decode(b64), mime, 'logo') };
        } catch (e) {}
      }
      GmailApp.sendEmail(
        d.buyerEmail,
        'Votre facture ' + d.number + (cfg.nom ? ' – ' + cfg.nom : ''),
        'Bonjour,\n\nVeuillez trouver votre facture ' + d.number + ' pour votre achat Vinted.\n\nMerci pour votre achat !',
        opts
      );
      // Marque la facture comme envoyée (sinon elle repartirait au passage
      // suivant : le dire au journal si VRM ne l'a pas noté).
      const m = appVRM('facture-envoyee', 'post', { id: d.id });
      Logger.log('Facture ' + d.number + ' envoyée à ' + d.buyerEmail + (m.ok ? '' : ' — ⚠️ VRM ne l\'a pas notée envoyée (' + m.code + ')'));
    } catch (e) {
      Logger.log('Erreur envoi facture : ' + e);
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// LIENS DE CONFIRMATION D'ADRESSE (22 octobre)
// Un vendeur déclare dans VRM l'adresse où Vinted lui écrit ; VRM lui envoie
// un lien À CETTE ADRESSE, et ce n'est qu'après son clic que ses emails lui
// sont attribués. VRM écrit le message (le lien est fabriqué par le serveur,
// sa clé ne quitte jamais Vercel) ; cette boîte l'envoie tel quel, puis le
// dit à VRM. Un envoi raté est signalé à VRM (au 3ᵉ, la demande sort de la
// file) et ARRÊTE le passage : c'est souvent le quota du jour, inutile de
// brûler les suivantes. VRM plafonne lui-même le nombre de liens par jour.
// ════════════════════════════════════════════════════════════════════
function envoyerPreuvesAdresse() {
  if (!secretVRM()) return;
  let r;
  try { r = appVRM('preuves-a-envoyer'); } catch (e) { Logger.log('Confirmations : VRM injoignable — ' + e); return; }
  if (!r.ok) { Logger.log('Confirmations : VRM a répondu ' + r.code + ' — rien envoyé.'); return; }
  const envois = (r.data.envois || []).slice(0, 20);
  for (let i = 0; i < envois.length; i++) {
    const e = envois[i];
    try {
      GmailApp.sendEmail(e.adresse, e.sujet, e.texte, { htmlBody: e.html, name: 'VRM' });
    } catch (err) {
      Logger.log('Confirmation non envoyée : ' + err);
      try { appVRM('preuve-echec', 'post', { id: e.id }); } catch (_) {}
      return;
    }
    let m = null;
    try { m = appVRM('preuve-envoyee', 'post', { id: e.id }); } catch (_) { m = null; }
    Logger.log('Confirmation envoyée' + (m && m.ok ? '' : ' — ⚠️ VRM ne l\'a pas notée (' + (m ? m.code : 'injoignable') + '), elle repartira'));
  }
}

// Outil : retire l'étiquette pour re-traiter les anciens emails (à la main)
function resetLabels() {
  const label = GmailApp.getUserLabelByName(LABEL);
  if (!label) return;
  GmailApp.search('label:' + LABEL).forEach(t => t.removeLabel(label));
  Logger.log('Étiquettes réinitialisées.');
}

// Diagnostic sans transfert ni envoi d'email : à lancer avant l'installation.
function verifierInstallationVRM(){
 if(!secretVRM())throw Error('Ajoute EMAIL_INBOUND_SECRET aux propriétés du script.');
 const profil=gmailVRM('profile');
 if(BOITE_PARTAGEE && String(profil.emailAddress||'').toLowerCase()!=='vrm.vinted35@gmail.com')throw Error('Mauvais compte Google : utilise la boîte collective.');
 const r=appVRM('reception-diagnostic');
 if(!r.ok || r.data.accuses!==2 || (BOITE_PARTAGEE && r.data.boitePartagee!==true))throw Error('La réception VRM ne confirme pas le protocole v2 ('+r.code+').');
 Logger.log('Compte Gmail et réception VRM v2 vérifiés. Aucun email transféré ni envoyé.');
}
function installerVRM(){
 verifierInstallationVRM();
 const declencheurs=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='forwardVintedEmails');
 if(!declencheurs.length)ScriptApp.newTrigger('forwardVintedEmails').timeBased().everyMinutes(5).create();
 // Ne supprime aucun déclencheur étranger au transfert VRM.
 declencheurs.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));
 Logger.log('Transfert VRM programmé toutes les cinq minutes.');
}

function preparerCleReceptionVRM(){
 const p=PropertiesService.getScriptProperties();
 if(!p.getProperty('EMAIL_INBOUND_SECRET'))p.setProperty('EMAIL_INBOUND_SECRET',Utilities.getUuid()+Utilities.getUuid());
 Logger.log('Clé conservée dans les propriétés du script. Reporte cette même valeur dans EMAIL_INBOUND_SECRET sur Vercel, sans la publier ni la partager dans un chat.');
}
