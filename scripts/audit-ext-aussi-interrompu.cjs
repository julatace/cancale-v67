#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  « PUBLIER AUSSI SUR… » : LE SERVICE WORKER MEURT PENDANT LE DÉPÔT (22 nov., audit complet de l'extension, §4.9)
//
//  Le déroulé d'un dépôt Leboncoin / Vestiaire (`deroulerAussi`, 5.428) vit dans le service worker. Chrome peut l'arrêter
//  en route. Mesuré sur la 5.436.0 : le dépôt restait « en cours » pour toujours dans `vrmAussiJobs` — le panneau, qui
//  relit `publierAussiEtat` toutes les secondes jusqu'à « fini », tournait dans le vide ; et un nouveau dépôt était refusé
//  (« Une publication est déjà en cours ») pendant 15 minutes.
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs) : un worker NEUF démarre sur le `chrome.storage.local` laissé
//  par un worker mort (un dépôt « en cours », trois paires à trois moments différents). On juge :
//   I1  `publierAussiEtat` rend le dépôt FINI (plus jamais « en cours ») ;
//   I2  la paire qui n'avait pas commencé : « arrêtée », « rien n'est parti » ;
//   I3  la paire en cours AVANT le clic « Publier » : « arrêtée avant Publier » ;
//   I4  la paire dont la publication était notée (`envol`) : « pas su », « VRM ne reclique jamais » — et sa note reste
//       (elle ne repartira pas toute seule) ;
//   I5  chaque état porte une raison (jamais un état sans phrase) ;
//   I6  un dépôt MENÉ PAR CE WORKER n'est jamais déclaré interrompu ;
//   I7  la note `envol` illisible (stockage en panne) ⇒ « pas su », jamais « rien n'est publié ».
//  `--src <background.js>` : une autre copie (rouge attendu sur la 5.436.0 d'avant) ; `--mutation nom` ; `--prouve`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
let BG = cheminSource();
const MUTATIONS = {
  // Le dépôt d'un worker mort n'est plus fini.
  'jamais-fini': ["      j.etat = 'fini';\n    });\n  }\n  noterDiag('aussi_interrompu');", "    });\n  }\n  noterDiag('aussi_interrompu');"],
  // Une publication déjà notée est dite « rien n'est publié » (faux : elle est peut-être en ligne).
  'envol-dit-arrete': ["if (!faits || (f && f.etat === 'envol')) Object.assign(x, { etat: 'pas-su'", "if (false) Object.assign(x, { etat: 'pas-su'"],
  // Le dépôt mené par CE worker est pris pour un dépôt orphelin.
  'tue-le-vivant': ["jobs[id].etat === 'en-cours' && !_aussiIci.has(id));", "jobs[id].etat === 'en-cours');"],
};
const argMut = (() => { const a = process.argv.find((x) => x.startsWith('--mutation=')); if (a) return a.slice(11); const i = process.argv.indexOf('--mutation'); return i > 0 ? process.argv[i + 1] : ''; })();
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge (le contrôle ne la voit pas)'}`);
    if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
if (argMut) {
  const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue : ' + argMut); process.exit(2); }
  const s = fs.readFileSync(BG, 'utf8');
  if (!s.includes(M[0])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
  BG = path.join(os.tmpdir(), `bg-aussi-interrompu-${argMut}-${process.pid}.js`);
  fs.writeFileSync(BG, s.split(M[0]).join(M[1]));
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 600) : '')); } };
const ONGLET = { tab: { id: 7, url: 'https://www.vinted.fr/catalog', active: true, windowId: 1 }, frameId: 0 };
const T0 = Date.now();
// Ce qu'un worker mort a laissé : un dépôt « en cours » (commencé il y a 4 min, dernière étape il y a 3 min).
const laisse = () => ({
  vrmAussiJobs: { 'aussi-mort': { uid: '111', at: T0 - 240000, maj: T0 - 180000, etat: 'en-cours', sites: ['leboncoin'], stop: false, articles: [
    { id: '7001', numero: '121', titre: 'Adidas Samba OG noires 40', sites: { leboncoin: { etat: 'en-cours', compte: 'c1', etapes: { verifie: T0 - 200000, onglet: T0 - 195000, compte: T0 - 190000, champs: T0 - 185000, relu: T0 - 182000 }, envoi: {}, attendu: {} } } },
    { id: '7002', numero: '122', titre: 'New Balance 550 crème 41', sites: { leboncoin: { etat: 'en-cours', compte: 'c1', etapes: { verifie: T0 - 181000, onglet: T0 - 180500 }, envoi: {}, attendu: {} } } },
    { id: '7003', numero: '123', titre: 'Puma Suede bleues 42', sites: { leboncoin: { etat: 'attente', compte: 'c1', etapes: {}, envoi: {}, attendu: {} } } },
  ] } },
  vrmAussiFaits: { 'leboncoin:121': { etat: 'envol', at: T0 - 181500, tabId: 31, vinted: '7001' } },
});
const sitesDe = (job) => Object.fromEntries((job.articles || []).map((a) => [a.numero, a.sites.leboncoin]));

