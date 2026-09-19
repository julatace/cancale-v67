// ═══════════════════════════════════════════════════════════════════════════
// BANC : CE QUI EST PARTI EN SON NOM — L'ÉCRAN DOIT DIRE LES VRAIS NOMBRES
//        node scripts/bancs/repondre.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien a choisi « Tout, elle répond à tout ». C'est SA décision. Mais l'app
// ne doit pas la lui répéter comme un fait : MESURÉ le 19 septembre sur ses
// **32 conversations non lues**, l'extension n'en répond que **3** —
// 17 n'ont aucune conversation captée, 9 n'ont aucun message de l'acheteur,
// 1 est refusée à la réponse par Vinted, et **1 est un échange où c'est LUI
// qui achète** (« Trainers are in post, thanks for buying »).
// « Un total partiel présenté comme complet est pire qu'un total absent » (§5) :
// l'écran écrit les DEUX nombres et la raison, jamais « à tout ».
//
// Ce que ce banc exige :
//   1. les deux nombres sont rendus, et ils SUIVENT la donnée (pas un texte figé) ;
//   2. les causes d'abstention sont nommées, celles-là et pas d'autres ;
//   3. lecture ratée ⇒ AUCUN nombre inventé, et on le dit (« pas su ») ;
//   4. ce qui est parti est relisible, avec la personne NOMMÉE ;
//   5. ⚠️ l'autre sens : *tout retirer* passerait les contrôles 1-3.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin absolu (§6.1)
const PORT = 4509;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'sophie@exemple.fr' } };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE'
    ? new Error(`le port ${PORT} est déjà pris — un autre banc tourne. Relance celui-ci seul.`) : e));
  srv.listen(PORT, () => res(srv));
});

// ⚠️ LA FORME MESURÉE SUR SA BASE (§6.3), chiffres compris.
const ENVOI = {
  '500024320731:69344957902': { conv: '500024320731', at: '2026-09-19T10:20:00Z', login: 'cyrus_leeman',
    titre: 'autry reelwind beige taille 40', texte: 'Oui, elle est toujours dispo ! Je peux poster demain matin.',
    intention: 'interet', confiance: 92 },
};
const BILAN_REEL = { nonLues: 32, pasCaptee: 17, sansMessage: 9, pasVendeur: 1, replyRefuse: 1,
  dejaRepondu: 0, pasSure: 0, envoyes: 3, refusees: 0, at: '2026-09-19T10:20:00Z', uid: '3171228253', ver: '5.77.0' };
// Un SECOND jeu de chiffres : c'est lui qui prouve que l'écran suit la donnée
// et ne récite pas un texte figé (la leçon du prénom, `premierjour.cjs`).
const BILAN_AUTRE = Object.assign({}, BILAN_REEL, { nonLues: 4, envoyes: 1, pasCaptee: 0, sansMessage: 2, pasVendeur: 1, replyRefuse: 0 });

const ETATS = {
  pasSu: null,                                                   // 522 : la lecture a échoué
  rien: [],                                                      // la ligne n'existe pas encore
  reel: [{ data: Object.assign({}, ENVOI, { bilan: BILAN_REEL }) }],
  autre: [{ data: Object.assign({}, ENVOI, { bilan: BILAN_AUTRE }) }],
};

