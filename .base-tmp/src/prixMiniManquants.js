// ════════════════════════════════════════════════════════════════════════════
//  « PRIX MINI MANQUANTS » (11 nov., lot prix-mini) — règle PURE
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Prix mini manquants — et le visuel doit être amélioré. »
//
// Les annonces EN LIGNE dont l'acceptation automatique ne peut pas trancher : leur
// « Accepter dès » (le prix mini posé à côté du N°, `fiche.min`) n'est pas lu par
// le moteur (absent, ou écrit d'une façon que l'extension ne lit pas). Pour chacune :
// photo, N°, prix actuel, prix d'achat RELIÉ (la règle de l'app, `prixAchatDe`,
// calculée par l'appelant : fiche.buyPrice, sinon l'achat relié à SON N° — une
// identité, jamais une ressemblance) et les frais SAISIS sur la fiche (`coutsVente` :
// Vinted ne prend aucune commission au vendeur, src/fraisPlateformes.js).
//
// ⛔ Jamais un prix mini deviné ni proposé (CLAUDE.md §3 : « prix conseillé à la
//    mise en ligne » refusé le 11 oct.) : ce module ne rend AUCUN montant que le
//    vendeur n'a pas tapé. Le bénéfice affiché est celui de SON chiffre.
// Trois états (§5) : `undefined` en cours · `null` pas su · valeur lue. Un prix
// d'achat inconnu ⇒ bénéfice `null` (« — » et la raison), jamais 0.
// Exécuté par scripts/audit-prix-mini-manquants.cjs (avec ses mutations).
// ════════════════════════════════════════════════════════════════════════════
import { seuilMoteur, seuilEcran, montantSeuil } from './offresSures.js';
import { coutsVente } from './beneficePaire.js';

const cts = (x) => Math.round(Number(x) * 100);

// Les lignes « sans prix mini ». `annonces` : les annonces EN LIGNE (forme de
// `annSelectionnables` : { id, uid, etat, numero, titre, prix, photo, verif:{achat} }) ;
// pas lues (pas un tableau) ⇒ `null` (pas su — jamais « aucune »).
// `virgule` : l'extension lit « 45,5 » (5.342+) ; sinon un mini à virgule n'est pas lu.
export function lignesManquantes({ annonces, numeros, virgule = false } = {}) {
  if (!Array.isArray(annonces)) return null;
  const out = [];
  const vus = new Set();
  for (const a of annonces) {
    if (!a || a.id == null) continue;
    if (a.etat != null && a.etat !== 'en-ligne') continue;       // une annonce pas en ligne ne reçoit aucune offre
    const id = String(a.id);
    if (vus.has(id)) continue; vus.add(id);
    const f = (numeros || {})[id] || {};
    if (seuilMoteur(f.min, virgule) != null) continue;           // le moteur le lit : rien ne manque
    const prix = Number(a.prix) > 0 ? Number(a.prix) : null;
    const achatBrut = a.verif ? a.verif.achat : a.achat;
    const achat = achatBrut != null && Number.isFinite(Number(achatBrut)) && Number(achatBrut) >= 0 ? Number(achatBrut) : null;
    const c = coutsVente(f);
    out.push({
      id, uid: String(a.uid || ''), numero: String(a.numero || f.numero || ''), titre: String(a.titre || ''),
      photo: typeof a.photo === 'string' ? a.photo : (a.photo && a.photo.url) || '', prix, achat,
      frais: c.valid ? c.cents / 100 : null,                      // frais saisis illisibles ⇒ pas su
      illisible: seuilEcran(f.min) != null,                       // un mini existe, mais le moteur ne le lit pas
      refuse: seuilMoteur(f.refuse, virgule),
    });
  }
  // Le plus d'argent en jeu d'abord ; prix pas lu en dernier ; puis le N°.
  out.sort((x, y) => (y.prix == null ? -1 : y.prix) - (x.prix == null ? -1 : x.prix) || String(x.numero).localeCompare(String(y.numero), 'fr', { numeric: true }));
  return out;
}

// Une saisie : '' ⇒ { vide } ; « 45,5 € » ⇒ { valeur: 45.5 } ; illisible ou ≤ 0 ⇒ { erreur }.
export function lireSaisie(v) {
  const brut = v == null ? '' : String(v).trim();
  if (!brut) return { vide: true, valeur: null, erreur: null };
  if (!/^\d{1,6}(?:[.,]\d{0,2})?\s*€?$/.test(brut.replace(/\s/g, ''))) return { vide: false, valeur: null, erreur: 'illisible' };
  const n = seuilEcran(brut);
  if (n == null) return { vide: false, valeur: null, erreur: 'illisible' };
  return { vide: false, valeur: Math.round(n * 100) / 100, erreur: null };
}

// L'aperçu d'UNE ligne pour la saisie tapée : le bénéfice à ce prix mini (mini −
// achat − frais saisis), le garde-fou « sous ton coût » (achat + frais), et « au
// prix ou plus » (une offre est toujours sous le prix : ce mini n'accepterait rien).
export function apercuLigne(l, saisie) {
  const s = lireSaisie(saisie);
  const r = { ...s, benefice: null, cout: null, sousCout: false, auPrix: false, raison: '' };
  if (!l) return r;
  if (l.achat != null && l.frais != null) r.cout = (cts(l.achat) + cts(l.frais)) / 100;
  if (s.valeur == null) return r;
  if (l.achat == null) r.raison = 'achat';
  else if (l.frais == null) r.raison = 'frais';
  else {
    r.benefice = (cts(s.valeur) - cts(l.achat) - cts(l.frais)) / 100;
    r.sousCout = cts(s.valeur) < cts(l.achat) + cts(l.frais);
  }
  if (l.prix != null && cts(s.valeur) >= cts(l.prix)) r.auPrix = true;
  return r;
}

// Le bilan de la série : ce qui sera écrit (SES saisies lisibles seulement), ce qui
// est sous le coût (le garde-fou, dit avant d'écrire), les saisies illisibles.
export function bilanSerie(lignes, saisies) {
  const ecrire = [], sous = [], erreurs = [], auPrix = [];
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const a = apercuLigne(l, (saisies || {})[l.id]);
    if (a.erreur) { erreurs.push(l.id); continue; }
    if (a.valeur == null) continue;
    ecrire.push({ id: l.id, min: montantSeuil(String(a.valeur)) });
    if (a.sousCout) sous.push({ id: l.id, numero: l.numero, titre: l.titre, valeur: a.valeur, cout: a.cout });
    if (a.auPrix) auPrix.push(l.id);
  }
  return { ecrire, sous, erreurs, auPrix };
}

// La carte de Ma journée : SEULEMENT si l'acceptation auto est ALLUMÉE (`true`, pas
// « pas su ») et que les annonces ont été lues et qu'il en manque. Sinon rien.
export function carteJournee({ actif, lignes } = {}) {
  if (actif !== true || !Array.isArray(lignes) || !lignes.length) return null;
  return { n: lignes.length, photos: lignes.map((l) => l.photo).filter((p) => typeof p === 'string' && /^(https:|data:image\/)/.test(p)).slice(0, 4) };
}
