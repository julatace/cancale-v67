#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  « IL Y A UN MESSAGE D'UNE XT-6 QUI NE VEUT PAS S'ENLEVER » (29 octobre)
// ════════════════════════════════════════════════════════════════════════════
//  Mesuré en lecture seule sur sa base : une conversation captée il y a des
//  semaines porte une offre au statut 10 (« en attente ») sur une annonce qui
//  n'est plus dans son dressing (lue en entier depuis). La pastille « Offre … en
//  attente » et le tri « une offre passe devant » la gardaient en TÊTE de
//  Messages, pour toujours : l'offre ne peut plus être acceptée.
//
//  Ce que l'audit EXÉCUTE (les vrais modules de src/, aucune donnée réelle) :
//   1. `annonceOffreEnVente` / `offreOuverte` (src/offresVinted.js) : une offre
//      dont l'annonce est absente d'une lecture COMPLÈTE du dressing de CE
//      compte, faite APRÈS l'offre, n'est plus ouverte. « Pas su » la garde :
//      annonce « à confirmer », masquée, brouillon, compte non lu, lecture
//      antérieure à l'offre, offre sans date, annonce inconnue.
//   2. `conversationRetiree` / `retirerConversation` / `remettreConversations`
//      (src/conversationsRetirees.js) : le geste « Retirer de la liste » —
//      identité = compte + conversation ; elle REVIENT dès qu'un message plus
//      récent arrive ; une entrée illisible ne cache rien ; bornée.
//   3. Le branchement dans l'app : la liste ET le fil passent par la même
//      règle (§11), et le geste est posé sur un clic.
//
//  `--prouve` réaffaiblit chaque règle et exige que l'audit tombe au rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RACINE = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');

const MUTATIONS = {
  'lue-avant-offre': ['src/offresVinted.js', " if (!Number.isFinite(lu) || !Number.isFinite(ts) || !(lu > ts)) return null;", " if (!Number.isFinite(lu)) return null;"],
  'a-confirmer-cache': ['src/offresVinted.js', " if (a(lecture.aConfirmer) || a(lecture.masquees) || a(lecture.brouillons)) return null;", " if (a(lecture.masquees) || a(lecture.brouillons)) return null;"],
  'compte-ko-cache': ['src/offresVinted.js', "lecture.ko && typeof lecture.ko.has === 'function' && lecture.ko.has(u)", "false"],
  'sans-date-cachee': ['src/offresVinted.js', " const nb = (v) => (v == null || v === '' ? NaN : Number(v));", " const nb = (v) => Number(v);"],
  'jamais-cachee': ['src/offresVinted.js', "annonceOffreEnVente(off, uid, lecture) === 'non' ? null : off || null", "false ? null : off || null"],
  'retiree-pour-toujours': ['src/conversationsRetirees.js', "  return actuel == null || actuel <= seuil;", "  return true;"],
  'sans-compte': ['src/conversationsRetirees.js', "export const cleConversation = (uid, id) => `${String(uid == null ? '' : uid)}_${String(id == null ? '' : id)}`;", "export const cleConversation = (uid, id) => `_${String(id == null ? '' : id)}`;"],
  'illisible-cache': ['src/conversationsRetirees.js', "  if (seuil == null) return false;", "  if (seuil == null) return true;"],
  'acheteur-juge': ['src/offresVinted.js', " if (off.side !== 'seller') return null;", ""],
  'remettre-vide-tout': ['src/conversationsRetirees.js', "(Array.isArray(cles) ? cles : Object.keys(suivant))", "((Array.isArray(cles) && cles.length) ? cles : Object.keys(suivant))"],
  'boite-seule': ['src/conversationsRetirees.js', "  for (const m of (Array.isArray(messages) ? messages : [])) {", "  for (const m of []) {"],
  'futur-retenu': ['src/conversationsRetirees.js', "if (t != null && t <= maintenant + 60000 && (max == null || t > max)) max = t;", "if (t != null && (max == null || t > max)) max = t;"],
};

