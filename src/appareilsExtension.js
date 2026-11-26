// ════════════════════════════════════════════════════════════════════════════
//  « APPAREILS CONNECTÉS » : LES NAVIGATEURS DE L'EXTENSION (23 nov., lot appareils-connectes — validé par Julien)
//  Paramètres → Sécurité → « Appareils connectés » liste déjà les SESSIONS de connexion (Supabase Auth, par
//  /api/compte?mode=appareils, 4 et 11 nov., src/appareilsGroupes.js) et « Se déconnecter partout » (scope global,
//  confirmé, src/securiteCompte.js). Ce module ajoute ce que la session ne dit pas : les NAVIGATEURS où l'extension
//  VRM tourne pour CE compte — la ligne `ext_appareil_{id}` que chaque extension publie (5.327 : `appareil.nav`,
//  `appareil.systeme`, `ver`, `atMs`), lue en PROJECTION scalaire avec `owner=eq.<lui>` (jamais `select=data`, jamais la
//  ligne d'un autre vendeur).
//  « Pas su » (§5) : lecture ratée ⇒ null (l'écran dit « — » et « Réessayer »), jamais une liste vide ; une date
//  illisible n'est ni « active » ni « ancienne ». Aucun geste ici : l'extension se ferme avec « Se déconnecter partout »
//  (sa session est une session du compte), c'est dit. Module PUR, exécuté par scripts/audit-appareils-extension.cjs.
// ════════════════════════════════════════════════════════════════════════════
export const ACTIVE_MS = 24 * 3600 * 1000;
const str = (v) => String(v == null ? '' : v).trim();
const VERSION = /^\d{1,3}\.\d{1,4}\.\d{1,4}$/;

// La lecture : seulement SES lignes, des scalaires. `owner` : son identifiant (sans lui, rien n'est demandé).
export function requeteNavigateurs(owner) {
  const o = str(owner);
  if (!/^[\w-]{8,64}$/.test(o)) return null;
  return `owner=eq.${encodeURIComponent(o)}&id=like.ext_appareil_*&select=id,ver:data->>ver,atMs:data->>atMs,nav:data->appareil->>nav,sys:data->appareil->>systeme&order=id`;
}

// Les lignes lues ⇒ [{ id, nom, ver, atMs, active }] du plus récent au plus ancien ; `rows` pas un tableau ⇒ null.
export function navigateursExtension(rows, maintenant = Date.now()) {
  if (!Array.isArray(rows)) return null;
  const vus = new Set();
  const out = [];
  for (const r of rows) {
    const id = str(r && r.id).replace(/^ext_appareil_/, '');
    if (!id || vus.has(id)) continue; vus.add(id);
    const at = Number(r.atMs);
    const atMs = Number.isFinite(at) && at > 0 ? at : null;
    const nav = str(r.nav).slice(0, 30), sys = str(r.sys).slice(0, 30);
    out.push({ id, nom: [sys, nav].filter(Boolean).join(' · '), ver: VERSION.test(str(r.ver)) ? str(r.ver) : '', atMs,
      active: atMs != null ? maintenant - atMs < ACTIVE_MS : null });
  }
  return out.sort((a, b) => (b.atMs || 0) - (a.atMs || 0) || a.id.localeCompare(b.id));
}
