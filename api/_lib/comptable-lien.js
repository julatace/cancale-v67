// ═══════════════════════════════════════════════════════════════════════════
// « UN LIEN POUR TON COMPTABLE » — lecture seule de la compta (14 nov., lot
// argent-prix — proposition 115 validée par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Un lien `https://vrm.center/c/<jeton>` (vercel.json → `/?comptable=<jeton>`,
// la page lit `/api/compte?mode=comptable&j=<jeton>`) : AUCUNE fonction `api/`
// neuve (12 au plus), le modèle est l'agenda .ics (api/_lib/agenda-ics.js).
//
// LE JETON — signé, expirant, révocable :
//   `<aléa 24 octets>.<expiration base 36>.<signature>` ; la signature est un
//   HMAC-SHA256 (clé serveur `COMPTABLE_SECRET`, sinon la clé de service) de
//   l'aléa et de l'expiration : une expiration retouchée ne passe pas. Le jeton
//   est rangé dans SA ligne `vrm_comptable` et indexé par son EMPREINTE chez le
//   propriétaire neutre (api/_lib/jeton-index.js, genre `comptable`), toujours
//   RE-COMPARÉ à durée constante. Expiré ⇒ 404 ; coupé ⇒ 404 ; remplacé ⇒ 404.
//   Le jeton n'est créé, publié ou coupé QUE par le serveur, sur sa session.
//
// CE QUE LE COMPTABLE VOIT — la COMPTA SEULE (`vueComptable`, une liste
// BLANCHE appliquée côté serveur à l'écriture ET à la lecture) :
//   période, statut, taux, CA déclaré mois par mois (daté au versement) et le
//   registre « noté déclaré », URSSAF, le livre des recettes (date de vente, de
//   versement, plateforme, N°, référence, article, montant, frais lus), les ventes
//   « à dater », le registre des achats (date, plateforme, référence, N°, article,
//   coût saisi, montant lu), les couvertures (« au moins », manques nommés).
//   JAMAIS : un nom d'acheteur ou de vendeur (fournisseur), un pseudo de compte,
//   un message, une adresse, un e-mail, un code, une photo, un lien.
// LE JOURNAL DES ACCÈS — chaque lecture réussie est notée dans `vrm_comptable_acces`
//   (date, famille de navigateur ; jamais une adresse IP), 100 au plus ; il le voit.
// Trois états : une lecture ratée ⇒ 503, jamais une compta vide servie pour « rien ».
// Tenu par scripts/audit-argent-prix.cjs (section 115, EXÉCUTE la route).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { vendeurParIndex, ecrireIndexJeton, retirerIndexJeton, memeJeton } from './jeton-index.js';
import { fetchAvecDelai } from './fetch-delai.js';

export const LIGNE_COMPTABLE = 'vrm_comptable';
export const LIGNE_ACCES = 'vrm_comptable_acces';
export const DUREES_J = [7, 30, 90, 365];
export const ACCES_MAX = 100;
export const PERIODES_MAX = 8;
export const RE_JETON_COMPTABLE = /^[A-Za-z0-9_-]{32}\.[0-9a-z]{6,10}\.[A-Za-z0-9_-]{22}$/;
const RE_PERIODE = /^\d{4}(-(0[1-9]|1[0-2]|T[1-4]))?$/;

const secret = (env) => String((env && (env.COMPTABLE_SECRET || env.SUPABASE_SERVICE_KEY)) || '');
const signer = (cle, alea, exp36) => crypto.createHmac('sha256', cle).update(`comptable:${alea}.${exp36}`).digest('base64url').slice(0, 22);
export function nouveauJetonComptable(cle, expMs) {
  const alea = crypto.randomBytes(24).toString('base64url');
  const exp36 = Math.floor(expMs).toString(36);
  return `${alea}.${exp36}.${signer(cle, alea, exp36)}`;
}
// { ok, exp } — la signature et l'expiration, sans aucune lecture de base.
export function verifierJetonComptable(jeton, cle, maintenant = Date.now()) {
  const j = String(jeton || '');
  if (!cle || !RE_JETON_COMPTABLE.test(j)) return { ok: false, raison: 'forme' };
  const [alea, exp36, sig] = j.split('.');
  const attendu = signer(cle, alea, exp36);
  if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(sig))) return { ok: false, raison: 'signature' };
  const exp = parseInt(exp36, 36);
  if (!Number.isFinite(exp) || exp <= maintenant) return { ok: false, raison: 'expire', exp };
  return { ok: true, exp };
}
export const urlComptable = (jeton, origine = 'https://vrm.center') => (jeton ? `${origine}/c/${jeton}` : '');

