// ════════════════════════════════════════════════════════════════════════════
//  LA CLÉ PHOTOROOM DU VENDEUR, DANS LE COFFRE DU SERVEUR (29 octobre)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « fais un meilleur visuel pour la clé API Photoroom des personnes qui
// utilisent VRM ». Règle §2.9 : un détourage se paie à la photo — c'est le
// compte Photoroom DU VENDEUR qui paie, jamais celui de Julien pour les autres.
//
// Avant (26 octobre) la clé vivait EN CLAIR dans `app_data.vrm_photoroom_cle`,
// écrite ET relue par le navigateur. Maintenant, comme Super PDP :
// · le navigateur l'envoie UNE fois (`poser`) ; le serveur la vérifie chez
//   Photoroom (lecture du compte, gratuite), la CHIFFRE (api/_lib/coffre.js,
//   usage « photoroom-v1 ») et la range dans `app_data.photoroom_cle` ;
// · le navigateur n'en apprend plus que : posée ou non, ses 4 derniers
//   caractères, la date, ce que Photoroom a répondu à la vérification ;
// · sans clé de coffre : RIEN n'est rangé (jamais en clair) ;
// · « pas su » ne vaut jamais « aucune clé » (lecture ratée ⇒ 503) ;
// · la ligne en clair d'avant est DÉPLACÉE dans le coffre à la première
//   lecture (puis effacée) ; tant qu'elle existe, le détourage la lit encore.
//
// ── CE QUI EST DOCUMENTÉ, ET D'OÙ ÇA VIENT ──────────────────────────────────
// ⚠️ docs.photoroom.com n'est PAS joignable d'ici. D'après les pages indexées
//    (« How can I check my API usage? ») : `GET https://image-api.photoroom.com
//    /v2/account`, en-tête `x-api-key`, réponse `{ images: { available,
//    subscription } }` (l'ancienne `/v1/account` rendait `credits`) ; un appel
//    en erreur ne consomme aucune image ; 402 = aucune formule API active.
//    Ce qui n'est PAS supposé : un 401/403 est lu « clé refusée » (rien n'est
//    rangé) ; tout le reste (404, 5xx, coupure, forme inconnue) est « pas
//    encore vérifiée » — la clé est rangée et c'est DIT.
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { coffrePret, chiffrerCoffre, dechiffrerCoffre } from './coffre.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
export const ID_CLE = 'photoroom_cle';
export const ID_ANCIENNE = 'vrm_photoroom_cle';
export const USAGE = 'photoroom-v1';
export const PHOTOROOM_COMPTE = 'https://image-api.photoroom.com/v2/account';
const DELAI_MS = Number(process.env.PHOTOROOM_VERIF_DELAI_MS) || 8000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Une clé : des caractères imprimables, sans espace, 16 à 200. Rien de plus
// supposé sur sa forme (Photoroom ne la documente pas d'ici).
export const CLE_RE = /^[\x21-\x7e]{16,200}$/;
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';
export const finDe = (cle) => String(cle || '').slice(-4);
const VERIFS = new Set(['ok', 'sans-forfait', 'refusee', 'pas-su']);

const enTetes = () => ({ ...sbCle(sbKey()) });
const ligne = (id, owner) => `${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}&owner=eq.${encodeURIComponent(owner)}`;

// La ligne du coffre. TROIS états : `undefined` pas su · `null` aucune ·
// `{chiffre, fin, at, verif, verifAt, restant, migreeLe, rev}`.
async function lireLigneCoffre(owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetch(`${ligne(ID_CLE, owner)}&select=chiffre:data->>chiffre,fin:data->>fin,at:data->>at,verif:data->>verif,verifAt:data->>verifAt,restant:data->restant,migreeLe:data->>migreeLe,rev:data->>rev`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    if (!rows[0] || !rows[0].chiffre) return null;
    return rows[0];
  } catch (_) { return undefined; }
}
// L'ancienne ligne EN CLAIR (26 octobre). `undefined` pas su · `null` aucune ·
// `{cle, at}`.
async function lireAncienne(owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetch(`${ligne(ID_ANCIENNE, owner)}&select=cle:data->>cle,at:data->>at`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    const c = rows[0] && typeof rows[0].cle === 'string' ? rows[0].cle.trim() : '';
    return c ? { cle: c, at: rows[0].at || null } : null;
  } catch (_) { return undefined; }
}

