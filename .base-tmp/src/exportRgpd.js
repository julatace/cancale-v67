// ═══════════════════════════════════════════════════════════════════════════
// « EXPORTER MES DONNÉES » — LA PARTIE COMPLÈTE, ASSEMBLÉE (12 nov., RGPD)
// ═══════════════════════════════════════════════════════════════════════════
// Le SERVEUR décide de ce qui part (api/_lib/export-rgpd.js : toutes ses lignes,
// sans secrets ni PDF lourds) et le rend page par page (`suite`). Ici on ne fait
// que coller les morceaux d'un même fichier, dans l'ordre — rien n'est ajouté,
// rien n'est retiré. Une page ratée ⇒ `{ ok:false }` : jamais un export qui
// aurait l'air complet sans l'être (« rien lu » ≠ « rien »).
// ═══════════════════════════════════════════════════════════════════════════
export const PAGES_MAX = 4000;

export async function toutesMesDonnees({ entetes = () => ({}), fetcher = (u, o) => fetch(u, o), surPage = null, pagesMax = PAGES_MAX } = {}) {
  const fichiers = new Map();
  let suite = '', pages = 0;
  for (;;) {
    if (pages >= pagesMax) return { ok: false, raison: 'trop-de-pages' };
    let j = null;
    try {
      const r = await fetcher(`/api/compte?mode=mes-donnees${suite ? `&suite=${encodeURIComponent(suite)}` : ''}`, { headers: entetes(), cache: 'no-store' });
      j = r.ok ? await r.json() : null;
    } catch (_) { j = null; }
    if (!j || j.ok !== true || !Array.isArray(j.morceaux)) return { ok: false, raison: 'page', pages };
    for (const m of j.morceaux) {
      if (!m || typeof m.nom !== 'string' || typeof m.texte !== 'string') return { ok: false, raison: 'forme', pages };
      fichiers.set(m.nom, (fichiers.get(m.nom) || '') + m.texte);
    }
    pages++;
    if (surPage) { try { surPage(pages, j.etape || ''); } catch (_) {} }
    if (j.fini === true) break;
    if (typeof j.suite !== 'string' || !j.suite || j.suite === suite) return { ok: false, raison: 'suite', pages };
    suite = j.suite;
  }
  return { ok: true, pages, fichiers: [...fichiers].map(([nom, texte]) => ({ nom, texte })) };
}
