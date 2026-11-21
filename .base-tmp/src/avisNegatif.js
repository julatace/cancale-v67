// ══════════════════════════════════════════════════════════════════════════════
//  UN AVIS DE 3★ OU MOINS VIENT D'ARRIVER — LA RÈGLE (11 nov. 2026, lot avis-negatif)
//  Une notification (heures calmes respectées) « Avis 2★ reçu sur shop_x » et une
//  carte dans Ma journée. Ce module ne lit ni n'écrit rien : le serveur
//  (api/_lib/avis-negatif.js) et l'app (src/AvisNegatifJournee.jsx) l'importent
//  tels quels (§11).
//
//  ⚠️ LA FORME EST CELLE MESURÉE (10 nov., 3 comptes, 60 avis) : la ligne
//     `harvest_{uid}_feedbacks` porte `payload.user_feedbacks`, un tableau
//     d'avis `{ id, rating, feedback }` (5.319, `avisPropre`) — ni date, ni
//     transaction, ni acheteur. Une autre forme (pas de tableau) = « pas su » ⇒
//     rien. Un avis sans identifiant ou sans note entière 1…5 est ignoré.
//  ⚠️ « NOUVEAU » SE PROUVE PAR L'IDENTIFIANT DE L'AVIS, jamais par une date (il
//     n'y en a pas), un titre ou un acheteur. La 1re lecture d'un compte est la
//     LIGNE DE BASE : elle ne sonne jamais (sinon installer ceci ferait sonner
//     tous les vieux avis). Ensuite, Vinted rend la 1re page du plus récent au
//     plus ancien : seuls les avis placés AVANT le premier avis déjà connu sont
//     neufs. Aucun avis connu dans la page (plus de 20 avis d'un coup, ou une
//     page qui ne ressemble plus) ⇒ « pas su » : rien ne sonne, les avis vus sont
//     retenus. Un identifiant vu ne sonne JAMAIS une seconde fois.
//  ⚠️ LA VENTE : seulement par le n° de transaction PORTÉ PAR L'AVIS
//     (`transaction_id`, gardé par l'extension 5.352 s'il existe — jamais vu à
//     ce jour). Sinon : le profil des avis sur Vinted. Jamais un rapprochement
//     par titre, date, prix ou acheteur (§5).
//  ⚠️ LE TEXTE : le serveur n'en a pas besoin et ne le met jamais dans une
//     notification (elle passe par Apple/Google) ; l'app le montre s'il est rangé
//     (il l'est déjà, `feedback`, lu ailleurs — Notes reçues, récap de vente),
//     sinon « Lis l'avis sur Vinted ». Aucun pseudo n'est rangé ni montré.
//  Aucune requête Vinted : tout vient de la lecture que l'extension fait déjà
//  (1re page, une fois par 24 h, budget de lecture). Aucun rappel d'évaluation.
// ══════════════════════════════════════════════════════════════════════════════

export const LIGNE_AVIS_BAS = 'vrm_avis_bas';          // la mémoire du SERVEUR (seul écrivain)
export const LIGNE_AVIS_BAS_VUS = 'vrm_avis_bas_vus';  // les « C'est vu » de l'APP (seul écrivain)
export const CAT_AVIS = 'avis';
export const SEUILS_AVIS = Object.freeze([1, 2, 3, 4]);
export const SEUIL_AVIS_DEFAUT = 3;
export const MAX_IDS = 200;          // identifiants retenus par compte (la page en porte 20)
export const MAX_ALERTES = 40;
export const ALERTE_MAX_MS = 14 * 864e5;   // une carte au plus 14 jours

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const RE_UID = /^\d{1,20}$/;
const RE_ID = /^[\w-]{1,40}$/;
const RE_TX = /^\d{1,20}$/;
const ms = (v) => { const n = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(n) && n > 0 ? n : null; };

// Le seuil réglé (Paramètres → Notifications) : `push_prefs.avisSeuil`, 1…4 ; sinon 3.
export function reglageSeuilAvis(prefs) {
  const s = prefs && typeof prefs === 'object' ? prefs.avisSeuil : null;
  return Number.isInteger(s) && SEUILS_AVIS.includes(s) ? s : SEUIL_AVIS_DEFAUT;
}

// L'identité d'un compte d'après l'id de sa ligne (`harvest_{uid}_feedbacks`).
export const uidDeLigne = (id) => { const m = /^harvest_(\d{1,20})_feedbacks$/.exec(String(id || '')); return m ? m[1] : ''; };

