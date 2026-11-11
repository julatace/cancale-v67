// ── UN SEUL FIL PAR ACHETEUR ET PAR PAIRE, TOUTES PLATEFORMES (10 nov., lot AB) ──
// Julien a validé (propositions du 9 nov., n° 42) : « Messages des quatre
// plateformes dans un seul fil par acheteur et par paire, avec la plateforme
// marquée ». Ce module porte la RÈGLE, sans React : l'écran Messages · Tous
// (src/ecrans/FilsTous.jsx) et le banc `fil-unique` l'exécutent.
//
// ⚠️ §5 — JAMAIS PAR RESSEMBLANCE. Deux conversations forment UN fil seulement si :
//   · le MÊME interlocuteur, par l'identifiant de SA plateforme (Vinted :
//     `opposite_user.id`) — jamais un pseudo qui ressemble ; un identifiant
//     n'est comparé qu'à un identifiant de la même plateforme ;
//   · ET au moins UNE identité de paire en commun : l'annonce (son id, sur sa
//     plateforme), la transaction (son n°, sur sa plateforme) ou le N° (posé
//     par identité, jamais lu dans un titre).
//   · OU c'est SON clic qui les a reliées (`liens`, écrit seulement par lui).
// Leboncoin et Vestiaire ne donnent jamais qui écrit (le fil n'a ni nom ni
// identifiant de l'acheteur) : leurs conversations ne se fusionnent jamais
// toutes seules. Deux conversations sans identité commune restent deux fils ;
// au plus, VRM DEMANDE (`suggestionsFils`) — et rien n'est relié sans lui.
//
// Répondre passe par la plateforme d'origine du DERNIER message (`conversationDeReponse`) :
// l'écran ouvre alors CETTE conversation dans son propre fil, avec ses règles
// d'envoi (extension, recette APPRISE, 50 actions/h) — ce module n'envoie rien.

export const CLE_FILS_RELIES = 'vrm_fils_relies';
export const PLATEFORMES_FIL = ['vinted', 'leboncoin', 'vestiaire', 'ebay'];

const txt = (v) => (v == null ? '' : String(v).trim());
// Le N° comme identité : EXACTEMENT `cleNum` de l'app (majuscules, sans espace ni
// tiret, « 007 » = « 7 ») — recopiée ici, le banc `fil-unique` compare les deux.
export const cleNumFil = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
};
// Une date en millisecondes, ou `null` (jamais 0 sur un « pas su »).
export const instantFil = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n > 0 ? (n < 1e12 ? n * 1000 : n) : null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

// ── Les conversations, une forme pour toutes ─────────────────────────────────
// { cle, plateforme, compte, conv, interlocuteur, annonce, tx, num, at, apercu,
//   deMoi, nonLu, titre, photo, nom }
// `interlocuteur`, `annonce`, `tx` sont préfixés par la plateforme : un id Vinted
// n'est jamais égal à un id Leboncoin.
const entree = (o) => ({
  cle: o.plateforme + ':' + txt(o.compte) + ':' + txt(o.conv),
  plateforme: o.plateforme, compte: txt(o.compte), conv: txt(o.conv),
  interlocuteur: txt(o.interlocuteur) ? o.plateforme + ':' + txt(o.interlocuteur) : null,
  annonce: txt(o.annonce) ? o.plateforme + ':' + txt(o.annonce) : null,
  tx: txt(o.tx) ? o.plateforme + ':' + txt(o.tx) : null,
  num: cleNumFil(o.num) || null,
  at: instantFil(o.at), apercu: txt(o.apercu), deMoi: o.deMoi === true ? true : o.deMoi === false ? false : null,
  nonLu: o.nonLu === true ? true : o.nonLu === false ? false : null,
  titre: txt(o.titre), photo: o.photo || null, nom: txt(o.nom),
});
// Vinted : la conversation de la boîte (`opposite_user.id`) et sa paire PAR IDENTITÉ
// (`paireDeConv` de l'app : transaction → annonce → N° posé sur CETTE annonce).
export function convVinted(c, paire, compte) {
  if (!c || c.id == null) return null;
  const u = c.opposite_user || {};
  return entree({ plateforme: 'vinted', compte: compte != null ? compte : (c._acc && c._acc.vinted_user_id), conv: c.id,
    interlocuteur: u.id, annonce: paire && paire.item, tx: paire && paire.tx, num: paire && paire.num,
    at: c.updated_at, apercu: c.description, deMoi: null, nonLu: c.unread === true ? true : c.unread === false ? false : null,
    titre: (paire && paire.titre) || '', photo: (paire && paire.photo) || null, nom: u.login || '' });
}
// Leboncoin (`lbc_fil_{conv}`, en scalaires) : ni l'acheteur, ni l'annonce — la
// conversation est sa seule identité.
export function convLeboncoin(f) {
  if (!f || !txt(f.conv)) return null;
  return entree({ plateforme: 'leboncoin', compte: f.compte, conv: f.conv, at: f.da, apercu: f.ap,
    deMoi: f.dm === 'true' || f.dm === true ? true : f.dm === 'false' || f.dm === false ? false : null, nom: f.nom || '' });
}
// Vestiaire (`vc_fil_{conv}` + `vc_messages.conversations`) : l'article (`productId`)
// et le N° de sa RÉFÉRENCE VRM (jamais du titre) ; jamais l'acheteur.
export function convVestiaire(v) {
  if (!v || !txt(v.conv)) return null;
  return entree({ plateforme: 'vestiaire', compte: v.compte, conv: v.conv, annonce: v.pid, num: v.num,
    at: v.date, apercu: v.apercu, deMoi: v.deMoi, nonLu: v.nonLu, titre: v.titre, photo: v.photo, nom: '' });
}

