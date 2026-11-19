// ═══════════════════════════════════════════════════════════════════════════
// « CE QUE VRM PEUT FAIRE MAINTENANT » — LA règle de la page Extension (19 nov., demande H)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 19 nov. : « on ne sait pas quand ton compte Vinted est ouvert, quelles actions on peut faire,
// on ne sait rien ; des fois c'est marqué [qu'il y a] trop [d'onglets / de comptes] ouverts, vraiment pas
// clair du tout ; beaucoup mieux accompagné : le vendeur doit comprendre ».
//
// Règle PURE : aucune lecture, aucun rendu, aucune langue. L'app rassemble les FAITS (ce que le pont de
// l'extension a répondu, les lignes `ext_appareil_*` et `actions_compte_*`, les comptes reliés) et cette
// fonction en tire, pour chaque navigateur et chaque compte de chaque site :
//   · une phrase d'état et UN geste (codes → clés `ext.*` traduites par tr() dans l'écran) ;
//   · la liste des gestes de VRM pour ce compte, oui / non, la raison du non en un code.
// L'audit `scripts/audit-extension-claire.cjs` l'EXÉCUTE sur chaque combinaison d'états.
//
// Ce qu'elle ne fait JAMAIS : promettre ce qu'elle ne sait pas. « Pas su » ne vaut pas « oui »
// (CLAUDE.md §8) : une extension muette, en retard, ou d'un autre navigateur ne rend aucun geste « oui » ici.
// Elle ne décide rien à la place de l'extension : les garde-fous (compte de l'onglet, 50/h, pause sur
// 429/403, une requête à la fois, vérification, « Tout arrêter ») restent DANS l'extension ; la page ne
// fait que les DIRE avant le geste, avec les mêmes seuils (src/jaugeActions.js).
// ═══════════════════════════════════════════════════════════════════════════

export const HEURE = 3600000;
// Une lecture plus vieille que ça ne dit plus « ouvert ailleurs » (la carte du logo relit toutes les 20 min).
export const LU_RECENT_MS = 30 * 60000;
// Une extension d'un autre navigateur vue il y a moins de 24 h compte comme « vivante » (même seuil que l'app).
export const AILLEURS_VIVANTE_MS = 24 * HEURE;

export const cmpVersion = (a, b) => {
  const A = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const B = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
};

// ── Les gestes, par site ─────────────────────────────────────────────────────
// cap      : la capacité d'EXT_CAPACITES qu'il exige (src/App.jsx) — jamais une version écrite ici.
// sorte    : 'lecture' (ne consomme pas le plafond d'actions) · 'clic' (son geste : plafond entier,
//            passe une vérification en cours, comme `compterAction` à 50) · 'auto' (l'app ou l'automate :
//            45/h, arrêté par « Tout arrêter » et une vérification, comme `compterAction` à 45).
// places   : gestes pris d'un coup (une republication réserve ses 3 gestes).
// relais   : se fait depuis le téléphone par l'ordinateur (le relais, 5.183).
// discretion : passe par `porteDiscretion` (attente après l'ouverture, un autre compte vient d'agir).
export const GESTES = Object.freeze({
  vinted: Object.freeze([
    { cle: 'lire', cap: 'releve', sorte: 'lecture' },
    { cle: 'codes', cap: 'codes', sorte: 'lecture' },
    { cle: 'bordereau', cap: 'commande', sorte: 'auto', relais: true },
    { cle: 'repondre', cap: 'messagerie', sorte: 'clic', relais: true },
    { cle: 'baisser', cap: 'baisseprix', sorte: 'auto' },
    { cle: 'publier', cap: 'creervinted', sorte: 'auto' },
    { cle: 'republier', cap: 'republierpage', sorte: 'auto', places: 3 },
    { cle: 'favoris', cap: 'favorisauto', sorte: 'auto', discretion: true },
    { cle: 'offres', cap: 'offresauto', sorte: 'auto', discretion: true },
  ]),
  leboncoin: Object.freeze([
    { cle: 'lire', cap: 'lbcfil', sorte: 'lecture' },
    { cle: 'publier', cap: 'publication', sorte: 'clic' },
    { cle: 'baisser', cap: 'lbcprix', sorte: 'clic' },
    { cle: 'repondre', cap: 'lbcrepondre', sorte: 'clic' },
  ]),
  vestiaire: Object.freeze([
    { cle: 'lire', cap: 'vcventes', sorte: 'lecture' },
    { cle: 'publier', cap: 'vcpublier', sorte: 'clic' },
    { cle: 'baisser', cap: 'vcprix', sorte: 'clic' },
    { cle: 'repondre', cap: 'vcrepondre', sorte: 'clic' },
    { cle: 'offres', cap: 'vcaimes', sorte: 'clic' },
  ]),
});
// Le nom d'un onglet de site, pour « ouvre {site} connecté à {compte} ».
export const DOMAINES = Object.freeze({ vinted: 'vinted.fr', leboncoin: 'leboncoin.fr', vestiaire: 'vestiairecollective.com' });

