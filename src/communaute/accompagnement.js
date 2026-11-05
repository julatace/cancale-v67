// ════════════════════════════════════════════════════════════════════════════
//  LES GROUPES D'ACCOMPAGNEMENT — règles de l'app (5 novembre, migration 025)
//  Module PUR (sauf `publierPartage` / `ecouterPartage`, qui lisent
//  localStorage et appellent la route) : exécuté par scripts/audit-accompagnement.cjs.
//
//  CE QUE L'APP PUBLIE, ET D'OÙ ÇA VIENT (§11 — aucune règle refaite ici) :
//   · les VENTES : `vrm_benefice_jours` (l'écran Ventes, son propriétaire :
//     ventes finalisées, toutes plateformes, datées au jour de la vente) —
//     [n, caCentimes, …] par jour ;
//   · les ACHATS : `vrm_achats_jours` (l'écran Achats, la règle de « Dépensé » :
//     achats Vinted hors annulés, datés au jour de l'achat) — [n, centimes] ;
//   · le DÉTAIL : `vrm_stats_ventes` (relevé vente par vente de l'écran Ventes)
//     et `vrm_achats_releve` (achat par achat) — seulement si le membre l'a
//     autorisé dans au moins un groupe (la BASE jette sinon).
//  « Pas su » ≠ 0 : une moitié qui n'a jamais été publiée sur cet appareil est
//  dite inconnue (`ventes:false` / `achats:false`), jamais comptée à zéro.
//  Le partage est calculé par la base à partir de CES agrégats ; elle ne lit
//  jamais les données du membre.
// ════════════════════════════════════════════════════════════════════════════

export const NIVEAUX = [
  ['rien', 'Rien', 'Le créateur voit ton nom et que tu es dans le groupe. Aucun chiffre.'],
  ['chiffres', 'Mes chiffres', 'Tes totaux par semaine et par mois : nombre de ventes, vendu, nombre d’achats, dépensé.'],
  ['detail', 'Chiffres et détail', 'En plus : chaque vente et chaque achat (article, prix, compte, date).'],
];
export const niveauDe = (p) => (p === 'detail' ? 2 : p === 'chiffres' ? 1 : 0);
export const STATUTS = { attente: 'En attente de validation', accepte: 'Membre', refuse: 'Demande refusée', retire: 'Retiré par le créateur', parti: 'Parti' };

export const codeLisible = (c) => (c && c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c || '');
export const codeTape = (x) => String(x || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
// Le lien d'invitation : il ouvre Communauté → Groupes avec le code déjà tapé.
export const lienInvitation = (code, origine = (typeof location !== 'undefined' ? location.origin : 'https://vrm.center')) =>
  `${origine}/?tab=communaute&groupe=${encodeURIComponent(code || '')}`;
// Le code d'un lien d'invitation (dans `?groupe=`), ou '' s'il n'y en a pas.
export const codeDuLien = (search) => {
  try { const c = codeTape(new URLSearchParams(search || '').get('groupe')); return CODE_RE.test(c) ? c : ''; } catch (_) { return ''; }
};

// ── LES PÉRIODES ─────────────────────────────────────────────────────────────
// La semaine ISO d'une date locale « AAAA-MM-JJ » (lundi → dimanche).
export function semaineIso(cleJour) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(cleJour || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const j = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - j);
  const an = d.getUTCFullYear();
  const n = Math.ceil(((d - Date.UTC(an, 0, 1)) / 86400000 + 1) / 7);
  return `${an}-W${String(n).padStart(2, '0')}`;
}
const cleJourDe = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Le lundi d'une semaine ISO (date locale), pour la dire en mots.
export function lundiDe(sem) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(sem || ''));
  if (!m) return null;
  const j4 = new Date(Date.UTC(+m[1], 0, 4));
  const lundi = new Date(j4); lundi.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() || 7) - 1) + (+m[2] - 1) * 7);
  return lundi;
}
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const libelleMois = (k) => { const m = /^(\d{4})-(\d{2})$/.exec(String(k || '')); return m ? `${MOIS[+m[2] - 1]} ${m[1]}` : String(k || ''); };
export const libelleSemaine = (k) => { const l = lundiDe(k); return l ? `sem. du ${l.getUTCDate()} ${MOIS[l.getUTCMonth()]}` : String(k || ''); };

