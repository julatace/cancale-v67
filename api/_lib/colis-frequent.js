// ═══════════════════════════════════════════════════════════════════════════
// LE PASSAGE « COLIS » FRÉQUENT (9 nov., retraits frais)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (9 nov., capture de Colis → À retirer) : « Le statut de la disponibilité
// des colis doit être regardé très souvent ; on ne doit pas avoir un colis s'il a
// été retiré. »
// MESURÉ dans le code avant ce changement : le statut chez le transporteur n'était
// relu que (1) quand l'app est ouverte (une demande toutes les 5 min, le serveur
// relit un colis « disponible » toutes les 30 min) et (2) par le cron du MATIN
// (5 h UTC) et du SOIR (18 h UTC). App fermée, un colis retiré à 10 h restait
// « à retirer » jusqu'à 19 h — dans le widget, la cloche et le rappel.
// Ici : GitHub appelle `api/ship-reminders.js?moment=colis` toutes les 15 min de
// 6 h à 23 h (.github/workflows/colis-frais.yml, le plan Vercel gratuit ne lance
// qu'un cron par jour). Le passage :
//   · lit d'ABORD, en une ou deux requêtes PROJETÉES (`select=owner`, jamais
//     `data` — §4.4), les vendeurs qui ont une ligne DUE : un `transp_` encore
//     actif (au point relais, en route) dont le dernier essai est plus vieux que
//     son rythme (`RYTHME_MS`, api/_lib/transporteurs.js), ou un e-mail
//     « disponible » arrivé depuis moins d'un jour (sa première lecture) ;
//   · ne visite QUE ceux-là (aucun vendeur sans colis actif ne coûte une lecture),
//     dans un ordre qui tourne à chaque quart d'heure, bornés en temps ;
//   · pour chacun, le passage habituel (`passageTransporteurs`, ses garde-fous :
//     une requête à la fois par transporteur, 1,5 s d'écart, pause sur refus,
//     User-Agent honnête), en plus petit (6 lectures, 2 départs, 15 s).
// « Pas su » : une requête de sélection qui échoue ⇒ AUCUN vendeur visité et la
// route répond 503 (le job GitHub échoue, visible) — jamais « rien à faire ».
// Tenu par scripts/audit-colis-frequent.cjs (exécute la vraie route sur une
// fausse base PostgREST).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { RYTHME_MS } from './transporteurs.js';

export const PREMIERE_LECTURE_MS = 24 * 3600000;   // un e-mail « disponible » de moins d'un jour
export const MARGE_RYTHME_MS = 60000;              // un passage qui tombe 30 s trop tôt ne rate pas la ligne
export const MAX_VENDEURS_PASSAGE = 200;
export const BUDGET_PASSAGE_MS = 100000;           // le job GitHub attend 150 s
export const PARALLELE = 4;
// Ce que chaque vendeur reçoit (plus petit que le cron du matin : 12 lectures, 20 s).
export const MAX_LECTURES_VENDEUR = 6;
export const MAX_DEPARTS_VENDEUR = 2;
export const BUDGET_VENDEUR_MS = 15000;

