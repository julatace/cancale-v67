// ════════════════════════════════════════════════════════════════════════════
//  L'EXTENSION S'ADAPTE SUR TOUS SES SITES (24 nov., ext. 5.448.0 — `adaptatif`)
//        node scripts/audit-ext-adaptatif.cjs [--src background.js] [--manifeste f] [--prouve]
//
//  Julien : « elle doit pouvoir marcher sur tous les sites, s'adapter » ; « hors de question qu'il y ait encore une
//  erreur ». Le banc `scripts/bancs/ext-adaptatif.cjs` joue les PAGES (Vinted, Leboncoin, Vestiaire, eBay) ; cet audit
//  juge le FOND (le VRAI background.js dans `_fond-vm.cjs`) et le manifeste :
//   M1  la couche de repérage (vrm-trouver.js) est chargée AVANT lbc-ecrire.js, vc-ecrire.js et ebay.js, dans le même
//       monde (isolé), cadre principal ;
//   P1  chaque arrêt « élément » dit en mots simples CE QUI MANQUE (le bouton par son nom à l'écran, jamais un nom de
//       code comme « message-envoyer »), « rien n'est parti », et UN geste (« Geste : … ») ;
//   P2  un élément en double se dit « deux … pareils » (VRM ne choisit jamais), jamais « introuvable » ;
//   P3  un bouton des favoris (jamais appris) envoie vers « Envoyer un rapport », un bouton apprenable vers « relance » ;
//   J1  ce que la couche a vu sur Leboncoin / Vestiaire / eBay (`trouveJournal`) va dans la mémoire de CE site
//       (`vrmTrouve_lbc`…), jamais dans celle de Vinted ; le site est celui de l'ONGLET, pas celui que le message dit ;
//   J2  rien trouvé ⇒ une entrée au journal (`vrmTrouverJournal`, avec son site, les stratégies et leurs comptes —
//       aucun texte) et le compteur `trouve_rien_<site>_<élément>` ;
//   J3  un message d'un cadre (iframe) ou d'un autre site n'écrit rien ;
//   J4  une nouvelle version de la page d'un site vide la mémoire de CE site seulement ;
//   S1–S5  la SANTÉ par site (`santeSites`) : « pas encore vu » / « tout marche » / « X ne marche plus : Geste … » ; une
//       forme de réponse changée passe avant (« … attend la correction ») ; chaque nouveau problème dit UNE fois (notification) ;
//   R1–R4  la page pas prête se rattrape seule : rechargée UNE fois, le même ordre repart ; jamais après un clic final ;
//   T   « Envoyer un rapport » porte le journal de repérage et les 20 derniers arrêts (étiquettes, jamais un texte) ;
//   V   une version dépassée lit toujours mais ne fait pas un geste dont la règle a changé (`regles` servies) ;
//   A   au démarrage, chaque onglet ouvert d'un site est sondé : sans VRM ⇒ rechargé UNE fois (jamais un formulaire ni
//       l'onglet regardé) ou dit (« recharge cet onglet ») ;
//   G1  garde-fous §3 inchangés : `vintedPage` refuse toute méthode ≠ GET ; aucun `chrome.debugger`, aucune
//       permission `debugger` ; plafond 50/h et réserve 5 ; 15/h favoris.
//  `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = { src: arg('--src', path.join(EXT, 'background.js')), manifeste: arg('--manifeste', path.join(EXT, 'manifest.json')) };

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['codeBrut', 'src', 'const PHRASE_ELEMENT = (m) => phraseElement(m);', "const PHRASE_ELEMENT = (m) => `Vinted a changé sa page (élément « ${String(m || '?')} » introuvable ou en double) : VRM s'arrête proprement, rien n'est parti.`;"],
    ['sansGeste', 'src', '  return `${quoi} : rien n\'est parti. ${geste}`;', '  return `${quoi} : rien n\'est parti.`;'],
    ['ambiguDitIntrouvable', 'src', '  const ambigu = /-ambigue?$/.test(brut);', '  const ambigu = false;'],
    ['memoireMelangee', 'src', "const cleTrouveSite = (site) => (!site || site === 'vinted' ? TROUVE_CLE : TROUVE_CLE + '_' + site);", 'const cleTrouveSite = (site) => TROUVE_CLE;'],
    ['siteDuMessage', 'src', "if (!site || (sender && sender.frameId > 0) || !sender || sender.id !== chrome.runtime.id) { sendResponse({ ok: false }); return; }", "site = site || String(msg.site || ''); if (!site) { sendResponse({ ok: false }); return; }"],
    ['sansJournal', 'src', "if (journal.length) { const j = (await chrome.storage.local.get(TROUVE_JOURNAL))[TROUVE_JOURNAL];", "if (false) { const j = (await chrome.storage.local.get(TROUVE_JOURNAL))[TROUVE_JOURNAL];"],
    ['repriseApresGeste', 'src', "return !!(rep && rep.ok === true && !rep.statut && rep.geste !== true && rep.envoye !== true && rep.tape !== true && CODES_PAGE_PAS_PRETE.has(String(rep.erreur || '')));", "return !!(rep && rep.ok === true && !rep.statut);"],
    ['sansReprise', 'src', "    if (repriseSeule(rep)) {\n      noterDiag('lbc_reprise_'", "    if (false) {\n      noterDiag('lbc_reprise_'"],
    ['notifRepetee', 'src', "        if (dits[site] === cle) continue;\n", ''],
    ['formeTaisee', 'src', "    if (site === 'vc') { const c = st.vrmVcCapte || {};", "    if (false) { const c = st.vrmVcCapte || {};"],
    ['jamaisGueri', 'src', "const ok = el[e.nom]; if (ok && Number(ok.at || 0) > Number(e.at || 0)) continue;", 'const ok = null;'],
    ['rapportSansReperage', 'src', "    reperage: (Array.isArray(local[TROUVE_JOURNAL])", "    sansReperage: (Array.isArray(local[TROUVE_JOURNAL])"],
    ['regleIgnoree', 'src', "  { const dep = await regleDepassee('vinted:' + geste); if (dep) {", "  { const dep = null; if (dep) {"],
    ['rechargeSansPrudence', 'src', "    const prudent = actifs.has(t.id) || RE_FORMULAIRE_ONGLET.test(String(t.url || ''));", '    const prudent = false;'],
    ['rechargeRepetee', 'src', "    if (!prudent && !deja[t.id]) {", '    if (!prudent) {'],
    ['ongletTaisu', 'src', "    if (!v && st.vrmOngletsSansVrm && Number(st.vrmOngletsSansVrm[site]) > 0) v =", '    if (false) v ='],
    ['trouverApres', 'manifeste', '"vrm-trouver.js",\n        "lbc-ecrire.js"', '"lbc-ecrire.js",\n        "vrm-trouver.js"'],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ext-adaptatif-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`);
    if (!rouge) tous = false;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(tous ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };

(async () => {
  // ── M1 : le manifeste ──
  {
    let man = null; try { man = JSON.parse(fs.readFileSync(F.manifeste, 'utf8')); } catch (_) { man = null; }
    const cs = (man && man.content_scripts) || [];
    for (const [f, site] of [['lbc-ecrire.js', 'leboncoin'], ['vc-ecrire.js', 'vestiairecollective'], ['ebay.js', 'ebay']]) {
      const c = cs.find((x) => (x.js || []).includes(f));
      const i = c ? c.js.indexOf('vrm-trouver.js') : -1, j = c ? c.js.indexOf(f) : -1;
      dit(!!c && i >= 0 && i < j && !c.world && c.all_frames !== true && (c.matches || []).some((m) => m.includes(site)), `M1 ${f} : vrm-trouver.js chargé AVANT lui, monde isolé, cadre principal (${site})`, JSON.stringify(c && c.js));
    }
  }
  const BG = fs.readFileSync(F.src, 'utf8');
  // ── G1 : garde-fous ──
  {
    dit(!/chrome\.debugger|"debugger"/.test(BG) && !/"debugger"/.test(fs.readFileSync(F.manifeste, 'utf8')), 'G1 aucun chrome.debugger, aucune permission « debugger » (vrais clics refusés, §3)');
    dit(/const ACTIONS_MAX_HEURE = 50;/.test(BG), 'G1 plafond 50 actions/heure inchangé');
    dit(/const FAVORIS_HEURE_MAX = 15;/.test(BG), 'G1 15 messages aux favoris par heure inchangé');
    const vp = /async function vintedPage\([^]*?\n\}/.exec(BG);
    dit(!!vp && /toUpperCase\(\) !== 'GET'\) \{ noterDiag\('ecriture_requete_refusee'\)/.test(vp[0]), 'G1 `vintedPage` refuse toute méthode ≠ GET (aucune écriture fabriquée par VRM)');
    dit(/RESERVE_GESTES\s*=\s*5\b/.test(BG), 'G1 réserve de 5 gestes inchangée');
  }
  const f = faireFond({ src: F.src, connecte: '3175765377' });
  const c = f.ctx;
  // ── P : les phrases ──
  {
    // La phrase que voient les étapes (`PHRASE_ELEMENT`, une constante du fond : lue DANS le contexte du vrai fichier).
    const pe = (m) => { try { return String(require('vm').runInContext('PHRASE_ELEMENT(' + JSON.stringify(m) + ')', c)); } catch (_) { return ''; } };
    const env = pe('message-envoyer');
    dit(/« Envoyer »/.test(env) && !/message-envoyer/.test(env), 'P1 « message-envoyer » se dit « le bouton « Envoyer » », jamais le nom de code', env);
    dit(/rien n'est parti/.test(env) && /Geste : /.test(env), 'P1 la phrase dit « rien n\'est parti » et UN geste', env);
    const sup = pe('supprimer-confirmation-ambigu');
    dit(/deux boutons « Confirmer et supprimer »/.test(sup) && /ne choisit jamais/.test(sup) && !/ne trouve plus/.test(sup), 'P2 en double ⇒ « deux boutons … pareils, VRM ne choisit jamais » (pas « introuvable »)', sup);
    const cl = pe('cloche');
    dit(/« Notifications »/.test(cl) && /Envoyer un rapport/.test(cl) && /vinted\.fr/.test(cl), 'P3 la cloche des favoris (jamais apprise) ⇒ « fais-le toi-même sur vinted.fr » + « Envoyer un rapport »', cl);
    const aj = pe('ajouter');
    dit(/« Ajouter »/.test(aj) && /relance/.test(aj) && /toucher ce bouton UNE fois/.test(aj), 'P3 un bouton apprenable (« Ajouter ») ⇒ « relance ; VRM te demandera de le toucher une fois »', aj);
    let pp = ''; try { pp = require('vm').runInContext("PHRASE_PAS_PRETE('message-envoyer', 2)", c); } catch (_) { pp = ''; }
    dit(/« Envoyer »/.test(pp) && /2 nouveaux essais/.test(pp) && /Geste : /.test(pp) && !/message-envoyer/.test(pp), 'P1 après deux nouveaux essais : même phrase simple, le geste', pp);
  }
  // ── J : mémoire et journal par site ──
  {
    const onglet = (url, frameId) => ({ id: chrome_id(c), tab: { id: 31, url }, frameId: frameId || 0 });
    function chrome_id(cx) { try { return cx.chrome.runtime.id; } catch (_) { return 'ext'; } }
    const trouves = [{ nom: 'champMessage', s: 'indication', ambigu: false, essais: [] }, { nom: 'envoyer', s: '', ambigu: false, essais: [{ s: 'nom', n: 0 }, { s: 'testid', n: 2 }] }];
    const r1 = await f.envoyer({ from: 'cancale-lbc', action: 'trouveJournal', etape: 'message', trouves, verPage: 'buildA', site: 'vinted' }, onglet('https://www.leboncoin.fr/messages/id/abc'));
    const st = f.store;
    dit(r1 && r1.ok === true && st.vrmTrouve_lbc && st.vrmTrouve_lbc.el && st.vrmTrouve_lbc.el.champMessage && st.vrmTrouve_lbc.el.champMessage.s === 'indication', 'J1 le gagnant sur Leboncoin va dans `vrmTrouve_lbc` (le site de l\'ONGLET, pas celui que le message dit)', JSON.stringify({ r1, m: st.vrmTrouve_lbc }));
    dit(!st.vrmTrouve || !st.vrmTrouve.el || !st.vrmTrouve.el.champMessage, 'J1 la mémoire de Vinted n\'est pas touchée', JSON.stringify(st.vrmTrouve));
    const jl = st.vrmTrouverJournal || [];
    const e = jl.find((x) => x.nom === 'envoyer');
    dit(!!e && e.site === 'lbc' && Array.isArray(e.essais) && e.essais.some((q) => q.s === 'testid' && q.n === 2) && !JSON.stringify(e).match(/Bonjour|texte/), 'J2 rien trouvé ⇒ une entrée au journal (site, stratégies et comptes, aucun texte)', JSON.stringify(jl));
    dit(f.j.diags.includes('trouve_rien_lbc_envoyer') && f.j.diags.includes('trouve_lbc_champMessage_indication'), 'J2 compteurs `trouve_rien_lbc_envoyer` et `trouve_lbc_champMessage_indication`', JSON.stringify(f.j.diags.filter((d) => /trouve/.test(d))));
    const avant = JSON.stringify(st.vrmTrouve_vc || null);
    const r2 = await f.envoyer({ from: 'cancale-vc', action: 'trouveJournal', etape: 'message', trouves, verPage: 'x' }, onglet('https://www.vestiairecollective.com/messages/1', 2));
    const r3 = await f.envoyer({ from: 'cancale-vc', action: 'trouveJournal', etape: 'message', trouves, verPage: 'x' }, onglet('https://evil.example/vestiairecollective.com'));
    dit(!(r2 && r2.ok) && !(r3 && r3.ok) && JSON.stringify(st.vrmTrouve_vc || null) === avant, 'J3 un cadre (iframe) ou un autre site n\'écrit rien', JSON.stringify({ r2, r3, vc: st.vrmTrouve_vc }));
    await f.envoyer({ from: 'cancale-ebay', action: 'trouveJournal', etape: 'depot', trouves: [{ nom: 'titre', s: 'libelle', essais: [] }], verPage: 'e1' }, onglet('https://www.ebay.fr/sl/sell'));
    await f.envoyer({ from: 'cancale-lbc', action: 'trouveJournal', etape: 'message', trouves: [{ nom: 'champPrix', s: 'cle', essais: [] }], verPage: 'buildB' }, onglet('https://www.leboncoin.fr/ad/1'));
    dit(st.vrmTrouve_lbc && st.vrmTrouve_lbc.ver === 'buildB' && !st.vrmTrouve_lbc.el.champMessage && st.vrmTrouve_lbc.el.champPrix && st.vrmTrouve_ebay && st.vrmTrouve_ebay.el.titre && st.vrmTrouve_ebay.el.titre.s === 'libelle', 'J4 une nouvelle version de Leboncoin vide la mémoire de Leboncoin seulement (eBay garde la sienne)', JSON.stringify({ lbc: st.vrmTrouve_lbc, ebay: st.vrmTrouve_ebay }));
    const mem = await c.memoireTrouver('lbc');
    dit(mem && mem.champPrix === 'cle' && !mem.champMessage, 'J4 la mémoire relue par site', JSON.stringify(mem));
  }
  // ── S : la santé par site (une ligne) et la notification UNE fois ──
  {
    const g = faireFond({ src: F.src, connecte: '3175765377' });
    const notifs = [];
    g.ctx.chrome.notifications = { create: (id, o, cb) => { notifs.push({ id, o }); if (cb) cb(id); } };
    const st = g.store, maintenant = Date.now();
    let v = await g.ctx.santeSites();
    dit(v && v.ebay && v.ebay.k === 'pas-vu' && /pas encore vu/.test(v.ebay.t), 'S1 un site jamais vu ici ⇒ « pas encore vu dans ce Chrome » (pas « tout marche »)', JSON.stringify(v && v.ebay));
    st.vrmTrouve_lbc = { v: 1, ver: 'b', el: { champMessage: { s: 'indication', ver: 'b', at: maintenant - 1000 } } };
    v = await g.ctx.santeSites();
    dit(v.lbc.ok === true && v.lbc.t === 'Leboncoin : tout marche.', 'S1 Leboncoin vu, rien de cassé ⇒ « Leboncoin : tout marche. »', JSON.stringify(v.lbc));
    st.vrmTrouverJournal = [{ site: 'lbc', nom: 'envoyer', etape: 'message', at: maintenant - 500, ambigu: false, essais: [] }, { site: 'vinted', nom: 'supprimerConfirmer', etape: 'supprimer', at: maintenant - 400, ambigu: true, essais: [] }];
    await g.ctx.majSanteSites();
    v = st.vrmSanteSites && st.vrmSanteSites.sites;
    dit(v && v.lbc.ok === false && /Leboncoin : le bouton « Envoyer » ne marche plus/.test(v.lbc.t) && /Geste : fais ce geste une fois toi-même sur leboncoin\.fr/.test(v.lbc.t), 'S2 « Envoyer » introuvable sur Leboncoin ⇒ « … ne marche plus. Geste : … »', JSON.stringify(v && v.lbc));
    dit(v && v.vinted.ok === false && /deux boutons « Confirmer et supprimer »/.test(v.vinted.t) && /Geste : /.test(v.vinted.t), 'S2 Vinted : la confirmation en double, dite avec son geste', JSON.stringify(v && v.vinted));
    const n1 = notifs.length;
    await g.ctx.majSanteSites(); await g.ctx.majSanteSites();
    dit(n1 === 2 && notifs.length === 2 && notifs.every((x) => /^vrm-sante-/.test(x.id)), 'S3 chaque nouveau problème est dit UNE fois (notification), jamais répété', JSON.stringify(notifs.map((x) => x.id)));
    st.vrmTrouve_lbc.el.envoyer = { s: 'nom', ver: 'b', at: maintenant };
    await g.ctx.majSanteSites();
    v = st.vrmSanteSites.sites;
    dit(v.lbc.ok === true && !st.vrmSanteSites.dits.lbc, 'S4 l’élément retrouvé depuis ⇒ « tout marche » revient (le journal plus ancien ne compte plus)', JSON.stringify(v.lbc));
    st.vrmFormesVues = { '3175765377': { orders_sold: { at: maintenant, sig: 'x' } } };
    st.vrmVcCapte = { annonces: { at: maintenant, n: 0, inconnu: true } };
    await g.ctx.majSanteSites();
    v = st.vrmSanteSites.sites;
    dit(/^Vinted a changé sa page des ventes : VRM ne la lit plus et n'en range rien de faux ; il attend la correction/.test(v.vinted.t) && v.vinted.k === 'forme', 'S5 une réponse de forme changée passe AVANT un bouton : « Vinted a changé sa page des ventes : VRM attend la correction »', v.vinted.t);
    dit(/^Vestiaire a changé sa page/.test(v.vc.t) && notifs.some((x) => x.id === 'vrm-sante-vc'), 'S5 Vestiaire : forme inconnue dite (ligne + une notification)', JSON.stringify(v.vc));
    dit(notifs.filter((x) => x.id === 'vrm-sante-vinted').length === 2, 'S5 la forme de Vinted est un NOUVEAU problème : dit une fois de plus, pas davantage', JSON.stringify(notifs.map((x) => x.id)));
  }
  // ── T : « Envoyer un rapport » porte le journal de repérage et les derniers arrêts — jamais un texte, jamais un pseudo ──
  {
    const g = faireFond({ src: F.src, connecte: '3175765377' });
    g.store.vrmTrouverJournal = [{ site: 'lbc', nom: 'envoyer', etape: 'message', at: Date.now() - 1000, ambigu: true, essais: [{ s: 'nom', n: 2 }, { s: 'testid', n: 0 }] }, { site: 'vc', nom: 'Bonjour sophie_b', etape: 'x', at: Date.now(), essais: [] }];
    await g.ctx.noterArret('vinted', 'supprimer', 'supprimer-confirmation-ambigu');
    await g.ctx.noterArret('lbc', 'message', 'Bonjour Sophie 06 12 34 56 78');
    const r = await g.ctx.construireRapport();
    const txt = JSON.stringify(r);
    dit(Array.isArray(r.reperage) && r.reperage.some((x) => x.site === 'lbc' && x.nom === 'envoyer' && x.ambigu === true && x.essais.some((q) => q.s === 'nom' && q.n === 2)), 'T le rapport porte le journal de repérage (site, élément, stratégies et comptes)', JSON.stringify(r.reperage));
    dit(Array.isArray(r.arrets) && r.arrets.some((x) => x.site === 'vinted' && x.geste === 'supprimer' && x.code === 'supprimer-confirmation-ambigu'), 'T le rapport porte les derniers arrêts (site, geste, code)', JSON.stringify(r.arrets));
    dit(!/Bonjour|sophie|Sophie|06 12/.test(txt), 'T jamais un texte de page ni un pseudo (étiquettes seulement)', txt.slice(0, 400));
    const S = await import(path.join(__dirname, '..', 'api', '_lib', 'rapport-extension.js'));
    const n = S.normaliserRapportExt(r, Date.now());
    dit(n && Array.isArray(n.reperage) && n.reperage.length === r.reperage.length && Array.isArray(n.arrets) && n.arrets.length === r.arrets.length && !/Bonjour|sophie/.test(JSON.stringify(n)), 'T le serveur les garde (liste blanche, étiquettes)', JSON.stringify(n && { a: n.arrets, r: n.reperage }).slice(0, 300));
  }
  // ── V : une version dépassée lit toujours, mais ne fait pas un geste dont la règle a changé ──
  {
    const g = faireFond({ src: F.src, connecte: '3175765377' });
    const f0 = g.ctx.fetch;
    const servi = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'extension-version.json'), 'utf8'));
    dit(servi && servi.regles && /^\d+\.\d+\.\d+$/.test(servi.regles['vinted:supprimer'] || ''), 'V0 vrm.center/extension-version.json porte la liste `regles` (vinted:supprimer)', JSON.stringify(servi));
    g.ctx.fetch = async (u, o) => (/extension-version\.json/.test(String(u)) ? { ok: true, status: 200, json: async () => ({ version: '9.1.0', regles: { 'vinted:supprimer': '9.1.0', 'lbc:message': '9.0.0', 'pas une cle': '9.1.0', 'vc:message': 'abc' } }) } : f0(u, o));
    await g.ctx.versionServieConnue({ attendre: true });
    const vs = g.store.vrmVersionServie || {};
    dit(vs.v === '9.1.0' && vs.regles && vs.regles['vinted:supprimer'] === '9.1.0' && !('pas une cle' in vs.regles) && !('vc:message' in vs.regles), 'V1 les règles servies sont lues et filtrées (clé site:geste, version valide)', JSON.stringify(vs));
    const acc = { vinted_user_id: '3175765377', login: 'x', domain: 'www.vinted.fr' };
    const r = await g.ctx.interfaceVinted(acc, 'supprimer', { id: '123456' });
    dit(r && r.rienParti === true && /\(5\.448\.0\) suit une ancienne règle/.test(r.raison || '') && /installe la 9\.1\.0/.test(r.raison || '') && /les lectures continuent/.test(r.raison || ''), 'V2 version dépassée pour « supprimer » ⇒ rien ne part, la phrase dit la version et LE geste', JSON.stringify(r).slice(0, 400));
    const lbc = await require('vm').runInContext("_fileCourante = { uid: 'lbc:moi1' }; gesteLbcInterface('message', 'moi1', 'https://www.leboncoin.fr/x', {}, 1000)", g.ctx);
    dit(lbc && lbc.rien === true && lbc.code === 'version-depassee', 'V3 Leboncoin : même règle (aucun onglet ouvert)', JSON.stringify(lbc).slice(0, 200));
    const autre = await g.ctx.regleDepassee('vinted:message');
    dit(autre === null, 'V4 un geste dont la règle n’a pas changé n’est pas bloqué', String(autre));
  }
  // ── A : au démarrage, l'extension se contrôle dans chaque onglet ouvert ──
  {
    const g = faireFond({ src: F.src, connecte: '3175765377' });
    const c3 = g.ctx; const recharges = [], sess = {};
    const tabs = [
      { id: 1, url: 'https://www.leboncoin.fr/recherche?q=nike', status: 'complete', active: false },     // sans VRM, en fond ⇒ rechargé
      { id: 2, url: 'https://www.vinted.fr/items/new', status: 'complete', active: false },               // sans VRM, formulaire ⇒ jamais rechargé, dit
      { id: 3, url: 'https://www.vestiairecollective.com/', status: 'complete', active: true },           // sans VRM, onglet regardé ⇒ jamais rechargé, dit
      { id: 4, url: 'https://www.ebay.fr/', status: 'complete', active: false },                          // VRM présent ⇒ rien
      { id: 5, url: 'https://exemple.org/', status: 'complete', active: false },                         // autre site ⇒ jamais sondé
    ];
    const sondes = [];
    c3.chrome.tabs.query = async (q) => (q && q.active ? tabs.filter((t) => t.active) : tabs);
    c3.chrome.tabs.reload = async (id) => { recharges.push(id); };
    c3.chrome.storage.session = { get: async (k) => ({ [k]: sess[k] }), set: async (o) => { Object.assign(sess, o); } };
    c3.chrome.scripting.executeScript = async (o) => { sondes.push(o.target.tabId); return [{ result: o.target.tabId === 4 }]; };
    const notifs = []; c3.chrome.notifications = { create: (id, o, cb) => { notifs.push(id); if (cb) cb(id); } };
    const r1 = await c3.autoControleOnglets();
    dit(recharges.join() === '1' && !sondes.includes(5), 'A1 un onglet Leboncoin sans VRM, en fond ⇒ rechargé UNE fois ; un autre site jamais sondé', JSON.stringify({ recharges, sondes, r1 }));
    dit(!recharges.includes(2) && !recharges.includes(3), 'A2 un formulaire ou l’onglet regardé n’est JAMAIS rechargé (un texte en cours ne se perd pas)', JSON.stringify(recharges));
    await new Promise((x) => setTimeout(x, 50));
    const v = (g.store.vrmSanteSites || {}).sites || {};
    dit(/recharge cet onglet Vinted/.test((v.vinted || {}).t || '') && /recharge cet onglet Vestiaire/.test((v.vc || {}).t || ''), 'A3 ce qui n’est pas rechargé est DIT : « … recharge cet onglet … » (ligne de santé)', JSON.stringify({ vi: v.vinted, vc: v.vc }));
    await c3.autoControleOnglets();
    dit(recharges.join() === '1', 'A4 au contrôle suivant, l’onglet déjà rechargé ne l’est pas une 2e fois (borné)', JSON.stringify(recharges));
  }
  // ── X : les champs publiés dans `ext_appareil_*` pour l'app (codes seulement) ──
  {
    const g = faireFond({ src: F.src, connecte: '3175765377' });
    g.store.vrmTrouverJournal = [{ site: 'lbc', nom: 'envoyer', etape: 'message', at: Date.now(), essais: [] }];
    g.store.vrmVersionServie = { v: '9.0.0', at: Date.now(), regles: {} };
    await g.ctx.noterArret('lbc', 'message', 'champ-introuvable');
    const x = await g.ctx.champsSanteAppareil();
    dit(x && x.sante && x.sante.lbc && x.sante.lbc.k === 'element' && x.sante.lbc.nom === 'envoyer' && x.arret && x.arret.code === 'champ-introuvable' && x.servie === '9.0.0' && x.depassee === true && !/ /.test(JSON.stringify(x.sante)), 'X ext_appareil porte sante{site:{k,nom}}, arret{site,geste,code,at}, servie, depassee — des codes, aucune phrase', JSON.stringify(x));
  }
  // ── R : la page pas prête se rattrape seule (Leboncoin, Vestiaire), une fois, jamais après un geste ──
  {
    const vmm = require('vm');
    const essai = async (reponses) => {
      const g = faireFond({ src: F.src, connecte: '3175765377' });
      const c2 = g.ctx; const envois = []; let recharges = 0;
      c2.chrome.tabs.create = async (o) => ({ id: 77, url: o.url });
      c2.chrome.tabs.remove = async () => {};
      c2.chrome.tabs.get = async () => ({ id: 77, status: 'complete' });
      c2.chrome.tabs.reload = async () => { recharges++; };
      c2.chrome.tabs.sendMessage = async (id, m) => { if (m.action === 'lbcEcrirePret') return { ok: true, canal: true }; envois.push(m.action); return reponses[Math.min(envois.length - 1, reponses.length - 1)]; };
      vmm.runInContext("attendreSessionOnglet = async () => ({ compte: 'lbc-account:moi1' }); _fileCourante = { uid: 'lbc:moi1' };", c2);
      const r = await vmm.runInContext("gesteLbcInterface('message', 'moi1', 'https://www.leboncoin.fr/messages/id/abc', { conv: 'abc', texte: 'x' }, 5000)", c2);
      return { r, envois, recharges };
    };
    const a1 = await essai([{ ok: true, statut: 0, erreur: 'conversation-pas-chargee' }, { ok: true, statut: 200, confirme: true }]);
    dit(a1.recharges === 1 && a1.envois.length === 2 && a1.r.rep && a1.r.rep.statut === 200, 'R1 Leboncoin : conversation pas encore chargée (rien parti) ⇒ onglet rechargé UNE fois, le même ordre repart et passe', JSON.stringify(a1));
    const a2 = await essai([{ ok: true, statut: 0, erreur: 'conversation-pas-chargee' }, { ok: true, statut: 0, erreur: 'conversation-pas-chargee' }]);
    dit(a2.recharges === 1 && a2.envois.length === 2 && a2.r.rep.erreur === 'conversation-pas-chargee', 'R2 toujours pas prête ⇒ arrêt après UN nouvel essai (borné), la raison d’avant', JSON.stringify(a2));
    const a3 = await essai([{ ok: true, statut: 0, erreur: 'pas-vu', geste: true, envoye: true }]);
    dit(a3.recharges === 0 && a3.envois.length === 1, 'R3 un clic final fait (« pas vu ») ⇒ JAMAIS relancé (aucun geste deux fois)', JSON.stringify(a3));
    const a4 = await essai([{ ok: true, statut: 0, erreur: 'champ-ambigu' }]);
    dit(a4.recharges === 0 && a4.envois.length === 1, 'R4 un élément ambigu n’est pas « pas prêt » : arrêt, pas de nouvel essai', JSON.stringify(a4));
  }
  console.log(`\n${ko ? '❌' : '✅'} extension adaptative (fond) : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
