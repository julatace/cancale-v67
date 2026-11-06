// ════════════════════════════════════════════════════════════════════════════
//  LA BOÎTE MAIL FAÇON MAIL (6 nov., v36) — les règles EXÉCUTÉES
//  Julien : « continue à améliorer la boîte mail de l'app, c'est pas ouf ».
//
//  M1. La ligne courte et la carte « ce qu'il faut savoir » viennent du RÉSUMÉ
//      rangé, JAMAIS du sujet (un sujet piégé n'écrit rien) ; un N° retrouvé par
//      le titre n'est jamais écrit (§5).
//  M2. Le code de retrait est sur la ligne SEULEMENT s'il est lu (et pour un
//      colis à retirer) ; jamais tiré du sujet ni du texte.
//  M3. Les gestes ne partent que d'une IDENTITÉ lue (n° de suivi, de transaction,
//      d'annonce Vestiaire, N° lu) ; l'offre n'ouvre qu'un filtre, dit comme tel.
//  M4. Le message d'origine est rendu SANS HTML : balises, `<script>`, `<iframe>`,
//      `on…=` retirés ; un lien seulement en http(s) ; aucun `dangerouslySetInnerHTML`,
//      `srcdoc`, `iframe` ni `innerHTML` dans l'écran.
//  M5. Lu / non lu : une règle (api/_lib/emails-lus.js) — état de départ, gestes,
//      deux appareils (rien ne s'efface), « pas su » ≠ « lu ».
//  M6. La VRAIE route (`lireJournalEmail`, base servie dans sa forme par
//      scripts/bancs/_minipgrest.cjs) : `lu` par ligne, filtre « Non lus » paginé,
//      nombre de non-lus, lus illisibles ⇒ `null` et « Non lus » refusé ; jamais
//      `select=data` ; rubrique « offres » = la même règle que l'étiquette.
//  M7. L'écriture des lus (src/emailsLusEcriture.js) : une lecture ratée n'écrit
//      RIEN ; un conflit (data.rev) relit et rejoue ; deux appareils s'additionnent.
//  M8. Les piles : au moins 3 e-mails identiques et consécutifs, jamais deux codes
//      différents dans une pile, aucun e-mail perdu.
//  Données inventées (dépôt public). `--prouve` : chaque mutation rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const MUTATIONS = {
  'code tiré de n’importe quel suivi': [['src/boiteEmails.js', "r.t === 'suivi' && r.st === 'available' && r.sens !== 'sortant' && typeof r.code === 'string'", "typeof r.code === 'string'"]],
  'N° par le titre écrit sur la carte': [['src/boiteEmails.js', "const num = r.n && !r.nt ? String(r.n) : '';", "const num = r.n ? String(r.n) : '';"]],
  'geste vente sans identité valide': [['src/boiteEmails.js', "r.av !== 'analyse' && IDENT.test(String(r.tx || ''))", 'true']],
  'balises gardées dans le message': [['src/boiteEmails.js', "const t = retirerBalises(texte).replace(INVISIBLES", 'const t = String(texte).replace(INVISIBLES']],
  'lien javascript: gardé': [['src/boiteEmails.js', "d = /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\\./, '') : '';", "d = u.hostname || u.protocol;"], ['src/boiteEmails.js', 'const LIEN = /\\bhttps?:\\/\\/', 'const LIEN = /\\b(?:https?:\\/\\/|javascript:)']],
  'tout lu par défaut quand la ligne manque': [['api/_lib/emails-lus.js', 'const jusqua = Math.max(ms(LUS_DEPUIS), ms(d.jusqua) || 0);', 'const jusqua = Date.now() + 864e5;']],
  'pas su compté comme lu': [['api/_lib/emails-lus.js', '  if (!etat) return null;\n  const k = cleLu', '  if (!etat) return true;\n  const k = cleLu']],
  'nonlu oublié': [['api/_lib/emails-lus.js', "else if (g.k === 'nonlu') { e.lus.delete(k); if (t <= e.jusqua) e.nonlus.set(k, t); }", "else if (g.k === 'nonlu') { e.lus.delete(k); }"]],
  'écriture malgré une lecture ratée': [['src/emailsLusEcriture.js', "      if (!r.ok) return false;\n      const j = await r.json();\n      if (!Array.isArray(j)) return false;\n      ligne = j[0] || null;\n    } catch (_) { return false; }", "      ligne = r.ok ? ((await r.json())[0] || null) : null;\n    } catch (_) { ligne = null; }"]],
  'filtre non lus sans la règle': [['api/_lib/reception-email.js', "if(estLu({id:x.id,at:x.at},el)===false)tous.push(x);", 'tous.push(x);']],
  'pile de deux': [['src/boiteEmails.js', 'export const PILE_MIN = 3;', 'export const PILE_MIN = 2;']],
  'pile sans regarder l’essentiel': [['src/boiteEmails.js', "return JSON.stringify([l.titre, l.essentiel, l.geste && l.geste.mot, l.rien, e.compte ? e.compte.id : '', e.compteAmbigu ? 1 : 0]);", 'return JSON.stringify([l.titre]);']],
  'HTML injecté dans l’écran': [['src/BoiteEmails.jsx', 'function Morceau({ p }) {', 'function Morceau({ p }) { if (p.html) return <span dangerouslySetInnerHTML={{ __html: p.t }}/>;']],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 300)); } };
