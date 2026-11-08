// api/_lib/garde-capture.js
// ────────────────────────────────────────────────────────────────────────────
// (8 nov.) LES GARDE-FOUS DE LA CAPTURE — « ce problème ne doit plus jamais se
// produire » (Julien, après deux jours où son extension Orion n'envoyait plus
// rien : la 5.322 coupait un envoi de 1 Mo, puis vrm.center refusait le
// préalable CORS). Personne ne l'a vu pendant deux jours : ni l'app, ni une
// notification. Ce module dit, à partir de ce que les extensions PUBLIENT
// (une ligne `ext_appareil_{id}` par navigateur, extension 5.327) :
//   · chaque appareil où l'extension tourne : son nom (« Orion · iPhone »), sa
//     version, « à jour » ou la version à installer avec le bon paquet ;
//   · la PANNE d'un compte : pas relu depuis plus de 12 h ALORS QUE l'extension
//     a travaillé sur ce site depuis moins de 12 h — preuve LUE, jamais
//     supposée : soit elle a VU ce compte ouvert (une lecture reçue de Vinted)
//     sans que rien n'arrive, soit son dernier envoi pour ce site a été REFUSÉ.
//     La cause est celle que l'extension a notée (code, famille, taille,
//     appareil) ; le geste en découle.
// « Pas su » ≠ panne : aucune ligne d'appareil (extension jamais active, ou
// d'avant la 5.327), aucun appareil actif depuis 12 h, un compte « jamais relu »
// que personne n'a vu ⇒ AUCUNE alerte (le rappel « compte pas relu depuis
// 24 h », api/_lib/comptes-a-relire.js, reste le filet).
// Une seule règle (§11) : l'app (Paramètres → Tout va bien ?, la ligne ambre)
// et le cron du matin et du soir (la notification) l'importent telle quelle.
// Pur : aucune lecture, aucune écriture.
// ────────────────────────────────────────────────────────────────────────────
import { ageLecture } from '../../src/comptesLies.js';

export const PANNE_MS = 12 * 3600e3;            // pas relu depuis plus de 12 h…
export const ACTIF_MS = 12 * 3600e3;            // …alors que l'extension a travaillé depuis moins de 12 h
export const VU_MARGE_MS = 10 * 60e3;           // vu ouvert 10 min APRÈS la dernière relecture
export const APPAREIL_VISIBLE_MS = 30 * 864e5;  // un appareil muet depuis 30 j n'est plus montré
export const RE_ID_APPAREIL = /^ext_appareil_([a-f0-9]{16})$/;
export const PREFIXE_APPAREIL = 'ext_appareil_';
// Ce qu'on lit d'une ligne d'appareil : des champs courts, jamais `data` entier (§4.4).
export const SELECT_APPAREILS = 'id,ap:data->appareil,ver:data->>ver,code:data->>code,at:data->>atMs,flux:data->flux,vus:data->vus';
export const PLATEFORMES_EXT = Object.freeze(['vinted', 'leboncoin', 'vestiaire']);
export const CAT_CAPTURE = 'capture';
export const ID_MEMO_CAPTURE = 'capture_panne_dedup';

const NOM_NAV = { chrome: 'Chrome', edge: 'Edge', opera: 'Opera', firefox: 'Firefox', orion: 'Orion' };
const NOM_SYS = { iphone: 'iPhone', ipad: 'iPad', mac: 'Mac', windows: 'Windows', android: 'Android', linux: 'Linux', chromeos: 'Chromebook' };
const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
const ONGLET = { vinted: 'vinted.fr', leboncoin: 'leboncoin.fr', vestiaire: 'Vestiaire' };