// Les N dernières périodes jusqu'à `maintenant` (clés), de la plus ancienne à la plus récente.
export function dernieresPeriodes(pas, n, maintenant = Date.now()) {
  const out = [];
  if (pas === 'mois') {
    const d = new Date(maintenant); d.setDate(1);
    for (let i = 0; i < n; i++) { out.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); }
  } else {
    const d = new Date(maintenant);
    for (let i = 0; i < n; i++) { const k = semaineIso(cleJourDe(d)); if (!out.includes(k)) out.unshift(k); d.setDate(d.getDate() - 7); }
  }
  return out;
}

// ── CE QUE L'APP PUBLIE : LES CHIFFRES ───────────────────────────────────────
const SEMAINES_MAX = 104, MOIS_MAX = 24;
const entier = (x) => { const n = Math.round(Number(x) || 0); return n > 0 ? n : 0; };
// `ventes` = la publication `vrm_benefice_jours` ({ jours: { 'AAAA-MM-JJ': [n, caCentimes, …] } }) ou null ;
// `achats` = la publication `vrm_achats_jours` ({ jours: { 'AAAA-MM-JJ': [n, centimes] } }) ou null.
// Rend null si rien n'est connu (aucune des deux moitiés publiée).
export function chiffresPartage({ ventes = null, achats = null, maintenant = Date.now() } = {}) {
  const jv = ventes && ventes.jours && typeof ventes.jours === 'object' ? ventes.jours : null;
  const ja = achats && achats.jours && typeof achats.jours === 'object' ? achats.jours : null;
  if (!jv && !ja) return null;
  const semOk = new Set(dernieresPeriodes('semaine', SEMAINES_MAX, maintenant)), moisOk = new Set(dernieresPeriodes('mois', MOIS_MAX, maintenant));
  const semaines = {}, mois = {};
  const ajouter = (jours, i0) => {
    for (const [k, v] of Object.entries(jours || {})) {
      if (!Array.isArray(v)) continue;
      const s = semaineIso(k), mo = String(k).slice(0, 7);
      const n = entier(v[0]), c = entier(v[1]);
      if (!n && !c) continue;
      if (s && semOk.has(s)) { const a = semaines[s] || (semaines[s] = [0, 0, 0, 0]); a[i0] += n; a[i0 + 1] += c; }
      if (/^\d{4}-\d{2}$/.test(mo) && moisOk.has(mo)) { const a = mois[mo] || (mois[mo] = [0, 0, 0, 0]); a[i0] += n; a[i0 + 1] += c; }
    }
  };
  ajouter(jv, 0); ajouter(ja, 2);
  return { v: 1, ventes: !!jv, achats: !!ja, semaines, mois, at: Math.round(maintenant) };
}

// ── CE QUE L'APP PUBLIE : LE DÉTAIL ──────────────────────────────────────────
const LIGNES_MAX = 300;
const texte = (s, n = 120) => String(s == null ? '' : s).replace(/[<>]/g, '').slice(0, n);
const centimes = (e) => (e == null || e === '' || !isFinite(Number(e)) ? null : Math.max(0, Math.round(Number(e) * 100)));
// `releve` = `vrm_stats_ventes` ({ l: [[plateforme, compte, tx, ts, vente€|null, achat€, frais€, titre, …]] }) ;
// `achats` = `vrm_achats_releve` ({ l: [[ts, compte, titre, €|null]] }). Les 300 plus récentes de chaque.
export function detailPartage({ releve = null, achats = null, maintenant = Date.now() } = {}) {
  const lv = releve && Array.isArray(releve.l) ? releve.l : null, la = achats && Array.isArray(achats.l) ? achats.l : null;
  if (!lv && !la) return null;
  const ventes = (lv || []).filter((r) => Array.isArray(r) && isFinite(Number(r[3])) && Number(r[3]) > 0)
    .map((r) => [Math.round(Number(r[3])), texte(r[0], 20), texte(r[1], 60), texte(r[7]), centimes(r[4])])
    .sort((a, b) => b[0] - a[0]).slice(0, LIGNES_MAX);
  const ach = (la || []).filter((r) => Array.isArray(r) && isFinite(Number(r[0])) && Number(r[0]) > 0)
    .map((r) => [Math.round(Number(r[0])), texte(r[1], 60), texte(r[2]), centimes(r[3])])
    .sort((a, b) => b[0] - a[0]).slice(0, LIGNES_MAX);
  return { v: 1, ventes, achats: ach, at: Math.round(maintenant) };
}

