// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « MA JOURNÉE HORS LIGNE » — la règle pure (src/journeeHorsLigne.js)
//
//  Exécute le VRAI module (importé, pas recopié) et juge ce qu'il REND :
//   · une photo n'est écrite qu'après une lecture COMPLÈTE (chaque source qui
//     manque, échoue ou ne couvre pas les comptes d'aujourd'hui la refuse) ;
//   · une photo d'un autre vendeur (sa clé, ou la bonne clé à son nom) n'est
//     jamais servie ;
//   · la liste du soir suit la règle du rappel de la veille ;
//   · le service worker garde la réserve des QR et sert `/hl-qr`.
//  `--prouve` : réaffaiblit chaque règle tour à tour (copie du module) et exige
//  le rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'journeeHorsLigne.js');

const MUTATIONS = {
  'partielle-acceptee': ["  if (s.colisRelaisLu !== true) return false;", "  if (false) return false;"],
  'echecs-ignores': ["    && !(Array.isArray(l.failedUids) && l.failedUids.length);", "    && true;"],
  'autre-vendeur': ["p.uid !== uid ||", ""],
  'soir-faux': ["if (j <= 0) enRetard++; else if (j === 1) demain++;", "if (j < 0) enRetard++; else if (j === 1) demain++;"],
};

function stockage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; }

async function verifier(fichier) {
  let ko = 0; const out = [];
  const dit = (bon, quoi, d) => { if (!bon) ko++; out.push(`${bon ? 'OK  ' : 'KO  '}${quoi}${d ? ' — ' + d : ''}`); };
  const M = await import(pathToFileURL(fichier).href + '?t=' + Date.now() + Math.random());
  const A = '11111111-2222-3333-4444-555555555555', B = '99999999-8888-7777-6666-555555555555';
  const base = () => ({ baseKO: false, accountsReady: true, cleComptes: '1|2',
    ventes: { items: [], comptes: '1|2', failedUids: [] }, achats: { items: [], comptes: '1|2', failedUids: [] },
    tracking: [], emailBords: [], colisRelaisLu: true, colisEb: { aPoster: [], nePasPoster: [] } });
  dit(M.lectureComplete(base()) === true, 'toutes les sources ont répondu : lecture complète');
  const cas = [
    ['base injoignable', (s) => { s.baseKO = true; }],
    ['comptes pas encore lus', (s) => { s.accountsReady = false; }],
    ['ventes en cours', (s) => { s.ventes.items = null; }],
    ['un compte de ventes en échec', (s) => { s.ventes.failedUids = ['2']; }],
    ['ventes d\'une autre liste de comptes', (s) => { s.ventes.comptes = '1'; }],
    ['un compte d\'achats en échec', (s) => { s.achats.failedUids = ['1']; }],
    ['emails de suivi (codes) pas lus', (s) => { s.tracking = null; }],
    ['emails de bordereau pas lus', (s) => { s.emailBords = null; }],
    ['codes des conversations pas lus', (s) => { s.colisRelaisLu = false; }],
    ['eBay pas su', (s) => { s.colisEb = null; }],
    ['eBay en cours', (s) => { s.colisEb = undefined; }],
  ];
  for (const [nom, f] of cas) { const s = base(); f(s); dit(M.lectureComplete(s) === false, 'lecture partielle refusée : ' + nom); }

  const at = Date.now();
  const photo = M.construirePhoto({ uid: A, at, envoyer: [{ titre: 'Paire A', numero: '12', compte: 'c', jours: 1 }, { titre: 'Paire B', jours: 0 }, { titre: 'Paire C', jours: -2 }, { titre: 'Paire D', jours: 4 }],
    retirer: [{ titre: 'Colis', code: '4321', qr: 'https://qr.exemple.test/api/barcode/AztecCode?d=X' }, { titre: 'Colis 2', qr: 'javascript:alert(1)' }], nePasPoster: 1 });
  dit(!!photo && photo.uid === A && photo.nEnvoyer === 4 && photo.nRetirer === 2, 'la photo porte le vendeur et les comptes');
  dit(photo && photo.retirer[1].qr === '', 'une adresse de QR qui n\'est ni https ni data:image est refusée');
  const st = stockage();
  dit(M.ecrirePhoto(A, photo, st) === true && M.lirePhoto(A, st) && M.lirePhoto(A, st).retirer[0].code === '4321', 'écrite puis relue pour CE vendeur');
  dit(M.ecrirePhoto(B, photo, st) === false, 'une photo n\'est jamais écrite sous la clé d\'un autre vendeur');
  dit(M.lirePhoto(B, st) === null, 'la photo de A n\'est pas servie à B');
  const st2 = stockage(); st2.setItem(M.clePhoto(A), JSON.stringify({ ...photo, uid: B }));
  dit(M.lirePhoto(A, st2) === null, 'la bonne clé mais un contenu au nom d\'un autre : refusée');
  dit(M.lirePhoto('', st) === null && M.lirePhoto(null, st) === null, 'sans vendeur : aucune photo');
  dit(M.ecrirePhoto(A, photo, st, at + 1000) === false, 'même contenu, moins de 5 min : rien n\'est réécrit');
  const soir = M.listeDuSoir(photo, at);
  dit(soir && soir.n === 4 && soir.enRetard === 2 && soir.demain === 1, 'la liste du soir : en retard demain = limite aujourd\'hui ou avant ; limite demain', JSON.stringify(soir));
  dit(M.listeDuSoir(null) === null, 'pas de photo : pas de liste du soir (jamais un zéro inventé)');

  // Le service worker : réserve gardée à l'activation, `/hl-qr` servi.
  const sw = fs.readFileSync(path.join(R, 'public', 'sw.js'), 'utf8');
  dit(sw.includes(`'${M.CACHE_QR}'`), 'le service worker connaît la réserve des QR (même nom que la page)');
  dit(/k !== CACHE && k !== CACHE_QR/.test(sw), 'l\'activation ne purge pas la réserve des QR');
  dit(/url\.pathname === '\/hl-qr'/.test(sw), 'le service worker sert /hl-qr');
  // L'app : la photo est écrite seulement derrière `lectureComplete`.
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  const i = app.indexOf('const photo = construirePhoto(');
  const avant = i > 0 ? app.slice(Math.max(0, i - 2500), i) : '';
  dit(/if \(!lectureComplete\(/.test(avant), 'l\'app n\'écrit la photo qu\'après lectureComplete');
  dit(/caches\.delete\(CACHE_QR\)/.test(app), 'la réserve des QR part avec les données locales (déconnexion, changement de vendeur)');
  return { ko, out };
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  const r = await verifier(SRC);
  r.out.forEach((l) => console.log(l));
  let rouges = 0;
  if (prouve) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-'));
    const code = fs.readFileSync(SRC, 'utf8');
    for (const [nom, [de, vers]] of Object.entries(MUTATIONS)) {
      if (!code.includes(de)) { console.log(`KO  mutation ${nom} : ancre introuvable`); rouges++; continue; }
      const f = path.join(tmp, nom + '.mjs'); fs.writeFileSync(f, code.replace(de, vers));
      const m = await verifier(f);
      console.log(m.ko ? `OK  mutation ${nom} : ${m.ko} rouge(s)` : `KO  mutation ${nom} : reste verte`);
      if (!m.ko) rouges++;
    }
  }
  const total = r.ko + rouges;
  console.log(total ? `\n❌ journée hors ligne : ${total} rouge(s)` : '\n✅ journée hors ligne : tout est vert');
  process.exit(total ? 1 : 0);
})();
