// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « SUR LES SITES » DE LA FICHE ET LA SÉRIE DEPUIS ACHATS (21 nov. 2026)
//  docs/passation/2026-11-21-fiche-sites.md
//
//  Choix 5 de Julien : la fiche d'un article, une rangée par site (Vinted, Leboncoin, eBay, Vestiaire) — en ligne /
//  masquée / vendue / pas publiée / pas revue depuis N j, prix, vues, favoris, date, lien — et « Publier sur… » là où
//  elle n'est pas. Choix 7 : « N achats arrivés sans vente » dans Achats ouvre l'enchaînement achat après achat.
//  On EXÉCUTE src/ficheSites.js, src/ficheProduit.js et src/prixPartout.js (base INVENTÉE) :
//   S1  une rangée par site, dans l'ordre Vinted · Leboncoin · eBay · Vestiaire, même là où elle n'est pas ;
//   S2  « pas su » n'est jamais « pas publiée » : un site pas lu (ou la lecture en cours) ⇒ « — » + sa raison, aucun geste ;
//   S3  « Publier sur… » : seulement sur un site LU où elle n'est pas, jamais Vinted, jamais une paire vendue (n'importe
//       où), jamais deux paires sous un N°, jamais sans le geste branché ;
//   S4  « pas revue depuis N j » : les jours pleins depuis la dernière lecture du compte ; masquée, plus en ligne ;
//   S5  les nombres pas lus restent absents (jamais 0), la date = la vente pour une vendue, la mise en ligne sinon ;
//   S6  IDENTITÉ : 50 annonces Leboncoin au MÊME titre que l'article, sans référence ni lien ⇒ « pas publiée » ; la seule
//       qui porte la référence VRM du N° ⇒ « en ligne » ; le module ne lit aucun titre ;
//   S7  le branchement : `articleFiche` rend `rangeesSites`, la fiche les dessine, « Publier » ouvre « Publier ailleurs »
//       sur CE site (setPubAil), les annonces Vinted pas en ligne viennent de la fiche du N° (par identité) ;
//   S8  la série depuis Achats : la file = achats ARRIVÉS, libres (`achatDisponible`), hors retour / litige, du plus récent ;
//       la suivante n'est ouverte qu'APRÈS une écriture réussie (ou « Passer ») ; fermer arrête ; « Oui » seul relie.
//  `--mutation=<nom>|toutes` : chaque règle affaiblie doit rougir. ⚠️ Ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

// [fichier, avant, après] — chaque mutation affaiblit UNE règle.
const MUTATIONS = {
  pasSuPubliee: ['src/ficheSites.js', "const su = !lecture && !pasLus.has(site);", "const su = true;"],
  vendueAilleurs: ['src/ficheSites.js', "const peutPublier = !!o.publier && !o.double && !vendueQuelquePart;", "const peutPublier = !!o.publier && !o.double;"],
  vintedPubliable: ['src/ficheSites.js', "export const SITES_PUBLIABLES = ['leboncoin', 'ebay', 'vestiaire'];", "export const SITES_PUBLIABLES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];"],
  joursFaux: ['src/ficheSites.js', "Math.floor((maintenant - e.lu) / JOUR)", "Math.ceil((maintenant - e.lu) / JOUR)"],
  zero: ['src/ficheSites.js', "vues: num(e.vues), favoris: num(e.favoris),", "vues: num(e.vues) || 0, favoris: num(e.favoris) || 0,"],
  unSeulSite: ['src/ficheSites.js', "    if (montres && !montres.has(site) && !l.length) continue;", "    if (!l.length) continue;"],
  titre: ['src/ficheSites.js', "    if (!e || !parSite.has(e.site) || !ETATS_ENTREE.includes(e.etat)) continue;", "    if (!e || !parSite.has(e.site) || !ETATS_ENTREE.includes(e.etat)) continue; if (e.titre && o.titre && e.titre === o.titre) e = { ...e, etat: 'en-ligne' };"],
  pauseIdentite: ['src/ficheSites.js', "      if (!meme(o.numLbc(ad, id))) continue;\n", ""],
  vcPasDit: ['src/ficheSites.js', "      if (e !== 'attente' && e !== 'retiree') continue;", "      if (e === 'vendue') continue;"],
  pauseDouble: ['src/App.jsx', "if (!(x.site === 'leboncoin' && pauseLbcF.has(String(x.id)))) out.push(", "if (true) out.push("],
  serieLibre: ['src/App.jsx', "!achatHorsRelier(o, achatsHorsRelierRes) && achatDisponible(o, liensAchats)); };", "!achatHorsRelier(o, achatsHorsRelierRes)); };"],
  serieAvance: ['src/App.jsx', "    if (serieAchRef.current) { const S = serieAchRef.current; ouvrirSerieAchat({ ...S, faits: S.faits + 1 }, S.i + 1); return true; }\n", ""],
  publierSite: ['src/App.jsx', "onPublierSur={(n, site)=>setPubAil({ num: String(n), site: ['leboncoin','vestiaire','ebay'].includes(site) ? site : null })}", "onPublierSur={(n, site)=>setPubAil({ num: String(n), site: null })}"],
};