const versionOk = (v) => /^\d+\.\d+\.\d+$/.test(String(v || ''));

// ── 1. CE NAVIGATEUR ─────────────────────────────────────────────────────────
// Rend { code, ton, cle, vars, geste, pourquoi } — `code` est la vérité (data-* des bancs), `cle` la phrase.
// ton : 'ok' (rien à faire) · 'geste' (ambre : un geste à faire ICI) · 'neutre' (rien à faire ici, ça passe).
// Ordre (le plus bloquant d'abord, le même que `raisonExtGlobale` dans l'app) :
//   téléphone → absente / ailleurs / muette / vérif → deux extensions → code périmé → session VRM → à jour ?
export function etatNavigateur(f) {
  const e = f.ext || {};
  const att = f.attendue || '0.0.0';
  if (f.telephone && !e.present) {
    const rl = f.relais || {};
    if (rl.niveau === 'vivant') return { code: 'telephone-relais', ton: 'ok', cle: 'ext.nav.telephoneRelais', vars: { ou: rl.ou || '' }, geste: null, pourquoi: 'ext.pourquoi.telephone' };
    if (rl.niveau === 'verif') return { code: 'verif', ton: 'neutre', cle: 'ext.nav.verif', vars: {}, geste: null, pourquoi: null };
    if (rl.niveau === 'retard') return { code: 'telephone-retard', ton: 'geste', cle: 'ext.nav.telephoneRetard', vars: { attendue: att }, geste: 'ordinateur', pourquoi: 'ext.pourquoi.retard' };
    if (rl.niveau === 'perime') return { code: 'telephone-eteint', ton: 'neutre', cle: 'ext.nav.telephoneEteint', vars: {}, geste: 'ordinateur', pourquoi: 'ext.pourquoi.telephone' };
    return { code: 'telephone', ton: 'neutre', cle: 'ext.nav.telephone', vars: {}, geste: 'ordinateur', pourquoi: 'ext.pourquoi.telephone' };
  }
  if (!e.present) {
    if (e.installeeIci) return e.appelsFinis
      ? { code: 'muette', ton: 'geste', cle: 'ext.nav.muette', vars: {}, geste: 'recharger', pourquoi: 'ext.pourquoi.muette' }
      : { code: 'verif', ton: 'neutre', cle: 'ext.nav.verif', vars: {}, geste: null, pourquoi: null };
    if (!e.appelsFinis) return { code: 'verif', ton: 'neutre', cle: 'ext.nav.verif', vars: {}, geste: null, pourquoi: null };
    const ail = autresNavigateurs(f).find((x) => x.vivante);
    if (ail) return { code: 'ailleurs', ton: 'geste', cle: 'ext.nav.ailleurs', vars: { ou: ail.nom }, geste: 'installer', pourquoi: 'ext.pourquoi.ailleurs' };
    return { code: 'absente', ton: 'geste', cle: 'ext.nav.absente', vars: {}, geste: 'installer', pourquoi: 'ext.pourquoi.absente' };
  }
  if (Array.isArray(e.plusieurs) && e.plusieurs.length) return { code: 'plusieurs', ton: 'geste', cle: 'ext.nav.plusieurs', vars: { garder: e.plusieurs.filter(versionOk).sort(cmpVersion).pop() || '' }, geste: 'extensions', pourquoi: 'ext.pourquoi.plusieurs' };
  if (e.perime) return { code: 'perime', ton: 'geste', cle: 'ext.nav.perime', vars: {}, geste: 'extensions', pourquoi: 'ext.pourquoi.perime' };
  if (e.etat === undefined) return { code: 'verif', ton: 'neutre', cle: 'ext.nav.verif', vars: {}, geste: null, pourquoi: null };
  if (e.etat === null) return { code: 'muette', ton: 'geste', cle: 'ext.nav.muette', vars: {}, geste: 'recharger', pourquoi: 'ext.pourquoi.muette' };
  const v = e.etat.vrm;
  if (!v || typeof v !== 'object') return { code: 'vrm-passu', ton: 'geste', cle: 'ext.nav.vrmPasSu', vars: {}, geste: 'recharger', pourquoi: 'ext.pourquoi.vrm' };
  if (v.connecte === null) return { code: 'vrm-encours', ton: 'neutre', cle: 'ext.nav.vrmEnCours', vars: {}, geste: null, pourquoi: null };
  if (v.connecte === false) return { code: 'vrm', ton: 'geste', cle: f.brancheEnCours ? 'ext.nav.vrmEnCours' : 'ext.nav.vrm', vars: {}, geste: f.brancheEnCours ? null : 'brancher', pourquoi: 'ext.pourquoi.vrm' };
  const moi = f.moi || {};
  const monId = String(moi.id || ''), sonId = String(v.user_id || '');
  const monMail = String(moi.email || '').trim().toLowerCase(), sonMail = String(v.email || '').trim().toLowerCase();
  const autre = (monId && sonId) ? monId !== sonId : !!(monMail && sonMail && monMail !== sonMail);
  if (autre) return { code: 'autre-vrm', ton: 'geste', cle: f.brancheEnCours ? 'ext.nav.vrmEnCours' : 'ext.nav.autreVrm', vars: { email: sonMail }, geste: f.brancheEnCours ? null : 'brancher', pourquoi: 'ext.pourquoi.autreVrm' };
  const ver = String(e.version || '');
  if (!versionOk(ver)) return { code: 'retard', ton: 'geste', cle: 'ext.nav.retard', vars: { version: '?', attendue: att }, geste: 'mettre-a-jour', pourquoi: 'ext.pourquoi.retard' };
  if (cmpVersion(ver, att) < 0) return { code: 'maj', ton: 'neutre', cle: 'ext.nav.maj', vars: { version: ver, attendue: att }, geste: 'mettre-a-jour', pourquoi: 'ext.pourquoi.maj' };
  return { code: 'ok', ton: 'ok', cle: 'ext.nav.ok', vars: { version: ver }, geste: null, pourquoi: null };
}
// L'extension de CE navigateur peut-elle porter un geste ? (tout état « ok » ou « maj »)
const navigateurAgit = (n) => n.code === 'ok' || n.code === 'maj';

