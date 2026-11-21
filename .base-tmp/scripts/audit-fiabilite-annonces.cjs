// ═══════════════════════════════════════════════════════════════════════════
// FIABILITÉ DES ANNONCES — « IL NE DOIT PLUS JAMAIS RIEN MANQUER » (31 oct., 5.294)
//   node scripts/audit-fiabilite-annonces.cjs [--src background.js] [--inject vc-inject.js]
//   node scripts/audit-fiabilite-annonces.cjs --prouve   (réaffaiblit chaque règle : chacune doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « améliore aussi la fiabilité des annonces et des infos Leboncoin
// etc. » — et plus tôt « il manque beaucoup de chaussures… fais en sorte qu'il
// ne manque plus jamais rien ». Deux défauts de la LOI §4.2 (une capture
// partielle n'écrase jamais une complète), joués sur le VRAI code :
//   A. Leboncoin (`storeLbcListings`) : une capture qui ne porte PAS un champ
//      (liste sans description, tableau de bord pro sans prix ni compte) posait
//      ce vide par-dessus ce qu'on savait. La référence `VRM-{n°}` lue dans la
//      description — l'IDENTITÉ de la paire (§5, `numeroLbcIdentite`) —
//      disparaissait : plus d'alerte « à retirer de Leboncoin », plus de double
//      vente côté serveur ; le prix et le compte passaient à vide.
//   B. Vestiaire (`vc-inject.js` → `rangerVcAnnonces` / `rangerVcVentes`) : une
//      liste FILTRÉE (onglet, recherche) rendait le total du filtre, et le fond
//      la tenait pour ENTIÈRE : elle remplaçait toutes ses annonces, ou retirait
//      « à expédier » d'une vente que le filtre cachait.
// Données INVENTÉES uniquement (le dépôt est public).
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['champsVidesEcrasent', 'src', "for(const k of ['account','accountName','accountType','price','url','category'])if(_vide(l[k])&&!_vide(ancien[k]))n[k]=ancien[k];", ''],
    ['refEcrasee', 'src', "if(_vide(l.ref)&&!_vide(ancien.ref))n.ref=ancien.ref;", ''],
    ['refCollante', 'src', "if(_vide(l.body)){if(!_vide(ancien.body))n.body=ancien.body;if(_vide(l.ref)&&!_vide(ancien.ref))n.ref=ancien.ref;}", "if(!_vide(ancien.body)&&_vide(l.body))n.body=ancien.body;if(_vide(l.ref)&&!_vide(ancien.ref))n.ref=ancien.ref;"],
    ['filtreIgnore', 'inject', "const sansFiltre = (u) => { for (const k of u.searchParams.keys()) if (!PARAMS_NEUTRES.test(k)) return false; return true; };", 'const sansFiltre = () => true;'],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiabilite-annonces-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000 });
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

const MON = '8442aaaa-0000-4000-8000-0000000000aa';   // son compte Leboncoin (inventé)
const ID = '5550001';
const API = 'https://api.leboncoin.fr/api';

