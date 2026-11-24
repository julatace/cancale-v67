// ═══════════════════════════════════════════════════════════════════════════
// « CONNEXIONS » — la règle de la vue (24 nov., lot connexions-extension)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 24 nov. : « que on soit bcp plus informé sur les connexions d'extensions ».
// Règle PURE (aucune lecture, aucun rendu, aucune langue) : l'écran (src/connexions/EcranConnexions.jsx) lit les
// lignes et dessine ; ici on décide, par des CODES (data-* des bancs, clés `cnx.*` traduites par tr()).
//
// Mesuré sur la vraie base le 24 nov. (lecture seule, projections) :
//   · `ext_appareil_{16 hex}` : 22 lignes, 1 vendeur. Une ligne par INSTALLATION (un dossier dézippé de plus = un id
//     de plus) : 17 « Chrome · Mac » de 5.329 à 5.440. Le nom publié se limite à `appareil.nav` + `appareil.systeme`
//     (+ `paquet`) : aucun nom d'ordinateur. Les installations plus vues depuis 7 j sont donc rangées à part, repliées.
//   · `vus.vinted` = { uid Vinted: ms } (les comptes que CE navigateur a lus) ; `flux.{vinted|leboncoin|vestiaire}` =
//     { okAt, koAt, koStatut, refus[{at, statut:'reseau', famille, octets}] } : les ENVOIS vers VRM, pas Vinted.
//   · `diag` = compteurs internes du jour (suivi_vu_escrow…) : rien pour lui, pas montré.
//   · `actions_compte_{uid}_{nav}` : 27 lignes ; le `{nav}` n'est PAS l'id de `ext_appareil` (0 sur 27 reliées) ⇒ la
//     jauge des 50/h se lit PAR COMPTE (tous navigateurs, src/jaugeActions.js), jamais attribuée à un navigateur.
// Champs de la 5.448 (branche claude/ext-adaptatif) lus SEULEMENT présents : `sante` { vinted|lbc|vc|ebay: { k, nom } },
// `arret` { site, geste, code, at }, `servie`, `depassee`. Une installation plus ancienne ne les publie pas : « — » et la
// raison (« version trop ancienne pour le dire »), jamais « ok ».
// ═══════════════════════════════════════════════════════════════════════════
import { cmpVersion } from '../extension/peutFaire.js';

export const MIN = 60000;
export const HEURE = 60 * MIN;
export const VU_DIRECT_MS = 15 * MIN;      // « en direct » : la ligne se republie à chaque visite et toutes les quelques minutes
export const ABSENT_MS = 24 * HEURE;      // « pas vu depuis … »
export const ANCIEN_MS = 7 * 24 * HEURE;  // une installation plus vue depuis 7 j : rangée à part (une réinstallation laisse sa vieille ligne)
export const RELU_VIEUX_MS = 24 * HEURE;  // un compte pas relu depuis 24 h : nommé, avec son geste
// La version qui publie `sante` / `arret` / `servie` / `depassee` (ext. 5.448, capacité « santesites » à ajouter à
// EXT_CAPACITES quand la 5.448 arrive sur main — l'écran passe `EXT_CAPACITES.santesites` s'il existe).
export const SANTE_DEPUIS = '5.448.0';

export const SITES = ['vinted', 'leboncoin', 'vestiaire'];
const SITE_SANTE = { vinted: 'vinted', lbc: 'leboncoin', vc: 'vestiaire', ebay: 'ebay', leboncoin: 'leboncoin', vestiaire: 'vestiaire' };
export const NAVS = ['chrome', 'edge', 'opera', 'firefox', 'orion', 'brave', 'arc', 'safari'];
export const SYSTEMES = ['mac', 'windows', 'linux', 'iphone', 'ipad', 'android', 'chromeos'];
// Les codes d'arrêt connus (5.448) — tout autre code devient « autre » (jamais un texte de page affiché).
export const ARRETS = ['champ-introuvable', 'supprimer-confirmation-ambigu', 'version-depassee', 'captcha', 'pause', 'session', 'onglet'];
export const SANTES = ['ok', 'element', 'forme', 'onglet', 'pas-vu'];

const versionOk = (v) => /^\d{1,3}\.\d{1,4}\.\d{1,4}$/.test(String(v || ''));
const ms = (v) => { const t = Number(v); return Number.isFinite(t) && t > 0 ? t : null; };
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const str = (v) => String(v == null ? '' : v).trim();

