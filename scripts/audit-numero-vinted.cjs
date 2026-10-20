// ════════════════════════════════════════════════════════════════════════════
//  « LE NUMÉRO À CÔTÉ DU BOUTON PUBLIER » (20 octobre, 5.200)
//  Julien : « quand on publie sur Vinted je veux que le numéro soit écrit à côté
//  du bouton Publier ; après, sur Vinted, qu'il y ait le numéro dessus ; pareil
//  dans les ventes ». On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) :
//   · la page de dépôt RÉSERVE le prochain numéro jamais servi (après le plus
//     haut), l'écrit AVANT de le montrer, le même onglet garde le même, un autre
//     onglet en a un autre ; lecture ratée ⇒ aucun numéro promis, rien d'écrit ;
//   · la publication (identifiant rendu par Vinted) LIE la réservation à CETTE
//     annonce ; écriture ratée ⇒ gardée et liée au geste suivant ;
//   · les numéros affichés viennent d'identités (fiche, transaction, conversation) ;
//   · le vrai `inject.js` : seule une réponse 2xx de `POST …/item_upload/items`
//     part, avec l'identifiant — jamais le corps envoyé.
//  Et la règle de l'app (`numerosReserves`) : mêmes clés que l'extension (§11).
//  Aucune donnée réelle.  `--src chemin` : sur une autre copie (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const fs = require('fs'), path = require('path'), vm = require('vm');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${det ? ' — ' + det : ''}`); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const MAIN = () => ({ vinted_used_numeros: [1, 2, 3, 51, 52, 'B558'], vinted_annonce_numeros: { '10400000001': { numero: '73' }, '10400000002': { numero: '12' } }, vinted_sale_overrides: { '9000001': { numero: '60' } } });
function monter(opts = {}) {
  const lignes = { main: MAIN(), 'harvest_111_orders_sold': { payload: { my_orders: [{ transaction_id: 9000001, conversation_id: 8000001 }, { transaction_id: 9000002, conversation_id: 8000002 }] } },
    'harvest_111_txn_9000002': { payload: { transaction: { id: 9000002, item_id: 10400000002 } } }, ...(opts.lignes || {}) };
  const f = faireFond({ src: cheminSource(), lignes, lectureKO: opts.lectureKO || (() => false) });
  if (opts.ecritureKO) {
    const f0 = f.ctx.fetch;
    f.ctx.fetch = async (u, o = {}) => (opts.ecritureKO() && /panel_num_reserves/.test(String(u) + String(o.body || '')) && (o.method || 'GET') !== 'GET')
      ? { ok: false, status: 503, headers: { get: () => 'text/html' }, json: async () => ({}), text: async () => '503' } : f0(u, o);
  }
  return f;
}
const tab = (id) => ({ tab: { id }, origin: 'https://www.vinted.fr', url: 'https://www.vinted.fr/items/new' });
const resaDe = (f) => f.lignes.panel_num_reserves || null;

