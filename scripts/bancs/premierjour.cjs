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

const srvBase = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});

// ⚠️ UN BANC NE MEURT PAS, IL RAPPORTE (leçon répétée six fois dans ce dossier).
// Deux bancs lancés en même temps se disputent le port : sans ça, celui-ci
// sortait sur une pile d'appels Node et AUCUN contrôle n'était rendu — on
// croyait à un défaut de l'app.
const ecouter = () => new Promise((res, rej) => {
  srvBase.once('error', (e) => rej(e.code === 'EADDRINUSE'
    ? new Error(`le port ${PORT} est déjà pris — un autre banc tourne. Relance celui-ci seul.`)
    : e));
  srvBase.listen(PORT, () => res(srvBase));
});

// Rend Ma journée dans un état donné et renvoie ce qu'on voit.
//   comptes : [] (neuf) ou [COMPTE_BANC]
//   baseKO  : la base ne répond pas (522 + HTML, la VRAIE forme de la panne)
//   prenom  : ce que le réglage synchronisé contient
async function rendre(nav, { comptes = [], baseKO = false, prenom = '', lecturePublique = false, sansSession = false, pont = null, tab = 'journee' } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(([s, pr, sans]) => {
    try {
      if (!sans) localStorage.setItem('vrm_session', JSON.stringify(s));
      if (pr) localStorage.setItem('vrm_prenom', JSON.stringify(pr));
    } catch (_) {}
  }, [SESSION, prenom, sansSession]);

  // ── UN FAUX PONT D'EXTENSION ──────────────────────────────────────────────
  // L'app ne peut pas lire le stockage de l'extension : elle le lui DEMANDE
  // par `window.postMessage`. On rejoue exactement ce dialogue, c'est la seule
  // façon de rendre les quatre états sans Chrome.
  //   pont = null              → aucune extension ici (téléphone, autre navigateur)
  //   pont = 'muette'          → elle est là mais ne répond pas (« pas su »)
  //   pont = {connecte, email} → elle répond
  if (pont) {
    await pg.addInitScript((p) => {
      window.addEventListener('message', (ev) => {
        if (ev.source !== window || !ev.data || typeof ev.data !== 'object') return;
        const d = ev.data;
        if (d.__vmr === 'ping') { window.postMessage({ __vmr: 'ready', version: '5.63.0' }, '*'); return; }
        if (d.__vmr === 'authEtat' && d.reqId && p !== 'muette') {
          window.postMessage({ __vmr: 'authEtat:result', reqId: d.reqId,
            etat: { ok: true, connecte: !!p.connecte, email: p.email || '', cloisonne: true } }, '*');
        }
      });
      window.postMessage({ __vmr: 'ready', version: '5.63.0' }, '*');
      setTimeout(() => window.postMessage({ __vmr: 'ready', version: '5.63.0' }, '*'), 400);
    }, pont);
  }

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
  await pg.goto(`http://localhost:${PORT}/${sansSession ? '' : '?tab=' + tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);

  const txt = await pg.evaluate(() => document.body.innerText);
  // ⚠️ On lit aussi les href : un geste qui se CLIQUE ne se voit pas dans
  //    innerText (récidive corrigée sur `panne.cjs`).
  const liens = await pg.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')));
  // ⚠️ L'ÉTAT QUE L'APP A DÉCIDÉ, pas la phrase qu'elle en tire. Un contrôle
  //    posé sur le libellé passe au vert dès que quelqu'un reformule (§6.5) —
  //    c'est le piège le plus fréquent de ce projet.
  const etat = await pg.evaluate(() => {
    const el = document.querySelector('[data-etape]');
    return el ? el.getAttribute('data-etape') : null;
  });
  // Le bonjour est la ligne de titre, pas la page entière : un contrôle posé
  // sur toute la page attraperait n'importe quel prénom écrit ailleurs.
  const bonjour = (/^(?:Bonjour|Bon après-midi|Bonsoir).*$/m.exec(txt) || [''])[0].trim();
  await ctx.close();
  return { txt, liens, bonjour, erreurs, etat };
}

(async () => {
  const srv = await ecouter();
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

  // ── 4 bis. LA CARTE SUIT CE QUI EST VRAI, ELLE NE RÉCITE PAS ──────────────
  // Une liste de quatre gestes dont trois sont déjà faits fait chercher au
  // mauvais endroit. L'app SAIT : le pont dit si l'extension tourne ici, et
  // `authEtat` sous quel compte elle écrit.
  console.log('\n── La carte nomme l’étape qui bloque, mesurée');
  const pasConnectee = await rendre(nav, { comptes: [], pont: { connecte: false } });
  dit(pasConnectee.etat === 'pasconnectee',
    'extension installée mais pas connectée : c’est CE blocage que l’app retient',
    `état rendu = ${pasConnectee.etat}`);
  dit(!/Télécharger l['’]extension/i.test(pasConnectee.txt),
    'et on ne lui propose plus de télécharger ce qui tourne déjà (§7)');
  // ⚠️⚠️ VU AU RENDU : le bouton principal proposait « Ouvrir vinted.fr »
  //    alors que l'étape qui bloque est la connexion. Le geste proposé doit
  //    être celui qui DÉBLOQUE — sinon on envoie capter dans le vide.
  dit(!/Ouvrir vinted\.fr/i.test(pasConnectee.txt),
    'et on ne l’envoie pas sur Vinted alors que rien ne pourra être rangé');

  // ⚠️⚠️ LE CAS QUI SÉPARE LES VENDEURS. Connectée sous une AUTRE adresse, elle
  //    range ses captures dans la boutique de quelqu'un d'autre — et cette
  //    boutique-ci reste vide pour toujours, sans un mot.
  const autreCompte = await rendre(nav, { comptes: [], pont: { connecte: true, email: 'quelqu-un-dautre@exemple.fr' } });
  dit(autreCompte.etat === 'autrecompte', 'connectée sous une autre adresse : l’app le retient',
    `état rendu = ${autreCompte.etat}`);
  dit(/quelqu-un-dautre@exemple\.fr/.test(autreCompte.txt) && /sophie@exemple\.fr/.test(autreCompte.txt),
    'et les DEUX adresses sont nommées — sinon on ne sait pas laquelle changer');

  const branchee = await rendre(nav, { comptes: [], pont: { connecte: true, email: 'sophie@exemple.fr' } });
  dit(branchee.etat === 'connectee',
    'tout branché : il ne reste que le dernier geste', `état rendu = ${branchee.etat}`);
  dit(branchee.etat !== 'autrecompte', 'et la même adresse ne déclenche AUCUNE alerte');
  dit(/Ouvrir vinted\.fr/i.test(branchee.txt), 'là, et là seulement, le bouton mène à Vinted');
  // ⚠️ Le pire des deux : y aller capterait dans la boutique de quelqu'un d'autre.
  dit(!/Ouvrir vinted\.fr/i.test(autreCompte.txt),
    'connectée ailleurs : surtout pas de bouton vers Vinted');

  // « Pas su » ne vaut ni oui ni non : une extension qui ne répond pas ne
  // s'accuse pas d'être mal connectée.
  const muette = await rendre(nav, { comptes: [], pont: 'muette' });
  dit(muette.etat === 'muette', 'extension muette : l’app ne l’accuse de rien',
    `état rendu = ${muette.etat}`);
  // Se taire serait le défaut d'origine : on DIT qu'on n'a pas pu demander, et
  // on propose de réessayer. C'est le geste qui est exigé, pas sa formulation.
  dit(/recharge/i.test(muette.txt), 'mais on dit quoi faire (recharger) plutôt que de se taire',
    muette.txt.split('\n').slice(-2).join(' · '));

  // ── 4 ter. LES DEUX ÉCRANS D'ACCUEIL DISENT LA MÊME CHOSE (§11) ───────────
  // Il y avait DEUX onboardings : le tableau de bord récitait « 3 étapes »
  // sans lien de téléchargement et SANS l'étape qui sépare les vendeurs (se
  // connecter à l'extension avec le même email), Ma journée en disait quatre.
  // Deux écrans, deux consignes, sur les deux premières pages que voit une
  // nouvelle personne.
  console.log('\n── Tableau de bord et Ma journée : les mêmes étapes, pas deux consignes');
  const bord = await rendre(nav, { comptes: [], tab: 'dashboard' });
  const jour = await rendre(nav, { comptes: [] });
  // On juge sur les GESTES rendus, pas sur la formulation : chaque étape est
  // identifiée par ce qu'elle fait faire, pas par sa phrase (§6.5).
  const gestes = (t) => ({
    // ⚠️ Chaque geste est identifié par ce qu'il DÉSIGNE (une adresse, une
    //    notion, un domaine) — pas par la phrase qui l'enrobe. « Installe » vs
    //    « Installer » ne dit rien sur la règle (§6.5).
    chrome: /chrome:\/\/extensions/i.test(t),
    memeMail: /même email/i.test(t),
    vinted: /vinted\.fr/i.test(t),
  });
  const gb = gestes(bord.txt), gj = gestes(jour.txt);
  for (const k of Object.keys(gb)) {
    dit(gb[k] === true && gj[k] === true,
      `l’étape « ${k} » est dite sur les DEUX écrans`, `tableau de bord ${gb[k]} · Ma journée ${gj[k]}`);
  }
  // ⚠️ Et le geste le plus coûteux à oublier : le lien du zip.
  dit(bord.liens.some((h) => /VRM-extension\.zip/.test(h || '')),
    'le tableau de bord aussi offre le téléchargement de l’extension');
  // ⚠️ Un écran ne nomme pas la boutique de QUELQU'UN D'AUTRE à un nouveau venu.
  dit(!/Shop Cancale35/i.test(bord.txt) && !/Shop Cancale35/i.test(jour.txt),
    'aucun des deux ne nomme la boutique d’un autre vendeur');
  // ⚠️⚠️ VU AU RENDU : le tableau de bord affichait « ✅ Tout est à jour — rien
  //    qui presse » JUSTE SOUS la carte qui venait d'expliquer que rien n'était
  //    branché. Un écran qui se contredit à deux centimètres d'écart.
  dit(!/Tout est à jour/i.test(bord.txt),
    'le tableau de bord ne fête rien sous la carte des premiers pas',
    bord.txt.replace(/\n/g, ' · ').slice(0, 200));

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
