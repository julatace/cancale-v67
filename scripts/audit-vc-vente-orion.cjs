// ════════════════════════════════════════════════════════════════════════════
//  LA VENTE VESTIAIRE CAPTÉE JUSTE, SUR ORION (iPhone) COMME SUR ORDINATEUR
//  (13 nov., ext. 5.374 — docs/passation/2026-11-13-vestiaire-vente-orion.md)
//
//  Julien : « l'extension a mal capté la vente de Vestiaire Collective sur Orion
//  sur mon iPhone, je veux que ça soit mieux ». Mesuré (lecture seule) : depuis le
//  3 nov. seul l'iPhone (Orion 5.368) passe sur Vestiaire ; il a rangé le fil des
//  notifications et le compteur, JAMAIS une vente (`vc_ventes` figé au 2 nov.) ;
//  aucune vente n'a de compte (`vc_session` jamais écrit) ; la date rangée de la
//  vente du 2 nov. est l'HEURE D'UNE VISITE (21:00:32), pas celle de la vente (14:17:41).
//
//  VRAI vc-inject.js + VRAI vc.js + VRAI background.js (`_vc-vente-orion.cjs`),
//  réponses de la FORME mesurée, valeurs INVENTÉES.
//   O  Orion : capteur posé APRÈS la page, `Date.parse` de WebKit ⇒ la vente
//      demandée avant lui est rattrapée (UNE lecture, GET, la même adresse),
//      rangée avec sa date, son compte, son prix et ce que Vestiaire verse.
//   D  ordinateur : la date de vente vient de « Mes ventes » (`soldDate`), à
//      l'heure de Paris ; « à expédier » (dont le `soldDate` est l'heure de la
//      lecture) ne la change jamais ; seule, elle ne donne que le jour.
//   C  le compte de la page (`__NEXT_DATA__`, « user.user ») : `vc_session` et
//      `compte` de la vente ; ni nom ni e-mail ne sortent.
//   P  les ventes portées par la page : PARTIELLES (jamais « liste entière »,
//      rien ne sort de « à expédier ») ; forme inconnue ⇒ forme rangée, rien d'écrit ;
//      une lecture partielle n'écrase pas une lecture entière.
//   X  une extension d'avant (« à expédier » sans `dateCle`) ne redate rien.
//   K  le paquet Orion pose vc-inject.js EN LIGNE (zip-extension.cjs, orion-main.js).
//   A  l'app : une date sans fuseau est l'heure de Paris (`dateVenteVc`).
//  `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'UTC';   // le serveur (Vercel) vit en UTC : c'est là qu'une date sans fuseau se lisait mal
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const H = require('./_vc-vente-orion.cjs');
const racine = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : undefined; };
const F = Object.assign(H.fichiers(arg), {
  regle: arg('--regle') || path.join(racine, 'api/_lib/vestiaire-regle.js'),
  zip: arg('--zip') || path.join(racine, 'scripts/zip-extension.cjs'),
  orionMain: arg('--orion-main') || path.join(racine, 'scripts/extension-orion/orion-main.js'),
});

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['injectAExpSoldDate', 'inject', "    if (source === 'a-expedier') {\n      const d = dateLue(e.orderConfirmationDate);", "    if (false) {\n      const d = dateLue(e.orderConfirmationDate);"],
    ['injectDateParse', 'inject', "    for (const k of CLES_DATE_VENTES) { const d = dateLue(e[k]); if (d) return { date: d, cle: k }; }", "    for (const k of CLES_DATE_VENTES) { const d = isFinite(Date.parse(e[k])) ? dateLue(e[k]) : ''; if (d) return { date: d, cle: k }; }"],
    ['injectComptePage', 'inject', "post({ kind: 'vcmoi', id, source: 'page', forme: ['user.user.id'] });", "void ({ kind: 'vcmoi', id, source: 'page', forme: ['user.user.id'] });"],
    ['injectRattrapage', 'inject', "        if (!e || !(Number(e.startTime) < T_POSE)) continue;", '        continue;'],
    ['injectRattrapageDejaVue', 'inject', "        if (!sourceVentes(u) || ventesVuesUrls.has(u.href) || manquees.some((x) => x.href === u.href)) continue;", "        if (!sourceVentes(u) || manquees.some((x) => x.href === u.href)) continue;"],
    ['injectRattrapageNombre', 'inject', '        if (manquees.length >= 2) break;', ''],
    ['injectPagePartielle', 'inject', "post(Object.assign({ kind: 'vcventes', origine: 'page', cleRequete: sansId(lib).slice(0, 80) }, pq, { total: null }));", "post(Object.assign({ kind: 'vcventes', origine: 'page', cleRequete: sansId(lib).slice(0, 80) }, pq));"],
    ['injectPageVentes', 'inject', "        if (!KEY_VENTES.test(lib) || KEY_PAS_VENTES.test(lib) || !PAGE_U) continue;", '        continue;'],
    ['injectNomSort', 'inject', "if (k[0] !== 'user.user' || !d || typeof d !== 'object' || Array.isArray(d)) continue;", "if (k[0] !== 'user.user' || !d || typeof d !== 'object' || Array.isArray(d)) continue; post({ kind: 'vcmoi', id: String(d.id), source: 'page', forme: [String(d.email)] });"],
    ['relaisDateCle', 'relais', "dateCle: /^[A-Za-z_]{1,40}$/.test(String((x && x.dateCle) || '')) ? String(x.dateCle) : '',", "dateCle: '',"],
    ['relaisOrigine', 'relais', "origine: d.origine === 'page' || d.origine === 'relue' ? d.origine : '',", "origine: '',"],
    ['relaisSourcePage', 'relais', "source: d.source === 'stream' || d.source === 'page' ? d.source : 'users/me',", "source: d.source === 'stream' ? 'stream' : 'users/me',"],
    ['fondParis', 'src', "  return `${base}${off < 0 ? '-' : '+'}${deux(Math.floor(z / 60))}:${deux(z % 60)}`;", '  return base;'],
    ['fondAExpGarde', 'src', "(source === 'a-expedier' && x.dateCle === 'orderConfirmationDate' && /^\\d{4}-\\d{2}-\\d{2}$/.test(d) ? 'a-expedier' : ''));", "(source === 'a-expedier' ? 'a-expedier' : ''));"],
    ['fondVentesGagne', 'src', "  if (de === 'a-expedier' && p.dateDe !== 'ventes') return { date: d, dateDe: 'a-expedier' };", "  if (de === 'a-expedier') return { date: d, dateDe: 'a-expedier' };"],
    ['fondPageEntiere', 'src', "  const entier = m.origine !== 'page' && ((offset === 0", "  const entier = ((offset === 0"],
    ['fondPartielleEcrase', 'src', "  const lecture = (prevL && prevL.complet === true && !entier) ? Object.assign({}, prevL, { partielleAt: now })", '  const lecture = false ? 0'],
    ['fondSessionPage', 'src', "source: source === 'stream' || source === 'page' ? source : 'users/me',", "source: source === 'stream' ? 'stream' : 'users/me',"],
    ['zipVcEnLigne', 'zip', " if(fs.existsSync(vc))sources['vc-inject.js']=fs.readFileSync(vc,'utf8');", ''],
    ['regleParis', 'regle', "export const dateVenteVc = (v) => tempsVc(v && v.date);", "export const dateVenteVc = (v) => { const t = Date.parse((v && v.date) || ''); return Number.isFinite(t) && t > 0 ? t : 0; };"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vc-vente-orion-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const dossier = path.join(tmp, nom); fs.mkdirSync(dossier, { recursive: true });
    let fichier = path.join(dossier, path.basename(F[cle]));
    if (cle === 'regle') for (const dep of fs.readdirSync(path.dirname(F.regle))) if (dep.endsWith('.js')) fs.copyFileSync(path.join(path.dirname(F.regle), dep), path.join(dossier, dep));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + (cle === 'orionMain' ? 'orion-main' : cle), fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + (k === 'orionMain' ? 'orion-main' : k), F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 240000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 600)}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, `${nom} · a planté`, e && e.stack); } };
