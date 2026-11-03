// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « Messages aux favoris », la règle d'affichage (2 novembre 2026)
//
//  EXÉCUTE src/favorisEcran.js (présentation pure de l'écran refait) :
//   · UN état par favori, tiré de ce que le serveur a noté (liste d'envoi,
//     journal du mode auto) : envoyé gagne, « à vérifier » n'est jamais
//     « pas envoyé », une paire vendue n'est pas « à envoyer » ;
//   · chaque code connu du serveur et de l'extension (RAISONS_FAVORIS,
//     RAISONS_AUTO, ETATS_AUTO, DEMANDES_AUTO) se dit sans mot technique ni
//     emoji ; un code inconnu ne tombe jamais dans « à envoyer » ;
//   · le frein du mode auto dit jusqu'à quand et pourquoi ;
//   · une raison = un groupe (la phrase n'est pas répétée sur chaque ligne) ;
//   · l'annonce se lit par l'identifiant du lien seulement (jamais le texte).
//  Données inventées.
//
//  `--prouve` (§6.1) : lance les mêmes contrôles sur origin/main (ou
//  `--avant <ref>`) — ils doivent être ROUGES — puis des MUTATIONS de la règle
//  (une à la fois, sur une copie) : chacune doit rendre au moins un contrôle rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.FAV_ECRAN_RACINE || path.join(__dirname, '..');
const MODULE = process.env.FAV_ECRAN_MODULE || path.join(RACINE, 'src', 'favorisEcran.js');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 300) : '')); } };
const JARGON = [/\bfiles?\b/i, /jetons?/i, /\b(?:401|403|404|409|429|500|502|503)\b/, /\bpont\b/i, /captur/i, /quota/i, /payload|endpoint|\bAPI\b|\bjson\b/i, /autorisation/i, /\blots?\b/i, /Vintex/i];
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/u;
const propre = (t) => !JARGON.some((re) => re.test(t)) && !EMOJI.test(t);

