p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

rep("""    // (5.342, P1) Son geste part de l'onglet vinted.fr quand il est ouvert (comme le
    // site). Sans onglet (téléphone, autre navigateur) : son clic part comme avant —
    // c'est un geste humain, un à la fois. Un onglet qui a quitté Vinted : rien ne part.
    const rp = await vintedPage(acc, methode, msg.endpoint, msg.body, { timeoutMs: 12000 });
    if (rp && rp.horsVinted) { rienParti = true; return { status: 0, ok: false, json: { message: "l'onglet Vinted a changé de page — rien n'est parti, réessaie" } }; }
    if (rp && rp.sansPage === 'compte') { rienParti = true; return { status: 0, ok: false, json: { message: RAISON_COMPTE_PAGE } }; }
    if (rp && rp.sansPage && !rp.pause) return vintedSend(acc, methode, msg.endpoint, msg.body);
    return rp;""","""    // ⚠️ 5.414 (`toutinterface`, « on ne fait plus les requêtes ») : SON geste se fait PAR L'INTERFACE de vinted.fr, dans
    //    l'onglet de travail (le compte de l'onglet) — répondre (tapé, « Envoyer », vu dans le fil), faire une offre
    //    (« Faire une offre », le prix tapé, « Proposer », vue), accepter / refuser (le fil relu : CETTE offre, puis son
    //    bouton). Plus de repli « sans onglet » par le service worker : sans onglet vinted.fr, RIEN ne part, c'est dit.
    const rp = await gesteAppParInterface(acc, String(msg.uid), methode, String(msg.endpoint || ''), msg);
    if (rp && rp.rienParti) { rienParti = true; return { status: 0, ok: false, pause: !!rp.pause, json: { message: rp.raison || raisonSansPage(rp) || (rp.sansPage === 'compte' ? RAISON_COMPTE_PAGE : "ouvre vinted.fr dans ce Chrome, connecté sur ce compte : rien n'est parti") } }; }
    if (rp && rp.incertain) return { status: 0, ok: false, json: { message: "Vinted n'a pas répondu clairement : regarde la conversation sur Vinted avant de réessayer (rien ne sera renvoyé)" } };
    return rp;""")
rep("""  return { ok: !!r.ok, status: r.status, data: r.json,
           error: r.ok ? '' : ((r.json && (r.json.message || r.json.error)) || `erreur ${r.status}`) };
}""","""  return { ok: !!r.ok, status: r.status, data: r.json, ...(r.vu === false ? { pasVu: true } : {}),
           error: r.ok ? '' : ((r.json && (r.json.message || r.json.error)) || `erreur ${r.status}`) };
}
// 5.414 — UNE COMMANDE D'ÉCRITURE DE L'APP (liste blanche `EXEC_PERMIS`) TRADUITE EN GESTE D'INTERFACE. Les identités
// viennent du chemin (conversation, transaction, offre) ; la conversation d'une offre est retrouvée PAR IDENTITÉ
// (`convDeTransaction`), jamais devinée. Rend la réponse que la PAGE a reçue, ou { rienParti, raison }.
async function gesteAppParInterface(acc, uid, methode, endpoint, msg) {
  const rien = (raison) => ({ status: 0, ok: false, json: null, rienParti: true, sansPage: 'element', raison });
  let m = /^\\/api\\/v2\\/conversations\\/([1-9]\\d{0,19})\\/replies$/.exec(endpoint);
  if (methode === 'POST' && m) {
    const txt = msg && msg.body && msg.body.reply && typeof msg.body.reply.body === 'string' ? msg.body.reply.body : '';
    if (!txt.trim()) return rien('message vide — rien n’est parti');
    return interfaceVinted(acc, 'message', { conv: m[1], texte: txt });
  }
  m = /^\\/api\\/v2\\/transactions\\/([1-9]\\d{0,19})\\/offer_requests\\/([1-9]\\d{0,19})\\/(accept|reject)$/.exec(endpoint);
  if (methode === 'PUT' && m) {
    const conv = ID_INTERFACE.test(String((msg && msg.conv) || '')) ? String(msg.conv) : await convDeTransaction(uid, m[1]);
    return repondreOffreInterface(acc, { conv, tx: m[1], oid: m[2], accepter: m[3] === 'accept' });
  }
  m = /^\\/api\\/v2\\/transactions\\/([1-9]\\d{0,19})\\/offers$/.exec(endpoint);
  if (methode === 'POST' && m) {
    const prix = Number(msg && msg.body && msg.body.offer && msg.body.offer.price);
    if (!(prix > 0)) return rien('prix de l’offre illisible — rien n’est parti');
    const conv = ID_INTERFACE.test(String((msg && msg.conv) || '')) ? String(msg.conv) : await convDeTransaction(uid, m[1]);
    if (!conv) return { ...rien('la conversation de cette transaction n’est pas connue de VRM : rien n’est parti'), sansPage: 'identite' };
    return interfaceVinted(acc, 'offre', { conv, tx: m[1], prix });
  }
  return rien('ce geste ne se fait pas par l’interface — rien n’est parti');
}""")
# offreCarte : la conversation de l'offre, connue par identité
rep("""    const r = await executerPourAppCoeur({ uid: String(uid), method: 'POST', endpoint: `/api/v2/transactions/${off.tx}/offers`, body: { offer: { price: (pc / 100).toFixed(2), currency: 'EUR' } } });""",
"""    const r = await executerPourAppCoeur({ uid: String(uid), method: 'POST', endpoint: `/api/v2/transactions/${off.tx}/offers`, conv: off.conv, body: { offer: { price: (pc / 100).toFixed(2), currency: 'EUR' } } });""")
rep("""  const r = await executerPourAppCoeur({ uid: String(uid), method: 'PUT', endpoint, confirme: true, item: off.item || undefined, ...(msg.avisVu === true ? { avisVu: true } : {}) });""",
"""  const r = await executerPourAppCoeur({ uid: String(uid), method: 'PUT', endpoint, conv: off.conv, confirme: true, item: off.item || undefined, ...(msg.avisVu === true ? { avisVu: true } : {}) });""")
open(p,'w',encoding='utf8').write(s)
print('ok')
