p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

a=s.index("async function creerVintedFiche(msg) {")
i=s.index("    suiviRepub('f' + ficheId);\n    const temp = uuidRecreer();\n    const ids = [];", a)
j=s.index("    envoye = true;\n    if (!rb || rb.status === 0 || rb.status >= 500) {", i)
s=s[:i]+"""    suiviRepub('f' + ficheId);
    // ⚠️ 5.414 (`toutinterface`, « on ne fait plus les requêtes ») : le brouillon PAR LE FORMULAIRE de Vinted — page
    //    « Vendre » dans l'onglet de travail, photos de la fiche déposées dans SON champ, chaque champ connu choisi / tapé,
    //    « Sauvegarder le brouillon » ; la PAGE envoie, VRM lit sa réponse et relit ce qu'elle a envoyé.
    const ph = await photosFicheFormulaire(photos, (k, n) => etapeRepub('f' + ficheId, 'photos', { fait: k, total: n }));
    if (!ph.photos) return { accepte: true, etape: 'echec', raison: `${ph.erreur} — rien n’a été créé sur Vinted` };
    const ot = await ongletTravailVinted(acc, uid);
    if (ot.refus) return { accepte: false, code: 'onglet-vinted', raison: raisonSansPage({ sansPage: ot.refus === 'travail-ferme' ? 'onglet' : ot.refus, travailFerme: ot.refus === 'travail-ferme' }) };
    const tab = ot.tabId, domaine = acc.domain || 'www.vinted.fr';
    if (!(await naviguerTravail(tab, `https://${domaine}/items/new`, /\\/items\\/new/))) return { accepte: false, code: 'onglet-vinted', raison: RAISON_ONGLET_VINTED };
    const echecF = (o) => (o.code === 'captcha' ? { accepte: false, code: 'verification', raison: `${PHRASE_CAPTCHA} Rien n’a été créé sur Vinted.` } : o.code === 'selecteur' ? { accepte: true, etape: 'echec', code: 'selecteur', manque: o.manque, raison: `${PHRASE_SELECTEUR(o.manque)} — rien n’a été créé sur Vinted.` } : { accepte: true, etape: 'echec', raison: `le formulaire de Vinted n'a pas répondu (${o.code || 'onglet'}) — rien n’a été créé sur Vinted.` });
    let o = await etapeFormulaire(acc, tab, 'formulairePret'); if (!o.ok) return echecF(o);
    o = await etapeFormulaire(acc, tab, 'photos', { photos: ph.photos }); if (!o.ok) return o.code === 'refus' ? { accepte: true, etape: 'echec', raison: `Vinted n’a pas accepté une photo (${o.status || 0}) — rien n’a été créé sur Vinted` } : echecF(o);
    etapeRepub('f' + ficheId, 'photos', { fait: ph.photos.length, total: ph.photos.length });
    const attendu = champsFormulaire(it);
    const cat = attendu.categorie ? await nomCategorieVinted(attendu.categorie) : null;
    const champs = [
      ...(attendu.categorie && cat ? [['categorie', { id: attendu.categorie, nom: cat.nom, recherche: cat.nom }]] : []),
      ['titre', { valeur: attendu.titre }], ['description', { valeur: attendu.description }],
      ...(attendu.marque ? [['marque', { id: attendu.marqueId, nom: attendu.marque }]] : []),
      ...(attendu.taille ? [['taille', { id: attendu.taille }]] : []),
      ...(attendu.couleurs.length ? [['couleurs', { ids: attendu.couleurs }]] : []),
      ...(attendu.etat ? [['etat', { id: attendu.etat }]] : []),
      ['prix', { valeur: attendu.prix }],
    ];
    for (const [quoi, d] of champs) {
      await pauseFormulaire('champ', uid);
      { const st = await arretFormulaire(uid, acc); if (st) return { accepte: false, code: st.code, raison: `${st.raison} — rien n’a été créé sur Vinted.` }; }
      etapeRepub('f' + ficheId, 'formulaire', { champ: quoi });
      o = await etapeFormulaire(acc, tab, 'champ', { quoi, ...d });
      if (!o.ok) return echecF(o);
    }
    await pauseFormulaire('champ', uid);
    { const st = await arretFormulaire(uid, acc); if (st) return { accepte: false, code: st.code, raison: `${st.raison} — rien n’a été créé sur Vinted.` }; }
    etapeRepub('f' + ficheId, 'brouillon');
    await poserVerrouFiche(ficheId, { etat: 'envoi', uid });
    o = await etapeFormulaire(acc, tab, 'brouillon', { cle: 'bf' + ficheId });
    if (!o.ok && !o.parti && o.code !== 'sans-reponse' && o.code !== 'perdu') { await poserVerrouFiche(ficheId, null); return echecF(o); }
    const rb = o.rep || null;
    const ids = ph.photos;
    let draft = it; try { const e = rb && rb.corps ? JSON.parse(rb.corps) : null; if (e && e.draft && typeof e.draft === 'object') draft = e.draft; } catch (_) {}
    if (rb && rb.ok) { const ec = ecartsBrouillonFormulaire({ ...attendu, colis: null }, rb.corps); if (ec && ec.length) { noterDiag('fiche_formulaire_ecart'); aFinir.push(...ec); } }
"""+s[j:]
rep("""    const corpsCV = { draft: { ...draft, id: Number(draftId) }, feedback_id: null, parcel: null, push_up: false, upload_session_id: temp };
    const range = await rangerBrouillon(draftId, { uid, corps: JSON.stringify(corpsCV), titre, prix, nPhotos: ids.length, parVRM: true, ficheId, numero, etat: 'brouillon' });""",
"""    const corpsCV = { draft: { ...draft, id: Number(draftId) }, feedback_id: null, parcel: null, push_up: false };
    const range = await rangerBrouillon(draftId, { uid, corps: JSON.stringify(corpsCV), titre, prix, nPhotos: ids.length, parVRM: true, ficheId, numero, etat: 'brouillon', methode: 'formulaire' });""")
# l'aide des photos d'une fiche pour le formulaire
rep("""// (19 nov., 5.409, publier-agent) + les photos d'un article venu d'un AUTRE site""","""// 5.414 : les photos d'une fiche, préparées pour le champ de fichiers du formulaire (base64, réglages sûrs), AVANT tout geste.
async function photosFicheFormulaire(photos, suivi) {
  const out = [];
  for (let i = 0; i < photos.length; i++) {
    if (typeof suivi === 'function') suivi(i, photos.length);
    let blob = blobPhotoFiche(photos[i]);
    if (!blob) { try { const r = await fetch(photos[i], { signal: AbortSignal.timeout(30000) }); if (r.ok) blob = await r.blob(); } catch (_) { blob = null; } }
    if (!blob) return { erreur: `la photo ${i + 1} n’a pas pu être lue` };
    try { blob = await photoReglee(blob, reglagesPhotoSurs(null)); } catch (e) { return { erreur: String(e && e.message || e).slice(0, 80) }; }
    let b64 = '';
    try { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000)); b64 = btoa(s); } catch (_) { return { erreur: `la photo ${i + 1} n'a pas pu être préparée` }; }
    out.push({ b64, type: blob.type || 'image/jpeg', nom: `photo-${i + 1}.jpg` });
  }
  return { photos: out };
}
// (19 nov., 5.409, publier-agent) + les photos d'un article venu d'un AUTRE site""")
open(p,'w',encoding='utf8').write(s)
print('ok')
