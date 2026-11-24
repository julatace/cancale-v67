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
  console.log(`\n${ko ? '❌' : '✅'} extension adaptative (fond) : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
