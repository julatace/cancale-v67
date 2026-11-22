// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CLOCHE DE VINTED, TELLE QU'ELLE EST » (22 nov., production)
//
//  Julien, 22 nov. au soir, vinted.fr/inbox/<conv>, pendant « messages aux favoris » : « Vinted a changé le bouton notif »
//  puis « Une file d'envoi est en pause : 3 en attente ». Sa capture : la cloche de Vinted OUVERTE, qui marche, et qui ne
//  liste que « Le prix de l'article … a été réduit de 15,90 € à 12,00 € » (des baisses sur des articles qu'IL aime) puis
//  « Voir tout » — aucune ligne « X a ajouté ton article à ses favoris ».
//  ⇒ La liste de la cloche ne montre que les DERNIÈRES notifications, tous types mêlés. VRM y cherchait la ligne du favori,
//    ne la trouvait pas, réessayait — et, cloche ouverte, ne reconnaissait plus son bouton : « touche le bouton ».
//  Une FAUSSE page vinted.fr (jamais le vrai Vinted) dont la cloche a la forme de sa capture ; le VRAI
//  vinted-sync-extension/vrm-formulaire.js y joue l'étape `favoriOuvrir` / `favoriListe`. On juge :
//   C1  cloche fermée, liste = baisses de prix + « Voir tout », favori absent ⇒ `favori-notification` + `absent` + le
//       chemin de « Voir tout » ; JAMAIS `cloche` ; aucune ligne cliquée (surtout pas une baisse de prix) ;
//   C2  cloche DÉJÀ ouverte (le second essai), bouton renommé « Fermer les notifications » ⇒ pareil, jamais `cloche` ;
//   C3  cloche déjà ouverte dont le bouton n'a plus AUCUN nom reconnu ⇒ pareil (la liste ouverte suffit) ;
//   C4  types mêlés, le favori EST dans la liste ⇒ SA ligne est cliquée (article ET personne), pas une baisse de prix,
//       pas le favori d'un autre ; la conversation s'ouvre ;
//   C5  le bouton de la cloche sans nom mais `data-testid` de notifications dans l'en-tête ⇒ reconnu ;
//   C6  aucune cloche (ni bouton, ni liste) ⇒ `cloche` (le geste est dit), rien d'autre ;
//   C7  page complète (« Voir tout », étape `favoriListe`) : la ligne est plus bas, chargée au défilement ⇒ trouvée,
//       cliquée ; la cloche n'est pas touchée ;
//   C8  page complète sans la ligne ⇒ `absent` (ce favori sera sauté), rien de cliqué ;
//   C9  un « Voir tout » d'un bloc d'articles, cloche fermée ⇒ ce n'est PAS la liste de la cloche : la cloche est ouverte.
//  `--form <fichier>` : une autre copie de vrm-formulaire.js (rouge attendu sur la 5.436) ; `--mutation nom` ; `--prouve`.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { chromium } = require('playwright');
const EXT = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
let FORM_SRC = arg('--form') || path.join(EXT, 'vrm-formulaire.js');
const MUTATIONS = {
  // La liste ouverte ne dispense plus de trouver le bouton.
  'sans-liste-ouverte': ['        let p = panneauCloche();\n        if (!p) {', '        let p = null;\n        if (!p) {'],
  // Une ligne absente n'est plus dite « absente ».
  'absent-tu': ["const absent = (extra) => Object.assign(manque('favori-notification'), { absent: true }, extra || {});", "const absent = () => manque('favori-notification');"],
  // Le bouton sans nom n'est plus reconnu par son data-testid de l'en-tête.
  'sans-testid': ["l = uniq([...document.querySelectorAll('[data-testid*=\"notification\" i]')]", "l = uniq([...document.querySelectorAll('vrm-rien')]"],
};
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation', m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌ C/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`);
    if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
