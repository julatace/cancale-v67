// ═══════════════════════════════════════════════════════════════════════════
// LES SONDES AUTOMATIQUES DE vrm.center/statut (9 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (« fais tout » — des vendeurs payants arrivent) : la page /statut ne
// doit plus attendre qu'on écrive un incident à la main. Toutes les 10 minutes
// (GitHub → `api/ship-reminders.js?moment=sondes`, PAS une 13ᵉ fonction ; et
// aussi aux deux crons Vercel du matin et du soir), le serveur vérifie six
// morceaux et range le résultat dans UNE ligne d'état :
//
//   base           une lecture courte de la base (deux scalaires, 4 s au plus) ;
//   connexion      le service de connexion (`/auth/v1/settings`, sans session) ;
//   emails         la réception : la clé posée, le collecteur, et le DERNIER
//                  e-mail rangé comparé à l'HISTORIQUE (le plus long silence
//                  normal des 14 derniers jours × 1,5, au moins 6 h) ;
//   envoi          l'envoi des e-mails : une vraie connexion au serveur SMTP
//                  (identifiants compris, aucun message envoyé), une fois par
//                  heure au plus ; pas configuré ⇒ « pas su » (pas en service) ;
//   notifications  la clé VAPID et la clé de service posées (sans elles rien ne
//                  part) — c'est une configuration, l'écran dit « configurées » ;
//   extension      le dernier signe de vie de N'IMPORTE QUELLE extension
//                  (`ext_appareil_*`, une date et rien d'autre), comparé à son
//                  historique comme les e-mails.
//
// TROIS ÉTATS, JAMAIS DEUX (CLAUDE.md §5) : 'ok' · 'degrade' · 'pas_su'.
//   Une sonde qui n'a pas répondu (délai, réseau) est 'pas_su' : ni une alerte,
//   ni un feu vert. Elle ne compte pas un échec, elle n'en efface pas un.
//   Un état rangé il y a plus de 45 min (les sondes se sont arrêtées) se lit
//   'pas_su' partout (`statutPublic`) : un vieux « ok » n'est pas un « ok ».
//
// LES INCIDENTS : deux sondes 'degrade' DE SUITE sur un morceau ⇒ un incident
// ouvert (daté de la PREMIÈRE des deux), et UNE notification au propriétaire de
// l'installation — le drapeau `notifie` est écrit AVANT d'envoyer (un drapeau
// pas écrit ⇒ rien n'est envoyé ; sinon la même notification repartirait toutes
// les 10 minutes). Une sonde 'ok' le ferme, avec sa durée. 'pas_su' ne ferme
// rien. Les incidents écrits à la main (`public/statut-incidents.json`) restent.
//
// LA LIGNE : `statut_sondes`, au propriétaire NEUTRE (00000000-…). Pourquoi pas
// au propriétaire de l'installation : c'est l'état de VRM, pas une donnée d'un
// vendeur ; elle doit survivre à un changement de `VRM_OWNER_UID` ; et une ligne
// neutre n'est lisible par AUCUNE session (RLS) — seul le serveur la lit, avec
// la clé de service, et `/api/sante` n'en rend que la projection `statutPublic`
// (des mots fixes, des dates, des durées : aucune donnée d'un vendeur).
// Écritures concurrentes (le cron Vercel et GitHub au même moment) :
// comparer-et-échanger sur `data.rev`. Une lecture ratée n'écrit RIEN.
// ⚠️ Une base TOUT À FAIT tombée ne peut pas s'écrire elle-même : la route
// répond 503, le workflow GitHub échoue (GitHub l'annonce par e-mail), et la
// page /statut dit « VRM ne répond pas » (elle sonde aussi en direct).
// ═══════════════════════════════════════════════════════════════════════════
import { sbCle } from './cle.js';
import { jourParis } from '../../src/mesuresTerrain.js';
import { etatEmails } from './etat-public.js';

