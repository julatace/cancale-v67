// ── « TON BILAN EN UNE MINUTE » (14 nov., accueil des nouveaux, n° 132) ──────────
// Julien : dès que VRM a lu Vinted (ou sa plateforme) une première fois, un écran animé
// montre l'activité — ventes de l'année, chiffre d'affaires, colis en cours, paires en
// ligne —, puis « voici ce que VRM fera pour toi chaque matin ».
//
// ⚠️ AUCUN CHIFFRE N'EST CALCULÉ ICI (§5, une règle par notion, un propriétaire) :
//   · ventes et chiffre d'affaires de l'année = VENDU (`ventesFaites`, toutes plateformes,
//     date de vente) que la coque publie dans `liveStats.venduLignes`, sommé par SA règle
//     `bilanLignes` (injectée : la même que « Vendu aujourd'hui » et la carte de Ventes) ;
//   · à expédier = `aExpedierPourCarte(vrm_colis_aposter)` (le widget, la carte du logo) ;
//   · à retirer = `vrm_colis_retirer.total` (le badge d'Achats, le widget) ;
//   · en ligne = `widget_stats.online` tel que la coque le publie (`widgetBase`).
// Trois états partout (§5) : `undefined` en cours · `null` pas su (« — ») · valeur lue.
// Un total partiel se dit « au moins », avec SA raison en une ligne (source pas lue,
// vente au montant illisible, import du passé en cours) — jamais présenté complet.
//
// UNE FOIS par compte VRM (`vrm_bilan_minute`, SYNC_KEYS : vu sur un appareil, vu
// partout), jamais chez un vendeur installé (seulement après un parcours d'arrivée
// commencé), jamais en mode exemple ; passable ; rejouable (Paramètres → Aide).
// JS pur : `scripts/audit-accueil-nouveaux.cjs` l'exécute.

export const CLE_BILAN_MINUTE = 'vrm_bilan_minute';

const nombreOk = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

// `vendu` : { lignes, pasSu, enAttente, manque, nonCompteesAnnee } (la coque, liveStats).
// `somme(lignes, depuisTs, jusquaTs)` : la règle VENDU de la coque (`bilanLignes`).
export function ventesAnnee(vendu, somme, { maintenant = Date.now(), importEnCours = false } = {}) {
  const annee = new Date(maintenant).getFullYear();
  if (!vendu || typeof vendu !== 'object') return { etat: 'encours', annee };
  if (vendu.pasSu) return { etat: 'passu', annee, n: null, eur: null };
  if (!Array.isArray(vendu.lignes) || typeof somme !== 'function') return { etat: 'encours', annee };
  const debut = new Date(annee, 0, 1, 0, 0, 0, 0).getTime();
  const r = somme(vendu.lignes, debut, null);
  if (!r || !nombreOk(r.n) || !nombreOk(r.eur)) return { etat: 'passu', annee, n: null, eur: null };
  const raisons = [];
  if (Array.isArray(vendu.manque) && vendu.manque.length) raisons.push({ k: 'manque', noms: vendu.manque.slice(0, 3) });
  if (vendu.enAttente) raisons.push({ k: 'attente' });
  if (nombreOk(vendu.nonCompteesAnnee) && vendu.nonCompteesAnnee > 0) raisons.push({ k: 'montant', n: vendu.nonCompteesAnnee });
  if (importEnCours) raisons.push({ k: 'import' });
  return { etat: 'lu', annee, n: r.n, eur: r.eur, auMoins: raisons.length > 0, raisons };
}

// La série mois par mois de l'année (chiffre d'affaires VENDU, `liveStats.caParMois`
// { 'AAAA-MM': € }) jusqu'au mois en cours — pour la courbe. Rien de lu ⇒ null.
export function serieAnnee(caParMois, maintenant = Date.now()) {
  if (!caParMois || typeof caParMois !== 'object') return null;
  const d = new Date(maintenant), a = d.getFullYear(), m = d.getMonth();
  const out = [];
  for (let i = 0; i <= m; i++) { const v = Number(caParMois[`${a}-${String(i + 1).padStart(2, '0')}`]); out.push(Number.isFinite(v) && v > 0 ? v : 0); }
  return out.some((v) => v > 0) ? out : null;
}

// `aExpedier` : le résultat de `aExpedierPourCarte` ({ n, auMoins }) ; `retirer` : la ligne
// `vrm_colis_retirer` publiée. Pas publié ⇒ `null` (« — »), jamais 0.
export function colisEnCours(aExpedier, retirer) {
  const ex = aExpedier && nombreOk(aExpedier.n) ? { n: aExpedier.n, auMoins: !!aExpedier.auMoins } : { n: null, auMoins: false };
  const re = retirer && typeof retirer === 'object' && nombreOk(Number(retirer.total)) && retirer.total !== null
    ? { n: Math.round(Number(retirer.total)), auMoins: Number(retirer.enVerification) > 0 } : { n: null, auMoins: false };
  return { aExpedier: ex, aRetirer: re };
}

// `base` : `widgetBase` de la coque ({ online, onlinePasSu }) ; `undefined` = pas encore calculé.
export function pairesEnLigne(base) {
  if (base === undefined) return { etat: 'encours', n: null };
  if (!base || typeof base !== 'object') return { etat: 'encours', n: null };
  if (nombreOk(base.online)) return { etat: 'lu', n: base.online };
  return { etat: 'passu', n: null, raison: base.onlinePasSu || null };
}

// L'import du passé (`lireImportDepart`) : un compte pas fini ⇒ l'année est « au moins ».
export function importEnCours(etats) {
  if (!etats || typeof etats !== 'object') return false;
  return Object.values(etats).some((l) => l && l.etat && l.etat !== 'fini');
}

// Le bilan entier (ce que l'écran montre), à partir des publications.
export function bilanMinute({ vendu, somme, caParMois, aExpedier, retirer, enLigne, imports, maintenant = Date.now() } = {}) {
  const imp = importEnCours(imports);
  return {
    ventes: ventesAnnee(vendu, somme, { maintenant, importEnCours: imp }),
    serie: serieAnnee(caParMois, maintenant),
    colis: colisEnCours(aExpedier, retirer),
    enLigne: pairesEnLigne(enLigne),
    importEnCours: imp,
  };
}

// ── QUAND LE MONTRER ────────────────────────────────────────────────────────
// `marqueur` : `vrm_bilan_minute` ; `parcours` : la position rangée (`lireParcours`) ;
// `luUneFois` : la plateforme du parcours a été lue (la coque le constate) ;
// `retenu` : une autre feuille est devant (Bienvenue, configuration, parcours, visite).
export function lireMarqueurBilan(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : null;
  return o && typeof o.vu === 'string' && o.vu ? { vu: o.vu, fin: typeof o.fin === 'string' ? o.fin : null } : null;
}
export function doitMontrerBilan({ pret, exemple, retenu, marqueur, parcours, luUneFois } = {}) {
  if (!pret || exemple || retenu) return false;
  if (lireMarqueurBilan(marqueur)) return false;
  if (!parcours) return false;                     // jamais commencé : un vendeur installé
  return !!(parcours.fini || luUneFois === true);
}
export const marqueurBilan = (fin = 'vu', at = new Date().toISOString()) => ({ vu: at, fin });
