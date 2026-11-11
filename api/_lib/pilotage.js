// ═══════════════════════════════════════════════════════════════════════════
// LE TABLEAU DE BORD DU PROPRIÉTAIRE (9 nov.) — `/api/compte?mode=pilotage`
// ═══════════════════════════════════════════════════════════════════════════
// Julien, propriétaire de VRM, veut piloter son entreprise : combien de vendeurs,
// combien reviennent, combien paient, ce que ça rapporte, ce qui casse, ce qu'ils
// en pensent. PAS une 13ᵉ fonction : un mode de `api/compte.js`.
//
// QUI : le PROPRIÉTAIRE de l'installation seul — la même garde que les alertes
// de plantage (`proprietaireInstallation` : `VRM_OWNER_UID`, sinon
// `vrm_reglages.proprietaire`). Le jeton est VÉRIFIÉ par Supabase AVANT
// (`vendeurExige`) ; la clé de service n'est utilisée qu'APRÈS la garde. Un autre
// compte ⇒ 403 et rien n'est lu ; propriétaire pas su ⇒ 503.
//
// AUCUNE DONNÉE PERSONNELLE D'UN VENDEUR NE SORT : des comptes et des totaux.
// La liste des comptes Supabase est lue pour COMPTER (date de création, dernière
// connexion) — ni e-mail, ni identifiant ne quittent cette fonction. Les mots
// de la note de satisfaction sortent sans propriétaire, sans heure, et une
// adresse ou un numéro tapés dedans sont masqués (src/satisfaction.js).
// Le propriétaire lui-même et le propriétaire NEUTRE ne comptent nulle part.
//
// TROIS ÉTATS, BLOC PAR BLOC (CLAUDE.md §5) : chaque bloc est la valeur lue, ou
// `null` avec sa raison dans `raisons` (« pas su ») — jamais 0 à la place.
// Les revenus mensuels récurrents viennent de STRIPE seul (l'argent) : clé pas
// posée ⇒ `revenus.etat = 'stripe-absent'` et l'écran dit « — Stripe pas
// branché » ; Stripe muet ⇒ 'pas-su'. Une autre devise que l'euro est écartée et
// comptée (jamais convertie, §3 International).
//
// L'HISTORIQUE (courbes 90 jours) :
//   · inscriptions : la VRAIE histoire, refaite depuis la date de création des comptes ;
//   · actifs 7 j et abonnés : un point par jour, noté dans la ligne
//     `pilotage_historique` du propriétaire à chaque ouverture du tableau et par
//     le cron du matin (`noterPilotageDuJour`) — la courbe commence au premier
//     point noté et l'écran dit depuis quand. Comparer-et-échanger sur `data.rev` ;
//     une lecture ratée n'écrit RIEN ; une valeur pas sue reste `null`.
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { ordreStable } from './ordre-stable.js';   // (11 nov.) chaque page Range porte un tri total
import { proprietaireInstallation } from './signalement.js';
import { listerPlantagesTerrain } from './alertes-plantages.js';
import { stripeApi as stripeApiReel, stripePret, stripeModeTest } from './stripe.js';
import { agregerNotes, ID_SATISFACTION } from '../../src/satisfaction.js';
import { jourParis } from '../../src/mesuresTerrain.js';

export const NEUTRE = '00000000-0000-0000-0000-000000000000';
export const ID_HISTORIQUE = 'pilotage_historique';
export const ID_VU = 'vrm_vu';
export const ID_STATUT = 'statut_sondes';
export const JOURS_COURBE = 90;
const PAGE = 1000;
const PAGES_MAX = 50;
const PAGES_STRIPE = 20;
const JOUR_MS = 864e5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUTS_PAYES = new Set(['active', 'past_due']);

const cfg = (env) => ({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: env.SUPABASE_SERVICE_KEY || '' });
const ms = (x) => { const t = typeof x === 'number' ? x : Date.parse(String(x || '')); return Number.isFinite(t) ? t : null; };
const objet = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