export const ID_STATUT = 'statut_sondes';
export const NEUTRE = '00000000-0000-0000-0000-000000000000';
export const COMPOSANTS = Object.freeze(['base', 'connexion', 'emails', 'envoi', 'notifications', 'extension']);
export const ETATS = Object.freeze(['ok', 'degrade', 'pas_su']);
export const ECHECS_POUR_INCIDENT = 2;
export const MUETTES_POUR_ALERTE = 3;
export const SONDE_MS = 4000;
export const SMTP_TOUS_LES_MS = 55 * 60e3;
export const PERIME_MS = 45 * 60e3;
export const JOURS_GARDES = 31;
export const JOURS_AFFICHES = 30;
export const INCIDENTS_GARDES_MS = 30 * 864e5;
export const INCIDENTS_MAX = 60;
// Le silence « normal » : appris sur 14 jours.
export const SILENCE_PLANCHER_MS = 6 * 3600e3;
export const SILENCE_PLAFOND_MS = 7 * 864e5;
export const SILENCE_FACTEUR = 1.5;
export const SILENCE_RETENU_MS = 3600e3;          // un écart de moins d'une heure n'est pas un silence
export const HISTORIQUE_MIN_MS = 3 * 864e5;       // moins de 3 jours d'observation : pas de jugement « en retard »
export const HISTORIQUE_GARDE_MS = 14 * 864e5;
export const SILENCES_MAX = 200;

// Les raisons, en codes fixes (la page les dit en mots ; jamais un texte venu de la base).
export const RAISONS = Object.freeze({
  repond: 'ok', configure: 'ok', recent: 'ok',
  'erreur-http': 'degrade', 'cle-absente': 'degrade', silence: 'degrade', 'collecteur-arrete': 'degrade', 'identifiants-refuses': 'degrade', 'reponse-illisible': 'degrade',
  'sans-reponse': 'pas_su', dependance: 'pas_su', 'historique-court': 'pas_su', 'jamais-vu': 'pas_su', 'non-configure': 'pas_su', 'pas-sonde': 'pas_su', 'sondes-arretees': 'pas_su',
});

// La phrase d'un incident, par morceau : fixe, sans aucune donnée.
export const PHRASES = Object.freeze({
  base: 'La base de données répond mal : l’app peut ne pas afficher tes données. Rien de ce qui est enregistré n’est perdu.',
  connexion: 'La connexion à VRM est perturbée : tu peux ne pas réussir à te connecter.',
  emails: 'Les e-mails arrivent en retard : ventes, bordereaux et codes de retrait peuvent tarder à apparaître.',
  envoi: 'Les e-mails envoyés par VRM ne partent pas pour l’instant.',
  notifications: 'Les notifications ne partent pas pour l’instant.',
  extension: 'Aucune extension ne donne signe de vie : les lectures de Vinted peuvent être en retard.',
});
export const NOMS = Object.freeze({
  base: 'la base de données', connexion: 'la connexion', emails: 'la réception des e-mails',
  envoi: 'l’envoi des e-mails', notifications: 'les notifications', extension: 'l’extension',
});

const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(t) && t > 0 ? t : null; };
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const verdict = (raison, extra = {}) => ({ etat: RAISONS[raison] || 'pas_su', raison, ...extra });

