// ═══════════════════════════════════════════════════════════════════════════
// « PEUT-ON AGIR SUR CE COMPTE ? » — LA porte commune de tous les gestes de l'app (24 nov., lot agir-si-connecte)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 24 nov. : « Je vais devoir répondre à mes messages, republier dans l'application, faire absolument tout si
// l'extension est connectée. Si l'extension n'est pas connectée sur un compte, on peut voir les données mais on ne peut
// pas agir dessus. »  (Remplace, pour l'app, le « toute action dans le panneau » du 20 nov.)
//
// Règle PURE : aucune lecture, aucun rendu, aucune langue. Rend, pour (site, compte, geste) :
//   { ok: true,  voie: 'ici' | 'distance' | 'api', par }          — le geste peut partir, et par où ;
//   { ok: false, raison, cle, vars, geste }                         — LECTURE SEULE : la raison (code), sa phrase
//                                                                     (`agir.raison.*`) et LE geste (`agir.geste.*`).
// Les données restent TOUJOURS visibles : la porte ne cache rien, elle n'éteint que les boutons d'action.
//
// QUAND « ok » (Vinted, Leboncoin, Vestiaire) — toutes les conditions, sinon lecture seule :
//   1. le compte est une IDENTITÉ (uid Vinted, id Leboncoin, id Vestiaire) — jamais un nom ressemblant (§5) ;
//   2. une extension CONNECTÉE À CE COMPTE VRM a vu CE compte vendeur comme compte d'un de SES onglets RÉCEMMENT :
//        · voie 'ici' — l'extension de CE navigateur (pont vivant, branchée à CE compte VRM : `etatNavigateur` = ok/maj)
//          a ce compte dans son onglet : Vinted par le cookie lu à l'instant (`ext.etat.vinted.uid`), Leboncoin et
//          Vestiaire par la présence de CE navigateur (`presence_{appareil}`, < 3 min, compte privé de l'onglet) ;
//        · voie 'distance' — un AUTRE navigateur du vendeur (son ordinateur, « À distance », 22 nov., décision de
//          Julien) est allumé (< 3 min) avec ce compte dans son onglet, et le geste a son équivalent dans la file
//          `cmd_dist_*` (ADIST_GESTES : répondre, offres Vinted, baisse de prix, masquer, republier, bordereau). Les
//          lignes `presence_*` sont SES lignes (RLS, `owner`) : l'extension qui les écrit est connectée à CE compte VRM ;
//   3. cette extension SAIT le geste : sa version ≥ la capacité (`EXT_CAPACITES`, jamais une version écrite ici) ; à
//      distance, ≥ `adistance` aussi. Version illisible = « pas su » = non ;
//   4. elle n'est ni DÉPASSÉE (`depassee`, 5.448) ni ARRÊTÉE sur ce site (`arret` captcha / pause / session, 5.448,
//      daté de moins de 30 min), et « Tout arrêter » n'est pas posé.
// « Pas su » (lecture en cours, lecture ratée, rien publié) ne vaut JAMAIS « ok » (§5, §8).
// eBay : l'API officielle, rien à voir avec l'extension — la porte lit SON jeton (true · false · null pas su).
//
// Ce que la porte ne fait PAS : remplacer les garde-fous de l'extension. Au moment du geste, l'extension revérifie le
// compte de l'onglet (garde / gardeStricte), le plafond de 50/h (réserve 5), une requête à la fois, la pause 429/403,
// l'ordre de la republication (coffre → brouillon → suppression → en ligne) — §3. La porte dit seulement, AVANT, si le
// bouton a une chance d'aboutir, et n'envoie rien quand la réponse est non.
// Exécutée par scripts/audit-agir-si-connecte.cjs (50 comptes aux mêmes titres, A connecté, B non).
// ═══════════════════════════════════════════════════════════════════════════
import { etatNavigateur, cmpVersion } from '../extension/peutFaire.js';
import { ADIST_GESTES, ADIST_ALLUME_MS } from '../aDistance.js';

export const SITES_AGIR = ['vinted', 'leboncoin', 'vestiaire', 'ebay'];
export const ARRET_RECENT_MS = 30 * 60000;
export const NOMS_SITES_AGIR = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', ebay: 'eBay' };

