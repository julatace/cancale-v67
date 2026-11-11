// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — Facture Pro, lot DJ1 (11 nov.) : SIRET ⇒ « C'est bien toi ? »,
//  compte professionnel seulement, bon de retour, plus de pied VRM dans l'e-mail,
//  les factures relues quand l'app reste ouverte.
//  Julien : « quand on remplit le SIRET, le nom, le RCS, le nom de l'entreprise se
//  remplissent automatiquement … on demande à la personne de vérifier » ; « que sur
//  compte professionnel, ou alors on demande » ; « je n'ai pas le bouton envoyer la
//  facture … et le bon de retour » ; « Je veux pas de ce message ».
//
//  R  la règle (src/entrepriseRecherche.js, api/_lib/entreprise.js) EXÉCUTÉE sur une
//     réponse FABRIQUÉE de la forme documentée de l'API recherche-entreprises
//     (open-api.yml : results[].siren, nature_juridique, siege/matching_etablissements
//     .nom_commercial, .liste_enseignes, .activite_principale, tva[]) ;
//  H  la recherche à la VALIDATION, arrêtée à 8 s (lecture du composant) ;
//  C  compte professionnel (src/facturePro/comptes.js) ;
//  B  bon de retour (src/facturePro/bonRetour.js) : contenu ET PDF relu ;
//  E  l'e-mail de facture : aucun pied VRM ;
//  F  les factures relues (app restée ouverte) : FactureVente.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
//  Lancer : node scripts/audit-facture-siret.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const { pathToFileURL } = require('url');
const RACINE = path.resolve(__dirname, '..');