// Les AUTRES navigateurs du compte (lignes `ext_appareil_*`), le plus récent d'abord. Celui-ci en est exclu
// quand son identifiant est connu (`f.ext.appareil`, 5.409) — sinon on ne devine pas lequel c'est.
export function autresNavigateurs(f) {
  const ici = String((f.ext && f.ext.etat && f.ext.etat.ici && f.ext.etat.ici.appareil) || '');
  const now = f.maintenant;
  return (Array.isArray(f.appareils) ? f.appareils : [])
    .filter((a) => a && Number(a.atMs) > 0 && (!ici || a.id !== ici))
    .map((a) => ({ id: a.id, nom: a.nom || '', ver: versionOk(a.ver) ? a.ver : '', atMs: Number(a.atMs), vivante: now - Number(a.atMs) < AILLEURS_VIVANTE_MS,
      aJour: versionOk(a.ver) && cmpVersion(a.ver, f.attendue || '0.0.0') >= 0 }))
    .sort((a, b) => b.atMs - a.atMs);
}

// Pour un compte Vinted : la dernière lecture vue (tous navigateurs : `vus` des lignes d'appareil, et la
// fraîcheur des lignes `harvest_*`), et OÙ il a été lu en dernier. `null` = jamais lu.
function derniereLecture(f, site, id) {
  let best = null;
  const ici = f.ext && f.ext.etat && f.ext.etat.ici;
  const prendre = (at, ou, estIci) => { const t = Number(at); if (Number.isFinite(t) && t > 0 && (!best || t > best.at)) best = { at: t, ou, ici: estIci }; };
  if (ici && ici.vus && ici.vus[site]) prendre(ici.vus[site][id], '', true);
  for (const a of Array.isArray(f.appareils) ? f.appareils : []) if (a && a.vus && a.vus[site] && (!ici || a.id !== ici.appareil)) prendre(a.vus[site][id], a.nom || '', false);
  const lu = f.lus && f.lus[site] && f.lus[site][id];
  if (lu) prendre(lu, best ? best.ou : '', best ? best.ici : false);
  return best;
}

