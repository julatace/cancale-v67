// ── « ENVOYER UN RAPPORT » DE L'EXTENSION, SANS DONNÉE PERSONNELLE (12 nov., ext. 5.371) ──
// Julien : un bouton sur la carte du logo (et dans « Tout va bien ? » de l'app)
// qui envoie l'état TECHNIQUE de l'extension : version, navigateur, étiquettes
// d'erreur récentes, dernières lectures et leur résultat, files, pauses.
// JAMAIS : un texte de message, un pseudo d'acheteur, une adresse, un e-mail, un
// montant lié à une personne. L'extension n'envoie déjà que des nombres, des heures
// et des étiquettes ; ICI on rejoue une liste blanche STRICTE : tout champ inconnu
// tombe, toute chaîne passe par `etiquette` (lettres, chiffres courts, « _ - . : »),
// toute suite de 4 chiffres ou plus devient « # » (un n° de transaction, un prix en
// centimes, un téléphone ne survivent pas).
//
// OÙ C'EST RANGÉ : UNE ligne par vendeur, `ext_rapport_<uid>` (owner = le vendeur :
// il la voit dans SA base), les 5 derniers rapports. Le PROPRIÉTAIRE de
// l'installation les lit tous (GET, clé de service, projeté), à côté des plantages.
// Anti-abus : 6 rapports par heure et par vendeur (compte dans la ligne, écrite par
// comparer-et-échanger sur `data.rev` : deux envois simultanés, un seul gagne, l'autre
// relit). Une lecture ratée n'écrit RIEN (503).
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (12 nov.) chaque appel sortant a un délai
import { proprietaireInstallation } from './signalement.js';

export const PREFIXE_RAPPORT = 'ext_rapport_';
export const RAPPORTS_PAR_HEURE = 6;
export const RAPPORTS_GARDES = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATEFORMES = ['vinted', 'leboncoin', 'vestiaire', 'ebay'];
const NAVIGATEURS = ['Chrome', 'Edge', 'Opera', 'Vivaldi', 'Firefox', 'Orion', 'inconnu'];
const SESSIONS = ['connectee', 'expiree', 'morte', 'absente', 'pas-su'];
const cfg = (env) => ({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: env.SUPABASE_SERVICE_KEY || '' });

// Une étiquette technique : minuscules, sans espace, sans « @ », sans nom de domaine ;
// sinon « masque » ; 4 chiffres ou plus ⇒ « # ». La MÊME règle que l'extension (`etiquetteRapport`).
export const etiquette = (s) => { const x = String(s == null ? '' : s).slice(0, 80); if (!/^[a-z0-9_.:-]*$/.test(x) || /\.[a-z]{2,}/.test(x)) return 'masque'; return x.replace(/\d{4,}/g, '#').slice(0, 60); };
const heure = (x, maintenant) => { const n = Number(x); return Number.isFinite(n) && n > 1.5e12 && n <= maintenant + 60000 ? Math.floor(n) : null; };
const entier = (x, max = 1e6) => { const n = Math.floor(Number(x)); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };
const version = (v) => (/^\d{1,4}\.\d{1,5}\.\d{1,6}$/.test(String(v || '')) ? String(v) : null);

