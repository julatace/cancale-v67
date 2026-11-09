// ════════════════════════════════════════════════════════════════════════════
//  MA JOURNÉE TOUT DE SUITE — L'INSTANTANÉ (9 nov., Julien : « vas-y, fais
//  absolument tout » ; décision attendue n°1 de la passation générale du 9 nov.)
//
//  Aujourd'hui Ma journée attend la relecture complète (≈ 8 s au téléphone).
//  L'instantané, ce sont les DERNIERS chiffres que Ma journée a RENDUS sur CET
//  appareil pour CE compte VRM : relus dans l'écran une fois toutes ses données
//  là (jamais pendant une lecture, jamais au plafond), rangés ici, et montrés à
//  la place du squelette à l'ouverture suivante, avec « il y a N min ». Quand la
//  relecture finit, l'écran vrai prend la place (src/AttenteEcran.jsx).
//
//  Règles (intouchables) :
//    · AUCUN calcul ici : ce qui est rangé est le TEXTE et les `data-*` que
//      l'écran vrai a rendus (§11, une seule règle par notion) — « — » reste
//      « — » (pas su ≠ 0), « au moins » reste « au moins ».
//    · Un chiffre de l'instantané est MONTRÉ comme ancien (« il y a 2 h ») ;
//      un autre jour ⇒ ni la phrase du jour ni le panneau du jour choisi ;
//      un autre mois ⇒ ni les cases du mois ni l'objectif ; plus de 3 jours ⇒ rien.
//    · Par COMPTE VRM : l'uid est dans la clé ET dans la valeur ; un instantané
//      d'un autre uid n'est jamais rendu. La clé commence par `vrm_` : la
//      déconnexion et le changement de vendeur l'effacent (`wipeLocalData`).
//      Jamais synchronisée (écrite par `localStorage.setItem`, hors de `save`).
//    · Rien de personnel : montants, compteurs, dates, libellés de VRM. Ni
//      photo, ni adresse, ni acheteur ; la prochaine chose ne garde que son
//      titre (la sous-ligne seulement pour une case de comptage de VRM).
//    · Inerte : aucun geste ne part d'un instantané (src/JourneeInstantanee.jsx).
// Exécuté par scripts/bancs/journee-instantanee.cjs et scripts/tests/journee-instantanee.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

export const VERSION_INSTANTANE = 1;
export const PREFIXE_INSTANTANE = 'vrm_journee_instantane:';
export const AGE_MAX_INSTANTANE_MS = 3 * 86400000;
const TXT_MAX = 90;

export const cleInstantane = (uid) => PREFIXE_INSTANTANE + String(uid || '');

const jourIso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const jourLocalIso = jourIso;
const moisIso = (t) => jourIso(t).slice(0, 7);

const propre = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, TXT_MAX);
const attr = (el, n) => (el && el.hasAttribute(n) ? el.getAttribute(n) : null);
const txt = (el) => (el ? propre(el.textContent) : '');
// Une valeur encore en lecture n'est jamais rangée (elle se figerait en « lecture… »).
const enLecture = (s) => /lecture/i.test(String(s || ''));

// « il y a 4 min » — l'âge d'un instantané, toujours dit.
export const ageTexte = (ms) => {
  const m = Math.max(0, Math.floor((Number(ms) || 0) / 60000));
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
};