// ── 2. UN COMPTE VINTED : ouvert où ? ───────────────────────────────────────
// 'ici' (le cookie de vinted.fr de ce navigateur est ce compte) · 'autre-ici' (un AUTRE compte est ouvert
// ici) · 'personne-ici' (aucun compte ouvert ici) · 'passu' (le cookie n'a pas répondu à temps) ·
// 'ext' (pas d'extension qui agit ici : on ne sait pas ce qui est ouvert dans ce navigateur).
function ouvertureVinted(f, nav, uid) {
  if (f.telephone && !(f.ext && f.ext.present)) {
    const rl = f.relais || {};
    if (rl.niveau === 'vivant') return rl.vinted && String(rl.vinted.uid) === uid ? { ou: 'relais' } : rl.vinted ? { ou: 'autre-relais', autre: rl.vinted.login || '' } : { ou: 'personne-relais' };
    return { ou: 'ext' };
  }
  if (!navigateurAgit(nav)) return { ou: 'ext' };
  const et = f.ext.etat;
  if (et.vintedPasSu) return { ou: 'passu' };
  const v = et.vinted;
  if (!v || !v.uid) return { ou: 'personne-ici' };
  if (String(v.uid) !== uid) return { ou: 'autre-ici', autre: v.login || '' };
  return { ou: 'ici', onglets: et.ici && et.ici.onglets ? Number(et.ici.onglets.vinted) : null };
}

// La jauge du compte (src/jaugeActions.js `jaugeDuCompte`) : undefined lecture · null pas su · objet.
// `reprise` : sa dernière reprise après une vérification (vinted_discretion.reprises[uid]).
function verificationDe(j, reprise) {
  if (!j || !j.captcha) return null;
  const c = Number(j.captcha), r = Number(reprise);
  if (Number.isFinite(r) && r > c) return null;
  return j.arret || 'captcha';
}

