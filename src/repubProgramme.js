// ── REPUBLIER À L'HEURE QU'IL CHOISIT (11 nov., lot republier-programme) ─────
// Julien : « je prépare ma sélection, je fixe l'heure de départ (ex. demain 18 h) ;
// l'atelier démarre à cette heure-là avec EXACTEMENT mes réglages ».
// §3 « Republication » : c'est LUI qui choisit les paires, l'ordre, l'espacement et
// qui lance — programmer est SON clic, à une heure qu'IL a écrite. Jamais un départ
// « au hasard » : l'heure n'est jamais tirée, ni décalée, ni rattrapée plus tard.
//
// ⚠️ LES CONDITIONS SE VÉRIFIENT AU DÉPART (dites à l'avance) : onglet vinted.fr ouvert
//    sur LE compte de la programmation, extension à jour, place dans les 50 actions/h,
//    aucun frein de Vinted, place dans les 50 republications du jour, aucun autre travail
//    en cours. Une seule manque — ou n'est PAS SUE (« pas su » ≠ « oui ») — ⇒ RIEN ne part,
//    la programmation passe « pas partie » avec la raison et le geste, et il est prévenu.
// ⚠️ UNE SEULE PROGRAMMATION EN ATTENTE PAR COMPTE ; modifiable / annulable jusqu'au départ.
// ⚠️ LE DÉPART EST PRIS PAR UN SEUL APPAREIL : comparer-et-échanger sur `data.rev` de la
//    ligne `vrm_repub_programme` (« en attente » → « partie ») ; deux Chrome ouverts sur le
//    même compte ne lancent jamais deux fois la même file.
// ⚠️ PASSÉ LA FENÊTRE (10 min après l'heure) ⇒ « pas partie » : un départ en retard n'est
//    pas l'heure qu'il a choisie.
// Module PUR (sauf `lireProgrammes` / `modifierProgrammes`, injectables) :
// src/RepubProgramme.jsx et scripts/audit-republier-programme.cjs.
import { lireLigne, modifierLigne } from './ligneCas.js';

export const LIGNE_PROGRAMME = 'vrm_repub_programme';
export const FENETRE_DEPART_MS = 10 * 60000;      // départ accepté de l'heure à +10 min
export const ATTENTE_AUTRE_APPAREIL_MS = 90000;   // un appareil « pas le bon » attend qu'un autre parte
export const AVANCE_MIN_MS = 2 * 60000;           // au moins 2 min devant soi
export const AVANCE_MAX_MS = 7 * 86400000;        // au plus 7 jours
export const MAX_PAIRES = 50;                     // REPUB_PAR_JOUR (extension)
export const REPUB_PAR_JOUR = 50;
export const GESTES_PAR_REPUB = 3;                // une republication réserve 3 gestes
export const ACTIONS_PROGRAMMABLES = ['recreer', 'versBrouillon', 'modifier', 'enLigne'];
// Ce qui compte dans les 50 republications du jour (une suppression d'annonce).
export const ACTIONS_QUOTA = ['recreer', 'versBrouillon'];
export const ETATS = ['attente', 'partie', 'pas-partie', 'annulee', 'finie'];

const str = (v) => String(v == null ? '' : v).trim();
const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

// Les réglages figés (titre, prix, photo, lettre, espacement, temps tirés, ordre) : une
// copie JSON bornée — ce qu'il a réglé, rien d'autre.
export function figerReglages(r) {
  const o = objet(r) || {};
  let j; try { j = JSON.parse(JSON.stringify(o)); } catch (_) { return null; }
  try { if (JSON.stringify(j).length > 60000) return null; } catch (_) { return null; }
  return j;
}

// Une programmation lisible, ou null.
export function normaliserProgramme(p) {
  const o = objet(p); if (!o) return null;
  const uid = str(o.uid), id = str(o.id), action = str(o.action);
  const at = ms(o.at);
  const ids = Array.isArray(o.ids) ? [...new Set(o.ids.map(str).filter(Boolean))] : [];
  if (!/^\d{1,20}$/.test(uid) || !id || !ACTIONS_PROGRAMMABLES.includes(action) || at == null || !ids.length) return null;
  const etat = ETATS.includes(o.etat) ? o.etat : 'attente';
  return { id, uid, compte: str(o.compte).slice(0, 80), action, ids: ids.slice(0, MAX_PAIRES), at, creeAt: ms(o.creeAt), majAt: ms(o.majAt),
    reglages: objet(o.reglages) || {}, etat, partieAt: ms(o.partieAt), appareil: str(o.appareil).slice(0, 60),
    raisons: Array.isArray(o.raisons) ? o.raisons.filter((x) => objet(x) && str(x.cle)).slice(0, 10).map((x) => ({ cle: str(x.cle), detail: str(x.detail).slice(0, 200) })) : [],
    vu: !!o.vu };
}

// Les programmations de la ligne, par compte (illisible ⇒ rien).
export function programmesDe(data) {
  const o = objet(data) && objet(data.programmes) ? data.programmes : {};
  const out = {};
  for (const k of Object.keys(o)) { const p = normaliserProgramme(o[k]); if (p && p.uid === k) out[k] = p; }
  return out;
}

