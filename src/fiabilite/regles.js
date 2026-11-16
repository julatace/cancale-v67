// ════════════════════════════════════════════════════════════════════════════
//  FIABILITÉ AUTOMATIQUE — LES RÈGLES PURES (15 nov., lot fiabilite-auto)
// ════════════════════════════════════════════════════════════════════════════
// Julien (« vas-y fais tout ») : VRM se surveille tout seul et le DIT, au bon endroit,
// avec le geste. Ce module ne lit rien, n'écrit rien : l'écran, l'audit et le banc
// l'exécutent tels quels.
//   · `retardIci`        — l'extension de CE navigateur est-elle en retard ? « Ce Chrome a
//                          la 5.329 : installe la 5.385 », le paquet, la boutique si sa
//                          fiche est publiée (`LIENS_BOUTIQUES`). Jamais pour une version
//                          publiée à jour ; muette (avant la 5.26) = ancienne.
//   · `santeDesComptes`  — une CARTE par compte (Vinted, Leboncoin, Vestiaire, eBay) : la
//                          dernière lecture, prudence / vérification / arrêt (lignes
//                          `actions_compte_*`), l'appareil qui le lit et sa version ; un état
//                          en mots, UN geste. (Décision de Julien : aucune « vente à dater »
//                          n'est dite — l'extension les date sans rien lui demander.)
//   · `pointsToutVaBien` — « Tout va bien ? · N points » : ce qui demande un geste, une
//                          seule fois chacun (contrôle de nuit, comptes, extension d'ici).
//                          La ligne discrète de Ma journée (chantier `refonte-journee`) le lit.
// Les mots passent par `tr()` dans les composants : ici, des CLÉS et des nombres.
// ════════════════════════════════════════════════════════════════════════════
import { etatVersion, versionCourte, LIENS_PAQUET } from '../../api/_lib/garde-capture.js';
import { etatControle } from '../controleNuit.js';
import { jaugeDuCompte } from '../jaugeActions.js';
import { verificationEnCours } from '../discretion.js';

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const ts = (v) => { const t = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(t) && t > 0 ? t : null; };

// ── L'EXTENSION DE CE NAVIGATEUR ──────────────────────────────────────────────
// `on` : une extension VRM répond ici ; `v` : sa version ('' = muette) ; `attendue` :
// EXT_ATTENDUE ; `nav` : navigateurIci() ; `nomNav` : « Chrome », ou '' (pas sûr) ;
// `inst` : installerExtensionIci() ({ boutique, lien, nomBoutique }).
// Rend null (rien à dire) ou { version, attendue, nomNav, lien, nomLien, boutique, nomBoutique }.
export function retardIci({ on, v = '', attendue, nav = '', nomNav = '', inst = null } = {}) {
  if (!on || !attendue) return null;
  const vv = String(v || '');
  if (vv) { const e = etatVersion({ ver: vv }, attendue); if (e !== 'ancienne') return null; }   // « pas su » ne vaut pas « en retard »
  const orion = nav === 'orion';
  const boutique = !orion && inst && inst.boutique && inst.lien ? String(inst.lien) : '';
  return {
    version: vv ? versionCourte(vv) : '', attendue: versionCourte(attendue),
    nomNav: nomNav && nomNav !== 'ce navigateur' ? String(nomNav) : '',
    lien: orion ? LIENS_PAQUET.orion : LIENS_PAQUET.chromium, nomLien: orion ? 'VRM-Orion.xpi' : 'VRM-extension.zip',
    boutique, nomBoutique: boutique ? String(inst.nomBoutique || '') : '',
  };
}

