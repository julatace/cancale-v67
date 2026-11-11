// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — MA CONFIGURATION ET LE PROFIL FISCAL (9 nov.) : les règles EXÉCUTÉES.
//  src/configurationDepart.js (étapes, pré-sélection, écritures, ouverture) et
//  src/profilFiscal.js (statut ⇒ ce qui s'affiche et se calcule, taux, seuils).
//  F1  statut ⇒ profil : `null` ⇒ rien calculé (et dit) ; « je ne sais pas » ⇒ aide
//      neutre + sources officielles ; particulier ⇒ pas d'URSSAF, DAC7 ; micro ⇒ URSSAF,
//      rythme, taux, seuils de SON activité ; société ⇒ livre + export devant, TVA choisie ;
//  F2  taux : l'achat-revente = `tauxMicroVente` de Compta (mêmes nombres), prestations
//      21,2 + 0,1 (+1,7) ; un taux posé à la main n'est jamais « officiel » ;
//  F3  seuils : vente 203 100 / 85 000 / 93 500 ; services 83 600 / 37 500 / 41 250 ;
//  F4  pré-sélection : rien n'est inventé (une réponse jamais donnée reste null) ;
//      les choix déjà faits sont repris ;
//  F5  écritures : seulement ce qui CHANGE ; une étape sans réponse n'écrit rien ;
//      « je ne sais pas » ne pose jamais un statut ; un taux manuel n'est jamais
//      remplacé ; la méthode d'étiquetage ne touche aucun numéro ;
//  F6  ouverture : une fois, jamais pour le propriétaire ni sur un « pas su », jamais
//      pour un vendeur qui a déjà choisi ses plateformes ;
//  F7  rappel DAC7 de Ma journée : particulier seulement, sur des ventes LUES, proche
//      sans être atteint ;
//  F8  le branchement : l'app lit CES règles (pas une copie).
//  `--prouve` : chaque mutation de la règle doit faire échouer l'audit (§6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const DOSSIER = process.env.AUDIT_CFG_DOSSIER || path.join(RACINE, 'src');