const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = ['812345670', '812345671', '812345672', '812345673', '812345674', '812345675', '812345676', '812345677', '812345678', '812345679'].find(luhn);
const SIRET = (() => { for (let k = 10; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
const TVA = `FR${String((12n + 3n * (BigInt(SIREN) % 97n)) % 97n).padStart(2, '0')}${SIREN}`;
const etab = (x = {}) => ({ siret: SIRET, adresse: '12 RUE DE L’EXEMPLE 35000 RENNES', code_postal: '35000', libelle_commune: 'RENNES', etat_administratif: 'A', activite_principale: '47.79Z', nom_commercial: 'LA BOUTIQUE EXEMPLE', liste_enseignes: ['ENSEIGNE EXEMPLE'], activite_principale_registre_metier: null, ...x });
const unite = (x = {}, e = {}) => ({ results: [{ siren: SIREN, nom_complet: 'ATELIER EXEMPLE', nom_raison_sociale: 'ATELIER EXEMPLE', nature_juridique: '5710', etat_administratif: 'A', activite_principale: '47.79Z', siege: etab(e), matching_etablissements: [etab(e)], complements: { est_entrepreneur_individuel: false }, tva: [TVA], ...x }] });

async function verifier(racine, { muet = false } = {}) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (!muet) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : ''}`); };
  const imp = (f) => import(pathToFileURL(path.join(racine, f)).href + `?t=${Date.now()}${Math.random()}`);
  let E, S, CO, BR, RG;
  try { E = await imp('src/entrepriseRecherche.js'); S = await imp('api/_lib/entreprise.js'); CO = await imp('src/facturePro/comptes.js'); BR = await imp('src/facturePro/bonRetour.js'); RG = await imp('src/facturePro/regle.js'); }
  catch (e) { dit(false, 'les modules se chargent', String(e.message)); return ko || 1; }

  // ── R : la carte « C'est bien toi ? » ──
  const sas = S.lireReponseEntreprise(unite(), SIRET);
  dit(sas.nomCommercial === 'LA BOUTIQUE EXEMPLE' && sas.ape === '47.79Z', 'R1 le serveur rend le nom commercial et le code APE tels que le registre les dit', { n: sas.nomCommercial, a: sas.ape });
  const sansCom = S.lireReponseEntreprise(unite({}, { nom_commercial: null, liste_enseignes: null, activite_principale: undefined }), SIRET);
  dit(sansCom.nomCommercial === '' && sansCom.ape === '47.79Z', 'R1 nom commercial absent ⇒ rien (jamais deviné) ; APE de l’unité en repli', sansCom);
  const f0 = E.ficheIdentite(sas, {}, {});
  const L = (f, c) => f.lignes.find((l) => l.cle === c) || {};
  dit(L(f0, 'nom').valeur === 'ATELIER EXEMPLE' && L(f0, 'nomCommercial').affiche === 'LA BOUTIQUE EXEMPLE' && !L(f0, 'nomCommercial').champ && L(f0, 'forme').valeur === 'SAS' && /Société par actions simplifiée/.test(L(f0, 'forme').affiche) && L(f0, 'ape').affiche === '47.79Z' && L(f0, 'tva').valeur === TVA,
    'R2 dénomination, nom commercial (à vérifier, jamais écrit), forme EN MOTS, APE, TVA calculée (assujettie au registre)', f0.lignes);
  dit(!f0.lignes.some((l) => l.cle === 'rcs') && f0.imm.cas === 'rcs' && /Kbis/.test(f0.imm.aide || ''), 'R3 société : RCS jamais écrit sans la ville du greffe (recopiée du Kbis)', f0.imm);
  const fV = E.ficheIdentite(sas, {}, { villeGreffe: 'rennes' });
  const grp = SIREN.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  dit(L(fV, 'rcs').valeur === `RCS Rennes ${grp}`, 'R3 avec SA ville : « RCS Rennes <SIREN> »', L(fV, 'rcs'));
  dit(E.rcsDe('', SIREN) === '' && E.rcsDe('75011', SIREN) === '' && E.rcsDe('Paris', '12') === '', 'R3 rcsDe : ni ville vide, ni chiffres, ni SIREN faux');
  const ei = S.lireReponseEntreprise(unite({ nature_juridique: '1000', nom_raison_sociale: null, nom_complet: 'CAMILLE EXEMPLE', complements: { est_entrepreneur_individuel: true }, tva: [] }), SIRET);
  const fEi = E.ficheIdentite(ei, {}, { villeGreffe: 'Rennes' });
  dit(fEi.imm.cas === 'ei' && /Pas de RCS au registre public \(EI au RNE\)/.test(fEi.imm.texte) && !fEi.lignes.some((l) => l.cle === 'rcs' || l.cle === 'tva') && /293 B/.test(fEi.tvaNote),
    'R4 EI : « pas de RCS au registre public (EI au RNE) », aucun RCS ni TVA écrit, la franchise dite', { imm: fEi.imm, tva: fEi.tvaNote });
  const rm = E.ficheIdentite(S.lireReponseEntreprise(unite({ nature_juridique: '1000', complements: { est_entrepreneur_individuel: true } }, { activite_principale_registre_metier: '10.71C' }), SIRET), {});
  dit(rm.imm.cas === 'rm' && !rm.lignes.some((l) => l.cle === 'rcs'), 'R4 répertoire des métiers : « RM » dit, aucun numéro inventé', rm.imm);
  const fE = E.ficheIdentite(sas, { nom: 'Mon Atelier', ville: 'Rennes' }, {});
  dit(L(fE, 'nom').cas === 'ecart' && L(fE, 'ville').cas === 'egal', 'R5 son nom écrit autrement : écart ; la même ville (casse près) : déjà juste');
  const oui = E.ecritureOui(fE.lignes, {});
  dit(!('nom' in oui) && !('ville' in oui) && oui.forme === 'SAS' && oui.adresse === '12 RUE DE L’EXEMPLE' && !('ape' in oui) && !('nomCommercial' in oui), 'R5 « Oui, c’est moi » : les champs vides ; son écart GARDÉ par défaut ; rien d’informatif écrit', oui);
  dit(E.ecritureOui(fE.lignes, { nom: true }).nom === 'ATELIER EXEMPLE', 'R5 « Le registre » choisi sur l’écart ⇒ remplacé');
  dit(E.ficheIdentite({ etat: 'inconnu' }, {}).lignes.length === 0 && E.ficheIdentite(S.lireReponseEntreprise(unite({ etat_administratif: 'C' }), SIRET), {}).lignes.length === 0, 'R6 introuvable / cessée ⇒ aucune ligne');
  // Statut ⇒ mentions.
  const mSasu = E.mentionsDeForme('SASU', { nom: 'X' });
  dit(/SASU/.test(mSasu.titre) && mSasu.lignes.some((l) => l.cle === 'capital' && !l.ok && l.champ === 'capital') && mSasu.lignes.some((l) => l.cle === 'rcs' && !l.ok) && !mSasu.proposition, 'R7 SASU ⇒ capital et RCS à remplir, aucune écriture proposée', mSasu);
  const mEi = E.mentionsDeForme('EI', { nom: 'Camille Exemple' });
  dit(mEi.lignes.some((l) => l.cle === 'nom' && l.texte === 'Camille Exemple EI') && mEi.lignes.some((l) => l.cle === 'capital' && l.ok) && mEi.proposition && mEi.proposition.valeur === 'franchise', 'R7 EI ⇒ « nom EI », pas de capital ; franchise PROPOSÉE (sur son clic) quand aucun régime', mEi);
  dit(!E.mentionsDeForme('EI', { tva_regime: 'normal' }).proposition && E.mentionsDeForme('', {}).lignes.length === 0, 'R7 un régime choisi n’est jamais re-proposé ; pas de forme ⇒ rien');

  // ── H : la recherche à la validation, arrêtée à 8 s ──
  const re = fs.readFileSync(path.join(racine, 'src', 'RechercheEntreprise.jsx'), 'utf8');
  const fp = fs.readFileSync(path.join(racine, 'src', 'FacturePro.jsx'), 'utf8');
  dit(E.DELAI_RECHERCHE_MS === 8000 && /setRep\(\{ etat: 'lent' \}\)/.test(re) && /lent: 'Pas trouvé à temps\. Remplis à la main/.test(re), 'H1 arrêt à 8 s ⇒ « Pas trouvé à temps. Remplis à la main »');
  dit(/lance\.ch !== ch \|\| !lance\.n\) return undefined;/.test(re) && /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); recherche\.lancer\(\); \}/.test(fp) && /onBlur=\{\(\) => recherche\.lancerUneFois\(\)\}/.test(fp), 'H2 rien ne part avant sa validation (Entrée, sortie du champ, « Rechercher »)');
  dit(/data-ent-oui/.test(re) && /data-ent-non/.test(re) && /C’est bien toi \?/.test(re) && /<CarteMentionsForme /.test(fp), 'H3 la carte « C’est bien toi ? » (Oui / Non) et la carte du statut sont branchées');

  // ── C : compte professionnel ──
  dit(CO.compteFacturable({}, 'leboncoin', 'shop') === 'demander' && CO.compteFacturable({ comptesFacture: { 'leboncoin:shop': true } }, 'leboncoin', 'Shop') === true && CO.compteFacturable({ comptesFacture: { 'leboncoin:shop': false } }, 'leboncoin', 'shop') === false && CO.compteFacturable({}, 'leboncoin', '') === null && CO.compteFacturable({ comptesFacture: { 'vestiaire:x': true } }, 'vestiaire', 'x') === true && CO.compteFacturable({ comptesFacture: { 'vinted:x': true } }, 'vinted', 'x') === null,
    'C1 jamais répondu ⇒ on demande ; oui ⇒ facture ; non ⇒ rien ; compte pas lu ⇒ rien ; Vinted : jamais ici (Vinted le dit)');
  dit(CO.compteDeVente('ebay', {}) === 'principal' && CO.compteDeVente('ebay', { _compte: 'abc', _pseudo: 'joli' }) === 'abc' && CO.compteDeVente('leboncoin', { account: 'x' }) === 'x', 'C2 le compte d’une vente : celui de SA ligne (jamais le pseudo affiché)');
  const fa = fs.readFileSync(path.join(racine, 'src', 'FactureAutres.jsx'), 'utf8');
  const srvA = fs.readFileSync(path.join(racine, 'api', '_lib', 'facture-autres.js'), 'utf8');
  dit(/if \(cf === 'demander'\) return <QuestionCompte/.test(fa) && /if \(cf !== true\) return null;/.test(fa) && /compteFacturable\(cfg \|\| \{\}, plateforme, compteDeVente\(plateforme, brut\)\) !== true\) return repondre\(res, 409/.test(srvA), 'C3 l’app demande, le SERVEUR refuse un compte pas dit pro (audit-factures-autres l’exécute)');

  // ── B : bon de retour ──
  const CFG = { nom: 'Camille Exemple', forme: 'EI', siret: SIRET, adresse: '12 rue de l’Exemple', codePostal: '35000', ville: 'Rennes', email: 'camille@exemple.test' };
  const c = BR.contenuBonRetour(CFG, { tx: '24000000001', designation: 'Nike Dunk banc 42', venteLe: '2026-11-10T18:12:12Z' });
  dit(c.ok && c.vendeur.nom === 'Camille Exemple EI' && c.vendeur.adresse.join('|') === '12 rue de l’Exemple|35000 Rennes' && c.vente.le === '10/11/2026' && /L221-18/.test(c.mention) && /14 jours/.test(c.mention), 'B1 le bon : vendeur (+ EI), adresse de retour de Ma facture, n°, article, date, 14 jours (L221-18)', c);
  const sansAdr = BR.contenuBonRetour({ nom: 'X' }, { tx: '24000000001' });
  dit(!sansAdr.ok && sansAdr.manque.includes('ton adresse de retour') && !BR.contenuBonRetour(CFG, { tx: 'abc' }).ok, 'B2 pas d’adresse de retour ou pas de n° ⇒ pas de bon (le manque dit)', sansAdr);
  let tPdf = '';
  try {
    const PL = require(path.join(racine, 'node_modules', 'pdf-lib'));
    const octets = await BR.pdfBonRetour(c, { PDFLib: PL });
    const doc = await PL.PDFDocument.load(octets);
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!obj || !obj.contents) continue;
      let b = Buffer.from(obj.contents); try { b = zlib.inflateSync(b); } catch (_) {}
      for (const m of b.toString('latin1').matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) tPdf += Buffer.from(m[1], 'hex').toString('latin1') + '\n';
    }
  } catch (e) { tPdf = 'ERREUR ' + e.message; }
  dit(/Bon de retour/.test(tPdf) && /24000000001/.test(tPdf) && /L221-18/.test(tPdf) && /Formulaire de r.tractation/.test(tPdf) && /35000 Rennes/.test(tPdf), 'B3 le PDF relu porte le titre, le n°, l’adresse de retour, L221-18 et le formulaire', tPdf.slice(0, 200));
  dit(/data-fp-bon-retour=\{deVinted \? 'vinted' : 'vrm'\}/.test(fp) && /select=b64:data->>retourB64/.test(fp) && /\{corps\}\n\s*<BonRetour vente=\{vente\} preuve=\{preuve\} facture=\{f\} deps=\{deps\} ligne=\{ligne\}\/>/.test(fp), 'B4 « Bon de retour » à côté de chaque vente Pro : le formulaire de Vinted de CETTE vente, sinon celui de VRM');

  // ── E : l'e-mail sans pied VRM ──
  const contenu = { type: 'facture', numero: 'FA-2026-0001', vendeur: { nom: 'Camille Exemple EI' }, acheteur: { nom: 'Lou Banc' }, lignes: [{ designation: 'Article banc' }] };
  const m = RG.emailFacture({}, contenu, { via: 'vrm' });
  dit(!/pour le compte de|envoyée par VRM|répondez simplement|votre réponse arrive|on behalf of/i.test(m.texte + m.html) && /Camille Exemple EI/.test(m.texte), 'E1 aucun pied « envoyée par VRM pour le compte de … » (texte et HTML) ; la réponse va au vendeur par Reply-To', m.texte.slice(-200));

  // ── F : les factures relues quand l'app reste ouverte ──
  dit(/FACTURES_FRAICHES_MS = 60 \* 1000/.test(fp) && /visibilitychange/.test(fp) && /if \(sansMail && factures_perimees\(\)\) relireFactures\(deps\);/.test(fp) && /if \(factures_perimees\(\)\) relireFactures\(deps\);/.test(fp), 'F1 une vente Pro arrivée après l’ouverture : e-mails relus (retour sur l’app, nouvelle ligne, vente Pro sans e-mail)');
  dit(/if \(v \|\| _donnees === undefined\) _donnees = v;/.test(fp), 'F2 une relecture ratée ne remplace pas une lecture réussie');
  return ko;
}

(async () => {
  if (!process.argv.includes('--prouve')) {
    const ko = await verifier(RACINE);
    console.log(ko ? `❌ audit-facture-siret : ${ko} rouge(s)` : '✅ audit-facture-siret : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  const MUTATIONS = [
    ['src/entrepriseRecherche.js', '« Oui » écrase son écart', "if (l.cas === 'vide' || (l.cas === 'ecart' && prendre && prendre[l.champ] === true)) out[l.champ] = l.valeur;", "if (l.cas === 'vide' || l.cas === 'ecart') out[l.champ] = l.valeur;"],
    ['src/entrepriseRecherche.js', 'RCS inventé (ville du siège)', "    const r = rcsDe(villeGreffe, rep.siren);", "    const r = rcsDe(villeGreffe || rep.ville, rep.siren);"],
    ['src/entrepriseRecherche.js', 'une EI « au RCS »', "export const natureAuRcs = (code) => /^[56]\\d{3}$/.test(String(code || '').trim());", "export const natureAuRcs = (code) => /^[156]\\d{3}$/.test(String(code || '').trim());"],
    ['src/entrepriseRecherche.js', 'nom commercial écrit sur la fiche', "info('nomCommercial', 'Nom commercial', rep.nomCommercial)", "champ('nomCommercial', 'Nom commercial', rep.nomCommercial)"],
    ['src/entrepriseRecherche.js', 'franchise posée à une société', "const proposition = !f.societe && !regime ?", "const proposition = !regime ?"],
    ['src/RechercheEntreprise.jsx', 'recherche à chaque chiffre tapé', "if (verif.etat !== 'ok' || typeof chercher !== 'function' || lance.ch !== ch || !lance.n) return undefined;", "if (verif.etat !== 'ok' || typeof chercher !== 'function') return undefined;"],
    ['src/RechercheEntreprise.jsx', 'pas d’arrêt à 8 s', "const minuteur = setTimeout(() => { if (!mort) { mort = true; setRep({ etat: 'lent' }); } }, DELAI_RECHERCHE_MS);", "const minuteur = null;"],
    ['src/facturePro/comptes.js', 'tout compte facturable par défaut', "  return 'demander';\n}", "  return true;\n}"],
    ['api/_lib/facture-autres.js', 'le serveur ne vérifie plus le compte', "if (compteFacturable(cfg || {}, plateforme, compteDeVente(plateforme, brut)) !== true) return repondre(res, 409,", "if (false) return repondre(res, 409,"],
    ['src/facturePro/regle.js', 'le pied VRM revient', "  const texte = corps;", "  const texte = `${corps}\\n\\n—\\nCette facture vous est envoyée par VRM pour le compte de ${nom}.`;"],
    ['src/facturePro/bonRetour.js', 'bon de retour sans le délai', "export const MENTION_RETRACTATION = `Droit de rétractation : ${DELAI_RETRACTATION_J} jours à compter de la réception de l’article (Code de la consommation, art. L221-18).", "export const MENTION_RETRACTATION = `Retour possible.("],
    ['src/FacturePro.jsx', 'factures lues une seule fois', "React.useEffect(() => { if (sansMail && factures_perimees()) relireFactures(deps); }, [sansMail, deps]);", ""],
    ['src/FacturePro.jsx', 'pas de bon de retour', "    <BonRetour vente={vente} preuve={preuve} facture={f} deps={deps} ligne={ligne}/>\n", ""],
  ];
  let rates = 0;
  for (const [fichier, nom, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-fs-'));
    for (const x of ['src', 'api']) fs.cpSync(path.join(RACINE, x), path.join(d, x), { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
    fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules'));
    const p = path.join(d, fichier); const brut = fs.readFileSync(p, 'utf8');
    if (!brut.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; fs.rmSync(d, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, brut.replace(avant, apres));
    const ko = await verifier(d, { muet: true }).catch(() => 1);
    console.log(`${ko ? 'OK  rouge' : 'KO  VERT'} sous mutation : ${nom}${ko ? ` (${ko})` : ''}`);
    if (!ko) rates++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(rates ? `❌ ${rates} mutation(s) pas attrapée(s)` : `✅ ${MUTATIONS.length}/${MUTATIONS.length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
