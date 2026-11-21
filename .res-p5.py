p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

rep("""  { const gL = await gardeLecture(uid, acc, 'clic');
    if (!ancienneOk) {""","""  let vivantB = null;   // 5.414 : le brouillon tel que Vinted le montre (les champs que la page « Modifier » affichera)
  { const gL = await gardeLecture(uid, acc, 'clic');
    if (!ancienneOk) {""")
rep("""      const lu = appliquerBrouillonLu(r.d, rl, id);
      r.photosDe = lu.photos > 0 ? 'relu' : 'stocke';""","""      try { const jl = rl && rl.ok && rl.json && typeof rl.json === 'object' ? rl.json : null; vivantB = jl ? (jl.item || jl.draft || null) : null; if (vivantB) vivantB = JSON.parse(JSON.stringify(vivantB)); } catch (_) { vivantB = null; }
      const lu = appliquerBrouillonLu(r.d, rl, id);
      r.photosDe = lu.photos > 0 ? 'relu' : 'stocke';""")
rep("""    const temp = (typeof r.d.temp_uuid === 'string' && r.d.temp_uuid) ? r.d.temp_uuid : uuidRecreer();
    const corpsC = { draft: { ...r.d, id: Number(id) }, feedback_id: null, parcel: null, push_up: false, upload_session_id: temp };
    try { PHOTOS_DE.set(corpsC, r.photosDe || 'stocke'); } catch (_) {}
    suiviRepub(id); etapeRepub(id, 'en-ligne');
    await poserVerrouRecreer('b' + id);
    let rc = await vintedPage(acc, 'POST', `/api/v2/item_upload/drafts/${id}/completion`, corpsC, { timeoutMs: 60000 });
    if (rc && rc.sansPage) { await leverVerrouRecreer('b' + id); return { accepte: false, code: 'onglet-vinted', raison: raisonSansPage(rc) }; }
    if (rc && rc.pause) { await leverVerrouRecreer('b' + id); return { accepte: false, code: 'vinted-pause', raison: `${rc.raison || 'Vinted demande de ralentir'} — rien n'a été envoyé.` }; }""",
"""    const corpsC = { draft: { ...r.d, id: Number(id) }, feedback_id: null, parcel: null, push_up: false };
    suiviRepub(id); etapeRepub(id, 'en-ligne');
    // 5.414 (`toutinterface`) : la mise en ligne PAR LA PAGE du brouillon (« Modifier » → les champs que VRM a réglés,
    //    tapés / choisis dans le formulaire → « Ajouter ») ; la page envoie SA requête, VRM lit sa réponse.
    let rc = await miseEnLigneParPage(acc, uid, id, r.d, vivantB, msg);
    if (rc && rc.rienParti) { if (recuB.at) await rendreActions(uid, recuB.at, 1); return { accepte: false, code: rc.pause ? 'vinted-pause' : 'onglet-vinted', raison: `${rc.raison || raisonSansPage(rc) || 'rien n’est parti'}${rc.pause ? ' — rien n’a été envoyé.' : ''}` }; }""")
# l'aide : la mise en ligne d'un brouillon par sa page
rep("""// Les photos d'une recréation : lues (l'autre copie si un lien est périmé),
// réglées en pixels, téléversées une par une.""","""// 5.414 — LA MISE EN LIGNE D'UN BROUILLON PAR SA PAGE (« Modifier » → « Ajouter »), comme le ferait sa main : d'abord
// les champs que VRM a RÉGLÉS (couleur choisie, catégorie, taille, état, colis complétés par identité) s'ils diffèrent
// de ce que Vinted montre ; puis « Ajouter ». Verrou de 30 min posé AVANT le clic (jamais deux mises en ligne).
// Rend la réponse que la PAGE a reçue (forme `vintedPage`), ou { rienParti, raison } avant le geste.
async function miseEnLigneParPage(acc, uid, draftId, voulu, vivant, msg) {
  const ot = await ongletTravailVinted(acc, uid);
  if (ot.refus) return { status: 0, ok: false, json: null, rienParti: true, sansPage: ot.refus === 'travail-ferme' ? 'onglet' : ot.refus, travailFerme: ot.refus === 'travail-ferme' };
  const tab = ot.tabId, domaine = acc.domain || 'www.vinted.fr';
  if (!(await naviguerTravail(tab, `https://${domaine}/items/${draftId}/edit`, new RegExp(`/items/${draftId}/edit`)))) return { status: 0, ok: false, json: null, rienParti: true, sansPage: 'identite', raison: "l'onglet de Vinted n'a pas ouvert le brouillon — rien n'a été envoyé." };
  { const f = await etapeFormulaire(acc, tab, 'formulairePret'); if (!f.ok) return resultatInterface(f, 'publier'); }
  const a = champsFormulaire(voulu || {}), v = vivant ? champsFormulaire(vivant) : null;
  const etapes = [];
  if (v) {
    if (a.taille && a.taille !== v.taille) etapes.push(['taille', { id: a.taille }]);
    if (a.couleurs.length && JSON.stringify([...a.couleurs].sort()) !== JSON.stringify([...v.couleurs].sort())) etapes.push(['couleurs', { ids: a.couleurs }]);
    if (a.colis && a.colis !== v.colis) etapes.push(['colis', { id: a.colis }]);
    if (a.etat && a.etat !== v.etat) etapes.push(['etat', { id: a.etat }]);
    if (a.categorie && a.categorie !== v.categorie) { const cat = await nomCategorieVinted(a.categorie); etapes.unshift(['categorie', { id: a.categorie, nom: cat && cat.nom, recherche: cat && cat.nom }]); }
  } else if (Number(msg && msg.couleur) > 0 && a.couleurs.length) etapes.push(['couleurs', { ids: a.couleurs }]);
  for (const [quoi, d] of etapes) {
    await pauseFormulaire('champ', uid);
    { const st = await arretFormulaire(uid, acc); if (st) return { status: 0, ok: false, json: null, rienParti: true, sansPage: 'element', raison: `${st.raison} — rien n'a été envoyé.` }; }
    const o = await etapeFormulaire(acc, tab, 'champ', { quoi, ...d });
    if (!o.ok) return resultatInterface(o, 'publier');
  }
  await pauseFormulaire('champ', uid);
  { const st = await arretFormulaire(uid, acc); if (st) return { status: 0, ok: false, json: null, rienParti: true, sansPage: 'element', raison: `${st.raison} — rien n'a été envoyé.` }; }
  await poserVerrouRecreer('b' + draftId);
  const o = await etapeFormulaire(acc, tab, 'publier', { draftId, cle: 'p' + draftId });
  const r = resultatInterface(o, 'publier');
  if (r.rienParti) await leverVerrouRecreer('b' + draftId);
  return r;
}
// Les photos d'une recréation : lues (l'autre copie si un lien est périmé),
// réglées en pixels, téléversées une par une.""")
open(p,'w',encoding='utf8').write(s)
print('ok')
