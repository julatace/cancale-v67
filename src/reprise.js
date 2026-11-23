// ── REPRENDRE SUR UN APPAREIL CE QU'ON REGARDAIT SUR L'AUTRE (22 nov., choix n° 23 de Julien) ──────────────────────────
// « Reprendre sur l'ordi ce que tu regardais sur l'iPhone (et inversement). »
//
// LA LIGNE `vrm_reprise` (à SON nom, comparer-et-échanger sur `data.rev`, src/ligneCas.js) :
//   { v: 1, rev, d: { [appareil]: { e, t, id, at, f } } }
//     appareil  un identifiant TIRÉ AU HASARD sur cet appareil (localStorage `reprise_appareil`, jamais synchronisé) :
//               il ne dit rien de l'appareil, il sert seulement à reconnaître « le même » ;
//     e         l'écran où l'élément a été ouvert (un nom d'onglet : `journee`, `annonces`…) ;
//     t         la sorte d'élément : 'fiche' (la fiche d'une paire, par son N° — l'objet central, CLAUDE.md §2.11) ;
//     id        l'identifiant de l'élément (le N°, en `cleNum` : lettres et chiffres) ;
//     at        l'heure d'ouverture (ms) ;
//     f         la forme de l'appareil : 'iphone' · 'ipad' · 'telephone' · 'ordinateur' (pour « ouvert sur l'iPhone »).
// RIEN D'AUTRE n'y entre : ni titre, ni prix, ni photo, ni compte, ni acheteur (`entreeReprise` est une liste blanche).
// L'autre appareil retrouve le titre dans SES données, par le N° (identité, jamais par ressemblance).
//
// L'AUTRE APPAREIL (`aReprendre`) montre la plus récente entrée d'un AUTRE appareil, ouverte il y a 30 min au plus
// (`DUREE_REPRISE_MS`), pas masquée, pas déjà ouverte ici. Rien si c'est le même appareil.
// Module PUR (hors `lire`/`publier`, injectables) : scripts/audit-reprise.cjs l'exécute.

export const LIGNE_REPRISE = 'vrm_reprise';
export const CLE_APPAREIL = 'reprise_appareil';
export const CLE_MASQUEE = 'reprise_masquee';
export const DUREE_REPRISE_MS = 30 * 60000;
export const GARDE_MS = 24 * 3600000;        // une entrée de plus d'un jour est retirée à la prochaine écriture
export const MAX_APPAREILS = 8;
export const SORTES = Object.freeze(['fiche']);
export const FORMES = Object.freeze(['iphone', 'ipad', 'telephone', 'ordinateur']);

const RE_APPAREIL = /^[a-z0-9]{8,24}$/;
const RE_ECRAN = /^[a-z][a-z0-9_]{0,31}$/;
const RE_ID = /^[A-Za-z0-9]{1,24}$/;
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

// La forme d'un appareil, d'après ce que le navigateur dit de lui (jamais envoyé tel quel : seulement le mot).
export function formeAppareil(ua = '', toucher = 0) {
  const u = String(ua || '');
  if (/iPhone|iPod/.test(u)) return 'iphone';
  if (/iPad/.test(u) || (/Macintosh/.test(u) && Number(toucher) > 1)) return 'ipad';
  if (/Android/.test(u) && /Mobile/.test(u)) return 'telephone';
  if (/Android/.test(u)) return 'ipad';   // une tablette Android : « la tablette » à l'écran
  return 'ordinateur';
}

// UNE entrée propre (liste blanche) — `null` si un champ manque ou n'a pas la forme attendue.
export function entreeReprise(x) {
  const o = objet(x); if (!o) return null;
  const e = String(o.e == null ? '' : o.e), t = String(o.t == null ? '' : o.t), id = String(o.id == null ? '' : o.id).trim();
  const at = Number(o.at), f = String(o.f == null ? '' : o.f);
  if (!RE_ECRAN.test(e) || !SORTES.includes(t) || !RE_ID.test(id) || !Number.isSafeInteger(at) || at <= 0 || !FORMES.includes(f)) return null;
  return { e, t, id, at, f };
}

// La donnée à écrire quand CET appareil ouvre un élément. Rend la nouvelle donnée, ou `undefined` (rien à écrire :
// entrée illisible, appareil illisible, ou le même élément déjà publié il y a moins de 10 min).
export function noterOuvert(data, appareil, entree, maintenant = Date.now()) {
  const app = String(appareil || '');
  const x = entreeReprise(entree);
  if (!RE_APPAREIL.test(app) || !x) return undefined;
  const avant = objet(data) && objet(data.d) ? data.d : {};
  const prec = entreeReprise(avant[app]);
  if (prec && prec.t === x.t && prec.id === x.id && x.at - prec.at < 10 * 60000 && x.at >= prec.at) return undefined;
  const d = {};
  for (const [k, v] of Object.entries(avant)) {
    if (!RE_APPAREIL.test(k) || k === app) continue;
    const y = entreeReprise(v);
    if (y && maintenant - y.at <= GARDE_MS) d[k] = y;
  }
  d[app] = x;
  const cles = Object.keys(d).sort((a, b) => d[b].at - d[a].at).slice(0, MAX_APPAREILS);
  const out = {}; for (const k of cles) out[k] = d[k];
  return { v: 1, d: out };
}

// Ce que CET appareil propose de reprendre : { appareil, e, t, id, at, f } ou null.
// `masquee` : la clé (`appareil|at`) qu'il a masquée ; `ouvertIci` : l'identifiant de l'élément ouvert ici en ce moment.
export function aReprendre(data, appareil, { maintenant = Date.now(), masquee = '', ouvertIci = '' } = {}) {
  const d = objet(data) && objet(data.d) ? data.d : null;
  if (!d) return null;
  const moi = String(appareil || '');
  let mieux = null;
  for (const [k, v] of Object.entries(d)) {
    if (!RE_APPAREIL.test(k) || k === moi) continue;
    const x = entreeReprise(v);
    if (!x) continue;
    const age = maintenant - x.at;
    if (age < -60000 || age > DUREE_REPRISE_MS) continue;
    if (masquee && masquee === k + '|' + x.at) continue;
    if (ouvertIci && String(ouvertIci) === x.id) continue;
    if (!mieux || x.at > mieux.at) mieux = { appareil: k, ...x };
  }
  return mieux;
}
export const cleMasquee = (r) => (r ? r.appareil + '|' + r.at : '');