const ms = (v) => { const n = typeof v === 'string' && !/^\d+$/.test(v) ? Date.parse(v) : Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// ── LES VERSIONS ────────────────────────────────────────────────────────────
export function comparerVersions(a, b) {
  const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}
const versionOk = (v) => /^\d+\.\d+\.\d+$/.test(String(v || ''));
export const versionCourte = (v) => String(v || '').replace(/\.0$/, '');
// 'a-jour' · 'ancienne' · 'pas-su' (version illisible, ou attendue inconnue).
// Le CODE fait foi (un manifeste neuf sur un code ancien ne sait rien de plus).
export function etatVersion(app, attendue) {
  const v = app && (versionOk(app.code) ? app.code : app.ver);
  if (!versionOk(v) || !versionOk(attendue)) return 'pas-su';
  return comparerVersions(v, attendue) >= 0 ? 'a-jour' : 'ancienne';
}

// ── LE PAQUET À INSTALLER, ET SES TROIS GESTES ─────────────────────────────
export const LIENS_PAQUET = Object.freeze({ chromium: '/VRM-extension.zip', orion: '/VRM-Orion.xpi' });
export function gestesMiseAJour(app, attendue) {
  const v = versionCourte(attendue);
  if (app && app.paquet === 'orion') return {
    lien: LIENS_PAQUET.orion, nomLien: 'VRM-Orion.xpi',
    gestes: [`Dans Orion, sur cet appareil, ouvre le lien VRM-Orion.xpi (la ${v}) et enregistre-le dans Fichiers.`,
      'Orion : ••• › Extensions › + › installation depuis un fichier, choisis VRM-Orion.xpi et accepte : elle remplace l’ancienne.',
      'Recharge l’onglet vinted.fr, puis touche le logo VRM : la carte doit dire ' + v + '.'],
  };
  if (app && app.paquet === 'firefox') return {
    lien: null, nomLien: '',
    gestes: [`Firefox : la ${v} n’est pas encore publiée sur addons.mozilla.org.`, 'Rien à télécharger ici pour l’instant.', 'Sur un ordinateur, Chrome ou Edge prennent le zip VRM-extension.'],
  };
  const nav = (app && NOM_NAV[app.nav]) || 'ton navigateur';
  const page = app && app.nav === 'edge' ? 'edge://extensions' : app && app.nav === 'opera' ? 'opera://extensions' : 'chrome://extensions';
  return {
    lien: LIENS_PAQUET.chromium, nomLien: 'VRM-extension.zip',
    gestes: [`Télécharge VRM-extension.zip (la ${v}) et ouvre-le : il donne UN dossier « VRM-extension ».`,
      'Remplace l’ancien dossier VRM-extension par celui-ci, au même endroit.',
      `Dans ${nav}, ouvre ${page} et clique ⟳ (la flèche ronde) sur VRM.`],
  };
}

// ── UNE LIGNE D'APPAREIL, LUE ───────────────────────────────────────────────
export function nomAppareil(ap) {
  const a = objet(ap);
  const nav = NOM_NAV[a.nav] || 'Navigateur';
  const sys = NOM_SYS[a.systeme] || '';
  return sys ? `${nav} · ${sys}` : nav;
}
function lireFlux(f) {
  const out = {};
  for (const p of PLATEFORMES_EXT) {
    const x = objet(objet(f)[p]);
    const refus = (Array.isArray(x.refus) ? x.refus : []).filter((r) => r && ms(r.at)).slice(-5)
      .map((r) => ({ at: ms(r.at), statut: r.statut == null ? null : String(r.statut).slice(0, 20), famille: String(r.famille || '').slice(0, 40), octets: Number(r.octets) > 0 ? Number(r.octets) : 0 }));
    const s = objet(x.secours);
    out[p] = { okAt: ms(x.okAt), koAt: ms(x.koAt), koStatut: x.koStatut == null ? null : String(x.koStatut).slice(0, 20), refus,
      secours: ms(s.at) ? { at: ms(s.at), etat: String(s.etat || '').slice(0, 20), octets: Number(s.octets) > 0 ? Number(s.octets) : 0 } : null };
  }
  return out;
}
function lireVus(v) {
  const out = {};
  for (const p of PLATEFORMES_EXT) {
    const m = {};
    for (const [id, at] of Object.entries(objet(objet(v)[p]))) { const t = ms(at); if (t && /^[\w:-]{1,64}$/.test(id)) m[id] = t; }
    out[p] = m;
  }
  return out;
}
// `row` : la projection `SELECT_APPAREILS`. `null` = ce n'est pas une ligne d'appareil lisible.
export function lireAppareil(row) {
  const m = RE_ID_APPAREIL.exec(String((row && row.id) || ''));
  if (!m) return null;
  const at = ms(row.at);
  if (!at) return null;
  const ap = objet(row.ap);
  const paquet = ['orion', 'firefox', 'chromium'].includes(ap.paquet) ? ap.paquet : 'chromium';
  const app = { id: m[1], paquet, nav: NOM_NAV[ap.nav] ? ap.nav : '', systeme: NOM_SYS[ap.systeme] ? ap.systeme : '',
    ver: versionOk(row.ver) ? String(row.ver) : '', code: versionOk(row.code) ? String(row.code) : '', at,
    flux: lireFlux(row.flux), vus: lireVus(row.vus) };
  app.nom = nomAppareil(app);
  return app;
}
// Les appareils montrés : vus depuis moins de 30 j, le plus récent d'abord.
export function lireAppareils(rows, maintenant = Date.now()) {
  if (!Array.isArray(rows)) return null;
  return rows.map(lireAppareil).filter((a) => a && maintenant - a.at <= APPAREIL_VISIBLE_MS).sort((a, b) => b.at - a.at);
}

// ── LA CAUSE D'UN REFUS, EN FRANÇAIS ────────────────────────────────────────
const FAMILLES = { orders_sold: 'tes ventes', orders_purchased: 'tes achats', listings: 'tes annonces', inbox: 'tes messages', profile: 'ton profil', billing: 'ton porte-monnaie' };
export function familleLisible(f) {
  const m = /^harvest_(.+)$/.exec(String(f || ''));
  if (m && FAMILLES[m[1]]) return FAMILLES[m[1]];
  if (/^lbc/.test(String(f || ''))) return 'Leboncoin';
  if (/^vc/.test(String(f || ''))) return 'Vestiaire';
  return '';
}
export function tailleLisible(o) {
  const n = Number(o) || 0;
  if (n <= 0) return '';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
  return `${Math.max(1, Math.round(n / 1024))} Ko`;
}
export function causeRefus(statut) {
  const s = statut == null ? '' : String(statut);
  if (s === 'reseau') return 'réseau coupé : le navigateur a interrompu l’envoi';
  if (s === 'sans_session') return 'l’extension n’est pas connectée à ton compte VRM';
  if (s === '401') return 'la base a refusé la session de l’extension';
  if (s === '403') return 'la base refuse ce compte';
  if (s === 'incomplet') return 'envoi en plusieurs parts pas terminé';
  if (/^5\d\d$/.test(s)) return `la base a répondu une erreur (code ${s})`;
  if (/^4\d\d$/.test(s)) return `refusé par la base (code ${s})`;
  return 'code inconnu';
}
// « réseau coupé … · tes ventes · 1,0 Mo »
export function phraseRefus(r) {
  if (!r) return '';
  return [causeRefus(r.statut), familleLisible(r.famille), tailleLisible(r.octets)].filter(Boolean).join(' · ');
}

// Le dernier refus d'un site sur un appareil, s'il est son DERNIER état (un
// envoi réussi après lui le rend caduc). `null` sinon.
function refusCourant(app, p) {
  const f = app.flux[p];
  if (!f || !f.koAt || (f.okAt && f.okAt > f.koAt)) return null;
  const r = f.refus.length ? f.refus[f.refus.length - 1] : { at: f.koAt, statut: f.koStatut, famille: '', octets: 0 };
  return Object.assign({}, r, { appareil: app });
}

// ── LE GESTE ────────────────────────────────────────────────────────────────
export function gestePanne({ plateforme, preuve, refus, appareil, attendue }) {
  const onglet = ONGLET[plateforme] || 'le site';
  const app = (refus && refus.appareil) || appareil || null;
  const sur = app ? ` sur ${app.nom}` : '';
  if (app && etatVersion(app, attendue) === 'ancienne') return `installe l’extension ${versionCourte(attendue)}${sur} (Paramètres → Tout va bien ?)`;
  const s = refus ? String(refus.statut == null ? '' : refus.statut) : '';
  if (s === 'sans_session' || s === '401') return `reconnecte l’extension${sur} : touche le logo VRM, puis « Se connecter avec VRM »`;
  if (s === '403') return 'vérifie que ton abonnement VRM est actif (Paramètres → Mon abonnement)';
  if (preuve === 'vu' && !refus) return `recharge l’onglet ${onglet}${sur} ; si ça revient, Paramètres → Aide → Signaler un problème`;
  return `recharge l’onglet ${onglet}${sur} : l’extension réessaie à chaque visite ; si ça revient, Paramètres → Aide → Signaler un problème`;
}

// ── LES PANNES ──────────────────────────────────────────────────────────────
// comptes : [{ plateforme, id, nom, lu, ecarte }] — `ecarte` : masqué, banni,
//   délié, hors des totaux (son choix, ou rien à relire) ⇒ jamais nommé.
// appareils : `lireAppareils(...)` ; `null` (pas su) ⇒ `null`.
// Rend `null` (pas su) ou [{ plateforme, id, nom, lu, age, preuve, vuAt, refus,
//   appareil, cause, geste, cle }], le plus ancien d'abord.
export function pannesCapture({ comptes, appareils, attendue = '', maintenant = Date.now() } = {}) {
  if (!Array.isArray(comptes) || !Array.isArray(appareils)) return null;
  const actifs = appareils.filter((a) => a && maintenant - a.at <= ACTIF_MS);
  if (!actifs.length) return [];                                    // jamais active, ou endormie : pas su
  const out = [], vus = new Set();
  for (const c of comptes) {
    const p = c && c.plateforme, id = c && c.id != null ? String(c.id) : '';
    if (!PLATEFORMES_EXT.includes(p) || !id || c.ecarte) continue;
    const cle0 = p + ':' + id; if (vus.has(cle0)) continue; vus.add(cle0);
    const lu = ms(c.lu);
    if (lu && maintenant - lu <= PANNE_MS) continue;               // relu : rien
    // Preuve 1 : un appareil l'a VU ouvert (une lecture reçue du site) après sa dernière relecture.
    let vuAt = null, vuPar = null;
    for (const a of actifs) { const t = a.vus[p] && a.vus[p][id]; if (t && maintenant - t <= ACTIF_MS && (!lu || t > lu + VU_MARGE_MS) && (!vuAt || t > vuAt)) { vuAt = t; vuPar = a; } }
    // Preuve 2 : le dernier envoi de ce site a été REFUSÉ, depuis moins de 12 h, après sa relecture.
    let refus = null;
    for (const a of actifs) { const r = refusCourant(a, p); if (r && maintenant - r.at <= ACTIF_MS && (!lu || r.at > lu) && (!refus || r.at > refus.at)) refus = r; }
    // « Jamais relu » : seulement s'il a été VU (un refus ne dit pas quel compte).
    if (!vuAt && !(refus && lu)) continue;
    const preuve = vuAt ? 'vu' : 'refus';
    const appareil = (refus && refus.appareil) || vuPar;
    const cause = refus ? phraseRefus(refus) : 'l’extension l’a lu sans que rien n’arrive dans VRM';
    out.push({ plateforme: p, id, nom: String(c.nom || '') || `n° ${id}`, lu, age: ageLecture(lu, maintenant), preuve, vuAt, refus, appareil,
      cause, geste: gestePanne({ plateforme: p, preuve, refus, appareil, attendue }), cle: `${p}:${id}:${lu || 0}` });
  }
  return out.sort((a, b) => (a.lu || 0) - (b.lu || 0) || a.nom.localeCompare(b.nom, 'fr'));
}

// ── LA NOTIFICATION ─────────────────────────────────────────────────────────
// Une par PANNE : la clé d'une panne est (site, compte, dernière relecture) —
// tant que le compte n'est pas relu, c'est la même panne, elle ne resonne pas ;
// relu puis de nouveau bloqué, c'est une autre. `memo` lu en trois états
// (`undefined` = illisible ⇒ rien envoyé, on ne risque pas de répéter).
export function decisionPannes({ liste, memo, maintenant = Date.now() }) {
  if (!Array.isArray(liste)) return { envoyer: false, raison: 'lecture ratée — rien envoyé', nouvelles: [] };
  if (!liste.length) return { envoyer: false, raison: 'aucune panne', nouvelles: [] };
  if (memo === undefined) return { envoyer: false, raison: 'mémo illisible — rien envoyé', nouvelles: [] };
  const deja = objet(memo && memo.cles);
  const nouvelles = liste.filter((p) => !deja[p.cle]);
  if (!nouvelles.length) return { envoyer: false, raison: 'déjà prévenu pour ces pannes', nouvelles: [] };
  // Le mémo garde les pannes en cours et celles des 14 derniers jours, 200 au plus.
  const garde = Object.entries(deja).filter(([, t]) => maintenant - Number(t) < 14 * 864e5);
  for (const p of nouvelles) garde.push([p.cle, maintenant]);
  const cles = Object.fromEntries(garde.sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 200));
  return { envoyer: true, raison: 'panne', nouvelles, memo: { cles, at: new Date(maintenant).toISOString() } };
}
export function textePannes(liste) {
  const l = Array.isArray(liste) ? liste.filter(Boolean) : [];
  if (!l.length) return null;
  if (l.length === 1) {
    const p = l[0];
    return { title: `⚠️ ${NOM_SITE[p.plateforme] || ''} · ${p.nom} n’arrive plus dans VRM`.replace(' ·  ', ' '),
      body: `Pas relu depuis ${String(p.age || 'plus de 12 h').replace(/^il y a /, '')} — ${p.cause}${p.appareil ? ` (${p.appareil.nom})` : ''}. Geste : ${p.geste}.` };
  }
  const noms = l.slice(0, 4).map((p) => p.nom);
  const reste = l.length - noms.length;
  return { title: `⚠️ ${l.length} comptes n’arrivent plus dans VRM`,
    body: `${noms.join(', ')}${reste > 0 ? ` et ${reste} autre${reste > 1 ? 's' : ''}` : ''} : ${l[0].cause}. Ouvre VRM › Paramètres › Tout va bien ? pour le geste.` };
}
