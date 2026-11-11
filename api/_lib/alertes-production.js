// ═══════════════════════════════════════════════════════════════════════════
// LES ALERTES DE PRODUCTION (11 nov., lot `alertes-production`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien veut être prévenu AVANT qu'un vendeur le lui dise. Les filets
// existaient chacun de leur côté (plantages groupés, sondes de /statut) ; ici,
// UN journal et UNE règle d'envoi pour quatre types :
//   plantage  un écran tombé / une erreur qui se répète chez un vendeur
//             (api/_lib/alertes-plantages.js, qui groupe déjà par heure) ;
//   emails    la réception des e-mails : silence anormal (sonde « emails ») ou
//             503 en série dans api/email-inbound.js (3 en une heure) ;
//   colis     la vérification des colis (`?moment=colis`) : passage en panne
//             2 fois de suite, ou le transporteur qui refuse en série ;
//   sante     /api/sante plus verte : une sonde de /statut « dégradée » 2 fois
//             de suite, ou MUETTE 3 fois de suite (dite comme telle : « pas de
//             réponse », jamais « panne »).
//
// LES RÈGLES
//   · au PROPRIÉTAIRE de l'installation seul (VRM_OWNER_UID), sa ligne
//     `alertes_production` ; jamais à un vendeur ;
//   · aucune donnée personnelle : tout titre/corps repasse par `propre`
//     (e-mails, jetons, n° de suivi, prix, pseudos `@x`, suites de chiffres) ;
//   · regroupement : une même clé = UNE notification par heure au plus, le
//     compteur dit combien depuis la précédente ; ce qui arrive pendant l'heure
//     ATTEND (`vidangerProduction`, à chaque passage des sondes) ;
//   · la ligne est écrite AVANT d'envoyer (comparer-et-échanger sur `rev`,
//     4 essais) ; une lecture ratée n'écrit rien et n'envoie rien ;
//   · un interrupteur par type (`reglages`, écrit sur SON clic) : coupé, l'alerte
//     est notée au journal (« pas envoyée ») mais ne sonne pas ;
//   · rien n'est gardé plus de 30 jours (80 alertes au plus).
// ═══════════════════════════════════════════════════════════════════════════
import { sbCle } from './cle.js';
import { nettoyer } from '../../src/plantages.js';

export const ID_ALERTES = 'alertes_production';
export const TYPES = Object.freeze(['plantage', 'emails', 'colis', 'sante']);
export const NOMS_TYPES = Object.freeze({ plantage: 'Un écran plante', emails: 'Réception des e-mails', colis: 'Vérification des colis', sante: 'Santé de VRM' });
export const GROUPE_MS = 3600e3;
export const GARDE_MS = 30 * 864e5;
export const ALERTES_MAX = 80;
export const MUETTES_POUR_ALERTE = 3;
export const ECHECS_COLIS = 2;
export const SERIE_503 = 3;
export const FENETRE_503_MS = 3600e3;
const ESSAIS = 4;

const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(t) && t > 0 ? t : null; };
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const cfg = (env) => ({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: env.SUPABASE_SERVICE_KEY || '' });
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── LE FILTRE DES DONNÉES PERSONNELLES ──────────────────────────────────────
// `nettoyer` (src/plantages.js : e-mails, jetons, UUID, prix, chiffres) puis
// ce qu'une alerte de serveur peut encore porter : un pseudo `@x`, un n° de
// suivi (lettres et chiffres mêlés), un chemin d'adresse.
export function propre(texte, max = 160) {
  return nettoyer(String(texte || ''))
    .replace(/@[\w.-]{2,}/g, '{pseudo}')
    .replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8,}\b/gi, '{code}')
    .replace(/\b\d{2,}\b/g, (n) => (n.length > 4 ? '{n}' : n))
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

