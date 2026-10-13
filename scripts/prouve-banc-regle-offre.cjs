// ════════════════════════════════════════════════════════════════════════════
//  LA RÈGLE D'OFFRE eBAY — LE BANC DE RENDU PROUVÉ PAR MUTATION (9 octobre)
//    node scripts/prouve-banc-regle-offre.cjs [--seule nom] [--avant dossier]
//
//  « La fonction n'existait pas avant » ne prouve rien (CLAUDE.md §6.1) : pour
//  chaque mutation, une copie de l'arbre courant (src/, public/, index.html,
//  vite.config.js, package.json et le banc — jamais `scripts/bancs/fx`) dans
//  os.tmpdir()/mut-banc-{nom} — avec api/ et supabase/, que `App.jsx` importe —, UN défaut injecté dans `src/App.jsx` (ancre
//  exacte, trouvée UNE fois — sinon ROUGE « non appliquée »), `vite build`
//  DANS la copie, puis le banc COPIÉ dedans et lancé DEPUIS elle (son `DIST`
//  se déduit de son `__dirname` : il rend le build muté, jamais `dist/` du
//  dépôt). Il doit sortir ≠ 0, avec un rouge dans chacun des blocs nommés.
//  `--avant dossier` : le même banc sur le build de la base d'avant (aucune
//  règle d'offre) doit sortir ROUGE lui aussi.
//  Le banc écoute le port 4761 (ou $PORT) : lancer ce script SEUL.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const RACINE = path.join(__dirname, '..');
const VITE = path.join(RACINE, 'node_modules', 'vite', 'bin', 'vite.js');
const iSeule = process.argv.indexOf('--seule');
const SEULE = iSeule > 0 ? process.argv[iSeule + 1] : null;
const iAv = process.argv.indexOf('--avant');
const AVANT = iAv > 0 ? path.resolve(process.argv[iAv + 1]) : null;

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// [nom, [[ancre, remplacement], …], blocs du banc qui doivent rougir]
const MUTATIONS = [
  // « pas su » devient « aucune » quand rien n'est rangé pour l'annonce.
  ['pas-su-aucune', [["  if (!e) return { etat: 'pas-su', raison: 'jamais', risque: false };", "  if (!e) return { etat: 'aucune', refuse: null, offresActives: null, offresFaites: null, lueA: 0, lu: { accepte: null, refuse: null } };"]], [1]],
  // la carte envoie le compte de PUBLICATION, pas celui de l'annonce.
  ['compte-vue', [['      Object.assign(corps, corpsCompteEbay(it._compte));', "      Object.assign(corps, corpsCompteEbay(load('vrm_ebay_compte_pub', '') || 'principal'));"]], [7]],
  // le lot part en parallèle.
  ['parallele', [["    for (let i = 0; i < fige.length; i++) {\n      if (!vivant.current || arret.current) break;\n      const x = fige[i];\n      envoyes.current = i + 1;\n      setProgres(i + 1);\n      const rep = await appelEbay(",
    "    const tous = fige.map((x) => appelEbay({ action: 'regleoffre', itemId: x.itemId, accepte: x.seuil, prixVu: x.prixVu, attendu: x.attendu, confirme: true, ...corpsCompteEbay(x.compte) }));\n    for (let i = 0; i < fige.length; i++) {\n      if (!vivant.current || arret.current) break;\n      const x = fige[i];\n      envoyes.current = i + 1;\n      setProgres(i + 1);\n      const rep = await tous[i]; void ("]], [9]],
  // l'envoi part AVANT la feuille de confirmation (la carte et le lot).
  ['annuler-envoie', [
    ['      const ok = await askConfirm({ title: `eBay acceptera seul les offres dès ${eurEbay(X)} ?`', "      await appelEbay({ action: 'regleoffre', itemId: String(it.itemId), accepte: X, prixVu: prixVuN, attendu: attenduDe(et), confirme: true, ...corpsCompteEbay(it._compte) });\n      const ok = await askConfirm({ title: `eBay acceptera seul les offres dès ${eurEbay(X)} ?`"],
    ['    const ok = await askConfirm({ title: `Laisser eBay accepter les offres sur', "    for (const l of selection) await appelEbay({ action: 'regleoffre', itemId: String(l.it.itemId), accepte: l.seuil, prixVu: l.prix, attendu: attenduDe(l.etat), confirme: true, ...corpsCompteEbay(l.it._compte || 'principal') });\n    const ok = await askConfirm({ title: `Laisser eBay accepter les offres sur"],
  ], [5, 9]],
  // l'aperçu porte sur TOUTES les annonces, pas sur celles de la vue.
  ['vue-ignoree', [['<EbayReglesToutes items={itemsVue}', '<EbayReglesToutes items={items}']], [9]],
  // plus aucune paire n'est bloquée (vendue, deux comptes, vente pas vérifiée).
  ['garde-vendue', [['  const regleBloquee = (it) => {\n    const n = numDeSkuEbay(it && it.sku);', '  const regleBloquee = (it) => { if (it) return null;\n    const n = numDeSkuEbay(it && it.sku);']], [10]],
  // la carte envoie toujours `refuse` (null quand rien n'est saisi ni lu).
  ['refuse-null-pas-su', [['      if (refuseCle !== undefined) corps.refuse = refuseCle;', '      corps.refuse = refuseCle === undefined ? null : refuseCle;']], [8]],
  // « ok » sans la relecture conforme d'eBay.
  ['verifie-ignore', [["  if (j && j.ok && j.verifie === true) return { issue: 'ok'", "  if (j && j.ok) return { issue: 'ok'"]], [8, 9]],
  // « Relire chez eBay » sans le compte.
  ['relire-sans-compte', [["          const { j } = await appelEbay({ action: 'regleoffrelire', itemIds: paquet.map((it) => String(it.itemId)), ...corpsCompteEbay(ref) });", "          const { j } = await appelEbay({ action: 'regleoffrelire', itemIds: paquet.map((it) => String(it.itemId)) });"]], [4]],
  // un « ✓ » en VERT (la règle du §7 : une seule couleur d'accent, jamais de vert).
  ['couleur-vert', [
    ["? E.text : E.warn, margin: '0 14px 11px'", "? '#34C759' : E.warn, margin: '0 14px 11px'"],
    ["color: msgTon === 'ok' ? E.text : E.warn, marginTop: 7", "color: msgTon === 'ok' ? '#34C759' : E.warn, marginTop: 7"],
  ], [5, 11]],
  // la fenêtre « Vinted → eBay » cachée quand le retrait automatique est allumé.
  ['fenetre-masquee', [["      <div data-regles-fenetre style={{ marginTop: 6, color: E.muted, fontSize: 12 }}>", "      <div {...(retraitAuto ? { hidden: true } : { 'data-regles-fenetre': '' })} style={{ marginTop: 6, color: E.muted, fontSize: 12 }}>"]], [2]],
  // ── Revue du 11 octobre ──
  // la relecture qui montre le seuil (offres pas montrées) redevient « pas relu ».
  ['relu-non-relu', [["  if (j && j.ok && lecture) return { issue: 'offres-inconnues', lecture, nonNote, avertissements: j.avertissements || [], erreurs: j.erreurs || [] };\n", '']], [8]],
  // un prix tapé illisible repasse pour « inchangé ».
  ['prix-illisible', [['    if (prixIllisible) {', '    if (false) {']], [11]],
  // l'issue d'un lot reste sous une ligne qui propose un autre montant.
  ['issue-montant', [["    const r = r0 && (r0.issue === 'a-revoir' || (l.seuil != null && cents(r0.seuilEnvoye) === cents(l.seuil))) ? r0 : null;", '    const r = r0;']], [14]],
  // l'aperçu calcule sur le prix de la liste, pas celui que la carte affiche.
  ['apercu-prix', [['    const p0 = prixDe ? prixDe(it) : it.price;', '    const p0 = it.price;']], [14]],
  // deux seuils pour « lue il y a plus de 7 jours ».
  ['age-seuils', [['  const vieillesRegles = connues.filter((it) => regleVieille(etatVue(it))).length;', '  const vieillesRegles = connues.filter((it) => Date.now() - (Number(etatVue(it).lueA) || 0) > 7 * 86400000).length;']], [14]],
  // la porte n'est plus grisée pendant un lot : SEUL le contrôle de la porte
  // doit rougir — fermer le panneau pour de vrai ne doit RIEN casser d'autre
  // (la réponse en vol s'applique, les cartes sont rendues, l'arrêt est dit).
  ['porte-lot', [['  const porteGrisee = regles === undefined || lotEnCours;', '  const porteGrisee = regles === undefined;']], [14],
    { exiges: [/porte « Fermer « Une règle pour toutes » » est grisée/], interdits: [/ne dit jamais « aucune »/, /ne restent pas grisées/, /est DIT tout de suite/] }],
  // …et si, en plus, le démontage jette la réponse en vol, ne rend pas les
  // cartes et ne prévient pas l'écran : les trois conséquences rougissent.
  ['porte-et-demontage', [
    ['  const porteGrisee = regles === undefined || lotEnCours;', '  const porteGrisee = regles === undefined;'],
    ['      const loc = localApresRegle(r0);\n      if (onRegle && (loc.entree !== undefined || loc.prix !== undefined)) onRegle(x.cle, loc.entree, loc.prix);\n      if (!vivant.current) break;\n', '      if (!vivant.current) break;\n      const loc = localApresRegle(r0);\n      if (onRegle && (loc.entree !== undefined || loc.prix !== undefined)) onRegle(x.cle, loc.entree, loc.prix);\n'],
    ['      if (onLot) onLot([]);\n      if (onFini) await onFini();\n      return;\n', '      return;\n'],
    ['        if (n > 0 && rappels.current.onInterrompu) rappels.current.onInterrompu({ n, at: Date.now() });\n', ''],
  ], [14], { exiges: [/ne dit jamais « aucune »/, /ne restent pas grisées/, /est DIT tout de suite/] }],
  // ── Revue du 11 octobre, tour 2 ──
  // ✏️ : le champ Prix repart de la LISTE (une copie figée) et c'est lui qui part.
  ['champ-prix-fige', [
    ["  const champPrix = price != null ? price : (prixCarte == null || prixCarte === '' ? '' : String(prixCarte).replace('.', ','));", "  const champPrix = price != null ? price : String(it.price || '').replace('.', ',');"],
    ["  const prixTape = montantSaisi(price == null ? '' : price);", '  const prixTape = montantSaisi(champPrix);'],
  ], [15], { exiges: [/la carte ET le champ Prix de ✏️/, /changer le STOCK seul n'envoie AUCUN prix/], interdits: [/chaque ligne affiche son issue/, /la relecture de A4 rate/] }],
  // « offres-inconnues » redevient une raison qu'on relit chez eBay.
  ['offres-inconnues-relire', [["const PAS_SU_SANS_RELECTURE = ['illisible', 'devise', 'offres-inconnues'];", "const PAS_SU_SANS_RELECTURE = ['illisible', 'devise'];"]], [15], { exiges: [/ne renvoie PAS relire/] }],
  // la ligne du haut la compte de nouveau parmi les « pas encore lues » (et propose « Relire »).
  ['offres-inconnues-ligne', [['  const nPasLueRegle = pasSuRegle.length - offresInconnuesRegle.length;', '  const nPasLueRegle = pasSuRegle.length;']], [15], { exiges: [/ne propose plus « Relire chez eBay »/], interdits: [/ne renvoie PAS relire/] }],
  // « Une règle pour toutes » la remet « à relire d'abord ».
  ['offres-inconnues-lot', [["    if (e && e.etat === 'pas-su' && e.raison === 'offres-inconnues') return { ...base, statut: 'a-voir-ebay', note: 'seuil lu ; offres activées ou non : eBay ne le montre pas' };\n", '']], [15], { exiges: [/elle n'est ni « à relire d'abord »/] }],
  // la garde repart à « inconnu » sur un seuil relu (le 409 « eBay a déjà une règle » sans fin).
  ['attendu-inconnu', [["const attenduDe = (et) => (et && (et.etat === 'connue' || et.etat === 'aucune' || (et.etat === 'pas-su' && et.raison === 'offres-inconnues')) && et.lu)", "const attenduDe = (et) => (et && (et.etat === 'connue' || et.etat === 'aucune') && et.lu)"]], [15], { exiges: [/le panneau montre le seuil LU/] }],
  // une issue « à revoir » de nouveau cachée dès que le montant de la ligne change.
  ['issue-a-revoir', [["    const r = r0 && (r0.issue === 'a-revoir' || (l.seuil != null && cents(r0.seuilEnvoye) === cents(l.seuil))) ? r0 : null;", '    const r = r0 && l.seuil != null && cents(r0.seuilEnvoye) === cents(l.seuil) ? r0 : null;']], [15], { exiges: [/chaque ligne affiche son issue/], interdits: [/la carte ET le champ Prix de ✏️/] }],
  // une relecture RATÉE reposée localement par-dessus ce que VRM savait.
  ['relire-ratee-locale', [["            if (l && typeof l === 'object' && l.lu === true) surRegle(ref + ':' + id, l, Number.isFinite(Number(l.prix)) ? Number(l.prix) : undefined);", "            if (l && typeof l === 'object' && (l.lu === true || (l.raison && l.raison !== 'pas-sur-ce-compte' && l.raison !== 'pas-su'))) surRegle(ref + ':' + id, l, Number.isFinite(Number(l.prix)) ? Number(l.prix) : undefined);"]], [15], { exiges: [/la relecture de A4 rate/] }],
  // ── Revue du 11 octobre, tour 3 ──
  // la relecture des ventes à l'ouverture ne compte que les règles « connues » (le filtre brut d'avant).
  ['ventes-relues-brut', [['    const avecRegle = reglesEngagees([...parRef.values()]).refs;', "    const avecRegle = new Set([...regles.map].filter(([, e]) => e && e.lu === true && e.accepte != null && e.offresActives === true).map(([k]) => k.slice(0, k.lastIndexOf(':'))));"]], [16], { exiges: [/ses ventes eBay sont relues à l'ouverture/] }],
  // « ce que ça engage » ne compte plus les règles qu'eBay tient peut-être.
  ['bloc-connue-seule', [["  const peutEtreRegle = itemsVue.filter((it) => regleEngage(etatVue(it)) === 'peut-etre');", '  const peutEtreRegle = [];']], [16], { exiges: [/ses ventes eBay sont relues à l'ouverture/], interdits: [/la feuille « Déconnecter le compte eBay » dit/] }],
  // la déconnexion compte de nouveau la ligne BRUTE (offres actives sur toutes les entrées).
  ['compter-brut', [['  return { oui: n.oui, peutEtre: n.peutEtre };\n}', "  let brut = 0; for (const x of R.lignes) for (const e of Object.values((x.ligne && x.ligne.items) || {})) if (e && e.lu === true && e.accepte != null && e.offresActives === true) brut++;\n  return { oui: brut, peutEtre: 0 };\n}"]], [16], { exiges: [/la feuille « Déconnecter le compte eBay » dit/, /la feuille de déconnexion AUSSI/] }],
  // « Retirer la règle » sur une paire bloquée seulement quand la règle est « connue ».
  ['retirer-direct-connue', [["              {bloquee && regleEngage(et) && <button type=\"button\" data-regle-retirer-direct={it.itemId}", "              {bloquee && et.etat === 'connue' && <button type=\"button\" data-regle-retirer-direct={it.itemId}"]], [16], { exiges: [/« Retirer la règle » est là, actif/, /« Retirer la règle » est sur sa carte/] }],
  // la feuille du lot ne dit plus qu'une offre déjà faite peut être acceptée.
  ['lot-sans-offres-faites', [['      texteOffresDejaFaites(f, n),\n', '']], [16], { exiges: [/qu'une offre déjà faite peut être acceptée dès la pose/] }],
  // « pas sur ce compte » de nouveau avalé par « Relire chez eBay ».
  ['relire-absente-avalee', [["            else if (l && typeof l === 'object' && l.raison === 'pas-sur-ce-compte') {", "            else if (false) {"]], [16], { exiges: [/eBay dit A3 absente de ce compte/] }],
  // la carte ne montre plus le seuil relu ni son lien (offres activées ou non).
  ['offres-inconnues-sans-lien', [["        const seuilMontre = et.etat === 'pas-su' && et.raison === 'offres-inconnues' && et.lu && et.lu.accepte != null;", '        const seuilMontre = false;']], [16], { exiges: [/chaque carte dit son seuil et porte SON lien/] }],
  // « Relire chez eBay » compte de nouveau l'autre devise et notre lecture ratée.
  ['devise-relire', [['  const nPasLueRegle = relisablesRegle.length;', '  const nPasLueRegle = pasSuRegle.length - offresInconnuesRegle.length;']], [13, 16], { exiges: [/il ne reste que la devise : plus de « Relire chez eBay »/, /« Relire chez eBay » n'est PAS proposé/] }],
  // le lot repasse « ✓ réglée » sur une règle que VRM n'a pas pu noter.
  ['lot-non-note', [["  const couleurIssue = (r) => (r.issue === 'ok' && !r.nonNote ? E.text : E.warn);", "  const couleurIssue = (r) => (r.issue === 'ok' ? E.text : E.warn);"], ["    if (r.nonNote && r.issue === 'ok') return `posée par eBay — ${NON_NOTE}`;\n", '']], [16], { exiges: [/VRM n'a pas pu la noter : la ligne ne dit pas « ✓ réglée »/] }],
  // une programmée partie n'est de nouveau relue nulle part.
  ['partie-sans-relecture', [['    if (!refs.size) return;\n    (async () => { for (const ref of refs) await resync(ref); })();\n  }, [connected, items, programmees,', '    return;\n  }, [connected, items, programmees,']], [16], { exiges: [/une programmée partie avec sa règle/] }],
  // « Une règle pour toutes » repropose « Relire ces annonces chez eBay » sur notre lecture ratée.
  ['lot-illisible-relire', [["    if (e && e.etat === 'pas-su' && e.raison === 'illisible') return { ...base, statut: 'illisible', note: 'règle actuelle pas lisible dans VRM — rien n\\'est remplacé à l\\'aveugle' };\n", '']], [13], { exiges: [/« Une règle pour toutes » ne propose pas « Relire ces annonces chez eBay »/] }],
  // (le planificateur, banc ebay-programmer) la feuille ne dit plus qu'une offre acceptée vend la paire.
  ['planif-vend', [["      ? `\\n${avecOffre.length} avec une règle d'offre — dès la mise en ligne, toute offre égale ou supérieure au montant ${OFFRE_VEND_LA_PAIRE} :`", "      ? `\\n${avecOffre.length} avec une règle d'offre — eBay acceptera seul les offres dès :`"]], null, { banc: 'ebay-programmer.cjs', exiges: [/la feuille du lot dit qu'une offre acceptée par eBay VEND la paire/] }],
  // (la publication, banc ebay-form) la ligne de la règle ignore la lecture.
  ['publie-pas-relue', [["  const res = resultatRegleOffre({ code: 200, j: { ok: true, verifie: o.verifie, lecture: o.lecture || null,", "  const res = resultatRegleOffre({ code: 200, j: { ok: true, verifie: o.verifie, lecture: null,"]], null, { banc: 'ebay-form.cjs', exiges: [/publiée avec une règle, seuil relu sans l'état des offres/] }],
  // (tour 4, #7) « Relire chez eBay » ne propage plus le prix relu : prix-change
  //   ne se lève jamais quand la liste est en retard.
  ['relire-sans-prix', [["            if (l && typeof l === 'object' && l.lu === true) surRegle(ref + ':' + id, l, Number.isFinite(Number(l.prix)) ? Number(l.prix) : undefined);", "            if (l && typeof l === 'object' && l.lu === true) surRegle(ref + ':' + id, l);"]], [18], { exiges: [/« Relire chez eBay » le LÈVE/] }],
  // (tour 4, #9.2) la branche offres-inconnues ne porte plus offresFaites : le
  //   panneau ne prévient plus qu'une offre déjà faite peut être acceptée.
  ['offres-inconnues-sans-faites', [["  if (avaitRegle && e.offresActives == null) return { etat: 'pas-su', raison: 'offres-inconnues', risque: true, offresFaites, lu };", "  if (avaitRegle && e.offresActives == null) return { etat: 'pas-su', raison: 'offres-inconnues', risque: true, lu };"]], [18], { exiges: [/offresFaites porté/] }],
  // (tour 4, #11) une pose non notée (range:false) redevient « connue » locale :
  //   la carte ment (la base ne la porte pas) et renvoie vers un bouton absent.
  ['nonnote-connue', [["  if (res && res.nonNote && res.issue !== 'a-revoir') return { entree: { lu: false, raison: 'apres-ecriture', lueA: Date.now() }, prix };\n", '']], [8], { exiges: [/posée mais pas notée/] }],
];

function copier(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.join(dest, 'scripts', 'bancs'), { recursive: true });
  // `src/App.jsx` importe aussi `api/_lib/` et `supabase/migrations/` : ils voyagent avec.
  for (const d of ['src', 'public', 'api', 'supabase']) fs.cpSync(path.join(RACINE, d), path.join(dest, d), { recursive: true });
  for (const f of ['index.html', 'package.json', 'vite.config.js']) fs.copyFileSync(path.join(RACINE, f), path.join(dest, f));
  for (const f of ['ebay-regle-offre.cjs', 'ebay-programmer.cjs', 'ebay-form.cjs', '_meta.cjs']) fs.copyFileSync(path.join(RACINE, 'scripts', 'bancs', f), path.join(dest, 'scripts', 'bancs', f));
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules')); } catch (_) {}
}
function appliquer(dest, rempl) {
  const p = path.join(dest, 'src', 'App.jsx');
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b] of rempl) {
    const n = s.split(a).length - 1;
    if (n !== 1) return `ancre trouvée ${n} fois : ${a.slice(0, 80)}`;
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(p, s);
  return '';
}
const construire = (dest) => cp.spawnSync(process.execPath, [VITE, 'build', '--logLevel', 'error'], { cwd: dest, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
const banc = (dest, args, nomBanc) => cp.spawnSync(process.execPath, [path.join(dest, 'scripts', 'bancs', nomBanc || 'ebay-regle-offre.cjs'), ...args], { cwd: dest, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });

for (const [nom, rempl, blocs, precis] of MUTATIONS) {
  if (SEULE && SEULE !== nom) continue;
  const dest = path.join(os.tmpdir(), 'mut-banc-' + nom);
  copier(dest);
  const err = appliquer(dest, rempl);
  if (err) { dit(false, `mutation « ${nom} » non appliquée`, err); continue; }
  const b = construire(dest);
  if (b.status !== 0) { dit(false, `mutation « ${nom} » : le build de la copie a échoué`, ((b.stderr || '') + (b.stdout || '')).split('\n').slice(0, 3).join(' | ')); continue; }
  // (tour 3) Une mutation peut viser un AUTRE banc (le planificateur, la
  // publication) : on le lance tel quel ; un contrôle rouge s'y écrit « KO » ou « ❌ ».
  if (precis && precis.banc) {
    const r2 = banc(dest, [], precis.banc);
    const s2 = (r2.stdout || '') + (r2.stderr || '');
    const kos2 = s2.split('\n').filter((l) => /^(KO\s|❌)/.test(l));
    dit(r2.status !== 0 && (precis.exiges || []).every((re) => kos2.some((l) => re.test(l))), `mutation « ${nom} » : le banc ${precis.banc} passe au ROUGE sur ${(precis.exiges || []).map((re) => re.source.slice(0, 50)).join(' · ')}`, `sortie ${r2.status} · ${kos2.slice(0, 2).join(' | ').slice(0, 200)}`);
    fs.rmSync(dest, { recursive: true, force: true });
    continue;
  }
  const r = banc(dest, ['--blocs', blocs.join(','), '--taille', '1512']);
  const s = (r.stdout || '') + (r.stderr || '');
  const rouges = blocs.map((n) => [n, (s.match(new RegExp('^KO  \\[' + n + '\\]', 'gm')) || []).length]);
  const premier = (s.match(/^KO  .*$/m) || [''])[0].slice(4, 150);
  dit(r.status !== 0 && rouges.every(([, k]) => k > 0), `mutation « ${nom} » : le banc passe au ROUGE`, `sortie ${r.status} · ${rouges.map(([n, k]) => `[${n}] ×${k}`).join(', ')} · ${premier}`);
  // Ce qui DOIT rougir, et ce qui doit rester vert (on prouve un contrôle
  // précis, pas « le bloc tombe »).
  if (precis) {
    const kos = (s.match(/^KO  .*$/gm) || []);
    for (const re of precis.exiges || []) dit(kos.some((l) => re.test(l)), `mutation « ${nom} » : ROUGE sur ${re.source.slice(0, 60)}`);
    for (const re of precis.interdits || []) dit(!kos.some((l) => re.test(l)), `mutation « ${nom} » : reste VERT sur ${re.source.slice(0, 60)}`, kos.filter((l) => re.test(l)).join(' | ').slice(0, 200));
  }
  fs.rmSync(dest, { recursive: true, force: true });
}

if (AVANT && !SEULE) {
  // Le build de la base d'avant : aucun `data-regle-offre`, le banc doit tomber.
  const dest = path.join(os.tmpdir(), 'mut-banc-avant');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.join(dest, 'scripts', 'bancs'), { recursive: true });
  for (const d of ['src', 'public', 'api', 'supabase']) fs.cpSync(path.join(AVANT, d), path.join(dest, d), { recursive: true });
  for (const f of ['index.html', 'package.json', 'vite.config.js']) fs.copyFileSync(path.join(AVANT, f), path.join(dest, f));
  for (const f of ['ebay-regle-offre.cjs', '_meta.cjs']) fs.copyFileSync(path.join(RACINE, 'scripts', 'bancs', f), path.join(dest, 'scripts', 'bancs', f));
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules')); } catch (_) {}
  const b = construire(dest);
  if (b.status !== 0) dit(false, 'le build de la base d\'avant a échoué', (b.stderr || '').split('\n')[0]);
  else {
    const r = banc(dest, ['--taille', '1512']);
    const s = (r.stdout || '') + (r.stderr || '');
    const nKo = (s.match(/^KO  /gm) || []).length, nOk = (s.match(/^OK  /gm) || []).length;
    dit(r.status !== 0 && nKo > 0, 'sur le build de la base d\'avant, le banc est ROUGE', `sortie ${r.status} · ${nKo} rouge(s), ${nOk} vert(s)`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
}

console.log(`\n${ko ? '❌' : '✅'} prouve-banc-regle-offre : ${ok} vert(s), ${ko} rouge(s)${ko ? '' : ' — chaque règle de l\'écran, réaffaiblie, fait tomber le banc'}`);
process.exit(ko ? 1 : 0);