// Une programmation neuve (ou la modification d'une existante : même `id`).
// Rend { ok: true, prog } · { ok: false, cle }.
export function creerProgramme({ uid, compte = '', action, ids, at, reglages, id = '', maintenant = Date.now(), alea = Math.random }) {
  const t = ms(at);
  if (!/^\d{1,20}$/.test(str(uid))) return { ok: false, cle: 'compte' };
  if (!ACTIONS_PROGRAMMABLES.includes(action)) return { ok: false, cle: 'action' };
  const liste = Array.isArray(ids) ? [...new Set(ids.map(str).filter(Boolean))] : [];
  if (!liste.length) return { ok: false, cle: 'vide' };
  if (liste.length > MAX_PAIRES) return { ok: false, cle: 'trop' };
  if (t == null) return { ok: false, cle: 'heure' };
  if (t < maintenant + AVANCE_MIN_MS) return { ok: false, cle: 'tot' };
  if (t > maintenant + AVANCE_MAX_MS) return { ok: false, cle: 'loin' };
  const r = figerReglages(reglages);
  if (!r) return { ok: false, cle: 'reglages' };
  const prog = { id: str(id) || `p${maintenant.toString(36)}${Math.floor(alea() * 1e6).toString(36)}`, uid: str(uid), compte: str(compte).slice(0, 80),
    action, ids: liste, at: t, creeAt: maintenant, majAt: maintenant, reglages: r, etat: 'attente', partieAt: null, appareil: '', raisons: [], vu: false };
  return { ok: true, prog };
}

// Poser dans la ligne. UNE en attente par compte : une autre en attente sous un autre
// `id` ⇒ refus 'deja' (l'écran demande « Remplacer ? », puis rappelle avec remplacer).
export function poserProgramme(data, prog, { remplacer = false } = {}) {
  const p = normaliserProgramme(prog); if (!p) return { refus: 'illisible' };
  const progs = programmesDe(data);
  const cur = progs[p.uid];
  if (cur && cur.etat === 'attente' && cur.id !== p.id && !remplacer) return { refus: 'deja', actuelle: cur };
  if (cur && cur.id === p.id && cur.etat !== 'attente') return { refus: 'plus-en-attente', actuelle: cur };
  return { data: { ...(objet(data) || {}), v: 1, programmes: { ...((objet(data) && objet(data.programmes)) || {}), [p.uid]: p } } };
}

// Changer l'état d'UNE programmation (désignée par compte ET id), seulement depuis `depuis`.
function changer(data, uid, id, depuis, patch) {
  const progs = programmesDe(data); const cur = progs[str(uid)];
  if (!cur || cur.id !== str(id) || !depuis.includes(cur.etat)) return undefined;
  return { ...(objet(data) || {}), v: 1, programmes: { ...((objet(data) && objet(data.programmes)) || {}), [cur.uid]: { ...cur, ...patch } } };
}
export const annulerProgramme = (data, uid, id, maintenant = Date.now()) => changer(data, uid, id, ['attente'], { etat: 'annulee', majAt: maintenant });
// Le départ PRIS par cet appareil (seulement depuis « en attente »).
export const prendreDepart = (data, uid, id, appareil, maintenant = Date.now()) => changer(data, uid, id, ['attente'], { etat: 'partie', partieAt: maintenant, appareil: str(appareil).slice(0, 60), majAt: maintenant });
// Pas partie : depuis « en attente » (vérifié au départ) ou « partie » (l'atelier n'a rien pu envoyer).
export const marquerPasPartie = (data, uid, id, raisons, maintenant = Date.now()) => changer(data, uid, id, ['attente', 'partie'], { etat: 'pas-partie', raisons: (raisons || []).slice(0, 10), majAt: maintenant, vu: false });
export const marquerFinie = (data, uid, id, maintenant = Date.now()) => changer(data, uid, id, ['partie'], { etat: 'finie', majAt: maintenant });
// « Vu » : la carte « pas partie » se range sur SON clic.
export const marquerVu = (data, uid, id) => changer(data, uid, id, ['pas-partie', 'finie', 'annulee'], { vu: true });

// Où en est l'heure : 'tot' (pas encore) · 'heure' (dans la fenêtre) · 'passee' (trop tard).
export function momentDepart(prog, maintenant = Date.now()) {
  if (!prog || prog.at == null) return null;
  if (maintenant < prog.at) return 'tot';
  return maintenant - prog.at <= FENETRE_DEPART_MS ? 'heure' : 'passee';
}

// CET appareil est-il celui qui part ? (son extension voit le compte de la programmation)
//  'oui' · 'autre-compte' (extension là, onglet sur un autre compte) · 'non' (pas d'extension / pas su).
export function appareilDepart(prog, ext) {
  const e = ext || {};
  if (!prog) return 'non';
  if (e.uidOnglet === undefined || e.uidOnglet === null || e.uidOnglet === '') return e.present ? 'autre-compte' : 'non';
  return String(e.uidOnglet) === String(prog.uid) ? 'oui' : 'autre-compte';
}

