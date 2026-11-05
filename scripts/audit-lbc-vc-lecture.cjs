#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « IL NE DOIT PLUS Y AVOIR D'ERREUR PENDANT LA LECTURE » (1er nov., 5.296)
// ════════════════════════════════════════════════════════════════════════════
//  Julien : « occupe-toi des dernières modifications : les annonces Vestiaire
//  Collective, les ventes, tout ça — que tout soit parfait ; pareil pour
//  Leboncoin : il ne doit plus y avoir d'erreur pendant la lecture des données ».
//  Le VRAI `background.js` dans `_fond-vm.cjs` (base à état, projection appliquée,
//  échecs servis : 503, 401, 403) et le VRAI `vc-inject.js` dans une page.
//
//  L — LEBONCOIN, la carte de l'onglet (`vrmLbcTransport[onglet].receptions`) :
//   L1 une réponse AUXILIAIRE d'une page de transaction (configuration de
//      livraison) ne pose plus « format non reconnu » PAR-DESSUS un
//      enregistrement réussi ;
//   L2 une liste de transactions rendue VIDE est « liste vide », pas un format inconnu ;
//   L3 le flux d'accueil (`dashboard/v1/search`) sans annonce à lui ne pose pas d'échec ;
//   L4 le tableau de bord pro `Ads: []` est « liste vide » ;
//   L5 une lecture de base passagère (503, puis 401 ⇒ jeton renouvelé) est relue
//      une fois et la capture est RANGÉE ; un refus net (403) n'est pas relu et
//      rien n'est écrit (lecture KO ⇒ écriture nulle, §5).
//  V — VESTIAIRE :
//   V1 la fiche d'une annonce (titre, photo de Vestiaire, prix + sa clé, état)
//      est lue et rangée ; une photo d'un autre hôte est refusée ;
//   V2 chaque ligne porte le compte de l'ONGLET (`/users/me`), jamais un compte
//      dit par le message ;
//   V3 une liste ENTIÈRE d'un compte ne retire pas les annonces d'un AUTRE compte ;
//   V4 « à expédier » lue en entier sur un compte ne retire pas « à expédier »
//      aux ventes d'un autre compte (un colis caché est un colis perdu) ;
//   V5 une capture sans fiche n'efface pas la fiche connue.
//
//  `--src` / `--inject` : une autre copie (preuve sur le code d'avant, §6.1).
//  `--prouve` : chaque règle réaffaiblie (mutation) doit rendre l'audit rouge.
//  Données INVENTÉES uniquement (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['auxiliaireNote', 'src', 'if(lectureTx)await noterReceptionLbc(\'transactions\',r,sender);\n              if(!vide)', 'await noterReceptionLbc(\'transactions\',r,sender);\n              if(!vide)'],
    ['listeVideInconnue', 'src', "vide=Array.isArray(j)&&j.length===0;", 'vide=false;'],
    ['accueilNote', 'src', "if(r&&(r.etat==='enregistre'||LBC_ANNONCES_LECTURE.test(String(msg.url))))", "if(r&&(r.etat==='enregistre'||LBC_ANNONCES_LECTURE.test(String(msg.url))||/dashboard/.test(String(msg.url))))"],
    ['sansRelecture', 'src', 'if (!passager || essai > 0) break;', 'break;'],
    ['relitTout', 'src', 'passager = res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500;', 'passager = true;'],
    ['compteIgnore', 'src', "if (entier) { const garde = {}; for (const [k, v] of Object.entries(data.items)) if ((complets && complets.has(k)) || (v && autreCompteVc(v.compte, compte))) garde[k] = v; data.items = Object.assign(garde, lus); }", 'if (entier) { data.items = lus; }'],
    ['expedierAutreCompte', 'src', "&& !dansListe.has(id) && !autreCompteVc(v.compte, compteM)", '&& !dansListe.has(id)'],
    ['photoToutHote', 'inject', "/(^|\\.)vestiairecollective\\.com$/i.test(u.hostname) && /\\.(jpe?g", "/./.test(u.hostname) && /\\.(jpe?g"],
    ['relaisPerdFiche', 'relais', "titre: String((x && x.titre) || '').slice(0, 120),", ''],
    ['ficheEcrasee', 'src', "titre: coupeVc(x.titre || '', 120) || prev.titre || '',", "titre: coupeVc(x.titre || '', 120),"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbc-vc-lecture-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 180000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => JSON.parse(JSON.stringify(x));
const API = 'https://api.leboncoin.fr/api';
const MON = '8442bbbb-0000-4000-8000-0000000000bb';   // son compte Leboncoin (inventé)
const ONGLET = 9;
const senderLbc = (url) => ({ tab: { id: ONGLET, url }, frameId: 0, url });
const carte = (f, fam) => { const c = (f.store.vrmLbcTransport || {})[ONGLET]; return c && c.receptions ? c.receptions[fam] || null : null; };
const ouvrir = (f) => { if (f.ctx.ouvrirPont) {} };

async function leboncoin() {
  // L1 — un enregistrement réussi, puis la configuration de livraison de la même page.
  {
    const f = faireFond({ src: F.src, lignes: { lbc_ventes: { ventes: {} } } });
    const pageTx = 'https://www.leboncoin.fr/compte/part/mes-transactions';
    const liste = JSON.stringify([{ id: { purchase_id: 7001 }, item: { title: 'Paire inventée', price: 4000 }, step: 'paid', created_at: '2026-10-30T10:00:00Z' }]);
    const r1 = await f.envoyer({ from: 'cancale-lbc', action: 'lbcVente', url: `${API}/consumergoods/proxy/v3/pages/transactions?page=1`, body: liste }, senderLbc(pageTx));
    const avant = carte(f, 'transactions');
    const config = JSON.stringify({ configs: [{ carrier: 'mondial_relay', enabled: true }] });
    const r2 = await f.envoyer({ from: 'cancale-lbc', action: 'lbcVente', url: `${API}/delivery-configurator-api/v1/configs?ad_id=1`, body: config }, senderLbc(pageTx));
    const apres = carte(f, 'transactions');
    dit(avant && avant.etat === 'enregistre', 'L1 · la liste de transactions est enregistrée et notée sur la carte', JSON.stringify(r1));
    dit(apres && apres.etat === 'enregistre', 'L1 · la configuration de livraison de la même page ne pose plus « format non reconnu » par-dessus', JSON.stringify(apres) + ' · ' + JSON.stringify(r2));
  }
  // L2 — une liste de transactions VIDE.
  {
    const f = faireFond({ src: F.src, lignes: { lbc_ventes: { ventes: {} } } });
    await f.envoyer({ from: 'cancale-lbc', action: 'lbcVente', url: `${API}/consumergoods/proxy/v3/pages/transactions?page=1`, body: '[]' }, senderLbc('https://www.leboncoin.fr/compte/part/mes-transactions'));
    const c = carte(f, 'transactions');
    dit(c && c.etat === 'liste-vide', 'L2 · une liste de transactions rendue vide est « liste vide », pas « format non reconnu »', JSON.stringify(c));
  }
  // L3 — le flux d'accueil, annonces d'AUTRUI seulement.
  {
    const f = faireFond({ src: F.src, lignes: { lbc_listings: { items: {} }, lbc_accounts: { accounts: { [MON]: { id: MON, sessionAt: new Date().toISOString() } } } } });
    const corps = JSON.stringify({ ads: [{ list_id: 66001, subject: 'Chalet', price: [120], owner: { user_id: 'autrui-1', name: 'Autre' } }] });
    await f.envoyer({ from: 'cancale-lbc', action: 'lbcRaw', url: `${API}/dashboard/v1/search`, body: corps, session: '' }, senderLbc('https://www.leboncoin.fr/'));
    const c = carte(f, 'annonces');
    dit(!c || c.etat === 'enregistre', 'L3 · le flux d’accueil sans annonce à lui ne pose pas « format non reconnu » sur la carte', JSON.stringify(c));
  }
  // L4 — le tableau de bord pro, aucune annonce.
  {
    const f = faireFond({ src: F.src, lignes: { lbc_listings: { items: {} } } });
    await f.envoyer({ from: 'cancale-lbc', action: 'lbcRaw', url: `${API}/stats/proxy/v2/account/classifieds/analysis/list`, body: JSON.stringify({ Facets: { Total: 0 }, Ads: [] }), session: '' }, senderLbc('https://www.leboncoin.fr/compte/pro/mes-annonces'));
    const c = carte(f, 'annonces');
    dit(c && c.etat === 'liste-vide', 'L4 · le tableau de bord pro sans annonce est « liste vide »', JSON.stringify(c));
  }
  // L5 — la lecture qui précède l'écriture : 503 puis 200 ; 401 puis 200 ; 403.
  for (const [code, attendu] of [[503, 'relue'], [401, 'relue'], [403, 'refus']]) {
    const lignes = { lbc_listings: { items: { '5550002': { id: '5550002', subject: 'Ancienne', price: 30, account: MON } } } };
    const f = faireFond({ src: F.src, lignes });
    const vrai = f.ctx.fetch; let rates = 0, renouvele = 0;
    f.ctx.fetch = async (u, o) => {
      if (/\/rest\/v1\/app_data\?id=eq\.lbc_listings/.test(String(u)) && (!o || !o.method || o.method === 'GET') && rates === 0) { rates++; return { ok: false, status: code, json: async () => ({}), text: async () => '{}', headers: { get: () => 'application/json' } }; }
      if (/\/auth\/v1\/token/.test(String(u))) { renouvele++; return { ok: true, status: 200, json: async () => ({ access_token: 'jeton.neuf', refresh_token: 'r2', expires_in: 3600, user: { id: 'owner-banc', email: 'banc@vrm.test' } }), text: async () => '{}', headers: { get: () => 'application/json' } }; }
      return vrai(u, o);
    };
    const r = await f.ctx.storeLbcListings(`${API}/adfinder/v2/myads`, [{ id: '5550003', subject: 'Nouvelle', price: 45, account: MON }], 'owner-banc');
    const items = f.lignes.lbc_listings.items;
    if (attendu === 'relue') {
      dit(r && r.ok === true && items['5550003'] && items['5550002'], `L5 · une lecture ratée en ${code} est relue une fois : la capture est rangée, rien n’est perdu`, JSON.stringify(r));
      if (code === 401) dit(renouvele >= 1, 'L5 · un 401 renouvelle le jeton avant de relire', 'renouvellements=' + renouvele);
    } else dit(r && r.ok === false && r.etat === 'lecture-refusee' && !items['5550003'] && items['5550002'], 'L5 · un refus net (403) n’est pas relu : rien n’est écrit, la ligne reste entière', JSON.stringify(r));
  }
}

// Le VRAI vc-inject.js dans une page vestiairecollective.com.
function pageVc() {
  const INJ = fs.readFileSync(F.inject, 'utf8');
  const posts = [];
  const reponses = {};
  const win = {
    postMessage: (m) => posts.push(copie(m)),
    fetch: async (u) => { const b = reponses[u] || '{}'; return { status: 200, headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => b }; },
    addEventListener() {},
  };
  const ctx = { window: win, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} }, location: { origin: 'https://fr.vestiairecollective.com', pathname: '/members/profile/', href: 'https://fr.vestiairecollective.com/members/profile/' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math };
  vm.createContext(ctx); vm.runInContext(INJ, ctx, { filename: 'vc-inject.js' });
  const charge = async (url, corps) => { reponses[url] = JSON.stringify(corps); await win.fetch(url); await attendre(15); return posts.filter((p) => p.__tag === 'CANCALE_VC').pop(); };
  return { charge, posts };
}
// Ce que vc.js relaie au fond (mêmes champs que vc.js, 5.296).
const relaisAnnonces = (d) => ({ from: 'cancale-vc', action: 'vcAnnonces', items: d.items, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0, forme: d.forme || [] });
const VC = 'https://apiv2.vestiairecollective.com/users/me';
const senderVc = (tab) => ({ tab: { id: tab, url: 'https://fr.vestiairecollective.com/members/profile/' }, frameId: 0, url: 'https://fr.vestiairecollective.com/members/profile/' });