export const etatVide = () => ({ v: 1, rev: 0, reglages: {}, suites: {}, alertes: {} });
export const typeActif = (reglages, type) => objet(reglages)[type] !== false;
const copie = (d) => { const x = objet(d); return { v: 1, rev: Number(x.rev) || 0, reglages: { ...objet(x.reglages) }, suites: { ...objet(x.suites) }, alertes: { ...objet(x.alertes) } }; };

function purger(d, maintenant) {
  for (const [k, a] of Object.entries(d.alertes)) if (!a || !TYPES.includes(a.type) || maintenant - (ms(a.dernier) || 0) > GARDE_MS) delete d.alertes[k];
  for (const [k, s] of Object.entries(d.suites)) if (!s || maintenant - (ms(s.dernier) || 0) > GARDE_MS) delete d.suites[k];
  const cles = Object.keys(d.alertes).sort((a, b) => (ms(d.alertes[b].dernier) || 0) - (ms(d.alertes[a].dernier) || 0));
  for (const k of cles.slice(ALERTES_MAX)) delete d.alertes[k];
}

function normaliserSignal(s) {
  const x = objet(s);
  if (!TYPES.includes(x.type)) return null;
  const cle = String(x.cle || x.type).replace(/[^\w:.-]/g, '').slice(0, 60);
  if (!cle) return null;
  return { type: x.type, cle, titre: propre(x.titre, 60) || NOMS_TYPES[x.type], corps: propre(x.corps, 200), nature: x.nature === 'muette' ? 'muette' : 'panne', tag: /^vrm-[\w-]{1,50}$/.test(String(x.tag || '')) ? x.tag : '', compteur: x.compteur !== false, n: Math.max(1, Math.min(10000, Math.round(Number(x.n) || 1))) };
}

const heure = (t) => { try { return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); } catch (_) { return ''; } };
// La notification : le titre dit le fait, le corps le compteur depuis la précédente.
export function notifPour(a, maintenant) {
  const nouveaux = Math.max(1, (Number(a.n) || 0) - (Number(a.notifieN) || 0));
  const depuis = a.notifieA ? ms(a.notifieA) : ms(a.premier);
  const compte = nouveaux > 1 && a.compteur !== false ? ` ×${nouveaux}${depuis ? ` depuis ${heure(depuis)}` : ''}.` : '';
  return { title: a.titre, body: `${a.corps}${compte}`.trim().slice(0, 240), tag: a.tag || `vrm-alerte-${a.cle.replace(/[:.]/g, '-')}`, url: '/?tab=settings', cat: 'signalement', at: new Date(maintenant).toISOString() };
}

// Marque une alerte « dite » : rend la notification, ou null si pas due.
function direSiDue(a, d, maintenant) {
  if (!a || (Number(a.n) || 0) <= (Number(a.notifieN) || 0)) return null;
  if (!typeActif(d.reglages, a.type)) { a.coupe = true; return null; }
  if (a.notifieA && maintenant - (ms(a.notifieA) || 0) < GROUPE_MS) return null;
  const notif = notifPour(a, maintenant);
  a.notifieA = new Date(maintenant).toISOString();
  a.notifieN = a.n;
  a.dites = (Number(a.dites) || 0) + 1;
  delete a.coupe;
  return notif;
}

// ── PUR : un signal de plus ──────────────────────────────────────────────────
export function apresSignal(precedent, signal, maintenant = Date.now()) {
  const d = copie(precedent);
  purger(d, maintenant);
  const s = normaliserSignal(signal);
  if (!s) return { data: d, dues: [] };
  const iso = new Date(maintenant).toISOString();
  const a = { ...(objet(d.alertes[s.cle]).type === s.type ? d.alertes[s.cle] : { type: s.type, cle: s.cle, premier: iso, n: 0, notifieN: 0, notifieA: null, dites: 0 }) };
  a.n = (Number(a.n) || 0) + s.n;
  a.dernier = iso; a.titre = s.titre; a.corps = s.corps; a.nature = s.nature;
  if (s.tag) a.tag = s.tag; else delete a.tag;
  if (!s.compteur) a.compteur = false; else delete a.compteur;
  d.alertes[s.cle] = a;
  const notif = direSiDue(a, d, maintenant);
  purger(d, maintenant);
  return { data: d, dues: notif ? [notif] : [] };
}