// Une lecture REST paginée par `Range` (Supabase plafonne à 1 000 lignes sans le
// dire). `null` = pas su (statut, réseau, page illisible, au début OU au milieu).
async function lireTout(env, fetcher, chemin) {
  const { url, service } = cfg(env);
  const out = [];
  for (let p = 0; p < PAGES_MAX; p++) {
    let r;
    try { r = await fetcher(`${url}/rest/v1/${ordreStable(chemin)}`, { headers: { ...sbCle(service), 'Range-Unit': 'items', Range: `${p * PAGE}-${p * PAGE + PAGE - 1}` } }); } catch (_) { return null; }
    if (!r || !r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return null;
    out.push(...j);
    if (j.length < PAGE) return out;
  }
  return null;   // plus de 50 000 lignes : on ne prétend pas avoir tout lu
}

// Les comptes VRM (Supabase Auth, clé de service). Ne garde QUE ce qui sert à
// compter : { id, cree, connecte }. `null` = pas su.
async function lireComptes(env, fetcher) {
  const { url, service } = cfg(env);
  const out = [];
  for (let p = 1; p <= PAGES_MAX; p++) {
    let r;
    try { r = await fetcher(`${url}/auth/v1/admin/users?page=${p}&per_page=${PAGE}`, { headers: sbCle(service) }); } catch (_) { return null; }
    if (!r || !r.ok) return null;
    const j = await r.json().catch(() => null);
    const users = j && Array.isArray(j.users) ? j.users : null;
    if (!users) return null;
    for (const u of users) if (u && UUID.test(String(u.id || ''))) out.push({ id: String(u.id).toLowerCase(), cree: ms(u.created_at), connecte: ms(u.last_sign_in_at) });
    if (users.length < PAGE) return out;
  }
  return null;
}

// ── STRIPE : revenus mensuels récurrents, abonnés par plan, désabonnements ───
// `subs` : tous les abonnements (status=all), paginés. `null` = pas su.
async function lireAbonnementsStripe(stripeApi) {
  const subs = [];
  let apres = null;
  for (let p = 0; p < PAGES_STRIPE; p++) {
    const r = await stripeApi('GET', 'subscriptions', { status: 'all', limit: 100, ...(apres ? { starting_after: apres } : {}) });
    if (!r || !r.ok || !r.data || !Array.isArray(r.data.data)) return null;
    subs.push(...r.data.data);
    if (!r.data.has_more || !r.data.data.length) return subs;
    apres = r.data.data[r.data.data.length - 1].id;
  }
  return null;
}
const MOIS_PAR_INTERVALLE = { month: 1, year: 12, week: 12 / 52, day: 12 / 365 };
// Le montant MENSUEL d'un article d'abonnement, en centimes ; `null` si illisible.
export function mensuelArticle(it) {
  const price = objet(it && it.price);
  const rec = objet(price.recurring);
  const unite = Number(price.unit_amount);
  const q = Number.isFinite(Number(it && it.quantity)) ? Number(it.quantity) : 1;
  const parMois = MOIS_PAR_INTERVALLE[rec.interval];
  const n = Number(rec.interval_count) || 1;
  if (!Number.isFinite(unite) || !parMois) return null;
  return (unite * q) / (parMois * n);
}
const nomPlan = (price) => {
  const p = objet(price);
  const cle = String(p.lookup_key || '').trim();
  if (cle === 'vrm_mensuel') return 'Mensuel';
  return String(p.nickname || cle || 'Sans nom').slice(0, 40);
};
const clientDe = (sub) => (typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || '');

export function resumerStripe(subs, { exclusClients = new Set(), debutMois = 0 } = {}) {
  let mensuel = 0, payants = 0, ecartes = 0, avecRemise = 0, desab = 0;
  const plans = new Map();
  for (const s of subs) {
    if (!s || exclusClients.has(clientDe(s))) continue;
    const statut = String(s.status || '');
    const finiLe = ms(Number(s.canceled_at) * 1000 || s.ended_at && Number(s.ended_at) * 1000);
    if (statut === 'canceled' && finiLe != null && finiLe >= debutMois) desab += 1;
    if (!STATUTS_PAYES.has(statut)) continue;
    const items = s.items && Array.isArray(s.items.data) ? s.items.data : [];
    let montant = 0, lisible = items.length > 0;
    for (const it of items) {
      const dev = String(objet(it.price).currency || s.currency || '').toLowerCase();
      const m = mensuelArticle(it);
      if (dev !== 'eur' || m == null) { lisible = false; break; }
      montant += m;
    }
    if (!lisible) { ecartes += 1; continue; }
    payants += 1;
    mensuel += montant;
    if ((Array.isArray(s.discounts) && s.discounts.length) || s.discount) avecRemise += 1;
    const plan = nomPlan(items[0] && items[0].price);
    plans.set(plan, (plans.get(plan) || 0) + 1);
  }
  return {
    revenus: { etat: 'ok', mensuelCentimes: Math.round(mensuel), devise: 'eur', abonnements: payants, ecartes, avecRemise },
    parPlan: [...plans.entries()].map(([plan, n]) => ({ plan, n })).sort((a, b) => b.n - a.n),
    desabonnements: desab,
  };
}

// Le premier jour du mois de Paris (ms UTC de minuit Paris, à l'heure près — assez pour un mois).
export function debutMoisParis(maintenant) {
  const j = jourParis(maintenant);
  const t = Date.parse(j.slice(0, 8) + '01T00:00:00Z');
  // Paris est à +1 h ou +2 h : on recule de 2 h pour ne jamais exclure le 1er à 0 h 30.
  return t - 2 * 3600e3;
}

// ── LA RÈGLE DES ACTIFS ────────────────────────────────────────────────────
// Un vendeur est actif sur une fenêtre si son DERNIER signe — chargement de
// l'app (`vrm_vu`, un par jour et par appareil), extension (`ext_appareil_*`)
// ou connexion (Auth) — tombe dans les N derniers jours de Paris, aujourd'hui compris.
export function compterActifs({ derniers, maintenant, jours }) {
  const seuil = jourParis(maintenant - (jours - 1) * JOUR_MS);
  let n = 0;
  for (const j of derniers.values()) if (j && j >= seuil) n += 1;
  return n;
}
const plusRecent = (a, b) => (!a ? b : !b ? a : (a > b ? a : b));

// La courbe des inscriptions (cumul, 90 jours), refaite depuis les dates de création.
export function courbeInscrits(comptes, maintenant, jours = JOURS_COURBE) {
  const parJour = new Map();
  let avant = 0;
  const debut = jourParis(maintenant - (jours - 1) * JOUR_MS);
  for (const c of comptes) {
    if (c.cree == null) continue;
    const j = jourParis(c.cree);
    if (j < debut) avant += 1; else parJour.set(j, (parJour.get(j) || 0) + 1);
  }
  const out = [];
  let cumul = avant;
  for (let k = jours - 1; k >= 0; k--) {
    const j = jourParis(maintenant - k * JOUR_MS);
    cumul += parJour.get(j) || 0;
    out.push({ jour: j, n: cumul });
  }
  return out;
}

// ── LES INCIDENTS (`statut_sondes`, propriétaire NEUTRE, api/_lib/statut-sondes.js) ──
export function resumerIncidents(data, maintenant) {
  const d = objet(data);
  const ouverts = Object.entries(objet(d.composants))
    .filter(([, c]) => c && c.incident && ms(c.incident.debut) != null)
    .map(([composant, c]) => ({ composant, debut: c.incident.debut }));
  const fermes = (Array.isArray(d.incidents) ? d.incidents : []).filter((x) => x && ms(x.fin) != null && maintenant - ms(x.fin) <= 30 * JOUR_MS);
  fermes.sort((a, b) => ms(b.fin) - ms(a.fin));
  const at = ms(d.at);
  return {
    ouverts,
    fermes30: fermes.length,
    dernier: fermes[0] ? { composant: String(fermes[0].composant || ''), debut: fermes[0].debut, fin: fermes[0].fin, dureeMin: Number(fermes[0].dureeMin) || null } : null,
    // Les sondes se sont arrêtées (plus de 45 min) : un vieux « rien » n'est pas un « rien ».
    sondesA: at != null ? new Date(at).toISOString() : null,
    sondesArretees: at == null || maintenant - at > 45 * 60e3,
  };
}

// ── (11 nov., lot « limites-client ») L'USAGE PAR VENDEUR ─────────────────
// `rpc/vrm_usage_vendeurs` (migration 041, clé de service seule) : lignes et
// octets stockés par vendeur, les plus gros d'abord. Jamais un identifiant
// dehors : une étiquette tirée d'une empreinte (« V-3fa9c2 »), stable d'une
// lecture à l'autre. Rend { lignes, vendeurs, octetsTotal } · { absente } · null.
export const etiquetteVendeur = (owner) => 'V-' + crypto.createHash('sha256').update('vrm-usage|' + String(owner).toLowerCase()).digest('hex').slice(0, 6);
export async function lireUsage(env, fetcher, exclus, max = 20) {
  const { url, service } = cfg(env);
  let r;
  try { r = await fetcher(`${url}/rest/v1/rpc/vrm_usage_vendeurs`, { method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json' }, body: JSON.stringify({ p_max: max + 2 }) }); } catch (_) { return null; }
  if (!r) return null;
  if (r.status === 404) return { absente: true };   // migration 041 pas appliquée (PGRST202)
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  if (!Array.isArray(j)) return null;
  const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
  const premiere = j[0] || {};
  const lignes = j.filter((x) => x && x.owner && !exclus(String(x.owner).toLowerCase())).slice(0, max)
    .map((x) => ({ vendeur: etiquetteVendeur(x.owner), lignes: n(x.lignes), octets: n(x.octets) }));
  return { lignes, vendeurs: n(premiere.vendeurs), octetsTotal: n(premiere.octets_total) };
}

// ── L'HISTORIQUE ───────────────────────────────────────────────────────────
async function lireLigne(env, fetcher, proprio, id) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${id}&select=data&limit=1`, { headers: sbCle(service) });
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return undefined;
    return j[0] && j[0].data && typeof j[0].data === 'object' ? j[0].data : null;
  } catch (_) { return undefined; }
}
export function historiqueApres(avant, jour, point) {
  const a = objet(avant);
  const jours = { ...objet(a.jours) };
  const prec = objet(jours[jour]);
  const neuf = {};
  // Une valeur pas sue AUJOURD'HUI ne remplace pas une valeur lue plus tôt dans la journée.
  for (const k of ['inscrits', 'actifs7', 'actifs30', 'abonnes', 'mensuelCentimes']) {
    const v = point[k];
    neuf[k] = Number.isFinite(v) ? v : (Number.isFinite(prec[k]) ? prec[k] : null);
  }
  jours[jour] = neuf;
  const gardes = Object.keys(jours).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-JOURS_COURBE);
  return { v: 1, rev: (Number(a.rev) || 0) + 1, jours: Object.fromEntries(gardes.map((k) => [k, jours[k]])) };
}
async function noterHistorique(env, fetcher, proprio, jour, point, maintenant) {
  const { url, service } = cfg(env);
  for (let essai = 0; essai < 3; essai++) {
    const avant = await lireLigne(env, fetcher, proprio, ID_HISTORIQUE);
    if (avant === undefined) return { ecrit: false, raison: 'base', data: null };
    const data = historiqueApres(avant, jour, point);
    const at = new Date(maintenant).toISOString();
    let rep;
    try {
      rep = avant === null
        ? await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify([{ owner: proprio, id: ID_HISTORIQUE, data, updated_at: at }]) })
        : await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${ID_HISTORIQUE}&data->>rev=${Number.isSafeInteger(avant.rev) ? 'eq.' + avant.rev : 'is.null'}`, { method: 'PATCH', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: at }) });
    } catch (_) { return { ecrit: false, raison: 'base', data: avant }; }
    if (!rep || !rep.ok) return { ecrit: false, raison: 'base', data: avant };
    const j = await rep.json().catch(() => null);
    if (Array.isArray(j) && j.length === 1) return { ecrit: true, data };
    if (!Array.isArray(j)) return { ecrit: false, raison: 'base', data: avant };
    // devancé : relire et rejouer
  }
  return { ecrit: false, raison: 'concurrence', data: null };
}
export function courbesHistorique(data, maintenant) {
  const jours = objet(objet(data).jours);
  const debut = jourParis(maintenant - (JOURS_COURBE - 1) * JOUR_MS);
  const cles = Object.keys(jours).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= debut).sort();
  const serie = (k) => cles.filter((j) => Number.isFinite(jours[j][k])).map((j) => ({ jour: j, n: jours[j][k] }));
  return { depuis: cles[0] || null, actifs7: serie('actifs7'), abonnes: serie('abonnes'), mensuelCentimes: serie('mensuelCentimes') };
}

