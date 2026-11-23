#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  EXTENSION 5.428.0 (21 nov., choix 57-58-59 de Julien) — node scripts/audit-ext-5428.cjs [--recopie] [--prouve] [--src <bg.js>]
//   M. « Masquée par Vinted » : masquée par LUI (sa requête vue sur vinted.fr) ou par VRM (son journal, ce Chrome ou un
//      autre) ⇒ AUCUNE alerte ; journal illisible ⇒ rien (pas su), et la lecture suivante rejuge ; masquée sans geste ⇒
//      UNE alerte (titre, taille, raison si Vinted la donne) et UNE notification ; relue pareille ⇒ rien de plus ;
//      réapparue ⇒ levée. Aucune requête Vinted de plus.
//   C. La courbe : un point par annonce et par jour (la lecture la plus tardive du jour), jamais une annonce d'un autre
//      membre, un champ absent reste `null` ; 120 jours ; un jour non lu est `lu: false` avec des `null` (jamais
//      interpolé) ; prix changé MESURÉ ; repères du journal (baisse, republiée sur l'ancienne ET la nouvelle, masquée,
//      favori) ; la ligne `courbes_annonces_{uid}_{nav}` publiée ; la fiche du panneau lit UNE annonce (projection).
//   D. « En direct » : l'état réel de l'extension (`etatPourApp().direct`) ; extension muette ⇒ « — · pas ouverte »,
//      jamais « rien en cours » ; action qui ne bouge plus depuis 3 min ⇒ plus dite « en cours » ; « Tout arrêter » =
//      le chemin du panneau (arrêt posé + action finie « arret ») ; chaque changement d'action prévient l'app.
//   X. les blocs de l'extension sont la COPIE exacte de src (`--recopie` refait celui de la courbe).
//  `--prouve` : chaque mutation rougit l'audit ; le background.js de claude/ext-5420 rougit M, C et D.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const RACINE = path.join(__dirname, '..');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const COURBE = path.join(RACINE, 'src', 'courbeAnnonce.js');
const MODER = path.join(RACINE, 'src', 'moderationVinted.js');
const DIRECT = path.join(RACINE, 'src', 'extension', 'enDirect.js');
const argv = process.argv.slice(2);
const bloc = (txt, a, b) => { const i = txt.indexOf(a), k = txt.indexOf(b); return i >= 0 && k > i ? txt.slice(i, k + b.length) : null; };
if (argv.includes('--recopie')) {
  const s = bloc(fs.readFileSync(COURBE, 'utf8'), '// <courbe-regle>', '// </courbe-regle>');
  const bg = fs.readFileSync(BG, 'utf8'); const b = bloc(bg, '// <courbe-regle>', '// </courbe-regle>');
  if (!s || !b) { console.error('balises introuvables'); process.exit(1); }
  fs.writeFileSync(BG, bg.replace(b, s)); console.log('✓ bloc <courbe-regle> recopié dans background.js'); process.exit(0);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!process.env.AUDIT_MUET) console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
const H = 3600e3, J = 864e5;
const attendre = (ms = 30) => new Promise((r) => setTimeout(r, ms));

