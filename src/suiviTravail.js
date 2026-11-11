// ═══════════════════════════════════════════════════════════════════════════
// LE SUIVI D'UN TRAVAIL LONG (11 nov., demande de Julien : « quand l'app
// republie, publie de Vinted à Leboncoin, je veux que VRM reste FIGÉ et qu'il y
// ait un DÉTAIL de toutes les infos que VRM fait, avec une BARRE DE
// PROGRESSION »). Règle PURE (aucun DOM, aucune horloge cachée : `now` est
// passé) + un petit magasin (`suivi`) que les écrans pilotent et que la feuille
// `src/composants/SuiviTravail.jsx` dessine.
//
// Ce qui est dit, jamais deviné :
//  • la barre = articles FINIS (réussis ou non) + la part de l'étape en cours ;
//    « N sur M » ; l'étape de l'annonce en cours vient de l'écran (qui la lit de
//    l'extension) ;
//  • le temps restant est une ESTIMATION mesurée sur le rythme RÉEL (temps
//    écoulé, pauses comprises ÷ articles finis × articles restants) — `null`
//    tant qu'aucun article n'est fini (« — », jamais un chiffre inventé) ; il
//    se dit toujours « environ » ;
//  • la pause de sécurité est celle que l'écran (ou l'extension) a posée, avec
//    son échéance ; le compte à rebours la lit ;
//  • le journal : une ligne par geste, horodatée, en français simple, sans rien
//    de personnel (`nettoyer` retire adresses e-mail, @pseudos, téléphones,
//    liens de profil ; les écrans ne passent JAMAIS de pseudo ni de texte de
//    message — ceci n'est qu'un filet).
//  • « Mettre en pause » = la demande est posée ; l'écran finit l'étape en
//    cours puis s'arrête (`doitSArreter`). « Arrêter » = pareil, définitif.
//  • Reprise : l'état est gardé sur l'appareil à chaque pas (`CLE_SUIVI`). Après
//    un rechargement, la boucle de l'écran est morte : la feuille revient en
//    « interrompu » avec l'état écrit au dernier pas, et l'article qui était en
//    cours est dit « à vérifier » — sauf si l'extension, relue, dit elle-même
//    où il en est (`repriseDepuisExtension`).
// API pour les autres chantiers (« Publier partout ») : voir
// docs/passation/2026-11-11-suivi-travail.md et COORDINATION-AGENTS.md.
// ═══════════════════════════════════════════════════════════════════════════

export const CLE_SUIVI = 'vrm_suivi_travail';          // le travail en cours (ou interrompu)
export const CLE_TRAVAUX = 'vrm_suivi_travaux';        // les travaux finis, gardés (≤ 20)
export const MAX_JOURNAL = 400;
export const MAX_TRAVAUX = 20;
export const ETATS_ARTICLE = ['attente', 'encours', 'ok', 'main', 'refus', 'saute'];
const FINIS = new Set(['ok', 'main', 'refus', 'saute']);

