#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LE CONTRAT DES MESSAGES : TOUT CE QUE LE PANNEAU, LES SCRIPTS DE PAGE, LA FENÊTRE ET L'APP PEUVENT
//  ENVOYER AU FOND A UN GESTIONNAIRE QUI RÉPOND (22 nov., audit complet de l'extension)
//
//  Julien, 22 nov. : « audite toute l'extension, ne laisse aucun bug, que tous les boutons marchent ».
//  Un bouton dont le message n'a pas de gestionnaire ne fait RIEN et ne dit rien (le rappel reçoit `undefined`).
//  Un gestionnaire qui lève sur une forme inattendue laisse le panneau sur « … » pour toujours.
//  Cet audit LIT les émetteurs (vrm-badge.js, vrm-action.js, popup.js, content.js, lbc*.js, vc*.js, vrm-depot*.js,
//  vinted-*.js, ebay.js, transp-page.js, oauth-retour.js, vrm-dressing.js, bridge.js ; les `cmd:` de l'app) et
//  EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs) :
//   A. chaque couple (from, action) envoyé depuis un onglet du bon site reçoit une RÉPONSE (jamais le silence) ;
//   B. chaque couple, avec des champs HOSTILES (types faux, null, listes géantes, `confirme: true`), répond
//      encore et ne lève jamais (ni exception, ni promesse rejetée sans gardien) ;
//   C. chaque commande de l'app (`cmd`) répond `accepte`/`ok` — jamais le silence, et une commande inconnue est
//      REFUSÉE avec un code ;
//   D. depuis une origine étrangère, rien de ce qui commande n'est accepté.
//  `--src <background.js>` : une autre copie (preuve sur le code d'avant). Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const SRC = cheminSource();
const VERBEUX = process.argv.includes('-v');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '\n      · ' + [].concat(d).slice(0, 40).join('\n      · ') : '')); } };

