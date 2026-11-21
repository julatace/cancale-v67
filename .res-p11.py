p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

# 1. « marquée lue » = la conversation OUVERTE dans l'onglet de travail
rep("""async function marquerLuCommeBleam(acc, conv) {
  if (!/^[1-9]\\d{0,19}$/.test(String(conv || ''))) return null;
  const r = await vintedPage(acc, 'PUT', `/api/v2/conversations/${conv}/mark_as_read`, null, { timeoutMs: 12000 });
  noterDiag(r && r.ok ? 'bleam_marque_lu' : 'bleam_marque_lu_ko_' + ((r && r.status) || 0));
  if (r && typeof r === 'object') r.luAt = Date.now();
  return r;
}""","""async function marquerLuCommeBleam(acc, conv) {
  if (!/^[1-9]\\d{0,19}$/.test(String(conv || ''))) return null;
  // 5.414 (`toutinterface`) : plus de `PUT mark_as_read` fabriqué — la conversation est OUVERTE dans l'onglet de travail,
  //    comme le ferait sa main ; c'est la page de Vinted qui la marque lue. Rien d'écrit par VRM.
  const r = await ouvrirConversationTravail(acc, conv);
  noterDiag(r && r.ok ? 'bleam_ouverte' : 'bleam_ouverte_ko_' + String((r && (r.sansPage || r.status)) || 0).slice(0, 20));
  return r;
}""")

# 2. La séquence « comme Bleam » : le message et l'offre PAR L'INTERFACE
rep("""  etape('envoi');
  const r = await vintedPage(acc, 'POST', `/api/v2/conversations/${convId}/replies`, corpsReponseVinted(texte), { timeoutMs: 12000 });
  if (partie(r)) compterEcrit();
  if (r.sansPage) return { resultat: 'refuse', raison: 'onglet_vinted' };
  if (r.pause) return { resultat: 'refuse', raison: 'pause_vinted' };
  if (!(r.ok && r.json && r.json.code === 0)) {""","""  etape('envoi');
  // 5.414 (`toutinterface`) : le message TAPÉ dans le champ de CETTE conversation (vérifiée dans l'adresse), « Envoyer »,
  //    puis la preuve à l'écran (le message apparu dans le fil) ; pas vu ⇒ « incertain », JAMAIS renvoyé.
  const r = await interfaceVinted(acc, 'message', { conv: String(convId), texte });
  if (partie(r)) compterEcrit();
  if (r.rienParti && !r.pause) return { resultat: 'refuse', raison: raisonFavoriInterface(r) };
  if (r.pause) return { resultat: 'refuse', raison: r.robot ? 'vinted_robot' : 'pause_vinted' };
  if (r.incertain) return { resultat: 'incertain', status: 0, raison: 'reponse_inconnue' };
  if (r.ok && r.json && r.json.code === 0 && r.vu !== true) { noterDiag('favori_message_pas_vu'); await noterTexteRecent(uid, texte); return { resultat: 'incertain', status: r.status, raison: 'reponse_inconnue' }; }
  if (!(r.ok && r.json && r.json.code === 0)) {""")
rep("""  const o = await vintedPage(acc, 'POST', `/api/v2/transactions/${tx}/offers`, { offer: { currency: devise, price: String(prix).replace(/\\.00$/, '') } }, { timeoutMs: 12000 });
  if (partie(o)) compterEcrit();
  noterDiag(o && o.ok && (o.json == null || o.json.code == null || Number(o.json.code) === 0) ? 'favori_offre_ok' : 'favori_offre_refusee_' + ((o && o.status) || 'reseau'));
  return fini;""","""  void devise;
  // 5.414 : « Faire une offre » dans la même conversation, le prix TAPÉ, « Proposer », l'offre vue à l'écran.
  const o = await interfaceVinted(acc, 'offre', { conv: String(convId), tx: String(tx), prix: Number(prix) });
  if (partie(o)) compterEcrit();
  noterDiag(o && o.ok && (o.json == null || o.json.code == null || Number(o.json.code) === 0) ? (o.vu ? 'favori_offre_ok' : 'favori_offre_pas_vue') : 'favori_offre_refusee_' + ((o && (o.status || o.manque || o.sansPage)) || 'reseau'));
  return fini;""")

