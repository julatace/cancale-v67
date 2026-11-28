#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  5.455.8 — LES DÉFAUTS DE LA REVUE INDÉPENDANTE (28 nov.), CHACUN EN CONTRÔLE PERMANENT
//  Vrai serveur + vrai background.js + faux Vinted (scripts/_favoris-monde-reel.cjs), et les fonctions pures du serveur.
//   V1 mauvaise transaction : la demande sans transaction, la conversation en porte une SANS article (6001, un autre article et une
//      autre personne à la relecture) ⇒ jamais d'offre dessus, rien de plus ; prouvée (CET article ET CETTE personne) ⇒ prise ;
//   V2 l'ordre de Vintex toujours (offre puis message), même avec une vieille « route apprise » ; offre refusée ou 404 ⇒ aucun
//      message (il annoncerait une offre jamais faite), SA phrase sur la rangée ; routes apprises par compte, périmées ;
//   V3 reprise d'un envoi à moitié fait : l'acheteur a répondu ⇒ rien, « l’acheteur a répondu » ; son message reconnu par
//      `sender_id` et `entity.author_id` ⇒ fait ; le message repris dit le prix de l'offre RÉELLEMENT faite ;
//   V4 un worker mort en plein envoi automatique : l'agent n'est pas « occupé » pour toujours (grâce de 4 min, puis libre),
//      le favori passe « à vérifier » ;
//   V5 un 2ᵉ lancement pendant une file en cours AJOUTE, n'annule rien ;
//   V6 réglages changés ailleurs (409) ⇒ jamais relancé avec d'autres réglages : le nouveau récapitulatif, rien ne part ;
//   V7 pause de l'agent chez VRM, par compte ; le rechargement ne touche QUE l'onglet de travail de VRM ; une offre sans date est
//      expirée par la date de sa conversation.
//  Revue 2 (re-relecture de 15887d1f8) :
//   V8 un favori automatique en file dont la réservation n'a pas eu lieu (réseau, liste d'exclusion pas lue) : jamais « occupé »
//      pour toujours — l'agent redemande lui-même (« a_reserver »), la raison est dite ;
//   V9 « Pause » de l'agent tenue par la réservation ET l'autorisation d'un favori automatique ;
//   V10 un envoi qui dépasse son bail (refusé, ou sans renouvellement réussi depuis 100 s) s'arrête AVANT sa prochaine écriture ; la grâce part du refus ;
//   V11 ni offre ni message partis ⇒ le favori reste envoyable (« Pas envoyé · la raison ») ; un message parti, jamais deux fois ;
//      l'acheteur lu dans toutes ses formes (buyer_user_id, opposite_user côté vendeur, offer_request.user_id).
//  Revue 3 (sur ac9f704f9) :
//   V12 la reprise d'un message après un redémarrage reprend le BAIL chez VRM avant d'écrire, le tient, le revérifie à l'écriture ;
//   V13 le bail se revérifie DANS la file des requêtes, au moment où l'écriture part ;
//   V14 jamais une 2ᵉ offre : notre offre reconnue sous toutes ses formes (et sans montant lisible) ; l'acheteur n'est jamais le vendeur.
//  `--prouve` : chaque mutation rend l'audit rouge. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = process.env.FAV_REVUE_RACINE ? path.resolve(process.env.FAV_REVUE_RACINE) : path.join(__dirname, '..');
const BG = 'vinted-sync-extension/background.js';
const MUTATIONS = {
  'tx-conv-sans-preuve': [BG, "if(txDeConv&&!(artTx===body.itemId&&achTx===body.recipientId))", "if(txDeConv&&artTx&&artTx!==body.itemId)"],
  'sans-tx-message-quand-meme': [BG, "    if(offreIci&&!tx){noterDiag('favori_offre_sans_transaction');return repRien(0,'offre_prix_inconnu');}\n", "    if(offreIci&&!tx){op=null;}\n"],
  // Revue 2 (re-relecture de 15887d1f8)
  'agent-occupe-file-en-attente': ['api/_lib/favoris-auto.js', "    if(j&&j.auto===true&&!g.jobs.some(x=>x.etat==='reserve')){", "    if(false){"],
  'agent-ignore-a-reserver': [BG, "const aReserver = !t.json.ajoute && t.json.etat === 'a_reserver'", "const aReserver = false && t.json.etat === 'a_reserver'"],
  'reserve-malgre-pause': ['api/_lib/favoris-file.js', "  if(j.auto&&g.auto?.pauseAgent)return {valeur:", "  if(false)return {valeur:"],
  'consomme-malgre-pause': ['api/_lib/favoris-file.js', "  if(j.auto&&g.auto?.pauseAgent)throw new RefusFavoris(", "  if(false)throw new RefusFavoris("],
  'grace-sans-refus': ['api/_lib/favoris-file.js', "const finBail=e=>Math.max(depuisBail(e),Number(e.refuseLe)||0);", "const finBail=e=>depuisBail(e);"],
  'ecrit-sur-bail-perdu': [BG, "    if (!bailFavoriVivant()) { noterDiag('favori_bail_perdu_file');", "    if (false) { noterDiag('favori_bail_perdu_file');"],
  // Revue 3 (sur ac9f704f9)
  'reprise-sans-bail': [BG, "        if (!repris || !repris.ok) { noterDiag('favori_reprise_bail_refuse');", "        if (false) { noterDiag('favori_reprise_bail_refuse');"],
  'reprise-bail-pas-tenu': [BG, "        await avecBailFavori(e.uid, jeton, suite);", "        await suite();"],
  'offre-forme-entity-offer': [BG, "en.offer && en.offer.price, en.offer && en.offer.amount,", ""],
  'offre-de-nous-sans-montant': [BG, " || (moi && auteurMessageFavori(m) === String(moi))) n++; continue; }", ") n++; continue; }"],
  'acheteur-vendeur-pris': [BG, "  const pasVendeur = (v) => (v && v !== String(moi || '') && v !== p(tr.seller_id) && v !== p(tr.seller) ? v : '');", "  const pasVendeur = (v) => v;"],
  'bail-local-sans-borne': [BG, "BAIL_LOCAL_RENOUVELLEMENT_MS = 100000,", "BAIL_LOCAL_RENOUVELLEMENT_MS = 3600000,"],
  'refus-mort-pour-toujours': ['api/_lib/favoris-file.js', "&&!(x.etat==='refuse'&&x.aucunEnvoi===true)&&(x.etat!=='refuse'||", "&&(x.etat!=='refuse'||"],
  'refus-sans-aucun-envoi': [BG, "if(!repriseMoitie)x.json.aucunEnvoi=true;return x;", "return x;"],
  'acheteur-buyer-seul': [BG, "  return p(tr.buyer_id) || p(tr.buyer) || p(tr.buyer_user_id) || (vendeur ? p(tr.opposite_user) : '')", "  return p(tr.buyer_id) || p(tr.buyer) || ('' && vendeur)"],
  'reprise-ignore-acheteur': [BG, "      if(acheteurAEcritFavori(cv.messages,body.recipientId)===true)", "      if(false)"],
  'auteur-user-id-seul': [BG, "  for (const v of [m.user_id, m.sender_id, m.author_id, e.user_id, e.sender_id, e.author_id,", "  for (const v of [m.user_id, e.user_id,"],
  'reprise-prix-affiche': [BG, "prix:op?Number(op.prix):repriseMoitie?pxFait:prixAnnonce};", "prix:op?Number(op.prix):prixAnnonce};"],
  'agent-occupe-pour-toujours': ['api/_lib/favoris-auto.js', "const enVol=(d.enCours&&!d.enCours.abandonne)||abandonRetient(d.enCours,maintenant);", "const enVol=!!d.enCours;"],
  'sans-grace': ['api/_lib/favoris-file.js', "  if(abandonRetient(d.enCours,maintenant))return {valeur:{vue:vueFile(d,owner)}};", ''],
  'lancement-annule': ['api/_lib/favoris-file.js', "  if(!g.active&&g.jobs.some(j=>j.etat==='attente'))", "  if(g.jobs.some(j=>j.etat==='attente'))"],
  'relance-reglages': [BG, "return { ok: false, code: 'reglages_changes',", "if (f2.ok && f2.apercu) { reglagesL = f2.apercu.reglages; r = await apiFavorisCarte(o.uid, 'lancer', { selection: sel, reglages: reglagesL, confirme: true }); } if (r.ok) {} else return { ok: false, code: 'reglages_changes',"],
  'pause-locale': ['api/_lib/favoris-auto.js', "  if(a.pauseAgent)return {etat:'pause_agent'};", ''],
  'recharge-son-onglet': [BG, "  if (id == null) return false;\n  if (!pg.refus && pg.tabId !== id) return false;", "  if (!pg.refus) id = pg.tabId;\n  if (id == null) return false;"],
  'offre-sans-date-eternelle': ['src/offresVinted.js', "  return Number.isFinite(tc) && maintenant - tc > OFFRE_VIE_MS;", "  return false;"],
};
const argMut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) { const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', timeout: 600000 }); const rouge = r.status === 1 && /❌ V\d/.test(r.stdout || ''); console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) { rate++; console.log((r.stdout || '').slice(-900)); } }
  process.exit(rate ? 1 : 0);
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 700) : '')); } };
(async () => {
  let racine = RACINE;
  if (argMut) {
    const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
    racine = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-revue-'));
    for (const d of ['api', 'src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(racine, d), { recursive: true, filter: (s) => !/\/captures(\/|$)|\.zip$|\.png$/.test(s) });
    fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(racine, 'node_modules'));
    fs.writeFileSync(path.join(racine, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
    const f = path.join(racine, M[0]), s = fs.readFileSync(f, 'utf8'); if (!s.includes(M[1])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
    fs.writeFileSync(f, s.split(M[1]).join(M[2]));
    process.on('exit', () => { try { fs.rmSync(racine, { recursive: true, force: true }); } catch (_) {} });
  }
  const { monde } = require('./_favoris-monde-reel.cjs');
  const UU = '00a1fdff-71a1-4c2b-9d3e-0123456789ab';
  const ACC = (m) => ({ vinted_user_id: m.UID, domain: 'www.vinted.fr', access_token: 'jeton' });
  const envoyer = async (m, id) => {
    m.h.t += 15 * 60000;
    const ap = await m.call('apercu'); const reg = ap.body && ap.body.apercu && ap.body.apercu.reglages;
    await m.call('lancer', { selection: [id], reglages: reg });
    const s = await m.call('suivant'); const t = s.body && s.body.travail;
    if (!t) return { erreur: 'pas de travail' };
    const r = await m.f.ctx.executerMessageFavori(m.UID, ACC(m), t, { manuel: true }).catch((x) => ({ erreur: String(x && x.stack || x) }));
    await m.call('terminer', { jeton: t.jeton, brut: r ? { ok: !!r.ok, data: r.json || null } : {} });
    return r && r.json ? r.json : r;
  };
  const W = (m) => m.f.j.vinted.filter((v) => v.methode !== 'GET').map((v) => ({ c: v.chemin.replace(/[0-9a-f-]{36}/, 'U'), b: v.corps || '' }));
  const reglagesPrix = (b) => b.poser('vrm_favoris_reglages_123', { version: 1, envoisActifs: false, message: 'Bonjour, je te propose {prix} !', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null });
  try {
    console.log('\nV1. La transaction de la conversation n’est prise que PROUVÉE (cet article ET cette personne)');
    for (const [nom, txConv, prouvee] of [['sans article, et sa relecture ne dit ni l’article ni la personne', 6001, false], ['prouvée par sa relecture', 6000, true]]) {
      const m = await monde(racine, { n: 1, avant: async ({ b }) => reglagesPrix(b), vinted: (e) => {
        if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') return { status: 201, body: { inquiry_id: 'q0', conversation_id: UU } };
        if (e.methode === 'GET' && e.chemin.split('?')[0] === '/messaging/main/conversations/' + UU) return { status: 200, body: { conversation: { id: UU, allow_reply: true, opposite_users: [{ id: 3000000001 }], transaction: { id: txConv }, data: {}, messages: [] } } };
        // 6001 relue NE DIT ni l'article ni la personne (forme jamais mesurée) : pas une preuve.
        if (e.methode === 'GET' && e.chemin === '/api/v2/items/7000000180') return { status: 200, body: { item: { id: 7000000180, price: { amount: '55.0', currency_code: 'EUR' }, is_closed: false, is_reserved: false, is_hidden: false } } };   // le prix connu : seule l'absence de transaction prouvée retient l'offre
        if (e.methode === 'GET' && e.chemin === '/api/v2/transactions/6001') return { status: 200, body: { transaction: { id: 6001, seller_id: 123, item: { price: { amount: '80.0', currency_code: 'EUR' } } } } };
        return null; } });
      const r = await envoyer(m, 'jn0'); const w = W(m);
      if (!prouvee) dit(r && r.resultat === 'refuse' && r.raison === 'offre_prix_inconnu' && !w.some((x) => /6001\/offers/.test(x.c)) && !w.some((x) => /replies$/.test(x.c)), `V1 ${nom} ⇒ aucune offre sur 6001, aucun message`, JSON.stringify({ r, w: w.map((x) => x.c) }));
      else dit(r && r.resultat === 'envoye' && w.some((x) => x.c === '/api/v2/transactions/6000/offers'), `V1 ${nom} ⇒ l’offre part sur 6000`, JSON.stringify({ r, w: w.map((x) => x.c) }));
      m.fin();
    }

    console.log('\nV2. Toujours l’offre puis le message ; une offre refusée ou absente ⇒ aucun message');
    for (const scen of ['route', 'refus', '404']) {
      const m = await monde(racine, { n: 1, store: { vrmFavorisRoutes: { offre: { route: 'apres_message', at: 1 } } }, avant: async ({ b }) => reglagesPrix(b), vinted: (e) => {
        if (e.methode === 'POST' && /\/offers$/.test(e.chemin) && scen === 'refus') return { status: 400, body: { code: 106, message: 'Offre refusée' } };
        if (e.methode === 'POST' && /\/offers$/.test(e.chemin) && scen === '404') return { status: 404, body: {} };
        return null; } });
      const r = await envoyer(m, 'jn0'); const w = W(m);
      const iO = w.findIndex((x) => /offers$/.test(x.c)), iM = w.findIndex((x) => /replies$/.test(x.c));
      const fa = (await m.f.ctx.faitsFavoris(m.UID)).jn0 || {};
      if (scen === 'route') dit(r && r.resultat === 'envoye' && iO >= 0 && iM > iO && /49,50/.test(w[iM].b), 'V2 une vieille route « message d’abord » (globale) n’est plus suivie : offre PUIS message au prix de l’offre', JSON.stringify(w.map((x) => x.c)));
      else dit(r && r.resultat === 'refuse' && iM < 0 && !fa.m && (scen === '404' || fa.refus === 'Offre refusée'), `V2 offre ${scen === '404' ? 'absente (404)' : 'refusée par Vinted'} ⇒ aucun message (il annoncerait une offre jamais faite), jamais « envoyé »`, JSON.stringify({ r, w: w.map((x) => x.c), fa }));
      m.fin();
    }
    { const m = await monde(racine, { n: 1, onglets: [{ id: 9, url: 'about:blank', status: 'complete' }], store: { vrmOngletTravail: { tabId: 9, uid: '123', maj: Date.now() } } });
      const r = await envoyer(m, 'jn0'); const rt = m.f.store.vrmFavorisRoutes;
      const src = fs.readFileSync(path.join(racine, BG), 'utf8');
      // (revue 2) plus AUCUNE route retenue : rien n'est écrit, rien n'est relu — l'ordre est toujours le même.
      dit(r && r.resultat === 'envoye' && rt === undefined && !/vrmFavorisRoutes|retenirRouteFavori|routeFavori\(/.test(src), 'V2 aucune « route apprise » : ni écrite ni lue (le chemin est toujours le même)', JSON.stringify({ r: r && r.resultat, rt }));
      m.fin(); }

    console.log('\nV3. La reprise d’un envoi à moitié fait');
    for (const forme of ['acheteur', 'moi_sender', 'moi_autheur', 'rien']) {
      const msgs = () => { const base = [{ entity_type: 'offer_request_message', user_id: 123, entity: { user_id: 123, price: { amount: '47.0' } } }];
        if (forme === 'acheteur') base.push({ entity_type: 'message', entity: { user_id: 3000000001, body: 'Non merci, trop cher' } });
        if (forme === 'moi_sender') base.push({ entity_type: 'message', sender_id: 123, content: 'Bonjour, il te plaît toujours ?' });
        if (forme === 'moi_autheur') base.push({ entity_type: 'message', entity: { author_id: 123, body: 'Bonjour, il te plaît toujours ?' } });
        return base; };
      const m = await monde(racine, { n: 1, store: { vrmFavorisFaits: { 123: { '7000000180:3000000001': { o: Date.now() - 60000 } } }, vrmFavorisFaitsN: { 123: { jn0: { o: Date.now() - 60000, px: 47 } } } }, avant: async ({ b }) => reglagesPrix(b),
        vinted: (e) => (e.methode === 'GET' && e.chemin.split('?')[0] === '/messaging/main/conversations/' + UU ? { status: 200, body: { conversation: { id: UU, allow_reply: true, opposite_users: [{ id: 3000000001 }], data: {}, messages: msgs() } } } : null) });
      const r = await envoyer(m, 'jn0'); const w = W(m).filter((x) => x.c !== '/messaging/main/inquiries');
      if (forme === 'acheteur') dit(r && r.resultat === 'ignore' && r.raison === 'acheteur_a_repondu' && !w.length, 'V3 l’acheteur a répondu ⇒ ni message ni offre, « l’acheteur a répondu »', JSON.stringify({ r, w }));
      else if (forme === 'rien') dit(r && r.resultat === 'envoye' && w.length === 1 && /replies$/.test(w[0].c) && /47( |,00)/.test(w[0].b) && !/49,50/.test(w[0].b), 'V3 repris : le message seul, au prix de l’offre RÉELLEMENT faite (47 €), jamais une 2ᵉ offre', JSON.stringify({ r, w }));
      else dit(r && r.resultat === 'envoye' && !w.length, `V3 son message reconnu par ${forme === 'moi_sender' ? '`sender_id`' : '`entity.author_id`'} ⇒ « fait », rien d’écrit`, JSON.stringify({ r, w }));
      m.fin();
    }

    const F = await import(path.join(racine, 'api', '_lib', 'favoris-file.js') + '?r=' + Math.random());
    const A = await import(path.join(racine, 'api', '_lib', 'favoris-auto.js') + '?r=' + Math.random());
    const o = 'own', T = Date.parse('2026-11-28T11:00:00Z');
    const tgt = (i) => ({ itemId: String(700 + i), recipientId: String(300 + i), notificationId: 'n' + i, initiator: 'x' });
    const app = (d, r) => r.data || d;
    const REG = { actif: true, parHeure: 15, parJour: 100, jours: [1, 2, 3, 4, 5, 6, 7], heureDebut: 0, heureFin: 24, attenteMin: 10, attenteMax: 60 };
    console.log('\nV4. Un worker mort en plein envoi automatique : l’agent n’est pas « occupé » pour toujours');
    try { let d = F.initialiserFile(null);
      d = app(d, F.lancerFile(d, { owner: o, targets: [tgt(1)], message: 'm', intervalleMinutes: 0, maintenant: T }));
      d = app(d, F.reserverFile(d, { owner: o, maintenant: T, jeton: '00000000-0000-4000-8000-000000000001' }));
      d.groupes[o].auto = { reglages: REG, allumeLe: T - 1 };
      // L'agent seul (jamais `suivant`) : son tour CONSTATE l'expiration.
      const vu = F.expirerBail(d, T + 150000);
      const e1 = A.etatAuto(d, o, T + 150000), e2 = A.etatAuto(d, o, T + 600000), e3 = A.etatAuto(d, o, T + 86400000);
      dit(vu && d.groupes[o].jobs[0].etat === 'incertain' && e1.etat === 'occupe' && e2.etat !== 'occupe' && e3.etat !== 'occupe', 'V4 expiration constatée au tour de l’agent ; « occupé » seulement pendant la grâce (4 min), puis libre ; le favori « à vérifier »', JSON.stringify({ vu, j: d.groupes[o].jobs[0].etat, e1, e2, e3 })); } catch (x) { dit(false, 'V4 expiration constatée au tour de l’agent', String(x)); }
    { let d = F.initialiserFile(null);
      d = app(d, F.lancerFile(d, { owner: o, targets: [tgt(1), tgt(2)], message: 'm', intervalleMinutes: 0, maintenant: T }));
      d = app(d, F.reserverFile(d, { owner: o, maintenant: T, jeton: '00000000-0000-4000-8000-000000000001' }));
      const r1 = F.reserverFile(d, { owner: o, maintenant: T + 150000, jeton: '00000000-0000-4000-8000-000000000002' }); d = app(d, r1);
      const r2 = F.reserverFile(d, { owner: o, maintenant: T + 200000, jeton: '00000000-0000-4000-8000-000000000003' }); d = app(d, r2);
      const r3 = F.reserverFile(d, { owner: o, maintenant: T + 250000, jeton: '00000000-0000-4000-8000-000000000004' }); d = app(d, r3);
      dit(!r1.valeur.travail && !r2.valeur.travail && r3.valeur.travail && r3.valeur.travail.notificationId === 'n2', 'V4 la tentative abandonnée retient le compte pendant sa grâce (aucune 2ᵉ écriture en même temps), puis le favori suivant part', JSON.stringify({ r1: !!r1.valeur.travail, r2: !!r2.valeur.travail, r3: r3.valeur.travail && r3.valeur.travail.notificationId })); }

    console.log('\nV5. Un 2ᵉ lancement pendant une file en cours ajoute, n’annule rien');
    { let d = F.initialiserFile(null);
      d = app(d, F.lancerFile(d, { owner: o, targets: [tgt(1), tgt(2), tgt(3)], message: 'm', intervalleMinutes: 0, maintenant: T }));
      d = app(d, F.reserverFile(d, { owner: o, maintenant: T, jeton: '00000000-0000-4000-8000-000000000001' }));
      d = app(d, F.lancerFile(d, { owner: o, targets: [tgt(4)], message: 'm', intervalleMinutes: 0, maintenant: T + 1000 }));
      const etats = d.groupes[o].jobs.map((j) => j.id + ':' + j.etat).join(' ');
      dit(etats === '701:301:reserve 702:302:attente 703:303:attente 704:304:attente', 'V5 une autre fenêtre lance un favori : les 2 en attente restent, le nouveau s’ajoute', etats); }

    console.log('\nV6. Réglages changés ailleurs (409) : jamais relancé avec des réglages qu’il n’a pas vus');
    { const m = await monde(racine, { n: 1 });
      const ap = await m.f.envoyer({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'apercu', uid: '123' }, m.sender);
      const vus = ap.apercu.reglages;
      m.b.poser('vrm_favoris_reglages_123', { version: 1, envoisActifs: false, message: 'Un tout autre message, réglé dans l’app', pourcentage: 30, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null });
      const n0 = m.vrmAppels.filter((x) => /^lancer:/.test(x)).length;
      const la = await m.f.envoyer({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'lancer', uid: '123', selection: ['jn0'], reglages: vus, confirme: true, items: [] }, m.sender);
      const lancers = m.vrmAppels.filter((x) => /^lancer:/.test(x)).slice(n0);
      const fs0 = m.fileServeur(); const jobs = fs0 ? Object.values(fs0.groupes).flatMap((g) => g.jobs || []) : [];
      dit(la && la.ok === false && la.code === 'reglages_changes' && la.apercu && la.apercu.reglages && la.apercu.reglages.pourcentage === 30 && lancers.length === 1 && !jobs.length, 'V6 le 409 rend le NOUVEAU récapitulatif (−30 %) ; aucun 2ᵉ lancement, rien en file', JSON.stringify({ code: la && la.code, lancers, jobs: jobs.length }));
      m.fin(); }

    console.log('\nV7. La pause de l’agent vit chez VRM ; le rechargement ne touche que l’onglet de VRM ; l’offre sans date');
    try { let d = F.initialiserFile(null); d.groupes[o] = { jobs: [], active: false, prochain: 0, auto: { reglages: REG, allumeLe: T - 1 } };
      d = app(d, A.pauseAgentAuto(d, { owner: o, pause: true, maintenant: T }));
      const e = A.etatAuto(d, o, T + 1000), v = F.vueFile(d, o);
      d = app(d, A.pauseAgentAuto(d, { owner: o, pause: false, maintenant: T + 2000 }));
      dit(e.etat === 'pause_agent' && v.auto && v.auto.pauseAgent === T && A.etatAuto(d, o, T + 3000).etat !== 'pause_agent', 'V7 « Pause » posée chez VRM pour le compte (tous ses Chrome la voient), « Reprendre » l’enlève', JSON.stringify({ e, p: v.auto && v.auto.pauseAgent })); } catch (x) { dit(false, 'V7 « Pause » posée chez VRM', String(x)); }
    try { const m = await monde(racine, { n: 1 });   // son onglet vinted.fr (7), AUCUN onglet de travail retenu
      let touche = 0; const t = m.f.ctx.chrome.tabs; const u0 = t.update; t.update = async (...x) => { touche++; return u0(...x); }; t.reload = async () => { touche++; };
      const r = await m.f.ctx.rechargerPageFavori(ACC(m));
      dit(r === false && touche === 0, 'V7 sans onglet de travail de VRM, son onglet à lui n’est jamais rechargé ni déplacé', JSON.stringify({ r, touche }));
      m.fin(); } catch (x) { dit(false, 'V7 son onglet jamais rechargé', String(x)); }
    { const { faireFond } = require(path.join(racine, 'scripts', '_fond-vm.cjs'));
      const maint = Date.now(), J = 86400000;
      const conv = (id, upd) => ({ payload: { conversation: { id, updated_at: new Date(maint - upd).toISOString(), opposite_user: { id: 900 }, transaction: { item_id: 7001 }, messages: [{ entity_type: 'offer_request_message', entity: { user_id: 900, status: 10, current: true, price: { amount: '60.0' }, transaction_id: 50 + id, offer_request_id: 600 + id } }] } } });
      const f = faireFond({ src: path.join(racine, BG), connecte: '123', lignes: { harvest_123_conv_1: conv(1, 30 * J), harvest_123_conv_2: conv(2, 3600000) } });
      const l = await f.ctx.offresEnAttente('123');
      const OV = await import(path.join(racine, 'src', 'offresVinted.js') + '?r=' + Math.random());
      const vieux = OV.offreVintedEnAttente(conv(1, 30 * J).payload.conversation, maint), frais = OV.offreVintedEnAttente(conv(2, 3600000).payload.conversation, maint);
      dit(l.length === 1 && l[0].conv === '2' && vieux === null && frais, 'V7 une offre SANS date ni date de lecture : expirée par la date de sa conversation (30 j), gardée si récente', JSON.stringify({ l: l.map((x) => x.conv), vieux, frais: !!frais })); }

    // ═══ Revue 2 (re-relecture de 15887d1f8) : quatre défauts neufs ═══
    console.log('\nV8. L’agent : un favori automatique en file sans réservation n’est jamais « occupé » pour toujours');
    { let d = F.initialiserFile(null);
      d.groupes[o] = { jobs: [], active: false, prochain: 0, auto: { reglages: REG, allumeLe: T - 86400000, journal: [] } };
      const choisi = { l: { id: 'n1', date: new Date(T - 3600000).toISOString() }, cible: tgt(1) };
      d = app(d, A.ajouterAuto(d, { owner: o, maintenant: T, choisi, message: 'm', offre: null }));
      const r0 = F.reserverFile(d, { owner: o, maintenant: T + 1000, jeton: '00000000-0000-4000-8000-000000000011', exclus: null }); d = app(d, r0);
      const etat0 = d.groupes[o].jobs.map((j) => j.etat).join(','), raison0 = F.vueFile(d, o).raison;
      const e1 = A.etatAuto(d, o, T + 600000), e2 = A.etatAuto(d, o, T + 86400000);
      const r1 = F.reserverFile(d, { owner: o, maintenant: T + 600000, jeton: '00000000-0000-4000-8000-000000000012', exclus: new Set() });
      dit(!r0.valeur.travail && etat0 === 'attente' && /exclusion/.test(raison0 || '') && e1.etat === 'a_reserver' && e2.etat === 'a_reserver' && r1.valeur.travail && r1.valeur.travail.notificationId === 'n1',
        'V8 liste d’exclusion pas lue ⇒ le favori ATTEND, la raison dite ; l’agent voit « a_reserver » (jamais « occupé »), et la réservation suivante part', JSON.stringify({ etat0, raison0, e1, e2, r1: !!r1.valeur.travail })); }
    try { const MIN = 60000, REGA = { actif: true, attenteMin: 10, attenteMax: 15, heureDebut: 0, heureFin: 24, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 15 };
      const m = await monde(racine, { n: 1, notifAt: (i, T0) => T0 - 20 * MIN, avant: async ({ call, h }) => { const t = h.t; h.t = t - 30 * MIN; await call('auto_regler', { reglages: REGA, confirme: true }); h.t = t; } });
      // Le 1er `suivant` de l'agent se perd (réseau) — avant : l'agent restait « occupé » pour toujours, rien ne partait.
      let perdus = 0; const f0 = m.f.ctx.fetch; m.f.ctx.fetch = async (url, op = {}) => { if (/vrm\.center\/api\/compte/.test(String(url)) && op.body && JSON.parse(op.body).action === 'suivant' && perdus < 1) { perdus++; throw new TypeError('Failed to fetch'); } return f0(url, op); };
      const vus = [];
      for (let k = 0; k < 30 && !m.f.j.vinted.some((v) => v.methode === 'POST' && /replies$/.test(v.chemin)); k++) {
        const st0 = m.f.store.vrmPiloteFavoris || {}; if (Number(st0.prochain) > m.h.t) m.h.t = Number(st0.prochain) + 1;
        const r = await m.f.ctx.piloteFavorisTick(m.h.t); vus.push(r && r.etat); m.h.t += 1000; }
      const msg = m.f.j.vinted.filter((v) => v.methode === 'POST' && /replies$/.test(v.chemin)).length;
      dit(perdus === 1 && msg === 1 && !vus.includes('occupe'), 'V8 (vrai agent) le 1er `suivant` perdu : l’agent redemande seul, le favori part — jamais « occupé »', JSON.stringify({ perdus, msg, vus }));
      m.fin(); } catch (x) { dit(false, 'V8 (vrai agent) a levé', String(x && x.stack || x)); }

    console.log('\nV9. « Pause » de l’agent : un favori automatique en file ATTEND (ni réservé, ni autorisé)');
    { let d = F.initialiserFile(null);
      d.groupes[o] = { jobs: [], active: false, prochain: 0, auto: { reglages: REG, allumeLe: T - 86400000, journal: [] } };
      d = app(d, A.ajouterAuto(d, { owner: o, maintenant: T, choisi: { l: { id: 'n1', date: new Date(T - 3600000).toISOString() }, cible: tgt(1) }, message: 'm', offre: null }));
      d = app(d, A.pauseAgentAuto(d, { owner: o, pause: true, maintenant: T + 10 }));
      const r = F.reserverFile(d, { owner: o, maintenant: T + 20, jeton: '00000000-0000-4000-8000-000000000021' }); d = app(d, r);
      const etatP = d.groupes[o].jobs.map((j) => j.etat).join(',');
      // Réservé AVANT la pause, puis « Pause » : l'autorisation est refusée (rien ne part).
      let d2 = F.initialiserFile(null);
      d2.groupes[o] = { jobs: [], active: false, prochain: 0, auto: { reglages: REG, allumeLe: T - 86400000, journal: [] } };
      d2 = app(d2, A.ajouterAuto(d2, { owner: o, maintenant: T, choisi: { l: { id: 'n1', date: new Date(T - 3600000).toISOString() }, cible: tgt(1) }, message: 'm', offre: null }));
      d2 = app(d2, F.reserverFile(d2, { owner: o, maintenant: T + 20, jeton: '00000000-0000-4000-8000-000000000022' }));
      d2 = app(d2, A.pauseAgentAuto(d2, { owner: o, pause: true, maintenant: T + 25 }));
      let refuse = ''; try { F.consommerFile(d2, { owner: o, jeton: '00000000-0000-4000-8000-000000000022', maintenant: T + 30 }); } catch (x) { refuse = x.message; }
      d = app(d, A.pauseAgentAuto(d, { owner: o, pause: false, maintenant: T + 40 }));
      const r2 = F.reserverFile(d, { owner: o, maintenant: T + 50, jeton: '00000000-0000-4000-8000-000000000023' });
      dit(!r.valeur.travail && etatP === 'attente' && /pause/i.test(refuse) && r2.valeur.travail && r2.valeur.travail.notificationId === 'n1', 'V9 en pause : ni réservé (il attend), ni autorisé s’il l’était ; « Reprendre » le libère', JSON.stringify({ travail: !!r.valeur.travail, etatP, refuse, apres: !!r2.valeur.travail })); }

    console.log('\nV10. Un envoi qui dépasse son bail s’arrête AVANT sa prochaine écriture ; la grâce part du refus');
    try { let d = F.initialiserFile(null);
      d = app(d, F.lancerFile(d, { owner: o, targets: [tgt(1), tgt(2)], message: 'm', intervalleMinutes: 0, maintenant: T }));
      const J1 = '00000000-0000-4000-8000-000000000031'; d = app(d, F.reserverFile(d, { owner: o, maintenant: T, jeton: J1 }));
      for (let t = T + 30000; t <= T + 15 * 60000; t += 30000) d = app(d, F.prolongerFile(d, { owner: o, jeton: J1, maintenant: t }));
      const ref = F.prolongerFile(d, { owner: o, jeton: J1, maintenant: T + 15.5 * 60000 }); d = app(d, ref);
      const rA = F.reserverFile(d, { owner: o, maintenant: T + 19.4 * 60000, jeton: '00000000-0000-4000-8000-000000000032' }); d = app(d, rA);
      const rB = F.reserverFile(d, { owner: o, maintenant: T + 19.6 * 60000, jeton: '00000000-0000-4000-8000-000000000033' });
      dit(ref.valeur.prolonge === false && d.enCours && d.enCours.refuseLe === T + 15.5 * 60000 && !rA.valeur.travail && rB.valeur.travail && rB.valeur.travail.notificationId === 'n2', 'V10 le renouvellement refusé (+15,5 min) est NOTÉ ; aucun autre favori avant +19,5 min (4 min après le refus), puis le suivant', JSON.stringify({ ref: ref.valeur, refuseLe: d.enCours && d.enCours.refuseLe, a: !!rA.valeur.travail, b: !!(rB.valeur.travail) })); } catch (x) { dit(false, 'V10 le renouvellement refusé est noté', String(x && x.message || x)); }
    for (const cas of ['refus409', 'muet']) {
      try { let mm = null; const m = await monde(racine, { n: 1, avant: async ({ b }) => reglagesPrix(b), vinted: (e) => {
          // « muet » : VRM injoignable pour les renouvellements, et la demande de conversation met 2 min à revenir : aucun
          //    renouvellement réussi depuis plus de 100 s (VRM abandonne à 120 s) ⇒ l'extension s'arrête d'elle-même.
          if (cas === 'muet' && mm && e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') mm.h.t += 2 * 60000;
          return null; } });
        mm = m;
        const f0 = m.f.ctx.fetch; m.f.ctx.fetch = async (url, op = {}) => { if (cas === 'muet' && /vrm\.center\/api\/compte/.test(String(url)) && op.body && JSON.parse(op.body).action === 'prolonger') throw new TypeError('Failed to fetch'); if (cas === 'refus409' && /vrm\.center\/api\/compte/.test(String(url)) && op.body && JSON.parse(op.body).action === 'prolonger') return { ok: false, status: 409, json: async () => ({ message: 'La tentative n’est plus en cours.' }) }; return f0(url, op); };
        m.h.t += 15 * 60000;
        const ap = await m.call('apercu'); await m.call('lancer', { selection: ['jn0'], reglages: ap.body.apercu.reglages });
        const s = await m.call('suivant'); const tr = s.body.travail;
        m.f.ctx.__vrmBailFavoriMs = 1;
        const r = await m.f.ctx.avecBailFavori(m.UID, tr.jeton, async () => { if (cas === 'refus409') await new Promise((ok) => setTimeout(ok, 40)); return m.f.ctx.executerMessageFavori(m.UID, ACC(m), tr, { manuel: true }); });
        const w = W(m).map((x) => x.c), reg = ((m.f.store.vrmFavorisFaits || {})['123'] || {})['7000000180:3000000001'] || {};
        dit(r && r.json && r.json.raison === 'autorisation_expiree' && !w.some((c) => /offers$|replies$/.test(c)) && !reg.m && !reg.o, `V10 ${cas === 'refus409' ? 'bail REFUSÉ par VRM (409)' : 'aucun renouvellement réussi depuis 2 min (VRM muet)'} ⇒ arrêt avant l’écriture suivante : ni offre ni message, rien au registre`, JSON.stringify({ r: r && r.json, w, reg }));
        m.fin(); } catch (x) { dit(false, 'V10 ' + cas + ' a levé', String(x && x.stack || x)); }
    }

    console.log('\nV11. Ni offre ni message partis (offre refusée, 404, transaction pas prouvée) ⇒ le favori reste envoyable');
    for (const scen of ['refus', '404']) {
      let mm = null; const m = await monde(racine, { n: 1, avant: async ({ b }) => reglagesPrix(b), vinted: (e) => {
        if (mm && e.methode === 'POST' && /\/offers$/.test(e.chemin) && mm.f.j.vinted.filter((v) => v.methode === 'POST' && /\/offers$/.test(v.chemin)).length <= 1) return scen === 'refus' ? { status: 400, body: { code: 106, message: 'Offre refusée' } } : { status: 404, body: {} };
        return null; } });
      mm = m;
      const r = await envoyer(m, 'jn0');
      const fa = ((m.f.store.vrmFavorisFaitsN || {})['123'] || {}).jn0 || {};
      m.h.t += 3600000;
      const ap2 = await m.call('apercu'); const row = ((ap2.body.apercu && ap2.body.apercu.tous) || []).find((x) => x.id === 'jn0') || {};
      const r2 = await envoyer(m, 'jn0'); const w = W(m).map((x) => x.c);
      dit(r && r.aucunEnvoi === true && row.cochable === true && row.pasEnvoye === 'offre_refusee' && (scen === 'refus' ? fa.refus === 'Offre refusée' : fa.refusStatut === 404) && r2 && r2.resultat === 'envoye' && w.filter((c) => /replies$/.test(c)).length === 1 && w.filter((c) => /offers$/.test(c)).length === 2,
        `V11 offre ${scen === 'refus' ? 'refusée (sa phrase gardée)' : '404 (« Vinted 404 » gardé)'} ⇒ « Pas envoyé · offre refusée », envoyable ; renvoyé : l’offre puis UN message`, JSON.stringify({ r, row: { c: row.cochable, p: row.pasEnvoye }, fa, r2, w }));
      m.fin();
    }
    { // Un favori dont le message est réellement PARTI ne redevient jamais envoyable (jamais deux fois).
      const m = await monde(racine, { n: 1, avant: async ({ b }) => reglagesPrix(b) });
      const r = await envoyer(m, 'jn0'); m.h.t += 3600000;
      const ap2 = await m.call('apercu'); const row = ((ap2.body.apercu && ap2.body.apercu.tous) || []).find((x) => x.id === 'jn0') || {};
      dit(r && r.resultat === 'envoye' && row.cochable === false, 'V11 un message réellement parti ⇒ jamais envoyable à nouveau', JSON.stringify({ r: r && r.resultat, c: row.cochable })); m.fin(); }
    for (const [nom, forme] of [['buyer_user_id', (tx) => ({ id: tx, item_id: 7000000180, buyer_user_id: 3000000001 })], ['opposite_user (côté vendeur)', (tx) => ({ id: tx, item_id: 7000000180, current_user_side: 'seller', opposite_user: { id: 3000000001 } })], ['offer_request.user_id', (tx) => ({ id: tx, item: { id: 7000000180 }, offer_request: { user_id: 3000000001 } })]]) {
      const m = await monde(racine, { n: 1, avant: async ({ b }) => reglagesPrix(b), vinted: (e) => {
        if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') return { status: 201, body: { inquiry_id: 'q0', conversation_id: UU } };
        if (e.methode === 'GET' && e.chemin.split('?')[0] === '/messaging/main/conversations/' + UU) return { status: 200, body: { conversation: { id: UU, allow_reply: true, opposite_users: [{ id: 3000000001 }], transaction: { id: 6000 }, data: {}, messages: [] } } };
        if (e.methode === 'GET' && e.chemin === '/api/v2/transactions/6000') return { status: 200, body: { transaction: Object.assign(forme(6000), { item_title: 'salomon XT-6' }) } };
        if (e.methode === 'GET' && e.chemin === '/api/v2/items/7000000180') return { status: 200, body: { item: { id: 7000000180, price: { amount: '55.0', currency_code: 'EUR' }, is_closed: false, is_reserved: false, is_hidden: false } } };
        return null; } });
      const r = await envoyer(m, 'jn0'); const w = W(m).map((x) => x.c);
      dit(r && r.resultat === 'envoye' && w.includes('/api/v2/transactions/6000/offers'), `V11 l’acheteur lu par \`${nom}\` ⇒ transaction prouvée, l’offre part`, JSON.stringify({ r, w })); m.fin();
    }

    // ═══ Revue 3 (sur ac9f704f9) ═══
    console.log('\nV12. La reprise d’un message après un redémarrage reprend le BAIL chez VRM avant d’écrire');
    for (const cas of ['vivant', 'expire', 'perdu_pendant']) {
      try { const m = await monde(racine, { n: 2, avant: async ({ b }) => reglagesPrix(b) });
        m.h.t += 15 * 60000;
        const ap = await m.call('apercu'); await m.call('lancer', { selection: ['jn0', 'jn1'], reglages: ap.body.apercu.reglages });
        const s1 = await m.call('suivant'); const tr = s1.body.travail;
        await m.call('consommer', { jeton: tr.jeton, version: '5.455.8' });
        // L'offre partie, le worker meurt : son attente « offre → message » reste dans le stockage (la vraie forme posée par attendreOffreMessage).
        m.f.store.vrmFavoriAttente = { [tr.jeton]: { uid: '123', convId: m.UUIDS[0], texte: 'Bonjour, je te propose 49,50 € !', variante: 1, itemId: m.ITEMS[0], recipientId: m.ACH[0], requetes: true, jusqua: m.h.t + 5000, s: 5, v: '5.455.8' } };
        m.f.store.vrmFavorisFaits = { 123: { [m.ITEMS[0] + ':' + m.ACH[0]]: { o: m.h.t } } };
        if (cas === 'expire') { m.h.t += 150000; await m.call('suivant'); }   // VRM a constaté l'abandon (120 s sans renouvellement)
        let n409 = 0; const f0 = m.f.ctx.fetch;
        if (cas === 'perdu_pendant') m.f.ctx.fetch = async (url, op = {}) => { if (/vrm\.center\/api\/compte/.test(String(url)) && op.body && JSON.parse(op.body).action === 'prolonger' && n409++ > 0) return { ok: false, status: 409, json: async () => ({ message: 'La tentative n’est plus en cours.' }) }; return f0(url, op); };
        m.f.ctx.__vrmBailFavoriMs = 1;
        await m.f.ctx.reprendreMessagesFavoris();
        const rep = m.f.j.vinted.filter((v) => v.methode === 'POST' && /replies$/.test(v.chemin)).length;
        const reg = ((m.f.store.vrmFavorisFaits || {})['123'] || {})[m.ITEMS[0] + ':' + m.ACH[0]] || {};
        const s2 = await m.call('suivant');
        const prol = m.vrmAppels.filter((x) => /^prolonger:/.test(x)).length;
        if (cas === 'expire') dit(prol === 1, 'V12 bail expiré : refusé dès la reprise (un seul « prolonger »), rien n’est tenu ni attendu', JSON.stringify(m.vrmAppels.filter((x) => /^prolonger:/.test(x))));
        if (cas === 'vivant') dit(rep === 1 && reg.m, 'V12 bail encore vivant : la reprise le reprend (renouvelé), le message part une fois', JSON.stringify({ rep, reg }));
        else dit(rep === 0 && !reg.m, `V12 ${cas === 'expire' ? 'bail déjà expiré chez VRM' : 'bail perdu PENDANT le temps d’écriture'} ⇒ rien n’est écrit, le message reste « à vérifier »`, JSON.stringify({ rep, reg, suivant: !!(s2.body && s2.body.travail) }));
        m.fin(); } catch (x) { dit(false, 'V12 ' + cas + ' a levé', String(x && x.stack || x)); }
    }

    console.log('\nV13. Le bail se revérifie DANS la file des requêtes, au moment où l’écriture part');
    try { const m = await monde(racine, { n: 1 });
      let n409 = 0; const f0 = m.f.ctx.fetch;
      m.f.ctx.fetch = async (url, op = {}) => { if (/vrm\.center\/api\/compte/.test(String(url)) && op.body && JSON.parse(op.body).action === 'prolonger') { n409++; return { ok: false, status: 409, json: async () => ({}) }; } return f0(url, op); };
      m.f.ctx.__vrmBailFavoriMs = 1;
      let libere; const bouchon = m.f.ctx.requeteVinted('api', () => new Promise((ok) => { libere = ok; }));
      const r = await m.f.ctx.avecBailFavori('123', '00000000-0000-4000-8000-0000000000c1', async () => {
        const p = m.f.ctx.vintedPageFavori({ vinted_user_id: '123', domain: 'www.vinted.fr' }, m.f.ctx.adresseMessagerieApi('www.vinted.fr', 'inquiries'), { item_ids: ['7000000180'], receiver_id: '3000000001' });
        // L'écriture est ENTRÉE dans la file (le bail était bon) ; le refus de VRM tombe pendant qu'elle attend son tour.
        for (let k = 0; k < 50 && !n409; k++) await new Promise((ok) => setTimeout(ok, 2));
        libere(); return p; });
      await bouchon;
      const post = m.f.j.vinted.filter((v) => v.methode === 'POST').length;
      dit(n409 > 0 && r && r.bailPerdu === true && post === 0, 'V13 une écriture tenue dans la file ne part pas si le bail est perdu pendant l’attente', JSON.stringify({ n409, r, post }));
      m.fin(); } catch (x) { dit(false, 'V13 a levé', String(x && x.stack || x)); }

    console.log('\nV14. Jamais une 2ᵉ offre : NOTRE offre se reconnaît sous toutes ses formes ; l’acheteur n’est jamais le vendeur');
    for (const [nom, forme] of [['entity.offer.price (sans auteur)', { entity_type: 'offer_message', entity: { offer: { price: { amount: '49.5' } } } }], ['offer_request.price (sans auteur)', { entity_type: 'offer_request_message', entity: { offer_request: { price: { amount: '49.5' } } } }], ['sans montant lisible (de nous)', { entity_type: 'offer_message', entity: { user_id: 123, statut: 'en_attente' } }]]) {
      let faite = false; const m = await monde(racine, { n: 1, avant: async ({ b }) => reglagesPrix(b), vinted: (e) => {
        if (e.methode === 'POST' && /\/offers$/.test(e.chemin)) { faite = true; return { status: 400, body: { code: 1, message: 'Erreur' } }; }   // Vinted a FAIT l'offre mais répond 400
        if (e.methode === 'GET' && e.chemin.split('?')[0] === '/messaging/main/conversations/' + UU) return { status: 200, body: { conversation: { id: UU, allow_reply: true, opposite_users: [{ id: 3000000001 }], data: {}, messages: faite ? [forme] : [] } } };
        if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') return { status: 201, body: { inquiry_id: 'q0', transaction_id: 6000, conversation_id: UU } };
        return null; } });
      await envoyer(m, 'jn0'); m.h.t += 3600000; const r2 = await envoyer(m, 'jn0');
      const off = m.f.j.vinted.filter((v) => v.methode === 'POST' && /offers$/.test(v.chemin)).length, msg = m.f.j.vinted.filter((v) => v.methode === 'POST' && /replies$/.test(v.chemin)).length;
      dit(off === 1 && msg === 0, `V14 notre offre lue par ${nom} ⇒ relancé, aucune 2ᵉ offre (ni message par-dessus)`, JSON.stringify({ off, msg, r2 }));
      m.fin();
    }
    { const m = await monde(racine, { n: 1, avant: async ({ b }) => reglagesPrix(b), vinted: (e) => {
        if (e.methode === 'GET' && e.chemin === '/api/v2/transactions/6000') return { status: 200, body: { transaction: { id: 6000, item_id: 7000000180, seller_id: 123, item_title: 'salomon XT-6', item: { id: 7000000180, price: { amount: '55.0', currency_code: 'EUR' } }, offer: { user_id: 123, price: { amount: '50.0' } } } } };
        return null; } });
      const r = await envoyer(m, 'jn0');
      dit(r && r.resultat === 'envoye' && r.raison !== 'destinataire_different', 'V14 `offer.user_id` = le VENDEUR (nous) n’est jamais pris pour l’acheteur (pas de refus « autre personne » à tort)', JSON.stringify(r)); m.fin(); }
  } catch (e) { ko++; console.log('  ❌ V0 a levé : ' + (e && e.stack || e)); }
  console.log(ko ? `❌ revue des favoris : ${ko} rouge(s), ${ok} vert(s)` : `✅ revue des favoris : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ V0 a levé : ' + (e && e.stack || e)); process.exit(1); });
