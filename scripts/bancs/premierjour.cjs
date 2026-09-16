// ════════════════════════════════════════════════════════════════════════════
//  BANC « PREMIER JOUR » — l'app rendue pour quelqu'un qui n'est PAS Julien.
//
//  L'app va accueillir d'autres vendeurs. Leur tout premier écran disait, le
//  16 septembre, mesuré au rendu :
//      « Bonjour Julien · Rien d'urgent — ta boutique tourne. 👌 »
//      « 🎉 Tout est à jour ! Rien à expédier, rien à retirer »
//  …à quelqu'un dont AUCUN compte n'est branché. Trois affirmations fausses
//  d'affilée : son prénom, l'état de sa boutique, l'état de ses données.
//  C'est « Tout est publié 🎉 » sur une file jamais lue, sur l'écran d'accueil.
//
//  ⚠️ CE BANC N'A BESOIN D'AUCUNE FIXTURE : une installation neuve, c'est une
//  base VIDE. Rien de réel ne transite — il peut donc vivre entièrement dans
//  le dépôt, contrairement aux bancs de `fx/`.
//
//  ⚠️ IL VÉRIFIE LES DEUX SENS. Ne jamais rien fêter est le moyen le plus
//  simple de ne jamais mentir : une boutique branchée et à jour DOIT encore
//  voir « Tout est à jour ». Et une base qui n'a pas répondu ne doit jamais
//  déclencher « installe l'extension » — ce serait le dire à quelqu'un qui a
//  neuf comptes (mensonge du 10 septembre, retourné).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin
// absolu : la méthode de preuve (§6.1) copie le banc dans /tmp/avN et le lance
// DEPUIS cet arbre. Un `/home/...` en dur relirait le dépôt courant et la
// preuve serait truquée — c'est arrivé aux quatorze bancs de rendu.
const PORT = 4501;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };

const SESSION = {
  access_token: 'jeton-de-banc', refresh_token: 'r',
  expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'sophie@exemple.fr' },
};
// Un compte Vinted SYNTHÉTIQUE (aucune donnée réelle : ni login, ni jeton de
// quiconque). Il ne sert qu'à prouver le sens inverse.
const COMPTE_BANC = {
  vinted_user_id: '900000001', login: 'compte-de-banc',
  access_token: 'x', refresh_token: 'x', csrf_token: 'x',
  updated_at: new Date().toISOString(),
};

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};

const serveur = () => http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
}).listen(PORT);