// ── CE QUE VOIT LE CRÉATEUR (lecture de la vue rendue par la base) ───────────
// Une série par période ; une moitié inconnue ⇒ null (« — »), jamais 0.
export function serieVue(chiffres, pas = 'mois', n = pas === 'mois' ? 6 : 8, maintenant = Date.now()) {
  if (!chiffres || typeof chiffres !== 'object') return null;
  const src = (pas === 'mois' ? chiffres.mois : chiffres.semaines) || {};
  return dernieresPeriodes(pas, n, maintenant).map((k) => {
    const a = Array.isArray(src[k]) ? src[k] : [0, 0, 0, 0];
    return { cle: k, libelle: pas === 'mois' ? libelleMois(k) : libelleSemaine(k),
      ventes: chiffres.ventes ? a[0] : null, ca: chiffres.ventes ? a[1] / 100 : null,
      achats: chiffres.achats ? a[2] : null, depense: chiffres.achats ? a[3] / 100 : null };
  });
}
// Ce que la vue d'un membre montre, en un mot (la même règle pour le créateur et le membre).
export function etatVue(vue) {
  if (!vue) return 'pas-su';
  if (vue.statut !== 'accepte') return 'pas-membre';
  if (!('chiffres' in vue)) return 'rien';
  if (vue.chiffres == null) return 'pas-publie';
  return 'detail' in vue ? 'detail' : 'chiffres';
}

// ── LA PUBLICATION (l'app du membre, pour lui-même) ──────────────────────────
// Le niveau le plus haut des groupes où il est (rendu par la base, rangé ici
// par l'écran Communauté) décide ce qui PART : rien sous « chiffres », le
// détail seulement à « détail ». La base rejette de toute façon le reste.
export const CLE_NIVEAU = 'vrm_accomp_niveau', CLE_SIGNATURE = 'vrm_accomp_signature';
const lireLocal = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } };
const ecrireLocal = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
export const noterNiveau = (n) => { ecrireLocal(CLE_NIVEAU, Number(n) || 0); if (!(Number(n) > 0)) ecrireLocal(CLE_SIGNATURE, null); };
export function charge(niveau, lire = lireLocal, maintenant = Date.now()) {
  if (!(niveau >= 1)) return null;
  const chiffres = chiffresPartage({ ventes: lire('vrm_benefice_jours'), achats: lire('vrm_achats_jours'), maintenant });
  const detail = niveau >= 2 ? detailPartage({ releve: lire('vrm_stats_ventes'), achats: lire('vrm_achats_releve'), maintenant }) : null;
  if (!chiffres && !detail) return null;
  return { chiffres, detail };
}
// Rend : 'rien' (rien à publier) · 'inchange' · 'publie' · 'refuse' · 'pas-su'.
export async function publierPartage(headers, { force = false, lire = lireLocal, envoyer = fetch } = {}) {
  const niveau = Number(lire(CLE_NIVEAU)) || 0;
  const c = charge(niveau, lire);
  if (!c) return 'rien';
  const sig = JSON.stringify([niveau, c.chiffres && { ...c.chiffres, at: 0 }, c.detail && { ...c.detail, at: 0 }]);
  if (!force && lire(CLE_SIGNATURE) === sig) return 'inchange';
  try {
    const r = await envoyer('/api/compte?mode=communaute', { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accomp-publier', chiffres: c.chiffres, detail: c.detail }) });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.ok) { ecrireLocal(CLE_SIGNATURE, sig); return 'publie'; }
    if (j && j.erreur === 'rien-a-partager') { noterNiveau(0); return 'refuse'; }
    return j && j.erreur && j.erreur !== 'pas-su' ? 'refuse' : 'pas-su';
  } catch (_) { return 'pas-su'; }
}
// Monté une fois avec la session (AppCoeur) : republie quand un agrégat change,
// seulement si le membre partage quelque chose (niveau rangé ≥ 1).
const CLES_SOURCES = ['vrm_benefice_jours', 'vrm_achats_jours', 'vrm_stats_ventes', 'vrm_achats_releve'];
export function ecouterPartage(headers) {
  if (typeof window === 'undefined') return () => {};
  let t = null;
  const plus_tard = (ms) => { clearTimeout(t); t = setTimeout(() => { if ((Number(lireLocal(CLE_NIVEAU)) || 0) >= 1) publierPartage(headers); }, ms); };
  const f = (e) => { const k = e && e.detail && e.detail.k; if (CLES_SOURCES.includes(k)) plus_tard(8000); };
  window.addEventListener('vrm:save', f);
  plus_tard(15000);
  return () => { clearTimeout(t); window.removeEventListener('vrm:save', f); };
}