// ── R. LES RÈGLES (src) ───────────────────────────────────────────────────────
async function regles({ moder = MODER, courbe = COURBE, direct = DIRECT } = {}) {
  if (!process.env.AUDIT_MUET) console.log('\nR · les règles (src)');
  const M = await import('file://' + moder + '?v=' + Math.random());
  const C = await import('file://' + courbe + '?v=' + Math.random());
  const D = await import('file://' + direct + '?v=' + Math.random());
  const t0 = Date.now() - 2 * H, t1 = Date.now() - H;
  const av = { at: t0, etats: { 1000001: 'o', 1000002: 'o', 1000003: 'o' } }, ap = { at: t1, etats: { 1000001: 'h', 1000002: 'o', 1000003: 'o' } };
  const E = (x) => M.evenementsDressingModeration({ avant: av, apres: ap, supprimees: {}, vacances: null, ...x }).evenements.filter((e) => e.s === 'masquee');
  dit(E({}).length === 1, 'RM1 masquée sans geste connu ⇒ une alerte');
  dit(E({ masquesConnus: { 1000001: 'vrm' } }).length === 0, 'RM2 masquée par VRM (journal) ⇒ aucune alerte');
  dit(E({ masquesConnus: { 1000001: 'lui' } }).length === 0, 'RM3 masquée par LUI (sa requête vue) ⇒ aucune alerte');
  dit(E({ masquesConnus: null }).length === 0, 'RM4 « qui a masqué » pas su ⇒ aucune alerte (jamais sur « pas su »)');
  dit(E({ masquesConnus: { 1000009: 'vrm' } }).length === 1, 'RM5 un geste sur UNE AUTRE annonce n’efface pas l’alerte (identité)');
  const det = M.detailsMasqueesModeration([{ id: 1000001, is_hidden: true, title: 'Nike Air Max 1', size_title: '42', hide_reason: 'Possible counterfeit item' }, { id: 1000002, title: 'x' }]);
  const e1 = E({ details: det })[0] || {};
  dit(e1.ti === 'Nike Air Max 1' && e1.ta === '42' && e1.r === 'Possible counterfeit item' && e1.c === 'authenticite', 'RM6 titre, taille, raison lue, conseil « authenticité »', JSON.stringify(e1));
  const det2 = M.detailsMasqueesModeration([{ id: 1000001, is_hidden: true, title: 'Nike Air Max 1', size: { title: '42' } }]);
  const e2 = E({ details: det2 })[0] || {};
  dit(e2.ti === 'Nike Air Max 1' && e2.ta === '42' && !e2.r && !e2.c, 'RM7 sans raison de Vinted : rien d’inventé (ni r ni conseil)', JSON.stringify(e2));
  dit(M.raisonMasquage({ hide_reason: true }) === '' && M.raisonMasquage({ title: 'Raison : copie' }) === '', 'RM8 une raison n’est lue que dans ses champs, en texte (le titre n’en est pas une)');
  const n1 = M.nettoyerModeration(e1);
  dit(n1 && n1.ti && n1.ta && n1.r && n1.c === 'authenticite', 'RM9 la ligne garde titre, taille, raison, conseil (bornés)', JSON.stringify(n1));

  // Courbe
  const T = new Date(2026, 10, 21, 18, 0).getTime();
  const it = (id, v, f, p, x = {}) => ({ id, view_count: v, favourite_count: f, price: { amount: String(p) }, ...x });
  let r = C.ajouterPointsCourbe({}, [it(2000001, 10, 1, 60), it(2000002, 5, 0, 40, { user_id: 999 }), { id: 2000003 }], T, '111');
  dit(r.memo[2000001] && r.memo[2000001].length === 1 && !r.memo[2000002] && !r.memo[2000003], 'RC1 un point par annonce ; une annonce d’un AUTRE membre et une annonce sans chiffre n’entrent pas', JSON.stringify(r.memo));
  r = C.ajouterPointsCourbe(r.memo, [it(2000001, 14, 2, 60)], T + 2 * H, '111');
  dit(r.memo[2000001].length === 1 && r.memo[2000001][0][1] === 14, 'RC2 le même jour : la lecture la plus tardive gagne', JSON.stringify(r.memo[2000001]));
  r = C.ajouterPointsCourbe(r.memo, [it(2000001, 9, 2, 60)], T - 3 * H, '111');
  dit(r.memo[2000001][0][1] === 14, 'RC3 une lecture PLUS ANCIENNE du même jour n’écrase pas');
  r = C.ajouterPointsCourbe(r.memo, [{ id: 2000001, favourite_count: 3 }], T + 3 * J, '111');
  const pt = r.memo[2000001][1];
  dit(pt && pt[1] === null && pt[2] === 3 && pt[3] === null, 'RC4 un champ absent reste null (jamais 0)', JSON.stringify(pt));
  const vieux = C.ajouterPointsCourbe({ 2000001: [[C.jourCourbe(T) - 200, 1, 1, 100, 0]] }, [], T, '111');
  dit(!vieux.memo[2000001], 'RC5 au-delà de 120 jours : retiré');
  const S = C.serieCourbe([{ p: r.memo[2000001], e: [] }], { maintenant: T + 3 * J, jours: 7 });
  const lus = S.jours.filter((d) => d.lu);
  const trous = S.jours.filter((d) => !d.lu);
  dit(S.jours.length === 7 && lus.length === 2 && trous.every((d) => d.vues === null && d.fav === null && d.prix === null), 'RC6 jours non lus : lu false et valeurs null (jamais interpolées)', JSON.stringify(S.jours));
  const S2 = C.serieCourbe([{ p: [[C.jourCourbe(T) - 2, 5, 1, 6000, 600], [C.jourCourbe(T), 9, 1, 5500, 600]], e: [] }], { maintenant: T, jours: 7 });
  dit(S2.reperes.some((x) => x.code === 'q'), 'RC7 prix différent entre deux lectures ⇒ « prix changé » mesuré', JSON.stringify(S2.reperes));
  const S3 = C.serieCourbe([{ p: [[C.jourCourbe(T), 5, 1, 6000, 600]], e: [] }, { p: [[C.jourCourbe(T), 7, 2, 6000, 900]], e: [] }], { maintenant: T, jours: 7 });
  dit(S3.jours[6].vues === 7, 'RC8 deux navigateurs le même jour : le plus tardif');
  const rep = C.reperesJournalCourbe([{ t: T, s: 'baisse_prix', a: '2000001' }, { t: T, s: 'republiee', a: '2000001', b: '2000009' }, { t: T, s: 'masquee', a: '2000001' }, { t: T, s: 'favori', a: '2000001' }, { t: T, s: 'reponse', a: '2000001' }], T);
  dit(JSON.stringify((rep[2000001] || []).map((x) => x[1]).sort()) === JSON.stringify(['f', 'm', 'p', 'r']) && rep[2000009] && rep[2000009][0][1] === 'r', 'RC9 repères du journal : baisse, republiée (ancienne ET nouvelle), masquée, favori — rien d’autre', JSON.stringify(rep));

  // En direct
  const now = Date.now();
  const act = (x) => ({ ok: true, direct: { v: 1, at: now, tout: 0, arret: false, action: { sorte: 'republier', actif: true, enCours: true, fait: 2, total: 6, prochain: null, verification: false, uid: '111', maj: now - 5000, fin: null, ...x } } });
  dit(D.enDirect(null).code === 'absente' && D.enDirect(null).lignes[0].cle === 'direct.absente', 'RD1 extension muette ⇒ « — · extension pas ouverte » (jamais « tout va bien »)');
  dit(D.enDirect(undefined).code === 'lecture', 'RD2 pas encore demandé ⇒ « je demande »');
  dit(D.enDirect({ ok: true }).code === 'ancienne', 'RD3 extension sans `direct` ⇒ « mets-la à jour »');
  const d1 = D.enDirect(act({}), { maintenant: now });
  dit(d1.lignes[0].cle === 'direct.republier.n' && d1.lignes[0].vars.n === 3 && d1.lignes[0].vars.total === 6 && d1.arreter, 'RD4 « Republie 3/6 » + « Tout arrêter »', JSON.stringify(d1));
  const d2 = D.enDirect(act({ maj: now - 10 * 60000 }), { maintenant: now });
  dit(d2.code === 'muette' && !d2.lignes.some((l) => /republier/.test(l.cle)) && !d2.arreter, 'RD5 rien n’a bougé depuis 10 min ⇒ plus « en cours » (jamais un faux « Republie »)', JSON.stringify(d2));
  const d3 = D.enDirect(act({ sorte: 'favoris', enCours: false, prochain: now + 600000, fait: 4, total: 15 }), { maintenant: now });
  dit(d3.lignes[0].cle === 'direct.favoris.prochain' && d3.lignes[0].vars.heure === now + 600000, 'RD6 « Prochain favori à HH:MM »');
  const d4 = D.enDirect({ ok: true, direct: { v: 1, tout: now - 60000, action: null, arret: false } }, { maintenant: now });
  dit(d4.code === 'tout' && d4.reprendre && !d4.arreter, 'RD7 tout arrêté ⇒ dit, « Reprendre »');
  const d5 = D.enDirect({ ok: true, direct: { v: 1, tout: 0, action: null, arret: { quoi: 'captcha', depuis: now } } }, { maintenant: now });
  dit(d5.lignes[0].cle === 'direct.verification', 'RD8 « En pause : vérification Vinted »');
  const d6 = D.enDirect({ ok: true, direct: { v: 1, tout: 0, action: null, arret: false } }, { maintenant: now });
  dit(d6.code === 'rien' && d6.lignes[0].cle === 'direct.rien' && !d6.arreter, 'RD9 rien en cours ⇒ « Rien en cours », pas de bouton');
}