// ── LE CALCUL ──────────────────────────────────────────────────────────────
// Tout ce que le tableau montre, pour un propriétaire déjà vérifié.
export async function calculerPilotage({ proprio, env = process.env, fetcher = fetch, stripeApi = stripeApiReel, stripeBranche = stripePret(), modeTest = stripeModeTest(), maintenant = Date.now(), noter = true } = {}) {
  const raisons = {};
  const exclus = (id) => !id || id === proprio || id === NEUTRE;
  const pasMoi = `owner=not.in.(${proprio},${NEUTRE})`;

  const [comptes, vus, appareils, abos, essais, notes, sondes, plantages, subs, usageLu] = await Promise.all([
    lireComptes(env, fetcher),
    lireTout(env, fetcher, `app_data?id=eq.${ID_VU}&${pasMoi}&select=owner,jour:data->>jour`),
    lireTout(env, fetcher, `app_data?id=like.ext_appareil_*&${pasMoi}&select=owner,at:meta->>at`),
    // Toutes les lignes : celles du propriétaire servent à écarter SES abonnements Stripe.
    lireTout(env, fetcher, `abonnements?select=owner,statut,annule_fin_periode,client_stripe,maj`),
    lireTout(env, fetcher, `essais_gratuits?select=owner,cree`),
    lireTout(env, fetcher, `app_data?id=eq.${ID_SATISFACTION}&${pasMoi}&select=note:data->reponse->>note,mot:data->reponse->>mot,at:data->reponse->>at`),
    lireTout(env, fetcher, `app_data?owner=eq.${NEUTRE}&id=eq.${ID_STATUT}&select=data&limit=1`),
    listerPlantagesTerrain({ proprio, env, fetcher }),
    stripeBranche ? lireAbonnementsStripe(stripeApi) : Promise.resolve(undefined),
    lireUsage(env, fetcher, exclus),
  ]);

  // Inscrits
  const vendeurs = comptes ? comptes.filter((c) => !exclus(c.id)) : null;
  let inscrits = null;
  if (vendeurs) {
    const seuil30 = maintenant - 30 * JOUR_MS;
    inscrits = { total: vendeurs.length, nouveaux30: vendeurs.filter((c) => c.cree != null && c.cree >= seuil30).length, courbe: courbeInscrits(vendeurs, maintenant) };
  } else raisons.inscrits = 'comptes-illisibles';

  // Actifs : il faut les trois signes, sinon « pas su » (un signe manquant ferait un chiffre trop bas).
  let actifs = null;
  if (vendeurs && vus && appareils) {
    const derniers = new Map(vendeurs.map((c) => [c.id, c.connecte != null ? jourParis(c.connecte) : null]));
    for (const v of vus) { const id = String(v.owner || '').toLowerCase(); if (derniers.has(id) && /^\d{4}-\d{2}-\d{2}$/.test(String(v.jour || ''))) derniers.set(id, plusRecent(derniers.get(id), v.jour)); }
    for (const a of appareils) { const id = String(a.owner || '').toLowerCase(); const t = ms(a.at); if (derniers.has(id) && t != null) derniers.set(id, plusRecent(derniers.get(id), jourParis(t))); }
    actifs = { j7: compterActifs({ derniers, maintenant, jours: 7 }), j30: compterActifs({ derniers, maintenant, jours: 30 }) };
  } else raisons.actifs = !vendeurs ? 'comptes-illisibles' : 'signes-illisibles';

  // Abonnés, essais (notre table, écrite par le webhook Stripe signé)
  const aboVendeurs = abos ? abos.filter((a) => !exclus(String(a.owner || '').toLowerCase())) : null;
  let abonnes = null, essaisBloc = null;
  if (aboVendeurs) {
    const payes = aboVendeurs.filter((a) => STATUTS_PAYES.has(String(a.statut)));
    abonnes = {
      total: payes.length,
      impayes: payes.filter((a) => a.statut === 'past_due').length,
      resiliationsProgrammees: payes.filter((a) => a.annule_fin_periode === true).length,
      parPlan: null,
    };
    if (essais) {
      const enEssai = new Set(aboVendeurs.filter((a) => a.statut === 'trialing').map((a) => String(a.owner).toLowerCase()));
      const essayeurs = new Set(essais.map((e) => String(e.owner || '').toLowerCase()).filter((id) => !exclus(id) && UUID.test(id)));
      const statutDe = new Map(aboVendeurs.map((a) => [String(a.owner).toLowerCase(), String(a.statut)]));
      let finis = 0, convertis = 0;
      for (const id of essayeurs) { if (enEssai.has(id)) continue; finis += 1; if (STATUTS_PAYES.has(statutDe.get(id))) convertis += 1; }
      essaisBloc = { enCours: enEssai.size, finis, convertis };
    } else raisons.essais = 'base';
  } else { raisons.abonnes = 'base'; raisons.essais = 'base'; }

  // Revenus (Stripe seul) et désabonnements du mois
  const debutMois = debutMoisParis(maintenant);
  let revenus, desabonnements = null;
  if (!stripeBranche) {
    revenus = { etat: 'stripe-absent' };
    if (aboVendeurs) desabonnements = { n: aboVendeurs.filter((a) => a.statut === 'canceled' && (ms(a.maj) || 0) >= debutMois).length, source: 'base' };
    else raisons.desabonnements = 'base';
  } else if (!subs || !abos) {
    revenus = { etat: 'pas-su' };
    raisons.revenus = !subs ? 'stripe-muet' : 'base';
    if (aboVendeurs) desabonnements = { n: aboVendeurs.filter((a) => a.statut === 'canceled' && (ms(a.maj) || 0) >= debutMois).length, source: 'base' };
    else raisons.desabonnements = 'base';
  } else {
    // Les abonnements du propriétaire (ses essais à lui) ne comptent pas.
    const exclusClients = new Set(abos.filter((a) => exclus(String(a.owner || '').toLowerCase())).map((a) => a.client_stripe).filter(Boolean));
    const r = resumerStripe(subs, { exclusClients, debutMois });
    revenus = { ...r.revenus, modeTest: !!modeTest };
    if (abonnes) abonnes.parPlan = r.parPlan;
    desabonnements = { n: r.desabonnements, source: 'stripe' };
  }

  // Incidents
  let incidents = null;
  if (sondes === null) raisons.incidents = 'base';
  else if (!sondes.length || !sondes[0] || !sondes[0].data) raisons.incidents = 'sondes-absentes';
  else incidents = resumerIncidents(sondes[0].data, maintenant);

  // Plantages (les 7 derniers jours, groupés)
  let plantagesBloc = null;
  if (Array.isArray(plantages)) {
    const types = plantages.reduce((a, j) => a + (j.types || []).length, 0);
    const n = plantages.reduce((a, j) => a + (j.types || []).reduce((b, t) => b + (Number(t.n) || 0), 0), 0);
    const tombes = plantages.reduce((a, j) => a + (j.types || []).reduce((b, t) => b + (Number(t.garde) || 0), 0), 0);
    plantagesBloc = { types, n, tombes };
  } else raisons.plantages = 'base';

  // (11 nov.) L'usage par vendeur — « pas su » et « migration absente » dits, jamais 0.
  let usage = null;
  if (usageLu && !usageLu.absente) usage = usageLu; else raisons.usage = usageLu && usageLu.absente ? 'migration-041' : 'base';

  // Satisfaction
  let satisfaction = null;
  if (notes) satisfaction = agregerNotes(notes); else raisons.satisfaction = 'base';

  // L'historique : un point aujourd'hui (si on peut l'écrire), puis les courbes.
  const point = {
    inscrits: inscrits ? inscrits.total : null,
    actifs7: actifs ? actifs.j7 : null,
    actifs30: actifs ? actifs.j30 : null,
    abonnes: abonnes ? abonnes.total : null,
    mensuelCentimes: revenus && revenus.etat === 'ok' ? revenus.mensuelCentimes : null,
  };
  let historique = null;
  if (noter) {
    const h = await noterHistorique(env, fetcher, proprio, jourParis(maintenant), point, maintenant);
    if (h.data) historique = courbesHistorique(h.data, maintenant); else raisons.historique = h.raison || 'base';
  } else {
    const avant = await lireLigne(env, fetcher, proprio, ID_HISTORIQUE);
    if (avant === undefined) raisons.historique = 'base'; else historique = courbesHistorique(avant, maintenant);
  }

  return { ok: true, at: new Date(maintenant).toISOString(), inscrits, actifs, essais: essaisBloc, abonnes, revenus, desabonnements, incidents, plantages: plantagesBloc, usage, satisfaction, historique, point, raisons };
}