function arbre(mut) {
  if (!mut) return RACINE;
  const [f, a, b] = MUTATIONS[mut];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-fs-'));
  // On ne copie que src/ (les modules exécutés) ; le texte d'App.jsx est lu à part.
  fs.cpSync(path.join(RACINE, 'src'), path.join(dir, 'src'), { recursive: true, filter: (x) => !/node_modules/.test(x) });
  const p = path.join(dir, f), s = fs.readFileSync(p, 'utf8');
  if (!s.includes(a)) { console.log(`⚠️ mutation ${mut} : morceau introuvable`); return null; }
  fs.writeFileSync(p, s.replace(a, b));
  return dir;
}

async function lancer(R) {
  let ko = 0, n = 0;
  const dit = (ok, nom, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${!ok && d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 300) : ''}`); };
  const imp = (f) => import(pathToFileURL(path.join(R, f)).href + '?t=' + Date.now());
  const FS = await imp('src/ficheSites.js');
  const PP = await imp('src/prixPartout.js');
  const PR = await imp('src/ficheProduit.js');
  const T0 = Date.UTC(2026, 10, 21, 12);
  const J = 86400000;
  const R1 = (e, o) => FS.rangeesSitesFiche(e, { maintenant: T0, publier: true, pasLus: [], ...(o || {}) });
  const etats = (l) => l.map((r) => r.site + ':' + r.etat).join(',');

  // S1
  const vide = R1([]);
  dit(etats(vide) === 'vinted:pas-publiee,leboncoin:pas-publiee,ebay:pas-publiee,vestiaire:pas-publiee', 'S1 une rangée par site, dans l’ordre, même là où elle n’est pas', etats(vide));
  const deux = R1([{ site: 'vestiaire', etat: 'en-ligne', prix: 9000 }, { site: 'vinted', etat: 'en-ligne', prix: 8000, compte: 'a' }, { site: 'vinted', etat: 'en-ligne', prix: 8000, compte: 'b' }]);
  dit(etats(deux) === 'vinted:en-ligne,vinted:en-ligne,leboncoin:pas-publiee,ebay:pas-publiee,vestiaire:en-ligne' && deux[0].premiere && !deux[1].premiere && deux[0].n === 2, 'S1 deux comptes Vinted : deux rangées sous Vinted, la 1re marquée', etats(deux));
  const montres = R1([{ site: 'vestiaire', etat: 'vendue', date: T0 }], { montres: ['vinted'] });
  dit(etats(montres) === 'vinted:pas-publiee,vestiaire:vendue', 'S1 un site qu’il ne montre pas disparaît, sauf s’il porte une vente', etats(montres));

  // S2
  const pasLu = R1([{ site: 'vinted', etat: 'en-ligne' }], { pasLus: ['Leboncoin', 'eBay'] });
  dit(etats(pasLu) === 'vinted:en-ligne,leboncoin:pas-su,ebay:pas-su,vestiaire:pas-publiee' && pasLu[1].raison === 'pas-lu' && !pasLu[1].publier && !pasLu[2].publier, 'S2 un site pas lu ⇒ « — pas lu », jamais « pas publiée », aucun geste', pasLu.map((r) => [r.site, r.etat, r.raison, r.publier]));
  const enCours = FS.rangeesSitesFiche([{ site: 'vinted', etat: 'vendue', date: T0 }], { maintenant: T0, publier: true, pasLus: undefined });
  dit(enCours.slice(1).every((r) => r.etat === 'pas-su' && r.raison === 'lecture' && !r.publier) && enCours[0].etat === 'vendue', 'S2 lecture en cours ⇒ « — » partout où rien n’est lu, la vente lue reste dite', etats(enCours));

  // S3
  dit(vide.filter((r) => r.publier).map((r) => r.site).join() === 'leboncoin,ebay,vestiaire', 'S3 « Publier sur… » : Leboncoin, eBay, Vestiaire — jamais Vinted', vide.map((r) => [r.site, r.publier]));
  const vendue = R1([{ site: 'leboncoin', etat: 'vendue', date: T0 }]);
  dit(vendue.every((r) => !r.publier), 'S3 vendue sur Leboncoin ⇒ aucun « Publier » nulle part', vendue.map((r) => [r.site, r.publier]));
  dit(R1([], { double: true }).every((r) => !r.publier) && R1([], { publier: false }).every((r) => !r.publier), 'S3 deux paires sous ce N°, ou geste pas branché ⇒ aucun « Publier »');
  const retiree = R1([{ site: 'leboncoin', etat: 'retiree', id: '5' }, { site: 'vinted', etat: 'en-ligne' }, { site: 'vinted', etat: 'retiree' }]);
  dit(etats(retiree) === 'vinted:en-ligne,leboncoin:retiree,ebay:pas-publiee,vestiaire:pas-publiee' && retiree[1].publier && !retiree[1].lien, 'S3 retirée de Leboncoin ⇒ « plus en ligne » + « Publier » ; une retirée à côté d’une en ligne ne redit rien', etats(retiree));

  // S4
  const vieille = R1([{ site: 'vinted', etat: 'pas-revue', lu: T0 - 3.5 * J, prix: 5000, vues: 12 }, { site: 'leboncoin', etat: 'masquee' }]);
  dit(vieille[0].etat === 'pas-revue' && vieille[0].jours === 3 && vieille[0].prix === 5000 && vieille[0].vues === 12 && vieille[1].etat === 'masquee' && !vieille[1].publier, 'S4 pas revue depuis 3 j (jours pleins), ses chiffres de la dernière lecture ; masquée ⇒ présente, pas de « Publier »', vieille.slice(0, 2));
  dit(R1([{ site: 'vinted', etat: 'pas-revue' }])[0].jours === null && R1([{ site: 'vinted', etat: 'pas-revue', lu: T0 + J }])[0].jours === null, 'S4 lecture pas datée (ou dans le futur) ⇒ jours inconnus, jamais inventés');

  // S5
  const nombres = R1([{ site: 'vinted', etat: 'en-ligne', prix: null, creeLe: T0 - 9 * J, lien: 'https://www.vinted.fr/items/1' }, { site: 'ebay', etat: 'vendue', date: T0 - J, depuis: T0 - 20 * J, lien: 'https://www.ebay.fr/itm/2' }]);
  dit(nombres[0].vues === null && nombres[0].favoris === null && nombres[0].prix === null, 'S5 un nombre pas lu reste absent (jamais 0)', nombres[0]);
  dit(nombres[0].date === T0 - 9 * J && nombres[0].dateSorte === 'mise' && nombres[2].date === T0 - J && nombres[2].dateSorte === 'vente' && !nombres[2].lien && nombres[0].lien, 'S5 la date : mise en ligne lue, ou la vente ; une vendue n’ouvre pas d’annonce', [nombres[0], nombres[2]]);

  // S6 IDENTITÉ — 50 annonces Leboncoin au même titre, une seule porte la référence du N°.
  const TITRE = 'adidas spezial noir taille 38';
  const lbcItems = {};
  for (let i = 0; i < 50; i++) lbcItems[String(3000000000 + i)] = { status: 'active', subject: TITRE, price: 60, ref: '', url: '' };
  const numLbc = (ad) => { const m = /^VRM-(\w+)$/.exec(String(ad.ref || '')); return m ? m[1] : ''; };   // la référence posée, jamais le titre
  const cleNum = (v) => String(v == null ? '' : v).trim().toUpperCase().replace(/^0+(?=\d)/, '');
  const rn = { annonces: [], annoncesEbay: [], manques: [] };
  const sansRef = PP.sitesDuNumero('12', { rn, fiches: {}, lbcItems, vcItems: {} }, { cleNum, numLbc });
  const rSans = R1(sansRef.sites.map((x) => ({ ...x, etat: 'en-ligne', prix: x.prix != null ? Math.round(x.prix * 100) : null, titre: x.titre })), { titre: TITRE });
  dit(sansRef.sites.length === 0 && rSans.find((r) => r.site === 'leboncoin').etat === 'pas-publiee', 'S6 50 annonces au même titre, sans référence ⇒ aucune n’est l’article : « pas publiée »', { n: sansRef.sites.length });
  const avec = { ...lbcItems, '3000000049': { ...lbcItems['3000000049'], ref: 'VRM-12' } };
  const avecRef = PP.sitesDuNumero('12', { rn, fiches: {}, lbcItems: avec, vcItems: {} }, { cleNum, numLbc });
  const rAvec = R1(avecRef.sites.map((x) => ({ ...x, etat: 'en-ligne', prix: x.prix != null ? Math.round(x.prix * 100) : null })));
  dit(avecRef.sites.length === 1 && avecRef.sites[0].id === '3000000049' && rAvec.filter((r) => r.site === 'leboncoin').length === 1 && rAvec.find((r) => r.site === 'leboncoin').etat === 'en-ligne', 'S6 la seule qui porte « VRM-12 » ⇒ « en ligne », une rangée, la bonne annonce', avecRef.sites.map((x) => x.id));
  // Une entrée qui porterait le MÊME titre qu'un article ne change rien : le module ne compare aucun titre.
  const piege = R1([{ site: 'leboncoin', etat: 'retiree', titre: TITRE }], { titre: TITRE });
  dit(piege.find((r) => r.site === 'leboncoin').etat === 'retiree', 'S6 le même titre ne fait jamais « en ligne »', etats(piege));
  const srcFS = fs.readFileSync(path.join(R, 'src/ficheSites.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
  dit(!/\.(titre|title|subject)\b/.test(srcFS), 'S6 src/ficheSites.js ne lit aucun titre');

  // S9 (22 nov., ext. 5.435, choix 2a) LEBONCOIN EN PAUSE, VESTIAIRE HORS LIGNE : leur propre rangée, par la MÊME identité.
  if (typeof FS.annoncesHorsLigneAutresSites !== 'function') dit(false, 'S9 annoncesHorsLigneAutresSites existe');
  else {
    const lbcP = {};
    for (let i = 0; i < 50; i++) lbcP[String(4000000000 + i)] = { status: 'paused', subject: TITRE, price: 55, ref: '', url: '' };
    const vcP = {};
    for (let i = 0; i < 50; i++) vcP[String(70000 + i)] = { statut: 'unpublished', titre: TITRE, prix: { valeur: 90 } };
    const etatLbc = (ad) => (/pause/i.test(String(ad.status)) || ad.pauseAt ? 'pause' : /active/i.test(String(ad.status)) ? 'active' : 'inconnu');
    const etatVc = (it) => (/sold/i.test(String(it.statut)) ? 'vendue' : /refus/i.test(String(it.statut)) ? 'refusee' : /waiting_picture/i.test(String(it.statut)) ? 'corriger' : /pending|review/i.test(String(it.statut)) ? 'attente' : /unpublish|delet|archiv/i.test(String(it.statut)) ? 'retiree' : /online|published/i.test(String(it.statut)) ? 'en-ligne' : 'autre');
    const numVc = (id, it) => { const m = /^VRM-(\w+)$/.exec(String(it.ref || '')); return m ? m[1] : ''; };
    const o9 = { cleNum, numLbc, numVc, etatLbc, etatVc };
    const sans = FS.annoncesHorsLigneAutresSites('12', { lbcItems: lbcP, vcItems: vcP }, o9);
    dit(sans.length === 0, 'S9 50 annonces Leboncoin en pause et 50 Vestiaire hors ligne au MÊME titre, sans identité ⇒ aucune n’est l’article', sans.length);
    const lbc2 = { ...lbcP, '4000000007': { ...lbcP['4000000007'], ref: 'VRM-12', stats: { favoris: 3 }, publieeLe: '2026-11-01T10:00:00Z' } };
    const vc2 = { ...vcP, '70011': { ...vcP['70011'], ref: 'VRM-12' }, '70012': { statut: 'pending_review', ref: 'VRM-12', prix: 80 }, '70013': { statut: 'deleted', ref: 'VRM-12' }, '70014': { statut: 'sold', ref: 'VRM-12' }, '70015': { statut: '', ref: 'VRM-12' }, '70016': { statut: 'refused', ref: 'VRM-12' }, '70017': { statut: 'waiting_picture', ref: 'VRM-12' } };
    const avec9 = FS.annoncesHorsLigneAutresSites('12', { lbcItems: lbc2, vcItems: vc2 }, o9);
    const de9 = (id) => avec9.find((x) => x.id === id);
    dit(de9('4000000007') && de9('4000000007').etat === 'en-pause' && de9('4000000007').site === 'leboncoin' && de9('4000000007').prix === 5500 && de9('4000000007').favoris === 3 && /^https:\/\/www\.leboncoin\.fr\//.test(de9('4000000007').lien), 'S9 la seule annonce Leboncoin qui porte « VRM-12 » ⇒ « en pause », son prix, ses favoris, son lien', de9('4000000007'));
    dit(de9('70011') && de9('70011').etat === 'hors-ligne', 'S9 Vestiaire dépubliée ⇒ « hors ligne »', de9('70011'));
    // (22 nov., annulées + validation Vestiaire) la modération garde SON état, distinct de « hors ligne ».
    dit(de9('70012') && de9('70012').etat === 'attente' && de9('70012').prix === 8000 && /^https:\/\/fr\.vestiairecollective\.com\//.test(de9('70012').lien) && de9('70016') && de9('70016').etat === 'refusee' && de9('70017') && de9('70017').etat === 'corriger', 'S9 Vestiaire en attente de validation / refusée / à corriger ⇒ ces états-là (pas « hors ligne »)', [de9('70012'), de9('70016'), de9('70017')]);
    dit(de9('70013') && de9('70013').etat === 'retiree' && !de9('70013').lien && !de9('70014') && !de9('70015'), 'S9 supprimée ⇒ « plus en ligne » ; vendue ou état pas dit ⇒ aucune rangée (pas su ≠ hors ligne)', avec9.map((x) => x.id + ':' + x.etat));
    dit(avec9.length === 6, 'S9 rien d’autre', avec9.map((x) => x.id));
    dit(FS.annoncesHorsLigneAutresSites('12', { lbcItems: null, vcItems: null }, o9).length === 0, 'S9 sites pas lus ⇒ rien (jamais « pas publiée » tiré de là)');
    const r9 = R1(avec9.concat([{ site: 'vinted', etat: 'en-ligne' }]));
    const L9 = r9.find((r) => r.site === 'leboncoin'), V9 = r9.filter((r) => r.site === 'vestiaire');
    dit(L9 && L9.etat === 'en-pause' && !L9.publier && V9.length === 4 && V9.every((r) => ['hors-ligne', 'attente', 'refusee', 'corriger'].includes(r.etat) && !r.publier) && V9[0].etat === 'corriger', 'S9 la fiche : sa rangée « en pause » / « hors ligne », et pas « Publier » (elle y est encore)', etats(r9));
  }
  const srcApp9 = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  dit(/for \(const x of annoncesHorsLigneAutresSitesFiche\(numF, ex\)\)/.test(srcApp9) && /numLbc: \(ad, id\) => numeroLbcIdentite\(\{ itemId: id \}, \{ \[id\]: ad \}, load\('vrm_lbc_liens', \{\}\) \|\| \{\}\),\n  numVc: \(id, it\) => numeroVcIdentite\(id, it, extra \? extra\.vcLiens : null\),\n  etatLbc/.test(srcApp9), 'S9 branché dans la fiche (sitesAutresFiche) avec les identités de la règle du prix', '');
  dit(/!\(x\.site === 'leboncoin' && pauseLbcF\.has\(String\(x\.id\)\)\)/.test(srcApp9), 'S9 une annonce Leboncoin mise en pause par VRM n’est pas aussi « en ligne » (une rangée, pas deux)');

  // S7 le branchement
  const p = { num: '12', titre: 'Paire', etat: 'trouve', etapes: [], manques: [], resume: {} };
  const A = PR.articleFiche(p, { sites: [{ site: 'vinted', etat: 'en-ligne', prix: 5000, id: '1' }], sitesAutres: [{ site: 'vinted', etat: 'masquee', id: '2' }], sitesPasLus: ['eBay'], peutPublier: true, maintenant: T0 });
  dit(A && Array.isArray(A.rangeesSites) && etats(A.rangeesSites) === 'vinted:en-ligne,vinted:masquee,leboncoin:pas-publiee,ebay:pas-su,vestiaire:pas-publiee' && A.sites.length === 1,
    'S7 `articleFiche` rend les rangées ; les annonces pas en ligne restent hors des règles d’au-dessus', A && etats(A.rangeesSites || []));
  const fiche = fs.readFileSync(path.join(R, 'src/natif/ecrans/Fiche.jsx'), 'utf8');
  dit(/A\.rangeesSites/.test(fiche) && /data-fiche-publier-sur=|'data-fiche-publier-sur'/.test(fiche) && /publierSur\(s\.site\)/.test(fiche), 'S7 la fiche dessine les rangées et « Publier » appelle le geste de CE site');
  const app = require('./_source-app.cjs').sourceApp(R === RACINE ? undefined : R);
  dit(app.includes("onPublierSur={(n, site)=>setPubAil({ num: String(n), site: ['leboncoin','vestiaire','ebay'].includes(site) ? site : null })}"), 'S7 « Publier sur… » ouvre « Publier ailleurs » sur CE site (le parcours existant, rien ne part seul)');
  dit(/const sitesAutresFiche = \(\(\) => \{[\s\S]{0,600}for \(const a of \(rn\.annonces \|\| \[\]\)\)/.test(app), 'S7 les annonces Vinted pas en ligne viennent de la fiche du N° (`rn.annonces`, par identité)');

  // S8 la série depuis Achats
  const lib = /const achatLibreSerie = \(o\) => \{([\s\S]{0,400}?)\};/.exec(app);
  dit(!!lib && /st\.step === 4/.test(lib[1]) && /!st\.retour/.test(lib[1]) && /!achatHorsRelier\(o, achatsHorsRelierRes\)/.test(lib[1]) && /achatDisponible\(o, liensAchats\)/.test(lib[1]), 'S8 la file : arrivés, hors retour / litige, encore libres (un lot jusqu’à son nombre)', lib && lib[1]);
  dit(/const achatsArrivesSansVente = \(\) => ordreRecent\(/.test(app), 'S8 du plus récent au plus ancien (la règle unique `ordreRecent`)');
  const rel = /const relierDepuisArticle = async \(x\) => \{([\s\S]{0,900}?)\n  \};/.exec(app);
  const corps = rel ? rel[1] : '';
  const iOk = corps.indexOf('if (!ok) return false;'), iSerie = corps.indexOf('ouvrirSerieAchat(');
  dit(iOk >= 0 && iSerie > iOk && corps.indexOf('avant.relies + 1 < avant.n') < iSerie, 'S8 l’achat suivant s’ouvre seulement APRÈS une écriture réussie, et un lot pas complet reste ouvert', corps.slice(0, 200));
  dit(/useEffect\(\(\) => \{ if \(!relierDepuis && serieAchRef\.current\) \{ serieAchRef\.current = null; setSerieAch\(null\); \} \}, \[relierDepuis\]\);/.test(app), 'S8 fermer la feuille arrête la série');
  dit(/serie=\{serieAch && relierDepuis\.serie \? \{ i: serieAch\.i, n: serieAch\.liste\.length, onPasser: passerSerieAchat \} : null\}/.test(app) && /data-achats-serie=\{n\} onClick=\{lancerSerieAchats\}/.test(app) && /if \(n < 2\) return null;/.test(app),
    'S8 « N achats arrivés sans vente » (plusieurs) lance la série ; « 3 sur 18 · Passer » dans la feuille');
  const grille = fs.readFileSync(path.join(R, 'src/natif/ecrans/LierArticleGrille.jsx'), 'utf8');
  dit(/<TeteSerie serie=\{serie\}\/>/.test(grille) && (grille.match(/onRelier\(/g) || []).length === 1 && /data-la-oui="" disabled=\{envoi\} onClick=\{relier\}/.test(grille), 'S8 la feuille : la tête de série, et `onRelier` appelé par « Oui » seulement');
  console.log(`\n${n - ko}/${n} vert(s)${ko ? `, ${ko} rouge(s)` : ''}`);
  return ko;
}

(async () => {
  if (MUT) {
    const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
    let rougies = 0;
    for (const m of noms) {
      const R = arbre(m); if (!R) continue;
      const r = spawnSync(process.execPath, [__filename, '--arbre=' + R], { encoding: 'utf8' });
      const ko = r.status !== 0; if (ko) rougies++;
      console.log(`${ko ? '✅' : '❌'} mutation ${m} : ${ko ? 'rougit' : 'RESTE VERTE'}`);
      fs.rmSync(R, { recursive: true, force: true });
    }
    console.log(`\n${rougies}/${noms.length} mutations rougissent`);
    process.exit(rougies === noms.length ? 0 : 1);
  }
  const R = (process.argv.find((a) => a.startsWith('--arbre=')) || '').slice(8) || RACINE;
  const ko = await lancer(R).catch((e) => { console.log('❌ ' + (e && e.stack || e)); return 1; });
  process.exit(ko ? 1 : 0);
})();