// ── LA CAPTURE : relue dans l'écran VRAI (Ma journée), toutes ses données là ──
// `racine` = l'élément `.vrm-fu-journee` rendu. Rend l'instantané, ou null (rien à ranger).
// Une valeur encore « lecture… » quelque part ⇒ null : rien n'est rangé (la prochaine relecture rangera).
export function capturerJournee(racine, { uid, maintenant = Date.now(), largeur = 0 } = {}) {
  if (!racine || !uid) return null;
  const tete = racine.querySelector('.vrm-fu-tete');
  if (!tete) return null;
  if (enLecture(tete.textContent)) return null;
  const snap = { v: VERSION_INSTANTANE, uid: String(uid), t: maintenant, jour: jourIso(maintenant), mois: moisIso(maintenant), largeur: Math.round(largeur || 0) };
  // Le prénom : SON prénom (vrm_prenom), celui qui suit le bonjour.
  const bj = txt(tete.querySelector('.vrm-fu-bonjour'));
  snap.prenom = propre(bj.replace(/^(Bonjour|Bon après-midi|Bonsoir)\s*/, '')).slice(0, 24);
  // La phrase du jour (des compteurs mis en mots par src/phraseJour.js).
  const ph = tete.querySelector('[data-phrase-jour]');
  snap.phrase = ph ? { texte: propre(attr(ph, 'data-phrase-jour')), env: attr(ph, 'data-phrase-jour-env') || '', ret: attr(ph, 'data-phrase-jour-ret') || '' } : null;
  // La prochaine chose : son titre et son geste ; la sous-ligne seulement pour une case de VRM (compteurs).
  const pr = tete.querySelector('[data-prochain]');
  if (pr) {
    const tuile = attr(pr, 'data-tuile');
    const titre = txt(pr.querySelector('.vrm-day-task-title'));
    const note = tuile ? txt(pr.querySelector('.vrm-day-task-note')) : '';
    snap.prochain = titre && !enLecture(titre) ? {
      tuile: tuile || '', job: tuile ? '' : propre(attr(pr, 'data-job') || ''), n: attr(pr, 'data-n') || '', titre,
      note: enLecture(note) ? '' : note, action: txt(pr.querySelector('.vrm-day-task-action-mot')) || 'Voir',
      principal: !!pr.querySelector('.vrm-day-task-action.is-principal'), urgent: pr.classList.contains('is-urgent'),
    } : null;
  } else snap.prochain = tete.querySelector('[data-jv2-prochain-attente]') ? undefined : null;
  // La frise des sept jours : le nombre de ventes et le vendu de chaque jour (`data-*` rendus).
  const ar = tete.querySelector('[data-jv2-argent]');
  if (ar) {
    const jours = [...ar.querySelectorAll('[data-fu-semaine] > li[data-jv2-jour]')].map((li) => {
      const n = attr(li, 'data-vendu'); const b = li.querySelector('[data-barre]');
      const nN = n != null && /^\d+$/.test(n) ? Number(n) : null;
      return { iso: attr(li, 'data-jv2-jour'), n: nN, v: b ? Number(attr(b, 'data-barre')) : (nN === 0 ? 0 : null) };
    }).filter((j) => /^\d{4}-\d{2}-\d{2}$/.test(String(j.iso || '')));
    // Le panneau du jour choisi : seulement s'il est celui que l'écran choisit de lui-même (pas un jour
    // touché) ; sinon l'instantané montrera le dernier jour vendu de la frise.
    const auto = attr(ar, 'data-jv2-choix') !== 'main';
    let panneau = null;
    const pn = ar.querySelector('[data-jv2-panneau]');
    if (pn && auto) {
      const g = pn.querySelector('[data-jv2-vendu]');
      const faits = [...pn.querySelectorAll('.vrm-jv2-faits > span')].map((s) => txt(s)).filter(Boolean);
      const sem = pn.querySelector('[data-jv2-semaine]');
      if (g && !faits.some(enLecture)) panneau = {
        periode: attr(ar, 'data-jv2-periode') || '', nom: txt(pn.querySelector('[data-jv2-nom]')),
        semaine: sem ? txt(sem) : '', vendu: attr(g, 'data-jv2-vendu') || '', grand: txt(g), partiel: attr(g, 'data-partiel') === '1', faits,
      };
    }
    snap.frise = jours.length === 7 ? { jours, panneau } : null;
  } else snap.frise = null;
  // Les cases du mois de la carte (son choix, « Modifier ») : le texte rendu et la valeur des `data-*`.
  const carte = tete.querySelector('[data-carte-stats="journee"]');
  const cases = carte ? [...carte.querySelectorAll('[data-fu-case]')].map((c) => {
    const b = c.querySelector('b');
    const raison = txt(c.querySelector('small'));
    return { cle: attr(c, 'data-fu-case') || '', valeur: attr(c, 'data-carte-valeur') || '', partiel: attr(c, 'data-carte-partiel') === '1', b: txt(b), vide: !!(b && b.classList.contains('is-vide')), l: txt(c.querySelector(':scope > span')), raison };
  }) : [];
  snap.cases = cases.length && !cases.some((c) => enLecture(c.b) || enLecture(c.raison)) ? cases : null;
  // L'objectif du mois (src/objectifMois.js) : les nombres de SA barre (la valeur = la case « Vendu · mois »).
  const ob = carte && carte.querySelector('[data-objectif]');
  snap.objectif = ob ? {
    type: attr(ob, 'data-objectif'), cible: attr(ob, 'data-objectif-cible') || '', valeur: attr(ob, 'data-objectif-valeur') || '',
    pct: attr(ob, 'data-objectif-pct') || '', partiel: attr(ob, 'data-objectif-partiel') === '1', atteint: attr(ob, 'data-objectif-atteint') === '1',
  } : null;
  // « Ensuite · N gestes » : le nombre seulement (la liste arrive avec l'écran vrai).
  const g = racine.querySelector('[data-fu-gestes]');
  snap.gestes = g && /^\d+$/.test(attr(g, 'data-fu-gestes') || '') ? Number(attr(g, 'data-fu-gestes')) : null;
  snap.hauteur = Math.round(tete.getBoundingClientRect ? tete.getBoundingClientRect().height : 0) || 0;
  // Rien d'utile (aucun chiffre) : rien n'est rangé.
  if (!snap.cases && !snap.frise && !snap.prochain) return null;
  return snap;
}

