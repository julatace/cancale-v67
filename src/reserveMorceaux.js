// ════════════════════════════════════════════════════════════════════════════
//  LA PAGE FAIT RANGER LES FICHIERS DE SA VERSION (24 nov., morceaux-perimes)
//
//  Le défaut le plus vu par Julien : l'app ouverte sur l'iPhone pendant une mise en
//  ligne, puis un écran jamais ouvert ⇒ son fichier n'existe plus sur le serveur
//  (mesuré en production : 404, et Vercel Hobby ne garde pas l'ancien déploiement),
//  la page repart ou dit « Mettre à jour VRM ». Mesuré au banc
//  (scripts/bancs/morceaux-perimes.cjs) : une page dont TOUS les fichiers sont dans
//  la réserve du service worker traverse la mise en ligne sans rien voir. Mais cette
//  réserve n'était remplie QUE par le service worker, 15 s après l'ouverture, un
//  fichier à la fois (≈ 340) — un service worker qu'iOS endort quand il veut. Tant
//  qu'elle n'a pas fini, une mise en ligne casse la page.
//
//  Ici, la PAGE (vivante tant que Julien s'en sert) demande, au repos, chaque fichier
//  de SA version qui n'est pas encore rangé ; le service worker le range au passage
//  (public/sw.js, règle 3 : `/assets/` cache d'abord, rangé à la première demande).
//  Rien n'est téléchargé deux fois (un fichier rangé est servi par la réserve, sans
//  réseau) et ce sont les MÊMES fichiers que la réserve du service worker prenait de
//  toute façon (`/hors-ligne-assets.json`, la langue du vendeur seule) — pas un
//  octet de plus, seulement plus tôt et sans dépendre du réveil du service worker.
//  La page dit aussi au service worker QUELLE version elle fait tourner et ses
//  fichiers (`VRM_GARDER_VERSION`) : son ménage ne les retire pas tant qu'elle est ouverte.
//
//  Garde-fous : seulement avec un service worker qui contrôle la page ; seulement si
//  le serveur sert ENCORE la version de la page (sa liste nomme son script principal) ;
//  deux fichiers à la fois au plus ; un fichier absent (la mise en ligne est passée)
//  arrête tout ; une fois par page.
// ════════════════════════════════════════════════════════════════════════════
import { versionChargee } from './chargementSur.js';

const RE_FICHIER = /^\/assets\/[A-Za-z0-9._-]+\.(?:js|css|woff2)$/;
// La liste de la version (pure, exécutée par l'audit) : null si elle n'est pas celle de la page.
export function fichiersDeLaVersion(j, version, langue = 'fr') {
  if (!j || !Array.isArray(j.fichiers) || !version) return null;
  if (!j.fichiers.includes(version)) return null;   // le serveur sert une AUTRE version : ses fichiers ne sont pas les nôtres
  const l = j.langues && typeof j.langues === 'object' && langue !== 'fr' && Array.isArray(j.langues[langue]) ? j.langues[langue] : [];
  const p = Array.isArray(j.polices) ? j.polices : [];
  return [...new Set([...j.fichiers, ...l, ...p])].filter((n) => typeof n === 'string' && RE_FICHIER.test(n)).slice(0, 600);
}

let lance = false;
export function reserverMaVersion({ langue = 'fr', delai = 4000, f = (typeof fetch === 'function' ? fetch : null) } = {}) {
  if (lance || typeof window === 'undefined' || !f) return Promise.resolve(null);
  lance = true;
  const sw = typeof navigator !== 'undefined' && navigator.serviceWorker;
  if (!sw || typeof caches === 'undefined') return Promise.resolve(null);
  const repos = () => new Promise((r) => { try { (window.requestIdleCallback || ((g) => setTimeout(g, 300)))(() => r(), { timeout: 3000 }); } catch (_) { setTimeout(r, 300); } });
  return new Promise((r) => setTimeout(r, delai)).then(async () => {
    const version = versionChargee();
    if (!version || !sw.controller) return null;   // sans service worker qui contrôle la page, rien ne serait rangé
    let j = null;
    try { const rep = await f('/hors-ligne-assets.json?_v=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' }); j = rep && rep.ok ? await rep.json() : null; } catch (_) { return null; }
    const liste = fichiersDeLaVersion(j, version, langue);
    if (!liste) return null;
    try { sw.controller.postMessage({ type: 'VRM_GARDER_VERSION', version, fichiers: liste }); } catch (_) {}
    const manque = [];
    for (const n of liste) { try { if (!(await caches.match(n))) manque.push(n); } catch (_) { manque.push(n); } }
    let i = 0, ranges = 0, arret = false;
    const ouvrier = async () => {
      while (!arret && i < manque.length) {
        const n = manque[i++];
        await repos();
        try {
          const rep = await f(n, { credentials: 'same-origin' });
          if (!rep || rep.status !== 200) { arret = true; break; }   // la mise en ligne est passée : rien de plus à garder
          await rep.arrayBuffer();   // lu en entier : le service worker l'a rangé au passage
          ranges++;
        } catch (_) { arret = true; }
      }
    };
    await Promise.all([ouvrier(), ouvrier()]);
    try { window.__vrmReserve = { version, total: liste.length, manquaient: manque.length, ranges, arret }; } catch (_) {}
    return window.__vrmReserve;
  }).catch(() => null);
}