// ── Les émetteurs : (from, action) écrits en clair, et les `action:` d'un émetteur à `from` unique.
const EMETTEURS = fs.readdirSync(EXT).filter((f) => /\.js$/.test(f) && !['background.js', 'pdf-lib.min.js', 'inject.js', 'lbc-inject.js', 'vc-inject.js'].includes(f));
const SITE_DE = { 'cancale-lbc': 'https://www.leboncoin.fr/mes-annonces', 'cancale-vc': 'https://fr.vestiairecollective.com/', 'cancale-vcdepot': 'https://fr.vestiairecollective.com/sell-clothes-online/', 'cancale-ebay': 'https://www.ebay.fr/sh/ord', 'vrm-transp': 'https://www.mondialrelay.fr/suivi-de-colis/', 'vrm-oauth-retour': 'https://vrm.center/auth/extension', 'vmr-bridge': 'https://vrm.center/', 'cancale-popup': null };
const couples = new Map();   // "from|action" → { from, action, fichiers:Set }
const noter = (from, action, f) => { const k = from + '|' + action; if (!couples.has(k)) couples.set(k, { from, action, fichiers: new Set() }); couples.get(k).fichiers.add(f); };
for (const f of EMETTEURS) {
  const s = fs.readFileSync(path.join(EXT, f), 'utf8');
  const froms = new Set(Array.from(s.matchAll(/from:\s*'([a-z-]+)'/g), (m) => m[1]).filter((x) => x !== 'vrm-fond'));
  for (const m of s.matchAll(/from:\s*'([a-z-]+)',\s*action:\s*'([A-Za-z0-9:]+)'/g)) if (m[1] !== 'vrm-fond') noter(m[1], m[2], f);
  // Les actions passées à un envoyeur commun (`envoyer6({ action: 'x' })`, `action: n > 1 ? 'a' : 'b'`).
  if (froms.size === 1 || f === 'vrm-badge.js') {
    const from = f === 'vrm-badge.js' ? 'vrm-badge' : Array.from(froms)[0];
    for (const m of s.matchAll(/(?:envoyer6|demanderAuFond|envoyerAuFond|envoyer)\(\s*\{\s*(?:from:\s*'[a-z-]+',\s*)?action:\s*'([A-Za-z0-9]+)'/g)) noter(from, m[1], f);
    for (const m of s.matchAll(/action:\s*[^,'}{]{1,60}\?\s*'([A-Za-z0-9]+)'\s*:\s*'([A-Za-z0-9]+)'/g)) { noter(from, m[1], f); noter(from, m[2], f); }
  }
}
// Les commandes de l'app (`{ cmd: '…' }` posté au pont, relayé en `{ from: 'vmr-bridge', action: 'cmd' }`).
const CMDS = new Set();
const voir = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) voir(p); else if (/\.(jsx?|mjs)$/.test(e.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/\bcmd:\s*'([A-Za-z0-9:_-]+)'/g)) CMDS.add(m[1]); } };
voir(path.join(RACINE, 'src'));

const ONGLET_VINTED = { tab: { id: 7, url: 'https://www.vinted.fr/catalog', active: true, windowId: 1 }, frameId: 0, url: 'https://www.vinted.fr/catalog', origin: 'https://www.vinted.fr' };
const emetteurDe = (from) => {
  if (from === 'cancale-popup') return { url: 'chrome-extension://x/popup.html', origin: 'chrome-extension://x', id: 'x' };
  const u = SITE_DE[from];
  if (u) return { tab: { id: 7, url: u, active: true, windowId: 1 }, frameId: 0, url: u, origin: new URL(u).origin };
  return ONGLET_VINTED;
};
// Des champs hostiles : chaque gestionnaire lit `msg.x` sans savoir d'où il vient.
const HOSTILES = [
  { confirme: true },
  { confirme: true, uid: '111', id: '7001', ids: ['7001'], items: [{ id: '7001', prix: 10 }], quoi: 'lancer', valeur: {}, cle: 'vinted_cadence', selection: ['n1'], txs: ['11100000'], conv: '60000', texte: 'x', site: 'leboncoin' },
  { confirme: true, uid: {}, id: [], ids: 'x', items: 'x', quoi: {}, valeur: null, cle: 5, selection: {}, txs: 7, conv: {}, texte: {}, site: [], reglages: 'x', reponses: 3, email: {}, code: [], url: 5, payload: 'x', data: null, choix: {}, langue: 9, fournisseur: {}, tous: 'x', actif: 'x', heure: {} },
  { confirme: true, uid: '111', ids: Array.from({ length: 3000 }, (_, i) => String(i)), items: Array.from({ length: 3000 }, (_, i) => ({ id: String(i), prix: -1 })), texte: 'x'.repeat(200000), valeur: { a: { b: { c: [null, undefined, NaN] } } } },
];

(async () => {
  const rejets = [];
  process.on('unhandledRejection', (e) => rejets.push(String(e && (e.stack || e.message || e)).slice(0, 300)));
  const monde = (o = {}) => { const f = faireFond(Object.assign({ src: SRC, connecte: '111', onglets: [{ id: 7, url: o.url || 'https://www.vinted.fr/catalog', status: 'complete', active: true, windowId: 1 }] }, o.fond || {})); f.ctx.compteConnecte = async () => '111'; return f; };
  const poser = async (f, msg, sender, ms = 6000) => { let leve = null, r; try { r = await Promise.race([f.envoyer(msg, sender), new Promise((res) => setTimeout(() => res('__tard'), ms))]); } catch (e) { leve = String(e && (e.stack || e.message)).slice(0, 300); } return { r, leve }; };

  const liste = Array.from(couples.values()).sort((a, b) => (a.from + a.action).localeCompare(b.from + b.action));
  console.log(`A. ${liste.length} couples (from, action) lus dans ${EMETTEURS.length} émetteurs — chacun reçoit une réponse`);
  const muets = [], leves = [], tards = [];
  for (const c of liste) {
    const s = emetteurDe(c.from);
    const f = monde({ url: s.tab ? s.tab.url : undefined });
    const { r, leve } = await poser(f, { from: c.from, action: c.action }, s);
    const nom = `${c.from} · ${c.action} (${Array.from(c.fichiers).join(', ')})`;
    if (leve) leves.push(nom + ' : ' + leve); else if (r === '__tard') tards.push(nom); else if (r === undefined) muets.push(nom);
    else if (VERBEUX) console.log('     ' + nom + ' → ' + JSON.stringify(r).slice(0, 90));
  }
  dit(liste.length >= 120, `les émetteurs sont lus (${liste.length} couples)`);
  dit(muets.length === 0, 'aucun message sans réponse (silence)', muets);
  dit(tards.length === 0, 'aucune réponse qui ne vient jamais', tards);
  dit(leves.length === 0, 'aucun gestionnaire ne lève', leves);

  console.log('B. Les mêmes, avec des champs hostiles');
  const muetsB = [], levesB = [], tardsB = [];
  for (const c of liste) {
    const s = emetteurDe(c.from);
    for (let i = 0; i < HOSTILES.length; i++) {
      const f = monde({ url: s.tab ? s.tab.url : undefined });
      const avant = rejets.length;
      const { r, leve } = await poser(f, Object.assign({}, HOSTILES[i], { from: c.from, action: c.action }), s);
      await new Promise((res) => setTimeout(res, 15));
      const nom = `${c.from} · ${c.action} [hostile ${i}]`;
      if (leve) levesB.push(nom + ' : ' + leve); else if (r === '__tard') tardsB.push(nom); else if (r === undefined) muetsB.push(nom);
      for (const x of rejets.slice(avant)) levesB.push(nom + ' : promesse rejetée — ' + x.split('\n').slice(0, 2).join(' '));
    }
  }
  dit(muetsB.length === 0, 'champs hostiles : toujours une réponse', muetsB);
  dit(tardsB.length === 0, 'champs hostiles : aucune réponse qui ne vient jamais', tardsB);
  dit(levesB.length === 0, 'champs hostiles : rien ne lève, aucune promesse rejetée sans gardien', Array.from(new Set(levesB)));

  console.log(`C. ${CMDS.size} commandes de l’app (cmd)`);
  const APP = { origin: 'https://vrm.center', url: 'https://vrm.center/', tab: { id: 3, url: 'https://vrm.center/', active: true, windowId: 1 } };
  const muetsC = [], sansVerdict = [];
  for (const cmd of Array.from(CMDS).sort()) for (const extra of [{}, HOSTILES[2], HOSTILES[1]]) {
    const f = monde();
    const { r, leve } = await poser(f, Object.assign({}, extra, { from: 'vmr-bridge', action: 'cmd', cmd }), APP);
    if (leve || r === undefined || r === '__tard') muetsC.push(`${cmd} : ${leve || (r === undefined ? 'silence' : 'jamais')}`);
    else if (!(r && (typeof r.accepte === 'boolean' || typeof r.ok === 'boolean'))) sansVerdict.push(`${cmd} → ${JSON.stringify(r).slice(0, 100)}`);
    else if (VERBEUX && extra === HOSTILES[1]) console.log('     ' + cmd + ' → ' + JSON.stringify(r).slice(0, 100));
  }
  dit(CMDS.size >= 15, `les commandes de l’app sont lues (${CMDS.size})`);
  dit(muetsC.length === 0, 'chaque commande de l’app reçoit une réponse', muetsC);
  dit(sansVerdict.length === 0, 'chaque réponse porte un verdict (`accepte` ou `ok`)', sansVerdict);
  { const f = monde(); const { r } = await poser(f, { from: 'vmr-bridge', action: 'cmd', cmd: 'commandeQuiNExistePas' }, APP);
    dit(r && r !== '__tard' && (r.accepte === false || r.ok === false) && !!(r.code || r.raison || r.error), 'une commande inconnue est refusée, avec un code', JSON.stringify(r)); }

  console.log('D. Depuis une origine étrangère');
  { const ETR = { origin: 'https://exemple.test', url: 'https://exemple.test/', tab: { id: 5, url: 'https://exemple.test/', active: true, windowId: 1 }, frameId: 0 };
    const acceptes = [];
    for (const cmd of Array.from(CMDS).sort()) { const f = monde({ url: 'https://exemple.test/' }); const { r } = await poser(f, { from: 'vmr-bridge', action: 'cmd', cmd, confirme: true }, ETR); if (!(r && r.ok === false && r.code === 'origine')) acceptes.push(cmd + ' → ' + JSON.stringify(r).slice(0, 80)); }
    dit(acceptes.length === 0, 'aucune commande de l’app n’est acceptée depuis une autre origine', acceptes);
    const passe = [];
    for (const c of liste.filter((x) => x.from === 'vrm-badge')) {
      const f = monde({ url: 'https://exemple.test/' });
      const { r } = await poser(f, Object.assign({}, HOSTILES[1], { from: c.from, action: c.action }), ETR);
      await new Promise((res) => setTimeout(res, 10));
      // `rapport` : le rapport de diagnostic que le vendeur envoie à VRM (aucun geste de plateforme, rien d'un compte) — permis de partout.
      if (f.j.vinted.some((q) => q.methode !== 'GET') || (c.action !== 'rapport' && f.j.vrmApi.some((q) => q.methode !== 'GET'))) passe.push(`${c.action} : une écriture est partie (${JSON.stringify(r).slice(0, 60)})`);
    }
    dit(passe.length === 0, 'aucun geste du panneau n’écrit chez Vinted ni chez VRM depuis un onglet étranger', passe);
  }

  console.log(`\n${ko ? '❌' : '✅'} contrat des messages : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
