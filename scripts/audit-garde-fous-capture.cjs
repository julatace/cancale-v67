#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES GARDE-FOUS DE LA CAPTURE (8 nov., extension 5.327)
//  Julien, après deux jours sans rien de son iPhone : « ce problème ne doit
//  plus jamais se produire ».
//   A. La règle (api/_lib/garde-capture.js) : une panne = pas relu depuis
//      > 12 h ALORS QU'un appareil a travaillé sur ce site depuis < 12 h et l'a
//      VU, ou a vu son dernier envoi REFUSÉ ; aucun appareil / appareil endormi /
//      « jamais relu » non vu / refus suivi d'un succès ⇒ rien ; une notification
//      par panne (même panne ⇒ ne resonne pas ; mémo illisible ⇒ rien) ; le
//      geste suit la cause (version ancienne d'abord).
//   B. Le VRAI `background.js` (`_fond-vm.cjs`) publie SA ligne d'appareil :
//      Orion · iPhone (paquet Orion) / Chrome · Mac, version du code, dernier
//      refus (code, famille, taille), comptes vus ; au plus une fois par 30 min,
//      tout de suite après un refus neuf ; sans session : rien.
//   C. La voie de secours : 3 échecs « réseau » de suite vers vrm.center ⇒ la
//      voie directe, bornée (< 256 Ko), fusion par n° de transaction (les ventes
//      hors fenêtre restent) ; une liste trop lourde ⇒ RIEN relu ni écrit, la
//      ligne en base reste entière, la carte le dit ; 2 échecs ⇒ pas de secours ;
//      un 401 ne compte pas ; un succès de vrm.center remet tout à zéro.
//  Données inventées (dépôt public).
//  Usage : node scripts/audit-garde-fous-capture.cjs [--src background.js] [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };
const H = 3600e3, M = 60e3, KO256 = 256 * 1024;
const UID = '111', ROW = `harvest_${UID}_orders_sold`;

const TX0 = 15800000000;
const vente = (i, extra = {}) => Object.assign({
  transaction_id: TX0 + i, conversation_id: 21900000000 + i, item_id: 5100000000 + i,
  title: `Nike Air Max 90 Essential blanc taille ${38 + (i % 8)}`, price: { amount: (40 + (i % 50)).toFixed(1), currency_code: 'EUR' },
  status: 'La commande est finalisée. Les fonds ont été transférés sur ton porte-monnaie Vinted.', transaction_user_status: 'completed',
  date: new Date(Date.parse('2026-11-05T07:50:12Z') - i * 3 * H).toISOString(),
  photo: { id: 30000000000 + i, url: `https://images1.vinted.net/t/04_00abc_${i}/f800/${1762300000 + i}.webp?s=0123456789abcdef0123456789abcdef01234567`, high_resolution: { id: 'h' + i, timestamp: 1762300000 + i } },
  buyer: { id: 90000 + i, login: 'acheteur' + i },
}, extra);
const allege = (o) => ({ date: o.date, price: o.price, title: o.title, status: o.status, transaction_id: o.transaction_id, conversation_id: o.conversation_id, transaction_user_status: o.transaction_user_status, item_id: o.item_id, photo: { url: o.photo.url, high_resolution: { timestamp: o.photo.high_resolution.timestamp } } });
const rangee = (ilYa, liste, total) => ({ type: 'orders_sold', uid: UID, domain: 'www.vinted.fr', capturedAt: new Date(Date.now() - ilYa).toISOString(),
  nItems: liste.length, payload: { pagination: { current_page: 1, per_page: 100, total_pages: 22, total_entries: total }, my_orders: liste.map(allege) }, resume: { n: liste.length, txns: [], at: Date.now() - ilYa } });
const vintedVentes = (liste, total) => (req) => {
  const m = /\/api\/v2\/my_orders\?type=(sold|purchased)&page=(\d+)&per_page=(\d+)/.exec(req.chemin);
  if (!m) return { status: 404, body: {} };
  const page = Number(m[2]), per = Number(m[3]);
  return { status: 200, body: { my_orders: liste.slice((page - 1) * per, page * per), pagination: { current_page: page, per_page: per, total_pages: Math.ceil(total / per), total_entries: total } } };
};

