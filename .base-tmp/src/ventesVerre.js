// ════════════════════════════════════════════════════════════════════════════
//  VENTES · « VERRE DÉPOLI » — LES RÈGLES PURES DE LA REFONTE (15 nov.)
//  Julien a validé les maquettes (« tout est parfait ») : À expédier · En route ·
//  la fiche d'une vente · l'ordinateur. Ce module ne CALCULE rien de neuf : il
//  range, en mots et en étapes, ce que l'app sait déjà (les mêmes preuves, les
//  mêmes listes). Exécuté par scripts/audit-ventes-verre.cjs.
//
//   · `cochesEffectives` : les colis cochés pour l'impression en lot. « Tous
//     cochés par défaut » (choix de Julien) = la règle du lot (`cochesParDefaut`,
//     src/lotSelection.js) : chaque colis dont le bordereau est là et pas encore
//     imprimé. Décocher garde un colis ; le bouton imprime ce qui est coché.
//   · `emplacementDe` : la place d'une paire dans le Stock, lue PAR SON N°
//     (`ouDansMeubles`, identité `cleNum`, jamais le titre — §5). Pas rangée ⇒ null.
//   · `etapesRoute` : les quatre étapes d'un colis parti (Déposé · En transit ·
//     Livré · Validé), cochées seulement sur PREUVE (les `lues` de la liste des
//     envoyés) ; une étape plus loin prouvée coche celles d'avant.
//   · `etapesFicheVente` : les six étapes de la fiche (Vendue · Bordereau prêt ·
//     À déposer · En route · Livrée · Versement), de la frise de la vente
//     (`friseVente`, src/recapVente.js) — rien de deviné.
// ════════════════════════════════════════════════════════════════════════════
import { cochesParDefaut } from './lotSelection.js';

// La sélection affichée : `choix` = null tant qu'il n'a rien touché (la règle du lot), sinon SON jeu de clés.
// Une clé qui n'est plus dans le lot (le colis est parti) ne compte plus.
export function cochesEffectives(L, choix) {
  const lignes = (L || []).filter(Boolean);
  if (!choix) return cochesParDefaut(lignes);
  const dispo = new Set(lignes.filter((l) => l.cochable !== false).map((l) => l.cle));
  return new Set([...choix].filter((c) => dispo.has(c)));
}
// Cocher / décocher une ligne : rend le NOUVEAU jeu (jamais muté). Une ligne non cochable (eBay) ne bouge pas.
export function basculerCoche(L, choix, cle) {
  const l = (L || []).find((x) => x && x.cle === cle);
  const s = new Set(cochesEffectives(L, choix));
  if (!l || l.cochable === false) return s;
  if (s.has(cle)) s.delete(cle); else s.add(cle);
  return s;
}
// La sélection vaut-elle celle d'office ? (alors on imprime « d'office », le PDF préparé d'avance sert tel quel)
export function memeQueDefaut(L, coches) {
  const d = cochesParDefaut((L || []).filter(Boolean));
  if (!coches || coches.size !== d.size) return !coches;
  for (const c of coches) if (!d.has(c)) return false;
  return true;
}

// La place d'une paire : `ou` = le résultat de `ouDansMeubles` ({ meuble, rangee, colonne }) ou null.
// Rend { nom, rangee, colonne } (les mots se posent par tr()), ou null : jamais une place devinée.
export function emplacementDe(ou) {
  if (!ou || !ou.meuble || !Number.isFinite(ou.rangee) || !Number.isFinite(ou.colonne)) return null;
  const nom = String(ou.meuble.name || '').trim();
  return { nom: nom || null, rangee: ou.rangee, colonne: ou.colonne };
}

// Les quatre étapes d'un colis parti. `lues` : { depose, enroute, livre, valide } (booléens PROUVÉS).
export const ETAPES_ROUTE = ['depose', 'transit', 'livre', 'valide'];
export function etapesRoute(lues = {}) {
  const l = [!!lues.depose, !!lues.enroute, !!lues.livre, !!lues.valide];
  const derniere = l.lastIndexOf(true);
  return ETAPES_ROUTE.map((cle, i) => ({ cle, fait: i <= derniere && derniere >= 0, ici: i === derniere }));
}

// Les six étapes de la fiche d'une vente, depuis la frise (`friseVente` : vendue · bordereau · deposee · livree · argent).
// Faites sur PREUVE seulement (une étape plus loin prouvée coche celles d'avant, la règle de la frise). L'étape
// ATTENDUE (`ici`) est la première pas faite ; elle est un GESTE (`geste`, ambre) seulement pour « À déposer ».
// Frise absente (vente annulée, retour : hors parcours) ⇒ null.
export const ETAPES_FICHE = ['vendue', 'bordereau', 'adeposer', 'enroute', 'livree', 'versement'];
export function etapesFicheVente(frise) {
  if (!Array.isArray(frise) || !frise.length) return null;
  const f = Object.fromEntries(frise.map((e) => [e.cle, e]));
  const fait = (k) => !!(f[k] && f[k].fait);
  const brut = [fait('vendue'), fait('bordereau'), fait('deposee'), fait('deposee'), fait('livree'), fait('argent')];
  const derniere = brut.lastIndexOf(true);
  const faits = brut.map((x, i) => x || i < derniere);
  const iIci = faits.indexOf(false);
  return ETAPES_FICHE.map((cle, i) => ({ cle, fait: faits[i], ici: i === iIci, geste: i === iIci && cle === 'adeposer' }));
}

// Les cinq étapes d'un RETOUR (achat à renvoyer) : Retour accepté · Bordereau prêt · À déposer · En route · Remboursé.
// `etape` = celle de src/retoursAchat.js (PROUVÉE : remboursement lu, fait du transporteur lu, sinon SON clic « Déposé »).
export const ETAPES_RETOUR = ['accepte', 'bordereau', 'adeposer', 'enroute', 'rembourse'];
const RANG_RETOUR = { 'a-deposer': 2, depose: 3, 'en-route': 4, 'recu-vendeur': 4, rembourse: 5 };
export function etapesRetour(c) {
  if (!c || RANG_RETOUR[c.etape] == null) return null;
  const r = RANG_RETOUR[c.etape];
  const faits = ETAPES_RETOUR.map((k, i) => (k === 'bordereau' ? !!c.pdf || r > 2 : i < r));
  const iIci = faits.indexOf(false);
  return ETAPES_RETOUR.map((cle, i) => ({ cle, fait: faits[i], ici: i === iIci, geste: i === iIci && cle === 'adeposer' }));
}

// ── (19 nov., Ventes « comme avant ») LA RECHERCHE DE LA LISTE (À envoyer, En route) — reprise de la liste du 17 nov. :
// le N° (« 124 », « n°124 », « B188 »), le titre, la taille, l'acheteur, le compte, le transporteur, le n° de suivi — sans
// accents ni casse. Une rangée est montrée si elle CONTIENT le texte tapé : jamais un rapprochement (§5), rien n'est relié.
const sansAccents = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function cleRecherche(q) { return sansAccents(q).replace(/^n°\s*/, '').trim(); }
export function contientRecherche(cle, { num = '', textes = [] } = {}) {
  if (!cle) return true;
  const n = String(num == null ? '' : num).trim();
  return sansAccents([n ? 'n°' + n + ' ' + n : '', ...(textes || []).filter(Boolean)].join(' ')).includes(cle);
}