# 3. executerMessageFavori : la conversation ouverte PAR LA CLOCHE (sa ligne cliquée), le fil relu, l'offre et le message par l'interface
rep("""    const liste=cl.ok&&cl.json&&Array.isArray(cl.json.notifications)?cl.json.notifications:null;
    if(liste&&!liste.some(n=>n&&String(n.id)===String(body.notificationId))){noterDiag('favori_trop_ancien');return rep('ignore',cl.status,'favori_trop_ancien');}
    if(!liste)noterDiag('favori_cloche_illisible_'+(cl.status||0));
    await pauseFavori('cloche',uid);
  }
  etape('conversation');
  const creation=await vintedPage(acc,'POST','/api/v2/conversations',{initiator:cbF.favoris?INITIATEUR_BLEAM:body.initiator,item_id:body.itemId,opposite_user_id:body.recipientId},{timeoutMs:12000,chemin:'/inbox'});
  if(partie(creation))ecrits++;
  if(creation.sansPage)return rep('refuse',0,'onglet_vinted');
  if(creation.pause)return rep('refuse',0,'pause_vinted');""","""    const liste=cl.ok&&cl.json&&Array.isArray(cl.json.notifications)?cl.json.notifications:null;
    if(liste&&!liste.some(n=>n&&String(n.id)===String(body.notificationId))){noterDiag('favori_trop_ancien');return rep('ignore',cl.status,'favori_trop_ancien');}
    if(!liste)noterDiag('favori_cloche_illisible_'+(cl.status||0));
    if(liste){const n=liste.find(x=>x&&String(x.id)===String(body.notificationId));if(n&&typeof n.link==='string')lienCloche=n.link;}
    await pauseFavori('cloche',uid);
  }
  // ⚠️⚠️ 5.414 (`toutinterface`, Julien, 21 nov. : « on ne fait plus les requêtes ») : la conversation n'est plus créée par une
  //    requête fabriquée. VRM ouvre la CLOCHE dans l'onglet de travail et clique LA ligne de CE favori — le lien natif dont
  //    l'article ET le destinataire sont ceux du favori (identités, jamais un pseudo ni un titre) ; c'est la PAGE de Vinted
  //    qui ouvre (crée) la conversation. Lien inconnu, ambigu ou d'une autre personne ⇒ rien ne part.
  etape('conversation');
  const page=pageFavoriNative(lienCloche||await lienDuFavori(uid,body.notificationId),acc.domain||'www.vinted.fr');
  if(!page||page.itemId!==body.itemId||(destinataireLienFavori(page)&&destinataireLienFavori(page)!==body.recipientId)){noterDiag('favori_lien_inconnu');return rep('refuse',0,'identite_non_confirmee');}
  const creation=await interfaceVinted(acc,'favoriOuvrir',{lien:page.url,itemId:body.itemId,receiverId:body.recipientId});
  if(creation.envoye&&partie(creation))ecrits++;
  if(creation.rienParti&&!creation.pause)return rep('refuse',0,raisonFavoriInterface(creation));
  if(creation.pause)return rep('refuse',0,creation.robot?'vinted_robot':'pause_vinted');
  if(creation.incertain)return rep('incertain',0,'creation_non_confirmee');""")
rep("""  const cc=creation.json?.conversation;
  const convId=String(cc?.id||'');""","""  const cc=creation.json?.conversation||null;
  const convId=String(creation.conv||cc?.id||'');""")
rep("""  if(seqBleam||!filVerifiable(c)){noterDiag('favori_fil_relu');lu=""","""  // 5.414 : TOUJOURS relu (la page a ouvert la conversation : sa réponse n'est pas la preuve, le fil relu l'est).
  if(true){noterDiag('favori_fil_relu');lu=""")
rep("""    const o=await vintedPage(acc,'POST',`/api/v2/transactions/${tx}/offers`,{offer:{currency:devise,price:prix}},{timeoutMs:12000});
    if(partie(o))ecrits++;
    if(o.sansPage)return rep('refuse',0,'onglet_vinted');
    if(o.pause)return rep('refuse',0,'pause_vinted');
    const offreFaite=!!(o.ok&&(o.json?.code==null||Number(o.json.code)===0));""","""    // 5.414 : « Faire une offre » dans CETTE conversation, le prix tapé, « Proposer » ; l'offre doit être VUE à l'écran.
    const o=await interfaceVinted(acc,'offre',{conv:String(convId),tx:String(tx),prix:Number(prix)});
    if(partie(o))ecrits++;
    if(o.rienParti&&!o.pause)return rep('refuse',0,raisonFavoriInterface(o));
    if(o.pause)return rep('refuse',0,o.robot?'vinted_robot':'pause_vinted');
    if(o.incertain)return rep('incertain',0,'offre_incertaine');
    if(o.ok&&o.vu!==true&&(o.json?.code==null||Number(o.json.code)===0)){noterDiag('favori_offre_pas_vue');return rep('incertain',o.status,'offre_incertaine');}
    const offreFaite=!!(o.ok&&(o.json?.code==null||Number(o.json.code)===0));""")
