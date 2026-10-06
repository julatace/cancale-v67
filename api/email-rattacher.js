// ── /api/email-rattacher ──────────────────────────────────────────────────────
// Rejoue un email mis en QUARANTAINE (adresse de réception inconnue, ou
// plusieurs vendeurs destinataires) au profit du vendeur qui le réclame.
//   POST { id, silencieux? }     → rejoue CET email chez le vendeur connecté
//   GET  ?mode=liste             → les emails que CE vendeur peut réclamer
//                                  (scalaires seulement : id, sujet, raison, date)
//                                  + au SEUL propriétaire de l'installation :
//                                  le NOMBRE de ceux que personne ne peut
//                                  réclamer, et si le repli joue encore
//
// Pourquoi ça existe : la règle d'attribution refuse de deviner (voir
// api/_lib/proprietaire-email.js). Sans ce bouton, un email non reconnu serait
// conservé mais inexploitable — donc perdu en pratique.
//
// ⚠️ QUI PEUT RÉCLAMER : seulement quelqu'un qui prouve son identité, en
// présentant le jeton de sa session (celui de l'app). On le vérifie auprès de
// Supabase avant toute chose — sinon n'importe qui pourrait s'attribuer les
// emails d'un autre vendeur, ce qui serait pire que le problème d'origine.
//
// ⚠️⚠️ ET QUOI : base cloisonnée, un email mis de côté vit sous le propriétaire
// NEUTRE (personne ne le voit sous RLS — api/_lib/proprietaire-email.js). Un
// vendeur ne le récupère que si l'adresse où il est ARRIVÉ est une adresse que
// LUI a déclarée et que personne d'autre n'a déclarée (`peutReclamer`, la règle
// d'arrivée rejouée avec le registre d'aujourd'hui — §11). Une identité, jamais
// le contenu de l'email. Les lignes d'avant (rangées sous son propre compte)
// restent à lui.
// ⚠️ « Pas su » n'est jamais « rien » ni « déjà rattaché » : toute lecture
// ratée (ligne, registre, liste) répond 503.
import { traiterEmail, lireRegistreEmails } from './email-inbound.js';
import { contexteVendeur, withOwnerAll, conflictTarget } from './_lib/owner.js';
import { PROPRIETAIRE_NEUTRE, peutReclamer, pourquoiPersonne, repliInstallation } from './_lib/proprietaire-email.js';
import { sbCle } from './_lib/cle.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const ANON = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const SERVICE = process.env.SUPABASE_SERVICE_KEY || ANON;
const HEADERS = { ...sbCle(SERVICE) };
const NEUTRE = PROPRIETAIRE_NEUTRE;
const enc = encodeURIComponent;

// Le jeton présenté appartient-il vraiment à quelqu'un ? Supabase répond.
async function vendeurDuJeton(jeton) {
  if (!jeton) return '';
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${jeton}` },
    });
    if (!r.ok) return '';
    const j = await r.json();
    const id = String((j && j.id) || '');
    // Le propriétaire neutre n'est la session de personne (Supabase n'émet pas
    // d'identifiant nul) — mais on ne laisse pas une réponse étrange l'ouvrir.
    return id === NEUTRE ? '' : id;
  } catch (_) { return ''; }
}
const jetonDe = (req) => String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '').replace(/^Bearer\s+/i, '');
const indispo = (res) => res.status(503).json({ ok: false, error: 'base-injoignable', message: "Le serveur de données ne répond pas — rien n'est perdu, réessaie." });

// Lit TOUTES les lignes d'une requête, page par page (§4.5 : Supabase coupe à
// 1 000 lignes sans le dire). Rend `{ rows }`, ou `null` si la base n'a pas
// répondu OU a refusé la requête.
// ⚠️ Une page ratée rend `null` : une demi-liste a l'air d'une réponse.
// ⚠️ Un 400 n'est PLUS lu « colonne `owner` absente » : sur une requête
//    composée il peut venir de n'importe quel filtre (une colonne `meta`
//    absente, un motif refusé), et le lire « une seule boutique » faisait relire
//    la quarantaine SANS filtre de vendeur. La forme de la base se mesure à part
//    (`sondeCloisonnee`).
async function lirePages(requete, compte) {
  const PAGE = 500, rows = [];
  for (let debut = 0; debut < 50 * PAGE; debut += PAGE) {
    let r;
    try {
      if (compte) compte.n++;
      r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?${requete}&order=id.asc`, {
        headers: { ...HEADERS, 'Range-Unit': 'items', Range: `${debut}-${debut + PAGE - 1}` },
      });
    } catch (_) { return null; }
    if (!r.ok) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    if (!Array.isArray(j)) return null;
    rows.push(...j);
    if (j.length < PAGE) return { rows };
  }
  return null;   // au-delà de 25 000 lignes : on ne prétend pas avoir tout lu
}