// ── PUR : une série (échecs de suite) ────────────────────────────────────────
// `echec` : true (un échec de plus) · false (réussi : remise à zéro) · null
// (pas su : ni compté, ni effacé). `fenetreMs` : la série recommence si le
// dernier échec est plus vieux. Atteinte ⇒ le `signal` est appliqué.
export function apresSuite(precedent, { cle, echec, seuil, fenetreMs = 0, signal }, maintenant = Date.now()) {
  const d = copie(precedent);
  const iso = new Date(maintenant).toISOString();
  const avant = objet(d.suites[cle]);
  if (echec === null || echec === undefined) return { data: d, dues: [], n: Number(avant.n) || 0 };
  if (echec === false) {
    if (!avant.n) return { data: d, dues: [], n: 0 };
    delete d.suites[cle];
    return { data: d, dues: [], n: 0 };
  }
  const neuf = fenetreMs && avant.dernier && maintenant - (ms(avant.dernier) || 0) > fenetreMs;
  const n = neuf ? 1 : (Number(avant.n) || 0) + 1;
  d.suites[cle] = { n, premier: neuf || !avant.premier ? iso : avant.premier, dernier: iso };
  if (n < seuil || !signal) return { data: d, dues: [], n };
  const r = apresSignal(d, signal, maintenant);
  return { ...r, n };
}

// ── PUR : ce qui attendait la fin de l'heure ─────────────────────────────────
export function apresVidange(precedent, maintenant = Date.now()) {
  const d = copie(precedent);
  purger(d, maintenant);
  const dues = [];
  for (const a of Object.values(d.alertes)) { const n = direSiDue(a, d, maintenant); if (n) dues.push(n); }
  return { data: d, dues };
}

export function apresReglage(precedent, type, actif) {
  const d = copie(precedent);
  if (!TYPES.includes(type)) return null;
  d.reglages[type] = actif !== false;
  return d;
}

// ── LA LIGNE : lecture (trois états) et écriture comparée sur `rev` ─────────
async function lireLigne(env, fetcher, proprio) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${ID_ALERTES}&select=data&limit=1`, { headers: sbCle(service) });
    if (!r || !r.ok) return undefined;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return undefined;
    return j[0] && j[0].data && typeof j[0].data === 'object' ? j[0].data : null;
  } catch (_) { return undefined; }
}
async function ecrireCas(env, fetcher, proprio, avant, data, maintenant) {
  const { url, service } = cfg(env);
  const at = new Date(maintenant).toISOString();
  let rep;
  try {
    rep = avant === null
      ? await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify([{ owner: proprio, id: ID_ALERTES, data, updated_at: at }]) })
      : await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${ID_ALERTES}&data->>rev=${Number.isSafeInteger(avant.rev) ? 'eq.' + avant.rev : 'is.null'}`, { method: 'PATCH', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: at }) });
  } catch (_) { return undefined; }
  if (!rep || !rep.ok) return undefined;
  const j = await rep.json().catch(() => null);
  if (!Array.isArray(j)) return undefined;
  return j.length === 1;
}

