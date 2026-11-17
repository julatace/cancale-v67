// ══════════════════════════════════════════════════════════════════════════
// « IMPRESSION SANS RÉFLÉCHIR » (16 nov., lot impression-directe — mission 6 de la file,
// validée par Julien)
//
// Sur ORDINATEUR, à l'ouverture de VRM et à chaque retour sur l'onglet, quand des bordereaux
// sont prêts, UN bouton bien visible « Imprimer les N ». Son clic lance l'impression du lot
// (le moteur d'« Imprimer (N) » d'À expédier, `imprimerLot`, src/App.jsx) avec le papier et
// les tampons DÉJÀ choisis (`vrm_imprimante`, places gardées) : la visionneuse s'ouvre et
// imprime seule. Jamais de papier choisi ⇒ UNE question la première fois (celle du moteur),
// puis plus jamais. Rien ne s'imprime sans son clic.
// Après : « N imprimés · Annuler » ; les lignes sont marquées imprimées (la règle existante,
// `marquerImprimes`) ; « Annuler » retire CES marques-là, rien d'autre.
// ⚠️ §5 : un N° « à vérifier sur son carton » DEMANDE d'abord (`confirmerNumerosAVerifier`,
//    dans le moteur — ce module ne court-circuite rien).
// ⚠️ Le nombre affiché est celui que Ventes PUBLIE (`vrm_colis_prets.lot`, §11 : le même que
//    « Imprimer (N) ») ; pas su ⇒ aucun bouton (jamais un nombre deviné).
// Module PUR : la bannière (src/ImpressionDirecte.jsx) et `scripts/audit-impression-directe.cjs`.
// ══════════════════════════════════════════════════════════════════════════

// Le nombre à proposer, ou 0 (rien à montrer). `publie` : la ligne `vrm_colis_prets` (ou null).
export function nombreAProposer(publie) {
  const n = publie && typeof publie === 'object' ? publie.lot : null;
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

// Le bouton se montre-t-il ? Ordinateur seulement, un lot publié, pas écarté (« Plus tard »)
// depuis la dernière ouverture / le dernier retour sur l'onglet.
export function proposer({ ordi = false, publie = null, ecarte = false } = {}) {
  return !!ordi && !ecarte && nombreAProposer(publie) > 0;
}

// « Annuler » : retire des marques « imprimé » les SEULES clés de cette impression.
// Rend { carte, change } — la carte d'origine telle quelle si rien ne change.
export function retirerMarques(carte, cles) {
  const c = carte && typeof carte === 'object' ? carte : {};
  const l = (Array.isArray(cles) ? cles : []).map(String).filter((k) => Object.prototype.hasOwnProperty.call(c, k));
  if (!l.length) return { carte: c, change: false };
  const u = { ...c };
  for (const k of l) delete u[k];
  return { carte: u, change: true };
}

// Ce que l'impression a marqué (pour pouvoir l'annuler) : les clés Vinted et retours, les ventes Vestiaire.
// `items` : les éléments du PDF (`res.items` du moteur) ; `reussies` : les clés réellement dans le PDF.
export function marquesDe(items, reussies) {
  const voulu = new Set((Array.isArray(reussies) ? reussies : []).map(String));
  const its = (Array.isArray(items) ? items : []).filter((it) => it && voulu.has(String(it.cle)));
  return {
    n: its.length,
    vinted: its.filter((it) => it.site === 'vinted').map((it) => String(it.cle)),   // comme `marquerImprimes` (retours compris)
    retours: its.filter((it) => it.retour).map((it) => String(it.cle)),
    vc: its.filter((it) => it.site === 'vestiaire' && it.ligne && it.ligne.v && it.ligne.v.id != null).map((it) => String(it.ligne.v.id)),
  };
}
