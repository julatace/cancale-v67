p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

rep("""    etapeRepub(id, 'en-ligne');
    await poserVerrouRecreer('b' + draftId);
    // 5.408 : la mise en ligne PART — un service worker tué à partir d'ici ne la renvoie jamais sans relire.
    try { await modifierAttente((cur) => { if (cur[id] && cur[id].enCoursLe) cur[id] = { ...cur[id], phase: 'envoi' }; }); } catch (_) {}
    const rcV = await vintedPage(acc, 'POST', `/api/v2/item_upload/drafts/${draftId}/completion`, corpsCV, { timeoutMs: 60000 });""",
"""    etapeRepub(id, 'en-ligne');
    // 5.408 : la mise en ligne PART — un service worker tué à partir d'ici ne la renvoie jamais sans relire.
    try { await modifierAttente((cur) => { if (cur[id] && cur[id].enCoursLe) cur[id] = { ...cur[id], phase: 'envoi' }; }); } catch (_) {}
    // 5.414 (`toutinterface`) : « Ajouter » sur la page du brouillon (les champs réglés posés d'abord) — la page envoie.
    let vivantF = null; try { const jl = rlB && rlB.ok && rlB.json && typeof rlB.json === 'object' ? rlB.json : null; vivantF = jl ? (jl.item || jl.draft || null) : null; } catch (_) { vivantF = null; }
    const rcV = await miseEnLigneParPage(acc, uid, draftId, corpsCV.draft, vivantF, null);""")
open(p,'w',encoding='utf8').write(s)
print('ok')