(async () => {
  console.log('Un worker neuf, sur le stockage laissé par un worker mort pendant un dépôt');
  {
    const store = laisse();
    const f = faireFond({ src: BG, connecte: '111', store });
    f.ctx.compteConnecte = async () => '111';
    const r = await f.envoyer({ from: 'vrm-badge', action: 'publierAussiEtat', jobId: 'aussi-mort' }, ONGLET);
    const job = (r && r.job) || {}, S = job.articles ? sitesDe(job) : {};
    dit(r && r.ok === true && job.etat === 'fini', 'I1 le dépôt est FINI (le panneau ne tourne plus dans le vide)', JSON.stringify(r && r.job && r.job.etat));
    dit(S['123'] && S['123'].etat === 'arrete' && /rien n’est parti/i.test(S['123'].raison || ''), 'I2 la paire pas commencée : arrêtée, « rien n’est parti »', JSON.stringify(S['123']));
    dit(S['122'] && S['122'].etat === 'arrete' && /avant « Publier »/.test(S['122'].raison || '') && /rien n’est publié/.test(S['122'].raison || ''), 'I3 la paire en cours avant le clic : « arrêté avant Publier, rien n’est publié »', JSON.stringify(S['122']));
    dit(S['121'] && S['121'].etat === 'pas-su' && /ne reclique jamais/.test(S['121'].raison || '') && !/rien n’est publié/.test(S['121'].raison || ''), 'I4 la paire dont la publication était notée : « pas su », jamais « rien n’est publié »', JSON.stringify(S['121']));
    dit(store.vrmAussiFaits['leboncoin:121'] && store.vrmAussiFaits['leboncoin:121'].etat === 'envol', 'I4 sa note « en train de partir » reste : elle ne repart pas toute seule');
    dit(['121', '122', '123'].every((n) => S[n] && String(S[n].raison || '').length > 20), 'I5 chaque état porte sa phrase', JSON.stringify(Object.values(S).map((x) => x && x.raison)));
    dit(store.vrmAussiJobs['aussi-mort'].etat === 'fini', 'I1 l’état FINI est rangé (un second regard ne le rejoue pas)');
    const r2 = await f.envoyer({ from: 'vrm-badge', action: 'publierAussiEtat', jobId: 'aussi-mort' }, ONGLET);
    dit(JSON.stringify(r2 && r2.job && sitesDe(r2.job)) === JSON.stringify(S), 'I1 relu une seconde fois : les mêmes états, rien ne change');
  }
  console.log('Un dépôt mené par CE worker');
  {
    const f = faireFond({ src: BG, connecte: '111', store: laisse() });
    f.ctx.compteConnecte = async () => '111';
    let vivant = false;
    // (Une `const` du fond n'est pas une propriété du contexte : on la joint par un script dans le même contexte.)
    try { vivant = !!require('vm').runInContext("typeof _aussiIci !== 'undefined' && (_aussiIci.add('aussi-mort'), true)", f.ctx); } catch (_) { vivant = false; }
    const r = await f.envoyer({ from: 'vrm-badge', action: 'publierAussiEtat', jobId: 'aussi-mort' }, ONGLET);
    dit(vivant && r && r.ok && r.job && r.job.etat === 'en-cours', 'I6 le dépôt que ce worker mène reste « en cours »', JSON.stringify({ vivant, etat: r && r.job && r.job.etat }));
  }
  console.log('La note de publication illisible');
  {
    const store = laisse();
    const f = faireFond({ src: BG, connecte: '111', store });
    f.ctx.compteConnecte = async () => '111';
    const lire0 = f.ctx.aussiLire;
    f.ctx.aussiLire = async (cle) => (cle === 'vrmAussiFaits' ? null : lire0(cle));
    const r = await f.envoyer({ from: 'vrm-badge', action: 'publierAussiEtat', jobId: 'aussi-mort' }, ONGLET);
    const S = r && r.job && r.job.articles ? sitesDe(r.job) : {};
    dit(S['122'] && S['122'].etat === 'pas-su' && S['121'] && S['121'].etat === 'pas-su' && S['123'] && S['123'].etat === 'arrete', 'I7 note illisible ⇒ ce qui était en cours est « pas su » (jamais « rien n’est publié ») ; ce qui attendait reste « rien n’est parti »', JSON.stringify(Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v && v.etat]))));
  }
  console.log(`\n${ko ? '❌' : '✅'} dépôt « publier aussi » interrompu : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
