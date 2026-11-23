// ── CE QUE POSTGREST RÉPOND À UNE ÉCRITURE (16 nov., lot compta-donnees) ─────────
// `Prefer: return=representation` : un PATCH rend les lignes ÉCRITES (vide = la garde
// `data->>rev` a refusé : quelqu'un a écrit entre-temps), un POST rend les lignes créées.
// Les bancs qui répondaient `[]` à toute écriture servaient une autre forme (§6.3) : le
// comparer-et-échanger (src/ligneCas.js, `ecrireReglage`, `push_prefs`) y voyait un refus
// et rejouait jusqu'à abandonner. Le banc n'a pas de base à versions : il rend la ligne visée.
function corpsEcrit(req) {
  const m = req.method();
  const id = (/[?&]id=eq\.([^&]*)/.exec(decodeURIComponent(req.url())) || [])[1];
  if (m === 'PATCH') return JSON.stringify(id ? [{ id }] : []);
  if (m === 'POST') {
    try { const b = JSON.parse(req.postData() || 'null'); return JSON.stringify((Array.isArray(b) ? b : [b]).filter((x) => x && x.id).map((x) => ({ id: x.id }))); } catch (_) { return '[]'; }
  }
  return '[]';
}
module.exports = { corpsEcrit };