// ── 3. UN GESTE pour un compte ───────────────────────────────────────────────
// Rend { cle, oui, raison, vars, note } — `raison` : le code du « non » (clé `ext.raison.{raison}`),
// `note` : une précision d'un « oui » (« par ton ordinateur », « au ralenti jusqu'à … »).
function unGeste(f, nav, site, g, compte, ouv) {
  const non = (raison, vars = {}) => ({ cle: g.cle, oui: false, raison, vars });
  const oui = (note = null, vars = {}) => ({ cle: g.cle, oui: true, raison: null, note, vars });
  const caps = f.capacites || {};
  // a) LE NAVIGATEUR : rien ne part d'une extension absente, muette, en double, périmée ou d'un autre compte VRM.
  if (f.telephone && !(f.ext && f.ext.present)) {
    const rl = f.relais || {};
    if (site !== 'vinted' || !g.relais || rl.niveau !== 'vivant') return non('telephone');
    if (ouv.ou !== 'relais') return ouv.ou === 'autre-relais' ? non('autre-relais', { autre: ouv.autre || '' }) : non('personne-relais', { compte: compte.nom });
    if (Number(rl.pauseMs) > 0) return non('pause', { heure: f.maintenant + Number(rl.pauseMs) });
    return oui('relais');
  }
  if (!navigateurAgit(nav)) return non('nav-' + nav.code, nav.vars);
  // b) LA VERSION : une extension qui n'a pas la capacité ne la reçoit pas (« pas su » = muette sur sa version).
  const ver = f.ext.version;
  if (!versionOk(ver) || cmpVersion(ver, caps[g.cap] || f.attendue || '9999.0.0') < 0) return non('retard', { version: versionOk(ver) ? ver : '?', attendue: caps[g.cap] || f.attendue });
  if (site !== 'vinted') return gesteAutreSite(f, site, g, compte, non, oui);
  // c) LE COMPTE DE L'ONGLET : l'extension n'agit qu'au nom du compte connecté (garde / gardeStricte).
  if (ouv.ou === 'passu') return non('vinted-passu');
  if (ouv.ou === 'personne-ici') return non('pas-ouvert', { compte: compte.nom, domaine: DOMAINES.vinted });
  if (ouv.ou === 'autre-ici') return non('autre-ouvert', { compte: compte.nom, autre: ouv.autre || '' });
  const et = f.ext.etat;
  // d) VINTED A DEMANDÉ DE RALENTIR (429/403) : rien ne part chez Vinted, lecture comprise.
  const pause = Number(et.pause && et.pause.jusqua) || 0;
  if (pause > f.maintenant) return non('pause', { heure: pause });
  const j = f.jauges ? f.jauges[compte.id] : undefined;
  const verif = verificationDe(j, f.reprises && f.reprises[compte.id]);
  if (g.sorte === 'lecture') {
    // En prudence, les lectures de fond sont suspendues, SAUF les codes de retrait.
    if (j && j.prudence && j.prudence > f.maintenant && g.cle !== 'codes') return oui('prudence-lecture', { heure: j.prudence });
    return oui();
  }
  // e) LES ARRÊTS : « Tout arrêter » et une vérification arrêtent l'automatique ; ses clics passent.
  if (g.sorte === 'auto') {
    if (f.toutArrete && f.toutArrete.on) return non('tout-arrete');
    if (verif) return non(verif === 'moderation' ? 'moderation' : verif === 'deconnecte' ? 'deconnecte' : 'verification');
  }
  // f) LA DISCRÉTION de ce navigateur (5.409) : un autre compte vient d'agir ici, Vinted vient d'être ouvert.
  if (g.discretion && et.ici) {
    const vr = et.ici.verrou;
    if (vr && vr.uid && String(vr.uid) !== compte.id && Number(vr.jusqua) > f.maintenant) return non('autre-compte', { heure: Number(vr.jusqua) });
    const ov = et.ici.ouverture;
    if (ov && String(ov.uid) === compte.id && Number(ov.jusqua) > f.maintenant) return non('ouverture', { heure: Number(ov.jusqua) });
  }
  // g) LE PLAFOND (50/h par compte, tous navigateurs ; 45 pour l'automatique ; prudence 20 ; le jour).
  if (j) {
    const places = g.places || 1;
    const limite = g.sorte === 'clic' ? j.max : j.pourApp;
    if (j.n + places > limite) return non(places > 1 && j.n < limite ? 'places' : 'plafond', { n: j.n, max: limite, reste: Math.max(0, limite - j.n), places, heure: j.repartA || (f.maintenant + HEURE) });
    if (g.sorte === 'auto' && j.nJour != null && j.maxJour && j.nJour + places > j.maxJour - (j.prudence ? 0 : 5)) return non('plafond-jour', { n: j.nJour, max: j.maxJour });
    if (j.prudence && j.prudence > f.maintenant) return oui('prudence', { heure: j.prudence, max: j.max });
  }
  return oui();
}

// Leboncoin / Vestiaire : VRM agit depuis l'onglet du site, au nom de la session de cet onglet.
// `f.ext.etat.ici.onglets` (5.409) dit si un onglet du site est ouvert dans CE navigateur ; plus ancien ⇒
// on ne sait pas, on dit le geste (« ouvre … ») sans prétendre que c'est fermé.
function gesteAutreSite(f, site, g, compte, non, oui) {
  const et = f.ext.etat;
  const onglets = et.ici && et.ici.onglets ? et.ici.onglets[site] : undefined;
  if (compte.nonIdentifie) return non('non-identifie');
  if (onglets === 0) return non('site-ferme', { compte: compte.nom, domaine: DOMAINES[site] });
  if (onglets == null) return compte.ouvert ? oui('site-passu', { domaine: DOMAINES[site] }) : non('site-passu-ferme', { compte: compte.nom, domaine: DOMAINES[site] });
  if (compte.ouvert === false && compte.autreOuvert) return non('autre-ouvert', { compte: compte.nom, autre: compte.autreOuvert });
  return oui();
}

