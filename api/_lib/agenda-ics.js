// ═══════════════════════════════════════════════════════════════════════════
// « ÉCHÉANCES DANS L'AGENDA » — un lien d'abonnement .ics (10 nov., lot H)
// ═══════════════════════════════════════════════════════════════════════════
// Calendrier iPhone / Google Agenda s'abonnent à `webcal://vrm.center/agenda/<jeton>.ics`
// (vercel.json réécrit vers `/api/compte?mode=agenda&f=<jeton>.ics` : AUCUNE
// fonction `api/` neuve, 12 au plus). Le calendrier relit tout seul (~1 h).
//
// CE QUI Y EST — seulement des dates LUES, jamais une estimation :
//   · la déclaration URSSAF : la règle existante (`nextUrssafDeadline`,
//     api/_lib/urssaf-regle.js), micro-entrepreneur seulement, période déjà
//     notée « déclarée » ⇒ rien ; JAMAIS le montant ;
//   · les dates limites d'envoi LUES dans l'e-mail du bordereau
//     (api/_lib/limite-envoi.js) : l'app PUBLIE la liste (`vrm_agenda_envoi`,
//     src/agendaEcheances.js — §11, l'écran qui a toutes les sources publie) ;
//     une date ESTIMÉE (vente + 7 j) n'y entre pas ;
//   · les retraits qui expirent : la date limite LUE de la liste que l'app publie
//     déjà (`vrm_colis_retirer.colis`, [0] limite · [2] transporteur · [6] heure) ;
//     un colis sans date lue n'y entre pas.
// RIEN DE PERSONNEL au-delà de « Colis N°12 à déposer avant 10 h » : ni titre
// d'annonce, ni pseudo, ni montant, ni code de retrait, ni lieu, ni n° de suivi
// (l'UID d'un retrait est une EMPREINTE de son identité).
//
// LE JETON : propre au vendeur, 32 octets aléatoires, rangé dans SA ligne
// `vrm_agenda` (`data.jeton`) et indexé par son empreinte chez le propriétaire
// neutre (api/_lib/jeton-index.js, genre `agenda`). Régénérer ⇒ l'ancien lien
// meurt ; couper ⇒ plus aucun lien. Le jeton n'est créé, changé ou coupé QUE par
// le serveur, sur la session du vendeur (POST).
// Trois états : une lecture ratée ⇒ 503 (le calendrier garde sa dernière copie),
// jamais un calendrier vide servi pour « rien ».
// Tenu par scripts/audit-agenda-appareil.cjs (EXÉCUTE api/compte.js).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { nextUrssafDeadline, moisPeriodeUrssaf, moisDeclare } from './urssaf-regle.js';
import { heureCourte } from './limite-envoi.js';
import { evenementsRappels } from './rappels-perso.js';
import { vendeurParIndex, ecrireIndexJeton, retirerIndexJeton, memeJeton } from './jeton-index.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

