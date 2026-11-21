p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)
rep("""      await wait(1500 + Math.floor(Math.random() * 3000));
      return await vintedPage(acc, 'PUT', `/api/v2/items/${id}/is_hidden`, { is_hidden: voulu }, { timeoutMs: 30000 });
    });
    if (!r || r.pasParti || pasParti(r)) { if (recu.at) await rendreActions(String(uid), recu.at, 1); faits.push({ id, ok: false, code: r && r.pause ? 'pause' : 'onglet' }); break; }""",
"""      await wait(1500 + Math.floor(Math.random() * 3000));
      // 5.414 (`toutinterface`) : « Masquer » / « Afficher » sur la page de CETTE annonce (son identifiant dans l'adresse).
      return await interfaceVinted(acc, 'masquer', { id, voulu: !!voulu });
    });
    if (!r || r.pasParti || pasParti(r)) { if (recu.at) await rendreActions(String(uid), recu.at, 1); faits.push({ id, ok: false, code: r && r.pause ? 'pause' : r && r.sansPage === 'element' ? 'element' : 'onglet', ...(r && r.raison ? { raison: r.raison } : {}) }); break; }
    if (r.incertain) { faits.push({ id, ok: false, code: 'incertain', raison: "Vinted n'a pas répondu clairement : regarde l'annonce (rien ne sera renvoyé)" }); break; }""")
rep("""    await wait(800 + Math.floor(Math.random() * 1600));
    return await vintedPage(acc, 'PUT', `/api/v2/items/${id}/is_hidden`, { is_hidden: voulu }, { timeoutMs: 30000 });
  });""","""    await wait(800 + Math.floor(Math.random() * 1600));
    // 5.414 (`toutinterface`) : par la page de l'annonce (« Masquer » / « Afficher ») — plus de requête fabriquée.
    return await interfaceVinted(acc, 'masquer', { id, voulu: !!voulu });
  });""")
open(p,'w',encoding='utf8').write(s)
print('ok')