// ── LA LISTE BLANCHE ────────────────────────────────────────────────────────
const txt = (v, n = 90) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const eur = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const ent = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
const bool = (v) => v === true;
const PLATS = new Set(['Vinted', 'Leboncoin', 'eBay', 'Vestiaire', 'Vestiaire Collective', 'Autre']);
const plat = (v) => (PLATS.has(String(v)) ? String(v) : 'Autre');
const liste = (x, f, max = 5000) => (Array.isArray(x) ? x.slice(0, max).map(f) : null);
// Une vue = la sortie de `donneesExportComptable` (src/exportComptable.js) RÉDUITE à la compta.
export function vueComptable(d) {
  if (!d || typeof d !== 'object' || !RE_PERIODE.test(String(d.periode || ''))) return null;
  return {
    periode: String(d.periode), libelle: txt(d.libelle, 40), etabliLe: txt(d.etabliLe, 20),
    entreprise: d.entreprise && typeof d.entreprise === 'object' ? { nom: txt(d.entreprise.nom, 80), siret: txt(d.entreprise.siret, 20).replace(/[^\d ]/g, '') } : null,
    regime: d.regime == null ? null : txt(d.regime, 20), regimeTexte: txt(d.regimeTexte, 60), taux: eur(d.taux),
    caParMois: liste(d.caParMois, (m) => ({ ym: txt(m && m.ym, 7), mois: txt(m && m.mois, 30), n: ent(m && m.n), ca: eur(m && m.ca), urssaf: eur(m && m.urssaf), declare: bool(m && m.declare) }), 24),
    caDeclare: eur(d.caDeclare), partielCa: bool(d.partielCa), urssaf: eur(d.urssaf), ligneLue: bool(d.ligneLue),
    ventes: liste(d.ventes, (v) => ({ dateVente: txt(v && v.dateVente, 20), dateVersement: txt(v && v.dateVersement, 40), plateforme: plat(v && v.plateforme), num: txt(v && v.num, 12), reference: txt(v && v.reference, 40), titre: txt(v && v.titre), montant: eur(v && v.montant), frais: eur(v && v.frais), note: txt(v && v.note, 80) })),
    nVentes: d.nVentes == null ? null : ent(d.nVentes), totalVentes: eur(d.totalVentes), ventesCompletes: bool(d.ventesCompletes),
    manqueVentes: liste(d.manqueVentes, (m) => txt(m, 80), 20) || [], sansMontantVentes: ent(d.sansMontantVentes),
    aDater: liste(d.aDater, (v) => ({ dateVente: txt(v && v.dateVente, 20), plateforme: plat(v && v.plateforme), num: txt(v && v.num, 12), reference: txt(v && v.reference, 40), titre: txt(v && v.titre), montant: eur(v && v.montant), note: txt(v && v.note, 80) })),
    nADater: d.nADater == null ? null : ent(d.nADater),
    achats: liste(d.achats, (a) => ({ date: txt(a && a.date, 20), plateforme: plat(a && a.plateforme), reference: txt(a && a.reference, 40), num: txt(a && a.num, 12), titre: txt(a && a.titre), saisi: eur(a && a.saisi), lu: eur(a && a.lu), sourceLue: txt(a && a.sourceLue, 40) })),
    nAchats: d.nAchats == null ? null : ent(d.nAchats), sansCout: d.sansCout == null ? null : ent(d.sansCout), coutSaisi: eur(d.coutSaisi),
    manqueAchats: liste(d.manqueAchats, (m) => txt(m, 80), 20) || [], nonComptees: ent(d.nonComptees),
  };
}
// Les vues gardées : les PERIODES_MAX plus récentes publiées.
export function fusionVues(vues, vue, maintenant = Date.now()) {
  const v = vues && typeof vues === 'object' && !Array.isArray(vues) ? { ...vues } : {};
  if (vue) v[vue.periode] = { ...vue, publieLe: new Date(maintenant).toISOString() };
  const cles = Object.keys(v).filter((k) => RE_PERIODE.test(k) && v[k]).sort((a, b) => String(v[b].publieLe || '').localeCompare(String(v[a].publieLe || '')));
  const out = {};
  for (const k of cles.slice(0, PERIODES_MAX)) out[k] = vueComptable(v[k]) && { ...vueComptable(v[k]), publieLe: String(v[k].publieLe || '') };
  return out;
}
const familleNav = (ua) => { const s = String(ua || ''); return /Edg\//.test(s) ? 'Edge' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Autre'; };

// ── LA ROUTE ────────────────────────────────────────────────────────────────
// deps : { base, cle (service), env, fetch, methode, jeton (public) | user (session), corps, ua, origine, acces(owner), maintenant }
//   GET  + jeton (sans session) ⇒ la compta (vues), et l'accès noté ;
//   GET  + session              ⇒ { actif, url, exp, periodes, acces } ;
//   POST + session { action: 'creer' (jours) | 'publier' (vue) | 'couper' }.
export async function traiterComptable(deps) {
  const { base, cle, methode } = deps;
  const f = deps.fetch || fetchAvecDelai;
  const origine = deps.origine || 'https://vrm.center';
  const maintenant = deps.maintenant || Date.now();
  const sig = secret(deps.env || {}) || cle;
  if (!cle) return { status: 503, body: { erreur: 'non-configure', message: "Le lien comptable n'est pas encore branché sur le serveur." } };
  const headers = { apikey: cle, Authorization: `Bearer ${cle}` };
  const lire = async (owner, id, select) => {
    try {
      const r = await f(`${base}/rest/v1/app_data?owner=eq.${encodeURIComponent(owner)}&id=eq.${id}&select=${select}&limit=1`, { headers });
      if (!r || !r.ok) return undefined;
      const j = await r.json();
      return Array.isArray(j) ? (j[0] || null) : undefined;
    } catch (_) { return undefined; }
  };
  const ecrire = async (owner, id, data) => {
    try {
      const now = new Date(maintenant).toISOString();
      const r = await f(`${base}/rest/v1/app_data?on_conflict=owner,id`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ owner, id, data: { ...data, at: now }, updated_at: now }]),
      });
      return !!(r && r.ok);
    } catch (_) { return false; }
  };

  // 1. LE COMPTABLE, par le jeton seul.
  if (deps.jeton != null) {
    if (methode !== 'GET') return { status: 405, body: { erreur: 'GET seulement' } };
    const v0 = verifierJetonComptable(deps.jeton, sig, maintenant);
    if (!v0.ok) return { status: 404, body: { erreur: 'lien', raison: v0.raison === 'expire' ? 'expire' : 'inconnu' } };
    const v = await vendeurParIndex({ url: base, headers, fetcher: f, genre: 'comptable', jeton: deps.jeton });
    if (v === undefined) return { status: 503, body: { erreur: 'base' } };
    if (!v || v.etat !== 'trouve') return { status: 404, body: { erreur: 'lien', raison: 'coupe' } };
    if (deps.acces && (await deps.acces(v.owner)) === false) return { status: 404, body: { erreur: 'lien', raison: 'coupe' } };
    const ligne = await lire(v.owner, LIGNE_COMPTABLE, 't:data->>jeton,vues:data->vues');
    if (ligne === undefined) return { status: 503, body: { erreur: 'base' } };
    if (!ligne || !memeJeton(ligne.t, deps.jeton)) return { status: 404, body: { erreur: 'lien', raison: 'coupe' } };
    const vues = fusionVues(ligne.vues, null, maintenant);
    // Le journal des accès (au mieux : un journal raté n'empêche pas la lecture).
    try {
      const a = await lire(v.owner, LIGNE_ACCES, 'l:data->liste');
      if (a !== undefined) {
        const l = Array.isArray(a && a.l) ? a.l : [];
        await ecrire(v.owner, LIGNE_ACCES, { liste: [{ at: new Date(maintenant).toISOString(), nav: familleNav(deps.ua) }, ...l].slice(0, ACCES_MAX) });
      }
    } catch (_) { /* rien */ }
    return { status: 200, body: { ok: true, exp: v0.exp, vues: Object.values(vues) } };
  }

  // 2. LE VENDEUR, sur SA session.
  const user = deps.user;
  if (!user || !/^[0-9a-f-]{36}$/i.test(String(user.id || ''))) return { status: 401, body: { erreur: 'session' } };
  const ligne = await lire(user.id, LIGNE_COMPTABLE, 't:data->>jeton,exp:data->>exp,vues:data->vues');
  if (ligne === undefined) return { status: 503, body: { erreur: 'base', message: 'Réessaie dans un instant.' } };
  const actuel = ligne && ligne.t ? String(ligne.t) : '';
  const valide = actuel && verifierJetonComptable(actuel, sig, maintenant).ok;
  const etat = async (jeton, vues) => {
    const a = await lire(user.id, LIGNE_ACCES, 'l:data->liste');
    const exp = jeton ? verifierJetonComptable(jeton, sig, maintenant).exp : null;
    return { status: 200, body: { ok: true, actif: !!jeton, url: jeton ? urlComptable(jeton, origine) : '', exp: exp || null,
      periodes: Object.values(fusionVues(vues, null, maintenant)).map((x) => ({ periode: x.periode, libelle: x.libelle, publieLe: x.publieLe })),
      acces: a === undefined ? null : (Array.isArray(a && a.l) ? a.l.slice(0, ACCES_MAX) : []) } };
  };
  if (methode === 'GET') return etat(valide ? actuel : '', ligne && ligne.vues);
  if (methode !== 'POST') return { status: 405, body: { erreur: 'GET ou POST' } };
  const c = deps.corps && typeof deps.corps === 'object' ? deps.corps : {};
  const action = String(c.action || '');
  if (action === 'publier') {
    if (!valide) return { status: 409, body: { erreur: 'pas-de-lien' } };
    const vue = vueComptable(c.vue);
    if (!vue) return { status: 400, body: { erreur: 'vue' } };
    const vues = fusionVues(ligne && ligne.vues, vue, maintenant);
    if (!(await ecrire(user.id, LIGNE_COMPTABLE, { jeton: actuel, exp: verifierJetonComptable(actuel, sig, maintenant).exp, vues }))) return { status: 503, body: { erreur: 'base', message: 'Rien n’a changé. Réessaie dans un instant.' } };
    return etat(actuel, vues);
  }
  if (action !== 'creer' && action !== 'couper') return { status: 400, body: { erreur: 'action' } };
  const jours = Number(c.jours);
  if (action === 'creer' && !DUREES_J.includes(jours)) return { status: 400, body: { erreur: 'duree' } };
  const neuf = action === 'couper' ? '' : nouveauJetonComptable(sig, maintenant + jours * 86400000);
  const vue = action === 'creer' ? vueComptable(c.vue) : null;
  // Couper efface aussi les vues (plus rien à servir) ; créer repart de la vue donnée.
  const vues = action === 'couper' ? {} : fusionVues({}, vue, maintenant);
  if (!(await ecrire(user.id, LIGNE_COMPTABLE, { jeton: neuf, exp: neuf ? maintenant + jours * 86400000 : null, vues }))) return { status: 503, body: { erreur: 'base', message: 'Rien n’a changé. Réessaie dans un instant.' } };
  if (neuf && !(await ecrireIndexJeton({ url: base, headers, fetcher: f, genre: 'comptable', jeton: neuf, owner: user.id, maintenant }))) return { status: 503, body: { erreur: 'base', message: 'Réessaie dans un instant.' } };
  if (actuel && !memeJeton(actuel, neuf)) await retirerIndexJeton({ url: base, headers, fetcher: f, genre: 'comptable', jeton: actuel });
  return etat(neuf, vues);
}