// ── LA ROUTE ───────────────────────────────────────────────────────────────
// `utilisateur` : déjà VÉRIFIÉ par Supabase (vendeurExige). Rend { code, corps }.
export async function routePilotage({ utilisateur, env = process.env, fetcher = fetch, stripeApi, stripeBranche, modeTest, maintenant = Date.now() }) {
  if (!utilisateur || !UUID.test(String(utilisateur.id || ''))) return { code: 401, corps: { ok: false, raison: 'session' } };
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'proprietaire-inconnu' } };
  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  const opts = { proprio, env, fetcher, maintenant };
  if (stripeApi) opts.stripeApi = stripeApi;
  if (stripeBranche !== undefined) opts.stripeBranche = stripeBranche;
  if (modeTest !== undefined) opts.modeTest = modeTest;
  const corps = await calculerPilotage(opts);
  delete corps.point;
  return { code: 200, corps };
}

// ── LE CRON DU MATIN : un point d'historique par jour, même sans ouverture ──
export async function noterPilotageDuJour({ env = process.env, fetcher = fetch, maintenant = Date.now() } = {}) {
  if (!cfg(env).service) return { fait: false, raison: 'non-configure' };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { fait: false, raison: 'proprietaire-inconnu' };
  const r = await calculerPilotage({ proprio, env, fetcher, maintenant });
  return { fait: !r.raisons.historique, raison: r.raisons.historique || null };
}
