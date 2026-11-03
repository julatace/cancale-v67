// ── LA RÈGLE « EN LIGNE SUR VINTED », CÔTÉ SERVEUR — COPIE REFABRIQUÉE ──
// ⚠️ NE RIEN MODIFIER ICI À LA MAIN. Les deux blocs ci-dessous sont, texte
//    pour texte, ceux de src/App.jsx (eux-mêmes identiques à background.js).
//    Modifier App.jsx, puis : node scripts/recopie-enligne-serveur.cjs
//    `--verifier` passe au rouge si cette copie diffère.
/* eslint-disable */
// <supprimees-regle> — LA MÊME RÈGLE QUE L'EXTENSION (background.js), §11.
// `capturedAt` est l'heure du RANGEMENT, pas de la lecture : une moisson partie
// avant la suppression et rangée après la ressusciterait — d'où la marge. Une
// annonce supprimée ne revient jamais légitimement (republiée, elle a un NOUVEL
// identifiant) : la marge ne fait que retarder une résurrection qui n'a pas lieu.
const SUPPR_MARGE_MS = 5 * 60 * 1000;
function supprimeeApres(ids, id, capTs) {
  if (!ids || typeof ids !== 'object') return false;          // pas su : on n'écarte rien
  const at = Date.parse(ids[String(id)] || '');
  if (isNaN(at)) return false;
  return !(Number(capTs) >= at + SUPPR_MARGE_MS);             // lecture d'avant, ou sans date : écartée
}
// La date de LECTURE d'un dressing — UNE fonction pour les quatre lecteurs
// (écran Annonces, file Leboncoin de l'app, files LBC/eBay et photos de
// l'extension, §11) : `capturedAt` écrit par l'extension (la colonne `cap`
// d'une projection, ou `data.capturedAt` d'une ligne entière). JAMAIS
// `updated_at`, qui ment (§4.3) — l'écran Annonces y retombait, les autres non :
// la même ligne rendait deux listes (revue de la 5.165). Sans date : `NaN`.
function dateLectureDressing(ligne) {
  const c = ligne && (ligne.cap != null ? ligne.cap : (ligne.data && ligne.data.capturedAt));
  return Date.parse(c || '');
}
// </supprimees-regle>
// <enligne-regle> — LA MÊME RÈGLE DANS L'APP (src/App.jsx) ET DANS L'EXTENSION
// (background.js), §11. `audit-enligne.cjs` exige que les deux blocs soient
// IDENTIQUES et compare leurs sorties sur les mêmes entrées. Il dépend de
// `supprimeeApres` (bloc <supprimees-regle>, juste au-dessus dans les deux).
// Julien, 11 octobre : « quand les annonces ne sont plus en ligne, elles doivent
// être enlevées, automatiquement — je me retrouve avec trois fois la même paire
// alors qu'il n'y a qu'une seule annonce ». Une annonce est EN LIGNE si :
//   · la lecture COMPLÈTE la plus récente de son compte la contient ouverte —
//     son propre dressing (`harvest_{uid}_listings`, quand il est connecté) ou
//     son dressing PUBLIC relu depuis un autre de ses comptes
//     (`harvest_{uid}_enligne`, 5.167) : la plus récente des deux fait foi ;
//   · aucune suppression vue APRÈS cette lecture ne la retire ;
//   · et cette lecture a moins de 24 h. Au-delà (ou jamais lue) on ne SAIT pas :
//     ses annonces ne sont ni « en ligne » ni « disparues » — « à confirmer »,
//     dites à part, jamais comptées (« rien lu ne vaut pas rien », §4.1).
// ⚠️ (2 nov., Julien : « tant que l'extension n'a pas capté depuis le compte où
// l'annonce est, elle ne peut pas ajouter une annonce dans VRM » — le cas
// shop_cancale) Une annonce présente dans la lecture publique mais JAMAIS dans
// le dressing capté connecté n'est PAS ajoutée : elle attend la capture faite
// depuis son compte. Un compte sans aucune capture connectée n'apparaît pas.
// Une annonce ouverte dans un dressing plus ancien et ABSENTE de la lecture
// publique plus récente n'est plus en ligne (supprimée, vendue ou masquée) : elle
// est rendue FERMÉE (`_vrmAbsente`), jamais « vendue » (rien ne le prouve).
// ⚠️ Une annonce que son vendeur voit VENDUE ne se rouvre pas d'un coup d'œil
//    public (la vue publique n'est pas mesurée sur les ventes) : la vente fait foi
//    — et elle RESTE parmi les fermées (revue de la 5.167 : elle disparaissait de
//    toutes les sorties, et avec elle la seule preuve sans ressemblance qu'une
//    paire numérotée est partie).
// ⚠️ Une suppression vue en 2xx ne se « rattrape » pas par une lecture PUBLIQUE
//    qui la montre encore (revue de la 5.167) : Vinted ne réutilise jamais un
//    identifiant, et la vue publique n'est pas mesurée (index, cache en retard ?).
//    Le dressing de son vendeur, lui, reste la mesure qui fait foi (5.165).
// ⚠️⚠️ « PAS SU » LES LECTURES PUBLIQUES (`pub = { passu: true }`, revue de la
//    5.167) : sur un hoquet, les annonces qu'une lecture plus récente savait
//    PARTIES revenaient « en ligne » — la triple paire de sa plainte, sans un mot.
//    Sans les lectures publiques, un dressing ne décide QUE s'il a moins de
//    `ENLIGNE_SUR_MS` : l'extension ne relit jamais en public un compte lu depuis
//    moins de 30 min (`ENLIGNE_DELAI_MS`), donc aucune lecture plus récente ne
//    peut exister. Au-delà, ses annonces sont « à confirmer ».
const ENLIGNE_FRAIS_MS = 24 * 60 * 60 * 1000;
const ENLIGNE_SUR_MS = 30 * 60 * 1000;
function ouverteSurVinted(it) { return !!(it && !it.is_closed && !it.is_hidden && !it.is_draft); }
function venduePourSonVendeur(it) { return !!(it && it.is_closed && /sold/i.test(String(it.item_closing_action || ''))); }
function enLigneDuCompte(liste, pub, suppIds, maintenant) {
  const itemsL = (liste && Array.isArray(liste.items)) ? liste.items : null;
  const capL = itemsL && liste.cap != null && liste.cap !== '' ? Number(liste.cap) : NaN;
  const pubPasSu = !!(pub && pub.passu === true);
  const pubLisible = !pubPasSu && !!(pub && (pub.complet === true || pub.complet === 'true') && Array.isArray(pub.ids));
  const capP = pubLisible && pub.cap != null && pub.cap !== '' ? Number(pub.cap) : NaN;
  const r = { enLigne: [], aConfirmer: [], fermees: [], absentes: [], supprimees: [], lu: NaN, source: '', pubPasSu };
  const cand = [];
  if (isFinite(capP) && !(isFinite(capL) && capL >= capP)) {
    r.source = 'public'; r.lu = capP;
    const parL = new Map(), parP = new Map(), vus = new Set();
    for (const it of itemsL || []) if (it && it.id != null) parL.set(String(it.id), it);
    for (const it of (Array.isArray(pub.items) ? pub.items : [])) if (it && it.id != null) parP.set(String(it.id), it);
    for (const x of pub.ids) {
      const id = String(x == null ? '' : x);
      if (!id || vus.has(id)) continue;
      vus.add(id);
      const l = parL.get(id) || null, p = parP.get(id) || null;
      // ⚠️ (2 nov., Julien) Une lecture PUBLIQUE n'AJOUTE jamais une annonce : elle
      // confirme ou retire ce que SON compte a déjà capté connecté. Une annonce vue
      // seulement en public attend la prochaine capture faite depuis son compte.
      if (!l) continue;
      if (l && venduePourSonVendeur(l)) { r.fermees.push(l); continue; }
      cand.push(Object.assign({}, l || {}, p || {}, { id: (l || p).id, is_closed: false, is_hidden: false, is_draft: false }));
    }
    for (const it of itemsL || []) {
      if (!it || it.id == null || vus.has(String(it.id))) continue;
      if (ouverteSurVinted(it)) r.absentes.push(it); else r.fermees.push(it);
    }
  } else if (isFinite(capL)) {
    r.source = 'dressing'; r.lu = capL;
    for (const it of itemsL) { if (!it) continue; if (ouverteSurVinted(it)) cand.push(it); else r.fermees.push(it); }
  } else if (itemsL) {
    for (const it of itemsL) { if (!it) continue; if (ouverteSurVinted(it)) cand.push(it); else r.fermees.push(it); }
  }
  const garde = [];
  for (const it of cand) { if (supprimeeApres(suppIds, it.id, r.source === 'public' ? -Infinity : r.lu)) r.supprimees.push(it); else garde.push(it); }
  const age = Number(maintenant) - r.lu;
  const sur = !pubPasSu || age < ENLIGNE_SUR_MS;
  if (isFinite(r.lu) && age <= ENLIGNE_FRAIS_MS && sur) r.enLigne = garde; else r.aConfirmer = garde;
  return r;
}
// Les lignes de tous les comptes, telles que les balayages les lisent :
// `lignesL` = `harvest_{uid}_listings` (`select=id,data` ou `data`), `lignesP` =
// `harvest_{uid}_enligne` projetées (`id, cap, complet, ids, items`) — `null` =
// la base n'a pas répondu (« pas su » : chaque compte reçoit `{ passu: true }`) —,
// `supp` = Map uid → suppressions (`null` = pas su). Chaque compte rend UNE ligne au
// format d'un dressing : ses annonces fermées, les absentes rendues fermées, et
// celles qui sont en ligne — jamais celles « à confirmer », rendues à part.
function enLigneDesLignes(lignesL, lignesP, supp, maintenant) {
  const parL = new Map(), parP = new Map();
  for (const r of lignesL || []) {
    const d = r && r.data; if (!d) continue;
    const k = /^harvest_(\d+)_listings$/.exec(String((r && r.id) || ''));
    const uid = k ? k[1] : (d.uid != null ? String(d.uid) : '');
    if (uid) parL.set(uid, r);
  }
  for (const r of lignesP || []) {
    const k = /^harvest_(\d+)_enligne$/.exec(String((r && r.id) || ''));
    if (k) parP.set(k[1], r);
  }
  const lignes = [], aConfirmer = new Map(), parCompte = new Map();
  for (const uid of new Set([...parL.keys(), ...parP.keys()])) {
    const r = parL.get(uid) || null, d = r ? r.data : null, p = d ? d.payload : null;
    const liste = (p && Array.isArray(p.items)) ? { items: p.items, cap: dateLectureDressing(r) } : null;
    const q = parP.get(uid) || null;
    const pub = lignesP === null ? { passu: true } : (q ? { complet: q.complet, ids: q.ids, items: q.items, cap: Date.parse(q.cap || '') } : null);
    const res = enLigneDuCompte(liste, pub, supp ? (supp.get(uid) || null) : null, maintenant);
    parCompte.set(uid, res);
    if (res.aConfirmer.length) aConfirmer.set(uid, res.aConfirmer);
    const items = res.fermees.concat(res.absentes.map((it) => Object.assign({}, it, { is_closed: true, _vrmAbsente: true })), res.enLigne);
    if (!liste && !items.length) continue;
    const data = Object.assign({ type: 'listings' }, d || {}, { uid: (d && d.uid != null) ? d.uid : uid,
      _vrmLu: isFinite(res.lu) ? res.lu : null, _vrmSource: res.source,
      payload: Object.assign({}, p || {}, { items }) });
    lignes.push(Object.assign({}, r || {}, { id: (r && r.id) || `harvest_${uid}_listings`, data }));
  }
  return { lignes, aConfirmer, parCompte };
}
// </enligne-regle>
export { SUPPR_MARGE_MS, supprimeeApres, dateLectureDressing, ENLIGNE_FRAIS_MS, ENLIGNE_SUR_MS, ouverteSurVinted, venduePourSonVendeur, enLigneDuCompte, enLigneDesLignes };
