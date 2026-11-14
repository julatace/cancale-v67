// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — L'ACCUEIL DES NOUVEAUX (14 nov., choix de Julien n° 132, 135, 137, 138,
//  141, 142, 144). Il EXÉCUTE les règles (modules purs) et lit le branchement :
//   L  141 la langue : le téléphone n'est lu qu'au TOUT premier lancement, seulement
//      sans choix ; la détection n'écrit jamais `vrm_langue` ; le choix explicite gagne
//      toujours (même après une détection) ; hors des cinq ⇒ français.
//   N  142 les notifications : AUCUNE demande au démarrage (plus d'effet de montage qui
//      demande ; `requestPermission` seulement dans un geste) ; une fois ; refus respecté ;
//      iPhone sans l'app installée ⇒ le dire, ne rien demander ; les liens de suivi
//      reconnus sont ceux que rend la VRAIE `lienSuivi`.
//   B  132 le bilan : les MÊMES chiffres que les règles qui les publient (`bilanLignes`
//      extraite d'App.jsx, `aExpedierPourCarte`, `vrm_colis_retirer`, `widgetBase.online`) ;
//      « au moins » avec sa raison si partiel ; « — » si pas su ; une fois, jamais chez un
//      installé, jamais en exemple ; marqueur synchronisé.
//   P  135 un parcours par plateforme : routes, étapes possibles avec l'extension actuelle
//      (EXT_CAPACITES), aucune extension demandée pour eBay, preuves `select=id`.
//   C  137 le premier colis : jamais pendant une série, une fois, jamais chez un installé.
//   E  138 « Nouveau » : par compte, compte neuf seulement, disparaît à la 1re ouverture,
//      jamais à la place d'un nombre.
//   T  144 /tarifs : prix lus = CGV = serveur (`PRIX_CGV`, `PRIX_PRO_CGV`), phrases = OFFRES
//      (plan-regle.js), aucun montant écrit en dur, « Gratuit pour l'instant » / paiement
//      fermé dits, liens CGV et confidentialité, aucun script en ligne, route servie.
//  `--prouve` : chaque mutation (copie de l'arbre) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const VRAIE = path.join(__dirname, '..');
const R = process.env.AN_RACINE || VRAIE;
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const imp = (f) => import(pathToFileURL(path.join(R, f)).href + '?v=' + Math.random());

