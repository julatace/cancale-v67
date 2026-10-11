#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES LECTEURS DE LA REMISE À ZÉRO DES NUMÉROS (migration 013)
//  node scripts/audit-numerotation-lecteurs.cjs           (le contrôle)
//  node scripts/audit-numerotation-lecteurs.cjs --prouve  (chaque règle
//                                réaffaiblie doit faire passer l'audit au rouge)
//
//  Julien, 10 octobre : « les anciens c'est que les paires vendues, car je vais
//  tout republier — c'est pour ça que je veux de nouveaux numéros ». Donc :
//   • une annonce republiée (mise en ligne APRÈS la coupure) reçoit un numéro
//     NEUF, dans l'ordre de mise en ligne ; une annonce d'avant n'en reçoit pas
//     tout seule ;
//   • un numéro d'archive (B230) ne se redonne JAMAIS : ni par une vente, ni par
//     une photo, ni par la bannière ♻️, ni à la main ;
//   • un « 230 » écrit AVANT la coupure (SKU d'une vieille annonce eBay, réf.
//     Leboncoin, « n230 » d'un titre lu dans un email) désigne l'ANCIENNE paire,
//     jamais la nouvelle 230 — sinon la vente de la nouvelle 230 fait retirer
//     d'eBay l'annonce de l'ancienne, ou tamponne « N°230 » sur la mauvaise
//     paire.
//
//  On EXÉCUTE les vraies règles : celles d'App.jsx dans un `vm` (avec un faux
//  `localStorage` qui porte le marqueur), et celles du serveur
//  (`api/_lib/numerotation.js`, `numeroDEmail` d'`api/email-inbound.js` avec un
//  faux Supabase). Les pièces qui vivent DANS un composant (la numérotation
//  automatique, la photo, la bannière ♻️, la pose à la main, l'écran périmé)
//  sont vérifiées sur leur code, et chacune est prouvée par une mutation.
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };

// ── LES MUTATIONS : chacune réaffaiblit UNE règle ────────────────────────────
const remplace = (s, avant, apres, nom) => { if (!s.includes(avant)) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(avant).join(apres); };
const MUTATIONS = {
  // L'archive redevient « reprenable ».
  'archive-reprenable': { app: (s) => remplace(s, "return n && !estArchive(n, arch) ? n : null; };", "return n || null; };", 'archive-reprenable') },
  // Toute annonce se numérote, quelle que soit sa date.
  'sans-date': { app: (s) => remplace(s, "if (coupure == null) return true; const t = dateMiseEnLigneMs(it, dates); return t != null && t >= coupure; };", "return true; };", 'sans-date') },
  // Une annonce sans date lisible se numérote quand même.
  'date-inconnue-admise': { app: (s) => remplace(s, "return t != null && t >= coupure; };", "return t == null || t >= coupure; };", 'date-inconnue-admise') },
  // Le repli `vinted_listing_dates` oublié.
  'sans-dates-captees': { app: (s) => remplace(s, "  const d = dates && it ? dates[String(it.id)] : null;\n  return d ? ms(d.ts) : null;", "  return null;", 'sans-dates-captees') },
  // Le SKU d'une vieille annonce eBay lu comme la nouvelle série.
  'sku-sans-marqueur': { app: (s) => remplace(s, "return (id != null && ids.some((x) => String(x) === String(id))) || avant ? cleNum(arch + k) : k;", "return k;", 'sku-sans-marqueur') },
  // Une commande eBay d'avant la coupure lue comme la nouvelle série.
  'commande-sans-date': { app: (s) => remplace(s, "Date.parse((o && o.creationDate) || ''));", "null);", 'commande-sans-date') },
  // Le N° d'un email admis sans vérifier la fiche.
  'email-admis': { app: (s) => remplace(s, "return Object.values(fiches || {}).some((e) => e && cleNum(e.numero) === k && normTitle(e.title) === titre);", "return true;", 'email-admis') },
  // Le serveur garde le « nXXX » du titre tel quel.
  'serveur-titre': { lib: (s) => remplace(s, "  return ok ? { numero: n, numeroTitre: '' } : { numero: '', numeroTitre: n };", "  return { numero: n, numeroTitre: '' };", 'serveur-titre') },
  // Le serveur lit « pas su » comme « aucune coupure ».
  'serveur-pas-su': { lib: (s) => remplace(s, "if (mk === undefined || !fiches || typeof fiches !== 'object') return { numero: '', numeroTitre: n };", "if (mk === undefined || !fiches || typeof fiches !== 'object') return { numero: n, numeroTitre: '' };", 'serveur-pas-su') },
  // Le repli par titre du serveur rend un numéro d'archive.
  'serveur-repli-archive': { route: (s) => remplace(s, "    if (n && !(arch && estArchive(n, arch))) out.numero = n;", "    if (n) out.numero = n;", 'serveur-repli-archive') },
  // La photo relie une vente d'après la coupure à une fiche d'archive.
  'photo-archive': { app: (s) => remplace(s, "    if (k && venteApresCoupure(o) && !numeroReprenable((numeros[k] || {}).numero)) return null;\n", "", 'photo-archive') },
  // La bannière ♻️ propose un numéro d'archive.
  'banniere-archive': { app: (s) => remplace(s, "      if (!numeroReprenable(e.numero)) continue;\n      if (onlineAnnonceIds.has(String(k))) continue;", "      if (onlineAnnonceIds.has(String(k))) continue;", 'banniere-archive') },
  // La réutilisation par photo de la numérotation automatique reprend l'archive.
  'auto-photo-archive': { app: (s) => remplace(s, "      if (!numeroReprenable(e.numero)) continue;\n      const pk = entryPhotoKey(e);", "      const pk = entryPhotoKey(e);", 'auto-photo-archive') },
  // La pose à la main accepte « B230 ».
  'main-archive': { app: (s) => remplace(s, "    if (!numeroReprenable(cle)) {\n      updatePair(item, { numero: avant });", "    if (false) {\n      updatePair(item, { numero: avant });", 'main-archive') },
  // L'écran ne relit plus la version avant de numéroter.
  'sans-version': { app: (s) => remplace(s, "    if (!numerotationPermise()) return;\n    // ⚠️ TOUTE ANNONCE EN LIGNE DOIT AVOIR UN NUMÉRO", "    // ⚠️ TOUTE ANNONCE EN LIGNE DOIT AVOIR UN NUMÉRO", 'sans-version') },
  // Un refus de la base n'arrête plus les envois.
  'refus-ignore': { app: (s) => remplace(s, "if (code) { _pushBloque = true; _emitSync('refus'); signalerNumerosPerimes(code); _cloudTimer = null; return; }", "", 'refus-ignore') },
};

if (PROUVE) {
  let rouges = 0; const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const n = (r.stdout.match(/^❌ /mg) || []).length;
    const sautee = /ancre introuvable/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && n > 0 && !sautee;
    if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'ancre introuvable' : 'RESTE VERTE')}`);
    if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 2)) console.log('      ' + l.slice(0, 200));
  }
  console.log(`\n${rouges}/${noms.length} mutations attrapées.`);
  process.exit(rouges === noms.length ? 0 : 1);
}
const M = MUTATION ? MUTATIONS[MUTATION] : null;
if (MUTATION && !M) { console.log('❌ mutation inconnue : ' + MUTATION); process.exit(1); }

// ── LES SOURCES (éventuellement mutées) ─────────────────────────────────────
let APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
let LIB = fs.readFileSync(path.join(RACINE, 'api/_lib/numerotation.js'), 'utf8');
let ROUTE = fs.readFileSync(path.join(RACINE, 'api/email-inbound.js'), 'utf8');
try { if (M && M.app) APP = M.app(APP); if (M && M.lib) LIB = M.lib(LIB); if (M && M.route) ROUTE = M.route(ROUTE); }
catch (e) { console.log('❌ ' + e.message); process.exit(1); }

function extraire(src, nom) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`\`${nom}\` introuvable dans App.jsx`);
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  throw new Error(`fin de \`${nom}\` introuvable`);
}
const NOMS = ['cleNum', 'NUM_OK', 'normTitle', 'refVRMDe', 'marqueurNumerotation', 'archiveNumeros', 'coupureNumerotation', 'versionNumerotation',
  'estArchive', 'venteApresCoupure', 'dateMiseEnLigneMs', 'annonceNumerotable', 'numeroReprenable', 'numeroEmailAdmis',
  'numDeSkuEbay', 'skuEbayDe', 'numeroExterne', 'numEbayLu', 'numLigneEbay', 'numDeTitreLbc', 'clesAnnonceLbc', 'commandeEbayEngagee', 'doublesVenteEbay'];