if (process.argv.includes('--prouve')) {
  const MUTATIONS = [
    ['profilFiscal.js', 'un statut pas choisi calcule des cotisations', "return { ...base, etat: inconnu ? 'inconnu' : 'aChoisir', aide", "return { ...base, urssaf: true, cotisations: true, etat: inconnu ? 'inconnu' : 'aChoisir', aide"],
    ['profilFiscal.js', 'un particulier reçoit l’URSSAF', "return { ...base, dac7: true, mots: MOTS.particulier,", "return { ...base, urssaf: true, dac7: true, mots: MOTS.particulier,"],
    ['profilFiscal.js', 'une société reçoit l’URSSAF micro', "export const cotisationsUrssaf = (regime) => regimeLu(regime) === 'micro';", "export const cotisationsUrssaf = (regime) => regimeLu(regime) !== 'particulier';"],
    ['profilFiscal.js', 'le taux des prestations faux (achat-revente)', "cotisations: 21.2, acre: 10.6", "cotisations: 12.3, acre: 10.6"],
    ['profilFiscal.js', 'le versement libératoire des prestations à 1 %', "formation: 0.1, liberatoire: 1.7", "formation: 0.1, liberatoire: 1"],
    ['profilFiscal.js', 'un taux manuel pris pour officiel', "  return false;\n}", "  return true;\n}"],
    ['profilFiscal.js', 'la TVA d’une société devinée', "(tvaSociete && (tvaSociete.choix === 'franchise' || tvaSociete.choix === 'normale') ? tvaSociete.choix : null)", "(tvaSociete && tvaSociete.choix ? tvaSociete.choix : 'franchise')"],
    ['profilFiscal.js', 'le rappel DAC7 pour un micro', "if (!profil || profil.etat !== 'particulier'", "if (!profil || profil.etat === 'societe'"],
    ['profilFiscal.js', 'le rappel DAC7 sur des ventes incomplètes', "if (!p || p.etat !== 'lu' || p.verdict !== 'sous'", "if (!p || p.etat !== 'lu' || p.verdict === 'atteint'"],
    ['microEntreprise.js', 'les seuils des services = ceux de la vente', "services: { plafondVente: 83600, tvaBase: 37500, tvaMajore: 41250 },", "services: { plafondVente: 203100, tvaBase: 85000, tvaMajore: 93500 },"],
    ['configurationDepart.js', 'le statut pré-sélectionné sans réponse', "  let statut = null;", "  let statut = 'particulier';"],
    ['configurationDepart.js', 'une étape réécrit ce qui n’a pas changé', "if (cats.length && (cats.slice().sort().join() !== avant.slice().sort().join() || autre !== autreAvant))", "if (cats.length)"],
    ['configurationDepart.js', '« je ne sais pas » pose un statut', "if (regimeAvant !== null) out.push({ cle: CLE_REGIME, valeur: null });", "out.push({ cle: CLE_REGIME, valeur: 'particulier' });"],
    ['configurationDepart.js', 'un taux manuel remplacé', "  if (!tauxEstOfficiel(tauxBrut)) return null;\n", ""],
    ['configurationDepart.js', 'ouverte pour le propriétaire', "  if (proprietaire !== false) return false;\n", ""],
    ['configurationDepart.js', 'ouverte à un vendeur déjà installé', "  if (lirePlateformes(plateformes)) return false;\n", ""],
    ['configurationDepart.js', 'les notifications écrites sans lecture', "if (!c.familles || !i.familles || !lus.pushPrefs || typeof lus.pushPrefs !== 'object') return out;", "if (!c.familles) return out;"],
    ['configurationDepart.js', '« je numérote » écrit sans aucun endroit', "if (actif && !ou.length) return out;", ""],
    ['configurationDepart.js', 'la date du réglage du N° réécrite à chaque passage', "depuis: ne.actif !== actif || !ne.depuis ? at : ne.depuis", "depuis: at"],
    ['configurationDepart.js', 'l’étape micro offerte à un particulier', "si: (c) => c.statut === 'micro-vente' || c.statut === 'micro-services' }", "si: (c) => !!c.statut }"],
  ];
  let rates = 0;
  for (const [fichier, nom, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cfg-'));
    for (const f of fs.readdirSync(path.join(RACINE, 'src'))) if (/\.js$/.test(f)) fs.copyFileSync(path.join(RACINE, 'src', f), path.join(d, f));
    const brut = fs.readFileSync(path.join(d, fichier), 'utf8');
    if (!brut.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; continue; }
    fs.writeFileSync(path.join(d, fichier), brut.replace(avant, apres));
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split("'../api/_lib/").join(`'${pathToFileURL(path.join(RACINE, 'api', '_lib')).href}/`));
    }
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_CFG_DOSSIER: d }, encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? 'OK  ' : 'KO  '}mutation « ${nom} » ⇒ ${rouge ? 'rouge' : 'VERTE (le contrôle ne la voit pas)'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non vue(s)` : `\n✅ les ${MUTATIONS.length} mutations font échouer l’audit`);
  process.exit(rates ? 1 : 0);
}

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : ''}`); };