// ── LA SANTÉ DE CHAQUE COMPTE ────────────────────────────────────────────────
// `lignes` : `lignesFraicheur` (src/fraicheurComptes.js) des comptes reliés, toutes
// plateformes ; `comptes` : les comptes lus (pour `annoncesLu`, la lecture complète du
// dressing Vinted) ; `appareils` : `lireAppareils` (api/_lib/garde-capture.js) — `vus`
// dit quel navigateur a lu quel compte ; `pannes` : `pannesCapture` ; `actions` : les
// lignes `actions_compte_*` (null = pas lues) ; `reprises` : { uid: ms } (son « Reprendre »).
// Rend [{ plateforme, id, nom, etat, ton, geste, lu, appareil, prudence, arret }] : le
// geste d'abord, puis Vinted, Leboncoin, Vestiaire, eBay.
export const ETATS_SANTE = ['arret', 'panne', 'delie', 'jamais', 'a-relire', 'ventes', 'extension', 'prudence', 'banni', 'masque', 'ok'];
const TON = { arret: 'geste', panne: 'geste', delie: 'geste', jamais: 'geste', 'a-relire': 'geste', ventes: 'geste', extension: 'geste', prudence: 'info', banni: 'neutre', masque: 'neutre', ok: 'ok' };
export function santeDesComptes({ lignes, comptes = [], appareils = [], pannes = [], actions = null, reprises = {}, attendue = '', maintenant = Date.now() } = {}) {
  if (!Array.isArray(lignes)) return null;
  const brut = new Map((Array.isArray(comptes) ? comptes : []).filter(Boolean).map((c) => [`${c.plateforme}:${c.id}`, c]));
  const panneDe = new Map((Array.isArray(pannes) ? pannes : []).map((p) => [`${p.plateforme}:${p.id}`, p]));
  const R = objet(reprises) || {};
  const out = [];
  for (const l of lignes) {
    if (!l || !l.plateforme) continue;
    const cle = `${l.plateforme}:${l.id}`;
    const c = brut.get(cle) || {};
    // L'appareil qui le lit : le navigateur qui l'a vu le plus récemment (`vus`), sa version.
    let ap = null;
    for (const a of Array.isArray(appareils) ? appareils : []) {
      const t = ts(a && a.vus && a.vus[l.plateforme] && a.vus[l.plateforme][String(l.id)]);
      if (t != null && (!ap || t > ap.vu)) ap = { nom: String(a.nom || ''), version: versionCourte(a.code || a.ver), etat: etatVersion(a, attendue), vu: t };
    }
    // Prudence, vérification, arrêt : les lignes de l'extension (Vinted, Vestiaire — un identifiant en chiffres).
    let prudence = null, arret = null;
    const j = Array.isArray(actions) && /^\d{1,20}$/.test(String(l.id)) ? jaugeDuCompte(actions, String(l.id), maintenant) : null;
    if (j) {
      if (j.prudence) prudence = j.prudence;
      if (j.captcha && verificationEnCours(j.captcha, R[String(l.id)])) arret = { quoi: ['captcha', 'moderation', 'deconnecte'].includes(j.arret) ? j.arret : 'captcha', depuis: j.captcha };
    }
    const lu = l.plateforme === 'vinted' ? (ts(c.annoncesLu) || ts(l.lu)) : ts(l.lu);
    const masque = String(l.bloque || '').startsWith('masqué');
    const etat = arret ? 'arret'
      : panneDe.has(cle) ? 'panne'
      : l.etat === 'banni' ? 'banni'
      : masque ? 'masque'
      : l.etat === 'delie' ? 'delie'
      : l.etat === 'jamais' ? 'jamais'
      : l.etat === 'a-relire' ? 'a-relire'
      : l.ventesRetard ? 'ventes'
      : ap && ap.etat === 'ancienne' ? 'extension'
      : prudence ? 'prudence' : 'ok';
    out.push({ plateforme: l.plateforme, id: String(l.id), nom: String(l.nom || ''), etat, ton: TON[etat], lu, appareil: ap, prudence, arret,
      ...(etat === 'panne' ? { panne: { cause: String(panneDe.get(cle).cause || '').slice(0, 160) } } : {}) });
  }
  const ordre = { vinted: 0, leboncoin: 1, vestiaire: 2, ebay: 3 };
  return out.sort((a, b) => ((a.ton === 'geste' ? 0 : 1) - (b.ton === 'geste' ? 0 : 1)) || ((ordre[a.plateforme] ?? 9) - (ordre[b.plateforme] ?? 9)) || a.nom.localeCompare(b.nom, 'fr'));
}

// ── « TOUT VA BIEN ? · N POINTS » ─────────────────────────────────────────────
// `controle` / `installation` : les lignes `vrm_controle_nuit` / `vrm_controle_installation`
// lues (undefined = en cours, null = absente) ; `sante` : `santeDesComptes` (ou null : pas
// lue — elle n'ajoute rien) ; `ici` : `retardIci` (ou null).
// Rend { etat: 'lecture'|'ok'|'points', n, points: [{ cle, source, ton, n }] } — un point =
// une chose qui demande un geste. Jamais « N ventes à dater » (plus un contrôle, src/controleNuit.js).
export function pointsToutVaBien({ controle, installation = null, sante = null, ici = null, maintenant = Date.now() } = {}) {
  if (controle === undefined) return { etat: 'lecture', n: 0, points: [] };
  const points = [];
  const ctl = etatControle(controle, installation === undefined ? null : installation, maintenant);
  const lues = new Set(ctl.lignes.map((l) => l.cle));
  for (const l of ctl.lignes) {
    // Le même compte pas relu, dit deux fois (48 h et la lecture « en ligne » de 24 h) : une seule.
    if (l.cle === 'comptes-48h' && lues.has('enligne-24h')) continue;
    points.push({ cle: `controle:${l.cle}`, source: 'controle', controle: l.cle, ton: l.ton === 'rouge' ? 'rouge' : 'geste', n: l.n, ids: l.ids || [] });
  }
  const dejaComptes = points.some((p) => p.controle === 'enligne-24h' || p.controle === 'comptes-48h');
  for (const c of Array.isArray(sante) ? sante : []) {
    if (c.ton !== 'geste') continue;
    if (dejaComptes && (c.etat === 'a-relire')) continue;   // déjà dit par le contrôle de nuit
    points.push({ cle: `compte:${c.plateforme}:${c.id}`, source: 'compte', etat: c.etat, ton: 'geste', n: 1 });
  }
  if (ici) points.push({ cle: 'extension:ici', source: 'extension', ton: 'geste', n: 1 });
  return { etat: points.length ? 'points' : 'ok', n: points.length, points };
}