// ── A. LEBONCOIN ─────────────────────────────────────────────────────────────
function baseLbc() {
  return {
    lbc_accounts: { accounts: { [MON]: { id: MON, sessionAt: new Date(Date.now() - 3600e3).toISOString(), source: 'session:messagerie', name: 'Particulier35' } } },
    lbc_listings: { items: { [ID]: {
      id: ID, subject: 'Nike Shox TL noires 43', price: 60, body: 'Très bon état, boîte d’origine. Réf. VRM-12',
      ref: '12', url: 'https://www.leboncoin.fr/ad/chaussures/' + ID, category: 'Chaussures', status: 'active',
      account: MON, accountName: 'Particulier35', platform: 'leboncoin', seenAt: new Date(Date.now() - 86400e3).toISOString(),
    } } },
  };
}
async function lbc() {
  // A1 — une liste publique du vendeur, SANS description (la forme `owner_listing`).
  {
    const f = faireFond({ src: F.src, lignes: baseLbc() });
    const corps = JSON.stringify({ total: 1, ads: [{ list_id: Number(ID), subject: 'Nike Shox TL noires 43', price: [60], owner: { user_id: MON, name: 'Particulier35' }, status: 'active' }] });
    const r = await f.ctx.handleLbcRaw(`${API}/adfinder/v2/owner_listing`, corps, '', 'owner-banc');
    const ad = f.lignes.lbc_listings && f.lignes.lbc_listings.items && f.lignes.lbc_listings.items[ID];
    dit(r && r.ok === true && ad, 'A1 · la liste sans description est bien rangée (l’annonce est revue)', JSON.stringify(r));
    dit(ad && ad.ref === '12', 'A1 · la référence VRM-12 lue dans la description RESTE (identité de la paire, §5)', 'ref=' + (ad && ad.ref));
    dit(ad && /VRM-12/.test(ad.body || ''), 'A1 · la description connue n’est pas effacée par une liste qui ne la porte pas');
    dit(ad && Date.parse(ad.seenAt) > Date.now() - 60000, 'A1 · l’annonce est datée de CETTE capture (fraîcheur vraie)');
  }
  // A2 — le tableau de bord pro sans prix et sans compte détecté (forme `Ads[].Info`).
  {
    const f = faireFond({ src: F.src, lignes: baseLbc() });
    const corps = JSON.stringify({ Facets: { Total: 1 }, Ads: [{ Id: Number(ID), Status: 'active', Info: { Title: 'Nike Shox TL noires 43' } }] });
    await f.ctx.handleLbcRaw(`${API}/stats/proxy/v2/account/classifieds/analysis/list`, corps, '', 'owner-banc');
    const ad = f.lignes.lbc_listings.items[ID];
    dit(ad && ad.price === 60, 'A2 · un prix absent de la réponse ne remplace pas 60 € par rien', 'price=' + (ad && ad.price));
    dit(ad && ad.account === MON, 'A2 · un compte non détecté ne retire pas l’annonce à SON compte (elle resterait invisible)', 'account=' + (ad && ad.account));
    dit(ad && ad.ref === '12', 'A2 · la référence reste (le tableau de bord pro n’a pas de description)', 'ref=' + (ad && ad.ref));
    dit(ad && ad.url === 'https://www.leboncoin.fr/ad/chaussures/' + ID, 'A2 · le lien de l’annonce reste');
  }
  // A3 — le sens inverse, pour que la règle ne colle pas : une description LUE
  // qui ne porte plus la référence la fait tomber (il l’a retirée).
  {
    const f = faireFond({ src: F.src, lignes: baseLbc() });
    const corps = JSON.stringify({ total: 1, ads: [{ list_id: Number(ID), subject: 'Nike Shox TL noires 43', body: 'Très bon état.', price: [55], owner: { user_id: MON }, status: 'active' }] });
    await f.ctx.handleLbcRaw(`${API}/adfinder/v2/owner_listing`, corps, '', 'owner-banc');
    const ad = f.lignes.lbc_listings.items[ID];
    dit(ad && !ad.ref, 'A3 · une description lue SANS référence la fait tomber (pas de référence collante, mieux vaut un blanc qu’un faux)', 'ref=' + (ad && ad.ref));
    dit(ad && ad.price === 55, 'A3 · un prix LU remplace l’ancien (la donnée la plus récente gagne)', 'price=' + (ad && ad.price));
  }
  // A4 — §4 « lecture KO, écriture OK » : la base ne répond pas ⇒ rien n’est écrit.
  {
    const f = faireFond({ src: F.src, lignes: baseLbc(), lectureKO: (u) => /lbc_listings/.test(u) });
    const r = await f.ctx.storeLbcListings(`${API}/adfinder/v2/owner_listing`, [{ id: ID, subject: 'x', price: 1 }], 'owner-banc');
    dit(r && r.ok === false && f.lignes.lbc_listings.items[ID].price === 60, 'A4 · lecture ratée ⇒ aucune écriture (la ligne reste entière)', JSON.stringify(r));
  }
}