if (process.argv.includes('--prouve')) {
  const MUTATIONS = [
    ['la détection écrit vrm_langue', 'src/i18n/index.js', "stockage.setItem(CLE_LANGUE_DETECTEE, JSON.stringify({ l, at }))", "stockage.setItem(CLE_LANGUE, JSON.stringify(l))"],
    ['la langue du téléphone relue à chaque lancement', 'src/i18n/index.js', "  if (d) return { langue: d.l, source: 'detectee' };\n", ''],
    ['le téléphone gagne sur le choix', 'src/i18n/index.js', "  if (c) return { langue: c, source: 'choix' };\n", ''],
    ['la demande au démarrage revient', 'src/App.jsx', "    if(Notification.permission==='granted' && !notifEnabled){ setNotifEnabled(true); save('vinted_notif_enabled',true); }", "    if(Notification.permission==='default'){ askNotifPermission(); }"],
    ['la question revient après un refus', 'src/notifsBonMoment.js', "  if (lireDemandeNotifs(marqueur)) return null;\n", ''],
    ['iPhone non installé : on demande quand même', 'src/notifsBonMoment.js', "  if (p.ios && !p.installee) return 'installer';\n", ''],
    ['le bilan fait sa propre somme', 'src/bilanMinute.js', 'const r = somme(vendu.lignes, debut, null);', 'const r = { n: vendu.lignes.length, eur: vendu.lignes.reduce((a, l) => a + l.eur, 0) };'],
    ['le bilan oublie « au moins »', 'src/bilanMinute.js', 'auMoins: raisons.length > 0', 'auMoins: false'],
    ['le bilan chez un installé', 'src/bilanMinute.js', '  if (!parcours) return false;', '  if (!parcours) return true;'],
    ['un colis pas publié vaut 0', 'src/bilanMinute.js', ": { n: null, auMoins: false };\n  const re", ": { n: 0, auMoins: false };\n  const re"],
    ['le premier colis pendant une série', 'src/premierColis.js', "if (!evt || evt.serie !== false) return false;", "if (!evt) return false;"],
    ['le premier colis chez un installé', 'src/premierColis.js', 'return evt.avant === 0;', 'return true;'],
    ['« Nouveau » à la place d’un nombre', 'src/ecransVus.js', "  if (typeof v === 'number' && v > 0) return v;\n", ''],
    ['« Nouveau » chez un installé', 'src/ecransVus.js', 'if (!neuf) return { v: 1, depuis: at, installe: true, vus: {} };', 'if (!neuf) return { v: 1, depuis: at, installe: false, vus: {} };'],
    ['eBay demande l’extension', 'src/parcoursArrivee.js', "if (r.cle === 'ebay') return [compte, {", "if (r.cle === 'ebay') return [compte, ETAPES_PARCOURS[1], {"],
    ['Leboncoin coché sur le compte vu seulement', 'src/parcoursArrivee.js', "leboncoin: ['lbc_listings', 'lbc_ventes'], vestiaire", "leboncoin: ['lbc_listings', 'lbc_ventes', 'lbc_accounts'], vestiaire"],
    ['un prix Pro écrit en dur sur /tarifs', 'src/tarifs/Tarifs.jsx', "{offre('pro', PRIX_PRO_MOIS, PRO_OUVERT)}", "{offre('pro', '18,99', PRO_OUVERT)}"],
    ['/tarifs ne dit plus « Gratuit pour l’instant »', 'src/tarifs/Tarifs.jsx', "{ACCES_OFFERT ? <span className=\"vt-pastille\" data-acces-offert=\"\">{tr('accueil.gratuit')}</span> : null}", ''],
    ['/tarifs sans le lien des CGV', 'src/tarifs/Tarifs.jsx', "['legal.cgv', '/legal/cgv.html'], ", ''],
  ];
  let rate = 0;
  for (const [nom, f, de, vers] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'an-'));
    try {
      for (const d of ['src', 'api', 'public/legal']) fs.cpSync(path.join(VRAIE, d), path.join(tmp, d), { recursive: true });
      for (const x of ['vercel.json', 'package.json', 'public/sitemap.xml']) { fs.mkdirSync(path.dirname(path.join(tmp, x)), { recursive: true }); fs.copyFileSync(path.join(VRAIE, x), path.join(tmp, x)); }
      try { fs.symlinkSync(path.join(VRAIE, 'node_modules'), path.join(tmp, 'node_modules')); } catch (_) {}
      const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8');
      if (!s.includes(de)) { console.log(`KO  mutation « ${nom} » : le texte à muter n'existe plus`); rate++; continue; }
      fs.writeFileSync(p, s.replace(de, vers));
      const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AN_RACINE: tmp }, encoding: 'utf8' });
      if (r.status === 0) { console.log(`KO  mutation « ${nom} » : l'audit reste VERT`); rate++; } else console.log(`OK  mutation « ${nom} » ⇒ rouge`);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(rate ? `\n❌ ${rate} mutation(s) ne font pas échouer l'audit` : `\n✅ les ${MUTATIONS.length} mutations font échouer l'audit`);
  process.exit(rate ? 1 : 0);
}

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : ''}`); };
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
// Un faux stockage qui note chaque écriture.
const stock = (init = {}) => { const m = new Map(Object.entries(init)); const ecrits = []; return { ecrits, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { ecrits.push(k); m.set(k, String(v)); }, removeItem: (k) => m.delete(k) }; };

(async () => {
  const app = lire('src/App.jsx');
  const appCode = sansCommentaires(app);

  // ── L · 141 la langue ─────────────────────────────────────────────────────
  console.log('── L · la langue du téléphone (141)');
  const I = await imp('src/i18n/index.js');
  {
    const s = stock();
    const a = I.langueDepart(s, { languages: ['de-AT', 'en'] });
    dit(a.langue === 'de' && a.source === 'premier', 'L1 premier lancement sans choix : la langue du téléphone (de-AT ⇒ de)', a);
    dit(!s.ecrits.includes(I.CLE_LANGUE), 'L2 la détection n’écrit JAMAIS `vrm_langue` (le nuage ne peut pas écraser un choix fait ailleurs)', s.ecrits);
    const b = I.langueDepart(s, { languages: ['it'] });
    dit(b.langue === 'de' && b.source === 'detectee', 'L3 au lancement suivant, le téléphone n’est PLUS relu (seulement au tout premier)', b);
    s.setItem(I.CLE_LANGUE, JSON.stringify('es'));
    const c = I.langueDepart(s, { languages: ['it'] });
    dit(c.langue === 'es' && c.source === 'choix', 'L4 le choix explicite gagne toujours, même après une détection', c);
    const d = I.langueDepart(stock(), { languages: ['ja-JP', 'zh'] });
    dit(d.langue === 'fr', 'L5 une langue hors des cinq ⇒ français', d);
    const e = I.langueDepart(stock({ [I.CLE_LANGUE]: JSON.stringify('fr') }), { languages: ['en-US'] });
    dit(e.langue === 'fr' && e.source === 'choix', 'L6 « Français » choisi exprès gagne sur un téléphone en anglais', e);
    const s2 = stock(); I.langueDepart(s2, { languages: ['en'] }); I.noterLangueDetecteeVue(s2);
    dit(!s2.ecrits.includes(I.CLE_LANGUE) && I.langueDetectee(s2).vu === true, 'L7 « OK » sur l’avis : noté sur l’appareil, jamais comme un choix', s2.ecrits);
    const idx = sansCommentaires(lire('src/i18n/index.js'));
    dit(/export const langueInitiale = \(\) => langueDepart\(\)\.langue;/.test(idx) && /const l = langueInitiale\(\);/.test(idx), 'L8 le démarrage (`preparerLangue`) passe par `langueDepart`');
    dit(!/SYNC_KEYS[^\]]*vrm_langue_detectee/.test(app) && !/'vrm_langue_detectee',/.test(app), 'L9 la détection reste sur l’appareil (pas dans SYNC_KEYS)');
  }

  // ── N · 142 les notifications ─────────────────────────────────────────────
  console.log('── N · les notifications au bon moment (142)');
  const Nm = await imp('src/notifsBonMoment.js');
  {
    const base = { moment: 'colis-suivi', marqueur: null, plateforme: { notif: 'default', ios: false, installee: false }, exemple: false, pret: true };
    dit(Nm.quoiProposer({ ...base, moment: undefined }) === null, 'N1 sans geste (premier rendu, aucun moment) : rien n’est proposé');
    dit(Nm.quoiProposer(base) === 'demander', 'N2 après un colis suivi : la question');
    dit(Nm.quoiProposer({ ...base, marqueur: Nm.marqueurNotifs('non', 'colis-suivi') }) === null, 'N3 une fois : une réponse rangée (même « Pas maintenant ») n’est jamais redemandée');
    dit(Nm.quoiProposer({ ...base, plateforme: { notif: 'denied' } }) === null && Nm.quoiProposer({ ...base, plateforme: { notif: 'granted' } }) === null, 'N4 déjà accordée ou refusée dans le navigateur ⇒ rien');
    dit(Nm.quoiProposer({ ...base, plateforme: { notif: 'default', ios: true, installee: false } }) === 'installer', 'N5 iPhone sans VRM sur l’écran d’accueil ⇒ le dire, ne rien demander');
    dit(Nm.quoiProposer({ ...base, plateforme: { notif: 'default', ios: true, installee: true } }) === 'demander', 'N6 iPhone avec VRM installé ⇒ la question');
    dit(Nm.quoiProposer({ ...base, exemple: true }) === null && Nm.quoiProposer({ ...base, pret: false }) === null, 'N7 jamais en mode exemple, jamais avant la lecture du compte');
    // Les liens de suivi : ceux que rend la VRAIE règle.
    const S = await imp('api/_lib/suivi-colis.js');
    const liens = ['Mondial Relay', 'Chronopost', 'Vinted Go', 'Colissimo', 'UPS'].map((t) => S.lienSuivi(t, '1Z999AA10123456784', '75011')).filter(Boolean).map((l) => l.url);
    dit(liens.length >= 4 && liens.every(Nm.estLienSuivi), 'N8 « Suivre » un colis est reconnu sur chaque lien de `lienSuivi`', liens.filter((u) => !Nm.estLienSuivi(u)));
    dit(!Nm.estLienSuivi('https://www.vinted.fr/items/123') && !Nm.estLienSuivi('https://www.google.com/search?q=chaussures') && !Nm.estLienSuivi('/?tab=ventes'), 'N9 un autre lien ne déclenche rien');
    // Aucune demande au démarrage : les seuls appels à la permission sont dans des gestes.
    const appels = [];
    for (const f of ['src/App.jsx', 'src/ecrans/Reglages.jsx', 'src/accueilNouveaux/AccueilNouveaux.jsx']) {
      const c = sansCommentaires(lire(f));
      for (const m of c.matchAll(/askNotifPermission\(\)|Notification\.requestPermission\(\)/g)) { const a = c.slice(Math.max(0, m.index - 1600), m.index); if (!/function $/.test(a)) appels.push({ f, a }); }
    }
    const dansUnGeste = (a) => /function askNotifPermission\(\)\{[^}]*$/.test(a.a.slice(-400)) || /onToggleNotif=\{async\(\)=>\{[\s\S]*$/.test(a.a.slice(-300)) || /const enable = async \(\) => \{[\s\S]*$/.test(a.a.slice(-300)) || /async function activerNotifs\(enTeteSession\) \{[\s\S]*$/.test(a.a.slice(-300));
    dit(appels.length >= 3 && appels.every(dansUnGeste), 'N10 la permission n’est demandée QUE dans un geste (interrupteur de Paramètres, « Oui, préviens-moi »)', appels.filter((a) => !dansUnGeste(a)).map((a) => a.f + ' … ' + a.a.slice(-160)));
    const blocs = [...appCode.matchAll(/useEffect\(\(\)=>\{([\s\S]{0,700}?)\},\[\]\);/g)].map((m) => m[1]);
    dit(!blocs.some((b) => /askNotifPermission|requestPermission/.test(b)), 'N11 aucun effet de MONTAGE ne demande la permission (jamais au démarrage, §3)');
    const an = sansCommentaires(lire('src/accueilNouveaux/AccueilNouveaux.jsx'));
    dit(/const oui = async \(\) => \{\s*setEtat\('attente'\);\s*const r = await activerNotifs/.test(an) && (an.match(/activerNotifs\(/g) || []).length === 2, 'N12 `activerNotifs` (qui demande) n’est appelée que par « Oui, préviens-moi »');
  }

  // ── B · 132 le bilan ──────────────────────────────────────────────────────
  console.log('── B · ton bilan en une minute (132)');
  const Bm = await imp('src/bilanMinute.js');
  {
    // La règle VENDU de la coque, extraite telle quelle d'App.jsx.
    const i0 = app.indexOf('const bilanLignes = (lignes, depuisTs, jusquaTs) => {');
    const i1 = app.indexOf('\n};', i0);
    let bilanLignes = null;
    try { bilanLignes = new Function('return ' + app.slice(i0 + 'const bilanLignes = '.length, i1 + 2).replace(/;$/, ''))(); } catch (e) { bilanLignes = null; }
    dit(typeof bilanLignes === 'function', 'B0 `bilanLignes` (la règle de « Vendu ») se lit dans App.jsx');
    const an = new Date().getFullYear();
    const ts = (m, j) => new Date(an, m, j, 12).getTime();
    const lignes = [{ ts: ts(0, 3), eur: 40 }, { ts: ts(1, 9), eur: 85.5 }, { ts: ts(new Date().getMonth(), 1), eur: 120 }, { ts: new Date(an - 1, 11, 30).getTime(), eur: 999 }];
    const ref = bilanLignes ? bilanLignes(lignes, new Date(an, 0, 1).getTime(), null) : null;
    const b = Bm.bilanMinute({ vendu: { lignes, pasSu: false, enAttente: false, manque: [], nonCompteesAnnee: 0 }, somme: bilanLignes, aExpedier: { n: 3, auMoins: false }, retirer: { total: 2, enVerification: 0 }, enLigne: { online: 41 }, imports: {} });
    dit(ref && b.ventes.n === ref.n && b.ventes.eur === ref.eur && b.ventes.n === 3 && b.ventes.auMoins === false, 'B1 ventes et CA de l’année = la règle VENDU de la coque (`bilanLignes`), l’an passé exclu', { b: b.ventes, ref });
    const R2 = await imp('src/resumeCarte.js');
    const pub = { at: Date.now(), total: 4, ebay: null, leboncoin: 0, vestiaire: 0 };
    const ax = R2.aExpedierPourCarte(pub);
    const b2 = Bm.bilanMinute({ vendu: { lignes: [] }, somme: bilanLignes, aExpedier: ax, retirer: { total: 5, enVerification: 1 }, enLigne: { online: null, onlinePasSu: 'annonces pas lues (1 compte)' } });
    dit(b2.colis.aExpedier.n === ax.n && b2.colis.aExpedier.auMoins === ax.auMoins && ax.auMoins === true, 'B2 « à expédier » = `aExpedierPourCarte` (widget, carte du logo), « au moins » compris', { b: b2.colis.aExpedier, ax });
    dit(b2.colis.aRetirer.n === 5 && b2.colis.aRetirer.auMoins === true, 'B3 « à retirer » = `vrm_colis_retirer.total` ; un colis en vérification ⇒ au moins', b2.colis.aRetirer);
    dit(b2.enLigne.n === null && b2.enLigne.etat === 'passu', 'B4 « en ligne » pas lu ⇒ « — », jamais 0', b2.enLigne);
    const b3 = Bm.bilanMinute({ somme: bilanLignes, aExpedier: R2.aExpedierPourCarte(null), retirer: null });
    dit(b3.ventes.etat === 'encours' && b3.colis.aExpedier.n === null && b3.colis.aRetirer.n === null && b3.enLigne.etat === 'encours', 'B5 rien de publié ⇒ « en cours » / « — », jamais 0', b3);
    const b4 = Bm.bilanMinute({ vendu: { pasSu: true }, somme: bilanLignes });
    dit(b4.ventes.etat === 'passu' && b4.ventes.eur === null, 'B6 ventes pas lues ⇒ « — » (pas su ≠ 0)', b4.ventes);
    const b5 = Bm.bilanMinute({ vendu: { lignes, manque: ['Leboncoin'] }, somme: bilanLignes });
    const b6 = Bm.bilanMinute({ vendu: { lignes }, somme: bilanLignes, imports: { 12: { etat: 'encours' } } });
    const b7 = Bm.bilanMinute({ vendu: { lignes, nonCompteesAnnee: 2 }, somme: bilanLignes });
    dit(b5.ventes.auMoins && b5.ventes.raisons[0].k === 'manque' && b6.ventes.auMoins && b6.ventes.raisons[0].k === 'import' && b7.ventes.auMoins, 'B7 partiel (source pas lue, import du passé en cours, montant illisible) ⇒ « au moins » et SA raison');
    const pos = { etape: null, ouvert: false, fini: null };
    dit(Bm.doitMontrerBilan({ pret: true, parcours: null, luUneFois: true }) === false, 'B8 jamais chez un vendeur installé (aucun parcours commencé)');
    dit(Bm.doitMontrerBilan({ pret: true, parcours: pos, luUneFois: true }) === true && Bm.doitMontrerBilan({ pret: true, parcours: { ...pos, fini: 'x' } }) === true, 'B9 dès la première lecture (ou le parcours fini) : montré');
    dit(Bm.doitMontrerBilan({ pret: true, parcours: pos, luUneFois: true, marqueur: Bm.marqueurBilan('passe') }) === false, 'B10 une seule fois : passé ou vu, il ne revient pas tout seul');
    dit(Bm.doitMontrerBilan({ pret: true, parcours: pos, luUneFois: true, exemple: true }) === false && Bm.doitMontrerBilan({ pret: false, parcours: pos, luUneFois: true }) === false && Bm.doitMontrerBilan({ pret: true, parcours: pos, luUneFois: false }) === false, 'B11 jamais en exemple, jamais avant le nuage, jamais avant la lecture');
    dit(/bilanLignes, aExpedierPourCarte, lireImports/.test(appCode) && /lignes: liveStatsVus\.venduPasSu \? null : liveStatsVus\.venduLignes/.test(appCode) && /enLigne: widgetBase/.test(appCode), 'B12 branchement : la coque passe SES publications (VENDU, widget) et SES règles');
    dit(/CLE_ECRANS_VUS, CLE_BILAN_MINUTE, CLE_PREMIER_COLIS, CLE_NOTIFS_DEMANDE,/.test(appCode), 'B13 les quatre marqueurs sont dans SYNC_KEYS (par compte VRM, pas seulement l’appareil)');
    dit(/vrm:bilan-minute/.test(lire('src/ecrans/Reglages.jsx')), 'B14 rejouable depuis Paramètres → Aide');
  }

  // ── P · 135 un parcours par plateforme ────────────────────────────────────
  console.log('── P · le parcours sans Vinted (135)');
  // Le MÊME module de traduction que celui qu'importe parcoursArrivee.js (sans « ?v= »).
  (await import(pathToFileURL(path.join(R, 'src', 'i18n', 'index.js')).href)).ajouterSourceApp((await imp('src/i18n/langues/fr.js')).default);
  const Pm = await imp('src/parcoursArrivee.js');
  {
    const r = (s) => Pm.routeParcours(s === null ? null : { sites: s });
    dit(r(null).cle === 'vinted' && r(['vinted', 'leboncoin']).cle === 'vinted', 'P1 rien choisi, ou Vinted choisi ⇒ les trois étapes d’avant');
    dit(r(['leboncoin']).cle === 'leboncoin' && r(['vestiaire', 'ebay']).cle === 'vestiaire' && r(['ebay']).cle === 'ebay', 'P2 Leboncoin seul, Vestiaire, eBay seul : leur route');
    const eb = Pm.etapesRoute(r(['ebay'])).map((e) => e.cle);
    const lb = Pm.etapesRoute(r(['leboncoin'])).map((e) => e.cle);
    dit(JSON.stringify(eb) === '["compte","ebay"]', 'P3 eBay : aucune étape d’extension (connexion officielle d’eBay)', eb);
    dit(JSON.stringify(lb) === '["compte","extension","leboncoin"]', 'P4 Leboncoin : compte · extension · Mes annonces', lb);
    const caps = /const EXT_CAPACITES = \{([^}]*)\}/.exec(app);
    dit(!!caps && ['lbcclair', 'lbcfiche', 'vcsession', 'vcfiche'].every((k) => new RegExp(`\\b${k}: '`).test(caps[1])), 'P5 chaque étape promise existe dans l’extension (EXT_CAPACITES : lbcclair, lbcfiche, vcsession, vcfiche)');
    const S = (ids) => ids.map((id) => ({ id }));
    dit(Pm.preuveSite(S(['lbc_accounts']), ['leboncoin']).etat === 'attente' && Pm.preuveSite(S(['lbc_listings']), ['leboncoin']).etat === 'fait', 'P6 compte vu ⇒ « lecture… » ; annonces rangées ⇒ fait');
    dit(Pm.preuveSite(undefined, ['leboncoin']).etat === 'encours' && Pm.preuveSite(null, ['leboncoin']).etat === 'passu', 'P7 trois états : en cours, pas su (jamais « fait »)');
    dit(Pm.preuveSite(S(['vc_listings']), ['leboncoin']).etat === 'afaire', 'P8 les lignes d’un autre site ne cochent rien');
    dit(Pm.preuveEbay([{ implicite: true }]).etat === 'afaire' && Pm.preuveEbay([{ implicite: false }]).etat === 'fait' && Pm.preuveEbay(null).etat === 'passu', 'P9 eBay : un compte RELIÉ au registre (l’implicite ne prouve rien)');
    const fini = Pm.etatParcours({ compte: { etat: 'fait' }, extension: Pm.preuveExtension('absente', Pm.lignesDuSite(S(['lbc_listings', 'ebay_orders']), ['leboncoin'])), leboncoin: Pm.preuveSite(S(['lbc_listings']), ['leboncoin']) }, { route: r(['leboncoin']) });
    dit(fini.fini === true && fini.total === 3 && Pm.reussite(fini.etapes[2]) === 'Annonces Leboncoin lues', 'P10 un vendeur Leboncoin installé (lignes rangées) a tout fait — sur iPhone aussi (jamais interrompu)', fini.etapes.map((e) => e.etat));
    dit(/^id=in\.\([a-z_,]+\)&select=id$/.test(Pm.REQUETE_SITES_PARCOURS), 'P11 lecture `select=id`, aucune donnée lue', Pm.REQUETE_SITES_PARCOURS);
    dit(/const route = routeParcoursIci\(\);/.test(appCode) && /etatParcours\(preuves, \{ plusTard, route \}\)/.test(appCode) && /<CarteParcoursApp comptes=\{props\.comptes\} plein=\{!!props\.plein\} sinon=\{relierListe\}\/>/.test(appCode), 'P12 branchement : la route lue de « Où vends-tu ? », la carte du parcours aussi sans Vinted');
    const ligne = Pm.ligneEtape({ ...Pm.etapesRoute(r(['ebay']))[1], etat: 'afaire' });
    dit(ligne.split(/\s+/).length <= 12 && /eBay/.test(ligne), 'P13 le geste exact, en une ligne', ligne);
  }

  // ── C · 137 le premier colis ──────────────────────────────────────────────
  console.log('── C · le premier colis accompagné (137)');
  const Cm = await imp('src/premierColis.js');
  {
    const b = { pret: true, exemple: false, marqueur: null };
    dit(Cm.doitAccompagner({ ...b, evt: { serie: false, avant: 0 } }) === true, 'C1 le tout premier bordereau imprimé seul ⇒ accompagné');
    dit(Cm.doitAccompagner({ ...b, evt: { serie: true, avant: 0 } }) === false, 'C2 une impression EN SÉRIE n’est jamais interrompue');
    dit(Cm.doitAccompagner({ ...b, evt: { serie: false, avant: 12 } }) === false && Cm.doitAccompagner({ ...b, evt: { serie: false, avant: null } }) === false, 'C3 jamais chez un vendeur qui a déjà imprimé (ni sur un « pas su »)');
    dit(Cm.doitAccompagner({ ...b, marqueur: Cm.marqueurColis('passe'), evt: { serie: false, avant: 0 } }) === false && Cm.doitAccompagner({ ...b, exemple: true, evt: { serie: false, avant: 0 } }) === false, 'C4 une fois ; jamais en exemple');
    dit(/const avantColis = bordsAvantImpression\(\);\n  if \(numero && !\(await assurerVersionNumerotation\(\)\)\)/.test(app) && /signalerBordereauImprime\(false, avantColis\)/.test(appCode) && /signalerBordereauImprime\(true, null\)/.test(appCode), 'C5 branchement : compté AVANT l’impression ; le seul signale « seul », la série « série »');
    const d1 = { closest: () => null, hasAttribute: () => false };
    dit(Cm.fenetreOuverte([d1]) === true && Cm.fenetreOuverte([]) === false, 'C6 il attend que la visionneuse et toute fenêtre soient fermées');
    dit(Cm.ETAPES_COLIS.join(',') === 'imprimer,coller,deposer,suivre', 'C7 quatre étapes : imprimer, coller, déposer, suivre');
  }

  // ── E · 138 « Nouveau » ───────────────────────────────────────────────────
  console.log('── E · « Nouveau » sur les écrans pas encore ouverts (138)');
  const Em = await imp('src/ecransVus.js');
  {
    const neuf = Em.premiereListe(null, { creeLe: new Date(Date.now() - 2 * 86400000).toISOString(), ecran: 'journee' });
    const vieux = Em.premiereListe(null, { creeLe: '2026-01-02T10:00:00Z', ecran: 'journee', maintenant: Date.parse('2026-11-14T10:00:00Z') });
    const pasSu = Em.premiereListe(null, { creeLe: '', ecran: 'journee' });
    dit(Em.estNouveau(neuf, 'ventes') && !Em.estNouveau(neuf, 'journee'), 'E1 un compte neuf : l’écran ouvert est vu, les autres portent « Nouveau »');
    dit(!Em.estNouveau(vieux, 'ventes') && !Em.estNouveau(pasSu, 'ventes'), 'E2 un compte installé (ou date pas sue) : jamais « Nouveau »');
    const apres = Em.marquerVu(neuf, 'ventes');
    dit(apres && !Em.estNouveau(apres, 'ventes') && Em.marquerVu(apres, 'ventes') === null, 'E3 disparaît à la première ouverture ; rien n’est réécrit ensuite');
    dit(Em.premiereListe(neuf, { creeLe: '' }) === null, 'E4 la liste rangée (un autre appareil) n’est jamais recommencée');
    dit(Em.badgeAvecNouveau(3, true) === 3 && Em.badgeAvecNouveau(true, true) === true && Em.badgeAvecNouveau(undefined, true) === 'nouveau' && Em.badgeAvecNouveau(0, false) === 0, 'E5 jamais à la place d’un nombre ni d’un point déjà posé');
    dit(!Em.estNouveau(neuf, 'paires') && !Em.estNouveau(neuf, 'settings'), 'E6 seulement les écrans (un groupe de la barre ne porte jamais « Nouveau »)');
    dit(/const v = badgeAvecNouveau\(badges\[k\], ecranNouveau\(t\.id\)\);/.test(appCode) && /poserStockageEcransVus\(\(\) => load\(CLE_ECRANS_VUS, null\)\);/.test(appCode), 'E7 branchement : la pastille de chaque entrée (barre, menu, colonne) lit la règle');
  }

  // ── T · 144 /tarifs ───────────────────────────────────────────────────────
  console.log('── T · la page publique des tarifs (144)');
  {
    const reg = await imp('src/accueil-reglages.js');
    const compte = lire('api/compte.js');
    const cts = (nom) => { const m = new RegExp(`export const ${nom} = \\{ centimes: (\\d+)`).exec(compte); return m ? Number(m[1]) : null; };
    const enCts = (p) => Math.round(Number(String(p).replace(',', '.')) * 100);
    dit(enCts(reg.PRIX_MOIS) === cts('PRIX_CGV') && cts('PRIX_CGV') === 1699, 'T1 Solo sur /tarifs = le prix du serveur (16,99 €)', { page: reg.PRIX_MOIS, serveur: cts('PRIX_CGV') });
    dit(enCts(reg.PRIX_PRO_MOIS) === cts('PRIX_PRO_CGV') && cts('PRIX_PRO_CGV') === 1999, 'T2 Pro sur /tarifs = le prix du serveur (19,99 €)', { page: reg.PRIX_PRO_MOIS, serveur: cts('PRIX_PRO_CGV') });
    const cgv = lire('public/legal/cgv.html');
    dit(cgv.includes(`${reg.PRIX_MOIS} € par mois`) && cgv.includes(`${reg.PRIX_PRO_MOIS} € par mois`) && cgv.includes(`essai gratuit de ${reg.ESSAI_JOURS} jours`), 'T3 les CGV disent les mêmes prix et le même essai');
    const tf = sansCommentaires(lire('src/tarifs/Tarifs.jsx'));
    dit(/offre\('solo', PRIX_MOIS, true\)/.test(tf) && /offre\('pro', PRIX_PRO_MOIS, PRO_OUVERT\)/.test(tf) && /OFFRES\[cle\]\.phrase/.test(tf) && /prixCompteSupTexte\(\)/.test(tf), 'T4 montants et phrases LUS (accueil-reglages, OFFRES de plan-regle.js), Pro « bientôt » tant que fermé');
    const dicts = ['fr', 'en', 'es', 'it', 'de'].map((l) => lire(`src/i18n/langues/${l}/tarifs.js`)).join('\n');
    dit(!/\d+[,.]\d\d/.test(tf + dicts), 'T5 aucun montant écrit en dur dans la page ni ses textes');
    dit(/ACCES_OFFERT \? <span className="vt-pastille" data-acces-offert="">\{tr\('accueil\.gratuit'\)\}/.test(tf) && /editeur === false \? <span data-paiement-ferme="">/.test(tf), 'T6 la vérité du moment : « Gratuit pour l’instant », « Le paiement n’est pas encore ouvert »');
    const ctx = {}; new Function('globalThis', 'window', lire('public/legal/editeur.js'))(ctx, undefined);
    const src = lire('src/tarifs/Tarifs.jsx');
    const k0 = src.indexOf('export function editeurComplet('), k1 = src.indexOf('\n}\n', k0);
    let editeurComplet = null;
    try { editeurComplet = new Function('return ' + src.slice(k0 + 'export '.length, k1 + 2))(); } catch (_) {}
    const plein = Object.fromEntries((ctx.VRM_EDITEUR_OBLIGATOIRES || []).map((k) => [k, 'x']));
    dit(typeof editeurComplet === 'function' && editeurComplet(ctx.VRM_EDITEUR, ctx.VRM_EDITEUR_OBLIGATOIRES) === (ctx.VRM_EDITEUR_OBLIGATOIRES || []).every((k) => ctx.VRM_EDITEUR[k] != null && String(ctx.VRM_EDITEUR[k]).trim() !== '')
      && editeurComplet(plein, ctx.VRM_EDITEUR_OBLIGATOIRES) === true && editeurComplet(null, []) === null && editeurComplet({ ...plein, siret: ' ' }, ctx.VRM_EDITEUR_OBLIGATOIRES) === false,
      'T7 « paiement ouvert ? » se lit dans le MÊME fichier que le serveur (editeur.js, chaque champ obligatoire) ; aujourd’hui : ' + (editeurComplet ? editeurComplet(ctx.VRM_EDITEUR, ctx.VRM_EDITEUR_OBLIGATOIRES) : '?'));
    dit(/\['legal\.cgv', '\/legal\/cgv\.html'\]/.test(tf) && /\['legal\.confidentialite', '\/legal\/confidentialite\.html'\]/.test(tf), 'T8 liens CGV et confidentialité');
    dit(!/<script>|dangerouslySetInnerHTML|eval\(|new Function/.test(tf) && /s\.src = '\/legal\/editeur\.js'/.test(tf), 'T9 CSP : aucun script en ligne (editeur.js est un fichier servi par VRM)');
    const vj = JSON.parse(lire('vercel.json'));
    dit(vj.rewrites.some((x) => x.source === '/tarifs' && x.destination === '/index.html') && /pageTarifs\(\)\) return <React\.Suspense/.test(lire('src/main.jsx')), 'T10 vrm.center/tarifs est servie (réécriture + route), dans un morceau à part');
    dit(lire('public/sitemap.xml').includes('https://vrm.center/tarifs') && /href="\/tarifs"/.test(lire('src/Accueil.jsx')), 'T11 la page est trouvable (plan du site, lien depuis l’accueil)');
  }

  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ accueil des nouveaux : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  ' + (e && e.stack || e)); process.exit(1); });