// Applique `operation(data) → { data, dues }` sur la ligne, écrit (si changé),
// PUIS envoie. `pousser(notif)` → { sent } (le chemin push existant).
export async function passerAlertes({ proprio, operation, env = process.env, fetcher = fetch, pousser = null, maintenant = Date.now() }) {
  const p = String(proprio || '').trim().toLowerCase();
  if (!cfg(env).service || !RE_UUID.test(p)) return { fait: false, raison: 'non-configure' };
  for (let essai = 0; essai < ESSAIS; essai++) {
    const avant = await lireLigne(env, fetcher, p);
    if (avant === undefined) return { fait: false, raison: 'base' };
    const r = operation(avant || etatVide());
    if (!r || !r.data) return { fait: false, raison: 'refus' };
    const data = { ...r.data, rev: (Number(avant && avant.rev) || 0) + 1 };
    const pareil = avant && JSON.stringify({ ...r.data, rev: 0 }) === JSON.stringify({ ...copie(avant), rev: 0 });
    if (pareil && !r.dues.length) return { fait: true, ecrit: false, dues: 0, notifiees: 0 };
    const ecrit = await ecrireCas(env, fetcher, p, avant, data, maintenant);
    if (ecrit === undefined) return { fait: false, raison: 'base' };
    if (!ecrit) continue;
    let notifiees = 0;
    for (const n of r.dues) {
      if (typeof pousser !== 'function') break;
      try { const x = await pousser(n); if (x && x.sent > 0) notifiees++; } catch (_) {}
    }
    return { fait: true, ecrit: true, dues: r.dues.length, notifiees, data };
  }
  return { fait: false, raison: 'concurrence' };
}

// Plusieurs signaux et séries d'un coup (une lecture, une écriture), puis la vidange.
export function apresGroupe(precedent, { signaux = [], suites = [], vidange = true } = {}, maintenant = Date.now()) {
  let d = copie(precedent); const dues = [];
  for (const s of suites) { const r = apresSuite(d, s, maintenant); d = r.data; dues.push(...r.dues); }
  for (const s of signaux) { const r = apresSignal(d, s, maintenant); d = r.data; dues.push(...r.dues); }
  if (vidange) { const r = apresVidange(d, maintenant); d = r.data; dues.push(...r.dues); }
  return { data: d, dues };
}
export const groupeProduction = ({ groupe, maintenant = Date.now(), ...o }) => passerAlertes({ ...o, maintenant, operation: (d) => apresGroupe(d, groupe, maintenant) });
export const signalerProduction = ({ signal, maintenant = Date.now(), ...o }) => passerAlertes({ ...o, maintenant, operation: (d) => apresSignal(d, signal, maintenant) });
export const suiteProduction = ({ suite, maintenant = Date.now(), ...o }) => passerAlertes({ ...o, maintenant, operation: (d) => apresSuite(d, suite, maintenant) });
export const vidangerProduction = ({ maintenant = Date.now(), ...o }) => passerAlertes({ ...o, maintenant, operation: (d) => apresVidange(d, maintenant) });

// ── CE QUE LE PANNEAU MONTRE (propriétaire seul) ────────────────────────────
export function alertesPourPanneau(data, maintenant = Date.now()) {
  const d = copie(data);
  purger(d, maintenant);
  const alertes = Object.values(d.alertes).map((a) => ({
    cle: a.cle, type: a.type, titre: propre(a.titre, 60), corps: propre(a.corps, 200), nature: a.nature === 'muette' ? 'muette' : 'panne',
    n: Number(a.n) || 0, premier: a.premier || null, dernier: a.dernier || null, notifieA: a.notifieA || null,
    attente: Math.max(0, (Number(a.n) || 0) - (Number(a.notifieN) || 0)), coupe: !typeActif(d.reglages, a.type),
  })).sort((a, b) => (ms(b.dernier) || 0) - (ms(a.dernier) || 0)).slice(0, 20);
  return { reglages: Object.fromEntries(TYPES.map((t) => [t, typeActif(d.reglages, t)])), alertes };
}

export async function listerAlertesProduction({ proprio, env = process.env, fetcher = fetch, maintenant = Date.now() }) {
  if (!cfg(env).service) return null;
  const d = await lireLigne(env, fetcher, String(proprio || '').toLowerCase());
  if (d === undefined) return null;
  return alertesPourPanneau(d || etatVide(), maintenant);
}

