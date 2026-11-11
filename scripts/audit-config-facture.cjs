// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — Ma facture et Ma configuration (9 nov., soir, claude/config-facture)
//  Julien : « Sur la facture, quand on remplit le SIRET, le nom, le RCS, le nom de
//  l'entreprise se remplissent automatiquement ; ça fait une animation recherche et
//  après on demande à la personne de vérifier si les infos sont bonnes. Je veux aussi
//  que ce soit pareil lorsqu'on choisit le statut de l'entreprise. » ; « la première
//  question c'est sneakers ou autre chose, fais plein de propositions » ; « ça peut
//  très bien être sur des étagères et pas dans des cartons » ; « Simple ou complet ? »
//  pas clair.
//  Exécute les VRAIES règles :
//   R  la recherche (src/entrepriseRecherche.js + api/_lib/entreprise.js) sur une
//      réponse FABRIQUÉE de la forme documentée de l'API recherche-entreprises
//      (results[].siren, nom_raison_sociale, nature_juridique, etat_administratif,
//      siege{…}, matching_etablissements[], complements.est_entrepreneur_individuel,
//      tva[]) : propositions, aucun écrasement, TVA seulement si le registre la porte,
//      jamais de RCS inventé, fermée/introuvable ⇒ rien ;
//   V  « Qu'est-ce que tu vends ? » (src/profilVendeur.js) : « paire » seulement pour
//      les sneakers SEULES ;
//   A  l'étape d'affichage : ce que chaque carte cache, la recommandation, le chemin ;
//   T  aucun « dans quel carton » (ni le N° présenté comme LE carton) dans les textes ;
//   B  le branchement : la même carte dans « Ma facture » et « Ma configuration »,
//      plus aucun remplissage silencieux.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');