// ── LE SILENCE ANORMAL (e-mails, extension) — pur ───────────────────────────
// `dernier` : la date de la dernière activité lue (ms) · null (aucune) · undefined (pas su).
// `hist` : { depuis, dernier, silences: [[finMs, dureeMs], …] } (rangé dans l'état).
export function jugerSilence({ dernier, hist, maintenant = Date.now() }) {
  const h = objet(hist);
  const depuis = ms(h.depuis) || maintenant;
  let vu = ms(h.dernier);
  let silences = Array.isArray(h.silences) ? h.silences.filter((s) => Array.isArray(s) && ms(s[0]) && Number(s[1]) > 0) : [];
  if (dernier === undefined) return { verdict: verdict('dependance'), hist: { depuis, dernier: vu, silences } };
  const lu = ms(dernier);
  if (lu && (!vu || lu > vu)) {
    if (vu && lu - vu >= SILENCE_RETENU_MS) silences.push([lu, lu - vu]);
    vu = lu;
  }
  silences = silences.filter((s) => maintenant - s[0] <= HISTORIQUE_GARDE_MS).slice(-SILENCES_MAX);
  const suite = { depuis, dernier: vu, silences };
  if (!vu) return { verdict: verdict('jamais-vu'), hist: suite };
  const silence = Math.max(0, maintenant - vu);
  const plusLong = silences.reduce((m, s) => Math.max(m, Number(s[1]) || 0), 0);
  const seuil = Math.min(SILENCE_PLAFOND_MS, Math.max(SILENCE_PLANCHER_MS, Math.round(plusLong * SILENCE_FACTEUR)));
  const heures = (x) => Math.round(x / 3600e3);
  if (silence <= SILENCE_PLANCHER_MS) return { verdict: verdict('recent', { silenceH: heures(silence), seuilH: heures(seuil) }), hist: suite };
  if (maintenant - depuis < HISTORIQUE_MIN_MS) return { verdict: verdict('historique-court', { silenceH: heures(silence) }), hist: suite };
  if (silence > seuil) return { verdict: verdict('silence', { silenceH: heures(silence), seuilH: heures(seuil) }), hist: suite };
  return { verdict: verdict('recent', { silenceH: heures(silence), seuilH: heures(seuil) }), hist: suite };
}

// ── UNE REQUÊTE BORNÉE : réponse lue · HTTP en erreur · pas de réponse ──────
async function demander(fetcher, url, opts = {}) {
  try {
    const r = await fetcher(url, { ...opts, signal: AbortSignal.timeout(SONDE_MS) });
    if (!r || typeof r.status !== 'number') return { reponse: false };
    if (!r.ok) return { reponse: true, ok: false, status: r.status };
    const j = await r.json().catch(() => undefined);
    return { reponse: true, ok: true, status: r.status, json: j };
  } catch (_) { return { reponse: false }; }
}

