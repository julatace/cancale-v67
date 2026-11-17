// ════════════════════════════════════════════════════════════════════════════
//  LE JOURNAL DES PLANTAGES ÉCOUTE DÈS LE DÉMARRAGE — SANS PESER SUR L'ACCUEIL
//  (16 nov., lot vitesse-lectures)
// ════════════════════════════════════════════════════════════════════════════
//  src/plantages.js (le nettoyage, l'empreinte, le plafond, l'écriture) n'est plus
//  dans le fichier d'entrée de la page d'accueil (budget de poids du banc `accueil`).
//  Ce tampon, minuscule, est posé AU DÉMARRAGE à sa place : il garde chaque erreur
//  de la page (`error` portant une Error, `unhandledrejection` portant une Error),
//  chaque violation de la politique de sécurité du contenu et chaque morceau périmé
//  (`vite:preloadError`), AVEC le contexte de l'instant (l'écran, la version). Le
//  vrai journal arrive peu après (à l'inactivité, ou au premier plantage) : il
//  reprend tout ce qui a été gardé, dans l'ordre, puis écoute lui-même — les mêmes
//  règles qu'avant, rien n'est perdu ni noté deux fois.
// ════════════════════════════════════════════════════════════════════════════
export const MAX_TAMPON = 50;

export function poserTamponPlantages({ win = window, doc = document, contexte = () => ({}), charger = () => import('./plantages.js') } = {}) {
  const file = [];
  let mod = null, enCours = null;
  const garder = (x) => { if (file.length < MAX_TAMPON) file.push(x); };
  const ctx = () => { try { return contexte() || {}; } catch (_) { return {}; } };
  const err = (ev) => { if (ev && ev.error) garder(['p', ev.error, Object.assign({ origine: 'page' }, ctx())]); };
  const rej = (ev) => { const r = ev && ev.reason; if (r && r instanceof Error) garder(['p', r, Object.assign({ origine: 'promesse' }, ctx())]); };
  const csp = (e) => garder(['c', e, ctx()]);
  try { win.addEventListener('error', err); win.addEventListener('unhandledrejection', rej); doc.addEventListener('securitypolicyviolation', csp); } catch (_) {}
  const vrai = () => {
    if (mod) return Promise.resolve(mod);
    if (enCours) return enCours;
    enCours = Promise.resolve().then(charger).then((m) => {
      if (mod) return mod;
      mod = m;
      try { win.removeEventListener('error', err); win.removeEventListener('unhandledrejection', rej); doc.removeEventListener('securitypolicyviolation', csp); } catch (_) {}
      try { m.ecouterPlantages(contexte); m.ecouterViolationsCsp(contexte); } catch (_) {}
      for (const [sorte, x, c] of file.splice(0)) {
        try { if (sorte === 'p') m.noterPlantage(x, c); else if (sorte === 'c') m.noterViolationCsp(x, c); else if (sorte === 'm') m.compterMorceauPerime(x); } catch (_) {}
      }
      return m;
    }, () => { enCours = null; return null; });
    return enCours;
  };
  return {
    // Une erreur attrapée par un garde-fou React (le dernier filet).
    noter(e, c) { if (mod) { try { mod.noterPlantage(e, c); } catch (_) {} return; } garder(['p', e, c]); vrai(); },
    compterMorceauPerime(p) { if (mod) { try { mod.compterMorceauPerime(p); } catch (_) {} return; } garder(['m', p]); vrai(); },
    charger: vrai,
    _file: () => file.length,
  };
}
