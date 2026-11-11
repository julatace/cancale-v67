// ── CHACUN COMPOSE SA MA JOURNÉE (11 nov. 2026, lot journee-perso) ──────────
// « Modifier ma journée » (en bas de Ma journée, et Paramètres → Affichage → Ma
// journée) : chaque carte a un interrupteur et une poignée pour la déplacer.
// UN réglage synchronisé par compte (`vrm_journee_perso`, SYNC_KEYS) :
//   { v: 1, ordre: [id…], choix: { [id]: true|false }, at }
// · `choix` ne garde QUE ce qu'il a touché : une carte jamais touchée suit le
//   réglage de départ (Simple / Complet, `caseJourneeMontree`) — la
//   personnalisation s'ajoute par-dessus, elle ne le remplace pas.
// · `ordre` ne range que les cartes connues ; une carte livrée plus tard (absente
//   de `ordre`) apparaît à SA place par défaut, juste après sa voisine d'origine.
// · INTOUCHABLE : une carte qui porte un geste DÛ urgent s'affiche toujours, même
//   masquée (« affichée car urgent », en tête de « À faire ») ; les alertes qui
//   coûtent de l'argent (deux articles sous un N°, colis en retard, dernier jour
//   de retrait, double vente…) et la panne de la base ne sont même pas dans la
//   liste : on ne peut pas les masquer.
// · Une carte masquée garde son compteur publié (Ma journée la rend dans un bloc
//   caché) : les autres écrans et le widget restent justes.
// Aucune règle de calcul ici : ce module ne décide que de l'ORDRE et de la
// VISIBILITÉ. Pur (aucun import de l'app), exécuté par audit-journee-perso.cjs.
import { caseJourneeMontree } from './profilVendeur.js';

export const CLE_JOURNEE_PERSO = 'vrm_journee_perso';

export const ZONES_JOURNEE = [
  { id: 'tete', nom: 'En haut' },
  { id: 'afaire', nom: 'À faire' },
  { id: 'bas', nom: 'En bas' },
];

// Le catalogue, dans l'ORDRE D'ORIGINE (celui de Ma journée v2). `urgent` : la
// carte revient d'elle-même quand elle porte un geste dû urgent.
export const CARTES_JOURNEE = [
  { id: 'phrase', zone: 'tete', nom: 'La phrase du jour', desc: 'Tes colis du jour, en une phrase.' },
  { id: 'prochain', zone: 'tete', nom: 'La prochaine chose à faire', desc: 'Le geste le plus pressé, tout en haut.' },
  { id: 'frise', zone: 'tete', nom: 'Les 7 derniers jours', desc: 'Ce que tu as vendu, jour par jour.' },
  // `fixe` : sa place ne dépend pas de l'ordre (les cases du mois sont toujours posées SOUS la carte
  // sombre, par la grille des widgets) — un interrupteur, pas de poignée qui ne ferait rien.
  { id: 'chiffres', zone: 'tete', nom: 'Les chiffres du mois', desc: 'Bénéfice, vendu, reçu, sous la carte du haut.', fixe: true },
  // (11 nov.) « À trancher » (lot DJ4) : toujours en tête de « À faire », ouverte en place — FIXE.
  { id: 'trancher', zone: 'afaire', nom: 'À trancher', desc: 'Tes doutes à régler, toujours en tête.', fixe: true },
  { id: 'ailleurs', zone: 'afaire', nom: 'Vendus ailleurs', desc: 'Annonces à retirer des autres sites.' },
  { id: 'deux-fois', zone: 'afaire', nom: 'En ligne deux fois', desc: 'La même annonce publiée deux fois.' },
  { id: 'envoyer', zone: 'afaire', nom: 'Colis à envoyer', desc: 'Revient seule si un colis est pressé.', urgent: true },
  { id: 'retirer', zone: 'afaire', nom: 'Colis à retirer', desc: 'Revient seule au dernier jour.', urgent: true },
  { id: 'messages', zone: 'afaire', nom: 'Messages', desc: 'Tes messages pas lus.' },
  { id: 'prix', zone: 'afaire', nom: 'Prix à baisser', desc: 'Un conseil, rien ne part seul.' },
  { id: 'a-relier', zone: 'afaire', nom: 'E-mails à relier', desc: 'Les comptes dont rien n’arrive.' },
  { id: 'stock-sortie', zone: 'afaire', nom: 'Vendus encore rangés', desc: 'À sortir de tes meubles.' },
  // (11 nov., lot pas-en-ligne) seulement s'il y en a (prouvés, src/pasEnLigne.js).
  { id: 'pas-en-ligne', zone: 'afaire', nom: 'Achetés, pas en ligne', desc: 'Sur aucun site depuis plus de X jours.' },
  // (11 nov.) « Supprimés de Vinted » n'est plus une carte : ces articles vivent dans « À trancher » (lot DJ4).
  { id: 'autres', zone: 'afaire', nom: 'Les autres rappels', desc: 'Litiges, achats à relier, inventaire…' },
  { id: 'urssaf', zone: 'afaire', nom: 'Déclaration URSSAF', desc: 'L’échéance qui approche.' },
  { id: 'notifs', zone: 'bas', nom: 'Notifications coupées', desc: 'Quand ce téléphone ne te prévient plus.' },
  { id: 'guide', zone: 'bas', nom: 'Démarrer avec VRM', desc: 'Les étapes qui restent.' },
];
const PAR_ID = new Map(CARTES_JOURNEE.map((c) => [c.id, c]));
export const carteJournee = (id) => PAR_ID.get(id) || null;