// Les identités de paire d'une conversation (vide ⇒ aucune).
export const identitesPaire = (e) => [e.annonce && 'a:' + e.annonce, e.tx && 't:' + e.tx, e.num && 'n:' + e.num].filter(Boolean);
// La clé d'un lien posé par lui : les deux conversations, dans l'ordre.
export const cleLien = (a, b) => [String(a), String(b)].sort().join('|');

// ── Le regroupement ─────────────────────────────────────────────────────────
// `liens` : { [cleLien]: { a, b, at } } — écrits par SON clic seulement.
export function regrouperFils(entrees, liens) {
  const liste = (Array.isArray(entrees) ? entrees : []).filter((e) => e && e.cle);
  const vus = new Map();
  for (const e of liste) if (!vus.has(e.cle)) vus.set(e.cle, e);
  const tous = [...vus.values()];
  const parent = new Map(tous.map((e) => [e.cle, e.cle]));
  const racine = (k) => { let r = k; while (parent.get(r) !== r) r = parent.get(r); let x = k; while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; } return r; };
  const unir = (a, b) => { const ra = racine(a), rb = racine(b); if (ra !== rb) parent.set(rb, ra); };
  // 1. Même interlocuteur (identifiant de la plateforme) ET une identité de paire commune.
  const parQui = new Map();
  for (const e of tous) if (e.interlocuteur) { if (!parQui.has(e.interlocuteur)) parQui.set(e.interlocuteur, []); parQui.get(e.interlocuteur).push(e); }
  for (const groupe of parQui.values()) {
    const parId = new Map();
    for (const e of groupe) for (const id of identitesPaire(e)) { if (parId.has(id)) unir(parId.get(id), e.cle); else parId.set(id, e.cle); }
  }
  // 2. Ses liens (les deux conversations doivent exister ; sinon le lien dort).
  for (const l of Object.values(liens && typeof liens === 'object' ? liens : {})) {
    if (l && vus.has(String(l.a)) && vus.has(String(l.b))) unir(String(l.a), String(l.b));
  }
  const groupes = new Map();
  for (const e of tous) { const r = racine(e.cle); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(e); }
  const fils = [...groupes.values()].map((convs) => {
    convs.sort((x, y) => (x.at == null) - (y.at == null) || (x.at || 0) - (y.at || 0) || x.cle.localeCompare(y.cle));
    const dates = convs.map((c) => c.at).filter((t) => t != null);
    const dernier = convs.filter((c) => c.at != null).slice(-1)[0] || null;
    const nums = [...new Set(convs.map((c) => c.num).filter(Boolean))];
    const plateformes = PLATEFORMES_FIL.filter((p) => convs.some((c) => c.plateforme === p));
    const nonLus = convs.map((c) => c.nonLu);
    return {
      cle: convs.map((c) => c.cle).sort()[0], convs, plateformes,
      at: dates.length ? Math.max(...dates) : null,
      // Le N° seulement s'il est UN (deux N° différents dans un fil relié par lui : aucun écrit).
      num: nums.length === 1 ? nums[0] : null,
      nonLu: nonLus.includes(true) ? true : nonLus.every((v) => v === false) ? false : null,
      dernier,
      relie: convs.length > 1,
    };
  });
  // Le plus récent en haut ; sans date lue, en bas (jamais daté au hasard).
  fils.sort((a, b) => (a.at == null) - (b.at == null) || (b.at || 0) - (a.at || 0) || a.cle.localeCompare(b.cle));
  return fils;
}