async function controles() {
  if (!fs.existsSync(MODULE)) { dit(false, 'la règle d’affichage existe (src/favorisEcran.js)', 'absente'); return; }
  const E = await import(pathToFileURL(MODULE).href + '?t=' + Date.now());
  const P = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisProgression.js')).href);
  const A = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisAuto.js')).href);
  const T0 = Date.parse('2026-11-02T13:00:00Z'), H = 3600000;

  // 1. Un état par favori
  const e = (o) => E.etatFavori(o);
  dit(e({}).code === 'a_envoyer', 'rien de noté ⇒ à envoyer');
  dit(e({ job: { etat: 'envoye', envoyeLe: T0 } }).code === 'envoye' && e({ job: { etat: 'envoye', envoyeLe: T0 } }).date === T0, 'envoyé ⇒ envoyé, avec sa date');
  dit(e({ job: { etat: 'envoye', envoyeLe: T0 }, vendue: true }).code === 'envoye', 'un message parti reste « envoyé » même si la paire s’est vendue depuis');
  dit(e({ journal: [{ etat: 'envoye', at: T0 }] }).code === 'envoye', 'envoyé par le mode auto (journal) ⇒ envoyé');
  dit(e({ vendue: true }).code === 'pas_envoye' && e({ vendue: true }).raison === 'vendue', 'paire vendue ⇒ pas envoyé, raison « vendue » (jamais « à envoyer »)');
  dit(e({ job: { etat: 'incertain', raison: 'reponse_inconnue' } }).code === 'a_verifier', 'réponse incertaine ⇒ à vérifier (jamais « pas envoyé »)');
  dit(e({ journal: [{ etat: 'incertain', at: T0 }] }).code === 'a_verifier', 'incertain au journal ⇒ à vérifier');
  dit(['attente', 'reserve'].every((x) => e({ job: { etat: x } }).code === 'en_cours'), 'en attente / en cours ⇒ en cours');
  dit(e({ job: { etat: 'ignore' } }).raison === 'conversation' && e({ journal: [{ etat: 'saute', raison: 'conversation_existante', at: T0 }] }).raison === 'conversation', 'conversation existante (clic ou mode auto) ⇒ même raison');
  dit(e({ journal: [{ etat: 'saute', raison: 'destinataire_non_prouve', at: T0 }] }).raison === 'destinataire', 'destinataire pas prouvé ⇒ raison avec geste « Ouvrir »');
  dit(e({ job: { etat: 'refuse', raison: 'quota_extension' } }).raison === 'limite_heure', 'plafond d’actions ⇒ limite de l’heure');
  dit(e({ job: { etat: 'refuse', raison: 'code_que_personne_ne_connait' } }).code === 'pas_envoye', 'raison inconnue ⇒ pas envoyé (interrompu), jamais « à envoyer »');
  dit(e({ journal: [{ etat: 'saute', raison: 'expire', at: T0 + H }, { etat: 'saute', raison: 'conversation_existante', at: T0 }] }).raison === 'expire', 'journal : l’entrée la plus récente fait foi (fournie en tête)');

  // 2. Chaque code connu se dit simplement
  const tousCodes = [...new Set([...Object.keys(P.RAISONS_FAVORIS), ...Object.keys(A.RAISONS_AUTO)])];
  const sales = [];
  for (const raison of tousCodes) {
    for (const st of [{ job: { etat: 'refuse', raison } }, { journal: [{ etat: 'saute', raison, at: T0 }] }]) {
      const s = e(st);
      if (s.code === 'a_envoyer') { sales.push(raison + ' ⇒ à envoyer'); continue; }
      const t = E.enteteGroupe({ code: s.code, raison: s.raison });
      const texte = [t.titre, t.phrase, t.geste].join(' ');
      if (!propre(texte) || !t.titre) sales.push(raison + ' : ' + texte);
    }
  }
  dit(!sales.length, `les ${tousCodes.length} codes de refus du serveur et de l’extension se disent sans jargon ni emoji`, sales.join(' | '));
  const modes = [];
  const reg = { actif: true, jours: [1, 2, 3, 4, 5, 6, 7], heureDebut: 9, heureFin: 21, parJour: 30, parHeure: 12 };
  for (const etat of Object.keys(A.ETATS_AUTO)) { const d = E.phraseModeAuto({ auto: { reglages: reg, etat }, maintenant: T0 }); if (!d || !propre(d.texte + ' ' + d.geste)) modes.push(etat + ' : ' + (d && d.texte)); }
  for (const code of Object.keys(A.DEMANDES_AUTO)) { const d = E.phraseModeAuto({ auto: { reglages: reg, demande: { code } }, maintenant: T0 }); if (!d || !propre(d.texte + ' ' + d.geste) || !d.geste) modes.push('demande ' + code + ' : ' + (d && d.texte + ' / ' + d.geste)); }
  for (const code of ['onglet_vinted', 'compte_vinted_different', 'extension_version', 'extension_indisponible', 'session_extension']) { const d = E.phraseModeAuto({ auto: { reglages: reg }, extensionAuto: { disponible: false, code }, maintenant: T0 }); if (!d || d.ton !== 'geste' || !propre(d.texte + ' ' + d.geste)) modes.push('extension ' + code); }
  dit(!modes.length, 'chaque état du mode auto (et chaque demande) se dit en une phrase, sans jargon, avec le geste quand il y en a un', modes.join(' | '));
  dit(E.phraseModeAuto({ auto: null, maintenant: T0 }).etat === 'eteint' && E.phraseModeAuto({ lu: false }) === null, 'mode jamais réglé ⇒ éteint ; pas encore lu ⇒ rien d’affirmé');

  // 3. Le frein : jusqu'à quand, pourquoi
  const pause = T0 + 5 * H;
  const f = E.phraseModeAuto({ auto: { reglages: reg, pauseJusqua: pause, pauseRaison: 'vinted_robot' }, maintenant: T0 });
  const heure = new Date(pause).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
  dit(f.etat === 'pause' && f.texte.includes(heure) && /automatis/i.test(f.texte) && !!f.geste, `freiné ⇒ « jusqu’à ${heure} » + la raison + le geste`, f.texte);
  dit(E.phraseModeAuto({ auto: { reglages: reg, pauseJusqua: T0 - 1, pauseRaison: 'vinted_robot' }, maintenant: T0 }).etat !== 'pause', 'pause passée ⇒ plus « en pause »');
  dit(E.phraseModeAuto({ auto: { reglages: { ...reg, actif: false }, pauseJusqua: pause }, maintenant: T0 }).etat === 'eteint', 'éteint reste « éteint » même pendant une pause');

  // 4. Groupes : une raison = un groupe, aucune phrase par ligne
  const L = (id, item, nom) => ({ id, nom, lien: item ? `https://www.vinted.fr/items/${item}/conversation/new` : 'https://www.vinted.fr/inbox/9', body: `${nom} a ajouté ton article à ses favoris.`, date: new Date(T0 - H).toISOString() });
  const lignes = [L('a', 11, 'ana'), L('b', 12, 'bob'), L('c', 13, 'cyd'), L('d', null, 'dan'), L('e', 15, 'eva')];
  const jobs = { a: { etat: 'ignore' }, b: { etat: 'ignore' }, e: { etat: 'envoye', envoyeLe: T0 - 2 * H } };
  const appels = [];
  const g = E.groupesFavoris({ lignes, statut: (x) => jobs[x.id] || null, journal: [], vendue: () => false, article: (id) => { appels.push(id); return { titre: 'Titre ' + id, numero: 'N' + id }; }, maintenant: T0 });
  const conv = g.filter((x) => x.raison === 'conversation');
  dit(conv.length === 1 && conv[0].lignes.length === 2, 'deux favoris pour la même raison ⇒ un seul groupe (la phrase dite une fois)', JSON.stringify(g.map((x) => [x.cle, x.lignes.length])));
  dit(g.every((x) => x.lignes.every((l) => !('phrase' in l) && !('geste' in l))), 'aucune phrase ni geste porté par la ligne');
  dit(appels.every((x) => /^\d+$/.test(x)) && !appels.includes('d') && appels.length === 4, 'l’annonce est demandée par son identifiant /items/<id> seulement', appels.join(','));
  const dl = g.flatMap((x) => x.lignes).find((l) => l.id === 'd');
  dit(dl && !dl.numero && !dl.titre, 'sans identifiant d’annonce : ni N° ni titre deviné');
  const env = g.find((x) => x.code === 'envoye');
  dit(env && env.lignes[0].dateEnvoi === new Date(T0 - 2 * H).toISOString(), 'envoyé : la date d’envoi est portée par la ligne', env && env.lignes[0].dateEnvoi);
  dit(g[g.length - 1].code === 'envoye' && g.findIndex((x) => x.code === 'a_envoyer') < g.findIndex((x) => x.raison === 'conversation'), 'ordre : à faire d’abord, envoyés en dernier', g.map((x) => x.cle).join(' > '));
  const geste = E.groupesFavoris({ lignes: [L('z', 20, 'zed')], journal: [{ notificationId: 'z', etat: 'saute', raison: 'destinataire_non_prouve', at: T0 }], maintenant: T0 });
  dit(geste[0].ton === 'geste' && geste[0].lignes[0].ouvrir === true, 'à qui écrire pas prouvé ⇒ ambre + « Ouvrir » sur la ligne');
  dit(E.groupesFavoris({ lignes: [L('y', 21, 'yan')], journal: [{ notificationId: 'y', etat: 'saute', raison: 'conversation_existante', at: T0 }], maintenant: T0 })[0].ton === 'neutre', 'conversation existante ⇒ neutre (rien à faire)');

  // 5. (3 nov., écran « Fusion ») Une carte par ARTICLE — forme réelle mesurée :
  //    pas d'`actor`, « <pseudo> a marqué ton article <titre> comme favori »,
  //    lien /items/<id>/want_it/new?offering_id=<n>.
  if (typeof E.articlesFavoris !== 'function') { dit(false, 'la règle par article existe (articlesFavoris)', 'absente'); return; }
  const R = (id, item, login, ageH) => ({ id, nom: '', body: login ? `${login} a marqué ton article nike air max taille 44 comme favori` : 'Quelqu’un a marqué ton article nike air max taille 44 comme favori', lien: `https://www.vinted.fr/items/${item}/want_it/new?offering_id=7${id}`, date: new Date(T0 - ageH * H).toISOString() });
  dit(E.pseudoFavori(R('p', 1, 'lea_75', 1)) === 'lea_75' && E.pseudoFavori(R('q', 1, '', 1)) === '' && E.pseudoFavori({ body: 'Camille 0 a ajouté ton article à ses favoris.' }) === '' && E.pseudoFavori({ nom: 'ana', body: 'x' }) === 'ana', 'pseudo : celui que Vinted écrit, sinon RIEN (jamais un nom inventé)');
  dit(E.titreNotification(R('p', 1, 'lea_75', 1).body) === 'nike air max taille 44', 'titre : lu dans la phrase de Vinted (pour une carte déjà identifiée)');
  const rl = [R('a', 11, 'ana', 1), R('b', 11, 'bob', 2), R('c', 11, '', 3), R('d', 12, 'dan', 1), R('e', 13, 'eva', 1), R('f', 14, 'fil', 50 * 24), R('g', 15, 'gus', 1)];
  const rj = { a: { etat: 'envoye', envoyeLe: T0, ecrits: 3 }, d: { etat: 'envoye', envoyeLe: T0 }, g: { etat: 'incertain' } };
  const vendus = new Set(['13']);
  const A0 = E.articlesFavoris({ lignes: rl, statut: (x) => rj[x.id] || null, vendue: (x) => vendus.has(E.itemIdFavori(x)), article: (id) => ({ titre: 'Article ' + id, numero: 'N' + id, prix: 50 }), maintenant: T0, periode: '30' });
  const c = (item) => A0.cartes.find((x) => x.itemId === String(item)) || {};
  dit(A0.cartes.length === 4 && c(11).personnes.length === 3, 'une carte par article (par /items/<id>), ses favoris dedans ; hors période (50 j) écarté', JSON.stringify(A0.cartes.map((x) => [x.itemId, x.personnes.length])));
  dit(c(11).puce.code === 'a_envoyer' && c(11).geste === 'envoyer' && c(11).compte.a_envoyer === 2, 'article avec des favoris à envoyer ⇒ « Envoyer »');
  dit(c(12).puce.code === 'envoye' && c(12).geste === null, 'envoyé sans preuve d’offre ⇒ « Envoyé » (jamais « Offre faite »)');
  dit(c(11).compte.offre === 1 && E.etatFavori({ job: { etat: 'envoye', envoyeLe: T0, ecrits: 3 } }).offre === true && !E.etatFavori({ job: { etat: 'envoye', envoyeLe: T0, ecrits: 2 } }).offre, 'offre faite = envoyé AVEC ses 3 écritures (prouvé), sinon non');
  dit(c(13).puce.code === 'vendu' && c(13).geste === null, 'article vendu ⇒ « Vendu », aucun « Envoyer »');
  dit(c(15).puce.code === 'a_verifier' && c(15).puce.ton === 'geste' && c(15).geste === 'verifier', 'réponse incertaine ⇒ « À vérifier » en ambre');
  dit(c(11).personnes.map((x) => x.initiale).join('') === 'AB', 'initiales : celles des pseudos lus ; illisible ⇒ vide', JSON.stringify(c(11).personnes.map((x) => x.initiale)));
  dit(A0.resume.favoris === 6 && A0.resume.articles === 4 && A0.resume.envoyes === 2 && A0.resume.vendus === 1 && A0.resume.attente === 2, 'résumé de la carte sombre : favoris, articles, envoyés, vendus, en attente', JSON.stringify(A0.resume));
  dit(A0.cartes[0].geste === 'verifier' && A0.cartes[1].geste === 'envoyer', 'ordre : à vérifier, puis à envoyer, puis le reste', A0.cartes.map((x) => x.itemId).join(','));
  dit(E.articlesFavoris({ lignes: rl, maintenant: T0, periode: 'tout' }).cartes.length === 5 && E.articlesFavoris({ lignes: rl, maintenant: T0, periode: '7' }).resume.favoris === 6, 'période : « Tout » garde l’ancien, « 7 j » le reste');
  const sansId = E.articlesFavoris({ lignes: [{ id: 'z', nom: '', body: 'x a marqué ton article y comme favori', lien: 'https://www.vinted.fr/inbox/9', date: new Date(T0).toISOString() }], article: () => ({ titre: 'NON' }), maintenant: T0 });
  dit(sansId.cartes[0].titre === '' && !sansId.cartes[0].numero, 'sans /items/<id> : ni titre ni N° deviné');
  const ap = E.apercuMessageFavori({ message: 'Salut {username} !', offre: { mode: 'pct', valeur: 10, arrondi: false }, exemple: { pseudo: 'lea_75', prix: 50 }, personnaliser: (m, p) => m.replace('{username}', p), prixOffre: () => '45.00' });
  dit(ap.texte === 'Salut lea_75 !' && ap.offre === '50 € → 45 €', 'aperçu : le vrai texte sur un vrai favori, l’offre sur un vrai prix', JSON.stringify(ap));
  dit(!Object.values(E.RAISONS_ECRAN).some((r) => /paire/i.test(r.texte)), 'jamais « paire » dans les raisons (« article »)');
}


