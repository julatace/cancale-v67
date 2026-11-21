// ── LES NOTIFICATIONS DEMANDÉES AU BON MOMENT (14 nov., accueil des nouveaux, n° 142) ──
// Julien : la permission se demande APRÈS une action qui en montre l'utilité — le
// premier colis suivi (« veux-tu être prévenu quand il arrive ? ») —, pas au premier
// lancement. §3 : jamais d'invitation forcée au démarrage.
//   · moments : 'colis-suivi' (il vient de toucher « Suivre » un colis : un lien de
//     `lienSuivi`, api/_lib/suivi-colis.js) et 'premier-colis' (la dernière étape du
//     premier colis accompagné, « Suivre ») ;
//   · UNE fois par compte VRM (`vrm_notifs_demande`, SYNC_KEYS) : la réponse — oui, « Pas
//     maintenant » — est rangée et respectée ; Paramètres → Notifications reste là ;
//   · seulement si le navigateur demande encore (`Notification.permission === 'default'`) ;
//     déjà accordée ou refusée ⇒ rien ;
//   · iPhone : les notifications n'existent que dans VRM installé sur l'écran d'accueil ;
//     sinon la carte le DIT (et rien n'est demandé) ;
//   · `requestPermission` n'est appelé QUE dans le geste « Oui, préviens-moi »
//     (le navigateur l'exige aussi), jamais au montage.
// JS pur : `scripts/audit-accueil-nouveaux.cjs` l'exécute.

export const CLE_NOTIFS_DEMANDE = 'vrm_notifs_demande';
export const MOMENTS_NOTIFS = Object.freeze(['colis-suivi', 'premier-colis']);

export function lireDemandeNotifs(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : null;
  return o && typeof o.at === 'string' && o.at ? { at: o.at, reponse: typeof o.reponse === 'string' ? o.reponse : null, moment: typeof o.moment === 'string' ? o.moment : null } : null;
}
// `plateforme` : { notif: 'default'|'granted'|'denied'|'absent', ios: bool, installee: bool }.
// Rend 'demander' · 'installer' (iPhone sans l'app sur l'écran d'accueil) · null (rien).
export function quoiProposer({ moment, marqueur, plateforme, exemple, pret } = {}) {
  if (!pret || exemple || !MOMENTS_NOTIFS.includes(moment)) return null;
  if (lireDemandeNotifs(marqueur)) return null;
  const p = plateforme || {};
  if (p.ios && !p.installee) return 'installer';
  if (p.notif !== 'default') return null;
  return 'demander';
}
export const marqueurNotifs = (reponse, moment, at = new Date().toISOString()) => ({ at, reponse, moment });

// Un lien de suivi de colis (les adresses que rend `lienSuivi`).
export function estLienSuivi(href) {
  let u;
  try { u = new URL(String(href || ''), 'https://vrm.center'); } catch (_) { return false; }
  const h = u.hostname.replace(/^www\./, '');
  if (h === 'mondialrelay.fr') return /^\/suivi-de-colis/.test(u.pathname);
  if (h === 'chronopost.fr') return /tracking/.test(u.pathname);
  if (h === 'vintedgo.com') return /\/tracking\//.test(u.pathname);
  if (h === 'google.com') return u.pathname === '/search' && /\bsuivi colis$/.test((u.searchParams.get('q') || '').trim());
  return false;
}