// LA règle : ce qui peut être rangé. Idempotente. `null` = corps illisible.
export function normaliserRapportExt(c, maintenant = Date.now()) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const v = version(c.version);
  if (!v) return null;
  const flux = {};
  const f0 = c.flux && typeof c.flux === 'object' ? c.flux : {};
  for (const pf of PLATEFORMES) {
    const f = f0[pf];
    if (!f || typeof f !== 'object') continue;
    flux[pf] = {
      okAt: heure(f.okAt, maintenant), koAt: heure(f.koAt, maintenant), koStatut: f.koStatut == null ? null : etiquette(f.koStatut),
      refus: (Array.isArray(f.refus) ? f.refus : []).slice(-5).map((r) => ({ at: heure(r && r.at, maintenant), statut: etiquette(r && r.statut), famille: etiquette(r && r.famille) })),
    };
  }
  const compteurs = {};
  const c0 = c.compteurs && typeof c.compteurs === 'object' && !Array.isArray(c.compteurs) ? c.compteurs : {};
  for (const k of Object.keys(c0).slice(0, 80)) compteurs[etiquette(k)] = entier(c0[k]);
  const erreurs = (Array.isArray(c.erreurs) ? c.erreurs : []).slice(-30).map((x) => ({ k: etiquette(x && x.k), at: heure(x && x.at, maintenant) }));
  const cmd0 = c.files && c.files.commandes && typeof c.files.commandes === 'object' ? c.files.commandes : {};
  const commandes = {};
  for (const k of Object.keys(cmd0).slice(0, 20)) commandes[etiquette(k)] = entier(cmd0[k], 10000);
  const p = c.pauses && typeof c.pauses === 'object' ? c.pauses : {};
  const liste = (l) => (Array.isArray(l) ? l.slice(0, 10).map(etiquette) : []);
  return {
    v: 1,
    at: heure(c.at, maintenant) || maintenant,
    version: v,
    servie: version(c.servie),
    navigateur: NAVIGATEURS.includes(c.navigateur) ? c.navigateur : 'inconnu',
    origine: c.origine === 'boutique' || c.origine === 'main' ? c.origine : null,
    session: SESSIONS.includes(c.session) ? c.session : 'pas-su',
    comptes: c.comptes == null ? null : entier(c.comptes, 1000),
    remplace: liste(c.remplace), indispo: liste(c.indispo),
    flux, compteurs, erreurs,
    files: { commandes, reseau: entier(c.files && c.files.reseau, 100) },
    pauses: { vinted: heure(p.vinted, maintenant + 86400000), toutArrete: p.toutArrete === true, republication: heure(p.republication, maintenant) },
  };
}

export const idRapport = (uid) => PREFIXE_RAPPORT + String(uid).toLowerCase().replace(/-/g, '');

