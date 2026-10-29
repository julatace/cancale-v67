// ─────────────────────────────────────────────────────────────────────────────
// LE STATUT D'UN COLIS LU CHEZ SON TRANSPORTEUR (24 octobre) — les RÈGLES, pures.
// Aucune lecture réseau, aucune écriture : importées par le serveur
// (api/_lib/transporteurs-lecture.js, api/relais.js, le cron, le widget, la route
// des e-mails) et par l'app (Vite), §11 — une règle, un propriétaire.
//
// Julien, 24 octobre : « tu as juste à regarder sur le site du transporteur, je
// ne te demande pas le code de retrait mais juste de regarder le statut ». Il
// s'était déplacé pour un colis déjà reparti chez le vendeur.
//
// MESURÉ (24 oct., lecture seule de sa base + sandbox Vercel dub1, User-Agent
// honnête « VRM-suivi/1.0 (+https://vrm.center) ») — reproduit dans les bancs
// avec des valeurs INVENTÉES, à la même forme :
//   · Chronopost : `ws.chronopost.fr/…/trackSkybillV2` répond 200 en XML, sans
//     clé ni Cloudflare. Les CODES d'évènement disent l'état ; le dernier
//     évènement seul ment (XW476115185SP : AB → SM → TT → R → … → AB → D :
//     « livraison effectuée »… chez l'EXPÉDITEUR).
//   · Vinted Go : `carrier.vintedgo.com/public/v3/tracking_events/{n}` répond
//     200 en JSON (le plus récent d'abord), 404 JSON `shipment_expired` quand le
//     suivi n'est plus gardé, 404 VIDE pour un n° qui n'est pas à lui.
//   · Mondial Relay : la page .be répond, son API `/api/tracking` répond 403
//     HTML (Cloudflare) au serveur. MAIS l'ancienne route du site français,
//     `www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive`
//     (GET, n° + code postal), répond 200 au serveur avec le même User-Agent
//     honnête (mesuré le 24 oct., dub1, à 11:51, 11:53, 12:0x et 12:28 UTC) :
//     du JSON `{Success, Message}` dont `Message` est un FRAGMENT HTML (la frise
//     des étapes, les évènements jour par jour). Le serveur la lit donc lui-même
//     (voie `mr-fr-mvc`) ; le navigateur de Julien, par l'extension (C3/C4),
//     n'est plus qu'un SECOURS quand Mondial Relay refuse le serveur — par la
//     MÊME route `_mvc`, depuis son adresse IP (C3 annonce `mr-fr-mvc`) ; l'API
//     .be (`mr-be`) reste acceptée en C4. Les deux corps sont jugés ICI, avec le
//     contrôle de l'ÉCHO (n° ET code postal).
// ─────────────────────────────────────────────────────────────────────────────
import { normaliserSuivi } from './etat-colis-email.js';

// ── LES TRANSPORTEURS LUS, LEURS VOIES, LEURS NOMS ──────────────────────────
export const CARRIERS_LUS = ['mondialrelay', 'chronopost', 'vinted'];
// Une voie = une adresse MESURÉE chez un transporteur. Qui lit quoi (mesuré le
// 24 oct., voir api/_lib/transporteurs-lecture.js) : le SERVEUR lit les trois —
// Chronopost (`cp-ws2`), Vinted Go (`vg-v3`) et Mondial Relay par la route
// `_mvc` de mondialrelay.fr (`mr-fr-mvc`, JSON qui porte un fragment HTML de
// forme MESURÉE). Refusé (403, 429, défi, HTML hors JSON), le n° part à
// l'extension (C3, `aLireParNavigateur`) par la voie `VOIE_DE` : pour Mondial
// Relay la MÊME route `_mvc`, lue depuis le navigateur de Julien (son adresse
// IP, que Mondial Relay ne refuse pas comme celle du serveur) — une requête,
// sans jeton ni page à charger (l'extension 5.281 ne passe de `mr-be` à
// `mr-fr-mvc` qu'en repli, jamais l'inverse : annoncer `mr-be` lui ferait
// d'abord charger la page .be puis l'API protégée par Cloudflare). En C4,
// l'extension relaie l'une OU l'autre voie Mondial Relay (`VOIES`) : `mr-fr-mvc`
// jugée par `lireReponseMondialRelayMvc` (écho exigé), `mr-be` par
// `lireReponseMondialRelay` ; une voie inconnue ⇒ 400 `voie`. Une seule valeur
// (`LECTURE_SERVEUR_TRANSP`), lue par le serveur ET l'app (la phrase « Mondial
// Relay ne se lit que depuis ton ordinateur » ne s'écrit que si le serveur ne
// le lit pas).
export const LECTURE_SERVEUR_TRANSP = Object.freeze({ chronopost: true, vinted: true, mondialrelay: true });
export const VOIES = { 'mr-fr-mvc': 'mondialrelay', 'mr-be': 'mondialrelay', 'cp-ws2': 'chronopost', 'vg-v3': 'vinted' };
// La voie que l'EXTENSION reçoit en C3 (secours, sur refus du serveur) …
export const VOIE_DE = { mondialrelay: 'mr-fr-mvc', chronopost: 'cp-ws2', vinted: 'vg-v3' };
// … et celle de la lecture faite par le SERVEUR (rangée dans `transp_…voie`).
export const VOIE_SERVEUR = { mondialrelay: 'mr-fr-mvc', chronopost: 'cp-ws2', vinted: 'vg-v3' };
export const NOM_TRANSPORTEUR = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go' };
export const nomTransporteur = (c) => NOM_TRANSPORTEUR[String(c || '')] || 'Le transporteur';
// La FORME d'un n° lisible par transporteur (celles mesurées chez lui). Un n°
// hors forme n'est jamais interrogé (et n'entre dans aucune adresse).
export const FORME_SUIVI = {
  mondialrelay: /^\d{8}$/,
  chronopost: /^(?:[A-Z]{2}\d{9}[A-Z]{2}|\d{14}[0-9A-Z]?)$/,
  vinted: /^(?:\d{16}|VGS\d{13}|[0-9A-Z]{13})$/,
};
export const ETATS = ['en_route', 'disponible', 'retire', 'livre', 'retour_expediteur', 'incident', 'inconnu'];
export const RESULTATS = ['ok', 'introuvable', 'expire', 'bloque', 'forme', 'passu', 'cp-inconnu'];
export const cleTransp = (carrier, suivi) => `transp_${carrier}_${normaliserSuivi(suivi)}`;
export const ID_PAUSE = 'transp_pause';
// Le code postal du siège de Mondial Relay (« 59650 Villeneuve-d'Ascq ») : écrit
// dans le pied de ses e-mails, jamais celui d'un point relais.
export const CP_SIEGE_MR = '59650';

// Le transporteur LISIBLE d'une ligne, par son transporteur rangé et la forme du
// n° — sinon null (jamais deviné : Colissimo, DPD, UPS… ne sont pas lus).
export function carrierLisible(carrier, suivi) {
  const c = String(carrier || '').toLowerCase();
  const n = normaliserSuivi(suivi);
  let k = null;
  if (/mondial|inpost/.test(c)) k = 'mondialrelay';
  else if (/chrono|shop2shop|pickup/.test(c)) k = 'chronopost';
  else if (/vinted/.test(c)) k = 'vinted';
  if (!k || !FORME_SUIVI[k].test(n)) return null;
  return k;
}
// Les transporteurs qu'on ne lit pas, et qu'on NOMME une fois (§1.4).
export function carrierNonLu(carrier) {
  const c = String(carrier || '').toLowerCase();
  if (/coliss|la\s*poste/.test(c)) return 'Colissimo';
  if (/dpd/.test(c)) return 'DPD';
  if (/\bups\b|^ups/.test(c)) return 'UPS';
  if (/relais\s*colis|relaiscolis/.test(c)) return 'Relais Colis';
  return null;
}

// ── PETITS OUTILS ────────────────────────────────────────────────────────────
const propre = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
export const normLibelle = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
const msDe = (v) => { const ms = Date.parse(String(v || '')); return Number.isFinite(ms) ? ms : null; };
const isoDe = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
// Une empreinte courte, sans module de chiffrement (l'app l'importe aussi).
export function empreinte(s) {
  let h = 0x811c9dc5;
  const t = String(s == null ? '' : s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
// La FORME d'un objet : ses clés et le TYPE de ses feuilles, jamais une valeur.
export function formeDe(v, prof = 0) {
  const f = (x, p) => {
    if (x === null || x === undefined) return 'null';
    if (Array.isArray(x)) return x.length ? `[${f(x[0], p + 1)}]` : '[]';
    if (typeof x === 'object') {
      if (p >= 3) return '{…}';
      return '{' + Object.keys(x).slice(0, 24).map((k) => `${String(k).replace(/[^\w]/g, '').slice(0, 30)}:${f(x[k], p + 1)}`).join(',') + '}';
    }
    return typeof x === 'number' ? 'num' : typeof x === 'boolean' ? 'bool' : 'str';
  };
  return f(v, prof).slice(0, 500);
}
// L'heure de PARIS (« 2026-10-22T14:32:59.432 », sans fuseau — Mondial Relay)
// en UTC, par `Intl` (le changement d'heure compris). Illisible ou avant l'an
// 2000 (« 0001-01-01T00:00:00 » veut dire « inconnue ») ⇒ null.
const _fmtParis = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (_) { return null; } })();
function decalageParis(t) {
  if (!_fmtParis) return 0;
  const p = {}; for (const x of _fmtParis.formatToParts(new Date(t))) p[x.type] = x.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
}
export function isoParisVersUtc(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(String(s || '').trim());
  if (!m) return null;
  const [y, mo, d, h, mi, se] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0)];
  if (y < 2000) return null;
  const ms = m[7] ? Math.round(Number('0.' + m[7]) * 1000) : 0;
  const local = Date.UTC(y, mo - 1, d, h, mi, se, ms);
  let t = local - decalageParis(local);
  t = local - decalageParis(t);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
