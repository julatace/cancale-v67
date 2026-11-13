// ════════════════════════════════════════════════════════════════════════════
//  VESTIAIRE « PLUS » (11 nov.) — le parcours d'une vente, les photos exigées,
//  les offres dans Ma journée. Règles PURES exécutées (src/parcoursVestiaire.js,
//  src/photosVestiaire.js, src/offresVestiaire.js) ; formes MESURÉES de `vc_ventes`
//  (11 nov. : etapesVc { sellerSale: done, sellerShipment: pending, … upcoming },
//  etat « ACTION_NEEDED », statutVc « shipmentInProgress »). Données inventées.
//   V1  une vente à envoyer (forme mesurée) : « Colis envoyé » EN COURS, rien d'autre
//       coché — « shipmentInProgress » ne prouve PAS l'envoi.
//   V2  « Colis fait » ⇒ envoyé ; contrôle « pending » ⇒ arrivé + authentification en cours ;
//       contrôle « done » ⇒ validé ; paiement « done » ⇒ payé ; refus seulement DIT par Vestiaire.
//   V3  un mot inconnu de Vestiaire ⇒ « pas su » avec le mot ; aucune donnée ⇒ tout « pas su ».
//   V4  l'argent : versé le … ⇒ le mois du CA (heure de Paris) ; estimé ⇒ pas dans le CA ; rien ⇒ dit.
//   F1  photos : étiquette pas choisie ⇒ manque ; trop peu de photos (chaussures) ⇒ manque ;
//       ce que VRM ne peut pas voir (semelle, n° de série) ⇒ « à vérifier », jamais « ok » ni « manque ».
//   F2  sans clé Photoroom : le fond est CONSEILLÉ, il n'arrête pas « Préparer ».
//   O1  Ma journée : les offres à toi, celle qui expire le plus tôt d'abord, au plus 4, le reste COMPTÉ ;
//       une expirée, une offre envoyée par toi, une offre « pas lue » ⇒ jamais.
//   C1  le code : Ma journée lit `vc_offres` et pousse « vestiaire-offre » ; le récapitulatif
//       monte `ParcoursVestiaire` ; « Préparer » appelle `photosExigeesVc` AVANT l'extension.
//  `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R0 = process.env.VP_RACINE || path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['envoiParMot', 'src/parcoursVestiaire.js', "const envoyeLu = !!colisFait || fait('sellerShipment') || vcVentePartie(v);", "const envoyeLu = !!colisFait || fait('sellerShipment') || /ship/i.test(brut);"],
    ['arriveDevine', 'src/parcoursVestiaire.js', "etape('arrive', controleEnCours || valide || refus || arriveMot || livre || paye, false,", "etape('arrive', envoyeLu || controleEnCours || valide || refus || arriveMot || livre || paye, false,"],
    ['valideDevine', 'src/parcoursVestiaire.js', ": etape('verdict', valide || livre || paye, false,", ": etape('verdict', valide || livre || paye || controleEnCours, false,"],
    ['refusDevine', 'src/parcoursVestiaire.js', "const refus = MOT_REFUS_VC.test(brut) || (inconnu('sellerConformity') && MOT_REFUS_VC.test(s('sellerConformity')));", "const refus = MOT_REFUS_VC.test(brut) || inconnu('sellerConformity');"],
    ['inconnuCoche', 'src/parcoursVestiaire.js', "    if (etatInconnu) return { cle, etat: 'passu', t: null, preuve: '', mot: etatInconnu };\n", ''],
    ['caSansDate', 'src/parcoursVestiaire.js', "  if (est) return { etat: 'estime', texte: est.slice(0, 60) };", "  if (est) return { etat: 'verse', t: Date.now(), mois: '2026-11' };"],
    ['moisUtc', 'src/parcoursVestiaire.js', "timeZone: 'Europe/Paris'", "timeZone: 'UTC'"],
    ['etiquetteOk', 'src/photosVestiaire.js', "etat: etiquette === 'choisie' ? 'ok' : 'manque'", "etat: 'ok'"],
    ['vueDevinee', 'src/photosVestiaire.js', "for (const v of propres) vues.push({ k: v.k, etat: 'a-verifier',", "for (const v of propres) vues.push({ k: v.k, etat: 'ok',"],
    ['fondBloque', 'src/photosVestiaire.js', "const manque = vues.filter((v) => v.etat === 'manque' && v.exige).map((v) => v.k);", "const manque = vues.filter((v) => v.etat === 'manque').map((v) => v.k);"],
    ['offresOrdre', 'src/offresVestiaire.js', "const l = etat.aTrancher.slice().sort((a, b) => (a.expire == null ? Infinity : a.expire) - (b.expire == null ? Infinity : b.expire));", 'const l = etat.aTrancher.slice().reverse();'],
    ['offresReste', 'src/offresVestiaire.js', "reste: Math.max(0, l.length - max), total: l.length };", 'reste: 0, total: l.length };'],
    ['offresPasSu', 'src/offresVestiaire.js', "if (!etat || etat.etat !== 'lu' || !Array.isArray(etat.aTrancher)) return null;", "if (!etat || !Array.isArray(etat.aTrancher)) return { lignes: [], reste: 0, total: 0 };"],
  ];
  let tous = true;
  for (const [nom, f, avant, apres] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-'));
    const r = spawnSync('bash', ['-c', `cd "${R0}" && git ls-files -z src api/_lib | xargs -0 -I{} cp --parents {} "${tmp}"; cp --parents scripts/_source-app.cjs "${tmp}" 2>/dev/null; true`]);
    void r;
    const p = path.join(tmp, f);
    const txt = fs.readFileSync(path.join(R0, f), 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    fs.writeFileSync(p, txt.replace(avant, apres));
    const res = spawnSync(process.execPath, [__filename], { encoding: 'utf8', env: { ...process.env, VP_RACINE: tmp }, timeout: 60000 });
    const rouges = ((res.stdout || '').match(/^❌/gm) || []).length;
    const ok = res.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || det === undefined ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500)}`); };
const imp = (f) => import(pathToFileURL(path.join(R0, f)).href);
const etats = (p) => p.etapes.map((x) => x.etat).join(',');

(async () => {
  let P, Ph, O;
  try { P = await imp('src/parcoursVestiaire.js'); Ph = await imp('src/photosVestiaire.js'); O = await imp('src/offresVestiaire.js'); }
  catch (e) { dit(false, 'les règles se chargent', String(e && e.message)); console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  const MES = { etat: 'ACTION_NEEDED', statutVc: 'shipmentInProgress', aExpedier: true, etapesVc: { sellerSale: 'done', sellerShipment: 'pending', sellerConformity: 'upcoming', sellerDelivery: 'upcoming', sellerPayment: 'upcoming' }, paiementEstime: 'Paiement estimé le 24 nov.' };
  const p1 = P.parcoursVenteVc(MES);
  dit(etats(p1) === 'encours,avenir,avenir,avenir,avenir', 'V1 · la vente à envoyer (forme mesurée) : envoi EN COURS, rien d’autre coché (« shipmentInProgress » ne prouve pas l’envoi)', etats(p1));
  const p2 = P.parcoursVenteVc(MES, 1762800000000);
  dit(etats(p2) === 'fait,avenir,avenir,avenir,avenir' && p2.etapes[0].preuve === 'colis-fait', 'V2 · « Colis fait » posé par lui ⇒ envoyé, et RIEN de plus (jamais « arrivé » par le temps)', etats(p2));
  const ctl = { ...MES, aExpedier: false, etapesVc: { ...MES.etapesVc, sellerShipment: 'done', sellerConformity: 'pending' } };
  dit(etats(P.parcoursVenteVc(ctl)) === 'fait,fait,encours,avenir,avenir', 'V2 · contrôle « pending » ⇒ arrivé chez Vestiaire + authentification EN COURS, pas validé', etats(P.parcoursVenteVc(ctl)));
  const val = { ...ctl, etapesVc: { ...ctl.etapesVc, sellerConformity: 'done' } };
  dit(etats(P.parcoursVenteVc(val)) === 'fait,fait,fait,fait,avenir', 'V2 · contrôle « done » ⇒ validé ; payé seulement plus tard', etats(P.parcoursVenteVc(val)));
  const paye = { ...val, etapesVc: { ...val.etapesVc, sellerDelivery: 'done', sellerPayment: 'done' }, verseLe: '2026-11-30T23:30:00Z' };
  const pp = P.parcoursVenteVc(paye);
  dit(etats(pp) === 'fait,fait,fait,fait,fait' && pp.argent.etat === 'verse' && pp.argent.mois === '2026-12', 'V4 · payé, versé le 30 nov. à 23 h 30 UTC ⇒ CA de DÉCEMBRE (heure de Paris)', [etats(pp), pp.argent]);
  const ref = { ...ctl, etat: 'REJECTED', statutVc: 'qualityControlFailed', etapesVc: { ...ctl.etapesVc, sellerConformity: 'failed' } };
  const pr = P.parcoursVenteVc(ref);
  dit(pr.refusee === true && pr.etapes[3].etat === 'refuse' && pr.etapes[4].etat === 'avenir', 'V2 · refusé seulement DIT par Vestiaire (« rejected », « failed ») ; rien n’est payé', [etats(pr), pr.etapes[3]]);
  const inc = { ...ctl, etapesVc: { ...ctl.etapesVc, sellerConformity: 'onHold' } };
  const pi = P.parcoursVenteVc(inc);
  dit(pi.etapes[2].etat === 'passu' && pi.etapes[2].mot === 'onhold' && pi.etapes[3].etat !== 'fait' && pi.refusee === false, 'V3 · un mot inconnu (« onHold ») ⇒ « pas su » avec le mot, jamais coché ni refusé', pi.etapes[2]);
  const vide = P.parcoursVenteVc({ id: '1', productId: '2' });
  dit(etats(vide) === 'passu,passu,passu,passu,passu' && vide.argent.etat === 'passu', 'V3 · aucune donnée de suivi ⇒ tout « pas su » (jamais « à venir » inventé)', etats(vide));
  dit(p1.argent.etat === 'estime' && p1.argent.texte === MES.paiementEstime && !p1.argent.mois, 'V4 · paiement ESTIMÉ par Vestiaire ⇒ dit tel quel, dans AUCUN mois du CA', p1.argent);
  const fr = P.friseParcoursVc(pp, { envoye: 'E' });
  dit(Array.isArray(fr) && fr.length === 5 && fr.every((x) => x.fait) && fr[4].derniere === true, 'V4 · la frise existante reçoit les 5 étapes (la dernière faite marquée)', fr);

  const f1 = Ph.photosExigeesVc({ famille: 'chaussures', nPhotos: 2, etiquette: 'pas-choisie', photoroom: true });
  dit(f1.manque.includes('etiquette2') && f1.manque.includes('nombre') && f1.liste === 'faq', 'F1 · chaussures, 2 photos, étiquette pas choisie ⇒ manquent : l’étiquette en 2ᵉ, le nombre (au moins 4)', f1.manque);
  const vs = Object.fromEntries(f1.vues.map((v) => [v.k, v.etat]));
  dit(vs.semelle === 'a-verifier' && vs.serie === 'a-verifier' && vs.origine === 'a-verifier' && vs.pointure === 'a-verifier', 'F1 · ce que VRM ne voit pas (semelle, n° de série, preuve d’origine) ⇒ « à vérifier », jamais « ok »', vs);
  const f2 = Ph.photosExigeesVc({ famille: 'chaussures', nPhotos: 6, etiquette: 'choisie', photoroom: false });
  dit(f2.manque.length === 0 && f2.conseille.includes('fond'), 'F2 · sans clé Photoroom : le fond est CONSEILLÉ, rien ne bloque', f2);
  const f3 = Ph.photosExigeesVc({ famille: 'vetements', nPhotos: 5, etiquette: 'choisie', photoroom: null });
  dit(f3.liste === 'pas-relue' && f3.vues.find((v) => v.k === 'nombre').etat === 'a-verifier', 'F1 · une catégorie dont la liste n’a pas été relue le DIT (pas d’« ok » inventé)', f3);

  const T = Date.parse('2026-11-11T10:00:00Z');
  const o = (id, exp, d) => ({ id, produit: '9' + id, aToi: true, ouverte: true, expire: exp == null ? '' : new Date(T + exp).toISOString(), dernier: d || { action: 'offer', par: 'acheteur', at: '2026-11-10T10:00:00Z', cents: 10000 }, offre: 10000 });
  const ligne = { offres: { n101: o('101', 30 * 3600e3), n102: o('102', 2 * 3600e3), n103: o('103', null), n104: o('104', -3600e3), n105: o('105', 50 * 3600e3, { action: 'offer', par: 'vendeur', at: '2026-11-10T10:00:00Z' }), n106: o('106', 10 * 3600e3), n107: o('107', 20 * 3600e3), n108: o('108', 40 * 3600e3) } };
  const j = O.offresJourneeVc(O.offresVestiaire(ligne, T), T);
  dit(!!j && j.lignes.map((x) => x.id).join(',') === '102,106,107,101' && j.reste === 2 && j.total === 6, 'O1 · Ma journée : celles qui expirent le plus tôt d’abord, 4 lignes, le reste COMPTÉ (2) ; expirée et offre envoyée jamais', j && [j.lignes.map((x) => x.id), j.reste, j.total]);
  dit(!!j && j.lignes[0].bientot === true && j.lignes[1].bientot === false, 'O1 · sous 6 h : « bientôt » (ambre) ; au-delà : non', j && j.lignes.map((x) => x.bientot));
  dit(O.offresJourneeVc(O.offresVestiaire(null, T), T) === null && O.offresJourneeVc(O.offresVestiaire(undefined, T), T) === null, 'O1 · offres pas lues ⇒ Ma journée se tait (jamais « 0 offre »)');

  const SRC = (f) => { try { return fs.readFileSync(path.join(R0, f), 'utf8'); } catch (_) { return ''; } };
  const APP = SRC('src/App.jsx');
  dit(/id=in\.\(vc_ventes,vc_messages,vc_achats,vc_listings,vc_offres\)/.test(APP) && /id: 'vestiaire-offre'/.test(APP) && /offresJourneeVc\(offresVestiaire\(vcEtat\.offres\)\)/.test(APP), 'C1 · Ma journée lit `vc_offres` et pousse une ligne « vestiaire-offre » par offre');
  const VC = SRC('src/ecrans/Vestiaire.jsx');
  dit(/<ParcoursVestiaire v=\{v\}/.test(VC) && /photosExigeesVc\(photosDe\(p\)\)[\s\S]{0,2500}vmrCmd\(\{ cmd: 'vcPreparer'/.test(VC), 'C1 · le récapitulatif monte le parcours ; « Préparer » vérifie les photos AVANT d’appeler l’extension');
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ Vestiaire plus : tout est vert');
  process.exit(ko ? 1 : 0);
})();
