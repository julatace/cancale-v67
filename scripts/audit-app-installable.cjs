// AUDIT — VRM INSTALLABLE (11 nov., lot app-installable)
// Juge des fichiers et des règles EXÉCUTÉES, jamais une formulation :
//  1. manifeste : id stable, icônes « any » et « maskable » présentes AUX BONNES
//     tailles (pixels lus), raccourcis vers des onglets que l'app connaît ;
//  2. index.html : apple-touch-icon 180 × 180 opaque, écran de démarrage pour
//     chaque taille d'iPhone, clair ET sombre, fichier aux bonnes dimensions ;
//  3. src/miseAJour.js : jamais de rechargement pendant une saisie, une fois par version ;
//  4. src/aideInstallation.js : une seule fois, jamais si installée, jamais à la 1re ouverture ;
//  5. public/sw.js (exécuté dans un bac à sable) : un clic de notification va
//     à une fenêtre de l'APP (pas à une page statique), sinon ouvre l'adresse ;
//     la navigation n'est servie du cache que pour la coquille.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 240) : '')); };
const png = (f) => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), couleur: b[25] }; };
const pub = (u) => path.join(R, 'public', u.replace(/^\//, ''));

(async () => {
  // 1. manifeste
  const m = JSON.parse(fs.readFileSync(path.join(R, 'public', 'manifest.webmanifest'), 'utf8'));
  dit(m.id === '/' && m.start_url === '/' && m.display === 'standalone', 'manifeste : id stable, ouverture plein écran');
  const icones = m.icons || [];
  for (const i of icones) {
    const f = pub(i.src); const ex = fs.existsSync(f);
    const d = ex ? png(f) : null; const [w, h] = i.sizes.split('x').map(Number);
    dit(ex && d.w === w && d.h === h, `icône ${i.src} (${i.purpose}) : ${i.sizes} réels`, ex ? `${d.w}x${d.h}` : 'absente');
  }
  const tailles = (p) => icones.filter((i) => i.purpose === p).map((i) => i.sizes);
  dit(tailles('any').includes('192x192') && tailles('any').includes('512x512') && tailles('maskable').includes('512x512') && tailles('maskable').includes('192x192'), 'manifeste : 192 et 512, « any » et « maskable »');
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  const liens = (/const ONGLETS_LIENS=\[([^\]]+)\]/.exec(app) || [])[1] || '';
  for (const s of m.shortcuts || []) {
    const t = new URL(s.url, 'https://x').searchParams.get('tab');
    dit(liens.includes(`'${t}'`), `raccourci « ${s.name} » → onglet connu (${t})`);
  }
  // 2. index.html
  const html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
  const touche = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html);
  const dt = touche && fs.existsSync(pub(touche[1])) ? png(pub(touche[1])) : null;
  dit(dt && dt.w === 180 && dt.h === 180 && dt.couleur !== 6 && dt.couleur !== 4, 'apple-touch-icon 180 × 180 sans transparence', JSON.stringify(dt));
  const demarrages = [...html.matchAll(/<link rel="apple-touch-startup-image" media="([^"]+)" href="([^"]+)"/g)];
  const IPHONES = [[440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [414, 896, 3], [375, 812, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2]];
  for (const [w, h, r] of IPHONES) for (const sch of ['light', 'dark']) {
    const l = demarrages.find(([, med]) => med.includes(`(device-width: ${w}px)`) && med.includes(`(device-height: ${h}px)`) && med.includes(`ratio: ${r})`) && med.includes(`prefers-color-scheme: ${sch}`));
    const d = l && fs.existsSync(pub(l[2])) ? png(pub(l[2])) : null;
    dit(d && d.w === w * r && d.h === h * r, `démarrage iPhone ${w}×${h}@${r} ${sch}`, l ? JSON.stringify(d) : 'absent');
  }
  dit(/html\{overscroll-behavior:none;\}/.test(html.replace(/\/\*[\s\S]*?\*\//g, '')), 'la racine refuse le rechargement au tirer');
  dit(/viewport-fit=cover/.test(html), 'zones sûres : viewport-fit=cover');
  // 3 et 4 : les règles, exécutées
  const { decisionMaj, estSaisie } = await import(path.join(R, 'src', 'miseAJour.js'));
  const V = { actuelle: 'a.js', serveur: 'b.js' };
  dit(decisionMaj({ ...V }) === 'proposer', 'nouvelle version en cours d\'usage ⇒ proposer');
  dit(decisionMaj({ ...V, demarrageVisible: true }) === 'recharger', 'nouvelle version, écran de démarrage ⇒ recharger');
  dit(decisionMaj({ ...V, demarrageVisible: true, saisieEnCours: true }) === 'proposer', 'saisie en cours ⇒ JAMAIS recharger');
  dit(decisionMaj({ ...V, cacheeDepuisMs: 11 * 60000 }) === 'recharger' && decisionMaj({ ...V, cacheeDepuisMs: 60000 }) === 'proposer', 'revenue après 10 min cachée ⇒ recharger ; 1 min ⇒ proposer');
  dit(decisionMaj({ ...V, cacheeDepuisMs: 11 * 60000, saisieEnCours: true }) === 'proposer', 'revenue avec une saisie ⇒ proposer');
  dit(decisionMaj({ ...V, refusee: 'b.js' }) === 'rien' && decisionMaj({ ...V, refusee: 'a.js' }) === 'proposer', 'refusée ⇒ plus pour CETTE version, oui pour la suivante');
  dit(decisionMaj({ actuelle: 'a.js', serveur: 'a.js', demarrageVisible: true }) === 'rien' && decisionMaj({ actuelle: 'a.js', serveur: null }) === 'rien', 'même version ou pas su ⇒ rien');
  dit(estSaisie({ tagName: 'INPUT', type: 'text' }) && estSaisie({ tagName: 'TEXTAREA' }) && !estSaisie({ tagName: 'INPUT', type: 'checkbox' }) && !estSaisie({ tagName: 'BUTTON' }) && !estSaisie(null), 'saisie = un champ texte touché');
  const A = await import(path.join(R, 'src', 'aideInstallation.js'));
  const SAF = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const CRIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
  const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  dit(A.plateformeInstallation({ ua: SAF }) === 'iphone' && A.plateformeInstallation({ ua: SAF, installee: true }) === null, 'iPhone Safari ⇒ aide ; installée ⇒ rien');
  dit(A.plateformeInstallation({ ua: CRIOS }) === null && A.plateformeInstallation({ ua: IPAD }) === null, 'Chrome sur iPhone, iPad ⇒ rien (menus différents)');
  dit(A.plateformeInstallation({ ua: 'Android Chrome', invitePrete: true, tactile: true }) === 'android' && A.plateformeInstallation({ ua: 'Android Chrome', invitePrete: false, tactile: true }) === null && A.plateformeInstallation({ ua: 'X11 Chrome', invitePrete: true, tactile: false }) === null, 'Android : seulement si le navigateur offre l\'invite, au doigt');
  dit(!A.aideInstallationVisible({ plateforme: 'iphone', etat: { visites: 1 } }) && A.aideInstallationVisible({ plateforme: 'iphone', etat: { visites: 2 } }), 'pas à la 1re ouverture, oui à la 2e');
  dit(!A.aideInstallationVisible({ plateforme: 'iphone', etat: { visites: 5, vue: '2026-11-11' } }) && !A.aideInstallationVisible({ plateforme: 'iphone', etat: { visites: 5 }, guideFerme: true }), 'déjà vue, ou guide fermé ⇒ jamais');
  const mem = (() => { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); } }; })();
  A.compterVisite(mem); A.compterVisite(mem); A.noterAideVue(mem); const e = A.compterVisite(mem);
  dit(e.visites === 2 && !!e.vue && !A.aideInstallationVisible({ plateforme: 'iphone', etat: e }), 'stockage : visites comptées, « vue » définitif');
  // 5. sw.js dans un bac à sable
  const SW = fs.readFileSync(path.join(R, 'public', 'sw.js'), 'utf8');
  const bac = (fenetres) => {
    const ecouteurs = {}; const ouvertes = []; const messages = [];
    const self = { addEventListener: (t, f) => { ecouteurs[t] = f; }, location: { origin: 'https://vrm.center' }, registration: {}, skipWaiting() {} };
    const clients = { matchAll: async () => fenetres.map((f) => ({ ...f, focus: async () => {}, postMessage: (x) => messages.push([f.url, x]) })), openWindow: async (u) => { ouvertes.push(u); }, claim: async () => {} };
    vm.runInNewContext(SW, { self, clients, caches: {}, URL, Response: class {}, fetch: async () => {}, atob: (s) => Buffer.from(s, 'base64').toString('binary'), setTimeout, console });
    return { ecouteurs, ouvertes, messages };
  };
  const cliquer = async (fenetres, url) => {
    const b = bac(fenetres); let p;
    b.ecouteurs.notificationclick({ notification: { close() {}, data: { url } }, action: '', waitUntil: (x) => { p = x; } });
    await p; return b;
  };
  let b = await cliquer([{ url: 'https://vrm.center/aide/colis', focused: true, visibilityState: 'visible' }, { url: 'https://vrm.center/?tab=journee', focused: false, visibilityState: 'hidden' }], '/?tab=ventes&notif=4');
  dit(b.messages.length === 1 && /\?tab=journee$/.test(b.messages[0][0]) && b.messages[0][1].url === '/?tab=ventes&notif=4' && !b.ouvertes.length, 'notification : va à la fenêtre de l\'APP, pas à la page d\'aide', JSON.stringify(b));
  b = await cliquer([{ url: 'https://vrm.center/legal/cgv.html', focused: true, visibilityState: 'visible' }], '/?tab=cat_bord');
  dit(!b.messages.length && b.ouvertes[0] === '/?tab=cat_bord', 'notification sans fenêtre de l\'app : ouvre l\'app sur le bon écran', JSON.stringify(b));
  b = await cliquer([], '/?tab=ventes');
  dit(b.ouvertes[0] === '/?tab=ventes', 'notification, app fermée : ouvre l\'app sur le bon écran');
  dit(/if \(req\.mode === 'navigate' && !estCoquille\(url\)\) return;/.test(SW.replace(/\/\/.*$/gm, '')), 'seule la coquille est servie du cache à l\'ouverture');

  console.log(ko ? `\n❌ audit-app-installable : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-app-installable : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
