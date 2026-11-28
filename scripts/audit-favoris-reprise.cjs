#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  5.455.8 — « IRRÉPROCHABLE : SI L'AGENT NE PARVIENT PAS À LE FAIRE, IL DOIT SE DÉBROUILLER, TROUVER LE CHEMIN » (Julien, 28 nov.)
//  On EXÉCUTE la vraie route du serveur et le vrai background.js (`executerMessageFavori`, chemin des requêtes de la page) face à
//  un faux Vinted (scripts/_favoris-monde-reel.cjs), et la vraie couche de repérage (vrm-trouver.js) dans Chromium :
//   R1 la page pas prête (l'onglet de travail n'est pas sur vinted.fr) ⇒ ramené UNE fois sur vinted.fr, attendu chargé, puis
//      l'envoi part (conversation, offre, message) ;
//   R2 la boîte de l'offre absente (l'adresse de l'offre en 404) ⇒ le message d'abord, puis l'offre depuis la conversation
//      relue — une seule offre, jamais sous le plancher ; la route « message d'abord » est RETENUE : l'envoi suivant la prend
//      directement (aucun 404 tenté) ;
//   R3 pas de transaction dans la réponse de la demande ⇒ celle de la CONVERSATION relue (même article) porte l'offre ;
//   R4 un envoi à moitié fait (l'offre partie, le message pas) ⇒ repris : la conversation relue, AUCUNE 2ᵉ offre, le message
//      part une fois ; repris encore ⇒ rien ne repart ; son message déjà là ⇒ « fait », rien n'est écrit ;
//   R5 un bouton « Envoyer » sans texte (une icône) : introuvable par son nom ⇒ trouvé par le repérage (vrm-trouver.js) ;
//   R6 un vrai cul-de-sac (Vinted refuse l'offre, SA phrase) : le favori n'est pas perdu — la raison exacte est gardée sur sa
//      rangée (`faits`), rien n'est envoyé deux fois.
//  `--prouve` : chaque mutation rend l'audit rouge. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = process.env.FAV_REPRISE_RACINE ? path.resolve(process.env.FAV_REPRISE_RACINE) : path.join(__dirname, '..');
const MUTATIONS = {
  'sans-recharger': ['vinted-sync-extension/background.js', "  if(pg.refus==='onglet'&&await rechargerPageFavori(acc))pg=await pageVintedPour(acc);\n", ''],
  'offre-404-cul-de-sac': ['vinted-sync-extension/background.js', "if(!faite&&o.status===404){noterDiag('favori_offre_404_apres_message');offreApres=true;op=null;}", "if(false){}"],
  'route-oubliee': ['vinted-sync-extension/background.js', "    if(offreIci&&!offreApres&&(await routeFavori('offre'))==='apres_message'){noterDiag('favori_route_offre_apres_message');offreApres=true;}", ''],
  'sans-tx-conversation': ['vinted-sync-extension/background.js', "if(t2.tx){tx=t2.tx;txDeConv=true;", "if(false){tx=t2.tx;txDeConv=true;"],
  'reprise-cul-de-sac': ['vinted-sync-extension/background.js', "      if(deja&&deja.o){repriseMoitie=true;noterDiag('favori_req_reprise_moitie');}}", "      if(deja&&deja.o){return rep('ignore',0,'conversation_deja_contactee');}}"],
  'reprise-double-offre': ['vinted-sync-extension/background.js', "    const offreIci=offre&&!repriseMoitie;", "    const offreIci=offre;"],
  'reperage-sans-icone': ['vinted-sync-extension/vrm-trouver.js', "        ['icone', 2,", "        ['icone_', 0,"],
};
const argMut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) { const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', timeout: 600000 }); const rouge = r.status === 1 && /❌ R\d/.test(r.stdout || ''); console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) { rate++; console.log((r.stdout || '').slice(-800)); } }
  process.exit(rate ? 1 : 0);
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 700) : '')); } };
(async () => {
  let racine = RACINE;
  if (argMut) {
    const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
    racine = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-reprise-'));
    for (const d of ['api', 'src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(racine, d), { recursive: true, filter: (s) => !/\/captures(\/|$)|\.zip$|\.png$/.test(s) });
    fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(racine, 'node_modules'));
    fs.writeFileSync(path.join(racine, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
    const f = path.join(racine, M[0]), s = fs.readFileSync(f, 'utf8'); if (!s.includes(M[1])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
    fs.writeFileSync(f, s.split(M[1]).join(M[2]));
    process.on('exit', () => { try { fs.rmSync(racine, { recursive: true, force: true }); } catch (_) {} });
  }
  const { monde } = require('./_favoris-monde-reel.cjs');
  // Un envoi de bout en bout : apercu → lancer → suivant → le VRAI executerMessageFavori → terminer.
  const envoyer = async (m, id) => {
    m.h.t += 15 * 60000;   // l'envoi d'avant est loin : la pause tirée par le serveur est passée
    const ap = await m.call('apercu'); const reg = ap.body && ap.body.apercu && ap.body.apercu.reglages;
    const la = await m.call('lancer', { selection: [id], reglages: reg });
    const s = await m.call('suivant'); const t = s.body && s.body.travail;
    if (!t) return { erreur: 'pas de travail', la: la.body && la.body.message, s: s.body && (s.body.vue && s.body.vue.raison) };
    const ACC = { vinted_user_id: m.UID, domain: 'www.vinted.fr', access_token: 'jeton' };
    const r = await m.f.ctx.executerMessageFavori(m.UID, ACC, t, { manuel: true }).catch((x) => ({ erreur: String(x && x.stack || x) }));
    await m.call('terminer', { jeton: t.jeton, brut: r ? { ok: !!r.ok, data: r.json || null } : {} });
    return r && r.json ? r.json : r;
  };
  const ecr = (m) => m.f.j.vinted.filter((v) => v.methode !== 'GET').map((v) => v.chemin.replace(/[0-9a-f-]{36}/, 'UUID'));
  const corps = (m, re) => m.f.j.vinted.filter((v) => v.methode !== 'GET' && re.test(v.chemin)).map((v) => { try { return JSON.parse(v.corps); } catch (_) { return null; } });
  try {
    console.log('\nR1. La page pas prête : l’onglet de travail ramené sur vinted.fr, puis l’envoi part');
    { const m = await monde(racine, { n: 1, onglets: [{ id: 9, url: 'about:blank', status: 'complete' }], store: { vrmOngletTravail: { tabId: 9, uid: '123', maj: Date.now() } } });
      const r = await envoyer(m, 'jn0');
      dit(r && r.resultat === 'envoye' && m.f.j.diags.includes('favori_page_rechargee') && (m.f.j.navigations || []).some((x) => x.id === 9 && /vinted\.fr\/inbox/.test(x.url)) && ecr(m).join(' ') === '/messaging/main/inquiries /api/v2/transactions/6000/offers /messaging/main/conversations/UUID/replies', 'R1 la page ramenée UNE fois, attendue chargée ; conversation, offre, message partent', JSON.stringify({ r, nav: m.f.j.navigations, w: ecr(m) }));
      m.fin(); }

    console.log('\nR2. La boîte de l’offre absente (404) : le message d’abord, puis l’offre ; la route est retenue');
    { let offres = 0;
      const m = await monde(racine, { n: 2, vinted: (e) => { if (e.methode === 'POST' && /\/offers$/.test(e.chemin)) { offres++; return offres === 1 ? { status: 404, body: { code: 404, message: 'Not found' } } : { status: 200, body: { code: 0 } }; } return null; } });
      const r = await envoyer(m, 'jn0');
      const w = ecr(m), off = corps(m, /\/offers$/);
      const iMsg = w.findIndex((x) => /replies$/.test(x)), iOff = w.lastIndexOf('/api/v2/transactions/6000/offers');
      dit(r && r.resultat === 'envoye' && iMsg >= 0 && iOff > iMsg && off.length === 2 && off.every((x) => x && x.offer && x.offer.price === '49.5') && w.filter((x) => /replies$/.test(x)).length === 1, 'R2 404 sur l’offre ⇒ le message part, puis l’offre (49,50 €, jamais sous le plancher) depuis la conversation relue', JSON.stringify({ r, w }));
      const fa = (await m.f.ctx.faitsFavoris(m.UID)).jn0 || {};
      dit(Number(fa.o) > 0 && fa.px === 49.5 && Number(fa.m) > 0, 'R2 la rangée dit « Offre faite 49,50 € » et « Message envoyé »', JSON.stringify(fa));
      const routes = (m.f.store.vrmFavorisRoutes || {});
      dit(routes.offre && routes.offre.route === 'apres_message', 'R2 la route qui a marché est RETENUE (offre : après le message)', JSON.stringify(routes));
      const avant = m.f.j.vinted.length;
      const r2 = await envoyer(m, 'jn1');
      const w2 = m.f.j.vinted.slice(avant).filter((v) => v.methode !== 'GET').map((v) => v.chemin.replace(/[0-9a-f-]{36}/, 'UUID'));
      dit(r2 && r2.resultat === 'envoye' && w2.join(' ') === '/messaging/main/inquiries /messaging/main/conversations/UUID/replies /api/v2/transactions/6001/offers' && offres === 3, 'R2 l’envoi suivant prend la route apprise DIRECTEMENT : message puis offre, aucun 404 tenté', JSON.stringify({ r2, w2, offres }));
      m.fin(); }

    console.log('\nR3. Pas de transaction dans la réponse de la demande : celle de la conversation porte l’offre');
    { const UU = '00a1fdff-71a1-4c2b-9d3e-0123456789ab';
      const m = await monde(racine, { n: 1, vinted: (e) => {
        if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') return { status: 201, body: { inquiry_id: 'q0', conversation_id: UU } };
        if (e.methode === 'GET' && e.chemin.split('?')[0] === '/messaging/main/conversations/' + UU) return { status: 200, body: { conversation: { id: UU, allow_reply: true, opposite_users: [{ id: 3000000001 }], transaction: { id: 6000, item_id: 7000000180 }, data: {}, messages: [] } } };
        return null; } });
      const r = await envoyer(m, 'jn0');
      const off = corps(m, /\/offers$/);
      dit(r && r.resultat === 'envoye' && off.length === 1 && off[0].offer.price === '49.5' && m.f.j.vinted.some((v) => v.methode === 'POST' && v.chemin === '/api/v2/transactions/6000/offers') && (m.f.store.vrmFavorisRoutes || {}).transaction, 'R3 la transaction de la conversation (même article) porte l’offre ; la route est retenue', JSON.stringify({ r, w: ecr(m), routes: m.f.store.vrmFavorisRoutes }));
      m.fin(); }

    console.log('\nR4. Un envoi à moitié fait (l’offre partie, le message pas) : repris sans doublon');
    { const UU = '00a1fdff-71a1-4c2b-9d3e-0123456789ab'; let avecMonMessage = false;
      const msgs = () => [{ entity_type: 'offer_request_message', user_id: 123, entity: { user_id: 123, price: { amount: '49.5' } } }, ...(avecMonMessage ? [{ entity_type: 'message', user_id: 123, content: 'Bonjour, il te plaît toujours ?' }] : [])];
      const m = await monde(racine, { n: 1, store: { vrmFavorisFaits: { 123: { '7000000180:3000000001': { o: Date.now() - 60000 } } } }, vinted: (e) => {
        if (e.methode === 'GET' && e.chemin.split('?')[0] === '/messaging/main/conversations/' + UU) return { status: 200, body: { conversation: { id: UU, allow_reply: true, opposite_users: [{ id: 3000000001 }], data: {}, messages: msgs() } } };
        return null; } });
      const r = await envoyer(m, 'jn0');
      const w = ecr(m);
      dit(r && r.resultat === 'envoye' && !w.some((x) => /offers$/.test(x)) && w.filter((x) => /replies$/.test(x)).length === 1, 'R4 repris : AUCUNE 2ᵉ offre, le message part une fois', JSON.stringify({ r, w }));
      const reg = ((m.f.store.vrmFavorisFaits || {})['123'] || {})['7000000180:3000000001'] || {};
      dit(reg.o && reg.m, 'R4 le registre dit offre ET message faits : il ne repartira jamais', JSON.stringify(reg));
      // Le même favori relancé (un autre jour, une autre file) : rien ne repart.
      const n0 = m.f.j.vinted.filter((v) => v.methode !== 'GET').length, i0 = m.f.j.vinted.length;
      const ACC = { vinted_user_id: m.UID, domain: 'www.vinted.fr', access_token: 'jeton' };
      m.f.store.vrmFavorisFaits['123']['7000000180:3000000001'] = { o: 1 };   // comme si le worker était mort juste après l'offre…
      avecMonMessage = true;                                                     // …mais SON message était parti : la conversation le dit
      const fs0 = m.fileServeur(); const g = Object.values(fs0.groupes)[0]; for (const j of g.jobs) j.etat = 'annule';   // une nouvelle file pourra le reprendre
      const r2 = await envoyer(m, 'jn0');
      const n1 = m.f.j.vinted.filter((v) => v.methode !== 'GET').length;
      dit(r2 && (r2.resultat === 'envoye' || r2.resultat === 'ignore') && n1 - n0 <= 1 && !m.f.j.vinted.slice(i0).some((v) => v.methode === 'POST' && /replies$|offers$/.test(v.chemin)), 'R4 son message déjà dans la conversation ⇒ « fait » (seule la conversation est rouverte pour la relire), ni message ni offre de plus', JSON.stringify({ r2, ajout: n1 - n0 }));
      m.fin(); }

    console.log('\nR6. Un vrai cul-de-sac (Vinted refuse l’offre) : la raison exacte gardée, rien envoyé deux fois');
    { const m = await monde(racine, { n: 1, vinted: (e) => (e.methode === 'POST' && /\/offers$/.test(e.chemin) ? { status: 400, body: { code: 106, message: 'Le prix est trop bas' } } : null) });
      const r = await envoyer(m, 'jn0');
      const fa = (await m.f.ctx.faitsFavoris(m.UID)).jn0 || {};
      dit(r && r.resultat === 'refuse' && r.raison === 'offre_refusee' && fa.refus === 'Le prix est trop bas' && !ecr(m).some((x) => /replies$/.test(x)), 'R6 « Vinted : Le prix est trop bas » gardé sur sa rangée ; aucun message parti après une offre refusée', JSON.stringify({ r, fa }));
      m.fin(); }

    console.log('\nR5. Un bouton « Envoyer » sans texte : trouvé par le repérage');
    { require(path.join(__dirname, 'bancs', '_porte-banc.cjs'));
      const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
      const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
      const pg = await nav.newPage();
      await pg.setContent('<!doctype html><html><body><main><form id="f"><textarea data-testid="conversation-message-input" placeholder="Écris un message"></textarea><button type="submit" class="x9"><svg><use href="#icon-paper-plane-24"></use></svg></button></form></main></body></html>');
      await pg.addScriptTag({ content: fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'vrm-trouver.js'), 'utf8') });
      const r = await pg.evaluate(() => { const champ = document.querySelector('textarea'); const t = globalThis.__vrmTrouver; if (!t) return { sans: true }; const x = t.trouver('envoyer', { champ }); return { trouve: !!x.el, bon: x.el === document.querySelector('button.x9'), ambigu: !!x.ambigu }; });
      const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'vrm-formulaire.js'), 'utf8');
      dit(r && r.trouve && r.bon && !r.ambigu && /const r = t\.trouver\('envoyer', \{ champ \}\)/.test(src), 'R5 le bouton à icône seule est trouvé par le repérage (vrm-trouver.js), que le formulaire appelle quand le nom ne trouve rien', JSON.stringify(r));
      await nav.close(); }
  } catch (e) { ko++; console.log('  ❌ R0 a levé : ' + (e && e.stack || e)); }
  console.log(ko ? `❌ reprise des favoris : ${ko} rouge(s), ${ok} vert(s)` : `✅ reprise des favoris : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ R0 a levé : ' + (e && e.stack || e)); process.exit(1); });
