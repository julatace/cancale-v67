// (11 nov., famille « N° par cleNum ») l'identité d'un N° : la règle `cleNum` (api/_lib/numerotation.js),
// recopiée ici car des audits chargent ce module SEUL ; scripts/audit-numeros-clenum.cjs vérifie qu'elle rend la même chose.
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
// La paire REPUBLIÉE garde son numéro (28 oct., Julien : « quand la paire est
// republiée elle ne conserve pas son numéro »). Une republication (Republier,
// En ligne → brouillon puis Brouillons → en ligne, Refaire le brouillon) crée
// une NOUVELLE annonce Vinted : l'extension note qui elle remplace —
// `vinted_brouillon_{id}.ancienId` (un brouillon publié garde son identifiant)
// et `coffre_{uid}_{nouvelId}.recreeDe`. C'est une IDENTITÉ (§5), jamais le titre.
//
// Règle pure : `recrees` = { nouvelId: ancienId }. Rend les fiches à poser.
//  - la nouvelle annonce prend le numéro de l'ancienne si l'ancienne n'est
//    plus en ligne, et si aucune AUTRE annonce en ligne ne porte déjà ce numéro ;
//  - deux nouvelles annonces en ligne pour la même ancienne ⇒ aucune (on ne
//    devine pas laquelle est la paire) ;
//  - une nouvelle annonce déjà numérotée À LA MAIN, déjà reprise, ou dont le
//    numéro est porté par une vente, garde le sien ;
//  - une nouvelle annonce numérotée AUTOMATIQUEMENT (le défaut d'avant) reprend
//    l'ancien numéro ; le numéro qu'elle avait reste brûlé (pool, §5).
export function repriseNumerosRecreation({ enLigneIds, numeros, recrees, numeroVente, reprenable, cle }) {
  const out = {};
  if (!recrees || typeof recrees !== 'object') return out;
  const enLigne = new Set((enLigneIds || []).map(String));
  const k = cle || cleNum;
  const ok = reprenable || ((n) => !!String(n || '').trim());
  // Pour chaque ancienne, ses remplaçantes en ligne.
  const parAncien = {};
  for (const nid of Object.keys(recrees)) {
    if (!enLigne.has(String(nid))) continue;
    const a = String(recrees[nid] || ''); if (!a || a === String(nid)) continue;
    (parAncien[a] = parAncien[a] || new Set()).add(String(nid));
  }
  const numerosEnLigne = (sauf) => {
    const s = new Set();
    for (const id of enLigne) { if (id === sauf) continue; const e = numeros[id]; if (e && String(e.numero || '').trim()) s.add(k(e.numero)); }
    return s;
  };
  for (const a of Object.keys(parAncien)) {
    const nouveaux = [...parAncien[a]];
    if (nouveaux.length !== 1) continue;           // ambigu : on ne devine pas
    if (enLigne.has(a)) continue;                   // l'ancienne est encore en ligne
    const ancienne = numeros[a];
    if (!ancienne || !ok(ancienne.numero)) continue;
    const nid = nouveaux[0];
    const cur = numeros[nid];
    if (cur && k(cur.numero) === k(ancienne.numero)) continue;          // déjà repris
    if (cur && String(cur.numero || '').trim()) {
      if (!cur.auto || cur.manuelAt || cur.recreeDe) continue;           // posé à la main : on garde
      if (numeroVente && numeroVente(nid)) continue;                     // une vente porte son numéro
    }
    if (numerosEnLigne(nid).has(k(ancienne.numero))) continue;           // déjà sur une autre paire en ligne
    const fiche = { ...ancienne, recreeDe: a, recreeAt: new Date().toISOString() };
    if (cur && String(cur.numero || '').trim()) fiche.numeroRendu = { de: String(cur.numero), at: new Date().toISOString() };
    out[nid] = fiche;
  }
  return out;
}

// (6 nov., finitions) UN N° D'ARCHIVE (« B… », migration 013) NE SE REDONNE JAMAIS : une paire
// remise en vente (vente annulée avant l'envoi, « Remettre en vente ») dont le carton porte un
// ancien N° reçoit un N° NEUF sur sa nouvelle annonce. Le carton dit encore « B230 » : la paire
// entre dans « nouveaux numéros à écrire sur tes cartons » — la MÊME liste que les doublons
// réglés et les N° changés à la main (`reattribue` sur la fiche, `reattribueAEcrire` d'App.jsx),
// jusqu'à « C'est écrit ». Pas une seconde règle : ceci ne fait que poser ce `reattribue`.
//  - `anciens` = { ancienId: numéro d'archive } — seulement les remises que VRM accompagne
//    (`vrm_repub_main`, `numArchive` posé quand il ouvre « Remettre en vente ») ;
//  - `recrees` = { nouvelId: ancienId } (la table de reprise : SON clic « C'est celle-ci ») ;
//  - la nouvelle doit être EN LIGNE, seule pour son ancienne (deux ⇒ on ne devine pas), porter
//    un N° neuf (reprenable, différent), et n'avoir jamais eu de `reattribue` (une fois : après
//    « C'est écrit » rien ne revient).
// Rend { nouvelId: { de, vers } }. Fonction PURE.
export function archivesAEcrire({ enLigneIds, recrees, numeros, anciens, reprenable, cle }) {
  const out = {};
  if (!recrees || typeof recrees !== 'object' || !anciens || typeof anciens !== 'object') return out;
  const enLigne = new Set((enLigneIds || []).map(String));
  const k = cle || cleNum;
  const ok = reprenable || ((n) => !!String(n || '').trim());
  const parAncien = {};
  for (const nid of Object.keys(recrees)) {
    if (!enLigne.has(String(nid))) continue;
    const a = String(recrees[nid] || ''); if (!a || a === String(nid)) continue;
    (parAncien[a] = parAncien[a] || []).push(String(nid));
  }
  for (const a of Object.keys(parAncien)) {
    const de = String(anciens[a] == null ? '' : anciens[a]).trim();
    if (!de || ok(de)) continue;                               // pas un N° d'archive : la reprise s'en charge
    if (parAncien[a].length !== 1) continue;                   // ambigu : on ne devine pas
    const nid = parAncien[a][0];
    const f = (numeros || {})[nid];
    const vers = f && String(f.numero || '').trim();
    if (!vers || !ok(vers) || k(vers) === k(de)) continue;     // pas encore de N° neuf
    if (f.reattribue) continue;                                // déjà dit (ou « C'est écrit »)
    out[nid] = { de, vers };
  }
  return out;
}

// Lit la table nouvelId → ancienId depuis les lignes de l'extension.
// `brouillons` : [{id:'vinted_brouillon_X', anc, item}] ; `coffres` : [{id:'coffre_uid_X', r}].
export function tableRecrees(brouillons, coffres) {
  const t = {};
  const num = (x) => /^\d{4,15}$/.test(String(x || '')) ? String(x) : '';
  for (const b of (brouillons || [])) {
    const anc = num(b && b.anc); if (!anc) continue;
    const draft = num(String(b.id || '').replace(/^vinted_brouillon_/, ''));
    if (draft && !t[draft]) t[draft] = anc;
    const item = num(b.item); if (item && !t[item]) t[item] = anc;
  }
  for (const c of (coffres || [])) {
    const m = /^coffre_\d+_(\d{4,15})$/.exec(String(c && c.id || '')); const anc = num(c && c.r);
    if (m && anc && !t[m[1]]) t[m[1]] = anc;
  }
  return t;
}
