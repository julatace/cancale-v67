// ── LE CODE DE RETRAIT ET LE QR D'UN COLIS, RELIÉS PAR IDENTITÉ (5 nov.) ─────
// Julien (5 nov.) : « relier le code de retrait et le QR code, pour aller
// beaucoup plus vite aux retraits » ; « quand il se connecte à son compte
// Mondial Relay, l'extension capte TOUS les colis arrivés avec leurs QR » ;
// « une personne peut avoir plusieurs comptes Mondial Relay, et des colis
// arrivés par e-mail peuvent ne pas figurer dans le compte Mondial Relay ».
//
// Mesuré dans sa base le 5 nov. (lecture seule, comptes seulement) :
//   · Mondial Relay : 57 e-mails « disponible », 55 avec code, 0 QR — le QR
//     Mondial Relay n'est JAMAIS dans l'e-mail (il vit dans son compte) ;
//   · Vinted Go : 25 « disponible », 25 code ET QR (`p.vintedgo.com/…/qr_codes`) ;
//   · Chronopost : 11 « disponible », 7 code, 9 vrais QR (Pickup Pass), 6 les deux ;
//   · conversations Vinted (`panel_colis_relais`) : 33 colis, 16 codes, 0 QR ;
//   · les e-mails Mondial Relay arrivent sur 3 adresses différentes (`recuSur`).
//
// Ce module ne DÉCIDE rien sur l'état d'un colis (la règle reste
// `pickupUnion`, api/_lib/suivi-colis.js) : il range ce que l'extension lira
// dans les comptes Mondial Relay (lignes `mr_colis_{compte}`), en fait des
// lignes de suivi de la même forme que celles des e-mails — reliées aux autres
// par le N° DE SUIVI SEULEMENT (§5 : jamais le titre, le lieu ni la date) —, et
// dit, pour un colis, d'où viennent son code et son QR, et où trouver le QR
// qu'on n'a pas. Pur : aucun appel, aucune horloge implicite.

export const MR_PREFIXE = 'mr_colis_';
// Projection (§4.4 : jamais `select=data`) : le QR est petit (une image de
// quelques centaines d'octets en SVG/PNG), la ligne ne porte rien d'autre.
export const MR_SELECT = 'id,v:data->>v,compte:data->compte,luAt:data->>luAt,complet:data->>complet,colis:data->colis';
// La forme rangée par l'extension (docs/passation/2026-11-05-colis-qr.md).
export const MR_VERSION = 1;

const norm = (v) => String(v == null ? '' : v).toUpperCase().replace(/[\s -]+/g, '').trim();
const texte = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const dateIso = (v) => { const s = texte(v, 40); return s && Number.isFinite(Date.parse(s)) ? s : ''; };
// Le même filtre que l'app (`codeRetrait`, App.jsx) : au plus deux lettres devant 3 à 10 chiffres.
export const codeRetraitMr = (v) => { const c = String(v == null ? '' : v).trim().toUpperCase(); return /^[A-Z]{0,2}\d{3,10}$/.test(c) ? c : ''; };
const TYPES_QR = new Set(['image/png', 'image/svg+xml', 'image/gif', 'image/jpeg', 'image/webp']);
// L'état écrit par l'extension ⇒ le statut d'une ligne de suivi (celui des e-mails).
const STATUTS = { en_route: 'transit', disponible: 'available', retire: 'delivered', retour: 'retour' };
const LIBELLES = { transit: 'En route vers le point relais', available: 'Disponible au point relais', delivered: 'Retiré', retour: 'Retourné à l’expéditeur' };

// Un QR rangé : base64 d'une image, d'un type d'image connu, de taille raisonnable.
function qrValide(q) {
  if (!q || typeof q !== 'object') return null;
  const type = texte(q.type, 40).toLowerCase();
  const b64 = typeof q.b64 === 'string' ? q.b64.replace(/\s+/g, '') : '';
  if (!TYPES_QR.has(type) || !b64 || b64.length > 60000 || !/^[A-Za-z0-9+/]+=*$/.test(b64)) return null;
  return { type, b64 };
}

