// ⚠️⚠️ CONTRÔLE PERMANENT — VESTIAIRE : ON APPREND LA FORME, JAMAIS LE CONTENU.
//
// Julien, 4 octobre : « commence à faire Vestiaire Collective bien ». Le site est
// inaccessible d'ici (403) : c'est son navigateur qui le mesure (5.154). Les
// pages vendeur de Vestiaire portent identité, adresse, moyens de paiement — le
// relevé ne doit garder que des CHEMINS, des NOMS de champs et des TYPES.
//
// Ce contrôle charge le VRAI `vc-inject.js` dans un vrai navigateur, sur une page
// servie sous le nom de fr.vestiairecollective.com, lui fait recevoir des
// réponses pleines de données personnelles INVENTÉES, et regarde tout ce qui
// sort ; puis il exécute le VRAI relais `vc.js` avec un faux `chrome.runtime`, et
// le VRAI `storeVcRecon` dans un `vm` (un relevé sans rien de neuf ne lit ni
// n'écrit la base).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), path = require('path'), vm = require('vm');
const racine = path.join(__dirname, '..');
const EXT = path.join(racine, 'vinted-sync-extension');
const INJ = fs.readFileSync(path.join(EXT, 'vc-inject.js'), 'utf8');
const RELAIS = fs.readFileSync(path.join(EXT, 'vc.js'), 'utf8');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

