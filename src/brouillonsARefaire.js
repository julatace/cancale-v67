// ── « BROUILLONS À REFAIRE » : CE QUI N'EST PLUS SUR VINTED SORT DE LA LISTE (19 nov.) ──
// Julien, 19 novembre : « "brouillons à refaire" : il y en a qui ne sont même plus dans
// Vinted, je ne comprends pas pourquoi ils sont encore là, c'est un bug horrible. »
//
// Mesuré sur la base (lecture seule) : 6 lignes « à publier » (un brouillon rangé sur Vinted
// par VRM du 28 oct. au 1er nov., jamais mis en ligne par VRM). AUCUN de ces brouillons n'est
// dans le dressing relu aujourd'hui ; pour 3, VRM a même la PREUVE de leur suppression sur
// Vinted (`harvest_{uid}_supprimees`, par l'identifiant) ; pour 2 autres, le dressing de leur
// compte a été relu EN ENTIER (56 sur 56) sans eux. Ils restaient parce que la liste ne
// sortait une ligne que si son brouillon était vu EN LIGNE : elle ne lisait ni les
// suppressions prouvées ni les lectures complètes du dressing.
//
// LA RÈGLE (par l'identifiant du brouillon, `draftId` — jamais le titre, §5) :
//   · 'en-ligne'        : le brouillon est dans les annonces présentes (ou un autre brouillon de la
//                         même ancienne annonce a été publié) — réglé, comme avant ;
//   · 'supprime'        : sa suppression sur Vinted est PROUVÉE (réponse 2xx vue par l'extension) ;
//   · 'plus-sur-vinted' : une lecture COMPLÈTE du dressing de SON compte, plus récente que la
//                         dernière nouvelle de ce brouillon, ne le montre plus ;
//   · 'present'         : le dressing le montre encore (brouillon) ;
//   · 'passu'           : rien ne le prouve (dressing pas relu, relu en partie, suppressions pas
//                         lues) — il RESTE dans la liste et c'est dit (« pas su » ne vaut pas « parti »).
// Une ligne SANS brouillon (le brouillon n'a jamais été créé : « à refaire », passage interrompu)
// n'a rien à vérifier sur Vinted : c'est la copie gardée par VRM qui se refait — 'sans-brouillon'.
// Rien n'est supprimé : le coffre garde tout ; la liste dit combien sont sortis.
// Module PUR : `scripts/audit-brouillons-a-refaire.cjs` l'exécute.
export const MARGE_REFAIRE_MS = 5 * 60 * 1000;   // la marge de la règle des suppressions

const fini = (v) => typeof v === 'number' && isFinite(v);

// x   : { uid, draftId, at (ms : la dernière nouvelle de ce passage), ancienId }
// ctx : { presentes: Set (annonces présentes, par id), publieParAncien: Set (anciennes annonces dont un
//         brouillon a été publié), brouillonsVus: Set|null (brouillons que le dressing montre ; null = pas lu),
//         lectures: { [uid]: { lu, complet } } | null, supprimees: Map(uid → { [id]: iso }) | null (pas su) }
export function jugerARefaire(x, ctx = {}) {
  const draft = x && x.draftId != null ? String(x.draftId) : '';
  const uid = x && x.uid != null ? String(x.uid) : '';
  const P = ctx.presentes instanceof Set ? ctx.presentes : new Set();
  const A = ctx.publieParAncien instanceof Set ? ctx.publieParAncien : new Set();
  if ((draft && P.has(draft)) || (x && x.ancienId != null && A.has(String(x.ancienId)))) return 'en-ligne';
  if (!draft) return 'sans-brouillon';
  const S = ctx.supprimees && typeof ctx.supprimees.get === 'function' ? ctx.supprimees.get(uid) : null;
  if (S && typeof S === 'object' && S[draft] != null) return 'supprime';
  if (ctx.brouillonsVus instanceof Set && ctx.brouillonsVus.has(draft)) return 'present';
  const L = uid && ctx.lectures && typeof ctx.lectures === 'object' ? ctx.lectures[uid] : null;
  if (L && L.complet === true && fini(L.lu) && ctx.brouillonsVus instanceof Set && fini(x.at) && L.lu >= x.at + MARGE_REFAIRE_MS) return 'plus-sur-vinted';
  return 'passu';
}

// Partage les lignes : celles qui RESTENT (avec `passu` quand rien ne prouve leur présence) et celles
// qui sortent (`enLigne`, `disparus` avec leur raison). L'ordre est gardé.
export function trierARefaire(lignes, ctx = {}) {
  const restent = [], enLigne = [], disparus = [];
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (!l) continue;
    const j = jugerARefaire({ uid: l.uid, draftId: l.draftId, at: l.at, ancienId: l.id }, ctx);
    if (j === 'en-ligne') enLigne.push(l);
    else if (j === 'supprime' || j === 'plus-sur-vinted') disparus.push({ ...l, raison: j });
    else restent.push({ ...l, passu: j === 'passu' });
  }
  return { restent, enLigne, disparus };
}