// ── LECTURE : les lignes `mr_colis_*` ⇒ comptes + colis (forme inconnue = ignorée) ──
// `rows` : la réponse de la base (null = pas su). Rend null (pas su), ou
// { comptes, colis, ignores }. Un colis sans n° de suivi, d'un autre sens que
// « à recevoir », ou d'un état inconnu n'entre pas (compté dans `ignores`) :
// sans identité, il ne se relie à rien — mieux vaut un blanc qu'un faux.
export function lireColisMondialRelay(rows) {
  if (!Array.isArray(rows)) return null;
  const comptes = []; const colis = []; let ignores = 0;
  for (const r of rows) {
    if (!r || typeof r !== 'object' || !String(r.id || '').startsWith(MR_PREFIXE)) { ignores++; continue; }
    if (Number(r.v) !== MR_VERSION || !Array.isArray(r.colis)) { ignores++; continue; }
    const cle = String(r.id).slice(MR_PREFIXE.length);
    const c = r.compte && typeof r.compte === 'object' ? r.compte : {};
    const libelle = texte(c.libelle, 80) || texte(c.email, 120) || 'Compte Mondial Relay';
    const luAt = dateIso(r.luAt);
    const compte = { cle, libelle, luAt, complet: String(r.complet) === 'true', n: 0 };
    for (const x of r.colis) {
      if (!x || typeof x !== 'object') { ignores++; continue; }
      const suivi = norm(x.suivi);
      const status = STATUTS[texte(x.etat, 20)];
      if (!/\d/.test(suivi) || suivi.length < 6 || !status || (x.sens && x.sens !== 'entrant')) { ignores++; continue; }
      const qr = qrValide(x.qr);
      colis.push({ suivi, status, code: codeRetraitMr(x.code), qr, lieu: texte(x.lieu, 200) || null, limite: dateIso(x.limite).slice(0, 10) || null,
        arriveLe: dateIso(x.arriveLe) || null, compteCle: cle, compteLibelle: libelle, luAt });
      compte.n++;
    }
    comptes.push(compte);
  }
  comptes.sort((a, b) => (Date.parse(b.luAt) || 0) - (Date.parse(a.luAt) || 0));
  return { comptes, colis, ignores };
}

// ── EN LIGNES DE SUIVI : la forme des e-mails (`email_track_*`) ─────────────
// Pour que TOUTE la règle d'avant (un colis par n°, retiré, reparti, à vérifier,
// date limite) s'applique sans être réécrite (§11). Un même n° lu sur deux
// comptes Mondial Relay = un colis : la lecture la plus récente gagne.
// `emailAt` = la lecture : le compte Mondial Relay est relu « maintenant », son
// code fait foi quand il diffère d'un e-mail plus ancien (`fusionLignesMemeSuivi`).
export function lignesSuiviMondialRelay(mr) {
  if (!mr || !Array.isArray(mr.colis)) return [];
  const parN = new Map();
  for (const c of mr.colis) {
    const prec = parN.get(c.suivi);
    if (prec && (Date.parse(prec.luAt) || 0) >= (Date.parse(c.luAt) || 0)) continue;
    parN.set(c.suivi, c);
  }
  return [...parN.values()].map((c) => ({
    id: `${MR_PREFIXE}${c.compteCle}_${c.suivi}`, source: 'mondialrelay-compte', type: 'suivi', carrier: 'mondialrelay',
    suivi: c.suivi, status: c.status, statusLabel: LIBELLES[c.status], subject: `Colis Mondial Relay ${c.suivi}`,
    code: c.code || null, code2: null, qrB64: c.qr ? c.qr.b64 : null, qrType: c.qr ? c.qr.type : null, qrUrl: null,
    lieu: c.lieu, limite: c.limite, consigne: false, account: '', artTitle: '',
    receivedAt: c.luAt || c.arriveLe || null, emailAt: c.luAt || null, arriveLe: c.arriveLe || null,
    mrCompte: { cle: c.compteCle, libelle: c.compteLibelle, luAt: c.luAt },
  }));
}

