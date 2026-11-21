// ═══════════════════════════════════════════════════════════════════════════
// REMISE EN MAIN PROPRE ORGANISÉE (11 nov., lot lbc-plus)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé) : sur une vente Leboncoin remise en main propre, il pose LUI-MÊME
// la date, l'heure et le lieu du rendez-vous ; une heure avant, UNE notification
// (la porte commune `sendPushToAll` : catégorie « rappel », échéance = l'heure du
// rendez-vous, donc jamais retenue par la fenêtre de regroupement) ; puis « Remis »
// en un toucher ⇒ la paire sort du stock (par identité, N° gardé) et la vente est
// datée pour la compta (`vrm_lbc_dates[tx]` — une date LUE par l'extension gagne
// toujours, `avecDatesLbc`).
//
// ⚠️ Rien n'est proposé ni créé sans SON clic « Enregistrer » (§3 : aucun rappel
//    automatique). L'IDENTITÉ est le n° de la transaction Leboncoin (`tx`) — jamais
//    un titre ; le N° n'est qu'une étiquette affichée (`num`, déjà décidé par
//    `numeroLbcIdentite`, §5).
//
// LA FORME (clé `vrm_remises` de `main`, synchronisée, fusionnée clé par clé) :
//   { [id]: { id, tx, num?, jour: 'AAAA-MM-JJ', heure: 'HH:MM', lieu, creeAt, majAt,
//             etat: 'prevue'|'remise'|'annulee', remiseAt? } }
// et `vrm_remise_fin` (ISO) = l'heure du DERNIER rendez-vous prévu : le passage de
// 15 min du serveur ne visite que les vendeurs dont `main.data->>vrm_remise_fin`
// est à venir (une projection filtrée, jamais `select=data`, §4.4).
//
// Pur : aucune lecture, aucune écriture — l'app et le serveur l'importent (§11).
// ═══════════════════════════════════════════════════════════════════════════

export const CLE_REMISES = 'vrm_remises';
export const CLE_REMISE_FIN = 'vrm_remise_fin';
export const MEMO_REMISES = 'remises_rappel_dedup';
export const AVANCE_MS = 60 * 60000;        // le rappel : une heure avant
export const RETARD_MAX_MS = 45 * 60000;    // un passage manqué rattrape jusqu'à 45 min (jamais après le rendez-vous)
export const LIEU_MAX = 80;
export const GARDER_JOURS = 30;

const RE_ID = /^[A-Za-z0-9_-]{6,40}$/;
const RE_TX = /^\d{3,20}$/;
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_NUM = /^[A-Za-z]{0,3}\d{1,6}$/;

export const cleNumRemise = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return RE_NUM.test(s) ? s : '';
};
const propre = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// L'instant (ms) de `jour` à `heure` (Paris), heure d'été comprise.
export function instantRemise(jour, heure) {
  if (!RE_JOUR.test(String(jour || '')) || !RE_HEURE.test(String(heure || ''))) return NaN;
  const [y, m, d] = jour.split('-').map(Number);
  const [hh, mm] = heure.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  for (const dec of [1, 2, 0]) {
    const t = guess - dec * 3600000;
    try {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t));
      const v = (k) => (p.find((x) => x.type === k) || {}).value;
      if (`${v('year')}-${v('month')}-${v('day')}` === jour && `${v('hour')}:${v('minute')}` === heure) return t;
    } catch (_) { return NaN; }
  }
  return NaN;
}
export function jourParisRemise(ms = Date.now()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
  catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}

// Une remise telle que la base la garde, ou `null` (illisible ⇒ jamais lue).
export function normaliserRemise(r) {
  if (!r || typeof r !== 'object' || !RE_ID.test(String(r.id || ''))) return null;
  const tx = RE_TX.test(String(r.tx || '')) ? String(r.tx) : '';
  if (!tx || !RE_JOUR.test(String(r.jour || '')) || !RE_HEURE.test(String(r.heure || ''))) return null;
  const etat = r.etat === 'remise' || r.etat === 'annulee' ? r.etat : 'prevue';
  const num = cleNumRemise(r.num);
  return { id: String(r.id), tx, ...(num ? { num } : {}), jour: String(r.jour), heure: String(r.heure), lieu: propre(r.lieu, LIEU_MAX),
    creeAt: String(r.creeAt || ''), majAt: String(r.majAt || r.creeAt || ''), etat, ...(r.remiseAt ? { remiseAt: String(r.remiseAt) } : {}) };
}
export function lireRemises(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const out = [];
  for (const [k, r] of Object.entries(o)) { const n = normaliserRemise(r); if (n && n.id === k) out.push(n); }
  return out;
}
export const idRemise = (alea = Math.random) => 'm' + Date.now().toString(36) + Math.floor(alea() * 1e9).toString(36).padStart(6, '0');

