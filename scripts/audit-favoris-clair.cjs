// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — Messages aux favoris en trois temps, les RÈGLES (11 nov., lot favoris-clair)
//  EXÉCUTE src/favorisParcours.js et src/favorisJournee.js (données inventées) :
//   · QUI : le nombre de personnes, aucune identité ; seuls les NOUVEAUX favoris
//     (après le dernier envoi) par défaut, les anciens comptés à part ;
//   · AUCUN nombre fixe de messages par envoi (plafond 10/60 min RETIRÉ, CLAUDE.md §3) : seule
//     borne les gestes libres de l'heure (45) ; au-delà, la file ATTEND (serveur exécuté) ;
//   · l'offre au centime, la remise en € et en % (prixOffreFavori) ;
//   · la durée « environ » au rythme choisi, « pas su » si illisible ;
//   · les gestes : 2 par message, 3 avec l'offre, face aux 45/h (jauge pas lue ⇒ pas su) ;
//   · la marge : à perte ou sous le prix mini ⇒ BLOQUÉE ; prix d'achat inconnu ⇒ « — » ;
//   · l'historique : achat compté seulement par la même annonce ET la même
//     personne ET après le message ; acheteur pas su ⇒ dit à part ;
//   · « ce qui marche » par envoi ; l'offre groupée par identité prouvée seulement ;
//   · le suivi : chaque état de la file a son issue (envoyé ✓, à vérifier = à
//     la main, jamais « réussi ») ; la carte de Ma journée (24 h, annonces vendues écartées).
//  `--prouve` : rouge sur origin/main (règles absentes) + mutations, chacune rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.FC_RACINE || path.join(__dirname, '..');
const MODULE = process.env.FC_MODULE || path.join(RACINE, 'src', 'favorisParcours.js');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 300) : '')); } };

