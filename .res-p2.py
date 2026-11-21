p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
i=s.index("  if (opts.cacheSeul) noterDiag('tailles_cache_absent_lue');\n  const g = await gardeLecture(uid, acc, 'clic');")
j=s.index("  try { echantillonRate('tailles_reponse_forme', cat, JSON.stringify(formeJson(r.json)).slice(0, 1500)); } catch (_) {}")
s=s[:i]+"""  // ⚠️ 5.414 (`toutinterface`, « on ne fait plus les requêtes ») : PLUS de `POST item_upload/attributes` fabriqué. La
  //    liste est APPRISE quand la page de Vinted la demande elle-même (le formulaire rempli par VRM dans l'onglet de
  //    travail, ou par lui) : `rangerGrilleTailles`. Pas encore apprise ⇒ « pas su », dit — jamais devinée.
  noterDiag('tailles_pas_apprises');
  return { raison: "VRM ne connaît pas encore la liste de Vinted pour cette catégorie (elle s'apprend quand la page « Vendre » la montre)" };
}
// La liste des tailles que la PAGE de Vinted a reçue (réponse de SA requête, vue dans l'onglet de travail) : rangée
// comme avant, 24 h, 30 catégories au plus. Rend la grille, ou { raison }.
async function rangerGrilleTailles(catalogId, json) {
  const cat = String(Number(catalogId) || '');
  if (!cat || cat === '0' || !json || typeof json !== 'object') return { raison: 'liste illisible' };
  let st = null; try { st = (await chrome.storage.local.get(TAILLES_VU))[TAILLES_VU] || null; } catch (_) {}
  const r = { json };
"""+s[j:]
open(p,'w',encoding='utf8').write(s)
print('ok')