// ── LES CONDITIONS DU DÉPART ──────────────────────────────────────────────────
// ext   : { present, uidOnglet, capOk, repub: { onglet, frein: { jusqua, restreint } | null } | null }
//         (`repub` absent = l'extension ne le dit pas : pas su)
// jauge : { n, pourApp } | null (pas su) — les gestes de l'heure, tous Chrome
// jour  : nombre de republications du compte ces 24 h | null (pas su)
// occupe: un autre travail tourne (SuiviTravail)
// Rend { ok, manques: [{ cle, detail }] } — CHAQUE condition qui manque ou n'est pas sue.
export function conditionsDepart({ prog, ext, jauge, jour, occupe = false, maintenant = Date.now() }) {
  const m = [];
  const e = ext || {};
  if (!e.present) m.push({ cle: 'extension' });
  else if (!e.capOk) m.push({ cle: 'version' });
  const rp = e.repub;
  if (e.present && e.capOk) {
    if (!rp || rp.onglet == null) m.push({ cle: 'onglet-passu' });
    else if (rp.onglet !== true) m.push({ cle: 'onglet' });
  }
  if (e.present && (e.uidOnglet === undefined || e.uidOnglet === '')) m.push({ cle: 'compte-passu' });
  else if (e.present && String(e.uidOnglet || '') !== String(prog.uid)) m.push({ cle: 'compte' });
  if (e.present && e.capOk) {
    if (!rp || rp.frein === undefined) m.push({ cle: 'frein-passu' });
    else if (rp.frein && Number(rp.frein.jusqua) > maintenant) m.push({ cle: rp.frein.restreint ? 'frein-restreint' : 'frein', detail: String(Number(rp.frein.jusqua)) });
  }
  if (jauge == null || !Number.isFinite(Number(jauge.n)) || !Number.isFinite(Number(jauge.pourApp))) m.push({ cle: 'plafond-passu' });
  else if (Number(jauge.pourApp) - Number(jauge.n) < GESTES_PAR_REPUB) m.push({ cle: 'plafond', detail: `${Number(jauge.n)}` });
  if (ACTIONS_QUOTA.includes(prog.action)) {
    if (jour == null || !Number.isFinite(Number(jour))) m.push({ cle: 'jour-passu' });
    else if (Number(jour) + prog.ids.length > REPUB_PAR_JOUR) m.push({ cle: 'jour', detail: `${Math.max(0, REPUB_PAR_JOUR - Number(jour))}` });
  }
  if (occupe) m.push({ cle: 'occupe' });
  return { ok: m.length === 0, manques: m };
}

// Ce que l'appareil fait, à cet instant, d'UNE programmation (pur ; l'écran exécute).
//  'rien' · 'attendre' · 'verifier' (c'est l'heure et c'est cet appareil) ·
//  'manquee' (fenêtre passée sans départ, ou cet appareil n'est pas le bon et personne n'est parti)
export function decision(prog, { ext, maintenant = Date.now() } = {}) {
  if (!prog || prog.etat !== 'attente') return { quoi: 'rien' };
  const mo = momentDepart(prog, maintenant);
  if (mo === 'tot') return { quoi: 'attendre', dans: prog.at - maintenant };
  if (mo === 'passee') return { quoi: 'manquee', cle: 'ferme' };
  const ap = appareilDepart(prog, ext);
  if (ap === 'oui') return { quoi: 'verifier' };
  // Un autre Chrome est peut-être le bon : on lui laisse le temps de prendre le départ.
  if (maintenant - prog.at < ATTENTE_AUTRE_APPAREIL_MS) return { quoi: 'attendre', dans: ATTENTE_AUTRE_APPAREIL_MS - (maintenant - prog.at) };
  return ap === 'autre-compte' ? { quoi: 'verifier' } : { quoi: 'attendre', dans: Math.max(1000, prog.at + FENETRE_DEPART_MS - maintenant + 1000) };
}

// Ce qui part réellement : les paires programmées ENCORE proposables, dans SON ordre.
// Une paire qui a quitté la liste (vendue, retirée) n'est jamais remplacée par une autre.
export function pairesAuDepart(prog, proposables) {
  const dispo = new Set((proposables || []).map((a) => str(a && a.id)));
  const partent = prog.ids.filter((id) => dispo.has(id));
  const absentes = prog.ids.filter((id) => !dispo.has(id));
  return { partent, absentes };
}

// ── LA LIGNE (comparer-et-échanger) ──────────────────────────────────────────
export async function lireProgrammes(ctx) {
  const lu = await lireLigne(LIGNE_PROGRAMME, ctx);
  if (!lu) return null;
  return programmesDe(lu.data);
}
// `f(data)` rend la donnée à écrire ou undefined. Rend { ok, progs } · null (pas su).
export async function modifierProgrammes(f, ctx) {
  let refus = null;
  const r = await modifierLigne(LIGNE_PROGRAMME, (d) => { const x = f(d); if (x && x.refus) { refus = x; return undefined; } return x && x.data ? x.data : x; }, ctx);
  if (!r) return null;
  return { ok: r.ok, refus, progs: programmesDe(r.data) };
}