// ── 4. LE TOUT : la page ─────────────────────────────────────────────────────
// f = {
//   maintenant, attendue, capacites, telephone, brancheEnCours, moi: { id, email },
//   ext: { present, appelsFinis, installeeIci, version, plusieurs, perime,
//          etat: undefined | null | { vrm, vinted, vintedPasSu, pause, ici? } },
//   relais: { niveau, vinted, pauseMs, ou },
//   appareils: [{ id, nom, ver, atMs, vus }],
//   comptes: { vinted: [{ id, nom }], leboncoin: [{ id, nom, ouvert, lu }], vestiaire: [...] },
//   lus: { vinted: { uid: ms } }, jauges: { uid: jauge|null|undefined }, reprises: { uid: ms },
//   toutArrete: { on, at } | null,
// }
export function pageExtension(f) {
  const nav = etatNavigateur(f);
  const sites = [];
  for (const site of ['vinted', 'leboncoin', 'vestiaire']) {
    const liste = (f.comptes && Array.isArray(f.comptes[site]) ? f.comptes[site] : []).filter((c) => c && c.id != null && String(c.id) !== '');
    if (!liste.length) continue;
    const comptes = liste.map((c0) => {
      const c = { ...c0, id: String(c0.id), nom: String(c0.nom || '') };
      const ouv = site === 'vinted' ? ouvertureVinted(f, nav, c.id) : { ou: c.ouvert ? 'session' : 'inconnu' };
      const lu = site === 'vinted' ? derniereLecture(f, site, c.id) : (c.lu ? { at: Number(c.lu), ou: '', ici: false } : null);
      const gestes = GESTES[site].map((g) => unGeste(f, nav, site, g, c, ouv));
      return { site, id: c.id, nom: c.nom, ouverture: ouv.ou, autre: ouv.autre || '', lu, etat: etatCompte(f, site, c, ouv, lu, nav), gestes,
        jauge: site === 'vinted' && f.jauges ? f.jauges[c.id] : undefined, peut: gestes.filter((x) => x.oui).length };
    });
    sites.push({ site, comptes });
  }
  const autres = autresNavigateurs(f);
  const avertissements = [];
  const ici = f.ext && f.ext.etat && f.ext.etat.ici;
  // Deux comptes Vinted dans ce navigateur (5.409) : des onglets vinted.* connectés à des comptes différents.
  if (navigateurAgit(nav) && ici && Array.isArray(ici.comptesOnglets) && new Set(ici.comptesOnglets.map(String)).size > 1) {
    const actif = f.ext.etat.vinted && f.ext.etat.vinted.login;
    avertissements.push({ code: 'deux-comptes', cle: 'ext.avert.deuxComptes', vars: { compte: actif || '' }, pourquoi: 'ext.pourquoi.deuxComptes' });
  }
  if (f.toutArrete && f.toutArrete.on) avertissements.push({ code: 'tout-arrete', cle: 'ext.avert.toutArrete', vars: {}, geste: 'reprendre-tout', pourquoi: 'ext.pourquoi.toutArrete' });
  return { navigateur: nav, autres, sites, avertissements, pastille: pastille(nav, sites, avertissements), etapes: etapes(f, nav, sites) };
}

