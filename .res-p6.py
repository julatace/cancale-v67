p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

# recreerVinted : le formulaire, SEULE méthode
rep("""    if (msg.methode !== 'directe' && (msg.methode === 'formulaire' || (await reglagesCommeBleam()).methode === 'formulaire')) {
      const essaiF = itemPourRecreer(""","""    // ⚠️ 5.414 (`toutinterface`, Julien, 21 nov. : « on ne fait plus les requêtes ») : le formulaire est la SEULE méthode.
    //    Une ancienne demande « directe » (commande, réglage enregistré, Stock auto d'avant) est IGNORÉE et c'est noté.
    if (msg.methode === 'directe' || (await reglagesCommeBleam()).methodeAvant === 'directe') noterDiag('repub_directe_ignoree');
    {
      const essaiF = itemPourRecreer(""")
rep("""      const rf = await recreerParFormulaire({ acc, uid, id, msg, urls, second, reglages, item: essaiF.item, titre, prix, description, descBase, sauve, photosC, versB, lettreFin, recette });
      envoyes += Number(rf.envoyes) || 0;
      return rf.r;
    }
""","""      const dupliquer = msg.dupliquer === true;   // 5.410.4 « Stock auto » : l'annonce VENDUE reste, rien n'est supprimé
      const rf = await recreerParFormulaire({ acc, uid, id, msg, urls, second, reglages, item: essaiF.item, titre, prix, description, descBase, sauve, photosC, versB, lettreFin, recette, ...(dupliquer ? { sansSuppression: true, dupliquee: true } : {}) });
      envoyes += Number(rf.envoyes) || 0;
      return rf.r;
    }
""")
i=s.index("    // 2. Les photos, une par une, depuis la page.\n    await pauseRepub('lecture', uid);\n    const temp = uuidRecreer();")
j=s.index("  } finally { if (!confie && nA - envoyes > 0) await rendreActions(uid, tRes, nA - envoyes); } });\n}", i)
s=s[:i]+"    // (5.414) L'ancienne méthode « directe » (photos, brouillon, suppression, mise en ligne par requêtes) est RETIRÉE.\n"+s[j:]

# réglage : « directe » ignorée et dite
rep("""  return { methode: o.methode === 'directe' ? 'directe' : 'formulaire', favoris: o.favoris !== false, messageLot: lot, offreMin: a, offreMax: b };""",
"""  // 5.414 : une seule méthode, le formulaire ; une ancienne valeur « directe » enregistrée est ignorée (et dite : `methodeAvant`).
  return { methode: 'formulaire', ...(o.methode === 'directe' ? { methodeAvant: 'directe' } : {}), favoris: o.favoris !== false, messageLot: lot, offreMin: a, offreMax: b };""")
rep("""  if (v.methode != null) { if (!['formulaire', 'directe'].includes(v.methode)) return { ok: false, raison: 'méthode inconnue' }; n.methode = v.methode; }""",
"""  if (v.methode != null) { if (v.methode !== 'formulaire') return { ok: false, raison: 'la republication passe toujours par le formulaire de Vinted (l’ancienne méthode « directe » est retirée)' }; n.methode = 'formulaire'; delete n.methodeAvant; }""")
rep("""  try { await chrome.storage.local.set({ [COMME_BLEAM]: { methode: n.methode, favoris: n.favoris,""","""  try { await chrome.storage.local.set({ [COMME_BLEAM]: { methode: 'formulaire', favoris: n.favoris,""")

# recreerParFormulaire : sansSuppression (Stock auto, brouillon refait depuis le coffre)
rep("""  const { acc, uid, id, msg, urls, second, reglages, item, titre, prix, description, descBase, sauve, photosC, versB, lettreFin } = c;
  let envoyes = 0;""","""  const { acc, uid, id, msg, urls, second, reglages, item, titre, prix, description, descBase, sauve, photosC, versB, lettreFin } = c;
  // 5.414 : `sansSuppression` — l'ancienne n'est PAS supprimée (Stock auto : elle porte la vente, `dupliquee` ; brouillon
  //    refait depuis le coffre : elle l'est déjà, `dejaSupprimee`). Le brouillon puis la mise en ligne, par le formulaire.
  const sansSupp = c.sansSuppression === true;
  let envoyes = 0;""")
rep("""versBrouillon: { corps: JSON.stringify({ draft: brouillonV, feedback_id: null, parcel: null }), at: new Date().toISOString(), titre, prix, publier: !versB, reglages, etat: 'enregistre', uid, methode: 'formulaire', num: num ? num.slice(0, 12) : undefined, etapes: { coffre: new Date().toISOString() } } } }], 'id'));""",
"""versBrouillon: { corps: JSON.stringify({ draft: brouillonV, feedback_id: null, parcel: null }), at: new Date().toISOString(), titre, prix, publier: !versB, reglages, etat: 'enregistre', uid, methode: 'formulaire', num: num ? num.slice(0, 12) : undefined, ...(c.dupliquee ? { dupliquee: true } : {}), ...(c.dejaSupprimee ? { supprime: true, supprimeLe: (sauve && sauve.versBrouillon && sauve.versBrouillon.supprimeLe) || new Date().toISOString() } : {}), etapes: { coffre: new Date().toISOString() } } } }], 'id'));""")
rep("""  // 4. La page « Modifier » de l'ancienne (une lecture), puis « Vends tes articles ».
  etapeRepub(id, 'formulaire', { champ: 'ouverture' });
  if (!(await naviguerTravail(tab, `https://${domaine}/items/${id}/edit`, /\\/items\\/\\d+\\/edit/))) {""","""  // 4. La page « Modifier » de l'ancienne (une lecture), puis « Vends tes articles » (sans suppression : la page de
  //    l'annonce, ou « Vendre » directement si elle n'existe plus).
  etapeRepub(id, 'formulaire', { champ: 'ouverture' });
  if (!(await naviguerTravail(tab, sansSupp ? `https://${domaine}/items/${c.dejaSupprimee ? 'new' : id}` : `https://${domaine}/items/${id}/edit`, sansSupp ? /\\/items\\/(new|\\d+)/ : /\\/items\\/\\d+\\/edit/))) {""")
rep("""  await marquer('brouillon-range', { draftId, supprime: false });
  // 7. L'ancienne : « Supprimer » + la confirmation de Vinted, sur sa page.""","""  if (sansSupp) {
    // 5.414 : pas de suppression (Stock auto : l'annonce vendue reste ; brouillon refait : l'ancienne est déjà partie).
    await marquer('brouillon-range', { draftId, ...(c.dejaSupprimee ? { supprime: true } : { supprime: false }) });
    if (versB) return fin({ accepte: true, etape: 'fait', draftId, brouillon: true, nouveau: prix, nouveauTitre: titre });
    etapeRepub(id, 'attente');
    await pauseFormulaire('apresSuppression', uid);
    const rp0 = await publierParFormulaire(acc, uid, id, tab, draftId, { titre, prix, nPhotos: ph.photos.length, sauve, description, lettreFin, urls, num });
    if (rp0.parti) envoyes++;
    return fin(rp0.r);
  }
  await marquer('brouillon-range', { draftId, supprime: false });
  // 7. L'ancienne : « Supprimer » + la confirmation de Vinted, sur sa page.""")
open(p,'w',encoding='utf8').write(s)
print('ok')