// LES GESTES de l'app, par site : la capacité exigée (clé d'EXT_CAPACITES) et l'équivalent « à distance » (ou null :
// le geste ne part que du panneau de l'extension de CE navigateur).
export const GESTES_AGIR = Object.freeze({
  vinted: Object.freeze({
    repondre: { cap: 'messagerie', dist: 'repondre' },
    offre: { cap: 'messagerie', dist: 'accepter' },        // accepter · refuser · contre-offre (même capacité, même voie)
    favoris: { cap: 'favoris', dist: 'favoris', distCap: 'agirtout' },
    republier: { cap: 'republierpage', dist: 'republier' },
    baisser: { cap: 'baisseprix', dist: 'prix' },
    prix: { cap: 'baisseprix', dist: null },               // changer / remettre un prix (une hausse ne part jamais par la file)
    masquer: { cap: 'masquercarte', dist: 'masquer' },
    vacances: { cap: 'vacances', dist: 'vacances', distCap: 'agirtout' },
    creer: { cap: 'creervinted', dist: 'creer', distCap: 'agirtout' },
    publier: { cap: 'creervinted', dist: 'creer', distCap: 'agirtout' },
    bordereau: { cap: 'commande', dist: 'bordereau' },
    automatisations: { cap: 'panneaucomplet', dist: null },
  }),
  leboncoin: Object.freeze({
    repondre: { cap: 'lbcrepondre', dist: 'repondre' },
    baisser: { cap: 'lbcprix', dist: 'prix' },
    prix: { cap: 'lbcprix', dist: null },
    pause: { cap: 'lbcinterface', dist: 'pause', distCap: 'agirtout' },
    supprimer: { cap: 'lbcsupprime', dist: 'supprimer', distCap: 'agirtout' },
    publier: { cap: 'publication', dist: 'publier', distCap: 'agirtout' },
    favoris: { cap: 'lbcecrireinteresses', dist: null },
    automatisations: { cap: 'panneaucomplet', dist: null },
  }),
  vestiaire: Object.freeze({
    repondre: { cap: 'vcrepondre', dist: 'repondre' },
    offre: { cap: 'vcoffrerepondre', dist: 'offre', distCap: 'agirtout' },
    baisser: { cap: 'vcprix', dist: 'prix' },
    prix: { cap: 'vcprix', dist: null },
    publier: { cap: 'vcpublier', dist: null },
    favoris: { cap: 'vcaimes', dist: 'aimes', distCap: 'agirtout' },
    automatisations: { cap: 'panneaucomplet', dist: null },
  }),
});

const str = (v) => String(v == null ? '' : v).trim();
const versionOk = (v) => /^\d{1,3}\.\d{1,4}\.\d{1,4}$/.test(str(v));
export function compteValide(site, c) {
  const x = str(c);
  if (site === 'vinted') return /^\d{1,20}$/.test(x);
  if (site === 'leboncoin') return /^[0-9a-z_-]{1,64}$/i.test(x.replace(/^lbc-account:/i, ''));
  if (site === 'vestiaire') return /^[\w-]{1,40}$/.test(x);
  if (site === 'ebay') return /^[\w.-]{1,64}$/.test(x);
  return false;
}
const idCompte = (site, c) => (site === 'leboncoin' ? str(c).replace(/^lbc-account:/i, '') : str(c));

// Le navigateur ICI peut-il porter un geste ? (`etatNavigateur` de la page Extension : la même règle, §11)
function navIci(f) {
  try { const n = etatNavigateur({ ...f, telephone: false }); return { agit: n.code === 'ok' || n.code === 'maj', code: n.code }; } catch (_) { return { agit: false, code: 'passu' }; }
}

// Les 5.448 : la ligne `ext_appareil_{id}` du navigateur qui porterait le geste. Rend un code d'empêchement ou ''.
function empechement5448(f, id, site) {
  const rows = Array.isArray(f.appareils) ? f.appareils : [];
  const r = rows.find((x) => x && str(x.id).replace(/^ext_appareil_/, '') === str(id));
  if (!r) return '';
  if (String(r.depassee) === 'true') return 'depassee';
  const a = r.arret && typeof r.arret === 'object' ? r.arret : null;
  const at = a ? Number(a.at) : 0;
  const siteA = a ? ({ lbc: 'leboncoin', vc: 'vestiaire' }[str(a.site)] || str(a.site)) : '';
  if (a && at > 0 && f.maintenant - at < ARRET_RECENT_MS && (!siteA || siteA === site)) {
    const code = str(a.code);
    if (code === 'captcha') return 'captcha';
    if (code === 'pause') return 'pause';
    if (code === 'session') return 'session';
    if (code === 'version-depassee') return 'depassee';
  }
  return '';
}

const non = (raison, vars = {}, geste = null) => ({ ok: false, lecture: true, raison, cle: 'agir.raison.' + raison, vars, geste });

