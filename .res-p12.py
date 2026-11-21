p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)
rep("""  const page=pageFavoriNative(lienCloche||await lienDuFavori(uid,body.notificationId),acc.domain||'www.vinted.fr');
  if(!page||page.itemId!==body.itemId||(destinataireLienFavori(page)&&destinataireLienFavori(page)!==body.recipientId)){noterDiag('favori_lien_inconnu');return rep('refuse',0,'identite_non_confirmee');}
  const creation=await interfaceVinted(acc,'favoriOuvrir',{lien:page.url,itemId:body.itemId,receiverId:body.recipientId});""",
"""  // Le lien capté (s'il est connu) doit porter CET article et CE destinataire ; sans lien, seule la ligne native
  // `?item_id=&receiver_id=` aux DEUX identités du favori est acceptée par la page.
  const lienBrut=lienCloche||(typeof body.notificationId==='string'&&body.notificationId?await lienDuFavori(uid,body.notificationId):null);
  const page=lienBrut?pageFavoriNative(lienBrut,acc.domain||'www.vinted.fr'):null;
  if(lienBrut&&(!page||page.itemId!==body.itemId||(destinataireLienFavori(page)&&destinataireLienFavori(page)!==body.recipientId))){noterDiag('favori_lien_autre');return rep('refuse',0,'identite_non_confirmee');}
  const creation=await interfaceVinted(acc,'favoriOuvrir',{lien:page?page.url:'',itemId:body.itemId,receiverId:body.recipientId});""")
open(p,'w',encoding='utf8').write(s)
p='vinted-sync-extension/vrm-formulaire.js'
s=open(p,encoding='utf8').read()
rep("""      if (!/^[1-9]\\d{0,19}$/.test(itemId) || !/^[1-9]\\d{0,19}$/.test(receiverId) || !lien) return { ok: false, code: 'etape' };""",
"""      if (!/^[1-9]\\d{0,19}$/.test(itemId) || !/^[1-9]\\d{0,19}$/.test(receiverId)) return { ok: false, code: 'etape' };""")
rep("""      if (!conv) return rep ? { ok: true, rep, conv: '', envoye: true } : { ok: false, code: 'sans-conversation', chemin: location.pathname, parti: true };""",
"""      // Rien vu partir (aucune requête de création, aucune conversation montrée) : la page n'a rien écrit — arrêt, rien ne part.
      if (!conv) return rep ? { ok: true, rep, conv: '', envoye: true } : manque('conversation-pas-ouverte');""")
rep("""    const attendu = norme(lien);""","""    const attendu = lien ? norme(lien) : null;""")
open(p,'w',encoding='utf8').write(s)
print('ok')