// ── LA ROUTE (api/compte.js `?mode=alertes`) — propriétaire seul ────────────
//   GET  : { ok, reglages, alertes }
//   POST : { type, actif } ⇒ l'interrupteur (SON clic).
export async function routeAlertes({ methode, utilisateur, corps, proprio, env = process.env, fetcher = fetch, maintenant = Date.now() }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  if (!utilisateur || String(utilisateur.id).toLowerCase() !== String(proprio).toLowerCase()) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  if (methode === 'GET') {
    const v = await listerAlertesProduction({ proprio, env, fetcher, maintenant });
    return v ? { code: 200, corps: { ok: true, ...v } } : { code: 503, corps: { ok: false, raison: 'base' } };
  }
  const type = String(objet(corps).type || '');
  if (!TYPES.includes(type) || typeof objet(corps).actif !== 'boolean') return { code: 400, corps: { ok: false, raison: 'type' } };
  const r = await passerAlertes({ proprio, env, fetcher, maintenant, operation: (d) => ({ data: apresReglage(d, type, corps.actif), dues: [] }) });
  if (!r.fait) return { code: 503, corps: { ok: false, raison: r.raison } };
  return { code: 200, corps: { ok: true, ...alertesPourPanneau(r.data || etatVide(), maintenant) } };
}

// ── LES TEXTES (fixes, sans aucune donnée) ──────────────────────────────────
export const SIGNAUX = Object.freeze({
  emails503: { type: 'emails', cle: 'emails:503', titre: 'E-mails refusés en série', corps: 'La réception répond « réessaie » (503) : la base n’a pas rangé 3 e-mails en une heure.' },
  colisPassage: { type: 'colis', cle: 'colis:passage', titre: 'Vérification des colis en panne', corps: 'Le passage des colis a échoué 2 fois de suite : les statuts ne sont plus relus.' },
  colisTransporteur: { type: 'colis', cle: 'colis:transporteur', titre: 'Transporteur refusé en série', corps: 'La moitié des lectures de suivi échoue, 2 passages de suite.' },
});
// Un passage colis : refus en série = au moins 5 lectures, la moitié en échec.
export function refusEnSerie(bilans) {
  let lus = 0, echecs = 0;
  for (const b of Array.isArray(bilans) ? bilans : []) { lus += Number(b && b.lus) || 0; echecs += Number(b && b.echecs) || 0; }
  if (lus + echecs < 5) return null;   // trop peu pour juger : pas su
  return echecs * 2 >= lus + echecs;
}

// ── LES ERREURS GARDÉES 30 JOURS AU PLUS (cron du matin) ────────────────────
// `plantages_terrain_<jour>` du propriétaire (le jour est dans l'id) et les
// `plantage_*` de chaque vendeur (date copiée dans `meta`, migration 004).
// Une suppression par filtre : ce qui n'a pas de date n'est jamais touché.
export async function purgerErreursAnciennes({ url, headers, proprio, fetcher = fetch, maintenant = Date.now() }) {
  const seuil = new Date(maintenant - GARDE_MS);
  const jour = seuil.toISOString().slice(0, 10);
  const out = { fait: true, seuil: seuil.toISOString() };
  const p = String(proprio || '').trim().toLowerCase();
  const del = async (q) => {
    try { const r = await fetcher(`${url}/rest/v1/app_data?${q}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } }); return !!(r && r.ok); } catch (_) { return false; }
  };
  out.terrain = RE_UUID.test(p) ? await del(`owner=eq.${p}&id=like.plantages_terrain_*&id=lt.plantages_terrain_${jour}`) : null;
  out.plantages = await del(`id=like.plantage_*&meta->>at=lt.${encodeURIComponent(seuil.toISOString())}`);
  out.fait = out.terrain !== false && out.plantages;
  return out;
}
