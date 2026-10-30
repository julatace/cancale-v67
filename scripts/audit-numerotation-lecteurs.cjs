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
  'sku-sans-marqueur': { app: (s) => remplace(s, "  const t = traductionAnnonce(m && !m.annule ? m[liste] : null, id, k);\n", "  const t = undefined;\n", 'sku-sans-marqueur') },
  // (relecture du 11 octobre) Une annonce RELIÉE après la coupure (SKU réécrit) serait encore traduite en B.
  'traduction-ignore-reecriture': { app: (s) => remplace(s, "  if (!e || typeof e !== 'object' || Array.isArray(e) || !Object.prototype.hasOwnProperty.call(e, k)) return undefined;\n  return typeof e[k] === 'string' ? cleNum(e[k]) : '';\n};", "  if (!e || typeof e !== 'object' || Array.isArray(e)) return undefined;\n  if (!Object.prototype.hasOwnProperty.call(e, k)) return cleNum(archiveNumeros() + k);\n  return typeof e[k] === 'string' ? cleNum(e[k]) : '';\n};", 'traduction-ignore-reecriture') },
  // (revue du 11 octobre, défaut 5) La carte par annonce lue comme une LISTE (la
  // lecture `Array.isArray(mk.ebayAnnonces)` de d92613f) : sur la forme que la 013
  // a VRAIMENT écrite (un objet), « VRM-553 » ne se traduit plus en « 1 » — la
  // N°553 vendue (#78) ne lève aucune alerte eBay. App, serveur, extension.
  'app-marqueur-liste': { app: (s) => remplace(s, "  if (id == null || !carte || typeof carte !== 'object' || Array.isArray(carte)) return undefined;\n  const e = carte[String(id)];", "  if (id == null || !Array.isArray(carte)) return undefined;\n  const e = carte[String(id)];", 'app-marqueur-liste') },
  'serveur-marqueur-liste': { lib: (s) => remplace(s, "  if (id == null || !carte || typeof carte !== 'object' || Array.isArray(carte)) return undefined;", "  if (id == null || !Array.isArray(carte)) return undefined;", 'serveur-marqueur-liste') },
  'extension-marqueur-liste': { ext: (s) => remplace(s, "  if (!ad || ad.id == null || !carte || typeof carte !== 'object' || Array.isArray(carte)) return k;", "  if (!ad || ad.id == null || !Array.isArray(carte)) return k;", 'extension-marqueur-liste') },
  // Un numéro PROVISOIRE (553, devenu 1) lu en B, comme un ancien.
  'provisoire-en-b': { app: (s) => remplace(s, "  return typeof e[k] === 'string' ? cleNum(e[k]) : '';\n};\nconst numeroExterne", "  return cleNum(archiveNumeros() + k);\n};\nconst numeroExterne", 'provisoire-en-b') },
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
  'banniere-archive': { app: (s) => remplace(s, "      if (!numeroReprenable(e.numero)) continue;\n      if (presentesAnnonceIds.has(String(k))) continue;", "      if (presentesAnnonceIds.has(String(k))) continue;", 'banniere-archive') },
  // La réutilisation par photo de la numérotation automatique reprend l'archive.
  'auto-photo-archive': { app: (s) => remplace(s, "      if (!numeroReprenable(e.numero)) continue;\n      const pk = entryPhotoKey(e);", "      const pk = entryPhotoKey(e);", 'auto-photo-archive') },
  // La pose à la main accepte « B230 ».
  'main-archive': { app: (s) => remplace(s, "    if (!numeroReprenable(cle)) {\n      updatePair(item, { numero: avant });", "    if (false) {\n      updatePair(item, { numero: avant });", 'main-archive') },
  // L'extension lit la référence d'une vieille annonce Leboncoin comme la nouvelle série.
  'extension-lbc': { ext: (s) => remplace(s, "  if (!ad || ad.id == null || !carte || typeof carte !== 'object' || Array.isArray(carte)) return k;", "  return k;", 'extension-lbc') },
  // L'extension ne projette plus le marqueur (la clé vaudrait `undefined`, en silence).
  'extension-projection': { ext: (s) => remplace(s, "'vinted_pairs_lost', 'vrm_lbc_liens', 'vrm_numerotation'];", "'vinted_pairs_lost', 'vrm_lbc_liens'];", 'extension-projection') },
  // Réglages laisse choisir « B » (la lettre des anciens) pour les nouveaux numéros.
  'reglage-lettre-archive': { app: (s) => remplace(s, "    if (n && arch && n === arch) { setRefusee(n); setP(prefixeNumeros()); return; }\n", "", 'reglage-lettre-archive') },
  // Cliquer « Avec une lettre » enregistre une lettre par défaut (C), en silence.
  'reglage-pastille-enregistre': { app: (s) => remplace(s, "const choix = (m) => { setMode(m); setRefusee(''); if (m === 'chiffres') poser(''); };", "const choix = (m) => { setMode(m); setRefusee(''); poser(m === 'chiffres' ? '' : defaut); };", 'reglage-pastille-enregistre') },
  // Les exemples de Réglages citent la lettre des anciens (« B125 ») alors que l'app la refuse.
  'reglage-exemple-archive': { app: (s) => remplace(s, "const lettreEx = arch ? (arch === 'C' ? 'D' : 'C') : 'B';", "const lettreEx = 'B';", 'reglage-exemple-archive') },
  // (relecture du 11 octobre, mutations du relecteur) La version relue ne compte plus.
  'version-toujours-ok': { app: (s) => remplace(s, "else _emitVerNum({ etat: v === versionNumerotation() ? 'ok' : 'perime', at: Date.now(), nuage: v });", "else _emitVerNum({ etat: 'ok', at: Date.now(), nuage: v });", 'version-toujours-ok') },
  // On imprime le N° sur un écran périmé.
  'impression-perimee': { app: (s) => remplace(s, "if (_verNum.etat === 'perime') { signalerNumerosPerimes('version'); return false; }", "", 'impression-perimee') },
  // Le tampon d'un bordereau reprend le N° d'un email sans le juger.
  'tampon-email-sans-garde': { app: (s) => remplace(s, "if (b.numero && numeroEmailAdmis(b, numeros)) return String(b.numero);", "if (b.numero) return String(b.numero);", 'tampon-email-sans-garde') },
  // La carte « via bordereau » affiche le N° d'un email sans le juger.
  'carte-bordereau-sans-garde': { app: (s) => remplace(s, "desc={pending.map(b=>(b.numero&&numeroEmailAdmis(b,numeros)?", "desc={pending.map(b=>(b.numero?", 'carte-bordereau-sans-garde') },
  // Le serveur range le N° d'un bordereau sans `numeroDEmail`.
  'serveur-bordereau-sans-numeroDEmail': { route: (s) => remplace(s, "{ const jn = await numeroDEmail(data.numero, data.article, { title: data.modele || data.article, size: data.taille });\n        data.numero = jn.numero; if (jn.numeroTitre) data.numeroTitre = jn.numeroTitre; }", "if (!data.numero) data.numero = await findNumeroByTitle(data.modele || data.article, data.taille);", 'serveur-bordereau-sans-numeroDEmail') },
  // Le serveur range le N° d'une vente sans `numeroDEmail`.
  'serveur-vente-sans-numeroDEmail': { route: (s) => remplace(s, "{ const jn = await numeroDEmail(data.numero, data.designation);\n        data.numero = jn.numero; if (jn.numeroTitre) data.numeroTitre = jn.numeroTitre; }", "", 'serveur-vente-sans-numeroDEmail') },
  // Les copies d'appareil qui portent des numéros ne sont plus jetées au changement de version.
  'sans-purge-copies': { app: (s) => remplace(s, "if (verNuage !== verLocale) purgerCopiesNumeros();", "", 'sans-purge-copies') },
  // Le retrait automatique envoie le SKU lu chez eBay, pas celui de la paire jugée vendue.
  'retrait-auto-sku-brut': { app: (s) => remplace(s, "sku: skuEbayDe(d.numero) || a.sku,", "sku: a.sku,", 'retrait-auto-sku-brut') },
  // (relecture du 11 octobre) Une ANCIENNE annonce vendue après la coupure perd son N° d'identité.
  'vieille-vendue-renumerotee': { app: (s) => remplace(s, "if (reuse && !parIdentite && venteApresCoupure(o) && !numeroReprenable(reuse)) reuse = null;", "if (reuse && venteApresCoupure(o) && !numeroReprenable(reuse)) reuse = null;", 'vieille-vendue-renumerotee') },
  // Effacer un N° à la main supprime la fiche (refusée par la base après la coupure).
  'fiche-videe-supprimee': { app: (s) => remplace(s, "if (emptyNum && emptyBuy && emptyMp && !(etaitNumerotee && archiveNumeros())) delete u[item.id];", "if (emptyNum && emptyBuy && emptyMp) delete u[item.id];", 'fiche-videe-supprimee') },
  // L'écran rechargé rejoue des CARTES entières de gestes.
  'rejouer-carte-entiere': { app: (s) => remplace(s, "    out.gestes[k] = g; n++;\n", "    out.gestes[k] = loc; n++;\n", 'rejouer-carte-entiere') },
  // Le bloc choisit sa phrase sans relire la version.
  'bloc-sans-relecture': { app: (s) => remplace(s, "  if (String(code || '') !== 'version') { try { verifierVersionNumerotation(); } catch (_) {} }\n", "", 'bloc-sans-relecture') },
  // Les paires qui reviennent : « garde le N°B198 » (que l'app refuse ensuite).
  'retours-archive-retape': { app: (s) => remplace(s, "const arch = !numeroReprenable(num);", "const arch = false;", 'retours-archive-retape') },
  // Les paires qui reviennent ne sortent jamais de la liste (B… jamais porté par une annonce en ligne).
  'retours-jamais-republiees': { app: (s) => remplace(s, "      if (num && !numeroReprenable(num) && republiee(o)) continue;", "", 'retours-jamais-republiees') },
  // L'app ne dit plus au serveur quelle version de numérotation elle a lue (publier / programmer sur eBay).
  'ebay-sans-version': { app: (s) => remplace(s, "const avecVersion = corps && (corps.action === 'publish' || corps.action === 'programmer');", "const avecVersion = false;", 'ebay-sans-version') },
  // Restaurer une sauvegarde d'avant la remise à zéro : pas de contrôle de version.
  'restaure-sans-version': { app: (s) => remplace(s, "if(vF!==vIci){ toast(SAUVEGARDE_AVANT_REMISE); return; }", "", 'restaure-sans-version') },
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
let APP = require('./_source-app.cjs').sourceApp(path.join(RACINE));
let LIB = fs.readFileSync(path.join(RACINE, 'api/_lib/numerotation.js'), 'utf8');
let ROUTE = fs.readFileSync(path.join(RACINE, 'api/email-inbound.js'), 'utf8');
let EXT = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension/background.js'), 'utf8');
try { if (M && M.app) APP = M.app(APP); if (M && M.lib) LIB = M.lib(LIB); if (M && M.route) ROUTE = M.route(ROUTE); if (M && M.ext) EXT = M.ext(EXT); }
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
  'numDeSkuEbay', 'skuEbayDe', 'traductionAnnonce', 'numeroExterne', 'PANNE_NUMEROS', 'ficheAVerifier', 'LIENS_EBAY', '_depuisEbay', '_fichesEbayMemo', 'fichesPourEbay', 'lienEbay', 'numEbayLu', 'numLigneEbay', 'numDeTitreLbc', 'clesAnnonceLbc', 'commandeEbayEngagee', 'doublesVenteEbay'];
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
// Le marqueur, à la forme que la migration écrit : PAR ANNONCE, chaque numéro
// qu'elle portait à la coupure et ce qu'il devient. Sa forme réelle (mesurée le
// 11 octobre) : ses deux annonces eBay portaient un numéro PROVISOIRE (553).
const MK = { version: 2, coupure: T, appliqueLe: '2026-10-10T08:00:00.000Z', archive: 'B', renum: { 553: '1' },
  ebayAnnonces: { 110000000001: { 22: 'B22' }, 128127336988: { 553: '1' } },
  lbcAnnonces: { 2900000001: { 230: 'B230' }, 2900000553: { 553: '1' } } };

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
    // (relecture du 11 octobre) SA forme : « VRM-553 », numéro PROVISOIRE donné après
    // la coupure à une paire devenue 1 — lu « B553 », une paire qui n'existe pas.
    dit(R.numEbayLu('VRM-553', '128127336988') === '1', 'SKU « VRM-553 » (numéro provisoire, devenu 1) ⇒ la paire 1, jamais « B553 »', R.numEbayLu('VRM-553', '128127336988'));
    dit(R.numEbayLu('VRM-3', '128127336988') === '3', 'la même annonce RELIÉE après la coupure (SKU réécrit « VRM-3 ») ⇒ la 3, telle quelle', R.numEbayLu('VRM-3', '128127336988'));
    dit(R.numEbayLu('VRM-3', '110000000001') === '3', 'une annonce d\'avant reliée à une autre paire ⇒ ce que dit son SKU d\'aujourd\'hui', R.numEbayLu('VRM-3', '110000000001'));
    dit(JSON.stringify(R.clesAnnonceLbc({ id: '2900000553', ref: '553', subject: 'Autry n553' }, {})) === '["1"]', 'Leboncoin « réf 553 » d\'une annonce publiée sous le numéro provisoire ⇒ la paire 1', JSON.stringify(R.clesAnnonceLbc({ id: '2900000553', ref: '553', subject: 'Autry n553' }, {})));
    // L'EXTENSION (la file Leboncoin) lit la même chose (§11).
    const ctxE = {}; vm.createContext(ctxE);
    vm.runInContext(['cleNum', 'RE_VRM', 'refVRMDe', 'numeroLbcLu', 'adRefKeys'].map((n) => extraire(EXT, n)).join('\n') + '\n;this.E = { adRefKeys };', ctxE);
    const cas = [[ad, {}], [ad, { 2900000001: '7' }], [{ id: '2900000099', ref: '230', subject: 'Nike n230' }, {}], [{ id: '2900000001', customRef: 'VRM-B12', subject: 'x' }, {}]];
    const ecarts = cas.filter(([a, l]) => JSON.stringify(ctxE.E.adRefKeys(a, l, MK)) !== JSON.stringify(R.clesAnnonceLbc(a, l)));
    dit(!ecarts.length, 'l\'extension (file Leboncoin) lit les mêmes clés que l\'app, marqueur compris (§11)', ecarts.map(([a, l]) => JSON.stringify(ctxE.E.adRefKeys(a, l, MK)) + ' ≠ ' + JSON.stringify(R.clesAnnonceLbc(a, l))).join(' · '));
    dit(/'vrm_lbc_liens', 'vrm_numerotation'[,\]]/.test(EXT) && /adRefKeys\(ad, liens, main\.vrm_numerotation\)/.test(EXT), 'et la file Leboncoin de l\'extension projette le marqueur et le passe à ses deux lecteurs');
    cas.push([{ id: '2900000553', ref: '553', subject: 'Autry n553' }, {}], [{ id: '2900000553', ref: '7', subject: 'Autry' }, {}]);
    const ecarts2 = cas.filter(([a, l]) => JSON.stringify(ctxE.E.adRefKeys(a, l, MK)) !== JSON.stringify(R.clesAnnonceLbc(a, l)));
    dit(!ecarts2.length, 'et l\'extension lit pareil le numéro provisoire et la référence réécrite (§11)', ecarts2.map(([a, l]) => JSON.stringify(ctxE.E.adRefKeys(a, l, MK)) + ' ≠ ' + JSON.stringify(R.clesAnnonceLbc(a, l))).join(' · '));
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
    // (relecture du 11 octobre) Ses deux vraies annonces : « VRM-553 » (devenu 1).
    const fiches1 = { 10312412617: { numero: '1' }, 7000000001: { numero: 'B1' } };
    const a553 = [{ itemId: '128127336988', sku: 'VRM-553', title: 'autry reelwind beige 36' }];
    const r5 = R.doublesVenteEbay({ annonces: a553, commandes: [], numeros: fiches1, enLigne: new Set(), vendusVinted: new Set(['10312412617']), programmees: [] });
    dit(r5.aRetirerEbay.length === 1 && r5.aRetirerEbay[0].numero === '1' && R.skuEbayDe(r5.aRetirerEbay[0].numero) === 'VRM-1', 'la paire 1 vendue sur Vinted ⇒ son annonce eBay « VRM-553 » est à retirer (avant : rien, « B553 » ne désignait personne)', JSON.stringify(r5.aRetirerEbay.map((d) => d.numero)));
    const c553 = [{ orderId: 'o2', orderPaymentStatus: 'PAID', creationDate: '2026-10-12T10:00:00.000Z', lineItems: [{ sku: 'VRM-553', legacyItemId: '128127336988' }] }];
    const r6 = R.doublesVenteEbay({ annonces: [], commandes: c553, numeros: fiches1, enLigne: new Set(['10312412617']), vendusVinted: new Set(), programmees: [] });
    dit(r6.aRetirerVinted.length === 1 && r6.aRetirerVinted[0].numero === '1', 'et l\'autre sens : vendue sur eBay ⇒ la paire 1 est à retirer de Vinted', JSON.stringify(r6.aRetirerVinted.map((d) => d.numero)));
    // (relecture du 11 octobre) « Relier à une paire » APRÈS la coupure (SKU réécrit « VRM-3 ») : la
    // vente de l'ANCIENNE B3 ne la fait pas retirer — celle de la NOUVELLE 3, si.
    const fiches3 = { 10312412617: { numero: '3' }, 7000000003: { numero: 'B3' } };
    const a3 = [{ itemId: '128127336988', sku: 'VRM-3', title: 'autry reelwind beige 36' }];
    const r7 = R.doublesVenteEbay({ annonces: a3, commandes: [], numeros: fiches3, enLigne: new Set(['10312412617']), vendusVinted: new Set(['7000000003']), programmees: [] });
    dit(r7.aRetirerEbay.length === 0, 'annonce reliée à la NOUVELLE 3 : la vente de l\'ancienne B3 ne la retire pas', JSON.stringify(r7.aRetirerEbay.map((d) => d.numero)));
    const r8 = R.doublesVenteEbay({ annonces: a3, commandes: [], numeros: fiches3, enLigne: new Set(), vendusVinted: new Set(['10312412617']), programmees: [] });
    dit(r8.aRetirerEbay.length === 1 && r8.aRetirerEbay[0].numero === '3', 'et la vente de la nouvelle 3 la retire', JSON.stringify(r8.aRetirerEbay.map((d) => d.numero)));
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
    for (const [k, id, d] of [['22', '110000000001', null], ['22', '110000000777', null], ['22', '9', Date.parse('2026-10-01T00:00:00Z')], ['B22', '110000000001', null],
      ['553', '128127336988', null], ['3', '128127336988', null], ['3', '110000000001', null]]) {
      if (L.numeroExterne(k, id, 'ebayAnnonces', d, MK) !== R.numeroExterne(k, id, 'ebayAnnonces', d)) { dit(false, 'numeroExterne : serveur et app divergent', `${k}/${id}`); return; }
    }
    dit(true, 'numeroExterne : serveur et app rendent la même lecture (§11)');
    // (11 octobre) Le numéro PROVISOIRE : le serveur relit « VRM-553 » chez eBay
    // avant un retrait automatique — il doit le lire comme l'app (« 1 »), sinon
    // 409 sku-change et le retrait n'a jamais lieu.
    // Sur la FORME écrite par la 013 appliquée (carte par annonce, objet) : 128127336988 → { 553: '1' }.
    MARQUEUR = MK;
    const s553 = L.numeroExterne('553', '128127336988', 'ebayAnnonces', null, MK), a553 = R.numeroExterne('553', '128127336988', 'ebayAnnonces', null);
    dit(s553 === '1' && s553 === a553, 'numeroExterne : un numéro provisoire se lit « 1 » au serveur ET dans l\'app', `serveur=${s553} · app=${a553}`);
    MARQUEUR = MK;
  });

  await essaie('route email', async () => {
    // `numeroDEmail` exécuté pour de vrai, contre un faux Supabase.
    let BASE = { mk: MK, f: { 8100000007: { numero: '7', title: 'Nike Air n230' }, 7000000017: { numero: 'B17', title: 'Puma Suede' } }, mkKo: false };
    const lus = [];
    global.fetch = async (url) => {
      const u = decodeURIComponent(String(url)); lus.push(u);
      const rep = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b, text: async () => JSON.stringify(b) });
      if (/select=owner&limit=1/.test(u)) return rep([]);
      if (/select=mk:/.test(u)) return BASE.mkKo ? rep({ message: 'boom' }, 500) : rep([{ mk: BASE.mk }]);
      if (/select=f:/.test(u)) return rep([{ f: BASE.f }]);
      if (/select=data->vinted_annonce_numeros/.test(u)) return rep([{ vinted_annonce_numeros: BASE.f }]);
      return rep([]);
    };
    const tmp = path.join(RACINE, 'api', '.audit-email-' + process.pid + '.js');
    fs.writeFileSync(tmp, ROUTE);
    let route;
    try { route = await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
    const {contexteVendeur}=await import('../api/_lib/owner.js');
    const nd = (...args)=>contexteVendeur.run({owner:'11111111-2222-4333-8444-555555555555'},()=>route.numeroDEmail(...args));
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
    dit(/manuelAt/.test(corps('const poserNumero', 'const buyOf = (o) =>')), 'une pose à la main porte sa date (`manuelAt`) : la base la reconnaît comme un geste');
    dit(/repriseDe: String\(r\.orphan\.key\)/.test(A) && /repriseDe: String\(autres\[0\]\)/.test(A), 'une reprise dit QUELLE fiche elle remplace (`repriseDe`) : la base ne la prend pas pour une fiche perdue');
    dit(/if \(code\) \{ _pushBloque = true; _emitSync\('refus'(?:, '[^']*')?\); signalerNumerosPerimes\(code\);/.test(A), 'un refus nommé de la base (numéros périmés) arrête les envois et ouvre le bloc « recharger »');
    dit(/<BlocNumerosPerimes\/>/.test(A) && /function BlocNumerosPerimes\(/.test(A), 'le bloc « écran périmé » est monté sur la coque (tous les écrans)');
    dit(/numerotation: v \}/.test(corps('const saveRoomPlan = async (data) => {', '\n};')), 'le garage 3D estampille la version de la numérotation');
    dit(/'vrm_numerotation'/.test(corps('const SYNC_KEYS = [', '];')), 'le marqueur est synchronisé (lu par l\'app, écrit par le serveur seul)');
    const reglage = corps('function NumerosSetting(', '\n}\n');
    dit(/if \(n && arch && n === arch\) \{ setRefusee\(n\);[^}]*return; \}/.test(reglage) && /arch === 'B' \? 'C' : 'B'/.test(reglage), 'Réglages n\'enregistre jamais la lettre des anciens numéros pour les nouveaux (et ne la propose pas par défaut)');
    dit(/const choix = \(m\) => \{ setMode\(m\); setRefusee\(''\); if \(m === 'chiffres'\) poser\(''\); \};/.test(reglage), '« Avec une lettre » n\'enregistre RIEN tout seul : la série ne change qu\'à la lettre tapée et acceptée');
    dit(/const lettreEx = arch \? \(arch === 'C' \? 'D' : 'C'\) : 'B';/.test(reglage) && /Les anciens numéros/.test(reglage), 'ses exemples ne citent pas la lettre des anciens (et disent qu\'ils ne se redonnent pas)');
    // (relecture du 11 octobre, mutations du relecteur) Ce qui était prouvé par RIEN :
    const numForBord = corps('const numForBord = (b) => {', '\n  };');
    dit(/if \(b\.numero && numeroEmailAdmis\(b, numeros\)\) return String\(b\.numero\);/.test(numForBord) && !/if \(b\.numero\) return/.test(numForBord), 'le N° TAMPONNÉ sur un bordereau ne reprend celui d\'un email qu\'après `numeroEmailAdmis`');
    dit(!/desc=\{pending/.test(A) || /desc=\{pending\.map\(b=>\(b\.numero&&numeroEmailAdmis\(b,numeros\)\?/.test(A), 'la carte « repérée via bordereau » ne montre le N° d\'un email qu\'après `numeroEmailAdmis`');
    const tE = ROUTE.slice(ROUTE.indexOf('export async function traiterEmail'));
    dit(/\{ const jn = await numeroDEmail\(data\.numero, data\.article, \{[^}]*\}\);\s*data\.numero = jn\.numero;/.test(tE), 'serveur : le N° d\'un BORDEREAU passe par `numeroDEmail` avant d\'être rangé (et tamponné)');
    dit(/\{ const jn = await numeroDEmail\(data\.numero, data\.designation\);\s*data\.numero = jn\.numero;/.test(tE), 'serveur : le N° d\'une VENTE passe par `numeroDEmail` avant d\'être rangé');
    dit(/const jn = await numeroDEmail\(\(article\.match\(/.test(tE) && /const numero = jn\.numero;/.test(tE), 'serveur : le N° d\'une FINALISATION aussi');
    dit(/if \(verNuage !== verLocale\) purgerCopiesNumeros\(\);/.test(A), 'au démarrage, une version de numérotation qui change fait JETER les copies d\'appareil (garage, local, numéros présents)');
    const ventes = corps('const broadKey = identiteAnnonce(o);', 'if (reuse) {');
    dit(/const parIdentite = o\.transaction_id != null && txnItem\[String\(o\.transaction_id\)\] != null;/.test(ventes) && /if \(reuse && !parIdentite && venteApresCoupure\(o\)/.test(ventes),
      'une ANCIENNE annonce vendue après la coupure garde son N° d\'identité (B7) : seule la PHOTO est écartée, jamais ce que dit Vinted');
    // On suit la RÈGLE, pas l'orthographe : la garde `!(etaitNumerotee &&
    // archiveNumeros())` doit protéger le `delete`, quels que soient les autres
    // `empty*` qui s'ajoutent devant (min, refuse… sont devenus porteurs de
    // valeur). Reste ROUGE si quelqu'un retire la garde — le vrai défaut.
    dit(/if \(emptyNum && emptyBuy && emptyMp(?: && empty\w+)* && !\(etaitNumerotee && archiveNumeros\(\)\)\) delete u\[item\.id\];/.test(A), 'effacer un N° à la main GARDE la fiche (la base refuse qu\'une fiche numérotée disparaisse)');
    dit(/const arch = !numeroReprenable\(num\);/.test(A) && /↩️ revient → numéro neuf/.test(A) && /🔁 renvoi → numéro neuf/.test(A), 'une vente revenue qui portait un ancien N° (B…) dit « numéro neuf », jamais « garde le N°B… »');
    // (21 octobre) Les retours se suivent dans Colis (« Retours en cours ») : la remise en
    // stock dit « retape-le » pour un N° qui se redonne, « numéro NEUF » pour un ancien.
    // On suit la RÈGLE, pas le genre : « paire »→« article » a mis « Elle portait »
    // au masculin (« Il portait »). Les deux pronoms sont tolérés ; ce qui compte,
    // c'est la distinction « ne se redonne pas / numéro NEUF » vs « retape-le ».
    dit(/estArchive: \(n\) => !numeroReprenable\(n\)/.test(A) && /desc: r\.archive \? `(?:Il|Elle) portait l['’]ancien N°\$\{r\.num\} : un ancien numéro ne se redonne pas/.test(A) && /: `(?:Il|Elle) garde son N°\$\{r\.num\} : retape-le/.test(A), '« retape son numéro » seulement pour un numéro qui se redonne (remise en stock)');
    dit(/if \(num && !numeroReprenable\(num\) && republiee\(o\)\) continue;/.test(A), 'une paire revenue à l\'ancien N° sort de la liste quand elle est republiée (identité ou photo), pas par le numéro');
    { const ae = corps('async function appelEbay(corps) {', '\n}\n');
      dit(/const avecVersion = corps && \(corps\.action === 'publish' \|\| corps\.action === 'programmer'\);/.test(ae) && /avecVersion \? \{ \.\.\.corps, numerotation: versionNumerotation\(\) \}/.test(ae),
        'publier / programmer sur eBay disent au serveur la version de numérotation lue par CET écran (il refuse un écran d\'avant la remise à zéro)'); }
    dit(/if\(vF!==vIci\)\{ toast\(SAUVEGARDE_AVANT_REMISE\); return; \}/.test(A) && /refus=codeRefusNumeros\(t\)\|\|\(r\.status>=400&&r\.status<500\?'refus':null\)/.test(A), 'restaurer une sauvegarde d\'avant la remise à zéro : refusé AVANT d\'écrire, et la vraie cause dite (jamais « la base n\'a pas répondu »)');
  });

  console.log('\n9. L\'ÉCRAN PÉRIMÉ, EXÉCUTÉ (version relue, impression, refus, saisies rejouées, retrait automatique)');
  await essaie('module de la version', async () => {
    // Le VRAI bloc d'App.jsx (de `_verNum` aux copies d'appareil), avec une fausse base.
    const i = APP.indexOf("let _verNum = { etat: 'attente'"), j = APP.indexOf('const purgerCopiesNumeros');
    const k = APP.indexOf('\n', j);
    if (i < 0 || j < 0) throw new Error('bloc de version introuvable');
    const store = {}, lus = [];
    let versionBase = 2;
    const ctx = { console, JSON, Date, Object, Array, Number, String, Set, Map, isFinite, Promise, Error,
      localStorage: { getItem: (x) => (x in store ? store[x] : null), setItem: (x, v) => { store[x] = String(v); }, removeItem: (x) => { delete store[x]; } },
      sessionStorage: { setItem: () => {} }, window: { location: { reload: () => {} } },
      SUPABASE_URL: 'https://base.test', SUPABASE_ROW: 'main', sbAuth: () => ({}), isCloudReady: () => true,
      fetch: async (u) => { lus.push(String(u)); return { ok: true, json: async () => [{ v: versionBase == null ? null : String(versionBase) }] }; } };
    vm.createContext(ctx);
    vm.runInContext('const load = (k, d) => { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); };\n'
      + ['marqueurNumerotation', 'versionNumerotation'].map((n) => extraire(APP, n)).join('\n') + '\n'
      + APP.slice(i, k) + '\n;this.V = { verifierVersionNumerotation, etatVersionNumerotation, noterVersionChargee, assurerVersionNumerotation, signalerNumerosPerimes, etatNumerosPerimes, noterInstantaneCharge, memoriserSaisies, rejouerSaisies, purgerCopiesNumeros };', ctx);
    const V = ctx.V;
    store.vrm_numerotation = JSON.stringify(MK);
    V.noterVersionChargee();
    await V.verifierVersionNumerotation();
    dit(V.etatVersionNumerotation().etat === 'ok', 'version relue identique (2) ⇒ « ok »');
    dit(await V.assurerVersionNumerotation() === true, 'et l\'impression peut tamponner le N°');
    versionBase = 3;
    await V.verifierVersionNumerotation();
    dit(V.etatVersionNumerotation().etat === 'perime', 'la base passe en version 3 (une remise à zéro ou un retour arrière) ⇒ « périmé »', V.etatVersionNumerotation().etat);
    dit(await V.assurerVersionNumerotation() === false && (V.etatNumerosPerimes() || {}).code === 'version', 'avant d\'IMPRIMER sur cet écran : refusé (aucun N° tamponné), le bloc « Recharger » s\'ouvre');
    // Le refus d'une écriture fait RELIRE la version (le bloc ne devine pas sa cause).
    const ctx2 = { ...ctx, fetch: async (u) => { lus.push('2:' + u); return { ok: true, json: async () => [{ v: '3' }] }; } };
    vm.createContext(ctx2);
    vm.runInContext('const load = (k, d) => { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); };\n'
      + ['marqueurNumerotation', 'versionNumerotation'].map((n) => extraire(APP, n)).join('\n') + '\n'
      + APP.slice(i, k) + '\n;this.V = { signalerNumerosPerimes, etatVersionNumerotation };', ctx2);
    const avantLus = lus.filter((x) => x.startsWith('2:')).length;
    ctx2.V.signalerNumerosPerimes('vrm_pool_retreci');
    await new Promise((r) => setTimeout(r, 20));
    dit(lus.filter((x) => x.startsWith('2:')).length > avantLus && ctx2.V.etatVersionNumerotation().nuage === 3, 'un REFUS de la base fait relire la version tout de suite (le bloc dit la vraie cause, pas « un autre appareil » au hasard)');
    // Les copies d'appareil.
    store.vinted_nums_physiques = '{}'; store.vrm_room_plan = '{}'; store.vrm_local_plan = '{}'; store.garde = '1';
    V.purgerCopiesNumeros();
    dit(!('vinted_nums_physiques' in store) && !('vrm_room_plan' in store) && !('vrm_local_plan' in store) && store.garde === '1', 'les copies d\'appareil qui portent des numéros sont jetées (et rien d\'autre)');
    // (relecture du 11 octobre) Les gestes rejoués : la DIFFÉRENCE, jamais la carte entière.
    V.noterInstantaneCharge({ vinted_ship_done: { 111: 1, 222: 1 }, vinted_offers_done: ['a', 'b'] });
    store.vinted_ship_done = JSON.stringify({ 111: 1, 222: 1, 333: 1 });
    store.vinted_offers_done = JSON.stringify(['a', 'b', 'c']);
    V.memoriserSaisies();
    store.vinted_ship_done = JSON.stringify({ 111: 1 });                 // l'AUTRE appareil a décoché 222
    store.vinted_offers_done = JSON.stringify(['a']);                    // … et rouvert l'offre b
    V.rejouerSaisies();
    dit(store.vinted_ship_done === JSON.stringify({ 111: 1, 333: 1 }), 'colis : 333 coché ici est rejoué, 222 décoché AILLEURS ne ressuscite pas', store.vinted_ship_done);
    dit(store.vinted_offers_done === JSON.stringify(['a', 'c']), 'listes : seul ce qui a été ajouté ici revient', store.vinted_offers_done);
    V.noterInstantaneCharge({ vinted_ship_done: { 111: 1, 222: 1 } });
    store.vinted_ship_done = JSON.stringify({ 111: 1 });                 // décoché ICI
    V.memoriserSaisies();
    store.vinted_ship_done = JSON.stringify({ 111: 1, 222: 1, 444: 1 }); // l'autre a coché 444
    V.rejouerSaisies();
    dit(store.vinted_ship_done === JSON.stringify({ 111: 1, 444: 1 }), 'un colis DÉCOCHÉ ici reste décoché, et ce que l\'autre a coché reste', store.vinted_ship_done);
  });
  await essaie('retrait automatique (corps envoyé)', async () => {
    const envoyes = [];
    const ctx = { console, JSON, Set, String, Array,
      fetch: async (u, o) => { envoyes.push(JSON.parse(o.body)); return {ok:true,status:200,json: async () => ({ ok: true }) }; }, enTeteSession: () => ({}), toast: () => {} };
    vm.createContext(ctx);
    vm.runInContext('let __retraitEbayAutoEnVol = false; const __retraitEbayAutoTentes = new Set();\n'
      + ['cleNum', 'NUM_OK', 'skuEbayDe','CLE_COMPTE_EBAY','corpsCompteEbay','EBAY_DEJA_TERMINEE', 'retirerEbayAuto'].map((n) => extraire(APP, n)).join('\n') + '\n;this.F = retirerEbayAuto;', ctx);
    await ctx.F([{ numero: 'B22', annonce: { itemId: '110000000001', sku: 'VRM-22', title: 'x' } }, { numero: '1', annonce: { itemId: '128127336988', sku: 'VRM-553', title: 'y' } }]);
    dit(envoyes.length === 2 && envoyes[0].sku === 'VRM-B22' && envoyes[1].sku === 'VRM-1', 'le retrait automatique envoie le SKU de la paire JUGÉE vendue (« VRM-B22 », « VRM-1 »), jamais la chaîne lue chez eBay', envoyes.map((x) => x.sku).join(', '));
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