// Les avis d'une ligne, à la forme MESURÉE. `null` = pas su (forme inconnue,
// lecture ratée) ; `[]` = aucun avis ; sinon [{ id, note, tx }] dans l'ordre de Vinted.
export function avisDeLaLigne(liste) {
  if (!Array.isArray(liste)) return null;
  const out = [], vus = new Set();
  for (const f of liste) {
    if (!f || typeof f !== 'object') continue;
    const id = f.id != null ? String(f.id) : '';
    const note = Number(f.rating);
    if (!RE_ID.test(id) || vus.has(id) || !Number.isInteger(note) || note < 1 || note > 5) continue;
    vus.add(id);
    const t = f.transaction_id != null ? String(f.transaction_id) : '';
    out.push({ id, note, tx: RE_TX.test(t) ? t : '' });
  }
  // Une page non vide dont AUCUN avis n'a la forme mesurée n'est pas « aucun avis ».
  if (liste.length && !out.length) return null;
  return out;
}

// La mémoire, rebâtie champ par champ (liste blanche : jamais un texte, jamais un pseudo).
export function normaliserMemoireAvis(d) {
  const o = objet(d);
  const comptes = {};
  for (const [uid, c] of Object.entries(objet(o.comptes))) {
    if (!RE_UID.test(uid)) continue;
    const base = ms(objet(c).base);
    if (!base) continue;
    const ids = (Array.isArray(c.ids) ? c.ids : []).map(String).filter((x) => RE_ID.test(x)).slice(0, MAX_IDS);
    comptes[uid] = { base: new Date(base).toISOString(), ids };
  }
  const alertes = (Array.isArray(o.alertes) ? o.alertes : []).map(alertePropre).filter(Boolean).slice(0, MAX_ALERTES);
  return { comptes, alertes, rev: Number.isSafeInteger(o.rev) && o.rev >= 0 ? o.rev : undefined };
}
export function alertePropre(a) {
  const x = objet(a);
  const uid = String(x.uid || ''), id = String(x.id || ''), note = Number(x.note), at = ms(x.at);
  if (!RE_UID.test(uid) || !RE_ID.test(id) || !Number.isInteger(note) || note < 1 || note > 5 || !at) return null;
  const tx = RE_TX.test(String(x.tx || '')) ? String(x.tx) : '';
  return { uid, id, note, at: new Date(at).toISOString(), ...(tx ? { tx } : {}), ...(ms(x.notifie) ? { notifie: new Date(ms(x.notifie)).toISOString() } : {}) };
}
export const cleAlerte = (a) => `${a.uid}:${a.id}`;

// LA DÉCISION pour UN compte. `connu` : la mémoire du compte ({ base, ids }) ou
// null (jamais lu). `avis` : avisDeLaLigne(...). Rend
//   { etat: 'passu' }                          — rien changé, rien ne sonne ;
//   { etat: 'base', compte }                   — ligne de base posée, rien ne sonne ;
//   { etat: 'ordre', compte }                  — aucun avis connu dans la page : retenus, rien ne sonne ;
//   { etat: 'lu', compte, neufs, bas }         — `bas` : les neufs ≤ seuil (à annoncer).
export function detecterAvisBas(connu, avis, seuil = SEUIL_AVIS_DEFAUT, maintenant = Date.now()) {
  if (!Array.isArray(avis)) return { etat: 'passu' };
  const s = SEUILS_AVIS.includes(seuil) ? seuil : SEUIL_AVIS_DEFAUT;
  const ids = avis.map((a) => a.id);
  if (!connu || !ms(connu.base)) return { etat: 'base', compte: { base: new Date(maintenant).toISOString(), ids: ids.slice(0, MAX_IDS) } };
  const anciens = Array.isArray(connu.ids) ? connu.ids.map(String) : [];
  const set = new Set(anciens);
  const fusion = (neufs) => [...neufs.map((a) => a.id), ...anciens].filter((x, i, l) => l.indexOf(x) === i).slice(0, MAX_IDS);
  let neufs;
  if (!set.size) neufs = avis;                     // aucun avis à la base : tout ce qui paraît est neuf
  else {
    const i = avis.findIndex((a) => set.has(a.id));
    if (i === -1) return avis.length ? { etat: 'ordre', compte: { base: connu.base, ids: fusion(avis) } } : { etat: 'lu', compte: { base: connu.base, ids: anciens.slice(0, MAX_IDS) }, neufs: [], bas: [] };
    neufs = avis.slice(0, i).filter((a) => !set.has(a.id));
  }
  return { etat: 'lu', compte: { base: connu.base, ids: fusion(neufs) }, neufs, bas: neufs.filter((a) => a.note <= s) };
}