function prouve() {
  const avant = (() => { const i = process.argv.indexOf('--avant'); return i > 0 ? process.argv[i + 1] : 'origin/main'; })();
  const lancer = (env) => { try { cp.execFileSync(process.execPath, [__filename], { env: { ...process.env, ...env }, stdio: 'pipe' }); return 0; } catch (e) { return (String(e.stdout).match(/❌/g) || []).length || 1; } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-ecran-avant-'));
  cp.execSync(`git archive ${avant} | tar -x -C ${dir}`, { cwd: path.join(__dirname, '..') });
  const r0 = lancer({ FAV_ECRAN_RACINE: dir, FAV_ECRAN_MODULE: '' });
  dit(r0 > 0, `sur ${avant} (avant), les contrôles sont rouges`, r0 + ' rouge(s)');
  const src = fs.readFileSync(MODULE, 'utf8');
  const MUTATIONS = [
    ['journal du mode auto ignoré', "const j0=Array.isArray(journal)?journal[0]||null:null;", 'const j0=null;'],
    ['paire vendue montrée « à envoyer »', "if(vendue)return {code:'pas_envoye',raison:'vendue'};", ''],
    ['incertain rangé en « pas envoyé »', "if(job?.etat==='incertain')return {code:'a_verifier'};", ''],
    ['pause sans heure de reprise', 'texte:`En pause jusqu’à ${heureParis(pause)} : ${raison}.`', 'texte:`En pause : ${raison}.`'],
    ['plafond d’actions mal rangé', "quota_extension:'limite_heure'", "quota_extension:'limite_heure_x'"],
    ['jargon dans un texte', "limite_heure:{texte:'limite d’actions de l’heure atteinte'", "limite_heure:{texte:'quota 429 de la file atteint'"],
    ['une raison par ligne (plus de groupe par raison)', "const cle=e.code==='pas_envoye'?'pas_envoye:'+e.raison:e.code;", "const cle=e.code==='pas_envoye'?'pas_envoye:'+e.raison+':'+ligne.id:e.code;"],
    ['offre faite sans preuve', "...(job.ecrits===3?{offre:true}:{})", "...({offre:true})"],
    ['nom inventé', "  return m?m[1]:'';\n}", "  return m?m[1]:'Client';\n}"],
    ['article vendu avec « Envoyer »', "if(c.vendu)return {puce:{code:'vendu'", "if(false)return {puce:{code:'vendu'"],
    ['une carte par favori (plus par article)', "const cle=itemId?'item:'+itemId:'sans:'+ligne.id;", "const cle='sans:'+ligne.id;"],
    ['annonce lue par le texte', "const id=itemIdFavori(ligne),a=id?article(id)||null:null;", "const id=itemIdFavori(ligne)||ligne.body,a=id?article(id)||null:null;"],
  ];
  for (const [nom, de, vers] of MUTATIONS) {
    if (!src.includes(de)) { dit(false, `mutation « ${nom} » applicable`, 'texte introuvable'); continue; }
    const f = path.join(path.dirname(MODULE), `.favorisEcran.mutant.${process.pid}.js`);
    fs.writeFileSync(f, src.replace(de, vers));
    try { const n = lancer({ FAV_ECRAN_MODULE: f }); dit(n > 0, `mutation « ${nom} » ⇒ rouge`, n + ' rouge(s)'); } finally { fs.rmSync(f, { force: true }); }
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

(async () => {
  if (process.argv.includes('--prouve')) prouve(); else await controles();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit interrompu : ' + e.stack); process.exit(1); });