// Le jour de PARIS d'un instant (« AAAA-MM-JJ »).
export function jourParis(ms) {
  if (!Number.isFinite(ms)) return null;
  try { return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); } catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}
// Le refus d'un transporteur (pas une réponse à juger) : 401/403/429, défi, HTML.
const estHtml = (ctype, corps) => /text\/html/i.test(String(ctype || '')) || /^\s*<(?:!doctype\s+html|html)\b/i.test(String(corps || '').slice(0, 2000));
function refus(statut, ctype, corps, { mr = false } = {}) {
  const s = Number(statut) || 0;
  if (s === 403 || s === 429 || (mr && s === 401)) return 'bloque';
  if (s >= 200 && s < 300 && estHtml(ctype, corps)) return 'bloque';
  return null;
}
const rendu = (res, x = {}) => ({ res, etat: null, detail: null, etatAt: null, libelle: '', lieuNom: '', lieuVille: '', lieuCp: '', limite: null, limiteSure: false, cpRendu: '', forme: '', evenements: [], ...x });
// Les évènements gardés (pour le diagnostic) : les 20 plus récents, du plus
// ancien au plus récent, bornés.
const garderEvenements = (evs) => evs.slice(-20).map((e) => ({ at: e.at || null, code: propre(e.code, 24), libelle: propre(e.libelle, 160), lieu: propre(e.lieu, 120), cp: /^\d{5}$/.test(String(e.cp || '')) ? String(e.cp) : '' }));

// ── LE LIEU D'UN POINT RELAIS ────────────────────────────────────────────────
// « SUPER U ACCUEIL - RUE DE LA BRETONNIERE - 35260 - CANCALE - FR » (Chronopost
// V2, « Point de livraison ») ou « VANNES - FR - TERRA CBD » (officeLabel).
function lieuChronopost(info, office) {
  const s = String(info || '').trim();
  if (s) {
    const parts = s.split(/\s+-\s+/).map((x) => x.trim()).filter(Boolean);
    const iCp = parts.findIndex((x) => /^\d{5}$/.test(x));
    if (iCp >= 0) return { lieuNom: propre(parts[0], 80), lieuCp: parts[iCp], lieuVille: propre(parts[iCp + 1] || '', 60) };
    return { lieuNom: propre(parts[0] || s, 80), lieuCp: '', lieuVille: '' };
  }
  const o = String(office || '').trim();
  const m = /^(.+?)\s+-\s+[A-Z]{2}\s+-\s+(.+)$/.exec(o);
  if (m) return { lieuNom: propre(m[2], 80), lieuVille: propre(m[1], 60), lieuCp: '' };
  return { lieuNom: '', lieuVille: '', lieuCp: '' };
}

