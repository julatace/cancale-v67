// ── LE JOURNAL DES PLANTAGES, SANS FOURNISSEUR (4 octobre) ────────────────────
// Quand un écran tombe, l'app affiche « Cet écran n'a pas pu s'afficher — envoie-
// moi cette ligne ». Julien n'est pas développeur : il ne l'envoie pas toujours,
// et une erreur d'un AUTRE vendeur ne nous arriverait jamais. Les écrans morts du
// projet (§4.6 TDZ, Achats « Cannot access before initialization ») ont tous été
// vus par une capture, jamais par un signal.
//
// ⇒ L'app note elle-même ses plantages DANS SA PROPRE BASE (`app_data`,
//   `plantage_{empreinte}`), au nom du vendeur (RLS : chacun les siens). Aucun
//   service tiers (Sentry & co.) : pas un octet de plus ne quitte VRM, et la
//   politique de confidentialité n'a pas à changer.
//
// Ce qui est gardé, et ce qui ne l'est JAMAIS :
//   • le message, les 6 premières lignes de la pile, l'écran, la version de
//     l'app, le navigateur en deux mots ;
//   • JAMAIS une adresse email, un jeton, une suite de chiffres (un n° de
//     transaction, un prix, un téléphone), ni les paramètres d'une adresse.
// Les bornes : une même erreur une fois par heure et par appareil, dix par
// ouverture au plus, et rien qui vienne d'une extension ou du réseau (ce ne sont
// pas des défauts de l'app, ils noieraient les vrais).
const FILE = 'vrm_plantages_attente';
const ENVOYES = 'vrm_plantages_envoyes';
const MAX_ATTENTE = 10;
const UNE_HEURE = 3600e3;
let notesCetteOuverture = 0;

// Ce qui n'est PAS un défaut de l'app.
const BRUIT = /ResizeObserver loop|^Script error\.?$|Failed to fetch|NetworkError|Load failed|AbortError|The (user|operation) aborted|chrome-extension:\/\/|moz-extension:\/\/|safari-(web-)?extension:\/\/|Importing a module script failed|error loading dynamically imported module/i;

export function nettoyer(texte) {
  return String(texte || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '{email}')
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/g, '{jeton}')
    .replace(/\b(Bearer|apikey|token|key)[=: ]+[\w.-]{12,}/gi, '$1 {jeton}')
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, '$1')
    .replace(/\d{5,}/g, '{n}');
}

// Une empreinte courte et stable (FNV-1a) : la même erreur au même endroit
// garde la même ligne, quelle que soit la fois.
export function empreinte(s) {
  let h = 0x811c9dc5;
  const t = String(s || '');
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

const lire = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

// Rend l'entrée notée, ou null si elle est écartée (bruit, déjà notée, plafond).
export function noterPlantage(err, contexte = {}) {
  try {
    const message = nettoyer((err && (err.message || err.reason)) || err).slice(0, 300);
    if (!message || BRUIT.test(message)) return null;
    const pileBrute = String((err && err.stack) || '');
    if (BRUIT.test(pileBrute)) return null;
    const pile = nettoyer(pileBrute.split('\n').slice(0, 7).join('\n')).slice(0, 900);
    // L'empreinte : le message + la PREMIÈRE ligne de pile (l'endroit), sans les
    // numéros de colonne, qui bougent à chaque déploiement.
    const lieu = (pile.split('\n').find((l) => /at |@/.test(l)) || '').replace(/:\d+:(\d+|\{n\})/g, '').replace(/assets\/[\w-]+\.js/, 'assets/app.js');
    const id = empreinte(message + '|' + lieu);
    if (notesCetteOuverture >= MAX_ATTENTE) return null;
    const envoyes = lire(ENVOYES, {});
    const maintenant = Date.now();
    if (envoyes[id] && maintenant - envoyes[id].at < UNE_HEURE) return null;
    notesCetteOuverture++;
    const nAppareil = ((envoyes[id] && envoyes[id].n) || 0) + 1;
    envoyes[id] = { at: maintenant, n: nAppareil };
    // On ne garde que les 50 dernières empreintes : la carte ne grandit pas sans fin.
    const ids = Object.keys(envoyes).sort((a, b) => envoyes[b].at - envoyes[a].at).slice(0, 50);
    ecrire(ENVOYES, Object.fromEntries(ids.map((k) => [k, envoyes[k]])));
    const entree = {
      id, message, pile,
      ecran: String(contexte.ecran || '').slice(0, 40),
      origine: String(contexte.origine || 'page').slice(0, 20),
      version: String(contexte.version || '').slice(0, 40),
      navigateur: (() => { try { const u = navigator.userAgent || ''; return (/iPhone|iPad/.test(u) ? 'iOS ' : /Android/.test(u) ? 'Android ' : /Mac/.test(u) ? 'Mac ' : /Windows/.test(u) ? 'Windows ' : '') + (/Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'autre'); } catch (_) { return ''; } })(),
      at: new Date(maintenant).toISOString(),
      nAppareil,
    };
    const file = lire(FILE, []);
    file.push(entree);
    ecrire(FILE, file.slice(-MAX_ATTENTE));
    try { window.dispatchEvent(new CustomEvent('vrm:plantage')); } catch (_) {}
    return entree;
  } catch (_) { return null; }
}

// Vide la file vers la base. `envoyer(ligne)` rend true quand la base a
// confirmé ; une entrée non confirmée RESTE dans la file (elle repartira à
// l'ouverture suivante) — « pas écrit » ne vaut pas « écrit ».
export async function viderPlantages(envoyer) {
  const file = lire(FILE, []);
  if (!file.length) return 0;
  const restent = [];
  let n = 0;
  for (const e of file) {
    let ok = false;
    try { ok = await envoyer({ id: 'plantage_' + e.id, data: e }); } catch (_) { ok = false; }
    if (ok) n++; else restent.push(e);
  }
  ecrire(FILE, restent);
  return n;
}

// Les deux écoutes globales : une erreur hors React, une promesse rejetée.
export function ecouterPlantages(contexte) {
  try {
    window.addEventListener('error', (ev) => {
      // Une image ou un script qui ne charge pas lève aussi `error` (sans
      // `error`) : ce n'est pas un plantage de l'app.
      if (!ev || !ev.error) return;
      noterPlantage(ev.error, Object.assign({ origine: 'page' }, contexte && contexte()));
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const r = ev && ev.reason;
      if (!r || !(r instanceof Error)) return;   // un rejet sans Error est rarement un défaut, et ne dit rien
      noterPlantage(r, Object.assign({ origine: 'promesse' }, contexte && contexte()));
    });
  } catch (_) {}
}