async function vestiaire() {
  const p = pageVc();
  const d = await p.charge(`${VC}/product-listings?offset=0&limit=50`, { meta: { count: 2, offset: 0 }, data: [
    { id: 'P900', name: 'Baskets Nike Dunk Low', status: 'on_sale', price: { cents: 9900, currency: 'EUR' }, pictures: [{ path: 'https://images.vestiairecollective.com/produit/P900-1.jpg' }], description: 'Réf. VRM-41', seller: { user: { name: 'NePasLire' } } },
    { id: 'P901', name: 'Adidas Samba', status: 'pending', price: 70, pictures: ['https://cdn.autre-site.example/P901.jpg'] },
  ] });
  const it = d && d.items ? Object.fromEntries(d.items.map((x) => [x.id, x])) : {};
  dit(it.P900 && it.P900.titre === 'Baskets Nike Dunk Low' && it.P900.statut === 'on_sale' && it.P900.prix && it.P900.prix.valeur === 99 && it.P900.prix.cle === 'price.cents' && /images\.vestiairecollective\.com/.test(it.P900.photo || ''), 'V1 · la fiche est lue : titre, état tel quel, prix en euros avec sa clé, photo de Vestiaire', JSON.stringify(it.P900));
  dit(it.P901 && it.P901.photo === '' && it.P901.prix && it.P901.prix.valeur === 70, 'V1 · une photo d’un autre hôte est refusée (rien n’est montré plutôt qu’une image tierce)', JSON.stringify(it.P901));
  dit(d && !JSON.stringify(d).includes('NePasLire'), 'V1 · rien de ce qui est sous une clé de personne ne part');
  // Le VRAI relais vc.js : il doit passer la fiche au fond (sinon elle se perd en route).
  {
    const RELAIS = fs.readFileSync(F.relais, 'utf8');
    const envois = []; let ecoute = null;
    const win = { addEventListener: (t, f) => { if (t === 'message') ecoute = f; }, postMessage() {} };
    const ctx = { window: win, chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { envois.push(copie(m)); if (cb) cb(); }, lastError: null } }, location: { href: 'https://fr.vestiairecollective.com/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set };
    vm.createContext(ctx); vm.runInContext(RELAIS, ctx, { filename: 'vc.js' });
    if (ecoute) ecoute({ source: win, data: d });
    const m = envois.find((x) => x && x.action === 'vcAnnonces');
    const x = m && m.items && m.items.find((y) => y.id === 'P900');
    dit(x && x.titre === 'Baskets Nike Dunk Low' && x.photo && x.prix && x.prix.valeur === 99 && x.statut === 'on_sale' && Array.isArray(m.forme) && m.forme.length > 0, 'V1 · le relais vc.js passe la fiche et sa forme au fond', JSON.stringify(x));
  }

  // Le fond : compte de l'onglet, liste entière par compte, fiche gardée.
  const f = faireFond({ src: F.src, lignes: { vc_listings: { items: { A1: { boost: null, ref: '', vuAt: '2026-10-30T10:00:00Z', titre: 'Annonce du compte A', compte: 'compteA' } }, liens: {} } } });
  // L'onglet 21 a lu /users/me du compte B.
  if (typeof f.ctx.noterSessionVc === 'function') await f.ctx.noterSessionVc('compteB', 21, []);
  await f.envoyer(Object.assign(relaisAnnonces(d), { compte: 'compteMenteur', moi: 'compteB' }), senderVc(21));
  const items = (f.lignes.vc_listings || {}).items || {};
  dit(items.P900 && items.P900.titre === 'Baskets Nike Dunk Low' && items.P900.photo && items.P900.prix && items.P900.prix.valeur === 99 && items.P900.statut === 'on_sale', 'V1 · le fond range la fiche (titre, photo, prix, état)', JSON.stringify(items.P900));
  dit(items.P900 && items.P900.compte === 'compteB', 'V2 · la ligne porte le compte de l’ONGLET, jamais celui que dirait le message', 'compte=' + (items.P900 && items.P900.compte));
  dit(!!items.A1, 'V3 · la liste ENTIÈRE du compte B ne retire pas l’annonce du compte A', Object.keys(items).join(','));
  // V5 — une capture qui ne porte pas la fiche ne l'efface pas.
  await f.envoyer({ from: 'cancale-vc', action: 'vcAnnonces', items: [{ id: 'P900', boost: true, cles: ['boost'], ref: '41' }], offset: 0, total: null, lus: 1 }, senderVc(21));
  const apres = ((f.lignes.vc_listings || {}).items || {}).P900 || {};
  dit(apres.boost === true && apres.titre === 'Baskets Nike Dunk Low' && apres.photo && apres.prix && apres.statut === 'on_sale', 'V5 · une capture sans fiche n’efface pas la fiche connue (le boost lu, lui, gagne)', JSON.stringify(apres));

  // V4 — « à expédier » d'un compte ne retire pas celles d'un autre.
  const g = faireFond({ src: F.src, lignes: { vc_ventes: { ventes: { VA: { productId: 'A1', aExpedier: true, compte: 'compteA', sources: ['a-expedier'] } }, lectures: {} } } });
  if (typeof g.ctx.noterSessionVc === 'function') await g.ctx.noterSessionVc('compteB', 22, []);
  await g.envoyer({ from: 'cancale-vc', action: 'vcVentes', source: 'a-expedier', ventes: [{ id: 'VB', productId: 'P900', ref: '41', etat: 'to_ship' }], offset: 0, total: 1, lus: 1, forme: [], moi: 'compteB' }, senderVc(22));
  const v = ((g.lignes.vc_ventes || {}).ventes) || {};
  dit(v.VA && v.VA.aExpedier === true, 'V4 · la liste « à expédier » du compte B ne retire pas « à expédier » à la vente du compte A', JSON.stringify(v.VA));
  dit(v.VB && v.VB.aExpedier === true && v.VB.compte === 'compteB', 'V4 · la vente du compte B est rangée avec son compte', JSON.stringify(v.VB));
}

(async () => {
  try { await leboncoin(); } catch (e) { dit(false, 'Leboncoin : l’audit a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 300)); }
  try { await vestiaire(); } catch (e) { dit(false, 'Vestiaire : l’audit a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 300)); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ lectures Leboncoin et Vestiaire : tout est vert');
  process.exit(ko ? 1 : 0);
})();