export const LIGNE_AGENDA = 'vrm_agenda';
export const RE_JETON_AGENDA = /^[A-Za-z0-9_-]{40,64}$/;
export const nouveauJetonAgenda = () => crypto.randomBytes(32).toString('base64url');
// `abc….ics` ou `abc…` ⇒ le jeton ; autre chose ⇒ ''.
export function jetonDuFichier(f) {
  const s = String(f == null ? '' : f).trim().replace(/\.ics$/i, '');
  return RE_JETON_AGENDA.test(s) ? s : '';
}
export const urlAgenda = (jeton, origine = 'https://vrm.center') => (jeton ? `${origine}/agenda/${jeton}.ics` : '');
export const webcalDe = (url) => String(url || '').replace(/^https?:\/\//i, 'webcal://');

// Les seules clés de `main` lues (§4.4 : jamais `select=data`).
export const SELECT_MAIN_AGENDA = 'regime:data->>vinted_regime,freq:data->>vinted_urssaf_freq,declare:data->vrm_urssaf_declare,envoi:data->vrm_agenda_envoi,retirer:data->vrm_colis_retirer->colis,retirerAt:data->vrm_colis_retirer->at,rappels:data->vrm_rappels';

const NOMS_TRANSPORTEUR = { mondialrelay: 'Mondial Relay', vinted: 'Vinted Go', vintedgo: 'Vinted Go', chronopost: 'Chronopost', colissimo: 'Colissimo', relaiscolis: 'Relais Colis', ups: 'UPS', dpd: 'DPD', gls: 'GLS', inpost: 'InPost', laposte: 'La Poste' };
const nomTransporteur = (t) => NOMS_TRANSPORTEUR[String(t || '').toLowerCase().replace(/[\s_-]/g, '')] || '';
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const RE_NUM = /^[A-Za-z]?\d{1,6}$/;
const empreinte = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 24);
const pad = (n) => String(n).padStart(2, '0');
const jourIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 'AAAA-MM-JJ' du jour à Paris.
export function jourParisDe(ms) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date(ms));
}
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jourCourt = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MOIS[m - 1]}`; };

// Les échéances, PURES. `main` = la projection (SELECT_MAIN_AGENDA). Rend une
// liste d'événements { uid, type, titre, jour, at?, note }.
//   · `at` (ms) : l'heure LUE de la limite ⇒ événement à l'heure ;
//   · sans `at` : journée entière.
export function echeancesAgenda(main, maintenant = Date.now()) {
  const m = main && typeof main === 'object' ? main : {};
  const out = [];
  const aujourdhui = jourParisDe(maintenant);
  const hier = jourParisDe(maintenant - 86400000);

  // 1. URSSAF — micro-entrepreneur seulement, le régime n'est jamais deviné.
  if (m.regime === 'micro') {
    const freq = m.freq === 'mensuel' ? 'mensuel' : 'trimestriel';
    const declare = m.declare && typeof m.declare === 'object' ? m.declare : {};
    const [y, mo, d] = aujourdhui.split('-').map(Number);
    let now = new Date(y, mo - 1, d, 12);
    for (let i = 0; i < 2; i++) {
      const due = nextUrssafDeadline(freq, now);
      if (!due) break;
      const yms = moisPeriodeUrssaf(due);
      if (!(yms.length && yms.every((ym) => moisDeclare(declare, ym)))) {
        const jour = jourIso(due.dueDate);
        out.push({ uid: `urssaf-${jour}`, type: 'urssaf', titre: `Déclaration URSSAF ${due.label}`, jour, note: 'À déclarer et payer sur autoentrepreneur.urssaf.fr.' });
      }
      now = new Date(due.dueDate.getFullYear(), due.dueDate.getMonth(), due.dueDate.getDate() + 1, 12);
    }
  }

  // 2. Dates limites d'envoi LUES (publiées par l'app : [N°, jour, heure, at]).
  const env = m.envoi && typeof m.envoi === 'object' && Array.isArray(m.envoi.colis) ? m.envoi : null;
  const vuEnvoi = env && Number(env.at) > 0 ? jourCourt(jourParisDe(Number(env.at))) : '';
  if (env) for (const c of env.colis) {
    if (!Array.isArray(c)) continue;
    const num = RE_NUM.test(String(c[0] || '')) ? String(c[0]).toUpperCase() : '';
    const jour = RE_JOUR.test(String(c[1] || '')) ? String(c[1]) : '';
    if (!jour || jour < hier) continue;                  // passée depuis plus d'un jour : plus utile
    const at = Number(c[3]);
    const H = /^\d{2}:\d{2}$/.test(String(c[2] || '')) && Number.isFinite(at) && at > 0 ? heureCourte(String(c[2])) : '';
    const titre = `Colis${num ? ' N°' + num : ''} à déposer${H ? ' avant ' + H : ''}`;
    out.push({ uid: `envoi-${num || empreinte(jour + ':' + c[3])}-${jour}`, type: 'envoi', titre, jour, ...(H ? { at } : {}), note: `Date limite lue dans l'e-mail du bordereau${vuEnvoi ? ` · vu dans VRM le ${vuEnvoi}` : ''}.` });
  }

  // 3. Retraits : la date limite LUE de la liste publiée `vrm_colis_retirer`.
  const vuRetrait = Number(m.retirerAt) > 0 ? jourCourt(jourParisDe(Number(m.retirerAt))) : '';
  if (Array.isArray(m.retirer)) for (const c of m.retirer) {
    if (!Array.isArray(c)) continue;
    const jour = RE_JOUR.test(String(c[0] || '')) ? String(c[0]) : '';
    if (!jour || jour < aujourdhui) continue;            // sans date lue, ou passée : rien
    const ident = typeof c[3] === 'string' && c[3] ? c[3] : '';
    const t = typeof c[6] === 'string' && c[6] ? Date.parse(c[6]) : NaN;
    const at = Number.isFinite(t) && jourParisDe(t) === jour ? t : null;
    const tr = nomTransporteur(c[2]);
    out.push({ uid: `retrait-${empreinte(ident || jour + ':' + c[1])}`, type: 'retrait', titre: `Colis à retirer${tr ? ' · ' + tr : ''}`, jour, ...(at ? { at } : {}), note: `Dernier jour lu pour le retirer${vuRetrait ? ` · vu dans VRM le ${vuRetrait}` : ''}.` });
  }
  // 4. (11 nov.) Les rappels qu'IL a posés (« Me le rappeler », api/_lib/rappels-perso.js) :
  //    « Rappel · N°124 · sa note », à 9 h, l'alarme à l'heure. Ni titre d'annonce, ni acheteur.
  try { out.push(...evenementsRappels(m.rappels, maintenant)); } catch (_) { /* un rappel illisible n'empêche pas l'agenda */ }
  return out.sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0));
}

