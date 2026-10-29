// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES AUX FAVORIS « COMME VINTEX » (29 octobre, 5.280 — sa demande :
//  « copie ce que fait Vintex comme pour les repu »)
//
//  MESURÉ avec VRM Observateur 1.1 sur 9 favoris envoyés par Vintex (aucun
//  refusé) : tout part de l'onglet vinted.fr (cookies du site, csrf de la page,
//  aucun `Authorization`), dans cet ordre :
//    POST /conversations → 3,2–6,0 s → GET /transactions/{tx} → 0,3–0,8 s →
//    POST /transactions/{tx}/offers {offer:{currency,price}} → 0,4–0,5 s →
//    POST /conversations/{id}/replies.
//  On EXÉCUTE le vrai `executerMessageFavori` (background.js dans un vm, faux
//  Vinted qui note chaque requête, faux serveur VRM qui rend l'autorisation) :
//    · l'ordre C T O R, tout depuis la page, sans `Authorization` ;
//    · le prix de l'offre = prix de l'annonce − la réduction (« 45.00 ») ;
//    · sans réduction : C T R (aucune offre) ; prix illisible : aucune offre ;
//    · les pauses tirées dans les plages mesurées ;
//    · le fil n'est relu que si la réponse de création ne suffit pas ;
//    · sans onglet Vinted : RIEN ne part (`onglet_vinted`) ;
//    · un fil déjà contacté : aucune offre, aucun message ;
//    · la transaction d'une AUTRE annonce : rien ne part.
//  §6.1 — `--prouve` : sur origin/main (5.279) tout partait du service worker.
// ════════════════════════════════════════════════════════════════════════════
const { faireFond } = require('./_fond-vm.cjs');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + d : '')); } };
const UID = '111', JETON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function monter({ src, pourcentage = 10, onglets, creationComplete = true, tx = '5001', prix = { amount: '50.0', currency_code: 'EUR' }, autreArticle = false, dejaContacte = false } = {}) {
  const conv = (complet) => ({ id: 301, opposite_user: { id: 201 }, transaction: { id: tx ? Number(tx) : undefined, item_id: 101 }, allow_reply: true, ...(complet ? { messages: dejaContacte ? [{ entity_type: 'message' }] : [] } : {}) });
  const f = faireFond({ src, connecte: UID, ...(onglets ? { onglets } : {}),
    vinted: (e) => {
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv(creationComplete), code: 0 } };
      if (e.methode === 'GET' && /\/api\/v2\/conversations\/301$/.test(e.chemin)) return { status: 200, body: { conversation: conv(true) } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: Number(tx), item_id: autreArticle ? 999 : 101, item: { id: autreArticle ? 999 : 101, price: prix } } } };
      if (e.methode === 'POST' && /\/api\/v2\/transactions\/\d+\/offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /\/api\/v2\/conversations\/301\/replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, o = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(o.body || '{}');
      const j = c.action === 'consommer'
        ? { ok: true, uid: UID, suivi: 's', travail: { itemId: '101', recipientId: '201', initiator: 'native-fixture', message: 'Bonjour !', ...(pourcentage != null ? { pourcentage } : {}) } }
        : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, o);
  };
  f.ctx.authToken = async () => ({ access_token: 'session' });
  f.ctx.notifierApp = async () => {};
  f.ctx.__vrmPausesVues = [];
  return f;
}
async function run(o = {}) {
  const f = monter({ src: process.env.BG_SRC || undefined, ...o });
  if (typeof f.ctx.executerMessageFavori !== 'function') return { f, r: {}, absent: true };
  const acc = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
  let r = {}; try { r = await f.ctx.executerMessageFavori(UID, acc, { jeton: JETON }); } catch (e) { r = { erreur: String(e.message) }; }
  return { f, r };
}
const seq = (j) => j.vinted.map((v) => /conversations$/.test(v.chemin) ? 'C' : /offers$/.test(v.chemin) ? 'O' : /replies$/.test(v.chemin) ? 'R' : /transactions\/\d+$/.test(v.chemin) ? 'T' : /conversations\/\d+$/.test(v.chemin) ? 'L' : '?').join('');