async function controles() {
  if (!fs.existsSync(MODULE)) { dit(false, 'la règle du parcours existe (src/favorisParcours.js)'); return; }
  const P = await import(pathToFileURL(MODULE).href + '?t=' + Date.now());
  const M = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisMessage.js')).href);
  const T0 = Date.parse('2026-11-11T12:00:00Z'), H = 3600000;
  const per = (id, etat, ageH, extra = {}) => ({ id, etat, date: T0 - ageH * H, pseudo: 'pseudo_' + id, ...extra });
  const cartes = [
    { cle: 'item:1', itemId: '1', titre: 'A', prix: 50, personnes: [per('a', 'a_envoyer', 1), per('b', 'a_envoyer', 10), per('c', 'envoye', 20)] },
    { cle: 'item:2', itemId: '2', titre: 'B', prix: 80, personnes: [per('d', 'a_envoyer', 2), per('e', 'a_verifier', 3)] },
    { cle: 'item:3', itemId: '3', titre: 'C', prix: 30, vendu: true, personnes: [per('f', 'a_envoyer', 1)] },
    { cle: 'item:4', itemId: '4', titre: 'D', prix: 40, personnes: Array.from({ length: 12 }, (_, i) => per('g' + i, 'a_envoyer', 0.5)) },
  ];
  const A = P.annoncesQui(cartes, () => false, { depuis: T0 - 5 * H });
  const a = (k) => A.find((x) => x.itemId === k);
  dit(a('1').aEcrire.join() === 'a' && a('1').anciens === 1 && a('1').personnes === 3, 'nouveaux seulement : le favori d’après le dernier envoi est proposé, l’ancien compté à part', a('1'));
  dit(P.annoncesQui(cartes, () => false, { depuis: null }).find((x) => x.itemId === '1').aEcrire.length === 2, '« Inclure les anciens » : tous les favoris à envoyer');
  dit(!a('3').choisissable && a('2').aVerifier === 1, 'annonce vendue : jamais choisissable ; « à vérifier » compté');
  dit(!JSON.stringify(A).includes('pseudo_'), 'QUI ne porte aucune identité (aucun pseudo ne sort de la règle)');
  dit(P.annoncesQui([{ cle: 'x', itemId: '9', personnes: [{ id: 'z', etat: 'a_envoyer', date: null }] }], () => false, { depuis: T0 }).find(Boolean).aEcrire.length === 0, 'favori sans date lisible : jamais « nouveau »');
  dit(P.annoncesQui(cartes, (id) => id === 'a', { depuis: null }).find((x) => x.itemId === '1').aEcrire.join() === 'b', 'un favori bloqué (déjà dans la file, en conversation) n’est pas proposé');
  const C = P.destinatairesChoisis(A, ['item:1', 'item:2', 'item:4']);
  dit(C.ids.length === 14 && C.annonces.length === 3 && !('MAX_PAR_ENVOI' in P), 'aucun nombre fixe de messages par envoi : les 14 personnes des 3 annonces', { n: C.ids.length });
  const R12 = P.recapEnvoi({ ids: Array.from({ length: 12 }, (_, i) => 'x' + i), annonces: ['a'], avecOffre: true, jauge: { n: 20, pourApp: 45 } });
  dit(R12.limite === 'depasse' && R12.attendront === 4 && R12.libres === 25, 'la seule borne : 25 gestes libres ⇒ 8 messages cette heure, 4 attendront la suivante', R12);
  // La file SERVEUR (exécutée) : aucun plafond de messages par envoi ; la limite de l'heure fait attendre.
  const F = await import(pathToFileURL(process.env.FC_FILE || path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href + '?t=' + Date.now()).catch((e) => { dit(false, 'la file serveur se charge', e.message); return null; });
  if (F) {
    const cible = (i) => ({ itemId: String(100 + i), recipientId: String(900 + i), notificationId: 'n' + i, initiator: 'favori' });
    let lance = null; try { lance = F.lancerFile(null, { owner: 'o', targets: Array.from({ length: 25 }, (_, i) => cible(i)), message: 'Salut', intervalleMinutes: 0, maintenant: T0 }); } catch (e) { lance = { erreur: e.message }; }
    dit(lance && lance.data && lance.valeur.jobs.length === 25, 'la file serveur accepte 25 messages d’un coup (aucun « 10 au plus »)', lance && (lance.erreur || lance.valeur.jobs.length));
    if (lance && lance.data) {
      let d = lance.data; const r = F.reserverFile(d, { owner: 'o', maintenant: T0, jeton: 'j1' }); d = r.data;
      d.enCours.autorise = true;
      const t = F.terminerFile(d, { owner: 'o', jeton: 'j1', resultat: 'refuse', raison: 'quota_extension', ecrits: 0, maintenant: T0 + 1000 });
      const j = t.data.groupes.o.jobs.find((x) => x.notificationId === 'n0');
      dit(t.data.groupes.o.active === true && j.etat === 'attente' && t.data.groupes.o.prochain >= T0 + 1000 + F.QUOTA_ATTENTE_MS, 'limite de l’heure (rien d’écrit) ⇒ la file ATTEND une place, elle ne s’arrête pas', { active: t.data.groupes.o.active, etat: j.etat });
      const t2 = F.terminerFile(F.reserverFile(lance.data, { owner: 'o', maintenant: T0, jeton: 'j2' }).data, { owner: 'o', jeton: 'j2', resultat: 'refuse', raison: 'quota_extension', ecrits: 1, maintenant: T0 + 1000 });
      dit(t2.data.groupes.o.active === false, 'une écriture déjà partie ⇒ la file s’arrête comme avant (jamais de doublon)');
    }
  }
  const o = P.detailOffre(95, { mode: 'pct', valeur: 10, arrondi: false }, M.prixOffreFavori);
  dit(o.apres === 85.5 && o.remise === 9.5 && o.pct === 10, 'offre : 95 € −10 % ⇒ 85,50 €, −9,50 €', o);
  dit(P.detailOffre(null, { mode: 'pct', valeur: 10 }, M.prixOffreFavori).inconnu === true && P.detailOffre(40, { mode: 'prix', valeur: 45 }, M.prixOffreFavori).sansOffre === true && P.detailOffre(40, null, M.prixOffreFavori).sans === true, 'prix inconnu ⇒ « — » ; prix fixe ≥ prix ⇒ message seul ; sans offre');
  const mor = P.morceauxApercu('Salut {username}, {Bonjour|Salut} !', M.personnaliserMessageFavori);
  dit(mor.filter((x) => x.pseudo).length === 1 && !mor.some((x) => /[{}]/.test(x.texte || '')) && mor.some((x) => /Bonjour/.test(x.texte || '')), 'aperçu : {username} = pastille, variante = son premier choix', mor);
  dit(P.estimationSecondes({ n: 10, rythme: 'vintex' }) === 72 && P.estimationSecondes({ n: 3, rythme: 'fixe', intervalle: 6 }) === 720 && P.estimationSecondes({ n: 3, rythme: 'aleatoire', intervalle: 2, intervalleMax: 4 }) === 360 && P.estimationSecondes({ n: 3, rythme: 'fixe', intervalle: 'x' }) === null && P.estimationSecondes({ n: 1 }) === 0, 'durée : (n−1) attentes au rythme choisi ; illisible ⇒ null');
  const R = P.recapEnvoi({ ids: C.ids.slice(0, 10), annonces: C.annonces, avecOffre: true, rythme: 'vintex', jauge: { n: 10, pourApp: 45 } });
  dit(R.gestes === 30 && R.limite === 'dedans' && R.libres === 35, 'gestes : 3 par message avec l’offre, dans les 45/h', R);
  dit(P.recapEnvoi({ ids: C.ids.slice(0, 10), avecOffre: false, jauge: { n: 20, pourApp: 45 } }).limite === 'dedans' && P.recapEnvoi({ ids: C.ids.slice(0, 10), avecOffre: true, jauge: { n: 20, pourApp: 45 } }).limite === 'depasse' && P.recapEnvoi({ ids: C.ids.slice(0, 10), jauge: null }).limite === 'passu', 'au-delà des gestes libres ⇒ dépasse ; jauge pas lue ⇒ pas su');
  // La marge
  const pl = (c) => ({ etat: 'ok', plancher: c });
  dit(P.gardeMarge({ apres: 85.5, plancher: pl(9000) }).bloque === 'perte' && P.gardeMarge({ apres: 85.5, plancher: pl(9000) }).reste === -450, 'offre à perte ⇒ bloquée, reste −4,50 €');
  dit(P.gardeMarge({ apres: 58.5, plancher: pl(3000), mini: 60 }).bloque === 'mini' && P.gardeMarge({ apres: 58.5, plancher: pl(3000), mini: 60 }).reste === 2850, 'sous le prix mini ⇒ bloquée (le reste est dit quand même)');
  dit(P.gardeMarge({ apres: 70, plancher: pl(3000), mini: 60 }).bloque === null, 'au-dessus du mini et du plancher ⇒ libre');
  const sansAchat = P.gardeMarge({ apres: 70, plancher: { etat: 'achat', plancher: null } });
  dit(sansAchat.reste === null && sansAchat.etat === 'achat' && sansAchat.bloque === null, 'prix d’achat inconnu ⇒ « — », jamais inventé', sansAchat);
  dit(P.gardeMarge({ apres: 50, plancher: { etat: 'achat', plancher: null }, mini: '55,00' }).bloque === 'mini', 'prix mini « 55,00 » lu, même sans prix d’achat');
  // L'historique
  const jobs = [
    { id: '11:100', notificationId: 'n1', etat: 'envoye', envoyeLe: T0 - 10 * H, lot: 'L1', offre: { mode: 'pct', valeur: 10 } },
    { id: '12:200', notificationId: 'n2', etat: 'envoye', envoyeLe: T0 - 10 * H, lot: 'L1' },
    { id: '13:300', notificationId: 'n3', etat: 'envoye', envoyeLe: T0 - 2 * H, lot: 'L2' },
    { id: '14:100', notificationId: 'n4', etat: 'attente', lot: 'L2' },
    { id: '15:100', notificationId: 'n5', etat: 'refuse', lot: 'L2' },
  ];
  const ventes = [
    { tx: 't1', itemId: '11', acheteur: '100', at: T0 - 5 * H },     // même annonce, même personne, après ⇒ compté
    { tx: 't2', itemId: '12', acheteur: '999', at: T0 - 5 * H },     // autre acheteur ⇒ non
    { tx: 't3', itemId: '13', acheteur: '300', at: T0 - 5 * H },     // AVANT le message ⇒ non
    { tx: 't4', itemId: '12', acheteur: null, at: T0 - 4 * H },      // acheteur pas su ⇒ dit à part
    { tx: 't5', itemId: '77', acheteur: '100', at: T0 - 1 * H },     // annonce sans message ⇒ rien
  ];
  const Hh = P.achatsApresMessage(jobs, ventes);
  dit(Hh.achats === 1 && Hh.lignes[0].tx === 't1' && Hh.envoyes === 3, 'acheté après un message : même annonce ET même personne ET après', Hh);
  dit(Hh.ventesSansAcheteur === 1, 'acheteur pas su : dit à part, jamais compté', Hh.ventesSansAcheteur);
  const W = P.ceQuiMarche(jobs, ventes);
  const l1 = W.find((x) => x.lot === 'L1');
  dit(l1 && l1.envoyes === 2 && l1.achats === 1 && l1.offre && l1.offre.valeur === 10 && W.find((x) => x.lot === 'L2').achats === 0, 'ce qui marche : par envoi, achats et remise', W);
  const G = P.offresGroupees(jobs);
  dit(G.length === 1 && G[0].items.join() === '11,14' && !JSON.stringify(G).includes('100'), 'offre groupée : la personne prouvée par la file sur deux annonces (refusé écarté), sans identité en sortie', G);
  dit(P.prixLot([65, 120], 10).apres === 166.5 && P.prixLot([65, null], 10) === null, 'prix du lot à sa remise ; un prix manquant ⇒ rien (jamais un total partiel)');
  const V = P.ventesPourHistorique({ uid: '42', txnItem: { t1: '11', t9: '19' }, conversations: [{ id: 'c1', _acc: { vinted_user_id: '42' }, opposite_user: { id: 100 } }, { id: 'c2', _acc: { vinted_user_id: '7' }, opposite_user: { id: 200 } }],
    ventes: [{ _acc: { vinted_user_id: '42' }, transaction_id: 't1', conversation_id: 'c1', date: '2026-11-10' }, { _acc: { vinted_user_id: '42' }, transaction_id: 't9', conversation_id: 'c2', date: '2026-11-10' }, { _acc: { vinted_user_id: '42' }, transaction_id: 'tx', date: '2026-11-10' }, { _acc: { vinted_user_id: '42' }, transaction_id: 't1', status: 'x', conversation_id: 'c1', date: '2026-11-10', annulee: true }],
    annulee: (v) => v.annulee === true });
  dit(V.length === 2 && V[0].acheteur === '100' && V[1].acheteur === null, 'ventes : l’annonce par la transaction, l’acheteur par la conversation DU compte ; sans transaction lue ⇒ écartée ; annulée ⇒ écartée', V);
  dit(P.dernierEnvoi(jobs) === T0 - 2 * H && P.dernierEnvoi([]) === null, 'dernier envoi : le plus récent confirmé');
  // Le suivi
  const tx = () => ({ texte: 'raison', geste: 'geste' });
  dit(P.issueSuivi({ etat: 'envoye' }, tx).etat === 'ok' && P.issueSuivi({ etat: 'incertain' }, tx).etat === 'main' && P.issueSuivi({ etat: 'refuse', raison: 'offre_refusee' }, tx).etat === 'refus' && P.issueSuivi({ etat: 'ignore' }, tx).etat === 'saute' && P.issueSuivi({ etat: 'annule' }, tx).etat === 'saute' && P.issueSuivi({ etat: 'attente' }, tx) === null && P.issueSuivi({ etat: 'reserve' }, tx) === null, 'suivi : envoyé ✓ · à vérifier = à la main (jamais « réussi ») · refus · sauté · en cours ⇒ rien');
  // Ma journée
  const MJ = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisJournee.js')).href).catch(() => null);
  if (!MJ) { dit(false, 'la carte de Ma journée existe (src/favorisJournee.js)'); return; }
  const L = (id, item, ageH) => ({ id, lien: `https://www.vinted.fr/items/${item}/want_it/new?offering_id=1`, date: new Date(T0 - ageH * H).toISOString() });
  const N = MJ.nouveauxFavoris([L('a', 1, 1), L('b', 1, 2), L('c', 2, 23), L('d', 3, 30), L('e', 4, 2), { id: 'f', lien: 'https://www.vinted.fr/inbox/3', date: new Date(T0).toISOString() }], { maintenant: T0, vendus: new Set(['4']) });
  dit(N.annonces === 2 && N.favoris === 3, 'Ma journée : annonces aux favoris des 24 h (vendue et sans /items/ écartées)', N);
  dit(MJ.nouveauxFavoris(null) === null, 'Ma journée : favoris pas lus ⇒ « pas su », pas de carte');
}

function prouve() {
  const avant = (() => { const i = process.argv.indexOf('--avant'); return i > 0 ? process.argv[i + 1] : 'origin/main'; })();
  const lancer = (env) => { try { cp.execFileSync(process.execPath, [__filename], { env: { ...process.env, ...env }, stdio: 'pipe' }); return 0; } catch (e) { return (String(e.stdout).match(/❌/g) || []).length || 1; } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-avant-'));
  cp.execSync(`git archive ${avant} | tar -x -C ${dir}`, { cwd: path.join(__dirname, '..') });
  const r0 = lancer({ FC_RACINE: dir, FC_MODULE: path.join(dir, 'src', 'favorisParcours.js') });
  dit(r0 > 0, `sur ${avant}, les contrôles sont rouges`, r0);
  const src = fs.readFileSync(MODULE, 'utf8');
  const MUT = [
    ['un plafond fixe de messages par envoi revient', 'for (const id of a.aEcrire) { ids.push(id);', 'for (const id of a.aEcrire) { if (ids.length >= 10) continue; ids.push(id);'],
    ['anciens proposés comme nouveaux', 'const nouveau = (p) => depuis == null ||', 'const nouveau = (p) => true ||'],
    ['offre à perte libre', "if (reste < 0) bloque = bloque || 'perte';", ''],
    ['prix mini ignoré', "let bloque = m != null && o < m ? 'mini' : null;", 'let bloque = null;'],
    ['achat relié sans la personne', 'x.personne === String(v.acheteur)', 'true'],
    ['achat d’avant le message compté', 'at < e.envoyeLe) continue;', 'false) continue;'],
    ['acheteur pas su compté', 'if (!v.acheteur) { ventesSansAcheteur++; continue; }', ''],
    ['à vérifier compté réussi', "if (e === 'incertain') { const r = raisonTexte('incertain'); return { etat: 'main'", "if (e === 'incertain') { const r = raisonTexte('incertain'); return { etat: 'ok'"],
    ['groupée sans identité prouvée', "if (!parPersonne.has(m[2])) parPersonne.set(m[2], new Set());\n    parPersonne.get(m[2]).add(m[1]);", "if (!parPersonne.has('x')) parPersonne.set('x', new Set());\n    parPersonne.get('x').add(m[1]);"],
    ['gestes sans l’offre', 'export const GESTES_AVEC_OFFRE = 3;', 'export const GESTES_AVEC_OFFRE = 2;'],
    ['durée inventée', 'if (!(Number.isFinite(a) && a >= 0 && Number.isFinite(b) && b >= a)) return null;', 'if (!(Number.isFinite(a) && a >= 0 && Number.isFinite(b) && b >= a)) return 60;'],
  ];
  for (const [nom, de, vers] of MUT) {
    if (!src.includes(de)) { dit(false, `mutation « ${nom} » applicable`); continue; }
    const f = path.join(path.dirname(MODULE), `.favorisParcours.mutant.${process.pid}.js`);
    fs.writeFileSync(f, src.replace(de, vers));
    try { dit(lancer({ FC_MODULE: f }) > 0, `mutation « ${nom} » ⇒ rouge`); } finally { fs.rmSync(f, { force: true }); }
  }
  const fsrc = path.join(RACINE, 'api', '_lib', 'favoris-file.js'), fs0 = fs.readFileSync(fsrc, 'utf8');
  for (const [nom, de, vers] of [
    ['la file serveur remet « 10 au plus »', "if(!Array.isArray(targets)||!targets.length||", "if(!Array.isArray(targets)||!targets.length||targets.length>10||"],
    ['la limite de l’heure coupe la file', "const attendQuota=!j.auto&&", "const attendQuota=false&&"],
  ]) {
    if (!fs0.includes(de)) { dit(false, `mutation serveur « ${nom} » applicable`); continue; }
    const f = path.join(path.dirname(fsrc), `.favoris-file.mutant.${process.pid}.js`);
    fs.writeFileSync(f, fs0.replace(de, vers));
    try { dit(lancer({ FC_FILE: f }) > 0, `mutation « ${nom} » ⇒ rouge`); } finally { fs.rmSync(f, { force: true }); }
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
(async () => {
  if (process.argv.includes('--prouve')) prouve(); else await controles();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + e.stack); process.exit(1); });
