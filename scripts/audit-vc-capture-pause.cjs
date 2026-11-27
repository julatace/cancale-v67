#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — UNE PAUSE N'ARRÊTE QUE LES GESTES, JAMAIS LA LECTURE VESTIAIRE (27 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  Julien (27 nov.) : « plus rien de Vestiaire n'arrive dans VRM » alors que son app dit
//  « En pause » (« Tout arrêter ») et « Ordinateur éteint ». Hypothèse vérifiée : une pause
//  bloquerait aussi les CAPTURES. CLAUDE.md §3 « Plafond d'actions » : « Tout arrêter », la
//  prudence, un captcha, une pause 429/403, un compte bloqué arrêtent les gestes automatiques ;
//  le budget de LECTURE est à part. Une capture Vestiaire est passive (ce que la page a déjà
//  chargé) : aucune pause ne doit l'arrêter.
//  Le VRAI `background.js` (`_fond-vm.cjs`, base à état), TOUTES les pauses posées en même temps :
//   · « Tout arrêter » de ce Chrome (`vrmToutArrete`) ET de l'app (`vrmDiscretionReglages.tout`) ;
//   · la pause Vinted 429/403 (`vrmPauseVinted`) et la pause Vestiaire (`vrmPauseVc`) ;
//   · la file en pause (« Pause après celle-ci ») ;
//   · Vestiaire a demandé une vérification anti-robot sur CE compte (`secu … robot`).
//  Puis chaque sorte de capture Vestiaire passe par le VRAI écouteur du fond : compte de
//  l'onglet, annonces, compteurs, ventes, achats, conversations, non-lus, fil, offres, « ont
//  aimé », suivi d'une vente. Chacune doit être RANGÉE (ligne écrite), comme sans pause.
//  Mesuré le 27 nov. sur la 5.455.1 : vert (aucune pause ne coupe la lecture) — ce banc est la
//  garde qui empêche de l'introduire. `--src chemin` : une autre copie de background.js.
//  `--prouve` : une garde « Tout arrêter » posée dans un gestionnaire de capture DOIT rougir.
//  Données INVENTÉES uniquement (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const iSrc = process.argv.indexOf('--src');
const SRC = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(racine, 'vinted-sync-extension/background.js');

if (process.argv.includes('--prouve')) {
  const code = fs.readFileSync(SRC, 'utf8');
  const GARDE = "if ((await toutArreteDepuis(null)) > 0) { sendResponse({ ok: false }); return; }\n";
  const ANCRE = (action) => new RegExp("(if \\(msg && msg\\.from === 'cancale-vc' && [^\\n]*'" + action + "'[^\\n]*\\n\\s*\\(async \\(\\) => \\{\\n\\s*try \\{\\n)");
  const MUT = [['annonces', 'vcAnnonces'], ['ventes', 'vcVentes'], ['messages', 'vcCompteur'], ['offres', 'vcOffres'], ['aimes', 'vcAimes'], ['achats', 'vcAchats']];
  let rate = 0;
  for (const [nom, action] of MUT) {
    const re = ANCRE(action);
    if (!re.test(code)) { console.log(`❌ mutation ${nom} : ancre introuvable`); rate++; continue; }
    const f = path.join(os.tmpdir(), `bg-mut-pause-${nom}-${process.pid}.js`);
    fs.writeFileSync(f, code.replace(re, '$1' + GARDE));
    const r = spawnSync(process.execPath, [__filename, '--src', f], { encoding: 'utf8' });
    fs.unlinkSync(f);
    if (r.status === 0) { console.log(`❌ mutation ${nom} : « Tout arrêter » coupe la capture et le banc reste VERT`); rate++; }
    else console.log(`✅ mutation ${nom} : « Tout arrêter » coupe la capture ⇒ rouge`);
  }
  console.log(rate ? `\n❌ --prouve : ${rate} mutation(s) non vue(s)` : '\n✅ --prouve : chaque mutation rougit');
  process.exit(rate ? 1 : 0);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 240) : '')); } };