(async () => {
  if (process.argv.includes('--prouve')) {
    const cp = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
    const avant = path.join(os.tmpdir(), 'bg-avant-favoris.js');
    fs.writeFileSync(avant, cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: path.join(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }));
    const { f, r } = await run({ src: avant });
    dit(seq(f.j) === 'CTOR', "§6.1 — sur origin/main : l'ordre de Vintex (conversation, transaction, offre, message)", seq(f.j) + ' ' + JSON.stringify(r.json || r));
    dit(f.j.vinted.length > 0 && f.j.vinted.every((v) => v.origine === 'page'), "§6.1 — sur origin/main : tout part de la page", f.j.vinted.map((v) => v.origine).join(','));
    console.log(ko ? `\n❌ preuve §6.1 : ${ko} rouge(s) sur le code d'avant` : '\n✅');
    process.exit(ko ? 1 : 0);
  }
  { const { f, r } = await run();
    dit(r.ok && r.json && r.json.resultat === 'envoye', 'chemin positif : le message est confirmé', JSON.stringify(r));
    dit(seq(f.j) === 'CTOR', "l'ordre est celui de Vintex : conversation, transaction, offre, message", seq(f.j));
    dit(f.j.vinted.every((v) => v.origine === 'page' && v.credentials === 'include'), 'tout part de la page Vinted, avec les cookies du site');
    dit(f.j.vinted.every((v) => !Object.keys(v.entetes || {}).some((k) => /authorization/i.test(k))), 'aucun en-tête Authorization (comme le site)');
    const o = f.j.vinted.find((v) => /offers$/.test(v.chemin));
    const corps = o && JSON.parse(o.corps || '{}');
    dit(corps && JSON.stringify(corps) === JSON.stringify({ offer: { currency: 'EUR', price: '45.00' } }), "l'offre : prix de l'annonce − 10 % (« 45.00 »), forme exacte de Vintex", o && o.corps);
    const rep = f.j.vinted.find((v) => /replies$/.test(v.chemin));
    const cr = rep && JSON.parse(rep.corps || '{}');
    dit(cr && cr.reply && cr.reply.body === 'Bonjour !' && cr.reply.photo_temp_uuids === null && typeof cr.reply.is_personal_data_sharing_check_skipped === 'boolean', 'le message : forme de Vintex (body, photo_temp_uuids:null, booléen)', rep && rep.corps);
    const cv = f.j.vinted[0]; const cc = cv && JSON.parse(cv.corps || '{}');
    dit(cc && Object.keys(cc).sort().join(',') === 'initiator,item_id,opposite_user_id', 'la conversation : les trois champs mesurés, rien d\'autre');
    const p = f.ctx.__vrmPausesVues || [];
    const de = (q) => p.filter((x) => x[0] === 'favori:' + q).map((x) => x[1]);
    dit(de('transaction').length === 1 && de('transaction')[0] >= 3200 && de('transaction')[0] <= 6000, 'pause conversation → transaction tirée entre 3,2 et 6 s', JSON.stringify(p));
    dit(de('offre').length === 1 && de('offre')[0] >= 300 && de('offre')[0] <= 800, 'pause transaction → offre entre 0,3 et 0,8 s');
    dit(de('reponse').length === 1 && de('reponse')[0] >= 400 && de('reponse')[0] <= 550, 'pause offre → message entre 0,4 et 0,55 s');
  }
  { const { f, r } = await run({ pourcentage: null });
    dit(r.ok && seq(f.j) === 'CTR', 'sans réduction : conversation, transaction, message — aucune offre', seq(f.j)); }
  { const { f, r } = await run({ prix: null });
    dit(r.ok && seq(f.j) === 'CTR', "prix de l'annonce illisible : aucune offre inventée, le message part", seq(f.j)); }
  { const { f, r } = await run({ creationComplete: false });
    dit(r.ok && seq(f.j) === 'CLTOR', 'réponse de création incomplète : le fil est relu avant tout envoi', seq(f.j)); }
  { const { f, r } = await run({ onglets: [] });
    dit(!r.ok && r.json && r.json.raison === 'onglet_vinted' && f.j.vinted.length === 0, 'sans onglet Vinted : RIEN ne part, raison dite', JSON.stringify(r) + ' ' + seq(f.j)); }
  { const { f, r } = await run({ dejaContacte: true });
    dit(r.json && r.json.resultat === 'ignore' && !/[OR]/.test(seq(f.j)), 'fil déjà contacté : ni offre ni message', seq(f.j)); }
  { const { f, r } = await run({ autreArticle: true });
    dit(!r.ok && !/[OR]/.test(seq(f.j)), "transaction d'une autre annonce : ni offre ni message", seq(f.j)); }
  { const { f } = await run({ pourcentage: 99, prix: { amount: '1.5', currency_code: 'EUR' } });
    dit(!/O/.test(seq(f.j)), 'une offre sous 1 € ne part jamais', seq(f.j)); }
  console.log(ko ? `\n❌ favoris comme Vintex : ${ko} rouge(s)` : `\n✅ favoris comme Vintex : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
