// ════════════════════════════════════════════════════════════════════════════
//  LA VEILLE RÉVEILLE AUSSI LEBONCOIN ET VESTIAIRE (16 nov., lot vitesse-lectures)
// ════════════════════════════════════════════════════════════════════════════
//  La veille (src/tempsReel.js) voit les lignes que l'extension range pour
//  Leboncoin (`lbc_*`) et Vestiaire (`vc_*`) changer chez le serveur — écrites
//  depuis N'IMPORTE quel navigateur. Leurs écrans savent déjà se relire : sur le
//  signal de l'extension `vrm:ext` { type:'maj', quoi:'lbc' | 'vestiaire' }, qui
//  n'arrive que dans le navigateur où l'extension tourne (rien sur l'iPhone, rien
//  quand la lecture vient d'un autre Mac). La passerelle rejoue CE signal, tel
//  quel, marqué `source:'veille'` : chaque écran relit par son chemin habituel,
//  aucune nouvelle lecture n'est inventée ici.
//   · Un vrai signal de l'extension pour la même famille il y a moins de
//     `DEJA_MS` ⇒ rien (l'écran vient de relire : pas deux relectures pour une écriture).
//   · Une famille rejouée au plus une fois toutes les `DEJA_MS` (la veille borne déjà
//     chaque LIGNE à un signal / 10 s ; plusieurs lignes d'une famille = un seul réveil).
//   · Elle n'écrit rien, ne lit rien : elle ne fait que prévenir.
// ════════════════════════════════════════════════════════════════════════════
export const DEJA_MS = 20000;
export const FAMILLES_PASSERELLE = ['lbc', 'vestiaire'];

// `quoi` de la veille ({quoi}[]) + l'heure des derniers signaux par famille ⇒ les familles à rejouer.
export function famillesARejouer(quoi, derniers, maintenant, dejaMs = DEJA_MS) {
  const out = [];
  for (const q of Array.isArray(quoi) ? quoi : []) {
    const f = q && q.quoi;
    if (!FAMILLES_PASSERELLE.includes(f) || out.includes(f)) continue;
    const d = derniers[f];
    if (d != null && maintenant - d < dejaMs) continue;
    out.push(f);
  }
  return out;
}

// Installée une fois par la coque. `win` : la fenêtre (les bancs passent la leur).
export function installerPasserelleVeille(win = typeof window !== 'undefined' ? window : null, maintenant = Date.now) {
  if (!win || win.__vrmPasserelleVeille) return () => {};
  const derniers = {};
  const ext = (e) => {
    const d = e && e.detail;
    if (!d || d.type !== 'maj' || !FAMILLES_PASSERELLE.includes(d.quoi)) return;
    derniers[d.quoi] = maintenant();   // vrai signal OU rejoué : la famille vient d'être relue
  };
  const neuf = (e) => {
    const d = e && e.detail; if (!d) return;
    for (const f of famillesARejouer(d.quoi, derniers, maintenant())) {
      try { win.dispatchEvent(new win.CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: f, source: 'veille' } })); } catch (_) {}
    }
  };
  win.addEventListener('vrm:ext', ext);
  win.addEventListener('vrm:neuf', neuf);
  win.__vrmPasserelleVeille = true;
  return () => { win.removeEventListener('vrm:ext', ext); win.removeEventListener('vrm:neuf', neuf); win.__vrmPasserelleVeille = false; };
}
