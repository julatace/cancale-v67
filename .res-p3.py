p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

# republierVinted : modification en place par le formulaire « Modifier »
rep("""    const r = await vintedPage(acc, 'PUT', `/api/v2/item_upload/items/${id}`, built.corps);
    if (r && r.sansPage) return { accepte: false, code: 'onglet-vinted', raison: raisonSansPage(r) };
    if (!r || !r.ok) { await poserFreinRepub(uid, r); return { accepte: true, etape: 'echec', raison: `Vinted a refusé la modification (${(r && r.status) || 0}) — ton annonce est inchangée`, ancien: built.ancien, nouveau: built.nouveau }; }""",
"""    // 5.414 (`toutinterface`) : la modification par la page « Modifier » de Vinted (prix — et titre s'il l'a changé —
    //    tapés lettre à lettre, « Enregistrer ») ; la page envoie SA requête, VRM lit sa réponse.
    const r = await interfaceVinted(acc, 'prix', { id, prix: Number(built.nouveau), ...(msg.titre != null && built.nouveauTitre ? { titre: String(built.nouveauTitre) } : {}) });
    if (r && (r.sansPage || r.pause) && r.rienParti) { if (recuP.at) await rendreActions(uid, recuP.at, 1); return { accepte: false, code: r.pause ? 'verification' : 'onglet-vinted', raison: r.raison || raisonSansPage(r) }; }
    if (r && r.incertain) return { accepte: true, etape: 'incertain', raison: "Vinted n'a pas répondu clairement à la modification : regarde l'annonce sur Vinted (rien ne sera renvoyé).", ancien: built.ancien, nouveau: built.nouveau };
    if (!r || !r.ok) { await poserFreinRepub(uid, r); return { accepte: true, etape: 'echec', raison: `Vinted a refusé la modification (${(r && r.status) || 0}) — ton annonce est inchangée`, ancien: built.ancien, nouveau: built.nouveau }; }""")

# baisserPrixVinted
rep("""    const r = await vintedPage(acc, 'PUT', `/api/v2/item_upload/items/${id}`, built.corps, { timeoutMs: 60000 });
    if (pasParti(r)) { await rendre(); return { accepte: false, code: r.pause ? 'vinted-pause' : 'onglet-vinted', raison: r.pause ? (r.raison || 'Vinted demande de ralentir') : raisonSansPage(r) }; }""",
"""    // 5.414 (`toutinterface`) : le nouveau prix TAPÉ dans la page « Modifier » de Vinted, puis « Enregistrer » ; la page
    //    envoie SA requête (son propre corps : rien n'est rejoué), VRM lit sa réponse puis relit le prix (plus bas).
    const r = await interfaceVinted(acc, 'prix', { id, prix: voulu / 100 });
    if (pasParti(r)) { await rendre(); return { accepte: false, code: r.pause ? 'vinted-pause' : 'onglet-vinted', raison: r.pause ? (r.raison || 'Vinted demande de ralentir') : (r.raison || raisonSansPage(r)) }; }
    if (r && r.incertain) { noterDiag('baisse_incertaine'); return { accepte: true, etape: 'incertain', ancien: lue.prix, voulu: voulu / 100, prixVu: null, raison: "Vinted n'a pas répondu clairement : regarde l'annonce (rien ne sera renvoyé)" }; }""")

# raisonSansPage : les nouveaux refus d'interface
rep("""function raisonSansPage(r) {
  if (!r || !r.sansPage) return '';
  if (r.travailFerme) return RAISON_TRAVAIL_FERME;""",
"""function raisonSansPage(r) {
  if (!r || !r.sansPage) return '';
  if (r.travailFerme) return RAISON_TRAVAIL_FERME;
  if (r.raison && ['element', 'identite', 'ecriture'].includes(r.sansPage)) return r.raison;   // 5.414 : l'élément nommé, la page qui n'était pas la bonne""")
open(p,'w',encoding='utf8').write(s)
print('ok')