rep("""  const r=await vintedPage(acc,'POST',`/api/v2/conversations/${convId}/replies`,corpsReponseVinted(texteFinal),{timeoutMs:12000});
  if(partie(r))ecrits++;
  // (29 oct., revue) Pas d'onglet, onglet hors de Vinted, ou pause : le message n'est PAS
  // parti (vérifié dans la page avant l'envoi) — un refus certain, pas « à vérifier »
  // (qui arrêtait toutes les files).
  if(r.sansPage)return rep('refuse',0,'onglet_vinted');
  if(r.pause)return rep('refuse',0,'pause_vinted');""","""  // 5.414 : le message TAPÉ dans le champ de CETTE conversation, « Envoyer », puis VU dans le fil (sinon incertain, jamais renvoyé).
  const r=await interfaceVinted(acc,'message',{conv:String(convId),texte:texteFinal});
  if(partie(r))ecrits++;
  // (29 oct., revue) Pas d'onglet, onglet hors de Vinted, ou pause : le message n'est PAS
  // parti (vérifié dans la page avant l'envoi) — un refus certain, pas « à vérifier »
  // (qui arrêtait toutes les files).
  if(r.rienParti&&!r.pause)return rep('refuse',0,raisonFavoriInterface(r));
  if(r.pause)return rep('refuse',0,r.robot?'vinted_robot':'pause_vinted');
  if(r.incertain)return rep('incertain',0,'reponse_inconnue');
  if(r.ok&&r.json?.code===0&&r.vu!==true){noterDiag('favori_message_pas_vu');await noterTexteRecent(uid,texteFinal);return rep('incertain',r.status,'reponse_inconnue');}""")
rep("""  let ecrits=0,frein='',variante=null,attente=null,apresMs=0;""","""  let ecrits=0,frein='',variante=null,attente=null,apresMs=0,lienCloche='';""")

# 4. La reprise d'un message après une offre (réveil du worker)
rep("""        const r = await vintedPage(acc, 'POST', `/api/v2/conversations/${e.convId}/replies`, corpsReponseVinted(e.texte), { timeoutMs: 12000 });
        if (r && r.ok && r.json && r.json.code === 0) { if (Number.isInteger(e.variante)) await noterVarianteDerniere(e.uid, 'favori', e.variante); n++; await finir('envoye', ''); }
        else await finir('refuse', r && r.pause ? 'pause_vinted' : r && r.sansPage ? 'onglet_vinted' : 'vinted_refus');""","""        // 5.414 : par l'interface (tapé, « Envoyer », vu dans le fil).
        const r = await interfaceVinted(acc, 'message', { conv: String(e.convId), texte: e.texte });
        if (r && r.ok && r.json && r.json.code === 0) { if (Number.isInteger(e.variante)) await noterVarianteDerniere(e.uid, 'favori', e.variante); if (r.vu !== true) noterDiag('favori_message_pas_vu'); n++; await finir('envoye', ''); }
        else await finir('refuse', r && r.pause ? (r.robot ? 'vinted_robot' : 'pause_vinted') : r && r.rienParti ? raisonFavoriInterface(r) : r && r.incertain ? 'reponse_inconnue' : 'vinted_refus');""")

# 5. aides : la raison d'un geste d'interface qui n'est pas parti, le lien d'un favori capté
rep("""async function sequenceFavoriBleam(x) {""","""// 5.414 : la raison (connue du serveur de la file) d'un geste par l'interface qui s'est arrêté AVANT de partir.
function raisonFavoriInterface(r) {
  if (!r) return 'vinted_refus';
  if (r.sansPage === 'compte') return 'compte_vinted_different';
  if (r.sansPage === 'identite') return 'identite_non_confirmee';
  if (r.sansPage === 'element') return 'element_introuvable';
  return 'onglet_vinted';
}
// Le lien natif d'UN favori, lu dans les captures de la cloche (archive + dernière lecture) : unique, sinon null.
async function lienDuFavori(uid, notificationId) {
  try {
    const s = await authToken(), owner = s && s.user_id;
    if (!owner || typeof notificationId !== 'string' || !notificationId) return null;
    const a = await archiveNotifications(uid, { lecture: true, ownerAttendu: owner });
    const raw = await sbGet(`app_data?id=eq.harvest_${uid}_notifications&owner=eq.${owner}&select=owner,data`);
    if (!a || !Array.isArray(raw)) return null;
    const ds = [a.data, ...raw.filter((r) => r && r.owner === owner).map((r) => r.data)].filter((d) => d && String(d.uid) === String(uid) && d.payload && Array.isArray(d.payload.notifications));
    const liens = [];
    for (const d of ds) for (const n of d.payload.notifications.slice(0, 10000)) if (n && n.id === notificationId && typeof n.link === 'string' && /favori|favourit/i.test(String(n.body || ''))) liens.push(n.link);
    const u = [...new Set(liens)];
    return u.length === 1 ? u[0] : null;
  } catch (_) { return null; }
}
async function sequenceFavoriBleam(x) {""")
open(p,'w',encoding='utf8').write(s)
print('ok')