const iso = (ms) => new Date(ms).toISOString();
// Les requêtes de sélection (projetées sur `owner`, filtrées par la base sur `meta`).
export function requetesColisDus(maintenant = Date.now()) {
  const pasFini = 'or=(meta->>fini.is.null,meta->>fini.eq.false)';
  const avant = (ms) => encodeURIComponent(iso(maintenant - ms + MARGE_RYTHME_MS));
  return [
    `app_data?id=like.transp_*&meta->>etat=eq.disponible&${pasFini}&meta->>essai=lt.${avant(RYTHME_MS.disponible)}&select=owner`,
    `app_data?id=like.transp_*&meta->>etat=eq.en_route&${pasFini}&meta->>essai=lt.${avant(RYTHME_MS.en_route)}&select=owner`,
    `app_data?id=like.email_track_*&meta->>status=eq.available&meta->>arriveLe=gte.${encodeURIComponent(iso(maintenant - PREMIERE_LECTURE_MS))}&select=owner`,
  ];
}
// Les vendeurs à visiter : l'union des réponses ; `null` si UNE requête n'a pas répondu.
export function vendeursDus(reponses, { exclus = [] } = {}) {
  if (!Array.isArray(reponses) || reponses.some((r) => !Array.isArray(r))) return null;
  const non = new Set(exclus.map(String));
  const s = new Set();
  for (const rows of reponses) for (const r of rows) { const o = r && r.owner ? String(r.owner) : ''; if (o && !non.has(o)) s.add(o); }
  return [...s];
}
// L'ordre du quart d'heure : une empreinte (créneau, vendeur) — il tourne à chaque passage.
export function ordreDuCreneau(owners, maintenant = Date.now()) {
  const creneau = Math.floor(maintenant / (15 * 60000));
  const cle = (o) => crypto.createHash('sha256').update(`${creneau}|${o}`).digest('hex');
  return [...new Set(owners || [])].map((o) => [cle(o), o]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x[1]);
}
// Le passage. `lire(chemin)` rend un tableau ou null ; `traiter(owner)` rend le bilan d'un vendeur.
export async function passageColisFrequent({ lire, traiter, exclus = [], maintenant = Date.now(), budgetMs = BUDGET_PASSAGE_MS, parallele = PARALLELE, max = MAX_VENDEURS_PASSAGE, horloge = () => Date.now() }) {
  const debut = horloge();
  const reponses = await Promise.all(requetesColisDus(maintenant).map((q) => Promise.resolve().then(() => lire(q)).catch(() => null)));
  const owners = vendeursDus(reponses, { exclus });
  if (owners === null) return { fait: false, raison: 'pas-su' };
  const aFaire = ordreDuCreneau(owners, maintenant).slice(0, max);
  const bilans = []; let suivant = 0, echecs = 0, budgetAtteint = false;
  const ouvrier = async () => {
    while (suivant < aFaire.length) {
      if (horloge() - debut >= budgetMs) { budgetAtteint = true; return; }
      const o = aFaire[suivant++];
      try { bilans.push({ owner: o, ...((await traiter(o)) || {}) }); }
      catch (e) { echecs++; bilans.push({ owner: o, erreur: String((e && e.message) || e).slice(0, 160) }); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallele, aFaire.length)) }, ouvrier));
  return { fait: true, dus: owners.length, traites: bilans.length, restants: owners.length - bilans.length, echecs, budgetAtteint, bilans };
}

// ═══════════════════════════════════════════════════════════════════════════
// (9 nov. au soir, « transporteurs parfaits ») LES ÉTIQUETTES PAS ENCORE LUES
// Julien : « Ce n'est pas possible d'avoir "transporteur inconnu" sachant que tu
// as les bordereaux en ta possession. » Au même passage de 15 min, APRÈS les
// statuts : les vendeurs dont la ligne `vrm_bord_transporteurs` dit qu'il RESTE
// des étiquettes à lire (`pdfReste` ≠ 0, posé par chaque passe — scalaire ⇒
// `meta`, lu en `select=owner` : jamais `data`, §4.4). Chacun : la passe des
// étiquettes (api/_lib/transporteur-anciens.js, UN PDF par requête), bornée en
// nombre et en temps. Un vendeur jamais passé (aucune marque) l'est au cron du
// matin ou à l'ouverture de l'app (POST /api/relais?mode=etiquettes).
// Sélection pas lue ⇒ personne visité, dit (`fait: false`) — jamais « rien à lire ».
// ═══════════════════════════════════════════════════════════════════════════
export const REQ_ETIQUETTES_DUES = 'app_data?id=eq.vrm_bord_transporteurs&meta->>pdfReste=neq.0&select=owner';
export const MAX_PDF_VENDEUR_FREQUENT = 40;
export const BUDGET_ETIQUETTES_MS = 25000;
export async function passageEtiquettes({ lire, traiter, exclus = [], maintenant = Date.now(), budgetMs = BUDGET_ETIQUETTES_MS, horloge = () => Date.now() }) {
  const debut = horloge();
  let rows = null;
  try { rows = await lire(REQ_ETIQUETTES_DUES); } catch (_) { rows = null; }
  const owners = vendeursDus([rows], { exclus });
  if (owners === null) return { fait: false, raison: 'pas-su' };
  const aFaire = ordreDuCreneau(owners, maintenant);
  let traites = 0, lus = 0, ranges = 0, vus = 0, restants = 0, echecs = 0, budgetAtteint = false;
  for (const o of aFaire) {
    const reste = budgetMs - (horloge() - debut);
    if (reste < 3000) { budgetAtteint = true; break; }
    try {
      const r = (await traiter(o, { budgetMs: reste - 1000 })) || {};
      traites++; lus += Number(r.lus) || 0; ranges += Number(r.ranges) || 0; vus += Number(r.vus) || 0; restants += Number(r.restants) || 0;
      if (!r.fait) echecs++;
    } catch (_) { echecs++; }
  }
  return { fait: true, dus: owners.length, traites, lus, ranges, vus, restants, echecs, budgetAtteint };
}
