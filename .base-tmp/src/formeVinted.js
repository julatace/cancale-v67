// ═══════════════════════════════════════════════════════════════════════════
// « VINTED A CHANGÉ SA PAGE DES VENTES » (11 nov., ext. 5.357 — validé par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// L'extension compare la FORME de chaque réponse Vinted qu'elle range (noms de
// champs et types, jamais une valeur) à la forme connue. Une forme inattendue sur
// un champ dont dépend une règle (prix `{amount}`, `status_title`,
// `transaction_user_status`, `item_id`, `is_hidden`…) ⇒ elle n'écrit RIEN (la
// bonne lecture d'avant reste) et range la forme vue dans
// `harvest_{uid}_forme_inconnue` (`formes: { [type]: { page, champ, attendu, vu,
// forme[], vuLe, depuis, n } }`). Ici, la règle PURE de ce que l'app en dit : une
// ligne ambre par page touchée, dite UNE fois (même page sur deux comptes = une
// ligne). Aucune lecture ici : src/AlerteFormeVinted.jsx lit et rend.
// Trois états : `undefined` on lit · `null` pas su (rien affirmé) · liste.
// ═══════════════════════════════════════════════════════════════════════════

export const FILTRE_FORMES = 'id=like.harvest_*_forme_inconnue';
export const SELECT_FORMES = 'id,f:data->formes';
// Une forme vue il y a plus de 3 jours et jamais revue : Vinted ne l'envoie plus
// (sinon l'extension la reverrait à chaque passage) — on ne crie plus.
export const FORME_FRAICHE_MS = 3 * 86400000;

// Le nom de la page, avec le bon pronom (« ne la lit plus » / « ne le lit plus »).
const PAGES = {
  ventes: { nom: 'sa page des ventes', pron: 'la' },
  achats: { nom: 'sa page des achats', pron: 'la' },
  annonces: { nom: 'sa page des annonces', pron: 'la' },
  messagerie: { nom: 'sa messagerie', pron: 'la' },
  profil: { nom: 'sa page du profil', pron: 'la' },
  'porte-monnaie': { nom: 'son porte-monnaie', pron: 'le' },
};
const ligneOk = (id) => /^harvest_\d{1,20}_forme_inconnue$/.test(String(id || ''));

export function texteForme(page) {
  const p = PAGES[page];
  return p ? `Vinted a changé ${p.nom} : VRM ne ${p.pron} lit plus, on corrige` : null;
}

// rows : les lignes projetées (`SELECT_FORMES`). Rend [{ page, texte, depuis, cle }].
export function alertesForme(rows, maintenant = Date.now()) {
  if (!Array.isArray(rows)) return null;
  const parPage = new Map();
  for (const r of rows) {
    if (!r || !ligneOk(r.id) || !r.f || typeof r.f !== 'object' || Array.isArray(r.f)) continue;
    for (const k of Object.keys(r.f)) {
      const e = r.f[k];
      if (!e || typeof e !== 'object') continue;
      const texte = texteForme(e.page);
      if (!texte) continue;
      const vu = Date.parse(e.vuLe || '');
      if (!Number.isFinite(vu) || maintenant - vu > FORME_FRAICHE_MS || vu > maintenant + 3600000) continue;
      const depuis = Date.parse(e.depuis || '') || vu;
      const avant = parPage.get(e.page);
      if (!avant || depuis < avant.depuis) parPage.set(e.page, { page: e.page, texte, depuis, cle: `${e.page}|${String(e.champ || '')}|${String(e.vu || '')}` });
    }
  }
  return [...parPage.values()].sort((a, b) => a.depuis - b.depuis);
}
