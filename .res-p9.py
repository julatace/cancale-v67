p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

s=s.replace("    await poserVerrouRecreer('r' + id); await leverVerrouRecreer('r' + id);\n    const titreR","    const titreR")
rep("""  const nA = vb.supprime === true ? 1 : 2;
  const recu = {};
  const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, actions: nA, recu, sorte: 'republier', secu: { sorte: 'republication', mode: 'clic' } });""",
"""  // 5.414 : l'ancienne est supprimée seulement si elle n'est pas prouvée partie ET qu'elle n'est pas l'annonce VENDUE
  //    d'un « Stock auto » (`dupliquee`) ; le brouillon n'est mis en ligne que s'il l'avait demandé (`publier`).
  const doitSupprimer = vb.supprime !== true && vb.dupliquee !== true;
  const doitPublier = vb.publier === true;
  const nA = Math.max(1, (doitSupprimer ? 1 : 0) + (doitPublier ? 1 : 0));
  const recu = {};
  const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, actions: nA, recu, sorte: 'republier', secu: { sorte: 'republication', mode: 'clic' } });""")
rep("""    if (vb.publier === true && vb.supprime !== true) {
      const ra = await vintedPage(acc, 'GET', `/api/v2/item_upload/items/${id}`, null, { timeoutMs: 30000 });""",
"""    if (doitSupprimer) {
      const ra = await vintedPage(acc, 'GET', `/api/v2/item_upload/items/${id}`, null, { timeoutMs: 30000 });""")
rep("""      } else return { accepte: false, code: 'ancienne-pas-sure', raison: `Vinted n'a pas répondu en relisant l'ancienne annonce (${(ra && ra.status) || 'pas de réponse'}) — VRM ne sait pas si elle est encore en ligne. Rien n'a été touché, réessaie dans un moment.` };
      await pauseFormulaire('apresSuppression', uid);
    }
    await leverVerrouRecreer(id);""",
"""      } else return { accepte: false, code: 'ancienne-pas-sure', raison: `Vinted n'a pas répondu en relisant l'ancienne annonce (${(ra && ra.status) || 'pas de réponse'}) — VRM ne sait pas si elle est encore en ligne. Rien n'a été touché, réessaie dans un moment.` };
      if (doitPublier) await pauseFormulaire('apresSuppression', uid);
    }
    await leverVerrouRecreer(id);
    // 5.414 : il ne voulait qu'un BROUILLON (« En ligne → brouillon ») : l'ancienne est partie, le brouillon reste — jamais mis en ligne.
    if (!doitPublier) { await majVersBrouillon(uid, id, { etat: 'fait', draftId }); return { accepte: true, etape: 'fait', draftId, brouillon: true, reprise: true }; }""")
open(p,'w',encoding='utf8').write(s)
print('ok')
