// ═══════════════════════════════════════════════════════════════════════════
// BANC : « OÙ EN EST LA PUBLICATION AUTOMATIQUE ? » — L'ÉCRAN DOIT RÉPONDRE
//        node scripts/bancs/lbcprep.cjs
// ═══════════════════════════════════════════════════════════════════════════
// L'extension collecte depuis quatre versions (le catalogue des codes de
// Leboncoin, la config de son formulaire — qui est DYNAMIQUE —, la forme de ce
// qui part) et **l'app n'en montrait RIEN**. Julien a refait trois dépôts à la
// main sans jamais voir de retour : il ne pouvait pas savoir si ça avançait, ni
// quel geste faisait avancer. C'est le motif du tiroir `Nav` (§4.11) — du code
// qui tourne et que personne ne lit — sur la chose qu'il attend.
//
// Ce que ce banc exige :
//   1. les QUATRE états donnent QUATRE phrases différentes (pas su · rien
//      relevé · partiel · complet). Deux états qui se ressemblent, c'est un état
//      oublié — la leçon de `capacites.cjs` ;
//   2. UN SEUL geste à la fois, et c'est celui qui débloque (§7) ;
//   3. une pièce reçue INCOMPLÈTE le dit (le catalogue est arrivé coupé une
//      fois : un demi-catalogue a l'air d'un catalogue) ;
//   4. ⚠️ et jamais de promesse : ni délai, ni « bientôt », ni pourcentage.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin absolu (§6.1)
const PORT = 4507;
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
// ⚠️ Un banc ne meurt pas, il rapporte (huitième rappel dans ce dossier).
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE'
    ? new Error(`le port ${PORT} est déjà pris — un autre banc tourne. Relance celui-ci seul.`) : e));
  srv.listen(PORT, () => res(srv));
});

// Les quatre états que l'extension peut publier. Chaque « morceau » porte sa
// taille et son drapeau `coupe` : ce sont des FAITS, pas un pourcentage.
const PIECE = (taille, coupe) => ({ taille, coupe: !!coupe, at: '2026-09-18T10:00:00Z' });
const ETATS = {
  pasSu: null,                                       // la lecture a échoué
  rienRelevé: [],                                    // la ligne n'existe pas encore
  partiel: [{ data: { morceaux: { codes: PIECE(820000) }, envois: [], etapes: 1, etapesUtiles: 0, ver: '5.75.0', majAt: '2026-09-18T10:00:00Z' } }],
  coupé: [{ data: { morceaux: { codes: PIECE(3000000, true), config: PIECE(41000), prerempli: PIECE(9000), soumission: PIECE(2200) }, envois: ['PUT api…/classifieds'], etapes: 5, etapesUtiles: 3, ver: '5.75.0', majAt: '2026-09-18T10:00:00Z' } }],
  complet: [{ data: { morceaux: { codes: PIECE(820000), config: PIECE(41000), prerempli: PIECE(9000), soumission: PIECE(2200) }, envois: ['PUT api…/classifieds'], etapes: 5, etapesUtiles: 3, categories: ['Chaussures'], ver: '5.75.0', majAt: '2026-09-18T10:00:00Z' } }],
};

