// ═══════════════════════════════════════════════════════════════════════════
// « TOUT VA BIEN ? » — LES POINTS, DANS L'ORDRE D'IMPORTANCE (20 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 20 nov. : « OK » à « Tout va bien ? qui dit exactement quoi faire ». Chaque point est UNE rangée :
// ce qui ne va pas, et LE geste qui le règle ; le reste (comptes un par un, appareils, rapports) passe
// derrière « Détails ». Ce module ne lit rien et n'écrit rien : il RANGE ce que les lectures de toujours ont
// déjà dit (src/ToutVaBien.jsx `useEtatCapture`, la règle de la page Extension `etatNavigateur`, le contrôle
// de cette nuit `pointsToutVaBien`, la santé des données). « Pas su » reste un point « pas su » (jamais « ok »).
// L'ordre — ce qui coûte le plus cher d'abord :
//   0 deux paires sous un même N° (le seul risque irréversible, CLAUDE.md §5) ;
//   1 l'extension de CE navigateur ne peut pas agir (absente, muette, pas branchée, en retard) ;
//   2 un compte en PANNE prouvée (ce qu'il envoie est refusé) ;
//   3 un compte pas relu (jamais, ou trop ancien) ;
//   4 une extension d'un autre appareil en retard de version ;
//   5 les autres lignes du contrôle de cette nuit ;
//   6 des données à corriger (santé des données) ;
//   7 ce qui n'a pas pu être vérifié (« Revérifier ») ;
//   8 Vinted a changé une page (rien à faire : dit, sans geste).
// JS pur : scripts/audit-demarrage.cjs l'exécute (mutations comprises).
// ═══════════════════════════════════════════════════════════════════════════

export const RANGS = Object.freeze({ doublon: 0, extension: 1, panne: 2, compte: 3, appareil: 4, controle: 5, donnees: 6, passu: 7, forme: 8 });
// Les contrôles de nuit qui disent un doublon de N° (src/controleNuit.js) : le rang 0.
const CONTROLES_DOUBLON = new Set(['numeros-double']);