// La lecture : SES lignes seulement, des scalaires et de petits objets (jamais `select=data`).
export function requeteConnexions(owner) {
  const o = str(owner);
  if (!/^[\w-]{8,64}$/.test(o)) return null;
  return `owner=eq.${encodeURIComponent(o)}&id=like.ext_appareil_*&select=id,ver:data->>ver,atMs:data->>atMs,nav:data->appareil->>nav,sys:data->appareil->>systeme,vus:data->vus,flux:data->flux,depassee:data->>depassee,servie:data->>servie,sante:data->sante,arret:data->arret&order=id`;
}

// « vu » : direct (< 15 min) · recent (< 24 h) · absent (≥ 24 h) · passu (date illisible).
export function etatVu(atMs, maintenant) {
  const t = ms(atMs);
  if (t == null) return 'passu';
  const d = maintenant - t;
  return d < VU_DIRECT_MS ? 'direct' : d < ABSENT_MS ? 'recent' : 'absent';
}

// La version d'UNE installation. `attendue` : la version servie par vrm.center (EXT_ATTENDUE = public/extension-version.json).
// Rend { etat: 'a-jour'|'ancienne'|'passu', ver, installer }. « passu » : version illisible, ou rien pour comparer.
export function etatVersion(r, attendue) {
  const ver = versionOk(r && r.ver) ? str(r.ver) : '';
  const servie = versionOk(r && r.servie) ? str(r.servie) : '';
  const cible = [attendue, servie].filter(versionOk).sort(cmpVersion).pop() || '';
  if (!ver) return { etat: 'passu', ver: '', installer: cible };
  const dep = r && r.depassee != null ? (String(r.depassee) === 'true' ? true : String(r.depassee) === 'false' ? false : null) : null;
  if (cible && cmpVersion(ver, cible) < 0) return { etat: 'ancienne', ver, installer: cible };
  if (dep === true) return { etat: 'ancienne', ver, installer: cible };
  if (!cible && dep == null) return { etat: 'passu', ver, installer: '' };
  return { etat: 'a-jour', ver, installer: cible };
}

// La santé par site (5.448). Rend undefined (« trop ancienne pour le dire »), null (pas dit), ou [{ site, k, nom }].
export function santeDe(r, depuis = SANTE_DEPUIS) {
  const ver = versionOk(r && r.ver) ? str(r.ver) : '';
  const s = obj(r && r.sante);
  if (!s) return ver && cmpVersion(ver, depuis) < 0 ? undefined : null;
  const out = [];
  for (const [cle, v] of Object.entries(s)) {
    const site = SITE_SANTE[cle]; const o = obj(v);
    if (!site || !o) continue;
    out.push({ site, k: SANTES.includes(o.k) ? o.k : 'autre', nom: /^[\w-]{1,40}$/.test(str(o.nom)) ? str(o.nom) : '' });
  }
  return out;
}

// Le dernier envoi vers VRM, par site : { okAt, koAt, ko: bool, statut }.
function fluxDe(r) {
  const f = obj(r && r.flux) || {};
  const out = {};
  for (const site of SITES) {
    const x = obj(f[site]); if (!x) continue;
    const okAt = ms(x.okAt), koAt = ms(x.koAt);
    const refus = Array.isArray(x.refus) ? x.refus.filter(obj) : [];
    const dernier = refus.reduce((a, b) => (ms(b.at) || 0) > (ms(a && a.at) || 0) ? b : a, null);
    const statut = str(x.koStatut) || str(dernier && dernier.statut);
    out[site] = { okAt, koAt, ko: koAt != null && (okAt == null || koAt > okAt), statut: /^(reseau|\d{3})$/.test(statut) ? statut : (statut ? 'autre' : '') };
  }
  return out;
}

