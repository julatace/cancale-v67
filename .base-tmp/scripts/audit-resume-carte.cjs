#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LE MINI-RÉSUMÉ DU MOIS DANS LA CARTE DU LOGO » (5.354, lot extension-resume)
//
//  « Ce mois : 1 340 € vendus · 42 ventes · 3 à expédier ». Ce que l'audit EXÉCUTE
//  (le VRAI background.js dans un vm, scripts/_fond-vm.cjs — §4.10) :
//   A. les chiffres sont ceux que l'app a PUBLIÉS (`widget_stats`), lus par UNE
//      requête PROJETÉE (§4.4 : jamais `select=data`), aucune requête Vinted ;
//   B. au plus UNE tentative de lecture toutes les 15 min — réussie OU ratée ;
//   C. « pas su » ⇒ null, jamais 0 (mois d'avant, colis trop vieux, lecture ratée) ;
//      « au moins » quand l'app le dit (ventes au montant pas lu, un site illisible) ;
//   D. rien n'est montré — et RIEN n'est lu — si le compte de l'onglet n'est pas
//      PROUVÉ à ce compte VRM (Vinted : sa liste ; Leboncoin : son `lbc_accounts`
//      vu sur une page « moi » ; Vestiaire : son `vc_session` ; eBay : jamais) ;
//      la copie d'un autre compte VRM ne sert jamais ;
//   E. masqué (son choix) ⇒ aucune lecture ; « Afficher » le remet ;
//   F. côté app : `aExpedierPourCarte` recopie le badge de Colis (12 h), sans
//      recompter, et l'app l'écrit bien dans `widget_stats`.
//  `--src chemin` : la même chose sur une autre copie de background.js (preuve
//  sur le code d'avant, §6.1). Tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');