// f = {
//   maintenant, attendue, capacites, moi, ext (faitsExtensionApp), brancheEnCours,
//   presences: undefined (on lit) | null (pas su) | [adistPresence],
//   appareils: undefined | null | [lignes ext_appareil_* : { id, depassee, arret }],
//   toutArrete: { on, at } | null,
//   ebay: { [compte]: true | false | null } | undefined,
//   noms: { [site]: { [id]: nom } }   — pour la phrase (« Connecte l'extension sur shop_x »).
// }
// `par` : 'file' — le geste partira par la file `cmd_dist_*` (même depuis CE navigateur) ⇒ il exige aussi `adistance` ;
//         'panneau' — il s'ouvre dans le panneau de l'extension de CE navigateur ⇒ seule la voie 'ici' compte ;
//         ''  — l'une ou l'autre (le badge du compte).
export function peutAgir(f, { site, compte, geste, par = '' } = {}) {
  const file = par === 'file';
  const F = f || {};
  const maintenant = Number(F.maintenant) || Date.now();
  const s = str(site);
  const nom = (F.noms && F.noms[s] && F.noms[s][idCompte(s, compte)]) || idCompte(s, compte) || '—';
  const base = { compte: nom, site: NOMS_SITES_AGIR[s] || s };
  if (!SITES_AGIR.includes(s)) return non('site', base);

  // eBay : l'API officielle, gardée par SON jeton (jamais l'extension).
  if (s === 'ebay') {
    if (!compteValide('ebay', compte)) return non('compte', base, 'ouvrir-comptes');
    const j = F.ebay && typeof F.ebay === 'object' ? F.ebay[str(compte)] : undefined;
    if (j === true) return { ok: true, voie: 'api', par: null };
    if (j === 'expire') return non('ebay-expire', base, 'reconnecter-ebay');   // (24 nov., lot agir-tout) jeton expiré ⇒ « Reconnecter eBay »
    if (j === false) return non('ebay-jeton', base, 'relier-ebay');
    return non('ebay-passu', base, null);
  }

  const g = GESTES_AGIR[s][str(geste)];
  if (!g) return non('geste', base);
  // 1. L'identité du compte. Le joker '*' (« le compte de l'onglet, quel qu'il soit ») n'est permis qu'au PANNEAU de
  //    l'extension de CE navigateur (et aux réglages « automatisations ») : c'est elle qui agit, au nom du compte de
  //    SON onglet, et sa garde refuse une annonce d'un autre compte. Jamais par la file (un compte nommé, toujours).
  const joker = str(compte) === '*' && (str(geste) === 'automatisations' || par === 'panneau');
  if (!joker && !compteValide(s, compte)) return non('compte', base, 'ouvrir-comptes');
  const id = joker ? '*' : idCompte(s, compte);
  if (F.toutArrete && F.toutArrete.on === true) return non('tout-arrete', base, 'reprendre');

  const caps = F.capacites || {};
  const exige = caps[g.cap] || F.attendue || '9999.0.0';
  // Le geste par la file : `adistance`, et la version où CE geste est entré dans la file (`distCap`, 5.450).
  const exigeDist = [caps.adistance || '9999.0.0', g.distCap ? (caps[g.distCap] || '9999.0.0') : '0.0.0'].sort(cmpVersion).pop();
  const presences = F.presences;
  const ext = F.ext || {};
  const nav = navIci(F);
  const appareilIci = str(ext.etat && ext.etat.ici && ext.etat.ici.appareil);
  const tient = (p) => p && Array.isArray(p.comptes) && p.comptes.some((c) => c && c.site === s && (joker || idCompte(s, c.id) === id));

  // 2a. ICI : l'extension de CE navigateur, branchée à CE compte VRM, a ce compte dans son onglet.
  let ici = false;
  if (nav.agit) {
    if (s === 'vinted') {
      const u = str(ext.etat && ext.etat.vinted && ext.etat.vinted.uid);
      ici = !!u && (joker || u === id) && !(ext.etat && ext.etat.vintedPasSu);
    }
    if (!ici && appareilIci && Array.isArray(presences)) {
      const p = presences.find((x) => x && x.id === appareilIci);
      ici = !!(p && p.allume && tient(p));
    }
  }
  if (ici) {
    const ver = str(ext.version);
    if (!versionOk(ver)) return non('version-passu', base, 'mettre-a-jour');
    if (cmpVersion(ver, exige) < 0) return non('retard', { ...base, version: ver, attendue: exige }, 'mettre-a-jour');
    if (file && (!g.dist || cmpVersion(ver, exigeDist) < 0)) return non(g.dist ? 'retard' : 'ici-seulement', { ...base, version: ver, attendue: exigeDist, ou: '' }, 'mettre-a-jour');
    const e = empechement5448(F, appareilIci, s);
    if (e) return non(e, base, e === 'depassee' ? 'mettre-a-jour' : 'ouvrir-site');
    return { ok: true, voie: 'ici', par: { id: appareilIci, ici: true } };
  }

  // 2b. À DISTANCE : un autre navigateur du vendeur, allumé, a CE compte dans son onglet.
  if (par === 'panneau') {
    if (nav.agit && s === 'vinted' && str(ext.etat && ext.etat.vinted && ext.etat.vinted.login)) return non('autre-compte', { ...base, autre: str(ext.etat.vinted.login) }, 'ouvrir-site');
    if (!nav.agit) return non(ext.present ? 'nav-' + (['retard', 'maj', 'vrm', 'autre-vrm', 'muette', 'plusieurs', 'perime'].includes(nav.code) ? nav.code : 'autre') : 'ici-absente', base, nav.code === 'vrm' || nav.code === 'autre-vrm' ? 'brancher' : nav.code === 'retard' ? 'mettre-a-jour' : 'ouvrir-site');
    if (s !== 'vinted' && presences === undefined) return non('lecture', base);
    if (s !== 'vinted' && !Array.isArray(presences)) return non('passu', base, 'reessayer');
    return non('pas-ouvert', base, 'ouvrir-site');
  }
  if (presences === undefined) return non('lecture', base);
  if (!Array.isArray(presences)) return non('passu', base, 'reessayer');
  const allumees = presences.filter((p) => p && p.allume && Number(p.atMs) > 0 && maintenant - Number(p.atMs) < ADIST_ALLUME_MS + 60000)
    .sort((a, b) => b.atMs - a.atMs);
  const avec = allumees.filter((p) => p.id !== appareilIci && tient(p));
  if (avec.length) {
    if (!g.dist || !ADIST_GESTES[g.dist] || !ADIST_GESTES[g.dist].includes(s)) return non('ici-seulement', { ...base, ou: nomOrdi(avec[0]) }, 'ouvrir-site');
    const p = avec.find((x) => versionOk(x.ver) && cmpVersion(x.ver, exige) >= 0 && cmpVersion(x.ver, exigeDist) >= 0);
    if (!p) return non('retard', { ...base, version: versionOk(avec[0].ver) ? avec[0].ver : '?', attendue: [exige, exigeDist].sort(cmpVersion).pop() }, 'mettre-a-jour');
    const e = empechement5448(F, p.id, s);
    if (e) return non(e, base, e === 'depassee' ? 'mettre-a-jour' : 'ouvrir-site');
    return { ok: true, voie: 'distance', par: { id: p.id, nav: p.nav, sys: p.sys, ici: false } };
  }
  // 3. Personne n'a ce compte ouvert : on dit pourquoi, et le geste.
  if (!nav.agit && (!allumees.length || ext.present)) {
    if (ext.present && nav.code !== 'ok' && nav.code !== 'maj') return non('nav-' + (['retard', 'maj', 'vrm', 'autre-vrm', 'muette', 'plusieurs', 'perime'].includes(nav.code) ? nav.code : 'autre'), base, nav.code === 'vrm' || nav.code === 'autre-vrm' ? 'brancher' : nav.code === 'retard' ? 'mettre-a-jour' : 'ouvrir-site');
    return non('aucune', base, 'ouvrir-site');
  }
  const autre = (nav.agit && s === 'vinted' && str(ext.etat && ext.etat.vinted && ext.etat.vinted.login))
    || ((allumees.flatMap((p) => p.comptes || []).find((c) => c && c.site === s) || {}).nom || '');
  if (autre) return non('autre-compte', { ...base, autre }, 'ouvrir-site');
  return non('pas-ouvert', base, 'ouvrir-site');
}