const { attendre, copie, URL_VENTES, URL_A_EXP, URL_COMPTEUR, MOI, ART, ART2 } = H;
const vente = (S, id) => S.lignes.vc_ventes && S.lignes.vc_ventes.ventes && S.lignes.vc_ventes.ventes[id];
const de = (posts, k) => posts.filter((x) => x.kind === k);

(async () => {
  // ── O : la plainte — Orion sur iPhone, capteur posé après la page.
  await essaie('O', async () => {
    const r = await H.scenarioOrion(F);
    const v = r.vc_ventes && r.vc_ventes.ventes && r.vc_ventes.ventes[ART];
    dit(!!v, 'O1 · Orion (capteur posé APRÈS la page) : la vente demandée avant lui est RANGÉE dans `vc_ventes`', JSON.stringify(r.vc_ventes && Object.keys(r.vc_ventes.ventes || {})));
    dit(!!v && v.date === '2026-11-13T00:41:07+01:00' && v.dateDe === 'ventes', 'O2 · sa date est celle de la VENTE (`soldDate`, heure de Paris), lue malgré le `Date.parse` de WebKit', JSON.stringify(v && [v.date, v.dateDe]));
    dit(!!v && v.montant && v.montant.cle === 'sellerEarning' && v.montant.valeur === 203.23 && v.montant.devise === 'EUR', 'O3 · ce que Vestiaire verse : 203,23 € sous `sellerEarning`', JSON.stringify(v && v.montant));
    dit(!!v && v.prixVente && v.prixVente.cle === 'sellerPrice' && v.prixVente.valeur === 209.52, 'O4 · le prix de vente : 209,52 € sous `sellerPrice` (jamais pris pour le versé)', JSON.stringify(v && v.prixVente));
    dit(!!v && v.compte === MOI && r.vc_session && r.vc_session.id === MOI && r.vc_session.source === 'page', 'O5 · le compte de l’onglet (lu dans la page) : `compte` de la vente et `vc_session`', JSON.stringify([v && v.compte, r.vc_session]));
    dit(!!v && v.etat === 'ACTION_NEEDED' && v.aExpedier === true && v.limite === '2026-11-20T23:59:59+01:00', 'O6 · état lu (ACTION_NEEDED), à expédier, date limite lue', JSON.stringify(v && [v.etat, v.aExpedier, v.limite]));
    const relues = r.S.p.appels.filter((a) => a.u === URL_VENTES || a.u === URL_A_EXP);
    dit(relues.length === 2 && relues.every((a) => a.m === 'GET' && a.cred === 'include') && new Set(relues.map((a) => a.u)).size === 2, 'O7 · rattrapage : UNE lecture par adresse que la page avait demandée, GET, la même adresse', JSON.stringify(relues.map((a) => a.m + ' ' + a.u)));
    dit(relues.every((a) => a.h && a.h['x-banc'] === 'entete-page'), 'O8 · avec les en-têtes que la page vient d’envoyer (gardés dans la page)', JSON.stringify(relues.map((a) => a.h)));
    const l = r.vc_ventes && r.vc_ventes.lectures;
    dit(!!l && l.ventes && l.ventes.origine === 'relue' && l.ventes.complet === false, 'O9 · la lecture est dite « relue », jamais « entière »', JSON.stringify(l));
    const sortie = JSON.stringify(r.vc_ventes) + JSON.stringify(r.vc_session) + JSON.stringify(r.S.p.posts);
    dit(!/Prénom-Inventé|Nom-Inventé|invente@exemple|rue inventée/.test(sortie), 'O10 · ni nom, ni e-mail, ni adresse ne sortent de la page', sortie.slice(0, 300));
  });
  // ── O11 : sur ordinateur (capteur posé AVANT la page), rien n'est relu.
  await essaie('O11', async () => {
    const S = H.systeme(F, { next: H.nextData(), avant: [URL_VENTES] });
    await S.p.charge();
    await S.p.demande(URL_VENTES, H.repVentes([H.venteOts(ART)]));
    await attendre(1800);
    const relues = S.p.appels.filter((a) => a.u === URL_VENTES);
    dit(relues.length === 1, 'O11 · ordinateur : la page demande « Mes ventes », le capteur la lit au vol — AUCUNE lecture de plus', JSON.stringify(S.p.appels.map((a) => a.u)));
    dit(!!vente(S, ART) && vente(S, ART).date === '2026-11-13T00:41:07+01:00', 'O11 · et la vente est rangée avec sa date', JSON.stringify(vente(S, ART)));
  });
  // ── O12 : Orion, mais la page a REDEMANDÉ la liste après la pose : déjà lue, pas relue.
  await essaie('O12', async () => {
    const S = H.systeme(F, { tard: true, next: H.nextData(), avant: [URL_VENTES] });
    await S.p.demande(URL_VENTES, H.repVentes([H.venteOts(ART)]));
    await attendre(1900);
    const n = S.p.appels.filter((a) => a.u === URL_VENTES).length;
    dit(n === 1 && !!vente(S, ART), 'O12 · la page l’a redemandée après la pose (lue au vol) : pas de seconde lecture', JSON.stringify(S.p.appels.map((a) => a.u)));
  });
  // ── O13 : au plus deux adresses rattrapées par page.
  await essaie('O13', async () => {
    const autres = [1, 2, 3, 4].map((i) => `${H.API}/ots/sales?status=S${i}&isoCountry=FR`);
    const S = H.systeme(F, { tard: true, next: H.nextData(), avant: autres });
    for (const u of autres) S.p.servir('GET', u, H.repVentes([]));
    await S.p.demande(URL_COMPTEUR, { data: { messages: 0 } });
    await attendre(1900);
    const n = S.p.appels.filter((a) => autres.includes(a.u)).length;
    dit(n === 2, 'O13 · quatre listes passées avant le capteur : DEUX lectures au plus', String(n));
  });

  // ── D : la date de la vente (ordinateur), l'ordre des lectures.
  await essaie('D', async () => {
    const S = H.systeme(F, { next: H.nextData() });
    await S.p.charge();
    const p1 = await S.p.demande(URL_VENTES, H.repVentes([H.venteOts(ART)]));
    await attendre(60);
    const v1 = copie(vente(S, ART));
    const p2 = await S.p.demande(URL_A_EXP, H.repAExp([H.venteAExp(ART)]));
    await attendre(60);
    const v2 = vente(S, ART);
    dit(!!v1 && v1.date === '2026-11-13T00:41:07+01:00', 'D1 · « Mes ventes » : la date est `soldDate`, avec le fuseau de Paris (+01:00 en novembre)', JSON.stringify(v1 && v1.date));
    dit(!!v2 && v2.date === '2026-11-13T00:41:07+01:00' && v2.dateDe === 'ventes' && v2.aExpedier === true, 'D2 · puis « à expédier » (son `soldDate` = l’heure de la lecture) : la date ne bouge PAS', JSON.stringify(v2 && [v2.date, v2.dateDe]));
    const pa = de(p2, 'vcventes')[0];
    dit(!!pa && pa.ventes[0] && pa.ventes[0].date === '2026-11-13' && pa.ventes[0].dateCle === 'orderConfirmationDate', 'D3 · le capteur n’envoie de « à expédier » que le JOUR (`orderConfirmationDate`), jamais l’heure de la lecture', JSON.stringify(pa && pa.ventes[0]));
    const pv = de(p1, 'vcventes')[0];
    dit(!!pv && pv.ventes[0] && pv.ventes[0].dateCle === 'soldDate', 'D4 · « Mes ventes » : la clé de la date est dite (`soldDate`)', JSON.stringify(pv && pv.ventes[0] && pv.ventes[0].dateCle));
    // « à expédier » d'abord, puis « Mes ventes ».
    const T = H.systeme(F, { next: H.nextData() });
    await T.p.charge();
    await T.p.demande(URL_A_EXP, H.repAExp([H.venteAExp(ART2, { jour: 'November 12, 2026', lecture: '2026-11-13 21:00:32' })]));
    await attendre(60);
    const a1 = copie(vente(T, ART2));
    await T.p.demande(URL_VENTES, H.repVentes([H.venteOts(ART2, { soldDate: '2026-11-12 14:17:41' })]));
    await attendre(60);
    const a2 = vente(T, ART2);
    dit(!!a1 && a1.date === '2026-11-12' && a1.dateDe === 'a-expedier', 'D5 · « à expédier » seule : le jour de la vente (12 nov.), jamais l’heure de la visite (13 nov. 21:00)', JSON.stringify(a1 && [a1.date, a1.dateDe]));
    dit(!!a2 && a2.date === '2026-11-12T14:17:41+01:00' && a2.dateDe === 'ventes', 'D6 · puis « Mes ventes » : l’heure exacte remplace le jour seul', JSON.stringify(a2 && [a2.date, a2.dateDe]));
    // Heure d'été : le décalage de Paris À CETTE DATE.
    const E = H.systeme(F, { next: H.nextData() });
    await E.p.charge();
    await E.p.demande(URL_VENTES, H.repVentes([H.venteOts(ART, { soldDate: '2026-07-01 23:30:00' })]));
    await attendre(60);
    dit(vente(E, ART) && vente(E, ART).date === '2026-07-01T23:30:00+02:00', 'D7 · en été : +02:00', JSON.stringify(vente(E, ART) && vente(E, ART).date));
  });

  // ── C : le compte lu dans la page.
  await essaie('C', async () => {
    const S = H.systeme(F, { next: H.nextData() });
    await S.p.charge();
    const pm = de(S.p.posts, 'vcmoi');
    dit(pm.length === 1 && pm[0].id === MOI && pm[0].source === 'page', 'C1 · la page porte son compte (`user.user`) : le capteur le dit une fois, source « page »', JSON.stringify(pm));
    await S.p.demande(URL_VENTES, H.repVentes([H.venteOts(ART)]));
    await attendre(80);
    dit(S.lignes.vc_session && S.lignes.vc_session.id === MOI && vente(S, ART) && vente(S, ART).compte === MOI, 'C2 · `vc_session` écrit, la vente rangée sous CE compte', JSON.stringify([S.lignes.vc_session, vente(S, ART) && vente(S, ART).compte]));
    // Sans compte dans la page : rien de deviné.
    const T = H.systeme(F, { next: H.nextData({ moi: '' }) });
    await T.p.charge();
    await T.p.demande(URL_VENTES, H.repVentes([H.venteOts(ART)]));
    await attendre(80);
    dit(vente(T, ART) && vente(T, ART).compte === '' && !T.lignes.vc_session, 'C3 · la page ne dit pas son compte : `compte` vide (« pas su »), aucun `vc_session` inventé', JSON.stringify([vente(T, ART) && vente(T, ART).compte, T.lignes.vc_session]));
  });

  // ── P : les ventes que la page porte elle-même (mobile).
  await essaie('P', async () => {
    const req = (cle, data) => ({ queryKey: cle, queryHash: 'h', state: { status: 'success', data } });
    const S = H.systeme(F, { next: H.nextData({ device: 'mobile', requetes: [req(['seller.sales', { status: 'ACTION_NEEDED' }], H.repVentes([H.venteOts(ART2, { soldDate: '2026-11-11 09:05:00' })]))] }) });
    await S.p.charge();
    await attendre(100);
    const pp = de(S.p.posts, 'vcventes')[0];
    dit(!!pp && pp.origine === 'page' && pp.total === null && !pp.complet, 'P1 · une requête de la page qui nomme les ventes : envoyée PARTIELLE (ni total, ni liste entière)', JSON.stringify(pp && { o: pp.origine, t: pp.total, c: pp.complet }));
    const v = vente(S, ART2);
    dit(!!v && v.date === '2026-11-11T09:05:00+01:00' && v.compte === MOI && v.montant && v.montant.cle === 'sellerEarning', 'P2 · la vente portée par la page est rangée (date, compte, versé)', JSON.stringify(v));
    const lp = S.lignes.vc_ventes && S.lignes.vc_ventes.lectures && S.lignes.vc_ventes.lectures.ventes;
    dit(!!lp && lp.origine === 'page' && lp.complet === false, 'P3 · la lecture est dite « page », jamais complète', JSON.stringify(lp));
    // Une forme inconnue : rien d'écrit, sa forme rangée pour apprendre.
    const T = H.systeme(F, { next: H.nextData({ requetes: [req(['seller.sales'], { truc: { machin: 1 } })] }) });
    await T.p.charge();
    await attendre(100);
    const l = T.lignes.vc_ventes;
    dit(!!l && !Object.keys(l.ventes || {}).length && Array.isArray(l.forme && l.forme['inconnu-page-ventes']) && !(l.lectures && l.lectures.ventes), 'P4 · forme inconnue : aucune vente écrite, aucune lecture datée, la forme rangée (`inconnu-page-ventes`)', JSON.stringify(l));
    // Ni le récapitulatif ni un compteur ne sont des ventes.
    const R = H.systeme(F, { next: H.nextData({ requetes: [req(['user.sales-recap'], { meta: { count: 3 } }), req(['ots.me.status'], { data: { sales: { actionRequired: true } } })] }) });
    await R.p.charge();
    await attendre(100);
    dit(!de(R.p.posts, 'vcventes').length, 'P5 · « sales-recap » ou un statut ne sont pas lus comme des ventes', JSON.stringify(de(R.p.posts, 'vcventes')));
    // Une lecture « page » d'« à expédier » ne retire rien, même si le fond la reçoit complète.
    const lignes = { vc_ventes: { ventes: { [ART]: { productId: ART, aExpedier: true, date: '2026-11-10T10:00:00+01:00', dateDe: 'ventes', compte: MOI, sources: ['a-expedier'] } }, lectures: { 'a-expedier': { at: '2026-11-12T10:00:00.000Z', total: 1, complet: true } } } };
    const U = H.systeme(F, { lignes });
    await U.envoyer({ action: 'vcMoi', id: MOI, source: 'page', forme: [] });
    await U.envoyer({ action: 'vcVentes', source: 'a-expedier', origine: 'page', ventes: [{ id: ART2, productId: ART2, etat: '', date: '', montant: null, titre: '', photo: '' }], offset: 0, total: 1, lus: 1, complet: [ART2], moi: MOI, forme: [] });
    await attendre(60);
    const w = U.lignes.vc_ventes;
    dit(w.ventes[ART].aExpedier === true, 'P6 · une liste « page » (même dite entière) ne sort aucune vente de « à expédier »', JSON.stringify(w.ventes[ART]));
    dit(w.lectures['a-expedier'].complet === true && w.lectures['a-expedier'].at === '2026-11-12T10:00:00.000Z' && !!w.lectures['a-expedier'].partielleAt, 'P7 · la lecture ENTIÈRE d’avant garde sa date et son « complet » ; la partielle est datée à côté', JSON.stringify(w.lectures));
  });

  // ── X : une extension d'avant, ou une date rangée avant la 5.374.
  await essaie('X', async () => {
    const S = H.systeme(F, {});
    await S.envoyer({ action: 'vcVentes', source: 'a-expedier', ventes: [{ id: ART, productId: ART, etat: '', date: '2026-11-13 21:35:09', montant: { valeur: 203.23, devise: 'EUR', cle: 'sellerEarning' }, titre: 'x', photo: '' }], offset: 0, total: null, lus: 1, forme: [] });
    await attendre(60);
    dit(vente(S, ART) && vente(S, ART).date === '' && vente(S, ART).aExpedier === true, 'X1 · « à expédier » d’une extension d’avant (son `soldDate` = l’heure de la lecture) : AUCUNE date rangée, la vente l’est', JSON.stringify(vente(S, ART)));
    const lignes = { vc_ventes: { ventes: { [ART]: { productId: ART, date: '2026-11-02 21:00:32', aExpedier: true, sources: ['ventes', 'a-expedier'] } }, lectures: {} } };
    const T = H.systeme(F, { lignes });
    await T.envoyer({ action: 'vcVentes', source: 'ventes', ventes: [{ id: ART, productId: ART, etat: 'ACTION_NEEDED', date: '2026-11-02 14:17:41', dateCle: 'soldDate', montant: null, titre: '', photo: '' }], offset: 0, total: null, lus: 1, forme: [] });
    await attendre(60);
    dit(vente(T, ART) && vente(T, ART).date === '2026-11-02T14:17:41+01:00' && vente(T, ART).dateDe === 'ventes', 'X2 · une date rangée avant la 5.374 (l’heure d’une visite) cède à la date de « Mes ventes »', JSON.stringify(vente(T, ART)));
  });

  // ── K : le paquet Orion pose vc-inject.js EN LIGNE.
  await essaie('K', async () => {
    const zip = require(F.zip);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-orion-'));
    try {
      fs.copyFileSync(F.orionMain, path.join(tmp, 'orion-main.js'));
      fs.copyFileSync(path.join(path.dirname(F.inject), 'inject.js'), path.join(tmp, 'inject.js'));
      fs.copyFileSync(F.inject, path.join(tmp, 'vc-inject.js'));
      zip.sourcesEnLigne(path.join(tmp, 'orion-main.js'), tmp);
      const om = fs.readFileSync(path.join(tmp, 'orion-main.js'), 'utf8');
      dit(om.includes('CANCALE_VC'), 'K1 · le paquet Orion porte la source de vc-inject.js (posée en ligne)');
      // orion-main.js sur une page Vestiaire : le capteur posé EN LIGNE, aucune balise `src`.
      const poses = [];
      const el = () => ({ setAttribute() {}, remove() {}, set textContent(t) { this._t = t; }, get textContent() { return this._t; } });
      const attrs = {};
      const g = { location: { hostname: 'fr.vestiairecollective.com' }, console: { warn() {} }, MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
        document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] || null, removeAttribute: (k) => { delete attrs[k]; } }, querySelector: () => null, createElement: () => el(),
          head: { appendChild: (s) => { poses.push(s); if (s._t) { const m = /setAttribute\("([^"]+)","1"\)/.exec(s._t); if (m) attrs[m[1]] = '1'; } } } },
        chrome: { runtime: { getURL: (p) => 'chrome-extension://x/' + p } } };
      g.globalThis = g; vm.createContext(g); vm.runInContext(om, g);
      dit(poses.length === 1 && !!poses[0]._t && poses[0]._t.includes('CANCALE_VC') && !poses[0].src, 'K2 · orion-main.js sur Vestiaire : vc-inject.js posé EN LIGNE (à document_start), pas de balise `src` tardive', JSON.stringify(poses.map((p) => ({ src: p.src, enLigne: !!p._t }))));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  // ── A : l'app (et le serveur) lisent une date sans fuseau à l'heure de Paris.
  await essaie('A', async () => {
    const R = await import(pathToFileURL(F.regle).href);
    const t = R.dateVenteVc({ date: '2026-11-13 00:41:07' });
    dit(t === Date.UTC(2026, 10, 12, 23, 41, 7), 'A1 · « 2026-11-13 00:41:07 » (rangée avant la 5.374) = 00:41 à Paris, même sur un serveur en UTC', new Date(t).toISOString());
    dit(R.dateVenteVc({ date: '2026-11-13T00:41:07+01:00' }) === Date.UTC(2026, 10, 12, 23, 41, 7) && R.dateVenteVc({ date: '' }) === 0 && R.dateVenteVc({ date: 'pas une date' }) === 0, 'A2 · avec son fuseau comme avant ; vide ou illisible ⇒ 0 (« pas su »)');
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ la vente Vestiaire est captée juste, sur Orion comme sur ordinateur');
  process.exit(ko ? 1 : 0);
})();
