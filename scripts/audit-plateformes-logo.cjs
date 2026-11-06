#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — PLATEFORMES : LOGOS, COMPTE DE LA VENTE, PUBLIER AILLEURS, FILTRES
//  D'ACHAT (5 nov.)       node scripts/audit-plateformes-logo.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien, 5 nov. : « les mêmes onglets que Vinted pour Leboncoin, eBay et
// Vestiaire, séparés par le logo » ; « le compte sur lequel l'article a été
// vendu doit apparaître » ; « Vinted → Leboncoin, Vestiaire, eBay : beaucoup
// plus accompagné, pro, pointilleux et fiable » ; « relier un achat… par prix,
// par date de reçu ». Ce que cet audit tient :
//   A. src/plateformes.js — quatre sites, même ordre, un logo servi localement
//      chacun ; le sélecteur montre « Tous » seulement si demandé ; le compte
//      d'une vente vient de SON identité (jamais deviné : rien ⇒ '') ;
//   B. src/publierAilleurs.js — « vue en ligne » seulement par identité ; « pas
//      su » ≠ « à publier » ; un manque bloquant arrête l'étape « Publier » ; la
//      référence/SKU porte le N° ; le parcours n'envoie RIEN (ni vmrCmd, ni
//      appel eBay) et ne réintroduit pas l'agent eBay ;
//   C. src/suggestionsAchat.js — filtres prix / date de réception / marque /
//      taille ; une réception pas lue n'est pas gardée sous un filtre de date et
//      est COMPTÉE à part ;
//   D. src/App.jsx — un seul sélecteur (`SelecteurSites`) pour les quatre
//      rangées de sites, plus aucune rangée écrite à la main ; chaque liste de
//      ventes (Vinted, Leboncoin, eBay, Vestiaire, « Tous ») passe `compte`.
// --prouve : chaque mutation DOIT rougir.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'logo-manquant': ['src/plateformes.js', "{ id: 'vestiaire', nom: 'Vestiaire', logo: '/brands/vestiaire.svg' }", "{ id: 'vestiaire', nom: 'Vestiaire', logo: '' }"],
  'tous-partout': ['src/plateformes.js', "const out = toutes ? [{ id: 'toutes'", "const out = true ? [{ id: 'toutes'"],
  'compte-devine': ['src/plateformes.js', "  const id = identiteCompteVente(site, vente);\n  if (!id) return '';", "  const id = identiteCompteVente(site, vente) || 'principal';"],
  'lbc-prefixe': ['src/plateformes.js', ".replace(/^lbc-account:/i, '')", ''],
  'en-ligne-sans-identite': ['src/publierAilleurs.js', "if (sitesVus.some((s) => s && s.site === site)) return true;", "if (sitesVus.length) return true;"],
  'passu-a-publier': ['src/publierAilleurs.js', "if (enLigne === null || marquee === null) return 'pas-su';", ''],
  'bloquant-ignore': ['src/publierAilleurs.js', "if (arr(manques).some((m) => m && m.bloque)) return 'verifier';", ''],
  'sans-numero': ['src/publierAilleurs.js', "if (!ap.num) out.push({ code: 'numero'", "if (false) out.push({ code: 'numero'"],
  'ref-sans-numero': ['src/publierAilleurs.js', "export const refVrm = (num) => (str(num) ? 'VRM-' + str(num) : '');", "export const refVrm = (num) => 'VRM-' + str(num);"],
  'titre-avant-numero': ['src/publierAilleurs.js', "  if (exact.length) return exact;\n", ''],
  'reception-passu-gardee': ['src/suggestionsAchat.js', "if (r == null || !Number.isFinite(Number(r))) { sansReception++; continue; }", "if (r == null || !Number.isFinite(Number(r))) { out.push({ a, d: Number.isFinite(d) ? d : -Infinity }); continue; }"],
  'prix-ignore': ['src/suggestionsAchat.js', "if ((pMin != null && px < pMin) || (pMax != null && px > pMax)) continue;", ''],
  'taille-ignoree': ['src/suggestionsAchat.js', "if (tq && tailleDuTitre(String(a.title || '')) !== tq) continue;", ''],
  'rangee-a-la-main': ['src/App.jsx', "return <SelecteurSites id={tache}", "return <div className=\"vrm-rangee vrm-filtres vrm-filtre-site\" data-filtre-site={tache}/>; <SelecteurSites id={tache}"],
  'compte-lbc-oublie': ['src/App.jsx', 'titre={titre} sous={sous} compte={compte} ton={ton} montant={lbcEuro(o.price)}', 'titre={titre} sous={sous} ton={ton} montant={lbcEuro(o.price)}'],
  'compte-vc-oublie': ['src/App.jsx', "<LigneVenteCompacte compte={nomCompteVente('vestiaire', v, {}) || undefined} className=\"vrm-sale-row\"", '<LigneVenteCompacte className="vrm-sale-row"'],
  // (intégration lot 1) UNE règle : `compteVenteLbc`/`compteVenteEbay` passent par l'identité de src/plateformes.js,
  // « non fourni » ('' de l'ancienne convention) n'écrit rien, le compte n'est jamais recopié dans `sous`.
  'vide-dit-non-releve': ['src/App.jsx', "const compteFourni = (compte) => compte !== undefined && compte !== '';", "const compteFourni = (compte) => compte !== undefined;"],
  'compte-voisin-lbc': ['src/App.jsx', "if (ann && ann.accountName && idAnn === id) return", "if (ann && ann.accountName) return"],
  'ebay-sans-identite': ['src/App.jsx', "  const ref = identiteCompteVente('ebay', o);\n  if (!ref) return null;", "  const ref = (o && o._compte) || (Array.isArray(comptes) && comptes[0] && comptes[0].ref);\n  if (!ref) return null;"],
  'compte-dans-sous': ['src/App.jsx', "compte={compteVenteEbay(o, comptesEbay)} sous={o.creationDate", "compte={compteVenteEbay(o, comptesEbay)} sous={(o._pseudo ? o._pseudo + ' · ' : '') + o.creationDate"],
  'ebay-publie-prepare': ['src/publierAilleurs.js', "const marquee = site === 'ebay' ? !!(publiesEbay && typeof publiesEbay.has === 'function' && publiesEbay.has(id))", "const marquee = site === 'ebay' ? false"],
  'hors-vinted-ignore': ['src/publierAilleurs.js', "if (site === 'leboncoin' && horsVinted === true) out.push(", "if (false) out.push("],
  'hors-vinted-pas-passe': ['src/App.jsx', ", horsVinted: paire.chezMoi === true }", " }"],
  'reception-pas-lue-ici': ['src/App.jsx', "if (!besoinInfosRelier || !pickerFor", "if (true || !besoinInfosRelier || !pickerFor"],
  'date-filtre-pendant-lecture': ['src/App.jsx', "recuDu: dateEnAttente ? '' : recuDu, recuAu: dateEnAttente ? '' : recuAu", "recuDu, recuAu"],
  'lbc-demande-muette': ['src/App.jsx', "    else toast('Cet article n’est pas dans ta file « À publier » Leboncoin", "    else void ('Cet article n’est pas dans ta file « À publier » Leboncoin"],
  'vc-id-tronque': ['src/plateformes.js', "return id === '-' ? '' : `n° ${id}`;", "return id === '-' ? '' : `n° ${id.slice(0, 8)}`;"],
  'vc-texte-brut': ['src/publierAilleurs.js', "const description = typeof r.descriptionLbc === 'function' ? str(r.descriptionLbc({ ref, texte: x.desc, marque: x.marque, taille: x.taille, etat: x.etat, couleur: x.couleur })) : str(x.desc);\n    return { ...base, titre, description, identite: ref ? { quoi: 'Référence'", "const description = str(x.desc);\n    return { ...base, titre, description, identite: ref ? { quoi: 'Référence'"],
  'ebay-titre-brut': ['src/publierAilleurs.js', "const titre = typeof r.titreEbay === 'function' ? str(r.titreEbay(x.title, x.taille)) : str(x.title);", "const titre = str(x.title);"],
  'parcours-envoie': ['src/App.jsx', "    if (sx === 'leboncoin') { DEMANDE_LBC_FICHE.id = id;", "    if (sx === 'leboncoin') { vmrCmd({ cmd: 'lbcPublier', id }); DEMANDE_LBC_FICHE.id = id;"],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'plat-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  const [fic, de, vers] = MUTS[MUT];
  const f = path.join(d, fic); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(de, vers)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const P = await import(path.join(SRC, 'plateformes.js'));
  const PA = await import(path.join(SRC, 'publierAilleurs.js'));
  const SA = await import(path.join(SRC, 'suggestionsAchat.js'));
  const APP = sansCommentaires(fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8'));

  // ── A. Les plateformes ──
  dit(P.IDS_PLATEFORMES.join() === 'vinted,leboncoin,ebay,vestiaire', 'A1 quatre sites, l’ordre de Vinted', P.IDS_PLATEFORMES.join());
  dit(P.PLATEFORMES.every((p) => /^\/brands\/[a-z]+\.svg$/.test(p.logo) && fs.existsSync(path.join(R, 'public', p.logo))), 'A2 un logo servi localement par site (public/brands/)', JSON.stringify(P.PLATEFORMES.map((p) => p.logo)));
  dit(P.ONGLETS_PLATEFORME.join() === 'annonces,ventes,achats,messages,colis', 'A3 les mêmes onglets pour chaque site');
  dit(P.IDS_PLATEFORMES.filter((s) => s !== 'vinted').every((s) => P.ONGLETS_PLATEFORME.every((o) => { const m = P.ongletSansDonnee(s, o); return m && m.manque && m.geste; })), 'A4 chaque onglet sans donnée dit ce qui manque ET le geste');
  const o1 = P.optionsSelecteur({ site: 'vinted', sites: new Set(['vinted', 'vestiaire']), toutes: false });
  const o2 = P.optionsSelecteur({ site: 'ebay', sites: new Set(['vinted']), toutes: true });
  dit(o1.map((o) => o.id).join() === 'vinted,vestiaire', 'A5 le sélecteur : les sites présents, sans « Tous » si l’écran ne l’a pas', o1.map((o) => o.id).join());
  dit(o2.map((o) => o.id).join() === 'toutes,vinted,ebay' && !o2[0].logo && o2.slice(1).every((o) => o.logo), 'A6 « Tous » en tête quand demandé, le site choisi toujours montré', o2.map((o) => o.id).join());
  const ann = { leboncoin: P.annuaireLbc({ 'lbc-account:8442': { id: 'lbc-account:8442', name: 'atelier' }, 'faf3': { id: 'faf3' } }), ebay: { cle1: 'shop_ebay' } };
  dit(P.nomCompteVente('leboncoin', { account: '8442' }, ann) === 'atelier' && P.nomCompteVente('leboncoin', { account: 'lbc-account:8442' }, ann) === 'atelier', 'A7 Leboncoin : « lbc-account:ID » = ID, le nom tel que lu');
  dit(P.nomCompteVente('leboncoin', { account: 'faf3' }, ann) === 'n° faf3', 'A8 un compte sans nom lu ⇒ son identifiant, jamais un nom deviné');
  dit(P.nomCompteVente('leboncoin', {}, ann) === '' && P.nomCompteVente('vestiaire', {}, {}) === '', 'A9 aucune identité ⇒ rien d’écrit (pas « compte principal »)');
  dit(P.nomCompteVente('ebay', { orderId: 'O1', _compte: 'cle1' }, ann) === 'shop_ebay' && P.nomCompteVente('ebay', { orderId: 'O2' }, {}) === 'Compte principal', 'A10 eBay : la référence de la ligne de commandes (absente = principal)');
  dit(P.nomCompteVente('vinted', { _acc: { vinted_user_id: 111, login: 'camille' } }, { vinted: {} }) === 'camille', 'A11 Vinted : le compte qui a lu la vente');

  // ── B. Publier ailleurs ──
  const paire = { id: '9001', num: '42', title: 'Nike Air Max 90 taille 42', marque: 'Nike', taille: '42', etat: 'Très bon état', photos: ['https://img/a.jpg', 'https://img/b.jpg', 'https://img/c.jpg'], desc: 'Très propre', prix: 80 };
  const ap = PA.apercuEnvoi('leboncoin', paire, { titreLbc: (m, t, ta) => 'T:' + t, descriptionLbc: (o) => '📦 Réf. ' + o.ref + '\n' + o.texte });
  dit(ap.ref === 'VRM-42' && ap.identite && ap.identite.valeur === 'VRM-42' && /VRM-42/.test(ap.description) && ap.titre === 'T:' + paire.title, 'B1 Leboncoin : la règle de titre et de description de l’app, la référence porte le N°');
  const apE = PA.apercuEnvoi('ebay', paire, {});
  dit(apE.identite.quoi === 'SKU' && apE.identite.valeur === 'VRM-42', 'B2 eBay : le SKU VRM-{n°}');
  dit(PA.refVrm('') === '' && PA.apercuEnvoi('vestiaire', { ...paire, num: '' }).identite === null, 'B3 sans N°, aucune référence (rien ne part sans identité)');
  const mSans = PA.manquesEnvoi('leboncoin', PA.apercuEnvoi('leboncoin', { ...paire, num: '' }), {});
  dit(mSans.some((m) => m.code === 'numero' && m.bloque), 'B4 pas de N° ⇒ manque bloquant', JSON.stringify(mSans));
  dit(PA.manquesEnvoi('leboncoin', ap, { mpLbc: false }).some((m) => m.code === 'retire' && m.bloque), 'B5 retiré de Leboncoin par son choix ⇒ dit, jamais remis tout seul');
  dit(PA.manquesEnvoi('ebay', PA.apercuEnvoi('ebay', { ...paire, photos: [] }), {}).some((m) => m.code === 'photos' && m.bloque), 'B6 aucune photo ⇒ bloquant');
  dit(PA.manquesEnvoi('ebay', PA.apercuEnvoi('ebay', paire), { achat: 100 }).some((m) => m.code === 'prix' && !m.bloque), 'B7 sous le prix d’achat : dit, pas bloquant (la vérification de l’app)');
  const vus = [{ site: 'vinted', lien: 'v' }, { site: 'leboncoin', lien: 'https://www.leboncoin.fr/ad/1' }];
  dit(PA.enLigneSur('leboncoin', vus, []) === true && PA.enLigneSur('vestiaire', vus, []) === false && PA.enLigneSur('vestiaire', vus, ['Vestiaire']) === null && PA.enLigneSur('ebay', null, []) === null, 'B8 « vue en ligne » : seulement le site où CE N° est vu (identité) ; liste pas lue ⇒ pas su');
  const T = Date.now();
  dit(PA.etatPublication({ enLigne: null, job: null, marquee: false }) === 'pas-su', 'B9 « pas su » ne vaut pas « à publier »');
  dit(PA.etatPublication({ enLigne: false, job: null, marquee: false }) === 'a-publier', 'B10 lu, pas vu, rien en cours ⇒ à publier');
  dit(PA.etatPublication({ enLigne: false, job: { etape: 'depot', at: T - 60000 }, maintenant: T }) === 'preparee' && PA.etatPublication({ enLigne: false, job: { etape: 'depot', at: T - 3600e3 }, maintenant: T }) === 'a-publier', 'B11 dépôt en cours < 30 min ⇒ préparée ; vieux ⇒ plus préparée');
  dit(PA.etatPublication({ enLigne: false, job: { etape: 'fait' } }) === 'publiee' && PA.etatPublication({ enLigne: true, job: null }) === 'vue-en-ligne', 'B12 fait ⇒ publiée ; vue par identité ⇒ vue en ligne');
  dit(PA.etapeCourante('a-publier', [{ code: 'numero', bloque: true }]) === 'verifier' && PA.etapeCourante('a-publier', [{ code: 'prix', bloque: false }]) === 'publier', 'B13 un manque bloquant arrête à « Vérifier »');
  const e = PA.etatsPaire(paire, { sitesVus: vus, manquesLecture: [], jobs: { 'vc:9001': { etape: 'fait' } }, postes: { leboncoin: new Set(), vestiaire: new Set() }, brouillonsEbay: new Set(['9001']) });
  dit(e.leboncoin === 'vue-en-ligne' && e.vestiaire === 'publiee' && e.ebay === 'preparee', 'B14 l’état de chaque site, chacun par sa source', JSON.stringify(e));
  const e2 = PA.etatsPaire(paire, { sitesVus: vus, manquesLecture: [], jobs: {}, postes: { leboncoin: new Set(), vestiaire: new Set() }, brouillonsEbay: new Set(), publiesEbay: new Set(['9001']) });
  dit(e2.ebay === 'publiee', 'B21 un brouillon eBay MIS EN LIGNE (programme.itemId) ⇒ « publiée », jamais « préparée »', JSON.stringify(e2));
  const apL = PA.apercuEnvoi('leboncoin', { id: '9', num: '15', title: 'T', photos: ['p'], prix: 40 }, {});
  const mH = PA.manquesEnvoi('leboncoin', apL, { horsVinted: true }), mV = PA.manquesEnvoi('vestiaire', PA.apercuEnvoi('vestiaire', { id: '9', num: '15', title: 'T', photos: ['p'], prix: 40 }, {}), { horsVinted: true });
  dit(mH.some((m) => m.code === 'hors-vinted' && m.bloque && /VRM-15/.test(m.geste)) && !mV.some((m) => m.code === 'hors-vinted'), 'B22 plus en ligne sur Vinted ⇒ Leboncoin BLOQUÉ et le geste dit (la file Leboncoin part d’une annonce Vinted en ligne) ; Vestiaire non concerné', JSON.stringify(mH));
  const regles = { titreLbc: (m, t) => 'LBC:' + t, titreVc: (m, t) => 'VC80:' + t, titreEbay: (t, ta) => 'EB:' + t + ' taille ' + ta, descriptionLbc: (o) => '📦 Réf. ' + o.ref + '\n' + o.texte, descriptionEbay: (pp) => pp.desc || 'faits' };
  const pv = { id: '9', num: '21', title: 'Nike Dunk', taille: '42', desc: 'Texte Vinted', photos: ['p'], prix: 50 };
  const aV = PA.apercuEnvoi('vestiaire', pv, regles), aE = PA.apercuEnvoi('ebay', { ...pv, desc: '' }, regles);
  dit(/VRM-21/.test(aV.description) && aV.titre === 'VC80:Nike Dunk' && aE.titre === 'EB:Nike Dunk taille 42' && aE.description === 'faits', 'B24 « Ce qui part » = ce que le MOTEUR envoie : Vestiaire (titre 80, description avec Réf. VRM-n°), eBay (titre du formulaire, faits à défaut de description)', JSON.stringify({ aV: [aV.titre, aV.description], aE: [aE.titre, aE.description] }));
  dit(/horsVinted: paire\.chezMoi === true/.test(APP), 'B23 l’app passe « toujours chez moi » au parcours');
  dit(PA.partoutLeMeme(vus).join() === 'vinted,leboncoin', 'B15 « le même N° partout » : les sites où il est vu');
  const L = [{ id: '1', num: '42', title: 'Nike 42' }, { id: '2', num: '142', title: 'Nike 42 bis' }, { id: '3', num: '7', title: 'Adidas' }];
  dit(PA.chercherPaires(L, '42').map((p) => p.id).join() === '1', 'B16 un N° tapé désigne la paire exacte, jamais celle dont le titre le contient');
  dit(PA.chercherPaires(L, 'adidas').map((p) => p.id).join() === '3', 'B17 le titre sert seulement à chercher');
  const PAsrc = sansCommentaires(fs.readFileSync(path.join(SRC, 'publierAilleurs.js'), 'utf8')) + sansCommentaires(fs.readFileSync(path.join(SRC, 'PublierAilleurs.jsx'), 'utf8'));
  const hote = (() => { const a = APP.indexOf('function HotePublierAilleurs('); const b = APP.indexOf('\nfunction EntreePublierAilleurs(', a); return a < 0 || b < 0 ? '' : APP.slice(a, b); })();
  dit(!!hote && !/vmrCmd|appelEbay|fetch\([^)]*\/api\//.test(PAsrc + hote), 'B18 le parcours n’envoie rien : ni commande à l’extension, ni appel eBay (les moteurs existants publient)');
  dit(!/AgentEbay|agentEbay|ebay\.agent|autoPub/.test(PAsrc + hote), 'B19 l’agent eBay n’est pas réintroduit');
  dit(/DEMANDE_LBC_FICHE\.id = id/.test(hote) && /DEMANDE_EBAY_PAIRE\.id = id/.test(hote) && /DEMANDE_VC_PAIRE\.id = id/.test(hote), 'B20 « Publier » ouvre le moteur existant sur CET article (fiche Leboncoin, formulaire eBay, ligne Vestiaire)');

  // ── C. Relier un achat : les filtres ──
  const A = [
    { transaction_id: 1, title: 'Nike Air Max 90 taille 42', price: { amount: '50' }, date: '2026-10-01' },
    { transaction_id: 2, title: 'Adidas Samba 42', price: { amount: '80' }, date: '2026-10-02' },
    { transaction_id: 3, title: 'Nike Dunk 43', price: { amount: '30' }, date: '2026-10-03' },
    { transaction_id: 4, title: 'Nike Dunk 43', price: { amount: '35' }, date: '2026-10-04', status: 'Commande remboursée' },
  ];
  const rec = { 1: new Date(2026, 9, 5, 10).getTime(), 2: null, 3: new Date(2026, 9, 20, 10).getTime() };
  const mk = (t) => (/nike/i.test(t) ? 'Nike' : /adidas/i.test(t) ? 'Adidas' : null);
  const ids = (r) => r.liste.map((a) => a.transaction_id).join();
  dit(ids(SA.tousAchatsLibresDetail({ achats: A, liens: new Map(), prixMin: '40', prixMax: '90' })) === '2,1', 'C1 prix payé entre deux bornes (incluses)');
  const d = SA.tousAchatsLibresDetail({ achats: A, liens: new Map(), recuDu: '2026-10-01', recuAu: '2026-10-10', receptionDe: (a) => rec[a.transaction_id] });
  dit(ids(d) === '1' && d.sansReception === 1, 'C2 date de réception LUE ; une réception pas lue n’est pas gardée, elle est comptée à part', JSON.stringify(d));
  dit(ids(SA.tousAchatsLibresDetail({ achats: A, liens: new Map(), marque: 'nike', marqueDe: mk, taille: '42' })) === '1', 'C3 marque et taille lues du titre');
  dit(!SA.tousAchatsLibres({ achats: A, liens: new Map() }).some((a) => a.transaction_id === 4), 'C4 un achat remboursé n’est jamais proposé');
  const f = SA.filtresAchats(A, null, mk);
  dit(f.marques.join() === 'Adidas,Nike' && f.tailles.join() === '42,43', 'C5 les marques et tailles présentes, pour les filtres rapides', JSON.stringify(f));
  dit(!/\.relier|onRelier\(|save\(|fetch\(/.test(sansCommentaires(fs.readFileSync(path.join(SRC, 'suggestionsAchat.js'), 'utf8'))), 'C6 le module n’écrit rien : c’est SON tap qui relie');

  // ── D. L'app ──
  const rangees = (APP.match(/className="vrm-rangee vrm-filtres vrm-filtre-site"/g) || []).length;
  dit(rangees === 0, 'D1 plus aucune rangée de sites écrite à la main : toutes passent par SelecteurSites', String(rangees));
  dit((APP.match(/<SelecteurSites id=/g) || []).length >= 3 && /return <SelecteurSites id=\{tache\}/.test(APP), 'D2 Annonces, Ventes, Achats, Messages (FiltreSites) et les deux rangées de Colis : le même sélecteur');
  dit(/data-vente-compte=\{compte\|\|undefined\}/.test(APP) && /data-fu-compte="">· <CompteVente compte=\{compte\}/.test(APP) && /<CompteVente compte=\{compte\} plateforme=\{plateforme\} ou="ligne"\/>/.test(APP) && /Vendue sur <CompteVente compte=\{compte\}/.test(APP), 'D3 la ligne de vente porte le compte (repliée, carte Fusion, détail), écrit par UN composant (`CompteVente`)');
  dit(/sous=\{sous\} compte=\{compte\} ton=\{ton\} montant=\{(?:lbcEuro|montant)\(/.test(APP) && /compte: compteVenteLbc\(o, itemsLbc, annLbc\)/.test(APP), 'D4 Leboncoin : le compte de la transaction (ou de SON annonce), par identité');
  dit(/compte=\{compteVenteEbay\(o, comptesEbay\)\}/.test(APP) && /const ref = identiteCompteVente\('ebay', o\);/.test(APP), 'D5 eBay : le compte de la ligne de commandes (identité de src/plateformes.js)');
  dit(/<LigneVenteCompacte compte=\{nomCompteVente\('vestiaire', v, \{\}\) \|\| undefined\}/.test(APP), 'D6 Vestiaire : le compte relevé, sinon rien (jamais « non relevé » inventé)');
  dit(/compte=\{o\._acc \? \(accNameOf\(o\._acc\) \|\| null\) : null\}/.test(APP), 'D7 Vinted : le compte, même avec un seul compte (pas su ⇒ dit)');
  dit(/compte: compteVenteLbc\(v, null, annLbc\) \|\| ''/.test(APP) && /compte: compteVenteEbay\(c, null\) \|\| ''/.test(APP) && /compte: nomCompteVente\('vestiaire', v, \{\}\)/.test(APP), 'D8 « Tous les sites » : le compte de chaque vente, par les MÊMES règles que les lignes');
  // (intégration lot 1) Une seule implémentation : plus de recopie du compte dans `sous`, plus de second hook de noms.
  const ligneC = (() => { const a = APP.indexOf('function LigneVenteCompacte('); return a < 0 ? '' : APP.slice(a, a + 900); })();
  dit(!/sousBrut/.test(APP) && !/useComptesLbcNoms/.test(APP) && (APP.match(/function useAnnuaireLbc\(/g) || []).length === 1 && /const compte = compteFourni\(compteBrut\) \? compteBrut : undefined;/.test(ligneC), 'D16 une règle : le compte n’est jamais recopié dans `sous`, un seul lecteur des noms Leboncoin');
  dit(/const compteFourni = \(compte\) => compte !== undefined && compte !== '';/.test(APP), 'D17 « non fourni » (undefined, ou l’ancien \'\') n’écrit rien — jamais « compte non relevé »');
  dit(/if \(ann && ann\.accountName && idAnn === id\) return/.test(APP), 'D18 Leboncoin : le nom d’une annonce seulement si elle porte LE MÊME compte (jamais un voisin)');
  dit(!/compte=\{compteVenteEbay\(o, comptesEbay\)\} sous=\{\(o\._pseudo/.test(APP) && !/meta=\{<>\{statut\}[^\n]*_pseudo/.test(APP), 'D19 eBay : le pseudo écrit une fois (ni dans `sous`, ni dans le détail)');
  dit(/<OngletManque site=\{site\} onglet=\{t\}/.test(APP) && /<OngletManque site=\{siteColis\} onglet="colis"/.test(APP), 'D9 un site sans compte : l’onglet dit ce qui manque et le geste (tâches et Colis)');
  dit(/<EntreePublierAilleurs site="leboncoin"\/>/.test(APP) && /<EntreePublierAilleurs site="ebay"\/>/.test(APP) && /<EntreePublierAilleurs site="vestiaire"\/>/.test(APP), 'D10 « Publier ailleurs » joignable depuis Annonces · Leboncoin, eBay, Vestiaire');
  dit(/receptionDe=\{receptionAchatMs\}/.test(APP) && /const receptionAchatMs = React\.useCallback/.test(APP), 'D11 « Relier un achat » reçoit la date de réception lue (règle `dateReception`)');

  // (relecture du 5 nov.) « Relier un achat » s'ouvre depuis Ventes/Annonces : les dates de
  // réception y sont LUES à la demande (transactions des achats de la feuille), et le filtre de
  // date attend leur lecture au lieu d'écarter tout.
  const relierEff = (() => { const a = APP.indexOf('const [infosRelier, setInfosRelier]'); return a < 0 ? '' : APP.slice(a, a + 2600); })();
  dit(/if \(!besoinInfosRelier \|\| !pickerFor/.test(relierEff) && /_txn_\$\{o\.transaction_id\}/.test(relierEff) && /shipment->>status_updated_at/.test(relierEff) && /rows === null\) \{ setInfosRelier\(null\)/.test(relierEff), 'D12 les dates de réception des achats de la feuille sont lues (projection scalaire, « pas su » = null)');
  dit(/recuDu: dateEnAttente \? '' : recuDu, recuAu: dateEnAttente \? '' : recuAu/.test(APP) && /receptionEtat=\{receptionsRelierEtat\} onFiltres=/.test(APP), 'D13 pendant la lecture, le filtre de date attend (il n’écarte rien sur une lecture pas faite)');
  dit(/else toast\('Cet article n’est pas dans ta file « À publier » Leboncoin/.test(APP), 'D14 un article demandé hors de la file Leboncoin : c’est DIT, jamais un écran muet');
  dit(P.nomCompteVente('vestiaire', { compte: '1234567890' }, {}) === 'n° 1234567890', 'D15 Vestiaire : l’identifiant ENTIER (tronqué, il ressemblerait à un autre numéro)');

  console.log(`\n${ko ? '❌' : '✅'} plateformes-logo : ${ok}/${ok + ko}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