const ORIGINE = 'https://fr.vestiairecollective.com';
const sender = (tab) => ({ tab: { id: tab, url: ORIGINE + '/members/profile/' }, frameId: 0, url: ORIGINE + '/members/profile/' });

(async () => {
  const t = Date.now(), plusTard = t + 6 * 3600e3;
  const store = {
    vrmToutArrete: { on: true, at: t - 1000 },
    vrmDiscretionReglages: { tout: { on: true, at: t - 500 } },
    vrmPauseVinted: { jusqua: plusTard, niveau: 2, statut: 403, depuis: t - 60000, quoi: 'banc' },
    vrmPauseVc: { jusqua: plusTard, statut: 429, depuis: t - 60000 },
    vrmFile: { v: 1, entrees: [], faites: [], pause: true },
  };
  const f = faireFond({ src: SRC, lignes: {}, store });
  // Vestiaire a demandé une vérification sur CE compte (l'état de sécurité de l'extension).
  try {
    const cle = vm.runInContext("secuCle('vestiaire', '12345')", f.ctx), nomEtat = vm.runInContext('SECU_ETAT', f.ctx);
    const s = f.store[nomEtat] || {}; s.comptes = Object.assign({}, s.comptes, { [cle]: { robot: { at: t - 1000 } } }); f.store[nomEtat] = s;
  } catch (e) { dit(false, 'pose de l’état « vérification anti-robot » Vestiaire', e.message); }
  // Les pauses sont bien VUES par le fond (sinon ce banc ne prouverait rien).
  const ta = await f.ctx.toutArreteDepuis(null).catch(() => 0);
  dit(ta > 0, 'les pauses sont posées : « Tout arrêter » est vu par le fond', String(ta));
  const robot = await vm.runInContext("secuRobotDit('vestiaire', '12345')", f.ctx).catch(() => null);
  dit(robot && robot.code === 'secu-robot', 'les pauses sont posées : « vérification anti-robot » Vestiaire vue par le fond', JSON.stringify(robot));
  const pv = await vm.runInContext('pauseVinted()', f.ctx).catch(() => null);
  dit(!!pv, 'les pauses sont posées : la pause Vinted 429/403 est vue par le fond', JSON.stringify(pv));
  const fp = await vm.runInContext('filePausee()', f.ctx).catch(() => null);
  dit(fp === true, 'les pauses sont posées : la file est « en pause »', JSON.stringify(fp));

  const env = (m, tab = 40) => f.envoyer(Object.assign({ from: 'cancale-vc' }, m), sender(tab));
  const r0 = await env({ action: 'vcMoi', id: '12345', source: 'page', forme: [] });
  dit(r0 && r0.ok === true && f.lignes.vc_session && f.lignes.vc_session.id === '12345', 'pendant les pauses : le compte de l’onglet est rangé (vc_session)', JSON.stringify(r0));
  const moi = '12345';
  const r1 = await env({ action: 'vcAnnonces', items: [{ id: '48100001', titre: 'Paire banc', statut: 'published', prix: { valeur: 90, devise: 'EUR', cle: 'price' } }], offset: 0, total: 1, lus: 1, forme: [], moi });
  const l1 = f.lignes.vc_listings || {};
  dit(r1 && r1.ok === true && l1.items && l1.items['48100001'] && l1.items['48100001'].compte === moi, 'pendant les pauses : les annonces sont rangées (vc_listings), sous le compte de l’onglet', JSON.stringify({ r1, items: Object.keys(l1.items || {}) }));
  const r2 = await env({ action: 'vcCompteurs', compteurs: { enVente: 1, attentePhoto: 0, attenteValidation: 0, vendues: 1, refusees: 0, nonRecues: 0 }, moi });
  dit(r2 && r2.ok === true && f.lignes.vc_listings.compteurs && f.lignes.vc_listings.compteurs[moi], 'pendant les pauses : les compteurs de « Mes articles » sont rangés', JSON.stringify(r2));
  const r3 = await env({ action: 'vcVentes', source: 'a-expedier', ventes: [{ id: '77100001', productId: '48100001', etat: 'to_ship' }], offset: 0, total: 1, lus: 1, forme: [], moi });
  dit(r3 && r3.ok === true && f.lignes.vc_ventes && JSON.stringify(f.lignes.vc_ventes).includes('77100001'), 'pendant les pauses : les ventes sont rangées (vc_ventes)', JSON.stringify(r3));
  const r4 = await env({ action: 'vcAchats', achats: [{ id: '66100001', productId: '48100009', nom: 'Achat banc', etat: 'delivered' }], offset: 0, total: 1, lus: 1, page: '/', forme: [], moi });
  dit(r4 && r4.ok === true && f.lignes.vc_achats && JSON.stringify(f.lignes.vc_achats).includes('66100001'), 'pendant les pauses : les achats sont rangés (vc_achats)', JSON.stringify(r4));
  const r5 = await env({ action: 'vcMessages', conversations: [{ id: '31234567-48100001', productId: '48100001', nonLu: true, date: '2026-11-27T08:00:00.000Z', apercu: 'Bonjour', source: 'stream' }], offset: 0, total: null, lus: 1, page: '/chat/', forme: [], moi });
  dit(r5 && r5.ok === true && f.lignes.vc_messages && JSON.stringify(f.lignes.vc_messages).includes('31234567-48100001'), 'pendant les pauses : les conversations sont rangées (vc_messages)', JSON.stringify(r5));
  const r6 = await env({ action: 'vcCompteur', messages: 2, moi });
  dit(r6 && r6.ok === true && f.lignes.vc_messages.compteurs && f.lignes.vc_messages.compteurs[moi] && f.lignes.vc_messages.compteurs[moi].messages === 2, 'pendant les pauses : les non-lus sont rangés', JSON.stringify(r6));
  const r7 = await env({ action: 'vcFil', conv: '31234567-48100001', messages: [{ id: 'm1', t: 'Bonjour', deMoi: false, at: '2026-11-27T08:00:00.000Z' }], lus: 1, moi });
  dit(r7 && r7.ok === true && f.lignes['vc_fil_31234567-48100001'], 'pendant les pauses : le fil d’une conversation est rangé', JSON.stringify(r7));
  const r8 = await env({ action: 'vcOffres', offres: [{ id: '5510001', produit: '48100001', ouverte: true, aToi: true, offre: 7000, initial: 9000, evenements: [] }], liste: true, page: '/', moi });
  dit(r8 && r8.ok === true && f.lignes.vc_offres && JSON.stringify(f.lignes.vc_offres).includes('5510001'), 'pendant les pauses : les offres sont rangées (vc_offres)', JSON.stringify(r8));
  const r9 = await env({ action: 'vcAimes', aimes: [{ produit: '48100001', acheteur: '31234567', at: '2026-11-27T08:00:00.000Z' }], moi });
  dit(r9 && r9.ok === true && f.lignes.vc_aimes, 'pendant les pauses : « ont aimé » est rangé (vc_aimes, des nombres)', JSON.stringify(r9));
  const r10 = await env({ action: 'vcTimeline', productId: '48100001', transporteur: 'Colissimo', suivi: 'AB123456789FR', statut: 'shipped', etapes: {}, moi });
  dit(r10 && r10.ok === true, 'pendant les pauses : le suivi d’une vente est rangé', JSON.stringify(r10));
  // Et la pause tient toujours pour les GESTES (le banc ne l'a pas levée en route).
  dit((await f.ctx.toutArreteDepuis(null).catch(() => 0)) > 0, '« Tout arrêter » est toujours posé après les captures (seuls les gestes s’arrêtent)');
  console.log(ko ? `\n❌ audit-vc-capture-pause : ${ko} rouge(s)` : `\n✅ audit-vc-capture-pause : ${ok} contrôles — aucune pause ne coupe la lecture Vestiaire`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