// ── LES SONDES (entrées injectées : `env`, `fetcher`, `pushPret`, `smtp`) ────
// Chaque sonde rend { etat, raison, … } ; `hist` (silences) pour e-mails/extension.
export async function sonder({ env = process.env, fetcher = fetch, pushPret = false, smtp = null, configSmtp = null, etat = {}, maintenant = Date.now() } = {}) {
  const url = env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
  const service = env.SUPABASE_SERVICE_KEY || '';
  const H = service ? sbCle(service) : {};
  const anon = env.SUPABASE_KEY || service;
  const comp = objet(etat.composants), act = objet(etat.activite);
  const out = {};

  // base : deux scalaires de la ligne du collecteur (propriétaire neutre).
  const b = await demander(fetcher, `${url}/rest/v1/app_data?owner=eq.${NEUTRE}&id=in.(vrm_email_collecteur_passage,vrm_email_collecteur_succes)&select=id,at:data->>at,etat:data->>etat&limit=2`, { headers: H });
  const baseLignes = b.reponse && b.ok && Array.isArray(b.json) ? b.json : null;
  out.base = !service ? verdict('cle-absente') : !b.reponse ? verdict('sans-reponse') : !b.ok ? verdict('erreur-http', { http: b.status }) : baseLignes ? verdict('repond') : verdict('reponse-illisible');
  const baseOk = out.base.etat === 'ok';

  // connexion : le service d'authentification, sans session.
  const a = await demander(fetcher, `${url}/auth/v1/settings`, { headers: anon ? sbCle(anon) : {} });
  out.connexion = !a.reponse ? verdict('sans-reponse') : !a.ok ? verdict('erreur-http', { http: a.status }) : (a.json && typeof a.json === 'object' && 'external' in a.json) ? verdict('repond') : verdict('reponse-illisible');

  // e-mails reçus : la clé, le collecteur, et le dernier e-mail RANGÉ (pas un « erreur »).
  let dernierEmail;
  if (baseOk) {
    const depuis = new Date(maintenant - 30 * 864e5).toISOString();
    const e = await demander(fetcher, `${url}/rest/v1/app_data?id=like.email_reception_*&meta->>etat=in.(integre,a-verifier)&meta->>at=gte.${encodeURIComponent(depuis)}&select=at:meta->>at&order=meta->>at.desc&limit=1`, { headers: H });
    dernierEmail = e.reponse && e.ok && Array.isArray(e.json) ? (e.json[0] ? ms(e.json[0].at) : null) : undefined;
  }
  const silenceEmails = jugerSilence({ dernier: dernierEmail, hist: act.emails, maintenant });
  const collecteur = baseLignes ? etatEmails({ secret: !!env.EMAIL_INBOUND_SECRET, lignes: baseLignes, maintenant }) : 'inconnu';
  out.emails = !env.EMAIL_INBOUND_SECRET ? verdict('cle-absente')
    : collecteur === 'panne' ? verdict('collecteur-arrete')
    : silenceEmails.verdict;
  out.emails.hist = silenceEmails.hist;

  // envoi des e-mails : une vraie connexion SMTP, une fois par heure au plus.
  const prec = objet(comp.envoi);
  const cfg = configSmtp || { pret: false };
  if (!cfg.pret) out.envoi = verdict('non-configure');
  else if (prec.sondeA && maintenant - ms(prec.sondeA) < SMTP_TOUS_LES_MS && ETATS.includes(prec.etat) && prec.raison !== 'non-configure') {
    out.envoi = { etat: prec.etat, raison: prec.raison, garde: true };   // pas resondé : ni compté, ni effacé
  } else if (typeof smtp !== 'function') out.envoi = verdict('pas-sonde');
  else {
    let r = null;
    try { r = await smtp(); } catch (_) { r = null; }
    // Le serveur a RÉPONDU un refus (code SMTP) ⇒ dégradé ; aucune réponse (délai, réseau) ⇒ pas su.
    out.envoi = r && r.issue === 'connecte' ? verdict('repond')
      : r && r.issue === 'refuse' && r.etape === 'identifiants' ? verdict('identifiants-refuses')
      : r && r.issue === 'refuse' && Number(r.code) >= 400 ? verdict('erreur-http', { http: Number(r.code) })
      : verdict('sans-reponse');
    out.envoi.sondeA = new Date(maintenant).toISOString();
  }

  // notifications : la configuration (VAPID + clé de service).
  out.notifications = pushPret && service ? verdict('configure') : verdict('cle-absente');

  // extension : le dernier signe de vie, toutes extensions confondues (une date).
  let dernierExt;
  if (baseOk) {
    const depuis = new Date(maintenant - 30 * 864e5).toISOString();
    const x = await demander(fetcher, `${url}/rest/v1/app_data?id=like.ext_appareil_*&meta->>at=gte.${encodeURIComponent(depuis)}&select=at:meta->>at&order=meta->>at.desc&limit=1`, { headers: H });
    dernierExt = x.reponse && x.ok && Array.isArray(x.json) ? (x.json[0] ? ms(x.json[0].at) : null) : undefined;
  }
  const silenceExt = jugerSilence({ dernier: dernierExt, hist: act.extension, maintenant });
  out.extension = { ...silenceExt.verdict, hist: silenceExt.hist };
  return out;
}