async function lireLigne({ env, fetcher, owner, id }) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${owner}&id=eq.${id}&select=id,data&limit=1`, { headers: sbCle(service) });
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? (j[0] || null) : undefined;
  } catch (_) { return undefined; }
}

// POST (session de l'extension) : ranger.
export async function recevoirRapportExt({ utilisateur, corps, env = process.env, fetcher = fetchAvecDelai, pousser = null, maintenant = Date.now() }) {
  const { url, service } = cfg(env);
  if (!service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  if (!utilisateur || !UUID.test(String(utilisateur.id || ''))) return { code: 401, corps: { ok: false, raison: 'session' } };
  const r = normaliserRapportExt(corps, maintenant);
  if (!r) return { code: 400, corps: { ok: false, raison: 'corps' } };
  const owner = String(utilisateur.id).toLowerCase();
  const id = idRapport(owner);
  for (let essai = 0; essai < 3; essai++) {
    const ligne = await lireLigne({ env, fetcher, owner, id });
    if (ligne === undefined) return { code: 503, corps: { ok: false, raison: 'base' } };   // lecture ratée : rien d'écrit
    const d = (ligne && ligne.data) || {};
    const rev = Number.isInteger(Number(d.rev)) ? Number(d.rev) : 0;
    const envois = (Array.isArray(d.envois) ? d.envois : []).map(Number).filter((x) => x > maintenant - 3600000 && x <= maintenant + 60000);
    if (envois.length >= RAPPORTS_PAR_HEURE) return { code: 429, corps: { ok: false, raison: 'trop', max: RAPPORTS_PAR_HEURE } };
    const rapports = (Array.isArray(d.rapports) ? d.rapports : []).map((x) => normaliserRapportExt(x, maintenant)).filter(Boolean);
    rapports.push(r);
    const data = { rev: rev + 1, at: new Date(maintenant).toISOString(), envois: [...envois, maintenant], dernier: { version: r.version, navigateur: r.navigateur, session: r.session, origine: r.origine }, rapports: rapports.slice(-RAPPORTS_GARDES) };
    let rep;
    try {
      rep = ligne
        ? await fetcher(`${url}/rest/v1/app_data?owner=eq.${owner}&id=eq.${id}&data->>rev=eq.${rev}`, { method: 'PATCH', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date(maintenant).toISOString() }) })
        : await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify([{ owner, id, data, updated_at: new Date(maintenant).toISOString() }]) });
    } catch (_) { return { code: 503, corps: { ok: false, raison: 'base' } }; }
    if (!rep || !rep.ok) return { code: 503, corps: { ok: false, raison: 'base' } };
    const j = await rep.json().catch(() => null);
    if (!Array.isArray(j)) return { code: 503, corps: { ok: false, raison: 'base' } };
    if (j.length !== 1) continue;   // un autre envoi a écrit entre-temps : on relit
    let notifie = null;
    if (pousser) {
      try {
        const proprio = await proprietaireInstallation({ env, fetcher });
        if (proprio) { const x = await pousser({ cat: 'signalement', title: '🧰 Rapport de l’extension', body: `Extension ${r.version} · ${r.navigateur} · session ${r.session}`, tag: 'vrm-rapports-extension', url: '/?tab=settings&section=signalements' }, proprio); notifie = !!(x && x.sent > 0); }
      } catch (_) { notifie = false; }
    }
    return { code: 200, corps: { ok: true, notifie } };
  }
  return { code: 503, corps: { ok: false, raison: 'concurrence' } };
}

// GET : le vendeur lit SA ligne ; le PROPRIÉTAIRE lit la liste de tous (projetée), ou
// UN vendeur en entier (`?de=<uid>`).
export async function listerRapportsExt({ utilisateur, de = null, env = process.env, fetcher = fetchAvecDelai, maintenant = Date.now() }) {
  const { url, service } = cfg(env);
  if (!service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const moi = String(utilisateur && utilisateur.id || '').toLowerCase();
  if (!UUID.test(moi)) return { code: 401, corps: { ok: false, raison: 'session' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  const estProprio = !!proprio && proprio === moi;
  const cible = de && estProprio ? String(de).toLowerCase() : (!de ? null : moi);
  if (de && !estProprio && String(de).toLowerCase() !== moi) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  if (cible || !estProprio) {
    const owner = cible || moi;
    if (!UUID.test(owner)) return { code: 400, corps: { ok: false, raison: 'de' } };
    const ligne = await lireLigne({ env, fetcher, owner, id: idRapport(owner) });
    if (ligne === undefined) return { code: 503, corps: { ok: false, raison: 'base' } };
    const d = (ligne && ligne.data) || {};
    return { code: 200, corps: { ok: true, de: owner, rapports: (Array.isArray(d.rapports) ? d.rapports : []).map((x) => normaliserRapportExt(x, maintenant)).filter(Boolean) } };
  }
  try {
    const sel = ['owner', 'id', 'at:data->>at', 'version:data->dernier->>version', 'navigateur:data->dernier->>navigateur', 'session:data->dernier->>session', 'origine:data->dernier->>origine'].join(',');
    const r = await fetcher(`${url}/rest/v1/app_data?id=like.${PREFIXE_RAPPORT}*&select=${sel}&order=data->>at.desc&limit=200`, { headers: sbCle(service) });
    if (!r.ok) return { code: 503, corps: { ok: false, raison: 'base' } };
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return { code: 503, corps: { ok: false, raison: 'base' } };
    const vendeurs = j.filter((x) => x && UUID.test(String(x.owner))).map((x) => ({ de: String(x.owner), at: x.at || null, version: version(x.version), navigateur: NAVIGATEURS.includes(x.navigateur) ? x.navigateur : 'inconnu', session: SESSIONS.includes(x.session) ? x.session : 'pas-su', origine: x.origine === 'boutique' || x.origine === 'main' ? x.origine : null }));
    return { code: 200, corps: { ok: true, vendeurs } };
  } catch (_) { return { code: 503, corps: { ok: false, raison: 'base' } }; }
}