// LE problème d'une installation, le plus parlant d'abord (un seul, avec son geste) — null = rien à dire.
// Ordre : arrêt nommé par l'extension (5.448) → santé d'un site ≠ ok (5.448) → envoi vers VRM raté → version ancienne.
// Geste : 'mettre-a-jour' · 'ouvrir-site' · 'recharger' · 'reseau' (vérifie la connexion) · null (ça repart seul / on corrige).
export function problemeDe(n) {
  if (n.arret) {
    const code = n.arret.code;
    const geste = code === 'version-depassee' ? 'mettre-a-jour' : code === 'onglet' ? 'ouvrir-site' : code === 'session' ? 'ouvrir-site' : code === 'captcha' ? 'ouvrir-site' : null;
    return { code: 'arret-' + code, cle: 'cnx.arret.' + code, site: n.arret.site, at: n.arret.at, geste };
  }
  if (Array.isArray(n.sante)) {
    const mal = n.sante.find((s) => s.k !== 'ok');
    if (mal) return { code: 'sante-' + mal.k, cle: 'cnx.sante.' + mal.k, site: mal.site, at: null, geste: mal.k === 'onglet' || mal.k === 'pas-vu' ? 'ouvrir-site' : null, nom: mal.nom };
  }
  for (const site of SITES) {
    const f = n.flux[site];
    if (f && f.ko) return { code: 'envoi-' + (f.statut || 'autre'), cle: f.statut === 'reseau' ? 'cnx.envoi.reseau' : 'cnx.envoi.autre', site, at: f.koAt, geste: f.statut === 'reseau' ? 'reseau' : 'recharger' };
  }
  if (n.version.etat === 'ancienne') return { code: 'version', cle: 'cnx.version.ancienne', site: '', at: null, geste: 'mettre-a-jour' };
  return null;
}

// UNE installation (une ligne `ext_appareil_*`) ⇒ la vue de ce navigateur.
export function navigateurDe(r, { attendue, maintenant, ici = '', depuis = SANTE_DEPUIS, nomsVinted = {} } = {}) {
  const id = str(r && r.id).replace(/^ext_appareil_/, '');
  if (!/^[0-9a-f]{6,32}$/.test(id)) return null;
  const nav = NAVS.includes(str(r.nav).toLowerCase()) ? str(r.nav).toLowerCase() : '';
  const sys = SYSTEMES.includes(str(r.sys).toLowerCase()) ? str(r.sys).toLowerCase() : '';
  const atMs = ms(r.atMs);
  const vus = obj(obj(r.vus) && r.vus.vinted) || {};
  const comptesVinted = Object.entries(vus).filter(([u, t]) => /^\d{1,20}$/.test(u) && ms(t) != null)
    .map(([u, t]) => ({ uid: u, nom: nomsVinted[u] || '', at: ms(t) })).sort((a, b) => b.at - a.at);
  const flux = fluxDe(r);
  const a = obj(r.arret);
  const arret = a && ms(a.at) != null ? { site: SITE_SANTE[str(a.site)] || '', geste: /^[\w-]{1,40}$/.test(str(a.geste)) ? str(a.geste) : '', code: ARRETS.includes(str(a.code)) ? str(a.code) : 'autre', at: ms(a.at) } : null;
  const n = {
    id, court: id.slice(-4), nav, sys, ici: !!ici && ici === id, atMs, vu: etatVu(atMs, maintenant),
    version: etatVersion(r, attendue), sante: santeDe(r, depuis), arret,
    // Ce qu'il lit, par site : Vinted par compte (vus), Leboncoin et Vestiaire par le dernier envoi réussi.
    sites: {
      vinted: { comptes: comptesVinted, at: comptesVinted.length ? comptesVinted[0].at : (flux.vinted ? flux.vinted.okAt : null) },
      leboncoin: { at: flux.leboncoin ? flux.leboncoin.okAt : null },
      vestiaire: { at: flux.vestiaire ? flux.vestiaire.okAt : null },
    },
    flux,
  };
  n.probleme = problemeDe(n);
  // Un arrêt ou un envoi raté VIEUX de plus de 24 h, suivi d'un envoi réussi, n'est plus le problème du moment.
  if (n.probleme && n.probleme.at && maintenant - n.probleme.at > ABSENT_MS && n.probleme.code.startsWith('arret-')) n.probleme = problemeDe({ ...n, arret: null });
  return n;
}

