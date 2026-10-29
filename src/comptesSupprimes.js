// ═════════════════════════════════════════════════════════════════════════
//  UN COMPTE SUPPRIMÉ POUR DE BON N'APPARAÎT PLUS NULLE PART (29 octobre)
// ═════════════════════════════════════════════════════════════════════════
//  Julien, à propos de shop_cancale (compte bloqué par Vinted, supprimé de VRM
//  « pour de bon », liste `vrm_blocked_accounts`) : « retire tout de ce
//  compte » — annonces, ventes, achats, messages, porte-monnaie, compta. C'est
//  SA décision (on lui a dit que ses ventes sortaient alors de son CA déclaré).
//
//  Les écrans lisent les comptes LIÉS (la ligne de `vinted_accounts` de ce
//  compte est effacée à chaque chargement), mais une vingtaine de lectures
//  balaient une famille entière (`id=like.harvest_*_…`) et ramassaient aussi
//  ses lignes : le Stock, la recherche, le porte-monnaie, les profils…
//  ⇒ UNE règle, posée sur `fetch` : toute ligne `harvest_{uid}_…` dont le
//  compte est supprimé pour de bon est retirée de la réponse, quel que soit
//  l'écran qui lit. Rien n'est effacé en base : si le compte est un jour
//  réautorisé, tout revient.
//
//  ⚠️ Une lecture PAGINÉE (en-tête `Range`) n'est pas filtrée ici : sa fin se
//     juge sur la taille de la page, et une page raccourcie arrêterait la
//     pagination trop tôt. `lireTout` filtre lui-même après avoir tout lu
//     (`sansComptesSupprimes`).
//  ⚠️ « Pas su » ne cache rien : liste illisible ou vide ⇒ rien n'est retiré.
//  ⚠️ Les écritures (POST, PATCH, DELETE) passent telles quelles, et une lecture
//     marquée `vrmVoirSupprimes` aussi : la purge doit voir ce qu'elle vide.
// ═════════════════════════════════════════════════════════════════════════

export const CLE_SUPPRIMES = 'vrm_comptes_supprimes';

// Le compte d'une ligne moissonnée : `harvest_{uid}_…` ⇒ uid, sinon ''.
export const compteDeLigne = (id) => {
  const m = /^harvest_([^_]+)_/.exec(String(id == null ? '' : id));
  return m ? m[1] : '';
};

export const lireSupprimes = (stockage) => {
  try {
    const s = stockage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return new Set();
    const a = JSON.parse(s.getItem(CLE_SUPPRIMES) || '[]');
    return Array.isArray(a) ? new Set(a.map(String).filter(Boolean)) : new Set();
  } catch (_) { return new Set(); }
};

// Retire d'une liste de lignes celles d'un compte supprimé pour de bon.
// Toute autre forme (null, objet) passe telle quelle.
export const sansComptesSupprimes = (rows, supprimes) => {
  if (!Array.isArray(rows)) return rows;
  const s = supprimes || lireSupprimes();
  if (!s.size) return rows;
  return rows.filter((r) => { const u = compteDeLigne(r && r.id); return !u || !s.has(u); });
};

const enteteRange = (h) => {
  if (!h) return false;
  try {
    if (typeof Headers !== 'undefined' && h instanceof Headers) return h.has('range');
    if (Array.isArray(h)) return h.some((x) => x && String(x[0]).toLowerCase() === 'range');
    return Object.keys(h).some((k) => k.toLowerCase() === 'range');
  } catch (_) { return false; }
};

export function creerFiltreSupprimes(fetchOrig, base, lire = lireSupprimes) {
  const prefixe = String(base).replace(/\/+$/, '') + '/rest/v1/app_data?';
  return function (input, init) {
    const url = typeof input === 'string' ? input : (typeof URL !== 'undefined' && input instanceof URL ? input.href : null);
    const methode = String((init && init.method) || 'GET').toUpperCase();
    if (url == null || methode !== 'GET' || url.indexOf(prefixe) !== 0 || url.indexOf('harvest') < 0) return fetchOrig(input, init);
    if (enteteRange(init && init.headers)) return fetchOrig(input, init);
    // La purge (`purgerComptesSupprimes`) DOIT voir les lignes qu'elle vide : elle
    // le dit par `vrmVoirSupprimes` (propriété ignorée par `fetch`, rien ne part
    // au serveur). Sans ça, ce filtre lui rendait une liste vide et plus rien
    // n'était vidé (banc compte-supprime, 29 oct.).
    if (init && init.vrmVoirSupprimes === true) return fetchOrig(input, init);
    const s = lire();
    if (!s.size) return fetchOrig(input, init);
    return Promise.resolve(fetchOrig(input, init)).then(async (r) => {
      if (!r || !r.ok) return r;
      let j;
      try { j = await r.clone().json(); } catch (_) { return r; }
      if (!Array.isArray(j)) return r;
      const f = sansComptesSupprimes(j, s);
      if (f.length === j.length) return r;
      const h = new Headers(r.headers); h.delete('content-length'); h.delete('content-range');
      return new Response(JSON.stringify(f), { status: r.status, statusText: r.statusText, headers: h });
    });
  };
}

export function installerFiltreSupprimes(base) {
  try {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    if (window.__vrmFiltreSupprimes) return;
    window.fetch = creerFiltreSupprimes(window.fetch.bind(window), base);
    window.__vrmFiltreSupprimes = true;
  } catch (_) {}
}
