// ════════════════════════════════════════════════════════════════════════════
//  UNE LECTURE IDENTIQUE NE PART QU'UNE FOIS (16 octobre, « app plus rapide »)
// ════════════════════════════════════════════════════════════════════════════
//  Mesuré au banc `scripts/bancs/vitesse.cjs` (base inventée au volume de la
//  sienne, aller-retour simulé à 150 ms) : ouvrir Ma journée faisait 72 à 77
//  lectures de NOTRE base, dont 16 à 21 STRICTEMENT IDENTIQUES (même adresse,
//  même session, même page `Range`) — `lbc_ventes` ×5, `ebay_orders` ×5,
//  `vinted_lbc_posted` ×4, `ebay_listings` ×4, la liste des transactions ×2
//  (deux pages chacune)… Ventes, Colis et Messages en faisaient 31 à 45. Chaque
//  écran, chaque passage du centre de notifications relit à sa façon : les
//  corriger un par un, c'était trente endroits et autant de conflits.
//  ⇒ Une seule règle, au niveau de `fetch` : une lecture GET de NOTRE base
//  (`{base}/rest/v1/…`) identique à une lecture EN COURS, ou finie il y a moins
//  de `FENETRE_MS`, reçoit la MÊME réponse (une copie : chaque appelant lit son
//  propre corps). Rien d'autre ne change : mêmes adresses, mêmes réponses.
//
//  ⚠️ CE QUI N'EST JAMAIS PARTAGÉ — et c'est ce qui garde les règles du dossier :
//   · un ÉCHEC (statut ≠ 2xx, réseau coupé) n'est pas gardé une fois revenu :
//     la lecture suivante réessaie. « Pas su » reste « pas su » pour chacun
//     (§4.1 retourné, « rien lu ne vaut pas rien »), jamais figé ;
//   · toute ÉCRITURE vers notre base (POST, PATCH, DELETE…) vide tout, à son
//     départ ET à son retour : une lecture faite après une écriture voit
//     l'écriture ;
//   · un signal de l'extension (`vrm:ext` — « ventes rangées », « bordereau
//     rangé »…) vide tout : l'extension écrit en base sans passer par l'app, et
//     son signal est justement ce qui fait relire ;
//   · une lecture avec `signal` (annulable) ou un `Request` passent tels quels ;
//   · les requêtes à Vinted ne passent JAMAIS par ici (l'app ne les fait pas, et
//     §3 interdit de les regrouper ou paralléliser) : seule l'adresse de notre
//     base est concernée.
//  La clé porte l'adresse ET les en-têtes qui changent la réponse (session,
//  `Range`, `Prefer`, `Accept`) : deux vendeurs, deux pages, deux formes de
//  réponse ne se mélangent jamais.
// ════════════════════════════════════════════════════════════════════════════

export const FENETRE_MS = 2000;
const ENTETES_CLE = ['authorization', 'apikey', 'range', 'range-unit', 'prefer', 'accept', 'accept-profile', 'x-vrm-equipe'];

const lireEntete = (h, nom) => {
  if (!h) return '';
  try {
    if (typeof Headers !== 'undefined' && h instanceof Headers) return h.get(nom) || '';
    if (Array.isArray(h)) { const p = h.find((x) => x && String(x[0]).toLowerCase() === nom); return p ? String(p[1]) : ''; }
    for (const k of Object.keys(h)) if (k.toLowerCase() === nom) return String(h[k]);
  } catch (_) {}
  return '';
};

// `fetchOrig` : la vraie fonction (injectable pour l'audit). Rend la fonction
// qui la remplace, et `invalider`.
export function creerLecturesPartagees(fetchOrig, base, opts = {}) {
  const fenetre = opts.fenetre != null ? opts.fenetre : FENETRE_MS;
  const maintenant = opts.maintenant || (() => Date.now());
  const prefixe = String(base).replace(/\/+$/, '') + '/rest/v1/';
  const cache = new Map();   // clé -> { gen, p, fin }
  let gen = 0;
  const stats = { partagees: 0, parties: 0 };
  const invalider = () => { gen++; cache.clear(); };
  const f = function (input, init) {
    // Seules les adresses en chaîne (ou URL) sont regardées ; un `Request`
    // passe tel quel (ses en-têtes et son corps vivent dans l'objet).
    const url = typeof input === 'string' ? input : (typeof URL !== 'undefined' && input instanceof URL ? input.href : null);
    if (url == null || url.indexOf(prefixe) !== 0) return fetchOrig(input, init);
    const methode = String((init && init.method) || 'GET').toUpperCase();
    if (methode !== 'GET') {
      if (methode === 'HEAD') return fetchOrig(input, init);
      invalider();
      const p = fetchOrig(input, init);
      Promise.resolve(p).then(invalider, invalider);
      return p;
    }
    if (init && (init.signal || init.body != null || (init.cache && init.cache !== 'default'))) return fetchOrig(input, init);
    const h = init && init.headers;
    const cle = url + '\n' + ENTETES_CLE.map((n) => lireEntete(h, n)).join('\n');
    const e = cache.get(cle);
    if (e && e.gen === gen && (e.fin == null || maintenant() - e.fin < fenetre)) {
      stats.partagees++;
      return e.p.then((r) => r.clone());
    }
    const monGen = gen;
    const p = Promise.resolve(fetchOrig(input, init));
    const ent = { gen: monGen, p, fin: null };
    cache.set(cle, ent);
    stats.parties++;
    p.then((r) => {
      if (cache.get(cle) !== ent) return;
      // Un échec n'est JAMAIS gardé : la lecture suivante réessaie.
      if (!r || !r.ok || monGen !== gen) { cache.delete(cle); return; }
      ent.fin = maintenant();
      setTimeout(() => { if (cache.get(cle) === ent) cache.delete(cle); }, fenetre + 50);
    }, () => { if (cache.get(cle) === ent) cache.delete(cle); });
    return p.then((r) => r.clone());
  };
  return { fetch: f, invalider, stats };
}

// Installe la règle sur `window.fetch`, une fois.
export function installerLecturesPartagees(base) {
  try {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null;
    if (window.__vrmLecturesPartagees) return window.__vrmLecturesPartagees;
    const lp = creerLecturesPartagees(window.fetch.bind(window), base);
    window.fetch = lp.fetch;
    window.addEventListener('vrm:ext', lp.invalider);
    window.__vrmLecturesPartagees = lp;
    return lp;
  } catch (_) { return null; }
}