// LA VUE. `rows` : undefined (on lit) · null (lecture ratée) · tableau.
// `comptes` : { vinted: [{ id, nom }], leboncoin: [{ id, nom, lu }], vestiaire: [...] } (comptes écartés déjà retirés) ;
// `lus` : { vinted: { uid: ms } } (fraîcheur `harvest_*`) ; `jauges` : { uid: jauge | null | undefined }.
export function vueConnexions({ rows, attendue = '', maintenant = Date.now(), ici = '', depuis = SANTE_DEPUIS, comptes = {}, lus = {}, jauges = {} } = {}) {
  const vinted = (Array.isArray(comptes.vinted) ? comptes.vinted : []).filter((c) => c && /^\d{1,20}$/.test(str(c.id)));
  const nomsVinted = {}; for (const c of vinted) nomsVinted[str(c.id)] = str(c.nom);
  let navigateurs = rows === undefined ? undefined : rows === null || !Array.isArray(rows) ? null : [];
  let anciens = Array.isArray(navigateurs) ? [] : navigateurs;
  if (Array.isArray(rows)) {
    const vus = new Set();
    for (const r of rows) {
      const n = navigateurDe(r || {}, { attendue, maintenant, ici, depuis, nomsVinted });
      if (!n || vus.has(n.id)) continue; vus.add(n.id);
      // Une installation plus vue depuis 7 j (ou jamais datée) : à part. Celle de CE navigateur reste toujours en haut.
      if (!n.ici && (n.atMs == null || maintenant - n.atMs >= ANCIEN_MS)) anciens.push(n); else navigateurs.push(n);
    }
    const ordre = (a, b) => (b.ici - a.ici) || ((b.atMs || 0) - (a.atMs || 0)) || a.id.localeCompare(b.id);
    navigateurs.sort(ordre); anciens.sort(ordre);
  }
  // Les comptes : par site, qui les lit et quand.
  const lusV = obj(lus.vinted) || {};
  const cptes = [];
  for (const c of vinted) {
    const uid = str(c.id);
    let at = ms(lusV[uid]), par = null;
    for (const n of Array.isArray(navigateurs) ? navigateurs.concat(anciens) : []) {
      const x = n.sites.vinted.comptes.find((k) => k.uid === uid);
      if (x && (!par || x.at > par.at)) par = { id: n.id, nav: n.nav, sys: n.sys, court: n.court, ici: n.ici, at: x.at };
    }
    if (par && (at == null || par.at > at)) at = par.at;
    const j = jauges[uid];
    const jauge = j === undefined ? undefined : j && typeof j === 'object' ? { n: j.n, max: j.max, repartA: j.repartA || null, prudence: ms(j.prudence) && j.prudence > maintenant ? j.prudence : null, captcha: ms(j.captcha), arret: j.arret || null } : null;
    const relu = at == null ? (Array.isArray(navigateurs) ? 'jamais' : 'passu') : maintenant - at >= RELU_VIEUX_MS ? 'vieux' : 'frais';
    cptes.push({ site: 'vinted', id: uid, nom: str(c.nom), at, par, relu, jauge, arret: jauge && jauge.captcha ? (jauge.arret || 'captcha') : null });
  }
  for (const site of ['leboncoin', 'vestiaire']) {
    for (const c of Array.isArray(comptes[site]) ? comptes[site] : []) {
      if (!c || c.id == null || str(c.id) === '') continue;
      const at = ms(c.lu);
      cptes.push({ site, id: str(c.id), nom: str(c.nom), at, par: null, relu: at == null ? 'jamais' : maintenant - at >= RELU_VIEUX_MS ? 'vieux' : 'frais', jauge: undefined, arret: null });
    }
  }
  return { navigateurs, anciens, comptes: cptes, alerte: alerteDe({ navigateurs, comptes: cptes, maintenant }) };
}

// LA LIGNE D'AUJOURD'HUI : seulement quand quelque chose demande un geste. null = rien à dire (ou pas su : rien n'est affirmé).
// 1) une vérification demandée par Vinted (captcha / session) sur un compte ; 2) une extension ANCIENNE vue dans les dernières
// 24 h ; 3) un compte Vinted relu un jour, plus depuis 24 h. Jamais sur « pas su », jamais sur une vieille installation.
export function alerteDe({ navigateurs, comptes, maintenant }) {
  const arrete = (comptes || []).find((c) => c.site === 'vinted' && c.arret);
  if (arrete) return { code: 'arret', cle: arrete.arret === 'deconnecte' ? 'cnx.alerte.session' : 'cnx.alerte.verification', vars: { compte: arrete.nom || '—' }, compte: arrete.id };
  if (Array.isArray(navigateurs)) {
    const vieux = navigateurs.find((n) => n.version.etat === 'ancienne' && n.vu !== 'absent' && n.vu !== 'passu');
    if (vieux) return { code: 'version', cle: 'cnx.alerte.version', vars: { ver: vieux.version.ver, installer: vieux.version.installer || '—' }, navigateur: vieux.id };
  }
  const pasRelu = (comptes || []).filter((c) => c.site === 'vinted' && c.relu === 'vieux').sort((a, b) => a.at - b.at)[0];
  if (pasRelu) return { code: 'relu', cle: 'cnx.alerte.relu', vars: { compte: pasRelu.nom || '—', at: pasRelu.at }, compte: pasRelu.id };
  return null;
}