// ── Ce que VRM DEMANDE (jamais relié sans lui) ──────────────────────────────
//   · « paire »    : le MÊME interlocuteur (identifiant de la plateforme), deux fils,
//                    l'un sans AUCUNE identité de paire ⇒ « Peut-être la même paire ? » ;
//   · « acheteur » : le MÊME N° (posé par identité) sur deux plateformes, deux fils
//                    ⇒ « Peut-être le même acheteur ? ».
// Deux fils dont les paires sont prouvées DIFFÉRENTES ne sont jamais proposés.
// `refus` : { [cleLien]: at } — un « Non » ne revient pas.
export function suggestionsFils(fils, liens, refus) {
  const out = [];
  const l = liens && typeof liens === 'object' ? liens : {}, r = refus && typeof refus === 'object' ? refus : {};
  const liste = Array.isArray(fils) ? fils : [];
  // (11 nov., pire cas) Avant : chaque paire de fils comparée, ses ensembles refaits à chaque
  // tour — 2 000 conversations ⇒ 2 millions de tours, 1,9 s de gel à chaque rendu de Messages.
  // Les deux règles ne rapprochent QUE deux fils qui partagent un interlocuteur ou un N° : on
  // ne compare que ceux-là (index), dans le même ordre (i < j), avec la même règle.
  const ids = liste.map((f) => new Set(f.convs.flatMap(identitesPaire)));
  const qui = liste.map((f) => new Set(f.convs.map((c) => c.interlocuteur).filter(Boolean)));
  const plat = liste.map((f) => new Set(f.convs.map((c) => c.plateforme)));
  const index = new Map();
  const range = (cle, i) => { if (!index.has(cle)) index.set(cle, []); const t = index.get(cle); if (t[t.length - 1] !== i) t.push(i); };
  liste.forEach((f, i) => { for (const q of qui[i]) range('q:' + q, i); if (f.num) range('n:' + f.num, i); });
  const paires = new Set();
  for (const t of index.values()) for (let a = 0; a < t.length; a++) for (let b = a + 1; b < t.length; b++) paires.add(t[a] * liste.length + t[b]);
  const deja = new Set();
  for (const p of [...paires].sort((x, y) => x - y)) {
    const i = Math.floor(p / liste.length), j = p % liste.length;
    const A = liste[i], B = liste[j];
    const k = cleLien(A.cle, B.cle);
    if (deja.has(k) || l[k] || r[k]) continue;
    const memeQui = [...qui[i]].some((q) => qui[j].has(q));
    let sorte = null;
    if (memeQui && (!ids[i].size || !ids[j].size)) sorte = 'paire';
    else if (A.num && A.num === B.num && ![...plat[i]].some((x) => plat[j].has(x))) sorte = 'acheteur';
    if (!sorte) continue;
    deja.add(k);
    out.push({ cle: k, a: A.cle, b: B.cle, sorte });
  }
  return out;
}
// Ses gestes, sur l'objet rangé (`{ liens, refus }`) — une copie, jamais l'objet d'avant.
export function relierFils(etat, a, b, at = new Date().toISOString()) {
  const e = etat && typeof etat === 'object' ? etat : {};
  const k = cleLien(a, b), refus = { ...(e.refus || {}) }; delete refus[k];
  return { ...e, liens: { ...(e.liens || {}), [k]: { a: String(a), b: String(b), at } }, refus };
}
export function refuserFils(etat, a, b, at = new Date().toISOString()) {
  const e = etat && typeof etat === 'object' ? etat : {};
  return { ...e, refus: { ...(e.refus || {}), [cleLien(a, b)]: at } };
}
// Délier un fil qu'il a relié : tous les liens qui touchent ces conversations partent.
export function delierFil(etat, cles) {
  const e = etat && typeof etat === 'object' ? etat : {};
  const s = new Set((cles || []).map(String));
  const liens = {};
  for (const [k, v] of Object.entries(e.liens || {})) if (!(v && (s.has(String(v.a)) || s.has(String(v.b))))) liens[k] = v;
  return { ...e, liens };
}

// ── Les messages d'un fil, dans l'ordre, chacun avec SA plateforme ──────────
// `parConv` : [{ entree, messages: [{ t, at, deMoi }] | null }]. Un message sans
// date garde sa place DANS sa conversation (il prend la date du message d'avant de
// la même conversation) : jamais déplacé au hasard.
export function messagesDuFil(parConv) {
  const out = [];
  for (const { entree: e, messages } of (Array.isArray(parConv) ? parConv : [])) {
    if (!e || !Array.isArray(messages)) continue;
    let prec = null, rang = 0;
    for (const m of messages) {
      if (!m || !txt(m.t)) continue;
      const at = instantFil(m.at);
      const tri = at != null ? at : prec;
      if (at != null) prec = at;
      out.push({ t: String(m.t), at, tri, rang: rang++, deMoi: m.deMoi === true ? true : m.deMoi === false ? false : null, plateforme: e.plateforme, conv: e.cle });
    }
  }
  return out.sort((a, b) => (a.tri == null) - (b.tri == null) || (a.tri || 0) - (b.tri || 0) || (a.conv === b.conv ? a.rang - b.rang : a.conv.localeCompare(b.conv)));
}
// La conversation par laquelle on répond : celle du DERNIER message daté du fil
// (lu), sinon celle de la conversation bougée en dernier ; rien de daté ⇒ `null`
// (pas su : l'écran propose chaque plateforme, il ne choisit pas).
export function conversationDeReponse(fil, messages) {
  if (!fil || !Array.isArray(fil.convs) || !fil.convs.length) return null;
  if (fil.convs.length === 1) return fil.convs[0];
  const dates = (Array.isArray(messages) ? messages : []).filter((m) => m.at != null);
  if (dates.length) { const d = dates[dates.length - 1]; return fil.convs.find((c) => c.cle === d.conv) || null; }
  return fil.dernier || null;
}
