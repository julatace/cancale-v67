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
//   · une lecture avec `signal` (annulable) ou un `Request` passe telle quelle ;
//     une ÉCRITURE Request invalide quand même les lectures, sans lire son corps ;
//   · une lecture EN COURS ne se partage que `VOL_MAX_MS` (22 oct., revue) :
//     une requête perdue (réseau qui change, iPhone qui se réveille) ne répond
//     jamais, et elle captait toutes les lectures identiques jusqu'à une
//     écriture — « ↻ Actualiser » sur l'écran Leboncoin ne relançait plus
//     rien. Passé ce délai, la lecture suivante repart sur le réseau ;
//   · les requêtes à Vinted ne passent JAMAIS par ici (l'app ne les fait pas, et
//     §3 interdit de les regrouper ou paralléliser) : seule l'adresse de notre
//     base est concernée.
//  La clé porte l'adresse ET les en-têtes qui changent la réponse (session,
//  `Range`, `Prefer`, `Accept`) : deux vendeurs, deux pages, deux formes de
//  réponse ne se mélangent jamais.
// ════════════════════════════════════════════════════════════════════════════

export const FENETRE_MS = 2000;
// Plus court que l'attente de `lireReceptionLeboncoin` (12 s) : un « Actualiser »
// fait après une lecture pendue part sur le réseau au lieu de la rejoindre.
export const VOL_MAX_MS = 8000;
export const MAX_ENTREES = 256;
// (31 oct., banc vitesse) Un passage de FOND — la cloche, l'agent eBay — n'est
// pas un geste : il recalcule ce qu'il y a à faire, une réponse de quelques
// secondes lui va aussi bien qu'une neuve. Il le DÉCLARE (`vrmFond: true`) et
// reçoit alors une réponse réussie de moins de `FENETRE_FOND_MS` — jamais
// d'avant une écriture de la ligne ni d'avant un signal de l'extension, qui
// vident le partage comme pour tout le monde. Mesuré au téléphone (processeur
// ×4) : la cloche arrivait 2 à 4 s après Ma journée et relisait `lbc_ventes`,
// `vinted_lbc_posted`, `ebay_orders`, `ebay_listings`, `ebay_programmees`. Une
// lecture sans le drapeau (un écran, « ↻ Actualiser ») garde la fenêtre courte.
export const FENETRE_FOND_MS = 15000;
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

// ── QUELLES LIGNES UNE ÉCRITURE TOUCHE-T-ELLE ? (31 oct.) ───────────────────
// `chemin` : ce qui suit `/rest/v1/`. Rend la liste des `id` écrits dans
// `app_data`, ou `null` quand on ne sait pas le dire (autre table, `rpc/`,
// filtre `like`, corps illisible, aucun id, la ligne `main`) ⇒ tout est vidé.
const PAS_PRECIS = new Set(['main']);
function filtresId(requete) {
  const out = [];
  for (const morceau of String(requete || '').split('&')) {
    const i = morceau.indexOf('=');
    if (i < 0) continue;
    let k, v;
    try { k = decodeURIComponent(morceau.slice(0, i)); v = decodeURIComponent(morceau.slice(i + 1)); } catch (_) { return null; }
    if (k === 'or' || k === 'and' || k === 'not.or' || k === 'not.and') return null;
    if (k === 'id') out.push(v);
  }
  return out;
}
export function idsEcrits(chemin, methode, corps) {
  const c = String(chemin || '');
  const q = c.indexOf('?');
  const table = q < 0 ? c : c.slice(0, q);
  if (table !== 'app_data') return null;
  let ids = [];
  if (methode === 'POST') {
    if (typeof corps !== 'string') return null;
    let j; try { j = JSON.parse(corps); } catch (_) { return null; }
    const lignes = Array.isArray(j) ? j : [j];
    for (const l of lignes) { if (!l || typeof l !== 'object' || typeof l.id !== 'string' || !l.id) return null; ids.push(l.id); }
  } else if (methode === 'PATCH' || methode === 'DELETE') {
    const f = filtresId(q < 0 ? '' : c.slice(q + 1));
    if (!f || f.length !== 1) return null;
    const v = f[0];
    if (v.startsWith('eq.')) ids = [v.slice(3)];
    else if (/^in\.\(.*\)$/.test(v)) ids = v.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, ''));
    else return null;
  } else return null;
  if (!ids.length || ids.some((x) => !x || PAS_PRECIS.has(x))) return null;
  return ids;
}
// Une lecture `GET {chemin}` peut-elle porter l'une de ces lignes ? Dans le
// doute : oui (elle est retirée du partage).
export function lecturePeutPorter(chemin, ids) {
  const c = String(chemin || '');
  const q = c.indexOf('?');
  const table = q < 0 ? c : c.slice(0, q);
  if (table !== 'app_data') return table.startsWith('rpc/');
  const f = filtresId(q < 0 ? '' : c.slice(q + 1));
  if (!f || !f.length) return true;
  return f.every((v) => {
    if (v.startsWith('eq.')) return ids.includes(v.slice(3));
    if (/^in\.\(.*\)$/.test(v)) { const l = v.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, '')); return ids.some((x) => l.includes(x)); }
    if (v.startsWith('like.')) {
      const motif = v.slice(5);
      const re = new RegExp('^' + motif.split('').map((ch) => (ch === '*' || ch === '%') ? '.*' : ch === '_' ? '.' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$');
      return ids.some((x) => re.test(x));
    }
    return true;
  });
}