(async () => {
  const G = await import(pathToFileURL(path.join(__dirname, '..', 'api', '_lib', 'garde-capture.js')).href);
  const T = Date.parse('2026-11-08T12:00:00Z');
  const app = (o) => G.lireAppareil({ id: 'ext_appareil_' + (o.id || 'a1b2c3d4e5f60718'), ap: o.ap || { paquet: 'orion', nav: 'orion', systeme: 'iphone' }, ver: o.ver || '5.327.0', code: o.code || o.ver || '5.327.0', at: String(T - (o.ilYa || 5 * M)), flux: o.flux || {}, vus: o.vus || {} });
  const refus = (ilYa, statut = 'reseau', octets = 1100000) => ({ vinted: { okAt: T - 6 * H, koAt: T - ilYa, koStatut: statut, refus: [{ at: T - ilYa, statut, famille: 'harvest_orders_sold', octets }] } });
  const c222 = (luIlYa, extra = {}) => Object.assign({ plateforme: 'vinted', id: '222', nom: 'second_compte', lu: luIlYa == null ? null : T - luIlYa }, extra);
  const P = (comptes, appareils) => G.pannesCapture({ comptes, appareils, attendue: '5.327.0', maintenant: T });

  console.log('── A. La règle');
  await essaie('règle', async () => {
    dit(Array.isArray(P([c222(20 * H)], [])) && P([c222(20 * H)], []).length === 0, 'aucun appareil (extension jamais active, ou d’avant la 5.327) ⇒ aucune alerte');
    dit(P([c222(20 * H)], null) === null, 'appareils illisibles ⇒ pas su (null)');
    dit(P([c222(20 * H)], [app({ ilYa: 13 * H, flux: refus(13 * H), vus: { vinted: { 222: T - 11 * H } } })]).length === 0, 'appareil endormi depuis plus de 12 h ⇒ aucune alerte');
    dit(P([c222(20 * H)], [app({ flux: { vinted: { okAt: T - 19 * H, koAt: T - 13 * H, koStatut: 'reseau', refus: [{ at: T - 13 * H, statut: 'reseau', famille: 'harvest_orders_sold', octets: 10 }] } } })]).length === 0, 'un refus de plus de 12 h ne prouve pas une panne en cours');
    const p1 = P([c222(20 * H)], [app({ flux: refus(4 * M) })]);
    dit(p1.length === 1 && p1[0].preuve === 'refus' && /réseau coupé/.test(p1[0].cause) && /tes ventes/.test(p1[0].cause) && /1,0 Mo/.test(p1[0].cause) && p1[0].appareil.nom === 'Orion · iPhone', 'refus courant après la relecture ⇒ panne, cause lue (code, famille, taille, appareil)', JSON.stringify(p1[0] && { c: p1[0].cause, a: p1[0].appareil && p1[0].appareil.nom }));
    dit(P([c222(11 * H)], [app({ flux: refus(4 * M) })]).length === 0, 'relu il y a 11 h ⇒ pas de panne');
    const fluxOk = { vinted: { okAt: T - 2 * M, koAt: T - 4 * M, koStatut: 'reseau', refus: [{ at: T - 4 * M, statut: 'reseau', famille: 'harvest_orders_sold', octets: 10 }] } };
    dit(P([c222(20 * H)], [app({ flux: fluxOk })]).length === 0, 'refus suivi d’un envoi réussi ⇒ pas de preuve (et rien vu) ⇒ rien');
    const p2 = P([c222(20 * H)], [app({ flux: fluxOk, vus: { vinted: { 222: T - 10 * M } } })]);
    dit(p2.length === 1 && p2[0].preuve === 'vu', 'VU ouvert il y a 10 min sans que rien n’arrive ⇒ panne (même sans refus)');
    dit(P([c222(null)], [app({ flux: refus(4 * M) })]).length === 0, '« jamais relu » + un refus qui ne dit pas quel compte ⇒ rien (pas su)');
    dit(P([c222(null)], [app({ vus: { vinted: { 222: T - 10 * M } } })]).length === 1, '« jamais relu » mais VU ouvert ⇒ panne');
    dit(P([c222(20 * H, { ecarte: true })], [app({ flux: refus(4 * M) })]).length === 0, 'compte masqué / banni / hors totaux ⇒ jamais nommé');
    dit(P([{ plateforme: 'ebay', id: 'principal', lu: T - 40 * H }], [app({ flux: refus(4 * M) })]).length === 0, 'eBay (relu par le serveur) ⇒ hors de cette alerte');
    const vieux = P([c222(20 * H)], [app({ code: '5.322.0', ver: '5.322.0', flux: refus(4 * M) })]);
    dit(vieux[0] && /installe l’extension 5\.327 sur Orion · iPhone/.test(vieux[0].geste), 'appareil en retard ⇒ le geste est la mise à jour', vieux[0] && vieux[0].geste);
    const s401 = P([c222(20 * H)], [app({ flux: refus(4 * M, '401', 300) })]);
    dit(s401[0] && /reconnecte l’extension/.test(s401[0].geste), '401 ⇒ reconnecter l’extension', s401[0] && s401[0].geste);
    // Une notification par panne.
    const d1 = G.decisionPannes({ liste: p1, memo: null, maintenant: T });
    dit(d1.envoyer && d1.nouvelles.length === 1, 'première fois ⇒ envoyée');
    const d2 = G.decisionPannes({ liste: p1, memo: d1.memo, maintenant: T + H });
    dit(!d2.envoyer, 'même panne une heure plus tard ⇒ ne resonne pas', d2.raison);
    const relu = P([c222(13 * H)], [app({ flux: refus(4 * M) })]);   // relu entre-temps puis de nouveau bloqué
    dit(G.decisionPannes({ liste: relu, memo: d1.memo, maintenant: T + H }).envoyer, 'relu puis de nouveau bloqué ⇒ nouvelle panne, une notification');
    dit(!G.decisionPannes({ liste: p1, memo: undefined }).envoyer && !G.decisionPannes({ liste: null, memo: null }).envoyer, 'mémo ou lecture illisible ⇒ rien envoyé');
    const tx = G.textePannes(p1);
    dit(tx && /second_compte/.test(tx.title) && /réseau coupé/.test(tx.body) && /Orion · iPhone/.test(tx.body) && /Geste/.test(tx.body), 'texte : compte, cause, appareil, geste', JSON.stringify(tx));
    // Les versions et les paquets.
    dit(G.etatVersion({ code: '5.326.0' }, '5.327.0') === 'ancienne' && G.etatVersion({ code: '5.327.0' }, '5.327.0') === 'a-jour' && G.etatVersion({}, '5.327.0') === 'pas-su', 'version : ancienne · à jour · pas su');
    dit(G.gestesMiseAJour({ paquet: 'orion' }, '5.327.0').lien === '/VRM-Orion.xpi' && G.gestesMiseAJour({ paquet: 'chromium', nav: 'chrome' }, '5.327.0').lien === '/VRM-extension.zip'
      && G.gestesMiseAJour({ paquet: 'orion' }, '5.327.0').gestes.length === 3 && G.gestesMiseAJour({ paquet: 'chromium' }, '5.327.0').gestes.length === 3, 'le bon paquet (Orion xpi / Chrome zip) et trois gestes');
    for (const f of ['VRM-Orion.xpi', 'VRM-extension.zip']) dit(fs.existsSync(path.join(__dirname, '..', 'public', f)), `le paquet ${f} est servi`);
  });

  console.log('── B. L’extension publie son appareil');
  await essaie('appareil Orion', async () => {
    const f = faireFond({ src: SRC });
    f.ctx.navigator = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' };
    f.ctx.__vrmOrionCompat = true;
    await f.ctx.noterCompteVu('vinted', '222');
    await f.ctx.chrome.storage.local.set({ vrmFlux: { vinted: { okAt: Date.now() - H, koAt: Date.now() - M, koStatut: 'reseau', refus: [{ at: Date.now() - M, statut: 'reseau', famille: 'harvest_orders_sold', octets: 1100000 }] } } });
    const r = await f.ctx.publierAppareil(false);
    const id = Object.keys(f.lignes).find((k) => /^ext_appareil_[a-f0-9]{16}$/.test(k));
    const d = id && f.lignes[id];
    dit(r === true && !!d, 'une ligne ext_appareil_{id} est écrite', JSON.stringify(Object.keys(f.lignes)));
    const a = d && G.lireAppareil({ id, ap: d.appareil, ver: d.ver, code: d.code, at: String(d.atMs), flux: d.flux, vus: d.vus });
    dit(a && a.nom === 'Orion · iPhone' && a.paquet === 'orion', 'nommé « Orion · iPhone », paquet Orion', a && a.nom);
    dit(a && a.code === (/const CODE_VERSION = '([\d.]+)'/.exec(fs.readFileSync(SRC, 'utf8')) || [])[1], 'la version du CODE');
    dit(a && a.flux.vinted.refus.length === 1 && a.flux.vinted.refus[0].octets === 1100000 && a.vus.vinted['222'], 'dernier refus (code, famille, taille) et compte vu');
    dit(d && !JSON.stringify(d).includes('Mozilla') && !JSON.stringify(d).includes('jeton'), 'ni l’agent utilisateur ni un jeton dans la ligne');
    const n0 = f.j.posts.length;
    await f.ctx.publierAppareil(false);
    dit(f.j.posts.length === n0, 'republier tout de suite ⇒ rien (au plus une fois par 30 min)');
    // Un refus NEUF, 3 min après : publié tout de suite.
    await f.ctx.chrome.storage.local.set({ vrmAppareilPub: { at: Date.now() - 3 * M, koAt: Date.now() - M }, vrmFlux: { vinted: { okAt: Date.now() - H, koAt: Date.now(), koStatut: '503', refus: [] } } });
    await f.ctx.publierAppareil(false);
    dit(f.j.posts.length === n0 + 1, 'un refus neuf ⇒ publié sans attendre 30 min');
    const id2 = (await f.ctx.chrome.storage.local.get('vrmAppareilId')).vrmAppareilId;
    await f.ctx.chrome.storage.local.set({ vrmAppareilPub: {} });
    await f.ctx.publierAppareil(false);
    dit(Object.keys(f.lignes).filter((k) => /^ext_appareil_/.test(k)).length === 1 && id === 'ext_appareil_' + id2, 'une seule identité par navigateur (gardée)');
  });
  await essaie('appareil Chrome', async () => {
    const f = faireFond({ src: SRC });
    f.ctx.navigator = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };
    await f.ctx.publierAppareil(true);
    const id = Object.keys(f.lignes).find((k) => /^ext_appareil_/.test(k)), d = id && f.lignes[id];
    dit(d && d.appareil.nav === 'chrome' && d.appareil.systeme === 'mac' && d.appareil.paquet === 'chromium', 'Chrome · Mac, paquet zip');
  });
  await essaie('sans session', async () => {
    const f = faireFond({ src: SRC, store: { __sansSession: true } });
    const r = await f.ctx.publierAppareil(true);
    dit(r === false && !Object.keys(f.lignes).some((k) => /^ext_appareil_/.test(k)), 'sans session VRM : rien publié, aucun réseau');
  });
  await essaie('noterFlux publie', async () => {
    const f = faireFond({ src: SRC });
    await f.ctx.noterFlux('vinted', true);
    await new Promise((r) => setTimeout(r, 30));
    dit(Object.keys(f.lignes).some((k) => /^ext_appareil_/.test(k)), 'un envoi noté (carte du logo) publie l’appareil');
  });

  console.log('── C. La voie de secours');
  const visites = async (f, n) => { const rs = []; for (let i = 0; i < n; i++) { await f.ctx.chrome.storage.local.set({ vrmDerniereVente: {} }); rs.push(await f.ctx.rafraichirVentes(UID)); } return rs; };
  await essaie('secours petit', async () => {
    const baseL = Array.from({ length: 50 }, (_, k) => vente(k + 1000));
    const chez = Array.from({ length: 400 }, (_, k) => vente(k + 1));
    const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(20 * H, baseL, 450) }, vinted: vintedVentes(chez, 400), vrm: () => ({ reseau: true }) });
    const rs = await visites(f, 2);
    dit(rs.every((r) => r && r.ecrit === false) && f.lignes[ROW].nItems === 50, '2 échecs : rien écrit, pas de secours', JSON.stringify(rs));
    const corps = [];
    const avantFetch = f.ctx.fetch;
    f.ctx.fetch = async (u, o = {}) => { if ((o.method || 'GET') === 'POST' && /rest\/v1\/app_data/.test(String(u)) && /orders_sold/.test(String(o.body || ''))) corps.push(String(o.body).length); return avantFetch(u, o); };
    const r3 = (await visites(f, 1))[0];
    const l = f.lignes[ROW].payload.my_orders;
    dit(r3 && r3.ecrit === true, '3e échec de suite ⇒ voie directe : rangé', JSON.stringify(r3));
    dit(corps.length === 1 && corps[0] < KO256, 'un seul envoi direct, sous 256 Ko', JSON.stringify(corps));
    dit(l.some((o) => o.transaction_id === TX0 + 1000) && l.some((o) => o.transaction_id === TX0 + 1) && new Set(l.map((o) => o.transaction_id)).size === l.length, 'fusion par n° : les ventes hors fenêtre restent, aucune en double');
    const s = ((f.store.vrmFlux || {}).vinted || {}).secours;
    dit(s && s.etat === 'envoi' && s.octets > 0 && s.octets < KO256, 'la carte du logo : « envoyé par la voie directe » et la taille', JSON.stringify(s));
    const badge = fs.readFileSync(path.join(path.dirname(SRC), 'vrm-badge.js'), 'utf8');
    dit(/data-secours="envoi"/.test(badge) && /data-secours="trop_lourd"/.test(badge), 'la carte rend les deux états du secours');
  });
  await essaie('secours trop lourd', async () => {
    const baseL = Array.from({ length: 2000 }, (_, k) => vente(k + 1000));
    const chez = Array.from({ length: 2162 }, (_, k) => vente(k + 1));
    const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(20 * H, baseL, 2162) }, vinted: vintedVentes(chez, 2162), vrm: () => ({ reseau: true }) });
    const avant = JSON.stringify(f.lignes[ROW]);
    const lus = [];
    const avantFetch = f.ctx.fetch;
    f.ctx.fetch = async (u, o = {}) => { if ((o.method || 'GET') === 'GET' && /orders_sold/.test(String(u))) lus.push(decodeURIComponent(String(u))); return avantFetch(u, o); };
    const rs = await visites(f, 3);
    dit(rs[2] && rs[2].ecrit === false && JSON.stringify(f.lignes[ROW]) === avant, 'liste de 2 000 : RIEN écrit, la ligne complète reste entière');
    dit(!lus.some((u) => /my_orders/.test(u)), 'la liste n’est même pas relue (taille jugée sur le compteur scalaire)', lus.join(' | ').slice(0, 200));
    const s = ((f.store.vrmFlux || {}).vinted || {}).secours;
    dit(s && s.etat === 'trop_lourd' && s.octets > KO256, 'la carte dit « trop lourde pour la voie directe »', JSON.stringify(s));
    const fl = (f.store.vrmFlux || {}).vinted || {};
    dit(fl.koAt && !(fl.okAt > fl.koAt), 'et le refus reste le dernier état (ambre, geste dit)');
  });
  await essaie('401 et succès remettent à zéro', async () => {
    const baseL = Array.from({ length: 50 }, (_, k) => vente(k + 1000));
    const chez = Array.from({ length: 400 }, (_, k) => vente(k + 1));
    let mode = 'reseau';
    const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(20 * H, baseL, 450) }, vinted: vintedVentes(chez, 400), vrm: () => (mode === 'reseau' ? { reseau: true } : { status: 401, body: { erreur: 'session' } }) });
    await visites(f, 2); mode = '401'; await visites(f, 1); mode = 'reseau';
    const r = (await visites(f, 1))[0];
    dit(r && r.ecrit === false && f.lignes[ROW].nItems === 50, 'un 401 entre deux coupures remet le compte à zéro (pas de secours sur un refus durable)');
    const n = (await f.ctx.chrome.storage.local.get('vrmSecoursCmd')).vrmSecoursCmd;
    dit(n && n.n === 1, 'compteur : 1 après le 401', JSON.stringify(n));
    await f.ctx.effacerEchecsServeur();
    dit(((await f.ctx.chrome.storage.local.get('vrmSecoursCmd')).vrmSecoursCmd || {}).n === 0, 'un succès de vrm.center remet à zéro');
  });

  if (process.argv.includes('--prouve')) {
    console.log('\n— Mutations (le banc doit rougir) —');
    const { execFileSync } = require('child_process');
    const os = require('os');
    const muter = (fichier, de, vers, nom, args = []) => {
      const t = fs.readFileSync(fichier, 'utf8');
      if (!t.includes(de)) { dit(false, `mutation introuvable : ${nom}`); return; }
      const tmp = path.join(os.tmpdir(), 'mut-' + process.pid + '-' + path.basename(fichier));
      let rouge = false;
      if (fichier === SRC) { fs.writeFileSync(tmp, t.replace(de, vers)); try { execFileSync(process.execPath, [__filename, '--src', tmp], { stdio: 'pipe' }); } catch (_) { rouge = true; } fs.unlinkSync(tmp); }
      else { fs.writeFileSync(fichier, t.replace(de, vers)); try { execFileSync(process.execPath, [__filename], { stdio: 'pipe' }); } catch (_) { rouge = true; } fs.writeFileSync(fichier, t); }
      dit(rouge, `mutation « ${nom} » ⇒ rouge`);
    };
    const R = path.join(__dirname, '..', 'api', '_lib', 'garde-capture.js');
    muter(R, "const actifs = appareils.filter((a) => a && maintenant - a.at <= ACTIF_MS);", 'const actifs = appareils.filter(Boolean);', 'appareil endormi compté');
    muter(R, 'if (r && maintenant - r.at <= ACTIF_MS && (!lu || r.at > lu)', 'if (r && (!lu || r.at > lu)', 'refus de plus de 12 h compté');
    muter(R, "if (!f || !f.koAt || (f.okAt && f.okAt > f.koAt)) return null;", 'if (!f || !f.koAt) return null;', 'refus caduc compté');
    muter(R, 'const nouvelles = liste.filter((p) => !deja[p.cle]);', 'const nouvelles = liste;', 'notification répétée');
    muter(SRC, 'if (estime > SECOURS_MAX_OCTETS) {', 'if (false) {', 'secours sans borne');
    muter(SRC, 'return n >= SECOURS_APRES ? \'secours\' : null;', 'return n >= 1 ? \'secours\' : null;', 'secours au premier échec');
    muter(SRC, "const n = echecServeurPassager(statut) ? (Number(cur.n) || 0) + 1 : 0;", 'const n = (Number(cur.n) || 0) + 1;', 'un 401 compté comme une coupure');
    muter(SRC, "if (!s || s.mort || !(s.access_token || s.refresh_token)) return false;   // AUCUN réseau sans session", 'if (false) return false;', 'publication sans session');
  }
  console.log(ko ? `\n❌ garde-fous capture : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ garde-fous capture : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