// `p` :
//   nav        etatNavigateur(…) de la page Extension, ou null (pas lu)
//   pannes     [{ plateforme, id, cause, geste }] (pannesCapture, api/_lib/garde-capture.js)
//   lignes     [{ plateforme, id, nom, etat, geste, age }] (lignesFraicheur)
//   appareils  [{ id, nom, paquet, code, ver }] ; `versionDe(a)` → 'a-jour' | 'ancienne' | 'pas-su'
//   ancienInconnu  vrai : une extension ancienne a écrit sans s'inscrire
//   controle   [{ controle, n }] (pointsToutVaBien, source « controle »)
//   donnees    nombre de choses à corriger dans les données (null = pas su)
//   passu      [noms] de ce qui n'a pas pu être lu
//   formes     nombre de pages de Vinted lues d'une forme inconnue
// Rend { etat: 'ok' | 'points' | 'passu', n (points à régler), points: [{ cle, type, rang, … }] }.
export function pointsEcran(p = {}) {
  const out = [];
  for (const c of Array.isArray(p.controle) ? p.controle : []) {
    if (!c || !c.controle) continue;
    const doublon = CONTROLES_DOUBLON.has(c.controle);
    out.push({ cle: 'controle:' + c.controle, type: 'controle', rang: doublon ? RANGS.doublon : RANGS.controle, controle: c.controle, n: c.n || 0, ton: doublon ? 'rouge' : 'geste' });
  }
  const nav = p.nav && typeof p.nav === 'object' ? p.nav : null;
  if (nav && nav.ton === 'geste') out.push({ cle: 'extension:ici', type: 'extension', rang: RANGS.extension, code: nav.code, phrase: nav.cle, vars: nav.vars || {}, geste: nav.geste || null, ton: 'geste' });
  const enPanne = new Set();
  for (const x of Array.isArray(p.pannes) ? p.pannes : []) {
    if (!x || !x.plateforme) continue;
    const k = `${x.plateforme}:${x.id}`; enPanne.add(k);
    out.push({ cle: 'panne:' + k, type: 'panne', rang: RANGS.panne, plateforme: x.plateforme, id: String(x.id || ''), nom: String(x.nom || ''), cause: String(x.cause || ''), conseil: String(x.geste || ''), ton: 'geste' });
  }
  for (const l of Array.isArray(p.lignes) ? p.lignes : []) {
    if (!l || !l.geste) continue;
    const k = `${l.plateforme}:${l.id}`;
    if (enPanne.has(k)) continue;   // une panne prouvée dit déjà ce compte (et son geste)
    out.push({ cle: 'compte:' + k, type: 'compte', rang: RANGS.compte, plateforme: l.plateforme, id: String(l.id || ''), nom: String(l.nom || ''), jamais: l.etat === 'jamais', age: String(l.age || ''), ton: 'geste' });
  }
  const versionDe = typeof p.versionDe === 'function' ? p.versionDe : () => 'pas-su';
  for (const a of Array.isArray(p.appareils) ? p.appareils : []) {
    if (!a || versionDe(a) !== 'ancienne') continue;
    out.push({ cle: 'appareil:' + a.id, type: 'appareil', rang: RANGS.appareil, id: String(a.id || ''), nom: String(a.nom || ''), paquet: a.paquet || 'chromium', version: String(a.code || a.ver || ''), ton: 'geste' });
  }
  if (p.ancienInconnu) out.push({ cle: 'appareil:inconnu', type: 'appareil', rang: RANGS.appareil, id: 'inconnu', nom: '', paquet: 'chromium', version: '', inconnu: true, ton: 'geste' });
  if (Number.isFinite(p.donnees) && p.donnees > 0) out.push({ cle: 'donnees', type: 'donnees', rang: RANGS.donnees, n: p.donnees, ton: 'geste' });
  const passu = Array.isArray(p.passu) ? p.passu.filter(Boolean) : [];
  if (passu.length) out.push({ cle: 'passu', type: 'passu', rang: RANGS.passu, quoi: passu, ton: 'passu' });
  if (Number.isFinite(p.formes) && p.formes > 0) out.push({ cle: 'forme', type: 'forme', rang: RANGS.forme, n: p.formes, ton: 'neutre' });
  out.sort((a, b) => a.rang - b.rang);
  const aRegler = out.filter((x) => x.type !== 'forme' && x.type !== 'passu').length;
  return { etat: aRegler ? 'points' : passu.length ? 'passu' : 'ok', n: aRegler, points: out };
}

// LE geste d'un point : { code, lien?, telecharger?, aller? } — jamais deviné ; `null` = rien à faire de son côté.
//   inst : installerExtensionIci() ({ lien }) ; liensSite : { vinted, leboncoin, vestiaire } ; lienPaquet(pt) ;
//   allerControle(cle) : l'adresse du geste d'un contrôle de nuit (src/controleNuit.js CONTROLES).
export function gestePoint(pt, { inst = null, liensSite = {}, lienPaquet = null, allerControle = null } = {}) {
  if (!pt) return null;
  if (pt.type === 'controle') { const u = allerControle ? allerControle(pt.controle) : ''; return u ? { code: 'aller', aller: u } : null; }
  if (pt.type === 'extension') {
    if (pt.geste === 'installer' || pt.geste === 'mettre-a-jour') return inst && inst.lien ? { code: pt.geste, lien: inst.lien, telecharger: /\.zip(\?|$)/.test(inst.lien) } : { code: 'page-extension' };
    if (pt.geste === 'brancher') return { code: 'brancher' };
    if (pt.geste === 'ordinateur') return null;
    return { code: 'page-extension' };
  }
  if (pt.type === 'panne') return { code: 'page-extension' };
  if (pt.type === 'compte') {
    if (pt.plateforme === 'ebay') return { code: 'aller', aller: '?tab=plat_ebay&section=compte' };
    const l = liensSite[pt.plateforme];
    return l ? { code: 'ouvrir-site', lien: l } : null;
  }
  if (pt.type === 'appareil') { const l = lienPaquet ? lienPaquet(pt) : ''; return l ? { code: 'installer', lien: l, telecharger: true } : null; }
  if (pt.type === 'donnees') return { code: 'sante' };
  if (pt.type === 'passu') return { code: 'relire' };
  return null;
}