(async () => {
  const P = await import(pathToFileURL(path.join(DOSSIER, 'profilFiscal.js')).href);
  const G = await import(pathToFileURL(path.join(DOSSIER, 'configurationDepart.js')).href);
  const M = await import(pathToFileURL(path.join(DOSSIER, 'microEntreprise.js')).href);

  // ── F1 : statut ⇒ profil ──
  const enc = P.profilFiscal({ regime: undefined });
  dit(enc.etat === 'encours' && !enc.urssaf && !enc.cotisations, 'F1 nuage pas lu ⇒ « en cours », rien calculé ni affiché');
  const nul = P.profilFiscal({ regime: null, options: { liberatoire: 'oui' }, rythme: 'mensuel' });
  dit(nul.etat === 'aChoisir' && !nul.urssaf && !nul.cotisations && !nul.seuils && !nul.rappelDeclaration && /aucune cotisation/.test(nul.phrase), 'F1 statut pas choisi ⇒ rien calculé, et la phrase le dit', nul);
  const inc = P.profilFiscal({ regime: null, inconnu: true });
  dit(inc.etat === 'inconnu' && !inc.urssaf && Array.isArray(inc.aide) && inc.aide.length > 0 && inc.sources.every((s) => /^https:\/\/(www\.service-public\.gouv\.fr|entreprendre\.service-public\.gouv\.fr|www\.autoentrepreneur\.urssaf\.fr)/.test(s.url)), '« je ne sais pas » ⇒ aide neutre et SEULEMENT des sources officielles');
  dit(!inc.aide.some((t) => /tu dois|choisis la micro|tu es micro|tu es particulier/i.test(t)), 'F1 l’aide neutre ne tranche pas à sa place');
  const part = P.profilFiscal({ regime: 'particulier', options: { liberatoire: 'oui' }, rythme: 'mensuel' });
  dit(part.etat === 'particulier' && !part.urssaf && !part.cotisations && part.dac7 && !part.rappelDeclaration && part.mots.ca === 'tes ventes', 'F1 particulier ⇒ ni URSSAF ni cotisation, DAC7, « tes ventes »', part);
  const micro = P.profilFiscal({ regime: 'micro', options: { liberatoire: 'oui', acre: false, activite: 'services' }, rythme: 'mensuel', tauxBrut: 23, annee: 2026 });
  dit(micro.urssaf && micro.cotisations && micro.rappelDeclaration && micro.rythme === 'mensuel' && micro.activite === 'services' && micro.tauxCompose === 23 && micro.tauxManuel === null && micro.seuils && micro.seuils.plafond === 83600, 'F1 micro prestations ⇒ URSSAF, SON rythme, SON taux (23 %), plafond 83 600 €', micro);
  const microV = P.profilFiscal({ regime: 'micro', options: null, rythme: null, tauxBrut: 13.5, annee: 2026 });
  dit(microV.activite === 'vente' && microV.rythme === null && microV.liberatoire === null && microV.tauxManuel === 13.5 && microV.seuils.plafond === 203100, 'F1 micro sans réponse ⇒ achat-revente (défaut d’avant), rythme pas dit (null), taux manuel gardé', microV);
  const soc = P.profilFiscal({ regime: 'societe', tvaSociete: null });
  dit(!soc.urssaf && !soc.cotisations && soc.livre && soc.exportEnAvant && soc.tva === null, 'F1 société ⇒ pas d’URSSAF micro, livre + export devant, TVA pas dite = null (jamais devinée)', soc);
  dit(P.profilFiscal({ regime: 'societe', tvaSociete: { choix: 'normale' } }).tva === 'normale' && P.profilFiscal({ regime: 'marge' }).tva === 'marge', 'F1 société ⇒ la TVA choisie ; régime de la marge ⇒ TVA sur la marge');
  dit(P.cotisationsUrssaf('micro') && !P.cotisationsUrssaf('particulier') && !P.cotisationsUrssaf('societe') && !P.cotisationsUrssaf('marge') && !P.cotisationsUrssaf(null) && !P.cotisationsUrssaf('autre'), 'F1 `cotisationsUrssaf` : micro seulement');

  // ── F2 : taux ──
  const compta = fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Compta.jsx'), 'utf8');
  const tm = compta.match(/const TAUX_MICRO = ([^;]+);/);
  const tv = compta.match(/const tauxMicroVente = ([^\n]+\n[^\n]+);/);
  if (tm && tv) {
    const TAUX_MICRO = eval('(' + tm[1] + ')'); // eslint-disable-line no-eval, no-unused-vars
    const tauxMicroVente = eval('(' + tv[1] + ')'); // eslint-disable-line no-eval
    let egal = true;
    for (const acre of [false, 'avant', 'apres']) for (const liberatoire of [false, true]) if (tauxMicroVente({ acre, liberatoire }) !== P.tauxMicro({ activite: 'vente', acre, liberatoire })) egal = false;
    dit(egal, 'F2 achat-revente : les MÊMES taux que `tauxMicroVente` de Comptabilité (6 combinaisons)');
    const A = P.TAUX_ACTIVITE.vente;
    dit(A.cotisations === TAUX_MICRO.cotisations && A.acre === TAUX_MICRO.acre && A.acre2026 === TAUX_MICRO.acre2026 && A.formation === TAUX_MICRO.formation && A.liberatoire === TAUX_MICRO.liberatoire, 'F2 la table de l’achat-revente recopie `TAUX_MICRO` à l’identique');
  } else dit(false, 'F2 TAUX_MICRO et tauxMicroVente lisibles dans Compta.jsx');
  dit(P.tauxMicro({}) === 12.4 && P.tauxMicro({ liberatoire: true }) === 13.4, 'F2 achat-revente 12,4 % ; 13,4 % avec le versement libératoire (12,3 + 0,1 + 1)');
  dit(P.tauxMicro({ activite: 'services' }) === 21.3 && P.tauxMicro({ activite: 'services', liberatoire: true }) === 23, 'F2 prestations 21,3 % ; 23 % avec le versement libératoire (21,2 + 0,1 + 1,7, F36232 et F23459)');
  dit(P.tauxMicro({ activite: 'services', acre: 'avant' }) === 10.7 && P.tauxMicro({ activite: 'services', acre: 'apres' }) === 16, 'F2 prestations avec ACRE : 10,7 % (avant juillet 2026) ; 16 % (depuis)');
  dit(P.tauxEstOfficiel(null) && P.tauxEstOfficiel(12.4) && P.tauxEstOfficiel('23') && !P.tauxEstOfficiel(13.5) && !P.tauxEstOfficiel('15,2'), 'F2 un taux posé à la main (13,5 · 15,2) n’est jamais « officiel »');
  const det = P.detailTaux({ activite: 'services', liberatoire: true });
  dit(det.length === 3 && Math.round(det.reduce((s, l) => s + l.taux, 0) * 10) / 10 === 23, 'F2 le détail ligne par ligne fait le taux affiché');

  // ── F3 : seuils ──
  const sv = P.seuilsActivite(2026, 'vente'), ss = P.seuilsActivite(2026, 'services');
  dit(sv && sv.plafond === 203100 && sv.tvaBase === 85000 && sv.tvaMajore === 93500, 'F3 vente : 203 100 € · TVA 85 000 € / 93 500 €', sv);
  dit(ss && ss.plafond === 83600 && ss.tvaBase === 37500 && ss.tvaMajore === 41250, 'F3 services : 83 600 € · TVA 37 500 € / 41 250 € (F32353, F21746)', ss);
  dit(P.seuilsActivite(2031, 'services') === null, 'F3 une année sans chiffres vérifiés ⇒ aucun seuil');
  const ligne = { at: Date.parse('2026-10-01T10:00:00Z'), mois: [{ ym: '2026-09', ca: 40000 }], sources: {} };
  const jv = M.jaugeSeuils({ ligne, now: new Date(2026, 9, 1) }), js = M.jaugeSeuils({ ligne, now: new Date(2026, 9, 1), activite: 'services' });
  dit(jv.tva.etat === 'ok' && js.tva.etat === 'base_depasse', 'F3 la jauge de Comptabilité suit l’activité : 40 000 € ⇒ sous le seuil en vente, au-delà en services', [jv.tva.etat, js.tva.etat]);

  // ── F4 : pré-sélection ──
  const vide = G.choixInitiaux({});
  dit(vide.vends === null && vide.statut === null && vide.rythme === null && vide.liberatoire === null && vide.acre === null && vide.numero === null && vide.affichage === null && vide.familles === null && vide.tvaSociete === null, 'F4 compte neuf : aucune réponse inventée', vide);
  dit(JSON.stringify(vide.plateformes) === '["vinted"]' && vide.plateformesChoisies === false, 'F4 plateformes : le défaut d’affichage (Vinted), marqué « pas choisi »');
  const deja = G.choixInitiaux({
    jeVends: { choix: 'sneakers' }, plateformes: { sites: ['vinted', 'ebay'] }, relies: { leboncoin: true }, regime: 'micro',
    microOptions: { liberatoire: 'non', acre: 'apres', activite: 'services', at: 1 }, rythme: 'mensuel',
    numeroEcrit: { actif: true, depuis: '2026-11-07T00:00:00Z', ou: ['titre'] }, affichage: { choix: 'simple' },
    pushPrefs: { familles: { offres: false } },
  });
  dit(JSON.stringify(deja.vends) === '["sneakers"]' && deja.statut === 'micro-services' && deja.rythme === 'mensuel' && deja.liberatoire === 'non' && deja.acre === 'apres' && deja.numero === 'moi' && deja.numeroOu.join() === 'titre' && deja.affichage === 'simple', 'F4 un vendeur installé retrouve SES choix', deja);
  dit(deja.plateformes.join() === 'vinted,leboncoin,ebay' && deja.familles && deja.familles.offres === false && deja.familles.ventes === true, 'F4 plateformes choisies + compte relié ; familles lues par la règle du serveur', deja);
  dit(G.choixInitiaux({ regime: 'marge' }).statut === 'societe' && G.choixInitiaux({ regime: 'marge' }).tvaSociete === 'marge', 'F4 régime de la marge ⇒ société, TVA sur la marge');
  dit(G.choixInitiaux({ regime: null, configuration: { etat: 'plusTard', statut: 'inconnu' } }).statut === 'inconnu', 'F4 « je ne sais pas encore » reste pré-sélectionné');
  const nAncien = G.choixInitiaux({ numeroEcrit: { actif: true, depuis: 'x' } });
  dit(nAncien.numero === 'moi' && nAncien.numeroOu.join() === 'description,titre,ref' && G.choixInitiaux({ numeroEcrit: { actif: false, depuis: 'x' } }).numero === 'vrm' && G.choixInitiaux({ numeroEcrit: { actif: false } }).numero === null, 'F4 numéro (`vrm_numero_ecrit`, src/numeroEcrit.js) : allumé ⇒ « je numérote » et ses endroits (tous par défaut) ; éteint choisi ⇒ « VRM numérote » ; jamais choisi ⇒ rien');
  dit(G.etapesActives(vide).map((e) => e.cle).join() === 'vends,plateformes,statut,numero,affichage,notifs,recap', 'F4 sans statut : ni étape micro ni étape TVA');
  dit(G.etapesActives({ statut: 'micro-vente' }).some((e) => e.cle === 'micro') && G.etapesActives({ statut: 'societe' }).some((e) => e.cle === 'societe') && !G.etapesActives({ statut: 'particulier' }).some((e) => e.cle === 'micro' || e.cle === 'societe'), 'F4 micro ⇒ étape URSSAF ; société ⇒ étape TVA ; particulier ⇒ aucune');

  // ── F5 : écritures ──
  const AT = '2026-11-09T10:00:00.000Z';
  const i0 = G.choixInitiaux({});
  dit(G.ecrituresEtape('vends', { ...i0 }, i0, {}, AT).length === 0, 'F5 une étape sans réponse n’écrit rien');
  dit(G.ecrituresEtape('vends', deja, deja, {}, AT).length === 0 && G.ecrituresEtape('affichage', deja, deja, {}, AT).length === 0, 'F5 un choix inchangé ne réécrit rien');
  const wv = G.ecrituresEtape('vends', { ...i0, vends: ['autre'] }, i0, {}, AT);
  dit(wv.length === 1 && wv[0].cle === 'vrm_je_vends' && wv[0].valeur.choix === 'autre', 'F5 « Autre chose » ⇒ vrm_je_vends', wv);
  const wp = G.ecrituresEtape('plateformes', { ...i0, plateformes: ['vinted'] }, i0, {}, AT);
  dit(wp.length === 1 && wp[0].cle === 'vrm_plateformes_affichees' && wp[0].valeur.sites.join() === 'vinted', 'F5 confirmer le défaut le RANGE (le choix est fait, la question ne revient pas)', wp);
  const winc = G.ecrituresEtape('statut', { ...i0, statut: 'inconnu' }, i0, { regime: null }, AT);
  dit(winc.length === 0, 'F5 « je ne sais pas » sur un statut jamais choisi : rien n’est écrit (null reste null)', winc);
  const winc2 = G.ecrituresEtape('statut', { ...deja, statut: 'inconnu' }, deja, { regime: 'micro' }, AT);
  dit(winc2.length === 1 && winc2[0].cle === 'vinted_regime' && winc2[0].valeur === null, 'F5 « je ne sais pas » sur un statut choisi : redevient non choisi (null), jamais un autre statut', winc2);
  const wms = G.ecrituresEtape('statut', { ...i0, statut: 'micro-services' }, i0, { regime: null, tauxBrut: null }, AT);
  const reg = wms.find((w) => w.cle === 'vinted_regime'), mo = wms.find((w) => w.cle === 'vrm_micro_options'), tx = wms.find((w) => w.cle === 'vinted_urssaf_taux');
  dit(reg && reg.valeur === 'micro' && mo && mo.valeur.activite === 'services' && tx && tx.valeur === 21.3, 'F5 micro prestations ⇒ statut micro, activité services, taux 21,3 %', wms);
  const wmanu = G.ecrituresEtape('statut', { ...i0, statut: 'micro-services' }, i0, { regime: null, tauxBrut: 13.5 }, AT);
  dit(!wmanu.some((w) => w.cle === 'vinted_urssaf_taux'), 'F5 un taux posé à la main (13,5 %) n’est jamais remplacé', wmanu);
  const im = G.choixInitiaux({ regime: 'micro', microOptions: { liberatoire: 'non', at: 1 }, rythme: 'trimestriel' });
  const wmi = G.ecrituresEtape('micro', { ...im, liberatoire: 'oui', rythme: 'mensuel', acre: 'non' }, im, { regime: 'micro', microOptions: { liberatoire: 'non', at: 1 }, tauxBrut: 12.4 }, AT);
  const t2 = wmi.find((w) => w.cle === 'vinted_urssaf_taux'), f2 = wmi.find((w) => w.cle === 'vinted_urssaf_freq'), o2 = wmi.find((w) => w.cle === 'vrm_micro_options');
  dit(t2 && t2.valeur === 13.4 && f2 && f2.valeur === 'mensuel' && o2 && o2.valeur.liberatoire === 'oui' && o2.valeur.acre === false && o2.valeur.activite === 'vente', 'F5 micro : rythme, versement libératoire, ACRE ⇒ les clés de Comptabilité et le taux composé (13,4 %)', wmi);
  const wsoc = G.ecrituresEtape('societe', { statut: 'societe', tvaSociete: 'franchise' }, { statut: 'societe', tvaSociete: null }, { regime: 'societe' }, AT);
  dit(wsoc.length === 1 && wsoc[0].cle === 'vrm_societe_tva' && wsoc[0].valeur.choix === 'franchise', 'F5 société : la TVA choisie est rangée', wsoc);
  const wmarge = G.ecrituresEtape('societe', { statut: 'societe', tvaSociete: 'marge' }, { statut: 'societe', tvaSociete: null }, { regime: 'societe' }, AT);
  dit(wmarge.length === 1 && wmarge[0].cle === 'vinted_regime' && wmarge[0].valeur === 'marge', 'F5 TVA sur la marge ⇒ le régime de la marge (connu de toute l’app)');
  const wn = G.ecrituresEtape('numero', { numero: 'moi', numeroOu: ['description'] }, { numero: null }, { numeroEcrit: null }, AT);
  dit(wn.length === 1 && wn[0].cle === 'vrm_numero_ecrit' && wn[0].valeur.actif === true && wn[0].valeur.ou.join() === 'description' && wn[0].valeur.depuis === AT, 'F5 numéro : le seul réglage `vrm_numero_ecrit` (allumé, endroit « description »), RIEN d’autre', wn);
  const wn2 = G.ecrituresEtape('numero', { numero: 'moi', numeroOu: ['titre', 'description'] }, { numero: 'moi' }, { numeroEcrit: { actif: true, depuis: '2026-11-07T00:00:00Z', ou: ['description'] } }, AT);
  dit(wn2.length === 1 && wn2[0].valeur.depuis === '2026-11-07T00:00:00Z' && wn2[0].valeur.ou.join() === 'description,titre', 'F5 ajouter un endroit en restant « je numérote » garde la date du réglage (ordre de numeroEcrit)', wn2);
  const wn3 = G.ecrituresEtape('numero', { numero: 'moi', numeroOu: [] }, { numero: null }, { numeroEcrit: null }, AT);
  dit(wn3.length === 0, 'F5 « je numérote » sans aucun endroit n’écrit rien (jamais zéro endroit)', wn3);
  const wn4 = G.ecrituresEtape('numero', { numero: 'vrm', numeroOu: ['titre'] }, { numero: 'moi' }, { numeroEcrit: { actif: true, depuis: 'x', ou: ['titre'] } }, AT);
  dit(wn4.length === 1 && wn4[0].valeur.actif === false && wn4[0].valeur.ou.join() === 'titre', 'F5 « VRM numérote » éteint le réglage, ses endroits gardés tels quels', wn4);
  const wn5 = G.ecrituresEtape('numero', { numero: 'moi', numeroOu: ['description', 'titre', 'ref'] }, { numero: 'moi' }, { numeroEcrit: { actif: true, depuis: 'x', choisi: 'x' } }, AT);
  dit(wn5.length === 0, 'F5 un réglage allumé sans `ou` (tous les endroits) reconfirmé tel quel : rien n’est réécrit', wn5);
  dit(!JSON.stringify([wn, wn2]).match(/annonce_numeros|used_numeros|pool/), 'F5 aucune écriture ne vise les numéros ni le pool');
  dit(G.ecrituresEtape('notifs', { familles: { ventes: false } }, { familles: { ventes: true } }, { pushPrefs: null }, AT).length === 0, 'F5 notifications pas lues ⇒ rien écrit');
  const wpush = G.ecrituresEtape('notifs', { familles: { ventes: false, offres: true } }, { familles: { ventes: true, offres: true } }, { pushPrefs: { calme: { actif: true }, familles: { messages: false } } }, AT);
  dit(wpush.length === 1 && wpush[0].ligne && wpush[0].valeur.calme.actif === true && wpush[0].valeur.familles.messages === false && wpush[0].valeur.familles.ventes === false, 'F5 notifications : la ligne LUE, gardée entière (heures calmes…), les familles fusionnées', wpush);
  const fin = G.ecritureFin('plusTard', { statut: 'inconnu' }, AT);
  dit(fin.cle === 'vrm_configuration' && fin.valeur.etat === 'plusTard' && fin.valeur.statut === 'inconnu', 'F5 « Plus tard » est retenu, avec « je ne sais pas encore »');
  const l2 = G.appliquerEcritures({ regime: null }, wms);
  dit(l2.regime === 'micro' && l2.microOptions.activite === 'services' && l2.tauxBrut === 21.3, 'F5 ce qui est écrit est relu pour l’étape suivante');

  // ── F6 : ouverture ──
  const base = { pret: true, baseKO: false, exemple: false, bienvenue: false, proprietaire: false, configuration: null, plateformes: null };
  dit(G.configurationAOuvrir(base), 'F6 vendeur neuf ⇒ la configuration s’ouvre');
  dit(!G.configurationAOuvrir({ ...base, proprietaire: true }) && !G.configurationAOuvrir({ ...base, proprietaire: null }), 'F6 jamais pour le propriétaire, ni sur un « pas su »');
  dit(!G.configurationAOuvrir({ ...base, plateformes: { sites: ['vinted'] } }), 'F6 un vendeur qui a déjà choisi ses plateformes n’est pas interrompu');
  dit(!G.configurationAOuvrir({ ...base, configuration: { etat: 'plusTard' } }) && !G.configurationAOuvrir({ ...base, configuration: { etat: 'fait' } }), 'F6 une fois : faite ou mise de côté, elle ne revient pas seule');
  dit(!G.configurationAOuvrir({ ...base, pret: false }) && !G.configurationAOuvrir({ ...base, baseKO: true }) && !G.configurationAOuvrir({ ...base, exemple: true }) && !G.configurationAOuvrir({ ...base, bienvenue: true }), 'F6 jamais avant le nuage, base en panne, en exemple ou pendant Bienvenue');

  // ── F7 : rappel DAC7 ──
  const dac = (p) => ({ annee: 2026, plateformes: [p] });
  const proche = { plateforme: 'Vinted', etat: 'lu', n: 26, centimes: 90000, verdict: 'sous', reste: { n: 4, centimes: 110001 } };
  const r7 = P.rappelDac7Journee(part, dac(proche));
  dit(r7 && r7.plateforme === 'Vinted' && r7.resteVentes === 4, 'F7 particulier proche du seuil (26 ventes) ⇒ le rappel, avec ce qui reste', r7);
  dit(P.rappelDac7Journee(micro, dac(proche)) === null && P.rappelDac7Journee(nul, dac(proche)) === null, 'F7 jamais pour un micro ni un statut pas choisi');
  dit(P.rappelDac7Journee(part, dac({ ...proche, n: 10, centimes: 30000 })) === null, 'F7 loin du seuil ⇒ rien (pas un rappel permanent)');
  dit(P.rappelDac7Journee(part, dac({ ...proche, verdict: null, partiel: true })) === null, 'F7 ventes incomplètes (« au moins ») ⇒ rien : « sous le seuil » n’est pas prouvé');
  dit(P.rappelDac7Journee(part, dac({ ...proche, verdict: 'atteint' })) === null && P.rappelDac7Journee(part, dac({ plateforme: 'Vinted', etat: 'passu', n: null, centimes: null })) === null, 'F7 atteint ou pas lu ⇒ rien ici');

  // ── F8 : branchement ──
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  dit(/const urssafConcerne = \(r = regimeFiscal\(\)\) => cotisationsUrssaf\(r\);/.test(app), 'F8 `urssafConcerne` de l’app appelle LA règle (`cotisationsUrssaf`)');
  dit(/configurationAOuvrir\(\{ pret:true, baseKO, exemple:exempleActif\(\), bienvenue, proprietaire:proprio, configuration:load\(CLE_CONFIGURATION,null\), plateformes:load\(CLE_PLATEFORMES,null\) \}\)/.test(app), 'F8 l’ouverture passe les LECTURES (propriétaire lu, configuration, plateformes)');
  dit(/visite && !bienvenue && !configOuverte/.test(app) && /silence=\{!!\(bienvenue \|\| visite \|\| configOuverte( \|\| parcoursOuvert)?\)\}/.test(app), 'F8 la visite et la feuille « compte relié » attendent la configuration');
  dit(/CLE_CONFIGURATION, CLE_SOCIETE_TVA,/.test(app) && /'vrm_numero_ecrit',/.test(app), 'F8 les clés sont synchronisées (SYNC_KEYS), la méthode d’étiquetage est `vrm_numero_ecrit`');
  dit(/rappelDac7Journee\(profilFiscalLu\(\), dac7ParPlateforme\(/.test(app), 'F8 Ma journée : le rappel DAC7 lit la règle de Comptabilité');
  dit(/jaugeSeuils\(\{ ligne, now, activite \}\)/.test(compta) && /exportDevant/.test(compta) && /<AideStatutNeutre \/>/.test(compta), 'F8 Comptabilité : jauge de SON activité, export devant en société, aide neutre');
  const reglages = fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Reglages.jsx'), 'utf8');
  dit(/id:'configuration', type:'action'[^\n]*vrm:configuration/.test(reglages), 'F8 Réglages → « Ma configuration » rouvre la configuration');

  console.log(ko ? `\n❌ audit-configuration-depart : ${ko} rouge(s)` : '\n✅ audit-configuration-depart : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