async function verifier(racine, { muet = false } = {}) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (!muet || !bon) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 300) : ''}`); };
  const imp = (p) => import(pathToFileURL(path.join(racine, p)).href + '?v=' + Math.random());
  let E, S, PV, G, F;
  try {
    E = await imp('src/entrepriseRecherche.js'); S = await imp('api/_lib/entreprise.js'); PV = await imp('src/profilVendeur.js');
    G = await imp('src/configurationDepart.js'); F = await imp('src/facturePro/regle.js');
  } catch (e) { dit(false, 'les modules se chargent', e.message); return ko; }

  // ── R : la recherche ──
  const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
  const SIREN = ['812345670', '812345671', '812345672', '812345673', '812345674', '812345675', '812345676', '812345677', '812345678', '812345679'].find(luhn);
  const SIRET = (() => { for (let k = 10; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
  const FAUX = SIRET.slice(0, 13) + String((Number(SIRET[13]) + 1) % 10);
  // Le calcul de la clé, refait AUTREMENT (BigInt) : FR + (12 + 3 × (SIREN mod 97)) mod 97.
  const cle = (s) => `FR${String((12n + 3n * (BigInt(s) % 97n)) % 97n).padStart(2, '0')}${s}`;
  const TVA = cle(SIREN);
  dit(E.cleTvaIntra(SIREN) === TVA && E.cleTvaIntra('12') === '', 'R1 n° de TVA calculé depuis le SIREN (clé = (12 + 3 × (SIREN mod 97)) mod 97)', [E.cleTvaIntra(SIREN), TVA]);
  dit(F.verifierSiret(SIRET).etat === 'ok' && F.verifierSiret(FAUX).etat === 'invalide' && F.verifierSiret(SIREN).etat === 'ok', 'R2 SIRET : clé de Luhn vérifiée (un chiffre changé ⇒ refusé) ; SIREN 9 chiffres accepté');
  // Une réponse FABRIQUÉE, de la forme documentée (open-api.yml du dépôt search-api).
  const siege = { siret: SIRET, adresse: '12 RUE DE L’EXEMPLE 35000 RENNES', code_postal: '35000', libelle_commune: 'RENNES', etat_administratif: 'A', activite_principale_registre_metier: null, est_siege: true };
  const unite = (o = {}) => ({ siren: SIREN, nom_complet: 'ATELIER EXEMPLE', nom_raison_sociale: 'ATELIER EXEMPLE', nature_juridique: '5710', etat_administratif: 'A', siege, matching_etablissements: [siege], complements: { est_entrepreneur_individuel: false }, tva: [TVA], ...o });
  const api = (r) => ({ results: [{ siren: '999999999', nom_complet: 'QUI RESSEMBLE', siege: { siret: '99999999900011' } }, r], total_results: 2, page: 1, per_page: 5, total_pages: 1 });
  const lu = (r, saisi = SIRET) => S.lireReponseEntreprise(api(r), saisi);
  const sas = lu(unite());
  dit(sas && sas.etat === 'trouve' && sas.nature === '5710' && sas.ei === false && JSON.stringify(sas.tva) === JSON.stringify([TVA]) && sas.rm === false && sas.fermeUnite === false && sas.etabFerme === false, 'R3 le serveur rend ce que le registre DIT (catégorie, EI, n° de TVA actifs, RM, fermée)', sas);
  const sansTva = (() => { const u = unite(); delete u.tva; delete u.complements; const s2 = { ...siege }; delete s2.activite_principale_registre_metier; u.siege = s2; u.matching_etablissements = [s2]; return lu(u); })();
  dit(sansTva.tva === null && sansTva.ei === null && sansTva.rm === null, 'R3 un champ absent de la réponse reste « pas su » (null), jamais « aucun »', sansTva);
  const p0 = E.propositionsEntreprise(sas, {});
  const champs = p0.lignes.map((l) => l.champ);
  dit(p0.etat === 'trouve' && ['nom', 'forme', 'adresse', 'codePostal', 'ville', 'tva'].every((c) => champs.includes(c)) && p0.lignes.every((l) => l.cas === 'vide'), 'R4 fiche vide : nom, forme, adresse, code postal, ville, TVA PROPOSÉS (cas « vide »)', p0.lignes);
  const L = (p, c) => p.lignes.find((l) => l.champ === c) || {};
  dit(L(p0, 'forme').valeur === 'SAS' && L(p0, 'adresse').valeur === '12 RUE DE L’EXEMPLE' && L(p0, 'tva').valeur === TVA, 'R4 forme SAS (catégorie 5710), adresse sans le code postal, TVA = le n° calculé', [L(p0, 'forme').valeur, L(p0, 'adresse').valeur, L(p0, 'tva').valeur]);
  dit(!champs.includes('rcs') && /Kbis/.test((p0.notes.find((n) => n.cle === 'rcs') || {}).texte || ''), 'R5 immatriculation : jamais proposée (la ville du greffe n’est pas dans le registre) — la carte dit de la recopier du Kbis', p0.notes);
  const pEcart = E.propositionsEntreprise(sas, { nom: 'Mon Atelier', adresse: '12 rue de l’exemple', ville: 'Rennes' });
  dit(L(pEcart, 'nom').cas === 'ecart' && L(pEcart, 'nom').actuel === 'Mon Atelier' && L(pEcart, 'adresse').cas === 'egal' && L(pEcart, 'ville').cas === 'egal', 'R6 un champ qu’il a rempli autrement : « écart » montré ; le même (casse près) : déjà juste', pEcart.lignes.map((l) => `${l.champ}:${l.cas}`));
  dit(E.ecritureDecision(L(pEcart, 'nom'), 'ok') === null && E.ecritureDecision(L(pEcart, 'nom'), 'garder') === null && JSON.stringify(E.ecritureDecision(L(pEcart, 'nom'), 'remplacer')) === '{"nom":"ATELIER EXEMPLE"}', 'R6 un écart n’est écrit QUE sur « Remplacer » (jamais sur « C’est bon » ni « Garder la mienne »)');
  const tout = E.ecritureToutVide(pEcart.lignes);
  dit(!('nom' in tout) && !('ville' in tout) && tout.forme === 'SAS' && tout.codePostal === '35000', '« Tout est bon » ne remplit que les champs VIDES (un écart demande son geste)', tout);
  dit(E.ecritureDecision(L(p0, 'nom'), 'modifier') === null, 'R6 « Modifier » n’écrit rien (il tape lui-même)');
  const pTvaVide = E.propositionsEntreprise(lu(unite({ tva: [] })), {});
  dit(!pTvaVide.lignes.some((l) => l.champ === 'tva') && /293 B/.test((pTvaVide.notes.find((n) => n.cle === 'tva') || {}).texte || ''), 'R7 aucun n° de TVA actif au registre ⇒ rien proposé, la mention « art. 293 B » expliquée', pTvaVide.notes);
  dit(!E.propositionsEntreprise(sansTva, {}).lignes.some((l) => l.champ === 'tva'), 'R7 TVA pas dite par le registre ⇒ rien proposé');
  dit(!E.propositionsEntreprise(lu(unite({ tva: ['FR00' + SIREN.replace(/^8/, '7')] })), {}).lignes.some((l) => l.champ === 'tva'), 'R7 un n° du registre qui ne correspond pas au calcul ⇒ rien proposé');
  const ei = lu(unite({ nature_juridique: '1000', nom_raison_sociale: null, nom_complet: 'CAMILLE EXEMPLE', complements: { est_entrepreneur_individuel: true }, tva: [] }));
  const pEi = E.propositionsEntreprise(ei, {});
  dit(L(pEi, 'forme').valeur === 'EI' && L(pEi, 'nom').valeur === 'CAMILLE EXEMPLE' && E.statutProposeEntreprise(ei).statut === null && /ne le dit pas/.test(E.statutProposeEntreprise(ei).texte), 'R8 entrepreneur individuel : forme EI ; micro ou réel JAMAIS deviné', [L(pEi, 'forme').valeur, E.statutProposeEntreprise(ei)]);
  dit(E.statutProposeEntreprise(sas).statut === 'societe' && E.statutProposeEntreprise(lu(unite({ nature_juridique: '5720' }))).forme === 'SASU' && E.statutProposeEntreprise(lu(unite({ nature_juridique: '5498' }))).forme === 'EURL', 'R8 une société (5xxx) : « Société » PROPOSÉ ; SASU (5720), EURL (5498)');
  const pInc = E.propositionsEntreprise(lu(unite({ nature_juridique: '5599' })), {});
  dit(!pInc.lignes.some((l) => l.champ === 'forme') && pInc.notes.some((n) => n.cle === 'forme'), 'R8 une catégorie que la facture ne connaît pas : aucune forme devinée, dit', pInc.notes);
  const ferme = lu(unite({ etat_administratif: 'C' }));
  const etabF = lu(unite({ matching_etablissements: [{ ...siege, etat_administratif: 'F' }] }));
  dit(E.propositionsEntreprise(ferme, {}).etat === 'ferme' && E.propositionsEntreprise(ferme, {}).lignes.length === 0 && E.propositionsEntreprise(etabF, {}).etat === 'etab-ferme' && E.propositionsEntreprise(etabF, {}).lignes.length === 0, 'R9 entreprise cessée / établissement fermé ⇒ rien proposé, dit');
  dit(E.propositionsEntreprise({ etat: 'inconnu' }, {}).lignes.length === 0 && E.etatRecherche({ etat: 'passu' }) === 'passu' && E.etatRecherche(null) === 'passu', 'R9 introuvable / registre muet ⇒ rien proposé');
  const rm = E.propositionsEntreprise(lu(unite({ nature_juridique: '1000', complements: { est_entrepreneur_individuel: true }, siege: { ...siege, activite_principale_registre_metier: '9529Z' }, matching_etablissements: [{ ...siege, activite_principale_registre_metier: '9529Z' }] })), {});
  dit(/répertoire des métiers/.test((rm.notes.find((n) => n.cle === 'rcs') || {}).texte || '') && !rm.lignes.some((l) => l.champ === 'rcs'), 'R5 inscrite au répertoire des métiers : « RM » dit, aucun numéro inventé');
  const pS = E.propositionsEntreprise(sas, { siret: '' }, { avecSiret: true, saisi: SIRET });
  dit(L(pS, 'siret').valeur === SIRET && L(pS, 'siret').cas === 'vide', 'R10 « Ma configuration » : le SIRET est lui-même une ligne à valider (rien n’est écrit sans son geste)');

  // ── V : ce qu'il vend ──
  const v1 = PV.reglageJeVendsDe(['sneakers'], '', 'X'), v2 = PV.reglageJeVendsDe(['sneakers', 'livres'], '', 'X'), v3 = PV.reglageJeVendsDe(['autre'], '  Vélos  ', 'X');
  const mot = (r) => PV.motsArticle(PV.jeVendsEffectif(r, { proprietaire: false }).vend).nom;
  dit(v1.choix === 'sneakers' && mot(v1) === 'paire' && v2.choix === 'autre' && mot(v2) === 'article' && PV.champsFacultatifs(PV.jeVendsEffectif(v2, {}).vend) === true && PV.champsFacultatifs(PV.jeVendsEffectif(v1, {}).vend) === false, 'V1 « paire » (taille et marque jugées) SEULEMENT pour les sneakers seules ; sneakers + livres ⇒ « article »', [v1, v2]);
  dit(v3.autre === 'Vélos' && PV.reglageJeVendsDe([], '', 'X') === null && PV.reglageJeVendsDe(['livres'], 'pas lu', 'X').autre === undefined, 'V2 « Autre chose » garde son texte libre ; rien coché ⇒ rien à écrire', v3);
  dit(PV.lireReglageJeVends(v2).choix === 'autre' && PV.lireReglageJeVends({ choix: 'sneakers' }).choix === 'sneakers', 'V3 les lecteurs d’avant (`choix`) lisent toujours la même chose');
  dit(JSON.stringify(PV.categoriesAPreCocher({ choix: 'autre' })) === '["autre"]' && JSON.stringify(PV.categoriesAPreCocher({ choix: 'auto' })) === '[]' && JSON.stringify(PV.categoriesAPreCocher(v2)) === '["sneakers","livres"]', 'V4 pré-coché : ce qui est enregistré, jamais deviné');
  const ids = G.CHOIX_VENDS.map((c) => c.v);
  dit(['sneakers', 'vetements', 'luxe', 'sacs', 'montres', 'accessoires', 'vintage', 'enfants', 'livres', 'jeux', 'hightech', 'cartes', 'jouets', 'maison', 'sport', 'beaute', 'musique', 'autre'].every((x) => ids.includes(x)), 'V5 les 18 propositions (sneakers… autre)', ids);
  const iv = G.choixInitiaux({ jeVends: { choix: 'sneakers' } });
  dit(G.ecrituresEtape('vends', iv, iv, {}, 'X').length === 0 && G.ecrituresEtape('vends', { ...iv, vends: ['sneakers', 'vetements'] }, iv, {}, 'X')[0].valeur.choix === 'autre', 'V6 un vendeur qui a déjà choisi : rien réécrit ; il ajoute « Vêtements » ⇒ « article »');
  dit(JSON.stringify(PV.reglageJeVendsDepuisChoix(v2, 'sneakers', 'X').categories) === '["sneakers"]' && JSON.stringify(PV.reglageJeVendsDepuisChoix(v2, 'autre', 'X').categories) === '["sneakers","livres"]' && !('categories' in PV.reglageJeVendsDepuisChoix(v1, 'autre', 'X')), 'V7 Réglages → Je vends : les catégories restent d’accord avec le choix');

  // ── A : l'affichage ──
  const et = G.ETAPES_CONFIGURATION.find((e) => e.cle === 'affichage');
  const simple = G.CHOIX_AFFICHAGE.find((c) => c.v === 'simple');
  // (11 nov., lot DJ2) Les puces sont des objets { ic, t } (une icône par puce).
  const pucesS = simple.puces.map((p) => (typeof p === 'string' ? p : p.t)).join(' ');
  dit(!/Simple ou complet/.test(et.titre) && /Stock/.test(pucesS) && /Republier/.test(pucesS) && /plateformes/.test(pucesS) && /Prix à baisser/.test(pucesS), 'A1 l’étape dit ce que Simple cache, concrètement (Stock, Republier, plateformes non reliées, « Prix à baisser »)', simple.puces);
  dit(G.affichageRecommande({ proprietaire: false, nComptesVinted: 1, nVentes30j: 12 }) === 'simple' && G.affichageRecommande({ proprietaire: false, nComptesVinted: 1, nVentes30j: 30 }) === 'complet' && G.affichageRecommande({ proprietaire: false, nComptesVinted: 2, nVentes30j: 3 }) === 'complet' && G.affichageRecommande({ proprietaire: false, nComptesVinted: 1, nVentes30j: null }) === null, 'A2 « recommandé pour toi » = la règle existante (1 compte et < 30 ventes / 30 j ⇒ Simple) ; pas su ⇒ aucune recommandation');
  const reg = fs.readFileSync(path.join(racine, 'src', 'ecrans', 'Reglages.jsx'), 'utf8');
  // (11 nov., lot DJ2) « Tu pourras changer dans Paramètres » : l'écran s'appelle Paramètres (barre du bas).
  dit(G.CHEMIN_REGLAGE_AFFICHAGE === 'Paramètres → Affichage' && /\{ id:'affichage', titre:'Affichage'/.test(reg) && /id:'affichage-mode'[^\n]*lib:'Affichage'/.test(reg), 'A3 le chemin dit existe (Paramètres, groupe « Affichage »)');

  // ── T : les textes ──
  const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/\s.*$/, '')).join('\n');
  const fichiers = [];
  const parcourir = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) parcourir(p); else if (/\.(jsx?|html)$/.test(f.name)) fichiers.push(p); } };
  parcourir(path.join(racine, 'src')); if (fs.existsSync(path.join(racine, 'public', 'aide'))) parcourir(path.join(racine, 'public', 'aide'));
  const INTERDITS = [/dans quel carton/i, /écri(?:s|t|re)[^.'"`]{0,12} sur (?:le|ton|son|tes|un) carton/i, /tes cartons/i, /quel carton prendre/i, /celui que tu écris sur le carton/i, /numéro du carton/i];
  const restes = [];
  for (const f of fichiers) {
    const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
    for (const re of INTERDITS) { const m = re.exec(t); if (m) restes.push(`${path.relative(racine, f)} : « ${m[0]} »`); }
  }
  dit(restes.length === 0, 'T1 aucun texte ne présente le numéro comme « le carton » (dans quel carton, sur le carton, tes cartons…)', restes);
  const cfgTxt = G.ETAPES_CONFIGURATION.find((e) => e.cle === 'numero').sous;
  dit(/rangement/.test(cfgTxt) && /étagère/.test(cfgTxt), 'T2 « Où est ton numéro ? » : « le numéro de rangement : il dit où est l’article (carton, étagère, bac…) »', cfgTxt);

  // ── B : le branchement ──
  const fp = fs.readFileSync(path.join(racine, 'src', 'FacturePro.jsx'), 'utf8');
  const cd = fs.readFileSync(path.join(racine, 'src', 'ConfigurationDepart.jsx'), 'utf8');
  const re = fs.readFileSync(path.join(racine, 'src', 'RechercheEntreprise.jsx'), 'utf8');
  dit(/<CarteVerifEntreprise /.test(fp) && /<CarteVerifEntreprise /.test(cd) && /useRechercheEntreprise\(deps\.chercherEntreprise/.test(fp) && /useRechercheEntreprise\(entreprise\.chercherEntreprise/.test(cd), 'B1 la MÊME recherche et la MÊME carte dans « Ma facture » et « Ma configuration »');
  dit(!/chercherEntreprise\([^)]*\)\.then/.test(fp), 'B2 « Ma facture » ne remplit plus rien en silence à la réponse du registre');
  dit(/if \(frais === null \|\| frais === undefined\) return false;/.test(cd), 'B3 la configuration relit la fiche avant d’écrire ; lecture ratée ⇒ rien écrit');
  dit(/Recherche de l’entreprise…/.test(re) && /rep === 'encours'/.test(re) && !/setTimeout/.test(re), 'B4 l’animation « Recherche de l’entreprise… » ne dure que la requête (aucun délai fabriqué)');
  return ko;
}

