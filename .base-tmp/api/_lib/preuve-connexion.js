// api/_lib/preuve-connexion.js
// ════════════════════════════════════════════════════════════════════════════
// LA PREUVE « C'EST BIEN TOI, MAINTENANT » — une seule règle pour le serveur et
// l'écran (11 nov., lot suppression-oauth).
// Bug vécu : un compte créé par Discord (AUCUN mot de passe) voyait « Ton mot de
// passe » à la suppression ; la suppression passait sans lui, car le serveur
// acceptait (à juste titre) la connexion récente. L'écran doit dire la vérité.
// ⚠️ Le SERVEUR reste juge (api/_lib/suppression-compte.js importe d'ici
//    `derniereConnexion` et `connexionRecente`) : l'écran ne fait qu'annoncer
//    le même calcul. Ne pas affaiblir ni durcir la fenêtre (10 min).
// Isomorphe : `atob` existe dans le navigateur et dans Node ≥ 16.
// ════════════════════════════════════════════════════════════════════════════
export const FENETRE_RECENTE_MS = 10 * 60 * 1000;
export const AVANCE_TOLEREE_MS = 60 * 1000;          // une horloge un peu en avance
export const FOURNISSEURS_RECONNEXION = Object.freeze(['discord', 'google']);

// La charge utile du jeton (déjà validé par Supabase côté serveur). `null` = pas lu.
export function lireJeton(jeton) {
  try {
    const p = String(jeton || '').split('.');
    if (p.length !== 3) return null;
    let b = p[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    const bin = atob(b);
    const octets = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const j = JSON.parse(new TextDecoder().decode(octets));
    return j && typeof j === 'object' ? j : null;
  } catch (_) { return null; }
}

// La dernière preuve d'identité de la session, en millisecondes (`amr` :
// [{ method, timestamp }]). `null` = pas dit.
export function derniereConnexion(jeton) {
  const j = lireJeton(jeton);
  const ts = (Array.isArray(j && j.amr) ? j.amr : []).map((x) => Number(x && x.timestamp)).filter((t) => Number.isFinite(t) && t > 0);
  return ts.length ? Math.max(...ts) * 1000 : null;
}

// La règle du serveur, mot pour mot : ≤ 10 min, jamais plus d'1 min dans le futur.
export function connexionRecente(t, maintenant = Date.now()) {
  return t != null && t <= maintenant + AVANCE_TOLEREE_MS && maintenant - t <= FENETRE_RECENTE_MS;
}

// Les fournisseurs du compte : la fiche (identities) d'abord, sinon le jeton
// (`app_metadata.providers`). `null` = pas su.
export function fournisseursDu({ identites, jeton } = {}) {
  if (Array.isArray(identites)) {
    const l = identites.map((i) => String((i && (i.provider || i.fournisseur)) || '')).filter(Boolean);
    if (l.length) return [...new Set(l)];
  }
  const a = (lireJeton(jeton) || {}).app_metadata || {};
  const l = Array.isArray(a.providers) ? a.providers.map(String).filter(Boolean) : (a.provider ? [String(a.provider)] : []);
  return l.length ? [...new Set(l)] : null;
}
// Un mot de passe : l'identité `email`. true · false · null (pas su).
export const aMotDePasseSelon = (fournisseurs) => (Array.isArray(fournisseurs) ? fournisseurs.includes('email') : null);

// Ce que l'écran propose. `cas` :
//   'oauth-recent' · 'oauth-ancien' (⇒ « Me reconnecter avec … ») ·
//   'mdp-recent' · 'mdp' (champ mot de passe) · 'recent' · 'pas-su' (champ + phrase).
export function preuveSuppression({ jeton, identites, maintenant = Date.now() } = {}) {
  const fournisseurs = fournisseursDu({ identites, jeton });
  const aMdp = aMotDePasseSelon(fournisseurs);
  const oauth = (fournisseurs || []).filter((p) => FOURNISSEURS_RECONNEXION.includes(p));
  const t = derniereConnexion(jeton);
  const recente = connexionRecente(t, maintenant);
  const resteMs = recente ? Math.max(0, FENETRE_RECENTE_MS - (maintenant - t)) : 0;
  let cas;
  if (recente) cas = aMdp === true ? 'mdp-recent' : aMdp === false ? 'oauth-recent' : 'recent';
  else cas = aMdp === true ? 'mdp' : aMdp === false ? (oauth.length ? 'oauth-ancien' : 'pas-su') : 'pas-su';
  return { cas, aMdp, oauth, recente, resteMs };
}

export const nomFournisseur = (p) => (p === 'google' ? 'Google' : p === 'discord' ? 'Discord' : '');