// Rend Ma journée dans un état donné et renvoie ce qu'on voit.
//   comptes : [] (neuf) ou [COMPTE_BANC]
//   baseKO  : la base ne répond pas (522 + HTML, la VRAIE forme de la panne)
//   prenom  : ce que le réglage synchronisé contient
async function rendre(nav, { comptes = [], baseKO = false, prenom = '', lecturePublique = false, sansSession = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(([s, pr, sans]) => {
    try {
      if (!sans) localStorage.setItem('vrm_session', JSON.stringify(s));
      if (pr) localStorage.setItem('vrm_prenom', JSON.stringify(pr));
    } catch (_) {}
  }, [SESSION, prenom, sansSession]);

  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));

  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url();
    // La sonde de cloisonnement doit répondre 200 : base migrée.
    if (/select=owner/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    // La sonde « la clé publique lit-elle encore ? » (§ porte d'entrée).
    if (/select=id&limit=1/.test(u)) {
      if (lecturePublique === 'muette') return r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: lecturePublique ? JSON.stringify([{ id: 'main' }]) : '[]' });
    }
    if (baseKO) return r.fulfill({ status: 522, contentType: 'text/html', body: '<html>error 522</html>' });
    if (/vinted_accounts/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comptes) });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  // Déterminisme : aucune image du CDN Vinted (un hoquet réseau a déjà tué un banc).
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.route('**://*.vinted.com/**', (r) => r.abort());

  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.goto(`http://localhost:${PORT}/${sansSession ? '' : '?tab=journee'}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);

  const txt = await pg.evaluate(() => document.body.innerText);
  // ⚠️ On lit aussi les href : un geste qui se CLIQUE ne se voit pas dans
  //    innerText (récidive corrigée sur `panne.cjs`).
  const liens = await pg.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')));
  // Le bonjour est la ligne de titre, pas la page entière : un contrôle posé
  // sur toute la page attraperait n'importe quel prénom écrit ailleurs.
  const bonjour = (/^(?:Bonjour|Bon après-midi|Bonsoir).*$/m.exec(txt) || [''])[0].trim();
  await ctx.close();
  return { txt, liens, bonjour, erreurs };
}

(async () => {
  const srv = serveur();
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--no-sandbox'] });

  // ── 1. LE PRÉNOM ──────────────────────────────────────────────────────────
  // La règle : le bonjour DÉPEND du réglage. On ne cherche pas le mot
  // « Julien » (ce serait un contrôle posé sur l'orthographe, vert le jour où
  // quelqu'un met un autre prénom en dur) : on rend DEUX fois avec deux
  // valeurs et on exige que le rendu suive la donnée.
  console.log('\n── Le bonjour suit le réglage, il n’est celui de personne d’autre');
  const sansNom = await rendre(nav, { prenom: '' });
  const avecNom = await rendre(nav, { prenom: 'Sophie' });
  dit(/Sophie/.test(avecNom.bonjour), 'le prénom réglé apparaît dans le bonjour', `bonjour = « ${avecNom.bonjour} »`);
  dit(/^(Bonjour|Bon après-midi|Bonsoir)$/.test(sansNom.bonjour),
    'sans prénom réglé, le bonjour ne nomme PERSONNE', `bonjour = « ${sansNom.bonjour} »`);
  dit(!/Sophie/.test(sansNom.txt), 'aucun prénom ne traîne ailleurs sur l’écran');

  // ── 2. UNE BOUTIQUE JAMAIS BRANCHÉE NE SE FÊTE PAS ────────────────────────
  console.log('\n── Aucun compte lié : on dit la cause et le geste, on ne fête rien');
  const neuf = await rendre(nav, { comptes: [] });
  dit(!/Tout est à jour/i.test(neuf.txt), 'pas de « Tout est à jour »', neuf.txt.slice(0, 120).replace(/\n/g, ' · '));
  dit(!/🎉/.test(neuf.txt), 'pas de 🎉');
  dit(!/ta boutique tourne/i.test(neuf.txt), 'pas de « ta boutique tourne »');
  dit(/aucun compte Vinted n['’]est encore relié/i.test(neuf.txt), 'la CAUSE de la liste vide est écrite');
  dit(/vinted\.fr/i.test(neuf.txt), 'le geste final (ouvrir vinted.fr) est nommé');
  dit(/chrome:\/\/extensions/i.test(neuf.txt), 'l’installation dans Chrome est expliquée');
  dit(/même email/i.test(neuf.txt), 'se connecter à l’extension avec le même email est dit — c’est ce qui sépare les vendeurs');
  const zip = neuf.liens.find((h) => /VRM-extension\.zip/.test(h || ''));
  dit(!!zip, 'un lien de téléchargement de l’extension est offert');
  // ⚠️ Un bouton qui mène à un 404 est le défaut du pipeline Factures : on
  //    vérifie que le fichier EXISTE vraiment là où le lien pointe.
  dit(!!zip && fs.existsSync(path.join(DIST, zip.replace(/^\//, ''))),
    'et le fichier qu’il pointe existe bel et bien', String(zip));
  // §7 : une cause, une phrase. La ligne grise disait la même chose en petit.
  dit(!/Lie un compte Vinted/i.test(neuf.txt),
    'la consigne n’est pas écrite DEUX fois sur le même écran (§7)');
  dit(!neuf.erreurs.length, 'aucune erreur de page', neuf.erreurs[0]);

  // ── 3. L'AUTRE SENS : une boutique branchée et à jour se fête encore ──────
  // Sans ça, « ne rien fêter du tout » passerait tous les contrôles ci-dessus.
  console.log('\n── Un compte lié et rien à faire : la fête revient');
  const calme = await rendre(nav, { comptes: [COMPTE_BANC] });
  dit(/Tout est à jour/i.test(calme.txt), 'la fête est rendue quand elle est vraie',
    calme.txt.slice(0, 120).replace(/\n/g, ' · '));
  dit(!/aucun compte Vinted n['’]est encore relié/i.test(calme.txt),
    'et la carte des premiers pas a disparu');

  // ── 4. BASE INJOIGNABLE : ni fête, ni fausse consigne ─────────────────────
  // « rien lu » ne vaut pas « rien » : la liste des comptes est vide parce que
  // la lecture a échoué. Dire « installe l'extension » à quelqu'un qui a neuf
  // comptes est exactement le mensonge du 10 septembre.
  console.log('\n── Base injoignable : aucune des deux affirmations');
  const panne = await rendre(nav, { comptes: [], baseKO: true });
  dit(!/Tout est à jour/i.test(panne.txt), 'pas de fête pendant la panne');
  dit(!/aucun compte Vinted n['’]est encore relié/i.test(panne.txt),
    'pas de « installe l’extension » sur une lecture ratée',
    panne.txt.slice(0, 160).replace(/\n/g, ' · '));
  dit(!/ta boutique tourne/i.test(panne.txt), 'pas de « ta boutique tourne » pendant la panne');
  dit(/pas pu lire|ne répond pas|rien n['’]est perdu/i.test(panne.txt),
    'la panne, elle, est dite', panne.txt.slice(0, 160).replace(/\n/g, ' · '));

  // ── 5. LA PORTE D'ENTRÉE N'AFFIRME QUE CE QU'ELLE A MESURÉ ────────────────
  // Elle promettait « l'isolation est appliquée par la base » dès que la
  // COLONNE existait — or la migration autorise de s'arrêter là, RLS éteint.
  // C'est la dernière phrase que lit quelqu'un avant de confier ses jetons.
  console.log('\n── La porte d’entrée : elle mesure, elle ne promet pas');
  const porteOuverte = await rendre(nav, { sansSession: true, lecturePublique: true });
  dit(!/l['’]isolation est appliquée par la base/i.test(porteOuverte.txt),
    'base encore lisible sans compte : aucune promesse d’isolation',
    porteOuverte.txt.replace(/\n/g, ' · ').slice(0, 200));
  dit(/pas encore verrouillée|pas encore activée/i.test(porteOuverte.txt),
    'et elle le DIT, avec la conséquence (« n’invite personne »)');

  const porteFermee = await rendre(nav, { sansSession: true, lecturePublique: false });
  dit(/l['’]isolation est appliquée par la base/i.test(porteFermee.txt),
    'base fermée : la phrase revient — sinon « ne jamais rien affirmer » passerait tout',
    porteFermee.txt.replace(/\n/g, ' · ').slice(0, 200));

  // ⚠️ « Pas su » ne vaut pas « oui », et ne vaut pas « non » non plus.
  const porteMuette = await rendre(nav, { sansSession: true, lecturePublique: 'muette' });
  dit(!/l['’]isolation est appliquée par la base/i.test(porteMuette.txt),
    'sonde muette : aucune promesse');
  dit(!/pas encore verrouillée/i.test(porteMuette.txt),
    'sonde muette : aucune accusation non plus',
    porteMuette.txt.replace(/\n/g, ' · ').slice(0, 200));

  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} premier jour : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
