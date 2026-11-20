// ════════════════════════════════════════════════════════════════════════════
//  VENTES — LE FOND DE L'ÉCRAN « VRM NATIF » (19 nov. 2026, docs/design/NATIF.md §4)
//  Julien : « la mise en page est catastrophique, revois absolument tout » — mais le CONTENU de Ventes qu'il aimait
//  reste : À envoyer · En route · Toutes avec leurs nombres, les cases cochées d'office, la plaque N°, la date limite,
//  la place dans le stock, le prix, le transporteur, « Imprimer N bordereaux », En route avec ses étapes prouvées.
//
//  Ce module PUR range ce que l'écran d'avant savait déjà en RANGÉES (des objets, aucun JSX, aucun texte traduit) :
//  l'écran natif (src/natif/ecrans/Ventes.jsx) les dessine, src/App.jsx (Comptabilite) les remplit avec SES règles
//  (`aExpedier`, `echeanceCourteColis`, `avantDemainColis`, `lignesLotTous`, `preuvesFriseDe`, `ouDansMeubles`…).
//  AUCUNE règle neuve ici — seulement des gardes qui tiennent les règles de CLAUDE.md §5 au moment de ranger :
//   · une date limite ESTIMÉE n'est jamais « en retard », ne dit jamais « avant le » ni « dans N j » ;
//   · « pas su » ne vaut pas « oui » : un bordereau absent n'est jamais coché, une place absente n'est jamais devinée ;
//   · la sélection du lot est celle de src/ventesVerre.js (`cochesEffectives`), le compte du plein celui de `resumeLot`.
//  Exécuté par scripts/audit-ventes-modele.cjs (mutations comprises).
// ════════════════════════════════════════════════════════════════════════════
import { etapesRoute, contientRecherche, cleRecherche } from '../ventesVerre.js';

const str = (v) => String(v == null ? '' : v).trim();

// L'ÉTAT DU BORDEREAU d'un colis à envoyer : 'imprime' (déjà imprimé, à déposer) · 'pret' (le PDF est là) ·
// 'attente' (pas encore reçu) ; `null` pour un site dont VRM n'imprime pas le bordereau ici (eBay, Leboncoin, Vestiaire).
export function etatBordereau({ pdf = false, imprime = false, autreSite = false } = {}) {
  if (autreSite) return null;
  return imprime ? 'imprime' : pdf ? 'pret' : 'attente';
}

// L'ÉCHÉANCE D'UNE RANGÉE. `ec` = le résultat de `echeanceCourteColis` ({ code, texte, ecart }) ou null ;
// `estimee` : la limite n'est PAS lue (vente + 7 j, un plancher) ; `presse` : la règle `avantDemainColis`.
// Rend null (pas de limite : rien n'est écrit) ou { sorte: 'lue' | 'estimee', code, texte, dans, ambre } :
//   · lue + code 'date'      ⇒ « avant le {texte} », `dans` = le nombre de jours quand il dépasse 1 ;
//   · estimée + code 'date'  ⇒ « vers le {texte} », jamais de `dans` ;
//   · estimée ⇒ jamais 'retard' (§5 : une estimation dépassée est « à vérifier », code 'estimee-depassee') ;
//   · l'ambre est celui de la règle (`presse`), jamais posé sur une estimée dépassée.
export function echeanceRangee(ec, { estimee = false, presse = false } = {}) {
  if (!ec || !ec.code) return null;
  let code = ec.code;
  if (estimee && code === 'retard') code = 'estimee-depassee';
  const date = code === 'date';
  return {
    sorte: estimee ? 'estimee' : 'lue',
    code,
    texte: str(ec.texte),
    dans: date && !estimee && Number.isFinite(ec.ecart) && ec.ecart > 1 ? ec.ecart : null,
    ambre: !!presse && code !== 'estimee-depassee',
  };
}

// LA CASE d'un colis (l'impression en lot). `ligne` = SA ligne du lot (`lignesLotTous`) ou rien ; `coches` = le jeu
// effectif (`cochesEffectives`). Sans bordereau, ou ligne non cochable (eBay) : la case est grisée, JAMAIS cochée.
export function caseDeRangee(ligne, coches) {
  const possible = !!(ligne && ligne.cochable !== false && ligne.pdf !== false);
  return { possible, on: possible && !!(coches && coches.has(ligne.cle)), cle: ligne ? ligne.cle : null };
}

// LA PLACE dans le Stock : `e` = `emplacementDe(ouDansMeubles(num))` ({ nom, rangee, colonne }) ou null. Jamais devinée.
export function placeDeRangee(e) {
  if (!e || !Number.isFinite(e.rangee) || !Number.isFinite(e.colonne)) return null;
  return { nom: str(e.nom) || null, rangee: e.rangee, colonne: e.colonne };
}