async function charger(rel, mutation) {
  let src = lire(rel);
  if (mutation && mutation[0] === rel) {
    if (!src.includes(mutation[1])) throw new Error(`mutation introuvable dans ${rel} : ${mutation[1].slice(0, 60)}`);
    src = src.replace(mutation[1], mutation[2]);
  }
  if (!mutation) return import(pathToFileURL(path.join(RACINE, rel)).href);
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
}

async function lancer(mutation) {
  let ok = 0, ko = 0;
  const dit = (c, m, d = '') => { if (c) { ok++; if (!mutation) console.log('✅ ' + m); } else { ko++; if (!mutation) console.log('❌ ' + m + (d ? ' — ' + d : '')); } };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, `${nom} (a levé)`, e && e.message); } };

  let O = {}, R = {};
  await essaie('charger offresVinted.js', async () => { O = await charger('src/offresVinted.js', mutation); });
  await essaie('charger conversationsRetirees.js', async () => { R = await charger('src/conversationsRetirees.js', mutation); });

  // ── 1. L'offre d'une annonce partie ──────────────────────────────────────
  if (!mutation) console.log('── 1. Une offre sur une annonce qui n\'est plus dans le dressing');
  await essaie('offre', async () => {
    const T_OFFRE = Date.parse('2026-09-14T10:00:00Z');
    const T_LU = Date.parse('2026-10-29T07:00:00Z');
    const off = { prix: 45, tx: '901', oid: '77', ts: T_OFFRE, item: '444', side: 'seller' };
    const S = (...x) => new Set(x);
    const base = { enLigne: S('100', '101'), aConfirmer: S(), masquees: S(), brouillons: S(), lues: { '111': T_LU }, ko: S() };
    const v = (lecture, o = off, uid = '111') => O.annonceOffreEnVente(o, uid, lecture);
    dit(v(base) === 'non', "annonce absente d'une lecture complète faite APRÈS l'offre ⇒ « plus en vente »", String(v(base)));
    dit(O.offreOuverte(off, '111', base) === null, "⇒ l'offre n'est plus ouverte (ni pastille, ni tri en tête, ni Accepter)");
    dit(v({ ...base, enLigne: S('444') }) === 'oui' && O.offreOuverte(off, '111', { ...base, enLigne: S('444') }) === off, "annonce en ligne ⇒ l'offre reste ouverte");
    dit(v({ ...base, aConfirmer: S('444') }) === null, "annonce « à confirmer » (lecture trop ancienne) ⇒ pas su, l'offre reste", String(v({ ...base, aConfirmer: S('444') })));
    dit(v({ ...base, masquees: S('444') }) === null, "annonce masquée ⇒ pas su, l'offre reste");
    dit(v({ ...base, brouillons: S('444') }) === null, "annonce en brouillon ⇒ pas su, l'offre reste");
    dit(v({ ...base, ko: S('111') }) === null, "compte dont la lecture a échoué ⇒ pas su, l'offre reste", String(v({ ...base, ko: S('111') })));
    dit(v({ ...base, lues: {} }) === null, "compte jamais lu ⇒ pas su, l'offre reste");
    dit(v({ ...base, lues: { '111': T_OFFRE - 3600000 } }) === null, "dressing lu AVANT l'offre ⇒ pas su (l'annonce a pu être publiée après)", String(v({ ...base, lues: { '111': T_OFFRE - 3600000 } })));
    dit(v(base, { ...off, ts: null }) === null, "offre sans date ⇒ pas su");
    dit(v(base, { ...off, item: null }) === null && v(base, { ...off, item: 'XT-6 blanc' }) === null, "offre sans identifiant d'annonce (ou un titre) ⇒ pas su — jamais par le titre (§5)");
    dit(v(null) === null && O.offreOuverte(off, '111', null) === off, "lecture du dressing pas encore faite ⇒ l'offre reste");
    dit(v(base, off, '222') === null, "la lecture d'un AUTRE compte ne juge pas l'offre de ce compte");
    // (revue) La contre-offre d'un VENDEUR à qui il achète : l'annonce est celle du
    // vendeur, jamais dans SES dressings. Elle ne doit pas être dite « plus en vente ».
    dit(v(base, { ...off, side: 'buyer' }) === null && O.offreOuverte({ ...off, side: 'buyer' }, '111', base) !== null, "contre-offre reçue quand il est l'ACHETEUR ⇒ pas jugée, Accepter reste", String(v(base, { ...off, side: 'buyer' })));
    dit(v(base, { ...off, side: null }) === null, "côté inconnu ⇒ pas su, l'offre reste");
  });

  // ── 2. « Retirer de la liste » ───────────────────────────────────────────
  if (!mutation) console.log('── 2. Retirer une conversation de la liste');
  await essaie('retirer', async () => {
    const c = { id: 5001, updated_at: '2026-09-14T10:05:00+02:00' };
    const t = R.retirerConversation({}, '111', c, Date.parse('2026-10-29T08:00:00Z'));
    dit(R.conversationRetiree(t, '111', c) === true, 'retirée ⇒ hors de la liste');
    dit(R.conversationRetiree(t, '222', c) === false, "la même conversation sur un AUTRE compte n'est pas retirée (identité = compte + conversation)");
    dit(R.conversationRetiree(t, '111', { ...c, updated_at: '2026-10-30T09:00:00+01:00' }) === false, 'un nouveau message (date plus récente) ⇒ elle REVIENT');
    dit(R.conversationRetiree(t, '111', { id: c.id }) === true, 'boîte sans date ⇒ elle reste retirée (rien ne prouve un nouveau message)');
    dit(R.conversationRetiree({ [R.cleConversation('111', 5001)]: 'abc' }, '111', c) === false
      && R.conversationRetiree({ [R.cleConversation('111', 5001)]: { maj: 'jamais' } }, '111', c) === false, 'une entrée illisible ne cache rien');
    dit(R.conversationRetiree(null, '111', c) === false, 'table illisible ⇒ rien de caché');
    const remis = R.remettreConversations(t, [R.cleConversation('111', 5001)]);
    dit(R.conversationRetiree(remis, '111', c) === false, '« La remettre » ⇒ elle revient');
    dit(R.conversationRetiree(R.remettreConversations(t, []), '111', c) === true, 'une liste vide ne remet rien');
    dit(Object.keys(R.remettreConversations(t)).length === 0, 'sans liste, tout est remis');
    let g = {};
    for (let i = 0; i < R.RETIREES_MAX + 5; i++) g = R.retirerConversation(g, '111', { id: i, updated_at: '2026-10-01T00:00:00Z' }, Date.parse('2026-10-01T00:00:00Z') + i * 1000);
    dit(Object.keys(g).length === R.RETIREES_MAX && !g[R.cleConversation('111', 0)] && !!g[R.cleConversation('111', R.RETIREES_MAX + 4)], `bornée à ${R.RETIREES_MAX} (les plus anciennes partent)`, String(Object.keys(g).length));
    dit(Object.keys(R.retirerConversation(t, '', c)).length === 1, 'sans compte, rien de plus n\'est retiré');
    // (revue) Le fil ouvert montre un message plus récent que la boîte (sa propre
    // réponse, ou un fil lu en direct) : retirée à 19 h, la boîte relue ensuite
    // avec ce message de 18 h ne doit PAS la faire revenir — aucun message n'est
    // arrivé après le geste.
    const geste = Date.parse('2026-10-29T19:00:00+01:00');
    const fil = [{ ts: Date.parse('2026-10-20T09:00:00+02:00') }, { ts: Date.parse('2026-10-29T18:00:00+01:00') }];
    const maj = R.majAuGeste('2026-10-20T09:00:00+02:00', fil, geste);
    const tf = R.retirerConversation({}, '111', { id: 6001, updated_at: maj }, geste);
    dit(R.conversationRetiree(tf, '111', { id: 6001, updated_at: '2026-10-29T18:00:00+01:00' }) === true, 'retirée après un fil plus récent que la boîte ⇒ elle RESTE retirée à la relecture de la boîte', String(maj));
    dit(R.conversationRetiree(tf, '111', { id: 6001, updated_at: '2026-10-29T20:00:00+01:00' }) === false, '… et un message arrivé APRÈS le geste la fait revenir');
    dit(R.majAuGeste('2026-10-20T09:00:00+02:00', [{ ts: Date.parse('2099-01-01T00:00:00Z') }], geste) === new Date('2026-10-20T07:00:00Z').toISOString(), 'une date de message dans le futur (horloge décalée) n\'est pas retenue');
    dit(R.majAuGeste(null, [], geste) === null && R.majAuGeste('2026-10-20T09:00:00+02:00', null, geste) === new Date('2026-10-20T07:00:00Z').toISOString(), 'sans fil, la date de la boîte ; sans rien, aucune date');
  });

  // ── 3. Le branchement dans l'app (une règle pour la liste et le fil) ──────
  if (!mutation) console.log('── 3. L\'app passe par ces règles (§11)');
  await essaie('app', async () => {
    const APP = lire('src/App.jsx');
    dit(/offreOuverte\(offre,\s*uidC\(c\),\s*lectureOffres\)/.test(APP), 'la LISTE juge l\'offre par `offreOuverte` (lecture des annonces)');
    dit(/const offreDuFil = \(oc\) =>[\s\S]{0,400}offreOuverte\(/.test(APP), 'le FIL juge l\'offre par la même règle');
    dit(/updated_at: majAuGeste\(boite \? boite\.updated_at : \(oc\.inboxUpdatedAt \|\| null\), oc\.messages\)/.test(APP), 'le geste garde la date la plus récente de la boîte ET du fil ouvert (`majAuGeste`)');
    dit(/conversationRetiree\(convRetirees,/.test(APP) && /data-conv-retirer/.test(APP) && /data-conv-remettre/.test(APP), 'la liste écarte les conversations retirées, le fil porte « Retirer », la liste « Les remettre »');
    dit(/side:data->payload->conversation->transaction->>current_user_side/.test(APP) && /side: typeof tr\.current_user_side === 'string'/.test(APP), 'le côté (vendeur / acheteur) est lu pour la liste ET le fil');
    dit(/const offrePartieDuFil = /.test(APP) && /statutVu=close\?'Plus acceptable'/.test(APP), "la bulle de l'offre suit la règle (« Plus acceptable », jamais « En attente »)");
    dit(/\{!offrePartieDuFil\(openConv\) && <div className="vrm-chat-rapides"/.test(APP), "pas de réponse rapide « toujours disponible » sous une annonce partie");
    dit(/data-offre-retirer/.test(APP) && !/« Retirer », en haut/.test(APP), 'le bloc porte LE geste, sans renvoyer à un bouton sans texte');
    dit(/const reponseAttendue=c=>!derniereOffreClose\(c\)&&/.test(APP), "« À répondre » laisse une offre close de côté");
    dit(/\['messages','Messages', msgNonLus > 0\]/.test(APP) && /e\.detail\.k===CONVERSATIONS_RETIREES/.test(APP), 'le point « nouveau » suit le geste sans recharger');
    dit(/'vrm_conversations_retirees'/.test(APP.slice(APP.indexOf('const SYNC_KEYS'), APP.indexOf('const SYNC_KEYS') + 20000)), 'le choix est synchronisé entre ses appareils (SYNC_KEYS)');
  });
  return { ok, ko };
}

(async () => {
  if (!PROUVE) {
    const { ok, ko } = await lancer(null);
    console.log(ko ? `\n❌ audit-offre-annonce-partie : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-offre-annonce-partie : ${ok} contrôles`);
    process.exit(ko ? 1 : 0);
  }
  let attrapees = 0;
  for (const [nom, m] of Object.entries(MUTATIONS)) {
    let r;
    try { r = await lancer(m); } catch (e) { r = { ok: 0, ko: 1 }; }
    console.log(`${r.ko ? '✅ rouge' : '❌ VERT '} sous la mutation « ${nom} » (${r.ko} rouge(s))`);
    if (r.ko) attrapees++;
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(attrapees === n ? `\n✅ --prouve : ${n}/${n} mutations attrapées` : `\n❌ --prouve : ${attrapees}/${n} mutations attrapées`);
  process.exit(attrapees === n ? 0 : 1);
})();