const SENSIBLE = ['Camille Acheteuse', 'camille@exemple.test', '12 rue des Tests', 'FR7630006000011234567890189', '+33612345678', 'SECRET-MESSAGE'];
const COMMANDE = JSON.stringify({ order: { id: 987654321, status: 'shipped', buyer: { name: SENSIBLE[0], email: SENSIBLE[1], address: SENSIBLE[2], phone: SENSIBLE[4] },
  payout: { iban: SENSIBLE[3], amount: { cents: 12900, currency: 'EUR' } }, items: [{ id: 55511122, title: 'Nike Air Max', price: 129 }], message: SENSIBLE[5] },
  // une carte indexée par identifiant : la CLÉ elle-même ne doit pas partir
  byProduct: { '55511122': { sold: true }, 'camille@exemple.test': { vip: true } } });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
    const pg = await b.newPage();
    await pg.route('https://fr.vestiairecollective.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
    await pg.route('https://fr.vestiairecollective.com/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: COMMANDE }));
    await pg.route('https://ads.tiers.example/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secret: SENSIBLE[1] }) }));
    await pg.goto('https://fr.vestiairecollective.com/membre/camille-12345678/ventes');
    await pg.evaluate(`window.__tout = []; window.addEventListener('message', (e) => { const d = e.data; if (d && d.__tag === 'CANCALE_VC') window.__tout.push(d); });`);
    await pg.evaluate(INJ);
    await pg.evaluate(`(async () => {
      await fetch('https://fr.vestiairecollective.com/api/orders/987654321?token=abc').then(r => r.text());
      await fetch('https://fr.vestiairecollective.com/api/members/3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b/payouts').then(r => r.text());
      await fetch('https://ads.tiers.example/bid/987654321').then(r => r.text());
      history.pushState({}, '', '/produit/nike-air-max-42-55511122.shtml');
    })()`);
    await pg.waitForTimeout(6000);
    const tout = await pg.evaluate('window.__tout');
    const texte = JSON.stringify(tout);
    const rec = tout.filter((d) => d.kind === 'vcrecon').pop() || {};
    dit(!!rec.chemins && rec.chemins.length >= 2, 'les appels de la page sont relevés', JSON.stringify(rec.chemins || []).slice(0, 220));
    const fuites = SENSIBLE.filter((x) => texte.includes(x));
    dit(fuites.length === 0, '⚠️ aucune donnée personnelle ne quitte la page (nom, email, adresse, IBAN, téléphone, message)', fuites.join(' | '));
    dit(!/987654321|55511122|12345678|3f2a9c1e/.test(texte), 'aucun identifiant (commande, produit, membre, UUID) ne part', (texte.match(/987654321|55511122|12345678|3f2a9c1e/) || [''])[0]);
    dit(!/token=|\?/.test(JSON.stringify(rec.chemins || [])), 'ni les paramètres d\'adresse');
    const sch = rec.schemas || {};
    const cles = Object.values(sch).flat();
    dit(cles.some((c) => /order\.payout\.amount\.cents:number/.test(c)), 'la STRUCTURE des réponses est relevée (chemin + type)', cles.slice(0, 4).join(' · '));
    dit(!cles.some((c) => /:(string|number|boolean)$/.test(c) === false && !/:(null|undefined|object|bigint|symbol)$/.test(c)), 'chaque feuille ne porte que son TYPE, jamais sa valeur');
    dit(rec.hotes && rec.hotes['ads.tiers.example'] === 1 && !JSON.stringify(rec.chemins || []).includes('tiers'), 'un appel tiers : son HÔTE seul est compté, jamais son chemin');
    dit((rec.pages || []).some((p) => /\{page\}\.shtml|\{x\}/.test(p)) && !(rec.pages || []).some((p) => /nike|camille/i.test(p)), 'les pages visitées sont relevées en FAMILLES (ni produit, ni membre)', JSON.stringify(rec.pages || []));
  } catch (e) { dit(false, 'le relevé dans la page a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); }

  // ── LE RELAIS : il recopie la mesure, l'origine et l'action sont les nôtres ──
  try {
    const envoyes = []; const ecouteurs = [];
    const ctx = { window: null, chrome: { runtime: { id: 'x', lastError: null, sendMessage: (m, cb) => { envoyes.push(m); cb && cb(); } } } };
    ctx.window = { addEventListener: (t, f) => { if (t === 'message') ecouteurs.push(f); } };
    vm.createContext(ctx); vm.runInContext(RELAIS, ctx);
    const page = ctx.window;
    for (const f of ecouteurs) f({ source: page, data: { __tag: 'CANCALE_VC', kind: 'vcrecon', chemins: ['GET a → 200'], pages: ['/'], hotes: {}, schemas: {}, from: 'cancale-lbc', action: 'lbcPublier' } });
    for (const f of ecouteurs) f({ source: {}, data: { __tag: 'CANCALE_VC', kind: 'vcrecon', chemins: ['IFRAME'] } });
    for (const f of ecouteurs) f({ source: page, data: { __tag: 'AUTRE', kind: 'vcrecon', chemins: ['AUTRE'] } });
    dit(envoyes.length === 1 && envoyes[0].from === 'cancale-vc' && envoyes[0].action === 'vcRecon', 'le relais n\'envoie que la mesure de CETTE page, sous NOTRE nom (la page ne dicte ni l\'origine ni l\'action)', JSON.stringify(envoyes.map((x) => [x.from, x.action])));
  } catch (e) { dit(false, 'le relais s\'exécute', String(e && e.message).slice(0, 120)); }

  // ── LE FOND : un relevé sans rien de neuf ne lit ni n'écrit la base ─────────
  try {
    const bg = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
    const i = bg.indexOf('async function storeVcRecon('); const fin = bg.indexOf('\n}\n', i) + 3;
    let lectures = 0, ecritures = 0; const store = {};
    const ctx = {
      EXT_VERSION: 't', noterFlux: () => {},
      sbGet: async () => { lectures++; return []; },
      supabaseUpsert: async () => { ecritures++; return true; },
      chrome: { storage: { local: { get: async (k) => ({ [k]: store[k] }), set: async (o) => { Object.assign(store, o); } } } },
    };
    vm.createContext(ctx); vm.runInContext(bg.slice(i, fin) + '\nthis.storeVcRecon = storeVcRecon;', ctx);
    const patch = { chemins: ['GET fr.vestiairecollective.com/api/a → 200 [json]'], pages: ['/'], hotes: {}, schemas: {} };
    await ctx.storeVcRecon(patch); const l1 = lectures, e1 = ecritures;
    await ctx.storeVcRecon(patch);
    dit(e1 === 1 && lectures === l1 && ecritures === 1, 'un relevé identique ne relit ni ne réécrit la base (la page relève en continu)', `1er : ${l1} lecture(s) ${e1} écriture(s) · 2e : +${lectures - l1} / +${ecritures - e1}`);
  } catch (e) { dit(false, 'storeVcRecon s\'exécute', String(e && e.message).slice(0, 120)); }

  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