async function rendre(nav, etat) {
  const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url();
    if (/select=owner/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/select=id&limit=1/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/id=eq\.vrm_lbc_prep/.test(u)) {
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
  await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  const txt = await pg.evaluate(() => document.body.innerText || '');
  await ctx.close();
  // On ne juge que le BLOC concerné : un contrôle posé sur toute la page
  // attraperait n'importe quelle phrase de l'écran (§ « Remplissage garage 0% »).
  const i = txt.indexOf('Publier sans rien retaper');
  const bloc = i < 0 ? '' : txt.slice(i, i + 900);
  return { txt, bloc, erreurs };
}

(async () => {
  let srvOk = null;
  try { srvOk = await ecouter(); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const vus = {};
  for (const etat of ['pasSu', 'rienRelevé', 'partiel', 'coupé', 'complet']) {
    const r = await rendre(nav, etat);
    vus[etat] = r;
    dit(!r.erreurs.length, `${etat} : l'écran se rend sans erreur`, r.erreurs[0] || '');
    dit(!!r.bloc, `${etat} : le bloc de préparation est là`, r.bloc ? '' : 'absent — il ne verra rien avancer');
  }

  console.log('\n── QUATRE ÉTATS, QUATRE PHRASES (deux qui se ressemblent = un état oublié)');
  const clefs = ['pasSu', 'rienRelevé', 'partiel', 'complet'];
  const phr = clefs.map((k) => (vus[k].bloc || '').replace(/\s+/g, ' ').trim());
  const distinctes = new Set(phr).size;
  dit(distinctes === clefs.length, `les ${clefs.length} états donnent ${clefs.length} phrases différentes`, `${distinctes}/${clefs.length}`);
  for (const k of clefs) console.log(`     ${k.padEnd(12)} « ${(vus[k].bloc || '(rien)').replace(/\s+/g, ' ').slice(0, 110)} »`);

  console.log('\n── UN SEUL GESTE À LA FOIS, ET C\'EST CELUI QUI DÉBLOQUE (§7)');
  // ⚠️ On juge sur la DONNÉE, pas sur la formulation : rien de relevé ⇒ le geste
  //    parle de mise à jour ; codes reçus mais pas la config ⇒ il parle du dépôt.
  // ⚠️ APOSTROPHE DROITE OU COURBE — un contrôle ne porte pas sur la
  //    TYPOGRAPHIE. Mon premier jet cherchait `l'extension` et sortait ROUGE dès
  //    que le texte est passé en apostrophes typographiques : le texte était
  //    correct, le contrôle non. C'est le vingt-cinquième cri au loup de ce
  //    dossier, et toujours la même famille (§6.5).
  const AP = "['\u2019]";
  const a = (motif) => new RegExp(motif.replace(/'/g, AP), 'i');
  dit(a("mets l'extension à jour").test(vus.rienRelevé.bloc), 'rien relevé → le geste est la mise à jour puis la visite');
  dit(/d[ée]pose une annonce à la main/i.test(vus.partiel.bloc), 'les codes sont là mais pas la config → le geste est UN dépôt à la main');
  dit(!/d[ée]pose une annonce/i.test(vus.rienRelevé.bloc) && !a("mets l'extension à jour").test(vus.partiel.bloc),
    'et les deux gestes ne s\'affichent jamais ensemble');
  dit(!/d[ée]pose une annonce/i.test(vus.complet.bloc) && !a("mets l'extension").test(vus.complet.bloc),
    'tout reçu → plus aucun geste réclamé');

  console.log('\n── UNE PIÈCE INCOMPLÈTE LE DIT, ET RIEN N\'EST PROMIS');
  dit(/incompl[eè]te/i.test(vus.coupé.bloc), 'un catalogue arrivé coupé est annoncé comme incomplet',
    (vus.coupé.bloc || '').replace(/\s+/g, ' ').slice(0, 120));
  dit(!/incompl[eè]te/i.test(vus.complet.bloc), 'et il ne l\'est pas quand tout est entier');
  // ⚠️ Ce qui est interdit n'est pas un MOT mais une PROMESSE : un délai, un
  //    « bientôt », un pourcentage d'avancement inventé (vingtième cri au loup
  //    évité — « je vais chercher » est honnête, « ce sera prêt demain » non).
  const tous = clefs.concat('coupé').map((k) => vus[k].bloc).join(' ');
  dit(!/bient[oô]t|dans quelques|sous peu|d'ici (demain|peu)|\b\d+\s*%/i.test(tous),
    'aucune promesse de délai ni pourcentage inventé');
  dit(a("rien ne part tout seul|c'est toi qui").test(vus.complet.bloc),
    'et quand tout est prêt, il est dit que c\'est LUI qui publie');

  // ⚠️⚠️ TROUVÉ AU RENDU, PAS DANS LE CODE (§6.2). Mon premier jet affichait
  //    « n\\'est pas le même » — **l'antislash à l'écran** : dans du JSX, `\\'`
  //    n'est pas une apostrophe échappée, c'est un antislash suivi d'une
  //    apostrophe. Le build passait, tous les autres contrôles étaient verts,
  //    et la phrase était abîmée sur l'écran qu'il regarde. Un caractère
  //    parasite ne lève rien : il se VOIT.
  {
    const sale = clefs.concat('coupé').filter((k) => /\\[^n]/.test(vus[k].bloc || ''));
    dit(sale.length === 0, 'aucun antislash parasite dans le texte rendu',
      sale.length ? `${sale.join(', ')} : ${(vus[sale[0]].bloc || '').replace(/\s+/g, ' ').slice(0, 100)}` : '');
  }

  console.log('\n── LA LECTURE RATÉE NE SE FAIT PAS PASSER POUR « RIEN DE RELEVÉ »');
  dit(/pas pu lire/i.test(vus.pasSu.bloc), '« je n\'ai pas pu lire » est distinct de « rien n\'a été relevé »',
    (vus.pasSu.bloc || '').replace(/\s+/g, ' ').slice(0, 110));
  dit(!a("mets l'extension à jour").test(vus.pasSu.bloc) && !/d[ée]pose une annonce/i.test(vus.pasSu.bloc),
    'et on ne lui réclame AUCUN geste sur une mesure qui n\'a pas eu lieu');

  await nav.close(); srvOk.close();
  console.log(ko ? `\n❌ préparation Leboncoin : ${ko} rouge(s)` : '\n✅ L\'écran dit où en est la publication, et le geste qui fait avancer.');
  process.exit(ko ? 1 : 0);
})();