let MARQUEUR = null;
const charge = () => {
  const ctx = { console };
  vm.createContext(ctx);
  ctx.__lire = () => MARQUEUR;
  const src = 'const load = (k, d) => (k === "vrm_numerotation" ? (__lire() == null ? d : JSON.parse(JSON.stringify(__lire()))) : d);\n'
    + NOMS.map((n) => extraire(APP, n)).join('\n')
    + '\n;this.R = { ' + NOMS.join(', ') + ' };';
  vm.runInContext(src, ctx);
  return ctx.R;
};

// ── LES DONNÉES (inventées, la forme mesurée) ─────────────────────────────────
const T = '2026-10-09T00:00:00.000Z', TMS = Date.parse(T);
const MK = { version: 2, coupure: T, appliqueLe: '2026-10-10T08:00:00.000Z', archive: 'B', renum: { 553: '1' },
  ebayAnnonces: ['110000000001'], lbcAnnonces: ['2900000001'] };

(async () => {
  let R = null;
  await essaie('les règles d\'App.jsx se chargent', () => { R = charge(); dit(!!R, 'les règles d\'App.jsx se chargent (vm)'); });
  if (!R) { console.log(`\n${ok} vert(s), ${ko} rouge(s).`); process.exit(1); }

  console.log('\n1. AVANT TOUTE REMISE À ZÉRO, RIEN NE CHANGE');
  await essaie('sans marqueur', () => {
    MARQUEUR = null;
    dit(R.archiveNumeros() === '' && R.coupureNumerotation() === null, 'pas de marqueur ⇒ pas de série d\'archive, pas de coupure');
    dit(R.annonceNumerotable({ id: 1, createdTs: null }, {}) === true, 'une annonce sans date se numérote, comme avant');
    dit(R.numeroReprenable('B230') === 'B230', '« B230 » (une série à lettre choisie par un vendeur) reste un numéro ordinaire');
    dit(R.numEbayLu('VRM-22', '110000000001') === '22', 'le SKU eBay se lit comme avant');
    dit(R.numeroEmailAdmis({ numero: '230', receivedAt: '2026-10-11T00:00:00Z', article: 'x' }, {}) === true, 'le N° d\'un email est admis comme avant');
  });

  console.log('\n2. LE NUMÉRO D\'ARCHIVE NE SE REDONNE JAMAIS');
  await essaie('archive', () => {
    MARQUEUR = MK;
    dit(R.archiveNumeros() === 'B' && R.coupureNumerotation() === TMS, 'le marqueur se lit : série B, coupure T');
    dit(R.numeroReprenable('B230') === null && R.numeroReprenable('b230') === null && R.numeroReprenable('B12+B13') === null, '« B230 », « b230 », un lot « B12+B13 » : jamais repris');
    dit(R.numeroReprenable('230') === '230' && R.numeroReprenable('7') === '7', 'un numéro de la nouvelle série reste reprenable (une paire republiée deux fois garde le sien)');
    MARQUEUR = { ...MK, annule: true };
    dit(R.archiveNumeros() === '' && R.numeroReprenable('B230') === 'B230', 'remise à zéro ANNULÉE : plus de série d\'archive');
    MARQUEUR = { ...MK, archive: 'b<script>' };
    dit(R.archiveNumeros() === '', 'une lettre d\'archive de forme inconnue n\'est pas lue');
  });

  console.log('\n3. QUI SE NUMÉROTE TOUT SEUL : LA DATE DE MISE EN LIGNE');
  await essaie('date', () => {
    MARQUEUR = MK;
    const apres = Math.floor((TMS + 3600e3) / 1000), avant = Math.floor((TMS - 3600e3) / 1000);
    dit(R.annonceNumerotable({ id: 1, createdTs: apres }, {}) === true, 'mise en ligne après la coupure (secondes Vinted) ⇒ numéro neuf');
    dit(R.annonceNumerotable({ id: 2, createdTs: avant }, {}) === false, 'mise en ligne AVANT la coupure ⇒ pas de numéro tout seul');
    dit(R.annonceNumerotable({ id: 3, createdTs: TMS + 1 }, {}) === true, 'date en millisecondes comprise aussi');
    dit(R.annonceNumerotable({ id: 4, createdTs: null }, {}) === false, 'sans date lisible ⇒ pas de numéro tout seul (elle reste « sans N° »)');
    dit(R.annonceNumerotable({ id: 5, createdTs: null }, { 5: { ts: TMS + 60e3 } }) === true, 'la date « Ajouté il y a… » captée sur la page sert de repli (même source que la migration)');
    dit(R.dateMiseEnLigneMs({ id: 6, createdTs: apres }, { 6: { ts: 1 } }) === apres * 1000, 'la date Vinted passe AVANT la date captée (même ordre que la migration)');
  });

  console.log('\n4. UN « 230 » ÉCRIT AVANT LA COUPURE DÉSIGNE L\'ANCIENNE PAIRE');
  await essaie('externes', () => {
    MARQUEUR = MK;
    dit(R.numEbayLu('VRM-22', '110000000001') === 'B22', 'SKU « VRM-22 » d\'une annonce eBay qui le portait à la coupure ⇒ B22');
    dit(R.numEbayLu('VRM-22', '110000000777') === '22', 'le même SKU sur une annonce mise en ligne APRÈS ⇒ la nouvelle 22');
    dit(R.numEbayLu('VRM-B22', '110000000001') === 'B22' && R.numEbayLu('12345-ABC', '110000000001') === '', 'un SKU déjà à lettres reste tel quel, un SKU à lui ne désigne rien');
    dit(R.numLigneEbay({ creationDate: '2026-10-01T10:00:00.000Z' }, { sku: 'VRM-22', legacyItemId: '9' }) === 'B22', 'commande eBay passée AVANT la coupure ⇒ l\'ancienne paire');
    dit(R.numLigneEbay({ creationDate: '2026-10-12T10:00:00.000Z' }, { sku: 'VRM-22', legacyItemId: '9' }) === '22', 'commande eBay passée après, sur une annonce neuve ⇒ la nouvelle');
    dit(R.numLigneEbay({ creationDate: '2026-10-12T10:00:00.000Z' }, { sku: 'VRM-22', legacyItemId: '110000000001' }) === 'B22', 'commande passée après, mais sur l\'ANCIENNE annonce ⇒ l\'ancienne paire');
    const ad = { id: '2900000001', ref: '230', customRef: 'VRM-230', subject: 'Nike n230' };
    dit(JSON.stringify(R.clesAnnonceLbc(ad, {})) === '["B230"]', 'Leboncoin : la réf. et le « n230 » d\'une annonce d\'avant ⇒ B230', JSON.stringify(R.clesAnnonceLbc(ad, {})));
    dit(JSON.stringify(R.clesAnnonceLbc(ad, { 2900000001: '7' })) === '["7","B230"]', 'un lien posé À LA MAIN (après la coupure) reste ce qu\'il dit', JSON.stringify(R.clesAnnonceLbc(ad, { 2900000001: '7' })));
    dit(JSON.stringify(R.clesAnnonceLbc({ id: '2900000099', ref: '230', subject: 'Nike n230' }, {})) === '["230"]', 'une annonce Leboncoin d\'après ⇒ la nouvelle 230');
  });

  console.log('\n5. LA VENTE DE LA NOUVELLE 22 NE FAIT PAS RETIRER L\'ANCIENNE D\'eBAY');
  await essaie('doublesVenteEbay', () => {
    MARQUEUR = MK;
    const annonces = [{ itemId: '110000000001', sku: 'VRM-22', title: 'vieille annonce' }, { itemId: '110000000555', sku: 'VRM-23', title: 'annonce neuve' }];
    const numeros = { 8100000022: { numero: '22' }, 7000000022: { numero: 'B22' }, 8100000023: { numero: '23' } };
    const r1 = R.doublesVenteEbay({ annonces, commandes: [], numeros, enLigne: new Set(), vendusVinted: new Set(['8100000022']), programmees: [] });
    dit(!r1.aRetirerEbay.some((d) => d.annonce.itemId === '110000000001'), 'la NOUVELLE 22 vendue sur Vinted : l\'annonce eBay de l\'ancienne n\'est PAS « à retirer »', JSON.stringify(r1.aRetirerEbay.map((d) => d.annonce.itemId)));
    const r2 = R.doublesVenteEbay({ annonces, commandes: [], numeros, enLigne: new Set(), vendusVinted: new Set(['7000000022']), programmees: [] });
    dit(r2.aRetirerEbay.length === 1 && r2.aRetirerEbay[0].numero === 'B22', 'l\'autre sens : l\'ANCIENNE paire (B22) vendue ⇒ son annonce eBay est à retirer, jugée B22', JSON.stringify(r2.aRetirerEbay.map((d) => d.numero)));
    dit(R.skuEbayDe(r2.aRetirerEbay[0] && r2.aRetirerEbay[0].numero) === 'VRM-B22', 'et le retrait automatique enverra « VRM-B22 » au serveur (qui relit et traduit l\'annonce)');
    const r3 = R.doublesVenteEbay({ annonces, commandes: [], numeros, enLigne: new Set(), vendusVinted: new Set(['8100000023']), programmees: [] });
    dit(r3.aRetirerEbay.length === 1 && r3.aRetirerEbay[0].annonce.itemId === '110000000555', 'une annonce eBay d\'APRÈS la coupure suit la nouvelle série');
    const cmd = [{ orderId: 'o1', orderPaymentStatus: 'PAID', creationDate: '2026-09-20T10:00:00.000Z', lineItems: [{ sku: 'VRM-22', legacyItemId: '110000000001' }] }];
    const r4 = R.doublesVenteEbay({ annonces: [], commandes: cmd, numeros, enLigne: new Set(['8100000022']), vendusVinted: new Set(), programmees: [] });
    dit(r4.aRetirerVinted.length === 0, 'une vieille commande eBay « VRM-22 » ne dit pas de retirer la NOUVELLE 22 de Vinted', JSON.stringify(r4.aRetirerVinted.map((d) => d.numero)));
  });

  console.log('\n6. LE N° LU DANS UN EMAIL (app)');
  await essaie('email app', () => {
    MARQUEUR = MK;
    const fiches = { 8100000007: { numero: '7', title: 'Nike Air n230' }, 8100000230: { numero: '230', title: 'Adidas Samba' } };
    dit(R.numeroEmailAdmis({ numero: '230', receivedAt: '2026-10-11T00:00:00Z', article: 'Nike Air n230' }, fiches) === false, 'email d\'après : « n230 » du titre d\'une paire republiée (devenue 7) n\'est PAS admis');
    dit(R.numeroEmailAdmis({ numero: '7', receivedAt: '2026-10-11T00:00:00Z', article: 'Nike Air n230' }, fiches) === true, 'admis s\'il désigne une fiche ACTUELLE au même titre');
    dit(R.numeroEmailAdmis({ numero: 'B17', receivedAt: '2026-10-11T00:00:00Z', article: 'x' }, { 1: { numero: 'B17', title: 'x' } }) === false, 'un numéro d\'archive dans un email d\'après : jamais');
    dit(R.numeroEmailAdmis({ numero: 'B17', receivedAt: '2026-10-05T00:00:00Z', article: 'x' }, {}) === true, 'un email d\'AVANT la conversion (l\'histoire, déjà convertie) est admis');
  });

  console.log('\n7. LE N° LU DANS UN EMAIL (serveur — la même règle)');
  let L = null;
  await essaie('lib serveur', async () => {
    const tmp = path.join(require('os').tmpdir(), 'vrm-numerotation-' + process.pid + '.mjs');
    fs.writeFileSync(tmp, LIB);
    try { L = await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
    const ech = ['007', ' b-125 ', 'VRM', '12+13', '', null, 'C3', '0'];
    dit(ech.every((x) => L.cleNum(x) === R.cleNum(x)), 'cleNum : serveur et app rendent la même clé (§11)');
    const f = { 8100000007: { numero: '7', title: 'Nike Air n230' } };
    const j = (n, t, mk, fi) => JSON.stringify(L.numeroDuTitreApresCoupure(n, t, mk, fi));
    dit(j('230', 'Nike Air n230', null, undefined) === '{"numero":"230","numeroTitre":""}', 'aucune remise à zéro : le « nXXX » est gardé comme avant');
    dit(j('230', 'Nike Air n230', MK, f) === '{"numero":"","numeroTitre":"230"}', 'après : « n230 » d\'une paire republiée part dans numeroTitre, jamais tamponné');
    dit(j('7', 'Nike Air n230', MK, f) === '{"numero":"7","numeroTitre":""}', 'admis s\'il désigne une fiche actuelle au même titre');
    dit(j('230', 'Nike Air n230', undefined, f) === '{"numero":"","numeroTitre":"230"}', 'marqueur illisible ⇒ « pas su » : aucun numéro tamponné');
    dit(j('230', 'x', MK, undefined) === '{"numero":"","numeroTitre":"230"}', 'fiches illisibles ⇒ aucun numéro tamponné');
    dit(j('230', 'Nike Air n230', { ...MK, annule: true }, f) === '{"numero":"230","numeroTitre":""}', 'remise à zéro annulée ⇒ comme avant');
    for (const [k, id, d] of [['22', '110000000001', null], ['22', '110000000777', null], ['22', '9', Date.parse('2026-10-01T00:00:00Z')], ['B22', '110000000001', null]]) {
      if (L.numeroExterne(k, id, 'ebayAnnonces', d, MK) !== R.numeroExterne(k, id, 'ebayAnnonces', d)) { dit(false, 'numeroExterne : serveur et app divergent', `${k}/${id}`); return; }
    }
    dit(true, 'numeroExterne : serveur et app rendent la même lecture (§11)');
  });

  await essaie('route email', async () => {
    // `numeroDEmail` exécuté pour de vrai, contre un faux Supabase.
    let BASE = { mk: MK, f: { 8100000007: { numero: '7', title: 'Nike Air n230' }, 7000000017: { numero: 'B17', title: 'Puma Suede' } }, mkKo: false };
    const lus = [];
    global.fetch = async (url) => {
      const u = decodeURIComponent(String(url)); lus.push(u);
      const rep = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b, text: async () => JSON.stringify(b) });
      if (/select=owner&limit=1/.test(u)) return rep({ message: 'column app_data.owner does not exist' }, 400);
      if (/select=mk:/.test(u)) return BASE.mkKo ? rep({ message: 'boom' }, 500) : rep([{ mk: BASE.mk }]);
      if (/select=f:/.test(u)) return rep([{ f: BASE.f }]);
      if (/select=data->vinted_annonce_numeros/.test(u)) return rep([{ vinted_annonce_numeros: BASE.f }]);
      return rep([]);
    };
    const tmp = path.join(RACINE, 'api', '.audit-email-' + process.pid + '.js');
    fs.writeFileSync(tmp, ROUTE);
    let route;
    try { route = await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
    const nd = route.numeroDEmail;
    let r = await nd('230', 'Nike Air n230', { title: 'Nike Air', size: '42' });
    dit(r.numero === '' && r.numeroTitre === '230', 'bordereau d\'une paire republiée sous « … n230 » : rien n\'est tamponné, 230 gardé à part', JSON.stringify(r));
    r = await nd('', 'Puma Suede', { title: 'Puma Suede', size: '' });
    dit(r.numero === '', 'le repli par titre ne rend JAMAIS un numéro d\'archive (fiche « B17 » au même titre)', JSON.stringify(r));
    r = await nd('', 'Nike Air n230', { title: 'Nike Air n230', size: '' });
    dit(r.numero === '7', 'le repli par titre rend la fiche ACTUELLE au même titre', JSON.stringify(r));
    BASE = { ...BASE, mk: null };
    r = await nd('230', 'Nike Air n230', null);
    dit(r.numero === '230', 'aucune remise à zéro : exactement comme avant', JSON.stringify(r));
    BASE = { ...BASE, mk: MK, mkKo: true };
    r = await nd('230', 'x', { title: 'Puma Suede', size: '' });
    dit(r.numero === '' && r.numeroTitre === '230', 'marqueur illisible ⇒ aucun numéro, ni lu ni deviné par le titre', JSON.stringify(r));
  });

  console.log('\n8. LES PIÈCES QUI VIVENT DANS UN COMPOSANT (vérifiées sur le code, chacune prouvée par une mutation)');
  await essaie('composants', () => {
    const A = APP;
    const corps = (debut, fin) => { const i = A.indexOf(debut); const j = i >= 0 ? A.indexOf(fin, i) : -1; return i >= 0 && j > i ? A.slice(i, j) : ''; };
    const auto = corps("if (!cloudReady) return; // ⛔ pas de numérotation avant que le cloud soit chargé", "const openConversation = async (conv) =>");
    dit(/if \(!numerotationPermise\(\)\) return;/.test(auto), 'la numérotation automatique attend une version de la numérotation RELUE (écran périmé ⇒ rien)');
    dit(/if \(!annonceNumerotable\(it, listingDates\)\) continue;/.test(auto), 'elle ne numérote que les annonces mises en ligne après la coupure');
    dit(/for \(const k in numeros\) \{\s*const e = numeros\[k\];[^}]*?\n\s*\/\/[^\n]*\n\s*if \(!numeroReprenable\(e\.numero\)\) continue;/.test(auto), 'sa réutilisation par PHOTO écarte les fiches d\'archive');
    dit(/let num = numeroReprenable\(numVentesParIdentite\.parItem/.test(auto) && /numeroReprenable\(pk && numVentesParIdentite\.parPhoto\[pk\]\)/.test(auto), 'sa réutilisation par VENTE écarte les numéros d\'archive');
    dit(/sort\(\(a, b\) => \(dateMiseEnLigneMs\(a, listingDates\)/.test(auto), 'elle numérote dans l\'ORDRE DE MISE EN LIGNE (1, 2, 3… comme il reposte)');
    const photo = corps('const entryKeyByPhoto = (o) => {', '};');
    dit(/venteApresCoupure\(o\) && !numeroReprenable/.test(photo), 'la photo ne relie jamais une vente d\'après la coupure à une fiche d\'archive');
    const ban = corps("if (!e || !String(e.numero || '').trim()) continue;", 'pairsLost[String(e.numero)]');
    dit(/if \(!numeroReprenable\(e\.numero\)\) continue;/.test(ban), 'la bannière ♻️ ne propose jamais un numéro d\'archive');
    const pose = corps('// Un numéro d\'ARCHIVE (« B230 ») ne se redonne pas à une annonce', '// Ce qu\'on écrit : tel quel');
    dit(/if \(!numeroReprenable\(cle\)\) \{/.test(pose), 'la pose À LA MAIN refuse un numéro d\'archive');
    dit(/manuelAt/.test(corps('const poserNumero', 'recordUsed(nextNumero); return; }')), 'une pose à la main porte sa date (`manuelAt`) : la base la reconnaît comme un geste');
    dit(/repriseDe: String\(r\.orphan\.key\)/.test(A) && /repriseDe: String\(autres\[0\]\)/.test(A), 'une reprise dit QUELLE fiche elle remplace (`repriseDe`) : la base ne la prend pas pour une fiche perdue');
    dit(/if \(code\) \{ _pushBloque = true; _emitSync\('refus'\); signalerNumerosPerimes\(code\);/.test(A), 'un refus nommé de la base (numéros périmés) arrête les envois et ouvre le bloc « recharger »');
    dit(/<BlocNumerosPerimes\/>/.test(A) && /function BlocNumerosPerimes\(/.test(A), 'le bloc « écran périmé » est monté sur la coque (tous les écrans)');
    dit(/numerotation: v \}/.test(corps('const saveRoomPlan = async (data) => {', '\n};')), 'le garage 3D estampille la version de la numérotation');
    dit(/'vrm_numerotation'/.test(corps('const SYNC_KEYS = [', '];')), 'le marqueur est synchronisé (lu par l\'app, écrit par le serveur seul)');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