(async () => {
  if (!process.argv.includes('--prouve')) {
    const ko = await verifier(RACINE);
    console.log(ko ? `❌ audit-config-facture : ${ko} rouge(s)` : '✅ audit-config-facture : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  const MUTATIONS = [
    ['src/entrepriseRecherche.js', 'TVA proposée sans le registre', "if (calc && actifs.includes(calc)) pousse('tva', calc);", "if (calc) pousse('tva', calc);"],
    ['src/entrepriseRecherche.js', 'clé de TVA fausse', 'const cle = (12 + 3 * (Number(s) % 97)) % 97;', 'const cle = (12 + 2 * (Number(s) % 97)) % 97;'],
    ['src/entrepriseRecherche.js', '« C’est bon » écrase un champ rempli', "if (decision === 'ok' && ligne.cas === 'vide')", "if (decision === 'ok')"],
    ['src/entrepriseRecherche.js', '« Tout est bon » écrase les écarts', "for (const l of lignes || []) if (l && l.cas === 'vide')", 'for (const l of lignes || []) if (l)'],
    ['src/entrepriseRecherche.js', 'forme devinée', "const v = FORME_DE_NATURE[String(code || '').trim()];", "const v = FORME_DE_NATURE[String(code || '').trim()] || 'SAS';"],
    ['src/entrepriseRecherche.js', 'entreprise cessée proposée', "if (rep.fermeUnite === true || (rep.fermeUnite == null && rep.ferme === true && !rep.etabFerme)) return 'ferme';", ''],
    ['src/entrepriseRecherche.js', 'RCS inventé', "  pousse('nom', rep.nom);", "  pousse('nom', rep.nom); pousse('rcs', `RCS ${rep.ville} ${rep.siren}`);"],
    ['src/entrepriseRecherche.js', 'micro deviné pour un EI', "if (natureEI(rep)) return { statut: null, forme: 'EI'", "if (natureEI(rep)) return { statut: 'micro-vente', forme: 'EI'"],
    ['api/_lib/entreprise.js', 'TVA absente lue comme « aucune »', ".map((x) => x.replace(/\\s/g, '').toUpperCase()) : null,", ".map((x) => x.replace(/\\s/g, '').toUpperCase()) : [],"],
    ['src/profilVendeur.js', '« paire » pour sneakers + autre chose', "cats.length === 1 && cats[0] === 'sneakers' ? 'sneakers' : 'autre'", "cats.includes('sneakers') ? 'sneakers' : 'autre'"],
    ['src/configurationDepart.js', 'recommandation sur un « pas su »', "  if (c.proprietaire !== false || typeof c.nComptesVinted !== 'number' || typeof c.nVentes30j !== 'number') return null;\n", ''],
    ['src/configurationDepart.js', '« dans quel carton » revient', 'Le numéro de rangement : il dit où est l’article (carton, étagère, bac…).', 'Le numéro qui dit dans quel carton est l’article.'],
    ['src/FacturePro.jsx', 'remplissage silencieux remis', "  const recherche = useRechercheEntreprise(", "  React.useEffect(() => { deps.chercherEntreprise && deps.chercherEntreprise(cfg && cfg.siret).then((j) => j && updPlusieurs({ nom: j.nom })); }, []);\n  const recherche = useRechercheEntreprise("],
  ];
  let rates = 0;
  for (const [fichier, nom, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cf-'));
    fs.cpSync(path.join(RACINE, 'src'), path.join(d, 'src'), { recursive: true });
    fs.cpSync(path.join(RACINE, 'api'), path.join(d, 'api'), { recursive: true });
    fs.mkdirSync(path.join(d, 'public'), { recursive: true });
    fs.cpSync(path.join(RACINE, 'public', 'aide'), path.join(d, 'public', 'aide'), { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
    const p = path.join(d, fichier); const brut = fs.readFileSync(p, 'utf8');
    if (!brut.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; continue; }
    fs.writeFileSync(p, brut.replace(avant, apres));
    const ko = await verifier(d, { muet: true }).catch(() => 1);
    console.log(`${ko ? 'OK  rouge' : 'KO  VERT'} sous mutation : ${nom}${ko ? ` (${ko})` : ''}`);
    if (!ko) rates++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(rates ? `❌ ${rates} mutation(s) pas attrapée(s)` : `✅ ${MUTATIONS.length}/${MUTATIONS.length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