// ── Le fichier iCalendar (RFC 5545) ─────────────────────────────────────────
const echap = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Une ligne de plus de 75 octets se replie (CRLF + espace), sans couper un caractère.
function plier(ligne) {
  const b = Buffer.from(ligne, 'utf8');
  if (b.length <= 75) return ligne;
  const morceaux = []; let cur = ''; let n = 0;
  for (const ch of ligne) {
    const l = Buffer.byteLength(ch, 'utf8');
    if (n + l > (morceaux.length ? 74 : 75)) { morceaux.push(cur); cur = ''; n = 0; }
    cur += ch; n += l;
  }
  morceaux.push(cur);
  return morceaux.join('\r\n ');
}
export function fichierIcs(evenements, maintenant = Date.now()) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VRM//Echeances//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:VRM · Échéances', 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const stamp = utc(maintenant);
  for (const e of evenements || []) {
    L.push('BEGIN:VEVENT', `UID:${e.uid}@vrm.center`, `DTSTAMP:${stamp}`);
    if (e.at) {
      L.push(`DTSTART:${utc(e.at - 30 * 60000)}`, `DTEND:${utc(e.at)}`);
    } else {
      const [y, m, d] = e.jour.split('-').map(Number);
      const lendemain = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
      L.push(`DTSTART;VALUE=DATE:${e.jour.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${lendemain.replace(/-/g, '')}`);
    }
    L.push(`SUMMARY:${echap(e.titre)}`, `DESCRIPTION:${echap(e.note || '')}`, 'TRANSP:TRANSPARENT');
    // Le rappel : 2 h avant une heure lue ; la veille à 9 h pour une journée entière.
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${echap(e.titre)}`, `TRIGGER:${/^-PT\d{1,3}[HM]$/.test(String(e.alarme || '')) ? e.alarme : e.at ? '-PT2H' : '-PT15H'}`, 'END:VALARM', 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(plier).join('\r\n') + '\r\n';
}

// ── La route ────────────────────────────────────────────────────────────────
// `deps` : { base, cle (service), fetch, methode, fichier, user ({id}|null), corps, origine, acces(owner) }
//   GET  + fichier (sans session) ⇒ le calendrier ;
//   GET  + session                ⇒ { ok, actif, url } ;
//   POST + session { action: 'creer' | 'regenerer' | 'couper' }.
// Rend { status, type: 'ics'|'json'|'texte', body }.
export async function traiterAgenda(deps) {
  const { base, cle, methode } = deps;
  const f = deps.fetch || fetchAvecDelai;
  const origine = deps.origine || 'https://vrm.center';
  if (!cle) return { status: 503, type: 'json', body: { erreur: 'non-configure', message: "L'agenda n'est pas encore branché sur le serveur." } };
  const headers = { apikey: cle, Authorization: `Bearer ${cle}` };

  // 1. Le calendrier, par le jeton seul.
  if (deps.fichier != null) {
    if (methode !== 'GET') return { status: 405, type: 'texte', body: 'GET seulement' };
    const jeton = jetonDuFichier(deps.fichier);
    if (!jeton) return { status: 404, type: 'texte', body: 'Lien inconnu.' };
    const v = await vendeurParIndex({ url: base, headers, fetcher: f, genre: 'agenda', jeton });
    if (v === undefined) return { status: 503, type: 'texte', body: 'Réessaie dans un instant.' };
    if (v.etat !== 'trouve') return { status: 404, type: 'texte', body: 'Ce lien a été coupé ou remplacé.' };
    if (deps.acces && (await deps.acces(v.owner)) === false) return { status: 403, type: 'texte', body: 'Abonnement arrêté.' };
    let main;
    try {
      const r = await f(`${base}/rest/v1/app_data?owner=eq.${encodeURIComponent(v.owner)}&id=eq.main&select=${SELECT_MAIN_AGENDA}&limit=1`, { headers });
      if (!r || !r.ok) return { status: 503, type: 'texte', body: 'Réessaie dans un instant.' };
      const j = await r.json();
      if (!Array.isArray(j)) return { status: 503, type: 'texte', body: 'Réessaie dans un instant.' };
      main = j[0] || {};
    } catch (_) { return { status: 503, type: 'texte', body: 'Réessaie dans un instant.' }; }
    const maintenant = deps.maintenant || Date.now();
    return { status: 200, type: 'ics', body: fichierIcs(echeancesAgenda(main, maintenant), maintenant) };
  }

  // 2. Le réglage, sur SA session (l'identifiant vient du jeton vérifié).
  const user = deps.user;
  if (!user || !/^[0-9a-f-]{36}$/i.test(String(user.id || ''))) return { status: 401, type: 'json', body: { erreur: 'session' } };
  const lireLigne = async () => {
    try {
      const r = await f(`${base}/rest/v1/app_data?owner=eq.${user.id}&id=eq.${LIGNE_AGENDA}&select=t:data->>jeton&limit=1`, { headers });
      if (!r || !r.ok) return undefined;
      const j = await r.json();
      if (!Array.isArray(j)) return undefined;
      return j[0] && j[0].t ? String(j[0].t) : '';
    } catch (_) { return undefined; }
  };
  const ecrireLigne = async (jeton) => {
    try {
      const now = new Date().toISOString();
      const r = await f(`${base}/rest/v1/app_data?on_conflict=owner,id`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ owner: user.id, id: LIGNE_AGENDA, data: { jeton, at: now }, updated_at: now }]),
      });
      return !!(r && r.ok);
    } catch (_) { return false; }
  };
  const reponse = (jeton) => ({ status: 200, type: 'json', body: { ok: true, actif: !!jeton, url: jeton ? urlAgenda(jeton, origine) : '' } });
  const actuel = await lireLigne();
  if (actuel === undefined) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Réessaie dans un instant.' } };
  if (methode === 'GET') return reponse(actuel);
  if (methode !== 'POST') return { status: 405, type: 'json', body: { erreur: 'GET ou POST' } };
  const action = String((deps.corps && deps.corps.action) || '');
  if (!['creer', 'regenerer', 'couper'].includes(action)) return { status: 400, type: 'json', body: { erreur: 'action' } };
  if (action === 'creer' && actuel) {
    await ecrireIndexJeton({ url: base, headers, fetcher: f, genre: 'agenda', jeton: actuel, owner: user.id });
    return reponse(actuel);
  }
  const neuf = action === 'couper' ? '' : nouveauJetonAgenda();
  // L'ordre : la ligne d'abord (elle fait foi : un index sans elle est refusé),
  // puis l'index du nouveau, puis l'ancien retiré. Une écriture ratée ⇒ 503.
  if (!(await ecrireLigne(neuf))) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a changé. Réessaie dans un instant.' } };
  if (neuf && !(await ecrireIndexJeton({ url: base, headers, fetcher: f, genre: 'agenda', jeton: neuf, owner: user.id }))) {
    return { status: 503, type: 'json', body: { erreur: 'base', message: 'Réessaie dans un instant.' } };
  }
  if (actuel && !memeJeton(actuel, neuf)) await retirerIndexJeton({ url: base, headers, fetcher: f, genre: 'agenda', jeton: actuel });
  return reponse(neuf);
}