// ── L'ÉTAT APRÈS UNE SONDE — pur : compteurs, incidents, jours ───────────────
// Rend { etat, aNotifier: [composant…] } ; les notifications ne partent qu'après
// l'écriture confirmée de `etat` (où `notifie` est déjà vrai).
export function etatApres(precedent, resultats, maintenant = Date.now()) {
  const p = objet(precedent);
  const at = new Date(maintenant).toISOString();
  const jour = jourParis(maintenant);
  const composants = {}, activite = { ...objet(p.activite) };
  const jours = { ...objet(p.jours) };
  const jourCourant = { ...objet(jours[jour]) };
  let incidents = Array.isArray(p.incidents) ? p.incidents.filter((x) => x && COMPOSANTS.includes(x.composant) && ms(x.debut) && ms(x.fin)) : [];
  const aNotifier = [], muettes = [];
  for (const c of COMPOSANTS) {
    const avant = objet(objet(p.composants)[c]);
    const r = objet(resultats[c]);
    const etat = ETATS.includes(r.etat) ? r.etat : 'pas_su';
    const garde = r.garde === true;
    let echecs = Number(avant.echecs) || 0;
    let premierEchec = avant.premierEchec || null;
    let incident = avant.incident && ms(avant.incident.debut) ? { ...avant.incident } : null;
    if (!garde) {
      if (etat === 'degrade') {
        echecs += 1;
        if (!premierEchec) premierEchec = at;
        if (echecs >= ECHECS_POUR_INCIDENT && !incident) incident = { debut: premierEchec, notifie: false };
      } else if (etat === 'ok') {
        if (incident) incidents.push({ composant: c, debut: incident.debut, fin: at, dureeMin: Math.max(1, Math.round((maintenant - ms(incident.debut)) / 60e3)) });
        echecs = 0; premierEchec = null; incident = null;
      }
      // 'pas_su' : ni compté, ni effacé.
    }
    if (incident && !incident.notifie) { incident.notifie = true; aNotifier.push(c); }
    // (11 nov.) MUETTE : la sonde n'a pas répondu (« sans-reponse ») ; 3 de suite
    // ⇒ dit UNE fois, comme « pas de réponse » (jamais une panne). Une réponse
    // (ok, dégradé, ou une autre raison) remet à zéro.
    let muette = Number(avant.muette) || 0;
    let muetteDite = !!avant.muetteDite;
    if (!garde) {
      if (r.raison === 'sans-reponse') muette += 1; else { muette = 0; muetteDite = false; }
      if (muette >= MUETTES_POUR_ALERTE && !muetteDite) { muetteDite = true; muettes.push(c); }
    }
    const x = { etat, raison: RAISONS[r.raison] ? r.raison : 'pas-sonde', at: garde ? (avant.at || at) : at, echecs, premierEchec, incident };
    if (muette) x.muette = muette;
    if (muetteDite) x.muetteDite = true;
    if (r.sondeA || avant.sondeA) x.sondeA = r.sondeA || avant.sondeA;
    for (const k of ['http', 'silenceH', 'seuilH']) if (Number.isFinite(r[k])) x[k] = r[k];
    composants[c] = x;
    if (r.hist) activite[c] = r.hist;
    // Le jour : [ok, dégradé, pas su, incident].
    const j = Array.isArray(jourCourant[c]) ? jourCourant[c].slice(0, 4) : [0, 0, 0, 0];
    if (!garde) j[ETATS.indexOf(etat)] = (Number(j[ETATS.indexOf(etat)]) || 0) + 1;
    if (incident) j[3] = 1;
    jourCourant[c] = j;
  }
  jours[jour] = jourCourant;
  const gardes = Object.keys(jours).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-JOURS_GARDES);
  incidents = incidents.filter((x) => maintenant - ms(x.fin) <= INCIDENTS_GARDES_MS).slice(-INCIDENTS_MAX);
  return {
    etat: { v: 1, rev: (Number(p.rev) || 0) + 1, at, composants, activite, jours: Object.fromEntries(gardes.map((k) => [k, jours[k]])), incidents },
    aNotifier, muettes,
  };
}