// ── LES LIGNES D'E-MAIL ET DES COMPTES MONDIAL RELAY, ENSEMBLE ───────────────
// `tracking` (null = e-mails pas lus) reste null tant qu'aucun compte n'apporte
// rien ; sinon la liste fusionnée, triée du plus récent au plus ancien (l'ordre
// que `pickupUnion` attend). Une ligne d'e-mail du MÊME n° qu'un colis lu dans
// un compte reçoit le nom de ce compte (`mrCompte`) — l'identité est le n°.
// ⚠️ (revue adverse du 5 nov.) CE QUE SEUL L'E-MAIL DU MÊME N° SAIT passe aussi sur la
// ligne du compte : `pickupUnion` ne garde qu'une ligne par n° (la plus complète —
// celle du compte, qui a le QR) et elle effaçait le compte Vinted de l'e-mail
// (`account`), l'adresse qui l'a reçu (`recuSur`), le titre et la date d'arrivée LUE
// (« Arrivé le 4 nov. » devenait « au plus tard le 5 », la date de la lecture).
// L'identité est le n° de suivi, rien d'autre (§5).
export function suivisAvecMondialRelay(tracking, mr) {
  const mrL = lignesSuiviMondialRelay(mr);
  if (!mrL.length) return tracking;
  const parN = new Map(mrL.map((l) => [l.suivi, l.mrCompte]));
  const emailsParN = new Map();
  const emails = (Array.isArray(tracking) ? tracking : []).map((t) => {
    const k = t ? norm(t.suivi) : '';
    if (k && parN.has(k)) { if (!emailsParN.has(k)) emailsParN.set(k, []); emailsParN.get(k).push(t); }
    return k && parN.has(k) && !t.mrCompte ? { ...t, mrCompte: parN.get(k) } : t;
  });
  const quand = (t) => Date.parse((t && (t.receivedAt || t.emailAt)) || '') || 0;
  const mrE = mrL.map((l) => {
    const es = (emailsParN.get(l.suivi) || []).slice().sort((a, b) => quand(b) - quand(a));
    if (!es.length) return l;
    const premier = (f) => { for (const e of es) { const v = f(e); if (v) return v; } return null; };
    const recu = [];
    for (const e of es) for (const a of (Array.isArray(e.recuSur) ? e.recuSur : (e.recuSur ? [e.recuSur] : []))) if (a && !recu.includes(a)) recu.push(a);
    const photo = premier((e) => e.photo);
    return { ...l, aussiEmail: true, account: premier((e) => e.account) || '', artTitle: premier((e) => e.artTitle) || '',
      ...(recu.length ? { recuSur: recu } : {}), ...(photo ? { photo } : {}),
      arriveLe: l.arriveLe || premier((e) => (e.status === 'available' ? dateIso(e.arriveLe) : '')) || null };
  });
  return [...emails, ...mrE].sort((a, b) => quand(b) - quand(a));
}

// Le code d'un e-mail et celui du compte Mondial Relay pour le même n° :
// 'confirme' (les deux disent le même) · 'different' (le compte, relu plus
// tard, fait foi — dit) · '' (une seule source).
export function accordCodes(tracking, suivi) {
  const k = norm(suivi); if (!k || !Array.isArray(tracking)) return '';
  const codesMail = new Set(), codesMr = new Set();
  for (const t of tracking) {
    if (!t || norm(t.suivi) !== k) continue;
    const c = codeRetraitMr(t.code); if (!c) continue;
    (t.source === 'mondialrelay-compte' ? codesMr : codesMail).add(c);
  }
  if (!codesMail.size || !codesMr.size) return '';
  return [...codesMr].every((c) => codesMail.has(c)) ? 'confirme' : 'different';
}
// (revue adverse du 5 nov.) Le code lu dans le compte Mondial Relay pour ce n° ('' sinon) :
// quand les codes diffèrent, l'écran dit QUI fait foi en comparant au code MONTRÉ — la
// fusion garde le plus récent, et un e-mail reçu après la lecture du compte peut l'être.
export function codeDuCompteMr(tracking, suivi) {
  const k = norm(suivi); if (!k || !Array.isArray(tracking)) return '';
  for (const t of tracking) if (t && t.source === 'mondialrelay-compte' && norm(t.suivi) === k) { const c = codeRetraitMr(t.code); if (c) return c; }
  return '';
}

// ── OÙ TROUVER LE QR QU'ON N'A PAS (« QR pas reçu ») ─────────────────────────
// Une phrase par transporteur, jamais une promesse : le QR Mondial Relay vit
// dans son compte (site ou application), jamais dans l'e-mail (55/55 mesurés).
export const QR_OU = {
  mondialrelay: 'Mondial Relay ne met pas le QR dans ses e-mails : il est dans ton compte Mondial Relay (site ou application). Au comptoir, le code suffit.',
  chronopost: 'Dans l’e-mail Chronopost « votre colis vous attend » (Pickup Pass).',
  vinted: 'Dans la conversation Vinted de l’achat, ou l’e-mail Vinted Go.',
  relaiscolis: 'Dans l’e-mail ou l’application Relais Colis.',
  colissimo: 'Colissimo n’envoie pas de QR : l’avis de passage et ta pièce d’identité suffisent.',
  shop2shop: 'Dans l’e-mail Shop2Shop « votre colis est arrivé ».',
};
export const QR_OU_DEFAUT = 'Dans l’e-mail du transporteur, ou la conversation de l’achat.';
export function ouTrouverQr(carrier) { return QR_OU[String(carrier || '').toLowerCase()] || QR_OU_DEFAUT; }