// ── E. LE VRAI background.js ──────────────────────────────────────────────────
async function fond(src) {
  if (!process.env.AUDIT_MUET) console.log('\nE · le vrai background.js (vm) — ' + path.basename(path.dirname(src)) + '/' + path.basename(src));
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111';
  const dressing = (items) => ({ items, pagination: { total_entries: items.length, total_pages: 1, current_page: 1 } });
  const it = (id, x = {}) => ({ id, title: 'Nike Air Max 1', size_title: '42', price: { amount: '60.0' }, view_count: 10, favourite_count: 2, url: `https://www.vinted.fr/items/${id}`, ...x });
  const monter = (x = {}) => faireFond({ src, connecte: UID, vrm: () => ({ status: 200, body: { ok: true } }), ...x });
  const pushs = (j) => j.vrmApi.filter((e) => /\/api\/push$/.test(e.url) && e.corps && e.corps.action === 'moderation');
  const ligne = (f) => (f.lignes[`moderation_vinted_${UID}`] || {}).e || null;
  const ranger = (f, items) => f.ctx.storeHarvestRow(UID, 'listings', dressing(items), 'www.vinted.fr', { complet: true });
  const trois = () => [it(1000001), it(1000002), it(1000003)];
  const masq = () => [it(1000001, { is_hidden: true }), it(1000002), it(1000003)];
  await essaie('EM1', async () => {
    const f = monter();
    await ranger(f, trois());
    await f.ctx.noterJournal(UID, 'masquee', { a: '1000001' });   // VRM l'a masquée (vendue ailleurs)
    await ranger(f, masq());
    dit(ligne(f) === null && pushs(f.j).length === 0, 'EM1 masquée PAR VRM (journal) ⇒ aucune alerte, aucune notification', JSON.stringify(ligne(f)));
  });
  await essaie('EM2', async () => {
    const f = monter();
    await ranger(f, trois());
    await f.ctx.storeWriteReq('www.vinted.fr', 'PUT', 'https://www.vinted.fr/api/v2/items/1000001/is_hidden', '{"is_hidden":true}');
    await ranger(f, masq());
    dit(ligne(f) === null && pushs(f.j).length === 0, 'EM2 masquée PAR LUI (sa requête vue sur vinted.fr) ⇒ aucune alerte', JSON.stringify(ligne(f)));
  });
  await essaie('EM3', async () => {
    const f = monter({ lignes: { [`journal_vrm_${UID}_autrenav`]: { uid: UID, e: [{ t: Date.now(), s: 'masquee', a: '1000001' }] } } });
    await ranger(f, trois());
    await ranger(f, masq());
    dit(ligne(f) === null, 'EM3 masquée par VRM dans un AUTRE Chrome (journal en base) ⇒ aucune alerte');
  });
  await essaie('EM4', async () => {
    let casse = true;
    const f = monter({ lectureKO: (u) => casse && /journal_vrm_/.test(String(u)) });
    await ranger(f, trois());
    await ranger(f, masq());
    dit(ligne(f) === null && pushs(f.j).length === 0, 'EM4 journal illisible ⇒ rien (pas su)');
    casse = false;
    await ranger(f, masq());
    const l = ligne(f) || [];
    dit(l.length === 1 && l[0].a === '1000001', 'EM4b la lecture suivante rejuge et trouve (le point de départ n’avait pas avancé)', JSON.stringify(l));
  });
  await essaie('EM5', async () => {
    const f = monter();
    await ranger(f, trois());
    await ranger(f, [it(1000001, { is_hidden: true, hide_reason: 'Photos not allowed' }), it(1000002), it(1000003)]);
    const l = ligne(f) || [];
    dit(l.length === 1 && l[0].s === 'masquee' && l[0].ti === 'Nike Air Max 1' && l[0].ta === '42' && l[0].r === 'Photos not allowed' && l[0].c === 'photos', 'EM5 masquée sans geste : UNE alerte (titre, taille, raison, conseil)', JSON.stringify(l));
    dit(pushs(f.j).length === 1, 'EM5 UNE notification (chemin push existant)');
    dit(f.j.vinted.length === 0, 'EM5 aucune requête Vinted de plus', String(f.j.vinted.length));
    await ranger(f, [it(1000001, { is_hidden: true }), it(1000002), it(1000003)]);
    dit((ligne(f) || []).length === 1 && pushs(f.j).length === 1, 'EM6 relue pareille ⇒ ni alerte ni notification de plus');
    const pc = await f.envoyer({ from: 'vrm-badge', action: 'moderationCarte' }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    dit(pc && pc.ok && pc.liste.length === 1 && pc.liste[0].a === '1000001' && pc.liste[0].r === 'Photos not allowed', 'EM7 le panneau reçoit la rangée (compte de l’onglet)', JSON.stringify(pc));
    await ranger(f, trois());
    dit(((ligne(f) || [])[0] || {}).f > 0, 'EM8 réapparue ⇒ alerte levée');
    const pc2 = await f.envoyer({ from: 'vrm-badge', action: 'moderationCarte' }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    dit(pc2 && pc2.ok && pc2.liste.length === 0, 'EM8b levée ⇒ plus dans le panneau');
  });
  await essaie('EC', async () => {
    const f = monter();
    await ranger(f, [it(2000001, { view_count: 12, favourite_count: 3 }), it(2000002, { user_id: 999 })]);
    const cles = Object.keys(f.lignes).filter((k) => /^courbes_annonces_111_/.test(k));
    const a = cles.length ? f.lignes[cles[0]].a : {};
    dit(cles.length === 1 && a[2000001] && a[2000001][0][1] === 12 && a[2000001][0][2] === 3 && a[2000001][0][3] === 6000 && !a[2000002], 'EC1 la lecture du dressing range un point (vues, favoris, prix) ; jamais l’annonce d’un autre membre', JSON.stringify({ cles, a }));
    dit(f.j.vinted.length === 0, 'EC2 aucune requête Vinted pour la courbe');
    const r = await f.envoyer({ from: 'vrm-badge', action: 'courbeAnnonce', id: '2000001', jours: 7 }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    dit(r && r.ok && r.serie && r.serie.lus === 1 && r.serie.jours.length === 7 && r.serie.jours.filter((d) => !d.lu).every((d) => d.vues === null), 'EC3 la fiche du panneau reçoit la série (1 jour lu, les autres « — »)', JSON.stringify(r && r.serie));
    const f2 = monter({ lectureKO: (u) => /courbes_annonces_/.test(String(u)) });
    const r2 = await f2.envoyer({ from: 'vrm-badge', action: 'courbeAnnonce', id: '2000001' }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    dit(r2 && r2.ok === false, 'EC4 base illisible et rien ici ⇒ « pas su » (jamais une courbe vide)', JSON.stringify(r2));
  });
  await essaie('ED', async () => {
    const f = monter();
    await f.ctx.poserAction({ actif: true, sorte: 'republier', uid: UID, debut: Date.now(), fait: 2, total: 6, enCours: true, prochain: null, quoi: '', item: { id: '1' } });
    await attendre(40);
    const e = await f.ctx.etatPourApp();
    const d = e && e.direct;
    dit(d && d.action && d.action.sorte === 'republier' && d.action.fait === 2 && d.action.total === 6 && d.action.enCours === true && d.tout === 0, 'ED1 etatPourApp().direct dit l’action réelle (republier 2/6, en cours)', JSON.stringify(d));
    dit(f.j.evts.some((x) => x && x.type === 'maj' && x.quoi === 'direct'), 'ED2 un changement d’action prévient l’app (maj · direct)', JSON.stringify(f.j.evts.slice(-3)));
    const r = await f.ctx.executerCommande({ cmd: 'toutArreter', on: true });
    const e2 = await f.ctx.etatPourApp();
    dit(r && r.accepte && e2.direct.tout > 0 && e2.direct.action && e2.direct.action.actif === false && e2.direct.action.fin && e2.direct.action.fin.raison === 'arret', 'ED3 « Tout arrêter » de l’app = chemin du panneau : arrêt posé ET action finie « arret »', JSON.stringify(e2.direct));
    dit(f.j.vinted.length === 0, 'ED4 aucune requête Vinted');
  });
}

function copies() {
  if (!process.env.AUDIT_MUET) console.log('\nX · les copies dans l’extension');
  const bg = fs.readFileSync(BG, 'utf8');
  const a = bloc(fs.readFileSync(COURBE, 'utf8'), '// <courbe-regle>', '// </courbe-regle>'), b = bloc(bg, '// <courbe-regle>', '// </courbe-regle>');
  dit(!!a && a === b, 'X1 <courbe-regle> de background.js = src/courbeAnnonce.js');
  const c = bloc(fs.readFileSync(MODER, 'utf8'), '// <moderation-regle>', '// </moderation-regle>'), d = bloc(bg, '// <moderation-regle>', '// </moderation-regle>');
  dit(!!c && c === d, 'X2 <moderation-regle> de background.js = src/moderationVinted.js');
}

async function tout(o = {}) { await regles(o); await fond(o.src || BG); if (!o.sansCopies) copies(); }

const MUT_SRC = [
  ['moder', 'masqué par VRM/lui ignoré', "    if (par.length) { masquees = masquees.filter((id) => !par.includes(id));", "    if (false) { masquees = masquees.filter((id) => !par.includes(id));"],
  ['moder', 'pas su = rien su', "if (masquees.length && masquesConnus === null) { masquees = []; raisons.push('masques-pas-sus'); }\n  else if", "if (false) {}\n  else if"],
  ['moder', 'raison inventée', "    if (d && d.r) { e.r = d.r; e.c = conseilMasquage(d.r); }", "    e.r = (d && d.r) || 'Annonce non conforme'; e.c = conseilMasquage(e.r);"],
  ['courbe', 'autre membre accepté', "  if (uid != null && proprio != null && String(proprio) !== String(uid)) return null;", ''],
  ['courbe', 'jours non lus interpolés', "    else out.push({ j, lu: false, vues: null, fav: null, prix: null });", "    else { const pr = out[out.length - 1]; out.push({ j, lu: false, vues: pr ? pr.vues : null, fav: pr ? pr.fav : null, prix: pr ? pr.prix : null }); }"],
  ['courbe', 'champ absent = 0', "function entierCourbe(v) { if (v == null || v === '' || typeof v === 'boolean') return null;", "function entierCourbe(v) { if (v == null || v === '' || typeof v === 'boolean') return 0;"],
  ['courbe', 'lecture ancienne écrase', "    else if (pt.p[4] >= l[i][4] && JSON.stringify", "    else if (JSON.stringify"],
  ['direct', 'action périmée dite en cours', "  const frais = a && a.maj > 0 && maintenant - a.maj < FRAIS_MS;", "  const frais = !!a;"],
  ['direct', 'muette = rien en cours', "  if (!etat || etat.ok === false) return { code: 'absente', lignes: [{ cle: 'direct.absente', vars: {}, ton: 'neutre' }], arreter: false, reprendre: false };", "  if (!etat || etat.ok === false) return { code: 'rien', lignes: [{ cle: 'direct.rien', vars: {}, ton: 'neutre' }], arreter: false, reprendre: false };"],
];
const MUT_BG = [
  ['requête de masquage pas notée', "if (c && typeof c.is_hidden === 'boolean') await noterMasqueVu(", "if (false) await noterMasqueVu("],
  ['journal des autres Chrome ignoré', "        const ailleurs = await masquesConnusJournalBase(u, depuis);", "        const ailleurs = {};"],
  ['journal illisible avancé', "        if (ailleurs === null) { noterDiag('moderation_journal_pas_su'); return null; }", "        if (ailleurs === null) { noterDiag('moderation_journal_pas_su'); }"],
  ['courbe non rangée (active)', "    if (ecritRow !== false) { try { await noterCourbes(uid, (brut && brut.items) || [], Date.now()); } catch (_) {} }", ''],
  ['tout arrêter sans finir l’action', "if (r.ok && msg.on === true) await finirActionEnCours('arret').catch(() => {});", ''],
  ['action sans prévenir l’app', "Object.assign({ v: 1 }, a, { maj: Date.now() }) }); } catch (_) {} signalerDirect(); }", "Object.assign({ v: 1 }, a, { maj: Date.now() }) }); } catch (_) {} }"],
];
async function prouver() {
  process.env.AUDIT_MUET = '1';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-5428-'));
  let bonnes = 0, total = 0;
  const fichiers = { moder: MODER, courbe: COURBE, direct: DIRECT };
  for (const [qui, nom, a, b] of MUT_SRC) {
    total++;
    const base = fs.readFileSync(fichiers[qui], 'utf8');
    if (!base.includes(a)) { console.log('  ❌ mutation introuvable : ' + nom); continue; }
    const f = path.join(tmp, `${qui}-${total}.mjs`); fs.writeFileSync(f, base.replace(a, b));
    ok = 0; ko = 0;
    await regles({ ...{ moder: MODER, courbe: COURBE, direct: DIRECT }, [qui]: f }).catch(() => { ko++; });
    console.log((ko ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » ⇒ ${ko ? 'rouge' : 'RESTE VERTE'}`); if (ko) bonnes++;
  }
  const bg = fs.readFileSync(BG, 'utf8');
  for (const [nom, a, b] of MUT_BG) {
    total++;
    if (!bg.includes(a)) { console.log('  ❌ mutation introuvable : ' + nom); continue; }
    const f = path.join(tmp, `bg-${total}.js`); fs.writeFileSync(f, bg.replace(a, b));
    ok = 0; ko = 0;
    await fond(f).catch(() => { ko++; });
    console.log((ko ? '  ✅ ' : '  ❌ ') + `mutation du fond « ${nom} » ⇒ ${ko ? 'rouge' : 'RESTE VERTE'}`); if (ko) bonnes++;
  }
  total++;
  const ancien = path.join(tmp, 'background-5420.js');
  try { fs.writeFileSync(ancien, cp.execFileSync('git', ['show', 'origin/claude/ext-5420:vinted-sync-extension/background.js'], { cwd: RACINE, maxBuffer: 64 << 20 })); } catch (_) {}
  ok = 0; ko = 0;
  if (fs.existsSync(ancien)) await fond(ancien).catch(() => { ko++; });
  console.log((ko ? '  ✅ ' : '  ❌ ') + `background.js de claude/ext-5420 ⇒ ${ko ? `rouge (${ko})` : 'RESTE VERT'}`); if (ko) bonnes++;
  console.log(`\n${bonnes}/${total} preuves rougissent l’audit.`);
  process.exit(bonnes === total ? 0 : 1);
}

(async () => {
  if (argv.includes('--prouve')) return prouver();
  const i = argv.indexOf('--src');
  await tout({ src: i >= 0 ? path.resolve(argv[i + 1]) : BG, sansCopies: i >= 0 });
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
