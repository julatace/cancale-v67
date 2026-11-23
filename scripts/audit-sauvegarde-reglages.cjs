// ════════════════════════════════════════════════════════════════════════
//  SAUVEGARDER / RESTAURER SES RÉGLAGES (22 nov., ext. 5.435 — Julien, choix 22)
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs), message `sauvegardeReglages` du panneau. On juge :
//   S1 le fichier : JSON lisible et daté, format 1, version de l'extension, TOUS ses réglages (favoris et versions, paliers,
//      agent, réponses rapides, garde du prix, cadence par compte, relances, retirer partout, horaires du cycle) ;
//   S2 AUCUN secret : ni jeton, ni cookie, ni session, ni mot de passe, ni conversation, ni pseudo d'acheteur, ni bouton
//      appris (des leurres sont posés PARTOUT dans la base et dans chrome.storage — aucun ne sort) ;
//   R1 « Restaurer » sans « Oui » n'écrit RIEN (aperçu seul, `restaurer` sans `confirme`, mauvais jeton, autre compte) ;
//   R2 l'aperçu montre avant/après, un réglage qui s'allume est marqué ; « Oui » écrit par les chemins existants
//      (`vrm_reglages_auto` relue = le fichier, `vrm_favoris_reglages_{uid}` par sa règle) ; un leurre dans le fichier
//      n'entre pas ;
//   R3 compte : un réglage d'un AUTRE compte (inconnu de son VRM) ne s'applique pas — sauf sur SON choix, au compte de
//      l'onglet seulement ;
//   R4 versions : un fichier d'une version plus ancienne mais compatible passe ; plus récent / trop ancien / pas VRM ⇒ refusé, dit ;
//   R5 une lecture ratée ⇒ ni fichier, ni écriture.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE. `--src chemin` : un autre background.js (code d'avant).
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const iSrc = args.indexOf('--src');
const SRC0 = iSrc >= 0 ? path.resolve(args[iSrc + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  // le filtre final retiré (un secret glissé dans une clé autorisée sortirait)
  filtre: ["if (SR_CLE_SECRETE.test(k) || SR_CLE_PERSONNE.test(k)) { compte.n++; continue; }", ''],
  // l'historique des envois (pseudos) gardé dans le fichier
  envois: ['delete v.envois; }', '}'],
  // « restaurer » sans SON « Oui »
  oui: ["if (!(msg && msg.confirme === true)) return { ok: false, code: 'confirmation'", "if (false) return { ok: false, code: 'confirmation'"],
  // le jeton de l'aperçu pas vérifié
  jeton: ["if (!A || !A.jeton || String(msg.jeton || '') !== A.jeton)", 'if (!A)'],
  // un autre compte appliqué sans son choix
  compte: ["if (choix && choix[u] === true && uidOnglet", "if (uidOnglet"],
  // version plus récente acceptée
  recent: ["if (fv > SR_FORMAT_VERSION) return", 'if (false) return'],
  // trop ancienne acceptée
  ancien: ["|| versionPlusRecente(SR_VERSION_MIN, ext)) return", ') return'],
  // lecture ratée ⇒ fichier quand même
  lecture: ["if (fav === null) return null;\n  for (const r of fav) {", "for (const r of (fav || [])) {"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(SRC0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-sr-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(a).join(b));
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — exception', e && e.stack); } };
const UID = '111', AUTRE = '222', INCONNU = '999';
// Les LEURRES : chacun ne doit jamais sortir dans le fichier.
const LEURRES = ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTEifQ.LEURRE', 'COOKIE_LEURRE_v1', 'MDP_LEURRE', 'julie_92', 'CONV_LEURRE_778899', 'SIG_APPRIS_LEURRE', 'SESSION_LEURRE', 'jeton_vinted_LEURRE', 'acces_LEURRE'];
const base = () => ({
  main: {},
  vrm_reglages_auto: { v: 1, rev: 3, cles: {
    vinted_offres_paliers: { actif: false, remiseMax: 30, paliers: [50, 80, 100], messages: ['Je peux faire {price}'], arrondi: true },
    vrm_seuil_prix: { seuil: 55 },
    vrm_reponses_rapides: { v: 1, categories: { envoi: ['Expédié demain'] } },
    vrm_retirer_partout_reglage: { v: 1, leboncoin: true, vestiaire: false, at: 1 },
    vrm_agent_publier: { v: 1, articles: { 'n:12': { categorie: 'baskets' } }, envois: { 'leboncoin:12': { site: 'leboncoin', numero: '12', pseudo: 'julie_92', at: 1 } }, token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTEifQ.LEURRE' },
    vinted_cadence: { v: 1, comptes: { [UID]: { actionsHeure: 60, favorisHeure: 20, at: 1 }, [AUTRE]: { actionsHeure: 30, at: 1 } } },
    vinted_bleam: { v: 1, comptes: { [UID]: { favMessages: { un: [{ id: 'v1', texte: 'Coucou {pseudo}, il te plaît toujours ?' }] }, relances: { actif: false, livreJours: 3, modeles: { livre: { fr: ['Merci de confirmer'] } } }, cycle: { actif: false, strategie: 'anti', rythme: { heureDebut: 9, heureFin: 20 } }, agent: { actif: false, heuresCalmes: { de: 23, a: 7 } }, at: 1 } } },
    vinted_baisse_regle: { v: 1, comptes: { [UID]: { actif: false, pct: 10, jours: 14, at: 1 } } },
  } },
  [`vrm_favoris_reglages_${UID}`]: { version: 1, message: 'Bonjour, une offre pour toi', variantes: ['Salut !'], rythme: 'normal', pourcentage: 10, offreMode: 'pct', arrondi: true, intervalleMinutes: 6,
    access_token: 'jeton_vinted_LEURRE', cookie: 'COOKIE_LEURRE_v1', conversations: ['CONV_LEURRE_778899'], derniersPseudos: ['julie_92'] },
  harvest_111_conv_778899: { payload: { conversation: { id: 'CONV_LEURRE_778899', opposite_user: { login: 'julie_92' } } } },
});
const store0 = () => ({ vrmSession: { user_id: 'owner-banc', email: 'banc@vrm.test', access_token: 'SESSION_LEURRE', refresh_token: 'SESSION_LEURRE', expires_at: Date.now() + 365 * 864e5 },
  vrmLbcUi: { pause: { etapes: [{ sig: 'SIG_APPRIS_LEURRE' }] } }, vrmVcUi: { envoi: { sig: 'SIG_APPRIS_LEURRE' } }, vrmJournal: {}, vrmMotDePasse: 'MDP_LEURRE' });
const sender = { tab: { id: 7, url: 'https://www.vinted.fr/member/111' }, url: 'https://www.vinted.fr/member/111' };
const fond = (extra = {}) => {
  const f = faireFond({ src: SRC, connecte: UID, lignes: Object.assign(base(), extra.lignes || {}), store: Object.assign(store0(), extra.store || {}),
    comptes: extra.comptes || [{ vinted_user_id: UID, login: 'compte_a', access_token: 'jeton_vinted_LEURRE' }, { vinted_user_id: AUTRE, login: 'compte_b', access_token: 'jeton_vinted_LEURRE' }],
    lectureKO: extra.lectureKO || (() => false) });
  f.ctx.compteConnecte = async () => (extra.onglet === undefined ? UID : extra.onglet);
  const appel = (m) => f.envoyer(Object.assign({ from: 'vrm-badge', action: 'sauvegardeReglages' }, m), sender);
  return Object.assign(f, { appel });
};
const instant = (f) => JSON.stringify({ a: f.lignes.vrm_reglages_auto, b: f.lignes[`vrm_favoris_reglages_${UID}`], c: f.lignes[`vrm_favoris_reglages_${AUTRE}`] });

(async () => {
  let fichier = null, texte = '';
  await essai('S1', async () => {
    const f = fond();
    const r = await f.appel({ quoi: 'exporter' });
    dit(r && r.ok === true && typeof r.texte === 'string', 'S1 « Sauvegarder » rend un fichier', JSON.stringify(r).slice(0, 200));
    texte = (r && r.texte) || '';
    try { fichier = JSON.parse(texte); } catch (_) { fichier = null; }
    dit(!!fichier && /\n  "format"/.test(texte), 'S1 JSON lisible (indenté)');
    dit(/^vrm-reglages-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(String(r && r.nom)) && fichier && Number.isFinite(Date.parse(fichier.cree)), 'S1 daté (nom et contenu)', r && r.nom);
    dit(fichier && fichier.format === 'vrm-reglages-extension' && fichier.formatVersion === 1 && /^\d+\.\d+\.\d+$/.test(fichier.extension), 'S1 format 1 et version de l’extension', fichier && fichier.extension);
    const g = (fichier && fichier.generaux) || {}, c = (fichier && fichier.comptes && fichier.comptes[UID]) || {};
    dit(g.vinted_offres_paliers && g.vinted_offres_paliers.remiseMax === 30, 'S1 paliers');
    dit(g.vrm_seuil_prix && g.vrm_seuil_prix.seuil === 55, 'S1 seuil de la garde du prix');
    dit(g.vrm_reponses_rapides && g.vrm_retirer_partout_reglage && g.vrm_retirer_partout_reglage.leboncoin === true, 'S1 réponses rapides et retirer partout');
    dit(c.cadence && c.cadence.actionsHeure === 60 && fichier.comptes[AUTRE] && fichier.comptes[AUTRE].cadence.actionsHeure === 30, 'S1 cadence PAR compte');
    dit(c.bleam && c.bleam.favMessages && JSON.stringify(c.bleam.favMessages).includes('Coucou {pseudo}') && c.bleam.relances && c.bleam.agent && c.bleam.agent.heuresCalmes.de === 23 && c.bleam.cycle, 'S1 messages aux favoris et versions, relances, agent (heures calmes), cycle');
    dit(c.favoris && c.favoris.message === 'Bonjour, une offre pour toi' && c.favoris.variantes.length === 1, 'S1 réglages des favoris du compte');
    dit(c.baisse && c.baisse.pct === 10, 'S1 baisse par règle');
    dit(fichier && fichier.generaux.vrm_agent_publier && fichier.generaux.vrm_agent_publier.articles && !fichier.generaux.vrm_agent_publier.envois, 'S1 la mémoire de « Publier sur… » sans son historique d’envois');
    dit(JSON.stringify(f.j.posts || []) === '[]' && !(f.j.patchs || []).length && !f.j.vinted.length, 'S1 rien écrit, aucune requête vers Vinted', JSON.stringify({ p: f.j.posts, pa: f.j.patchs, v: f.j.vinted.length }));
  });
  await essai('S2', async () => {
    const sort = LEURRES.filter((l) => texte.includes(l));
    dit(!sort.length, 'S2 aucun leurre dans le fichier (jeton, cookie, session, mot de passe, conversation, pseudo, bouton appris)', sort.join(', '));
    dit(!/"(access_token|refresh_token|cookie|token|session|password|login|pseudo|conversations?)"\s*:/i.test(texte), 'S2 aucune clé de secret ni de personne');
  });
  await essai('R1', async () => {
    const f = fond();
    const av = instant(f);
    const mod = JSON.parse(texte); mod.generaux.vrm_seuil_prix = { seuil: 70 };
    const ap = await f.appel({ quoi: 'apercu', texte: JSON.stringify(mod) });
    dit(ap && ap.ok && typeof ap.jeton === 'string', 'R1 aperçu rendu', JSON.stringify(ap).slice(0, 200));
    dit(instant(f) === av && !(f.j.patchs || []).length, 'R1 l’aperçu n’écrit rien');
    const sans = await f.appel({ quoi: 'restaurer', jeton: ap.jeton });
    dit(sans && sans.ok === false && sans.code === 'confirmation' && instant(f) === av, 'R1 « restaurer » sans « Oui » n’écrit rien', JSON.stringify(sans));
    const faux = await f.appel({ quoi: 'restaurer', confirme: true, jeton: 'pas-le-bon' });
    dit(faux && faux.ok === false && instant(f) === av, 'R1 mauvais jeton ⇒ rien', JSON.stringify(faux));
    f.ctx.compteConnecte = async () => AUTRE;
    const autre = await f.appel({ quoi: 'restaurer', confirme: true, jeton: ap.jeton });
    dit(autre && autre.ok === false && autre.code === 'compte' && instant(f) === av, 'R1 compte de l’onglet changé ⇒ rien', JSON.stringify(autre));
    f.ctx.compteConnecte = async () => UID;
    const ap2 = await f.appel({ quoi: 'apercu', texte: JSON.stringify(mod) });
    await f.appel({ quoi: 'annuler' });
    const apresNon = await f.appel({ quoi: 'restaurer', confirme: true, jeton: ap2.jeton });
    dit(apresNon && apresNon.ok === false && instant(f) === av, '« Non » (annuler) ⇒ le jeton ne sert plus, rien n’est écrit', JSON.stringify(apresNon));
  });
  await essai('R2', async () => {
    const f = fond();
    const mod = JSON.parse(texte);
    mod.generaux.vrm_seuil_prix = { seuil: 70 };
    mod.generaux.vinted_offres_paliers = Object.assign({}, mod.generaux.vinted_offres_paliers, { actif: true });
    mod.comptes[UID].cadence = { actionsHeure: 40, favorisHeure: 10 };
    mod.comptes[UID].favoris = Object.assign({}, mod.comptes[UID].favoris, { variantes: ['Salut !', 'Hello !'], token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTEifQ.LEURRE', cookie: 'COOKIE_LEURRE_v1' });
    mod.generaux.vrm_reponses_rapides.session = 'SESSION_LEURRE';
    const ap = await f.appel({ quoi: 'apercu', texte: JSON.stringify(mod) });
    const L = (ap && ap.changements) || [];
    const de = (cle, section) => L.find((c) => c.cle === cle && (section == null || c.section === section));
    dit(de('vrm_seuil_prix') && de('vrm_seuil_prix').avant.x === 55 && de('vrm_seuil_prix').apres.x === 70, 'R2 aperçu avant/après (seuil 55 → 70)', JSON.stringify(de('vrm_seuil_prix')));
    dit(de('vinted_offres_paliers') && de('vinted_offres_paliers').allume === true, 'R2 un réglage qui s’allume est marqué', JSON.stringify(de('vinted_offres_paliers')));
    dit(de('vinted_cadence', 'cadence') && de('vinted_cadence', 'cadence').compte === UID, 'R2 la cadence du compte est dite');
    dit(ap && ap.retires >= 3, 'R2 les leurres du fichier sont comptés et ignorés', ap && ap.retires);
    dit(!L.some((c) => c.cle === 'vinted_bleam'), 'R2 un réglage identique n’est pas un changement', JSON.stringify(L.filter((c) => c.cle === 'vinted_bleam')));
    const r = await f.appel({ quoi: 'restaurer', confirme: true, jeton: ap.jeton });
    dit(r && r.ok === true && r.faits === L.length, 'R2 « Oui » ⇒ restauré', JSON.stringify(r));
    const cl = (f.lignes.vrm_reglages_auto || {}).cles || {};
    dit(cl.vrm_seuil_prix && cl.vrm_seuil_prix.seuil === 70 && cl.vinted_offres_paliers.actif === true && cl.vinted_cadence.comptes[UID].actionsHeure === 40 && cl.vinted_cadence.comptes[AUTRE].actionsHeure === 30, 'R2 vrm_reglages_auto relue = le fichier (les autres comptes intacts)', JSON.stringify(cl.vinted_cadence));
    dit(f.lignes.vrm_reglages_auto.par === 'extension' && f.lignes.vrm_reglages_auto.rev === 4, 'R2 écrit par le chemin existant (ligneAvecReglage, comparer-et-échanger)', JSON.stringify({ par: f.lignes.vrm_reglages_auto.par, rev: f.lignes.vrm_reglages_auto.rev }));
    const fv = f.lignes[`vrm_favoris_reglages_${UID}`] || {};
    dit(Array.isArray(fv.variantes) && fv.variantes.length === 2 && fv.envoisActifs === false, 'R2 favoris réécrits par leur règle', JSON.stringify(fv.variantes));
    const tout = JSON.stringify(f.lignes.vrm_reglages_auto) + JSON.stringify(fv.variantes) + JSON.stringify(fv.message);
    dit(!/LEURRE/.test(JSON.stringify(f.lignes.vrm_reglages_auto)) && !('token' in fv), 'R2 aucun leurre du fichier n’entre', tout.slice(0, 200));
    dit(!f.j.vinted.length, 'R2 aucune requête vers Vinted');
  });
  await essai('R3', async () => {
    const mod = JSON.parse(texte);
    mod.comptes = { [INCONNU]: { cadence: { actionsHeure: 20 } } };
    const f = fond();
    const ap = await f.appel({ quoi: 'apercu', texte: JSON.stringify(mod) });
    dit(ap && ap.ok && (ap.autres || []).includes(INCONNU) && !(ap.changements || []).some((c) => c.compte), 'R3 un compte inconnu de son VRM : nommé, pas appliqué', JSON.stringify({ a: ap && ap.autres, c: ap && ap.changements }));
    await f.appel({ quoi: 'restaurer', confirme: true, jeton: ap.jeton });
    const cl = (f.lignes.vrm_reglages_auto || {}).cles || {};
    dit(!cl.vinted_cadence.comptes[INCONNU] && cl.vinted_cadence.comptes[UID].actionsHeure === 60, 'R3 sans son choix : rien pour ce compte', JSON.stringify(cl.vinted_cadence));
    const g = fond();
    const ap2 = await g.appel({ quoi: 'apercu', texte: JSON.stringify(mod), choix: { [INCONNU]: true } });
    dit(ap2 && (ap2.changements || []).some((c) => c.cle === 'vinted_cadence' && c.compte === UID), 'R3 SON choix ⇒ au compte de l’onglet', JSON.stringify(ap2 && ap2.changements));
    await g.appel({ quoi: 'restaurer', confirme: true, jeton: ap2.jeton });
    const cl2 = (g.lignes.vrm_reglages_auto || {}).cles || {};
    dit(cl2.vinted_cadence.comptes[UID].actionsHeure === 20 && !cl2.vinted_cadence.comptes[INCONNU], 'R3 appliqué au compte de l’onglet, jamais au compte inconnu', JSON.stringify(cl2.vinted_cadence));
    const h = fond();
    const mod2 = JSON.parse(texte); mod2.comptes = { [AUTRE]: { cadence: { actionsHeure: 25 } } };
    const ap3 = await h.appel({ quoi: 'apercu', texte: JSON.stringify(mod2) });
    await h.appel({ quoi: 'restaurer', confirme: true, jeton: ap3.jeton });
    const cl3 = (h.lignes.vrm_reglages_auto || {}).cles || {};
    dit(cl3.vinted_cadence.comptes[AUTRE].actionsHeure === 25 && cl3.vinted_cadence.comptes[UID].actionsHeure === 60, 'R3 le MÊME compte (uid de son VRM) ⇒ à lui seul', JSON.stringify(cl3.vinted_cadence));
  });
  await essai('R4', async () => {
    const f = fond();
    const ancien = JSON.parse(texte); ancien.extension = '5.420.0'; ancien.generaux.vrm_seuil_prix = { seuil: 45 };
    const a = await f.appel({ quoi: 'apercu', texte: JSON.stringify(ancien) });
    dit(a && a.ok && a.memeVersion === false && (a.changements || []).some((c) => c.cle === 'vrm_seuil_prix'), 'R4 une autre version compatible passe (et c’est dit)', JSON.stringify(a).slice(0, 160));
    const recent = JSON.parse(texte); recent.formatVersion = 2; recent.extension = '6.0.0';
    const b = await f.appel({ quoi: 'apercu', texte: JSON.stringify(recent) });
    dit(b && b.ok === false && b.code === 'trop-recent' && /plus récente/.test(b.raison), 'R4 plus récente ⇒ refusée et dite', JSON.stringify(b));
    const vieux = JSON.parse(texte); vieux.extension = '5.300.0';
    const c = await f.appel({ quoi: 'apercu', texte: JSON.stringify(vieux) });
    dit(c && c.ok === false && c.code === 'trop-ancien', 'R4 trop ancienne ⇒ refusée et dite', JSON.stringify(c));
    const d = await f.appel({ quoi: 'apercu', texte: '{"bonjour":1}' });
    const e = await f.appel({ quoi: 'apercu', texte: '{abîmé' });
    dit(d && d.code === 'format' && e && e.code === 'illisible', 'R4 pas une sauvegarde VRM / abîmé ⇒ refusé et dit', JSON.stringify([d, e]));
  });
  await essai('R5', async () => {
    const f = fond({ lectureKO: (u) => /vrm_favoris_reglages/.test(u) });
    const r = await f.appel({ quoi: 'exporter' });
    dit(r && r.ok === false && r.code === 'lecture' && !r.texte, 'R5 lecture ratée ⇒ aucun fichier (il serait incomplet)', JSON.stringify(r).slice(0, 160));
    const g = fond({ lectureKO: (u) => /vrm_reglages_auto/.test(u) });
    const av = instant(g);
    const ap = await g.appel({ quoi: 'apercu', texte });
    dit(ap && ap.ok === false && instant(g) === av, 'R5 lecture ratée ⇒ ni aperçu ni écriture', JSON.stringify(ap));
  });
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