if (arg('--mutation')) {
  const M = MUTATIONS[arg('--mutation')]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
  const s = fs.readFileSync(FORM_SRC, 'utf8');
  if (!s.includes(M[0])) { console.log('mutation introuvable'); process.exit(2); }
  FORM_SRC = path.join(os.tmpdir(), `vrm-formulaire-cloche-${process.pid}.js`);
  fs.writeFileSync(FORM_SRC, s.split(M[0]).join(M[1]));
  process.on('exit', () => { try { fs.unlinkSync(FORM_SRC); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };

// Le favori cherché : l'article 7001234, la personne 880011. Un AUTRE favori (autre personne, même article) existe.
const F = { item: '7001234', receiver: '880011', conv: '4455667' };
// La page : `o.liste` = les lignes de la cloche ; `o.bouton` = la forme du bouton ; `o.page` = la page complète.
const BAISSE = (i) => `<a class="rang" data-type="prix" href="/items/${5550000 + i}-nike-air-max"><span>Le prix de l'article Nike Air Max ${i} a été réduit de 15,90 € à 12,00 €</span><small>il y a ${i + 1} h</small></a>`;
const FAVORI = (item, receiver, nom) => `<a class="rang" data-type="favori" href="/inbox/want_it/new?receiver_id=${receiver}&item_id=${item}"><span>${nom} a ajouté ton article à ses favoris</span><small>il y a 3 h</small></a>`;
const PAGE = (o) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vinted (banc)</title><style>
body{margin:0;font-family:sans-serif}header{display:flex;gap:12px;align-items:center;justify-content:flex-end;height:56px;padding:0 16px;border-bottom:1px solid #ddd}
header button{width:44px;height:44px}.pan{position:absolute;top:56px;right:16px;width:400px;max-height:420px;overflow:auto;border:1px solid #ccc;background:#fff;display:none}.pan.on{display:block}
.rang{display:block;padding:10px;border-bottom:1px solid #eee;color:#111;text-decoration:none}main{padding:16px;min-height:900px}footer{padding:16px}
</style></head><body>
<header><b style="margin-right:auto">Vinted</b><a href="/inbox" aria-label="Messages">✉</a>${o.sansCloche ? '' : o.bouton === 'testid' ? '<div data-testid="header-notifications"><button type="button" id="cloche" aria-haspopup="true"><svg width="20" height="20"><circle cx="10" cy="10" r="8"/></svg></button></div>' : `<button type="button" id="cloche" aria-label="Notifications"${o.sansExpanded ? '' : ' aria-expanded="false"'}>🔔</button>`}</header>
<div class="pan" id="pan"${o.role ? ' role="menu"' : ''}><div id="lignes"></div>${o.sansVoirTout ? '' : '<a class="rang" id="voirtout" href="/member/notifications">Voir tout</a>'}</div>
<main id="m">${o.blocArticles ? '<section><h2>Articles similaires</h2><a href="/catalog?search=nike">Voir tout</a></section>' : ''}</main><footer><a href="/settings/notifications">Réglages des notifications</a></footer>
<script>(() => {
  const O = ${JSON.stringify(o)};
  window.__clics = [];
  const pan = document.getElementById('pan'), cl = document.getElementById('cloche'), lignes = document.getElementById('lignes');
  const poser = (html) => { lignes.innerHTML = html; };
  poser(O.lignes || '');
  const ouvrir = (on) => { pan.classList.toggle('on', on); if (cl) { if (!O.sansExpanded && O.bouton !== 'testid') cl.setAttribute('aria-expanded', on ? 'true' : 'false'); if (O.renomme) cl.setAttribute('aria-label', on ? O.renomme : 'Notifications'); if (O.sansNomOuverte && on) cl.setAttribute('aria-label', 'Menu'); } };
  if (cl) cl.addEventListener('click', () => { window.__clics.push('cloche'); ouvrir(!pan.classList.contains('on')); });
  if (O.ouverte) ouvrir(true);
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a'); if (!a) return;
    e.preventDefault();
    window.__clics.push((a.getAttribute('data-type') || a.id || 'lien') + ':' + a.getAttribute('href'));
    const u = new URL(a.href);
    if (a.getAttribute('data-type') === 'favori') {
      fetch('/api/v2/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: u.searchParams.get('item_id'), opposite_user_id: u.searchParams.get('receiver_id') }) })
        .then((r) => r.json()).then((j) => { history.pushState({}, '', '/inbox/' + j.conversation.id); document.getElementById('m').innerHTML = '<p>Conversation</p>'; });
    }
  }, true);
  // La page complète des notifications : les lignes arrivent au défilement (par paquets).
  if (O.page) {
    const m = document.getElementById('m'); let n = 0;
    const paquet = () => { if (n >= O.page.length) return; const d = document.createElement('div'); d.innerHTML = O.page[n++]; m.appendChild(d); };
    paquet();
    window.addEventListener('scroll', () => { if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40) setTimeout(paquet, 150); });
  }
})();</script></body></html>`;

async function ouvrir(b, chemin, o) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/v2/conversations') { let c = {}; try { c = JSON.parse(r.request().postData() || '{}'); } catch (_) {} return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversation: { id: Number(c.item_id === F.item && c.opposite_user_id === F.receiver ? F.conv : 1) } }) }); }
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(o) });
  });
  await pg.goto('https://www.vinted.fr' + chemin);
  return { ctx, pg, errs };
}
async function etape(pg, e, d) {
  await pg.addScriptTag({ content: fs.readFileSync(FORM_SRC, 'utf8') });
  return (await pg.evaluate(([e2, d2]) => globalThis.__vrmFormulaire(e2, d2), [e, d || {}])) || {};
}
const D = { itemId: F.item, receiverId: F.receiver, lien: '' };
const BAISSES = [0, 1, 2, 3, 4].map(BAISSE).join('');
const clics = (pg) => pg.evaluate(() => window.__clics.slice());
const sansLigne = (l) => !l.some((x) => /^(prix|favori):/.test(x));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const cas = async (nom, chemin, o, e, d, juge) => {
    const t = await ouvrir(b, chemin, o);
    try { const r = await etape(t.pg, e, d); await juge(r, await clics(t.pg), t); if (t.errs.length) dit(false, `${nom} : aucune erreur de page`, t.errs.join(' | ')); }
    catch (x) { dit(false, `${nom} — a levé`, x && x.message); }
    finally { if (process.env.SHOTS) { try { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await t.pg.screenshot({ path: path.join(process.env.SHOTS, nom + '.png') }); } catch (_) {} } await t.ctx.close(); }
  };
  try {
    await cas('C1', '/inbox/123', { lignes: BAISSES }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok === false && r.code === 'selecteur' && r.manque === 'favori-notification' && r.absent === true, 'C1 liste = baisses de prix + « Voir tout », favori absent ⇒ « favori-notification », absent — JAMAIS « cloche »', JSON.stringify(r));
      dit(r.voirTout === '/member/notifications' && r.cloche === true, 'C1 le chemin de « Voir tout » est rendu (la liste est bien ouverte)', JSON.stringify(r));
      dit(sansLigne(l) && l.filter((x) => x === 'cloche').length === 1, 'C1 la cloche est ouverte UNE fois, aucune ligne n’est cliquée (aucune baisse de prix)', JSON.stringify(l));
    });
    await cas('C2', '/inbox/123', { lignes: BAISSES, ouverte: true, renomme: 'Fermer les notifications' }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.manque === 'favori-notification' && r.absent === true && r.voirTout === '/member/notifications', 'C2 cloche DÉJÀ ouverte (second essai), bouton « Fermer les notifications » ⇒ absent, jamais « cloche »', JSON.stringify(r));
      dit(l.length === 0, 'C2 rien n’est cliqué (la liste reste ouverte)', JSON.stringify(l));
    });
    await cas('C3', '/inbox/123', { lignes: BAISSES, ouverte: true, sansNomOuverte: true }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.manque === 'favori-notification' && r.absent === true, 'C3 cloche ouverte dont le bouton n’a plus de nom reconnu ⇒ la liste ouverte suffit : absent, jamais « cloche »', JSON.stringify(r));
      dit(l.length === 0, 'C3 rien n’est cliqué', JSON.stringify(l));
    });
    await cas('C4', '/inbox/123', { lignes: BAISSE(0) + FAVORI(F.item, '990022', 'autre_personne') + BAISSE(1) + FAVORI('7009999', F.receiver, 'la_meme_personne') + FAVORI(F.item, F.receiver, 'acheteuse') + BAISSE(2) }, 'favoriOuvrir', D, async (r, l, t) => {
      const fav = l.filter((x) => /^favori:/.test(x));
      dit(r.ok === true && r.conv === F.conv, 'C4 types mêlés, le favori est là ⇒ la conversation de CE favori s’ouvre', JSON.stringify(r).slice(0, 300));
      dit(fav.length === 1 && fav[0].includes(`receiver_id=${F.receiver}`) && fav[0].includes(`item_id=${F.item}`) && !l.some((x) => /^prix:/.test(x)), 'C4 UNE ligne cliquée : celle qui porte CET article ET CETTE personne — ni une baisse de prix, ni le favori d’un autre, ni un autre article', JSON.stringify(l));
      dit(new URL(t.pg.url()).pathname === '/inbox/' + F.conv, 'C4 la page montre la conversation');
    });
    await cas('C5', '/inbox/123', { lignes: FAVORI(F.item, F.receiver, 'acheteuse'), bouton: 'testid' }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok === true && l[0] === 'cloche', 'C5 bouton sans nom, data-testid de notifications dans l’en-tête ⇒ reconnu, ouvert, le favori cliqué', JSON.stringify({ r: r.ok, m: r.manque, l }));
    });
    await cas('C6', '/inbox/123', { sansCloche: true, sansVoirTout: true }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok === false && r.code === 'selecteur' && r.manque === 'cloche' && r.absent !== true && l.length === 0, 'C6 aucune cloche (ni bouton, ni liste) ⇒ « cloche », rien de cliqué', JSON.stringify(r));
    });
    await cas('C7', '/member/notifications', { lignes: '', page: [BAISSES, BAISSES + BAISSES, BAISSES + FAVORI(F.item, F.receiver, 'acheteuse') + BAISSES] }, 'favoriListe', D, async (r, l) => {
      dit(r.ok === true && r.conv === F.conv, 'C7 page complète : la ligne arrive au défilement ⇒ trouvée, la conversation s’ouvre', JSON.stringify(r).slice(0, 300));
      dit(!l.includes('cloche') && l.filter((x) => /^favori:/.test(x)).length === 1 && !l.some((x) => /^prix:/.test(x)), 'C7 la cloche n’est pas touchée ; UNE ligne cliquée, la bonne', JSON.stringify(l));
    });
    await cas('C8', '/member/notifications', { lignes: '', page: [BAISSES, BAISSES, FAVORI(F.item, '990022', 'autre')] }, 'favoriListe', D, async (r, l) => {
      dit(r.ok === false && r.manque === 'favori-notification' && r.absent === true && r.liste === true && l.length === 0, 'C8 page complète sans la ligne ⇒ absent (ce favori sera sauté), rien de cliqué', JSON.stringify({ r, l }));
    });
    await cas('C9', '/inbox/123', { lignes: FAVORI(F.item, F.receiver, 'acheteuse'), blocArticles: true }, 'favoriOuvrir', D, async (r, l) => {
      dit(r.ok === true && l[0] === 'cloche', 'C9 un « Voir tout » d’un bloc d’articles n’est pas la liste de la cloche : la cloche est bien ouverte', JSON.stringify({ r: r.ok, m: r.manque, a: r.absent, l }));
    });
  } finally { await b.close(); }
  console.log(`\n${ko ? '❌' : '✅'} cloche des favoris : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
