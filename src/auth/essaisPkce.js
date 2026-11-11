// ═══════════════════════════════════════════════════════════════════════════
// UN VÉRIFICATEUR PKCE PAR TENTATIVE (11 nov., lot connexions-oauth)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré en production (journaux d'auth Supabase, 11 nov., Edge macOS) : liaison
// Discord réussie à 11:56:40 ; déconnexion ; « Continuer avec Discord » à 11:57:03 ;
// au retour, l'échange du code part DE LA PAGE vrm.center et Supabase répond
// 400 « code challenge does not match previously saved code verifier » ; le
// second essai passe. L'app prenait TOUJOURS le vérificateur de `sessionStorage`
// (puis celui de la liaison, puis `localStorage`) — sans savoir à quelle tentative
// appartenait le code. Un retour qui arrive dans un autre contexte (fenêtre de
// l'app installée qui capte le lien, onglet dupliqué, autre onglet) garde un
// VIEUX vérificateur et l'échange échoue.
// Règle :
//   · chaque départ reçoit un identifiant (`vrm_essai`, dans l'adresse de retour) et
//     SON vérificateur, rangé 10 min sous cet identifiant (onglet + appareil) ;
//   · au retour, le vérificateur de CETTE tentative d'abord ; l'identifiant absent
//     (Supabase retombé sur la Site URL), les autres, du plus récent au plus vieux ;
//   · Supabase garde le code après un refus de vérificateur (`bad_code_verifier`,
//     token.go : le flux n'est pas effacé) ⇒ on essaie le suivant, 3 au plus ;
//   · tout est effacé après l'échange, réussi ou raté ; jamais réutilisé.
export const CLE_ESSAIS = 'vrm_pkce_essais';
export const DUREE_ESSAI_MS = 10 * 60 * 1000;
export const ESSAIS_MAX = 3;

const lireMap = (s) => { try { const j = JSON.parse((s && s.getItem(CLE_ESSAIS)) || 'null'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (_) { return {}; } };
const frais = (e, maintenant) => e && typeof e.v === 'string' && e.v.length >= 43 && Number.isFinite(Number(e.at)) && maintenant - Number(e.at) >= -60000 && maintenant - Number(e.at) <= DUREE_ESSAI_MS;

export function nouvelIdEssai(alea = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }) {
  return Array.from(alea(9), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}

// Range le vérificateur `v` sous `id` (onglet ET appareil), en gardant les 6 plus récents.
export function poserEssai(stockages, id, v, maintenant = Date.now()) {
  for (const s of stockages) {
    try {
      if (!s) continue;
      const m = lireMap(s);
      m[id] = { v, at: maintenant };
      const garde = Object.entries(m).filter(([, e]) => frais(e, maintenant)).sort((a, b) => b[1].at - a[1].at).slice(0, 6);
      s.setItem(CLE_ESSAIS, JSON.stringify(Object.fromEntries(garde)));
    } catch (_) {}
  }
}

// Tous les essais encore valables (onglet et appareil fusionnés), puis effacés.
export function prendreEssais(stockages, maintenant = Date.now()) {
  const tous = {};
  for (const s of stockages) {
    const m = lireMap(s);
    try { s && s.removeItem(CLE_ESSAIS); } catch (_) {}
    for (const [id, e] of Object.entries(m)) if (frais(e, maintenant) && !tous[id]) tous[id] = { v: e.v, at: Number(e.at) };
  }
  return tous;
}

// L'ordre des vérificateurs à présenter. `liaison` : le contexte « Relier » (avec
// `verifier` et, depuis ce lot, `essai`). `onglet` / `appareil` : les anciennes clés
// `vrm_pkce` (une page d'avant ce lot peut avoir lancé la tentative).
// Rend [{ v, liaison: bool }] sans doublon.
export function candidatsVerificateur({ idRetour = '', essais = {}, liaison = null, onglet = '', appareil = '' } = {}) {
  const out = [], vus = new Set();
  const mettre = (v, estLiaison) => { if (typeof v === 'string' && v && !vus.has(v)) { vus.add(v); out.push({ v, liaison: !!estLiaison }); } };
  const vL = liaison && liaison.verifier;
  if (idRetour) {
    if (liaison && liaison.essai === idRetour) mettre(vL, true);
    if (essais[idRetour]) mettre(essais[idRetour].v, vL && essais[idRetour].v === vL);
  }
  if (!idRetour || !out.length) {
    if (vL) mettre(vL, true);
    mettre(onglet, onglet === vL);
    mettre(appareil, appareil === vL);
  }
  for (const [, e] of Object.entries(essais).sort((a, b) => b[1].at - a[1].at)) mettre(e.v, e.v === vL);
  if (idRetour && out.length) { mettre(vL, true); mettre(onglet, onglet === vL); mettre(appareil, appareil === vL); }
  return out;
}