// Ajoute les alertes (une par avis, jamais deux fois la même clé), les plus récentes d'abord.
export function ajouterAlertes(alertes, uid, bas, maintenant = Date.now()) {
  const l = (Array.isArray(alertes) ? alertes : []).map(alertePropre).filter(Boolean);
  const cles = new Set(l.map(cleAlerte));
  const at = new Date(maintenant).toISOString();
  const neuves = [];
  for (const a of bas || []) {
    const x = alertePropre({ uid, id: a.id, note: a.note, tx: a.tx, at });
    if (x && !cles.has(cleAlerte(x))) { cles.add(cleAlerte(x)); neuves.push(x); }
  }
  const lim = maintenant - ALERTE_MAX_MS * 2;
  return { alertes: [...neuves, ...l].filter((a) => ms(a.at) >= lim).slice(0, MAX_ALERTES), neuves };
}

// ── LES LIENS ───────────────────────────────────────────────────────────────
const RE_DOMAINE = /^www\.vinted\.[a-z]{2,3}(\.[a-z]{2})?$/;
export const domaineVinted = (d) => (RE_DOMAINE.test(String(d || '')) ? String(d) : 'www.vinted.fr');
// Le profil des avis du compte sur Vinted (son id de PROFIL, lu dans `harvest_{uid}_profile`,
// à défaut l'identifiant du compte, comme `capterAvis`).
export function lienAvisVinted({ domaine, pid, uid } = {}) {
  const q = RE_UID.test(String(pid || '')) ? String(pid) : (RE_UID.test(String(uid || '')) ? String(uid) : '');
  return q ? `https://${domaineVinted(domaine)}/member/${q}?tab=feedback` : '';
}
export const RE_LIEN_AVIS = /^https:\/\/www\.vinted\.[a-z]{2,3}(\.[a-z]{2})?\/member\/\d{1,20}\?tab=feedback$/;
// L'adresse VRM de la vente — seulement par le n° de transaction porté par l'avis.
export const lienVenteAvis = (tx) => (RE_TX.test(String(tx || '')) ? `/?tab=ventes&site=vinted&cible=vente&tx=${tx}` : '');

// ── LE TEXTE DE LA NOTIFICATION (jamais le texte de l'avis, jamais un pseudo d'acheteur) ──
export function texteAvisBas({ nom = '', avis = [], seuil = SEUIL_AVIS_DEFAUT } = {}) {
  const sur = String(nom || '').trim() ? String(nom).trim().slice(0, 40) : 'ton compte Vinted';
  const l = (Array.isArray(avis) ? avis : []).filter((a) => a && Number.isInteger(a.note));
  if (!l.length) return null;
  const prouve = l.length === 1 && l[0].tx;
  if (l.length === 1) return { title: `Avis ${l[0].note}★ reçu sur ${sur}`, body: prouve ? 'Touche pour voir la vente et écrire à l’acheteur.' : 'Touche pour le lire sur Vinted et y répondre.' };
  const min = Math.min(...l.map((a) => a.note));
  return { title: `${l.length} avis de ${seuil}★ ou moins reçus sur ${sur}`, body: `Le plus bas : ${min}★. Touche pour les lire sur Vinted.` };
}

// ── LA CARTE DE MA JOURNÉE ──────────────────────────────────────────────────
// Les alertes à montrer : moins de 14 jours, pas marquées « vu », d'un compte présent.
export function alertesAMontrer(memo, vus, comptesPresents = null, maintenant = Date.now()) {
  const m = normaliserMemoireAvis(memo);
  const v = objet(objet(vus).vus);
  const presents = Array.isArray(comptesPresents) ? new Set(comptesPresents.map(String)) : null;
  return m.alertes.filter((a) => maintenant - ms(a.at) <= ALERTE_MAX_MS && !v[cleAlerte(a)] && (!presents || presents.has(a.uid)));
}
// « C'est vu » : la ligne des vus, rebâtie (60 jours au plus).
export function marquerVus(vus, cles, maintenant = Date.now()) {
  const v = { ...objet(objet(vus).vus) };
  for (const c of cles || []) if (/^\d{1,20}:[\w-]{1,40}$/.test(String(c))) v[c] = new Date(maintenant).toISOString();
  const lim = maintenant - 60 * 864e5;
  for (const k of Object.keys(v)) if (!(ms(v[k]) >= lim) || !/^\d{1,20}:[\w-]{1,40}$/.test(k)) delete v[k];
  return { vus: v };
}
// Le texte de l'avis rangé (s'il l'est), retrouvé par SON identifiant — rien d'autre.
export function texteDeLAvis(listeBrute, id) {
  if (!Array.isArray(listeBrute)) return null;
  const f = listeBrute.find((x) => x && String(x.id) === String(id));
  if (!f) return null;
  const t = typeof f.feedback === 'string' ? f.feedback.trim() : '';
  return t || null;
}
