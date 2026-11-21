p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

# refaireBrouillon : le brouillon refait depuis le coffre PAR LE FORMULAIRE (plus de requêtes photos / brouillon / mise en ligne)
a=s.index("async function refaireBrouillon(msg) {")
i=s.index("    suiviRepub(id);\n    const temp = uuidRecreer();\n    const tp = await televerserPhotosRecreer(acc, urls, [], reglagesPhotoSurs(vb.reglages)", a)
j=s.index("// ══ 5.408 (`repubreprise`)", i)
s=s[:i]+"""    suiviRepub(id);
    // 5.414 (`toutinterface`) : refait PAR LE FORMULAIRE de Vinted (photos du coffre déposées, champs tapés, « Sauvegarder
    //    le brouillon », relu contre ce qui est enregistré), sans supprimer (l'ancienne est déjà partie, ou il ne voulait
    //    qu'un brouillon) ; mis en ligne seulement si l'ancienne est retirée À COUP SÛR (`enLigneApres`).
    await poserVerrouRecreer('r' + id); await leverVerrouRecreer('r' + id);
    const titreR = String(d.title).replace(/\\s+/g, ' ').trim();
    const rf = await recreerParFormulaire({ acc, uid, id, msg, urls, second: [], reglages: reglagesPhotoSurs(vb.reglages), item: d, titre: titreR, prix: prixD, description: String(d.description || ''), descBase: sauve && sauve.desc, sauve, photosC: Array.isArray(sauve.photos) ? sauve.photos : urls, versB: !enLigneApres, lettreFin: null, sansSuppression: true, dejaSupprimee: enLigneApres });
    if (!(Number(rf.envoyes) > 0) && recuR.at) await rendreActions(uid, recuR.at, 1);
    const rr = rf.r || { accepte: true, etape: 'echec', raison: "le formulaire n'a pas répondu — rien n'a été créé" };
    return rr.etape === 'echec' ? { ...rr, refaire: true } : rr;
  });
}
"""+s[j:]

# reprendreRepub : la suppression de l'ancienne PAR SA PAGE (bouton + confirmation de Vinted)
rep("""      const rd = await avecVinted(async () => { await pauseRepub('suppression', uid); etapeRepub(id, 'suppression'); return vintedPage(acc, 'POST', `/api/v2/items/${id}/delete`, null, { timeoutMs: 60000 }); });""",
"""      // 5.414 (`toutinterface`) : « Supprimer » + la confirmation de Vinted, sur la page de CETTE annonce (son identifiant).
      const rd = await avecVinted(async () => { await pauseRepub('suppression', uid); etapeRepub(id, 'suppression'); return interfaceVinted(acc, 'supprimer', { id }); });
      if (rd && rd.incertain) { await poserVerrouRecreer(id); await majVersBrouillon(uid, id, { cause: 'suppression-incertaine' }); return { accepte: true, etape: 'incertain', draftId, raison: "Vinted n'a pas répondu clairement à la suppression : l'ancienne annonce est PEUT-ÊTRE encore en ligne. Regarde ton dressing avant de reprendre." }; }""")
open(p,'w',encoding='utf8').write(s)
print('ok')