// ── Rien de personnel dans une ligne ────────────────────────────────────────
export function nettoyer(texte, max = 220) {
  let s = String(texte == null ? '' : texte);
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[adresse]')
    .replace(/https?:\/\/\S*(member|membre|user|profil|profile|messages?|inbox|conversation)\S*/gi, '[lien]')
    .replace(/(^|[\s(«"'])@[\w.-]{2,}/g, '$1[pseudo]')
    .replace(/(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}/g, '[téléphone]')
    .replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ── Formats ────────────────────────────────────────────────────────────────
const deux = (n) => String(n).padStart(2, '0');
export const heureJournal = (ms) => { const d = new Date(ms); return isNaN(d) ? '' : `${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`; };
// « 2 min 10 » · « 45 s » · « 1 h 05 » (secondes entières, jamais négatif : -0 < 0 est faux, §4.12)
export function duree(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${deux(s % 60)}`;
  return `${Math.floor(s / 3600)} h ${deux(Math.floor((s % 3600) / 60))}`;
}

// ── Créer ──────────────────────────────────────────────────────────────────
// articles : [{ id, num?, titre? }] · etapes : [[cle, libellé], …] (celles d'UNE annonce)
export function creer({ sorte, titre, etapes = [], articles = [], uid = '', plafond = null, id } = {}, now = Date.now()) {
  const vus = new Set();
  const arts = (Array.isArray(articles) ? articles : []).filter((a) => a && a.id != null && !vus.has(String(a.id)) && vus.add(String(a.id)))
    .map((a) => ({ id: String(a.id), num: a.num ? String(a.num).slice(0, 16) : '', titre: nettoyer(a.titre || '', 90), etat: 'attente', etape: '', debutAt: 0, finAt: 0, raison: '', lien: '', geste: '' }));
  const s = {
    v: 1, id: id || `t${now}`, sorte: String(sorte || 'travail'), titre: nettoyer(titre || '', 80), uid: String(uid || ''),
    debut: now, majAt: now, finAt: 0, statut: 'cours', demande: null, pause: null, plafond: plafond && typeof plafond === 'object' ? plafond : null,
    etapes: (Array.isArray(etapes) ? etapes : []).filter((e) => Array.isArray(e) && e[0]).map((e) => [String(e[0]), String(e[1] || e[0])]),
    articles: arts, journal: [],
  };
  return noter(s, { texte: `Début : ${arts.length} annonce${arts.length > 1 ? 's' : ''}` }, now);
}

const avecArticle = (s, id, f) => ({ ...s, articles: s.articles.map((a) => (a.id === String(id) ? f(a) : a)) });
const articleDe = (s, id) => s.articles.find((a) => a.id === String(id)) || null;
const qui = (a) => (a ? (a.num ? `N°${a.num}` : (a.titre ? `« ${a.titre.slice(0, 40)} »` : '')) : '');

// Une ligne du journal. ton : info · ok · refus · pause
export function noter(s, { id, texte, ton = 'info' } = {}, now = Date.now()) {
  if (!s) return s;
  const t = nettoyer(texte);
  if (!t) return s;
  const a = id != null ? articleDe(s, id) : null;
  const ligne = { at: now, qui: qui(a), texte: t, ton: ['info', 'ok', 'refus', 'pause'].includes(ton) ? ton : 'info' };
  const j = [...s.journal, ligne];
  return { ...s, majAt: now, journal: j.length > MAX_JOURNAL ? [j[0], ...j.slice(j.length - MAX_JOURNAL + 1)] : j };
}

export function debutArticle(s, id, now = Date.now()) {
  const a = s && articleDe(s, id);
  if (!a || FINIS.has(a.etat)) return s;
  const s2 = avecArticle(s, id, (x) => ({ ...x, etat: 'encours', debutAt: x.debutAt || now }));
  return noter({ ...s2, pause: null }, { id, texte: 'commencée' }, now);
}

// L'étape de l'annonce en cours ; `detail` s'ajoute au libellé (« photos enregistrées (6) »).
// Une étape inconnue de la liste est notée telle quelle (l'extension peut en dire plus).
export function etapeArticle(s, id, cle, now = Date.now(), detail = '') {
  const a = s && articleDe(s, id);
  if (!a || FINIS.has(a.etat) || !cle) return s;
  const k = String(cle);
  const s1 = a.etat === 'encours' ? s : debutArticle(s, id, now);
  if (a.etape === k && !detail) return s1;
  const lib = (s.etapes.find((e) => e[0] === k) || [k, k])[1];
  const s2 = avecArticle(s1, id, (x) => ({ ...x, etape: k }));
  return noter(s2, { id, texte: `${lib}${detail ? ` (${detail})` : ''}` }, now);
}

// La fin d'une annonce : ok (réussie) · main (à finir à la main, avec le lien) ·
// refus (refusée, avec la raison et le geste) · saute (pas envoyée).
export function finArticle(s, id, { etat = 'ok', raison = '', lien = '', geste = '' } = {}, now = Date.now()) {
  const a = s && articleDe(s, id);
  if (!a || FINIS.has(a.etat)) return s;
  const e = FINIS.has(etat) ? etat : 'refus';
  const r = nettoyer(raison, 200);
  const g = nettoyer(geste, 160);
  const l = /^https:\/\/[\w.-]+\//.test(String(lien || '')) ? String(lien).slice(0, 300) : '';
  const s2 = avecArticle(s, id, (x) => ({ ...x, etat: e, finAt: now, debutAt: x.debutAt || now, raison: r, geste: g, lien: l }));
  const mot = { ok: 'réussie', main: 'à finir à la main', refus: 'refusée', saute: 'pas envoyée' }[e];
  return noter(s2, { id, texte: `${mot}${r ? ` : ${r}` : ''}${g ? ` — ${g}` : ''}`, ton: e === 'ok' ? 'ok' : e === 'refus' ? 'refus' : 'info' }, now);
}

// La pause de sécurité (entre deux annonces, ou celle posée par Vinted sur un refus).
export function poserPause(s, { ms, jusqua, raison = 'Pause de sécurité' } = {}, now = Date.now()) {
  if (!s) return s;
  const fin = Number.isFinite(jusqua) ? jusqua : now + Math.max(0, Number(ms) || 0);
  if (!(fin > now)) return { ...s, pause: null };
  const r = nettoyer(raison, 120);
  return noter({ ...s, pause: { jusqua: fin, raison: r } }, { texte: `${r} · ${duree((fin - now) / 1000)}`, ton: 'pause' }, now);
}
export const leverPause = (s) => (s && s.pause ? { ...s, pause: null } : s);

// Ses deux gestes. La demande est LUE par l'écran entre deux étapes.
export function demander(s, quoi, now = Date.now()) {
  if (!s || s.statut !== 'cours') return s;
  if (quoi !== 'pause' && quoi !== 'arret' && quoi !== null) return s;
  const s2 = { ...s, demande: quoi };
  return quoi ? noter(s2, { texte: quoi === 'pause' ? 'Pause demandée : l’étape en cours finit, puis VRM s’arrête' : 'Arrêt demandé : l’étape en cours finit, rien d’autre ne part', ton: 'pause' }, now) : noter(s2, { texte: 'Reprise' }, now);
}
export const doitSArreter = (s) => !!(s && (s.demande === 'pause' || s.demande === 'arret' || s.statut !== 'cours'));

// pause (reprenable) · arrete · fini · interrompu (rechargement, la boucle est morte)
export function terminer(s, statut = 'fini', now = Date.now(), raison = '') {
  if (!s) return s;
  const st = ['pause', 'arrete', 'fini', 'interrompu'].includes(statut) ? statut : 'fini';
  const fin = st === 'pause' ? 0 : now;
  const mot = { pause: 'En pause', arrete: 'Arrêté', fini: 'Terminé', interrompu: 'Interrompu' }[st];
  return noter({ ...s, statut: st, demande: null, pause: null, finAt: fin }, { texte: `${mot}${raison ? ` : ${raison}` : ''}`, ton: st === 'fini' ? 'ok' : 'pause' }, now);
}
export function reprendre(s, now = Date.now()) {
  if (!s || s.statut !== 'pause') return s;
  return noter({ ...s, statut: 'cours', demande: null }, { texte: 'Reprise' }, now);
}

// ── Ce que la feuille affiche ──────────────────────────────────────────────
export function progression(s, now = Date.now()) {
  if (!s) return null;
  const total = s.articles.length;
  const finis = s.articles.filter((a) => FINIS.has(a.etat));
  const nOk = finis.filter((a) => a.etat === 'ok').length;
  const enCours = s.articles.find((a) => a.etat === 'encours') || null;
  const iEtape = enCours && s.etapes.length ? s.etapes.findIndex((e) => e[0] === enCours.etape) : -1;
  const partEnCours = enCours && s.etapes.length ? Math.max(0, iEtape + 0.5) / s.etapes.length : (enCours ? 0.1 : 0);
  const part = total ? Math.min(1, (finis.length + Math.min(0.95, partEnCours)) / total) : 0;
  const fin = s.finAt || now;
  const ecoule = Math.max(0, (fin - s.debut) / 1000);
  const restants = total - finis.length;
  // Rythme réel : temps écoulé (pauses comprises) par article fini.
  const restant = s.statut === 'cours' && finis.length > 0 && restants > 0 ? (ecoule / finis.length) * restants : (restants === 0 ? 0 : null);
  const pause = s.pause && s.pause.jusqua > now ? { raison: s.pause.raison, sec: (s.pause.jusqua - now) / 1000 } : null;
  return {
    total, nFinis: finis.length, nOk, nMain: finis.filter((a) => a.etat === 'main').length, nRefus: finis.filter((a) => a.etat === 'refus' || a.etat === 'saute').length,
    part, enCours, rang: enCours ? s.articles.indexOf(enCours) + 1 : Math.min(total, finis.length + 1),
    iEtape, nEtapes: s.etapes.length, ecoule, restant, pause, restants,
  };
}

export function recap(s) {
  const L = (e) => (s ? s.articles.filter((a) => (Array.isArray(e) ? e.includes(a.etat) : a.etat === e)) : []);
  return { reussies: L('ok'), aLaMain: L('main'), refusees: L(['refus', 'saute']), pasCommencees: L(['attente', 'encours']) };
}

// Le texte copiable (journal entier, une ligne par geste).
export function texteJournal(s) {
  if (!s) return '';
  const tete = `${s.titre} — ${new Date(s.debut).toLocaleString('fr-FR')}`;
  return [tete, ...s.journal.map((l) => [heureJournal(l.at), l.qui, l.texte].filter(Boolean).join(' · '))].join('\n');
}

// ── Reprise après un rechargement ──────────────────────────────────────────
// La boucle de l'écran est morte : un travail « cours » ou « pause » relu au
// démarrage devient « interrompu ». L'article en cours n'est PAS déclaré fait ni
// raté : « à vérifier » — sauf si l'extension (ses `cmds` relus au battement)
// dit elle-même son étape pour cet article (jobs : { [jobId]: { etape, vivant, at, id? } }).
export function repriseApresChargement(s, jobs = null, now = Date.now()) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.articles)) return null;
  if (s.statut === 'fini' || s.statut === 'arrete' || s.statut === 'interrompu') return s;
  let s2 = s;
  const enCours = s.articles.find((a) => a.etat === 'encours');
  const lu = enCours ? repriseDepuisExtension(enCours.id, jobs) : null;
  if (enCours && lu) s2 = noter(s2, { id: enCours.id, texte: `l’extension dit : ${lu.etape}${lu.vivant ? ' (encore en cours chez elle)' : ''}` }, now);
  else if (enCours) s2 = noter(s2, { id: enCours.id, texte: 'en cours au rechargement : regarde l’annonce sur le site avant de relancer' }, now);
  return terminer(s2, 'interrompu', now, 'l’app a été rechargée ou fermée');
}
export function repriseDepuisExtension(id, jobs) {
  if (!jobs || typeof jobs !== 'object' || id == null) return null;
  let best = null;
  for (const [k, j] of Object.entries(jobs)) {
    if (!j || typeof j !== 'object' || !j.etape) continue;
    const vise = String(j.id || j.itemId || j.draftId || '') === String(id) || k.includes(`:${id}`) || k.endsWith(String(id));
    if (!vise) continue;
    if (!best || (Number(j.at) || 0) > (Number(best.at) || 0)) best = j;
  }
  return best ? { etape: String(best.etape).slice(0, 60), vivant: !!best.vivant, at: Number(best.at) || 0 } : null;
}

// Le travail fini, gardé pour « Ce que VRM a fait » (le plus récent d'abord, ≤ 20).
export function archiver(liste, s) {
  const l = Array.isArray(liste) ? liste.filter((x) => x && x.id && x.id !== (s && s.id)) : [];
  if (!s) return l.slice(0, MAX_TRAVAUX);
  const garde = { ...s, journal: s.journal.slice(-300) };
  return [garde, ...l].slice(0, MAX_TRAVAUX);
}

// ── Le magasin (un seul travail à la fois) ─────────────────────────────────
// `suivi.demarrer(...)` rend un pilote ; l'écran appelle ses méthodes ; la
// feuille s'abonne. Gardé sur l'appareil à chaque pas.
const abonnes = new Set();
let courant = null;
const rappels = new Map();   // id du travail → surGeste(quoi) de l'écran (jamais gardé sur l'appareil)
const prevenir = (quoi) => { const f = courant && rappels.get(courant.id); if (typeof f === 'function') { try { f(quoi); } catch (_) {} } };
const stockage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } };
const ecrire = () => {
  const ls = stockage(); if (!ls) return;
  try { if (courant) ls.setItem(CLE_SUIVI, JSON.stringify(courant)); else ls.removeItem(CLE_SUIVI); } catch (_) { /* plein : la feuille vit quand même */ }
};
const annoncer = () => { ecrire(); abonnes.forEach((f) => { try { f(courant); } catch (_) {} }); };
export function lireTravaux() { const ls = stockage(); try { const l = JSON.parse((ls && ls.getItem(CLE_TRAVAUX)) || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } }
const garderFini = (s) => { const ls = stockage(); if (!ls || !s) return; try { ls.setItem(CLE_TRAVAUX, JSON.stringify(archiver(lireTravaux(), s))); } catch (_) {} };

export const suivi = {
  lire: () => courant,
  abonner: (f) => { abonnes.add(f); return () => abonnes.delete(f); },
  // Au démarrage de l'app : relit le travail laissé (rechargement, veille, onglet fermé).
  relire: (jobs = null, now = Date.now()) => {
    if (courant) return courant;
    const ls = stockage(); let s = null;
    try { s = JSON.parse((ls && ls.getItem(CLE_SUIVI)) || 'null'); } catch (_) { s = null; }
    courant = s ? repriseApresChargement(s, jobs, now) : null;
    if (courant && courant !== s && courant.statut === 'interrompu') garderFini(courant);
    annoncer();
    return courant;
  },
  // Un seul travail à la fois : un autre en cours ⇒ null (l'écran ne lance rien).
  demarrer: (o, now = Date.now()) => {
    if (courant && (courant.statut === 'cours' || courant.statut === 'pause')) return null;
    courant = creer(o, now);
    if (o && typeof o.surGeste === 'function') rappels.set(courant.id, o.surGeste);
    annoncer();
    return pilote(courant.id);
  },
  // Ses gestes depuis la feuille.
  demander: (quoi) => { if (!courant || courant.statut !== 'cours') return; courant = demander(courant, quoi); annoncer(); prevenir(quoi); },
  reprendre: () => { if (!courant || courant.statut !== 'pause') return; courant = reprendre(courant); annoncer(); prevenir('reprendre'); },
  // Arrêter un travail EN PAUSE (rien ne tourne) : il se termine tout de suite.
  arreterEnPause: () => { if (!courant || courant.statut !== 'pause') return; courant = terminer(courant, 'arrete', Date.now(), 'arrêté par toi'); annoncer(); prevenir('arret'); },
  // Un écran encore monté qui pilote ce travail ? (sinon, après un rechargement, « Reprendre » n'a personne à qui parler)
  pilote: () => !!(courant && rappels.has(courant.id)),
  // « Fermer » le récapitulatif : le travail part dans « Ce que VRM a fait ».
  fermer: () => {
    if (!courant || courant.statut === 'cours' || courant.statut === 'pause') return false;
    garderFini(courant); rappels.delete(courant.id); courant = null; annoncer(); return true;
  },
  // Pour les bancs.
  _poser: (s) => { courant = s; annoncer(); },
};

function pilote(idT) {
  const ok = () => courant && courant.id === idT;
  const maj = (f) => { if (!ok()) return; courant = f(courant); annoncer(); };
  return {
    id: idT,
    etat: () => (ok() ? courant : null),
    debut: (id) => maj((s) => debutArticle(s, id, Date.now())),
    etape: (id, cle, detail) => maj((s) => etapeArticle(s, id, cle, Date.now(), detail)),
    noter: (texte, id, ton) => maj((s) => noter(s, { id, texte, ton }, Date.now())),
    fin: (id, issue) => maj((s) => finArticle(s, id, issue, Date.now())),
    pause: (o) => maj((s) => poserPause(s, o, Date.now())),
    finPause: () => maj(leverPause),
    plafond: (p) => maj((s) => ({ ...s, plafond: p && typeof p === 'object' ? p : null })),
    // L'écran lit la demande entre deux étapes (jamais au milieu d'une annonce).
    doitSArreter: () => !ok() || doitSArreter(courant),
    demande: () => (ok() ? courant.demande : 'arret'),
    // Fin de la boucle : la demande décide du statut (pause reprenable, arrêt, fini).
    terminer: (raison) => maj((s) => terminer(s, s.demande === 'pause' ? 'pause' : s.demande === 'arret' ? 'arrete' : (s.articles.some((a) => a.etat === 'attente') ? 'arrete' : 'fini'), Date.now(), raison)),
    // Reprise demandée sur la feuille : l'écran l'écoute (onReprendre).
    enPause: () => ok() && courant.statut === 'pause',
  };
}
