#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  5.455.8 — « UN ENVOI NE PEUT PAS ÉCHOUER » (Julien, 28 nov., sur la 5.455.7 : « je sélectionne ceux à envoyer et ça
//  m'affiche que les favoris n'ont pas pu être lus » ; « tu ouvres la conversation, tu fais une offre et un message »)
//
//  CAUSE MESURÉE (5.455.7) : un envoi resté « à vérifier » (tentative dont le bail a expiré, worker endormi) ou une file restée
//  active chez VRM (un Chrome fermé) faisait REFUSER chaque nouvel envoi par le serveur (« Vérifie les envois incertains… »,
//  « Une file est déjà en cours… ») ; le refus « incertain » EFFAÇAIT la liste du panneau (`apercuFav = null`), qui tombait sur
//  « Tes favoris n’ont pas pu être lus : <le refus de l'envoi> ». Et un seul favori refusé (offre refusée par Vinted…) arrêtait
//  TOUTE la file : le 2ᵉ favori ne partait jamais.
//
//  On EXÉCUTE la vraie route du serveur, le vrai background.js et le vrai panneau (scripts/_favoris-monde-reel.cjs) :
//   E1 SON cas : 2 favoris cochés, « Envoyer » ⇒ le récapitulatif (offre, message, rythme) puis « Lancer » : 2 conversations,
//      2 offres à 49,50 €, 2 messages, l'un APRÈS l'autre, la pause tirée au hasard dans 20–60 s ; « Message envoyé » et
//      « Offre faite 49,50 € · hh:mm » sur les deux rangées ; le 1er message part au premier tour (attentes voulues < 40 s) ;
//   E2 un envoi « à vérifier » d'avant (un autre favori) : l'envoi d'un favori part, la liste n'est JAMAIS remplacée par
//      « n’ont pas pu être lus » ; le favori « à vérifier » n'est jamais renvoyé ;
//   E3 Vinted refuse l'offre du 1er favori : SA rangée dit le refus de Vinted, la liste reste, le 2ᵉ part quand même ;
//   E4 une file restée active chez VRM (Chrome fermé) : la liste est montrée, « Envoyer » part ;
//   E5 une offre reçue il y a un mois, jamais relue : plus listée « à trancher » (expirée) ; une offre d'il y a 2 h l'est ;
//   E6 « Import de ton passé » / « Tout récupérer » : nulle part dans le panneau, ni dans l'écran d'import de l'app.
//  §6.1 : `FAV_DIRECT_RACINE=<arbre d'avant>` ⇒ rouge. `--prouve` : chaque mutation rend l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = process.env.FAV_DIRECT_RACINE ? path.resolve(process.env.FAV_DIRECT_RACINE) : path.join(__dirname, '..');
const MUTATIONS = {
  'incertain-bloque': ['api/_lib/favoris-file.js', "  // 5.455.8 (Julien, 28 nov. : « un envoi ne peut pas échouer […] tu ouvres la conversation, tu fais une offre et un message ») :\n", "  if(g.jobs.some(x=>x.etat==='incertain'))throw new RefusFavoris('Vérifie les envois incertains sur Vinted avant de préparer une nouvelle file.');\n"],
  'file-active-refuse': ['api/_lib/favoris-file.js', "  // 5.455.8 (Julien, 28 nov. : « un envoi ne peut pas échouer […] tu ouvres la conversation, tu fais une offre et un message ») :\n", "  if(g.active||g.jobs.some(x=>x.etat==='reserve'))throw new RefusFavoris('Une file est déjà en cours pour ce compte.');\n"],
  'un-refus-arrete-tout': ['api/_lib/favoris-file.js', "  else if(!j.auto&&!['envoye','ignore'].includes(resultat)&&!ARRETS_FILE.includes(raison)&&", "  else if(false&&"],
  // Le refus « incertain » du serveur remis ET la liste effacée par le panneau : c'est la phrase « pas pu être lus » qui doit rougir.
  'liste-effacee': [['api/_lib/favoris-file.js', "  // 5.455.8 (Julien, 28 nov. : « un envoi ne peut pas échouer […] tu ouvres la conversation, tu fais une offre et un message ») :\n", "  if(g.jobs.some(x=>x.etat==='incertain'))throw new RefusFavoris('Vérifie les envois incertains sur Vinted avant de préparer une nouvelle file.');\n"],
    ['vinted-sync-extension/vrm-badge.js', "favErreur = TU('f6_incertain_geste'); favFeuille = null; vueFav = null; apercuFavAt = 0;", "favErreur = TU('f6_incertain_geste'); favFeuille = null; vueFav = null; apercuFav = null; favLectureKo = favErreur; apercuFavAt = 0;"], /❌ E2 jamais/],
  // Témoin : le refus « incertain » remis SEUL — le panneau corrigé ne montre jamais « pas pu être lus » (la ligne E2 jamais reste verte).
  'apercu-cache-file': ['api/_lib/favoris.js', "  // 5.455.8 : une file active ne cache plus la liste", "  if(vue.active)return apercuCarte({vue,maintenant});\n  //"],
  'offre-sans-age': ['vinted-sync-extension/background.js', "    if (offreExpireeMsg(msg, maintenant, capAt)) continue;", ''],
  'import-remis': ['src/ImportDepart.jsx', "  if (variante === 'journee') return null;", "  if (variante === 'journee') return <button data-import-tout>Tout récupérer</button>;"],
};
const argMut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) { const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', timeout: 600000 }); const M0 = MUTATIONS[m], attendu = Array.isArray(M0[0]) && M0[M0.length - 1] instanceof RegExp ? M0[M0.length - 1] : /❌ E\d/; const rouge = r.status === 1 && attendu.test(r.stdout || ''); console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) { rate++; console.log((r.stdout || '').split('\n').filter((l) => /❌|introuvable/.test(l)).join('\n') || (r.stderr || '').slice(0, 400)); } }
  process.exit(rate ? 1 : 0);
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 600) : '')); } };
const s1 = (ms) => (ms == null ? '—' : (ms / 1000).toFixed(1) + ' s');

