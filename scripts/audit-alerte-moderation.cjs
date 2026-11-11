#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) sauf H3
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « VINTED CACHE, SUPPRIME OU RESTREINT » (11 nov., ext. 5.350)
//  node scripts/audit-alerte-moderation.cjs [--recopie] [--prouve] [--src <bg.js>]
// ════════════════════════════════════════════════════════════════════════════
//  R. LA RÈGLE (src/moderationVinted.js), EXÉCUTÉE :
//     première lecture ⇒ rien ; en ligne → masquée ⇒ UNE alerte ; vacances lues ⇒
//     rien ; tout masqué d'un coup ⇒ rien par annonce ; disparue sans suppression ⇒
//     « disparue », supprimée par lui ⇒ rien, suppressions pas sues ⇒ rien ; vendue
//     (fermée « sold »), réservée, brouillon ⇒ rien ; tout vide d'un coup ⇒ rien ;
//     jamais deux fois ; revenue ⇒ fermée ; « restreint » pas deux fois en 24 h ;
//     50 paires au même titre : l'alerte désigne l'IDENTIFIANT, jamais un titre ;
//     cartes : « vu », vente prouvée, restreint passé ⇒ hors ; lignes illisibles ⇒
//     null (jamais une alerte) ; une notification regroupée.
//  E. LE VRAI background.js dans un vm (scripts/_fond-vm.cjs) :
//     deux lectures COMPLÈTES ⇒ la ligne `moderation_vinted_111` + UN appel
//     `/api/push {action:'moderation'}` + AUCUNE requête Vinted ; relue pareille ⇒
//     rien de plus ; lecture sans `complet` (partielle) ⇒ rien ; suppression vue ⇒
//     rien ; lecture de la ligne ratée ⇒ rien écrit, et la lecture suivante le
//     retrouve ; refus « restricted » ⇒ « limité » + raison (une fois) ; profil
//     banni ⇒ « fermé » + frein 24 h posé ; rouvert ⇒ l'alerte se ferme.
//  S. LA VRAIE ROUTE api/push.js (action `moderation`) contre une fausse base :
//     UNE notification regroupée ; rappelée ⇒ rien ; trois appels ensemble ⇒ une ;
//     famille coupée ⇒ rien ; compte retiré ⇒ rien ; base illisible ⇒ 503.
//  H. heures calmes : la nuit, rien ne sonne (rangée dans la cloche).
//  C. le bloc de l'extension est la COPIE exacte du bloc de src (`--recopie` le refait).
//  J. « Ce que VRM a fait » : les événements y entrent, avec leur preuve.
//  `--prouve` : chaque mutation de la règle doit rougir un contrôle, et le
//  background.js d'origin/main (sans `guetterDressing`) rougit E.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const RACINE = path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'src', 'moderationVinted.js');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const DEBUT = '// <moderation-regle>', FIN = '// </moderation-regle>';
const argv = process.argv.slice(2);

const bloc = (txt) => { const a = txt.indexOf(DEBUT), b = txt.indexOf(FIN); return a >= 0 && b > a ? txt.slice(a, b + FIN.length) : null; };
if (argv.includes('--recopie')) {
  const s = bloc(fs.readFileSync(REGLE, 'utf8')); const bg = fs.readFileSync(BG, 'utf8'); const b = bloc(bg);
  if (!s || !b) { console.error('balises introuvables'); process.exit(1); }
  fs.writeFileSync(BG, bg.replace(b, s)); console.log('✓ bloc recopié dans background.js'); process.exit(0);
}