let ok = 0, ko = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.stack || e).slice(0, 300)}`); } };

const MIN = 60e3, H = 3600e3;
const OWNER = 'owner-banc';
const moisDe = (ms) => { const p = {}; for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date(ms))) p[x.type] = x.value; return `${p.year}-${p.month}`; };
const widget = (x) => Object.assign({ caMois: 1340, ventesMois: 42, caMoisNonComptees: 0, enAttente: 210, online: 88, updatedAt: new Date(Date.now() - 2 * H).toISOString(),
  aExpedier: { n: 3, auMoins: false, at: Date.now() - 20 * MIN } }, x || {});
const logins = (map) => ({ owner: OWNER, at: Date.now(), map: map || { 111: 'shop_x' } });

function fond({ lignes = { widget_stats: widget() }, store = {}, ko: lectureRatee = false, uid = '111' } = {}) {
  const lectures = [];
  const f = faireFond({ lignes, store: Object.assign({ vrmLogins: logins() }, store),
    lectureKO: (u) => { if (/rest\/v1\/app_data/.test(u)) lectures.push(u); return typeof lectureRatee === 'function' ? lectureRatee(u) : lectureRatee; } });
  f.ctx.compteConnecte = async () => uid;
  f.ctx.loginDe = async (x) => (String(x) === '111' ? 'shop_x' : '');
  f.lectures = lectures;
  f.etat = (url = 'https://www.vinted.fr/member/1', tab = 7) => f.envoyer({ from: 'vrm-badge', action: 'etat' }, { tab: { id: tab, url } });
  return f;
}
const lecturesMois = (f) => f.lectures.filter((u) => /widget_stats/.test(u));

(async () => {
  console.log('A. Les chiffres publiés par l\'app, une requête projetée');
  await essaie('A', async () => {
    const f = fond();
    const e = await f.etat();
    const m = e && e.mois;
    dit(!!(e && e.ok && e.vrm && e.vrm.connecte === true), 'etat : la session du banc est connectée', JSON.stringify(e && e.vrm));
    dit(!!m && m.ca === 1340 && m.ventes === 42 && m.aExpedier === 3, 'Vinted, compte de SA liste : 1 340 € · 42 ventes · 3 à expédier', JSON.stringify(m));
    dit(!!m && m.caAuMoins === false && m.aExpedierAuMoins === false && m.raison === null, 'rien de partiel : ni « au moins », ni raison', JSON.stringify(m));
    const q = lecturesMois(f);
    dit(q.length === 1, 'UNE lecture de la base pour le résumé', String(q.length));
    dit(q.length === 1 && /select=/.test(q[0]) && !/select=data(&|$|,)/.test(q[0]) && !/[,=]data(&|$|,)/.test(q[0].split('select=')[1] || ''), 'projetée (§4.4 : jamais select=data)', q[0]);
    dit(q.length === 1 && /owner=eq\.owner-banc/.test(q[0]), 'filtrée sur le compte VRM de la session', q[0]);
    dit(!f.j.vinted.length, 'aucune requête vers Vinted', String(f.j.vinted.length));
    dit(!!m && !('lbcIds' in m) && !('vcIds' in m), 'les identifiants de comptes ne partent pas à la page', Object.keys(m || {}).join(','));
  });

  console.log('B. Au plus une tentative toutes les 15 min');
  await essaie('B', async () => {
    const f = fond();
    await f.etat(); await f.etat(); await f.etat();
    dit(lecturesMois(f).length === 1, 'trois ouvertures de la carte : une seule lecture', String(lecturesMois(f).length));
    f.store.vrmResumeCarte.tente = Date.now() - 16 * MIN;
    f.lignes.widget_stats = widget({ caMois: 1500, ventesMois: 45 });
    const e = await f.etat();
    dit(lecturesMois(f).length === 2 && e.mois && e.mois.ca === 1500, 'après 15 min : relue, le nouveau chiffre', `${lecturesMois(f).length} · ${JSON.stringify(e.mois)}`);
    // Lecture ratée, rien en mémoire : « pas su », et pas de nouvelle tentative avant 15 min.
    const g = fond({ ko: true });
    const e1 = await g.etat(); const e2 = await g.etat();
    dit(e1.mois === null && e2.mois === null, 'lecture ratée sans copie : rien affiché (pas su, jamais 0)', JSON.stringify([e1.mois, e2.mois]));
    dit(lecturesMois(g).length === 1, 'lecture ratée : pas de nouvel essai avant 15 min', String(lecturesMois(g).length));
    // Lecture ratée APRÈS une réussite : la dernière connue reste.
    const h = fond();
    await h.etat();
    h.store.vrmResumeCarte.tente = Date.now() - 16 * MIN;
    const ratee = []; h.lectures.length = 0;
    const f2 = fond({ ko: true, store: { vrmResumeCarte: h.store.vrmResumeCarte } });
    const e3 = await f2.etat();
    dit(e3.mois && e3.mois.ca === 1340, 'lecture ratée après une réussite : la dernière connue reste', JSON.stringify(e3.mois));
    void ratee;
  });

  console.log('C. Pas su ⇒ —, jamais 0 ; « au moins » quand l\'app le dit');
  await essaie('C', async () => {
    const avant = new Date(Date.now() - 40 * 86400e3).toISOString();
    const a = await fond({ lignes: { widget_stats: widget({ updatedAt: avant }) } }).etat();
    dit(a.mois && a.mois.ca === null && a.mois.ventes === null && a.mois.raison === 'mois', 'publié un autre mois : ni montant ni ventes (raison « mois »)', JSON.stringify(a.mois));
    const b = await fond({ lignes: { widget_stats: widget({ aExpedier: { n: 3, auMoins: false, at: Date.now() - 13 * H } }) } }).etat();
    dit(b.mois && b.mois.aExpedier === null && b.mois.ca === 1340, 'colis publiés il y a 13 h : « — » à expédier', JSON.stringify(b.mois));
    const c = await fond({ lignes: { widget_stats: widget({ aExpedier: undefined }) } }).etat();
    dit(c.mois && c.mois.aExpedier === null, 'aucun nombre de colis publié (app d\'avant) : « — »', JSON.stringify(c.mois));
    const d = await fond({ lignes: { widget_stats: widget({ aExpedier: { n: null, auMoins: false, at: Date.now() - MIN } }) } }).etat();
    dit(d.mois && d.mois.aExpedier === null, 'l\'app dit « pas su » pour les colis : « — », jamais 0', JSON.stringify(d.mois));
    const z = await fond({ lignes: { widget_stats: widget({ aExpedier: { n: 0, auMoins: false, at: Date.now() - MIN } }) } }).etat();
    dit(z.mois && z.mois.aExpedier === 0, 'zéro colis PUBLIÉ : 0 (un vrai zéro)', JSON.stringify(z.mois));
    const e = await fond({ lignes: { widget_stats: widget({ caMoisNonComptees: 2, aExpedier: { n: 4, auMoins: true, at: Date.now() - MIN } }) } }).etat();
    dit(e.mois && e.mois.caAuMoins === true && e.mois.aExpedierAuMoins === true, 'ventes au montant pas lu, site illisible : « au moins »', JSON.stringify(e.mois));
    const v = await fond({ lignes: {} }).etat();
    dit(v.mois && v.mois.ca === null && v.mois.raison === 'jamais', 'aucune ligne publiée : rien d\'inventé (raison « jamais »)', JSON.stringify(v.mois));
  });

  console.log('D. Le compte de l\'onglet doit être PROUVÉ à ce compte VRM');
  await essaie('D', async () => {
    const a = fond({ uid: '222' });
    const ea = await a.etat();
    dit(ea.mois === null && lecturesMois(a).length === 0, 'Vinted, compte qui n\'est pas dans SA liste : rien affiché, rien lu', `${JSON.stringify(ea.mois)} · ${lecturesMois(a).length}`);
    const b = fond({ store: { vrmLogins: { owner: 'un-autre', at: Date.now(), map: { 111: 'shop_x' } } } });
    const eb = await b.etat();
    dit(eb.mois === null && lecturesMois(b).length === 0, 'liste des comptes d\'un AUTRE compte VRM : rien affiché, rien lu', JSON.stringify(eb.mois));
    const c = fond({ store: { vrmChoixComptes: undefined } });
    c.ctx.choixCompte = async () => 'non';
    const ec = await c.etat();
    dit(ec.mois === null, 'compte ignoré (son choix) : rien affiché', JSON.stringify(ec.mois));
    const d = fond({ store: { vrmResumeCarte: { u: 'un-autre', tente: Date.now(), lu: Date.now(), rows: [{ id: 'widget_stats', ca: 99999, nv: 999, nc: 0, maj: new Date().toISOString(), ae: null }] } } });
    const ed = await d.etat();
    dit(ed.mois && ed.mois.ca === 1340 && lecturesMois(d).length === 1, 'la copie d\'un autre compte VRM ne sert jamais : relue pour CE compte', JSON.stringify(ed.mois));
    const sans = fond({ store: { __sansSession: true, vrmSession: null } });
    const es = await sans.etat();
    dit(es.mois === null && lecturesMois(sans).length === 0, 'extension pas connectée à VRM : rien affiché, rien lu', JSON.stringify(es.mois));
    // Leboncoin : son compte (vu sur une page « moi ») ⇒ oui ; un compte vu sur la fiche d'autrui ⇒ non.
    const lbcLignes = { widget_stats: widget(), lbc_accounts: { accounts: { 'lbc-account:55': { id: 'lbc-account:55', name: 'Sophie B.', session: true }, 'lbc-account:77': { id: 'lbc-account:77', name: 'Un vendeur', source: 'https://www.leboncoin.fr/profile/user-card/77' } } } };
    const l1 = fond({ lignes: lbcLignes, store: { vrmLbcTransport: { 7: { compte: 'lbc-account:55', ambigue: false } } } });
    const el1 = await l1.etat('https://www.leboncoin.fr/mes-annonces');
    dit(el1.mois && el1.mois.ca === 1340, 'Leboncoin, compte de SON lbc_accounts (page « moi ») : montré', JSON.stringify(el1.mois));
    const l2 = fond({ lignes: lbcLignes, store: { vrmLbcTransport: { 7: { compte: 'lbc-account:77', ambigue: false } } } });
    const el2 = await l2.etat('https://www.leboncoin.fr/mes-annonces');
    dit(el2.mois === null, 'Leboncoin, compte vu sur la fiche d\'autrui : rien affiché', JSON.stringify(el2.mois));
    const vcL = { widget_stats: widget(), vc_session: { id: 'vc1', comptes: { vc1: new Date().toISOString() } } };
    const v1 = fond({ lignes: vcL, store: { vrmVcOnglets: { 7: { compte: 'vc1', at: Date.now() } } } });
    const ev1 = await v1.etat('https://fr.vestiairecollective.com/');
    dit(ev1.mois && ev1.mois.ventes === 42, 'Vestiaire, compte de SON vc_session : montré', JSON.stringify(ev1.mois));
    const v2 = fond({ lignes: vcL, store: { vrmVcOnglets: { 7: { compte: 'vc9', at: Date.now() } } } });
    const ev2 = await v2.etat('https://fr.vestiairecollective.com/');
    dit(ev2.mois === null, 'Vestiaire, un autre compte dans l\'onglet : rien affiché', JSON.stringify(ev2.mois));
    const eb2 = fond();
    const ee = await eb2.etat('https://www.ebay.fr/sh/lst/active');
    dit(ee.mois === null && lecturesMois(eb2).length === 0, 'eBay (compte de l\'onglet pas su) : rien affiché, rien lu', JSON.stringify(ee.mois));
  });

  console.log('E. Masquer / afficher (son réglage, ce navigateur)');
  await essaie('E', async () => {
    const f = fond();
    const r = await f.envoyer({ from: 'vrm-badge', action: 'resumeMasque', masque: true }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    dit(r && r.ok && f.store.vrmResumeMasque === true, 'masquer : rangé dans ce navigateur', JSON.stringify(r));
    const e = await f.etat();
    dit(e.mois && e.mois.masque === true && lecturesMois(f).length === 0, 'masqué : aucune lecture, la carte le sait', `${JSON.stringify(e.mois)} · ${lecturesMois(f).length}`);
    await f.envoyer({ from: 'vrm-badge', action: 'resumeMasque', masque: false }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    const e2 = await f.etat();
    dit(f.store.vrmResumeMasque === undefined && e2.mois && e2.mois.ca === 1340, 'afficher : le résumé revient', JSON.stringify(e2.mois));
  });

  console.log('F. Côté app : le badge de Colis recopié, rien recompté');
  await essaie('F', async () => {
    const { aExpedierPourCarte } = await import(path.join(RACINE, 'src', 'resumeCarte.js'));
    const now = Date.now();
    const a = aExpedierPourCarte({ total: 3, enRetard: 1, vinted: 2, ebay: 1, leboncoin: 0, vestiaire: 0, at: now - MIN }, now);
    dit(a.n === 3 && a.auMoins === false && a.at === now - MIN, 'publication fraîche : son total, tel quel', JSON.stringify(a));
    const b = aExpedierPourCarte({ total: 3, vinted: 3, ebay: null, leboncoin: 0, vestiaire: 0, at: now - MIN }, now);
    dit(b.n === 3 && b.auMoins === true, 'eBay illisible : « au moins »', JSON.stringify(b));
    const c = aExpedierPourCarte({ total: 3, vinted: 3, ebay: 0, leboncoin: 0, vestiaire: 0, at: now - 13 * H }, now);
    dit(c.n === null, 'publication de plus de 12 h : pas su (jamais l\'ancien nombre présenté frais)', JSON.stringify(c));
    dit(aExpedierPourCarte(null, now).n === null, 'aucune publication : pas su', '');
    const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
    dit(/id: 'widget_stats', data: \{ \.\.\.data/.test(app) && /aExpedier: aExpedierPourCarte\(load\('vrm_colis_aposter', null\)\)/.test(app), 'l\'app écrit `aExpedier` dans la ligne widget_stats qu\'elle publie déjà', '');
    const iw = app.indexOf('const lireColisCarte'), ie = app.indexOf("}, [widgetBase, liveStatsVus, colisCarte]);");
    dit(iw > 0 && ie > iw, 'la publication relue AVANT l\'effet qui écrit le widget (§4.6)', `${iw} < ${ie}`);
  });

  console.log(ko ? `\n❌ audit-resume-carte : ${ok} verts, ${ko} rouges` : `\n✅ audit-resume-carte : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