// La phrase d'un compte (une ligne sous son nom) + ton.
function etatCompte(f, site, c, ouv, lu, nav) {
  const recent = lu && f.maintenant - lu.at < LU_RECENT_MS;
  if (site !== 'vinted') {
    if (c.nonIdentifie) return { code: 'non-identifie', cle: 'ext.compte.nonIdentifie', vars: {}, ton: 'neutre' };
    if (c.ouvert) return { code: 'ouvert', cle: 'ext.compte.siteOuvert', vars: { domaine: DOMAINES[site] }, ton: 'ok', lu: lu ? lu.at : null };
    return { code: 'ferme', cle: lu ? 'ext.compte.siteLu' : 'ext.compte.jamaisLu', vars: { domaine: DOMAINES[site], compte: c.nom }, ton: 'neutre', lu: lu ? lu.at : null };
  }
  const j = f.jauges ? f.jauges[c.id] : undefined;
  const verif = verificationDe(j, f.reprises && f.reprises[c.id]);
  if (verif) return { code: verif, cle: verif === 'moderation' ? 'ext.compte.moderation' : verif === 'deconnecte' ? 'ext.compte.deconnecte' : 'ext.compte.verification', vars: {}, ton: 'geste', geste: 'reprendre', lu: lu ? lu.at : null };
  if (ouv.ou === 'ici' || ouv.ou === 'relais') return { code: ouv.ou, cle: ouv.ou === 'relais' ? 'ext.compte.ouvertOrdi' : 'ext.compte.ouvertIci', vars: {}, ton: 'ok', lu: lu ? lu.at : null };
  if (ouv.ou === 'passu') return { code: 'passu', cle: 'ext.compte.passu', vars: {}, ton: 'neutre', lu: lu ? lu.at : null };
  if (recent && !lu.ici && lu.ou) return { code: 'ailleurs', cle: 'ext.compte.ouvertAilleurs', vars: { ou: lu.ou }, ton: 'neutre', lu: lu.at };
  if (ouv.ou === 'autre-ici') return { code: 'autre-ici', cle: 'ext.compte.autreIci', vars: { compte: c.nom, autre: ouv.autre || '' }, ton: 'neutre', geste: 'ouvrir-vinted', lu: lu ? lu.at : null };
  if (ouv.ou === 'ext') return { code: 'ext', cle: lu ? 'ext.compte.lu' : 'ext.compte.jamaisLu', vars: { compte: c.nom, domaine: DOMAINES.vinted }, ton: 'neutre', lu: lu ? lu.at : null };
  return { code: 'ferme', cle: 'ext.compte.ferme', vars: { compte: c.nom, domaine: DOMAINES.vinted }, ton: 'neutre', geste: 'ouvrir-vinted', lu: lu ? lu.at : null };
}

// LA PASTILLE de la coque : un mot, un ton. Elle mène à la page ; elle ne dit jamais un détail technique.
// ton 'ok' (encre : VRM agit) · 'geste' (ambre : un geste à faire ICI) · 'neutre' (gris : rien à faire ici).
function pastille(nav, sites, avert) {
  if (nav.ton === 'geste') return { ton: 'geste', cle: 'ext.pastille.aFaire', code: nav.code };
  if (nav.code === 'verif' || nav.code === 'vrm-encours') return { ton: 'neutre', cle: 'ext.pastille.verif', code: nav.code };
  if (nav.code.startsWith('telephone')) return { ton: nav.code === 'telephone-relais' ? 'ok' : 'neutre', cle: nav.code === 'telephone-relais' ? 'ext.pastille.ordi' : 'ext.pastille.ordiSeul', code: nav.code };
  const vinted = sites.find((s) => s.site === 'vinted');
  const arret = vinted && vinted.comptes.some((c) => c.etat.ton === 'geste');
  if (arret || avert.some((a) => a.code === 'tout-arrete')) return { ton: 'geste', cle: 'ext.pastille.arret', code: 'arret' };
  const ici = vinted && vinted.comptes.find((c) => c.ouverture === 'ici');
  if (ici) return { ton: 'ok', cle: 'ext.pastille.compte', vars: { compte: ici.nom }, code: 'ok' };
  return { ton: 'neutre', cle: 'ext.pastille.vintedFerme', code: 'vinted-ferme' };
}

// LE PREMIER BRANCHEMENT, vérifié en direct : chaque étape est `true` (vue) · `false` (pas encore) · `null`
// (on regarde). Une étape n'est jamais cochée sur une supposition.
function etapes(f, nav, sites) {
  const e = f.ext || {};
  const vue = e.present ? true : (e.appelsFinis ? false : null);
  const branchee = !e.present ? false : (nav.code === 'ok' || nav.code === 'maj') ? true : (nav.code === 'verif' || nav.code === 'vrm-encours' ? null : false);
  const et = e.etat && typeof e.etat === 'object' ? e.etat : null;
  const compteVu = !branchee ? false : et && et.vintedPasSu ? null : !!(et && et.vinted && et.vinted.uid);
  const vinted = sites.find((s) => s.site === 'vinted');
  const lu = !compteVu ? false : !!(vinted && vinted.comptes.some((c) => c.ouverture === 'ici' && c.lu && c.lu.at));
  return [
    { cle: 'installer', fait: vue },
    { cle: 'brancher', fait: branchee },
    { cle: 'vinted', fait: compteVu },
    { cle: 'lecture', fait: lu },
  ];
}