// ── B. VESTIAIRE ─────────────────────────────────────────────────────────────
// Le VRAI vc-inject.js dans une page vestiairecollective.com : il enveloppe
// `fetch`, la page charge une réponse, il poste ce qu’il en tire.
function pageVc() {
  const INJ = fs.readFileSync(F.inject, 'utf8');
  const posts = [];
  const reponses = {};
  const win = {
    postMessage: (m) => posts.push(copie(m)),
    fetch: async (u) => { const b = reponses[u] || '{}'; return { status: 200, headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => b }; },
    addEventListener() {},
  };
  const ctx = { window: win, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} }, location: { origin: 'https://fr.vestiairecollective.com', pathname: '/members/profile/', href: 'https://fr.vestiairecollective.com/members/profile/' },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math };
  vm.createContext(ctx); vm.runInContext(INJ, ctx, { filename: 'vc-inject.js' });
  const charge = async (url, corps) => { reponses[url] = JSON.stringify(corps); await win.fetch(url); await attendre(15); return posts.filter((p) => p.__tag === 'CANCALE_VC').pop(); };
  return { charge, posts };
}
// Ce que vc.js relaie au fond (les mêmes champs, `vc.js`).
const relaisAnnonces = (d) => ({ items: d.items, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0 });
const relaisVentes = (d) => ({ source: d.source, ventes: d.ventes, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0, forme: d.forme || [] });
const VC = 'https://apiv2.vestiairecollective.com/users/me';
async function vestiaire() {
  const annonces = (ids) => ({ meta: { count: ids.length, offset: 0 }, data: ids.map((id) => ({ id, boosted: id === '901', description: 'Réf. VRM-' + id.slice(-1) })) });
  // B1 — la liste ENTIÈRE, puis l’onglet « vendus » (filtré) avec une seule annonce.
  {
    const f = faireFond({ src: F.src, lignes: {} });
    const p = pageVc();
    const d1 = await p.charge(`${VC}/product-listings?offset=0&limit=20`, annonces(['901', '902', '903']));
    dit(d1 && d1.total === 3, 'B1 · sans filtre, le total de Vestiaire est transmis (la liste peut faire foi)', 'total=' + (d1 && d1.total));
    await f.ctx.rangerVcAnnonces(relaisAnnonces(d1));
    const avant = f.lignes.vc_listings || {};
    dit(avant.complet === true && Object.keys(avant.items || {}).length === 3, 'B1 · la liste entière est rangée (3 annonces, complète)');
    const d2 = await p.charge(`${VC}/product-listings?offset=0&limit=20&status=sold`, annonces(['904']));
    dit(d2 && d2.total === null, 'B1 · une liste FILTRÉE ne transmet pas son total (ce n’est pas la liste)', 'total=' + (d2 && d2.total));
    await f.ctx.rangerVcAnnonces(relaisAnnonces(d2));
    const apres = f.lignes.vc_listings || {};
    const ids = Object.keys(apres.items || {}).sort();
    dit(['901', '902', '903'].every((id) => ids.includes(id)), 'B1 · l’onglet filtré n’efface AUCUNE des 3 annonces (boost N°1 gardé)', ids.join(','));
    dit(apres.complet !== true, 'B1 · après une page filtrée, la liste ne se dit plus complète (« au moins »)');
    const d3 = await p.charge(`${VC}/product-listings?offset=0&limit=20&q=jordan`, { meta: { count: 0, offset: 0 }, data: [] });
    await f.ctx.rangerVcAnnonces(relaisAnnonces(d3));
    dit(Object.keys((f.lignes.vc_listings || {}).items || {}).length >= 3, 'B1 · une recherche vide ne dit pas « Aucune annonce sur Vestiaire »');
  }
  // B2 — « à expédier » : une vente cachée par un filtre reste à expédier.
  {
    const f = faireFond({ src: F.src, lignes: {} });
    const p = pageVc();
    const ventes = (ids) => ({ meta: { count: ids.length, offset: 0 }, data: ids.map((id) => ({ id, product: { id: 'p' + id }, status: 'awaiting_shipping' })) });
    const d1 = await p.charge(`${VC}/awaiting-shipping-items?offset=0&limit=20`, ventes(['71', '72']));
    await f.ctx.rangerVcVentes(relaisVentes(d1));
    const d2 = await p.charge(`${VC}/awaiting-shipping-items?offset=0&limit=20&carrier=dhl`, ventes(['72']));
    await f.ctx.rangerVcVentes(relaisVentes(d2));
    const v = (f.lignes.vc_ventes || {}).ventes || {};
    dit(v['71'] && v['71'].aExpedier === true, 'B2 · une vente « à expédier » absente d’une liste FILTRÉE reste à expédier (un colis caché est un colis perdu)', JSON.stringify(v['71'] || null));
    // Le sens inverse : la liste entière, sans filtre, fait foi.
    const d3 = await p.charge(`${VC}/awaiting-shipping-items?offset=0&limit=20`, ventes(['72']));
    await f.ctx.rangerVcVentes(relaisVentes(d3));
    const w = (f.lignes.vc_ventes || {}).ventes || {};
    dit(w['71'] && w['71'].aExpedier === false, 'B2 · la liste ENTIÈRE sans filtre fait toujours foi (71 n’est plus à expédier)');
  }
}

(async () => {
  await lbc();
  await vestiaire();
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ fiabilité des annonces : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack)); process.exit(1); });