// ══ CHRONOPOST — ws.chronopost.fr trackSkybillV2 (XML) ══════════════════════
// Lecture d'un XML SOAP par ses balises (préfixes d'espace de noms tolérés).
const xmlTexte = (s) => String(s == null ? '' : s)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').trim();
function balises(xml, nom) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${nom}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[\\w.-]+:)?${nom}\\s*>)`, 'g');
  const out = []; let m;
  while ((m = re.exec(String(xml || '')))) out.push(m[1] == null ? '' : m[1]);
  return out;
}
const balise = (xml, nom) => { const b = balises(xml, nom); return b.length ? b[0] : null; };
const nomsBalises = (xml) => [...new Set((String(xml || '').match(/<(?:[\w.-]+:)?([A-Za-z]\w*)[\s>/]/g) || []).map((x) => x.replace(/^<(?:[\w.-]+:)?/, '').replace(/[\s>/]$/, '')))].slice(0, 30).join(',');
// Les codes MESURÉS (sur 3 colis, avec leur libellé exact).
export const CP_CODES = {
  DC: 'prepare', DB: 'route', TT: 'route', PC: 'route', SC: 'route', TS: 'route', RO: 'route', SD: 'route', TA: 'route', RB: 'route',
  CR: 'retarde', SM: 'message', AB: 'disponible', D: 'livre', R: 'retour',
};
export function lireReponseChronopost(statut, ctype, corps, { suivi = '' } = {}) {
  const n = normaliserSuivi(suivi);
  const r0 = refus(statut, ctype, corps);
  if (r0) return rendu(r0);
  if (Number(statut) !== 200) return rendu('passu');
  const xml = String(corps || '');
  const rep = balise(xml, 'trackSkybillV2Response');
  if (rep == null) return rendu('forme', { forme: nomsBalises(xml).slice(0, 500) });
  const ret = balise(rep, 'return') ?? rep;
  const code0 = xmlTexte(balise(ret, 'errorCode') ?? '');
  if (code0 !== '' && code0 !== '0') return rendu('introuvable');
  const liste = balise(ret, 'listEventInfoComp');
  if (liste == null) return rendu('introuvable');
  const evs = balises(liste, 'events').map((e, i) => {
    const infos = {};
    for (const ic of balises(e, 'infoCompList')) { const k = xmlTexte(balise(ic, 'name')); if (k) infos[k] = xmlTexte(balise(ic, 'value')); }
    const at = msDe(xmlTexte(balise(e, 'eventDate')));
    return { i, code: xmlTexte(balise(e, 'code')).replace(/\s+/g, '').toUpperCase(), at: isoDe(at), ms: at, libelle: xmlTexte(balise(e, 'eventLabel')), lieu: xmlTexte(balise(e, 'officeLabel')), cp: xmlTexte(balise(e, 'zipCode')), infos };
  });
  if (!evs.length) return rendu('introuvable');
  const sky = normaliserSuivi(xmlTexte(balise(liste, 'skybillNumber') ?? ''));
  if (!sky || sky !== n) return rendu('forme', { forme: `skybillNumber:${sky ? 'autre' : 'absent'}` });
  // Du plus ancien au plus récent (l'ordre du document pour une même seconde).
  evs.sort((a, b) => ((a.ms ?? 0) - (b.ms ?? 0)) || (a.i - b.i));
  const evenements = garderEvenements(evs);
  const dernier = evs[evs.length - 1];
  const base = { evenements, libelle: propre(dernier.libelle, 160) };
  const iR = evs.findIndex((e) => e.code === 'R');
  // 1. UN R N'IMPORTE OÙ : le colis repart chez l'expéditeur. Un D après lui est
  //    la livraison… à l'expéditeur — jamais « retiré par toi ».
  if (iR >= 0) {
    const rendu_ = evs.slice(iR + 1).some((e) => e.code === 'D');
    return rendu('ok', { ...base, etat: 'retour_expediteur', detail: rendu_ ? 'rendu' : null, etatAt: dernier.at });
  }
  // 2. D (sans R) : retiré au point relais (une info « Type de retrait »), sinon livré.
  const dD = [...evs].reverse().find((e) => e.code === 'D');
  if (dD) {
    const ab = [...evs].reverse().find((e) => e.code === 'AB');
    const lieu = ab ? lieuChronopost(ab.infos['Point de livraison'] || ab.infos['Point de retrait'], ab.lieu) : lieuChronopost(dD.infos['Point de retrait'] || dD.infos['Point de livraison'], dD.lieu);
    return rendu('ok', { ...base, ...lieu, etat: dD.infos['Type de retrait'] ? 'retire' : 'livre', etatAt: dD.at, libelle: propre(dD.libelle, 160) });
  }
  // 3. Un TT APRÈS le dernier AB, au même lieu : il a quitté le point relais sans
  //    être retiré (le cas mesuré : 5 jours avant le R).
  let iAB = -1; evs.forEach((e, i) => { if (e.code === 'AB') iAB = i; });
  if (iAB >= 0) {
    const ab = evs[iAB];
    const tt = evs.slice(iAB + 1).find((e) => e.code === 'TT' && e.lieu === ab.lieu);
    if (tt) return rendu('ok', { ...base, ...lieuChronopost(ab.infos['Point de livraison'] || ab.infos['Point de retrait'], ab.lieu), etat: 'incident', detail: 'quitte_relais', etatAt: tt.at, libelle: propre(tt.libelle, 160) });
  }
  // 4. Le dernier code SIGNIFICATIF (les SM ne sont que des messages).
  const signif = evs.filter((e) => e.code !== 'SM');
  const ds = signif[signif.length - 1] || dernier;
  const sens = CP_CODES[ds.code];
  if (ds.code === 'AB') {
    const autre = /diff[ée]rent\s+de\s+celui\s+pr[ée]vu/i.test(ds.libelle);
    return rendu('ok', { ...base, ...lieuChronopost(ds.infos['Point de livraison'] || ds.infos['Point de retrait'], ds.lieu), etat: 'disponible', detail: autre ? 'autre_point' : null, etatAt: ds.at, libelle: propre(ds.libelle, 160) });
  }
  if (!sens || sens === 'message') return rendu('ok', { ...base, etat: 'inconnu', etatAt: dernier.at });
  if (signif.every((e) => e.code === 'DC')) return rendu('ok', { ...base, etat: 'en_route', detail: 'prepare', etatAt: ds.at });
  return rendu('ok', { ...base, etat: 'en_route', detail: sens === 'retarde' ? 'retarde' : null, etatAt: ds.at });
}

// ══ VINTED GO — carrier.vintedgo.com /public/v3/tracking_events (JSON) ══════
export const VG_GROUPES = {
  created: 'prepare', shipped: 'route', in_transit: 'route', ready_for_pickup: 'disponible', delivered: 'retire',
  lost: 'incident', disposed: 'incident', cancelled: 'incident', empty_locker_found: 'incident',
};
const jsonDe = (corps) => { try { return JSON.parse(String(corps || '')); } catch (_) { return undefined; } };
export function lireReponseVintedGo(statut, ctype, corps, { suivi = '' } = {}) {
  const r0 = refus(statut, ctype, corps);
  if (r0) return rendu(r0);
  const s = Number(statut) || 0;
  const j = jsonDe(corps);
  // 404 JSON « shipment_expired » : Vinted Go ne garde plus ce suivi (plus de
  // 6 mois). Ni « livré », ni « perdu » : on arrête de lire, c'est tout.
  if (s === 404) return rendu(j && typeof j === 'object' && j.error_code === 'shipment_expired' ? 'expire' : 'passu');
  if (s !== 200) return rendu('passu');
  if (!j || typeof j !== 'object' || !Array.isArray(j.tracking_events)) return rendu('forme', { forme: formeDe(j) });
  const brut = j.tracking_events.filter((e) => e && typeof e === 'object');
  if (!brut.length) return rendu('introuvable');
  if (!brut.every((e) => typeof e.group === 'string')) return rendu('forme', { forme: formeDe(j) });
  // Du plus récent au plus ancien (l'ordre de Vinted Go pour une même seconde).
  const evs = brut.map((e, i) => ({ i, group: String(e.group || ''), state: String(e.state || ''), ms: msDe(e.timestamp), libelle: String(e.message || ''), lieu: e.metadata && typeof e.metadata === 'object' ? String(e.metadata.address || '') : '' }))
    .sort((a, b) => ((b.ms ?? 0) - (a.ms ?? 0)) || (a.i - b.i));
  const chrono = [...evs].reverse().map((e) => ({ at: isoDe(e.ms), code: e.group, libelle: e.libelle, lieu: e.lieu, cp: (/\b(\d{5})\b/.exec(e.lieu) || [])[1] || '' }));
  const evenements = garderEvenements(chrono);
  const d = evs[0];
  const base = { evenements, libelle: propre(d.libelle, 160), etatAt: isoDe(d.ms) };
  const nomPoint = () => { for (const e of evs) { const m = /\(([^()]{2,60})\)\s*$/.exec(e.libelle); if (m) return propre(m[1], 80); } return ''; };
  const lieuDe = (adr) => { const a = String(adr || ''); const m = /(?:^|,\s*)(\d{5})\s+([^,]+)/.exec(a); return { lieuCp: m ? m[1] : '', lieuVille: m ? propre(m[2], 60) : '' }; };
  // 1. Un retour n'importe où : repart chez l'expéditeur (« returned » : rendu).
  if (evs.some((e) => e.state === 'return' || /^return/.test(e.group) || e.group === 'returned')) {
    return rendu('ok', { ...base, etat: 'retour_expediteur', detail: /^(?:returned|return_returned)$/.test(d.group) ? 'rendu' : null });
  }
  const pret = evs.find((e) => e.group === 'ready_for_pickup');
  if (d.group === 'delivered' && (d.state === 'delivery' || !d.state)) {
    return rendu('ok', { ...base, etat: 'retire', lieuNom: nomPoint(), ...(pret ? lieuDe(pret.lieu) : {}) });
  }
  if (d.group === 'ready_for_pickup') {
    // La date limite = `meta.expiration_time`, et SEULEMENT dans cet état (elle
    // reste présente après le retrait : mesuré, « 4 jours restants » sur un
    // colis retiré).
    const exp = msDe(j.meta && j.meta.expiration_time);
    return rendu('ok', { ...base, etat: 'disponible', lieuNom: nomPoint(), ...lieuDe(d.lieu), limite: exp ? jourParis(exp) : null, limiteSure: !!exp });
  }
  const sens = VG_GROUPES[d.group];
  if (d.state === 'dispose' || sens === 'incident') return rendu('ok', { ...base, etat: 'incident', detail: d.group === 'lost' ? 'perdu' : null });
  if (sens === 'prepare') return rendu('ok', { ...base, etat: 'en_route', detail: 'prepare' });
  if (sens === 'route') return rendu('ok', { ...base, etat: 'en_route' });
  return rendu('ok', { ...base, etat: 'inconnu' });
}

// ══ MONDIAL RELAY — mondialrelay.be /api/tracking (JSON), relayé par l'extension
// Les libellés MESURÉS, normalisés (minuscules, sans accents). Le dernier
// évènement dont le libellé n'est pas ici ⇒ « inconnu » (le libellé recopié
// tel quel) : le retour à l'expéditeur n'a jamais été vu, il tombera ici.
// (24 oct.) Mêmes libellés sur la route `_mvc` de mondialrelay.fr, plus deux
// vus seulement là : « Colis en route vers le point de livraison » (un
// évènement) et les noms d'étapes de la frise (« Colis remis à Mondial Relay »,
// « Colis sur l'agence de livraison », « Colis disponible au point de retrait »).
export const MR_LIBELLES = [
  [/^colis en preparation chez l'expediteur/, 'prepare'],
  [/\bprise? en charge\b/, 'route'],
  [/^colis en cours de traitement sur le site\b/, 'route'],
  [/^colis expedie depuis le site\b/, 'route'],
  // « … vers le point de retrait » (.be), « … vers le point de livraison » (_mvc, mesuré).
  [/^colis en route vers le point de (?:retrait|livraison)\b/, 'route'],
  [/^colis remis a mondial relay\b/, 'route'],
  [/^colis sur l'agence de livraison\b/, 'route'],
  [/^(\d{1,2}) jours? restants? pour retirer le colis\b/, 'disponible'],
  [/^colis disponible au point de retrait\b/, 'disponible'],
  [/^colis livre\b/, 'livre'],
];
const classeMr = (lib) => { const t = normLibelle(lib); for (const [re, c] of MR_LIBELLES) { const m = re.exec(t); if (m) return { c, jours: m[1] ? Number(m[1]) : null }; } return null; };
const lieuMr = (dpr) => {
  const a = dpr && typeof dpr === 'object' && dpr.Adresse && typeof dpr.Adresse === 'object' ? dpr.Adresse : null;
  if (!a) return { lieuNom: '', lieuVille: '', lieuCp: '' };
  const cp = String(a.CodePostal == null ? '' : a.CodePostal).replace(/\s+/g, '');
  return { lieuNom: propre(a.Libelle, 80), lieuVille: propre(a.Ville, 60), lieuCp: /^\d{5}$/.test(cp) ? cp : '' };
};
export function lireReponseMondialRelay(statut, ctype, corps, { suivi = '', cp = '' } = {}) {
  const n = normaliserSuivi(suivi), c = String(cp || '');
  const r0 = refus(statut, ctype, corps, { mr: true });
  if (r0) return rendu(r0);
  if (Number(statut) !== 200) return rendu('passu');
  const j = jsonDe(corps);
  if (!j || typeof j !== 'object') return rendu('forme', { forme: 'pas du JSON' });
  const ex = j.Expedition;
  if (!ex || typeof ex !== 'object') {
    const msg = Array.isArray(j.status) && j.status[0] && typeof j.status[0].message === 'string' ? normLibelle(j.status[0].message) : '';
    if (/n'existe pas de colis/.test(msg)) return rendu('introuvable');
    return rendu('forme', { forme: formeDe(j) });
  }
  // L'ÉCHO : la réponse est celle de CE colis, à CE code postal — sinon rejet.
  const numero = String(ex.Numero == null ? '' : ex.Numero).replace(/\D/g, '').padStart(8, '0');
  const cpRendu = String(ex.DestinataireCodePostal == null ? '' : ex.DestinataireCodePostal).replace(/\s+/g, '');
  if (numero !== n || !c || cpRendu !== c) return rendu('forme', { forme: `echo:${numero === n ? 'numero-ok' : 'numero-autre'},${cpRendu === c ? 'cp-ok' : 'cp-autre'}` });
  const evs = (Array.isArray(ex.Evenements) ? ex.Evenements : []).filter((e) => e && typeof e === 'object')
    .map((e, i) => { const at = isoParisVersUtc(e.Date); return { i, at, ms: msDe(at), libelle: String(e.Libelle || '').trim(), dpr: e.DetailPointRelais || null }; })
    .sort((a, b) => ((a.ms ?? 0) - (b.ms ?? 0)) || (a.i - b.i));
  const etapes = ex.SuiviParEtapes && typeof ex.SuiviParEtapes === 'object' ? ex.SuiviParEtapes : {};
  let k = 0;
  for (const [cle, v] of Object.entries(etapes)) { const nn = Number(cle); if (Number.isInteger(nn) && nn >= 1 && nn <= 9 && v && v.Evenement && v.Evenement.Date && nn > k) k = nn; }
  const evenements = garderEvenements(evs.map((e) => { const l = lieuMr(e.dpr); return { at: e.at, code: '', libelle: e.libelle, lieu: [l.lieuNom, l.lieuCp, l.lieuVille].filter(Boolean).join(' '), cp: l.lieuCp }; }));
  if (!evs.length && !k) return rendu('introuvable', { cpRendu });
  const dernier = evs[evs.length - 1] || null;
  const base = { evenements, cpRendu, libelle: propre(dernier ? dernier.libelle : '', 160), etatAt: dernier ? dernier.at : isoParisVersUtc(etapes[String(k)] && etapes[String(k)].Evenement.Date) };
  if (dernier && !classeMr(dernier.libelle)) return rendu('ok', { ...base, etat: 'inconnu' });
  const dateEtape = (x) => isoParisVersUtc(etapes[String(x)] && etapes[String(x)].Evenement && etapes[String(x)].Evenement.Date);
  if (k >= 5) {
    const livre = [...evs].reverse().find((e) => (classeMr(e.libelle) || {}).c === 'livre');
    const lieu = lieuMr(livre && livre.dpr);
    const at = (livre && livre.at) || dateEtape(5) || base.etatAt;
    return rendu('ok', { ...base, ...lieu, etat: String(ex.DeliveryMode || '') === '24R' ? 'retire' : 'livre', etatAt: at });
  }
  if (k === 4) {
    const arr = [...evs].reverse().find((e) => (classeMr(e.libelle) || {}).c === 'disponible');
    const lieu = lieuMr((arr && arr.dpr) || (etapes['4'] && etapes['4'].Evenement && etapes['4'].Evenement.DetailPointRelais));
    const at = (arr && arr.at) || dateEtape(4) || base.etatAt;
    // La limite est DÉDUITE (date de l'évènement + N jours), jamais affirmée :
    // `limiteSure:false`, dite « vers le ».
    const jours = arr ? classeMr(arr.libelle).jours : null;
    const limite = Number.isFinite(jours) && msDe(at) ? jourParis(msDe(at) + jours * 86400000) : null;
    return rendu('ok', { ...base, ...lieu, etat: 'disponible', etatAt: at, limite, limiteSure: false });
  }
  if (k >= 2) return rendu('ok', { ...base, etat: 'en_route' });
  return rendu('ok', { ...base, etat: 'en_route', detail: 'prepare' });
}
// ══ MONDIAL RELAY — mondialrelay.fr /_mvc/…/RechercherJsonResponsive (le SERVEUR)
// MESURÉ le 24 oct. 2026 (sandbox Vercel dub1, User-Agent honnête, GET
// `?NumeroExpedition={n}&CodePostal={cp}`, deux fois à 2,5 s d'écart) :
//   · trouvé : 200 application/json `{Success:true, ModelState:[], Message:<HTML
//     d'environ 35 Ko>, Action:'ReplaceDiv', Data:false}` (44 867 octets) ;
//   · mauvais code postal : 200 `{Success:false, ModelState:[{Item1, Item2}],
//     Message:<li class="Error">… erreur de saisie …</li>}` (1 517 octets) — « pas
//     de colis pour CE couple n°/code postal » ;
//   · le fragment : la frise `ul.timeline` (5 étapes, `li.validate` = atteinte :
//     préparation · remis à Mondial Relay · agence de livraison · disponible au
//     point de retrait · livré au destinataire), puis les JOURS (`<p>JJ/MM/AAAA</p>`)
//     et, dans chaque jour, les évènements `div.step-suivi` : `<p class="center">
//     HH:MM</p>` puis `<p>libellé</p>` — le plus récent d'abord ;
//   · l'ÉCHO est dans un script du fragment : `var numeroExpedition = '…'` et
//     `'CodePostal' : '…'` ;
//   · le NOM et l'ADRESSE du point relais n'y sont PAS (chargés par un AUTRE appel,
//     `/_mvc/fr-FR/Map/SummaryInfosPointsRelais`, jamais fait ici) : `lieuNonLu`,
//     la ligne GARDE le lieu qu'elle avait (e-mail, lecture .be), jamais effacé
//     par un blanc.
// Jamais un fragment qu'on ne reconnaît pas : JSON sans `Success`, `Success:false`
// sans le message mesuré, aucun écho du n°, aucune frise ou une frise qui n'a pas
// CINQ étapes (la forme mesurée : un nombre d'étapes atteintes ne se lit que sur
// elle), aucun évènement daté ⇒
// `forme` (la FORME est notée, jamais le contenu).
const MVC_PAS_DE_COLIS = /erreur de saisie|n'existe pas de colis|aucun colis/;
function texteMvcErreur(j) {
  const parts = [typeof j.Message === 'string' ? j.Message : ''];
  if (Array.isArray(j.ModelState)) for (const x of j.ModelState) if (x && typeof x === 'object') parts.push(String(x.Item2 || x.Value || ''));
  return normLibelle(xmlTexte(parts.join(' ')).replace(/&nbsp;/g, ' '));
}
export function lireReponseMondialRelayMvc(statut, ctype, corps, { suivi = '', cp = '' } = {}) {
  const n = normaliserSuivi(suivi), c = String(cp || '');
  const r0 = refus(statut, ctype, corps, { mr: true });
  if (r0) return rendu(r0);
  if (Number(statut) !== 200) return rendu('passu');
  const j = jsonDe(corps);
  if (!j || typeof j !== 'object' || typeof j.Success !== 'boolean') return rendu('forme', { forme: j && typeof j === 'object' ? formeDe(j) : 'pas du JSON' });
  if (j.Success === false) return MVC_PAS_DE_COLIS.test(texteMvcErreur(j)) ? rendu('introuvable') : rendu('forme', { forme: `succes:false,${formeDe(j)}` });
  if (typeof j.Message !== 'string') return rendu('forme', { forme: formeDe(j) });
  const h = j.Message;
  // L'ÉCHO : la réponse est celle de CE colis (n°), et, s'il est écrit, à CE code postal.
  const mN = /\bnumeroExpedition\s*=\s*['"](\d{1,12})['"]/.exec(h);
  const mC = /['"]CodePostal['"]\s*:\s*['"]([^'"]{0,12})['"]/.exec(h);
  const numero = mN ? mN[1].padStart(8, '0') : '';
  const cpRendu = mC ? mC[1].replace(/\s+/g, '') : '';
  if (!mN || numero !== n || !c || (mC && cpRendu !== c)) return rendu('forme', { forme: `echo:${!mN ? 'numero-absent' : numero === n ? 'numero-ok' : 'numero-autre'},${!mC ? 'cp-absent' : cpRendu === c ? 'cp-ok' : 'cp-autre'}` });
  // Scripts et styles retirés (une balise auto-fermée `<style/>` ne mange rien).
  const sansScripts = h.replace(/<script\b(?![^>]*\/>)[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b(?![^>]*\/>)[^>]*>[\s\S]*?<\/style>/gi, ' ');
  // La frise : combien d'étapes sont atteintes (`li.validate`).
  const ul = /<ul\b[^>]*class\s*=\s*["'][^"']*\btimeline\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i.exec(sansScripts);
  if (!ul) return rendu('forme', { forme: 'mvc:frise-absente' });
  const lis = [...ul[1].matchAll(/<li\b([^>]*)>/gi)];
  if (lis.length !== 5) return rendu('forme', { forme: `mvc:frise-${lis.length}` });
  const k = lis.filter((m) => { const cl = /\bclass\s*=\s*["']([^"']*)["']/i.exec(m[1]); return !!cl && cl[1].split(/\s+/).includes('validate'); }).length;
  // Les évènements : un jour (`<p>JJ/MM/AAAA</p>`), puis ses heures et libellés.
  const re = /<p\b[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s*<\/p>|<p\b[^>]*class\s*=\s*["'][^"']*\bcenter\b[^"']*["'][^>]*>\s*(\d{1,2}):(\d{2})\s*<\/p>\s*<\/div>\s*<div\b[^>]*>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let jour = null; const evs = [];
  for (const m of sansScripts.matchAll(re)) {
    if (m[1]) { jour = `${m[3]}-${m[2]}-${m[1]}`; continue; }
    if (!jour) continue;
    const at = isoParisVersUtc(`${jour}T${m[4].padStart(2, '0')}:${m[5]}`);
    const libelle = propre(xmlTexte(m[6]).replace(/&nbsp;/g, ' '), 160);
    if (!at || !libelle || evs.some((e) => e.at === at && e.libelle === libelle)) continue;
    evs.push({ i: evs.length, at, ms: msDe(at), libelle });
  }
  if (!evs.length) return rendu('forme', { forme: `mvc:aucun-evenement,etapes:${k}` });
  // Du plus ancien au plus récent (la page écrit le plus récent d'abord).
  evs.sort((a, b) => ((a.ms ?? 0) - (b.ms ?? 0)) || (b.i - a.i));
  const evenements = garderEvenements(evs.map((e) => ({ at: e.at, code: '', libelle: e.libelle, lieu: '', cp: '' })));
  const dernier = evs[evs.length - 1];
  const base = { evenements, cpRendu: c, libelle: propre(dernier.libelle, 160), etatAt: dernier.at, lieuNonLu: true };
  if (!classeMr(dernier.libelle)) return rendu('ok', { ...base, etat: 'inconnu' });
  const classe = (e) => (classeMr(e.libelle) || {}).c;
  const livre = [...evs].reverse().find((e) => classe(e) === 'livre');
  const arr = [...evs].reverse().find((e) => classe(e) === 'disponible');
  if (k >= 5 || livre) {
    // Livré APRÈS une arrivée au point relais (étape 4, ou « N jours restants ») : RETIRÉ.
    return rendu('ok', { ...base, etat: (k >= 4 || arr) ? 'retire' : 'livre', etatAt: (livre && livre.at) || base.etatAt, libelle: propre((livre || dernier).libelle, 160) });
  }
  if (k === 4) {
    const at = (arr && arr.at) || base.etatAt;
    // La limite est DÉDUITE (date de l'évènement + N jours), jamais affirmée.
    const jours = arr ? classeMr(arr.libelle).jours : null;
    const limite = Number.isFinite(jours) && msDe(at) ? jourParis(msDe(at) + jours * 86400000) : null;
    return rendu('ok', { ...base, etat: 'disponible', etatAt: at, limite, limiteSure: false });
  }
  if (k >= 2) return rendu('ok', { ...base, etat: 'en_route' });
  return rendu('ok', { ...base, etat: 'en_route', detail: 'prepare' });
}
// Une seule entrée pour les trois (C4 et les lectures du serveur). Mondial
// Relay : la voie dit quelle forme juger (`mr-fr-mvc` : le fragment de la route
// `_mvc`, lu par le serveur ou relayé par l'extension ; sinon `mr-be` : le JSON
// de l'API .be relayé par l'extension).
export function lireReponse(carrier, statut, ctype, corps, opts = {}) {
  if (carrier === 'chronopost') return lireReponseChronopost(statut, ctype, corps, opts);
  if (carrier === 'vinted') return lireReponseVintedGo(statut, ctype, corps, opts);
  if (carrier === 'mondialrelay') return opts && opts.voie === 'mr-fr-mvc' ? lireReponseMondialRelayMvc(statut, ctype, corps, opts) : lireReponseMondialRelay(statut, ctype, corps, opts);
  return rendu('forme', { forme: 'transporteur inconnu' });
}

// ── LA LIGNE `transp_{carrier}_{n°}` APRÈS UN ESSAI (C1) ─────────────────────
// `avant` : la ligne lue (ou null) ; `lu` : le rendu d'un analyseur. Une lecture
// qui échoue ne change NI l'état, ni le lieu, ni la limite : seulement l'essai.
export const finiApres = (t) => !!t && (t.etat === 'retire' || t.etat === 'livre' || (t.etat === 'retour_expediteur' && t.detail === 'rendu') || t.essaiRes === 'expire' || (t.essaiRes === 'introuvable' && (Number(t.essais) || 0) >= 3));
export function ligneApresEssai(avant, lu, { carrier, suivi, voie, source = 'serveur', statut = null, maintenant = Date.now(), cp = '', cpSource = '', cpEssaye = '' } = {}) {
  const a = avant && typeof avant === 'object' ? avant : {};
  const iso = new Date(maintenant).toISOString();
  const res = RESULTATS.includes(lu && lu.res) ? lu.res : 'passu';
  // `essaiSource` : qui a fait CET essai (le serveur, ou l'extension en C4) — un
  // refus du SERVEUR ne retarde pas l'extension, qui lit à sa place (C3).
  const out = { ...a, v: 1, suivi: normaliserSuivi(suivi), carrier, voie: voie || a.voie || VOIE_DE[carrier] || '', essai: iso, essaiRes: res, essaiSource: source, essaiStatut: Number.isFinite(Number(statut)) && statut !== null ? Number(statut) : null };
  delete out.rev;
  if (res === 'ok') {
    out.essais = 0;
    for (const k of ['etat', 'detail', 'etatAt', 'libelle', 'lieuNom', 'lieuVille', 'lieuCp', 'limite', 'limiteSure']) out[k] = lu[k] === undefined ? null : lu[k];
    // Une voie qui ne porte pas le lieu (Mondial Relay `mr-fr-mvc`) : la ligne
    // garde celui qu'elle avait, jamais effacé par un blanc.
    if (lu.lieuNonLu) for (const k of ['lieuNom', 'lieuVille', 'lieuCp']) out[k] = a[k] == null ? '' : a[k];
    out.libelle = propre(out.libelle, 160); out.lieuNom = propre(out.lieuNom, 80); out.lieuVille = propre(out.lieuVille, 60);
    if (!/^\d{5}$/.test(String(out.lieuCp || ''))) out.lieuCp = '';
    out.limiteSure = !!out.limiteSure;
    out.lu = iso; out.source = source;
    out.evenements = Array.isArray(lu.evenements) ? lu.evenements.slice(-20) : [];
    out.forme = '';
    if (carrier === 'mondialrelay' && cp) { out.cp = cp; out.cpSource = cpSource || a.cpSource || 'lu'; }
  } else if (res !== 'cp-inconnu') {
    out.essais = (Number(a.essais) || 0) + 1;
    if (lu && lu.forme) out.forme = propre(lu.forme, 500);
  }
  if (cpEssaye && /^\d{5}$/.test(cpEssaye)) {
    const jour = jourParis(maintenant);
    const deja = a.cpJour === jour ? String(a.cpEssayes || '').split(',').filter(Boolean) : [];
    out.cpEssayes = [...new Set([...deja, cpEssaye])].slice(0, 6).join(',');
    out.cpJour = jour;
  }
  out.fini = finiApres(out);
  return out;
}

// ── LES SCALAIRES LUS PAR LES LECTEURS (app, cron, widget, e-mails) ──────────
// Jamais `select=data` (§4.4) : les évènements restent dans la ligne.
export const SELECT_TRANSP_META = 'id,suivi:meta->>suivi,carrier:meta->>carrier,etat:meta->>etat,detail:meta->>detail,etatAt:meta->>etatAt,libelle:meta->>libelle,lieuNom:meta->>lieuNom,lieuVille:meta->>lieuVille,lieuCp:meta->>lieuCp,limite:meta->>limite,limiteSure:meta->>limiteSure,lu:meta->>lu,source:meta->>source,essai:meta->>essai,essaiRes:meta->>essaiRes,essaiSource:meta->>essaiSource,essais:meta->>essais,cp:meta->>cp,cpSource:meta->>cpSource,cpEssayes:meta->>cpEssayes,cpJour:meta->>cpJour,fini:meta->>fini';
// La fenêtre de lecture : pas fini, ou lu depuis moins de 45 jours.
export const FENETRE_LECTEURS_J = 45;
export function ligneTranspDeMeta(x) {
  if (!x || typeof x !== 'object') return null;
  const m = /^transp_(mondialrelay|chronopost|vinted)_([A-Z0-9]+)$/.exec(String(x.id || ''));
  if (!m) return null;
  const suivi = normaliserSuivi(x.suivi) || m[2];
  if (suivi !== m[2] || (x.carrier && x.carrier !== m[1])) return null;   // une ligne qui contredit son identifiant ne compte pas
  const bool = (v) => v === true || v === 'true';
  const etat = ETATS.includes(x.etat) ? x.etat : null;
  return {
    id: x.id, suivi, carrier: m[1], etat, detail: x.detail || null, etatAt: x.etatAt || null, libelle: String(x.libelle || ''),
    lieuNom: String(x.lieuNom || ''), lieuVille: String(x.lieuVille || ''), lieuCp: String(x.lieuCp || ''),
    limite: /^\d{4}-\d{2}-\d{2}$/.test(String(x.limite || '')) ? String(x.limite) : null, limiteSure: bool(x.limiteSure),
    lu: x.lu || null, source: x.source || '', essai: x.essai || null, essaiRes: RESULTATS.includes(x.essaiRes) ? x.essaiRes : null, essaiSource: String(x.essaiSource || ''),
    essais: Number(x.essais) || 0, cp: /^\d{5}$/.test(String(x.cp || '')) ? String(x.cp) : '', cpSource: String(x.cpSource || ''),
    cpEssayes: String(x.cpEssayes || ''), cpJour: String(x.cpJour || ''), fini: bool(x.fini),
  };
}
export const dansFenetreLecteurs = (t, maintenant = Date.now()) => !!t && (!t.fini || (msDe(t.lu || t.essai) != null && maintenant - msDe(t.lu || t.essai) < FENETRE_LECTEURS_J * 86400000));

// ══ QUELS N° INTERROGER (§1.5, §1.6) ═════════════════════════════════════════
// Le SENS d'une ligne d'e-mail (venu de l'app, §11) : 'sortant' · 'entrant' · null.
export const SUJET_SORTANT = /entre de bonnes mains|preuve de d[ée]p[ôo]t|confirmation du d[ée]p[ôo]t|d[ée]p[ôo]t de votre colis|colis est d[ée]pos[ée]|bordereau d.envoi/i;
export const SUJET_ENTRANT = /est arriv|disponible|[àa] retirer|en consigne|en relais|pr[êe]t [àa] [êe]tre retir/i;
export function sensDeLigne(t, envoyes) {
  if (!t) return null;
  const brut = t.suivi != null ? t.suivi : t.su;
  const k = normaliserSuivi(brut);
  // L'ensemble des n° de ses bordereaux : rangé normalisé (serveur) ou « trim +
  // majuscules » (l'app, depuis août) — les deux sont lus, la même identité.
  const cru = brut != null ? String(brut).trim().toUpperCase() : '';
  if (envoyes && k && (envoyes instanceof Set ? (envoyes.has(k) || (cru && envoyes.has(cru))) : (Array.isArray(envoyes) && envoyes.map(normaliserSuivi).includes(k)))) return 'sortant';
  const s = t.sens != null ? t.sens : t.se;
  if (s === 'sortant' || s === 'entrant') return s;
  const suj = String(t.subject != null ? t.subject : (t.sujet != null ? t.sujet : (t.sj || '')));
  if (!suj) return null;
  const so = SUJET_SORTANT.test(suj), en = SUJET_ENTRANT.test(suj);
  if (so && !en) return 'sortant';
  if (en && !so) return 'entrant';
  return null;
}
// Les intervalles (le serveur décide, jugés sur `essai` rangé en base).
export const RYTHME_MS = { disponible: 30 * 60000, en_route: 2 * 3600000, inconnu: 2 * 3600000, incident: 2 * 3600000, retour_expediteur: 2 * 3600000 };
export const RECUL_MS = [30, 60, 120, 360].map((m) => m * 60000);
export const INTROUVABLE_MS = 6 * 3600000;
export const INTROUVABLE_MAX = 3;
export const CP_INCONNU_MS = 6 * 3600000;
export const FENETRE_ACTIFS_J = 30;
export const RELECTURE_PAGE_MS = 5 * 60000;
// Le prochain essai permis d'une ligne `transp_` (ms), ou Infinity (plus jamais).
export function prochainEssai(t) {
  if (!t) return 0;
  if (t.fini) return Infinity;
  const e = msDe(t.essai);
  if (e == null) return 0;
  const r = t.essaiRes;
  if (r === 'expire') return Infinity;
  if (r === 'introuvable') return (Number(t.essais) || 0) >= INTROUVABLE_MAX ? Infinity : e + INTROUVABLE_MS;
  if (r === 'cp-inconnu') return e + CP_INCONNU_MS;
  if (r === 'passu' || r === 'bloque' || r === 'forme') return e + RECUL_MS[Math.min(Math.max((Number(t.essais) || 1) - 1, 0), RECUL_MS.length - 1)];
  return e + (RYTHME_MS[t.etat] || RYTHME_MS.en_route);
}
// Les codes postaux à 5 chiffres d'un texte (le siège de Mondial Relay écarté).
export function codesPostauxDe(texte) {
  const out = [];
  for (const m of String(texte || '').matchAll(/(?:^|[^\d])(\d{5})(?!\d)/g)) if (m[1] !== CP_SIEGE_MR && !out.includes(m[1])) out.push(m[1]);
  return out;
}
// Le code postal du point relais d'un colis Mondial Relay (§1.3), dans l'ordre :
// 1. celui déjà PROUVÉ par une lecture · 2. le lieu de l'e-mail « disponible »
// (`lieu`, puis `extraitLieu`) · 3. la saisie à la main · 4. la conversation
// Vinted de la transaction reliée par IDENTITÉ · 5. un ESSAI borné parmi les
// codes déjà prouvés chez ce vendeur (2 par n° et par jour, accepté sur écho).
// Rend { cp, source } ou null. Jamais un code deviné ailleurs.
export function codePostalPourMondialRelay({ suivi, transp = null, lignes = [], manuels = [], relaisLieux = [], prouves = [], maintenant = Date.now(), essai = true } = {}) {
  const k = normaliserSuivi(suivi);
  // `cp` n'est rangé dans la ligne qu'après une lecture dont l'ÉCHO l'a prouvé.
  if (transp && transp.cp) return { cp: transp.cp, source: transp.cpSource || 'lu' };
  for (const l of lignes) {
    const st = l.status != null ? l.status : l.s;
    if (st !== 'available') continue;
    const cps = [...codesPostauxDe(l.lieu || ''), ...codesPostauxDe(l.extraitLieu != null ? l.extraitLieu : l.el)];
    if (cps.length) return { cp: cps[0], source: 'email' };
  }
  for (const m of manuels) if (m && normaliserSuivi(m.suivi) === k && /^\d{5}$/.test(String(m.cp || m.codePostal || ''))) return { cp: String(m.cp || m.codePostal), source: 'manuel' };
  for (const l of relaisLieux) { const cps = codesPostauxDe(l); if (cps.length) return { cp: cps[0], source: 'relais' }; }
  if (!essai) return null;
  const jour = jourParis(maintenant);
  const essayes = transp && transp.cpJour === jour ? String(transp.cpEssayes || '').split(',').filter(Boolean) : [];
  if (essayes.length >= 2) return null;
  const libre = [...new Set(prouves.filter((c) => /^\d{5}$/.test(String(c)) && c !== CP_SIEGE_MR))].find((c) => !essayes.includes(c));
  return libre ? { cp: libre, source: 'essai' } : null;
}
// Les n° à interroger. Entrées (scalaires) :
//   lignes   — les lignes `email_track_*` (relues, `relireLigneMeta`) ;
//   transp   — Map(n° → ligne `transp_`) ;
//   manuels  — les n° saisis (`colis_suivi_*` : {suivi, transporteur, cp, tx}) ;
//   vinted   — les suivis Vinted (`harvest_*_suivi_*` : {suivi, transporteur, tx}) ;
//   envoyes  — les n° de SES bordereaux (`email_bord_*.meta.suivi`) ;
//   relaisDe — (n°) → lieux de la conversation Vinted reliée par identité ;
//   prouves  — les codes postaux prouvés chez ce vendeur ;
//   pause    — la ligne `transp_pause` ;
// Rend [{ carrier, suivi, cp, cpSource, raison: 'actif'|'fermeture'|'page', prioritaire }].
export function suivisAInterroger({ lignes = [], transp = new Map(), manuels = [], vinted = [], envoyes = [], relaisDe = null, prouves = [], maintenant = Date.now(), max = 6, parTransporteur = 6, seul = null, force = false, avecFermeture = true } = {}) {
  const envoyesN = new Set((envoyes || []).map(normaliserSuivi).filter(Boolean));
  const par = new Map();   // n° → { carrier, lignes, entrant, sortant, dernierMs, manuel, vinted }
  const ajoute = (k, carrier, o) => {
    if (!k) return null;
    const e = par.get(k) || { k, carrier: null, lignes: [], entrant: false, sortant: false, dernierMs: null, manuels: [], vinted: false };
    if (carrier && !e.carrier) e.carrier = carrier;
    Object.assign(e, o || {});
    par.set(k, e);
    return e;
  };
  for (const l of lignes) {
    if (!l) continue;
    const k = normaliserSuivi(l.suivi != null ? l.suivi : l.su) || '';
    if (!k) continue;
    const c = carrierLisible(l.carrier != null ? l.carrier : l.c, k);
    const e = ajoute(k, c);
    e.lignes.push(l);
    const sens = sensDeLigne(l, envoyesN);
    const st = l.status != null ? l.status : l.s;
    if (sens === 'sortant') e.sortant = true;
    else if (sens === 'entrant' || st === 'available') e.entrant = true;
    const ms = msDe(l.emailAt != null ? l.emailAt : l.ea) ?? msDe(l.receivedAt != null ? l.receivedAt : l.r);
    if (ms != null && (e.dernierMs == null || ms > e.dernierMs)) e.dernierMs = ms;
  }
  for (const m of manuels) {
    if (!m) continue;
    const k = normaliserSuivi(m.suivi);
    const c = carrierLisible(m.transporteur || '', k) || carrierLisible(transporteurDeFormeT(k), k);
    const e = ajoute(k, c); if (!e) continue;
    e.entrant = true; e.manuels.push(m);
    const ms = msDe(m.at); if (ms != null && (e.dernierMs == null || ms > e.dernierMs)) e.dernierMs = ms;
  }
  for (const v of vinted) {
    if (!v) continue;
    const k = normaliserSuivi(v.suivi);
    const c = carrierLisible(v.transporteur || '', k) || carrierLisible(transporteurDeFormeT(k), k);
    const e = ajoute(k, c); if (!e) continue;
    e.entrant = true; e.vinted = true;
    const ms = msDe(v.cap); if (ms != null && (e.dernierMs == null || ms > e.dernierMs)) e.dernierMs = ms;
  }
  const out = [];
  const parC = {};
  const seulN = seul ? normaliserSuivi(seul) : null;
  const items = [];
  for (const e of par.values()) {
    if (seulN && e.k !== seulN) continue;
    if (!e.carrier) continue;
    // JAMAIS un n° sortant (bordereau ou sens), jamais un sens « pas su ».
    if (envoyesN.has(e.k) || e.sortant || !e.entrant) continue;
    const t = transp instanceof Map ? transp.get(e.k) : null;
    if (t && t.fini) continue;
    // Les fins écrites dans les e-mails (retiré, reparti) ferment aussi le n°.
    const finEmail = e.lignes.some((l) => { const st = l.status != null ? l.status : l.s; return st === 'delivered' || st === 'retour'; });
    const recent = (e.dernierMs != null && maintenant - e.dernierMs < FENETRE_ACTIFS_J * 86400000) || (t && msDe(t.etatAt) != null && maintenant - msDe(t.etatAt) < FENETRE_ACTIFS_J * 86400000);
    let raison;
    if (seulN && force) raison = 'page';
    else if (recent && !finEmail) raison = 'actif';
    else if (!t && !finEmail && avecFermeture) raison = 'fermeture';   // un ancien n° jamais fermé : lu UNE fois
    else continue;
    let cp = '', cpSource = '';
    if (e.carrier === 'mondialrelay') {
      const r = codePostalPourMondialRelay({ suivi: e.k, transp: t, lignes: e.lignes, manuels: e.manuels, relaisLieux: relaisDe ? (relaisDe(e.k) || []) : [], prouves, maintenant });
      if (r) { cp = r.cp; cpSource = r.source; }
    }
    let quand = raison === 'page' ? (msDe(t && t.essai) != null ? msDe(t.essai) + RELECTURE_PAGE_MS : 0) : prochainEssai(t);
    // Un code postal APPRIS depuis (saisi, lu dans un e-mail) : le n° redevient lisible tout de suite.
    if (t && t.essaiRes === 'cp-inconnu' && cp && cpSource !== 'essai') quand = 0;
    if (!(quand <= maintenant)) continue;
    const dispo = (t && t.etat === 'disponible') || e.lignes.some((l) => (l.status != null ? l.status : l.s) === 'available');
    const prio = raison === 'page' ? 0 : raison === 'fermeture' ? 3 : dispo ? 1 : 2;
    items.push({ carrier: e.carrier, suivi: e.k, cp, cpSource, raison, prio, quand });
  }
  items.sort((a, b) => (a.prio - b.prio) || (a.quand - b.quand) || a.suivi.localeCompare(b.suivi));
  for (const it of items) {
    if (out.length >= max) break;
    parC[it.carrier] = parC[it.carrier] || 0;
    if (parC[it.carrier] >= parTransporteur) continue;
    parC[it.carrier]++;
    out.push({ carrier: it.carrier, suivi: it.suivi, cp: it.cp, cpSource: it.cpSource, raison: it.raison, prioritaire: it.prio <= 1 });
  }
  return out;
}
// Le transporteur d'un n° par sa forme (le même que suivi-colis.js, sans
// l'importer : pas de cycle).
function transporteurDeFormeT(n) {
  const s = normaliserSuivi(n);
  if (/^\d{8}$/.test(s)) return 'mondialrelay';
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(s)) return 'chronopost';
  if (/^VGS\d{8,}$/.test(s)) return 'vinted';
  return '';
}

// Ce que l'EXTENSION doit lire depuis le navigateur (C3, et `besoinNavigateur`
// du passage) — une règle pour les deux (§11) : un n° dont le DERNIER essai est
// un refus du SERVEUR (`bloque`, fait par lui — pas par l'extension), ou un
// transporteur en pause. Le recul du serveur après SON refus ne retarde pas
// l'extension : elle lit à sa place, tout de suite ; son propre essai (C4) remet
// le n° au rythme normal (et un refus relayé par elle, à son recul).
// Mondial Relay : seulement avec son code postal (celui que la page a donné
// pour le n° demandé seul, `cpSeul`, à défaut d'un autre), par la voie de
// l'extension (`VOIE_DE` : la route `_mvc`, depuis le navigateur).
export function aLireParNavigateur({ lignes = [], transp = new Map(), manuels = [], vinted = [], envoyes = [], relaisDe = null, prouves = [], pause = {}, maintenant = Date.now(), seul = null, cpSeul = '', max = 6 } = {}) {
  const refusServeur = (t) => !!t && t.essaiRes === 'bloque' && t.essaiSource !== 'extension' && t.essaiSource !== 'page';
  const vue = new Map();
  for (const [k, t] of (transp instanceof Map ? transp : new Map())) vue.set(k, refusServeur(t) ? { ...t, essai: null } : t);
  const items = suivisAInterroger({ lignes, transp: vue, manuels, vinted, envoyes, relaisDe, prouves, maintenant, max: 50, parTransporteur: 50, seul });
  const out = [];
  for (const it of items) {
    if (out.length >= max) break;
    const t = transp instanceof Map ? transp.get(it.suivi) : null;
    if (!(refusServeur(t) || enPause(pause, it.carrier, maintenant))) continue;
    if (it.carrier === 'mondialrelay') {
      const cp = it.cp || (seul && normaliserSuivi(seul) === it.suivi && /^\d{5}$/.test(String(cpSeul || '')) ? String(cpSeul) : '');
      if (cp) out.push({ carrier: it.carrier, suivi: it.suivi, cp, voie: VOIE_DE.mondialrelay });
      continue;
    }
    out.push({ carrier: it.carrier, suivi: it.suivi, cp: null, voie: VOIE_DE[it.carrier] });
  }
  return out;
}

// ══ LA PAUSE PAR TRANSPORTEUR (C2) ═══════════════════════════════════════════
export const PAUSE_MS = [30, 60, 120, 360, 1440].map((m) => m * 60000);
export const PAUSE_OUBLI_MS = 24 * 3600000;
export const RETRY_AFTER_MAX_MS = 48 * 3600000;
export const enPause = (pause, carrier, maintenant = Date.now()) => { const p = pause && pause[carrier]; const j = p && msDe(p.jusqua); return j != null && j > maintenant; };
// La pause posée après un refus (403, 429, défi, HTML, 401 Mondial Relay).
export function pauseApresRefus(pause, carrier, { statut = 0, ctype = '', retryAfter = null, maintenant = Date.now() } = {}) {
  const p = { ...(pause && typeof pause === 'object' ? pause : {}) };
  delete p.rev;
  const cur = p[carrier] && typeof p[carrier] === 'object' ? p[carrier] : {};
  const recent = msDe(cur.dernier && cur.dernier.at) != null && maintenant - msDe(cur.dernier.at) < PAUSE_OUBLI_MS;
  const palier = recent ? Math.min((Number(cur.palier) || 0) + 1, PAUSE_MS.length - 1) : 0;
  let duree = PAUSE_MS[palier];
  const ra = Number(retryAfter);
  if (Number.isFinite(ra) && ra > 0) duree = Math.max(duree, Math.min(ra * 1000, RETRY_AFTER_MAX_MS));
  p.v = 1;
  p[carrier] = { jusqua: new Date(maintenant + duree).toISOString(), palier, dernier: { statut: Number(statut) || 0, ctype: propre(ctype, 60), at: new Date(maintenant).toISOString() } };
  return p;
}
export function pauseLevee(pause, carrier) {
  if (!pause || !pause[carrier] || !pause[carrier].jusqua) return undefined;
  const p = { ...pause }; delete p.rev;
  p[carrier] = { ...p[carrier], jusqua: null, palier: 0 };
  return p;
}
export const pausePublique = (pause) => { const o = {}; for (const c of CARRIERS_LUS) o[c] = pause && pause[c] && pause[c].jusqua ? pause[c].jusqua : null; return o; };

// ══ LES NOTIFICATIONS (§1.8) ═════════════════════════════════════════════════
export const NOTIF_AGE_MAX_MS = 72 * 3600000;
const lieuNorm = (t) => normLibelle(`${t.lieuNom || ''} ${t.lieuCp || ''}`).replace(/[^a-z0-9]+/g, '');
// Ce qu'un CHANGEMENT d'état doit dire (un libellé qui change sans changer
// l'état ne sonne pas). `avant`/`apres` : la ligne avant et après l'essai.
// Rend { etat, cle, categorie, fait, prefixesSilence } ou null.
export function changementANotifier(avant, apres, { maintenant = Date.now(), arriveeMs = null, silence = false } = {}) {
  if (silence || !apres || apres.essaiRes !== 'ok' || !apres.etat) return null;
  const at = msDe(apres.etatAt);
  if (at == null || maintenant - at > NOTIF_AGE_MAX_MS || at > maintenant + 10 * 60000) return null;
  const a = avant && avant.etat ? avant : null;
  const k = normaliserSuivi(apres.suivi);
  const fait = `${apres.etat}|${apres.detail || ''}|${apres.etat === 'disponible' ? lieuNorm(apres) : ''}`;
  if (a && `${a.etat}|${a.detail || ''}|${a.etat === 'disponible' ? lieuNorm(a) : ''}` === fait) return null;
  const e = apres.etat;
  if (e === 'disponible') return { etat: e, fait, categorie: 'colis', cle: `relais-${k}-sans`, prefixesSilence: [`relais-${k}-`] };
  if (e === 'retour_expediteur') return { etat: e, fait, categorie: 'colis', cle: `retour-${k}`, prefixesSilence: [] };
  if (e === 'incident') return { etat: e, fait, categorie: 'colis', cle: `incident-${k}-${apres.detail || 'x'}`, prefixesSilence: [] };
  if (e === 'inconnu') {
    const apresArrivee = (a && a.etat === 'disponible') || (Number.isFinite(arriveeMs) && arriveeMs && at >= arriveeMs);
    if (!apresArrivee) return null;
    return { etat: e, fait: `${fait}|${empreinte(normLibelle(apres.libelle))}`, categorie: 'colis', cle: `inconnu-${k}-${empreinte(normLibelle(apres.libelle))}`, prefixesSilence: [] };
  }
  if (e === 'retire' || e === 'livre') return { etat: e, fait, categorie: 'suivi', cle: `retire-${k}`, prefixesSilence: [] };
  if (e === 'en_route') { if (a) return null; return { etat: e, fait, categorie: 'suivi', cle: `track-${k}`, prefixesSilence: [] }; }
  return null;
}
const jjmm = (d) => { const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}/${m[2]}` : ''; };
const jjmmDe = (iso) => { const ms = msDe(iso); return ms == null ? '' : jjmm(jourParis(ms)); };
export function lieuCourtTransp(t) {
  const nom = propre(t && t.lieuNom, 45);
  const ville = propre(t && t.lieuVille, 30);
  return nom ? (ville ? `${nom} (${ville})` : nom) : ville;
}
export function texteNotifTransp(t, ch) {
  const nom = nomTransporteur(t.carrier);
  const lieu = lieuCourtTransp(t);
  const n = `n°${t.suivi}`;
  if (ch.etat === 'disponible') {
    const lim = jjmm(t.limite);
    const limTxt = lim ? ` — à retirer ${t.limiteSure ? "jusqu'au" : 'vers le'} ${lim}` : '';
    return { title: `📍 ${nom} : disponible au point relais`, body: `${lieu || n}${limTxt}${lieu ? ` · ${n}` : ''}${t.detail === 'autre_point' ? ' · un autre point relais que prévu' : ''}` };
  }
  if (ch.etat === 'incident' && t.detail === 'quitte_relais') return { title: `⚠️ ${nom} : ton colis a quitté le point relais sans être retiré`, body: `Ne te déplace pas : ${n}${lieu ? ` (${lieu})` : ''}.` };
  if (ch.etat === 'incident') return { title: `⚠️ ${nom} : un problème sur ton colis`, body: `« ${propre(t.libelle, 120)} » — vérifie avant de te déplacer · ${n}` };
  if (ch.etat === 'retour_expediteur') return { title: `↩️ ${nom} : ton colis repart chez l'expéditeur`, body: `Ne te déplace pas : ${n}. La conversation Vinted dit si tu es remboursé.` };
  if (ch.etat === 'inconnu') return { title: `⚠️ ${nom} : « ${propre(t.libelle, 80)} »`, body: `VRM ne connaît pas encore ce statut — vérifie avant de te déplacer · ${n}` };
  if (ch.etat === 'retire') return { title: `✅ ${nom} : retiré${jjmmDe(t.etatAt) ? ` le ${jjmmDe(t.etatAt)}` : ''}`, body: `${lieu ? `Au point ${lieu} · ` : ''}${n}` };
  if (ch.etat === 'livre') return { title: `✅ ${nom} : livré${jjmmDe(t.etatAt) ? ` le ${jjmmDe(t.etatAt)}` : ''}`, body: n };
  return { title: `🚚 ${nom} : ton colis est en route`, body: `« ${propre(t.libelle, 120)} » · ${n}` };
}

// ══ CE QUE DIT LA CARTE D'UN COLIS (l'app) ═══════════════════════════════════
const ageCourt = (ms) => { if (!Number.isFinite(ms) || ms < 0) return ''; const m = Math.round(ms / 60000); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; const h = Math.round(m / 60); if (h < 36) return `il y a ${h} h`; return `il y a ${Math.round(h / 24)} j`; };
const AMBRE = new Set(['retour_expediteur', 'incident', 'inconnu']);
// `t` : la ligne `transp_` (ou undefined : jamais lue). Rend
// { etatAffiche, texte, consequence, ambre, age } — `etatAffiche` ∈
// 'lu' · 'passu' · 'jamais' · 'cp-inconnu' · 'expire' · 'introuvable'.
export function ligneTransporteur(t, carrier, maintenant = Date.now()) {
  const nom = nomTransporteur((t && t.carrier) || carrier);
  if (!t) return { etatAffiche: 'jamais', texte: `${nom} : pas encore lu chez le transporteur`, consequence: '', ambre: false, age: null };
  const luMs = msDe(t.lu);
  if (t.etat && luMs != null) {
    const age = maintenant - luMs;
    const dernierRate = t.essaiRes && t.essaiRes !== 'ok';
    const lieu = lieuCourtTransp(t);
    const quand = jjmmDe(t.etatAt);
    let consequence = '';
    if (t.etat === 'retire') consequence = `retiré${quand ? ` le ${quand}` : ''}${lieu ? ` au point ${lieu}` : ''}`;
    else if (t.etat === 'livre') consequence = `livré${quand ? ` le ${quand}` : ''}`;
    else if (t.etat === 'disponible') consequence = `disponible${lieu ? ` au point ${lieu}` : ''}${t.limite ? ` — à retirer ${t.limiteSure ? "jusqu'au" : 'vers le'} ${jjmm(t.limite)}` : ''}`;
    else if (t.etat === 'retour_expediteur') consequence = t.detail === 'rendu' ? "rendu à l'expéditeur — ne te déplace pas" : "repart chez l'expéditeur — ne te déplace pas";
    else if (t.etat === 'incident') consequence = t.detail === 'quitte_relais' ? 'a quitté le point relais sans être retiré — ne te déplace pas' : 'un problème signalé — vérifie avant de te déplacer';
    else if (t.etat === 'inconnu') consequence = 'statut que VRM ne connaît pas encore — vérifie avant de te déplacer';
    else if (t.etat === 'en_route') consequence = t.detail === 'prepare' ? "pas encore remis au transporteur" : (t.detail === 'retarde' ? 'en route, retardé' : 'en route');
    return { etatAffiche: 'lu', texte: `${nom} : « ${propre(t.libelle, 120) || '—'} » · lu ${ageCourt(age)}${dernierRate ? ' (la lecture suivante n’a pas abouti)' : ''}`, consequence, ambre: AMBRE.has(t.etat), age };
  }
  if (t.essaiRes === 'cp-inconnu') return { etatAffiche: 'cp-inconnu', texte: `${nom} : code postal du point relais inconnu — ajoute ce n° avec son code postal dans « N° de suivi ajoutés » (Achats → À retirer)`, consequence: '', ambre: false, age: null };
  if (t.essaiRes === 'expire') return { etatAffiche: 'expire', texte: `${nom} ne garde plus ce suivi`, consequence: '', ambre: false, age: null };
  if (t.essaiRes === 'introuvable') return { etatAffiche: 'introuvable', texte: `${nom} ne trouve pas ce n° (pas encore enregistré ?)`, consequence: '', ambre: false, age: null };
  // Un REFUS (403, défi, HTML) n'est pas « n'a pas répondu » : on le dit tel quel.
  if (t.essaiRes === 'bloque') return { etatAffiche: 'passu', texte: `${nom} refuse la lecture depuis le serveur pour l'instant — VRM réessaie plus tard`, consequence: '', ambre: false, age: null };
  if (t.essaiRes) return { etatAffiche: 'passu', texte: `${nom} n'a pas répondu — VRM réessaie plus tard`, consequence: '', ambre: false, age: null };
  return { etatAffiche: 'jamais', texte: `${nom} : pas encore lu chez le transporteur`, consequence: '', ambre: false, age: null };
}