(async () => {
  await essaie('réservation', async () => {
    const f = monter();
    if (typeof f.ctx.reserverNumeroPourOnglet !== 'function') { dit(false, 'la réservation existe dans background.js'); return; }
    const r1 = await f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(5));
    dit(r1 && r1.ok && r1.numero === '74', 'la page de dépôt reçoit le prochain numéro JAMAIS servi (après le plus haut : 73)', JSON.stringify(r1));
    const L = resaDe(f);
    dit(!!(L && L.attente && L.attente['74']), 'il est RÉSERVÉ dans la base avant d\'être montré', JSON.stringify(L && L.attente));
    const r2 = await f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(5));
    dit(r2 && r2.numero === '74', 'le même onglet garde le même numéro', JSON.stringify(r2));
    const r3 = await f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(6));
    dit(r3 && r3.numero === '75', 'un autre onglet de dépôt en a un autre', JSON.stringify(r3));
    // La publication de l'onglet 5 : Vinted rend l'annonce 10499999999.
    await f.envoyer({ from: 'cancale-content', kind: 'publication', itemId: '10499999999', status: 200, domain: 'www.vinted.fr' }, tab(5));
    await new Promise((r) => setTimeout(r, 30));
    const L2 = resaDe(f);
    dit(L2 && L2.items && L2.items['10499999999'] && L2.items['10499999999'].numero === '74', 'la publication LIE le N°74 à l\'annonce créée', JSON.stringify(L2 && L2.items));
    dit(L2 && !L2.attente['74'] && !!L2.attente['75'], '… le N°74 n\'est plus « en attente », le 75 l\'est toujours', JSON.stringify(L2 && L2.attente));
    const r4 = await f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(5));
    dit(r4 && r4.numero === '76', 'une nouvelle annonce dans le même onglet prend le suivant', JSON.stringify(r4));
    const pubKo = await f.envoyer({ from: 'cancale-content', kind: 'publication', itemId: '10499999998', status: 422, domain: 'www.vinted.fr' }, tab(6));
    await new Promise((r) => setTimeout(r, 20));
    dit(!(resaDe(f).items || {})['10499999998'], 'une publication refusée par Vinted (422) ne lie rien');
  });
  await essaie('pas su', async () => {
    const f = monter({ lectureKO: (u) => /id=eq\.main/.test(u) });
    const r = await f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(5));
    dit(r && r.ok === false && !r.numero, 'base illisible : AUCUN numéro promis', JSON.stringify(r));
    dit(!resaDe(f), '… et rien n\'est écrit');
    const g = monter({ ecritureKO: () => true });
    const r2 = await g.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(5));
    dit(r2 && r2.ok === false, 'réservation pas écrite : aucun numéro promis', JSON.stringify(r2));
  });
  await essaie('publication pendant une panne', async () => {
    let ko2 = false;
    const f = monter({ ecritureKO: () => ko2 });
    await f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(5));
    ko2 = true;
    await f.envoyer({ from: 'cancale-content', kind: 'publication', itemId: '10499999999', status: 201, domain: 'www.vinted.fr' }, tab(5));
    await new Promise((r) => setTimeout(r, 30));
    dit(!(resaDe(f).items || {})['10499999999'], 'base en panne : rien n\'est lié (pas su)');
    ko2 = false;
    const r = await f.envoyer({ from: 'cancale-vcapture', action: 'numeroPourPublier', domain: 'www.vinted.fr' }, tab(5));
    await new Promise((r) => setTimeout(r, 30));
    dit((resaDe(f).items || {})['10499999999'] && resaDe(f).items['10499999999'].numero === '74', 'au geste suivant, la publication vue est liée à SON numéro', JSON.stringify(resaDe(f).items));
    dit(r && r.numero === '75', '… et la nouvelle annonce a le suivant', JSON.stringify(r));
  });
  await essaie('affichage', async () => {
    const f = monter();
    const r = await f.envoyer({ from: 'cancale-vcapture', action: 'numeros', items: ['10400000001', '10400000099'], convs: ['8000001', '8000002', '8000099'], txs: ['9000002'] }, tab(5));
    dit(r && r.ok && r.items['10400000001'] === '73' && !r.items['10400000099'], 'annonce : le numéro de SA fiche, rien pour une annonce inconnue', JSON.stringify(r && r.items));
    dit(r && r.convs['8000001'] === '60' && r.convs['8000002'] === '12' && !r.convs['8000099'], 'vente : par la conversation → transaction → N° (corrigé ou fiche de l\'annonce)', JSON.stringify(r && r.convs));
    dit(r && r.txs['9000002'] === '12', 'transaction → annonce → N°', JSON.stringify(r && r.txs));
  });
  // Le vrai inject.js : la publication.
  await essaie('inject.js', async () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'inject.js'), 'utf8');
    const m = /  const RE_PUBLIE = [\s\S]*?\n  };\n/.exec(src);
    if (!m) { dit(false, 'notePublication existe dans inject.js'); return; }
    const posts = [];
    const c = { location: new URL('https://www.vinted.fr/items/new'), URL, JSON, String, Number, Object, Promise, post: (x) => posts.push(x) };
    vm.runInNewContext(m[0] + '\nthis.np = notePublication;', c);
    c.np('POST', '/api/v2/item_upload/items', 200, () => JSON.stringify({ item: { id: 10499999999, title: 'x' }, code: 0 }));
    c.np('POST', '/api/v2/item_upload/items', 422, () => JSON.stringify({ item: { id: 1 } }));
    c.np('GET', '/api/v2/item_upload/items', 200, () => '{}');
    c.np('POST', 'https://evil.example/api/v2/item_upload/items', 200, () => JSON.stringify({ item: { id: 10499999997 } }));
    await new Promise((r) => setTimeout(r, 10));
    dit(posts.length === 1 && posts[0].itemId === '10499999999' && !('body' in posts[0]), 'seule la réponse 2xx de Vinted part, avec l\'identifiant (pas le corps)', JSON.stringify(posts));
  });
  // La règle de l'app : mêmes réservations, mêmes clés.
  await essaie('app', async () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
    const r = /\/\/ <reserves-num-regle>[\s\S]*?\/\/ <\/reserves-num-regle>/.exec(app);
    const cn = /const cleNum = \(v\) => \{[\s\S]*?\n\};/.exec(app);
    if (!r || !cn) { dit(false, 'la règle numerosReserves existe dans l\'app'); return; }
    const c = {}; vm.runInNewContext(cn[0] + '\n' + r[0] + '\nthis.f = numerosReserves;', c);
    const now = Date.parse('2026-10-20T12:00:00Z');
    const out = c.f({ attente: { '74': { at: '2026-10-20T11:00:00Z' }, '70': { at: '2026-10-20T05:00:00Z' } }, items: { '10499999999': { numero: '75' } } }, now);
    dit(out.cles.has('74') && !out.cles.has('70') && out.cles.has('75') && out.parItem['10499999999'] === '75', 'app : réservation de moins de 3 h prise, plus vieille ignorée, annonce liée lue', JSON.stringify([...out.cles]));
    const vide = c.f(null, now);
    dit(vide.cles.size === 0, 'app : pas de ligne ⇒ aucune réservation');
  });
  console.log(ko ? `\n❌ ${ko} rouge(s), ${ok} vert(s)` : `\n✅ le numéro sur Vinted : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
