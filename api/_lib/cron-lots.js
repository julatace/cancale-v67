// ═══════════════════════════════════════════════════════════════════════════
// LE CRON PAR LOTS (7 nov., audit « 1 000 vendeurs »)
// ═══════════════════════════════════════════════════════════════════════════
// Le cron du matin et celui du soir passent TOUS les vendeurs en une exécution.
// Une fonction Vercel est coupée net à sa durée maximale : avant, (1) les
// tâches globales placées APRÈS la boucle (purges, e-mails de l'essai, veille
// des plantages) ne tournaient jamais un jour de grosse charge, et (2) c'était
// toujours les MÊMES derniers vendeurs qui sautaient (ordre fixe).
// Ici :
//   · un BUDGET de temps : passé `budgetMs` depuis le début, plus aucun vendeur
//     ne COMMENCE (ceux en cours finissent) — la marge avant la coupure sert à
//     les finir et à ranger le curseur ;
//   · un CURSEUR `cron_curseur_{moment}_{jour}` (propriétaire NEUTRE) : les
//     vendeurs faits ce jour-là. Relancé le même jour, le cron ne refait pas
//     un vendeur fait (aucun doublon) ; le lendemain, ceux que la veille n'a
//     pas atteints passent EN PREMIER ;
//   · un ORDRE QUI TOURNE chaque jour (empreinte du jour et du vendeur) : jamais
//     les mêmes en dernier.
// « Pas su » : un curseur du jour illisible ⇒ tout le monde passe (les mémos de
// chaque rappel évitent les doublons) et RIEN n'est écrit (une écriture
// construite sur une lecture ratée effacerait les vendeurs déjà faits).
// Tenu par scripts/audit-cron-lots.cjs (EXÉCUTE le vrai cron, 50 vendeurs lents).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

// La durée maximale d'une fonction (plan Hobby, Fluid : 300 s) et la marge
// gardée pour finir les vendeurs en cours et ranger le curseur.
export const DUREE_MAX_MS = 300000;
export const MARGE_MS = 60000;
export const BUDGET_VENDEURS_MS = DUREE_MAX_MS - MARGE_MS;
// Le curseur est rangé tous les `SAUVER_TOUS` vendeurs faits (une coupure nette
// ne perd au plus que ceux-là), puis à la fin.
export const SAUVER_TOUS = 50;
// Les curseurs d'il y a `GARDER_JOURS` jours s'effacent (une ligne par moment et par jour).
export const GARDER_JOURS = 3;
// (11 nov., lot « limites-client ») LE TEMPS D'UN VENDEUR EST BORNÉ. Julien :
// « un client qui a 5 000 annonces ne doit pas ralentir l'app pour les autres ».
// Un vendeur énorme (ou une base qui peine sur SES lignes) gardait sa place
// jusqu'au bout : la fonction pouvait être coupée net à 300 s AVANT d'écrire le
// curseur — les petits, déjà servis, n'étaient notés nulle part. Passé
// `TEMPS_VENDEUR_MS`, on n'attend plus ce vendeur : il est REPORTÉ (jamais noté
// « fait »), sa place passe au suivant, et il est repris au passage suivant
// (relance du jour, ou le lendemain en premier). Ses propres mémos évitent tout
// doublon de rappel. Réglable par `VRM_CRON_VENDEUR_MS`.
export const TEMPS_VENDEUR_MS = 60000;

export const idCurseur = (moment, jour) => `cron_curseur_${moment}_${jour}`;
export const jourAvant = (jour, n) => new Date(Date.parse(jour + 'T12:00:00Z') - n * 86400000).toISOString().slice(0, 10);

// L'ordre du jour : une empreinte de (jour, vendeur) — il change chaque jour,
// reste le même toute la journée (une relance du cron garde l'ordre).
export function ordreDuJour(owners, jour) {
  const cle = (o) => crypto.createHash('sha256').update(`${jour}|${o}`).digest('hex');
  return [...new Set((owners || []).map(String))].map((o) => [cle(o), o]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x[1]);
}

const REPORTE = Symbol('reporte');
const liste = (c) => (c && Array.isArray(c.faits) ? c.faits.map(String) : []);