// ── LA FRAÎCHEUR D'UNE LECTURE : « relu il y a 3 min » ───────────────────────
export function ilYa(iso, maintenant) {
  const t = Date.parse(iso || ''); if (!Number.isFinite(t) || !Number.isFinite(maintenant)) return '';
  const s = Math.max(0, Math.round((maintenant - t) / 1000));
  if (s < 60) return 'à l’instant';
  const m = Math.round(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

// ── LE COMPTE D'UN COLIS À RETIRER, QUAND ON LE SAIT ─────────────────────────
// · lu dans un compte Mondial Relay ⇒ ce compte (`mondialrelay`) ;
// · arrivé par e-mail ⇒ l'adresse qui l'a reçu (`email`), et — si tous les
//   comptes Mondial Relay relus sont COMPLETS et qu'aucun ne le porte — « dans
//   aucun compte Mondial Relay » (le cas que Julien a nommé) ;
// · rien de su ⇒ null (jamais deviné).
// ⚠️ (revue adverse du 5 nov.) « Dans aucun de tes comptes » exige aussi que CHAQUE compte
// ait été relu APRÈS l'e-mail : un colis arrivé ce matin n'est pas « absent » d'un compte
// relu hier (pas su ≠ non). Et seule une ligne d'E-MAIL dit « arrivé par e-mail » : un
// colis vu par Vinted (`_o`) ou lu chez le transporteur (`synthetique`) n'en a pas.
export function compteDuRetrait(t, mr) {
  if (!t) return null;
  const recu = Array.isArray(t.recuSur) ? t.recuSur.filter(Boolean) : (typeof t.recuSur === 'string' && t.recuSur ? [t.recuSur] : []);
  if (t.mrCompte && t.mrCompte.libelle) return { source: 'mondialrelay', libelle: t.mrCompte.libelle, aussiEmail: t.source !== 'mondialrelay-compte' || !!t.aussiEmail, adresse: recu[0] || '' };
  if (t._o || t.synthetique || t.source === 'mondialrelay-compte') return null;
  const mrLus = mr && Array.isArray(mr.comptes) ? mr.comptes : [];
  const recuMs = Date.parse(t.receivedAt || t.emailAt || '');
  const horsComptes = String(t.carrier || '') === 'mondialrelay' && mrLus.length > 0 && Number.isFinite(recuMs)
    && mrLus.every((c) => c.complet && (Date.parse(c.luAt || '') || 0) >= recuMs);
  if (recu.length) return { source: 'email', libelle: recu[0], horsComptes };
  return horsComptes ? { source: 'email', libelle: '', horsComptes } : null;
}

// ── LA PLATEFORME D'UN ACHAT, PAR SON N° DE SUIVI (§5) ───────────────────────
// Leboncoin : le lien de suivi Mondial Relay de l'achat porte le n° d'expédition
// (`…tracking.aspx?ens=MRLBCOIN&exp=12345678…`, forme mesurée le 5 nov.) ;
// Vestiaire : `achats[id].suivi`. Le même n° qu'un colis à retirer ⇒ c'est cet
// achat. Jamais le titre, le prix ou le relais.
export function suiviDeLienMondialRelay(url) {
  const m = /[?&]exp=([0-9]{6,14})(?:&|$)/i.exec(String(url || ''));
  return m && /mondialrelay\./i.test(String(url)) ? norm(m[1]) : '';
}
export function indexAchatsAutresSites({ lbcVentes = [], vcAchats = null } = {}) {
  const m = new Map(); const doubles = new Set();
  const poser = (k, v) => { if (!k) return; if (m.has(k)) doubles.add(k); else m.set(k, v); };
  for (const o of (Array.isArray(lbcVentes) ? lbcVentes : [])) {
    if (!o || o.isSeller !== false) continue;
    poser(suiviDeLienMondialRelay(o.label && o.label.trackingUrl), { site: 'leboncoin', titre: texte(o.title, 120), id: String(o.txId == null ? '' : o.txId), photo: texte(o.image, 400) || null });
  }
  for (const [id, a] of Object.entries(vcAchats && typeof vcAchats === 'object' ? vcAchats : {})) {
    if (!a) continue;
    poser(norm(a.suivi), { site: 'vestiaire', titre: texte(a.nom, 120), id: String(id), photo: texte(a.photo, 400) || null });
  }
  for (const k of doubles) m.delete(k);   // deux achats au même n° : personne (§5)
  return m;
}