// La notification d'un incident ouvert (au propriétaire seul).
export function texteIncident(composants, etat) {
  const liste = (composants || []).filter((c) => PHRASES[c]);
  if (!liste.length) return null;
  const heure = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); } catch (_) { return ''; } };
  const debut = liste.map((c) => objet(objet(objet(etat).composants)[c]).incident).filter(Boolean).map((i) => i.debut).sort()[0];
  const noms = liste.map((c) => NOMS[c]);
  const titre = liste.length === 1 ? `VRM : panne sur ${noms[0]}` : `VRM : panne sur ${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
  return { title: titre, body: `Deux vérifications de suite ont échoué${debut ? ` (depuis ${heure(debut)})` : ''}. La page vrm.center/statut le dit aux vendeurs.`, url: '/statut', tag: 'vrm-statut-' + liste.join('-') };
}

// ── LA PROJECTION PUBLIQUE (pour /api/sante → /statut et le bandeau de l'app) ──
// Seulement des mots fixes, des dates, des durées. Un état périmé ⇒ 'pas_su'.
export function statutPublic(data, maintenant = Date.now()) {
  const d = objet(data);
  const at = ms(d.at);
  if (!at) return null;
  const perime = maintenant - at > PERIME_MS;
  const composants = {};
  for (const c of COMPOSANTS) {
    const x = objet(objet(d.composants)[c]);
    const etat = perime ? 'pas_su' : (ETATS.includes(x.etat) ? x.etat : 'pas_su');
    const raison = perime ? 'sondes-arretees' : (RAISONS[x.raison] ? x.raison : 'pas-sonde');
    const y = { etat, raison };
    if (!perime) for (const k of ['silenceH', 'seuilH']) if (Number.isFinite(x[k])) y[k] = x[k];
    if (!perime && ms(x.at)) y.at = new Date(ms(x.at)).toISOString();
    composants[c] = y;
  }
  const jours = [];
  for (let i = JOURS_AFFICHES - 1; i >= 0; i--) {
    const j = jourParis(maintenant - i * 864e5);
    const brut = objet(objet(d.jours)[j]);
    const ligne = { jour: j };
    for (const c of COMPOSANTS) {
      const v = Array.isArray(brut[c]) ? brut[c] : [0, 0, 0, 0];
      ligne[c] = Number(v[3]) ? 'degrade' : Number(v[0]) > 0 ? 'ok' : 'pas_su';
    }
    jours.push(ligne);
  }
  const iso = (t) => new Date(t).toISOString();
  const incidents = [];
  for (const c of COMPOSANTS) {
    const inc = objet(objet(d.composants)[c]).incident;
    if (inc && ms(inc.debut)) incidents.push({ composant: c, debut: iso(ms(inc.debut)), fin: null, dureeMin: Math.max(1, Math.round((maintenant - ms(inc.debut)) / 60e3)), phrase: PHRASES[c] });
  }
  for (const x of Array.isArray(d.incidents) ? d.incidents : []) {
    if (!x || !COMPOSANTS.includes(x.composant) || !ms(x.debut) || !ms(x.fin)) continue;
    if (maintenant - ms(x.fin) > INCIDENTS_GARDES_MS) continue;
    incidents.push({ composant: x.composant, debut: iso(ms(x.debut)), fin: iso(ms(x.fin)), dureeMin: Math.max(1, Math.round((ms(x.fin) - ms(x.debut)) / 60e3)), phrase: PHRASES[x.composant] });
  }
  incidents.sort((a, b) => ((b.fin == null) - (a.fin == null)) || Date.parse(b.debut) - Date.parse(a.debut));
  return { at: iso(at), perime, composants, jours, incidents: incidents.slice(0, 40) };
}

// ── LA LIGNE D'ÉTAT : lecture (trois états) et écriture comparée sur `rev` ───
export async function lireEtat({ url, headers, fetcher = fetch }) {
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${NEUTRE}&id=eq.${ID_STATUT}&select=data&limit=1`, { headers, signal: AbortSignal.timeout(SONDE_MS) });
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => undefined);
    if (!Array.isArray(j)) return undefined;
    return (j[0] && j[0].data) || null;
  } catch (_) { return undefined; }
}
export async function ecrireEtat({ url, headers, fetcher = fetch, precedent, etat }) {
  try {
    if (precedent) {
      // Comparer-et-échanger : seulement si `rev` n'a pas bougé depuis la lecture.
      const filtre = precedent.rev != null && Number.isFinite(Number(precedent.rev)) ? `data->>rev=eq.${Number(precedent.rev)}` : 'data->>rev=is.null';
      const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${NEUTRE}&id=eq.${ID_STATUT}&${filtre}&select=id`, {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ data: etat, updated_at: new Date().toISOString() }), signal: AbortSignal.timeout(SONDE_MS),
      });
      if (!r.ok) return false;
      const j = await r.json().catch(() => null);
      return Array.isArray(j) && j.length === 1;
    }
    // Ligne absente : une insertion SANS fusion — un autre passage arrivé avant
    // ⇒ conflit (409) ⇒ rien d'écrit (il a déjà sondé).
    const r = await fetcher(`${url}/rest/v1/app_data`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify([{ owner: NEUTRE, id: ID_STATUT, data: etat, updated_at: new Date().toISOString() }]),
      signal: AbortSignal.timeout(SONDE_MS),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}

// ── CE QUE /api/sante EN REND (public) : la projection, gardée 30 s par instance ──
// Ligne absente ⇒ null (pas encore sondé) ; illisible ⇒ null aussi : la page dit
// « pas su », jamais « tout va bien ».
let memoPublic = null;
export async function statutPourSante({ env = process.env, fetcher = fetch, maintenant = Date.now() } = {}) {
  if (memoPublic && maintenant - memoPublic.t < 30e3) return memoPublic.v;
  const service = env.SUPABASE_SERVICE_KEY || '';
  let v = null;
  if (service) {
    const d = await lireEtat({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', headers: sbCle(service), fetcher });
    v = d ? statutPublic(d, maintenant) : null;
  }
  memoPublic = { t: maintenant, v };
  return v;
}
export const oublierStatutPublic = () => { memoPublic = null; };

// ── LE PASSAGE COMPLET (le cron le branche ; l'audit le joue sur une fausse base) ──
//   envoyer(notif) → résultat de l'envoi (au propriétaire seul).
// (11 nov.) `alerter(signaux)` : le journal des alertes de production
// (api/_lib/alertes-production.js — interrupteurs, regroupement, 30 jours).
// Donné, c'est LUI qui prévient ; sinon l'envoi direct d'avant.
export function signauxSondes({ aNotifier = [], muettes = [] }, etat) {
  const out = [];
  for (const c of aNotifier) {
    const t = texteIncident([c], etat);
    if (t) out.push({ type: c === 'emails' ? 'emails' : 'sante', cle: 'sonde:' + c, titre: t.title, corps: t.body, tag: t.tag });
  }
  for (const c of muettes) if (NOMS[c]) out.push({ type: c === 'emails' ? 'emails' : 'sante', cle: 'muette:' + c, nature: 'muette', titre: `Pas de réponse : ${NOMS[c]}`.slice(0, 60), corps: `${MUETTES_POUR_ALERTE} vérifications de suite sans réponse. Pas su : ce n’est pas une panne prouvée.` });
  return out;
}
export async function passageSondes({ env = process.env, fetcher = fetch, pushPret = false, smtp = null, configSmtp = null, envoyer = null, alerter = null, proprietaire = '', maintenant = Date.now() } = {}) {
  const url = env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
  const service = env.SUPABASE_SERVICE_KEY || '';
  if (!service) return { fait: false, raison: 'clé de service absente : rien sondé, rien écrit' };
  const headers = sbCle(service);
  const precedent = await lireEtat({ url, headers, fetcher });
  if (precedent === undefined) return { fait: false, raison: 'état illisible : rien écrit, rien envoyé (« rien lu » ne vaut pas « rien »)' };
  const resultats = await sonder({ env, fetcher, pushPret, smtp, configSmtp, etat: precedent || {}, maintenant });
  const { etat, aNotifier, muettes } = etatApres(precedent, resultats, maintenant);
  const ecrit = await ecrireEtat({ url, headers, fetcher, precedent, etat });
  const resume = Object.fromEntries(COMPOSANTS.map((c) => [c, etat.composants[c].etat]));
  if (!ecrit) return { fait: false, raison: 'état pas écrit (un autre passage, ou la base) : rien envoyé', etats: resume };
  let envoi = null;
  if (typeof alerter === 'function') {
    try { envoi = await alerter(signauxSondes({ aNotifier, muettes }, etat)); } catch (e) { envoi = { fait: false, erreur: String((e && e.message) || e).slice(0, 120) }; }
  } else if (aNotifier.length) {
    const notif = texteIncident(aNotifier, etat);
    if (!proprietaire || typeof envoyer !== 'function') envoi = { envoye: false, raison: 'VRM_OWNER_UID absent : personne à prévenir' };
    else { try { envoi = { envoye: true, r: await envoyer(notif) }; } catch (e) { envoi = { envoye: false, erreur: String((e && e.message) || e).slice(0, 120) }; } }
  }
  return { fait: true, etats: resume, ouverts: aNotifier, muettes, envoi, incidentsOuverts: COMPOSANTS.filter((c) => etat.composants[c].incident) };
}