// Qui passe, et dans quel ordre. `curseurJour` / `curseurVeille` : objet,
// `null` (aucun) ou `undefined` (pas su).
export function planDuPassage({ owners, jour, curseurJour, curseurVeille }) {
  const ordre = ordreDuJour(owners, jour);
  const tous = new Set(ordre);
  const deja = new Set(liste(curseurJour).filter((o) => tous.has(o)));
  // Les vendeurs que la veille n'a pas atteints (son curseur n'est pas « complet ») d'abord.
  const veilleIncomplete = curseurVeille && typeof curseurVeille === 'object' && curseurVeille.complet !== true;
  const faitsVeille = new Set(liste(curseurVeille));
  const restants = ordre.filter((o) => !deja.has(o));
  const prioritaires = veilleIncomplete ? restants.filter((o) => !faitsVeille.has(o)) : [];
  const p = new Set(prioritaires);
  return { aFaire: [...prioritaires, ...restants.filter((o) => !p.has(o))], deja, prioritaires: prioritaires.length };
}

// Le passage. `traiter(owner)` rend le bilan d'un vendeur (une exception est
// comptée en échec, le suivant passe). `lireCurseur(id)` rend objet · null ·
// undefined ; `ecrireCurseur(id, data)` rend vrai si la base a confirmé ;
// `retirerCurseur(id)` (facultatif) efface un vieux curseur.
export async function passerVendeurs({ owners, traiter, moment, jour, lireCurseur, ecrireCurseur, retirerCurseur, debut = Date.now(), budgetMs = BUDGET_VENDEURS_MS, parallele = 8, maintenant = () => Date.now(), tempsVendeurMs = TEMPS_VENDEUR_MS }) {
  const id = idCurseur(moment, jour);
  const [curseurJour, curseurVeille] = await Promise.all([lireCurseur(id), lireCurseur(idCurseur(moment, jourAvant(jour, 1)))]);
  const { aFaire, deja, prioritaires } = planDuPassage({ owners, jour, curseurJour, curseurVeille });
  const peutEcrire = curseurJour !== undefined;      // « pas su » : on n'écrit rien
  const faits = [...deja];
  const enEchec = [];
  const bilans = [];
  let echecs = 0, suivant = 0, budgetAtteint = false, depuisSauve = 0, derniereOk = null;
  const reportes = [];
  // Le travail d'un vendeur, borné : au-delà, `{ reporte: true }` (le travail
  // lancé n'est pas annulé — il finit seul, idempotent — mais on ne l'attend plus).
  const borne = (o) => {
    let minuteur = null;
    const travail = Promise.resolve().then(() => traiter(o, { tempsMs: tempsVendeurMs }));
    travail.catch(() => {});   // un vendeur reporté qui plante plus tard ne fait rien tomber
    if (!(tempsVendeurMs > 0) || !Number.isFinite(tempsVendeurMs)) return travail;
    const delai = new Promise((ok) => { minuteur = setTimeout(() => ok(REPORTE), tempsVendeurMs); });
    return Promise.race([travail, delai]).finally(() => clearTimeout(minuteur));
  };
  // Les écritures du curseur passent l'une après l'autre (jamais une vieille
  // liste écrite après une plus récente) ; seule la DERNIÈRE dit l'état final.
  let chaine = Promise.resolve();
  const sauver = (complet) => {
    if (!peutEcrire) return chaine;
    const data = { moment, jour, faits: [...faits], complet, total: owners.length, at: new Date(maintenant()).toISOString() };
    chaine = chaine.then(() => ecrireCurseur(id, data)).then((ok) => { derniereOk = ok === true; }, () => { derniereOk = false; });
    return chaine;
  };
  const ouvrier = async () => {
    while (suivant < aFaire.length) {
      if (maintenant() - debut >= budgetMs) { budgetAtteint = true; return; }
      const o = aFaire[suivant++];
      // ⚠️ (11 nov., robustesse) SEUL UN VENDEUR RÉUSSI EST « FAIT ». Un vendeur
      //    en échec entrait dans le curseur du jour et n'était plus retenté : ses
      //    rappels « à expédier » perdus pour la journée. Il reste à faire (relance
      //    du même jour, ou en tête le lendemain : le curseur n'est pas « complet »).
      // (11 nov., limites-client) Et un vendeur trop long est REPORTÉ (pas fait non plus).
      const t0 = maintenant();
      let r, reussi = false;
      try { r = await borne(o); }
      catch (e) { echecs++; bilans.push({ owner: o, erreur: String((e && e.message) || e).slice(0, 200), ms: maintenant() - t0 }); enEchec.push(o); continue; }
      if (r === REPORTE) { reportes.push(o); bilans.push({ owner: o, reporte: true, raison: 'temps-vendeur', ms: maintenant() - t0 }); continue; }
      bilans.push({ owner: o, ...r, ms: maintenant() - t0 }); reussi = true;
      if (reussi) faits.push(o);
      // Rangé et ATTENDU (une coupure nette ne perd plus les vendeurs faits depuis le dernier rangement).
      if (++depuisSauve >= SAUVER_TOUS) { depuisSauve = 0; await sauver(false); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallele, aFaire.length)) }, ouvrier));
  const restants = aFaire.length - (faits.length - deja.size);   // les vendeurs en échec en font partie
  await sauver(restants === 0);
  if (peutEcrire && retirerCurseur) { try { await retirerCurseur(idCurseur(moment, jourAvant(jour, GARDER_JOURS))); } catch (_) { /* un vieux curseur oublié ne gêne rien */ } }
  return {
    bilans, echecs, enEchec, traites: faits.length - deja.size, dejaFaits: deja.size, restants, prioritaires, budgetAtteint, reportes: reportes.length,
    curseur: !peutEcrire ? 'pas-su' : derniereOk === true ? 'ecrit' : 'non-ecrit',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// (11 nov., H14 de la revue serveur) UN SEUL PASSAGE À LA FOIS : LE BAIL
// ═══════════════════════════════════════════════════════════════════════════
// Deux appels simultanés du même moment (le cron Vercel ET le workflow GitHub,
// ou un rejeu à la main) lisaient le même curseur et traitaient les mêmes
// vendeurs : doubles notifications, doubles e-mails là où un mémo manquait.
// Une LIGNE-VERROU `cron_bail_{moment}` (propriétaire NEUTRE) écrite par
// comparer-et-échanger (`modifierNeutre`, sur `data.rev`) : le premier passage
// la prend pour `BAIL_MS` ; un second qui la trouve tenue et pas échue ne fait
// RIEN (il le dit). Un passage coupé net (durée maximale) ne la rend pas : elle
// expire seule. Fini, il la rend (seulement si elle porte encore SON jeton).
// « Pas su » (base muette) : le passage se fait comme avant (les mémos de chaque
// rappel et le curseur du jour évitent les doublons), et la réponse le dit.
// Aucune migration : une ligne d'app_data. Tenu par scripts/audit-serveur-migrations.cjs.
export const BAIL_MS = DUREE_MAX_MS + 30000;
export const idBail = (moment) => `cron_bail_${String(moment || 'matin').replace(/[^a-z0-9_]/gi, '_')}`;
export function deciderBail(d, { jeton, maintenant, dureeMs = BAIL_MS }) {
  const tenu = d && typeof d.jeton === 'string' && d.jeton !== '' && d.jeton !== jeton && Number(d.jusqua) > maintenant;
  if (tenu) return { valeur: { pris: false, jusqua: Number(d.jusqua) } };
  return { data: { jeton, depuis: maintenant, jusqua: maintenant + dureeMs }, valeur: { pris: true } };
}
export function deciderRendre(d, { jeton, maintenant }) {
  if (!d || d.jeton !== jeton) return { valeur: false };   // échu et repris par un autre : on n'y touche pas
  return { data: { jeton: null, jusqua: 0, rendu: maintenant }, valeur: true };
}
// `modifier(id, decider)` : `modifierNeutre` (rend { valeur } ou null = pas su).
// Rend { pris:true } · { pris:false, jusqua } · { pris:null } (pas su).
export async function prendreBail({ moment, jeton, modifier, maintenant = Date.now(), dureeMs = BAIL_MS }) {
  let r = null;
  try { r = await modifier(idBail(moment), (d) => deciderBail(d, { jeton, maintenant, dureeMs })); } catch (_) { r = null; }
  return r && r.valeur ? r.valeur : { pris: null };
}
export async function rendreBail({ moment, jeton, modifier, maintenant = Date.now() }) {
  try { const r = await modifier(idBail(moment), (d) => deciderRendre(d, { jeton, maintenant })); return !!(r && r.valeur); } catch (_) { return false; }
}