let ok = 0, ko = 0;
const echecs = [];
const dit = (c, m, d) => { if (c) ok++; else { ko++; echecs.push(m); } if (!process.env.AUDIT_MUET) console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
const H = 3600e3, J = 864e5;

// ── R. LA RÈGLE ──────────────────────────────────────────────────────────────
async function regle(R) {
  if (!process.env.AUDIT_MUET) console.log('\nR · la règle (src/moderationVinted.js)');
  const t0 = Date.now() - 2 * H, t1 = Date.now() - H;
  const lect = (at, etats) => ({ at, etats });
  const E = (avant, apres, x = {}) => R.evenementsDressingModeration({ avant, apres, supprimees: {}, vacances: null, ...x });
  dit(E(null, lect(t1, { 1000001: 'h' })).evenements.length === 0, 'R1 première lecture ⇒ aucune alerte (point de départ)');
  const r2 = E(lect(t0, { 1000001: 'o', 1000002: 'o' }), lect(t1, { 1000001: 'h', 1000002: 'o' }));
  dit(r2.evenements.length === 1 && r2.evenements[0].s === 'masquee' && r2.evenements[0].a === '1000001' && r2.evenements[0].av === t0, 'R2 en ligne → masquée ⇒ UNE alerte, par identifiant, avec la lecture d’avant', JSON.stringify(r2));
  dit(E(lect(t0, { 1000001: 'r' }), lect(t1, { 1000001: 'h' })).evenements.length === 1, 'R2b réservée → masquée ⇒ alerte');
  dit(E(lect(t0, { 1000001: 'o', 1000002: 'o' }), lect(t1, { 1000001: 'h', 1000002: 'o' }), { vacances: true }).evenements.length === 0, 'R3 mode vacances lu ⇒ rien');
  dit(E(lect(t0, { 1: 'x', 1000001: 'o', 1000002: 'o', 1000003: 'o' }), lect(t1, { 1000001: 'h', 1000002: 'h', 1000003: 'h' })).evenements.length === 0, 'R4 toutes les annonces masquées d’un coup ⇒ rien par annonce');
  dit(E(lect(t0, { 1000001: 'o', 1000002: 'o' }), lect(t1, { 1000001: 'h', 1000002: 'h' })).evenements.length === 2, 'R4b deux sur deux (< 3) ⇒ deux alertes');
  const r5 = E(lect(t0, { 1000001: 'o', 1000002: 'o' }), lect(t1, { 1000002: 'o' }));
  dit(r5.evenements.length === 1 && r5.evenements[0].s === 'disparue', 'R5 disparue d’une lecture complète, sans suppression ⇒ « disparue »', JSON.stringify(r5));
  dit(E(lect(t0, { 1000001: 'o', 1000002: 'o' }), lect(t1, { 1000002: 'o' }), { supprimees: { 1000001: new Date(t0).toISOString() } }).evenements.length === 0, 'R5b supprimée par lui (ou par VRM) ⇒ rien');
  dit(E(lect(t0, { 1000001: 'o', 1000002: 'o' }), lect(t1, { 1000002: 'o' }), { supprimees: null }).evenements.length === 0, 'R5c suppressions pas sues ⇒ rien (jamais d’alerte sur « pas su »)');
  dit(E(lect(t0, { 1000001: 'h', 1000002: 'o' }), lect(t1, { 1000002: 'o' })).evenements.length === 1, 'R5d masquée puis disparue ⇒ « disparue »');
  dit(E(lect(t0, { 1000001: 'o', 1000002: 'o' }), lect(t1, { 1000001: 's', 1000002: 'o' })).evenements.length === 0, 'R6 vendue (fermée « sold ») ⇒ rien');
  dit(E(lect(t0, { 1000001: 'r', 1000002: 'o' }), lect(t1, { 1000002: 'o' })).evenements.length === 0, 'R6b réservée qui disparaît ⇒ rien (vente en cours)');
  dit(E(lect(t0, { 1000001: 's', 1000003: 'c', 1000004: 'd', 1000002: 'o' }), lect(t1, { 1000002: 'o' })).evenements.length === 0, 'R6c vendue, fermée, brouillon qui disparaissent ⇒ rien');
  dit(E(lect(t0, { 1000001: 'o', 1000002: 'o', 1000003: 'o' }), lect(t1, {})).evenements.length === 0, 'R7 tout le dressing vide d’un coup ⇒ rien');
  dit(E(lect(t1, { 1000001: 'o' }), lect(t0, { 1000001: 'h' })).evenements.length === 0, 'R7b lectures dans le désordre ⇒ rien');
  // États tirés du vrai dressing
  const et = R.etatsDressingModeration([{ id: 1000001, is_hidden: true }, { id: 1000002, is_closed: true, item_closing_action: 'sold' }, { id: 1000003, is_closed: true }, { id: 1000004, is_draft: true }, { id: 1000005, is_reserved: true }, { id: 1000006 }, { id: 'abc' }]);
  dit(JSON.stringify(et) === JSON.stringify({ 1000001: 'h', 1000002: 's', 1000003: 'c', 1000004: 'd', 1000005: 'r', 1000006: 'o' }), 'R8 états lus sur le dressing (is_hidden, sold, fermée, brouillon, réservée)', JSON.stringify(et));
  // Fusion : jamais deux fois, revenue ⇒ fermée
  const ev = r2.evenements[0];
  let f = R.fusionnerModeration([], [ev], { at: t1 });
  const f2 = R.fusionnerModeration(f.liste, [{ ...ev, k: `masquee:1000001:${t1 + 1}`, t: t1 + 1 }], { at: t1 + 1 });
  dit(f.ajoutes.length === 1 && f2.ajoutes.length === 0 && f2.liste.length === 1, 'R9 la même annonce masquée vue deux fois (deux Chrome) ⇒ UNE alerte');
  const f3 = R.fusionnerModeration(f.liste, [], { etats: { 1000001: 'o' }, at: t1 + 5 });
  dit(f3.change && f3.liste[0].f === t1 + 5, 'R9b redevenue visible ⇒ alerte fermée');
  const f4 = R.fusionnerModeration(f3.liste, [{ ...ev, k: `masquee:1000001:${t1 + 9}`, t: t1 + 9 }], { at: t1 + 9 });
  dit(f4.ajoutes.length === 1, 'R9c masquée de nouveau après être revenue ⇒ nouvelle alerte');
  const rs = R.evenementCompteModeration('restreint', t0, { raison: 'listing_restricted', jusqua: t0 + 24 * H });
  const g = R.fusionnerModeration([], [rs], { at: t0 });
  const g2 = R.fusionnerModeration(g.liste, [R.evenementCompteModeration('restreint', t0 + H, {})], { at: t0 + H });
  dit(g.ajoutes.length === 1 && g2.ajoutes.length === 0 && g.liste[0].r === 'listing_restricted', 'R10 « limité » : raison gardée, pas deux fois en 24 h');
  const g3 = R.fusionnerModeration(g.liste, [R.evenementCompteModeration('restreint', t0 + 25 * H, {})], { at: t0 + 25 * H, maintenant: t0 + 25 * H });
  dit(g3.ajoutes.length === 1, 'R10c une nouvelle limite le lendemain ⇒ nouvelle alerte (la première est passée)');
  const court = R.fusionnerModeration([], [R.evenementCompteModeration('restreint', t0, { jusqua: t0 + H })], { at: t0 });
  const court2 = R.fusionnerModeration(court.liste, [R.evenementCompteModeration('restreint', t0 + 2 * H, {})], { at: t0 + 2 * H });
  dit(court2.ajoutes.length === 0, 'R10d frein court passé, nouvelle limite 2 h après ⇒ pas deux alertes en 24 h');
  const b = R.fusionnerModeration([], [R.evenementCompteModeration('banni', t0)], { at: t0 });
  const b2 = R.fusionnerModeration(b.liste, [], { compte: 'actif', at: t1 });
  dit(b.ajoutes.length === 1 && b2.liste[0].f === t1, 'R10b « fermé » puis profil actif ⇒ fermée');
  dit(R.nettoyerModeration({ k: 'x', s: 'pirate', t: 5 }) === null && R.nettoyerModeration({ k: 'masquee:1', s: 'masquee', t: 5, a: 'titre' }) === null, 'R11 entrée inconnue ou sans identifiant ⇒ rejetée');
  // 50 paires identiques (§5) : l'alerte nomme l'identifiant, le N° vient de LA fiche de cet identifiant.
  const avant50 = {}, apres50 = {};
  for (let i = 0; i < 50; i++) { avant50[2000000 + i] = 'o'; apres50[2000000 + i] = i === 37 ? 'h' : 'o'; }
  const r50 = E(lect(t0, avant50), lect(t1, apres50));
  const t50 = R.texteEvenement({ ...r50.evenements[0], compte: '111' }, { numero: '737' });
  dit(r50.evenements.length === 1 && r50.evenements[0].a === '2000037' && /N°737/.test(t50.titre) && /items\/2000037/.test(t50.lien), 'R12 50 paires au même titre : l’alerte désigne LA bonne (identifiant → N°, lien direct)', JSON.stringify(t50));
  const tSans = R.texteEvenement({ ...r50.evenements[0], compte: '111' }, {});
  dit(/2000037/.test(tSans.titre) && !/N°/.test(tSans.titre), 'R12b sans fiche : l’identifiant, jamais un N° deviné');
  // Cartes de Ma journée
  const rows = [{ id: 'moderation_vinted_111', e: [ev, { k: 'disparue:3000001:1', s: 'disparue', t: t1, a: '3000001' }, { ...rs, t: Date.now() - 30 * H, j: Date.now() - 6 * H, k: 'restreint:x' }] }, { id: 'moderation_vinted_xx', e: [ev] }];
  const act = R.alertesActives(rows, { maintenant: Date.now() });
  dit(act.length === 2 && act.every((e) => e.compte === '111'), 'R13 cartes : restreint passé hors, ligne d’un identifiant douteux ignorée', JSON.stringify(act.map((e) => e.k)));
  dit(R.alertesActives(rows, { vendues: new Set(['3000001']) }).length === 1, 'R13b « disparue » dont la vente est PROUVÉE ⇒ pas une alerte');
  dit(R.alertesActives(rows, { vu: { [`111|${ev.k}`]: Date.now() } }).length === 1, 'R13c « C’est vu » ⇒ la carte sort');
  dit(R.alertesActives(null) === null && R.evenementsDesLignes(undefined) === null, 'R13d lignes illisibles ⇒ null (jamais une alerte)');
  dit(R.alertesActives([{ id: 'moderation_vinted_111', e: [{ ...ev, t: Date.now() - 20 * J }] }]).length === 0, 'R13e plus de 14 jours ⇒ plus en tête de Ma journée');
  // Notification
  const evts = R.evenementsDesLignes(rows).filter((e) => R.estActif(e));
  const n1 = R.aNotifierModeration(evts, {}), n2 = R.aNotifierModeration(evts, Object.fromEntries(evts.map((e) => [e.cle, 1])));
  dit(n1.length === 2 && n2.length === 0, 'R14 déjà notifié ⇒ rien');
  dit(R.aNotifierModeration([{ ...evts[0], t: Date.now() - 4 * J }], {}).length === 0, 'R14b plus de 3 jours ⇒ aucune notification (pas de rattrapage tardif)');
  const tx = R.texteNotifModeration(n1, { nomCompte: () => 'shop_a' });
  dit(!!tx && /shop_a/.test(tx.title) && /1 annonce masquée/.test(tx.title) && /1 annonce disparue/.test(tx.title), 'R15 UNE notification pour le lot', JSON.stringify(tx));
  const tb = R.texteNotifModeration([{ s: 'banni', compte: '111', t: 1, cle: 'a' }, { s: 'masquee', compte: '111', t: 1, cle: 'b', a: '1000001' }], { nomCompte: () => 'shop_a' });
  dit(/compte fermé/.test(tb.title) && /Pause conseillée/.test(tb.body), 'R15b compte fermé : le plus grave d’abord, la pause conseillée');
}

// ── E. LE VRAI background.js ─────────────────────────────────────────────────
async function extension(src) {
  if (!process.env.AUDIT_MUET) console.log('\nE · le vrai background.js (vm)');
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111';
  const dressing = (items) => ({ items, pagination: { total_entries: items.length, total_pages: 1, current_page: 1 } });
  const it = (id, x = {}) => ({ id, title: 'Nike Air Max 90 blanche', price: { amount: '60.0' }, url: `https://www.vinted.fr/items/${id}`, ...x });
  const monter = (x = {}) => faireFond({ src, connecte: UID, vrm: (e) => ({ status: 200, body: { ok: true, envoye: true } }), ...x });
  const pushs = (j) => j.vrmApi.filter((e) => /\/api\/push$/.test(e.url) && e.corps && e.corps.action === 'moderation');
  const ligne = (f) => (f.lignes[`moderation_vinted_${UID}`] || {}).e || null;
  const ranger = async (f, items, opts = { complet: true }) => f.ctx.storeHarvestRow(UID, 'listings', dressing(items), 'www.vinted.fr', opts);
  await essaie('E1', async () => {
    const f = monter();
    if (typeof f.ctx.storeHarvestRow !== 'function') throw new Error('storeHarvestRow absente');
    await ranger(f, [it(1000001), it(1000002), it(1000003)]);
    dit(ligne(f) === null && pushs(f.j).length === 0, 'E1 première lecture complète ⇒ rien rangé, rien envoyé');
    await ranger(f, [it(1000001, { is_hidden: true }), it(1000002), it(1000003)]);
    const l = ligne(f) || [];
    dit(l.length === 1 && l[0].s === 'masquee' && l[0].a === '1000001', 'E1 la lecture complète suivante : `is_hidden` ⇒ alerte rangée dans moderation_vinted_111', JSON.stringify(l));
    dit(pushs(f.j).length === 1, 'E1 UN appel /api/push {action:"moderation"}', JSON.stringify(f.j.vrmApi.map((e) => e.url)));
    dit(f.j.vinted.length === 0, 'E1 aucune requête Vinted de plus', String(f.j.vinted.length));
    await ranger(f, [it(1000001, { is_hidden: true }), it(1000002), it(1000003)]);
    dit((ligne(f) || []).length === 1 && pushs(f.j).length === 1, 'E2 relue pareille ⇒ ni alerte ni notification de plus');
    await ranger(f, [it(1000001), it(1000002), it(1000003)]);
    dit((ligne(f) || [])[0] && (ligne(f) || [])[0].f > 0, 'E2b redevenue visible ⇒ alerte fermée en base');
  });
  await essaie('E3', async () => {
    const f = monter();
    await ranger(f, [it(1000001), it(1000002)]);
    await ranger(f, [it(1000001, { is_hidden: true }), it(1000002)], {});   // lecture SANS `complet`
    dit(ligne(f) === null && pushs(f.j).length === 0, 'E3 lecture partielle (pas `complet`) ⇒ rien');
  });
  await essaie('E4', async () => {
    const f = monter({ lignes: { [`harvest_${UID}_supprimees`]: { uid: UID, ids: { 1000002: new Date(Date.now() - H).toISOString() } } } });
    await ranger(f, [it(1000001), it(1000002), it(1000003)]);
    await ranger(f, [it(1000001), it(1000003)]);
    dit(ligne(f) === null, 'E4 disparue mais supprimée par lui ⇒ rien');
    await ranger(f, [it(1000003)]);
    const l = ligne(f) || [];
    dit(l.length === 1 && l[0].s === 'disparue' && l[0].a === '1000001', 'E4b disparue sans suppression ni vente ⇒ « disparue »', JSON.stringify(l));
  });
  await essaie('E5', async () => {
    let casse = true;
    const f = monter({ lectureKO: (u) => casse && /moderation_vinted_/.test(String(u)) });
    await ranger(f, [it(1000001), it(1000002)]);
    await ranger(f, [it(1000001, { is_hidden: true }), it(1000002)]);
    dit(ligne(f) === null && pushs(f.j).length === 0, 'E5 lecture de la ligne ratée ⇒ rien écrit, rien envoyé');
    casse = false;
    await ranger(f, [it(1000001, { is_hidden: true }), it(1000002)]);
    dit((ligne(f) || []).length === 1, 'E5b la lecture suivante le retrouve (le point de départ n’avait pas avancé)');
  });
  await essaie('E6', async () => {
    const f = monter();
    await f.ctx.poserFreinRepub(UID, { status: 403, json: { message: 'Listing restricted', code: 'listing_restricted' } });
    await f.ctx.poserFreinRepub(UID, { status: 403, json: { message: 'Listing restricted', code: 'listing_restricted' } });
    const l = ligne(f) || [];
    dit(l.length === 1 && l[0].s === 'restreint' && /restricted/i.test(l[0].r || '') && l[0].j > Date.now(), 'E6 refus « restricted » ⇒ UNE alerte « limité », raison de Vinted, jusqu’à', JSON.stringify(l));
    await f.ctx.poserFreinRepub(UID, { status: 400, json: { message: 'Titre trop long' } });
    dit((ligne(f) || []).length === 1, 'E6b refus ordinaire ⇒ aucune alerte');
  });
  await essaie('E7', async () => {
    const f = monter({ lignes: { panel_comptes_etat: { comptes: { [UID]: { etat: 'actif', at: new Date(Date.now() - 5 * H).toISOString() } } } } });
    await f.ctx.noterEtatCompte(UID, { user: { id: 5, is_account_banned: true } });
    await new Promise((r) => setTimeout(r, 20));
    await f.ctx.storeHarvestRow(UID, 'listings', dressing([]), 'www.vinted.fr', { complet: false }).catch(() => {});
    const l = ligne(f) || [];
    dit(l.length === 1 && l[0].s === 'banni', 'E7 profil banni après actif ⇒ « Vinted a fermé le compte »', JSON.stringify(l));
    dit(!!(await f.ctx.lireFreinRepub(UID)), 'E7 le frein de 24 h est posé (republication, baisses, offres auto arrêtées)');
    f.lignes.panel_comptes_etat.comptes[UID].at = new Date(Date.now() - 5 * H).toISOString();
    await f.ctx.noterEtatCompte(UID, { user: { id: 5, is_account_banned: false } });
    await new Promise((r) => setTimeout(r, 20));
    await f.ctx.storeHarvestRow(UID, 'listings', dressing([]), 'www.vinted.fr', { complet: false }).catch(() => {});
    dit(((ligne(f) || [])[0] || {}).f > 0, 'E7b rouvert ⇒ l’alerte se ferme');
  });
}

// ── S. LA VRAIE ROUTE /api/push ───────────────────────────────────────────────
async function serveur() {
  if (!process.env.AUDIT_MUET) console.log('\nS · la route /api/push, action « moderation », exécutée');
  const OWNER = '11111111-2222-3333-4444-555555555555';
  process.env.SUPABASE_URL = 'https://banc.supabase.test';
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
  const pushes = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  const { servirTable } = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js'));
  let tables, casse = false;
  const ligne = (id, data) => ({ id, owner: OWNER, data, updated_at: new Date().toISOString() });
  const compte = (uid, login) => ({ id: Number(uid), vinted_user_id: String(uid), login, domain: 'www.vinted.fr', owner: OWNER, updated_at: new Date().toISOString() });
  const remettre = (rows, comptes) => { tables = { app_data: { lignes: rows }, vinted_accounts: { lignes: comptes } }; pushes.length = 0; casse = false; };
  const fetchAvant = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const rep = (b, s = 200) => new Response(typeof b === 'string' ? b : JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/auth/v1/user') return rep({ id: OWNER, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00Z' });
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    if (casse && /moderation_vinted_/.test(decodeURIComponent(u.search))) return rep('<html>522</html>', 522);
    const t = u.pathname.replace('/rest/v1/', '');
    if (!tables[t]) return rep([]);
    let corps = null; try { corps = opts.body ? JSON.parse(opts.body) : null; } catch (_) {}
    // La VRAIE forme de PostgREST (§6.3) : `resolution=ignore-duplicates` n'écrase pas une ligne
    // qui existe déjà et ne la rend pas (tableau vide) — c'est ce qui départage deux créations.
    const pref = String((opts.headers || {}).Prefer || (opts.headers || {}).prefer || '');
    if ((opts.method || '').toUpperCase() === 'POST' && /ignore-duplicates/.test(pref) && Array.isArray(corps) && corps.every((l) => tables[t].lignes.some((x) => x.id === l.id))) return rep([], 201);
    const x = servirTable(tables[t], { methode: (opts.method || 'GET').toUpperCase(), url: u.pathname + u.search, entetes: opts.headers || {}, corps, owner: OWNER });
    return new Response(x.status === 204 || x.body == null ? null : JSON.stringify(x.body), { status: x.status, headers: x.headers });
  };
  try {
    const { default: handler } = await import('file://' + path.join(RACINE, 'api', 'push.js'));
    const appel = async () => {
      let st = 0, js = null;
      const res = { status(s) { st = s; return this; }, json(j) { js = j; return this; }, setHeader() {}, end() {} };
      await handler({ method: 'POST', headers: { authorization: 'Bearer aaa.bbb.ccc', origin: 'https://vrm.center' }, body: { action: 'moderation' } }, res);
      return { st, js };
    };
    const SUB = ligne('push_subs', { subs: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/banc', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } }], rev: 1 });
    const t = Date.now() - H;
    const MOD = ligne('moderation_vinted_111', { uid: '111', e: [{ k: `masquee:1000001:${t}`, s: 'masquee', t, a: '1000001', av: t - H }, { k: `disparue:1000002:${t}`, s: 'disparue', t, a: '1000002', av: t - H }] });
    await essaie('S1', async () => {
      remettre([SUB, MOD], [compte(111, 'shop_a')]);
      const r = await appel();
      const tout1 = pushes[0] ? pushes[0].title + ' ' + pushes[0].body : '';
      dit(r.st === 200 && pushes.length === 1 && /shop_a/.test(pushes[0].title) && /1 annonce masquée/.test(tout1) && /1 annonce disparue/.test(tout1), 'S1 deux événements ⇒ UNE notification regroupée qui nomme le compte', JSON.stringify([r, pushes]));
      dit(/journee/.test(JSON.stringify(pushes[0])), 'S1 son toucher ouvre Ma journée');
      await appel();
      dit(pushes.length === 1, 'S2 rappelée ⇒ rien de plus (jamais deux fois)', String(pushes.length));
      const mem = tables.app_data.lignes.find((x) => x.id === 'vrm_moderation_notifie');
      dit(!!mem && Object.keys(mem.data.cles || {}).length === 2, 'S2 la mémoire du serveur garde les deux clés');
    });
    await essaie('S3', async () => {
      remettre([SUB, MOD], [compte(111, 'shop_a')]);
      await Promise.all([appel(), appel(), appel()]);
      dit(pushes.length === 1, 'S3 trois appels en même temps (deux Chrome + le cron) ⇒ une seule', String(pushes.length));
    });
    await essaie('S4', async () => {
      remettre([SUB, MOD, ligne('push_prefs', { familles: { moderation: false } })], [compte(111, 'shop_a')]);
      await appel();
      dit(pushes.length === 0, 'S4 famille « Vinted cache ou limite » coupée ⇒ rien');
    });
    await essaie('S5', async () => {
      remettre([SUB, MOD, ligne('vrm_blocked_accounts', { uids: ['111'] })], [compte(111, 'shop_a')]);
      await appel();
      dit(pushes.length === 0, 'S5 compte retiré ⇒ on ne lui en parle plus');
    });
    await essaie('S6', async () => {
      remettre([SUB, MOD], [compte(111, 'shop_a')]); casse = true;
      const r = await appel();
      dit(r.st === 503 && pushes.length === 0 && !tables.app_data.lignes.some((x) => x.id === 'vrm_moderation_notifie'), 'S6 lignes illisibles ⇒ 503, rien envoyé, rien réservé', JSON.stringify(r));
    });
    await essaie('S7', async () => {
      remettre([SUB, ligne('moderation_vinted_111', { uid: '111', e: [{ k: 'masquee:1000001:1', s: 'masquee', t: Date.now() - 5 * J, a: '1000001' }] })], [compte(111, 'shop_a')]);
      await appel();
      dit(pushes.length === 0, 'S7 événement de plus de 3 jours ⇒ aucune notification');
    });
    await essaie('H1', async () => {
      const avant = process.env.VRM_NOTIF_HORLOGE;
      const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      process.env.VRM_NOTIF_HORLOGE = `${jour}T02:00:00Z`;
      remettre([SUB, MOD], [compte(111, 'shop_a')]);
      const r = await appel();
      process.env.VRM_NOTIF_HORLOGE = avant;
      const cloche = tables.app_data.lignes.find((x) => /^push_journal$/.test(x.id));
      dit(r.st === 200 && pushes.length === 0 && !!cloche && /masquée/.test(JSON.stringify(cloche.data)), 'H1 heures calmes ⇒ rien ne sonne, rangée dans la cloche', JSON.stringify([r, pushes.length]));
    });
  } finally { global.fetch = fetchAvant; }
}

// ── J. « Ce que VRM a fait » ─────────────────────────────────────────────────
async function journal() {
  if (!process.env.AUDIT_MUET) console.log('\nJ · « Ce que VRM a fait »');
  const S = await import('file://' + path.join(RACINE, 'api', '_lib', 'securite-compte.js'));
  const A = await import('file://' + path.join(RACINE, 'src', 'securiteCompte.js'));
  const evts = S.evenementsJournal({ moderation: [{ id: 'moderation_vinted_111', e: [{ k: 'masquee:1000001:5', s: 'masquee', t: 5000, a: '1000001' }, { k: 'restreint:6', s: 'restreint', t: 6000 }] }] });
  dit(evts.length === 2 && evts.every((e) => e.source === 'moderation' && e.preuve && e.resultat === 'verifier'), 'J1 les événements entrent dans le journal, avec leur preuve', JSON.stringify(evts));
  const L = A.ligneJournal(evts.find((e) => e.cle.item), { numeroDeItem: (id) => (id === '1000001' ? '42' : null) });
  dit(L.titre === 'Annonce masquée par Vinted' && L.article === 'N°42', 'J2 la ligne : « Annonce masquée par Vinted · N°42 »', JSON.stringify(L));
  dit(A.filtrerJournal(evts, { type: 'moderation' }).length === 2 && A.filtrerJournal(evts, { type: 'offres' }).length === 0, 'J3 filtre « Vinted »');
}

// ── C. LA COPIE ──────────────────────────────────────────────────────────────
function copie(src) {
  if (!process.env.AUDIT_MUET) console.log('\nC · la copie dans l’extension');
  const s = bloc(fs.readFileSync(REGLE, 'utf8')), b = bloc(fs.readFileSync(src, 'utf8'));
  dit(!!s && s === b, 'C1 le bloc de background.js est la copie exacte de src/moderationVinted.js', s && b ? 'différent' : 'balise absente');
}

async function tout({ regleFichier = REGLE, src = BG, serveurAussi = true } = {}) {
  const R = await import('file://' + regleFichier + '?v=' + Math.random());
  await regle(R);
  await extension(src);
  copie(src);
  if (serveurAussi) { await serveur(); await journal(); }
}

// ── --prouve : mutations + code d'avant ─────────────────────────────────────
const MUTATIONS = [
  ['vacances ignorées', "if (vacances === true && masquees.length) { masquees = []; raisons.push('vacances'); }", ''],
  ['tout masqué alerté', "if (masquees.length >= 3 && masquees.length === ouverts.length) { masquees = []; raisons.push('tout-masque'); }", ''],
  ['suppressions pas sues = rien', "if (disparues.length && (supprimees === null || supprimees === undefined || typeof supprimees !== 'object')) { disparues = []; raisons.push('suppressions-pas-sues'); }\n  else disparues", "if (false) {}\n  else if (supprimees) disparues"],
  ['réservée comptée disparue', "(A[id] === 'o' || A[id] === 'h') && !Object", "(A[id] === 'o' || A[id] === 'h' || A[id] === 'r') && !Object"],
  ['vendue comptée', "return /sold/i.test(String(it.item_closing_action || '')) ? 's' : 'c';", "return 'o';"],
  ['tout vide alerté', "if (disparues.length >= 3 && !restants.length) { disparues = []; raisons.push('tout-disparu'); }", ''],
  ['deux fois', "if (l.some((e) => meme(e) && ouvert(e))) continue;", ''],
  ['restreint 24 h', "if (n.s === 'restreint' && l.some((e) => meme(e) && Math.abs(n.t - e.t) < MODERATION_RESTREINT_MS)) continue;", ''],
  ['revenue pas fermée', "if (e.s === 'masquee' && st && st !== 'h') { e.f = fin; change = true; }", ''],
  ['première lecture alerte', "return rien('premiere-lecture');", "avant = { at: 0, etats: Object.fromEntries(Object.keys(apres.etats).map((k) => [k, 'o'])) };"],
  ['vu ignoré', "&& !(v[e.cle] != null)", ''],
  ['vente prouvée ignorée', "&& !(e.s === 'disparue' && vendues && vendues.has && vendues.has(e.a))", ''],
  ['notifié ignoré', "&& n[e.cle] == null", ''],
  ['pas su = []', "if (!Array.isArray(rows)) return null;\n  const out", "if (!Array.isArray(rows)) rows = [];\n  const out"],
];
async function prouver() {
  process.env.AUDIT_MUET = '1';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-moderation-'));
  const base = fs.readFileSync(REGLE, 'utf8');
  let vertes = 0;
  for (const [nom, a, b] of MUTATIONS) {
    if (!base.includes(a)) { console.log('  ❌ mutation introuvable : ' + nom); ko++; continue; }
    const f = path.join(tmp, `m-${vertes}-${Math.random().toString(36).slice(2)}.js`);
    fs.writeFileSync(f, base.replace(a, b));
    const k0 = ko; ok = 0; ko = 0; echecs.length = 0;
    await tout({ regleFichier: f, serveurAussi: false }).catch(() => { ko++; });
    const rouge = ko > 0; ko = k0;
    console.log((rouge ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » ⇒ ${rouge ? 'rouge' : 'RESTE VERTE'}`);
    if (rouge) vertes++; else ko++;
  }
  // Les garde-fous du FOND (le vrai background.js muté)
  const bg = fs.readFileSync(BG, 'utf8');
  const MUT_BG = [
    ['lecture partielle comparée', "if (capturePrevue && ecritRow !== false && type === 'listings') { try { await guetterDressing(", "if (ecritRow !== false && type === 'listings') { try { await guetterDressing("],
    ['point de départ avancé sur lecture ratée', "if (rg === null) return null;            // pas rangé : le point de départ n'avance pas\n        ouvertsApres = rg.ouverts;", "ouvertsApres = rg ? rg.ouverts : [];"],
    ['restreint sans alerte', "if (restreint) { try { await noterCompteModeration(", "if (false) { try { await noterCompteModeration("],
    ['banni sans frein', "if (sorte === 'banni') await poserFreinCompte(u);", ""],
  ];
  for (const [nom, a, b] of MUT_BG) {
    if (!bg.includes(a)) { console.log('  ❌ mutation introuvable : ' + nom); ko++; continue; }
    const f = path.join(tmp, `bg-${Math.random().toString(36).slice(2)}.js`);
    fs.writeFileSync(f, bg.replace(a, b));
    const k0 = ko; ko = 0;
    await extension(f).catch(() => { ko++; });
    const rouge = ko > 0; ko = k0;
    console.log((rouge ? '  ✅ ' : '  ❌ ') + `mutation du fond « ${nom} » ⇒ ${rouge ? 'rouge' : 'RESTE VERTE'}`);
    if (!rouge) ko++;
  }
  // Le background.js d'origin/main
  const ancien = path.join(tmp, 'background-main.js');
  try { fs.writeFileSync(ancien, cp.execFileSync('git', ['show', 'origin/main:vinted-sync-extension/background.js'], { cwd: RACINE, maxBuffer: 64 << 20 })); } catch (e) { console.log('  ❌ origin/main illisible'); ko++; }
  ok = 0; const k1 = ko; ko = 0;
  await extension(ancien).catch(() => { ko++; });
  const rougeMain = ko > 0; ko = k1;
  console.log((rougeMain ? '  ✅ ' : '  ❌ ') + `origin/main (sans guetterDressing) ⇒ E ${rougeMain ? 'rouge' : 'RESTE VERT'}`);
  if (!rougeMain) ko++;
  console.log(`\n${vertes}/${MUTATIONS.length} mutations rougissent l’audit.`);
  process.exit(ko ? 1 : 0);
}

(async () => {
  if (argv.includes('--prouve')) return prouver();
  const i = argv.indexOf('--src');
  await tout({ src: i >= 0 ? path.resolve(argv[i + 1]) : BG });
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