// `fetchOrig` : la vraie fonction (injectable pour l'audit). Rend la fonction
// qui la remplace, et `invalider`.
export function creerLecturesPartagees(fetchOrig, base, opts = {}) {
  const fenetre = opts.fenetre != null ? opts.fenetre : FENETRE_MS;
  const fenetreFond = Math.max(fenetre, opts.fenetreFond != null ? opts.fenetreFond : FENETRE_FOND_MS);
  const volMax = opts.volMax != null ? opts.volMax : VOL_MAX_MS;
  const maxEntrees = Number.isInteger(opts.maxEntrees) && opts.maxEntrees > 0 ? Math.min(opts.maxEntrees, MAX_ENTREES) : MAX_ENTREES;
  const maintenant = opts.maintenant || (() => Date.now());
  const prefixe = String(base).replace(/\/+$/, '') + '/rest/v1/';
  const cache = new Map();   // clé -> { gen, p, debut, fin }
  let gen = 0;
  const stats = { partagees: 0, parties: 0, get retenues() { return cache.size; } };
  const invalider = () => { gen++; cache.clear(); };
  // Ne retire que les lectures qui peuvent porter l'une de ces lignes (une
  // lecture EN COURS retirée n'est plus resservie : `cache.get(cle) !== ent`).
  const invaliderLignes = (ids) => { for (const k of [...cache.keys()]) if (lecturePeutPorter(k.slice(0, k.indexOf('\n')).slice(prefixe.length), ids)) cache.delete(k); };
  const origine = opts.origine != null ? opts.origine : (typeof location !== 'undefined' && location.origin ? location.origin : '');
  const estRouteApp = (u) => u.indexOf('/api/') === 0 || (!!origine && u.indexOf(origine + '/api/') === 0);
  const f = function (input, init) {
    // Seules les adresses en chaîne (ou URL) sont regardées ; un `Request`
    // passe tel quel (ses en-têtes et son corps vivent dans l'objet).
    const requete = typeof Request !== 'undefined' && input instanceof Request;
    const url = requete ? input.url : typeof input === 'string' ? input : (typeof URL !== 'undefined' && input instanceof URL ? input.href : null);
    const methode = String((init && init.method) || (requete ? input.method : 'GET')).toUpperCase();
    // ⚠️ NOS ROUTES SERVEUR ÉCRIVENT AUSSI EN BASE (16 octobre, banc revendeurs) :
    //    `POST /api/ebay` (« Lire davantage de commandes », synchro, règle d'offre…)
    //    range la ligne `ebay_orders` côté serveur, puis l'écran la relit — dans
    //    les 2 s, la lecture partagée rendait la ligne d'AVANT (`complet:false`),
    //    et « Lire davantage » restait affiché sous « Lecture terminée ». Un appel
    //    qui n'est pas une lecture vers `/api/` de l'app vaut une écriture : il
    //    vide tout, à son départ et à son retour.
    const versBase = url != null && url.indexOf(prefixe) === 0;
    const versRoute = url != null && methode !== 'GET' && methode !== 'HEAD' && estRouteApp(url);
    if (!versBase && !versRoute) return fetchOrig(input, init);
    if (methode !== 'GET') {
      if (methode === 'HEAD') return fetchOrig(input, init);
      // (31 oct., banc vitesse) UNE seule exception, DÉCLARÉE par l'appelant et
      // limitée aux routes de l'app : `vrmInvalideSiChange: true` dit « ce
      // passage n'écrit que ses propres lignes, et c'est MOI qui vide les
      // lectures quand il rend un changement » (`relireTransporteursSiVieux`,
      // lignes `transp_*`). Depuis ea0b573 un `Request` ne suffisait plus à le
      // dire : le passage du démarrage refaisait toutes les lectures en vol
      // (+8 lectures par écran, les ventes au 3ᵉ aller-retour). Une écriture
      // vers la BASE vide toujours, drapeau ou pas.
      if (versRoute && init && init.vrmInvalideSiChange === true) return fetchOrig(input, init);
      // (31 oct., banc vitesse) Une écriture de LIGNES NOMMÉES de `app_data`
      // (upsert dont le corps porte les `id`, ou PATCH/DELETE `id=eq.`/`in.`)
      // ne vide que les lectures qui peuvent porter ces lignes — elle seule.
      // Mesuré : la publication de `widget_stats` et de `lbc_a_retirer` au
      // démarrage vidait TOUT, et `lbc_ventes`, `ebay_orders`, `ebay_listings`…
      // repartaient sur le réseau une seconde plus tard. Aucun déclencheur de la
      // base n'écrit une AUTRE ligne (004 : `meta` de la même ligne ; 013/017 :
      // des gardes qui refusent). Tout ce qui n'est pas sûr vide tout, comme avant.
      const ids = versBase && !requete ? idsEcrits(url.slice(prefixe.length), methode, init && init.body) : null;
      const vider = ids ? () => invaliderLignes(ids) : invalider;
      vider();
      const p = fetchOrig(input, init);
      Promise.resolve(p).then(vider, vider);
      return p;
    }
    if (requete || init && (init.signal || init.body != null || (init.cache && init.cache !== 'default'))) return fetchOrig(input, init);
    // Une requête pendue ne doit pas retenir sa réponse et ses en-têtes à vie.
    const date = maintenant();
    for (const [k, v] of cache)
      if (v.fin == null ? date - v.debut >= volMax : date - v.fin >= fenetreFond) cache.delete(k);
    const h = init && init.headers;
    const cle = url + '\n' + ENTETES_CLE.map((n) => lireEntete(h, n)).join('\n');
    const e = cache.get(cle);
    const accepte = init && init.vrmFond === true ? fenetreFond : fenetre;
    if (e && e.gen === gen && (e.fin == null ? maintenant() - e.debut < volMax : maintenant() - e.fin < accepte)) {
      stats.partagees++;
      return e.p.then((r) => r.clone());
    }
    const monGen = gen;
    const p = Promise.resolve(fetchOrig(input, init));
    const ent = { gen: monGen, p, debut: maintenant(), fin: null };
    cache.delete(cle);
    while (cache.size >= maxEntrees) cache.delete(cache.keys().next().value);
    cache.set(cle, ent);
    stats.parties++;
    p.then((r) => {
      if (cache.get(cle) !== ent) return;
      // Un échec n'est JAMAIS gardé : la lecture suivante réessaie.
      if (!r || !r.ok || monGen !== gen) { cache.delete(cle); return; }
      ent.fin = maintenant();
      setTimeout(() => { if (cache.get(cle) === ent) cache.delete(cle); }, fenetreFond + 50);
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
    // Une étape de recréation (`maj · repub`, la barre de progression) ne change
    // aucune donnée lue : elle ne vide pas le partage.
    window.addEventListener('vrm:ext', (e) => { const d = e && e.detail; if (d && d.type === 'maj' && d.quoi === 'repub') return; lp.invalider(); });
    window.__vrmLecturesPartagees = lp;
    return lp;
  } catch (_) { return null; }
}