const NOMS_NAV = { chrome: 'Chrome', edge: 'Edge', opera: 'Opera', firefox: 'Firefox', orion: 'Orion', brave: 'Brave', arc: 'Arc' };
const NOMS_SYS = { mac: 'Mac', windows: 'Windows', linux: 'Linux', chromeos: 'Chromebook' };
export function nomOrdi(p) { return [NOMS_NAV[str(p && p.nav).toLowerCase()] || '', NOMS_SYS[str(p && p.sys).toLowerCase()] || ''].filter(Boolean).join(' · ') || 'Chrome'; }

// UN COMPTE en lecture seule ? Le badge par compte, là où vivent les actions : « lecture seule » si AUCUN geste de ce
// site n'est possible sur ce compte (la raison du premier).
export function etatCompteAgir(f, site, compte) {
  if (site === 'ebay') { const r = peutAgir(f, { site, compte, geste: 'x' }); return r.ok ? { lecture: false } : { lecture: true, raison: r }; }
  const gestes = Object.keys(GESTES_AGIR[site] || {});
  let premier = null;
  for (const g of gestes) { const r = peutAgir(f, { site, compte, geste: g }); if (r.ok) return { lecture: false, voie: r.voie }; if (!premier) premier = r; }
  return { lecture: true, raison: premier };
}