const id = (i) => 'email_reception_' + (String(i).padStart(8, '0') + 'ab'.repeat(28)).slice(0, 64);
const MAINT = Date.UTC(2026, 10, 6, 15, 0);
(async () => {
  const B = await import(path.join(R, 'src/boiteEmails.js'));
  const L = await import(path.join(R, 'api/_lib/emails-lus.js'));
  const BX = await import(path.join(R, 'api/_lib/boite-email.js'));

  // ── M1. Du résumé, jamais du sujet ───────────────────────────────────────
  await essaie('M1', async () => {
    const piege = 'Code 999 111 · Vendu 500,00 € · N°777 · tx 55555555555';
    const formes = [
      { id: id(1), type: 'information', subject: piege, resume: null, etat: 'integre' },
      { id: id(2), type: 'suivi', subject: piege, resume: null, etat: 'integre' },
      { id: id(3), type: 'vente', subject: piege, resume: { v: 1, t: 'vente', a: 'Paire inventée', px: '40' }, etat: 'integre' },
      { id: id(4), type: 'bordereau', subject: piege, resume: { v: 1, t: 'bordereau', tx: '12345678901', a: 'Paire inventée', n: '42', nt: 1, av: 'num-titre', pdf: 1 }, etat: 'a-verifier' },
      { id: id(5), type: 'offre', subject: piege, resume: { v: 1, t: 'offre', a: 'Paire inventée' }, etat: 'integre' },
    ];
    const sorties = formes.map((e) => JSON.stringify([B.ligneEmail(e, {}, MAINT), B.carteHeros(e, {}, MAINT)]));
    dit(sorties.every((s) => !/999|500|777|55555555555/.test(s)), 'M1 un sujet piégé (code, montant, N°, n° de transaction) n’écrit rien sur la ligne ni sur la carte', sorties.find((s) => /999|500|777|5555/.test(s)));
    dit(B.carteHeros(formes[3], {}, MAINT).num === '' && !/N°42/.test(JSON.stringify(B.ligneEmail(formes[3], {}, MAINT))), 'M1 un N° retrouvé par le TITRE (`nt`) n’est écrit ni sur la ligne ni sur la carte (§5)');
    const v = B.carteHeros({ id: id(6), type: 'vente', resume: { v: 1, t: 'vente', a: 'Nike inventée', px: '55.00', n: '17' } }, {}, MAINT);
    dit(v.genre === 'vente' && v.montant === '55,00 €' && v.article === 'Nike inventée' && v.num === '17', 'M1 la carte d’une vente : montant, article et N° LUS dans le résumé', JSON.stringify(v));
    const r = B.carteHeros({ id: id(7), type: 'suivi', resume: { v: 1, t: 'suivi', s: 'MR1', st: 'available', code: '418205', lieu: 'RELAIS DU PORT, 12 RUE DES EMBRUNS, 35000 EXEMPLEVILLE', lim: '2026-11-07' } }, {}, MAINT);
    dit(r.genre === 'retrait' && r.code === '418 205' && r.lieu.nom === 'Relais du Port' && r.lieu.adresse === '12 Rue des Embruns, 35000 Exempleville' && r.limite.mot === 'demain' && r.limite.proche === true, 'M1 la carte d’un retrait : code, lieu mis en forme (rien ajouté), date limite « demain »', JSON.stringify(r));
  });

  // ── M2. Le code sur la ligne, seulement lu ───────────────────────────────
  await essaie('M2', async () => {
    const c = (resume, subject = '') => B.codeSurLigne({ id: id(9), type: 'suivi', subject, resume });
    dit(c({ t: 'suivi', st: 'available', code: '418205' }) === '418 205', 'M2 un code LU est sur la ligne (espacé pour être lu)');
    dit(c(null, 'Votre code de retrait 123456') === '' && c({ t: 'suivi', st: 'available' }, 'code 123456') === '' && c({ t: 'suivi', st: 'available', code: '  ' }) === '', 'M2 pas de code lu ⇒ rien (jamais le sujet, jamais un code vide)');
    dit(c({ t: 'suivi', st: 'available', sens: 'sortant', code: '418205' }) === '' && c({ t: 'suivi', st: 'transit', code: '418205' }) === '' && B.codeSurLigne({ resume: { t: 'bordereau', code: '418205' } }) === '', 'M2 un colis que TON acheteur retire, un colis en route, un bordereau : pas de code sur la ligne');
  });

  // ── M3. Les gestes, par identité ────────────────────────────────────────
  await essaie('M3', async () => {
    const g = (e) => B.gestesEmail(e, {});
    const bord = g({ id: id(10), type: 'bordereau', etat: 'integre', resume: { v: 1, t: 'bordereau', tx: '12345678901', a: 'Paire', pdf: 1 } });
    dit(bord.length === 2 && bord[0].principal && bord[0].url === '?tab=cat_bord&cible=colis&tx=12345678901' && bord[1].url === '?tab=cat_ventes&cible=vente&tx=12345678901', 'M3 un bordereau : « Voir le colis à envoyer » et « Voir la vente », par SON n° de transaction', JSON.stringify(bord));
    const sans = g({ id: id(11), type: 'vente', subject: 'Vendu tx 12345678901', resume: { v: 1, t: 'vente', a: 'Paire', px: '40' } });
    dit(sans.length === 0, 'M3 une vente sans identité dans le résumé : AUCUN geste (le sujet ne relie rien)', JSON.stringify(sans));
    const nt = g({ id: id(12), type: 'bordereau', etat: 'a-verifier', resume: { v: 1, t: 'bordereau', tx: '12345678901', n: '42', nt: 1, av: 'num-titre', pdf: 1 } });
    dit(!nt.some((x) => x.k === 'num'), 'M3 un N° retrouvé par le titre n’ouvre jamais la fiche du N°');
    const piege = g({ id: id(13), type: 'bordereau', resume: { v: 1, t: 'bordereau', tx: '1&cible=doublon', pdf: 1 } });
    dit(!piege.some((x) => /cible=vente/.test(x.url || '')), 'M3 une identité mal formée ne fabrique pas d’adresse', JSON.stringify(piege));
    const off = g({ id: id(14), type: 'offre', resume: { v: 1, t: 'offre', a: 'Paire', mt: '30' } });
    dit(off.length === 1 && off[0].url === '?tab=cat_msg&cible=offres' && !off[0].ident && /Messages/.test(off[0].mot), 'M3 une offre : le filtre « Offres » de Messages, dit comme tel (aucune conversation devinée)');
    const vc = g({ id: id(15), type: 'vente-vestiaire', resume: { v: 1, t: 'vente-vestiaire', p: '50000001', a: 'Paire', mt: '82,40' } });
    dit(vc.length === 1 && vc[0].url === '?tab=cat_ventes&cible=vcvente&vc=50000001', 'M3 une vente Vestiaire : par son n° d’annonce', JSON.stringify(vc));
  });

  // ── M4. Le message sans HTML ─────────────────────────────────────────────
  await essaie('M4', async () => {
    const hostile = 'Bonjour,\n<script>window.x=1</script><img src=x onerror="a()"><iframe src="https://piege.test"></iframe><svg onload=alert(1)>\n&lt;script&gt;alert(2)&lt;/script&gt;\n<a href="javascript:alert(3)">clic</a> Voir javascript:alert(4) et https://exemple.test/aide.\n*Gras* et **********1234';
    const c = B.lireCorps(hostile);
    const txt = JSON.stringify(c);
    dit(!/<\s*\/?\s*(script|iframe|img|svg|a)\b/i.test(txt) && !/onerror|onload/i.test(txt) && !/alert\(1\)|window\.x/.test(txt), 'M4 balises, <script>, <iframe>, on…= retirés (même cachés derrière des entités)', txt.slice(0, 300));
    const liens = c.blocs.flatMap((b) => b.parts).filter((p) => p.lien).map((p) => p.lien);
    dit(liens.length === 1 && liens[0] === 'https://exemple.test/aide', 'M4 un lien seulement en http(s) (jamais javascript:)', JSON.stringify(liens));
    dit(c.blocs.some((b) => b.parts.some((p) => p.gras && p.t === 'Gras')) && /•••• 1234/.test(txt), 'M4 le « *gras* » devient du gras ; une carte masquée reste lisible (•••• 1234)');
    const flot = B.lireCorps('E-mail Vinted\n\nTon colis a été livré dans le Point Relais RELAIS DU MARCHÉ, 12 RUE DU \nPORT. Tu peux, dès maintenant, aller le \nrécupérer.\n\n[image: Instagram] \n . \nCet e-mail t\'a été envoyé par Vinted, UAB, adresse inventée.');
    dit(flot.blocs.length === 1 && flot.blocs[0].parts.map((p) => p.t).join('') === 'Ton colis a été livré dans le Point Relais RELAIS DU MARCHÉ, 12 RUE DU PORT. Tu peux, dès maintenant, aller le récupérer.' && /^Cet e-mail/.test(flot.pied), 'M4 les lignes coupées sont recollées, « [image: …] » et points orphelins partent, les mentions vont à part (repliées, jamais retirées)', JSON.stringify(flot));
    const ecran = sansCommentaires(fs.readFileSync(path.join(R, 'src/BoiteEmails.jsx'), 'utf8'));
    dit(!/dangerouslySetInnerHTML|srcdoc|<iframe|\.innerHTML/.test(ecran), 'M4 l’écran ne rend AUCUN HTML (ni dangerouslySetInnerHTML, ni iframe, ni innerHTML)');
    dit(/target="_blank" rel="noopener noreferrer nofollow"/.test(ecran), 'M4 un lien s’ouvre ailleurs, sans renvoi ni accès à la page');
  });

  // ── M5. Lu / non lu, une règle ───────────────────────────────────────────
  await essaie('M5', async () => {
    const avant = { id: id(20), at: '2026-11-01T10:00:00.000Z' }, apres = { id: id(21), at: '2026-11-06T19:00:00.000Z' }, apres2 = { id: id(22), at: '2026-11-06T20:00:00.000Z' };
    const e0 = L.etatLus(undefined);
    dit(L.estLu(avant, e0) === true && L.estLu(apres, e0) === false, 'M5 sans ligne : avant la mise en service = lu, après = non lu (aucune écriture pour ça)');
    dit(L.estLu(apres, null) === null && L.etatLus(null) === null, 'M5 ligne illisible ⇒ « pas su » (jamais « lu »)');
    const d1 = L.appliquerGestes(undefined, [{ k: 'lu', id: apres.id, at: apres.at }, { k: 'nonlu', id: avant.id, at: avant.at }]);
    const e1 = L.etatLus(d1);
    dit(L.estLu(apres, e1) === true && L.estLu(avant, e1) === false && L.estLu(apres2, e1) === false, 'M5 ouvrir = lu ; « Marquer non lu » sur un ancien = non lu ; les autres ne bougent pas', JSON.stringify(d1));
    const d2 = L.appliquerGestes(d1, [{ k: 'tout', jusqua: apres2.at }]);
    dit([avant, apres, apres2].every((x) => L.estLu(x, L.etatLus(d2)) === true) && d2.lus.length === 0 && d2.nonlus.length === 0, '« Tout marquer lu » couvre tout jusqu’au plus récent (et range les listes)', JSON.stringify(d2));
    // Deux appareils : A lit X, B lit Y — chacun rejoue SES gestes sur la ligne relue.
    const base = L.appliquerGestes(undefined, []);
    const A = L.appliquerGestes(base, [{ k: 'lu', id: apres.id, at: apres.at }]);
    const AB = L.appliquerGestes(A, [{ k: 'lu', id: apres2.id, at: apres2.at }]);
    dit(L.estLu(apres, L.etatLus(AB)) && L.estLu(apres2, L.etatLus(AB)), 'M5 deux appareils : les deux gestes restent (rien ne s’efface)');
    const gros = L.appliquerGestes(undefined, Array.from({ length: 900 }, (_, i) => ({ k: 'lu', id: id(1000 + i), at: new Date(Date.UTC(2026, 10, 7) + i * 1000).toISOString() })));
    dit(gros.lus.length === L.LUS_MAX && JSON.stringify(gros).length < 30000, 'M5 la ligne reste bornée (au plus ' + L.LUS_MAX + ' clés, < 30 Ko)', String(JSON.stringify(gros).length));
  });

  // ── M6. La vraie route ───────────────────────────────────────────────────
  const { servir } = require(path.join(__dirname, 'bancs', '_minipgrest.cjs'));
  const RE = await import(path.join(R, 'api/_lib/reception-email.js'));
  const OWNER = '22222222-2222-2222-2222-222222222222';
  const lignes = [];
  for (let i = 0; i < 70; i++) {
    const at = new Date(Date.UTC(2026, 10, 6, 23, 0) - i * 3600e3).toISOString();
    const t = ['offre', 'suivi', 'vente', 'connu-sans-action'][i % 4];
    lignes.push({ owner: OWNER, id: id(100 + i), data: { at, etat: 'integre', type: t, subject: 'Sujet ' + i, from: 'Vinted <no-reply@vinted.fr>', adresses: ['une@exemple.test'], resume: t === 'suivi' ? { v: 1, t, s: 'S' + i, st: 'available', code: String(100000 + i) } : { v: 1, t } } });
  }
  lignes.push({ owner: OWNER, id: 'main', data: { vinted_account_emails: { 1: 'une@exemple.test' } } });
  lignes.push({ owner: OWNER, id: 'vrm_email_owners', data: { adresses: { 'une@exemple.test': { owner: OWNER } } } });
  lignes.push({ owner: 'autre', id: id(999), data: { at: '2026-11-06T22:59:00.000Z', etat: 'integre', type: 'offre', subject: 'Pas à toi', from: 'x', adresses: [] } });
  const requetes = [];
  let lusEnPanne = false;
  const fetcher = async (u) => { requetes.push(decodeURIComponent(u)); if (lusEnPanne && /vrm_emails_lus/.test(u)) return { ok: false, status: 503, json: async () => ({}) }; const url = new URL(u); const t = url.pathname.split('/').pop(); const body = t === 'vinted_accounts' ? [{ vinted_user_id: '1', login: 'compte-un' }] : servir(lignes, u, {}).body; return { ok: true, status: 200, json: async () => body }; };
  const opts = { owner: OWNER, url: 'http://base.test', headers: {}, fetcher };
  await essaie('M6', async () => {
    const j0 = await RE.lireJournalEmail({ ...opts, parPage: 50 });
    // Sans ligne de lus : ce qui est rangé après la mise en service (6 nov. 18 h) est non lu.
    const attendus = lignes.filter((x) => x.id.startsWith('email_reception_') && x.owner === OWNER && x.data.at > L.LUS_DEPUIS).length;
    dit(j0.emails.length === 50 && j0.suite === true && j0.emails.every((e) => typeof e.lu === 'boolean') && j0.compteurs.nonLus === attendus && j0.lus === 'lu', 'M6 50 par page, `lu` sur chaque ligne, le nombre de non-lus vient de la règle', JSON.stringify({ n: j0.emails.length, nl: j0.compteurs.nonLus, attendus }));
    lignes.push({ owner: OWNER, id: 'vrm_emails_lus', data: L.appliquerGestes(undefined, [{ k: 'lu', id: id(100), at: lignes[0].data.at }, { k: 'nonlu', id: id(150), at: lignes[50].data.at }]) });
    const j1 = await RE.lireJournalEmail({ ...opts, nonlus: true, parPage: 20 });
    const vus = j1.emails.map((e) => e.id);
    dit(!vus.includes(id(100)) && vus.includes(id(150)) && j1.emails.every((e) => e.lu === false) && !vus.includes(id(999)), 'M6 « Non lus » : le lu sort, le remis non lu revient, rien d’un autre vendeur', JSON.stringify(vus.slice(0, 6)));
    const j1b = await RE.lireJournalEmail({ ...opts, nonlus: true, parPage: 20, page: 1 });
    dit(j1b.emails.every((e) => !vus.includes(e.id)) && j1b.emails.every((e) => e.lu === false), 'M6 « Non lus » se pagine sans doublon');
    const j2 = await RE.lireJournalEmail({ ...opts, nonlus: true, boite: 'offres', parPage: 50 });
    dit(j2.emails.length > 0 && j2.emails.every((e) => e.type === 'offre' && e.lu === false), 'M6 « Non lus » se combine avec une rubrique (offres)');
    lusEnPanne = true;
    const j3 = await RE.lireJournalEmail({ ...opts, parPage: 50 });
    dit(j3.lus === 'pas-su' && j3.emails.every((e) => e.lu === null) && j3.compteurs.nonLus === null, 'M6 lus illisibles : chaque ligne dit « pas su » (null), aucun nombre de non-lus');
    let refuse = false; try { await RE.lireJournalEmail({ ...opts, nonlus: true }); } catch (_) { refuse = true; }
    dit(refuse, 'M6 lus illisibles : « Non lus » est refusé (503 côté route), jamais une liste vide qui dirait « tout est lu »');
    lusEnPanne = false;
    dit(!requetes.some((q) => /select=data(&|$)/.test(q) && /email_reception_/.test(q)), 'M6 aucune lecture `select=data` sur les lignes de réception (§4.4)');
    const formes = [{ type: 'offre' }, { type: 'vente' }, { type: 'suivi', resume: { code: '1' } }, { type: 'connu-sans-action' }];
    const f = BX.filtreBoite('offres');
    dit(BX.rubriqueEmail({ type: 'offre' }) === 'offres' && /in\.\(offre\)/.test(decodeURIComponent(f)) && formes.filter((e) => BX.dansRubrique(e, 'offres')).length === 1 && BX.rubriqueConnue('offres'), 'M6 rubrique « Offres » : l’étiquette et le filtre de la base disent la même chose');
  });

  // ── M7. L'écriture des lus ───────────────────────────────────────────────
  await essaie('M7', async () => {
    const { ecrireEmailsLus } = await import(path.join(R, 'src/emailsLusEcriture.js'));
    const rep = (b, s = 200) => ({ ok: s < 300, status: s, json: async () => b });
    let ecrites = 0;
    const ko = await ecrireEmailsLus([{ k: 'lu', id: id(1), at: '2026-11-07T00:00:00.000Z' }], { url: 'u', entetes: () => ({}), avecOwner: (x) => x, owner: 'o', cloisonne: true, fetcher: async (u, o) => { if (o && o.method) { ecrites++; return rep([]); } return rep({}, 503); } });
    dit(ko === false && ecrites === 0, 'M7 lecture ratée ⇒ rien n’est écrit (le cas qui détruit)');
    // Conflit : la ligne change entre la lecture et l'écriture ; on relit et on rejoue.
    let ligne = { id: 'vrm_emails_lus', data: { ...L.appliquerGestes(undefined, [{ k: 'lu', id: id(2), at: '2026-11-07T01:00:00.000Z' }]), rev: 3 } };
    let premier = true;
    const ok2 = await ecrireEmailsLus([{ k: 'lu', id: id(3), at: '2026-11-07T02:00:00.000Z' }], { url: 'u', entetes: () => ({}), avecOwner: (x) => x, owner: 'o', cloisonne: true, fetcher: async (u, o) => {
      if (!o || !o.method) return rep([ligne]);
      const rev = /data->>rev=eq\.(\d+)/.exec(decodeURIComponent(u));
      if (premier) { premier = false; ligne = { ...ligne, data: { ...L.appliquerGestes(ligne.data, [{ k: 'lu', id: id(4), at: '2026-11-07T03:00:00.000Z' }]), rev: 4 } }; return rep([]); }
      if (!rev || Number(rev[1]) !== ligne.data.rev) return rep([]);
      ligne = { ...ligne, data: JSON.parse(o.body).data }; return rep([{ id: 'vrm_emails_lus' }]);
    } });
    const e = L.etatLus(ligne.data);
    dit(ok2 === true && [2, 3, 4].every((i) => L.estLu({ id: id(i), at: '2026-11-07T05:00:00.000Z' }, e) === true) && ligne.data.rev === 5, 'M7 un autre appareil écrit entre deux : on relit, on rejoue — les trois lectures restent', JSON.stringify(ligne.data).slice(0, 200));
  });

  // ── M8. Les piles ────────────────────────────────────────────────────────
  await essaie('M8', async () => {
    const em = (i, resume, extra = {}) => ({ id: id(300 + i), at: new Date(MAINT - i * 60e3).toISOString(), etat: 'integre', type: resume.t, resume: { v: 1, ...resume }, compte: { id: '1', nom: 'c' }, ...extra });
    const maj = { t: 'connu-sans-action', f: 'commande mise à jour (le statut vient de la moisson)' };
    const l = [em(0, maj), em(1, maj), em(2, maj), em(3, maj), em(4, { t: 'offre', mt: '30' }), em(5, maj), em(6, maj),
      em(7, { t: 'suivi', st: 'available', s: 'A', code: '111111', lieu: 'X' }), em(8, { t: 'suivi', st: 'available', s: 'B', code: '222222', lieu: 'X' }), em(9, { t: 'suivi', st: 'available', s: 'C', code: '333333', lieu: 'X' })];
    const p = B.empiler(l, {}, MAINT);
    const tous = p.flatMap((x) => (x.k === 'pile' ? x.emails : [x.e])).map((x) => x.id);
    dit(p[0].k === 'pile' && p[0].emails.length === 4 && p[1].k === 'email' && p[2].k === 'email' && p[3].k === 'email', 'M8 4 « Commande mise à jour » de suite = UNE pile ; 2 de suite restent deux lignes', JSON.stringify(p.map((x) => x.k + (x.emails ? x.emails.length : ''))));
    dit(!p.some((x) => x.k === 'pile' && new Set(x.emails.map((e) => e.resume.code)).size > 1), 'M8 trois codes de retrait différents ne s’empilent jamais');
    dit(JSON.stringify(tous) === JSON.stringify(l.map((x) => x.id)), 'M8 aucun e-mail perdu ni déplacé par les piles');
  });

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
}