// LA DATE DE VENTE d'une rangée (ms) : la première valeur LUE qui se date ; rien ⇒ null (« — », jamais devinée).
export function tempsVente(...cands) {
  for (const c of cands.flat()) {
    if (c == null || c === '') continue;
    const n = typeof c === 'number' ? c : Date.parse(String(c));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

// (20 nov., Ventes en tableau) L'ÉTIQUETTE D'ÉTAT d'une rangée — lue sur ce que la rangée porte déjà, aucune règle neuve :
// une rangée « À envoyer » ⇒ 'envoyer' ; « En route » ⇒ la dernière étape PROUVÉE (`etapesRoute`) : validée ⇒ 'terminee',
// livrée ⇒ 'livree', sinon 'route'. Jamais « à déposer » (décision « 4 oui » : le départ est constaté par le suivi).
export function statutRangee(r) {
  if (!r) return null;
  if (!Array.isArray(r.etapes)) return 'envoyer';
  const ici = r.etapes.find((e) => e && e.ici);
  return ici && ici.cle === 'valide' ? 'terminee' : ici && ici.cle === 'livre' ? 'livree' : 'route';
}

// UNE RANGÉE « À ENVOYER ». `f` = les faits lus par l'écran (aucun n'est calculé ici).
export function rangeeEnvoyer(f = {}) {
  const autreSite = !!f.autreSite;
  return {
    cle: str(f.cle), site: str(f.site) || 'vinted', tx: str(f.tx), compte: str(f.compte), acheteur: str(f.acheteur),
    num: str(f.num), numDouble: !!f.numDouble, numAttendu: !str(f.num) && !autreSite,
    titre: str(f.titre), taille: str(f.taille), photo: typeof f.photo === 'string' && f.photo ? f.photo : null,
    prix: str(f.prix), transporteur: str(f.transporteur), transporteurCle: str(f.transporteurCle), t: tempsVente(f.t),
    achat: f.achat || null,   // (20 nov.) { relie, prix, ouvrir } : la colonne « Achat » (Relier), lue par l'écran ; null hors Vinted
    bordereau: etatBordereau({ pdf: !!f.pdf, imprime: !!f.imprime, autreSite }),
    coche: caseDeRangee(f.ligneLot || null, f.coches || null),
    echeance: echeanceRangee(f.echeance || null, { estimee: !!f.limiteEstimee, presse: !!f.presse }),
    place: placeDeRangee(f.place || null),
    vendueIlYa: Number.isFinite(f.attente) ? f.attente : null,
    depose: !!f.depose,
    notes: (f.notes || []).filter((n) => n && n.cle && str(n.texte)),   // ambre : N° de l'e-mail ≠ N° de la vente, imprimé sans N°…
    fiche: f.fiche || null,     // les `data-fl-*` de la rangée (src/ficheLigne.js) : l'identité qui ouvre SA fiche
    detail: f.detail || null,   // ce que le détail montre (vendu, pour toi, étapes…) — rempli par l'écran
    gestes: f.gestes || {},
  };
}

// UNE RANGÉE « EN ROUTE » : le colis parti et ses QUATRE étapes, cochées sur preuve (`lues`, src/ventesVerre.js).
export function rangeeRoute(f = {}) {
  return {
    cle: str(f.cle), site: str(f.site) || 'vinted', tx: str(f.tx), compte: str(f.compte), acheteur: str(f.acheteur),
    num: str(f.num), titre: str(f.titre), taille: str(f.taille), photo: typeof f.photo === 'string' && f.photo ? f.photo : null,
    prix: str(f.prix), pourToi: !!f.pourToi && !!str(f.prix),
    etapes: etapesRoute(f.lues || {}),
    etat: { texte: str(f.etat), ambre: !!f.etatAmbre },
    transporteur: str(f.transporteur), transporteurCle: str(f.transporteurCle), t: tempsVente(f.t), achat: f.achat || null, suivi: str(f.suivi), lienSuivi: str(f.lienSuivi),
    fiche: f.fiche || null, detail: f.detail || null, gestes: f.gestes || {},
  };
}

// L'ÉCART NOMMÉ sous le grand chiffre (« 6 cochés pour l'impression · 15 sans bordereau · 3 imprimés, à déposer ») :
// compté sur les RANGÉES (les colis du nombre publié) ; `coches` = ce qui part (`resumeLot(...).partent`).
export function ecartNomme(rangs, coches) {
  let sans = 0, imprimes = 0;
  for (const r of rangs || []) { if (!r) continue; if (r.bordereau === 'attente') sans++; else if (r.bordereau === 'imprime') imprimes++; }
  return { coches: Number.isFinite(coches) && coches > 0 ? coches : 0, sans, imprimes };
}

// LA RECHERCHE : les rangées qui CONTIENNENT le texte tapé (N°, titre, taille, acheteur, compte, transporteur, suivi).
export function filtrerRangs(rangs, q) {
  const cle = cleRecherche(q);
  if (!cle) return rangs || [];
  return (rangs || []).filter((r) => contientRecherche(cle, { num: r.num, textes: [r.titre, r.taille, r.acheteur, r.compte, r.transporteur, r.suivi, r.etat && r.etat.texte] }));
}

// LE DÉTAIL À L'ORDINATEUR : la rangée choisie si elle est encore dans la liste, sinon AUCUNE (l'état vide dessiné de la
// coque) — jamais une autre vente montrée à la place de celle qu'il a touchée.
export function rangChoisi(rangs, cle) {
  const c = str(cle);
  return c ? ((rangs || []).find((r) => r && r.cle === c) || null) : null;
}

// LE PLEIN « Imprimer N bordereaux » : N = les ventes cochées qui partent (`nC`) + les retours cochés (`nR`) ;
// rien de coché ⇒ indisponible AVEC sa raison (`raison`), jamais un bouton mort.
export function pleinImprimer({ nC = 0, nR = 0, occupe = false, total = 0 } = {}) {
  const n = Math.max(0, nC) + Math.max(0, nR);
  return { n, nVentes: Math.max(0, nC), nRetours: Math.max(0, nR), occupe: !!occupe, dispo: n > 0 && !occupe,
    raison: n > 0 ? '' : total > 0 ? 'rien-coche' : 'aucun-bordereau' };
}