// ── LES ÉCRITURES DU COFFRE (29 octobre, revue) ─────────────────────────────
// Chaque écriture pose un `rev` NEUF (un jeton au hasard). Toute écriture qui
// part d'une LECTURE (la vérification, la migration de l'ancienne ligne) est un
// comparer-et-échanger : elle n'écrit que si la ligne est encore celle qu'elle a
// lue (`data->>rev`) — sinon une clé RETIRÉE pendant la vérification (un autre
// onglet, un autre appareil) revenait au coffre et resservait au détourage.
// `poser` (une clé neuve, collée à l'instant) reste un remplacement simple.
const nouveauRev = () => crypto.randomBytes(9).toString('base64url');
const condRev = (rev) => (rev == null || rev === '' ? 'data->>rev=is.null' : `data->>rev=eq.${encodeURIComponent(String(rev))}`);
const condAt = (at) => (at == null || at === '' ? 'data->>at=is.null' : `data->>at=eq.${encodeURIComponent(String(at))}`);
const corpsCoffre = (chiffre, cle, info, rev) => ({ v: 1, chiffre, fin: finDe(cle), ...info, rev });

// Remplacement simple (poser). true · false.
async function rangerCoffre(owner, cle, info) {
  const chiffre = chiffrerCoffre(USAGE, owner, { cle });
  if (!chiffre) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...enTetes(), 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id: ID_CLE, data: corpsCoffre(chiffre, cle, info, nouveauRev()) }]),
    });
    return r.ok;
  } catch (_) { return false; }
}
// Création SEULEMENT si aucune ligne n'existe (la migration). Rend
// `{ok:'ok', rev}` · `{ok:'conflit'}` (une ligne existe déjà) · `{ok:'ko'}`.
async function creerCoffre(owner, cle, info) {
  const chiffre = chiffrerCoffre(USAGE, owner, { cle });
  if (!chiffre) return { ok: 'ko' };
  const rev = nouveauRev();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
      method: 'POST',
      headers: { ...enTetes(), 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify([{ owner, id: ID_CLE, data: corpsCoffre(chiffre, cle, info, rev) }]),
    });
    if (r.ok) return { ok: 'ok', rev };
    return { ok: r.status === 409 ? 'conflit' : 'ko' };
  } catch (_) { return { ok: 'ko' }; }
}
// Comparer-et-échanger sur une ligne LUE (`revLu`). Rend 'ok' · 'conflit'
// (la ligne a changé ou disparu entre-temps : RIEN n'est écrit) · 'ko'.
async function modifierCoffreSi(owner, revLu, data) {
  try {
    const r = await fetch(`${ligne(ID_CLE, owner)}&${condRev(revLu)}&select=id`, {
      method: 'PATCH',
      headers: { ...enTetes(), 'content-type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ data: { ...data, rev: nouveauRev() } }),
    });
    if (!r.ok) return 'ko';
    const out = await r.json().catch(() => null);
    if (!Array.isArray(out)) return 'ko';
    return out.length ? 'ok' : 'conflit';
  } catch (_) { return 'ko'; }
}
async function effacer(id, owner) {
  try {
    const r = await fetch(ligne(id, owner), { method: 'DELETE', headers: { ...enTetes(), Prefer: 'return=minimal' } });
    return r.ok;
  } catch (_) { return false; }
}
// Efface l'ancienne ligne EN CLAIR seulement si elle est encore celle qu'on a
// lue (même date). Rend 'ok' (effacée) · 'absente' (plus là, ou réécrite) · 'ko'.
async function effacerAncienneLue(owner, a) {
  try {
    const r = await fetch(`${ligne(ID_ANCIENNE, owner)}&${condAt(a.at)}&select=id`, { method: 'DELETE', headers: { ...enTetes(), Prefer: 'return=representation' } });
    if (!r.ok) return 'ko';
    const out = await r.json().catch(() => null);
    if (!Array.isArray(out)) return 'ko';
    return out.length ? 'ok' : 'absente';
  } catch (_) { return 'ko'; }
}
// Défaire NOTRE création (et elle seule : filtrée sur notre `rev`).
async function defaireCreation(owner, rev) {
  try { await fetch(`${ligne(ID_CLE, owner)}&${condRev(rev)}`, { method: 'DELETE', headers: { ...enTetes(), Prefer: 'return=minimal' } }); } catch (_) {}
}

// ── LA CLÉ, POUR LE SERVEUR SEUL (détourage) ────────────────────────────────
// Rend la clé (chaîne) · '' (aucune, ou chiffré illisible) · undefined (pas su).
// Le coffre d'abord ; l'ancienne ligne en clair tant qu'elle existe.
export async function lireClePhotoroom(owner) {
  const c = await lireLigneCoffre(owner);
  if (c === undefined) return undefined;
  if (c) {
    const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
    return d && typeof d.cle === 'string' ? d.cle : '';
  }
  const a = await lireAncienne(owner);
  if (a === undefined) return undefined;
  return a ? a.cle : '';
}

// ── LA VÉRIFICATION CHEZ PHOTOROOM (gratuite : lecture du compte) ───────────
// `{verif: 'ok'|'sans-forfait'|'refusee'|'pas-su', restant: nombre|null, forme?}`.
// ⚠️ (29 oct., revue) « acceptée » se juge sur la FORME de la réponse, pas sur
// le code 200 : une page de portail, de proxy ou de CDN répond 200 en HTML, et
// la clé n'y est jugée par personne. On exige un JSON qui porte `images` (ou
// `credits`, l'ancienne forme) en OBJET avec `available` ou `subscription`.
// Tout autre 200 ⇒ « pas su », et sa FORME (noms de clés et types, jamais une
// valeur) est notée pour la passe suivante.
const formeDe = (j, prefixe = '', prof = 0) => {
  if (j === null) return [prefixe + ':null'];
  if (Array.isArray(j)) return [prefixe + ':tableau'];
  if (typeof j !== 'object') return [prefixe + ':' + typeof j];
  if (prof >= 2) return [prefixe + ':objet'];
  return Object.keys(j).slice(0, 12).flatMap((k) => formeDe(j[k], prefixe ? prefixe + '.' + k : k, prof + 1));
};
export async function verifierChezPhotoroom(cle) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const r = await fetch(PHOTOROOM_COMPTE, { method: 'GET', signal: ctrl.signal, headers: { 'x-api-key': cle, accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) return { verif: 'refusee', restant: null };
    if (r.status === 402) return { verif: 'sans-forfait', restant: null };
    if (!r.ok) return { verif: 'pas-su', restant: null };
    const texte = await r.text().catch(() => '');
    let j = null; try { j = JSON.parse(texte); } catch (_) { j = null; }
    const bloc = j && typeof j === 'object' && !Array.isArray(j) ? (j.images || j.credits || null) : null;
    const attendue = !!(bloc && typeof bloc === 'object' && !Array.isArray(bloc) && ('available' in bloc || 'subscription' in bloc));
    if (!attendue) {
      const forme = j && typeof j === 'object' ? formeDe(j).join(',').slice(0, 300) : `non-json:${String(r.headers.get('content-type') || '?').split(';')[0]}`;
      console.warn(`[photoroom] v2/account a répondu 200 sous une forme inconnue (${forme}) : clé « pas encore vérifiée »`);
      return { verif: 'pas-su', restant: null, forme };
    }
    const n = Number.isFinite(Number(bloc.available)) && bloc.available !== null && bloc.available !== '' && typeof bloc.available !== 'boolean' ? Number(bloc.available) : null;
    return { verif: 'ok', restant: n };
  } catch (_) { return { verif: 'pas-su', restant: null }; }
  finally { clearTimeout(t); }
}

// ── CE QUE LE NAVIGATEUR APPREND ────────────────────────────────────────────
// Jamais la clé, jamais le chiffré, jamais le `rev`.
const publique = (c, extra = {}) => ({
  ok: true, coffre: coffrePret(),
  etat: c.etat, fin: c.fin || null, at: c.at || null,
  verif: VERIFS.has(c.verif) ? c.verif : 'pas-su', verifAt: c.verifAt || null,
  restant: Number.isFinite(Number(c.restant)) && c.restant !== null ? Number(c.restant) : null,
  migreeLe: c.migreeLe || null,
  ...extra,
});
const repondre = (res, code, corps) => res.status(code).json(corps);
const MSG_PAS_SU = "Je n'ai pas pu lire ta clé Photoroom (la base n'a pas répondu). Rouvre cet écran dans un moment.";
// Ce qu'on garde d'une ligne du coffre quand on la réécrit (jamais `rev`).
const infoDe = (c) => ({ at: c.at || null, verif: c.verif || 'pas-su', verifAt: c.verifAt || null, restant: Number.isFinite(Number(c.restant)) && c.restant !== null ? Number(c.restant) : null, ...(c.migreeLe ? { migreeLe: c.migreeLe } : {}) });
const tempsDe = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : null; };