// Le réglage d'origine : rien de touché.
export const REGLAGE_ORIGINE = Object.freeze({ v: 1, ordre: [], choix: {} });

// Lecture tolérante (une ligne abîmée ⇒ le réglage d'origine, jamais une erreur).
export function lireJourneePerso(brut) {
  const b = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const ordre = Array.isArray(b.ordre) ? [...new Set(b.ordre.filter((x) => typeof x === 'string' && x))] : [];
  const choix = {};
  if (b.choix && typeof b.choix === 'object') for (const [k, v] of Object.entries(b.choix)) if (typeof v === 'boolean') choix[k] = v;
  return { v: 1, ordre, choix, ...(typeof b.at === 'string' ? { at: b.at } : {}) };
}

export const estOrigine = (r) => { const x = lireJourneePerso(r); return x.ordre.length === 0 && Object.keys(x.choix).length === 0; };

// L'ORDRE EFFECTIF d'une zone. Les cartes rangées par lui d'abord (dans son ordre),
// puis chaque carte qu'il n'a jamais rangée (livrée après son réglage) à SA place
// d'origine : juste après la carte qui la précède dans le catalogue (ou en tête).
export function ordreJournee(zone, reglage) {
  const mobiles = ordreMobile(zone, reglage);
  // Une carte fixe reprend sa place d'origine dans la zone.
  CARTES_JOURNEE.filter((c) => c.zone === zone).forEach((c, i) => { if (c.fixe) mobiles.splice(Math.min(i, mobiles.length), 0, c.id); });
  return mobiles;
}
// L'ordre des seules cartes qui se déplacent (celles qui ont une poignée).
export function ordreMobile(zone, reglage) {
  const r = lireJourneePerso(reglage);
  const cat = CARTES_JOURNEE.filter((c) => c.zone === zone && !c.fixe).map((c) => c.id);
  const out = r.ordre.filter((id) => cat.includes(id));
  cat.forEach((id, i) => {
    if (out.includes(id)) return;
    let k = -1;
    for (let j = i - 1; j >= 0 && k < 0; j--) k = out.indexOf(cat[j]);
    out.splice(k + 1, 0, id);
  });
  return out;
}

// Montrée par défaut (sans son choix) : le réglage de départ Simple / Complet.
export const montreeParDefaut = (id, mode) => caseJourneeMontree(id, mode);

// La visibilité d'une carte : { montree, choisie, force }.
//  · choisie : son interrupteur (son choix s'il l'a touché, sinon le défaut).
//  · force   : masquée par lui MAIS urgente ⇒ montrée quand même (« affichée car urgent »).
export function visibiliteCarte(id, { reglage, mode, urgent = false } = {}) {
  const r = lireJourneePerso(reglage);
  const choisie = typeof r.choix[id] === 'boolean' ? r.choix[id] : montreeParDefaut(id, mode);
  const peutForcer = !!(PAR_ID.get(id) && PAR_ID.get(id).urgent);
  const force = !choisie && peutForcer && !!urgent;
  return { montree: choisie || force, choisie, force };
}

// Les gestes PRESSÉS portés par les cases (la règle de chaque case, publiée par
// Ma journée — aucun recalcul) : « à envoyer » dont un colis est en retard ou à
// sa date limite proche (`alerte`, `presses`), « à retirer » au dernier jour
// (`alerte`), ou une alerte urgente du même geste dans la liste.
export function urgencesJournee({ tuiles = {}, alertes = [] } = {}) {
  const ids = new Set((Array.isArray(alertes) ? alertes : []).map((j) => j && j.id).filter(Boolean));
  const env = tuiles.envoyer || null, ret = tuiles.retirer || null;
  return {
    envoyer: !!(env && env.n > 0 && (env.alerte || (env.presses && env.presses.n > 0))) || ids.has('colis-en-retard') || ids.has('colis-limite'),
    retirer: !!(ret && ret.n > 0 && ret.alerte) || ids.has('retrait-dernier-jour'),
  };
}

// ── LES GESTES DE L'ÉDITEUR (rendent un NOUVEAU réglage, à enregistrer) ──────
const estampille = (r) => ({ ...r, at: new Date().toISOString() });
// L'ordre complet (toutes zones), pour qu'un déplacement fige la zone entière.
const ordreComplet = (r) => ZONES_JOURNEE.flatMap((z) => ordreMobile(z.id, r));

export function basculerCarte(reglage, id, on) {
  const r = lireJourneePerso(reglage);
  if (!PAR_ID.has(id)) return r;
  return estampille({ ...r, choix: { ...r.choix, [id]: !!on } });
}

// Déplace `id` à la position `vers` (index parmi les cartes MOBILES de sa zone, borné).
// Une carte fixe ne se déplace pas.
export function deplacerCarte(reglage, id, vers) {
  const r = lireJourneePerso(reglage);
  const c = PAR_ID.get(id); if (!c || c.fixe) return r;
  const zone = ordreMobile(c.zone, r);
  const de = zone.indexOf(id);
  const a = Math.max(0, Math.min(zone.length - 1, Math.round(Number(vers))));
  if (de < 0 || !Number.isFinite(a) || a === de) return r;
  zone.splice(de, 1); zone.splice(a, 0, id);
  const reste = ordreComplet(r).filter((x) => PAR_ID.get(x).zone !== c.zone);
  return estampille({ ...r, ordre: [...reste, ...zone] });
}

export const revenirOrigine = () => estampille({ ...REGLAGE_ORIGINE, choix: {} });