// La base sait-elle séparer les vendeurs ? 200 = oui · 400 = colonne `owner`
// absente (une seule boutique) · le reste = pas su. Seul un « oui » se
// mémorise : une colonne ne disparaît pas, une panne si.
let _cloisonnee = false;
async function sondeCloisonnee() {
  if (_cloisonnee) return true;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: HEADERS });
    if (r.ok) { _cloisonnee = true; return true; }
    if (r.status === 400) return false;
    return null;
  } catch (_) { return null; }
}

// ── LES CANDIDATS, JAMAIS LE TAS ENTIER ──────────────────────────────────────
// ⚠️⚠️ La liste relisait TOUT le tas neutre à chaque appel, pour chaque vendeur :
//    au-delà de 25 000 lignes (un spammeur suffit) elle répondait 503 à TOUT LE
//    MONDE — y compris pour leurs propres lignes. On ne lit plus que les lignes
//    neutres dont la liste des destinataires CONTIENT une adresse déclarée par
//    CE vendeur (le filtre tourne dans la base, sur `meta`, sans décompresser
//    l'email — §4.4). Le motif est un TAMIS, jamais une décision : chaque
//    candidat est jugé ensuite par `peutReclamer`, exactement comme la
//    réclamation (§11). Un tamis trop large coûte une ligne lue de plus ; un
//    tamis trop étroit cacherait un email à son vendeur — d'où l'étiquette « + »
//    et les adresses trop longues pour `meta` (cherchées dans `data->adresses`).
const morceauSur = (x) => String(x).split(/["\\]/).sort((p, q) => q.length - p.length)[0] || '';
function motifsDe(a) {
  const sur = !/["\\]/.test(a);
  const out = [sur ? `*"${a}"*` : `*${morceauSur(a)}*`];
  const i = a.indexOf('@');
  // Une adresse arrivée avec une étiquette (« recu+vinted@ ») retombe sur
  // « recu@ » quand celle-ci est déclarée (la même règle qu'à l'arrivée).
  if (i > 0 && !a.slice(0, i).includes('+')) {
    out.push(sur ? `*"${a.slice(0, i)}+*${a.slice(i)}"*` : `*${morceauSur(a.slice(i))}*`);
  }
  return out;
}
// Une valeur dans un `or=(…)` de PostgREST : entre guillemets, `\` et `"` échappés.
const valeurOu = (v) => '"' + String(v).replace(/[\\"]/g, '\\$&') + '"';
const CHAMPS = 'id,sujet:meta->>subject,raison:meta->>raison,quand:meta->>at';
const VIVANTES = 'id=like.email_quarantaine_*&meta->>supprime=is.null';
async function candidatsDe(owner, registre, compte) {
  const mes = Object.keys(registre || {}).filter((a) => registre[a] === owner);
  if (!mes.length) return [];
  const motifs = [...new Set(mes.flatMap(motifsDe))];
  const vus = new Map();
  for (let i = 0; i < motifs.length; i += 8) {
    const lot = motifs.slice(i, i + 8);
    const ou = (col) => enc('(' + lot.map((m) => `${col}.ilike.${valeurOu(m)}`).join(',') + ')');
    const courts = await lirePages(`${VIVANTES}&owner=eq.${NEUTRE}&or=${ou('meta->>destinataires')}&select=${CHAMPS},adresses:data->adresses`, compte);
    if (!courts) return null;
    // Les adresses trop longues pour `meta` : la ligne n'a pas de
    // `destinataires`, on cherche dans `data->adresses` — sur ces lignes-là seules.
    const longs = await lirePages(`${VIVANTES}&owner=eq.${NEUTRE}&meta->>destinataires=is.null&or=${ou('data->>adresses')}&select=${CHAMPS},adresses:data->adresses`, compte);
    if (!longs) return null;
    for (const x of [...courts.rows, ...longs.rows]) vus.set(x.id, x);
  }
  return [...vus.values()];
}

// La quarantaine lisible par CE vendeur : la sienne (lignes d'avant) et celles
// du propriétaire neutre dont l'adresse d'arrivée est À LUI. Rend
// `{ emails, cloisonnee, lu }` ou `null` (pas su).
async function emailsReclamables(owner, compte) {
  const cl = await sondeCloisonnee();
  if (cl === null) return null;
  if (!cl) {
    // Base sans colonne `owner` : une seule boutique, la liste d'avant.
    const toutes = await lirePages(`${VIVANTES}&select=${CHAMPS}`, compte);
    return toutes ? { emails: toutes.rows, cloisonnee: false } : null;
  }
  const siennes = await lirePages(`${VIVANTES}&owner=eq.${enc(owner)}&select=${CHAMPS}`, compte);
  if (!siennes) return null;
  const lu = await lireRegistreEmails(true);
  if (!lu) return null;
  const candidats = await candidatsDe(owner, lu.registre, compte);
  if (!candidats) return null;
  // ⚠️ JUGÉ EXACTEMENT COMME LA RÉCLAMATION : `peutReclamer` sur `data.adresses`
  //    (la même valeur que le POST relit). Avant, la liste découpait
  //    `destinataires` sur les espaces et proposait des emails que le POST
  //    refusait (404) — le rattrapage les retentait à chaque ouverture.
  const aLui = candidats.filter((x) => peutReclamer(Array.isArray(x.adresses) ? x.adresses : [], lu.registre, lu.conflits, owner));
  return { emails: [...siennes.rows, ...aLui.map(({ adresses, ...reste }) => reste)], cloisonnee: true, lu };
}

// ── CE QUE PERSONNE NE PEUT RÉCLAMER — LE NOMBRE, AU SEUL PROPRIÉTAIRE ────────
// ⚠️⚠️ Julien n'a déclaré AUCUNE adresse (mesuré le 6 octobre). Dès qu'un AUTRE
//    compte en déclare une (un second vendeur, ou son propre compte d'essai), le
//    repli « installation » s'éteint, et tout ce qui arrive sur ses adresses non
//    déclarées part sous le propriétaire neutre. Sa liste rendait `[]`, son POST
//    404, et Réglages affirmait encore que tout lui revenait : l'incident du
//    16 août, rendu INVISIBLE. On lui rend donc le NOMBRE — jamais le contenu,
//    jamais le sujet, jamais une adresse : ce tas peut contenir les emails d'un
//    autre vendeur — avec la cause, pour que l'écran dise le geste.
// Borné : au plus 5 pages de 1 000 lignes (« au moins » au-delà), en
// scalaires (`meta`, jamais l'email). Une page ratée ⇒ `null` (« pas su »),
// jamais zéro.
const PAGE_COMPTE = 1000, PAGES_COMPTE = 5, RELUS_MAX = 200;
async function compterPersonne(lu, compte) {
  const causes = {};
  let n = 0, auMoins = false;
  const note = (adresses) => {
    const c = pourquoiPersonne(adresses, lu.registre, lu.conflits);
    if (c) { n++; causes[c] = (causes[c] || 0) + 1; }
  };
  const aRelire = [];
  for (let p = 0; p < PAGES_COMPTE; p++) {
    let r;
    try {
      compte.n++;
      r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?${VIVANTES}&owner=eq.${NEUTRE}&select=id,dest:meta->>destinataires&order=id.asc`, {
        headers: { ...HEADERS, 'Range-Unit': 'items', Range: `${p * PAGE_COMPTE}-${(p + 1) * PAGE_COMPTE - 1}` },
      });
    } catch (_) { return null; }
    if (!r.ok) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    if (!Array.isArray(j)) return null;
    for (const x of j) {
      // `destinataires` est la liste JSON des adresses — la même que
      // `data.adresses`. Absente (trop longue) ou d'une autre forme : on relit
      // les adresses seules, jamais l'email.
      let adr = null;
      if (typeof x.dest === 'string' && x.dest.startsWith('[')) { try { const v = JSON.parse(x.dest); if (Array.isArray(v)) adr = v; } catch (_) {} }
      if (adr) note(adr); else aRelire.push(x.id);
    }
    if (j.length < PAGE_COMPTE) break;
    if (p === PAGES_COMPTE - 1) auMoins = true;
  }
  for (let i = 0; i < aRelire.length; i += 50) {
    if (i >= RELUS_MAX) { auMoins = true; break; }
    const lot = await lirePages(`id=in.(${aRelire.slice(i, i + 50).map(enc).join(',')})&owner=eq.${NEUTRE}&select=id,adresses:data->adresses`, compte);
    if (!lot) return null;
    for (const x of lot.rows) note(Array.isArray(x.adresses) ? x.adresses : []);
  }
  return { n, auMoins, causes };
}

async function lister(req, res) {
  const owner = await vendeurDuJeton(jetonDe(req));
  if (!owner) { res.status(401).json({ ok: false, error: 'connexion requise' }); return; }
  const compte = { n: 0 };
  const lu = await emailsReclamables(owner, compte);
  if (!lu) { indispo(res); return; }
  const emails = lu.emails.slice().sort((a, b) => String(b.quand || '').localeCompare(String(a.quand || '')));
  const corps = { ok: true, emails, cloisonnee: lu.cloisonnee };
  // ⚠️ Au SEUL propriétaire de l'installation (VRM_OWNER_UID), et seulement sur
  //    une base cloisonnée (sinon rien n'est jamais mis de côté). Un autre
  //    vendeur ne reçoit ni ce nombre, ni ce booléen.
  const proprio = String(process.env.VRM_OWNER_UID || '').trim();
  if (lu.cloisonnee && proprio && owner === proprio) {
    corps.installation = {
      // Le repli joue-t-il encore ? Réglages en tire sa phrase, au lieu
      // d'affirmer que tout revient au propriétaire de l'installation.
      repli: repliInstallation(lu.lu.registre, proprio),
      personne: await compterPersonne(lu.lu, compte),
    };
  }
  res.status(200).json(corps);
}

// La ligne demandée, si CE vendeur a le droit de la rejouer.
// Rend `{ ligne, proprio, cloisonnee }`, `{ absente: true }` ou `null` (pas su).
async function ligneReclamable(id, owner) {
  const lire = async (filtre) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${enc(id)}${filtre}&select=data`, { headers: HEADERS });
      if (r.status === 400) return { status: 400 };
      if (!r.ok) return null;
      const j = await r.json();
      return Array.isArray(j) ? { data: (j[0] && j[0].data) || null } : null;
    } catch (_) { return null; }
  };
  // 1. La sienne (une ligne d'avant le propriétaire neutre).
  const sienne = await lire(`&owner=eq.${enc(owner)}`);
  if (!sienne) return null;
  if (sienne.status === 400) {
    // Base sans colonne `owner` (une seule boutique) : comme avant.
    const une = await lire('');
    if (!une || une.status) return null;
    return une.data ? { ligne: une.data, proprio: '', cloisonnee: false } : { absente: true };
  }
  if (sienne.data) return { ligne: sienne.data, proprio: owner, cloisonnee: true };
  // 2. Celle du propriétaire neutre, si son adresse d'arrivée est à LUI.
  const neutre = await lire(`&owner=eq.${NEUTRE}`);
  if (!neutre || neutre.status) return null;
  if (!neutre.data) return { absente: true };
  const lu = await lireRegistreEmails(true);
  if (!lu) return null;
  // ⚠️ Pas à lui ⇒ « introuvable », comme un identifiant qui n'existe pas : on
  //    ne dit même pas qu'un email de quelqu'un d'autre se trouve là.
  if (!peutReclamer(neutre.data.adresses, lu.registre, lu.conflits, owner)) return { absente: true };
  return { ligne: neutre.data, proprio: NEUTRE, cloisonnee: true };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const mode = String((req.query && req.query.mode) || '');
  if (req.method === 'GET' && mode === 'liste') return lister(req, res);
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const owner = await vendeurDuJeton(jetonDe(req));
  // ⚠️ Rattacher, c'est dire « cet email est À MOI » : sans session prouvée, il
  // n'y a personne à qui le donner. (Avant le cloisonnement on acceptait le
  // rattachement sans jeton ; la base est cloisonnée et l'app n'appelle plus
  // cette route que connectée. Sans jeton, l'appel repartait dans la
  // résolution — et chaque appel créait une copie de plus en quarantaine.)
  if (!owner) { res.status(401).json({ ok: false, error: 'connexion requise' }); return; }
  let corps = {};
  try { corps = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch (_) { res.status(400).json({ ok: false, error: 'corps illisible' }); return; }
  const id = String(corps.id || '');
  if (!/^email_quarantaine_[A-Za-z0-9_-]+$/.test(id)) { res.status(400).json({ error: 'identifiant invalide' }); return; }

  // On relit l'email conservé.
  // ⚠️⚠️ AVEC LA CLÉ DE SERVICE, QUI VOIT TOUS LES VENDEURS. Sans filtre,
  // n'importe quel vendeur connecté pouvait faire rejouer CHEZ LUI l'email mis
  // de côté d'un autre (bordereau, adresse, acheteur) en donnant son
  // identifiant. On ne lit que SA ligne, ou une ligne neutre dont l'adresse
  // d'arrivée est à lui (`ligneReclamable`).
  // ⚠️ Et une lecture ratée n'est pas « déjà rattaché » : c'est un 503.
  const trouve = await ligneReclamable(id, owner);
  if (!trouve) { indispo(res); return; }
  const ligne = trouve.ligne;
  // Une ligne déjà rejouée est VIDÉE (`supprime`) : la rejouer créerait un
  // « email inconnu » vide de plus.
  if (!ligne || ligne.supprime) { res.status(404).json({ error: 'email introuvable (déjà rattaché ?)' }); return; }

  // Rejeu : exactement le même traitement que si l'email venait d'arriver, mais
  // avec le propriétaire imposé. `__ownerForce` est posé ici, côté serveur.
  const faux = {
    method: 'POST', query: { key: process.env.EMAIL_INBOUND_SECRET || '' }, headers: {},
    body: { from: ligne.from, to: ligne.to, subject: ligne.subject, text: ligne.text, html: ligne.html },
    __ownerForce: owner,
    // ⚠️ LA DATE D'ORIGINE, PAS CELLE DU REJEU. Sans ça, un email d'il y a six
    //    jours ressort daté d'aujourd'hui : le colis afficherait « arrivé le 22 »
    //    alors qu'il attend depuis le 17, et la fenêtre d'ancienneté serait fausse.
    __recuLe: ligne.at || null,
  };
  let resultat = null;
  const capture = { setHeader() {}, status() { return this; }, json(o) { resultat = o; return this; } };
  // `silencieux` : rejeu en lot → on ne renotifie pas. Isolé par requête.
  await contexteVendeur.run({ owner: owner || '', silence: !!corps.silencieux }, () => traiterEmail(faux, capture));

  // Rattaché avec succès → la ligne de quarantaine n'a plus lieu d'être.
  // ⚠️ On ne supprime QUE si le traitement a réellement abouti : sinon on
  // détruirait le seul exemplaire de l'email.
  if (resultat && resultat.ok && !resultat.quarantaine) {
    // ⚠️⚠️ LE `DELETE` SUR `app_data` EST SANS EFFET AVEC LA CLÉ PUBLIQUE
    // (200 / 0 ligne supprimée — §5.22). Mesuré le 22 août : **593 lignes de
    // quarantaine toujours là** après le rejeu, que le rattrapage automatique
    // reprenait à chaque ouverture d'Achats. On VIDE donc aussi la ligne (un
    // upsert, lui, passe), et les listes ignorent ce qui porte `supprime`.
    // ⚠️ Chez SON propriétaire (le vendeur, ou le neutre) : jamais une copie
    // vide de plus chez celui de l'installation.
    const leSien = trouve.cloisonnee ? `&owner=eq.${enc(trouve.proprio)}` : '';
    const vide = { id, data: { supprime: true, rejoueLe: new Date().toISOString(), type: resultat.type || 'traité' } };
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${enc(id)}${leSien}`, { method: 'DELETE', headers: HEADERS });
    } catch (_) {}
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${trouve.cloisonnee ? 'owner,id' : conflictTarget('id')}`, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(trouve.cloisonnee ? [{ owner: trouve.proprio, ...vide }] : withOwnerAll([vide])),
      });
    } catch (_) {}
  }
  res.status(200).json({ ok: !!(resultat && resultat.ok), owner: owner || null, resultat });
}