// ── LECTURE ─────────────────────────────────────────────────────────────────
const stockage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } };

// L'instantané brut de CE compte, ou null. Jamais celui d'un autre uid.
export function lireInstantane(uid, { maintenant = Date.now(), ls = stockage() } = {}) {
  if (!uid || !ls) return null;
  let s = null;
  try { s = JSON.parse(ls.getItem(cleInstantane(uid)) || 'null'); } catch (_) { return null; }
  if (!s || typeof s !== 'object' || s.v !== VERSION_INSTANTANE) return null;
  if (String(s.uid || '') !== String(uid)) return null;
  const t = Number(s.t);
  if (!Number.isFinite(t) || t > maintenant + 60000 || maintenant - t > AGE_MAX_INSTANTANE_MS) return null;
  return s;
}

// Ce qui se MONTRE aujourd'hui d'un instantané (un autre jour, un autre mois : moins).
export function instantaneMontrable(s, maintenant = Date.now()) {
  if (!s) return null;
  const memeJour = s.jour === jourIso(maintenant);
  const memeMois = s.mois === moisIso(maintenant);
  const out = {
    t: s.t, age: Math.max(0, maintenant - s.t), memeJour, memeMois, prenom: s.prenom || '',
    phrase: memeJour ? s.phrase || null : null,
    prochain: s.prochain || null,
    gestes: s.gestes,
    cases: memeMois ? s.cases || null : null,
    objectif: memeMois ? s.objectif || null : null,
    frise: null, hauteur: s.hauteur || 0, largeur: s.largeur || 0,
  };
  if (s.frise && Array.isArray(s.frise.jours)) {
    // Les sept jours d'AUJOURD'HUI : un jour connu garde son chiffre, aujourd'hui (pas encore relu) n'en a pas.
    const par = new Map(s.frise.jours.map((j) => [j.iso, j]));
    const minuit = new Date(maintenant); minuit.setHours(0, 0, 0, 0);
    const jours = [6, 5, 4, 3, 2, 1, 0].map((k) => { const d = new Date(minuit); d.setDate(d.getDate() - k); const iso = jourIso(d.getTime()); const j = par.get(iso); return { k, d, iso, n: j ? j.n : null, v: j ? j.v : null }; });
    out.frise = { jours, panneau: memeJour ? s.frise.panneau || null : null };
  }
  return out;
}

// ── ÉCRITURE / EFFACEMENT ──────────────────────────────────────────────────
export function ecrireInstantane(snap, { ls = stockage() } = {}) {
  if (!snap || !snap.uid || !ls) return false;
  try {
    // Un seul instantané sur l'appareil : celui d'un autre compte part (la déconnexion l'efface aussi).
    for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && k.startsWith(PREFIXE_INSTANTANE) && k !== cleInstantane(snap.uid)) ls.removeItem(k); }
    ls.setItem(cleInstantane(snap.uid), JSON.stringify(snap));
    return true;
  } catch (_) { return false; }
}
export function effacerInstantanes({ ls = stockage() } = {}) {
  if (!ls) return;
  try { for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && k.startsWith(PREFIXE_INSTANTANE)) ls.removeItem(k); } } catch (_) {}
}