// L'état, et la migration de l'ancienne ligne en clair. `profondeur` borne la
// relecture après une course (une écriture concurrente) : jamais une boucle.
export async function statut(owner, res, profondeur = 0, extra = {}) {
  const c = await lireLigneCoffre(owner);
  if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (c) {
    const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
    const lisible = !!(d && typeof d.cle === 'string');
    // ⚠️ (revue) L'ancienne ligne EN CLAIR peut avoir survécu (son effacement a
    // échoué à la migration, ou à `poser`) : elle reste LISIBLE par le
    // navigateur tant qu'elle est là. On la cherche à CHAQUE ouverture et on
    // l'efface — jamais « effacée » dit sans que la base l'ait confirmé.
    const a = await lireAncienne(owner);
    if (!a) return repondre(res, 200, publique({ ...c, etat: lisible ? 'posee' : 'illisible' }, extra));   // aucune · pas su : rien à dire
    // Une clé DIFFÉRENTE et plus récente que celle du coffre (écrite par une
    // ancienne version de l'app restée ouverte), ou un coffre devenu illisible :
    // l'ancienne REMPLACE celle du coffre (comparer-et-échanger : rien si le
    // coffre a bougé entre-temps).
    let migree = false;
    const plusRecente = lisible && a.cle !== d.cle && tempsDe(a.at) != null && tempsDe(a.at) > (tempsDe(c.at) || 0);
    if ((plusRecente || !lisible) && coffrePret()) {
      const chiffre = chiffrerCoffre(USAGE, owner, { cle: a.cle });
      const maintenant = new Date().toISOString();
      const w = chiffre ? await modifierCoffreSi(owner, c.rev, corpsCoffre(chiffre, a.cle, { at: a.at, verif: 'pas-su', verifAt: null, restant: null, migreeLe: maintenant }, undefined)) : 'ko';
      if (w !== 'ok') return repondre(res, 200, publique({ ...c, etat: lisible ? 'posee' : 'illisible' }, { ancienneEffacee: false }));
      migree = true;
    }
    const e = await effacerAncienneLue(owner, a);
    if (migree || e === 'absente') return profondeur < 2 ? statut(owner, res, profondeur + 1, migree ? { migree: true, ancienneEffacee: e === 'ok' } : {}) : repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
    return repondre(res, 200, publique({ ...c, etat: lisible ? 'posee' : 'illisible' }, { ...extra, ancienneEffacee: e === 'ok' }));
  }
  // Pas de coffre : l'ancienne ligne en clair ?
  const a = await lireAncienne(owner);
  if (a === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (!a) return repondre(res, 200, publique({ etat: 'aucune' }, extra));
  // Elle existe : on la DÉPLACE dans le coffre (puis on efface la claire).
  // Sans coffre, elle reste en clair — et l'écran dit POURQUOI (`cause`).
  if (!coffrePret()) return repondre(res, 200, publique({ etat: 'en-clair', fin: finDe(a.cle), at: a.at }, { cause: 'coffre-absent' }));
  const maintenant = new Date().toISOString();
  const info = { at: a.at || maintenant, verif: 'pas-su', verifAt: null, restant: null, migreeLe: maintenant };
  // Création SEULEMENT si aucune ligne n'existe : une clé posée entre-temps
  // (un autre onglet) n'est jamais écrasée par l'ancienne.
  const w = await creerCoffre(owner, a.cle, info);
  if (w.ok === 'conflit') return profondeur < 2 ? statut(owner, res, profondeur + 1) : repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (w.ok !== 'ok') return repondre(res, 200, publique({ etat: 'en-clair', fin: finDe(a.cle), at: a.at }, { cause: 'rangement-rate' }));
  const e = await effacerAncienneLue(owner, a);
  if (e === 'absente') {
    // L'ancienne n'est plus celle qu'on a lue : un « Retirer » (ou une nouvelle
    // clé) est passé ENTRE notre lecture et notre écriture. On défait NOTRE
    // création (filtrée sur notre `rev` : jamais une clé posée par un autre),
    // sinon la clé retirée reviendrait au coffre. Puis on relit.
    await defaireCreation(owner, w.rev);
    return profondeur < 2 ? statut(owner, res, profondeur + 1) : repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  }
  return repondre(res, 200, publique({ ...info, fin: finDe(a.cle), etat: 'posee' }, { migree: true, ancienneEffacee: e === 'ok' }));
}

export async function poser(owner, corps, res) {
  const cle = typeof (corps && corps.cle) === 'string' ? corps.cle.trim() : '';
  if (!CLE_RE.test(cle)) return repondre(res, 400, { erreur: 'cle', message: "Ce n'est pas une clé Photoroom (une suite de lettres et de chiffres, sans espace). Rien n'a été rangé." });
  if (!coffrePret()) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const v = await verifierChezPhotoroom(cle);
  if (v.verif === 'refusee') return repondre(res, 400, { erreur: 'refusee', message: "Photoroom refuse cette clé (elle n'existe pas ou a été désactivée). Rien n'a été rangé." });
  const maintenant = new Date().toISOString();
  const info = { at: maintenant, verif: v.verif, verifAt: v.verif === 'pas-su' ? null : maintenant, restant: v.restant, ...(v.forme ? { verifForme: v.forme } : {}) };
  if (!(await rangerCoffre(owner, cle, info))) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu ranger ta clé : rien n'a changé. Réessaie." });
  // L'ancienne ligne en clair (s'il y en avait une) ne doit plus servir. Si
  // l'effacement échoue, la prochaine ouverture de la carte le refait.
  const effacee = await effacer(ID_ANCIENNE, owner);
  return repondre(res, 200, publique({ ...info, fin: finDe(cle), etat: 'posee' }, { ancienneEffacee: effacee }));
}

// Vérifier : une LECTURE du compte Photoroom, et rien d'autre.
// ⚠️ (29 oct., revue) Photoroom muet (coupure, 5xx, forme inconnue) ⇒ on
// n'écrit RIEN : la dernière réponse connue (acceptée, refusée, sans forfait)
// reste — un hoquet n'efface pas un REFUS (le Studio reproposait alors le
// détourage) ni « acceptée, 83 images ». La réponse dit `sansReponse`.
export async function verifier(owner, res) {
  const c = await lireLigneCoffre(owner);
  if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (!c) return repondre(res, 409, { erreur: 'aucune', message: "Aucune clé Photoroom n'est rangée." });
  const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
  if (!d || typeof d.cle !== 'string') return repondre(res, 409, { erreur: 'illisible', message: 'Ta clé ne se lit plus côté serveur : colle-la de nouveau.' });
  const v = await verifierChezPhotoroom(d.cle);
  if (v.verif === 'pas-su') return repondre(res, 200, publique({ ...c, fin: c.fin || finDe(d.cle), etat: 'posee' }, { sansReponse: true }));
  const maintenant = new Date().toISOString();
  const info = { ...infoDe(c), verif: v.verif, verifAt: maintenant, restant: v.verif === 'ok' ? v.restant : null };
  // Comparer-et-échanger : la clé a pu être RETIRÉE (ou remplacée) pendant
  // qu'on attendait Photoroom — alors on n'écrit rien (sinon elle reviendrait).
  const w = await modifierCoffreSi(owner, c.rev, corpsCoffre(c.chiffre, d.cle, info, undefined));
  if (w === 'conflit') return repondre(res, 409, { erreur: 'changee', message: "Ta clé a été retirée ou remplacée pendant la vérification (un autre onglet ?) : rien n'a été noté." });
  if (w !== 'ok') return repondre(res, 503, { erreur: 'base', message: "Photoroom a répondu, mais la base n'a pas pu le noter. Réessaie." });
  return repondre(res, 200, publique({ ...info, fin: finDe(d.cle), etat: 'posee' }));
}

// Retirer : les DEUX lignes (coffre + ancienne en clair). « Retirée » n'est dit
// que si les deux effacements ont abouti — sinon le détourage la lirait encore.
export async function retirer(owner, corps, res) {
  if (!corps || corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation', message: 'Confirme le retrait de ta clé.' });
  const a = await effacer(ID_CLE, owner);
  const b = await effacer(ID_ANCIENNE, owner);
  if (!a || !b) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta clé est peut-être toujours rangée. Réessaie." });
  return repondre(res, 200, publique({ etat: 'aucune' }));
}

// Le point d'entrée du mode `photoroom` de /api/compte. La session est déjà
// vérifiée par l'appelant (vendeurExige).
export async function routePhotoroom(req, res, { vendeur, corps, acces, cloisonnee }) {
  // Base pas cloisonnée (ou pas su) : une ligne rangée ne serait pas à LUI seul.
  if (cloisonnee === null || cloisonnee === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (cloisonnee !== true) return repondre(res, 503, { erreur: 'base', message: "La base ne sépare pas encore les vendeurs : aucune clé n'est rangée tant que ce n'est pas le cas." });
  const owner = vendeur.id;
  if (req.method === 'GET') return statut(owner, res);
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST' });
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'corps' });
  const action = String(corps.action || '');
  // Retirer son secret reste TOUJOURS possible, même abonnement coupé.
  if (action === 'retirer') return retirer(owner, corps, res);
  if (acces === false) return repondre(res, 402, { erreur: 'abonnement', message: "Ton abonnement VRM est coupé : la clé n'est pas utilisée." });
  if (action === 'poser') return poser(owner, corps, res);
  if (action === 'verifier') return verifier(owner, res);
  return repondre(res, 400, { erreur: 'action inconnue' });
}