(async () => {
  let racine = RACINE;
  if (argMut) {
    const M0 = MUTATIONS[argMut]; if (!M0) { console.log('mutation inconnue'); process.exit(2); }
    const Ms = Array.isArray(M0[0]) ? M0.filter((x) => Array.isArray(x)) : [M0];
    racine = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-direct-'));
    for (const d of ['api', 'src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(racine, d), { recursive: true, filter: (s) => !/\/captures(\/|$)|\.zip$|\.png$/.test(s) });
    fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(racine, 'node_modules'));
    fs.writeFileSync(path.join(racine, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
    for (const M of Ms) { const f = path.join(racine, M[0]), s = fs.readFileSync(f, 'utf8'); if (!s.includes(M[1])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
      fs.writeFileSync(f, s.split(M[1]).join(M[2])); }
    process.on('exit', () => { try { fs.rmSync(racine, { recursive: true, force: true }); } catch (_) {} });
  }
  require(path.join(__dirname, 'bancs', '_porte-banc.cjs'));
  const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
  const { monde, ouvrirPanneau } = require('./_favoris-monde-reel.cjs');
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  // Le geste de Julien : cocher (ou « Envoyer » sur la rangée), puis le récapitulatif et « Lancer ». Un panneau d'avant qui
  // passe par les étapes 1→4 y est mené aussi (le juge porte sur ce qui PART et ce qui est MONTRÉ, pas sur le nombre d'étapes).
  const envoyer = async (P, ids) => {
    if (ids.length === 1) { if (!(await P.clic(`li[data-fav-qui="${ids[0]}"] [data-fav6-un]`))) return 'pas de bouton Envoyer sur la rangée'; }
    else { for (const id of ids) await P.clic(`.fav6-table li[data-fav-qui="${id}"] input[data-fav-coche]`); if (!(await P.clic('[data-fav-envoyer]'))) return 'pas de bouton Envoyer la sélection'; }
    await P.pg.waitForTimeout(500);
    for (let i = 0; i < 4; i++) { const l = await P.lire(); if (l.etape === '4' || !l.etape) break; if (!(await P.clic('.fav6-feuille [data-fav-etape-suivant]'))) break; }
    const etape = (await P.lire()).etape;
    if (!(await P.clic('.fav6-feuille [data-fav-lancer]'))) return 'pas de « Lancer » (étape ' + etape + ')';
    await P.pg.waitForTimeout(800);
    return '';
  };
  const corps = (m, re) => m.f.j.vinted.filter((v) => v.methode !== 'GET' && re.test(v.chemin)).map((v) => { try { return JSON.parse(v.corps); } catch (_) { return null; } });
  try {
    // ── E1 : SON cas ──
    console.log('\nE1. Deux favoris cochés, « Envoyer » : les deux partent, l’un après l’autre');
    {
      const m = await monde(racine, { n: 2, dressingAncien: true });
      const P = await ouvrirPanneau(nav, m, racine);
      await P.ouvrirFavoris();
      const avant = await P.lire();
      dit(avant.tableau && Object.keys(avant.rangs).length === 2 && !avant.erreurLecture, 'E1 la liste des 2 derniers favoris est montrée', JSON.stringify({ t: avant.tableau, r: Object.keys(avant.rangs), e: avant.erreurLecture, x: avant.texte.slice(0, 200) }));
      const ko1 = await envoyer(P, ['jn0', 'jn1']);
      const vus = await m.tours(8, () => P.pg.waitForTimeout(250));
      await P.pg.waitForTimeout(900);
      const apres = await P.lire();
      const dem = corps(m, /inquiries$/), off = corps(m, /\/offers$/), msg = corps(m, /replies$/);
      const fs0 = m.fileServeur(), jobs = (fs0 && fs0.groupes && Object.values(fs0.groupes)[0] && Object.values(fs0.groupes)[0].jobs) || [];
      const env = jobs.filter((j) => j.etat === 'envoye').sort((a, b) => a.envoyeLe - b.envoyeLe);
      const ecart = env.length === 2 ? env[1].envoyeLe - env[0].envoyeLe : null;
      const pauses = (m.f.ctx.__vrmPausesVues || []).map((x) => [x[0], Math.round(x[1])]);
      const premier = [];
      for (const p of pauses) { premier.push(p); if (/^ecriture:/.test(p[0])) break; }
      const avantPremier = premier.reduce((s, x) => s + (/^lecture:/.test(x[0]) ? 0 : x[1]), 0);
      console.log(`     mesuré : ${dem.length} conversations · ${off.length} offres (${off.map((x) => x && x.offer && x.offer.price).join(', ')} €) · ${msg.length} messages · écart entre les deux messages ${s1(ecart)} · attentes voulues avant le 1er message ${s1(avantPremier)} ${JSON.stringify(premier)}`);
      dit(!ko1, 'E1 « Envoyer » ⇒ le récapitulatif ⇒ « Lancer »', ko1);
      dit(dem.length === 2 && off.length === 2 && off.every((x) => x && x.offer && x.offer.price === '49.5') && msg.length === 2, 'E1 2 conversations, 2 offres à 49,50 € (jamais sous le plancher), 2 messages', JSON.stringify({ dem: dem.length, off: off.map((x) => x && x.offer && x.offer.price), msg: msg.length, vus }));
      dit(ecart != null && ecart >= 20000 && ecart <= 61000, 'E1 l’un après l’autre, la pause tirée au hasard dans 20–60 s (sa cadence, inchangée)', s1(ecart));
      dit(avantPremier < 40000, 'E1 le 1er message part au premier tour après « Lancer » (attentes voulues < 40 s, dont les 8–20 s entre l’offre et le message)', s1(avantPremier));
      dit(['jn0', 'jn1'].every((id) => apres.rangs[id] && /Message envoyé/.test(apres.rangs[id].texte) && /Offre faite 49,50 € · \d\d[:h]\d\d/.test(apres.rangs[id].texte)) && !apres.erreurLecture, 'E1 « Message envoyé » et « Offre faite 49,50 € · hh:mm » sur les deux rangées, la liste toujours là', JSON.stringify(Object.fromEntries(Object.entries(apres.rangs).map(([k, v]) => [k, v.texte.slice(0, 160)]))));
      dit(!P.erreurs.length, 'E1 aucune erreur de page', JSON.stringify(P.erreurs));
      await P.ctx.close(); m.fin();
    }
    // ── E2 : un envoi « à vérifier » d'avant ──
    console.log('\nE2. Un envoi « à vérifier » d’avant (un autre favori) ne bloque rien, la liste reste');
    {
      const m = await monde(racine, { n: 3, avant: async ({ call, h }) => {
        // L'envoi d'hier vers le 3ᵉ favori : réservé, puis abandonné (worker endormi) ⇒ « à vérifier » chez VRM.
        const ap = await call('apercu'); const reg = ap.body && ap.body.apercu && ap.body.apercu.reglages;
        await call('lancer', { selection: ['jn2'], reglages: reg });
        await call('suivant'); h.t += 3 * 60000; await call('suivant'); h.t += 2 * 60000;   // la grâce de la tentative abandonnée (4 min) passée
      } });
      const v0 = m.fileServeur(); const j2 = v0 && Object.values(v0.groupes)[0].jobs.find((j) => j.notificationId === 'jn2');
      const P = await ouvrirPanneau(nav, m, racine);
      await P.ouvrirFavoris();
      const ko2 = await envoyer(P, ['jn0']);
      await P.pg.waitForTimeout(600);
      const pendant = await P.lire();
      await m.tours(6, () => P.pg.waitForTimeout(250));
      await P.pg.waitForTimeout(900);
      const apres = await P.lire();
      const msg = m.f.j.vinted.filter((v) => v.methode === 'POST' && /replies$/.test(v.chemin));
      const dem = corps(m, /inquiries$/);
      const lanc = P.recus.filter((x) => x.quoi === 'lancer').map((x) => x.r && (x.r.ok ? 'ok' : x.r.raison));
      dit(j2 && j2.etat === 'incertain', 'E2 (le décor) le 3ᵉ favori est « à vérifier » chez VRM', JSON.stringify(j2 && j2.etat));
      dit(!ko2 && !pendant.erreurLecture && !apres.erreurLecture && !apres.vuLecture.length && !/n’ont pas pu être lus/.test(pendant.texte + apres.texte) && apres.tableau, 'E2 jamais « Tes favoris n’ont pas pu être lus » (pas même un instant), la liste reste affichée', JSON.stringify({ ko2, lanc, vu: apres.vuLecture }));
      dit(msg.length === 1 && dem.length === 1 && dem[0] && String(dem[0].receiver_id) === m.ACH[0] && /Message envoyé/.test((apres.rangs.jn0 || {}).texte || ''), 'E2 le favori choisi part (conversation, offre, message) et le dit', JSON.stringify({ lanc, msg: msg.length, jn0: (apres.rangs.jn0 || {}).texte }));
      dit(!dem.some((x) => x && String(x.receiver_id) === m.ACH[2]), 'E2 le favori « à vérifier » n’est jamais renvoyé', JSON.stringify(dem));
      await P.ctx.close(); m.fin();
    }
    // ── E3 : Vinted refuse l'offre du 1er ──
    console.log('\nE3. Vinted refuse l’offre du 1er favori : sa rangée le dit, le 2ᵉ part quand même');
    {
      const m = await monde(racine, { n: 2, vinted: (e) => (e.methode === 'POST' && e.chemin === '/api/v2/transactions/6000/offers' ? { status: 400, body: { code: 106, message: 'Offer price is too low' } } : null) });
      const P = await ouvrirPanneau(nav, m, racine);
      await P.ouvrirFavoris();
      const ko3 = await envoyer(P, ['jn0', 'jn1']);
      await m.tours(8, () => P.pg.waitForTimeout(250));
      await P.pg.waitForTimeout(900);
      const apres = await P.lire();
      const msg = corps(m, /replies$/), dem = corps(m, /inquiries$/);
      dit(!ko3 && apres.tableau && !apres.erreurLecture && !apres.vuLecture.length, 'E3 la liste reste affichée (jamais « n’ont pas pu être lus »)', JSON.stringify({ ko3, vu: apres.vuLecture, x: apres.texte.slice(0, 200) }));
      dit(/Refusé par Vinted|offre refusée/i.test((apres.rangs.jn0 || {}).texte || '') && /Vinted : « Offer price is too low »/.test((apres.rangs.jn0 || {}).texte || ''), 'E3 la rangée du 1er dit le refus de Vinted, avec SA phrase (« Vinted : « Offer price is too low » »)', (apres.rangs.jn0 || {}).texte);
      dit(dem.length === 2 && msg.length === 1 && /Message envoyé/.test((apres.rangs.jn1 || {}).texte || ''), 'E3 le 2ᵉ favori part quand même (conversation, offre, message)', JSON.stringify({ dem: dem.length, msg: msg.length, jn1: (apres.rangs.jn1 || {}).texte }));
      await P.ctx.close(); m.fin();
    }
    // ── E4 : une file restée active chez VRM ──
    console.log('\nE4. Une file restée active chez VRM (Chrome fermé pendant un envoi) : la liste est là, « Envoyer » part');
    {
      const m = await monde(racine, { n: 3, avant: async ({ call }) => { const ap = await call('apercu'); await call('lancer', { selection: ['jn2'], reglages: ap.body && ap.body.apercu && ap.body.apercu.reglages }); } });
      const P = await ouvrirPanneau(nav, m, racine);
      await P.ouvrirFavoris();
      const avant = await P.lire();
      dit(avant.tableau && !!avant.rangs.jn0 && !/Des messages partent déjà sur ce compte/.test(avant.texte), 'E4 la liste des favoris est montrée (plus « Des messages partent déjà… » sans favoris)', avant.texte.slice(0, 300));
      const ko4 = await envoyer(P, ['jn0']);
      await m.tours(8, () => P.pg.waitForTimeout(250));
      await P.pg.waitForTimeout(700);
      const dem = corps(m, /inquiries$/);
      const lanc = P.recus.filter((x) => x.quoi === 'lancer').map((x) => x.r && (x.r.ok ? 'ok' : x.r.raison));
      dit(!ko4 && lanc[0] === 'ok' && dem.some((x) => x && String(x.receiver_id) === m.ACH[0]), 'E4 « Envoyer » part (la sélection s’ajoute à la file restée active)', JSON.stringify({ ko4, lanc, dem }));
      await P.ctx.close(); m.fin();
    }
    // ── E5 : une offre d'il y a un mois ──
    console.log('\nE5. L’offre reçue il y a un mois, jamais relue : expirée, plus « à trancher »');
    {
      const { faireFond } = require(path.join(racine, 'scripts', '_fond-vm.cjs'));
      const maint = Date.now(), J = 86400000;
      const conv = (id, il, capIl) => ({ capturedAt: new Date(maint - capIl).toISOString(), payload: { conversation: { id, opposite_user: { id: 900, login: 'acheteur' }, description: 'Salomon XT-6', transaction: { item_id: 7001, item_title: 'Salomon XT-6' },
        messages: [{ entity_type: 'offer_request_message', created_at_ts: Math.floor((maint - il) / 1000), entity: { user_id: 900, status: 10, status_title: 'En attente', current: true, price: { amount: '60.0', currency_code: 'EUR' }, transaction_id: 50 + id, offer_request_id: 600 + id } }] } } });
      const f = faireFond({ src: path.join(racine, 'vinted-sync-extension', 'background.js'), connecte: '123', lignes: { harvest_123_conv_1: conv(1, 30 * J, 29 * J), harvest_123_conv_2: conv(2, 2 * 3600000, 3600000) } });
      const l = await f.ctx.offresEnAttente('123');
      dit(l.length === 1 && l[0].conv === '2', 'E5 (extension) l’offre d’il y a un mois n’est plus listée ; celle d’il y a 2 h l’est', JSON.stringify(l.map((x) => x.conv)));
      const OV = await import(path.join(racine, 'src', 'offresVinted.js') + '?r=' + Math.random());
      const vieux = OV.offreVintedEnAttente(conv(1, 30 * J, 29 * J).payload.conversation, maint), frais = OV.offreVintedEnAttente(conv(2, 2 * 3600000, 3600000).payload.conversation, maint);
      dit(vieux === null && frais && frais.oid === '602', 'E5 (app) la même règle : expirée au-delà de 7 jours, jamais « en attente » pour toujours', JSON.stringify({ vieux, frais }));
    }
    // ── E6 : plus d'import du passé ──
    console.log('\nE6. « Import de ton passé » / « Tout récupérer » : retirés partout');
    {
      const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      const badge = sansCommentaires(fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'vrm-badge.js'), 'utf8'));
      const imp = sansCommentaires(fs.readFileSync(path.join(racine, 'src', 'ImportDepart.jsx'), 'utf8'));
      const compta = sansCommentaires(fs.readFileSync(path.join(racine, 'src', 'ecrans', 'Comptabilite.jsx'), 'utf8'));
      dit(!/Import de ton passé|Tout récupérer|data-import-tout/.test(badge), 'E6 le panneau : aucune ligne ni bouton d’import', (badge.match(/.{0,60}(Import de ton passé|Tout récupérer|data-import-tout).{0,60}/) || [''])[0]);
      dit(!/Tout récupérer|data-import-tout|Import de ton passé/.test(imp) && /variante === 'journee'\) return null/.test(imp) && !/<ImportDepart\b/.test(compta), 'E6 l’app : ni carte dans « Tout va bien ? », ni bouton dans Réglages (une ligne, sans bouton)', (imp.match(/.{0,60}(Tout récupérer|data-import-tout).{0,60}/) || [''])[0]);
      // (revue) Élargi à TOUT src/ et à l'extension : « Import de ton passé » / « Importer le passé » nulle part (commentaires retirés).
      //    « Tout récupérer » reste seulement aux imports des AUTRES sites (HistoriqueSites, clé historiqueSites.toutRecuperer) — en attente de Julien.
      const tous = [];
      const fouiller = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, n.name); if (n.isDirectory()) { if (!/node_modules|i18n/.test(f)) fouiller(f); } else if (/\.(jsx?|mjs)$/.test(n.name)) tous.push(f); } };
      fouiller(path.join(racine, 'src')); fouiller(path.join(racine, 'vinted-sync-extension'));
      const fautifs = tous.filter((f) => /Import de ton passé|Importer le passé/.test(sansCommentaires(fs.readFileSync(f, 'utf8'))));
      const fr = fs.readFileSync(path.join(racine, 'src', 'i18n', 'langues', 'fr', 'nouveaux.js'), 'utf8');
      dit(!fautifs.length && !/Import de ton passé/.test(fr), 'E6 nulle part dans src/ ni dans l’extension : « Import de ton passé » / « Importer le passé »', JSON.stringify(fautifs.map((f) => path.relative(racine, f))));
    }
  } catch (e) { ko++; console.log('  ❌ E0 a levé : ' + (e && e.stack || e)); }
  await nav.close();
  console.log(ko ? `❌ favoris envoi direct : ${ko} rouge(s), ${ok} vert(s)` : `✅ favoris envoi direct : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ E0 a levé : ' + (e && e.stack || e)); process.exit(1); });