async function rendre(nav, etat) {
  const ctx = await nav.newContext({ viewport: { width: 1512, height: 1100 } });
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => {
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    // Le réglage est ALLUMÉ : c'est son choix, et c'est l'état où l'écran parle.
    try { localStorage.setItem('vinted_repond_auto', 'true'); } catch (_) {}
  }, SESSION);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url();
    if (/select=owner/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/select=id&limit=1/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/id=eq\.panel_msg_repondus/.test(u)) {
      const v = ETATS[etat];
      // ⚠️ LA VRAIE FORME DE LA PANNE : 522 + HTML, pas un JSON d'erreur.
      if (v === null) return r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.route('**://*.vinted.com/**', (r) => r.abort());
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  const txt = await pg.evaluate(() => document.body.innerText || '');
  // ⚠️ ON NE JUGE QUE LE BLOC CONCERNÉ (§ « Remplissage garage 0% ») : un
  //    contrôle posé sur toute la page attraperait n'importe quel nombre de
  //    l'écran Réglages, qui en porte des dizaines.
  const i = txt.indexOf('Répondre à mes messages Vinted');
  const bloc = i < 0 ? '' : txt.slice(i, i + 1200).replace(/\s+/g, ' ');
  await ctx.close();
  return { txt, bloc, erreurs };
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const vus = {};
  for (const etat of Object.keys(ETATS)) {
    const r = await rendre(nav, etat);
    vus[etat] = r;
    dit(!r.erreurs.length, `${etat} : l'écran se rend sans erreur`, r.erreurs[0] || '');
    dit(!!r.bloc, `${etat} : le panneau est là`, r.bloc ? '' : 'absent');
  }
  // §6.2 : on LIT ce qui est rendu, ce n'est pas un contrôle mais c'est le test.
  for (const k of Object.keys(ETATS)) console.log(`\n     ${k} ─ « ${(vus[k].bloc || '(rien)').slice(0, 700)} »`);

  console.log('\n── LES DEUX NOMBRES, ET ILS SUIVENT LA DONNÉE');
  // Le contrôle ne cherche PAS un texte : il vérifie que les deux nombres
  // servis ressortent, et qu'ils CHANGENT quand la donnée change (sinon un
  // texte figé passerait — la leçon du prénom de `premierjour.cjs`).
  const porte = (bloc, b) => new RegExp(`\\b${b.envoyes}\\b`).test(bloc) && new RegExp(`\\b${b.nonLues}\\b`).test(bloc);
  dit(porte(vus.reel.bloc, BILAN_REEL), `l'état mesuré écrit ${BILAN_REEL.envoyes} et ${BILAN_REEL.nonLues}`, vus.reel.bloc.slice(0, 160));
  dit(porte(vus.autre.bloc, BILAN_AUTRE), `un autre jeu écrit ${BILAN_AUTRE.envoyes} et ${BILAN_AUTRE.nonLues}`, vus.autre.bloc.slice(0, 160));
  dit(vus.reel.bloc !== vus.autre.bloc, 'les deux rendus diffèrent : le texte SUIT la donnée, il n\'est pas figé');
  // ⚠️ Ce qui est interdit n'est pas un mot mais une AFFIRMATION : « elle répond
  //    à tout » serait faux 29 fois sur 32. (Vingtième cri au loup évité : la
  //    phrase honnête peut parfaitement contenir « tout ».)
  const tous = Object.keys(ETATS).map((k) => vus[k].bloc).join(' ');
  dit(!/r[ée]pond (à|a) tou(t|s)|toutes tes conversations|tous tes messages/i.test(tous),
    'nulle part l\'app n\'affirme qu\'elle répond à TOUT');

  console.log('\n── LES CAUSES D\'ABSTENTION SONT NOMMÉES (une cause, une phrase — §7)');
  const AP = "['’]";
  const a = (m) => new RegExp(m.replace(/'/g, AP), 'i');
  // ⚠️ LA PLUS COÛTEUSE : il doit savoir que les échanges où c'est LUI
  //    l'acheteur ne sont pas pour elle — sinon il croit l'app muette.
  dit(a("c'est toi qui ach[eè]tes").test(vus.reel.bloc), 'les échanges où il ACHÈTE sont nommés', vus.reel.bloc.slice(0, 200));
  dit(a("n'a pas encore lu").test(vus.reel.bloc), 'celles dont l\'échange n\'est pas capté aussi');
  dit(/Vinted n[’']autorise pas/i.test(vus.reel.bloc), 'et celles que Vinted refuse aussi');
  // L'autre sens : une cause à ZÉRO ne doit pas être écrite (du bruit permanent).
  dit(!a("n'a pas encore lu").test(vus.autre.bloc),
    'une cause à zéro n\'est PAS écrite', vus.autre.bloc.slice(0, 200));

  console.log('\n── LECTURE RATÉE : AUCUN NOMBRE INVENTÉ, ET ON LE DIT');
  dit(!/\b(0|32|3)\s+r[ée]ponse/i.test(vus.pasSu.bloc) && !/Au dernier passage/i.test(vus.pasSu.bloc),
    'aucun bilan affiché quand la lecture a échoué', vus.pasSu.bloc.slice(0, 200));
  dit(a("n'ai pas pu lire|pas pu lire").test(vus.pasSu.bloc), 'et l\'écran le DIT, avec le geste');
  dit(!a("n'ai pas pu lire").test(vus.reel.bloc), 'et il ne le dit pas quand la lecture a marché');
  dit(/Aucune r[ée]ponse envoy[ée]/i.test(vus.rien.bloc), 'ligne absente : « aucune réponse » — pas une panne');

  console.log('\n── IL PEUT RELIRE CE QUI EST PARTI EN SON NOM');
  const e = ENVOI['500024320731:69344957902'];
  dit(vus.reel.bloc.includes(e.texte.slice(0, 40)), 'le texte envoyé est affiché', vus.reel.bloc.slice(0, 200));
  dit(vus.reel.bloc.includes(e.login), 'et la personne est NOMMÉE', e.login);
  dit(vus.reel.bloc.includes(e.titre.slice(0, 20)), 'avec la paire dont il s\'agit');
  // ⚠️ `bilan` vit dans la MÊME ligne que les envois : il ne doit pas être
  //    listé comme si c'était un message parti.
  dit(!/«\s*(undefined|\[object)/i.test(vus.reel.bloc), 'le bilan n\'est pas listé comme un envoi', vus.reel.bloc.slice(0, 200));

  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ Ce qui part en son nom est relisible, et les nombres sont les vrais.'}`);
  process.exit(ko ? 1 : 0);
})();
