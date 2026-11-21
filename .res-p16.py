p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)
# retirer televerserPhotosRecreer
i=s.index("async function televerserPhotosRecreer(acc, urls, second, reglages, temp, suivi, origine = null) {")
j=s.index("// ══ 5.392 (15 nov., `photovrm`)", i)
s=s[:i]+"// (5.414) `televerserPhotosRecreer` (photos envoyées par requête) est RETIRÉE : les photos passent par le champ de fichiers du formulaire.\n"+s[j:]
# retirer vintedPagePhoto
i=s.index("// Une photo téléversée depuis la page : les octets passent en base64 (la page\n// rebâtit le même FormData")
j=s.index("// Une republication refusée faute d'onglet : la phrase dite à l'app.", i)
s=s[:i]+s[j:]
# empreintes des photos produites (5.392) aussi par le formulaire
rep("""async function photosPourFormulaire(urls, second, reglages) {
  const out = [];""","""async function photosPourFormulaire(urls, second, reglages, origine) {
  const out = [], empreintes = [];""")
rep("""    try { blob = await photoReglee(blob, reglages); } catch (e) { return { erreur: String(e && e.message || e).slice(0, 80) }; }
    let b64 = '';
    try { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000)); b64 = btoa(s); } catch (_) { return { erreur: `la photo ${i + 1} n'a pas pu être préparée` }; }
    out.push({ b64, type: blob.type || 'image/jpeg', nom: `photo-${i + 1}.jpg` });
  }
  return { photos: out };
}
async function nomCategorieVinted""","""    try { blob = await photoReglee(blob, reglages); } catch (e) { return { erreur: String(e && e.message || e).slice(0, 80) }; }
    // 5.392 (`photovrm`) / 5.414 : l'empreinte du fichier PRODUIT, comme le faisait l'envoi par requête.
    if (origine) { try { const h = await empreinteDeBlob(blob); if (h) empreintes.push(h); } catch (_) {} }
    let b64 = '';
    try { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000)); b64 = btoa(s); } catch (_) { return { erreur: `la photo ${i + 1} n'a pas pu être préparée` }; }
    out.push({ b64, type: blob.type || 'image/jpeg', nom: `photo-${i + 1}.jpg` });
  }
  return { photos: out, empreintes };
}
async function nomCategorieVinted""")
rep("""  const ph = await photosPourFormulaire(urls, second, reglages);
  if (!ph.photos) return fin({ accepte: true, etape: 'echec', raison: `${ph.erreur} — rien n'a été créé ni supprimé, ton annonce est intacte` });""",
"""  const ph = await photosPourFormulaire(urls, second, reglages, { uid, src: id, n: num });
  if (!ph.photos) return fin({ accepte: true, etape: 'echec', raison: `${ph.erreur} — rien n'a été créé ni supprimé, ton annonce est intacte` });""")
rep("""  etapeRepub(id, 'photos', { fait: ph.photos.length, total: ph.photos.length });
  const champs = [""","""  etapeRepub(id, 'photos', { fait: ph.photos.length, total: ph.photos.length });
  if (ph.empreintes && ph.empreintes.length) { try { if (await noterPhotosVrm({ uid, src: id, n: num }, ph.empreintes)) rangerPhotosVrm().catch(() => {}); } catch (_) {} }
  const champs = [""")
open(p,'w',encoding='utf8').write(s)
print('ok')
