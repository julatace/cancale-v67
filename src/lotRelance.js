// ══════════════════════════════════════════════════════════════════════════════
//  OFFRE LOT AUX FAVORIS · RELANCE DES OFFRES RATÉES (21 nov. 2026, ext. 5.421.0)
//  docs/passation/2026-11-21-ext-5421.md
// ══════════════════════════════════════════════════════════════════════════════
// Julien (21 nov., choix n° 5 et 6) :
//  5. une personne aime ≥ 2 de ses articles EN VENTE (favoris lus) ⇒ dans la liste des favoris, une ligne
//     « Lot de N · prix proposé » = somme × (1 − taux du lot), JAMAIS sous la somme des planchers ; envoi sur SON clic.
//  6. un acheteur dont l'offre a été REFUSÉE ou a EXPIRÉ (lu dans les conversations) ⇒ une contre-offre N jours plus
//     tard (3 j par défaut), au-dessus du plancher, UNE seule relance par acheteur et par article, l'article toujours
//     en vente ; liste « À relancer », envoi sur SON clic (ou seul si « Relancer seul » est allumé, éteint par défaut).
// LE PLANCHER (CLAUDE.md §3) : le prix mini posé à côté du N°, sinon achat + 10 % ; ni l'un ni l'autre ⇒ PAS d'offre
// (un blanc plutôt qu'un faux : jamais une offre sous ce qu'il a payé). Tout est en CENTIMES entiers.
// Module PUR (aucun réseau, aucune horloge implicite) : le bloc <lot-relance-regle> est recopié TEL QUEL dans
// vinted-sync-extension/background.js (node scripts/audit-lot-relance.cjs --recopie) ; l'audit exécute la copie livrée.
// <lot-relance-regle> — la RÈGLE, recopiée telle quelle dans background.js (node scripts/audit-lot-relance.cjs --recopie).
const LR_TAUX_LOT_DEFAUT = 10, LR_TAUX_LOT_MIN = 1, LR_TAUX_LOT_MAX = 50;
// (22 nov., ext. 5.438 — Julien, choix 5 : « après 24 h sans achat, une relance ») : le délai PAR DÉFAUT passe de 3 j à 1 j
// (24 h) ; SON réglage (1 à 30 j) reste.
const LR_JOURS_DEFAUT = 1, LR_JOURS_MIN = 1, LR_JOURS_MAX = 30;
const LR_TAUX_RELANCE_DEFAUT = 10, LR_TAUX_RELANCE_MAX = 50;
const LR_LOT_MAX_ARTICLES = 10;
const lrEnt = (v, a, b, d) => { const n = Number(v); return Number.isInteger(n) && n >= a && n <= b ? n : d; };
// Euros lus (nombre, « 45,5 », { amount }) → centimes entiers, ou null.
function lrCentimes(v) {
  const x = v != null && typeof v === 'object' ? v.amount : v;
  if (x == null || x === '') return null;
  const n = Number(String(x).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}
// Le plancher d'UN article, en centimes : prix mini, sinon achat + 10 % (arrondi au centime SUPÉRIEUR) ; sinon null.
function lrPlancher(mini, achat) {
  const m = lrCentimes(mini); if (m != null) return { c: m, de: 'mini' };
  const a = lrCentimes(achat); if (a != null) return { c: Math.ceil(a * 110 / 100), de: 'achat' };
  return null;
}
// Ses réglages (section `lotFavoris` / `relanceOffres` de vinted_bleam, par compte).
// (22 nov., ext. 5.438 — Julien, choix 6) `actif` = « Proposer seul » : le lot part SEUL aux personnes qui aiment ≥ 2 articles
// (éteint par défaut ; allumer = SA confirmation). Éteint, le lot reste proposé sur SON toucher comme avant.
function lrReglageLot(o) { const x = o && typeof o === 'object' ? o : {}; return { actif: x.actif === true, taux: lrEnt(x.taux, LR_TAUX_LOT_MIN, LR_TAUX_LOT_MAX, LR_TAUX_LOT_DEFAUT) }; }
// (5.438) `messages` : SES versions du message joint à la relance ({pseudo}, {prix}, {article}) — tirées au hasard, jamais
// la même deux fois de suite ; aucune ⇒ la contre-offre part seule (comme avant).
function lrReglageRelance(o) { const x = o && typeof o === 'object' ? o : {}; return { actif: x.actif === true, jours: lrEnt(x.jours, LR_JOURS_MIN, LR_JOURS_MAX, LR_JOURS_DEFAUT), taux: lrEnt(x.taux, 0, LR_TAUX_RELANCE_MAX, LR_TAUX_RELANCE_DEFAUT),
  messages: (Array.isArray(x.messages) ? x.messages : []).map((t) => String(t == null ? '' : t).trim()).filter((t) => t && t.length <= 1000).slice(0, 5) }; }
// L'OFFRE LOT. `articles` : [{ itemId, prix, mini, achat }] (euros) ; `taux` en %.
// Rend { ok: true, n, somme, plancher, prix, remontee, base } (centimes) ou { ok: false, raison, items? }.
//   prix = somme × (1 − taux), arrondi à l'euro INFÉRIEUR ; sous la somme des planchers ⇒ REMONTÉ à cette somme ;
//   une remontée qui atteint la somme des prix ⇒ pas d'offre (une offre lot doit être SOUS la somme).
function lrOffreLot(articles, taux) {
  const vus = new Set(), l = [];
  for (const a of Array.isArray(articles) ? articles : []) {
    const id = String(a && a.itemId != null ? a.itemId : '');
    if (!/^\d{1,20}$/.test(id) || vus.has(id)) continue;
    vus.add(id); l.push(a);
  }
  if (l.length < 2) return { ok: false, raison: 'un_seul' };
  if (l.length > LR_LOT_MAX_ARTICLES) return { ok: false, raison: 'trop' };
  const t = lrEnt(taux, LR_TAUX_LOT_MIN, LR_TAUX_LOT_MAX, null);
  if (t == null) return { ok: false, raison: 'taux' };
  let somme = 0, plancher = 0; const sansPrix = [], sansPlancher = [];
  for (const a of l) {
    const p = lrCentimes(a.prix), pl = lrPlancher(a.mini, a.achat);
    if (p == null) sansPrix.push(String(a.itemId)); else somme += p;
    if (!pl) sansPlancher.push(String(a.itemId)); else plancher += pl.c;
  }
  if (sansPrix.length) return { ok: false, raison: 'prix_inconnu', items: sansPrix };
  if (sansPlancher.length) return { ok: false, raison: 'plancher_inconnu', items: sansPlancher };
  const base = Math.floor(somme * (100 - t) / 100 / 100) * 100;
  let prix = base, remontee = false;
  if (prix < plancher) { prix = plancher; remontee = true; }
  if (prix >= somme) return { ok: false, raison: 'plancher_au_prix', somme, plancher };
  return { ok: true, n: l.length, somme, plancher, prix, base, remontee, taux: t };
}
// LES LOTS POSSIBLES d'une liste de favoris lus. `favoris` : [{ receiver, pseudo, itemId, prix, mini, achat, at,
// enVente }] — un favori dont l'article n'est pas PROUVÉ en vente (`enVente !== true`) ne compte pas.
// Rend [{ receiver, pseudo, items: [...], at }], les personnes à ≥ 2 articles DISTINCTS, du plus grand lot au plus petit.
function lrGroupesLot(favoris) {
  const par = new Map();
  for (const f of Array.isArray(favoris) ? favoris : []) {
    if (!f || f.enVente !== true) continue;
    const r = String(f.receiver == null ? '' : f.receiver), it = String(f.itemId == null ? '' : f.itemId);
    if (!/^\d{1,20}$/.test(r) || !/^\d{1,20}$/.test(it)) continue;
    const g = par.get(r) || { receiver: r, pseudo: '', items: [], vus: new Set(), at: 0 };
    if (!g.pseudo && f.pseudo) g.pseudo = String(f.pseudo).slice(0, 40);
    if (!g.vus.has(it)) { g.vus.add(it); g.items.push({ itemId: it, prix: f.prix, mini: f.mini, achat: f.achat, titre: f.titre || '', photo: f.photo || '' }); }
    g.at = Math.max(g.at, Number(f.at) || 0);
    par.set(r, g);
  }
  return [...par.values()].filter((g) => g.items.length >= 2).map((g) => ({ receiver: g.receiver, pseudo: g.pseudo, items: g.items.slice(0, LR_LOT_MAX_ARTICLES), at: g.at }))
    .sort((a, b) => (b.items.length - a.items.length) || (b.at - a.at) || a.receiver.localeCompare(b.receiver));
}
// L'heure d'un message de conversation (ms) ou 0.
function lrHeure(m) {
  const v = m && (m.created_at_ts != null ? m.created_at_ts : m.entity && m.entity.created_at_ts != null ? m.entity.created_at_ts : m.created_at != null ? m.created_at : m.entity && m.entity.created_at);
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : (Date.parse(v) || 0);
}
// LES OFFRES RATÉES d'une conversation lue (forme de `GET /conversations/{id}` : messages = [{ entity_type, entity }]).
//  conv : { conv, opp (id de l'acheteur), login, item, tx, cap (date de la lecture), messages }
// Rend null, ou { conv, acheteur, pseudo, item, tx, offre (centimes), etat: 'refusee'|'expiree', at, atSur, relanceVue }
//  · la DERNIÈRE offre de l'acheteur (`offer_request_message`, `user_id` = l'acheteur) ; si elle est acceptée ou encore
//    en attente ⇒ rien (ce n'est pas une offre ratée) ;
//  · refusée = statut 30 ou titre « refus/reject » ; expirée = titre « expir » ; autre ⇒ rien (« pas su » ≠ « ratée ») ;
//  · `at` = l'heure du message ; inconnue ⇒ la date de la LECTURE (l'offre est forcément d'avant : « au plus tard »,
//    `atSur: false`) ;
//  · `relanceVue` : une offre du VENDEUR (`offer_message` d'un autre que l'acheteur) APRÈS l'offre ratée — une relance
//    déjà faite (par VRM, à la main ou depuis un autre navigateur) : jamais une seconde.
function lrOffreRatee(conv) {
  const c = conv && typeof conv === 'object' ? conv : null;
  if (!c || !Array.isArray(c.messages)) return null;
  const opp = c.opp != null && c.opp !== '' ? Number(c.opp) : null;
  if (!(opp > 0)) return null;
  let der = null, iDer = -1;
  c.messages.forEach((m, i) => {
    if (!m || m.entity_type !== 'offer_request_message') return;
    const e = m.entity || {};
    if (Number(e.user_id) !== opp) return;
    der = { m, e }; iDer = i;
  });
  if (!der) return null;
  const e = der.e, titre = String(e.status_title || '');
  let etat = null;
  if (/expir/i.test(titre)) etat = 'expiree';
  else if (Number(e.status) === 30 || /refus|reject|declin/i.test(titre)) etat = 'refusee';
  if (!etat) return null;
  const offre = lrCentimes(e.price);
  if (offre == null) return null;
  const at = lrHeure(der.m), cap = Date.parse(c.cap || '') || (Number(c.cap) || 0);
  let relanceVue = false;
  for (let i = iDer + 1; i < c.messages.length; i++) {
    const m = c.messages[i];
    if (!m) continue;
    const e2 = m.entity || {};
    if ((m.entity_type === 'offer_message' || m.entity_type === 'offer_request_message') && Number(e2.user_id) !== opp) relanceVue = true;
    if (m.entity_type === 'offer_request_message' && Number(e2.user_id) === opp) relanceVue = true;
  }
  return { conv: String(c.conv || ''), acheteur: String(opp), pseudo: String(c.login || '').slice(0, 40), item: String(c.item || ''), tx: String(e.transaction_id != null ? e.transaction_id : c.tx || ''), offre, etat, at: at || cap || 0, atSur: !!at, relanceVue };
}
// LA LISTE « À RELANCER ». `ratees` : sorties de lrOffreRatee ; `ctx` :
//   { maintenant, jours, taux, deja (Set de « acheteur|item » déjà relancés), etatArticle (item → 'en_vente'|'vendu'|
//     'pas_su'), prixArticle (item → euros|null), planchers (item → { mini, achat }) }
// Rend [{ conv, acheteur, pseudo, item, tx, offre, prix, plancher, prixAnnonce, etat: 'pret'|'attente'|'ecarte',
//   raison, quand }] — une seule ligne par acheteur et par article (la plus récente).
//   prix = max(plancher, son offre, prix × (1 − taux) arrondi à l'euro inférieur) ; ≥ prix de l'annonce ⇒ écartée.
function lrRelances(ratees, ctx) {
  const x = ctx && typeof ctx === 'object' ? ctx : {};
  const maintenant = Number(x.maintenant) || 0;
  const jours = lrEnt(x.jours, LR_JOURS_MIN, LR_JOURS_MAX, LR_JOURS_DEFAUT), taux = lrEnt(x.taux, 0, LR_TAUX_RELANCE_MAX, LR_TAUX_RELANCE_DEFAUT);
  const deja = x.deja && typeof x.deja.has === 'function' ? x.deja : new Set(Array.isArray(x.deja) ? x.deja : []);
  const etatArticle = typeof x.etatArticle === 'function' ? x.etatArticle : () => 'pas_su';
  const prixArticle = typeof x.prixArticle === 'function' ? x.prixArticle : () => null;
  const planchers = typeof x.planchers === 'function' ? x.planchers : () => null;
  const une = new Map();
  for (const r of Array.isArray(ratees) ? ratees : []) {
    if (!r || !/^\d{1,20}$/.test(String(r.acheteur)) || !/^\d{1,20}$/.test(String(r.item)) || !/^[1-9]\d{0,19}$/.test(String(r.conv))) continue;
    const k = r.acheteur + '|' + r.item, av = une.get(k);
    if (!av || (Number(r.at) || 0) > (Number(av.at) || 0)) une.set(k, r);
  }
  const out = [];
  for (const [k, r] of une) {
    const ligne = { conv: r.conv, acheteur: r.acheteur, pseudo: r.pseudo, item: r.item, tx: r.tx, offre: r.offre, etatOffre: r.etat, at: r.at, atSur: r.atSur, prix: null, plancher: null, prixAnnonce: null, etat: 'ecarte', raison: '', quand: null };
    if (deja.has(k) || r.relanceVue) { ligne.raison = 'deja'; out.push(ligne); continue; }
    // (5.438) l'acheteur noté 1 étoile ou moins (note LUE) : jamais relancé.
    if (typeof x.uneEtoile === 'function' && x.uneEtoile(r.acheteur, r) === true) { ligne.raison = 'note_basse'; out.push(ligne); continue; }
    const ea = etatArticle(r.item);
    if (ea !== 'en_vente') { ligne.raison = ea === 'vendu' ? 'plus_en_vente' : 'pas_su'; out.push(ligne); continue; }
    const pa = lrCentimes(prixArticle(r.item));
    if (pa == null) { ligne.raison = 'prix_inconnu'; out.push(ligne); continue; }
    ligne.prixAnnonce = pa;
    const p0 = planchers(r.item) || {};
    const pl = lrPlancher(p0.mini, p0.achat);
    if (!pl) { ligne.raison = 'plancher_inconnu'; out.push(ligne); continue; }
    ligne.plancher = pl.c;
    // (5.438) le PALIER de SA négociation (`palier(item, offre)` : euros, la contre-offre que les paliers feraient à cette
    //    offre) remplace le taux quand il est connu ; jamais sous le plancher ni sous son offre.
    const pal = typeof x.palier === 'function' ? lrCentimes(x.palier(r.item, r.offre / 100, r)) : null;
    const cible = pal != null ? pal : Math.floor(pa * (100 - taux) / 100 / 100) * 100;
    // Une offre ACCEPTÉE sans achat : on lui repropose CE prix (celui qu'il a obtenu), jamais plus, jamais sous le plancher.
    const prix = r.etat === 'acceptee' ? Math.max(pl.c, r.offre) : Math.max(pl.c, r.offre, cible);
    if (pal != null && r.etat !== 'acceptee') ligne.palier = pal;
    if (prix >= pa) { ligne.raison = 'plancher_au_prix'; out.push(ligne); continue; }
    ligne.prix = prix;
    const quand = (Number(r.at) || 0) + jours * 86400000;
    ligne.quand = quand;
    if (!(Number(r.at) > 0)) { ligne.raison = 'date_inconnue'; out.push(ligne); continue; }
    ligne.etat = maintenant >= quand ? 'pret' : 'attente';
    // (5.438) une offre ACCEPTÉE : « il n'a pas acheté » se prouve par l'annonce LUE encore en vente APRÈS le délai
    //    (`luA` : l'heure de la lecture du dressing) — lue avant ⇒ elle attend la lecture suivante, jamais devinée.
    if (r.etat === 'acceptee' && ligne.etat === 'pret' && !(Number(x.luA) >= quand)) { ligne.etat = 'attente'; ligne.raison = 'relire'; }
    out.push(ligne);
  }
  const rang = { pret: 0, attente: 1, ecarte: 2 };
  return out.sort((a, b) => (rang[a.etat] - rang[b.etat]) || ((Number(a.quand) || 0) - (Number(b.quand) || 0)) || a.conv.localeCompare(b.conv));
}
// (22 nov., ext. 5.438 — Julien, choix 5) L'OFFRE ACCEPTÉE SANS ACHAT : la DERNIÈRE offre de l'acheteur a été ACCEPTÉE
// (statut 20 ou titre « accept ») et il n'a rien acheté depuis. « Rien acheté » ne se déduit jamais d'une absence de
// message : c'est l'ARTICLE qui le prouve — `lrRelances` ne garde la ligne que si l'annonce est LUE encore en vente
// (`etatArticle` = 'en_vente' : ni vendue, ni réservée, ni fermée). Même forme que lrOffreRatee, `etat: 'acceptee'`,
// `at` = l'heure de l'acceptation (sinon de l'offre ; inconnue ⇒ la lecture, « au plus tard »). Une offre du vendeur ou
// une nouvelle offre de l'acheteur APRÈS ⇒ `relanceVue` (jamais une seconde relance).
function lrOffreSansAchat(conv) {
  const c = conv && typeof conv === 'object' ? conv : null;
  if (!c || !Array.isArray(c.messages)) return null;
  const opp = c.opp != null && c.opp !== '' ? Number(c.opp) : null;
  if (!(opp > 0)) return null;
  let der = null, iDer = -1;
  c.messages.forEach((m, i) => { if (m && m.entity_type === 'offer_request_message' && Number((m.entity || {}).user_id) === opp) { der = m; iDer = i; } });
  if (!der) return null;
  const e = der.entity || {};
  if (!(Number(e.status) === 20 || /accept/i.test(String(e.status_title || '')))) return null;
  const offre = lrCentimes(e.price);
  if (offre == null) return null;
  const v = e.status_updated_at_ts != null ? e.status_updated_at_ts : e.accepted_at_ts;
  const tAcc = v != null && Number.isFinite(Number(v)) ? (Number(v) < 1e12 ? Number(v) * 1000 : Number(v)) : 0;
  const at = tAcc || lrHeure(der), cap = Date.parse(c.cap || '') || (Number(c.cap) || 0);
  let relanceVue = false;
  for (let i = iDer + 1; i < c.messages.length; i++) {
    const m = c.messages[i]; if (!m) continue;
    if (m.entity_type === 'offer_message' || m.entity_type === 'offer_request_message') relanceVue = true;
  }
  return { conv: String(c.conv || ''), acheteur: String(opp), pseudo: String(c.login || '').slice(0, 40), item: String(c.item || ''), tx: String(e.transaction_id != null ? e.transaction_id : c.tx || ''), offre, etat: 'acceptee', at: at || cap || 0, atSur: !!at, relanceVue };
}
// LE MESSAGE JOINT (varié) : une de SES versions, tirée par `hasard` (0 ≤ x < 1), jamais `dernier` s'il y en a une autre ;
// {pseudo} {prix} {article} remplis — un trou (variable inconnue) ⇒ cette version est sautée ; aucune ⇒ ''.
function lrMessageRelance(versions, vars, dernier, hasard) {
  const l = (Array.isArray(versions) ? versions : []).map((t) => String(t == null ? '' : t).trim()).filter(Boolean);
  const v = vars && typeof vars === 'object' ? vars : {};
  const remplir = (t) => { let trou = false; const o = t.replace(/\{(pseudo|prix|article)\}/g, (x, k) => { const s = k === 'prix' ? (Number(v.prix) > 0 ? (Number(v.prix) / 100).toFixed(2).replace('.', ',').replace(',00', '') + ' €' : '') : String(v[k] == null ? '' : v[k]).trim(); if (!s) trou = true; return s; }); return trou || /[{}]/.test(o) ? '' : o.trim(); };
  const ok = l.map(remplir).filter(Boolean);
  if (!ok.length) return '';
  const autres = ok.length > 1 ? ok.filter((t) => t !== dernier) : ok;
  const h = Number(hasard); const i = Math.min(autres.length - 1, Math.max(0, Math.floor((Number.isFinite(h) ? h : 0) * autres.length)));
  return autres[i];
}
// LE BILAN : `faites` = [{ tx, at, prix, sorte: 'relance'|'lot', items? }] (ce que VRM a envoyé SEUL ou sur son toucher) ;
// `prouvees` = Set des n° de transaction dont la VENTE est prouvée (la règle <preuve-vente-regle>), `null` = pas su.
// Une vente compte pour une relance si SA transaction (l'identité : la relance a été posée DANS cette transaction) est
// prouvée vendue — jamais par titre, jamais « à peu près ». Rend { envoyees, ventes (null = pas su), montant (centimes) }.
function lrBilan(faites, prouvees, sorte) {
  const l = (Array.isArray(faites) ? faites : []).filter((f) => f && (!sorte || f.sorte === sorte));
  if (!(prouvees && typeof prouvees.has === 'function')) return { envoyees: l.length, ventes: null, montant: null };
  let ventes = 0, montant = 0; const vus = new Set();
  for (const f of l) { const tx = String(f.tx || ''); if (!/^\d{1,20}$/.test(tx) || vus.has(tx)) continue; vus.add(tx); if (prouvees.has(tx)) { ventes++; montant += Number.isInteger(f.prix) ? f.prix : 0; } }
  return { envoyees: l.length, ventes, montant };
}
// LE LOT PROPOSÉ SEUL : une fois par personne ET par ensemble d'articles (la clé : la personne + les identifiants triés).
function lrCleLot(receiver, items) { return String(receiver || '') + '|' + (Array.isArray(items) ? items : []).map((x) => String(x && x.itemId != null ? x.itemId : x)).filter((x) => /^\d{1,20}$/.test(x)).sort().join(','); }
// </lot-relance-regle>
export { LR_TAUX_LOT_DEFAUT, LR_JOURS_DEFAUT, LR_TAUX_RELANCE_DEFAUT, LR_LOT_MAX_ARTICLES, lrCentimes, lrPlancher, lrReglageLot, lrReglageRelance, lrOffreLot, lrGroupesLot, lrHeure, lrOffreRatee, lrRelances, lrOffreSansAchat, lrMessageRelance, lrBilan, lrCleLot };