// La saisie : { ok, remise } ou { ok:false, erreur } — rien n'est créé sans date, heure,
// lieu ni transaction. Un rendez-vous déjà passé est refusé (il ne servirait à rien).
export function remiseSaisie({ tx, num, jour, heure, lieu } = {}, maintenant = Date.now(), id = idRemise(), avant = null) {
  if (!RE_TX.test(String(tx || ''))) return { ok: false, erreur: 'vente' };
  if (!RE_JOUR.test(String(jour || ''))) return { ok: false, erreur: 'jour' };
  if (!RE_HEURE.test(String(heure || ''))) return { ok: false, erreur: 'heure' };
  const l = propre(lieu, LIEU_MAX);
  if (!l) return { ok: false, erreur: 'lieu' };
  const t = instantRemise(jour, heure);
  if (!Number.isFinite(t) || t <= maintenant) return { ok: false, erreur: 'passe' };
  if (t > maintenant + 120 * 86400000) return { ok: false, erreur: 'loin' };
  const at = new Date(maintenant).toISOString();
  const r = normaliserRemise({ id: (avant && avant.id) || id, tx, num, jour, heure, lieu: l, creeAt: (avant && avant.creeAt) || at, majAt: at, etat: 'prevue' });
  return r ? { ok: true, remise: r } : { ok: false, erreur: 'forme' };
}
// La remise PRÉVUE d'une vente (une seule à la fois : la feuille modifie au lieu d'en créer une seconde).
export const remiseDeVente = (remises, tx) => (remises || []).find((r) => r.tx === String(tx) && r.etat === 'prevue') || null;
export const remiseFaiteDeVente = (remises, tx) => (remises || []).find((r) => r.tx === String(tx) && r.etat === 'remise') || null;

// Les gestes : rendent la carte À ÉCRIRE (une copie), ou `null` si rien ne change.
const avec = (carte, r) => { const n = normaliserRemise(r); return n ? { ...(carte && typeof carte === 'object' ? carte : {}), [n.id]: n } : null; };
export const poserRemise = (carte, r) => avec(carte, r);
export function marquerRemise(carte, id, maintenant = Date.now()) {
  const r = normaliserRemise(carte && carte[id]); if (!r || r.etat !== 'prevue') return null;
  const at = new Date(maintenant).toISOString();
  return avec(carte, { ...r, etat: 'remise', remiseAt: at, majAt: at });
}
export function annulerRemise(carte, id, maintenant = Date.now()) {
  const r = normaliserRemise(carte && carte[id]); if (!r || r.etat !== 'prevue') return null;
  return avec(carte, { ...r, etat: 'annulee', majAt: new Date(maintenant).toISOString() });
}
// Les remises faites ou annulées depuis plus de GARDER_JOURS : retirées (l'app, à son écriture).
export function purgerRemises(carte, maintenant = Date.now()) {
  const limite = maintenant - GARDER_JOURS * 86400000;
  const out = {};
  for (const [k, v] of Object.entries(carte && typeof carte === 'object' ? carte : {})) {
    const r = normaliserRemise(v); if (!r) continue;
    const t = Date.parse(r.majAt || r.creeAt || '');
    if (r.etat !== 'prevue' && Number.isFinite(t) && t < limite) continue;
    out[k] = v;
  }
  return out;
}
// `vrm_remise_fin` : l'heure du dernier rendez-vous PRÉVU (ISO), '' s'il n'y en a plus.
export function finRemises(carte) {
  let max = NaN;
  for (const r of lireRemises(carte)) { if (r.etat !== 'prevue') continue; const t = instantRemise(r.jour, r.heure); if (Number.isFinite(t) && !(t <= max)) max = t; }
  return Number.isFinite(max) ? new Date(max).toISOString() : '';
}

// ── Le serveur ──────────────────────────────────────────────────────────────
// Les rappels DUS à ce passage : prévue, l'heure « une heure avant » atteinte, le
// rendez-vous pas encore passé, au plus RETARD_MAX_MS de retard, jamais deux fois (mémo).
export const cleEnvoiRemise = (r) => `${r.id}|${r.jour}T${r.heure}`;
export function remisesDues(remises, memo, maintenant = Date.now()) {
  const m = memo && typeof memo === 'object' ? memo : {};
  return (remises || []).filter((r) => {
    if (!r || r.etat !== 'prevue') return false;
    const t = instantRemise(r.jour, r.heure);
    if (!Number.isFinite(t)) return false;
    const rappel = t - AVANCE_MS;
    return maintenant >= rappel && maintenant < t && maintenant - rappel <= RETARD_MAX_MS && !m[cleEnvoiRemise(r)];
  });
}
export function memoRemisesApres(memo, dus, maintenant = Date.now()) {
  const out = {};
  const limite = maintenant - 7 * 86400000;
  for (const [k, v] of Object.entries(memo && typeof memo === 'object' ? memo : {})) { const t = Date.parse(String(v || '')); if (Number.isFinite(t) && t >= limite) out[k] = v; }
  for (const r of dus) out[cleEnvoiRemise(r)] = new Date(maintenant).toISOString();
  return out;
}
// Le texte : l'heure, le N° et le lieu — jamais un nom d'acheteur (VRM n'en garde aucun).
export function texteRappelRemise(r) {
  const qui = r.num ? `N°${r.num}` : 'ta vente Leboncoin';
  return { title: `Remise à ${r.heure.replace(':', ' h ')} · ${qui}`, body: r.lieu ? `Rendez-vous : ${r.lieu}` : 'Rendez-vous dans une heure.' };
}
export function texteRappelsRemise(liste) {
  if (liste.length === 1) return texteRappelRemise(liste[0]);
  const t = liste.slice().sort((a, b) => (a.heure < b.heure ? -1 : 1));
  return { title: `${liste.length} remises en main propre dans l’heure`, body: t.map((r) => `${r.heure.replace(':', ' h ')} ${r.num ? 'N°' + r.num : ''}${r.lieu ? ' · ' + r.lieu : ''}`.trim()).join(' — ') };
}
export const TAG_REMISE = (id) => `remise-${id}`;
